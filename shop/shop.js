'use strict';
// 트윈 게임랜드 아이템 샵 v2
//  · 배경 스킨: 모든 게임 공통. 한 번 사면 계속 내 것, '적용하기'로 모든 게임 배경을 바꿈
//  · 게임 카드(스크롤해도 고정)로 게임을 고르면 그 게임의 게임 부스트 / 보유 아이템이 보임
//  · 게임 부스트: 1개씩 사서 모음. 수량은 구매·게임 보상·게임에서 사용 모두 같은 숫자(common/profile.js)
const $ = (id) => document.getElementById(id);
const V = '?v=202610282227'; // bump when images change so phones don't show old cached ones
if (!window.Hub || !Hub.active()) location.replace('../index.html');

const GAMES = [
  { id: 'skyhook', name: '스카이훅', img: 'assets/games/skyhook.webp' },
  { id: 'helicopter', name: '트윈 헬리콥터', img: 'assets/games/helicopter.webp' },
  { id: 'stairs', name: '계단 오르기', img: 'assets/games/stairs.webp' },
  { id: 'shisen', name: '사천성', img: 'assets/games/shisen.webp' },
  { id: 'downhill', name: '다운힐 러너', img: 'assets/games/downhill.webp' },
  { id: 'memory', name: '메모리 게임', img: 'assets/games/memory.webp' },
  { id: 'mole', name: '두더지 게임', img: 'assets/games/mole.webp' },
  { id: 'bakery', name: '달콤 베이커리', img: 'assets/games/bakery.webp' },
  { id: 'dogsnack', name: '멍멍이 간식 타임', img: 'assets/games/dogsnack.webp' },
];
// 부스트 그림: 새 아이콘이 있으면 그것, 없으면 예전 아이콘
const boostIcon = (id) => `../common/items/${id}.webp${V}`;
const skinThumb = (id) => `assets/skins/${id}.webp${V}`;
const COIN = `assets/ui/coin.webp${V}`;

let game = 'skyhook';
try { game = sessionStorage.getItem('shop_game') || game; } catch (e) { /* ignore */ }
const q = new URLSearchParams(location.search);
if (q.get('game')) game = q.get('game');
if (!GAMES.some((g) => g.id === game && !g.soon)) game = 'skyhook';

// ---------- sound / toast / confirm ----------
const { blip, toast } = window.UI; // common/ui.js
const ching = () => { blip(988, 0.08); setTimeout(() => blip(1319, 0.14), 70); };
function confirmBox(title, html, okText, onOk, cancel = true) {
  $('mTitle').textContent = title; $('mBody').innerHTML = html; $('mOk').textContent = okText;
  $('mCancel').classList.toggle('hidden', !cancel);
  $('modal').classList.remove('hidden');
  $('mOk').onclick = () => { $('modal').classList.add('hidden'); onOk(); };
}
$('mCancel').onclick = () => $('modal').classList.add('hidden');
$('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') $('modal').classList.add('hidden'); });
const coinImg = `<img src="${COIN}" alt="" style="width:20px;height:20px;display:inline-block;vertical-align:-4px">`;

// ---------- header ----------
function renderHeader(bump) {
  const c = Hub.active();
  $('myCoins').textContent = c.coins;
  $('myFace').src = faceOf(c);
  if (bump) { const p = document.querySelector('.coin-pill'); p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); }
}

// ---------- 게임 카드 ----------
function renderGames() {
  const box = $('games'); box.innerHTML = '';
  for (const g of GAMES) {
    const b = document.createElement('button');
    b.className = 'game' + (g.id === game ? ' on' : '') + (g.soon ? ' soon' : '');
    b.innerHTML = `<div class="gi"><img src="${g.img}${V}" alt=""></div><div class="gn">${g.name}</div>`;
    b.onclick = () => {
      if (g.soon) { blip(300); toast(`${g.name}은(는) 곧 나와요!`); return; }
      blip(); game = g.id; try { sessionStorage.setItem('shop_game', game); } catch (e) { /* ignore */ }
      renderAll();
    };
    box.appendChild(b);
  }
}

