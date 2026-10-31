'use strict';
// 트윈 게임랜드 메인 화면: 캐릭터 만들기·선택 → 게임 고르기 → (스카이훅) 징검다리 지도 / 기록 / 아이템샵(shop/)
const $ = (id) => document.getElementById(id);
const root = $('root');
// 얼굴: 옷을 입었으면 옷 그림(윗부분을 동그랗게 보여 줌)
const face = (c) => Hub.costumeImg(c) || `common/faces/${c.look}_base.webp?v=202611010106`;

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
  document.body.classList.toggle('in-park', name === 'lobby'); // 놀이공원 바깥(화면 끝)도 풀색으로
  if (!isTouch) resize(); // PC: 첫 화면만 세로 모양이라 화면이 바뀌면 배치를 다시
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
    b.innerHTML = `<img src="common/faces/${l.look}_base.webp?v=202611010106" alt=""><span></span>`;
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
    rec: (c, r) => `징검다리 <b>${Hub.stageCleared('shisen', c)} / ${Hub.GAMES.shisen.stages}</b> · 어려움 <b>${Hub.stageCleared('shisen', c, true)} / ${Hub.GAMES.shisen.stages}</b> · ${r.plays}번 도전<br>모은 코인 <b>${r.coins}</b>` },
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
  { id: 'dogsnack', key: 'hub/intro/dogsnack.webp', name: '멍멍이 간식 타임', thumb: 'hub/cards/dogsnack.webp', open: () => { location.href = Hub.GAMES.dogsnack.path; }, portrait: true, unit: '점',
    sub: (c, r) => (r.plays ? `BEST ${r.best.toLocaleString()}점 · ${r.plays}번 도전` : '멍멍이들에게 간식을 톡톡!'),
    rec: (c, r) => `BEST <b>${r.best.toLocaleString()}점</b> · ${r.plays}번 도전<br>모은 코인 <b>${r.coins}</b>` },
  { id: 'darts', key: 'hub/intro/darts.webp', name: '다트 게임', thumb: 'hub/cards/darts.webp', open: () => { location.href = Hub.GAMES.darts.path; }, portrait: true, unit: '점',
    sub: (c, r) => (r.plays ? `BEST ${r.best.toLocaleString()}점 · ${r.plays}번 도전` : '다트를 던져 점수를 모아요!'),
    rec: (c, r) => `BEST <b>${r.best.toLocaleString()}점</b> · ${r.plays}번 도전<br>모은 코인 <b>${r.coins}</b>` },
];
const mmss = (t) => `${Math.floor(t / 60)}분 ${String(t % 60).padStart(2, '0')}초`;
// 레벨: 지금까지 모은 코인 500개마다 1레벨
const LV_STEP = 500;

// ---------- 2. 로비 = 놀이공원 (v0.2) ----------
// 컨셉 초안처럼 돌바닥 광장·분수대·꽃밭이 그려진 공원 배경(GPT, hub/park/bg) 위에, 배경 속 빈 받침 자리마다 놀이기구를 올림
// 배경은 아래부터 입구(E) → 가운데 A → 가운데 B → A … → 맨 위(하늘). 게임이 늘면 가운데 구간이 위로 더 붙음
// 자리 채우기: 아래 자리부터 게임 → 남는 자리는 장식(꽃 정원·간식 카트·포토존) → 맨 위 자리는 항상 Open soon
// 자리 순서는 캐릭터마다 저장 (Hub.park: 자리마다 게임 id 또는 null=장식). 편집: '편집' 버튼 또는 놀이기구 길게 누르기
const PARK_V = '?v=202611010106';
const EN_NAME = { skyhook: 'Sky Hook Runner', helicopter: 'Twin Helicopter', stairs: 'Stair Climb', shisen: 'Tile Match', downhill: 'Downhill Runner',
  memory: 'Memory Game', mole: 'Whack-a-Mole', bakery: 'Sweet Bakery', dogsnack: 'Doggy Snack Time', darts: 'Dart Game' };
