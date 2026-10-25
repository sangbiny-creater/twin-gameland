'use strict';
// 은유와 은결의 달콤 베이커리 — 컨베이어로 지나가는 빵 위에 생크림을 짜는 원버튼 타이밍 게임
//  · 컵케이크·금빛 컵케이크: 짤주머니 밑에 올 때 화면을 톡
//  · 긴 빵(롤케이크·에클레어): 앞 끝이 오면 꾹 누르고, 뒤 끝이 오면 떼기 (끝까지 누르고 있으면 '좋아요')
//  · 함정(탄 빵·빈 접시): 누르면 안 됨 → 누르면 하트 -1
//  · 판정: 완벽 / 좋아요 / 아쉬워요 (판정 시간은 levels.js). 빵을 놓치면 하트 -1, 하트 3개가 다 없어지면 실패
//  · 판정선보다 조금 일찍 누르면 "너무 빨라요"(놓친 것과 같음) — 화면을 마구 두드려서 깨는 걸 막음
//  · 콤보 5번 ×1.2, 10번 ×1.5, 20번 ×2 점수
//  · 빵이 다 지나가면 클리어 → 정확도로 별 1~3개
//  · 징검다리: 10개 월드 × 10판 = 100판 (1-1 ~ 10-10). 판별 속도·빵 순서는 levels.js
// 폰 세로: 논리 폭 540 / 폰 가로·태블릿 가로·PC: 논리 높이 540

let W = 540, H = 960;
const WORLDS = ['하늘도시', '숲속 나무마을', '겨울왕국', '석양의 항구', '벚꽃마을', '구름왕국', '바닷속도시', '마법숲', '별빛우주', '황금성'];
const L = window.BakeryLevels, A = window.BakeryArt;
const { PER_WORLD, STAGES, PTS, JUDGE } = L;
const label = (i) => `${Math.floor(i / PER_WORLD) + 1}-${(i % PER_WORLD) + 1}`;
const stageName = (i) => `${WORLDS[Math.floor(i / PER_WORLD)]} ${(i % PER_WORLD) + 1}`;
const ASSET_V = '202610252005';
const MAX_HEARTS = 5;

// ---------- save (메인 화면 없이 단독 실행할 때) ----------
const Save = {
  data: { cleared: {}, sound: true },
  load() { try { Object.assign(this.data, JSON.parse(localStorage.getItem('bakery_v1') || '{}')); } catch (e) { /* private mode */ } },
  store() { try { localStorage.setItem('bakery_v1', JSON.stringify(this.data)); } catch (e) { /* ignore */ } },
};
Save.load();
const HUB = window.Hub && window.Hub.active() ? window.Hub : null;
if (HUB) Save.data.sound = HUB.settings.sound;
const unlocked = (i) => (HUB ? HUB.stageUnlocked('bakery', i) : i === 0 || !!Save.data.cleared[i - 1]);
const nextStage = () => { if (HUB) return HUB.stageNext('bakery'); for (let i = 0; i < STAGES.length; i++) if (!Save.data.cleared[i]) return i; return STAGES.length - 1; };
const GOD = () => !!(window.Hub && window.Hub.god); // 무적 쿠폰 (테스트용)

// ---------- utils ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const $ = (id) => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const fmt = (n) => Math.round(n).toLocaleString();

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
      case 'slow': [880, 660, 520].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.25, 0, i * 0.07)); break;
      case 'auto': for (let i = 0; i < 6; i++) this.tone(700 + i * 160, 0.09, 'triangle', 0.18, 0, i * 0.04); break;
      case 'count': this.tone(880, 0.08, 'sine', 0.25); break;
      case 'go': [660, 990].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.3, 0, i * 0.08)); break;
      case 'clear': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.22, 'square', 0.16, 0, i * 0.11)); break;
      case 'fail': [523, 440, 349, 262].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.3, 0, i * 0.17)); break;
      case 'ui': this.tone(700, 0.06, 'triangle', 0.25); break;
    }
  },
  // 박자 반주: 게임 시계에 맞춰 반 박자마다 (빵이 박자에 맞춰 도착하니까 리듬이 맞음)
  mel: [72, 0, 76, 0, 79, 0, 76, 0, 77, 0, 74, 0, 76, 72, 0, 0, 72, 0, 76, 0, 79, 0, 84, 0, 81, 79, 77, 74, 72, 0, 0, 0],
  bass: [48, 45, 41, 43],
  bgmStep: 0,
  bgmTick(clock, beat, timeScale) {
    if (!this.ctx || !Save.data.sound) return;
    const sd = beat / 2, mf = (n) => 440 * Math.pow(2, (n - 69) / 12);
    while (this.bgmStep * sd < clock + 0.12) {
      const at = this.bgmStep * sd, w = (at - clock) / timeScale;
      if (w > -0.02) {
        const m = this.mel[this.bgmStep % 32];
        if (m) this.tone(mf(m), sd * 0.9 / timeScale, 'triangle', 0.22, 0, w, this.bgm);
        if (this.bgmStep % 2 === 0) this.tone(mf(this.bass[Math.floor(this.bgmStep / 8) % 4]), sd * 1.6 / timeScale, 'sine', 0.5, 0, w, this.bgm);
        else this.tone(2400, 0.03, 'square', 0.04, 0, w, this.bgm);
      }
      this.bgmStep++;
    }
  },
};
const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };

