// วันที่ไทย (พ.ศ., เวลาไทย) — ใช้แทน `+ 543` ทุกที่ (CLAUDE.md)
import { Pipe, type PipeTransform } from '@angular/core';

const formats = {
  date: { dateStyle: 'medium' },
  datetime: { dateStyle: 'medium', timeStyle: 'short' },
  long: { dateStyle: 'long', timeStyle: 'short' },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

const cache = new Map<string, Intl.DateTimeFormat>();

export function formatThaiDate(value: string | Date, format: keyof typeof formats = 'datetime'): string {
  let f = cache.get(format);
  if (!f) {
    f = new Intl.DateTimeFormat('th-TH-u-ca-buddhist', { ...formats[format], timeZone: 'Asia/Bangkok' });
    cache.set(format, f);
  }
  return f.format(typeof value === 'string' ? new Date(value) : value);
}

@Pipe({ name: 'stThaiDate' })
export class StThaiDatePipe implements PipeTransform {
  transform(value: string | Date | null | undefined, format: keyof typeof formats = 'datetime'): string {
    return value ? formatThaiDate(value, format) : '';
  }
}
