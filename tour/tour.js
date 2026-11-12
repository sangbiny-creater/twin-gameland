'use strict';
// 그룹투어 (Group Tour, 게임의 길드) — 첫 화면 매표소를 누르면 나오는 화면
//  · 투어 = 그룹. 만든 사람 = 투어가이드, 들어온 사람 = 투어멤버 (캐릭터마다: 은유·은결이 각각 다른 투어에 들 수 있음)
//  · 대화창 없음: 투어가이드만 공지글을 올리고, 멤버는 그 공지에 이모티콘만 달 수 있음 (한 사람이 공지 하나에 이모티콘 1개, 바꿀 수 있음)
//  · 들어가기: 투어 목록에서 '누구나 가입' 투어를 골라 가입 / 친구가 보낸 초대 코드(링크 tour/?code=XXXXXX)로 가입
//  · 탭 ① 우리 투어(없으면 투어 찾기) ② 이벤트 ③ 투어 랭킹
//  · 투어 랭킹(주간, 일요일~토요일): 이번 주 멤버들의 투어 포인트 합 — 판 하나 끝내면 10점 + 받은 별 하나에 10점 (투어에 들어온 뒤의 기록만)
//  · 주 1회 이벤트(백오피스 'Group Tour' 탭에서 운영자가 시간·게임·보상을 정함, config/guild.event):
//      시작 시각부터 1시간 동안 그 게임을 한 기록만 셈.
//      보상 순위 = 멤버마다 가장 높은 점수 한 판을 모두 더한 것 → 1·2·3등 투어와 참가한 투어에 다이아
//      투어 랭킹 = 그 1시간 동안 멤버들이 한 모든 판의 점수를 더한 것 → 발표
//  · 서버(Firebase Firestore): tours/{id} 문서 하나에 투어 정보·멤버(mem)·공지(notice)·이모티콘(reacts)을 같이 둠
//    점수는 게임이 끝날 때마다 올라가는 records(common/auth.js)에서 계산 (지금은 화면에서 계산, 사람이 많아지면 서버에서 미리 계산하기)
//    누가 무엇을 바꿀 수 있는지는 server/firestore.rules 의 tours 칸
//  · 이 기기 기억: localStorage 'twin_tour_v1' (어느 투어에 들었는지 · 받은 이벤트 보상). 게임 저장 데이터 twin_gameland_v1 은 다이아만 더함
const $ = (id) => document.getElementById(id);
const V = '?v=202611121949';
if (!window.Hub || !Hub.active()) location.replace('../index.html');
const { blip, toast: toast0 } = window.UI;
const EN = window.I18N && I18N.lang === 'en';
const tr = (s) => (window.I18N && I18N.tr ? I18N.tr(s) : s);
const toast = (s) => toast0(tr(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const C = Hub.active();
// 내 캐릭터 ID (6자리, common/names.js): 친구에게 알려 주면 친구가 ID 로 초대할 수 있음
const myIdHTML = () => (C.pid ? `<small class="my-id">${tr('내 ID')} <b translate="no">${C.pid}</b></small>` : '');
const MAX = 20;                     // 투어 한 곳 최대 인원 (백오피스 config/guild.maxMembers 로 바꿈)
const PLAY_PT = 10, STAR_PT = 10;   // 투어 포인트: 판 하나 끝내면 10점, 별 하나에 10점
const MARKS = [1, 2, 3, 4, 5, 6, 7]; // 투어 마크 = 첫 화면 분수 그림 (hub/park/items/fountain_N.webp) — 나중에 전용 그림으로
const markImg = (n) => `../hub/park/items/fountain_${MARKS.includes(+n) ? +n : 1}.webp${V}`;
// 이모티콘: 하트는 모든 게임과 같은 하트 그림(common/ui/heart.webp), 나머지는 글자 이모티콘 (나중에 GPT 그림으로)
const EMO = [['heart', ''], ['like', '👍'], ['clap', '👏'], ['fun', '😆'], ['wow', '😮'], ['fire', '🔥'], ['party', '🎉']];
const emoHTML = (k) => { const e = EMO.find((x) => x[0] === k); if (!e) return ''; return e[0] === 'heart' ? `<img class="emo-img" src="../common/ui/heart.webp${V}" alt="">` : `<i class="emo">${e[1]}</i>`; };
// 이벤트에 고를 수 있는 게임 = 점수가 있는 끝없는 게임 (백오피스와 같게)
const NAME = { helicopter: ['스카이 라이더', 'Sky Rider'], stairs: ['계단 오르기', 'Stair Climb'], downhill: ['다운힐 러너', 'Downhill Runner'],
  bakery: ['달콤 베이커리', 'Sweet Bakery'], dogsnack: ['멍멍이 간식 타임', 'Feed the Puppy'], darts: ['다트게임', 'Darts'] };
const gname = (g) => (NAME[g] ? NAME[g][EN ? 1 : 0] : g);

// ---------- 이 기기 기억 (twin_tour_v1) ----------
const LKEY = 'twin_tour_v1';
const local = (() => { try { return JSON.parse(localStorage.getItem(LKEY)) || {}; } catch (e) { return {}; } })();
local.my = local.my || {}; local.got = local.got || {};
const saveLocal = () => { try { localStorage.setItem(LKEY, JSON.stringify(local)); } catch (e) { /* ignore */ } };

// ---------- 시간 ----------
const pad = (n) => String(n).padStart(2, '0');
const day = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const wk = (ms) => { const d = new Date(ms); d.setDate(d.getDate() - d.getDay()); return day(d.getTime()); }; // common/auth.js 와 같음 (일요일 시작 주)
const WD = EN ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['일', '월', '화', '수', '목', '금', '토'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function clock(ms) {
  const d = new Date(ms), h = d.getHours(), m = pad(d.getMinutes());
  return EN ? `${(h % 12) || 12}:${m} ${h < 12 ? 'AM' : 'PM'}` : `${h < 12 ? '오전' : '오후'} ${(h % 12) || 12}:${m}`;
}
const dateText = (ms) => { const d = new Date(ms); return EN ? `${MON[d.getMonth()]} ${d.getDate()} (${WD[d.getDay()]})` : `${d.getMonth() + 1}월 ${d.getDate()}일(${WD[d.getDay()]})`; };
function left(ms) { // 남은 시간 글
  const s = Math.max(0, Math.floor(ms / 1000)), D = Math.floor(s / 86400), H = Math.floor((s % 86400) / 3600), M = Math.floor((s % 3600) / 60), S = s % 60;
  if (EN) return D ? `${D}d ${H}h` : H ? `${H}h ${M}m` : `${M}:${pad(S)}`;
  return D ? `${D}일 ${H}시간` : H ? `${H}시간 ${M}분` : `${M}분 ${pad(S)}초`;
}
function weekRange(now = Date.now()) {
  const s = new Date(now); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() - s.getDay());
  const e = new Date(s); e.setDate(s.getDate() + 6);
  return [s, e];
}
// '오후 3시 기준 순위 · 매시 정각에 새로 매겨요' (서버 스냅샷)
function snapText(at) { const h = new Date(Math.floor(at / 3600e3) * 3600e3).getHours(); return EN ? `Rankings as of ${(h % 12) || 12} ${h < 12 ? 'AM' : 'PM'} · updated every hour` : `${h < 12 ? '오전' : '오후'} ${(h % 12) || 12}시 기준 순위 · 매시 정각에 새로 매겨요`; }
const periodText = () => { const [s, e] = weekRange(); return `${dateText(s)} ~ ${dateText(e)}`; };

// ---------- 서버 ----------
let fb = null, uid = '', mid = '';
let cfg = { open: true, maxMembers: MAX, event: null }; // config/guild
let tours = [];  // 모든 투어 (최대 200)
let mine = null; // 내 투어
let tab = 'home', evTab = 'best';
const waitAuth = () => new Promise((ok) => { let n = 0; const t = setInterval(() => { if (window.Auth || ++n > 40) { clearInterval(t); ok(window.Auth || null); } }, 100); });
async function server() {
  const A = await waitAuth(); if (!A) return null;
  const f = await A.firebase(); if (!f) return null;
  if (!f.auth.currentUser) { try { await f.auth.signInAnonymously(); } catch (e) { return null; } }
  try { A.flush(); } catch (e) { /* ignore */ }
  return f;
}
const T = () => fb.db.collection('tours');
const myInfo = () => { const f = (Hub.costumeImg && Hub.costumeImg(C)) || `common/faces/${C.look}_base.webp`; return { n: C.name, f: f.split('?')[0], uid, p: C.pid || '' }; };
const faceOf = (f) => (/^common\/(faces|costumes)\/[a-z0-9_]+\.webp$/.test(f || '') ? `../${f}${V}` : `../common/faces/eunyu3_base.webp${V}`);
const memList = (t) => Object.entries(t.mem || {}).map(([k, m]) => ({ k, ...m })).sort((a, b) => (a.k === guideKey(t) ? -1 : b.k === guideKey(t) ? 1 : (a.at || 0) - (b.at || 0)));
const guideKey = (t) => t.gk || '';
const isGuide = () => !!(mine && guideKey(mine) === mid);
const maxOf = (t) => t.max || cfg.maxMembers || MAX;
const count = (t) => (t.mem ? Object.keys(t.mem).length : t._count || 0); // 스냅샷 목록의 투어는 멤버 칸 없이 인원만
const guideName = (t) => (t.mem ? (t.mem[guideKey(t)] || {}).n : t._guide) || '?';
function newCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)]; return s; }

