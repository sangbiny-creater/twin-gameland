'use strict';
// v0.3 상용화 검수(웹): 게임 잠금 · 체험 · 열쇠 · 다이아 · 출석 · 가짜 광고(2배 받기·이어하기) · 가짜 결제
// 규칙과 숫자: docs/spec/트윈게임랜드_스펙_v1.3.md (🟡 임시값은 아래 상수만 바꾸면 됨)
// 모두 이 폰 안(twin_gameland_v1 의 캐릭터마다 c.gems, c.v3)에만 저장 — 진짜 돈·진짜 광고 없음
// common/profile.js 가 기본 주소(v0.3)에서만 불러옴. 보관판(v0.1·v0.2)에서는 안 불림
(function () {
  if (!window.Hub || Hub.ver !== '0.3') return;
  const SRC = (document.currentScript && document.currentScript.src) || '';
  // 게임 코드(startStage·startRun)와 화면이 다 준비된 뒤에 시작
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main); else main();
  function main() {

  // ---------- 숫자 (🟡 임시값) ----------
  const OPEN = ['bakery', 'helicopter', 'mole'];      // 처음부터 열린 게임
  const PRICES = [60, 80, 100, 120, 140, 160, 180];  // 다이아로 N번째 열 때 가격 (열쇠로 연 건 안 셈)
  const TRIAL_STAGES = 2;                             // 잠긴 스테이지 게임: 쉬움 1-1, 1-2까지
  const TRIAL_SEC = 30;                               // 잠긴 끝없는 게임: 한 판에 30초
  const GEM_EVERY = 10;                               // 게임 10판마다 다이아 1개
  const AD_SEC = 5;                                   // 가짜 광고 길이
  const ATT_DAILY = 1;                                // 출석 매일 다이아
  const ATT_BONUS = { 10: { tickets: 1, text: '열쇠 1개' }, 30: { text: '프로필 프레임 (준비 중)' }, 50: { gems: 20, text: '다이아 20개' }, 100: { text: '특별 코스튬 (준비 중)' } };
  const PACKS = [{ id: 'diamond_60', gems: 60 }, { id: 'diamond_140', gems: 140 }, { id: 'diamond_300', gems: 300 }, { id: 'diamond_650', gems: 650 }];
  const NO_CONTINUE = ['darts']; // 실패 없이 끝나는 게임 (이어하기 자리 없음)

  const ROOT = SRC.replace(/common\/monet\.js.*$/, '');
  const G = Hub.GAMES;
  const name = (g) => (G[g] && G[g].name) || g;
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

  // ---------- 저장 ----------
  // c.v3 가 없으면 처음 상태(열쇠 1개 = 환영 선물, 캐릭터마다 한 번)
  const fresh = () => ({ tickets: 1, unlocked: [], dUnlocks: 0, plays: 0, att: { count: 0, last: '' }, welcomed: false });
  const st = (c = Hub.active()) => (c && c.v3) || fresh();
  const ensure = () => Hub.mutate((c) => { if (!c.v3) c.v3 = fresh(); return c.v3; });
  const isOpen = (g) => OPEN.includes(g) || st().unlocked.includes(g);
  const price = () => PRICES[Math.min(st().dUnlocks, PRICES.length - 1)];
  function unlock(g, how) {
    return Hub.mutate((c) => {
      const s = c.v3 || (c.v3 = fresh());
      if (s.unlocked.includes(g)) return true;
      if (how === 'ticket') { if (s.tickets < 1) return false; s.tickets--; }
      else { const p = PRICES[Math.min(s.dUnlocks, PRICES.length - 1)]; if ((c.gems || 0) < p) return false; c.gems -= p; s.dUnlocks++; }
      s.unlocked.push(g); return true;
    });
  }
  const addGems = (n) => Hub.mutate((c) => { c.gems = (c.gems || 0) + n; });
  window.Monet = { isOpen, st, price }; // 다른 코드·검사 도구용

  // ---------- 화면 조각 (CSS는 여기서 넣음) ----------
  const css = document.createElement('style');
  css.textContent = `
.mn-modal{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;background:rgba(20,30,50,.55);font-family:Jua,system-ui,sans-serif;padding:16px}
.mn-panel{width:min(360px,100%);background:#fff;border-radius:22px;padding:20px 18px 16px;text-align:center;color:#2B3A67;box-shadow:0 12px 40px rgba(0,0,0,.35);max-height:90vh;overflow:auto}
.mn-panel h3{margin:0 0 6px;font-size:22px;font-weight:400}
.mn-panel p{margin:6px 0 12px;font-size:15px;line-height:1.45;color:#4A5878}
.mn-have{display:flex;justify-content:center;gap:14px;font-size:15px;margin:2px 0 10px}
.mn-btn{display:block;width:100%;margin:8px 0 0;border:0;border-radius:14px;padding:12px 10px;font:inherit;font-size:17px;color:#fff;background:#3D8BFF;box-shadow:0 4px 0 #2A6AC8;cursor:pointer}
.mn-btn.pink{background:#FF6F96;box-shadow:0 4px 0 #D24C73}.mn-btn.gold{background:#FFB21E;box-shadow:0 4px 0 #D9761A}
.mn-btn.gray{background:#E8EEF6;color:#4A5878;box-shadow:0 4px 0 #C9D3E0}.mn-btn:disabled{opacity:.45}
.mn-note{font-size:12px;color:#8A96AD;margin-top:10px}
.mn-tag{display:inline-block;background:#FFE9F0;color:#D24C73;border-radius:8px;padding:1px 8px;font-size:12px;margin-bottom:6px}
.mn-ad{position:fixed;inset:0;z-index:9500;background:#111;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Jua,system-ui,sans-serif;text-align:center;gap:12px}
.mn-ad b{font-size:64px}.mn-ad span{font-size:16px;opacity:.85;padding:0 24px}
.mn-reward{position:fixed;left:50%;top:calc(10px + env(safe-area-inset-top));transform:translateX(-50%);z-index:8000;display:flex;flex-direction:column;gap:6px;font-family:Jua,system-ui,sans-serif;width:min(280px,70vw)}
.mn-reward button{border:0;border-radius:14px;padding:10px 12px;font:inherit;font-size:16px;color:#fff;background:linear-gradient(#7C5CFF,#5A3DE0);box-shadow:0 4px 0 #3F28A8,0 8px 18px rgba(0,0,0,.25);cursor:pointer}
.mn-reward button.cont{background:linear-gradient(#2FC48A,#1E9E6C);box-shadow:0 4px 0 #157A52,0 8px 18px rgba(0,0,0,.25)}
.mn-reward button:disabled{opacity:.6}.mn-reward .x{position:absolute;right:-8px;top:-10px;width:28px;height:28px;padding:0;border-radius:50%;background:#2B3A67;box-shadow:none;font-size:14px}
.mn-trial{position:fixed;left:50%;top:calc(8px + env(safe-area-inset-top));transform:translateX(-50%);z-index:8000;background:rgba(43,58,103,.85);color:#fff;font-family:Jua,system-ui,sans-serif;font-size:15px;border-radius:12px;padding:4px 12px;pointer-events:none}
.mn-pop{position:fixed;left:50%;top:40%;transform:translate(-50%,-50%);z-index:9600;background:rgba(43,58,103,.92);color:#fff;font-family:Jua,system-ui,sans-serif;font-size:20px;border-radius:16px;padding:10px 18px;pointer-events:none;animation:mnPop 1.6s ease forwards}
@keyframes mnPop{0%{opacity:0;transform:translate(-50%,-30%)}15%{opacity:1;transform:translate(-50%,-50%)}80%{opacity:1}100%{opacity:0}}
.pk-ride.mn-locked .art{filter:grayscale(.55) brightness(.92)}
.mn-lock{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 4px rgba(0,0,0,.35));pointer-events:none}
.mn-lock small{display:block;font-size:12px;background:#FF6F96;color:#fff;border-radius:8px;padding:1px 6px;margin-top:-4px;font-family:Jua,system-ui,sans-serif}
`;
  document.head.appendChild(css);

  const esc = (t) => String(t).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
  // 창 하나 띄우기. buttons: [{ text, cls, on(), off }] — 누르면 창을 닫고 on() 실행
  function modal(html, buttons, note) {
    const m = document.createElement('div'); m.className = 'mn-modal';
    m.innerHTML = `<div class="mn-panel">${html}<div class="mn-btns"></div>${note ? `<div class="mn-note">${note}</div>` : ''}</div>`;
    const box = m.querySelector('.mn-btns');
    for (const b of buttons) {
      const el = document.createElement('button'); el.className = 'mn-btn ' + (b.cls || ''); el.textContent = b.text; el.disabled = !!b.off;
      el.addEventListener('click', (e) => { e.stopPropagation(); if (window.UI) UI.blip(); m.remove(); if (b.on) b.on(); });
      box.appendChild(el);
    }
    for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'keydown']) m.addEventListener(ev, (e) => e.stopPropagation());
    document.body.appendChild(m); return m;
  }
  function pop(text) { const p = document.createElement('div'); p.className = 'mn-pop'; p.textContent = text; document.body.appendChild(p); setTimeout(() => p.remove(), 1700); }
  const haveLine = () => `<div class="mn-have"><span>🗝️ 열쇠 <b>${st().tickets}</b></span><span>💎 다이아 <b>${Hub.gems()}</b></span></div>`;
  const refreshHub = () => { const el = document.getElementById('meGems'); if (el) el.textContent = Hub.gems(); decorateRides(); };

  // 가짜 광고: AD_SEC초 세고 done()
  function fakeAd(done) {
    const a = document.createElement('div'); a.className = 'mn-ad';
    a.innerHTML = `<div>📺 광고 자리</div><b>${AD_SEC}</b><span>앱에서는 여기서 보상형 광고가 나와요<br>(웹 검수판: 진짜 광고 없음)</span>`;
    for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'click', 'keydown']) a.addEventListener(ev, (e) => e.stopPropagation());
    document.body.appendChild(a);
    let n = AD_SEC; const t = setInterval(() => { n--; a.querySelector('b').textContent = n; if (n <= 0) { clearInterval(t); a.remove(); done(); } }, 1000);
  }

  // 다이아 상점 (가짜 결제)
  function gemShop(after) {
    modal(`<span class="mn-tag">검수용 · 진짜 결제 없음</span><h3>💎 다이아 상점</h3>${haveLine()}<p>앱에서는 여기서 구글 결제 창이 떠요.<br>가격은 아직 정하지 않았어요.</p>`,
      [...PACKS.map((p) => ({ text: `💎 ${p.gems}개  ·  가격 미정`, cls: 'gold', on: () => fakePay(p, after) })), { text: '닫기', cls: 'gray', on: after }],
      '상품 ID: ' + PACKS.map((p) => p.id).join(' · '));
  }
  function fakePay(p, after) {
    modal(`<span class="mn-tag">검수용 가짜 결제</span><h3>💎 ${p.gems}개 사기</h3><p>여기가 앱의 결제 창 자리예요.<br>확인을 누르면 다이아가 들어와요 (돈 안 나감).</p>`,
      [{ text: '확인 (가짜 결제)', cls: 'gold', on: () => { addGems(p.gems); pop(`💎 +${p.gems}`); refreshHub(); if (after) after(); } }, { text: '취소', cls: 'gray', on: after }]);
  }

  // 게임 열기 창. opts: { trial(): 체험하기, trialText, onOpen(), onClose() }
  function unlockBox(g, opts = {}) {
    const s = st(), p = price(), enough = Hub.gems() >= p;
    const btns = [
      { text: `🗝️ 열쇠로 열기 (${s.tickets}개 있음)`, cls: 'pink', off: s.tickets < 1, on: () => done(unlock(g, 'ticket')) },
      { text: enough ? `💎 다이아 ${p}개로 열기` : `💎 다이아 ${p}개로 열기 (모자라요)`, cls: 'gold', on: () => (enough ? done(unlock(g, 'gem')) : gemShop(() => unlockBox(g, opts))) },
    ];
    if (opts.trial) btns.push({ text: opts.trialText || '▶ 체험해 보기', on: opts.trial });
    btns.push({ text: opts.closeText || '닫기', cls: 'gray', on: opts.onClose });
    function done(ok) {
      if (!ok) { pop('열 수 없어요'); return; }
      if (window.UI) UI.blip(1046);
      pop(`🎉 ${name(g)} 열림!`); refreshHub(); if (opts.onOpen) opts.onOpen();
    }
    modal(`<h3>🔒 ${esc(name(g))}</h3>${opts.msg ? `<p>${opts.msg}</p>` : '<p>잠긴 게임이에요. 열쇠나 다이아로 영원히 열 수 있어요.</p>'}${haveLine()}`, btns,
      `다이아로 연 횟수에 따라 값이 올라요: ${PRICES.join(' → ')}`);
  }

  // ---------- 게임 결과: 광고 보고 2배 받기 · 이어하기 (+ 10판마다 다이아) ----------
  let gameId = null;
  {
    const m = location.pathname.match(/\/([a-z]+)\/(index\.html)?$/);
    if (m && G[m[1]]) gameId = m[1];
  }
  const rec0 = Hub.record.bind(Hub);
  Hub.record = function (game, r) {
    const res = rec0(game, r);
    if (!res || res.god) return res;
    const gem = Hub.mutate((c) => { const s = c.v3 || (c.v3 = fresh()); s.plays = (s.plays || 0) + 1; if (s.plays % GEM_EVERY === 0) { c.gems = (c.gems || 0) + 1; return true; } return false; });
    if (gem) setTimeout(() => pop(`💎 +1 (게임 ${GEM_EVERY}판마다)`), 400);
    if (isOpen(game)) { // 체험 중에는 광고 없음
      const failed = G[game].stages ? !r.cleared : !NO_CONTINUE.includes(game);
      setTimeout(() => rewardBar(res.earned || 0, failed), 900);
    }
    return res;
  };
  function rewardBar(earned, failed) {
    document.querySelectorAll('.mn-reward').forEach((x) => x.remove());
    if (!(earned > 0) && !failed) return;
    const bar = document.createElement('div'); bar.className = 'mn-reward';
    for (const ev of ['pointerdown', 'pointerup', 'touchstart']) bar.addEventListener(ev, (e) => e.stopPropagation());
    const add = (text, cls, fn) => { const b = document.createElement('button'); b.className = cls; b.textContent = text; b.addEventListener('click', (e) => { e.stopPropagation(); fn(b); }); bar.appendChild(b); return b; };
    if (earned > 0) add(`📺 광고 보고 코인 2배 (+${earned})`, '', (b) => fakeAd(() => { Hub.addCoins(earned); b.disabled = true; b.textContent = `코인 +${earned} 더 받았어요!`; pop(`🪙 +${earned}`); }));
    if (failed) add('📺 광고 보고 이어하기', 'cont', (b) => fakeAd(() => { b.disabled = true; b.textContent = '앱에서는 여기서 이어서 해요 (연결 예정)'; }));
    add('✕', 'x', () => bar.remove());
    document.body.appendChild(bar);
    // 다음 판을 시작하면(화면을 누르면) 사라짐
    setTimeout(() => { const off = () => { bar.remove(); window.removeEventListener('pointerdown', off, true); }; window.addEventListener('pointerdown', (e) => { if (!bar.contains(e.target)) off(); }, true); }, 300);
  }

  // ---------- 게임 화면: 잠긴 게임의 체험 ----------
  if (gameId && !isOpen(gameId)) {
    const toMap = () => { location.href = ROOT + 'index.html#' + (G[gameId].stages ? 'map-' + gameId : 'lobby'); };
    if (G[gameId].stages) {
      // 스테이지 게임: 쉬움 1-1, 1-2 까지만 (어려움은 체험 없음)
      const blocked = (si) => si >= TRIAL_STAGES;
      const ask = () => unlockBox(gameId, { msg: `체험은 1-1, 1-2까지예요.<br>계속하려면 게임을 열어요!`, closeText: '지도로', onClose: toMap, onOpen: () => location.reload() });
      if (typeof window.startStage === 'function') {
        const orig = window.startStage;
        window.startStage = function (si) { if (blocked(+si)) { ask(); return; } return orig.apply(this, arguments); };
      }
      const q = parseInt(new URLSearchParams(location.search).get('stage'), 10);
      if (blocked(q)) ask();
    } else {
      // 끝없는 게임: 한 판에 30초. 위에 남은 시간, 끝나면 게임 열기 창
      let left = TRIAL_SEC, timer = 0, tag = null;
      const stop = () => { clearInterval(timer); if (tag) tag.remove(); tag = null; };
      const begin = () => {
        if (isOpen(gameId)) return;
        stop(); left = TRIAL_SEC;
        tag = document.createElement('div'); tag.className = 'mn-trial'; document.body.appendChild(tag);
        const draw = () => { tag.textContent = `🔒 체험 ${left}초`; };
        draw();
        const paused = () => { const p = document.getElementById('pause'); return document.hidden || (p && !p.classList.contains('hidden')); };
        timer = setInterval(() => {
          if (paused()) return; // 일시정지 창이 떠 있거나 다른 앱으로 갔을 때는 체험 시간을 안 셈
          left--; if (tag) draw();
          if (left > 0) return;
          stop();
          unlockBox(gameId, { msg: `체험 ${TRIAL_SEC}초가 끝났어요!<br>열면 끝까지 할 수 있어요.`, closeText: '나가기', onClose: toMap, onOpen: () => {} });
        }, 1000);
      };
      if (typeof window.startRun === 'function') {
        const orig = window.startRun;
        window.startRun = function () { const r = orig.apply(this, arguments); begin(); return r; };
      }
      begin(); // 이미 시작한 판(인트로 START로 바로 들어옴)이나 준비 화면부터 셈
    }
  }

  // ---------- 첫 화면(놀이공원): 자물쇠 · 잠긴 놀이기구 누르기 · 다이아 · 출석 ----------
  const world = document.getElementById('pkWorld');
  // 자물쇠 그림 (이모지는 기기마다 달라 보여서 직접 그림)
  const LOCK_SVG = '<svg viewBox="0 0 40 44" width="40" height="44"><path d="M11 20v-6a9 9 0 0 1 18 0v6" fill="none" stroke="#7A8AA6" stroke-width="5" stroke-linecap="round"/><rect x="5" y="19" width="30" height="23" rx="6" fill="#FFC93C" stroke="#C98A12" stroke-width="2.5"/><circle cx="20" cy="29" r="3.6" fill="#8A5A0A"/><rect x="18.4" y="30" width="3.2" height="7" rx="1.6" fill="#8A5A0A"/></svg>';
  function decorateRides() {
    if (!world) return;
    world.querySelectorAll('.pk-ride[data-id]').forEach((b) => {
      const locked = !isOpen(b.dataset.id);
      b.classList.toggle('mn-locked', locked);
      let L = b.querySelector('.mn-lock');
      if (locked && !L) { L = document.createElement('span'); L.className = 'mn-lock'; L.innerHTML = LOCK_SVG + '<small>체험</small>'; b.appendChild(L); }
      if (!locked && L) L.remove();
    });
  }
  if (world) {
    new MutationObserver(decorateRides).observe(world, { childList: true });
    decorateRides();
    let allow = null; // 체험하기를 고른 놀이기구는 한 번 그냥 통과
    document.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('.pk-ride[data-id]');
      if (!b || world.classList.contains('editing') || isOpen(b.dataset.id)) return;
      if (allow === b.dataset.id) { allow = null; return; }
      e.stopPropagation(); e.preventDefault();
      const g = b.dataset.id;
      unlockBox(g, { trial: () => { allow = g; b.click(); }, trialText: G[g].stages ? '▶ 체험해 보기 (1-1, 1-2)' : `▶ 체험해 보기 (${TRIAL_SEC}초)` });
    }, true);
    // 다이아 칸: 다이아 상점
    const old = document.getElementById('btnGems');
    if (old) { const nb = old.cloneNode(true); old.replaceWith(nb); nb.addEventListener('click', () => { if (window.UI) UI.blip(); gemShop(); }); }
    refreshHub();
  }
  // 징검다리 지도: 잠긴 게임은 쉬움 1-1, 1-2 만
  const track = document.getElementById('mapTrack');
  if (track) {
    document.addEventListener('click', (e) => {
      const s = e.target.closest && e.target.closest('#mapTrack .stone');
      const m = location.hash.match(/^#map-(\w+)/); if (!s || !m || isOpen(m[1])) return;
      const i = [...track.querySelectorAll('.stone')].indexOf(s);
      const hard = document.getElementById('scrMap').classList.contains('hard');
      if (!hard && i < TRIAL_STAGES) return;
      e.stopPropagation(); e.preventDefault();
      unlockBox(m[1], { msg: '체험은 쉬움 1-1, 1-2까지예요.<br>열면 모든 판을 할 수 있어요!', onOpen: () => {} });
    }, true);
  }
  // 환영 선물 + 출석 (첫 화면 로비가 보일 때 하루 한 번)
  const lobby = document.getElementById('scrLobby');
  if (lobby) {
    let busy = false;
    const check = () => {
      if (busy || lobby.classList.contains('hidden') || !Hub.active() || document.querySelector('.mn-modal')) return;
      ensure();
      const s = st();
      if (!s.welcomed) {
        busy = true; Hub.mutate((c) => { c.v3.welcomed = true; });
        modal(`<span class="mn-tag">v0.3 상용화 검수판</span><h3>🎁 환영 선물</h3><p>처음에는 <b>${OPEN.map(name).join(' · ')}</b>이 열려 있어요.<br>잠긴 게임 하나를 열 수 있는 <b>🗝️ 열쇠 1개</b>를 줄게요!</p>`,
          [{ text: '받기', cls: 'pink', on: () => { busy = false; refreshHub(); check(); } }]);
        return;
      }
      if (s.att.last !== today()) {
        busy = true;
        const n = s.att.count + 1, bonus = ATT_BONUS[n];
        const next = Object.keys(ATT_BONUS).map(Number).find((d) => d > n);
        modal(`<h3>📅 출석 ${n}일째</h3><p>오늘의 선물: <b>💎 다이아 ${ATT_DAILY}개</b>${bonus ? `<br>🎉 ${n}일 선물: <b>${bonus.text}</b>` : ''}</p>${next ? `<p style="font-size:13px">${next}일째 선물: ${ATT_BONUS[next].text}</p>` : ''}`,
          [{ text: '출석하기', cls: 'pink', on: () => {
            Hub.mutate((c) => { const v = c.v3; if (v.att.last === today()) return; v.att.last = today(); v.att.count = n; c.gems = (c.gems || 0) + ATT_DAILY + ((bonus && bonus.gems) || 0); v.tickets += (bonus && bonus.tickets) || 0; });
            pop(`💎 +${ATT_DAILY + ((bonus && bonus.gems) || 0)}${bonus && bonus.tickets ? '  🗝️ +1' : ''}`); busy = false; refreshHub();
          } }], '누적 출석이에요 (빠진 날이 있어도 이어져요)');
      }
    };
    new MutationObserver(check).observe(lobby, { attributes: true, attributeFilter: ['class'] });
    setTimeout(check, 600);
  }
  }
})();
