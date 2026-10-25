'use strict';
// 두더지 게임 스테이지 표 (게임과 Node 시험 스크립트가 같이 씀)
//  · 10개 월드 × 10판 = 100판 (1-1 ~ 10-10), 구멍은 늘 3×3 = 9개
//  · 제한 시간 30초(1-1) → 45초(10-10). 시간이 끝났을 때 목표 점수를 넘으면 클리어, 점수로 별 1~3개
//  · 처음 월드에서 하나씩 배움: 1-1 일반 두더지만 → 1-3 빠른 두더지 → 1-5 2대 두더지 → 1-7 내 캐릭터(누르면 안 됨)
//  · 5월드(41판)부터는 은유·은결 둘 다 함정으로 나옴
//  · 뒤로 갈수록: 두더지가 더 자주·더 짧게 나오고, 한꺼번에 1 → 3마리, 빠른·2대·함정 비율이 늘어남
//  · 목표 점수: 두더지를 바로바로 잡으면 간격(gap)마다 새로 나옴 → 그때 받는 점수(콤보 평균 ×1.5)의 일정 비율
//    (봇 시험: 0.7초 만에 85% 맞히면 앞 판은 별 3개, 10월드는 별 2개쯤 / 0.45초·95%면 거의 별 3개)
(function (root) {
  const WORLDS = 10, PER_WORLD = 10;
  const PTS = { normal: 100, fast: 200, tough: 300 };
  const STAGES = [];
  const lerp = (a, b, k) => a + (b - a) * k;
  for (let i = 0; i < WORLDS * PER_WORLD; i++) {
    const t = i / 99, w = Math.floor(i / PER_WORLD);
    const time = Math.round(lerp(30, 45, t) / 5) * 5;
    const gap = Math.round(lerp(1.15, 0.5, Math.pow(t, 0.8)) * 100) / 100;   // 새 두더지가 나오는 간격 (초)
    const maxOn = i < 6 ? 1 : i < 30 ? 2 : 3;                                  // 한꺼번에 나와 있는 최대 수 (함정 빼고)
    const stay = Math.round(lerp(1.7, 0.95, t) * 100) / 100;                    // 일반 두더지가 머무는 시간
    const fast = i < 2 ? 0 : Math.min(0.3, 0.12 + t * 0.2);
    const tough = i < 4 ? 0 : Math.min(0.25, 0.08 + t * 0.18);
    const trap = i < 6 ? 0 : Math.min(0.22, 0.08 + t * 0.15);
    const both = w >= 4;
    const n = time / gap, avg = PTS.normal * (1 - fast - tough) + PTS.fast * fast + PTS.tough * tough;
    const full = n * (1 - trap) * avg * 1.5;
    const r100 = (v) => Math.round(v / 100) * 100;
    const goal = r100(full * lerp(0.28, 0.38, t)), s2 = r100(full * 0.5), s3 = r100(full * lerp(0.72, 0.62, t));
    STAGES.push({ time, gap, maxOn, stay, fast, tough, trap, both, goal, s2, s3 });
  }
  const api = { WORLDS, PER_WORLD, STAGES, PTS };
  if (typeof module !== 'undefined') module.exports = api; else root.MoleLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