// ---------- state ----------
const cv = $('cv'), ctx = cv.getContext('2d'), root = $('root');
let scale = 1, dpr = 1;
// 상태: ready → count(3·2·1) → play → done(끝 연출) → result / pause
// 빵: { type, t, t1, v(색), st: wait|hold|done|miss|trap, j(판정 값), jt(판정한 시각), hs·he(크림 짠 시각), early }
const G = {
  state: 'ready', si: 0, notes: [], fx: [], t: 0, clock: 0, countT: 0, frameAt: 0,
  hearts: 3, score: 0, coins: 0, combo: 0, maxCombo: 0, made: 0, perfect: 0, accSum: 0, accN: 0, total: 0,
  down: false, pointers: new Set(), sq: 0, holdNote: null, holdSnd: 0,
  slowT: 0, autoT: 0, comboX2: false, pose: 'idle', poseT: 0, pausedFrom: 'play',
};
const LAY = { beltY: 540, nozX: 160, tipY: 380, s: 1, shelfY: 0 };

function layout() {
  const sv = (k) => parseFloat(getComputedStyle(root).getPropertyValue('--safe-' + k)) || 0;
  if (wideLayout()) {
    LAY.s = 0.92; LAY.beltY = Math.round(H * 0.7);
    LAY.nozX = Math.round(Math.max(W * 0.3, 118 + sv('l') + 150));
  } else {
    LAY.s = 1.05; LAY.beltY = Math.round(H * 0.56);
    LAY.nozX = Math.round(W * 0.34);
  }
  LAY.tipY = LAY.beltY - 128 * LAY.s;
  LAY.shelfY = LAY.beltY + 70;
}
const beltH = () => 40 * LAY.s;
const speed = () => STAGES[G.si].speed * LAY.s;
const xAt = (t) => LAY.nozX + (t - G.clock) * speed();
// 판정 글자: 짤주머니 오른쪽 (주머니에 가리지 않게)
const judgeX = () => LAY.nozX + 150 * LAY.s;
const timeScale = () => (G.slowT > 0 ? 0.7 : 1);
// 지금 이 순간의 게임 시계 (화면 그리기 사이에 누른 것도 정확하게)
const nowClock = () => G.clock + (G.state === 'play' ? Math.min(0.05, (performance.now() - G.frameAt) / 1000) * timeScale() : 0);

// ---------- run ----------
function startStage(si) {
  G.si = si;
  clearTimers();
  G.notes = L.notes(si).map((n, k) => ({ ...n, v: k % 5, kind: k % 2, st: 'wait' }));
  G.total = G.notes.filter((n) => n.type !== 'burnt' && n.type !== 'plate').length;
  G.hearts = 3; G.score = 0; G.coins = 0; G.combo = 0; G.maxCombo = 0; G.made = 0; G.perfect = 0; G.accSum = 0; G.accN = 0;
  G.fx = []; G.t = 0; G.clock = 0; G.slowT = 0; G.autoT = 0; G.comboX2 = false; G.holdNote = null; G.down = false; G.pointers.clear();
  G.pose = 'idle'; G.poseT = 0;
  Audio.bgmStep = 0;
  if (HUB) HUB.starterKit('bakery');
  const boosts = HUB ? HUB.takeBoosts('bakery') : [];
  if (boosts.includes('combo')) G.comboX2 = true;
  if (boosts.length) toast('부스트: ' + boosts.map((b) => HUB.boostName('bakery', b)).join(' · '));
  $('hudStage').textContent = `스테이지 ${label(si)}`;
  renderItems(); renderBuffs(); renderHearts();
  G.countT = 3;
  setState('count');
}
// 준비 창: 이 판에 나오는 빵만 보여 줌
function showReady(si) {
  G.si = si; clearTimers();
  G.notes = [];
  const kinds = new Set(L.notes(si).map((n) => n.type));
  const items = [['cup', '컵케이크', '톡!', true], ['long', '긴 빵', '꾹~ 떼기', kinds.has('long')], ['gold', '금빛 컵케이크', `+${PTS.gold}`, kinds.has('gold')]];
  let html = items.filter((k) => k[3]).map(([id, nm, p]) => `<div class="lg"><img src="${icon(id)}" alt=""><span>${nm}</span><b>${p}</b></div>`).join('');
  const traps = ['burnt', 'plate'].filter((k) => kinds.has(k));
  if (traps.length) html += `<div class="lg no">${traps.map((k) => `<img src="${icon(k)}" alt="">`).join('')}<span>${traps.map((k) => (k === 'burnt' ? '탄 빵' : '빈 접시')).join('·')}</span><b>누르면 안 돼요!</b></div>`;
  $('legend').innerHTML = html;
  $('readyTitle').textContent = `${label(si)} ${stageName(si)}`;
  $('readyInfo').innerHTML = `빵 <b>${L.notes(si).length}개</b> · 하트 <b>3개</b>`;
  setState('ready');
}
// 준비 창 그림 (코드로 그린 빵을 그림으로)
const ICONS = {};
function icon(id) {
  if (ICONS[id]) return ICONS[id];
  const c = document.createElement('canvas'); c.width = 148; c.height = 100; const g = c.getContext('2d');
  if (id === 'cup') A.cupcake(g, 74, 92, 0.85, { v: 0, cream: 1 });
  else if (id === 'gold') A.cupcake(g, 74, 92, 0.85, { gold: true, cream: 1 });
  else if (id === 'burnt') A.cupcake(g, 74, 92, 0.85, { burnt: true, t: 0.3 });
  else if (id === 'plate') A.plate(g, 74, 80, 1.2);
  else if (id === 'long') A.longBread(g, 6, 142, 84, 0.8, 0, [6, 142], true);
  return (ICONS[id] = c.toDataURL());
}
// 판이 바뀌거나 다시 하면 남아 있던 setTimeout 은 무시 (판 번호로 구분)
let runId = 0;
const timers = [];
function later(fn, ms) { const id = runId; timers.push(setTimeout(() => { if (id === runId) fn(); }, ms)); }
function clearTimers() { runId++; timers.forEach(clearTimeout); timers.length = 0; }

