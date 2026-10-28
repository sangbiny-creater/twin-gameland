'use strict';
// 은유와 은결의 달콤 베이커리 — 컨베이어로 지나가는 빵 위에 생크림을 짜는 원버튼 타이밍 게임
//  · 끝없이 이어짐 (다운힐 러너·헬리콥터처럼): 하트가 다 없어질 때까지, 점수가 기록(BEST)
//  · 하트: 2개로 시작, 최대 3개 (2026-10-27 난이도 올림). Bad(놓침·함정·너무 빨리·너무 일찍 뗌) 나오면 -1
//  · 하트 아이템: 가끔(앞 하트 아이템에서 50초 넘게 지난 뒤 나오는 긴 빵 하나) 빵 앞쪽 위에 올라감 → 시작·끝 모두 Perfect 면 하트 +1
//    하트가 늘어나는 곳은 이것 하나뿐 (컵케이크 Perfect·다른 판정으로는 절대 안 늘어남)
//  · 하트 그림은 모든 게임 공통 common/ui/heart.webp·heart_empty.webp (계단 오르기·헬리콥터와 같은 그림)
//  · 컵케이크·금빛 컵케이크: 짤주머니 밑에 올 때 화면을 톡
//  · 긴 빵(롤케이크·에클레어): 앞 끝이 오면 꾹 누르고, 뒤 끝이 오면 떼기 (끝까지 누르고 있으면 '좋아요')
//  · 함정(탄 빵·빈 접시): 누르면 안 됨 → 누르면 하트 -1. 빵을 놓쳐도 하트 -1
//  · 판정: 완벽 / 좋아요 / 아쉬워요 (판정 시간은 levels.js, 시간이 갈수록 조금씩 좁아짐)
//  · 판정선보다 조금 일찍 누르면 "너무 빨라요"(놓친 것과 같음) — 화면을 마구 두드리는 걸 막음
//  · 30초마다 레벨 업: 컨베이어가 빨라지고 새 빵이 나옴. 콤보 5번 ×1.2, 10번 ×1.5, 20번 ×2 점수
// 폰 세로: 논리 폭 540 / 폰 가로·태블릿 가로·PC: 논리 높이 540

let W = 540, H = 960;
const L = window.BakeryLevels, A = window.BakeryArt;
const { PTS, JUDGE } = L;
const ASSET_V = '202610282239';
const MAX_HEARTS = 3;
const START_HEARTS = 2;
const HEART_GAP = 50; // 하트 아이템 사이 최소 시간(초) — 2026-10-27 반으로 줄임(25→50초)

// ---------- save (메인 화면 없이 단독 실행할 때) ----------
const Save = {
  data: { best: 0, maxLevel: 1, sound: true },
  load() { try { Object.assign(this.data, JSON.parse(localStorage.getItem('bakery_v2') || '{}')); } catch (e) { /* private mode */ } },
  store() { try { localStorage.setItem('bakery_v2', JSON.stringify(this.data)); } catch (e) { /* ignore */ } },
};
Save.load();
const HUB = window.Hub && window.Hub.active() ? window.Hub : null;
if (HUB) { Save.data.sound = HUB.settings.sound; Save.data.best = HUB.rec('bakery').best; Save.data.maxLevel = HUB.rec('bakery').maxLevel || 1; }
const GOD = () => !!(window.Hub && window.Hub.god); // 무적 쿠폰 (테스트용)

// ---------- utils ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const $ = (id) => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const fmt = (n) => Math.round(n).toLocaleString();

// 배경 그림 (GPT G05 빵집). 가로 배경(G06)이 오면 land 를 따로 쓰기
A.load('assets/sprites/', ASSET_V);
const HEART = new Image(); HEART.src = `../common/ui/heart.webp?v=${ASSET_V}`;
const HEART_EMPTY = new Image(); HEART_EMPTY.src = `../common/ui/heart_empty.webp?v=${ASSET_V}`;
const imgOk = (im) => im.complete && im.naturalWidth > 0;
const drawHeart = (im, x, y, w) => { if (imgOk(im)) ctx.drawImage(im, x - w / 2, y - w * im.naturalHeight / im.naturalWidth / 2, w, w * im.naturalHeight / im.naturalWidth); };
const BGS = { port: new Image(), land: new Image() }; BGS.port.src = `assets/bg/port.webp?v=${ASSET_V}`; BGS.land.src = `assets/bg/land.webp?v=${ASSET_V}`;
const BG_FLOOR = { port: 0.63, land: 0.68 }; // 그림에서 진열대 아래 끝(바닥이 시작하는 높이) → 컨베이어 윗면에 맞춤
function drawBg() {
  const by = LAY.beltY, kind = wideLayout() ? 'land' : 'port', BG = BGS[kind], FL = BG_FLOOR[kind];
  if (!(BG.complete && BG.naturalWidth)) { A.backdrop(ctx, W, H, by + beltH() + 20, G.t); return; }
  const iw = BG.naturalWidth, ih = BG.naturalHeight;
  const sc = Math.max(W / iw, by / (FL * ih), (H - by) / ((1 - FL) * ih));
  const dw = iw * sc, dh = ih * sc;
  ctx.drawImage(BG, (W - dw) / 2, by - FL * dh, dw, dh);
  ctx.fillStyle = 'rgba(255,240,245,.18)'; ctx.fillRect(0, 0, W, H); // 빵이 잘 보이게 살짝 흐리게
}

