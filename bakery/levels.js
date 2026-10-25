'use strict';
// 달콤 베이커리 스테이지 표 (게임과 Node 시험 스크립트가 같이 씀)
//  · 10개 월드 × 10판 = 100판 (1-1 ~ 10-10), 하트는 늘 3개 (놓치거나 함정을 누르면 1개씩 줄어요)
//  · 빵은 박자(bpm)에 맞춰 짤주머니 밑에 도착 → 노래가 없어도 "통, 통, 통-" 박자가 느껴짐
//  · 처음 월드에서 하나씩 배움: 1-1 컵케이크만 → 1-3 긴 빵(꾹 누르기) → 1-4 금빛 컵케이크 → 1-5 연달아 2개 → 1-7 함정(탄 빵·빈 접시)
//  · 뒤로 갈수록: 빵이 더 많이·더 빨리·더 촘촘히, 판정 시간은 조금씩 좁아짐, 타이밍 도우미(줄어드는 동그라미)는 30판까지만
//  · 판마다 빵 순서는 늘 같음 (판 번호로 정한 난수) → 다시 하면 외워서 더 잘할 수 있음
//  · 별: 정확도(완벽 1 · 좋아요 0.7 · 아쉬워요 0.4 · 놓침 0) 평균 — 끝까지 버티면 1개, 60% 2개, 85% 3개
(function (root) {
  const WORLDS = 10, PER_WORLD = 10;
  const PTS = { cup: 100, gold: 300, long: 200 }; // 완벽일 때 점수 (좋아요 ×0.7, 아쉬워요 ×0.4)
  const JUDGE = { perfect: 1, good: 0.7, ok: 0.4 };
  const STAR2 = 0.6, STAR3 = 0.85;
  const LEAD = 2.4; // 첫 빵이 짤주머니에 도착하는 시간 (초)
  const lerp = (a, b, k) => a + (b - a) * k;
  const r2 = (v) => Math.round(v * 100) / 100;
  const STAGES = [];
  for (let i = 0; i < WORLDS * PER_WORLD; i++) {
    const t = i / 99;
    STAGES.push({
      n: Math.round(lerp(14, 40, t)),                      // 빵 개수 (함정 포함)
      bpm: Math.round(lerp(84, 132, Math.pow(t, 0.9)) / 2) * 2,
      speed: Math.round(lerp(230, 420, t)),                 // 컨베이어 속도 (화면 점/초)
      win: { p: r2(lerp(0.08, 0.05, t)), g: r2(lerp(0.15, 0.1, t)), o: r2(lerp(0.25, 0.17, t)) }, // 완벽·좋아요·아쉬워요 (± 초)
      long: i < 2 ? 0 : r2(Math.min(0.35, 0.18 + t * 0.2)),
      longMax: r2(lerp(2, 4, t)),                           // 긴 빵 최대 길이 (박자)
      dbl: i < 4 ? 0 : r2(Math.min(0.25, 0.1 + t * 0.18)),  // 컵케이크 2개 연달아
      trap: i < 6 ? 0 : r2(Math.min(0.2, 0.1 + t * 0.12)),
      gold: i < 3 ? 0 : 0.07,
      guide: Math.max(0, Math.min(1, 1 - (i - 15) / 15)),   // 타이밍 도우미 진하기 (1-1~2-6 진하게, 4-1부터 없음)
      gaps: i < 10 ? [2, 2, 3] : i < 40 ? [1, 2, 2, 3] : i < 70 ? [1, 1, 2, 2] : [1, 1, 1, 1.5, 2], // 다음 빵까지 박자 (무작위로 고름)
    });
  }
  // 난수 (판마다 같은 순서)
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  }
  // 빵 목록: { type: cup|gold|long|burnt|plate, t(짤주머니 밑에 도착하는 초), t1(긴 빵 끝) }
  function notes(si) {
    const st = STAGES[si], R = rng(si * 7919 + 13), beat = 60 / st.bpm;
    const minGap = st.win.o * 2 + 0.12; // 판정 시간이 겹치지 않게
    const out = [];
    let t = LEAD, lastTrap = false;
    while (out.length < st.n) {
      const r = R();
      const first = out.length < 2;
      if (!first && !lastTrap && r < st.trap) {
        out.push({ type: R() < 0.6 ? 'burnt' : 'plate', t }); lastTrap = true;
      } else if (!first && r < st.trap + st.long && out.length < st.n - 1) {
        const len = Math.max(1, Math.round((1 + R() * (st.longMax - 1)) * 2) / 2) * beat;
        out.push({ type: 'long', t, t1: t + Math.max(len, 0.5) }); t += Math.max(len, 0.5); lastTrap = false;
      } else if (!first && r < st.trap + st.long + st.dbl && out.length < st.n - 1) {
        const g = Math.max(beat / 2, minGap);
        out.push({ type: 'cup', t }); out.push({ type: 'cup', t: t + g }); t += g; lastTrap = false;
      } else {
        out.push({ type: !first && R() < st.gold ? 'gold' : 'cup', t }); lastTrap = false;
      }
      const gb = st.gaps[Math.floor(R() * st.gaps.length)];
      t += Math.max(gb * beat, minGap);
    }
    return out;
  }
  const api = { WORLDS, PER_WORLD, STAGES, PTS, JUDGE, STAR2, STAR3, LEAD, notes };
  if (typeof module !== 'undefined') module.exports = api; else root.BakeryLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
