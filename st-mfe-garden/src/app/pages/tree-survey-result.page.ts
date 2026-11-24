// ผลการนับต้นไม้: สรุป + ภาพพร้อมจุด/กริด + ตาราง (คลิกจุดหรือแถวแล้วเลือกตรงกัน) + ดาวน์โหลด CSV
// + โหมดแก้ไข (TASK-010): เพิ่ม/ลบจุด, เลื่อน/หมุนกริด, คำนวณระยะใหม่, เติมจุดตามตาราง → พรีวิว/บันทึกที่หลังบ้าน
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { RouterLink } from '@angular/router';
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
  IonNote,
  IonSpinner,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { createOutline, downloadOutline, gitCompareOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import type { SurveyedTreeDto, TreeSurveyDto, TreeSurveyStatsDto } from '@supertrees/contracts';
import { StDistancePipe, StThaiDatePipe, apiErrorMessage } from '@supertrees/shared-ui';
import { SurveyCanvasComponent } from '../components/survey-canvas.component';
import { TreeSurveyApi } from '../services/tree-survey-api.service';
import { TreeSurveyEditorPanelComponent } from '../components/tree-survey-editor-panel.component';
import { TreeSurveyEditor } from '../services/tree-survey-editor';

@Component({
  selector: 'st-tree-survey-result-page',
  imports: [
    RouterLink,
    SurveyCanvasComponent,
    TreeSurveyEditorPanelComponent,
    StDistancePipe,
    StThaiDatePipe,
    IonBackButton,
    IonBadge,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonNote,
    IonSpinner,
    IonTitle,
    IonToggle,
    IonToolbar,
  ],
  providers: [TreeSurveyEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start"><ion-back-button defaultHref="../" text="กลับ" /></ion-buttons>
        <ion-title>{{ editor.active() ? 'แก้ไข: ' : '' }}{{ survey.value()?.name ?? 'ผลการนับต้นไม้' }}</ion-title>
        @if (survey.value(); as s) {
          @if (!editor.active()) {
            <ion-buttons slot="end">
              @if (s.scaleSource === 'georef') {
                <ion-button [routerLink]="['../../compare']" [queryParams]="{ survey: s.id }"><ion-icon slot="start" name="git-compare-outline" />เทียบกับแผนปลูก</ion-button>
              }
              <ion-button (click)="startEdit(s)"><ion-icon slot="start" name="create-outline" />แก้ไข</ion-button>
              <ion-button (click)="downloadCsv(s)"><ion-icon slot="start" name="download-outline" />CSV</ion-button>
            </ion-buttons>
          }
        }
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (survey.isLoading()) {
        <div class="center"><ion-spinner /></div>
      } @else if (survey.error()) {
        <ion-note color="danger">{{ errorText() }}</ion-note>
      } @else if (survey.value(); as s) {
        @let st = stats();
        <div class="stats">
          <div class="stat"><span class="v">{{ (st?.treeCount ?? editor.points().length).toLocaleString('th-TH') }}</span><span class="k">ต้น</span></div>
          <div class="stat"><span class="v">{{ st?.rowCount ?? '—' }}</span><span class="k">แถว</span></div>
          <div class="stat">
            <span class="v">{{ st?.meanNearestDistanceM != null ? (st!.meanNearestDistanceM | stDistance) : '—' }}</span>
            <span class="k">
              ระยะห่างเฉลี่ย
              @if (st?.scaleIsEstimate) { <ion-badge color="warning">ประมาณ</ion-badge> }
            </span>
          </div>
          <div class="stat">
            @if (st?.georef; as g) {
              <span class="v">±{{ g.rmsErrorM | stDistance }}</span>
              <span class="k">คลาดเคลื่อนของการผูกแผนที่ (EPSG:{{ g.epsg }})</span>
            } @else {
              <span class="v">—</span><span class="k">ไม่ได้ผูกแผนที่</span>
            }
          </div>
        </div>
        <ion-note class="meta">
          {{ s.createdAt | stThaiDate: 'long' }}
          @if (s.updatedAt) { · แก้ไขล่าสุด {{ s.updatedAt | stThaiDate }} }
          · ภาพ {{ s.imageWidth }}×{{ s.imageHeight }} px · ระยะกลางบนภาพ {{ st?.medianSpacingPx ?? '—' }} px
          · แนวแถวเอียง {{ st?.gridAngleDeg ?? '—' }}° · วิธีตรวจจับ {{ s.stats.detectionMethod }}
          @if (s.stats.edited) { · <ion-badge color="medium">แก้ไขแล้ว</ion-badge> }
        </ion-note>
        @if (st?.scaleIsEstimate) {
          <ion-note color="warning" class="meta">ระยะคำนวณจากระยะปลูกที่ระบุ (= ระยะช่องตาราง) ไม่ใช่ค่าวัดจริง</ion-note>
        }

        <div class="layout">
          <section>
            <div class="toolbar">
              <ion-toggle [checked]="showGrid()" (ionChange)="showGrid.set($event.detail.checked)">กริด</ion-toggle>
              <ion-toggle [checked]="showLabels()" (ionChange)="showLabels.set($event.detail.checked)">เลขต้น</ion-toggle>
              @if (selected(); as t) {
                <span class="sel">เลือก <b>{{ t.treeId }}</b> · แถว {{ t.row }} ต้นที่ {{ t.column }}</span>
              }
            </div>
            <st-survey-canvas
              #canvas
              class="canvas"
              [class.deleting]="editor.active() && editor.mode() === 'delete'"
              [imageUrl]="s.imageUrl"
              [width]="s.imageWidth"
              [height]="s.imageHeight"
              [boundary]="s.boundaryPx"
              [controlPoints]="s.controlPoints ?? []"
              [trees]="trees()"
              [gridLines]="gridLines()"
              [selectedTreeId]="selectedId()"
              [showGrid]="showGrid()"
              [showLabels]="showLabels()"
              [pickable]="editor.active() && editor.mode() === 'add'"
              (imageClick)="editor.addPoint($event)"
              (treeClick)="onTreeClick($event)"
            />
          </section>

          <section class="side">
            @if (editor.active()) {
              <st-tree-survey-editor-panel [editor]="editor" [saveDisabled]="!editor.dirty() && editName() === (s.name ?? '')" (save)="saveEdit()" (cancel)="cancelEdit()" (modeChange)="selectedId.set(null)">
                <ion-input label="ชื่อผลการนับ" labelPlacement="stacked" [value]="editName()" [maxlength]="100" (ionInput)="editName.set($any($event.detail.value) ?? '')" />
              </st-tree-survey-editor-panel>
            }

            <div class="table-wrap" #tableWrap>
            <table>
              <thead>
                <tr><th>รหัส</th><th>แถว</th><th>ต้นที่</th><th>ใกล้สุด</th><th>ระยะ</th>@if (hasLngLat()) {<th>ละติจูด, ลองจิจูด</th>}</tr>
              </thead>
              <tbody>
                @for (t of trees(); track t.treeId) {
                  <tr [id]="'tree-' + t.treeId" [class.active]="t.treeId === selectedId()" (click)="select(t.treeId, true)">
                    <td><b>{{ t.treeId }}</b></td>
                    <td>{{ t.row || '' }}</td>
                    <td>{{ t.column || '' }}</td>
                    <td>{{ t.nearestTreeId }}</td>
                    <td>{{ t.nearestDistanceM != null ? (t.nearestDistanceM | stDistance) : t.nearestDistancePx ? t.nearestDistancePx + ' px' : '' }}</td>
                    @if (hasLngLat()) {
                      <td class="mono">{{ t.lngLat ? t.lngLat[1].toFixed(6) + ', ' + t.lngLat[0].toFixed(6) : '' }}</td>
                    }
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
    .stat .v { font-size: 1.6em; font-weight: 700; color: var(--st-color-primary); }
    .stat .k { color: var(--st-color-text-muted); font-size: 0.9em; }
    .meta { display: block; font-size: 0.85em; margin-bottom: var(--st-space-2); }
    .layout { display: grid; grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr); gap: var(--st-space-4); }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
    .toolbar { display: flex; align-items: center; gap: var(--st-space-4); flex-wrap: wrap; margin-bottom: var(--st-space-2); }
    .sel { color: var(--st-color-text-muted); }
    .canvas { height: min(70vh, 720px); }
    .canvas.deleting { cursor: not-allowed; }
    st-tree-survey-editor-panel { flex: none; }
    .side { display: flex; flex-direction: column; gap: var(--st-space-3); min-height: 0; max-height: min(78vh, 780px); }
    .table-wrap { flex: 1; min-height: 160px; overflow: auto; border: 1px solid var(--st-color-border); border-radius: var(--st-radius); }
    @media (max-width: 900px) { .side { max-height: none; } .table-wrap { max-height: 60vh; } }
    table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
    thead th { position: sticky; top: 0; background: var(--st-color-surface-alt); text-align: left; padding: var(--st-space-2); white-space: nowrap; }
    td { padding: var(--st-space-1) var(--st-space-2); border-top: 1px solid var(--st-color-border); white-space: nowrap; }
    tbody tr { cursor: pointer; }
    tbody tr.active { background: color-mix(in srgb, var(--st-color-primary) 15%, transparent); }
    .mono { font-family: ui-monospace, monospace; font-size: 0.85em; }
  `,
})
export class TreeSurveyResultPage {
  private readonly api = inject(TreeSurveyApi);
  private readonly alerts = inject(AlertController);
  private readonly params = inject(ActivatedRoute).snapshot.paramMap;
  private readonly canvas = viewChild<SurveyCanvasComponent>('canvas');
  private readonly tableWrap = viewChild<ElementRef<HTMLElement>>('tableWrap');
  protected readonly editor = inject(TreeSurveyEditor);
  protected readonly editName = signal('');

  protected readonly survey = rxResource({
    params: () => ({ parcelId: this.params.get('parcelId') ?? '', surveyId: this.params.get('surveyId') ?? '' }),
    stream: ({ params }) => this.api.get(params.parcelId, params.surveyId),
  });
  protected readonly errorText = computed(() => apiErrorMessage(this.survey.error()));
  protected readonly selectedId = signal<string | null>(null);
  protected readonly showGrid = signal(true);
  protected readonly showLabels = signal(true);

  // สิ่งที่แสดง: ระหว่างแก้ = ผลพรีวิว · ปกติ = ผลที่บันทึกไว้
  protected readonly trees = computed<SurveyedTreeDto[]>(() =>
    this.editor.active() ? this.editor.trees() : (this.survey.value()?.trees ?? []),
  );
  protected readonly gridLines = computed(() =>
    this.editor.active() ? (this.editor.tooFew() ? [] : (this.editor.preview()?.gridLines ?? [])) : (this.survey.value()?.gridLines ?? []),
  );
  protected readonly stats = computed<TreeSurveyStatsDto | null>(() =>
    this.editor.active() ? (this.editor.tooFew() ? null : (this.editor.preview()?.stats ?? null)) : (this.survey.value()?.stats ?? null),
  );
  protected readonly hasLngLat = computed(() => this.trees().some((t) => t.lngLat));
  protected readonly selected = computed<SurveyedTreeDto | null>(() => {
    const id = this.selectedId();
    return id ? (this.trees().find((t) => t.treeId === id) ?? null) : null;
  });

  constructor() {
    addIcons({ createOutline, downloadOutline, gitCompareOutline });
  }

  protected startEdit(s: TreeSurveyDto): void {
    this.editName.set(s.name ?? '');
    this.editor.start({ ...s, preview: (req) => this.api.preview(s.parcelId, s.id, req) });
    this.selectedId.set(null);
  }

  /** fromTable = คลิกที่ตาราง → เลื่อนภาพไปหา · คลิกที่ภาพ → เลื่อนตารางไปหา */
  protected select(treeId: string, fromTable: boolean): void {
    this.selectedId.set(treeId);
    const t = this.selected();
    if (!t) return;
    if (fromTable) this.canvas()?.focus(t.pixel);
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

  protected async cancelEdit(): Promise<void> {
    if (this.editor.dirty() && !(await this.confirm('ยกเลิกการแก้ไข?', 'สิ่งที่แก้ไว้จะหายไป', 'ทิ้งการแก้ไข'))) return;
    this.editor.stop();
    this.selectedId.set(null);
  }

  protected async saveEdit(): Promise<void> {
    try {
      const s = this.survey.value()!;
      const name = this.editName().trim();
      const saved = await this.editor.save((edit) =>
        firstValueFrom(this.api.update(s.parcelId, s.id, { ...edit, ...(name ? { name } : {}) })),
      );
      this.survey.value.set(saved);
      this.editor.stop();
      this.selectedId.set(null);
    } catch {
      // ข้อความ error แสดงใน editor แล้ว
    }
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

  protected downloadCsv(s: TreeSurveyDto): void {
    const head = ['tree_id', 'order_num', 'row', 'column', 'pixel_x', 'pixel_y', 'nearest_tree_id', 'nearest_distance_px', 'nearest_distance_m', 'lng', 'lat'];
    const rows = s.trees.map((t) => [
      t.treeId, t.orderNum, t.row, t.column, t.pixel[0], t.pixel[1], t.nearestTreeId, t.nearestDistancePx,
      t.nearestDistanceM ?? '', t.lngLat?.[0] ?? '', t.lngLat?.[1] ?? '',
    ]);
    const csv = [head, ...rows].map((r) => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `tree-survey-${s.id}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }
}
