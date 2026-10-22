'use strict';
// 트윈 게임랜드 메인 화면: 캐릭터 만들기·선택 → 게임 고르기 → (스카이훅) 징검다리 지도 / 기록 / 아이템샵(shop/)
const $ = (id) => document.getElementById(id);
const root = $('root');
const face = (c) => `skyhook/assets/${c.look}_base.jpg`;

// ---------- sound (tiny UI blips) ----------
let actx = null;
function blip(f = 700) {
  if (!Hub.settings.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + 0.1);
  } catch (e) { /* no audio */ }
}

let toastT = 0;
function toast(text) {
  const el = $('toast'); el.textContent = text; el.classList.remove('hidden');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.add('hidden'), 1800);
}

// ---------- routing ----------
const SCREENS = { select: 'scrSelect', lobby: 'scrLobby', map: 'scrMap', records: 'scrRecords' };
let mapGame = 'skyhook'; // 징검다리 지도에 보여 줄 게임 (스카이훅 / 사천성)
function go(name) {
  if (name.startsWith('map-')) { mapGame = name.slice(4); name = 'map'; }
  if (name !== 'select' && !Hub.active()) name = 'select';
  const hash = name === 'map' ? 'map-' + mapGame : name;
  if (location.hash !== '#' + hash) history.replaceState(null, '', '#' + hash);
  for (const [k, id] of Object.entries(SCREENS)) $(id).classList.toggle('hidden', k !== name);
  closeModals();
  ({ select: renderSelect, lobby: renderLobby, map: renderMap, records: renderRecords })[name]();
}
const routeOk = (n) => n in SCREENS || (n.startsWith('map-') && Hub.GAMES[n.slice(4)] && Hub.GAMES[n.slice(4)].stages);
window.addEventListener('pageshow', () => { Hub.reload(); const n = (location.hash || '#select').slice(1); go(routeOk(n) ? n : 'select'); });
window.addEventListener('hashchange', () => { const n = location.hash.slice(1); if (routeOk(n)) go(n); });

function openModal(id) { closeModals(); $(id).classList.remove('hidden'); }
function closeModals() { document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden')); }
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { blip(500); closeModals(); }));
document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) closeModals(); }));
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { blip(); go(b.dataset.go); }));
document.querySelectorAll('[data-open="shop"]').forEach((b) => b.addEventListener('click', () => {
  blip();
  if (!Hub.active()) { toast('캐릭터를 먼저 골라요!'); return; }
  location.href = 'shop/index.html';
}));

// ---------- 1. 캐릭터 선택 ----------
function renderSelect() {
  const grid = $('charGrid'); grid.innerHTML = '';
  for (const c of Hub.chars()) {
    const b = document.createElement('button');
    b.className = 'char-card ' + c.look;
    b.innerHTML = `<img src="${face(c)}" alt=""><div class="nm"></div><div class="st"><i class="coin"></i>${c.coins} · <i class="star"></i>${Hub.starsTotal(c)}</div>`;
    b.querySelector('.nm').textContent = c.name;
    b.addEventListener('click', () => { blip(880); Hub.setActive(c.id); go('lobby'); });
    grid.appendChild(b);
  }
  if (Hub.chars().length < Hub.MAX_CHARS) {
    const add = document.createElement('button');
    const free = Hub.canCreate();
    const price = Hub.nextSlotPrice();
    add.className = 'char-card add' + (free ? '' : ' locked');
    add.innerHTML = free
      ? `<div class="plus">+</div><div class="nm">캐릭터 만들기</div><div class="st">${Hub.chars().length < Hub.FREE_SLOTS ? '무료' : '자리 있음'}</div>`
      : `<div class="plus">🔒</div><div class="nm">캐릭터 추가</div><div class="st"><i class="coin"></i>${price} 코인</div>`;
    add.addEventListener('click', () => { blip(); free ? openCreate() : openBuy(); });
    grid.appendChild(add);
  }
  document.body.classList.toggle('muted', !Hub.settings.sound);
  if (!Hub.chars().length) openCreate();
}
$('btnSound').addEventListener('click', () => { Hub.setSound(!Hub.settings.sound); document.body.classList.toggle('muted', !Hub.settings.sound); blip(); });