// 배경 그림(1024 폭) 속 빈 받침 자리: [받침 가운데 x, 받침 아랫선 y] (그림 px, 아래 자리부터). 그림을 다시 받으면 여기를 다시 잼
const PARK_SECTIONS = {
  E: { bg: 'entrance', h: 1536, slots: [[494, 1065], [257, 910], [766, 912], [245, 610], [783, 610], [307, 330], [715, 330]],
    shops: [['shop', 757, 1140, 'Item Shop', 'shop/index.html'], ['dress', 910, 1180, 'Dress Up', 'shop/index.html?dress=1']] },
  A: { bg: 'mid_a', h: 1536, slots: [[770, 1240], [277, 1150], [509, 920], [762, 740], [265, 655], [522, 400]] },
  B: { bg: 'mid_b', h: 1536, slots: [[294, 1085], [782, 1085], [517, 885], [795, 630], [515, 330]] },
  T: { bg: 'top', h: 1024, slots: [] },
};
// 화면 크기 (논리 px, 놀이공원 기둥 폭 540 = 그림 1024px). 놀이기구 칸은 받침 폭 272px(그림 기준)에 맞춘 460x470 그림
const PK = { W: 540, K: 540 / 1024, OV: 90, PLATE: 272 };
PK.RW = Math.round(PK.PLATE * 460 / 400 * PK.K); PK.RH = Math.round(PK.RW * 470 / 460); PK.FOOT = PK.RH * 14 / 470;
const DECOS = ['deco1', 'deco2', 'deco3'];
let parkOrder = [], parkSlots = [], editing = false, editSel = -1;

