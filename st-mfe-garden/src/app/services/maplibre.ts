// ตั้งค่า MapLibre GL ร่วมกันใน remote นี้ (CONF-006)
// - CSS + worker เป็น asset ของ remote (angular.json) อ้างจาก origin ของ remote เอง:
//   ตอนอยู่ใน shell ไม่มี global style ของ remote และ federation รวม package จน worker หาไฟล์ตัวเองไม่เจอ
// - แหล่ง tile มาจาก runtime config (ห้าม hardcode) · สีมาจาก token --st-viz-* (ห้ามใส่รหัสสีเอง)
import type { LngLat } from '@supertrees/contracts';
import type { StMapConfig } from '@supertrees/shared-ui';
import type { StyleSpecification } from 'maplibre-gl';
import { parseLatLngText } from './image-prep';

export type MapLibre = typeof import('maplibre-gl');

/** ค่าเริ่มต้นถ้า runtime config ไม่มี initialCenter — กลางประเทศไทย */
export const THAILAND_CENTER: LngLat = [100.99, 13.4];

function assetUrl(file: string): string {
  const base = import.meta.url;
  return new URL(file, base).href;
}

let loaded: Promise<MapLibre> | null = null;

/** โหลดไลบรารีเมื่อใช้ครั้งแรก + CSS + worker */
export function loadMaplibre(): Promise<MapLibre> {
  if (!document.getElementById('st-maplibre-css')) {
    document.head.appendChild(
      Object.assign(document.createElement('link'), { id: 'st-maplibre-css', rel: 'stylesheet', href: assetUrl('maplibre-gl.css') }),
    );
  }
  loaded ??= import('maplibre-gl').then((m) => {
    m.setWorkerUrl(assetUrl('maplibre-gl-worker.mjs'));
    return m;
  });
  return loaded;
}

export function rasterStyle(cfg: StMapConfig): StyleSpecification {
  const style: StyleSpecification = {
    version: 8,
    sources: {
      satellite: {
        type: 'raster',
        tiles: [cfg.satellite.url],
        tileSize: 256,
        maxzoom: cfg.satellite.maxZoom ?? 19,
        attribution: cfg.satellite.attribution,
      },
    },
    layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }],
  };
  if (cfg.labels) {
    style.sources['labels'] = {
      type: 'raster',
      tiles: [cfg.labels.url],
      tileSize: 256,
      maxzoom: cfg.labels.maxZoom ?? 19,
      attribution: cfg.labels.attribution,
    };
    style.layers.push({ id: 'labels', type: 'raster', source: 'labels' });
  }
  return style;
}

/** ค่าสีจาก token ของ theme (MapLibre ต้องการสีเป็นข้อความ ใช้ var() ตรง ๆ ไม่ได้) */
export function themeColor(el: Element, token: string): string {
  return getComputedStyle(el).getPropertyValue(token).trim();
}

/** "ละติจูด, ลองจิจูด" → [lng, lat] หรือ null */
export const parseLatLng = parseLatLngText;

/** ขอ GPS เฉพาะเมื่อผู้ใช้กดเอง · ใช้แค่เลื่อนแผนที่ ไม่ส่ง/ไม่เก็บ (CODE_STANDARDS 13) */
export function currentPosition(): Promise<LngLat> {
  return new Promise((ok, fail) => {
    if (!navigator.geolocation) return fail(new Error('อุปกรณ์ไม่รองรับการระบุตำแหน่ง'));
    navigator.geolocation.getCurrentPosition(
      (pos) => ok([pos.coords.longitude, pos.coords.latitude]),
      () => fail(new Error('ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง หรืออุปกรณ์ไม่รองรับ')),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}
