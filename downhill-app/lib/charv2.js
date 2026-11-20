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
    a.p = fetch(`lib/chars/${look}_winter.json?v=202611202134`).then((r) => r.json()).then((j) => new Promise((done, fail) => {
      a.f = j.frames;
      a.img.onload = () => { const on = () => { a.ok = true; done(); }; if (a.img.decode) a.img.decode().then(on, on); else on(); };
      a.img.onerror = fail; a.img.src = `lib/chars/${look}_winter.webp?v=202611202134`;
    })).catch(() => { /* 그림이 없으면 예전 그림으로 */ });
    return a.p;
  }
  const get = (look, name) => { const a = atlas[look]; return a && a.ok && a.f[name] ? [a, a.f[name]] : null; };
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
