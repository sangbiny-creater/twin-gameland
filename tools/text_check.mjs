// 글자 칸 검사: 모든 화면(첫 화면·지도·아이템샵·옷장·랭킹·게임 준비/일시정지/결과/HUD·상용화 창)에서
//  그림 위 글자가 그림 속 글자 칸을 넘는지·가운데인지 자동으로 잼 (tools/text_probe.js)
//   node tools/text_check.mjs <출력폴더> [이름 필터(정규식)]      BASE=http://localhost:8080/
//  한국어/영어 × 은유(c1)/은결(c2) × 폰 세로(pp)·가로(pl)·태블릿(tb). 결과: <출력폴더>/text_report.json, 화면마다 캡처
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] || 'shots_text');
const FILTER = process.argv[3] ? new RegExp(process.argv[3]) : null;
const BASE = process.env.BASE || 'http://localhost:8080/';
const SHOTS = !process.env.NOSHOT;
fs.mkdirSync(OUT, { recursive: true });
const PORT = 9400 + Math.floor(Math.random() * 400);
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'twin-chrome-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--hide-scrollbars', '--mute-audio', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PROBE = fs.readFileSync(new URL('./text_probe.js', import.meta.url), 'utf8');

// ---- 저장 데이터 (진행한 캐릭터 4명) ----
const stages = (n) => Object.fromEntries([...Array(Math.round(n))].map((_, i) => [i, { cleared: true, stars: (i % 3) + 1, best: 300 + i * 10, plays: 2, bestTime: 60 + i }]));
const shop = (extra = {}) => ({ skins: {}, equipped: {}, boosts: { shisen: { hint: 3, shuffle: 2, time: 1 }, memory: { hint: 2, find: 1 }, skyhook: { life: 1 } }, using: {}, skinAll: ['forest'], skinOn: 'default', starter: { shisen: true, memory: true }, ...extra });
const games = (k) => ({
  skyhook: { plays: 20, best: 640, coins: 900, last: 1, stages: stages(12 * k) }, shisen: { plays: 30, best: 0, coins: 1200, last: 1, stages: stages(25 * k) },
  memory: { plays: 9, best: 0, coins: 300, last: 1, stages: stages(8 * k) }, mole: { plays: 3, best: 0, coins: 50, last: 1, stages: stages(5 * k) },
  helicopter: { plays: 5, best: 812, coins: 200, last: 1, stages: {} }, stairs: { plays: 4, best: 230, coins: 150, last: 1, stages: {} },
  downhill: { plays: 3, best: 1520, coins: 120, last: 1, stages: {} }, bakery: { plays: 2, best: 3400, coins: 80, last: 1, stages: {} },
});
// v0.3 상용화 검수(common/monet.js): 환영 선물·출석 창이 화면을 가리지 않게 이미 받은 상태로, 게임은 모두 열어 둠
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const v3 = () => ({ tickets: 0, unlocked: ['skyhook', 'helicopter', 'stairs', 'shisen', 'downhill', 'memory', 'mole', 'bakery', 'dogsnack', 'darts', 'giftsort', 'burger'], dUnlocks: 0, plays: 5, att: { count: 3, last: today() }, welcomed: true });
const hist = [{ game: 'shisen', at: 1761300000000, stage: 24, cleared: true, dist: 0, earned: 80, stars: 3 }];
const seed = (active) => ({
  v: 1, slots: 4, nextId: 5, activeId: active, settings: { sound: true },
  chars: [
    { id: 'c1', name: '은유', look: 'eunyu3', coins: 1234, earned: 4321, created: 1, games: games(1), history: hist, favs: ['shisen'], shop: shop(), v3: v3() },
    { id: 'c2', name: '은결', look: 'eungyeol3', coins: 300, earned: 900, created: 2, games: games(0.3), history: hist, shop: shop(), v3: v3() },
    { id: 'c3', name: '옛은유', look: 'eunyu', coins: 700, earned: 2600, created: 3, games: games(2), history: hist, costume: 'hanbok', costumes: ['hanbok'], shop: shop() },
    { id: 'c4', name: '친구', look: 'eungyeol2', coins: 50, earned: 50, created: 4, games: {}, history: [] },
  ],
});


