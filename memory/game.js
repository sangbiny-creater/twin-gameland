'use strict';
// 은유와 은결의 메모리 게임 — 카드 짝 맞추기
//  · 처음에 모든 카드를 잠깐 보여 주고(미리 보기) 뒤집어 놓음 → 2장을 골라 뒤집어 같은 그림이면 획득, 다르면 다시 뒤집힘
//  · 틀리면 제한 시간이 0.2초 줄어듦 (아무거나 마구 누르지 않게)
//  · 제한 시간 안에 모든 짝을 찾으면 클리어 → 남은 시간으로 별 1~3개 (사천성과 같은 규칙)
//  · 징검다리: 10개 월드 × 10판 = 100판 (1-1 ~ 10-10). 짝 수·추억 카드·미리 보기·시간 표는 levels.js
//  · 카드는 DOM(3D 뒤집기), 배경과 꽃가루 효과는 canvas
// 폰 세로: 세로 배치 (논리 폭 540) / 폰 가로·태블릿 가로·PC: 가로 배치 (논리 높이 540) — 화면을 돌리지 않고 카드 줄 수를 바꿈

let W = 540, H = 960;
const WORLDS = ['하늘도시', '숲속 나무마을', '겨울왕국', '석양의 항구', '벚꽃마을', '구름왕국', '바닷속도시', '마법숲', '별빛우주', '황금성'];
const { PER_WORLD, STAGES } = window.MemoryLevels; // 스테이지 i: { pairs, cards, scenes(추억 카드 쌍), preview(초), s(제한 초) }
const FRONTS = Array.from({ length: 18 }, (_, k) => `f${String(k).padStart(2, '0')}`); // 설명 자료의 카드 그림 18종
const SCENES = Array.from({ length: 36 }, (_, k) => `s${String(k).padStart(2, '0')}`); // 은유·은결 일상 그림 (추억 카드)
const SKIN_BG = { forest: 1, sunset: 1, winter: 2, night: 3, space: 4 }; // 공통 배경 스킨 → 사천성 배경 그림 (나머지는 skins.js로 그림)
const MISS_SHOW = 0.75;  // 틀린 두 장을 보여 주는 시간 (초)
const MISS_TIME = 0.2;   // 틀리면 줄어드는 시간 (초)
const label = (i) => `${Math.floor(i / PER_WORLD) + 1}-${(i % PER_WORLD) + 1}`;
const stageName = (i) => `${WORLDS[Math.floor(i / PER_WORLD)]} ${(i % PER_WORLD) + 1}`;
const ASSET_V = '202610280021';
const cardSrc = (n) => `assets/cards/${n}.webp?v=${ASSET_V}`;

// ---------- save (메인 화면 없이 단독 실행할 때) ----------
const Save = {
  data: { cleared: {}, sound: true },
  load() { try { Object.assign(this.data, JSON.parse(localStorage.getItem('memory_v1') || '{}')); } catch (e) { /* private mode */ } },
  store() { try { localStorage.setItem('memory_v1', JSON.stringify(this.data)); } catch (e) { /* ignore */ } },
};
Save.load();
const HUB = window.Hub && window.Hub.active() ? window.Hub : null;
if (HUB) Save.data.sound = HUB.settings.sound;
const unlocked = (i) => (HUB ? HUB.stageUnlocked('memory', i) : i === 0 || !!Save.data.cleared[i - 1]);
const nextStage = () => { if (HUB) return HUB.stageNext('memory'); for (let i = 0; i < STAGES.length; i++) if (!Save.data.cleared[i]) return i; return STAGES.length - 1; };
const GOD = () => !!(window.Hub && window.Hub.god); // 무적 쿠폰 (테스트용)

