'use strict';
// 트윈 게임랜드 아이템샵 (v0.4 새 구성)
//  · 위: 상점 그림 + 코인·다이아 + 출석 보상·광고보기
//  · 탭: 꾸미기(놀이공원 꾸미기) / 아이템(코인, 모든 게임 공통 수량) / 다이아 구매(common/monet.js 결제 흐름을 그대로 씀)
//  · 옷장은 별도 화면 (closet/)
const $ = (id) => document.getElementById(id);
const V = '?v=202611101847'; // bump when images change so phones don't show old cached ones
if (!window.Hub || !Hub.active()) location.replace('../index.html');

const q = new URLSearchParams(location.search);
const COIN = `assets/ui/coin.webp${V}`, GEM = `../hub/park/ui/gem.webp${V}`, MONET = '../common/ui/monet/';
const coinImg = `<img src="${COIN}" alt="" style="width:20px;height:20px;display:inline-block;vertical-align:-4px">`;
const gemImg = `<img src="${GEM}" alt="" style="width:20px;height:20px;display:inline-block;vertical-align:-4px">`;
const M = () => window.Monet; // 보관판(v0.1·v0.2)에는 없음 → 다이아 구매 탭·위 카드를 뺌

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
function lack(price) {
  const c = Hub.active();
  if (c.coins >= price) return false;
  blip(300); toast(`코인이 ${price - c.coins}개 모자라요. 게임을 해서 모아요!`); return true;
}

// ---------- 위 칸 ----------
function renderHeader(bump) {
  const c = Hub.active();
  $('myCoins').textContent = c.coins.toLocaleString(); $('myGems').textContent = Hub.gems(c).toLocaleString();
  if (bump) { const p = document.querySelector('.sh-money'); p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); }
  if (!M() || !M().today) return;
  $('topCards').classList.remove('hidden');
  $('attDays').textContent = `${(M().st().att || { count: 0 }).count}일`; // 누적 출석
  const left = M().adLeft(), max = M().AD_GEMS_DAY;
  $('adMsg').textContent = `광고보고 다이아 ${M().AD_GEMS}개 (${max - left}/${max})`;
  $('adCard').disabled = left <= 0;
}
$('adCard').onclick = () => { blip(); M().watchAd(); };

