// npm pack → copy .tgz ไป vendor/ ของ repo ที่ใช้ (ตามที่ผู้ใช้เลือก: tarball ใน vendor/ — STR-005)
//   node scripts/pack-vendor.mjs [ชื่อ repo ...]   (ไม่ระบุ = ทุก repo ที่มี vendor/ ใช้ package นี้อยู่)
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspace = resolve(process.env.ST_WORKSPACE ?? join(root, '..'));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const baseName = pkg.name.replace('@', '').replace('/', '-');

const out = execSync('npm pack --silent', { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/).pop();
const tgz = join(root, out);

const wanted = process.argv.slice(2);
const targets = wanted.length
  ? wanted
  : readdirSync(workspace).filter((d) => {
      const p = join(workspace, d, 'package.json');
      if (!d.startsWith('st-') || !existsSync(p)) return false;
      const deps = { ...JSON.parse(readFileSync(p, 'utf8')).dependencies };
      return pkg.name in deps;
    });

for (const repo of targets) {
  const vendor = join(workspace, repo, 'vendor');
  mkdirSync(vendor, { recursive: true });
  // ลบเวอร์ชันเก่าของ package นี้
  for (const f of readdirSync(vendor)) if (f.startsWith(baseName + '-') && f.endsWith('.tgz')) rmSync(join(vendor, f));
  copyFileSync(tgz, join(vendor, out));
  console.log(`${out} → ${repo}/vendor/  (แล้วรัน npm/bun install ใน ${repo})`);
}
rmSync(tgz);