let createLook = 'eunyu';
function openCreate() {
  const n = Hub.chars().length;
  const has = (look) => Hub.chars().some((c) => c.look === look);
  createLook = n === 1 && has('eunyu') ? 'eungyeol' : 'eunyu';
  const suggest = n === 0 ? '은유' : (n === 1 && createLook === 'eungyeol' && !Hub.chars().some((c) => c.name === '은결')) ? '은결' : '';
  $('inName').value = suggest;
  setLook(createLook);
  openModal('popCreate');
}
function setLook(l) { createLook = l; document.querySelectorAll('.look').forEach((b) => b.classList.toggle('on', b.dataset.look === l)); }
document.querySelectorAll('.look').forEach((b) => b.addEventListener('click', () => { blip(); setLook(b.dataset.look); }));
$('btnCreate').addEventListener('click', () => {
  const name = $('inName').value.trim();
  if (!name) { toast('이름을 적어 주세요!'); $('inName').focus(); return; }
  const c = Hub.create(name, createLook);
  if (!c) { toast('자리가 없어요. 코인으로 자리를 늘려요!'); return; }
  blip(1046); $('inName').blur();
  toast(`${c.name} 캐릭터가 생겼어요!`);
  renderSelect(); closeModals();
});
$('inName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnCreate').click(); });

function openBuy() {
  const price = Hub.nextSlotPrice();
  $('buyPrice').textContent = price;
  const list = $('buyList'); list.innerHTML = '';
  for (const c of Hub.chars()) {
    const b = document.createElement('button');
    b.innerHTML = `<img src="${face(c)}" alt=""><span></span><span><i class="coin"></i>${c.coins}</span>`;
    b.querySelector('span').textContent = c.name;
    b.disabled = c.coins < price;
    b.addEventListener('click', () => {
      if (Hub.buySlot(c.id)) { blip(1046); toast('캐릭터 자리가 하나 늘었어요!'); renderSelect(); openCreate(); }
    });
    list.appendChild(b);
  }
  if (!Hub.chars().some((c) => c.coins >= price)) {
    const p = document.createElement('div'); p.className = 'p-note'; p.textContent = '아직 코인이 모자라요. 게임을 해서 코인을 모아요!';
    list.appendChild(p);
  }
  openModal('popBuy');
}

