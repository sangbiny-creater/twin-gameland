// 화면 확인 도구: 헤드리스 Chrome으로 화면을 찍고 콘솔 오류·없는 파일(404)을 모음
//   node tools/screen_check.mjs <출력폴더> [이름 필터(정규식)]
//   BASE=http://localhost:8080/ (기본) — 먼저 python3 -m http.server 8080 으로 저장소를 열어 둠
// 진행도가 있는 캐릭터 저장 데이터를 넣고 엶. 결과: <출력폴더>/<이름>.png, report.json(이름 → 오류 목록)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] || 'shots');
const FILTER = process.argv[3] ? new RegExp(process.argv[3]) : null;
const BASE = process.env.BASE || 'http://localhost:8080/';
fs.mkdirSync(OUT, { recursive: true });
const PORT = 9400 + Math.floor(Math.random() * 400);
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'twin-chrome-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', '--mute-audio', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
const v3 = () => ({ tickets: 0, unlocked: ['skyhook', 'helicopter', 'stairs', 'shisen', 'downhill', 'memory', 'mole', 'bakery', 'dogsnack', 'darts'], dUnlocks: 0, plays: 5, att: { count: 3, last: today() }, welcomed: true });
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

// ---- 화면 목록: { name, url, vp, ch, js, wait, wait2, empty } ----
const VP = { pp: [390, 844], pl: [844, 390], tb: [1024, 768], tp: [768, 1024], pc: [1280, 800, 'desktop'] };
const S = [];
const add = (name, url, o = {}) => S.push({ name, url, ...o });
for (const vp of ['pp', 'pl', 'tb']) {
  add(`hub-select-${vp}`, 'index.html#select', { vp });
  add(`hub-lobby-${vp}`, 'index.html#lobby', { vp });
  add(`hub-lobby-mid-${vp}`, 'index.html#lobby', { vp, js: `(document.querySelector('.pk-scroll')||document.querySelector('.lb-scroll')).scrollTop = 900`, wait2: 600 });
  add(`hub-lobby-top-${vp}`, 'index.html#lobby', { vp, js: `(document.querySelector('.pk-scroll')||document.querySelector('.lb-scroll')).scrollTop = 0`, wait2: 600 });
  add(`hub-lobby-eungyeol-${vp}`, 'index.html#lobby', { vp, ch: 'c2' });
  add(`hub-edit-${vp}`, 'index.html#lobby', { vp, js: `document.getElementById('pkEdit') && document.getElementById('pkEdit').click()`, wait2: 700 });
  add(`hub-intro-${vp}`, 'index.html#lobby', { vp, js: `document.querySelector('.pk-ride[data-id=downhill], .lb-card').click()`, wait2: 1500 });
  add(`hub-map-${vp}`, 'index.html#map-shisen', { vp });
  add(`hub-records-${vp}`, 'index.html#records', { vp });
  add(`v01-lobby-${vp}`, 'v0.1/#lobby', { vp });
  add(`v01-map-${vp}`, 'v0.1/#map-shisen', { vp });
  add(`v02-lobby-${vp}`, 'v0.2/#lobby', { vp });
  add(`shop-${vp}`, 'shop/index.html', { vp });
}
add('hub-lobby-oldlook-pp', 'index.html#lobby', { vp: 'pp', ch: 'c3' });
add('hub-lobby-tp', 'index.html#lobby', { vp: 'tp' });
// 이름판 검사: 화면을 위·가운데·아래로 옮기며 이름판 위치와 글자가 칸을 넘는지 (넘침 = scrollWidth > clientWidth)
for (const [k, top] of [['bottom', 99999], ['mid', 700], ['top', 0]]) for (const vp of ['pp', 'tb']) add(`hub-plates-${k}-${vp}`, 'index.html#lobby', { vp, js: `(async () => { document.getElementById('pkScroll').scrollTop = ${top}; await new Promise((r) => setTimeout(r, 400)); return [...document.querySelectorAll('.pk-ride .name')].map((n) => { const r = n.getBoundingClientRect(); const over = [...n.querySelectorAll('b, small')].some((e) => e.scrollWidth > e.clientWidth + 0.5); return { t: n.querySelector('b').textContent, x: r.x, y: r.y, w: r.width, h: r.height, over, fs: getComputedStyle(n.querySelector('b')).fontSize }; }).filter((q) => q.y > -60 && q.y < innerHeight); })()` });
add('hub-ribbon-pp', 'index.html#lobby', { vp: 'pp', js: "document.querySelectorAll('.pk-ride .name.wood').forEach((e) => { e.classList.remove('wood'); e.classList.add('ribbon'); })", wait2: 400 });
add('hub-decopick-pp', 'index.html#lobby', { vp: 'pp', js: "document.querySelector('.pk-item.statue').click()", wait2: 700 });
add('hub-decopick-gate-pp', 'index.html#lobby', { vp: 'pp', js: "document.querySelector('.pk-item.gate').click()", wait2: 700 });
add('shop-park-pp', 'shop/index.html#park', { vp: 'pp', wait: 2500 });
// 동상 사서 바꾸기 시험: 2번 동상 사기 → 첫 화면 동상 자리에 놓기 → 그림이 바뀌었는지
add('hub-decobuy-pp', 'index.html#lobby', { vp: 'pp', js: "(async () => { Hub.mutate((c) => { c.gems = 100; }); const r = Hub.buyParkItem('statue', 2); const key = document.querySelector('.pk-item.statue').dataset.key; document.querySelector('.pk-item.statue').click(); await new Promise((z) => setTimeout(z, 300)); document.querySelectorAll('.deco-card')[1].click(); await new Promise((z) => setTimeout(z, 300)); return { bought: r.ok, deco: Hub.parkDeco(key), img: document.querySelector('.pk-item.statue img').src.split('/').pop() }; })()", wait2: 400 });
add('hub-lobby-pc', 'index.html#lobby', { vp: 'pc' });
add('hub-map-pc', 'index.html#map-shisen', { vp: 'pc' });
add('hub-empty-pp', 'index.html', { vp: 'pp', empty: true, wait: 1500 });
add('v01-return-pp', 'memory/index.html?stage=1', { vp: 'pp', js: "sessionStorage.setItem('twin_ver','0.1'); goMap()", wait2: 2500 });
add('v02-return-pp', 'memory/index.html?stage=1', { vp: 'pp', js: 'goMap()', wait2: 2500 });
add('v01-stagego-pp', 'v0.1/#map-skyhook', { vp: 'pp', js: "document.querySelector('.stone.next').click(); setTimeout(() => document.getElementById('btnPlayStage').click(), 300)", wait2: 2500 });
for (const g of ['skyhook?stage=3', 'helicopter', 'stairs', 'shisen?stage=5', 'downhill', 'memory?stage=1', 'mole?stage=1', 'bakery', 'dogsnack', 'darts']) {
  const id = g.split('?')[0];
  add(`game-${id}-pp`, `${id}/index.html${g.includes('?') ? g.slice(g.indexOf('?')) : ''}`, { vp: 'pp', wait: 2500 });
}

