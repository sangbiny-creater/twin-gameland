'use strict';
// 은유와 은결의 멍멍이 간식 타임 — 은유·은결이 던져 주는 간식을 아래 강아지 3마리가 받아먹는 3줄 리듬 게임 (달콤 베이커리와 같은 판정·규칙)
//  · 강아지 3마리 = 버튼 3개: 아리(은유의 시츄) · 콩이(새 친구 푸들) · 포미(은결의 포메라니안). 간식이 판정선에 오면 그 강아지를 톡 → "냠!"
//  · 뼈다귀·금빛 뼈다귀: 톡 / 쌍둥이 간식(두 줄 같이): 두 강아지를 같이 톡
//  · 긴 소시지: 앞 끝이 오면 꾹 누르고(냠냠냠~ 먹으면서 짧아짐), 뒤 끝이 오면 떼기 (끝까지 누르고 있으면 '좋아요')
//  · 함정(양파·초콜릿): 강아지가 먹으면 안 됨 → 그 줄을 누르면 안 됨
//  · 은유·은결: 세로 화면은 위 양옆에서 간식을 던지고, 가로 화면은 줄 양옆에서 응원 (내 캐릭터 왼쪽, 쌍둥이 오른쪽)
//  · 하트: 3개로 시작, 최대 5개. Bad(놓침·함정·너무 빨리·너무 일찍 뗌) 나오면 -1
//  · 하트 아이템: 가끔(25초에 한 번꼴) 긴 빵 앞쪽에 올라감 → 시작·끝 모두 Perfect 면 하트 +1 (하트가 늘어나는 곳은 이것뿐)
//  · 끝없이 이어짐: 하트가 다 없어질 때까지, 30초마다 레벨 업. 전에 간 가장 높은 레벨부터 다시 시작할 수 있음
//  · 노래 없이 효과음만 (줄마다 다른 음)
// 폰 세로: 논리 폭 540 / 폰 가로·태블릿 가로·PC: 논리 높이 540 — 3줄은 늘 화면 가운데

let W = 540, H = 960;
const L = window.SnackLevels, D = window.DogArt;
const { PTS, JUDGE, LANES } = L;
const ASSET_V = '202610272023';
const MAX_HEARTS = 5;
const HEART_GAP = 25; // 하트 아이템 사이 최소 시간(초)
const LANE_COL = ['#FF8FB1', '#FFD34D', '#8FD0FF']; // 아리(분홍)·콩이(노랑)·포미(하늘)
const LANE_DARK = ['#C2456A', '#B5760F', '#2F6FA8'];
const DOG_NAME = ['아리', '콩이', '포미']; // 아리=은유의 시츄 · 콩이=새 친구 푸들 · 포미=은결의 포메라니안 (은유 왼쪽·은결 오른쪽 옆에)
const LANE_KEYS = [['KeyA', 'KeyJ', 'Digit1', 'ArrowLeft'], ['KeyS', 'KeyK', 'Digit2', 'ArrowDown'], ['KeyD', 'KeyL', 'Digit3', 'ArrowRight']];

// ---------- save (메인 화면 없이 단독 실행할 때) ----------
const Save = {
  data: { best: 0, maxLevel: 1, sound: true },
  load() { try { Object.assign(this.data, JSON.parse(localStorage.getItem('dogsnack_v1') || '{}')); } catch (e) { /* private mode */ } },
  store() { try { localStorage.setItem('dogsnack_v1', JSON.stringify(this.data)); } catch (e) { /* ignore */ } },
};
Save.load();
const HUB = window.Hub && window.Hub.active() ? window.Hub : null;
if (HUB) { Save.data.sound = HUB.settings.sound; Save.data.best = HUB.rec('dogsnack').best; Save.data.maxLevel = HUB.rec('dogsnack').maxLevel || 1; }
const GOD = () => !!(window.Hub && window.Hub.god); // 무적 쿠폰 (테스트용)

// ---------- utils ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const $ = (id) => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const fmt = (n) => Math.round(n).toLocaleString();

// ---------- 그림: 배경은 두더지 게임 초원(울타리·풍차)을 같이 씀, 강아지·간식은 art.js ----------
const BGS = { port: new Image(), land: new Image() };
BGS.port.src = `../mole/assets/bg/port.webp?v=${ASSET_V}`; BGS.land.src = `../mole/assets/bg/land.webp?v=${ASSET_V}`;
const HEART = new Image(); HEART.src = `../common/ui/heart.webp?v=${ASSET_V}`;
const HEART_EMPTY = new Image(); HEART_EMPTY.src = `../common/ui/heart_empty.webp?v=${ASSET_V}`;
const imgOk = (im) => im.complete && im.naturalWidth > 0;
const drawHeart = (im, x, y, w) => { if (imgOk(im)) ctx.drawImage(im, x - w / 2, y - w * im.naturalHeight / im.naturalWidth / 2, w, w * im.naturalHeight / im.naturalWidth); };
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
      this.applyMute();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  applyMute() { if (this.master) this.master.gain.value = Save.data.sound ? 1 : 0; },
  tone(f, d, type = 'sine', v = 0.4, slide = 0, when = 0) {
    if (!this.ctx || !Save.data.sound) return;
    const t = this.ctx.currentTime + Math.max(0, when), o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(this.gain); o.start(t); o.stop(t + d + 0.02);
  },
  // 강아지마다 목소리 높이가 다름 (아리·콩이·포미) — "냠!" "멍!"
  laneF: [520, 660, 780],
  bark(k, v = 0.22) { const f = this.laneF[k]; this.tone(f, 0.09, 'square', v * 0.6, -f * 0.45); this.tone(f * 1.5, 0.07, 'triangle', v * 0.5, -f * 0.6, 0.01); },
  chomp(k, v = 0.2) { this.tone(180 + k * 30, 0.06, 'square', v * 0.5, -60); this.tone(900 + k * 80, 0.03, 'triangle', v * 0.4, 0, 0.02); },
  sfx(n, k = 0) {
    switch (n) {
      case 'perfect': this.chomp(k); this.bark(k, 0.26); this.tone(this.laneF[k] * 2, 0.12, 'sine', 0.14, 0, 0.08); break;
      case 'good': this.chomp(k); this.bark(k, 0.18); break;
      case 'ok': this.chomp(k, 0.16); break;
      case 'press': this.chomp(k, 0.14); break;
      case 'hold': this.chomp(k, 0.08); break;
      case 'empty': this.tone(220, 0.06, 'triangle', 0.08, -40); break;
      case 'miss': this.tone(700, 0.25, 'sine', 0.12, -350); break; // 낑~
      case 'bad': this.tone(330, 0.16, 'square', 0.14, -150); this.tone(220, 0.22, 'square', 0.12, -80, 0.12); break;
      case 'combo': [1046, 1318, 1568].forEach((f, i) => this.tone(f, 0.1, 'triangle', 0.22, 0, i * 0.05)); break;
      case 'gold': [1318, 1568, 2093].forEach((f, i) => this.tone(f, 0.1, 'sine', 0.24, 0, i * 0.04)); break;
      case 'life': [660, 880, 1175].forEach((f, i) => this.tone(f, 0.12, 'sine', 0.3, 0, i * 0.06)); break;
      case 'level': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.24, 0, i * 0.07)); break;
      case 'shield': this.tone(1200, 0.2, 'sine', 0.25, -500); break;
      case 'count': this.tone(880, 0.08, 'sine', 0.25); break;
      case 'go': [660, 990].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.3, 0, i * 0.08)); break;
      case 'over': [523, 440, 349, 262].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.3, 0, i * 0.17)); break;
      case 'best': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.18, 'square', 0.14, 0, i * 0.1)); break;
      case 'ui': this.tone(700, 0.06, 'triangle', 0.25); break;
    }
  },
};
const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };

