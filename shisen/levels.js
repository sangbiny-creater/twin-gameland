'use strict';
// 사천성 스테이지 표 + 2층 타일 + "끝까지 풀 수 있는" 타일 배치 (게임과 Node 시험 스크립트가 같이 씀)
//  · 10개 월드 × 10판 = 100판 (1-1 ~ 10-10). 판 크기는 가로 8 × 세로 12 를 넘지 않음
//  · 1~2월드는 한 층. 3월드부터 1층 판 위에 2층 타일이 "드문드문" 올라감 (3-1 은 2개 → 10-10 은 20개)
//    - 2층 타일끼리는 서로 붙지 않음(대각선도 떨어짐). 1층을 덮는 판이 아니라 1층 위에 얹힌 몇 개의 타일
//    - 2층 타일의 짝은 1층에 있음 → 2층 타일과 1층 타일을 선으로 이어서 없앰. 2층 타일을 치우면 밑의 1층 타일을 고를 수 있음
//  · 제한 시간: 7-10 까지는 타일 수 × 타일당 시간(조금씩 줄어듦), 8-1 부터는 판마다 조금씩 짧아짐
(function (root) {
  const WORLDS = 10, PER_WORLD = 10;
  // 월드 안에서 판 크기 (가로칸 c × 세로칸 r, 폰 세로 기준)
  const BASE = {
    0: [[4, 6], [4, 6], [4, 8], [4, 8], [6, 6], [6, 6], [6, 8], [6, 8], [8, 8], [8, 8]],
    1: [[6, 8], [6, 8], [8, 8], [8, 8], [8, 8], [8, 10], [8, 10], [8, 10], [8, 12], [8, 12]],
    mid: [[6, 8], [6, 8], [8, 8], [8, 8], [8, 10], [8, 10], [8, 10], [8, 12], [8, 12], [8, 12]],
    late: [[8, 8], [8, 8], [8, 10], [8, 10], [8, 10], [8, 12], [8, 12], [8, 12], [8, 12], [8, 12]],
  };

  const STAGES = [];
  for (let i = 0; i < WORLDS * PER_WORLD; i++) {
    const w = Math.floor(i / PER_WORLD), k = i % PER_WORLD;
    const [c, r] = (w === 0 ? BASE[0] : w === 1 ? BASE[1] : w <= 4 ? BASE.mid : w <= 6 ? BASE.late : [[8, 12]])[w <= 6 ? k : 0];
    // 2층 타일 수: 3-1 에서 2개 → 10-10 에서 20개 (판이 작으면 그만큼 줄임: 칸 수의 1/5 까지)
    const n2 = i < 20 ? 0 : Math.min(2 + 2 * Math.floor(((i - 20) * 10) / 80), Math.floor((c * r) / 10) * 2);
    const tiles = c * r + n2;
    const t = Math.min(24, 6 + Math.floor(i * 0.19)); // 그림 종류
    STAGES.push({ c, r, n2, tiles, t, layers: n2 ? 2 : 1 });
  }
  // 제한 시간
  let t70 = 0;
  STAGES.forEach((st, i) => {
    if (i < 70) {
      const per = 6.3 - 2.3 * (i / 69); // 타일당 초: 6.3 → 4.0
      st.s = Math.round((st.tiles * per) / 5) * 5;
      if (i === 69) t70 = st.s;
    } else {
      st.s = Math.round(t70 * (0.985 - 0.0085 * (i - 70))); // 8-1 부터 판마다 약 0.85% 씩 짧아짐
    }
  });

  // 판마다 늘 같은 무작위 (같은 판이면 2층 자리가 언제나 같음)
  function seeded(n) {
    let a = (n * 2654435761) >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // 층 높이 지도 h[y][x] (1 또는 2). 2층 칸은 서로 8방향 모두 떨어지게 흩어 놓음
  function heights(i) {
    const st = STAGES[i], { c, r } = st, rand = seeded(i + 1);
    const h = Array.from({ length: r }, () => new Array(c).fill(1));
    const cells = [];
    for (let y = 0; y < r; y++) for (let x = 0; x < c; x++) cells.push([x, y]);
    for (let a = cells.length - 1; a > 0; a--) { const b = Math.floor(rand() * (a + 1)); [cells[a], cells[b]] = [cells[b], cells[a]]; }
    let n = 0;
    for (const [x, y] of cells) {
      if (n >= st.n2) break;
      let near = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (h[y + dy] && h[y + dy][x + dx] === 2) near = true;
      if (!near) { h[y][x] = 2; n++; }
    }
    return h;
  }

  // ---------- 풀 수 있는 배치 만들기 ----------
  // 미리 풀어 보기: 아직 그림이 정해지지 않은 꽉 찬 판에서, 지금 선으로 이을 수 있는 맨 위 타일 두 개를 골라 없애기를
  // 끝까지 반복해 "푸는 순서"를 먼저 만들고, 그 순서의 짝마다 같은 그림을 붙임.
  // → 처음 판과 섞기 결과 모두 끝까지 풀리는 순서가 적어도 하나는 있음
  //  h[y][x]: 칸마다 쌓을 타일 수, pairTypes: 짝마다 그림 번호 → 반환: stk[y][x] = [아래 … 위] 그림 번호 (실패하면 null)
  const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
  function deal(h, pairTypes, rand = Math.random, maxTries = 300) {
    const R = h.length, C = h[0].length;
    const total = h.reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0);
    if (total !== pairTypes.length * 2) return null;
    for (let tries = 0; tries < maxTries; tries++) {
      const cur = h.map((row) => row.slice());
      const order = []; // 없앤 순서대로 [[x,y],[x,y]]
      let left = total;
      while (left > 0) {
        const tops = [];
        for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if (cur[y][x] > 0) tops.push({ x, y, k: rand() + cur[y][x] * 0.7 });
        tops.sort((a, b) => b.k - a.k); // 2층 타일을 먼저 치우는 순서로 만들어야 2층 타일 짝이 언제나 1층에 있음
        let done = false;
        for (const p of tops) {
          // 2층 타일의 짝은 언제나 1층 타일 (2층끼리는 짝을 만들지 않음)
          const qs = reach(p.x, p.y, cur, C, R).filter((c) => cur[p.y][p.x] < 2 || cur[c[1]][c[0]] < 2);
          if (!qs.length) continue;
          // 바로 옆 칸보다 멀리 떨어진 짝을 더 자주 고름 (붙어 있는 같은 그림이 많으면 너무 쉬움)
          let q = qs[0], qk = -1;
          for (const c of qs) { const d = Math.abs(c[0] - p.x) + Math.abs(c[1] - p.y); const k = rand() + (d > 1 ? 0.9 : 0) + cur[c[1]][c[0]] * 0.7; if (k > qk) { qk = k; q = c; } }
          cur[p.y][p.x]--; cur[q[1]][q[0]]--; left -= 2;
          order.push([[p.x, p.y], q]); done = true; break;
        }
        if (!done) break;
      }
      if (left > 0) continue;
      const types = pairTypes.slice();
      for (let a = types.length - 1; a > 0; a--) { const b = Math.floor(rand() * (a + 1)); [types[a], types[b]] = [types[b], types[a]]; }
      const stk = Array.from({ length: R }, () => Array.from({ length: C }, () => []));
      for (let n = order.length - 1; n >= 0; n--) { const [a, b] = order[n]; stk[a[1]][a[0]].push(types[n]); stk[b[1]][b[0]].push(types[n]); }
      return stk;
    }
    return null;
  }
  // (px,py) 의 맨 위 타일에서 2번 이하로 꺾는 선으로 닿는 다른 칸의 맨 위 타일들
  // 선은 빈 칸(cur=0)과 판 바깥 테두리만 지나감
  function reach(px, py, cur, C, R) {
    const best = new Map(), out = new Map();
    const dq = [];
    for (let d = 0; d < 4; d++) dq.push([px, py, d, 0]);
    while (dq.length) {
      const [x, y, d, t] = dq.shift();
      for (let d2 = 0; d2 < 4; d2++) {
        const nt = t + (d2 === d ? 0 : 1);
        if (nt > 2 || (x === px && y === py && d2 !== d)) continue;
        const nx = x + DX[d2], ny = y + DY[d2];
        if (nx < -1 || ny < -1 || nx > C || ny > R || (nx === px && ny === py)) continue;
        if (nx >= 0 && ny >= 0 && nx < C && ny < R && cur[ny][nx] > 0) { out.set(ny * C + nx, [nx, ny]); continue; }
        const k = ((ny + 1) * (C + 2) + (nx + 1)) * 4 + d2;
        if ((best.get(k) ?? 9) <= nt) continue;
        best.set(k, nt);
        if (nt === t) dq.unshift([nx, ny, d2, nt]); else dq.push([nx, ny, d2, nt]);
      }
    }
    return [...out.values()];
  }

  root.ShisenLevels = { WORLDS, PER_WORLD, STAGES, heights, deal };
})(typeof window !== 'undefined' ? window : globalThis);
