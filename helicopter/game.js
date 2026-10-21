'use strict';
// Twin Helicopter — 은유와 은결의 하늘 모험! (HTML5 Canvas, no dependencies)
// 클래식 헬리콥터 게임 방식: 누르고 있으면 상승, 떼면 하강. 파이프 사이를 지나 최대한 멀리.
// Logical height is fixed at 540; width follows the screen aspect.

const H = 540;
const CFG = {
  lift: 980,           // px/s² upward while holding (floaty, classic heli feel)
  gravity: 880,        // px/s² downward when released
  vyUp: -330, vyDown: 400,
  speed0: 290, speedMax: 570, speedGain: 3.6, // px/s, +px/s per second
  pxPerM: 40,
  pipeW: 86,
  gap0: 280, gapMin: 185,
  pipeSpace0: 440, pipeSpaceMin: 340,
  hpStart: 3, hpMax: 4,
  invincible: 1.6,
  themeEvery: 500,     // m
};

const THEMES = [
  { key: 'city', name: '하늘도시', bg: 0, pipe: 'pipe_green_tall', sky: ['#5FB2EE', '#A8DBF8', '#E3F4FF'], mid: 'island_m2', fog: '#E3F4FF' },
  { key: 'forest', name: '숲속마을', bg: 1, pipe: 'pipe_vine', sky: ['#6EC3E8', '#BDE8EE', '#EAF8EA'], mid: 'island_s', fog: '#EAF8EA' },
  { key: 'park', name: '놀이공원', bg: 2, pipe: 'pipe_wood_b', sky: ['#7AB8F0', '#C9DDF7', '#F6EAF4'], mid: 'balloon', fog: '#F6EAF4' },
  { key: 'winter', name: '겨울왕국', bg: 3, pipe: 'pipe_ice', sky: ['#7FA8E6', '#C4D8F4', '#F2F7FF'], mid: 'island_s', fog: '#F2F7FF', snow: true },
  { key: 'sunset', name: '석양의 항구', bg: 4, pipe: 'pipe_metal', sky: ['#7C6CC8', '#F29AA0', '#FFD49A'], mid: 'seagull', fog: '#FFD49A' },
];

// ---------- save ----------
const Save = {
  data: { char: 'eunyu', best: 0, totalCoin: 0, sound: true },
  load() { try { Object.assign(this.data, JSON.parse(localStorage.getItem('twinheli_v1') || '{}')); } catch (e) { /* private mode */ } },
  store() { try { localStorage.setItem('twinheli_v1', JSON.stringify(this.data)); } catch (e) { /* ignore */ } },
};
Save.load();
// 트윈 게임랜드(메인 화면)에서 들어왔으면 그 캐릭터로 플레이하고 기록·코인을 공통 저장소에 남긴다
const HUB = window.Hub && window.Hub.active() ? window.Hub : null;
if (HUB) {
  Save.data.char = HUB.active().look; Save.data.sound = HUB.settings.sound;
  Save.data.best = HUB.rec('helicopter').best;
}

// ---------- utils ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + (b - a) * Math.random();
const $ = (id) => document.getElementById(id);