// ---------- state ----------
const cv = $('cv'), ctx = cv.getContext('2d'), root = $('root');
let scale = 1, dpr = 1;
// 상태: ready → choose(어디서부터) → count(3·2·1) → play → done → result / pause
// 빵: { type, lane, t, t1, w(판정 시간), gd(도우미), kind, st: wait|hold|done|miss|trap|passed, j, jt, hs·he, heart }
const G = {
  state: 'ready', gen: null, notes: [], fx: [], t: 0, clock: 0, countT: 0, frameAt: 0, k: 0, heartT: 0,
  hearts: 3, score: 0, coins: 0, combo: 0, maxCombo: 0, made: 0, perfect: 0, level: 1, startLv: 1,
  ptr: new Map(), laneDown: [0, 0, 0], laneGlow: [0, 0, 0], hold: [null, null, null], holdSnd: 0,
  mood: ['idle', 'idle', 'idle'], moodT: [0, 0, 0], chompT: [0, 0, 0], thr: [0, 0],
  slowT: 0, x2T: 0, shield: 0, pose: 'idle', poseT: 0, pausedFrom: 'play', newBest: false, prev: 'ready',
};
// LAY: 줄 폭 lw, 가운데 cx, 판정선 jy, 위 끝 top, 버튼 by·br, 그림 크기 s, 떨어지는 속도 배율 vs
const LAY = { lw: 160, cx: 270, jy: 760, top: 150, by: 860, br: 56, s: 1, vs: 1 };
function layout() {
  const sv = (k) => parseFloat(getComputedStyle(root).getPropertyValue('--safe-' + k)) || 0;
  if (wideLayout()) {
    LAY.s = 0.82; LAY.vs = 0.72; LAY.lw = 140; LAY.cx = W / 2; LAY.br = 40;
    LAY.by = H - 56 - sv('b'); LAY.jy = LAY.by - 62; LAY.top = 70 + sv('t');
  } else {
    LAY.s = 1; LAY.vs = 1; LAY.lw = Math.min(166, (W - 30) / 3); LAY.cx = W / 2; LAY.br = 56;
    LAY.by = H - 92 - sv('b'); LAY.jy = LAY.by - 86; LAY.top = 128 + sv('t');
  }
}
const laneX = (i) => LAY.cx + (i - 1) * LAY.lw;
const yAt = (t) => LAY.jy - (L.dist(t) - L.dist(G.clock)) * LAY.vs;
const timeScale = () => (G.slowT > 0 ? 0.7 : 1);
const nowClock = () => G.clock + (G.state === 'play' ? Math.min(0.05, (performance.now() - G.frameAt) / 1000) * timeScale() : 0);