// ---------- 2. 로비 ----------
// 게임 목록: 새 게임은 여기에 한 줄 추가 (썸네일, 열기, 로비/기록에 보일 문구)
const stageSub = (g, c) => `징검다리 ${Hub.stageCleared(g, c)} / ${Hub.GAMES[g].stages} · 다음 ${Hub.stageLabel(Hub.stageNext(g, c), g)}`;
const GAME_CARDS = [
  { id: 'skyhook', name: 'Sky Hook Runner', thumb: 'hub/card_skyhook.jpg', open: () => go('map-skyhook'),
    sub: (c) => stageSub('skyhook', c),
    rec: (c, r) => `징검다리 <b>${Hub.stageCleared('skyhook', c)} / 12</b> · ${r.plays}번 도전<br>최고 거리 <b>${r.best}m</b> · 모은 코인 <b>${r.coins}</b>` },
  { id: 'helicopter', name: 'Twin Helicopter', thumb: 'hub/card_helicopter.jpg', open: () => { location.href = Hub.GAMES.helicopter.path; },
    sub: (c, r) => (r.plays ? `BEST ${r.best}m · ${r.plays}번 비행` : '아직 안 해봤어요'),
    rec: (c, r) => `BEST <b>${r.best}m</b> · ${r.plays}번 비행<br>모은 코인 <b>${r.coins}</b>` },
  { id: 'stairs', name: '계단 오르기', thumb: 'hub/card_stairs.jpg', open: () => { location.href = Hub.GAMES.stairs.path; }, portrait: true,
    sub: (c, r) => (r.plays ? `BEST ${r.best}m · ${r.plays}번 도전` : '아직 안 해봤어요'),
    rec: (c, r) => `BEST <b>${r.best}m</b> · ${r.plays}번 도전<br>모은 코인 <b>${r.coins}</b>` },
  { id: 'shisen', name: '사천성', thumb: 'hub/card_shisen.jpg', open: () => go('map-shisen'), portrait: true,
    sub: (c) => stageSub('shisen', c),
    rec: (c, r) => `징검다리 <b>${Hub.stageCleared('shisen', c)} / 12</b> · ${r.plays}번 도전<br>모은 코인 <b>${r.coins}</b>` },
];
const mmss = (t) => `${Math.floor(t / 60)}분 ${String(t % 60).padStart(2, '0')}초`;
function renderLobby() {
  const c = Hub.active();
  $('meFace').src = face(c); $('meName').textContent = c.name;
  $('meCoins').textContent = c.coins; $('meStars').textContent = Hub.starsTotal(c);
  // 즐겨찾기한 게임이 앞으로 — 별을 가장 최근에 누른 게임이 맨 앞
  const favs = c.favs || [];
  const list = GAME_CARDS.map((g, i) => ({ g, i, fav: favs.indexOf(g.id) }))
    .sort((a, b) => (b.fav - a.fav) || (a.i - b.i))
    .map((x) => ({ g: x.g, fav: x.fav >= 0 }));
  const grid = $('gameGrid'); grid.innerHTML = '';
  for (const { g, fav } of list) {
    const card = document.createElement('div');
    card.className = 'game-card' + (fav ? ' fav' : ''); card.setAttribute('role', 'button'); card.tabIndex = 0;
    card.innerHTML = `<div class="thumb" style="background-image:url(${g.thumb}?v=20261022l)"></div>
      <button class="fav-btn" aria-label="즐겨찾기">${fav ? '★' : '☆'}</button>
      <div class="g-name"></div><div class="g-sub"></div>`;
    card.querySelector('.g-name').textContent = g.name;
    card.querySelector('.g-sub').textContent = g.sub(c, Hub.rec(g.id, c));
    card.addEventListener('click', () => { blip(880); g.open(); });
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter') g.open(); });
    card.querySelector('.fav-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const on = Hub.toggleFav(g.id, c); blip(on ? 1046 : 500);
      toast(on ? `${g.name} 즐겨찾기! 맨 앞으로 옮겼어요 ★` : '즐겨찾기에서 뺐어요');
      renderLobby();
    });
    grid.appendChild(card);
  }
  const soon = document.createElement('div'); soon.className = 'game-card soon-card';
  soon.innerHTML = '<div class="thumb soon-thumb">?</div><div class="g-name">다음 게임</div><div class="g-sub">곧 나와요!</div>';
  grid.appendChild(soon);
}
// ---------- 3. 스카이훅 징검다리 ----------
// 가로 화면: 왼쪽 → 오른쪽으로 이어지는 길 / 폰 세로 화면: 아래 → 위로 올라가는 길
const STONE_GAP = 150, WORLD_GAP = 60, PAD = 110;
let portraitNow = false;
function mapLayout(N, K, view) {
  const along = (i) => PAD + i * STONE_GAP + Math.floor(i / K) * WORLD_GAP; // distance along the path
  const len = along(N - 1) + PAD + 60;
  const wave = (i) => Math.sin(i * 1.1);
  if (portraitNow) {
    const w = view.w;
    return { width: w, height: len, pos: (i) => ({ x: (0.5 + wave(i) * 0.27) * w, y: len - along(i) }) };
  }
  const h = view.h;
  return { width: len, height: h, pos: (i) => ({ x: along(i), y: (0.55 + wave(i) * 0.22) * h }) };
}
function renderMap() {
  const GM = Hub.GAMES[mapGame], c = Hub.active(), N = GM.stages, K = GM.perWorld;
  $('mapName').textContent = GM.name;
  $('mapFace').src = face(c); $('mapCoins').textContent = c.coins;
  const myStars = Object.values(Hub.rec(mapGame, c).stages).reduce((a, x) => a + (x.stars || 0), 0);
  $('mapProg').textContent = `${Hub.stageCleared(mapGame, c)} / ${N} 클리어 · ⭐ ${myStars}`;
  const scroller = $('mapScroll'), track = $('mapTrack'); track.innerHTML = '';
  const L = mapLayout(N, K, { w: scroller.clientWidth || 500, h: scroller.clientHeight || 380 });
  track.style.width = L.width + 'px'; track.style.height = L.height + 'px';
  // worlds (colored zones)
  GM.worlds.forEach((name, w) => {
    const p0 = L.pos(w * K), p1 = L.pos(w * K + K - 1);
    const d = document.createElement('div'); d.className = `world ${mapGame} w${w}`;
    if (portraitNow) { d.style.cssText = `left:10px;right:10px;top:${p1.y - 80}px;height:${p0.y - p1.y + 160}px;bottom:auto`; }
    else { d.style.left = (p0.x - 80) + 'px'; d.style.width = (p1.x - p0.x + 160) + 'px'; }
    d.innerHTML = `<span class="w-name">${w + 1}. ${name}</span>`;
    track.appendChild(d);
  });
  // dashed path
  const pts = []; for (let i = 0; i < N; i++) { const p = L.pos(i); pts.push(`${p.x},${p.y}`); }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'map-path'); svg.setAttribute('width', L.width); svg.setAttribute('height', L.height);
  svg.innerHTML = `<polyline points="${pts.join(' ')}" fill="none" stroke="#fff" stroke-width="8" stroke-dasharray="4 16" stroke-linecap="round" opacity=".9"/>`;
  track.appendChild(svg);
  const next = Hub.stageNext(mapGame, c);
  const allClear = Hub.stageCleared(mapGame, c) === N;
  for (let i = 0; i < N; i++) {
    const p = L.pos(i), st = Hub.stage(mapGame, i, c), open = Hub.stageUnlocked(mapGame, i, c);
    const b = document.createElement('button');
    const cls = st.cleared ? 'cleared' : open ? 'current' : 'locked';
    b.className = 'stone ' + cls;
    b.style.left = p.x + 'px'; b.style.top = p.y + 'px';
    const stars = st.cleared ? '⭐'.repeat(st.stars) + '☆'.repeat(3 - st.stars) : '';
    b.innerHTML = open ? `<span class="sl">${Hub.stageLabel(i, mapGame)}</span><span class="ss">${stars}</span>` : '<span class="lock">🔒</span><span class="ss">' + Hub.stageLabel(i, mapGame) + '</span>';
    b.addEventListener('click', () => {
      if (!open) { blip(300); toast('앞 스테이지를 먼저 깨요!'); return; }
      blip(); openStage(i);
    });
    track.appendChild(b);
  }
  const goal = document.createElement('div'); goal.className = 'goal-flag'; goal.textContent = '🏁';
  const gp = L.pos(N - 1);
  if (portraitNow) { goal.style.left = (gp.x + 20) + 'px'; goal.style.top = (gp.y - 40) + 'px'; }
  else { goal.style.left = (gp.x + 80) + 'px'; goal.style.top = gp.y + 'px'; }
  track.appendChild(goal);
  const me = document.createElement('div'); me.className = 'map-me';
  const mp = L.pos(allClear ? N - 1 : next);
  me.style.backgroundImage = `url(${face(c)})`; me.style.left = mp.x + 'px'; me.style.top = mp.y + 'px';
  track.appendChild(me);
  requestAnimationFrame(() => {
    if (portraitNow) scroller.scrollTop = Math.max(0, mp.y - scroller.clientHeight * 0.6);
    else scroller.scrollLeft = Math.max(0, mp.x - scroller.clientWidth * 0.4);
  });
}
let stageSel = 0;
function openStage(i) {
  stageSel = i;
  const st = Hub.stage(mapGame, i);
  $('stTitle').textContent = `${Hub.stageLabel(i, mapGame)} ${Hub.stageName(i, mapGame)}`;
  $('stStars').innerHTML = [0, 1, 2].map((k) => `<span class="${k < st.stars ? '' : 'off'}">⭐</span>`).join('');
  const shisen = mapGame === 'shisen';
  const bestTxt = shisen ? (st.bestTime ? `가장 빨리 깬 기록 <b>${mmss(st.bestTime)}</b>` : '') : `최고 기록 <b>${st.best}m</b>`;
  const starTip = shisen ? '시간이 많이 남을수록 별이 늘어요.' : '남은 하트가 많을수록 별이 늘어요.';
  $('stInfo').innerHTML = st.cleared
    ? `클리어! ${bestTxt} · ${st.plays}번 도전<br>${starTip}`
    : st.plays ? `아직 못 깼어요. ${shisen ? '' : bestTxt + ' · '}${st.plays}번 도전<br>깨면 다음 돌다리가 열려요!` : '처음 도전하는 스테이지예요!<br>깨면 다음 돌다리가 열려요.';
  $('btnPlayStage').textContent = st.cleared ? '다시 하기' : '출발!';
  openModal('popStage');
}
$('btnPlayStage').addEventListener('click', () => { blip(880); location.href = `${Hub.GAMES[mapGame].path}?stage=${stageSel}`; });

