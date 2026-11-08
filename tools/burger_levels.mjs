// 버거 러시 판 표 검사 — node tools/burger_levels.mjs
//  ① 사다리 순서(쉬움1 < 쉬움2 < 어려움1 < 쉬움3 < … < 쉬움10 < 어려움9 < 어려움10)로 200판을 늘어놓고, 판마다 앞 판보다 쉬워지는 값이 있으면 멈춤
//  ② 느린 손 로봇(쉬움 한 번 누르는 데 0.9초, 어려움 0.75초)이 보통 주문을 하나씩 만들어도 손님을 놓치지 않는지,
//     가장 큰 주문 하나를 만드는 시간이 기다림의 60% 안인지 확인 (억지로 어려운 판이 없게)
import fs from 'fs';
import vm from 'vm';
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL('../burger/levels.js', import.meta.url), 'utf8'), ctx);
const { STAGES, RUNGS, PER_WORLD, HARD } = ctx.window.BurgerLevels;
const order = STAGES.map((s, i) => i).sort((a, b) => RUNGS.findIndex((r) => r.name === STAGES[a].rung) - RUNGS.findIndex((r) => r.name === STAGES[b].rung) || (a % PER_WORLD) - (b % PER_WORLD));
const name = (i) => `${i >= HARD ? '어려움 ' : '쉬움 '}${Math.floor((i % HARD) / PER_WORLD) + 1}-${(i % PER_WORLD) + 1}`;
const inf = (v) => (v ? v : 1e9);
const UP = { guests: (s) => s.guests, conc: (s) => s.conc, fillMin: (s) => s.fill[0], fillMax: (s) => s.fill[1], ing: (s) => s.ing.length, sideMax: (s) => s.sideMax, cook: (s) => s.cook, dbl: (s) => s.dbl, press: (s) => s.press };
const DOWN = { wait: (s) => s.wait, burn: (s) => inf(s.burn) };
let bad = 0;
for (let k = 1; k < order.length; k++) {
  const a = STAGES[order[k - 1]], b = STAGES[order[k]];
  for (const [n, f] of Object.entries(UP)) if (f(b) < f(a)) { console.log(`✗ ${name(order[k])} ${n} ${f(a)} → ${f(b)} (앞: ${name(order[k - 1])})`); bad++; }
  for (const [n, f] of Object.entries(DOWN)) if (f(b) > f(a)) { console.log(`✗ ${name(order[k])} ${n} ${f(a)} → ${f(b)} (앞: ${name(order[k - 1])})`); bad++; }
  // 사이드 가짓수: 아이스크림은 사용자가 정한 대로 10월드에만 (어려움 9월드는 쉬움 10월드보다 하나 적어도 됨)
  const sa = a.sides.filter((x) => x !== 'icecream').length, sb = b.sides.filter((x) => x !== 'icecream').length;
  if (sb < sa) { console.log(`✗ ${name(order[k])} 사이드 ${sa} → ${sb}`); bad++; }
}
// 같은 난이도 안 1판 → 100판
for (const h of [0, HARD]) for (let i = h + 1; i < h + HARD; i++) {
  const a = STAGES[i - 1], b = STAGES[i];
  if (b.guests < a.guests || b.wait > a.wait || b.fill[1] < a.fill[1] || b.ing.length < a.ing.length) { console.log(`✗ ${name(i)} 앞 판보다 쉬움`); bad++; }
}
// 느린 손 로봇: 손님은 순서대로, 한 번에 한 주문씩. 가장 큰 주문(재료 최대·사이드 최대)만 나온다고 보고
const { avgTaps } = ctx.window.BurgerLevels;
const maxTaps = (s) => { const n = s.fill[1], p = s.dbl && n >= 3 ? 2 : 1; return n + p + 2 + s.sideMax; };
function sim(s, T) {
  const arrive = []; const done = []; let botFree = 0, worst = 1;
  for (let g = 0; g < s.guests; g++) {
    // 다음 손님: 앞 손님 + 간격, 카운터가 꽉 차면 자리가 날 때까지
    let t = g ? arrive[g - 1] + s.gap : 1;
    if (g >= s.conc) t = Math.max(t, done[g - s.conc]);
    arrive.push(t);
    const start = Math.max(t, botFree);
    const fin = start + avgTaps(s) * T + s.cook * 0.5; // 굽는 시간은 반쯤 다른 재료를 놓는 동안 지나감
    done.push(fin); botFree = fin;
    worst = Math.min(worst, 1 - (fin - t) / s.wait);
  }
  return worst; // 가장 아슬아슬했던 손님의 남은 기다림 비율 (0 아래면 놓침)
}
let tight = [];
STAGES.forEach((s, i) => {
  const left = sim(s, i >= HARD ? 0.75 : 0.9);
  if (maxTaps(s) * (i >= HARD ? 0.75 : 0.9) + s.cook > s.wait * 0.6) { console.log(`✗ ${name(i)} 가장 큰 주문이 너무 오래 걸림`); bad++; }
  if (left < 0.05) { console.log(`✗ ${name(i)} 느린 손으로는 손님을 놓침 (남은 기다림 ${(left * 100).toFixed(0)}%)`); bad++; }
  tight.push([left, i]);
});
tight.sort((a, b) => a[0] - b[0]);
console.log('가장 빠듯한 판:', tight.slice(0, 5).map(([l, i]) => `${name(i)} ${(l * 100).toFixed(0)}%`).join(' · '));
const show = (i) => { const s = STAGES[i]; return `${name(i).padEnd(9)} 재료${s.ing.length + 1} 속${s.fill.join('~')}${s.dbl ? '(2장)' : ''} 사이드[${s.sides.join(',')}]≤${s.sideMax} 굽${s.cook} 탐${s.burn || '-'} 대기${s.wait} 손님${s.guests} 동시${s.conc} 간격${s.gap} 칸${s.grills} 쟁반${s.trays}`; };
for (const i of [0, 9, 10, 99, 100, 199]) console.log(show(i));
if (bad) { console.log(`✗ 문제 ${bad}개`); process.exit(1); }
console.log('✓ 200판 모두 사다리 순서대로 쉬워지지 않고, 느린 손으로도 깰 수 있어요');