// ---------- utils ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const $ = (id) => document.getElementById(id);
const mmss = (t) => { t = Math.max(0, Math.ceil(t)); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
function shuffleArr(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------- images ----------
const BG = { port: new Image(), land: new Image(), skin: [] };
BG.port.src = `assets/bg/port.webp?v=${ASSET_V}`; BG.land.src = `assets/bg/land.webp?v=${ASSET_V}`;
for (let i = 0; i < 5; i++) { const im = new Image(); im.src = `../shisen/assets/bg/bg_${i}.webp?v=202610280021`; BG.skin.push(im); }
const BACK = `assets/cards/back.webp?v=${ASSET_V}`;
// 그림을 미리 받아 둠 (첫 판부터 뒤집을 때 바로 보이게)
[BACK, ...FRONTS.map(cardSrc)].forEach((s) => { const im = new Image(); im.src = s; });

// ---------- audio ----------
const Audio = {
  ctx: null, master: null, gain: null, bgm: null, bgmOn: false, timer: null, next: 0, step: 0,
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.gain = this.ctx.createGain(); this.gain.gain.value = 0.4; this.gain.connect(this.master);
      this.bgm = this.ctx.createGain(); this.bgm.gain.value = 0.1; this.bgm.connect(this.master);
      const b = this.ctx.createBuffer(1, 1, 22050), s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.master); s.start(0);
      this.applyMute();
      if (this.bgmOn && !this.timer) { this.bgmOn = false; this.startBgm(); }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  applyMute() { if (this.master) this.master.gain.value = Save.data.sound ? 1 : 0; },
  tone(f, d, type = 'sine', v = 0.4, slide = 0, when = 0, dest) {
    if (!this.ctx || !Save.data.sound) return;
    const t = this.ctx.currentTime + when, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(dest || this.gain); o.start(t); o.stop(t + d + 0.02);
  },
  sfx(n, k = 0) {
    switch (n) {
      case 'flip': this.tone(520, 0.07, 'triangle', 0.22, 260); break;
      case 'bad': this.tone(260, 0.14, 'square', 0.12, -80); break;
      case 'match': [784, 1046, 1318].forEach((f, i) => this.tone(f * (1 + Math.min(k, 8) * 0.04), 0.12, 'triangle', 0.3, 0, i * 0.05)); break;
      case 'hint': this.tone(1200, 0.2, 'sine', 0.25, 300); break;
      case 'peek': for (let i = 0; i < 6; i++) this.tone(500 + i * 120, 0.06, 'triangle', 0.15, 0, i * 0.04); break;
      case 'time': [880, 1175, 1568].forEach((f, i) => this.tone(f, 0.12, 'sine', 0.3, 0, i * 0.05)); break;
      case 'bomb': [660, 990, 1320, 1760].forEach((f, i) => this.tone(f, 0.1, 'square', 0.12, 0, i * 0.04)); break;
      case 'tick': this.tone(1500, 0.04, 'square', 0.1); break;
      case 'count': this.tone(880, 0.08, 'sine', 0.25); break;
      case 'go': [660, 990].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.3, 0, i * 0.08)); break;
      case 'clear': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.22, 'square', 0.16, 0, i * 0.11)); break;
      case 'fail': [523, 440, 349, 262].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.3, 0, i * 0.17)); break;
      case 'ui': this.tone(700, 0.06, 'triangle', 0.25); break;
    }
  },
  // 통통 튀는 뮤직박스 곡
  mel: [72, 76, 79, 76, 77, 0, 74, 0, 71, 74, 77, 74, 76, 0, 72, 0, 69, 72, 76, 72, 74, 0, 71, 72, 74, 0, 79, 0, 72, 0, 0, 0],
  bass: [48, 53, 55, 48, 45, 50, 43, 48],
  startBgm() {
    if (this.bgmOn || !this.ctx) { this.bgmOn = true; return; }
    this.bgmOn = true; this.next = this.ctx.currentTime + 0.1; clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (!this.ctx || !this.bgmOn) return;
      const sd = 60 / 112 / 2, mf = (n) => 440 * Math.pow(2, (n - 69) / 12);
      while (this.next < this.ctx.currentTime + 0.2) {
        const w = this.next - this.ctx.currentTime, m = this.mel[this.step % 32];
        if (m) this.tone(mf(m), sd * 1.4, 'sine', 0.32, 0, w, this.bgm);
        if (this.step % 4 === 0) this.tone(mf(this.bass[(this.step / 4) % 8]), sd * 3.5, 'triangle', 0.4, 0, w, this.bgm);
        this.next += sd; this.step++;
      }
    }, 40);
  },
  stopBgm() { this.bgmOn = false; clearInterval(this.timer); this.timer = null; },
};

// ---------- state ----------
const bgCv = $('bg'), bg = bgCv.getContext('2d'), fxCv = $('fx'), fx = fxCv.getContext('2d'), root = $('root'), boardEl = $('board');
let scale = 1, dpr = 1;
// 상태: ready → memo(미리 보기) → play → done(클리어/실패 연출) → result / pause
const G = {
  state: 'ready', si: 0, cards: [], open: [], busy: 0, time: 0, limit: 0, elapsed: 0, memoT: 0,
  coins: 0, combo: 0, maxCombo: 0, tries: 0, left: 0, comboX2: false, peekT: 0, hintT: 0,
  fx: [], t: 0, skin: 'default', tickT: 0, pausedFrom: 'play',
};

