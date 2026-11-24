import { Pipe, type PipeTransform } from '@angular/core';
import { sqmToRaiNganWa } from '../util/units';

/** ตร.ม. → "2 ไร่ 1 งาน 30.5 ตร.วา" */
@Pipe({ name: 'stRaiNganWa' })
export class StRaiNganWaPipe implements PipeTransform {
  transform(sqm: number | null | undefined): string {
    if (sqm == null) return '';
    const { rai, ngan, wa } = sqmToRaiNganWa(sqm);
    const parts = [rai && `${rai.toLocaleString('th-TH')} ไร่`, ngan && `${ngan} งาน`, (wa || (!rai && !ngan)) && `${wa} ตร.วา`];
    return parts.filter(Boolean).join(' ');
  }
}
