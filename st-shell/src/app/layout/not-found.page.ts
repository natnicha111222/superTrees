import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonButtons, IonContent, IonHeader, IonMenuButton, IonTitle, IonToolbar } from '@ionic/angular';

@Component({
  selector: 'st-not-found-page',
  imports: [RouterLink, IonButton, IonButtons, IonContent, IonHeader, IonMenuButton, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start"><ion-menu-button /></ion-buttons>
        <ion-title>ไม่พบหน้า</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <p>ไม่พบหน้าที่ต้องการ</p>
      <ion-button routerLink="/">กลับหน้าแรก</ion-button>
    </ion-content>
  `,
})
export class NotFoundPage {}
