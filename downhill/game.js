'use strict';
// 은유와 은결의 다운힐 러너 — 후방 시점 좌우 회피 러닝 게임 (HTML5 Canvas, no dependencies)
//  · 캐릭터가 화면 아래에서 자동으로 앞으로 달리고, 왼쪽/오른쪽으로만 움직여 장애물을 피함
//  · 길은 보이지 않는 5칸(레인). 탭 한 번 = 한 칸
//  · 하트 3개, 부딪히면 -1 (1초 무적). 0이 되면 끝
//  · 멀리 갈수록 빨라지고 장애물이 늘어남. 300m마다 배경이 바뀜
// 폰: 세로 화면 (논리 폭 540, 높이는 화면 비율대로) / PC: 창 전체 가로 화면 (논리 높이 960)

let W = 540;
const CFG = {
  lanes: 5, laneW: 92,       // 캐릭터 위치에서 한 칸 폭(px)
  persp: 7,                  // 원근 거리(m): 작을수록 멀리 있는 것이 빨리 작아짐
  spawnAhead: 70,            // 이만큼 앞(m)까지 장애물을 미리 만들어 둠
  v0: 9, vMax: 22,           // 속도(m/s): 100m마다 +1
  laneSpeed: 13,             // 좌우 이동 속도(칸/초)
  hearts: 3, heartsMax: 4,
  invuln: 1.0,
  jumpDur: 0.75, jumpH: 120, // 점프하기: 공중에 있는 시간(초)·높이(px)
};
const STAGES = [
  { name: '눈 덮인 산', at: 0, sky: ['#7FC3F2', '#BFE3FA', '#EAF6FF'], far: '#B9D3EE', mid: '#93B4D8', snow: ['#E3F0FB', '#FFFFFF'], deco: ['tree', 'tree', 'rock'] },
  { name: '겨울 숲', at: 300, sky: ['#86C9EE', '#CFEAF5', '#F1FAF4'], far: '#A9CFC0', mid: '#5E9C7E', snow: ['#E1F0E8', '#FBFFFC'], deco: ['tree', 'trees', 'tree', 'snowman'], pines: true },
  { name: '얼음 계곡', at: 600, sky: ['#6BB8EC', '#B4E0FA', '#E4F7FF'], far: '#A6D8F2', mid: '#7CC0E8', snow: ['#D6ECFB', '#F4FBFF'], deco: ['ice', 'pillars', 'ice', 'tree'], ice: true },
  { name: '눈 마을', at: 900, sky: ['#8FC6F0', '#D5E9F8', '#FFF4E8'], far: '#C3D4EA', mid: '#A2B6D2', snow: ['#ECEFF5', '#FFFFFF'], deco: ['tree', 'house', 'snowman', 'house'], village: true },
  { name: '오로라 설원', at: 1200, sky: ['#0E1A4A', '#24306E', '#4B4E94'], far: '#4A5AA0', mid: '#2C3A78', snow: ['#BCC8EE', '#E6ECFF'], deco: ['tree', 'ice', 'tree'], aurora: true, night: true },
];
// 아이템샵 스킨 → 하늘 색 (원래 그림이 없는 스킨은 common/skins.js가 하늘을 그림)
const SKIN_SKY = {
  winter: STAGES[0], forest: STAGES[1],
  sunset: { sky: ['#F48C5C', '#FFC48A', '#FFE9C9'], far: '#E6A27D', mid: '#C27C63' },
};
// 장애물: w = 막는 칸 수, s = 그림 폭(칸), flat = 바닥에 붙은 것
const OBS = {
  tree: { w: 1, s: 1.05 }, rock: { w: 1, s: 1.05 }, snowman: { w: 1, s: 0.85 }, ice: { w: 1, s: 1.0 },
  fence: { w: 2, s: 2.0 }, log: { w: 2, s: 1.9 }, snowpile: { w: 1, s: 1.05 }, icehole: { w: 1, s: 1.1, flat: true },
  penguin: { w: 1, s: 0.8 }, snowball: { w: 1, s: 0.95 }, bigball: { w: 2, s: 1.8, img: 'snowball' },
  trees: { w: 2, s: 1.9 }, pillars: { w: 1, s: 1.0 },
};
const SMALL = ['snowman', 'ice', 'snowpile', 'penguin', 'snowball', 'rock']; // 부스터로 부술 수 있는 것

// ---------- save ----------
const Save = {
  data: { char: 'eunyu', best: 0, totalCoin: 0, sound: true },
  load() { try { Object.assign(this.data, JSON.parse(localStorage.getItem('downhill_v1') || '{}')); } catch (e) { /* private mode */ } },
  store() { try { localStorage.setItem('downhill_v1', JSON.stringify(this.data)); } catch (e) { /* ignore */ } },
};
Save.load();
// 트윈 게임랜드(메인 화면)에서 들어왔으면 그 캐릭터로 플레이하고 기록·코인을 공통 저장소에 남긴다
const HUB = window.Hub && window.Hub.active() ? window.Hub : null;
if (HUB) {
  Save.data.char = HUB.active().look; Save.data.sound = HUB.settings.sound;
  Save.data.best = HUB.rec('downhill').best;
}
const GOD = () => !!(window.Hub && window.Hub.god);
// 그릴 캐릭터: 옛 모습(eunyu·eungyeol)은 지금 모습(v3) 그림으로 (단독 실행일 때)
const lookOf = (c) => (window.CharV2 && !CharV2.is(c) && CharV2.is(c + '3') ? c + '3' : c);
if (window.CharV2) CharV2.load(lookOf(Save.data.char)); // 무적 쿠폰 (테스트용)

// ---------- utils ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + (b - a) * Math.random();
const pick = (l) => l[Math.floor(Math.random() * l.length)];
const $ = (id) => document.getElementById(id);
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };

// ---------- sprites ----------
const ASSET_V = '202611010049';
const SP = { img: new Image(), f: null, ready: false };
fetch(`assets/sprites/sprites.json?v=${ASSET_V}`).then((r) => r.json()).then((j) => {
  SP.f = j;
  SP.img.onload = () => { SP.ready = true; fillIcons(); renderHearts(); renderBuffs(); };
  SP.img.src = `assets/sprites/sprites.webp?v=${ASSET_V}`;
});
function spr(g, name, x, y, w, { rot = 0, alpha = 1, flip = false, anchor = 'c', sx = 1 } = {}) {
  if (!SP.ready || !SP.f[name]) return 0;
  const [fx, fy, fw, fh] = SP.f[name];
  const h = w * fh / fw;
  g.save();
  g.globalAlpha *= alpha;
  g.translate(x, y);
  if (rot) g.rotate(rot);
  if (flip || sx !== 1) g.scale((flip ? -1 : 1) * sx, 1);
  g.drawImage(SP.img, fx, fy, fw, fh, -w / 2, anchor === 'b' ? -h : -h / 2, w, h);
  g.restore();
  return h;
}
// GPT 그림 (tools/downhill_assets.py): 점프하기 아이템·눈 마을 집·스테이지 하늘, 하트는 모든 게임 공통 그림
const uiImg = (src) => { const im = new Image(); im.src = `${src}?v=${ASSET_V}`; return im; };
const JUMP_IMG = uiImg('assets/ui/item_jump.webp');
const HOUSE_IMG = uiImg('assets/ui/house.webp');
const HEART_IMG = uiImg('../common/ui/heart.webp');
const SKY_IMG = [1, 2, 3, 4, 5].map((n) => uiImg(`assets/bg/sky_${n}.webp`));
const SKY_HZ = [928, 884, 887, 858, 858]; // 하늘 그림에서 지평선 높이(px, 위에서부터)
const iconCache = {};
function iconURL(name) {
  if (iconCache[name]) return iconCache[name];
  if (!SP.ready || !SP.f[name]) return '';
  const [sx, sy, sw, sh] = SP.f[name]; const c = document.createElement('canvas'); c.width = sw; c.height = sh;
  c.getContext('2d').drawImage(SP.img, sx, sy, sw, sh, 0, 0, sw, sh);
  return (iconCache[name] = c.toDataURL());
}
function fillIcons() { document.querySelectorAll('img[data-icon]').forEach((im) => { im.src = iconURL(im.dataset.icon); }); refreshHome(); }

