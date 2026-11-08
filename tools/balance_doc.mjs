// 게임 난이도·보상 기준 문서 만들기 → 백오피스 '난이도·보상 기준' 탭 (admin/balance/)
//   node tools/balance_doc.mjs        (로컬 서버 python3 -m http.server 8080 이 켜져 있어야 PDF 를 만듦)
// · 글·표: tools/balance_base.json (손으로 고치는 곳). { calc: '…' } 자리는 아래에서 게임 코드로 계산해 채움
//   - 스테이지 게임 4개 월드별 표: <게임>/levels.js 의 판 정의에서 바로 계산 (판을 바꾸면 이 도구만 다시 돌리면 됨)
//   - 옷: common/profile.js 의 OUTFITS
// · 만드는 것: admin/balance/balance.json (탭이 읽음) · balance.docx (Word, tools/balance_docx.py) · balance.pdf (헤드리스 Chrome 인쇄)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'admin/balance');
const load = (rel, name) => { const ctx = { window: {} }; ctx.self = ctx.window; vm.runInNewContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx); return ctx.window[name] || ctx[name]; };

const N = (v, d = 0) => Number(v.toFixed(d)).toLocaleString('en-US');
const pct = (v) => (v ? Math.round(v * 100) + '%' : '없음');
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const span = (a, b, f = (x) => x, suf = '') => { const x = f(a), y = f(b); return (x === y ? x : `${x}→${y}`) + suf; };
// 월드마다 첫 판 → 마지막 판
function worlds(stages, mode, cols) {
  const list = stages.filter((s) => s.mode === mode), out = [];
  for (let w = 0; w < 10; w++) {
    const a = list[w * 10], b = list[w * 10 + 9], all = list.slice(w * 10, w * 10 + 10);
    out.push([`${mode === 'hard' ? '어려움 ' : ''}${w + 1}월드`, ...cols.map(([, f]) => f(a, b, all))]);
  }
  return { table: [['월드', ...cols.map(([h]) => h)], ...out] };
}

const Mole = load('mole/levels.js', 'MoleLevels');
const Mem = load('memory/levels.js', 'MemoryLevels');
const Shi = load('shisen/levels.js', 'ShisenLevels');
const Gift = load('giftsort/levels.js', 'GiftLevels');

const MOLE = [
  ['시간', (a, b) => span(a.time, b.time, String, '초')],
  ['나오는 간격', (a, b) => span(a.gap, b.gap, String, '초')],
  ['머무는 시간', (a, b) => span(a.stay, b.stay, String, '초')],
  ['동시 최대', (a, b) => span(a.maxOn, b.maxOn, String, '마리')],
  ['빠른', (a, b) => span(a.fast, b.fast, pct)],
  ['2대', (a, b) => span(a.tough, b.tough, pct)],
  ['함정', (a, b) => span(a.trap, b.trap, pct) + (a.both ? '\n(은유·은결 둘 다)' : '')],
  ['별1 (목표)', (a, b) => span(a.goal, b.goal, N)],
  ['별2', (a, b) => span(a.s2, b.s2, N)],
  ['별3', (a, b) => span(a.s3, b.s3, N)],
];
const MEM = [
  ['짝 수 (카드)', (a, b) => `${span(a.pairs, b.pairs, String, '쌍')} (${span(a.cards, b.cards, String, '장')})`],
  ['추억 카드', (a, b) => span(a.scenes, b.scenes, (v) => (v ? v + '쌍' : '없음'))],
  ['미리 보기', (a, b) => span(a.preview, b.preview, String, '초')],
  ['제한 시간', (a, b) => span(a.s, b.s, String, '초')],
  ['짝 1쌍당 시간\n(10초 빼고)', (a, b) => span((a.s - 10) / a.pairs, (b.s - 10) / b.pairs, (v) => v.toFixed(1), '초')],
];
const SHI = [
  ['1층 크기', (a, b) => span(`${a.c}×${a.r}`, `${b.c}×${b.r}`)],
  ['2층 타일', (a, b) => span(a.n2, b.n2, String)],
  ['3층 타일', (a, b) => span(a.n3, b.n3, String)],
  ['전체 타일', (a, b) => span(a.tiles, b.tiles, String, '장')],
  ['그림 종류', (a, b) => span(a.t, b.t, String, '종')],
  ['제한 시간', (a, b) => span(a.s, b.s, mmss)],
  ['타일당 시간', (a, b) => span(a.s / a.tiles, b.s / b.tiles, (v) => v.toFixed(2), '초')],
];
const cartN = (s) => s.carts.length, filled = (s) => s.carts.filter((c) => c).length;
const GIFT = [
  ['선물 종류', (a, b) => span(a.colors, b.colors, String, '종')],
  ['카트 (빈 카트)', (a, b) => `${span(cartN(a), cartN(b), String, '개')} (${span(cartN(a) - filled(a), cartN(b) - filled(b), String)})`],
  ['깜짝 상자', (a, b) => span(a.hid.reduce((x, y) => x + y, 0), b.hid.reduce((x, y) => x + y, 0), (v) => (v ? v + '칸' : '없음'))],
  ['리본 카트', (a, b, all) => { const n = all.filter((x) => x.lock >= 0).length; return n ? `10판 중 ${n}판` : '없음'; }],
  ['황금 선물', (a, b, all) => { const n = all.filter((x) => x.gold).length; return n ? `10판 중 ${n}판` : '없음'; }],
  ['컴퓨터 풀이 (par)', (a, b) => span(a.par, b.par, String, '번')],
];

