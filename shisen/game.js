'use strict';
// 은유와 은결의 사천성 — 같은 그림 타일 2개를 선으로 이어 없애는 퍼즐 (HTML5 Canvas)
//  · 선은 최대 2번까지 꺾을 수 있고, 다른 타일을 지나갈 수 없다 (보드 바깥 테두리는 지나갈 수 있음)
//  · 제한 시간 안에 모든 타일을 없애면 클리어 → 남은 시간으로 별 1~3개
//  · 징검다리: 10개 월드 × 10판 = 100판 (1-1 ~ 10-10). 판 크기·시간 표는 levels.js
// 폰: 세로 화면 (가로로 들면 화면을 돌려서 세로 유지) / PC: 창 전체를 쓰는 가로 화면 (보드도 가로로 눕힘)

let W = 540, H = 960;
const BASE_TILES = ['strawberry', 'banana', 'grape', 'cherry', 'orange', 'peach', 'watermelon', 'carrot', 'corn', 'mushroom',
  'clover', 'flower', 'star', 'heart', 'leaf', 'snowflake', 'sun', 'cloud', 'moon', 'cat', 'dog', 'paw'].map((n) => 't_' + n);
// 10개 월드 × 10판 = 100판. 월드 5~10은 그 월드 전용 그림 타일(14종)을 먼저 쓰고, 은유·은결 얼굴 타일은 항상 들어감
const WORLDS = ['하늘도시', '숲속 나무마을', '겨울왕국', '석양의 항구', '벚꽃마을', '구름왕국', '바닷속도시', '마법숲', '별빛우주', '황금성'];
const { PER_WORLD, STAGES } = window.ShisenLevels; // 스테이지 i: { c, r(판 크기), tiles, t(그림 종류), s(제한 초) }
function tilePool(si) {
  const w = Math.floor(si / PER_WORLD);
  const themed = w >= 4 ? Array.from({ length: 14 }, (_, k) => `w${w + 1}_${k}`).filter((n) => !(w === 4 && (n === 'w5_2' || n === 'w5_3'))) : [];
  return ['t_eunyu', 't_eungyeol', ...shuffleArr(themed), ...shuffleArr(BASE_TILES.slice())];
}
const SKIN_BG = { forest: 1, sunset: 1, winter: 2, night: 3, space: 4 }; // 공통 배경 스킨 → assets/bg_*.jpg (나머지는 skins.js로 그림)
const COMBO_WINDOW = 4;  // 초: 이 안에 다음 짝을 없애면 콤보
const label = (i) => `${Math.floor(i / PER_WORLD) + 1}-${(i % PER_WORLD) + 1}`;
const stageName = (i) => `${WORLDS[Math.floor(i / PER_WORLD)]} ${(i % PER_WORLD) + 1}`;

// ---------- save (메인 화면 없이 단독 실행할 때) ----------
const Save = {
  data: { cleared: {}, sound: true },
  load() { try { Object.assign(this.data, JSON.parse(localStorage.getItem('shisen_v1') || '{}')); } catch (e) { /* private mode */ } },
  store() { try { localStorage.setItem('shisen_v1', JSON.stringify(this.data)); } catch (e) { /* ignore */ } },
};
Save.load();
const HUB = window.Hub && window.Hub.active() ? window.Hub : null;
if (HUB) Save.data.sound = HUB.settings.sound;
const unlocked = (i) => (HUB ? HUB.stageUnlocked('shisen', i) : i === 0 || !!Save.data.cleared[i - 1]);
const nextStage = () => { if (HUB) return HUB.stageNext('shisen'); for (let i = 0; i < STAGES.length; i++) if (!Save.data.cleared[i]) return i; return STAGES.length - 1; };

