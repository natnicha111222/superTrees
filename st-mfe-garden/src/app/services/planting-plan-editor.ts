// สถานะโหมดแก้ไขแผนปลูก (ต่อหน้า): ลบ/เพิ่มหมุด + เลื่อน/หมุนกริด + ระยะปลูก → พรีวิว/บันทึกผ่านหลังบ้าน
// - หน้าบ้านเก็บแค่ "สิ่งที่ผู้ใช้แก้" (มุม, ระยะ, offset, removed, extras) · ตำแหน่ง/ลำดับ/แถวคำนวณที่ garden-service เสมอ
// - แก้แต่ละครั้ง → debounce → พรีวิว (switchMap ยกเลิก request ที่ค้าง — CLAUDE.md)
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, finalize, firstValueFrom, map, of, switchMap } from 'rxjs';
import type { LngLat, PlannedTreeDto, PlantingPlanDto, PlantingPlanLayoutDto, PlantingPlanPreviewRequest } from '@supertrees/contracts';
import { apiErrorMessage } from '@supertrees/shared-ui';
import { PlantingPlanApi } from './planting-plan-api.service';

export type PlanEditMode = 'inspect' | 'add' | 'delete';

/** ขนาดการขยับต่อการกด */
export const PLAN_SHIFT_STEP_M = 0.5;
export const PLAN_ROTATE_STEP_DEG = 0.5;
const PREVIEW_DEBOUNCE_MS = 200;

interface EditState {
  name: string;
  spacingM: number;
  /** null = ขนานขอบแรก (ค่าอัตโนมัติ) */
  angleDeg: number | null;
  offsetM: [number, number];
  removed: LngLat[];
  extras: LngLat[];
}

@Injectable()
export class PlantingPlanEditor {
  private readonly api = inject(PlantingPlanApi);

