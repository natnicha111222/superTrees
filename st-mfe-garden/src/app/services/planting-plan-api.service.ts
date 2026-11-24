// วางแผนปลูก — /api/v1/gardens/{parcelId}/planting-plans ผ่าน Kong
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { RuntimeConfigService } from '@supertrees/shared-ui';
import type {
  Page,
  PlanComparisonDto,
  PlantingPlanCreateRequest,
  PlantingPlanDto,
  PlantingPlanLayoutDto,
  PlantingPlanPreviewRequest,
  PlantingPlanSummaryDto,
  PlantingPlanUpdateRequest,
} from '@supertrees/contracts';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PlantingPlanApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  private base(parcelId: string): string {
    return this.config.apiUrl(`/api/v1/gardens/${encodeURIComponent(parcelId)}/planting-plans`);
  }

  list(parcelId: string, page = 1, size = 20): Observable<Page<PlantingPlanSummaryDto>> {
    return this.http.get<Page<PlantingPlanSummaryDto>>(this.base(parcelId), { params: new HttpParams().set('page', page).set('size', size) });
  }

  get(parcelId: string, planId: string): Observable<PlantingPlanDto> {
    return this.http.get<PlantingPlanDto>(`${this.base(parcelId)}/${encodeURIComponent(planId)}`);
  }

  preview(parcelId: string, body: PlantingPlanPreviewRequest): Observable<PlantingPlanLayoutDto> {
    return this.http.post<PlantingPlanLayoutDto>(`${this.base(parcelId)}/preview`, body);
  }

  create(parcelId: string, body: PlantingPlanCreateRequest): Observable<PlantingPlanDto> {
    return this.http.post<PlantingPlanDto>(this.base(parcelId), body);
  }

  /** เทียบแผนกับผลนับต้นไม้ (ผูกแผนที่แล้ว) · toleranceM ไม่ส่ง = ครึ่งระยะปลูก */
  compare(parcelId: string, planId: string, surveyId: string, toleranceM?: number): Observable<PlanComparisonDto> {
    let params = new HttpParams().set('surveyId', surveyId);
    if (toleranceM) params = params.set('toleranceM', toleranceM);
    return this.http.get<PlanComparisonDto>(`${this.base(parcelId)}/${encodeURIComponent(planId)}/compare`, { params });
  }

  update(parcelId: string, planId: string, body: PlantingPlanUpdateRequest): Observable<PlantingPlanDto> {
    return this.http.put<PlantingPlanDto>(`${this.base(parcelId)}/${encodeURIComponent(planId)}`, body);
  }
}

/** CSV คอลัมน์เดียวกับสคริปต์ Colab (tree_id, order_no, row, col, latitude, longitude) */
export function plantingCsv(trees: PlantingPlanLayoutDto['trees']): string {
  const rows = trees.map((t) => [t.treeId, t.orderNum, t.row, t.column, t.lngLat[1], t.lngLat[0], t.manual ? 1 : 0].join(','));
  return ['tree_id,order_no,row,col,latitude,longitude,manual', ...rows].join('\n');
}

export function downloadText(text: string, filename: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type }));
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}