// ---------- utils ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const $ = (id) => document.getElementById(id);
const mmss = (t) => { t = Math.max(0, Math.ceil(t)); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
function shuffleArr(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------- sprites ----------
const ASSET_V = '20261022n';
const SP = { img: new Image(), f: null, ready: false, bg: [] };
fetch(`assets/sprites.json?v=${ASSET_V}`).then((r) => r.json()).then((j) => { SP.f = j; SP.img.onload = () => { SP.ready = true; }; SP.img.src = `assets/sprites.webp?v=${ASSET_V}`; });
for (let i = 0; i < 5; i++) { const im = new Image(); im.src = `assets/bg_${i}.jpg?v=${ASSET_V}`; SP.bg.push(im); }
// 월드 배경 (메인 화면 지도와 같은 그림)
SP.world = WORLDS.map((_, w) => { const im = new Image(); im.src = `../common/worlds/w${w + 1}.jpg?v=${ASSET_V}`; return im; });
function spr(name, x, y, w, h, alpha = 1) {
  if (!SP.ready || !SP.f[name]) return;
  const [sx, sy, sw, sh] = SP.f[name];
  if (h == null) h = w * sh / sw;
  ctx.globalAlpha = alpha; ctx.drawImage(SP.img, sx, sy, sw, sh, x - w / 2, y - h / 2, w, h); ctx.globalAlpha = 1;
}

// 내 캐릭터 얼굴 타일은 입은 옷 모습으로 (타일 판은 그대로, 안쪽 그림만 바꿈)
const MY_LOOK = HUB ? HUB.active().look : null;
// 새 캐릭터(v2)는 같은 계열 기본 캐릭터 타일 자리에 v2 얼굴을 넣음
const MY_TILE = MY_LOOK ? 't_' + (window.CharV2 ? CharV2.base(MY_LOOK) : MY_LOOK) : null;
function drawTile(name, x, y, w, h, alpha = 1) {
  spr(name, x, y, w, h, alpha);
  if (name === MY_TILE && window.CharV2 && CharV2.is(MY_LOOK) && CharV2.ready(MY_LOOK)) {
    ctx.save(); ctx.globalAlpha = alpha;
    // 기본 타일 얼굴과 같은 크기로 (타일 안쪽 판을 거의 다 채움)
    ctx.beginPath(); ctx.roundRect(x - w * 0.42, y - h * 0.41, w * 0.84, h * 0.8, w * 0.12); ctx.clip();
    ctx.fillStyle = '#FFF6E8'; ctx.fillRect(x - w / 2, y - h / 2, w, h);
    CharV2.drawCenter(ctx, MY_LOOK, 'tile_face', x, y - h * 0.02, w * 1.02);
    ctx.restore(); return;
  }
  if (name !== MY_TILE || !window.Costume || !Costume.ready()) return;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.roundRect(x - w * 0.36, y - h * 0.38, w * 0.72, h * 0.72, w * 0.1); ctx.clip();
  ctx.fillStyle = '#FFF6E8'; ctx.fillRect(x - w / 2, y - h / 2, w, h);
  const im = Costume.img, frac = 0.6, bh = h * 0.70, bw = bh * im.naturalWidth / (im.naturalHeight * frac);
  ctx.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight * frac, x - bw / 2, y - h / 2 + h * 0.13, bw, bh);
  ctx.restore();
}

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
      case 'pick': this.tone(660, 0.06, 'triangle', 0.25); break;
      case 'bad': this.tone(220, 0.12, 'square', 0.15, -60); break;
      case 'match': [784, 1046, 1318].forEach((f, i) => this.tone(f * (1 + Math.min(k, 8) * 0.04), 0.12, 'triangle', 0.3, 0, i * 0.04)); break;
      case 'hint': this.tone(1200, 0.2, 'sine', 0.25, 300); break;
      case 'shuffle': for (let i = 0; i < 6; i++) this.tone(400 + i * 90, 0.05, 'square', 0.1, 0, i * 0.03); break;
      case 'time': [880, 1175, 1568].forEach((f, i) => this.tone(f, 0.12, 'sine', 0.3, 0, i * 0.05)); break;
      case 'bomb': this.tone(180, 0.4, 'sawtooth', 0.2, -120); break;
      case 'tick': this.tone(1500, 0.04, 'square', 0.1); break;
      case 'clear': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.22, 'square', 0.16, 0, i * 0.11)); break;
      case 'fail': [523, 440, 349, 262].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.3, 0, i * 0.17)); break;
      case 'ui': this.tone(700, 0.06, 'triangle', 0.25); break;
    }
  },
  // pentatonic garden tune
  mel: [67, 0, 69, 72, 74, 0, 72, 69, 67, 0, 64, 67, 69, 0, 0, 0, 72, 0, 74, 76, 79, 0, 76, 74, 72, 0, 69, 72, 74, 0, 0, 0],
  bass: [48, 55, 52, 55, 45, 52, 48, 55],
  startBgm() {
    if (this.bgmOn || !this.ctx) { this.bgmOn = true; return; }
    this.bgmOn = true; this.next = this.ctx.currentTime + 0.1; clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (!this.ctx || !this.bgmOn) return;
      const sd = 60 / 104 / 2, mf = (n) => 440 * Math.pow(2, (n - 69) / 12);
      while (this.next < this.ctx.currentTime + 0.2) {
        const w = this.next - this.ctx.currentTime, m = this.mel[this.step % 32];
        if (m) this.tone(mf(m), sd * 1.6, 'triangle', 0.3, 0, w, this.bgm);
        if (this.step % 4 === 0) this.tone(mf(this.bass[(this.step / 4) % 8]), sd * 3.5, 'sine', 0.5, 0, w, this.bgm);
        this.next += sd; this.step++;
      }
    }, 40);
  },
  stopBgm() { this.bgmOn = false; clearInterval(this.timer); this.timer = null; },
};

// ---------- state ----------
const canvas = $('game'), ctx = canvas.getContext('2d'), root = $('root');
let scale = 1, dpr = 1;
const G = {
  state: 'ready', si: 0, cols: 4, rows: 6, grid: [], sel: null, time: 0, limit: 0, elapsed: 0,
  coins: 0, combo: 0, maxCombo: 0, lastMatchT: -99, left: 0,
  items: { hint: 3, shuffle: 2, time: 1, bomb: 0 }, hint: null, hintT: 0, hintBig: false, findT: 0, comboX2: false,
  lines: [], fx: [], texts: [], removing: [], t: 0, skin: 'default', shake: 0, tickT: 0,
};

