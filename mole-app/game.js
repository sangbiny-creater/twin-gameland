'use strict';
// [두더지 앱 전용] mole/game.js 를 복사해서 앱(mole-app/)에 맞게 고친 것 — 판(스테이지) 없이 끝없이 이어지는 방식
//  · 구멍 9개에서 튀어나오는 두더지를 톡톡 치기. 하트 3개, 두더지를 놓치거나 함정 캐릭터(은유·은결)를 누르면 하트 -1, 다 없어지면 끝
//  · 일반 두더지(노란 안전모) +100 / 빠른 두더지(빨간 모자) +200 / 2대 두더지(빨간 헬멧, 두 번) +300, 콤보 5번 ×1.2 · 10번 ×1.5 · 20번 ×2
//  · 하트 두더지: 15~25초쯤 처음 한 번, 그 뒤로 가끔. 잡으면 하트 +1 (꽉 차 있으면 +300점)
//  · 시간이 갈수록(게임한 시간 기준) 두더지가 빨리 숨고, 더 자주·더 많이 나옴 — 20초마다 레벨이 하나씩 오름 (diff())
//  · 저장 키 'mole_app_v1' (사이트의 twin_gameland_v1·mole_v1 은 건드리지 않음)
//  · 화면 맨 위 광고 자리(#adBar) 아래 #stage 안에서만 그림 (세로 전용). 시작 창·결과 버튼은 app.js (window.App)

let W = 540, H = 960;
const PTS = { normal: 100, fast: 200, tough: 300 };
const START_HEARTS = 3, MAX_HEARTS = 3;
const HEART_GAP = 25;       // 하트 두더지는 앞 하트 두더지 뒤로 최소 25초 지나야 다시 나옴
const HEART_CHANCE = 0.1;   // 그 뒤 새 두더지가 나올 때마다 이 확률로 하트 두더지
const HEART_STAY = 0.6;     // 하트 두더지가 다 올라와 머무는 시간 (초) — 아주 빨리 숨음
const HEART_FULL_PTS = 300; // 하트가 꽉 찼을 때 하트 두더지를 잡으면 받는 점수
const LEVEL_SEC = 20;       // 이 시간마다 레벨 +1 ("빨라져요!")
const ASSET_V = '202611271713';
const asset = (p) => `assets/${p}.webp?v=${ASSET_V}`;

// ---------- 난이도: 게임한 시간(초) pt 로 정함 — 갈수록 절대 쉬워지지 않음 ----------
//  stay 일반 두더지가 머무는 시간 2.1초 → 0.55초 쪽으로 / gap 새 두더지 간격 1.3초 → 0.42초 쪽으로
//  maxOn 한꺼번에 나와 있는 최대 수 1 → 4 / fast·tough·trap 나오는 비율
function diff(pt) {
  return {
    stay: 0.55 + 1.55 * Math.exp(-pt / 75),
    gap: 0.42 + 0.88 * Math.exp(-pt / 85),
    maxOn: pt < 12 ? 1 : pt < 40 ? 2 : pt < 100 ? 3 : 4,
    fast: pt < 8 ? 0 : Math.min(0.32, 0.12 + pt / 500),
    tough: pt < 20 ? 0 : Math.min(0.25, 0.08 + pt / 700),
    trap: Math.min(0.22, 0.07 + pt / 800),
    rise: 0.6 + 0.4 * Math.exp(-pt / 150), // 올라오고 숨는 움직임도 조금씩 빨라짐
  };
}
const levelOf = (pt) => 1 + Math.floor(pt / LEVEL_SEC);

// ---------- save ----------
const Save = {
  // best: 최고 점수 · auth·agreed·name·pid… : app.js (캐릭터 고르기 없음)
  data: { best: 0, plays: 0, totalCaught: 0, sound: true, auth: null, agreed: null, name: null, nameKey: null, nameReg: false },
  load() { try { Object.assign(this.data, JSON.parse(localStorage.getItem('mole_app_v1') || '{}')); } catch (e) { /* private mode */ } },
  store() { try { localStorage.setItem('mole_app_v1', JSON.stringify(this.data)); } catch (e) { /* ignore */ } },
};
Save.load();

// ---------- utils ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const $ = (id) => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const fmt = (n) => Math.round(n).toLocaleString('ko-KR');

