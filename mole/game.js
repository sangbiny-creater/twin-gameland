'use strict';
// 은유와 은결의 두더지 게임 — 구멍 9개에서 튀어나오는 두더지를 톡톡 치기
//  · 일반 두더지(노란 안전모) +100 / 빠른 두더지(빨간 모자, 금방 숨음) +200 / 2대 두더지(빨간 헬멧, 두 번 쳐야 함) +300
//  · 함정: 내 캐릭터 얼굴이 나오면 누르면 안 됨 (누르면 -100점·콤보 0). 5월드부터는 은유·은결 둘 다 나옴
//  · 빈 구멍을 눌러도 감점 없음. 두더지를 놓치면 콤보만 0
//  · 콤보 5번 ×1.2, 10번 ×1.5, 20번 ×2 점수
//  · 시간이 끝났을 때 목표 점수를 넘으면 클리어 → 점수로 별 1~3개
//  · 징검다리: 10개 월드 × 10판 = 100판 (1-1 ~ 10-10). 판별 시간·목표·두더지 표는 levels.js
// 폰 세로: 세로 배치 (논리 폭 540) / 폰 가로·태블릿 가로·PC: 가로 배치 (논리 높이 540) — 화면을 돌리지 않고 구멍 자리를 바꿈

let W = 540, H = 960;
const WORLDS = ['하늘도시', '숲속 나무마을', '겨울왕국', '석양의 항구', '벚꽃마을', '구름왕국', '바닷속도시', '마법숲', '별빛우주', '황금성'];
const { PER_WORLD, STAGES, PTS } = window.MoleLevels;
const SKIN_BG = { forest: 1, sunset: 1, winter: 2, night: 3, space: 4 }; // 공통 배경 스킨 → 사천성 배경 그림 (나머지는 skins.js로 그림)
const TRAP_PENALTY = 100; // 함정 캐릭터를 누르면 줄어드는 점수
const label = (i) => `${Math.floor(i / PER_WORLD) + 1}-${(i % PER_WORLD) + 1}`;
const stageName = (i) => `${WORLDS[Math.floor(i / PER_WORLD)]} ${(i % PER_WORLD) + 1}`;
const ASSET_V = '202610251706';
const asset = (p) => `assets/${p}.webp?v=${ASSET_V}`;

// ---------- save (메인 화면 없이 단독 실행할 때) ----------
const Save = {
  data: { cleared: {}, sound: true },
  load() { try { Object.assign(this.data, JSON.parse(localStorage.getItem('mole_v1') || '{}')); } catch (e) { /* private mode */ } },
  store() { try { localStorage.setItem('mole_v1', JSON.stringify(this.data)); } catch (e) { /* ignore */ } },
};
Save.load();
const HUB = window.Hub && window.Hub.active() ? window.Hub : null;
if (HUB) Save.data.sound = HUB.settings.sound;
const unlocked = (i) => (HUB ? HUB.stageUnlocked('mole', i) : i === 0 || !!Save.data.cleared[i - 1]);
const nextStage = () => { if (HUB) return HUB.stageNext('mole'); for (let i = 0; i < STAGES.length; i++) if (!Save.data.cleared[i]) return i; return STAGES.length - 1; };
const GOD = () => !!(window.Hub && window.Hub.god); // 무적 쿠폰 (테스트용)

// ---------- utils ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const $ = (id) => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const fmt = (n) => Math.round(n).toLocaleString();

