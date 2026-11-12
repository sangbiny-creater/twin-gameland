'use strict';
// 옷장 (첫 화면에서 들어오는 별도 화면, 뒤로 가면 첫 화면으로)
//  왼쪽 은유·은결, 가운데 전신(방 배경), 오른쪽 옷 칸. 옷을 누르면 미리 보고, 아래 버튼으로 입거나 다이아로 삼
const $ = (id) => document.getElementById(id);
const V = '?v=202611121724'; // bump when images change so phones don't show old cached ones
if (!window.Hub || !Hub.active()) location.replace('../index.html');

const GEM = `../hub/park/ui/gem.webp${V}`;
const gemImg = `<img src="${GEM}" alt="" style="width:20px;height:20px;display:inline-block;vertical-align:-4px">`;
const whoOf = (c) => (Hub.lookBase(c.look) === 'eungyeol' ? 'eungyeol' : 'eunyu');
const { blip, toast } = window.UI; // common/ui.js
const ching = () => { blip(988, 0.08); setTimeout(() => blip(1319, 0.14), 70); };

// 백오피스에서 추가한 옷(custom)은 올린 그림 주소를 그대로 씀
const findIt = (id) => (Hub.outfits() || []).find((x) => x.id === id);
const bodyImg = (who, id) => { const it = findIt(id); return it && it.custom ? it.body : `assets/${who}_${id || 'base'}.webp${V}`; };
const itemImg = (who, id) => { const it = findIt(id); return it && it.custom ? it.item : `assets/item_${who}_${id || 'base'}.webp${V}`; };
const BASE_OUTFIT = { id: null, name: '기본 옷', price: 0 };
let sel = Hub.outfit(); // 지금 미리 보는 옷 (null = 기본 옷)

// 그림을 먼저 다 받아 둔 뒤 한 번에 바꿈 (은유↔은결·옷을 바꿀 때 예전 그림이 새 크기로 커졌다가 바뀌지 않게) — common/boot.js
const listOf = (c) => { const all = [BASE_OUTFIT, ...Hub.outfits(c)]; return [...all.filter((x) => Hub.ownsOutfit(x.id, c)), ...all.filter((x) => !Hub.ownsOutfit(x.id, c))]; };
const imgsFor = (c, s) => { const who = whoOf(c); return [`assets/room_${who}.webp${V}`, bodyImg(who, s), ...Hub.chars().map((ch) => `../common/faces/${ch.look}_base.webp${V}`), ...listOf(c).map((it) => itemImg(who, it.id))]; };
let drawSeq = 0;
function render() {
  const seq = ++drawSeq, need = imgsFor(Hub.active(), sel);
  if (!window.Boot) { draw(); return null; }
  return Boot.ready(need).then(() => { if (seq === drawSeq) draw(); });
}
function draw() {
  const c = Hub.active(), who = whoOf(c), all = [BASE_OUTFIT, ...Hub.outfits(c)];
  const list = listOf(c); // 산 옷이 위, 안 산 옷이 아래
  $('clGems').textContent = Hub.gems(c).toLocaleString();
  $('clRoom').src = `assets/room_${who}.webp${V}`;
  $('clBody').src = bodyImg(who, sel); $('clBody').classList.toggle('small', who === 'eunyu'); // 은유·은결 키 차이
  // 왼쪽: 내 캐릭터 (은유·은결은 코인·다이아·옷이 따로)
  const whoBox = $('clWho'); whoBox.innerHTML = '';
  for (const ch of Hub.chars()) {
    const b = document.createElement('button'); b.className = `cl-char ${whoOf(ch)}` + (ch.id === c.id ? ' on' : '');
    b.innerHTML = `<img src="../common/faces/${ch.look}_base.webp${V}" alt=""><span></span>`;
    b.querySelector('span').textContent = ch.name;
    b.onclick = () => { if (ch.id === c.id) return; blip(); Hub.setActive(ch.id); sel = Hub.outfit(); render(); };
    whoBox.appendChild(b);
  }
  // 고른 옷의 게임 효과 (겨울옷·베이커리 옷): 캐릭터 화면 오른쪽 아래
  const pick = all.find((x) => x.id === sel); $('clNote').textContent = (pick && pick.note) || ''; $('clNote').classList.toggle('hidden', !(pick && pick.note));
  // 오른쪽: 옷 칸
  const box = $('clList'), keep = box.scrollTop; box.innerHTML = '';
  for (const it of list) {
    const own = Hub.ownsOutfit(it.id, c), worn = Hub.outfit(c) === it.id;
    const d = document.createElement('div'); d.className = 'cl-card' + (sel === it.id ? ' sel' : '') + (worn ? ' worn' : '');
    d.innerHTML = `${worn ? '<span class="cl-tag">착용 중</span>' : ''}<img src="${itemImg(who, it.id)}" alt=""><b></b>`
      + (worn ? '' : own ? '<button class="cl-btn wear">착용하기</button>' : `<button class="cl-btn buy${Hub.gems(c) < it.price ? ' poor' : ''}"><img src="${GEM}" alt="">${it.price}</button>`);
    d.querySelector('b').textContent = it.name;
    d.onclick = () => {
      if (sel !== it.id) { blip(); sel = it.id; render(); } else if (worn) { blip(); location.href = '../index.html#lobby'; } // 입고 있는 옷을 한 번 더 누르면 첫 화면으로
    };
    const btn = d.querySelector('.cl-btn');
    if (btn) btn.onclick = (e) => { e.stopPropagation(); sel = it.id; if (own) wear(it); else buy(it); };
    box.appendChild(d);
  }
  box.scrollTop = keep; // 옷을 눌러도 목록이 맨 위로 튀지 않게
}
function wear(it) { Hub.wearOutfit(it.id); ching(); toast(`${it.name}을(를) 입었어요!`); render(); }
function buy(it) {
  const c = Hub.active();
  render();
  if (Hub.gems(c) < it.price) { blip(300); toast(`다이아가 ${it.price - Hub.gems(c)}개 모자라요!`); return; }
  $('mTitle').textContent = '옷 구매';
  $('mBody').innerHTML = `<img class="mthumb" src="${itemImg(whoOf(c), it.id)}" style="width:110px" alt=""><b>${it.name}</b>을(를) 살까요?<br>${gemImg} 다이아 ${it.price}개`;
  $('mOk').textContent = '구매'; $('modal').classList.remove('hidden');
  $('mOk').onclick = () => {
    $('modal').classList.add('hidden');
    if (Hub.buyOutfit(it.id).ok) { ching(); toast(`${it.name}을(를) 입었어요!`); render(); }
  };
}
$('mCancel').onclick = () => $('modal').classList.add('hidden');
$('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') $('modal').classList.add('hidden'); });

window.addEventListener('pageshow', (e) => { if (!e.persisted) return; Hub.reload(); sel = Hub.outfit(); render(); }); // 다이아를 사고 돌아왔을 때 (뒤로 가기로 돌아온 화면)
if (window.Boot) {
  Boot.wait(render()); // 처음 화면: 그림이 다 오면 한 번에
  // 다른 캐릭터·다른 옷 그림은 화면이 뜬 뒤 미리 받아 둠 (눌렀을 때 바로 바뀌게)
  Boot.later(Hub.chars().flatMap((ch) => [BASE_OUTFIT, ...Hub.outfits(ch)].map((it) => bodyImg(whoOf(ch), it.id)).concat(imgsFor(ch, Hub.outfit(ch)))));
} else render();
