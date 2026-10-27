'use strict';
// 은유와 은결의 다트 게임 — 카운트업: 한 라운드에 다트 3개, 8라운드(24개) 점수를 모두 더함
//  · 던지기: ① 다트판 위를 왼쪽·오른쪽으로 움직이는 세로 줄을 톡 → 가로 위치  ② 위·아래로 움직이는 가로 줄을 톡 → 세로 위치
//           → 두 줄이 만난 곳으로 다트가 날아감 (손이 흔들리는 일 없이 고른 곳 그대로)
//  · 점수: 진짜 다트판처럼 1~20 칸, 트리플(3배)·더블(2배) 링, 불 50점·바깥 불 25점, 판 밖 0점 (art.js score)
//  · 줄 속도: 빠르게 (불만 맞히지 않게), 라운드마다 조금씩 더 빨라짐
//  · 은유·은결: 내 캐릭터가 왼쪽에서 던지고, 쌍둥이는 오른쪽에서 응원 (잘 맞히면 기뻐하고, 밖으로 나가면 아쉬워함)
// 폰 세로: 논리 폭 540 / 폰 가로·태블릿 가로·PC: 논리 높이 540

let W = 540, H = 960;
const D = window.DartArt;
const ASSET_V = '202610272140';
const ROUNDS = 8, PER = 3;
const AMP = 1.2; // 줄이 움직이는 범위 (더블 링 바깥 = 1, 조금 밖까지 나감)
const period = (r) => 1 - (r - 1) * 0.048; // 줄이 한 번 갔다 오는 시간(초): 1라운드 1초 기준 (사용자 요청) → 8라운드 약 0.66초

// ---------- save (메인 화면 없이 단독 실행할 때) ----------
const Save = {
  data: { best: 0, sound: true },
  load() { try { Object.assign(this.data, JSON.parse(localStorage.getItem('darts_v1') || '{}')); } catch (e) { /* private mode */ } },
  store() { try { localStorage.setItem('darts_v1', JSON.stringify(this.data)); } catch (e) { /* ignore */ } },
};
Save.load();
const HUB = window.Hub && window.Hub.active() ? window.Hub : null;
if (HUB) { Save.data.sound = HUB.settings.sound; Save.data.best = HUB.rec('darts').best; }
const GOD = () => !!(window.Hub && window.Hub.god); // 무적 쿠폰 (테스트용)

// ---------- utils ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const $ = (id) => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const fmt = (n) => Math.round(n).toLocaleString();

const myLook = (() => {
  const c = HUB && HUB.active(), lk = (c && c.look) || 'eunyu3';
  if (window.CharV2 && window.CharV2.is(lk)) return lk;
  return lk.startsWith('eungyeol') ? 'eungyeol3' : 'eunyu3';
})();
const twinLook = myLook.startsWith('eungyeol') ? 'eunyu3' : 'eungyeol3';
if (window.CharV2) { window.CharV2.load(myLook); window.CharV2.load(twinLook); }
const DART_COL = myLook.startsWith('eungyeol') ? '#4FA3FF' : '#FF6B95';

// ---------- audio (효과음만) ----------
const Audio = {
  ctx: null, master: null, gain: null,
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.gain = this.ctx.createGain(); this.gain.gain.value = 0.4; this.gain.connect(this.master);
      const b = this.ctx.createBuffer(1, 1, 22050), s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.master); s.start(0);
      this.master.gain.value = Save.data.sound ? 1 : 0;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone(f, d, type = 'sine', v = 0.4, slide = 0, when = 0) {
    if (!this.ctx || !Save.data.sound) return;
    const t = this.ctx.currentTime + Math.max(0, when), o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(this.gain); o.start(t); o.stop(t + d + 0.02);
  },
  sfx(n) {
    switch (n) {
      case 'stopX': this.tone(660, 0.08, 'triangle', 0.3); break;
      case 'stopY': this.tone(880, 0.08, 'triangle', 0.3); break;
      case 'whoosh': this.tone(1400, 0.3, 'sine', 0.12, -1000); break;
      case 'thunk': this.tone(160, 0.08, 'square', 0.25, -60); this.tone(2400, 0.03, 'triangle', 0.12, 0, 0.01); break;
      case 'miss': this.tone(500, 0.3, 'sine', 0.16, -300); break;
      case 'good': [784, 988].forEach((f, i) => this.tone(f, 0.1, 'triangle', 0.24, 0, i * 0.06)); break;
      case 'great': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.24, 0, i * 0.06)); break;
      case 'bull': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.16, 'square', 0.14, 0, i * 0.07)); break;
      case 'round': [659, 784, 1046].forEach((f, i) => this.tone(f, 0.14, 'sine', 0.26, 0, i * 0.08)); break;
      case 'over': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.26, 0, i * 0.13)); break;
      case 'best': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.18, 'square', 0.14, 0, i * 0.1)); break;
      case 'ui': this.tone(700, 0.06, 'triangle', 0.25); break;
    }
  },
};