// 처음 불러오기 (읽기를 적게): 설정 1 + 내 투어 1 + 투어 목록(서버 스냅샷 1개, 없으면 투어 문서들) + 내 ID 초대
//  투어 목록·주간 투어 포인트 = 서버가 매시 정각에 찍어 둔 ranks/tours_w{주} (server/functions/rank.js). 서버 함수가 아직 없으면 예전처럼 직접
const HOUR = 3600e3;
let snapOk = null, tourSnap = null, invTours = [];
const wkId = () => wk(Date.now());
async function snapOn() { if (snapOk == null) { try { const s = await fb.db.collection('ranks').doc('_meta').get(); snapOk = s.exists && Date.now() - (s.data().at || 0) < 3 * HOUR; } catch (e) { snapOk = false; } } return snapOk; }
async function loadAll() {
  const FP = fb.F.firestore.FieldPath;
  const [cs] = await Promise.all([fb.db.collection('config').doc('guild').get(), snapOn()]);
  if (cs.exists) cfg = { ...cfg, ...cs.data() };
  // 내 투어: 이 기기에 적어 둔 투어 → 아니면 멤버 칸으로 찾기 (다른 폰에서 가입한 경우)
  mine = null;
  const tid = local.my[C.id];
  if (tid) { try { const d = await T().doc(tid).get(); if (d.exists && (d.data().mem || {})[mid]) mine = { id: d.id, ...d.data() }; } catch (e) { /* ignore */ } }
  if (!mine) { try { const q = await T().where(new FP('mem', mid, 'at'), '>', 0).limit(1).get(); q.forEach((d) => { mine = { id: d.id, ...d.data() }; }); } catch (e) { console.warn('tour mine', e); } }
  // 투어 목록
  tourSnap = null; tours = [];
  if (snapOk) {
    try { const d = await fb.db.collection('ranks').doc('tours_w' + wkId()).get(); tourSnap = d.exists ? d.data() : { at: 0, list: [] }; } catch (e) { tourSnap = null; }
  }
  if (tourSnap) tours = (tourSnap.list || []).map((x) => ({ id: x.id, name: x.name, mark: x.mark, open: x.open, max: x.max, createdAt: x.createdAt, _count: x.count, _guide: x.guide }));
  else { const ts = await T().limit(200).get(); ts.forEach((d) => tours.push({ id: d.id, ...d.data() })); if (!mine) mine = tours.find((t) => t.mem && t.mem[mid]) || null; }
  if (mine) { const i = tours.findIndex((t) => t.id === mine.id); if (i >= 0) tours[i] = mine; else tours.push(mine); }
  // 내 ID 로 온 초대
  invTours = [];
  if (!mine && C.pid) { try { const q = await T().where(new FP('inv', C.pid, 'at'), '>', Date.now() - 7 * 864e5).limit(10).get(); q.forEach((d) => invTours.push({ id: d.id, ...d.data() })); } catch (e) { console.warn('tour inv', e); } }
  if (mine) local.my[C.id] = mine.id; else delete local.my[C.id];
  saveLocal();
}
async function reloadMine() { if (!mine) return; const d = await T().doc(mine.id).get(); if (!d.exists || !(d.data().mem || {})[mid]) { mine = null; await loadAll(); return; } mine = { id: d.id, ...d.data() }; const i = tours.findIndex((t) => t.id === mine.id); if (i >= 0) tours[i] = mine; else tours.push(mine); }

