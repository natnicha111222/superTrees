// TASK-010 — logic ทั้งหมดของการนับต้นไม้จากภาพ (ตรวจสิทธิ์, ประมวลผล, แก้ไข, บันทึก, publish)
import {
  ROUTING_KEYS,
  type GardenTreeSurveyCompletedData,
  type GardenTreeSurveyUpdatedData,
  type Page,
  type SurveyedTreeDto,
  type TreeSurveyAnalysisDto,
  type TreeSurveyCreateRequest,
  type TreeSurveyDraftPreviewRequest,
  type TreeSurveyDto,
  type TreeSurveyEditRequest,
  type TreeSurveyPreviewDto,
  type TreeSurveyPreviewRequest,
  type TreeSurveyStatsDto,
  type TreeSurveySummaryDto,
  type TreeSurveyUploadUrlRequest,
  type TreeSurveyUploadUrlResponse,
} from '@supertrees/contracts';
import { AppError, notFound } from '../errors';
import type { EventPublisher } from '../events/publisher';
import type { AuthUser } from '../middleware/auth';
import type { PhotoStorage } from '../repositories/photo-storage.repository';
import type { NewTreeSurveyTree, TreeSurveyRepository, TreeSurveyRow } from '../repositories/tree-survey.repository';
import { decodeSurveyImage, surveyImageSize } from './image-decode';
import {
  analyzeTreeGrid,
  buildTreeGrid,
  fitGeoref,
  GeorefError,
  GridError,
  gridGapPoints,
  resolveGridParams,
  TreeGridError,
  type Pt,
  type ScaleInput,
  type TreeGrid,
} from './tree-grid';

const DOWNLOAD_URL_TTL_SEC = 600;
const EXT: Record<TreeSurveyUploadUrlRequest['contentType'], string> = { 'image/jpeg': 'jpg', 'image/png': 'png' };

type DetectionMethod = TreeSurveyStatsDto['detectionMethod'];

export interface TreeSurveyDeps {
  repo: TreeSurveyRepository;
  storage: PhotoStorage;
  events: EventPublisher;
  /** แทนที่ได้ในเทสต์ */
  decode?: typeof decodeSurveyImage;
  imageSize?: typeof surveyImageSize;
}

/** บริบทของการคำนวณ — มาจากแถวที่บันทึกแล้ว หรือจากคำขอ (ฉบับร่าง) */
interface CalcContext {
  imageWidth: number;
  imageHeight: number;
  boundaryPx: Pt[];
  scale: ScaleInput;
}

