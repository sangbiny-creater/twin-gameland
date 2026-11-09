// 한 번에 뜨는지 검사 (성능 QA): 헤드리스 Chrome으로 화면을 느린 인터넷(느린 4G)·캐시 없이 열고,
//  화면이 보이기 시작한 뒤에 ① 그림이 늦게 나타나거나 ② 그림·창 크기가 바뀌거나 ③ 글꼴이 바뀌거나 ④ 화면 조각이 밀리면 Fail 로 적음
//   node tools/load_check.mjs <출력폴더> [이름 필터(정규식)] [--film]
//   BASE=http://localhost:8080/ (기본) — 먼저 python3 -m http.server 8080 으로 저장소를 열어 둠
//  결과: <출력폴더>/load_report.json (화면 → 단계 → 문제 목록), --film 이면 <이름>/f<ms>.jpg 연속 캡처
//  '가려진 동안'(html.booting / html.boot-wait — common/boot.js 의 로딩 화면)에는 검사하지 않음: 다 준비된 뒤 한꺼번에 보여 주면 Pass
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const FILM = args.includes('--film');
const pos = args.filter((a) => !a.startsWith('--'));
const OUT = path.resolve(pos[0] || 'load_shots');
const FILTER = pos[1] ? new RegExp(pos[1]) : null;
const BASE = process.env.BASE || 'http://localhost:8080/';
const PAR = +(process.env.PAR || 4);
fs.mkdirSync(OUT, { recursive: true });
const PORT = 9400 + Math.floor(Math.random() * 400);
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'twin-load-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', '--mute-audio', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 느린 4G (Chrome 개발자 도구 'Slow 4G' 와 같은 값)
const SLOW = { offline: false, latency: 562.5, downloadThroughput: (1.4 * 1024 * 1024) / 8, uploadThroughput: (675 * 1024) / 8 };

// ---- 저장 데이터 (screen_check.mjs 와 같은 모양: 진행한 은유·은결) ----
const stages = (n) => Object.fromEntries([...Array(Math.round(n))].map((_, i) => [i, { cleared: true, stars: (i % 3) + 1, best: 300 + i * 10, plays: 2, bestTime: 60 + i }]));
const shop = () => ({ skins: {}, equipped: {}, boosts: { shisen: { hint: 3, shuffle: 2, time: 1 }, memory: { hint: 2, find: 1 }, skyhook: { life: 1 } }, using: {}, skinAll: ['forest'], skinOn: 'default', starter: { shisen: true, memory: true } });
const games = (k) => ({
  skyhook: { plays: 20, best: 640, coins: 900, last: 1, stages: stages(12 * k) }, shisen: { plays: 30, best: 0, coins: 1200, last: 1, stages: stages(25 * k) },
  memory: { plays: 9, best: 0, coins: 300, last: 1, stages: stages(8 * k) }, mole: { plays: 3, best: 0, coins: 50, last: 1, stages: stages(5 * k) },
  giftsort: { plays: 3, best: 0, coins: 50, last: 1, stages: stages(5 * k) }, burger: { plays: 3, best: 0, coins: 50, last: 1, stages: stages(5 * k) },
  helicopter: { plays: 5, best: 812, coins: 200, last: 1, stages: {} }, stairs: { plays: 4, best: 230, coins: 150, last: 1, stages: {} },
  downhill: { plays: 3, best: 1520, coins: 120, last: 1, stages: {} }, bakery: { plays: 2, best: 3400, coins: 80, last: 1, stages: {} },
});
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const v3 = () => ({ tickets: 0, unlocked: ['skyhook', 'helicopter', 'stairs', 'shisen', 'downhill', 'memory', 'mole', 'bakery', 'dogsnack', 'darts', 'giftsort', 'burger'], dUnlocks: 0, plays: 5, att: { count: 3, last: today() }, welcomed: true });
const hist = [{ game: 'shisen', at: 1761300000000, stage: 24, cleared: true, dist: 0, earned: 80, stars: 3 }];
const seed = (active) => ({
  v: 1, slots: 4, nextId: 3, activeId: active, settings: { sound: true },
  chars: [
    { id: 'c1', name: '은유', look: 'eunyu3', coins: 1234, earned: 4321, gems: 30, created: 1, games: games(1), history: hist, favs: ['shisen'], shop: shop(), v3: v3(), outfits: ['winter'] },
    { id: 'c2', name: '은결', look: 'eungyeol3', coins: 300, earned: 900, gems: 5, created: 2, games: games(0.3), history: hist, shop: shop(), v3: v3() },
  ],
});
const PRE = (data) => `(() => {
  try { if (!sessionStorage.getItem('__seeded')) { localStorage.clear(); ${data ? `localStorage.setItem('twin_gameland_v1', ${JSON.stringify(JSON.stringify(data))}); localStorage.setItem('twin_auth_v1', '{"mode":"guest","uid":"local-test","at":1}');` : ''} localStorage.setItem('twin_tip_closed', '1'); sessionStorage.setItem('__seeded', '1'); } } catch (e) {}
})();`;

