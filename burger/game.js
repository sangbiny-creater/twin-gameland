'use strict';
// 버거 러시 — 햄버거 가게 타이쿤 (가로 전용)
//  · 손님이 카운터에 와서 버거(+사이드)를 주문 → 재료 칸을 눌러 쟁반에 쌓고, 위 빵을 덮어 주문과 같으면 그 손님에게 저절로 나감
//  · 화면 (2026-11-10 사용자 시안): 위 = 큰 주문 말풍선(버거 속이 다 보이게 층마다 띄워 그림) + 그 아래 손님 얼굴 / 가운데 = 굽는 판 · 접시 2개 · 음료 기계(콜라·사이다·주스) · 아이스크림 기계
//          아래 2줄 = 버리기 · 패티 · 위 빵 · 아래 빵 · 치즈 · 베이컨 / 양상추 · 토마토 · 양파 · 감자튀김 (큰 버튼)
//  · 패티: 패티 칸(또는 빈 굽는 자리)을 누르면 굽는 판으로 → 진행 막대가 초록(다 익음)일 때 누르면 고른 접시로. 너무 오래 두면 탐(쉬운 판은 안 탐)
//  · 접시 2개: 처음엔 언제나 앞(왼쪽) 접시가 골라져 있음. 다른 접시는 그 접시를 눌러 골랐을 때만 그 접시에 쌓임. 버거를 내면 다시 앞 접시
//    아래 빵은 고른 접시와 상관없이 빈 접시마다 앞에서부터 하나씩 (2번 누르면 두 접시에 하나씩) / 다른 재료·위 빵·익은 패티·음료는 고른 접시에
//  · 주문 비교: 재료 종류와 개수만 같으면 됨 (쌓는 순서는 상관없음) + 사이드도 같아야 함
//  · 손님 기다림 막대(말풍선 안): 초록 → 노랑(50%) → 빨강(75%) → 0이면 화나서 떠남 = 하트 -1. 하트가 다 없어지면 실패
//  · 별: 잃은 하트 0개 ★3 / 1개 ★2 / 2개 이상 ★1. 코인: 손님마다 2 + 초록일 때 내면 팁 1
//  · 말풍선 버거를 꾹 누르고 있는 동안만 재료 목록 창 (손을 떼면 사라짐, 그동안 멈춤, 버튼 없음)
//  · 가로 고정: 세로로 든 폰은 게임을 90° 돌려서 보여 줌 (스카이 라이더와 같음)
//  · 징검다리: 쉬움 100판 + 어려움 100판. 판 표는 levels.js (검사: node tools/burger_levels.mjs)
// 논리 화면: 높이 540 (더 긴 폰은 폭이 넓어짐) / 4:3 태블릿은 폭 960 에 높이가 커짐. 가게 물건은 가운데 960 폭 안에

let W = 960, H = 540, OX = 0;
const WORLDS = ['햄버거 골목', '양상추 농장', '토마토 언덕', '양파 들판', '베이컨 캠핑장', '바닷가 버거 트럭', '감자튀김 성', '탄산 분수 공원', '별빛 드라이브', '아이스크림 왕국'];
const { PER_WORLD, HARD, STAGES } = window.BurgerLevels;
const isHard = (i) => i >= HARD;
const worldOf = (i) => Math.floor((i % HARD) / PER_WORLD);
const label = (i) => `${isHard(i) ? '어려움 ' : ''}${worldOf(i) + 1}-${(i % PER_WORLD) + 1}`;
const stageName = (i) => `${WORLDS[worldOf(i)]} ${(i % PER_WORLD) + 1}`;
const ASSET_V = '202611100159';
const START_HEARTS = 3;
const COIN_GUEST = 2, COIN_TIP = 1;
const NAME = { bun: '빵', bun_b: '아래 빵', bun_t: '위 빵', patty: '패티', patty_raw: '생패티', cheese: '치즈', lettuce: '양상추', tomato: '토마토', onion: '양파', bacon: '베이컨',
  cola: '콜라', cider: '사이다', juice: '주스', fries: '감자튀김', nuggets: '치킨너겟', icecream: '아이스크림' };
const GUEST_IDS = ['bear', 'rabbit', 'cat', 'puppy', 'panda', 'penguin', 'fox', 'raccoon'];

// ---------- save (메인 화면 없이 단독 실행할 때) ----------
const Save = {
  data: { cleared: {}, sound: true },
  load() { try { Object.assign(this.data, JSON.parse(localStorage.getItem('burger_v1') || '{}')); } catch (e) { /* private mode */ } },
  store() { try { localStorage.setItem('burger_v1', JSON.stringify(this.data)); } catch (e) { /* ignore */ } },
};
Save.load();
const HUB = window.Hub && window.Hub.active() ? window.Hub : null;
if (HUB) Save.data.sound = HUB.settings.sound;
const unlocked = (i) => {
  if (HUB) return HUB.stageUnlocked('burger', i);
  const C = Save.data.cleared;
  if (isHard(i)) { const h = i - HARD; return !!C[Math.floor(h / PER_WORLD) * PER_WORLD + PER_WORLD - 1] && (h === 0 || !!C[i - 1]); }
  return i === 0 || !!C[i - 1];
};
const nextStage = () => { if (HUB) return HUB.stageNext('burger'); for (let i = 0; i < HARD; i++) if (!Save.data.cleared[i]) return i; return HARD - 1; };
const GOD = () => !!(window.Hub && window.Hub.god);

// ---------- utils ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const $ = (id) => document.getElementById(id);
const tr = (s) => (window.I18N && I18N.tr ? I18N.tr(s) : s);
const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };

// ---------- images ----------
const IMG = {};
const img = (key, path) => { const im = new Image(); im.src = `assets/${path}.webp?v=${ASSET_V}`; IMG[key] = im; return im; };
['bun_b', 'bun_t', 'lettuce', 'tomato', 'onion', 'cheese', 'bacon', 'paper', 'patty_raw', 'patty_cook', 'patty', 'patty_burnt', 'cola', 'cider', 'fries', 'nuggets', 'icecream', 'cup', 'fry_box', 'bag'].forEach((k) => img(k, 'food/' + k));
['grill', 'machine_drink', 'machine_fry', 'machine_ice', 'trash', 'bin', 'tray', 'cover', 'plate', 'bubble', 'tip', 'recipe'].forEach((k) => img(k, 'ui/' + k));
['steam', 'smoke', 'spark', 'heart', 'sweat', 'check'].forEach((k) => img('fx_' + k, 'fx/' + k));
for (const g of GUEST_IDS) for (const p of ['wait', 'angry', 'happy']) img(`g_${g}_${p}`, `guests/${g}_${p}`);
const BG = { day: img('bg_day', 'bg/land'), night: img('bg_night', 'bg/land_night') };
const ok = (im) => im && im.complete && im.naturalWidth > 0;
// 내 캐릭터 색 (고른 접시 테두리): 은결 파랑 / 은유 분홍
const ME = (() => { const look = HUB ? HUB.active().look : 'eunyu3'; return { who: String(look).startsWith('eungyeol') ? 'eungyeol' : 'eunyu' }; })();
const PICK = ME.who === 'eungyeol' ? '#3E8CFF' : '#FF5C93';
// 주스: 그림이 오기 전까지 사이다 컵을 주황으로 물들여 씀 (GPT 그림 요청 03번)
const JUICE = document.createElement('canvas');
IMG.juice = JUICE;
IMG.cider.addEventListener('load', () => {
  const im = IMG.cider; JUICE.width = im.naturalWidth; JUICE.height = im.naturalHeight; const c = JUICE.getContext('2d');
  c.drawImage(im, 0, 0); c.globalCompositeOperation = 'hue'; c.fillStyle = '#FF9A1F'; c.fillRect(0, 0, JUICE.width, JUICE.height);
  c.globalCompositeOperation = 'destination-in'; c.drawImage(im, 0, 0);
  JUICE.naturalWidth = JUICE.width; JUICE.naturalHeight = JUICE.height; JUICE.complete = true; JUICE.url = JUICE.toDataURL();
});
const foodSrc = (x) => x === 'juice' ? (JUICE.url || `assets/food/cider.webp?v=${ASSET_V}`) : `assets/food/${x}.webp?v=${ASSET_V}`;