// ---------- board ----------
// 카드 한 장: { el, type(그림 이름), up(앞면), got(획득) }
function buildBoard(si) {
  const st = STAGES[si];
  const pics = [...shuffleArr(SCENES.slice()).slice(0, st.scenes), ...shuffleArr(FRONTS.slice()).slice(0, st.pairs - st.scenes)];
  const deck = shuffleArr([...pics, ...pics]);
  boardEl.innerHTML = '';
  G.cards = deck.map((type, k) => {
    const el = document.createElement('div');
    el.className = 'card deal'; el.style.animationDelay = `${k * 0.02}s`;
    el.innerHTML = `<div class="in"><div class="f bk"><img src="${BACK}" alt=""></div><div class="f fr"><img src="${cardSrc(type)}" alt=""></div></div>`;
    const c = { el, type, up: false, got: false };
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); Audio.unlock(); tap(c); });
    boardEl.appendChild(el);
    return c;
  });
  G.left = st.pairs;
  layoutBoard();
}
// 판 자리: 화면 모양에 맞춰 카드가 가장 크게 보이는 줄 수를 고름
const CARD_AR = 0.917, GAP = 0.09; // 카드 가로/세로, 카드 사이 틈(카드 폭 비율)
function boardArea() {
  const sl = parseFloat(getComputedStyle(root).getPropertyValue('--safe-l')) || 0, sr = parseFloat(getComputedStyle(root).getPropertyValue('--safe-r')) || 0;
  const st = parseFloat(getComputedStyle(root).getPropertyValue('--safe-t')) || 0, sb = parseFloat(getComputedStyle(root).getPropertyValue('--safe-b')) || 0;
  if (wideLayout()) return { x: 112 + sl, y: 64 + st, w: W - 112 - 14 - sl - sr, h: H - 64 - 48 - st - sb };
  return { x: 12, y: 150 + st, w: W - 24, h: H - 150 - 132 - st - sb };
}
function layoutBoard() {
  const n = G.cards.length; if (!n) return;
  const a = boardArea();
  let best = null;
  for (let c = 2; c <= n; c++) {
    const r = Math.ceil(n / c);
    if (r * c - n >= c) continue;
    const w = Math.min(a.w / (c + (c - 1) * GAP), (a.h / (r + (r - 1) * GAP * 1.1 / CARD_AR)) * CARD_AR);
    const sc = w - (r * c - n) * 0.8; // 빈 자리가 적은 쪽을 조금 더 좋게
    if (!best || sc > best.sc) best = { c, r, w, sc };
  }
  const cw = Math.min(best.w, wideLayout() ? 150 : 160), ch = cw / CARD_AR, g = cw * GAP;
  const { c, r } = best;
  const tw = c * cw + (c - 1) * g, th = r * ch + (r - 1) * g;
  const ox = a.x + (a.w - tw) / 2, oy = a.y + (a.h - th) / 2;
  G.cards.forEach((card, k) => {
    const row = Math.floor(k / c), inRow = row === r - 1 ? n - row * c : c; // 마지막 줄이 덜 차면 가운데로
    const col = k % c, rx = ox + (tw - (inRow * cw + (inRow - 1) * g)) / 2;
    const s = card.el.style;
    s.left = (rx + col * (cw + g)) + 'px'; s.top = (oy + row * (ch + g)) + 'px'; s.width = cw + 'px'; s.height = ch + 'px';
  });
  G.cardW = cw;
}
const setUp = (c, up) => { c.up = up; c.el.classList.toggle('up', up); };
const remaining = () => G.cards.filter((c) => !c.got);