// 놀이공원 편집 시험: 길게 누르기 → 편집, 누르기로 자리 바꾸기, 끌어서 옮기기, 저장 확인
const EDIT_TEST = `(async () => {
  const w = document.getElementById('pkWorld'), sl = (ms) => new Promise((r) => setTimeout(r, ms));
  const ride = (i) => w.querySelector('.pk-ride[data-i="' + i + '"]');
  const at = (el) => { const r = el.getBoundingClientRect(); return { clientX: r.left + r.width / 2, clientY: r.top + r.height * 0.6 }; };
  const pe = (el, type, p) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true, ...p }));
  const ids = () => [...w.querySelectorAll('.pk-ride[data-id]')].map((e) => e.dataset.id);
  const out = { start: ids().join(',') };
  ride(0).scrollIntoView({ block: 'center' }); await sl(200);
  let p = at(ride(0)); pe(ride(0).querySelector('.art'), 'pointerdown', p); await sl(800); pe(window, 'pointerup', p);
  out.longpress = !document.getElementById('pkEditBar').classList.contains('hidden') && !!w.querySelector('.pk-ride.sel');
  p = at(ride(1)); pe(ride(1).querySelector('.art'), 'pointerdown', p); pe(window, 'pointerup', p); ride(1).click(); await sl(100);
  out.afterTapSwap = ids().join(',');
  p = at(ride(2)); const q = at(ride(5));
  pe(ride(2).querySelector('.art'), 'pointerdown', p);
  for (let k = 1; k <= 10; k++) { pe(window, 'pointermove', { clientX: p.clientX + (q.clientX - p.clientX) * k / 10, clientY: p.clientY + (q.clientY - p.clientY) * k / 10 }); await sl(20); }
  pe(window, 'pointerup', q); await sl(150);
  out.afterDrag = ids().join(',');
  document.getElementById('pkDone').click(); await sl(100);
  out.saved = (Hub.park() || []).join(',');
  out.editingOff = document.getElementById('pkEditBar').classList.contains('hidden');
  return out;
})()`;
add('hub-edittest-pp', 'index.html#lobby', { vp: 'pp', js: EDIT_TEST, wait: 4000, wait2: 300 });
add('hub-edittest-pl', 'index.html#lobby', { vp: 'pl', js: EDIT_TEST, wait2: 300 });
// 쿠폰 restart·dayplus: 아이템샵 쿠폰 창에 직접 입력 → 첫 화면으로 넘어간 뒤(after) 저장 상태를 봄
const COUPON = (code) => `(() => { document.getElementById('btnCoupon').click(); document.getElementById('couponInput').value = ${JSON.stringify(code)};
  document.getElementById('couponOk').click(); const msg = document.getElementById('couponMsg').textContent; sessionStorage.setItem('__seeded', '1'); return msg; })()`;