export function createTreeSurveyService({ repo, storage, events, decode = decodeSurveyImage, imageSize = surveyImageSize }: TreeSurveyDeps) {
  /** object path ของผู้ใช้ + แปลงนี้: `<ownerId>/<parcelId>/<uuid>.<ext>` */
  const pathPrefix = (user: AuthUser, parcelId: string) => `${user.id}/${parcelId}/`;

  // MOCK-003: ยังไม่ถาม parcel-service ว่าแปลงมีจริงและเป็นของผู้ใช้ (parcel-service ยังไม่มี — TASK-004)
  // ตอนนี้ข้อมูลถูกจำกัดด้วย owner_id ของผู้ใช้เองอยู่แล้ว จึงไม่รั่วข้ามผู้ใช้
  async function assertParcelAccess(_user: AuthUser, _parcelId: string): Promise<void> {}

  /** ไม่บอกว่ามีอยู่แต่ไม่ใช่ของเรา (กันเดา id) */
  function assertOwned(row: TreeSurveyRow | undefined, user: AuthUser, parcelId: string): asserts row is TreeSurveyRow {
    if (!row || row.ownerId !== user.id || row.parcelId !== parcelId) throw notFound('ผลการนับต้นไม้');
  }

  async function toDto(row: TreeSurveyRow): Promise<TreeSurveyDto> {
    const trees = await repo.findTrees(row.id);
    return {
      ...toSummary(row),
      imageWidth: row.imageWidth,
      imageHeight: row.imageHeight,
      imageUrl: await storage.createDownloadUrl(row.imagePath, DOWNLOAD_URL_TTL_SEC),
      boundaryPx: row.boundaryPx,
      controlPoints: row.controlPoints ?? null,
      // ผลก่อน contracts 0.2.0 ไม่มี grid/edited
      stats: { ...row.stats, grid: row.stats.grid ?? null, edited: row.stats.edited ?? false },
      gridLines: row.gridLines,
      trees: trees.map((t) => ({
        treeId: treeId(t.treeNo),
        orderNum: t.treeNo,
        row: t.rowNo,
        column: t.colNo,
        pixel: [t.pixelX, t.pixelY],
        lngLat: t.lngLat,
        nearestTreeId: treeId(t.nearestTreeNo),
        nearestDistancePx: t.nearestDistancePx,
        nearestDistanceM: t.nearestDistanceM,
      })),
    };
  }

  /** ไฟล์ภาพของผู้ใช้ + แปลงนี้ (ตรวจสิทธิ์ path + มีไฟล์จริง) */
  async function loadImage(user: AuthUser, parcelId: string, objectPath: string): Promise<Uint8Array> {
    await assertParcelAccess(user, parcelId);
    if (!objectPath.startsWith(pathPrefix(user, parcelId))) {
      throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์ใช้ไฟล์นี้');
    }
    const bytes = await storage.download(objectPath);
    if (!bytes) throw new AppError(404, 'IMAGE_NOT_FOUND', 'ไม่พบไฟล์ภาพ — อัปโหลดไม่สำเร็จหรือหมดอายุ');
    return bytes;
  }

  /** ตรวจจับต้นไม้จากภาพ (ยังไม่บันทึก) */
  async function detect(bytes: Uint8Array, req: TreeSurveyCreateRequest) {
    const img = await decode(bytes);
    const scale = scaleFromRequest(req);
    try {
      return { img, scale, result: analyzeTreeGrid(img, req.boundaryPx, { scale }) };
    } catch (e) {
      if (e instanceof TreeGridError || e instanceof GridError) throw new AppError(422, e.code, e.message);
      throw e;
    }
  }

  /** คำนวณใหม่จากจุดที่ผู้ใช้แก้ — ใช้ทั้งพรีวิว (ร่าง/บันทึกแล้ว) และบันทึก (ผลตรงกันเสมอ) */
  function recompute(ctx: CalcContext, req: TreeSurveyPreviewRequest): { result: TreeGrid; points: Pt[]; addedCount: number } {
    for (const [x, y] of req.points) {
      if (x < 0 || y < 0 || x > ctx.imageWidth || y > ctx.imageHeight) {
        throw new AppError(400, 'POINT_OUT_OF_IMAGE', 'มีจุดต้นไม้อยู่นอกภาพ');
      }
    }
    let points: Pt[] = req.points;
    let addedCount = 0;
    try {
      let grid = req.grid ?? null;
      if (req.fillGaps) {
        const resolved = resolveGridParams(points, grid);
        const added = gridGapPoints(points, resolved, ctx.boundaryPx);
        points = [...points, ...added];
        addedCount = added.length;
        grid = resolved;
      }
      return { result: buildTreeGrid(points, ctx.scale, { grid, extent: ctx.boundaryPx }), points, addedCount };
    } catch (e) {
      if (e instanceof GridError) throw new AppError(422, e.code, e.message);
      throw e;
    }
  }

  return {
    async createUploadUrl(user: AuthUser, parcelId: string, req: TreeSurveyUploadUrlRequest): Promise<TreeSurveyUploadUrlResponse> {
      await assertParcelAccess(user, parcelId);
      const objectPath = `${pathPrefix(user, parcelId)}${crypto.randomUUID()}.${EXT[req.contentType]}`;
      return { objectPath, uploadUrl: await storage.createUploadUrl(objectPath) };
    },

    /** ตรวจจับต้นไม้จากภาพ — ยังไม่บันทึก (ผู้ใช้ตรวจ/แก้แล้วค่อย create พร้อม result) */
    async analyze(user: AuthUser, parcelId: string, req: TreeSurveyCreateRequest): Promise<TreeSurveyAnalysisDto> {
      const { img, result } = await detect(await loadImage(user, parcelId, req.objectPath), req);
      return {
        imageWidth: img.width,
        imageHeight: img.height,
        stats: statsDto(result, result.detection.method, false),
        gridLines: result.gridLines,
        trees: treesDto(result),
      };
    },

    /** พรีวิวการแก้ผลที่ยังไม่บันทึก — คำนวณจากบริบทที่ส่งมา (ไม่ต้องใช้ภาพ) */
    async previewDraft(user: AuthUser, parcelId: string, req: TreeSurveyDraftPreviewRequest): Promise<TreeSurveyPreviewDto> {
      await assertParcelAccess(user, parcelId);
      const ctx: CalcContext = { imageWidth: req.imageWidth, imageHeight: req.imageHeight, boundaryPx: req.boundaryPx, scale: scaleFromRequest(req) };
      const { result, addedCount } = recompute(ctx, req);
      return { stats: statsDto(result, req.detectionMethod, true), gridLines: result.gridLines, trees: treesDto(result), addedCount };
    },

    /**
     * บันทึกผลการนับ · ส่ง result มา = ใช้จุด/กริดที่ผู้ใช้ตรวจแล้ว (ไม่ตรวจจับใหม่ — อ่านแค่ขนาดภาพ)
     * ไม่ส่ง = ตรวจจับแล้วบันทึกทันที (แบบเดิม)
     */
    async create(user: AuthUser, parcelId: string, req: TreeSurveyCreateRequest): Promise<TreeSurveyDto> {
      const bytes = await loadImage(user, parcelId, req.objectPath);
      let width: number;
      let height: number;
      let result: TreeGrid;
      let method: DetectionMethod;
      let edited = false;
      if (req.result) {
        ({ width, height } = await imageSize(bytes));
        const scale = scaleFromRequest(req);
        result = recompute({ imageWidth: width, imageHeight: height, boundaryPx: req.boundaryPx, scale }, { points: req.result.points, grid: req.result.grid }).result;
        method = req.result.detectionMethod;
        edited = req.result.edited;
      } else {
        const d = await detect(bytes, req);
        ({ width, height } = d.img);
        result = d.result;
        method = d.result.detection.method;
      }

      const survey = await repo.transaction(async (tx) => {
        const row = await repo.insertSurvey(tx, {
          parcelId,
          ownerId: user.id,
          name: req.name?.trim() || null,
          imagePath: req.objectPath,
          imageWidth: width,
          imageHeight: height,
          boundaryPx: req.boundaryPx,
          controlPoints: req.controlPoints ?? null,
          scaleSource: scaleSourceOf(result),
          scaleIsEstimate: result.stats.scaleIsEstimate,
          assumedSpacingM: req.controlPoints ? null : (req.assumedSpacingM?.toString() ?? null),
          ...resultColumns(result, method, edited),
        });
        await repo.insertTrees(tx, treeRows(row.id, result));
        return row;
      });

      // publish หลัง commit เท่านั้น
      await events.publish<GardenTreeSurveyCompletedData>(ROUTING_KEYS.gardenTreeSurveyCompleted, {
        surveyId: survey.id,
        parcelId,
        treeCount: result.stats.treeCount,
      });
      return toDto(survey);
    },

    async list(user: AuthUser, parcelId: string, page: number, size: number): Promise<Page<TreeSurveySummaryDto>> {
      await assertParcelAccess(user, parcelId);
      const { items, totalItems } = await repo.listByOwnerAndParcel(user.id, parcelId, page, size);
      return { items: items.map(toSummary), page, size, totalItems };
    },

    async get(user: AuthUser, parcelId: string, surveyId: string): Promise<TreeSurveyDto> {
      const row = await repo.findById(surveyId);
      assertOwned(row, user, parcelId);
      return toDto(row);
    },

    /** คำนวณผลจากจุด/กริดที่แก้ โดยยังไม่บันทึก */
    async preview(user: AuthUser, parcelId: string, surveyId: string, req: TreeSurveyPreviewRequest): Promise<TreeSurveyPreviewDto> {
      const row = await repo.findById(surveyId);
      assertOwned(row, user, parcelId);
      const { result, addedCount } = recompute(contextOf(row), req);
      return {
        stats: statsDto(result, row.stats.detectionMethod, true),
        gridLines: result.gridLines,
        trees: treesDto(result),
        addedCount,
      };
    },

    /** บันทึกจุด/กริดที่แก้ — แทนที่ต้นไม้ทั้งหมดของผลนี้ใน transaction เดียว */
    async update(user: AuthUser, parcelId: string, surveyId: string, req: TreeSurveyEditRequest): Promise<TreeSurveyDto> {
      const saved = await repo.transaction(async (tx) => {
        const row = await repo.findByIdForUpdate(tx, surveyId);
        assertOwned(row, user, parcelId);
        const { result } = recompute(contextOf(row), { points: req.points, grid: req.grid });
        const updated = await repo.updateSurvey(tx, row.id, {
          ...resultColumns(result, row.stats.detectionMethod, true),
          ...(req.name?.trim() ? { name: req.name.trim() } : {}),
          updatedAt: new Date(),
        });
        await repo.deleteTrees(tx, row.id);
        await repo.insertTrees(tx, treeRows(row.id, result));
        return updated;
      });
      await events.publish<GardenTreeSurveyUpdatedData>(ROUTING_KEYS.gardenTreeSurveyUpdated, {
        surveyId: saved.id,
        parcelId,
        treeCount: saved.treeCount,
      });
      return toDto(saved);
    },
  };
}
export type TreeSurveyService = ReturnType<typeof createTreeSurveyService>;

