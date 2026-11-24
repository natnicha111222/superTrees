// แผนปลูก: แผนที่ (ขอบเขต + หมุดต้นไม้ + กริด) + สรุป + ตารางพิกัด (ซิงก์กับแผนที่) + CSV
// + โหมดแก้ไข: เพิ่ม/ลบหมุด, เลื่อน/หมุนกริด, ระยะปลูก, เติมจุดตามตาราง, ลบทั้งหมด → พรีวิว/บันทึกที่หลังบ้าน
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonLabel,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  addCircleOutline,
  appsOutline,
  arrowBackOutline,
  arrowDownOutline,
  arrowForwardOutline,
  arrowRedoOutline,
  arrowUndoOutline,
  arrowUpOutline,
  createOutline,
  downloadOutline,
  eyeOutline,
  gitCompareOutline,
  refreshOutline,
  removeCircleOutline,
  saveOutline,
  trashOutline,
} from 'ionicons/icons';
import type { PlannedTreeDto, PlantingPlanLayoutDto } from '@supertrees/contracts';
import { StDistancePipe, StRaiNganWaPipe, StThaiDatePipe, apiErrorMessage } from '@supertrees/shared-ui';
import { PlantingMapComponent } from '../components/planting-map.component';
import { PlantingPlanApi, downloadText, plantingCsv } from '../services/planting-plan-api.service';
import { PLAN_ROTATE_STEP_DEG, PLAN_SHIFT_STEP_M, PlantingPlanEditor, type PlanEditMode } from '../services/planting-plan-editor';

