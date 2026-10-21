'use strict';
// 트윈 게임랜드 메인 화면: 캐릭터 만들기·선택 → 게임 고르기 → (스카이훅) 징검다리 지도 / 기록 / 아이템샵(오픈 예정)
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
function go(name) {
  if (name !== 'select' && !Hub.active()) name = 'select';
  if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  for (const [k, id] of Object.entries(SCREENS)) $(id).classList.toggle('hidden', k !== name);
  closeModals();
  ({ select: renderSelect, lobby: renderLobby, map: renderMap, records: renderRecords })[name]();
}
window.addEventListener('pageshow', () => { Hub.reload(); go((location.hash || '#select').slice(1) in SCREENS ? location.hash.slice(1) : 'select'); });
window.addEventListener('hashchange', () => { const n = location.hash.slice(1); if (n in SCREENS) go(n); });

function openModal(id) { closeModals(); $(id).classList.remove('hidden'); }
function closeModals() { document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden')); }
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { blip(500); closeModals(); }));
document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) closeModals(); }));
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { blip(); go(b.dataset.go); }));
document.querySelectorAll('[data-open="shop"]').forEach((b) => b.addEventListener('click', () => { blip(); openModal('popShop'); }));

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
function renderLobby() {
  const c = Hub.active();
  $('meFace').src = face(c); $('meName').textContent = c.name;
  $('meCoins').textContent = c.coins; $('meStars').textContent = Hub.starsTotal(c);
  $('subSkyhook').textContent = `징검다리 ${Hub.skyhookCleared(c)} / ${Hub.GAMES.skyhook.stages} · 다음 ${Hub.stageLabel(Hub.skyhookNext(c))}`;
  const h = Hub.rec('helicopter', c);
  $('subHeli').textContent = h && h.plays ? `BEST ${h.best}m · ${h.plays}번 비행` : '아직 안 해봤어요';
}
$('cardSkyhook').addEventListener('click', () => { blip(880); go('map'); });
$('cardHeli').addEventListener('click', () => { blip(880); location.href = Hub.GAMES.helicopter.path; });

// ---------- 3. 스카이훅 징검다리 ----------
const STONE_GAP = 150, WORLD_GAP = 60, PAD = 110;
function stonePos(i) {
  const w = Math.floor(i / Hub.GAMES.skyhook.perWorld);
  return { x: PAD + i * STONE_GAP + w * WORLD_GAP, y: 0.55 + Math.sin(i * 1.1) * 0.22 };
}
function renderMap() {
  const c = Hub.active(), N = Hub.GAMES.skyhook.stages, K = Hub.GAMES.skyhook.perWorld;
  $('mapFace').src = face(c); $('mapCoins').textContent = c.coins;
  $('mapProg').textContent = `${Hub.skyhookCleared(c)} / ${N} 클리어 · ⭐ ${Hub.starsTotal(c)}`;
  const track = $('mapTrack'); track.innerHTML = '';
  const width = stonePos(N - 1).x + PAD + 60;
  track.style.width = width + 'px';
  const h = $('mapScroll').clientHeight || 380;
  // worlds
  Hub.GAMES.skyhook.worlds.forEach((name, w) => {
    const a = stonePos(w * K).x - 80, b = stonePos(w * K + K - 1).x + 80;
    const d = document.createElement('div'); d.className = `world w${w}`;
    d.style.left = a + 'px'; d.style.width = (b - a) + 'px';
    d.innerHTML = `<span class="w-name">${w + 1}. ${name}</span>`;
    track.appendChild(d);
  });
  // dashed path
  const pts = []; for (let i = 0; i < N; i++) { const p = stonePos(i); pts.push(`${p.x},${p.y * h}`); }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'map-path'); svg.setAttribute('width', width); svg.setAttribute('height', h);
  svg.innerHTML = `<polyline points="${pts.join(' ')}" fill="none" stroke="#fff" stroke-width="8" stroke-dasharray="4 16" stroke-linecap="round" opacity=".9"/>`;
  track.appendChild(svg);
  const next = Hub.skyhookNext(c);
  const allClear = Hub.skyhookCleared(c) === N;
  for (let i = 0; i < N; i++) {
    const p = stonePos(i), st = Hub.skyhookStage(i, c), open = Hub.skyhookUnlocked(i, c);
    const b = document.createElement('button');
    const cls = st.cleared ? 'cleared' : open ? 'current' : 'locked';
    b.className = 'stone ' + cls;
    b.style.left = p.x + 'px'; b.style.top = p.y * h + 'px';
    const stars = st.cleared ? '⭐'.repeat(st.stars) + '☆'.repeat(3 - st.stars) : '';
    b.innerHTML = open ? `<span class="sl">${Hub.stageLabel(i)}</span><span class="ss">${stars}</span>` : '<span class="lock">🔒</span><span class="ss">' + Hub.stageLabel(i) + '</span>';
    b.addEventListener('click', () => {
      if (!open) { blip(300); toast('앞 스테이지를 먼저 깨요!'); return; }
      blip(); openStage(i);
    });
    track.appendChild(b);
  }
  const goal = document.createElement('div'); goal.className = 'goal-flag'; goal.textContent = '🏁';
  const gp = stonePos(N - 1); goal.style.left = (gp.x + 80) + 'px'; goal.style.top = (gp.y * h) + 'px';
  track.appendChild(goal);
  const me = document.createElement('div'); me.className = 'map-me';
  const mp = stonePos(allClear ? N - 1 : next);
  me.style.backgroundImage = `url(${face(c)})`; me.style.left = mp.x + 'px'; me.style.top = mp.y * h + 'px';
  track.appendChild(me);
  requestAnimationFrame(() => { $('mapScroll').scrollLeft = Math.max(0, mp.x - $('mapScroll').clientWidth * 0.4); });
}
let stageSel = 0;
function openStage(i) {
  stageSel = i;
  const st = Hub.skyhookStage(i);
  $('stTitle').textContent = `${Hub.stageLabel(i)} ${Hub.stageName(i)}`;
  $('stStars').innerHTML = [0, 1, 2].map((k) => `<span class="${k < st.stars ? '' : 'off'}">⭐</span>`).join('');
  $('stInfo').innerHTML = st.cleared
    ? `클리어! 최고 기록 <b>${st.best}m</b> · ${st.plays}번 도전<br>남은 하트가 많을수록 별이 늘어요.`
    : st.plays ? `아직 못 깼어요. 최고 <b>${st.best}m</b> · ${st.plays}번 도전<br>깨면 다음 돌다리가 열려요!` : '처음 도전하는 스테이지예요!<br>깨면 다음 돌다리가 열려요.';
  $('btnPlayStage').textContent = st.cleared ? '다시 하기' : '출발!';
  openModal('popStage');
}
$('btnPlayStage').addEventListener('click', () => { blip(880); location.href = `${Hub.GAMES.skyhook.path}?stage=${stageSel}`; });