// ---------- state ----------
const cv = $('cv'), ctx = cv.getContext('2d'), root = $('root');
let scale = 1, dpr = 1;
// 상태: ready → play → done → result / pause
// 던지는 단계 G.phase: x(가로 줄 움직임) → y(세로 줄 움직임) → fly(날아감) → land(꽂힘, 잠깐 보기) → round(라운드 점수) → 다음 다트
const G = {
  state: 'ready', phase: 'x', t: 0, pt: 0, round: 1, dart: 0, ax: 0, ay: 0, sx0: 0, sy0: 0,
  darts: [], rounds: [], score: 0, coins: 0, bulls: 0, td: 0, fx: [], hi: null, hiT: 0,
  pose: ['idle', 'idle'], poseT: [0, 0], say: ['', ''], sayT: [0, 0], pausedFrom: 'play', newBest: false,
};
// LAY: 판 가운데 cx·cy, 더블 링 반지름 s, 캐릭터 자리 ch[[x, 발 y, 키]], 던지는 손 hand
const LAY = { cx: 270, cy: 300, s: 170, hintY: 0, ch: [[70, 900, 160], [470, 900, 160]], hand: [90, 800] };
const rim = () => LAY.s * D.R.rim;
function layout() {
  const sv = (k) => parseFloat(getComputedStyle(root).getPropertyValue('--safe-' + k)) || 0;
  const st = sv('t'), sb = sv('b'), sl = sv('l'), sr = sv('r');
  const sheet = $('sheet'), btn = $('btnThrow');
  if (wideLayout()) {
    const P = 290, pr = W - 14 - sr, pl = pr - P, left = 14 + sl, avail = pl - 20 - left;
    LAY.s = Math.min(158, (H - 96) / 2 / D.R.rim, (avail - 30) / 2 / D.R.rim);
    const roomy = avail - 2 * rim() >= 230;
    LAY.cx = left + avail / 2; LAY.cy = Math.max(H / 2 + 14, st + 64 + rim());
    const sTop = st + 62;
    Object.assign(sheet.style, { left: pl + 'px', top: sTop + 'px', width: P + 'px' });
    const sBot = sTop + 10 * 24 + 16;
    if (roomy) {
      const side = (avail / 2 - rim()) / 2 + rim(), h = Math.min(200, H - 330);
      LAY.ch = [[LAY.cx - side, H - 24 - sb, h], [LAY.cx + side, H - 24 - sb, h]];
      Object.assign(btn.style, { left: (pl + P / 2 - 100) + 'px', top: Math.max(sBot + 18, H - 100 - sb) + 'px' });
    } else { // 좁은 가로 화면(태블릿): 은유·은결은 오른쪽 점수판 아래 양옆, 작은 던지기 버튼은 그 사이
      const h = clamp(H - sBot - 50 - sb, 100, 150);
      LAY.ch = [[pl + 38, H - 14 - sb, h], [pr - 38, H - 14 - sb, h]];
      Object.assign(btn.style, { left: (pl + P / 2 - 70) + 'px', top: (H - 96 - sb) + 'px' });
    }
    btn.classList.toggle('mini', !roomy);
    LAY.hintY = 0;
  } else {
    LAY.s = H >= 1000 ? 180 : 164; LAY.cx = W / 2; LAY.cy = st + 78 + rim();
    const sTop = LAY.cy + rim() + 34;
    Object.assign(sheet.style, { left: '14px', top: sTop + 'px', width: (W - 28) + 'px' });
    const sBot = sTop + 5 * 26 + 38, by = Math.max(sBot + 14, H - 112 - sb);
    Object.assign(btn.style, { left: (W / 2 - 115) + 'px', top: by + 'px' });
    const h = clamp(H - sBot - 40 - sb, 110, 250);
    btn.classList.remove('mini'); LAY.hintY = sBot + 30;
    LAY.ch = [[74, H - 18 - sb, h], [W - 74, H - 18 - sb, h]];
  }
  LAY.hand = [LAY.ch[0][0] + LAY.ch[0][2] * 0.25, LAY.ch[0][1] - LAY.ch[0][2] * 0.7];
  buildSheet($('sheet'), wideLayout());
}
// 판 좌표 ↔ 화면 좌표
const toX = (u) => LAY.cx + u * LAY.s, toY = (v) => LAY.cy + v * LAY.s;
// 줄 위치: 같은 빠르기로 왔다 갔다 (가장자리에서 느려지지 않음)
function sweep(t, T) { const u = (t / T) % 1, v = u < 0.5 ? u * 2 : 2 - u * 2; return -AMP + 2 * AMP * v; }

