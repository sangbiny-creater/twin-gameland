'use strict';
// 그림 위 글자 크기 자동 맞춤 (모든 화면 공통, common/i18n.js 다음에 읽음)
//  버튼·리본·탭·이름표 그림의 "글자 칸"(CSS 의 padding = 그림 속 글자 칸, tools/text_probe.js 의 FACES 로 잰 값) 안에
//  글자가 다 들어가지 않으면 글자만 조금씩 줄임 — 칸 밖으로 나가거나 … 로 잘리지 않게 (영어가 긴 경우가 많음)
//  글자가 바뀌거나(언어·숫자) 창이 열리거나 화면 크기가 바뀌면 다시 맞춤. 팝업 제목·버튼은 common/popup.js 도 같은 방식으로 맞춤
(function () {
  if (window.TextFit) return;
  // [선택자, 가장 작은 글자 크기(px), (두 줄 허용: 한 줄로 이 크기보다 작아지면 두 줄로 나눔)]
  const LIST = [
    ['.mn-panel h3', 12], ['.mn-btn', 10], ['.mn-art-c .mn-btn', 10], ['.mn-lock small', 7], ['.mn-pack.offer b', 10],
    ['.au-h', 14], ['.au-b', 12],
    ['.sel-ask b', 14], ['.sel-name', 11], ['.sel-lang', 11], ['.wtitle > span', 11], ['.w4name > span', 11], ['.mb3-pill b', 10],
    ['.map-mode button', 11],
    ['.sh-tabs button span', 9], ['.bcard .bn', 9], ['.sc-t', 9, 12], ['.sc-pill', 8],
    ['#hud .hp', 11], ['#hud .total.hp-board', 12],
    ['.rk-seg button', 10], ['.tb', 11],
    ['.gp-slot .n', 9]
  ];
  const SEL = LIST.map((x) => x[0]).join(',');
  const vis = (el) => el.checkVisibility ? el.checkVisibility() : !!el.offsetParent;
  const over = (el) => el.scrollWidth > el.clientWidth + 0.5 || (el.clientHeight && el.scrollHeight > el.clientHeight + 1);
  function fitEl(el, min, wrap) {
    el.style.removeProperty('font-size'); el.style.removeProperty('white-space'); el.style.removeProperty('line-height');
    if (!el.clientWidth || !over(el)) return;
    const fs0 = parseFloat(getComputedStyle(el).fontSize); let fs = fs0, n = 0;
    while (over(el) && fs > (wrap || min) && n++ < 40) { fs -= 0.5; el.style.setProperty('font-size', fs + 'px', 'important'); }
    if (wrap && over(el)) { // 한 줄로는 너무 작아지면 두 줄 (줄 사이 좁게)
      el.style.setProperty('white-space', 'normal', 'important'); el.style.setProperty('line-height', '1.05', 'important'); fs = fs0; n = 0;
      el.style.setProperty('font-size', fs + 'px', 'important');
      while (over(el) && fs > min && n++ < 40) { fs -= 0.5; el.style.setProperty('font-size', fs + 'px', 'important'); }
    }
  }
  function fitAll(root = document) {
    for (const [s, min, wrap] of LIST) for (const el of root.querySelectorAll(s)) if (vis(el)) fitEl(el, min, wrap);
  }
  const OPT = (el) => { let o = [10]; for (const [s, m, w] of LIST) if (el.matches(s)) o = [m, w]; return o; };
  // 바뀐 곳 둘레만 다시 맞춤 (게임 중 점수·시간 글자가 자주 바뀌어도 가볍게)
  let queued = false; const dirty = new Set();
  const later = (el) => { if (el) dirty.add(el); else dirty.add(document); if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false; const all = [...dirty]; dirty.clear();
      if (all.includes(document)) { fitAll(); return; }
      const set = new Set(); for (const t of all) { if (!t.isConnected) continue; const c = t.closest(SEL); if (c) set.add(c); t.querySelectorAll(SEL).forEach((e) => set.add(e)); }
      for (const el of set) if (vis(el)) fitEl(el, ...OPT(el)); }); };
  window.TextFit = { fitAll, fitEl, later };
  function start() {
    fitAll();
    // 글자·class 가 바뀌면 다시 (style 은 보지 않음: 우리가 바꾸는 글자 크기 때문에 끝없이 돌지 않게)
    new MutationObserver((ms) => { for (const m of ms) { const t = m.target.nodeType === 3 ? m.target.parentElement : m.target; if (!t || !t.closest) continue; if (m.type !== 'attributes' || t.matches(SEL) || t.querySelector(SEL)) later(t); } })
      .observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    window.addEventListener('resize', () => setTimeout(() => fitAll(), 80));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitAll());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
