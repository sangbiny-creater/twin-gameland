'use strict';
// 트윈 게임랜드 주간 랭킹 (세로 전용)
//  · 위: 뒤로 · 제목 띠(고른 게임 이름) / 주간·전체 탭 / 주간이면 기간(일요일~토요일) / 게임 고르기 줄(좌우로 밀기, 첫 화면 놀이기구 그림)
//  · 순위표: 1·2·3등은 메달·금은동 줄·월계수 테두리(1등은 왕관), 4~20등은 보통 줄. 내 줄은 분홍 줄
//  · 내가 20등 밖이면 맨 아래에 내 등수 칸을 따로
//  · 지금은 서버(Firebase records) 연결 전이라 다른 사람 순위는 예시. 내 점수만 이 기기 저장 데이터에서 읽음
//    서버 연결 때: records 의 week 가 지금 ISO 주(월~일)라서, 사용자 결정(일~토)에 맞춰 바꿔야 함 (common/auth.js week)
const $ = (id) => document.getElementById(id);
const V = '?v=202611102101';
if (!window.Hub || !Hub.active()) location.replace('../index.html');
const { blip } = window.UI;
const EN = window.I18N && I18N.lang === 'en';
const tr = (s) => (window.I18N && I18N.tr ? I18N.tr(s) : s);

// 게임 순서 = 첫 화면 놀이기구 순서 (hub.js GAME_CARDS)
const GAMES = ['helicopter', 'stairs', 'shisen', 'downhill', 'memory', 'mole', 'bakery', 'dogsnack', 'darts', 'giftsort', 'burger'];
const NAME = { skyhook: ['스카이훅 러너', 'Sky Hook Runner'], helicopter: ['스카이 라이더', 'Sky Rider'], stairs: ['계단 오르기', 'Stair Climb'],
  shisen: ['사천성', 'Mahjong Connect'], downhill: ['다운힐 러너', 'Downhill Runner'], memory: ['메모리 게임', 'Memory Match'], mole: ['두더지 게임', 'Whack-a-Mole'],
  bakery: ['달콤 베이커리', 'Sweet Bakery'], dogsnack: ['멍멍이 간식 타임', 'Feed the Puppy'], darts: ['다트게임', 'Darts'], giftsort: ['선물가게 정리', 'Gift Sort'], burger: ['버거 러시', 'Burger Rush'] };
const gname = (g) => NAME[g][EN ? 1 : 0];
const TOP = 20;

const q = new URLSearchParams(location.search);
let mode = q.get('mode') === 'all' ? 'all' : 'week';
let game = GAMES.includes(q.get('game')) ? q.get('game') : (() => { try { return sessionStorage.getItem('twin_rank_game') || GAMES[0]; } catch (e) { return GAMES[0]; } })();
if (!GAMES.includes(game)) game = GAMES[0];

