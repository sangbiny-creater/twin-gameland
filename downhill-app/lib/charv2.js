'use strict';
// [다운힐 앱 전용] common/charv2.js 를 줄인 것: 은유 v3·은결 v3 의 '겨울옷' 포즈 묶음(lib/chars/<look>_winter)만 씀
//  그리는 방법(발 위치·몸 높이 비율)은 원본과 같음
(function () {
  const LOOKS = { eunyu3: { base: 'eunyu', name: '은유' }, eungyeol3: { base: 'eungyeol', name: '은결' } };
  const BODY_H = 393 / 512, FOOT = 488 / 512;
  const atlas = {};
  function load(look) {
    if (!LOOKS[look] || atlas[look]) return atlas[look] && atlas[look].p;
    const a = atlas[look] = { img: new Image(), f: null, ok: false };
    a.p = fetch(`lib/chars/${look}_winter.json?v=202611210024`).then((r) => r.json()).then((j) => new Promise((done, fail) => {
      a.f = j.frames;
      a.img.onload = () => { const on = () => { stepB(look, a); a.ok = true; done(); }; if (a.img.decode) a.img.decode().then(on, on); else on(); };
      a.img.onerror = fail; a.img.src = `lib/chars/${look}_winter.webp?v=202611210024`;
    })).catch(() => { /* 그림이 없으면 예전 그림으로 */ });
    return a.p;
  }
  // 겨울옷 달리기 그림 2장(back_run_0·1)이 둘 다 같은 쪽 다리를 들고 있어서 한 발로 뛰는 것처럼 보임
  //  → back_run_0 의 다리 부분(허리 아래)만 좌우로 뒤집은 그림을 만들어 back_run_1 로 씀 (윗몸·가방은 그대로라 깜빡이지 않음)
  const LEG_Y = { eunyu3: 330, eungyeol3: 300 }; // 512 캔버스에서 다리가 시작하는 높이
  function stepB(look, a) {
    try {
      const f = a.f.back_run_0; if (!f || !LEG_Y[look]) return;
      const [x, y, w, h, ox, oy, cw, ch] = f, c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.drawImage(a.img, x, y, w, h, 0, 0, w, h);
      const sy = Math.max(0, Math.min(h, LEG_Y[look] - oy)), d = g.getImageData(0, sy, w, h - sy).data;
      let lo = w, hi = 0; // 다리 부분의 가운데 (뒤집는 축)
      for (let r = 0; r < h - sy; r++) for (let q = 0; q < w; q++) if (d[(r * w + q) * 4 + 3] > 40) { if (q < lo) lo = q; if (q > hi) hi = q; }
      if (hi <= lo) return;
      const mid = (lo + hi) / 2;
      g.clearRect(0, sy, w, h - sy);
      g.save(); g.translate(2 * mid, 0); g.scale(-1, 1); g.drawImage(a.img, x, y + sy, w, h - sy, 0, sy, w, h - sy); g.restore();
      a.extra = { back_run_1: { img: c, f: [0, 0, w, h, ox, oy, cw, ch] } };
    } catch (e) { /* 그대로 */ }
  }
  const get = (look, name) => {
    const a = atlas[look]; if (!a || !a.ok) return null;
    if (a.extra && a.extra[name]) return [a.extra[name], a.extra[name].f];
    return a.f[name] ? [a, a.f[name]] : null;
  };
  window.CharV2 = {
    LOOKS,
    is: (look) => !!LOOKS[look],
    base: (look) => (LOOKS[look] ? LOOKS[look].base : look),
    load,
    ready: (look) => !!(atlas[look] && atlas[look].ok),
    has: (look, name) => !!get(look, name),
    draw(g, look, name, o = {}) {
      const hit = get(look, name); if (!hit) return false;
      const [a, [x, y, w, h, ox, oy, cw, ch]] = hit;
      const s = (o.h || 118) / (BODY_H * ch);
      const top = -FOOT * ch * s;
      g.save();
      if (o.alpha != null) g.globalAlpha *= o.alpha;
      if (o.rot) g.rotate(o.rot);
      if (o.flip) g.scale(-1, 1);
      g.drawImage(a.img, x, y, w, h, -cw * s / 2 + ox * s, top + oy * s, w * s, h * s);
      g.restore();
      return true;
    },
    // <img>에 넣을 그림 (결과 화면·캐릭터 고르기)
    url(look, name) {
      const hit = get(look, name); if (!hit) return '';
      const [a, [x, y, w, h]] = hit; const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(a.img, x, y, w, h, 0, 0, w, h); return c.toDataURL();
    },
  };
})();