// ---------- run ----------
// 시작하기: 전에 레벨 2 이상까지 갔으면 '처음부터 하기' / '레벨 N부터 시작하기' 고르는 창
function askStart() {
  const lv = Save.data.maxLevel || 1;
  if (lv < 2) { startRun(1); return; }
  $('btnFromLv').textContent = `레벨 ${lv}부터 시작하기`;
  setState('choose');
}
function startRun(lv = 1) {
  clearTimers();
  const c0 = (lv - 1) * L.LEVEL;
  G.gen = L.Gen(Date.now(), c0); G.notes = []; G.k = 0; G.heartT = c0 - 10;
  G.hearts = 3; G.score = 0; G.coins = 0; G.combo = 0; G.maxCombo = 0; G.made = 0; G.perfect = 0; G.level = lv; G.startLv = lv; G.newBest = false;
  G.fx = []; G.t = 0; G.clock = c0; G.slowT = 0; G.x2T = 0; G.shield = 0; G.hold = [null, null, null]; G.ptr.clear(); G.laneDown = [0, 0, 0];
  G.pose = 'idle'; G.poseT = 0;
  const boosts = HUB ? HUB.takeBoosts('dogsnack') : [];
  if (boosts.includes('life')) G.hearts = 4;
  if (boosts.includes('shield')) G.shield = 1;
  if (boosts.includes('slow')) G.slowT = 20;
  if (boosts.includes('x2')) G.x2T = 30;
  if (boosts.length) toast('부스트: ' + boosts.map((b) => HUB.boostName('dogsnack', b)).join(' · '));
  pull();
  renderBuffs(); renderHearts();
  $('hudBest').textContent = fmt(Save.data.best || 0);
  G.countT = 3;
  setState('count');
}
function pull() {
  G.gen.fill(G.clock + 6);
  while (G.gen.out.length) {
    const n = G.gen.out.shift(), p = L.params(n.t);
    Object.assign(n, { w: p.win, gd: p.guide, kind: G.k % 2, st: 'wait' }); G.k++;
    if (n.type === 'long' && n.t - G.heartT >= HEART_GAP) { n.heart = true; G.heartT = n.t; } // 가끔만 하트 아이템
    n.from = n.lane === 1 ? (G.k % 2) : n.lane === 0 ? 0 : 1; // 던지는 사람: 0 내 캐릭터(왼쪽) · 1 쌍둥이(오른쪽)
    G.notes.push(n);
  }
  G.notes = G.notes.filter((n) => n.st === 'wait' || n.st === 'hold' || G.clock - (n.jt != null ? n.jt : (n.t1 || n.t)) < 1);
}
function showReady() {
  clearTimers();
  G.notes = [];
  const items = [['cup', '뼈다귀', '톡!'], ['chord', '쌍둥이 간식', '두 줄 같이'], ['long', '긴 소시지', '꾹~ 떼기'], ['heartlong', '하트 소시지', '둘 다 Perfect']];
  $('legend').innerHTML = items.map(([id, nm, p]) => `<div class="lg"><img src="${icon(id)}" alt=""><span>${nm}</span><b>${p}</b></div>`).join('')
    + `<div class="lg no"><img src="${icon('burnt')}" alt=""><img src="${icon('plate')}" alt=""><span>양파·초콜릿</span><b>주면 안 돼요</b></div>`;
  if (!imgOk(HEART)) setTimeout(() => { if (G.state === 'ready') showReady(); }, 300); // 그림을 다 받으면 다시 그림
  $('readyInfo').innerHTML = `BEST <b>${fmt(Save.data.best || 0)}점</b>` + (Save.data.maxLevel > 1 ? ` · 가장 높은 레벨 <b>${Save.data.maxLevel}</b>` : '');
  setState('ready');
}
const ICONS = {};
function icon(id) {
  if (ICONS[id]) return ICONS[id];
  const c = document.createElement('canvas'); c.width = 148; c.height = 100; const g = c.getContext('2d');
  if (id === 'cup') D.bone(g, 74, 50, 1);
  else if (id === 'chord') { g.strokeStyle = '#FF6B95'; g.lineWidth = 8; g.beginPath(); g.moveTo(40, 52); g.lineTo(108, 52); g.stroke(); D.bone(g, 40, 50, 0.6); D.bone(g, 108, 50, 0.6); }
  else if (id === 'burnt') D.onion(g, 74, 52, 0.9);
  else if (id === 'plate') D.choco(g, 74, 50, 0.9);
  else if (id === 'long') { g.translate(74, 50); g.rotate(-Math.PI / 2); g.translate(-74, -50); D.sausage(g, 74, -10, 110, 0.9); }
  else if (id === 'heartlong') { g.save(); g.translate(74, 50); g.rotate(-Math.PI / 2); g.translate(-74, -50); D.sausage(g, 74, -10, 110, 0.9); g.restore(); if (imgOk(HEART)) g.drawImage(HEART, 54, 18, 40, 40 * HEART.naturalHeight / HEART.naturalWidth); }
  const url = c.toDataURL(); if (imgOk(HEART)) ICONS[id] = url; // 그림을 받기 전 코드 그림은 기억하지 않음
  return url;
}
let runId = 0;
const timers = [];
function later(fn, ms) { const id = runId; timers.push(setTimeout(() => { if (id === runId) fn(); }, ms)); }
function clearTimers() { runId++; timers.forEach(clearTimeout); timers.length = 0; }

const comboMul = (c) => (c >= 20 ? 2 : c >= 10 ? 1.5 : c >= 5 ? 1.2 : 1);
const isTrap = (n) => n.type === 'burnt' || n.type === 'plate';
const judgeOf = (n, dt) => { const w = n.w, a = Math.abs(dt); return a <= w.p ? 'perfect' : a <= w.g ? 'good' : a <= w.o ? 'ok' : null; };
const JTXT = { perfect: 'Perfect!', good: 'Good!', ok: 'OK' };
const jy = () => LAY.jy - 110 * LAY.s;

