'use strict';
// Sky Hook Runner — HTML5 Canvas, no dependencies.
// Logical height is fixed at 540; logical width follows the screen aspect (16:9 ~ 21:9).

// ---------- config (기획서 03. 튜닝값, 1u = 60px) ----------
const U = 60;
const H = 540;
const CFG = {
  runSpeed: 6.0 * U,
  runSpeedMax: 9.0 * U,
  jumpVel: 8.2 * U,
  gravity: 22 * U,
  hookRange: 5.5 * U,
  swingMax: 11 * U,
  swingPump: 2.2 * U,
  releaseBoost: 1.2 * U,
  coyote: 0.10,
  jumpBuffer: 0.12,
  hookBuffer: 0.22,
  comboTimeout: 2.0,
  invincible: 1.2,
  deadY: 640,
  bodyOff: 40, // feet -> body center
};

const STAGES = [];
// 10개 월드 × 5판 = 50판 (1-1 ~ 10-5). 뒤로 갈수록 길고, 빠르고, 어려워진다.
//  · 달리는 거리: 1-1 300m → 10-5 1000m, 판마다 늘어나고 뒤로 갈수록 더 많이 늘어남
//  · 판 모양: 판마다 "구간 구성표"(점프·훅·징검다리… 각각 코스의 몇 %)를 따로 정해, 바로 앞판과는 30% 넘게,
//    앞앞판과는 20% 넘게 다르게 만든다 (stageMix 참고. 실제 만들어진 판의 구성으로 다시 재서 확인함)
const PER_WORLD = 5;
[['하늘도시', 'city'], ['숲속 나무마을', 'forest'], ['겨울왕국', 'winter'], ['석양의 항구', 'sunset'], ['벚꽃마을', 'cherry'],
  ['구름왕국', 'cloud'], ['바닷속도시', 'ocean'], ['마법숲', 'magic'], ['별빛우주', 'space'], ['황금성', 'golden']].forEach(([name, theme], w) => {
  for (let k = 0; k < PER_WORLD; k++) {
    const i = w * PER_WORLD + k;
    // d: 0(1-1) → 1(10-5). 월드가 바뀔 때 한 번 더 확 올라가도록 월드 단계 + 판 단계를 섞는다
    const d = Math.min(1, (w + k / PER_WORLD * 0.8) / 9.8);
    // 속도는 조금만 올리고(예전과 같음), 난이도는 지형으로 올린다 (buildLevel 참고)
    const lenM = 300 + 700 * Math.pow(i / 49, 1.2); // 달리는 거리(m)
    STAGES.push({ name: `${name} ${k + 1}`, label: `${w + 1}-${k + 1}`, world: w, k, seed: 11 + i * 13, len: Math.round(lenM * U), speed: i * 0.03, d, theme });
  }
});

// ---------- 판마다 구간 구성표 ----------
// 구간 종류와 어려움 정도. 월드가 올라갈 때마다 새 종류가 하나씩 열린다 (buildLevel 의 F 와 같음)
const PIECES = [
  ['jump', 0, 0], ['hook', 0.1, 0], ['cloud', 0.3, 0], ['chain', 0.4, 0], ['stones', 0.4, 1], ['stairs', 0.5, 2],
  ['vstones', 0.6, 3], ['crumble', 0.7, 4], ['hstones', 0.8, 5], ['mixed', 1, 8],
]; // [이름, 어려움, 열리는 월드(0부터)]
// 구성표 차이 = 두 판에서 구간 종류별 비율 차이를 모두 더해 반으로 나눈 값 (0 = 똑같음, 1 = 완전히 다름)
const mixDiff = (a, b) => { let s = 0; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) s += Math.abs((a[k] || 0) - (b[k] || 0)); return s / 2; };
// 판마다 "주인공 구간" 58% + "조연 구간" 24% + 나머지 18%. 앞판·앞앞판과 넉넉히 다른 조합 중에서
// 이 판 난이도에 맞는(월드 안에서 판이 오를수록 어려운 구간이 주인공) 조합을 고름
(function stageMix() {
  STAGES.forEach((st, i) => {
    const avail = PIECES.filter((p) => p[2] <= st.world);
    const hardMax = Math.max(...avail.map((p) => p[1]));
    const target = hardMax * (0.25 + 0.75 * st.k / (PER_WORLD - 1));
    const NEWP = avail.find((p) => p[2] === st.world && st.world > 0);
    let best = null, bestScore = -1e9, far = null, farM = -1e9;
    for (const f of avail) for (const s2 of avail) {
      if (f === s2) continue;
      const mix = {}; const rest = avail.filter((p) => p !== f && p !== s2);
      mix[f[0]] = 0.58; mix[s2[0]] = 0.24; rest.forEach((p) => { mix[p[0]] = 0.18 / rest.length; });
      const d1 = i > 0 ? mixDiff(mix, STAGES[i - 1].mix) : 1, d2 = i > 1 ? mixDiff(mix, STAGES[i - 2].mix) : 1;
      const m = Math.min(d1 - 0.5, d2 - 0.36);
      if (m > farM) { farM = m; far = mix; } // 넉넉한 조합이 없으면 가장 많이 다른 조합
      if (m < 0) continue; // 실제 판은 조금씩 어긋나므로 목표(30%·20%)보다 넉넉하게
      let score = -Math.abs(f[1] - target) - Math.abs(s2[1] - target) * 0.4;
      if (NEWP && f === NEWP && st.k === 1) score += 1; // 새 구간은 월드 2번째 판에서 주인공으로 소개
      if (NEWP && s2 === NEWP && st.k !== 1) score += 0.2;
      score += Math.sin(i * 12.9898 + f[1] * 78.233) * 0.05; // 같은 점수일 때 판마다 다르게
      if (score > bestScore) { bestScore = score; best = mix; }
    }
    st.mix = best || far;
  });
})();

// 트윈 게임랜드(메인 화면)에서 들어왔으면 그 캐릭터로 플레이하고 기록·코인을 공통 저장소에 남긴다
const HUB = window.Hub && window.Hub.active() ? window.Hub : null;

const THEMES = {
  city: {
    sky: ['#6FBDF0', '#BFE5FA', '#EAF7FF'], far: '#CFE6F7', mid: ['#F6DCCB', '#F2C9B4', '#FBE7D9', '#E9D3E8'],
    roof: ['#E98A78', '#7FB2E5', '#F2B35E'], grass: '#8BD16A', grassDark: '#5FAF4A', dirt: '#D49A62', dirtDark: '#A9713F',
  },
  forest: {
    sky: ['#86D2E6', '#CDEFE8', '#F1FBEA'], far: '#BFE3C8', mid: ['#7FC27A', '#69B266', '#93D08A', '#5FA35C'],
    roof: ['#B9774A', '#E9A05A', '#D26B5B'], grass: '#73C85A', grassDark: '#4E9E3F', dirt: '#A8774A', dirtDark: '#7E5432',
  },
  winter: {
    sky: ['#8FB5EA', '#C8DCF6', '#F4F8FF'], far: '#DCE8F8', mid: ['#EEF4FF', '#DDE9FA', '#F7FAFF', '#D4E2F6'],
    roof: ['#9DB8E8', '#B5C9F0', '#86A6DE'], grass: '#FFFFFF', grassDark: '#D6E6F7', dirt: '#B7D6F0', dirtDark: '#86AFD6',
    snow: true,
  },
  sunset: {
    sky: ['#8C7BD1', '#F59AA0', '#FFD29A'], far: '#E7A7B8', mid: ['#B27C9C', '#9A6B8E', '#C48CA6', '#8A5E80'],
    roof: ['#6E4C74', '#7D5583', '#5E4166'], grass: '#C9A06A', grassDark: '#9C7446', dirt: '#B9804F', dirtDark: '#86552F',
    wood: true,
  },
  // 월드 5~10: 월드 그림(common/worlds/wN.webp)을 먼 배경으로 깔고, 발판 색만 테마에 맞춤
  cherry: {
    img: 5, sky: ['#F7A8C8', '#FCD3E2', '#FFF0F5'], far: '#F5C2D6', mid: ['#E99AB8', '#F2B3CA', '#D98AAE', '#F7C6D8'],
    roof: ['#B44A6A', '#C9566E', '#8E3A58'], grass: '#FFC2D6', grassDark: '#E58AAE', dirt: '#C98B6A', dirtDark: '#9A5E44',
  },
  cloud: {
    img: 6, sky: ['#7CC4F2', '#C9E8FB', '#F2FAFF'], far: '#DDEFFC', mid: ['#F7FBFF', '#E6F2FC', '#FFFFFF', '#D9EAF8'],
    roof: ['#4F8FE0', '#E0B040', '#6FA8EA'], grass: '#FFFFFF', grassDark: '#C6DDF2', dirt: '#CFE4F6', dirtDark: '#94B6D8',
  },
  ocean: {
    img: 7, sky: ['#0E4F8C', '#1E86C4', '#5CC8E8'], far: '#2E7FB8', mid: ['#1F6FA8', '#2A88C0', '#1A5E94', '#3496C8'],
    roof: ['#38C4C8', '#5AD8C0', '#2AA6B8'], grass: '#5FD3C6', grassDark: '#2E9E96', dirt: '#E9D3A6', dirtDark: '#B89A6A', bubbles: true,
  },
  magic: {
    img: 8, sky: ['#1E3A4A', '#2E6A5A', '#5FA878'], far: '#3A6A5A', mid: ['#2E5A48', '#3A7058', '#24503E', '#46805E'],
    roof: ['#9B5CF0', '#F0A040', '#5CC8E8'], grass: '#5FC46A', grassDark: '#2F8A4A', dirt: '#7A5AA8', dirtDark: '#4E3A78', fireflies: true,
  },
  space: {
    img: 9, sky: ['#0E0828', '#2A1766', '#5A3DB0'], far: '#3A2A7C', mid: ['#2A1F5E', '#3A2C78', '#24195A', '#46368C'],
    roof: ['#C9A8FF', '#FFC2E0', '#A8E6FF'], grass: '#B9A8FF', grassDark: '#7A5CE0', dirt: '#4A3A7A', dirtDark: '#2E2456', stars: true,
  },
  golden: {
    img: 10, sky: ['#FFC86B', '#FFE2A0', '#FFF6DC'], far: '#FFE0A0', mid: ['#F2C25A', '#E8B040', '#FFD27A', '#DDA036'],
    roof: ['#C9820F', '#B5600F', '#E09A20'], grass: '#FFE07A', grassDark: '#D9A12E', dirt: '#E9B65A', dirtDark: '#B07E22',
  },
};
// 월드 그림 (메인 화면 지도와 같은 그림)
const WORLD_IMG = {};
for (const th of Object.values(THEMES)) if (th.img && !WORLD_IMG[th.img]) { const im = new Image(); im.src = `../common/worlds/w${th.img}.webp?v=202610251749`; WORLD_IMG[th.img] = im; }

// ---------- save ----------
const Save = {
  data: { char: 'eunyu', stage: 0, best: {}, cleared: {}, totalCoin: 0, sound: true },
  load() {
    try { Object.assign(this.data, JSON.parse(localStorage.getItem('skyhook_v1') || '{}')); } catch (e) { /* private mode */ }
  },
  store() {
    try { localStorage.setItem('skyhook_v1', JSON.stringify(this.data)); } catch (e) { /* ignore */ }
  },
};
Save.load();
if (window.Hub && window.Hub.active()) { Save.data.char = window.Hub.active().look; Save.data.sound = window.Hub.settings.sound; }

// ---------- utils ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const $ = (id) => document.getElementById(id);