const comboMul = (c) => (c >= 20 ? 2 : c >= 10 ? 1.5 : c >= 5 ? 1.2 : 1);
const isTrap = (n) => n.type === 'burnt' || n.type === 'plate';
const judgeOf = (dt) => { const w = STAGES[G.si].win, a = Math.abs(dt); return a <= w.p ? 'perfect' : a <= w.g ? 'good' : a <= w.o ? 'ok' : null; };
const JTXT = { perfect: '완벽!', good: '좋아요!', ok: '아쉬워요' };

// ---------- 누르기 / 떼기 ----------
function press(tc) {
  if (G.state !== 'play' || G.autoT > 0) return;
  const w = STAGES[G.si].win;
  // 판정 시간 안에서 가장 가까운 빵
  let best = null, bd = 1e9;
  for (const n of G.notes) {
    if (n.st !== 'wait') continue;
    const d = Math.abs(tc - n.t);
    if (d <= w.o && d < bd) { bd = d; best = n; }
    if (n.t - tc > w.o) break;
  }
  if (best) { hitNote(best, tc); return; }
  // 조금 일찍 누름: 다음 빵(함정 아님)을 놓친 것으로 (빵 사이가 넉넉할 때만)
  const idx = G.notes.findIndex((n) => n.st === 'wait' && n.t - tc > w.o);
  const nx = G.notes[idx];
  if (nx && !isTrap(nx)) {
    const prev = G.notes[idx - 1], prevEnd = prev ? (prev.t1 || prev.t) : -9;
    const early = Math.min(0.15, Math.max(0, nx.t - prevEnd - 2 * w.o - 0.05));
    if (nx.t - tc <= w.o + early) { missNote(nx, '너무 빨라요!'); nx.early = true; splat(LAY.nozX, LAY.beltY - 6); return; }
  }
  Audio.sfx('empty'); G.fx.push({ kind: 'drip', x: LAY.nozX, y: LAY.tipY, t: 0, life: 0.5 });
}
function release(tc) {
  const n = G.holdNote; if (!n || n.st !== 'hold') return;
  const w = STAGES[G.si].win;
  n.he = Math.min(tc, n.t1 + w.o);
  if (tc >= n.t1 - w.o) finishLong(n, judgeOf(tc - n.t1) || 'ok');
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
  const j = judgeOf(tc - n.t) || 'ok';
  Audio.sfx('squish');
  if (n.type === 'long') {
    n.st = 'hold'; n.sj = j; n.hs = tc; n.he = tc; G.holdNote = n; G.holdSnd = 0;
    popText(JTXT[j], j, judgeX(), LAY.tipY - 120 * LAY.s, true);
    return;
  }
  n.st = 'done'; n.j = j; n.jt = tc;
  success(n, JUDGE[j], j, PTS[n.type]);
}
function finishLong(n, ej) {
  n.st = 'done'; n.j = ej; n.jt = G.clock; G.holdNote = null;
  const v = (JUDGE[n.sj] + JUDGE[ej]) / 2;
  success(n, v, v >= 0.95 ? 'perfect' : v >= 0.65 ? 'good' : 'ok', PTS.long);
}
function success(n, v, j, base) {
  G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo);
  G.accSum += v; G.accN++; G.made++;
  if (j === 'perfect') G.perfect++;
  const pts = Math.round(base * v * comboMul(G.combo));
  G.score += pts;
  // 코인: 빵 1개 = 1코인, 완벽 +1, 금빛 +3, 콤보 10번마다 +2 (콤보 보너스 부스트면 +4)
  if (!GOD()) G.coins += 1 + (j === 'perfect' ? 1 : 0) + (n.type === 'gold' ? 3 : 0) + (G.combo % 10 === 0 ? (G.comboX2 ? 4 : 2) : 0);
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
  if (!isTrap(n)) G.accN++;
  loseHeart(msg);
}
function loseHeart(msg) {
  G.combo = 0;
  Audio.sfx(msg.startsWith('앗') ? 'bad' : 'miss'); buzz(40);
  popText(msg, 'bad', judgeX(), LAY.tipY - 120 * LAY.s);
  setPose('hit', 0.6);
  if (GOD()) return;
  G.hearts--; renderHearts();
  G.fx.push({ kind: 'heartLoss', t: 0, life: 0.6 });
  if (G.hearts <= 0) endStage(false);
}
function setPose(p, t) { G.pose = p; G.poseT = t; }
function popText(text, j, x, y) {
  G.fx = G.fx.filter((f) => f.kind !== 'judge');
  G.fx.push({ kind: 'judge', text, j, x, y, t: 0, life: 0.75 });
}
function burst(x, y, n, gold) {
  for (let i = 0; i < n; i++) {
    const an = -Math.PI / 2 + rnd(-1.2, 1.2), sp = rnd(140, 260);
    G.fx.push({ kind: 'spark', x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, r: rnd(8, 14), c: gold ? '#FFD34D' : ['#FF8FB1', '#FFD34D', '#8FD0FF', '#B9E8B0'][i % 4], t: 0, life: rnd(0.45, 0.7) });
  }
}
function splat(x, y) { G.fx.push({ kind: 'splat', x, y, t: 0, life: 0.9 }); }

