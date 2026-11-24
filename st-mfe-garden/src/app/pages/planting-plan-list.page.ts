// รายการแผนปลูกของแปลง
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
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
import { addOutline, gridOutline } from 'ionicons/icons';
import { map } from 'rxjs';
import { StRaiNganWaPipe, StThaiDatePipe, apiErrorMessage } from '@supertrees/shared-ui';
import { GardenTabsComponent } from '../components/garden-tabs.component';
import { PlantingPlanApi } from '../services/planting-plan-api.service';

@Component({
  selector: 'st-planting-plan-list-page',
  imports: [
    RouterLink,
    GardenTabsComponent,
    StRaiNganWaPipe,
    StThaiDatePipe,
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
        <ion-title>วางแผนปลูก</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <st-garden-tabs active="plans" />
      <div class="head">
        <ion-note>ปักขอบเขตแปลงบนแผนที่ + ระยะปลูก → ได้ตำแหน่งต้นไม้ (ละติจูด/ลองจิจูด) สำหรับปักหมุดก่อนปลูก</ion-note>
        <ion-button [routerLink]="['new']"><ion-icon slot="start" name="add-outline" />วางแผนใหม่</ion-button>
      </div>
      @if (plans.isLoading()) {
        <div class="center"><ion-spinner /></div>
      } @else if (plans.error()) {
        <ion-note color="danger">{{ errorText() }}</ion-note>
      } @else if (plans.value()?.items?.length) {
        <ion-list lines="full">
          @for (p of plans.value()!.items; track p.id) {
            <ion-item [routerLink]="[p.id]" detail>
              <ion-icon slot="start" name="grid-outline" color="primary" />
              <ion-label>
                <h2>{{ p.name }}</h2>
                <p>{{ p.treeCount.toLocaleString('th-TH') }} ต้น · ระยะ {{ p.spacingM }} ม. · {{ p.areaSqm | stRaiNganWa }}</p>
                <p>{{ p.createdAt | stThaiDate }}</p>
              </ion-label>
            </ion-item>
          }
        </ion-list>
      } @else {
        <div class="center empty">
          <ion-icon name="grid-outline" color="medium" />
          <p>ยังไม่มีแผนปลูก</p>
        </div>
      }
    </ion-content>
  `,
  styles: `
    .head { display: flex; align-items: center; justify-content: space-between; gap: var(--st-space-2); flex-wrap: wrap; margin-bottom: var(--st-space-3); }
    .center { display: flex; flex-direction: column; align-items: center; padding: var(--st-space-6); text-align: center; }
    .empty ion-icon { font-size: 48px; }
  `,
})
export class PlantingPlanListPage {
  private readonly api = inject(PlantingPlanApi);
  protected readonly parcelId = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('parcelId') ?? '')), { initialValue: '' });
  protected readonly plans = rxResource({
    params: () => ({ parcelId: this.parcelId() }),
    stream: ({ params }) => this.api.list(params.parcelId),
  });
  protected readonly errorText = computed(() => apiErrorMessage(this.plans.error()));

  constructor() {
    addIcons({ addOutline, gridOutline });
  }
}
