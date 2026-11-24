// เทียบแผนปลูกกับผลนับต้นไม้จากภาพ (ที่ผูกแผนที่แล้ว): หลุมไหนมีต้น / ว่าง · ต้นไหนนอกแผน · คลาดกี่เมตร
// คำนวณที่ garden-service (GET …/planting-plans/{id}/compare) — หน้านี้แค่เลือกและแสดงผล
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBadge,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonMenuButton,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { debounceTime, of } from 'rxjs';
import type { LngLat } from '@supertrees/contracts';
import { StDistancePipe, StThaiDatePipe, apiErrorMessage } from '@supertrees/shared-ui';
import { GardenTabsComponent } from '../components/garden-tabs.component';
import { PlantingMapComponent, type CompareMark } from '../components/planting-map.component';
import { PlantingPlanApi } from '../services/planting-plan-api.service';
import { TreeSurveyApi } from '../services/tree-survey-api.service';

type ListKind = 'missing' | 'extra' | 'matched';

@Component({
  selector: 'st-plan-compare-page',
  imports: [
    GardenTabsComponent,
    PlantingMapComponent,
    StDistancePipe,
    StThaiDatePipe,
    IonBadge,
    IonButtons,
    IonContent,
    IonHeader,
    IonInput,
    IonLabel,
    IonMenuButton,
    IonNote,
    IonSegment,
    IonSegmentButton,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start"><ion-menu-button /></ion-buttons>
        <ion-title>เทียบแผนปลูกกับผลนับต้นไม้</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <st-garden-tabs active="compare" />
      <div class="pickers">
        <ion-select label="แผนปลูก" labelPlacement="stacked" interface="popover" placeholder="เลือกแผนปลูก"
          [value]="planId()" (ionChange)="setParam('plan', $event.detail.value)">
          @for (p of plans.value()?.items ?? []; track p.id) {
            <ion-select-option [value]="p.id">{{ p.name }} · {{ p.treeCount }} หลุม · ระยะ {{ p.spacingM }} ม.</ion-select-option>
          }
        </ion-select>
        <ion-select label="ผลนับจากภาพ (ต้องผูกแผนที่)" labelPlacement="stacked" interface="popover" placeholder="เลือกผลนับ"
          [value]="surveyId()" (ionChange)="setParam('survey', $event.detail.value)">
          @for (s of surveys.value()?.items ?? []; track s.id) {
            <ion-select-option [value]="s.id" [disabled]="s.scaleSource !== 'georef'">
              {{ s.name ?? 'ไม่มีชื่อ' }} · {{ s.treeCount }} ต้น · {{ s.createdAt | stThaiDate: 'date' }}{{ s.scaleSource !== 'georef' ? ' (ไม่ได้ผูกแผนที่)' : '' }}
            </ion-select-option>
          }
        </ion-select>
        <ion-input type="number" label="ระยะจับคู่สูงสุด (ม.)" labelPlacement="stacked" [placeholder]="'ครึ่งระยะปลูก'"
          [value]="tolerance()" min="0.1" step="0.5" (ionInput)="tolerance.set(+($any($event.detail.value) || 0) || null)" />
      </div>
      @if (!hasGeorefSurvey() && surveys.value()) {
        <ion-note color="warning" class="meta">ยังไม่มีผลนับที่ผูกแผนที่ — ตอนนับจากภาพให้เลือกมาตราส่วนแบบ "จุดอ้างอิงแผนที่" จึงจะเทียบกับแผนได้</ion-note>
      }

      @if (!planId() || !surveyId()) {
        <ion-note class="meta">เลือกแผนปลูกและผลนับจากภาพของแปลงเดียวกันเพื่อดูว่าหลุมไหนมีต้น/ว่าง และต้นไหนอยู่นอกแผน</ion-note>
      } @else if (result.isLoading()) {
        <div class="center"><ion-spinner /></div>
      } @else if (result.error()) {
        <ion-note color="danger">{{ errorText() }}</ion-note>
      } @else if (result.value(); as r) {
        <div class="stats">
          <div class="stat"><span class="v">{{ r.stats.matched }}/{{ r.stats.planned }}</span><span class="k">หลุมที่มีต้น ({{ (r.stats.matchRate * 100).toFixed(1) }}%)</span></div>
          <div class="stat bad"><span class="v">{{ r.stats.missing }}</span><span class="k">หลุมว่าง</span></div>
          <div class="stat warn"><span class="v">{{ r.stats.extra }}</span><span class="k">ต้นนอกแผน</span></div>
          <div class="stat">
            <span class="v">{{ r.stats.meanOffsetM != null ? (r.stats.meanOffsetM | stDistance: 2) : '—' }}</span>
            <span class="k">คลาดจากหลุมเฉลี่ย · มากสุด {{ r.stats.maxOffsetM != null ? (r.stats.maxOffsetM | stDistance: 2) : '—' }}</span>
          </div>
        </div>
        <ion-note class="meta">ต้นที่ห่างจากหลุมไม่เกิน {{ r.toleranceM | stDistance: 2 }} ถือว่าอยู่หลุมนั้น (จับคู่หนึ่งต่อหนึ่ง ใกล้สุดก่อน) · ตรวจพบ {{ r.stats.detected }} ต้น</ion-note>
        <div class="layout">
          <section>
            <div class="legend">
              <span><i class="dot matched"></i> หลุมมีต้น</span>
              <span><i class="dot missing"></i> หลุมว่าง</span>
              <span><i class="dot extra"></i> ต้นนอกแผน</span>
            </div>
            <st-planting-map #map class="map" [boundary]="plan.value()?.boundary ?? []" [marks]="marks()" [links]="links()"
              [selectedTreeId]="selectedId()" [popups]="false" (treeClick)="select($event, false)" />
          </section>
          <section class="side">
            <ion-segment [value]="listKind()" (ionChange)="listKind.set($any($event.detail.value))">
              <ion-segment-button value="missing"><ion-label>หลุมว่าง <ion-badge color="danger">{{ r.missing.length }}</ion-badge></ion-label></ion-segment-button>
              <ion-segment-button value="extra"><ion-label>นอกแผน <ion-badge color="warning">{{ r.extra.length }}</ion-badge></ion-label></ion-segment-button>
              <ion-segment-button value="matched"><ion-label>มีต้น <ion-badge color="success">{{ r.matched.length }}</ion-badge></ion-label></ion-segment-button>
            </ion-segment>
            <div class="table-wrap" #tableWrap>
              <table>
                @switch (listKind()) {
                  @case ('missing') {
                    <thead><tr><th>หลุม</th><th>แถว</th><th>ต้นที่</th><th>ละติจูด, ลองจิจูด</th></tr></thead>
                    <tbody>
                      @for (m of r.missing; track m.planTreeId) {
                        <tr [id]="'row-' + m.planTreeId" [class.active]="m.planTreeId === selectedId()" (click)="select(m.planTreeId, true)">
                          <td><b>{{ m.planTreeId }}</b></td><td>{{ m.row }}</td><td>{{ m.column }}</td>
                          <td class="mono">{{ m.lngLat[1].toFixed(6) }}, {{ m.lngLat[0].toFixed(6) }}</td>
                        </tr>
                      }
                    </tbody>
                  }
                  @case ('extra') {
                    <thead><tr><th>ต้น</th><th>ตำแหน่ง</th><th>ละติจูด, ลองจิจูด</th></tr></thead>
                    <tbody>
                      @for (e of r.extra; track e.surveyTreeId) {
                        <tr [id]="'row-' + e.surveyTreeId" [class.active]="e.surveyTreeId === selectedId()" (click)="select(e.surveyTreeId, true)">
                          <td><b>{{ e.surveyTreeId }}</b></td><td>{{ e.insidePlan ? 'ในแปลง' : 'นอกแปลง' }}</td>
                          <td class="mono">{{ e.lngLat[1].toFixed(6) }}, {{ e.lngLat[0].toFixed(6) }}</td>
                        </tr>
                      }
                    </tbody>
                  }
                  @case ('matched') {
                    <thead><tr><th>หลุม</th><th>ต้น</th><th>คลาด</th></tr></thead>
                    <tbody>
                      @for (m of r.matched; track m.planTreeId) {
                        <tr [id]="'row-' + m.planTreeId" [class.active]="m.planTreeId === selectedId()" (click)="select(m.planTreeId, true)">
                          <td><b>{{ m.planTreeId }}</b></td><td>{{ m.surveyTreeId }}</td><td>{{ m.offsetM | stDistance: 2 }}</td>
                        </tr>
                      }
                    </tbody>
                  }
                }
              </table>
            </div>
          </section>
        </div>
      }
    </ion-content>
  `,
  styles: `
    .pickers { display: grid; grid-template-columns: 1fr 1fr minmax(160px, 220px); gap: var(--st-space-3); margin-bottom: var(--st-space-2); }
    @media (max-width: 900px) { .pickers { grid-template-columns: 1fr; } }
    .center { display: flex; justify-content: center; padding: var(--st-space-6); }
    .meta { display: block; font-size: 0.85em; margin-bottom: var(--st-space-2); }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--st-space-3); margin-bottom: var(--st-space-2); }
    .stat { background: var(--st-color-surface-alt); border-radius: var(--st-radius); padding: var(--st-space-3); display: flex; flex-direction: column; }
    .stat .v { font-size: 1.4em; font-weight: 700; color: var(--st-color-success); }
    .stat.bad .v { color: var(--st-color-danger); }
    .stat.warn .v { color: var(--st-color-warning); }
    .stat .k { color: var(--st-color-text-muted); font-size: 0.9em; }
    .layout { display: grid; grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr); gap: var(--st-space-4); }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
    .legend { display: flex; gap: var(--st-space-4); margin-bottom: var(--st-space-2); font-size: 0.9em; }
    .dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; vertical-align: middle; }
    .dot.matched { background: var(--st-color-success); }
    .dot.missing { border: 2.5px solid var(--st-color-danger); }
    .dot.extra { background: var(--st-color-warning); }
    .map { height: min(68vh, 700px); }
    .side { display: flex; flex-direction: column; gap: var(--st-space-2); max-height: min(74vh, 760px); }
    .table-wrap { flex: 1; overflow: auto; border: 1px solid var(--st-color-border); border-radius: var(--st-radius); }
    table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
    thead th { position: sticky; top: 0; background: var(--st-color-surface-alt); text-align: left; padding: var(--st-space-2); white-space: nowrap; z-index: 1; }
    td { padding: var(--st-space-1) var(--st-space-2); border-top: 1px solid var(--st-color-border); white-space: nowrap; }
    tbody tr { cursor: pointer; }
    tbody tr.active { background: color-mix(in srgb, var(--st-color-primary) 15%, transparent); }
    .mono { font-family: ui-monospace, monospace; font-size: 0.85em; }
  `,
})
export class PlanComparePage {
  private readonly plansApi = inject(PlantingPlanApi);
  private readonly surveysApi = inject(TreeSurveyApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly mapCmp = viewChild<PlantingMapComponent>('map');
  private readonly tableWrap = viewChild<ElementRef<HTMLElement>>('tableWrap');

  private readonly parcelId = this.route.snapshot.paramMap.get('parcelId') ?? '';
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly planId = computed(() => this.query().get('plan'));
  protected readonly surveyId = computed(() => this.query().get('survey'));
  /** null = ค่าเริ่มต้น (ครึ่งระยะปลูก) */
  protected readonly tolerance = signal<number | null>(null);
  private readonly toleranceDebounced = toSignal(toObservable(this.tolerance).pipe(debounceTime(400)), { initialValue: null });
  protected readonly listKind = signal<ListKind>('missing');
  protected readonly selectedId = signal<string | null>(null);

  protected readonly plans = rxResource({ params: () => this.parcelId, stream: ({ params }) => this.plansApi.list(params, 1, 100) });
  protected readonly surveys = rxResource({ params: () => this.parcelId, stream: ({ params }) => this.surveysApi.list(params, 1, 100) });
  protected readonly hasGeorefSurvey = computed(() => !!this.surveys.value()?.items.some((s) => s.scaleSource === 'georef'));
  /** ขอบเขตแปลงของแผน (แสดงบนแผนที่) */
  protected readonly plan = rxResource({
    params: () => this.planId(),
    stream: ({ params }) => (params ? this.plansApi.get(this.parcelId, params) : of(null)),
  });
  // เปลี่ยนแผน/ผลนับ/ระยะ → ยกเลิกคำขอเดิมแล้วขอใหม่ (rxResource — CLAUDE.md)
  protected readonly result = rxResource({
    params: () => ({ plan: this.planId(), survey: this.surveyId(), tol: this.toleranceDebounced() }),
    stream: ({ params }) =>
      params.plan && params.survey
        ? this.plansApi.compare(this.parcelId, params.plan, params.survey, params.tol ?? undefined)
        : of(null),
  });
  protected readonly errorText = computed(() => apiErrorMessage(this.result.error()));

  protected readonly marks = computed<CompareMark[]>(() => {
    const r = this.result.value();
    if (!r) return [];
    return [
      ...r.matched.map((m) => ({ id: m.planTreeId, lngLat: m.planLngLat, kind: 'matched' as const })),
      ...r.missing.map((m) => ({ id: m.planTreeId, lngLat: m.lngLat, kind: 'missing' as const })),
      ...r.extra.map((e) => ({ id: e.surveyTreeId, lngLat: e.lngLat, kind: 'extra' as const })),
    ];
  });
  protected readonly links = computed<[LngLat, LngLat][]>(() => this.result.value()?.matched.map((m) => [m.planLngLat, m.surveyLngLat]) ?? []);

  protected setParam(key: 'plan' | 'survey', value: string): void {
    this.selectedId.set(null);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { [key]: value }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /** fromList = คลิกในรายการ → แผนที่บินไป · คลิกบนแผนที่ → สลับรายการ + เลื่อนไปที่แถว */
  protected select(id: string, fromList: boolean): void {
    this.selectedId.set(id);
    const mark = this.marks().find((m) => m.id === id);
    if (!mark) return;
    if (fromList) {
      this.mapCmp()?.focus(mark.lngLat);
      return;
    }
    this.listKind.set(mark.kind);
    setTimeout(() => this.tableWrap()?.nativeElement.querySelector(`#row-${CSS.escape(id)}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  }
}

