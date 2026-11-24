import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonButtons, IonContent, IonHeader, IonMenuButton, IonNote, IonTitle, IonToolbar } from '@ionic/angular';

@Component({
  selector: 'st-remote-error-page',
  imports: [IonButtons, IonContent, IonHeader, IonMenuButton, IonNote, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start"><ion-menu-button /></ion-buttons>
        <ion-title>โหลดหน้านี้ไม่ได้</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <p>ส่วน <b>{{ remote }}</b> ยังไม่พร้อมใช้งาน ลองใหม่อีกครั้งภายหลัง</p>
      <ion-note>นักพัฒนา: ตรวจว่ารัน <code>npm run dev:frontend</code> ใน st-infra แล้ว และที่อยู่ใน federation.manifest.json ถูกต้อง</ion-note>
    </ion-content>
  `,
})
export class RemoteErrorPage {
  protected readonly remote = inject(ActivatedRoute).snapshot.data['remote'] as string;
}