const STATE = `(() => { const d = JSON.parse(localStorage.getItem('twin_gameland_v1') || 'null'), c = d && d.chars.find((x) => x.id === d.activeId);
  return { chars: d ? d.chars.length : 0, backup: !!localStorage.getItem('twin_gameland_v1_backup'), tip: localStorage.getItem('twin_tip_closed'), att: c && c.v3 && c.v3.att, gems: c && c.gems,
    screen: [...document.querySelectorAll('section.screen:not(.hidden), .screen:not(.hidden)')].map((e) => e.id).join(','), modal: (document.querySelector('.mn-modal h3') || {}).textContent || '' }; })()`;
for (const vp of ['pp', 'tb']) {
  add(`coupon-restart-${vp}`, 'shop/index.html', { vp, js: COUPON('Restart'), wait2: 3500, after: STATE });
  add(`coupon-dayplus-${vp}`, 'shop/index.html', { vp, js: COUPON('dayplus'), wait2: 3500, after: STATE });
}

for (const g of ['shisen', 'memory', 'mole', 'bakery', 'dogsnack', 'darts']) add(`pop-ready-${g}-pp`, `${g}/index.html${['shisen', 'memory', 'mole'].includes(g) ? '?stage=0' : ''}`, { vp: 'pp', wait: 2800 });
// 지도 돌다리 → 바로 게임의 출발 준비 창 하나만 (QA: 출발 창 두 번)
for (const g of ['shisen', 'memory', 'mole']) add(`flow-stone-${g}-pp`, `index.html#map-${g}`, { vp: 'pp', js: `(() => { sessionStorage.setItem('__seeded', '1'); document.querySelector('#mapTrack .stone').click(); return !document.querySelector('.modal:not(.hidden)'); })()`, wait2: 3500,
  after: `({ url: location.pathname + location.search, ready: !document.getElementById('ready').classList.contains('hidden'), buttons: [...document.querySelectorAll('#ready .pp-b')].map((b) => b.textContent.trim()).join(' | ') })` });
// 실제로 게임을 시작해서 게임 코드로 끝냄 → 결과 창 버튼 줄(실제 흐름) 확인
const ROWS = `(() => { const p = document.querySelector('#result .panel'); if (!p || document.getElementById('result').classList.contains('hidden')) return 'no result';
  const rows = [...p.querySelectorAll('.pp-row')].filter((r) => r.offsetHeight).map((r) => [...r.children].filter((b) => b.offsetHeight).map((b) => b.textContent.trim()).join(' | '));
  const stray = [...p.querySelectorAll('button')].filter((b) => !b.closest('.pp-acts') && b.offsetHeight).map((b) => b.id || b.textContent.trim());
  const pr = p.getBoundingClientRect(), out = [...p.querySelectorAll('.pp-acts button')].filter((b) => { const r = b.getBoundingClientRect(); return b.offsetHeight && (r.left < pr.left || r.right > pr.right || r.bottom > pr.bottom); }).length;
  return { rows, stray, out }; })()`;
