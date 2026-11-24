// แสดงภาพมุมสูง + ขอบเขต/จุดอ้างอิง/ต้นไม้/กริด เป็น SVG ในพิกัดพิกเซลของภาพจริง
// - ซูม (ล้อเมาส์/ปุ่ม) + ลากเลื่อน · คลิก = ส่งพิกัดพิกเซลของภาพ (คำนวณจาก getScreenCTM จึงถูกต้องแม้ภาพถูกย่อ)
// - hit-test ต้นไม้ด้วย JS แทน listener ต่อจุด (ภาพหนึ่งมีได้หลายพันต้น)
// - สีทั้งหมดมาจาก token --st-viz-* ใน @supertrees/shared-ui (ห้ามใส่รหัสสีเอง)
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addOutline, removeOutline, scanOutline } from 'ionicons/icons';
import type { ControlPointDto, GridLineDto, PixelPoint, SurveyedTreeDto } from '@supertrees/contracts';

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const CLICK_TOLERANCE_PX = 5;
const TREE_HIT_PX = 10;

@Component({
  selector: 'st-survey-canvas',
  imports: [IonButton, IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap" #wrap>
      <svg
        #svg
        [attr.viewBox]="viewBoxAttr()"
        preserveAspectRatio="xMidYMid meet"
        [class.picking]="pickable()"
        (wheel)="onWheel($event)"
        (pointerdown)="onDown($event)"
        (pointermove)="onMove($event)"
        (pointerup)="onUp($event)"
        (pointercancel)="drag = null"
      >
        @if (imageUrl()) {
          <image [attr.href]="imageUrl()" x="0" y="0" [attr.width]="width()" [attr.height]="height()" />
        }

        @if (showGrid()) {
          <g [attr.stroke-width]="unit()" class="grid">
            @for (l of gridLines(); track $index) {
              <line [attr.x1]="l.x1" [attr.y1]="l.y1" [attr.x2]="l.x2" [attr.y2]="l.y2" [class.row]="l.orientation === 'h'" />
            }
          </g>
        }

        @if (boundary().length) {
          <polygon class="boundary" [attr.points]="boundaryPoints()" [attr.stroke-width]="unit() * 2" [class.open]="boundary().length < 3" />
          @for (p of boundary(); track $index) {
            <circle class="vertex" [attr.cx]="p[0]" [attr.cy]="p[1]" [attr.r]="unit() * 5" [attr.stroke-width]="unit()" />
          }
        }

        @for (cp of controlPoints(); track $index) {
          <g class="cp">
            <rect
              [attr.x]="cp.pixel[0] - unit() * 6"
              [attr.y]="cp.pixel[1] - unit() * 6"
              [attr.width]="unit() * 12"
              [attr.height]="unit() * 12"
              [attr.transform]="'rotate(45 ' + cp.pixel[0] + ' ' + cp.pixel[1] + ')'"
              [attr.stroke-width]="unit()"
            />
            <text [attr.x]="cp.pixel[0] + unit() * 9" [attr.y]="cp.pixel[1] - unit() * 7" [attr.font-size]="unit() * 13">
              {{ $index + 1 }}
            </text>
          </g>
        }

        @if (trees().length) {
          <g class="trees" [attr.stroke-width]="unit()">
            @for (t of trees(); track t.treeId) {
              <circle [attr.cx]="t.pixel[0]" [attr.cy]="t.pixel[1]" [attr.r]="unit() * 4" />
            }
          </g>
          @if (showLabels()) {
            <g class="labels" [attr.font-size]="unit() * 10">
              @for (t of trees(); track t.treeId) {
                <text [attr.x]="t.pixel[0] + unit() * 5" [attr.y]="t.pixel[1] + unit() * 3">{{ t.orderNum }}</text>
              }
            </g>
          }
          @if (selected(); as s) {
            <circle class="selected" [attr.cx]="s.pixel[0]" [attr.cy]="s.pixel[1]" [attr.r]="unit() * 8" [attr.stroke-width]="unit() * 2" />
          }
        }
      </svg>

      <div class="zoom">
        <ion-button size="small" fill="solid" color="light" (click)="zoomBy(1.4)" aria-label="ซูมเข้า"><ion-icon slot="icon-only" name="add-outline" /></ion-button>
        <ion-button size="small" fill="solid" color="light" (click)="zoomBy(1 / 1.4)" aria-label="ซูมออก"><ion-icon slot="icon-only" name="remove-outline" /></ion-button>
        <ion-button size="small" fill="solid" color="light" (click)="reset()" aria-label="พอดีภาพ"><ion-icon slot="icon-only" name="scan-outline" /></ion-button>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .wrap { position: relative; width: 100%; height: 100%; min-height: 320px; background: var(--st-viz-canvas-bg); border-radius: var(--st-radius); overflow: hidden; }
    svg { width: 100%; height: 100%; display: block; touch-action: none; cursor: grab; user-select: none; }
    svg.picking { cursor: crosshair; }
    .grid line { stroke: var(--st-viz-grid-col); opacity: 0.7; }
    .grid line.row { stroke: var(--st-viz-grid-row); }
    .boundary { fill: none; stroke: var(--st-viz-boundary); }
    .boundary.open { fill: none; }
    .vertex { fill: var(--st-viz-boundary); stroke: var(--st-viz-canvas-bg); }
    .cp rect { fill: var(--st-viz-control-point); stroke: var(--st-viz-tree-stroke); }
    .cp text { fill: var(--st-viz-control-point); font-weight: 700; paint-order: stroke; stroke: var(--st-viz-canvas-bg); stroke-width: 3px; }
    .trees circle { fill: var(--st-viz-tree); stroke: var(--st-viz-tree-stroke); }
    .labels text { fill: var(--st-viz-label); font-weight: 700; paint-order: stroke; stroke: var(--st-viz-label-bg); stroke-width: 3px; pointer-events: none; }
    .selected { fill: none; stroke: var(--st-viz-tree-selected); }
    .zoom { position: absolute; right: var(--st-space-2); top: var(--st-space-2); display: flex; flex-direction: column; }
  `,
})
export class SurveyCanvasComponent {
  readonly imageUrl = input<string | null>(null);
  readonly width = input.required<number>();
  readonly height = input.required<number>();
  readonly boundary = input<PixelPoint[]>([]);
  readonly controlPoints = input<ControlPointDto[] | { pixel: PixelPoint }[]>([]);
  readonly trees = input<SurveyedTreeDto[]>([]);
  readonly gridLines = input<GridLineDto[]>([]);
  readonly selectedTreeId = input<string | null>(null);
  readonly showGrid = input(true);
  readonly showLabels = input(true);
  /** true = คลิกแล้วส่ง imageClick (โหมดปักจุด) */
  readonly pickable = input(false);

  readonly imageClick = output<PixelPoint>();
  readonly treeClick = output<string>();

  private readonly svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');
  private readonly wrap = viewChild.required<ElementRef<HTMLDivElement>>('wrap');
  private readonly view = signal<ViewBox>({ x: 0, y: 0, w: 1, h: 1 });
  private readonly clientSize = signal({ w: 1, h: 1 });

  protected readonly viewBoxAttr = computed(() => {
    const v = this.view();
    return `${v.x} ${v.y} ${v.w} ${v.h}`;
  });
  /** พิกเซลภาพต่อ 1 พิกเซลจอ — ใช้ให้จุด/ตัวอักษรขนาดคงที่บนจอไม่ว่าซูมเท่าไร */
  protected readonly unit = computed(() => {
    const v = this.view();
    const c = this.clientSize();
    return Math.max(v.w / c.w, v.h / c.h);
  });
  protected readonly boundaryPoints = computed(() => this.boundary().map((p) => p.join(',')).join(' '));
  protected readonly selected = computed(() => {
    const id = this.selectedTreeId();
    return id ? (this.trees().find((t) => t.treeId === id) ?? null) : null;
  });

  protected drag: { x: number; y: number; view: ViewBox; moved: boolean } | null = null;

  constructor() {
    addIcons({ addOutline, removeOutline, scanOutline });
    // ภาพใหม่ → พอดีกรอบ
    effect(() => {
      this.width();
      this.height();
      this.imageUrl();
      this.reset();
    });
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.wrap().nativeElement;
      const ro = new ResizeObserver(([e]) => {
        if (e) this.clientSize.set({ w: Math.max(1, e.contentRect.width), h: Math.max(1, e.contentRect.height) });
      });
      ro.observe(el);
      destroyRef.onDestroy(() => ro.disconnect());
    });
  }

  reset(): void {
    this.view.set({ x: 0, y: 0, w: Math.max(1, this.width()), h: Math.max(1, this.height()) });
  }

  zoomBy(factor: number, center?: PixelPoint): void {
    const v = this.view();
    const cx = center?.[0] ?? v.x + v.w / 2;
    const cy = center?.[1] ?? v.y + v.h / 2;
    const minW = this.width() / 60;
    const maxW = this.width() * 2;
    const w = Math.min(maxW, Math.max(minW, v.w / factor));
    const f = v.w / w;
    const h = v.h / f;
    this.view.set({ x: cx - (cx - v.x) / f, y: cy - (cy - v.y) / f, w, h });
  }

  /** เลื่อนให้จุดนี้อยู่กลางจอ (ซูมเข้าถ้ายังมองภาพทั้งหมดอยู่) */
  focus(p: PixelPoint): void {
    const v = this.view();
    const w = v.w >= this.width() * 0.9 ? v.w / 4 : v.w;
    const h = (v.h / v.w) * w;
    this.view.set({ x: p[0] - w / 2, y: p[1] - h / 2, w, h });
  }

  protected onWheel(e: WheelEvent): void {
    e.preventDefault();
    this.zoomBy(e.deltaY < 0 ? 1.2 : 1 / 1.2, this.toImage(e));
  }

  protected onDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    this.svg().nativeElement.setPointerCapture(e.pointerId);
    this.drag = { x: e.clientX, y: e.clientY, view: this.view(), moved: false };
  }

  protected onMove(e: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < CLICK_TOLERANCE_PX) return;
    d.moved = true;
    const u = this.unit();
    this.view.set({ ...d.view, x: d.view.x - dx * u, y: d.view.y - dy * u });
  }

  protected onUp(e: PointerEvent): void {
    const d = this.drag;
    this.drag = null;
    if (!d || d.moved) return;
    const p = this.toImage(e);
    if (this.pickable()) {
      if (p[0] >= 0 && p[1] >= 0 && p[0] <= this.width() && p[1] <= this.height()) {
        this.imageClick.emit([Math.round(p[0]), Math.round(p[1])]);
      }
      return;
    }
    const hit = this.nearestTree(p, TREE_HIT_PX * this.unit());
    if (hit) this.treeClick.emit(hit.treeId);
  }

  private nearestTree(p: PixelPoint, maxDist: number): SurveyedTreeDto | null {
    let best: SurveyedTreeDto | null = null;
    let bestD = maxDist;
    for (const t of this.trees()) {
      const d = Math.hypot(t.pixel[0] - p[0], t.pixel[1] - p[1]);
      if (d <= bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  /** พิกัดจอ → พิกัดพิกเซลของภาพ */
  private toImage(e: MouseEvent): PixelPoint {
    const svg = this.svg().nativeElement;
    const ctm = svg.getScreenCTM();
    if (!ctm) return [0, 0];
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return [pt.x, pt.y];
  }
}