// grid[y][x] = tile type index or -1. Coordinates are in the board's own orientation.
function cellAt(x, y) { return (x < 0 || y < 0 || x >= G.cols || y >= G.rows) ? -1 : G.grid[y][x]; }

// 0-1 BFS: path from a to b with at most 2 turns, walking only over empty cells (and the ring outside the board)
function findPath(a, b) {
  const C = G.cols + 2, R = G.rows + 2;
  const free = (x, y) => (x === b.x && y === b.y) || cellAt(x, y) === -1;
  const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
  const key = (x, y, d) => ((y + 1) * C + (x + 1)) * 4 + d;
  const cost = new Map(), prev = new Map();
  const dq = [];
  for (let d = 0; d < 4; d++) { const k = key(a.x, a.y, d); cost.set(k, 0); dq.push([a.x, a.y, d, 0]); }
  while (dq.length) {
    const [x, y, d, c] = dq.shift();
    if (c > (cost.get(key(x, y, d)) ?? 99)) continue;
    // keep going straight (no extra turn)
    const nx = x + DX[d], ny = y + DY[d];
    if (nx >= -1 && ny >= -1 && nx <= G.cols && ny <= G.rows && free(nx, ny)) {
      const k = key(nx, ny, d);
      if (c < (cost.get(k) ?? 99)) {
        cost.set(k, c); prev.set(k, key(x, y, d)); dq.unshift([nx, ny, d, c]);
        if (nx === b.x && ny === b.y) return buildPath(k, prev, C);
      }
    }
    // turn (costs one)
    if (c < 2) for (let d2 = 0; d2 < 4; d2++) {
      if (d2 === d) continue;
      const k = key(x, y, d2);
      if (c + 1 < (cost.get(k) ?? 99)) { cost.set(k, c + 1); prev.set(k, key(x, y, d)); dq.push([x, y, d2, c + 1]); }
    }
  }
  return null;
}
function buildPath(k, prev, C) {
  const pts = [];
  let cur = k;
  while (cur != null) {
    const cell = Math.floor(cur / 4), x = (cell % C) - 1, y = Math.floor(cell / C) - 1;
    const last = pts[pts.length - 1];
    if (!last || last.x !== x || last.y !== y) pts.push({ x, y });
    cur = prev.get(cur);
  }
  pts.reverse();
  // keep only the corners
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
    if ((b.x - a.x) * (c.y - b.y) !== (b.y - a.y) * (c.x - b.x)) out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
function anyPair() {
  const byType = {};
  for (let y = 0; y < G.rows; y++) for (let x = 0; x < G.cols; x++) { const t = cellAt(x, y); if (t >= 0) (byType[t] = byType[t] || []).push({ x, y }); }
  for (const list of Object.values(byType)) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const p = findPath(list[i], list[j]); if (p) return [list[i], list[j], p];
  }
  return null;
}

// ---------- board ----------
// 끝까지 풀리는 순서가 있게 그림을 놓음 (levels.js deal)
function buildBoard(si) {
  const st = STAGES[si];
  const portrait = !wideLayout(); // PC 가로 화면: 판을 눕힘
  G.cols = portrait ? st.c : st.r; G.rows = portrait ? st.r : st.c;
  G.pool = tilePool(si).slice(0, st.t);
  const pairs = st.tiles / 2, pairTypes = [];
  for (let p = 0; p < pairs; p++) pairTypes.push(p % G.pool.length);
  const full = Array.from({ length: G.rows }, () => new Array(G.cols).fill(true));
  G.grid = ShisenLevels.deal(full, pairTypes);
  G.left = pairs;
}
// 섞기: 남은 타일 자리는 그대로 두고 그림만 다시 놓음 — 이번에도 끝까지 풀리는 순서가 있게
function reshuffle() {
  const filled = G.grid.map((row) => row.map((t) => t >= 0)), cnt = {};
  G.grid.forEach((row) => row.forEach((t) => { if (t >= 0) cnt[t] = (cnt[t] || 0) + 1; }));
  const pairTypes = [];
  for (const [t, n] of Object.entries(cnt)) for (let k = 0; k < n / 2; k++) pairTypes.push(+t);
  const grid = ShisenLevels.deal(filled, pairTypes);
  if (grid) G.grid = grid;
  G.sel = null; G.hint = null;
}

