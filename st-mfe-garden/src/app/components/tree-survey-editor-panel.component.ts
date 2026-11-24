// แผงเครื่องมือแก้ผลการนับ — ใช้ทั้งหน้าผล (บันทึกแล้ว) และหน้าวิเคราะห์ใหม่ (ก่อนบันทึก)
// สถานะอยู่ใน TreeSurveyEditor ของหน้าที่เรียก · ช่องอื่นของหน้า (เช่นชื่อ) ใส่ผ่าน <ng-content>
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { AlertController, IonButton, IonIcon, IonLabel, IonNote, IonSegment, IonSegmentButton, IonSpinner } from '@ionic/angular';
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
  eyeOutline,
  gridOutline,
  refreshOutline,
  removeCircleOutline,
  saveOutline,
  trashOutline,
} from 'ionicons/icons';
import { ROTATE_STEP_DEG, SHIFT_STEP_PX, TreeSurveyEditor, type EditMode } from '../services/tree-survey-editor';

@Component({
  selector: 'st-tree-survey-editor-panel',
  imports: [IonButton, IonIcon, IonLabel, IonNote, IonSegment, IonSegmentButton, IonSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let e = editor();
    <div class="editor">
      <ng-content />
      <span class="lbl">โหมดคลิกบนภาพ</span>
      <ion-segment [value]="e.mode()" (ionChange)="setMode($any($event.detail.value))">
        <ion-segment-button value="inspect"><ion-icon name="eye-outline" /><ion-label>ตรวจสอบ</ion-label></ion-segment-button>
        <ion-segment-button value="add"><ion-icon name="add-circle-outline" /><ion-label>เพิ่ม</ion-label></ion-segment-button>
        <ion-segment-button value="delete"><ion-icon name="remove-circle-outline" /><ion-label>ลบ</ion-label></ion-segment-button>
      </ion-segment>
      <span class="lbl">เลื่อนกริด (ทีละ {{ shift }} px)</span>
      <div class="erow">
        <ion-button size="small" fill="outline" [disabled]="!e.resolvedGrid()" (click)="e.shift(-shift, 0)" title="เลื่อนกริดซ้าย"><ion-icon slot="icon-only" name="arrow-back-outline" /></ion-button>
        <ion-button size="small" fill="outline" [disabled]="!e.resolvedGrid()" (click)="e.shift(shift, 0)" title="เลื่อนกริดขวา"><ion-icon slot="icon-only" name="arrow-forward-outline" /></ion-button>
        <ion-button size="small" fill="outline" [disabled]="!e.resolvedGrid()" (click)="e.shift(0, -shift)" title="เลื่อนกริดขึ้น"><ion-icon slot="icon-only" name="arrow-up-outline" /></ion-button>
        <ion-button size="small" fill="outline" [disabled]="!e.resolvedGrid()" (click)="e.shift(0, shift)" title="เลื่อนกริดลง"><ion-icon slot="icon-only" name="arrow-down-outline" /></ion-button>
      </div>
      <span class="lbl">หมุนกริด</span>
      <div class="erow">
        <ion-button size="small" fill="outline" [disabled]="!e.resolvedGrid()" (click)="e.rotate(-rotateStep)" title="หมุนทวนเข็ม"><ion-icon slot="start" name="arrow-undo-outline" />ทวนเข็ม {{ rotateStep }}°</ion-button>
        <ion-button size="small" fill="outline" [disabled]="!e.resolvedGrid()" (click)="e.rotate(rotateStep)" title="หมุนตามเข็ม"><ion-icon slot="start" name="arrow-redo-outline" />ตามเข็ม {{ rotateStep }}°</ion-button>
      </div>
      <div class="erow">
        <ion-button size="small" color="secondary" (click)="e.recalcSpacing()" [disabled]="e.tooFew()"><ion-icon slot="start" name="grid-outline" />คำนวณระยะตารางใหม่</ion-button>
        <ion-button size="small" color="secondary" fill="outline" (click)="e.resetGrid()" [disabled]="e.tooFew()"><ion-icon slot="start" name="refresh-outline" />รีเซ็ตตาราง</ion-button>
        <ion-button size="small" color="secondary" (click)="e.fillGaps()" [disabled]="e.tooFew()"><ion-icon slot="start" name="apps-outline" />เติมจุดตามตาราง</ion-button>
        <ion-button size="small" color="danger" fill="outline" (click)="confirmClearAll()" [disabled]="!e.points().length"><ion-icon slot="start" name="trash-outline" />ลบทั้งหมด</ion-button>
      </div>
      <div class="erow status">
        @if (e.previewing()) { <ion-spinner name="dots" /> }
        @if (e.resolvedGrid(); as g) {
          <span class="grid-info">กริด {{ g.angleDeg.toFixed(1) }}° · ช่อง {{ g.spacingPx.toFixed(1) }} px</span>
        }
        @if (e.error()) {
          <ion-note color="danger">{{ e.error() }}</ion-note>
        } @else if (e.message()) {
          <ion-note>{{ e.message() }}</ion-note>
        }
      </div>
      <div class="erow end">
        @if (cancelLabel()) {
          <ion-button fill="clear" color="medium" (click)="cancel.emit()" [disabled]="e.saving()">{{ cancelLabel() }}</ion-button>
        }
        <ion-button (click)="save.emit()" [disabled]="saveDisabled() || e.tooFew() || e.saving() || e.previewing() || !!e.error()">
          @if (e.saving()) { <ion-spinner slot="start" name="crescent" /> } @else { <ion-icon slot="start" name="save-outline" /> }
          {{ saveLabel() }}
        </ion-button>
      </div>
    </div>
  `,
  styles: `
    .editor { border: 1px solid var(--st-color-border); border-radius: var(--st-radius); background: var(--st-color-surface-alt);
      padding: var(--st-space-2) var(--st-space-3); display: flex; flex-direction: column; gap: var(--st-space-1); }
    .erow { display: flex; align-items: center; gap: var(--st-space-1); flex-wrap: wrap; }
    .erow.end { justify-content: flex-end; }
    .erow.status { min-height: 28px; gap: var(--st-space-3); }
    .lbl { font-weight: 700; font-size: 0.9em; margin-top: var(--st-space-1); }
    .grid-info { font-family: ui-monospace, monospace; font-size: 0.85em; color: var(--st-color-text-muted); }
  `,
})
export class TreeSurveyEditorPanelComponent {
  readonly editor = input.required<TreeSurveyEditor>();
  readonly saveLabel = input('บันทึก');
  /** ว่าง = ไม่มีปุ่มยกเลิก */
  readonly cancelLabel = input<string | null>('ยกเลิก');
  /** เงื่อนไขเพิ่มของหน้า (เช่นยังไม่ตั้งชื่อ / ยังไม่ได้แก้) */
  readonly saveDisabled = input(false);

  readonly save = output<void>();
  readonly cancel = output<void>();
  /** เปลี่ยนโหมด — หน้าใช้ล้างการเลือก */
  readonly modeChange = output<EditMode>();

  private readonly alerts = inject(AlertController);
  protected readonly shift = SHIFT_STEP_PX;
  protected readonly rotateStep = ROTATE_STEP_DEG;

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
      eyeOutline,
      gridOutline,
      refreshOutline,
      removeCircleOutline,
      saveOutline,
      trashOutline,
    });
  }

  protected setMode(mode: EditMode): void {
    this.editor().mode.set(mode);
    this.modeChange.emit(mode);
  }

  protected async confirmClearAll(): Promise<void> {
    const n = this.editor().points().length;
    const alert = await this.alerts.create({
      header: `ลบจุดต้นไม้ทั้งหมด (${n} ต้น)?`,
      message: 'ยังไม่บันทึกจนกว่าจะกดบันทึก',
      buttons: [
        { text: 'ไม่ใช่', role: 'cancel' },
        { text: 'ลบทั้งหมด', role: 'confirm' },
      ],
    });
    await alert.present();
    if ((await alert.onDidDismiss()).role === 'confirm') this.editor().clearAll();
  }
}
