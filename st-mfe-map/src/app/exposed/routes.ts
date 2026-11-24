// expose ผ่าน federation เป็น './routes' — shell โหลดด้วย loadRemoteModule('mfe-map', './routes')
import type { Routes } from '@angular/router';

export const routes: Routes = [{ path: '', loadComponent: () => import('../pages/home.page').then((m) => m.HomePage) }];