// ---- 화면과 그 안의 상태들 ----
const VP = { pp: [390, 844], pl: [844, 390], tb: [1024, 768] };
const hideAll = `document.querySelectorAll('#gpStart,.mn-modal').forEach((e) => e.remove()); document.querySelectorAll('.screen.dim,#ready,#pause,#result,#choose,.modal').forEach((e) => e.classList.add('hidden'));`;
const show = (id, extra = '') => `(() => { ${hideAll} const e = document.getElementById('${id}'); if (!e) return 'none'; e.classList.remove('hidden'); ${extra} })()`;
const GAMES = ['skyhook', 'helicopter', 'stairs', 'shisen', 'downhill', 'memory', 'mole', 'bakery', 'dogsnack', 'darts', 'giftsort', 'burger'];
const STAGE = { shisen: '?stage=0', memory: '?stage=0', mole: '?stage=0', giftsort: '?stage=0', burger: '?stage=0', skyhook: '?stage=0' };
const PAGES = [];
const page = (name, url, states, o = {}) => PAGES.push({ name, url, states, ...o });
// 첫 화면
page('hub-select', 'index.html#select', { base: '' });
page('hub-lobby', 'index.html#lobby', {
  base: '', top: `document.getElementById('pkScroll').scrollTop = 0`, mid: `document.getElementById('pkScroll').scrollTop = 900`,
  settings: show('popSettings'), rename: show('popRename'), lang: show('popLang'), confirm: show('popConfirm', "const t = document.querySelector('#popConfirm .p-title, #popConfirm .m-title'); if (t && !t.textContent.trim()) t.textContent = '정말 지울까요?';"), create: show('popCreate'),
  gems: `(() => { ${hideAll} document.getElementById('btnGems') && document.getElementById('btnGems').click(); })()`,
  attend: `(() => { ${hideAll} Monet.attend && Monet.attend(); })()`,
  stage: show('popStage'),
  login: `(() => { ${hideAll} window.Auth && Auth.login(); })()`,
});
for (const g of ['shisen', 'memory', 'mole', 'giftsort', 'burger', 'skyhook']) page(`hub-map-${g}`, `index.html#map-${g}`, { base: '' });
page('hub-locked', 'index.html#lobby', { base: `(() => { document.querySelectorAll('.mn-modal').forEach((m) => m.remove()); const r = document.querySelector('.pk-ride.mn-locked'); if (r) r.click(); })()` }, { ch: 'c4' });
page('shop', 'shop/index.html', { base: '', t1: `document.querySelectorAll('.sh-tabs button')[1] && document.querySelectorAll('.sh-tabs button')[1].click()`, t2: `document.querySelectorAll('.sh-tabs button')[2] && document.querySelectorAll('.sh-tabs button')[2].click()`,
  coupon: `document.getElementById('btnCoupon') && document.getElementById('btnCoupon').click()`, attend: `document.querySelector('.sh-card.att') && document.querySelector('.sh-card.att').click()` });
page('closet', 'closet/index.html', { base: '' });
page('ranking', 'ranking/index.html', { base: '' });
for (const g of GAMES) page(`game-${g}`, `${g}/index.html${STAGE[g] || ''}`, {
  base: '',
  pause: show('pause'),
  result: show('result', `try { Hub.record('${g}', { dist: 1200, coins: 40, cleared: true, stage: 0, stars: 2 }); } catch (e) {}`),
  hud: `(() => { try { if (window.startRun) startRun(1); else if (window.startStage) startStage(0); } catch (e) {} ${hideAll} document.querySelectorAll('#home').forEach((e) => e.classList.add('hidden')); const h = document.getElementById('hud'); h && h.classList.remove('hidden'); })()`,
}, { wait: 2600 });

const LANGS = (process.env.LANGS || 'ko,en').split(',');
const WHOS = (process.env.WHOS || 'c1,c2').split(',');
const VPS = (process.env.VPS || 'pp,pl,tb').split(',');
// ---- CDP ----
async function wsUrl() {
  for (let i = 0; i < 50; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) return (await r.json()).webSocketDebuggerUrl; } catch (e) { /* wait */ } await sleep(200); }
  throw new Error('chrome not up');
}
const ws = new WebSocket(await wsUrl());
await new Promise((r) => ws.addEventListener('open', r));
let mid = 0; const pend = new Map(); const handlers = [];
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { const p = pend.get(d.id); pend.delete(d.id); d.error ? p.rej(new Error(JSON.stringify(d.error))) : p.res(d.result); } else for (const h of handlers) h(d);
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const id = ++mid; pend.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId }));
  setTimeout(() => { if (pend.has(id)) { pend.delete(id); rej(new Error('timeout ' + method)); } }, 25000);
});
// outfit: 그 캐릭터가 옷을 입은 상태로 (예: { ch: 'c2', outfit: 'home' })
const seedFor = (sc) => { const d = seed(sc.ch || 'c1'); if (sc.outfit) for (const c of d.chars) if (c.id === (sc.ch || 'c1')) { c.outfits = [sc.outfit]; c.outfit = sc.outfit; } return d; };
const PRE = (data, empty) => `(() => {
  let s = 12345; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  try { if (!sessionStorage.getItem('__seeded')) { localStorage.clear(); ${empty ? '' : `localStorage.setItem('twin_gameland_v1', ${JSON.stringify(JSON.stringify(data))});`} localStorage.setItem('twin_tip_closed', '1'); ${empty ? '' : `localStorage.setItem('twin_auth_v1', '{"mode":"guest","uid":"local-test","at":1}');`} sessionStorage.setItem('__seeded', '1'); } } catch (e) {}
})();`;