// ---------- audio ----------
const Audio = {
  ctx: null, master: null, gain: null, bgm: null, bgmOn: false, timer: null, next: 0, step: 0,
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.gain = this.ctx.createGain(); this.gain.gain.value = 0.4; this.gain.connect(this.master);
      this.bgm = this.ctx.createGain(); this.bgm.gain.value = 0.09; this.bgm.connect(this.master);
      const b = this.ctx.createBuffer(1, 1, 22050), s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.master); s.start(0);
      this.applyMute();
      if (this.bgmOn && !this.timer) { this.bgmOn = false; this.startBgm(); }
    }
    if (this.ctx.state !== 'running') this.ctx.resume();
  },
  applyMute() { if (this.master) this.master.gain.value = Save.data.sound ? 1 : 0; },
  tone(f, d, type = 'sine', v = 0.4, slide = 0, when = 0, dest) {
    if (!this.ctx || !Save.data.sound) return;
    const t = this.ctx.currentTime + when, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(dest || this.gain); o.start(t); o.stop(t + d + 0.02);
  },
  noise(d, v = 0.12) {
    if (!this.ctx || !Save.data.sound) return;
    const n = Math.floor(this.ctx.sampleRate * d), b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 1800; g.gain.value = v; s.buffer = b; s.connect(f); f.connect(g); g.connect(this.gain); s.start();
  },
  sfx(n) {
    switch (n) {
      case 'put': this.tone(520, 0.07, 'triangle', 0.22, 160); break;
      case 'grill': this.noise(0.25, 0.1); break;
      case 'done': this.tone(1046, 0.1, 'sine', 0.25, 0); this.tone(1318, 0.12, 'sine', 0.22, 0, 0.08); break;
      case 'burnt': this.tone(200, 0.25, 'sawtooth', 0.1, -80); break;
      case 'bad': this.tone(260, 0.14, 'square', 0.12, -80); break;
      case 'serve': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.28, 0, i * 0.06)); break;
      case 'coin': this.tone(1568, 0.08, 'square', 0.12, 0); this.tone(2093, 0.12, 'square', 0.1, 0, 0.06); break;
      case 'angry': this.tone(330, 0.2, 'square', 0.14, -120); this.tone(220, 0.25, 'square', 0.12, -60, 0.15); break;
      case 'come': this.tone(880, 0.08, 'sine', 0.18, 0); this.tone(1175, 0.1, 'sine', 0.18, 0, 0.08); break;
      case 'trash': this.tone(300, 0.12, 'triangle', 0.2, -160); break;
      case 'clear': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.22, 'square', 0.16, 0, i * 0.11)); break;
      case 'fail': [392, 330, 262].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.25, 0, i * 0.18)); break;
      case 'ui': this.tone(700, 0.06, 'triangle', 0.25); break;
    }
  },
  // 경쾌한 가게 곡
  mel: [72, 76, 79, 76, 77, 76, 74, 0, 72, 74, 76, 79, 77, 0, 74, 0, 72, 76, 79, 84, 81, 79, 77, 76, 74, 77, 76, 74, 72, 0, 0, 0],
  bass: [48, 53, 55, 48, 45, 53, 55, 48],
  startBgm() {
    if (this.bgmOn || !this.ctx) { this.bgmOn = true; return; }
    this.bgmOn = true; this.next = this.ctx.currentTime + 0.1; clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (!this.ctx || !this.bgmOn) return;
      const sd = 60 / 120 / 2, mf = (n) => 440 * Math.pow(2, (n - 69) / 12);
      if (this.next < this.ctx.currentTime - 0.1) this.next = this.ctx.currentTime + 0.05;
      while (this.next < this.ctx.currentTime + 0.2) {
        const w = this.next - this.ctx.currentTime, m = this.mel[this.step % 32];
        if (m) this.tone(mf(m), sd * 1.2, 'triangle', 0.28, 0, w, this.bgm);
        if (this.step % 2 === 0) this.tone(mf(this.bass[Math.floor(this.step / 4) % 8]), sd * 1.6, 'sine', 0.42, 0, w, this.bgm);
        this.next += sd; this.step++;
      }
    }, 40);
  },
  stopBgm() { this.bgmOn = false; clearInterval(this.timer); this.timer = null; },
};

// ---------- 주문 ----------
// 버거 속 재료(패티 포함)를 보기 좋은 순서로: 패티 → 치즈 → (두 번째 패티) → 베이컨 → 양파 → 토마토 → 양상추
const SHOW_ORDER = ['patty', 'cheese', 'bacon', 'onion', 'tomato', 'lettuce'];
function showStack(inner) {
  const ps = inner.filter((x) => x === 'patty').length, rest = SHOW_ORDER.filter((x) => x !== 'patty' && inner.includes(x));
  const out = ['patty'];
  if (rest[0] === 'cheese') out.push(rest.shift());
  for (let k = 1; k < ps; k++) out.push('patty');
  return ['bun_b', ...out, ...rest, 'bun_t'];
}
function makeOrder(st) {
  let n = rint(st.fill[0], st.fill[1]);
  let p = 1;
  if (st.dbl && n >= 3 && (Math.random() < 0.35 || n - 1 > st.ing.length)) p = 2;
  n = Math.min(n, p + st.ing.length);
  const inner = [...Array(p).fill('patty'), ...shuffle(st.ing.slice()).slice(0, n - p)];
  let sides = [];
  if (st.sideMax === 1) { if (Math.random() < 0.6) sides = [st.sides[rint(0, st.sides.length - 1)]]; }
  else if (st.sideMax > 1) sides = shuffle(st.sides.slice()).slice(0, rint(1, Math.min(st.sideMax, st.sides.length)));
  return { inner, sides, stack: showStack(inner) };
}
const count = (arr) => { const m = {}; for (const x of arr) m[x] = (m[x] || 0) + 1; return m; };
const sameBag = (a, b) => { if (a.length !== b.length) return false; const A = count(a), B = count(b); return Object.keys(A).every((k) => A[k] === B[k]); };
const innerOf = (tray) => tray.stack.filter((x) => x !== 'bun_b' && x !== 'bun_t');

// ---------- state ----------
const cv = $('cv'), ctx = cv.getContext('2d'), root = $('root');
let scale = 1, dpr = 1;
const G = {
  state: 'ready', si: 0, st: null, guests: [], slots: [], trays: [], cur: 0, grill: [], hearts: START_HEARTS, maxH: START_HEARTS,
  spawned: 0, served: 0, missed: 0, nextT: 0, coins: 0, coinBase: 0, t: 0, fx: [], pose: 'idle', poseT: 0, hits: [], contUsed: false,
  usedIds: [], pausedFrom: 'play', tips: {},
};