// ---------- audio (WebAudio synth, no files) ----------
const Audio = {
  ctx: null, master: null, sfxGain: null, bgmGain: null, bgmOn: false, nextNote: 0, step: 0, timer: null,
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.85 * 0.5; this.sfxGain.connect(this.master);
      this.bgmGain = this.ctx.createGain(); this.bgmGain.gain.value = 0.65 * 0.22; this.bgmGain.connect(this.master);
      // iOS: play a silent buffer inside the gesture
      const b = this.ctx.createBuffer(1, 1, 22050); const s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.master); s.start(0);
      this.applyMute();
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
      case 'jump': this.tone(380, 0.14, 'square', 0.18, 420); break;
      case 'hook': this.noise(0.05, 0.35, 0, 2500); this.tone(1500, 0.06, 'triangle', 0.35); this.tone(900, 0.08, 'triangle', 0.25, 0, 0.03); break;
      case 'perfect': [1046, 1318, 1568, 2093].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.3, 0, i * 0.05)); break;
      case 'coin': this.tone(988 * r, 0.06, 'square', 0.12); this.tone(1319 * r, 0.12, 'square', 0.12, 0, 0.05); break;
      case 'star': [1318, 1760, 2349, 2637].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.25, 0, i * 0.04)); break;
      case 'land': this.tone(160, 0.1, 'sine', 0.35, -80); this.noise(0.06, 0.08, 0, 400); break;
      case 'hit': this.tone(320, 0.25, 'square', 0.22, -200); this.tone(160, 0.2, 'sine', 0.3, -60); break;
      case 'fall': this.tone(700, 0.45, 'triangle', 0.25, -550); break;
      case 'gameover': [523, 440, 349, 262].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.3, 0, i * 0.18)); break;
      case 'goal': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(f, i === 5 ? 0.5 : 0.16, 'square', 0.16, 0, i * 0.12)); break;
      case 'item': [660, 880, 1100].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.3, 0, i * 0.06)); break;
      case 'ui': this.tone(700, 0.06, 'triangle', 0.25); break;
    }
  },
  // simple looping chiptune (C major, 132bpm)
  melody: [72, 0, 76, 79, 77, 0, 76, 74, 72, 0, 74, 76, 79, 0, 76, 0, 77, 0, 81, 79, 77, 0, 76, 74, 76, 0, 74, 71, 72, 0, 0, 0],
  bass: [48, 48, 55, 55, 53, 53, 55, 55, 48, 48, 55, 55, 53, 53, 43, 43],
  startBgm() {
    if (this.bgmOn) return;
    this.bgmOn = true;
    if (!this.ctx) return;
    this.nextNote = this.ctx.currentTime + 0.1;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.schedule(), 30);
  },
  stopBgm() { this.bgmOn = false; clearInterval(this.timer); this.timer = null; },
  schedule() {
    if (!this.ctx || !this.bgmOn) return;
    const stepDur = 60 / 132 / 2;
    while (this.nextNote < this.ctx.currentTime + 0.15) {
      const when = this.nextNote - this.ctx.currentTime;
      const m = this.melody[this.step % 32];
      const mf = (n) => 440 * Math.pow(2, (n - 69) / 12);
      if (m) this.tone(mf(m), stepDur * 0.9, 'triangle', 0.35, 0, when, this.bgmGain);
      if (this.step % 2 === 0) this.tone(mf(this.bass[(this.step / 2) % 16]), stepDur * 1.6, 'sine', 0.55, 0, when, this.bgmGain);
      if (this.step % 4 === 2) this.noise(0.03, 0.12, when, 6000, this.bgmGain);
      this.nextNote += stepDur; this.step++;
    }
  },
};

// ---------- level generation (기획서 04. Stage 구간 A~E) ----------
function buildLevel(si) {
  const st = STAGES[si];
  const R = rng(st.seed * 7919);
  const rand = (a, b) => a + (b - a) * R();
  const L = { plats: [], anchors: [], items: [], obs: [], hints: [], goal: null, len: st.len, pieces: [] };
  const d = st.d, wd = st.world, k = st.k;

  // ----- 월드마다 새 지형이 하나씩 늘어난다 (속도는 거의 그대로, 지형으로 어려워짐) -----
  //  1 기본 점프·훅 / 2 징검다리 / 3 계단 / 4 위아래 움직이는 발판·흔들 훅 / 5 무너지는 발판
  //  6 좌우 움직이는 발판 / 7 긴 연속 훅·무너지는 징검다리 / 8 움직이는 먹구름 / 9~10 모두 섞기
  const F = {
    stones: wd >= 1, stairs: wd >= 2, vmove: wd >= 3, crumble: wd >= 4, hmove: wd >= 5,
    longChain: wd >= 6, cloudMove: wd >= 7,
  };
  const NEW = ['', 'stones', 'stairs', 'vmove', 'crumble', 'hmove', 'longChain', 'cloudMove', '', ''][wd];
  const D = {
    jumpMin: lerp(110, 150, d), jumpMax: lerp(160, 215, d),
    platMin: lerp(420, 300, d), platMax: lerp(760, 520, d),
    stoneMin: lerp(250, 150, d), stoneMax: lerp(320, 210, d),   // 징검다리 폭
    dy: lerp(40, 70, d),
    hookMin: lerp(380, 420, d), hookMax: lerp(470, 530, d),
    hookMove: F.vmove ? lerp(25, 60, d) : 0,
    cloud: lerp(0.2, 0.6, d),
    learn: si === 0 ? 0.18 : wd === 0 ? 0.1 : 0.05,
    heart: wd < 8,
  };
  const plat = (x, y, w, upper = false, o = {}) => {
    const p = { x, y, w, upper, deco: Math.floor(R() * 1e6), bx: x, by: y, dx: 0, dy: 0, ...o };
    L.plats.push(p); return p;
  };
  const anchor = (x, y, move = 0) => { const a = { x, y, bx: x, by: y, move, ph: R() * 6.28, used: false }; L.anchors.push(a); return a; };
  const item = (type, x, y) => L.items.push({ type, x, y, got: false, t: R() * 6 });
  const cloud = (x, y, move = F.cloudMove && R() < 0.6 ? lerp(25, 55, d) : 0) => L.obs.push({ x, y, by: y, move, ph: R() * 6.28, hit: false });
  const hint = (x, y, text) => L.hints.push({ x, y, text });
  const coinArc = (x0, y0, x1, y1, h, n) => {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      item('coin', lerp(x0, x1, t), lerp(y0, y1, t) - Math.sin(t * Math.PI) * h);
    }
  };
  const coinLine = (x0, y, n, gap = 46) => { for (let i = 0; i < n; i++) item('coin', x0 + i * gap, y); };

  // 점프로 닿을 수 있는 거리 (판 시작 속도 기준, 높이 올라갈수록 짧아짐) — 못 깨는 간격은 안 만든다
  const v0 = CFG.runSpeed + st.speed * U;
  const reach = (up) => {
    const disc = CFG.jumpVel * CFG.jumpVel - 2 * CFG.gravity * Math.max(0, up);
    return disc <= 0 ? 0 : v0 * (CFG.jumpVel + Math.sqrt(disc)) / CFG.gravity * 0.78;
  };

  let y = 420;
  plat(-500, y, 1500);
  coinLine(500, y - 60, 6);
  let x = 1000; // cursor: end of last platform

  const nextY = (dy0, dy1) => clamp(y + rand(dy0, dy1) * D.dy / 40, 320, 475);
  const jumpTo = (ny, slack = 0) => Math.max(90, Math.min(rand(D.jumpMin, D.jumpMax), reach(y - ny) - slack));
  const intro = {}; // 처음 나오는 지형엔 안내 글
  const introHint = (key, hx, hy, text) => { if (k <= 1 && NEW === key && !intro[key]) { intro[key] = true; hint(hx, hy, text); } };

  const jumpGap = (opt = {}) => {
    let ny = nextY(-40, 45);
    if (y - ny > 70) ny = y - 70;
    const gap = jumpTo(ny);
    coinArc(x - 30, y - 50, x + gap + 30, ny - 50, 90, 5);
    const w = opt.wide ? rand(Math.max(D.platMin, 420), D.platMax + 80) : rand(D.platMin, D.platMax);
    plat(x + gap, ny, w);
    if (opt.cloud && w > 320) cloud(x + gap + w * 0.55, ny - 34);
    else coinLine(x + gap + 120, ny - 60, Math.floor(w / 140));
    if (opt.hint) hint(x - 170, y - 150, '탭 / 스페이스 = 점프!');
    x += gap + w; y = ny;
  };

  const hookGap = (opt = {}) => {
    const gap = rand(D.hookMin, D.hookMax);
    const ny = nextY(-50, 40);
    const ax = x + gap * 0.42, ay = Math.min(y, ny) - rand(195, 225);
    anchor(ax, ay, opt.move ? D.hookMove : 0);
    for (let i = 0; i < 7; i++) {
      const a = lerp(-0.9, 1.1, i / 6), r = 175;
      item(i === 3 && opt.star ? 'star' : 'coin', ax + Math.sin(a) * r, ay + Math.cos(a) * r);
    }
    if (opt.hint) hint(x - 120, ay + 20, '공중에서 꾹! = 훅 걸기');
    const w = rand(D.platMin + 40, D.platMax + 20);
    plat(x + gap, ny, w);
    if (opt.cloud && w > 340) cloud(x + gap + w * 0.6, ny - 34);
    x += gap + w; y = ny;
  };

  const chainGap = (n, move) => {
    const sp = 340;
    const gap = 200 + sp * (n - 1) + 260;
    const ny = nextY(-30, 30);
    const base = Math.min(y, ny) - 215;
    for (let i = 0; i < n; i++) {
      const ax = x + 180 + i * sp, ay = base + (i % 2 ? -18 : 12);
      anchor(ax, ay, move ? D.hookMove : 0);
      for (let q = 0; q < 3; q++) item('coin', ax - 50 + q * 50, ay + 170 + (q === 1 ? 12 : 0));
    }
    if (R() < 0.5) item('star', x + 180 + sp * (n - 1) + 170, base + 40);
    const w = rand(D.platMin + 60, D.platMax + 40);
    plat(x + gap, ny, w);
    x += gap + w; y = ny;
  };

  // 착지용 넓은 발판 (특수 지형 뒤에 숨 돌리기). slack/up: 직전 발판이 움직여서 더 멀어지거나 낮아지는 만큼
  const landing = (slack = 0, up = 0) => {
    let ny = nextY(-30, 40);
    if (y - ny > 60) ny = y - 60;
    const gap = jumpTo(ny - up, slack);
    const w = rand(D.platMin, D.platMax);
    plat(x + gap, ny, w);
    coinLine(x + gap + 100, ny - 60, Math.floor(w / 160));
    x += gap + w; y = ny;
  };

  // 징검다리: 짧은 발판 여러 개 (무너지거나 움직일 수도 있음)
  //  좌우로 움직이는 발판은 한 묶음이 같이 움직여서 서로 간격은 그대로 → 들어갈 때·나올 때 타이밍만 맞추면 됨
  //  위아래 발판은 번갈아 움직여 물결처럼 (높이 차까지 계산해서 항상 닿게)
  const stones = (n, o = {}) => {
    const sx = x;
    const ampX = o.hmove ? lerp(40, 70, d) : 0, ampY = o.vmove ? lerp(30, 60, d) : 0;
    const mvs = lerp(1.3, 1.9, d), ph = R() * 6.28;
    for (let i = 0; i < n; i++) {
      let ny = nextY(-35, 35);
      if (y - ny > 50) ny = y - 50;
      const slack = i === 0 ? ampX * 2 : 0;
      const up = ampY * 2;
      const gap = jumpTo(ny - up, slack);
      const w = rand(D.stoneMin, D.stoneMax) + (ampX || ampY ? 30 : 0);
      const ext = {};
      if (o.crumble) ext.crumble = true;
      if (ampX || ampY) Object.assign(ext, { mvx: ampX, mvy: ampY, mvs, mvp: ph + (ampY ? i * Math.PI : 0) });
      // 좌우 발판 기준 위치는 왼쪽 끝(-ampX)에서 시작 → 오른쪽으로 ampX*2까지 움직임
      const p = plat(x + gap + (i === 0 ? ampX : 0), ny, w, false, ext);
      coinLine(p.x + w / 2 - 23, ny - 60, 2);
      x = p.x + w; y = ny;
    }
    if (o.crumble) introHint('crumble', sx - 160, y - 170, '밟으면 무너져요! 멈추지 말고 건너요');
    else if (o.vmove || o.hmove) introHint(o.hmove ? 'hmove' : 'vmove', sx - 160, y - 170, '움직이는 발판! 타이밍을 맞춰요');
    else introHint('stones', sx - 160, y - 170, '징검다리! 리듬에 맞춰 톡톡');
    x += ampX; // 마지막 발판이 가장 오른쪽까지 갔을 때 기준
    landing(ampX * 2, ampY);
  };

  // 계단: 한 칸씩 올라갔다가 내려옴
  const stairs = (n) => {
    const sx = x;
    const up = y > 400; // 낮은 곳에 있으면 올라가고, 높은 곳이면 내려감
    for (let i = 0; i < n * 2; i++) {
      const goingUp = (i < n) === up;
      const ny = clamp(y + (goingUp ? -1 : 1) * rand(45, 58), 300, 478);
      const gap = Math.max(90, Math.min(rand(100, 150 + d * 30), reach(y - ny)));
      const w = rand(D.stoneMin + 20, D.stoneMax + 40);
      const crumble = F.crumble && wd >= 6 && R() < 0.35;
      plat(x + gap, ny, w, false, crumble ? { crumble: true } : {});
      coinLine(x + gap + w / 2 - 23, ny - 60, 2);
      x += gap + w; y = ny;
    }
    introHint('stairs', sx - 160, y - 200, '계단! 한 칸씩 점프');
    landing();
  };

  const upperPath = () => {
    const gap = rand(120, 150);
    const ny = nextY(-20, 30);
    const X0 = x + gap, w = 1300;
    plat(X0, ny, w);
    cloud(X0 + 620, ny - 34);
    cloud(X0 + 1000, ny - 34);
    coinLine(X0 + 250, ny - 60, 4);
    anchor(X0 + 230, ny - 245);
    const upp = plat(X0 + 470, ny - 190, 560, true);
    coinLine(upp.x + 60, upp.y - 55, 9, 50);
    item(D.heart && R() < 0.35 ? 'heart' : 'star', upp.x + upp.w - 70, upp.y - 95);
    x += gap + w; y = ny;
  };

  // 구간 고르기: 이 판의 구성표(st.mix)에서 지금까지 모자란 구간을 고름 → 판마다 구성이 확실히 다름
  const X0 = x, used = {};
  const track = (type, fn) => { const x0 = x; fn(); used[type] = (used[type] || 0) + (x - x0); L.pieces.push({ type, x0, x1: x }); };
  const pickPiece = (only) => {
    const done = x - X0 + 900; // 다음 구간까지 포함해서 비교
    let bestId = 'jump', bestDef = -1e9;
    for (const [id, share] of Object.entries(st.mix)) {
      if (only && !only.includes(id)) continue;
      const def = share * done - (used[id] || 0) + R() * 250;
      if (def > bestDef) { bestDef = def; bestId = id; }
    }
    return bestId;
  };
  const nStones = () => 3 + Math.floor(R() * (2 + d * 3));

  let first = true, introJump = true, introHook = true, upperDone = false;
  let magnetPlaced = false, heartsPlaced = 0;
  while (x < st.len) {
    const prog = x / st.len;
    if (prog < D.learn) {
      if (first) { track('jump', () => jumpGap({ hint: introJump && si === 0 })); introJump = false; first = false; continue; }
      if (introHook && si === 0) { track('hook', () => hookGap({ hint: true })); introHook = false; continue; }
      if (R() < 0.5) track('jump', () => jumpGap()); else track('hook', () => hookGap());
      continue;
    }
    if (x > st.len - 4600) { // 마지막: 연속 훅 (남은 거리에 들어갈 때만)
      const n = F.longChain ? 3 + (R() < d ? 1 : 0) : 3;
      if (x + 200 + 340 * (n - 1) + 260 + D.platMax + 40 < st.len - 160) track('chain', () => chainGap(n, F.vmove && d > 0.5));
      break;
    }
    if (!magnetPlaced && prog > 0.2) { item('magnet', x - 200, y - 110); magnetPlaced = true; }
    if (D.heart && heartsPlaced < 1 && prog > 0.7) { item('heart', x - 160, y - 120); heartsPlaced++; }
    if (!upperDone && prog > 0.45 && prog < 0.7 && R() < 0.5) { track('upper', upperPath); upperDone = true; continue; }
    const id = pickPiece();
    track(id, () => {
      switch (id) {
        case 'jump': jumpGap({ cloud: R() < D.cloud * 0.5 }); break;
        case 'cloud': jumpGap({ cloud: true, wide: true }); break;
        case 'hook': hookGap({ cloud: R() < D.cloud * 0.6, star: R() < 0.3, move: F.vmove && R() < 0.3 + d * 0.4 }); break;
        case 'stones': stones(nStones()); break;
        case 'stairs': stairs(2 + Math.floor(R() * (1 + d * 2))); break;
        case 'vstones': stones(nStones() - 1, { vmove: true }); break;
        case 'crumble': stones(nStones(), { crumble: true }); break;
        case 'hstones': stones(nStones() - 1, { hmove: true }); break;
        case 'chain': chainGap(F.longChain ? 3 + (R() < 0.5 ? 1 : 0) : 2, F.vmove); break;
        case 'mixed': stones(nStones(), { crumble: R() < 0.5, vmove: R() < 0.4, hmove: R() < 0.3 }); break;
      }
    });
  }
  // 결승선은 언제나 이 판의 거리(st.len)에 맞춤: 짧은 구간(점프·구름·훅 중 구성표에서 모자란 것)으로 채우고
  // 마지막 발판을 늘려서 딱 맞춤 → 판마다 거리가 꼭 늘어남
  while (x < st.len - 1550) {
    const id = pickPiece(['jump', 'cloud', 'hook']);
    track(id, () => (id === 'hook' ? hookGap() : jumpGap(id === 'cloud' ? { cloud: true, wide: true } : {})));
  }
  const lastP = L.plats[L.plats.length - 1];
  if (x < st.len - 160) { const ext = st.len - 160 - x; lastP.w += ext; x += ext; }
  // goal
  const gp = plat(x + 160, y, 1400);
  L.goal = { x: gp.x + 420, y: gp.y - 90 };
  coinLine(gp.x + 60, gp.y - 60, 6);
  L.end = gp.x + gp.w;
  return L;
}