// ---------- 4. 기록 ----------
function fmtDate(t) { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
function renderRecords() {
  const c = Hub.active();
  $('recTitle').textContent = `${c.name}의 기록`;
  const sk = Hub.rec('skyhook', c), he = Hub.rec('helicopter', c);
  $('recSummary').innerHTML = `
    <div class="rec-card total"><div class="v">지금 코인 <b>${c.coins}</b> · 지금까지 모은 코인 <b>${c.earned}</b> · 별 <b>${Hub.starsTotal(c)}</b></div></div>
    <div class="rec-card"><div class="thumb" style="background-image:url(skyhook/assets/keyart.jpg)"></div>
      <div><div class="t">Sky Hook Runner</div><div class="v">징검다리 <b>${Hub.skyhookCleared(c)} / ${Hub.GAMES.skyhook.stages}</b> · ${sk.plays}번 도전<br>최고 거리 <b>${sk.best}m</b> · 모은 코인 <b>${sk.coins}</b></div></div></div>
    <div class="rec-card"><div class="thumb" style="background-image:url(helicopter/assets/keyart.jpg)"></div>
      <div><div class="t">Twin Helicopter</div><div class="v">BEST <b>${he.best}m</b> · ${he.plays}번 비행<br>모은 코인 <b>${he.coins}</b></div></div></div>`;
  const list = $('recList'); list.innerHTML = '';
  if (!c.history.length) list.innerHTML = '<li><span>아직 기록이 없어요. 게임을 해봐요!</span></li>';
  for (const h of c.history) {
    const li = document.createElement('li');
    const what = h.game === 'skyhook'
      ? `스카이훅 ${Hub.stageLabel(h.stage)} <span class="${h.cleared ? 'ok' : 'no'}">${h.cleared ? '클리어 ' + '⭐'.repeat(h.stars) : '실패'}</span>`
      : `헬리콥터 <span class="ok">${h.dist}m</span>`;
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

// drag-to-scroll for the map (works the same when the page is rotated on an upright phone)
let rotatedNow = false, scaleNow = 1;
(function dragScroll() {
  const el = $('mapScroll');
  let sx = 0, sy = 0, start = 0, dragging = false, moved = false;
  el.addEventListener('pointerdown', (e) => { dragging = true; moved = false; sx = e.clientX; sy = e.clientY; start = el.scrollLeft; });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const d = (rotatedNow ? e.clientY - sy : e.clientX - sx) / scaleNow;
    if (Math.abs(d) > 8) moved = true;
    el.scrollLeft = start - d;
  });
  window.addEventListener('pointerup', () => { dragging = false; });
  el.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
})();

// ---------- layout: same full-screen fit as the games (upright phones rotate 90°) ----------
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
function resize() {
  const H = 540;
  const vv = window.visualViewport;
  const vw = Math.round(vv ? vv.width : window.innerWidth), vh = Math.round(vv ? vv.height : window.innerHeight);
  const s = $('safe').getBoundingClientRect();
  const inset = { t: s.top, l: s.left, r: vw - s.right, b: vh - s.bottom };
  const rotated = isTouch && vh > vw;
  const sw = rotated ? vh : vw, sh = rotated ? vw : vh;
  const W = Math.round(H * Math.max(sw / sh, 16 / 9));
  const scale = Math.min(sw / W, sh / H);
  rotatedNow = rotated; scaleNow = scale;
  root.style.width = W + 'px'; root.style.height = H + 'px';
  const ox = (sw - W * scale) / 2, oy = (sh - H * scale) / 2;
  root.style.transform = rotated ? `translate(${vw - oy}px, ${ox}px) rotate(90deg) scale(${scale})` : `translate(${ox}px, ${oy}px) scale(${scale})`;
  const ins = rotated ? { l: inset.t, r: inset.b, t: inset.r, b: inset.l } : inset;
  for (const k of ['l', 'r', 't', 'b']) root.style.setProperty('--safe-' + k, Math.max(0, ins[k] / scale - (k === 'l' || k === 'r' ? ox : oy) / scale) + 'px');
  if (!$('scrMap').classList.contains('hidden')) renderMap();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
resize();