// 내 캐릭터 (짤주머니 옆에서 응원)
const myLook = (() => {
  const c = HUB && HUB.active(), lk = (c && c.look) || 'eunyu3';
  if (window.CharV2 && window.CharV2.is(lk)) return lk;
  return lk.startsWith('eungyeol') ? 'eungyeol3' : 'eunyu3';
})();
if (window.CharV2) window.CharV2.load(myLook);

// ---------- audio ----------
const Audio = {
  ctx: null, master: null, gain: null, bgm: null,
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.gain = this.ctx.createGain(); this.gain.gain.value = 0.4; this.gain.connect(this.master);
      this.bgm = this.ctx.createGain(); this.bgm.gain.value = 0.1; this.bgm.connect(this.master);
      const b = this.ctx.createBuffer(1, 1, 22050), s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.master); s.start(0);
      this.applyMute();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  applyMute() { if (this.master) this.master.gain.value = Save.data.sound ? 1 : 0; },
  tone(f, d, type = 'sine', v = 0.4, slide = 0, when = 0, dest) {
    if (!this.ctx || !Save.data.sound) return;
    const t = this.ctx.currentTime + Math.max(0, when), o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(dest || this.gain); o.start(t); o.stop(t + d + 0.02);
  },
  sfx(n, k = 0) {
    switch (n) {
      case 'perfect': [1046, 1568].forEach((f, i) => this.tone(f * (1 + Math.min(k, 20) * 0.015), 0.12, 'triangle', 0.28, 0, i * 0.05)); this.tone(300, 0.1, 'sine', 0.2, 200); break;
      case 'good': this.tone(880 * (1 + Math.min(k, 20) * 0.015), 0.12, 'triangle', 0.26); this.tone(300, 0.1, 'sine', 0.18, 160); break;
      case 'ok': this.tone(660, 0.1, 'triangle', 0.2); break;
      case 'squish': this.tone(260, 0.12, 'sine', 0.22, 240); break;
      case 'hold': this.tone(520 + k * 40, 0.06, 'sine', 0.06); break;
      case 'empty': this.tone(220, 0.06, 'triangle', 0.08, -40); break;
      case 'miss': this.tone(200, 0.18, 'square', 0.12, -80); break;
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
  // 박자 반주: 게임 시계로 반 박자마다 (빵도 같은 박자로 나옴). 박자 빠르기는 그 시각의 난이도를 따름
  mel: [72, 0, 76, 0, 79, 0, 76, 0, 77, 0, 74, 0, 76, 72, 0, 0, 72, 0, 76, 0, 79, 0, 84, 0, 81, 79, 77, 74, 72, 0, 0, 0],
  bass: [48, 45, 41, 43],
  step: 0, at: 0,
  bgmTick(clock, timeScale) {
    if (!this.ctx || !Save.data.sound) return;
    const mf = (n) => 440 * Math.pow(2, (n - 69) / 12);
    while (this.at < clock + 0.12) {
      const sd = 30 / L.params(this.at).bpm, w = (this.at - clock) / timeScale;
      if (w > -0.02) {
        const m = this.mel[this.step % 32];
        if (m) this.tone(mf(m), sd * 0.9 / timeScale, 'triangle', 0.22, 0, w, this.bgm);
        if (this.step % 2 === 0) this.tone(mf(this.bass[Math.floor(this.step / 8) % 4]), sd * 1.6 / timeScale, 'sine', 0.5, 0, w, this.bgm);
        else this.tone(2400, 0.03, 'square', 0.04, 0, w, this.bgm);
      }
      this.at += sd; this.step++;
    }
  },
};
const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };

// ---------- state ----------
const cv = $('cv'), ctx = cv.getContext('2d'), root = $('root');
let scale = 1, dpr = 1;
// 상태: ready → count(3·2·1) → play → done(끝 연출) → result / pause
// 빵: { type, t, t1, w(판정 시간), gd(도우미 진하기), v(색), kind, st: wait|hold|done|miss|trap|passed, j, jt, hs·he(크림 짠 시각), early }
const G = {
  state: 'ready', gen: null, notes: [], shelf: [], fx: [], t: 0, clock: 0, countT: 0, frameAt: 0, k: 0,
  hearts: 3, score: 0, coins: 0, combo: 0, maxCombo: 0, made: 0, perfect: 0, level: 1,
  down: false, pointers: new Set(), sq: 0, holdNote: null, holdSnd: 0,
  slowT: 0, x2T: 0, shield: 0, pose: 'idle', poseT: 0, pausedFrom: 'play', newBest: false,
};
const LAY = { beltY: 540, nozX: 160, tipY: 380, s: 1 };

