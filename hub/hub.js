'use strict';
// 트윈 게임랜드 메인 화면: 캐릭터 만들기·선택 → 게임 고르기 → (스카이훅) 징검다리 지도 / 기록 / 아이템샵(shop/)
const $ = (id) => document.getElementById(id);
const root = $('root');
// 얼굴: 옷을 입었으면 옷 그림(윗부분을 동그랗게 보여 줌)
const face = (c) => Hub.costumeImg(c) || `skyhook/assets/${c.look}_base.jpg?v=20261023v`;

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
window.addEventListener('pageshow', () => { Hub.reload(); const n = (location.hash || (Hub.active() ? '#lobby' : '#select')).slice(1); go(routeOk(n) ? n : 'select'); });
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
  { id: 'skyhook', key: 'hub/intro/skyhook.webp', name: 'Sky Hook Runner', thumb: 'hub/v3/card_skyhook.webp', open: () => go('map-skyhook'),
    sub: (c) => stageSub('skyhook', c),
    rec: (c, r) => `징검다리 <b>${Hub.stageCleared('skyhook', c)} / 12</b> · ${r.plays}번 도전<br>최고 거리 <b>${r.best}m</b> · 모은 코인 <b>${r.coins}</b>` },
  { id: 'helicopter', key: 'hub/intro/helicopter.webp', name: 'Twin Helicopter', thumb: 'hub/v3/card_helicopter.webp', open: () => { location.href = Hub.GAMES.helicopter.path; },
    sub: (c, r) => (r.plays ? `BEST ${r.best}m · ${r.plays}번 비행` : '아직 안 해봤어요'),
    rec: (c, r) => `BEST <b>${r.best}m</b> · ${r.plays}번 비행<br>모은 코인 <b>${r.coins}</b>` },
  { id: 'stairs', key: 'hub/intro/stairs.webp', name: '계단 오르기', thumb: 'hub/v3/card_stairs.webp', open: () => { location.href = Hub.GAMES.stairs.path; }, portrait: true,
    sub: (c, r) => (r.plays ? `BEST ${r.best}m · ${r.plays}번 도전` : '아직 안 해봤어요'),
    rec: (c, r) => `BEST <b>${r.best}m</b> · ${r.plays}번 도전<br>모은 코인 <b>${r.coins}</b>` },
  { id: 'shisen', key: 'hub/intro/shisen.webp', name: '사천성', thumb: 'hub/v3/card_shisen.webp', open: () => go('map-shisen'), portrait: true,
    sub: (c) => stageSub('shisen', c),
    rec: (c, r) => `징검다리 <b>${Hub.stageCleared('shisen', c)} / 12</b> · ${r.plays}번 도전<br>모은 코인 <b>${r.coins}</b>` },
  { id: 'downhill', key: 'hub/intro/downhill.webp', name: '다운힐 러너', thumb: 'hub/v3/card_downhill.webp', open: () => { location.href = Hub.GAMES.downhill.path; }, portrait: true,
    sub: (c, r) => (r.plays ? `BEST ${r.best.toLocaleString()}m · ${r.plays}번 도전` : '장애물을 피해 끝없이 내려가요!'),
    rec: (c, r) => `BEST <b>${r.best.toLocaleString()}m</b> · ${r.plays}번 도전<br>모은 코인 <b>${r.coins}</b>` },
];
const mmss = (t) => `${Math.floor(t / 60)}분 ${String(t % 60).padStart(2, '0')}초`;
// 레벨: 지금까지 모은 코인 500개마다 1레벨
const LV_STEP = 500;
// 보유 아이템 그림 (아이템샵과 같은 그림)
const ITEM_ICON = { hint: 'v2/boost_hint', shuffle: 'v2/boost_shuffle', time: 'v2/boost_time', bomb: 'v2/boost_bomb', find: 'v2/boost_find', combo: 'v2/boost_combo' };
const itemIcon = (id) => `shop/assets/${ITEM_ICON[id] || 'icons/' + id}.png?v=20261023r`;
// 카드 그림에서 BEST 줄이 있는 위치 (카드 높이 %: 위, 아래)
const BEST_POS = { skyhook: [73.23, 81.36], helicopter: [74.02, 82.15], stairs: [73.23, 81.36], shisen: [74.07, 81.73], downhill: [74.07, 81.73] };
// 게임 카드 아래 한 줄: 징검다리 게임은 깬 판 수, 나머지는 최고 기록
const cardLine = (g, c, r) => (Hub.GAMES[g.id].stages
  ? `징검다리 ${Hub.stageCleared(g.id, c)} / ${Hub.GAMES[g.id].stages}`
  : (r.plays ? `BEST ${r.best.toLocaleString()}m` : '첫 도전을 기다려요!'));