// ---------- items ----------
// 하트 +1 (최대 5개) / 느리게: 8초 동안 모든 게 0.7배 속도 / 자동 짜기: 5초 동안 자동으로 완벽 (함정은 그대로 지나감)
const ITEM_IDS = ['life', 'slow', 'auto'];
const itemCount = (id) => (HUB ? HUB.boostCount('bakery', id) : G.items[id]);
function spendItem(id) {
  if (HUB) return HUB.useBoost('bakery', id);
  if (G.items[id] <= 0) return false;
  G.items[id]--; return true;
}
const ITEM_NAME = { life: '❤️ 하트 +1', slow: '🐢 느리게', auto: '✨ 자동 짜기' };
function useItem(id) {
  if (G.state !== 'play') return;
  if (itemCount(id) <= 0) { toast(`${ITEM_NAME[id].slice(2).trim()} 아이템이 없어요. 아이템샵에서 살 수 있어요`); Audio.sfx('empty'); return; }
  if (id === 'life') {
    if (G.hearts >= MAX_HEARTS) { toast(`하트는 ${MAX_HEARTS}개까지예요`); return; }
    spendItem(id); G.hearts++; renderHearts(); Audio.sfx('life');
    G.fx.push({ kind: 'text', text: '하트 +1', x: W / 2, y: LAY.tipY - 230 * LAY.s, t: 0, life: 1, big: true });
  } else if (id === 'slow') {
    spendItem(id); G.slowT = 8; Audio.sfx('slow');
    G.fx.push({ kind: 'text', text: '천천히~', x: W / 2, y: LAY.tipY - 230 * LAY.s, t: 0, life: 1, big: true });
  } else if (id === 'auto') {
    spendItem(id); G.autoT = 5; Audio.sfx('auto');
    G.fx.push({ kind: 'text', text: '자동 짜기!', x: W / 2, y: LAY.tipY - 230 * LAY.s, t: 0, life: 1, big: true, gold: true });
  }
  renderItems(); renderBuffs();
}
// 자동 짜기: 빵이 딱 도착하면 대신 눌러 줌
function autoPlay() {
  for (const n of G.notes) {
    if (n.t > G.clock) break;
    if (n.st === 'wait' && !isTrap(n)) hitNote(n, n.t);
  }
  const h = G.holdNote;
  if (h && h.st === 'hold' && G.clock >= h.t1) { h.he = h.t1; finishLong(h, 'perfect'); }
}

