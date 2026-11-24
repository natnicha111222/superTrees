// แผนที่ดาวเทียมสำหรับวางแผนปลูก: ปักมุมแปลง / เพิ่ม-ลบหมุด / แสดงตำแหน่งต้นไม้ + เส้นกริด
// - ขอบเขต/มุม/ต้นไม้/กริดเป็น GeoJSON layer (WebGL) — รองรับหลายพันจุด · สีจาก token --st-viz-*
// - pickPoints = true: คลิกที่ไหนก็ได้ → mapClick (ปักมุม/เพิ่มหมุด) · false: คลิกต้นไม้ → treeClick
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
import { locateOutline, scanOutline, searchOutline } from 'ionicons/icons';
import type { LngLat, PlannedTreeDto } from '@supertrees/contracts';
import { RuntimeConfigService } from '@supertrees/shared-ui';
import type { GeoJSONSource, Map as MlMap, Popup } from 'maplibre-gl';
import { currentPosition, loadMaplibre, parseLatLng, rasterStyle, themeColor, THAILAND_CENTER, type MapLibre } from '../services/maplibre';

/** จุดผลการเทียบแผน↔ผลนับ */
export interface CompareMark {
  id: string;
  lngLat: LngLat;
  kind: 'matched' | 'missing' | 'extra';
}

/** ระยะคลิกรอบจุดต้นไม้ (พิกเซลจอ) */
const TREE_HIT_PX = 8;