// ---------- 누르기 / 떼기 (줄마다 따로) ----------
function press(lane, tc) {
  if (G.state !== 'play') return;
  G.laneGlow[lane] = 1;
  let best = null, bd = 1e9;
  for (const n of G.notes) {
    if (n.st !== 'wait' || n.lane !== lane) continue;
    const d = Math.abs(tc - n.t);
    if (d <= n.w.o && d < bd) { bd = d; best = n; }
    if (n.t - tc > n.w.o) break;
  }
  if (best) { hitNote(best, tc); return; }
  // 조금 일찍 누름: 이 줄의 다음 빵(함정 아님)을 놓친 것으로 (같은 줄 빵 사이가 넉넉할 때만)
  const mine = G.notes.filter((n) => n.lane === lane);
  const idx = mine.findIndex((n) => n.st === 'wait' && n.t - tc > n.w.o), nx = mine[idx];
  if (nx && !isTrap(nx)) {
    const prev = mine[idx - 1], prevEnd = prev ? (prev.t1 || prev.t) : -9;
    const early = Math.min(0.15, Math.max(0, nx.t - prevEnd - 2 * nx.w.o - 0.05));
    if (nx.t - tc <= nx.w.o + early) { nx.early = true; missNote(nx, '너무 빨라요!'); return; }
  }
  Audio.sfx('empty');
}
function release(lane, tc) {
  const n = G.hold[lane]; if (!n || n.st !== 'hold') return;
  n.he = Math.min(tc, n.t1 + n.w.o);
  if (tc >= n.t1 - n.w.o) finishLong(n, judgeOf(n, tc - n.t1) || 'ok');
  else if ((tc - n.t) / (n.t1 - n.t) >= 0.6) finishLong(n, 'ok');
  else { G.hold[lane] = null; missNote(n, '너무 일찍 뗐어요'); }
}
function setMood(lane, m, t) { G.mood[lane] = m; G.moodT[lane] = t; }
function hitNote(n, tc) {
  G.chompT[n.lane] = 0.18;
  if (isTrap(n)) {
    n.st = 'trap'; n.jt = tc;
    setMood(n.lane, 'sad', 0.9);
    loseHeart(n.type === 'burnt' ? '앗! 양파는 안 돼요' : '앗! 초콜릿은 안 돼요', n.lane);
    return;
  }
  const j = judgeOf(n, tc - n.t) || 'ok';
  Audio.sfx('press', n.lane);
  if (n.type === 'long') {
    n.st = 'hold'; n.sj = j; n.hs = tc; n.he = tc; G.hold[n.lane] = n; G.holdSnd = 0;
    popText(JTXT[j], j, laneX(n.lane), jy());
    return;
  }
  n.st = 'done'; n.j = j; n.jt = tc;
  success(n, JUDGE[j], j, PTS[n.type]);
}
function finishLong(n, ej) {
  n.st = 'done'; n.j = ej; n.jt = G.clock; G.hold[n.lane] = null;
  const v = (JUDGE[n.sj] + JUDGE[ej]) / 2;
  success(n, v, v >= 0.95 ? 'perfect' : v >= 0.65 ? 'good' : 'ok', PTS.long);
  // 하트 아이템: 시작·끝 모두 Perfect 일 때만 먹음 → 왼쪽 위 하트 칸으로 날아감
  if (n.heart && G.hearts < MAX_HEARTS) {
    const hx = laneX(n.lane), hy = LAY.jy - 40 * LAY.s;
    if (n.sj === 'perfect' && ej === 'perfect') {
      n.heartGot = true; G.hearts++; renderHearts(true); Audio.sfx('life');
      G.fx.push({ kind: 'heartFly', x: hx, y: hy, t: 0, life: 0.6 });
      G.fx.push({ kind: 'text', text: '하트 +1', x: W / 2, y: LAY.top + 120, t: 0, life: 1, big: true, pink: true });
    } else {
      n.heartLost = true;
      G.fx.push({ kind: 'heartPop', x: hx, y: hy, t: 0, life: 0.5 });
    }
  }
}
function success(n, v, j, base) {
  G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo);
  G.made++;
  if (j === 'perfect') G.perfect++;
  const pts = Math.round(base * v * comboMul(G.combo));
  G.score += pts;
  // 코인: 빵 1개 = 1코인, 완벽 +1, 금빛 +3, 콤보 10번마다 +2 (코인 2배 부스트 중이면 모두 2배)
  if (!GOD()) G.coins += (1 + (j === 'perfect' ? 1 : 0) + (n.type === 'gold' ? 3 : 0) + (G.combo % 10 === 0 ? 2 : 0)) * (G.x2T > 0 ? 2 : 1);
  Audio.sfx(n.type === 'gold' ? 'gold' : j, n.lane);
  burst(laneX(n.lane), LAY.jy - 20 * LAY.s, j === 'perfect' ? 8 : 4, n.type === 'gold' ? '#FFD34D' : LANE_COL[n.lane]);
  popText(JTXT[j], j, laneX(n.lane), jy());
  G.fx.push({ kind: 'text', text: `+${pts}`, x: laneX(n.lane), y: jy() + 44 * LAY.s, t: 0, life: 0.7, small: true });
  if (G.combo >= 5 && G.combo % 5 === 0) {
    Audio.sfx('combo');
    G.fx.push({ kind: 'text', text: `${G.combo} 콤보! ×${comboMul(G.combo)}`, x: W / 2, y: LAY.top + 70, t: 0, life: 1.1, big: true });
  }
  setPose(j === 'perfect' || G.combo % 5 === 0 ? 'cheer' : 'happy', 0.5);
  setMood(n.lane, 'happy', 0.5);
}
function missNote(n, msg) {
  n.st = 'miss'; n.jt = G.clock;
  setMood(n.lane, 'sad', 0.9);
  loseHeart(msg, n.lane);
}
function loseHeart(msg, lane) {
  G.combo = 0;
  const x = laneX(lane);
  if (G.shield > 0) { // 1회 보호 부스트: 한 번은 봐줌
    G.shield--; renderBuffs(); Audio.sfx('shield');
    popText('봐줬어요!', 'ok', x, jy());
    return;
  }
  Audio.sfx(msg.startsWith('앗') ? 'bad' : 'miss'); buzz(40);
  popText('Bad', 'bad', x, jy(), msg);
  if (!GOD() && G.hearts > 0) G.fx.push({ kind: 'heartMinus', x: x + 10, y: jy() + 70 * LAY.s, t: 0, life: 0.9 });
  setPose('hit', 0.6);
  if (GOD()) return;
  G.hearts--; renderHearts();
  G.fx.push({ kind: 'heartLoss', t: 0, life: 0.6 });
  if (G.hearts <= 0) gameOver();
}
function setPose(p, t) { G.pose = p; G.poseT = t; }
// 판정 글자: 줄마다 하나씩 (두 줄 같이 누르면 둘 다 보임)
function popText(text, j, x, y, sub) {
  G.fx = G.fx.filter((f) => !(f.kind === 'judge' && Math.abs(f.x - x) < 5));
  G.fx.push({ kind: 'judge', text, j, x, y, sub, t: 0, life: sub ? 1 : 0.7 });
}
function burst(x, y, n, col) {
  for (let i = 0; i < n; i++) {
    const an = -Math.PI / 2 + rnd(-1.2, 1.2), sp = rnd(140, 260);
    G.fx.push({ kind: 'spark', x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, r: rnd(8, 13), c: i % 2 ? '#FFFFFF' : col, t: 0, life: rnd(0.4, 0.65) });
  }
}

// ---------- end ----------
function gameOver() {
  if (G.state !== 'play') return;
  setState('done');
  G.hold = [null, null, null]; G.ptr.clear(); G.laneDown = [0, 0, 0];
  Audio.sfx('over');
  setPose('dizzy', 9);
  G.fx.push({ kind: 'text', text: '하트가 다 떨어졌어요!', x: W / 2, y: H * 0.35, t: 0, life: 1.4, big: true, bad: true });
  later(showResult, 1400);
}
function showResult() {
  const score = G.score;
  G.newBest = score > (Save.data.best || 0) && score > 0;
  if (G.newBest) Save.data.best = score;
  if (G.level > (Save.data.maxLevel || 1)) Save.data.maxLevel = G.level;
  if (!HUB) Save.store();
  $('resEarn').classList.toggle('hidden', !HUB);
  if (HUB) {
    const h = HUB.record('dogsnack', { dist: score, coins: G.coins, level: G.level });
    $('resEarn').innerHTML = h.god ? '무적 모드라서 기록·코인이 없어요' : `+${h.earned} 코인 획득!` + (h.bonus ? ` <small>(점수 보너스 +${h.bonus})</small>` : '') + `<small>내 코인 ${h.coins}</small>`;
  }
  $('resScore').textContent = fmt(score);
  $('resMade').textContent = `${G.made}개`;
  $('resPerfect').textContent = `${G.perfect}번`;
  $('resLevel').textContent = `레벨 ${G.level}`;
  $('resCombo').textContent = G.maxCombo;
  $('resCoin').textContent = G.coins;
  $('resBestVal').textContent = `${fmt(Save.data.best || 0)}점`;
  $('resBest').classList.toggle('hidden', !G.newBest);
  if (G.newBest) Audio.sfx('best');
  setState('result');
}

