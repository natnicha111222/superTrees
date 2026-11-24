// ใช้ตอนรัน remote เดี่ยว (ng serve ที่ 4203) — ตอนรันจริง shell โหลด exposed/routes.ts เอง
import type { Routes } from '@angular/router';
import { routes as exposed } from './exposed/routes';

export const routes: Routes = exposed;
