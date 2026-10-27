'use strict';
// 멍멍이 간식 타임 그림 — 지금은 코드로 그린 임시 그림 (GPT 그림이 오면 이 함수들만 그림 파일로 바꾸면 됨)
//  · 강아지 3마리 (캐릭터 레퍼런스 그림 기준): 0 아리(은유의 시츄) · 1 콩이(새 친구, 갈색 아기 푸들) · 2 포미(은결의 크림 포메라니안)
//  · 간식: 뼈다귀 과자(톡) · 금빛 뼈다귀 · 줄줄이 소시지(꾹) / 함정: 양파 · 초콜릿 (강아지가 먹으면 안 됨)
//  · 모든 그림은 (x, y) = 가운데, s = 크기 (1 = 뼈다귀 폭 약 84점)
(function (root) {
  const OUT = '#5B3A22';
  const line = (g, w) => { g.lineWidth = w; g.strokeStyle = OUT; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); };
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  // 뼈다귀 과자
  function bone(g, x, y, s, o = {}) {
    const c = o.gold ? '#FFD34D' : '#F2C98A', sh = o.gold ? '#E8A800' : '#D9A35E';
    g.save(); g.translate(x, y); g.rotate(-0.25);
    g.beginPath(); g.ellipse(0, 30 * s, 34 * s, 6 * s, 0.25, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.15)'; g.fill();
    g.beginPath();
    rr(g, -28 * s, -9 * s, 56 * s, 18 * s, 6 * s);
    for (const [dx, dy] of [[-30, -10], [-30, 10], [30, -10], [30, 10]]) { g.moveTo(dx * s + 12 * s, dy * s); g.arc(dx * s, dy * s, 12 * s, 0, Math.PI * 2); }
    g.fillStyle = c; g.fill('nonzero'); line(g, 3 * s);
    g.fillStyle = c; rr(g, -26 * s, -7 * s, 52 * s, 14 * s, 5 * s); g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)'; rr(g, -20 * s, -5 * s, 30 * s, 4 * s, 2 * s); g.fill();
    g.fillStyle = sh; for (const dx of [-10, 2, 14]) { g.beginPath(); g.arc(dx * s, 2 * s, 1.8 * s, 0, 7); g.fill(); }
    if (o.gold) { sparkle(g, 26 * s, -24 * s, 8 * s, o.t || 0); sparkle(g, -30 * s, 22 * s, 6 * s, (o.t || 0) + 1); }
    g.restore();
  }
  function sparkle(g, x, y, r, t) {
    const k = 0.7 + 0.3 * Math.sin(t * 8);
    g.save(); g.translate(x, y); g.scale(k, k); g.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, q = i % 2 ? r * 0.3 : r; g.lineTo(Math.cos(a) * q, Math.sin(a) * q); }
    g.closePath(); g.fillStyle = '#FFFBE0'; g.fill(); g.strokeStyle = '#E8A800'; g.lineWidth = 1.5; g.stroke(); g.restore();
  }
  // 줄줄이 소시지 (세로): yTop ~ yBot 을 소시지 마디 여러 개로 나눠 끈으로 묶은 모양.
  //  마디 수는 길이에 맞춰 정하고 마디 길이를 살짝 늘려 맞춤 → 양 끝은 늘 둥글게 마무리된 온전한 소시지 (중간에 툭 잘리지 않음)
  //  cut: 이 높이 아래는 강아지가 먹은 부분 (먹는 중인 마디는 한 입 베어 문 모양)
  function sausage(g, x, yTop, yBot, s, cut) {
    const w = 34 * s, len = yBot - yTop; if (len < 4) return;
    const n = Math.max(1, Math.round(len / (50 * s))), L = len / n, bot = cut != null ? Math.min(yBot, cut) : yBot;
    if (bot - yTop < 4) return;
    g.save();
    if (cut != null) { g.beginPath(); g.rect(x - w, yTop - w, w * 2, bot - yTop + w); g.clip(); }
    for (let i = 0; i < n; i++) {
      const y0 = yTop + i * L + 2 * s, y1 = yTop + (i + 1) * L - 2 * s;
      rr(g, x - w / 2, y0, w, y1 - y0, Math.min(w / 2, (y1 - y0) / 2));
      const gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0); gr.addColorStop(0, '#B4532A'); gr.addColorStop(0.45, '#E07A45'); gr.addColorStop(1, '#A3461F');
      g.fillStyle = gr; g.fill(); line(g, 3 * s);
      g.strokeStyle = 'rgba(90,30,10,.5)'; g.lineWidth = 3 * s; // 구운 자국
      g.beginPath(); g.moveTo(x - w * 0.25, (y0 + y1) / 2 + 4 * s); g.lineTo(x + w * 0.25, (y0 + y1) / 2 - 4 * s); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.45)'; rr(g, x - w * 0.3, y0 + 8 * s, 5 * s, Math.max(0, y1 - y0 - 16 * s), 2.5 * s); g.fill();
      if (i < n - 1) { // 마디 사이 꼬인 매듭
        const yk = y1 + 2 * s;
        g.beginPath(); g.ellipse(x, yk, 7 * s, 4 * s, 0, 0, Math.PI * 2); g.fillStyle = '#9A3E1A'; g.fill(); line(g, 2 * s);
      }
    }
    g.restore();
    if (cut != null && cut < yBot) { // 먹은 자리: 한 입 베어 문 모양
      g.save(); g.fillStyle = '#F6B08A'; g.beginPath(); g.ellipse(x, bot, w / 2 - 2 * s, 6 * s, 0, 0, Math.PI * 2); g.fill(); line(g, 2 * s); g.restore();
    }
  }
  // 함정: 양파
  function onion(g, x, y, s) {
    g.save(); g.translate(x, y);
    g.beginPath(); g.ellipse(0, 32 * s, 28 * s, 5 * s, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.15)'; g.fill();
    g.beginPath(); g.moveTo(0, -36 * s); g.bezierCurveTo(10 * s, -24 * s, 34 * s, -14 * s, 32 * s, 8 * s); g.bezierCurveTo(30 * s, 30 * s, -30 * s, 30 * s, -32 * s, 8 * s); g.bezierCurveTo(-34 * s, -14 * s, -10 * s, -24 * s, 0, -36 * s);
    const gr = g.createLinearGradient(-30 * s, 0, 30 * s, 0); gr.addColorStop(0, '#C59AD8'); gr.addColorStop(0.5, '#F3E3F7'); gr.addColorStop(1, '#B07FCB');
    g.fillStyle = gr; g.fill(); line(g, 3 * s);
    g.strokeStyle = 'rgba(120,70,150,.5)'; g.lineWidth = 2 * s;
    for (const k of [-0.5, 0, 0.5]) { g.beginPath(); g.moveTo(0, -32 * s); g.quadraticCurveTo(k * 50 * s, 0, k * 22 * s, 26 * s); g.stroke(); }
    g.beginPath(); g.moveTo(-3 * s, -36 * s); g.lineTo(0, -48 * s); g.lineTo(4 * s, -36 * s); g.fillStyle = '#7BB85A'; g.fill(); line(g, 2 * s);
    g.restore();
  }
  // 함정: 초콜릿
  function choco(g, x, y, s) {
    g.save(); g.translate(x, y); g.rotate(0.12);
    g.beginPath(); g.ellipse(0, 30 * s, 34 * s, 5 * s, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.15)'; g.fill();
    rr(g, -32 * s, -26 * s, 64 * s, 52 * s, 6 * s); g.fillStyle = '#6B3A1E'; g.fill(); line(g, 3 * s);
    g.fillStyle = '#8A4E2A';
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { rr(g, -28 * s + i * 19 * s, -22 * s + j * 23 * s, 16 * s, 20 * s, 3 * s); g.fill(); }
    rr(g, -34 * s, 2 * s, 68 * s, 26 * s, 5 * s); g.fillStyle = '#E8456A'; g.fill(); line(g, 3 * s); // 포장지
    g.fillStyle = '#FFE07A'; rr(g, -34 * s, 10 * s, 68 * s, 6 * s, 2 * s); g.fill();
    g.restore();
  }
  // 강아지 (머리 + 앞발). (x, y) = 머리 가운데, open: 입 벌림 0~1, mood: idle | happy | sad, t: 시간
  const DOGS = [
    { fur: '#FFFFFF', fur2: '#F1E6DA', ear: '#A8693E', earLong: true, bow: true, patch: '#B97A48' }, // 아리: 하얀 얼굴·갈색 귀·분홍 리본
    { fur: '#C98B5A', fur2: '#B87444', ear: '#9A6038', earLong: true, curly: true, scarf: '#FFD34D' }, // 콩이: 갈색 곱슬 푸들·노란 스카프
    { fur: '#FFE2B0', fur2: '#F7C77E', ear: '#F2B261', pointy: true, scarf: '#5CA9E6' },             // 포미: 크림 포메라니안·파란 반다나
  ];
  function dog(g, x, y, s, kind, open = 0, mood = 'idle', t = 0) {
    const d = DOGS[kind % 3], R = 50 * s;
    g.save(); g.translate(x, y);
    // 몸·앞발
    g.beginPath(); g.ellipse(0, R * 1.05, R * 0.95, R * 0.55, 0, Math.PI, 0); g.fillStyle = d.fur2; g.fill(); line(g, 3 * s);
    for (const px of [-0.42, 0.42]) { g.beginPath(); g.ellipse(px * R, R * 1.0, R * 0.24, R * 0.16, 0, 0, Math.PI * 2); g.fillStyle = d.fur; g.fill(); line(g, 2.5 * s); }
    // 귀 (뒤)
    const wig = Math.sin(t * 6) * 0.06;
    for (const sd of [-1, 1]) {
      g.save(); g.scale(sd, 1); g.rotate(wig);
      g.beginPath();
      if (d.pointy) { g.moveTo(R * 0.35, -R * 0.75); g.lineTo(R * 0.72, -R * 1.18); g.lineTo(R * 0.88, -R * 0.45); }
      else { g.moveTo(R * 0.62, -R * 0.66); g.bezierCurveTo(R * 1.45, -R * 0.6, R * 1.42, R * 0.6, R * 1.0, R * 0.7); g.bezierCurveTo(R * 0.72, R * 0.35, R * 0.82, -R * 0.2, R * 0.62, -R * 0.66); }
      g.closePath(); g.fillStyle = d.ear; g.fill(); line(g, 3 * s); g.restore();
    }
    // 털 머리 (보송보송 테두리)
    g.beginPath();
    for (let i = 0; i <= 28; i++) { const a = i / 28 * Math.PI * 2, rr2 = R * (1 + (i % 2) * 0.05); g.quadraticCurveTo(Math.cos(a - 0.11) * R * 1.08, Math.sin(a - 0.11) * R * 1.0, Math.cos(a) * rr2, Math.sin(a) * rr2 * 0.92); }
    g.closePath(); g.fillStyle = d.fur; g.fill(); line(g, 3 * s);
    if (d.patch) { // 아리: 눈 둘레 갈색 얼룩
      g.fillStyle = d.patch; for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(sd * R * 0.42, -R * 0.22, R * 0.3, R * 0.34, sd * 0.3, 0, Math.PI * 2); g.fill(); }
      g.beginPath(); g.ellipse(0, -R * 0.5, R * 0.12, R * 0.35, 0, 0, Math.PI * 2); g.fillStyle = d.fur; g.fill();
    }
    if (d.curly) { // 콩이: 머리 위 곱슬 털 뭉치
      g.fillStyle = d.fur2; for (const [cx, cy, cr] of [[-0.3, -0.82, 0.24], [0, -0.92, 0.26], [0.3, -0.82, 0.24]]) { g.beginPath(); g.arc(cx * R, cy * R, cr * R, 0, Math.PI * 2); g.fill(); line(g, 2 * s); }
    }
    if (d.bow) { // 아리: 머리 위 작은 분홍 리본
      g.save(); g.translate(0, -R * 0.95); g.fillStyle = '#FF8FB1';
      for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(sd * R * 0.4, -R * 0.3, sd * R * 0.36, R * 0.12); g.closePath(); g.fill(); line(g, 2.5 * s); }
      g.beginPath(); g.arc(0, -R * 0.02, R * 0.09, 0, Math.PI * 2); g.fill(); line(g, 2.5 * s); g.restore();
    }
    if (d.scarf) { // 목 스카프·반다나
      g.beginPath(); g.moveTo(-R * 0.62, R * 0.72); g.quadraticCurveTo(0, R * 0.98, R * 0.62, R * 0.72); g.lineTo(R * 0.5, R * 0.86); g.lineTo(0, R * 1.18); g.lineTo(-R * 0.5, R * 0.86); g.closePath();
      g.fillStyle = d.scarf; g.fill(); line(g, 2.5 * s);
      g.fillStyle = 'rgba(255,255,255,.7)'; for (const [cx, cy] of [[-0.25, 0.86], [0.2, 0.9], [0, 1.04]]) { g.beginPath(); g.arc(cx * R, cy * R, R * 0.04, 0, 7); g.fill(); }
    }
    // 주둥이
    g.beginPath(); g.ellipse(0, R * 0.32, R * 0.42, R * 0.32, 0, 0, Math.PI * 2); g.fillStyle = d.fur === '#FFFFFF' ? '#FFF8F0' : '#FFF1DC'; g.fill();
    // 눈
    const ey = -R * 0.12, ex = R * 0.36;
    for (const sd of [-1, 1]) {
      if (mood === 'happy') { g.beginPath(); g.arc(sd * ex, ey + 4 * s, R * 0.13, Math.PI * 1.1, Math.PI * 1.9); g.lineWidth = 4 * s; g.strokeStyle = '#2B1A10'; g.stroke(); }
      else {
        g.beginPath(); g.ellipse(sd * ex, ey, R * 0.13, R * 0.16, 0, 0, Math.PI * 2); g.fillStyle = '#2B1A10'; g.fill();
        g.beginPath(); g.arc(sd * ex - R * 0.04, ey - R * 0.06, R * 0.05, 0, 7); g.fillStyle = '#fff'; g.fill();
        if (mood === 'sad') { g.beginPath(); g.ellipse(sd * ex + sd * R * 0.06, ey + R * 0.26, R * 0.05, R * 0.08, 0, 0, 7); g.fillStyle = '#8FD0FF'; g.fill(); }
      }
    }
    // 볼
    g.fillStyle = 'rgba(255,140,170,.45)'; for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(sd * R * 0.55, R * 0.18, R * 0.13, R * 0.08, 0, 0, 7); g.fill(); }
    // 코
    g.beginPath(); g.ellipse(0, R * 0.16, R * 0.12, R * 0.09, 0, 0, Math.PI * 2); g.fillStyle = '#2B1A10'; g.fill();
    // 입: 다물면 w 모양, 벌리면 빨간 입 + 혀
    if (open > 0.05) {
      g.beginPath(); g.ellipse(0, R * 0.42, R * 0.2, R * 0.08 + R * 0.2 * open, 0, 0, Math.PI * 2); g.fillStyle = '#7A1E2E'; g.fill(); line(g, 2.5 * s);
      g.beginPath(); g.ellipse(0, R * 0.48 + R * 0.12 * open, R * 0.13, R * 0.07 + R * 0.06 * open, 0, 0, Math.PI * 2); g.fillStyle = '#FF8FA0'; g.fill();
    } else {
      g.beginPath(); g.moveTo(-R * 0.18, R * 0.34); g.quadraticCurveTo(-R * 0.09, R * 0.46, 0, R * 0.32); g.quadraticCurveTo(R * 0.09, R * 0.46, R * 0.18, R * 0.34); line(g, 3 * s);
      if (mood === 'happy') { g.beginPath(); g.ellipse(0, R * 0.47, R * 0.08, R * 0.07, 0, 0, Math.PI); g.fillStyle = '#FF8FA0'; g.fill(); }
    }
    g.restore();
  }
  root.DogArt = { bone, sausage, onion, choco, dog, sparkle, DOGS };
})(typeof window !== 'undefined' ? window : globalThis);
