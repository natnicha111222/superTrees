// placeholder — หน้าจริงมาใน TASK-004
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonButtons, IonContent, IonHeader, IonIcon, IonMenuButton, IonNote, IonTitle, IonToolbar } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { mapOutline } from 'ionicons/icons';

@Component({
  selector: 'st-home-page',
  imports: [IonButtons, IonContent, IonHeader, IonIcon, IonMenuButton, IonNote, IonTitle, IonToolbar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start"><ion-menu-button /></ion-buttons>
        <ion-title>แผนที่แปลงที่ดิน</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="placeholder">
        <ion-icon name="map-outline" color="primary" />
        <h2>แผนที่แปลงที่ดิน</h2>
        <ion-note>ยังไม่เปิดใช้ — TASK-004 — วาดแปลง วัดพื้นที่/ระยะ บนแผนที่</ion-note>
      </div>
    </ion-content>
  `,
  styles: `
    .placeholder { display: flex; flex-direction: column; align-items: center; text-align: center; padding: var(--st-space-6); gap: var(--st-space-2); }
    .placeholder ion-icon { font-size: 64px; }
  `,
})
export class HomePage {
  constructor() {
    addIcons({ mapOutline });
  }
}