// ---------- audio (WebAudio synth) ----------
const Audio = {
  ctx: null, master: null, sfxGain: null, bgmGain: null, bgmOn: false, nextNote: 0, step: 0, timer: null,
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.42; this.sfxGain.connect(this.master);
      this.bgmGain = this.ctx.createGain(); this.bgmGain.gain.value = 0.11; this.bgmGain.connect(this.master);
      const b = this.ctx.createBuffer(1, 1, 22050); const s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.master); s.start(0);
      this.applyMute();
      if (this.bgmOn && !this.timer) { this.bgmOn = false; this.startBgm(); }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  applyMute() { if (this.master) this.master.gain.value = Save.data.sound ? 1 : 0; },
  tone(freq, dur, type = 'sine', vol = 0.5, slide = 0, when = 0, dest) {
    if (!this.ctx || !Save.data.sound) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol = 0.3, when = 0, hp = 1000, dest) {
    if (!this.ctx || !Save.data.sound) return;
    const t = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(dest || this.sfxGain); s.start(t);
  },
  sfx(name) {
    const r = 1 + (Math.random() - 0.5) * 0.06;
    switch (name) {
      case 'move': this.noise(0.06, 0.12, 0, 3000); this.tone(520 * r, 0.04, 'triangle', 0.08, 120); break;
      case 'coin': this.tone(988 * r, 0.05, 'square', 0.1); this.tone(1319 * r, 0.1, 'square', 0.1, 0, 0.04); break;
      case 'star': [1318, 1760, 2349].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.25, 0, i * 0.04)); break;
      case 'item': [660, 880, 1100, 1320].forEach((f, i) => this.tone(f, 0.11, 'triangle', 0.28, 0, i * 0.045)); break;
      case 'nice': this.tone(880 * r, 0.08, 'triangle', 0.22); this.tone(1320 * r, 0.12, 'triangle', 0.22, 0, 0.06); break;
      case 'combo': [784, 988, 1319].forEach((f, i) => this.tone(f, 0.1, 'square', 0.12, 0, i * 0.05)); break;
      case 'hit': this.noise(0.25, 0.4, 0, 300); this.tone(240, 0.28, 'square', 0.2, -150); break;
      case 'smash': this.noise(0.18, 0.35, 0, 900); break;
      case 'shield': this.tone(600, 0.25, 'sine', 0.3, 600); this.noise(0.1, 0.2, 0, 2000); break;
      case 'gameover': [523, 440, 349, 262].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.3, 0, i * 0.17)); break;
      case 'jump': this.tone(330, 0.22, 'triangle', 0.3, 500); this.noise(0.08, 0.15, 0, 2500); break;
      case 'boost': this.tone(300, 0.4, 'sawtooth', 0.12, 900); break;
      case 'stage': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.15, 'square', 0.13, 0, i * 0.08)); break;
      case 'best': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.3, 0, i * 0.07)); break;
      case 'ui': this.tone(700, 0.06, 'triangle', 0.25); break;
    }
  },
  // 경쾌한 겨울 노래 (방울 소리)
  melody: [76, 76, 76, 0, 76, 76, 76, 0, 76, 79, 72, 74, 76, 0, 0, 0, 77, 77, 77, 77, 77, 76, 76, 76, 76, 74, 74, 76, 74, 0, 79, 0],
  bass: [48, 55, 48, 55, 48, 55, 48, 55, 53, 60, 48, 55, 50, 55, 43, 55],
  startBgm() {
    if (this.bgmOn || !this.ctx) { this.bgmOn = true; return; }
    this.bgmOn = true; this.nextNote = this.ctx.currentTime + 0.1;
    clearInterval(this.timer); this.timer = setInterval(() => this.schedule(), 30);
  },
  stopBgm() { this.bgmOn = false; clearInterval(this.timer); this.timer = null; },
  schedule() {
    if (!this.ctx || !this.bgmOn) return;
    const stepDur = 60 / 160 / 2;
    const mf = (n) => 440 * Math.pow(2, (n - 69) / 12);
    while (this.nextNote < this.ctx.currentTime + 0.15) {
      const when = this.nextNote - this.ctx.currentTime;
      const m = this.melody[this.step % 32];
      if (m) this.tone(mf(m), stepDur * 0.8, 'square', 0.18, 0, when, this.bgmGain);
      if (this.step % 2 === 0) this.tone(mf(this.bass[(this.step / 2) % 16]), stepDur * 1.7, 'triangle', 0.6, 0, when, this.bgmGain);
      if (this.step % 2 === 1) this.noise(0.03, 0.12, when, 8000, this.bgmGain); // 방울
      this.nextNote += stepDur; this.step++;
    }
  },
};

// ---------- state ----------
const canvas = $('game');
const ctx = canvas.getContext('2d');
const root = $('root');
let H = 960, scale = 1, dpr = 1;

const G = {
  state: 'home', // home | ready | play | pause | over | result
  t: 0, d: 0, v: CFG.v0, lane: 0, px: 0, hearts: CFG.hearts, maxHearts: CFG.hearts, coins: 0,
  obs: [], items: [], deco: [], fx: [], texts: [], flakes: [], rows: [],
  nextRow: 30, nextDeco: 0, safe: 0,
  invT: 0, hitT: 0, shield: false, magnetT: 0, x2T: 0, boostT: 0, wingT: 0, jumps: 0, jumpT: 0,
  combo: 0, maxCombo: 0, stageIdx: 0, prevStage: 0, stageFade: 1, newBest: false, shake: 0, lean: 0, overT: 0, nextBonus: 100,
};
const stageAt = (d) => { let k = 0; for (let i = 0; i < STAGES.length; i++) if (d >= STAGES[i].at) k = i; return k; };

// ---------- 길 만들기 ----------
// 장애물은 '줄' 단위로 나옴. 줄마다 비워 두는 안전한 칸(safe)이 하나 있고, 다음 줄의 안전 칸은 많아야 1~2칸 옆
function tierOf(m) { return m < 300 ? 0 : m < 700 ? 1 : m < 1200 ? 2 : 3; }
function rowGap(m) {
  const g = m < 300 ? lerp(16, 13, m / 300) : m < 700 ? lerp(12.5, 10.5, (m - 300) / 400) : m < 1200 ? lerp(10.5, 8.5, (m - 700) / 500) : Math.max(7, 8.5 - (m - 1200) / 600);
  return g * rand(0.9, 1.15);
}
function spawnRow(Z) {
  const m = Z, tier = tierOf(m), gap = rowGap(m);
  const step = gap < 9 ? 1 : 2;
  G.safe = clamp(G.safe + Math.round(rand(-step, step)), 0, 4);
  const safe = G.safe;
  const row = { id: G.rows.length, done: false, hit: false };
  G.rows.push(row);
  const free = [0, 1, 2, 3, 4].map((l) => l !== safe);
  const place = (type, lane, extra = {}) => {
    const o = OBS[type];
    G.obs.push(Object.assign({ type, x: lane - 2 + (o.w - 1) / 2, Z: Z + rand(-0.6, 0.6), w: o.w, row, rot: 0 }, extra));
    for (let k = 0; k < o.w; k++) free[lane + k] = false;
  };
  const lanesFor = (w) => { const l = []; for (let i = 0; i + w <= 5; i++) { let ok = true; for (let k = 0; k < w; k++) ok = ok && free[i + k]; if (ok) l.push(i); } return l; };
  const basic = ['tree', 'rock', 'snowman', 'ice', 'fence'];
  const mid = basic.concat(['snowpile', 'log', 'icehole', 'penguin', 'tree']);
  const hard = mid.concat(['snowball', 'trees', 'snowball', 'pillars']);
  const pool = [basic, mid, hard, hard.concat(['bigball', 'trees'])][tier];
  // 좁은 통로: 안전 칸만 남기고 기둥으로 막음
  if (tier >= 2 && Math.random() < (tier === 2 ? 0.12 : 0.18)) {
    for (let l = 0; l < 5; l++) if (free[l] && Math.abs(l - safe) > (tier === 2 ? 1 : 0)) place('pillars', l);
  } else {
    const n = [[1, 2], [2, 3], [2, 3], [3, 4]][tier];
    let count = n[0] + (Math.random() < 0.5 ? 1 : 0);
    let tries = 0;
    while (count > 0 && tries++ < 12) {
      const type = pick(pool), o = OBS[type];
      const ls = lanesFor(o.w); if (!ls.length) continue;
      const lane = pick(ls);
      const extra = {};
      if (type === 'penguin') { extra.vx = (Math.random() < 0.5 ? -1 : 1) * rand(0.8, 1.4); extra.Z = Z + 4; } // 좌우로 왔다갔다
      if (type === 'snowball' || type === 'bigball') { extra.vz = rand(5, 8); extra.Z = Z + 25; } // 앞에서 굴러옴 (더 빨리 다가옴)
      place(type, lane, extra);
      count--;
    }
  }
  // 코인·아이템: 안전 칸에 (다른 게임과 맞춰 잘하는 1분 ≈ 코인 100~150개)
  const itemZ = Z + gap * 0.5;
  if (Math.random() < 0.075) G.items.push({ kind: rollItem(), x: safe - 2, Z: itemZ });
  else if (Math.random() < 0.045) G.items.push({ kind: 'jump', x: safe - 2, Z: itemZ }); // 점프하기 아이템
  else if (Math.random() < clamp(0.8 - m / 2500, 0.35, 0.8)) {
    const n = gap > 10 ? 4 : 3;
    for (let i = 0; i < n; i++) G.items.push({ kind: 'coin', x: safe - 2, Z: Z + 2.5 + i * 2.2 });
  }
  return gap;
}
function rollItem() {
  const r = Math.random();
  if (r < 0.3) return 'star';
  if (r < 0.47) return 'magnet';
  if (r < 0.64) return 'shield';
  if (r < 0.74) return G.hearts < G.maxHearts ? 'heart' : 'star';
  if (r < 0.87) return 'bolt';
  return 'wing';
}
function spawnDeco(Z) {
  const st = STAGES[stageAt(Z)];
  for (const side of [-1, 1]) {
    if (Math.random() < 0.75) G.deco.push({ kind: pick(st.deco), x: side * rand(3.4, 4.6), Z: Z + rand(-1, 1), flip: Math.random() < 0.5 });
    if (Math.random() < 0.5) G.deco.push({ kind: pick(st.deco), x: side * rand(5, 8), Z: Z + rand(-1, 1), flip: Math.random() < 0.5 });
  }
}