// 게임 수에 맞춰 구간을 쌓고 모든 자리 위치를 계산: { secs: [[구간, 바닥 b]], slots: [{x, b(받침 아랫선)}], H }
function parkLayout(nGames) {
  const secs = [], slots = []; let b = 0, k = 0;
  const addSec = (key) => {
    const S = PARK_SECTIONS[key]; secs.push([key, b]);
    for (const [x, y] of S.slots) slots.push({ x: x * PK.K, b: b + (S.h - y) * PK.K });
    b += S.h * PK.K - PK.OV;
  };
  addSec('E');
  while (slots.length < nGames + 1) addSec(k++ % 2 ? 'B' : 'A');
  addSec('T');
  return { secs, slots, H: b + PK.OV };
}
// 지금 캐릭터의 배치 (마지막 자리 = Open soon 은 빼고): 저장된 배치 + 새로 생긴 게임은 앞쪽 빈자리(장식 자리)에
function parkIds(c, nSlots) {
  const all = GAME_CARDS.map((g) => g.id), seen = new Set();
  const order = (Hub.park(c) || []).map((id) => (all.includes(id) && !seen.has(id) && seen.add(id) ? id : null)).slice(0, nSlots);
  while (order.length < nSlots) order.push(null);
  for (const id of all) if (!order.includes(id)) { const k = order.indexOf(null); if (k >= 0) order[k] = id; }
  return order;
}
const slotPos = (i) => parkSlots[i];
// 놀이기구 이름표 아래 한 줄: 징검다리 게임은 모은 별, 나머지는 최고 기록
function rideSub(g, c) {
  const r = Hub.rec(g.id, c);
  if (Hub.GAMES[g.id].stages) return `<img src="hub/park/ui/star.webp${PARK_V}" alt="">${Object.values(r.stages).reduce((a, x) => a + (x.stars || 0), 0)}`;
  return r.plays ? `BEST ${r.best.toLocaleString()}${g.unit === '점' ? '' : 'm'}` : 'NEW';
}
function renderLobby() {
  const c = Hub.active();
  $('meFace').src = face(c); $('meName').textContent = c.name;
  $('meCoins').textContent = c.coins.toLocaleString(); $('meStars').textContent = Hub.starsTotal(c); $('meGems').textContent = Hub.gems(c);
  const earned = c.earned || 0, lv = Math.floor(earned / LV_STEP) + 1, cur = earned % LV_STEP;
  $('meLv').textContent = `Lv.${lv}`; $('meLvBar').style.width = `${(cur / LV_STEP) * 100}%`;
  // 롤러코스터: 지금 캐릭터가 앞자리 (은유 계열 / 은결 계열)
  const lk = (window.CHAR_LOOKS || []).find((l) => l.look === c.look);
  $('pkCoaster').src = `hub/park/coaster/${(lk ? lk.base : c.look) === 'eungyeol' ? 'eungyeol' : 'eunyu'}.webp${PARK_V}`;
  const L = parkLayout(GAME_CARDS.length);
  parkSlots = L.slots; parkOrder = parkIds(c, L.slots.length - 1);
  renderPark();
  preloadIntros();
}
function renderPark(keepScroll) {
  const sc = $('pkScroll'), world = $('pkWorld'), prevTop = sc.scrollTop, prevH = world.offsetHeight;
  const c = Hub.active(), L = parkLayout(GAME_CARDS.length);
  world.style.height = L.H + 'px'; world.innerHTML = '';
  world.classList.toggle('editing', editing);
  // 배경 (위 구간이 아래 구간 위에 OV만큼 겹치며 흐리게 이어짐)
  L.secs.forEach(([key, b], k) => {
    const S = PARK_SECTIONS[key], d = document.createElement('div');
    d.className = 'pk-bg' + (k ? ' fade' : ''); d.style.bottom = b + 'px'; d.style.height = S.h * PK.K + 'px';
    d.style.backgroundImage = `url(hub/park/bg/${S.bg}.webp${PARK_V})`;
    world.appendChild(d);
  });
  // 입구 광장의 가게 2채 (아이템샵 · 꾸미기) — 놀이기구처럼 이름표
  for (const [cls, x, y, label, href] of PARK_SECTIONS.E.shops) {
    const s = document.createElement('button'); s.className = 'pk-shop ' + cls;
    s.style.left = x * PK.K - 46 + 'px'; s.style.bottom = (PARK_SECTIONS.E.h - y) * PK.K - 4 + 'px';
    s.innerHTML = `<img src="hub/park/ui/${cls}.webp${PARK_V}" alt=""><span class="name">${label}</span>`;
    s.addEventListener('click', () => { if (editing) return; blip(); location.href = href; });
    world.appendChild(s);
  }
  // 표지판 2개 (맨 위 하늘 구간의 양옆 아래)
  const tb = L.secs[L.secs.length - 1][1] + 120;
  for (const [x, text] of [[82, '오늘은 어떤 게임을<br>플레이할까? ♡'], [458, '좋아하는 게임으로<br>가득 채워 가는<br>나만의 게임랜드! ♡']]) {
    const g = document.createElement('div'); g.className = 'pk-sign';
    g.style.left = x - 70 + 'px'; g.style.bottom = tb + 'px';
    g.innerHTML = `<img src="hub/park/ui/sign.webp${PARK_V}" alt=""><span>${text}</span>`;
    world.appendChild(g);
  }
  // 놀이기구·장식·Open soon (뒤쪽(위) 자리부터 그려서 앞쪽(아래) 놀이기구가 위에 겹치게)
  const n = L.slots.length;
  for (let i = n - 1; i >= 0; i--) {
    const p = L.slots[i], soon = i === n - 1, id = soon ? null : parkOrder[i], g = id && GAME_CARDS.find((x) => x.id === id);
    const b = document.createElement('button');
    b.className = 'pk-ride' + (soon ? ' soon' : g ? '' : ' deco') + (editing && i === editSel ? ' sel' : '');
    b.style.left = p.x - PK.RW / 2 + 'px'; b.style.bottom = p.b - PK.FOOT + 'px';
    b.style.width = PK.RW + 'px'; b.style.height = PK.RH + 'px';
    b.style.setProperty('--d', `${(i % 5) * -0.37}s`); // 말풍선·흔들림이 다 같이 움직이지 않게
    b.dataset.i = i; if (g) b.dataset.id = g.id;
    b.innerHTML = g
      ? `<img class="art" src="hub/park/rides/${g.id}.webp${PARK_V}" alt=""><span class="play">PLAY!</span><span class="name"><b></b><small>${rideSub(g, c)}</small></span>`
      : soon ? `<img class="art" src="hub/park/rides/soon.webp${PARK_V}" alt=""><span class="name"><b>Open soon</b></span>`
        : `<img class="art" src="hub/park/rides/${DECOS[i % DECOS.length]}.webp${PARK_V}" alt="">`;
    if (g) b.querySelector('.name b').textContent = EN_NAME[g.id] || g.name;
    b.setAttribute('aria-label', g ? EN_NAME[g.id] || g.name : soon ? 'Open soon' : '장식');
    world.appendChild(b);
  }
  // 처음엔 맨 아래(입구)에서 시작. 게임에서 돌아오면 보던 자리로
  if (keepScroll) sc.scrollTop = prevTop + (world.offsetHeight - prevH);
  else {
    let y = null; try { y = sessionStorage.getItem('park_scroll'); } catch (e) { /* ignore */ }
    sc.scrollTop = y != null ? +y : sc.scrollHeight;
  }
}
const saveParkScroll = () => { try { sessionStorage.setItem('park_scroll', $('pkScroll').scrollTop); } catch (e) { /* ignore */ } };
window.addEventListener('pagehide', saveParkScroll);
$('pkScroll').addEventListener('scroll', () => { if (!$('scrLobby').classList.contains('hidden')) saveParkScroll(); }, { passive: true });

