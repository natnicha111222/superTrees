import { provideHttpClient, withFetch } from '@angular/common/http';
import { type ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { RuntimeConfigService } from '@supertrees/shared-ui';
import { routes } from './app.routes';

// provider ของทั้งแอป — remote ใช้ร่วม (HttpClient, RuntimeConfigService เป็น singleton ผ่าน federation)
// ⏳ TASK-003: interceptor แนบ Authorization เฉพาะเส้น /api/ + session จาก Supabase Auth
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideIonicAngular({ mode: 'md' }),
    provideHttpClient(withFetch()),
    provideRouter(routes, withComponentInputBinding()),
    // base URL ของ API มาจาก public/config.json ตอนรัน (ไม่ hardcode host — CLAUDE.md)
    provideAppInitializer(() => inject(RuntimeConfigService).load()),
  ],
};