function layout() {
  if (wideLayout()) { LAY.s = 0.92; LAY.beltY = Math.round(H * 0.7); LAY.nozX = Math.round(Math.max(W * 0.3, 260)); }
  else { LAY.s = 1.05; LAY.beltY = Math.round(H * 0.56); LAY.nozX = Math.round(W * 0.34); }
  LAY.tipY = LAY.beltY - 128 * LAY.s;
}
const beltH = () => 40 * LAY.s;
const xAt = (t) => LAY.nozX + (L.dist(t) - L.dist(G.clock)) * LAY.s;
// 판정 글자: 짤주머니 오른쪽 (주머니에 가리지 않게)
const judgeX = () => LAY.nozX + 150 * LAY.s;
const timeScale = () => (G.slowT > 0 ? 0.7 : 1);
// 지금 이 순간의 게임 시계 (화면 그리기 사이에 누른 것도 정확하게)
const nowClock = () => G.clock + (G.state === 'play' ? Math.min(0.05, (performance.now() - G.frameAt) / 1000) * timeScale() : 0);
const guideNow = () => L.params(G.clock).guide;

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
  G.gen = L.Gen(Date.now(), c0); G.notes = []; G.shelf = []; G.k = 0; G.heartT = c0 - 10;
  G.hearts = START_HEARTS; G.score = 0; G.coins = 0; G.combo = 0; G.maxCombo = 0; G.made = 0; G.perfect = 0; G.level = lv; G.startLv = lv; G.newBest = false;
  G.fx = []; G.t = 0; G.clock = c0; G.slowT = 0; G.x2T = 0; G.shield = 0; G.holdNote = null; G.down = false; G.pointers.clear();
  G.pose = 'idle'; G.poseT = 0;
  Audio.step = 0; Audio.at = c0;
  // 아이템샵 부스트 (사용중으로 켜 둔 것만 1개씩)
  const boosts = HUB ? HUB.takeBoosts('bakery') : [];
  if (boosts.includes('life')) G.hearts = MAX_HEARTS; // 추가 하트 부스트: 3개(최대)로 시작
  if (boosts.includes('shield')) G.shield = 1;
  if (boosts.includes('slow')) G.slowT = 20;
  if (boosts.includes('x2')) G.x2T = 30;
  if (boosts.length) toast('부스트: ' + boosts.map((b) => HUB.boostName('bakery', b)).join(' · '));
  pull();
  renderBuffs(); renderHearts();
  $('hudBest').textContent = fmt(Save.data.best || 0);
  G.countT = 3;
  setState('count');
}
// 앞으로 8초 안에 도착할 빵을 받아 옴. 지나간 빵은 버림 (만든 케이크는 G.shelf 에 따로 모음)
function pull() {
  G.gen.fill(G.clock + 8);
  while (G.gen.out.length) {
    const n = G.gen.out.shift(), p = L.params(n.t);
    Object.assign(n, { w: p.win, gd: p.guide, v: G.k % 5, kind: G.k % 2, st: 'wait' }); G.k++;
    if (n.type === 'long' && n.t - G.heartT >= HEART_GAP) { n.heart = true; G.heartT = n.t; } // 가끔만 하트 아이템
    G.notes.push(n);
  }
  G.notes = G.notes.filter((n) => n.st === 'wait' || n.st === 'hold' || xAt(n.t1 || n.t) > -200);
}
// 준비 창: 나오는 빵 소개
function showReady() {
  clearTimers();
  G.notes = [];
  const items = [['cup', '컵케이크', '톡!'], ['long', '긴 빵', '꾹~ 떼기'], ['heartlong', '하트 긴 빵', '둘 다 Perfect면 하트 +1'], ['gold', '금빛', `+${PTS.gold}`]];
  $('legend').innerHTML = items.map(([id, nm, p]) => `<div class="lg"><img src="${icon(id)}" alt=""><span>${nm}</span><b>${p}</b></div>`).join('')
    + `<div class="lg no"><img src="${icon('burnt')}" alt=""><img src="${icon('plate')}" alt=""><span>탄 빵·빈 접시</span><b>누르면 안 돼요!</b></div>`;
  if (!A.ready() || !imgOk(HEART)) setTimeout(() => { if (G.state === 'ready') showReady(); }, 300); // 그림을 다 받으면 다시 그림
  $('readyInfo').innerHTML = `BEST <b>${fmt(Save.data.best || 0)}점</b>` + (Save.data.maxLevel > 1 ? ` · 가장 높은 레벨 <b>${Save.data.maxLevel}</b>` : '');
  setState('ready');
}
// 준비·결과 창 그림 (코드로 그린 빵을 그림으로)
const ICONS = {};
function icon(id) {
  if (ICONS[id]) return ICONS[id];
  const c = document.createElement('canvas'); c.width = 148; c.height = 100; const g = c.getContext('2d');
  if (id === 'cup') A.cupcake(g, 74, 92, 0.85, { v: 0, cream: 1 });
  else if (id === 'gold') A.cupcake(g, 74, 92, 0.85, { gold: true, cream: 1 });
  else if (id === 'burnt') A.cupcake(g, 74, 92, 0.85, { burnt: true, t: 0.3 });
  else if (id === 'plate') A.plate(g, 74, 80, 1.2);
  else if (id === 'long') A.longBread(g, 6, 142, 84, 0.8, 0, [6, 142], true);
  else if (id === 'heartlong') { A.longBread(g, 6, 142, 96, 0.8, 0, null, false); if (imgOk(HEART)) g.drawImage(HEART, 52, 6, 44, 44 * HEART.naturalHeight / HEART.naturalWidth); }
  const url = c.toDataURL(); if (A.ready() && imgOk(HEART)) ICONS[id] = url; // 그림을 받기 전 코드 그림은 기억하지 않음
  return url;
}
// 다시 하면 남아 있던 setTimeout 은 무시 (판 번호로 구분)
let runId = 0;
const timers = [];
function later(fn, ms) { const id = runId; timers.push(setTimeout(() => { if (id === runId) fn(); }, ms)); }
function clearTimers() { runId++; timers.forEach(clearTimeout); timers.length = 0; }