// ---- 화면에 심는 감시 코드 ----
const MONITOR = String.raw`(() => {
  if (window.__lc) return;
  const L = window.__lc = { ev: [], step: 'load', stepAt: 0, revealAt: null, seen: new Set() };
  const now = () => Math.round(performance.now());
  const cov = () => { const c = document.documentElement.classList; return !document.body || c.contains('booting') || c.contains('boot-wait'); };
  const short = (u) => String(u || '').replace(location.origin, '').replace(/[?&]v=\d+/, '').slice(0, 110);
  const desc = (el) => { if (!el || !el.tagName) return ''; let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; else if (typeof el.className === 'string' && el.className.trim()) s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.'); const p = el.parentElement; return (p && p !== document.body ? (p.id ? '#' + p.id : p.className && typeof p.className === 'string' ? '.' + p.className.trim().split(/\s+/)[0] : p.tagName.toLowerCase()) + ' > ' : '') + s; };
  const log = (k, d, key) => { if (cov()) return; const kk = L.step + '|' + k + '|' + (key || JSON.stringify(d)); if (L.seen.has(kk)) return; L.seen.add(kk); L.ev.push({ t: now(), step: L.step, k, ...d }); };
  const inView = (el) => { const r = el.getBoundingClientRect(); return r.width > 3 && r.height > 3 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight; };
  const vis = (el) => { try { return el.isConnected && el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && inView(el); } catch (e) { return false; } };
  const loaded = new Map();
  const URLRE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
  const urlsOf = (cs) => { const out = []; for (const v of [cs.backgroundImage, cs.borderImageSource, cs.webkitMaskImage, cs.maskImage, cs.content, cs.listStyleImage]) { if (!v || v === 'none' || v.indexOf('url(') < 0) continue; for (const m of v.matchAll(URLRE)) if (!m[2].startsWith('data:')) out.push(new URL(m[2], location.href).href); } return out; };
  // 그림이 도착했을 때 그 그림을 쓰는 곳이 이미 화면에 보이고 있었으면 = 늦게 나타남
  function late(url) {
    if (cov() || L.revealAt == null) return;
    for (const img of document.images) if ((img.currentSrc || img.src) === url && vis(img)) { log('img-late', { what: desc(img), src: short(url) }, url); return; }
    for (const el of document.querySelectorAll('body *')) {
      for (const pe of [null, '::before', '::after']) {
        const cs = getComputedStyle(el, pe); if (pe && cs.content === 'none') continue;
        if (urlsOf(cs).includes(url) && vis(el)) { log('css-late', { what: desc(el) + (pe || ''), src: short(url) }, url); return; }
      }
    }
  }
  new PerformanceObserver((l) => { for (const e of l.getEntries()) { loaded.set(e.name, e.responseEnd); if (/\.(webp|png|jpe?g|svg|gif)(\?|$)/i.test(e.name)) late(e.name); else if (/\.(woff2?|ttf|otf)(\?|$)/i.test(e.name) || e.initiatorType === 'css' && /gstatic/.test(e.name)) { /* fonts: below */ } } }).observe({ type: 'resource', buffered: true });
  // 보이는데 아직 안 받은 그림 (주기 검사)
  function scan() {
    if (cov()) return;
    for (const img of document.images) { const s = img.getAttribute('src'); if (s && !(img.complete && img.naturalWidth) && vis(img)) log('img-missing', { what: desc(img), src: short(img.currentSrc || img.src) }, img.src); }
    for (const el of document.querySelectorAll('body *')) {
      for (const pe of [null, '::before', '::after']) {
        const cs = getComputedStyle(el, pe); if (pe && cs.content === 'none') continue;
        const us = urlsOf(cs); if (!us.length) continue;
        for (const u of us) if (!loaded.has(u) && vis(el)) { log('css-missing', { what: desc(el) + (pe || ''), src: short(u) }, u); }
      }
    }
  }
  // 글꼴: 화면이 보인 뒤에 글꼴이 도착하면 글자 모양이 바뀜
  if (document.fonts) document.fonts.addEventListener('loadingdone', (e) => { if (L.revealAt != null && !cov()) log('font-late', { font: [...new Set(e.fontfaces.map((f) => f.family))].join(',') }, e.fontfaces.map((f) => f.family + f.unicodeRange).join('|')); });
  // 화면 조각이 밀림 (그림·글자가 늦게 들어와 자리가 바뀜)
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput && e.value > 0.004 && L.revealAt != null && !cov()) log('shift', { v: +e.value.toFixed(3), what: (e.sources || []).slice(0, 3).map((s) => desc(s.node)).join(', ') }, (e.sources || []).map((s) => desc(s.node)).join()); }).observe({ type: 'layout-shift', buffered: false }); } catch (e) { }
  // 창·그림 크기가 보이는 동안 바뀜 (창이 커졌다 줄어듦, 캐릭터 그림이 커졌다 작아짐)
  const ro = new ResizeObserver((es) => { for (const e of es) {
    const el = e.target, w = Math.round(e.contentRect.width), h = Math.round(e.contentRect.height), p = el.__lcSz; el.__lcSz = [w, h];
    if (!p || !p[0] || !p[1] || !w || !h || (Math.abs(p[0] - w) < 2 && Math.abs(p[1] - h) < 2)) continue;
    if (L.revealAt == null || cov() || now() - (L.vpAt || 0) < 600) continue;
    if (vis(el)) log(el.tagName === 'IMG' ? 'img-resize' : 'panel-resize', { what: desc(el), from: p[0] + 'x' + p[1], to: w + 'x' + h, src: el.tagName === 'IMG' ? short(el.currentSrc) : undefined }, desc(el));
  } });
  const watch = (root) => { if (!root.querySelectorAll) return; const list = root.matches && root.matches('img, .panel, .mpanel, .mn-panel, .modal > *') ? [root] : []; list.push(...root.querySelectorAll('img, .panel, .mpanel, .mn-panel, .modal > *')); for (const el of list) if (!el.__lcW) { el.__lcW = 1; ro.observe(el); } };
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) watch(n); }).observe(document, { childList: true, subtree: true });
  addEventListener('resize', () => { L.vpAt = now(); });
  // 캔버스 게임: 아직 안 받은 그림을 그리려 함 / 받자마자 처음 그림 (= 그동안 빈 자리였음)
  const dI = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (img) {
    try {
      if (img instanceof HTMLImageElement && L.revealAt != null && !cov() && this.canvas && this.canvas.isConnected && vis(this.canvas)) {
        if (!(img.complete && img.naturalWidth)) log('draw-missing', { src: short(img.src) }, img.src);
        else if (!img.__lcD) { img.__lcD = 1; const le = loaded.get(img.currentSrc || img.src); const t = now(); if (le != null && le > L.revealAt + 50 && le > (L.stepAt || 0) && t - le < 400) log('draw-late', { src: short(img.src), ms: Math.round(le - L.revealAt) }, img.src); }
      }
    } catch (e) { }
    return dI.apply(this, arguments);
  };
  let was = true, last = 0;
  const tick = () => { const c = cov(); if (was && !c) { L.revealAt = now(); L.ev.push({ t: L.revealAt, step: L.step, k: 'reveal' }); if (document.documentElement) watch(document.documentElement); scan(); } was = c; if (!c && now() - last > 250) { last = now(); scan(); } requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
})();`;

