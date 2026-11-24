// แปลง error จาก API (รูปแบบ { code, message, details? }) เป็นข้อความสำหรับผู้ใช้
import { HttpErrorResponse } from '@angular/common/http';

export function apiErrorMessage(err: unknown, fallback = 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง'): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้';
    // ใช้ข้อความจาก body เฉพาะ error รูปแบบกลางของเรา ({ code, message }) — ไม่ใช่ข้อความของ gateway
    const body = err.error as { code?: unknown; message?: unknown } | null;
    if (body && typeof body.code === 'string' && typeof body.message === 'string') return body.message;
    if (err.status === 429) return 'เรียกใช้งานถี่เกินไป รอสักครู่แล้วลองใหม่';
    if (err.status >= 502 && err.status <= 504) return 'บริการยังไม่พร้อมใช้งาน ลองใหม่อีกครั้ง';
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function apiErrorCode(err: unknown): string | null {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { code?: unknown } | null;
    if (body && typeof body.code === 'string') return body.code;
  }
  return null;
}
