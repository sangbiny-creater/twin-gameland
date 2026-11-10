'use strict';
// 화면을 한 번에 보여 주기 (모든 화면 공통) — 상용 게임처럼 조각이 차례로 뜨지 않게
//  <head> 맨 앞(스타일시트 다음)에서 읽음: <script src="../common/boot.js?v=…"></script>
//  ① 처음 열 때: 화면에 보일 그림(<img>·CSS 배경·테두리 그림)·글꼴(Jua)·게임 코드가 만든 그림(new Image)이
//     모두 받아지고 풀릴(decode) 때까지 화면을 가려 두고(html.booting), 다 되면 한 번에 보여 줌.
//     늦으면(0.35초 넘게) 같은 색 바탕에 빙글빙글 도는 사탕색 동그라미를 보여 줌. 아주 느려도 1분 뒤에는 그냥 보여 줌.
//  ② 화면이 바뀔 때·창이 뜰 때: 새로 보이는 창(.screen·.modal·결과/일시정지 창…)의 그림이 아직이면
//     그 창만 잠깐 숨겨 두었다가(.boot-hold) 다 받으면 한 번에 보여 줌 — 게임 코드는 그대로.
//  ③ 다 보인 뒤: 숨어 있는 화면·창의 그림을 미리 받아 둠 (나중에 열 때 바로 뜨게)
//  게임 코드에서 쓸 수 있는 것: Boot.ready(요소 또는 [주소…]) → Promise (그림이 다 준비되면)
//                              Boot.wait(Promise) (처음 보여 주기 전에 기다릴 일) · Boot.later([주소…]) (나중을 위해 미리 받기)
(function () {
  if (window.Boot) return;
  const D = document.documentElement;
  const SRC = (document.currentScript && document.currentScript.src) || '';
  const ROOT = SRC.replace(/common\/boot\.js.*$/, '');
  const VER = (SRC.match(/[?&]v=(\d+)/) || [])[1] || '';
  D.classList.add('booting');

  // ---- 글꼴(Jua)을 이 사이트에서 직접 (구글 글꼴은 글자 조각을 나눠 받아서, 새 글자가 나올 때마다 글자 모양이 늦게 바뀜) ----
  //  common/fonts/jua.woff2 = 게임에 쓰는 글자 + 자주 쓰는 한글 2350자 (SIL OFL, common/fonts/OFL.txt)
  const css = document.createElement('style');
  css.id = 'bootCss';
  css.textContent = `
@font-face{font-family:Jua;src:url(${ROOT}common/fonts/jua.woff2${VER ? '?v=' + VER : ''}) format('woff2');font-display:block}
html.booting body>*{visibility:hidden!important}
.boot-hold{visibility:hidden!important}
html.booting::before,html.boot-wait::before{content:'';position:fixed;inset:0;z-index:2147483646;background:linear-gradient(#BFE6FF,#FFE9F2);opacity:0;animation:bootIn .25s .35s forwards;pointer-events:none}
html.booting::after,html.boot-wait::after{content:'';position:fixed;left:50%;top:50%;z-index:2147483647;width:84px;height:84px;margin:-42px 0 0 -42px;border-radius:50%;
  background:radial-gradient(closest-side,transparent calc(100% - 19px),#fff calc(100% - 19px) calc(100% - 15px),transparent calc(100% - 15px) calc(100% - 4px),#fff calc(100% - 4px)),
    conic-gradient(#FF7FAE 0 21%,#fff 21% 25%,#FFD23F 25% 46%,#fff 46% 50%,#6EC6FF 50% 71%,#fff 71% 75%,#7EDDB0 75% 96%,#fff 96%);
  -webkit-mask:radial-gradient(closest-side,transparent calc(100% - 19px),#000 calc(100% - 19px));mask:radial-gradient(closest-side,transparent calc(100% - 19px),#000 calc(100% - 19px));
  opacity:0;animation:bootIn .25s .35s forwards,bootSpin 1.1s linear infinite;pointer-events:none}
@keyframes bootSpin{to{transform:rotate(1turn)}}
@keyframes bootIn{to{opacity:1}}`;
  (document.head || D).appendChild(css);

  const done = new Map();     // 주소 → Promise (받고 풀기까지)
  const abs = (u) => { try { return new URL(u, location.href).href; } catch (e) { return u; } };
  // 그림 하나 받아서 풀기 (실패해도 끝난 것으로)
  //  'm:' 로 시작하는 주소 = CSS 마스크 그림 (브라우저가 CORS 방식으로 따로 받아서 같은 방식으로 받아 둠)
  const keep = []; // 받아 둔 그림을 붙잡아 둠 (브라우저가 메모리에서 버리지 않게 → 나중에 같은 그림은 바로 그려짐)
  function load(u) {
    if (!u || u.startsWith('data:') || u.startsWith('blob:')) return Promise.resolve();
    if (done.has(u)) return done.get(u);
    const cors = u.startsWith('m:'), url = cors ? u.slice(2) : u;
    const p = new Promise((res) => {
      const im = new Image(); im.__boot = 1; if (cors) im.crossOrigin = 'anonymous'; keep.push(im);
      let fin = false; const end = () => { if (fin) return; fin = true; res(); };
      im.onload = () => { if (im.decode) im.decode().then(end, end); else end(); };
      im.onerror = end;
      origSrc.set.call(im, url);
      setTimeout(end, 20000);
    });
    done.set(u, p);
    return p;
  }
  const URLRE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
  const cssUrls = (cs, out) => {
    const vs = [cs.backgroundImage, cs.borderImageSource, cs.listStyleImage, cs.content, cs.webkitMaskImage, cs.maskImage];
    vs.forEach((v, k) => {
      if (!v || v === 'none' || v.indexOf('url(') < 0) return;
      for (const m of v.matchAll(URLRE)) if (!m[2].startsWith('data:')) out.add((k >= 4 ? 'm:' : '') + abs(m[2]));
    });
  };
  // 요소 안의 그림 주소 모두 (<img> · CSS 배경/테두리/마스크 그림 · ::before/::after) — 숨어 있는(display:none) 부분도 계산된 모양으로 읽음
  //  mode: 0 = 모두 · 1 = 보이는 것(display:none 아닌 것) · 2 = 보이면서 화면 안(가장자리 조금 여유) — 긴 놀이공원은 지금 보이는 곳만 기다림
  const near = (el) => { const r = el.getBoundingClientRect(), H = innerHeight, W = innerWidth; return r.bottom > -H * 0.15 && r.top < H * 1.15 && r.right > -W * 0.15 && r.left < W * 1.15; };
  //  imgs 를 주면 <img> 는 주소 대신 그 요소를 모음 (화면의 <img> 가 직접 다 받았는지 봄 — 같은 그림을 한 번 더 받지 않게)
  function urlsIn(root, out = new Set(), mode = 0, imgs = null) {
    if (!root) return out;
    const els = root.nodeType === 1 ? [root, ...root.querySelectorAll('*')] : [...root.querySelectorAll('*')];
    for (const el of els) {
      if (mode && el.checkVisibility && !el.checkVisibility()) continue;
      if (mode === 2 && !near(el)) continue;
      if (el.tagName === 'IMG') { const s = el.getAttribute('src'); if (s) { if (imgs) { if (!imgOk(el)) imgs.push(el); } else out.add(abs(el.currentSrc || el.src)); } }
      else if (el.tagName === 'image' && el.href && el.href.baseVal) out.add(abs(el.href.baseVal));
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'LINK') continue;
      cssUrls(getComputedStyle(el), out);
      for (const pe of ['::before', '::after']) { const cs = getComputedStyle(el, pe); if (cs.content !== 'none') cssUrls(cs, out); }
    }
    return out;
  }
  // 그림이 다 준비됐는지 바로 알 수 있으면 true (이미 받은 그림 = 브라우저가 가지고 있음)
  const isReady = (u) => { const p = done.get(u); return p && p.__ok; };
  function track(u) { const p = load(u); if (!p.__t) { p.__t = 1; p.then(() => { p.__ok = true; }); } return p; }
  function ready(what) {
    const list = Array.isArray(what) ? what.map((u) => (u.startsWith('m:') ? u : abs(u))) : [...urlsIn(what)];
    return Promise.all(list.map(track)).then(() => undefined);
  }

  // ---- 게임 코드가 처음에 만드는 그림(new Image / img.src = …)도 기다림 ----
  const origSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  const jsImgs = new Set();
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true, enumerable: origSrc.enumerable, get: origSrc.get,
    set(v) { origSrc.set.call(this, v); if (!this.__boot && booting && v) { jsImgs.add(this); keep.push(this); } },
  });
  const imgOk = (im) => im.complete && (im.naturalWidth > 0 || !im.getAttribute('src'));
  const imgDone = (im) => (im.complete ? (im.naturalWidth && im.decode ? im.decode().catch(() => {}) : Promise.resolve()) : new Promise((r) => { im.addEventListener('load', () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(r), { once: true }); im.addEventListener('error', r, { once: true }); setTimeout(r, 20000); }));

  // ---- ① 처음 보여 주기 ----
  let booting = true;
  const waits = [];
  // 게임 화면 위쪽 하트(모든 게임 같은 그림)는 게임이 시작될 때 생겨서 처음에 미리 받아 둠
  document.addEventListener('DOMContentLoaded', () => { if (document.getElementById('hud')) waits.push(ready(['heart', 'heart_empty'].flatMap((n) => [ROOT + `common/ui/${n}.webp`, ROOT + `common/ui/${n}.webp?v=${VER}`]))); });
  const fontP = document.fonts && document.fonts.load ? document.fonts.load('20px Jua', '가A1').catch(() => {}) : Promise.resolve();
  // 화면 코드가 첫 화면을 그린 뒤: HTML 다 읽고(DOMContentLoaded) 조금 뒤. load 이벤트는 기다리지 않음 (로그인용 파일처럼 화면과 상관없는 파일이 늦게 와도 첫 화면이 늦지 않게)
  const loadP = new Promise((r) => { const go = () => setTimeout(r, 30); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go(); });
  const POP = '.screen.dim, #ready, #pause, #result, .modal, .mn-modal, .gp-ask';
  let total = 0, got = 0;
  const bar = () => D.style.setProperty('--boot-p', total ? Math.min(1, got / total).toFixed(3) : '0');
  const count = (p) => { total++; bar(); p.then(() => { got++; bar(); }); return p; };
  async function boot() {
    await new Promise((r) => (document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', r) : r()));
    await loadP; // 첫 화면은 load 다음에 그려지기도 함(놀이공원: pageshow) → 그린 뒤의 화면을 봄
    for (let round = 0; round < 8; round++) {
      // 화면에 보일 것 + 창(일시정지·결과…) 꾸밈 + 게임 코드가 만든 그림 + 글꼴
      const imgs = [], urls = urlsIn(document.body, new Set(), 2, imgs);
      document.querySelectorAll(POP).forEach((p) => urlsIn(p, urls, 0, imgs));
      const ps = [...urls].filter((u) => !isReady(u)).map((u) => count(track(u)));
      for (const im of new Set(imgs)) ps.push(count(imgDone(im)));
      for (const im of jsImgs) { jsImgs.delete(im); ps.push(count(imgDone(im))); }
      ps.push(fontP, ...waits.splice(0));
      await Promise.all(ps);
      await frames(2); // 그림이 들어온 뒤 게임이 한 번 더 그리게
      const imgs2 = [], urls2 = urlsIn(document.body, new Set(), 2, imgs2);
      if (!jsImgs.size && !waits.length && !imgs2.length && [...urls2].every(isReady)) break;
    }
    reveal();
  }
  // 화면 n번 그린 뒤 (안 보이는 탭에서는 그리기가 멈추므로 시간으로도 끝냄)
  const frames = (n) => new Promise((r) => { let fin = false; const end = () => { if (!fin) { fin = true; r(); } }; const f = () => (--n <= 0 ? end() : requestAnimationFrame(f)); requestAnimationFrame(f); setTimeout(end, 40 * n + 60); });
  let shown = false;
  function reveal() {
    if (shown) return; shown = true; booting = false; jsImgs.clear();
    try { document.dispatchEvent(new Event('bootready')); } catch (e) { /* 화면 코드가 마지막으로 자리 맞춤 */ }
    D.classList.remove('booting');
    document.querySelectorAll(HOLD).forEach((el) => wasVis.set(el, !el.checkVisibility || el.checkVisibility()));
    setTimeout(prefetch, 300);
  }
  boot();
  setTimeout(reveal, 60000); // 아주 느린 인터넷: 1분 뒤에는 그냥 보여 줌 (그동안은 도는 동그라미)

  // ---- ② 새로 보이는 창은 그림이 다 오면 한 번에 ----
  const HOLD = '.screen, .modal, .mn-modal, #ready, #pause, #result, .gp-ask, .gp-start, [data-boot-hold]';
  const holding = new WeakSet(), wasVis = new WeakMap(); let waiting = 0;
  function hold(el) {
    if (!shown || holding.has(el) || !el.isConnected) return;
    const v = !el.checkVisibility || el.checkVisibility(), was = wasVis.get(el); wasVis.set(el, v);
    if (!v) return;
    if (was !== true) el.__bootFresh = performance.now();
    else if (!(performance.now() - (el.__bootFresh || -1e9) < 200)) return; // 이번에 새로 보이게 된 창만 (막 뜬 창에 바로 붙는 내용까지), 이미 보이던 창은 그대로
    const imgs = [], urls = [...urlsIn(el, new Set(), 2, imgs)];
    const need = urls.filter((u) => !isReady(u));
    if (!need.length && !imgs.length) return;
    // 이미 받아 둔 그림인지 바로 확인 (브라우저 메모리에 있으면 Image 가 바로 complete)
    const really = need.filter((u) => { const im = new Image(); im.__boot = 1; if (u.startsWith('m:')) im.crossOrigin = 'anonymous'; origSrc.set.call(im, u.replace(/^m:/, '')); if (im.complete && im.naturalWidth) { track(u); return false; } return true; });
    if (!really.length && !imgs.length) return;
    holding.add(el); el.classList.add('boot-hold');
    // 화면 전체가 바뀌는 경우(지도·놀이공원 등)는 0.35초 넘게 걸리면 도는 동그라미를 보여 줌 (창은 뒤 화면을 그대로 둠)
    const full = el.matches('.screen:not(.dim), [data-boot-hold]');
    if (full) { waiting++; D.classList.add('boot-wait'); }
    Promise.all([...really.map(track), ...imgs.map(imgDone)]).then(() => frames(1)).then(() => {
      el.classList.remove('boot-hold'); holding.delete(el); wasVis.set(el, false); hold(el);
      if (full && --waiting <= 0) { waiting = 0; D.classList.remove('boot-wait'); }
    });
  }
  const scanHold = (n) => { if (n.nodeType !== 1) return; if (n.matches(HOLD)) hold(n); n.querySelectorAll && n.querySelectorAll(HOLD).forEach(hold); };
  new MutationObserver((ms) => {
    if (!shown) return;
    for (const m of ms) {
      const t = m.target.nodeType === 1 ? m.target : m.target.parentElement; if (!t) continue;
      if (m.type === 'childList') m.addedNodes.forEach(scanHold);
      else if (t.matches(HOLD)) hold(t);
      else if (m.attributeName === 'class') scanHold(t);
      // 막 뜬 창 안에 내용이 더 붙으면(다른 코드가 창을 꾸밈) 그 창을 다시 봄
      const h = t.closest(HOLD); if (h && performance.now() - (h.__bootFresh || -1e9) < 200) hold(h);
    }
  }).observe(D, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });

  // ---- ③ 다 보인 뒤: 숨은 화면·창 그림 미리 받기 ----
  const later = [];
  function prefetch() {
    const urls = urlsIn(document.body, new Set(), 1); // 지금 화면의 나머지(스크롤하면 보일 곳) 먼저, 그다음 숨은 화면·창
    urlsIn(document.body, urls, 0);
    for (const u of later.splice(0)) urls.add(abs(u));
    const list = [...urls].filter((u) => !done.has(u));
    let i = 0; const next = () => { if (i >= list.length) return; track(list[i++]).then(next); };
    for (let k = 0; k < 4; k++) next(); // 4개씩 차례로 (지금 화면을 느리게 하지 않게)
  }

  window.Boot = {
    ready, urlsIn, load: track,
    wait(p) { if (!shown) waits.push(Promise.resolve(p).catch(() => {})); },
    need(list) { if (!shown) waits.push(ready(list)); },
    refresh(el) { if (el && shown) { wasVis.set(el, false); hold(el); } }, // 이미 보이는 화면을 새로 그렸을 때 (지도 → 다른 지도)
    afterShow(fn) { if (shown) fn(); else document.addEventListener('bootready', () => setTimeout(fn, 0), { once: true }); },
    later(list) { if (shown) list.forEach((u) => track(u)); else later.push(...list); },
    get shown() { return shown; },
    debug: () => ({ total, got, pending: [...done.entries()].filter(([, p]) => !p.__ok).map(([u]) => u.replace(location.origin, '')), js: jsImgs.size, waits: waits.length }),
  };
})();
