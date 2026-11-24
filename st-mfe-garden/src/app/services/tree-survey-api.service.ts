// TASK-010 — เรียก /api/v1/gardens/{parcelId}/tree-surveys ผ่าน Kong (base URL จาก runtime config)
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { RuntimeConfigService } from '@supertrees/shared-ui';
import type {
  Page,
  TreeSurveyAnalysisDto,
  TreeSurveyCreateRequest,
  TreeSurveyDraftPreviewRequest,
  TreeSurveyDto,
  TreeSurveyEditRequest,
  TreeSurveyPreviewDto,
  TreeSurveyPreviewRequest,
  TreeSurveySummaryDto,
  TreeSurveyUploadUrlRequest,
  TreeSurveyUploadUrlResponse,
} from '@supertrees/contracts';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TreeSurveyApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  private base(parcelId: string): string {
    return this.config.apiUrl(`/api/v1/gardens/${encodeURIComponent(parcelId)}/tree-surveys`);
  }

  list(parcelId: string, page = 1, size = 20): Observable<Page<TreeSurveySummaryDto>> {
    return this.http.get<Page<TreeSurveySummaryDto>>(this.base(parcelId), {
      params: new HttpParams().set('page', page).set('size', size),
    });
  }

  get(parcelId: string, surveyId: string): Observable<TreeSurveyDto> {
    return this.http.get<TreeSurveyDto>(`${this.base(parcelId)}/${encodeURIComponent(surveyId)}`);
  }

  createUploadUrl(parcelId: string, body: TreeSurveyUploadUrlRequest): Observable<TreeSurveyUploadUrlResponse> {
    return this.http.post<TreeSurveyUploadUrlResponse>(`${this.base(parcelId)}/upload-url`, body);
  }

  /** วิเคราะห์ภาพ — ยังไม่บันทึก */
  analyze(parcelId: string, body: TreeSurveyCreateRequest): Observable<TreeSurveyAnalysisDto> {
    return this.http.post<TreeSurveyAnalysisDto>(`${this.base(parcelId)}/analyze`, body);
  }

  /** พรีวิวการแก้ผลที่ยังไม่บันทึก */
  previewDraft(parcelId: string, body: TreeSurveyDraftPreviewRequest): Observable<TreeSurveyPreviewDto> {
    return this.http.post<TreeSurveyPreviewDto>(`${this.base(parcelId)}/preview`, body);
  }

  /** บันทึกผล (ส่ง result = ผลที่ผู้ใช้ตรวจแล้ว) */
  create(parcelId: string, body: TreeSurveyCreateRequest): Observable<TreeSurveyDto> {
    return this.http.post<TreeSurveyDto>(this.base(parcelId), body);
  }

  /** คำนวณผลจากจุด/กริดที่แก้ โดยยังไม่บันทึก */
  preview(parcelId: string, surveyId: string, body: TreeSurveyPreviewRequest): Observable<TreeSurveyPreviewDto> {
    return this.http.post<TreeSurveyPreviewDto>(`${this.base(parcelId)}/${encodeURIComponent(surveyId)}/preview`, body);
  }

  /** บันทึกจุด/กริดที่แก้ */
  update(parcelId: string, surveyId: string, body: TreeSurveyEditRequest): Observable<TreeSurveyDto> {
    return this.http.put<TreeSurveyDto>(`${this.base(parcelId)}/${encodeURIComponent(surveyId)}`, body);
  }

  /** อัปโหลดไฟล์ตรงไป Supabase Storage ด้วย signed URL ที่ service ออกให้ (ไม่ผ่าน Kong) */
  async uploadToSignedUrl(uploadUrl: string, blob: Blob, contentType: string): Promise<void> {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': contentType, 'x-upsert': 'false' },
      body: blob,
    });
    if (!res.ok) throw new Error(`อัปโหลดภาพไม่สำเร็จ (${res.status})`);
  }
}
