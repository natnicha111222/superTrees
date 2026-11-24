// เทสต์ระดับ HTTP ของ /tree-surveys ด้วย repository/storage จำลอง (ไม่ต้องมี DB / Supabase)
import { describe, expect, test } from 'bun:test';
import type { TreeSurveyDto } from '@supertrees/contracts';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import type { TreeSurveyRepository, TreeSurveyRow, TreeSurveyTreeRow } from '../src/repositories/tree-survey.repository';
import type { PhotoStorage } from '../src/repositories/photo-storage.repository';
import { createTreeSurveyService } from '../src/services/tree-survey.service';
import type { GrayImage } from '../src/services/tree-grid';

const USER = '00000000-0000-4000-8000-000000000001';
const PARCEL = '11111111-1111-4111-8111-111111111111';
const env = {
  DATABASE_URL: 'postgres://x',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'test-only',
};

/** ภาพจำลอง 6×5 ต้น ระยะ 40 px */
function fakeImage(): GrayImage {
  const w = 400, h = 320;
  const data = new Uint8Array(w * h).fill(200);
  for (let j = 0; j < 5; j++) for (let i = 0; i < 6; i++) {
    const cx = 80 + i * 40, cy = 70 + j * 40;
    for (let y = cy - 6; y <= cy + 6; y++) for (let x = cx - 6; x <= cx + 6; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= 36) data[y * w + x] = 40;
    }
  }
  return { width: w, height: h, data };
}