// ---------- 점수 계산 (records) ----------
const recCache = {};
function records(key, make) { if (!recCache[key]) recCache[key] = make().catch((e) => { console.warn('tour rec', e); delete recCache[key]; return null; }); return recCache[key]; }
const keyOf = (r) => `${r.uid}_${r.cid || ''}`;
// 이번 주 투어 포인트: 투어마다 [포인트, 멤버별 포인트]
async function weekBoard() {
  if (tourSnap) { // 서버 스냅샷 (매시 정각)
    const by = new Map((tourSnap.list || []).map((x) => [x.id, x]));
    return tours.map((t) => { const x = by.get(t.id) || { score: 0, by: {} }; return { t, score: x.score || 0, by: x.by || {} }; }).sort((a, b) => b.score - a.score || (a.t.createdAt || 0) - (b.t.createdAt || 0));
  }
  const list = await records('wk', async () => { const s = await fb.db.collection('records').where('wk', '==', wk(Date.now())).limit(5000).get(); const a = []; s.forEach((d) => a.push(d.data())); return a; });
  if (!list) return null;
  const per = new Map();
  for (const r of list) { if (!r.uid) continue; const k = keyOf(r); const a = per.get(k) || []; a.push(r); per.set(k, a); }
  return tours.map((t) => {
    const by = {}; let sum = 0;
    for (const [k, m] of Object.entries(t.mem || {})) {
      const p = (per.get(k) || []).filter((r) => (r.at || 0) >= (m.at || 0)).reduce((n, r) => n + PLAY_PT + (r.stars || 0) * STAR_PT, 0);
      by[k] = p; sum += p;
    }
    return { t, score: sum, by };
  }).sort((a, b) => b.score - a.score || (a.t.createdAt || 0) - (b.t.createdAt || 0));
}
// 이벤트: 투어마다 { best: 멤버 최고 점수 합, total: 모든 판 점수 합, by: 멤버별 {best,total,plays} }
const evEnd = (e) => e.start + (e.min || 60) * 60000;
let evSnap = null;
async function eventBoard(e) {
  if (snapOk) { // 서버 스냅샷 (이벤트 중 10분마다, 끝나고 '최종')
    try { const d = await fb.db.collection('ranks').doc('ev_' + String(e.id).replace(/[^A-Za-z0-9_-]/g, '_')).get(); evSnap = d.exists ? d.data() : { at: 0, list: [] }; } catch (er) { return null; }
    return (evSnap.list || []).map((x) => ({ t: tours.find((t) => t.id === x.id) || { id: x.id, name: x.name, mark: x.mark }, best: x.best, total: x.total, plays: x.plays, by: x.by || {} }));
  }
  const days = [day(e.start)]; if (day(evEnd(e) - 1) !== days[0]) days.push(day(evEnd(e) - 1)); // 이벤트는 1시간이라 하루 또는 이틀(자정을 넘길 때)
  const list = await records('ev' + e.id, async () => { const s = await fb.db.collection('records').where('game', '==', e.game).where('day', 'in', days.slice(0, 10)).limit(5000).get(); const a = []; s.forEach((d) => a.push(d.data())); return a; });
  if (!list) return null;
  const per = new Map();
  for (const r of list) { if (!r.uid || (r.at || 0) < e.start || (r.at || 0) >= evEnd(e)) continue; const k = keyOf(r); const a = per.get(k) || []; a.push(r); per.set(k, a); }
  return tours.map((t) => {
    const by = {}; let best = 0, total = 0, plays = 0;
    for (const [k, m] of Object.entries(t.mem || {})) {
      const rs = (per.get(k) || []).filter((r) => (r.at || 0) >= Math.min(m.at || 0, e.start)); // 이벤트 중에 들어온 멤버는 들어온 뒤의 판만
      const rr = rs.filter((r) => (r.at || 0) >= (m.at || 0));
      if (!rr.length) continue;
      const b = Math.max(...rr.map((r) => r.score || 0)), s = rr.reduce((n, r) => n + (r.score || 0), 0);
      by[k] = { best: b, total: s, plays: rr.length }; best += b; total += s; plays += rr.length;
    }
    return { t, best, total, plays, by };
  }).filter((x) => x.plays > 0);
}
const rewardOf = (e) => ({ r1: 100, r2: 60, r3: 40, join: 10, ...(e.reward || {}) });

// ---------- 그리기 ----------
const view = $('view');
function rowHTML({ rank, img, name, sub, score, cls = '', unit = '', btn = '', face = false }) {
  const top3 = typeof rank === 'number' && rank <= 3;
  const rk = rank == null ? '' : top3 ? `<span class="r-rank medal" style="background-image:url(../ranking/assets/ui/medal${rank}.webp${V})"><b>${rank}</b></span>`
    : `<span class="r-rank badge" style="background-image:url(../ranking/assets/ui/badge.webp${V})"><b>${rank}</b></span>`;
  const pic = face ? `<span class="r-face"><img class="ph" src="${img}" alt=""><img class="fr" src="../ranking/assets/ui/frame.webp${V}" alt=""></span>` : `<span class="r-mark"><img src="${img}" alt=""></span>`;
  return `<li class="tr-row ${cls}">${rk}${pic}<span class="r-text"><b class="r-name" translate="no">${esc(name)}</b>${sub ? `<small>${sub}</small>` : ''}</span>${score != null ? `<span class="r-score">${unit}${Number(score).toLocaleString()}</span>` : ''}${btn}</li>`;
}
const board = (inner, cls = '') => `<section class="tr-board ${cls}">${inner}</section>`;
const btn = (id, text, cls = 'pink') => `<button class="tb ${cls}" id="${id}">${tr(text)}</button>`;
const note = (s) => `<p class="tr-note">${tr(s)}</p>`;

