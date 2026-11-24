// แต่ละโดเมนมาจาก remote ของตัวเอง — ที่อยู่ของ remote อยู่ใน public/federation.manifest.json (ต่อ environment)
import type { Routes } from '@angular/router';
import { loadRemoteModule } from '@angular-architects/native-federation';

/** โหลด routes ของ remote · ถ้า remote ล่ม/ไม่ได้รัน → หน้าแจ้งแทนการพังทั้งแอป */
function remote(name: string) {
  return () =>
    loadRemoteModule(name, './routes')
      .then((m) => m.routes as Routes)
      .catch((err: unknown) => {
        console.error(`[shell] โหลด remote ${name} ไม่ได้`, err);
        return [
          {
            path: '**',
            loadComponent: () => import('./layout/remote-error.page').then((p) => p.RemoteErrorPage),
            data: { remote: name },
          },
        ] satisfies Routes;
      });
}

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'garden' },
  { path: 'map', loadChildren: remote('mfe-map') },
  { path: 'listings', loadChildren: remote('mfe-listing') },
  { path: 'garden', loadChildren: remote('mfe-garden') },
  { path: '**', loadComponent: () => import('./layout/not-found.page').then((p) => p.NotFoundPage) },
];