// ---------- backgrounds (pre-rendered parallax layers) ----------
const BG = {};
function makeLayer(themeKey, kind) {
  const th = THEMES[themeKey];
  const w = 1400, h = H;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const R = rng(kind === 'far' ? 5 : 9);
  if (kind === 'far') {
    // far floating islands / mountains
    g.fillStyle = th.far;
    for (let i = 0; i < 6; i++) {
      const x = i * 240 + R() * 80, y = 120 + R() * 140, s = 40 + R() * 50;
      g.beginPath(); g.ellipse(x, y, s, s * 0.28, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(x - s, y); g.quadraticCurveTo(x, y + s * 1.3, x + s, y); g.fill();
      g.beginPath(); g.arc(x - s * 0.3, y - s * 0.25, s * 0.35, 0, Math.PI * 2); g.arc(x + s * 0.2, y - s * 0.35, s * 0.4, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 0.7;
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 70) g.lineTo(x, 400 + Math.sin(x * 0.011) * 30 + Math.sin(x * 0.027) * 18);
    g.lineTo(w, h); g.fill();
    g.globalAlpha = 1;
  } else {
    // mid layer: buildings / trees / castles / harbor
    for (let x = -20; x < w;) {
      const bw = 60 + R() * 70, bh = 90 + R() * 150, col = th.mid[Math.floor(R() * th.mid.length)];
      const by = h - 40 - bh;
      if (themeKey === 'forest') {
        g.fillStyle = '#8A6A4A'; g.fillRect(x + bw / 2 - 6, by + bh * 0.5, 12, bh * 0.5 + 40);
        g.fillStyle = col;
        g.beginPath(); g.arc(x + bw / 2, by + bh * 0.35, bw * 0.55, 0, Math.PI * 2); g.arc(x + bw * 0.2, by + bh * 0.55, bw * 0.38, 0, Math.PI * 2); g.arc(x + bw * 0.8, by + bh * 0.55, bw * 0.38, 0, Math.PI * 2); g.fill();
        if (R() < 0.4) { // tree house
          g.fillStyle = '#E9B37A'; g.fillRect(x + bw * 0.3, by + bh * 0.3, bw * 0.4, bw * 0.3);
          g.fillStyle = th.roof[Math.floor(R() * 3)]; g.beginPath(); g.moveTo(x + bw * 0.22, by + bh * 0.3); g.lineTo(x + bw / 2, by + bh * 0.3 - bw * 0.25); g.lineTo(x + bw * 0.78, by + bh * 0.3); g.fill();
        }
      } else if (themeKey === 'sunset' && R() < 0.25) {
        // lighthouse
        g.fillStyle = '#F4E3E8'; g.beginPath(); g.moveTo(x + 20, h); g.lineTo(x + 30, by - 30); g.lineTo(x + 50, by - 30); g.lineTo(x + 60, h); g.fill();
        g.fillStyle = '#D9607A'; g.fillRect(x + 28, by + 20, 24, 16); g.fillRect(x + 25, by + 80, 30, 16);
        g.fillStyle = '#FFE59A'; g.fillRect(x + 30, by - 50, 20, 20);
        g.fillStyle = '#6E4C74'; g.beginPath(); g.moveTo(x + 24, by - 50); g.lineTo(x + 40, by - 70); g.lineTo(x + 56, by - 50); g.fill();
      } else {
        g.fillStyle = col;
        const r = 8;
        g.beginPath(); g.roundRect ? g.roundRect(x, by, bw, bh + 40, [r, r, 0, 0]) : g.rect(x, by, bw, bh + 40); g.fill();
        // roof
        g.fillStyle = th.roof[Math.floor(R() * th.roof.length)];
        if (themeKey === 'winter' || R() < 0.5) {
          g.beginPath(); g.moveTo(x - 6, by + 4); g.lineTo(x + bw / 2, by - bw * (themeKey === 'winter' ? 0.75 : 0.45)); g.lineTo(x + bw + 6, by + 4); g.fill();
        } else {
          g.beginPath(); g.ellipse(x + bw / 2, by + 2, bw / 2 + 4, 14, 0, Math.PI, 0); g.fill();
        }
        if (themeKey === 'winter') { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x + bw * 0.25, by - bw * 0.37); g.lineTo(x + bw / 2, by - bw * 0.75); g.lineTo(x + bw * 0.75, by - bw * 0.37); g.fill(); }
        // windows
        g.fillStyle = themeKey === 'sunset' ? 'rgba(255,229,154,.85)' : 'rgba(255,255,255,.65)';
        for (let wy = by + 22; wy < h - 60; wy += 34) for (let wx = x + 12; wx < x + bw - 18; wx += 24) if (R() < 0.75) {
          g.beginPath(); g.roundRect ? g.roundRect(wx, wy, 11, 16, [6, 6, 2, 2]) : g.rect(wx, wy, 11, 16); g.fill();
        }
      }
      x += bw + 8 + R() * 40;
    }
    // bushes / snow band at the bottom
    g.fillStyle = themeKey === 'winter' ? '#FFFFFF' : themeKey === 'sunset' ? '#7A5A8C' : '#9AD67F';
    for (let x = 0; x < w + 60; x += 50) { g.beginPath(); g.arc(x, h - 30 + Math.sin(x) * 6, 36, 0, Math.PI * 2); g.fill(); }
    g.fillRect(0, h - 30, w, 30);
  }
  return c;
}
function getBG(themeKey) {
  if (!BG[themeKey]) BG[themeKey] = { far: makeLayer(themeKey, 'far'), mid: makeLayer(themeKey, 'mid') };
  return BG[themeKey];
}

// ---------- character drawing (은유 / 은결, vector chibi) ----------
const OUT = '#4A3226';
const SKIN = '#FFE3CF';
const KIDS = {
  eunyu: { shirt: '#FFB5C5', shirt2: '#FF8FAB', pants: '#6E92D6', shoe: '#FFFFFF', hair: '#7A4A2B', hairHi: '#9A643E', glasses: true },
  eungyeol: { shirt: '#F6F8F2', stripe: '#3F7A55', pants: '#8DB7E8', shoe: '#3A3A48', hair: '#3B2618', hairHi: '#5A3D28', backpack: '#2F4A7A', shorts: true },
};
function limb(g, x1, y1, x2, y2, w, col) {
  g.strokeStyle = OUT; g.lineWidth = w + 3; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
}
function blob(g, fill, lw = 2.5) { g.fillStyle = fill; g.fill(); g.strokeStyle = OUT; g.lineWidth = lw; g.stroke(); }

function drawKid(g, who, pose, t, opt = {}) {
  // 새 캐릭터 그림을 아직 불러오는 중이면 같은 계열 기본 캐릭터로
  const k = KIDS[who] || KIDS[window.CharV2 ? CharV2.base(who) : who] || KIDS.eunyu;
  g.lineCap = 'round'; g.lineJoin = 'round';
  const run = Math.sin(t * 16);
  let legA = 0, legB = 0, armA = 0, armB = 0, legLen = 18, armsUp = false;
  if (pose === 'run') { legA = run * 0.85; legB = -run * 0.85; armA = -run * 0.9; armB = run * 0.9; }
  else if (pose === 'jump') { legA = 0.9; legB = -0.35; legLen = 15; armA = -2.4; armB = 1.2; }
  else if (pose === 'fall') { legA = 0.4 + Math.sin(t * 20) * 0.3; legB = -0.4 - Math.sin(t * 20) * 0.3; armA = -2.6 + Math.sin(t * 25) * 0.3; armB = 2.6 - Math.sin(t * 25) * 0.3; }
  else if (pose === 'swing') { legA = 0.55 + Math.sin(t * 6) * 0.15; legB = 0.15 + Math.sin(t * 6 + 1) * 0.15; armsUp = true; }
  else if (pose === 'hit') { legA = 0.6; legB = -0.6; armA = -2.2; armB = 2.2; }
  else if (pose === 'idle') { armA = -0.15; armB = 0.15; }
  const bob = pose === 'run' ? Math.abs(Math.cos(t * 16)) * -2.5 : 0;
  g.save();
  g.translate(0, bob);

  // backpack
  if (k.backpack) { g.beginPath(); g.roundRect(-20, -46, 13, 24, 5); blob(g, k.backpack); }
  // back arm
  const sh = { x: -2, y: -39 };
  const armEnd = (a, len = 15) => ({ x: sh.x + Math.sin(a) * len, y: sh.y + Math.cos(a) * len });
  if (armsUp) { // both arms reach up behind the head to hold the rope
    limb(g, -9, -42, -1, -93, 6, k.shirt);
    limb(g, 10, -42, 6, -94, 6, k.shirt);
  } else {
    const e = armEnd(armB); limb(g, sh.x, sh.y, e.x, e.y, 6, k.shirt);
    g.beginPath(); g.arc(e.x, e.y, 3.6, 0, 7); blob(g, SKIN, 2);
  }
  // legs
  const hip = { x: 0, y: -20 };
  const leg = (a, dx) => {
    const fx = hip.x + dx + Math.sin(a) * legLen, fy = hip.y + Math.cos(a) * legLen;
    if (k.shorts) {
      const mx = hip.x + dx + Math.sin(a) * 7, my = hip.y + Math.cos(a) * 7;
      limb(g, mx, my, fx, fy, 6, SKIN);
      limb(g, hip.x + dx, hip.y, mx, my, 9, k.pants);
    } else limb(g, hip.x + dx, hip.y, fx, fy, 8, k.pants);
    g.beginPath(); g.ellipse(fx + 3, fy + 1, 7, 4.5, 0, 0, 7); blob(g, k.shoe, 2);
  };
  leg(legB, -3); leg(legA, 3);
  // torso
  g.beginPath(); g.roundRect(-11, -46, 23, 28, 9); blob(g, k.shirt);
  if (k.stripe) {
    g.save(); g.beginPath(); g.roundRect(-11, -46, 23, 28, 9); g.clip();
    g.fillStyle = k.stripe; for (let sy = -42; sy < -18; sy += 7) g.fillRect(-12, sy, 25, 3.2);
    g.restore(); g.beginPath(); g.roundRect(-11, -46, 23, 28, 9); g.strokeStyle = OUT; g.lineWidth = 2.5; g.stroke();
  }
  if (who === 'eunyu') { // heart on shirt
    g.fillStyle = k.shirt2; g.beginPath(); const hx = 3, hy = -33;
    g.moveTo(hx, hy + 5); g.bezierCurveTo(hx - 8, hy - 1, hx - 4, hy - 7, hx, hy - 3); g.bezierCurveTo(hx + 4, hy - 7, hx + 8, hy - 1, hx, hy + 5); g.fill();
  }
  if (k.shorts) { g.beginPath(); g.roundRect(-11, -24, 23, 8, 3); blob(g, k.pants, 2); }
  else { g.beginPath(); g.roundRect(-11, -24, 23, 7, 3); blob(g, k.pants, 2); }

  // head
  const hx = 2, hy = -64, hr = 21;
  if (k.glasses) { // bob hair back
    g.beginPath(); g.moveTo(hx - 23, hy - 4); g.quadraticCurveTo(hx - 26, hy + 20, hx - 16, hy + 22);
    g.lineTo(hx + 18, hy + 22); g.quadraticCurveTo(hx + 27, hy + 18, hx + 24, hy - 4);
    g.arc(hx, hy - 3, 24, 0, Math.PI, true); blob(g, k.hair);
  }
  g.beginPath(); g.arc(hx, hy, hr, 0, 7); blob(g, SKIN);
  if (!k.glasses) { g.beginPath(); g.arc(hx - 17, hy + 4, 4, 0, 7); blob(g, SKIN, 2); } // ear (hidden by bob hair)
  // hair front
  g.beginPath();
  if (k.glasses) {
    g.moveTo(hx - 23, hy + 6); g.quadraticCurveTo(hx - 25, hy - 22, hx, hy - 25); g.quadraticCurveTo(hx + 24, hy - 24, hx + 24, hy + 2);
    g.quadraticCurveTo(hx + 16, hy - 6, hx + 12, hy - 11); g.quadraticCurveTo(hx + 8, hy - 4, hx + 2, hy - 9); g.quadraticCurveTo(hx - 4, hy - 4, hx - 10, hy - 9);
    g.quadraticCurveTo(hx - 14, hy - 2, hx - 23, hy + 6);
  } else {
    g.moveTo(hx - 21, hy + 2); g.quadraticCurveTo(hx - 24, hy - 24, hx, hy - 25); g.quadraticCurveTo(hx + 25, hy - 25, hx + 22, hy - 2);
    g.lineTo(hx + 17, hy - 9); g.lineTo(hx + 12, hy - 4); g.lineTo(hx + 8, hy - 11); g.lineTo(hx + 2, hy - 5); g.lineTo(hx - 3, hy - 12); g.lineTo(hx - 9, hy - 6); g.lineTo(hx - 13, hy - 12);
    g.quadraticCurveTo(hx - 16, hy - 4, hx - 21, hy + 2);
  }
  blob(g, k.hair);
  g.strokeStyle = k.hairHi; g.lineWidth = 2; g.beginPath(); g.moveTo(hx - 6, hy - 20); g.quadraticCurveTo(hx + 4, hy - 23, hx + 12, hy - 18); g.stroke();
  // face (facing right)
  const ex1 = hx + 0, ex2 = hx + 13, ey = hy + 3;
  g.fillStyle = 'rgba(255,130,150,.45)';
  g.beginPath(); g.ellipse(ex1 - 4, ey + 8, 4.5, 2.6, 0, 0, 7); g.ellipse(ex2 + 3, ey + 8, 3.5, 2.4, 0, 0, 7); g.fill();
  g.fillStyle = '#2B1B14';
  if (pose === 'hit' || opt.hurt) {
    g.strokeStyle = '#2B1B14'; g.lineWidth = 2.2;
    [[ex1, 1], [ex2, -1]].forEach(([ex, d]) => { g.beginPath(); g.moveTo(ex - 3 * d, ey - 3); g.lineTo(ex + 2 * d, ey); g.lineTo(ex - 3 * d, ey + 3); g.stroke(); });
  } else if (opt.blink || opt.happy) {
    g.strokeStyle = '#2B1B14'; g.lineWidth = 2.2;
    [ex1, ex2].forEach((ex) => { g.beginPath(); g.arc(ex, ey + 1, 3.2, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); });
  } else {
    [ex1, ex2].forEach((ex) => {
      g.fillStyle = '#2B1B14'; g.beginPath(); g.ellipse(ex, ey, 3.3, 4.3, 0, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + 1, ey - 1.6, 1.3, 0, 7); g.fill();
    });
  }
  if (k.glasses) {
    g.strokeStyle = '#3B2A22'; g.lineWidth = 1.8;
    g.beginPath(); g.arc(ex1, ey, 6.6, 0, 7); g.stroke();
    g.beginPath(); g.arc(ex2, ey, 6.3, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(ex1 + 6.6, ey - 1); g.lineTo(ex2 - 6.3, ey - 1); g.stroke();
    g.beginPath(); g.moveTo(ex1 - 6.6, ey - 1); g.lineTo(hx - 15, ey - 3); g.stroke();
  }
  // mouth
  const mx = hx + 7, my = hy + 13;
  g.strokeStyle = '#7A3B2E'; g.lineWidth = 2;
  if (pose === 'jump' || pose === 'swing' || opt.happy) {
    g.fillStyle = '#E2626E'; g.beginPath(); g.arc(mx, my - 1, 3.6, 0, Math.PI); g.closePath(); g.fill(); g.stroke();
  } else if (pose === 'hit' || pose === 'fall') {
    g.fillStyle = '#7A3B2E'; g.beginPath(); g.ellipse(mx, my, 2.4, 3, 0, 0, 7); g.fill();
  } else { g.beginPath(); g.arc(mx, my - 3, 3.4, 0.3, Math.PI - 0.3); g.stroke(); }

  // front arm
  if (armsUp) {
    g.beginPath(); g.arc(-1, -95, 4.4, 0, 7); blob(g, SKIN, 2);
    g.beginPath(); g.arc(6, -97, 4.4, 0, 7); blob(g, SKIN, 2);
  } else {
    const e = armEnd(armA); limb(g, sh.x + 3, sh.y, e.x + 3, e.y, 6, k.shirt);
    g.beginPath(); g.arc(e.x + 3, e.y, 3.6, 0, 7); blob(g, SKIN, 2);
  }
  g.restore();
}

// ---------- character sprites (은유 / 은결 sheet, assets/sprites/kids.webp) ----------
// Frames were cut from the character sprite sheet; the vector drawKid() above is only a fallback.
const Sprites = { img: new Image(), frames: null, scale: 3, ready: false };
fetch('assets/sprites/kids.json?v=202610251749').then((r) => r.json()).then((j) => {
  Sprites.frames = j.frames; Sprites.scale = j.scale;
  Sprites.img.onload = () => { Sprites.ready = true; };
  Sprites.img.src = 'assets/sprites/kids.webp?v=202610251749';
}).catch(() => { /* opened from file:// — keep vector fallback */ });
const SPRITE_SIZE = 1.55; // sheet pixel -> game pixel
function drawKidSprite(g, who, pose, t) {
  // 새 캐릭터(v2): 포즈별 그림
  if (window.CharV2 && CharV2.is(who)) {
    const nr = CharV2.count(who, 'run_') || 6, ns = CharV2.count(who, 'swing_') || 2;
    const name = pose === 'run' ? `run_${Math.floor(t * 13 * nr / 6) % nr}` : pose === 'swing' ? `swing_${Math.floor(t * 4) % ns}`
      : ({ jump: 'jump_up', fall: 'jump_down' })[pose] || pose;
    if (CharV2.draw(g, who, CharV2.has(who, name) ? name : 'idle', { h: 118, anchor: pose === 'swing' ? 'hang' : 'feet', hangTop: -100, handX: 3 })) return true;
  }
  // 캐릭터 꾸미기: 옷을 입었으면 옷 그림으로
  if (window.Costume && Costume.ready()) return Costume.draw(g, pose, t, { h: 118, hangTop: -100 });
  if (!Sprites.ready) return false;
  const F = Sprites.frames;
  if (window.CharV2 && CharV2.is(who)) who = CharV2.base(who); // 새 캐릭터 그림을 불러오는 중: 기본 캐릭터 그림으로
  const pick = (act, fps) => {
    let n = 0; while (F[`${who}_${act}_${n}`]) n++;
    return n ? F[`${who}_${act}_${Math.floor(t * fps) % n}`] : null;
  };
  const f = pose === 'run' ? pick('run', 13) : pose === 'swing' ? pick('swing', 4) : pick(pose, 1) || pick('idle', 1);
  if (!f) return false;
  const k = SPRITE_SIZE / Sprites.scale, w = f[2] * k, h = f[3] * k;
  // feet at (0,0); hanging frames hold the rope at their top edge
  const top = pose === 'swing' ? -100 : -h + 3;
  g.drawImage(Sprites.img, f[0], f[1], f[2], f[3], -w / 2, top, w, h);
  return true;
}

// ---------- game state ----------
const canvas = $('game');
const ctx = canvas.getContext('2d');
const root = $('root');
let W = 960, scale = 1, dpr = 1;

const G = {
  state: 'home', // home | stages | play | pause | result
  si: Save.data.stage || 0,
  level: null,
  p: null,
  cam: { x: 0, y: 0, shake: 0 },
  t: 0, coins: 0, stars: 0, combo: 0, comboT: 0, hp: 3,
  fx: [], texts: [], endT: 0, cleared: false, speedMul: 1, magnetT: 0,
};
const input = { down: false, pressed: false };

function newPlayer() {
  return {
    x: 120, y: 420 - CFG.bodyOff, vx: CFG.runSpeed, vy: 0, onGround: true, coyote: 0, jumpBuf: 0, hookBuf: 0,
    airT: 0, hook: null, ropeLen: 0, inv: 0, hurtT: 0, blinkT: 2, squash: 0, happyT: 0, anim: 0, dead: false,
  };
}

function startStage(si) {
  G.si = si; Save.data.stage = si; Save.store();
  G.level = buildLevel(si);
  G.p = newPlayer();
  G.cam.x = G.p.x - W * 0.28; G.cam.y = 0; G.cam.shake = 0;
  G.t = 0; G.coins = 0; G.stars = 0; G.combo = 0; G.comboT = 0; G.hp = 3; G.fx = []; G.texts = [];
  G.endT = 0; G.cleared = false; G.speedMul = 1; G.magnetT = 0;
  // 아이템샵: 적용한 배경 스킨 + '사용중' 부스트 (메인 화면에서 들어왔을 때만)
  G.skin = HUB ? HUB.equippedSkin('skyhook') : 'default';
  G.hpMax = 3; G.shield = false; G.x2T = 0;
  const boosts = HUB ? HUB.takeBoosts('skyhook') : [];
  if (boosts.includes('life')) { G.hpMax = 4; G.hp = 4; }
  if (boosts.includes('shield')) G.shield = true;
  if (boosts.includes('magnet')) G.magnetT = 20;
  if (boosts.includes('x2')) G.x2T = 30;
  if (boosts.length) popText('부스트: ' + boosts.map((b) => HUB.boostName('skyhook', b)).join(' · '), G.p.x + 60, G.p.y - 120, '#3D8BFF', 24);
  if (!THEMES[skinTheme() || STAGES[si].theme].img) getBG(skinTheme() || STAGES[si].theme);
  setState('play');
  renderHearts();
  $('hudProgFace').style.backgroundImage = `url(${(window.Costume && Costume.src) || `../common/faces/${Save.data.char}_base.webp?v=202610251749`})`;
  Audio.startBgm();
}

// 스킨 → 이 게임에 원래 있는 테마로 그릴 수 있으면 그 테마, 아니면 공용 스킨 렌더러(common/skins.js)
const SKIN_THEME = { forest: 'forest', winter: 'winter', sunset: 'sunset' };
function skinTheme() { return SKIN_THEME[G.skin] || null; }
function skinDrawn() { return G.skin && G.skin !== 'default' && !skinTheme() && window.Skins && window.Skins.has(G.skin); }

// ---------- physics ----------
function runSpeedNow() {
  const prog = clamp(G.p.x / G.level.len, 0, 1);
  const base = CFG.runSpeed + STAGES[G.si].speed * U;
  return Math.min(CFG.runSpeedMax, lerp(base, base + 2.2 * U, prog)) * G.speedMul;
}

function findHookTarget(p) {
  let best = null, bd = Infinity;
  for (const a of G.level.anchors) {
    if (a.used) continue;
    const dx = a.x - p.x, dy = a.y - p.y;
    if (dx < -10 || dx > CFG.hookRange) continue;
    if (dy > -20) continue; // must be above
    const d = Math.hypot(dx, dy);
    // 전방 상단 부채꼴 (25°~155° 기준, 진행 방향 쪽)
    const ang = Math.atan2(-dy, dx) * 180 / Math.PI;
    if (ang < 25 || ang > 155) continue;
    if (d < CFG.hookRange && d < bd) { bd = d; best = a; }
  }
  return best;
}

function attachHook(a, tapped) {
  const p = G.p;
  const dx = a.x - p.x, dy = a.y - p.y;
  p.hook = a; p.ropeLen = clamp(Math.hypot(dx, dy), 90, CFG.hookRange);
  p.hookBuf = 0; p.onGround = false; p.hookT = 0;
  // Perfect Hook: 앵커가 캐릭터 바로 앞 위쪽 sweet spot 일 때 (타이밍 창 ≈ ±120~160ms)
  const perfectWin = (G.si === 0 ? 0.16 : 0.12) * Math.max(p.vx, CFG.runSpeed);
  const perfect = tapped && dx > 95 - perfectWin && dx < 95 + perfectWin && -dy < 240;
  G.combo++; G.comboT = CFG.comboTimeout;
  if (perfect) {
    G.speedMul = Math.min(1.24, G.speedMul * 1.08);
    p.vx *= 1.08; G.combo++;
    popText('PERFECT!', p.x + 10, p.y - 70, '#3D8BFF', 34);
    burst(a.x, a.y, 16, ['#7CC8FF', '#FFFFFF', '#3D8BFF'], 'star');
    Audio.sfx('perfect'); haptic(20);
  } else {
    burst(a.x, a.y, 8, ['#FFE08A', '#FFFFFF'], 'spark');
    Audio.sfx('hook'); haptic(8);
  }
  if (G.combo >= 2) popText(`COMBO x${G.combo}`, p.x + 10, p.y - 100, '#FF8FAB', 24);
}

function releaseHook(boost = true) {
  const p = G.p;
  if (!p.hook) return;
  const a = p.hook;
  a.used = true;
  if (boost) {
    const dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy) || 1;
    let tx = -dy / d, ty = dx / d; // tangent
    if (tx * p.vx + ty * p.vy < 0) { tx = -tx; ty = -ty; }
    p.vx += tx * CFG.releaseBoost; p.vy += ty * CFG.releaseBoost;
    G.fx.push({ kind: 'trail', t: 0, life: 0.15 });
  }
  p.hook = null; p.airT = 0.2;
}

const GOD = () => !!(window.Hub && window.Hub.god); // 무적 쿠폰 (테스트용)
function hurt(kind) {
  const p = G.p;
  if (GOD()) { if (kind === 'fall') respawn(); return; } // 무적: 안 다치고, 떨어지면 다음 발판으로
  if (kind === 'hit' && p.inv > 0) return;
  if (G.shield) { // 1회 보호 부스트
    G.shield = false; popText('보호막!', p.x, p.y - 80, '#3D8BFF', 28); Audio.sfx('item');
    if (kind === 'fall') respawn(); else { p.inv = CFG.invincible; if (p.hook) releaseHook(false); p.vy = -380; }
    return;
  }
  G.hp--;
  G.combo = 0;
  renderHearts();
  G.cam.shake = 0.1;
  haptic(40);
  if (kind === 'hit') {
    Audio.sfx('hit');
    p.inv = CFG.invincible; p.hurtT = 0.5;
    if (p.hook) releaseHook(false);
    p.vy = -380; p.vx = Math.max(p.vx * 0.6, CFG.runSpeed * 0.6);
    burst(p.x, p.y - 30, 10, ['#FFE08A', '#FFFFFF'], 'star');
  } else Audio.sfx('fall');
  if (G.hp <= 0) { gameOver(); return; }
  if (kind === 'fall') respawn();
}

function respawn() {
  const p = G.p;
  // next platform ahead (the one we were trying to reach)
  let target = null;
  for (const pl of G.level.plats) {
    if (pl.upper || pl.fall || pl.crumble || pl.mvx || pl.mvy) continue;
    if (pl.x + pl.w > p.x + 60 && (!target || pl.x < target.x)) target = pl;
  }
  if (!target) target = G.level.plats[G.level.plats.length - 1];
  p.x = Math.max(target.x + 50, Math.min(p.x, target.x + target.w - 200));
  p.y = target.y - CFG.bodyOff - 140; p.vy = 0; p.vx = CFG.runSpeed; p.hook = null; p.onGround = false;
  p.inv = 1.6;
  popText('앗! 다시 가자!', p.x, p.y - 60, '#FF5C7A', 26);
}

function step(dt) {
  const p = G.p, L = G.level;
  G.t += dt;
  p.anim += dt * (p.onGround ? p.vx / CFG.runSpeed : 1);
  // anchors / clouds motion
  for (const a of L.anchors) if (a.move) a.y = a.by + Math.sin(G.t * 1.7 + a.ph) * a.move;
  for (const o of L.obs) if (o.move) o.y = o.by + Math.sin(G.t * 2 + o.ph) * o.move;
  // 움직이는 발판 / 무너지는 발판
  for (const pl of L.plats) {
    if (pl.mvx || pl.mvy) {
      const a = G.t * pl.mvs + pl.mvp;
      const nx = pl.bx + Math.sin(a) * pl.mvx, ny = pl.by + Math.sin(a) * pl.mvy;
      pl.dx = nx - pl.x; pl.dy = ny - pl.y; pl.x = nx; pl.y = ny;
    }
    if (pl.crT > 0) {
      pl.crT += dt;
      if (pl.crT > 0.42) { pl.fall = true; pl.fvy = (pl.fvy || 0) + CFG.gravity * 0.7 * dt; pl.y += pl.fvy * dt; }
    }
  }
  // 서 있는 발판이 움직이면 같이 움직임
  if (p.onGround && p.gpl && !p.hook) {
    if (p.gpl.fall) p.onGround = false;
    else { p.x += p.gpl.dx; p.y += p.gpl.dy; }
  }

  if (G.endT > 0) { // goal reached: cheer & slow down
    G.endT += dt;
    p.vx = Math.max(0, p.vx - 600 * dt);
    p.x += p.vx * dt;
    if (G.endT > 1.6) showResult(true);
    updateFx(dt);
    return;
  }

  // input edges
  if (input.pressed) {
    input.pressed = false;
    if (p.onGround || p.coyote > 0) p.jumpBuf = CFG.jumpBuffer;
    else p.hookBuf = CFG.hookBuffer;
  }
  p.jumpBuf -= dt; p.hookBuf -= dt;
  p.inv -= dt; p.hurtT -= dt; p.happyT -= dt;
  p.blinkT -= dt; if (p.blinkT < -0.12) p.blinkT = 2 + Math.random() * 2;
  if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
  if (G.magnetT > 0) G.magnetT -= dt;
  if (G.x2T > 0) G.x2T -= dt;
  G.speedMul = lerp(G.speedMul, 1, dt * 0.25);

  if (p.onGround) p.coyote = CFG.coyote; else p.coyote -= dt;

  // jump
  if (p.jumpBuf > 0 && (p.onGround || p.coyote > 0) && !p.hook) {
    p.vy = -CFG.jumpVel; p.onGround = false; p.coyote = 0; p.jumpBuf = 0; p.airT = 0;
    Audio.sfx('jump');
    dust(p.x, p.y + CFG.bodyOff, 5);
  }
  // hook: tap in air (buffered) or keep holding after the jump (kid-friendly assist)
  if (!p.hook && !p.onGround && (p.hookBuf > 0 || (input.down && p.airT > 0.12 && p.vy > -150))) {
    const a = findHookTarget(p);
    if (a) attachHook(a, p.hookBuf > 0);
  }
  if (p.hook && !input.down) releaseHook(true);

  if (p.hook) {
    const a = p.hook;
    p.vy += CFG.gravity * dt;
    p.hookT += dt;
    let dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy) || 1;
    // forward tangent (swing toward +x while under the anchor)
    let tx = dy / d, ty = -dx / d;
    p.vx += tx * CFG.swingPump * dt; p.vy += ty * CFG.swingPump * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    dx = p.x - a.x; dy = p.y - a.y; d = Math.hypot(dx, dy) || 1;
    if (d > p.ropeLen) {
      // taut rope: keep speed, redirect along the tangent (juicy, no energy loss)
      const nx = dx / d, ny = dy / d;
      p.x = a.x + nx * p.ropeLen; p.y = a.y + ny * p.ropeLen;
      const vr = p.vx * nx + p.vy * ny;
      if (vr > 0) {
        const sp0 = Math.hypot(p.vx, p.vy);
        p.vx -= vr * nx; p.vy -= vr * ny;
        const sp1 = Math.hypot(p.vx, p.vy) || 1;
        p.vx *= sp0 * 0.97 / sp1; p.vy *= sp0 * 0.97 / sp1;
      }
      // arcade swing: taut rope always keeps a minimum forward tangential speed, so swings never stall
      tx = dy / d; ty = -dx / d;
      const vt = p.vx * tx + p.vy * ty, minT = runSpeedNow() * 1.25;
      if (vt < minT) { p.vx += tx * (minT - vt); p.vy += ty * (minT - vt); }
    }
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > CFG.swingMax) { p.vx *= CFG.swingMax / sp; p.vy *= CFG.swingMax / sp; }
    // assist: auto-release once well past the front of the swing (or after holding too long)
    const ang = Math.atan2(dx, dy);
    if ((ang > 1.0 && p.vx > 0) || p.hookT > 2.6) releaseHook(true);
  } else {
    p.vy += CFG.gravity * dt;
    const rs = runSpeedNow();
    if (p.onGround) p.vx = lerp(p.vx, rs, Math.min(1, dt * 8));
    else {
      if (p.vx < rs * 0.85) p.vx += (rs * 0.85 - p.vx) * Math.min(1, dt * 2.5);
      else if (p.vx > rs) p.vx -= (p.vx - rs) * dt * 0.5;
    }
    p.airT += dt;
    const prevFeet = p.y + CFG.bodyOff;
    p.x += p.vx * dt; p.y += p.vy * dt;
    const feet = p.y + CFG.bodyOff;
    // platforms: one-way from above (with a small ledge-grab assist)
    let landed = null;
    if (p.vy >= 0) {
      for (const pl of L.plats) {
        if (pl.fall) continue;
        if (p.x < pl.x - 10 || p.x > pl.x + pl.w + 8) continue;
        if (prevFeet <= pl.y + 26 && feet >= pl.y && prevFeet <= feet + 1) { if (!landed || pl.y < landed.y) landed = pl; }
      }
    }
    if (landed) {
      const hard = p.vy > 520;
      p.y = landed.y - CFG.bodyOff;
      if (!p.onGround) {
        if (p.airT > 0.15) { Audio.sfx('land'); dust(p.x, landed.y, hard ? 8 : 4); p.squash = hard ? 1 : 0.5; }
        if (G.combo > 0 && p.airT > 0.3) G.comboT = CFG.comboTimeout;
      }
      p.vy = 0; p.onGround = true; p.airT = 0; p.gpl = landed;
      if (landed.crumble && !landed.crT) { landed.crT = 0.001; Audio.sfx('land'); }
    } else { p.onGround = false; p.gpl = null; }
  }

  // dead zone
  if (p.y + CFG.bodyOff > CFG.deadY) { hurt('fall'); if (G.state !== 'play') return; }

  // items
  for (const it of L.items) {
    if (it.got) continue;
    if (it.x < p.x - 120 || it.x > p.x + 260) continue;
    let dx = it.x - p.x, dy = it.y - (p.y - 8);
    if (G.magnetT > 0 && it.type === 'coin' && Math.hypot(dx, dy) < 210) {
      it.x -= dx * Math.min(1, dt * 9); it.y -= dy * Math.min(1, dt * 9);
      dx = it.x - p.x; dy = it.y - (p.y - 8);
    }
    if (Math.hypot(dx, dy) < 38) collect(it);
  }
  // obstacles
  for (const o of L.obs) {
    if (o.x < p.x - 100 || o.x > p.x + 100) continue;
    if (Math.hypot(o.x - p.x, o.y - (p.y - 10)) < 24 + 20) { if (p.inv <= 0) { o.hit = true; hurt('hit'); } }
  }
  // goal
  if (L.goal && p.x >= L.goal.x && !G.cleared) {
    G.cleared = true; G.endT = 0.001; p.happyT = 9;
    Audio.sfx('goal'); haptic(30);
    for (let i = 0; i < 60; i++) G.fx.push({ kind: 'confetti', x: p.x + (Math.random() - 0.3) * 500, y: G.cam.y - 20 - Math.random() * 200, vx: (Math.random() - 0.5) * 80, vy: 80 + Math.random() * 120, r: Math.random() * 6, c: ['#FFB5C5', '#FFB45A', '#79C89C', '#5CA9E6', '#FFE08A'][i % 5], t: 0, life: 3 });
    popText('GOAL!', p.x + 60, p.y - 90, '#FF9F2E', 48);
  }
  updateFx(dt);
}

