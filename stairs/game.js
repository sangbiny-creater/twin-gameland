'use strict';
// 은유와 은결의 계단 오르기 — 무한의 계단 방식 세로형 게임 (HTML5 Canvas, no dependencies)
//  · 위로 가기: 보고 있는 방향으로 한 칸 올라감
//  · 방향 전환: 반대 방향으로 몸을 돌리면서 한 칸 올라감 (무한의 계단과 같은 규칙)
//  · 시간이 계속 줄고, 계단을 오르면 조금씩 늘어남. 0이 되거나 헛디디면 끝
//  · 처음엔 목숨이 없고, 하트를 먹으면 목숨(이어하기)이 생김 (최대 3개)
// 폰: 세로 화면 전용 (논리 폭 540, 높이는 화면 비율대로)
// PC: 창 전체를 쓰는 가로 화면 (논리 높이 960, 폭은 화면 비율대로)

let W = 540;
const CFG = {
  stepDX: 62, stepDY: 58, blockW: 86,
  time0: 20, timeMax: 30,
  hopDur: 0.085, boostDur: 0.055,
  heartsMax: 3,
  themeEvery: 100,
};

// 아이템샵 스킨 → 이 게임에 있는 배경 그림 번호 (없는 스킨은 common/skins.js가 그림)
const SKIN_BG = { forest: 1, park: 2, winter: 3, sunset: 4 };
const THEMES = [
  { name: '하늘도시', bg: 0, block: 'st_basic' },
  { name: '숲속 마을', bg: 1, block: 'st_grass' },
  { name: '놀이공원', bg: 2, block: 'st_wide' },
  { name: '겨울왕국', bg: 3, block: 'st_ice' },
  { name: '석양의 항구', bg: 4, block: 'st_metal' },
];

// ---------- save ----------
const Save = {
  data: { char: 'eunyu', best: 0, totalCoin: 0, sound: true },
  load() { try { Object.assign(this.data, JSON.parse(localStorage.getItem('stairs_v1') || '{}')); } catch (e) { /* private mode */ } },
  store() { try { localStorage.setItem('stairs_v1', JSON.stringify(this.data)); } catch (e) { /* ignore */ } },
};
Save.load();
// 트윈 게임랜드(메인 화면)에서 들어왔으면 그 캐릭터로 플레이하고 기록·코인을 공통 저장소에 남긴다
const HUB = window.Hub && window.Hub.active() ? window.Hub : null;
if (HUB) {
  Save.data.char = HUB.active().look; Save.data.sound = HUB.settings.sound;
  Save.data.best = HUB.rec('stairs').best;
}

// ---------- utils ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + (b - a) * Math.random();
const $ = (id) => document.getElementById(id);