// ---------- run ----------
function startStage(si) {
  G.si = si; const st = STAGES[si];
  buildBoard(si);
  G.limit = st.s; G.time = st.s; G.elapsed = 0; G.coins = 0; G.combo = 0; G.maxCombo = 0; G.lastMatchT = -99;
  // 도움 아이템: 메인 화면에서 들어오면 캐릭터가 가진 수량을 그대로 씀(판이 바뀌어도 다시 채워지지 않음)
  // 단독 실행일 때만 판마다 기본 수량을 줌
  G.items = { hint: 3, shuffle: 2, time: 1, bomb: 0 }; G.hint = null; G.hintT = 0; G.hintBig = false; G.findT = 0; G.comboX2 = false;
  if (HUB) HUB.starterKit('shisen');
  G.lines = []; G.fx = []; G.texts = []; G.removing = []; G.sel = null; G.t = 0;
  G.skin = HUB ? HUB.equippedSkin('shisen') : 'default';
  const boosts = HUB ? HUB.takeBoosts('shisen') : [];
  if (boosts.includes('find')) G.findT = 20;
  if (boosts.includes('combo')) G.comboX2 = true;
  if (boosts.length) toast('부스트: ' + boosts.map((b) => HUB.boostName('shisen', b)).join(' · '));
  $('hudStage').textContent = `스테이지 ${label(si)}`;
  renderItems(); renderBuffs();
  setState('play');
  Audio.startBgm();
}
function showReady(si) {
  G.si = si;
  $('readyTitle').textContent = `${label(si)} ${stageName(si)}`;
  const st = STAGES[si];
  $('readyInfo').textContent = `${st.c}×${st.r} 판 · 타일 ${st.tiles}개 · 그림 ${st.t}종 · 제한 시간 ${mmss(st.s)}`;
  G.cols = 0; setState('ready');
}

function select(x, y) {
  if (G.state !== 'play' || cellAt(x, y) < 0) return;
  const s = G.sel;
  if (!s) { G.sel = { x, y }; Audio.sfx('pick'); return; }
  if (s.x === x && s.y === y) { G.sel = null; return; }
  if (cellAt(s.x, s.y) !== cellAt(x, y)) { G.sel = { x, y }; Audio.sfx('pick'); return; }
  const path = findPath(s, { x, y });
  if (!path) { Audio.sfx('bad'); G.sel = { x, y }; toast('선이 2번 넘게 꺾이거나 막혀 있어요'); return; }
  removePair(s, { x, y }, path);
}
function removePair(a, b, path, byBomb = false) {
  const t = cellAt(a.x, a.y);
  G.grid[a.y][a.x] = -1; G.grid[b.y][b.x] = -1; G.left--; G.sel = null;
  if (G.hint && (same(G.hint[0], a) || same(G.hint[0], b) || same(G.hint[1], a) || same(G.hint[1], b))) G.hint = null;
  else if (G.hint) { G.hint[2] = findPath(G.hint[0], G.hint[1]); if (!G.hint[2]) G.hint = null; } // 다른 짝을 없애면 힌트 선을 다시 그림
  G.lines.push({ path, t: 0, life: 0.38 });
  G.removing.push({ x: a.x, y: a.y, type: t, t: 0 }, { x: b.x, y: b.y, type: t, t: 0 });
  // combo & coins (짝 1개 = 2코인, 콤보면 +1, 콤보 보너스 부스트면 콤보 코인 2배)
  if (!byBomb && G.elapsed - G.lastMatchT <= COMBO_WINDOW) G.combo++; else G.combo = 1;
  G.lastMatchT = G.elapsed; G.maxCombo = Math.max(G.maxCombo, G.combo);
  const bonus = G.combo >= 2 ? (G.comboX2 ? 2 : 1) : 0;
  if (!GOD()) G.coins += 2 + bonus; // 무적: 코인 0
  const pa = cellCenter(a), pb = cellCenter(b);
  G.fx.push({ name: 'fx_remove', x: pa.x, y: pa.y, w: tileW() * 1.4, t: 0, life: 0.5 }, { name: 'fx_remove', x: pb.x, y: pb.y, w: tileW() * 1.4, t: 0, life: 0.5 });
  if (G.combo >= 2) G.texts.push({ combo: G.combo, x: (pa.x + pb.x) / 2, y: Math.min(pa.y, pb.y) - 30, t: 0, life: 0.9 });
  Audio.sfx('match', G.combo);
  if (G.left <= 0) { setTimeout(clearStage, 450); return; }
  if (!anyPair()) { setTimeout(() => { if (G.state === 'play') { reshuffle(); Audio.sfx('shuffle'); toast('이을 수 있는 짝이 없어서 섞었어요!'); } }, 420); }
}
const same = (p, q) => p && q && p.x === q.x && p.y === q.y;

const itemCount = (id) => (HUB ? HUB.boostCount('shisen', id) : G.items[id]);
function spendItem(id) {
  if (HUB) return HUB.useBoost('shisen', id);
  if (G.items[id] <= 0) return false;
  G.items[id]--; return true;
}
function useHint() {
  if (G.state !== 'play') return;
  if (itemCount('hint') <= 0) { toast('힌트가 없어요. 아이템샵에서 살 수 있어요'); Audio.sfx('bad'); return; }
  const p = anyPair(); if (!p) return;
  // 힌트: 6초 동안 나머지 판을 어둡게, 두 타일은 통통 튀며 테두리가 깜빡이고, 둘을 잇는 선을 보여 줌
  spendItem('hint'); G.hint = [p[0], p[1], p[2]]; G.hintT = HINT_TIME; G.hintBig = true; Audio.sfx('hint'); renderItems();
}
const HINT_TIME = 6;
function useShuffle() {
  if (G.state !== 'play') return;
  if (itemCount('shuffle') <= 0) { toast('섞기가 없어요. 아이템샵에서 살 수 있어요'); Audio.sfx('bad'); return; }
  spendItem('shuffle'); reshuffle(); Audio.sfx('shuffle'); renderItems();
  G.fx.push({ name: 'fx_clear', x: W / 2, y: H / 2, w: 260, t: 0, life: 0.6 });
}
function useTime() {
  if (G.state !== 'play') return;
  if (itemCount('time') <= 0) { toast('시간 추가가 없어요. 아이템샵에서 살 수 있어요'); Audio.sfx('bad'); return; }
  spendItem('time'); G.time += 10; Audio.sfx('time'); renderItems();
  G.fx.push({ name: 'fx_time', x: W / 2, y: H * 0.42, w: 150, t: 0, life: 0.9 });
}
function useBomb() {
  if (G.state !== 'play' || itemCount('bomb') <= 0) return;
  const p = anyPair(); if (!p) return;
  spendItem('bomb'); Audio.sfx('bomb'); G.shake = 0.25; renderItems();
  removePair(p[0], p[1], p[2], true);
}