const comboMul = (c) => (c >= 20 ? 2 : c >= 10 ? 1.5 : c >= 5 ? 1.2 : 1);
const isTrap = (n) => n.type === 'burnt' || n.type === 'plate';
const judgeOf = (n, dt) => { const w = n.w, a = Math.abs(dt); return a <= w.p ? 'perfect' : a <= w.g ? 'good' : a <= w.o ? 'ok' : null; };
const JTXT = { perfect: 'Perfect!', good: 'Good!', ok: 'OK' };

// ---------- 누르기 / 떼기 ----------
function press(tc) {
  if (G.state !== 'play') return;
  // 판정 시간 안에서 가장 가까운 빵
  let best = null, bd = 1e9;
  for (const n of G.notes) {
    if (n.st !== 'wait') continue;
    const d = Math.abs(tc - n.t);
    if (d <= n.w.o && d < bd) { bd = d; best = n; }
    if (n.t - tc > n.w.o) break;
  }
  if (best) { hitNote(best, tc); return; }
  // 조금 일찍 누름: 다음 빵(함정 아님)을 놓친 것으로 (빵 사이가 넉넉할 때만)
  const idx = G.notes.findIndex((n) => n.st === 'wait' && n.t - tc > n.w.o);
  const nx = G.notes[idx];
  if (nx && !isTrap(nx)) {
    const prev = G.notes[idx - 1], prevEnd = prev ? (prev.t1 || prev.t) : -9;
    const early = Math.min(0.15, Math.max(0, nx.t - prevEnd - 2 * nx.w.o - 0.05));
    if (nx.t - tc <= nx.w.o + early) { nx.early = true; missNote(nx, '너무 빨라요!'); splat(LAY.nozX, LAY.beltY - 6); return; }
  }
  Audio.sfx('empty'); G.fx.push({ kind: 'drip', x: LAY.nozX, y: LAY.tipY, t: 0, life: 0.5 });
}
function release(tc) {
  const n = G.holdNote; if (!n || n.st !== 'hold') return;
  n.he = Math.min(tc, n.t1 + n.w.o);
  if (tc >= n.t1 - n.w.o) finishLong(n, judgeOf(n, tc - n.t1) || 'ok');
  else if ((tc - n.t) / (n.t1 - n.t) >= 0.6) finishLong(n, 'ok');
  else { G.holdNote = null; missNote(n, '너무 일찍 뗐어요'); }
}
function hitNote(n, tc) {
  if (isTrap(n)) {
    n.st = 'trap'; n.jt = tc;
    loseHeart(n.type === 'burnt' ? '앗! 탄 빵이에요' : '앗! 빈 접시예요');
    splat(xAt(n.t), LAY.beltY - 30 * LAY.s);
    return;
  }
  const j = judgeOf(n, tc - n.t) || 'ok';
  Audio.sfx('squish');
  if (n.type === 'long') {
    n.st = 'hold'; n.sj = j; n.hs = tc; n.he = tc; G.holdNote = n; G.holdSnd = 0;
    popText(JTXT[j], j, judgeX(), LAY.tipY - 120 * LAY.s);
    return;
  }
  n.st = 'done'; n.j = j; n.jt = tc;
  success(n, JUDGE[j], j, PTS[n.type]);
}
function finishLong(n, ej) {
  n.st = 'done'; n.j = ej; n.jt = G.clock; G.holdNote = null;
  const v = (JUDGE[n.sj] + JUDGE[ej]) / 2;
  success(n, v, v >= 0.95 ? 'perfect' : v >= 0.65 ? 'good' : 'ok', PTS.long);
  // 하트 아이템: 시작·끝 모두 Perfect 일 때만 먹음 → HUD 로 날아감
  if (n.heart && G.hearts < MAX_HEARTS) {
    const hx = xAt(n.t) + 34 * LAY.s, hy = LAY.beltY - 80 * LAY.s;
    if (n.sj === 'perfect' && ej === 'perfect') {
      n.heartGot = true; G.hearts++; renderHearts(true); Audio.sfx('life');
      G.fx.push({ kind: 'heartFly', x: hx, y: hy, t: 0, life: 0.6 });
      G.fx.push({ kind: 'text', text: '하트 +1', x: W / 2, y: LAY.tipY - 230 * LAY.s, t: 0, life: 1, big: true, pink: true });
    } else {
      n.heartLost = true;
      G.fx.push({ kind: 'heartPop', x: hx, y: hy, t: 0, life: 0.5 });
    }
  }
}
function success(n, v, j, base) {
  G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo);
  G.made++; G.shelf.push(n); if (G.shelf.length > 60) G.shelf.shift();
  if (j === 'perfect') G.perfect++;
  const pts = Math.round(base * v * comboMul(G.combo));
  G.score += pts;
  // 코인: 빵 1개 = 1코인, 완벽 +1, 금빛 +3, 콤보 10번마다 +2 (코인 2배 부스트 중이면 모두 2배)
  if (!GOD()) G.coins += (1 + (j === 'perfect' ? 1 : 0) + (n.type === 'gold' ? 3 : 0) + (G.combo % 10 === 0 ? 2 : 0)) * (G.x2T > 0 ? 2 : 1);
  Audio.sfx(n.type === 'gold' ? 'gold' : j, G.combo);
  const x = n.type === 'long' ? LAY.nozX : xAt(n.t);
  burst(x, LAY.beltY - 110 * LAY.s, j === 'perfect' ? 8 : 4, n.type === 'gold');
  popText(JTXT[j], j, judgeX(), LAY.tipY - 120 * LAY.s);
  G.fx.push({ kind: 'text', text: `+${pts}`, x: judgeX(), y: LAY.tipY - 70 * LAY.s, t: 0, life: 0.7, small: true });
  if (G.combo >= 5 && G.combo % 5 === 0) {
    Audio.sfx('combo');
    G.fx.push({ kind: 'text', text: `${G.combo} 콤보! ×${comboMul(G.combo)}`, x: W / 2, y: LAY.tipY - 230 * LAY.s, t: 0, life: 1.1, big: true });
  }
  setPose(j === 'perfect' || G.combo % 5 === 0 ? 'cheer' : 'happy', 0.5);
}
function missNote(n, msg) {
  n.st = 'miss'; n.jt = G.clock;
  loseHeart(msg);
}
function loseHeart(msg) {
  G.combo = 0;
  if (G.shield > 0) { // 1회 보호 부스트: 한 번은 봐줌
    G.shield--; renderBuffs(); Audio.sfx('shield');
    popText('봐줬어요!', 'ok', judgeX(), LAY.tipY - 120 * LAY.s);
    return;
  }
  Audio.sfx(msg.startsWith('앗') ? 'bad' : 'miss'); buzz(40);
  popText('Bad', 'bad', judgeX(), LAY.tipY - 120 * LAY.s, msg);
  if (!GOD() && G.hearts > 0) G.fx.push({ kind: 'heartMinus', x: judgeX() + 80 * LAY.s, y: LAY.tipY - 70 * LAY.s, t: 0, life: 0.9 });
  setPose('hit', 0.6);
  if (GOD()) return;
  G.hearts--; renderHearts();
  G.fx.push({ kind: 'heartLoss', t: 0, life: 0.6 });
  if (G.hearts <= 0) gameOver();
}
function setPose(p, t) { G.pose = p; G.poseT = t; }
function popText(text, j, x, y, sub) {
  G.fx = G.fx.filter((f) => f.kind !== 'judge');
  G.fx.push({ kind: 'judge', text, j, x, y, sub, t: 0, life: sub ? 1 : 0.75 });
}
function burst(x, y, n, gold) {
  for (let i = 0; i < n; i++) {
    const an = -Math.PI / 2 + rnd(-1.2, 1.2), sp = rnd(140, 260);
    G.fx.push({ kind: 'spark', x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, r: rnd(8, 14), c: gold ? '#FFD34D' : ['#FFD34D', '#FFB84D', '#8FD0FF', '#B9E8B0'][i % 4], t: 0, life: rnd(0.45, 0.7) });
  }
}
function splat(x, y) { G.fx.push({ kind: 'splat', x, y, t: 0, life: 0.9 }); }

