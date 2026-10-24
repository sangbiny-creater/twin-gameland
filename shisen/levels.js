'use strict';
// 사천성 스테이지 표 + 층 쌓기 + "끝까지 풀 수 있는" 타일 배치 (게임과 Node 시험 스크립트가 같이 씀)
//  · 10개 월드 × 10판 = 100판 (1-1 ~ 10-10). 판 크기는 가로 8 × 세로 12 를 넘지 않음
//  · 1~2월드는 한 층, 3월드부터 가운데 등에 2층을 조금씩 늘려 쌓고, 10-6 ~ 10-10 에만 3층을 아주 조금
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
  const SHAPES = ['center', 'cross', 'corners', 'stripes', 'frame'];
  const L3 = { 95: 4, 96: 4, 97: 4, 98: 8, 99: 8 }; // 3층 타일 수 (10-6 ~ 10-10 만)

  const STAGES = [];
  for (let i = 0; i < WORLDS * PER_WORLD; i++) {
    const w = Math.floor(i / PER_WORLD), k = i % PER_WORLD;
    const [c, r] = (w === 0 ? BASE[0] : w === 1 ? BASE[1] : w <= 4 ? BASE.mid : w <= 6 ? BASE.late : [[8, 12]])[w <= 6 ? k : 0];
    // 2층 비율: 3-1 에서 10% → 10-10 에서 66%  (4칸씩 대칭으로 쌓으므로 4의 배수)
    const f = i < 20 ? 0 : 0.10 + 0.56 * (i - 20) / 79;
    const n2 = Math.round((c * r * f) / 4) * 4;
    const n3 = L3[i] || 0;
    const tiles = c * r + n2 + n3;
    const t = Math.min(24, 6 + Math.floor(i * 0.19)); // 그림 종류
    STAGES.push({ c, r, n2, n3, tiles, t, shape: SHAPES[k % SHAPES.length], layers: n3 ? 3 : n2 ? 2 : 1 });
  }
  // 제한 시간
  let t70 = 0;
  STAGES.forEach((st, i) => {
    if (i < 70) {
      const per = 6.3 - 2.3 * (i / 69) + (st.layers > 1 ? 0.25 : 0); // 타일당 초: 6.3 → 4.0 (층이 있으면 살짝 더)
      st.s = Math.round((st.tiles * per) / 5) * 5;
      if (i === 69) t70 = st.s;
    } else {
      st.s = Math.round(t70 * (0.985 - 0.0085 * (i - 70))); // 8-1 부터 판마다 약 0.85% 씩 짧아짐
    }
  });

  // 층 높이 지도 h[y][x] (1~3). 같은 판이면 언제나 같은 모양 (위아래·좌우 대칭)
  function heights(i) {
    const st = STAGES[i], { c, r } = st;
    const cx = (c - 1) / 2, cy = (r - 1) / 2;
    const score = (x, y) => {
      const dx = Math.abs(x - cx) / c, dy = Math.abs(y - cy) / r;
      switch (st.shape) {
        case 'cross': return Math.min(dx, dy) * 3 + (dx + dy) * 0.5;
        case 'corners': return Math.hypot(0.32 - dx, 0.3 - dy);
        case 'stripes': return (Math.floor(Math.abs(x - cx)) % 2) * 2 + dy + dx * 0.1;
        case 'frame': return Math.abs(Math.max(dx * 1.1, dy) - 0.25) + dx * 0.05;
        default: return dx * dx + dy * dy;
      }
    };
    // 대칭 묶음(4칸) 단위로 점수가 낮은 곳부터 쌓음
    const orbits = [];
    for (let y = 0; y < r / 2; y++) for (let x = 0; x < c / 2; x++) {
      orbits.push({ s: score(x, y), d: Math.hypot(x - cx, y - cy), cells: [[x, y], [c - 1 - x, y], [x, r - 1 - y], [c - 1 - x, r - 1 - y]] });
    }
    const h = Array.from({ length: r }, () => new Array(c).fill(1));
    const byScore = orbits.slice().sort((a, b) => a.s - b.s || a.d - b.d);
    const top2 = byScore.slice(0, st.n2 / 4);
    top2.forEach((o) => o.cells.forEach(([x, y]) => { h[y][x] = 2; }));
    top2.slice().sort((a, b) => a.d - b.d).slice(0, st.n3 / 4).forEach((o) => o.cells.forEach(([x, y]) => { h[y][x] = 3; }));
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
        tops.sort((a, b) => b.k - a.k); // 높이 쌓인 칸을 먼저 치우면 마지막에 한 칸에 둘이 겹쳐 남는 일이 없음
        let done = false;
        for (const p of tops) {
          const qs = reach(p.x, p.y, cur, C, R);
          if (!qs.length) continue;
          let q = qs[0], qk = -1;
          for (const c of qs) { const k = rand() + cur[c[1]][c[0]] * 0.7; if (k > qk) { qk = k; q = c; } }
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
