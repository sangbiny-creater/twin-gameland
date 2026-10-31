'use strict';
// 게임 시작·끝·일시정지 팝업 (팝업 v2) — 규칙: docs/spec/팝업_아이템_정리_v1.md, 그림: common/ui/popup/ (tools/popup_assets.py)
//  · 시작 팝업: GamePop.start({ game, from, onStart(lv), onClose }) — 지금 캐릭터가 신난 그림 + 아이템 칸(눌러 체크) + [시작하기] [XX판부터 시작]
//      아이템은 '사용중'(Hub.setUsing) 표시로 넘겨서 게임의 startRun 이 지금처럼 Hub.takeBoosts 로 꺼내 씀
//  · 결과 창(#result): 지금 캐릭터 표정(무제한형: 최고 기록 = 기쁨 / 아니면 슬픔), NEW BEST! 글자, 버튼 글자·아이콘
//  · 일시정지 창(#pause): 지금 캐릭터 그림 + 버튼 아이콘
//  창 틀·리본·버튼 모양과 줄 세우기는 common/popup.css · popup.js (모든 팝업 같음)
(function () {
  const BASE = ((document.currentScript && document.currentScript.src) || '').replace(/common\/gamepop\.js.*$/, '');
  const IMG = BASE + 'common/ui/popup/';
  const HUB = window.Hub;
  const $ = (id) => document.getElementById(id);
  const game = (location.pathname.match(/\/([a-z]+)\/(index\.html)?$/) || [])[1];
  const ENDLESS = ['downhill', 'bakery', 'stairs', 'helicopter', 'dogsnack'];
  // 무제한형 시작 아이템 3개 (하트·보호막·슬로우). 하트 그림은 하트 통일 규칙대로 common/ui/heart.webp
  const ITEMS = { life: ['하트', BASE + 'common/ui/heart.webp'], shield: ['보호막', BASE + 'common/items/shield.webp'], slow: ['슬로우', BASE + 'common/items/slow.webp'] };
  const START_ITEMS = ['life', 'shield', 'slow'];
  // 스테이지형 게임의 시작 팝업 아이템 칸 (힌트·시간 추가·폭탄·모두 보기는 게임 화면 버튼으로 꺼내 씀, 하트는 시작할 때 체크)
  const STAGE = { shisen: ['hint', 'time', 'bomb'], memory: ['hint', 'time', 'bomb', 'find'], mole: ['life'] };
  const ITEM_NAME = { life: '하트', shield: '보호막', slow: '슬로우', hint: '힌트', time: '시간 추가', bomb: '폭탄', find: '모두 보기' };
  const itemSrc = (id) => (id === 'life' ? BASE + 'common/ui/heart.webp' : `${BASE}common/items/${id}.webp`);
  // 버튼 앞 흰 아이콘 (A09)
  const ICO = { btnRetry: 'retry', btnRetryP: 'retry', btnHomeR: 'home', btnHomeP: 'games', btnResume: 'play', btnMapR: 'map', btnMapP: 'map', btnNext: 'next', gpGo: 'play', gpFrom: 'next', btnGo: 'play', btnReadyHome: 'home' };
  const LABEL = { btnHomeR: '메인으로', btnRetry: '다시하기', btnResume: '계속하기', btnRetryP: '다시하기', btnHomeP: '게임 선택', btnMapR: '지도 보기', btnMapP: '지도 보기', btnNext: '다음 스테이지' };
  if (STAGE[game]) { LABEL.btnGo = '시작하기'; LABEL.btnReadyHome = '메인으로'; }

  // 지금 캐릭터 계열 (은유 계열 / 은결 계열)
  const who = () => {
    const c = HUB && HUB.active(); if (!c) return 'eunyu';
    const l = (window.CHAR_LOOKS || []).find((x) => x.look === c.look);
    return String(l ? l.base : c.look).startsWith('eungyeol') ? 'eungyeol' : 'eunyu';
  };
  const charImg = (mood) => `${IMG}chars/${who()}_${mood}.webp`;
  const scene = (mood, over = '') => `<div class="gp-scene"><img class="gp-char" src="${charImg(mood)}" alt="">${over}</div>`;
  const blip = (f) => { if (window.UI && UI.blip) UI.blip(f); };
  for (const m of ['start', 'great', 'sad']) new Image().src = charImg(m);

  const css = document.createElement('style');
  css.textContent = `
.gp-scene{position:relative;flex:none;width:100%;aspect-ratio:2/1;max-height:30vh;border-radius:18px;overflow:hidden;background:url(${IMG}scene.webp) center/cover no-repeat;box-shadow:inset 0 0 0 3px rgba(255,255,255,.7)}
.gp-char{position:absolute;left:50%;bottom:0;height:100%;transform:translateX(-50%);filter:drop-shadow(0 4px 6px rgba(0,0,0,.2))}
.gp-title{position:absolute;left:50%;top:6%;width:72%;transform:translateX(-50%);filter:drop-shadow(0 3px 4px rgba(0,0,0,.25));animation:gpPop .5s ease-out}
@keyframes gpPop{0%{transform:translateX(-50%) scale(.3);opacity:0}70%{transform:translateX(-50%) scale(1.08)}100%{transform:translateX(-50%) scale(1);opacity:1}}
.gp-x{position:absolute;right:calc(48px * var(--pp-k, .7333) - 14px);top:4px;width:46px;height:46px;border:0;padding:0;background:url(${IMG}btn_close.webp) center/contain no-repeat;filter:drop-shadow(0 2px 3px rgba(0,0,0,.25));cursor:pointer;z-index:2}
.gp-x:active{transform:scale(.92)}
.gp-items{display:flex;gap:12px;width:100%;justify-content:center;flex:none}
.gp-slot{position:relative;flex:0 1 104px;aspect-ratio:1;border:0;padding:0;background:url(${IMG}slot.webp) center/100% 100% no-repeat;cursor:pointer;font-family:Jua,system-ui,sans-serif;color:#6B4A30}
.gp-slot.on{background-image:url(${IMG}slot_on.webp)}
.gp-slot img.ic{position:absolute;left:50%;top:44%;width:52%;height:52%;object-fit:contain;transform:translate(-50%,-50%)}
.gp-slot .nm{position:absolute;left:0;right:0;bottom:7%;font-size:15px;text-align:center}
.gp-slot .n{position:absolute;right:-6px;bottom:-8px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:url(${IMG}badge.webp) center/contain no-repeat;color:#fff;font-size:15px}
.gp-slot.none{filter:saturate(.35)}.gp-slot.none .n{display:none}
.gp-slot .buy{position:absolute;left:50%;bottom:-11px;transform:translateX(-50%);display:flex;align-items:center;gap:2px;background:#FFF4D2;border:2px solid #F5C860;border-radius:12px;padding:0 6px;font-size:13px;color:#6A3A00;white-space:nowrap;filter:none}
.gp-slot .buy img{width:14px;height:14px}
.gp-slot.off{opacity:.45;pointer-events:none}.gp-slot.off .buy{display:none}
.gp-tip{font-size:14px;color:#8A6E58;text-align:center;flex:none}
.gp-ask{z-index:60}.gp-ask > .panel{min-height:0!important}
.gp-buy{display:flex;align-items:center;gap:12px;flex:none;font-size:18px;line-height:1.5;color:#5A3B22}
.gp-buy-ic{width:72px;height:72px;object-fit:contain}.gp-coin{width:20px;height:20px;vertical-align:-4px;margin-right:2px}
#result .res-face, #result #resFace, #result #resBest.badge{display:none!important}
#ready > .panel > .logo{display:none!important}
#ready .gp-info{flex:none;width:100%;box-sizing:border-box;border-radius:18px;background:#FFF3DE;border:3px solid #F5D9A8;padding:10px 12px;font-size:14px;line-height:1.45;color:#6B4A30;text-align:center}
#ready .gp-info .p-text{margin:0 0 6px}
#ready .gp-items{margin-top:2px}
#result .r-stars{display:flex;justify-content:center;gap:6px;margin:0;flex:none}
#result .r-stars span{display:block;width:46px;height:44px;font-size:0;color:transparent;background:url(${IMG}star_on.webp) center/contain no-repeat;text-shadow:none!important}
#result .r-stars span:nth-child(2){width:56px;height:53px;margin-top:-8px}
#result .r-stars span.off{background-image:url(${IMG}star_off.webp)}
#result .panel.fail .r-stars{display:none}
.pp-acts .pp-pair > button.pp-adb{--h:58px;flex:1 1 0}
.gp-tap{position:absolute;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(24,40,62,.35);font-family:Jua,system-ui,sans-serif;font-size:30px;color:#fff;text-shadow:0 3px 0 #C2406A,0 0 6px rgba(0,0,0,.4);animation:gpBlink 1.2s ease-in-out infinite;cursor:pointer}
@keyframes gpBlink{50%{opacity:.75}}
`;
  document.head.appendChild(css);

  // 버튼 아이콘·글자 (게임 코드가 글자를 바꿔 아이콘이 지워지면 다시 붙임)
  function dress(b) {
    if (!b) return;
    if (LABEL[b.id] && b.textContent.trim() !== LABEL[b.id] && !b.dataset.gpKeep) b.textContent = LABEL[b.id];
    const ic = ICO[b.id];
    if (ic && !b.querySelector('i.gp-ico')) { const i = document.createElement('i'); i.className = 'gp-ico'; i.style.backgroundImage = `url(${IMG}ico_${ic}.webp)`; b.prepend(i); }
  }
  const dressAll = () => Object.keys(ICO).forEach((id) => dress($(id)));

  // ---------- 시작 팝업 ----------
  // from: 'XX판부터 시작' 판 번호 (2 이상일 때만 버튼이 보임). onStart(lv): lv = 1 또는 from
  function start(o) {
    const g = o.game || game, K = (HUB && HUB.BOOSTS[g]) || [];
    // 고르기 전에는 아무것도 '사용중'이 아니게 (팝업 뒤에서 게임이 미리 판을 깔 때 아이템이 쓰이지 않게)
    if (HUB) for (const id of START_ITEMS) if (HUB.isUsing(g, id)) HUB.setUsing(g, id, false);
    const pick = new Set(o.keep || []);
    close();
    const root = $('root') || document.body;
    const wrap = document.createElement('div'); wrap.id = 'gpStart'; wrap.className = 'screen dim gp-start';
    const name = (HUB && HUB.GAMES[g] && HUB.GAMES[g].name) || '';
    wrap.innerHTML = `<div class="panel"><div class="p-title">${name}</div><button class="gp-x" aria-label="닫기"></button>${scene('start')}
      <div class="gp-items"></div><div class="gp-tip">아이템을 누르면 이번 판에 써요</div>
      <button id="gpGo" class="btn">시작하기</button>${o.from > 1 ? `<button id="gpFrom" class="btn">${o.from}판부터 시작</button>` : ''}</div>`;
    root.appendChild(wrap);
    const box = wrap.querySelector('.gp-items');
    const draw = () => {
      box.innerHTML = '';
      for (const id of START_ITEMS) {
        const def = K.find((x) => x.id === id), n = HUB ? HUB.boostCount(g, id) : 0, [nm, src] = ITEMS[id];
        const b = document.createElement('button');
        b.className = 'gp-slot' + (pick.has(id) ? ' on' : '') + (n > 0 ? '' : ' none') + (def ? '' : ' off');
        b.innerHTML = `<img class="ic" src="${src}" alt=""><span class="nm">${def ? nm : '준비 중'}</span><span class="n">${n}</span>`
          + (def && n <= 0 ? `<span class="buy"><img src="${BASE}common/ui/coin.webp" alt="">${def.price}</span>` : '');
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          if (n > 0) { blip(pick.has(id) ? 500 : 900); pick.has(id) ? pick.delete(id) : pick.add(id); draw(); return; }
          buy(g, id, def, () => { pick.add(id); draw(); });
        });
        box.appendChild(b);
      }
    };
    draw();
    const go = (lv) => {
      if (HUB) for (const id of START_ITEMS) if (K.find((x) => x.id === id)) HUB.setUsing(g, id, pick.has(id) && HUB.boostCount(g, id) > 0);
      close(); o.onStart(lv);
      if (HUB) for (const id of START_ITEMS) if (HUB.isUsing(g, id)) HUB.setUsing(g, id, false); // 쓰고 나면 다음 판엔 다시 고름
    };
    $('gpGo').addEventListener('click', (e) => { e.stopPropagation(); blip(1046); go(1); });
    if ($('gpFrom')) $('gpFrom').addEventListener('click', (e) => { e.stopPropagation(); blip(1046); go(o.from); });
    wrap.querySelector('.gp-x').addEventListener('click', (e) => { e.stopPropagation(); blip(500); close(); if (o.onClose) o.onClose(); });
    for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'keydown']) wrap.addEventListener(ev, (e) => e.stopPropagation());
    const panel = wrap.querySelector('.panel');
    if (window.PopupUI) { PopupUI.arrange(panel); dressAll(); requestAnimationFrame(() => PopupUI.fit(panel)); }
    return wrap;
  }
  function close() { const w = $('gpStart'); if (w) w.remove(); }
  // 안 가진 아이템: 코인으로 사기 (아이템샵과 같은 값)
  function buy(g, id, def, done) {
    if (!HUB || !def) return;
    const c = HUB.active(), name = ITEMS[id][0];
    if (!c || c.coins < def.price) { blip(300); toast(`코인이 ${def.price - ((c && c.coins) || 0)}개 모자라요`); return; }
    ask('아이템 구매', `<img class="gp-buy-ic" src="${itemSrc(id)}" alt=""><div class="gp-buy-t"><b>${name}</b> 1개를 살까요?<br><img src="${BASE}common/ui/coin.webp" alt="" class="gp-coin">${def.price} 코인 (지금 ${c.coins})</div>`, '사기', () => {
      const r = HUB.buyBoost(g, id);
      if (r.ok) { blip(1046); HUB.setUsing(g, id, false); toast(`${name}을(를) 샀어요!`); done(); }
    });
  }
  // 게임 팝업 모양의 확인 창: [확인][취소]
  function ask(title, html, okText, onOk) {
    const w = document.createElement('div'); w.className = 'screen dim gp-ask';
    w.innerHTML = `<div class="panel"><div class="p-title">${title}</div><div class="gp-buy">${html}</div><button class="btn gp-ok">${okText}</button><button class="btn gp-no" data-close>취소</button></div>`;
    ($('root') || document.body).appendChild(w);
    for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'keydown']) w.addEventListener(ev, (e) => e.stopPropagation());
    w.querySelector('.gp-ok').addEventListener('click', (e) => { e.stopPropagation(); w.remove(); onOk(); });
    w.querySelector('.gp-no').addEventListener('click', (e) => { e.stopPropagation(); blip(500); w.remove(); });
    const panel = w.querySelector('.panel');
    if (window.PopupUI) { PopupUI.arrange(panel); requestAnimationFrame(() => PopupUI.fit(panel)); }
  }
  function toast(t) {
    if (window.UI && UI.toast) { UI.toast(t); return; }
    const el = $('toast'); if (el) { el.textContent = t; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 1600); }
  }

  // ---------- 결과 창: 캐릭터 표정 ----------
  let last = null; // 마지막 Hub.record 결과 (최고 기록인지)
  if (HUB) {
    const rec0 = HUB.record.bind(HUB);
    HUB.record = function (g, r) { const res = rec0(g, r); last = { g, r, res }; return res; };
  }
  function decorateResult() {
    const panel = document.querySelector('#result:not(.hidden) .panel');
    if (!panel) return;
    if (STAGE[game]) { decorateStageResult(); return; }
    if (!ENDLESS.includes(game)) return;
    const best = !!(last && last.res && last.res.newBest);
    const key = best ? 'great' : 'sad';
    let sc = panel.querySelector(':scope > .gp-scene');
    if (!sc || sc.dataset.mood !== key) {
      if (sc) sc.remove();
      const t = panel.querySelector(':scope > .p-title, :scope > .title, :scope > .r-title');
      if (t) t.textContent = best ? '최고 기록!' : '게임 끝';
      const d = document.createElement('div'); d.innerHTML = scene(key, best ? `<img class="gp-title" src="${IMG}title_best.webp" alt="NEW BEST!">` : '');
      sc = d.firstChild; sc.dataset.mood = key;
      if (t) t.after(sc); else panel.prepend(sc);
    }
  }
  // ---------- 스테이지형 시작 팝업 (#ready 를 새 배치로) ----------
  //  [판 이름 리본] [X = 지도 보기] / 지금 캐릭터 신난 그림 (두더지: 두더지 설명) / 판 정보 / 아이템 칸 / [시작하기] [메인으로]
  function stageReady() {
    const panel = document.querySelector('#ready > .panel'); if (!panel || panel.dataset.gp) return;
    panel.dataset.gp = '1';
    const t = $('readyTitle'); if (t) panel.prepend(t);
    const x = document.createElement('button'); x.className = 'gp-x'; x.setAttribute('aria-label', '지도 보기');
    x.addEventListener('click', (e) => { e.stopPropagation(); blip(500); if ($('btnReadyMap')) $('btnReadyMap').click(); });
    panel.appendChild(x);
    const txt = panel.querySelector(':scope > .p-text'), leg = $('legend');
    const box = document.createElement('div');
    if (game === 'mole') { box.className = 'gp-info'; if (txt) box.appendChild(txt); if (leg) box.appendChild(leg); }
    else { box.innerHTML = scene('start'); if (txt) txt.remove(); }
    (t || panel.firstChild).after(box.firstChild && game !== 'mole' ? box.firstChild : box);
    const items = document.createElement('div'); items.className = 'gp-items'; items.id = 'gpStageItems';
    const row = panel.querySelector(':scope > .row') || $('btnGo');
    panel.insertBefore(items, row);
    drawStageItems();
    // 시작할 때 체크한 하트는 이번 판에만 (게임이 Hub.takeBoosts 로 꺼낸 뒤 체크를 풀어 둠)
    const go = $('btnGo'); if (go) go.addEventListener('click', () => setTimeout(() => { if (HUB) for (const id of STAGE[game]) if (id === 'life' && HUB.isUsing(game, id)) HUB.setUsing(game, id, false); }, 0));
  }
  function drawStageItems() {
    const box = $('gpStageItems'); if (!box) return;
    const K = (HUB && HUB.BOOSTS[game]) || [];
    box.innerHTML = '';
    for (const id of STAGE[game]) {
      const def = K.find((x) => x.id === id), n = HUB ? HUB.boostCount(game, id) : 0, start = id === 'life', on = start && HUB && HUB.isUsing(game, id);
      const b = document.createElement('button');
      b.className = 'gp-slot' + (on ? ' on' : '') + (n > 0 ? '' : ' none') + (def ? '' : ' off');
      b.innerHTML = `<img class="ic" src="${itemSrc(id)}" alt=""><span class="nm">${def ? ITEM_NAME[id] : '준비 중'}</span><span class="n">${n}</span>`
        + (def && n <= 0 ? `<span class="buy"><img src="${BASE}common/ui/coin.webp" alt="">${def.price}</span>` : '');
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (start && n > 0) { blip(on ? 500 : 900); HUB.setUsing(game, id, !on); drawStageItems(); return; }
        if (n > 0) { toast(`${ITEM_NAME[id]}: 게임 화면의 버튼으로 써요`); return; }
        buy(game, id, def, () => { if (start) HUB.setUsing(game, id, true); drawStageItems(); });
      });
      box.appendChild(b);
    }
  }
  // ---------- 스테이지형 결과 창: CLEAR!/FAIL, 별 수에 따라 표정, 실패면 '다음 스테이지' 자리에 '광고 보고 이어하기' ----------
  function decorateStageResult() {
    const panel = document.querySelector('#result:not(.hidden) .panel'); if (!panel) return;
    const ok = !panel.classList.contains('fail');
    const st = ok ? [...panel.querySelectorAll('.r-stars span')].filter((x) => !x.classList.contains('off')).length : 0;
    const key = !ok ? 'sad' : st >= 3 ? 'great' : st === 2 ? 'good' : 'smile';
    let sc = panel.querySelector(':scope > .gp-scene');
    if (!sc || sc.dataset.mood !== key) {
      if (sc) sc.remove();
      const d = document.createElement('div');
      d.innerHTML = scene(key, `<img class="gp-title" src="${IMG}title_${ok ? 'clear' : 'fail'}.webp" alt="${ok ? 'CLEAR!' : 'FAIL'}">`);
      sc = d.firstChild; sc.dataset.mood = key;
      const after = panel.querySelector(':scope > .r-stars') || panel.querySelector(':scope > .r-title');
      after.after(sc);
    }
    // 이어하기 광고 버튼을 '다음 스테이지' 자리로 (common/monet.js 가 광고 줄에 넣은 것을 옮김)
    const next = $('btnNext'), retry = $('btnRetry');
    panel.querySelectorAll('.pp-pair > .pp-adb.cont').forEach((b) => { if (ok) b.remove(); });
    const cont = panel.querySelector('.pp-ad > .pp-adb.cont');
    if (cont && !ok && retry && retry.parentElement) retry.after(cont);
  }
  // 이어하기 뒤: 화면을 한 번 터치하면 다시 움직임
  function tapToGo(fn) {
    const el = document.createElement('div'); el.className = 'gp-tap'; el.textContent = '터치하면 다시 시작!';
    ($('root') || document.body).appendChild(el);
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); el.remove(); fn(); }, { once: true });
  }
  function decoratePause() {
    const panel = document.querySelector('#pause:not(.hidden) .panel');
    if (!panel || panel.querySelector(':scope > .gp-scene')) return;
    const t = panel.querySelector(':scope > .p-title'); if (t) t.textContent = '일시정지';
    const d = document.createElement('div'); d.innerHTML = scene('start');
    if (t) t.after(d.firstChild); else panel.prepend(d.firstChild);
  }

  function boot() {
    dressAll();
    if (STAGE[game]) stageReady();
    const obs = new MutationObserver(() => { decorateResult(); decoratePause(); dressAll(); });
    for (const id of ['result', 'pause']) if ($(id)) obs.observe($(id), { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
    if (STAGE[game] && $('ready')) new MutationObserver(() => { if (!$('ready').classList.contains('hidden')) drawStageItems(); }).observe($('ready'), { attributes: true, attributeFilter: ['class'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.GamePop = { start, close, tapToGo, ENDLESS, STAGE, charImg };
})();