function paintTabs() {
  $('tabHome').textContent = tr(mine ? '우리 투어' : '투어 찾기');
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
}
let drawT = 0;
async function draw() {
  paintTabs();
  const t = ++drawT;
  if (!fb) { view.innerHTML = board(`<div class="tr-hero"><img src="../hub/park/ui/ticket.webp${V}" alt=""><p>${tr('그룹투어 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요')}</p></div>`); return; }
  const html = tab === 'event' ? await drawEvent() : tab === 'rank' ? await drawRank() : mine ? await drawMine() : await drawFind();
  if (t !== drawT) return;
  view.innerHTML = html;
  bindView();
}

// ① 투어 찾기 (아직 투어가 없을 때)
async function drawFind() {
  const wb = await weekBoard(), pts = new Map((wb || []).map((x) => [x.t.id, x.score]));
  const open = tours.filter((t) => t.open !== false && count(t) < maxOf(t)).sort((a, b) => (pts.get(b.id) || 0) - (pts.get(a.id) || 0) || count(b) - count(a));
  const rows = open.slice(0, 50).map((t) => rowHTML({ img: markImg(t.mark), name: t.name, sub: `${tr('투어가이드')} <span translate="no">${esc(guideName(t))}</span> · ${count(t)}/${maxOf(t)}`,
    score: pts.get(t.id) || 0, unit: '<img class="pt" src="../ranking/assets/ui/star.webp' + V + '" alt="">', btn: `<button class="tb small pink" data-join="${esc(t.id)}">${tr('가입')}</button>` })).join('');
  // 친구가 내 ID 로 보낸 초대 (7일 동안)
  const invs = invTours.filter((t) => t.inv && t.inv[C.pid] && Date.now() - (t.inv[C.pid].at || 0) < 7 * 864e5);
  const invRows = invs.map((t) => rowHTML({ img: markImg(t.mark), name: t.name, sub: `<span translate="no">${esc(t.inv[C.pid].by || '?')}</span> ${tr('님이 초대했어요')}`,
    btn: `<button class="tb small pink" data-join="${esc(t.id)}">${tr('가입')}</button>` })).join('');
  return (invRows ? board(`<h3 class="tr-h">💌 ${tr('초대가 왔어요!')}</h3><ol class="tr-list">${invRows}</ol>`) : '')
    + board(`<div class="tr-hero"><img src="../hub/park/ui/ticket.webp${V}" alt=""><div><b>${tr('그룹투어에 오신 걸 환영해요!')}</b><p>${tr('친구들과 투어를 만들어 함께 놀아요. 매주 투어끼리 순위를 겨루고, 주 1회 이벤트에서 다이아를 받아요.')}</p>${myIdHTML()}</div></div>
    <div class="tr-acts">${cfg.open === false ? '' : btn('bCreate', '투어 만들기')}${btn('bCode', '초대 코드', 'white')}</div>`)
    + `<img class="tr-divider" src="../ranking/assets/ui/divider.webp${V}" alt="">`
    + board(`<h3 class="tr-h">${tr('가입할 수 있는 투어')}</h3><ol class="tr-list">${rows}</ol>${rows ? '' : note('아직 가입할 수 있는 투어가 없어요. 첫 번째 투어를 만들어 보세요!')}`);
}

// ① 우리 투어
async function drawMine() {
  const t = mine, wb = await weekBoard(), me = (wb || []).find((x) => x.t.id === t.id), rank = me ? (wb.indexOf(me) + 1) : '-';
  const role = isGuide() ? '투어가이드' : '투어멤버';
  const head = `<div class="tr-card"><span class="r-mark big"><img src="${markImg(t.mark)}" alt=""></span><div class="c-text"><b translate="no">${esc(t.name)}</b>
    <small><i class="chip ${isGuide() ? 'g' : ''}">${tr(role)}</i> ${tr('멤버')} ${count(t)}/${maxOf(t)}</small>${myIdHTML()}
    <small>${tr('이번 주')} <img class="pt" src="../ranking/assets/ui/star.webp${V}" alt=""> ${(me ? me.score : 0).toLocaleString()} · ${EN ? `Tour Rank ${typeof rank === 'number' ? '#' + rank : '-'}` : `투어 랭킹 ${rank}${typeof rank === 'number' ? '등' : ''}`}</small></div></div>`;
  // 공지 + 이모티콘
  const n = t.notice && t.notice.text ? t.notice : null;
  const reacts = Object.entries(t.reacts || {}).filter(([k, r]) => n && r && r.at === n.at && t.mem[k]).map(([k, r]) => ({ k, ...r })).sort((a, b) => (a.t || 0) - (b.t || 0));
  const counts = {}; reacts.forEach((r) => { counts[r.e] = (counts[r.e] || 0) + 1; });
  const myE = (reacts.find((r) => r.k === mid) || {}).e;
  const notice = `<div class="tr-notice"><div class="n-top"><b>📢 ${tr('공지')}</b>${n ? `<small>${dateText(n.at)} ${clock(n.at)}</small>` : ''}</div>
    <p class="n-text"${n ? ' translate="no"' : ''}>${n ? esc(n.text) : tr(isGuide() ? '아직 공지가 없어요. 멤버들에게 첫 공지를 올려 보세요!' : '아직 공지가 없어요')}</p>
    ${n ? `<div class="emo-bar">${EMO.map(([k]) => `<button class="emo-b${myE === k ? ' on' : ''}" data-emo="${k}" aria-label="${k}">${emoHTML(k)}${counts[k] ? `<span>${counts[k]}</span>` : ''}</button>`).join('')}</div>
    <div class="emo-chat">${reacts.map((r) => `<span class="ec"><img src="${faceOf(t.mem[r.k].f)}" alt=""><i translate="no">${esc(t.mem[r.k].n)}</i>${emoHTML(r.e)}</span>`).join('') || `<small>${tr('이모티콘으로 공지에 답해 보세요')}</small>`}</div>` : ''}
    ${isGuide() ? `<div class="tr-acts">${btn('bNotice', n ? '새 공지 쓰기' : '공지 쓰기')}</div>` : ''}</div>`;
  const by = me ? me.by : {};
  const members = memList(t).map((m) => rowHTML({ img: faceOf(m.f), face: true, name: m.n, sub: tr(m.k === guideKey(t) ? '투어가이드' : '투어멤버') + (m.k === mid ? (EN ? ' · Me' : ' · 나') : ''),
    score: by[m.k] || 0, unit: `<img class="pt" src="../ranking/assets/ui/star.webp${V}" alt="">`, cls: (m.k === mid ? 'me' : '') + (isGuide() && m.k !== mid ? ' tap' : ''), btn: '' }).replace('<li ', `<li data-mem="${esc(m.k)}" `)).join('');
  return board(head + notice)
    + board(`<h3 class="tr-h">${tr('투어 멤버')} <small>${tr('이번 주 투어 포인트')}</small></h3><ol class="tr-list">${members}</ol>${isGuide() && count(t) > 1 ? note('멤버를 누르면 내보내거나 투어가이드를 넘길 수 있어요') : ''}
      <div class="tr-acts">${btn('bInvite', '친구 초대')}${isGuide() ? btn('bSet', '투어 설정', 'white') : ''}${btn('bLeave', '투어 나가기', 'white')}</div>`);
}

