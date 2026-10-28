'use strict';
// 다트 게임 그림 + 점수 계산
//  · GPT 그림(darts/assets, tools/darts_assets.py 로 만듦): 다트판 board · 다트 dart_0~2 · 배경 bg/port. 그림을 받기 전에는 코드로 그림
//  · 다트판: 진짜 다트판 순서 (위 20부터 시계 방향), 바깥부터 더블(2배) · 싱글 · 트리플(3배) · 싱글 · S-BULL(바깥 불 50) · D-BULL(가운데 불 50)
//  · 좌표: 판 가운데 (0,0), 더블 링 바깥 = 반지름 1 (아래가 +y)
//  · 링 반지름 R 은 GPT 다트판 그림(A01)에서 잰 값 (tools/darts_assets.py 가 출력) — 그림과 점수가 꼭 같아야 함
(function () {
  const BASE = (document.currentScript && document.currentScript.src.replace(/art\.js.*$/, '')) || '';
  const V = '?v=202610282106';
  const img = (n) => { const im = new Image(); im.src = `${BASE}assets/${n}.webp${V}`; return im; };
  const ok = (im) => im && im.complete && im.naturalWidth > 0;
  const IMG = { board: img('board'), bg: img('bg/port'), dart: [img('dart_0'), img('dart_1'), img('dart_2')] };
  const BOARD_DOUT = 368.4; // board.webp(1000px) 안 더블 링 바깥 반지름(px), 불 가운데 = 그림 가운데
  const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  // 반지름 (더블 바깥 = 1)
  const R = { bull: 0.06, outer: 0.127, tIn: 0.552, tOut: 0.617, dIn: 0.929, dOut: 1, num: 1.14, rim: 1.318 };

  // 점수: { pts, mult(0 바깥·1 싱글·2 더블·3 트리플), num(1~20, 25 = 바깥 불 S-BULL, 50 = 가운데 불 D-BULL — 둘 다 50점), ring, label }
  function score(x, y) {
    const r = Math.hypot(x, y);
    if (r <= R.bull) return { pts: 50, mult: 1, num: 50, ring: 'bull', label: 'D-BULL' };
    if (r <= R.outer) return { pts: 50, mult: 1, num: 25, ring: 'outer', label: 'S-BULL' };
    if (r > R.dOut) return { pts: 0, mult: 0, num: 0, ring: 'miss', label: 'OUT' };
    // 각도: 위(12시)가 0, 시계 방향으로 커짐. 칸 하나 18도, 20 칸은 -9~+9도
    let a = Math.atan2(x, -y) * 180 / Math.PI; if (a < 0) a += 360;
    const num = ORDER[Math.floor(((a + 9) % 360) / 18)];
    if (r >= R.dIn) return { pts: num * 2, mult: 2, num, ring: 'double', label: 'D' + num };
    if (r >= R.tIn && r <= R.tOut) return { pts: num * 3, mult: 3, num, ring: 'triple', label: 'T' + num };
    return { pts: num, mult: 1, num, ring: 'single', label: String(num) };
  }

  const COL = { dark: '#2B2B33', light: '#F6E9C8', red: '#E2384D', green: '#1F9A5A', rim: '#3A2A22', wire: '#C9CCD6' };
  function sector(g, r0, r1, a0, a1, col) {
    g.beginPath(); g.arc(0, 0, r1, a0, a1); g.arc(0, 0, r0, a1, a0, true); g.closePath(); g.fillStyle = col; g.fill();
  }
  // cx, cy: 가운데, s: 더블 링 바깥 반지름(px). hi: 반짝 칸 { num, ring } (맞힌 칸을 잠깐 빛나게)
  function board(g, cx, cy, s, o = {}) {
    if (ok(IMG.board)) { // GPT 그림 + 맞힌 칸 반짝
      const k = s / BOARD_DOUT, w = IMG.board.naturalWidth * k;
      g.drawImage(IMG.board, cx - w / 2, cy - w / 2, w, w);
      if (o.hi) {
        g.save(); g.translate(cx, cy); g.globalAlpha = o.hiA == null ? 0.6 : o.hiA;
        if (o.hi.num === 50 || o.hi.num === 25) { g.beginPath(); g.arc(0, 0, s * (o.hi.num === 50 ? R.bull : R.outer), 0, Math.PI * 2); g.fillStyle = '#FFF27A'; g.fill(); }
        else {
          const i = ORDER.indexOf(o.hi.num), a0 = (-90 - 9 + i * 18) * Math.PI / 180, a1 = a0 + Math.PI / 10;
          const r0 = o.hi.ring === 'double' ? R.dIn : o.hi.ring === 'triple' ? R.tIn : R.outer, r1 = o.hi.ring === 'triple' ? R.tOut : R.dOut;
          sector(g, s * r0, s * r1, a0, a1, '#FFF27A');
        }
        g.restore();
      }
      return;
    }
    g.save(); g.translate(cx, cy);
    // 바깥 나무 테두리 + 숫자 링
    g.beginPath(); g.arc(0, 4 * s / 200, s * R.rim, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.25)'; g.fill();
    g.beginPath(); g.arc(0, 0, s * R.rim, 0, Math.PI * 2);
    const gr = g.createRadialGradient(0, -s * 0.3, s * 0.2, 0, 0, s * R.rim); gr.addColorStop(0, '#6A4A36'); gr.addColorStop(1, COL.rim);
    g.fillStyle = gr; g.fill();
    g.beginPath(); g.arc(0, 0, s * 1.03, 0, Math.PI * 2); g.fillStyle = '#17171C'; g.fill();
    for (let i = 0; i < 20; i++) {
      const a0 = (-90 - 9 + i * 18) * Math.PI / 180, a1 = a0 + Math.PI / 10, even = i % 2 === 0;
      const base = even ? COL.dark : COL.light, ring = even ? COL.red : COL.green;
      sector(g, s * R.outer, s * R.dOut, a0, a1, base);
      sector(g, s * R.dIn, s * R.dOut, a0, a1, ring);
      sector(g, s * R.tIn, s * R.tOut, a0, a1, ring);
      if (o.hi && o.hi.num === ORDER[i]) { // 맞힌 칸 반짝
        const r0 = o.hi.ring === 'double' ? R.dIn : o.hi.ring === 'triple' ? R.tIn : R.outer, r1 = o.hi.ring === 'double' ? R.dOut : o.hi.ring === 'triple' ? R.tOut : R.dOut;
        g.globalAlpha = o.hiA == null ? 0.6 : o.hiA; sector(g, s * r0, s * r1, a0, a1, '#FFF27A'); g.globalAlpha = 1;
      }
    }
    g.beginPath(); g.arc(0, 0, s * R.outer, 0, Math.PI * 2); g.fillStyle = COL.green; g.fill();
    g.beginPath(); g.arc(0, 0, s * R.bull, 0, Math.PI * 2); g.fillStyle = COL.red; g.fill();
    if (o.hi && (o.hi.num === 50 || o.hi.num === 25)) {
      g.globalAlpha = o.hiA == null ? 0.6 : o.hiA; g.beginPath(); g.arc(0, 0, s * (o.hi.num === 50 ? R.bull : R.outer), 0, Math.PI * 2); g.fillStyle = '#FFF27A'; g.fill(); g.globalAlpha = 1;
    }
    // 철사
    g.strokeStyle = COL.wire; g.lineWidth = Math.max(1, s / 170);
    for (const r of [R.bull, R.outer, R.tIn, R.tOut, R.dIn, R.dOut]) { g.beginPath(); g.arc(0, 0, s * r, 0, Math.PI * 2); g.stroke(); }
    for (let i = 0; i < 20; i++) {
      const a = (-90 - 9 + i * 18) * Math.PI / 180;
      g.beginPath(); g.moveTo(Math.cos(a) * s * R.outer, Math.sin(a) * s * R.outer); g.lineTo(Math.cos(a) * s * R.dOut, Math.sin(a) * s * R.dOut); g.stroke();
    }
    // 숫자
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `${Math.round(s * 0.15)}px Jua, sans-serif`;
    for (let i = 0; i < 20; i++) {
      const a = (-90 + i * 18) * Math.PI / 180;
      g.fillText(ORDER[i], Math.cos(a) * s * R.num, Math.sin(a) * s * R.num + s * 0.005);
    }
    g.restore();
  }
  // 다트: (x, y)가 꽂힌 끝(바늘 끝). k: 크기(1 = 길이 약 74), col: 깃털 색 또는 0·1·2(분홍·노랑·파랑 그림), tilt: 기울기
  const DCOL = ['#FF5A8C', '#FFB21E', '#2F9AE8'];
  function dart(g, x, y, k, col = '#FF6B95', tilt = -0.5) {
    if (typeof col === 'number') {
      const im = IMG.dart[col];
      if (ok(im)) { const h = 80 * k, w = h * im.naturalWidth / im.naturalHeight; g.save(); g.translate(x, y); g.rotate(tilt); g.drawImage(im, -w / 2, -h, w, h); g.restore(); return; }
      col = DCOL[col];
    }
    g.save(); g.translate(x, y); g.rotate(tilt); g.scale(k, k);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(4, 3, 4, 2.5, 0, 0, Math.PI * 2); g.fill();
    // 바늘 · 몸통 · 깃털 (위쪽으로)
    g.fillStyle = '#D8DCE6'; g.fillRect(-1.4, -14, 2.8, 14);
    const bg = g.createLinearGradient(-5, 0, 5, 0); bg.addColorStop(0, '#8A8F9C'); bg.addColorStop(0.5, '#F2F4F8'); bg.addColorStop(1, '#8A8F9C');
    g.fillStyle = bg; g.beginPath(); if (g.roundRect) g.roundRect(-4.5, -40, 9, 27, 4); else g.rect(-4.5, -40, 9, 27); g.fill();
    g.fillStyle = '#5A5F6C'; for (let i = 0; i < 3; i++) g.fillRect(-4.5, -36 + i * 7, 9, 2);
    g.fillStyle = '#333'; g.fillRect(-1.2, -54, 2.4, 15);
    g.fillStyle = col; g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, -46); g.lineTo(-11, -64); g.lineTo(-10, -74); g.lineTo(0, -60); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(0, -46); g.lineTo(11, -64); g.lineTo(10, -74); g.lineTo(0, -60); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
  // 놀이공원 다트 부스 느낌 배경 (가로·세로 모두)
  function bg(g, W, H, t = 0) {
    if (ok(IMG.bg)) { const im = IMG.bg, sc = Math.max(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * sc, h = im.naturalHeight * sc; g.drawImage(im, (W - w) / 2, (H - h) / 2, w, h); return; }
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#FFE3B0'); gr.addColorStop(1, '#FFC98A'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // 세로 줄무늬 천막
    const sw = 60;
    for (let x = 0, i = 0; x < W; x += sw, i++) { if (i % 2) continue; g.fillStyle = 'rgba(255,120,140,.22)'; g.fillRect(x, 0, sw, H); }
    // 위 천막 물결
    g.fillStyle = '#FF6B8A';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, 26);
    for (let x = W; x >= 0; x -= 40) g.quadraticCurveTo(x - 20, 52, x - 40, 26);
    g.closePath(); g.fill();
    g.fillStyle = '#fff'; for (let x = 20; x < W; x += 80) { g.beginPath(); g.arc(x, 12, 5, 0, Math.PI * 2); g.fill(); }
    // 아래 나무 바닥
    g.fillStyle = '#C98B5A'; g.fillRect(0, H - 40, W, 40); g.fillStyle = 'rgba(0,0,0,.08)'; for (let x = 0; x < W; x += 70) g.fillRect(x, H - 40, 3, 40);
    // 반짝 전구
    for (let x = 30, i = 0; x < W; x += 60, i++) {
      const on = (Math.floor(t * 3) + i) % 3 === 0;
      g.beginPath(); g.arc(x, 44, 6, 0, Math.PI * 2); g.fillStyle = on ? '#FFF6A0' : '#FFD34D'; g.fill();
      if (on) { g.globalAlpha = 0.35; g.beginPath(); g.arc(x, 44, 13, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
    }
  }
  // 다트판 (x, y) 자리의 색 (조준 게이지에 판 모양을 그대로 보여 줄 때 씀). 판 밖은 회색
  function colorAt(x, y) {
    const r = Math.hypot(x, y);
    if (r <= R.bull) return COL.red;
    if (r <= R.outer) return COL.green;
    if (r > R.dOut) return '#B9B2C6';
    let a = Math.atan2(x, -y) * 180 / Math.PI; if (a < 0) a += 360;
    const even = Math.floor(((a + 9) % 360) / 18) % 2 === 0, ring = r >= R.dIn || (r >= R.tIn && r <= R.tOut);
    return ring ? (even ? COL.red : COL.green) : (even ? COL.dark : COL.light);
  }
  window.DartArt = { ORDER, R, score, board, dart, bg, colorAt };
})();