// ---------- 라운드 점수판 ----------
let sheetWide = null;
function buildSheet(el, wide) {
  if (el === $('sheet') && sheetWide === wide && el.childElementCount) { renderSheet(); return; }
  if (el === $('sheet')) sheetWide = wide;
  el.innerHTML = '';
  const cell = (cls, txt, id) => { const d = document.createElement('div'); d.className = cls; if (txt != null) d.textContent = txt; if (id) d.dataset.k = id; el.appendChild(d); };
  if (wide) { // 세로로 8줄: R | 1 | 2 | 3 | 합계
    el.style.gridTemplateColumns = '1fr 1fr 1fr 1fr 1.3fr';
    ['', '1', '2', '3', '합계'].forEach((t) => cell('h', t));
    for (let r = 0; r < ROUNDS; r++) { cell('h r' + r, `${r + 1}R`); for (let d = 0; d < PER; d++) cell('c r' + r, '', `${r}_${d}`); cell('sum r' + r, '', `${r}_s`); }
  } else { // 가로로 8칸: 위에 1R~8R, 아래로 1·2·3번째 다트, 합계
    el.style.gridTemplateColumns = `38px repeat(${ROUNDS}, 1fr)`;
    cell('lb', '');
    for (let r = 0; r < ROUNDS; r++) cell('h r' + r, `${r + 1}R`);
    for (let d = 0; d < PER; d++) { cell('lb', `${d + 1}번`); for (let r = 0; r < ROUNDS; r++) cell('c r' + r, '', `${r}_${d}`); }
    cell('lb', '합계'); for (let r = 0; r < ROUNDS; r++) cell('sum r' + r, '', `${r}_s`);
  }
  cell('tot', '', 'tot');
  renderSheet(el);
}
function renderSheet(el = $('sheet')) {
  for (const c of el.querySelectorAll('[data-k]')) {
    const k = c.dataset.k;
    if (k === 'tot') { c.textContent = `합계 ${fmt(G.score)}점`; continue; }
    const [r, d] = k.split('_'), R = G.rounds[+r];
    c.classList.remove('bull', 'tri', 'out');
    if (d === 's') { c.textContent = R && R.length ? R.reduce((a, x) => a + x.pts, 0) : ''; continue; }
    const x = R && R[+d];
    c.textContent = x ? (x.ring === 'miss' ? '0' : x.ring === 'single' ? x.pts : x.label) : '';
    if (x) c.classList.add(x.ring === 'bull' || x.ring === 'outer' ? 'bull' : x.ring === 'triple' || x.ring === 'double' ? 'tri' : x.ring === 'miss' ? 'out' : 'x');
  }
  for (const c of el.children) c.classList.toggle('now', G.state !== 'result' && el === $('sheet') && c.classList.contains('r' + (G.round - 1)));
}

