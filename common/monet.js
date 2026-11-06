'use strict';
// v0.3 상용화 검수(웹): 게임 잠금 · 체험 · 열쇠 · 다이아 · 출석 · 가짜 광고(2배 받기·이어하기) · 가짜 결제
// 규칙과 숫자: docs/spec/트윈게임랜드_스펙_v1.3.md (🟡 임시값은 아래 상수만 바꾸면 됨)
// 모두 이 폰 안(twin_gameland_v1 의 캐릭터마다 c.gems, c.v3)에만 저장 — 진짜 돈·진짜 광고 없음
// common/profile.js 가 기본 주소(v0.3)에서만 불러옴. 보관판(v0.1·v0.2)에서는 안 불림
(function () {
  if (!window.Hub || Hub.ver !== '0.4') return;
  const SRC = (document.currentScript && document.currentScript.src) || '';
  // 게임 코드(startStage·startRun)와 화면이 다 준비된 뒤에 시작
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main); else main();
  function main() {

  // ---------- 숫자 (🟡 임시값) ----------
  const OPEN = ['downhill', 'bakery', 'mole'];        // 처음부터 열린 게임 (놀이공원 맨 아래 자리 3곳)
  const PRICES = [60, 80, 100, 120, 140, 160, 180];  // 다이아로 N번째 열 때 가격 (열쇠로 연 건 안 셈)
  const TRIAL_STAGES = 2;                             // 잠긴 스테이지 게임: 쉬움 1-1, 1-2까지
  const TRIAL_SEC = 30;                               // 잠긴 끝없는 게임: 한 판에 30초
  const TRIAL_ROUNDS = { darts: 2 };                  // 라운드로 끝나는 게임은 시간 대신 라운드 (다트: 2라운드까지)
  const GEM_EVERY = 10;                               // 게임 10판마다 다이아 1개
  const AD_SEC = 1;                                   // 가짜 광고 길이 (검수판: 1초만 띄우고 진짜 광고를 본 것과 같은 흐름으로)
  const ATT_DAILY = 2;                                // 출석 매일 다이아 (BM B안)
  // ---------- BM B안 (docs/bm/BM_제안_v1.md, 2026-11-01 사용자 결정) — 숫자는 모두 🟡 임시값 ----------
  // 게임 성과 다이아 (모두 처음 한 번만, 열린 게임에서만): 스테이지 게임 월드(10판) 첫 클리어 · 월드 별 30개 · 사천성 어려움 월드
  //  끝없는 게임은 기록 5단계를 처음 넘을 때 (단계마다 STEP_GEMS). 기록 = Hub.record 의 dist (m 또는 점)
  const WORLD_GEMS = 5, STAR_GEMS = 3, HARD_WORLD_GEMS = 8;
  const STEP_GEMS = [2, 3, 4, 5, 6];
  const GOALS = { downhill: [300, 1000, 2000, 3500, 5000], bakery: [2000, 5000, 10000, 15000, 25000], dogsnack: [2000, 5000, 10000, 15000, 25000],
    helicopter: [100, 300, 600, 1000, 2000], stairs: [50, 100, 200, 400, 700], darts: [200, 300, 400, 500, 600] };
  const UNIT = { downhill: 'm', helicopter: 'm', stairs: 'm', bakery: '점', dogsnack: '점', darts: '점' };
  const AD_GEMS = 2, AD_GEMS_DAY = 3;                 // 광고 보고 다이아 2개, 하루 3번
  // 다이아 상품 (원화, 구글 가격 칸). 첫 결제는 2배
  const PACKS = [{ id: 'diamond_60', gems: 60, won: 1200 }, { id: 'diamond_140', gems: 140, won: 2500 }, { id: 'diamond_300', gems: 300, won: 5000, hot: true }, { id: 'diamond_650', gems: 650, won: 10000 }];
  const OFFERS = [
    { id: 'unlock_all', won: 6900, name: '모든 게임 열기', desc: '잠긴 게임을 한 번에 모두 열어요 (한 번만)', img: 'unlocked_fx' },
    { id: 'gem_pass_30', won: 3900, name: '월 다이아 패스', desc: '바로 60개 + 30일 동안 매일 10개', img: 'pack_2', now: 60, daily: 10, days: 30 },
    { id: 'no_ads_reward', won: 5900, name: '광고 없이 보상', desc: '광고 보상을 광고 없이 바로 (계속)', img: 'ico_ad' },
  ];
  const CONT_PACK = { id: 'continue_10', conts: 10, gems: 30, name: '이어하기권 10장' }; // 다이아 30개로 삼: 게임이 끝났을 때 광고 없이 이어하기
  const won = (n) => n.toLocaleString() + '원';
  const NO_CONTINUE = ['darts']; // 실패 없이 끝나는 게임 (이어하기 자리 없음)

  const ROOT = SRC.replace(/common\/monet\.js.*$/, '');
  // 그림: common/ui/monet/ (GPT U01~U11 → tools/monet_assets.py). 창 틀·버튼은 border-image 로 늘려 씀
  const IMG = ROOT + 'common/ui/monet/', P4 = ROOT + 'common/ui/popup/v4/'; // P4: 공통 팝업 재료 (분홍 = 은유, 파랑 = 은결)
  const I = (n, cls = 'mn-ic') => `<img class="${cls}" src="${IMG}${n}.webp" alt="">`;
  for (const n of ['locked', 'welcome', 'ico_key', 'ico_gem', 'ico_lock']) new Image().src = IMG + n + '.webp';
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
  // BM 기록 (캐릭터마다 c.v3.bm): w 월드 첫 클리어 받음 · s 별 30개 받음 · ms 끝없는 게임 넘은 단계 수 · ad 오늘 광고 다이아 · pass 남은 패스 날 · noAds · paid(첫 결제 했음) · all(모든 게임 열기 삼)
  const bmOf = (s) => (s.bm = s.bm || { w: {}, s: {}, ms: {}, ad: { day: '', n: 0 }, pass: 0, noAds: false, paid: false, all: false });
  const bm = () => bmOf(st());
  window.Monet = { isOpen, st, price }; // 다른 코드·검사 도구용

  // ---------- 화면 조각 (CSS는 여기서 넣음) ----------
  const css = document.createElement('style');
  css.textContent = `
.mn-modal{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;background:rgba(20,30,50,.55);font-family:Jua,system-ui,sans-serif;padding:16px}
.mn-panel{position:relative;width:min(318px,100%);box-sizing:border-box;border:0 solid transparent;border-image:url(${P4}panel_pink.webp) 130 fill / 95px stretch;min-height:200px;padding:16px 20px 22px;text-align:center;color:#5A3B22;overflow:visible;filter:drop-shadow(0 10px 24px rgba(0,0,0,.35))}
.mn-panel h3{margin:-58px auto -12px;width:270px;max-width:100%;height:101px;box-sizing:border-box;padding:6px 44px 0;white-space:nowrap;display:flex;align-items:center;justify-content:center;background:url(${P4}ribbon_pink.webp) center/contain no-repeat;color:#fff;font-size:20px;font-weight:400;line-height:1.1;text-shadow:0 2px 0 var(--who-d),0 0 3px var(--who-d)}
.mn-art{display:block;margin:0 auto 2px;width:auto;max-width:78%;max-height:min(150px,20vh)}
.mn-panel p{margin:6px 0 10px;font-size:15px;line-height:1.45;color:#6B4A30}
.mn-ic{width:1.35em;height:1.35em;object-fit:contain;vertical-align:-.32em}
.mn-have{display:flex;justify-content:center;gap:14px;font-size:15px;margin:2px 0 8px}
.mn-btn{position:relative;display:flex;align-items:center;justify-content:center;gap:4px;width:100%;height:44px;min-height:0;white-space:nowrap;margin:8px 0 0;border:0 solid transparent;border-image:url(${P4}btn_pink.webp) 0 58 fill / 0 22px stretch;background:none;padding:.14em 18px 0;font:inherit;font-size:17px;line-height:1;color:var(--who);cursor:pointer}
.mn-btn.pink{border-image-source:url(${P4}fill_pink.webp);color:#fff;text-shadow:0 2px 0 var(--who-d)}
.mn-btn.fill-b.fill-b.fill-b{border-image-source:url(${P4}fill_blue.webp);color:#fff;text-shadow:0 2px 0 #1F62AE}
.mn-btn.fill-p.fill-p.fill-p{border-image-source:url(${P4}fill_pink.webp);color:#fff;text-shadow:0 2px 0 #B92C62}
html[data-who=eungyeol] .mn-btn{border-image-source:url(${P4}btn_blue.webp)}
html[data-who=eungyeol] .mn-btn.pink{border-image-source:url(${P4}fill_blue.webp)}
html[data-who=eungyeol] .mn-panel{border-image-source:url(${P4}panel_blue.webp)}
html[data-who=eungyeol] .mn-panel h3{background-image:url(${P4}ribbon_blue.webp)}
.mn-art-box{position:relative;background:center/100% 100% no-repeat;box-sizing:border-box;filter:drop-shadow(0 10px 24px rgba(0,0,0,.35));color:#5A3B22;text-align:center}
.mn-art-t{position:absolute;left:0;right:0;transform:translateY(-50%);color:#fff;font-size:1.5em;white-space:nowrap;text-shadow:0 .1em 0 var(--who-d),0 0 .15em var(--who-d)}
.mn-art-c{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.35em}
.mn-art-c p{margin:0;font-size:.86em;line-height:1.35;color:#6B4A30}
.mn-art-c .mn-have{margin:0;font-size:1.05em;gap:1.4em}
.mn-art-c .mn-btns{width:100%}.mn-art-c .mn-btn{height:2.7em;margin:.35em 0 0;font-size:1.05em;padding:.14em 1em 0}
.mn-art-c .mn-note{margin:0;font-size:.66em;line-height:1.3}
.mn-art-x{position:absolute;z-index:2;width:2.7em;height:2.7em;border:0;padding:0;background:url(${P4}x_pink.webp) center/contain no-repeat;cursor:pointer}
html[data-who=eungyeol] .mn-art-x{background-image:url(${P4}x_blue.webp)}
.mn-art-box.wel .mn-art-c{gap:.1em}.mn-art-box.wel p{font-size:.76em;line-height:1.3}.mn-art-box.wel .mn-btn{height:2.3em;margin:.2em auto 0;width:72%;font-size:1em}
.mn-art-box.pk{--who:#E8457F;--who-d:#B92C62}.mn-art-box.pk .mn-art-x{background-image:url(${P4}x_pink.webp)}
.mn-cells{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:.3em;width:100%}
.mn-cell{position:relative;aspect-ratio:160/170;background:center/100% 100% no-repeat;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;font-size:.72em;line-height:1;padding-bottom:.25em;color:#6B4A30}
.mn-cell i{position:absolute;top:9.5%;left:0;right:0;text-align:center;font-style:normal;font-size:.86em;color:#fff;text-shadow:0 1px 1px rgba(0,0,0,.35)}
.mn-cell img{width:52%;height:46%;object-fit:contain;margin-bottom:.1em}
.mn-cell.now{animation:mnBeat 1s ease-in-out infinite}
.mn-cell.got img,.mn-cell.got b{opacity:0}
.mn-cell b{font-weight:400}
.mn-btn:active{transform:translateY(2px)}.mn-btn:disabled{opacity:.45}
.mn-note{font-size:12px;color:#9A8470;margin-top:10px}
.mn-tag{display:inline-block;background:#FFE9F0;color:#D24C73;border-radius:8px;padding:1px 8px;font-size:12px;margin:2px 0 4px}
.mn-packs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:6px 0 2px}
.mn-pack{display:flex;flex-direction:column;align-items:center;gap:2px;border:0;background:rgba(255,255,255,.65);border-radius:14px;padding:6px 4px 0;font:inherit;color:#5A3B22;cursor:pointer}
.mn-pack{min-width:0;box-sizing:border-box}.mn-pack>img{height:56px;width:auto;max-width:100%;object-fit:contain}.mn-pack .mn-btn img{height:1.15em;width:auto}
.mn-pack{position:relative}.mn-flag{position:absolute;left:4px;top:4px;z-index:1;background:#FF5C7A;color:#fff;font-style:normal;font-size:11px;border-radius:8px;padding:1px 6px}.mn-won{font-size:12px;color:#8A6E58;margin:-2px 0 4px}
.mn-pack.offer{width:100%;margin-top:6px;display:grid;grid-template-columns:52px 1fr auto;grid-template-rows:auto auto;column-gap:8px;align-items:center;text-align:left;padding:6px 8px}
.mn-pack.offer>img{grid-row:1/3;width:40px;height:auto}.mn-pack.offer{grid-template-columns:44px minmax(0,1fr) auto}.mn-pack.offer b{font-weight:400;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mn-pack.offer small{grid-column:2;font-size:11px;color:#8A6E58}
.mn-pack.offer .mn-btn{grid-column:3;grid-row:1/3;width:auto;min-width:72px;margin:0;padding:3px 12px 6px;height:34px;font-size:14px;white-space:nowrap}.mn-pack:disabled{opacity:.55}
.mn-pack.cont{grid-column:1/-1;display:grid;grid-template-columns:52px 1fr auto;grid-template-rows:auto auto;column-gap:8px;align-items:center;text-align:left;padding:6px 8px}
.mn-pack.cont>img{grid-row:1/3;width:44px;height:auto}.mn-pack.cont b{font-weight:400;font-size:14px}.mn-pack.cont small{grid-column:2;font-size:11px;color:#8A6E58}
.mn-pack.cont .mn-btn{grid-column:3;grid-row:1/3;width:auto;min-width:72px;margin:0;padding:3px 12px 6px;height:34px}.mn-pack .mn-btn{height:38px;min-height:0;font-size:15px;padding:3px 10px 6px;border-image-width:0 19px}
.mn-stamps{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin:4px 6px 6px}
.mn-stamps span{position:relative;aspect-ratio:1;display:flex;align-items:center;justify-content:center}
.mn-stamps img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.mn-stamps i{position:relative;font-style:normal;font-size:12px;color:#B79A80}
.mn-stamps .on i{color:#fff;text-shadow:0 1px 0 #B03040}
.mn-stamps .now{animation:mnBeat 1s ease-in-out infinite}
@keyframes mnBeat{50%{transform:scale(1.12)}}
.mn-bonus{display:flex;align-items:center;justify-content:center;gap:6px}.mn-bonus img{height:44px}
.mn-ad{position:fixed;inset:0;z-index:9500;background:#111;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Jua,system-ui,sans-serif;text-align:center;gap:12px}
.mn-ad img{width:84px}.mn-ad b{font-size:64px}.mn-ad span{font-size:16px;opacity:.85;padding:0 24px}
#mnEarnRow{display:flex;justify-content:center;gap:10px;width:100%;flex:none}#mnEarnRow>*{flex:1 1 0;min-width:0;text-align:center}
.mn-big{display:flex;align-items:center;justify-content:center;gap:4px;font-size:21px;line-height:1.2}.mn-bigic{width:24px;height:24px;object-fit:contain;flex:none}
.mn-gemline{color:#3D8BFF;font-size:20px;line-height:1.25;text-align:center;font-family:Jua,system-ui,sans-serif}.mn-gemline .mn-ic{width:1.1em;height:1.1em}.mn-gemline small{display:block;font-size:13px;color:#8A6E58}
.mn-block{position:fixed;inset:0;z-index:9500;background:transparent}
.mn-trial{position:fixed;left:50%;top:calc(8px + env(safe-area-inset-top));transform:translateX(-50%);z-index:8000;display:flex;align-items:center;gap:4px;background:rgba(43,58,103,.85);color:#fff;font-family:Jua,system-ui,sans-serif;font-size:15px;border-radius:12px;padding:3px 12px 3px 6px;pointer-events:none}
.mn-pop{position:fixed;left:50%;top:40%;transform:translate(-50%,-50%);z-index:9600;display:flex;align-items:center;gap:6px;white-space:nowrap;background:rgba(43,58,103,.92);color:#fff;font-family:Jua,system-ui,sans-serif;font-size:20px;border-radius:16px;padding:10px 18px;pointer-events:none;animation:mnPop 1.6s ease forwards}
@keyframes mnPop{0%{opacity:0;transform:translate(-50%,-30%)}15%{opacity:1;transform:translate(-50%,-50%)}80%{opacity:1}100%{opacity:0}}
.mn-fx{position:fixed;left:50%;top:40%;z-index:9550;width:min(320px,80vw);transform:translate(-50%,-50%) scale(.3);opacity:0;pointer-events:none;animation:mnFx 1.7s ease-out forwards}
@keyframes mnFx{0%{opacity:0;transform:translate(-50%,-50%) scale(.3) rotate(-8deg)}20%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}35%{transform:translate(-50%,-50%) scale(1)}75%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1.15)}}
.pk-ride.mn-locked .art{filter:grayscale(.55) brightness(.92)}
.mn-lock{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 4px rgba(0,0,0,.35));pointer-events:none}
.mn-lock img{width:42px;height:auto}
.mn-lock small{display:flex;align-items:center;justify-content:center;width:52px;height:30px;margin-top:-8px;padding-bottom:3px;box-sizing:border-box;background:url(${IMG}ico_trial.webp) center/contain no-repeat;color:#fff;font-size:12px;text-shadow:0 1px 0 #C2406A;font-family:Jua,system-ui,sans-serif}
`;
  document.head.appendChild(css);

  const esc = (t) => String(t).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
  // 창 하나 띄우기. buttons: [{ text(그림 태그 포함 가능), cls, on(), off }] — 누르면 창을 닫고 on() 실행
  function modal(html, buttons, note) {
    const m = document.createElement('div'); m.className = 'mn-modal';
    m.innerHTML = `<div class="mn-panel">${html}<div class="mn-btns"></div>${note ? `<div class="mn-note">${note}</div>` : ''}</div>`;
    const box = m.querySelector('.mn-btns');
    for (const b of buttons) {
      const el = document.createElement('button'); el.className = 'mn-btn ' + (b.cls || ''); el.innerHTML = b.text; el.disabled = !!b.off;
      el.addEventListener('click', (e) => { e.stopPropagation(); if (window.UI) UI.blip(); m.remove(); const k = block(); setTimeout(k, 400); if (b.on) b.on(); });
      box.appendChild(el);
    }
    for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'keydown']) m.addEventListener(ev, (e) => e.stopPropagation());
    document.body.appendChild(m);
    // 창이 화면보다 크면 창 전체를 줄임 (위 리본이 잘리지 않게 — 스크롤 대신)
    const pn = m.querySelector('.mn-panel'), room = window.innerHeight - 40;
    if (pn.offsetHeight > room) pn.style.zoom = Math.max(0.6, room / pn.offsetHeight);
    return m;
  }
  // 그림 한 장이 창인 팝업 (환영 선물·출석·잠긴 게임). 글자·버튼은 그림의 빈 칸에 얹음 (글자는 언어별로 바뀜)
  //  o: { img, ar(가로/세로), title, titleY(%), titleX(%), box:[위, 오른쪽, 아래, 왼쪽](%), html, buttons, note, onX, xPos:[위, 오른쪽](%) }
  function artModal(o) {
    const m = modal('', o.buttons, o.note); const pn = m.querySelector('.mn-panel'), btns = pn.querySelector('.mn-btns'), note = pn.querySelector('.mn-note');
    const w = Math.min(innerWidth - 24, (innerHeight - 24) * o.ar, 420);
    pn.className = 'mn-art-box' + (o.pink ? ' pk' : '') + (o.cls ? ' ' + o.cls : ''); pn.style.cssText = `width:${w}px;height:${w / o.ar}px;font-size:${w / 340 * 16}px;background-image:url(${IMG}${o.img}.webp)`;
    pn.innerHTML = `<div class="mn-art-t" style="top:${o.titleY}%;${o.titleX ? `left:${o.titleX}%;right:auto;transform:translate(-50%,-50%)` : ''}">${o.title}</div><div class="mn-art-c" style="top:${o.box[0]}%;right:${o.box[1]}%;bottom:${o.box[2]}%;left:${o.box[3]}%">${o.html}</div>`;
    const c = pn.querySelector('.mn-art-c'); c.appendChild(btns); if (note) c.appendChild(note);
    if (o.onX !== undefined) {
      const x = document.createElement('button'); x.className = 'mn-art-x'; x.setAttribute('aria-label', '닫기'); x.style.top = (o.xPos || [0, 0])[0] + '%'; x.style.right = (o.xPos || [0, 0])[1] + '%';
      x.addEventListener('click', (e) => { e.stopPropagation(); if (window.UI) UI.blip(500); m.remove(); const k = block(); setTimeout(k, 400); if (o.onX) o.onX(); }); pn.appendChild(x);
    }
    return m;
  }
  // 화면 전체를 잠깐 막는 투명 막 (창을 닫을 때 손을 뗀 터치가 뒤의 놀이기구·버튼을 누르지 않게). 돌려주는 함수를 부르면 걷힘
  function block() {
    const d = document.createElement('div'); d.className = 'mn-block';
    for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click', 'mousedown']) d.addEventListener(ev, (e) => { e.stopPropagation(); e.preventDefault(); }, true);
    document.body.appendChild(d); return () => d.remove();
  }
  function pop(html) { const p = document.createElement('div'); p.className = 'mn-pop'; p.innerHTML = html; document.body.appendChild(p); setTimeout(() => p.remove(), 1700); }
  // 게임 열림 축하 (U10): 가운데 팡!
  function fx() { const f = document.createElement('img'); f.className = 'mn-fx'; f.src = IMG + 'unlocked_fx.webp'; f.alt = ''; document.body.appendChild(f); setTimeout(() => f.remove(), 1800); }
  const haveLine = () => `<div class="mn-have"><span>${I('ico_key')} 열쇠 <b>${st().tickets}</b></span><span>${I('ico_gem')} 다이아 <b>${Hub.gems()}</b></span></div>`;
  const refreshHub = () => { const el = document.getElementById('meGems'); if (el) el.textContent = Hub.gems(); decorateRides(); };

  // 가짜 광고: AD_SEC초 세고 done()
  function fakeAd(done) {
    if (st().bm && st().bm.noAds) { done(); return; } // '광고 없이 보상' 산 사람은 광고 없이 바로
    const a = document.createElement('div'); a.className = 'mn-ad';
    a.innerHTML = `<img src="${IMG}ico_ad.webp" alt=""><div>광고 자리</div><span>앱에서는 여기서 보상형 광고가 나와요<br>(웹 검수판: ${AD_SEC}초 뒤 광고를 본 것처럼 이어져요)</span>`;
    for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'click', 'keydown']) a.addEventListener(ev, (e) => e.stopPropagation());
    document.body.appendChild(a);
    setTimeout(() => { a.remove(); done(); }, AD_SEC * 1000);
  }

  // 다이아 상점 (가짜 결제): 광고 보고 다이아 · 다이아 4종(원화, 첫 결제 2배) · 묶음 상품 3개 · 이어하기권(다이아로)
  const adLeft = () => { const a = bm().ad; return a.day === today() ? AD_GEMS_DAY - a.n : AD_GEMS_DAY; };
  function gemShop(after) {
    const B = bm(), first = !B.paid, lockedLeft = Object.keys(G).filter((g) => !isOpen(g) && g !== 'skyhook').length;
    const offer = (o) => {
      if (o.id === 'unlock_all' && (B.all || !lockedLeft)) return '';
      const have = (o.id === 'no_ads_reward' && B.noAds) ? '가지고 있어요' : (o.id === 'gem_pass_30' && B.pass > 0) ? `${B.pass}일 남음` : '';
      return `<button class="mn-pack offer" data-o="${o.id}"${have && o.id === 'no_ads_reward' ? ' disabled' : ''}><img src="${IMG}${o.img}.webp" alt=""><b>${o.name}</b><small>${have || o.desc}</small><span class="mn-btn pink">${won(o.won)}</span></button>`;
    };
    const m = modal(`<h3>다이아 상점</h3><span class="mn-tag">검수용 · 진짜 결제 없음</span>${haveLine()}
      <button class="mn-pack offer ad" data-ad="1"${adLeft() > 0 ? '' : ' disabled'}><img src="${IMG}ico_ad.webp" alt=""><b>광고 보고 받기</b><small>${I('ico_gem')} ${AD_GEMS}개 · 오늘 ${adLeft()}번 남음</small><span class="mn-btn gold">${adLeft() > 0 ? '받기' : '내일 또'}</span></button>
      <div class="mn-packs">${PACKS.map((p, i) => `<button class="mn-pack" data-i="${i}">${first ? '<i class="mn-flag">첫 구매 2배</i>' : p.hot ? '<i class="mn-flag">인기</i>' : ''}<img src="${IMG}pack_${i + 1}.webp" alt=""><span class="mn-btn gold">${I('ico_gem')}${first ? p.gems * 2 : p.gems}</span><small class="mn-won">${won(p.won)}</small></button>`).join('')}</div>
      ${OFFERS.map(offer).join('')}
      <button class="mn-pack offer cont" data-i="cont"><img src="${IMG}pack_continue.webp" alt=""><b>${CONT_PACK.name}</b><small>지금 ${st().conts || 0}장</small><span class="mn-btn gold">${I('ico_gem')}${CONT_PACK.gems}</span></button>
      <p style="font-size:12px;margin:6px 0 0">앱에서는 여기서 구글 결제 창이 떠요 (값은 🟡 임시).</p>`,
      [{ text: '닫기', cls: 'gray', on: after }],
      '상품 ID: ' + PACKS.map((p) => p.id).concat(OFFERS.map((o) => o.id)).join(' · '));
    const reopen = () => gemShop(after);
    m.querySelectorAll('.mn-pack').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation(); if (b.disabled) return; if (window.UI) UI.blip(); m.remove();
      if (b.dataset.ad) { fakeAd(() => { Hub.mutate((c) => { const a = bmOf(c.v3 || (c.v3 = fresh())).ad; if (a.day !== today()) { a.day = today(); a.n = 0; } a.n++; c.gems = (c.gems || 0) + AD_GEMS; }); pop(`${I('ico_gem')} +${AD_GEMS}`); refreshHub(); reopen(); }); return; }
      if (b.dataset.i === 'cont') { buyConts(reopen); return; }
      if (b.dataset.o) { fakePay(OFFERS.find((o) => o.id === b.dataset.o), reopen); return; }
      fakePay(PACKS[+b.dataset.i], reopen);
    }));
  }
  // 이어하기권: 다이아 30개로
  function buyConts(after) {
    if (Hub.gems() < CONT_PACK.gems) { pop('다이아가 모자라요'); if (after) after(); return; }
    Hub.mutate((c) => { c.gems -= CONT_PACK.gems; const v = c.v3 || (c.v3 = fresh()); v.conts = (v.conts || 0) + CONT_PACK.conts; });
    pop(`${I('ico_continue')} 이어하기권 +${CONT_PACK.conts}`); refreshHub(); if (after) after();
  }
  // 가짜 결제 창: 다이아 상품(첫 결제 2배) 또는 묶음 상품
  function fakePay(p, after) {
    const isPack = PACKS.includes(p), first = !bm().paid, gems = isPack ? (first ? p.gems * 2 : p.gems) : 0;
    const art = isPack ? `pack_${PACKS.indexOf(p) + 1}` : p.img;
    modal(`<h3>${isPack ? `다이아 ${gems}개` : p.name}</h3><span class="mn-tag">검수용 가짜 결제 · ${won(p.won)}</span><img class="mn-art" src="${IMG}${art}.webp" alt="" style="max-height:110px"><p>${isPack ? (first ? '첫 결제라서 2배로 받아요!<br>' : '') : p.desc + '<br>'}여기가 앱의 결제 창 자리예요.<br>확인을 누르면 바로 들어와요 (돈 안 나감).</p>`,
      [{ text: `확인 (가짜 결제 ${won(p.won)})`, cls: 'gold', on: () => {
        Hub.mutate((c) => {
          const v = c.v3 || (c.v3 = fresh()), B = bmOf(v); B.paid = true;
          if (isPack) c.gems = (c.gems || 0) + gems;
          else if (p.id === 'unlock_all') { B.all = true; for (const g of Object.keys(G)) if (!OPEN.includes(g) && !v.unlocked.includes(g)) v.unlocked.push(g); }
          else if (p.id === 'gem_pass_30') { B.pass += p.days; c.gems = (c.gems || 0) + p.now; }
          else if (p.id === 'no_ads_reward') B.noAds = true;
        });
        pop(isPack ? `${I('ico_gem')} +${gems}` : p.id === 'gem_pass_30' ? `${I('ico_gem')} +${p.now} · 패스 ${p.days}일` : `${p.name}!`);
        if (p.id === 'unlock_all') fx();
        refreshHub(); if (after) after();
      } }, { text: '취소', cls: 'gray', on: after }]);
  }

  // 게임 열기 창. opts: { trial(): 체험하기, trialText, onOpen(), onClose() }
  function unlockBox(g, opts = {}) {
    const s = st(), p = price(), enough = Hub.gems() >= p, hasKey = s.tickets >= 1;
    // 버튼 2개: 열쇠가 있으면 열쇠로, 없으면 다이아로 / 체험. 닫기는 오른쪽 위 X
    const btns = [hasKey
      ? { text: `${I('ico_key')} 열쇠 1개로 열기`, cls: 'fill-p', on: () => done(unlock(g, 'ticket')) }
      : { text: `${I('ico_gem')} 다이아 ${p}개로 열기`, cls: 'fill-p', on: () => (enough ? done(unlock(g, 'gem')) : gemShop(() => unlockBox(g, opts))) }];
    if (opts.trial) btns.push({ text: opts.trialText || '▶ 체험해 보기', cls: 'fill-b', on: opts.trial });
    function done(ok) {
      if (!ok) { pop('열 수 없어요'); return; }
      if (window.UI) UI.blip(1046);
      fx(); setTimeout(() => pop(`${esc(name(g))} 열림!`), 500); refreshHub(); if (opts.onOpen) opts.onOpen();
    }
    artModal({ img: 'locked', pink: true, ar: 720 / 981, title: '잠겨 있는 게임이에요!', titleY: 39.5, titleX: 57, box: [46, 9, 12, 9], buttons: btns, onX: opts.onClose || null, xPos: [31, -1],
      html: `<p><b>${esc(name(g))}</b></p>${opts.msg ? `<p>${opts.msg}</p>` : '<p>이 게임을 열고 더 많은 즐거움을 만나 보세요!</p>'}${haveLine()}`,
      note: `한 번 열면 언제든지 계속 할 수 있어요!<br>다이아로 연 횟수에 따라 값이 올라요: ${PRICES.join(' → ')}` });
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
    // 이번 판에 받은 다이아: [[개수, 이유] …] → 결과 창 코인 줄 아래에 표시 (QA: 다이아도 결과 창에)
    const got = (isOpen(game) ? playGems(game, r) : []);
    if (gem) got.unshift([1, `게임 ${GEM_EVERY}판마다`]);
    const gems = got.reduce((a, [n]) => a + n, 0);
    setTimeout(() => gemLine(gems, got), 900);
    if (isOpen(game)) { // 체험 중에는 광고 없음
      const failed = G[game].stages ? !r.cleared : !NO_CONTINUE.includes(game);
      setTimeout(() => rewardBar(res.earned || 0, failed, 0, gems), 900);
    }
    return res;
  };
  // 결과 창 '+N 코인 획득!' 바로 아래에 '💎 +N 다이아 획득!' (이유는 작은 글자). 못 받았으면 다음 다이아까지 남은 판 수
  const short = (why) => why.replace('게임 ', '').replace('기록 ', '').replace(' 달성!', '').replace(' 첫 클리어!', ' 클리어').replace('!', ''); // 결과 창 작은 글자는 짧게
  function gemLine(n, got, tries = 0) {
    const earn = document.querySelector('#result:not(.hidden) #resEarn');
    if (!earn) { if (tries < 15) setTimeout(() => gemLine(n, got, tries + 1), 300); return; }
    let el = document.getElementById('mnGems');
    if (!el) { el = document.createElement('div'); el.id = 'mnGems'; el.className = 'mn-gemline'; }
    // 코인·다이아를 좌우로 나란히 (다이아를 못 받으면 코인만 가운데, 그 아래 다음 다이아 안내)
    let row = document.getElementById('mnEarnRow');
    if (!row) { row = document.createElement('div'); row.id = 'mnEarnRow'; earn.before(row); row.appendChild(earn); }
    if (n > 0) row.appendChild(el); else row.after(el);
    const left = GEM_EVERY - ((st().plays || 0) % GEM_EVERY);
    el.innerHTML = n > 0 ? `<span class="mn-big">${I('ico_gem', 'mn-bigic')}+${n} 획득</span><small>${got.map(([k, why]) => `${esc(short(why))} +${k}`).join(' · ')}</small>`
      : `<small>${I('ico_gem')} 다음 다이아까지 ${left}판</small>`;
    el.dataset.n = n;
    const panel = earn.closest('.panel'); if (panel && window.PopupUI) PopupUI.fit(panel);
  }
  // 결과 창 코인 글: 게임마다 '+N 코인 획득!' 으로 넣음 → 코인 그림 + '+N 획득' + 작은 설명으로 바꿈
  function coinLine() {
    const earn = document.getElementById('resEarn'); if (!earn || earn.querySelector('.mn-big')) return;
    const n = earn.firstChild && earn.firstChild.nodeType === 3 && earn.firstChild.nodeValue.match(/^\s*\+([\d,]+)/); if (!n) return;
    earn.firstChild.remove();
    earn.insertAdjacentHTML('afterbegin', `<span class="mn-big"><img class="mn-bigic" src="${ROOT}common/ui/coin.webp" alt="">+${n[1]} 획득</span>`);
  }
  { const e = document.getElementById('resEarn'); if (e) new MutationObserver(coinLine).observe(e, { childList: true }); }
  // 게임 성과 다이아 (BM B안): 처음 한 번만. 돌려줌: [[다이아, 이유] …]
  function playGems(game, r) {
    const GM = G[game], out = [];
    Hub.mutate((c) => {
      const v = c.v3 || (c.v3 = fresh()), B = bmOf(v);
      let add = 0;
      if (GM.stages) {
        if (!r.cleared || r.stage == null) return;
        const hard = r.stage >= GM.stages, k = GM.perWorld, w = Math.floor((r.stage % GM.stages) / k), o = (hard ? GM.stages : 0) + w * k;
        const sts = Array.from({ length: k }, (_, i) => Hub.stage(game, o + i, c));
        const key = `${game}-${hard ? 'h' : 'e'}${w}`, label = `${hard ? '어려움 ' : ''}${w + 1}월드`;
        if (sts.every((x) => x.cleared) && !B.w[key]) { B.w[key] = 1; const n = hard ? HARD_WORLD_GEMS : WORLD_GEMS; add += n; out.push([n, `${label} 첫 클리어!`]); }
        if (!hard && sts.reduce((a, x) => a + (x.stars || 0), 0) >= k * 3 && !B.s[key]) { B.s[key] = 1; add += STAR_GEMS; out.push([STAR_GEMS, `${label} 별 ${k * 3}개!`]); }
      } else if (GOALS[game]) {
        const goals = GOALS[game], had = B.ms[game] || 0;
        let now = had; while (now < goals.length && (r.dist || 0) >= goals[now]) now++;
        for (let i = had; i < now; i++) { add += STEP_GEMS[i]; out.push([STEP_GEMS[i], `기록 ${goals[i].toLocaleString()}${UNIT[game]} 달성!`]); }
        B.ms[game] = now;
      }
      c.gems = (c.gems || 0) + add;
    });
    return out;
  }
  // 결과 창의 ① 광고 줄(common/popup.js 가 만든 .pp-ad)에 광고 버튼: 코인 2배 · 이어하기 (이어하기권이 있으면 광고 없이)
  //  1개면 한 줄 가득, 2개면 반씩 나란히 (common/popup.css)
  function rewardBar(earned, failed, tries = 0, gems = 0) {
    document.querySelectorAll('.pp-ad').forEach((x) => { x.innerHTML = ''; });
    if (!(earned > 0) && !(gems > 0) && !failed) return;
    const panel = document.querySelector('#result:not(.hidden) .panel');
    if (!panel) { if (tries < 15) setTimeout(() => rewardBar(earned, failed, tries + 1, gems), 300); return; } // 결과 창이 늦게 뜨는 게임은 뜰 때까지 기다림
    if (window.PopupUI) PopupUI.arrange(panel);
    const row = panel.querySelector('.pp-ad'); if (!row) return;
    // 버튼 왼쪽 흰 동그라미에 아이콘, 오른쪽에 위 작은 글자(광고 보고) + 큰 글자
    const add = (top, text, cls, ico, fn) => {
      const b = document.createElement('button'); b.className = 'pp-adb ' + cls; b.innerHTML = I(ico, '') + `<span><small>${top}</small><b>${text}</b></span>`;
      for (const ev of ['pointerdown', 'pointerup', 'touchstart']) b.addEventListener(ev, (e) => e.stopPropagation());
      b.addEventListener('click', (e) => { e.stopPropagation(); if (b.disabled) return; b.disabled = true; fn(b); }); row.appendChild(b); return b; // 누르면 바로 못 누름
    };
    const say = (b, t) => { b.querySelector('small').textContent = ''; b.querySelector('b').textContent = t; };
    // 2배 받기 = 이번 판에 받은 코인과 다이아를 한 번 더 (위 작은 글자에 둘 다 보여 줌)
    const what = [earned > 0 ? `+${earned} 코인` : '', gems > 0 ? `💎+${gems}` : ''].filter(Boolean).join(' · ');
    const dbl = add('광고 보고', '2배 받기', 'dbl', 'ico_ad', (b) => fakeAd(() => {
      Hub.addCoins(earned); if (gems > 0) addGems(gems);
      say(b, '받았어요!'); pop(`${I('ico_x2')} ${what}`); refreshHub();
      const gl = document.getElementById('mnGems'); if (gl && gems > 0) gl.insertAdjacentHTML('beforeend', `<small>2배 받기 +${gems}</small>`);
    }));
    if (!(earned > 0) && !(gems > 0)) dbl.disabled = true;
    if (failed) {
      // 이어하기: 게임이 window.GameContinue = { can(), go() } 를 주면 광고 뒤 그 자리에서 이어서 (화면을 한 번 터치하면 다시 움직임)
      //  한 판에 한 번만 (can() 이 false 면 회색 버튼으로 자리만)
      const GC = window.GameContinue, cont = () => st().conts || 0;
      const go = (b) => { if (GC) GC.go(); else say(b, '연결 예정이에요'); };
      let cb;
      if (cont() > 0) cb = add(`이어하기권 ${cont()}장`, '이어하기', 'cont', 'ico_continue', (b) => { Hub.mutate((c) => { c.v3.conts--; }); go(b); });
      else cb = add('광고 보고', '이어하기', 'cont', 'ico_ad', (b) => fakeAd(() => go(b)));
      if (GC && !GC.can()) cb.disabled = true;
    }
    if (window.PopupUI) PopupUI.fit(panel);
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
    } else if (TRIAL_ROUNDS[gameId]) {
      // 라운드 게임(다트): 정한 라운드까지만. 위에 '체험 2라운드까지', 끝나면 게임 열기 창
      const n = TRIAL_ROUNDS[gameId];
      const tag = document.createElement('div'); tag.className = 'mn-trial'; tag.innerHTML = `${I('ico_lock')} 체험 ${n}라운드까지`; document.body.appendChild(tag);
      window.DART_TRIAL = { rounds: n, on: () => !isOpen(gameId),
        end: () => unlockBox(gameId, { msg: `체험 ${n}라운드가 끝났어요!<br>열면 8라운드 끝까지 할 수 있어요.`, closeText: '나가기', onClose: toMap, onOpen: () => location.reload() }) };
    } else {
      // 끝없는 게임: 한 판에 30초. 위에 남은 시간, 끝나면 게임 열기 창
      let left = TRIAL_SEC, timer = 0, tag = null;
      const stop = () => { clearInterval(timer); if (tag) tag.remove(); tag = null; };
      const begin = () => {
        if (isOpen(gameId)) return;
        stop(); left = TRIAL_SEC;
        tag = document.createElement('div'); tag.className = 'mn-trial'; document.body.appendChild(tag);
        const draw = () => { tag.innerHTML = `${I('ico_lock')} 체험 ${left}초`; };
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
  function decorateRides() {
    if (!world) return;
    world.querySelectorAll('.pk-ride[data-id]').forEach((b) => {
      const locked = !isOpen(b.dataset.id);
      b.classList.toggle('mn-locked', locked);
      let L = b.querySelector('.mn-lock');
      if (locked && !L) { L = document.createElement('span'); L.className = 'mn-lock'; L.innerHTML = I('ico_lock', '') + '<small>체험</small>'; b.appendChild(L); }
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
      const trialText = G[g].stages ? '▶ 체험해 보기 (1-1, 1-2)' : TRIAL_ROUNDS[g] ? `▶ 체험해 보기 (${TRIAL_ROUNDS[g]}라운드)` : `▶ 체험해 보기 (${TRIAL_SEC}초)`;
      // 열고 나면 게임 첫 화면(인트로)이 뜰 때까지 화면을 막아 둠 (그사이 다른 놀이기구가 눌려 다른 게임이 열리지 않게)
      unlockBox(g, { trial: () => { allow = g; b.click(); }, trialText, onOpen: () => { const k = block(); setTimeout(() => { allow = g; b.click(); k(); }, 1500); } });
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
        artModal({ img: 'welcome', pink: true, ar: 720 / 1013, title: '', titleY: 0, cls: 'wel', box: [72.5, 11, 5.5, 11], buttons: [{ text: '받기', cls: 'fill-p', on: () => { busy = false; refreshHub(); check(); } }],
          html: `<p>처음에는 <b>${OPEN.map(name).join(' · ')}</b>이 열려 있어요.<br>잠긴 게임 하나를 열 수 있는 <b>${I('ico_key')} 열쇠 1개</b>를 줄게요!</p>` });
        return;
      }
      if (s.att.last !== today()) {
        busy = true;
        // 1~9일차 다이아 2개, 10일차 열쇠 1개 (10일마다 되풀이). 빠진 날이 있어도 누적
        const n = s.att.count + 1, isKey = n % 10 === 0, base = Math.floor((n - 1) / 10) * 10, who = document.documentElement.dataset.who === 'eungyeol' ? 'eungyeol' : 'eunyu';
        const cells = Array.from({ length: 10 }, (_, i) => {
          const d = base + i + 1, last = d % 10 === 0, got = d < n, now = d === n;
          const bg = got ? 'done' : last ? 'd10' : now ? (who === 'eungyeol' ? 'today_blue' : 'today_pink') : 'normal';
          return `<div class="mn-cell${got ? ' got' : ''}${now ? ' now' : ''}" style="background-image:url(${IMG}cell_${bg}.webp)"><i>${d}일차</i><img src="${IMG}${last ? 'ico_key' : 'ico_gem'}.webp" alt=""><b>${last ? '1개' : `${ATT_DAILY}개`}</b></div>`;
        }).join('');
        const pass = s.bm && s.bm.pass > 0;
        const claim = () => {
          let passGems = 0;
          Hub.mutate((c) => { const v = c.v3; if (v.att.last === today()) return; v.att.last = today(); v.att.count = n; if (isKey) v.tickets += 1; else c.gems = (c.gems || 0) + ATT_DAILY;
            const B = bmOf(v); if (B.pass > 0) { B.pass--; passGems = OFFERS[1].daily; c.gems += passGems; } });
          pop(isKey ? `${I('ico_key')} +1${passGems ? ` ${I('ico_gem')} +${passGems}` : ''}` : `${I('ico_gem')} +${ATT_DAILY + passGems}`); busy = false; refreshHub();
        };
        artModal({ img: `attend_${who}`, ar: 720 / 1047, title: '출석 체크', titleY: 35.5, box: [44, 8.5, 9, 8.5], onX: () => { busy = false; }, xPos: [1, 1], buttons: [{ text: '출석하기', cls: 'pink', on: claim }],
          html: `<div class="mn-cells">${cells}</div>${pass ? `<p>월 다이아 패스: ${I('ico_gem')} +${OFFERS[1].daily} (${s.bm.pass}일 남음)</p>` : ''}`, note: '누적 출석이에요 (빠진 날이 있어도 이어져요)' });
      }
    };
    new MutationObserver(check).observe(lobby, { attributes: true, attributeFilter: ['class'] });
    setTimeout(check, 600);
  }
  }
})();
