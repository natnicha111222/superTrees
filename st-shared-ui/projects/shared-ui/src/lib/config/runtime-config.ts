// runtime config ของหน้าบ้าน — base URL ของ API มาจากไฟล์ตอนรัน ไม่ hardcode host (CLAUDE.md)
// shell โหลด `config.json` ตอนเริ่มแอป · remote อ่านผ่าน RuntimeConfigService (singleton ที่ share ผ่าน federation)
import { Injectable, signal } from '@angular/core';

export interface StRuntimeConfig {
  /** เช่น http://localhost:8000 (Kong) — ไม่มี / ท้าย */
  apiBaseUrl: string;
  /** MOCK-003: แปลงทดลองจนกว่าจะมีแปลงจริง (TASK-004) */
  demoParcelId?: string;
  /** แผนที่ (CONF-006) — แหล่ง tile อยู่ใน config เพื่อเปลี่ยนผู้ให้บริการได้โดยไม่ build ใหม่ */
  map?: StMapConfig;
}

export interface StRasterTileSource {
  /** URL แบบ {z}/{x}/{y} */
  url: string;
  attribution: string;
  maxZoom?: number;
}

export interface StMapConfig {
  /** ภาพดาวเทียม — ใช้ปักจุดอ้างอิง/ดูแปลง */
  satellite: StRasterTileSource;
  /** ชั้นชื่อสถานที่/ขอบเขตซ้อนบนภาพดาวเทียม (ไม่บังคับ) */
  labels?: StRasterTileSource;
  /** จุดเริ่มต้นของแผนที่ [lng, lat] + ซูม */
  initialCenter?: [number, number];
  initialZoom?: number;
}

@Injectable({ providedIn: 'root' })
export class RuntimeConfigService {
  private readonly state = signal<StRuntimeConfig | null>(null);
  readonly config = this.state.asReadonly();

  /** เรียกครั้งเดียวจาก shell (provideAppInitializer) */
  async load(url = 'config.json'): Promise<void> {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`โหลด ${url} ไม่ได้ (${res.status})`);
    this.state.set((await res.json()) as StRuntimeConfig);
  }

  set(config: StRuntimeConfig): void {
    this.state.set(config);
  }

  /** apiUrl('/api/v1/gardens/...') */
  apiUrl(path: string): string {
    const c = this.state();
    if (!c) throw new Error('ยังไม่ได้โหลด runtime config');
    return `${c.apiBaseUrl.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  }
}