// ---------- run ----------
function startStage(si) {
  G.si = si; const st = STAGES[si];
  clearTimers();
  G.limit = st.s; G.time = st.s; G.elapsed = 0; G.coins = 0; G.combo = 0; G.maxCombo = 0; G.tries = 0;
  G.open = []; G.busy = 0; G.fx = []; G.t = 0; G.comboX2 = false; G.peekT = 0; G.hintT = 0;
  if (HUB) HUB.starterKit('memory');
  G.skin = HUB ? HUB.equippedSkin('memory') : 'default';
  const boosts = HUB ? HUB.takeBoosts('memory') : [];
  if (boosts.includes('combo')) G.comboX2 = true;
  if (boosts.length) toast('부스트: ' + boosts.map((b) => HUB.boostName('memory', b)).join(' · '));
  $('hudStage').textContent = `스테이지 ${label(si)}`;
  buildBoard(si);
  renderItems(); renderBuffs();
  // 미리 보기: 카드가 깔리고 나면 모두 앞면으로 → 시간이 지나면 뒤집고 시작
  G.memoT = st.preview;
  setState('memo');
  later(() => { G.cards.forEach((c) => setUp(c, true)); Audio.sfx('flip'); }, 450 + G.cards.length * 20);
  Audio.startBgm();
}
function beginPlay() {
  G.cards.forEach((c) => setUp(c, false)); Audio.sfx('go');
  $('memo').classList.add('go'); $('memoT').textContent = '찾아요!'; $('memoN').textContent = '!';
  later(() => $('memo').classList.add('hidden'), 700);
  setState('play');
}
function showReady(si) {
  G.si = si; clearTimers(); boardEl.innerHTML = ''; G.cards = [];
  $('readyTitle').textContent = `${label(si)} ${stageName(si)}`;
  const st = STAGES[si];
  $('readyInfo').textContent = `카드 ${st.cards}장 (${st.pairs}쌍) · 미리 보기 ${st.preview}초 · 제한 시간 ${mmss(st.s)}`;
  setState('ready');
}
// 판이 바뀌거나 다시 하면 남아 있던 setTimeout 은 무시 (판 번호로 구분)
let runId = 0;
const timers = [];
function later(fn, ms) { const id = runId; timers.push(setTimeout(() => { if (id === runId) fn(); }, ms)); }
function clearTimers() { runId++; timers.forEach(clearTimeout); timers.length = 0; }

function tap(c) {
  if (G.state !== 'play' || c.got || c.up) return;
  // 틀린 두 장이 아직 앞면이면 바로 덮고 새 카드부터
  if (G.open.length >= 2) flipBackOpen();
  setUp(c, true); c.el.classList.add('sel'); G.open.push(c); G.tries++;
  Audio.sfx('flip');
  if (G.open.length === 2) judge();
}
function judge() {
  const [a, b] = G.open;
  if (a.type === b.type) { gotPair(a, b); return; }
  G.combo = 0; Audio.sfx('bad');
  G.time = Math.max(0, G.time - MISS_TIME);
  const pa = centerOf(a), pb = centerOf(b);
  G.fx.push({ kind: 'text', text: `-${MISS_TIME}초`, x: (pa.x + pb.x) / 2, y: Math.min(pa.y, pb.y) - 10, t: 0, life: 0.9, bad: true });
  later(() => { a.el.classList.add('bad'); b.el.classList.add('bad'); }, 180);
  const pair = G.open.slice();
  later(() => { if (G.open[0] === pair[0] && G.open[1] === pair[1]) flipBackOpen(); }, MISS_SHOW * 1000);
}
function flipBackOpen() {
  for (const c of G.open) { if (!c.got) setUp(c, false); c.el.classList.remove('sel', 'bad'); }
  G.open = [];
}
function gotPair(a, b, byItem = false) {
  G.open = G.open.filter((c) => c !== a && c !== b);
  for (const c of [a, b]) { c.got = true; setUp(c, true); c.el.classList.remove('sel', 'hint', 'bad'); }
  G.left--;
  // 콤보 & 코인 (짝 1개 = 2코인, 연속으로 찾으면 +1, 콤보 보너스 부스트면 콤보 코인 2배)
  if (!byItem) G.combo++; else G.combo = 0;
  G.maxCombo = Math.max(G.maxCombo, G.combo);
  const bonus = G.combo >= 2 ? (G.comboX2 ? 2 : 1) : 0;
  if (!GOD()) G.coins += 2 + bonus; // 무적: 코인 0
  Audio.sfx('match', G.combo);
  const pa = centerOf(a), pb = centerOf(b);
  burst(pa.x, pa.y); burst(pb.x, pb.y);
  if (G.combo >= 2) G.fx.push({ kind: 'text', text: `${G.combo} 콤보!`, x: (pa.x + pb.x) / 2, y: Math.min(pa.y, pb.y) - 20, t: 0, life: 0.9 });
  later(() => { for (const c of [a, b]) { c.el.style.animationDelay = '0s'; c.el.classList.add('got'); } }, 260);
  if (G.left <= 0) later(clearStage, 700);
}
function centerOf(c) { const s = c.el.style; return { x: parseFloat(s.left) + parseFloat(s.width) / 2, y: parseFloat(s.top) + parseFloat(s.height) / 2 }; }
function burst(x, y) {
  const cols = ['#FFD34D', '#FFB5C5', '#79C89C', '#5CA9E6', '#C9A8FF', '#fff'];
  for (let i = 0; i < 12; i++) {
    const an = Math.random() * Math.PI * 2, sp = 90 + Math.random() * 140;
    G.fx.push({ kind: 'spark', x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 60, c: cols[i % cols.length], r: 3 + Math.random() * 4, t: 0, life: 0.6 + Math.random() * 0.3 });
  }
}

