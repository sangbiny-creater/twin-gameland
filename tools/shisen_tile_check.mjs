// 사천성 빈 타일 검사: 헤드리스 Chrome으로 200판(쉬움 100 + 어려움 100)을 모두 만들어
// 화면에 그려진 맨 위 타일마다 그림이 실제로 그려졌는지(그림 없는 회색·갈색 빈 칸이 아닌지) 확인
//   node tools/shisen_tile_check.mjs            (먼저 저장소 폴더에서 python3 -m http.server 8080)
//   SHOTS=폴더 → 9-4 화면을 화면 크기마다 찍어 둠 / BASE=http://localhost:8080/  ROUNDS=판마다 짝을 없애 가며 다시 볼 횟수(기본 4)
// 판마다: 처음 판 → 짝을 조금씩 없애고(아래층이 드러남) → 섞기 뒤까지 확인. 빈 타일이 하나라도 있으면 실패(종료 코드 1)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:8080/';
const ROUNDS = +(process.env.ROUNDS || 4);
const SHOTS = process.env.SHOTS ? path.resolve(process.env.SHOTS) : null;
const PORT = 9400 + Math.floor(Math.random() * 400);
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'twin-chrome-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--hide-scrollbars', '--mute-audio', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wsUrl() {
  for (let i = 0; i < 50; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); return (await r.json()).webSocketDebuggerUrl; } catch (e) { await sleep(200); } }
  throw new Error('Chrome이 열리지 않았어요');
}
const ws = new WebSocket(await wsUrl());
await new Promise((r) => ws.addEventListener('open', r));
let mid = 0; const pend = new Map(); const errors = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); return; }
  if (m.method === 'Runtime.exceptionThrown') errors.push('오류: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split('\n')[0]);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('콘솔: ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
  if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) errors.push(`${m.params.response.status}: ${m.params.response.url}`);
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++mid; pend.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })); });
const evalJs = async (s, expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, s); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };

// 페이지 안에서 돌릴 검사: 지금 화면(캔버스)에서 맨 위 타일 칸마다 층 바탕색(크림·하늘·연보라) 픽셀이 충분히 있는지
//  그림 없는 빈 칸은 그림자·옆면만 보여서 바탕색 픽셀이 거의 0
const PAGE = `window.__tileCheck = function () {
  render();
  const out = [], d = dpr * scale, cv = canvas.getContext('2d');
  const UL = upLift(), bgs = { 1: [255, 246, 232], 2: [214, 233, 255], 3: [236, 220, 255] };
  for (let y = 0; y < G.rows; y++) for (let x = 0; x < G.cols; x++) {
    const z = topZ(x, y); if (!z) continue;
    const t = G.b.f[z - 1][y][x], name = G.pool[t];
    if (!name || !frameOf(name)) { out.push({ x, y, z, name: String(name), why: '그림 없음' }); continue; }
    const c = cellCenter({ x, y }), cy = c.y - UL * (z - 1);
    const w = BL.tw * 0.8, h = BL.th * 0.8;
    const px = cv.getImageData(Math.round((c.x - w / 2) * d), Math.round((cy - h / 2) * d), Math.max(1, Math.round(w * d)), Math.max(1, Math.round(h * d))).data;
    // 층 색 바탕 또는 (층 색 그림이 비었을 때 깔리는) 원래 크림색 바탕
    const cols = [bgs[z], bgs[1]]; let hit = 0, n = 0;
    for (let i = 0; i < px.length; i += 16) { n++; if (cols.some(([br, bg, bb]) => Math.abs(px[i] - br) < 40 && Math.abs(px[i + 1] - bg) < 40 && Math.abs(px[i + 2] - bb) < 40)) hit++; }
    if (hit / n < 0.04) out.push({ x, y, z, name, why: '빈 칸으로 그려짐', ratio: +(hit / n).toFixed(3) });
  }
  return out;
};
window.__runStage = function (si, rounds) {
  // 잠긴 판도 검사하도록 시작 창·잠금 확인 없이 판만 만듦 (startStage 의 판 만들기 부분과 같음)
  G.si = si; buildBoard(si); G.sel = null; G.hint = null; G.lines = []; G.fx = []; G.texts = []; G.removing = []; G.t = 0; G.time = 1e9; G.limit = 1e9;
  setState('play'); if (!G.b.f) return { label: label(si), bad: [{ why: '판을 못 만듦' }] };
  const bad = [], tag = (k, list) => list.forEach((b) => bad.push(Object.assign({ step: k }, b)));
  tag('처음', __tileCheck());
  const total = G.left, per = Math.max(1, Math.floor(total / (rounds + 1)));
  for (let r = 1; r <= rounds && G.left > 2; r++) {
    for (let k = 0; k < per && G.left > 2; k++) { const p = anyPair(); if (!p) { reshuffle(); continue; } removePair(p[0], p[1], p[2], true); }
    G.removing = []; G.lines = []; G.fx = []; G.texts = [];
    tag('짝 없앤 뒤 ' + r, __tileCheck());
  }
  reshuffle(); tag('섞기 뒤', __tileCheck());
  setState('ready');
  return { label: label(si), bad, tiles: total * 2 };
};`;