function stars() { const r = G.time / G.limit; return r >= 0.5 ? 3 : r >= 0.25 ? 2 : 1; }
function clearStage() {
  if (G.state !== 'play') return;
  setState('done'); Audio.sfx('clear'); Audio.stopBgm();
  const st = stars();
  for (let i = 0; i < 40; i++) G.fx.push({ kind: 'confetti', x: Math.random() * W, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 80, vy: 120 + Math.random() * 160, r: Math.random() * 6, c: ['#FFB5C5', '#FFD34D', '#79C89C', '#5CA9E6', '#C9A8FF'][i % 5], t: 0, life: 3 });
  let earn = null;
  let reward = [];
  if (HUB) {
    earn = HUB.record('shisen', { stage: G.si, cleared: true, dist: 0, coins: G.coins, stars: st, time: Math.round(G.elapsed) });
    reward = earn.god ? [] : clearReward(st, earn.firstClear);
  } else { Save.data.cleared[G.si] = true; Save.store(); }
  setTimeout(() => showResult(true, st, earn, reward), 900);
}
// 클리어 보상 아이템 (캐릭터 보유 수량에 바로 더해짐)
//  · 처음 깬 판: 힌트·섞기·시간 추가 중 1개  · 별 3개: 힌트 1개  · 월드 마지막 판(N-10) 처음 깨면: 폭탄 1개
function clearReward(st, first) {
  const got = [];
  const give = (id) => { HUB.addBoost('shisen', id, 1); got.push(id); };
  if (first) give(['hint', 'shuffle', 'time'][Math.floor(Math.random() * 3)]);
  if (st >= 3) give('hint');
  if (first && G.si % PER_WORLD === PER_WORLD - 1) give('bomb');
  return got;
}
const GOD = () => !!(window.Hub && window.Hub.god); // 무적 쿠폰 (테스트용)
function failStage() {
  setState('done'); Audio.sfx('fail'); Audio.stopBgm();
  let earn = null;
  if (HUB) earn = HUB.record('shisen', { stage: G.si, cleared: false, dist: 0, coins: G.coins, stars: 0 });
  setTimeout(() => showResult(false, 0, earn), 500);
}
const ITEM_NAME = { hint: '💡 힌트', shuffle: '🔀 섞기', time: '⏱ 시간 추가', bomb: '💣 폭탄' };
function showResult(ok, st, earn, reward = []) {
  $('resTitle').textContent = ok ? '스테이지 클리어!' : '시간 초과!';
  document.querySelector('.panel.result').classList.toggle('fail', !ok);
  $('resStars').innerHTML = [0, 1, 2].map((k) => `<span class="${k < st ? '' : 'off'}">★</span>`).join('');
  $('resTime').textContent = ok ? mmss(G.elapsed) : '-';
  $('resCombo').textContent = G.maxCombo;
  $('resCoin').textContent = G.coins;
  $('resEarn').classList.toggle('hidden', !earn);
  if (earn) {
    const cnt = {}; reward.forEach((id) => { cnt[id] = (cnt[id] || 0) + 1; });
    const items = Object.entries(cnt).map(([id, n]) => `${ITEM_NAME[id]} +${n}`).join(' · ');
    $('resEarn').innerHTML = `+${earn.earned} 코인 획득!` + (earn.bonus ? ` <small>(클리어 보너스 +${earn.bonus}${earn.firstClear ? ', 첫 클리어!' : ''})</small>` : '') + `<small>내 코인 ${earn.coins}</small>`
      + (items ? `<div class="reward">🎁 보상 아이템: ${items}</div>` : '');
  }
  $('btnNext').classList.toggle('hidden', !(ok && G.si < STAGES.length - 1));
  setState('result');
}

