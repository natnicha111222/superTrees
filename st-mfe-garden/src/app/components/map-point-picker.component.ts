// เลือกพิกัดจุดอ้างอิงบนแผนที่ภาพดาวเทียม (CONF-006: MapLibre GL + แหล่ง tile จาก runtime config)
// - คลิกบนแผนที่ = วางหมุดของจุดที่กำลังเลือก · จุดอื่นที่เลือกไว้แล้วแสดงเป็นหมุดเลขจาง ๆ
// - พิกัดเข้า/ออกเป็น [lng, lat] เสมอ (CLAUDE.md)
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { IonButton, IonIcon, IonInput, IonNote } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { locateOutline, searchOutline } from 'ionicons/icons';
import type { LngLat } from '@supertrees/contracts';
import { RuntimeConfigService, type StMapConfig } from '@supertrees/shared-ui';
import type { Map as MlMap, Marker } from 'maplibre-gl';
import { currentPosition, loadMaplibre, parseLatLng, rasterStyle, THAILAND_CENTER } from '../services/maplibre';

@Component({
  selector: 'st-map-point-picker',
  imports: [IonButton, IonIcon, IonInput, IonNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bar">
      <ion-input
        class="goto"
        placeholder="ไปที่พิกัด: ละติจูด, ลองจิจูด"
        [value]="gotoText()"
        (ionInput)="gotoText.set($any($event.detail.value) ?? '')"
        (keyup.enter)="goto()"
        aria-label="ไปที่พิกัด"
      />
      <ion-button size="small" fill="outline" (click)="goto()" [disabled]="!gotoText()">
        <ion-icon slot="icon-only" name="search-outline" />
      </ion-button>
      <ion-button size="small" fill="outline" (click)="locate()" title="เลื่อนแผนที่ไปตำแหน่งปัจจุบัน — ใช้ GPS ของอุปกรณ์ครั้งเดียว ไม่บันทึกตำแหน่ง">
        <ion-icon slot="icon-only" name="locate-outline" />
      </ion-button>
    </div>
    @if (configError()) {
      <ion-note color="danger">{{ configError() }}</ion-note>
    }
    <div class="map" #map></div>
    <ion-note class="hint">
      ซูมไปหาจุดเดียวกับที่ปักไว้บนภาพ (เช่น มุมรั้ว เสา ทางแยก) แล้วคลิกบนแผนที่ · ลากเพื่อเลื่อน · ล้อเมาส์/สองนิ้วเพื่อซูม
    </ion-note>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--st-space-2); height: 100%; }
    .bar { display: flex; gap: var(--st-space-2); align-items: center; }
    .goto { flex: 1; --padding-start: var(--st-space-2); border: 1px solid var(--st-color-border); border-radius: var(--st-radius); }
    .map { flex: 1; min-height: 320px; border-radius: var(--st-radius); overflow: hidden; cursor: crosshair; }
    .hint { font-size: 0.85em; }
    /* หมุดสร้างด้วย DOM ของ MapLibre (นอก template) จึงต้อง ::ng-deep — จำกัดอยู่ใต้ :host */
    :host ::ng-deep .st-cp-marker {
      width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      background: var(--st-viz-control-point); color: var(--st-viz-tree-stroke); font-weight: 700; font-size: 13px;
      border: 2px solid var(--st-viz-tree-stroke); opacity: 0.6; pointer-events: none;
    }
    :host ::ng-deep .st-cp-marker.active { opacity: 1; width: 32px; height: 32px; }
  `,
})
export class MapPointPickerComponent {
  /** จุดอ้างอิงทั้งหมด (index ตรงกับเลขบนภาพ) · null = ยังไม่มีพิกัด */
  readonly points = input<(LngLat | null)[]>([]);
  /** index ของจุดที่กำลังเลือก */
  readonly activeIndex = input.required<number>();
  /** มุมมองเริ่มต้น (เช่น มุมมองล่าสุดที่ผู้ใช้เลื่อนไว้) */
  readonly initialView = input<{ center: LngLat; zoom: number } | null>(null);

  readonly picked = output<LngLat>();
  readonly viewChange = output<{ center: LngLat; zoom: number }>();

  private readonly config = inject(RuntimeConfigService);
  private readonly mapEl = viewChild.required<ElementRef<HTMLDivElement>>('map');
  protected readonly gotoText = signal('');
  protected readonly configError = signal<string | null>(null);

  private map: MlMap | null = null;
  private markerCtor: typeof Marker | null = null;
  private markers: Marker[] = [];

  constructor() {
    addIcons({ locateOutline, searchOutline });
    // หมุดตามจุดที่เลือก — วาดใหม่เมื่อ points/activeIndex เปลี่ยน
    effect(() => {
      this.points();
      this.activeIndex();
      this.renderMarkers();
    });
    const destroyRef = inject(DestroyRef);
    afterNextRender(async () => {
      const cfg = this.config.config()?.map;
      if (!cfg) {
        this.configError.set('ยังไม่ได้ตั้งค่าแผนที่ (map ใน config.json)');
        return;
      }
      // โหลดไลบรารีเมื่อเปิดใช้เท่านั้น (ไม่อยู่ใน bundle แรกของหน้า)
      const { Map, Marker, NavigationControl, ScaleControl } = await loadMaplibre();
      const view = this.initialView() ?? this.startView(cfg);
      const map = new Map({
        container: this.mapEl().nativeElement,
        style: rasterStyle(cfg),
        center: view.center,
        zoom: view.zoom,
        maxZoom: 21,
        attributionControl: { compact: true },
      });
      map.addControl(new NavigationControl({ showCompass: true }), 'top-right');
      map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');
      map.on('click', (e) => this.picked.emit([e.lngLat.lng, e.lngLat.lat]));
      map.on('moveend', () => {
        const c = map.getCenter();
        this.viewChange.emit({ center: [c.lng, c.lat], zoom: map.getZoom() });
      });
      this.map = map;
      this.markerCtor = Marker;
      this.renderMarkers();

      // อยู่ใน modal → ขนาดกล่องเปลี่ยนตอนเปิด ต้องบอกแผนที่
      const ro = new ResizeObserver(() => map.resize());
      ro.observe(this.mapEl().nativeElement);
      destroyRef.onDestroy(() => {
        ro.disconnect();
        map.remove();
      });
    });
  }

  protected goto(): void {
    const p = parseLatLng(this.gotoText());
    if (!p) {
      this.configError.set('พิกัดไม่ถูกรูปแบบ — ใช้ "ละติจูด, ลองจิจูด" เช่น 13.7563, 100.5018');
      return;
    }
    this.configError.set(null);
    this.map?.flyTo({ center: p, zoom: Math.max(this.map.getZoom(), 17) });
  }

  protected locate(): void {
    currentPosition().then(
      (p) => this.map?.flyTo({ center: p, zoom: 17 }),
      (e: Error) => this.configError.set(e.message),
    );
  }

  private startView(cfg: StMapConfig): { center: LngLat; zoom: number } {
    const known = this.points().filter((p): p is LngLat => !!p);
    if (known.length) {
      const lng = known.reduce((s, p) => s + p[0], 0) / known.length;
      const lat = known.reduce((s, p) => s + p[1], 0) / known.length;
      return { center: [lng, lat], zoom: 18 };
    }
    return { center: cfg.initialCenter ?? THAILAND_CENTER, zoom: cfg.initialZoom ?? 5 };
  }

  private renderMarkers(): void {
    const map = this.map;
    const MarkerCtor = this.markerCtor;
    if (!map || !MarkerCtor) return;
    for (const m of this.markers) m.remove();
    this.markers = [];
    this.points().forEach((p, i) => {
      if (!p) return;
      const el = document.createElement('div');
      el.className = 'st-cp-marker' + (i === this.activeIndex() ? ' active' : '');
      el.textContent = String(i + 1);
      this.markers.push(new MarkerCtor({ element: el }).setLngLat(p).addTo(map));
    });
  }
}
