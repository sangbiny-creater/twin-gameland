'use strict';
// 트윈 게임랜드 주간 랭킹 (세로 전용)
//  · 위: 뒤로 · 제목 띠(고른 게임 이름) / 주간·전체 탭 / 주간이면 기간(일요일~토요일) / 게임 고르기 줄(좌우로 밀기, 첫 화면 놀이기구 그림)
//  · 순위표: 1·2·3등은 메달·금은동 줄·월계수 테두리(1등은 왕관), 4~20등은 보통 줄. 내 줄은 분홍 줄
//  · 내가 20등 밖이면 맨 아래에 내 등수 칸을 따로
//  · 순위 = 서버(Firebase Firestore records: 게임이 끝날 때마다 common/auth.js 가 올림)에서 캐릭터마다 가장 좋은 기록
//    끝없는 게임 = 한 판 최고 점수(score), 징검다리 게임 = 판마다 가장 많이 받은 별을 모두 더한 것
//    주간 = 이번 주 일요일~토요일(records.day 7일), 전체 = 그 게임 기록 전부. 지금은 화면에서 계산 (사람이 많아지면 서버에서 미리 계산하기)
const $ = (id) => document.getElementById(id);
const V = '?v=202611111943';
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

// ---------- 내 점수 (이 기기): 끝없는 게임 = 최고 기록, 징검다리 게임 = 모은 별 (서버 기록보다 크면 전체 순위에서 이 값을 씀) ----------
const isStage = (g) => !!(Hub.GAMES[g] && Hub.GAMES[g].stages);
function myScore(g) {
  const c = Hub.active(), r = c.games && c.games[g];
  if (!r) return 0;
  if (isStage(g)) return Object.values(r.stages || {}).reduce((n, x) => n + (x.stars || 0), 0);
  return r.best || 0;
}
const myFace = () => { const c = Hub.active(); return Hub.costumeImg(c, '../') || `../common/faces/${c.look}_base.webp${V}`; };
// 서버 기록의 얼굴 그림은 저장소 안 그림만 (다른 글이 들어와도 화면에 넣지 않게)
const faceOf = (f, look) => (/^common\/(faces|costumes)\/[a-z0-9_]+\.webp$/.test(f || '') ? `../${f}${V}`
  : `../common/faces/${/^[a-z0-9]+$/.test(look || '') ? look : 'eunyu3'}_base.webp${V}`);