// ---------- end ----------
function gameOver() {
  if (G.state !== 'play') return;
  setState('done');
  G.holdNote = null; G.down = false;
  Audio.sfx('over');
  setPose('dizzy', 9);
  G.fx.push({ kind: 'text', text: '하트가 다 떨어졌어요!', x: W / 2, y: H * 0.3, t: 0, life: 1.4, big: true, bad: true });
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
    const h = HUB.record('bakery', { dist: score, coins: G.coins, level: G.level });
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
  // 오늘 만든 케이크 진열장 (마지막 40개)
  $('resShelf').innerHTML = G.shelf.slice(-40).map((n) => `<img src="${icon(n.type === 'long' ? 'long' : n.type === 'gold' ? 'gold' : 'cup')}" alt="">`).join('');
  if (G.newBest) Audio.sfx('best');
  setState('result');
}

// ---------- update ----------
function step(dt) {
  G.t += dt;
  for (const f of G.fx) { f.t += dt; if (f.vx != null) { f.x += f.vx * dt; f.y += f.vy * dt; if (f.kind === 'spark') f.vy += 600 * dt; } }
  G.fx = G.fx.filter((f) => f.t < f.life);
  G.sq += ((G.down || G.holdNote ? 1 : 0) - G.sq) * Math.min(1, dt * 18);
  if (G.poseT > 0) { G.poseT -= dt; if (G.poseT <= 0) G.pose = 'idle'; }
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
  const ts = timeScale();
  G.clock += dt * ts;
  if (G.state === 'done') return;
  G.frameAt = performance.now();
  if (G.slowT > 0) { G.slowT = Math.max(0, G.slowT - dt); if (!G.slowT) renderBuffs(); }
  if (G.x2T > 0) { G.x2T = Math.max(0, G.x2T - dt); if (!G.x2T) renderBuffs(); }
  Audio.bgmTick(G.clock, ts);
  // 레벨 업 (30초마다)
  const lv = 1 + Math.floor(G.clock / L.LEVEL);
  if (lv > G.level) {
    G.level = lv; Audio.sfx('level');
    G.fx.push({ kind: 'text', text: `레벨 ${lv}! 더 빨라져요`, x: W / 2, y: LAY.tipY - 230 * LAY.s, t: 0, life: 1.6, big: true, gold: true });
  }
  pull();
  for (const n of G.notes) {
    if (n.t - G.clock > n.w.o) break;
    if (n.st !== 'wait' || G.clock - n.t <= n.w.o) continue;
    if (isTrap(n)) { n.st = 'passed'; continue; } // 함정을 잘 참음
    missNote(n, '놓쳤어요');
    if (G.state !== 'play') return;
  }
  const h = G.holdNote;
  if (h && h.st === 'hold') {
    h.he = G.clock;
    G.holdSnd -= dt; if (G.holdSnd <= 0) { G.holdSnd = 0.09; Audio.sfx('hold', (G.clock - h.t) / (h.t1 - h.t) * 6); }
    if (G.clock > h.t1 + h.w.o) { h.he = h.t1; finishLong(h, 'good'); } // 끝까지 누르고 있어도 OK
  }
}