// ---------- 배치 (논리 좌표) — 2026-11-10 사용자 시안을 기준으로 ----------
// 배경(1536x1024) 속 카운터 나무 윗선 y=568, 분홍 타일 아래 끝 y=790 → 카운터 윗선을 화면 46% 높이에 맞춤
const BG_TOP = 568, BG_TILE = 790;
const L = {};
function layout() {
  const v = (k) => parseFloat(getComputedStyle(root).getPropertyValue('--safe-' + k)) || 0;
  OX = (W - 960) / 2;
  const X0 = Math.max(8, v('l') + 4), X1 = W - Math.max(8, v('r') + 4), SP = X1 - X0;
  const fx = (f) => X0 + SP * f;
  const yc = Math.round(H * 0.48); // 카운터 윗선
  const s = Math.max(W / 1536, (H - yc) / (1024 - BG_TOP), yc / BG_TOP);
  Object.assign(L, { X0, X1, SP, fx, yc, bgS: s, bgX: (W - 1536 * s) / 2, bgY: yc - BG_TOP * s, safeB: v('b') });
  // 위: 말풍선 (HUD 아래) + 손님 얼굴
  L.bTop = 52 + v('t'); L.bH = Math.round(yc - L.bTop - Math.max(58, H * 0.12)); L.bBot = L.bTop + L.bH;
  L.gTop = L.bBot - 10; L.guestH = Math.round((yc - L.gTop) * 1.9);
  // 가운데 줄: 굽는 판 · 접시 · 음료 · 아이스크림
  L.kTop = yc + 8; L.kBot = Math.round(H * 0.705); const kh = L.kBot - L.kTop;
  const gw = Math.min(SP * 0.315, kh * 2.6), gh = gw * 256 / 720;
  L.grill = { x: fx(0.16) - gw / 2, y: L.kTop + (kh - gh) / 2, w: gw, h: gh };
  L.trayY = L.kBot - 6; L.trayW = Math.min(SP * 0.155, 210); L.trayC = [fx(0.415), fx(0.585)];
  L.drink = { x: fx(0.68), y: L.kTop + 2, w: SP * 0.205, h: kh - 4 };
  L.ice = { x: fx(0.893), y: L.kTop + 2, w: SP * 0.107, h: kh - 4 };
  // 아래 2줄: 재료 칸
  L.binTop = L.kBot + 6; L.binBot = H - 6 - Math.max(0, v('b') * 0.5);
  const bh = L.binBot - L.binTop, rh = (bh - 6) / 2, r2 = L.binTop + rh + 6;
  const cell = (f0, f1, y, h) => ({ x: fx(f0) + 3, y, w: fx(f1) - fx(f0) - 6, h });
  L.trash = cell(0, 0.105, L.binTop, bh);
  L.bins = [
    ['patty_raw', cell(0.105, 0.225, L.binTop, bh)],
    ['bun_t', cell(0.225, 0.38, L.binTop, rh)], ['bun_b', cell(0.38, 0.535, L.binTop, rh)], ['cheese', cell(0.535, 0.69, L.binTop, rh)], ['bacon', cell(0.69, 0.845, L.binTop, rh)],
    ['lettuce', cell(0.225, 0.432, r2, rh)], ['tomato', cell(0.432, 0.638, r2, rh)], ['onion', cell(0.638, 0.845, r2, rh)],
    ['fries', cell(0.845, 1, L.binTop, bh)],
  ];
}
function slotX(k, n) { const a = L.X0, w = L.SP / 3; return n === 3 ? a + w * (k + 0.5) : n === 2 ? a + L.SP * (k === 0 ? 0.3 : 0.7) : a + L.SP / 2; }
function trayX(k) { return L.trayC[k] || L.trayC[0]; }

// ---------- run ----------
function startStage(si) {
  G.si = si; const st = STAGES[si]; G.st = st;
  clearTimers();
  G.guests = []; G.slots = Array(st.conc).fill(null); G.trays = Array.from({ length: st.trays }, () => ({ stack: [], sides: [], shake: 0 })); G.cur = 0;
  G.grill = Array.from({ length: st.grills }, () => null);
  G.spawned = 0; G.served = 0; G.missed = 0; G.nextT = 0.8; G.coins = 0; G.coinBase = 0; G.t = 0; G.fx = []; G.contUsed = false; G.usedIds = [];
  G.hearts = START_HEARTS; G.maxH = START_HEARTS;
  const boosts = HUB ? HUB.takeBoosts('burger') : [];
  if (boosts.includes('life')) { G.hearts = 4; G.maxH = 4; } // 하트 아이템: 하트 4개로 시작
  renderHearts();
  setPose('idle');
  $('hudStage').textContent = isHard(si) ? label(si) : `스테이지 ${label(si)}`;
  setState('play'); updateHud();
  Audio.startBgm();
  const tip = coachTip(si);
  if (tip) later(() => toast(tip, 3800), 500);
}
function coachTip(si) {
  const st = STAGES[si], prev = STAGES[si - 1];
  if (si === 0) return '패티를 눌러 구워요! 초록이 되면 눌러서 접시에 올려요';
  if (si >= HARD) return '';
  if (si === 1) return '말풍선 버거를 꾹 누르면 재료를 크게 볼 수 있어요';
  if (si === 2) return '접시를 눌러 고르면 버거 2개를 같이 만들 수 있어요';
  if (st.sides.length && !(prev && prev.sides.length)) return '음료도 주문해요! 말풍선을 잘 봐요';
  if (st.burn && !(prev && prev.burn)) return '패티를 너무 오래 두면 타요! 빨개지기 전에 눌러요';
  if (st.dbl && !(prev && prev.dbl)) return '패티 2장 버거가 나와요! 말풍선 버거를 꾹 눌러 보세요';
  if (st.sides.includes('icecream') && !(prev && prev.sides.includes('icecream'))) return '아이스크림이 새로 나왔어요!';
  return '';
}
function showReady(si) {
  G.si = si; G.st = STAGES[si]; clearTimers(); G.guests = []; G.trays = []; G.grill = [];
  $('readyTitle').textContent = `${label(si)} ${stageName(si)}`;
  const st = STAGES[si], sides = st.sides.map((x) => tr(NAME[x])).join(' · ');
  $('readyInfo').textContent = `손님 ${st.guests}명 · 재료 ${st.ing.length + 2}가지${sides ? ' · ' + sides : ''}`;
  setState('ready');
}
let runId = 0;
const timers = [];
function later(fn, ms) { const id = runId; timers.push(setTimeout(() => { if (id === runId) fn(); }, ms)); }
function clearTimers() { runId++; timers.forEach(clearTimeout); timers.length = 0; }
function setPose(p, back = 0) {
  G.pose = p; G.poseT = back;
}

// ---------- 손님 ----------
function spawnGuest() {
  const k = G.slots.findIndex((x) => !x); if (k < 0) return false;
  const here = G.guests.map((g) => g.id);
  let pool = GUEST_IDS.filter((id) => !here.includes(id) && id !== G.usedIds[G.usedIds.length - 1]);
  if (!pool.length) pool = GUEST_IDS.filter((id) => !here.includes(id));
  const id = pool[rint(0, pool.length - 1)];
  const order = makeOrder(G.st);
  const wait = G.st.wait + Math.max(0, order.sides.length - 1) * 2 + (order.inner.length >= G.st.fill[1] ? 2 : 0);
  const g = { id, slot: k, order, t: 0, wait, ph: 'in', pt: 0 };
  G.slots[k] = g; G.guests.push(g); G.usedIds.push(id); G.spawned++;
  Audio.sfx('come');
  return true;
}
function guestPos(g) { return { x: slotX(g.slot, G.slots.length), y: L.gTop + L.guestH * 0.45 }; }
function mood(g) { const r = g.t / g.wait; return r < 0.5 ? 0 : r < 0.75 ? 1 : 2; }
function leave(g, happy) {
  g.ph = happy ? 'happy' : 'angry'; g.pt = 0;
  later(() => { G.slots[g.slot] = null; g.ph = 'gone'; G.guests = G.guests.filter((x) => x !== g); checkEnd(); }, happy ? 900 : 1100);
}