// ---------- sprites ----------
const ASSET_V = '202610272337'; // 캐시 버전 (tools/bump_version.py가 올림)
const SP = { img: new Image(), f: null, ready: false, bg: [] };
fetch(`assets/sprites/sprites.json?v=${ASSET_V}`).then((r) => r.json()).then((j) => {
  SP.f = j;
  SP.img.onload = () => { SP.ready = true; renderBuffs(); };
  SP.img.src = `assets/sprites/sprites.webp?v=${ASSET_V}`;
});
for (let i = 0; i < 5; i++) { const im = new Image(); im.src = `assets/bg/bg_${i}.webp?v=${ASSET_V}`; SP.bg.push(im); }
// preload both arrows so the turn button never blinks while switching
const ARROWS = ['btn_left', 'btn_right'].map((n) => { const im = new Image(); im.src = `assets/ui/${n}.webp`; return im; });
// draw sprite with its width scaled to w; anchor: 'c' center, 'b' bottom-center
function spr(g, name, x, y, w, { rot = 0, alpha = 1, flip = false, anchor = 'c' } = {}) {
  if (!SP.ready || !SP.f[name]) return 0;
  const [sx, sy, sw, sh] = SP.f[name];
  const h = w * sh / sw;
  g.save();
  g.globalAlpha = alpha;
  g.translate(x, y);
  if (rot) g.rotate(rot);
  if (flip) g.scale(-1, 1);
  g.drawImage(SP.img, sx, sy, sw, sh, -w / 2, anchor === 'b' ? -h : -h / 2, w, h);
  g.restore();
  return h;
}

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
      this.bgmGain = this.ctx.createGain(); this.bgmGain.gain.value = 0.12; this.bgmGain.connect(this.master);
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
  sfx(name, k = 0) {
    const r = 1 + (Math.random() - 0.5) * 0.06;
    switch (name) {
      case 'step': this.tone((520 + (k % 8) * 40) * r, 0.05, 'square', 0.1); break;
      case 'turn': this.tone(420 * r, 0.06, 'triangle', 0.2, 200); break;
      case 'coin': this.tone(988 * r, 0.05, 'square', 0.1); this.tone(1319 * r, 0.1, 'square', 0.1, 0, 0.04); break;
      case 'gem': [1318, 1760, 2349].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.25, 0, i * 0.04)); break;
      case 'item': [660, 880, 1100, 1320].forEach((f, i) => this.tone(f, 0.11, 'triangle', 0.28, 0, i * 0.045)); break;
      case 'time': [880, 1175, 1568].forEach((f, i) => this.tone(f, 0.12, 'sine', 0.3, 0, i * 0.05)); break;
      case 'hit': this.noise(0.2, 0.35, 0, 400); this.tone(260, 0.25, 'square', 0.2, -150); break;
      case 'fall': this.tone(700, 0.6, 'triangle', 0.28, -560); break;
      case 'gameover': [523, 440, 349, 262].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.3, 0, i * 0.17)); break;
      case 'tick': this.tone(1500, 0.04, 'square', 0.12); break;
      case 'boost': this.tone(300, 0.4, 'sawtooth', 0.12, 900); break;
      case 'crack': this.noise(0.12, 0.3, 0, 800); break;
      case 'theme': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.15, 'square', 0.13, 0, i * 0.08)); break;
      case 'best': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.3, 0, i * 0.07)); break;
      case 'ui': this.tone(700, 0.06, 'triangle', 0.25); break;
    }
  },
  melody: [72, 76, 79, 76, 81, 79, 76, 74, 72, 74, 76, 79, 77, 76, 74, 0, 72, 76, 79, 84, 83, 81, 79, 76, 77, 79, 81, 79, 76, 74, 72, 0],
  bass: [48, 48, 55, 55, 57, 57, 53, 55, 48, 48, 55, 55, 53, 55, 43, 47],
  startBgm() {
    if (this.bgmOn || !this.ctx) { this.bgmOn = true; return; }
    this.bgmOn = true; this.nextNote = this.ctx.currentTime + 0.1;
    clearInterval(this.timer); this.timer = setInterval(() => this.schedule(), 30);
  },
  stopBgm() { this.bgmOn = false; clearInterval(this.timer); this.timer = null; },
  schedule() {
    if (!this.ctx || !this.bgmOn) return;
    const stepDur = 60 / 150 / 2;
    const mf = (n) => 440 * Math.pow(2, (n - 69) / 12);
    while (this.nextNote < this.ctx.currentTime + 0.15) {
      const when = this.nextNote - this.ctx.currentTime;
      const m = this.melody[this.step % 32];
      if (m) this.tone(mf(m), stepDur * 0.8, 'square', 0.2, 0, when, this.bgmGain);
      if (this.step % 2 === 0) this.tone(mf(this.bass[(this.step / 2) % 16]), stepDur * 1.7, 'triangle', 0.6, 0, when, this.bgmGain);
      if (this.step % 2 === 1) this.noise(0.02, 0.1, when, 7000, this.bgmGain);
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
  state: 'home', // home | ready | play | fall | pause | result
  t: 0, steps: [], idx: 0, dir: 1, hearts: 0, coins: 0, time: CFG.time0,
  anim: null, queue: [], boost: 0, boostT: 0, wing: 0, shield: false, magnetT: 0, x2T: 0,
  cam: { x: 0, y: 0 }, fx: [], texts: [], deco: [], fallT: 0, fallReason: '', pose: 'ready', poseT: 0,
  themeIdx: 0, prevTheme: 0, themeFade: 1, newBest: false, shake: 0, tickT: 0, pos: { x: 0, y: 0 }, vy: 0, rot: 0,
};

function themeAt(i) { return Math.floor(i / CFG.themeEvery) % THEMES.length; }

// ---------- stairs generation ----------
let genDir = 1, genRun = 0;
function genStep(i) {
  const prev = G.steps[i - 1];
  if (!prev) return { col: 0, type: 'normal', item: null };
  if (genRun <= 0) {
    // 계단은 몇 칸씩 같은 방향으로 가다가 꺾인다. 올라갈수록 자주 꺾임
    const longest = i < 15 ? 6 : i < 150 ? 5 : 4;
    genRun = 1 + Math.floor(Math.random() * longest);
    if (i > 6) genDir = -genDir;
  }
  genRun--;
  const s = { col: prev.col + genDir, type: 'normal', item: null };
  // 꺾이는 곳 바로 옆(헛디디는 자리)에 가끔 가시 블록
  if (i > 80 && prev.col - (G.steps[i - 2] ? G.steps[i - 2].col : prev.col) !== genDir && Math.random() < 0.3) s.decoy = prev.col - genDir;
  const r = Math.random();
  if (i > 40 && r < 0.06) s.type = 'break';
  else if (i > 30 && r < 0.085) s.type = 'speed';
  else if (i > 10 && r < 0.115) s.type = 'special';
  if (s.type === 'normal' && i > 3) s.item = rollItem();
  return s;
}
// 아이템 확률 (계단 1칸당). 코인은 다른 게임과 맞춰 '잘하는 1분 ≈ 100개' 정도
const ITEM_TABLE = [
  ['coin', 0.18], ['coin_big', 0.02], ['gem', 0.006], ['star', 0.012], ['heart', 0.005],
  ['time5', 0.03], ['time10', 0.01], ['bolt', 0.008], ['shield', 0.007], ['magnet', 0.007],
  ['x2', 0.007], ['wing', 0.004], ['gift', 0.005],
];
function rollItem() {
  let r = Math.random();
  for (const [name, p] of ITEM_TABLE) { if (r < p) return name; r -= p; }
  return null;
}
function ensureSteps(upto) { while (G.steps.length <= upto) G.steps.push(genStep(G.steps.length)); }
function worldOf(i, col) { return { x: col * CFG.stepDX, y: -i * CFG.stepDY }; }

// ---------- run ----------
function resetRun() {
  G.t = 0; G.steps = []; genDir = Math.random() < 0.5 ? 1 : -1; genRun = 0;
  ensureSteps(40);
  G.idx = 0; G.dir = G.steps[1].col - G.steps[0].col;
  G.hearts = 0; G.coins = 0; G.time = CFG.time0;
  G.anim = null; G.queue = []; G.boost = 0; G.wing = 0; G.shield = false; G.magnetT = 0; G.x2T = 0;
  G.fx = []; G.texts = []; G.fallT = 0; G.pose = 'ready'; G.poseT = 0; G.rot = 0;
  G.themeIdx = 0; G.prevTheme = 0; G.themeFade = 1; G.newBest = false; G.shake = 0;
  const p = worldOf(0, 0); G.pos = { x: p.x, y: p.y };
  G.cam.x = p.x; G.cam.y = p.y;
  G.deco = []; for (let i = 0; i < 6; i++) G.deco.push(makeDeco(rand(-H * 0.2, H)));
  // 아이템샵: 적용한 배경 스킨 + '사용중' 부스트 (메인 화면에서 들어왔을 때만)
  G.skin = HUB ? HUB.equippedSkin('stairs') : 'default';
  const boosts = HUB ? HUB.takeBoosts('stairs') : [];
  if (boosts.includes('life')) G.hearts = 1;
  if (boosts.includes('time')) G.time += 10;
  if (boosts.includes('shield')) G.shield = true;
  if (boosts.includes('wing')) G.wing = 15;
  if (boosts.includes('magnet')) G.magnetT = 20;
  if (boosts.includes('x2')) G.x2T = 20;
  if (boosts.length) banner('부스트: ' + boosts.map((b) => HUB.boostName('stairs', b)).join(' · '));
  renderHearts(); renderBuffs(); updateTurnBtn();
  $('hudBest').textContent = Save.data.best;
}
function startRun() { resetRun(); setState('ready'); Audio.startBgm(); }

function makeDeco(sy) {
  const kinds = ['cloud', 'cloud2', 'cloud', 'balloon', 'bird', 'airship', 'island', 'island2'];
  const k = kinds[Math.floor(Math.random() * kinds.length)];
  return { kind: k, x: rand(-40, W + 40), sy, w: k.startsWith('cloud') ? rand(90, 150) : k === 'airship' ? 130 : k.startsWith('island') ? 80 : 60, vx: rand(-12, 12) + (k === 'bird' ? 30 : 0), a: k.startsWith('cloud') ? 0.8 : 0.75 };
}

// ---------- input / moves ----------
function act(turn) {
  Audio.unlock();
  if (G.state === 'ready') { setState('play'); }
  if (G.state !== 'play') return;
  if (G.boost > 0) return;
  if (G.anim) { if (G.queue.length < 3) G.queue.push(turn); return; }
  doMove(turn);
}
function doMove(turn) {
  if (turn) { G.dir = -G.dir; updateTurnBtn(); }
  ensureSteps(G.idx + 40);
  const cur = G.steps[G.idx], next = G.steps[G.idx + 1];
  let ok = next.col === cur.col + G.dir;
  if (!ok && G.wing > 0) { // 무적(날개): 틀려도 바로잡아 줌
    G.wing--; G.dir = -G.dir; updateTurnBtn(); ok = true; renderBuffs();
    popText('날개 덕분에 휴~', G.pos.x, G.pos.y - 120, '#3D8BFF');
  }
  if (ok) hop(CFG.hopDur, turn);
  else misstep();
}
function hop(dur, turn) {
  const from = { ...G.pos };
  G.idx++;
  const s = G.steps[G.idx];
  const to = worldOf(G.idx, s.col);
  G.anim = { from, to, t: 0, dur };
  G.pose = 'jump'; G.poseT = dur + 0.06;
  Audio.sfx(turn ? 'turn' : 'step', G.idx);
  // time: each step gives a little time back (less as you go higher)
  G.time = Math.min(CFG.timeMax, G.time + Math.max(0.12, 0.4 - G.idx * 0.0005));
  if (G.idx % 2 === 0) fxAt('fx_jump', from.x, from.y + 6, 44, 0.3);
  arrive(s);
}
function arrive(s) {
  const ti = themeAt(G.idx);
  if (ti !== G.themeIdx) {
    G.prevTheme = G.themeIdx; G.themeIdx = ti; G.themeFade = 0;
    banner(`${String(ti + 1).padStart(2, '0')} ${THEMES[ti].name}`); Audio.sfx('theme');
  }
  if (!G.newBest && Save.data.best >= 20 && G.idx > Save.data.best) { G.newBest = true; banner('NEW BEST!'); Audio.sfx('best'); }
  if (s.item) { collect(s.item, s); s.item = null; }
  if (s.type === 'speed' && !s.used) { s.used = true; startBoost(8); }
  if (s.type === 'special' && !s.used) { s.used = true; collect(randomItem(), s); }
  if (s.type === 'break' && s.crumble == null) { s.crumble = 0.85; Audio.sfx('crack'); }
  if (G.magnetT > 0) for (let k = 1; k <= 4; k++) { const n = G.steps[G.idx + k]; if (n && n.item && n.item.startsWith('coin')) { collect(n.item, n); n.item = null; } }
}
function startBoost(n) { G.boost = n; G.boostT = 0; Audio.sfx('boost'); popText('슝~!', G.pos.x, G.pos.y - 120, '#FF9F2E'); renderBuffs(); }
const GOD = () => !!(window.Hub && window.Hub.god); // 무적 쿠폰 (테스트용)
function misstep() {
  if (GOD()) { G.anim = null; G.queue = []; G.shake = 0.1; Audio.sfx('hit'); popText('무적!', G.pos.x, G.pos.y - 120, '#D6344C'); return; } // 무적: 틀려도 제자리
  const cur = G.steps[G.idx];
  const wrongCol = cur.col + G.dir;
  const to = worldOf(G.idx + 1, wrongCol);
  const decoy = G.steps[G.idx + 1].decoy === wrongCol;
  G.anim = null; G.queue = [];
  G.fallFrom = { ...G.pos }; G.fallTo = to; G.fallT = 0; G.vy = 0; G.rot = 0;
  G.fallReason = decoy ? 'spike' : 'miss';
  G.state = 'fall';
  if (decoy) { Audio.sfx('hit'); fxAt('fx_hit', to.x, to.y - 40, 90, 0.5); G.shake = 0.2; }
  else Audio.sfx('fall');
  haptic(40);
}
function dropFromCurrent(reason) { // e.g. crumbling stair
  G.anim = null; G.queue = [];
  G.fallFrom = { ...G.pos }; G.fallTo = { ...G.pos }; G.fallT = 0.09; G.vy = 0; G.rot = 0;
  G.fallReason = reason; G.state = 'fall'; Audio.sfx('fall'); haptic(40);
}
function afterFall() {
  if (GOD()) { respawn(); return; }
  if (G.shield) {
    G.shield = false; renderBuffs();
    popText('보호막!', G.pos.x, G.pos.y - 120, '#3D8BFF');
    respawn(); return;
  }
  // 하트가 남아 있으면 묻지 않고 하나 쓰고 바로 이어서 (헬리콥터처럼), 다 쓰면 끝
  if (G.hearts > 0) {
    G.hearts--; renderHearts();
    respawn();
    popText(`하트 -1 (남은 하트 ${G.hearts})`, G.pos.x, G.pos.y - 140, '#FF5C7A');
    return;
  }
  gameOver();
}
function respawn() {
  const s = G.steps[G.idx];
  if (s.type === 'break') { s.type = 'normal'; s.crumble = null; s.broken = false; }
  const p = worldOf(G.idx, s.col); G.pos = { x: p.x, y: p.y }; G.rot = 0;
  G.dir = G.steps[G.idx + 1].col - s.col; updateTurnBtn(); // 다음 계단 쪽을 보게 도와줌
  G.time = Math.max(G.time, 8);
  G.pose = 'ready'; G.poseT = 0.5;
  fxAt('fx_cloud', p.x, p.y - 40, 110, 0.5);
  setState('play');
}

function randomItem() { const l = ['coin_big', 'coin_big', 'time5', 'time10', 'heart', 'shield', 'bolt', 'magnet', 'x2', 'wing', 'gem']; return l[Math.floor(Math.random() * l.length)]; }
function collect(item, s) {
  const p = worldOf(G.steps.indexOf(s), s.col);
  const x = p.x, y = p.y - 70;
  const mult = G.x2T > 0 ? 2 : 1;
  const coins = (n) => { if (!GOD()) G.coins += n * mult; }; // 무적: 코인 0
  switch (item) {
    case 'coin': coins(1); Audio.sfx('coin'); fxAt('fx_coin', x, y, 50, 0.35); break;
    case 'coin_big': coins(5); Audio.sfx('gem'); fxAt('fx_coin', x, y, 70, 0.4); popText(`+${5 * mult}`, x, y - 20, '#FF9F2E'); break;
    case 'gem': coins(10); Audio.sfx('gem'); fxAt('fx_item', x, y, 80, 0.4); popText(`+${10 * mult}`, x, y - 20, '#FF5C9A'); break;
    case 'star': coins(5); Audio.sfx('gem'); fxAt('fx_star', x, y, 80, 0.45); popText(`+${5 * mult}`, x, y - 20, '#FF9F2E'); break;
    case 'heart':
      Audio.sfx('item'); fxAt('fx_heart', x, y, 80, 0.45);
      if (G.hearts < CFG.heartsMax) { G.hearts++; renderHearts(true); popText('목숨 +1', x, y - 20, '#FF5C7A'); }
      else { coins(5); popText('+5', x, y - 20, '#FF9F2E'); }
      break;
    case 'time5': G.time = Math.min(CFG.timeMax + 10, G.time + 5); Audio.sfx('time'); fxAt('fx_time', x, y, 70, 0.45); popText('+5초', x, y - 20, '#3D8BFF'); break;
    case 'time10': G.time = Math.min(CFG.timeMax + 10, G.time + 10); Audio.sfx('time'); fxAt('fx_time', x, y, 80, 0.45); popText('+10초', x, y - 20, '#3D8BFF'); break;
    case 'bolt': startBoost(10); break;
    case 'shield': G.shield = true; Audio.sfx('item'); popText('보호막!', x, y - 20, '#3D8BFF'); fxAt('fx_item', x, y, 70, 0.4); renderBuffs(); break;
    case 'magnet': G.magnetT = 8; Audio.sfx('item'); popText('자석!', x, y - 20, '#E84A5F'); renderBuffs(); break;
    case 'x2': G.x2T = 10; Audio.sfx('item'); popText('코인 2배!', x, y - 20, '#FF9F2E'); renderBuffs(); break;
    case 'wing': G.wing = 15; Audio.sfx('item'); popText('날개! 15칸 무적', x, y - 20, '#3D8BFF'); renderBuffs(); break;
    case 'gift': collect(randomItem(), s); break;
  }
}

// ---------- update ----------
function step(dt) {
  G.t += dt;
  updateFx(dt);
  if (G.state === 'ready') return;
  if (G.state === 'fall') {
    G.fallT += dt;
    const k = Math.min(1, G.fallT / 0.09);
    if (k < 1) { G.pos.x = lerp(G.fallFrom.x, G.fallTo.x, k); G.pos.y = lerp(G.fallFrom.y, G.fallTo.y, k) - Math.sin(k * Math.PI) * 18; }
    else { G.vy += 2400 * dt; G.pos.y += G.vy * dt; G.rot += dt * 6 * (G.dir || 1); }
    if (G.fallT > 0.85) afterFall();
    return;
  }
  if (G.state !== 'play') return;
  // timer
  const drain = 1 + Math.min(2, G.idx / 200); // 높이 올라갈수록 시간이 빨리 줄어듦
  if (G.idx > 0 || G.t > 0) G.time -= dt * drain;
  if (G.time < 5) { G.tickT -= dt; if (G.tickT <= 0) { G.tickT = 0.5; Audio.sfx('tick'); } }
  if (G.time <= 0 && GOD()) G.time = 10; // 무적: 시간이 다 되면 다시 채움
  if (G.time <= 0) { G.time = 0; G.fallReason = 'time'; G.pose = 'dizzy'; G.state = 'fall'; G.fallFrom = { ...G.pos }; G.fallTo = { ...G.pos }; G.fallT = 0.5; G.vy = -200; Audio.sfx('hit'); fxAt('fx_dizzy', G.pos.x, G.pos.y - 120, 70, 0.8); return; }
  if (G.magnetT > 0) { G.magnetT -= dt; if (G.magnetT <= 0) renderBuffs(); }
  if (G.x2T > 0) { G.x2T -= dt; if (G.x2T <= 0) renderBuffs(); }
  // hop animation
  if (G.anim) {
    const a = G.anim; a.t += dt;
    const k = Math.min(1, a.t / a.dur);
    G.pos.x = lerp(a.from.x, a.to.x, k); G.pos.y = lerp(a.from.y, a.to.y, k) - Math.sin(k * Math.PI) * 14;
    if (k >= 1) { G.anim = null; if (G.queue.length && G.boost <= 0) doMove(G.queue.shift()); }
  }
  // boost: auto-climb
  if (G.boost > 0 && !G.anim) {
    ensureSteps(G.idx + 40);
    const cur = G.steps[G.idx], next = G.steps[G.idx + 1];
    G.dir = next.col - cur.col; updateTurnBtn();
    G.boost--; hop(CFG.boostDur, false);
    if (G.idx % 2) fxAt('fx_boost', G.pos.x - G.dir * 30, G.pos.y - 50, 70, 0.25);
    if (G.boost <= 0) renderBuffs();
  }
  // crumbling stairs
  for (let i = Math.max(0, G.idx - 3); i <= G.idx; i++) {
    const s = G.steps[i];
    if (s.crumble != null && !s.broken) {
      s.crumble -= dt;
      if (s.crumble <= 0) {
        s.broken = true; s.brokeT = 0;
        if (i === G.idx && !G.anim && G.boost <= 0) { dropFromCurrent('break'); return; }
      }
    }
  }
  if (G.poseT > 0) G.poseT -= dt;
}

// ---------- FX ----------
function fxAt(name, x, y, w, life) { if (G.fx.length < 60) G.fx.push({ name, x, y, w, t: 0, life }); }
function popText(text, x, y, color) { G.texts.push({ text, x, y, color, t: 0, life: 0.9 }); }
let bannerT = 0, bannerText = '';
function banner(text) { bannerText = text; bannerT = 2; }
function updateFx(dt) {
  for (const f of G.fx) f.t += dt;
  G.fx = G.fx.filter((f) => f.t < f.life);
  for (const s of G.texts) s.t += dt;
  G.texts = G.texts.filter((s) => s.t < s.life);
  if (G.shake > 0) G.shake -= dt;
  if (bannerT > 0) bannerT -= dt;
  if (G.themeFade < 1) G.themeFade = Math.min(1, G.themeFade + dt * 0.7);
  for (const s of G.steps) if (s.broken && s.brokeT != null && s.brokeT < 1) s.brokeT += dt;
}
function haptic(ms) { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) try { navigator.vibrate(ms); } catch (e) { /* unsupported */ } }

