import { and, count, desc, eq, getTableColumns, sql } from 'drizzle-orm';
import type { LngLat } from '@supertrees/contracts';
import type { Db } from '../db/client';
import { plantingPlans, plantingPlanTrees } from '../db/schema';

export type PlantingPlanRow = Omit<typeof plantingPlans.$inferSelect, 'geom'>;
export type NewPlantingPlan = Omit<typeof plantingPlans.$inferInsert, 'geom' | 'boundary'> & { boundary: LngLat[] };
export interface PlantingPlanTreeRow {
  treeNo: number;
  rowNo: number;
  colNo: number;
  manual: boolean;
  lngLat: LngLat;
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

// Postgres จำกัด parameter 65535 ต่อคำสั่ง — แถวละ 7 ค่า
const TREE_INSERT_CHUNK = 5000;

/** GeoJSON Polygon (ปิดวง) จากมุมแปลง — ค่าเข้าไปเป็น parameter เสมอ */
function polygonGeoJson(ring: LngLat[]): string {
  return JSON.stringify({ type: 'Polygon', coordinates: [[...ring, ring[0]]] });
}

export function createPlantingPlanRepository(db: Db) {
  const { geom: _geom, ...planCols } = getTableColumns(plantingPlans);
  return {
    /** null = ถูกต้อง · ไม่ใช่ null = เหตุผลจาก PostGIS (เช่น Self-intersection) */
    async polygonInvalidReason(ring: LngLat[]): Promise<string | null> {
      const rows = await db.execute<{ valid: boolean; reason: string }>(
        sql`select ST_IsValid(g) as valid, ST_IsValidReason(g) as reason from (select ST_SetSRID(ST_GeomFromGeoJSON(${polygonGeoJson(ring)}), 4326) as g) x`,
      );
      return rows[0]?.valid ? null : (rows[0]?.reason ?? 'invalid');
    },

    transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      return db.transaction(fn);
    },

    async insertPlan(tx: Tx, row: NewPlantingPlan): Promise<PlantingPlanRow> {
      const [created] = await tx
        .insert(plantingPlans)
        .values({ ...row, geom: sql`ST_SetSRID(ST_GeomFromGeoJSON(${polygonGeoJson(row.boundary)}), 4326)` })
        .returning(planCols);
      return created!;
    },

    async insertTrees(tx: Tx, planId: string, rows: PlantingPlanTreeRow[]): Promise<void> {
      for (let i = 0; i < rows.length; i += TREE_INSERT_CHUNK) {
        await tx.insert(plantingPlanTrees).values(
          rows.slice(i, i + TREE_INSERT_CHUNK).map((t) => ({
            planId,
            treeNo: t.treeNo,
            rowNo: t.rowNo,
            colNo: t.colNo,
            manual: t.manual,
            geom: sql`ST_SetSRID(ST_MakePoint(${t.lngLat[0]}, ${t.lngLat[1]}), 4326)`,
          })),
        );
      }
    },

    /** ล็อกแถวไว้จนจบ transaction — กันการแก้ซ้อนกัน (CLAUDE.md) */
    async findByIdForUpdate(tx: Tx, id: string): Promise<PlantingPlanRow | undefined> {
      const [row] = await tx.select(planCols).from(plantingPlans).where(eq(plantingPlans.id, id)).for('update');
      return row;
    },

    async updatePlan(tx: Tx, id: string, patch: Omit<NewPlantingPlan, 'parcelId' | 'ownerId'>): Promise<PlantingPlanRow> {
      const [row] = await tx
        .update(plantingPlans)
        .set({ ...patch, geom: sql`ST_SetSRID(ST_GeomFromGeoJSON(${polygonGeoJson(patch.boundary)}), 4326)` })
        .where(eq(plantingPlans.id, id))
        .returning(planCols);
      return row!;
    },

    async deleteTrees(tx: Tx, planId: string): Promise<void> {
      await tx.delete(plantingPlanTrees).where(eq(plantingPlanTrees.planId, planId));
    },

    async listByOwnerAndParcel(ownerId: string, parcelId: string, page: number, size: number) {
      const where = and(eq(plantingPlans.ownerId, ownerId), eq(plantingPlans.parcelId, parcelId));
      const [items, [total]] = await Promise.all([
        db.select(planCols).from(plantingPlans).where(where).orderBy(desc(plantingPlans.createdAt)).limit(size).offset((page - 1) * size),
        db.select({ n: count() }).from(plantingPlans).where(where),
      ]);
      return { items, totalItems: total?.n ?? 0 };
    },

    async findById(id: string): Promise<PlantingPlanRow | undefined> {
      const [row] = await db.select(planCols).from(plantingPlans).where(eq(plantingPlans.id, id));
      return row;
    },

    async findTrees(planId: string): Promise<PlantingPlanTreeRow[]> {
      const rows = await db
        .select({
          treeNo: plantingPlanTrees.treeNo,
          rowNo: plantingPlanTrees.rowNo,
          colNo: plantingPlanTrees.colNo,
          manual: plantingPlanTrees.manual,
          lng: sql<number>`ST_X(${plantingPlanTrees.geom})`,
          lat: sql<number>`ST_Y(${plantingPlanTrees.geom})`,
        })
        .from(plantingPlanTrees)
        .where(eq(plantingPlanTrees.planId, planId))
        .orderBy(plantingPlanTrees.treeNo);
      return rows.map(({ lng, lat, ...r }) => ({ ...r, lngLat: [Number(lng), Number(lat)] }));
    },
  };
}
export type PlantingPlanRepository = ReturnType<typeof createPlantingPlanRepository>;