// ---- 검사할 화면 ----
const STAGE = ['skyhook', 'shisen', 'memory', 'mole', 'giftsort', 'burger'];
const GAMES = ['skyhook', 'helicopter', 'stairs', 'shisen', 'downhill', 'memory', 'mole', 'bakery', 'dogsnack', 'darts', 'giftsort', 'burger'];
const hide = `document.querySelectorAll('#gpStart,.mn-modal').forEach((e) => e.remove()); document.querySelectorAll('.screen.dim,#ready,#home').forEach((e) => e.classList.add('hidden'));`;
const START = { skyhook: 'startStage(0)', shisen: 'startStage(0)', memory: 'startStage(0)', mole: 'startStage(0)', giftsort: 'startStage(0)', burger: 'startStage(0)', helicopter: 'startRun()', stairs: 'startRun()', downhill: 'startRun()', bakery: 'startRun(1)', dogsnack: 'startRun(1)', darts: 'startRun()' };
const END = { skyhook: 'gameOver()', helicopter: 'showResult()', stairs: 'gameOver()', downhill: 'gameOver()', bakery: "G.state = 'play'; gameOver()", dogsnack: "G.state = 'play'; gameOver()", darts: 'finish()',
  shisen: 'clearStage()', memory: "G.state = 'play'; clearStage()", mole: "G.state = 'play'; endStage()", giftsort: 'clearStage()', burger: '__burger.G.served = 4; __burger.G.spawned = 4; __burger.endStage(true)' };