// ---------- rendering ----------
const PLAYER_Y = () => H * 0.6; // where the player sits on screen
function toScreen(x, y) { return { x: W / 2 + (x - G.cam.x), y: PLAYER_Y() + (y - G.cam.y) }; }

function drawBg(th, alpha) {
  const img = SP.bg[th.bg];
  ctx.globalAlpha = alpha;
  if (img.complete && img.naturalWidth) {
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight) * 1.08 > (H / img.naturalHeight) * 1.6
      ? (H / img.naturalHeight) * 1.08 // wide screen: keep the picture's size and repeat it sideways
      : Math.max(W / img.naturalWidth, H / img.naturalHeight) * 1.08;
    const bw = img.naturalWidth * s, bh = img.naturalHeight * s;
    // slow vertical parallax as you climb; tiles are mirrored so their edges match
    const off = ((-G.cam.y * 0.06) % (bh * 2) + bh * 2) % (bh * 2);
    const cols = Math.ceil((W / bw - 1) / 2) + 1; // tiles each side of the centre one
    for (let k = -1; k < 2; k++) {
      const y = H - bh + off - k * bh;
      const flipY = ((k % 2) + 2) % 2 === 1;
      for (let c = -cols; c <= cols; c++) {
        const x = (W - bw) / 2 + c * bw;
        if (x > W || x + bw < 0) continue;
        const flipX = ((c % 2) + 2) % 2 === 1;
        ctx.save();
        ctx.translate(x + (flipX ? bw : 0), y + (flipY ? bh : 0));
        ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
        ctx.drawImage(img, 0, 0, bw, bh);
        ctx.restore();
      }
    }
  } else { ctx.fillStyle = '#9fd3f5'; ctx.fillRect(0, 0, W, H); }
  ctx.globalAlpha = 1;
}

