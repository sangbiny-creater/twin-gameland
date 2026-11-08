// 선물가게 정리 판 200개 만들기 — node tools/giftsort_levels.mjs  → giftsort/levels.js
//  · 난이도 사다리(사천성·메모리·두더지와 같음): 쉬움1 < 쉬움2 < 어려움1 < 쉬움3 < 어려움2 < … < 쉬움10 < 어려움9 < 어려움10
//    사다리 칸 × 10 + 판 = 난이도 g (0~199). 선물 종류·빈 카트·리본 카트·깜짝 상자를 g 로 정함 (g 가 커지면 늘 같거나 어려움)
//  · 판마다 섞은 뒤 컴퓨터가 끝까지 풀어 봄 → 풀리는 판만. 컴퓨터가 찾은 가장 짧은 풀이 횟수(par)가 앞 판보다 줄지 않게 고름
//  · 같은 결과가 나오게 씨앗(seed)을 고정한 난수
import { writeFileSync } from 'node:fs';

const CAP = 4, PER = 10;
const LADDER = ['e1', 'e2', 'h1', 'e3', 'h2', 'e4', 'h3', 'e5', 'h4', 'e6', 'h5', 'e7', 'h6', 'e8', 'h7', 'e9', 'h8', 'e10', 'h9', 'h10'];
const G_MAX = LADDER.length * PER - 1;
let seed = 20261108;
const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; // mulberry32
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- 난이도 g → 판 설정 ----------
const FIRST = [3, 3, 3, 4, 4, 4, 4, 4, 4, 4]; // 쉬움 1월드 (처음 배우는 판)
const COLOR_PTS = [[10, 5], [30, 6], [60, 7], [90, 8], [120, 9], [150, 10], [175, 11], [192, 12]];
function colorsAt(g) {
  if (g < 10) return FIRST[g];
  let c = 5; for (const [g0, n] of COLOR_PTS) if (g >= g0) c = n; return c;
}
function spec(g) {
  const colors = colorsAt(g);
  const lockNeed = g >= 70 ? 1 : 0; // 리본 카트: 다른 카트 1대를 완성하면 풀림 (빈 카트 1대 대신). 2대로 하면 12종류 판이 거의 안 풀림
  const empties = lockNeed ? 1 : 2;
  const hide = g < 30 ? 0 : Math.min(3, 1 + Math.floor((g - 30) / 60)); // 깜짝 상자: 카트마다 아래에서 몇 칸까지 숨기나 (1~3)
  const hideRate = g < 30 ? 0 : Math.min(0.85, 0.25 + (g - 30) / 200);   // 그중 몇 카트에 숨기나 (가장 어려운 판도 몇 카트는 다 보이게)
  const gold = g >= 50 && g % 3 === 1;                   // 황금 선물(보너스 코인, 난이도와 상관없음)
  return { colors, empties, lockNeed, hide, hideRate, gold };
}

// ---------- 규칙 (게임과 같음) ----------
// 상태: carts = 배열(아래→위 숫자), locked = 리본 카트 번호(-1), need, done = 완성한 카트 수
const full = (t) => t.length === CAP && t.every((x) => x === t[0]);
function topRun(t) { let n = 1; while (n < t.length && t[t.length - 1 - n] === t[t.length - 1]) n++; return n; }
function canMove(s, a, b) {
  if (a === b) return false;
  const A = s.carts[a], B = s.carts[b];
  if (!A.length || full(A) || B.length >= CAP) return false;
  if ((a === s.locked || b === s.locked) && s.done < s.need) return false;
  if (B.length && B[B.length - 1] !== A[A.length - 1]) return false;
  if (!B.length && topRun(A) === A.length) return false; // 한 종류만 든 카트를 빈 카트로 통째로 옮기는 건 쓸데없음
  return true;
}
function doMove(s, a, b) {
  const A = s.carts[a].slice(), B = s.carts[b].slice();
  const n = Math.min(topRun(A), CAP - B.length);
  for (let i = 0; i < n; i++) B.push(A.pop());
  const carts = s.carts.slice(); carts[a] = A; carts[b] = B;
  return { ...s, carts, done: carts.filter(full).length };
}
const solved = (s) => s.carts.every((t) => !t.length || full(t));
const keyOf = (s) => (s.done >= s.need ? 'o' : 'c' + s.carts[s.locked]?.join('')) + '|' + s.carts.map((t, i) => (i === s.locked && s.done < s.need ? '#' : '') + t.join('')).sort().join(',');