// ---------- 탭 ----------
let tab = 'deco';
function showTab(t) {
  tab = t;
  document.querySelectorAll('.sh-tabs [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  for (const k of ['deco', 'item', 'gem']) $(`tab-${k}`).classList.toggle('hidden', k !== t);
}
document.querySelectorAll('.sh-tabs [data-tab]').forEach((b) => { b.onclick = () => { blip(); showTab(b.dataset.tab); }; });
$('gemPill').onclick = () => { if (!M() || !M().today) return; blip(); showTab('gem'); document.querySelector('.sh-tabs').scrollIntoView({ block: 'start', behavior: 'smooth' }); };

// ---------- 아이템: 8개를 한 화면에 — 아이콘·이름·가격, 오른쪽 위에 가진 수량 (수량은 모든 게임이 같이 씀) ----------
//  누르면 구매 창에서 어떤 게임에 쓰는지 알려 줌. 하트 그림은 하트 통일 규칙대로 common/ui/heart.webp
const itemIcon = (id) => (id === 'life' ? `../common/ui/heart.webp${V}` : `../common/items/${id}.webp${V}`);
const gameName = (g) => (Hub.GAMES[g] && Hub.GAMES[g].name) || g;
function renderItems() {
  const grid = $('boostGrid'); grid.innerHTML = '';
  for (const [id, it] of Object.entries(Hub.ITEMS)) {
    const n = Hub.boostCount(it.games[0], id);
    const d = document.createElement('button');
    d.className = 'bcard item' + (Hub.active().coins < it.price ? ' poor' : '');
    d.innerHTML = `${n ? `<span class="have">x${n}</span>` : ''}<img class="bi" src="${itemIcon(id)}" alt=""><div class="bn">${it.name}</div>`
      + `<div class="price-pill"><img src="${COIN}" alt="">${it.price}</div>`;
    d.onclick = () => {
      if (lack(it.price)) return;
      const how = it.manual ? '게임 화면의 버튼으로 하나씩 꺼내 써요' : '게임 시작 창에서 골라서 써요';
      confirmBox('아이템 구매', `<img class="mthumb" src="${itemIcon(id)}" style="width:84px" alt=""><b>${it.name}</b> — ${it.desc}<br><small>쓰는 게임: ${it.games.map(gameName).join(' · ')}<br>${how}</small><br>1개를 살까요? ${coinImg} ${it.price} 코인`, '구매', () => {
        if (Hub.buyBoost(it.games[0], id).ok) { ching(); toast(`${it.name} +1! 지금 ${Hub.boostCount(it.games[0], id)}개 있어요`); renderHeader(true); renderAll(); }
      });
    };
    grid.appendChild(d);
  }
}

// ---------- 다이아 구매: 다이아 4종 + 이어하기권 · 월 다이아 패스 · 광고 없이 보상 ----------
function renderGems() {
  const ready = !!(M() && M().today); $('tabGemBtn').classList.toggle('hidden', !ready); if (!ready) return;
  const { PACKS, OFFERS, CONT_PACK, won, bm, st } = M(), first = !bm().paid;
  const packs = $('gmPacks'); packs.innerHTML = '';
  PACKS.forEach((p, i) => {
    const b = document.createElement('button'); b.className = 'gm-pack';
    b.innerHTML = `${first ? '<i class="gm-flag">첫 구매 2배</i>' : p.hot ? '<i class="gm-flag">인기</i>' : ''}<b>다이아 ${first ? p.gems * 2 : p.gems}</b><img src="${MONET}pack_${i + 1}.webp${V}" alt=""><span class="gm-won">${won(p.won)}</span>`;
    b.onclick = () => { blip(); M().fakePay(p); };
    packs.appendChild(b);
  });
  const row = (cls, img, name, desc, btn, on, off) => {
    const b = document.createElement('button'); b.className = `gm-offer ${cls}`; b.disabled = !!off;
    b.innerHTML = `<img src="${MONET}${img}.webp${V}" alt=""><span class="gm-t"><b>${name}</b><small>${desc}</small></span><span class="gm-won">${btn}</span>`;
    b.onclick = () => { blip(); on(); }; return b;
  };
  const box = $('gmOffers'), B = bm(); box.innerHTML = '';
  const pass = OFFERS.find((o) => o.id === 'gem_pass_30'), noAds = OFFERS.find((o) => o.id === 'no_ads_reward');
  box.appendChild(row('cont', 'pack_continue', CONT_PACK.name, `지금 ${st().conts || 0}장 있어요`, `<img src="${GEM}" alt="">${CONT_PACK.gems}`, () => M().buyConts()));
  box.appendChild(row('', pass.img, pass.name, B.pass > 0 ? `${B.pass}일 남음` : pass.desc, won(pass.won), () => M().fakePay(pass)));
  box.appendChild(row('', noAds.img, noAds.name, B.noAds ? '가지고 있어요' : noAds.desc, B.noAds ? '구매함' : won(noAds.won), () => M().fakePay(noAds), B.noAds));
}

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
  if (r.ok && !r.restart) { ching(); renderHeader(true); renderAll(); $('couponInput').value = ''; } else if (r.ok) ching(); else blip(300);
  if (r.ok && r.go) setTimeout(() => { location.href = '../' + r.go; }, 700); // 버전 이동 쿠폰 (enterv1~enterv4)·restart·dayplus 는 첫 화면으로
}
$('couponOk').onclick = useCoupon;
$('couponInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') useCoupon(); });