function renderLobby() {
  const c = Hub.active();
  $('meFace').src = face(c); $('meName').textContent = c.name;
  $('meCoins').textContent = c.coins.toLocaleString(); $('meStars').textContent = Hub.starsTotal(c);
  const earned = c.earned || 0, lv = Math.floor(earned / LV_STEP) + 1, cur = earned % LV_STEP;
  $('meLv').textContent = `Lv.${lv}`; $('meLvBar').style.width = `${(cur / LV_STEP) * 100}%`; $('meLvTxt').textContent = `${cur} / ${LV_STEP}`;
  renderItems(c);
  preloadIntros();
  // 즐겨찾기한 게임이 앞으로 — 별을 가장 최근에 누른 게임이 맨 앞
  const favs = c.favs || [];
  const list = GAME_CARDS.map((g, i) => ({ g, i, fav: favs.indexOf(g.id) }))
    .sort((a, b) => (b.fav - a.fav) || (a.i - b.i))
    .map((x) => ({ g: x.g, fav: x.fav >= 0 }));
  const grid = $('gameGrid'); grid.innerHTML = '';
  for (const { g, fav } of list) {
    const card = document.createElement('div');
    card.className = 'lb-card' + (fav ? ' fav' : ''); card.setAttribute('role', 'button'); card.tabIndex = 0;
    // 카드 그림 한 장(제목·게임 시작 버튼 포함) 위에 최고 기록만 실제 값으로 덮어 씀
    const bp = BEST_POS[g.id] || [73.5, 81.5];
    card.innerHTML = `<img class="lb-cardimg" src="${g.thumb}?v=20261023r" alt="">
      <button class="lb-fav" aria-label="즐겨찾기">★</button>
      <div class="lb-best" style="top:${bp[0]}%;height:${bp[1] - bp[0]}%"><img src="hub/v3/crown.png?v=20261023r" alt=""><span class="lb-bt"></span></div>`;
    card.querySelector('.lb-cardimg').alt = g.name;
    card.querySelector('.lb-bt').textContent = cardLine(g, c, Hub.rec(g.id, c));
    card.addEventListener('click', () => { blip(880); showTitle(g); });
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter') showTitle(g); });
    card.querySelector('.lb-fav').addEventListener('click', (e) => {
      e.stopPropagation();
      const on = Hub.toggleFav(g.id, c); blip(on ? 1046 : 500);
      toast(on ? `${g.name} 즐겨찾기! 맨 앞으로 옮겼어요 ★` : '즐겨찾기에서 뺐어요');
      renderLobby();
    });
    grid.appendChild(card);
  }
  const soon = document.createElement('div'); soon.className = 'lb-card soon';
  soon.innerHTML = '<img class="lb-cardimg" src="hub/v3/card_soon.webp?v=20261023r" alt="다음 게임 — 곧 새로운 모험이 찾아와요! COMING SOON">';
  grid.appendChild(soon);
}
// 게임 타이틀 화면: 메인 그림을 화면 가득 → START를 누르면 게임(또는 징검다리 지도)으로
let titleGame = null;
function showTitle(g) {
  titleGame = g;
  const src = `${g.key}?v=20261023r`;
  $('tsArt').src = src; $('tsArt').alt = g.name;
  $('tsBg').style.backgroundImage = `url(${src})`;
  const el = $('scrTitle'); el.classList.remove('hidden', 'go'); void el.offsetWidth; el.classList.add('show');
}
// 인트로 그림 미리 받아 두기 (로비가 뜨고 조금 뒤에)
let introPreloaded = false;
function preloadIntros() {
  if (introPreloaded) return; introPreloaded = true;
  setTimeout(() => { for (const g of GAME_CARDS) { const im = new Image(); im.src = `${g.key}?v=20261023r`; } }, 1500);
}
function hideTitle() { $('scrTitle').classList.add('hidden'); $('scrTitle').classList.remove('show'); titleGame = null; }
$('tsBack').addEventListener('click', (e) => { e.stopPropagation(); blip(500); hideTitle(); });
$('tsStart').addEventListener('click', (e) => {
  e.stopPropagation();
  const g = titleGame; if (!g) return;
  blip(1046); $('scrTitle').classList.add('go');
  setTimeout(() => { hideTitle(); g.open(); }, 260);
});
window.addEventListener('keydown', (e) => {
  if (!titleGame) return;
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('tsStart').click(); }
  else if (e.key === 'Escape') hideTitle();
});
// 다른 화면으로 가면 타이틀은 닫기 (게임에서 뒤로 돌아왔을 때 남아 있지 않게)
window.addEventListener('pageshow', () => hideTitle());