// ---------- images ----------
const img = (src) => { const im = new Image(); im.src = src; return im; };
const ok = (im) => im && im.complete && im.naturalWidth > 0;
const SPR = {
  normal: img(asset('sprites/mole_normal')), fast: img(asset('sprites/mole_fast')),
  tough: img(asset('sprites/mole_tough')), tough2: img(asset('sprites/mole_tough2')),
  star: img(`../common/items/double.webp?v=${ASSET_V}`),
};
// 두더지 그림 아래쪽 흙더미는 잘라 내고 구멍 앞 흙으로 가림 (그림 높이 중 쓰는 비율)
const CUT = { normal: 0.76, fast: 0.78, tough: 0.8, tough2: 0.8 };
const BG = { sky: img(asset('bg/sky')), flowers: img(asset('bg/flowers')), skin: [] };
for (let i = 0; i < 5; i++) BG.skin.push(img(`../shisen/assets/bg/bg_${i}.webp?v=${ASSET_V}`));
// 함정 캐릭터 얼굴: 내 캐릭터 + (5월드부터) 쌍둥이 다른 한 명
const myLook = (() => { const c = HUB && HUB.active(); return (c && c.look) || 'eunyu'; })();
const myBase = (() => { const l = (window.CHAR_LOOKS || []).find((x) => x.look === myLook); return (l && l.base) || (myLook.startsWith('eungyeol') ? 'eungyeol' : 'eunyu'); })();
const twinLook = myBase === 'eungyeol' ? 'eunyu' : 'eungyeol';
const FACE = {};
for (const lk of new Set([myLook, twinLook])) FACE[lk] = { base: img(`../common/faces/${lk}_base.webp?v=${ASSET_V}`), sad: img(`../common/faces/${lk}_sad.webp?v=${ASSET_V}`) };
const RING = { eunyu: '#FF8FB1', eungyeol: '#5FA8FF' };

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
      case 'pop': this.tone(380 + Math.random() * 120, 0.08, 'sine', 0.12, 260); break;
      case 'hit': this.tone(180, 0.09, 'square', 0.18, -90); [880, 1175].forEach((f, i) => this.tone(f * (1 + Math.min(k, 20) * 0.02), 0.09, 'triangle', 0.25, 0, 0.03 + i * 0.05)); break;
      case 'clank': this.tone(1400, 0.12, 'square', 0.12, -600); this.tone(2100, 0.08, 'triangle', 0.12, -900, 0.02); break;
      case 'miss': this.tone(240, 0.06, 'triangle', 0.12, -60); break;
      case 'bad': this.tone(330, 0.16, 'square', 0.14, -150); this.tone(220, 0.22, 'square', 0.12, -80, 0.12); break;
      case 'combo': [1046, 1318, 1568].forEach((f, i) => this.tone(f, 0.1, 'triangle', 0.22, 0, i * 0.05)); break;
      case 'time': [880, 1175, 1568].forEach((f, i) => this.tone(f, 0.12, 'sine', 0.3, 0, i * 0.05)); break;
      case 'double': [660, 880, 1320, 1760].forEach((f, i) => this.tone(f, 0.1, 'triangle', 0.22, 0, i * 0.05)); break;
      case 'rainbow': for (let i = 0; i < 8; i++) this.tone(520 + i * 140, 0.09, 'triangle', 0.18, 0, i * 0.035); break;
      case 'tick': this.tone(1500, 0.04, 'square', 0.1); break;
      case 'count': this.tone(880, 0.08, 'sine', 0.25); break;
      case 'go': [660, 990].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.3, 0, i * 0.08)); break;
      case 'clear': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.22, 'square', 0.16, 0, i * 0.11)); break;
      case 'fail': [523, 440, 349, 262].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.3, 0, i * 0.17)); break;
      case 'ui': this.tone(700, 0.06, 'triangle', 0.25); break;
    }
  },
  // 통통 튀는 행진곡
  mel: [67, 0, 72, 0, 76, 74, 72, 0, 69, 0, 72, 0, 74, 0, 0, 0, 67, 0, 71, 0, 74, 72, 71, 0, 67, 0, 69, 71, 72, 0, 0, 0],
  bass: [48, 43, 45, 41, 43, 47, 48, 43],
  startBgm() {
    if (this.bgmOn || !this.ctx) { this.bgmOn = true; return; }
    this.bgmOn = true; this.next = this.ctx.currentTime + 0.1; clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (!this.ctx || !this.bgmOn) return;
      const sd = 60 / 132 / 2, mf = (n) => 440 * Math.pow(2, (n - 69) / 12);
      while (this.next < this.ctx.currentTime + 0.2) {
        const w = this.next - this.ctx.currentTime, m = this.mel[this.step % 32];
        if (m) this.tone(mf(m), sd * 1.2, 'triangle', 0.26, 0, w, this.bgm);
        if (this.step % 4 === 0) this.tone(mf(this.bass[(this.step / 4) % 8]), sd * 2.5, 'sine', 0.5, 0, w, this.bgm);
        if (this.step % 4 === 2) this.tone(2400, 0.03, 'square', 0.05, 0, w, this.bgm);
        this.next += sd; this.step++;
      }
    }, 40);
  },
  stopBgm() { this.bgmOn = false; clearInterval(this.timer); this.timer = null; },
};
const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };

// ---------- state ----------
const cv = $('cv'), ctx = cv.getContext('2d'), root = $('root');
let scale = 1, dpr = 1;
// 상태: ready → count(3·2·1) → play → done(끝 연출) → result / pause
const G = {
  state: 'ready', si: 0, holes: [], fx: [], t: 0, time: 0, limit: 0, countT: 0,
  score: 0, coins: 0, combo: 0, maxCombo: 0, caught: 0, spawnT: 0, dblT: 0, comboX2: false,
  skin: 'default', tickT: 0, pausedFrom: 'play',
};

// ---------- holes ----------
// 구멍: { x, y(구멍 가운데), s(구멍 크기), m(지금 나와 있는 두더지), cool(다시 나오기까지 쉬는 시간) }
// 두더지: { type: normal|fast|tough|trap, who(함정 얼굴), ph: up|stay|down|hit|ouch, t, stay, hp, u(올라온 정도 0~1) }
function layoutHoles() {
  const sv = (k) => parseFloat(getComputedStyle(root).getPropertyValue('--safe-' + k)) || 0;
  // 가로 화면이 좁으면(태블릿 4:3) 점수 줄이 위 두 번째 줄로 내려옴 (style.css #root.narrow)
  const top = wideLayout() ? (root.classList.contains('narrow') ? 112 : 70) : 168;
  const a = wideLayout()
    ? { x: 118 + sv('l'), y: top + sv('t'), w: W - 118 - 18 - sv('l') - sv('r'), h: H - top - 8 - sv('t') - sv('b') }
    : { x: 10, y: top + sv('t'), w: W - 20, h: H - top - 140 - sv('t') - sv('b') };
  const cw = a.w / 3, rh = a.h / 3, s = Math.min(cw * 0.86, rh * 0.84, 200);
  if (!G.holes.length) for (let k = 0; k < 9; k++) G.holes.push({ m: null, cool: 0 });
  G.holes.forEach((h, k) => {
    const c = k % 3, r = Math.floor(k / 3);
    h.x = a.x + cw * (c + 0.5); h.y = a.y + rh * r + rh * 0.5 + s * 0.3; h.s = s;
  });
  G.fieldTop = a.y;
}

