// เทสต์ระดับ HTTP ของ /planting-plans ด้วย repository จำลอง (ไม่ต้องมี DB)
import { describe, expect, test } from 'bun:test';
import type { LngLat, PlantingPlanDto } from '@supertrees/contracts';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import type { PlantingPlanRepository, PlantingPlanRow, PlantingPlanTreeRow } from '../src/repositories/planting-plan.repository';
import { createPlantingPlanService } from '../src/services/planting-plan.service';
import { utmInverse } from '../src/services/tree-grid/georef';

const PARCEL = '11111111-1111-4111-8111-111111111111';
const env = { DATABASE_URL: 'postgres://x', SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_SERVICE_ROLE_KEY: 'test-only', AUTH_MODE: 'dev-fixed-user' };

/** สี่เหลี่ยม 80×40 ม. ที่ UTM 47N */
const field: LngLat[] = ([[0, 0], [80, 0], [80, 40], [0, 40]] as const).map(([x, y]) => utmInverse([680000 + x, 1560000 + y], 47) as LngLat);
/** รูปโบว์ (ขอบตัดกันเอง) */
const bowtie: LngLat[] = [field[0]!, field[2]!, field[1]!, field[3]!];

function setup() {
  const plans: (PlantingPlanRow & { trees: PlantingPlanTreeRow[] })[] = [];
  const published: string[] = [];
  const repo: PlantingPlanRepository = {
    // PostGIS ST_IsValid จำลอง: ปฏิเสธรูปโบว์ของเทสต์
    polygonInvalidReason: async (ring) => (JSON.stringify(ring) === JSON.stringify(bowtie) ? 'Self-intersection' : null),
    transaction: (fn) => fn({} as never),
    insertPlan: async (_tx, row) => {
      const r = { ...row, id: crypto.randomUUID(), createdAt: new Date(), trees: [] } as PlantingPlanRow & { trees: PlantingPlanTreeRow[] };
      plans.push(r);
      return r;
    },
    insertTrees: async (_tx, planId, rows) => { plans.find((p) => p.id === planId)!.trees.push(...rows); },
    listByOwnerAndParcel: async (owner, parcel, page, size) => {
      const all = plans.filter((p) => p.ownerId === owner && p.parcelId === parcel);
      return { items: all.slice((page - 1) * size, page * size), totalItems: all.length };
    },
    findById: async (id) => plans.find((p) => p.id === id),
    findByIdForUpdate: async (_tx, id) => plans.find((p) => p.id === id),
    updatePlan: async (_tx, id, patch) => {
      const r = plans.find((p) => p.id === id)!;
      Object.assign(r, patch);
      return r;
    },
    deleteTrees: async (_tx, id) => { plans.find((p) => p.id === id)!.trees = []; },
    findTrees: async (id) => plans.find((p) => p.id === id)?.trees ?? [],
  };
  // ผลนับจำลอง 2 ชุด: ผูกแผนที่ (ต้นตรงหลุมทุกหลุม ยกเว้นหลุมแรก) / ไม่ผูกแผนที่
  const surveyTrees = new Map<string, { treeNo: number; lngLat: [number, number] | null }[]>();
  const surveyRows = new Map<string, { id: string; ownerId: string; parcelId: string }>();
  const addSurvey = (id: string, trees: { treeNo: number; lngLat: [number, number] | null }[]) => {
    surveyRows.set(id, { id, ownerId: '00000000-0000-4000-8000-000000000001', parcelId: PARCEL });
    surveyTrees.set(id, trees);
  };
  const surveyRepo = {
    findById: async (id: string) => surveyRows.get(id),
    findTrees: async (id: string) => surveyTrees.get(id) ?? [],
  } as never;
  const app = createApp({
    config: loadConfig(env),
    health: { check: async () => ({ service: 't', status: 'ok', time: '', checks: {} }) },
    treeSurveys: {} as never,
    plantingPlans: createPlantingPlanService({ repo, surveys: surveyRepo, events: { publish: async (k) => { published.push(k); }, close: async () => {} } }),
  });
  const call = (method: string, path: string, body?: unknown) =>
    app.request(`/api/v1/gardens/${PARCEL}/planting-plans${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return { call, published, addSurvey };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = async (r: Response): Promise<any> => r.json();

describe('planting-plans API', () => {
  test('preview: 80×40 ม. ระยะ 8 ม. → 10×5 = 50 ต้น · พื้นที่ 3,200 ตร.ม.', async () => {
    const res = await setup().call('POST', '/preview', { boundary: field, spacingM: 8 });
    expect(res.status).toBe(200);
    const p = await json(res);
    expect(p.treeCount).toBe(50);
    expect(p.rowCount).toBe(5);
    expect(p.areaSqm).toBeCloseTo(3200, -1);
    expect(p.utmEpsg).toBe(32647);
    expect(p.trees[0]).toMatchObject({ treeId: 'TREE_001', row: 1, column: 1 });
  });

  test('create → list → get · publish event', async () => {
    const s = setup();
    const created = await s.call('POST', '', { name: '  แปลงทุเรียนหลังบ้าน ', boundary: field, spacingM: 8 });
    expect(created.status).toBe(201);
    const dto = (await json(created)) as PlantingPlanDto;
    expect(dto.name).toBe('แปลงทุเรียนหลังบ้าน');
    expect(dto.treeCount).toBe(50);
    expect(s.published).toContain('garden.planting-plan.created');
    expect(await json(await s.call('GET', ''))).toMatchObject({ totalItems: 1, page: 1 });
    const got = (await json(await s.call('GET', `/${dto.id}`))) as PlantingPlanDto;
    expect(got.trees).toHaveLength(50);
    expect(got.boundary).toEqual(field);
    expect(got.spacingM).toBe(8);
  });

  test('error: ขอบตัดกันเอง 422 · จุดไม่พอ/ฟิลด์เกิน/ระยะผิด 400 · ไม่มีชื่อ 400 · id ไม่มี 404', async () => {
    const { call } = setup();
    const bad = await call('POST', '/preview', { boundary: bowtie, spacingM: 8 });
    expect(bad.status).toBe(422);
    expect((await json(bad)).code).toBe('BOUNDARY_INVALID');
    expect((await call('POST', '/preview', { boundary: field.slice(0, 2), spacingM: 8 })).status).toBe(400);
    expect((await call('POST', '/preview', { boundary: field, spacingM: 8, ownerId: 'x' })).status).toBe(400);
    expect((await call('POST', '/preview', { boundary: field, spacingM: 0 })).status).toBe(400);
    expect((await call('POST', '', { boundary: field, spacingM: 8 })).status).toBe(400);
    expect((await call('GET', '/33333333-3333-4333-8333-333333333333')).status).toBe(404);
  });
});

describe('แก้ไขแผนปลูก (PUT)', () => {
  test('ลบ 2 หมุด + เพิ่ม 1 + เลื่อนกริด → บันทึก · GET ได้สถานะแก้ไขกลับมาแก้ต่อได้ · publish updated', async () => {
    const s = setup();
    const dto = (await json(await s.call('POST', '', { name: 'แปลง A', boundary: field, spacingM: 8 }))) as PlantingPlanDto;
    expect(dto.gridLines.length).toBeGreaterThan(0);
    expect(dto.updatedAt).toBeNull();
    const removed = [dto.trees[0]!.lngLat, dto.trees[7]!.lngLat];
    const extras: LngLat[] = [[dto.trees[0]!.lngLat[0] + 0.00001, dto.trees[0]!.lngLat[1]]];
    const body = { name: 'แปลง A (แก้)', boundary: field, spacingM: 8, offsetM: [0.5, 0], removed, extras };
    const res = await s.call('PUT', `/${dto.id}`, body);
    expect(res.status).toBe(200);
    const u = (await json(res)) as PlantingPlanDto;
    expect(u.treeCount).toBe(49);
    expect(u.trees.filter((t) => t.manual)).toHaveLength(1);
    expect(u.updatedAt).not.toBeNull();
    expect(s.published).toContain('garden.planting-plan.updated');
    const got = (await json(await s.call('GET', `/${dto.id}`))) as PlantingPlanDto;
    expect(got.name).toBe('แปลง A (แก้)');
    expect(got.offsetM).toEqual([0.5, 0]);
    expect(got.removed).toEqual(removed);
    expect(got.extras).toEqual(extras);
    expect(got.trees).toHaveLength(49);
  });

  test('PUT แผนที่ไม่มี → 404 · ฟิลด์เกิน → 400', async () => {
    const { call } = setup();
    expect((await call('PUT', '/33333333-3333-4333-8333-333333333333', { name: 'x', boundary: field, spacingM: 8 })).status).toBe(404);
    expect((await call('PUT', '/33333333-3333-4333-8333-333333333333', { name: 'x', boundary: field, spacingM: 8, ownerId: 'y' })).status).toBe(400);
  });
});

describe('เทียบแผนกับผลนับ (GET /{planId}/compare)', () => {
  test('ผลนับผูกแผนที่: ทุกหลุมมีต้นยกเว้น 1 + ต้นเกิน 1 · ผลนับไม่ผูกแผนที่ → 422', async () => {
    const s = setup();
    const plan = (await json(await s.call('POST', '', { name: 'แปลง A', boundary: field, spacingM: 8 }))) as PlantingPlanDto;
    const G = '44444444-4444-4444-8444-444444444444';
    const N = '55555555-5555-4555-8555-555555555555';
    const trees = plan.trees.slice(1).map((t, i) => ({ treeNo: i + 1, lngLat: [t.lngLat[0] + 0.000005, t.lngLat[1]] as [number, number] }));
    trees.push({ treeNo: 99, lngLat: [field[0]![0] - 0.001, field[0]![1] - 0.001] });
    s.addSurvey(G, trees);
    s.addSurvey(N, [{ treeNo: 1, lngLat: null }]);

    const res = await s.call('GET', `/${plan.id}/compare?surveyId=${G}`);
    expect(res.status).toBe(200);
    const c = await json(res);
    expect(c.toleranceM).toBe(4);
    expect(c.stats).toMatchObject({ planned: 50, detected: 50, matched: 49, missing: 1, extra: 1 });
    expect(c.missing[0].planTreeId).toBe('TREE_001');
    expect(c.extra[0]).toMatchObject({ surveyTreeId: 'T_099', insidePlan: false });

    expect((await json(await s.call('GET', `/${plan.id}/compare?surveyId=${N}`))).code).toBe('SURVEY_NOT_GEOREFERENCED');
    expect((await s.call('GET', `/${plan.id}/compare?surveyId=${G}&toleranceM=20`)).status).toBe(400);
    expect((await s.call('GET', `/${plan.id}/compare?surveyId=33333333-3333-4333-8333-333333333333`)).status).toBe(404);
  });
});
