'use strict';
// 은유와 은결의 다트 게임 — 카운트업: 한 라운드에 다트 3개, 8라운드(24개) 점수를 모두 더함
//  · 던지기: ① 게이지 막대 안에서 왔다 갔다 하는 점이 원하는 곳에 오면 꾹 누름 → 가로 위치
//           ② 누르고 있는 동안 그 가로 위치에서 과녁 표시(조준경)가 다트판 위를 위·아래로 → 손을 떼면 캐릭터 손에서 그곳으로 다트가 슝
//  · 점수: 진짜 다트판처럼 1~20 칸, 트리플(3배)·더블(2배) 링, 불 50점·바깥 불 25점, 판 밖 0점 (art.js score)
//  · 줄 속도: 모든 라운드 같음 (0.9초에 한 번 왕복)
//  · 은유·은결: 아래 가운데 내 캐릭터 뒷모습이 던지기 버튼, 쌍둥이는 옆에서 응원 (잘 맞히면 기뻐하고, 밖으로 나가면 아쉬워함)
//  · 위: 총점(크게) · 라운드(작게) · 이번 라운드 다트 3개 점수 칸 (다트 3개는 분홍·노랑·파랑). 다트 한 발씩 전체 점수는 결과 창에서
// 폰 세로: 논리 폭 540 / 폰 가로·태블릿 가로·PC: 논리 높이 540

let W = 540, H = 960;
const D = window.DartArt;
const ASSET_V = '202610280021';
const ROUNDS = 8, PER = 3;
const AMP = 1.2; // 줄이 움직이는 범위 (더블 링 바깥 = 1, 조금 밖까지 나감)
// 한 번 갔다 오는 시간(초), 모든 라운드 같음 (사용자 요청으로 맞춘 값)
const period = () => 0.99;   // 좌우: 막대 안 분홍 점 (0.9초에서 10% 느리게)
const periodY = () => 1.24;  // 상하: 누르고 있는 동안 다트 핀 (0.83초에서 50% 느리게)

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