// ---------- items ----------
// 힌트: 지금 뒤집은 카드가 있으면 그 짝을, 없으면 아무 짝 하나를 잠깐 보여 줌
// 모두 보기: 남은 카드를 2초 동안 모두 앞면으로 / 시간 추가: +10초 / 짝 맞추기: 짝 하나를 바로 찾아 줌
const itemCount = (id) => (HUB ? HUB.boostCount('memory', id) : G.items[id]);
function spendItem(id) {
  if (HUB) return HUB.useBoost('memory', id);
  if (G.items[id] <= 0) return false;
  G.items[id]--; return true;
}
function pickPair() {
  const rest = remaining();
  const one = G.open.length === 1 ? G.open[0] : rest[Math.floor(Math.random() * rest.length)];
  if (!one) return null;
  const two = rest.find((c) => c !== one && c.type === one.type);
  return two ? [one, two] : null;
}
function useHint() {
  if (G.state !== 'play') return;
  if (itemCount('hint') <= 0) { toast('힌트가 없어요. 아이템샵에서 살 수 있어요'); Audio.sfx('bad'); return; }
  if (G.open.length >= 2) flipBackOpen();
  const p = pickPair(); if (!p) return;
  spendItem('hint'); Audio.sfx('hint'); renderItems();
  const show = p.filter((c) => !c.up);
  for (const c of p) c.el.classList.add('hint');
  for (const c of show) setUp(c, true);
  G.busy++;
  later(() => {
    G.busy--;
    for (const c of p) { c.el.classList.remove('hint'); if (!c.got && !G.open.includes(c)) setUp(c, false); }
  }, 1400);
}
function usePeek() {
  if (G.state !== 'play') return;
  if (itemCount('find') <= 0) { toast('모두 보기가 없어요. 아이템샵에서 살 수 있어요'); Audio.sfx('bad'); return; }
  if (G.open.length >= 2) flipBackOpen();
  spendItem('find'); Audio.sfx('peek'); renderItems();
  remaining().forEach((c) => setUp(c, true));
  G.busy++; G.peekT = 2;
  later(() => { G.busy--; G.peekT = 0; remaining().forEach((c) => { if (!G.open.includes(c)) setUp(c, false); }); }, 2000);
}
function useTime() {
  if (G.state !== 'play') return;
  if (itemCount('time') <= 0) { toast('시간 추가가 없어요. 아이템샵에서 살 수 있어요'); Audio.sfx('bad'); return; }
  spendItem('time'); G.time += 10; Audio.sfx('time'); renderItems();
  G.fx.push({ kind: 'text', text: '+10초', x: W / 2, y: H * 0.42, t: 0, life: 1, big: true });
}
function useBomb() {
  if (G.state !== 'play' || itemCount('bomb') <= 0) return;
  if (G.open.length >= 2) flipBackOpen();
  const p = pickPair(); if (!p) return;
  spendItem('bomb'); Audio.sfx('bomb'); renderItems();
  gotPair(p[0], p[1], true);
}