const END = { helicopter: 'startRun(); showResult()', stairs: 'startRun(); gameOver()', downhill: 'startRun(); gameOver()', bakery: 'startRun(1); G.state = \'play\'; gameOver()', dogsnack: 'startRun(1); G.state = \'play\'; gameOver()', darts: 'startRun(); finish()',
  'shisen-clear': 'startStage(0); clearStage()', 'shisen-fail': 'startStage(0); failStage()', 'memory-clear': 'startStage(0); G.state = \'play\'; clearStage()', 'memory-fail': 'startStage(0); failStage()', mole: 'startStage(0); G.state = \'play\'; endStage()' };
for (const [k, js] of Object.entries(END)) {
  const g = k.split('-')[0];
  add(`real-${k}-pp`, `${g}/index.html`, { vp: 'pp', wait: 2600, js: `(async () => { try { ${js}; } catch (e) { return 'ERR ' + e.message; } await new Promise((r) => setTimeout(r, 6000)); return ${ROWS}; })()`, wait2: 200 });
}
// 새 팝업 꾸밈 (QA 23·26): 일시정지 창 · 결과 창(광고 버튼이 창 안에 들어가는지)
for (const g of ['helicopter', 'stairs', 'shisen', 'downhill', 'memory', 'mole', 'bakery', 'dogsnack', 'darts']) for (const vp of ['pp', 'pl']) {
  add(`pop-pause-${g}-${vp}`, `${g}/index.html`, { vp, wait: 2500, js: `(() => { document.querySelectorAll('.screen.dim,#ready').forEach((e) => e.classList.add('hidden')); document.getElementById('pause').classList.remove('hidden'); })()`, wait2: 400 });
  add(`pop-result-${g}-${vp}`, `${g}/index.html`, { vp, wait: 2500, js: `(() => { document.querySelectorAll('.screen.dim,#ready').forEach((e) => e.classList.add('hidden')); document.getElementById('result').classList.remove('hidden');
    Hub.record('${g}', { dist: 1200, coins: 40, cleared: false, stage: 0, stars: 0 }); })()`, wait2: 1600,
    after: `(() => { const p = document.querySelector('#result .panel').getBoundingClientRect(), b = document.querySelector('.mn-reward'), r = b && b.getBoundingClientRect();
      return { inPanel: !!(b && document.querySelector('#result .panel').contains(b)), fits: !!r && r.left >= p.left && r.right <= p.right && r.top >= p.top && r.bottom <= p.bottom, panelInScreen: p.top >= 0 && p.bottom <= innerHeight }; })()` });
}
// 잠긴 게임 (c4: 상용화 기록 없음 → 처음 열린 3게임만): 큰 자물쇠만, ▶ 없음 / 열쇠로 열면 화면이 막힌 채 그 게임 인트로로 (QA 10·28)
add('hub-lobby-locked-pp', 'index.html#lobby', { vp: 'pp', ch: 'c4', wait: 3000, js: `(() => { document.querySelectorAll('.mn-modal').forEach((m) => m.remove()); return [...document.querySelectorAll('.pk-ride[data-id]')].map((b) => b.dataset.id + ':' + b.classList.contains('mn-locked') + ':' + getComputedStyle(b.querySelector('.play')).display).join(' '); })()` });
add('hub-unlock-pp', 'index.html#lobby', { vp: 'pp', ch: 'c4', wait: 3000, js: `(async () => { const sl = (t) => new Promise((z) => setTimeout(z, t)); document.querySelectorAll('.mn-modal').forEach((m) => m.remove());
  document.querySelector('.pk-ride[data-id=stairs]').click(); await sl(300); const k = [...document.querySelectorAll('.mn-modal .mn-btn')].find((b) => b.textContent.includes('열쇠')); k.click(); await sl(200);
  const blocked = !!document.querySelector('.mn-block'); const r = document.querySelector('.pk-ride[data-id=bakery]').getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); await sl(1800); // 열리는 동안 다른 놀이기구 자리를 누르면 막(mn-block)이 받음
  return { blocked, tapGoesTo: hit && hit.className, intro: (document.querySelector('.intro:not(.hidden), #intro:not(.hidden), [class*=title]:not(.hidden) img') || {}).src || location.hash }; })()`, wait2: 300 });
