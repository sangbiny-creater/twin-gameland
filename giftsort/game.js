'use strict';
// 선물가게 정리 — Water Sort 방식 퍼즐 (물 대신 선물 상자, 병 대신 카트)
//  · 카트를 누르면 맨 위 상자(같은 상자가 붙어 있으면 함께)가 들리고, 다른 카트를 누르면 옮김
//  · 옮길 수 있는 곳: 빈 카트, 또는 맨 위가 같은 상자인 카트 (자리만큼). 카트마다 한 종류 4개가 되면 완성
//  · 모든 카트가 완성되거나 비면 클리어 → 옮긴 횟수로 별 1~3개 (컴퓨터 풀이 횟수 par 기준)
//  · 특수: 깜짝 상자(맨 위가 되기 전엔 물음표 포장) · 리본 카트(다른 카트를 완성하면 풀림) · 황금 선물(완성하면 코인 더)
//  · 징검다리: 쉬움 100판 + 어려움 100판. 판 표는 levels.js (tools/giftsort_levels.mjs 가 만듦, 모두 풀리는 판)
//  · 카트·상자는 DOM, 배경과 반짝이 효과는 canvas
// 폰 세로: 세로 배치 (논리 폭 540) / 폰 가로·태블릿 가로·PC: 가로 배치 (논리 높이 540)

let W = 540, H = 960;
const WORLDS = ['장난감 거리', '꽃집 정원', '사탕 과자점', '바닷가 기념품점', '눈꽃 선물마을', '숲속 나무공방', '별빛 야시장', '구름 풍선가게', '리본 공장', '황금 선물궁전'];
const { PER_WORLD, STAGES, HARD, CAP } = window.GiftLevels;
const isHard = (i) => i >= HARD;
const worldOf = (i) => Math.floor((i % HARD) / PER_WORLD);
const GIFTS = ['rabbit', 'star', 'heart', 'clover', 'bear', 'car', 'candy', 'cloud', 'flower', 'moon', 'puppy', 'snow']; // levels.js 의 a~l
const UNDO_FREE = 3, HINT_FREE = 1, UNDO_ITEM = 5; // 판마다 무료 되돌리기·힌트. 시작 팝업에서 고른 아이템: 되돌리기 +5번, 힌트 +1, 카트 추가 1번 (아이템샵에서 삼)
const CART_COIN = 3, GOLD_COIN = 10;              // 카트 완성 코인 / 황금 선물 카트 완성 코인
const label = (i) => `${isHard(i) ? '어려움 ' : ''}${worldOf(i) + 1}-${(i % PER_WORLD) + 1}`;
const stageName = (i) => `${WORLDS[worldOf(i)]} ${(i % PER_WORLD) + 1}`;
const ASSET_V = '202611092215';
const giftSrc = (n) => `assets/gifts/${n}.webp?v=${ASSET_V}`;
// 별: 옮긴 횟수가 par 에 가까울수록 (컴퓨터 풀이도 가장 짧은 풀이는 아니라서 넉넉하게)
const starLimits = (par) => [par + 2 + Math.floor(par * 0.1), Math.ceil(par * 1.5) + 4];

// ---------- save (메인 화면 없이 단독 실행할 때) ----------
const Save = {
  data: { cleared: {}, sound: true },
  load() { try { Object.assign(this.data, JSON.parse(localStorage.getItem('giftsort_v1') || '{}')); } catch (e) { /* private mode */ } },
  store() { try { localStorage.setItem('giftsort_v1', JSON.stringify(this.data)); } catch (e) { /* ignore */ } },
};
Save.load();
const HUB = window.Hub && window.Hub.active() ? window.Hub : null;
if (HUB) { Save.data.sound = HUB.settings.sound; HUB.starterKit('giftsort'); } // 처음 한 번 기본 아이템 (시작 팝업에 바로 보이게)
const unlocked = (i) => {
  if (HUB) return HUB.stageUnlocked('giftsort', i);
  const C = Save.data.cleared;
  if (isHard(i)) { const h = i - HARD; return !!C[Math.floor(h / PER_WORLD) * PER_WORLD + PER_WORLD - 1] && (h === 0 || !!C[i - 1]); }
  return i === 0 || !!C[i - 1];
};
const nextStage = () => { if (HUB) return HUB.stageNext('giftsort'); for (let i = 0; i < HARD; i++) if (!Save.data.cleared[i]) return i; return HARD - 1; };
const GOD = () => !!(window.Hub && window.Hub.god);

// ---------- utils ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const $ = (id) => document.getElementById(id);
const tr = (s) => (window.I18N && I18N.tr ? I18N.tr(s) : s); // 영어판: 이어 붙이는 글 조각을 먼저 바꿔 둠

