'use strict';
// 한국어/영어 (영어판 초판, 2026-11-04): 화면에 나오는 글자를 고른 언어로 바꿈
//  표: common/i18n_data.js (tools/i18n_build.py 가 docs/Twin_Gameland_KO_EN_Localization_5th_Final_Review_for_Claude.md 로 만듦)
//  언어: 저장 데이터 twin_gameland_v1 의 settings.lang ('ko' 기본 | 'en') — 첫 화면 캐릭터 고르기의 언어 버튼으로 바꿈 (바꾸면 다시 읽음)
//  · 한국어판: 표에서 '현재 한글'과 '권장 한글'이 다른 것만 권장 한글로
//  · 영어판: 최종 영어. {} 자리는 숫자·이름이 들어가는 곳 (들어간 한글 이름도 영어로), {0}{1} 은 자리 순서를 바꾼 영어 문장
//  바꾸는 곳: 글자 칸(줄바꿈 <br> = ' / ', 굵은 글씨 같은 꾸밈은 영어에서 빠짐) · alt·aria-label·placeholder·title · 문서 제목 · 캔버스 글자 · 알림 창
//  게임 코드는 그대로 두고 화면에 나온 글자를 바꾸는 방식이라, 새 글자를 넣으면 tools/i18n_build.py 를 다시 돌려 표를 만들기
(function () {
  const D = window.I18N_DATA; if (!D) return;
  let lang = 'ko';
  try { lang = ((JSON.parse(localStorage.getItem('twin_gameland_v1') || '{}').settings) || {}).lang === 'en' ? 'en' : 'ko'; } catch (e) { /* ignore */ }
  const pairs = D[lang] || [];
  window.I18N = { lang };
  // 준비 창 로고: 영어판은 logo_en.webp (tools/adult_assets.py)
  if (lang === 'en') document.addEventListener('DOMContentLoaded', () => { for (const im of document.querySelectorAll('img[src*="assets/ui/logo.webp"]')) im.src = im.getAttribute('src').replace('logo.webp', 'logo_en.webp'); });
  if (!pairs.length) return;
  document.documentElement.lang = lang;
  const HANGUL = /[가-힣]/;
  const esc = (s) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  // 정확히 같은 글 / {} 가 들어간 글 (긴 것부터: 더 자세한 문장이 먼저)
  const exact = new Map(), pats = [];
  for (const [a, b] of pairs) {
    if (!a.includes('{}')) { if (!exact.has(a)) exact.set(a, b); continue; }
    // '{}개'·'{}번'·'{}초' 처럼 단위만 붙는 글은 숫자일 때만 ('무지개' 같은 낱말이 걸리지 않게)
    const unit = /^\{\}[\uac00-\ud7a3]{1,2}$/.test(a);
    const re = new RegExp('^' + a.split('{}').map(esc).join(unit ? '([\\d,.]+)' : '(.*?)') + '$');
    pats.push([re, b, a.length]);
  }
  pats.sort((p, q) => q[2] - p[2]);
  // 영어판: 문장 전체가 표에 없을 때 표의 한글 낱말(게임 이름·월드 이름 등)만이라도 바꿈 (긴 것부터)
  const words = lang === 'en' ? [...exact.keys()].filter((k) => k.length >= 2).sort((p, q) => q.length - p.length) : [];
  const fill = (tpl, caps) => {
    let k = 0;
    return tpl.replace(/\{(\d?)\}/g, (_, n) => { const v = caps[n === '' ? k++ : +n]; return v == null ? '' : v; });
  };
  const cache = new Map();
  // strict: 표에 있는 문장일 때만 (낱말만 바꾸기는 안 함) — 꾸밈 글씨 덩어리를 통째로 바꿀 때
  function tr(s, strict) {
    if (!s || !HANGUL.test(s)) return s;
    const ck = strict ? '\u0001' + s : s;
    if (cache.has(ck)) return cache.get(ck);
    let out = s;
    const lead = s.match(/^\s*/)[0], tail = s.match(/\s*$/)[0], t = s.trim();
    if (exact.has(t)) out = lead + exact.get(t) + tail;
    else {
      let done = false;
      for (const [re, tpl] of pats) {
        const m = t.match(re); if (!m) continue;
        out = lead + fill(tpl, m.slice(1).map((x) => (HANGUL.test(x) && x !== t ? tr(x) : x))) + tail; done = true; break;
      }
      if (!done && words.length && !strict) { let r = t; for (const w of words) if (r.includes(w)) r = r.split(w).join(exact.get(w)); out = lead + r + tail; }
    }
    cache.set(ck, out); return out;
  }
  window.I18N.tr = tr;

  // ---------- 화면 글자 ----------
  const INLINE = new Set(['B', 'I', 'EM', 'STRONG', 'SMALL', 'BR']);
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT']);
  // 꾸밈 글씨만 들어 있는 칸: 한 덩어리 글로 봄 (<br> = ' / ')
  function flat(el) {
    let s = '';
    for (const n of el.childNodes) {
      if (n.nodeType === 3) s += n.nodeValue;
      else if (n.nodeType === 1 && INLINE.has(n.tagName)) s += n.tagName === 'BR' ? ' / ' : flat(n);
      else return null;
    }
    return s;
  }
  const done = new WeakMap(); // 바꾼 뒤의 글 (같은 글을 다시 바꾸지 않게)
  // 덩어리째 바꿔도 되는 칸: 안에 id 가 붙은 글씨(게임이 숫자를 넣는 곳)가 없을 때만
  const canFlat = (el) => !el.querySelector('[id]');
  function setFlat(el, out) {
    // ' / ' 가운데 실제 줄바꿈은 원래 <br> 개수만큼 (뒤에서부터) — 앞쪽 '5 / 100' 같은 글자 슬래시는 그대로
    const n = el.querySelectorAll('br').length, all = out.split(' / '), keep = Math.max(1, all.length - n);
    const parts = [all.slice(0, keep).join(' / '), ...all.slice(keep)];
    el.textContent = '';
    parts.forEach((p, i) => { if (i) el.appendChild(document.createElement('br')); el.appendChild(document.createTextNode(p)); });
  }
  function doEl(el) {
    if (SKIP.has(el.tagName)) return;
    for (const a of ['alt', 'aria-label', 'placeholder', 'title']) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v && HANGUL.test(v)) { const o = tr(v); if (o !== v) el.setAttribute(a, o); }
    }
    const hasEl = [...el.childNodes].some((n) => n.nodeType === 1);
    if (hasEl) {
      const f = flat(el);
      if (f != null && HANGUL.test(f) && done.get(el) !== f && canFlat(el)) {
        const t = f.replace(/\s+/g, ' ').trim(), o = tr(t, true);
        if (o !== t) { setFlat(el, o); done.set(el, el.textContent); return; }
      }
    }
    for (const n of [...el.childNodes]) {
      if (n.nodeType === 3) doText(n);
      else if (n.nodeType === 1) doEl(n);
    }
  }
  function doText(n) {
    const v = n.nodeValue; if (!v || !HANGUL.test(v) || done.get(n) === v) return;
    const p = n.parentElement; if (p && SKIP.has(p.tagName)) return;
    // 부모가 꾸밈 글씨 덩어리면 부모째로
    if (p && p.childNodes.length > 1 && canFlat(p)) { const f = flat(p); if (f != null) { const t = f.replace(/\s+/g, ' ').trim(), o = tr(t, true); if (o !== t) { setFlat(p, o); done.set(p, p.textContent); return; } } }
    const o = tr(v); if (o !== v) n.nodeValue = o;
    done.set(n, n.nodeValue);
  }
  function run(root) { if (root.nodeType === 3) doText(root); else if (root.nodeType === 1) doEl(root); }
  function start() {
    if (document.title) document.title = tr(document.title);
    run(document.body);
    new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doEl(m.target);
        else for (const n of m.addedNodes) run(n);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['alt', 'aria-label', 'placeholder', 'title'] });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);

  // ---------- 캔버스 글자 (게임 화면 위에 그리는 글자) · 알림 창 ----------
  const C = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
  if (C) for (const f of ['fillText', 'strokeText', 'measureText']) {
    const o = C[f]; C[f] = function (text, ...rest) { return o.call(this, typeof text === 'string' ? tr(text) : text, ...rest); };
  }
  for (const f of ['alert', 'confirm', 'prompt']) {
    const o = window[f]; if (o) window[f] = function (msg, ...rest) { return o.call(window, typeof msg === 'string' ? tr(msg) : msg, ...rest); };
  }
})();
