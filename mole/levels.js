'use strict';
// 두더지 게임 스테이지 표 (게임과 Node 시험 스크립트가 같이 씀)
//  · 쉬움 100판(번호 0~99, 1-1 ~ 10-10) + 어려움 100판(100~199, 어려움 1-1 ~ 10-10), 구멍은 늘 3×3 = 9개
//    - 어려움 N월드는 쉬움 N월드(N-1 ~ N-10)를 다 깨면 열림. 어려움 안에서는 앞 판을 깨야 다음 판 (profile.js stageUnlocked)
//  · 난이도는 사천성과 같은 한 줄 사다리(LADDER): 쉬움1 < 쉬움2 < 어려움1 < 쉬움3 < 어려움2 < … < 쉬움10 < 어려움9 < 어려움10
//    → 사다리 칸 번호 × 10 + 판 = 난이도 g (0 ~ 199), t = g / 199 로 모든 값을 정함 (판이 올라갈수록 절대 쉬워지지 않음)
//  · 처음 세 판에서 하나씩 배움 (함정 캐릭터·하트 두더지는 1-1 부터):
//    1-1 노란 일반 두더지 · 함정 캐릭터 · 하트 두더지 / 1-2 + 빨간 빠른 두더지 / 1-3 + 빨간 2대 두더지 → 1-4 부터 난이도가 쭉 올라감
//  · 함정 캐릭터: 처음엔 내 캐릭터, 사다리 8칸째(어려움 4)부터는 은유·은결 둘 다
//  · 제한 시간 30초 → 45초. 시간이 끝났을 때 목표 점수를 넘으면 클리어, 점수로 별 1~3개 (별 3개 점수에 닿으면 바로 클리어)
//  · 목표 점수: 두더지를 바로바로 잡으면 간격(gap)마다 새로 나옴 → 그때 받는 점수(콤보 평균 ×1.5)의 일정 비율
//  · 두더지를 놓치면 하트 -1 (2개로 시작) 이라 머무는 시간은 넉넉하게(2.2초 → 1.4초), 간격도 1.3초 → 0.75초까지만
(function (root) {
  const WORLDS = 10, PER_WORLD = 10, HARD = 100;
  const PTS = { normal: 100, fast: 200, tough: 300 };
  const LADDER = ['e1', 'e2', 'h1', 'e3', 'h2', 'e4', 'h3', 'e5', 'h4', 'e6', 'h5', 'e7', 'h6', 'e8', 'h7', 'e9', 'h8', 'e10', 'h9', 'h10'];
  const rung = (mode, w) => LADDER.indexOf((mode === 'easy' ? 'e' : 'h') + (w + 1));
  const G_MAX = LADDER.length * PER_WORLD - 1;
  const lerp = (a, b, k) => a + (b - a) * k;
  const STAGES = [];
  for (const mode of ['easy', 'hard']) {
    for (let k = 0; k < WORLDS * PER_WORLD; k++) {
      const g = rung(mode, Math.floor(k / PER_WORLD)) * PER_WORLD + k % PER_WORLD;
      const t = g / G_MAX;
      const time = Math.round(lerp(30, 45, t) / 5) * 5;
      const gap = Math.round(lerp(1.3, 0.75, Math.pow(t, 0.8)) * 100) / 100;    // 새 두더지가 나오는 간격 (초)
      const maxOn = g < 10 ? 1 : g < 50 ? 2 : 3;                                 // 한꺼번에 나와 있는 최대 수 (함정·하트 두더지 빼고)
      const stay = Math.round(lerp(2.2, 1.4, t) * 100) / 100;                     // 일반 두더지가 머무는 시간
      const fast = g < 1 ? 0 : Math.min(0.3, 0.12 + t * 0.2);                     // 1-2 부터
      const tough = g < 2 ? 0 : Math.min(0.25, 0.08 + t * 0.18);                  // 1-3 부터
      const trap = Math.min(0.22, 0.08 + t * 0.15);                               // 1-1 부터
      const both = g >= 80;                                                       // 어려움 4 부터 은유·은결 둘 다
      const n = time / gap, avg = PTS.normal * (1 - fast - tough) + PTS.fast * fast + PTS.tough * tough;
      const full = n * (1 - trap) * avg * 1.5;
      const r100 = (v) => Math.round(v / 100) * 100;
      const goal = r100(full * lerp(0.28, 0.38, t)), s2 = r100(full * 0.5), s3 = r100(full * lerp(0.72, 0.62, t));
      STAGES.push({ mode, g, time, gap, maxOn, stay, fast, tough, trap, both, goal, s2, s3 });
    }
  }
  const api = { WORLDS, PER_WORLD, HARD, STAGES, PTS, LADDER };
  if (typeof module !== 'undefined') module.exports = api; else root.MoleLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
