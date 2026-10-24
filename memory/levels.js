'use strict';
// 메모리 게임 스테이지 표 (게임과 Node 시험 스크립트가 같이 씀)
//  · 10개 월드 × 10판 = 100판 (1-1 ~ 10-10)
//  · 짝 수: 1-1 은 3쌍(6장) → 판이 올라갈수록 늘어 7-3 부터 16쌍(32장)
//  · 추억 카드(은유·은결 일상 그림): 6월드부터 섞이기 시작해 10월드는 16쌍 중 12쌍 — 비슷한 그림이 많아져 더 헷갈림
//  · 미리 보기: 처음에 모든 카드를 잠깐 보여 줌. 카드 1장당 0.45초 → 0.12초, 최대 6초 → 3초 (최소 2초)
//  · 제한 시간: 10초 + 짝 수 × 짝당 시간(12초 → 6초로 줄어듦)
(function (root) {
  const WORLDS = 10, PER_WORLD = 10;
  const PAIRS = [
    [3, 3, 4, 4, 4, 5, 5, 6, 6, 6],
    [6, 6, 7, 7, 7, 8, 8, 8, 8, 8],
    [8, 8, 9, 9, 9, 10, 10, 10, 10, 10],
    [10, 10, 11, 11, 11, 12, 12, 12, 12, 12],
    [12, 12, 12, 13, 13, 13, 14, 14, 14, 14],
    [14, 14, 14, 14, 15, 15, 15, 15, 15, 15],
    [15, 15, 16, 16, 16, 16, 16, 16, 16, 16],
  ];
  const SCENES = [0, 0, 0, 0, 0, 2, 4, 6, 9, 12]; // 월드별 추억 카드 쌍 수 (월드 안에서 판마다 조금씩 늘어 이 값까지)
  const half = (v) => Math.round(v * 2) / 2;
  const STAGES = [];
  for (let i = 0; i < WORLDS * PER_WORLD; i++) {
    const w = Math.floor(i / PER_WORLD), k = i % PER_WORLD;
    const pairs = (PAIRS[w] || PAIRS[6].map(() => 16))[k];
    const prevSc = w ? SCENES[w - 1] : 0;
    const scenes = Math.min(pairs, Math.round(prevSc + (SCENES[w] - prevSc) * (k + 1) / PER_WORLD));
    const preview = Math.max(2, half(Math.min(6 - 3 * i / 99, pairs * 2 * (0.45 - 0.33 * i / 99))));
    const per = 12 - 6 * (i / 99);
    const s = Math.round((10 + pairs * per) / 5) * 5;
    STAGES.push({ pairs, cards: pairs * 2, scenes, preview, s });
  }
  const api = { WORLDS, PER_WORLD, STAGES };
  if (typeof module !== 'undefined') module.exports = api; else root.MemoryLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