function spawn() {
  const st = STAGES[G.si];
  const live = G.holes.filter((h) => h.m && h.m.type !== 'trap' && h.m.ph !== 'hit').length;
  const traps = G.holes.filter((h) => h.m && h.m.type === 'trap').length;
  const free = G.holes.filter((h) => !h.m && h.cool <= 0);
  if (!free.length) return;
  const isTrap = st.trap > 0 && traps === 0 && Math.random() < st.trap * 1.4;
  if (!isTrap && live >= st.maxOn) return;
  const h = free[Math.floor(Math.random() * free.length)];
  let type = 'normal';
  if (isTrap) type = 'trap';
  else { const r = Math.random(); if (r < st.fast) type = 'fast'; else if (r < st.fast + st.tough) type = 'tough'; }
  const stay = { normal: st.stay, fast: st.stay * 0.55, tough: st.stay * 1.4, trap: st.stay * 1.25 }[type];
  h.m = { type, who: type === 'trap' ? (st.both && Math.random() < 0.5 ? twinLook : myLook) : null, ph: 'up', t: 0, stay, hp: type === 'tough' ? 2 : 1, u: 0, shake: 0 };
  Audio.sfx('pop');
}
const RISE = { normal: 0.16, fast: 0.1, tough: 0.2, trap: 0.18 };

function stepHoles(dt) {
  const playing = G.state === 'play';
  for (const h of G.holes) {
    h.cool -= dt;
    const m = h.m; if (!m) continue;
    m.t += dt; m.shake = Math.max(0, m.shake - dt);
    if (m.ph === 'up') { m.u = Math.min(1, m.t / RISE[m.type]); if (m.u >= 1) { m.ph = 'stay'; m.t = 0; } }
    else if (m.ph === 'stay') { if (m.t >= m.stay || !playing) { m.ph = 'down'; m.t = 0; if (playing && m.type !== 'trap') G.combo = 0; } }
    else if (m.ph === 'down') { m.u = Math.max(0, 1 - m.t / 0.16); if (m.u <= 0) { h.m = null; h.cool = 0.25; } }
    else if (m.ph === 'hit') { if (m.t > 0.14) m.u = Math.max(0, 1 - (m.t - 0.14) / 0.2); if (m.u <= 0) { h.m = null; h.cool = 0.3; } }
    else if (m.ph === 'ouch') { if (m.t > 0.7) m.u = Math.max(0, 1 - (m.t - 0.7) / 0.18); if (m.u <= 0) { h.m = null; h.cool = 0.4; } }
  }
}

// ---------- run ----------
function startStage(si) {
  G.si = si; const st = STAGES[si];
  clearTimers();
  G.limit = st.time; G.time = st.time; G.score = 0; G.coins = 0; G.combo = 0; G.maxCombo = 0; G.caught = 0;
  G.fx = []; G.t = 0; G.dblT = 0; G.comboX2 = false; G.spawnT = 0.3; G.tickT = 0;
  for (const h of G.holes) { h.m = null; h.cool = 0; }
  if (HUB) HUB.starterKit('mole');
  G.skin = HUB ? HUB.equippedSkin('mole') : 'default';
  const boosts = HUB ? HUB.takeBoosts('mole') : [];
  if (boosts.includes('combo')) G.comboX2 = true;
  if (boosts.length) toast('부스트: ' + boosts.map((b) => HUB.boostName('mole', b)).join(' · '));
  $('hudStage').textContent = `스테이지 ${label(si)}`;
  $('hudGoal').textContent = fmt(st.goal);
  renderItems(); renderBuffs();
  G.countT = 3;
  setState('count');
  Audio.startBgm();
}
function showReady(si) {
  G.si = si; clearTimers();
  for (const h of G.holes) { h.m = null; }
  const st = STAGES[si];
  $('readyTitle').textContent = `${label(si)} ${stageName(si)}`;
  // 이 판에 나오는 두더지만 보여 줌
  const kinds = [['normal', '일반', `+${PTS.normal}`, true], ['fast', '빠른', `+${PTS.fast}`, st.fast > 0], ['tough', '2대', `+${PTS.tough}`, st.tough > 0]];
  let html = kinds.filter((k) => k[3]).map(([id, nm, p]) => `<div class="lg"><img src="${asset('sprites/mole_' + id)}" alt=""><span>${nm}</span><b>${p}</b></div>`).join('');
  if (st.trap > 0) {
    const faces = st.both ? [myLook, twinLook] : [myLook];
    html += `<div class="lg no">${faces.map((lk) => `<i style="background-image:url(../common/faces/${lk}_base.webp?v=${ASSET_V})"></i>`).join('')}<span>누르면 안 돼요!</span><b>-${TRAP_PENALTY}</b></div>`;
  }
  $('legend').innerHTML = html;
  $('readyInfo').innerHTML = `제한 시간 <b>${st.time}초</b> · 목표 <b>${fmt(st.goal)}점</b>`;
  setState('ready');
}
// 판이 바뀌거나 다시 하면 남아 있던 setTimeout 은 무시 (판 번호로 구분)
let runId = 0;
const timers = [];
function later(fn, ms) { const id = runId; timers.push(setTimeout(() => { if (id === runId) fn(); }, ms)); }
function clearTimers() { runId++; timers.forEach(clearTimeout); timers.length = 0; }