// ── แปลงข้อมูล ───────────────────────────────────────────────────────────────

/** มาตราส่วนจากคำขอ: จุดคู่ → georef · ระยะปลูก → assumedSpacing (MOCK-001) */
function scaleFromRequest(req: { controlPoints?: TreeSurveyCreateRequest['controlPoints']; assumedSpacingM?: number }): ScaleInput {
  try {
    if (req.controlPoints) return { kind: 'georef', georef: fitGeoref(req.controlPoints) };
    if (req.assumedSpacingM) return { kind: 'assumedSpacing', spacingM: req.assumedSpacingM };
    return { kind: 'none' };
  } catch (e) {
    if (e instanceof GeorefError) throw new AppError(400, e.code, e.message);
    throw e;
  }
}

function contextOf(row: TreeSurveyRow): CalcContext {
  return { imageWidth: row.imageWidth, imageHeight: row.imageHeight, boundaryPx: row.boundaryPx, scale: scaleFor(row) };
}

/** มาตราส่วนจากข้อมูลที่บันทึกไว้ตอนสร้าง (จุดคู่ → georef ใหม่, ระยะปลูก → assumedSpacing) */
function scaleFor(row: TreeSurveyRow): ScaleInput {
  if (row.controlPoints?.length) return { kind: 'georef', georef: fitGeoref(row.controlPoints) };
  if (row.assumedSpacingM) return { kind: 'assumedSpacing', spacingM: Number(row.assumedSpacingM) }; // MOCK-001
  return { kind: 'none' };
}