// ---------- end ----------
function starsOf(ok) { if (!ok) return 0; const a = G.accSum / Math.max(1, G.total); return a >= L.STAR3 ? 3 : a >= L.STAR2 ? 2 : 1; }
function endStage(ok) {
  if (G.state !== 'play') return;
  setState('done');
  G.holdNote = null; G.down = false;
  let s = starsOf(ok);
  if (GOD() && !s) { s = 1; ok = true; }
  Audio.sfx(ok ? 'clear' : 'fail');
  if (ok) for (let i = 0; i < 50; i++) G.fx.push({ kind: 'confetti', x: Math.random() * W, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 80, vy: 120 + Math.random() * 160, r: Math.random() * 6, c: ['#FFB5C5', '#FFD34D', '#79C89C', '#5CA9E6', '#C9A8FF'][i % 5], t: 0, life: 3 });
  setPose(ok ? 'cheer' : 'dizzy', 9);
  let earn = null, reward = [];
  if (HUB) {
    earn = HUB.record('bakery', { stage: G.si, cleared: ok, dist: G.score, coins: G.coins, stars: s });
    reward = ok && !earn.god ? clearReward(s, earn.firstClear) : [];
  } else if (ok) { Save.data.cleared[G.si] = true; Save.store(); }
  G.fx.push({ kind: 'text', text: ok ? '다 만들었어요!' : '하트가 없어요!', x: W / 2, y: H * 0.3, t: 0, life: 1.3, big: true, bad: !ok });
  later(() => showResult(ok, s, earn, reward), 1300);
}
// 클리어 보상 아이템 (캐릭터 보유 수량에 바로 더해짐)
//  · 처음 깬 판: 하트 +1·느리게 중 1개  · 별 3개: 느리게 1개  · 월드 마지막 판(N-10) 처음 깨면: 자동 짜기 1개
function clearReward(st, first) {
  const got = [];
  const give = (id) => { HUB.addBoost('bakery', id, 1); got.push(id); };
  if (first) give(Math.random() < 0.5 ? 'life' : 'slow');
  if (st >= 3) give('slow');
  if (first && G.si % PER_WORLD === PER_WORLD - 1) give('auto');
  return got;
}
function showResult(ok, st, earn, reward) {
  $('resTitle').textContent = ok ? '스테이지 클리어!' : '아쉬워요!';
  document.querySelector('.panel.result').classList.toggle('fail', !ok);
  $('resStars').innerHTML = [0, 1, 2].map((k) => `<span class="${k < st ? '' : 'off'}">★</span>`).join('');
  $('resMade').textContent = `${G.made}개`;
  $('resPerfect').textContent = `${G.perfect}번`;
  $('resAcc').textContent = `${Math.round(G.accSum / Math.max(1, G.total) * 100)}%`;
  $('resScore').textContent = `${fmt(G.score)}점`;
  $('resCombo').textContent = G.maxCombo;
  $('resCoin').textContent = G.coins;
  // 오늘 만든 케이크 진열장
  $('resShelf').innerHTML = G.notes.filter((n) => n.st === 'done').slice(0, 40).map((n) => `<img src="${icon(n.type === 'long' ? 'long' : n.type === 'gold' ? 'gold' : 'cup')}" alt="">`).join('');
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
  for (const f of G.fx) { f.t += dt; if (f.vx != null) { f.x += f.vx * dt; f.y += f.vy * dt; if (f.kind === 'spark') f.vy += 600 * dt; } }
  G.fx = G.fx.filter((f) => f.t < f.life);
  G.sq += ((G.down || G.holdNote || G.autoT > 0 && nearNote() ? 1 : 0) - G.sq) * Math.min(1, dt * 18);
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
  if (G.autoT > 0) { autoPlay(); G.autoT = Math.max(0, G.autoT - dt); if (!G.autoT) renderBuffs(); }
  Audio.bgmTick(G.clock, 60 / STAGES[G.si].bpm, ts);
  const w = STAGES[G.si].win;
  for (const n of G.notes) {
    if (n.t - G.clock > w.o) break;
    if (n.st !== 'wait' || G.clock - n.t <= w.o) continue;
    if (isTrap(n)) { n.st = 'passed'; continue; } // 함정을 잘 참음
    missNote(n, '놓쳤어요');
    if (G.state !== 'play') return;
  }
  const h = G.holdNote;
  if (h && h.st === 'hold') {
    h.he = G.clock;
    G.holdSnd -= dt; if (G.holdSnd <= 0) { G.holdSnd = 0.09; Audio.sfx('hold', (G.clock - h.t) / (h.t1 - h.t) * 6); }
    if (G.clock > h.t1 + w.o) { h.he = h.t1; finishLong(h, 'good'); } // 끝까지 누르고 있어도 OK
  }
  const last = G.notes[G.notes.length - 1];
  if (last && G.notes.every((n) => n.st !== 'wait' && n.st !== 'hold') && G.clock > (last.t1 || last.t) + 0.6) endStage(true);
}
function nearNote() { return G.notes.some((n) => n.st === 'hold' || (n.st === 'done' && G.clock - n.jt < 0.15)); }

