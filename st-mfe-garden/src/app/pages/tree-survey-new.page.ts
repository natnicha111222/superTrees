// นับต้นไม้จากภาพใหม่ — 2 ขั้น:
//   1) ตั้งค่า: เลือกภาพ → คลิกขอบเขตแปลง → มาตราส่วน (จุดอ้างอิงแผนที่ หรือระยะปลูก) → "วิเคราะห์ภาพ" (ยังไม่บันทึก)
//   2) ตรวจผล: แก้จุด/กริดด้วยแผงเดียวกับหน้าผล → ตั้งชื่อ → "บันทึกผลการนับ" (POST พร้อม result — ไม่ตรวจจับซ้ำ)
// มาตราส่วนตาม CONF-005: จุดคู่ภาพ↔แผนที่ ≥ 3 จุดเป็นหลัก · ระยะปลูกเป็นค่าสำรองแบบ "ประมาณ" (MOCK-001)
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowUndoOutline, closeCircleOutline, imageOutline, mapOutline, trashOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import type { LngLat, PixelPoint, SurveyedTreeDto, TreeSurveyAnalysisDto, TreeSurveyCreateRequest } from '@supertrees/contracts';
import { StDistancePipe, apiErrorMessage } from '@supertrees/shared-ui';
import { TreeSurveyEditorPanelComponent } from '../components/tree-survey-editor-panel.component';
import { TreeSurveyEditor } from '../services/tree-survey-editor';
import { MapPointPickerComponent } from '../components/map-point-picker.component';
import { SurveyCanvasComponent } from '../components/survey-canvas.component';
import { parseLatLngText, prepareSurveyImage, type PreparedImage } from '../services/image-prep';
import { TreeSurveyApi } from '../services/tree-survey-api.service';

type PickMode = 'boundary' | 'control';
type ScaleMode = 'georef' | 'assumed';

interface ControlPointDraft {
  pixel: PixelPoint;
  text: string;
}

