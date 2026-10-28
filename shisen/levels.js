'use strict';
// 사천성 스테이지 표 + 층(최대 3층) + 잇기 규칙 + "끝까지 풀 수 있는" 타일 배치 (게임과 Node 시험 스크립트가 같이 씀)
//  · 쉬움 100판(스테이지 번호 0~99, 1-1 ~ 10-10) + 어려움 100판(100~199, 어려움 1-1 ~ 10-10)
//    - 어려움 N월드는 쉬움 N월드(N-1 ~ N-10)를 다 깨면 열림. 어려움 안에서는 앞 판을 깨야 다음 판
//  · 판이 올라갈수록 절대 쉬워지지 않게: 1층 판 크기 · 2층 수 · 3층 수 · 타일 수 · 그림 종류는 줄지 않고, 타일당 시간은 늘지 않음
//    (8-1 부터는 제한 시간 자체도 판마다 조금씩 짧아짐). 1층 판은 가로 8 × 세로 12 를 넘지 않음
//  · 층: 다른 사천성·마작 솔리테어처럼 위층이 아래층보다 작게 피라미드로 쌓임
//    - 2층: 1층 판 둘레 한 줄은 비우고 그 안쪽에, 판마다 모양이 바뀜 (가운데 한 덩어리 · 위아래 쌍둥이 · 네 귀퉁이 · 십자 · 고리 · 좌우 쌍둥이 · 마름모 · 세 기둥)
//    - 3층: 2층 위에만 생김 (2층이 없는 칸에는 3층이 없음). 2층 덩어리 안쪽부터 쌓음
//    - 밑에 가려진 타일은 위 타일을 치워야 드러나서 고를 수 있음
//  · 잇기 규칙 (선은 2번까지 꺾임) — 사용자가 정한 2층 규칙을 3층까지 똑같이 넓힘
//    ① 같은 층 타일끼리: 그 층에서 이음. 그 층 타일만 길을 막고, 그 층 판 바깥은 빈 하늘이라 아래층 타일 위로 지나갈 수 있음
//       (1층끼리는 보통 사천성과 같음. 위층 밑에 가려진 타일도 길을 막음)
//    ② 다른 층 타일끼리: 위에서 봤을 때 바로 옆에 붙어 있으면 이을 수 있음
//    ③ 다른 층 타일끼리: 판 밖을 거쳐서 같은 층에 있는 것과 똑같이(선 2번까지 꺾임) 이어지면 이을 수 있음
//       — 판 안에서는 앞 타일 쪽 길은 그 타일 층에서, 판 밖으로 나간 뒤에는 상대 타일 층에서 막힘을 봄
//  · 쉬움·어려움 200판의 난이도는 한 줄 사다리(아래 LADDER)로 정함: 쉬움1 < 쉬움2 < 어려움1 < 쉬움3 < 어려움2 < … < 쉬움10 < 어려움9 < 어려움10
//    맨 끝(어려움 10-10)은 Onet 계열(Onet Puzzle: Tile Connect, 60판) 마지막보다 어렵게 (타일당 1.75초)
(function (root) {
  const WORLDS = 10, PER_WORLD = 10, HARD = 100, LAYERS = 3;
  const even = (v) => 2 * Math.round(v / 2);
  // 2층 모양 (판마다 차례로 바뀜)
  const SHAPES = ['center', 'twinV', 'quad', 'cross', 'ring', 'twinH', 'diamond', 'cols'];
  const SHAPE_NAME = { center: '가운데', twinV: '위아래 쌍둥이', quad: '네 귀퉁이', cross: '십자', ring: '고리', twinH: '좌우 쌍둥이', diamond: '마름모', cols: '세 기둥' };

  // ---------- 난이도 사다리 ----------
  // 쉬움·어려움 200판을 한 줄로 세운 난이도 순서 (월드 단위, 쉬운 것 → 어려운 것):
  //   쉬움1 · 쉬움2 · 어려움1 · 쉬움3 · 어려움2 · 쉬움4 · 어려움3 · 쉬움5 · 어려움4 · 쉬움6 · 어려움5 ·
  //   쉬움7 · 어려움6 · 쉬움8 · 어려움7 · 쉬움9 · 어려움8 · 쉬움10 · 어려움9 · 어려움10   (사용자가 정한 순서)
  //  → 사다리 칸 번호 0~19, 칸 안에서 10판. 난이도 g = 칸 번호 × 10 + 판 (0 ~ 199)
  const LADDER = ['e1', 'e2', 'h1', 'e3', 'h2', 'e4', 'h3', 'e5', 'h4', 'e6', 'h5', 'e7', 'h6', 'e8', 'h7', 'e9', 'h8', 'e10', 'h9', 'h10'];
  const rung = (mode, w) => LADDER.indexOf((mode === 'easy' ? 'e' : 'h') + (w + 1));
  // 난이도 g 하나로 판의 모든 값을 정함 (g 가 클수록 어려움, 어떤 값도 거꾸로 가지 않음)
  //  c×r 1층 크기, n2·n3 2·3층 타일 수, copies 그림 한 종류가 판에 몇 장(적을수록 짝 찾기 어려움),
  //  tough 처음 판에서 바로 이어지는 짝을 얼마나 피할지, per 타일당 초
  const G_MAX = LADDER.length * PER_WORLD - 1;
  function params(g) {
    const [c, r] = g < 2 ? [4, 6] : g < 4 ? [4, 8] : g < 6 ? [6, 6] : g < 9 ? [6, 8] : g < 12 ? [8, 8] : g < 16 ? [8, 10] : [8, 12];
    const n2 = g < 20 ? 0 : even(4 + 52 * (g - 20) / (G_MAX - 20));  // 4개 → 56개
    const n3 = g < 40 ? 0 : even(2 + 22 * (g - 40) / (G_MAX - 40));  // 2개 → 24개 (2층이 있어야 3층)
    const f = g / G_MAX;
    return { c, r, n2, n3, copies: 6 - 3.2 * f, tough: 0.8 + 5.2 * f, per: 4.6 - 2.85 * f };
  }
  const STAGES = [];
  for (const mode of ['easy', 'hard']) {
    const list = [];
    for (let k = 0; k < WORLDS * PER_WORLD; k++) {
      const g = rung(mode, Math.floor(k / PER_WORLD)) * PER_WORLD + k % PER_WORLD;
      const p = params(g);
      const tiles = p.c * p.r + p.n2 + p.n3;
      // 그림 종류: 그림 한 종류가 판에 몇 장 있는지(copies)로 정함 (6장 → 2.8장). 1-1 은 8종부터
      const t = Math.max(8, Math.ceil(tiles / p.copies));
      list.push({ mode, g, ...p, tiles, t, shape: SHAPES[k % SHAPES.length], layers: p.n3 ? 3 : p.n2 ? 2 : 1, s: Math.round(tiles * p.per) });
    }
    // 8-1 부터는 제한 시간 자체도 판마다 꼭 짧아지게 (앞 판보다 1초 이상)
    for (let k = 70; k < list.length; k++) list[k].s = Math.min(list[k].s, list[k - 1].s - 1);
    STAGES.push(...list);
  }

  // ---------- 층 모양 ----------
  // 칸마다 그 층에 타일이 있는지: occ[0] 1층(꽉 참), occ[1] 2층, occ[2] 3층 — 폰 세로 기준 [r][c], 좌우 대칭
  function occupancy(i) {
    const st = STAGES[i], { c, r } = st;
    const cx = (c - 1) / 2, cy = (r - 1) / 2, qx = (c - 1) * 0.25, qy = (r - 1) * 0.25;
    const A = Math.abs;
    const box = (x, y, bx, by, sx = 1, sy = 1) => Math.max(A(x - bx) * sx, A(y - by) * sy);
    const score = (x, y) => {
      switch (st.shape) {
        case 'twinV': return Math.min(box(x, y, cx, cy - qy, 1, 0.9), box(x, y, cx, cy + qy, 1, 0.9));
        case 'twinH': return Math.min(box(x, y, cx - qx, cy, 0.9, 0.6), box(x, y, cx + qx, cy, 0.9, 0.6));
        case 'quad': return Math.min(box(x, y, cx - qx, cy - qy), box(x, y, cx + qx, cy - qy), box(x, y, cx - qx, cy + qy), box(x, y, cx + qx, cy + qy));
        case 'cross': return Math.min(A(x - cx), A(y - cy) * 0.7) * 1.5 + Math.max(A(x - cx), A(y - cy) * 0.7) * 0.2;
        case 'ring': return A(Math.max(A(x - cx) / (c - 2), A(y - cy) / (r - 2)) - 0.32) * 10 + (A(x - cx) + A(y - cy)) * 0.01;
        case 'diamond': return A(x - cx) + A(y - cy) * 0.75;
        case 'cols': return Math.min(A(x - (cx - (c - 1) * 0.3)), A(x - cx), A(x - (cx + (c - 1) * 0.3))) * 2 + A(y - cy) * 0.12;
        default: return box(x, y, cx, cy, 1, 0.75);
      }
    };
    const occ = [0, 1, 2].map((z) => Array.from({ length: r }, () => new Array(c).fill(z === 0)));
    // 왼쪽 반의 안쪽 칸을 점수 순으로 골라 오른쪽 거울 칸과 함께 쌓음
    const pick = (cells, n, z) => {
      for (const [x, y] of cells.slice(0, n / 2)) { occ[z][y][x] = true; occ[z][y][c - 1 - x] = true; }
    };
    const left = [];
    for (let y = 1; y < r - 1; y++) for (let x = 1; x < c / 2; x++) left.push([x, y]);
    const tie = (a, b) => A(a[1] - cy) - A(b[1] - cy) || b[0] - a[0];
    pick(left.slice().sort((a, b) => score(...a) - score(...b) || tie(a, b)), st.n2, 1);
    // 3층: 2층 칸 중 둘레에 2층이 많은 (덩어리 안쪽) 칸부터 — 피라미드처럼
    const nb = (x, y) => { let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && occ[1][y + dy] && occ[1][y + dy][x + dx]) n++; return n; };
    const on2 = left.filter(([x, y]) => occ[1][y][x]);
    pick(on2.sort((a, b) => nb(...b) - nb(...a) || score(...a) - score(...b) || tie(a, b)), st.n3, 2);
    return occ;
  }

  // ---------- 잇기 ----------
  // 판 상태 b = { C, R, f: [f1, f2, f3] }: f[z-1][y][x] = z층 그림 번호 (없으면 -1)
  const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
  const inside = (b, x, y) => x >= 0 && y >= 0 && x < b.C && y < b.R;
  // 맨 위 타일이 몇 층인지 (0: 빈 칸)
  const topZ = (b, x, y) => { if (!inside(b, x, y)) return 0; for (let z = b.f.length; z >= 1; z--) if (b.f[z - 1][y][x] >= 0) return z; return 0; };
  const topType = (b, x, y) => { const z = topZ(b, x, y); return z ? b.f[z - 1][y][x] : -1; };
  // z층에서 그 칸이 막혀 있는지 (그 층 타일만 막음)
  const blocked = (b, z, x, y) => inside(b, x, y) && b.f[z - 1][y][x] >= 0;

  // a → t 2번 이하로 꺾는 길 (꺾이는 점들) 또는 null
  //  za === zb: 그 층에서 / za !== zb: 판 밖(테두리)에 한 번 나가야 하고, 나가기 전엔 za층, 나간 뒤엔 zb층에서 막힘을 봄
  function planePath(bd, za, a, t, zb = za) {
    const C = bd.C + 2, R = bd.R + 2;
    const key = (x, y, d, ph) => (((y + 1) * C + (x + 1)) * 4 + d) * 2 + ph;
    const out = (x, y) => x < 0 || y < 0 || x >= bd.C || y >= bd.R;
    const ph0 = za === zb ? 1 : 0; // 1 = 이제 zb층 (같은 층이면 처음부터)
    const cost = new Map(), prev = new Map(), dq = [];
    for (let d = 0; d < 4; d++) { cost.set(key(a.x, a.y, d, ph0), 0); dq.push([a.x, a.y, d, 0, ph0]); }
    while (dq.length) {
      const [x, y, d, c, ph] = dq.shift();
      if (c > (cost.get(key(x, y, d, ph)) ?? 9)) continue;
      const nx = x + DX[d], ny = y + DY[d];
      if (nx >= -1 && ny >= -1 && nx <= bd.C && ny <= bd.R) {
        const nph = ph || (out(nx, ny) ? 1 : 0);
        const hit = nx === t.x && ny === t.y && nph === 1;
        if (hit || !blocked(bd, nph ? zb : za, nx, ny)) {
          const k = key(nx, ny, d, nph);
          if (c < (cost.get(k) ?? 9)) {
            cost.set(k, c); prev.set(k, key(x, y, d, ph)); dq.unshift([nx, ny, d, c, nph]);
            if (hit) return corners(k, prev, C);
          }
        }
      }
      if (c < 2) for (let d2 = 0; d2 < 4; d2++) {
        if (d2 === d) continue;
        const k = key(x, y, d2, ph);
        if (c + 1 < (cost.get(k) ?? 9)) { cost.set(k, c + 1); prev.set(k, key(x, y, d, ph)); dq.push([x, y, d2, c + 1, ph]); }
      }
    }
    return null;
  }
  function corners(k, prev, C) {
    const pts = [];
    for (let cur = k; cur != null; cur = prev.get(cur)) {
      const cell = Math.floor(cur / 8), x = (cell % C) - 1, y = Math.floor(cell / C) - 1;
      const last = pts[pts.length - 1];
      if (!last || last.x !== x || last.y !== y) pts.push({ x, y });
    }
    pts.reverse();
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
      if ((b.x - a.x) * (c.y - b.y) !== (b.y - a.y) * (c.x - b.x)) out.push(b);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  // 두 맨 위 타일을 이을 수 있으면 선의 점들(a → b), 없으면 null
  function link(bd, a, b) {
    const za = topZ(bd, a.x, a.y), zb = topZ(bd, b.x, b.y);
    if (!za || !zb || (a.x === b.x && a.y === b.y)) return null;
    if (za === zb) return planePath(bd, za, a, b);                    // ① 같은 층
    if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1) return [a, b]; // ② 바로 옆
    return planePath(bd, za, a, b, zb);                                // ③ 판 밖을 거쳐 2번까지 꺾여 이어짐
  }
  // p 와 이을 수 있는 맨 위 타일 칸들 (그림은 보지 않음 — 배치 만들기용). 규칙은 link 와 같음
  function reach(bd, p) {
    const z = topZ(bd, p.x, p.y), out = new Map();
    const outside = (x, y) => x < 0 || y < 0 || x >= bd.C || y >= bd.R;
    for (let zb = 1; zb <= bd.f.length; zb++) {
      // zb층 맨 위 타일까지: 같은 층이면 그 층에서, 다른 층이면 판 밖을 한 번 거쳐서 (2번까지 꺾임)
      const ph0 = zb === z ? 1 : 0, best = new Map(), dq = [];
      for (let d = 0; d < 4; d++) dq.push([p.x, p.y, d, 0, ph0]);
      while (dq.length) {
        const [x, y, d, t, ph] = dq.shift();
        for (let d2 = 0; d2 < 4; d2++) {
          const nt = t + (d2 === d ? 0 : 1);
          if (nt > 2 || (x === p.x && y === p.y && d2 !== d)) continue;
          const nx = x + DX[d2], ny = y + DY[d2];
          if (nx < -1 || ny < -1 || nx > bd.C || ny > bd.R || (nx === p.x && ny === p.y)) continue;
          const nph = ph || (outside(nx, ny) ? 1 : 0), pz = nph ? zb : z;
          if (blocked(bd, pz, nx, ny)) { if (nph && topZ(bd, nx, ny) === zb) out.set(ny * bd.C + nx, { x: nx, y: ny }); continue; }
          const k = ((((ny + 1) * (bd.C + 2) + (nx + 1)) * 4 + d2) * 2) + nph;
          if ((best.get(k) ?? 9) <= nt) continue;
          best.set(k, nt);
          if (nt === t) dq.unshift([nx, ny, d2, nt, nph]); else dq.push([nx, ny, d2, nt, nph]);
        }
      }
    }
    // 다른 층 바로 옆
    for (let d = 0; d < 4; d++) {
      const x = p.x + DX[d], y = p.y + DY[d], oz = topZ(bd, x, y);
      if (oz && oz !== z) out.set(y * bd.C + x, { x, y });
    }
    return [...out.values()];
  }

  // ---------- 풀 수 있는 배치 만들기 ----------
  // 미리 풀어 보기: 그림이 정해지지 않은 판에서, 지금 이을 수 있는 맨 위 타일 두 개를 골라 없애기를 끝까지 반복해
  // "푸는 순서"를 먼저 만들고, 그 순서의 짝마다 같은 그림을 붙임 → 처음 판과 섞기 결과 모두 끝까지 풀리는 순서가 적어도 하나는 있음
  //  · 위층 타일을 먼저, 같은 층 짝을 더 자주, 멀리 떨어진 짝을 더 자주 고름 (위층부터 푸는 느낌 + 너무 쉽지 않게)
  //  · tough: 처음 판에서 바로 이어지는 짝을 얼마나 피할지 (클수록 다른 타일을 치워야 이어지는 짝이 많아져 어려움)
  //  occ[z-1][y][x]: z층에 타일이 있으면 true, pairTypes: 짝마다 그림 번호 → f: [f1, f2, f3] (실패하면 null)
  function deal(occ, pairTypes, tough = 1, rand = Math.random, maxTries = 300) {
    const R = occ[0].length, C = occ[0][0].length;
    let total = 0;
    occ.forEach((g) => g.forEach((row) => row.forEach((o) => { if (o) total++; })));
    if (total !== pairTypes.length * 2) return null;
    for (let tries = 0; tries < maxTries; tries++) {
      const bd = { C, R, f: occ.map((g) => g.map((row) => row.map((o) => (o ? 0 : -1)))) };
      const init = { C, R, f: bd.f.map((g) => g.map((row) => row.slice())) };
      const linkedAtStart = (p, pz, q, qz) => topZ(init, p.x, p.y) === pz && topZ(init, q.x, q.y) === qz && !!link(init, p, q);
      const order = []; // 없앤 순서대로 [[x,y,z],[x,y,z]]
      let left = total;
      while (left > 0) {
        const tops = [];
        for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) { const z = topZ(bd, x, y); if (z) tops.push({ x, y, z, k: rand() + (z - 1) * 1.2 }); }
        tops.sort((a, b) => b.k - a.k);
        let done = false;
        for (const p of tops) {
          const qs = reach(bd, p);
          if (!qs.length) continue;
          let q = qs[0], qk = -1;
          for (const c of qs) {
            const d = Math.abs(c.x - p.x) + Math.abs(c.y - p.y);
            const cz = topZ(bd, c.x, c.y);
            const k = rand() + (d > 1 ? 0.9 : 0) + (cz === p.z ? 0.8 : 0) + (tough && !linkedAtStart(p, p.z, c, cz) ? tough : 0);
            if (k > qk) { qk = k; q = c; }
          }
          const qz = topZ(bd, q.x, q.y);
          order.push([[p.x, p.y, p.z], [q.x, q.y, qz]]);
          bd.f[p.z - 1][p.y][p.x] = -1; bd.f[qz - 1][q.y][q.x] = -1;
          left -= 2; done = true; break;
        }
        if (!done) break;
      }
      if (left > 0) continue;
      const types = pairTypes.slice();
      for (let a = types.length - 1; a > 0; a--) { const b = Math.floor(rand() * (a + 1)); [types[a], types[b]] = [types[b], types[a]]; }
      const f = occ.map((g) => g.map((row) => row.map(() => -1)));
      order.forEach((pair, n) => pair.forEach(([x, y, z]) => { f[z - 1][y][x] = types[n]; }));
      return f;
    }
    return null;
  }

  root.ShisenLevels = { WORLDS, PER_WORLD, HARD, LAYERS, STAGES, SHAPE_NAME, occupancy, deal, link, topZ, topType };
})(typeof window !== 'undefined' ? window : globalThis);