// ----- 놀이기구 누르기 · 길게 누르기 · 편집(자리 바꾸기) -----
function setEditing(on, sel = -1) {
  editing = on; editSel = sel;
  $('pkEditBar').classList.toggle('hidden', !on); $('pkEdit').classList.toggle('hidden', on);
  renderPark(true);
}
function swapRides(a, b) {
  if (a === b || a < 0 || b < 0 || a >= parkOrder.length || b >= parkOrder.length) return false;
  [parkOrder[a], parkOrder[b]] = [parkOrder[b], parkOrder[a]];
  Hub.setPark(parkOrder); blip(1046); return true;
}
$('pkEdit').addEventListener('click', () => { blip(); setEditing(true); });
$('pkDone').addEventListener('click', () => { blip(880); setEditing(false); toast('배치를 저장했어요!'); });
$('pkReset').addEventListener('click', () => { blip(); Hub.setPark(null); parkOrder = parkIds(Hub.active(), parkSlots.length - 1); setEditing(true); toast('처음 배치로 돌려놓았어요'); });
$('pkMe').addEventListener('click', () => { if (editing) return; blip(); go('select'); });
$('btnGems').addEventListener('click', () => { blip(); toast('다이아는 곧 만날 수 있어요! 💎'); });
$('setOld').addEventListener('click', () => { blip(); try { sessionStorage.setItem('twin_ver', '0.1'); } catch (e) { /* ignore */ } location.href = 'v0.1/#lobby'; });
(function parkInput() {
  const world = $('pkWorld'), sc = $('pkScroll');
  let press = null, longT = 0, drag = null, auto = 0, skipClick = false;
  const rideAt = (e) => e.target.closest && e.target.closest('.pk-ride');
  // 화면 좌표 → 놀이공원 좌표 (x, 바닥에서 위로 b)
  const toWorld = (cx, cy) => { const r = world.getBoundingClientRect(); return { x: (cx - r.left) / scaleNow, b: (r.bottom - cy) / scaleNow }; };
  const nearest = (w) => {
    let best = -1, bd = 1e9;
    for (let i = 0; i < parkOrder.length; i++) { const p = slotPos(i), dd = Math.hypot(p.x - w.x, p.b + PK.RH * 0.35 - w.b); if (dd < bd) { bd = dd; best = i; } }
    return bd < PK.RW * 0.7 ? best : -1;
  };
  world.addEventListener('contextmenu', (e) => e.preventDefault());
  world.addEventListener('pointerdown', (e) => {
    skipClick = false; // 새로 누르기 시작: 앞의 길게 누르기·끌기에서 남은 '클릭 무시'는 없앰
    const el = rideAt(e); if (!el || el.classList.contains('soon')) return;
    press = { el, i: +el.dataset.i, x: e.clientX, y: e.clientY, id: e.pointerId };
    clearTimeout(longT);
    if (!editing) longT = setTimeout(() => { if (press) { skipClick = true; setEditing(true, press.i); blip(1046); press = null; } }, 550);
  });
  window.addEventListener('pointermove', (e) => {
    if (!press || e.pointerId !== press.id) return;
    const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y);
    if (!editing) { if (moved > 10) { clearTimeout(longT); press = null; } return; }
    if (!drag && moved > 10) { // 편집 중 끌기 시작
      const el = world.querySelector(`.pk-ride[data-i="${press.i}"]`);
      drag = { el, i: press.i, w0: toWorld(press.x, press.y) }; el.classList.add('drag');
      auto = setInterval(() => { // 화면 위·아래 끝에 가까우면 저절로 스크롤
        const r = sc.getBoundingClientRect(), m = 70 * scaleNow;
        if (drag.cy < r.top + m) sc.scrollTop -= 12; else if (drag.cy > r.bottom - m) sc.scrollTop += 12; else return;
        follow();
      }, 16);
    }
    if (drag) { drag.cx = e.clientX; drag.cy = e.clientY; follow(); e.preventDefault(); }
  }, { passive: false });
  function follow() {
    const w = toWorld(drag.cx, drag.cy);
    drag.el.style.transform = `translate(${w.x - drag.w0.x}px, ${drag.w0.b - w.b}px) scale(1.08)`;
    const t = nearest(w);
    world.querySelectorAll('.pk-ride.target').forEach((x) => x.classList.remove('target'));
    if (t >= 0 && t !== drag.i) world.querySelector(`.pk-ride[data-i="${t}"]`).classList.add('target');
  }
  const end = (e) => {
    clearTimeout(longT);
    if (drag) {
      clearInterval(auto);
      const t = nearest(toWorld(drag.cx, drag.cy));
      skipClick = true; const from = drag.i; drag = null; press = null;
      if (t >= 0 && swapRides(from, t)) editSel = -1;
      renderPark(true); return;
    }
    press = null;
  };
  window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
  world.addEventListener('click', (e) => {
    const el = rideAt(e); if (!el) return;
    if (skipClick) { skipClick = false; return; }
    const i = +el.dataset.i;
    if (el.classList.contains('soon')) { blip(500); toast('새 놀이기구가 곧 열려요!'); return; }
    if (!editing) { if (el.classList.contains('deco')) { blip(600); return; } const g = GAME_CARDS.find((x) => x.id === el.dataset.id); blip(880); showTitle(g); return; }
    if (editSel < 0) { editSel = i; blip(); renderPark(true); }
    else if (editSel === i) { editSel = -1; blip(500); renderPark(true); }
    else { swapRides(editSel, i); editSel = -1; renderPark(true); }
  });
})();
// 게임 타이틀 화면: 메인 그림을 화면 가득 → START를 누르면 게임(또는 징검다리 지도)으로
let titleGame = null;
// 인트로 그림: 화면이 가로면 가로 그림(<id>_land.webp), 세로면 세로 그림 — 폰·태블릿을 돌리면 바로 바뀜
const landMQ = window.matchMedia('(orientation: landscape)');
const introSrc = (g) => `${landMQ.matches ? g.key.replace('.webp', '_land.webp') : g.key}?v=202611010106`;
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

