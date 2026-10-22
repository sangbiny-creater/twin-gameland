'use strict';
// 캐릭터 꾸미기: 입은 옷 그림을 게임 화면에 그리는 공용 도우미.
// 옷마다 그림이 한 장(정면 포즈)이라, 동작은 흔들기·기울이기·통통 튀기로 표현한다.
// 사용: Costume.ready() 가 true면 Costume.draw(ctx, pose, t, { h, flip }) — (0,0)이 발 위치
(function () {
  const Hub = window.Hub;
  const c = Hub && Hub.active();
  const src = c && Hub.costumeImg(c, '../');
  const img = new Image();
  let ok = false;
  if (src) { img.onload = () => { ok = true; }; img.src = src; }

  const Costume = {
    id: c ? Hub.costume(c) : null,
    src,
    img,
    ready() { return ok; },
    // pose: idle | run | jump | fall | swing | hit | land | happy | cheer | dizzy | dead
    draw(g, pose, t, o = {}) {
      if (!ok) return false;
      const h = o.h || 118, w = h * img.naturalWidth / img.naturalHeight;
      let dx = 0, dy = 0, rot = 0, sx = 1, sy = 1, hang = false;
      switch (pose) {
        case 'run': dy = -Math.abs(Math.sin(t * 16)) * 5; rot = Math.sin(t * 16) * 0.07; break;
        case 'jump': rot = -0.12; sx = 0.95; sy = 1.05; break;
        case 'fall': rot = 0.12; break;
        case 'swing': hang = true; rot = Math.sin(t * 5) * 0.05; break;
        case 'hit': case 'hurt': rot = -0.35; dx = -6; break;
        case 'land': sx = 1.08; sy = 0.92; break;
        case 'happy': case 'cheer': dy = -Math.abs(Math.sin(t * 8)) * 10; break;
        case 'dizzy': rot = Math.sin(t * 10) * 0.2; break;
        case 'dead': rot = 0.5; break;
        default: dy = Math.sin(t * 3) * 1.5;
      }
      g.save();
      g.translate(dx, dy);
      if (o.flip) g.scale(-1, 1);
      if (hang) { g.translate(0, o.hangTop != null ? o.hangTop : -100); g.rotate(rot); g.scale(sx, sy); g.drawImage(img, -w / 2, 0, w, h); }
      else { g.rotate(rot); g.scale(sx, sy); g.drawImage(img, -w / 2, -h, w, h); }
      g.restore();
      return true;
    },
    // 얼굴만 (윗부분) — 헬리콥터 창문·사천성 타일용
    drawBust(g, x, y, w, frac = 0.55) {
      if (!ok) return false;
      const sw = img.naturalWidth, sh = img.naturalHeight * frac;
      const h = w * sh / sw;
      g.drawImage(img, 0, 0, sw, sh, x - w / 2, y - h / 2, w, h);
      return true;
    },
  };
  window.Costume = Costume;
})();