// ---------- run ----------
function startRun() {
  clearTimers();
  Object.assign(G, { round: 1, dart: 0, darts: [], rounds: [[]], score: 0, coins: 0, bulls: 0, td: 0, fx: [], hi: null, newBest: false, pose: ['idle', 'idle'], poseT: [0, 0], say: ['', ''], sayT: [0, 0] });
  $('hudBest').textContent = fmt(Save.data.best || 0);
  setState('play');
  renderSheet();
  newDart();
  say(1, pick(['가운데를 노려 봐!', '할 수 있어!', '힘내!']), 1.6);
}
function newDart() {
  G.phase = 'x'; G.pt = 0; setPose(0, 'ready', 99);
  updateThrowBtn();
}
function updateThrowBtn() {
  const b = $('btnThrow');
  b.classList.toggle('y', G.phase === 'y'); b.classList.toggle('wait', G.phase !== 'x' && G.phase !== 'y');
  $('throwT').textContent = G.phase === 'y' ? '세로 멈추기' : G.phase === 'x' ? '가로 멈추기' : '슝~';
  $('throwS').textContent = G.phase === 'y' ? '파란 줄 톡! → 다트 발사' : G.phase === 'x' ? '분홍 줄을 톡!' : `${G.round}라운드 · ${Math.min(PER, G.dart + 1)}번째 다트`;
}
// 톡: 가로 멈추기 → 세로 멈추기(=던지기)
function tap() {
  if (G.state !== 'play' || G.pt < 0.12) return;
  Audio.unlock();
  if (G.phase === 'x') { G.ax = sweep(G.pt, period(G.round)); G.phase = 'y'; G.pt = 0; Audio.sfx('stopX'); updateThrowBtn(); }
  else if (G.phase === 'y') { G.ay = sweep(G.pt, period(G.round) * 0.92); throwDart(G.ax, G.ay); }
}
function throwDart(x, y) {
  G.ax = x; G.ay = y; G.phase = 'fly'; G.pt = 0; G.sx0 = LAY.hand[0]; G.sy0 = LAY.hand[1];
  setPose(0, 'cheer', 0.3); Audio.sfx('whoosh'); updateThrowBtn();
}
const FLY = 0.42;
function land() {
  const r = D.score(G.ax, G.ay);
  G.phase = 'land'; G.pt = 0;
  G.darts.push({ x: G.ax, y: G.ay, t: G.t, r });
  G.rounds[G.round - 1].push(r);
  G.score += r.pts; G.dart++;
  if (r.ring === 'bull') G.bulls++;
  if (r.ring === 'triple' || r.ring === 'double') G.td++;
  // 코인: 판에 맞으면 +2, 트리플·더블 +3 더, 바깥 불 +5, 불 +8
  if (!GOD()) G.coins += r.ring === 'miss' ? 0 : 2 + (r.mult >= 2 ? 3 : 0) + (r.ring === 'outer' ? 5 : 0) + (r.ring === 'bull' ? 8 : 0);
  G.hi = r.ring === 'miss' ? null : r; G.hiT = 0.9;
  const px = toX(G.ax), py = toY(G.ay);
  if (r.ring === 'miss') {
    Audio.sfx('miss'); setPose(0, 'hit', 0.9); setPose(1, 'idle', 0);
    say(1, pick(['아깝다!', '괜찮아!', '다음엔 들어갈 거야!']), 1.2);
  } else {
    Audio.sfx('thunk');
    const big = r.ring === 'bull' || r.pts >= 40, mid = r.ring === 'outer' || r.mult >= 2 || r.pts >= 20;
    later(() => Audio.sfx(r.ring === 'bull' ? 'bull' : big ? 'great' : mid ? 'good' : 'ui'), 80);
    setPose(0, big ? 'cheer' : mid ? 'happy' : 'idle', 1); setPose(1, big ? 'cheer' : mid ? 'happy' : 'idle', 1);
    if (r.ring === 'bull') say(1, pick(['불이다! 최고야!', '한가운데! 대단해!']), 1.4);
    else if (r.ring === 'triple') say(1, pick(['트리플! 세 배야!', '와! 세 배!']), 1.3);
    else if (r.ring === 'double') say(1, pick(['더블! 두 배!', '두 배 점수야!']), 1.3);
    else if (r.ring === 'outer') say(1, '바깥 불! 25점!', 1.3);
    else if (r.pts >= 15) say(1, pick(['좋아!', '잘했어!']), 1);
    burst(px, py, big ? 12 : mid ? 8 : 4, r.ring === 'bull' ? '#FF5A7A' : '#FFD34D');
  }
  const name = r.ring === 'bull' ? 'BULL! 50' : r.ring === 'outer' ? '바깥 불 25' : r.ring === 'triple' ? `트리플 ${r.num} = ${r.pts}` : r.ring === 'double' ? `더블 ${r.num} = ${r.pts}` : r.ring === 'miss' ? '아웃! 0점' : `${r.pts}점`;
  G.fx.push({ kind: 'text', text: name, x: clamp(px, LAY.cx - rim() + 90, LAY.cx + rim() - 90), y: py - 40, t: 0, life: 1.1, big: r.ring === 'bull' || r.mult >= 2, bad: r.ring === 'miss' });
  renderSheet();
  if (G.dart >= PER) later(endRound, 900);
  else later(newDart, 750);
}
function endRound() {
  const sum = G.rounds[G.round - 1].reduce((a, x) => a + x.pts, 0);
  G.phase = 'round'; G.pt = 0; updateThrowBtn();
  Audio.sfx('round');
  if (sum >= 100 && !GOD()) G.coins += 5; // 한 라운드 100점 넘으면 +5
  G.fx.push({ kind: 'banner', text: `${G.round}라운드 ${sum}점!`, sub: sum >= 100 ? '100점 넘었어요! 코인 +5' : sum >= 60 ? '아주 잘했어요!' : sum >= 30 ? '좋아요!' : '다음 라운드 힘내요!', t: 0, life: 1.5 });
  if (sum >= 60) { setPose(0, 'cheer', 1.4); setPose(1, 'cheer', 1.4); }
  later(() => {
    G.darts = [];
    if (G.round >= ROUNDS) { finish(); return; }
    G.round++; G.dart = 0; G.rounds.push([]);
    renderSheet();
    if (G.round === ROUNDS) G.fx.push({ kind: 'banner', text: '마지막 라운드!', sub: '줄이 조금 더 빨라요', t: 0, life: 1.1 });
    newDart();
  }, 1500);
}
function finish() {
  setState('done');
  Audio.sfx('over');
  setPose(0, 'cheer', 9); setPose(1, 'cheer', 9);
  say(1, `${fmt(G.score)}점! 멋져!`, 2);
  later(showResult, 1300);
}
function showResult() {
  const score = G.score;
  G.newBest = score > (Save.data.best || 0) && score > 0;
  if (G.newBest) Save.data.best = score;
  if (!HUB) Save.store();
  $('resEarn').classList.toggle('hidden', !HUB);
  if (HUB) {
    const h = HUB.record('darts', { dist: score, coins: G.coins });
    $('resEarn').innerHTML = h.god ? '무적 모드라서 기록·코인이 없어요' : `+${h.earned} 코인 획득!` + (h.bonus ? ` <small>(점수 보너스 +${h.bonus})</small>` : '') + `<small>내 코인 ${h.coins}</small>`;
  }
  const sums = G.rounds.map((R) => R.reduce((a, x) => a + x.pts, 0)), bi = sums.indexOf(Math.max(...sums));
  $('resTitle').textContent = score >= 500 ? '다트 챔피언!' : score >= 300 ? '다트 실력자!' : '다트 끝!';
  $('resScore').textContent = fmt(score);
  $('resBull').textContent = `${G.bulls}번`;
  $('resTD').textContent = `${G.td}번`;
  $('resBestR').textContent = `${bi + 1}라운드 ${sums[bi]}점`;
  $('resCoin').textContent = G.coins;
  $('resBestVal').textContent = `${fmt(Save.data.best || 0)}점`;
  $('resBest').classList.toggle('hidden', !G.newBest);
  setState('result');
  buildSheet($('resSheet'), true);
  if (G.newBest) Audio.sfx('best');
}
function showReady() {
  clearTimers();
  $('readyInfo').innerHTML = `BEST <b>${fmt(Save.data.best || 0)}점</b>`;
  G.darts = []; G.rounds = []; G.score = 0;
  setState('ready');
}
let runId = 0;
const timers = [];
function later(fn, ms) { const id = runId; timers.push({ id, at: G.t + ms / 1000, fn }); }
function clearTimers() { runId++; timers.length = 0; }
function runTimers() { // 게임 시간으로 흐르는 타이머 (일시정지하면 같이 멈춤)
  for (let i = 0; i < timers.length; i++) {
    const tm = timers[i];
    if (tm.id !== runId) { timers.splice(i--, 1); continue; }
    if (G.t >= tm.at) { timers.splice(i--, 1); tm.fn(); }
  }
}
function setPose(k, p, t) { G.pose[k] = p; G.poseT[k] = t; }
function say(k, txt, t) { G.say[k] = txt; G.sayT[k] = t; }
function burst(x, y, n, col) {
  for (let i = 0; i < n; i++) {
    const an = rnd(0, Math.PI * 2), sp = rnd(120, 240);
    G.fx.push({ kind: 'spark', x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 60, r: rnd(7, 12), c: i % 2 ? '#FFFFFF' : col, t: 0, life: rnd(0.4, 0.7) });
  }
}

