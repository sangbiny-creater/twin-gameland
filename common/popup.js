'use strict';
// 모든 팝업의 버튼을 같은 규칙으로 줄 세움 (모양은 common/popup.css)
//  ① 광고 줄(common/monet.js 가 채움) ② 큰 버튼 한 줄 가득(다음 스테이지·계속하기) ③ 같은 폭 두 버튼 나란히
//  버튼은 그대로 옮기기만 해서 게임 코드의 버튼 기능(id·누르기)은 바뀌지 않음
(function () {
  const MAIN = ['btnNext', 'btnResume', 'btnFromLv', 'gpGo', 'btnGo'];   // ② 큰 버튼 (채운 버튼)
  const paint = () => {}; // v0.4: 버튼 색은 캐릭터 색 하나 (common/popup.css)
  const ACTION = /(^|\s)(btn|btn-start|btn-sub|btn-main|btn-orange|btn-blue|btn-gray|mbtn|rb)(\s|$)/;
  const PANELS = '.screen.dim > .panel, #ready > .panel, .modal > .panel, .modal > .mpanel';

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
    // 버튼 글자가 버튼보다 길면 글자만 줄임 (영어판은 글자가 길어요)
    panel.querySelectorAll('button.pp-b, button.pp-adb b').forEach((b) => {
      b.style.fontSize = ''; const el = b; if (!el.clientWidth) return;
      let fs = parseFloat(getComputedStyle(el).fontSize), guard = 0;
      while (el.scrollWidth > el.clientWidth + 0.5 && fs > 11 && guard++ < 30) { fs -= 1; el.style.setProperty('font-size', fs + 'px', 'important'); }
    });
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

// 결과 창 게임 기록 (2026-11-09 사용자 요청): 기록 표는 창에서 빼고 코인·다이아 칸만 남김.
//  코인·다이아 칸을 꾹 누르고 있는 동안만 장식 없는 둥근 흰 상자(첫 화면 이름·레벨 상자 느낌)로 기록을 보여 주고, 손을 떼면 바로 사라짐.
//  게임 코드는 지금처럼 기록 표(id)에 숫자를 쓰고, 표는 popup.css 가 숨김 → 상자는 누를 때 그 표를 읽어 만듦
(function () {
  const STATS = '.r-box, .res-stats, .r-stats, .res-table, .res-line'; // 게임마다 기록 표 이름
  const AREA = '#mnEarnRow, #resEarn, #mnGems';                          // 코인·다이아 칸 (common/monet.js 가 나란히 놓음)
  const HOLD = 380;                                                      // 이만큼(ms) 누르고 있으면 상자가 나옴
  let tip = null, timer = 0, pid = null, area = null;

  const shown = (el) => el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none' || false;
  // 기록 표 한 줄 → [이름, 값] 여러 개. '최고 기록 179m · 도착한 곳 하늘도시' 처럼 · 로 이어진 줄은 나눔
  function rowsOf(line) {
    const out = [{ k: '', v: '' }];
    const add = (s, toV) => { const c = out[out.length - 1]; if (toV || c.v) c.v += s; else c.k += s; };
    const walk = (n) => {
      if (n.nodeType === 3) { n.nodeValue.split('·').forEach((s, i) => { if (i) out.push({ k: '', v: '' }); add(s); }); return; }
      if (n.nodeType !== 1 || n.classList.contains('hidden') || n.classList.contains('badge') || n.classList.contains('ico') || n.classList.contains('ri')) return;
      if (n.tagName === 'B' || n.classList.contains('r-stars') || n.querySelector('b')) { add(n.textContent, true); return; }
      if (n.tagName === 'SPAN' && !out[out.length - 1].v) { add(n.textContent); return; }
      add(n.textContent);
    };
    line.childNodes.forEach(walk);
    return out.map((r) => {
      let k = r.k.replace(/\s+/g, ' ').trim(), v = r.v.replace(/\s+/g, ' ').trim();
      if (!v) { const m = k.match(/^(.*\S)\s+(\S+)$/); if (m) { k = m[1]; v = m[2]; } } // '최고 기록 179m' → 이름 / 값
      return [k, v];
    }).filter(([k, v]) => k || v);
  }
  function rows(panel) {
    const out = [];
    panel.querySelectorAll(STATS).forEach((box) => {
      const lines = box.classList.contains('res-line') ? [box] : [...box.children];
      for (const l of lines) if (!l.classList.contains('hidden') && !(l.matches('.r-stats > div') && l.querySelector('.r-stars'))) out.push(...rowsOf(l));
    });
    return out;
  }
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function show() {
    const panel = area && area.closest('.panel'); if (!panel) return;
    const list = rows(panel); if (!list.length) return;
    hide();
    tip = document.createElement('div'); tip.className = 'pp-stat-tip'; tip.setAttribute('role', 'tooltip');
    tip.innerHTML = list.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
    // 창 안에 넣음 (하늘타기처럼 화면을 통째로 돌리거나 줄인 게임에서도 창과 같이 돌고 같은 크기)
    panel.appendChild(tip);
    // 코인·다이아 칸 바로 위 가운데 (손가락에 가리지 않게). 위가 모자라면 아래
    const pos = (e) => { let y = 0, n = e; while (n && n !== panel) { y += n.offsetTop; n = n.offsetParent; } return n === panel ? y : null; };
    const els = [...panel.querySelectorAll(AREA)].filter((e) => shown(e) && e.offsetHeight && pos(e) != null);
    if (!els.length) { hide(); return; }
    const top = Math.min(...els.map(pos)), bot = Math.max(...els.map((e) => pos(e) + e.offsetHeight));
    const h = tip.offsetHeight;
    tip.style.top = (top - h - 10 >= -60 ? top - h - 10 : bot + 10) + 'px';
    if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) { /* 없어도 됨 */ }
  }
  function hide() { clearTimeout(timer); timer = 0; if (tip) { tip.remove(); tip = null; } }
  function end() { hide(); if (area && pid != null) try { area.releasePointerCapture(pid); } catch (e) { /* 이미 풀림 */ } pid = null; area = null; }
  const inside = (e) => {
    const panel = area && area.closest('.panel'); if (!panel) return false;
    return [...panel.querySelectorAll(AREA)].filter(shown).some((el) => { const r = el.getBoundingClientRect(); return e.clientX >= r.left - 6 && e.clientX <= r.right + 6 && e.clientY >= r.top - 6 && e.clientY <= r.bottom + 6; });
  };

  function start() {
    const res = document.getElementById('result'); if (!res) return;
    res.addEventListener('pointerdown', (e) => {
      const a = e.target.closest && e.target.closest(AREA); if (!a || (e.button && e.button !== 0)) return;
      end(); area = a; pid = e.pointerId;
      try { a.setPointerCapture(pid); } catch (er) { /* 괜찮음 */ }
      timer = setTimeout(show, HOLD);
      e.stopPropagation();
    });
    res.addEventListener('pointermove', (e) => { if (area && e.pointerId === pid && !inside(e)) end(); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) res.addEventListener(ev, (e) => { if (area && e.pointerId === pid) end(); });
    res.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest(AREA)) e.preventDefault(); });
    // 길게 누를 때 글자 선택·확대 메뉴가 뜨지 않게 (아이폰 touchstart 기본 동작)
    res.addEventListener('touchstart', (e) => { if (e.target.closest && e.target.closest(AREA) && e.cancelable) e.preventDefault(); }, { passive: false });
    window.addEventListener('blur', end);
    document.addEventListener('visibilitychange', end);
    new MutationObserver(() => { if (res.classList.contains('hidden')) end(); }).observe(res, { attributes: true, attributeFilter: ['class'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.PopupUI && (window.PopupUI.statRows = () => { const p = document.querySelector('#result .panel'); return p ? rows(p) : []; });
})();