// ---------- run ----------
function resetRun() {
  G.t = 0; G.d = 0; G.v = CFG.v0; G.lane = 0; G.px = 0; G.lean = 0;
  G.obs = []; G.items = []; G.deco = []; G.fx = []; G.texts = []; G.rows = [];
  G.nextRow = 28; G.nextDeco = 0; G.safe = 2;
  G.invT = 0; G.hitT = 0; G.shield = false; G.magnetT = 0; G.x2T = 0; G.boostT = 0; G.wingT = 0;
  G.jumps = 0; G.jumpT = 0; G.jumpLen = CFG.jumpDur; // 점프하기 아이템은 판마다 0개부터 (죽으면 사라짐)
  G.hearts = CFG.hearts; G.maxHearts = CFG.hearts; G.coins = 0; G.combo = 0; G.maxCombo = 0; G.coinBase = 0; G.contUsed = false;
  G.stageIdx = 0; G.prevStage = 0; G.stageFade = 1; G.newBest = false; G.shake = 0; G.overT = 0; G.nextBonus = 100;
  while (G.nextDeco < CFG.spawnAhead) { spawnDeco(G.nextDeco); G.nextDeco += 3.2; }
  // 아이템샵: 적용한 배경 스킨 + '사용중' 부스트 (메인 화면에서 들어왔을 때만)
  G.skin = HUB ? HUB.equippedSkin('downhill') : 'default';
  const boosts = HUB ? HUB.takeBoosts('downhill') : [];
  if (boosts.includes('life')) { G.hearts = 4; G.maxHearts = 4; }
  if (boosts.includes('shield')) G.shield = true;
  if (boosts.includes('magnet')) G.magnetT = 20;
  if (boosts.includes('x2')) G.x2T = 30;
  G.startDash = boosts.includes('dash');
  if (boosts.length) banner('부스트: ' + boosts.map((b) => HUB.boostName('downhill', b)).join(' · '));
  renderHearts(); renderBuffs(); renderJump();
  $('hudBest').textContent = Save.data.best;
}
function startRun() { resetRun(); setState('ready'); Audio.startBgm(); }
// 시작 팝업 (common/gamepop.js): 아이템 고르기 → 시작. 결과 창 '다시하기'도 이 팝업으로
function askStart() {
  if (!window.GamePop || !HUB) { startRun(); return; }
  GamePop.start({ game: 'downhill', onStart: () => startRun(), onClose: goHome });
}
// 광고 보고 이어하기 (common/monet.js): 그 자리에서 하트 1개로, 바로 앞 장애물은 치우고, 화면을 한 번 터치하면 출발. 한 판에 한 번
window.GameContinue = {
  can: () => !G.contUsed,
  go() {
    G.contUsed = true; G.coinBase = G.coins;
    G.hearts = 1; G.v = CFG.v0; G.invT = 2; G.hitT = 0; G.overT = 0; renderHearts();
    G.obs = G.obs.filter((o) => o.Z - G.d > 30);
    setState('ready'); Audio.startBgm();
  },
};
function go() { // 첫 탭: 출발
  setState('play');
  if (G.startDash) { G.startDash = false; startBoost(5); }
}

// ---------- input / moves ----------
function move(dir) {
  Audio.unlock();
  if (G.state === 'ready') { go(); }
  if (G.state !== 'play') return;
  const nl = clamp(G.lane + dir, -2, 2);
  if (nl === G.lane) return;
  G.lane = nl; Audio.sfx('move');
}
// 점프하기: 아이템 1개를 쓰고 앞의 장애물을 뛰어넘음
function useJump() {
  Audio.unlock();
  if (G.state === 'ready') go();
  if (G.state !== 'play' || G.jumps <= 0 || G.jumpT > 0) return;
  // 앞의 장애물(내 칸 근처, 1.2초 안에 닿는 것)을 넘은 뒤에 내려오도록 점프 시간을 맞춤
  let z = 0;
  for (const o of G.obs) { const d = o.Z - G.d; if (!o.gone && !o.hit && d > 0.6 && d < G.v * 1.2 && Math.abs(G.px - o.x) - o.w / 2 < 0.5) z = z ? Math.min(z, d) : d; }
  G.jumpLen = z ? clamp((z + 1.5) / G.v, 0.55, 1.3) : CFG.jumpDur;
  G.jumps--; G.jumpT = G.jumpLen; renderJump();
  Audio.sfx('jump'); popText('점프!', W / 2, H * 0.55, '#22A55A');
}
const jumpAir = () => (G.jumpT > 0 ? Math.sin(Math.PI * (1 - G.jumpT / G.jumpLen)) * CFG.jumpH : 0);

// ---------- update ----------
function step(dt) {
  G.t += dt;
  updateFx(dt);
  if (G.state === 'over') { G.overT += dt; G.v = Math.max(0, G.v - 30 * dt); G.d += G.v * dt; if (G.overT > 1.2) showResult(); return; }
  if (G.state !== 'play') return;
  // 속도: 100m마다 +1m/s, 부스터 중엔 1.6배
  const base = Math.min(CFG.vMax, CFG.v0 + G.d / 100);
  G.v = lerp(G.v, base * (G.boostT > 0 ? 1.6 : 1), Math.min(1, dt * 3));
  G.d += G.v * dt;
  // 좌우 이동 (부드럽게)
  const dx = G.lane - G.px;
  const mv = Math.sign(dx) * Math.min(Math.abs(dx), CFG.laneSpeed * dt);
  G.px += mv;
  G.lean = lerp(G.lean, Math.abs(dx) > 0.05 ? Math.sign(dx) : 0, Math.min(1, dt * 14));
  // 타이머
  if (G.jumpT > 0) G.jumpT = Math.max(0, G.jumpT - dt);
  for (const k of ['invT', 'hitT', 'magnetT', 'x2T', 'boostT', 'wingT']) if (G[k] > 0) { G[k] -= dt; if (G[k] <= 0 && k !== 'invT' && k !== 'hitT') renderBuffs(); }
  // 길 만들기
  while (G.nextRow < G.d + CFG.spawnAhead) G.nextRow += spawnRow(G.nextRow);
  while (G.nextDeco < G.d + CFG.spawnAhead) { spawnDeco(G.nextDeco); G.nextDeco += 3.2; }
  // 배경 바뀜
  const si = stageAt(G.d);
  if (si !== G.stageIdx) { G.prevStage = G.stageIdx; G.stageIdx = si; G.stageFade = 0; banner(`STAGE ${si + 1} · ${STAGES[si].name}`); Audio.sfx('stage'); }
  if (!G.newBest && Save.data.best >= 100 && G.d > Save.data.best) { G.newBest = true; banner('🎉 NEW RECORD!'); Audio.sfx('best'); }
  // 거리 보너스 표시 (100m마다 +5, 결과에서 지급)
  if (G.d >= G.nextBonus) { G.nextBonus += 100; }
  // 장애물
  for (const o of G.obs) {
    if (o.vx) { o.x += o.vx * dt; const lim = 2 - (o.w - 1) / 2; if (o.x < -lim || o.x > lim) { o.vx = -o.vx; o.x = clamp(o.x, -lim, lim); } }
    if (o.vz) { o.Z -= o.vz * dt; o.rot += dt * (G.v + o.vz) * 0.6; }
    if (o.gone) continue;
    const z = o.Z - G.d;
    const gap = Math.abs(G.px - o.x) - o.w / 2;
    if (z < 0.6 && z > -0.6) {
      o.minGap = Math.min(o.minGap == null ? 9 : o.minGap, gap);
      if (gap < 0.3 && !o.hit) { if (G.jumpT > 0) o.jumped = true; else collide(o); } // 점프 중이면 넘어감
    } else if (z <= -0.6 && !o.passed) {
      o.passed = true;
      if (!o.hit && !o.jumped && o.minGap != null && o.minGap < 0.75 && !o.row.hit) nearMiss(o);
    }
  }
  // 줄을 무사히 지나면 콤보
  for (const o of G.obs) {
    const r = o.row;
    if (!r.done && o.Z - G.d < -0.6) {
      if (G.obs.every((p) => p.row !== r || p.Z - G.d < -0.6 || p.gone)) {
        r.done = true;
        if (!r.hit) addCombo();
      }
    }
  }
  G.obs = G.obs.filter((o) => o.Z - G.d > -4);
  // 아이템
  for (const it of G.items) {
    if (it.taken) continue;
    let z = it.Z - G.d;
    if (G.magnetT > 0 && it.kind === 'coin' && z < 9 && z > -0.5 && Math.abs(it.x - G.px) < 2.6) { // 자석: 끌어당김
      it.x = lerp(it.x, G.px, Math.min(1, dt * 10)); it.Z = lerp(it.Z, G.d, Math.min(1, dt * 8)); z = it.Z - G.d;
    }
    if (z < 0.7 && z > -0.7 && Math.abs(it.x - G.px) < 0.55) { it.taken = true; collect(it); }
  }
  G.items = G.items.filter((it) => !it.taken && it.Z - G.d > -4);
  G.deco = G.deco.filter((o) => o.Z - G.d > -6);
  // 발밑 눈보라
  if (Math.random() < dt * (20 + G.v * 2)) G.fx.push({ kind: 'spray', x: G.px + rand(-0.3, 0.3), z: -0.2, vx: rand(-0.6, 0.6), vy: rand(60, 160), y: 0, t: 0, life: rand(0.3, 0.6), r: rand(3, 7) });
}