const comboMul = (c) => (c >= 20 ? 2 : c >= 10 ? 1.5 : c >= 5 ? 1.2 : 1);

// 누른 자리에서 가장 가까운, 누를 수 있는 두더지
function pick(x, y) {
  let best = null, bd = 1e9;
  for (const h of G.holes) {
    const m = h.m; if (!m || m.ph === 'down' || m.ph === 'hit' || m.ph === 'ouch' || m.u < 0.35) continue;
    const top = h.y - h.s * 0.95 * m.u - h.s * 0.12, bottom = h.y + h.s * 0.22;
    if (Math.abs(x - h.x) > h.s * 0.6 || y < top || y > bottom) continue;
    const d = Math.abs(x - h.x) + Math.abs(y - (top + bottom) / 2) * 0.5;
    if (d < bd) { bd = d; best = h; }
  }
  return best;
}
function tapAt(x, y) {
  if (G.state !== 'play') return;
  G.fx.push({ kind: 'hammer', x, y, t: 0, life: 0.26 });
  const h = pick(x, y);
  if (!h) { Audio.sfx('miss'); dust(x, y + 10, 4, 0.6); return; } // 빈 구멍·풀밭: 감점 없음, 콤보 그대로
  hitMole(h);
}
function hitMole(h, byItem = false) {
  const m = h.m;
  if (m.type === 'trap') {
    m.ph = 'ouch'; m.t = 0; m.shake = 0.4;
    G.combo = 0;
    if (!GOD()) G.score = Math.max(0, G.score - TRAP_PENALTY);
    Audio.sfx('bad'); buzz(40);
    G.fx.push({ kind: 'text', text: `-${TRAP_PENALTY}`, x: h.x, y: h.y - h.s * 0.9, t: 0, life: 0.9, bad: true });
    G.fx.push({ kind: 'x', x: h.x, y: h.y - h.s * 0.45, s: h.s, t: 0, life: 0.8 });
    return;
  }
  if (m.type === 'tough' && m.hp > 1 && !byItem) {
    m.hp--; m.shake = 0.25; m.t = 0; m.ph = 'stay'; m.stay = Math.max(0.7, m.stay * 0.6);
    Audio.sfx('clank');
    stars(h.x, h.y - h.s * 0.7, 4);
    G.fx.push({ kind: 'text', text: '한 번 더!', x: h.x, y: h.y - h.s * 1.0, t: 0, life: 0.7 });
    return;
  }
  m.ph = 'hit'; m.t = 0; m.shake = 0;
  if (!byItem) G.combo++;
  G.maxCombo = Math.max(G.maxCombo, G.combo);
  G.caught++;
  const pts = Math.round(PTS[m.type] * comboMul(G.combo) * (G.dblT > 0 ? 2 : 1));
  G.score += pts;
  // 코인: 두더지 1마리 = 1코인, 콤보 5번마다 +1 (콤보 보너스 부스트면 +2)
  if (!GOD()) G.coins += 1 + (G.combo > 0 && G.combo % 5 === 0 ? (G.comboX2 ? 2 : 1) : 0);
  Audio.sfx('hit', G.combo);
  stars(h.x, h.y - h.s * 0.45, 7); dust(h.x, h.y, 6, 1);
  G.fx.push({ kind: 'text', text: `+${pts}`, x: h.x, y: h.y - h.s * 0.85, t: 0, life: 0.8, gold: G.dblT > 0 });
  if (G.combo >= 5 && G.combo % 5 === 0) {
    Audio.sfx('combo');
    G.fx.push({ kind: 'text', text: `${G.combo} 콤보! ×${comboMul(G.combo)}`, x: W / 2, y: G.fieldTop + 10, t: 0, life: 1.1, big: true });
  }
}
function stars(x, y, n) {
  for (let i = 0; i < n; i++) {
    const an = -Math.PI / 2 + rnd(-1.3, 1.3), sp = rnd(160, 300);
    G.fx.push({ kind: 'star', x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, r: rnd(12, 22), rot: rnd(0, 6), t: 0, life: rnd(0.45, 0.7) });
  }
}
function dust(x, y, n, k) {
  for (let i = 0; i < n; i++) G.fx.push({ kind: 'dust', x: x + rnd(-30, 30) * k, y: y + rnd(-6, 8), vx: rnd(-70, 70) * k, vy: rnd(-50, -10), r: rnd(10, 20) * k, t: 0, life: rnd(0.4, 0.6) });
}