// 이름표 6가지 (QA 17): 글자가 칸을 넘는지(가로·세로), 글자 끝과 칸 테두리 사이 여백(px)
for (const [n, id] of [[1, 'wood'], [2, 'ribbon'], [3, 'star'], [4, 'rabbit'], [5, 'rainbow'], [6, 'flower']]) for (const [k, top] of [['bottom', 99999], ['top', 0]]) {
  add(`plate-${id}-${k}-pp`, 'index.html#lobby', { vp: 'pp', js: `(async () => { Hub.setParkDeco('plate', ${n}); renderPark(); document.getElementById('pkScroll').scrollTop = ${top}; await new Promise((r) => setTimeout(r, 500));
    return [...document.querySelectorAll('.pk-ride:not(.soon) .name')].map((nm) => { const box = nm.getBoundingClientRect(), cs = getComputedStyle(nm);
      const inL = box.left + parseFloat(cs.paddingLeft) * 0, rng = document.createRange(); let minM = 99, over = nm.scrollHeight > nm.clientHeight + 0.5;
      for (const e of nm.querySelectorAll('b, small')) { if (e.scrollWidth > e.clientWidth + 0.5) over = true; rng.selectNodeContents(e); const t = rng.getBoundingClientRect();
        const P = ${JSON.stringify({})}; minM = Math.min(minM, t.left - box.left, box.right - t.right); }
      return { t: nm.querySelector('b').textContent, over, edge: Math.round(minM), w: Math.round(box.width) }; }); })()`, wait2: 200 });
}
for (const [n, id] of [[2, 'star'], [3, 'rabbit'], [4, 'rainbow'], [5, 'heart'], [6, 'flower']]) add(`logo-${id}-pp`, 'index.html#lobby', { vp: 'pp', js: `(() => { Hub.mutate((c) => { c.gems = 100; }); const r = Hub.buyParkItem('logo', ${n}); Hub.setParkDeco('logo', ${n}); renderLogo(); return r.ok; })()`, wait2: 600 });
add('hub-intro-helicopter-pp', 'index.html#lobby', { vp: 'pp', js: `document.querySelector('.pk-ride[data-id=helicopter]').click()`, wait2: 1500 });
add('hub-intro-helicopter-pl', 'index.html#lobby', { vp: 'pl', js: `document.querySelector('.pk-ride[data-id=helicopter]').click()`, wait2: 1500 });
add('hub-create-pp', 'index.html#select', { vp: 'pp', empty: true, js: `document.querySelector('.sel-char').click()`, wait2: 500 });
add('hub-deco-logo-pp', 'index.html#lobby', { vp: 'pp', js: `document.querySelector('.pk-logo').click()`, wait2: 500 });
add('hub-gemshop-pp', 'index.html#lobby', { vp: 'pp', js: `document.getElementById('btnGems').click()`, wait2: 500 });
add('hub-settings-pp', 'index.html#lobby', { vp: 'pp', js: `document.getElementById('btnSettings').click()`, wait2: 500 });