// ---------- sprites (asset.PNG cut into assets/sprites.webp + sprites.json) ----------
const SP = { img: new Image(), f: null, ready: false, bg: [] };
fetch('assets/sprites.json').then((r) => r.json()).then((j) => {
  SP.f = j;
  SP.img.onload = () => { SP.ready = true; };
  SP.img.src = 'assets/sprites.webp';
});
for (let i = 0; i < 5; i++) { const im = new Image(); im.src = `assets/bg_${i}.jpg`; SP.bg.push(im); }
// draw sprite centered at (x,y) with its width scaled to w (height keeps aspect)
function spr(g, name, x, y, w, rot = 0, alpha = 1) {
  if (!SP.ready || !SP.f[name]) return;
  const [sx, sy, sw, sh] = SP.f[name];
  const h = w * sh / sw;
  g.save();
  g.globalAlpha = alpha;
  g.translate(x, y);
  if (rot) g.rotate(rot);
  g.drawImage(SP.img, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
  g.restore();
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
      this.bgmGain = this.ctx.createGain(); this.bgmGain.gain.value = 0.13; this.bgmGain.connect(this.master);
      const b = this.ctx.createBuffer(1, 1, 22050); const s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.master); s.start(0);
      this.applyMute();
      // BGM was requested before the first tap (e.g. opened from the hub): start it now
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
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
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
    const r = 1 + (Math.random() - 0.5) * 0.08;
    switch (name) {
      case 'coin': this.tone(988 * r, 0.06, 'square', 0.12); this.tone(1319 * r, 0.12, 'square', 0.12, 0, 0.05); break;
      case 'gem': [1318, 1760, 2349].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.25, 0, i * 0.04)); break;
      case 'item': [660, 880, 1100, 1320].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.3, 0, i * 0.05)); break;
      case 'hit': this.noise(0.25, 0.4, 0, 300); this.tone(220, 0.3, 'square', 0.22, -150); break;
      case 'crash': this.noise(0.6, 0.5, 0, 150); [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.3, 0, 0.15 + i * 0.16)); break;
      case 'shield': this.tone(500, 0.2, 'sine', 0.3, 600); break;
      case 'theme': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, 'square', 0.14, 0, i * 0.09)); break;
      case 'best': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.3, 0, i * 0.08)); break;
      case 'ui': this.tone(700, 0.06, 'triangle', 0.25); break;
      case 'start': this.tone(300, 0.25, 'sawtooth', 0.12, 500); break;
    }
  },
  melody: [76, 0, 79, 0, 84, 83, 79, 0, 81, 0, 79, 76, 74, 0, 76, 0, 77, 0, 81, 0, 84, 0, 83, 81, 79, 0, 76, 74, 72, 0, 0, 0],
  bass: [48, 55, 52, 55, 53, 57, 55, 50, 48, 55, 52, 55, 53, 55, 43, 47],
  startBgm() {
    if (this.bgmOn || !this.ctx) { this.bgmOn = true; return; }
    this.bgmOn = true; this.nextNote = this.ctx.currentTime + 0.1;
    clearInterval(this.timer); this.timer = setInterval(() => this.schedule(), 30);
  },
  stopBgm() { this.bgmOn = false; clearInterval(this.timer); this.timer = null; },
  schedule() {
    if (!this.ctx || !this.bgmOn) return;
    const stepDur = 60 / 140 / 2;
    const mf = (n) => 440 * Math.pow(2, (n - 69) / 12);
    while (this.nextNote < this.ctx.currentTime + 0.15) {
      const when = this.nextNote - this.ctx.currentTime;
      const m = this.melody[this.step % 32];
      if (m) this.tone(mf(m), stepDur * 0.85, 'square', 0.22, 0, when, this.bgmGain);
      if (this.step % 2 === 0) this.tone(mf(this.bass[(this.step / 2) % 16]), stepDur * 1.7, 'triangle', 0.6, 0, when, this.bgmGain);
      if (this.step % 2 === 1) this.noise(0.025, 0.1, when, 7000, this.bgmGain);
      this.nextNote += stepDur; this.step++;
    }
  },
};

// ---------- game state ----------
const canvas = $('game');
const ctx = canvas.getContext('2d');
const root = $('root');
let W = 960, scale = 1, dpr = 1;

const G = {
  state: 'home', // home | ready | play | crash | pause | result
  t: 0, dist: 0, speed: CFG.speed0, coins: 0, hp: CFG.hpStart,
  heli: null, pipes: [], items: [], obs: [], fx: [], texts: [], deco: [],
  nextPipeX: 0, gapY: H / 2, themeIdx: 0, themeFade: 0, prevTheme: 0,
  magnetT: 0, shield: false, boostT: 0, newBest: false, shake: 0, crashT: 0,
};
const input = { down: false, pressed: false }; // pressed: a tap shorter than one frame still counts

function themeAt(m) { return Math.floor(m / CFG.themeEvery) % THEMES.length; }

function newHeli() {
  return { x: 0, y: H * 0.45, vy: 0, inv: 0, anim: 0, rot: 0, smokeT: 0, hurtT: 0 };
}

function resetRun() {
  G.t = 0; G.dist = 0; G.speed = CFG.speed0; G.coins = 0; G.hp = CFG.hpStart;
  G.heli = newHeli();
  G.pipes = []; G.items = []; G.obs = []; G.fx = []; G.texts = []; G.deco = [];
  G.nextPipeX = W * 0.95; G.gapY = H * 0.47;
  G.themeIdx = 0; G.prevTheme = 0; G.themeFade = 1;
  G.magnetT = 0; G.shield = false; G.boostT = 0; G.newBest = false; G.shake = 0; G.crashT = 0;
  for (let i = 0; i < 4; i++) G.deco.push(makeDeco(rand(0, W * 1.5)));
  renderHearts(); renderBuffs();
  $('hudBest').textContent = Save.data.best;
  $('hudProgFace').style.backgroundImage = `url(assets/face_${Save.data.char}.png)`;
}

function startRun() {
  resetRun();
  setState('ready');
  Audio.startBgm();
}

// ---------- world generation (endless) ----------
// x positions are in "world distance px" (G.dist increases as we fly). Screen x = worldX - G.dist + heliScreenX.
const HELI_SX = () => W * 0.26;

function difficulty() { return clamp(G.dist / CFG.pxPerM / 2500, 0, 1); }

