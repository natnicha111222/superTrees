// รายการผลการนับต้นไม้ของแปลง
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonMenuButton,
  IonNote,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addOutline, leafOutline } from 'ionicons/icons';
import { map } from 'rxjs';
import { StThaiDatePipe, apiErrorMessage } from '@supertrees/shared-ui';
import { GardenTabsComponent } from '../components/garden-tabs.component';
import { TreeSurveyApi } from '../services/tree-survey-api.service';

@Component({
  selector: 'st-tree-survey-list-page',
  imports: [
    RouterLink,
    GardenTabsComponent,
    StThaiDatePipe,
    IonBadge,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonMenuButton,
    IonNote,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start"><ion-menu-button /></ion-buttons>
        <ion-title>นับต้นไม้จากภาพมุมสูง</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <st-garden-tabs active="surveys" />
      <div class="head">
        <ion-note>แปลง {{ parcelId() }} <span class="mock">(แปลงทดลอง)</span></ion-note>
        <ion-button [routerLink]="['new']">
          <ion-icon slot="start" name="add-outline" />
          นับจากภาพใหม่
        </ion-button>
      </div>

      @if (surveys.isLoading()) {
        <div class="center"><ion-spinner /></div>
      } @else if (surveys.error()) {
        <ion-note color="danger">{{ errorText() }}</ion-note>
      } @else if (surveys.value()?.items?.length) {
        <ion-list lines="full">
          @for (s of surveys.value()!.items; track s.id) {
            <ion-item [routerLink]="[s.id]" detail>
              <ion-icon slot="start" name="leaf-outline" color="primary" />
              <ion-label>
                <h2>{{ s.treeCount.toLocaleString('th-TH') }} ต้น</h2>
                <p>{{ s.createdAt | stThaiDate }}</p>
              </ion-label>
              @if (s.scaleIsEstimate) {
                <ion-badge slot="end" color="warning">ระยะโดยประมาณ</ion-badge>
              } @else if (s.scaleSource === 'georef') {
                <ion-badge slot="end" color="success">ผูกแผนที่แล้ว</ion-badge>
              }
            </ion-item>
          }
        </ion-list>
        <ion-note>ทั้งหมด {{ surveys.value()!.totalItems }} รายการ</ion-note>
      } @else {
        <div class="center empty">
          <ion-icon name="leaf-outline" color="medium" />
          <p>ยังไม่มีผลการนับ — อัปโหลดภาพถ่ายมุมสูงของแปลงเพื่อเริ่ม</p>
        </div>
      }
    </ion-content>
  `,
  styles: `
    .head { display: flex; align-items: center; justify-content: space-between; gap: var(--st-space-2); flex-wrap: wrap; margin-bottom: var(--st-space-3); }
    .mock { color: var(--st-color-text-muted); }
    .center { display: flex; flex-direction: column; align-items: center; padding: var(--st-space-6); text-align: center; }
    .empty ion-icon { font-size: 48px; }
  `,
})
export class TreeSurveyListPage {
  private readonly api = inject(TreeSurveyApi);
  protected readonly parcelId = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('parcelId') ?? '')), {
    initialValue: '',
  });

  protected readonly surveys = rxResource({
    params: () => ({ parcelId: this.parcelId() }),
    stream: ({ params }) => this.api.list(params.parcelId),
  });
  protected readonly errorText = computed(() => apiErrorMessage(this.surveys.error()));

  constructor() {
    addIcons({ addOutline, leafOutline });
  }
}