// ---------- update ----------
function step(dt) {
  G.t += dt;
  for (const l of G.lines) l.t += dt; G.lines = G.lines.filter((l) => l.t < l.life);
  for (const r of G.removing) r.t += dt; G.removing = G.removing.filter((r) => r.t < 0.35);
  for (const f of G.fx) { f.t += dt; if (f.vx != null) { f.x += f.vx * dt; f.y += f.vy * dt; } } G.fx = G.fx.filter((f) => f.t < f.life);
  for (const s of G.texts) s.t += dt; G.texts = G.texts.filter((s) => s.t < s.life);
  if (G.shake > 0) G.shake -= dt;
  if (G.state !== 'play') return;
  G.elapsed += dt; G.time -= dt;
  if (G.hintT > 0) { G.hintT -= dt; if (G.hintT <= 0) G.hint = null; }
  if (!G.hint) G.hintBig = false;
  if (G.findT > 0) { G.findT -= dt; if (!G.hint) { const p = anyPair(); if (p) { G.hint = [p[0], p[1], p[2]]; G.hintT = 0.4; } } if (G.findT <= 0) renderBuffs(); }
  if (G.time < 10) { G.tickT -= dt; if (G.tickT <= 0) { G.tickT = 1; Audio.sfx('tick'); } }
  if (G.time <= 0 && GOD()) G.time = G.limit; // 무적: 시간이 다 되면 다시 채움
  if (G.time <= 0) { G.time = 0; failStage(); }
}

// ---------- layout of the board ----------
function boardArea() {
  if (wideLayout()) return { x: 170, y: 140, w: W - 200, h: H - 170 };
  return { x: 12, y: 130, w: W - 24, h: H - 130 - 150 };
}
let BL = { tw: 50, th: 54, ox: 0, oy: 0 };
function layoutBoard() {
  if (!G.cols) return;
  const a = boardArea();
  const tw = Math.floor(Math.min(a.w / (G.cols + 0.7), (a.h / (G.rows + 0.7)) / 1.08));
  const th = Math.round(tw * 1.08);
  BL = { tw, th, ox: a.x + (a.w - tw * G.cols) / 2, oy: a.y + (a.h - th * G.rows) / 2 };
}
const tileW = () => BL.tw;
function cellCenter(p) { return { x: BL.ox + (p.x + 0.5) * BL.tw, y: BL.oy + (p.y + 0.5) * BL.th }; }
function cellFromPoint(px, py) {
  const x = Math.floor((px - BL.ox) / BL.tw), y = Math.floor((py - BL.oy) / BL.th);
  return (x >= 0 && y >= 0 && x < G.cols && y < G.rows) ? { x, y } : null;
}

