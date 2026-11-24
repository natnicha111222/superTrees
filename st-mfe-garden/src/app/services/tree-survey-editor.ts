// สถานะของ editor ผลการนับ (TASK-010): แก้จุดต้นไม้ + ปรับกริด แล้วพรีวิว/บันทึกผ่านหลังบ้าน
// ใช้ทั้งผลที่บันทึกแล้ว (หน้าผล) และฉบับร่างก่อนบันทึก (หน้าวิเคราะห์ใหม่) — หน้าที่เรียกส่งฟังก์ชันพรีวิวมาเอง
// - หน้าบ้านเก็บแค่ "สิ่งที่ผู้ใช้แก้" (จุด + ค่ากริด) · แถว/ลำดับ/ระยะ/พิกัดคำนวณที่ garden-service เสมอ
// - แก้แต่ละครั้ง → debounce → พรีวิว (switchMap ยกเลิก request ที่ค้าง — CLAUDE.md)
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, finalize, of, switchMap, type Observable } from 'rxjs';
import type {
  GridLineDto,
  GridParamsDto,
  PixelPoint,
  SurveyedTreeDto,
  TreeSurveyPreviewDto,
  TreeSurveyPreviewRequest,
  TreeSurveyStatsDto,
} from '@supertrees/contracts';
import { apiErrorMessage } from '@supertrees/shared-ui';

export type EditMode = 'inspect' | 'add' | 'delete';

/** ขนาดการขยับต่อการกด (ต้นฉบับ Colab: 2 px / 0.5°) */
export const SHIFT_STEP_PX = 2;
export const ROTATE_STEP_DEG = 0.5;
const MIN_TREES = 2;
const PREVIEW_DEBOUNCE_MS = 150;

interface PreviewRequest {
  points: PixelPoint[];
  grid: Partial<GridParamsDto> | null;
  fillGaps: boolean;
}

/** สิ่งที่ editor ต้องรู้ — มาจากผลที่บันทึกแล้วหรือผลวิเคราะห์ที่ยังไม่บันทึก */
export interface TreeSurveyEditSource {
  trees: SurveyedTreeDto[];
  gridLines: GridLineDto[];
  stats: TreeSurveyStatsDto;
  boundaryPx: PixelPoint[];
  /** คำนวณผลจากจุด/กริดที่แก้ (หลังบ้าน) */
  preview: (req: TreeSurveyPreviewRequest) => Observable<TreeSurveyPreviewDto>;
}

/** ค่าที่ส่งไปบันทึก */
export interface TreeSurveyEdit {
  points: PixelPoint[];
  grid: Partial<GridParamsDto> | null;
}

