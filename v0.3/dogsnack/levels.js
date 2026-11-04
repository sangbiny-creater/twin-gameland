'use strict';
// 멍멍이 간식 타임 난이도 (게임과 Node 시험 스크립트가 같이 씀) — 달콤 베이커리와 같은 시간 기반 방식
//  · 3줄(왼쪽·가운데·오른쪽)로 간식이 위에서 떨어짐 → 아래 판정선에서 그 줄 강아지를 톡 / 긴 소시지는 꾹~ 떼기
//  · 끝없이 이어짐: 하트가 다 없어질 때까지. 0초 쉬움 → 6분 가장 어려움, 30초마다 레벨 업
//  · 처음에 하나씩 배움: 뼈다귀만 → 7초 긴 소시지 → 11초 금빛 뼈다귀 → 18초 두 줄 같이(쌍둥이 간식) → 25초 함정(양파·초콜릿)
//  · 노래 없이 효과음만: 간식은 박자(bpm)에 맞춰 판정선에 도착
//  · 간식 종류 이름은 베이커리 코드와 같게 둠: cup=뼈다귀 · gold=금빛 뼈다귀 · long=긴 소시지 · burnt=양파 · plate=초콜릿
(function (root) {
  const LANES = 3;
  const PTS = { cup: 100, gold: 300, long: 200 }; // 완벽일 때 점수 (좋아요 ×0.7, 아쉬워요 ×0.4)
  const JUDGE = { perfect: 1, good: 0.7, ok: 0.4 };
  const RAMP = 360, LEVEL = 30, LEAD = 2.6;
  const SPEED = [330, 620]; // 떨어지는 속도 (화면 점/초)
  const lerp = (a, b, k) => a + (b - a) * k;
  const r2 = (v) => Math.round(v * 100) / 100;
  const kAt = (c) => Math.max(0, Math.min(1, c / RAMP));
  function params(c) {
    const t = kAt(c), i = Math.round(t * 99);
    return {
      bpm: Math.round(lerp(84, 136, Math.pow(t, 0.9)) / 2) * 2,
      win: { p: r2(lerp(0.08, 0.05, t)), g: r2(lerp(0.15, 0.1, t)), o: r2(lerp(0.25, 0.17, t)) },
      long: i < 2 ? 0 : r2(Math.min(0.3, 0.16 + t * 0.18)),
      longMax: r2(lerp(2, 4, t)),
      chord: i < 5 ? 0 : r2(Math.min(0.28, 0.1 + t * 0.2)),  // 두 줄 같이 누르기
      trap: i < 7 ? 0 : r2(Math.min(0.18, 0.08 + t * 0.12)),
      gold: i < 3 ? 0 : 0.07,
      guide: Math.max(0, Math.min(1, 1 - (i - 15) / 15)),
      gaps: i < 10 ? [2, 2, 3] : i < 40 ? [1, 2, 2, 3] : i < 70 ? [1, 1, 2, 2] : [1, 1, 1, 1.5, 2],
    };
  }
  const speedAt = (c) => lerp(SPEED[0], SPEED[1], kAt(c));
  function dist(c) {
    const a = SPEED[0], b = SPEED[1];
    if (c <= RAMP) return a * c + (b - a) * c * c / (2 * RAMP);
    return a * RAMP + (b - a) * RAMP / 2 + b * (c - RAMP);
  }
  // 빵 만들기 (start: 시작 시각 — 레벨 N부터면 (N-1)×30초): gen.fill(upTo) 가 upTo 초까지 도착할 빵을 gen.out 에 이어 붙임
  //  빵: { type: cup|gold|long|burnt|plate, lane(0~2), t, t1(긴 빵 끝) }. 긴 빵이 내려오는 동안 다른 빵은 안 나옴 (어린이용)
  function Gen(seed = Date.now(), start = 0) {
    let a = seed >>> 0;
    const R = () => { a = (a + 0x6D2B79F5) >>> 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    const g = { out: [], t: start + LEAD, lastLane: 1, lastTrap: false, n: 0 };
    const pickLane = (not) => { let l; do { l = Math.floor(R() * LANES); } while (l === not && R() < 0.7); return l; };
    g.fill = (upTo) => {
      while (g.t < upTo) {
        const st = params(g.t), beat = 60 / st.bpm, minGap = st.win.o * 2 + 0.08, t = g.t;
        const first = g.n < 3, r = R(), lane = first ? [1, 0, 2][g.n] : pickLane(g.lastLane);
        if (!first && !g.lastTrap && r < st.trap) {
          g.out.push({ type: R() < 0.6 ? 'burnt' : 'plate', lane, t }); g.lastTrap = true;
        } else if (!first && r < st.trap + st.long) {
          const len = Math.max(0.5, Math.max(1, Math.round((1 + R() * (st.longMax - 1)) * 2) / 2) * beat);
          g.out.push({ type: 'long', lane, t, t1: t + len }); g.t += len; g.lastTrap = false;
        } else if (!first && r < st.trap + st.long + st.chord) {
          const l2 = (lane + 1 + Math.floor(R() * 2)) % LANES; // 다른 줄 하나
          g.out.push({ type: 'cup', lane, t, chord: true }); g.out.push({ type: 'cup', lane: l2, t, chord: true }); g.lastTrap = false;
        } else {
          g.out.push({ type: !first && R() < st.gold ? 'gold' : 'cup', lane, t }); g.lastTrap = false;
        }
        g.lastLane = lane; g.n++;
        g.t += Math.max(st.gaps[Math.floor(R() * st.gaps.length)] * beat, minGap);
      }
    };
    return g;
  }
  const api = { LANES, PTS, JUDGE, RAMP, LEVEL, LEAD, params, speedAt, dist, Gen };
  if (typeof module !== 'undefined') module.exports = api; else root.SnackLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