  readonly active = signal(false);
  readonly mode = signal<PlanEditMode>('inspect');
  readonly state = signal<EditState | null>(null);
  readonly preview = signal<PlantingPlanLayoutDto | null>(null);
  readonly previewing = signal(false);
  readonly saving = signal(false);
  readonly dirty = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);

  private plan: PlantingPlanDto | null = null;
  private readonly requests = new Subject<EditState>();

  readonly trees = computed<PlannedTreeDto[]>(() => this.preview()?.trees ?? []);

  constructor() {
    this.requests
      .pipe(
        debounceTime(PREVIEW_DEBOUNCE_MS),
        switchMap((st) => {
          const plan = this.plan;
          if (!plan) return of(null);
          if (!(st.spacingM >= 0.5 && st.spacingM <= 100)) {
            this.error.set('ระยะปลูกต้องอยู่ระหว่าง 0.5–100 เมตร');
            return of(null);
          }
          this.previewing.set(true);
          return this.api.preview(plan.parcelId, this.body(plan, st)).pipe(
            map((res) => ({ st, res })),
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
        this.error.set(null);
        this.preview.set(r.res);
        // รับมุมที่หลังบ้านคำนวณให้ (ค่าอัตโนมัติ) เฉพาะเมื่อผู้ใช้ยังไม่แก้ต่อระหว่างรอ
        if (this.state() === r.st && r.st.angleDeg === null) this.state.set({ ...r.st, angleDeg: r.res.angleDeg });
      });
  }

  start(plan: PlantingPlanDto): void {
    this.plan = plan;
    this.state.set({
      name: plan.name,
      spacingM: plan.spacingM,
      angleDeg: plan.angleDeg,
      offsetM: plan.offsetM,
      removed: plan.removed,
      extras: plan.extras,
    });
    this.preview.set(plan);
    this.mode.set('inspect');
    this.dirty.set(false);
    this.error.set(null);
    this.message.set(null);
    this.active.set(true);
  }

  stop(): void {
    this.active.set(false);
    this.plan = null;
  }

  // ── หมุด ──
  addPoint(p: LngLat): void {
    this.change((s) => ({ ...s, extras: [...s.extras, p] }), 'เพิ่มหมุด');
  }

  removeTree(treeId: string): void {
    const t = this.trees().find((x) => x.treeId === treeId);
    if (!t) return;
    if (t.manual) {
      // หมุดที่เพิ่มเอง → ลบออกจาก extras (ตัวที่ใกล้สุด)
      this.change((s) => {
        const i = nearestIndex(s.extras, t.lngLat);
        return { ...s, extras: s.extras.filter((_, j) => j !== i) };
      }, `ลบ ${treeId}`);
    } else {
      // หมุดตามกริด → จำตำแหน่งที่ลบไว้ (เลื่อนกริดเล็กน้อยแล้วยังว่างอยู่)
      this.change((s) => ({ ...s, removed: [...s.removed, t.lngLat] }), `ลบ ${treeId}`);
    }
  }

  /** คืนหมุดตามกริดที่ลบไปทั้งหมด */
  fillGaps(): void {
    const n = this.state()?.removed.length ?? 0;
    this.change((s) => ({ ...s, removed: [] }), n ? `คืนหมุดตามตาราง ${n} จุด` : 'หมุดตามตารางครบแล้ว');
  }

  clearAll(): void {
    this.change(
      (s) => ({ ...s, removed: [...s.removed, ...this.trees().filter((t) => !t.manual).map((t) => t.lngLat)], extras: [] }),
      'ลบหมุดทั้งหมดแล้ว — ใช้โหมด "เพิ่ม" หรือ "เติมจุดตามตาราง"',
    );
  }

  // ── กริด ──
  /** เลื่อนตามแนวกริด: du = ตามแนวแถว, dv = ตั้งฉาก (+ = ขึ้น) */
  shift(du: number, dv: number): void {
    this.change((s) => ({ ...s, offsetM: [round(s.offsetM[0] + du, 3), round(s.offsetM[1] + dv, 3)] }));
  }

  rotate(deltaDeg: number): void {
    const a = this.state()?.angleDeg ?? this.preview()?.angleDeg;
    if (a == null) return;
    this.change((s) => ({ ...s, angleDeg: round(a + deltaDeg, 4) }));
  }

  setSpacing(m: number): void {
    this.change((s) => ({ ...s, spacingM: m }));
  }

  setName(name: string): void {
    const s = this.state();
    if (!s) return;
    this.state.set({ ...s, name });
    this.dirty.set(true);
  }

  /** มุมกลับเป็นขนานขอบแรก + เลิกเลื่อน */
  resetGrid(): void {
    this.change((s) => ({ ...s, angleDeg: null, offsetM: [0, 0] }), 'รีเซ็ตตาราง: ขนานขอบแรก ไม่เลื่อน');
  }

  async save(): Promise<PlantingPlanDto> {
    const plan = this.plan;
    const st = this.state();
    if (!plan || !st) throw new Error('ไม่ได้อยู่ในโหมดแก้ไข');
    this.saving.set(true);
    this.error.set(null);
    try {
      const saved = await firstValueFrom(this.api.update(plan.parcelId, plan.id, { ...this.body(plan, st), name: st.name.trim() }));
      this.dirty.set(false);
      return saved;
    } catch (e) {
      this.error.set(apiErrorMessage(e));
      throw e;
    } finally {
      this.saving.set(false);
    }
  }

  private body(plan: PlantingPlanDto, st: EditState): PlantingPlanPreviewRequest {
    return {
      boundary: plan.boundary,
      spacingM: st.spacingM,
      ...(st.angleDeg === null ? {} : { angleDeg: st.angleDeg }),
      offsetM: st.offsetM,
      removed: st.removed,
      extras: st.extras,
    };
  }

  private change(fn: (s: EditState) => EditState, message: string | null = null): void {
    const s = this.state();
    if (!s) return;
    const next = fn(s);
    this.state.set(next);
    this.dirty.set(true);
    this.message.set(message);
    this.requests.next(next);
  }
}

function nearestIndex(pts: LngLat[], p: LngLat): number {
  let best = -1;
  let bestD = Infinity;
  pts.forEach(([x, y], i) => {
    const d = (x - p[0]) ** 2 + (y - p[1]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

function round(x: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}