function collect(it) {
  if (GOD() && (it.type === 'coin' || it.type === 'star')) return; // 무적: 코인 못 먹음
  it.got = true;
  const p = G.p;
  const mult = G.x2T > 0 ? 2 : 1; // 코인 2배 부스트
  if (it.type === 'coin') { G.coins += mult; Audio.sfx('coin'); burst(it.x, it.y, 4, ['#FFE08A', '#FFF'], 'spark'); }
  else if (it.type === 'star') { G.stars++; G.coins += 5 * mult; Audio.sfx('star'); burst(it.x, it.y, 14, ['#FFD54A', '#FFF7C2', '#FFB45A'], 'star'); popText('+5', it.x, it.y - 30, '#FF9F2E', 26); p.happyT = 0.6; haptic(10); }
  else if (it.type === 'heart') {
    Audio.sfx('item');
    if (G.hp < (G.hpMax || 3)) { G.hp++; renderHearts(true); popText('♥ +1', it.x, it.y - 30, '#FF5C7A', 26); }
    else if (!GOD()) { G.coins += 5 * mult; popText('+5', it.x, it.y - 30, '#FF9F2E', 26); }
    burst(it.x, it.y, 10, ['#FF8FAB', '#FFF'], 'heart');
  } else if (it.type === 'magnet') { G.magnetT = 7; Audio.sfx('item'); popText('자석!', it.x, it.y - 30, '#E84A5F', 26); burst(it.x, it.y, 10, ['#FF6B6B', '#FFF'], 'spark'); }
}