// ---------- 배경 스킨 ----------
function renderSkins() {
  const row = $('skinRow'); row.innerHTML = '';
  for (const s of Hub.SKINS) {
    const owned = Hub.ownsSkin(s.id), eq = Hub.equippedSkin() === s.id;
    const d = document.createElement('div'); d.className = 'skin' + (eq ? ' on' : '');
    const btn = eq ? '<button class="sbtn green" disabled>적용중</button>'
      : owned ? '<button class="sbtn gold" data-act="equip">적용하기</button>'
        : `<button class="sbtn buy${Hub.active().coins < s.price ? ' poor' : ''}" data-act="buy"><img src="${COIN}" alt="">${s.price}</button>`;
    d.innerHTML = `<div class="pic"><img src="${skinThumb(s.id)}" alt="">${eq ? '<span class="check">✓</span>' : ''}</div><div class="nm">${s.name}</div>${btn}`;
    const el = d.querySelector('[data-act]');
    if (el) el.onclick = () => (el.dataset.act === 'equip' ? equipSkin(s) : buySkin(s));
    row.appendChild(d);
  }
  row.scrollLeft = 0;
}
function lack(price) {
  const c = Hub.active();
  if (c.coins >= price) return false;
  blip(300); toast(`코인이 ${price - c.coins}개 모자라요. 게임을 해서 모아요!`); return true;
}
function buySkin(s) {
  if (lack(s.price)) return;
  confirmBox('배경 스킨 구매', `<img class="mthumb" src="${skinThumb(s.id)}" alt="">모든 게임 배경을<br><b>${s.name}</b>(으)로 바꿀까요?<br>${coinImg} ${s.price} 코인`, '구매', () => {
    if (Hub.buySkin(s.id).ok) { ching(); toast(`${s.name} 적용! 모든 게임 배경이 바뀌어요`); renderHeader(true); renderAll(); }
  });
}
function equipSkin(s) { Hub.equipSkin(s.id); blip(900); toast(`${s.name} 적용! 모든 게임에 바뀌어요`); renderAll(); }

// ---------- 게임 부스트 (사기) ----------
function renderBoosts() {
  const grid = $('boostGrid'); grid.innerHTML = '';
  for (const b of Hub.BOOSTS[game] || []) {
    const n = Hub.boostCount(game, b.id);
    const d = document.createElement('button');
    d.className = 'bcard' + (Hub.active().coins < b.price ? ' poor' : '');
    d.innerHTML = `${n ? `<span class="have">x${n}</span>` : ''}<img class="bi" src="${boostIcon(b.id)}" alt=""><div class="bn">${b.name}</div><div class="bd">${b.desc}</div>`
      + `<div class="price-pill"><img src="${COIN}" alt="">${b.price}</div>`;
    d.onclick = () => buyBoost(b);
    grid.appendChild(d);
  }
}
function buyBoost(b) {
  if (lack(b.price)) return;
  confirmBox('부스트 구매', `<img class="mthumb" src="${boostIcon(b.id)}" style="width:84px" alt=""><b>${b.name}</b> — ${b.desc}<br>1개를 살까요? ${coinImg} ${b.price} 코인`, '구매', () => {
    if (Hub.buyBoost(game, b.id).ok) {
      ching(); toast(`${b.name} +1! 지금 ${Hub.boostCount(game, b.id)}개 있어요`); renderHeader(true); renderAll();
    }
  });
}