const buzz = (ms) => { try { if (ms && navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };

// ---------- state ----------
const cv = $('cv'), ctx = cv.getContext('2d'), root = $('root');
let scale = 1, dpr = 1;
// 상태: ready → play → done → result / pause
// 던지는 단계 G.phase: x(막대 점 좌우) → y(꾹 누르는 동안 과녁 표시 위아래) → fly(날아감) → land(꽂힘, 잠깐 보기) → round(라운드 점수) → 다음 다트
const G = {
  state: 'ready', phase: 'x', t: 0, pt: 0, round: 1, dart: 0, ax: 0, ay: 0, sx0: 0, sy0: 0, shake: 0,
  darts: [], rounds: [], score: 0, coins: 0, bulls: 0, td: 0, fx: [], hi: null, hiT: 0,
  pose: ['idle', 'idle'], poseT: [0, 0], say: ['', ''], sayT: [0, 0], pausedFrom: 'play', newBest: false,
};
// 한 라운드 다트 3개는 색이 모두 다름 (분홍 · 노랑 · 파랑) — 위 점수 칸 3개도 같은 색
const DART_COLS = ['#FF5A8C', '#FFB21E', '#2F9AE8'];
// 화면 (세로): 위 총점·라운드·이번 라운드 점수 칸 3개 → 다트판 → 좌우 게이지 막대 → 내 캐릭터 뒷모습(= 던지기 버튼)
//      (가로): 가운데 세로로 다트판 → 게이지 → 캐릭터 버튼, 왼쪽에 총점·점수 칸, 오른쪽에 응원하는 쌍둥이
// LAY: 판 가운데 cx·cy, 더블 링 반지름 s, 게이지 막대 가운데 gx·gy·반폭 gw, 캐릭터 자리 ch[[x, 발 y, 키]] (0 = 나(뒷모습 버튼), 1 = 쌍둥이), 던지는 손 hand
const LAY = { cx: 270, cy: 300, s: 170, gx: 270, gy: 640, gw: 200, ch: [[270, 900, 200], [470, 900, 120]], hand: [300, 700] };
const rim = () => LAY.s * D.R.rim;
function layout() {
  const sv = (k) => parseFloat(getComputedStyle(root).getPropertyValue('--safe-' + k)) || 0;
  const st = sv('t'), sb = sv('b');
  const head = $('head');
  // 세로 화면만: 맨 위 줄 가운데 총점·라운드, 그 밑 점수 칸 3개 → 다트판(늘 화면 가로 가득) → 게이지 → 작은 캐릭터 버튼
  // 높이가 모자라면 캐릭터 버튼만 작아짐. 남는 높이는 위쪽 틈에 나눠 줌
  const HEAD_H = 150, FIXED = HEAD_H + 22 + 27 + 24, avail = H - st - sb;
  LAY.s = (W / 2 - 2) / D.R.rim;
  const h = clamp((avail - FIXED - 2 * rim()) / 1.05, 80, 160);
  const extra = Math.max(0, avail - (FIXED + 2 * rim() + 1.05 * h));
  const headTop = st + 4 + extra * 0.25;
  LAY.cx = W / 2; LAY.cy = headTop + HEAD_H + extra * 0.45 + rim();
  LAY.gy = LAY.cy + rim() + 22; LAY.gx = W / 2; LAY.gw = 220;
  const feet = LAY.gy + 27 + 1.06 * h;
  LAY.ch = [[W / 2, feet, h], [W - 58, feet + 8, Math.min(120, h * 0.75)]];
  Object.assign(head.style, { left: '70px', top: headTop + 'px', width: (W - 140) + 'px' });
  LAY.hand = [W / 2 + h * 0.3, feet - h * 0.95];
}
// 판 좌표 ↔ 화면 좌표
const toX = (u) => LAY.cx + u * LAY.s, toY = (v) => LAY.cy + v * LAY.s;
// 위치: 같은 빠르기로 왔다 갔다 (가장자리에서 느려지지 않음)
function sweep(t, T) { const u = (t / T) % 1, v = u < 0.5 ? u * 2 : 2 - u * 2; return -AMP + 2 * AMP * v; }

// ---------- 위 점수: 총점(크게) · 라운드(작게) · 이번 라운드 다트 3개 점수 칸 ----------
function renderHead() {
  $('hudScore').textContent = fmt(G.score); $('hudRound').textContent = G.round;
  const R = G.rounds[G.round - 1] || [];
  for (let i = 0; i < PER; i++) {
    const el = $('bx' + i), r = R[i];
    el.style.setProperty('--c', DART_COLS[i]);
    el.classList.toggle('now', !r && i === G.dart && G.state === 'play');
    el.classList.toggle('out', !!r && r.ring === 'miss');
    el.querySelector('b').textContent = r ? r.pts : '';
    el.querySelector('small').textContent = r ? (r.ring === 'single' ? `${r.num}` : r.ring === 'miss' ? '아웃' : r.ring === 'outer' ? '바깥 불' : r.ring === 'bull' ? '불!' : r.label) : `${i + 1}번째`;
  }
}
// 결과 창: 8라운드 다트 한 발씩 점수 (게임이 다 끝난 뒤에만 보여 줌)
function buildSheet(el) {
  el.innerHTML = '';
  const cell = (cls, txt) => { const d = document.createElement('div'); d.className = cls; d.textContent = txt; el.appendChild(d); return d; };
  el.style.gridTemplateColumns = '1fr 1fr 1fr 1fr 1.3fr';
  ['', '1', '2', '3', '합계'].forEach((t) => cell('h', t));
  G.rounds.forEach((R, r) => {
    cell('h', `${r + 1}R`);
    for (let d = 0; d < PER; d++) {
      const x = R[d];
      cell('c ' + (!x ? '' : x.ring === 'bull' || x.ring === 'outer' ? 'bull' : x.ring === 'triple' || x.ring === 'double' ? 'tri' : x.ring === 'miss' ? 'out' : ''), x ? (x.ring === 'miss' ? '0' : x.ring === 'single' ? x.pts : x.label) : '');
    }
    cell('sum', R.reduce((a, x) => a + x.pts, 0));
  });
  cell('tot', `합계 ${fmt(G.score)}점`);
}

// ---------- run ----------
function startRun() {
  clearTimers();
  Object.assign(G, { round: 1, dart: 0, darts: [], rounds: [[]], score: 0, coins: 0, bulls: 0, td: 0, fx: [], hi: null, shake: 0, newBest: false, pose: ['idle', 'idle'], poseT: [0, 0], say: ['', ''], sayT: [0, 0] });
  $('hudBest').textContent = fmt(Save.data.best || 0);
  setState('play');
  newDart();
  say(1, pick(['가운데를 노려 봐!', '할 수 있어!', '힘내!']), 1.6);
}
function newDart() { G.phase = 'x'; G.pt = 0; setPose(0, 'idle', 0); renderHead(); }
// 꾹 누르기: 가로 위치를 정하고 과녁 표시가 위·아래로 움직이기 시작 → 손 떼기: 그 높이로 던지기
function press() {
  if (G.state !== 'play' || G.phase !== 'x' || G.pt < 0.12) return;
  Audio.unlock();
  G.ax = sweep(G.pt, period(G.round)); G.phase = 'y'; G.pt = 0; Audio.sfx('stopX'); setPose(0, 'aim', 99);
}
function release() {
  if (G.state !== 'play' || G.phase !== 'y') return;
  G.ay = sweep(G.pt, periodY()); throwDart(G.ax, G.ay);
}
const tap = press; // 시험용 (예전 이름)
function throwDart(x, y) {
  G.ax = x; G.ay = y; G.phase = 'fly'; G.pt = 0; G.sx0 = LAY.hand[0]; G.sy0 = LAY.hand[1];
  setPose(0, 'throw', 0.45); Audio.sfx('whoosh'); buzz(15);
  G.fx.push({ kind: 'ring', x: G.sx0, y: G.sy0, r0: 10, r1: 70, c: DART_COLS[Math.min(G.dart, PER - 1)], t: 0, life: 0.3 }); // 손에서 슝!
}
const FLY = 0.38;
function land() {
  const r = D.score(G.ax, G.ay), col = DART_COLS[Math.min(G.dart, PER - 1)];
  G.phase = 'land'; G.pt = 0;
  G.darts.push({ x: G.ax, y: G.ay, t: G.t, r, col });
  G.rounds[G.round - 1].push(r);
  G.score += r.pts; G.dart++;
  if (r.ring === 'bull') G.bulls++;
  if (r.ring === 'triple' || r.ring === 'double') G.td++;
  // 코인: 판에 맞으면 +2, 트리플·더블 +3 더, 바깥 불 +5, 불 +8
  if (!GOD()) G.coins += r.ring === 'miss' ? 0 : 2 + (r.mult >= 2 ? 3 : 0) + (r.ring === 'outer' ? 5 : 0) + (r.ring === 'bull' ? 8 : 0);
  G.hi = r.ring === 'miss' ? null : r; G.hiT = 0.9;
  const px = toX(G.ax), py = toY(G.ay);
  // 꽂히는 순간: 판이 살짝 흔들리고 동그라미가 퍼짐
  G.shake = r.ring === 'miss' ? 0 : 0.16; buzz(r.ring === 'miss' ? 0 : 30);
  G.fx.push({ kind: 'ring', x: px, y: py, r0: 6, r1: r.ring === 'bull' ? 90 : 55, c: col, t: 0, life: 0.35 });
  if (r.ring === 'miss') {
    Audio.sfx('miss'); setPose(0, 'hit', 0.9); setPose(1, 'idle', 0);
    say(1, pick(['아깝다!', '괜찮아!', '다음엔 들어갈 거야!']), 1.2);
  } else {
    Audio.sfx('thunk');
    const big = r.ring === 'bull' || r.pts >= 40, mid = r.ring === 'outer' || r.mult >= 2 || r.pts >= 20;
    later(() => Audio.sfx(r.ring === 'bull' ? 'bull' : big ? 'great' : mid ? 'good' : 'ui'), 80);
    setPose(0, big || mid ? 'cheer' : 'idle', 1); setPose(1, big ? 'cheer' : mid ? 'happy' : 'idle', 1);
    if (r.ring === 'bull') say(1, pick(['불이다! 최고야!', '한가운데! 대단해!']), 1.4);
    else if (r.ring === 'triple') say(1, pick(['트리플! 세 배야!', '와! 세 배!']), 1.3);
    else if (r.ring === 'double') say(1, pick(['더블! 두 배!', '두 배 점수야!']), 1.3);
    else if (r.ring === 'outer') say(1, '바깥 불! 25점!', 1.3);
    else if (r.pts >= 15) say(1, pick(['좋아!', '잘했어!']), 1);
    burst(px, py, big ? 12 : mid ? 8 : 4, r.ring === 'bull' ? '#FF5A7A' : '#FFD34D');
  }
  const name = r.ring === 'bull' ? 'BULL! 50' : r.ring === 'outer' ? '바깥 불 25' : r.ring === 'triple' ? `트리플 ${r.num} = ${r.pts}` : r.ring === 'double' ? `더블 ${r.num} = ${r.pts}` : r.ring === 'miss' ? '아웃! 0점' : `${r.pts}점`;
  G.fx.push({ kind: 'text', text: name, x: clamp(px, LAY.cx - rim() + 90, LAY.cx + rim() - 90), y: py - 40, t: 0, life: 1.1, big: r.ring === 'bull' || r.mult >= 2, bad: r.ring === 'miss' });
  renderHead();
  if (G.dart >= PER) later(endRound, 900);
  else later(newDart, 750);
}
function endRound() {
  const sum = G.rounds[G.round - 1].reduce((a, x) => a + x.pts, 0);
  G.phase = 'round'; G.pt = 0;
  Audio.sfx('round');
  if (sum >= 100 && !GOD()) G.coins += 5; // 한 라운드 100점 넘으면 +5
  G.fx.push({ kind: 'banner', text: `${G.round}라운드 ${sum}점!`, sub: sum >= 100 ? '100점 넘었어요! 코인 +5' : sum >= 60 ? '아주 잘했어요!' : sum >= 30 ? '좋아요!' : '다음 라운드 힘내요!', t: 0, life: 1.5 });
  if (sum >= 60) { setPose(0, 'cheer', 1.4); setPose(1, 'cheer', 1.4); }
  later(() => {
    G.darts = [];
    if (G.round >= ROUNDS) { finish(); return; }
    G.round++; G.dart = 0; G.rounds.push([]);
    if (G.round === ROUNDS) G.fx.push({ kind: 'banner', text: '마지막 라운드!', sub: '끝까지 힘내요!', t: 0, life: 1.1 });
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
  buildSheet($('resSheet'));
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
    if (G.poseT[k] > 0) { G.poseT[k] -= dt; if (G.poseT[k] <= 0) G.pose[k] = 'idle'; }
    if (G.sayT[k] > 0) G.sayT[k] -= dt;
  }
  if (G.hiT > 0) G.hiT -= dt;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt);
  runTimers();
  if (G.state !== 'play') return;
  G.pt += dt;
  if (G.phase === 'fly' && G.pt >= FLY) land();
}

// ---------- render ----------
function render() {
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  D.bg(ctx, W, H, G.t);
  const s = LAY.s, play = G.state === 'play' || G.state === 'pause';
  const sh = G.shake > 0 ? Math.sin(G.t * 90) * G.shake * 30 : 0; // 꽂힐 때 판 흔들림
  ctx.save(); ctx.translate(sh, 0);
  D.board(ctx, LAY.cx, LAY.cy, s, { hi: G.hiT > 0 ? G.hi : null, hiA: clamp(G.hiT / 0.9, 0, 1) * (0.4 + 0.3 * Math.abs(Math.sin(G.t * 12))) });
  for (const d of G.darts) { const k = Math.min(1, (G.t - d.t) / 0.12); D.dart(ctx, toX(d.x), toY(d.y), (s / 170) * (1.35 - 0.35 * k), d.col); }
  ctx.restore();
  if (play) drawAim();
  drawThrower();
  drawTwin();
  if (G.phase === 'fly' && play) drawFlying();
  drawFx();
}
// 조준
//  · 가로: 다트판 아래 막대 안에서 점(이번 다트 색)이 왼쪽·오른쪽으로 (막대 색 = 다트판 가운데 줄 칸 색)
//  · 세로: 꾹 누르고 있는 동안, 고른 가로 위치에서 과녁 표시(조준경)가 다트판 위를 위·아래로 → 손을 떼면 그 가운데로 다트가 날아감
const GSTEP = 72;
const barX = (u) => LAY.gx + u / AMP * LAY.gw;
function drawAim() {
  const ph = G.phase;
  if (ph === 'round') return;
  const { gx, gy, gw } = LAY, xLive = ph === 'x', yLive = ph === 'y', col = DART_COLS[Math.min(G.dart, PER - 1)];
  const xv = xLive ? sweep(G.pt, period(G.round)) : G.ax;
  ctx.save();
  const bh = 22;
  ctx.fillStyle = '#2A2348'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(gx - gw - 6, gy - bh / 2 - 4, gw * 2 + 12, bh + 8, 9); else ctx.rect(gx - gw - 6, gy - bh / 2 - 4, gw * 2 + 12, bh + 8); ctx.fill();
  for (let i = 0; i < GSTEP; i++) {
    const u0 = -AMP + 2 * AMP * i / GSTEP;
    ctx.fillStyle = D.colorAt(u0 + AMP / GSTEP, 0); ctx.fillRect(barX(u0), gy - bh / 2, gw * 2 / GSTEP + 0.6, bh);
  }
  if (ph === 'x' || ph === 'y') {
    const r = xLive ? 15 * (1 + 0.12 * Math.sin(G.t * 12)) : 12, x = barX(xv);
    ctx.beginPath(); ctx.arc(x, gy, r, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = col; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, gy, r * 0.38, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
  }
  ctx.restore();
  if (yLive) reticle(toX(G.ax), toY(sweep(G.pt, periodY())), col);
}
// 과녁 표시 (총 쏠 때 조준경 모양): 동그라미 + 십자 + 가운데 점
function reticle(x, y, col) {
  const r = 26 * (1 + 0.06 * Math.sin(G.t * 14));
  ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round';
  for (const [w, c] of [[9, 'rgba(255,255,255,.95)'], [4, '#E2384D']]) {
    ctx.lineWidth = w; ctx.strokeStyle = c;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(dx * r * 0.62, dy * r * 0.62); ctx.lineTo(dx * r * 1.45, dy * r * 1.45); }
    ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.restore();
}
// 날아가는 다트: 캐릭터 버튼(손)에서 다트판까지 슝 — 크게 시작해서 작아지고, 뒤에 꼬리 잔상
function flyPos(k) {
  const e = 1 - (1 - k) * (1 - k), tx = toX(G.ax), ty = toY(G.ay);
  return [G.sx0 + (tx - G.sx0) * e, G.sy0 + (ty - G.sy0) * e - Math.sin(k * Math.PI) * 70, (LAY.s / 170) * (3 - 1.75 * e)];
}
function drawFlying() {
  const k = clamp(G.pt / FLY, 0, 1), col = DART_COLS[Math.min(G.dart, PER - 1)];
  const [x, y, sc] = flyPos(k), [px, py] = flyPos(Math.max(0, k - 0.05));
  const ang = Math.atan2(y - py, x - px) - Math.PI / 2;
  // 꼬리 (잔상 + 빛줄기)
  ctx.save(); ctx.lineCap = 'round';
  const [tx0, ty0] = flyPos(Math.max(0, k - 0.3));
  const gr = ctx.createLinearGradient(tx0, ty0, x, y); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, col);
  ctx.strokeStyle = gr; ctx.lineWidth = 14 * sc; ctx.globalAlpha = 0.55;
  ctx.beginPath(); for (let j = 0; j <= 8; j++) { const [qx, qy] = flyPos(Math.max(0, k - 0.3 + j * 0.3 / 8)); if (j) ctx.lineTo(qx, qy); else ctx.moveTo(qx, qy); } ctx.stroke();
  ctx.restore();
  for (let j = 3; j >= 1; j--) {
    const [gx, gy, gs] = flyPos(Math.max(0, k - j * 0.07));
    ctx.save(); ctx.globalAlpha = 0.18 * (4 - j); D.dart(ctx, gx, gy, gs, col, ang); ctx.restore();
  }
  D.dart(ctx, x, y, sc, col, ang);
}
// 내 캐릭터 뒷모습 = 던지기 버튼. 둥근 버튼 위에 서 있고, 누르는 동안 버튼이 쑥 들어감
const BACK = { idle: 'back_run_0', aim: 'back_right', throw: 'back_boost', cheer: 'back_happy', happy: 'back_happy', hit: 'back_hit' };
function drawThrower() {
  const CV = window.CharV2, [x, y, h] = LAY.ch[0], play = G.state === 'play' || G.state === 'pause';
  const down = G.phase === 'y' && play, ready = G.phase === 'x' && play, col = DART_COLS[Math.min(G.dart, PER - 1)];
  // 둥근 버튼
  const br = h * 0.58, by = y - h * 0.48 + (down ? 4 : 0);
  ctx.save();
  if (ready) { ctx.globalAlpha = 0.35 + 0.25 * Math.sin(G.t * 6); ctx.beginPath(); ctx.arc(x, by, br + 12, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1; }
  ctx.beginPath(); ctx.arc(x, by + (down ? 2 : 8), br, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fill();
  const gr = ctx.createRadialGradient(x, by - br * 0.4, br * 0.2, x, by, br);
  gr.addColorStop(0, down ? '#FFE3A0' : '#FFF6D8'); gr.addColorStop(1, down ? '#F2A33A' : '#FFC86B');
  ctx.beginPath(); ctx.arc(x, by, br, 0, Math.PI * 2); ctx.fillStyle = gr; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.restore();
  if (CV && CV.ready(myLook)) {
    const want = BACK[G.pose[0]] || BACK.idle, use = CV.has(myLook, want) ? want : CV.has(myLook, 'back_run_0') ? 'back_run_0' : 'idle';
    const bob = use === 'back_happy' ? -Math.abs(Math.sin(G.t * 10)) * 8 : down ? 3 : Math.sin(G.t * 3) * 1.5;
    ctx.save(); ctx.translate(x, y + bob); CV.draw(ctx, myLook, use, { h }); ctx.restore();
  }
  // 손에 든 다트 (이번 다트 색) + 남은 다트
  if (play && (G.phase === 'x' || G.phase === 'y')) {
    const [hx, hy] = LAY.hand; D.dart(ctx, hx, hy + (down ? 10 : 0), (LAY.s / 170) * 1.6, col, Math.PI + 0.25);
  }
  if (play) {
    const left = PER - G.dart - (G.phase === 'fly' ? 1 : 0);
    for (let i = PER - left + (G.phase === 'x' || G.phase === 'y' ? 1 : 0); i < PER; i++) D.dart(ctx, x - br - 6 - (PER - 1 - i) * 16, y - 6, 0.7, DART_COLS[i], 0.1);
  }
  // 버튼 글자
  if (play && (G.phase === 'x' || G.phase === 'y')) {
    const txt = down ? '손 떼면 발사!' : '꾹 누르기';
    ctx.save(); ctx.font = '22px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(txt).width + 30, py = y + 6;
    ctx.fillStyle = down ? '#2F9AE8' : '#FF5A8C'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - w / 2, py - 18, w, 36, 18); else ctx.rect(x - w / 2, py - 18, w, 36); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillText(txt, x, py + 1); ctx.restore();
  }
}
// 쌍둥이: 옆에서 응원하고 말풍선으로 반응
function drawTwin() {
  const CV = window.CharV2; if (!CV || !CV.ready(twinLook)) return;
  const [x, y, h] = LAY.ch[1];
  const want = G.pose[1], use = CV.has(twinLook, want) ? want : 'idle';
  const bob = use === 'cheer' ? -Math.abs(Math.sin(G.t * 10)) * 8 : use === 'happy' ? -Math.abs(Math.sin(G.t * 7)) * 4 : Math.sin(G.t * 3 + 1) * 2;
  ctx.save(); ctx.translate(x, y + bob); CV.draw(ctx, twinLook, use, { h, flip: true }); ctx.restore();
  if (G.sayT[1] > 0 && G.say[1]) bubble(x, y - h * 1.08, G.say[1], 1);
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
    if (f.kind === 'ring') { // 퍼지는 동그라미 (던질 때 손, 꽂힐 때 판)
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.lineWidth = 6 * (1 - k) + 2; ctx.strokeStyle = f.c;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r0 + (f.r1 - f.r0) * (1 - (1 - k) * (1 - k)), 0, Math.PI * 2); ctx.stroke(); ctx.restore(); continue;
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
  $('hudCoin').textContent = G.coins; renderHead();
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
  if (G.state === 'play') {
    $('verTxt').textContent = `버전 ${ASSET_V}`; G.pausedFrom = G.state;
    if (G.phase === 'y') { G.phase = 'x'; G.pt = 0; setPose(0, 'idle', 0); } // 누르던 중이면 그 다트는 처음부터 다시 조준
    setState('pause');
  }
}
function resumeGame() { if (G.state === 'pause') { setState(G.pausedFrom); last = performance.now(); } }
function goHome() { clearTimers(); if (HUB) location.href = '../index.html#lobby'; else showReady(); }

// ---------- input: 화면 아무 곳이나 톡 (버튼 포함) ----------
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
cv.addEventListener('pointerdown', (e) => { e.preventDefault(); press(); });
window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release);
window.addEventListener('keyup', (e) => { if (e.code === 'Space' || e.code === 'Enter') release(); });
window.addEventListener('keydown', (e) => {
  Audio.unlock();
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault(); if (e.repeat) return;
    if (G.state === 'ready') $('btnGo').click(); else press();
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
function wideLayout() { return false; } // 세로 화면만
function resize() {
  const vv = window.visualViewport;
  const vw = Math.round(vv ? vv.width : window.innerWidth), vh = Math.round(vv ? vv.height : window.innerHeight);
  const s = $('safe').getBoundingClientRect();
  const inset = { t: s.top, l: s.left, r: vw - s.right, b: vh - s.bottom };
  // 이 게임은 세로 화면만: 가로로 돌리면 세로 화면을 가운데에 그대로 보여 줌
  W = 540; H = vh > vw ? Math.round(clamp(W * vh / vw, 860, 1240)) : 960;
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
window.__darts = { G, step, render, tap, press, release, throwDart, startRun, showResult, LAY, score: D.score, sweep, period, toast };