// ---------- 기간: 이번 주 일요일 ~ 토요일 ----------
function weekRange(now = new Date()) {
  const s = new Date(now); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() - s.getDay());
  const e = new Date(s); e.setDate(s.getDate() + 6);
  return [s, e];
}
function periodText() {
  const [s, e] = weekRange();
  if (EN) {
    const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${M[s.getMonth()]} ${s.getDate()} (Sun) – ${M[e.getMonth()]} ${e.getDate()} (Sat)`;
  }
  return `${s.getMonth() + 1}월 ${s.getDate()}일(일) ~ ${e.getMonth() + 1}월 ${e.getDate()}일(토)`;
}

// ---------- 내 점수 (이 기기): 끝없는 게임 = 최고 기록, 징검다리 게임 = 모은 별 ----------
function myScore(g) {
  const c = Hub.active(), r = c.games && c.games[g];
  if (!r) return 0;
  if (Hub.GAMES[g] && Hub.GAMES[g].stages) return Object.values(r.stages || {}).reduce((n, x) => n + (x.stars || 0), 0);
  return r.best || 0;
}
const myFace = () => { const c = Hub.active(); return Hub.costumeImg(c, '../') || `../common/faces/${c.look}_base.webp${V}`; };

// ---------- 예시 순위 (서버 연결 전) ----------
const NICK = ['별빛토끼', '하늘고래', '딸기우유', '구름빵', '초코칩', '반짝이', '솜사탕', '레몬캔디', '푸딩왕', '꿀벌이', '해바라기', '바다소리', '젤리곰',
  '민트초코', '눈송이', '복숭아', '무지개', '쿠키몬', '도토리', '파랑새', '보리차', '감귤이', '마카롱', '팝콘', '새싹이', '달토끼', '체리', '호떡', '사과잼', '라떼'];
const NICK_EN = ['StarBunny', 'SkyWhale', 'StrawberryMilk', 'CloudBun', 'ChocoChip', 'Sparkle', 'CottonCandy', 'LemonDrop', 'PuddingKing', 'HoneyBee', 'Sunflower', 'SeaBreeze', 'JellyBear',
  'MintChoco', 'Snowflake', 'Peachy', 'Rainbow', 'CookieMon', 'Acorn', 'Bluebird', 'BarleyTea', 'Tangerine', 'Macaron', 'Popcorn', 'Sprout', 'MoonBunny', 'Cherry', 'Hotteok', 'AppleJam', 'Latte'];
const BASE = { helicopter: 3000, stairs: 900, shisen: 300, downhill: 6000, memory: 300, mole: 9000, bakery: 12000, dogsnack: 15000, darts: 900, giftsort: 300, burger: 8000 };
function seeded(str) { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; }
function sample(g, m) {
  const rnd = seeded(g + m + weekRange()[0].toDateString()), top = BASE[g] * (m === 'week' ? 0.6 : 1), out = [];
  const order = NICK.map((_, i) => i).sort(() => rnd() - 0.5); // 이름이 겹치지 않게
  for (let i = 0; i < NICK.length; i++) {
    const k = order[i];
    out.push({ name: EN ? NICK_EN[k] : NICK[k], score: Math.max(1, Math.round(top * Math.pow(0.93, i) * (0.97 + rnd() * 0.06))), face: `../common/faces/${rnd() < 0.5 ? 'eunyu3' : 'eungyeol3'}_base.webp${V}` });
  }
  return out;
}
function board(g, m) {
  const c = Hub.active(), list = sample(g, m), me = { name: c.name, score: myScore(g), face: myFace(), me: true };
  list.push(me); list.sort((a, b) => b.score - a.score || (a.me ? -1 : b.me ? 1 : 0));
  list.forEach((x, i) => { x.rank = i + 1; });
  return { list, me };
}

// ---------- 그리기 ----------
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
function rowHTML(x, cls) {
  const top3 = x.rank <= 3, k = top3 ? x.rank : 0;
  const rank = top3 ? `<span class="r-rank medal" style="background-image:url(assets/ui/medal${k}.webp${V})"><b>${x.rank}</b></span>`
    : `<span class="r-rank badge" style="background-image:url(assets/ui/badge.webp${V})"><b>${x.rank}</b></span>`;
  const face = `<span class="r-face${top3 ? ' f' + k : ''}"><img class="ph" src="${x.face}" alt=""><img class="fr" src="assets/ui/frame${top3 ? k : ''}.webp${V}" alt="">${k === 1 ? `<img class="crown" src="assets/ui/crown.webp${V}" alt="">` : ''}</span>`;
  return `<li class="rk-row ${cls}">${rank}${face}<span class="r-name">${esc(x.name)}</span><span class="r-score"><img src="assets/ui/star.webp${V}" alt="">${x.score.toLocaleString()}</span></li>`;
}
function render() {
  $('title').textContent = gname(game);
  document.querySelectorAll('.rk-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
  $('period').classList.toggle('hidden', mode !== 'week');
  $('periodText').textContent = periodText();
  document.querySelectorAll('.rk-gbtn').forEach((b) => b.classList.toggle('on', b.dataset.g === game));
  const { list, me } = board(game, mode);
  $('list').innerHTML = list.slice(0, TOP).map((x) => rowHTML(x, x.me ? 'me' : x.rank <= 3 ? 'top' + x.rank : '')).join('');
  const out = me.rank > TOP;
  $('mine').classList.toggle('hidden', !out);
  document.body.classList.toggle('has-mine', out);
  if (out) $('mine').innerHTML = `<ol class="rk-list">${rowHTML(me, 'mine')}</ol>`;
}
function buildGames() {
  $('games').innerHTML = GAMES.map((g) => `<button class="rk-gbtn" data-g="${g}" aria-label="${esc(gname(g))}"><img class="on" src="assets/ui/game_on.webp${V}" alt=""><img class="off" src="assets/ui/game_off.webp${V}" alt=""><img class="ride" src="../hub/park/rides/${g}.webp${V}" alt=""></button>`).join('');
  $('games').addEventListener('click', (e) => {
    const b = e.target.closest('.rk-gbtn'); if (!b || b.dataset.g === game) return;
    blip(); game = b.dataset.g; try { sessionStorage.setItem('twin_rank_game', game); } catch (er) { /* ignore */ }
    render(); b.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  });
  const sc = $('games'), step = () => sc.clientWidth * 0.7;
  $('arrL').onclick = () => { blip(); sc.scrollBy({ left: -step(), behavior: 'smooth' }); };
  $('arrR').onclick = () => { blip(); sc.scrollBy({ left: step(), behavior: 'smooth' }); };
  const arrows = () => { $('arrL').classList.toggle('dim', sc.scrollLeft < 4); $('arrR').classList.toggle('dim', sc.scrollLeft > sc.scrollWidth - sc.clientWidth - 4); };
  sc.addEventListener('scroll', arrows, { passive: true }); setTimeout(arrows, 50);
  const cur = sc.querySelector(`[data-g="${game}"]`); if (cur) setTimeout(() => cur.scrollIntoView({ inline: 'center', block: 'nearest' }), 0);
}
document.querySelectorAll('.rk-tabs button').forEach((b) => b.addEventListener('click', () => { if (b.dataset.mode === mode) return; blip(); mode = b.dataset.mode; render(); }));
$('note').textContent = tr($('note').textContent);
buildGames(); render();