// ---------- 보유 아이템 ----------
function renderOwned() {
  const grid = $('ownedGrid'); grid.innerHTML = '';
  const mine = (Hub.BOOSTS[game] || []).filter((b) => Hub.boostCount(game, b.id) > 0);
  if (!mine.length) { grid.innerHTML = '<div class="empty">아직 가진 부스트가 없어요.<br>왼쪽 게임 부스트에서 살 수 있어요!</div>'; return; }
  for (const b of mine) {
    const n = Hub.boostCount(game, b.id), using = Hub.isUsing(game, b.id);
    const d = document.createElement('div'); d.className = 'bcard' + (using && !b.manual ? ' using' : '');
    // 게임 시작 때 쓰는 부스트는 '사용중' 켜기/끄기, 게임 화면 버튼으로 쓰는 아이템은 안내만
    const ctl = b.manual ? '<div class="manual-note">게임 화면 버튼으로 써요</div>'
      : `<button class="use-chip${using ? ' on' : ''}">${using ? '사용중' : '안 씀'}</button>`;
    d.innerHTML = `<img class="bi" src="${boostIcon(b.id)}" alt=""><div class="bn">${b.name}</div><div class="cnt-pill">x${n}</div>${ctl}`;
    const chip = d.querySelector('.use-chip');
    if (chip) chip.onclick = () => { Hub.setUsing(game, b.id, !using); blip(using ? 500 : 900); toast(!using ? `${b.name}: 다음 게임부터 사용해요` : `${b.name}: 안 쓰고 아껴 둘게요`); renderOwned(); };
    grid.appendChild(d);
  }
}
// ---------- 캐릭터 꾸미기 ----------
const COS_IMG = (look, id) => (id ? `../common/costumes/${look}_${id}.webp${V}` : `../common/faces/${look}_base.webp${V}`);
const BASE_FULL = (look) => `../common/costumes/${look}_base.webp${V}`; // 기본 옷 전신 그림
const faceOf = (c) => Hub.costumeImg(c, '../') || `../common/faces/${c.look}_base.webp${V}`;
const fullOf = (look, id) => (id ? COS_IMG(look, id) : BASE_FULL(look));
const DRESS_ALL = [{ id: null, name: '기본 옷', price: 0, desc: '처음 입고 있던 옷이에요' }, ...Hub.COSTUMES];
// 새 캐릭터(v2)는 아직 옷 그림이 없어서 기본 옷만
let DRESS_LIST = DRESS_ALL;
const dressFor = (c) => (DRESS_LIST = Hub.canDress(c) ? DRESS_ALL : [{ ...DRESS_ALL[0], desc: '새 캐릭터 옷은 준비 중이에요. 곧 입을 수 있어요!' }]);
let dressSel = 0;
function renderDressEntry() {
  const chars = Hub.chars();
  const a = chars[0], b = chars.find((x) => x.look !== (a && a.look)) || chars[1];
  $('dressFace1').src = a ? faceOf(a) : ''; $('dressFace2').src = b ? faceOf(b) : '';
  $('dressFace2').style.display = b ? '' : 'none';
  const c = Hub.active(), strip = $('dressStrip'); strip.innerHTML = '';
  if (!Hub.canDress(c)) { strip.innerHTML = '<div class="dress-soon">새 캐릭터 옷은 준비 중이에요 👗</div>'; return; }
  for (const [k, it] of Hub.COSTUMES.entries()) {
    const own = Hub.ownsCostume(it.id), worn = Hub.costume() === it.id;
    const d = document.createElement('button'); d.className = 'dchip' + (worn ? ' on' : '');
    d.innerHTML = `<img src="${COS_IMG(c.look, it.id)}" alt=""><div class="cn">${it.name}</div>`
      + (own ? `<div class="cp own">${worn ? '입는 중' : '보유'}</div>` : `<div class="cp"><img src="${COIN}" alt="">${it.price}</div>`);
    d.onclick = () => openDress(k + 1);
    strip.appendChild(d);
  }
}
function openDress(sel) {
  dressFor(Hub.active());
  dressSel = sel != null ? sel : Math.max(0, DRESS_LIST.findIndex((x) => x.id === Hub.costume()));
  $('dress').classList.remove('hidden'); document.body.style.overflow = 'hidden';
  blip(); renderDress();
}
function closeDress() { $('dress').classList.add('hidden'); document.body.style.overflow = ''; renderHeader(); renderDressEntry(); }
function renderDress() {
  const c = Hub.active();
  dressFor(c); if (dressSel >= DRESS_LIST.length) dressSel = 0;
  $('dressCoins').textContent = c.coins;
  // 내 캐릭터들 (캐릭터마다 코인·옷이 따로)
  const who = $('dressWho'); who.innerHTML = '';
  for (const ch of Hub.chars()) {
    const b = document.createElement('button'); b.className = `dwho ${ch.look}` + (ch.id === c.id ? ' on' : '');
    b.innerHTML = `<img src="${faceOf(ch)}" alt=""><span></span>`;
    b.querySelector('span').textContent = `${ch.name} (${((window.CHAR_LOOKS || []).find((l) => l.look === ch.look) || { base: ch.look }).base === 'eunyu' ? '핑크' : '블루'})`;
    b.onclick = () => { if (ch.id === c.id) return; blip(); Hub.setActive(ch.id); renderHeader(); renderAll(); openDress(); };
    who.appendChild(b);
  }
  const it = DRESS_LIST[dressSel], own = it.id === null || Hub.ownsCostume(it.id), worn = (Hub.costume() || null) === it.id;
  $('dressImg').src = fullOf(c.look, it.id); $('dressImg').style.animation = 'none'; void $('dressImg').offsetWidth; $('dressImg').style.animation = '';
  $('dName').textContent = it.name;
  $('dDesc').textContent = it.desc;
  $('dPrice').className = 'dprice' + (own ? ' own' : '');
  $('dPrice').innerHTML = own ? (worn ? '✓ 입는 중' : '✓ 가지고 있어요') : `<img src="${COIN}" alt="">${it.price}`;
  const act = $('dAct');
  act.className = 'dact' + (worn ? ' worn' : own ? ' wear' : (c.coins < it.price ? ' poor' : ''));
  act.textContent = worn ? '입는 중' : own ? '입기' : '구매하기';
  act.disabled = worn;
  const list = $('dressList'); list.innerHTML = '';
  DRESS_LIST.forEach((x, k) => {
    const o = x.id === null || Hub.ownsCostume(x.id), w = (Hub.costume() || null) === x.id;
    const d = document.createElement('button'); d.className = 'ditem' + (k === dressSel ? ' sel' : '') + (o ? '' : ' locked') + (w ? ' worn' : '');
    d.innerHTML = `<img src="${fullOf(c.look, x.id)}" alt="">${o ? '' : '<span class="lock">🔒</span>'}<div class="cn">${x.name}</div>`;
    d.onclick = () => { blip(); dressSel = k; renderDress(); };
    list.appendChild(d);
  });
}
$('dPrev').onclick = () => { blip(); dressSel = (dressSel + DRESS_LIST.length - 1) % DRESS_LIST.length; renderDress(); };
$('dNext').onclick = () => { blip(); dressSel = (dressSel + 1) % DRESS_LIST.length; renderDress(); };
$('dressClose').onclick = () => { blip(500); closeDress(); };
$('dAct').onclick = () => {
  const it = DRESS_LIST[dressSel], c = Hub.active();
  if (it.id === null || Hub.ownsCostume(it.id)) { Hub.wearCostume(it.id); ching(); toast(`${it.name}을(를) 입었어요! 모든 게임에 적용돼요`); renderDress(); renderHeader(); return; }
  if (lack(it.price)) return;
  confirmBox('의상 구매', `<img class="mthumb" src="${fullOf(c.look, it.id)}" style="width:100px" alt=""><b>${c.name}</b>에게 <b>${it.name}</b>을(를) 사서 입힐까요?<br>${coinImg} ${it.price} 코인`, '구매', () => {
    if (Hub.buyCostume(it.id).ok) { ching(); toast(`${it.name} 구매 완료! 바로 입었어요`); renderHeader(true); renderDress(); }
  });
};
$('btnDress').onclick = () => openDress();
document.querySelectorAll('[data-dress]').forEach((b) => { b.onclick = () => openDress(); });