// 옷 (common/profile.js OUTFITS 를 그대로 읽음)
function outfits() {
  const src = fs.readFileSync(path.join(ROOT, 'common/profile.js'), 'utf8');
  const m = src.match(/const OUTFIT_PRICE = (\d+), OUTFIT_SLOW = ([\d.]+);\s*const OUTFITS = (\{[\s\S]*?\n {2}\});/);
  const O = vm.runInNewContext(`const OUTFIT_PRICE=${m[1]};(${m[3]})`), slow = Number(m[2]);
  const GN = { downhill: '다운힐', bakery: '달콤 베이커리' };
  const rows = [], seen = new Map();
  for (const [who, list] of [['은유', O.eunyu], ['은결', O.eungyeol]]) for (const o of list) {
    const eff = o.slow ? `${GN[o.slow] || o.slow}: ${slow}배 속도로 천천히 (그 게임만)` : '없음 (꾸미기)';
    const k = `${o.price}|${eff}`;
    if (!seen.has(k)) { seen.set(k, rows.length); rows.push([[], o.price, eff]); }
    rows[seen.get(k)][0].push(`${who} ${o.name}`);
  }
  return { table: [['옷', '가격(다이아)', '효과'], ...rows.map(([n, p, e]) => [n.join(' · '), String(p), e])] };
}

const CALC = {
  outfits,
  'mole-easy': () => worlds(Mole.STAGES, 'easy', MOLE), 'mole-hard': () => worlds(Mole.STAGES, 'hard', MOLE),
  'memory-easy': () => worlds(Mem.STAGES, 'easy', MEM), 'memory-hard': () => worlds(Mem.STAGES, 'hard', MEM),
  'shisen-easy': () => worlds(Shi.STAGES, 'easy', SHI), 'shisen-hard': () => worlds(Shi.STAGES, 'hard', SHI),
  'giftsort-easy': () => worlds(Gift.STAGES, 'easy', GIFT), 'giftsort-hard': () => worlds(Gift.STAGES, 'hard', GIFT),
};

const d = new Date(), date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/balance_base.json'), 'utf8'));
const blocks = base.map((b) => (b.calc ? CALC[b.calc]() : b.sub ? { sub: b.sub.replace('{{DATE}}', `기준일 ${date}`) } : b));
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'balance.json'), JSON.stringify({ date, blocks }, null, 1));
console.log('balance.json', blocks.length, '칸');

// Word
const py = spawnSync('python3', [path.join(ROOT, 'tools/balance_docx.py'), path.join(OUT, 'balance.json'), path.join(OUT, 'balance.docx')], { stdio: 'inherit' });
if (py.status) process.exit(py.status);

// PDF: print.html 을 헤드리스 Chrome 으로 인쇄
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'balpdf-'));
const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${tmp}`, '--no-pdf-header-footer', '--virtual-time-budget=5000',
  `--print-to-pdf=${path.join(OUT, 'balance.pdf')}`, `http://localhost:8080/admin/balance/print.html?t=${Date.now()}`], { stdio: 'pipe' });
fs.rmSync(tmp, { recursive: true, force: true });
if (r.status) { console.error(String(r.stderr)); process.exit(1); }
console.log('balance.pdf', Math.round(fs.statSync(path.join(OUT, 'balance.pdf')).size / 1024), 'KB');