// ---------- 서버 순위 ----------
const waitAuth = () => new Promise((ok) => { let n = 0; const t = setInterval(() => { if (window.Auth || ++n > 40) { clearInterval(t); ok(window.Auth || null); } }, 100); });
async function server() {
  const A = await waitAuth(); if (!A) return null;
  const fb = await A.firebase(); if (!fb) return null;
  if (!fb.auth.currentUser) { try { await fb.auth.signInAnonymously(); } catch (e) { return null; } }
  try { A.flush(); } catch (e) { /* ignore */ }
  return fb;
}
const days = () => { const [s] = weekRange(), out = []; for (let i = 0; i < 7; i++) { const d = new Date(s); d.setDate(s.getDate() + i); out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`); } return out; };
const cache = {};
// ---------- 순위 스냅샷 (서버가 매시 정각에 찍어 둔 순위표 1개만 읽음, server/functions/rank.js) ----------
//  ranks/_meta 가 3시간 안이면 서버 스냅샷을 씀. 서버 함수가 아직 없으면(요금제 Blaze 전) 예전처럼 기록을 직접 읽어 계산
const HOUR = 3600e3;
let metaP = null, snapAt = 0;
const meta = (fb) => metaP || (metaP = fb.db.collection('ranks').doc('_meta').get().then((s) => (s.exists && Date.now() - (s.data().at || 0) < 3 * HOUR ? s.data() : null)).catch(() => null));
const wkId = () => { const [s] = weekRange(); return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`; };
async function fetchSnap(fb, g, m) {
  const [mt, d] = await Promise.all([meta(fb), fb.db.collection('ranks').doc(m === 'week' ? `${g}_w${wkId()}` : `${g}_all`).get().catch(() => null)]);
  if (!mt) return null;
  const top = (d && d.exists && d.data().top) || [];
  snapAt = Math.max(mt.at || 0, (d && d.exists && d.data().at) || 0);
  return { uid: fb.auth.currentUser.uid, list: top.map((x) => ({ uid: x.uid, cid: x.cid, name: x.name || '?', face: faceOf(x.face, x.look), score: x.score || 0 })) };
}
async function fetchBoard(g, m) {
  const fb = await server(); if (!fb) return null;
  const sn = await fetchSnap(fb, g, m); if (sn) return sn;
  snapAt = 0;
  let qy = fb.db.collection('records').where('game', '==', g);
  if (m === 'week') qy = qy.where('day', 'in', days()); // 같음 조건만 → 서버에 새 색인을 만들지 않아도 됨
  const snap = await qy.limit(5000).get(), stage = isStage(g), P = new Map();
  snap.forEach((doc) => {
    const r = doc.data(); if (!r.uid) return;
    const k = r.uid + '|' + (r.cid || r.name || ''), p = P.get(k) || { uid: r.uid, cid: r.cid, name: '', face: '', at: 0, best: 0, st: {} };
    if (stage) { if (r.stage != null && (r.stars || 0) > (p.st[r.stage] || 0)) p.st[r.stage] = r.stars || 0; } else p.best = Math.max(p.best, r.score || 0);
    if ((r.at || 0) >= p.at) { p.at = r.at || 0; p.name = r.name || '?'; p.face = faceOf(r.face, r.look); }
    P.set(k, p);
  });
  return { uid: fb.auth.currentUser.uid, list: [...P.values()].map((p) => ({ uid: p.uid, cid: p.cid, name: p.name, face: p.face, score: stage ? Object.values(p.st).reduce((n, x) => n + x, 0) : p.best })) };
}
async function board(g, m) {
  const key = g + m;
  if (!cache[key]) cache[key] = fetchBoard(g, m).catch((e) => { console.warn('rank', e); delete cache[key]; return null; });
  const got = await cache[key], c = Hub.active();
  const me = { name: c.name, face: myFace(), me: true, score: 0, rank: '-' };
  if (!got) return { ok: false, list: [], me };
  const list = got.list.filter((x) => !(x.uid === got.uid && (x.cid === c.id || (!x.cid && x.name === c.name))));
  const mine = got.list.find((x) => x.uid === got.uid && (x.cid === c.id || (!x.cid && x.name === c.name)));
  me.score = Math.max(mine ? mine.score : 0, m === 'all' ? myScore(g) : 0);
  const all = list.filter((x) => x.score > 0);
  if (me.score > 0) all.push(me);
  all.sort((a, b) => b.score - a.score || (a.me ? -1 : b.me ? 1 : 0));
  all.forEach((x, i) => { x.rank = i + 1; });
  return { ok: true, list: all, me };
}

// ---------- 그리기 ----------
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
function rowHTML(x, cls) {
  const top3 = typeof x.rank === "number" && x.rank <= 3, k = top3 ? x.rank : 0;
  const rank = top3 ? `<span class="r-rank medal" style="background-image:url(assets/ui/medal${k}.webp${V})"><b>${x.rank}</b></span>`
    : `<span class="r-rank badge" style="background-image:url(assets/ui/badge.webp${V})"><b>${x.rank}</b></span>`;
  const face = `<span class="r-face${top3 ? ' f' + k : ''}"><img class="ph" src="${x.face}" alt=""><img class="fr" src="assets/ui/frame${top3 ? k : ''}.webp${V}" alt="">${k === 1 ? `<img class="crown" src="assets/ui/crown.webp${V}" alt="">` : ''}</span>`;
  return `<li class="rk-row ${cls}">${rank}${face}<span class="r-name">${esc(x.name)}</span><span class="r-score"><img src="assets/ui/star.webp${V}" alt="">${x.score ? x.score.toLocaleString() : '-'}</span></li>`;
}
// '오후 3시 기준 · 매시 정각에 새로 매겨요'
function snapText(at) {
  const d = new Date(Math.floor(at / HOUR) * HOUR), h = d.getHours();
  return EN ? `Rankings as of ${(h % 12) || 12} ${h < 12 ? 'AM' : 'PM'} · updated every hour` : `${h < 12 ? '오전' : '오후'} ${(h % 12) || 12}시 기준 순위 · 매시 정각에 새로 매겨요`;
}
let ticket = 0;
async function render() {
  $('title').textContent = gname(game);
  document.querySelectorAll('.rk-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
  $('period').classList.toggle('hidden', mode !== 'week');
  $('periodText').textContent = periodText();
  document.querySelectorAll('.rk-gbtn').forEach((b) => b.classList.toggle('on', b.dataset.g === game));
  const t = ++ticket;
  $('list').innerHTML = ''; $('note').textContent = tr('순위를 불러오는 중이에요…'); $('note').classList.remove('hidden');
  const { ok, list, me } = await board(game, mode);
  if (t !== ticket) return; // 그새 다른 게임·탭을 누름
  $('list').innerHTML = list.slice(0, TOP).map((x) => rowHTML(x, x.me ? 'me' : x.rank <= 3 ? 'top' + x.rank : '')).join('');
  $('note').textContent = !ok ? tr('순위를 불러오지 못했어요. 인터넷 연결을 확인해 주세요')
    : !list.length ? tr(mode === 'week' ? '이번 주 기록이 아직 없어요. 첫 번째 주인공이 되어 보세요!' : '아직 기록이 없어요. 첫 번째 주인공이 되어 보세요!')
    : snapAt ? snapText(snapAt) : '';
  $('note').classList.toggle('hidden', !$('note').textContent);
  const out = !(typeof me.rank === 'number' && me.rank <= TOP);
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
buildGames(); render();