function renameMe() {
  const c = Hub.active();
  const n = prompt('새 이름 (8글자까지)', c.name);
  if (n && n.trim()) { Hub.rename(c.id, n); toast('이름을 바꿨어요!'); renderLobby(); }
}
// 설정
function renderSettings() { $('setSoundVal').textContent = Hub.settings.sound ? '켜짐' : '꺼짐'; }
$('btnSettings').addEventListener('click', () => { blip(); renderSettings(); openModal('popSettings'); });
$('setSound').addEventListener('click', () => { Hub.setSound(!Hub.settings.sound); document.body.classList.toggle('muted', !Hub.settings.sound); renderSettings(); blip(); });
$('setRename').addEventListener('click', () => { closeModals(); renameMe(); });
// ---------- 3. 스카이훅 징검다리 ----------
// 월드마다 배경 그림 카드 1장, 그 안에서 돌다리 5개(사천성은 10개)가 아래 → 위로 올라감
// 가로 화면: 카드가 옆으로 나란히 (좌우로 밀기) / 폰 세로 화면: 카드가 위아래로 (위아래로 밀기)
let portraitNow = false, mapPortrait = null; // mapPortrait: 지도를 그릴 때의 화면 방향
const WORLD_BG = (w) => `common/worlds/w${w + 1}.webp?v=202611010106`;
// 판 위치 (카드 안에서 %): 아래(1판) → 위(마지막 판) 지그재그, 월드마다 조금씩 다르게
//  · 월드당 5판(스카이훅) / 10판(사천성: 두 줄로 번갈아 올라감)
function stoneSpot(w, k, K = 5) {
  const flip = w % 2 ? -1 : 1;
  if (K > 5) return { x: 50 + ((k % 2 ? 70 : 30) + (Math.floor(k / 2) % 2 ? 4 : -4) - 50) * flip, y: 92 - k * (78 / (K - 1)) };
  const ys = [88, 72, 56, 40, 24];
  const xs = [56, 34, 62, 36, 54];
  return { x: 50 + (xs[k] - 50) * flip, y: ys[k] };
}
// 쉬움·어려움 모드가 있는 게임(사천성): 지도 위 단추로 바꿈. 마지막으로 본 모드를 이 기기에 기억 (게임에서 돌아와도 그대로)
const MODE_KEY = 'twin_gameland_mapmode';
const mapHard = (g) => { try { return !!Hub.GAMES[g].hard && JSON.parse(localStorage.getItem(MODE_KEY) || '{}')[g] === 'hard'; } catch (e) { return false; } };
function setMapHard(g, on) {
  try { const m = JSON.parse(localStorage.getItem(MODE_KEY) || '{}'); m[g] = on ? 'hard' : 'easy'; localStorage.setItem(MODE_KEY, JSON.stringify(m)); } catch (e) { /* ignore */ }
}
document.querySelectorAll('#mapMode button').forEach((b) => b.addEventListener('click', () => {
  const on = b.dataset.mode === 'hard';
  if (on === mapHard(mapGame)) return;
  if (on && !Hub.stageUnlocked(mapGame, Hub.GAMES[mapGame].stages)) { blip(300); toast('쉬움 1-10 까지 깨면 어려움이 열려요!'); return; }
  blip(); setMapHard(mapGame, on); renderMap();
}));
// 지도 위 내 캐릭터: v3 전신 그림(CharV2)이 지금 판 돌 위에 서서 숨 쉬듯 움직임.
// 판을 깨고 돌아오면 지난번 서 있던 돌(같은 월드)에서 다음 돌로 깡충 뛰어감. 지난 자리는 이 기기에만 기억 (진행도와 따로)
const HERO_KEY = 'twin_gameland_maphero';
let hero = null; // { el, cv, look, pose, until, t }
function heroPose(name, ms) { if (hero) { hero.pose = name; hero.until = performance.now() + ms; } }
function placeHero(panel, c, i, p, w, K, O) {
  if (!window.CharV2 || !CharV2.is(c.look) || Hub.costumeImg(c)) return false;
  CharV2.load(c.look);
  const el = document.createElement('div'); el.className = 'map-hero';
  const cv = document.createElement('canvas'); cv.width = 120; cv.height = 152; el.appendChild(cv);
  el.style.left = p.x + '%'; el.style.top = p.y + '%'; panel.appendChild(el);
  hero = { el, cv, look: c.look, pose: '', until: 0 };
  let last = {}; try { last = JSON.parse(localStorage.getItem(HERO_KEY) || '{}'); } catch (e) { /* ignore */ }
  const key = `${mapGame}:${c.id}`, from = last[key];
  if (typeof from === 'number' && from < i && Math.floor((from - O) / K) === w && from >= O) { // 같은 월드 앞 돌에서 출발
    const q = stoneSpot(w, (from - O) % K, K);
    el.style.transition = 'none'; el.style.left = q.x + '%'; el.style.top = q.y + '%';
    setTimeout(() => {
      el.style.transition = ''; el.classList.add('hop'); heroPose('jump_up', 620);
      el.style.left = p.x + '%'; el.style.top = p.y + '%';
      setTimeout(() => { el.classList.remove('hop'); heroPose('happy', 700); }, 640);
    }, 450);
  }
  last[key] = i; try { localStorage.setItem(HERO_KEY, JSON.stringify(last)); } catch (e) { /* ignore */ }
  return true;
}
function heroTick(t) {
  requestAnimationFrame(heroTick);
  if (!hero || !hero.el.isConnected) return;
  const g = hero.cv.getContext('2d'); g.clearRect(0, 0, hero.cv.width, hero.cv.height);
  const L = hero.look;
  let pose = t < hero.until && CharV2.has(L, hero.pose) ? hero.pose : (Math.floor(t / 520) % 2 && CharV2.has(L, 'idle_1') ? 'idle_1' : 'idle_0');
  if (!CharV2.has(L, pose)) pose = 'idle';
  const breathe = 1 + Math.sin(t / 260) * 0.015;
  g.save(); g.translate(hero.cv.width / 2, hero.cv.height - 6); g.scale(1, breathe);
  CharV2.draw(g, L, pose, { h: hero.cv.height * 0.92 });
  g.restore();
}
requestAnimationFrame(heroTick);
function renderMap() {
  const GM = Hub.GAMES[mapGame], c = Hub.active(), N = GM.stages, K = GM.perWorld;
  const hard = mapHard(mapGame), O = hard ? N : 0; // 어려움 판 번호는 N 부터
  $('mapName').textContent = GM.name + (hard ? ' · 어려움' : '');
  $('mapFace').src = face(c); $('mapCoins').textContent = c.coins;
  $('mapMode').classList.toggle('hidden', !GM.hard);
  document.querySelectorAll('#mapMode button').forEach((b) => b.classList.toggle('on', (b.dataset.mode === 'hard') === hard));
  $('mapMode').classList.toggle('locked', !Hub.stageUnlocked(mapGame, N, c));
  $('scrMap').classList.toggle('hard', hard);
  const myStars = Object.values(Hub.rec(mapGame, c).stages).reduce((a, x) => a + (x.stars || 0), 0);
  $('mapProg').textContent = `${Hub.stageCleared(mapGame, c, hard)} / ${N} 클리어 · ⭐ ${myStars}`;
  $('mapHint').textContent = hard ? '쉬움에서 한 월드(N-1 ~ N-10)를 다 깨면 어려움의 같은 월드가 열려요.' : '앞 스테이지를 깨면 다음 돌다리가 열려요. 깬 스테이지는 다시 할 수 있어요!';
  const scroller = $('mapScroll'), track = $('mapTrack'); track.innerHTML = '';
  mapPortrait = portraitNow;
  track.className = 'map-track ' + (portraitNow ? 'vert' : 'horiz');
  track.style.width = ''; track.style.height = '';
  const next = Hub.stageNext(mapGame, c, hard), allClear = Hub.stageCleared(mapGame, c, hard) === N;
  const meAt = allClear ? O + N - 1 : next;
  let currentPanel = null;
  GM.worlds.forEach((name, w) => {
    const panel = document.createElement('div');
    const worldOpen = Hub.stageUnlocked(mapGame, O + w * K, c);
    panel.className = 'wpanel' + (worldOpen ? '' : ' locked');
    panel.style.backgroundImage = `url(${WORLD_BG(w)})`;
    if (K > 5) { if (portraitNow) panel.style.height = '900px'; else panel.style.width = '300px'; } // 10판 월드는 카드를 더 크게
    panel.innerHTML = `<div class="wtitle w${w % 5}">${w + 1}. ${name}${hard ? ' <i class="hardtag">어려움</i>' : ''}</div>`;
    // dotted path through the 5 stones
    const pts = []; for (let k = 0; k < K; k++) { const p = stoneSpot(w, k, K); pts.push(`${p.x},${p.y}`); }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'wpath'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none');
    svg.innerHTML = `<polyline points="${pts.join(' ')}" fill="none" stroke="#fff" stroke-width="2.4" stroke-dasharray="0.1 5" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity=".95"/>`;
    panel.appendChild(svg);
    for (let k = 0; k < K; k++) {
      const i = O + w * K + k, p = stoneSpot(w, k, K), st = Hub.stage(mapGame, i, c), open = Hub.stageUnlocked(mapGame, i, c);
      const lbl = Hub.stageLabel(i - O, mapGame); // 돌다리에는 "1-1" 만 (어려움은 지도 이름에)
      const b = document.createElement('button');
      b.className = 'stone ' + (st.cleared ? 'cleared' : open ? 'current' : 'locked') + (i === next && !allClear ? ' next' : ''); // next: 지금 해야 할 판
      b.style.left = p.x + '%'; b.style.top = p.y + '%';
      const stars = st.cleared ? [0, 1, 2].map((k) => `<i class="${k < st.stars ? 'on' : ''}"></i>`).join('') : '';
      b.innerHTML = open ? `<span class="sl">${lbl}</span><span class="ss">${stars}</span>` : `<span class="ss">${lbl}</span>`; // 잠긴 판: 자물쇠는 돌 그림에 있음
      b.addEventListener('click', () => {
        if (open) heroPose('cheer', 900);
        if (!open) {
          blip(300);
          const easyLast = w * K + K - 1; // 어려움: 쉬움 같은 월드 마지막 판을 아직 못 깼으면 그걸 알려 줌
          toast(hard && !Hub.stage(mapGame, easyLast, c).cleared ? `쉬움 ${Hub.stageLabel(easyLast, mapGame)} 까지 깨면 열려요!` : '앞 스테이지를 먼저 깨요!');
          return;
        }
        blip(); openStage(i);
      });
      panel.appendChild(b);
      if (i === meAt) {
        if (!placeHero(panel, c, i, p, w, K, O)) { // v3 그림이 없거나 옷을 입었으면 예전 얼굴 동그라미
          const me = document.createElement('div'); me.className = 'map-me';
          me.style.backgroundImage = `url(${face(c)})`; me.style.left = p.x + '%'; me.style.top = p.y + '%';
          panel.appendChild(me);
        }
        currentPanel = panel;
      }
    }
    if (w === GM.worlds.length - 1) { const g = document.createElement('img'); g.className = 'goal-flag'; g.src = 'hub/ui/map/trophy.webp?v=202611010106'; g.alt = '마지막 트로피'; panel.appendChild(g); }
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
  $('stStars').innerHTML = [0, 1, 2].map((k) => `<img src="hub/ui/map/${k < st.stars ? 'star' : 'star_off'}.webp?v=202611010106" alt="${k < st.stars ? '별' : '빈 별'}">`).join('');
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
    + GAME_CARDS.map((g) => `<div class="rec-card"><div class="thumb" style="background-image:url(${g.thumb}?v=202611010106)"></div>
      <div><div class="t">${g.name}${Hub.isFav(g.id, c) ? ' <span class="star-on">★</span>' : ''}</div><div class="v">${g.rec(c, Hub.rec(g.id, c))}</div></div></div>`).join('');
  const list = $('recList'); list.innerHTML = '';
  if (!c.history.length) list.innerHTML = '<li><span>아직 기록이 없어요. 게임을 해봐요!</span></li>';
  for (const h of c.history) {
    const li = document.createElement('li');
    const what = (Hub.GAMES[h.game] && Hub.GAMES[h.game].stages)
      ? `${{ shisen: '사천성', memory: '메모리 게임', mole: '두더지 게임' }[h.game] || '스카이훅'} ${Hub.stageLabel(h.stage, h.game)} <span class="${h.cleared ? 'ok' : 'no'}">${h.cleared ? '클리어 ' + '⭐'.repeat(h.stars) : '실패'}</span>`
      : `${{ stairs: '계단 오르기', downhill: '다운힐 러너', bakery: '달콤 베이커리', dogsnack: '멍멍이 간식 타임', darts: '다트 게임' }[h.game] || '헬리콥터'} <span class="ok">${h.dist.toLocaleString()}${['bakery', 'dogsnack', 'darts'].includes(h.game) ? '점' : 'm'}</span>`;
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
  // 아이폰 홈 화면 앱: visualViewport 높이가 실제 화면보다 작게 나올 때가 있어서(아래 흰 띠) 더 큰 쪽을 씀
  const { vw } = viewSize(), vh = Math.max(viewSize().vh, window.innerHeight);
  const s = $('safe').getBoundingClientRect();
  const inset = { t: s.top, l: s.left, r: vw - s.right, b: vh - s.bottom };
  // 첫 화면(놀이공원)은 세로 전용: PC 가로 창에서도 세로 모양으로 가운데에. 폰·태블릿을 가로로 들면 '세로로 돌려 주세요' 안내
  portraitNow = (isTouch && vh > vw) || (!isTouch && !$('scrLobby').classList.contains('hidden'));
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