// 풀기: 깊이 우선 + 방문 기록, 좋은 수부터 (같은 색 위로 > 빈 카트로). 찾은 풀이 횟수를 돌려줌 (없으면 0)
function solve(s0, limit = 200000) {
  const seen = new Set(); let nodes = 0, best = 0;
  const st = [[s0, 0]];
  seen.add(keyOf(s0));
  // 반복 대신 재귀 (깊이는 수백 이하)
  function dfs(s, d) {
    if (solved(s)) { best = d; return true; }
    if (++nodes > limit) return false;
    const mv = [];
    for (let a = 0; a < s.carts.length; a++) for (let b = 0; b < s.carts.length; b++) if (canMove(s, a, b)) {
      const B = s.carts[b], A = s.carts[a];
      let sc = B.length ? 10 + B.length : 0;
      if (B.length && topRun(A) + B.length === CAP && B.every((x) => x === B[0])) sc += 20; // 카트 완성
      if (topRun(A) === A.length) sc -= 3;
      mv.push([sc + rnd(), a, b]);
    }
    mv.sort((x, y) => y[0] - x[0]);
    for (const [, a, b] of mv) {
      const n = doMove(s, a, b), k = keyOf(n);
      if (seen.has(k)) continue; seen.add(k);
      if (dfs(n, d + 1)) return true;
    }
    return false;
  }
  return dfs(s0, 0) ? best : 0;
}
// 빔 탐색: 한 수마다 '덜 섞인' 상태 B 개만 남기며 넓게 → 거의 가장 짧은 풀이 (판마다 같은 기준으로 비교할 수 있게)
function mess(s) {
  let h = 0; const seenTop = new Map();
  s.carts.forEach((t) => { for (let i = 1; i < t.length; i++) if (t[i] !== t[i - 1]) h++; if (t.length) seenTop.set(t[0], (seenTop.get(t[0]) || 0) + 1); });
  for (const n of seenTop.values()) h += n - 1; // 같은 선물이 여러 카트 바닥에 흩어져 있으면 더 섞인 것
  return h;
}
function beam(s0, B = 400, maxD = 200) {
  let layer = [s0]; const seen = new Set([keyOf(s0)]);
  for (let d = 0; d < maxD && layer.length; d++) {
    const next = [];
    for (const s of layer) for (let a = 0; a < s.carts.length; a++) for (let b = 0; b < s.carts.length; b++) if (canMove(s, a, b)) {
      const n = doMove(s, a, b); if (solved(n)) return d + 1;
      const k = keyOf(n); if (seen.has(k)) continue; seen.add(k); next.push([mess(n) - n.done * 2 + rnd() * 0.5, n]);
    }
    next.sort((x, y) => x[0] - y[0]); layer = next.slice(0, B).map((x) => x[1]);
  }
  return 0;
}
// 풀리는지는 깊이 우선으로 확인, 풀이 횟수(par)는 빔 탐색 (빔이 못 찾으면 깊이 우선 중 가장 짧은 것)
function par(s0) {
  let b = beam(s0);
  if (!b) for (let i = 0; i < 6; i++) { const n = solve(s0); if (n && (!b || n < b)) b = n; }
  return b;
}

function make(sp) {
  const n = sp.colors, kinds = shuffle([...Array(12).keys()]).slice(0, n);
  for (;;) {
    const boxes = shuffle(kinds.flatMap((k) => Array(CAP).fill(k)));
    const carts = []; for (let i = 0; i < n; i++) carts.push(boxes.slice(i * CAP, i * CAP + CAP));
    if (carts.some((t) => topRun(t) >= 3)) continue; // 처음부터 거의 다 모인 카트는 다시 섞음
    for (let i = 0; i < sp.empties; i++) carts.push([]);
    let locked = -1; if (sp.lockNeed) { carts.push([]); locked = carts.length - 1; }
    return { carts, locked, need: sp.lockNeed, done: 0, kinds };
  }
}

