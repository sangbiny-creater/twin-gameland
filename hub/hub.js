'use strict';
// 트윈 게임랜드 메인 화면: 캐릭터 만들기·선택 → 게임 고르기 → (스카이훅) 징검다리 지도 / 기록 / 아이템샵(shop/)
const $ = (id) => document.getElementById(id);
const root = $('root');
// 얼굴: 옷을 입었으면 옷 그림(윗부분을 동그랗게 보여 줌)
const face = (c) => Hub.costumeImg(c) || `common/faces/${c.look}_base.webp?v=202610252223`;

// 버튼 효과음·알림 (common/ui.js)
const { blip, toast } = window.UI;

// ---------- routing ----------
const SCREENS = { select: 'scrSelect', lobby: 'scrLobby', map: 'scrMap', records: 'scrRecords' };
let mapGame = 'skyhook'; // 징검다리 지도에 보여 줄 게임 (스카이훅 / 사천성 / 메모리 게임 / 두더지 게임)
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

function openModal(id) { closeModals(); $(id).classList.remove('hidden'); fitModals(); }
function closeModals() { document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden')); }
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { blip(500); closeModals(); }));
// 바깥(어두운 곳)을 눌러 닫기: 누르기 시작한 곳도 바깥일 때만. 이름 칸을 누르면 팝업이 위로 올라가서(.typing)
// 손을 뗄 때 그 자리가 바깥이 되어 팝업이 닫히던 것 막음
document.querySelectorAll('.modal').forEach((m) => {
  let downOut = false;
  m.addEventListener('pointerdown', (e) => {
    downOut = e.target === m;
    // 키보드가 올라와 있으면 바깥을 눌렀을 때 팝업은 두고 키보드만 내림
    if (downOut && document.activeElement && document.activeElement.tagName === 'INPUT') { document.activeElement.blur(); downOut = false; }
  });
  m.addEventListener('click', (e) => { if (e.target === m && downOut) closeModals(); downOut = false; });
});
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
    const lk = (window.CHAR_LOOKS || []).find((l) => l.look === c.look);
    b.className = 'char-card ' + c.look + (lk ? ' base-' + lk.base : '');
    b.innerHTML = `<img src="${face(c)}" alt=""><div class="nm"></div><div class="st"><i class="coin"></i>${c.coins} · <i class="star"></i>${Hub.starsTotal(c)}</div>`;
    b.querySelector('.nm').textContent = c.name;
    b.addEventListener('click', () => { blip(880); Hub.setActive(c.id); preload(c.look); go('lobby'); });
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