function spawnAhead() {
  const ahead = G.dist + W + 260;
  while (G.nextPipeX < ahead) {
    const d = clamp(G.nextPipeX / CFG.pxPerM / 2500, 0, 1);
    const gap = lerp(CFG.gap0, CFG.gapMin, d) + rand(-10, 14);
    const shift = lerp(60, 140, d);
    const prevY = G.gapY;
    const margin = 40 + gap / 2;
    G.gapY = clamp(G.gapY + rand(-shift, shift), margin, H - 40 - gap / 2);
    const themeI = themeAt(G.nextPipeX / CFG.pxPerM);
    const x = G.nextPipeX;
    G.pipes.push({ x, gapY: G.gapY, gap, theme: themeI, passed: false });
    // coins guide the safe line from the previous gap to this one
    const space = lerp(CFG.pipeSpace0, CFG.pipeSpaceMin, d) + rand(-20, 40);
    const n = 2;
    const prevX = x - space;
    if (G.pipes.length > 1 && Math.random() < 0.85) {
      for (let i = 1; i <= n; i++) {
        const t = i / (n + 1);
        G.items.push({ type: 'coin', x: lerp(prevX + CFG.pipeW, x, t), y: lerp(prevY, G.gapY, t) + Math.sin(t * Math.PI) * (Math.random() < 0.5 ? -30 : 30), got: false, ph: Math.random() * 6 });
      }
    }
    if (Math.random() < 0.5) G.items.push({ type: 'coin', x: x + CFG.pipeW / 2, y: G.gapY, got: false, ph: 0 });
    // rare items
    const r = Math.random();
    const ix = x + CFG.pipeW + space * 0.5, iy = clamp(G.gapY + rand(-40, 40), 70, H - 70);
    if (G.pipes.length > 3) {
      if (r < 0.05) G.items.push({ type: 'gem_blue', x: ix, y: iy, got: false, ph: 0 });
      else if (r < 0.08) G.items.push({ type: 'gem_pink', x: ix, y: iy, got: false, ph: 0 });
      else if (r < 0.105) G.items.push({ type: 'heart', x: ix, y: iy, got: false, ph: 0 });
      else if (r < 0.135) G.items.push({ type: 'magnet', x: ix, y: iy, got: false, ph: 0 });
      else if (r < 0.165) G.items.push({ type: 'shield', x: ix, y: iy, got: false, ph: 0 });
      else if (r < 0.19) G.items.push({ type: 'bolt', x: ix, y: iy, got: false, ph: 0 });
      else if (r < 0.19 + lerp(0.15, 0.4, d) && G.nextPipeX / CFG.pxPerM > 150) {
        // floating obstacle between pipe pairs, placed away from the coin line
        const th = THEMES[themeI];
        const side = G.gapY > H / 2 ? -1 : 1;
        const oy = clamp(G.gapY + side * rand(150, 190), 60, H - 60);
        G.obs.push({ type: th.mid, x: ix, y: oy, by: oy, ph: Math.random() * 6, move: th.mid === 'seagull' ? 40 : th.mid === 'balloon' ? 18 : 10 });
      }
    }
    G.nextPipeX += space + CFG.pipeW;
  }
}

function makeDeco(sx) {
  const kinds = ['cloud', 'cloud', 'cloud', 'balloon2', 'airship', 'cloud'];
  const k = kinds[Math.floor(Math.random() * kinds.length)];
  return { kind: k, sx, y: rand(40, 260), w: k === 'cloud' ? rand(90, 170) : k === 'airship' ? 120 : 46, par: rand(0.15, 0.35), a: k === 'cloud' ? 0.85 : 0.7 };
}