// ---------- update ----------
function step(dt) {
  G.t += dt;
  for (const f of G.fx) { f.t += dt; if (f.vx != null) { f.x += f.vx * dt; f.y += f.vy * dt; if (f.kind === 'spark') f.vy += 600 * dt; } }
  G.fx = G.fx.filter((f) => f.t < f.life);
  for (let i = 0; i < LANES; i++) G.laneGlow[i] = Math.max(G.laneDown[i] ? 0.6 : 0, G.laneGlow[i] - dt * 4);
  if (G.poseT > 0) { G.poseT -= dt; if (G.poseT <= 0) G.pose = 'idle'; }
  for (let i = 0; i < LANES; i++) { G.chompT[i] = Math.max(0, G.chompT[i] - dt); if (G.moodT[i] > 0) { G.moodT[i] -= dt; if (G.moodT[i] <= 0) G.mood[i] = 'idle'; } }
  G.thr = G.thr.map((v) => Math.max(0, v - dt));
  if (G.state === 'pause') return;
  if (G.state === 'count') {
    const before = Math.ceil(G.countT);
    G.countT -= dt;
    const now = Math.ceil(G.countT);
    $('memo').classList.remove('hidden', 'go'); $('memoT').textContent = '준비!'; $('memoN').textContent = Math.max(1, now);
    if (now !== before && now > 0) Audio.sfx('count');
    if (G.countT <= 0) {
      Audio.sfx('go'); $('memo').classList.add('go'); $('memoT').textContent = '시작!'; $('memoN').textContent = '!';
      later(() => $('memo').classList.add('hidden'), 700);
      setState('play');
    }
    return;
  }
  if (G.state !== 'play' && G.state !== 'done') return;
  G.clock += dt * timeScale();
  if (G.state === 'done') return;
  G.frameAt = performance.now();
  if (G.slowT > 0) { G.slowT = Math.max(0, G.slowT - dt); if (!G.slowT) renderBuffs(); }
  if (G.x2T > 0) { G.x2T = Math.max(0, G.x2T - dt); if (!G.x2T) renderBuffs(); }
  const lv = 1 + Math.floor(G.clock / L.LEVEL);
  if (lv > G.level) {
    G.level = lv; Audio.sfx('level');
    G.fx.push({ kind: 'text', text: `레벨 ${lv}! 더 빨라져요`, x: W / 2, y: LAY.top + 120, t: 0, life: 1.6, big: true, gold: true });
  }
  pull();
  for (const n of G.notes) {
    if (n.t - G.clock > 0.3) break;
    if (n.st !== 'wait' || G.clock - n.t <= n.w.o) continue;
    if (isTrap(n)) { n.st = 'passed'; continue; } // 함정을 잘 참음
    missNote(n, '놓쳤어요');
    if (G.state !== 'play') return;
  }
  G.holdSnd -= dt;
  for (const h of G.hold) {
    if (!h || h.st !== 'hold') continue;
    h.he = G.clock;
    if (G.holdSnd <= 0) Audio.sfx('hold', h.lane);
    if (G.clock > h.t1 + h.w.o) { h.he = h.t1; finishLong(h, 'good'); } // 끝까지 누르고 있어도 OK
  }
  if (G.holdSnd <= 0) G.holdSnd = 0.09;
}