const all = [];
for (const pg of PAGES) for (const lang of LANGS) for (const ch of (pg.ch ? [pg.ch] : WHOS)) for (const vp of VPS) {
  const name = `${pg.name}-${lang}-${ch === 'c2' ? 'gyeol' : ch === 'c1' ? 'yu' : ch}-${vp}`;
  if (FILTER && !FILTER.test(name)) continue;
  try {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Page.enable', {}, sessionId); await send('Runtime.enable', {}, sessionId);
    const [w, ht] = VP[vp];
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: ht, deviceScaleFactor: 2, mobile: true, screenOrientation: w > ht ? { type: 'landscapePrimary', angle: 90 } : { type: 'portraitPrimary', angle: 0 } }, sessionId);
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId);
    const d = seed(ch); d.settings.lang = lang;
    await send('Page.addScriptToEvaluateOnNewDocument', { source: PRE(d) }, sessionId);
    await send('Page.navigate', { url: BASE + pg.url }, sessionId);
    await sleep(pg.wait || 2200);
    await send('Runtime.evaluate', { expression: PROBE }, sessionId);
    for (const [st, js] of Object.entries(pg.states)) {
      if (js) { await send('Runtime.evaluate', { expression: js, awaitPromise: true }, sessionId); await sleep(700); }
      const r = await send('Runtime.evaluate', { expression: '__textProbe()', awaitPromise: true, returnByValue: true }, sessionId);
      const items = (r.result && r.result.value) || [];
      if (r.exceptionDetails) console.log('\nJS', name, st, r.exceptionDetails.exception?.description?.split('\n')[0]);
      for (const it of items) all.push({ screen: `${name}:${st}`, ...it });
      if (SHOTS) { const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }, sessionId); fs.writeFileSync(path.join(OUT, `${name}_${st}.jpg`), Buffer.from(shot.data, 'base64')); }
    }
    await send('Target.closeTarget', { targetId });
    process.stdout.write('.');
  } catch (e) { console.log('\nERR', name, e.message); }
}
fs.writeFileSync(path.join(OUT, 'text_report.json'), JSON.stringify(all, null, 1));
const TOL = 1.5;
const bad = all.filter((x) => Math.max(x.over.l, x.over.t, x.over.r, x.over.b) > TOL || x.clip);
const offc = all.filter((x) => !bad.includes(x) && !x.multi && (Math.abs(x.off.x) > Math.max(3, x.fw * 0.05) && x.align !== 'left' && x.align !== 'start' || Math.abs(x.off.y) > Math.max(2, x.fh * 0.08)));
console.log(`\n글자 ${all.length}개 / 넘침·잘림 ${bad.length}개 / 가운데 아님 ${offc.length}개`);
const group = (arr) => { const m = new Map(); for (const x of arr) { const k = x.sel + ' | ' + x.img; const g = m.get(k) || { k, n: 0, ex: [] }; g.n++; if (g.ex.length < 4) g.ex.push(`${x.screen} "${x.text}" over=${JSON.stringify(x.over)} off=${JSON.stringify(x.off)}${x.clip ? ' CLIP' : ''} fs=${x.fs} face=${x.fw}x${x.fh}`); m.set(k, g); } return [...m.values()].sort((a, b) => b.n - a.n); };
fs.writeFileSync(path.join(OUT, 'summary.txt'), '## 넘침·잘림\n' + group(bad).map((g) => `${g.n}x ${g.k}\n  ${g.ex.join('\n  ')}`).join('\n') + '\n\n## 가운데 아님\n' + group(offc).map((g) => `${g.n}x ${g.k}\n  ${g.ex.join('\n  ')}`).join('\n'));
chrome.kill(); await sleep(300); try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) { /* ignore */ }
process.exit(0);