// ---------- 누르기 ----------
function curTray() { return G.trays[G.cur]; }
const done = (t) => t.stack[t.stack.length - 1] === 'bun_t';
function putOnTray(item, ti = G.cur) {
  const t = G.trays[ti];
  if (done(t)) { toast('버거가 완성됐어요. 주문과 다르면 버리기를 눌러요'); Audio.sfx('bad'); t.shake = 0.4; return false; }
  if (t.stack.length >= 10) { toast('더 쌓을 수 없어요'); Audio.sfx('bad'); return false; }
  if (!t.stack.length && item !== 'bun_b') t.stack.push('bun_b');
  t.stack.push(item); Audio.sfx('put');
  if (item === 'bun_t') checkServe(ti);
  return true;
}
const locked = (id) => !(id === 'patty_raw' || id === 'bun_b' || id === 'bun_t' || G.st.ing.includes(id) || G.st.sides.includes(id));
function tapBin(id) {
  if (locked(id)) { toast('아직 안 나오는 메뉴예요'); Audio.sfx('bad'); return; }
  if (id === 'patty_raw') {
    const k = G.grill.findIndex((x) => !x);
    if (k < 0) { toast('굽는 판이 꽉 찼어요'); Audio.sfx('bad'); return; }
    G.grill[k] = { t: 0, ph: 'cook' }; Audio.sfx('grill'); return;
  }
  // 아래 빵: 빈 접시마다 앞에서부터 하나씩 (고른 접시와 상관없이)
  if (id === 'bun_b') {
    const k = G.trays.findIndex((t) => !t.stack.length);
    if (k < 0) { toast('빈 접시가 없어요'); Audio.sfx('bad'); return; }
    putOnTray('bun_b', k); return;
  }
  if (id === 'bun_t' && !curTray().stack.length) { toast('아래 빵부터 놓아요'); Audio.sfx('bad'); curTray().shake = 0.4; return; }
  if (G.st.sides.includes(id)) {
    const t = curTray();
    if (t.sides.includes(id)) { toast(`${tr(NAME[id])}은(는) 이미 있어요`); Audio.sfx('bad'); return; }
    if (t.sides.length >= 3) { toast('사이드는 3개까지예요'); Audio.sfx('bad'); return; }
    t.sides.push(id); Audio.sfx('put');
    if (done(t)) checkServe(G.cur);
    return;
  }
  putOnTray(id);
}
function tapGrill(k) {
  const p = G.grill[k]; if (!p) { tapBin('patty_raw'); return; }
  if (p.ph === 'cook') { toast('아직 굽는 중이에요'); Audio.sfx('bad'); return; }
  if (p.ph === 'burnt') { G.grill[k] = null; Audio.sfx('trash'); const gp = grillPos(k); G.fx.push({ kind: 'puff', im: IMG.fx_smoke, x: gp.x, y: gp.y - 20, t: 0, life: 0.8 }); toast('탄 패티는 버렸어요'); return; }
  if (putOnTray('patty')) G.grill[k] = null;
}
function tapTrash() {
  const t = curTray(); if (!t.stack.length && !t.sides.length) return;
  t.stack = []; t.sides = []; Audio.sfx('trash');
  G.fx.push({ kind: 'puff', im: IMG.fx_smoke, x: L.trash.x + L.trash.w / 2, y: L.trash.y + 10, t: 0, life: 0.6 });
}
// 위 빵을 덮었을 때(또는 그 뒤 사이드를 담았을 때): 주문이 같은 손님에게 저절로
function checkServe(ti) {
  const t = G.trays[ti], inner = innerOf(t);
  const waiting = G.guests.filter((g) => g.ph === 'in').sort((a, b) => b.t / b.wait - a.t / a.wait);
  const same = waiting.filter((g) => sameBag(g.order.inner, inner));
  if (!same.length) { t.shake = 0.5; Audio.sfx('bad'); toast('주문과 달라요! 말풍선을 다시 봐요'); return; }
  const g = same.find((x) => sameBag(x.order.sides, t.sides));
  if (!g) {
    const need = same.find((x) => t.sides.every((s) => x.order.sides.includes(s)));
    if (need) { toast('사이드 메뉴도 담아요!'); G.hint = { g: need, t: 1.5 }; }
    else { t.shake = 0.5; Audio.sfx('bad'); toast('사이드가 달라요! 버리기로 비워요'); }
    return;
  }
  serve(ti, g);
}
function serve(ti, g) {
  const tray = G.trays[ti], gp = guestPos(g), fast = mood(g) === 0;
  G.fx.push({ kind: 'fly', stack: tray.stack.slice(), sides: tray.sides.slice(), x0: trayX(ti), y0: L.trayY - 18, x1: gp.x, y1: L.yc - 10, t: 0, life: 0.45 });
  tray.stack = []; tray.sides = []; G.cur = 0; // 내고 나면 다시 앞 접시
  const coin = COIN_GUEST + (fast ? COIN_TIP : 0);
  G.coins += coin; G.served++;
  Audio.sfx('serve'); later(() => Audio.sfx('coin'), 260); buzz(15);
  G.fx.push({ kind: 'text', text: fast ? `+${coin} 팁!` : `+${coin}`, x: gp.x, y: L.bTop + L.bH * 0.5, t: 0, life: 1, gold: fast });
  for (let i = 0; i < 6; i++) G.fx.push({ kind: 'spark', im: i % 2 ? IMG.fx_heart : IMG.fx_spark, x: gp.x + rnd(-40, 40), y: gp.y, vx: rnd(-90, 90), vy: rnd(-220, -120), r: rnd(18, 28), rot: rnd(0, 6), t: 0, life: 0.9 });
  setPose('happy', 0.9);
  leave(g, true);
  updateHud();
}
function loseHeart(g) {
  G.missed++;
  Audio.sfx('angry'); buzz(40); setPose('oops', 1);
  if (!GOD()) { G.hearts = Math.max(0, G.hearts - 1); renderHearts(true); }
  const gp = guestPos(g);
  G.fx.push({ kind: 'text', text: '하트 -1', x: gp.x, y: L.bTop + L.bH * 0.5, t: 0, life: 1, bad: true });
  leave(g, false);
  if (G.hearts <= 0) endStage(false);
}
function checkEnd() {
  if (G.state !== 'play') return;
  if (G.spawned >= G.st.guests && !G.guests.length) endStage(G.hearts > 0);
}

// ---------- 끝 ----------
function starsNow() { const lost = G.maxH - G.hearts; return G.hearts <= 0 ? 0 : lost <= 0 ? 3 : lost === 1 ? 2 : 1; }
function endStage(okEnd) {
  if (G.state !== 'play') return;
  setState('done'); Audio.stopBgm();
  let s = okEnd ? starsNow() : 0;
  if (GOD() && !s) s = 1;
  const okk = s > 0;
  Audio.sfx(okk ? 'clear' : 'fail'); setPose(okk ? 'cheer' : 'oops', 99);
  if (okk) for (let i = 0; i < 46; i++) G.fx.push({ kind: 'spark', im: [IMG.fx_spark, IMG.fx_heart][i % 2], x: rnd(0, W), y: rnd(-200, -20), vx: rnd(-40, 40), vy: rnd(120, 260), r: rnd(16, 26), rot: rnd(0, 6), t: 0, life: 3, fall: true });
  let earn = null;
  if (HUB) earn = HUB.record('burger', { stage: G.si, cleared: okk, dist: G.served, coins: G.coins - G.coinBase, stars: s });
  else if (okk) { Save.data.cleared[G.si] = true; Save.store(); }
  G.fx.push({ kind: 'text', text: okk ? '영업 끝! 클리어!' : '하트가 없어요!', x: W / 2, y: H * 0.42, t: 0, life: 1.3, big: true, bad: !okk });
  later(() => showResult(okk, s, earn), 1300);
}
function showResult(okk, st, earn) {
  $('resTitle').textContent = okk ? '스테이지 클리어!' : '아쉬워요!';
  $('resWhy').textContent = okk ? '' : '화난 손님이 너무 많았어요';
  $('resWhy').classList.toggle('hidden', okk);
  document.querySelector('.panel.result').classList.toggle('fail', !okk);
  $('resStars').innerHTML = [0, 1, 2].map((k) => `<span class="${k < st ? '' : 'off'}">★</span>`).join('');
  $('resServed').textContent = `${G.served}명`;
  $('resMissed').textContent = `${G.missed}명`;
  $('resCoin').textContent = G.coins;
  $('resEarn').classList.toggle('hidden', !earn);
  if (earn) $('resEarn').innerHTML = `+${earn.earned} 코인 획득!` + (earn.bonus ? ` <small>(클리어 보너스 +${earn.bonus}${earn.firstClear ? ', 첫 클리어!' : ''})</small>` : '') + `<small>내 코인 ${earn.coins}</small>`;
  const hasNext = okk && G.si % HARD < HARD - 1 && unlocked(G.si + 1);
  $('btnNext').classList.toggle('hidden', !hasNext);
  setState('result');
}