@Component({
  selector: 'st-planting-map',
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
      <ion-button size="small" fill="outline" (click)="goto()" [disabled]="!gotoText()" title="ไปที่พิกัด">
        <ion-icon slot="icon-only" name="search-outline" />
      </ion-button>
      <ion-button size="small" fill="outline" (click)="locate()" title="ไปตำแหน่งปัจจุบัน — ใช้ GPS ของอุปกรณ์ครั้งเดียว ไม่บันทึกตำแหน่ง">
        <ion-icon slot="icon-only" name="locate-outline" />
      </ion-button>
      <ion-button size="small" fill="outline" (click)="fit()" [disabled]="!boundary().length" title="ซูมให้เห็นทั้งแปลง">
        <ion-icon slot="icon-only" name="scan-outline" />
      </ion-button>
    </div>
    @if (note()) {
      <ion-note color="danger">{{ note() }}</ion-note>
    }
    <div class="map" #map [class.picking]="pickPoints()" [class.deleting]="deleting()"></div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--st-space-2); }
    .bar { display: flex; gap: var(--st-space-2); align-items: center; }
    .goto { flex: 1; --padding-start: var(--st-space-2); border: 1px solid var(--st-color-border); border-radius: var(--st-radius); }
    .map { flex: 1; min-height: 360px; border-radius: var(--st-radius); overflow: hidden; }
    .map.picking, .map.picking ::ng-deep canvas { cursor: crosshair; }
    .map.deleting ::ng-deep canvas { cursor: not-allowed; }
  `,
})
export class PlantingMapComponent {
  /** มุมแปลงตามลำดับที่ปัก */
  readonly boundary = input<LngLat[]>([]);
  readonly trees = input<PlannedTreeDto[]>([]);
  readonly gridLines = input<[LngLat, LngLat][]>([]);
  readonly showGrid = input(false);
  readonly selectedTreeId = input<string | null>(null);
  /** true = คลิกบนแผนที่ส่ง mapClick (ปักมุม/เพิ่มหมุด) */
  readonly pickPoints = input(false);
  /** แสดง popup พิกัดเมื่อคลิกต้นไม้ */
  readonly popups = input(true);
  /** โหมดลบ — เปลี่ยนเคอร์เซอร์ */
  readonly deleting = input(false);
  /** มุมมองเริ่มต้นเมื่อยังไม่มีแปลง */
  readonly initialCenter = input<LngLat | null>(null);
  /** ผลการเทียบแผน (หน้าเทียบแผน) — คลิกได้เหมือนต้นไม้ → treeClick(id) */
  readonly marks = input<CompareMark[]>([]);
  /** เส้นเชื่อมหลุม↔ต้นที่จับคู่ได้ */
  readonly links = input<[LngLat, LngLat][]>([]);

  readonly mapClick = output<LngLat>();
  readonly treeClick = output<string>();

  private readonly config = inject(RuntimeConfigService);
  private readonly mapEl = viewChild.required<ElementRef<HTMLDivElement>>('map');
  protected readonly gotoText = signal('');
  protected readonly note = signal<string | null>(null);

  private map: MlMap | null = null;
  private lib: MapLibre | null = null;
  private popup: Popup | null = null;
  private readonly ready = signal(false);
  private fitted = false;

  constructor() {
    addIcons({ locateOutline, scanOutline, searchOutline });
    // อัปเดตข้อมูลบนแผนที่เมื่อ input เปลี่ยน
    effect(() => {
      const b = this.boundary();
      const t = this.trees();
      const g = this.showGrid() ? this.gridLines() : [];
      const m = this.marks();
      const l = this.links();
      if (!this.ready()) return;
      this.setData(b, t, g);
      this.setMarks(m, l);
      // แผนที่ที่มีแปลงอยู่แล้ว: ซูมให้เห็นแปลงครั้งแรก
      if (!this.pickPoints() && !this.fitted && b.length) {
        this.fit(false);
        this.fitted = true;
      }
    });
    effect(() => {
      const id = this.selectedTreeId();
      if (!this.ready() || !this.map) return;
      for (const layer of ['tree-selected', 'mark-selected']) this.map.setFilter(layer, ['==', ['get', 'treeId'], id ?? '']);
    });

    const destroyRef = inject(DestroyRef);
    afterNextRender(async () => {
      const cfg = this.config.config()?.map;
      if (!cfg) {
        this.note.set('ยังไม่ได้ตั้งค่าแผนที่ (map ใน config.json)');
        return;
      }
      const lib = await loadMaplibre();
      this.lib = lib;
      const center = this.boundary()[0] ?? this.initialCenter() ?? cfg.initialCenter ?? THAILAND_CENTER;
      const zoom = this.boundary().length || this.initialCenter() ? 17 : (cfg.initialZoom ?? 5);
      const map = new lib.Map({ container: this.mapEl().nativeElement, style: rasterStyle(cfg), center, zoom, maxZoom: 21, attributionControl: { compact: true } });
      map.addControl(new lib.NavigationControl({ showCompass: true }), 'top-right');
      map.addControl(new lib.ScaleControl({ unit: 'metric' }), 'bottom-left');
      // ใช้ flyTo/fit ได้ทันที (ผู้ใช้อาจกรอกพิกัดก่อน tile โหลดเสร็จ) · ใส่ข้อมูลได้หลัง load
      this.map = map;
      map.on('load', () => {
        this.addLayers(map);
        this.ready.set(true);
      });
      map.on('click', (e) => {
        this.popup?.remove();
        if (this.pickPoints()) {
          this.mapClick.emit([e.lngLat.lng, e.lngLat.lat]);
          return;
        }
        const r = TREE_HIT_PX;
        const f = map.queryRenderedFeatures(
          [
            [e.point.x - r, e.point.y - r],
            [e.point.x + r, e.point.y + r],
          ],
          { layers: ['trees', 'marks'] },
        )[0];
        if (!f || f.geometry.type !== 'Point') return;
        const id = String(f.properties['treeId']);
        this.treeClick.emit(id);
        if (this.popups()) {
          const [lng, lat] = f.geometry.coordinates as [number, number];
          const el = document.createElement('div');
          el.textContent = `${id} · แถว ${String(f.properties['row'])} ต้นที่ ${String(f.properties['column'])} · ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          this.popup = new lib.Popup({ closeButton: false }).setLngLat([lng, lat]).setDOMContent(el).addTo(map);
        }
      });
      const ro = new ResizeObserver(() => map.resize());
      ro.observe(this.mapEl().nativeElement);
      destroyRef.onDestroy(() => {
        ro.disconnect();
        map.remove();
      });
    });
  }

  /** ซูมให้เห็นทั้งแปลง */
  fit(animate = true): void {
    const b = this.boundary();
    if (!this.map || !this.lib || !b.length) return;
    const bounds = b.reduce((acc, p) => acc.extend(p), new this.lib.LngLatBounds(b[0], b[0]));
    this.map.fitBounds(bounds, { padding: 48, maxZoom: 19, animate });
  }

  /** เลื่อนให้ต้นนี้อยู่กลางจอ (ซูมเข้าถ้ายังมองไกล) */
  focus(p: LngLat): void {
    this.map?.easeTo({ center: p, zoom: Math.max(this.map.getZoom(), 19) });
  }

  protected goto(): void {
    const p = parseLatLng(this.gotoText());
    if (!p) {
      this.note.set('พิกัดไม่ถูกรูปแบบ — ใช้ "ละติจูด, ลองจิจูด" เช่น 14.132309, 100.953235');
      return;
    }
    this.note.set(null);
    this.map?.flyTo({ center: p, zoom: Math.max(this.map.getZoom(), 18) });
  }

  protected locate(): void {
    currentPosition().then(
      (p) => this.map?.flyTo({ center: p, zoom: 18 }),
      (e: Error) => this.note.set(e.message),
    );
  }

  private addLayers(map: MlMap): void {
    const el = this.mapEl().nativeElement;
    const c = (t: string) => themeColor(el, t);
    const empty = { type: 'FeatureCollection' as const, features: [] };
    for (const id of ['boundary', 'vertices', 'trees', 'grid', 'marks', 'links']) map.addSource(id, { type: 'geojson', data: empty });
    map.addLayer({ id: 'grid', type: 'line', source: 'grid', paint: { 'line-color': c('--st-viz-grid-col'), 'line-width': 1, 'line-opacity': 0.7 } });
    map.addLayer({ id: 'boundary-fill', type: 'fill', source: 'boundary', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': c('--st-viz-boundary'), 'fill-opacity': 0.12 } });
    map.addLayer({ id: 'boundary-line', type: 'line', source: 'boundary', paint: { 'line-color': c('--st-viz-boundary'), 'line-width': 2.5 } });
    map.addLayer({
      id: 'trees',
      type: 'circle',
      source: 'trees',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 1.5, 18, 4, 21, 8],
        // หมุดที่เพิ่มเอง / ต้นแรก (จุดเริ่มนับ — เหมือน Colab) / ต้นอื่น
        'circle-color': [
          'case',
          ['==', ['get', 'manual'], true],
          c('--st-viz-control-point'),
          ['==', ['get', 'orderNum'], 1],
          c('--st-viz-tree-selected'),
          c('--st-viz-tree'),
        ],
        'circle-stroke-color': c('--st-viz-tree-stroke'),
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 16, 0, 18, 1],
      },
    });
    // ผลการเทียบแผน: หลุมมีต้น = เขียว · หลุมว่าง = วงแดง · ต้นนอกแผน = ส้ม
    map.addLayer({ id: 'links', type: 'line', source: 'links', paint: { 'line-color': c('--st-color-success'), 'line-width': 1.5 } });
    map.addLayer({
      id: 'marks',
      type: 'circle',
      source: 'marks',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 2, 18, 5, 21, 9],
        'circle-color': [
          'match',
          ['get', 'kind'],
          'matched',
          c('--st-color-success'),
          'extra',
          c('--st-color-warning'),
          'transparent',
        ],
        'circle-stroke-color': ['match', ['get', 'kind'], 'missing', c('--st-color-danger'), c('--st-viz-tree-stroke')],
        'circle-stroke-width': ['match', ['get', 'kind'], 'missing', 2.5, 1],
      },
    });
    map.addLayer({
      id: 'tree-selected',
      type: 'circle',
      source: 'trees',
      filter: ['==', ['get', 'treeId'], this.selectedTreeId() ?? ''],
      // ใช้ได้ทั้ง source ต้นไม้และผลการเทียบ (ดู effect ด้านบน)
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 5, 18, 9, 21, 14],
        'circle-color': 'transparent',
        'circle-stroke-color': c('--st-viz-tree-selected'),
        'circle-stroke-width': 3,
      },
    });
    map.addLayer({
      id: 'mark-selected',
      type: 'circle',
      source: 'marks',
      filter: ['==', ['get', 'treeId'], this.selectedTreeId() ?? ''],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 5, 18, 9, 21, 14],
        'circle-color': 'transparent',
        'circle-stroke-color': c('--st-viz-tree-selected'),
        'circle-stroke-width': 3,
      },
    });
    map.addLayer({
      id: 'vertices',
      type: 'circle',
      source: 'vertices',
      paint: {
        'circle-radius': 6,
        // มุมแรก (ขอบแรก 1→2 กำหนดแนวแถว) สีต่าง
        'circle-color': ['case', ['==', ['get', 'index'], 0], c('--st-viz-boundary'), c('--st-viz-control-point')],
        'circle-stroke-color': c('--st-viz-canvas-bg'),
        'circle-stroke-width': 1,
      },
    });
  }

  private setMarks(marks: CompareMark[], links: [LngLat, LngLat][]): void {
    const map = this.map;
    if (!map || !this.ready()) return;
    (map.getSource('marks') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: marks.map((m) => ({ type: 'Feature', properties: { treeId: m.id, kind: m.kind, row: '', column: '' }, geometry: { type: 'Point', coordinates: m.lngLat } })),
    });
    (map.getSource('links') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: links.map((l) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: l } })),
    });
  }

  private setData(boundary: LngLat[], trees: PlannedTreeDto[], grid: [LngLat, LngLat][]): void {
    const map = this.map;
    if (!map || !this.ready()) return;
    const ring = boundary.length >= 3 ? [[...boundary, boundary[0]!]] : null;
    (map.getSource('boundary') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: ring
        ? [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: ring } }]
        : boundary.length === 2
          ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: boundary } }]
          : [],
    });
    (map.getSource('vertices') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: boundary.map((p, index) => ({ type: 'Feature', properties: { index }, geometry: { type: 'Point', coordinates: p } })),
    });
    (map.getSource('trees') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: trees.map((t) => ({
        type: 'Feature',
        properties: { treeId: t.treeId, orderNum: t.orderNum, row: t.row, column: t.column, manual: t.manual },
        geometry: { type: 'Point', coordinates: t.lngLat },
      })),
    });
    (map.getSource('grid') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: grid.map((l) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: l } })),
    });
  }
}