// ---------- images ----------
const BG = { port: new Image(), land: new Image() };
BG.port.src = `assets/bg/port.webp?v=${ASSET_V}`; BG.land.src = `assets/bg/land.webp?v=${ASSET_V}`;
const FXI = [0, 1, 2, 3, 4, 5].map((k) => { const im = new Image(); im.src = `assets/fx/p${k}.webp?v=${ASSET_V}`; return im; });
[...GIFTS, 'gold', 'mystery', 'bow'].forEach((n) => { new Image().src = giftSrc(n); });
// 내 캐릭터: 고른 사람 1명, 입은 옷 그대로 (그림이 없는 옷은 기본 옷)
const ME = (() => {
  const look = HUB ? HUB.active().look : 'eunyu3';
  const who = String(look).startsWith('eungyeol') ? 'eungyeol' : 'eunyu', tag = HUB ? HUB.outfitTag(who) : '';
  const src = (pose, t = tag) => `assets/chars/${who}${t}_${pose}.webp?v=${ASSET_V}`;
  ['idle', 'think', 'happy', 'cheer'].forEach((p) => { new Image().src = src(p); });
  return { who, tag, src };
})();

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
      case 'pick': this.tone(620, 0.07, 'triangle', 0.22, 200); break;
      case 'drop': for (let i = 0; i < Math.min(k, 4); i++) this.tone(440 + i * 90, 0.08, 'triangle', 0.25, -60, i * 0.06); break;
      case 'bad': this.tone(260, 0.14, 'square', 0.12, -80); break;
      case 'full': [784, 1046, 1318, 1568].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.3, 0, i * 0.05)); break;
      case 'reveal': this.tone(900, 0.12, 'sine', 0.22, 400); break;
      case 'unlock': [660, 880, 1175].forEach((f, i) => this.tone(f, 0.14, 'sine', 0.3, 0, i * 0.07)); break;
      case 'hint': this.tone(1200, 0.2, 'sine', 0.25, 300); break;
      case 'undo': this.tone(700, 0.1, 'triangle', 0.22, -300); break;
      case 'add': [523, 784].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.3, 0, i * 0.08)); break;
      case 'clear': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.22, 'square', 0.16, 0, i * 0.11)); break;
      case 'ui': this.tone(700, 0.06, 'triangle', 0.25); break;
    }
  },
  // 산뜻한 오르골 곡
  mel: [76, 79, 84, 79, 81, 0, 79, 0, 77, 76, 74, 76, 72, 0, 0, 0, 74, 77, 81, 77, 79, 0, 76, 0, 74, 72, 71, 74, 72, 0, 0, 0],
  bass: [48, 45, 41, 43, 48, 45, 43, 48],
  startBgm() {
    if (this.bgmOn || !this.ctx) { this.bgmOn = true; return; }
    this.bgmOn = true; this.next = this.ctx.currentTime + 0.1; clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (!this.ctx || !this.bgmOn) return;
      const sd = 60 / 104 / 2, mf = (n) => 440 * Math.pow(2, (n - 69) / 12);
      if (this.next < this.ctx.currentTime - 0.1) this.next = this.ctx.currentTime + 0.05;
      while (this.next < this.ctx.currentTime + 0.2) {
        const w = this.next - this.ctx.currentTime, m = this.mel[this.step % 32];
        if (m) this.tone(mf(m), sd * 1.4, 'sine', 0.3, 0, w, this.bgm);
        if (this.step % 4 === 0) this.tone(mf(this.bass[(this.step / 4) % 8]), sd * 3.5, 'triangle', 0.4, 0, w, this.bgm);
        this.next += sd; this.step++;
      }
    }, 40);
  },
  stopBgm() { this.bgmOn = false; clearInterval(this.timer); this.timer = null; },
};

// ---------- 규칙 (tools/giftsort_levels.mjs 와 같음) ----------
// 카트: { b: [선물 번호, 아래→위], h: [숨김 여부] }. 리본 카트는 G.lock (풀리기 전엔 넣고 뺄 수 없음)
// 카트: { b, h, cap } — cap 은 보통 4, '카트 추가'로 놓은 작은 카트는 1 (끝날 때 비어 있어야 함)
const capOf = (c) => c.cap || CAP;
const isFull = (c) => c.b.length === CAP && c.b.every((x) => x === c.b[0]);
// 맨 위에 붙어 있는 같은 상자 수 (숨긴 상자에서 멈춤 — 깜짝 상자는 보이기 전엔 같이 안 움직임)
function topRun(c) { const b = c.b; let n = 1; while (n < b.length && b[b.length - 1 - n] === b[b.length - 1] && !c.h[b.length - 1 - n]) n++; return n; }
const locked = (i) => i === G.lock && G.done < G.need;
function canMove(a, b) {
  if (a === b) return false;
  const A = G.carts[a], B = G.carts[b];
  if (!A.b.length || isFull(A) || B.b.length >= capOf(B) || locked(a) || locked(b)) return false;
  return !B.b.length || B.b[B.b.length - 1] === A.b[A.b.length - 1];
}
const anyMove = () => G.carts.some((_, a) => G.carts.some((__, b) => canMove(a, b) && !(G.carts[b].b.length === 0 && topRun(G.carts[a]) === G.carts[a].b.length)));
const solvedAll = () => G.carts.every((c) => !c.b.length || isFull(c));