const S = [];
const add = (name, url, o = {}) => S.push({ name, url, vp: 'pp', steps: [], ...o });
const st = (name, js, o = {}) => ({ name, js, ...o });
// 첫 화면(놀이공원)
add('hub-select', 'index.html#select');
add('hub-first-visit', 'index.html', { empty: true }); // 처음 온 사람: 로그인 창
add('hub-lobby', 'index.html#lobby', { steps: [
  st('위로 스크롤', `(() => { const sc = document.getElementById('pkScroll'); sc.scrollTop = Math.max(0, sc.scrollTop - sc.clientHeight); })()`),
  st('맨 위로 스크롤', `document.getElementById('pkScroll').scrollTop = 0`),
] });
add('hub-lobby-pl', 'index.html#lobby', { vp: 'pl' });
add('hub-lobby-tb', 'index.html#lobby', { vp: 'tb' });
add('hub-lobby-eungyeol', 'index.html#lobby', { ch: 'c2' });
add('hub-select-to-lobby', 'index.html#select', { steps: [st('캐릭터 고름', `document.querySelector('#charGrid button, #charGrid .sel-char, #charGrid > *').click()`)] });
add('hub-popups', 'index.html#lobby', { steps: [
  st('설정 창', `document.getElementById('btnSettings').click()`), st('닫기', `closeModals()`),
  st('다이아 상점', `document.getElementById('btnGems').click()`), st('닫기2', `document.querySelectorAll('.mn-modal').forEach((m) => m.remove()); closeModals()`),
  st('동상 바꾸기', `document.querySelector('.pk-item.statue').click()`), st('닫기3', `closeModals()`),
  st('대문 바꾸기', `document.querySelector('.pk-item.gate').click()`),
] });
for (const g of ['shisen', 'helicopter']) add(`hub-intro-${g}`, 'index.html#lobby', { steps: [
  st('인트로', `showTitle(GAME_CARDS.find((x) => x.id === '${g}'))`),
  ...(g === 'shisen' ? [st('START → 지도', `document.getElementById('tsStart').click()`)] : []),
] });
for (const g of STAGE) add(`hub-map-${g}`, `index.html#map-${g}`, { steps: [st('지도 스크롤', `(() => { const sc = document.getElementById('mapScroll') || document.querySelector('#scrMap .map-scroll'); if (sc) sc.scrollTop = Math.max(0, sc.scrollTop - sc.clientHeight * 1.5); })()`)] });
add('hub-map-memory-pl', 'index.html#map-memory', { vp: 'pl' });
add('hub-records', 'index.html#records');
add('hub-lobby-to-map', 'index.html#lobby', { steps: [st('지도로', `go('map-memory')`), st('다른 지도', `go('map-mole')`), st('놀이공원으로', `go('lobby')`)] });
// 게임마다: 처음 화면(출발 준비 창) → 게임 시작 → 일시정지 창 → 결과 창
for (const g of GAMES) {
  const q = STAGE.includes(g) ? '?stage=0' : '';
  add(`game-${g}`, `${g}/index.html${q}`, { vp: g === 'burger' || g === 'helicopter' ? 'pl' : 'pp', steps: [
    st('게임 시작', `(() => { ${hide} ${START[g]}; })()`, { settle: 2500 }),
    st('일시정지 창', `pauseGame()`),
    st('결과 창', `(() => { ${hide} document.getElementById('hud') && 0; ${END[g]}; })()`, { settle: 4000 }),
  ] });
}
add('game-shisen-go', 'shisen/index.html?stage=3&go=1');
add('game-memory-pl', 'memory/index.html?stage=0', { vp: 'pl' });
// 옷장 · 아이템샵
add('closet', 'closet/index.html', { steps: [
  st('은결로 바꾸기', `document.querySelectorAll('#clWho .cl-char')[1].click()`),
  st('은유로 바꾸기', `document.querySelectorAll('#clWho .cl-char')[0].click()`),
  st('옷 미리 보기', `document.querySelectorAll('#clList .cl-card')[1].click()`),
  st('다른 옷 미리 보기', `document.querySelectorAll('#clList .cl-card')[2].click()`),
] });
add('closet-pl', 'closet/index.html', { vp: 'pl' });
add('shop', 'shop/index.html', { steps: [
  st('탭 2', `(document.querySelectorAll('.tabs button, .sh-tabs button, [data-tab]')[1] || {}).click?.()`),
  st('탭 3', `(document.querySelectorAll('.tabs button, .sh-tabs button, [data-tab]')[2] || {}).click?.()`),
  st('탭 4', `(document.querySelectorAll('.tabs button, .sh-tabs button, [data-tab]')[3] || {}).click?.()`),
] });
// 다시 열 때 (캐시 있음)
for (const [n, u] of [['hub-lobby', 'index.html#lobby'], ['hub-map-shisen', 'index.html#map-shisen'], ['game-memory', 'memory/index.html?stage=0'], ['game-downhill', 'downhill/index.html'], ['closet', 'closet/index.html'], ['shop', 'shop/index.html']]) add(`again-${n}`, u, { again: true });