let createLook = 'eunyu3';
function openCreate() {
  const n = Hub.chars().length;
  const hasBase = (b) => Hub.chars().some((c) => Hub.lookBase(c.look) === b);
  const pick = n === 1 && hasBase('eunyu') ? 'eungyeol' : 'eunyu'; // 은유가 있으면 은결 쪽을 먼저 고름
  createLook = Hub.latestLook(pick);
  const suggest = n === 0 ? '은유' : (n === 1 && pick === 'eungyeol' && !Hub.chars().some((c) => c.name === '은결')) ? '은결' : '';
  $('inName').value = suggest;
  setLook(createLook);
  openModal('popCreate');
}
const preload = (look) => { try { if (window.CharV2) CharV2.load(look); } catch (e) { /* ignore */ } }; // 새 캐릭터 그림을 미리 받아 둠 (게임 첫 판부터 보이게)
function setLook(l) { createLook = l; document.querySelectorAll('.look').forEach((b) => b.classList.toggle('on', b.dataset.look === l)); }
// 캐릭터 만들기 버튼: common/chars/looks.js 목록대로 (새 캐릭터는 목록에 추가만 하면 나옴)
(function buildLooks() {
  const box = $('lookList'); if (!box) return;
  for (const l of window.CHAR_LOOKS || [{ look: 'eunyu', name: '은유 스타일', base: 'eunyu' }, { look: 'eungyeol', name: '은결 스타일', base: 'eungyeol' }]) {
    if (l.hidden) continue; // 숨긴 옛 모습은 고를 수 없음
    const b = document.createElement('button');
    b.className = `look base-${l.base}` + (l.atlas ? ' v2' : ''); b.dataset.look = l.look;
    b.innerHTML = `<img src="common/faces/${l.look}_base.webp?v=202610252223" alt=""><span></span>`;
    b.querySelector('span').textContent = l.name;
    if (l.isNew) b.querySelector('span').insertAdjacentHTML('beforeend', ' <i class="new">NEW</i>');
    b.addEventListener('click', () => { blip(); setLook(l.look); });
    box.appendChild(b);
  }
})();
$('btnCreate').addEventListener('click', () => {
  const name = $('inName').value.trim();
  if (!name) { toast('이름을 적어 주세요!'); $('inName').focus(); return; }
  const c = Hub.create(name, createLook);
  if (!c) { toast('자리가 없어요. 코인으로 자리를 늘려요!'); return; }
  blip(1046); $('inName').blur(); preload(c.look);
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
  { id: 'skyhook', key: 'hub/intro/skyhook.webp', name: 'Sky Hook Runner', thumb: 'hub/cards/skyhook.webp', open: () => go('map-skyhook'),
    sub: (c) => stageSub('skyhook', c),
    rec: (c, r) => `징검다리 <b>${Hub.stageCleared('skyhook', c)} / ${Hub.GAMES.skyhook.stages}</b> · ${r.plays}번 도전<br>최고 거리 <b>${r.best}m</b> · 모은 코인 <b>${r.coins}</b>` },
  { id: 'helicopter', key: 'hub/intro/helicopter.webp', name: 'Twin Helicopter', thumb: 'hub/cards/helicopter.webp', open: () => { location.href = Hub.GAMES.helicopter.path; },
    sub: (c, r) => (r.plays ? `BEST ${r.best}m · ${r.plays}번 비행` : '아직 안 해봤어요'),
    rec: (c, r) => `BEST <b>${r.best}m</b> · ${r.plays}번 비행<br>모은 코인 <b>${r.coins}</b>` },
  { id: 'stairs', key: 'hub/intro/stairs.webp', name: '계단 오르기', thumb: 'hub/cards/stairs.webp', open: () => { location.href = Hub.GAMES.stairs.path; }, portrait: true,
    sub: (c, r) => (r.plays ? `BEST ${r.best}m · ${r.plays}번 도전` : '아직 안 해봤어요'),
    rec: (c, r) => `BEST <b>${r.best}m</b> · ${r.plays}번 도전<br>모은 코인 <b>${r.coins}</b>` },
  { id: 'shisen', key: 'hub/intro/shisen.webp', name: '사천성', thumb: 'hub/cards/shisen.webp', open: () => go('map-shisen'), portrait: true,
    sub: (c) => stageSub('shisen', c),
    rec: (c, r) => `징검다리 <b>${Hub.stageCleared('shisen', c)} / ${Hub.GAMES.shisen.stages}</b> · ${r.plays}번 도전<br>모은 코인 <b>${r.coins}</b>` },
  { id: 'downhill', key: 'hub/intro/downhill.webp', name: '다운힐 러너', thumb: 'hub/cards/downhill.webp', open: () => { location.href = Hub.GAMES.downhill.path; }, portrait: true,
    sub: (c, r) => (r.plays ? `BEST ${r.best.toLocaleString()}m · ${r.plays}번 도전` : '장애물을 피해 끝없이 내려가요!'),
    rec: (c, r) => `BEST <b>${r.best.toLocaleString()}m</b> · ${r.plays}번 도전<br>모은 코인 <b>${r.coins}</b>` },
  { id: 'memory', key: 'hub/intro/memory.webp', name: '메모리 게임', thumb: 'hub/cards/memory.webp', open: () => go('map-memory'), portrait: true,
    sub: (c) => stageSub('memory', c),
    rec: (c, r) => `징검다리 <b>${Hub.stageCleared('memory', c)} / ${Hub.GAMES.memory.stages}</b> · ${r.plays}번 도전<br>모은 코인 <b>${r.coins}</b>` },
  { id: 'mole', key: 'hub/intro/mole.webp', name: '두더지 게임', thumb: 'hub/cards/mole.webp', open: () => go('map-mole'), portrait: true,
    sub: (c) => stageSub('mole', c),
    rec: (c, r) => `징검다리 <b>${Hub.stageCleared('mole', c)} / ${Hub.GAMES.mole.stages}</b> · ${r.plays}번 도전<br>최고 점수 <b>${r.best.toLocaleString()}</b> · 모은 코인 <b>${r.coins}</b>` },
  { id: 'bakery', key: 'hub/intro/bakery.webp', name: '달콤 베이커리', thumb: 'hub/cards/bakery.webp', open: () => { location.href = Hub.GAMES.bakery.path; }, portrait: true, unit: '점',
    sub: (c, r) => (r.plays ? `BEST ${r.best.toLocaleString()}점 · ${r.plays}번 도전` : '박자에 맞춰 생크림을 쭉!'),
    rec: (c, r) => `BEST <b>${r.best.toLocaleString()}점</b> · ${r.plays}번 도전<br>모은 코인 <b>${r.coins}</b>` },
];
const mmss = (t) => `${Math.floor(t / 60)}분 ${String(t % 60).padStart(2, '0')}초`;
// 레벨: 지금까지 모은 코인 500개마다 1레벨
const LV_STEP = 500;
// 보유 아이템 그림 (아이템샵과 같은 그림)
const itemIcon = (id) => `common/items/${id}.webp?v=202610252223`;
// 카드 그림에서 BEST 줄이 있는 위치 (카드 높이 %: 위, 아래)
const BEST_POS = { skyhook: [73.23, 81.36], helicopter: [74.02, 82.15], stairs: [73.23, 81.36], shisen: [74.07, 81.73], downhill: [74.07, 81.73], memory: [74.07, 81.73], mole: [74.07, 81.73], bakery: [74.07, 81.73] };
// 게임 카드 아래 한 줄: 징검다리 게임은 깬 판 수, 나머지는 최고 기록
const cardLine = (g, c, r) => (Hub.GAMES[g.id].stages
  ? `징검다리 ${Hub.stageCleared(g.id, c)} / ${Hub.GAMES[g.id].stages}`
  : (r.plays ? `BEST ${r.best.toLocaleString()}${g.unit || 'm'}` : '첫 도전을 기다려요!'));
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
    card.innerHTML = `<img class="lb-cardimg" src="${g.thumb}?v=202610252223" alt="">
      <button class="lb-fav" aria-label="즐겨찾기">★</button>
      <div class="lb-best" style="top:${bp[0]}%;height:${bp[1] - bp[0]}%"><img src="hub/ui/crown.webp?v=202610252223" alt=""><span class="lb-bt"></span></div>`;
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
  const soon = document.createElement('div'); soon.className = 'lb-card lb-soon'; // .soon 은 작은 딱지 스타일이라 다른 이름
  soon.innerHTML = '<img class="lb-cardimg" src="hub/cards/soon.webp?v=202610252223" alt="다음 게임 — 곧 새로운 모험이 찾아와요! COMING SOON">';
  grid.appendChild(soon);
}
// 게임 타이틀 화면: 메인 그림을 화면 가득 → START를 누르면 게임(또는 징검다리 지도)으로
let titleGame = null;
// 인트로 그림: 화면이 가로면 가로 그림(<id>_land.webp), 세로면 세로 그림 — 폰·태블릿을 돌리면 바로 바뀜
const landMQ = window.matchMedia('(orientation: landscape)');
const introSrc = (g) => `${landMQ.matches ? g.key.replace('.webp', '_land.webp') : g.key}?v=202610252223`;
function setTitleArt(g) {
  const src = introSrc(g);
  $('tsArt').src = src; $('tsArt').alt = g.name;
  $('tsBg').style.backgroundImage = `url(${src})`;
  $('scrTitle').classList.toggle('land', landMQ.matches);
}
landMQ.addEventListener('change', () => { if (titleGame) setTitleArt(titleGame); });
function showTitle(g) {
  titleGame = g;
  setTitleArt(g);
  const el = $('scrTitle'); el.classList.remove('hidden', 'go'); void el.offsetWidth; el.classList.add('show');
}
// 인트로 그림 미리 받아 두기 (로비가 뜨고 조금 뒤에)
let introPreloaded = false;
function preloadIntros() {
  if (introPreloaded) return; introPreloaded = true;
  setTimeout(() => { for (const g of GAME_CARDS) { const im = new Image(); im.src = introSrc(g); } }, 1500);
}
function hideTitle() { $('scrTitle').classList.add('hidden'); $('scrTitle').classList.remove('show'); titleGame = null; }
$('tsBack').addEventListener('click', (e) => { e.stopPropagation(); blip(500); hideTitle(); });
$('tsStart').addEventListener('click', (e) => {
  e.stopPropagation();
  const g = titleGame; if (!g) return;
  blip(1046);
  // 징검다리가 없는 게임은 바로 게임으로. 인트로 그림은 넘어갈 때까지 그대로 둠
  const GM = Hub.GAMES[g.id];
  // 징검다리 게임(스카이훅·사천성·메모리)은 START를 누르면 징검다리 지도로
  if (GM.stages) { hideTitle(); g.open(); return; }
  location.href = `${GM.path}?go=1`;
});
window.addEventListener('keydown', (e) => {
  if (!titleGame) return;
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('tsStart').click(); }
  else if (e.key === 'Escape') hideTitle();
});
// 다른 화면으로 가면 타이틀은 닫기 (게임에서 뒤로 돌아왔을 때 남아 있지 않게)
window.addEventListener('pageshow', (e) => { if (e.persisted) hideTitle(); });

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
// 월드마다 배경 그림 카드 1장, 그 안에서 돌다리 5개(사천성은 10개)가 아래 → 위로 올라감
// 가로 화면: 카드가 옆으로 나란히 (좌우로 밀기) / 폰 세로 화면: 카드가 위아래로 (위아래로 밀기)
let portraitNow = false, mapPortrait = null; // mapPortrait: 지도를 그릴 때의 화면 방향
const WORLD_BG = (w) => `common/worlds/w${w + 1}.webp?v=202610252223`;
// 판 위치 (카드 안에서 %): 아래(1판) → 위(마지막 판) 지그재그, 월드마다 조금씩 다르게
//  · 월드당 5판(스카이훅) / 10판(사천성: 두 줄로 번갈아 올라감)
function stoneSpot(w, k, K = 5) {
  const flip = w % 2 ? -1 : 1;
  if (K > 5) return { x: 50 + ((k % 2 ? 70 : 30) + (Math.floor(k / 2) % 2 ? 4 : -4) - 50) * flip, y: 92 - k * (78 / (K - 1)) };
  const ys = [88, 72, 56, 40, 24];
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
  mapPortrait = portraitNow;
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
    if (K > 5) { if (portraitNow) panel.style.height = '900px'; else panel.style.width = '300px'; } // 10판 월드는 카드를 더 크게
    panel.innerHTML = `<div class="wtitle w${w % 5}">${w + 1}. ${name}</div>`;
    // dotted path through the 5 stones
    const pts = []; for (let k = 0; k < K; k++) { const p = stoneSpot(w, k, K); pts.push(`${p.x},${p.y}`); }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'wpath'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none');
    svg.innerHTML = `<polyline points="${pts.join(' ')}" fill="none" stroke="#fff" stroke-width="2.4" stroke-dasharray="0.1 5" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity=".95"/>`;
    panel.appendChild(svg);
    for (let k = 0; k < K; k++) {
      const i = w * K + k, p = stoneSpot(w, k, K), st = Hub.stage(mapGame, i, c), open = Hub.stageUnlocked(mapGame, i, c);
      const b = document.createElement('button');
      b.className = 'stone ' + (st.cleared ? 'cleared' : open ? 'current' : 'locked') + (i === next && !allClear ? ' next' : ''); // next: 지금 해야 할 판
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
  const shisen = mapGame === 'shisen' || mapGame === 'memory'; // 시간 안에 깨는 게임: 빨리 깬 기록·남은 시간으로 별
  const mole = mapGame === 'mole'; // 점수 게임: 최고 점수·점수로 별
  const bestTxt = mole ? `최고 점수 <b>${st.best.toLocaleString()}점</b>` : shisen ? (st.bestTime ? `가장 빨리 깬 기록 <b>${mmss(st.bestTime)}</b>` : '') : `최고 기록 <b>${st.best}m</b>`;
  const starTip = mole ? '점수가 높을수록 별이 늘어요.' : shisen ? '시간이 많이 남을수록 별이 늘어요.' : '남은 하트가 많을수록 별이 늘어요.';
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
    + GAME_CARDS.map((g) => `<div class="rec-card"><div class="thumb" style="background-image:url(${g.thumb}?v=202610252223)"></div>
      <div><div class="t">${g.name}${Hub.isFav(g.id, c) ? ' <span class="star-on">★</span>' : ''}</div><div class="v">${g.rec(c, Hub.rec(g.id, c))}</div></div></div>`).join('');
  const list = $('recList'); list.innerHTML = '';
  if (!c.history.length) list.innerHTML = '<li><span>아직 기록이 없어요. 게임을 해봐요!</span></li>';
  for (const h of c.history) {
    const li = document.createElement('li');
    const what = (Hub.GAMES[h.game] && Hub.GAMES[h.game].stages)
      ? `${{ shisen: '사천성', memory: '메모리 게임', mole: '두더지 게임' }[h.game] || '스카이훅'} ${Hub.stageLabel(h.stage, h.game)} <span class="${h.cleared ? 'ok' : 'no'}">${h.cleared ? '클리어 ' + '⭐'.repeat(h.stars) : '실패'}</span>`
      : `${{ stairs: '계단 오르기', downhill: '다운힐 러너', bakery: '달콤 베이커리' }[h.game] || '헬리콥터'} <span class="ok">${h.dist.toLocaleString()}${h.game === 'bakery' ? '점' : 'm'}</span>`;
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
// 폰 키보드가 올라오면(이름 입력) 화면 배치는 그대로 두고, 열린 팝업만 키보드 위 보이는 곳에 맞춰 넣음
//  · 키보드 = 폭은 그대로인데 높이가 키보드 없을 때(full)의 80%보다 작아짐 → 그동안은 배치를 다시 하지 않음
//    (다른 모습을 누르느라 이름 칸에서 손을 떼도 키보드가 내려갈 때까지 화면이 작아졌다 커지지 않게)
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
let full = null, oyNow = 0;
const viewSize = () => { const vv = window.visualViewport; return { vw: Math.round(vv ? vv.width : window.innerWidth), vh: Math.round(vv ? vv.height : window.innerHeight), top: vv ? vv.offsetTop : 0 }; };
function keyboardOn() {
  if (!isTouch || !full) return false;
  const { vw, vh } = viewSize();
  const typing = document.activeElement && document.activeElement.tagName === 'INPUT';
  return Math.abs(vw - full.w) < 2 && (vh < full.h * 0.8 || typing);
}
// 열린 팝업을 지금 보이는 곳(키보드 위)에 맞춤. 팝업이 그보다 크면 작게 줄여서 만들기 버튼까지 다 보이게
function fitModals() {
  const kb = root.classList.contains('typing');
  const { vh, top } = viewSize();
  document.querySelectorAll('.modal').forEach((m) => {
    const panel = m.querySelector('.panel');
    if (!kb || m.classList.contains('hidden')) { m.style.paddingTop = m.style.paddingBottom = ''; if (panel) panel.style.transform = ''; return; }
    // 어두운 막은 화면 전체에 두고, 팝업은 보이는 곳(t ~ t+h) 가운데에
    const t = Math.max(0, (top - oyNow) / scaleNow), h = vh / scaleNow;
    m.style.paddingTop = (t + 8) + 'px'; m.style.paddingBottom = Math.max(8, root.offsetHeight - t - h + 8) + 'px';
    if (panel) { panel.style.transform = ''; const k = Math.min(1, (h - 16) / panel.offsetHeight); panel.style.transform = k < 1 ? `scale(${k})` : ''; }
  });
}
function resize() {
  const kb = keyboardOn();
  root.classList.toggle('typing', kb); document.body.classList.toggle('typing', kb);
  if (kb) { fitModals(); return; }
  const { vw, vh } = viewSize();
  const s = $('safe').getBoundingClientRect();
  const inset = { t: s.top, l: s.left, r: vw - s.right, b: vh - s.bottom };
  portraitNow = isTouch && vh > vw;
  let W, H;
  if (portraitNow) { W = 540; H = Math.round(Math.max(W * vh / vw, 860)); }
  else { H = 540; W = Math.round(H * Math.max(vw / vh, 16 / 9)); }
  const scale = Math.min(vw / W, vh / H);
  rotatedNow = false; scaleNow = scale; full = { w: vw, h: vh };
  root.style.width = W + 'px'; root.style.height = H + 'px';
  root.classList.toggle('portrait', portraitNow);
  const ox = (vw - W * scale) / 2, oy = (vh - H * scale) / 2; oyNow = oy;
  root.style.transform = `translate(${ox}px, ${oy}px) scale(${scale})`;
  for (const k of ['l', 'r', 't', 'b']) root.style.setProperty('--safe-' + k, Math.max(0, inset[k] / scale - (k === 'l' || k === 'r' ? ox : oy) / scale) + 'px');
  fitModals();
  // 지도는 화면 방향이 바뀔 때만 다시 그림. 안드로이드는 손가락을 대면 주소창이 숨으며 크기가 바뀌는데,
  // 그때마다 다시 그리면 누르던 돌다리가 사라져서 눌리지 않음
  if (!$('scrMap').classList.contains('hidden') && portraitNow !== mapPortrait) renderMap();
}
window.addEventListener('resize', resize);
document.addEventListener('focusin', resize);
document.addEventListener('focusout', () => setTimeout(resize, 50));
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
if (window.visualViewport) { window.visualViewport.addEventListener('resize', resize); window.visualViewport.addEventListener('scroll', fitModals); }
// 아이폰은 키보드가 올라올 때 페이지 전체를 위로 밀어 올림 → 밀린 만큼 아래에 빈 곳(흰 화면)이 보임. 입력 중엔 제자리로
window.addEventListener('scroll', () => { if (root.classList.contains('typing') && (window.scrollY || window.scrollX)) window.scrollTo(0, 0); });
resize();