// 힌트용 풀이 (판 만들 때와 같은 깊이 우선, 숨긴 상자도 아는 상태로). 첫 수 [a, b] 를 돌려줌
function hintMove() {
  const S0 = { c: G.carts.map((c) => c.b.slice()), done: G.done }, caps = G.carts.map(capOf);
  const full = (t) => t.length === CAP && t.every((x) => x === t[0]);
  const run = (t) => { let n = 1; while (n < t.length && t[t.length - 1 - n] === t[t.length - 1]) n++; return n; };
  const lk = (s, i) => i === G.lock && s.done < G.need;
  const ok = (s, a, b) => {
    const A = s.c[a], B = s.c[b];
    if (a === b || !A.length || full(A) || B.length >= caps[b] || lk(s, a) || lk(s, b)) return false;
    if (B.length && B[B.length - 1] !== A[A.length - 1]) return false;
    return !(!B.length && run(A) === A.length);
  };
  const mv = (s, a, b) => { const c = s.c.map((t) => t.slice()), n = Math.min(run(c[a]), caps[b] - c[b].length); for (let i = 0; i < n; i++) c[b].push(c[a].pop()); return { c, done: c.filter(full).length }; };
  const key = (s) => (s.done >= G.need ? 'o|' : 'c|') + s.c.map((t, i) => (lk(s, i) ? '#' : '') + caps[i] + ':' + t.join('.')).sort().join(',');
  // 지난번 힌트의 풀이를 그대로 따라오는 중이면 그 다음 수 (힌트를 여러 번 눌러도 왔다 갔다 하지 않게)
  const raw = (s) => s.c.map((t, i) => caps[i] + ':' + t.join('.')).join(',') + '|' + s.done;
  if (G.plan) { const j = G.plan.raws.indexOf(raw(S0)); if (j >= 0) return G.plan.path[j]; }
  const seen = new Set([key(S0)]); let nodes = 0;
  function dfs(s) {
    if (s.c.every((t) => !t.length || full(t))) return true;
    if (++nodes > 60000) return false;
    const list = [];
    for (let a = 0; a < s.c.length; a++) for (let b = 0; b < s.c.length; b++) if (ok(s, a, b)) {
      const B = s.c[b]; let sc = B.length ? 10 + B.length : 0; if (B.length && run(s.c[a]) + B.length === CAP && B.every((x) => x === B[0])) sc += 20;
      list.push([sc, a, b]);
    }
    list.sort((x, y) => y[0] - x[0]);
    for (const [, a, b] of list) { const n = mv(s, a, b), k = key(n); if (seen.has(k)) continue; seen.add(k); if (dfs(n)) { path.unshift([a, b]); raws.unshift(raw(s)); return true; } }
    return false;
  }
  const path = [], raws = [];
  if (!dfs(S0)) { G.plan = null; return null; }
  G.plan = { path, raws }; return path[0];
}

// ---------- state ----------
const bgCv = $('bg'), bg = bgCv.getContext('2d'), fxCv = $('fx'), fx = fxCv.getContext('2d'), root = $('root'), boardEl = $('board'), hero = $('hero');
let scale = 1, dpr = 1;
// 상태: ready → play → done(클리어 연출) → result / pause
const G = {
  state: 'ready', si: 0, carts: [], lock: -1, need: 0, done: 0, gold: -1, sel: -1, moves: 0, hist: [], coins: 0, coinBase: 0,
  undo: 0, hint: 0, add: 0, flights: [], fx: [], t: 0, idleT: 0, pausedFrom: 'play', geo: null,
};