// ---------- update ----------
function step(dt) {
  G.t += dt;
  for (const f of G.fx) { f.t += dt; if (f.vx != null) { f.x += f.vx * dt; f.y += f.vy * dt; if (!f.fall) f.vy += 420 * dt; } }
  G.fx = G.fx.filter((f) => f.t < f.life);
  for (const t of G.trays) t.shake = Math.max(0, t.shake - dt);
  if (G.hint) { G.hint.t -= dt; if (G.hint.t <= 0) G.hint = null; }
  if (G.poseT > 0 && G.poseT < 50) { G.poseT -= dt; if (G.poseT <= 0) G.pose = 'idle'; }
  if (G.state !== 'play') return;
  const st = G.st;
  // 손님 오기
  if (G.spawned < st.guests) {
    G.nextT -= dt;
    if (G.nextT <= 0 && spawnGuest()) G.nextT = st.gap * rnd(0.8, 1.2);
    // 손님이 아무도 없으면 바로 다음 손님 (기다리지 않게)
    if (!G.guests.length && G.nextT > 1.2) G.nextT = 1.2;
  }
  // 손님 기다림
  for (const g of G.guests) {
    g.pt += dt;
    if (g.ph !== 'in') continue;
    g.t += dt;
    if (g.t >= g.wait) loseHeart(g);
    if (G.state !== 'play') return;
  }
  // 굽는 판
  for (let k = 0; k < G.grill.length; k++) {
    const p = G.grill[k]; if (!p) continue;
    p.t += dt;
    if (p.ph === 'cook' && p.t >= st.cook) { p.ph = 'done'; Audio.sfx('done'); }
    else if (p.ph === 'done' && st.burn && p.t >= st.cook + st.burn) { p.ph = 'burnt'; Audio.sfx('burnt'); setPose('oops', 0.8); }
    if (p.ph === 'cook' && Math.random() < dt * 3) { const gp = grillPos(k); G.fx.push({ kind: 'steam', im: IMG.fx_steam, x: gp.x + rnd(-10, 10), y: gp.y - 14, t: 0, life: 0.9 }); }
    if (p.ph === 'burnt' && Math.random() < dt * 2) { const gp = grillPos(k); G.fx.push({ kind: 'steam', im: IMG.fx_smoke, x: gp.x + rnd(-10, 10), y: gp.y - 14, t: 0, life: 1 }); }
  }
  updateHud();
}

