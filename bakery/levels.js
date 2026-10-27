'use strict';
// 달콤 베이커리 난이도 (게임과 Node 시험 스크립트가 같이 씀)
//  · 끝없이 이어지는 게임: 하트 3개가 다 없어질 때까지 빵이 계속 나옴 (다운힐 러너·헬리콥터처럼)
//  · 시간이 갈수록 어려워짐 — 0초 쉬움(k=0) → 6분 가장 어려움(k=1), 30초마다 "레벨 업"
//  · 처음에 하나씩 배움: 컵케이크만 → 7초 긴 빵(꾹 누르기) → 11초 금빛 → 15초 연달아 2개 → 22초 함정(탄 빵·빈 접시)
//  · 하트: 3개로 시작, 최대 5개. Perfect(완벽) +1, Bad(놓침·함정·너무 빨리) -1 — game.js
//  · 빵은 박자(bpm)에 맞춰 짤주머니 밑에 도착 → 노래가 없어도 "통, 통, 통-" 박자가 느껴짐
(function (root) {
  const PTS = { cup: 100, gold: 300, long: 200 }; // 완벽일 때 점수 (좋아요 ×0.7, 아쉬워요 ×0.4)
  const JUDGE = { perfect: 1, good: 0.7, ok: 0.4 };
  const RAMP = 360;   // 이 시간(초)에 가장 어려워짐 (6분)
  const LEVEL = 30;   // 레벨 업 간격 (초)
  const LEAD = 2.4;   // 첫 빵이 짤주머니에 도착하는 시간 (초)
  const FAST = 1.1;  // 2026-10-27 "너무 쉽다" → 모든 레벨 10% 빠르게 (컨베이어 속도·빵 나오는 박자 둘 다)
  const SPEED = [230 * FAST, 420 * FAST]; // 컨베이어 속도 (화면 점/초): 처음 → 가장 빠를 때
  const lerp = (a, b, k) => a + (b - a) * k;
  const r2 = (v) => Math.round(v * 100) / 100;
  const kAt = (c) => Math.max(0, Math.min(1, c / RAMP));
  // 그 시각의 난이도 (i: 0~99 단계, 예전 100판 표와 같은 값)
  function params(c) {
    const t = kAt(c), i = Math.round(t * 99);
    return {
      bpm: Math.round(lerp(84, 132, Math.pow(t, 0.9)) * FAST / 2) * 2,
      // 완벽·좋아요·아쉬워요 (± 초). 아쉬워요(OK) 바깥 = Bad → 2026-10-27 OK 범위를 두 번 10%씩 좁혀(×0.9×0.9) Bad 가 더 잘 뜨게
      win: { p: r2(lerp(0.08, 0.05, t)), g: r2(lerp(0.15, 0.1, t)), o: Math.round(lerp(0.25, 0.17, t) * 0.81 * 1000) / 1000 },
      long: i < 2 ? 0 : r2(Math.min(0.35, 0.18 + t * 0.2)),
      longMax: r2(lerp(2, 4, t)),                           // 긴 빵 최대 길이 (박자)
      dbl: i < 4 ? 0 : r2(Math.min(0.25, 0.1 + t * 0.18)),  // 컵케이크 2개 연달아
      trap: i < 6 ? 0 : r2(Math.min(0.2, 0.1 + t * 0.12)),
      gold: i < 3 ? 0 : 0.07,
      guide: Math.max(0, Math.min(1, 1 - (i - 15) / 15)),   // 타이밍 도우미 진하기 (55초까지 진하게, 1분 50초부터 없음)
      gaps: i < 10 ? [2, 2, 3] : i < 40 ? [1, 2, 2, 3] : i < 70 ? [1, 1, 2, 2] : [1, 1, 1, 1.5, 2], // 다음 빵까지 박자
    };
  }
  // 컨베이어 속도는 시각에 따라 부드럽게 빨라짐 → 지나간 거리 D(c) 로 빵 위치를 정함 (속도가 바뀌어도 빵이 튀지 않음)
  const speedAt = (c) => lerp(SPEED[0], SPEED[1], kAt(c));
  function dist(c) {
    const a = SPEED[0], b = SPEED[1];
    if (c <= RAMP) return a * c + (b - a) * c * c / (2 * RAMP);
    return a * RAMP + (b - a) * RAMP / 2 + b * (c - RAMP);
  }
  // 빵 만들기 (start: 시작 시각 — 레벨 N부터 하면 (N-1)×30초): gen.fill(upTo) 가 upTo 초까지 도착할 빵을 gen.out 에 이어 붙임
  //  빵: { type: cup|gold|long|burnt|plate, t(짤주머니 밑에 도착하는 초), t1(긴 빵 끝) }
  function Gen(seed = Date.now(), start = 0) {
    let a = seed >>> 0;
    const R = () => { a = (a + 0x6D2B79F5) >>> 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    const g = { out: [], t: start + LEAD, lastTrap: false, n: 0 };
    g.fill = (upTo) => {
      while (g.t < upTo) {
        const st = params(g.t), beat = 60 / st.bpm, minGap = st.win.o * 2 + 0.08, t = g.t;
        const first = g.n < 2, r = R();
        if (!first && !g.lastTrap && r < st.trap) {
          g.out.push({ type: R() < 0.6 ? 'burnt' : 'plate', t }); g.lastTrap = true;
        } else if (!first && r < st.trap + st.long) {
          const len = Math.max(0.5, Math.max(1, Math.round((1 + R() * (st.longMax - 1)) * 2) / 2) * beat);
          g.out.push({ type: 'long', t, t1: t + len }); g.t += len; g.lastTrap = false;
        } else if (!first && r < st.trap + st.long + st.dbl) {
          const d = Math.max(beat / 2, minGap);
          g.out.push({ type: 'cup', t }); g.out.push({ type: 'cup', t: t + d }); g.t += d; g.lastTrap = false; g.n++;
        } else {
          g.out.push({ type: !first && R() < st.gold ? 'gold' : 'cup', t }); g.lastTrap = false;
        }
        g.n++;
        g.t += Math.max(st.gaps[Math.floor(R() * st.gaps.length)] * beat, minGap);
      }
    };
    return g;
  }
  const api = { PTS, JUDGE, RAMP, LEVEL, LEAD, params, speedAt, dist, Gen };
  if (typeof module !== 'undefined') module.exports = api; else root.BakeryLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