function render() {
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  if (G.state === 'home' || !G.steps.length) { drawBg(THEMES[0], 1); return; }
  // camera
  const ty = G.pos.y, tx = G.pos.x;
  G.cam.x = lerp(G.cam.x, tx, 0.2); G.cam.y = lerp(G.cam.y, Math.min(ty, G.cam.y + 30), 0.2); // falling: camera lags behind
  // 배경 스킨을 적용했으면 그 배경으로 고정 (계단 블록은 높이에 따라 그대로 바뀜)
  const skinBg = SKIN_BG[G.skin];
  if (skinBg != null) drawBg({ bg: skinBg }, 1);
  else if (G.skin && G.skin !== 'default' && window.Skins && window.Skins.has(G.skin)) window.Skins.draw(ctx, G.skin, W, H, G.cam.x, -G.cam.y, G.t);
  else if (G.themeFade < 1) { drawBg(THEMES[G.prevTheme], 1); drawBg(THEMES[G.themeIdx], G.themeFade); } else drawBg(THEMES[G.themeIdx], 1);
  // soft veil so stairs pop from the busy background
  const veil = ctx.createLinearGradient(0, 0, 0, H);
  veil.addColorStop(0, 'rgba(255,255,255,0.05)'); veil.addColorStop(0.6, 'rgba(255,255,255,0.12)'); veil.addColorStop(1, 'rgba(24,40,62,0.35)');
  ctx.fillStyle = veil; ctx.fillRect(0, 0, W, H);
  // decorations
  for (const d of G.deco) {
    d.x += d.vx / 60; if (d.x < -150) d.x = W + 100; if (d.x > W + 150) d.x = -100;
    const y = ((d.sy - G.cam.y * 0.25) % (H + 300) + H + 300) % (H + 300) - 150; // drifts down slowly as we climb
    spr(ctx, d.kind, d.x, y, d.w, { alpha: d.a, flip: d.vx < 0 && d.kind === 'bird' });
  }

  ctx.save();
  if (G.shake > 0) ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
  const bw = CFG.blockW;
  const lo = Math.max(0, G.idx - 14), hi = G.idx + 22;
  ensureSteps(hi + 1);
  for (let i = hi; i >= lo; i--) {
    const s = G.steps[i];
    const w = worldOf(i, s.col), p = toScreen(w.x, w.y);
    if (p.y < -80 || p.y > H + 80) continue;
    // decoy spikes beside a turn
    if (s.decoy != null) { const dp = toScreen(s.decoy * CFG.stepDX, w.y); spr(ctx, 'st_spike', dp.x, dp.y, bw); }
    let name = THEMES[themeAt(i)].block;
    if (s.type === 'break') name = 'st_break';
    else if (s.type === 'speed') name = s.used ? name : (G.steps[i + 1] && G.steps[i + 1].col < s.col ? 'st_move_l' : 'st_move_r');
    else if (s.type === 'special') name = s.used ? 'st_stone' : 'st_special';
    let x = p.x, y = p.y, alpha = 1, rot = 0;
    if (s.crumble != null && !s.broken) x += Math.sin(G.t * 60) * (1 - Math.max(0, s.crumble) / 0.85) * 3;
    if (s.broken) { const k = s.brokeT || 0; y += k * k * 500; alpha = 1 - k; rot = k * 0.6; if (alpha <= 0) continue; }
    spr(ctx, name, x, y, bw, { alpha, rot });
  }
  // items
  for (let i = G.idx; i <= hi; i++) {
    const s = G.steps[i]; if (!s.item) continue;
    const w = worldOf(i, s.col), p = toScreen(w.x, w.y);
    const bob = Math.sin(G.t * 4 + i) * 3;
    const iw = s.item === 'coin' ? 34 : s.item === 'coin_big' ? 44 : 46;
    if (s.item !== 'coin') { ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y - 62 + bob, iw * 0.62, 0, 7); ctx.fill(); ctx.restore(); }
    spr(ctx, s.item, p.x, p.y - 62 + bob, iw);
  }
  // player
  const pp = toScreen(G.pos.x, G.pos.y);
  const who = Save.data.char;
  // 시트의 좌/우 라벨과 실제 방향이 달라서, 오른쪽을 보는 프레임(ready / jump_l / fall_l)만 골라
  // 진행 방향이 왼쪽이면 뒤집는다 → 얼굴은 항상 진행 방향, 방향 전환 버튼 화살표는 그 반대
  const facingRight = G.dir > 0;
  let frame, flip = !facingRight;
  if (G.state === 'ready') { frame = 'idle'; flip = false; }
  else if (G.state === 'result') { frame = G.fallReason === 'time' ? 'dizzy' : 'dead'; flip = false; }
  else if (G.state === 'fall') {
    frame = G.fallReason === 'spike' ? 'hurt' : G.fallReason === 'time' ? 'dizzy' : 'fall_l';
    if (frame !== 'fall_l') flip = false;
  } else if (G.poseT > 0 && G.pose === 'jump') frame = 'jump_l';
  else frame = 'ready';
  const feetY = pp.y - 22; // top surface of the block
  if (G.shield && G.state === 'play') { ctx.save(); ctx.globalAlpha = 0.35 + Math.sin(G.t * 8) * 0.1; ctx.strokeStyle = '#6FC0FF'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(pp.x, feetY - 50, 62, 0, 7); ctx.stroke(); ctx.restore(); }
  if (G.wing > 0 && G.state === 'play') spr(ctx, 'wing', pp.x - (facingRight ? 26 : -26), feetY - 66, 56, { flip: !facingRight, alpha: 0.9 });
  if (window.Costume && Costume.ready()) { // 캐릭터 꾸미기: 입은 옷 그림
    const pose = { idle: 'idle', ready: 'idle', side: 'idle', jump_l: 'jump', fall_l: 'fall', hurt: 'hurt', dizzy: 'dizzy', dead: 'dead', happy: 'happy' }[frame] || 'idle';
    ctx.save(); ctx.translate(pp.x, feetY);
    if (G.state === 'fall' && G.fallReason !== 'time') ctx.rotate(G.rot);
    Costume.draw(ctx, pose, G.t, { h: 118, flip: !facingRight });
    ctx.restore();
  } else if (window.CharV2 && CharV2.is(who) && CharV2.ready(who)) { // 새 캐릭터(v2)
    let name = { idle: 'idle', ready: 'ready', side: 'idle', jump_l: 'jump_up', fall_l: 'jump_down', hurt: 'hit', dizzy: 'dizzy', dead: 'dead', happy: 'happy' }[frame] || 'idle';
    // v4 캐릭터는 계단 전용 3/4 시점 그림이 있으면 그걸 씀
    const st = { idle: 'stairs_idle', ready: 'stairs_ready', side: 'stairs_idle', jump_l: 'stairs_jump', fall_l: 'stairs_fall', hurt: 'stairs_hurt', dizzy: 'stairs_dizzy', dead: 'stairs_dead', happy: 'stairs_happy' }[frame];
    if (st && CharV2.has(who, st)) name = st;
    // 그림이 빠져 있으면 비슷한 포즈로 대신 그림 (v4는 idle 대신 idle_0, ready·dizzy 없음)
    for (const alt of [{ idle: 'idle_0', ready: 'idle_0', dizzy: 'hit', jump_up: 'stairs_jump', jump_down: 'stairs_fall' }[name], 'stairs_idle', 'idle_0', 'idle', 'front_stand']) {
      if (CharV2.has(who, name)) break;
      if (alt) name = alt;
    }
    ctx.save(); ctx.translate(pp.x, feetY);
    CharV2.draw(ctx, who, name, { h: 118, flip, rot: G.state === 'fall' && G.fallReason !== 'time' ? G.rot : 0 });
    ctx.restore();
  } else spr(ctx, `${who}_${frame}`, pp.x, feetY, 86, { flip, rot: G.state === 'fall' && G.fallReason !== 'time' ? G.rot : 0, anchor: 'b' });
  // fx
  for (const f of G.fx) {
    const k = f.t / f.life, p = toScreen(f.x, f.y);
    spr(ctx, f.name, p.x, p.y - k * 20, f.w * (0.8 + k * 0.5), { alpha: 1 - k });
  }
  for (const s of G.texts) {
    const k = s.t / s.life, p = toScreen(s.x, s.y);
    ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
    ctx.font = '28px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.strokeText(s.text, p.x, p.y - k * 50);
    ctx.fillStyle = s.color; ctx.fillText(s.text, p.x, p.y - k * 50);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (G.state === 'ready') {
    const a = 0.75 + Math.sin(G.t * 5) * 0.25;
    ctx.globalAlpha = a; drawLabel('TAP TO START', W / 2, H * 0.36, 40); ctx.globalAlpha = 1;
    drawLabel(isTouch ? '위로 가기 · 방향 전환 버튼을 눌러요' : '↑ 위로 가기 · 스페이스 방향 전환', W / 2, H * 0.36 + 62, 20);
  }
  if (bannerT > 0) {
    const k = bannerT > 1.7 ? (2 - bannerT) / 0.3 : bannerT < 0.4 ? bannerT / 0.4 : 1;
    ctx.globalAlpha = k; drawLabel(bannerText, W / 2, H * 0.27, 38); ctx.globalAlpha = 1;
  }
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
  const t = Math.ceil(G.time);
  const key = G.idx + '|' + G.coins + '|' + t;
  if (key === lastHud) return;
  lastHud = key;
  $('hudHeight').textContent = G.idx; $('hudCoin').textContent = G.coins; $('hudTime').textContent = t;
  $('timerPill').classList.toggle('warn', G.time < 5 && G.state === 'play');
}
function renderHearts(pop) {
  const el = $('hudHearts'); el.innerHTML = '';
  for (let i = 0; i < CFG.heartsMax; i++) {
    const d = document.createElement('div');
    d.className = 'heart' + (i >= G.hearts ? ' empty' : '') + (pop && i === G.hearts - 1 ? ' pop' : '');
    el.appendChild(d);
  }
}
function iconURL(name) {
  if (!SP.ready || !SP.f[name]) return '';
  const [sx, sy, sw, sh] = SP.f[name]; const c = document.createElement('canvas'); c.width = sw; c.height = sh;
  c.getContext('2d').drawImage(SP.img, sx, sy, sw, sh, 0, 0, sw, sh); return c.toDataURL();
}
function renderBuffs() {
  const el = $('buffs'); el.innerHTML = '';
  const add = (name, label) => {
    const d = document.createElement('div'); d.className = 'buff';
    const i = document.createElement('i'); i.style.backgroundImage = `url(${iconURL(name)})`;
    d.appendChild(i); d.appendChild(document.createTextNode(label)); el.appendChild(d);
  };
  if (G.shield) add('shield', '보호막');
  if (G.wing > 0) add('wing', `${G.wing}칸`);
  if (G.magnetT > 0) add('magnet', '자석');
  if (G.x2T > 0) add('x2', '2배');
  if (G.boost > 0) add('bolt', '슝~');
}
function updateTurnBtn() { $('turnImg').src = G.dir > 0 ? 'assets/ui/btn_left.webp' : 'assets/ui/btn_right.webp'; }