function collide(o) {
  o.hit = true;
  const p = proj(o.Z - G.d, o.x);
  if (G.boostT > 0 || G.wingT > 0 || G.invT > 0) {
    if (G.invT > 0 && G.boostT <= 0 && G.wingT <= 0) { o.hit = false; return; } // 깜빡이는 동안은 그냥 통과
    if (G.boostT > 0 || SMALL.includes(o.type)) smash(o, p);
    return;
  }
  if (G.shield) {
    G.shield = false; renderBuffs(); smash(o, p); G.invT = 0.6;
    Audio.sfx('shield'); popText('보호막!', p.x, p.y - 90, '#3D8BFF');
    return;
  }
  o.row.hit = true;
  G.combo = 0;
  G.hitT = 0.45; G.invT = CFG.invuln; G.shake = 0.3;
  Audio.sfx('hit'); haptic(60);
  burst(p.x, p.y - 60, 'star', 6);
  burstSnow(p.x, p.y - 30, 14);
  if (GOD()) { popText('무적!', p.x, p.y - 100, '#D6344C'); return; }
  G.hearts--; renderHearts();
  if (G.hearts <= 0) { gameOver(); return; }
  popText(`하트 -1`, W / 2, H * 0.55, '#FF5C7A');
}
function smash(o, p) {
  o.gone = true; Audio.sfx('smash'); burstSnow(p.x, p.y - 30, 18);
  popText('쾅!', p.x, p.y - 80, '#FF9F2E');
}
function nearMiss(o) {
  const p = proj(0, o.x);
  const good = o.minGap < 0.45;
  popText(good ? 'CLOSE!' : 'NICE!', p.x, H * 0.62, good ? '#FF5C9A' : '#3D8BFF');
  addCoins(1);
  Audio.sfx('nice');
}
function addCombo() {
  G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo);
  if (G.combo % 10 === 0) { // 10콤보마다 보너스 코인 (높을수록 많이)
    const b = Math.min(10, G.combo / 5);
    addCoins(b); Audio.sfx('combo');
    popText(`${G.combo} COMBO! +${b * (G.x2T > 0 ? 2 : 1)}`, W / 2, H * 0.42, '#FF9F2E');
  }
}
function addCoins(n) { if (!GOD()) G.coins += n * (G.x2T > 0 ? 2 : 1); } // 무적: 코인 0
function startBoost(sec) { G.boostT = sec; Audio.sfx('boost'); popText('슝~!', W / 2, H * 0.55, '#FF9F2E'); renderBuffs(); }
function collect(it) {
  const p = proj(0, it.x), x = p.x, y = p.y - 70;
  const mult = G.x2T > 0 ? 2 : 1;
  switch (it.kind) {
    case 'coin': addCoins(1); Audio.sfx('coin'); sparkle(x, y, '#FFD34D'); break;
    case 'star': addCoins(5); Audio.sfx('star'); burst(x, y, 'star', 5); popText(`+${5 * mult}`, x, y - 20, '#FF9F2E'); break;
    case 'heart':
      Audio.sfx('item'); sparkle(x, y, '#FF5C7A');
      if (G.hearts < G.maxHearts) { G.hearts++; renderHearts(true); popText('하트 +1', x, y - 20, '#FF5C7A'); } else { addCoins(5); popText(`+${5 * mult}`, x, y - 20, '#FF9F2E'); }
      break;
    case 'magnet': G.magnetT = 8; Audio.sfx('item'); popText('자석!', x, y - 20, '#E84A5F'); renderBuffs(); break;
    case 'shield': G.shield = true; Audio.sfx('item'); popText('보호막!', x, y - 20, '#3D8BFF'); renderBuffs(); break;
    case 'bolt': startBoost(3.5); break;
    case 'jump': G.jumps++; renderJump(true); Audio.sfx('item'); popText('점프하기 +1', x, y - 20, '#22A55A'); break;
    case 'wing': G.wingT = 6; Audio.sfx('item'); popText('무적!', x, y - 20, '#3D8BFF'); renderBuffs(); break;
  }
}

// ---------- FX ----------
function popText(text, x, y, color) { G.texts.push({ text, x, y, color, t: 0, life: 0.9 }); }
function sparkle(x, y, color) { for (let i = 0; i < 6; i++) { const a = rand(0, 7); G.fx.push({ kind: 'dot', sx: x, sy: y, vx: Math.cos(a) * rand(80, 180), vy: Math.sin(a) * rand(80, 180), t: 0, life: 0.4, color, r: rand(3, 5) }); } }
function burst(x, y, name, n) { for (let i = 0; i < n; i++) { const a = (i / n) * 6.28 + rand(-0.3, 0.3); G.fx.push({ kind: 'spr', name, sx: x, sy: y, vx: Math.cos(a) * rand(120, 220), vy: Math.sin(a) * rand(120, 220) - 60, t: 0, life: 0.6, w: rand(18, 28) }); } }
function burstSnow(x, y, n) { for (let i = 0; i < n; i++) { const a = rand(3.4, 6.0); G.fx.push({ kind: 'dot', sx: x + rand(-20, 20), sy: y, vx: Math.cos(a) * rand(60, 240), vy: Math.sin(a) * rand(60, 240), g: 500, t: 0, life: 0.7, color: '#FFFFFF', r: rand(4, 9) }); } }
let bannerT = 0, bannerText = '';
function banner(text) { bannerText = text; bannerT = 2.2; }
function updateFx(dt) {
  for (const f of G.fx) {
    f.t += dt;
    if (f.kind === 'spray') { f.z -= G.v * dt * 0.25; f.y += f.vy * dt; f.x += f.vx * dt; }
    else { f.sx += f.vx * dt; f.sy += f.vy * dt; if (f.g) f.vy += f.g * dt; }
  }
  G.fx = G.fx.filter((f) => f.t < f.life);
  for (const s of G.texts) s.t += dt;
  G.texts = G.texts.filter((s) => s.t < s.life);
  if (G.shake > 0) G.shake -= dt;
  if (bannerT > 0) bannerT -= dt;
  if (G.stageFade < 1) G.stageFade = Math.min(1, G.stageFade + dt * 0.6);
  // 내리는 눈
  while (G.flakes.length < 60) G.flakes.push({ x: rand(0, 1), y: rand(0, 1), r: rand(1.5, 4), s: rand(0.3, 1) });
  const sp = G.state === 'play' ? G.v / CFG.v0 : 0.5;
  for (const f of G.flakes) { f.y += dt * (0.08 + f.s * 0.12) * sp; f.x += dt * Math.sin(G.t + f.s * 9) * 0.02; if (f.y > 1) { f.y = 0; f.x = rand(0, 1); } }
}
function haptic(ms) { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) try { navigator.vibrate(ms); } catch (e) { /* unsupported */ } }

