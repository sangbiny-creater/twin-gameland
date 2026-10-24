'use strict';
// 사천성 스테이지 표 + "끝까지 풀 수 있는" 타일 배치 (게임과 Node 시험 스크립트가 같이 씀)
//  · 10개 월드 × 10판 = 100판 (1-1 ~ 10-10). 판 크기는 가로 8 × 세로 12 를 넘지 않음 (한 층)
//  · 판이 갈수록 크기·그림 종류가 늘고, 같은 그림 짝은 될 수 있으면 멀리 떨어뜨려 놓음
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
    const t = Math.min(24, 6 + Math.floor(i * 0.19)); // 그림 종류
    STAGES.push({ c, r, tiles: c * r, t });
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

  // ---------- 풀 수 있는 배치 만들기 ----------
  // 미리 풀어 보기: 아직 그림이 정해지지 않은 판에서, 지금 선으로 이을 수 있는 두 칸을 골라 없애기를
  // 끝까지 반복해 "푸는 순서"를 먼저 만들고, 그 순서의 짝마다 같은 그림을 붙임.
  // → 처음 판과 섞기 결과 모두 끝까지 풀리는 순서가 적어도 하나는 있음
  //  filled[y][x]: 타일이 있는 칸이면 true, pairTypes: 짝마다 그림 번호 → 반환: grid[y][x] = 그림 번호 / 빈 칸 -1 (실패하면 null)
  const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
  function deal(filled, pairTypes, rand = Math.random, maxTries = 300) {
    const R = filled.length, C = filled[0].length;
    const total = filled.reduce((s, row) => s + row.filter(Boolean).length, 0);
    if (total !== pairTypes.length * 2) return null;
    for (let tries = 0; tries < maxTries; tries++) {
      const cur = filled.map((row) => row.map((f) => (f ? 1 : 0)));
      const order = []; // 없앤 순서대로 [[x,y],[x,y]]
      let left = total;
      while (left > 0) {
        const cells = [];
        for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if (cur[y][x]) cells.push({ x, y, k: rand() });
        cells.sort((a, b) => b.k - a.k);
        let done = false;
        for (const p of cells) {
          const qs = reach(p.x, p.y, cur, C, R);
          if (!qs.length) continue;
          // 바로 옆 칸보다 멀리 떨어진 짝을 더 자주 고름 (붙어 있는 같은 그림이 많으면 너무 쉬움)
          let q = qs[0], qk = -1;
          for (const c of qs) { const d = Math.abs(c[0] - p.x) + Math.abs(c[1] - p.y); const k = rand() + (d > 1 ? 0.9 : 0); if (k > qk) { qk = k; q = c; } }
          cur[p.y][p.x] = 0; cur[q[1]][q[0]] = 0; left -= 2;
          order.push([[p.x, p.y], q]); done = true; break;
        }
        if (!done) break;
      }
      if (left > 0) continue;
      const types = pairTypes.slice();
      for (let a = types.length - 1; a > 0; a--) { const b = Math.floor(rand() * (a + 1)); [types[a], types[b]] = [types[b], types[a]]; }
      const grid = Array.from({ length: R }, () => new Array(C).fill(-1));
      order.forEach(([a, b], n) => { grid[a[1]][a[0]] = types[n]; grid[b[1]][b[0]] = types[n]; });
      return grid;
    }
    return null;
  }
  // (px,py) 타일에서 2번 이하로 꺾는 선으로 닿는 다른 타일들 (선은 빈 칸과 판 바깥 테두리만 지나감)
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
        if (nx >= 0 && ny >= 0 && nx < C && ny < R && cur[ny][nx]) { out.set(ny * C + nx, [nx, ny]); continue; }
        const k = ((ny + 1) * (C + 2) + (nx + 1)) * 4 + d2;
        if ((best.get(k) ?? 9) <= nt) continue;
        best.set(k, nt);
        if (nt === t) dq.unshift([nx, ny, d2, nt]); else dq.push([nx, ny, d2, nt]);
      }
    }
    return [...out.values()];
  }

  root.ShisenLevels = { WORLDS, PER_WORLD, STAGES, deal };
})(typeof window !== 'undefined' ? window : globalThis);