// ---------- screens ----------
function setState(s) {
  G.state = s;
  $('home').classList.toggle('hidden', s !== 'home');
  $('pause').classList.toggle('hidden', s !== 'pause');
  $('result').classList.toggle('hidden', s !== 'result');
  $('hud').classList.toggle('hidden', !['ready', 'play', 'fall', 'pause'].includes(s));
  if (s === 'home') refreshHome();
}
function refreshHome() {
  document.querySelectorAll('.char').forEach((b) => b.classList.toggle('on', b.dataset.char === Save.data.char));
  $('totalCoin').textContent = Save.data.totalCoin || 0;
  $('bestAll').textContent = Save.data.best || 0;
  document.body.classList.toggle('muted', !Save.data.sound);
}
function gameOver() { Audio.sfx('gameover'); Audio.stopBgm(); showResult(); }
function showResult() {
  const m = G.idx;
  const isBest = m > (Save.data.best || 0);
  if (isBest) Save.data.best = m;
  Save.data.totalCoin = (Save.data.totalCoin || 0) + G.coins;
  if (!HUB) Save.store();
  $('resEarn').classList.toggle('hidden', !HUB);
  if (HUB) {
    const h = HUB.record('stairs', { dist: m, coins: G.coins });
    $('resEarn').innerHTML = `+${h.earned} 코인 획득!` + (h.bonus ? ` <small>(높이 보너스 +${h.bonus})</small>` : '') + `<small>내 코인 ${h.coins}</small>`;
  }
  $('resFace').src = (window.Costume && Costume.src) || `assets/chars/${Save.data.char}_${isBest && m > 0 ? 'happy' : 'dead'}.webp`;
  $('resHeight').textContent = m; $('resCoin').textContent = G.coins; $('resBestVal').textContent = Save.data.best;
  $('resBest').classList.toggle('hidden', !isBest || m === 0);
  setState('result');
}
let pausedFrom = 'play';
function pauseGame() { if (G.state === 'play' || G.state === 'ready') { pausedFrom = G.state; setState('pause'); Audio.stopBgm(); } }
function resumeGame() { if (G.state === 'pause') { setState(pausedFrom); Audio.startBgm(); last = performance.now(); } }
function goHome() { Audio.stopBgm(); if (HUB) location.href = '../index.html#lobby'; else setState('home'); }

