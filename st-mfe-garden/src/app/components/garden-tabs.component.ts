// สลับระหว่างฟีเจอร์ของแปลง: นับต้นไม้จากภาพ / วางแผนปลูก / เทียบแผนกับผลนับ
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon, IonLabel, IonSegment, IonSegmentButton } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { gitCompareOutline, gridOutline, imageOutline } from 'ionicons/icons';

@Component({
  selector: 'st-garden-tabs',
  imports: [RouterLink, IonIcon, IonLabel, IonSegment, IonSegmentButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-segment [value]="active()">
      <ion-segment-button value="surveys" [routerLink]="['../tree-surveys']" routerDirection="root">
        <ion-icon name="image-outline" /><ion-label>นับต้นไม้จากภาพ</ion-label>
      </ion-segment-button>
      <ion-segment-button value="plans" [routerLink]="['../planting-plans']" routerDirection="root">
        <ion-icon name="grid-outline" /><ion-label>วางแผนปลูก</ion-label>
      </ion-segment-button>
      <ion-segment-button value="compare" [routerLink]="['../compare']" routerDirection="root">
        <ion-icon name="git-compare-outline" /><ion-label>เทียบแผนกับผลนับ</ion-label>
      </ion-segment-button>
    </ion-segment>
  `,
  styles: `ion-segment { max-width: 760px; margin-bottom: var(--st-space-3); }`,
})
export class GardenTabsComponent {
  readonly active = input.required<'surveys' | 'plans' | 'compare'>();

  constructor() {
    addIcons({ gitCompareOutline, gridOutline, imageOutline });
  }
}