// ---------- update ----------
function step(dt) {
  const h = G.heli;
  G.t += dt;
  h.anim += dt;
  if (G.state === 'ready') {
    h.y = H * 0.45 + Math.sin(G.t * 3) * 10;
    h.rot = Math.sin(G.t * 2) * 0.04;
    if (input.down || input.pressed) { G.state = 'play'; Audio.sfx('start'); }
    updateFx(dt);
    return;
  }
  if (G.state === 'crash') {
    G.crashT += dt;
    h.vy += CFG.gravity * dt; h.y += h.vy * dt; h.rot += dt * 5;
    G.dist += G.speed * 0.35 * dt;
    h.smokeT -= dt; if (h.smokeT <= 0) { h.smokeT = 0.05; puff(HELI_SX() - 20, h.y, true); }
    updateFx(dt);
    if (G.crashT > 1.4) showResult();
    return;
  }
  // play
  const boost = G.boostT > 0;
  G.speed = Math.min(CFG.speedMax, G.speed + CFG.speedGain * dt);
  const spd = G.speed * (boost ? 1.6 : 1);
  G.dist += spd * dt;
  const holding = input.down || input.pressed;
  input.pressed = false;
  if (holding) h.vy += -CFG.lift * dt; else h.vy += CFG.gravity * dt;
  h.vy = clamp(h.vy, CFG.vyUp, CFG.vyDown);
  h.y += h.vy * dt;
  h.rot = lerp(h.rot, clamp(h.vy / 1500, -0.22, 0.3), Math.min(1, dt * 10));
  h.inv -= dt; h.hurtT -= dt;
  if (G.magnetT > 0) { G.magnetT -= dt; if (G.magnetT <= 0) renderBuffs(); }
  if (G.boostT > 0) { G.boostT -= dt; if (G.boostT <= 0) renderBuffs(); }

  // smoke trail while lifting (classic heli feel)
  h.smokeT -= dt;
  if (h.smokeT <= 0) { h.smokeT = input.down ? 0.07 : 0.16; puff(HELI_SX() - 48, h.y + 6, false); }

  // ceiling bump / ground crash
  if (h.y < 34) { h.y = 34; h.vy = Math.max(h.vy, 60); }
  if (h.y > H - 28) {
    if (!damage('ground')) return;
    h.y = H - 40; h.vy = -420;
  }

  // theme by distance
  const m = G.dist / CFG.pxPerM;
  const ti = themeAt(m);
  if (ti !== G.themeIdx) {
    G.prevTheme = G.themeIdx; G.themeIdx = ti; G.themeFade = 0;
    banner(`${String(ti + 1).padStart(2, '0')} ${THEMES[ti].name}`);
    Audio.sfx('theme');
  }
  if (G.themeFade < 1) G.themeFade = Math.min(1, G.themeFade + dt * 0.8);
  if (!G.newBest && Save.data.best > 50 && m > Save.data.best) {
    G.newBest = true; banner('NEW BEST!'); Audio.sfx('best');
  }

  spawnAhead();
  const hx = G.dist; // heli world x
  const hy = h.y;
  const R = 27; // heli hit radius (≈ body, generous)
  // pipes
  for (const p of G.pipes) {
    if (p.x > hx + 80 || p.x + CFG.pipeW < hx - 80) continue;
    const top = p.gapY - p.gap / 2, bot = p.gapY + p.gap / 2;
    const cx = clamp(hx, p.x, p.x + CFG.pipeW);
    const inX = Math.abs(cx - hx) < R;
    if (inX && (hy - R * 0.8 < top || hy + R * 0.8 > bot)) {
      if (!damage('pipe')) return;
      h.vy = hy < p.gapY ? 200 : -300;
    }
  }
  // floating obstacles
  for (const o of G.obs) {
    if (o.hit || Math.abs(o.x - hx) > 90) continue;
    if (Math.hypot(o.x - hx, o.y - hy) < R + 26) { o.hit = true; if (!damage('obs')) return; }
  }
  // items
  for (const it of G.items) {
    if (it.got || it.x < hx - 120 || it.x > hx + 300) continue;
    let dx = it.x - hx, dy = it.y - hy;
    if (G.magnetT > 0 && it.type === 'coin' && Math.hypot(dx, dy) < 230) {
      it.x -= dx * Math.min(1, dt * 10); it.y -= dy * Math.min(1, dt * 10);
      dx = it.x - hx; dy = it.y - hy;
    }
    if (Math.hypot(dx, dy) < 40) collect(it);
  }
  // cleanup
  const behind = G.dist - W;
  G.pipes = G.pipes.filter((p) => p.x > behind);
  G.items = G.items.filter((i) => i.x > behind && !(i.got && i.x < G.dist - 50));
  G.obs = G.obs.filter((o) => o.x > behind);
  for (const o of G.obs) o.y = o.by + Math.sin(G.t * 2 + o.ph) * o.move;
  for (const d of G.deco) {
    d.sx -= spd * d.par * dt;
    if (d.sx < -200) Object.assign(d, makeDeco(W + rand(50, 400)));
  }
  updateFx(dt);
}

// returns false if the run ended
function damage(kind) {
  const h = G.heli;
  if (G.boostT > 0 && kind !== 'ground') return true;
  if (h.inv > 0) return true;
  if (G.shield) {
    G.shield = false; h.inv = 0.8; renderBuffs();
    Audio.sfx('shield'); burst(HELI_SX(), h.y, 'fx_ring', 1, 120);
    popText('쉴드!', HELI_SX(), h.y - 60, '#3D8BFF');
    return true;
  }
  G.hp--; renderHearts();
  G.shake = 0.25; h.inv = CFG.invincible; h.hurtT = 0.4;
  burst(HELI_SX() + 20, h.y, 'fx_boom', 1, 90);
  haptic(40);
  if (G.hp <= 0) {
    Audio.sfx('crash'); Audio.stopBgm();
    G.state = 'crash'; G.crashT = 0; h.vy = -260;
    return false;
  }
  Audio.sfx('hit');
  popText(kind === 'ground' ? '앗, 땅이다!' : '아야!', HELI_SX(), h.y - 60, '#FF5C7A');
  return true;
}