@Injectable()
export class TreeSurveyEditor {
  readonly active = signal(false);
  readonly mode = signal<EditMode>('inspect');
  readonly points = signal<PixelPoint[]>([]);
  /** null/บางฟิลด์ = ให้หลังบ้านคำนวณอัตโนมัติ */
  readonly grid = signal<Partial<GridParamsDto> | null>(null);
  readonly preview = signal<TreeSurveyPreviewDto | null>(null);
  readonly previewing = signal(false);
  readonly saving = signal(false);
  readonly dirty = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);

  private source: TreeSurveyEditSource | null = null;
  private readonly requests = new Subject<PreviewRequest>();

  /** ค่ากริดครบทุกฟิลด์ (หลังพรีวิวแล้ว) — ปุ่มเลื่อน/หมุนใช้ได้เมื่อมีค่านี้ */
  readonly resolvedGrid = computed<GridParamsDto | null>(() => {
    const g = this.grid();
    return g && g.angleDeg !== undefined && g.spacingPx !== undefined && g.originX !== undefined && g.originY !== undefined
      ? (g as GridParamsDto)
      : null;
  });

  readonly tooFew = computed(() => this.points().length < MIN_TREES);

  /** ต้นไม้ที่แสดงระหว่างแก้: ผลพรีวิว · ถ้าต้นไม้ยังไม่พอ แสดงจุดดิบ */
  readonly trees = computed<SurveyedTreeDto[]>(() => {
    if (this.tooFew()) {
      return this.points().map((p, i) => ({
        treeId: `P_${i + 1}`,
        orderNum: i + 1,
        row: 0,
        column: 0,
        pixel: p,
        lngLat: null,
        nearestTreeId: '',
        nearestDistancePx: 0,
        nearestDistanceM: null,
      }));
    }
    return this.preview()?.trees ?? [];
  });

  constructor() {
    this.requests
      .pipe(
        debounceTime(PREVIEW_DEBOUNCE_MS),
        switchMap((req) => {
          if (!this.source || req.points.length < MIN_TREES) return of(null);
          this.previewing.set(true);
          return this.source
            .preview({ points: req.points, grid: req.grid, fillGaps: req.fillGaps || undefined })
            .pipe(
              switchMap((res) => of({ req, res })),
              catchError((e: unknown) => {
                this.error.set(apiErrorMessage(e));
                return of(null);
              }),
              finalize(() => this.previewing.set(false)),
            );
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((r) => {
        if (!r) return;
        const { req, res } = r;
        this.error.set(null);
        this.preview.set(res);
        // รับค่าที่หลังบ้านคำนวณให้ เฉพาะเมื่อผู้ใช้ยังไม่ได้แก้ต่อระหว่างรอ
        if (this.grid() === req.grid) this.grid.set(res.stats.grid);
        if (req.fillGaps && this.points() === req.points) {
          this.points.set(res.trees.map((t) => t.pixel));
          this.message.set(res.addedCount ? `เติมจุดตามตาราง ${res.addedCount} จุด` : 'จุดตัดตารางในขอบเขตมีต้นไม้ครบแล้ว');
        }
      });
  }

  start(s: TreeSurveyEditSource): void {
    this.source = s;
    this.points.set(s.trees.map((t) => t.pixel));
    this.grid.set(s.stats.grid);
    this.preview.set({ stats: s.stats, gridLines: s.gridLines, trees: s.trees, addedCount: 0 });
    this.mode.set('inspect');
    this.dirty.set(false);
    this.error.set(null);
    this.message.set(null);
    this.active.set(true);
    // ผลเก่า (ก่อน contracts 0.2.0) ไม่มีค่ากริด → ขอให้หลังบ้านคำนวณ
    if (!s.stats.grid) this.refresh();
  }

  stop(): void {
    this.active.set(false);
    this.source = null;
  }

  /** ค่าที่จะบันทึก */
  edit(): TreeSurveyEdit {
    return { points: this.points(), grid: this.grid() };
  }

  // ── แก้จุด ──
  addPoint(p: PixelPoint): void {
    this.change(() => this.points.update((pts) => [...pts, p]), `เพิ่มจุดที่ (${p[0]}, ${p[1]})`);
  }

  removeTree(treeId: string): void {
    const t = this.trees().find((x) => x.treeId === treeId);
    if (!t) return;
    // ลบจุดที่ใกล้ตำแหน่งต้นนี้ที่สุด (พิกัดในผลพรีวิวถูกปัดเป็นจำนวนเต็ม)
    const pts = this.points();
    let best = -1;
    let bestD = Infinity;
    pts.forEach(([x, y], i) => {
      const d = Math.hypot(x - t.pixel[0], y - t.pixel[1]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0) this.change(() => this.points.set(pts.filter((_, i) => i !== best)), `ลบ ${treeId}`);
  }

  clearAll(): void {
    this.change(() => this.points.set([]), 'ลบจุดทั้งหมดแล้ว — คลิกโหมด "เพิ่ม" เพื่อปักใหม่');
  }

  // ── ปรับกริด ──
  /** เลื่อนตามแนวกริด: du = ซ้าย/ขวา (แนวแถว), dv = ขึ้น/ลง */
  shift(du: number, dv: number): void {
    const g = this.resolvedGrid();
    if (!g) return;
    const a = (g.angleDeg * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    this.change(() =>
      this.grid.set({ ...g, originX: g.originX + du * c - dv * s, originY: g.originY + du * s + dv * c }),
    );
  }

  /** หมุนรอบกึ่งกลางขอบเขตแปลง (เหมือนต้นฉบับที่หมุนรอบกลางตาราง) */
  rotate(deltaDeg: number): void {
    const g = this.resolvedGrid();
    const b = this.source?.boundaryPx;
    if (!g || !b?.length) return;
    const cx = b.reduce((s, p) => s + p[0], 0) / b.length;
    const cy = b.reduce((s, p) => s + p[1], 0) / b.length;
    const a = (deltaDeg * Math.PI) / 180;
    const dx = g.originX - cx;
    const dy = g.originY - cy;
    this.change(() =>
      this.grid.set({
        ...g,
        angleDeg: round(g.angleDeg + deltaDeg, 4),
        originX: cx + dx * Math.cos(a) - dy * Math.sin(a),
        originY: cy + dx * Math.sin(a) + dy * Math.cos(a),
      }),
    );
  }

  /** ระยะช่องใหม่จากจุดปัจจุบัน (มัธยฐานระยะต้นที่ใกล้สุด) — คงมุม/ตำแหน่งไว้ */
  recalcSpacing(): void {
    const g = this.grid();
    this.change(() => this.grid.set({ ...g, spacingPx: undefined }), 'คำนวณระยะช่องตารางใหม่จากจุดปัจจุบัน');
  }

  /** กลับเป็นกริดอัตโนมัติทั้งหมด */
  resetGrid(): void {
    this.change(() => this.grid.set(null), 'รีเซ็ตตารางเป็นค่าอัตโนมัติ');
  }

  fillGaps(): void {
    this.dirty.set(true);
    this.message.set(null);
    this.requests.next({ points: this.points(), grid: this.grid(), fillGaps: true });
  }

  /** บันทึกด้วยฟังก์ชันของหน้าที่เรียก (PUT ผลเดิม / POST ผลใหม่) */
  async save<T>(fn: (edit: TreeSurveyEdit) => Promise<T>): Promise<T> {
    this.saving.set(true);
    this.error.set(null);
    try {
      const saved = await fn(this.edit());
      this.dirty.set(false);
      return saved;
    } catch (e) {
      this.error.set(apiErrorMessage(e));
      throw e;
    } finally {
      this.saving.set(false);
    }
  }

  private change(fn: () => void, message: string | null = null): void {
    fn();
    this.dirty.set(true);
    this.message.set(message);
    if (this.tooFew()) this.error.set(`ต้องมีต้นไม้อย่างน้อย ${MIN_TREES} ต้นจึงจะจัดตารางได้`);
    this.refresh();
  }

  private refresh(): void {
    this.requests.next({ points: this.points(), grid: this.grid(), fillGaps: false });
  }
}

function round(x: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}