// ② 이벤트
let evTimer = 0;
async function drawEvent() {
  clearInterval(evTimer);
  const e = cfg.event && cfg.event.game && cfg.event.start ? cfg.event : null;
  if (!e) return board(`<div class="tr-hero"><img src="../hub/park/ui/ticket.webp${V}" alt=""><div><b>${tr('주 1회 투어 이벤트')}</b><p>${tr('다음 이벤트를 준비하고 있어요. 시간이 정해지면 여기에 알려 드려요!')}</p></div></div>`) + rulesHTML(null);
  const now = Date.now(), end = evEnd(e), state = now < e.start ? 'soon' : now < end ? 'live' : 'done';
  const R = rewardOf(e);
  const st = state === 'soon' ? `${tr('시작까지')} <b id="evLeft">${left(e.start - now)}</b>` : state === 'live' ? `${tr('지금 이벤트 중!')} ${tr('남은 시간')} <b id="evLeft">${left(end - now)}</b>` : tr('이벤트가 끝났어요. 결과를 확인해 보세요!');
  const top = `<div class="ev-top"><span class="ev-ride"><img src="../hub/park/rides/${esc(e.game)}.webp${V}" alt=""></span><div><small>${tr('이번 주 이벤트 게임')}</small><b>${esc(gname(e.game))}</b>
    <small>${dateText(e.start)} ${clock(e.start)} ~ ${clock(end)}</small></div></div>
    <div class="ev-state ${state}">${st}</div>
    ${state === 'live' ? `<div class="tr-acts">${btn('bPlay', '게임하러 가기')}</div>` : ''}
    ${!mine && state !== 'done' ? note('투어에 들어가야 이벤트에 참가할 수 있어요') : ''}`;
  const RK = EN ? ['1st', '2nd', '3rd'] : ['1등', '2등', '3등'];
  const rew = `<div class="ev-rew"><span><i>${RK[0]}</i><img src="../hub/park/ui/gem.webp${V}" alt="">${R.r1}</span><span><i>${RK[1]}</i><img src="../hub/park/ui/gem.webp${V}" alt="">${R.r2}</span><span><i>${RK[2]}</i><img src="../hub/park/ui/gem.webp${V}" alt="">${R.r3}</span><span><i>${tr('참가')}</i><img src="../hub/park/ui/gem.webp${V}" alt="">${R.join}</span></div>`;
  let res = '';
  if (state !== 'soon') {
    const eb = await eventBoard(e);
    if (!eb) res = note('결과를 불러오지 못했어요. 인터넷 연결을 확인해 주세요');
    else {
      const key = evTab === 'best' ? 'best' : 'total';
      const list = eb.slice().sort((a, b) => b[key] - a[key] || b.plays - a.plays);
      const rows = list.slice(0, 30).map((x, i) => rowHTML({ rank: i + 1, img: markImg(x.t.mark), name: x.t.name, sub: EN ? `${Object.keys(x.by).length} joined · ${x.plays} plays` : `참가 ${Object.keys(x.by).length}명 · ${x.plays}판`, score: x[key], cls: mine && x.t.id === mine.id ? 'me' : i < 3 ? 'top' + (i + 1) : '' })).join('');
      const myPos = mine ? list.findIndex((x) => x.t.id === mine.id) : -1;
      const sub = `<div class="ev-tabs"><button data-ev="best" class="${evTab === 'best' ? 'on' : ''}">${tr('보상 순위')}<small>${tr('멤버 최고 점수 합')}</small></button><button data-ev="total" class="${evTab === 'total' ? 'on' : ''}">${tr('투어 랭킹')}<small>${tr('모든 점수 누적 합')}</small></button></div>`;
      // 보상 받기: 이벤트가 끝나고, 내 투어가 참가했고, 내가 이벤트 중에 한 판이라도 했으면
      let claim = '';
      if (state === 'done' && mine && evSnap && !evSnap.final) claim = note('결과를 모으고 있어요. 조금 뒤에 보상을 받을 수 있어요');
      else if (state === 'done' && mine) {
        const bl = eb.slice().sort((a, b) => b.best - a.best || b.plays - a.plays), pos = bl.findIndex((x) => x.t.id === mine.id), meX = pos >= 0 ? bl[pos] : null;
        const played = !!(meX && meX.by[mid]), gkey = `${e.id}|${C.id}`;
        const gems = !played ? 0 : (pos === 0 ? R.r1 : pos === 1 ? R.r2 : pos === 2 ? R.r3 : R.join);
        claim = !played ? note('이벤트 시간에 게임을 한 멤버만 보상을 받아요') : local.got[gkey] ? note('보상을 받았어요!')
          : `<div class="tr-acts"><button class="tb pink" id="bClaim" data-g="${gems}">${tr('보상 받기')} <img class="pt" src="../hub/park/ui/gem.webp${V}" alt=""> ${gems}</button></div>`;
      }
      res = `<img class="tr-divider" src="../ranking/assets/ui/divider.webp${V}" alt="">` + board(`<h3 class="tr-h">${tr(state === 'live' ? (evSnap ? '이벤트 순위' : '실시간 순위') : (evSnap && !evSnap.final ? '이벤트 결과 (집계 중)' : '이벤트 결과'))}</h3>${evSnap && state === 'live' ? `<p class="tr-note">${tr('10분마다 새로 매겨요')}${evSnap.at ? ' · ' + clock(evSnap.at) : ''}</p>` : ''}${sub}${claim}<ol class="tr-list">${rows}</ol>
        ${rows ? (myPos >= 30 ? note(`우리 투어 ${myPos + 1}등`) : '') : note(state === 'live' ? '아직 기록이 없어요. 첫 번째 주인공이 되어 보세요!' : '이벤트에 참가한 투어가 없어요')}`);
    }
  }
  if (state !== 'done') evTimer = setInterval(() => { const el = $('evLeft'); if (!el || tab !== 'event') { clearInterval(evTimer); return; } const n2 = Date.now(); if ((state === 'soon' && n2 >= e.start) || (state === 'live' && n2 >= end)) { clearInterval(evTimer); delete recCache['ev' + e.id]; draw(); return; } el.textContent = left((state === 'soon' ? e.start : end) - n2); }, 1000);
  return board(top + rew) + res + rulesHTML(e);
}
const rulesHTML = (e) => board(`<h3 class="tr-h">${tr('이벤트 규칙')}</h3><ul class="tr-rules">
  <li>${tr('매주 한 번, 정해진 시간에 게임 하나로 투어끼리 겨뤄요')}</li>
  <li>${tr('시작 시각부터 1시간 동안 투어 멤버들이 그 게임을 해요')}</li>
  <li>${tr('멤버마다 가장 높은 점수를 모두 더해서 보상 순위를 정해요')}</li>
  <li>${tr('플레이한 모든 점수를 더해서 투어 랭킹을 발표해요')}</li>
  <li>${tr('끝나면 이 화면에서 보상을 받아요 (이벤트 시간에 한 판 이상 한 멤버)')}</li></ul>`);