// ---------- 4. 기록 ----------
function fmtDate(t) { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
function renderRecords() {
  const c = Hub.active();
  $('recTitle').textContent = `${c.name}의 기록`;
  $('recSummary').innerHTML = `<div class="rec-card total"><div class="v">지금 코인 <b>${c.coins}</b> · 지금까지 모은 코인 <b>${c.earned}</b> · 별 <b>${Hub.starsTotal(c)}</b></div></div>`
    + GAME_CARDS.map((g) => `<div class="rec-card"><div class="thumb" style="background-image:url(${g.thumb}?v=20261022l)"></div>
      <div><div class="t">${g.name}${Hub.isFav(g.id, c) ? ' <span class="star-on">★</span>' : ''}</div><div class="v">${g.rec(c, Hub.rec(g.id, c))}</div></div></div>`).join('');
  const list = $('recList'); list.innerHTML = '';
  if (!c.history.length) list.innerHTML = '<li><span>아직 기록이 없어요. 게임을 해봐요!</span></li>';
  for (const h of c.history) {
    const li = document.createElement('li');
    const what = (h.game === 'skyhook' || h.game === 'shisen')
      ? `${h.game === 'shisen' ? '사천성' : '스카이훅'} ${Hub.stageLabel(h.stage, h.game)} <span class="${h.cleared ? 'ok' : 'no'}">${h.cleared ? '클리어 ' + '⭐'.repeat(h.stars) : '실패'}</span>`
      : `${h.game === 'stairs' ? '계단 오르기' : '헬리콥터'} <span class="ok">${h.dist}m</span>`;
    li.innerHTML = `<span>${what}</span><span>+${h.earned} <i class="coin"></i><span class="when">${fmtDate(h.at)}</span></span>`;
    list.appendChild(li);
  }
}
$('btnRename').addEventListener('click', () => {
  const c = Hub.active();
  const n = prompt('새 이름 (8글자까지)', c.name);
  if (n && n.trim()) { Hub.rename(c.id, n); renderRecords(); toast('이름을 바꿨어요!'); }
});
$('btnDelete').addEventListener('click', () => {
  const c = Hub.active();
  $('cfTitle').textContent = `${c.name} 캐릭터를 지울까요?`;
  $('cfText').innerHTML = `코인 <b>${c.coins}</b>개와 모든 기록이 사라지고,<br>되돌릴 수 없어요.`;
  openModal('popConfirm');
});
$('cfOk').addEventListener('click', () => { const c = Hub.active(); Hub.remove(c.id); toast('캐릭터를 지웠어요.'); go('select'); });

// drag-to-scroll for the map (also works when the page is rotated on an upright phone)
let rotatedNow = false, scaleNow = 1;
(function dragScroll() {
  const el = $('mapScroll');
  let sx = 0, sy = 0, start = 0, dragging = false, moved = false;
  el.addEventListener('pointerdown', (e) => { dragging = true; moved = false; sx = e.clientX; sy = e.clientY; start = portraitNow ? el.scrollTop : el.scrollLeft; });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const d = (portraitNow || rotatedNow ? e.clientY - sy : e.clientX - sx) / scaleNow;
    if (Math.abs(d) > 8) moved = true;
    if (portraitNow) el.scrollTop = start - d; else el.scrollLeft = start - d;
  });
  window.addEventListener('pointerup', () => { dragging = false; });
  el.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
})();