// ---------- render ----------
function drawBg() {
  const kind = wideLayout() ? 'land' : 'port', BG = BGS[kind];
  if (imgOk(BG)) {
    const iw = BG.naturalWidth, ih = BG.naturalHeight, sc = Math.max(W / iw, H / ih), dw = iw * sc, dh = ih * sc;
    ctx.drawImage(BG, (W - dw) / 2, (H - dh) / 2, dw, dh);
  } else { ctx.fillStyle = '#BCDA52'; ctx.fillRect(0, 0, W, H); }
  ctx.fillStyle = 'rgba(40,60,20,.12)'; ctx.fillRect(0, 0, W, H); // 줄이 잘 보이게 살짝 어둡게
}
function render() {
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  const s = LAY.s, lw = LAY.lw, x0 = LAY.cx - lw * 1.5;
  drawBg();
  if (wideLayout()) drawTwins();
  // 3줄
  for (let i = 0; i < LANES; i++) {
    const x = x0 + i * lw;
    ctx.save();
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x + 5, LAY.top - 20, lw - 10, LAY.by - LAY.top + 20, 22); else ctx.rect(x + 5, LAY.top - 20, lw - 10, LAY.by - LAY.top + 20);
    const gr = ctx.createLinearGradient(0, LAY.top, 0, LAY.by);
    gr.addColorStop(0, 'rgba(255,255,255,.3)'); gr.addColorStop(0.7, 'rgba(255,255,255,.58)'); gr.addColorStop(1, LANE_COL[i] + 'AA');
    ctx.fillStyle = gr; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.stroke(); // 줄이 또렷하게
    if (G.laneGlow[i] > 0) { ctx.globalAlpha = G.laneGlow[i] * 0.55; ctx.fillStyle = LANE_COL[i]; ctx.fill(); }
    ctx.restore();
  }
  if (!wideLayout()) drawTwins();
  // 판정선 + 줄마다 과녁 (강아지 머리 바로 위)
  const soon = (i) => G.state === 'play' && G.notes.some((n) => n.lane === i && n.st === 'wait' && !isTrap(n) && Math.abs(n.t - G.clock) <= n.w.o);
  ctx.save(); ctx.setLineDash([12, 10]); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,224,122,.95)';
  ctx.beginPath(); ctx.moveTo(x0 + 8, LAY.jy); ctx.lineTo(x0 + lw * 3 - 8, LAY.jy); ctx.stroke(); ctx.restore();
  for (let i = 0; i < LANES; i++) {
    ctx.save(); ctx.globalAlpha = soon(i) ? 0.95 : 0.55; ctx.lineWidth = 5 * s; ctx.strokeStyle = soon(i) ? '#FFE07A' : '#FFFFFF';
    ctx.beginPath(); ctx.ellipse(laneX(i), LAY.jy, 50 * s, 18 * s, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  drawDogs();
  // 간식: 위(나중 것)부터 그려서 아래(먼저 오는 것)가 위로 보이게
  ctx.save(); ctx.beginPath(); ctx.rect(0, LAY.top - 30, W, LAY.jy - LAY.top + 90 * s); ctx.clip();
  // 쌍둥이 간식: 같이 줘야 하는 두 간식을 분홍 막대로 이어 줌 (간식 뒤에)
  for (const n of G.notes) {
    if (!n.chord || n.st !== 'wait') continue;
    const mate = G.notes.find((m) => m !== n && m.chord && m.t === n.t && m.lane > n.lane); if (!mate) continue;
    const y = yAt(n.t);
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 16 * s; ctx.beginPath(); ctx.moveTo(laneX(n.lane), y); ctx.lineTo(laneX(mate.lane), y); ctx.stroke();
    ctx.strokeStyle = '#FF6B95'; ctx.lineWidth = 10 * s; ctx.stroke(); ctx.restore();
  }
  for (let i = G.notes.length - 1; i >= 0; i--) {
    const n = G.notes[i], x = laneX(n.lane);
    let y = yAt(n.t);
    if (!n.thrown && y > LAY.top - 30) { n.thrown = true; G.thr[n.from] = 0.35; } // 은유·은결이 던지는 몸짓
    const done = n.st === 'done' || n.st === 'trap';
    if (done) y = Math.min(y, LAY.jy) + clamp((G.clock - n.jt) / 0.2, 0, 1) * 40 * s; // 먹은 간식은 강아지 입으로 쏙
    const yb = n.type === 'long' ? yAt(n.t1) : y;
    if (y < LAY.top - 200 || yb > LAY.by + 160) continue;
    const fade = done ? 1 - clamp((G.clock - n.jt) / 0.22, 0, 1) : n.st === 'miss' ? 1 - clamp((G.clock - n.jt) / 0.6, 0, 1) : 1;
    if (fade <= 0) continue;
    ctx.save(); ctx.globalAlpha = fade;
    if (n.type === 'long') drawLong(n, x, yAt(n.t), yAt(n.t1));
    else {
      if (done) { ctx.translate(x, y); ctx.scale(0.5 + fade * 0.5, 0.5 + fade * 0.5); ctx.translate(-x, -y); }
      if (n.type === 'burnt') D.onion(ctx, x, y, s * 0.95);
      else if (n.type === 'plate') D.choco(ctx, x, y, s * 0.95);
      else D.bone(ctx, x, y, s, { gold: n.type === 'gold', t: G.t });
    }
    ctx.restore();
    if (n.st === 'miss' && !n.early && G.clock - n.jt < 0.6) drawX(x, Math.min(y, LAY.jy), 1 - (G.clock - n.jt) / 0.6);
    if (n.st === 'wait' && !isTrap(n)) drawGuide(n, x, y);
  }
  ctx.restore();
  drawFx();
  drawHint();
}
// 긴 소시지: 세로로 내려옴. 앞 끝(아래)이 판정선에 오면 꾹 → 강아지가 냠냠 먹어서 판정선 아래는 없어짐, 뒤 끝(위)이 오면 떼기
function drawLong(n, x, yF, yB) {
  const s = LAY.s;
  const eating = n.st === 'hold' || n.st === 'done';
  D.sausage(ctx, x, yB, yF, s, eating ? LAY.jy : null);
  if (n.heart && !n.heartGot && !n.heartLost && n.st !== 'miss' && G.hearts < MAX_HEARTS) drawHeart(HEART, x, Math.min(yF, eating ? LAY.jy : yF) - 22 * s + Math.sin(G.t * 6) * 2 * s, 38 * s);
  if (n.st === 'wait' && n.gd > 0) {
    ctx.save(); ctx.globalAlpha = n.gd; ctx.font = `${20 * s}px Jua, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineWidth = 5; ctx.strokeStyle = '#fff';
    ctx.strokeText('꾹', x + 26 * s, yF - 10 * s); ctx.fillStyle = '#E8456A'; ctx.fillText('꾹', x + 26 * s, yF - 10 * s);
    ctx.strokeText('떼기', x + 26 * s, yB + 10 * s); ctx.fillStyle = '#2F86E8'; ctx.fillText('떼기', x + 26 * s, yB + 10 * s);
    ctx.restore();
  }
}
// 타이밍 도우미: 간식 둘레의 동그라미가 줄어들다가 딱 맞는 순간 과녁 크기
function drawGuide(n, x, y) {
  const dtt = n.t - G.clock; if (n.gd <= 0 || dtt > 1.1 || dtt < -0.1) return;
  const s = LAY.s, r = 50 * s + Math.max(0, dtt) * 70 * s;
  ctx.save(); ctx.globalAlpha = n.gd * clamp(1 - dtt / 1.1, 0, 1) * 0.9;
  ctx.strokeStyle = dtt < 0.12 ? '#FFD34D' : '#FFFFFF'; ctx.lineWidth = 5 * s;
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.9, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}
function drawX(x, y, a) {
  const r = 20 * LAY.s;
  ctx.save(); ctx.globalAlpha = clamp(a * 1.5, 0, 1); ctx.translate(x, y); ctx.lineCap = 'round';
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 13; ctx.beginPath(); ctx.moveTo(-r, -r); ctx.lineTo(r, r); ctx.moveTo(r, -r); ctx.lineTo(-r, r); ctx.stroke();
  ctx.strokeStyle = '#E8384D'; ctx.lineWidth = 7; ctx.stroke(); ctx.restore();
}
// 아래 강아지 3마리 = 버튼 3개. 누르면 입을 벌리고, 긴 소시지를 먹는 동안 냠냠
function drawDogs() {
  const ds = LAY.br / 50;
  for (let i = 0; i < LANES; i++) {
    const x = laneX(i), y = LAY.by, dn = G.laneDown[i] > 0, h = G.hold[i];
    ctx.save();
    ctx.beginPath(); ctx.ellipse(x, y + LAY.br * 0.95, LAY.br * 1.25, LAY.br * 0.38, 0, 0, Math.PI * 2); // 방석
    ctx.fillStyle = LANE_COL[i]; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.restore();
    let open = G.chompT[i] > 0 ? 1 : dn ? 0.7 : 0;
    if (h && h.st === 'hold') open = 0.35 + 0.65 * Math.abs(Math.sin(G.t * 14)); // 냠냠냠
    const bob = G.mood[i] === 'happy' ? -Math.abs(Math.sin(G.t * 12)) * 6 : (dn ? 3 : 0);
    D.dog(ctx, x, y + bob, ds, i, open, G.mood[i], G.t + i);
  }
}
// 은유·은결: 세로 화면은 위 양옆에서 간식을 던지고, 가로 화면은 줄 양옆에 서서 응원
function drawTwins() {
  const CV = window.CharV2; if (!CV) return;
  const wide = wideLayout(), x0 = LAY.cx - LAY.lw * 1.5, x1 = LAY.cx + LAY.lw * 1.5;
  const spots = wide ? [[x0 - 100, LAY.by + 40, 190], [x1 + 100, LAY.by + 40, 190]] : [[62, LAY.top + 96, 116], [W - 62, LAY.top + 96, 116]];
  [myLook, twinLook].forEach((lk, k) => {
    if (!CV.ready(lk)) return;
    const [x, y, h] = spots[k]; if (wide && (x < 70 || x > W - 70)) return;
    const thr = G.thr[k] > 0, pose0 = k === 0 ? G.pose : (G.pose === 'hit' || G.pose === 'dizzy' ? G.pose : 'idle');
    const pose = thr ? 'cheer' : pose0, use = CV.has(lk, pose) ? pose : 'idle';
    const bob = use === 'cheer' ? -Math.abs(Math.sin(G.t * 10)) * 8 : Math.sin(G.t * 3 + k) * 2;
    ctx.save(); ctx.translate(x, y + bob); CV.draw(ctx, lk, use, { h, flip: k === 1 }); ctx.restore();
  });
}
function drawHint() {
  if (G.state !== 'play' && G.state !== 'count') return;
  let txt = '';
  if (G.startLv > 1) txt = G.clock < (G.startLv - 1) * L.LEVEL + 4 ? `레벨 ${G.startLv}부터 시작!` : '';
  else if (G.clock < 9) txt = '간식이 노란 줄에 오면 그 강아지를 톡!';
  else if (G.clock < 60 && G.notes.some((n) => n.type === 'long' && n.st === 'wait' && yAt(n.t) > LAY.top)) txt = '긴 소시지는 꾹~ 누르고 끝에서 떼요!';
  else if (G.clock < 60 && G.notes.some((n) => n.chord && n.st === 'wait' && yAt(n.t) > LAY.top)) txt = '쌍둥이 간식은 두 강아지를 같이 톡!';
  else if (G.clock < 80 && G.notes.some((n) => isTrap(n) && n.st === 'wait' && yAt(n.t) > LAY.top)) txt = '양파·초콜릿은 주면 안 돼요!';
  if (!txt) return;
  ctx.save(); ctx.font = '24px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const hy = LAY.top + (wideLayout() ? 24 : 170); // 세로 화면은 위 양옆 은유·은결 아래로
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(60,40,0,.9)'; ctx.strokeText(txt, LAY.cx, hy);
  ctx.fillStyle = '#FFF6D0'; ctx.fillText(txt, LAY.cx, hy);
  ctx.restore();
}
const JCOL = { perfect: ['#FFF27A', '#B5600F'], good: ['#9BF0A8', '#2E7A3A'], ok: ['#A8DCFF', '#2F5FA8'], bad: ['#FF8FA0', '#7A0E1E'] };
function drawFx() {
  for (const f of G.fx) {
    const k = f.t / f.life;
    if (f.kind === 'spark') { // 별 (하트 모양은 하트를 얻을 때만)
      ctx.save(); ctx.globalAlpha = 1 - k * k; ctx.translate(f.x, f.y); ctx.rotate(f.t * 6); ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? f.r * 0.45 : f.r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fillStyle = f.c; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(122,62,0,.5)'; ctx.stroke(); ctx.restore(); continue;
    }
    if (f.kind === 'heartFly') {
      const e = k * k, tx = 94 + (G.hearts - 1) * 30, ty = 38;
      ctx.save(); ctx.globalAlpha = 1 - Math.max(0, k - 0.85) / 0.15; drawHeart(HEART, f.x + (tx - f.x) * e, f.y + (ty - f.y) * e - Math.sin(k * Math.PI) * 60, 44 * LAY.s * (1 - 0.4 * k)); ctx.restore(); continue;
    }
    if (f.kind === 'heartPop') { ctx.save(); ctx.globalAlpha = 1 - k; drawHeart(HEART_EMPTY, f.x, f.y - k * 20, 44 * LAY.s * (1 + k * 0.4)); ctx.restore(); continue; }
    if (f.kind === 'heartMinus') {
      ctx.save(); ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4; drawHeart(HEART_EMPTY, f.x - 18, f.y - k * 26, 34);
      ctx.font = '26px Jua, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineWidth = 6; ctx.strokeStyle = '#7A0E1E'; ctx.strokeText('-1', f.x + 2, f.y - k * 26); ctx.fillStyle = '#FF6B7E'; ctx.fillText('-1', f.x + 2, f.y - k * 26);
      ctx.restore(); continue;
    }
    if (f.kind === 'heartLoss') { ctx.save(); ctx.globalAlpha = 0.35 * (1 - k); ctx.fillStyle = '#FF3A5A'; ctx.fillRect(0, 0, W, H); ctx.restore(); continue; }
    if (f.kind === 'judge') {
      const [fill, stroke] = JCOL[f.j] || JCOL.ok, sc = k < 0.15 ? 0.6 + k / 0.15 * 0.5 : 1.1 - Math.min(0.1, (k - 0.15));
      ctx.save(); ctx.globalAlpha = 1 - Math.max(0, k - 0.65) / 0.35; ctx.translate(f.x, f.y - k * 16); ctx.scale(sc * LAY.s, sc * LAY.s);
      ctx.font = `${f.j === 'bad' ? 34 : 36}px Jua, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 8; ctx.strokeStyle = stroke; ctx.strokeText(f.text, 0, 0); ctx.fillStyle = fill; ctx.fillText(f.text, 0, 0);
      if (f.sub) { ctx.font = '20px Jua, sans-serif'; ctx.lineWidth = 6; ctx.strokeText(f.sub, 0, 32); ctx.fillStyle = '#fff'; ctx.fillText(f.sub, 0, 32); } // Bad 이유
      ctx.restore(); continue;
    }
    if (f.kind === 'text') {
      ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
      ctx.font = `${f.big ? 42 : f.small ? 24 : 32}px Jua, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 7; ctx.strokeStyle = f.bad ? '#7A0E1E' : '#7A3E00'; ctx.strokeText(f.text, f.x, f.y - k * 30);
      ctx.fillStyle = f.bad ? '#FF6B7E' : f.pink ? '#FF8FB1' : f.gold ? '#FFF27A' : '#FFE07A'; ctx.fillText(f.text, f.x, f.y - k * 30);
      ctx.globalAlpha = 1;
    }
  }
}

// ---------- HUD ----------
let lastKey = '';
function updateHud() {
  const key = `${G.score}|${G.coins}|${G.combo}|${G.level}|${Math.ceil(G.slowT)}|${Math.ceil(G.x2T)}`;
  if (key === lastKey) return;
  lastKey = key;
  $('hudScore').textContent = fmt(G.score); $('hudCoin').textContent = G.coins;
  $('hudCombo').textContent = G.combo; $('hudLevel').textContent = G.level;
  $('comboPill').classList.toggle('hot', G.combo >= 5);
  $('hudBest').textContent = fmt(Math.max(Save.data.best || 0, G.score));
  const bs = $('buffSlow'); if (bs) bs.textContent = `🐢 천천히 ${Math.ceil(G.slowT)}초`;
  const bx = $('buffX2'); if (bx) bx.textContent = `🪙 코인 2배 ${Math.ceil(G.x2T)}초`;
}
function renderHearts(pop) {
  // 다른 게임(계단 오르기·헬리콥터·베이커리)과 같은 하트 그림: 가진 하트 = heart, 빈 칸 = heart_empty (늘 5칸)
  const el = $('hudHearts'); el.innerHTML = '';
  for (let i = 0; i < MAX_HEARTS; i++) {
    const d = document.createElement('div');
    d.className = 'heart' + (i >= G.hearts ? ' empty' : '') + (pop && i === G.hearts - 1 ? ' pop' : '');
    el.appendChild(d);
  }
}
function renderBuffs() {
  const el = $('buffs'); el.innerHTML = '';
  const add = (id, cls, txt) => { const d = document.createElement('div'); d.className = 'buff ' + cls; if (id) d.id = id; d.textContent = txt; el.appendChild(d); };
  if (G.shield > 0) add('', '', '🛡️ 1회 보호');
  if (G.slowT > 0) add('buffSlow', '', '');
  if (G.x2T > 0) add('buffX2', 'dbl', '');
  lastKey = '';
}
let toastT = 0;
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.add('hidden'), 1600); }

// ---------- screens ----------
function setState(s) {
  G.state = s;
  $('ready').classList.toggle('hidden', s !== 'ready');
  $('pause').classList.toggle('hidden', s !== 'pause');
  $('result').classList.toggle('hidden', s !== 'result');
  $('choose').classList.toggle('hidden', s !== 'choose');
  $('hud').classList.toggle('hidden', !['count', 'play', 'pause', 'done'].includes(s));
  if (s !== 'count' && s !== 'play' && s !== 'pause') $('memo').classList.add('hidden');
  lastKey = '';
}
function pauseGame() {
  if (G.state === 'play' || G.state === 'count') {
    $('verTxt').textContent = `버전 ${ASSET_V}`;
    // 긴 빵을 누르던 중이면 그 자리에서 뗀 것으로
    for (let i = 0; i < LANES; i++) if (G.hold[i]) release(i, G.clock);
    G.ptr.clear(); G.laneDown = [0, 0, 0];
    G.pausedFrom = G.state; setState('pause');
  }
}
function resumeGame() { if (G.state === 'pause') { setState(G.pausedFrom); last = performance.now(); } }
function goHome() { clearTimers(); if (HUB) location.href = '../index.html#lobby'; else showReady(); }

// ---------- input: 손가락마다 줄을 기억 (두 줄 같이 누르기 가능) ----------
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
function laneDown(id, lane) {
  Audio.unlock();
  if (G.ptr.has(id)) return;
  G.ptr.set(id, lane);
  if (G.laneDown[lane]++ === 0) press(lane, nowClock());
}
function laneUp(id) {
  if (!G.ptr.has(id)) return;
  const lane = G.ptr.get(id); G.ptr.delete(id);
  if (--G.laneDown[lane] <= 0) { G.laneDown[lane] = 0; release(lane, nowClock()); }
}
function laneOf(e) {
  const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W;
  return clamp(Math.floor((x - (LAY.cx - LAY.lw * 1.5)) / LAY.lw), 0, LANES - 1);
}
cv.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const r = cv.getBoundingClientRect(), y = (e.clientY - r.top) / r.height * H;
  if (y < LAY.top - 40) { Audio.unlock(); return; } // 맨 위(점수 줄)는 누르기 아님
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  laneDown('p' + e.pointerId, laneOf(e));
});
cv.addEventListener('pointerup', (e) => laneUp('p' + e.pointerId));
cv.addEventListener('pointercancel', (e) => laneUp('p' + e.pointerId));
const keyLane = (code) => LANE_KEYS.findIndex((ks) => ks.includes(code));
window.addEventListener('keydown', (e) => {
  Audio.unlock();
  if ((e.code === 'Space' || e.code === 'Enter') && G.state === 'choose') { e.preventDefault(); $('btnFromLv').click(); return; }
  if ((e.code === 'Space' || e.code === 'Enter') && G.state === 'ready') { e.preventDefault(); $('btnGo').click(); return; }
  const ln = keyLane(e.code);
  if (ln >= 0) { e.preventDefault(); if (!e.repeat) laneDown('k' + e.code, ln); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') { if (G.state === 'play' || G.state === 'count') pauseGame(); else if (G.state === 'pause') resumeGame(); }
});
window.addEventListener('keyup', (e) => { if (keyLane(e.code) >= 0) laneUp('k' + e.code); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('blur', () => pauseGame());
const click = (id, fn) => $(id).addEventListener('click', () => { Audio.unlock(); Audio.sfx('ui'); fn(); });
click('btnGo', () => { G.prev = 'ready'; askStart(); });
click('btnFromStart', () => startRun(1)); click('btnFromLv', () => startRun(Save.data.maxLevel || 1));
click('btnChooseBack', () => (G.prev === 'result' ? setState('result') : showReady()));
click('btnReadyHome', goHome); click('btnHomeP', goHome); click('btnHomeR', goHome);
click('btnPause', pauseGame); click('btnResume', resumeGame);
click('btnRetryP', () => { G.prev = 'ready'; askStart(); }); click('btnRetry', () => { G.prev = 'result'; askStart(); });
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
  root.classList.toggle('narrow', wideLayout() && W < 960);
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
  if (['count', 'play', 'done', 'pause'].includes(G.state)) updateHud();
  render();
  requestAnimationFrame(frame);
}
resize();
showReady();
if (new URLSearchParams(location.search).get('go') === '1') askStart(); // 인트로 START: 준비 창 없이 바로
requestAnimationFrame(frame);

// debug/test hook
window.__dogsnack = { G, step, render, updateHud, startRun, showReady, press, release, gameOver, showResult, LAY, laneX, yAt };