function collect(it) {
  it.got = true;
  const sx = it.x - G.dist + HELI_SX();
  if (it.type === 'coin') { G.coins++; Audio.sfx('coin'); burst(sx, it.y, 'fx_star', 1, 30); }
  else if (it.type === 'gem_blue') { G.coins += 5; Audio.sfx('gem'); popText('+5', sx, it.y - 30, '#3D8BFF'); burst(sx, it.y, 'fx_sparkle', 1, 70); }
  else if (it.type === 'gem_pink') { G.coins += 10; Audio.sfx('gem'); popText('+10', sx, it.y - 30, '#FF5C9A'); burst(sx, it.y, 'fx_sparkle', 1, 70); }
  else if (it.type === 'heart') {
    Audio.sfx('item');
    if (G.hp < CFG.hpMax) { G.hp++; renderHearts(true); popText('♥ +1', sx, it.y - 30, '#FF5C7A'); }
    else { G.coins += 5; popText('+5', sx, it.y - 30, '#FF9F2E'); }
  } else if (it.type === 'magnet') { G.magnetT = 7; Audio.sfx('item'); popText('자석!', sx, it.y - 30, '#E84A5F'); renderBuffs(); }
  else if (it.type === 'shield') { G.shield = true; Audio.sfx('item'); popText('쉴드!', sx, it.y - 30, '#3D8BFF'); renderBuffs(); }
  else if (it.type === 'bolt') { G.boostT = 3; Audio.sfx('item'); popText('스피드!', sx, it.y - 30, '#FF9F2E'); renderBuffs(); }
}

// ---------- FX ----------
function puff(x, y, dark) {
  if (G.fx.length > 70) return;
  G.fx.push({ kind: 'puff', name: Math.random() < 0.5 ? 'fx_puff' : 'fx_puff2', x, y, vx: -G.speed * 0.25 - 40, vy: rand(-20, 20), w: rand(16, 24), t: 0, life: 0.6, dark });
}
function burst(x, y, name, n, w) { G.fx.push({ kind: 'sprite', name, x, y, w, t: 0, life: 0.45 }); }
function popText(text, x, y, color) { G.texts.push({ text, x, y, color, t: 0, life: 0.9, size: 26 }); }
let bannerT = 0, bannerText = '';
function banner(text) { bannerText = text; bannerT = 2.2; }
function updateFx(dt) {
  for (const f of G.fx) { f.t += dt; if (f.vx) f.x += f.vx * dt; if (f.vy) f.y += f.vy * dt; }
  G.fx = G.fx.filter((f) => f.t < f.life);
  for (const s of G.texts) s.t += dt;
  G.texts = G.texts.filter((s) => s.t < s.life);
  if (G.shake > 0) G.shake -= dt;
  if (bannerT > 0) bannerT -= dt;
}
function haptic(ms) { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) try { navigator.vibrate(ms); } catch (e) { /* unsupported */ } }

// ---------- rendering ----------
function drawSkyTheme(th, alpha) {
  ctx.globalAlpha = alpha;
  const gr = ctx.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, th.sky[0]); gr.addColorStop(0.55, th.sky[1]); gr.addColorStop(1, th.sky[2]);
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  // far background strip (from asset sheet), tiled with mirroring to hide seams
  const img = SP.bg[th.bg];
  if (img.complete && img.naturalWidth) {
    const bh = 210, bw = img.naturalWidth * bh / img.naturalHeight;
    let x = -((G.dist * 0.18) % (bw * 2));
    for (let i = 0; x < W; i++, x += bw) {
      const flip = Math.floor((G.dist * 0.18) / bw + i) % 2 === 1;
      ctx.save();
      if (flip) { ctx.translate(x + bw, 0); ctx.scale(-1, 1); ctx.drawImage(img, 0, H - bh, bw, bh); }
      else ctx.drawImage(img, x, H - bh, bw, bh);
      ctx.restore();
    }
    // soften the strip's top edge into the sky
    const fade = ctx.createLinearGradient(0, H - bh, 0, H - bh + 40);
    fade.addColorStop(0, th.sky[1]); fade.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = fade; ctx.fillRect(0, H - bh - 1, W, 41);
  }
  ctx.globalAlpha = 1;
}