// ③ 투어 랭킹 (주간)
async function drawRank() {
  const wb = await weekBoard();
  const top = `<div class="tr-period"><img src="../ranking/assets/ui/period.webp${V}" alt=""><b>${periodText()}</b></div>`;
  if (!wb) return top + board(note('순위를 불러오지 못했어요. 인터넷 연결을 확인해 주세요'));
  const list = wb.filter((x) => x.score > 0 || (mine && x.t.id === mine.id));
  const rows = list.slice(0, 30).map((x, i) => rowHTML({ rank: i + 1, img: markImg(x.t.mark), name: x.t.name, sub: `${tr('멤버')} ${count(x.t)}/${maxOf(x.t)}`, score: x.score,
    unit: `<img class="pt" src="../ranking/assets/ui/star.webp${V}" alt="">`, cls: mine && x.t.id === mine.id ? 'me' : i < 3 ? 'top' + (i + 1) : '' })).join('');
  const myPos = mine ? list.findIndex((x) => x.t.id === mine.id) : -1;
  return top + board(`<ol class="tr-list">${rows}</ol>${rows ? '' : note('이번 주 기록이 아직 없어요. 첫 번째 주인공이 되어 보세요!')}${myPos >= 30 ? note(`우리 투어 ${myPos + 1}등`) : ''}${tourSnap && tourSnap.at ? `<p class="tr-note">${snapText(tourSnap.at)}</p>` : ''}`)
    + note(tourSnap ? '투어 포인트: 판 하나 끝내면 10점, 별 하나에 10점' : '투어 포인트: 판 하나 끝내면 10점, 별 하나에 10점 (투어에 들어온 뒤의 기록만)');
}

// ---------- 누르기 ----------
function bindView() {
  const on = (id, f) => { const b = $(id); if (b) b.onclick = () => { blip(); f(b); }; };
  on('bCreate', openCreate); on('bCode', () => { $('codeIn').value = ''; openModal('popCode'); });
  on('bInvite', openInvite); on('bSet', openSet); on('bLeave', askLeave);
  on('bNotice', () => { $('ntIn').value = ''; openModal('popNotice'); });
  on('bPlay', () => { location.href = `../${esc(cfg.event.game)}/index.html`; });
  on('bClaim', claim);
  view.querySelectorAll('[data-join]').forEach((b) => { b.onclick = () => { blip(); openJoin(tours.find((t) => t.id === b.dataset.join) || invTours.find((t) => t.id === b.dataset.join)); }; });
  view.querySelectorAll('[data-emo]').forEach((b) => { b.onclick = () => { blip(); react(b.dataset.emo); }; });
  view.querySelectorAll('[data-ev]').forEach((b) => { b.onclick = () => { if (evTab === b.dataset.ev) return; blip(); evTab = b.dataset.ev; draw(); }; });
  if (isGuide()) view.querySelectorAll('[data-mem]').forEach((li) => { if (li.dataset.mem !== mid) li.onclick = () => { blip(); openMember(li.dataset.mem); }; });
}
document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => { if (b.dataset.tab === tab) return; blip(); tab = b.dataset.tab; try { sessionStorage.setItem('twin_tour_tab', tab); } catch (e) { /* ignore */ } draw(); }));

// ---------- 창 ----------
function openModal(id) { document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden')); $(id).classList.remove('hidden'); if (window.PopupUI) requestAnimationFrame(PopupUI.fitAll); }
const closeModals = () => document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden'));
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { blip(); closeModals(); }));
document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) closeModals(); }));
let busy = false;
async function act(fn, okMsg) {
  if (busy) return; busy = true;
  try { await fn(); if (okMsg) toast(okMsg); } catch (e) {
    console.warn('tour', e);
    toast(e && e.msg ? e.msg : e && e.code === 'permission-denied' ? '아직 그룹투어 서버 준비 중이에요. 조금만 기다려 주세요!' : '잘 안 됐어요. 인터넷 연결을 확인해 주세요');
  } finally { busy = false; }
}
const fail = (msg) => { const e = new Error(msg); e.msg = msg; throw e; };
function badgePicker(box, cur) {
  box.innerHTML = MARKS.map((n) => `<button data-m="${n}" class="${n === cur ? 'on' : ''}"><img src="${markImg(n)}" alt=""></button>`).join('');
  box.onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b) return; blip(); box.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
}
const picked = (box) => +((box.querySelector('.on') || {}).dataset || {}).m || 1;
function seg(box, v) { box.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === (v ? '1' : '0'))); box.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; blip(); box.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); }; }
const segVal = (box) => (box.querySelector('.on') || {}).dataset.v !== '0';
const cleanName = (s) => String(s || '').replace(/[<>]/g, '').trim().slice(0, 12);

