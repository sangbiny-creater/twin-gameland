'use strict';
// 버거 러시 판 표 — 쉬움 100판(0~99) + 어려움 100판(100~199)
//  사천성·메모리·두더지·선물가게와 같은 난이도 사다리: 쉬움1 < 쉬움2 < 어려움1 < 쉬움3 < 어려움2 < … < 쉬움10 < 어려움9 < 어려움10
//  사다리 칸(RUNGS)마다 값을 적고, 월드 안 1~10판은 지금 칸 값 → 다음 칸 값으로 조금씩 다가감 → 판이 올라갈수록 절대 쉬워지지 않음
//  (검사: node tools/burger_levels.mjs — 거꾸로 가는 값이 있거나, 느린 손으로 못 깨는 판이 있으면 멈춤)
//  ing: 버거 속 재료 가지 수 (패티 말고, cheese·lettuce·tomato·onion·bacon 앞에서부터)
//  fill: 버거 속 재료 수 [최소, 최대] (위·아래 빵 뺌, 패티 포함) · dbl: 패티 2장 버거
//  sides: 나오는 사이드 · sideMax: 한 주문의 사이드 최대 수
//  cook: 굽는 시간(초) · burn: 다 익은 뒤 탈 때까지(초, 0 = 안 탐) · wait: 손님이 기다려 주는 시간(초)
//  guests: 한 판 손님 수 · conc: 카운터에 동시에 서는 손님 · grills: 굽는 칸 · trays: 쟁반
//  press: 바쁨 정도 — 다음 손님이 오는 간격 gap = (보통 주문을 한 번에 1초씩 눌러 만드는 시간) ÷ press. 클수록 손님이 몰려 옴
(function () {
  const PER_WORLD = 10, HARD = 100;
  const ING = ['cheese', 'lettuce', 'tomato', 'onion', 'bacon'];
  const S2 = ['cola', 'fries'], S3 = ['cola', 'fries', 'cider'], S4 = ['cola', 'fries', 'cider', 'nuggets'], S5 = [...S4, 'icecream'];
  // 사다리 순서대로 (이름, 값)
  const R = (name, ing, fill, dbl, sides, sideMax, cook, burn, wait, guests, conc, press, grills, trays) =>
    ({ name, ing, fill, dbl, sides, sideMax, cook, burn, wait, guests, conc, press, grills, trays });
  const RUNGS = [
    R('E1', 1, [1, 2], 0, S2, 1, 2.0, 0, 70, 4, 1, 0.42, 2, 1),
    R('E2', 2, [2, 2], 0, S2, 1, 2.5, 0, 64, 6, 2, 0.48, 2, 1),
    R('H1', 3, [2, 3], 0, S3, 1, 3.0, 18, 60, 7, 2, 0.54, 3, 2),
    R('E3', 3, [2, 3], 0, S3, 1, 3.0, 16, 58, 7, 2, 0.56, 3, 2),
    R('H2', 4, [3, 3], 0, S3, 1, 3.0, 14, 56, 8, 2, 0.6, 3, 2),
    R('E4', 4, [3, 3], 0, S3, 1, 3.0, 13, 54, 8, 2, 0.62, 3, 2),
    R('H3', 5, [3, 4], 0, S4, 1, 3.5, 12, 52, 9, 3, 0.66, 3, 2),
    R('E5', 5, [3, 4], 0, S4, 1, 3.5, 11, 50, 9, 3, 0.68, 3, 2),
    R('H4', 5, [4, 4], 1, S4, 1, 3.5, 10, 48, 10, 3, 0.71, 3, 2),
    R('E6', 5, [4, 4], 1, S4, 1, 3.5, 9, 47, 10, 3, 0.73, 3, 2),
    R('H5', 5, [4, 5], 1, S4, 2, 3.5, 9, 46, 11, 3, 0.76, 4, 2),
    R('E7', 5, [4, 5], 1, S4, 2, 4.0, 8, 45, 11, 3, 0.78, 4, 2),
    R('H6', 5, [5, 5], 1, S4, 2, 4.0, 8, 44, 12, 3, 0.81, 4, 2),
    R('E8', 5, [5, 5], 1, S4, 2, 4.0, 7, 43, 12, 3, 0.83, 4, 2),
    R('H7', 5, [5, 6], 1, S4, 2, 4.0, 7, 42, 13, 4, 0.86, 4, 2),
    R('E9', 5, [5, 6], 1, S4, 2, 4.5, 6, 41, 13, 4, 0.88, 4, 2),
    R('H8', 5, [6, 6], 1, S4, 3, 4.5, 6, 41, 14, 4, 0.91, 4, 2),
    R('E10', 5, [6, 6], 1, S5, 3, 4.5, 6, 40, 14, 4, 0.92, 4, 2),
    R('H9', 5, [6, 7], 1, S4, 3, 5.0, 5, 39, 15, 4, 0.96, 4, 2),
    R('H10', 5, [7, 7], 1, S5, 3, 5.0, 5, 38, 16, 4, 1.0, 4, 2),
  ];
  const END = R('END', 5, [7, 7], 1, S5, 3, 5.0, 5, 36, 18, 4, 1.04, 4, 2); // 어려움 10-10 이 다가가는 값
  // 판 번호 → 사다리 칸: 쉬움 N월드 = E N, 어려움 N월드 = H N
  const rungOf = (i) => { const w = Math.floor((i % HARD) / PER_WORLD) + 1; return RUNGS.findIndex((r) => r.name === (i >= HARD ? 'H' : 'E') + w); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const STAGES = [];
  for (let i = 0; i < HARD * 2; i++) {
    const ri = rungOf(i), r = RUNGS[ri], n = RUNGS[ri + 1] || END, k = (i % PER_WORLD), t = k / PER_WORLD;
    let sides = r.sides.slice();
    if (r.name === 'E1') sides = k >= 6 ? ['cola', 'fries'] : k >= 3 ? ['cola'] : []; // 1월드: 1~3판 버거만, 4판 콜라, 7판 감자튀김
    STAGES.push({
      rung: r.name, ing: ING.slice(0, r.ing), fill: r.fill.slice(), dbl: r.dbl, sides, sideMax: sides.length ? r.sideMax : 0,
      cook: Math.round(lerp(r.cook, n.cook, t) * 10) / 10,
      burn: r.burn ? Math.round(lerp(r.burn, n.burn || r.burn, t) * 10) / 10 : 0,
      wait: Math.round(lerp(r.wait, n.wait, t)),
      guests: Math.round(lerp(r.guests, n.guests, t)),
      conc: Math.min(4, Math.floor(lerp(r.conc, n.conc, t) + 0.5)),
      press: Math.round(lerp(r.press, n.press, t) * 100) / 100,
      grills: r.grills, trays: r.trays,
    });
  }
  // 보통 주문 하나를 만드는 누르기 수: 생패티 p · 아래 빵 · 다른 재료 · 사이드 · 익은 패티 p · 위 빵 (game.js 의 주문 만들기와 같은 확률)
  const avgTaps = (s) => { const n = (s.fill[0] + s.fill[1]) / 2, p = s.dbl && n >= 3 ? 1.3 : 1, sd = !s.sideMax ? 0 : s.sideMax === 1 ? 0.6 : (1 + s.sideMax) / 2; return n + p + 2 + sd; };
  for (const s of STAGES) s.gap = Math.round(avgTaps(s) / s.press * 10) / 10;
  window.BurgerLevels = { PER_WORLD, HARD, ING, RUNGS, STAGES, avgTaps };
})();