// ---------- rendering ----------
// 원근: 캐릭터 위치(z=0)는 화면 아래쪽 PY, 아주 먼 곳은 지평선 HY로 모임
const HY = () => H * 0.3, PY = () => H * 0.78;
function proj(z, x) {
  const k = CFG.persp / (CFG.persp + Math.max(z, -CFG.persp * 0.8));
  const cam = G.px * 0.35; // 카메라도 살짝 따라감
  return { x: W / 2 + (x - cam) * CFG.laneW * k, y: HY() + (PY() - HY()) * k, k };
}

// 하늘 + 먼 산 (스테이지마다 한 번 그려 둠)
const skyCache = {};
function skyLayer(key, st) {
  const ck = key + W + 'x' + H;
  if (skyCache[ck]) return skyCache[ck];
  const hy = Math.round(HY()) + 2;
  const c = document.createElement('canvas'); c.width = W; c.height = hy;
  const g = c.getContext('2d');
  const R = rng(key.length * 131 + 7);
  const sky = g.createLinearGradient(0, 0, 0, hy);
  sky.addColorStop(0, st.sky[0]); sky.addColorStop(0.6, st.sky[1]); sky.addColorStop(1, st.sky[2]);
  g.fillStyle = sky; g.fillRect(0, 0, W, hy);
  if (st.night) { // 별
    for (let i = 0; i < 90; i++) { g.globalAlpha = 0.4 + R() * 0.6; g.fillStyle = '#fff'; g.beginPath(); g.arc(R() * W, R() * hy * 0.8, R() * 1.6 + 0.4, 0, 7); g.fill(); }
    g.globalAlpha = 1;
  }
  if (st.aurora) { // 오로라 띠
    for (let b = 0; b < 3; b++) {
      const grad = g.createLinearGradient(0, 0, 0, hy * 0.7);
      grad.addColorStop(0, 'rgba(120,255,200,0)'); grad.addColorStop(0.5, b === 1 ? 'rgba(170,120,255,.35)' : 'rgba(110,255,190,.38)'); grad.addColorStop(1, 'rgba(120,255,200,0)');
      g.fillStyle = grad; g.beginPath();
      const y0 = hy * (0.15 + b * 0.1), amp = 18 + b * 6;
      g.moveTo(0, y0);
      for (let x = 0; x <= W; x += 10) g.lineTo(x, y0 + Math.sin(x * 0.012 + b * 2) * amp);
      for (let x = W; x >= 0; x -= 10) g.lineTo(x, y0 + 70 + Math.sin(x * 0.01 + b) * amp);
      g.fill();
    }
  } else if (!st.night) { // 구름
    g.fillStyle = 'rgba(255,255,255,.75)';
    for (let i = 0; i < 5; i++) { const x = R() * W, y = R() * hy * 0.45 + 20, s = 20 + R() * 20; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + k * s * 0.8, y + Math.sin(k * 2) * 6, s * (0.7 + (k % 2) * 0.3), 0, 7); g.fill(); } }
  }
  const ridge = (color, base, amp, freq, caps) => {
    const pts = [];
    for (let x = -20; x <= W + 20; x += 18) pts.push([x, base - amp * (0.55 + 0.45 * Math.sin(x * freq + R() * 0.3)) * (0.7 + R() * 0.3)]);
    g.fillStyle = color; g.beginPath(); g.moveTo(-20, hy);
    for (const [x, y] of pts) g.lineTo(x, y);
    g.lineTo(W + 20, hy); g.fill();
    if (caps) { // 눈 덮인 봉우리
      g.fillStyle = 'rgba(255,255,255,.85)';
      for (let i = 1; i < pts.length - 1; i++) if (pts[i][1] < pts[i - 1][1] && pts[i][1] < pts[i + 1][1]) {
        const [x, y] = pts[i]; g.beginPath(); g.moveTo(x - 22, y + 18); g.lineTo(x, y); g.lineTo(x + 22, y + 18); g.lineTo(x + 8, y + 13); g.lineTo(x, y + 20); g.lineTo(x - 9, y + 13); g.fill();
      }
    }
  };
  ridge(st.far, hy - 30, st.ice ? 120 : 90, 0.011, true);
  if (st.ice) { // 얼음 폭포
    g.fillStyle = 'rgba(200,240,255,.8)';
    for (let i = 0; i < 4; i++) { const x = R() * W; g.fillRect(x, hy - 120 + R() * 30, 10 + R() * 12, 120); }
  }
  ridge(st.mid, hy - 6, 45, 0.02, !st.pines);
  if (st.pines) { // 숲
    g.fillStyle = '#3E7A5C';
    for (let x = -10; x < W + 10; x += 14 + R() * 10) { const h = 26 + R() * 26; g.beginPath(); g.moveTo(x, hy - h - 4); g.lineTo(x - 9, hy); g.lineTo(x + 9, hy); g.fill(); }
  }
  if (st.village) { // 마을 지붕
    for (let x = 10; x < W; x += 40 + R() * 40) {
      const w = 26 + R() * 18, h = 18 + R() * 16;
      g.fillStyle = '#E9E2D8'; g.fillRect(x, hy - h, w, h);
      g.fillStyle = R() < 0.5 ? '#C9584C' : '#5B7BB8'; g.beginPath(); g.moveTo(x - 4, hy - h); g.lineTo(x + w / 2, hy - h - 14); g.lineTo(x + w + 4, hy - h); g.fill();
      g.fillStyle = '#fff'; g.fillRect(x - 3, hy - h - 2, w + 6, 3);
      g.fillStyle = '#FFD86B'; g.fillRect(x + w * 0.35, hy - h * 0.6, 6, 6);
    }
  }
  return (skyCache[ck] = c);
}
// 스테이지 하늘: GPT 그림이 있으면 그 그림 (지평선을 HY에 맞추고, 화면이 그림보다 넓으면 좌우 뒤집어 이어 붙임), 없으면 직접 그림
function stageSky(i) {
  const im = SKY_IMG[i];
  if (!im.complete || !im.naturalWidth) return skyLayer('st' + i, STAGES[i]);
  const ck = 'img' + i + W + 'x' + H;
  if (skyCache[ck]) return skyCache[ck];
  const hy = Math.round(HY()) + 2;
  const c = document.createElement('canvas'); c.width = W; c.height = hy;
  const g = c.getContext('2d');
  const s = hy / SKY_HZ[i] * 1.04, iw = im.naturalWidth * s, ih = im.naturalHeight * s, y = hy - SKY_HZ[i] * s;
  if (iw >= W) g.drawImage(im, (W - iw) / 2, y, iw, ih);
  else for (let k = 0, x = (W / 2) % (2 * iw) - 2 * iw; x < W; k++, x += iw) {
    g.save(); if (k % 2) { g.translate(x + iw, 0); g.scale(-1, 1); g.drawImage(im, 0, y, iw, ih); } else g.drawImage(im, x, y, iw, ih); g.restore();
  }
  return (skyCache[ck] = c);
}
function drawSky() {
  const sk = G.skin && G.skin !== 'default' ? G.skin : null;
  if (sk && window.Skins && window.Skins.has(sk)) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, HY() + 2); ctx.clip();
    window.Skins.draw(ctx, sk, W, HY() + 2, G.d * 6, 0, G.t);
    ctx.restore(); return;
  }
  if (sk && SKIN_SKY[sk]) { ctx.drawImage(skyLayer('skin_' + sk, SKIN_SKY[sk]), 0, 0); return; }
  if (G.stageFade < 1) { ctx.drawImage(stageSky(G.prevStage), 0, 0); ctx.globalAlpha = G.stageFade; }
  ctx.drawImage(stageSky(G.stageIdx), 0, 0);
  ctx.globalAlpha = 1;
}
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map((s) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, t)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function drawGround() {
  const hy = HY();
  const a = STAGES[G.prevStage], b = STAGES[G.stageIdx], f = G.stageFade;
  const gr = ctx.createLinearGradient(0, hy, 0, H);
  gr.addColorStop(0, mix(a.snow[0], b.snow[0], f)); gr.addColorStop(1, mix(a.snow[1], b.snow[1], f));
  ctx.fillStyle = gr; ctx.fillRect(0, hy, W, H - hy);
  // 지평선 안개
  const fog = ctx.createLinearGradient(0, hy - 6, 0, hy + 40);
  fog.addColorStop(0, 'rgba(255,255,255,0)'); fog.addColorStop(0.3, 'rgba(255,255,255,.55)'); fog.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = fog; ctx.fillRect(0, hy - 6, W, 46);
  // 길 (조금 더 밝은 눈) + 썰매 자국
  const L = proj(400, -2.7), R = proj(400, 2.7), L0 = proj(-5, -2.7), R0 = proj(-5, 2.7);
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  ctx.beginPath(); ctx.moveTo(L.x, L.y); ctx.lineTo(R.x, R.y); ctx.lineTo(R0.x, R0.y); ctx.lineTo(L0.x, L0.y); ctx.fill();
  ctx.strokeStyle = 'rgba(150,185,220,.22)'; ctx.lineWidth = 2;
  for (const x of [-1.5, -0.5, 0.5, 1.5]) { const p = proj(400, x), q = proj(-5, x); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
  // 속도감: 눈 위 굴곡 줄무늬가 다가옴
  ctx.fillStyle = 'rgba(140,175,215,.16)';
  const sp = 5;
  for (let i = 0; i < 16; i++) {
    const z = (i * sp - (G.d % sp));
    if (z < -3) continue;
    const p = proj(z, -2.7), q = proj(z, 2.7);
    ctx.fillRect(p.x, p.y, q.x - p.x, Math.max(1, 5 * p.k));
  }
}
function drawFence(side) {
  // 길 양쪽 나무 울타리 (기둥이 다가옴)
  const sp = 3.5, x = side * 2.95;
  const posts = [];
  for (let i = 0; i < 22; i++) { const z = i * sp - (G.d % sp) - sp; posts.push(proj(z, x)); }
  return posts;
}

function render() {
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  ctx.save();
  if (G.shake > 0) ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
  drawSky();
  drawGround();
  if (G.state === 'home') { drawSnow(); ctx.restore(); return; }
  // 그릴 것들을 먼 순서대로
  const list = [];
  for (const o of G.deco) list.push({ z: o.Z - G.d, o, kind: 'deco' });
  for (const o of G.obs) if (!o.gone) list.push({ z: o.Z - G.d, o, kind: 'obs' });
  for (const o of G.items) list.push({ z: o.Z - G.d, o, kind: 'item' });
  for (const side of [-1, 1]) drawFence(side).forEach((p, i) => list.push({ z: i, p, kind: 'post', side }));
  for (const l of list) if (l.kind === 'post') l.z = (l.p.k ? CFG.persp / l.p.k - CFG.persp : 0);
  list.push({ z: 0.01, kind: 'player' });
  list.sort((a, b) => b.z - a.z);
  // 울타리 가로대 (기둥 뒤에)
  for (const side of [-1, 1]) {
    const posts = drawFence(side).filter((p) => p.y < H + 60);
    ctx.strokeStyle = '#9A6A3E'; ctx.lineCap = 'round';
    for (const hh of [0.5, 0.85]) {
      ctx.beginPath();
      posts.forEach((p, i) => { const y = p.y - 46 * p.k * hh; i ? ctx.lineTo(p.x, y) : ctx.moveTo(p.x, y); });
      ctx.lineWidth = 3; ctx.stroke();
    }
  }
  for (const l of list) {
    if (l.z > CFG.spawnAhead + 5) continue;
    if (l.kind === 'player') { drawPlayer(); continue; }
    if (l.kind === 'post') { drawPost(l.p); continue; }
    const p = proj(l.z, l.o.x);
    if (p.y > H + 200) continue;
    const fade = clamp((CFG.spawnAhead - l.z) / 12, 0, 1); // 멀리서 서서히 나타남
    if (l.kind === 'deco') drawDeco(l.o, p, fade);
    else if (l.kind === 'obs') drawObs(l.o, p, fade);
    else drawItem(l.o, p, fade);
  }
  drawFx();
  drawSnow();
  // 부스터: 속도선
  if (G.boostT > 0 && G.state === 'play') {
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3;
    for (let i = 0; i < 14; i++) { const a = rand(0, 6.28), r0 = rand(160, 260), r1 = r0 + rand(60, 140); const cx = W / 2, cy = HY(); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 1.4); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 1.4); ctx.stroke(); }
  }
  ctx.restore();
  // 글자
  for (const s of G.texts) {
    const k = s.t / s.life;
    ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
    ctx.font = '32px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 7; ctx.strokeStyle = '#fff'; ctx.strokeText(s.text, s.x, s.y - k * 50);
    ctx.fillStyle = s.color; ctx.fillText(s.text, s.x, s.y - k * 50);
  }
  ctx.globalAlpha = 1;
  if (G.combo >= 3 && G.state === 'play') {
    ctx.font = '26px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(24,40,62,.75)';
    const y = HY() + 34 + (Root.safeT || 0);
    ctx.strokeText(`${G.combo} COMBO`, W / 2, y); ctx.fillStyle = '#FFD34D'; ctx.fillText(`${G.combo} COMBO`, W / 2, y);
  }
  if (G.state === 'ready') {
    const a = 0.75 + Math.sin(G.t * 5) * 0.25;
    ctx.globalAlpha = a; drawLabel('TAP TO START', W / 2, H * 0.4, 40); ctx.globalAlpha = 1;
    drawLabel(isTouch ? '화면 왼쪽·오른쪽을 눌러 피해요' : '← → 키로 피해요', W / 2, H * 0.4 + 62, 20);
  }
  if (bannerT > 0) {
    const k = bannerT > 1.9 ? (2.2 - bannerT) / 0.3 : bannerT < 0.4 ? bannerT / 0.4 : 1;
    ctx.globalAlpha = k; drawLabel(bannerText, W / 2, H * 0.24, 34); ctx.globalAlpha = 1;
  }
}
const Root = { safeT: 0 };
function drawPost(p) {
  if (p.y > H + 60 || p.k <= 0) return;
  const w = Math.max(2, 9 * p.k), h = 52 * p.k;
  ctx.fillStyle = '#8A5A32'; ctx.fillRect(p.x - w / 2, p.y - h, w, h);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(p.x, p.y - h, w * 0.75, w * 0.45, 0, 0, 7); ctx.fill();
}
function drawDeco(o, p, fade) {
  if (o.kind === 'house') { drawHouse(p, fade); return; }
  const s = (o.kind === 'trees' ? 2.0 : o.kind === 'tree' ? 1.5 : 1.1) * CFG.laneW * p.k;
  spr(ctx, o.kind, p.x, p.y + 4 * p.k, s, { anchor: 'b', alpha: fade, flip: o.flip });
}
function drawHouse(p, fade) {
  if (HOUSE_IMG.complete && HOUSE_IMG.naturalWidth) {
    const w = 150 * p.k, h = w * HOUSE_IMG.naturalHeight / HOUSE_IMG.naturalWidth;
    ctx.save(); ctx.globalAlpha = fade; ctx.drawImage(HOUSE_IMG, p.x - w / 2, p.y - h + 4 * p.k, w, h); ctx.restore(); return;
  }
  const w = 130 * p.k, h = 80 * p.k;
  ctx.save(); ctx.globalAlpha = fade;
  ctx.fillStyle = '#C98B5A'; ctx.fillRect(p.x - w / 2, p.y - h, w, h);
  ctx.fillStyle = '#FFD86B'; ctx.fillRect(p.x - w * 0.3, p.y - h * 0.65, w * 0.18, h * 0.25); ctx.fillRect(p.x + w * 0.12, p.y - h * 0.65, w * 0.18, h * 0.25);
  ctx.fillStyle = '#7A4A2A'; ctx.fillRect(p.x - w * 0.08, p.y - h * 0.45, w * 0.16, h * 0.45);
  ctx.fillStyle = '#B54A3E'; ctx.beginPath(); ctx.moveTo(p.x - w * 0.62, p.y - h); ctx.lineTo(p.x, p.y - h * 1.75); ctx.lineTo(p.x + w * 0.62, p.y - h); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(p.x - w * 0.66, p.y - h * 0.98); ctx.lineTo(p.x, p.y - h * 1.8); ctx.lineTo(p.x + w * 0.66, p.y - h * 0.98); ctx.lineTo(p.x + w * 0.5, p.y - h * 1.12); ctx.lineTo(p.x, p.y - h * 1.6); ctx.lineTo(p.x - w * 0.5, p.y - h * 1.12); ctx.fill();
  ctx.restore();
}
function drawObs(o, p, fade) {
  const def = OBS[o.type];
  const w = def.s * CFG.laneW * p.k;
  // 그림자
  ctx.fillStyle = 'rgba(70,100,140,.18)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y, w * 0.5, w * 0.12, 0, 0, 7); ctx.fill();
  const name = def.img || o.type;
  if (o.type === 'snowball' || o.type === 'bigball') {
    const h = w; spr(ctx, name, p.x, p.y - h / 2, w, { rot: -o.rot, alpha: fade });
  } else if (o.type === 'penguin') {
    spr(ctx, name, p.x, p.y + 2 * p.k, w, { anchor: 'b', alpha: fade, flip: o.vx < 0, rot: Math.sin(G.t * 12) * 0.12 });
  } else if (def.flat) {
    spr(ctx, name, p.x, p.y, w, { alpha: fade });
  } else spr(ctx, name, p.x, p.y + 3 * p.k, w, { anchor: 'b', alpha: fade });
}
function drawItem(it, p, fade) {
  const w = (it.kind === 'coin' ? 0.42 : 0.55) * CFG.laneW * p.k;
  const y = p.y - 44 * p.k + Math.sin(G.t * 5 + it.Z) * 4 * p.k;
  ctx.fillStyle = 'rgba(70,100,140,.15)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y, w * 0.4, w * 0.12, 0, 0, 7); ctx.fill();
  if (it.kind !== 'coin') { ctx.save(); ctx.globalAlpha = 0.35 * fade; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, y, w * 0.7, 0, 7); ctx.fill(); ctx.restore(); }
  const pic = it.kind === 'jump' ? JUMP_IMG : it.kind === 'heart' ? HEART_IMG : null; // 그림 파일로 그리는 아이템
  if (pic) {
    if (pic.complete && pic.naturalWidth) { const pw = w * 1.25, ph = pw * pic.naturalHeight / pic.naturalWidth; ctx.save(); ctx.globalAlpha = fade; ctx.drawImage(pic, p.x - pw / 2, y - ph / 2, pw, ph); ctx.restore(); }
    return;
  }
  spr(ctx, it.kind, p.x, y, w, { alpha: fade, sx: it.kind === 'coin' ? Math.max(0.25, Math.abs(Math.cos(G.t * 4 + it.Z))) : 1 });
}
function drawFx() {
  for (const f of G.fx) {
    const k = f.t / f.life;
    if (f.kind === 'spray') {
      const p = proj(f.z, f.x);
      ctx.globalAlpha = (1 - k) * 0.9; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(p.x, p.y - 4 + f.y * 0.2, f.r * (1 + k), 0, 7); ctx.fill();
    } else if (f.kind === 'dot') {
      ctx.globalAlpha = 1 - k; ctx.fillStyle = f.color;
      ctx.beginPath(); ctx.arc(f.sx, f.sy, f.r, 0, 7); ctx.fill();
    } else if (f.kind === 'spr') {
      spr(ctx, f.name, f.sx, f.sy, f.w, { alpha: 1 - k, rot: k * 4 });
    }
  }
  ctx.globalAlpha = 1;
}
function drawSnow() {
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  for (const f of G.flakes) { ctx.beginPath(); ctx.arc(f.x * W, f.y * H, f.r, 0, 7); ctx.fill(); }
}
// 뒷모습 코스튬 그림이 있는 옷 (기획 시트 06)
const BACK_COSTUME = { eunyu: ['hanbok', 'raincoat', 'pajamas', 'roman', 'dino'], eungyeol: ['wizard', 'santa', 'baseball', 'suit', 'detective'] };
function drawPlayer() {
  const p = proj(0, G.px);
  const who = lookOf(Save.data.char);
  if (window.CharV2 && CharV2.is(who)) CharV2.load(who);
  const blink = G.invT > 0 && G.hitT <= 0 && Math.floor(G.t * 16) % 2 === 0;
  if (blink && G.state === 'play') return;
  // 그림자
  const air = jumpAir(), sh = 1 - air / CFG.jumpH * 0.45;
  ctx.fillStyle = 'rgba(70,100,140,.25)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y, 40 * sh, 11 * sh, 0, 0, 7); ctx.fill();
  let pose = 'idle';
  if (G.state === 'over' || G.state === 'result') pose = 'dead';
  else if (G.hitT > 0) pose = 'hit';
  else if (G.boostT > 0) pose = 'boost';
  else if (G.lean < -0.35) pose = 'left';
  else if (G.lean > 0.35) pose = 'right';
  const running = G.state === 'play';
  const bob = running ? -Math.abs(Math.sin(G.t * 14)) * 5 : Math.sin(G.t * 3) * 2;
  const sway = running ? Math.sin(G.t * 7) * 0.03 : 0;
  const h = 132;
  const cos = HUB ? HUB.costume() : null;
  const back = cos && BACK_COSTUME[who] && BACK_COSTUME[who].includes(cos) ? `${who}_c_${cos}` : null;
  ctx.save(); ctx.translate(p.x, p.y + 4 + (air ? -air : bob));
  if (G.wingT > 0) { spr(ctx, 'wing', -38, -h * 0.7, 56, { flip: true, alpha: 0.9, rot: Math.sin(G.t * 10) * 0.2 }); spr(ctx, 'wing', 38, -h * 0.7, 56, { alpha: 0.9, rot: -Math.sin(G.t * 10) * 0.2 }); }
  if (window.CharV2 && CharV2.is(who) && CharV2.ready(who)) { // 새 캐릭터(v2) 뒷모습
    const name = { idle: running ? `back_run_${Math.floor(G.t * 8) % 2}` : 'back_run_0', left: 'back_left', right: 'back_right', hit: 'back_hit', dead: 'back_dead', boost: 'back_boost', happy: 'back_happy' }[pose] || 'back_run_0';
    CharV2.draw(ctx, who, name, { h: h * 0.96, rot: pose === 'idle' ? sway : 0 });
  } else if (back) { // 코스튬 뒷모습: 기울여서 좌우 이동 표현
    const rot = pose === 'dead' ? 0.5 : pose === 'hit' ? Math.sin(G.t * 40) * 0.15 : G.lean * 0.16 + sway;
    drawFit(back, h * 0.92, rot);
  } else if (cos && window.Costume && Costume.ready()) { // 뒷모습 그림이 없는 옷은 앞모습 그림으로
    ctx.rotate(G.lean * 0.12);
    Costume.draw(ctx, { idle: 'run', left: 'run', right: 'run', boost: 'run', hit: 'hit', dead: 'dead' }[pose], G.t, { h: 120 });
  } else drawFit(`${who}_${pose}`, h, pose === 'idle' ? sway : 0);
  ctx.restore();
  if (G.shield && G.state === 'play') { ctx.save(); ctx.globalAlpha = 0.35 + Math.sin(G.t * 8) * 0.1; ctx.fillStyle = 'rgba(140,210,255,.25)'; ctx.strokeStyle = '#8FD3FF'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, p.y - 62 - air, 74, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); }
}
// 높이를 맞춰서 그림 (프레임마다 그림 크기가 달라서)
function drawFit(name, h, rot) {
  if (!SP.ready || !SP.f[name]) return;
  const [, , fw, fh] = SP.f[name];
  const ref = SP.f[`${Save.data.char}_idle`] ? SP.f[`${Save.data.char}_idle`][3] : fh;
  const hh = h * fh / ref;
  spr(ctx, name, 0, 0, hh * fw / fh, { anchor: 'b', rot });
}
function drawLabel(text, x, y, size) {
  ctx.font = `${size}px Jua, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 44;
  ctx.fillStyle = 'rgba(24,40,62,.72)';
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - size * 0.85, w, size * 1.7, size * 0.85); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(text, x, y + 1);
}

// ---------- HUD ----------
let lastHud = '';
function updateHud() {
  const key = Math.floor(G.d) + '|' + G.coins;
  if (key === lastHud) return;
  lastHud = key;
  $('hudDist').textContent = Math.floor(G.d).toLocaleString(); $('hudCoin').textContent = G.coins;
}
function renderHearts(pop) {
  const el = $('hudHearts'); el.innerHTML = '';
  const url = `../common/ui/heart.webp?v=${ASSET_V}`, off = `../common/ui/heart_empty.webp?v=${ASSET_V}`;
  for (let i = 0; i < G.maxHearts; i++) {
    const d = document.createElement('div');
    d.className = 'heart' + (i >= G.hearts ? ' empty' : '') + (pop && i === G.hearts - 1 ? ' pop' : '');
    d.style.backgroundImage = `url(${i >= G.hearts ? off : url})`;
    el.appendChild(d);
  }
}
function renderBuffs() {
  const el = $('buffs'); el.innerHTML = '';
  const add = (name, label) => {
    const d = document.createElement('div'); d.className = 'buff';
    const i = document.createElement('i'); i.style.backgroundImage = `url(${iconURL(name)})`;
    d.appendChild(i); d.appendChild(document.createTextNode(label)); el.appendChild(d);
  };
  if (G.shield) add('shield', '보호막');
  if (G.wingT > 0) add('wing', '무적');
  if (G.magnetT > 0) add('magnet', '자석');
  if (G.x2T > 0) add('coin', '2배');
  if (G.boostT > 0) add('bolt', '슝~');
}

// 점프하기 버튼: 1개 이상 있을 때만 화살표 버튼 가운데에, 몇 개 있는지 숫자로
function renderJump(pop) {
  const b = $('btnJump');
  b.classList.toggle('hidden', G.jumps <= 0);
  $('jumpN').textContent = G.jumps;
  if (pop) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
}

// ---------- screens ----------
function setState(s) {
  G.state = s;
  $('home').classList.toggle('hidden', s !== 'home');
  $('pause').classList.toggle('hidden', s !== 'pause');
  $('result').classList.toggle('hidden', s !== 'result');
  $('hud').classList.toggle('hidden', !['ready', 'play', 'pause', 'over'].includes(s));
  $('touch').classList.toggle('hidden', !['ready', 'play'].includes(s));
  if (s === 'home') refreshHome();
}
function refreshHome() {
  document.querySelectorAll('.char').forEach((b) => b.classList.toggle('on', b.dataset.char === Save.data.char));
  $('totalCoin').textContent = Save.data.totalCoin || 0;
  $('bestAll').textContent = Save.data.best || 0;
  document.body.classList.toggle('muted', !Save.data.sound);
}
function gameOver() { G.state = 'over'; G.overT = 0; Audio.sfx('gameover'); Audio.stopBgm(); setState('over'); }
function showResult() {
  const m = Math.floor(G.d);
  const isBest = m > (Save.data.best || 0) && m > 0;
  if (isBest) Save.data.best = m;
  Save.data.totalCoin = (Save.data.totalCoin || 0) + G.coins;
  if (!HUB) Save.store();
  $('resEarn').classList.toggle('hidden', !HUB);
  if (HUB) {
    const h = HUB.record('downhill', { dist: m, coins: G.coins - G.coinBase }); // 이어하기 전에 받은 코인은 빼고
    $('resEarn').innerHTML = h.god ? '무적 모드라서 기록·코인이 없어요' : `+${h.earned} 코인 획득!` + (h.bonus ? ` <small>(거리 보너스 +${h.bonus})</small>` : '') + `<small>내 코인 ${h.coins}</small>`;
  }
  $('resFace').src = window.CharV2 && CharV2.is(lookOf(Save.data.char)) ? CharV2.url(lookOf(Save.data.char), isBest ? 'back_happy' : 'back_dead') : iconURL(`${Save.data.char}_${isBest ? 'happy' : 'dead'}`);
  $('resDist').textContent = m.toLocaleString(); $('resCoin').textContent = G.coins; $('resCombo').textContent = G.maxCombo;
  $('resBestVal').textContent = (Save.data.best || 0).toLocaleString();
  $('resBest').classList.toggle('hidden', !isBest);
  if (isBest) Audio.sfx('best');
  setState('result');
}
let pausedFrom = 'play';
function pauseGame() { if (G.state === 'play' || G.state === 'ready') { pausedFrom = G.state; setState('pause'); Audio.stopBgm(); } }
function resumeGame() { if (G.state === 'pause') { setState(pausedFrom); Audio.startBgm(); last = performance.now(); } }
function goHome() { Audio.stopBgm(); if (HUB) location.href = '../index.html#lobby'; else setState('home'); }

// ---------- input ----------
function bindPad(id, dir) {
  const el = $(id);
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.classList.add('down'); move(dir); });
  const up = () => el.classList.remove('down');
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
}
bindPad('padL', -1);
bindPad('padR', 1);
$('btnJump').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); useJump(); });
root.addEventListener('pointerdown', () => Audio.unlock());
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
window.addEventListener('keydown', (e) => {
  Audio.unlock();
  const k = e.code;
  if ((k === 'ArrowUp' || k === 'KeyW') && (G.state === 'play' || G.state === 'ready')) { e.preventDefault(); useJump(); return; }
  if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'KeyA' || k === 'KeyD' || k === 'Space') {
    e.preventDefault();
    if (G.state === 'play' || G.state === 'ready') {
      if (k === 'Space') { if (G.state === 'ready') go(); return; }
      const dir = k === 'ArrowLeft' || k === 'KeyA' ? -1 : 1;
      move(dir);
      const pad = $(dir < 0 ? 'padL' : 'padR'); pad.classList.add('down'); setTimeout(() => pad.classList.remove('down'), 90);
    } else if (!e.repeat && (G.state === 'home' || G.state === 'result')) startRun();
    else if (G.state === 'pause') resumeGame();
  } else if (k === 'Escape' || k === 'KeyP') {
    if (G.state === 'play' || G.state === 'ready') pauseGame(); else if (G.state === 'pause') resumeGame();
  } else if (k === 'KeyR' && G.state !== 'home' && G.state !== 'over') startRun();
  else if (k === 'Enter' && (G.state === 'home' || G.state === 'result')) startRun();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('blur', () => pauseGame());

const click = (id, fn) => $(id).addEventListener('click', () => { Audio.unlock(); Audio.sfx('ui'); fn(); });
click('btnStart', startRun);
click('btnPause', pauseGame);
click('btnResume', resumeGame);
click('btnRetryP', startRun);
click('btnHomeP', goHome);
click('btnRetry', askStart);
click('btnHomeR', goHome);
click('btnSound', () => { Save.data.sound = !Save.data.sound; Save.store(); if (HUB) HUB.setSound(Save.data.sound); Audio.applyMute(); refreshHome(); });
document.querySelectorAll('.char').forEach((b) => b.addEventListener('click', () => {
  Audio.unlock(); Audio.sfx('ui'); Save.data.char = b.dataset.char; Save.store(); refreshHome();
}));

// ---------- layout ----------
// 폰: 세로 화면 (가로로 들면 게임을 돌려서 세로로 보여 줌) / PC: 창 전체 가로 화면
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
function resize() {
  const vv = window.visualViewport;
  const vw = Math.round(vv ? vv.width : window.innerWidth), vh = Math.round(window.fullViewH ? fullViewH() : (vv ? vv.height : window.innerHeight));
  const s = $('safe').getBoundingClientRect();
  const inset = { t: s.top, l: s.left, r: vw - s.right, b: vh - s.bottom };
  const rotated = isTouch && vw > vh;
  const sw = rotated ? vh : vw, sh = rotated ? vw : vh;
  if (isTouch) { W = 540; H = Math.round(clamp(W * sh / sw, 860, 1240)); }
  else { H = 960; W = Math.round(clamp(H * vw / vh, 540, 2400)); }
  scale = Math.min(sw / W, sh / H);
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  root.style.width = W + 'px'; root.style.height = H + 'px';
  root.classList.toggle('wide', W > 700);
  const ox = (sw - W * scale) / 2, oy = (sh - H * scale) / 2;
  root.style.transform = rotated
    ? `translate(${oy}px, ${vh - ox}px) rotate(-90deg) scale(${scale})`
    : `translate(${ox}px, ${oy}px) scale(${scale})`;
  const insT = rotated ? inset.l : inset.t, insB = rotated ? inset.r : inset.b;
  Root.safeT = Math.max(0, (insT - oy) / scale);
  root.style.setProperty('--safe-t', Root.safeT + 'px');
  root.style.setProperty('--safe-b', Math.max(0, (insB - oy) / scale) + 'px');
  canvas.width = Math.round(W * scale * dpr); canvas.height = Math.round(H * scale * dpr);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

// ---------- main loop ----------
let last = performance.now(), acc = 0;
const DT = 1 / 120;
function frame(now) {
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.05) dt = 0.05;
  if (['ready', 'play', 'over'].includes(G.state)) {
    acc += dt;
    while (acc >= DT) { step(DT); acc -= DT; if (!['ready', 'play', 'over'].includes(G.state)) break; }
    updateHud();
  } else { acc = 0; updateFx(dt); }
  render();
  requestAnimationFrame(frame);
}
resize();
if (HUB) { if (new URLSearchParams(location.search).get('go') === '1') askStart(); startRun(); } else setState('home'); // 인트로 START: 시작 팝업(아이템 고르기) — 먼저 띄워 뒤에 깔리는 판이 아이템을 쓰지 않게
requestAnimationFrame(frame);

// debug/test hook
window.__downhill = { G, CFG, move, step, DT, startRun, setState, go, useJump, renderJump };
