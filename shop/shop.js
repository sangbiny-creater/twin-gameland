'use strict';
// 트윈 게임랜드 아이템 샵 — 게임별 배경 스킨(한 번 사면 계속) + 게임 부스트(1회용, 게임 시작 때 1개씩 사용)
const $ = (id) => document.getElementById(id);
const V = '?v=20261022j'; // bump when images change so phones don't show old cached ones
if (!window.Hub || !Hub.active()) location.replace('../index.html');

const GAMES = [
  { id: 'skyhook', name: '스카이훅', sub: '줄타기 게임', img: 'assets/card_skyhook.jpg' + V },
  { id: 'helicopter', name: '트윈 헬리콥터', sub: '비행 게임', img: 'assets/card_helicopter.jpg' + V },
  { id: 'stairs', name: '계단 오르기', sub: '점프 게임', img: 'assets/card_stairs.jpg' + V },
  { id: 'shisen', name: '사천성', sub: '퍼즐 게임', img: 'assets/card_shisen.jpg' + V },
];
// 부스트 아이콘 (계단 오르기 시간 부스트와 사천성 시간 부스트는 같은 그림)
const boostIcon = (id) => `assets/icons/${id}.png${V}`;
const TAB_TEXT = {
  skins: ['배경 스킨', '게임의 배경을 바꿔서 새로운 분위기에서 플레이해보세요!'],
  boosts: ['게임 부스트', "사 두면 게임을 시작할 때 '사용중'인 아이템이 1개씩 쓰여요."],
  owned: ['보유 아이템', '산 스킨을 적용하거나, 쓸 부스트만 골라 켜 두세요.'],
};
const COIN = '../helicopter/assets/coin.png';
let game = 'skyhook', tab = 'skins';
try { game = sessionStorage.getItem('shop_game') || game; tab = sessionStorage.getItem('shop_tab') || tab; } catch (e) { /* ignore */ }
const q = new URLSearchParams(location.search);
if (q.get('game')) game = q.get('game');
if (!GAMES.some((g) => g.id === game)) game = 'skyhook';

// ---------- sound ----------
let actx = null;
function blip(f = 700, d = 0.09) {
  if (!Hub.settings.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d + 0.02);
  } catch (e) { /* no audio */ }
}
const ching = () => { blip(988, 0.08); setTimeout(() => blip(1319, 0.14), 70); };

let toastT = 0;
function toast(text) { const el = $('toast'); el.textContent = text; el.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.add('hidden'), 1800); }

function confirmBuy(title, html, okText, onOk) {
  $('mTitle').textContent = title; $('mBody').innerHTML = html; $('mOk').textContent = okText;
  $('modal').classList.remove('hidden');
  $('mOk').onclick = () => { $('modal').classList.add('hidden'); onOk(); };
}
$('mCancel').onclick = () => $('modal').classList.add('hidden');
$('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') $('modal').classList.add('hidden'); });

// ---------- header ----------
function renderHeader(bump) {
  const c = Hub.active();
  $('myCoins').textContent = c.coins;
  $('myFace').src = `../skyhook/assets/${c.look}_base.jpg`;
  if (bump) { const p = document.querySelector('.coin-pill'); p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); }
}

