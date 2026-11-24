import { provideHttpClient, withFetch } from '@angular/common/http';
import { type ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { RuntimeConfigService } from '@supertrees/shared-ui';
import { routes } from './app.routes';

// ตอนรันเดี่ยวเท่านั้น — ใน shell ใช้ provider ของ shell
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideIonicAngular({ mode: 'md' }),
    provideHttpClient(withFetch()),
    provideRouter(routes),
    provideAppInitializer(() => inject(RuntimeConfigService).load()),
  ],
};