// 투어 만들기
function openCreate() { $('cName').value = ''; badgePicker($('cBadges'), 1 + Math.floor(Math.random() * MARKS.length)); seg($('cOpen'), true); openModal('popCreate'); }
$('cGo').onclick = () => { blip(); act(async () => {
  const name = cleanName($('cName').value); if (!name) fail('투어 이름을 입력하세요');
  if (mine) fail('이미 투어에 들어 있어요');
  if (tours.some((t) => t.name === name)) fail('같은 이름의 투어가 있어요');
  const ref = T().doc(), now = Date.now();
  const d = { name, mark: picked($('cBadges')), open: segVal($('cOpen')), max: cfg.maxMembers || MAX, code: newCode(), guide: uid, gk: mid, createdAt: now,
    notice: { text: '', at: 0 }, reacts: {}, mem: { [mid]: { ...myInfo(), at: now } }, last: mid };
  await ref.set(d);
  mine = { id: ref.id, ...d }; tours.push(mine); local.my[C.id] = ref.id; saveLocal();
  closeModals(); tab = 'home'; draw();
}, '투어를 만들었어요! 친구를 초대해 보세요'); };

// 가입
let joinT = null;
function openJoin(t) {
  if (!t) return; joinT = t;
  $('jCard').innerHTML = `<span class="r-mark big"><img src="${markImg(t.mark)}" alt=""></span><div><b translate="no">${esc(t.name)}</b><small>${tr('투어가이드')} <span translate="no">${esc(guideName(t))}</span> · ${tr('멤버')} ${count(t)}/${maxOf(t)}</small></div>`;
  const full = count(t) >= maxOf(t);
  $('jMsg').textContent = tr(mine ? (mine.id === t.id ? '이미 이 투어의 멤버예요' : '이미 다른 투어에 들어 있어요. 나간 뒤에 가입할 수 있어요') : full ? '이 투어는 자리가 꽉 찼어요' : '이 투어에 가입할까요?');
  $('jGo').disabled = !!mine || full; $('jGo').classList.toggle('off', !!mine || full);
  openModal('popJoin');
}
$('jGo').onclick = () => { blip(); const t = joinT; if (!t) return; act(async () => {
  if (mine) fail('이미 다른 투어에 들어 있어요. 나간 뒤에 가입할 수 있어요');
  const ref = T().doc(t.id);
  await fb.db.runTransaction(async (x) => {
    const s = await x.get(ref); if (!s.exists) fail('없어진 투어예요');
    const d = s.data(); if (Object.keys(d.mem || {}).length >= (d.max || MAX)) fail('이 투어는 자리가 꽉 찼어요');
    x.update(ref, { [`mem.${mid}`]: { ...myInfo(), at: Date.now() }, last: mid });
  });
  mine = { id: t.id }; await reloadMine(); local.my[C.id] = t.id; saveLocal();
  closeModals(); tab = 'home'; draw();
}, '투어에 들어왔어요! 반가워요'); };

// 초대 코드로 찾기
async function findCode(code) {
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 6) { toast('초대 코드 6자리를 넣어 주세요'); return; }
  let t = tours.find((x) => x.code === code);
  if (!t) { try { const s = await T().where('code', '==', code).limit(1).get(); s.forEach((d) => { t = { id: d.id, ...d.data() }; }); } catch (e) { /* ignore */ } }
  if (!t) { toast('그 코드의 투어를 찾지 못했어요'); return; }
  openJoin(t);
}
$('codeGo').onclick = () => { blip(); findCode($('codeIn').value); };