// ---------- render ----------
function render() {
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  const s = LAY.s, by = LAY.beltY;
  drawBg();
  drawShelf();
  drawChar();
  // 판정 자리 표시 (짤주머니 밑)
  const soon = G.state === 'play' && G.notes.some((n) => n.st === 'wait' && !isTrap(n) && Math.abs(n.t - G.clock) <= n.w.o);
  ctx.save(); ctx.globalAlpha = soon ? 0.9 : 0.45;
  ctx.fillStyle = soon ? '#FFE07A' : '#FFFFFF';
  ctx.beginPath(); ctx.ellipse(LAY.nozX, by + 2, 52 * s, 10 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  A.belt(ctx, W, by, beltH(), L.dist(G.clock) * s, s);
  ctx.save(); ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(255,224,122,.9)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(LAY.nozX, by + 3); ctx.lineTo(LAY.nozX, by + beltH() - 3); ctx.stroke(); ctx.restore();
  // 빵 (뒤에서 앞으로: 오른쪽 것부터)
  let creamY = by - 40 * s;
  const sp = L.speedAt(G.clock) * s;
  for (let i = G.notes.length - 1; i >= 0; i--) {
    const n = G.notes[i], x = xAt(n.t);
    const x1 = n.type === 'long' ? xAt(n.t1) : x;
    if (x1 < -150 || x > W + 150) continue;
    if (n.type === 'long') {
      const cream = n.hs != null ? [x + (n.hs - n.t) * sp, x + (n.he - n.t) * sp] : null;
      const top = A.longBread(ctx, x - 8 * s, x1 + 8 * s, by, s, n.kind, cream, n.st === 'done');
      if (n.st === 'hold') creamY = top + 2 * s;
      if (n.st === 'wait') drawLongMarks(n, x, x1, top);
      // 하트 아이템 (하트가 최대(3개)보다 적을 때만 보임)
      if (n.heart && !n.heartGot && !n.heartLost && n.st !== 'miss' && G.hearts < MAX_HEARTS) {
        const hx = x + 34 * s; // 빵 앞쪽, 꾹 누르기 시작하는 곳 위에 올려 둠
        drawHeart(HEART, hx, top + 4 * s - 18 * s + Math.sin(G.t * 6 + i) * 2 * s, 40 * s);
      }
    } else if (n.type === 'plate') A.plate(ctx, x, by, s);
    else {
      const k = n.st === 'done' ? Math.min(1, (G.clock - n.jt) / 0.12) : 0;
      const top = A.cupcake(ctx, x, by, s, { v: n.v, burnt: n.type === 'burnt', gold: n.type === 'gold', cream: k, t: G.t });
      if (n.st === 'done' && G.clock - n.jt < 0.15) creamY = top;
      if (n.st === 'trap') A.swirl(ctx, x + 4 * s, by - 60 * s, s * 0.7, 0.5);
    }
    if (n.st === 'miss' && !n.early && G.clock - n.jt < 0.8) drawX(x1 > x ? (x + x1) / 2 : x, by - 60 * s, 1 - (G.clock - n.jt) / 0.8);
    if (n.st === 'wait' && !isTrap(n)) drawGuide(n, x);
  }
  // 짤주머니 + 크림 줄기
  const sq = G.sq;
  // 크림은 깍지 안쪽(짤주머니에 가려지는 곳)부터 그려서 깍지 끝에서 바로 나오는 것처럼
  if (sq > 0.3 && (G.down || G.holdNote)) A.stream(ctx, LAY.nozX, LAY.tipY + sq * 4 - 12 * s, Math.max(LAY.tipY, creamY), s, G.t); // 누르고 있는 동안만
  A.bag(ctx, LAY.nozX, LAY.tipY + sq * 4, s * 1.05, sq, '#FFC2D4');
  drawFx();
  drawHint();
}
// 긴 빵: 앞 끝 "꾹" · 뒤 끝 "떼기" 표시
function drawLongMarks(n, x, x1, top) {
  if (n.gd <= 0) return;
  ctx.save(); ctx.globalAlpha = n.gd; ctx.font = `${20 * LAY.s}px Jua, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.lineWidth = 5; ctx.strokeStyle = '#fff';
  ctx.strokeText('꾹', x, top - 6); ctx.fillStyle = '#E8456A'; ctx.fillText('꾹', x, top - 6);
  ctx.strokeText('떼기', x1, top - 6); ctx.fillStyle = '#2F86E8'; ctx.fillText('떼기', x1, top - 6);
  ctx.restore();
}
// 타이밍 도우미: 빵 위에서 줄어드는 동그라미 → 딱 맞는 순간 판정 자리 크기
function drawGuide(n, x) {
  const dtt = n.t - G.clock; if (n.gd <= 0 || dtt > 1.1 || dtt < -0.1) return;
  const s = LAY.s, r0 = 54 * s, r = r0 + Math.max(0, dtt) * 90 * s;
  ctx.save(); ctx.globalAlpha = n.gd * clamp(1 - dtt / 1.1, 0, 1) * 0.95;
  ctx.strokeStyle = dtt < 0.12 ? '#FFD34D' : '#FFFFFF'; ctx.lineWidth = 6 * s;
  ctx.beginPath(); ctx.ellipse(x, LAY.beltY - 40 * s, r, r * 0.9, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(232,69,106,.6)'; ctx.lineWidth = 2.5 * s; ctx.stroke();
  ctx.restore();
}
function drawX(x, y, a) {
  const r = 22 * LAY.s;
  ctx.save(); ctx.globalAlpha = clamp(a * 1.5, 0, 1); ctx.translate(x, y); ctx.lineCap = 'round';
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(-r, -r); ctx.lineTo(r, r); ctx.moveTo(r, -r); ctx.lineTo(-r, r); ctx.stroke();
  ctx.strokeStyle = '#E8384D'; ctx.lineWidth = 8; ctx.stroke(); ctx.restore();
}
// 내 캐릭터: 짤주머니 왼쪽, 컨베이어 뒤에 서서 응원
function drawChar() {
  const CV = window.CharV2; if (!CV || !CV.ready(myLook)) return;
  const s = LAY.s, h = 150 * s;
  const x = wideLayout() ? Math.max(LAY.nozX - 150 * s, 80) : LAY.nozX - 108 * s;
  const pose = CV.has(myLook, G.pose) ? G.pose : 'idle';
  const bob = G.pose === 'cheer' ? -Math.abs(Math.sin(G.t * 10)) * 10 : Math.sin(G.t * 3) * 2;
  ctx.save(); ctx.translate(x, LAY.beltY + 14 + bob);
  CV.draw(ctx, myLook, pose, { h });
  ctx.restore();
}
// 세로 화면: 컨베이어 아래 진열장에 만든 케이크가 쌓임 (꽉 차면 오래된 것부터 빠짐)
function drawShelf() {
  if (wideLayout()) return;
  const s = 0.5, y0 = LAY.beltY + beltH() + 60, x0 = 30, cols = 10, cw = (W - 60) / cols;
  const sv = parseFloat(getComputedStyle(root).getPropertyValue('--safe-b')) || 0;
  const maxY = H - 30 - sv;
  if (maxY - y0 < 70) return;
  const rows = Math.max(1, Math.min(5, Math.floor((maxY - y0) / 66)));
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.strokeStyle = '#C98B5A'; ctx.lineWidth = 3;
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(16, y0 - 14, W - 32, rows * 66 + 20, 18); else ctx.rect(16, y0 - 14, W - 32, rows * 66 + 20); ctx.fill(); ctx.stroke();
  for (let r = 0; r < rows; r++) { ctx.fillStyle = '#C98B5A'; ctx.fillRect(22, y0 + r * 66 + 50, W - 44, 6); }
  G.shelf.slice(-rows * cols).forEach((n, i) => {
    const r = Math.floor(i / cols), c = i % cols, x = x0 + cw * (c + 0.5), y = y0 + r * 66 + 50;
    if (n.type === 'long') A.longBread(ctx, x - cw * 0.45, x + cw * 0.45, y, s * 0.8, n.kind, [x - cw, x + cw], true);
    else A.cupcake(ctx, x, y, s, { v: n.v, gold: n.type === 'gold', cream: 1 });
  });
}
// 처음에만: 큰 안내 (컵케이크 → 처음 나온 긴 빵)
function drawHint() {
  if (G.state !== 'play' && G.state !== 'count') return;
  let txt = '';
  if (G.startLv > 1) txt = G.clock < (G.startLv - 1) * L.LEVEL + 4 ? `레벨 ${G.startLv}부터 시작!` : '';
  else if (G.clock < 10) txt = '컵케이크가 노란 자리에 오면 화면을 톡!';
  else if (G.clock < 60 && G.notes.some((n) => n.type === 'long' && n.st === 'wait' && xAt(n.t) < W)) txt = '긴 빵은 앞에서 꾹~ 누르고 끝에서 떼요!';
  else if (G.clock < 80 && G.notes.some((n) => isTrap(n) && n.st === 'wait' && xAt(n.t) < W)) txt = '탄 빵·빈 접시는 누르면 안 돼요!';
  if (!txt) return;
  const y = wideLayout() ? H - 40 : LAY.beltY + beltH() + 30;
  ctx.save(); ctx.font = '24px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(122,62,0,.9)'; ctx.strokeText(txt, W / 2, y);
  ctx.fillStyle = '#FFF6D0'; ctx.fillText(txt, W / 2, y);
  ctx.restore();
}
const JCOL = { perfect: ['#FFF27A', '#B5600F'], good: ['#9BF0A8', '#2E7A3A'], ok: ['#A8DCFF', '#2F5FA8'], bad: ['#FF8FA0', '#7A0E1E'] };
function drawFx() {
  for (const f of G.fx) {
    const k = f.t / f.life;
    if (f.kind === 'spark') { // 잘 짰을 때 튀는 별 (하트 모양은 쓰지 않음 — 하트를 얻은 것처럼 보이지 않게)
      ctx.save(); ctx.globalAlpha = 1 - k * k; ctx.translate(f.x, f.y); ctx.rotate(f.t * 6); ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? f.r * 0.45 : f.r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fillStyle = f.c; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke(); ctx.restore(); continue;
    }
    if (f.kind === 'drip') {
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.fillStyle = '#FFFDF7'; ctx.strokeStyle = '#6B3A1E'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(f.x, f.y + 8 + k * 40, 6 * LAY.s, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); continue;
    }
    if (f.kind === 'splat') {
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.translate(f.x, f.y); ctx.scale(0.6 + k * 0.6, 0.6 + k * 0.6); ctx.fillStyle = '#FFFDF7'; ctx.strokeStyle = '#6B3A1E'; ctx.lineWidth = 3;
      ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = i % 2 ? 14 : 26; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.6); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); continue;
    }
    if (f.kind === 'heartFly') { // 먹은 하트가 왼쪽 위 하트 칸으로 날아감
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
      ctx.save(); ctx.globalAlpha = 1 - Math.max(0, k - 0.65) / 0.35; ctx.translate(f.x, f.y - k * 16); ctx.scale(sc, sc);
      ctx.font = `${f.j === 'bad' ? 34 : 44}px Jua, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 8; ctx.strokeStyle = stroke; ctx.strokeText(f.text, 0, 0); ctx.fillStyle = fill; ctx.fillText(f.text, 0, 0);
      if (f.sub) { ctx.font = '24px Jua, sans-serif'; ctx.lineWidth = 6; ctx.strokeText(f.sub, 0, 38); ctx.fillStyle = '#fff'; ctx.fillText(f.sub, 0, 38); } // Bad 이유 (놓쳤어요·탄 빵 등)
      ctx.restore(); continue;
    }
    if (f.kind === 'text') {
      ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
      ctx.font = `${f.big ? 44 : f.small ? 26 : 32}px Jua, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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
  // 다른 게임(계단 오르기·헬리콥터)과 같은 하트 그림: 가진 하트 = heart, 빈 칸 = heart_empty (늘 5칸)
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
    if (G.holdNote) release(G.clock);
    G.down = false; G.pointers.clear();
    G.pausedFrom = G.state; setState('pause');
  }
}
function resumeGame() { if (G.state === 'pause') { setState(G.pausedFrom); last = performance.now(); } }
function goHome() { clearTimers(); if (HUB) location.href = '../index.html#lobby'; else showReady(); }

// ---------- input: 화면 아무 곳이나 누르기 / 떼기 (손가락 여러 개도 하나로) ----------
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
function down(id) {
  Audio.unlock();
  const was = G.pointers.size > 0;
  G.pointers.add(id);
  if (!was) { G.down = true; press(nowClock()); }
}
function up(id) {
  if (!G.pointers.delete(id)) return;
  if (G.pointers.size === 0) { G.down = false; release(nowClock()); }
}
cv.addEventListener('pointerdown', (e) => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } down('p' + e.pointerId); });
cv.addEventListener('pointerup', (e) => up('p' + e.pointerId));
cv.addEventListener('pointercancel', (e) => up('p' + e.pointerId));
window.addEventListener('keydown', (e) => {
  Audio.unlock();
  if ((e.code === 'Space' || e.code === 'Enter') && G.state === 'choose') { e.preventDefault(); $('btnFromLv').click(); return; }
  if ((e.code === 'Space' || e.code === 'Enter') && G.state === 'ready') { e.preventDefault(); $('btnGo').click(); return; }
  if (e.code === 'Space' || e.code === 'KeyJ' || e.code === 'KeyF') { e.preventDefault(); if (!e.repeat) down('k' + e.code); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') { if (G.state === 'play' || G.state === 'count') pauseGame(); else if (G.state === 'pause') resumeGame(); }
});
window.addEventListener('keyup', (e) => { if (e.code === 'Space' || e.code === 'KeyJ' || e.code === 'KeyF') up('k' + e.code); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('blur', () => pauseGame());
const click = (id, fn) => $(id).addEventListener('click', () => { Audio.unlock(); Audio.sfx('ui'); fn(); });
click('btnGo', askStart);
click('btnFromStart', () => startRun(1)); click('btnFromLv', () => startRun(Save.data.maxLevel || 1));
click('btnChooseBack', () => (G.prev === 'result' ? setState('result') : showReady()));
click('btnReadyHome', goHome); click('btnHomeP', goHome); click('btnHomeR', goHome);
click('btnPause', pauseGame); click('btnResume', resumeGame);
click('btnRetryP', () => { G.prev = 'ready'; askStart(); }); click('btnRetry', () => { G.prev = 'result'; askStart(); });
$('btnReadyHome').classList.toggle('hidden', !HUB);

// ---------- layout: 세로 화면은 세로 배치, 가로 화면은 가로 배치 (돌리지 않음) ----------
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
if (new URLSearchParams(location.search).get('go') === '1') askStart(); // 인트로 START: 준비 창 없이 바로 (전에 간 레벨이 있으면 고르는 창)
requestAnimationFrame(frame);

// debug/test hook
window.__bakery = { G, step, render, updateHud, startRun, showReady, press, release, gameOver, showResult, LAY };
