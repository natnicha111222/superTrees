// วางแผนปลูกใหม่: ปักมุมแปลงบนแผนที่ดาวเทียม + ระยะปลูก → พรีวิวตำแหน่งต้นไม้อัตโนมัติ → บันทึก / CSV
// ตำแหน่งต้นไม้คำนวณที่ garden-service เสมอ (UTM + ST_IsValid) · ยิงพรีวิวแบบ debounce + switchMap (CLAUDE.md)
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonNote,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowUndoOutline, downloadOutline, saveOutline, trashOutline } from 'ionicons/icons';
import { catchError, debounceTime, finalize, firstValueFrom, of, switchMap } from 'rxjs';
import type { LngLat, PlantingPlanLayoutDto } from '@supertrees/contracts';
import { StDistancePipe, StRaiNganWaPipe, apiErrorMessage } from '@supertrees/shared-ui';
import { PlantingMapComponent } from '../components/planting-map.component';
import { PlantingPlanApi, downloadText, plantingCsv } from '../services/planting-plan-api.service';

const PREVIEW_DEBOUNCE_MS = 250;

@Component({
  selector: 'st-planting-plan-new-page',
  imports: [
    PlantingMapComponent,
    StDistancePipe,
    StRaiNganWaPipe,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonNote,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start"><ion-back-button defaultHref="../" text="กลับ" /></ion-buttons>
        <ion-title>วางแผนปลูกใหม่</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="layout">
        <st-planting-map class="map" [boundary]="boundary()" [trees]="layout()?.trees ?? []" [pickPoints]="true" [popups]="false" (mapClick)="addCorner($event)" />

        <section class="side">
          <ion-note class="howto">
            ซูมไปที่แปลง → คลิกปักมุมแปลงตามลำดับรอบแปลง (อย่างน้อย 3 จุด) —
            <b>ปักขอบด้านยาวก่อน</b> เพราะแถวต้นไม้จะขนานกับขอบแรก (มุม 1→2)
          </ion-note>

          <ion-item lines="full">
            <ion-input label="ชื่อแผน" labelPlacement="stacked" placeholder="เช่น แปลงทุเรียนหลังบ้าน" [value]="name()" [maxlength]="100"
              (ionInput)="name.set($any($event.detail.value) ?? '')" />
          </ion-item>
          <ion-item lines="full">
            <ion-input type="number" label="ระยะปลูก (เมตร)" labelPlacement="stacked" [value]="spacing()" min="0.5" max="100" step="0.5"
              (ionInput)="spacing.set(+($any($event.detail.value) ?? 0))" />
          </ion-item>

          <div class="corners">
            <span>ปักมุมแล้ว <b>{{ boundary().length }}</b> จุด</span>
            <ion-button size="small" fill="clear" (click)="undo()" [disabled]="!boundary().length"><ion-icon slot="start" name="arrow-undo-outline" />ย้อน</ion-button>
            <ion-button size="small" fill="clear" color="danger" (click)="boundary.set([])" [disabled]="!boundary().length"><ion-icon slot="start" name="trash-outline" />ล้าง</ion-button>
          </div>

          <div class="stats">
            @if (previewing()) { <ion-spinner name="dots" /> }
            @if (layout(); as l) {
              <div class="stat"><span class="v">{{ l.treeCount.toLocaleString('th-TH') }}</span><span class="k">ต้น</span></div>
              <div class="stat"><span class="v">{{ l.rowCount }}</span><span class="k">แถว</span></div>
              <div class="stat wide"><span class="v">{{ l.areaSqm | stRaiNganWa }}</span><span class="k">พื้นที่แปลง ({{ l.areaSqm.toLocaleString('th-TH') }} ตร.ม.)</span></div>
              <div class="stat wide"><span class="v">{{ l.spacingM | stDistance }} × {{ l.spacingM | stDistance }}</span><span class="k">ระยะปลูก · แนวแถว {{ l.angleDeg.toFixed(1) }}°</span></div>
            }
          </div>
          @if (error()) {
            <ion-note color="danger">{{ error() }}</ion-note>
          } @else if (!layout() && boundary().length < 3) {
            <ion-note>ปักมุมแปลงอีก {{ 3 - boundary().length }} จุดเพื่อดูตำแหน่งต้นไม้</ion-note>
          }

          <div class="actions">
            <ion-button fill="outline" (click)="downloadCsv()" [disabled]="!layout()?.treeCount"><ion-icon slot="start" name="download-outline" />CSV</ion-button>
            <ion-button (click)="save()" [disabled]="!canSave()">
              @if (saving()) { <ion-spinner slot="start" name="crescent" /> } @else { <ion-icon slot="start" name="save-outline" /> }
              บันทึกแผน
            </ion-button>
          </div>
          @if (layout() && !name().trim()) {
            <ion-note class="hint">ตั้งชื่อแผนก่อนบันทึก</ion-note>
          }
        </section>
      </div>
    </ion-content>
  `,
  styles: `
    .layout { display: grid; grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr); gap: var(--st-space-4); height: 100%; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; height: auto; } }
    .map { height: min(80vh, 820px); }
    .side { display: flex; flex-direction: column; gap: var(--st-space-2); }
    .howto { display: block; font-size: 0.9em; }
    .corners { display: flex; align-items: center; gap: var(--st-space-1); flex-wrap: wrap; }
    .stats { display: grid; grid-template-columns: 1fr 1fr; gap: var(--st-space-2); min-height: 40px; }
    .stat { background: var(--st-color-surface-alt); border-radius: var(--st-radius); padding: var(--st-space-2) var(--st-space-3); display: flex; flex-direction: column; }
    .stat.wide { grid-column: span 2; }
    .stat .v { font-size: 1.4em; font-weight: 700; color: var(--st-color-primary); }
    .stat .k { color: var(--st-color-text-muted); font-size: 0.85em; }
    .actions { display: flex; justify-content: flex-end; gap: var(--st-space-2); }
    .hint { display: block; text-align: right; font-size: 0.85em; }
  `,
})
export class PlantingPlanNewPage {
  private readonly api = inject(PlantingPlanApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly parcelId = this.route.snapshot.paramMap.get('parcelId') ?? '';

  protected readonly boundary = signal<LngLat[]>([]);
  protected readonly spacing = signal(8);
  protected readonly name = signal('');
  protected readonly layout = signal<PlantingPlanLayoutDto | null>(null);
  protected readonly previewing = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly canSave = computed(
    () => !!this.layout()?.treeCount && !!this.name().trim() && !this.saving() && !this.previewing() && !this.error(),
  );

  constructor() {
    addIcons({ arrowUndoOutline, downloadOutline, saveOutline, trashOutline });
    const input = computed(() => ({ boundary: this.boundary(), spacingM: this.spacing() }));
    toObservable(input)
      .pipe(
        debounceTime(PREVIEW_DEBOUNCE_MS),
        switchMap(({ boundary, spacingM }) => {
          if (boundary.length < 3 || !(spacingM >= 0.5 && spacingM <= 100)) {
            this.error.set(boundary.length >= 3 ? 'ระยะปลูกต้องอยู่ระหว่าง 0.5–100 เมตร' : null);
            return of(null);
          }
          this.previewing.set(true);
          return this.api.preview(this.parcelId, { boundary, spacingM }).pipe(
            catchError((e: unknown) => {
              this.error.set(apiErrorMessage(e));
              return of(null);
            }),
            finalize(() => this.previewing.set(false)),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((l) => {
        if (l) this.error.set(null);
        this.layout.set(l);
      });
  }

  protected addCorner(p: LngLat): void {
    this.boundary.update((b) => [...b, p]);
  }

  protected undo(): void {
    this.boundary.update((b) => b.slice(0, -1));
  }

  protected downloadCsv(): void {
    const l = this.layout();
    if (l) downloadText(plantingCsv(l.trees), `planting-plan-${(this.name().trim() || 'draft').replace(/\s+/g, '-')}.csv`);
  }

  protected async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const plan = await firstValueFrom(
        this.api.create(this.parcelId, { name: this.name().trim(), boundary: this.boundary(), spacingM: this.spacing() }),
      );
      await this.router.navigate(['..', plan.id], { relativeTo: this.route, replaceUrl: true });
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }
}