// 친구 초대 (코드 + 링크)
const inviteUrl = () => new URL(`index.html?code=${mine.code}`, location.href).href;
function openInvite() { $('invCode').textContent = mine.code; $('invId').value = ''; $('invById').classList.toggle('hidden', !isGuide()); openModal('popInvite'); }
// 친구 ID 로 초대 (투어가이드): 친구의 그룹투어 화면 '초대가 왔어요'에 이 투어가 나옴 (tours.inv.<ID>)
$('invIdGo').onclick = () => { blip(); act(async () => {
  const pid = String($('invId').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (pid.length !== 6) fail('친구 ID 6자리를 넣어 주세요');
  if (pid === C.pid) fail('내 ID예요. 친구 ID를 넣어 주세요');
  const who = window.Names ? await Names.find(pid) : null; if (!who) fail('그 ID의 친구를 찾지 못했어요');
  if (mine.mem[`${who.uid}_${who.cid}`]) fail('이미 우리 투어 멤버예요');
  await T().doc(mine.id).update({ [`inv.${pid}`]: { at: Date.now(), by: C.name, n: who.name || '' } });
  await reloadMine(); $('invId').value = '';
  toast(EN ? `Invited ${who.name}!` : `${who.name}에게 초대를 보냈어요!`);
}); };
$('invShare').onclick = async () => {
  blip(); const url = inviteUrl(), text = EN ? `Join my tour "${mine.name}" in Twin Gameland! Code: ${mine.code}` : `은유와 은결 게임랜드에서 내 투어 '${mine.name}'에 들어와! 초대 코드: ${mine.code}`;
  try { if (navigator.share) { await navigator.share({ title: tr('그룹투어 초대'), text, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(`${text}\n${url}`); toast('초대 링크를 복사했어요. 친구에게 붙여 넣어 보내 주세요'); } catch (e) { toast(`초대 코드: ${mine.code}`); }
};

// 공지 (투어가이드만)
$('ntGo').onclick = () => { blip(); act(async () => {
  const text = String($('ntIn').value || '').replace(/[<>]/g, '').trim().slice(0, 100); if (!text) fail('공지 내용을 써 주세요');
  if (!isGuide()) fail('공지는 투어가이드만 쓸 수 있어요');
  await T().doc(mine.id).update({ notice: { text, at: Date.now() }, reacts: {} });
  await reloadMine(); closeModals(); draw();
}, '공지를 올렸어요!'); };

// 이모티콘 (공지 하나에 1개, 다시 누르면 바꿈)
async function react(k) {
  if (!mine || !mine.notice || !mine.notice.at) return;
  const cur = (mine.reacts || {})[mid];
  if (cur && cur.at === mine.notice.at && cur.e === k) return;
  const r = { e: k, at: mine.notice.at, t: Date.now() };
  mine.reacts = { ...(mine.reacts || {}), [mid]: r }; draw(); // 먼저 화면에
  act(async () => { await T().doc(mine.id).update({ [`reacts.${mid}`]: r, last: mid }); });
}

// 설정 (투어가이드)
function openSet() { $('sName').value = mine.name; badgePicker($('sBadges'), +mine.mark || 1); seg($('sOpen'), mine.open !== false); openModal('popSet'); }
$('sGo').onclick = () => { blip(); act(async () => {
  const name = cleanName($('sName').value); if (!name) fail('투어 이름을 입력하세요');
  if (tours.some((t) => t.name === name && t.id !== mine.id)) fail('같은 이름의 투어가 있어요');
  await T().doc(mine.id).update({ name, mark: picked($('sBadges')), open: segVal($('sOpen')) });
  await reloadMine(); closeModals(); draw();
}, '저장했어요!'); };

// 멤버 (투어가이드: 내보내기 · 투어가이드 넘기기)
let memK = '';
function openMember(k) {
  const m = mine.mem[k]; if (!m) return; memK = k;
  $('mTitle').textContent = m.n; $('mTitle').setAttribute('translate', 'no'); $('mFace').innerHTML = `<img src="${faceOf(m.f)}" alt="">`;
  $('mMsg').textContent = tr('이 멤버를 어떻게 할까요?');
  openModal('popMember');
}
$('mKick').onclick = () => { blip(); const k = memK; ask('내보내기', EN ? `Remove ${mine.mem[k].n} from the tour?` : `${mine.mem[k].n} 멤버를 투어에서 내보낼까요?`, () => act(async () => {
  const del = fb.F.firestore.FieldValue.delete();
  await T().doc(mine.id).update({ [`mem.${k}`]: del, [`reacts.${k}`]: del });
  await reloadMine(); closeModals(); draw();
}, '내보냈어요')); };
$('mLead').onclick = () => { blip(); const k = memK; ask('투어가이드 넘기기', EN ? `Make ${mine.mem[k].n} the Tour Guide? You will become a Tour Member.` : `${mine.mem[k].n} 멤버에게 투어가이드를 넘길까요? 나는 투어멤버가 돼요`, () => act(async () => {
  await T().doc(mine.id).update({ gk: k, guide: mine.mem[k].uid || k.split('_')[0] });
  await reloadMine(); closeModals(); draw();
}, '투어가이드를 넘겼어요')); };

// 나가기: 투어가이드는 다른 멤버가 있으면 가장 오래된 멤버에게 넘기고 나감, 혼자면 투어가 없어짐
function askLeave() {
  const alone = count(mine) <= 1;
  ask('투어 나가기', tr(isGuide() ? (alone ? '혼자 있는 투어라 나가면 투어가 없어져요. 나갈까요?' : '나가면 가장 오래된 멤버가 투어가이드가 돼요. 나갈까요?') : '투어에서 나갈까요?'), () => act(async () => {
    const ref = T().doc(mine.id), del = fb.F.firestore.FieldValue.delete();
    if (isGuide() && alone) await ref.delete();
    else if (isGuide()) { const next = memList(mine).find((m) => m.k !== mid); await ref.update({ gk: next.k, guide: next.uid || next.k.split('_')[0], [`mem.${mid}`]: del, [`reacts.${mid}`]: del }); }
    else await ref.update({ [`mem.${mid}`]: del, [`reacts.${mid}`]: del, last: mid });
    mine = null; delete local.my[C.id]; saveLocal(); await loadAll(); closeModals(); tab = 'home'; draw();
  }, '투어에서 나왔어요'));
}
let askFn = null;
function ask(title, msg, fn) { $('askTitle').textContent = tr(title); $('askMsg').textContent = msg; $('askMsg').setAttribute('translate', 'no'); askFn = fn; openModal('popAsk'); }
$('askGo').onclick = () => { blip(); const f = askFn; askFn = null; if (f) f(); };

// 이벤트 보상 받기 (이 기기의 이 캐릭터에 다이아)
function claim(b) {
  const e = cfg.event, gkey = `${e.id}|${C.id}`, g = +b.dataset.g || 0;
  if (local.got[gkey] || !g) return;
  Hub.mutate((c) => { c.gems = (c.gems || 0) + g; });
  local.got[gkey] = Date.now(); saveLocal();
  toast(EN ? `Got ${g} Diamonds!` : `다이아 ${g}개를 받았어요!`); draw();
}

// ---------- 시작 ----------
(async () => {
  try { const s = sessionStorage.getItem('twin_tour_tab'); if (['home', 'event', 'rank'].includes(s)) tab = s; } catch (e) { /* ignore */ }
  const start = (async () => {
    fb = await server();
    // 캐릭터 ID 가 아직 없으면 지금 만듦 (common/names.js, auth.js 다음에 불러옴)
    for (let i = 0; i < 20 && !window.Names; i++) await new Promise((r) => setTimeout(r, 100));
    if (window.Names) { Names.sync(); const c2 = Hub.active(); if (c2 && c2.pid) C.pid = c2.pid; }
    if (fb) { uid = fb.auth.currentUser.uid; mid = `${uid}_${C.id}`; try { await loadAll(); } catch (e) { console.warn('tour load', e); } }
    await draw();
  })();
  // 처음 화면은 서버 정보까지 받아서 한 번에 (아주 느리면 6초 뒤에는 그냥 보여 줌)
  if (window.Boot) Boot.wait(Promise.race([start, new Promise((r) => setTimeout(r, 6000))]));
  await start;
  // 초대 링크로 들어옴: 그 투어 가입 창
  const code = new URLSearchParams(location.search).get('code');
  if (code && fb) { history.replaceState(null, '', location.pathname); findCode(code); }
})();
// 다른 화면(게임)에서 돌아오면 새로 받음
addEventListener('pageshow', (e) => { if (e.persisted && fb) { Object.keys(recCache).forEach((k) => delete recCache[k]); loadAll().then(draw).catch(() => {}); } });