// ---------- update ----------
function step(dt) {
  for (const f of G.fx) { f.t += dt; if (f.vx != null) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 500 * dt; } }
  G.fx = G.fx.filter((f) => f.t < f.life);
  if (G.state === 'pause') return;
  G.t += dt;
  for (let k = 0; k < 2; k++) {
    if (G.poseT[k] > 0) { G.poseT[k] -= dt; if (G.poseT[k] <= 0) G.pose[k] = k === 0 && G.state === 'play' && (G.phase === 'x' || G.phase === 'y') ? 'ready' : 'idle'; }
    if (G.sayT[k] > 0) G.sayT[k] -= dt;
  }
  if (G.hiT > 0) G.hiT -= dt;
  runTimers();
  if (G.state !== 'play') return;
  G.pt += dt;
  if (G.phase === 'fly' && G.pt >= FLY) land();
}

// ---------- render ----------
function render() {
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  D.bg(ctx, W, H, G.t);
  const s = LAY.s, cx = LAY.cx, cy = LAY.cy;
  D.board(ctx, cx, cy, s, { hi: G.hiT > 0 ? G.hi : null, hiA: clamp(G.hiT / 0.9, 0, 1) * (0.4 + 0.3 * Math.abs(Math.sin(G.t * 12))) });
  // 꽂힌 다트 (이번 라운드)
  for (const d of G.darts) { const k = Math.min(1, (G.t - d.t) / 0.12); D.dart(ctx, toX(d.x), toY(d.y), (s / 170) * (1.25 - 0.25 * k), DART_COL); }
  if (G.state === 'play' || G.state === 'pause') drawAim();
  drawTwins();
  if (G.phase === 'fly' && (G.state === 'play' || G.state === 'pause')) drawFlying();
  drawDartsLeft();
  drawFx();
}
// 조준 줄: 가로 단계는 세로 줄이 좌우로, 세로 단계는 가로 줄이 위아래로. 판 밖 아래·왼쪽에 작은 눈금 막대
function drawAim() {
  const s = LAY.s, cx = LAY.cx, cy = LAY.cy, A = AMP * s;
  const ph = G.phase, T = period(G.round);
  if (ph !== 'x' && ph !== 'y') return;
  const x = ph === 'x' ? sweep(G.pt, T) : G.ax, y = ph === 'y' ? sweep(G.pt, T * 0.92) : null;
  const X = toX(x);
  ctx.save();
  // 막대 (판 아래: 가로, 판 왼쪽: 세로)
  const by = cy + A + 18, bx = cx - A - 18;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(42,35,72,.55)'; ctx.lineWidth = 12;
  ctx.beginPath(); ctx.moveTo(cx - A, by); ctx.lineTo(cx + A, by); ctx.stroke();
  if (ph === 'y') { ctx.beginPath(); ctx.moveTo(bx, cy - A); ctx.lineTo(bx, cy + A); ctx.stroke(); }
  // 세로 줄 (가로 위치)
  const pulse = 0.75 + 0.25 * Math.sin(G.t * 10);
  ctx.lineWidth = ph === 'x' ? 6 : 4; ctx.strokeStyle = ph === 'x' ? `rgba(255,90,140,${pulse})` : 'rgba(255,90,140,.85)';
  ctx.setLineDash(ph === 'x' ? [] : [10, 8]);
  ctx.beginPath(); ctx.moveTo(X, cy - A); ctx.lineTo(X, cy + A); ctx.stroke();
  ctx.setLineDash([]);
  marker(X, by, '#FF5A8C', 'up');
  if (y != null) {
    const Y = toY(y);
    ctx.lineWidth = 6; ctx.strokeStyle = `rgba(47,154,232,${pulse})`;
    ctx.beginPath(); ctx.moveTo(cx - A, Y); ctx.lineTo(cx + A, Y); ctx.stroke();
    marker(bx, Y, '#2F9AE8', 'right');
    // 만나는 곳: 과녁 표시
    ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(X, Y, 14, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#2A2348'; ctx.beginPath(); ctx.arc(X, Y, 18, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  // 안내 글
  const txt = ph === 'x' ? '분홍 줄을 원하는 곳에서 톡!' : '파란 줄을 원하는 곳에서 톡!';
  ctx.save(); ctx.font = '22px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (LAY.hintY) { // 세로 화면만: 점수판 아래 (가로 화면은 던지기 버튼 글로 안내)
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(60,30,0,.85)'; ctx.strokeText(txt, cx, LAY.hintY);
    ctx.fillStyle = ph === 'x' ? '#FFD6E2' : '#D6EEFF'; ctx.fillText(txt, cx, LAY.hintY);
  }
  ctx.restore();
}
function marker(x, y, col, dir) {
  ctx.save(); ctx.translate(x, y); if (dir === 'right') ctx.rotate(-Math.PI / 2);
  ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(13, 8); ctx.lineTo(-13, 8); ctx.closePath();
  ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.restore();
}
// 날아가는 다트: 은유(은결)의 손에서 고른 곳까지 포물선, 점점 작아짐
function drawFlying() {
  const k = clamp(G.pt / FLY, 0, 1), e = 1 - (1 - k) * (1 - k);
  const tx = toX(G.ax), ty = toY(G.ay);
  const x = G.sx0 + (tx - G.sx0) * e, y = G.sy0 + (ty - G.sy0) * e - Math.sin(k * Math.PI) * 90;
  D.dart(ctx, x, y, (LAY.s / 170) * (2.4 - 1.2 * e), DART_COL, -0.5 - (1 - k) * 0.6);
}
// 남은 다트 (판 오른쪽 아래)
function drawDartsLeft() {
  if (G.state !== 'play' && G.state !== 'pause') return;
  const left = PER - G.dart - (G.phase === 'fly' ? 1 : 0);
  const x0 = LAY.cx + rim() * 0.78, y0 = LAY.cy + rim() * 0.98;
  for (let i = 0; i < PER; i++) {
    ctx.save(); ctx.globalAlpha = i < left ? 1 : 0.25; D.dart(ctx, x0 + i * 20, y0, 0.62, DART_COL, 0.15); ctx.restore();
  }
}
// 은유·은결: 왼쪽(내 캐릭터)이 던지고, 오른쪽(쌍둥이)이 응원. 말풍선으로 반응
function drawTwins() {
  const CV = window.CharV2; if (!CV) return;
  [myLook, twinLook].forEach((lk, k) => {
    if (!CV.ready(lk)) return;
    const [x, y, h] = LAY.ch[k];
    const want = G.pose[k], use = CV.has(lk, want) ? want : 'idle';
    const bob = use === 'cheer' ? -Math.abs(Math.sin(G.t * 10)) * 10 : use === 'happy' ? -Math.abs(Math.sin(G.t * 7)) * 5 : Math.sin(G.t * 3 + k) * 2;
    ctx.save(); ctx.translate(x, y + bob); CV.draw(ctx, lk, use, { h, flip: k === 1 }); ctx.restore();
    if (G.sayT[k] > 0 && G.say[k]) bubble(x, y - h * 1.02, G.say[k], k);
  });
}
function bubble(x, y, txt, k) {
  ctx.save(); ctx.font = '20px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(txt).width + 24, h = 36;
  const bx = clamp(x, w / 2 + 6, W - w / 2 - 6), by = Math.max(h / 2 + 4, y - h / 2);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = k ? '#2F9AE8' : '#FF5A8C'; ctx.lineWidth = 3;
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx - w / 2, by - h / 2, w, h, 16); else ctx.rect(bx - w / 2, by - h / 2, w, h);
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 7, by + h / 2 - 1); ctx.lineTo(x, by + h / 2 + 10); ctx.lineTo(x + 7, by + h / 2 - 1); ctx.fill();
  ctx.fillStyle = '#2A2348'; ctx.fillText(txt, bx, by + 1); ctx.restore();
}
function drawFx() {
  for (const f of G.fx) {
    const k = f.t / f.life;
    if (f.kind === 'spark') {
      ctx.save(); ctx.globalAlpha = 1 - k * k; ctx.translate(f.x, f.y); ctx.rotate(f.t * 6); ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? f.r * 0.45 : f.r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fillStyle = f.c; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(122,62,0,.5)'; ctx.stroke(); ctx.restore(); continue;
    }
    if (f.kind === 'banner') {
      const a = k < 0.12 ? k / 0.12 : 1 - Math.max(0, k - 0.8) / 0.2, sc = k < 0.12 ? 0.7 + k / 0.12 * 0.3 : 1;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(LAY.cx, LAY.cy); ctx.scale(sc, sc);
      ctx.fillStyle = 'rgba(42,35,72,.88)'; ctx.strokeStyle = '#FFD34D'; ctx.lineWidth = 4;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-190, -62, 380, 124, 26); else ctx.rect(-190, -62, 380, 124); ctx.fill(); ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '44px Jua, sans-serif'; ctx.fillStyle = '#FFE07A'; ctx.fillText(f.text, 0, -16);
      ctx.font = '22px Jua, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(f.sub, 0, 32);
      ctx.restore(); continue;
    }
    if (f.kind === 'text') {
      ctx.save(); ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
      ctx.font = `${f.big ? 40 : 32}px Jua, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 8; ctx.strokeStyle = f.bad ? '#5A5F6C' : '#7A3E00'; ctx.strokeText(f.text, f.x, f.y - k * 34);
      ctx.fillStyle = f.bad ? '#E6E9F0' : f.big ? '#FFF27A' : '#FFE07A'; ctx.fillText(f.text, f.x, f.y - k * 34);
      ctx.restore();
    }
  }
}

// ---------- HUD ----------
let lastKey = '';
function updateHud() {
  const key = `${G.score}|${G.coins}|${G.round}`;
  if (key === lastKey) return;
  lastKey = key;
  $('hudScore').textContent = fmt(G.score); $('hudCoin').textContent = G.coins; $('hudRound').textContent = G.round;
  $('hudBest').textContent = fmt(Math.max(Save.data.best || 0, G.score));
}
let toastT = 0;
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.add('hidden'), 1600); }

// ---------- screens ----------
function setState(s) {
  G.state = s;
  $('ready').classList.toggle('hidden', s !== 'ready');
  $('pause').classList.toggle('hidden', s !== 'pause');
  $('result').classList.toggle('hidden', s !== 'result');
  $('hud').classList.toggle('hidden', !['play', 'pause', 'done'].includes(s));
  lastKey = '';
}
function pauseGame() {
  if (G.state === 'play') { $('verTxt').textContent = `버전 ${ASSET_V}`; G.pausedFrom = G.state; setState('pause'); }
}
function resumeGame() { if (G.state === 'pause') { setState(G.pausedFrom); last = performance.now(); } }
function goHome() { clearTimers(); if (HUB) location.href = '../index.html#lobby'; else showReady(); }

// ---------- input: 화면 아무 곳이나 톡 (버튼 포함) ----------
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
cv.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); });
$('btnThrow').addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); });
$('sheet').style.pointerEvents = 'auto';
$('sheet').addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); });
window.addEventListener('keydown', (e) => {
  Audio.unlock();
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault(); if (e.repeat) return;
    if (G.state === 'ready') $('btnGo').click(); else tap();
    return;
  }
  if (e.code === 'Escape' || e.code === 'KeyP') { if (G.state === 'play') pauseGame(); else if (G.state === 'pause') resumeGame(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('blur', () => pauseGame());
const click = (id, fn) => $(id).addEventListener('click', () => { Audio.unlock(); Audio.sfx('ui'); fn(); });
click('btnGo', startRun);
click('btnReadyHome', goHome); click('btnHomeP', goHome); click('btnHomeR', goHome);
click('btnPause', pauseGame); click('btnResume', resumeGame);
click('btnRetryP', startRun); click('btnRetry', startRun);
$('btnReadyHome').classList.toggle('hidden', !HUB);

// ---------- layout ----------
function wideLayout() { return W > H; }
function resize() {
  const vv = window.visualViewport;
  const vw = Math.round(vv ? vv.width : window.innerWidth), vh = Math.round(vv ? vv.height : window.innerHeight);
  const s = $('safe').getBoundingClientRect();
  const inset = { t: s.top, l: s.left, r: vw - s.right, b: vh - s.bottom };
  if (vh > vw) { W = 540; H = Math.round(clamp(W * vh / vw, 860, 1240)); }
  else { H = 540; W = Math.round(clamp(H * vw / vh, 720, 1300)); }
  scale = Math.min(vw / W, vh / H);
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  root.style.width = W + 'px'; root.style.height = H + 'px';
  root.classList.toggle('wide', wideLayout());
  const ox = (vw - W * scale) / 2, oy = (vh - H * scale) / 2;
  root.style.transform = `translate(${ox}px, ${oy}px) scale(${scale})`;
  for (const k of ['l', 'r', 't', 'b']) root.style.setProperty('--safe-' + k, Math.max(0, (inset[k] - (k === 'l' || k === 'r' ? ox : oy)) / scale) + 'px');
  cv.width = Math.round(W * scale * dpr); cv.height = Math.round(H * scale * dpr);
  layout();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000; last = now; if (dt > 0.05) dt = 0.05; if (dt < 0) dt = 0;
  step(dt);
  if (['play', 'pause', 'done'].includes(G.state)) updateHud();
  render();
  requestAnimationFrame(frame);
}
resize();
showReady();
if (new URLSearchParams(location.search).get('go') === '1') startRun(); // 인트로 START: 준비 창 없이 바로
requestAnimationFrame(frame);
if (document.fonts) document.fonts.ready.then(() => { lastKey = ''; });

// debug/test hook
window.__darts = { G, step, render, tap, throwDart, startRun, showResult, LAY, score: D.score, sweep, period, toast };