// 시작할 때 꾸밈 없는 화면이 스치는지 (QA 15): 느린 인터넷으로 열고 0.15~3초 사이 여러 장 찍음 (<이름>_t<ms>.png)
const FILM = [300, 700, 1100, 1500, 2000, 2600, 3300, 4200];
for (const g of ['helicopter', 'stairs', 'shisen', 'downhill', 'memory', 'mole', 'bakery', 'dogsnack', 'darts']) {
  add(`film-${g}-pp`, `${g}/index.html`, { vp: 'pp', slow: true, film: FILM });
  add(`film-${g}-pl`, `${g}/index.html`, { vp: 'pl', slow: true, film: FILM });
}
add('film-hub-pp', 'index.html#lobby', { vp: 'pp', slow: true, film: FILM });

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
const PRE = (data, empty) => `(() => {
  let s = 12345; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  try { if (!sessionStorage.getItem('__seeded')) { localStorage.clear(); ${empty ? '' : `localStorage.setItem('twin_gameland_v1', ${JSON.stringify(JSON.stringify(data))});`} localStorage.setItem('twin_tip_closed', '1'); sessionStorage.setItem('__seeded', '1'); } } catch (e) {}
})();`;

const report = {};
for (const sc of S) {
  if (FILTER && !FILTER.test(sc.name)) continue;
  try {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const errs = [];
    const h = (d) => {
      if (d.sessionId !== sessionId) return;
      if (d.method === 'Runtime.exceptionThrown') errs.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).split('\n')[0]);
      if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) errs.push('CON ' + d.params.args.map((a) => a.value ?? a.description).join(' '));
      if (d.method === 'Network.responseReceived' && d.params.response.status >= 400) errs.push(`HTTP ${d.params.response.status} ${d.params.response.url.replace(BASE, '')}`);
    };
    handlers.push(h);
    await send('Page.enable', {}, sessionId); await send('Runtime.enable', {}, sessionId); await send('Network.enable', {}, sessionId);
    await send('Network.setCacheDisabled', { cacheDisabled: true }, sessionId);
    const [w, ht, kind] = VP[sc.vp], desk = kind === 'desktop';
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: ht, deviceScaleFactor: desk ? 1 : 2, mobile: !desk, screenOrientation: w > ht ? { type: 'landscapePrimary', angle: 90 } : { type: 'portraitPrimary', angle: 0 } }, sessionId);
    if (!desk) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId);
    await send('Page.addScriptToEvaluateOnNewDocument', { source: PRE(seed(sc.ch || 'c1'), sc.empty) }, sessionId);
    if (sc.slow) await send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: 1500 * 1024, uploadThroughput: 500 * 1024 }, sessionId);
    await send('Page.navigate', { url: BASE + sc.url }, sessionId);
    if (sc.film) {
      const t0 = Date.now();
      for (const t of sc.film) {
        await sleep(Math.max(0, t - (Date.now() - t0)));
        const f = await send('Page.captureScreenshot', { format: 'jpeg', quality: 60 }, sessionId);
        fs.writeFileSync(path.join(OUT, `${sc.name}_t${t}.jpg`), Buffer.from(f.data, 'base64'));
      }
    }
    await sleep(sc.wait || 1800);
    if (sc.js) {
      const r = await send('Runtime.evaluate', { expression: sc.js, awaitPromise: true, returnByValue: true }, sessionId);
      if (r.result && r.result.value !== undefined) sc.result = r.result.value;
      if (r.exceptionDetails) errs.push('JS ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).split('\n')[0]);
      await sleep(sc.wait2 || 0);
    }
    if (sc.after) { const r = await send('Runtime.evaluate', { expression: sc.after, returnByValue: true }, sessionId); sc.result = { coupon: sc.result, after: r.result && r.result.value }; }
    const u = await send('Runtime.evaluate', { expression: 'location.pathname + location.search + location.hash', returnByValue: true }, sessionId);
    const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    fs.writeFileSync(path.join(OUT, sc.name + '.png'), Buffer.from(shot.data, 'base64'));
    report[sc.name] = { url: u.result.value, errors: errs, ...(sc.result !== undefined ? { result: sc.result } : {}) };
    handlers.splice(handlers.indexOf(h), 1);
    await send('Target.closeTarget', { targetId });
    process.stdout.write(errs.length ? `\n${sc.name}: ${errs.join(' | ')}\n` : '.');
  } catch (e) { console.log('\nERR', sc.name, e.message); }
}
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
const bad = Object.entries(report).filter(([, r]) => r.errors.length);
console.log(`\n화면 ${Object.keys(report).length}개, 오류 있는 화면 ${bad.length}개`);
chrome.kill(); await sleep(300); try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) { /* ignore */ }
process.exit(0);