// ---------- render ----------
function drawBg() {
  const drawn = SKIN_BG[G.skin] == null && G.skin && G.skin !== 'default' && window.Skins && window.Skins.has(G.skin);
  const img = SKIN_BG[G.skin] != null ? SP.bg[SKIN_BG[G.skin]] : SP.world[Math.floor(G.si / PER_WORLD)];
  if (drawn) window.Skins.draw(ctx, G.skin, W, H, 0, 0, G.t);
  else if (img && img.complete && img.naturalWidth) {
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const bw = img.naturalWidth * s, bh = img.naturalHeight * s;
    ctx.drawImage(img, (W - bw) / 2, (H - bh) / 2, bw, bh);
  } else { ctx.fillStyle = '#5A4A8C'; ctx.fillRect(0, 0, W, H); }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(20,14,40,.35)'); g.addColorStop(0.5, 'rgba(20,14,40,.15)'); g.addColorStop(1, 'rgba(20,14,40,.5)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
// 힌트 아이템: 판 전체를 어둡게 → 두 타일을 잇는 움직이는 점선 → 두 타일을 위에 다시 그려 통통 튀고 굵은 테두리 깜빡임 → 위에 화살표
function drawBigHint(pulse) {
  const [a, b, path] = G.hint;
  const fade = clamp(Math.min(G.hintT / 0.5, (HINT_TIME - G.hintT) / 0.25), 0, 1);
  ctx.save(); ctx.globalAlpha = fade;
  ctx.fillStyle = 'rgba(10,6,24,.62)'; ctx.fillRect(-20, -20, W + 40, H + 40);
  if (path) {
    const pts = path.map(cellCenter);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.shadowColor = '#7FF0FF'; ctx.shadowBlur = 16; ctx.strokeStyle = 'rgba(127,240,255,.55)'; ctx.lineWidth = 12; ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.setLineDash([12, 10]); ctx.lineDashOffset = -G.t * 60; ctx.stroke();
    ctx.setLineDash([]);
  }
  const hop = Math.abs(Math.sin(G.t * 7)) * BL.th * 0.16, w = BL.tw * 1.06, h = BL.th * 1.06;
  const spots = [a, b].map((p) => { const c = cellCenter(p); return { p, x: c.x, y: c.y - hop }; });
  // 위에서 가리키는 화살표 (타일보다 먼저 그려서, 두 타일이 붙어 있으면 아래 화살표는 위 타일 뒤로 숨음)
  for (const s of spots) {
    const ay = s.y - h / 2 - 14 - Math.abs(Math.sin(G.t * 7 + 1)) * 10, aw = Math.max(12, BL.tw * 0.26);
    ctx.fillStyle = '#FFE45C'; ctx.strokeStyle = '#7A3E00'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(s.x, ay); ctx.lineTo(s.x - aw, ay - aw * 1.1); ctx.lineTo(s.x + aw, ay - aw * 1.1); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  for (const s of spots) {
    ctx.save(); ctx.shadowColor = '#FFE45C'; ctx.shadowBlur = 22 + pulse * 18;
    ctx.fillStyle = '#FFF3A8'; ctx.beginPath(); ctx.roundRect(s.x - w / 2 - 5, s.y - h / 2 - 5, w + 10, h + 10, 14); ctx.fill(); ctx.restore();
    drawTile(G.pool[cellAt(s.p.x, s.p.y)], s.x, s.y, w * 0.96, h * 0.96);
    ctx.strokeStyle = pulse > 0.5 ? '#FFFFFF' : '#FFC21A'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.roundRect(s.x - w / 2 - 4, s.y - h / 2 - 4, w + 8, h + 8, 13); ctx.stroke();
  }
  ctx.restore();
}
function render() {
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  drawBg();
  if (!G.cols) return;
  layoutBoard();
  ctx.save();
  if (G.shake > 0) ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
  // board plate
  const pad = BL.tw * 0.35;
  ctx.fillStyle = 'rgba(255,248,238,.18)'; ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(BL.ox - pad, BL.oy - pad, BL.tw * G.cols + pad * 2, BL.th * G.rows + pad * 2, 18); ctx.fill(); ctx.stroke();
  // tiles (bottom rows drawn last so their shadow overlaps the row above)
  const pulse = 0.5 + 0.5 * Math.sin(G.t * 8);
  for (let y = 0; y < G.rows; y++) for (let x = 0; x < G.cols; x++) {
    const t = G.grid[y][x]; if (t < 0) continue;
    const c = cellCenter({ x, y });
    const sel = G.sel && G.sel.x === x && G.sel.y === y;
    const hint = G.hint && !G.hintBig && (same(G.hint[0], { x, y }) || same(G.hint[1], { x, y }));
    const lift = sel ? -5 : 0;
    ctx.fillStyle = 'rgba(40,20,10,.25)';
    ctx.beginPath(); ctx.roundRect(c.x - BL.tw * 0.46, c.y - BL.th * 0.42 + 4, BL.tw * 0.92, BL.th * 0.9, 8); ctx.fill();
    if (sel || hint) {
      ctx.save(); ctx.shadowColor = sel ? '#FFD34D' : '#6FD3FF'; ctx.shadowBlur = 16 + pulse * 10;
      ctx.fillStyle = sel ? 'rgba(255,211,77,.9)' : `rgba(111,211,255,${0.5 + pulse * 0.4})`;
      ctx.beginPath(); ctx.roundRect(c.x - BL.tw * 0.5, c.y - BL.th * 0.47 + lift, BL.tw, BL.th * 0.96, 10); ctx.fill(); ctx.restore();
    }
    drawTile(G.pool[t], c.x, c.y + lift, BL.tw * 0.94, BL.th * 0.94);
  }
  // tiles being removed: pop + fade
  for (const r of G.removing) {
    const c = cellCenter(r), k = r.t / 0.35;
    drawTile(G.pool[r.type], c.x, c.y - k * 10, BL.tw * 0.94 * (1 + k * 0.25), BL.th * 0.94 * (1 + k * 0.25), 1 - k);
  }
  // connect lines
  for (const l of G.lines) {
    const k = l.t / l.life;
    const pts = l.path.map(cellCenter);
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.globalAlpha = 1 - k * 0.6;
    ctx.shadowColor = '#FFD34D'; ctx.shadowBlur = 18;
    ctx.strokeStyle = '#FFE07A'; ctx.lineWidth = 10;
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
    ctx.restore();
  }
  // effects
  for (const f of G.fx) {
    const k = f.t / f.life;
    if (f.kind === 'confetti') { ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 2); ctx.fillStyle = f.c; ctx.translate(f.x, f.y); ctx.rotate(f.t * 6 + f.r); ctx.fillRect(-5, -3, 10, 6); ctx.restore(); continue; }
    spr(f.name, f.x, f.y - k * 16, f.w * (0.8 + k * 0.4), null, 1 - k);
  }
  for (const s of G.texts) {
    const k = s.t / s.life;
    spr('fx_combo', s.x - 18, s.y - k * 30, 120, null, 1 - Math.max(0, k - 0.6) / 0.4);
    ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
    ctx.font = '34px Jua, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = '#7A3E00'; ctx.strokeText(String(s.combo), s.x + 46, s.y - k * 30 + 2);
    ctx.fillStyle = '#FFE07A'; ctx.fillText(String(s.combo), s.x + 46, s.y - k * 30 + 2);
    ctx.globalAlpha = 1;
  }
  if (G.hint && G.hintBig) drawBigHint(pulse); // 맨 위에 (콤보 글씨·효과보다 위)
  ctx.restore();
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
  document.querySelector('.starbar .s1').classList.toggle('off', false);
  document.querySelector('.starbar .s2').classList.toggle('off', r < 0.25);
  document.querySelector('.starbar .s3').classList.toggle('off', r < 0.5);
}
function renderItems() {
  const set = (id, cid, n) => { $(cid).textContent = n; $(id).classList.toggle('empty', n <= 0); };
  set('btnHint', 'cHint', itemCount('hint')); set('btnShuffle', 'cShuffle', itemCount('shuffle')); set('btnTime', 'cTime', itemCount('time'));
  $('btnBomb').classList.toggle('hidden', itemCount('bomb') <= 0); $('cBomb').textContent = itemCount('bomb');
}
function renderBuffs() {
  const el = $('buffs'); el.innerHTML = '';
  const add = (t) => { const d = document.createElement('div'); d.className = 'buff'; d.textContent = t; el.appendChild(d); };
  if (G.findT > 0) add('🔍 자동 찾기');
  if (G.comboX2) add('🌈 콤보 2배');
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
}
function pauseGame() { if (G.state === 'play') { setState('pause'); Audio.stopBgm(); } }
function resumeGame() { if (G.state === 'pause') { setState('play'); Audio.startBgm(); last = performance.now(); } }
function goMap() { Audio.stopBgm(); location.href = HUB ? '../index.html#map-shisen' : '../index.html'; }

// ---------- input ----------
function toGame(e) { // client point → game coordinates (also when the page is rotated)
  const r = root.getBoundingClientRect();
  if (rotated) return { x: (r.bottom - e.clientY) / scale, y: (e.clientX - r.left) / scale };
  return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
}
canvas.addEventListener('pointerdown', (e) => {
  Audio.unlock();
  if (G.state !== 'play') return;
  e.preventDefault();
  const p = toGame(e), c = cellFromPoint(p.x, p.y);
  if (c) select(c.x, c.y); else G.sel = null;
});
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
window.addEventListener('keydown', (e) => {
  Audio.unlock();
  if (e.code === 'KeyH') useHint(); else if (e.code === 'KeyS') useShuffle(); else if (e.code === 'KeyT') useTime(); else if (e.code === 'KeyB') useBomb();
  else if (e.code === 'Escape' || e.code === 'KeyP') { if (G.state === 'play') pauseGame(); else if (G.state === 'pause') resumeGame(); }
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
$('btnShuffle').addEventListener('click', () => { Audio.unlock(); useShuffle(); });
$('btnTime').addEventListener('click', () => { Audio.unlock(); useTime(); });
$('btnBomb').addEventListener('click', () => { Audio.unlock(); useBomb(); });

// ---------- layout: phones portrait (rotate if held sideways), PC full window ----------
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
let rotated = false;
function wideLayout() { return W > H; }
function resize() {
  const vv = window.visualViewport;
  const vw = Math.round(vv ? vv.width : window.innerWidth), vh = Math.round(vv ? vv.height : window.innerHeight);
  const s = $('safe').getBoundingClientRect();
  const inset = { t: s.top, l: s.left, r: vw - s.right, b: vh - s.bottom };
  rotated = isTouch && vw > vh;
  const sw = rotated ? vh : vw, sh = rotated ? vw : vh;
  const wasWide = wideLayout();
  if (isTouch) { W = 540; H = Math.round(clamp(W * sh / sw, 860, 1240)); }
  else { H = 960; W = Math.round(clamp(H * vw / vh, 540, 2400)); }
  scale = Math.min(sw / W, sh / H);
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  root.style.width = W + 'px'; root.style.height = H + 'px';
  root.classList.toggle('wide', wideLayout());
  const ox = (sw - W * scale) / 2, oy = (sh - H * scale) / 2;
  root.style.transform = rotated ? `translate(${oy}px, ${vh - ox}px) rotate(-90deg) scale(${scale})` : `translate(${ox}px, ${oy}px) scale(${scale})`;
  const insT = rotated ? inset.l : inset.t, insB = rotated ? inset.r : inset.b;
  root.style.setProperty('--safe-t', Math.max(0, (insT - oy) / scale) + 'px');
  root.style.setProperty('--safe-b', Math.max(0, (insB - oy) / scale) + 'px');
  canvas.width = Math.round(W * scale * dpr); canvas.height = Math.round(H * scale * dpr);
  // PC window switched between wide/tall mid-game: turn the board to match
  if (G.cols && wasWide !== wideLayout() && (G.state === 'play' || G.state === 'pause')) transposeBoard();
}
function transposeBoard() {
  const g = []; for (let x = 0; x < G.cols; x++) { const row = []; for (let y = 0; y < G.rows; y++) row.push(G.grid[y][x]); g.push(row); }
  G.grid = g; [G.cols, G.rows] = [G.rows, G.cols]; G.sel = null; G.hint = null;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000; last = now; if (dt > 0.05) dt = 0.05; if (dt < 0) dt = 0;
  step(dt);
  if (G.state === 'play' || G.state === 'done' || G.state === 'pause') updateHud();
  render();
  requestAnimationFrame(frame);
}
resize();
{
  let si = parseInt(new URLSearchParams(location.search).get('stage'), 10);
  if (!(si >= 0 && si < STAGES.length) || !unlocked(si)) si = nextStage();
  showReady(si);
  if (new URLSearchParams(location.search).get('go') === '1') startStage(si); // 인트로 START: 준비 창 없이 바로
}
requestAnimationFrame(frame);

// debug/test hook
window.__shisen = { G, findPath, anyPair, select, startStage, STAGES, useHint, useShuffle, useTime, useBomb, cellAt };
