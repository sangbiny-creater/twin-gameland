'use strict';
// 아이템샵 배경 스킨 중, 게임에 원래 그림이 없는 배경을 코드로 그리는 공용 렌더러.
// Skins.draw(ctx, id, w, h, sx, sy, t)
//   sx: 가로로 지나간 거리(px), sy: 세로로 올라간 거리(px, 계단 오르기), t: 시간(초)
// 별·행성·구름은 천천히 흐르고, 땅 쪽 실루엣은 화면 아래에 깔린다.
(function () {
  const rng = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };

  const DEF = {
    night: { sky: ['#0B1440', '#1E2A6B', '#4A3F8F'], stars: 140, moon: true, far: '#2A2C6A', mid: '#141A40', windows: '#FFD86B' },
    space: { sky: ['#0E0828', '#2A1766', '#5A3DB0'], stars: 260, planets: true, far: '#3A2A7C', mid: '#24195A' },
    desert: { sky: ['#FFA45C', '#FFD39A', '#FFF0D2'], sun: '#FFF3B0', far: '#EBB872', mid: '#D2914E' },
    park: { sky: ['#7EC0F2', '#CBE6FA', '#FFF0F6'], clouds: true, far: '#B9DDB0', mid: '#F3B7C9' },
  };
  const cache = {};

  function layer(id, kind, h) {
    const key = id + kind + h;
    if (cache[key]) return cache[key];
    const d = DEF[id], w = 1400;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const R = rng(id.length * 97 + (kind === 'far' ? 3 : 11));
    const base = h; // silhouettes sit on the bottom edge
    if (kind === 'far') {
      g.fillStyle = d.far;
      if (id === 'desert') { // dunes + pyramids
        g.beginPath(); g.moveTo(0, base);
        for (let x = 0; x <= w; x += 20) g.lineTo(x, base - 150 - Math.sin(x * 0.006) * 40 - Math.sin(x * 0.017) * 14);
        g.lineTo(w, base); g.fill();
        for (let i = 0; i < 3; i++) { const x = 200 + i * 420 + R() * 80, s = 90 + R() * 60; g.beginPath(); g.moveTo(x - s, base - 150); g.lineTo(x, base - 150 - s * 1.1); g.lineTo(x + s, base - 150); g.fill(); }
      } else if (id === 'space') { // floating islands far away
        for (let i = 0; i < 6; i++) {
          const x = i * 240 + R() * 90, y = h * (0.35 + R() * 0.35), s = 30 + R() * 40;
          g.beginPath(); g.ellipse(x, y, s, s * 0.3, 0, 0, 7); g.fill();
          g.beginPath(); g.moveTo(x - s, y); g.quadraticCurveTo(x, y + s * 1.4, x + s, y); g.fill();
        }
      } else { // night castles / park hills
        g.beginPath(); g.moveTo(0, base);
        for (let x = 0; x <= w; x += 30) g.lineTo(x, base - 120 - Math.sin(x * 0.008) * 30);
        g.lineTo(w, base); g.fill();
        if (id === 'night') for (let i = 0; i < 7; i++) {
          const x = i * 200 + R() * 60, tw = 26 + R() * 20, th = 120 + R() * 120;
          g.fillRect(x, base - 120 - th, tw, th + 20);
          g.beginPath(); g.moveTo(x - 6, base - 120 - th); g.lineTo(x + tw / 2, base - 160 - th); g.lineTo(x + tw + 6, base - 120 - th); g.fill();
        }
      }
    } else {
      if (id === 'night') { // city with lit windows
        for (let x = -10; x < w;) {
          const bw = 50 + R() * 70, bh = 70 + R() * 170;
          g.fillStyle = d.mid; g.fillRect(x, base - bh, bw, bh);
          g.fillStyle = d.windows;
          for (let wy = base - bh + 12; wy < base - 16; wy += 22) for (let wx = x + 8; wx < x + bw - 12; wx += 16) if (R() < 0.45) g.fillRect(wx, wy, 7, 10);
          x += bw + 4 + R() * 16;
        }
      } else if (id === 'desert') { // near dunes, palms, cacti
        g.fillStyle = d.mid; g.beginPath(); g.moveTo(0, base);
        for (let x = 0; x <= w; x += 20) g.lineTo(x, base - 60 - Math.sin(x * 0.01 + 1) * 24);
        g.lineTo(w, base); g.fill();
        for (let i = 0; i < 5; i++) {
          const x = 120 + i * 270 + R() * 60, y = base - 70;
          g.strokeStyle = '#8A5A2B'; g.lineWidth = 8; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 10, y - 60, x + 4, y - 110); g.stroke();
          g.fillStyle = '#4E9A4A';
          for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.6; g.beginPath(); g.ellipse(x + 4 + Math.cos(a) * 30, y - 110 + Math.sin(a) * 14 + 8, 34, 9, a, 0, 7); g.fill(); }
        }
      } else if (id === 'park') { // ferris wheel, striped tents, balloons
        const wx = 330, wr = 150, wy = base - 70 - wr;
        g.strokeStyle = '#E86C8E'; g.lineWidth = 6; g.beginPath(); g.arc(wx, wy, wr, 0, 7); g.stroke();
        g.lineWidth = 3; for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; g.beginPath(); g.moveTo(wx, wy); g.lineTo(wx + Math.cos(a) * wr, wy + Math.sin(a) * wr); g.stroke(); }
        const cab = ['#FFB45A', '#7EC8F2', '#79C89C', '#FF8FB5', '#B79BE0'];
        for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; g.fillStyle = cab[k % 5]; g.beginPath(); g.arc(wx + Math.cos(a) * wr, wy + Math.sin(a) * wr + 10, 12, 0, 7); g.fill(); }
        g.strokeStyle = '#B85A78'; g.lineWidth = 8; g.beginPath(); g.moveTo(wx - 70, base); g.lineTo(wx, wy); g.lineTo(wx + 70, base); g.stroke();
        for (let i = 0; i < 4; i++) {
          const x = 620 + i * 190, tw = 120, th = 90;
          for (let s = 0; s < 6; s++) { g.fillStyle = s % 2 ? '#FFFFFF' : '#E85A7A'; g.fillRect(x + s * tw / 6, base - th * 0.6, tw / 6, th * 0.6); }
          g.fillStyle = i % 2 ? '#5CA9E6' : '#FFB45A'; g.beginPath(); g.moveTo(x - 8, base - th * 0.6); g.lineTo(x + tw / 2, base - th - 30); g.lineTo(x + tw + 8, base - th * 0.6); g.fill();
        }
        g.fillStyle = d.mid; g.fillRect(0, base - 18, w, 18);
      } else if (id === 'space') { // little asteroids drifting near
        for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? '#4B3A8C' : '#3A2C70'; g.beginPath(); g.arc(R() * w, h * (0.2 + R() * 0.7), 6 + R() * 14, 0, 7); g.fill(); }
      }
    }
    cache[key] = c; return c;
  }

  function tile(ctx, img, w, h, offX, y) {
    const iw = img.width;
    let x = -((offX % iw) + iw) % iw;
    for (; x < w; x += iw) ctx.drawImage(img, x, y);
  }

  const Skins = {
    has(id) { return !!DEF[id]; },
    draw(ctx, id, w, h, sx = 0, sy = 0, t = 0) {
      const d = DEF[id]; if (!d) return false;
      const gr = ctx.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, d.sky[0]); gr.addColorStop(0.6, d.sky[1]); gr.addColorStop(1, d.sky[2]);
      ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
      if (d.stars) {
        const R = rng(42);
        for (let i = 0; i < d.stars; i++) {
          const x = ((R() * w * 1.5 - sx * 0.03) % w + w) % w, y = ((R() * h * 1.2 + sy * 0.03) % h + h) % h;
          const tw = 0.5 + 0.5 * Math.sin(t * (1 + R() * 2) + i);
          ctx.globalAlpha = 0.35 + tw * 0.6; ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(x, y, 0.8 + R() * 1.6, 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      if (d.moon) { ctx.fillStyle = '#FFF6D6'; ctx.beginPath(); ctx.arc(w * 0.8, h * 0.16, 34, 0, 7); ctx.fill(); ctx.fillStyle = d.sky[0]; ctx.beginPath(); ctx.arc(w * 0.8 + 14, h * 0.16 - 8, 30, 0, 7); ctx.fill(); }
      if (d.sun) { ctx.fillStyle = d.sun; ctx.beginPath(); ctx.arc(w * 0.72, h * 0.3, 64, 0, 7); ctx.fill(); }
      if (d.planets) {
        const px = (n) => ((n - sx * 0.02) % (w + 300) + w + 300) % (w + 300) - 150;
        const py = (n) => ((n + sy * 0.02) % (h + 300) + h + 300) % (h + 300) - 150;
        const planet = (x, y, r, c1, c2, ring) => {
          const pg = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
          pg.addColorStop(0, c1); pg.addColorStop(1, c2); ctx.fillStyle = pg;
          ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
          if (ring) { ctx.strokeStyle = 'rgba(255,220,255,.7)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(x, y, r * 1.6, r * 0.42, -0.35, 0, 7); ctx.stroke(); }
        };
        planet(px(w * 0.75), py(h * 0.22), 58, '#C9A8FF', '#6A45C9', true);
        planet(px(w * 0.25), py(h * 0.45), 26, '#FFC2E0', '#C2569A', false);
        planet(px(w * 0.55), py(h * 0.62), 16, '#A8E6FF', '#3B7FC9', false);
      }
      if (d.clouds) {
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        for (let i = 0; i < 6; i++) {
          const cx = ((i * 330 - sx * 0.08 - t * 8) % (w + 300) + w + 300) % (w + 300) - 150, cy = 60 + (i * 53) % 180;
          ctx.beginPath(); ctx.arc(cx, cy, 26, 0, 7); ctx.arc(cx + 28, cy - 12, 32, 0, 7); ctx.arc(cx + 60, cy, 24, 0, 7); ctx.fill();
        }
      }
      tile(ctx, layer(id, 'far', h), w, h, sx * 0.15, 0);
      tile(ctx, layer(id, 'mid', h), w, h, sx * 0.4, 0);
      return true;
    },
  };
  window.Skins = Skins;
})();