function drawPipe(name, x, y0, y1, capAtTop) {
  // 3-slice pipe: cap at the gap side, body tiled toward the screen edge
  if (!SP.ready || !SP.f[name] || y1 - y0 < 2) return;
  const [sx, sy, sw, sh] = SP.f[name];
  const w = CFG.pipeW, k = w / sw;
  const capS = Math.round(sh * 0.2), capH = capS * k;
  const bodyS0 = sy + Math.round(sh * 0.3), bodyS = Math.round(sh * 0.4), bodyH = bodyS * k;
  ctx.save();
  if (!capAtTop) { ctx.translate(0, y0 + y1); ctx.scale(1, -1); } // mirror so the cap sits at the bottom
  // body
  ctx.beginPath(); ctx.rect(x, y0 + capH - 1, w, Math.max(0, y1 - y0 - capH + 1)); ctx.clip();
  for (let y = y0 + capH - 1; y < y1; y += bodyH - 1) ctx.drawImage(SP.img, sx, bodyS0, sw, bodyS, x, y, w, bodyH);
  ctx.restore();
  ctx.save();
  if (!capAtTop) { ctx.translate(0, y0 + y1); ctx.scale(1, -1); }
  ctx.drawImage(SP.img, sx, sy, sw, capS, x - 3, y0, w + 6, capH);
  ctx.restore();
}

function render() {
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  const th = THEMES[G.themeIdx];
  if (G.state === 'home' || !G.heli) {
    G.t += 1 / 60;
    drawSkyTheme(THEMES[0], 1);
    return;
  }
  if (G.themeFade < 1) { drawSkyTheme(THEMES[G.prevTheme], 1); drawSkyTheme(th, G.themeFade); }
  else drawSkyTheme(th, 1);
  if (th.snow) {
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 97 - G.dist * 0.5 + Math.sin(G.t + i) * 20) % W + W) % W;
      const sy = (i * 61 + G.t * (30 + (i % 5) * 10)) % H;
      ctx.beginPath(); ctx.arc(sx, sy, 1.5 + (i % 3), 0, 7); ctx.fill();
    }
  }
  // sky decorations (no collision)
  for (const d of G.deco) spr(ctx, d.kind, d.sx, d.y, d.w, 0, d.a);

  ctx.save();
  if (G.shake > 0) ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
  const ox = HELI_SX() - G.dist; // world -> screen
  // pipes
  for (const p of G.pipes) {
    const x = p.x + ox;
    if (x > W + 20 || x + CFG.pipeW < -20) continue;
    const name = THEMES[p.theme].pipe;
    drawPipe(name, x, -10, p.gapY - p.gap / 2, false);
    drawPipe(name, x, p.gapY + p.gap / 2, H + 10, true);
  }
  // obstacles
  for (const o of G.obs) {
    const x = o.x + ox; if (x < -80 || x > W + 80) continue;
    const w = o.type === 'seagull' ? 70 : o.type === 'balloon' ? 62 : 80;
    spr(ctx, o.type, x, o.y, w, o.type === 'seagull' ? Math.sin(G.t * 6 + o.ph) * 0.08 : 0, o.hit ? 0.5 : 1);
  }
  // items
  for (const it of G.items) {
    if (it.got) continue;
    const x = it.x + ox; if (x < -40 || x > W + 40) continue;
    const bob = Math.sin(G.t * 4 + it.ph) * 3;
    if (it.type === 'coin') {
      const sw = Math.abs(Math.cos(G.t * 4 + it.ph));
      ctx.save(); ctx.translate(x, it.y + bob); ctx.scale(Math.max(0.3, sw), 1); spr(ctx, 'coin', 0, 0, 30); ctx.restore();
    } else {
      ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, it.y + bob, 26 + Math.sin(G.t * 6) * 3, 0, 7); ctx.fill(); ctx.restore();
      spr(ctx, it.type, x, it.y + bob, it.type.startsWith('gem') ? 36 : 40);
    }
  }
  // smoke puffs behind the heli
  for (const f of G.fx) if (f.kind === 'puff') {
    const k = f.t / f.life;
    spr(ctx, f.name, f.x, f.y, f.w * (1 + k * 1.6), 0, (1 - k) * (f.dark ? 0.9 : 0.55));
  }
  // boost trail
  const h = G.heli, hx = HELI_SX();
  if (G.boostT > 0 && G.state === 'play') spr(ctx, Save.data.char === 'eunyu' ? 'fx_boost_pink' : 'fx_boost_blue', hx - 85, h.y + 4, 120, 0, 0.9);
  // helicopter
  const blink = h.inv > 0 && G.state === 'play' && Math.floor(h.inv * 12) % 2 === 0;
  if (!blink) {
    const who = Save.data.char;
    let frame;
    if (G.state === 'crash') frame = who === 'eunyu' ? 'eunyu_crash' : 'eungyeol_6';
    else if (h.hurtT > 0) frame = `${who}_6`;
    else frame = `${who}_${[0, 1, 2, 1][Math.floor(h.anim * 8) % 4]}`;
    spr(ctx, frame, hx, h.y, 112, h.rot);
    if (G.shield) spr(ctx, 'fx_ring', hx, h.y, 130, 0, 0.6 + Math.sin(G.t * 8) * 0.2);
  }
  // FX sprites
  for (const f of G.fx) if (f.kind === 'sprite') {
    const k = f.t / f.life;
    spr(ctx, f.name, f.x, f.y, f.w * (0.7 + k * 0.6), 0, 1 - k);
  }
  for (const s of G.texts) {
    const k = s.t / s.life;
    ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
    ctx.font = `${s.size}px Jua, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.strokeText(s.text, s.x, s.y - k * 40);
    ctx.fillStyle = s.color; ctx.fillText(s.text, s.x, s.y - k * 40);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (G.state === 'ready') {
    const a = 0.75 + Math.sin(G.t * 5) * 0.25;
    ctx.globalAlpha = a;
    drawLabel(isTouch ? '화면을 꾹 누르면 출발!' : '스페이스 / 클릭을 꾹 누르면 출발!', W / 2, H * 0.72, 30);
    ctx.globalAlpha = 1;
  }
  if (bannerT > 0) {
    const k = bannerT > 1.9 ? (2.2 - bannerT) / 0.3 : bannerT < 0.4 ? bannerT / 0.4 : 1;
    ctx.globalAlpha = k;
    drawLabel(bannerText, W / 2, H * 0.3, 40);
    ctx.globalAlpha = 1;
  }
}
function drawLabel(text, x, y, size) {
  ctx.font = `${size}px Jua, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 44;
  ctx.fillStyle = 'rgba(24,40,62,.7)';
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - size * 0.85, w, size * 1.7, size * 0.85); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(text, x, y + 1);
}