let fail = 0;
const result = {};
const VPS = [[390, 844], [844, 390], [1024, 768]];
try {
  for (const [w, h] of VPS) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: s } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Page.enable', {}, s); await send('Runtime.enable', {}, s); await send('Network.enable', {}, s);
    await send('Network.setCacheDisabled', { cacheDisabled: true }, s);
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true }, s);
    await send('Page.navigate', { url: BASE + 'shisen/index.html?stage=0' }, s);
    await sleep(2500);
    await evalJs(s, `(async () => { for (let i = 0; i < 100 && !(SP.ready && SP.ex.ready); i++) await new Promise((r) => setTimeout(r, 100)); document.querySelectorAll('#gpStart').forEach((e) => e.remove()); })()`);
    await evalJs(s, PAGE);
    const vp = `${w}x${h}`; let n = 0, badTiles = 0; const seen = new Set();
    // 0) 검사기 확인: 타일 그림을 일부러 안 그리면 빈 타일을 잡아내는지 (9-4)
    const probe = await evalJs(s, `(() => { const o = spr; spr = () => {}; const save = Object.assign({}, UP_SPR); const blank = (n, z) => { const c = document.createElement('canvas'); c.width = 8; c.height = 8; return c; };
      const ou = upperSprite; upperSprite = blank; const r = __runStage(83, 0); spr = o; upperSprite = ou; return r.bad.length; })()`);
    if (!probe) { console.log(`${vp}: 검사기가 빈 타일을 못 잡아요 (검사 실패)`); fail = 1; }
    // 1) 아이폰 흉내: 위층용 층 색 그림을 모두 빈 그림으로 바꿔도(아이폰이 메모리 정리로 비우는 경우) 그림이 보이는지 — 9-4 와 2·3층 판 몇 개
    const ios = await evalJs(s, `(() => { const ou = upperSprite; upperSprite = () => { const c = document.createElement('canvas'); c.width = 8; c.height = 8; return c; };
      let bad = 0; for (const si of [83, 50, 99, 150, 199]) bad += __runStage(si, 2).bad.length; upperSprite = ou; return bad; })()`);
    console.log(`${vp}: 검사기 확인 (그림을 일부러 지운 9-4 → 빈 타일 ${probe}개 잡음) · 아이폰 흉내(층 색 그림이 비워짐) → 빈 타일 ${ios}개`);
    if (ios) fail = 1;
    for (let si = 0; si < 200; si++) {
      const r = await evalJs(s, `__runStage(${si}, ${ROUNDS})`);
      n++; seen.add(r.label); if (r.bad.length) { badTiles += r.bad.length; result[`${vp} ${r.label}`] = r.bad.slice(0, 5); }
    }
    if (SHOTS) {
      fs.mkdirSync(SHOTS, { recursive: true });
      await evalJs(s, `(() => { G.si = 83; buildBoard(83); G.sel = null; G.hint = null; G.removing = []; G.lines = []; G.fx = []; G.texts = []; G.time = STAGES[83].s; G.limit = STAGES[83].s; setState('play'); for (let k = 0; k < 6; k++) { const p = anyPair(); if (p) removePair(p[0], p[1], p[2], true); } G.removing = []; G.lines = []; G.fx = []; G.texts = []; })()`);
      await sleep(600);
      const shot = await send('Page.captureScreenshot', { format: 'png' }, s);
      fs.writeFileSync(path.join(SHOTS, `shisen-9-4-${vp}.png`), Buffer.from(shot.data, 'base64'));
    }
    console.log(`${vp}: ${seen.size}판(서로 다른 판) 검사, 빈 타일 ${badTiles}개`);
    if (seen.size !== 200) fail = 1;
    if (badTiles) fail = 1;
    await send('Target.closeTarget', { targetId });
  }
} finally {
  ws.close(); chrome.kill();
}
if (Object.keys(result).length) console.log(JSON.stringify(result, null, 1).slice(0, 4000));
if (errors.length) { console.log('콘솔 오류·없는 파일:', [...new Set(errors)].slice(0, 20)); fail = 1; } else console.log('콘솔 오류·없는 파일(404): 없음');
console.log(fail ? '실패' : '통과: 그림 없는 타일 0개');
process.exit(fail);