// ---------- 홈 화면 추가 안내 (아이폰 Safari에서만) ----------
// Safari는 웹페이지가 주소창·탭 막대를 숨기지 못하게 해서, 꽉 찬 화면은 '홈 화면에 추가'로만 가능
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = navigator.standalone === true || window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
(function installTip() {
  let hidden = false; try { hidden = localStorage.getItem('twin_tip_closed') === '1'; } catch (e) { /* ignore */ }
  if (!isIOS || isStandalone || hidden) return;
  $('installTip').classList.remove('hidden');
  $('btnTipClose').addEventListener('click', () => {
    $('installTip').classList.add('hidden');
    try { localStorage.setItem('twin_tip_closed', '1'); } catch (e) { /* ignore */ }
  });
})();

// ---------- layout ----------
// 폰 세로: 세로 전용 배치 (논리 폭 540) / 폰 가로·PC: 가로 배치 (논리 높이 540)
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
function resize() {
  const vv = window.visualViewport;
  const vw = Math.round(vv ? vv.width : window.innerWidth), vh = Math.round(vv ? vv.height : window.innerHeight);
  const s = $('safe').getBoundingClientRect();
  const inset = { t: s.top, l: s.left, r: vw - s.right, b: vh - s.bottom };
  portraitNow = isTouch && vh > vw;
  let W, H;
  if (portraitNow) { W = 540; H = Math.round(Math.max(W * vh / vw, 860)); }
  else { H = 540; W = Math.round(H * Math.max(vw / vh, 16 / 9)); }
  const scale = Math.min(vw / W, vh / H);
  rotatedNow = false; scaleNow = scale;
  root.style.width = W + 'px'; root.style.height = H + 'px';
  root.classList.toggle('portrait', portraitNow);
  const ox = (vw - W * scale) / 2, oy = (vh - H * scale) / 2;
  root.style.transform = `translate(${ox}px, ${oy}px) scale(${scale})`;
  for (const k of ['l', 'r', 't', 'b']) root.style.setProperty('--safe-' + k, Math.max(0, inset[k] / scale - (k === 'l' || k === 'r' ? ox : oy) / scale) + 'px');
  if (!$('scrMap').classList.contains('hidden')) renderMap();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
resize();
