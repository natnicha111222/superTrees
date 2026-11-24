#!/usr/bin/env node
// รันทุก repo พร้อมกันสำหรับ dev — ไม่มี dependency (Node 18+)
//   node scripts/dev.mjs frontend | backend | all
//
// - หา repo จากโฟลเดอร์แม่ของ st-infra (workspace D:\superTrees) — เปลี่ยนได้ด้วย env ST_WORKSPACE
// - แต่ละ repo ต้องมี script "dev" ใน package.json · ยังไม่มี = ข้ามพร้อมแจ้ง
// - ส่ง env PORT ให้ทุกตัว: service อ่าน PORT · หน้าบ้าน (ng serve) ใช้ port ใน angular.json ซึ่งต้องตรงตารางนี้
// - port ถูกใช้อยู่แล้ว = ข้าม (ถือว่ารันอยู่) · ตัวใดตัวหนึ่งตาย = ตัวอื่นยังรันต่อ
// - Ctrl+C หยุดทุกตัว (รวม process ลูก เช่น ng serve / bun --watch)
// - เลือกบางตัว: ST_ONLY=parcel,mfe-map npm run dev:backend
//
// ตาราง port ต้องตรงกับ PROJECT_STRUCTURE.md ของ workspace

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOS = {
  backend: [
    { name: 'parcel', dir: 'st-parcel-service', port: 3001, run: 'bun' },
    { name: 'listing', dir: 'st-listing-service', port: 3002, run: 'bun' },
    { name: 'garden', dir: 'st-garden-service', port: 3003, run: 'bun' },
    { name: 'notification', dir: 'st-notification-service', port: 3004, run: 'bun' },
  ],
  frontend: [
    // remote ก่อน shell — shell อ่าน federation.manifest.json ตอนเปิดหน้า
    { name: 'mfe-map', dir: 'st-mfe-map', port: 4201, run: 'npm' },
    { name: 'mfe-listing', dir: 'st-mfe-listing', port: 4202, run: 'npm' },
    { name: 'mfe-garden', dir: 'st-mfe-garden', port: 4203, run: 'npm' },
    { name: 'shell', dir: 'st-shell', port: 4200, run: 'npm' },
  ],
};

const COLORS = [36, 35, 33, 32, 34, 91, 96, 95];
const isWin = process.platform === 'win32';
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);

const group = process.argv[2];
if (!['frontend', 'backend', 'all'].includes(group)) {
  console.error('ใช้: node scripts/dev.mjs <frontend|backend|all>');
  process.exit(2);
}

const workspace = resolve(process.env.ST_WORKSPACE ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..'));
const only = process.env.ST_ONLY?.split(',').map((s) => s.trim()).filter(Boolean);
let targets = group === 'all' ? [...REPOS.backend, ...REPOS.frontend] : REPOS[group];
if (only?.length) targets = targets.filter((t) => only.includes(t.name) || only.includes(t.dir));

const width = Math.max(...targets.map((t) => t.name.length), 4);
const tag = (t, i) => paint(COLORS[i % COLORS.length], `[${t.name.padEnd(width)}]`);
const info = (msg) => console.log(paint(90, `[${'dev'.padEnd(width)}]`), msg);

/** ตรวจว่ามี port เปิดอยู่แล้วหรือยัง (ลองต่อ localhost) */
function portInUse(port) {
  return new Promise((done) => {
    const sock = createConnection({ port, host: '127.0.0.1' });
    sock.setTimeout(500);
    sock.once('connect', () => { sock.destroy(); done(true); });
    sock.once('timeout', () => { sock.destroy(); done(false); });
    sock.once('error', () => done(false));
  });
}

function hasDevScript(dir) {
  const pkg = join(dir, 'package.json');
  if (!existsSync(pkg)) return 'ไม่มี package.json';
  try {
    return JSON.parse(readFileSync(pkg, 'utf8')).scripts?.dev ? null : 'package.json ไม่มี script "dev"';
  } catch {
    return 'อ่าน package.json ไม่ได้';
  }
}

function commandExists(cmd) {
  const r = spawnSync(isWin ? 'where' : 'which', [cmd], { stdio: 'ignore' });
  return r.status === 0;
}

/** ส่งต่อ output ทีละบรรทัด พร้อมป้ายชื่อ */
function pipeLines(stream, prefix, out) {
  let buf = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buf += chunk;
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() ?? '';
    for (const line of lines) out.write(`${prefix} ${line}\n`);
  });
  stream.on('end', () => { if (buf) out.write(`${prefix} ${buf}\n`); });
}

const children = new Map();
let stopping = false;

function killTree(child) {
  if (child.exitCode !== null || child.pid === undefined) return;
  if (isWin) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { /* ตายไปแล้ว */ }
  }
}

function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  info('กำลังหยุดทุกตัว…');
  for (const child of children.values()) killTree(child);
  setTimeout(() => process.exit(code), 300);
}
process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

const runners = { bun: commandExists('bun'), npm: commandExists('npm') };
info(`workspace: ${workspace} · กลุ่ม: ${group}`);

let started = 0;
for (const [i, t] of targets.entries()) {
  const dir = join(workspace, t.dir);
  const label = tag(t, i);
  if (!existsSync(dir)) { console.log(label, paint(33, `ข้าม — ไม่พบโฟลเดอร์ ${dir}`)); continue; }
  const missing = hasDevScript(dir);
  if (missing) { console.log(label, paint(33, `ข้าม — ${missing} (ยังไม่ได้ทำ TASK-002?)`)); continue; }
  if (!runners[t.run]) { console.log(label, paint(31, `ข้าม — ไม่พบคำสั่ง ${t.run} ใน PATH`)); continue; }
  if (await portInUse(t.port)) { console.log(label, paint(33, `ข้าม — port ${t.port} ถูกใช้อยู่แล้ว (รันอยู่ก่อนแล้ว?)`)); continue; }

  // Windows: npm เป็น .cmd ต้องผ่าน shell → ส่งเป็นสตริงเดียว (คำสั่งคงที่ ไม่มีค่าจากภายนอก)
  const child = spawn(isWin ? `${t.run} run dev` : t.run, isWin ? [] : ['run', 'dev'], {
    cwd: dir,
    shell: isWin,
    detached: !isWin, // ให้ kill ทั้ง process group ได้
    env: { ...process.env, PORT: String(t.port), FORCE_COLOR: useColor ? '1' : '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.set(t.name, child);
  started++;
  console.log(label, paint(32, `เริ่ม: ${t.run} run dev · port ${t.port}`));
  pipeLines(child.stdout, label, process.stdout);
  pipeLines(child.stderr, label, process.stderr);
  child.on('exit', (code, signal) => {
    children.delete(t.name);
    if (!stopping) console.log(label, paint(31, `หยุดทำงาน (code ${code ?? signal})`));
    if (!stopping && children.size === 0) {
      info('ไม่มีตัวไหนรันอยู่แล้ว');
      process.exit(code ?? 1);
    }
  });
}

if (started === 0) {
  info('ไม่มีอะไรให้รัน');
  process.exit(0);
}
info(`รันอยู่ ${started} ตัว — Ctrl+C เพื่อหยุดทั้งหมด`);