// ---------- 그리기 ----------
function grillPos(k) {
  const fx = [0.178, 0.397, 0.61, 0.824][k];
  return { x: L.grill.x + L.grill.w * fx, y: L.grill.y + L.grill.h * 0.43, r: L.grill.w * 0.085 };
}
// 버거 조각: 그림 폭 비율(폭), 위로 쌓이는 높이(폭 비율) — 접시 위(꽉 붙여 쌓음)
const PIECE = { bun_b: [1, 0.2], patty: [0.94, 0.2], cheese: [1.02, 0.1], lettuce: [1.08, 0.12], tomato: [0.92, 0.12], onion: [0.9, 0.11], bacon: [0.96, 0.12], bun_t: [1, 0] };
function drawStack(items, cx, by, w) {
  let y = by;
  for (const it of items) {
    const im = IMG[it], [wf, step] = PIECE[it] || [1, 0.08];
    if (ok(im)) { const dw = w * wf, dh = dw * im.naturalHeight / im.naturalWidth; ctx.drawImage(im, cx - dw / 2, y - dh, dw, dh); }
    y -= w * step;
  }
}
// 주문 말풍선: 층마다 띄워서 속 재료가 다 보이게 (시안처럼). 높이 maxH 안에 들어가게 폭을 정함
let SPREAD = 0.27;
function spreadSize(items, maxW, maxH) {
  const n = items.length - 1, hOf = (sp) => n * sp + 0.62;
  SPREAD = 0.27; let w = maxH / hOf(SPREAD);
  if (w < 54) { SPREAD = Math.max(0.2, (maxH / 54 - 0.62) / n); w = maxH / hOf(SPREAD); }
  return Math.min(maxW, w);
}
function drawSpread(items, cx, by, w) {
  let y = by;
  items.forEach((it) => {
    const im = IMG[it], wf = (PIECE[it] || [1])[0];
    if (ok(im)) { const dw = w * wf, dh = dw * im.naturalHeight / im.naturalWidth; ctx.drawImage(im, cx - dw / 2, y - dh, dw, dh); }
    y -= w * SPREAD;
  });
}
function drawImg(im, x, y, w, h) { if (ok(im)) ctx.drawImage(im, x, y, w, h); }
function drawImgW(im, cx, by, w) { if (!ok(im)) return 0; const h = w * im.naturalHeight / im.naturalWidth; ctx.drawImage(im, cx - w / 2, by - h, w, h); return h; }
function drawImgH(im, cx, by, h) { if (!ok(im)) return 0; const w = h * im.naturalWidth / im.naturalHeight; ctx.drawImage(im, cx - w / 2, by - h, w, h); return w; }
// 상자 안에 비율 그대로 꽉 (가운데)
function drawFit(im, x, y, w, h) { if (!ok(im)) return; const r = Math.min(w / im.naturalWidth, h / im.naturalHeight), dw = im.naturalWidth * r, dh = im.naturalHeight * r; ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); }
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function bar(x, y, w, h, f, color) {
  ctx.fillStyle = 'rgba(40,30,60,.55)'; rr(x - 2, y - 2, w + 4, h + 4, (h + 4) / 2); ctx.fill();
  ctx.fillStyle = color; rr(x, y, Math.max(h, w * clamp(f, 0, 1)), h, h / 2); ctx.fill();
}
function text(t, x, y, size, color = '#fff', stroke = 'rgba(30,24,48,.75)') {
  ctx.font = `${size}px Jua, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (stroke) { ctx.lineWidth = size * 0.22; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.strokeText(tr(t), x, y); }
  ctx.fillStyle = color; ctx.fillText(tr(t), x, y);
}
const hit = (x, y, w, h, act) => G.hits.push({ x, y, w, h, act });

function draw() {
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  G.hits = [];
  const bg = isHard(G.si) ? BG.night : BG.day;
  if (ok(bg)) ctx.drawImage(bg, L.bgX, L.bgY, 1536 * L.bgS, 1024 * L.bgS); else { ctx.fillStyle = '#F4D7CF'; ctx.fillRect(0, 0, W, H); }
  const playing = ['play', 'pause', 'done', 'recipe'].includes(G.state) && G.st && G.trays.length;
  if (playing) drawGuests();
  // 카운터 띠를 손님 위에 한 번 더 (손님 아래쪽이 카운터 뒤로)
  if (ok(bg)) ctx.drawImage(bg, 0, BG_TOP - 4, 1536, BG_TILE - BG_TOP + 4, L.bgX, L.bgY + (BG_TOP - 4) * L.bgS, 1536 * L.bgS, (BG_TILE - BG_TOP + 4) * L.bgS);
  drawCounterBase();
  if (playing) { drawBubbles(); drawKitchen(); drawBins(); drawGuide(); }
  drawFx();
}
// 아래 재료 칸 밑판 (스테인리스)
function drawCounterBase() {
  const y = L.binTop - 4;
  const g = ctx.createLinearGradient(0, y, 0, H); g.addColorStop(0, '#E9D3B4'); g.addColorStop(1, '#D9BC94');
  ctx.fillStyle = g; ctx.fillRect(0, y, W, H - y);
  ctx.fillStyle = 'rgba(120,80,40,.25)'; ctx.fillRect(0, y, W, 3);
}
function drawGuests() {
  for (const g of G.guests) {
    const x = slotX(g.slot, G.slots.length), top = L.gTop;
    const m = mood(g), pose = g.ph === 'happy' ? 'happy' : g.ph === 'angry' || m === 2 ? 'angry' : 'wait';
    const im = IMG[`g_${g.id}_${pose}`];
    let dy = 0, a = 1, sx = 0;
    if (g.ph === 'in' && g.pt < 0.35) dy = (1 - g.pt / 0.35) * 50; // 아래에서 튀어 오르며 나타남
    if (g.ph === 'happy') dy = -Math.sin(Math.min(1, g.pt / 0.3) * Math.PI) * 14 + Math.max(0, g.pt - 0.5) * 260;
    if (g.ph === 'angry') { sx = Math.sin(g.pt * 40) * 6 * Math.max(0, 1 - g.pt); dy = Math.max(0, g.pt - 0.6) * 300; }
    if (g.ph !== 'in') a = clamp(1 - Math.max(0, g.pt - 0.5) * 2, 0, 1);
    ctx.globalAlpha = a;
    drawImgH(im, x + sx, top + dy + L.guestH, L.guestH);
    if (g.ph === 'in' && m === 1) { const s = 20 + Math.sin(G.t * 6) * 2; drawImg(IMG.fx_sweat, x + L.guestH * 0.2, top + 8 + Math.sin(G.t * 3) * 3, s * 0.75, s); }
    ctx.globalAlpha = 1;
  }
}
function bubbleBox(g) {
  const n = G.slots.length, x = slotX(g.slot, n), bw = Math.min(L.SP / 3 - 14, 400);
  return { x: x - bw / 2, y: L.bTop, w: bw, h: L.bH, cx: x };
}
function drawBubbles() {
  for (const g of G.guests) {
    if (g.ph !== 'in') continue;
    const B = bubbleBox(g), { x: bx, y: by, w: bw, h: bh } = B;
    const pop = g.pt < 0.3 ? 0.6 + g.pt / 0.3 * 0.4 : 1;
    ctx.save(); ctx.translate(B.cx, by + bh); ctx.scale(pop, pop); ctx.translate(-B.cx, -(by + bh));
    // 말풍선 (흰 상자 + 파란 테두리 + 아래 꼬리)
    ctx.fillStyle = '#fff'; ctx.strokeStyle = G.hint && G.hint.g === g ? '#FF5C93' : '#2F5E9E'; ctx.lineWidth = 3;
    if (G.hint && G.hint.g === g) { ctx.shadowColor = '#FF5C93'; ctx.shadowBlur = 16; }
    rr(bx, by, bw, bh, 16); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.moveTo(bx + 34, by + bh - 1); ctx.lineTo(bx + 30, by + bh + 14); ctx.lineTo(bx + 56, by + bh - 1); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(bx + 34, by + bh + 1); ctx.lineTo(bx + 30, by + bh + 14); ctx.lineTo(bx + 56, by + bh + 1); ctx.stroke();
    const o = g.order, hasSide = o.sides.length > 0;
    const barH = 8, padB = 10, inH = bh - padB - barH - 12;
    const burgerW = hasSide ? bw * 0.56 : bw, bcx = bx + burgerW / 2;
    const w = spreadSize(o.stack, burgerW * 0.62, inH), sp = SPREAD;
    SPREAD = sp; drawSpread(o.stack, bcx, by + 8 + inH, w);
    if (hasSide) {
      ctx.strokeStyle = '#D8DEE8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx + burgerW, by + 12); ctx.lineTo(bx + burgerW, by + 8 + inH); ctx.stroke();
      const n = o.sides.length, sw = (bw - burgerW - 10) / n;
      o.sides.forEach((s, i) => drawFit(IMG[s], bx + burgerW + 5 + sw * i + 2, by + 10, sw - 4, inH - 2));
    }
    // 기다림 막대 (말풍선 안 아래)
    const f = 1 - g.t / g.wait, m = mood(g);
    bar(bx + 18, by + bh - padB - barH + 6, bw - 36, barH, f, ['#4CC46A', '#FFC23D', '#F2546B'][m]);
    ctx.restore();
    hit(bx, by, bw, bh + 10, { bubble: g });
  }
}
// 스테인리스 칸 (재료 통·버리기)
function drawCell(c, lbl, dim) {
  ctx.globalAlpha = dim ? 0.4 : 1;
  const g = ctx.createLinearGradient(0, c.y, 0, c.y + c.h); g.addColorStop(0, '#F3F5F8'); g.addColorStop(1, '#AEB7C2');
  ctx.fillStyle = g; rr(c.x, c.y, c.w, c.h, 10); ctx.fill();
  ctx.strokeStyle = '#7D8794'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#4B525C'; rr(c.x + 5, c.y + 5, c.w - 10, c.h - 10 - 18, 7); ctx.fill();
  ctx.fillStyle = '#5E6670'; rr(c.x + 7, c.y + 7, c.w - 14, c.h - 14 - 18, 6); ctx.fill();
  text(lbl, c.x + c.w / 2, c.y + c.h - 11, 15, '#2A2348', null);
  ctx.globalAlpha = 1;
}
function drawKitchen() {
  const st = G.st;
  // 굽는 판
  drawImg(IMG.grill, L.grill.x, L.grill.y, L.grill.w, L.grill.h);
  for (let k = 0; k < 4; k++) {
    const gp = grillPos(k);
    if (k >= G.grill.length) { drawImgW(IMG.cover, gp.x, gp.y + gp.r * 0.75, gp.r * 2.3); continue; }
    const p = G.grill[k];
    hit(gp.x - gp.r * 1.25, L.grill.y - 6, gp.r * 2.5, L.grill.h + 12, { grill: k });
    if (!p) continue;
    const im = p.ph === 'burnt' ? IMG.patty_burnt : p.ph === 'done' ? IMG.patty : p.t < st.cook * 0.5 ? IMG.patty_raw : IMG.patty_cook;
    const jig = p.ph === 'cook' ? Math.sin(G.t * 30 + k) * 0.6 : 0;
    drawImgW(im, gp.x + jig, gp.y + gp.r * 0.55, gp.r * 2.1);
    let f, c;
    if (p.ph === 'cook') { f = p.t / st.cook; c = '#B9B2C6'; }
    else if (p.ph === 'done') { if (!st.burn) { f = 1; c = '#4CC46A'; } else { const r = (p.t - st.cook) / st.burn; f = 1 - r; c = r < 0.5 ? '#4CC46A' : r < 0.8 ? '#FF9F2E' : '#F2546B'; } }
    else { f = 1; c = '#3A3044'; }
    bar(gp.x - gp.r, L.grill.y + L.grill.h * 0.83, gp.r * 2, 7, f, c);
    if (p.ph === 'done' && (!st.burn || (p.t - st.cook) / st.burn < 0.5)) drawImg(IMG.fx_check, gp.x + gp.r * 0.55, gp.y - gp.r * 1.25, 20, 20);
  }
  // 접시 2개: 고른 접시는 테두리 + ▼
  G.trays.forEach((t, k) => {
    const x = trayX(k) + (t.shake ? Math.sin(t.shake * 50) * 6 : 0), tw = L.trayW, th = tw * 153 / 300, ty = L.trayY - th;
    const sel = k === G.cur;
    if (sel) { ctx.save(); ctx.shadowColor = PICK; ctx.shadowBlur = 18; drawImg(IMG.tray, x - tw / 2, ty, tw, th); ctx.restore(); }
    drawImg(IMG.tray, x - tw / 2, ty, tw, th);
    if (sel) {
      ctx.strokeStyle = PICK; ctx.lineWidth = 4; rr(x - tw / 2 - 3, ty - 3, tw + 6, th + 6, 14); ctx.stroke();
      const ay = L.kTop + 4 + Math.sin(G.t * 6) * 3; ctx.fillStyle = PICK; ctx.beginPath(); ctx.moveTo(x - 10, ay); ctx.lineTo(x + 10, ay); ctx.lineTo(x, ay + 12); ctx.closePath(); ctx.fill();
    }
    const bw = tw * 0.56;
    if (t.stack.length) drawStack(t.stack, x - tw * 0.12, ty + th * 0.66, bw);
    t.sides.forEach((s, i) => drawImgH(IMG[s], x + tw * 0.33, ty + th * 0.7 - i * th * 0.32, th * 0.85));
    hit(x - tw / 2, L.kTop, tw, L.trayY - L.kTop + 4, { tray: k });
  });
  // 음료 기계: 콜라 · 사이다 · 주스
  const D = L.drink, lock = (id) => !st.sides.includes(id);
  ctx.fillStyle = '#3A3F48'; rr(D.x, D.y, D.w, D.h, 12); ctx.fill();
  ctx.fillStyle = '#272B32'; rr(D.x + 6, D.y + D.h * 0.62, D.w - 12, D.h * 0.32, 8); ctx.fill();
  [['cola', '콜라', '#E0303A'], ['cider', '사이다', '#2FA84F'], ['juice', '주스', '#F28A1A']].forEach(([id, lbl, col], i) => {
    const cw = (D.w - 12) / 3, x = D.x + 6 + cw * i, off = lock(id);
    ctx.globalAlpha = off ? 0.38 : 1;
    ctx.fillStyle = col; rr(x + 3, D.y + 6, cw - 6, D.h * 0.22, 7); ctx.fill();
    text(lbl, x + cw / 2, D.y + 6 + D.h * 0.11, Math.min(17, cw * 0.26));
    ctx.fillStyle = '#9AA3AE'; ctx.fillRect(x + cw / 2 - 5, D.y + 6 + D.h * 0.22, 10, D.h * 0.1);
    drawFit(IMG[id], x + 6, D.y + D.h * 0.36, cw - 12, D.h * 0.58);
    ctx.globalAlpha = 1;
    hit(x, D.y, cw, D.h, { bin: id });
  });
  // 아이스크림 기계 (10월드)
  const I = L.ice, ioff = lock('icecream');
  ctx.globalAlpha = ioff ? 0.38 : 1;
  ctx.fillStyle = '#F7A8C8'; rr(I.x, I.y, I.w, I.h, 12); ctx.fill();
  ctx.fillStyle = '#E2669A'; rr(I.x + 5, I.y + 6, I.w - 10, I.h * 0.22, 7); ctx.fill();
  text('아이스크림', I.x + I.w / 2, I.y + 6 + I.h * 0.11, Math.min(15, I.w * 0.15));
  drawFit(IMG.icecream, I.x + 8, I.y + I.h * 0.33, I.w - 16, I.h * 0.62);
  ctx.globalAlpha = 1;
  hit(I.x, I.y, I.w, I.h, { bin: 'icecream' });
}
function drawBins() {
  // 버리기
  const T = L.trash;
  drawCell(T, '버리기');
  drawFit(IMG.trash, T.x + 8, T.y + 10, T.w - 16, T.h - 40);
  hit(T.x, T.y, T.w, T.h, { trash: 1 });
  for (const [id, c] of L.bins) {
    const dim = locked(id);
    drawCell(c, NAME[id === 'patty_raw' ? 'patty' : id], dim);
    ctx.globalAlpha = dim ? 0.4 : 1;
    const ix = c.x + 10, iy = c.y + 9, iw = c.w - 20, ih = c.h - 18 - 18;
    if (id === 'patty_raw') { drawFit(IMG.patty_raw, ix, iy, iw, ih / 2); drawFit(IMG.patty_raw, ix, iy + ih / 2, iw, ih / 2); }
    else if (id === 'fries') drawFit(IMG.fries, ix, iy, iw, ih);
    else { drawFit(IMG[id], ix, iy, iw / 2 - 3, ih); drawFit(IMG[id], ix + iw / 2 + 3, iy, iw / 2 - 3, ih); }
    ctx.globalAlpha = 1;
    hit(c.x, c.y, c.w, c.h, { bin: id });
  }
}
// 1-1 은 다음에 누를 곳을 반짝여 줌 (로봇 검사도 같은 계산을 씀)
function nextAction() {
  const g = G.guests.filter((x) => x.ph === 'in').sort((a, b) => b.t - a.t)[0]; if (!g) return null;
  const t = curTray(), have = innerOf(t), need = g.order.inner.slice();
  for (const x of have) { const i = need.indexOf(x); if (i >= 0) need.splice(i, 1); }
  if (done(t)) return { trash: 1 };
  const pNeed = need.filter((x) => x === 'patty').length;
  const doneK = G.grill.findIndex((p) => p && p.ph === 'done');
  if (pNeed && doneK >= 0) return { grill: doneK };
  if (pNeed && G.grill.filter((p) => p && p.ph === 'cook').length < pNeed) return { bin: 'patty_raw' };
  const other = need.find((x) => x !== 'patty');
  if (!t.stack.length) return G.cur === G.trays.findIndex((x) => !x.stack.length) ? { bin: 'bun_b' } : { tray: G.cur };
  if (other) return { bin: other };
  const side = g.order.sides.find((s) => !t.sides.includes(s));
  if (side) return { bin: side };
  if (pNeed) return null;
  return { bin: 'bun_t' };
}
function drawGuide() {
  if (G.si !== 0 || G.state !== 'play') return;
  const a = nextAction(); if (!a) return;
  const h = G.hits.find((x) => (a.bin && x.act.bin === a.bin) || (a.grill != null && x.act.grill === a.grill) || (a.trash && x.act.trash));
  if (!h) return;
  const p = 0.5 + Math.sin(G.t * 7) * 0.5;
  ctx.strokeStyle = `rgba(255,92,147,${0.5 + p * 0.5})`; ctx.lineWidth = 4 + p * 2;
  rr(h.x - 2, h.y - 2, h.w + 4, h.h + 4, 14); ctx.stroke();
}
function drawFx() {
  for (const f of G.fx) {
    const k = f.t / f.life;
    if (f.kind === 'spark') {
      ctx.save(); ctx.globalAlpha = f.fall ? Math.min(1, (1 - k) * 2) : 1 - k; ctx.translate(f.x, f.y); ctx.rotate(f.rot + f.t * 3);
      if (ok(f.im)) ctx.drawImage(f.im, -f.r / 2, -f.r / 2, f.r, f.r); ctx.restore(); continue;
    }
    if (f.kind === 'steam' || f.kind === 'puff') {
      ctx.globalAlpha = (1 - k) * (f.kind === 'steam' ? 0.75 : 1); const s = (f.kind === 'steam' ? 22 : 40) * (0.6 + k * 0.8);
      if (ok(f.im)) ctx.drawImage(f.im, f.x - s / 2, f.y - s - k * 30, s, s); ctx.globalAlpha = 1; continue;
    }
    if (f.kind === 'fly') {
      const e = k * (2 - k), x = f.x0 + (f.x1 - f.x0) * e, y = f.y0 + (f.y1 - f.y0) * e - Math.sin(k * Math.PI) * 60;
      ctx.globalAlpha = 1 - Math.max(0, k - 0.75) * 4;
      drawStack(f.stack, x, y, L.trayW * 0.5 * (1 - k * 0.3)); f.sides.forEach((s, i) => drawImgH(IMG[s], x + 44, y - i * 20, 34));
      ctx.globalAlpha = 1; continue;
    }
    if (f.kind === 'text') {
      ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
      ctx.font = `${f.big ? 46 : 26}px Jua, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = f.big ? 8 : 6; ctx.strokeStyle = f.bad ? '#7A1E33' : '#7A3E00'; ctx.strokeText(tr(f.text), f.x, f.y - k * 30);
      ctx.fillStyle = f.bad ? '#FFD0DA' : f.gold ? '#FFE07A' : '#FFF4C2'; ctx.fillText(tr(f.text), f.x, f.y - k * 30);
      ctx.globalAlpha = 1;
    }
  }
}