// ---------- game cards ----------
function renderGames() {
  const box = $('gameCards'); box.innerHTML = '';
  for (const g of GAMES) {
    const b = document.createElement('button');
    b.className = `gcard ${g.id}` + (g.id === game ? ' on' : '');
    b.innerHTML = `<img src="${g.img}" alt=""><div class="gtext"><div class="gn">${g.name}</div><div class="gs">(${g.sub})</div></div><span class="gb">아이템 보기 ›</span>`;
    b.onclick = () => { blip(); setGame(g.id, true); };
    box.appendChild(b);
  }
  const soon = document.createElement('div'); soon.className = 'gcard coming'; soon.style.display = 'none'; // 4개 게임이 꽉 차서 숨김
  soon.innerHTML = `<img src="assets/card_coming.jpg${V}" alt=""><div class="gtext"><div class="gn">추가 게임</div><div class="gs">COMING SOON</div></div><span class="gb">준비 중</span>`;
  box.appendChild(soon);
  const sel = $('gameSelect'); sel.innerHTML = GAMES.map((g) => `<option value="${g.id}">${g.name} (${g.sub})</option>`).join('');
  sel.value = game; $('pickImg').src = GAMES.find((g) => g.id === game).img;
}
$('gameSelect').onchange = (e) => { blip(); setGame(e.target.value, false); };
function setGame(id, scroll) {
  game = id; try { sessionStorage.setItem('shop_game', id); } catch (e) { /* ignore */ }
  renderGames(); renderContent();
  if (scroll) document.querySelector('.panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- tabs ----------
document.querySelectorAll('.tab').forEach((t) => { t.onclick = () => { blip(); setTab(t.dataset.tab); }; });
$('navMine').onclick = (e) => { e.preventDefault(); setTab('owned'); document.querySelector('.panel').scrollIntoView({ behavior: 'smooth' }); };
$('btnGuide').onclick = () => {
  confirmBuy('아이템 샵 이용 안내', `<div style="text-align:left">
    🖼️ <b>배경 스킨</b> — 한 번 사면 계속 내 것! 게임마다 따로 사고, '적용하기'를 누른 스킨으로 그 게임 배경이 바뀌어요.<br><br>
    🚀 <b>게임 부스트</b> — 한 번 쓰면 없어지는 아이템이에요. '사용중'으로 켜 둔 부스트는 게임을 시작할 때 1개씩 쓰여요.<br><br>
    🪙 코인은 게임을 해서 모아요. 캐릭터마다 코인과 아이템이 따로예요.</div>`, '알겠어요', () => {});
  $('mCancel').classList.add('hidden');
  const back = () => { $('mCancel').classList.remove('hidden'); };
  $('mOk').addEventListener('click', back, { once: true });
};
function setTab(name) {
  tab = name; try { sessionStorage.setItem('shop_tab', name); } catch (e) { /* ignore */ }
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === name));
  renderContent();
}