// ---------- FX ----------
function burst(x, y, n, colors, shape) {
  for (let i = 0; i < n && G.fx.length < 80; i++) {
    const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 220;
    G.fx.push({ kind: 'p', shape, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, r: 3 + Math.random() * 4, c: colors[i % colors.length], t: 0, life: 0.4 + Math.random() * 0.3 });
  }
}
function dust(x, y, n) {
  for (let i = 0; i < n && G.fx.length < 80; i++) G.fx.push({ kind: 'dust', x: x - 8 + Math.random() * 16, y, vx: -40 - Math.random() * 80, vy: -20 - Math.random() * 50, r: 4 + Math.random() * 5, t: 0, life: 0.35 + Math.random() * 0.2 });
}
function popText(text, x, y, color, size) { G.texts.push({ text, x, y, color, size, t: 0, life: 0.9 }); }
function updateFx(dt) {
  for (const f of G.fx) { f.t += dt; if (f.x !== undefined) { f.x += (f.vx || 0) * dt; f.y += (f.vy || 0) * dt; } if (f.kind === 'p') f.vy += 500 * dt; }
  G.fx = G.fx.filter((f) => f.t < f.life);
  for (const s of G.texts) s.t += dt;
  G.texts = G.texts.filter((s) => s.t < s.life);
  if (G.p.squash > 0) G.p.squash = Math.max(0, G.p.squash - dt * 6);
  if (G.cam.shake > 0) G.cam.shake -= dt;
}
function haptic(ms) { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) try { navigator.vibrate(ms); } catch (e) { /* unsupported */ } }