// ---------- end ----------
function stars() { const r = G.time / G.limit; return r >= 0.5 ? 3 : r >= 0.25 ? 2 : 1; }
function clearStage() {
  if (G.state !== 'play') return;
  setState('done'); Audio.sfx('clear'); Audio.stopBgm();
  const st = stars();
  for (let i = 0; i < 50; i++) G.fx.push({ kind: 'confetti', x: Math.random() * W, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 80, vy: 120 + Math.random() * 160, r: Math.random() * 6, c: ['#FFB5C5', '#FFD34D', '#79C89C', '#5CA9E6', '#C9A8FF'][i % 5], t: 0, life: 3 });
  let earn = null, reward = [];
  if (HUB) {
    earn = HUB.record('memory', { stage: G.si, cleared: true, dist: 0, coins: G.coins, stars: st, time: Math.round(G.elapsed) });
    reward = earn.god ? [] : clearReward(st, earn.firstClear);
  } else { Save.data.cleared[G.si] = true; Save.store(); }
  later(() => showResult(true, st, earn, reward), 900);
}
// 클리어 보상 아이템 (캐릭터 보유 수량에 바로 더해짐)
//  · 처음 깬 판: 힌트·모두 보기·시간 추가 중 1개  · 별 3개: 힌트 1개  · 월드 마지막 판(N-10) 처음 깨면: 짝 맞추기 1개
function clearReward(st, first) {
  const got = [];
  const give = (id) => { HUB.addBoost('memory', id, 1); got.push(id); };
  if (first) give(['hint', 'find', 'time'][Math.floor(Math.random() * 3)]);
  if (st >= 3) give('hint');
  if (first && G.si % PER_WORLD === PER_WORLD - 1) give('bomb');
  return got;
}
function failStage() {
  setState('done'); Audio.sfx('fail'); Audio.stopBgm();
  flipBackOpen(); remaining().forEach((c) => setUp(c, true)); // 남은 카드가 어디 있었는지 보여 줌
  let earn = null;
  if (HUB) earn = HUB.record('memory', { stage: G.si, cleared: false, dist: 0, coins: G.coins, stars: 0 });
  later(() => showResult(false, 0, earn), 1100);
}
const ITEM_NAME = { hint: '💡 힌트', find: '🔍 모두 보기', time: '⏱ 시간 추가', bomb: '💥 짝 맞추기' };
function showResult(ok, st, earn, reward = []) {
  $('resTitle').textContent = ok ? '스테이지 클리어!' : '시간 초과!';
  document.querySelector('.panel.result').classList.toggle('fail', !ok);
  $('resStars').innerHTML = [0, 1, 2].map((k) => `<span class="${k < st ? '' : 'off'}">★</span>`).join('');
  $('resTime').textContent = ok ? mmss(G.elapsed) : '-';
  $('resTries').textContent = `${G.tries}장`;
  $('resCombo').textContent = G.maxCombo;
  $('resCoin').textContent = G.coins;
  $('resEarn').classList.toggle('hidden', !earn);
  if (earn) {
    const cnt = {}; reward.forEach((id) => { cnt[id] = (cnt[id] || 0) + 1; });
    const items = Object.entries(cnt).map(([id, n]) => `${ITEM_NAME[id]} +${n}`).join(' · ');
    $('resEarn').innerHTML = `+${earn.earned} 코인 획득!` + (earn.bonus ? ` <small>(클리어 보너스 +${earn.bonus}${earn.firstClear ? ', 첫 클리어!' : ''})</small>` : '') + `<small>내 코인 ${earn.coins}</small>`
      + (items ? `<div class="reward">🎁 보상 아이템: ${items}</div>` : '');
  }
  const hasNext = ok && G.si < STAGES.length - 1;
  $('btnNext').classList.toggle('hidden', !hasNext);
  // 다음 스테이지가 없으면 다시하기가 그 자리(한 줄 전체·크게)로
  const rb = $('btnRetry');
  if (hasNext) $('resRow').prepend(rb); else $('btnNext').after(rb);
  rb.className = 'btn ' + (hasNext ? 'blue' : 'gold big');
  setState('result');
}

// ---------- update ----------
function step(dt) {
  G.t += dt;
  for (const f of G.fx) { f.t += dt; if (f.vx != null) { f.x += f.vx * dt; f.y += f.vy * dt; if (f.kind === 'spark') f.vy += 320 * dt; } }
  G.fx = G.fx.filter((f) => f.t < f.life);
  if (G.state === 'memo') {
    // 카드가 다 앞면이 된 뒤부터 미리 보기 시간을 셈
    if (!G.cards.length || !G.cards[0].up) return;
    const before = Math.ceil(G.memoT);
    G.memoT -= dt;
    const now = Math.ceil(G.memoT);
    $('memo').classList.remove('hidden', 'go'); $('memoT').textContent = '기억해요!'; $('memoN').textContent = Math.max(1, now);
    if (now !== before && now > 0) Audio.sfx('count');
    if (G.memoT <= 0) beginPlay();
    return;
  }
  if (G.state !== 'play') return;
  G.elapsed += dt; G.time -= dt;
  if (G.time < 10) { G.tickT -= dt; if (G.tickT <= 0) { G.tickT = 1; Audio.sfx('tick'); } }
  if (G.time <= 0 && GOD()) G.time = G.limit; // 무적: 시간이 다 되면 다시 채움
  if (G.time <= 0) { G.time = 0; failStage(); }
}