// ---------- HUD ----------
let lastHud = '';
function updateHud() {
  const m = Math.floor(G.dist / CFG.pxPerM);
  const key = m + '|' + G.coins;
  if (key !== lastHud) { lastHud = key; $('hudDist').textContent = m; $('hudCoin').textContent = G.coins; }
  const goal = Math.max(Save.data.best, 100);
  const prog = clamp(m / goal, 0, 1) * 100;
  $('hudProg').style.width = prog + '%'; $('hudProgFace').style.left = prog + '%';
}
function renderHearts(pop) {
  const el = $('hudHearts'); el.innerHTML = '';
  for (let i = 0; i < CFG.hpMax; i++) {
    const d = document.createElement('div');
    d.className = 'heart' + (i >= G.hp ? ' empty' : '') + (pop && i === G.hp - 1 ? ' pop' : '');
    el.appendChild(d);
  }
}
function renderBuffs() {
  const el = $('buffs'); el.innerHTML = '';
  const add = (name, label) => {
    const d = document.createElement('div'); d.className = 'buff';
    const [sx, sy, sw, sh] = SP.f ? SP.f[name] : [0, 0, 1, 1];
    const i = document.createElement('i');
    if (SP.f) { const c = document.createElement('canvas'); c.width = sw; c.height = sh; c.getContext('2d').drawImage(SP.img, sx, sy, sw, sh, 0, 0, sw, sh); i.style.backgroundImage = `url(${c.toDataURL()})`; }
    d.appendChild(i); d.appendChild(document.createTextNode(label)); el.appendChild(d);
  };
  if (G.shield) add('shield', '쉴드');
  if (G.magnetT > 0) add('magnet', '자석');
  if (G.boostT > 0) add('bolt', '스피드');
}

// ---------- screens ----------
function setState(s) {
  G.state = s;
  $('home').classList.toggle('hidden', s !== 'home');
  $('pause').classList.toggle('hidden', s !== 'pause');
  $('result').classList.toggle('hidden', s !== 'result');
  $('hud').classList.toggle('hidden', !(s === 'ready' || s === 'play' || s === 'pause' || s === 'crash'));
  input.down = false; input.pressed = false;
  if (s === 'home') refreshHome();
}
function refreshHome() {
  document.querySelectorAll('.char').forEach((b) => b.classList.toggle('on', b.dataset.char === Save.data.char));
  $('totalCoin').textContent = Save.data.totalCoin || 0;
  $('bestAll').textContent = Save.data.best || 0;
  document.body.classList.toggle('muted', !Save.data.sound);
}
function showResult() {
  if (G.state === 'result') return;
  const m = Math.floor(G.dist / CFG.pxPerM);
  const isBest = m > (Save.data.best || 0);
  if (isBest) Save.data.best = m;
  Save.data.totalCoin = (Save.data.totalCoin || 0) + G.coins;
  if (!HUB) Save.store();
  $('resEarn').classList.toggle('hidden', !HUB);
  if (HUB) {
    const h = HUB.record('helicopter', { dist: m, coins: G.coins });
    $('resEarn').innerHTML = `+${h.earned} 코인 획득!` + (h.bonus ? ` <small>(거리 보너스 +${h.bonus})</small>` : '') + `<small>내 코인 ${h.coins}</small>`;
  }
  $('resFace').src = `assets/${Save.data.char === 'eunyu' ? 'eunyu_crash' : 'eungyeol_6'}.png`;
  $('resDist').textContent = m; $('resCoin').textContent = G.coins; $('resBestVal').textContent = Save.data.best;
  $('resTheme').textContent = THEMES[G.themeIdx].name;
  $('resBest').classList.toggle('hidden', !isBest);
  setState('result');
}
let pausedFrom = 'play';
function pauseGame() { if (G.state === 'play' || G.state === 'ready') { pausedFrom = G.state; setState('pause'); Audio.stopBgm(); } }
function resumeGame() { if (G.state === 'pause') { setState(pausedFrom); Audio.startBgm(); last = performance.now(); } }
function goHome() {
  Audio.stopBgm();
  if (HUB) location.href = '../index.html#lobby'; else setState('home');
}