// ---------- board ----------
function buildBoard(si) {
  const st = STAGES[si];
  G.carts = st.carts.map((s, i) => ({ b: s.split('').map((ch) => ch.charCodeAt(0) - 97), h: s.split('').map((_, k) => k < st.hid[i]) }));
  G.lock = st.lock; G.need = st.need; G.done = 0; G.gold = st.gold ? st.gold.charCodeAt(0) - 97 : -1; G.sel = -1; G.unlockedShown = false;
  boardEl.innerHTML = ''; G.els = [];
  layoutBoard(); render(true);
}
// 카트 그림(cart.webp 300x924) 안 상자 자리: 아래 선반 높이, 상자 한 칸 높이 (카트 높이 비율), 상자 폭 (카트 폭 비율)
//  상자가 잘 보이게 상자를 카트 폭의 80% 로 크게 하고, 카트 그림은 위아래로 늘려서(높이 = 폭 × CH_K) 상자 4개가 들어가게
//  1칸 카트(cart_one.webp 300x487): 위 손잡이~첫 칸 + 선반·바퀴, 선반 높이 281/487
const CH_K = 3.9, SHELF = 0.778, PITCH = 0.158, BOX_W = 0.8, BOX_AR = 232 / 240, ONE_H = 487 / 924, ONE_SHELF = 281 / 487;
function boardArea() {
  const v = (k) => parseFloat(getComputedStyle(root).getPropertyValue('--safe-' + k)) || 0;
  if (wideLayout()) return { x: 112 + v('l'), y: 64 + v('t'), w: W - 112 - 16 - v('l') - v('r'), h: H - 64 - 12 - v('t') - v('b') };
  return { x: 8, y: 112 + v('t'), w: W - 16, h: H - 112 - 150 - v('t') - v('b') };
}
// 캐릭터 자리: 왼쪽 아래, 배경 바로 위 층 (카트·버튼이 겹치면 캐릭터가 뒤로)
function heroBox() {
  const v = (k) => parseFloat(getComputedStyle(root).getPropertyValue('--safe-' + k)) || 0;
  if (wideLayout()) { const h = Math.min(330, H * 0.62); return { x: 4 + v('l'), y: H - h - v('b'), w: h * 460 / 600, h }; }
  const h = clamp(H * 0.25, 220, 300); return { x: -6, y: H - h - 96 - v('b'), w: h * 460 / 600, h };
}
function layoutBoard() {
  const n = G.carts.length; if (!n) return;
  const a = boardArea(); let best = null;
  for (let r = 1; r <= 3; r++) {
    const c = Math.ceil(n / r); if (r > 1 && c * (r - 1) >= n) continue;
    // 줄마다: 카트 높이 + 들린 상자 자리(0.2) + 줄 사이 틈
    const cw = Math.min(a.w / (c + (c - 1) * 0.3), a.h / ((r * 1.18 - 0.02) * CH_K));
    if (!best || cw > best.cw + 0.5) best = { r, c, cw };
  }
  const cw = Math.min(best.cw, wideLayout() ? 120 : 140), ch = cw * CH_K, gx = cw * 0.3, rowH = ch * 1.18;
  const { r, c } = best, th = r * rowH - ch * 0.18 + ch * 0.16;
  const oy = a.y + (a.h - th) / 2 + ch * 0.16;
  G.geo = { cw, ch, pos: [] };
  for (let k = 0; k < n; k++) {
    const row = Math.floor(k / c), inRow = row === r - 1 ? n - row * c : c, col = k - row * c;
    const tw = inRow * cw + (inRow - 1) * gx, ox = a.x + (a.w - tw) / 2;
    G.geo.pos.push([ox + col * (cw + gx), oy + row * rowH]);
  }
  // 카트 자리 아래 옅은 받침 (상자가 배경과 섞이지 않게). 카트 층(#board) 맨 아래에 두어 캐릭터보다 위
  let pn = $('boardPanel'); if (!pn) { pn = document.createElement('div'); pn.id = 'boardPanel'; boardEl.prepend(pn); }
  const xs = G.geo.pos.map((p) => p[0]), ys = G.geo.pos.map((p) => p[1]), pad = cw * 0.28;
  const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - ch * 0.17, x1 = Math.max(...xs) + cw + pad, y1 = Math.max(...ys) + ch + pad * 0.5;
  Object.assign(pn.style, { left: x0 + 'px', top: y0 + 'px', width: x1 - x0 + 'px', height: y1 - y0 + 'px' });
  placeHero();
}
function placeHero() {
  const b = heroBox(); hero.style.left = b.x + 'px'; hero.style.top = b.y + 'px'; hero.style.width = b.w + 'px'; hero.style.height = b.h + 'px';
}
// 상자 자리 (카트 칸 안 좌표). 1칸 카트는 카트 칸 아래쪽에 짧은 그림을 붙여 놓음
const cartTop = (c) => (capOf(c) < CAP ? G.geo.ch * (1 - ONE_H) : 0);
const boxGeo = (i, c) => {
  const { cw, ch } = G.geo, bw = cw * BOX_W, bh = bw * BOX_AR, shelf = c && capOf(c) < CAP ? cartTop(c) + ch * ONE_H * ONE_SHELF : ch * SHELF;
  return { x: (cw - bw) / 2, y: shelf - bh - i * ch * PITCH, w: bw, h: bh };
};
function giftImg(c, k) { return c.h[k] ? 'mystery' : c.b[k] === G.gold ? 'gold' : GIFTS[c.b[k]]; }
// 카트들을 다시 그림 (상자 수가 적어 매번 새로 그려도 가벼움)
function render(deal = false) {
  const { cw, ch, pos } = G.geo;
  while (G.els.length < G.carts.length) {
    const i = G.els.length, el = document.createElement('div'); el.className = 'cart';
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); Audio.unlock(); tap(i); });
    boardEl.appendChild(el); G.els.push(el);
  }
  G.carts.forEach((c, i) => {
    const el = G.els[i], [x, y] = pos[i], lk = locked(i), full = isFull(c);
    el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = cw + 'px'; el.style.height = ch + 'px';
    el.className = 'cart' + (deal ? ' deal' : '') + (i === G.sel ? ' sel' : '') + (full ? ' full' : '');
    if (deal) el.style.animationDelay = `${i * 0.04}s`;
    const run = i === G.sel ? topRun(c) : 0;
    const one = capOf(c) < CAP, ft = cartTop(c);
    let html = `<img class="frame" src="assets/ui/${lk ? 'cart_lock' : one ? 'cart_one' : 'cart'}.webp?v=${ASSET_V}" alt="" style="top:${ft}px;height:${ch - ft}px">`;
    c.b.forEach((_, k) => {
      const g = boxGeo(k, c), lift = k >= c.b.length - run, flying = G.flights.some((m) => m.b === i && m.ks.includes(k));
      html += `<div class="box${lift ? ' lift' : ''}" data-k="${k}" style="left:${g.x}px;top:${g.y}px;width:${g.w}px;z-index:${k + 1}${flying ? ';visibility:hidden' : ''}"><img src="${giftSrc(giftImg(c, k))}" alt=""></div>`;
    });
    if (full) { const tw = cw * 1.05; html += `<img class="topper" src="assets/ui/topper.webp?v=${ASSET_V}" alt="" style="width:${tw}px;top:${boxGeo(CAP - 1, c).y - tw * 0.5}px;z-index:9">`; }
    if (lk) html += `<span class="need" style="top:${ch * 0.42}px">🎀 ${G.need - G.done}</span>`;
    el.innerHTML = html;
  });
}