// ---------- render (배경 + 효과) ----------
function drawBg() {
  bg.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  const drawn = SKIN_BG[G.skin] == null && G.skin && G.skin !== 'default' && window.Skins && window.Skins.has(G.skin);
  const img = SKIN_BG[G.skin] != null ? BG.skin[SKIN_BG[G.skin]] : (W > H ? BG.land : BG.port);
  if (drawn) window.Skins.draw(bg, G.skin, W, H, 0, 0, G.t);
  else if (img && img.complete && img.naturalWidth) {
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const bw = img.naturalWidth * s, bh = img.naturalHeight * s;
    bg.drawImage(img, (W - bw) / 2, (H - bh) * 0.6, bw, bh);
  } else { bg.fillStyle = '#8CC9F0'; bg.fillRect(0, 0, W, H); }
  const g = bg.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(20,40,80,.28)'); g.addColorStop(0.5, 'rgba(20,40,80,.06)'); g.addColorStop(1, 'rgba(20,40,80,.3)');
  bg.fillStyle = g; bg.fillRect(0, 0, W, H);
  // 카드 판 받침
  if (G.cards.length && G.cardW) {
    const xs = G.cards.map((c) => parseFloat(c.el.style.left)), ys = G.cards.map((c) => parseFloat(c.el.style.top));
    const cw = G.cardW, ch = cw / CARD_AR, pad = cw * 0.22;
    const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, x1 = Math.max(...xs) + cw + pad, y1 = Math.max(...ys) + ch + pad;
    bg.fillStyle = 'rgba(255,250,240,.38)'; bg.strokeStyle = 'rgba(255,255,255,.75)'; bg.lineWidth = 3;
    bg.beginPath(); bg.roundRect(x0, y0, x1 - x0, y1 - y0, 22); bg.fill(); bg.stroke();
  }
}
function drawFx() {
  fx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  fx.clearRect(0, 0, W, H);
  for (const f of G.fx) {
    const k = f.t / f.life;
    if (f.kind === 'confetti') { fx.save(); fx.globalAlpha = Math.min(1, (1 - k) * 2); fx.fillStyle = f.c; fx.translate(f.x, f.y); fx.rotate(f.t * 6 + f.r); fx.fillRect(-5, -3, 10, 6); fx.restore(); continue; }
    if (f.kind === 'spark') { fx.globalAlpha = 1 - k; fx.fillStyle = f.c; fx.beginPath(); fx.arc(f.x, f.y, f.r * (1 - k * 0.5), 0, Math.PI * 2); fx.fill(); fx.globalAlpha = 1; continue; }
    if (f.kind === 'text') {
      fx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
      fx.font = `${f.big ? 48 : 30}px Jua, sans-serif`; fx.textAlign = 'center'; fx.textBaseline = 'middle';
      fx.lineWidth = 6; fx.strokeStyle = f.bad ? '#7A0E1E' : '#7A3E00'; fx.strokeText(f.text, f.x, f.y - k * 30);
      fx.fillStyle = f.bad ? '#FF6B7E' : '#FFE07A'; fx.fillText(f.text, f.x, f.y - k * 30);
      fx.globalAlpha = 1;
    }
  }
}

// ---------- HUD ----------
let lastKey = '';
function updateHud() {
  const key = `${Math.ceil(G.time)}|${G.coins}|${G.left}`;
  if (key !== lastKey) {
    lastKey = key;
    $('hudTime').textContent = mmss(G.time); $('hudCoin').textContent = G.coins; $('hudLeft').textContent = G.left;
    $('timerPill').classList.toggle('warn', G.time < 10 && G.state === 'play');
  }
  const r = clamp(G.time / G.limit, 0, 1);
  $('starFill').style.width = (r * 100) + '%';
  document.querySelector('.starbar .s2').classList.toggle('off', r < 0.25);
  document.querySelector('.starbar .s3').classList.toggle('off', r < 0.5);
}
function renderItems() {
  const set = (id, cid, n) => { $(cid).textContent = n; $(id).classList.toggle('empty', n <= 0); };
  set('btnHint', 'cHint', itemCount('hint')); set('btnPeek', 'cPeek', itemCount('find')); set('btnTime', 'cTime', itemCount('time'));
  $('btnBomb').classList.toggle('hidden', itemCount('bomb') <= 0); $('cBomb').textContent = itemCount('bomb');
}
function renderBuffs() {
  const el = $('buffs'); el.innerHTML = '';
  if (G.comboX2) { const d = document.createElement('div'); d.className = 'buff'; d.textContent = '🌈 콤보 2배'; el.appendChild(d); }
}
let toastT = 0;
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.add('hidden'), 1600); }

