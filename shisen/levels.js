'use strict';
// 사천성 스테이지 표 + 2층 판 + 잇기 규칙 + "끝까지 풀 수 있는" 타일 배치 (게임과 Node 시험 스크립트가 같이 씀)
//  · 10개 월드 × 10판 = 100판 (1-1 ~ 10-10). 1층 판은 가로 8 × 세로 12 를 넘지 않음
//  · 3월드부터 1층 판 가운데에 작은 2층 판이 얹힘 (3-1 은 2×2 = 4개 → 10-10 은 6×8 = 48개). 2층 밑의 1층 타일은 가려져 있고,
//    위의 2층 타일을 치우면 드러나서 고를 수 있음
//  · 잇기 규칙 (선은 2번까지 꺾임)
//    ① 2층 타일끼리: 2층에서 이음. 2층 타일만 길을 막고, 2층 판 바깥은 빈 하늘이라 지나갈 수 있음 (1층 타일 위로 지나감)
//    ② 1층 타일끼리: 1층에서 이음 (보통 사천성과 같음. 2층 밑에 가려진 1층 타일도 길을 막음)
//    ③ 2층 타일 ↔ 1층 타일: 위에서 봤을 때 바로 옆에 붙어 있으면 이을 수 있음
//    ④ 2층 타일 ↔ 1층 타일: 2층 타일이 2층에서 옆으로 곧장 나갈 수 있고, 1층 타일도 1층에서 판 밖으로 곧장 나갈 수 있으면
//       판 바깥을 돌아서 이을 수 있음
//  · 난이도는 Onet 계열(Onet Puzzle: Tile Connect, 60판) 마지막 수준에 10-10 이 닿게 맞춤 (중력은 쓰지 않음)
//    - Onet: 큰 판 약 144개 타일을 최대 5분, 그림 약 36~40종 → 10-10: 144개 · 5:00 · 36종
//  · 제한 시간: 7-10 까지는 타일 수 × 타일당 시간(4.5초 → 2.6초), 8-1 부터는 판마다 조금씩 짧아져 10-10 에서 5분
(function (root) {
  const WORLDS = 10, PER_WORLD = 10;
  // 월드 안에서 1층 판 크기 (가로칸 c × 세로칸 r, 폰 세로 기준)
  const BASE = {
    0: [[4, 6], [4, 6], [4, 8], [4, 8], [6, 6], [6, 6], [6, 8], [6, 8], [8, 8], [8, 8]],
    1: [[6, 8], [6, 8], [8, 8], [8, 8], [8, 8], [8, 10], [8, 10], [8, 10], [8, 12], [8, 12]],
    mid: [[6, 8], [6, 8], [8, 8], [8, 8], [8, 10], [8, 10], [8, 10], [8, 12], [8, 12], [8, 12]],
    late: [[8, 8], [8, 8], [8, 10], [8, 10], [8, 10], [8, 12], [8, 12], [8, 12], [8, 12], [8, 12]],
  };
  // 2층 판 크기: 1층 칸 수의 8% (3-1) → 50% (10-10) 에 가깝고, 1층 판 모양과 비슷한 직사각형. 둘레에 1층이 한 칸 이상 보이게 함
  function upperSize(c, r, i) {
    if (i < 20) return [0, 0];
    const target = c * r * (0.08 + 0.42 * (i - 20) / 79);
    let best = [2, 2], bs = 1e9;
    for (let w = 2; w <= c - 2; w++) for (let h = 2; h <= r - 2; h++) {
      if ((w * h) % 2) continue;
      const sc = Math.abs(w * h - target) + Math.abs(w / h - c / r) * 6;
      if (sc < bs) { bs = sc; best = [w, h]; }
    }
    return best;
  }

  const STAGES = [];
  for (let i = 0; i < WORLDS * PER_WORLD; i++) {
    const w = Math.floor(i / PER_WORLD), k = i % PER_WORLD;
    const [c, r] = (w === 0 ? BASE[0] : w === 1 ? BASE[1] : w <= 4 ? BASE.mid : w <= 6 ? BASE.late : [[8, 12]])[w <= 6 ? k : 0];
    const [w2, h2] = upperSize(c, r, i);
    // 그림 종류: 8종 → 36종 (1~4월드는 기본 그림 24장 안에서, 5월드부터는 월드 전용 그림까지)
    const t = Math.min(w < 4 ? 24 : 36, 8 + Math.floor(i * 0.3));
    STAGES.push({ c, r, w2, h2, n2: w2 * h2, tiles: c * r + w2 * h2, t });
  }
  // 제한 시간
  let t70 = 0;
  STAGES.forEach((st, i) => {
    if (i < 70) {
      const per = 4.5 - 1.9 * (i / 69); // 타일당 초: 4.5 → 2.6
      st.s = Math.min(345, Math.round((st.tiles * per) / 5) * 5); // 아무리 큰 판도 5:45 까지 (Onet 처럼 짧게)
      if (i === 69) t70 = st.s;
    } else {
      st.s = Math.round(t70 - (t70 - 300) * (i - 69) / 30); // 8-1 부터 판마다 같은 만큼 짧아져 10-10 에서 5:00
    }
  });
  // 칸마다 타일이 있는지 (폰 세로 기준 [r][c]): 1층은 꽉 차고, 2층은 가운데 직사각형
  function occupancy(i) {
    const { c, r, w2, h2 } = STAGES[i];
    const x0 = Math.floor((c - w2) / 2), y0 = Math.floor((r - h2) / 2);
    const occ1 = Array.from({ length: r }, () => new Array(c).fill(true));
    const occ2 = Array.from({ length: r }, (_, y) => Array.from({ length: c }, (_, x) => x >= x0 && x < x0 + w2 && y >= y0 && y < y0 + h2));
    return { occ1, occ2 };
  }

  // ---------- 잇기 ----------
  // 판 상태 b = { C, R, f1, f2 }: f1[y][x] 1층 그림 번호(없으면 -1), f2[y][x] 2층 그림 번호(없으면 -1)
  const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
  const inside = (b, x, y) => x >= 0 && y >= 0 && x < b.C && y < b.R;
  // 맨 위 타일이 몇 층인지 (0: 빈 칸)
  const topZ = (b, x, y) => (!inside(b, x, y) ? 0 : b.f2[y][x] >= 0 ? 2 : b.f1[y][x] >= 0 ? 1 : 0);
  const topType = (b, x, y) => { const z = topZ(b, x, y); return z === 2 ? b.f2[y][x] : z === 1 ? b.f1[y][x] : -1; };
  // z층에서 그 칸이 막혀 있는지 (2층: 2층 타일만 막음 / 1층: 1층 타일이 막음)
  const blocked = (b, z, x, y) => inside(b, x, y) && (z === 2 ? b.f2[y][x] >= 0 : b.f1[y][x] >= 0);

  // z층에서 a → b 2번 이하로 꺾는 길 (꺾이는 점들) 또는 null
  function planePath(bd, z, a, t) {
    const C = bd.C + 2;
    const key = (x, y, d) => ((y + 1) * C + (x + 1)) * 4 + d;
    const cost = new Map(), prev = new Map(), dq = [];
    for (let d = 0; d < 4; d++) { cost.set(key(a.x, a.y, d), 0); dq.push([a.x, a.y, d, 0]); }
    while (dq.length) {
      const [x, y, d, c] = dq.shift();
      if (c > (cost.get(key(x, y, d)) ?? 9)) continue;
      const nx = x + DX[d], ny = y + DY[d];
      if (nx >= -1 && ny >= -1 && nx <= bd.C && ny <= bd.R && ((nx === t.x && ny === t.y) || !blocked(bd, z, nx, ny))) {
        const k = key(nx, ny, d);
        if (c < (cost.get(k) ?? 9)) {
          cost.set(k, c); prev.set(k, key(x, y, d)); dq.unshift([nx, ny, d, c]);
          if (nx === t.x && ny === t.y) return corners(k, prev, C);
        }
      }
      if (c < 2) for (let d2 = 0; d2 < 4; d2++) {
        if (d2 === d) continue;
        const k = key(x, y, d2);
        if (c + 1 < (cost.get(k) ?? 9)) { cost.set(k, c + 1); prev.set(k, key(x, y, d)); dq.push([x, y, d2, c + 1]); }
      }
    }
    return null;
  }
  function corners(k, prev, C) {
    const pts = [];
    for (let cur = k; cur != null; cur = prev.get(cur)) {
      const cell = Math.floor(cur / 4), x = (cell % C) - 1, y = Math.floor(cell / C) - 1;
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
  // z층에서 p 에서 판 밖(테두리)까지 곧장 나갈 수 있는 방향들 → 테두리 칸
  function exits(bd, z, p) {
    const out = [];
    for (let d = 0; d < 4; d++) {
      let x = p.x + DX[d], y = p.y + DY[d], ok = true;
      while (inside(bd, x, y)) { if (blocked(bd, z, x, y)) { ok = false; break; } x += DX[d]; y += DY[d]; }
      if (ok) out.push({ x, y });
    }
    return out;
  }
  // 판 바깥 테두리를 따라 ra → rb 로 도는 길 (꺾이는 모서리 점들)
  function ringRoute(bd, ra, rb) {
    const C = bd.C, R = bd.R, P = 2 * (C + 1) + 2 * (R + 1);
    const tOf = (p) => (p.y === -1 ? p.x + 1 : p.x === C ? C + 1 + p.y + 1 : p.y === R ? C + 1 + R + 1 + (C - p.x) : 2 * (C + 1) + R + 1 + (R - p.y));
    const cornerT = [[0, { x: -1, y: -1 }], [C + 1, { x: C, y: -1 }], [C + R + 2, { x: C, y: R }], [2 * C + R + 3, { x: -1, y: R }]];
    const ta = tOf(ra), tb = tOf(rb), fwd = (tb - ta + P) % P, back = P - fwd;
    const pts = [];
    if (fwd <= back) { for (const [ct, cp] of cornerT.concat(cornerT.map(([t, p]) => [t + P, p]))) if (ct > ta && ct < ta + fwd) pts.push(cp); }
    else { for (const [ct, cp] of cornerT.concat(cornerT.map(([t, p]) => [t - P, p])).sort((a, b) => b[0] - a[0])) if (ct < ta && ct > ta - back) pts.push(cp); }
    return { pts, len: Math.min(fwd, back) };
  }
  // 두 맨 위 타일을 이을 수 있으면 선의 점들(a → b), 없으면 null
  function link(bd, a, b) {
    const za = topZ(bd, a.x, a.y), zb = topZ(bd, b.x, b.y);
    if (!za || !zb || (a.x === b.x && a.y === b.y)) return null;
    if (za === zb) return planePath(bd, za, a, b);
    if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1) return [a, b]; // ③ 바로 옆
    const ea = exits(bd, za, a), eb = exits(bd, zb, b); // ④ 둘 다 판 밖으로 곧장 나감
    if (!ea.length || !eb.length) return null;
    let best = null;
    for (const p of ea) for (const q of eb) {
      const rr = ringRoute(bd, p, q), len = rr.len + Math.abs(p.x - a.x) + Math.abs(p.y - a.y) + Math.abs(q.x - b.x) + Math.abs(q.y - b.y);
      if (!best || len < best.len) best = { len, pts: [a, p, ...rr.pts, q, b] };
    }
    return best.pts;
  }
  // p 와 이을 수 있는 맨 위 타일 칸들 (그림은 보지 않음 — 배치 만들기용)
  function reach(bd, p) {
    const z = topZ(bd, p.x, p.y), out = new Map();
    // 같은 층: 한 번의 길 찾기로 닿는 맨 위 타일 모두
    const best = new Map(), dq = [];
    for (let d = 0; d < 4; d++) dq.push([p.x, p.y, d, 0]);
    while (dq.length) {
      const [x, y, d, t] = dq.shift();
      for (let d2 = 0; d2 < 4; d2++) {
        const nt = t + (d2 === d ? 0 : 1);
        if (nt > 2 || (x === p.x && y === p.y && d2 !== d)) continue;
        const nx = x + DX[d2], ny = y + DY[d2];
        if (nx < -1 || ny < -1 || nx > bd.C || ny > bd.R || (nx === p.x && ny === p.y)) continue;
        if (blocked(bd, z, nx, ny)) { if (topZ(bd, nx, ny) === z) out.set(ny * bd.C + nx, { x: nx, y: ny }); continue; }
        const k = ((ny + 1) * (bd.C + 2) + (nx + 1)) * 4 + d2;
        if ((best.get(k) ?? 9) <= nt) continue;
        best.set(k, nt);
        if (nt === t) dq.unshift([nx, ny, d2, nt]); else dq.push([nx, ny, d2, nt]);
      }
    }
    // 다른 층: 바로 옆, 또는 둘 다 판 밖으로 곧장 나감
    const oz = 3 - z, pe = exits(bd, z, p).length > 0;
    for (let y = 0; y < bd.R; y++) for (let x = 0; x < bd.C; x++) {
      if (topZ(bd, x, y) !== oz) continue;
      if (Math.abs(x - p.x) + Math.abs(y - p.y) === 1 || (pe && exits(bd, oz, { x, y }).length)) out.set(y * bd.C + x, { x, y });
    }
    return [...out.values()];
  }

  // ---------- 풀 수 있는 배치 만들기 ----------
  // 미리 풀어 보기: 그림이 정해지지 않은 판에서, 지금 이을 수 있는 맨 위 타일 두 개를 골라 없애기를 끝까지 반복해
  // "푸는 순서"를 먼저 만들고, 그 순서의 짝마다 같은 그림을 붙임 → 처음 판과 섞기 결과 모두 끝까지 풀리는 순서가 적어도 하나는 있음
  //  · 2층 타일을 먼저, 같은 층 짝을 더 자주, 멀리 떨어진 짝을 더 자주 고름 (2층부터 푸는 느낌 + 너무 쉽지 않게)
  //  occ1/occ2[y][x]: 그 층에 타일이 있으면 true, pairTypes: 짝마다 그림 번호 → { f1, f2 } (실패하면 null)
  function deal(occ1, occ2, pairTypes, rand = Math.random, maxTries = 300) {
    const R = occ1.length, C = occ1[0].length;
    let total = 0;
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) total += (occ1[y][x] ? 1 : 0) + (occ2[y][x] ? 1 : 0);
    if (total !== pairTypes.length * 2) return null;
    for (let tries = 0; tries < maxTries; tries++) {
      const bd = { C, R, f1: occ1.map((r) => r.map((o) => (o ? 0 : -1))), f2: occ2.map((r) => r.map((o) => (o ? 0 : -1))) };
      const order = []; // 없앤 순서대로 [[x,y,z],[x,y,z]]
      let left = total;
      while (left > 0) {
        const tops = [];
        for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) { const z = topZ(bd, x, y); if (z) tops.push({ x, y, z, k: rand() + (z === 2 ? 1.2 : 0) }); }
        tops.sort((a, b) => b.k - a.k);
        let done = false;
        for (const p of tops) {
          const qs = reach(bd, p);
          if (!qs.length) continue;
          let q = qs[0], qk = -1;
          for (const c of qs) {
            const d = Math.abs(c.x - p.x) + Math.abs(c.y - p.y);
            const k = rand() + (d > 1 ? 0.9 : 0) + (topZ(bd, c.x, c.y) === p.z ? 0.8 : 0);
            if (k > qk) { qk = k; q = c; }
          }
          const qz = topZ(bd, q.x, q.y);
          order.push([[p.x, p.y, p.z], [q.x, q.y, qz]]);
          (p.z === 2 ? bd.f2 : bd.f1)[p.y][p.x] = -1; (qz === 2 ? bd.f2 : bd.f1)[q.y][q.x] = -1;
          left -= 2; done = true; break;
        }
        if (!done) break;
      }
      if (left > 0) continue;
      const types = pairTypes.slice();
      for (let a = types.length - 1; a > 0; a--) { const b = Math.floor(rand() * (a + 1)); [types[a], types[b]] = [types[b], types[a]]; }
      const f1 = occ1.map((r) => r.map(() => -1)), f2 = occ2.map((r) => r.map(() => -1));
      order.forEach((pair, n) => pair.forEach(([x, y, z]) => { (z === 2 ? f2 : f1)[y][x] = types[n]; }));
      return { f1, f2 };
    }
    return null;
  }

  root.ShisenLevels = { WORLDS, PER_WORLD, STAGES, occupancy, deal, link, topZ, topType };
})(typeof window !== 'undefined' ? window : globalThis);