const out = [];
let prevPar = 0;
for (const mode of ['easy', 'hard']) for (let k = 0; k < 100; k++) {
  const w = Math.floor(k / PER), g = LADDER.indexOf((mode === 'easy' ? 'e' : 'h') + (w + 1)) * PER + k % PER;
  out.push({ mode, k, g });
}
// 난이도 순서대로: 설정(종류·빈 카트·리본·깜짝 상자)이 같은 판들을 한 묶음으로, 후보를 많이 만들어 par 가 앞 판 이상인 것만
//  골라 작은 것부터 차례로 놓음 → 판이 올라갈수록 par 가 절대 줄지 않음
const byG = out.slice().sort((a, b) => a.g - b.g);
const sig = (sp) => `${sp.colors}|${sp.empties}|${sp.lockNeed}`; // 깜짝 상자는 풀이 횟수와 상관없어서 묶음을 나누지 않음 (판마다 따로 늘어남)
const L = 'abcdefghijkl';
let groups = [];
for (const o of byG) { const sp = spec(o.g); const last = groups[groups.length - 1]; if (last && last.sig === sig(sp)) last.list.push(o); else groups.push({ sig: sig(sp), list: [o] }); }
for (const gr of groups) {
  const m = gr.list.length, sp0 = spec(gr.list[0].g), pool = [];
  for (let t = 0; t < m * 8 + 24 && (pool.length < m * 3 || t < m * 3); t++) {
    const s = make(sp0), p = par(s); if (p && p >= prevPar) pool.push({ s, p });
  }
  if (pool.length < m) throw new Error(`후보 부족 ${gr.sig} ${pool.length}/${m}`);
  pool.sort((x, y) => x.p - y.p);
  // 작은 쪽 2/3 안에서 고르게 (너무 어려운 후보만 몰리지 않게)
  const span = Math.max(m, Math.ceil(pool.length * 0.67));
  gr.list.forEach((o, i) => {
    const pick = pool[Math.floor(i * (span - 1) / Math.max(1, m - 1))] || pool[i], sp = spec(o.g);
    prevPar = Math.max(prevPar, pick.p);
    const hid = pick.s.carts.map((t) => (t.length && rnd() < sp.hideRate ? Math.min(sp.hide, t.length - 1) : 0));
    Object.assign(o, { c: sp.colors, carts: pick.s.carts.map((t) => t.map((x) => L[x]).join('')).join(','), lock: pick.s.locked, need: sp.lockNeed,
      hid: hid.join(''), gold: sp.gold ? L[pick.s.kinds[0]] : '', par: pick.p });
  });
  process.stdout.write(`[${gr.sig}] ${gr.list.map((o) => o.par).join(' ')}\n`);
}
console.log();

const rows = out.map((o) => `  [${o.g}, ${o.c}, '${o.carts}', ${o.lock}, ${o.need}, '${o.hid}', '${o.gold}', ${o.par}],`).join('\n');
writeFileSync(new URL('../giftsort/levels.js', import.meta.url), `'use strict';
// 선물가게 정리 스테이지 표 — tools/giftsort_levels.mjs 가 만듦 (손으로 고치지 말고 그 파일을 고쳐서 다시 만들기)
//  · 쉬움 100판(번호 0~99, 1-1 ~ 10-10) + 어려움 100판(100~199). 어려움 N월드는 쉬움 N월드를 다 깨면 열림
//  · 난이도 사다리(사천성·메모리·두더지와 같음): 쉬움1 < 쉬움2 < 어려움1 < 쉬움3 < … < 쉬움10 < 어려움9 < 어려움10 — 판이 올라갈수록 절대 쉬워지지 않음
//  · 한 줄 = [난이도 g, 선물 종류 수, 카트들(아래→위, a~l = 선물 12종), 리본 카트 번호(-1 없음), 리본이 풀리는 완성 수, 카트마다 아래에서 숨긴 칸 수(깜짝 상자), 황금 선물, 컴퓨터 풀이 횟수(par)]
//  · 모든 판은 컴퓨터가 끝까지 풀어 본 판. par 는 앞 판보다 줄지 않음 (별: par 에 가까울수록 많이)
(function (root) {
  const WORLDS = 10, PER_WORLD = 10, HARD = 100, CAP = ${CAP};
  const RAW = [
${rows}
  ];
  const STAGES = RAW.map(([g, colors, carts, lock, need, hid, gold, par], i) => ({ mode: i < HARD ? 'easy' : 'hard', g, colors, carts: carts.split(','), lock, need, hid: hid.split('').map(Number), gold, par }));
  const api = { WORLDS, PER_WORLD, HARD, CAP, STAGES };
  if (typeof module !== 'undefined') module.exports = api; else root.GiftLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
`);
console.log('giftsort/levels.js', out.length);