// ---------- screens ----------
function setState(s) {
  G.state = s;
  $('ready').classList.toggle('hidden', s !== 'ready');
  $('pause').classList.toggle('hidden', s !== 'pause');
  $('result').classList.toggle('hidden', s !== 'result');
  $('hud').classList.toggle('hidden', !['memo', 'play', 'pause', 'done'].includes(s));
  if (s !== 'memo' && s !== 'play' && s !== 'pause') $('memo').classList.add('hidden');
}
function pauseGame() { if (G.state === 'play' || G.state === 'memo') { G.pausedFrom = G.state; setState('pause'); Audio.stopBgm(); } }
function resumeGame() { if (G.state === 'pause') { setState(G.pausedFrom); Audio.startBgm(); last = performance.now(); } }
function goMap() { clearTimers(); Audio.stopBgm(); location.href = HUB ? '../index.html#map-memory' : '../index.html'; }

// ---------- input ----------
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
window.addEventListener('keydown', (e) => {
  Audio.unlock();
  if (e.code === 'KeyH') useHint(); else if (e.code === 'KeyA') usePeek(); else if (e.code === 'KeyT') useTime(); else if (e.code === 'KeyB') useBomb();
  else if (e.code === 'Escape' || e.code === 'KeyP') { if (G.state === 'play' || G.state === 'memo') pauseGame(); else if (G.state === 'pause') resumeGame(); }
  else if ((e.code === 'Enter' || e.code === 'Space') && G.state === 'ready') { e.preventDefault(); $('btnGo').click(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('blur', () => pauseGame());
const click = (id, fn) => $(id).addEventListener('click', () => { Audio.unlock(); Audio.sfx('ui'); fn(); });
click('btnGo', () => startStage(G.si));
click('btnReadyMap', goMap); click('btnMapP', goMap); click('btnMapR', goMap);
click('btnPause', pauseGame); click('btnResume', resumeGame);
click('btnRetryP', () => startStage(G.si)); click('btnRetry', () => startStage(G.si));
click('btnNext', () => showReady(Math.min(STAGES.length - 1, G.si + 1)));
$('btnHint').addEventListener('click', () => { Audio.unlock(); useHint(); });
$('btnPeek').addEventListener('click', () => { Audio.unlock(); usePeek(); });
$('btnTime').addEventListener('click', () => { Audio.unlock(); useTime(); });
$('btnBomb').addEventListener('click', () => { Audio.unlock(); useBomb(); });
G.items = { hint: 3, find: 1, time: 1, bomb: 0 }; // 단독 실행일 때 기본 수량

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
  const ox = (vw - W * scale) / 2, oy = (vh - H * scale) / 2;
  root.style.transform = `translate(${ox}px, ${oy}px) scale(${scale})`;
  for (const k of ['l', 'r', 't', 'b']) root.style.setProperty('--safe-' + k, Math.max(0, (inset[k] - (k === 'l' || k === 'r' ? ox : oy)) / scale) + 'px');
  for (const cv of [bgCv, fxCv]) { cv.width = Math.round(W * scale * dpr); cv.height = Math.round(H * scale * dpr); }
  layoutBoard();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000; last = now; if (dt > 0.05) dt = 0.05; if (dt < 0) dt = 0;
  step(dt);
  if (['memo', 'play', 'done', 'pause'].includes(G.state)) updateHud();
  drawBg(); drawFx();
  requestAnimationFrame(frame);
}
resize();
{
  const q = new URLSearchParams(location.search);
  let si = parseInt(q.get('stage'), 10);
  if (!(si >= 0 && si < STAGES.length) || !unlocked(si)) si = nextStage();
  showReady(si);
  if (q.get('go') === '1') startStage(si); // 인트로 START: 준비 창 없이 바로
}
requestAnimationFrame(frame);

// debug/test hook
window.__memory = { G, startStage, STAGES, useHint, usePeek, useTime, useBomb, tap, showResult, layoutBoard };
