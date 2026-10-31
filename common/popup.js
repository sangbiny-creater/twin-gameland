'use strict';
// 모든 팝업의 버튼을 같은 규칙으로 줄 세움 (모양은 common/popup.css)
//  ① 광고 줄(common/monet.js 가 채움) ② 큰 버튼 한 줄 가득(다음 스테이지·계속하기) ③ 같은 폭 두 버튼 나란히
//  버튼은 그대로 옮기기만 해서 게임 코드의 버튼 기능(id·누르기)은 바뀌지 않음
(function () {
  const MAIN = ['btnNext', 'btnResume', 'btnFromLv'];                   // ② 큰 버튼
  const BACK = /^(btnHome|btnMap|btnReadyMap|btnReadyHome|btnChooseBack|btnFromStart)/; // 파란 버튼 (나가기·뒤로)
  // 버튼 색 약속 (docs/spec/팝업_아이템_정리_v1.md): 민트 = 메인으로·게임 선택 / 보라 = 지도 보기 / 파랑 = 다음 스테이지·XX판부터 / 나머지 분홍
  const COLOR = { btnHomeR: 'mint', btnHomeP: 'mint', btnReadyHome: 'mint', btnMapR: 'purple', btnMapP: 'purple', btnReadyMap: 'purple', btnNext: 'blue', btnFromLv: 'blue' };
  const paint = (b) => { const c = COLOR[b.id] || (isBack(b) ? 'blue' : ''); for (const k of ['blue', 'mint', 'purple']) b.classList.toggle(k, k === c); };
  const ACTION = /(^|\s)(btn|btn-start|btn-sub|btn-main|btn-orange|btn-blue|btn-gray|mbtn|rb)(\s|$)/;
  const PANELS = '.screen.dim > .panel, #ready > .panel, .modal > .panel, .modal > .mpanel';
  // 파란(나가기·뒤로) 버튼: 게임 버튼은 id 로만 정함 (다시하기·출발·계속은 분홍), 그 밖의 창은 닫기·취소
  const isBack = (b) => (/^btn[A-Z]/.test(b.id) ? BACK.test(b.id) : b.hasAttribute('data-close') || /닫기|취소/.test(b.textContent) || /(^|\s)(gray|mbtn gray)(\s|$)/.test(b.className));

  function arrange(panel) {
    if (panel.querySelector(':scope > .pp-acts')) return;
    const btns = [...panel.querySelectorAll('button')].filter((b) => (ACTION.test(b.className) || b.id === 'btnChooseBack') && !b.closest('.pp-acts'));
    if (!btns.length) return;
    const acts = document.createElement('div'); acts.className = 'pp-acts';
    acts.innerHTML = '<div class="pp-row pp-ad"></div><div class="pp-row pp-main"></div>';
    const parents = new Set(btns.map((b) => b.parentElement));
    // 팝업 v2 스테이지 게임(사천성·메모리·두더지) 결과 창은 [다시하기][다음 스테이지] / [메인으로][지도 보기] 두 줄 (큰 버튼 줄 없음)
    const v2 = /\/(shisen|memory|mole)\//.test(location.pathname);
    let main = btns.find((b) => MAIN.includes(b.id) && !(v2 && b.id === 'btnNext'));
    const rest = btns.filter((b) => b !== main);
    if (!main && rest.length === 1) main = rest.pop(); // 버튼이 하나뿐이면 한 줄 가득
    const put = (b, row) => { b.classList.add('pp-b'); paint(b); row.appendChild(b); b._ppRow = row; b._ppAt = row.children.length - 1; };
    if (main) put(main, acts.querySelector('.pp-main'));
    for (let i = 0; i < rest.length; i += 2) {
      const row = document.createElement('div'); row.className = 'pp-row pp-pair'; acts.appendChild(row);
      rest.slice(i, i + 2).forEach((b) => put(b, row));
    }
    panel.appendChild(acts);
    // 버튼만 들어 있던 예전 줄은 숨김 (지우지 않음: 게임 코드가 그 줄을 찾아 버튼을 옮기기도 함 — 사천성·메모리·두더지 resRow)
    for (const p of parents) if (p !== panel && !p.children.length && !p.textContent.trim()) p.classList.add('pp-gone');
    panel._ppBtns = btns;
  }
  // 게임 코드가 버튼을 예전 자리로 옮기면(결과 창에서 '다시하기' 자리 바꾸기 등) 정해진 줄·순서로 되돌림
  function restore(panel) {
    const btns = panel._ppBtns; if (!btns) return;
    // 게임 코드가 버튼 class 를 새로 넣어 우리 모양(pp-b)이 빠진 경우도 다시 붙임 (사천성·메모리·두더지 '다시하기')
    for (const b of btns) if (!b.classList.contains('pp-b')) { b.classList.add('pp-b'); paint(b); }
    if (!btns.some((b) => b.parentElement !== b._ppRow)) return;
    for (const b of btns.slice().sort((a, c) => a._ppAt - c._ppAt)) b._ppRow.appendChild(b);
    panel.querySelectorAll(':scope *:not(.pp-acts):not(.pp-row)').forEach((p) => { if (!p.closest('.pp-acts') && p.children.length === 0 && !p.textContent.trim() && p.tagName === 'DIV') p.classList.add('pp-gone'); });
  }

  // 리본 제목 글자가 리본보다 길면 글자만 줄임 · 창이 화면보다 크면 창 전체를 줄임
  function fit(panel) {
    restore(panel);
    const t = panel.querySelector(':scope > .p-title:first-child, :scope > .title:first-child, :scope > .r-title:first-child, :scope > .m-title:first-child');
    if (t) { t.style.fontSize = ''; let fs = 26; while (t.scrollWidth > t.clientWidth + 0.5 && fs > 14) { fs -= 1; t.style.setProperty('font-size', fs + 'px', 'important'); } }
    // 보이는 버튼이 없는 줄은 접음 (실패하면 '다음 스테이지'가 숨는 경우 등)
    panel.querySelectorAll('.pp-row').forEach((r) => { r.style.display = [...r.children].some((b) => getComputedStyle(b).display !== 'none') ? '' : 'none'; });
    panel.style.zoom = '';
    const box = panel.parentElement, room = box.clientHeight - 24;
    if (room > 0 && panel.offsetHeight > room) panel.style.zoom = Math.max(0.6, room / panel.offsetHeight);
  }
  window.PopupUI = { arrange, fit, fitAll: () => document.querySelectorAll(PANELS).forEach((p) => { if (p.offsetParent) fit(p); }) };

  function start() {
    document.querySelectorAll(PANELS).forEach(arrange);
    // 창이 열리거나(숨김 해제) 안의 글자가 바뀌면 다시 맞춤
    // 버튼이 옮겨지면 같은 순간(그리기 전)에 되돌리고, 창 크기 맞춤은 다음 그림 때
    const obs = new MutationObserver(() => { document.querySelectorAll(PANELS).forEach(restore); requestAnimationFrame(window.PopupUI.fitAll); });
    document.querySelectorAll('.screen.dim, #ready, .modal').forEach((s) => obs.observe(s, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true, characterData: true }));
    window.addEventListener('resize', () => setTimeout(window.PopupUI.fitAll, 60));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(window.PopupUI.fitAll);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