// ---------- render ----------
function render() {
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  const s = LAY.s, by = LAY.beltY;
  A.backdrop(ctx, W, H, by + beltH() + 20, G.t);
  drawShelf();
  drawChar();
  // 판정 자리 표시 (짤주머니 밑)
  const w = STAGES[G.si] ? STAGES[G.si].win : { o: 0.2 };
  const soon = G.state === 'play' && G.notes.some((n) => n.st === 'wait' && !isTrap(n) && Math.abs(n.t - G.clock) <= w.o);
  ctx.save(); ctx.globalAlpha = soon ? 0.9 : 0.45;
  ctx.fillStyle = soon ? '#FFE07A' : '#FFFFFF';
  ctx.beginPath(); ctx.ellipse(LAY.nozX, by + 2, 52 * s, 10 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  A.belt(ctx, W, by, beltH(), G.clock * speed(), s);
  ctx.save(); ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(255,224,122,.9)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(LAY.nozX, by + 3); ctx.lineTo(LAY.nozX, by + beltH() - 3); ctx.stroke(); ctx.restore();
  // 빵 (뒤에서 앞으로: 오른쪽 것부터)
  let creamY = by - 40 * s;
  for (let i = G.notes.length - 1; i >= 0; i--) {
    const n = G.notes[i], x = xAt(n.t);
    const x1 = n.type === 'long' ? xAt(n.t1) : x;
    if (x1 < -150 || x > W + 150) continue;
    const y = by;
    if (n.type === 'long') {
      const hs = n.hs, he = n.he;
      const cream = hs != null ? [xAt(n.t) + (hs - n.t) * speed(), xAt(n.t) + (he - n.t) * speed()] : null;
      const top = A.longBread(ctx, x - 8 * s, x1 + 8 * s, y, s, n.kind, cream, n.st === 'done');
      if (n.st === 'hold') creamY = top + 2 * s;
      if (n.st === 'wait') drawLongMarks(n, x, x1, top);
    } else if (n.type === 'plate') A.plate(ctx, x, y, s);
    else {
      const k = n.st === 'done' ? Math.min(1, (G.clock - n.jt) / 0.12) : 0;
      const top = A.cupcake(ctx, x, y, s, { v: n.v, burnt: n.type === 'burnt', gold: n.type === 'gold', cream: k, t: G.t });
      if (n.st === 'done' && G.clock - n.jt < 0.15) creamY = top;
      if (n.st === 'trap') { ctx.save(); ctx.globalAlpha = 0.9; A.swirl(ctx, x + 4 * s, by - 60 * s, s * 0.7, 0.5); ctx.restore(); }
    }
    if (n.st === 'miss' && !n.early && G.clock - n.jt < 0.8) drawX(x1 > x ? (x + x1) / 2 : x, by - 60 * s, 1 - (G.clock - n.jt) / 0.8);
    if (n.st === 'wait' && !isTrap(n)) drawGuide(n, x);
  }
  // 짤주머니 + 크림 줄기
  const sq = G.sq;
  if (sq > 0.3) A.stream(ctx, LAY.nozX, LAY.tipY - 2, Math.max(LAY.tipY, creamY), s);
  A.bag(ctx, LAY.nozX, LAY.tipY + sq * 4, s * 1.05, sq, G.autoT > 0 ? '#FFE07A' : '#FFC2D4');
  drawFx();
  drawHint();
}
// 긴 빵: 앞 끝 "꾹" · 뒤 끝 "떼기" 표시
function drawLongMarks(n, x, x1, top) {
  const g = STAGES[G.si].guide; if (g <= 0) return;
  ctx.save(); ctx.globalAlpha = g; ctx.font = `${20 * LAY.s}px Jua, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.lineWidth = 5; ctx.strokeStyle = '#fff';
  ctx.strokeText('꾹', x, top - 6); ctx.fillStyle = '#E8456A'; ctx.fillText('꾹', x, top - 6);
  ctx.strokeText('떼기', x1, top - 6); ctx.fillStyle = '#2F86E8'; ctx.fillText('떼기', x1, top - 6);
  ctx.restore();
}
// 타이밍 도우미: 빵 위에서 줄어드는 동그라미 → 딱 맞는 순간 판정 자리 크기
function drawGuide(n, x) {
  const g = STAGES[G.si].guide, dtt = n.t - G.clock; if (g <= 0 || dtt > 1.1 || dtt < -0.1) return;
  const s = LAY.s, r0 = 54 * s, r = r0 + Math.max(0, dtt) * 90 * s;
  ctx.save(); ctx.globalAlpha = g * clamp(1 - dtt / 1.1, 0, 1) * 0.95;
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
  const s = LAY.s, wide = wideLayout();
  const h = (wide ? 150 : 150) * s;
  const x = wide ? Math.max(LAY.nozX - 150 * s, 118 + 70) : LAY.nozX - 108 * s;
  const pose = CV.has(myLook, G.pose) ? G.pose : 'idle';
  const bob = G.pose === 'cheer' ? -Math.abs(Math.sin(G.t * 10)) * 10 : Math.sin(G.t * 3) * 2;
  ctx.save(); ctx.translate(x, LAY.beltY + 14 + bob);
  CV.draw(ctx, myLook, pose, { h });
  ctx.restore();
}
// 세로 화면: 컨베이어 아래 진열장에 만든 케이크가 쌓임
function drawShelf() {
  if (wideLayout()) return;
  const s = 0.5, y0 = LAY.beltY + beltH() + 60, x0 = 30, cols = 10, cw = (W - 60) / cols;
  const sv = parseFloat(getComputedStyle(root).getPropertyValue('--safe-b')) || 0;
  const maxY = H - 150 - sv;
  if (maxY - y0 < 70) return;
  const rows = Math.max(1, Math.min(4, Math.floor((maxY - y0) / 66)));
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.strokeStyle = '#C98B5A'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(16, y0 - 14, W - 32, rows * 66 + 20, 18) : ctx.rect(16, y0 - 14, W - 32, rows * 66 + 20); ctx.fill(); ctx.stroke();
  const done = G.notes.filter((n) => n.st === 'done');
  for (let r = 0; r < rows; r++) { ctx.fillStyle = '#C98B5A'; ctx.fillRect(22, y0 + r * 66 + 50, W - 44, 6); }
  done.slice(-rows * cols).forEach((n, i) => {
    const r = Math.floor(i / cols), c = i % cols, x = x0 + cw * (c + 0.5), y = y0 + r * 66 + 50;
    if (n.type === 'long') A.longBread(ctx, x - cw * 0.45, x + cw * 0.45, y, s * 0.8, n.kind, [x - cw, x + cw], true);
    else A.cupcake(ctx, x, y, s, { v: n.v, gold: n.type === 'gold', cream: 1 });
  });
}
// 처음 판들: 아래쪽에 큰 안내
function drawHint() {
  if (G.si > 2 || (G.state !== 'play' && G.state !== 'count')) return;
  const y = wideLayout() ? H - 40 : LAY.beltY + beltH() + 30;
  ctx.save(); ctx.font = '24px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const txt = G.si < 2 ? '컵케이크가 노란 자리에 오면 화면을 톡!' : '긴 빵은 앞에서 꾹~ 누르고 끝에서 떼요!';
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(122,62,0,.9)'; ctx.strokeText(txt, W / 2 + (wideLayout() ? 60 : 0), y);
  ctx.fillStyle = '#FFF6D0'; ctx.fillText(txt, W / 2 + (wideLayout() ? 60 : 0), y);
  ctx.restore();
}
const JCOL = { perfect: ['#FFF27A', '#B5600F'], good: ['#9BF0A8', '#2E7A3A'], ok: ['#A8DCFF', '#2F5FA8'], bad: ['#FF8FA0', '#7A0E1E'] };
function drawFx() {
  for (const f of G.fx) {
    const k = f.t / f.life;
    if (f.kind === 'confetti') { ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 2); ctx.fillStyle = f.c; ctx.translate(f.x, f.y); ctx.rotate(f.t * 6 + f.r); ctx.fillRect(-5, -3, 10, 6); ctx.restore(); continue; }
    if (f.kind === 'spark') { ctx.save(); ctx.globalAlpha = 1 - k * k; A.heart(ctx, f.x, f.y, f.r, true); ctx.restore(); ctx.save(); ctx.globalAlpha = (1 - k) * 0.6; ctx.fillStyle = f.c; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 0.5, 0, 7); ctx.fill(); ctx.restore(); continue; }
    if (f.kind === 'drip') {
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.fillStyle = '#FFFDF7'; ctx.strokeStyle = '#6B3A1E'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(f.x, f.y + 8 + k * 40, 6 * LAY.s, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); continue;
    }
    if (f.kind === 'splat') {
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.translate(f.x, f.y); ctx.scale(0.6 + k * 0.6, 0.6 + k * 0.6); ctx.fillStyle = '#FFFDF7'; ctx.strokeStyle = '#6B3A1E'; ctx.lineWidth = 3;
      ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = i % 2 ? 14 : 26; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.6); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); continue;
    }
    if (f.kind === 'heartLoss') { ctx.save(); ctx.globalAlpha = 0.35 * (1 - k); ctx.fillStyle = '#FF3A5A'; ctx.fillRect(0, 0, W, H); ctx.restore(); continue; }
    if (f.kind === 'judge') {
      const [fill, stroke] = JCOL[f.j] || JCOL.ok, sc = k < 0.15 ? 0.6 + k / 0.15 * 0.5 : 1.1 - Math.min(0.1, (k - 0.15));
      ctx.save(); ctx.globalAlpha = 1 - Math.max(0, k - 0.65) / 0.35; ctx.translate(f.x, f.y - k * 16); ctx.scale(sc, sc);
      ctx.font = `${f.j === 'bad' ? 34 : 44}px Jua, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 8; ctx.strokeStyle = stroke; ctx.strokeText(f.text, 0, 0); ctx.fillStyle = fill; ctx.fillText(f.text, 0, 0);
      ctx.restore(); continue;
    }
    if (f.kind === 'text') {
      ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
      ctx.font = `${f.big ? 44 : f.small ? 26 : 32}px Jua, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 7; ctx.strokeStyle = f.bad ? '#7A0E1E' : '#7A3E00'; ctx.strokeText(f.text, f.x, f.y - k * 30);
      ctx.fillStyle = f.bad ? '#FF6B7E' : f.gold ? '#FFF27A' : '#FFE07A'; ctx.fillText(f.text, f.x, f.y - k * 30);
      ctx.globalAlpha = 1;
    }
  }
}

// ---------- HUD ----------
let lastKey = '';
function updateHud() {
  const key = `${G.score}|${G.coins}|${G.combo}|${Math.ceil(G.slowT)}|${Math.ceil(G.autoT)}|${G.accSum.toFixed(2)}`;
  if (key === lastKey) return;
  lastKey = key;
  $('hudScore').textContent = fmt(G.score); $('hudCoin').textContent = G.coins;
  $('hudCombo').textContent = G.combo;
  $('comboPill').classList.toggle('hot', G.combo >= 5);
  // 별 막대: 정확도 점수(완벽 1·좋아요 0.7·아쉬워요 0.4)를 모아 3별(85%)까지 채움
  const full = L.STAR3 * Math.max(1, G.total);
  $('starFill').style.width = (clamp(G.accSum / full, 0, 1) * 100) + '%';
  const s1 = document.querySelector('.starbar .s1'), s2 = document.querySelector('.starbar .s2'), s3 = document.querySelector('.starbar .s3');
  s1.style.left = (0.3 / L.STAR3 * 100) + '%'; s2.style.left = (L.STAR2 / L.STAR3 * 100) + '%';
  s1.classList.toggle('off', G.accSum < 0.3 * G.total); s2.classList.toggle('off', G.accSum < L.STAR2 * G.total); s3.classList.toggle('off', G.accSum < full);
  const bs = $('buffSlow'); if (bs) bs.textContent = `🐢 ${Math.ceil(G.slowT)}초`;
  const ba = $('buffAuto'); if (ba) ba.textContent = `✨ ${Math.ceil(G.autoT)}초`;
}
function renderHearts() {
  const n = Math.max(G.hearts, 3);
  $('hudHearts').innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i < G.hearts ? '' : 'off'}">❤</i>`).join('');
}
function renderItems() {
  for (const id of ITEM_IDS) {
    const n = itemCount(id), b = $('it_' + id);
    b.querySelector('i').textContent = n; b.classList.toggle('empty', n <= 0);
  }
}
function renderBuffs() {
  const el = $('buffs'); el.innerHTML = '';
  if (G.comboX2) { const d = document.createElement('div'); d.className = 'buff'; d.textContent = '🌈 콤보 2배'; el.appendChild(d); }
  if (G.slowT > 0) { const d = document.createElement('div'); d.className = 'buff'; d.id = 'buffSlow'; el.appendChild(d); }
  if (G.autoT > 0) { const d = document.createElement('div'); d.className = 'buff dbl'; d.id = 'buffAuto'; el.appendChild(d); }
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
function pauseGame() {
  if (G.state === 'play' || G.state === 'count') {
    // 긴 빵을 누르던 중이면 그 자리에서 뗀 것으로
    if (G.holdNote) release(G.clock);
    G.down = false; G.pointers.clear();
    G.pausedFrom = G.state; setState('pause');
  }
}
function resumeGame() { if (G.state === 'pause') { setState(G.pausedFrom); last = performance.now(); } }
function goMap() { clearTimers(); location.href = HUB ? '../index.html#map-bakery' : '../index.html'; }

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
  if ((e.code === 'Space' || e.code === 'Enter') && G.state === 'ready') { e.preventDefault(); $('btnGo').click(); return; }
  if (e.code === 'Space' || e.code === 'KeyJ' || e.code === 'KeyF') { e.preventDefault(); if (!e.repeat) down('k' + e.code); return; }
  if (e.code === 'Digit1') useItem('life'); else if (e.code === 'Digit2') useItem('slow'); else if (e.code === 'Digit3') useItem('auto');
  else if (e.code === 'Escape' || e.code === 'KeyP') { if (G.state === 'play' || G.state === 'count') pauseGame(); else if (G.state === 'pause') resumeGame(); }
});
window.addEventListener('keyup', (e) => { if (e.code === 'Space' || e.code === 'KeyJ' || e.code === 'KeyF') up('k' + e.code); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('blur', () => pauseGame());
const click = (id, fn) => $(id).addEventListener('click', () => { Audio.unlock(); Audio.sfx('ui'); fn(); });
click('btnGo', () => startStage(G.si));
click('btnReadyMap', goMap); click('btnMapP', goMap); click('btnMapR', goMap);
click('btnPause', pauseGame); click('btnResume', resumeGame);
click('btnRetryP', () => startStage(G.si)); click('btnRetry', () => startStage(G.si));
click('btnNext', () => showReady(Math.min(STAGES.length - 1, G.si + 1)));
for (const id of ITEM_IDS) $('it_' + id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Audio.unlock(); useItem(id); });
G.items = { life: 1, slow: 1, auto: 1 }; // 단독 실행일 때 기본 수량

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
{
  const q = new URLSearchParams(location.search);
  let si = parseInt(q.get('stage'), 10);
  if (!(si >= 0 && si < STAGES.length) || !unlocked(si)) si = nextStage();
  showReady(si);
  if (q.get('go') === '1') startStage(si); // 인트로 START: 준비 창 없이 바로
}
requestAnimationFrame(frame);

// debug/test hook
window.__bakery = { G, step, startStage, showReady, STAGES, useItem, press, release, endStage, showResult, LAY };