// ---------- 쿠폰 ----------
$('btnCoupon').onclick = () => {
  blip(); $('couponInput').value = ''; $('couponMsg').textContent = ''; $('couponMsg').className = 'coupon-msg';
  $('coupon').classList.remove('hidden'); setTimeout(() => $('couponInput').focus(), 50);
};
$('couponCancel').onclick = () => $('coupon').classList.add('hidden');
$('coupon').addEventListener('click', (e) => { if (e.target.id === 'coupon') $('coupon').classList.add('hidden'); });
function useCoupon() {
  const r = Hub.redeem($('couponInput').value);
  $('couponMsg').textContent = r.msg; $('couponMsg').className = 'coupon-msg' + (r.ok ? ' ok' : '');
  if (r.ok) { ching(); renderHeader(true); renderAll(); $('couponInput').value = ''; } else blip(300);
}
$('couponOk').onclick = useCoupon;
$('couponInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') useCoupon(); });

function renderAll() { renderGames(); renderSkins(); renderBoosts(); renderOwned(); renderDressEntry(); }

document.querySelectorAll('[data-scroll]').forEach((b) => {
  b.onclick = () => { const el = $(b.dataset.scroll); el.scrollBy({ left: el.clientWidth * 0.8, behavior: 'smooth' }); };
});
// 게임 선택 줄이 위에 붙으면 작게
(() => {
  const wrap = document.querySelector('.games-wrap');
  const onScroll = () => {
    const top = parseFloat(getComputedStyle(wrap).top) || 0;
    wrap.classList.toggle('stuck', wrap.getBoundingClientRect().top <= top + 1 && window.scrollY > 0);
  };
  window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onScroll); onScroll();
})();

// ---------- start ----------
Hub.starterKit('shisen'); Hub.starterKit('memory'); Hub.starterKit('mole'); // 사천성·메모리·두더지 게임 기본 아이템을 아직 안 받았으면 지금 지급 (게임과 같은 수량을 보여 주려고)
window.addEventListener('pageshow', () => { Hub.reload(); Hub.starterKit('shisen'); Hub.starterKit('memory'); Hub.starterKit('mole'); renderHeader(); renderAll(); });
renderHeader(); renderAll();
// 고른 게임 카드가 보이게
requestAnimationFrame(() => { const on = document.querySelector('.game.on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' }); window.scrollTo(0, 0); });