// ---------- items ----------
// 시간 추가: +10초 / 점수 2배: 10초 동안 / 무지개 망치: 지금 나와 있는 두더지를 한꺼번에 (함정 캐릭터는 그대로)
const itemCount = (id) => (HUB ? HUB.boostCount('mole', id) : G.items[id]);
function spendItem(id) {
  if (HUB) return HUB.useBoost('mole', id);
  if (G.items[id] <= 0) return false;
  G.items[id]--; return true;
}
const ITEM_NAME = { time: '⏱ 시간 추가', double: '⭐ 점수 2배', rainbow: '🌈 무지개 망치' };
function useItem(id) {
  if (G.state !== 'play') return;
  if (itemCount(id) <= 0) { toast(`${ITEM_NAME[id].slice(2)}가 없어요. 아이템샵에서 살 수 있어요`); Audio.sfx('miss'); return; }
  if (id === 'rainbow') {
    const targets = G.holes.filter((h) => h.m && h.m.type !== 'trap' && (h.m.ph === 'up' || h.m.ph === 'stay'));
    if (!targets.length) { toast('두더지가 나왔을 때 써요!'); return; }
    spendItem(id); Audio.sfx('rainbow');
    G.fx.push({ kind: 'rainbow', t: 0, life: 0.6 });
    targets.forEach((h) => hitMole(h, true));
  } else if (id === 'time') {
    spendItem(id); G.time += 10; Audio.sfx('time');
    G.fx.push({ kind: 'text', text: '+10초', x: W / 2, y: H * 0.42, t: 0, life: 1, big: true });
  } else if (id === 'double') {
    spendItem(id); G.dblT += 10; Audio.sfx('double'); renderBuffs();
    G.fx.push({ kind: 'text', text: '점수 2배!', x: W / 2, y: H * 0.42, t: 0, life: 1, big: true, gold: true });
  }
  renderItems();
}

// ---------- end ----------
function starsOf(score) { const st = STAGES[G.si]; return score >= st.s3 ? 3 : score >= st.s2 ? 2 : score >= st.goal ? 1 : 0; }
function endStage() {
  if (G.state !== 'play') return;
  setState('done'); Audio.stopBgm();
  const st = STAGES[G.si];
  let s = starsOf(G.score);
  if (GOD() && !s) s = 1; // 무적: 언제나 클리어
  const ok = s > 0;
  Audio.sfx(ok ? 'clear' : 'fail');
  if (ok) for (let i = 0; i < 50; i++) G.fx.push({ kind: 'confetti', x: Math.random() * W, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 80, vy: 120 + Math.random() * 160, r: Math.random() * 6, c: ['#FFB5C5', '#FFD34D', '#79C89C', '#5CA9E6', '#C9A8FF'][i % 5], t: 0, life: 3 });
  let earn = null, reward = [];
  if (HUB) {
    earn = HUB.record('mole', { stage: G.si, cleared: ok, dist: G.score, coins: G.coins, stars: s });
    reward = ok && !earn.god ? clearReward(s, earn.firstClear) : [];
  } else if (ok) { Save.data.cleared[G.si] = true; Save.store(); }
  G.fx.push({ kind: 'text', text: ok ? '타임 업! 클리어!' : '타임 업!', x: W / 2, y: H * 0.45, t: 0, life: 1.2, big: true, bad: !ok });
  later(() => showResult(ok, s, earn, reward, st), 1200);
}
// 클리어 보상 아이템 (캐릭터 보유 수량에 바로 더해짐)
//  · 처음 깬 판: 시간 추가·점수 2배 중 1개  · 별 3개: 시간 추가 1개  · 월드 마지막 판(N-10) 처음 깨면: 무지개 망치 1개
function clearReward(st, first) {
  const got = [];
  const give = (id) => { HUB.addBoost('mole', id, 1); got.push(id); };
  if (first) give(Math.random() < 0.5 ? 'time' : 'double');
  if (st >= 3) give('time');
  if (first && G.si % PER_WORLD === PER_WORLD - 1) give('rainbow');
  return got;
}
function showResult(ok, st, earn, reward, stage) {
  $('resTitle').textContent = ok ? '스테이지 클리어!' : '아쉬워요!';
  document.querySelector('.panel.result').classList.toggle('fail', !ok);
  $('resStars').innerHTML = [0, 1, 2].map((k) => `<span class="${k < st ? '' : 'off'}">★</span>`).join('');
  $('resScore').textContent = `${fmt(G.score)}점`;
  $('resGoal').textContent = `${fmt(stage.goal)}점`;
  $('resCaught').textContent = `${G.caught}마리`;
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
  for (const f of G.fx) { f.t += dt; if (f.vx != null) { f.x += f.vx * dt; f.y += f.vy * dt; if (f.kind === 'star') f.vy += 700 * dt; if (f.kind === 'dust') { f.vx *= 0.92; } } }
  G.fx = G.fx.filter((f) => f.t < f.life);
  if (G.state === 'pause') return;
  stepHoles(dt);
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
  if (G.state !== 'play') return;
  G.time -= dt;
  if (G.dblT > 0) { G.dblT = Math.max(0, G.dblT - dt); if (!G.dblT) renderBuffs(); }
  if (G.time > 0.6) { G.spawnT -= dt; if (G.spawnT <= 0) { spawn(); G.spawnT = STAGES[G.si].gap * rnd(0.8, 1.2); } }
  if (G.time < 5) { G.tickT -= dt; if (G.tickT <= 0) { G.tickT = 1; Audio.sfx('tick'); } }
  if (G.time <= 0) { G.time = 0; endStage(); }
}