// ---------- items ----------
const skinThumb = (id) => `assets/skins/${game === 'shisen' ? 'shisen_' : ''}${id}.jpg${V}`;
const priceHTML = (p) => `<div class="price"><img src="${COIN}" alt="">${p}</div>`;
function skinCard(s, ownedView) {
  const owned = Hub.ownsSkin(game, s.id), eq = Hub.equippedSkin(game) === s.id;
  const d = document.createElement('div'); d.className = 'item' + (eq ? ' equipped' : '');
  let bottom;
  if (eq) bottom = '<button class="btn green" disabled>적용중</button>';
  else if (owned) bottom = '<button class="btn blue" data-act="equip">적용하기</button>';
  else bottom = priceHTML(s.price) + `<button class="btn pink${Hub.active().coins < s.price ? ' poor' : ''}" data-act="buy">구매</button>`;
  d.innerHTML = `<img class="thumb" src="${skinThumb(s.id)}" alt="">${eq ? '<span class="check">✓</span>' : ''}<div class="name">${s.name}</div>${owned && !eq && !ownedView ? '<div class="count">보유</div>' : ''}${bottom}`;
  const btn = d.querySelector('button[data-act]');
  if (btn) btn.onclick = () => (btn.dataset.act === 'equip' ? equipSkin(s) : buySkin(s));
  return d;
}
function boostCard(b, ownedView) {
  const n = Hub.boostCount(game, b.id), using = Hub.isUsing(game, b.id);
  const d = document.createElement('div'); d.className = 'item';
  const toggle = n > 0 ? `<button class="btn ${using ? 'teal' : 'line'}" data-act="use">${using ? '사용중' : '사용하기'}</button>` : '';
  d.innerHTML = `<img class="icon" src="${boostIcon(b.id)}" alt=""><div class="name">${b.name}</div><div class="desc">${b.desc}</div>`
    + (ownedView ? `<div class="count">x${n}</div>${toggle}`
      : `${priceHTML(b.price)}${n ? `<div class="count">보유 x${n}</div>` : ''}<div class="btn-row"><button class="btn pink${Hub.active().coins < b.price ? ' poor' : ''}" data-act="buy">구매</button>${toggle}</div>`);
  d.querySelectorAll('button[data-act]').forEach((btn) => {
    btn.onclick = () => {
      if (btn.dataset.act === 'buy') buyBoost(b);
      else { Hub.setUsing(game, b.id, !using); blip(using ? 500 : 900); toast(!using ? `${b.name}: 다음 게임부터 사용해요` : `${b.name}: 안 쓰고 아껴 둘게요`); renderContent(); }
    };
  });
  return d;
}
function lack(price) {
  const c = Hub.active();
  if (c.coins >= price) return false;
  blip(300); toast(`코인이 ${price - c.coins}개 모자라요. 게임을 해서 모아요!`); return true;
}
function buySkin(s) {
  if (lack(s.price)) return;
  const g = GAMES.find((x) => x.id === game);
  confirmBuy('스킨 구매', `<img class="mthumb" src="${skinThumb(s.id)}" alt=""><b>${g.name}</b> 배경을<br><b>${s.name}</b>(으)로 바꿀까요?<br><img src="${COIN}" style="width:20px;vertical-align:-4px"> ${s.price} 코인`, '구매', () => {
    const r = Hub.buySkin(game, s.id);
    if (r.ok) { ching(); toast(`${s.name} 적용 완료! 다음 ${g.name}부터 바뀌어요`); renderHeader(true); renderContent(); }
  });
}
function equipSkin(s) { Hub.equipSkin(game, s.id); blip(900); toast(`${s.name} 적용!`); renderContent(); }
function buyBoost(b) {
  if (lack(b.price)) return;
  confirmBuy('부스트 구매', `<img class="mthumb" src="${boostIcon(b.id)}" style="width:80px" alt=""><b>${b.name}</b> — ${b.desc}<br>1개를 살까요? <img src="${COIN}" style="width:20px;vertical-align:-4px"> ${b.price} 코인`, '구매', () => {
    const r = Hub.buyBoost(game, b.id);
    if (r.ok) { ching(); toast(`${b.name} +1! 다음 게임 시작할 때 써요`); renderHeader(true); renderContent(); }
  });
}

function renderContent() {
  const [title, desc] = TAB_TEXT[tab];
  $('secTitle').textContent = title; $('secDesc').textContent = desc;
  const box = $('content'); box.innerHTML = '';
  const grid = () => { const g = document.createElement('div'); g.className = 'grid'; box.appendChild(g); return g; };
  const head = (t) => { const h = document.createElement('div'); h.className = 'sub-h'; h.textContent = t; box.appendChild(h); };
  if (tab === 'skins') { const g = grid(); for (const s of Hub.skinsFor(game)) g.appendChild(skinCard(s, false)); }
  else if (tab === 'boosts') { const g = grid(); for (const b of Hub.BOOSTS[game]) g.appendChild(boostCard(b, false)); }
  else {
    head('★ 보유 배경 스킨'); const g1 = grid();
    for (const s of Hub.skinsFor(game)) if (Hub.ownsSkin(game, s.id)) g1.appendChild(skinCard(s, true));
    head('★ 보유 부스트 아이템');
    const mine = Hub.BOOSTS[game].filter((b) => Hub.boostCount(game, b.id) > 0);
    if (!mine.length) { const e = document.createElement('div'); e.className = 'empty'; e.textContent = "아직 부스트가 없어요. '게임 부스트'에서 살 수 있어요."; box.appendChild(e); }
    else { const g2 = grid(); for (const b of mine) g2.appendChild(boostCard(b, true)); }
  }
}

window.addEventListener('pageshow', () => { Hub.reload(); renderHeader(); renderGames(); setTab(tab); });
renderHeader(); renderGames(); setTab(tab);