function setup(authMode: 'disabled' | 'dev-fixed-user' = 'dev-fixed-user') {
  const config = loadConfig({ ...env, AUTH_MODE: authMode });
  const surveys: TreeSurveyRow[] = [];
  const trees: (TreeSurveyTreeRow)[] = [];
  const published: string[] = [];
  const files = new Set<string>();

  const repo: TreeSurveyRepository = {
    transaction: (fn) => fn({} as never),
    insertSurvey: async (_tx, row) => {
      const r = { ...row, id: crypto.randomUUID(), createdAt: new Date() } as TreeSurveyRow;
      surveys.push(r);
      return r;
    },
    insertTrees: async (_tx, rows) => { trees.push(...(rows as TreeSurveyTreeRow[])); },
    listByOwnerAndParcel: async (owner, parcel, page, size) => {
      const all = surveys.filter((s) => s.ownerId === owner && s.parcelId === parcel);
      return { items: all.slice((page - 1) * size, page * size), totalItems: all.length };
    },
    findById: async (id) => surveys.find((s) => s.id === id),
    findByIdForUpdate: async (_tx, id) => surveys.find((s) => s.id === id),
    updateSurvey: async (_tx, id, patch) => {
      const r = surveys.find((s) => s.id === id)!;
      Object.assign(r, patch);
      return r;
    },
    deleteTrees: async (_tx, id) => {
      for (let i = trees.length - 1; i >= 0; i--) if (trees[i]!.surveyId === id) trees.splice(i, 1);
    },
    findTrees: async (id) => trees.filter((t) => t.surveyId === id),
  };
  const storage: PhotoStorage = {
    createUploadUrl: async (p) => `http://storage/upload/${p}?token=t`,
    download: async (p) => (files.has(p) ? new Uint8Array([1]) : null),
    createDownloadUrl: async (p) => `http://storage/sign/${p}`,
  };
  const service = createTreeSurveyService({
    repo,
    storage,
    events: { publish: async (k) => { published.push(k); }, close: async () => {} },
    decode: async () => fakeImage(),
    imageSize: async () => ({ width: 400, height: 320 }),
  });
  const app = createApp({
    config,
    health: { check: async () => ({ service: 't', status: 'ok', time: '', checks: {} }) },
    treeSurveys: service,
    plantingPlans: {} as never, // ไม่ใช้ในไฟล์นี้ (ดู planting-plan.api.test.ts)
  });
  const call = (method: string, path: string, body?: unknown) =>
    app.request(`/api/v1/gardens/${PARCEL}/tree-surveys${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return { call, files, published, app, surveys };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = async (r: Response): Promise<any> => r.json();

const boundary = [[50, 40], [320, 40], [320, 260], [50, 260]];

describe('tree-surveys API', () => {
  test('AUTH_MODE=disabled → 503 AUTH_NOT_CONFIGURED', async () => {
    const res = await setup('disabled').call('GET', '');
    expect(res.status).toBe(503);
    expect((await json(res)).code).toBe('AUTH_NOT_CONFIGURED');
  });

  test('dev-fixed-user ใช้นอก APP_ENV=local ไม่ได้', () => {
    expect(() => loadConfig({ ...env, APP_ENV: 'uat', AUTH_MODE: 'dev-fixed-user' })).toThrow();
  });

  test('upload-url → create (ระยะปลูกสมมติ) → list → get', async () => {
    const { call, files, published } = setup();

    const up = await call('POST', '/upload-url', { contentType: 'image/jpeg', sizeBytes: 1000 });
    expect(up.status).toBe(201);
    const { objectPath, uploadUrl } = await json(up);
    expect(objectPath.startsWith(`${USER}/${PARCEL}/`)).toBe(true);
    expect(uploadUrl).toContain(objectPath);

    // ยังไม่อัปโหลด → 404
    const missing = await call('POST', '', { objectPath, boundaryPx: boundary, assumedSpacingM: 4 });
    expect(missing.status).toBe(404);

    files.add(objectPath);
    const created = await call('POST', '', { objectPath, boundaryPx: boundary, assumedSpacingM: 4 });
    expect(created.status).toBe(201);
    const dto = (await created.json()) as TreeSurveyDto;
    expect(dto.treeCount).toBe(30);
    expect(dto.stats.rowCount).toBe(5);
    expect(dto.scaleIsEstimate).toBe(true);
    expect(dto.stats.meanNearestDistanceM).toBeCloseTo(4, 1);
    expect(dto.trees[0]!.treeId).toBe('T_001');
    expect(dto.trees[0]!.lngLat).toBeNull();
    expect(published).toContain('garden.tree-survey.completed');

    const list = await json(await call('GET', '?page=1&size=10'));
    expect(list).toMatchObject({ page: 1, size: 10, totalItems: 1 });

    const got = await call('GET', `/${dto.id}`);
    expect(got.status).toBe(200);
    expect(((await got.json()) as TreeSurveyDto).trees).toHaveLength(30);
  });

  test('ผูกแผนที่ด้วยจุดคู่ → ต้นไม้มี lngLat', async () => {
    const { call, files } = setup();
    const { objectPath } = await json(await call('POST', '/upload-url', { contentType: 'image/png', sizeBytes: 10 }));
    files.add(objectPath);
    // 0.1 ม./px ไม่หมุน — มุมภาพที่ประมาณ 100.5E 13.75N
    const m = 0.1 / 111_000;
    const cp = (x: number, y: number) => ({ pixel: [x, y], lngLat: [100.5 + x * m * 1.03, 13.75 - y * m] });
    const res = await call('POST', '', { objectPath, boundaryPx: boundary, controlPoints: [cp(0, 0), cp(400, 0), cp(400, 320), cp(0, 320)] });
    expect(res.status).toBe(201);
    const dto = (await res.json()) as TreeSurveyDto;
    expect(dto.scaleSource).toBe('georef');
    expect(dto.stats.georef?.epsg).toBe(32647);
    expect(dto.trees.every((t) => t.lngLat !== null)).toBe(true);
    expect(dto.stats.meanNearestDistanceM!).toBeGreaterThan(3.5);
    expect(dto.stats.meanNearestDistanceM!).toBeLessThan(4.5);
  });

  test('ใช้ไฟล์ของคนอื่น → 403 · body ผิด → 400 · ส่งทั้งสองแบบมาตราส่วน → 400', async () => {
    const { call } = setup();
    const other = `22222222-2222-4222-8222-222222222222/${PARCEL}/33333333-3333-4333-8333-333333333333.jpg`;
    expect((await call('POST', '', { objectPath: other, boundaryPx: boundary })).status).toBe(403);

    const bad = await call('POST', '', { objectPath: 'x', boundaryPx: [[1, 2]] });
    expect(bad.status).toBe(400);
    expect((await json(bad)).code).toBe('VALIDATION_ERROR');

    const p = `${USER}/${PARCEL}/33333333-3333-4333-8333-333333333333.jpg`;
    const both = await call('POST', '', {
      objectPath: p,
      boundaryPx: boundary,
      assumedSpacingM: 4,
      controlPoints: [{ pixel: [0, 0], lngLat: [100, 13] }, { pixel: [1, 0], lngLat: [100, 13] }, { pixel: [0, 1], lngLat: [100, 13] }],
    });
    expect(both.status).toBe(400);

    // ฟิลด์เกิน (เช่นพยายามส่ง ownerId เอง) → 400
    const extra = await call('POST', '/upload-url', { contentType: 'image/jpeg', sizeBytes: 10, ownerId: 'x' });
    expect(extra.status).toBe(400);
  });

  test('parcelId ไม่ใช่ uuid → 400 · ไฟล์ใหญ่เกิน → 400', async () => {
    const { app, call } = setup();
    expect((await app.request('/api/v1/gardens/abc/tree-surveys')).status).toBe(400);
    expect((await call('POST', '/upload-url', { contentType: 'image/jpeg', sizeBytes: 50 * 1024 * 1024 })).status).toBe(400);
  });
});

describe('แก้ไขผล (preview / PUT)', () => {
  async function created(setupResult: ReturnType<typeof setup>) {
    const { call, files } = setupResult;
    const { objectPath } = await json(await call('POST', '/upload-url', { contentType: 'image/jpeg', sizeBytes: 10 }));
    files.add(objectPath);
    return (await json(await call('POST', '', { objectPath, boundaryPx: boundary, assumedSpacingM: 4 }))) as TreeSurveyDto;
  }

  test('preview: ลบ 2 จุด + เลื่อนกริด → คำนวณใหม่ ไม่บันทึก', async () => {
    const s = setup();
    const dto = await created(s);
    expect(dto.stats.grid).not.toBeNull();
    expect(dto.stats.edited).toBe(false);
    const points = dto.trees.slice(2).map((t) => t.pixel);
    const res = await s.call('POST', `/${dto.id}/preview`, { points, grid: { ...dto.stats.grid, originX: dto.stats.grid!.originX + 2 } });
    expect(res.status).toBe(200);
    const p = await json(res);
    expect(p.stats.treeCount).toBe(28);
    expect(p.stats.edited).toBe(true);
    expect(p.stats.grid.originX).toBeCloseTo(dto.stats.grid!.originX + 2, 1);
    expect(p.addedCount).toBe(0);
    // ยังไม่บันทึก
    expect((await json(await s.call('GET', `/${dto.id}`))).treeCount).toBe(30);
  });

  test('preview fillGaps: ต้นที่ลบออกถูกเติมกลับที่จุดตัดกริด', async () => {
    const s = setup();
    const dto = await created(s);
    const points = dto.trees.filter((t) => t.orderNum !== 8 && t.orderNum !== 15).map((t) => t.pixel);
    const p = await json(await s.call('POST', `/${dto.id}/preview`, { points, grid: dto.stats.grid, fillGaps: true }));
    expect(p.addedCount).toBe(2);
    expect(p.stats.treeCount).toBe(30);
  });

  test('PUT: บันทึก → ต้นไม้ถูกแทนที่, updatedAt, ระยะประมาณคิดจากระยะช่องตาราง, publish event', async () => {
    const s = setup();
    const dto = await created(s);
    const points = [...dto.trees.map((t) => t.pixel), [395, 315]];
    const res = await s.call('PUT', `/${dto.id}`, { points, grid: { ...dto.stats.grid, spacingPx: dto.stats.grid!.spacingPx * 2 } });
    expect(res.status).toBe(200);
    const u = (await json(res)) as TreeSurveyDto;
    expect(u.treeCount).toBe(31);
    expect(u.trees).toHaveLength(31);
    expect(u.updatedAt).not.toBeNull();
    expect(u.stats.edited).toBe(true);
    expect(u.stats.metersPerPixel!).toBeCloseTo(4 / (dto.stats.grid!.spacingPx * 2), 4);
    expect(s.published).toContain('garden.tree-survey.updated');
    expect((await json(await s.call('GET', `/${dto.id}`))).treeCount).toBe(31);
  });

  test('จุดนอกภาพ → 400 · เหลือต้นเดียว → 422 · ฟิลด์เกิน → 400 · id ของคนอื่น/ไม่มี → 404', async () => {
    const s = setup();
    const dto = await created(s);
    expect((await json(await s.call('POST', `/${dto.id}/preview`, { points: [[10, 10], [5000, 5]] }))).code).toBe('VALIDATION_ERROR');
    expect((await json(await s.call('POST', `/${dto.id}/preview`, { points: [[10, 10], [500, 5]] }))).code).toBe('POINT_OUT_OF_IMAGE');
    const one = await s.call('PUT', `/${dto.id}`, { points: [[10, 10]] });
    expect(one.status).toBe(422);
    expect((await s.call('PUT', `/${dto.id}`, { points: [], ownerId: 'x' })).status).toBe(400);
    expect((await s.call('PUT', '/33333333-3333-4333-8333-333333333333', { points: [[1, 1], [2, 2]] })).status).toBe(404);
  });
});

describe('วิเคราะห์ → ตรวจ/แก้ → ตั้งชื่อ → บันทึก (flow ใหม่)', () => {
  test('analyze ไม่บันทึก · draft preview · create พร้อม result + name · PUT เปลี่ยนชื่อ', async () => {
    const s = setup();
    const { objectPath } = await json(await s.call('POST', '/upload-url', { contentType: 'image/jpeg', sizeBytes: 10 }));
    s.files.add(objectPath);

    const ar = await s.call('POST', '/analyze', { objectPath, boundaryPx: boundary, assumedSpacingM: 4 });
    expect(ar.status).toBe(200);
    const a = await json(ar);
    expect(a.trees).toHaveLength(30);
    expect([a.imageWidth, a.imageHeight]).toEqual([400, 320]);
    expect(a.stats.edited).toBe(false);
    expect(s.surveys).toHaveLength(0); // ยังไม่บันทึก
    expect(s.published).toHaveLength(0);

    // ร่าง: ลบ 1 ต้นแล้วพรีวิว
    const points = a.trees.slice(1).map((t: { pixel: number[] }) => t.pixel);
    const pr = await s.call('POST', '/preview', {
      imageWidth: 400, imageHeight: 320, boundaryPx: boundary, assumedSpacingM: 4,
      detectionMethod: a.stats.detectionMethod, points, grid: a.stats.grid,
    });
    expect(pr.status).toBe(200);
    expect((await json(pr)).stats.treeCount).toBe(29);
    expect(s.surveys).toHaveLength(0);

    // บันทึกผลที่แก้ + ชื่อ — ไม่ตรวจจับใหม่
    const cr = await s.call('POST', '', {
      objectPath, boundaryPx: boundary, assumedSpacingM: 4, name: '  แปลงหลังบ้าน รอบ 1 ',
      result: { points, grid: a.stats.grid, detectionMethod: a.stats.detectionMethod, edited: true },
    });
    expect(cr.status).toBe(201);
    const dto = (await json(cr)) as TreeSurveyDto;
    expect(dto.name).toBe('แปลงหลังบ้าน รอบ 1');
    expect(dto.treeCount).toBe(29);
    expect(dto.stats.edited).toBe(true);
    expect(s.surveys).toHaveLength(1);
    expect((await json(await s.call('GET', ''))).items[0].name).toBe('แปลงหลังบ้าน รอบ 1');

    const ren = await s.call('PUT', `/${dto.id}`, { points, grid: dto.stats.grid, name: 'รอบ 1 (แก้ชื่อ)' });
    expect(((await json(ren)) as TreeSurveyDto).name).toBe('รอบ 1 (แก้ชื่อ)');
  });

  test('analyze: ไฟล์ของคนอื่น 403 · ฟิลด์ name/result ใน analyze → 400 · จุดร่างนอกภาพ 400', async () => {
    const s = setup();
    const other = `22222222-2222-4222-8222-222222222222/${PARCEL}/33333333-3333-4333-8333-333333333333.jpg`;
    expect((await s.call('POST', '/analyze', { objectPath: other, boundaryPx: boundary })).status).toBe(403);
    const mine = `${USER}/${PARCEL}/33333333-3333-4333-8333-333333333333.jpg`;
    expect((await s.call('POST', '/analyze', { objectPath: mine, boundaryPx: boundary, name: 'x' })).status).toBe(400);
    const bad = await s.call('POST', '/preview', { imageWidth: 100, imageHeight: 100, boundaryPx: boundary, detectionMethod: 'blob', points: [[10, 10], [150, 10]] });
    expect((await json(bad)).code).toBe('POINT_OUT_OF_IMAGE');
  });
});