// ---------- input ----------
root.addEventListener('pointerdown', (e) => {
  Audio.unlock();
  if (!(G.state === 'play' || G.state === 'ready')) return;
  if (e.target.closest('button')) return;
  e.preventDefault();
  input.down = true; input.pressed = true;
});
window.addEventListener('pointerup', () => { input.down = false; });
window.addEventListener('pointercancel', () => { input.down = false; });
root.addEventListener('touchstart', (e) => { if ((G.state === 'play' || G.state === 'ready') && !e.target.closest('button')) e.preventDefault(); }, { passive: false });
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
window.addEventListener('keydown', (e) => {
  Audio.unlock();
  const k = e.code;
  if (k === 'Space' || k === 'ArrowUp' || k === 'KeyW') {
    e.preventDefault();
    if (G.state === 'play' || G.state === 'ready') { input.down = true; if (!e.repeat) input.pressed = true; }
    else if (!e.repeat && (G.state === 'home' || G.state === 'result')) startRun();
    else if (!e.repeat && G.state === 'pause') resumeGame();
  } else if (k === 'Escape' || k === 'KeyP') {
    if (G.state === 'play' || G.state === 'ready') pauseGame(); else if (G.state === 'pause') resumeGame();
  } else if (k === 'KeyR' && G.state !== 'home') startRun();
  else if (k === 'Enter' && G.state === 'home') startRun();
});
window.addEventListener('keyup', (e) => { if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') input.down = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('blur', () => { pauseGame(); input.down = false; });

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

// ---------- layout: full screen; upright phones get the game rotated 90° ----------
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
function resize() {
  const vv = window.visualViewport;
  const vw = Math.round(vv ? vv.width : window.innerWidth), vh = Math.round(vv ? vv.height : window.innerHeight);
  const s = $('safe').getBoundingClientRect();
  const inset = { t: s.top, l: s.left, r: vw - s.right, b: vh - s.bottom };
  const rotated = isTouch && vh > vw;
  const sw = rotated ? vh : vw, sh = rotated ? vw : vh;
  W = Math.round(H * Math.max(sw / sh, 16 / 9));
  scale = Math.min(sw / W, sh / H);
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  root.style.width = W + 'px'; root.style.height = H + 'px';
  const ox = (sw - W * scale) / 2, oy = (sh - H * scale) / 2;
  root.style.transform = rotated
    ? `translate(${vw - oy}px, ${ox}px) rotate(90deg) scale(${scale})`
    : `translate(${ox}px, ${oy}px) scale(${scale})`;
  const ins = rotated ? { l: inset.t, r: inset.b, t: inset.r, b: inset.l } : inset;
  for (const k of ['l', 'r', 't', 'b']) root.style.setProperty('--safe-' + k, Math.max(0, ins[k] / scale - (k === 'l' || k === 'r' ? ox : oy) / scale) + 'px');
  canvas.width = Math.round(W * scale * dpr); canvas.height = Math.round(H * scale * dpr);
  $('rotateHint').classList.toggle('hidden', isTouch || vh <= vw);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

// ---------- main loop (fixed 120Hz) ----------
let last = performance.now(), acc = 0;
const DT = 1 / 120;
function frame(now) {
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.05) dt = 0.05;
  if (G.state === 'ready' || G.state === 'play' || G.state === 'crash') {
    acc += dt;
    while (acc >= DT) { step(DT); acc -= DT; if (!(G.state === 'ready' || G.state === 'play' || G.state === 'crash')) break; }
    updateHud();
  } else acc = 0;
  render();
  requestAnimationFrame(frame);
}
resize();
if (HUB) {
  // 메인 화면에서 바로 들어오면 홈 없이 '꾹 누르면 출발' 대기 상태로
  $('btnHomeR').textContent = '메인으로'; $('btnHomeP').textContent = '메인으로';
  startRun();
} else setState('home');
requestAnimationFrame(frame);

// debug/test hook
window.__heli = { G, CFG, input, step, DT, startRun, setState };