// ---------- rendering ----------
function drawSky(th) {
  const gr = ctx.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, th.sky[0]); gr.addColorStop(0.6, th.sky[1]); gr.addColorStop(1, th.sky[2]);
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  const img = th.img && WORLD_IMG[th.img];
  if (img && img.complete && img.naturalWidth) {
    // world picture, tiled sideways (mirrored so the seams match) with a slow parallax
    const sc = Math.max(W / img.naturalWidth, (H + 120) / img.naturalHeight), bw = img.naturalWidth * sc, bh = img.naturalHeight * sc;
    const off = ((G.cam.x * 0.08) % (bw * 2) + bw * 2) % (bw * 2);
    const y = (H - bh) / 2 - G.cam.y * 0.05 + 30;
    for (let x = -off, k = 0; x < W; x += bw, k++) {
      ctx.save();
      if (k % 2) { ctx.translate(x + bw, 0); ctx.scale(-1, 1); ctx.drawImage(img, 0, y, bw, bh); } else ctx.drawImage(img, x, y, bw, bh);
      ctx.restore();
    }
    // soft veil so platforms and items stay easy to read
    const v = ctx.createLinearGradient(0, 0, 0, H);
    v.addColorStop(0, 'rgba(255,255,255,0.10)'); v.addColorStop(1, 'rgba(255,255,255,0.28)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    return;
  }
  // sun
  ctx.fillStyle = th.wood ? 'rgba(255,236,170,.95)' : 'rgba(255,255,240,.8)';
  ctx.beginPath(); ctx.arc(W * 0.78, th.wood ? 330 : 90, th.wood ? 60 : 40, 0, 7); ctx.fill();
  // drifting clouds
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  for (let i = 0; i < 6; i++) {
    const cx = ((i * 330 - G.cam.x * 0.08 - G.t * 8) % (W + 300) + W + 300) % (W + 300) - 150;
    const cy = 60 + (i * 53) % 160 - G.cam.y * 0.05;
    const s = 0.7 + (i % 3) * 0.25;
    ctx.beginPath(); ctx.arc(cx, cy, 28 * s, 0, 7); ctx.arc(cx + 30 * s, cy - 12 * s, 34 * s, 0, 7); ctx.arc(cx + 64 * s, cy, 26 * s, 0, 7); ctx.rect(cx, cy, 64 * s, 24 * s); ctx.fill();
  }
}
function drawLayer(img, par, yOff) {
  const w = img.width;
  let x = -((G.cam.x * par) % w); if (x > 0) x -= w;
  const y = yOff - G.cam.y * par;
  for (; x < W; x += w) ctx.drawImage(img, x, y);
}
// 특수 발판: 무너지는 발판은 금 간 모양 + 흔들림, 움직이는 발판은 아래에 작은 구름
function drawPlat(pl, th) {
  if (!pl.crumble && !pl.mvx && !pl.mvy) return drawPlatform(pl, th);
  ctx.save();
  if (pl.crT > 0 && !pl.fall) ctx.translate(Math.sin(G.t * 70) * 3, 0);
  if (pl.fall) ctx.globalAlpha = Math.max(0, 1 - pl.crT * 0.9);
  if (pl.mvx || pl.mvy) { // 받침 구름
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(pl.x + pl.w * (0.2 + i * 0.2), pl.y + 44, 22, 0, 7); ctx.fill(); }
  }
  drawPlatform({ ...pl, w: pl.w }, th);
  if (pl.crumble) { // 금
    ctx.strokeStyle = 'rgba(70,40,20,.75)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    const R = rng(pl.deco + 7);
    for (let i = 0; i < Math.max(2, pl.w / 70); i++) {
      let cx = pl.x + 20 + R() * (pl.w - 40), cy = pl.y + 2;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      for (let j = 0; j < 3; j++) { cx += (R() - 0.5) * 22; cy += 9 + R() * 8; ctx.lineTo(cx, cy); }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(120,80,50,.18)'; ctx.fillRect(pl.x, pl.y - 4, pl.w, 20);
  }
  ctx.restore();
}
function drawPlatform(pl, th) {
  const x = pl.x, y = pl.y, w = pl.w;
  ctx.lineJoin = 'round';
  if (th.wood) {
    // wooden pier with posts
    ctx.fillStyle = '#7A5134';
    for (let px = x + 30; px < x + w - 10; px += 140) ctx.fillRect(px, y + 14, 14, 200);
    ctx.fillStyle = th.dirt; ctx.strokeStyle = '#6B4529'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x, y, w, 24, 8); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(107,69,41,.5)'; ctx.lineWidth = 2;
    for (let px = x + 46; px < x + w - 10; px += 46) { ctx.beginPath(); ctx.moveTo(px, y + 3); ctx.lineTo(px, y + 21); ctx.stroke(); }
    return;
  }
  const depth = Math.min(110, 40 + w * 0.08);
  ctx.fillStyle = th.dirt; ctx.strokeStyle = th.dirtDark; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + 10);
  ctx.quadraticCurveTo(x + w * 0.1, y + depth * 0.9, x + w * 0.35, y + depth);
  ctx.quadraticCurveTo(x + w * 0.5, y + depth * 1.25, x + w * 0.65, y + depth);
  ctx.quadraticCurveTo(x + w * 0.9, y + depth * 0.9, x + w - 4, y + 10);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // rocks
  const R = rng(pl.deco);
  ctx.fillStyle = th.dirtDark;
  for (let i = 0; i < w / 90; i++) { ctx.beginPath(); ctx.ellipse(x + 30 + R() * (w - 60), y + 28 + R() * depth * 0.5, 6 + R() * 6, 4 + R() * 3, 0, 0, 7); ctx.fill(); }
  // grass / snow cap
  ctx.fillStyle = th.grass; ctx.strokeStyle = th.grassDark; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(x - 4, y - 4, w + 8, 20, 10); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  for (let gx = x + 8; gx < x + w - 6; gx += 22) ctx.arc(gx, y + 15, 7, 0, Math.PI);
  ctx.fill();
  // flowers
  if (!th.snow) for (let i = 0; i < w / 160; i++) {
    const fx = x + 20 + R() * (w - 40);
    ctx.fillStyle = ['#FF8FAB', '#FFFFFF', '#FFD54A'][i % 3];
    ctx.beginPath(); ctx.arc(fx, y - 6, 4, 0, 7); ctx.fill();
    ctx.fillStyle = '#FFE08A'; ctx.beginPath(); ctx.arc(fx, y - 6, 1.6, 0, 7); ctx.fill();
  }
}
function drawAnchor(a, target) {
  const x = a.x, y = a.y;
  // hanging chain + little cloud holder
  ctx.strokeStyle = '#8A97A8'; ctx.lineWidth = 3;
  ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(x, y - 16); ctx.lineTo(x, y - 70); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.arc(x - 18, y - 74, 14, 0, 7); ctx.arc(x, y - 82, 18, 0, 7); ctx.arc(x + 18, y - 74, 14, 0, 7); ctx.fill();
  if (target) {
    ctx.fillStyle = 'rgba(92,169,255,.35)';
    ctx.beginPath(); ctx.arc(x, y, 30 + Math.sin(G.t * 12) * 4, 0, 7); ctx.fill();
  }
  ctx.lineWidth = 7; ctx.strokeStyle = a.used ? '#B8C2CC' : target ? '#3D8BFF' : '#F2A93B';
  ctx.beginPath(); ctx.arc(x, y, 15, 0, 7); ctx.stroke();
  ctx.lineWidth = 2.5; ctx.strokeStyle = a.used ? '#8A96A3' : '#7A4A12';
  ctx.beginPath(); ctx.arc(x, y, 19, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.stroke();
  if (!a.used) { ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(x - 6, y - 9, 3, 0, 7); ctx.fill(); }
}
function drawItem(it) {
  const t = G.t + it.t;
  const x = it.x, y = it.y + Math.sin(t * 3) * 3;
  ctx.save(); ctx.translate(x, y);
  if (it.type === 'coin') {
    ctx.scale(Math.max(0.25, Math.abs(Math.cos(t * 3))), 1);
    ctx.fillStyle = '#FFC93C'; ctx.strokeStyle = '#C98A12'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#FFF1B8'; starPath(0, 0, 6.5, 3); ctx.fill();
  } else if (it.type === 'star') {
    ctx.rotate(Math.sin(t * 2) * 0.2);
    ctx.fillStyle = 'rgba(255,230,120,.4)'; ctx.beginPath(); ctx.arc(0, 0, 30, 0, 7); ctx.fill();
    ctx.fillStyle = '#FFD54A'; ctx.strokeStyle = '#D99A1C'; ctx.lineWidth = 3; starPath(0, 0, 21, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5A3B12'; ctx.beginPath(); ctx.arc(-5, -1, 2, 0, 7); ctx.arc(5, -1, 2, 0, 7); ctx.fill();
  } else if (it.type === 'heart') {
    ctx.scale(1 + Math.sin(t * 6) * 0.06, 1 + Math.sin(t * 6) * 0.06);
    ctx.fillStyle = '#FF5C7A'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; heartPath(0, 0, 18); ctx.fill(); ctx.stroke();
  } else if (it.type === 'magnet') {
    ctx.rotate(-0.5);
    ctx.lineWidth = 11; ctx.strokeStyle = '#E84A5F'; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.arc(0, -2, 13, Math.PI, 0, true); ctx.stroke();
    ctx.strokeStyle = '#DDE3EA'; ctx.beginPath(); ctx.moveTo(-13, -2); ctx.lineTo(-13, -12); ctx.moveTo(13, -2); ctx.lineTo(13, -12); ctx.stroke();
  }
  ctx.restore();
}
function starPath(x, y, ro, ri) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? ri : ro, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  ctx.closePath();
}
function heartPath(x, y, s) {
  ctx.beginPath(); ctx.moveTo(x, y + s * 0.8);
  ctx.bezierCurveTo(x - s * 1.3, y - s * 0.1, x - s * 0.6, y - s * 1.1, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 1.1, x + s * 1.3, y - s * 0.1, x, y + s * 0.8);
}
function drawCloudObs(o) {
  const x = o.x, y = o.y + Math.sin(G.t * 3 + o.ph) * 3;
  ctx.fillStyle = '#6E6A86'; ctx.strokeStyle = '#4A4660'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x - 18, y + 4, 16, 0, 7); ctx.arc(x, y - 8, 21, 0, 7); ctx.arc(x + 19, y + 3, 16, 0, 7); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(x - 18, y + 4, 15, 0, 7); ctx.arc(x, y - 8, 20, 0, 7); ctx.arc(x + 19, y + 3, 15, 0, 7); ctx.fill();
  // angry face
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 8, y - 2, 4.5, 0, 7); ctx.arc(x + 8, y - 2, 4.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#2B2840'; ctx.beginPath(); ctx.arc(x - 7, y - 1, 2.2, 0, 7); ctx.arc(x + 7, y - 1, 2.2, 0, 7); ctx.fill();
  ctx.strokeStyle = '#2B2840'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 13, y - 10); ctx.lineTo(x - 4, y - 7); ctx.moveTo(x + 13, y - 10); ctx.lineTo(x + 4, y - 7); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y + 10, 4, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  // little lightning
  if (Math.sin(G.t * 5 + o.ph) > 0.6) {
    ctx.fillStyle = '#FFD54A'; ctx.beginPath(); ctx.moveTo(x + 4, y + 18); ctx.lineTo(x - 4, y + 32); ctx.lineTo(x + 2, y + 31); ctx.lineTo(x - 3, y + 44); ctx.lineTo(x + 9, y + 27); ctx.lineTo(x + 3, y + 28); ctx.closePath(); ctx.fill();
  }
}
function drawGoal(gl) {
  const x = gl.x, y = gl.y;
  const cols = ['#FF8FAB', '#FFB45A', '#FFE08A', '#79C89C', '#5CA9E6', '#A98BE8'];
  ctx.lineWidth = 7;
  cols.forEach((c, i) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(x, y, 95 - i * 7, Math.PI, 0); ctx.stroke(); });
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#183B5B'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(x - 50, y - 130, 100, 36, 14); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#FF9F2E'; ctx.font = '26px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('GOAL', x, y - 111);
}
function drawHint(h) {
  ctx.font = '22px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(h.text).width + 32;
  ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.strokeStyle = '#5CA9E6'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(h.x - w / 2, h.y - 22, w, 44, 22); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(h.x - 10, h.y + 21); ctx.lineTo(h.x, h.y + 36); ctx.lineTo(h.x + 10, h.y + 21); ctx.fill();
  ctx.fillStyle = '#183B5B'; ctx.fillText(h.text, h.x, h.y + 1);
}