// ---- CDP ----
async function wsUrl() {
  for (let i = 0; i < 50; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) return (await r.json()).webSocketDebuggerUrl; } catch (e) { /* wait */ } await sleep(200); }
  throw new Error('chrome not up');
}
const ws = new WebSocket(await wsUrl());
await new Promise((r) => ws.addEventListener('open', r));
let mid = 0; const pend = new Map(); const handlers = new Set();
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { const p = pend.get(d.id); pend.delete(d.id); d.error ? p.rej(new Error(JSON.stringify(d.error))) : p.res(d.result); } else for (const h of handlers) h(d);
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const id = ++mid; pend.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId }));
  setTimeout(() => { if (pend.has(id)) { pend.delete(id); rej(new Error('timeout ' + method)); } }, 60000);
});
const VP = { pp: [390, 844], pl: [844, 390], tb: [1024, 768] };

async function run(sc) {
  // 화면마다 새 방문자처럼: 따로 쓰는 빈 브라우저 공간(캐시·저장소 따로) + 따로 창 (같은 창의 뒤쪽 탭은 '안 보이는 탭'이라 화면 그리기가 멈춤)
  //  캐시를 끄지 않음: 실제 첫 방문처럼 한 번 받은 그림은 그 화면 안에서 다시 쓰임 (캐시를 끄면 같은 그림을 두 번 받아 실제와 달라짐)
  const { browserContextId } = await send('Target.createBrowserContext', { disposeOnDetach: true });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', newWindow: true, browserContextId });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const errs = []; const inflight = new Set(); let lastNet = Date.now();
  const h = (d) => {
    if (d.sessionId !== sessionId) return;
    const p = d.params || {};
    if (d.method === 'Network.requestWillBeSent') { inflight.add(p.requestId); lastNet = Date.now(); }
    if (d.method === 'Network.loadingFinished' || d.method === 'Network.loadingFailed') { inflight.delete(p.requestId); lastNet = Date.now(); }
    if (d.method === 'Runtime.exceptionThrown') errs.push('EXC ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text).split('\n')[0]);
    if (d.method === 'Network.responseReceived' && p.response.status >= 400) errs.push(`HTTP ${p.response.status} ${p.response.url.replace(BASE, '')}`);
  };
  handlers.add(h);
  const ev = (expression) => send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
  // 요청이 다 끝나고 조용해질 때까지 (최소 min, 최대 max)
  const settle = async (min = 1500, max = 45000) => { const t0 = Date.now(); await sleep(min); while (Date.now() - t0 < max) { if (!inflight.size && Date.now() - lastNet > 1500) break; await sleep(200); } await sleep(500); };
  try {
    await send('Page.enable', {}, sessionId); await send('Runtime.enable', {}, sessionId); await send('Network.enable', {}, sessionId);
    const [w, ht] = VP[sc.vp];
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: ht, deviceScaleFactor: 2, mobile: true, screenOrientation: w > ht ? { type: 'landscapePrimary', angle: 90 } : { type: 'portraitPrimary', angle: 0 } }, sessionId);
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId);
    await send('Emulation.setFocusEmulationEnabled', { enabled: true }, sessionId).catch(() => {});
    await send('Page.addScriptToEvaluateOnNewDocument', { source: PRE(sc.empty ? null : seed(sc.ch || 'c1')) }, sessionId);
    await send('Page.addScriptToEvaluateOnNewDocument', { source: MONITOR }, sessionId);
    if (sc.again) { // 한 번 열어 캐시에 담아 둔 뒤 다시 엶
      await send('Page.navigate', { url: BASE + sc.url }, sessionId); await settle(2000);
      await send('Page.navigate', { url: 'about:blank' }, sessionId); await sleep(300);
    }
    await send('Network.emulateNetworkConditions', SLOW, sessionId);
    const t0 = Date.now();
    let filming = FILM && !sc.again;
    const filmDir = path.join(OUT, sc.name);
    if (filming) { fs.mkdirSync(filmDir, { recursive: true }); (async () => { while (filming) { try { const f = await send('Page.captureScreenshot', { format: 'jpeg', quality: 45 }, sessionId); fs.writeFileSync(path.join(filmDir, `f${String(Date.now() - t0).padStart(6, '0')}.jpg`), Buffer.from(f.data, 'base64')); } catch (e) { /* ignore */ } await sleep(350); } })(); }
    await send('Page.navigate', { url: BASE + sc.url }, sessionId);
    await settle(2500, 60000);
    for (const s of sc.steps) {
      await ev(`window.__lc && (__lc.step = ${JSON.stringify(s.name)}, __lc.stepAt = performance.now())`);
      const r = await ev(`(async () => { try { await (${s.js}); return 'ok'; } catch (e) { return 'ERR ' + e.message; } })()`);
      if (r.result && typeof r.result.value === 'string' && r.result.value.startsWith('ERR')) errs.push(`STEP ${s.name}: ${r.result.value}`);
      await settle(s.settle || 1500, 30000);
    }
    filming = false;
    const res = await ev('JSON.stringify({ ev: (window.__lc || {}).ev || [], url: location.pathname + location.search + location.hash, total: Math.round(performance.now()), vis: document.visibilityState })');
    const out = JSON.parse(res.result.value);
    const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 60 }, sessionId);
    fs.writeFileSync(path.join(OUT, sc.name + '.jpg'), Buffer.from(shot.data, 'base64'));
    if (out.vis !== 'visible') errs.push('TAB ' + out.vis);
    return { url: out.url, vp: sc.vp, again: !!sc.again, steps: ['load', ...sc.steps.map((s) => s.name)], ms: Date.now() - t0, events: out.ev, errors: errs };
  } finally {
    handlers.delete(h);
    await send('Target.closeTarget', { targetId }).catch(() => {});
    await send('Target.disposeBrowserContext', { browserContextId }).catch(() => {});
  }
}

const list = S.filter((sc) => !FILTER || FILTER.test(sc.name));
const report = {};
let idx = 0;
await Promise.all(Array.from({ length: PAR }, async () => {
  while (idx < list.length) {
    const sc = list[idx++];
    try { report[sc.name] = await run(sc); fs.writeFileSync(path.join(OUT, 'load_report.json'), JSON.stringify(report, null, 1)); const f = report[sc.name].events.filter((e) => e.k !== 'reveal').length; process.stdout.write(f ? `\n${sc.name}: 문제 ${f}개` : `\n${sc.name}: OK`); } catch (e) { report[sc.name] = { error: e.message }; console.log('\nERR', sc.name, e.message); }
  }
}));
fs.writeFileSync(path.join(OUT, 'load_report.json'), JSON.stringify(report, null, 1));
console.log(`\n화면 ${list.length}개 검사 끝 → ${path.join(OUT, 'load_report.json')}`);
chrome.kill(); await sleep(300); try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) { /* ignore */ }
process.exit(0);
