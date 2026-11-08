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
  //  게임 화면 아래 아이템 버튼과 같은 순서·같은 그림 (2026-11-04). 처음엔 아무것도 안 고른 상태, 고르면 그 판에 1개 (판이 시작되면 쓴 것)
  const STAGE = { shisen: ['hint', 'time', 'shuffle', 'bomb'], memory: ['hint', 'time', 'find', 'bomb'], mole: ['life'], giftsort: ['hint'] };
  const ITEM_NAME = { life: '하트', shield: '보호막', slow: '슬로우', hint: '힌트', time: '시간 추가', shuffle: '섞기', bomb: '폭탄', find: '모두 보기' };
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
  for (const m of ['best', 'clear', 'end', 'sad']) new Image().src = charImg(m); // 결과 창 캐릭터 (tools/adult2_assets.py)

  const css = document.createElement('style');
  css.textContent = `
.gp-items{display:flex;gap:12px;width:100%;justify-content:center;flex:none}
.gp-slot{position:relative;flex:1 1 0;max-width:124px;min-width:0;min-height:118px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:2px solid var(--who-bg);border-radius:18px;padding:8px 3px;background:#fff;box-shadow:0 3px 8px rgba(120,80,100,.14);cursor:pointer;font-family:Jua,system-ui,sans-serif;color:#6B4A30}
.gp-slot.on{border-color:var(--who);box-shadow:0 0 0 2px var(--who)}
.gp-slot img.ic{flex:none;width:54px;height:50px;object-fit:contain}
.gp-slot .nm{font-size:15px;line-height:1;text-align:center;white-space:nowrap}
.gp-slot .n{position:absolute;right:4px;top:4px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;background:url(${IMG}badge.webp) center/contain no-repeat;color:#fff;font-size:15px}
.gp-slot.none{filter:saturate(.35)}.gp-slot.none .n{display:none}
.gp-slot .buy{display:flex;align-items:center;gap:2px;background:#FFF4D2;border:2px solid #F5C860;border-radius:12px;padding:0 6px;font-size:13px;color:#6A3A00;white-space:nowrap;filter:none}
.gp-slot .buy img{width:14px;height:14px}
.gp-slot.off{opacity:.45;pointer-events:none}.gp-slot.off .buy{display:none}
.gp-tip{font-size:14px;color:#8A6E58;text-align:center;flex:none}
html[lang=en] .gp-slot .nm{font-size:15px;line-height:1;text-align:center;white-space:nowrap}
html[lang=en] .pp-acts button.pp-b{padding-left:14px!important;padding-right:14px!important}
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
    // (영어판: 글자는 common/i18n.js 가 바꿈 → 바뀐 글자와 비교해야 서로 되돌리기를 반복하지 않음)
    const label = LABEL[b.id] && (window.I18N && I18N.tr ? I18N.tr(LABEL[b.id]) : LABEL[b.id]);
    if (label && b.textContent.trim() !== label && !b.dataset.gpKeep) b.textContent = LABEL[b.id];
    const ic = ICO[b.id];
    if (ic && !b.querySelector('i.gp-ico')) { const i = document.createElement('i'); i.className = 'gp-ico'; i.style.setProperty('--ico', `url(${IMG}ico_${ic}.webp)`); b.prepend(i); }
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
    wrap.innerHTML = `<div class="panel"><div class="p-title">${name}</div><button class="gp-x" aria-label="닫기"></button>
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
  // 안 가진 아이템: 코인으로 구매 (아이템샵과 같은 값)
  function buy(g, id, def, done) {
    if (!HUB || !def) return;
    const c = HUB.active(), name = ITEMS[id][0];
    if (!c || c.coins < def.price) {
      blip(300);
      ask('아이템 구매', `<img class="gp-buy-ic" src="${itemSrc(id)}" alt=""><div class="gp-buy-t"><b>${name}</b> ${def.price} 코인<br>코인이 <b>${def.price - ((c && c.coins) || 0)}개</b> 모자라요.<br>게임을 해서 코인을 모아요!</div>`, '확인', () => {});
      return;
    }
    ask('아이템 구매', `<img class="gp-buy-ic" src="${itemSrc(id)}" alt=""><div class="gp-buy-t"><b>${name}</b> 1개를 살까요?<br><img src="${BASE}common/ui/coin.webp" alt="" class="gp-coin">${def.price} 코인 (지금 ${c.coins})</div>`, '구매', () => {
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
    const key = best ? 'best' : 'end';
    let sc = panel.querySelector(':scope > .gp-scene');
    if (!sc || sc.dataset.mood !== key) {
      if (sc) sc.remove();
      const t = panel.querySelector(':scope > .p-title, :scope > .title, :scope > .r-title');
      if (t) t.textContent = best ? '최고 기록 달성!' : '게임 끝';
      const old = panel.querySelector(':scope > .gp-new'); if (old) old.remove();
      const d = document.createElement('div'); d.innerHTML = scene(key);
      sc = d.firstChild; sc.dataset.mood = key;
      if (t) t.after(sc); else panel.prepend(sc);
      if (best) { const n = document.createElement('span'); n.className = 'gp-new'; n.textContent = 'NEW BEST!'; sc.before(n); }
    }
  }
  // ---------- 스테이지형 시작 팝업 (#ready 를 새 배치로) ----------
  //  [판 이름 리본] [X = 지도 보기] / 지금 캐릭터 신난 그림 (두더지: 두더지 설명) / 판 정보 / 아이템 칸 / [시작하기] (한 줄 가득)
  function stageReady() {
    const panel = document.querySelector('#ready > .panel'); if (!panel || panel.dataset.gp) return;
    panel.dataset.gp = '1';
    // 시작 팝업 버튼은 '시작하기' 하나만 (무제한형과 같게). 지도로 가기는 오른쪽 위 X, 첫 화면은 지도의 뒤로 버튼
    const home = $('btnReadyHome'); if (home) { home.classList.add('hidden'); home.setAttribute('aria-hidden', 'true'); }
    const t = $('readyTitle'); if (t) panel.prepend(t);
    const x = document.createElement('button'); x.className = 'gp-x'; x.setAttribute('aria-label', '지도 보기');
    x.addEventListener('click', (e) => { e.stopPropagation(); blip(500); if ($('btnReadyMap')) $('btnReadyMap').click(); });
    panel.appendChild(x);
    const txt = panel.querySelector(':scope > .p-text'), leg = $('legend');
    const box = document.createElement('div');
    if (game === 'mole') { box.className = 'gp-info'; if (txt) box.appendChild(txt); if (leg) box.appendChild(leg); }
    else if (txt) txt.remove();
    if (game === 'mole') (t || panel.firstChild).after(box);
    const items = document.createElement('div'); items.className = 'gp-items'; items.id = 'gpStageItems';
    const row = panel.querySelector(':scope > .row') || $('btnGo');
    panel.insertBefore(items, row);
    drawStageItems();
    // 시작할 때 체크한 것은 이번 판에만 (게임이 startStage 에서 꺼낸 뒤 체크를 풀어 둠)
    const go = $('btnGo'); if (go) go.addEventListener('click', () => setTimeout(clearStageSel, 0));
  }
  const clearStageSel = () => { if (HUB) for (const id of STAGE[game] || []) if (HUB.isUsing(game, id)) HUB.setUsing(game, id, false); };
  function drawStageItems() {
    const box = $('gpStageItems'); if (!box) return;
    const K = (HUB && HUB.BOOSTS[game]) || [];
    box.innerHTML = '';
    for (const id of STAGE[game]) {
      const def = K.find((x) => x.id === id), n = HUB ? HUB.boostCount(game, id) : 0, on = !!(HUB && HUB.isUsing(game, id));
      const b = document.createElement('button');
      b.className = 'gp-slot' + (on ? ' on' : '') + (n > 0 ? '' : ' none') + (def ? '' : ' off');
      b.innerHTML = `<img class="ic" src="${itemSrc(id)}" alt=""><span class="nm">${def ? ITEM_NAME[id] : '준비 중'}</span><span class="n">${n}</span>`
        + (def && n <= 0 ? `<span class="buy"><img src="${BASE}common/ui/coin.webp" alt="">${def.price}</span>` : '');
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        // 가진 것: 눌러서 이번 판에 쓸지 체크 / 체크 풀기. 안 가진 것: 사면 바로 체크
        if (n > 0) { blip(on ? 500 : 900); HUB.setUsing(game, id, !on); drawStageItems(); return; }
        buy(game, id, def, () => { HUB.setUsing(game, id, true); drawStageItems(); });
      });
      box.appendChild(b);
    }
  }
  // ---------- 스테이지형 결과 창: CLEAR!/FAIL, 별 수에 따라 표정, 실패면 '다음 스테이지' 자리에 '광고 보고 이어하기' ----------
  function decorateStageResult() {
    const panel = document.querySelector('#result:not(.hidden) .panel'); if (!panel) return;
    const ok = !panel.classList.contains('fail');
    const st = ok ? [...panel.querySelectorAll('.r-stars span')].filter((x) => !x.classList.contains('off')).length : 0;
    const key = ok ? 'clear' : 'sad';
    let sc = panel.querySelector(':scope > .gp-scene');
    if (!sc || sc.dataset.mood !== key) {
      if (sc) sc.remove();
      const d = document.createElement('div');
      d.innerHTML = scene(key);
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
  // (글자를 쓰면 아래 감시자가 또 불리므로, 이미 같은 글자면 건드리지 않음 — 안 그러면 끝없이 돌아 화면이 얼어붙음)
  function decoratePause() {
    const t = document.querySelector('#pause:not(.hidden) .panel > .p-title'); if (!t) return;
    const label = window.I18N && I18N.tr ? I18N.tr('일시정지') : '일시정지';
    if (t.textContent.trim() !== label) t.textContent = '일시정지';
  }

  function boot() {
    dressAll();
    if (STAGE[game]) { clearStageSel(); stageReady(); }
    // 시작 팝업이 열릴 때마다 아무것도 안 고른 상태로
    const rd = $('ready');
    if (rd && STAGE[game]) new MutationObserver(() => { if (!rd.classList.contains('hidden')) { clearStageSel(); drawStageItems(); } }).observe(rd, { attributes: true, attributeFilter: ['class'] });
    const obs = new MutationObserver(() => { decorateResult(); decoratePause(); dressAll(); });
    for (const id of ['result', 'pause']) if ($(id)) obs.observe($(id), { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.GamePop = { start, close, tapToGo, ENDLESS, STAGE, charImg };
})();