// ---------- run ----------
function startStage(si) {
  G.si = si; const st = STAGES[si];
  clearTimers();
  G.moves = 0; G.hist = []; G.coins = 0; G.coinBase = 0; G.fx = []; G.t = 0; G.idleT = 0; G.plan = null; dropFlights();
  takeRound('giftsort', ['hint', 'undo', 'addcart']);
  const R = G.round || {};
  G.undo = UNDO_FREE + (R.undo ? UNDO_ITEM : 0); G.hint = HINT_FREE + (R.hint || 0); G.add = R.addcart || 0;
  $('hudStage').textContent = isHard(si) ? label(si) : `스테이지 ${label(si)}`;
  G.lim = starLimits(st.par);
  buildBoard(si);
  setPose('idle'); hero.classList.remove('hidden');
  renderItems();
  setState('play');
  Audio.startBgm();
  // 처음 배우는 판: 하는 법 안내 (처음 판·특수 선물이 처음 나오는 판)
  const tip = coachTip(si);
  if (tip) later(() => toast(tip, 3600), 700);
}
function coachTip(si) {
  const st = STAGES[si], prev = STAGES[si - 1];
  if (si === 0) return '카트를 눌러 선물을 들고, 같은 선물 위나 빈 카트를 눌러 옮겨요!';
  if (st.hid.some((x) => x) && !(prev && prev.hid.some((x) => x)) && si < HARD) return '물음표 상자는 맨 위가 되면 무슨 선물인지 보여요!';
  if (st.lock >= 0 && !(prev && prev.lock >= 0) && si < HARD) return '리본 카트는 다른 카트를 하나 완성하면 풀려요!';
  return '';
}
function showReady(si) {
  G.si = si; clearTimers(); dropFlights(); boardEl.innerHTML = ''; G.carts = []; G.els = [];
  hero.classList.add('hidden');
  $('readyTitle').textContent = `${label(si)} ${stageName(si)}`;
  const st = STAGES[si], extra = [];
  if (st.hid.some((x) => x)) extra.push(tr('깜짝 상자'));
  if (st.lock >= 0) extra.push(tr('리본 카트'));
  if (st.gold) extra.push(tr('황금 선물'));
  $('readyInfo').textContent = `선물 ${st.colors}종류 · 카트 ${st.carts.length}대${extra.length ? ' · ' + extra.join(' · ') : ''}`;
  setState('ready');
}
let runId = 0;
const timers = [];
function later(fn, ms) { const id = runId; timers.push(setTimeout(() => { if (id === runId) fn(); }, ms)); }
function clearTimers() { runId++; timers.forEach(clearTimeout); timers.length = 0; }

function setPose(p, back = 0) {
  hero.onerror = () => { hero.onerror = null; hero.src = ME.src(p, ''); }; // 그림이 없는 옷은 기본 옷
  hero.src = ME.src(p);
  if (p !== 'idle') { hero.classList.remove('pop'); void hero.offsetWidth; hero.classList.add('pop'); }
  if (back) later(() => { if (G.state === 'play') setPose('idle'); }, back);
}
const bad = (i) => { const el = G.els[i]; el.classList.remove('bad'); void el.offsetWidth; el.classList.add('bad'); Audio.sfx('bad'); };