// 보유 아이템: 모든 게임의 부스트를 종류별로 합쳐서 많은 순서로 6개
function renderItems(c) {
  const sum = {};
  for (const [game, list] of Object.entries(Hub.BOOSTS)) for (const b of list) {
    const n = Hub.boostCount(game, b.id, c);
    if (n > 0) sum[b.id] = (sum[b.id] || 0) + n;
  }
  const top = Object.entries(sum).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const box = $('meItems'); box.innerHTML = '';
  if (!top.length) { box.innerHTML = '<div class="lb-noitem">아직 아이템이 없어요<br><small>아이템샵에서 부스트를 사 보세요!</small></div>'; return; }
  for (const [id, n] of top) {
    const d = document.createElement('button'); d.className = 'lb-item';
    d.innerHTML = `<img src="${itemIcon(id)}" alt=""><b>x${n}</b>`;
    d.addEventListener('click', () => { blip(); location.href = 'shop/index.html'; });
    box.appendChild(d);
  }
}
function renameMe() {
  const c = Hub.active();
  const n = prompt('새 이름 (8글자까지)', c.name);
  if (n && n.trim()) { Hub.rename(c.id, n); toast('이름을 바꿨어요!'); renderLobby(); }
}
$('btnMeRename').addEventListener('click', () => { blip(); renameMe(); });
// 설정
function renderSettings() { $('setSoundVal').textContent = Hub.settings.sound ? '켜짐' : '꺼짐'; }
$('btnSettings').addEventListener('click', () => { blip(); renderSettings(); openModal('popSettings'); });
$('setSound').addEventListener('click', () => { Hub.setSound(!Hub.settings.sound); document.body.classList.toggle('muted', !Hub.settings.sound); renderSettings(); blip(); });
$('setRename').addEventListener('click', () => { closeModals(); renameMe(); });
// ---------- 3. 스카이훅 징검다리 ----------
// 월드마다 배경 그림 카드 1장, 그 안에서 5개 돌다리가 아래 → 위로 올라감
// 가로 화면: 카드가 옆으로 나란히 (좌우로 밀기) / 폰 세로 화면: 카드가 위아래로 (위아래로 밀기)
let portraitNow = false;
const WORLD_BG = (w) => `common/worlds/w${w + 1}.jpg?v=20261022n`;
// 판 위치 (카드 안에서 %): 아래(1판) → 위(5판) 지그재그, 월드마다 조금씩 다르게
function stoneSpot(w, k) {
  const ys = [88, 72, 56, 40, 24];
  const flip = w % 2 ? -1 : 1;
  const xs = [56, 34, 62, 36, 54];
  return { x: 50 + (xs[k] - 50) * flip, y: ys[k] };
}
function renderMap() {
  const GM = Hub.GAMES[mapGame], c = Hub.active(), N = GM.stages, K = GM.perWorld;
  $('mapName').textContent = GM.name;
  $('mapFace').src = face(c); $('mapCoins').textContent = c.coins;
  const myStars = Object.values(Hub.rec(mapGame, c).stages).reduce((a, x) => a + (x.stars || 0), 0);
  $('mapProg').textContent = `${Hub.stageCleared(mapGame, c)} / ${N} 클리어 · ⭐ ${myStars}`;
  const scroller = $('mapScroll'), track = $('mapTrack'); track.innerHTML = '';
  track.className = 'map-track ' + (portraitNow ? 'vert' : 'horiz');
  track.style.width = ''; track.style.height = '';
  const next = Hub.stageNext(mapGame, c), allClear = Hub.stageCleared(mapGame, c) === N;
  const meAt = allClear ? N - 1 : next;
  let currentPanel = null;
  GM.worlds.forEach((name, w) => {
    const panel = document.createElement('div');
    const worldOpen = Hub.stageUnlocked(mapGame, w * K, c);
    panel.className = 'wpanel' + (worldOpen ? '' : ' locked');
    panel.style.backgroundImage = `url(${WORLD_BG(w)})`;
    panel.innerHTML = `<div class="wtitle w${w % 5}">${w + 1}. ${name}</div>`;
    // dotted path through the 5 stones
    const pts = []; for (let k = 0; k < K; k++) { const p = stoneSpot(w, k); pts.push(`${p.x},${p.y}`); }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'wpath'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none');
    svg.innerHTML = `<polyline points="${pts.join(' ')}" fill="none" stroke="#fff" stroke-width="2.4" stroke-dasharray="0.1 5" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity=".95"/>`;
    panel.appendChild(svg);
    for (let k = 0; k < K; k++) {
      const i = w * K + k, p = stoneSpot(w, k), st = Hub.stage(mapGame, i, c), open = Hub.stageUnlocked(mapGame, i, c);
      const b = document.createElement('button');
      b.className = 'stone ' + (st.cleared ? 'cleared' : open ? 'current' : 'locked');
      b.style.left = p.x + '%'; b.style.top = p.y + '%';
      const stars = st.cleared ? '⭐'.repeat(st.stars) + '☆'.repeat(3 - st.stars) : '';
      b.innerHTML = open ? `<span class="sl">${Hub.stageLabel(i, mapGame)}</span><span class="ss">${stars}</span>` : `<span class="lock">🔒</span><span class="ss">${Hub.stageLabel(i, mapGame)}</span>`;
      b.addEventListener('click', () => {
        if (!open) { blip(300); toast('앞 스테이지를 먼저 깨요!'); return; }
        blip(); openStage(i);
      });
      panel.appendChild(b);
      if (i === meAt) {
        const me = document.createElement('div'); me.className = 'map-me';
        me.style.backgroundImage = `url(${face(c)})`; me.style.left = p.x + '%'; me.style.top = p.y + '%';
        panel.appendChild(me); currentPanel = panel;
      }
    }
    if (w === GM.worlds.length - 1) { const g = document.createElement('div'); g.className = 'goal-flag'; g.textContent = '🏆'; panel.appendChild(g); }
    track.appendChild(panel);
  });
  requestAnimationFrame(() => {
    if (!currentPanel) return;
    // 세로: 지금 월드 카드가 화면 가운데쯤 오게 (처음엔 맨 아래 1번 월드)
    if (portraitNow) scroller.scrollTop = Math.max(0, currentPanel.offsetTop - (scroller.clientHeight - currentPanel.offsetHeight) / 2);
    else scroller.scrollLeft = Math.max(0, currentPanel.offsetLeft - (scroller.clientWidth - currentPanel.offsetWidth) / 2);
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
      : `${{ stairs: '계단 오르기', downhill: '다운힐 러너' }[h.game] || '헬리콥터'} <span class="ok">${h.dist}m</span>`;
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
