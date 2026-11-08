'use strict';
// 메모리 게임 스테이지 표 (게임과 Node 시험 스크립트가 같이 씀)
//  · 쉬움 100판(번호 0~99, 1-1 ~ 10-10) + 어려움 100판(100~199, 어려움 1-1 ~ 10-10)
//    - 어려움 N월드는 쉬움 N월드(N-1 ~ N-10)를 다 깨면 열림. 어려움 안에서는 앞 판을 깨야 다음 판 (profile.js stageUnlocked)
//  · 난이도는 사천성과 같은 한 줄 사다리(LADDER): 쉬움1 < 쉬움2 < 어려움1 < 쉬움3 < 어려움2 < … < 쉬움10 < 어려움9 < 어려움10
//    → 사다리 칸 번호 × 10 + 판 = 난이도 g (0 ~ 199), t = g / 199 로 모든 값을 정함 (판이 올라갈수록 절대 쉬워지지 않음)
//  · 짝 수: 쉬움 1-1 은 3쌍(6장) → 쉬움 8월드 무렵 16쌍(32장) → 어려움 끝 판들은 18쌍(36장)
//  · 추억 카드(은유·은결 일상 그림): 쉬움 6월드부터 섞이기 시작해 어려움 10월드는 18쌍 중 14쌍 — 비슷한 그림이 많아져 더 헷갈림
//  · 미리 보기: 처음에 모든 카드를 잠깐 보여 줌. 카드 수에 따라 6장 1초 → 32장 3초 (카드 1장 늘 때마다 약 0.08초)
//  · 제한 시간: 10초 + 짝 수 × 짝당 시간(12초 → 5.5초로 줄어듦)
(function (root) {
  const WORLDS = 10, PER_WORLD = 10, HARD = 100;
  const LADDER = ['e1', 'e2', 'h1', 'e3', 'h2', 'e4', 'h3', 'e5', 'h4', 'e6', 'h5', 'e7', 'h6', 'e8', 'h7', 'e9', 'h8', 'e10', 'h9', 'h10'];
  const rung = (mode, w) => LADDER.indexOf((mode === 'easy' ? 'e' : 'h') + (w + 1));
  const G_MAX = LADDER.length * PER_WORLD - 1;
  const FIRST = [3, 3, 4, 4, 4, 5, 5, 6, 6, 6]; // 쉬움 1월드 (처음 배우는 판)
  // 짝 수: 난이도 g 지점마다 [g, 짝] 사이를 이어서 내림 (늘 같거나 늘어남)
  const PAIR_PTS = [[10, 6], [20, 8], [40, 10], [70, 12], [100, 14], [130, 16], [160, 17], [185, 18]];
  function pairsAt(g) {
    if (g < 10) return FIRST[g];
    for (let j = PAIR_PTS.length - 1; j >= 0; j--) {
      const [g0, p0] = PAIR_PTS[j];
      if (g < g0) continue;
      const nx = PAIR_PTS[j + 1];
      return nx ? Math.floor(p0 + (nx[1] - p0) * (g - g0) / (nx[0] - g0)) : p0;
    }
    return FIRST[9];
  }
  const STAGES = [];
  for (const mode of ['easy', 'hard']) {
    for (let k = 0; k < WORLDS * PER_WORLD; k++) {
      const g = rung(mode, Math.floor(k / PER_WORLD)) * PER_WORLD + k % PER_WORLD;
      const t = g / G_MAX;
      const pairs = pairsAt(g);
      const scenes = g < 90 ? 0 : Math.min(pairs - 4, Math.round(pairs * 0.8 * (g - 89) / (G_MAX - 89)));
      const preview = Math.round((1 + (pairs * 2 - 6) * 2 / 26) * 10) / 10; // 6장 1초 → 32장 3초
      const per = 12 - 6.5 * t;
      const s = Math.round((10 + pairs * per) / 5) * 5;
      STAGES.push({ mode, g, pairs, cards: pairs * 2, scenes, preview, s });
    }
  }
  const api = { WORLDS, PER_WORLD, HARD, STAGES, LADDER };
  if (typeof module !== 'undefined') module.exports = api; else root.MemoryLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
