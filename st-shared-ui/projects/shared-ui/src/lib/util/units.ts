// หน่วยไทย — มีแค่ตอนแสดงผล/รับค่า (CLAUDE.md) · เก็บจริงเป็น ตร.ม. / เมตร
export const SQM_PER_RAI = 1600;
export const SQM_PER_NGAN = 400;
export const SQM_PER_WA = 4;

export interface RaiNganWa {
  rai: number;
  ngan: number;
  /** ตร.วา (ทศนิยม 1 ตำแหน่ง) */
  wa: number;
}

export function sqmToRaiNganWa(sqm: number): RaiNganWa {
  const rai = Math.floor(sqm / SQM_PER_RAI);
  const rest = sqm - rai * SQM_PER_RAI;
  const ngan = Math.floor(rest / SQM_PER_NGAN);
  const wa = Math.round(((rest - ngan * SQM_PER_NGAN) / SQM_PER_WA) * 10) / 10;
  return { rai, ngan, wa };
}

export function raiNganWaToSqm({ rai, ngan, wa }: RaiNganWa): number {
  return rai * SQM_PER_RAI + ngan * SQM_PER_NGAN + wa * SQM_PER_WA;
}