@Component({
  selector: 'st-tree-survey-new-page',
  imports: [
    SurveyCanvasComponent,
    MapPointPickerComponent,
    TreeSurveyEditorPanelComponent,
    StDistancePipe,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonModal,
    IonNote,
    IonSegment,
    IonSegmentButton,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  providers: [TreeSurveyEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start"><ion-back-button defaultHref="../" text="กลับ" /></ion-buttons>
        <ion-title>{{ analysis() ? 'ตรวจผลก่อนบันทึก' : 'นับต้นไม้จากภาพใหม่' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="layout">
        <section class="canvas-col">
          @if (image(); as img) {
            @if (analysis()) {
              <st-survey-canvas
                #canvas
                class="canvas"
                [imageUrl]="previewUrl()"
                [width]="img.width"
                [height]="img.height"
                [boundary]="boundary()"
                [controlPoints]="scaleMode() === 'georef' ? controlPoints() : []"
                [trees]="editor.trees()"
                [gridLines]="editor.tooFew() ? [] : (editor.preview()?.gridLines ?? [])"
                [selectedTreeId]="selectedId()"
                [pickable]="editor.mode() === 'add'"
                (imageClick)="editor.addPoint($event)"
                (treeClick)="onTreeClick($event)"
              />
            } @else {
              <st-survey-canvas
                class="canvas"
                [imageUrl]="previewUrl()"
                [width]="img.width"
                [height]="img.height"
                [boundary]="boundary()"
                [controlPoints]="scaleMode() === 'georef' ? controlPoints() : []"
                [pickable]="!busy()"
                (imageClick)="onPick($event)"
              />
            }
            <ion-note class="hint">
              @if (analysis()) {
                ผลวิเคราะห์ยังไม่ถูกบันทึก — ตรวจจุดต้นไม้ แก้ได้ด้วยแผงด้านขวา แล้วตั้งชื่อและกด "บันทึกผลการนับ"
              } @else if (pickMode() === 'boundary') {
                คลิกตามแนวขอบแปลงทีละจุด (อย่างน้อย 3 จุด) · ลากเพื่อเลื่อน · ล้อเมาส์เพื่อซูม
              } @else {
                คลิกจุดที่ระบุตำแหน่งได้ชัดบนภาพ (เช่น มุมรั้ว เสา ทางแยก) แล้วกดไอคอนแผนที่ของจุดนั้นด้านขวาเพื่อเลือกตำแหน่งเดียวกันบนแผนที่
              }
            </ion-note>
          } @else {
            <button class="drop" type="button" (click)="fileInput.click()" [disabled]="preparing()">
              @if (preparing()) {
                <ion-spinner />
              } @else {
                <ion-icon name="image-outline" />
                <span>เลือกภาพถ่ายมุมสูงของแปลง (JPEG / PNG)</span>
              }
            </button>
          }
          <input #fileInput type="file" accept="image/jpeg,image/png" hidden (change)="onFile(fileInput)" />
        </section>

        <section class="side">
          @if (analysis(); as a) {
            @let st = editor.tooFew() ? null : editor.preview()?.stats;
            <div class="stats">
              <div class="stat"><span class="v">{{ (st?.treeCount ?? editor.points().length).toLocaleString('th-TH') }}</span><span class="k">ต้น</span></div>
              <div class="stat"><span class="v">{{ st?.rowCount ?? '—' }}</span><span class="k">แถว</span></div>
              <div class="stat wide">
                <span class="v">{{ st?.meanNearestDistanceM != null ? (st!.meanNearestDistanceM | stDistance) : '—' }}</span>
                <span class="k">ระยะห่างเฉลี่ย @if (st?.scaleIsEstimate) { (ประมาณ) } @if (st?.georef; as g) { · ผูกแผนที่ ±{{ g.rmsErrorM | stDistance }} }</span>
              </div>
            </div>
            @if (error()) {
              <ion-note color="danger" class="error">{{ error() }}</ion-note>
            }
            <st-tree-survey-editor-panel
              [editor]="editor"
              saveLabel="บันทึกผลการนับ"
              cancelLabel="กลับไปแก้ขอบเขต/มาตราส่วน"
              [saveDisabled]="!surveyName().trim()"
              (save)="save()"
              (cancel)="backToSetup()"
              (modeChange)="selectedId.set(null)"
            >
              <ion-input label="ชื่อผลการนับ (ต้องใส่)" labelPlacement="stacked" placeholder="เช่น แปลงทุเรียน รอบ ธ.ค." [value]="surveyName()" [maxlength]="100"
                (ionInput)="surveyName.set($any($event.detail.value) ?? '')" />
            </st-tree-survey-editor-panel>
          } @else {
          <ion-card>
            <ion-card-header>
              <ion-card-subtitle>ขั้นที่ 1</ion-card-subtitle>
              <ion-card-title>ภาพ</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              @if (image(); as img) {
                <p>{{ img.width }} × {{ img.height }} พิกเซล @if (img.resized) { (ย่อจากภาพต้นฉบับ) }</p>
                <ion-button size="small" fill="outline" (click)="fileInput.click()" [disabled]="busy()">เปลี่ยนภาพ</ion-button>
              } @else {
                <p>ภาพต้องถ่ายตั้งฉากลงพื้น (มุมโดรน) · ภาพที่ยาวเกิน 4,096 พิกเซลจะถูกย่อให้อัตโนมัติ</p>
              }
            </ion-card-content>
          </ion-card>

          <ion-card [disabled]="!image()">
            <ion-card-header>
              <ion-card-subtitle>ขั้นที่ 2</ion-card-subtitle>
              <ion-card-title>ขอบเขตแปลง ({{ boundary().length }} จุด)</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <ion-button size="small" [fill]="pickMode() === 'boundary' ? 'solid' : 'outline'" (click)="pickMode.set('boundary')">ปักขอบเขต</ion-button>
              <ion-button size="small" fill="clear" (click)="undoBoundary()" [disabled]="!boundary().length"><ion-icon slot="start" name="arrow-undo-outline" />ย้อน</ion-button>
              <ion-button size="small" fill="clear" color="danger" (click)="boundary.set([])" [disabled]="!boundary().length"><ion-icon slot="start" name="trash-outline" />ล้าง</ion-button>
            </ion-card-content>
          </ion-card>

          <ion-card [disabled]="!image()">
            <ion-card-header>
              <ion-card-subtitle>ขั้นที่ 3</ion-card-subtitle>
              <ion-card-title>มาตราส่วน</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <ion-segment [value]="scaleMode()" (ionChange)="setScaleMode($any($event.detail.value))">
                <ion-segment-button value="georef"><ion-label>จุดอ้างอิงแผนที่</ion-label></ion-segment-button>
                <ion-segment-button value="assumed"><ion-label>ระยะปลูก</ion-label></ion-segment-button>
              </ion-segment>

              @if (scaleMode() === 'georef') {
                <p class="explain">
                  ปักอย่างน้อย 3 จุดบนภาพ (แนะนำ 4 จุดขึ้นไป กระจายรอบแปลง) แล้วกด <ion-icon name="map-outline" /> เพื่อเลือกจุดเดียวกันบนแผนที่
                  (หรือวางพิกัด "ละติจูด, ลองจิจูด" เอง) — ได้ทั้งระยะจริงและตำแหน่งต้นไม้บนแผนที่
                </p>
                <ion-button size="small" [fill]="pickMode() === 'control' ? 'solid' : 'outline'" (click)="pickMode.set('control')">
                  ปักจุดอ้างอิง
                </ion-button>
                <ion-list lines="full">
                  @for (cp of controlPoints(); track $index; let i = $index) {
                    <ion-item>
                      <ion-label slot="start" class="cp-no">{{ i + 1 }}</ion-label>
                      <ion-input
                        [value]="cp.text"
                        placeholder="13.756300, 100.501800"
                        [color]="cp.text && !parsed()[i] ? 'danger' : undefined"
                        (ionInput)="setControlText(i, $any($event.detail.value))"
                        [attr.aria-label]="'พิกัดจุดที่ ' + (i + 1)"
                      />
                      <ion-button slot="end" fill="clear" (click)="openMap(i)" [attr.aria-label]="'เลือกจุดที่ ' + (i + 1) + ' บนแผนที่'" class="map-btn">
                        <ion-icon slot="icon-only" name="map-outline" />
                      </ion-button>
                      <ion-button slot="end" fill="clear" color="medium" (click)="removeControl(i)" aria-label="ลบจุด">
                        <ion-icon slot="icon-only" name="close-circle-outline" />
                      </ion-button>
                    </ion-item>
                  }
                </ion-list>
              } @else {
                <ion-item lines="none">
                  <ion-input
                    type="number"
                    label="ระยะปลูกระหว่างต้น (เมตร)"
                    labelPlacement="stacked"
                    [value]="spacing()"
                    min="0.1"
                    max="100"
                    step="0.5"
                    (ionInput)="spacing.set(+($any($event.detail.value) ?? 0))"
                  />
                </ion-item>
                <ion-note color="warning">ระยะที่ได้เป็นค่าประมาณจากระยะปลูกที่ระบุ ไม่ใช่ค่าวัดจริง และจะไม่มีตำแหน่งบนแผนที่</ion-note>
              }
            </ion-card-content>
          </ion-card>

          @if (error()) {
            <ion-note color="danger" class="error">{{ error() }}</ion-note>
          }
          <ion-button expand="block" (click)="analyze()" [disabled]="!canSubmit()">
            @if (busy(); as b) {
              <ion-spinner slot="start" name="crescent" />
              {{ b === 'upload' ? 'กำลังอัปโหลดภาพ…' : 'กำลังวิเคราะห์ภาพ…' }}
            } @else {
              วิเคราะห์ภาพ
            }
          </ion-button>
          <ion-note class="hint">ยังไม่บันทึก — ตรวจ/แก้ผลและตั้งชื่อก่อนบันทึกในขั้นถัดไป</ion-note>
          @if (!canSubmit() && !busy() && image()) {
            <ion-note class="hint">{{ missing() }}</ion-note>
          }
          }
        </section>
      </div>
    </ion-content>

    <!-- เลือกพิกัดของจุดอ้างอิงบนแผนที่ (CONF-006) -->
    <ion-modal [isOpen]="mapIndex() !== null" (didDismiss)="closeMap()" class="map-modal">
      <ng-template>
        <ion-header>
          <ion-toolbar color="primary">
            <ion-title>เลือกตำแหน่งจุดที่ {{ (mapIndex() ?? 0) + 1 }} บนแผนที่</ion-title>
            <ion-buttons slot="end"><ion-button (click)="closeMap()">ยกเลิก</ion-button></ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          @if (mapIndex() !== null) {
            <st-map-point-picker
              [points]="mapPoints()"
              [activeIndex]="mapIndex()!"
              [initialView]="lastMapView()"
              (picked)="pendingPick.set($event)"
              (viewChange)="lastMapView.set($event)"
            />
          }
        </ion-content>
        <ion-footer>
          <ion-toolbar>
            <ion-note slot="start" class="pick">
              @if (pendingPick(); as p) {
                {{ p[1].toFixed(7) }}, {{ p[0].toFixed(7) }}
              } @else {
                คลิกบนแผนที่ตรงตำแหน่งของจุดที่ {{ (mapIndex() ?? 0) + 1 }}
              }
            </ion-note>
            <ion-buttons slot="end">
              <ion-button fill="solid" color="primary" (click)="confirmMap()" [disabled]="!pendingPick()">ใช้ตำแหน่งนี้</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-footer>
      </ng-template>
    </ion-modal>
  `,
  styles: `
    .layout { display: grid; grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr); gap: var(--st-space-4); }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
    .canvas-col { display: flex; flex-direction: column; gap: var(--st-space-2); }
    .canvas { height: min(70vh, 720px); }
    .drop { height: 320px; border: 2px dashed var(--st-color-border); border-radius: var(--st-radius); background: var(--st-color-surface-alt);
      color: var(--st-color-text-muted); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--st-space-2);
      font: inherit; cursor: pointer; }
    .drop ion-icon { font-size: 48px; }
    .hint { display: block; font-size: 0.85em; }
    .explain { margin: var(--st-space-2) 0; }
    .cp-no { flex: 0 0 1.5em; font-weight: 700; color: var(--st-viz-control-point); }
    ion-card { margin: 0 0 var(--st-space-3); }
    .error { display: block; margin-bottom: var(--st-space-2); }
    .map-btn { --color: var(--st-viz-control-point); }
    .map-modal { --width: min(1100px, 96vw); --height: min(820px, 92vh); }
    .map-modal st-map-point-picker { height: 100%; }
    .pick { padding-left: var(--st-space-4); font-family: ui-monospace, monospace; }
    .side { display: flex; flex-direction: column; gap: var(--st-space-3); }
    .stats { display: grid; grid-template-columns: 1fr 1fr; gap: var(--st-space-2); }
    .stat { background: var(--st-color-surface-alt); border-radius: var(--st-radius); padding: var(--st-space-2) var(--st-space-3); display: flex; flex-direction: column; }
    .stat.wide { grid-column: span 2; }
    .stat .v { font-size: 1.4em; font-weight: 700; color: var(--st-color-primary); }
    .stat .k { color: var(--st-color-text-muted); font-size: 0.85em; }
  `,
})
export class TreeSurveyNewPage {
  private readonly api = inject(TreeSurveyApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly parcelId = this.route.snapshot.paramMap.get('parcelId') ?? '';

  protected readonly image = signal<PreparedImage | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly preparing = signal(false);
  protected readonly pickMode = signal<PickMode>('boundary');
  protected readonly scaleMode = signal<ScaleMode>('georef');
  protected readonly boundary = signal<PixelPoint[]>([]);
  protected readonly controlPoints = signal<ControlPointDraft[]>([]);
  protected readonly spacing = signal(4);
  protected readonly busy = signal<'upload' | 'analyze' | null>(null);
  protected readonly error = signal<string | null>(null);

  // ── ขั้นตรวจผล ──
  protected readonly editor = inject(TreeSurveyEditor);
  private readonly canvas = viewChild<SurveyCanvasComponent>('canvas');
  /** ผลวิเคราะห์ที่ยังไม่บันทึก · null = อยู่ขั้นตั้งค่า */
  protected readonly analysis = signal<TreeSurveyAnalysisDto | null>(null);
  protected readonly surveyName = signal('');
  protected readonly selectedId = signal<string | null>(null);
  /** ไฟล์ที่อัปโหลดแล้วของภาพปัจจุบัน — วิเคราะห์ซ้ำไม่ต้องอัปโหลดใหม่ */
  private uploadedPath: string | null = null;

  /** index ของจุดอ้างอิงที่กำลังเลือกบนแผนที่ · null = ปิด modal */
  protected readonly mapIndex = signal<number | null>(null);
  protected readonly pendingPick = signal<LngLat | null>(null);
  /** จำมุมมองแผนที่ล่าสุด เปิดครั้งต่อไปไม่ต้องซูมหาใหม่ */
  protected readonly lastMapView = signal<{ center: LngLat; zoom: number } | null>(null);
  protected readonly mapPoints = computed(() => {
    const i = this.mapIndex();
    const pending = this.pendingPick();
    return this.parsed().map((p, j) => (j === i && pending ? pending : p));
  });

  protected readonly parsed = computed(() => this.controlPoints().map((c) => parseLatLngText(c.text)));
  protected readonly missing = computed(() => {
    if (this.boundary().length < 3) return 'ปักขอบเขตแปลงอย่างน้อย 3 จุด';
    if (this.scaleMode() === 'georef') {
      if (this.controlPoints().length < 3) return 'ปักจุดอ้างอิงอย่างน้อย 3 จุด';
      if (this.parsed().some((p) => !p)) return 'ใส่พิกัดของจุดอ้างอิงให้ครบและถูกรูปแบบ (ละติจูด, ลองจิจูด)';
    } else if (!(this.spacing() > 0 && this.spacing() <= 100)) {
      return 'ระยะปลูกต้องอยู่ระหว่าง 0.1–100 เมตร';
    }
    return '';
  });
  protected readonly canSubmit = computed(() => !!this.image() && !this.busy() && !this.missing());

  constructor() {
    addIcons({ arrowUndoOutline, closeCircleOutline, imageOutline, mapOutline, trashOutline });
    inject(DestroyRef).onDestroy(() => this.revokePreview());
  }

  protected async onFile(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.error.set(null);
    this.preparing.set(true);
    try {
      const img = await prepareSurveyImage(file);
      this.revokePreview();
      this.image.set(img);
      this.uploadedPath = null;
      this.previewUrl.set(URL.createObjectURL(img.blob));
      this.boundary.set([]);
      this.controlPoints.set([]);
      this.pickMode.set('boundary');
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    } finally {
      this.preparing.set(false);
    }
  }

  protected onPick(p: PixelPoint): void {
    if (this.pickMode() === 'boundary') this.boundary.update((b) => [...b, p]);
    else this.controlPoints.update((c) => [...c, { pixel: p, text: '' }]);
  }

  protected undoBoundary(): void {
    this.boundary.update((b) => b.slice(0, -1));
  }

  protected setScaleMode(mode: ScaleMode): void {
    this.scaleMode.set(mode);
    this.pickMode.set(mode === 'georef' && this.boundary().length >= 3 ? 'control' : 'boundary');
  }

  protected setControlText(i: number, text: string): void {
    this.controlPoints.update((c) => c.map((cp, j) => (j === i ? { ...cp, text: text ?? '' } : cp)));
  }

  protected openMap(i: number): void {
    this.pendingPick.set(this.parsed()[i] ?? null);
    this.mapIndex.set(i);
  }

  protected closeMap(): void {
    this.mapIndex.set(null);
    this.pendingPick.set(null);
  }

  protected confirmMap(): void {
    const i = this.mapIndex();
    const p = this.pendingPick();
    if (i === null || !p) return;
    // ช่องข้อความใช้รูปแบบ "ละติจูด, ลองจิจูด" (แบบที่คนคุ้น) · ส่ง API เป็น [lng, lat]
    this.setControlText(i, `${p[1].toFixed(7)}, ${p[0].toFixed(7)}`);
    this.closeMap();
  }

  protected removeControl(i: number): void {
    this.controlPoints.update((c) => c.filter((_, j) => j !== i));
  }

  /** บริบทของภาพ (ขอบเขต + มาตราส่วน) ตามที่ตั้งไว้ */
  private context(): Pick<TreeSurveyCreateRequest, 'boundaryPx' | 'controlPoints' | 'assumedSpacingM'> {
    return this.scaleMode() === 'georef'
      ? { boundaryPx: this.boundary(), controlPoints: this.controlPoints().map((c, i) => ({ pixel: c.pixel, lngLat: this.parsed()[i]! })) }
      : { boundaryPx: this.boundary(), assumedSpacingM: this.spacing() };
  }

  /** อัปโหลด (ครั้งแรก) + วิเคราะห์ — ยังไม่บันทึก */
  protected async analyze(): Promise<void> {
    const img = this.image();
    if (!img || !this.canSubmit()) return;
    this.error.set(null);
    try {
      if (!this.uploadedPath) {
        this.busy.set('upload');
        const { objectPath, uploadUrl } = await firstValueFrom(
          this.api.createUploadUrl(this.parcelId, { contentType: img.contentType, sizeBytes: img.blob.size }),
        );
        await this.api.uploadToSignedUrl(uploadUrl, img.blob, img.contentType);
        this.uploadedPath = objectPath;
      }
      this.busy.set('analyze');
      const ctx = this.context();
      const a = await firstValueFrom(this.api.analyze(this.parcelId, { objectPath: this.uploadedPath, ...ctx }));
      this.analysis.set(a);
      this.selectedId.set(null);
      this.editor.start({
        trees: a.trees,
        gridLines: a.gridLines,
        stats: a.stats,
        boundaryPx: ctx.boundaryPx,
        preview: (req) =>
          this.api.previewDraft(this.parcelId, {
            ...ctx,
            imageWidth: a.imageWidth,
            imageHeight: a.imageHeight,
            detectionMethod: a.stats.detectionMethod,
            ...req,
          }),
      });
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    } finally {
      this.busy.set(null);
    }
  }

  /** กลับไปแก้ขอบเขต/มาตราส่วน — ผลวิเคราะห์ (ที่ยังไม่บันทึก) ถูกทิ้ง */
  protected backToSetup(): void {
    this.editor.stop();
    this.analysis.set(null);
    this.selectedId.set(null);
  }

  protected onTreeClick(treeId: string): void {
    if (this.editor.mode() === 'delete') {
      this.editor.removeTree(treeId);
      this.selectedId.set(null);
    } else {
      this.selectedId.set(treeId);
    }
  }

  /** บันทึกผลที่ตรวจแล้ว (ไม่ตรวจจับซ้ำ) */
  protected async save(): Promise<void> {
    const a = this.analysis();
    const path = this.uploadedPath;
    const name = this.surveyName().trim();
    if (!a || !path || !name) return;
    this.error.set(null);
    try {
      const survey = await this.editor.save((edit) =>
        firstValueFrom(
          this.api.create(this.parcelId, {
            objectPath: path,
            ...this.context(),
            name,
            result: { points: edit.points, grid: edit.grid, detectionMethod: a.stats.detectionMethod, edited: this.editor.dirty() },
          }),
        ),
      );
      this.editor.stop();
      await this.router.navigate(['..', survey.id], { relativeTo: this.route, replaceUrl: true });
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    }
  }

  private revokePreview(): void {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
  }
}
