'use strict';
// 로그인 · 계정 · 기록 보내기 (common/profile.js 가 모든 화면에서 불러옴)
//  · 첫 화면(index.html)에 처음 들어오면 로그인 창: ① 구글로 로그인 ② 이메일로 로그인 ③ 게스트로 입장하기 + '가입하기 · 비밀번호 재설정'
//  · 가입하기: 생년월일(년·월·일 따로) → 약관 동의(개인정보 수집·이용 · 처리방침 · 이용약관) → 구글 또는 이메일로 가입
//    가입 없이 구글로 처음 들어온 계정도 같은 절차를 거친 뒤에 계정을 만듦 (그만두면 되돌림). 동의 시각은 users.agreedAt
//  · 이메일 가입: 이메일 → 메일로 온 인증번호 6자리 → 비밀번호 정하기. 다음부터 이메일 + 비밀번호.
//    비밀번호 찾기는 없고 '비밀번호 재설정'(메일 인증번호)만 있음. 받는 개인정보는 이메일 하나 (생년월일은 만 14세 이상인지만 보고 저장 안 함)
//  · 게스트: 지금처럼 다 되지만 결제는 절대 안 됨 → "계정연동이 필요합니다." (광고는 됨). 게스트로 하다가 구글·이메일로 연동하면 기록이 그대로 이어짐
//  · Firebase(common/firebase_config.js)가 비어 있으면 게스트만 되고, 기록은 이 기기에 모아 둠 (설정하면 다음 접속 때 보냄)
//  · 저장: 로그인 상태 localStorage 'twin_auth_v1' (게임 저장 데이터 twin_gameland_v1 은 건드리지 않음)
//  · 서버(Firestore): users/{uid} · sessions(사용 시간) · records(게임 기록) · payments(결제) · config/catalog(상점 값) — 구조는 server/README.md
(function () {
  if (window.Auth) return;
  const TERMS_VER = '2026-11'; // 약관을 크게 바꾸면 올림 (users.agreeVer)
  const KEY = 'twin_auth_v1', QKEY = 'twin_auth_queue', CATKEY = 'twin_catalog_v1';
  const SRC = (document.currentScript && document.currentScript.src) || '';
  const ROOT = SRC.replace(/common\/auth\.js.*$/, '');
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };
  let st = read(KEY, {}); // { mode: 'guest'|'google'|'email', uid, email, over14, at }
  const save = () => write(KEY, st);
  const t = (s) => (window.I18N && window.I18N.tr ? window.I18N.tr(s) : s);
  const page = (() => { const m = location.pathname.match(/\/([a-z0-9]+)\/(index\.html)?$/); const g = m && m[1]; return g && window.Hub && Hub.GAMES && Hub.GAMES[g] ? g : 'hub'; })();
  const isHub = /\/(index\.html)?$/.test(location.pathname) && !/\/(shop|closet|admin|v0\.[0-9])\//.test(location.pathname) && page === 'hub';

  // ---------- Firebase (설정이 있을 때만) ----------
  let fb = null, ready = null;
  const loadJs = (u) => new Promise((ok, no) => { const s = document.createElement('script'); s.src = u; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  function firebase() {
    if (!window.FIREBASE_CONFIG) return Promise.resolve(null);
    if (ready) return ready;
    ready = (async () => {
      for (const n of ['app', 'auth', 'firestore', 'functions']) await loadJs(`${SDK}firebase-${n}-compat.js`);
      const app = window.firebase.apps.length ? window.firebase.app() : window.firebase.initializeApp(window.FIREBASE_CONFIG);
      fb = { app, auth: app.auth(), db: app.firestore(), fn: app.functions(window.FIREBASE_REGION || 'asia-northeast3'), F: window.firebase };
      await new Promise((ok) => { const off = fb.auth.onAuthStateChanged((u) => { off(); ok(u); }); });
      fb.auth.onAuthStateChanged(onUser);
      return fb;
    })().catch((e) => { console.warn('firebase', e); return null; });
    return ready;
  }
  // 로그인될 때마다 (같은 계정·같은 연결 상태면 한 번만). true = 들어옴, false = 가입 절차가 남았거나 막힘
  let busy = null;
  function onUser(u) {
    if (!u) return Promise.resolve(false);
    const k = u.uid + ':' + u.providerData.length + ':' + !!st.join;
    if (busy && busy.k === k) return busy.p;
    busy = { k, p: userIn(u) }; return busy.p;
  }
  async function userIn(u) {
    const prov = u.isAnonymous ? 'guest' : (u.providerData[0] || {}).providerId === 'google.com' ? 'google' : 'email';
    try {
      const ref = fb.db.collection('users').doc(u.uid), snap = await ref.get(), now = Date.now(), d = snap.exists ? snap.data() : null;
      // 처음 온 계정(가입 절차 없이 구글로 로그인 · 게스트에서 연동): 생년월일 → 약관 동의를 먼저
      if (prov !== 'guest' && (!d || d.provider === 'guest') && !st.join) {
        if (isHub || wrap) joinFor(u, !!d);
        return false;
      }
      st = { ...st, mode: prov, uid: u.uid, email: u.email || '' }; save(); paintAccount();
      const base = { provider: prov, email: u.email || '', lastAt: now, over14: st.over14 !== false, ver: (window.Hub && Hub.ver) || '' };
      if (st.join) { Object.assign(base, { agreedAt: st.join.at, agreeVer: TERMS_VER }); delete st.join; save(); }
      if (!d) await ref.set({ ...base, createdAt: now, status: 'active', totalSec: 0 });
      else {
        if (d.status === 'banned') { block('이용이 제한된 계정이에요.'); return false; }
        await ref.update(base);
        // 새 기기에서 로그인: 이 기기에 캐릭터가 없고 서버에 저장 데이터가 있으면 가져옴
        const local = read('twin_gameland_v1', null);
        if (d.profile && (!local || !(local.chars || []).length)) { localStorage.setItem('twin_gameland_v1', d.profile); location.reload(); return false; }
      }
      if (u.email) { try { st.admin = (await fb.db.collection('admins').doc(u.email).get()).exists; save(); } catch (e) { st.admin = false; } }
      flush(); syncProfile(); loadConfig();
    } catch (e) { console.warn('user', e); }
    return true;
  }
  async function loadConfig() {
    try {
      const [cat, ops] = await Promise.all(['catalog', 'ops'].map((k) => fb.db.collection('config').doc(k).get()));
      if (cat.exists) write(CATKEY, cat.data()); // 다음 화면부터 적용 (common/profile.js applyCatalog)
      const o = ops.exists ? ops.data() : {};
      if (o.maintenance && !isAdmin()) block(o.maintenanceMsg || '지금은 점검 중이에요. 잠시 뒤에 다시 와 주세요!');
      else if (o.notice && isHub && sessionStorage.getItem('twin_notice') !== o.notice) { sessionStorage.setItem('twin_notice', o.notice); toast(o.notice, 4000); }
    } catch (e) { /* ignore */ }
  }
  const isAdmin = () => !!st.admin;

  // ---------- 기록 보내기: 사용 시간 · 게임 기록 (서버가 없으면 이 기기에 모아 둠, 최대 300개) ----------
  const queue = (x) => { const q = read(QKEY, []); q.push(x); write(QKEY, q.slice(-300)); };
  async function flush() {
    if (!fb || !fb.auth.currentUser) return;
    const q = read(QKEY, []); if (!q.length) return; write(QKEY, []);
    const uid = fb.auth.currentUser.uid, b = fb.db.batch();
    let sec = 0;
    for (const x of q) { b.set(fb.db.collection(x.kind === 'session' ? 'sessions' : 'records').doc(), { ...x.d, uid }); if (x.kind === 'session') sec += x.d.sec; }
    if (sec) b.update(fb.db.collection('users').doc(uid), { totalSec: fb.F.firestore.FieldValue.increment(sec) });
    try { await b.commit(); } catch (e) { const r = read(QKEY, []); write(QKEY, [...q, ...r].slice(-300)); }
  }
  const day = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const week = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); const y = new Date(d.getFullYear(), 0, 4); return `${d.getFullYear()}-W${String(1 + Math.round(((d - y) / 864e5 - 3 + ((y.getDay() + 6) % 7)) / 7)).padStart(2, '0')}`; };
  const who = () => { const c = window.Hub && Hub.active(); return c ? { name: c.name, look: c.look } : {}; };
  // 화면에 머문 시간 (게임 화면마다, 3초 미만은 안 셈)
  let since = Date.now();
  const endSession = () => {
    const sec = Math.round((Date.now() - since) / 1000); since = Date.now();
    if (sec >= 3 && sec < 6 * 3600) { queue({ kind: 'session', d: { game: page, start: Date.now() - sec * 1000, sec, day: day(Date.now()), mode: st.mode || 'none', ...who() } }); flush(); }
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) { endSession(); syncProfile(); } else since = Date.now(); });
  addEventListener('pagehide', () => { endSession(); syncProfile(); });
  // 게임 결과 (Hub.record 를 감쌈)
  if (window.Hub && Hub.record && !Hub.record._auth) {
    const orig = Hub.record;
    Hub.record = function (game, r) {
      const out = orig.call(this, game, r);
      if (out && !out.god) { const now = Date.now(); queue({ kind: 'record', d: { game, stage: r.stage ?? null, cleared: !!r.cleared, score: r.dist || 0, stars: r.stars || 0, time: r.time || 0, coins: (out && out.earned) || 0, at: now, day: day(now), week: week(now), month: day(now).slice(0, 7), ...who() } }); flush(); }
      return out;
    };
    Hub.record._auth = true;
  }
  // 게임 저장 데이터를 계정에 보관 (새 기기에서 로그인하면 이어서 함). 30초에 한 번까지
  let lastSync = 0;
  function syncProfile() {
    if (!fb || !fb.auth.currentUser || Date.now() - lastSync < 30000) return;
    lastSync = Date.now();
    const p = localStorage.getItem('twin_gameland_v1'); if (!p || p.length > 900000) return;
    fb.db.collection('users').doc(fb.auth.currentUser.uid).update({ profile: p, profileAt: Date.now() }).catch(() => {});
  }

  // ---------- 화면 (로그인 창 · 계정 창 · 계정연동 안내) ----------
  // 모양: 게임 공통 팝업 재료(common/ui/popup/v4 — 창 틀·리본·버튼, 은유 분홍·은결 파랑)를 그대로 씀. 로그인 첫 화면 뒤는 캐릭터 고르기 배경
  const P4 = ROOT + 'common/ui/popup/v4/';
  const css = `
  .au-wrap{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:4px;padding:16px 0;background:#BFE4FA url(${ROOT}hub/select/bg.webp) center/cover no-repeat;font-family:Jua,'Apple SD Gothic Neo',sans-serif;color:#5A3B22;overflow:auto}
  .au-wrap.dim{background:rgba(24,40,62,.55)}
  .au-logo{flex:none;width:210px;max-width:56%;margin-top:auto;filter:drop-shadow(0 4px 6px rgba(24,59,91,.35))}
  @media (max-height:520px){.au-logo{display:none}}
  .au-wrap.dim .au-logo{display:none}
  .au-wrap.dim .au-box{margin-top:auto}
  .au-box{box-sizing:border-box;flex:none;width:440px;max-width:calc(100% - 16px);margin:58px 0 auto;padding:22px 26px 24px;text-align:center;border:0 solid transparent;border-image:url(${P4}panel_pink.webp) 130 fill / calc(130px * .7333) stretch;filter:drop-shadow(0 10px 22px rgba(0,0,0,.35))}
  html[data-who=eungyeol] .au-box{border-image-source:url(${P4}panel_blue.webp)}
  .au-h{display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:350px;max-width:100%;height:131px;margin:-80px auto -6px;padding:8px 58px 0;background:url(${P4}ribbon_pink.webp) center/100% 100% no-repeat;color:#fff;font-size:26px;line-height:1;text-shadow:0 2px 0 var(--who-d,#B92C62),0 0 3px var(--who-d,#B92C62);white-space:nowrap;overflow:hidden}
  html[data-who=eungyeol] .au-h{background-image:url(${P4}ribbon_blue.webp)}
  .au-p{font-size:16px;line-height:1.5;color:#6B4A3A;margin:0 0 12px;white-space:pre-line}
  .au-b{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:58px;margin:10px 0 0;padding:.14em 20px 0;box-sizing:border-box;font-family:inherit;font-size:20px;line-height:1;cursor:pointer;background:none;white-space:nowrap;border:0 solid transparent;border-image:url(${P4}btn_pink.webp) 0 58 fill / 0 29px stretch;color:var(--who,#E8457F)}
  .au-b:active{transform:translateY(2px)}
  .au-b.e{height:64px;border-image-source:url(${P4}fill_pink.webp);color:#fff;text-shadow:0 2px 0 var(--who-d,#B92C62)}
  html[data-who=eungyeol] .au-b{border-image-source:url(${P4}btn_blue.webp)}
  html[data-who=eungyeol] .au-b.e{border-image-source:url(${P4}fill_blue.webp)}
  .au-b.g{height:64px;padding-top:0;border:2px solid #DADCE0;border-image:none;border-radius:32px;background:#fff;color:#3C4043;font-size:20px;box-shadow:0 3px 0 #D5D9DE}
  .au-b.g svg{width:26px;height:26px;flex:none}
  .au-in{display:block;width:100%;min-width:0;max-width:100%;height:54px;margin:0;border-radius:16px;border:2px solid #EBD9C8;padding:0 14px;font-size:20px;font-family:inherit;box-sizing:border-box;text-align:center;color:#5A3B22;background:#fff;-webkit-appearance:none;appearance:none}
  .au-in[type=date]{line-height:50px}
  .au-in[type=date]::-webkit-date-and-time-value{text-align:center}
  .au-in:focus{outline:none;border-color:var(--who,#E8457F)}
  .au-in.code{letter-spacing:10px;font-size:26px}
  .au-err{min-height:20px;margin:6px 0 0;font-size:14px;line-height:1.4;color:#E0457B}
  .au-small{display:block;margin:12px auto 0;font-size:15px;color:#8A6E58;background:none;border:0;font-family:inherit;text-decoration:underline;cursor:pointer}
  .au-terms{margin:10px 0 0;font-size:12px;line-height:1.5;color:#9A8070}
  .au-terms a{color:inherit}
  .au-toast{position:fixed;left:50%;bottom:calc(30px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9500;max-width:calc(100% - 32px);padding:10px 18px;border-radius:16px;background:rgba(24,40,62,.92);color:#fff;font:16px Jua,sans-serif;text-align:center;white-space:pre-line}
  .au-row{display:flex;gap:12px}.au-row .au-b{flex:1 1 0;min-width:0}
  .au-art{display:block;width:auto;max-width:100%;height:150px;margin:0 auto 6px;object-fit:contain}
  .au-ic{display:block;height:58px;margin:0 auto 6px}
  @media (max-height:620px){.au-art{height:96px}}
  @media (max-height:520px){.au-art,.au-ic{display:none}.au-b{height:50px}.au-b.e,.au-b.g{height:54px}.au-ck{min-height:36px}.au-p{margin-bottom:6px}}
  .au-bi{height:30px;width:auto;flex:none;margin-left:-6px}
  .au-links{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:10px;color:#B49A86}
  .au-links .au-small{margin:0;font-size:16px;color:#7A5A44}
  .au-date{display:flex;gap:8px}
  .au-date .au-in{flex:1.2 1 0;padding:0 26px 0 8px;font-size:18px;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%23C49A7E' stroke-width='2'/%3E%3C/svg%3E") right 9px center/12px 8px no-repeat;text-align-last:center}
  .au-date .au-in+.au-in{flex:1 1 0}
  .au-ck{display:flex;align-items:center;gap:10px;min-height:44px;text-align:left;font-size:16px;line-height:1.3;color:#5A3B22;cursor:pointer}
  .au-ck input{position:absolute;opacity:0;pointer-events:none}
  .au-ck i{flex:none;width:26px;height:26px;border-radius:8px;border:2px solid #E3CBB6;background:#fff;box-sizing:border-box}
  .au-ck input:checked+i{background:var(--who,#E8457F) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3 8.5l3.2 3L13 4.5' fill='none' stroke='%23fff' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/18px no-repeat;border-color:var(--who,#E8457F)}
  .au-ck span{flex:1;min-width:0}.au-ck b{font-weight:normal;color:var(--who,#E8457F)}
  .au-ck.all{padding:4px 12px;border-radius:16px;background:#FFF4EA;font-size:18px}
  .au-list{padding:2px 12px 0}
  .au-more{flex:none;font-family:inherit;font-size:14px;color:#8A6E58;background:none;border:0;text-decoration:underline;cursor:pointer;padding:6px 0}
  .au-detail{margin:-2px 0 4px 36px;padding:8px 10px;border-radius:12px;background:#FFF8F1;font-size:13px;line-height:1.5;color:#7A5A44;text-align:left;white-space:pre-line}`;
  const G_ICON = '<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  let wrap = null;
  function mount(html, dim) {
    if (!document.getElementById('auCss')) { const s = document.createElement('style'); s.id = 'auCss'; s.textContent = css; document.head.appendChild(s); }
    if (!wrap) { wrap = document.createElement('div'); document.body.appendChild(wrap); }
    wrap.className = 'au-wrap' + (dim ? ' dim' : ''); wrap.innerHTML = `<img class="au-logo" src="${ROOT}hub/park/ui/logo.webp" alt=""><div class="au-box">${html}</div>`;
    const h = wrap.querySelector('.au-h'); if (h && h.textContent.length > 8) h.style.fontSize = '21px'; // 긴 제목은 리본 안에 들어가게
    return wrap.querySelector('.au-box');
  }
  const close = () => { if (wrap) { wrap.remove(); wrap = null; } };
  function toast(msg, ms = 2400) { const d = document.createElement('div'); d.className = 'au-toast'; d.textContent = t(msg); document.body.appendChild(d); setTimeout(() => d.remove(), ms); }
  function block(msg) { mount(`<div class="au-h">${t('안내')}</div>${art('repair')}<p class="au-p">${t(msg)}</p>`); }
  const $ = (box, s) => box.querySelector(s);
  const err = (box, m) => { $(box, '.au-err').textContent = m ? t(m) : ''; };
  const noServer = () => toast('구글·이메일 로그인은 준비 중이에요.\n지금은 게스트로 입장해 주세요!', 3200);

  const IMG = ROOT + 'hub/login/';
  const dimNow = () => !!st.mode; // 처음 온 사람은 로그인 첫 화면 배경 그대로
  const art = (n) => `<img class="au-art" src="${IMG}${n}.webp" alt="">`;
  const ic = (n) => `<img class="au-ic" src="${IMG}i_${n}.webp" alt="">`;
  // 첫 로그인 창: 구글로 로그인 · 이메일로 로그인 · 게스트 + 아래에 '가입하기 · 비밀번호 재설정'
  function loginBox(opts = {}) {
    const link = st.mode === 'guest'; // 게스트가 계정 연동
    if (st.join) { delete st.join; save(); } // 가입 중에 그만둔 동의는 버림
    const box = mount(`<div class="au-h">${t(link ? '계정 연동' : '은유와 은결')}</div>${art('welcome')}
      <p class="au-p">${t(link ? '지금까지 한 기록을 그대로 가지고 계정에 연결해요.' : '로그인하면 다른 기기에서도 이어서 할 수 있어요!')}</p>
      <button class="au-b g" data-a="google">${G_ICON}<span>${t('구글로 로그인')}</span></button>
      <button class="au-b e" data-a="login"><img class="au-bi" src="${IMG}i_mail.webp" alt=""><span>${t('이메일로 로그인')}</span></button>
      ${link ? `<button class="au-b s" data-a="close">${t('닫기')}</button>` : `<button class="au-b s" data-a="guest"><img class="au-bi" src="${IMG}i_ticket.webp" alt=""><span>${t('게스트로 입장하기')}</span></button>`}
      <div class="au-links"><button class="au-small" data-a="join">${t('가입하기')}</button><span>·</span><button class="au-small" data-a="reset">${t('비밀번호 재설정')}</button></div>
      <p class="au-terms">${t('게스트는 결제를 할 수 없어요.')}</p>`, opts.dim || link);
    box.onclick = (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      ({ google, login: pwLoginBox, guest: guestIn, close, join: joinStart, reset: resetStart })[a.dataset.a]();
    };
  }
  function resetStart() {
    if (!window.FIREBASE_CONFIG) { noServer(); return; }
    if (!window.EMAIL_CODE_READY) { toast('비밀번호 재설정은 준비 중이에요.\n메일 보내는 서버를 올리면 열려요.', 3200); return; }
    emailBox('reset');
  }
  // 가입하기: 생년월일 → 약관 동의 → 구글·이메일 중 고르기
  function joinStart() {
    if (!window.FIREBASE_CONFIG) { noServer(); return; }
    birthBox({ back: loginBox, next: () => termsBox({ back: joinStart, next: methodBox }) });
  }
  // 가입 절차 없이 구글로 처음 들어온 계정: 같은 절차를 거친 뒤 계정을 만듦. 그만두면 연결을 되돌림
  function joinFor(u, wasGuest) {
    const quit = async () => {
      try { if (wasGuest) await u.unlink('google.com'); else await u.delete(); } catch (e) { await fb.auth.signOut(); st = {}; save(); }
      busy = null; loginBox();
    };
    const finish = async () => { st.join = { at: Date.now() }; save(); if (await onUser(fb.auth.currentUser)) done('가입 완료! 구글 계정으로 로그인했어요.'); };
    toast('처음 오셨네요! 가입 절차를 먼저 할게요.');
    birthBox({ back: quit, next: () => termsBox({ back: () => joinFor(u, wasGuest), next: finish }) });
  }
  let birthPick = null; // 뒤로 왔을 때 고른 생년월일 (이 창에서만, 저장 안 함)
  // 생년월일: 년·월·일을 하나씩 고름 (만 14세 미만은 계정을 만들 수 없음: 보호자 동의가 필요해서. 저장하지 않음)
  function birthBox({ back, next }) {
    const now = new Date(), Y = now.getFullYear();
    const ko = t('년') === '년'; // 영어일 때는 숫자만
    const opt = (lab, from, to) => `<option value="">${t(lab)}</option>` + Array.from({ length: Math.abs(to - from) + 1 }, (_, i) => { const v = from < to ? from + i : from - i; return `<option value="${v}">${v}${ko ? lab : ''}</option>`; }).join('');
    const box = mount(`<div class="au-h">${t('생년월일')}</div>${ic('birth')}<p class="au-p">${t('나이 확인에만 쓰고 저장하지 않아요.')}</p>
      <div class="au-date"><select class="au-in" data-k="y">${opt('년', Y, 1920)}</select><select class="au-in" data-k="m">${opt('월', 1, 12)}</select><select class="au-in" data-k="d">${opt('일', 1, 31)}</select></div><p class="au-err"></p>
      <div class="au-row"><button class="au-b s" data-a="back">${t('뒤로')}</button><button class="au-b e" data-a="ok">${t('다음')}</button></div>`, dimNow());
    const [y, m, d] = ['y', 'm', 'd'].map((k) => $(box, `[data-k=${k}]`));
    // 고른 달의 날 수만큼만 (2월 29일 등)
    const fit = () => { const n = new Date(+y.value || 2000, +m.value || 1, 0).getDate(); [...d.options].forEach((o) => { o.hidden = o.disabled = +o.value > n; }); if (+d.value > n) d.value = ''; };
    y.onchange = m.onchange = fit;
    if (birthPick) { [y.value, m.value, d.value] = birthPick; fit(); } // 뒤로 왔을 때 고른 값 그대로 (이 화면에서만, 저장 안 함)
    box.onclick = (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'back') { birthPick = null; back(); return; }
      if (!y.value || !m.value || !d.value) { err(box, '년·월·일을 모두 골라 주세요'); return; }
      const b = new Date(+y.value, m.value - 1, +d.value);
      let age = now.getFullYear() - b.getFullYear(); if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) age--;
      if (age < 14) { err(box, '만 14세 미만은 보호자 동의가 필요해서 아직 가입할 수 없어요. 게스트로 즐겨 주세요!'); return; }
      birthPick = [y.value, m.value, d.value]; st.over14 = true; next();
    };
  }
  // 약관 동의: 개인정보 수집·이용 동의 · 개인정보 처리방침 · 이용약관 (모두 필수)
  function termsBox({ back, next }) {
    const row = (k, lab, more) => `<label class="au-ck"><input type="checkbox" data-k="${k}"><i></i><span><b>${t('[필수]')}</b> ${t(lab)}</span>${more}</label>`;
    const box = mount(`<div class="au-h">${t('약관 동의')}</div>${ic('lock')}
      <label class="au-ck all"><input type="checkbox" data-k="all"><i></i><span>${t('전체 동의')}</span></label>
      <div class="au-list">
        ${row('c1', '개인정보 수집·이용 동의', `<button class="au-more" data-a="more">${t('보기')}</button>`)}
        <div class="au-detail" hidden>${t('모으는 것: 이메일 주소 하나\n쓰는 곳: 계정 만들기, 게임 기록·구매 내역 보관\n보관 기간: 계정을 지울 때까지 (생년월일은 저장하지 않아요)')}</div>
        ${row('c2', '개인정보 처리방침', `<a class="au-more" href="${ROOT}legal/privacy.html" target="_blank">${t('보기')}</a>`)}
        ${row('c3', '이용약관', `<a class="au-more" href="${ROOT}legal/terms.html" target="_blank">${t('보기')}</a>`)}
      </div><p class="au-err"></p>
      <div class="au-row"><button class="au-b s" data-a="back">${t('뒤로')}</button><button class="au-b e" data-a="ok">${t('다음')}</button></div>`, dimNow());
    const cks = [...box.querySelectorAll('.au-list input')], all = $(box, '[data-k=all]');
    all.onchange = () => { cks.forEach((c) => { c.checked = all.checked; }); err(box); };
    cks.forEach((c) => { c.onchange = () => { all.checked = cks.every((x) => x.checked); err(box); }; });
    box.onclick = (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      e.preventDefault();
      if (a.dataset.a === 'more') { const dt = $(box, '.au-detail'); dt.hidden = !dt.hidden; return; }
      if (a.dataset.a === 'back') { back(); return; }
      if (!cks.every((x) => x.checked)) { err(box, '필수 항목에 모두 동의해 주세요'); return; }
      birthPick = null; next();
    };
  }
  // 가입 방법 고르기
  function methodBox() {
    const box = mount(`<div class="au-h">${t('가입하기')}</div>${ic('card')}<p class="au-p">${t('어떤 계정으로 가입할까요?')}</p>
      <button class="au-b g" data-a="google">${G_ICON}<span>${t('구글로 가입하기')}</span></button>
      <button class="au-b e" data-a="email"><img class="au-bi" src="${IMG}i_mail.webp" alt=""><span>${t('이메일로 가입하기')}</span></button>
      <button class="au-b s" data-a="back">${t('뒤로')}</button>`, dimNow());
    box.onclick = (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'back') { termsBox({ back: joinStart, next: methodBox }); return; }
      st.join = { at: Date.now() }; save(); // 동의한 시각 (계정을 만들 때 users 에 씀)
      if (a.dataset.a === 'google') google();
      else if (!window.EMAIL_CODE_READY) toast('이메일 가입은 준비 중이에요.\n지금은 구글로 가입하거나 게스트로 입장해 주세요!', 3200);
      else emailBox('signup');
    };
  }
  async function google() {
    const f = await firebase(); if (!f) { noServer(); return; }
    const p = new f.F.auth.GoogleAuthProvider();
    const joining = !!st.join;
    try {
      const u = f.auth.currentUser;
      if (u && u.isAnonymous) await u.linkWithPopup(p); else await f.auth.signInWithPopup(p);
    } catch (e) {
      if (e.code === 'auth/credential-already-in-use') { await f.auth.signInWithCredential(e.credential); }
      else { if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') toast('구글 로그인을 못 했어요: ' + (e.code || e.message)); return; }
    }
    if (await onUser(f.auth.currentUser)) done(joining ? '가입 완료! 구글 계정으로 로그인했어요.' : '구글 계정으로 로그인했어요!');
  }
  const call = async (name, data) => { const f = await firebase(); return (await f.fn.httpsCallable(name)(data)).data; };
  // 이메일 → 인증번호 → (가입·재설정) 비밀번호 정하기
  function emailBox(purpose) {
    const box = mount(`<div class="au-h">${t(purpose === 'reset' ? '비밀번호 재설정' : '이메일로 가입하기')}</div>${ic('mail')}<p class="au-p">${t('이메일로 인증번호 6자리를 보내 드려요.')}</p>
      <input class="au-in" type="email" inputmode="email" autocomplete="email" placeholder="email@example.com"><p class="au-err"></p>
      <div class="au-row"><button class="au-b s" data-a="back">${t('뒤로')}</button><button class="au-b e" data-a="ok">${t('인증번호 받기')}</button></div>`, dimNow());
    box.onclick = async (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'back') { purpose === 'reset' ? loginBox() : methodBox(); return; }
      const email = $(box, 'input').value.trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err(box, '이메일을 다시 확인해 주세요'); return; }
      a.disabled = true; err(box, '보내는 중...');
      try { await call('sendCode', { email, purpose }); codeBox(email, purpose); } catch (x) { a.disabled = false; err(box, x.message || '보내지 못했어요'); }
    };
  }
  function codeBox(email, purpose) {
    const box = mount(`<div class="au-h">${t('인증번호')}</div>${ic('key')}<p class="au-p">${email}\n${t('메일로 온 6자리를 넣어 주세요 (10분 안에).')}</p>
      <input class="au-in code" inputmode="numeric" maxlength="6" autocomplete="one-time-code"><p class="au-err"></p>
      <div class="au-row"><button class="au-b s" data-a="again">${t('다시 보내기')}</button><button class="au-b e" data-a="ok">${t('확인')}</button></div>`, dimNow());
    box.onclick = async (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'again') { try { await call('sendCode', { email, purpose }); err(box, '다시 보냈어요'); } catch (x) { err(box, x.message); } return; }
      const code = $(box, 'input').value.trim(); if (!/^\d{6}$/.test(code)) { err(box, '6자리 숫자를 넣어 주세요'); return; }
      a.disabled = true;
      try {
        const f = await firebase(), r = await call('verifyCode', { email, code, purpose, over14: st.over14 !== false, agreedAt: st.join ? st.join.at : null, agreeVer: TERMS_VER });
        await f.auth.signInWithCustomToken(r.token); pwSetBox(email);
      } catch (x) { a.disabled = false; err(box, x.message || '인증번호가 맞지 않아요'); }
    };
  }
  function pwSetBox(email) {
    const box = mount(`<div class="au-h">${t('비밀번호 정하기')}</div>${ic('lock')}<p class="au-p">${t('다음부터는 이메일과 이 비밀번호로 들어와요. (8자 이상)')}</p>
      <input class="au-in" type="password" autocomplete="new-password" placeholder="${t('비밀번호')}"><input class="au-in" type="password" autocomplete="new-password" placeholder="${t('한 번 더')}" style="margin-top:8px"><p class="au-err"></p>
      <button class="au-b e" data-a="ok">${t('완료')}</button>`, dimNow());
    box.onclick = async (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      const [p1, p2] = [...box.querySelectorAll('input')].map((x) => x.value);
      if (p1.length < 8) { err(box, '8자 이상으로 정해 주세요'); return; }
      if (p1 !== p2) { err(box, '두 비밀번호가 달라요'); return; }
      a.disabled = true;
      try { const f = await firebase(); await f.auth.currentUser.updatePassword(p1); await f.auth.currentUser.reload(); busy = null; await onUser(f.auth.currentUser); done('준비 끝! 이메일 계정으로 로그인했어요.'); } catch (x) { a.disabled = false; err(box, x.message); }
    };
  }
  function pwLoginBox() {
    if (!window.FIREBASE_CONFIG) { noServer(); return; }
    const box = mount(`<div class="au-h">${t('이메일 로그인')}</div>${ic('mail')}
      <input class="au-in" type="email" autocomplete="email" placeholder="email@example.com"><input class="au-in" type="password" autocomplete="current-password" placeholder="${t('비밀번호')}" style="margin-top:8px"><p class="au-err"></p>
      <div class="au-row"><button class="au-b s" data-a="back">${t('뒤로')}</button><button class="au-b e" data-a="ok">${t('로그인')}</button></div>
      <div class="au-links"><button class="au-small" data-a="join">${t('가입하기')}</button><span>·</span><button class="au-small" data-a="reset">${t('비밀번호 재설정')}</button></div>`, dimNow());
    box.onclick = async (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'back') { loginBox(); return; }
      if (a.dataset.a === 'join') { joinStart(); return; }
      if (a.dataset.a === 'reset') { resetStart(); return; }
      const [em, pw] = [...box.querySelectorAll('input')].map((x) => x.value.trim());
      try { const f = await firebase(); await f.auth.signInWithEmailAndPassword(em.toLowerCase(), pw); if (await onUser(f.auth.currentUser)) done('로그인했어요!'); } catch (x) { err(box, '이메일 또는 비밀번호가 맞지 않아요'); }
    };
  }
  async function guestIn() {
    st = { mode: 'guest', uid: 'local-' + Math.random().toString(36).slice(2, 10), at: Date.now() }; save(); close();
    const f = await firebase(); if (f && !f.auth.currentUser) { try { await f.auth.signInAnonymously(); } catch (e) { /* 서버 없이도 게스트로 계속 */ } }
  }
  function done(msg) { close(); toast(msg); paintAccount(); }
  // 계정 창 (설정 → 계정)
  function account() {
    const m = st.mode, label = { guest: '게스트', google: '구글 계정', email: '이메일 계정' }[m] || '로그인 안 함';
    if (m === 'guest' || !m) { loginBox({ dim: true }); return; }
    const box = mount(`<div class="au-h">${t('계정')}</div>${ic('card')}<p class="au-p">${t(label)}${st.email ? '\n' + st.email : ''}</p>
      <button class="au-b line" data-a="out">${t('로그아웃')}</button><button class="au-b s" data-a="close">${t('닫기')}</button>
      <p class="au-terms"><a href="${ROOT}legal/privacy.html" target="_blank">${t('개인정보 처리방침')}</a> · <a href="${ROOT}legal/delete.html" target="_blank">${t('계정 삭제 요청')}</a></p>`, true);
    box.onclick = async (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'close') { close(); return; }
      syncProfile(); const f = await firebase(); if (f) await f.auth.signOut();
      st = {}; save(); close(); toast('로그아웃했어요'); if (isHub) loginBox(); paintAccount();
    };
  }
  function paintAccount() {
    const v = document.getElementById('setAccountVal'); if (v) v.textContent = t({ guest: '게스트', google: '구글', email: '이메일' }[st.mode] || '로그인');
  }
  // 결제 전에 부름: 게스트·만 14세 미만은 결제 안 됨
  const canPay = () => (st.mode === 'google' || st.mode === 'email') && st.over14 !== false;
  function needLink() {
    const box = mount(`<div class="au-h">${t('계정연동이 필요합니다.')}</div>${art('link')}<p class="au-p">${t('게스트는 결제를 할 수 없어요.\n구글이나 이메일 계정을 연동하면 결제할 수 있어요. (광고 보기는 지금도 돼요)')}</p>
      <div class="au-row"><button class="au-b s" data-a="close">${t('닫기')}</button><button class="au-b e" data-a="link">${t('계정 연동하기')}</button></div>`, true);
    box.onclick = (e) => { const a = e.target.closest('[data-a]'); if (!a) return; if (a.dataset.a === 'link') loginBox({ dim: true }); else close(); };
  }
  // 결제 기록 (지금은 가짜 결제. 앱에서는 구글 결제 확인 뒤 서버(verifyPurchase)가 씀)
  function logPay(p) { if (fb && fb.auth.currentUser) fb.db.collection('payments').add({ uid: fb.auth.currentUser.uid, email: st.email || '', product: p.id, won: p.won || 0, at: Date.now(), day: day(Date.now()), status: 'test', ...who() }).catch(() => {}); }

  window.Auth = { state: () => ({ ...st }), canPay, needLink, account, login: () => loginBox({ dim: true }), logPay, isAdmin, flush, firebase, week, day };
  const start = () => {
    paintAccount();
    if (isHub && !st.mode) loginBox(); // 처음 들어온 사람: 로그인 창
    firebase().then(() => { flush(); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