function render() {
  const st = STAGES[G.si], th = THEMES[st.theme];
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  if (!G.level || G.state === 'home' || G.state === 'stages') {
    // idle background behind menus
    G.t += 1 / 60;
    drawSky(THEMES.city);
    return;
  }
  const L = G.level, p = G.p;
  const bgKey = skinTheme() || st.theme, bgTh = THEMES[bgKey];
  if (skinDrawn()) window.Skins.draw(ctx, G.skin, W, H, G.cam.x, -G.cam.y, G.t);
  else {
    drawSky(bgTh);
    if (!bgTh.img) { const bg = getBG(bgKey); drawLayer(bg.far, 0.15, 0); drawLayer(bg.mid, 0.4, 60); }
  }
  if (!skinDrawn() && (bgTh.bubbles || bgTh.fireflies || bgTh.stars)) {
    for (let i = 0; i < 36; i++) {
      const px = ((i * 113 - G.cam.x * 0.3 + Math.sin(G.t * 0.7 + i) * 18) % W + W) % W;
      const py = bgTh.bubbles ? H - ((i * 71 + G.t * (24 + (i % 5) * 9)) % (H + 40)) : (i * 61 + Math.sin(G.t + i) * 14) % H;
      const tw = 0.5 + 0.5 * Math.sin(G.t * 3 + i * 1.7);
      ctx.globalAlpha = bgTh.bubbles ? 0.55 : 0.35 + tw * 0.6;
      ctx.fillStyle = bgTh.bubbles ? 'rgba(220,250,255,.9)' : bgTh.fireflies ? '#FFF2A0' : '#FFFFFF';
      ctx.beginPath(); ctx.arc(px, py, bgTh.bubbles ? 3 + (i % 4) : 1.6 + (i % 3) * 0.8, 0, 7); ctx.fill();
      if (bgTh.bubbles) { ctx.globalAlpha = 0.8; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  }
  if (bgTh.snow && !skinDrawn()) {
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 97 - G.cam.x * 0.6 + Math.sin(G.t + i) * 20) % W + W) % W;
      const sy = ((i * 61 + G.t * (30 + (i % 5) * 10)) % H);
      ctx.beginPath(); ctx.arc(sx, sy, 1.5 + (i % 3), 0, 7); ctx.fill();
    }
  }
  ctx.save();
  let sx = 0, sy = 0;
  if (G.cam.shake > 0) { sx = (Math.random() - 0.5) * 8; sy = (Math.random() - 0.5) * 8; }
  ctx.translate(-Math.round(G.cam.x) + sx, -Math.round(G.cam.y) + sy);
  const vx0 = G.cam.x - 200, vx1 = G.cam.x + W + 200;

  for (const pl of L.plats) if (pl.x < vx1 && pl.x + pl.w > vx0 && pl.y < H + 400) drawPlat(pl, th);
  if (L.goal && L.goal.x > vx0 && L.goal.x < vx1) drawGoal(L.goal);
  if (G.si === 0) for (const h of L.hints) if (h.x > vx0 && h.x < vx1) drawHint(h);

  const target = !p.hook && !p.onGround ? findHookTarget(p) : null;
  for (const a of L.anchors) if (a.x > vx0 && a.x < vx1) drawAnchor(a, a === target);
  for (const it of L.items) if (!it.got && it.x > vx0 && it.x < vx1) drawItem(it);
  for (const o of L.obs) if (o.x > vx0 && o.x < vx1) drawCloudObs(o);

  // aim guide
  if (target) {
    ctx.strokeStyle = 'rgba(61,139,255,.55)'; ctx.lineWidth = 3; ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(p.x, p.y - 25); ctx.lineTo(target.x, target.y); ctx.stroke(); ctx.setLineDash([]);
  }
  // rope — 새 캐릭터(v2): 줄 끝 = 손, 몸은 줄과 한 직선으로 (줄이 절대 꺾이지 않게)
  const v2Hang = p.hook && window.CharV2 && CharV2.is(Save.data.char) && CharV2.ready(Save.data.char) && !(p.inv > 0 && Math.floor(p.inv * 12) % 2 === 0) && p.hurtT <= 0;
  let v2Hand = null;
  if (v2Hang) {
    const dx = p.x - p.hook.x, dy = p.y - p.hook.y, d = Math.hypot(dx, dy) || 1;
    const L = Math.max(30, d - 46); v2Hand = { x: p.hook.x + dx / d * L, y: p.hook.y + dy / d * L, rot: -Math.atan2(dx, dy) };
    ctx.strokeStyle = '#5A3B22'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p.hook.x, p.hook.y); ctx.lineTo(v2Hand.x, v2Hand.y); ctx.stroke();
    ctx.strokeStyle = '#C9945A'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(p.hook.x, p.hook.y); ctx.lineTo(v2Hand.x, v2Hand.y); ctx.stroke();
  } else if (p.hook) {
    // hands: local (3,-96) around the body pivot (feet-50), rotated like the sprite
    const r = -Math.atan2(p.x - p.hook.x, p.y - p.hook.y) * 0.8;
    const hx = p.x + 3 * Math.cos(r) + 46 * Math.sin(r), hy = p.y + CFG.bodyOff - 50 + 3 * Math.sin(r) - 46 * Math.cos(r);
    ctx.strokeStyle = '#5A3B22'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p.hook.x, p.hook.y); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.strokeStyle = '#C9945A'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(p.hook.x, p.hook.y); ctx.lineTo(hx, hy); ctx.stroke();
  }
  // trail after release
  for (const f of G.fx) if (f.kind === 'trail') {
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - f.t / f.life)})`; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(p.x - p.vx * 0.12, p.y - p.vy * 0.12); ctx.lineTo(p.x, p.y); ctx.stroke();
  }

  // player
  const blinkHide = p.inv > 0 && Math.floor(p.inv * 12) % 2 === 0;
  if (!blinkHide) {
    let pose = 'run';
    if (p.hurtT > 0) pose = 'hit';
    else if (p.hook) pose = 'swing';
    else if (!p.onGround) pose = p.vy < 0 ? 'jump' : 'fall';
    if (G.endT > 0 && p.vx < 30) pose = 'idle';
    if (v2Hand && pose === 'swing') {
      ctx.save(); ctx.translate(v2Hand.x, v2Hand.y);
      CharV2.draw(ctx, Save.data.char, `swing_${Math.floor(p.anim * 4) % (CharV2.count(Save.data.char, 'swing_') || 2)}`, { h: 118, anchor: 'hand', rot: v2Hand.rot });
      ctx.restore();
    } else {
    ctx.save();
    ctx.translate(p.x, p.y + CFG.bodyOff);
    if (p.hook) {
      const ang = Math.atan2(p.x - p.hook.x, p.y - p.hook.y);
      ctx.translate(0, -50); ctx.rotate(-ang * 0.8); ctx.translate(0, 50);
    } else if (!p.onGround) ctx.rotate(clamp(p.vy / 2500, -0.15, 0.2));
    if (p.squash > 0) ctx.scale(1 + p.squash * 0.12, 1 - p.squash * 0.12);
    if (G.endT > 0 && p.vx < 30) pose = 'cheer';
    if (!drawKidSprite(ctx, Save.data.char, pose, p.anim)) drawKid(ctx, Save.data.char, pose === 'cheer' ? 'idle' : pose, p.anim, { blink: p.blinkT < 0, happy: p.happyT > 0 });
    ctx.restore();
    }
  }
  // FX
  for (const f of G.fx) {
    const k = 1 - f.t / f.life;
    if (f.kind === 'p') {
      ctx.globalAlpha = k; ctx.fillStyle = f.c;
      if (f.shape === 'star') { starPath(f.x, f.y, f.r * 1.6, f.r * 0.7); ctx.fill(); }
      else if (f.shape === 'heart') { heartPath(f.x, f.y, f.r); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(f.x, f.y, f.r * k, 0, 7); ctx.fill(); }
    } else if (f.kind === 'dust') {
      ctx.globalAlpha = k * 0.8; ctx.fillStyle = '#F4EBDD';
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1.5 - k * 0.5), 0, 7); ctx.fill();
    } else if (f.kind === 'confetti') {
      ctx.globalAlpha = Math.min(1, k * 2); ctx.fillStyle = f.c;
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.t * 6 + f.r); ctx.fillRect(-5, -3, 10, 6); ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  for (const s of G.texts) {
    const k = s.t / s.life;
    ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
    const sc = k < 0.15 ? 0.6 + k / 0.15 * 0.5 : 1.1 - Math.min(0.1, (k - 0.15));
    ctx.save(); ctx.translate(s.x, s.y - k * 40); ctx.scale(sc, sc);
    ctx.font = `${s.size}px Jua, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.strokeText(s.text, 0, 0);
    ctx.fillStyle = s.color; ctx.fillText(s.text, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  const buffs = [];
  if (G.magnetT > 0) buffs.push(`자석 ${Math.ceil(G.magnetT)}초`);
  if (G.x2T > 0) buffs.push(`코인2배 ${Math.ceil(G.x2T)}초`);
  if (G.shield) buffs.push('보호막');
  if (buffs.length) {
    ctx.font = '18px Jua, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.strokeText(buffs.join(' · '), 18, 66);
    ctx.fillStyle = 'rgba(232,74,95,.95)'; ctx.fillText(buffs.join(' · '), 18, 66);
  }
  if (G.state === 'result' && !G.cleared) { ctx.fillStyle = 'rgba(80,90,110,.25)'; ctx.fillRect(0, 0, W, H); }
}