// ---------- HUD ----------
let lastKey = '';
function updateHud() {
  if (!G.st) return;
  const key = `${G.served + G.missed}|${G.coins}`;
  if (key === lastKey) return;
  lastKey = key;
  $('hudGuests').textContent = `${G.served + G.missed} / ${G.st.guests}`;
  $('hudCoin').textContent = G.coins;
}
function renderHearts(pop) {
  $('hudHearts').innerHTML = Array.from({ length: G.maxH }, (_, k) => `<i class="heart${k < G.hearts ? '' : ' empty'}${pop && k === G.hearts ? ' pop' : ''}"></i>`).join('');
}
let toastT = 0;
function toast(t, ms = 1800) { const el = $('toast'); el.textContent = tr(t); el.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.add('hidden'), ms); }

// ---------- 꾹 누르면 주문 재료 보기 (손을 떼면 닫힘, 버튼 없음) ----------
let press = null;
function openRecipe(g) {
  if (G.state !== 'play') return;
  const rows = g.order.stack.slice().reverse();
  $('rcList').innerHTML = rows.map((x) => `<div class="rc-row"><img src="${foodSrc(x)}" alt=""><span>${tr(NAME[x])}</span></div>`).join('');
  $('rcSides').innerHTML = g.order.sides.map((s) => `<div class="rc-side"><img src="${foodSrc(s)}" alt=""><span>${tr(NAME[s])}</span></div>`).join('');
  $('rcSides').classList.toggle('hidden', !g.order.sides.length);
  G.pausedFrom = 'play'; setState('recipe'); buzz(10);
}
function closeRecipe() { if (G.state === 'recipe') { setState('play'); last = performance.now(); } }
function pressEnd() { if (press) { clearTimeout(press.t); press = null; } closeRecipe(); }

