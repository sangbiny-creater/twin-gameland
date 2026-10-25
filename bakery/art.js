'use strict';
// 달콤 베이커리 임시 그림 (코드로 그림) — GPT 그림이 오면 이 함수들만 그림 파일로 바꾸면 됨
//  · 모든 빵은 (x = 가운데, y = 컨베이어 윗면) 기준, s = 크기 (1 = 컵케이크 폭 약 92점)
//  · tools/bakery_placeholder.html 도 이 그림으로 게임 카드·인트로 임시 그림을 만듦
(function (root) {
  const OUT = '#6B3A1E';
  const CUPS = ['#FFB5C8', '#A8DCF5', '#C9B8FF', '#FFE08A', '#B9E8B0'];
  const TOPS = ['cherry', 'berry', 'sprinkle', 'cherry', 'choco'];

  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function line(g, w = 3) { g.lineWidth = w; g.strokeStyle = OUT; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }

  // 생크림 한 덩이 (회오리 3단). k: 0~1 짜지는 정도, col: 크림 색
  function swirl(g, x, y, s, k, col = '#FFFDF7', shade = '#F1DCCB') {
    if (k <= 0) return;
    const tiers = [[46, 20], [36, 18], [24, 16]];
    let yy = y;
    for (let i = 0; i < 3; i++) {
      const kk = Math.max(0, Math.min(1, k * 3 - i)); if (kk <= 0) break;
      const [w, h] = tiers[i], ww = w * s * (0.6 + 0.4 * kk), hh = h * s * kk;
      g.beginPath(); g.ellipse(x, yy - hh / 2, ww, hh / 2 + 4 * s, 0, 0, Math.PI * 2);
      g.fillStyle = col; g.fill(); line(g, 2.5 * s);
      g.beginPath(); g.ellipse(x - ww * 0.15, yy - hh * 0.62, ww * 0.6, hh * 0.18, 0, Math.PI * 0.1, Math.PI * 0.9, true);
      g.strokeStyle = shade; g.lineWidth = 3 * s; g.stroke();
      yy -= hh * 0.78;
    }
    if (k >= 1) { // 뾰족한 끝
      g.beginPath(); g.moveTo(x - 9 * s, yy + 2 * s); g.quadraticCurveTo(x - 2 * s, yy - 14 * s, x + 4 * s, yy - 18 * s); g.quadraticCurveTo(x + 2 * s, yy - 6 * s, x + 9 * s, yy + 2 * s);
      g.fillStyle = col; g.fill(); line(g, 2.5 * s);
    }
    return yy;
  }
  function topping(g, kind, x, y, s) {
    if (kind === 'cherry' || kind === 'berry') {
      g.beginPath(); g.moveTo(x + 2 * s, y - 10 * s); g.quadraticCurveTo(x + 8 * s, y - 24 * s, x + 16 * s, y - 26 * s); line(g, 2.5 * s);
      g.beginPath(); g.arc(x, y - 4 * s, 10 * s, 0, Math.PI * 2); g.fillStyle = kind === 'cherry' ? '#F0405A' : '#E8456A'; g.fill(); line(g, 2.5 * s);
      g.beginPath(); g.arc(x - 3.5 * s, y - 7.5 * s, 3 * s, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.8)'; g.fill();
    } else if (kind === 'choco') {
      g.save(); g.translate(x, y - 6 * s); g.rotate(-0.3); rr(g, -4 * s, -14 * s, 8 * s, 26 * s, 3 * s); g.fillStyle = '#6B3A1E'; g.fill(); g.restore();
      g.beginPath(); g.arc(x + 8 * s, y - 2 * s, 7 * s, 0, Math.PI * 2); g.fillStyle = '#F0405A'; g.fill(); line(g, 2 * s);
    } else {
      const cs = ['#FF6B8B', '#5CA9E6', '#FFD34D', '#7BD87B', '#B28DFF'];
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4, r = (i % 3) * 9 * s + 4 * s;
        g.save(); g.translate(x + Math.cos(a) * r, y + 14 * s + Math.sin(a) * r * 0.5); g.rotate(a);
        rr(g, -5 * s, -1.6 * s, 10 * s, 3.2 * s, 1.6 * s); g.fillStyle = cs[i % 5]; g.fill(); g.restore();
      }
    }
  }
  // 컵케이크. o: { v(색 번호), cream(0~1), burnt, gold, heart(하트 컵케이크), top }
  function cupcake(g, x, y, s, o = {}) {
    const v = o.v || 0;
    const cupCol = o.burnt ? '#9C9AA5' : o.gold ? '#FFCF3D' : o.heart ? '#FF7FA2' : CUPS[v % CUPS.length];
    const domeCol = o.burnt ? '#3A2A22' : o.gold ? '#F2B53A' : '#D59050';
    // 그림자
    g.beginPath(); g.ellipse(x, y - 1, 38 * s, 7 * s, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.18)'; g.fill();
    // 컵
    const tw = 42 * s, bw = 32 * s, ch = 44 * s, top = y - ch;
    g.beginPath(); g.moveTo(x - tw, top); g.lineTo(x + tw, top); g.lineTo(x + bw, y - 2 * s); g.lineTo(x - bw, y - 2 * s); g.closePath();
    g.fillStyle = cupCol; g.fill();
    g.save(); g.clip(); g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 5 * s;
    for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(x + i * 12 * s, top); g.lineTo(x + i * 9 * s, y); g.stroke(); }
    if (o.gold) { g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(x - tw, top + 6 * s, tw * 2, 6 * s); }
    g.restore();
    if (o.heart) heart(g, x, top + 22 * s, 11 * s, true, '#FFFFFF');
    g.beginPath(); g.moveTo(x - tw, top); g.lineTo(x + tw, top); g.lineTo(x + bw, y - 2 * s); g.lineTo(x - bw, y - 2 * s); g.closePath(); line(g, 3 * s);
    // 빵 지붕
    g.beginPath(); g.moveTo(x - 46 * s, top + 2 * s); g.bezierCurveTo(x - 48 * s, top - 34 * s, x + 48 * s, top - 34 * s, x + 46 * s, top + 2 * s); g.closePath();
    g.fillStyle = domeCol; g.fill(); line(g, 3 * s);
    if (!o.burnt) { g.beginPath(); g.ellipse(x - 16 * s, top - 14 * s, 13 * s, 5 * s, -0.3, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill(); }
    let creamTop = top - 22 * s;
    if (o.burnt) { // 탄 자국·연기
      g.strokeStyle = '#1C1410'; g.lineWidth = 3 * s;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x - 24 * s + i * 20 * s, top - 6 * s); g.lineTo(x - 16 * s + i * 20 * s, top - 14 * s); g.stroke(); }
      const tt = (o.t || 0);
      for (let i = 0; i < 3; i++) {
        const k = ((tt * 0.8 + i / 3) % 1);
        g.beginPath(); g.arc(x - 14 * s + i * 14 * s + Math.sin(k * 6 + i) * 6 * s, top - 30 * s - k * 46 * s, (8 + k * 10) * s, 0, Math.PI * 2);
        g.fillStyle = `rgba(110,110,120,${0.55 * (1 - k)})`; g.fill();
      }
    }
    if (o.cream > 0) {
      const yy = swirl(g, x, top - 18 * s, s, o.cream, o.gold ? '#FFF6D0' : '#FFFDF7');
      if (o.cream >= 1 && yy != null) { if (o.heart) heart(g, x + 2 * s, yy - 16 * s, 14 * s, true); else topping(g, o.top || TOPS[v % TOPS.length], x + 2 * s, yy - 12 * s, s); }
      creamTop = yy;
    }
    if (o.gold) sparkle(g, x + 34 * s, top - 26 * s, 9 * s, o.t || 0);
    if (o.heart && !(o.cream > 0)) heart(g, x, top - 52 * s + Math.sin((o.t || 0) * 5) * 4 * s, 16 * s, true); // 떠 있는 하트
    return creamTop;
  }
  function sparkle(g, x, y, r, t) {
    const k = 0.7 + 0.3 * Math.sin(t * 8);
    g.save(); g.translate(x, y); g.scale(k, k); g.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr2 = i % 2 ? r * 0.3 : r; g.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
    g.closePath(); g.fillStyle = '#FFFBE0'; g.fill(); g.strokeStyle = '#E8A800'; g.lineWidth = 1.5; g.stroke(); g.restore();
  }
  // 빈 접시
  function plate(g, x, y, s) {
    g.beginPath(); g.ellipse(x, y - 1, 46 * s, 8 * s, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.16)'; g.fill();
    g.beginPath(); g.ellipse(x, y - 9 * s, 48 * s, 13 * s, 0, 0, Math.PI * 2); g.fillStyle = '#FFFFFF'; g.fill(); line(g, 3 * s);
    g.beginPath(); g.ellipse(x, y - 10 * s, 30 * s, 7 * s, 0, 0, Math.PI * 2); g.strokeStyle = '#BFD8EE'; g.lineWidth = 3 * s; g.stroke();
    g.fillStyle = '#D59050'; [[-14, -10], [10, -8], [2, -12]].forEach(([a, b]) => { g.beginPath(); g.arc(x + a * s, y + b * s, 2.5 * s, 0, Math.PI * 2); g.fill(); });
  }
  // 긴 빵: x0(앞 끝) ~ x1(뒤 끝). kind 0 롤케이크 · 1 에클레어. cream: [c0, c1] 크림이 올라간 x 구간 (없으면 null). done: 다 짜면 딸기
  function longBread(g, x0, x1, y, s, kind, cream, done) {
    const h = (kind ? 40 : 54) * s, top = y - h - 2 * s, w = x1 - x0;
    g.beginPath(); g.ellipse((x0 + x1) / 2, y - 1, w / 2 + 6 * s, 8 * s, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.16)'; g.fill();
    rr(g, x0, top, w, h, Math.min(h / 2, w / 2));
    if (kind) {
      g.fillStyle = '#E2A55A'; g.fill(); line(g, 3 * s);
      g.save(); rr(g, x0, top, w, h * 0.5, Math.min(h / 2, w / 2)); g.fillStyle = '#7A4220'; g.fill(); g.restore(); // 초콜릿 윗면
      g.beginPath(); g.moveTo(x0 + 14 * s, top + 8 * s); g.lineTo(x1 - 14 * s, top + 8 * s); g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 4 * s; g.stroke();
    } else {
      g.fillStyle = '#F2C27A'; g.fill(); line(g, 3 * s);
      g.save(); rr(g, x0, top, w, h, Math.min(h / 2, w / 2)); g.clip();
      g.fillStyle = 'rgba(190,110,50,.35)'; g.fillRect(x0, top, w, h * 0.3);
      g.restore();
      // 앞쪽 끝 회오리 단면
      g.beginPath(); g.ellipse(x0 + h * 0.42, top + h / 2, h * 0.36, h * 0.44, 0, 0, Math.PI * 2); g.fillStyle = '#FFF4E4'; g.fill(); line(g, 2.5 * s);
      g.beginPath(); for (let a = 0; a < Math.PI * 5; a += 0.3) { const r = a / (Math.PI * 5) * h * 0.32; g.lineTo(x0 + h * 0.42 + Math.cos(a) * r * 0.82, top + h / 2 + Math.sin(a) * r); }
      g.strokeStyle = '#E39A5A'; g.lineWidth = 3 * s; g.stroke();
    }
    if (cream && cream[1] > cream[0]) creamRope(g, Math.max(x0 + 4 * s, cream[0]), Math.min(x1 - 4 * s, cream[1]), top + 4 * s, s);
    if (done) for (let xx = x0 + 34 * s; xx < x1 - 20 * s; xx += 64 * s) topping(g, 'cherry', xx, top - 14 * s, s * 0.9);
    return top;
  }
  // 빵 위 생크림 줄 (뭉게뭉게)
  function creamRope(g, a, b, y, s) {
    const r = 11 * s;
    g.beginPath(); g.moveTo(a, y);
    for (let x = a; x < b; x += r * 1.4) { const nx = Math.min(b, x + r * 1.4); g.quadraticCurveTo((x + nx) / 2, y - r * 1.9, nx, y); }
    g.lineTo(b, y + 3 * s); g.lineTo(a, y + 3 * s); g.closePath();
    g.fillStyle = '#FFFDF7'; g.fill(); line(g, 2.5 * s);
  }
  // 짤주머니: (x, tipY) = 깍지 끝. sq: 0~1 누르는 정도
  function bag(g, x, tipY, s, sq = 0, col = '#FFC2D4') {
    const H = 150 * s * (1 - sq * 0.08), Wt = 64 * s * (1 + sq * 0.12);
    // 깍지
    g.beginPath(); g.moveTo(x - 9 * s, tipY - 2 * s); g.lineTo(x + 9 * s, tipY - 2 * s); g.lineTo(x + 14 * s, tipY - 24 * s); g.lineTo(x - 14 * s, tipY - 24 * s); g.closePath();
    g.fillStyle = '#C9D3DE'; g.fill(); line(g, 2.5 * s);
    for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(x + i * 5 * s, tipY - 4 * s); g.lineTo(x + i * 8 * s, tipY - 22 * s); g.strokeStyle = '#8E9AA8'; g.lineWidth = 2 * s; g.stroke(); }
    // 천 주머니
    const b0 = tipY - 22 * s;
    g.beginPath(); g.moveTo(x - 13 * s, b0); g.quadraticCurveTo(x - Wt * 1.05, b0 - H * 0.55, x - Wt * 0.55, b0 - H); g.lineTo(x + Wt * 0.55, b0 - H); g.quadraticCurveTo(x + Wt * 1.05, b0 - H * 0.55, x + 13 * s, b0); g.closePath();
    g.fillStyle = col; g.fill(); line(g, 3 * s);
    g.beginPath(); g.moveTo(x - Wt * 0.3, b0 - H * 0.85); g.quadraticCurveTo(x - Wt * 0.6, b0 - H * 0.5, x - 10 * s, b0 - 10 * s); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 6 * s; g.stroke();
    // 꼬인 윗부분
    g.beginPath(); g.ellipse(x, b0 - H - 6 * s, Wt * 0.5, 10 * s, 0, 0, Math.PI * 2); g.fillStyle = col; g.fill(); line(g, 3 * s);
    g.beginPath(); g.moveTo(x - 8 * s, b0 - H - 12 * s); g.quadraticCurveTo(x, b0 - H - 34 * s, x + 12 * s, b0 - H - 30 * s); line(g, 5 * s); g.strokeStyle = col; g.lineWidth = 2.5 * s; g.stroke();
    // 하트 무늬
    g.save(); g.translate(x, b0 - H * 0.52); g.scale(s, s);
    g.beginPath(); g.moveTo(0, 8); g.bezierCurveTo(-16, -2, -10, -16, 0, -8); g.bezierCurveTo(10, -16, 16, -2, 0, 8); g.fillStyle = '#FF6B8B'; g.fill(); g.restore();
  }
  // 깍지에서 나오는 크림 줄기
  function stream(g, x, y0, y1, s) {
    if (y1 <= y0) return;
    rr(g, x - 7 * s, y0, 14 * s, y1 - y0, 7 * s); g.fillStyle = '#FFFDF7'; g.fill(); line(g, 2 * s);
  }
  // 컨베이어: 윗면 y, 두께 h, 무늬 off
  function belt(g, W, y, h, off, s = 1) {
    g.fillStyle = '#8C93A8'; g.fillRect(0, y + h - 6 * s, W, 26 * s);  // 받침
    g.fillStyle = '#4A4F63'; g.fillRect(0, y, W, h);
    g.save(); g.beginPath(); g.rect(0, y, W, h); g.clip();
    g.fillStyle = '#5C6278';
    const step = 40 * s, o = ((off % step) + step) % step;
    for (let x = -o; x < W + step; x += step) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 18 * s, y); g.lineTo(x + 8 * s, y + h); g.lineTo(x - 10 * s, y + h); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, y, W, 4 * s);
    g.restore();
    g.fillStyle = '#B9C0D0'; g.fillRect(0, y + h, W, 8 * s);
    g.fillStyle = '#6E7489';
    for (let x = ((-off * 0.999) % (60 * s)) - 60 * s; x < W + 60 * s; x += 60 * s) { g.beginPath(); g.arc(x, y + h + 18 * s, 9 * s, 0, Math.PI * 2); g.fill(); }
  }
  // 빵집 벽·창문·선반 (배경). floorY 아래는 바닥 타일
  function backdrop(g, W, H, floorY, t = 0) {
    const wall = g.createLinearGradient(0, 0, 0, floorY);
    wall.addColorStop(0, '#FFE6EE'); wall.addColorStop(1, '#FFD3DF');
    g.fillStyle = wall; g.fillRect(0, 0, W, floorY);
    g.fillStyle = 'rgba(255,255,255,.45)';
    for (let x = 0; x < W; x += 56) g.fillRect(x, 0, 24, floorY);
    // 창문
    const ww = Math.min(260, W * 0.4), wx = W * 0.62 - ww / 2, wy = floorY * 0.16, wh = floorY * 0.34;
    rr(g, wx - 10, wy - 10, ww + 20, wh + 20, 22); g.fillStyle = '#FFFFFF'; g.fill(); line(g, 4);
    rr(g, wx, wy, ww, wh, 14); const sky = g.createLinearGradient(0, wy, 0, wy + wh); sky.addColorStop(0, '#8FD0FF'); sky.addColorStop(1, '#D8F1FF'); g.fillStyle = sky; g.fill();
    g.save(); rr(g, wx, wy, ww, wh, 14); g.clip();
    g.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { const cx = wx + ((i * 110 + t * 12) % (ww + 120)) - 60, cy = wy + 30 + i * 24; g.beginPath(); g.arc(cx, cy, 16, 0, 7); g.arc(cx + 18, cy - 8, 20, 0, 7); g.arc(cx + 38, cy, 15, 0, 7); g.fill(); }
    g.restore();
    g.fillStyle = '#FFFFFF'; g.fillRect(wx + ww / 2 - 4, wy, 8, wh); g.fillRect(wx, wy + wh / 2 - 4, ww, 8);
    // 차양
    const aw = ww + 50, ax = wx - 25;
    for (let i = 0; i < 7; i++) { const sx = ax + i * aw / 7; g.beginPath(); g.moveTo(sx, wy - 26); g.lineTo(sx + aw / 7, wy - 26); g.lineTo(sx + aw / 7, wy - 6); g.arc(sx + aw / 14, wy - 6, aw / 14, 0, Math.PI); g.closePath(); g.fillStyle = i % 2 ? '#FFFFFF' : '#FF8FAE'; g.fill(); line(g, 2.5); }
    // 선반 (왼쪽 위)
    const sx = W * 0.06, sy = floorY * 0.3, sw = Math.min(200, W * 0.3);
    g.fillStyle = '#C98B5A'; g.fillRect(sx, sy, sw, 12); g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(sx, sy, sw, 12);
    const jar = ['#FFB5C8', '#FFE08A', '#A8DCF5'];
    for (let i = 0; i < 3; i++) { const jx = sx + 22 + i * (sw - 44) / 2; rr(g, jx - 18, sy - 44, 36, 44, 8); g.fillStyle = 'rgba(255,255,255,.75)'; g.fill(); line(g, 2.5); rr(g, jx - 14, sy - 30, 28, 26, 6); g.fillStyle = jar[i]; g.fill(); rr(g, jx - 20, sy - 52, 40, 10, 4); g.fillStyle = '#E87A9A'; g.fill(); line(g, 2.5); }
    // 바닥
    g.fillStyle = '#F7E3C8'; g.fillRect(0, floorY, W, H - floorY);
    g.fillStyle = '#EED2AE';
    for (let y = floorY, r = 0; y < H; y += 44, r++) for (let x = (r % 2) * 44; x < W; x += 88) g.fillRect(x, y, 44, 44);
  }
  // 하트
  function heart(g, x, y, r, on = true, fill) {
    g.save(); g.translate(x, y); g.scale(r / 16, r / 16);
    g.beginPath(); g.moveTo(0, 12); g.bezierCurveTo(-22, -2, -14, -20, 0, -9); g.bezierCurveTo(14, -20, 22, -2, 0, 12); g.closePath();
    g.fillStyle = fill || (on ? '#FF5A7A' : '#B8B2C8'); g.fill(); g.lineWidth = 3; g.strokeStyle = on ? '#A8203E' : '#6E6880'; g.stroke(); g.restore();
  }
  root.BakeryArt = { cupcake, plate, longBread, bag, stream, belt, backdrop, swirl, topping, sparkle, heart, creamRope, CUPS };
})(typeof window !== 'undefined' ? window : globalThis);