function updateCamera(dt) {
  const p = G.p;
  const tx = p.x - W * 0.28 + Math.max(0, p.vx - CFG.runSpeed) * 0.15;
  G.cam.x = lerp(G.cam.x, tx, Math.min(1, dt * 6));
  if (G.cam.x < tx - W * 0.2) G.cam.x = tx - W * 0.2;
  const ty = clamp(p.y - 300, -320, 0);
  G.cam.y = lerp(G.cam.y, ty, Math.min(1, dt * (p.hook ? 2.5 : 4))); // Y damping on swing
}

// ---------- HUD ----------
let lastHud = '';
function updateHud() {
  const p = G.p, L = G.level;
  const dist = Math.max(0, Math.floor(p.x / U));
  const key = dist + '|' + G.coins;
  if (key !== lastHud) { lastHud = key; $('hudDist').textContent = dist; $('hudCoin').textContent = G.coins; }
  const prog = clamp(p.x / L.goal.x, 0, 1) * 100;
  $('hudProg').style.width = prog + '%'; $('hudProgFace').style.left = prog + '%';
}
function renderHearts(pop) {
  const el = $('hudHearts'); el.innerHTML = '';
  for (let i = 0; i < (G.hpMax || 3); i++) {
    const d = document.createElement('div');
    d.className = 'heart' + (i >= G.hp ? ' empty' : '') + (pop && i === G.hp - 1 ? ' pop' : '');
    el.appendChild(d);
  }
}

// ---------- screens ----------
function setState(s) {
  G.state = s;
  $('home').classList.toggle('hidden', s !== 'home');
  $('stages').classList.toggle('hidden', s !== 'stages');
  $('pause').classList.toggle('hidden', s !== 'pause');
  $('result').classList.toggle('hidden', s !== 'result');
  $('ready').classList.toggle('hidden', s !== 'ready');
  $('hud').classList.toggle('hidden', !(s === 'play' || s === 'pause'));
  input.down = false; input.pressed = false;
  if (s === 'home') refreshHome();
  if (s === 'stages') renderStageList();
}
function refreshHome() {
  document.querySelectorAll('.char').forEach((b) => b.classList.toggle('on', b.dataset.char === Save.data.char));
  $('totalCoin').textContent = Save.data.totalCoin || 0;
  const best = Object.values(Save.data.best || {}); $('bestAll').textContent = best.length ? Math.max(...best) : 0;
  document.body.classList.toggle('muted', !Save.data.sound);
}
function renderStageList() {
  const list = $('stageList'); list.innerHTML = '';
  STAGES.forEach((st, i) => {
    const b = document.createElement('button'); b.className = 'stage' + (i === G.si ? ' on' : '');
    b.innerHTML = `<div class="thumb" style="background-image:url(../common/worlds/w${st.world + 1}.webp)"><span class="num">${st.label}</span>${Save.data.cleared[i] ? '<span class="clear">CLEAR</span>' : ''}</div><div class="name">${st.name}</div><div class="best">최고 ${Save.data.best[i] || 0}m</div>`;
    b.addEventListener('click', () => { Audio.unlock(); Audio.sfx('ui'); startStage(i); });
    list.appendChild(b);
  });
}
function finishRun(clear) {
  const dist = Math.floor(G.p.x / U);
  const prevBest = Save.data.best[G.si] || 0;
  const isBest = dist > prevBest;
  if (isBest) Save.data.best[G.si] = dist;
  if (clear) Save.data.cleared[G.si] = true;
  Save.data.totalCoin = (Save.data.totalCoin || 0) + G.coins;
  Save.store();
  return { dist, isBest, best: Math.max(dist, prevBest) };
}
function gameOver() {
  Audio.sfx('gameover');
  Audio.stopBgm();
  G.p.dead = true;
  showResult(false);
}
function showResult(clear) {
  if (G.state === 'result') return;
  const r = finishRun(clear);
  const stars = clear ? clamp(G.hp, 1, 3) : 0; // 남은 하트 = 별
  Audio.stopBgm();
  $('resStar').innerHTML = [0, 1, 2].map((k) => `<i class="${k < stars ? '' : 'off'}"></i>`).join('');
  $('resEarn').classList.toggle('hidden', !HUB);
  if (HUB) {
    const h = HUB.record('skyhook', { stage: G.si, cleared: clear, dist: r.dist, coins: G.coins, stars });
    const st = HUB.skyhookStage(G.si);
    r.isBest = h.newBest; r.best = st.best;
    $('resEarn').innerHTML = `+${h.earned} 코인 획득!` + (h.bonus ? `<small>(클리어 보너스 +${h.bonus}${h.firstClear ? ', 첫 클리어!' : ''})</small>` : '') + `<small>내 코인 <b>${h.coins}</b></small>`;
  }
  $('resTitle').textContent = clear ? 'STAGE CLEAR!' : 'GAME OVER';
  $('resLabel').textContent = STAGES[G.si].label;
  document.querySelector('.panel.result').classList.toggle('over', !clear);
  $('resFace').src = (window.Costume && Costume.src) || `../common/faces/${Save.data.char}_${clear ? 'happy' : 'sad'}.webp`;
  $('resFace').classList.toggle('cos', !!(window.Costume && Costume.src));
  $('resDist').textContent = r.dist; $('resCoin').textContent = G.coins;
  $('resBestVal').textContent = r.best;
  $('resBest').classList.toggle('hidden', !r.isBest);
  const hasNext = clear && G.si < STAGES.length - 1;
  $('btnNext').classList.toggle('hidden', !hasNext);
  // 다음 스테이지가 없으면 다시하기가 그 자리(한 줄 전체·크게)로
  const rb = $('btnRetry');
  if (hasNext) $('resRow').prepend(rb); else $('btnNext').after(rb);
  rb.className = 'rb ' + (hasNext ? 'white' : 'gold big');
  setState('result');
}
function pauseGame() { if (G.state === 'play' && G.endT === 0) { setState('pause'); Audio.stopBgm(); } }
function resumeGame() { if (G.state === 'pause') { setState('play'); Audio.startBgm(); last = performance.now(); } }
function goHome() {
  Audio.stopBgm();
  if (HUB) location.href = '../index.html#map-skyhook'; else setState('home');
}
// 메인 화면에서 스테이지를 골라 들어오면: 출발 대기 화면부터 (첫 탭에 소리 켜짐)
function showReady(si) {
  G.si = si;
  $('readyTitle').textContent = `${STAGES[si].label} ${STAGES[si].name}`;
  $('readyFace').src = (window.Costume && Costume.src) || `../common/faces/${Save.data.char}_base.webp?v=202610251749`;
  $('readyFace').classList.toggle('cos', !!(window.Costume && Costume.src));
  setState('ready');
}

// ---------- input ----------
function press() { if (!input.down) { input.down = true; input.pressed = true; } }
function release() { input.down = false; }
root.addEventListener('pointerdown', (e) => {
  Audio.unlock();
  if (G.state !== 'play') return;
  if (e.target.closest('button')) return;
  e.preventDefault();
  press();
});
window.addEventListener('pointerup', release);
window.addEventListener('pointercancel', release);
root.addEventListener('touchstart', (e) => { if (G.state === 'play' && !e.target.closest('button')) e.preventDefault(); }, { passive: false });
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
window.addEventListener('keydown', (e) => {
  Audio.unlock();
  const k = e.code;
  if (k === 'Space' || k === 'ArrowUp' || k === 'KeyW') {
    e.preventDefault();
    if (e.repeat) return;
    if (G.state === 'play') press();
    else if (G.state === 'home' || G.state === 'ready') startStage(G.si);
    else if (G.state === 'result') startStage(G.si);
    else if (G.state === 'pause') resumeGame();
  } else if (k === 'Escape' || k === 'KeyP') {
    if (G.state === 'play') pauseGame(); else if (G.state === 'pause') resumeGame();
  } else if (k === 'KeyR') {
    if (G.state === 'play' || G.state === 'pause' || G.state === 'result') startStage(G.si);
  } else if (k === 'Enter' && G.state === 'home') startStage(G.si);
});
window.addEventListener('keyup', (e) => { if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') release(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('blur', () => { pauseGame(); release(); });

const click = (id, fn) => $(id).addEventListener('click', () => { Audio.unlock(); Audio.sfx('ui'); fn(); });
click('btnStart', () => startStage(G.si));
click('btnStages', () => setState('stages'));
click('btnStagesBack', () => setState('home'));
click('btnPause', pauseGame);
click('btnResume', resumeGame);
click('btnRetryP', () => startStage(G.si));
click('btnHomeP', goHome);
click('btnRetry', () => startStage(G.si));
click('btnNext', () => startStage(Math.min(STAGES.length - 1, G.si + 1)));
click('btnHomeR', goHome);
click('btnSound', () => { Save.data.sound = !Save.data.sound; Save.store(); if (HUB) HUB.setSound(Save.data.sound); Audio.applyMute(); refreshHome(); });
click('btnGo', () => startStage(G.si));
click('btnReadyMap', goHome);
document.querySelectorAll('.char').forEach((b) => b.addEventListener('click', () => {
  Audio.unlock(); Audio.sfx('ui'); Save.data.char = b.dataset.char; Save.store(); refreshHome();
}));

// ---------- layout ----------
// The game fills the whole screen. On a phone held upright (or with rotation lock on)
// the game is rotated 90° so it still plays full-screen in landscape.
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
function resize() {
  const vv = window.visualViewport;
  const vw = Math.round(vv ? vv.width : window.innerWidth), vh = Math.round(vv ? vv.height : window.innerHeight);
  const s = $('safe').getBoundingClientRect();
  const inset = { t: s.top, l: s.left, r: vw - s.right, b: vh - s.bottom };
  const rotated = isTouch && vh > vw;
  const sw = rotated ? vh : vw, sh = rotated ? vw : vh; // screen size in game orientation
  W = Math.round(H * Math.max(sw / sh, 16 / 9));
  scale = Math.min(sw / W, sh / H);
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  root.style.width = W + 'px'; root.style.height = H + 'px';
  const ox = (sw - W * scale) / 2, oy = (sh - H * scale) / 2;
  root.style.transform = rotated
    ? `translate(${vw - oy}px, ${ox}px) rotate(90deg) scale(${scale})`
    : `translate(${ox}px, ${oy}px) scale(${scale})`;
  // safe area (notch / home indicator) in game coordinates, used by the HUD and menus
  const ins = rotated ? { l: inset.t, r: inset.b, t: inset.r, b: inset.l } : inset;
  for (const k of ['l', 'r', 't', 'b']) root.style.setProperty('--safe-' + k, Math.max(0, ins[k] / scale - (k === 'l' || k === 'r' ? ox : oy) / scale) + 'px');
  canvas.width = Math.round(W * scale * dpr); canvas.height = Math.round(H * scale * dpr);
  $('rotateHint').classList.toggle('hidden', isTouch || vh <= vw);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

// ---------- main loop (fixed 120Hz physics) ----------
let last = performance.now(), acc = 0;
const DT = 1 / 120;
function frame(now) {
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.05) dt = 0.05;
  if (G.state === 'play') {
    acc += dt;
    while (acc >= DT) { step(DT); acc -= DT; if (G.state !== 'play') break; }
    if (G.state === 'play' || G.state === 'result') updateCamera(dt);
    updateHud();
  } else acc = 0;
  render();
  requestAnimationFrame(frame);
}
resize();
if (HUB) {
  let si = parseInt(new URLSearchParams(location.search).get('stage'), 10);
  if (!(si >= 0 && si < STAGES.length) || !HUB.skyhookUnlocked(si)) si = HUB.skyhookNext();
  showReady(si);
  if (new URLSearchParams(location.search).get('go') === '1') startStage(si); // 인트로 START: 준비 창 없이 바로
  $('btnHomeR').textContent = '지도로'; $('btnHomeP').textContent = '지도로';
} else setState('home');
requestAnimationFrame(frame);

// debug/test hook
window.__sky = { G, CFG, input, startStage, press, release, buildLevel, findHookTarget, step, DT };