@Component({
  selector: 'st-planting-plan-view-page',
  imports: [
    RouterLink,
    PlantingMapComponent,
    StDistancePipe,
    StRaiNganWaPipe,
    StThaiDatePipe,
    IonBackButton,
    IonBadge,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonLabel,
    IonNote,
    IonSegment,
    IonSegmentButton,
    IonSpinner,
    IonTitle,
    IonToggle,
    IonToolbar,
  ],
  providers: [PlantingPlanEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start"><ion-back-button defaultHref="../" text="กลับ" /></ion-buttons>
        <ion-title>{{ editor.active() ? 'แก้ไขแผน: ' : '' }}{{ plan.value()?.name ?? 'แผนปลูก' }}</ion-title>
        @if (plan.value(); as p) {
          @if (!editor.active()) {
            <ion-buttons slot="end">
              <ion-button [routerLink]="['../../compare']" [queryParams]="{ plan: p.id }"><ion-icon slot="start" name="git-compare-outline" />เทียบกับผลนับ</ion-button>
              <ion-button (click)="startEdit()"><ion-icon slot="start" name="create-outline" />แก้ไข</ion-button>
              <ion-button (click)="downloadCsv()"><ion-icon slot="start" name="download-outline" />CSV</ion-button>
            </ion-buttons>
          }
        }
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      @if (plan.isLoading()) {
        <div class="center"><ion-spinner /></div>
      } @else if (plan.error()) {
        <ion-note color="danger">{{ errorText() }}</ion-note>
      } @else if (plan.value(); as p) {
        @let l = layout();
        <div class="stats">
          <div class="stat"><span class="v">{{ (l?.treeCount ?? 0).toLocaleString('th-TH') }}</span><span class="k">ต้น</span></div>
          <div class="stat"><span class="v">{{ l?.rowCount ?? '—' }}</span><span class="k">แถว</span></div>
          <div class="stat"><span class="v">{{ p.areaSqm | stRaiNganWa }}</span><span class="k">พื้นที่ ({{ p.areaSqm.toLocaleString('th-TH') }} ตร.ม.)</span></div>
          <div class="stat">
            <span class="v">{{ (l?.spacingM ?? p.spacingM) | stDistance }} × {{ (l?.spacingM ?? p.spacingM) | stDistance }}</span>
            <span class="k">ระยะปลูก · แนวแถว {{ (l?.angleDeg ?? p.angleDeg).toFixed(1) }}°</span>
          </div>
        </div>
        <ion-note class="meta">
          {{ p.createdAt | stThaiDate: 'long' }}
          @if (p.updatedAt) { · แก้ไขล่าสุด {{ p.updatedAt | stThaiDate }} }
          · คำนวณบน EPSG:{{ p.utmEpsg }} · คลิกจุดต้นไม้บนแผนที่หรือแถวในตารางเพื่อเลือก
        </ion-note>

        <div class="layout">
          <section>
            <div class="toolbar">
              <ion-toggle [checked]="showGrid()" (ionChange)="showGrid.set($event.detail.checked)">กริด</ion-toggle>
              @if (selected(); as t) {
                <span class="sel">เลือก <b>{{ t.treeId }}</b> · แถว {{ t.row }} ต้นที่ {{ t.column }} · {{ t.lngLat[1].toFixed(6) }}, {{ t.lngLat[0].toFixed(6) }}</span>
              }
            </div>
            <st-planting-map
              #map
              class="map"
              [boundary]="p.boundary"
              [trees]="trees()"
              [gridLines]="l?.gridLines ?? []"
              [showGrid]="showGrid()"
              [selectedTreeId]="selectedId()"
              [pickPoints]="editor.active() && editor.mode() === 'add'"
              [deleting]="editor.active() && editor.mode() === 'delete'"
              [popups]="!editor.active()"
              (mapClick)="editor.addPoint($event)"
              (treeClick)="onTreeClick($event)"
            />
          </section>

          <section class="side">
            @if (editor.active()) {
              @let st = editor.state();
              <div class="editor">
                <ion-input class="name" label="ชื่อแผน" labelPlacement="stacked" [value]="st?.name" [maxlength]="100" (ionInput)="editor.setName($any($event.detail.value) ?? '')" />
                <span class="lbl">โหมดคลิกบนแผนที่</span>
                <ion-segment [value]="editor.mode()" (ionChange)="setMode($any($event.detail.value))">
                  <ion-segment-button value="inspect"><ion-icon name="eye-outline" /><ion-label>ตรวจสอบ</ion-label></ion-segment-button>
                  <ion-segment-button value="add"><ion-icon name="add-circle-outline" /><ion-label>เพิ่มหมุด</ion-label></ion-segment-button>
                  <ion-segment-button value="delete"><ion-icon name="remove-circle-outline" /><ion-label>ลบหมุด</ion-label></ion-segment-button>
                </ion-segment>

                <span class="lbl">เลื่อนกริด (ทีละ {{ shiftStep }} ม.)</span>
                <div class="erow">
                  <ion-button size="small" fill="outline" (click)="editor.shift(-shiftStep, 0)" title="เลื่อนกริดซ้าย (ตามแนวแถว)"><ion-icon slot="icon-only" name="arrow-back-outline" /></ion-button>
                  <ion-button size="small" fill="outline" (click)="editor.shift(shiftStep, 0)" title="เลื่อนกริดขวา (ตามแนวแถว)"><ion-icon slot="icon-only" name="arrow-forward-outline" /></ion-button>
                  <ion-button size="small" fill="outline" (click)="editor.shift(0, shiftStep)" title="เลื่อนกริดขึ้น"><ion-icon slot="icon-only" name="arrow-up-outline" /></ion-button>
                  <ion-button size="small" fill="outline" (click)="editor.shift(0, -shiftStep)" title="เลื่อนกริดลง"><ion-icon slot="icon-only" name="arrow-down-outline" /></ion-button>
                  <span class="grid-info">{{ st?.offsetM?.[0] ?? 0 }}, {{ st?.offsetM?.[1] ?? 0 }} ม.</span>
                </div>
                <span class="lbl">หมุนกริด</span>
                <div class="erow">
                  <ion-button size="small" fill="outline" (click)="editor.rotate(rotateStep)" title="หมุนทวนเข็ม"><ion-icon slot="start" name="arrow-undo-outline" />ทวนเข็ม {{ rotateStep }}°</ion-button>
                  <ion-button size="small" fill="outline" (click)="editor.rotate(-rotateStep)" title="หมุนตามเข็ม"><ion-icon slot="start" name="arrow-redo-outline" />ตามเข็ม {{ rotateStep }}°</ion-button>
                  <span class="grid-info">{{ (st?.angleDeg ?? l?.angleDeg ?? 0).toFixed(1) }}°</span>
                </div>
                <ion-input type="number" label="ระยะปลูก (เมตร)" labelPlacement="stacked" [value]="st?.spacingM" min="0.5" max="100" step="0.5"
                  (ionInput)="editor.setSpacing(+($any($event.detail.value) ?? 0))" />
                <div class="erow">
                  <ion-button size="small" color="secondary" (click)="editor.fillGaps()"><ion-icon slot="start" name="apps-outline" />เติมจุดตามตาราง</ion-button>
                  <ion-button size="small" color="secondary" fill="outline" (click)="editor.resetGrid()"><ion-icon slot="start" name="refresh-outline" />รีเซ็ตตาราง</ion-button>
                  <ion-button size="small" color="danger" fill="outline" (click)="confirmClearAll()" [disabled]="!editor.trees().length"><ion-icon slot="start" name="trash-outline" />ลบทั้งหมด</ion-button>
                </div>
                <div class="erow status">
                  @if (editor.previewing()) { <ion-spinner name="dots" /> }
                  @if (st?.removed?.length) { <ion-badge color="medium">ลบ {{ st!.removed.length }}</ion-badge> }
                  @if (st?.extras?.length) { <ion-badge color="tertiary">เพิ่มเอง {{ st!.extras.length }}</ion-badge> }
                  @if (editor.error()) {
                    <ion-note color="danger">{{ editor.error() }}</ion-note>
                  } @else if (editor.message()) {
                    <ion-note>{{ editor.message() }}</ion-note>
                  }
                </div>
                <div class="erow end">
                  <ion-button fill="clear" color="medium" (click)="cancelEdit()" [disabled]="editor.saving()">ยกเลิก</ion-button>
                  <ion-button (click)="saveEdit()" [disabled]="!editor.dirty() || editor.saving() || editor.previewing() || !!editor.error() || !st?.name?.trim()">
                    @if (editor.saving()) { <ion-spinner slot="start" name="crescent" /> } @else { <ion-icon slot="start" name="save-outline" /> }
                    บันทึก
                  </ion-button>
                </div>
              </div>
            }

            <div class="table-wrap" #tableWrap>
              <table>
                <thead><tr><th>รหัส</th><th>แถว</th><th>ต้นที่</th><th>ละติจูด, ลองจิจูด</th></tr></thead>
                <tbody>
                  @for (t of trees(); track t.treeId) {
                    <tr [id]="'tree-' + t.treeId" [class.active]="t.treeId === selectedId()" (click)="select(t.treeId, true)">
                      <td><b>{{ t.treeId }}</b> @if (t.manual) { <ion-badge color="tertiary">เพิ่มเอง</ion-badge> }</td>
                      <td>{{ t.row }}</td>
                      <td>{{ t.column }}</td>
                      <td class="mono">{{ t.lngLat[1].toFixed(6) }}, {{ t.lngLat[0].toFixed(6) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        </div>
      }
    </ion-content>
  `,
  styles: `
    .center { display: flex; justify-content: center; padding: var(--st-space-6); }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--st-space-3); margin-bottom: var(--st-space-2); }
    .stat { background: var(--st-color-surface-alt); border-radius: var(--st-radius); padding: var(--st-space-3); display: flex; flex-direction: column; }
    .stat .v { font-size: 1.4em; font-weight: 700; color: var(--st-color-primary); }
    .stat .k { color: var(--st-color-text-muted); font-size: 0.9em; }
    .meta { display: block; font-size: 0.85em; margin-bottom: var(--st-space-2); }
    .layout { display: grid; grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr); gap: var(--st-space-4); }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
    .toolbar { display: flex; align-items: center; gap: var(--st-space-4); flex-wrap: wrap; margin-bottom: var(--st-space-2); }
    .sel { color: var(--st-color-text-muted); }
    .map { height: min(70vh, 720px); }
    .side { display: flex; flex-direction: column; gap: var(--st-space-3); min-height: 0; max-height: min(78vh, 780px); }
    @media (max-width: 900px) { .side { max-height: none; } }
    .editor { flex: none; border: 1px solid var(--st-color-border); border-radius: var(--st-radius); background: var(--st-color-surface-alt);
      padding: var(--st-space-2) var(--st-space-3); display: flex; flex-direction: column; gap: var(--st-space-1); }
    .erow { display: flex; align-items: center; gap: var(--st-space-1); flex-wrap: wrap; }
    .erow.end { justify-content: flex-end; }
    .erow.status { min-height: 28px; gap: var(--st-space-2); }
    .lbl { font-weight: 700; font-size: 0.9em; margin-top: var(--st-space-1); }
    .grid-info { font-family: ui-monospace, monospace; font-size: 0.85em; color: var(--st-color-text-muted); margin-left: var(--st-space-2); }
    .table-wrap { flex: 1; min-height: 160px; overflow: auto; border: 1px solid var(--st-color-border); border-radius: var(--st-radius); }
    @media (max-width: 900px) { .table-wrap { max-height: 60vh; } }
    table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
    thead th { position: sticky; top: 0; background: var(--st-color-surface-alt); text-align: left; padding: var(--st-space-2); white-space: nowrap; z-index: 1; }
    td { padding: var(--st-space-1) var(--st-space-2); border-top: 1px solid var(--st-color-border); white-space: nowrap; }
    tbody tr { cursor: pointer; }
    tbody tr.active { background: color-mix(in srgb, var(--st-color-primary) 15%, transparent); }
    .mono { font-family: ui-monospace, monospace; font-size: 0.85em; }
  `,
})
export class PlantingPlanViewPage {
  private readonly api = inject(PlantingPlanApi);
  private readonly alerts = inject(AlertController);
  private readonly params = inject(ActivatedRoute).snapshot.paramMap;
  private readonly mapCmp = viewChild<PlantingMapComponent>('map');
  private readonly tableWrap = viewChild<ElementRef<HTMLElement>>('tableWrap');
  protected readonly editor = inject(PlantingPlanEditor);
  protected readonly shiftStep = PLAN_SHIFT_STEP_M;
  protected readonly rotateStep = PLAN_ROTATE_STEP_DEG;

  protected readonly plan = rxResource({
    params: () => ({ parcelId: this.params.get('parcelId') ?? '', planId: this.params.get('planId') ?? '' }),
    stream: ({ params }) => this.api.get(params.parcelId, params.planId),
  });
  protected readonly errorText = computed(() => apiErrorMessage(this.plan.error()));
  protected readonly selectedId = signal<string | null>(null);
  protected readonly showGrid = signal(false);

  /** สิ่งที่แสดง: ระหว่างแก้ = ผลพรีวิว · ปกติ = แผนที่บันทึกไว้ */
  protected readonly layout = computed<PlantingPlanLayoutDto | null>(() =>
    this.editor.active() ? this.editor.preview() : (this.plan.value() ?? null),
  );
  protected readonly trees = computed<PlannedTreeDto[]>(() => this.layout()?.trees ?? []);
  protected readonly selected = computed<PlannedTreeDto | null>(() => {
    const id = this.selectedId();
    return id ? (this.trees().find((t) => t.treeId === id) ?? null) : null;
  });

  constructor() {
    addIcons({
      addCircleOutline,
      appsOutline,
      arrowBackOutline,
      arrowDownOutline,
      arrowForwardOutline,
      arrowRedoOutline,
      arrowUndoOutline,
      arrowUpOutline,
      createOutline,
      downloadOutline,
      eyeOutline,
      gitCompareOutline,
      refreshOutline,
      removeCircleOutline,
      saveOutline,
      trashOutline,
    });
  }

  /** fromTable = คลิกที่ตาราง → เลื่อนแผนที่ไปหา · คลิกที่แผนที่ → เลื่อนตารางไปหา */
  protected select(treeId: string, fromTable: boolean): void {
    this.selectedId.set(treeId);
    const t = this.selected();
    if (!t) return;
    if (fromTable) this.mapCmp()?.focus(t.lngLat);
    else this.tableWrap()?.nativeElement.querySelector(`#tree-${CSS.escape(treeId)}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  protected onTreeClick(treeId: string): void {
    if (this.editor.active() && this.editor.mode() === 'delete') {
      this.editor.removeTree(treeId);
      this.selectedId.set(null);
    } else {
      this.select(treeId, false);
    }
  }

  protected startEdit(): void {
    const p = this.plan.value();
    if (!p) return;
    this.editor.start(p);
    this.showGrid.set(true);
    this.selectedId.set(null);
  }

  protected setMode(mode: PlanEditMode): void {
    this.editor.mode.set(mode);
    this.selectedId.set(null);
  }

  protected async confirmClearAll(): Promise<void> {
    if (await this.confirm(`ลบหมุดทั้งหมด (${this.editor.trees().length} ต้น)?`, 'ยังไม่บันทึกจนกว่าจะกด "บันทึก"', 'ลบทั้งหมด')) {
      this.editor.clearAll();
    }
  }

  protected async cancelEdit(): Promise<void> {
    if (this.editor.dirty() && !(await this.confirm('ยกเลิกการแก้ไข?', 'สิ่งที่แก้ไว้จะหายไป', 'ทิ้งการแก้ไข'))) return;
    this.editor.stop();
    this.selectedId.set(null);
  }

  protected async saveEdit(): Promise<void> {
    try {
      const saved = await this.editor.save();
      this.plan.value.set(saved);
      this.editor.stop();
      this.selectedId.set(null);
    } catch {
      // ข้อความ error แสดงใน editor แล้ว
    }
  }

  protected downloadCsv(): void {
    const p = this.plan.value();
    if (p) downloadText(plantingCsv(p.trees), `planting-plan-${p.name.replace(/\s+/g, '-')}.csv`);
  }

  private async confirm(header: string, message: string, okText: string): Promise<boolean> {
    const alert = await this.alerts.create({
      header,
      message,
      buttons: [
        { text: 'ไม่ใช่', role: 'cancel' },
        { text: okText, role: 'confirm' },
      ],
    });
    await alert.present();
    return (await alert.onDidDismiss()).role === 'confirm';
  }
}
