// tools/load_check.mjs 결과(load_report.json)를 한국어 검사표(Markdown)로
//   node tools/load_report.mjs <load_report.json> [제목] > docs/qa/....md
import fs from 'node:fs';

const [file, title = '화면 한 번에 뜨기 검사'] = process.argv.slice(2);
const R = JSON.parse(fs.readFileSync(file, 'utf8'));
const GAME = { skyhook: '스카이훅', helicopter: '스카이 라이더', stairs: '계단 오르기', shisen: '사천성', downhill: '다운힐', memory: '메모리', mole: '두더지', bakery: '달콤 베이커리', dogsnack: '멍멍이 간식 타임', darts: '다트', giftsort: '선물가게 정리', burger: '버거 러시' };
const VP = { pp: '폰 세로', pl: '폰 가로', tb: '태블릿' };
function screen(name) {
  let m;
  const again = name.startsWith('again-'); const n = again ? name.slice(6) : name;
  let s;
  if (n === 'hub-select') s = '첫 화면 · 캐릭터 고르기';
  else if (n === 'hub-first-visit') s = '첫 화면 · 처음 온 사람(로그인 창)';
  else if (n.startsWith('hub-lobby-to-map')) s = '놀이공원 → 지도 → 놀이공원';
  else if (n === 'hub-lobby-eungyeol') s = '놀이공원 (은결)';
  else if (n.startsWith('hub-lobby')) s = '놀이공원';
  else if (n === 'hub-select-to-lobby') s = '캐릭터 고르기 → 놀이공원';
  else if (n === 'hub-popups') s = '놀이공원 창들 (설정·다이아·동상·대문)';
  else if ((m = n.match(/^hub-intro-(\w+)/))) s = `인트로 (${GAME[m[1]]})`;
  else if ((m = n.match(/^hub-map-(\w+)/))) s = `스테이지 지도 (${GAME[m[1]]})`;
  else if (n === 'hub-records') s = '기록 화면';
  else if ((m = n.match(/^game-(\w+?)(-go|-pl)?$/))) s = `${GAME[m[1]]} 게임` + (m[2] === '-go' ? ' (인트로 START로 바로)' : '');
  else if (n.startsWith('closet')) s = '옷장';
  else if (n.startsWith('shop')) s = '아이템샵';
  else s = n;
  return (again ? '다시 열기 · ' : '') + s;
}
const STEP = { load: '처음 열 때' };
const KIND = {
  'img-missing': '그림이 빈 채로 먼저 보임', 'img-late': '그림이 늦게 나타남', 'css-missing': '꾸밈 그림(배경·틀)이 빈 채로 먼저 보임', 'css-late': '꾸밈 그림(배경·틀)이 늦게 나타남',
  'font-late': '글꼴이 늦게 바뀜', shift: '화면 조각이 밀림', 'panel-resize': '창 크기가 바뀜(커졌다 줄었다)', 'img-resize': '그림 크기가 바뀜',
  'draw-missing': '게임 판 그림이 빈 채로 그려짐', 'draw-late': '게임 판 그림이 늦게 그려짐',
};
const file2 = (src) => (src || '').replace(/^\//, '').replace(/\?.*$/, '');
const rows = [];
let fail = 0, pass = 0;
for (const [name, r] of Object.entries(R)) {
  if (r.error) { rows.push([screen(name), VP[name.match(/-(pl|tb)$/)?.[1]] || '폰 세로', '-', '검사 못 함', r.error]); fail++; continue; }
  const vp = VP[r.vp] || r.vp;
  for (const step of r.steps) {
    const ev = r.events.filter((e) => e.step === step && e.k !== 'reveal');
    const rv = r.events.find((e) => e.step === step && e.k === 'reveal');
    const errs = (r.errors || []).filter((e) => !e.startsWith('TAB'));
    const ok = !ev.length;
    ok ? pass++ : fail++;
    const by = {};
    for (const e of ev) (by[e.k] = by[e.k] || []).push(file2(e.src) || e.what + (e.from ? ` ${e.from}→${e.to}` : '') || e.font);
    const why = Object.entries(by).map(([k, l]) => `${KIND[k] || k}: ${[...new Set(l)].slice(0, 6).join(', ')}${new Set(l).size > 6 ? ` 외 ${new Set(l).size - 6}개` : ''}`).join('<br>');
    const note = [step === 'load' && rv ? `${(rv.t / 1000).toFixed(1)}초에 한 번에 보임` : '', step === 'load' && errs.length ? `오류: ${errs.slice(0, 2).join(' / ')}` : ''].filter(Boolean).join(' · ');
    rows.push([screen(name), vp, STEP[step] || step, ok ? '✅ Pass' : '❌ Fail', [why, note].filter(Boolean).join('<br>')]);
  }
}
const out = [];
out.push(`# ${title}`, '');
out.push(`- 검사 도구: \`tools/load_check.mjs\` (헤드리스 Chrome, **느린 4G**(지연 0.56초·1.4Mbps), 화면마다 **빈 캐시**로 새로 방문 / '다시 열기'는 한 번 연 뒤 캐시가 있는 상태로 다시)`);
out.push('- Fail 기준: 화면이 보이기 시작한 뒤에 그림이 하나라도 늦게 나타남 · 그림이 빈 채로 보임 · 그림/창 크기가 바뀜 · 글꼴이 바뀜 · 화면 조각이 밀림 · 게임 판 그림이 늦게 그려짐');
out.push('- 로딩 화면(로딩 막대)으로 가려 둔 동안은 검사하지 않음: 다 준비된 뒤 **한 번에** 보이면 Pass');
out.push(`- 결과: **Pass ${pass}개 · Fail ${fail}개** (항목 ${pass + fail}개)`, '');
out.push('| 화면 | 크기 | 단계 | 결과 | 무엇이 문제인지 / 메모 |', '|---|---|---|---|---|');
for (const r of rows) out.push(`| ${r.map((x) => String(x).replace(/\|/g, '/')).join(' | ')} |`);
console.log(out.join('\n'));