// ---------- 놀이공원 꾸미기 (v0.3 첫 화면에서만 쓰므로 v0.3에서만 보임) — 다이아로 삼 ----------
function renderPark() {
  if (Hub.ver !== '0.4' || !Hub.PARK_ITEMS) return;
  $('park').classList.remove('hidden');
  const box = $('parkShop'); box.innerHTML = '';
  const gems = () => Hub.gems();
  for (const [kind, K] of Object.entries(Hub.PARK_ITEMS)) {
    const row = document.createElement('div'); row.className = 'park-row';
    row.innerHTML = `<div class="park-k">${K.name}</div><div class="bgrid"></div>`;
    K.order.forEach((n) => {
      const k = n - 1, name = K.items[k], own = Hub.ownsParkItem(kind, n), d = document.createElement('div'), img = '../' + Hub.parkItemImg(kind, n) + V;
      const used = own && Hub.parkKindUsed(kind).has(n);
      d.className = `bcard park-card ${kind}` + (own ? ' owned' : '') + (used ? ' on' : '') + (!own && gems() < K.price ? ' poor' : '');
      // 가진 것: 배경 스킨처럼 '적용하기' → 첫 화면의 그 종류 전체가 바뀜 (첫 화면에서 눌러 고르는 것도 그대로)
      // 동상은 첫 화면에 자리가 여러 곳이라 아이템샵에서 한꺼번에 적용하지 않음 → 첫 화면에서 동상을 눌러 바꿈 (누르면 안내)
      const statue = kind === 'statue';
      d.innerHTML = `<span class="park-theme">${(K.themes && K.themes[k]) || ''}</span>${used ? '<span class="check">✓</span>' : ''}<img class="bi" src="${img}" alt=""><div class="bn"></div>`
        + (used ? '<button class="sbtn green park-apply" disabled>적용 중</button>' : own && statue ? '<button class="sbtn park-apply statue-how">첫 화면에서</button>' : own ? '<button class="sbtn gold park-apply">적용하기</button>' : `<button class="price-pill gem"><img src="${GEM}" alt="">${K.price}</button>`);
      d.querySelector('.bn').textContent = name;
      const ap = d.querySelector('.park-apply');
      if (ap && statue) { if (!used) ap.onclick = () => statueHow(img, name); }
      else if (ap) ap.onclick = () => { Hub.applyParkKind(kind, n); blip(900); toast(`${name} 적용! 첫 화면의 ${K.name}이(가) 바뀌어요`); renderPark(); };
      if (statue && own) d.querySelector('.bi').onclick = () => statueHow(img, name);
      const btn = d.querySelector('.price-pill');
      if (btn) btn.onclick = () => {
        if (gems() < K.price) { blip(300); toast(`다이아가 ${K.price - gems()}개 모자라요! 첫 화면의 다이아 칸에서 모을 수 있어요`); return; }
        confirmBox('놀이공원 꾸미기', `<img class="mthumb" src="${img}" alt=""><b>${name}</b>을(를) 살까요?<br>${gemImg} 다이아 ${K.price}개`, '구매', () => {
          const r = Hub.buyParkItem(kind, n);
          if (r.ok) { ching(); toast(`${name}을(를) 샀어요! '적용하기'를 누르면 첫 화면에 놓여요`); renderHeader(true); renderAll(); }
        });
      };
      row.querySelector('.bgrid').appendChild(d);
    });
    box.appendChild(row);
  }
}
// 동상 안내: 동상은 첫 화면의 동상 자리를 눌러서 바꿈 (자리가 여러 곳)
function statueHow(img, name) {
  blip(); confirmBox('동상 바꾸기', `<img class="mthumb" src="${img}" alt=""><b>${name}</b><br>동상은 첫 화면에서 바꿔요!<br>첫 화면의 동상을 누르면 가진 동상 중에서 골라 놓을 수 있어요.`, '확인', () => {}, false);
}
function renderAll() { renderItems(); renderGems(); renderPark(); }

// ---------- start ----------
function start() {
  Hub.starterKit('shisen'); Hub.starterKit('memory'); Hub.starterKit('mole'); // 사천성·메모리·두더지 게임 기본 아이템을 아직 안 받았으면 지금 지급 (게임과 같은 수량을 보여 주려고)
  window.addEventListener('pageshow', () => { Hub.reload(); Hub.starterKit('shisen'); Hub.starterKit('memory'); Hub.starterKit('mole'); renderHeader(); renderAll(); });
  // common/monet.js 는 common/profile.js 가 따로 불러서 늦게 준비될 수 있음 (보관판에는 없음)
  const monet = () => { Monet.onChange = () => { renderHeader(true); renderAll(); }; renderHeader(); renderAll(); }; // 결제·광고·이어하기권 뒤 숫자 다시 그리기
  if (window.Monet && Monet.today) monet(); else window.addEventListener('monet-ready', monet);
  renderHeader(); renderAll(); showTab(q.get('tab') || 'deco'); // ?tab=gem: 옷장의 + 버튼
  // 첫 화면의 동상·분수·대문 고르기에서 '아이템샵'으로 오면 (#park) 놀이공원 꾸미기 칸으로
  if (location.hash === '#park') setTimeout(() => { const el = $('park'); if (!el.classList.contains('hidden')) el.scrollIntoView({ block: 'start' }); }, 120);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