// ---------- screens ----------
function setState(s) {
  G.state = s;
  $('ready').classList.toggle('hidden', s !== 'ready');
  $('pause').classList.toggle('hidden', s !== 'pause');
  $('result').classList.toggle('hidden', s !== 'result');
  $('recipe').classList.toggle('hidden', s !== 'recipe');
  $('hud').classList.toggle('hidden', !['play', 'pause', 'done', 'recipe'].includes(s));
  if (s !== 'play') { clearTimeout(toastT); $('toast').classList.add('hidden'); }
  lastKey = '';
}
function pauseGame() { if (G.state === 'play' || G.state === 'recipe') { G.pausedFrom = 'play'; setState('pause'); Audio.stopBgm(); } }
function resumeGame() { if (G.state === 'pause') { Audio.unlock(); setState(G.pausedFrom); Audio.startBgm(); last = performance.now(); } }
// 광고 보고 이어하기 (common/monet.js): 하트 1개로 그 판을 이어서. 한 판에 한 번
window.GameContinue = {
  can: () => !G.contUsed,
  go() {
    G.contUsed = true; G.coinBase = G.coins; clearTimers();
    G.hearts = Math.max(1, G.hearts); renderHearts(); setPose('idle');
    for (const g of G.guests) if (g.ph === 'in') g.t = Math.min(g.t, g.wait * 0.3);
    setState('done'); GamePop.tapToGo(() => { setState('play'); Audio.startBgm(); });
  },
};
function goMain() { clearTimers(); Audio.stopBgm(); location.href = '../index.html#lobby'; }
function goMap() {
  clearTimers(); Audio.stopBgm();
  try { const m = JSON.parse(localStorage.getItem('twin_gameland_mapmode') || '{}'); m.burger = isHard(G.si) ? 'hard' : 'easy'; localStorage.setItem('twin_gameland_mapmode', JSON.stringify(m)); } catch (e) { /* ignore */ }
  location.href = HUB ? '../index.html#map-burger' : '../index.html';
}

// ---------- input ----------
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
function tapAt(x, y) {
  if (G.state !== 'play') return;
  for (let i = G.hits.length - 1; i >= 0; i--) {
    const h = G.hits[i]; if (x < h.x || x > h.x + h.w || y < h.y || y > h.y + h.h) continue;
    const a = h.act;
    if (a.bin) tapBin(a.bin);
    else if (a.grill != null) tapGrill(a.grill);
    else if (a.tray != null) { if (G.cur !== a.tray) { G.cur = a.tray; Audio.sfx('ui'); } }
    else if (a.trash) tapTrash();
    else if (a.bubble) { pressEnd(); press = { t: setTimeout(() => { if (press && a.bubble.ph === 'in') openRecipe(a.bubble); }, 280) }; }
    return;
  }
}
cv.addEventListener('pointerdown', (e) => {
  e.preventDefault(); Audio.unlock();
  // 화면 좌표 → 게임 좌표 (돌려 보여 줄 때는 거꾸로 돌려서)
  if (rotated) tapAt((e.clientY - offX) / scale, (viewW - offY - e.clientX) / scale);
  else tapAt((e.clientX - offX) / scale, (e.clientY - offY) / scale);
});
for (const ev of ['pointerup', 'pointercancel', 'blur']) window.addEventListener(ev, pressEnd);
cv.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('keydown', (e) => {
  Audio.unlock();
  if (e.code === 'Escape' || e.code === 'KeyP') { if (G.state === 'play') pauseGame(); else if (G.state === 'pause') resumeGame(); else if (G.state === 'recipe') pressEnd(); }
  else if ((e.code === 'Enter' || e.code === 'Space') && G.state === 'ready') { e.preventDefault(); $('btnGo').click(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('blur', () => pauseGame());
const click = (id, fn) => $(id).addEventListener('click', () => { Audio.unlock(); Audio.sfx('ui'); fn(); });
click('btnGo', () => startStage(G.si));
click('btnReadyMap', goMap); click('btnReadyHome', goMain); click('btnHomeR', goMain); click('btnMapP', goMap); click('btnMapR', goMap);
click('btnPause', pauseGame); click('btnResume', resumeGame);
click('btnRetryP', () => showReady(G.si)); click('btnRetry', () => showReady(G.si));
click('btnNext', () => showReady(Math.min(STAGES.length - 1, G.si + 1)));
$('recipe').addEventListener('pointerup', pressEnd);

// ---------- layout: 가로 고정 (스카이 라이더처럼 세로로 든 폰에서는 게임을 90° 돌려서 보여 줌) ----------
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
let rotated = false, offX = 0, offY = 0, viewW = 0;
function resize() {
  const vv = window.visualViewport;
  const vw = Math.round(vv ? vv.width : window.innerWidth), vh = Math.round(window.fullViewH ? fullViewH() : (vv ? vv.height : window.innerHeight));
  const s = $('safe').getBoundingClientRect();
  const inset = { t: s.top, l: s.left, r: vw - s.right, b: vh - s.bottom };
  rotated = isTouch && vh > vw;
  const sw = rotated ? vh : vw, sh = rotated ? vw : vh;
  if (sw / sh >= 16 / 9) { H = 540; W = Math.round(Math.min(1300, H * sw / sh)); } else { W = 960; H = Math.round(clamp(W * sh / sw, 540, 760)); }
  scale = Math.min(sw / W, sh / H);
  dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  root.style.width = W + 'px'; root.style.height = H + 'px';
  root.classList.add('wide');
  const ox = (sw - W * scale) / 2, oy = (sh - H * scale) / 2;
  offX = ox; offY = oy; viewW = vw;
  root.style.transform = rotated
    ? `translate(${vw - oy}px, ${ox}px) rotate(90deg) scale(${scale})`
    : `translate(${ox}px, ${oy}px) scale(${scale})`;
  const ins = rotated ? { l: inset.t, r: inset.b, t: inset.r, b: inset.l } : inset;
  for (const k of ['l', 'r', 't', 'b']) root.style.setProperty('--safe-' + k, Math.max(0, (ins[k] - (k === 'l' || k === 'r' ? ox : oy)) / scale) + 'px');
  cv.width = Math.round(W * scale * dpr); cv.height = Math.round(H * scale * dpr);
  layout();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now; if (dt > 0.05) dt = 0.05; if (dt < 0) dt = 0;
  if (G.state !== 'pause' && G.state !== 'recipe') step(dt);
  draw();
}
resize();
{
  const q = new URLSearchParams(location.search);
  let si = parseInt(q.get('stage'), 10);
  if (!(si >= 0 && si < STAGES.length) || !unlocked(si)) si = nextStage();
  showReady(si);
  if (q.get('go') === '1') startStage(si);
}
requestAnimationFrame(frame);

// debug/test hook
window.__burger = { G, startStage, STAGES, tapBin, tapGrill, tapTrash, spawnGuest, nextAction, openRecipe, showResult, endStage };