// ---------- input ----------
function bindCtl(id, turn) {
  const el = $(id);
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.classList.add('down'); act(turn); });
  const up = () => el.classList.remove('down');
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
}
bindCtl('btnTurn', true);
bindCtl('btnUp', false);
root.addEventListener('pointerdown', () => Audio.unlock());
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
window.addEventListener('keydown', (e) => {
  Audio.unlock();
  const k = e.code;
  if (k === 'Space' || k === 'ArrowUp' || k === 'ArrowLeft' || k === 'ArrowRight') {
    e.preventDefault();
    if (e.repeat) return;
    if (G.state === 'play' || G.state === 'ready') {
      if (k === 'Space') act(true);
      else if (k === 'ArrowUp') act(false);
      else act((k === 'ArrowLeft' ? -1 : 1) !== G.dir); // ←/→: 그 방향으로 (필요하면 돌면서) 올라가기
      const btn = $(k === 'Space' || ((k === 'ArrowLeft' ? -1 : 1) !== G.dir && k !== 'ArrowUp') ? 'btnTurn' : 'btnUp');
      btn.classList.add('down'); setTimeout(() => btn.classList.remove('down'), 90);
    } else if (G.state === 'home' || G.state === 'result') startRun();
    else if (G.state === 'pause') resumeGame();
  } else if (k === 'Escape' || k === 'KeyP') {
    if (G.state === 'play' || G.state === 'ready') pauseGame(); else if (G.state === 'pause') resumeGame();
  } else if (k === 'KeyR' && G.state !== 'home') startRun();
  else if (k === 'Enter' && G.state === 'home') startRun();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('blur', () => pauseGame());

const click = (id, fn) => $(id).addEventListener('click', () => { Audio.unlock(); Audio.sfx('ui'); fn(); });
click('btnStart', startRun);
click('btnPause', pauseGame);
click('btnResume', resumeGame);
click('btnRetryP', startRun);
click('btnHomeP', goHome);
click('btnRetry', startRun);
click('btnHomeR', goHome);
click('btnSound', () => { Save.data.sound = !Save.data.sound; Save.store(); if (HUB) HUB.setSound(Save.data.sound); Audio.applyMute(); refreshHome(); });
document.querySelectorAll('.char').forEach((b) => b.addEventListener('click', () => {
  Audio.unlock(); Audio.sfx('ui'); Save.data.char = b.dataset.char; Save.store(); refreshHome();
}));

// ---------- layout ----------
// Phones: portrait only — if the phone is held sideways the game is rotated so it still shows in portrait.
// PC (mouse/keyboard): use the whole window in landscape.
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
function resize() {
  const vv = window.visualViewport;
  const vw = Math.round(vv ? vv.width : window.innerWidth), vh = Math.round(vv ? vv.height : window.innerHeight);
  const s = $('safe').getBoundingClientRect();
  const inset = { t: s.top, l: s.left, r: vw - s.right, b: vh - s.bottom };
  const rotated = isTouch && vw > vh;
  const sw = rotated ? vh : vw, sh = rotated ? vw : vh; // screen size in game orientation
  if (isTouch) { W = 540; H = Math.round(clamp(W * sh / sw, 860, 1240)); }
  else { H = 960; W = Math.round(clamp(H * vw / vh, 540, 2400)); }
  scale = Math.min(sw / W, sh / H);
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  root.style.width = W + 'px'; root.style.height = H + 'px';
  root.classList.toggle('wide', W > 700);
  const ox = (sw - W * scale) / 2, oy = (sh - H * scale) / 2;
  // rotate(-90deg): game top → screen left, game bottom → screen right
  root.style.transform = rotated
    ? `translate(${oy}px, ${vh - ox}px) rotate(-90deg) scale(${scale})`
    : `translate(${ox}px, ${oy}px) scale(${scale})`;
  const insT = rotated ? inset.l : inset.t, insB = rotated ? inset.r : inset.b;
  root.style.setProperty('--safe-t', Math.max(0, (insT - oy) / scale) + 'px');
  root.style.setProperty('--safe-b', Math.max(0, (insB - oy) / scale) + 'px');
  canvas.width = Math.round(W * scale * dpr); canvas.height = Math.round(H * scale * dpr);
  $('rotateHint').classList.add('hidden');
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
  if (['ready', 'play', 'fall'].includes(G.state)) {
    acc += dt;
    while (acc >= DT) { step(DT); acc -= DT; if (!['ready', 'play', 'fall'].includes(G.state)) break; }
    updateHud();
  } else acc = 0;
  render();
  requestAnimationFrame(frame);
}
resize();
if (HUB) {
  $('btnHomeR').textContent = '메인으로'; $('btnHomeP').textContent = '메인으로';
  startRun();
  if (new URLSearchParams(location.search).get('go') === '1') setState('play'); // 인트로 START로 들어오면 대기 화면 없이 바로 시작
} else setState('home');
requestAnimationFrame(frame);

// debug/test hook
window.__stairs = { G, CFG, act, step, DT, startRun, setState, ensureSteps };
