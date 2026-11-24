import { describe, expect, it } from 'vitest';
import { formatThaiDate } from './pipes/thai-date.pipe';
import { StRaiNganWaPipe } from './pipes/area.pipe';
import { StDistancePipe } from './pipes/distance.pipe';
import { raiNganWaToSqm, sqmToRaiNganWa } from './util/units';
import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage } from './util/api-error';

describe('units', () => {
  it('ตร.ม. ↔ ไร่-งาน-ตร.วา', () => {
    expect(sqmToRaiNganWa(3722)).toEqual({ rai: 2, ngan: 1, wa: 30.5 });
    expect(raiNganWaToSqm({ rai: 2, ngan: 1, wa: 30.5 })).toBe(3722);
    expect(new StRaiNganWaPipe().transform(1600)).toBe('1 ไร่');
    expect(new StRaiNganWaPipe().transform(0)).toBe('0 ตร.วา');
  });
  it('ระยะ', () => {
    expect(new StDistancePipe().transform(4.04)).toBe('4.0 ม.');
    expect(new StDistancePipe().transform(1350)).toBe('1.35 กม.');
  });
  it('วันที่ไทยเป็น พ.ศ. เวลาไทย', () => {
    // 2026-11-23T20:00Z = 24 พ.ย. 2569 03:00 น. เวลาไทย
    const s = formatThaiDate('2026-11-23T20:00:00Z');
    expect(s).toContain('2569');
    expect(s).toContain('24');
    expect(s).toContain('03:00');
  });
});

describe('apiErrorMessage', () => {
  it('ใช้ข้อความของ service เมื่อเป็น error รูปแบบกลาง', () => {
    expect(apiErrorMessage(new HttpErrorResponse({ status: 422, error: { code: 'TOO_FEW_TREES', message: 'ตรวจพบต้นไม้น้อยเกินไป' } }))).toBe('ตรวจพบต้นไม้น้อยเกินไป');
  });
  it('ไม่แสดงข้อความภาษาอังกฤษของ gateway', () => {
    expect(apiErrorMessage(new HttpErrorResponse({ status: 502, error: { message: 'An invalid response was received from the upstream server' } }))).toBe('บริการยังไม่พร้อมใช้งาน ลองใหม่อีกครั้ง');
    expect(apiErrorMessage(new HttpErrorResponse({ status: 0 }))).toBe('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
  });
});
