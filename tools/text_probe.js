// 글자 칸 검사 (화면 안에서 돌림) — tools/text_check.mjs 가 모든 화면에 넣어 실행
//  그림(버튼·리본·탭·이름표…) 위에 얹은 글자가 "그림 속 글자 칸" 안에 있고 가운데인지 잼
//  FACES = 그림 이름 → 글자 칸 [왼, 위, 오른, 아래] (그림 크기에 대한 비율, tools/text_faces.py 로 잼 + 눈으로 다듬음)
//  border-image 그림(늘려 그리는 버튼)은 조각 늘림을 그대로 계산해서 칸 자리를 화면 좌표로 바꿈
//  결과: [{ sel, text, img, over: {l,t,r,b}(칸 밖으로 나간 px), off: {x,y}(가운데에서 어긋난 px), clip(글자가 잘림) }]
(() => {
  const FACES = {
    ribbon_pink: [0.162, 0.311, 0.162, 0.32], ribbon_blue: [0.162, 0.317, 0.162, 0.321],
    btn_pink: [0.07, 0.112, 0.07, 0.121], btn_blue: [0.07, 0.136, 0.07, 0.153],
    fill_pink: [0.07, 0.07, 0.07, 0.12], fill_blue: [0.07, 0.07, 0.07, 0.12],
    btn_gray: [0.07, 0.06, 0.07, 0.1], btn_gold: [0.07, 0.1, 0.07, 0.19],
    name_pink_sel: [0.14, 0.08, 0.14, 0.1], name_blue_sel: [0.14, 0.09, 0.14, 0.1],
    lang_pink: [0.25, 0.103, 0.22, 0.111], lang_blue: [0.25, 0.103, 0.22, 0.111],
    label: [0.215, 0.29, 0.08, 0.27],
    name_pink_map: [0.233, 0.14, 0.23, 0.357], name_blue_map: [0.23, 0.102, 0.23, 0.361],
    pill: [0.26, 0.14, 0.08, 0.17], board: [0.156, 0.14, 0.148, 0.15],
    top_clear: [0.352, 0.23, 0.078, 0.125], top_star: [0.345, 0.23, 0.056, 0.135],
    num: [0.094, 0.105, 0.104, 0.126], num1: [0.12, 0.12, 0.12, 0.14], num2: [0.12, 0.12, 0.12, 0.14], num3: [0.12, 0.12, 0.12, 0.14],
    badge: [0.17, 0.2, 0.17, 0.21], ico_trial: [0.242, 0.141, 0.273, 0.333],
    tab_on_pink: [0.028, 0.172, 0.028, 0.101], tab_on_blue: [0.031, 0.16, 0.031, 0.11],
    tab_off_pink: [0.028, 0.07, 0.028, 0.08], tab_off_blue: [0.028, 0.07, 0.028, 0.08],
  };
  const keyOf = (url) => {
    const m = url.match(/\/([a-z0-9_]+)\.webp/i); if (!m) return null;
    let k = m[1];
    if (k === 'name_pink' || k === 'name_blue') k += url.includes('/select/') ? '_sel' : '_map';
    return FACES[k] ? k : null;
  };
  const urlOf = (v) => { const m = v && v !== 'none' && v.match(/url\(\s*['"]?([^'")]+)/); return m ? m[1] : null; };
  const sizes = window.__tpSizes || (window.__tpSizes = {});
  const natural = (u) => sizes[u] || null;
  const vis = (el) => el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : !!el.offsetParent;

  // 요소 안쪽 좌표계 (돌린 화면·zoom·scale 이 있어도): 요소 안에 작은 표시 3개를 넣어 화면 좌표 → 요소 좌표 변환을 구함
  function frame(el) {
    const cs = getComputedStyle(el), mk = [];
    const was = el.style.position; if (cs.position === 'static') el.style.position = 'relative';
    for (const [x, y] of [['0', '0'], ['100px', '0'], ['0', '100px'], ['100%', '100%']]) { const m = document.createElement('i'); m.style.cssText = `position:absolute;left:${x};top:${y};width:0;height:0;margin:0;padding:0;border:0;display:block`; el.appendChild(m); mk.push(m); }
    const P = mk.map((m) => m.getBoundingClientRect()); mk.forEach((m) => m.remove()); el.style.position = was;
    const ex = { x: (P[1].left - P[0].left) / 100, y: (P[1].top - P[0].top) / 100 }, ey = { x: (P[2].left - P[0].left) / 100, y: (P[2].top - P[0].top) / 100 };
    const det = ex.x * ey.y - ex.y * ey.x; if (!det) return null;
    const bl = parseFloat(cs.borderLeftWidth) || 0, bt = parseFloat(cs.borderTopWidth) || 0;
    const toL = (X, Y) => { const dx = X - P[0].left, dy = Y - P[0].top; return { x: (dx * ey.y - dy * ey.x) / det + bl, y: (ex.x * dy - ex.y * dx) / det + bt }; };
    const pw = toL(P[3].left, P[3].top);
    return { toL, w: pw.x + (parseFloat(cs.borderRightWidth) || 0), h: pw.y + (parseFloat(cs.borderBottomWidth) || 0), k: Math.hypot(ex.x, ex.y) };
  }
  const toLocal = (F, q) => { const a = F.toL(q.left, q.top), b = F.toL(q.right, q.bottom), c = F.toL(q.left, q.bottom), d = F.toL(q.right, q.top);
    return { left: Math.min(a.x, b.x, c.x, d.x), right: Math.max(a.x, b.x, c.x, d.x), top: Math.min(a.y, b.y, c.y, d.y), bottom: Math.max(a.y, b.y, c.y, d.y), icon: q.icon }; };
  // 그림 속 비율 칸 → 요소 좌표 (background 100% 100% / contain, border-image stretch)
  function faceRect(el, cs, url, k, pseudo, F) {
    const r = { left: 0, top: 0, width: F.w, height: F.h }, f = FACES[k];
    const bis = urlOf(cs.borderImageSource);
    if (!pseudo && bis === url) {
      const n = natural(url); if (!n) return null;
      const sl = cs.borderImageSlice.split(/\s+/).filter((x) => x !== 'fill').map(parseFloat);
      const [st, sr, sb, sL] = [sl[0], sl[1] ?? sl[0], sl[2] ?? sl[0], sl[3] ?? sl[1] ?? sl[0]];
      const bw = ['Top', 'Right', 'Bottom', 'Left'].map((s) => parseFloat(cs['border' + s + 'Width']) || 0);
      // border-image-width 가 따로 있으면 그것 (px 또는 숫자배)
      const biw = cs.borderImageWidth.split(/\s+/); const W4 = [0, 1, 2, 3].map((i) => { const v = biw[i] ?? biw[i === 3 ? 1 : i === 2 ? 0 : i === 1 ? 0 : 0] ?? biw[0]; return v.endsWith('px') ? parseFloat(v) : v === 'auto' ? [st, sr, sb, sL][i] : parseFloat(v) * bw[i]; });
      const map = (s, S, a, b, L, wa, wb) => s <= a ? (a ? s / a * wa : 0) : s >= S - b ? L - (b ? (S - s) / b * wb : 0) : wa + (s - a) / (S - a - b) * (L - wa - wb);
      const x0 = map(f[0] * n.w, n.w, sL, sr, r.width, W4[3], W4[1]), x1 = map((1 - f[2]) * n.w, n.w, sL, sr, r.width, W4[3], W4[1]);
      const y0 = map(f[1] * n.h, n.h, st, sb, r.height, W4[0], W4[2]), y1 = map((1 - f[3]) * n.h, n.h, st, sb, r.height, W4[0], W4[2]);
      return { left: r.left + x0, right: r.left + x1, top: r.top + y0, bottom: r.top + y1 };
    }
    let L = r.left, T = r.top, W = r.width, H = r.height;
    const bs = cs.backgroundSize, n = natural(url);
    if (pseudo) { const pr = pseudo; L = r.left + pr.l; T = r.top + pr.t; W = r.width - pr.l - pr.r; H = r.height - pr.t - pr.b; }
    if (n && (bs === 'contain' || bs === 'cover')) {
      const s = bs === 'contain' ? Math.min(W / n.w, H / n.h) : Math.max(W / n.w, H / n.h); const w = n.w * s, h = n.h * s;
      L += (W - w) / 2; T += (H - h) / 2; W = w; H = h;
    }
    return { left: L + f[0] * W, right: L + W - f[2] * W, top: T + f[1] * H, bottom: T + H - f[3] * H };
  }
  // 글자 잉크 크기 (canvas 로 실제 글자 모양 위·아래 끝)
  function inkRects(el, skip) {
    const out = [];
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!n.nodeValue.trim()) continue;
      let p = n.parentElement, bad = false;
      for (let q = p; q && q !== el; q = q.parentElement) if (skip.has(q) || !vis(q)) { bad = true; break; }
      if (bad) continue;
      // 글자 칸(em 상자)을 잉크로 봄: Jua 한글은 em 상자 위 0% ~ 92% 에 그려짐 (픽셀로 잰 값). canvas 잉크 값은 한글에서 틀려서 안 씀
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const rc of rg.getClientRects()) if (rc.width) out.push({ left: rc.left, right: rc.right, top: rc.top, bottom: rc.bottom });
    }
    // 글자와 같이 놓인 아이콘(<img>·아이콘 <i>)도 내용에 넣음 (아이콘+글자 묶음이 가운데여야 함)
    for (const im of el.querySelectorAll('img, i.gp-ico, i.ico, .mn-ic')) {
      let bad = false; for (let q = im; q && q !== el; q = q.parentElement) if (skip.has(q) || !vis(q)) { bad = true; break; }
      if (bad || getComputedStyle(im).position === 'absolute') continue;
      const r = im.getBoundingClientRect(); if (r.width && r.height) out.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, icon: 1 });
    }
    return out;
  }
  const sel = (el) => { let s = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + [...el.classList].slice(0, 3).map((c) => '.' + c).join(''); const p = el.parentElement; if (!el.id && p) s = (p.id ? '#' + p.id : p.tagName.toLowerCase() + [...p.classList].slice(0, 2).map((c) => '.' + c).join('')) + ' > ' + s; return s; };
  // 글자 칸이 곧 요소의 안쪽 칸(padding 안)인 것: 코드가 그림 속 칸을 재서 자리를 정해 둔 곳
  const BOXES = '.sc-t, .sc-pill, .pk-ride .name, .sh-tabs button span, .r-num b, .rk-seg button, .mn-cell i, .stone3 .s3num, .w4name';
  async function run() {
    const els = [...document.querySelectorAll('body *')].filter((e) => !['SCRIPT', 'STYLE', 'svg', 'CANVAS', 'IMG'].includes(e.tagName) && vis(e));
    const cand = [];
    for (const el of els) {
      const cs = getComputedStyle(el);
      for (const [v, pseudo] of [[cs.borderImageSource, null], [cs.backgroundImage, null]]) {
        const u = urlOf(v); const k = u && keyOf(u); if (k) { cand.push({ el, cs, u, k, pseudo }); break; }
      }
      const b = getComputedStyle(el, '::before'); const ub = urlOf(b.backgroundImage), kb = ub && keyOf(ub);
      if (kb && b.position === 'absolute') cand.push({ el, cs: b, u: ub, k: kb, pseudo: { l: parseFloat(b.left) || 0, t: parseFloat(b.top) || 0, r: parseFloat(b.right) || 0, b: parseFloat(b.bottom) || 0 } });
    }
    for (const el of els) if (el.matches(BOXES) && !cand.some((c) => c.el === el)) cand.push({ el, cs: getComputedStyle(el), u: null, k: null });
    // 그림 원래 크기 받기
    await Promise.all(cand.filter((c) => c.u && !sizes[c.u]).map((c) => new Promise((res) => { const im = new Image(); im.onload = () => { sizes[c.u] = { w: im.naturalWidth, h: im.naturalHeight }; res(); }; im.onerror = res; im.src = c.u; })));
    const skip = new Set(cand.map((c) => c.el));
    const res = [];
    for (const c of cand) {
      const { el, cs } = c; const own = new Set(skip); own.delete(el);
      const ink0 = inkRects(el, own); if (!ink0.some((q) => !q.icon)) continue;
      const er = el.getBoundingClientRect(); if (er.right < 0 || er.left > innerWidth || er.bottom < 0 || er.top > innerHeight) continue;
      let face;
      const F = frame(el); if (!F) continue;
      if (c.k) face = faceRect(el, cs, c.u, c.k, c.pseudo, F);
      else { const s = getComputedStyle(el); face = { left: parseFloat(s.paddingLeft) + parseFloat(s.borderLeftWidth), right: F.w - parseFloat(s.paddingRight) - parseFloat(s.borderRightWidth), top: parseFloat(s.paddingTop) + parseFloat(s.borderTopWidth), bottom: F.h - parseFloat(s.paddingBottom) - parseFloat(s.borderBottomWidth) }; }
      if (!face) continue;
      const ink = ink0.map((q) => { const l = toLocal(F, q); if (!q.icon) l.bottom = l.top + (l.bottom - l.top) * 0.92; return l; });
      const t = { left: Math.min(...ink.map((q) => q.left)), right: Math.max(...ink.map((q) => q.right)), top: Math.min(...ink.map((q) => q.top)), bottom: Math.max(...ink.map((q) => q.bottom)) };
      // 화면에 보이는 크기 (zoom·transform 반영: getBoundingClientRect 기준이라 그대로)
      const K = F.k, over = { l: (face.left - t.left) * K, t: (face.top - t.top) * K, r: (t.right - face.right) * K, b: (t.bottom - face.bottom) * K };
      const off = { x: ((t.left + t.right) / 2 - (face.left + face.right) / 2) * K, y: ((t.top + t.bottom) / 2 - (face.top + face.bottom) / 2) * K };
      const clip = el.scrollWidth > el.clientWidth + 1 && /hidden|clip/.test(cs.overflowX || getComputedStyle(el).overflowX) || /ellipsis/.test(getComputedStyle(el).textOverflow) && el.scrollWidth > el.clientWidth + 1;
      const align = getComputedStyle(el).textAlign, multi = ink.filter((q) => !q.icon).length > 1 && new Set(ink.filter((q) => !q.icon).map((q) => Math.round(q.top))).size > 1;
      res.push({ who: document.documentElement.dataset.who, sel: sel(el), text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 40), img: c.k || '(칸)', fw: Math.round((face.right - face.left) * K), fh: Math.round((face.bottom - face.top) * K), fs: getComputedStyle(el).fontSize,
        over: Object.fromEntries(Object.entries(over).map(([a, b]) => [a, +b.toFixed(1)])), off: { x: +off.x.toFixed(1), y: +off.y.toFixed(1) }, clip, multi, align });
    }
    return res;
  }
  window.__textProbe = run;
})();