// 상자가 날아가는 중에도 다음 카트를 바로 누를 수 있음 (규칙 상태는 누른 순간 바뀌고, 날아가는 건 그림만)
function tap(i) {
  if (G.state !== 'play') return;
  G.idleT = 0; clearHint();
  const c = G.carts[i];
  if (locked(i)) { bad(i); toast(`카트를 ${G.need - G.done}대 더 완성하면 리본이 풀려요!`); if (G.sel >= 0) { G.sel = -1; render(); } return; }
  if (G.sel < 0) {
    if (!c.b.length || isFull(c)) return;
    G.sel = i; Audio.sfx('pick'); render(); return;
  }
  if (G.sel === i) { G.sel = -1; render(); return; }
  if (canMove(G.sel, i)) { move(G.sel, i); return; }
  // 못 놓는 곳: 상자가 있는 다른 카트면 그 카트를 새로 고름
  if (c.b.length && !isFull(c)) { G.sel = i; Audio.sfx('pick'); render(); return; }
  bad(i);
}
const snap = () => ({ carts: G.carts.map((c) => ({ b: c.b.slice(), h: c.h.slice(), cap: c.cap })), moves: G.moves, coins: G.coins, done: G.done });
function move(a, b) {
  G.hist.push(snap());
  const A = G.carts[a], B = G.carts[b], n = Math.min(topRun(A), capOf(B) - B.b.length);
  // 아직 날아오는 중인 상자를 다시 옮기면: 그 상자는 지금 자리에 내려놓은 것으로 하고 여기서 다시 날아감
  for (const m of G.flights.slice()) if (m.b === a && m.ks.some((k) => k >= A.b.length - n)) landNow(m, false);
  // 옮기는 상자가 날아가는 모습: 들린 자리 → 새 자리
  const from = [], pb = G.geo.pos[b];
  for (let k = 0; k < n; k++) {
    const src = A.b.length - 1 - k, el = G.els[a].querySelector(`.box[data-k="${src}"]`);
    if (el) { const r = el.getBoundingClientRect(), rr = root.getBoundingClientRect(); from.push({ x: (r.left - rr.left) / scale, y: (r.top - rr.top) / scale, img: giftImg(A, src), dst: B.b.length + k }); }
  }
  for (let k = 0; k < n; k++) { B.b.push(A.b.pop()); B.h.push(A.h.pop()); }
  // 맨 위가 된 깜짝 상자는 바로 포장이 풀림 (날아가는 걸 기다리지 않고 다음 수를 고를 수 있게)
  const rev = A.b.length > 0 && A.h[A.b.length - 1]; if (rev) A.h[A.b.length - 1] = false;
  G.sel = -1; G.moves++;
  // 날아오는 동안 새 자리의 상자는 숨겨 둠 (render 가 G.flights 를 보고 숨김)
  const m = { a, b, ks: from.map((f) => f.dst), fls: [], tid: 0, run: runId };
  G.flights.push(m);
  render();
  if (rev) popBox(a, A.b.length - 1);
  from.forEach((f, k) => {
    const g = boxGeo(f.dst, B), tx = pb[0] + g.x, ty = pb[1] + g.y, fl = document.createElement('div');
    fl.className = 'flyer'; fl.style.width = g.w + 'px'; fl.style.left = f.x + 'px'; fl.style.top = f.y + 'px'; fl.style.zIndex = 30 + k;
    fl.innerHTML = `<img src="${giftSrc(f.img)}" alt="">`; root.appendChild(fl); m.fls.push(fl);
    const top = Math.min(f.y, ty) - G.geo.ch * 0.15;
    const anim = fl.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${(tx - f.x) / 2}px, ${top - f.y}px)` }, { transform: `translate(${tx - f.x}px, ${ty - f.y}px)` }],
      { duration: 280 + k * 40, easing: 'ease-in-out' });
    anim.onfinish = () => { fl.remove(); };
  });
  m.tid = setTimeout(() => landNow(m, true), 300 + n * 40);
}
// 날던 상자가 내려앉음: 숨긴 상자를 보이고, 완성·깜짝 상자·클리어를 확인 (sound: 정상 도착일 때 소리)
function landNow(m, sound) {
  const i = G.flights.indexOf(m); if (i < 0) return;
  G.flights.splice(i, 1); clearTimeout(m.tid); m.fls.forEach((f) => f.remove());
  if (m.run !== runId) return;
  if (sound) Audio.sfx('drop', m.ks.length);
  afterMove(m.b);
}
const flushFlights = () => G.flights.slice().forEach((m) => landNow(m, false)); // 되돌리기·힌트·카트 추가 전에 모두 내려놓음
function dropFlights() { G.flights.forEach((m) => { clearTimeout(m.tid); m.fls.forEach((f) => f.remove()); }); G.flights = []; }
function afterMove(b) {
  const B = G.carts[b];
  // 완성: 이 카트로 날아오는 상자가 다 내려앉았을 때 한 번만 (빠르게 두 번 옮겨 채워도 코인은 한 번)
  if (isFull(B) && !B.scored && !G.flights.some((f) => f.b === b)) {
    B.scored = true; B.h = B.h.map(() => false);
    G.done = G.carts.filter(isFull).length;
    const gold = B.b[0] === G.gold;
    if (!GOD()) G.coins += gold ? GOLD_COIN : CART_COIN;
    render(); G.els[b].classList.add('done');
    const [x, y] = G.geo.pos[b]; burst(x + G.geo.cw / 2, y + G.geo.ch * 0.2, gold);
    G.fx.push({ kind: 'text', text: `+${gold ? GOLD_COIN : CART_COIN}`, x: x + G.geo.cw / 2, y: y - 6, t: 0, life: 0.9, gold });
    Audio.sfx('full'); setPose('happy', 900);
    if (G.lock >= 0 && !G.unlockedShown && G.done >= G.need) unlock();
  } else render();
  if (solvedAll() && !G.flights.length) { later(clearStage, 600); return; }
  if (!anyMove()) { setPose('think'); toast('더 옮길 수 없어요! 되돌리기나 다시하기를 눌러요'); }
  renderItems();
}
function popBox(i, k) {
  const el = G.els[i].querySelector(`.box[data-k="${k}"]`); if (el) el.classList.add('pop');
  Audio.sfx('reveal');
}
function unlock() {
  G.unlockedShown = true; render();
  const [x, y] = G.geo.pos[G.lock], fl = document.createElement('div'), w = G.geo.cw * 0.9;
  fl.className = 'flyer'; fl.style.width = w + 'px'; fl.style.left = x + (G.geo.cw - w) / 2 + 'px'; fl.style.top = y + G.geo.ch * 0.35 + 'px';
  fl.innerHTML = `<img src="${giftSrc('bow')}" alt="">`; root.appendChild(fl);
  fl.animate([{ transform: 'translateY(0) rotate(0) scale(1)', opacity: 1 }, { transform: `translateY(${-G.geo.ch * 0.6}px) rotate(25deg) scale(1.3)`, opacity: 0 }], { duration: 800, easing: 'ease-out' }).onfinish = () => fl.remove();
  Audio.sfx('unlock'); toast('리본이 풀렸어요! 이제 이 카트도 쓸 수 있어요');
}
function burst(x, y, gold) {
  for (let i = 0; i < 14; i++) {
    const an = Math.random() * Math.PI * 2, sp = 90 + Math.random() * 150;
    G.fx.push({ kind: 'spark', x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 80, im: gold ? FXI[i % 2 ? 4 : 5] : FXI[i % 6], r: 14 + Math.random() * 10, rot: Math.random() * 6, t: 0, life: 0.7 + Math.random() * 0.4 });
  }
}

// ---------- items ----------
// 되돌리기·카트 추가는 판마다 무료 / 힌트는 무료 1개 + 시작 팝업에서 고른 공통 '힌트' 아이템
function takeRound(game, ids) {
  G.round = {};
  if (!HUB) return;
  for (const id of ids) { if (HUB.isUsing(game, id)) { if (HUB.useBoost(game, id)) G.round[id] = 1; HUB.setUsing(game, id, false); } }
}
function useUndo() {
  if (G.state !== 'play') return;
  flushFlights();
  if (!G.hist.length) { toast('되돌릴 게 없어요'); return; }
  if (G.undo <= 0) { toast('되돌리기를 다 썼어요. 일시정지에서 다시하기를 해 볼까요?'); Audio.sfx('bad'); return; }
  const s = G.hist.pop();
  const added = G.carts.slice(s.carts.length).map((c) => ({ b: [], h: [], cap: c.cap }));
  G.carts = s.carts.concat(added); // 카트 추가로 늘린 카트는 그대로 (비운 채로)
  G.moves = s.moves; G.coins = s.coins; G.done = s.done; G.sel = -1; G.undo--;
  Audio.sfx('undo'); clearHint(); render(); renderItems(); setPose('idle');
}
let hintEls = [];
function clearHint() { hintEls.forEach((e) => e.classList.remove('hint')); hintEls = []; }
function useHint() {
  if (G.state !== 'play') return;
  flushFlights();
  if (G.hint <= 0) { toast('힌트가 없어요. 시작할 때 힌트 아이템을 고를 수 있어요'); Audio.sfx('bad'); return; }
  const m = hintMove();
  if (!m) { toast('이대로는 풀기 어려워요. 되돌리기를 해 봐요!'); setPose('think', 1500); Audio.sfx('bad'); return; }
  G.hint--; Audio.sfx('hint'); setPose('think', 1500); renderItems();
  G.sel = -1; render(); clearHint();
  hintEls = m.map((i) => G.els[i]); hintEls.forEach((e) => e.classList.add('hint'));
  later(clearHint, 2600);
}
function useAdd() {
  if (G.state !== 'play') return;
  flushFlights();
  if (G.add <= 0) { toast('카트 추가 아이템이 없어요. 시작할 때 고를 수 있어요'); Audio.sfx('bad'); return; }
  G.add--; G.carts.push({ b: [], h: [], cap: 1 }); G.sel = -1;
  Audio.sfx('add'); layoutBoard(); render(); renderItems();
  const el = G.els[G.els.length - 1]; el.classList.add('deal');
}

// ---------- end ----------
function stars() { const [t3, t2] = G.lim; return G.moves <= t3 ? 3 : G.moves <= t2 ? 2 : 1; }
function clearStage() {
  if (G.state !== 'play') return;
  setState('done'); Audio.sfx('clear'); Audio.stopBgm(); setPose('cheer');
  const st = stars();
  for (let i = 0; i < 50; i++) G.fx.push({ kind: 'confetti', x: Math.random() * W, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 80, vy: 120 + Math.random() * 160, im: FXI[i % 6], r: 16 + Math.random() * 10, rot: Math.random() * 6, t: 0, life: 3 });
  let earn = null, reward = [];
  if (HUB) {
    earn = HUB.record('giftsort', { stage: G.si, cleared: true, dist: 0, coins: G.coins - G.coinBase, stars: st });
    if (!earn.god && earn.firstClear) { HUB.addBoost('giftsort', 'hint', 1); reward.push('hint'); } // 처음 깬 판: 힌트 1개
  } else { Save.data.cleared[G.si] = true; Save.store(); }
  later(() => showResult(st, earn, reward), 1200);
}
function showResult(st, earn, reward = []) {
  $('resTitle').textContent = '스테이지 클리어!';
  document.querySelector('.panel.result').classList.remove('fail');
  $('resStars').innerHTML = [0, 1, 2].map((k) => `<span class="${k < st ? '' : 'off'}">★</span>`).join('');
  $('resMoves').textContent = `${G.moves}번`;
  $('resCarts').textContent = `${G.done}대`;
  $('resCoin').textContent = G.coins;
  $('resEarn').classList.toggle('hidden', !earn);
  if (earn) {
    $('resEarn').innerHTML = `+${earn.earned} 코인 획득!` + (earn.bonus ? ` <small>(클리어 보너스 +${earn.bonus}${earn.firstClear ? ', 첫 클리어!' : ''})</small>` : '') + `<small>내 코인 ${earn.coins}</small>`
      + (reward.length ? `<div class="reward">🎁 보상 아이템: 💡 힌트 +${reward.length}</div>` : '');
  }
  const hasNext = G.si % HARD < HARD - 1 && unlocked(G.si + 1);
  $('btnNext').classList.toggle('hidden', !hasNext);
  setState('result');
}

// ---------- update ----------
function step(dt) {
  G.t += dt;
  for (const f of G.fx) { f.t += dt; if (f.vx != null) { f.x += f.vx * dt; f.y += f.vy * dt; if (f.kind === 'spark') f.vy += 360 * dt; } }
  G.fx = G.fx.filter((f) => f.t < f.life);
  if (G.state !== 'play') return;
  // 한참 아무것도 안 하면 생각하는 얼굴
  G.idleT += dt;
  if (G.idleT > 12 && hero.src.indexOf('_idle') > 0) { setPose('think', 2500); G.idleT = 0; }
}

// ---------- render (배경 + 효과) ----------
function drawBg() {
  bg.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  const img = W > H ? BG.land : BG.port;
  if (img && img.complete && img.naturalWidth) {
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const bw = img.naturalWidth * s, bh = img.naturalHeight * s;
    bg.drawImage(img, (W - bw) / 2, (H - bh) * 0.6, bw, bh);
  } else { bg.fillStyle = '#F6D9C8'; bg.fillRect(0, 0, W, H); }
  const g = bg.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(90,40,60,.22)'); g.addColorStop(0.3, 'rgba(90,40,60,0)'); g.addColorStop(1, 'rgba(90,40,60,.18)');
  bg.fillStyle = g; bg.fillRect(0, 0, W, H);
}
const okImg = (im) => im && im.complete && im.naturalWidth > 0;
function drawFx() {
  fx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  fx.clearRect(0, 0, W, H);
  for (const f of G.fx) {
    const k = f.t / f.life;
    if (f.kind === 'spark' || f.kind === 'confetti') {
      fx.save(); fx.globalAlpha = f.kind === 'confetti' ? Math.min(1, (1 - k) * 2) : 1 - k; fx.translate(f.x, f.y); fx.rotate(f.rot + f.t * 4);
      const r = f.r * (f.kind === 'spark' ? 1 - k * 0.4 : 1);
      if (okImg(f.im)) fx.drawImage(f.im, -r / 2, -r / 2, r, r); else { fx.fillStyle = '#FFD34D'; fx.fillRect(-r / 3, -r / 3, r / 1.5, r / 1.5); }
      fx.restore(); continue;
    }
    if (f.kind === 'text') {
      fx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
      fx.font = '30px Jua, sans-serif'; fx.textAlign = 'center'; fx.textBaseline = 'middle';
      fx.lineWidth = 6; fx.strokeStyle = '#7A3E00'; fx.strokeText(f.text, f.x, f.y - k * 30);
      fx.fillStyle = f.gold ? '#FFE07A' : '#FFF4C2'; fx.fillText(f.text, f.x, f.y - k * 30);
      fx.globalAlpha = 1;
    }
  }
}

// ---------- HUD ----------
let lastKey = '';
function updateHud() {
  const left = G.carts.filter((c) => c.b.length && !isFull(c)).length;
  const key = `${G.moves}|${G.coins}|${left}`;
  if (key === lastKey) return;
  lastKey = key;
  $('hudMoves').textContent = G.moves; $('hudCoin').textContent = G.coins; $('hudLeft').textContent = left;
  const st = G.lim ? stars() : 3;
  document.querySelectorAll('#hudStars span').forEach((s, k) => s.classList.toggle('off', k >= st));
}
function renderItems() {
  const set = (id, cid, n) => { $(cid).textContent = n; $(id).classList.toggle('empty', n <= 0); };
  set('btnUndo', 'cUndo', G.undo); set('btnHint', 'cHint', G.hint); set('btnAdd', 'cAdd', G.add);
}
let toastT = 0;
function toast(t, ms = 1800) { const el = $('toast'); el.textContent = t; el.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.add('hidden'), ms); }

// ---------- screens ----------
function setState(s) {
  G.state = s;
  $('ready').classList.toggle('hidden', s !== 'ready');
  $('pause').classList.toggle('hidden', s !== 'pause');
  $('result').classList.toggle('hidden', s !== 'result');
  $('hud').classList.toggle('hidden', !['play', 'pause', 'done'].includes(s));
}
function pauseGame() { if (G.state === 'play') { G.pausedFrom = G.state; setState('pause'); Audio.stopBgm(); } }
function resumeGame() { if (G.state === 'pause') { Audio.unlock(); setState(G.pausedFrom); Audio.startBgm(); last = performance.now(); } }
function goMain() { clearTimers(); Audio.stopBgm(); location.href = '../index.html#lobby'; }
function goMap() {
  clearTimers(); Audio.stopBgm();
  try { const m = JSON.parse(localStorage.getItem('twin_gameland_mapmode') || '{}'); m.giftsort = isHard(G.si) ? 'hard' : 'easy'; localStorage.setItem('twin_gameland_mapmode', JSON.stringify(m)); } catch (e) { /* ignore */ }
  location.href = HUB ? '../index.html#map-giftsort' : '../index.html';
}

// ---------- input ----------
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
window.addEventListener('keydown', (e) => {
  Audio.unlock();
  if (e.code === 'KeyZ' || e.code === 'KeyU') useUndo(); else if (e.code === 'KeyH') useHint(); else if (e.code === 'KeyA') useAdd();
  else if (e.code === 'Escape' || e.code === 'KeyP') { if (G.state === 'play') pauseGame(); else if (G.state === 'pause') resumeGame(); }
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
$('btnUndo').addEventListener('click', () => { Audio.unlock(); useUndo(); });
$('btnHint').addEventListener('click', () => { Audio.unlock(); useHint(); });
$('btnAdd').addEventListener('click', () => { Audio.unlock(); useAdd(); });

// ---------- layout ----------
function wideLayout() { return W > H; }
function resize() {
  const vv = window.visualViewport;
  const vw = Math.round(vv ? vv.width : window.innerWidth), vh = Math.round(window.fullViewH ? fullViewH() : (vv ? vv.height : window.innerHeight));
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
  if (G.carts.length) { layoutBoard(); render(); } else placeHero();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now; if (dt > 0.05) dt = 0.05; if (dt < 0) dt = 0;
  step(dt);
  if (['play', 'done', 'pause'].includes(G.state)) updateHud();
  drawBg(); drawFx();
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
window.__giftsort = { G, startStage, STAGES, tap, useUndo, useHint, useAdd, hintMove, showResult, layoutBoard };
