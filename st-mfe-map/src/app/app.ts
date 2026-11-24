// root ตอนรัน remote เดี่ยวเท่านั้น (shell ไม่ได้ใช้ component นี้)
import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';

@Component({
  selector: 'st-root',
  imports: [IonApp, IonRouterOutlet],
  template: `<ion-app><ion-router-outlet /></ion-app>`,
})
export class App {}
