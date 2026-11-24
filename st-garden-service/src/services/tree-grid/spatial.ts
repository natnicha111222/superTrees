// ตารางแบ่งช่องสำหรับหา "จุดที่อยู่ใกล้กว่า r" เร็ว ๆ (แทนการไล่ทุกคู่ O(n²))

export class PointGrid<T extends { x: number; y: number }> {
  private readonly cells = new Map<string, T[]>();

  constructor(private readonly cellSize: number) {}

  private key(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  add(item: T): void {
    const k = this.key(Math.floor(item.x / this.cellSize), Math.floor(item.y / this.cellSize));
    const list = this.cells.get(k);
    if (list) list.push(item);
    else this.cells.set(k, [item]);
  }

  /** ตัวแรก (ตามลำดับที่ add ในแต่ละช่อง) ที่อยู่ห่างจาก (x, y) น้อยกว่า r — r ต้องไม่เกิน cellSize */
  findWithin(x: number, y: number, r: number): T | undefined {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const it of this.cells.get(this.key(cx + dx, cy + dy)) ?? []) {
          if (Math.hypot(it.x - x, it.y - y) < r) return it;
        }
      }
    }
    return undefined;
  }

  /** ทุกตัวที่อยู่ห่างจาก (x, y) ไม่เกิน r — r ต้องไม่เกิน cellSize */
  within(x: number, y: number, r: number): { item: T; d: number }[] {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const out: { item: T; d: number }[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const it of this.cells.get(this.key(cx + dx, cy + dy)) ?? []) {
          const d = Math.hypot(it.x - x, it.y - y);
          if (d <= r) out.push({ item: it, d });
        }
      }
    }
    return out;
  }

  /** ระยะ/ตัวที่ใกล้ที่สุด โดยขยายวงค้นทีละชั้นจนแน่ใจ (ไม่นับตัวที่ skip) */
  nearest(x: number, y: number, skip?: T): { item: T; d: number } | undefined {
    if (this.cells.size === 0) return undefined;
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    let best: { item: T; d: number } | undefined;
    for (let ring = 0; ; ring++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          for (const it of this.cells.get(this.key(cx + dx, cy + dy)) ?? []) {
            if (it === skip) continue;
            const d = Math.hypot(it.x - x, it.y - y);
            if (!best || d < best.d) best = { item: it, d };
          }
        }
      }
      // จุดในชั้นถัดไปอยู่ห่างอย่างน้อย ring * cellSize
      if (best && best.d <= ring * this.cellSize) return best;
      if (ring > 1e5) return best;
    }
  }
}