function scaleSourceOf(result: TreeGrid): TreeSurveyStatsDto['scaleSource'] {
  return result.stats.scaleSource === 'metersPerPixel' ? 'none' : result.stats.scaleSource;
}

function statsDto(result: TreeGrid, detectionMethod: DetectionMethod, edited: boolean): TreeSurveyStatsDto {
  const s = result.stats;
  return {
    treeCount: s.treeCount,
    rowCount: s.rowCount,
    medianSpacingPx: s.medianSpacingPx,
    meanNearestDistanceM: s.meanNearestDistanceM,
    metersPerPixel: s.metersPerPixel,
    scaleSource: scaleSourceOf(result),
    scaleIsEstimate: s.scaleIsEstimate,
    georef: s.georef,
    gridAngleDeg: s.gridAngleDeg,
    detectionMethod,
    grid: s.grid,
    edited,
  };
}

/** คอลัมน์ของ tree_surveys ที่มาจากผลคำนวณ */
function resultColumns(result: TreeGrid, detectionMethod: DetectionMethod, edited: boolean) {
  const s = result.stats;
  return {
    metersPerPixel: s.metersPerPixel?.toString() ?? null,
    georefRmsErrorM: s.georef?.rmsErrorM.toString() ?? null,
    utmEpsg: s.georef?.epsg ?? null,
    treeCount: s.treeCount,
    stats: statsDto(result, detectionMethod, edited),
    gridLines: result.gridLines,
  };
}

function treeRows(surveyId: string, result: TreeGrid): NewTreeSurveyTree[] {
  const noOf = new Map(result.trees.map((t) => [t.treeId, t.orderNum]));
  return result.trees.map((t) => ({
    surveyId,
    treeNo: t.orderNum,
    rowNo: t.row,
    colNo: t.column,
    pixelX: t.pixelX,
    pixelY: t.pixelY,
    nearestTreeNo: noOf.get(t.nearestTreeId)!,
    nearestDistancePx: t.nearestDistancePx,
    nearestDistanceM: t.nearestDistanceM,
    lngLat: t.lngLat,
  }));
}

function treesDto(result: TreeGrid): SurveyedTreeDto[] {
  return result.trees.map((t) => ({
    treeId: t.treeId,
    orderNum: t.orderNum,
    row: t.row,
    column: t.column,
    pixel: [t.pixelX, t.pixelY],
    lngLat: t.lngLat,
    nearestTreeId: t.nearestTreeId,
    nearestDistancePx: t.nearestDistancePx,
    nearestDistanceM: t.nearestDistanceM,
  }));
}

function treeId(n: number): string {
  return `T_${String(n).padStart(3, '0')}`;
}

function toSummary(row: TreeSurveyRow): TreeSurveySummaryDto {
  return {
    id: row.id,
    parcelId: row.parcelId,
    name: row.name ?? null,
    treeCount: row.treeCount,
    scaleSource: row.scaleSource,
    scaleIsEstimate: row.scaleIsEstimate,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}
