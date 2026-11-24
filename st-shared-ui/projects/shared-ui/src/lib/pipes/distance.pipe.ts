import { Pipe, type PipeTransform } from '@angular/core';

/** เมตร → "4.2 ม." / "1.35 กม." */
@Pipe({ name: 'stDistance' })
export class StDistancePipe implements PipeTransform {
  transform(m: number | null | undefined, digits = 1): string {
    if (m == null) return '';
    return m >= 1000 ? `${(m / 1000).toFixed(2)} กม.` : `${m.toFixed(digits)} ม.`;
  }
}
