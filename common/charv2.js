'use strict';
// 새 캐릭터(v2) 그림: common/chars/<look>.webp + .json (tools/build_char_v2.py로 만듦)
// 포즈 이름은 캐릭터 제작 기준 v2 그대로: idle, ready, run_0~5, jump_up, jump_down, land, swing_0~1, hit, dizzy,
// happy, cheer, dead, back_run_0~1, back_left, back_right, back_hit, back_happy, back_dead, back_boost,
// heli_0~2, heli_happy, heli_hurt, heli_crash, tile_face, face_base|happy|sad|hurt
// 몸 그림은 512 캔버스 기준 발이 아래 488px, 몸 높이 393px로 맞춰져 있어서 같은 비율로 그리면 발이 땅에 붙음
(function () {
  // 게임에 쓸 수 있는 v2 캐릭터 (base: 같은 계열 기본 캐릭터 — 색·예비 그림에 씀)
  const LOOKS = {};
  for (const l of window.CHAR_LOOKS || []) if (l.atlas) LOOKS[l.look] = { base: l.base, name: l.name };
  const BODY_H = 393 / 512, FOOT = 488 / 512;
  const base = (document.currentScript && document.currentScript.src.replace(/common\/charv2\.js.*$/, '')) || '../';
  const atlas = {};
  function load(look) {
    if (!LOOKS[look] || atlas[look]) return;
    const a = atlas[look] = { img: new Image(), f: null, ok: false };
    fetch(`${base}common/chars/${look}.json?v=202610251706`).then((r) => r.json()).then((j) => {
      a.f = j.frames; a.img.onload = () => { a.ok = true; }; a.img.src = `${base}common/chars/${look}.webp?v=202610251706`;
    }).catch(() => { /* 그림이 없으면 기본 그림으로 */ });
  }
  const get = (look, name) => { const a = atlas[look]; return a && a.ok && a.f[name] ? [a, a.f[name]] : null; };
  const CharV2 = {
    LOOKS,
    is: (look) => !!LOOKS[look],
    base: (look) => (LOOKS[look] ? LOOKS[look].base : look),
    load,
    ready: (look) => !!(atlas[look] && atlas[look].ok),
    has: (look, name) => !!get(look, name),
    // run_0, run_1 … 처럼 번호 붙은 그림이 몇 장 있는지 (v2는 달리기 6장, v4는 8장)
    count(look, prefix) { let n = 0; while (get(look, prefix + n)) n++; return n; },
    // 발이 (0,0)에 오게 그림. h: 몸 높이(px). anchor 'hang'이면 손(줄 잡는 곳)이 hangTop에 옴
    draw(g, look, name, o = {}) {
      const hit = get(look, name); if (!hit) return false;
      const [a, [x, y, w, h, ox, oy, cw, ch, hand, handY, ropeAng]] = hit;
      const s = (o.h || 118) / (BODY_H * ch);
      if (o.anchor === 'hand') { // 줄 잡는 점이 (0,0), 그림 속 줄이 위쪽(-y)을 향하게 돌려서 그림
        g.save(); if (o.rot) g.rotate(o.rot); g.rotate(-(ropeAng || 0));
        g.drawImage(a.img, x, y, w, h, (ox - hand) * s, (oy - handY) * s, w * s, h * s);
        g.restore(); return true;
      }
      // 매달리기: 손 x를 handX(기본 0)에 맞춰서 줄 끝과 손이 붙어 보이게
      const dx = o.anchor === 'hang' && hand != null ? (o.handX || 0) - (hand - cw / 2) * s : 0;
      // 매달리기: 그림 맨 위(줄 잡은 손)가 hangTop에 오게
      const top = o.anchor === 'hang' ? (o.hangTop != null ? o.hangTop : -100) - oy * s : -FOOT * ch * s;
      g.save();
      if (o.alpha != null) g.globalAlpha *= o.alpha;
      if (o.rot) g.rotate(o.rot);
      if (o.flip) g.scale(-1, 1);
      g.drawImage(a.img, x, y, w, h, dx - cw * s / 2 + ox * s, top + oy * s, w * s, h * s);
      g.restore();
      return true;
    },
    // 가운데 기준 (헬리콥터·타일): w = 원래 캔버스 폭(px)
    drawCenter(g, look, name, cx, cy, wpx, o = {}) {
      const hit = get(look, name); if (!hit) return false;
      const [a, [x, y, w, h, ox, oy, cw, ch]] = hit;
      const s = wpx / cw;
      g.save(); g.translate(cx, cy);
      if (o.alpha != null) g.globalAlpha *= o.alpha;
      if (o.rot) g.rotate(o.rot);
      g.drawImage(a.img, x, y, w, h, -cw * s / 2 + ox * s, -ch * s / 2 + oy * s, w * s, h * s);
      g.restore();
      return true;
    },
    // 결과 화면 등 <img>에 넣을 그림
    url(look, name) {
      const hit = get(look, name); if (!hit) return '';
      const [a, [x, y, w, h]] = hit; const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(a.img, x, y, w, h, 0, 0, w, h); return c.toDataURL();
    },
  };
  window.CharV2 = CharV2;
  // 지금 캐릭터가 v2면 미리 불러 둠
  try { const c = window.Hub && window.Hub.active(); if (c) load(c.look); } catch (e) { /* ignore */ }
})();