// ---------- images ----------
const img = (src) => { const im = new Image(); im.src = src; return im; };
const ok = (im) => im && im.complete && im.naturalWidth > 0;
const SPR = {
  normal: img(asset('sprites/normal')), normal_hit: img(asset('sprites/normal_hit')),
  fast: img(asset('sprites/fast')), fast_hit: img(asset('sprites/fast_hit')),
  tough: img(asset('sprites/tough')), tough_crack: img(asset('sprites/tough_crack')), tough_hit: img(asset('sprites/tough_hit')),
  heart: img(asset('sprites/heart')), heart_hit: img(asset('sprites/heart_hit')),
  holeBack: img(asset('sprites/hole_back')), holeFront: img(asset('sprites/hole_front')),
  hammer: img(asset('sprites/hammer')), dust: img(asset('sprites/dust')),
  heartIcon: img(`lib/ui/heart.webp?v=${ASSET_V}`),
};
// 그림 치수 (tools/mole_assets.py 가 자른 틀 기준 비율): 두더지 456x432 몸 아래 끝 95.6% · 구멍 401x164 · 망치 284x294
const MOLE_AR = 432 / 456, MOLE_FOOT = 0.956;
const HOLE = { ar: 164 / 401, cx: 0.503, cy: 0.475, ry: 0.267 };
const HAMMER = { ar: 294 / 284, head: [0.25, 0.24], end: [0.93, 0.94] };
const BG = img(asset('bg/port')), BG_GRASS = 0.38; // 배경 그림에서 울타리 아래 잔디가 시작하는 높이
// 함정 캐릭터: 구멍에서 나온 은유·은결 그림 (두더지와 같은 틀). 캐릭터 고르기가 없어서 처음부터 둘 다
// 함정 캐릭터: 어른 은유·은결 + 어린이 은유·은결(예전 사이트 v0.3 그림) 넷 중 하나가 무작위로 나와요
const TRAP_WHO = ['eunyu', 'eungyeol', 'eunyu_kid', 'eungyeol_kid'];
const TRAP_SPR = {};
for (const lk of TRAP_WHO) TRAP_SPR[lk] = { base: img(asset(`chars/${lk}`)), hit: img(asset(`chars/${lk}_hit`)) };

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
  sfx(n, k = 0) {
    switch (n) {
      case 'pop': this.tone(380 + Math.random() * 120, 0.08, 'sine', 0.12, 260); break;
      case 'hit': this.tone(180, 0.09, 'square', 0.18, -90); [880, 1175].forEach((f, i) => this.tone(f * (1 + Math.min(k, 20) * 0.02), 0.09, 'triangle', 0.25, 0, 0.03 + i * 0.05)); break;
      case 'clank': this.tone(1400, 0.12, 'square', 0.12, -600); this.tone(2100, 0.08, 'triangle', 0.12, -900, 0.02); break;
      case 'miss': this.tone(240, 0.06, 'triangle', 0.12, -60); break;
      case 'bad': this.tone(330, 0.16, 'square', 0.14, -150); this.tone(220, 0.22, 'square', 0.12, -80, 0.12); break;
      case 'combo': [1046, 1318, 1568].forEach((f, i) => this.tone(f, 0.1, 'triangle', 0.22, 0, i * 0.05)); break;
      case 'level': [660, 880, 1320, 1760].forEach((f, i) => this.tone(f, 0.1, 'triangle', 0.22, 0, i * 0.05)); break;
      case 'count': this.tone(880, 0.08, 'sine', 0.25); break;
      case 'go': [660, 990].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.3, 0, i * 0.08)); break;
      case 'best': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.22, 'square', 0.16, 0, i * 0.11)); break;
      case 'fail': [523, 440, 349, 262].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.3, 0, i * 0.17)); break;
      case 'ui': this.tone(700, 0.06, 'triangle', 0.25); break;
      case 'heartPop': [1320, 1760].forEach((f, i) => this.tone(f, 0.07, 'sine', 0.2, 0, i * 0.05)); break;
      case 'life': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.28, 0, i * 0.06)); break;
    }
  },
  // 통통 튀는 행진곡 (레벨이 오르면 조금씩 빨라짐)
  mel: [67, 0, 72, 0, 76, 74, 72, 0, 69, 0, 72, 0, 74, 0, 0, 0, 67, 0, 71, 0, 74, 72, 71, 0, 67, 0, 69, 71, 72, 0, 0, 0],
  bass: [48, 43, 45, 41, 43, 47, 48, 43],
  bpm: 132,
  startBgm() {
    if (this.bgmOn || !this.ctx) { this.bgmOn = true; return; }
    this.bgmOn = true; this.next = this.ctx.currentTime + 0.1; clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (!this.ctx || !this.bgmOn) return;
      const sd = 60 / this.bpm / 2, mf = (n) => 440 * Math.pow(2, (n - 69) / 12);
      if (this.next < this.ctx.currentTime - 0.1) this.next = this.ctx.currentTime + 0.05; // 오래 멈췄다 돌아오면 밀린 음은 건너뜀
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
// 상태: home(시작 창, app.js) → count(3·2·1) → play → done(끝 연출) → result / pause
const G = {
  state: 'home', holes: [], fx: [], t: 0, pt: 0, countT: 0, level: 1,
  score: 0, combo: 0, maxCombo: 0, caught: 0, spawnT: 0,
  hearts: START_HEARTS, maxH: MAX_HEARTS, heartT: 0, dead: false, contUsed: false, pausedFrom: 'play',
};

// ---------- holes ----------
// 구멍: { x, y(구멍 가운데), s(구멍 크기), m(지금 나와 있는 두더지), cool(다시 나오기까지 쉬는 시간) }
// 두더지: { type: normal|fast|tough|trap|heart, who(함정 캐릭터), ph: up|stay|down|hit|ouch, t, stay, hp, u(올라온 정도 0~1), rise }
function layoutHoles() {
  const sb = parseFloat(getComputedStyle(root).getPropertyValue('--safe-b')) || 0;
  const top = 150, a = { x: 10, y: top, w: W - 20, h: H - top - 50 - sb };
  const cw = a.w / 3, rh = a.h / 3, s = Math.min(cw * 0.86, rh * 0.84, 200);
  if (!G.holes.length) for (let k = 0; k < 9; k++) G.holes.push({ m: null, cool: 0 });
  G.holes.forEach((h, k) => {
    const c = k % 3, r = Math.floor(k / 3);
    h.x = a.x + cw * (c + 0.5); h.y = a.y + rh * r + rh * 0.5 + s * 0.3; h.s = s;
  });
  G.fieldTop = a.y;
}

function spawn() {
  const st = diff(G.pt);
  const live = G.holes.filter((h) => h.m && h.m.type !== 'trap' && h.m.type !== 'heart' && h.m.ph !== 'hit').length;
  const traps = G.holes.filter((h) => h.m && h.m.type === 'trap').length;
  const free = G.holes.filter((h) => !h.m && h.cool <= 0);
  if (!free.length) return;
  // 하트 두더지: 가끔, 다른 두더지와 따로 (한꺼번에 나오는 수에 안 셈)
  if ((!G.heartSeen && G.pt >= G.firstHeartAt) || (G.heartSeen && G.pt - G.heartT >= HEART_GAP && Math.random() < HEART_CHANCE)) {
    G.heartSeen = true; G.heartT = G.pt;
    const hh = free[Math.floor(Math.random() * free.length)];
    hh.m = { type: 'heart', who: null, ph: 'up', t: 0, stay: HEART_STAY, hp: 1, u: 0, shake: 0, rise: st.rise };
    Audio.sfx('heartPop');
    return;
  }
  const isTrap = traps === 0 && Math.random() < st.trap * 1.4;
  if (!isTrap && live >= st.maxOn) return;
  const h = free[Math.floor(Math.random() * free.length)];
  let type = 'normal';
  if (isTrap) type = 'trap';
  else { const r = Math.random(); if (r < st.fast) type = 'fast'; else if (r < st.fast + st.tough) type = 'tough'; }
  const stay = { normal: st.stay, fast: st.stay * 0.62, tough: st.stay * 1.4, trap: st.stay * 1.25 }[type];
  h.m = { type, who: type === 'trap' ? TRAP_WHO[Math.floor(Math.random() * TRAP_WHO.length)] : null, ph: 'up', t: 0, stay, hp: type === 'tough' ? 2 : 1, u: 0, shake: 0, rise: st.rise };
  Audio.sfx('pop');
}
const RISE = { normal: 0.16, fast: 0.1, tough: 0.2, trap: 0.18, heart: 0.08 };
// 구멍 하나의 그림 크기: hw·hh 구멍, dw·dh 두더지, clipY 두더지가 보이는 아래 끝, foot 다 올라왔을 때 몸 아래 끝
function geom(h) {
  const hw = h.s * 1.2, hh = hw * HOLE.ar, ryIn = HOLE.ry * hh, dw = hw * 0.82, dh = dw * MOLE_AR;
  return { hw, hh, dw, dh, clipY: h.y + ryIn * 0.7, foot: h.y + ryIn * 0.85 };
}

function stepHoles(dt) {
  const playing = G.state === 'play';
  for (const h of G.holes) {
    h.cool -= dt;
    const m = h.m; if (!m) continue;
    m.t += dt; m.shake = Math.max(0, m.shake - dt);
    const rk = m.rise || 1;
    if (m.ph === 'up') { m.u = Math.min(1, m.t / (RISE[m.type] * rk)); if (m.u >= 1) { m.ph = 'stay'; m.t = 0; } }
    else if (m.ph === 'stay') {
      if (m.t >= m.stay || !playing) {
        m.ph = 'down'; m.t = 0;
        // 두더지를 놓치면 콤보 0·하트 -1 (함정 캐릭터·하트 두더지는 놓쳐도 괜찮음)
        if (playing && m.type !== 'trap' && m.type !== 'heart') { G.combo = 0; loseHeart(h, '놓쳤어요!'); }
      }
    }
    else if (m.ph === 'down') { m.u = Math.max(0, 1 - m.t / (0.16 * rk)); if (m.u <= 0) { h.m = null; h.cool = 0.25 * rk; } }
    else if (m.ph === 'hit') { if (m.t > 0.14) m.u = Math.max(0, 1 - (m.t - 0.14) / 0.2); if (m.u <= 0) { h.m = null; h.cool = 0.3 * rk; } }
    else if (m.ph === 'ouch') { if (m.t > 0.7) m.u = Math.max(0, 1 - (m.t - 0.7) / 0.18); if (m.u <= 0) { h.m = null; h.cool = 0.4; } }
  }
}

// ---------- run ----------
// 판이 바뀌거나 다시 하면 남아 있던 setTimeout 은 무시
let runId = 0;
const timers = [];
function later(fn, ms) { const id = runId; timers.push(setTimeout(() => { if (id === runId) fn(); }, ms)); }
function clearTimers() { runId++; timers.forEach(clearTimeout); timers.length = 0; }

function resetRun() {
  clearTimers();
  G.score = 0; G.combo = 0; G.maxCombo = 0; G.caught = 0; G.contUsed = false;
  G.fx = []; G.pt = 0; G.level = 1; G.spawnT = 0.3;
  G.hearts = START_HEARTS; G.maxH = MAX_HEARTS; G.heartT = 0; G.dead = false;
  G.heartSeen = false; G.firstHeartAt = rnd(15, 25);
  for (const h of G.holes) { h.m = null; h.cool = 0; }
  Audio.bpm = 132;
  renderHearts(); lastKey = '';
}
function startRun() {
  resetRun();
  $('hudBest').textContent = fmt(Save.data.best || 0);
  G.countT = 3; setState('count'); Audio.startBgm();
}
const comboMul = (c) => (c >= 20 ? 2 : c >= 10 ? 1.5 : c >= 5 ? 1.2 : 1);

// 누른 자리에서 가장 가까운, 누를 수 있는 두더지
function pick(x, y) {
  let best = null, bd = 1e9;
  for (const h of G.holes) {
    const m = h.m; if (!m || m.ph === 'down' || m.ph === 'hit' || m.ph === 'ouch' || m.u < 0.35) continue;
    const g = geom(h), top = g.clipY - g.dh * 0.9 * m.u - h.s * 0.08, bottom = h.y + g.hh * 0.5;
    if (Math.abs(x - h.x) > g.dw * 0.55 || y < top || y > bottom) continue;
    const d = Math.abs(x - h.x) + Math.abs(y - (top + bottom) / 2) * 0.5;
    if (d < bd) { bd = d; best = h; }
  }
  return best;
}
function tapAt(x, y) {
  if (G.state !== 'play') return;
  G.fx.push({ kind: 'hammer', x, y, t: 0, life: 0.26 });
  const h = pick(x, y);
  if (!h) { Audio.sfx('miss'); dust(x, y + 10, 0.55); return; } // 빈 구멍·풀밭: 감점 없음, 콤보 그대로
  hitMole(h);
}
// 하트 -1: 다 없어지면 끝
function loseHeart(h, why) {
  if (G.state !== 'play') return;
  G.hearts = Math.max(0, G.hearts - 1); renderHearts(); buzz(40);
  G.fx.push({ kind: 'heartLost', x: h.x, y: h.y - h.s * 0.7, t: 0, life: 0.8 });
  G.fx.push({ kind: 'text', text: why, x: h.x, y: h.y - h.s * 1.05, t: 0, life: 0.9, bad: true });
  if (G.hearts <= 0) { G.dead = true; endRun(); }
}
function hitMole(h) {
  const m = h.m;
  if (m.type === 'trap') {
    m.ph = 'ouch'; m.t = 0; m.shake = 0.4;
    G.combo = 0;
    Audio.sfx('bad');
    G.fx.push({ kind: 'x', x: h.x, y: h.y - h.s * 0.45, s: h.s, t: 0, life: 0.8 });
    loseHeart(h, '아야!');
    return;
  }
  if (m.type === 'heart') {
    m.ph = 'hit'; m.t = 0;
    stars(h.x, h.y - h.s * 0.45, 6);
    if (G.hearts < G.maxH) {
      G.hearts++; renderHearts(true); Audio.sfx('life');
      G.fx.push({ kind: 'heartFly', x: h.x, y: h.y - h.s * 0.6, t: 0, life: 0.7 });
      G.fx.push({ kind: 'text', text: '하트 +1', x: h.x, y: h.y - h.s * 0.95, t: 0, life: 0.9, gold: true });
    } else {
      G.score += HEART_FULL_PTS; Audio.sfx('hit', G.combo);
      G.fx.push({ kind: 'text', text: `+${HEART_FULL_PTS}`, x: h.x, y: h.y - h.s * 0.85, t: 0, life: 0.8, gold: true });
    }
    return;
  }
  if (m.type === 'tough' && m.hp > 1) {
    m.hp--; m.shake = 0.25; m.t = 0; m.ph = 'stay'; m.stay = Math.max(0.5, m.stay * 0.6);
    Audio.sfx('clank');
    stars(h.x, h.y - h.s * 0.7, 4);
    G.fx.push({ kind: 'text', text: '한 번 더!', x: h.x, y: h.y - h.s * 1.0, t: 0, life: 0.7 });
    return;
  }
  m.ph = 'hit'; m.t = 0; m.shake = 0;
  G.combo++;
  G.maxCombo = Math.max(G.maxCombo, G.combo);
  G.caught++;
  const pts = Math.round(PTS[m.type] * comboMul(G.combo));
  G.score += pts;
  Audio.sfx('hit', G.combo);
  stars(h.x, h.y - h.s * 0.45, 7); dust(h.x, h.y - h.s * 0.05, 1.1);
  G.fx.push({ kind: 'text', text: `+${pts}`, x: h.x, y: h.y - h.s * 0.85, t: 0, life: 0.8 });
  if (G.combo >= 5 && G.combo % 5 === 0) {
    Audio.sfx('combo');
    G.fx.push({ kind: 'text', text: `${G.combo} 콤보! ×${comboMul(G.combo)}`, x: W / 2, y: G.fieldTop + 10, t: 0, life: 1.1, big: true });
  }
}
function stars(x, y, n) {
  for (let i = 0; i < n; i++) {
    const an = -Math.PI / 2 + rnd(-1.3, 1.3), sp = rnd(160, 300);
    G.fx.push({ kind: 'star', x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, r: rnd(10, 18), rot: rnd(0, 6), t: 0, life: rnd(0.45, 0.7) });
  }
}
// 흙먼지: 그림 한 덩이가 부풀며 사라짐 (k = 크기)
function dust(x, y, k) { G.fx.push({ kind: 'dust', x, y, w: 150 * k, rot: rnd(-0.2, 0.2), flip: Math.random() < 0.5, t: 0, life: 0.5 }); }

// ---------- end ----------
function endRun() {
  if (G.state !== 'play') return;
  setState('done'); Audio.stopBgm(); Audio.sfx('fail');
  G.fx.push({ kind: 'text', text: '하트가 없어요!', x: W / 2, y: H * 0.45, t: 0, life: 1.2, big: true, bad: true });
  later(showResult, 1200);
}
function showResult() {
  const sc = G.score;
  const isBest = sc > (Save.data.best || 0) && sc > 0;
  if (isBest) Save.data.best = sc;
  Save.data.totalCaught = (Save.data.totalCaught || 0) + G.caught - (G.caughtBase || 0); // 이어하기 전에 잡은 것은 이미 더함
  G.caughtBase = G.caught;
  Save.store();
  $('resScore').textContent = fmt(sc); $('resCaught').textContent = fmt(G.caught); $('resCombo').textContent = G.maxCombo;
  $('resLevel').textContent = G.level;
  $('resBestVal').textContent = fmt(Save.data.best || 0);
  $('resBest').classList.toggle('hidden', !isBest);
  if (isBest) Audio.sfx('best');
  setState('result');
  if (window.App) App.onResult({ score: sc, isBest, caught: G.caught, combo: G.maxCombo, level: G.level, sec: Math.round(G.pt), canContinue: !G.contUsed });
}

// ---------- update ----------
function step(dt) {
  G.t += dt;
  for (const f of G.fx) { f.t += dt; if (f.vx != null) { f.x += f.vx * dt; f.y += f.vy * dt; if (f.kind === 'star') f.vy += 700 * dt; } }
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
  G.pt += dt;
  const lv = levelOf(G.pt);
  if (lv > G.level) { // 레벨 업: 빨라져요!
    G.level = lv; Audio.sfx('level'); Audio.bpm = Math.min(176, 132 + (lv - 1) * 4);
    G.fx.push({ kind: 'text', text: `빨라져요! 레벨 ${lv}`, x: W / 2, y: H * 0.36, t: 0, life: 1.4, big: true, gold: true });
    const el = $('hudLevel'); el.classList.remove('up'); void el.offsetWidth; el.classList.add('up');
  }
  G.spawnT -= dt; if (G.spawnT <= 0) { spawn(); G.spawnT = diff(G.pt).gap * rnd(0.8, 1.2); }
}

// ---------- render ----------
function drawBg() {
  // 구멍 없는 초원 그림: 울타리 아래 잔디가 맨 윗줄 구멍 바로 위에 오게 놓음 (위쪽 하늘은 화면 모양에 따라 잘림)
  const grassY = G.fieldTop + 10;
  if (ok(BG)) {
    const sc = Math.max(W / BG.naturalWidth, (H - grassY) / ((1 - BG_GRASS) * BG.naturalHeight), H / BG.naturalHeight);
    const bw = BG.naturalWidth * sc, bh = BG.naturalHeight * sc, top = Math.min(0, grassY - BG_GRASS * bh);
    ctx.drawImage(BG, (W - bw) / 2, top, bw, bh);
  } else { ctx.fillStyle = '#BCDA52'; ctx.fillRect(0, 0, W, H); }
}
function drawHole(h, front) {
  const g = geom(h), im = front ? SPR.holeFront : SPR.holeBack;
  if (ok(im)) ctx.drawImage(im, h.x - HOLE.cx * g.hw, h.y - HOLE.cy * g.hh, g.hw, g.hh);
}
// 두더지 그림: 상태에 따라 (맞음·헬멧 깨짐)
function moleImg(m) {
  if (m.type === 'heart') return SPR[m.ph === 'hit' ? 'heart_hit' : 'heart'];
  if (m.type === 'tough') return SPR[m.ph === 'hit' ? 'tough_hit' : m.hp < 2 ? 'tough_crack' : 'tough'];
  return SPR[m.ph === 'hit' ? m.type + '_hit' : m.type];
}
function drawMole(h) {
  const m = h.m; if (!m || m.u <= 0) return;
  const { x, s } = h, g = geom(h);
  const sh = m.shake > 0 ? Math.sin(m.shake * 70) * s * 0.04 : 0;
  ctx.save();
  ctx.beginPath(); ctx.rect(x - g.hw, g.clipY - s * 3, g.hw * 2, s * 3); ctx.clip();
  if (m.type === 'trap') {
    const im = TRAP_SPR[m.who][m.ph === 'ouch' ? 'hit' : 'base'];
    if (ok(im)) { // 기본 그림 456x432
      const dw = g.dw * im.naturalWidth / 456, dh = g.dh * im.naturalHeight / 432;
      ctx.drawImage(im, x - dw / 2 + sh, g.foot + (1 - m.u) * g.dh * 0.95 - g.dh * MOLE_FOOT - (dh - g.dh), dw, dh);
    }
  } else {
    const im = moleImg(m);
    if (ok(im)) {
      let dw = g.dw, dh = g.dh;
      if (m.ph === 'hit') { const k = Math.min(1, m.t / 0.08); dh *= 1 - 0.12 * k; dw *= 1 + 0.06 * k; } // 맞으면 살짝 납작
      const foot = g.foot + (1 - m.u) * dh * 0.95;
      ctx.drawImage(im, x - dw / 2 + sh, foot - dh * MOLE_FOOT, dw, dh);
    }
  }
  ctx.restore();
}
// 누른 자리 뿅망치: 손잡이 끝을 축으로 들었다가 내리침
function drawHammer(f) {
  if (!ok(SPR.hammer)) return;
  const k = f.t / f.life, a = k < 0.35 ? 0.7 * (1 - k / 0.35) : 0;
  const w = 118, hgt = w * HAMMER.ar;
  const px = (HAMMER.end[0] - HAMMER.head[0]) * w, py = (HAMMER.end[1] - HAMMER.head[1]) * hgt;
  ctx.save(); ctx.globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
  ctx.translate(f.x + px, f.y + py); ctx.rotate(a);
  ctx.drawImage(SPR.hammer, -HAMMER.end[0] * w, -HAMMER.end[1] * hgt, w, hgt);
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
    if (f.kind === 'star') {
      ctx.save(); ctx.globalAlpha = 1 - k * k; ctx.translate(f.x, f.y); ctx.rotate(f.rot + f.t * 6);
      ctx.fillStyle = '#FFD34D'; ctx.strokeStyle = '#E39A12'; ctx.lineWidth = 2; starPath(0, 0, f.r, f.r / 2); ctx.fill(); ctx.stroke();
      ctx.restore(); continue;
    }
    if (f.kind === 'dust') {
      if (!ok(SPR.dust)) continue;
      const w = f.w * (0.6 + 0.6 * k), hh = w * SPR.dust.naturalHeight / SPR.dust.naturalWidth;
      ctx.save(); ctx.globalAlpha = 0.9 * (1 - k * k); ctx.translate(f.x, f.y - k * 14); ctx.rotate(f.rot); if (f.flip) ctx.scale(-1, 1);
      ctx.drawImage(SPR.dust, -w / 2, -hh * 0.7, w, hh); ctx.restore(); continue;
    }
    if (f.kind === 'hammer') { drawHammer(f); continue; }
    if ((f.kind === 'heartLost' || f.kind === 'heartFly') && ok(SPR.heartIcon)) {
      // 잃은 하트: 커지며 흐려짐 / 얻은 하트: 위로 날아가며 사라짐
      const lost = f.kind === 'heartLost', w = (lost ? 44 + 30 * k : 50 - 10 * k), hh = w * SPR.heartIcon.naturalHeight / SPR.heartIcon.naturalWidth;
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.translate(f.x, f.y - (lost ? 0 : k * 120));
      if (lost) ctx.filter = 'grayscale(1)';
      ctx.drawImage(SPR.heartIcon, -w / 2, -hh / 2, w, hh); ctx.restore(); continue;
    }
    if (f.kind === 'x') {
      ctx.save(); ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1; ctx.translate(f.x, f.y);
      const r = f.s * 0.3 * Math.min(1, k * 6); ctx.lineCap = 'round';
      ctx.strokeStyle = '#fff'; ctx.lineWidth = f.s * 0.14; ctx.beginPath(); ctx.moveTo(-r, -r); ctx.lineTo(r, r); ctx.moveTo(r, -r); ctx.lineTo(-r, r); ctx.stroke();
      ctx.strokeStyle = '#E8384D'; ctx.lineWidth = f.s * 0.09; ctx.stroke();
      ctx.restore(); continue;
    }
    if (f.kind === 'text') {
      ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
      ctx.font = `${f.big ? 46 : 32}px Jua, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // 긴 글(영어)은 화면 폭 안에 들어가게 줄임
      const tw = ctx.measureText(f.text).width, sx = Math.min(1, (W - 30) / Math.max(1, tw));
      ctx.save(); ctx.translate(f.x, f.y - k * 34); ctx.scale(sx, sx);
      ctx.lineWidth = 7; ctx.strokeStyle = f.bad ? '#7A0E1E' : '#7A3E00'; ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.bad ? '#FF6B7E' : f.gold ? '#FFF27A' : '#FFE07A'; ctx.fillText(f.text, 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }
}
function render() {
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  drawBg();
  // 뒷줄부터 그려서 앞줄 두더지가 위로 오게
  for (const h of G.holes) { drawHole(h, false); drawMole(h); drawHole(h, true); }
  drawFx();
}

// ---------- HUD ----------
let lastKey = '';
function updateHud() {
  const key = `${G.score}|${G.combo}|${G.level}`;
  if (key === lastKey) return;
  lastKey = key;
  $('hudScore').textContent = fmt(G.score);
  $('hudCombo').textContent = G.combo;
  $('comboPill').classList.toggle('hot', G.combo >= 5);
  $('hudLevel').textContent = G.level;
  const b = Math.max(Save.data.best || 0, G.score); $('hudBest').textContent = fmt(b);
}
// 하트 칸 (모든 게임 같은 그림 heart·heart_empty)
function renderHearts(pop) {
  const el = $('hudHearts'); if (!el) return;
  el.innerHTML = Array.from({ length: G.maxH || MAX_HEARTS }, (_, k) => `<i class="heart${k < G.hearts ? '' : ' empty'}${pop && k === G.hearts - 1 ? ' pop' : ''}"></i>`).join('');
}

// ---------- screens ----------
function setState(s) {
  G.state = s;
  $('pause').classList.toggle('hidden', s !== 'pause');
  $('result').classList.toggle('hidden', s !== 'result');
  $('hud').classList.toggle('hidden', !['count', 'play', 'pause', 'done'].includes(s));
  if (s !== 'count' && s !== 'play' && s !== 'pause') $('memo').classList.add('hidden');
  lastKey = '';
}
function pauseGame() { if (G.state === 'play' || G.state === 'count') { G.pausedFrom = G.state; setState('pause'); Audio.stopBgm(); } }
function resumeGame() { if (G.state === 'pause') { Audio.unlock(); setState(G.pausedFrom); Audio.startBgm(); last = performance.now(); } }
// 광고 보고 이어하기 (app.js): 그 자리에서 하트 1개로, 나와 있던 두더지는 치우고 3·2·1 뒤 다시. 한 판에 한 번
window.GameContinue = {
  can: () => !G.contUsed,
  go() {
    G.contUsed = true; clearTimers();
    G.dead = false; G.hearts = Math.max(1, G.hearts); renderHearts();
    for (const h of G.holes) { h.m = null; h.cool = 0.4; }
    G.spawnT = 0.6; G.countT = 3; setState('count'); Audio.startBgm();
  },
};
function goHome() { clearTimers(); Audio.stopBgm(); for (const h of G.holes) h.m = null; setState('home'); if (window.App) App.home(); }

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
  // 앱: 이름·이메일·비밀번호 칸에 글을 쓰는 중이면 게임 키(숫자·P·Esc)로 가로채지 않음
  const tg = e.target; if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable)) return;
  Audio.unlock();
  // 키보드(PC): 숫자 1~9 = 구멍 (7 8 9 / 4 5 6 / 1 2 3 숫자 패드 배치)
  const n = /^(Digit|Numpad)([1-9])$/.exec(e.code);
  if (n && G.state === 'play') { const k = +n[2], h = G.holes[(2 - Math.floor((k - 1) / 3)) * 3 + (k - 1) % 3]; tapAt(h.x, h.y - h.s * 0.3); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') { if (G.state === 'play' || G.state === 'count') pauseGame(); else if (G.state === 'pause') resumeGame(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('blur', () => pauseGame());
const click = (id, fn) => $(id).addEventListener('click', () => { Audio.unlock(); Audio.sfx('ui'); fn(); });
click('btnPause', pauseGame);
click('btnResume', resumeGame);
click('btnRetryP', goHome); // 앱: 다시하기 = 시작 창
// 결과 화면 버튼(이어하기·다시하기·자랑하기·X)은 app.js

// ---------- layout ----------
// 앱: 언제나 세로. 맨 위 광고 자리(#adBar) 아래 #stage 칸에 맞춰 논리 폭 540으로 그림 (가로로 돌리면 app.css 가 '세로로 돌려 주세요')
function resize() {
  const st = $('stage').getBoundingClientRect();
  const sw = Math.max(1, st.width), sh = Math.max(1, st.height);
  const s = $('safe').getBoundingClientRect(), vh = window.innerHeight;
  W = 540; H = Math.round(clamp(W * sh / sw, 640, 1240)); // 태블릿(4:3)도 폭을 꽉 채우게 낮은 높이까지
  scale = Math.min(sw / W, sh / H);
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  root.style.width = W + 'px'; root.style.height = H + 'px';
  const ox = (sw - W * scale) / 2, oy = (sh - H * scale) / 2;
  root.style.transform = `translate(${ox}px, ${oy}px) scale(${scale})`;
  root.style.setProperty('--safe-t', '0px'); // 위쪽 안전 영역은 광고 자리가 맡음
  const insB = Math.max(0, vh - s.bottom);
  root.style.setProperty('--safe-b', Math.max(0, (insB - oy) / scale) + 'px');
  cv.width = Math.round(W * scale * dpr); cv.height = Math.round(H * scale * dpr);
  layoutHoles();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame); // 맨 앞에서 예약: 한 프레임에 오류가 나도 게임이 멈추지 않게
  let dt = (now - last) / 1000; last = now; if (dt > 0.05) dt = 0.05; if (dt < 0) dt = 0;
  step(dt);
  if (['count', 'play', 'done', 'pause'].includes(G.state)) updateHud();
  if (!$('stage').classList.contains('hidden')) render();
}
resize();
renderHearts();
setState('home'); // 처음 화면(인트로·로그인·캐릭터 고르기·시작 창)은 app.js
requestAnimationFrame(frame);

// debug/test hook
window.__mole = { G, step, diff, levelOf, startRun, resetRun, setState, tapAt, hitMole, spawn, showResult, endRun, Save, Audio, resize, goHome };