// ---------- render ----------
function drawBg() {
  const skyH = wideLayout() ? Math.max(120, G.fieldTop + 20) : Math.max(250, G.fieldTop + 70);
  const drawn = SKIN_BG[G.skin] == null && G.skin && G.skin !== 'default' && window.Skins && window.Skins.has(G.skin);
  const im = SKIN_BG[G.skin] != null ? BG.skin[SKIN_BG[G.skin]] : BG.sky;
  // 잔디
  const g = ctx.createLinearGradient(0, skyH - 40, 0, H);
  g.addColorStop(0, '#E4EC6E'); g.addColorStop(0.45, '#BCDA52'); g.addColorStop(1, '#93C43E');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 하늘 (아랫부분 울타리가 잔디에 닿게)
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, skyH); ctx.clip();
  if (drawn) window.Skins.draw(ctx, G.skin, W, skyH, 0, 0, G.t);
  else if (ok(im)) {
    const s = Math.max(W / im.naturalWidth, skyH / im.naturalHeight), bw = im.naturalWidth * s, bh = im.naturalHeight * s;
    ctx.drawImage(im, (W - bw) / 2, skyH - bh, bw, bh);
  } else { ctx.fillStyle = '#8CC9F0'; ctx.fillRect(0, 0, W, skyH); }
  ctx.restore();
  const fade = ctx.createLinearGradient(0, skyH - 26, 0, skyH + 4);
  fade.addColorStop(0, 'rgba(228,236,110,0)'); fade.addColorStop(1, 'rgba(228,236,110,1)');
  ctx.fillStyle = fade; ctx.fillRect(0, skyH - 26, W, 30);
  // 잔디 무늬
  ctx.fillStyle = 'rgba(255,255,255,.07)';
  for (let y = skyH + 30, k = 0; y < H; y += 46, k++) { ctx.beginPath(); ctx.ellipse(W / 2, y, W * 0.75, 12, 0, 0, Math.PI * 2); if (k % 2) ctx.fill(); }
  // 맨 아래 꽃밭
  if (ok(BG.flowers)) {
    const fh = wideLayout() ? 46 : 110, fw = Math.max(W, fh * BG.flowers.naturalWidth / BG.flowers.naturalHeight);
    ctx.drawImage(BG.flowers, (W - fw) / 2, H - fh, fw, fh);
  }
}
// 구멍 뒤쪽 (어두운 구멍 + 흙 테두리)
function drawHoleBack(h) {
  const { x, y, s } = h;
  ctx.fillStyle = 'rgba(60,90,20,.25)'; ctx.beginPath(); ctx.ellipse(x, y + s * 0.06, s * 0.54, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9A6534'; ctx.beginPath(); ctx.ellipse(x, y, s * 0.5, s * 0.18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#B97B43'; ctx.beginPath(); ctx.ellipse(x, y - s * 0.015, s * 0.47, s * 0.155, 0, Math.PI, Math.PI * 2); ctx.fill();
  const g = ctx.createRadialGradient(x, y + s * 0.03, 2, x, y, s * 0.4);
  g.addColorStop(0, '#1E120A'); g.addColorStop(1, '#4A2C17');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y + s * 0.01, s * 0.39, s * 0.12, 0, 0, Math.PI * 2); ctx.fill();
}
// 구멍 앞쪽 흙 (두더지 아랫몸을 가림)
function drawHoleFront(h) {
  const { x, y, s } = h;
  ctx.fillStyle = '#A86E3A';
  ctx.beginPath(); ctx.ellipse(x, y + s * 0.01, s * 0.5, s * 0.18, 0, 0, Math.PI); ctx.ellipse(x, y + s * 0.01, s * 0.39, s * 0.12, 0, Math.PI, 0, true); ctx.fill();
  ctx.fillStyle = '#C48A52';
  ctx.beginPath(); ctx.ellipse(x, y + s * 0.02, s * 0.46, s * 0.15, 0, 0.15, Math.PI - 0.15); ctx.ellipse(x, y + s * 0.02, s * 0.4, s * 0.12, 0, Math.PI - 0.2, 0.2, true); ctx.fill();
  // 흙 덩이
  ctx.fillStyle = '#8B5A2B';
  for (const [dx, dy, r] of [[-0.42, 0.1, 0.05], [-0.2, 0.17, 0.045], [0.12, 0.18, 0.05], [0.38, 0.11, 0.045], [0.5, 0.02, 0.035], [-0.52, 0.0, 0.035]]) {
    ctx.beginPath(); ctx.ellipse(x + dx * s, y + dy * s, r * s * 1.3, r * s, 0, 0, Math.PI * 2); ctx.fill();
  }
}
function drawMole(h) {
  const m = h.m; if (!m || m.u <= 0) return;
  const { x, y, s } = h;
  const sh = m.shake > 0 ? Math.sin(m.shake * 70) * s * 0.04 : 0;
  ctx.save();
  ctx.beginPath(); ctx.rect(x - s, y - s * 2, s * 2, s * 2 + s * 0.03); ctx.clip();
  if (m.type === 'trap') {
    const r = s * 0.4, cy = y + r * 1.15 - (r * 2.25) * m.u;
    const f = FACE[m.who] || FACE[myLook], im = m.ph === 'ouch' ? f.sad : f.base;
    ctx.translate(x + sh, cy);
    ctx.fillStyle = RING[m.who.startsWith('eungyeol') ? 'eungyeol' : 'eunyu'];
    ctx.beginPath(); ctx.arc(0, 0, r + s * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r + s * 0.02, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
    if (ok(im)) ctx.drawImage(im, -r * 1.06, -r * 1.06, r * 2.12, r * 2.12); else { ctx.fillStyle = '#FFE3D0'; ctx.fill(); }
  } else {
    const key = m.type === 'tough' && m.hp < 2 ? 'tough2' : m.type;
    const im = SPR[key];
    if (ok(im)) {
      const dw = s * (m.type === 'fast' ? 1.38 : m.type === 'tough' ? 1.3 : 1.4), sw = im.naturalWidth, shh = im.naturalHeight * CUT[key];
      let dh = dw * shh / sw, w2 = dw;
      if (m.ph === 'hit') { const k = Math.min(1, m.t / 0.08); dh *= 1 - 0.18 * k; w2 *= 1 + 0.1 * k; } // 맞으면 납작
      const bottom = y + s * 0.06 + (1 - m.u) * dh;
      ctx.drawImage(im, 0, 0, sw, shh, x - w2 / 2 + sh, bottom - dh, w2, dh);
      // 맞은 두더지: 머리 위 빙글빙글 별
      if (m.ph === 'hit' && ok(SPR.star)) {
        for (let k = 0; k < 3; k++) {
          const a = G.t * 9 + k * 2.1, r = s * 0.06;
          ctx.drawImage(SPR.star, x + Math.cos(a) * s * 0.22 - r, bottom - dh + Math.sin(a) * s * 0.05 - r, r * 2, r * 2);
        }
      }
    }
  }
  ctx.restore();
}
function drawHammer(f) {
  const k = f.t / f.life, a = k < 0.35 ? -1.1 + (k / 0.35) * 1.1 : 0, s = 1;
  ctx.save(); ctx.globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
  ctx.translate(f.x + 46 * s, f.y + 52 * s); ctx.rotate(a);
  ctx.fillStyle = '#B5733A'; ctx.strokeStyle = '#6B3A16'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-7, -64, 14, 70, 6); ctx.fill(); ctx.stroke();
  ctx.translate(-8, -74); ctx.rotate(-0.15);
  ctx.fillStyle = '#E8384D'; ctx.beginPath(); ctx.roundRect(-46, -24, 92, 48, 18); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#C21F37'; ctx.beginPath(); ctx.roundRect(-46, 6, 92, 18, [0, 0, 18, 18]); ctx.fill();
  ctx.fillStyle = '#FFD34D'; starPath(0, -2, 15, 7); ctx.fill();
  ctx.restore();
}
function starPath(x, y, R, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath();
}
function drawFx() {
  for (const f of G.fx) {
    const k = f.t / f.life;
    if (f.kind === 'confetti') { ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 2); ctx.fillStyle = f.c; ctx.translate(f.x, f.y); ctx.rotate(f.t * 6 + f.r); ctx.fillRect(-5, -3, 10, 6); ctx.restore(); continue; }
    if (f.kind === 'star') {
      ctx.save(); ctx.globalAlpha = 1 - k * k; ctx.translate(f.x, f.y); ctx.rotate(f.rot + f.t * 6);
      if (ok(SPR.star)) ctx.drawImage(SPR.star, -f.r, -f.r, f.r * 2, f.r * 2); else { ctx.fillStyle = '#FFD34D'; starPath(0, 0, f.r, f.r / 2); ctx.fill(); }
      ctx.restore(); continue;
    }
    if (f.kind === 'dust') { ctx.globalAlpha = 0.75 * (1 - k); ctx.fillStyle = '#E9D2AE'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.6 + k), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; continue; }
    if (f.kind === 'hammer') { drawHammer(f); continue; }
    if (f.kind === 'x') {
      ctx.save(); ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1; ctx.translate(f.x, f.y);
      const r = f.s * 0.3 * Math.min(1, k * 6); ctx.lineCap = 'round';
      ctx.strokeStyle = '#fff'; ctx.lineWidth = f.s * 0.14; ctx.beginPath(); ctx.moveTo(-r, -r); ctx.lineTo(r, r); ctx.moveTo(r, -r); ctx.lineTo(-r, r); ctx.stroke();
      ctx.strokeStyle = '#E8384D'; ctx.lineWidth = f.s * 0.09; ctx.stroke();
      ctx.restore(); continue;
    }
    if (f.kind === 'rainbow') {
      ctx.save(); ctx.globalAlpha = 0.45 * (1 - k);
      const g = ctx.createLinearGradient(0, 0, W, H);
      ['#FF6B6B', '#FFB84D', '#FFE45C', '#7BD87B', '#5CA9E6', '#B28DFF'].forEach((c, i) => g.addColorStop(i / 5, c));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore(); continue;
    }
    if (f.kind === 'text') {
      ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
      ctx.font = `${f.big ? 46 : 32}px Jua, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 7; ctx.strokeStyle = f.bad ? '#7A0E1E' : '#7A3E00'; ctx.strokeText(f.text, f.x, f.y - k * 34);
      ctx.fillStyle = f.bad ? '#FF6B7E' : f.gold ? '#FFF27A' : '#FFE07A'; ctx.fillText(f.text, f.x, f.y - k * 34);
      ctx.globalAlpha = 1;
    }
  }
}
function render() {
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  drawBg();
  // 뒷줄부터 그려서 앞줄 두더지가 위로 오게
  for (const h of G.holes) { drawHoleBack(h); drawMole(h); drawHoleFront(h); }
  drawFx();
}

// ---------- HUD ----------
let lastKey = '';
function updateHud() {
  const st = STAGES[G.si];
  const key = `${Math.ceil(G.time)}|${G.score}|${G.coins}|${G.combo}|${Math.ceil(G.dblT)}`;
  if (key === lastKey) return;
  lastKey = key;
  $('hudTime').textContent = `${Math.max(0, Math.ceil(G.time))}초`;
  $('hudScore').textContent = fmt(G.score); $('hudCoin').textContent = G.coins;
  $('hudCombo').textContent = G.combo;
  $('comboPill').classList.toggle('hot', G.combo >= 5);
  $('timerPill').classList.toggle('warn', G.time < 5 && G.state === 'play');
  // 별 막대: 3별 점수까지 채움. 별 자리 = 목표(1별)·2별·3별 점수
  $('starFill').style.width = (clamp(G.score / st.s3, 0, 1) * 100) + '%';
  const s1 = document.querySelector('.starbar .s1'), s2 = document.querySelector('.starbar .s2'), s3 = document.querySelector('.starbar .s3');
  s1.style.left = (st.goal / st.s3 * 100) + '%'; s2.style.left = (st.s2 / st.s3 * 100) + '%';
  s1.classList.toggle('off', G.score < st.goal); s2.classList.toggle('off', G.score < st.s2); s3.classList.toggle('off', G.score < st.s3);
  if (G.dblT > 0) { const b = $('buffDbl'); if (b) b.textContent = `⭐ 점수 2배 ${Math.ceil(G.dblT)}초`; }
}
function renderItems() {
  for (const id of ['time', 'double', 'rainbow']) {
    const n = itemCount(id), b = $('it_' + id);
    b.querySelector('i').textContent = n; b.classList.toggle('empty', n <= 0);
  }
}
function renderBuffs() {
  const el = $('buffs'); el.innerHTML = '';
  if (G.comboX2) { const d = document.createElement('div'); d.className = 'buff'; d.textContent = '🌈 콤보 2배'; el.appendChild(d); }
  if (G.dblT > 0) { const d = document.createElement('div'); d.className = 'buff dbl'; d.id = 'buffDbl'; d.textContent = `⭐ 점수 2배 ${Math.ceil(G.dblT)}초`; el.appendChild(d); }
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
  $('hud').classList.toggle('hidden', !['count', 'play', 'pause', 'done'].includes(s));
  if (s !== 'count' && s !== 'play' && s !== 'pause') $('memo').classList.add('hidden');
  lastKey = '';
}
function pauseGame() { if (G.state === 'play' || G.state === 'count') { G.pausedFrom = G.state; setState('pause'); Audio.stopBgm(); } }
function resumeGame() { if (G.state === 'pause') { setState(G.pausedFrom); Audio.startBgm(); last = performance.now(); } }
function goMap() { clearTimers(); Audio.stopBgm(); location.href = HUB ? '../index.html#map-mole' : '../index.html'; }

// ---------- input ----------
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
cv.addEventListener('pointerdown', (e) => {
  e.preventDefault(); Audio.unlock();
  const r = cv.getBoundingClientRect();
  tapAt((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H);
});
window.addEventListener('keydown', (e) => {
  Audio.unlock();
  // 키보드(PC): 숫자 1~9 = 구멍 (7 8 9 / 4 5 6 / 1 2 3 숫자 패드 배치)
  const n = /^(Digit|Numpad)([1-9])$/.exec(e.code);
  if (n && G.state === 'play') { const k = +n[2], h = G.holes[(2 - Math.floor((k - 1) / 3)) * 3 + (k - 1) % 3]; tapAt(h.x, h.y - h.s * 0.3); return; }
  if (e.code === 'KeyT') useItem('time'); else if (e.code === 'KeyD') useItem('double'); else if (e.code === 'KeyR') useItem('rainbow');
  else if (e.code === 'Escape' || e.code === 'KeyP') { if (G.state === 'play' || G.state === 'count') pauseGame(); else if (G.state === 'pause') resumeGame(); }
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
for (const id of ['time', 'double', 'rainbow']) $('it_' + id).addEventListener('pointerdown', (e) => { e.preventDefault(); Audio.unlock(); useItem(id); });
G.items = { time: 1, double: 1, rainbow: 1 }; // 단독 실행일 때 기본 수량

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
  layoutHoles();
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
{
  const q = new URLSearchParams(location.search);
  let si = parseInt(q.get('stage'), 10);
  if (!(si >= 0 && si < STAGES.length) || !unlocked(si)) si = nextStage();
  showReady(si);
  if (q.get('go') === '1') startStage(si); // 인트로 START: 준비 창 없이 바로
}
requestAnimationFrame(frame);

// debug/test hook
window.__mole = { G, step, startStage, showReady, STAGES, useItem, tapAt, hitMole, spawn, showResult, endStage };
