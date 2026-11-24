import { and, count, desc, eq, getTableColumns, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { treeSurveys, treeSurveyTrees } from '../db/schema';

export type TreeSurveyRow = typeof treeSurveys.$inferSelect;
export type NewTreeSurvey = typeof treeSurveys.$inferInsert;
export type TreeSurveyTreeRow = Omit<typeof treeSurveyTrees.$inferSelect, 'geom'> & { lngLat: [number, number] | null };
export type NewTreeSurveyTree = Omit<typeof treeSurveyTrees.$inferInsert, 'geom'> & { lngLat: [number, number] | null };

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

// Postgres จำกัด parameter 65535 ต่อคำสั่ง — แถวละ ~10 ค่า
const TREE_INSERT_CHUNK = 1000;

export function createTreeSurveyRepository(db: Db) {
  return {
    transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      return db.transaction(fn);
    },

    async insertSurvey(tx: Tx, row: NewTreeSurvey): Promise<TreeSurveyRow> {
      const [created] = await tx.insert(treeSurveys).values(row).returning();
      return created!;
    },

    async insertTrees(tx: Tx, rows: NewTreeSurveyTree[]): Promise<void> {
      for (let i = 0; i < rows.length; i += TREE_INSERT_CHUNK) {
        await tx.insert(treeSurveyTrees).values(
          rows.slice(i, i + TREE_INSERT_CHUNK).map(({ lngLat, ...r }) => ({
            ...r,
            geom: lngLat ? sql`ST_SetSRID(ST_MakePoint(${lngLat[0]}, ${lngLat[1]}), 4326)` : null,
          })),
        );
      }
    },

    async listByOwnerAndParcel(ownerId: string, parcelId: string, page: number, size: number) {
      const where = and(eq(treeSurveys.ownerId, ownerId), eq(treeSurveys.parcelId, parcelId));
      const [items, [total]] = await Promise.all([
        db
          .select()
          .from(treeSurveys)
          .where(where)
          .orderBy(desc(treeSurveys.createdAt))
          .limit(size)
          .offset((page - 1) * size),
        db.select({ n: count() }).from(treeSurveys).where(where),
      ]);
      return { items, totalItems: total?.n ?? 0 };
    },

    async findById(id: string): Promise<TreeSurveyRow | undefined> {
      const [row] = await db.select().from(treeSurveys).where(eq(treeSurveys.id, id));
      return row;
    },

    /** ล็อกแถวไว้จนจบ transaction — กันการแก้ซ้อนกัน (CLAUDE.md: ข้อมูลที่แย่งกันแก้) */
    async findByIdForUpdate(tx: Tx, id: string): Promise<TreeSurveyRow | undefined> {
      const [row] = await tx.select().from(treeSurveys).where(eq(treeSurveys.id, id)).for('update');
      return row;
    },

    async updateSurvey(tx: Tx, id: string, patch: Partial<NewTreeSurvey>): Promise<TreeSurveyRow> {
      const [row] = await tx.update(treeSurveys).set(patch).where(eq(treeSurveys.id, id)).returning();
      return row!;
    },

    async deleteTrees(tx: Tx, surveyId: string): Promise<void> {
      await tx.delete(treeSurveyTrees).where(eq(treeSurveyTrees.surveyId, surveyId));
    },

    async findTrees(surveyId: string): Promise<TreeSurveyTreeRow[]> {
      const { geom: _geom, ...cols } = getTableColumns(treeSurveyTrees);
      const rows = await db
        .select({ ...cols, lng: sql<number | null>`ST_X(${treeSurveyTrees.geom})`, lat: sql<number | null>`ST_Y(${treeSurveyTrees.geom})` })
        .from(treeSurveyTrees)
        .where(eq(treeSurveyTrees.surveyId, surveyId))
        .orderBy(treeSurveyTrees.treeNo);
      return rows.map(({ lng, lat, ...r }) => ({ ...r, lngLat: lng === null || lat === null ? null : [Number(lng), Number(lat)] }));
    },
  };
}
export type TreeSurveyRepository = ReturnType<typeof createTreeSurveyRepository>;
