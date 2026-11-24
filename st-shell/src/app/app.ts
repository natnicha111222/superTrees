// layout หลัก: เมนูด้านข้าง (split pane บนจอกว้าง) + outlet ที่โหลดหน้าจาก remote
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonApp,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonMenu,
  IonMenuToggle,
  IonNote,
  IonRouterOutlet,
  IonSplitPane,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { leafOutline, mapOutline, pricetagsOutline } from 'ionicons/icons';

interface MenuItem {
  label: string;
  url: string;
  icon: string;
}

@Component({
  selector: 'st-root',
  imports: [
    RouterLink,
    RouterLinkActive,
    IonApp,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonMenu,
    IonMenuToggle,
    IonNote,
    IonRouterOutlet,
    IonSplitPane,
    IonTitle,
    IonToolbar,
  ],
  template: `
    <ion-app>
      <ion-split-pane contentId="main-content" when="lg">
        <ion-menu contentId="main-content" type="overlay">
          <ion-header>
            <ion-toolbar>
              <ion-title class="brand">superTrees</ion-title>
            </ion-toolbar>
          </ion-header>
          <ion-content>
            <ion-list lines="none">
              @for (m of menu; track m.url) {
                <ion-menu-toggle [autoHide]="false">
                  <ion-item [routerLink]="m.url" routerLinkActive="active" routerDirection="root" detail="false" button>
                    <ion-icon slot="start" [name]="m.icon" />
                    <ion-label>{{ m.label }}</ion-label>
                  </ion-item>
                </ion-menu-toggle>
              }
            </ion-list>
            <ion-note class="ver">PoC · เว็บ</ion-note>
          </ion-content>
        </ion-menu>
        <ion-router-outlet id="main-content" />
      </ion-split-pane>
    </ion-app>
  `,
  styles: `
    .brand { color: var(--st-color-primary); font-weight: 700; }
    ion-item.active { --color: var(--st-color-primary); font-weight: 700; }
    ion-item.active ion-icon { color: var(--st-color-primary); }
    .ver { display: block; padding: var(--st-space-4); }
  `,
})
export class App {
  protected readonly menu: MenuItem[] = [
    { label: 'แผนที่แปลง', url: '/map', icon: 'map-outline' },
    { label: 'ประกาศขาย', url: '/listings', icon: 'pricetags-outline' },
    { label: 'สวน / นับต้นไม้', url: '/garden', icon: 'leaf-outline' },
  ];

  constructor() {
    addIcons({ leafOutline, mapOutline, pricetagsOutline });
  }
}
