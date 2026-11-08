'use strict';
// 로그인 · 계정 · 기록 보내기 (common/profile.js 가 모든 화면에서 불러옴)
//  · 첫 화면(index.html)에 처음 들어오면 로그인 창: ① 구글로 시작하기 ② 이메일로 시작하기 ③ 게스트로 입장하기
//  · 이메일: 생년월일 → 이메일 → 메일로 온 인증번호 6자리 → 비밀번호 정하기. 다음부터 이메일 + 비밀번호.
//    비밀번호 찾기는 없고 '비밀번호 재설정'(메일 인증번호)만 있음. 받는 개인정보는 이메일 하나 (생년월일은 만 14세 이상인지만 보고 저장 안 함)
//  · 게스트: 지금처럼 다 되지만 결제는 절대 안 됨 → "계정연동이 필요합니다." (광고는 됨). 게스트로 하다가 구글·이메일로 연동하면 기록이 그대로 이어짐
//  · Firebase(common/firebase_config.js)가 비어 있으면 게스트만 되고, 기록은 이 기기에 모아 둠 (설정하면 다음 접속 때 보냄)
//  · 저장: 로그인 상태 localStorage 'twin_auth_v1' (게임 저장 데이터 twin_gameland_v1 은 건드리지 않음)
//  · 서버(Firestore): users/{uid} · sessions(사용 시간) · records(게임 기록) · payments(결제) · config/catalog(상점 값) — 구조는 server/README.md
(function () {
  if (window.Auth) return;
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
  async function onUser(u) {
    if (!u) return;
    const prov = u.isAnonymous ? 'guest' : (u.providerData[0] || {}).providerId === 'google.com' ? 'google' : 'email';
    st = { ...st, mode: prov, uid: u.uid, email: u.email || '' }; save(); paintAccount();
    try {
      const ref = fb.db.collection('users').doc(u.uid), snap = await ref.get(), now = Date.now();
      const base = { provider: prov, email: u.email || '', lastAt: now, over14: st.over14 !== false, ver: (window.Hub && Hub.ver) || '' };
      if (!snap.exists) await ref.set({ ...base, createdAt: now, status: 'active', totalSec: 0 });
      else {
        const d = snap.data();
        if (d.status === 'banned') { block('이용이 제한된 계정이에요.'); return; }
        await ref.update(base);
        // 새 기기에서 로그인: 이 기기에 캐릭터가 없고 서버에 저장 데이터가 있으면 가져옴
        const local = read('twin_gameland_v1', null);
        if (d.profile && (!local || !(local.chars || []).length)) { localStorage.setItem('twin_gameland_v1', d.profile); location.reload(); return; }
      }
      if (u.email) { try { st.admin = (await fb.db.collection('admins').doc(u.email).get()).exists; save(); } catch (e) { st.admin = false; } }
      flush(); syncProfile(); loadConfig();
    } catch (e) { console.warn('user', e); }
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
  const css = `
  .au-wrap{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px;background:linear-gradient(#FFE3EE,#FFF4E6);font-family:Jua,'Apple SD Gothic Neo',sans-serif;color:#3B2A44}
  .au-wrap.dim{background:rgba(24,40,62,.55)}
  .au-box{width:100%;max-width:400px;max-height:100%;overflow:auto;background:#fff;border-radius:28px;padding:26px 22px 22px;text-align:center;box-shadow:0 14px 34px rgba(60,30,60,.25);border:4px solid #FFB3CF;box-sizing:border-box}
  html[data-who=eungyeol] .au-box{border-color:#A9D3FA}
  .au-logo{width:200px;max-width:70%;margin:-4px auto 6px;display:block}
  .au-h{font-size:24px;margin:4px 0 6px}
  .au-p{font-size:15px;line-height:1.5;color:#6B5A6E;margin:0 0 14px;white-space:pre-line}
  .au-b{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:54px;margin:10px 0 0;border-radius:18px;border:0;font-family:inherit;font-size:19px;cursor:pointer;box-sizing:border-box}
  .au-b:active{transform:translateY(2px)}
  .au-b.g{background:#fff;color:#3C4043;border:2px solid #DADCE0;height:60px;font-size:20px}
  .au-b.g svg{width:24px;height:24px}
  .au-b.e{background:var(--who,#FF5A8C);color:#fff}
  .au-b.s{background:#F1F3F7;color:#5A6378}
  .au-b.line{background:#fff;color:var(--who-d,#D23F75);border:2px solid var(--who,#FF5A8C)}
  .au-in{width:100%;height:52px;border-radius:14px;border:2px solid #E3D6E4;padding:0 14px;font-size:20px;font-family:inherit;box-sizing:border-box;text-align:center;color:#3B2A44;background:#FFFBFD}
  .au-in:focus{outline:none;border-color:var(--who,#FF5A8C)}
  .au-in.code{letter-spacing:10px;font-size:26px}
  .au-err{min-height:20px;margin:8px 0 0;font-size:14px;color:#E0457B}
  .au-small{display:block;margin:14px auto 0;font-size:14px;color:#8A7A8E;background:none;border:0;font-family:inherit;text-decoration:underline;cursor:pointer}
  .au-terms{margin:14px 0 0;font-size:12px;line-height:1.5;color:#9A8C9C}
  .au-terms a{color:inherit}
  .au-toast{position:fixed;left:50%;bottom:calc(30px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9500;max-width:calc(100% - 32px);padding:10px 18px;border-radius:16px;background:rgba(24,40,62,.92);color:#fff;font:16px Jua,sans-serif;text-align:center;white-space:pre-line}
  .au-row{display:flex;gap:8px}.au-row .au-b{flex:1}`;
  const G_ICON = '<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  let wrap = null;
  function mount(html, dim) {
    if (!document.getElementById('auCss')) { const s = document.createElement('style'); s.id = 'auCss'; s.textContent = css; document.head.appendChild(s); }
    if (!wrap) { wrap = document.createElement('div'); document.body.appendChild(wrap); }
    wrap.className = 'au-wrap' + (dim ? ' dim' : ''); wrap.innerHTML = `<div class="au-box">${html}</div>`;
    return wrap.querySelector('.au-box');
  }
  const close = () => { if (wrap) { wrap.remove(); wrap = null; } };
  function toast(msg, ms = 2400) { const d = document.createElement('div'); d.className = 'au-toast'; d.textContent = t(msg); document.body.appendChild(d); setTimeout(() => d.remove(), ms); }
  function block(msg) { mount(`<div class="au-h">${t('안내')}</div><p class="au-p">${t(msg)}</p>`); }
  const $ = (box, s) => box.querySelector(s);
  const err = (box, m) => { $(box, '.au-err').textContent = m ? t(m) : ''; };
  const noServer = () => toast('구글·이메일 로그인은 준비 중이에요.\n지금은 게스트로 입장해 주세요!', 3200);

  // 첫 로그인 창
  function loginBox(opts = {}) {
    const link = st.mode === 'guest'; // 게스트가 계정 연동
    const box = mount(`<img class="au-logo" src="${ROOT}hub/park/ui/logo.webp" alt="">
      <div class="au-h">${t(link ? '계정 연동' : '은유와 은결')}</div>
      <p class="au-p">${t(link ? '지금까지 한 기록을 그대로 가지고 계정에 연결해요.' : '로그인하면 다른 기기에서도 이어서 할 수 있어요!')}</p>
      <button class="au-b g" data-a="google">${G_ICON}<span>${t('구글로 시작하기')}</span></button>
      <button class="au-b e" data-a="email">${t('이메일로 시작하기')}</button>
      ${link ? `<button class="au-b s" data-a="close">${t('닫기')}</button>` : `<button class="au-b s" data-a="guest">${t('게스트로 입장하기')}</button>`}
      <button class="au-small" data-a="login">${t('이메일로 가입했어요 (로그인)')}</button>
      <p class="au-terms">${t('시작하면')} <a href="${ROOT}legal/terms.html" target="_blank">${t('이용약관')}</a>${t('과')} <a href="${ROOT}legal/privacy.html" target="_blank">${t('개인정보 처리방침')}</a>${t('에 동의하게 돼요.')}<br>${t('게스트는 결제를 할 수 없어요.')}</p>`, opts.dim || link);
    box.onclick = (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      ({ google: () => birthBox('google'), email: () => birthBox('email'), login: pwLoginBox, guest: guestIn, close })[a.dataset.a]();
    };
  }
  // 생년월일 (만 14세 미만은 계정을 만들 수 없음: 보호자 동의가 필요해서. 저장하지 않음)
  function birthBox(next) {
    if (!window.FIREBASE_CONFIG) { noServer(); return; }
    const box = mount(`<div class="au-h">${t('생년월일')}</div><p class="au-p">${t('나이 확인에만 쓰고 저장하지 않아요.')}</p>
      <input class="au-in" type="date" max="${day(Date.now())}" min="1900-01-01"><p class="au-err"></p>
      <div class="au-row"><button class="au-b s" data-a="back">${t('뒤로')}</button><button class="au-b e" data-a="ok">${t('다음')}</button></div>`, true);
    box.onclick = (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'back') { loginBox(); return; }
      const v = $(box, 'input').value; if (!v) { err(box, '생년월일을 넣어 주세요'); return; }
      const b = new Date(v), n = new Date(); let age = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) age--;
      if (age < 14) { err(box, '만 14세 미만은 보호자 동의가 필요해서 아직 가입할 수 없어요. 게스트로 즐겨 주세요!'); return; }
      st.over14 = true; save();
      if (next === 'google') google(); else if (!window.EMAIL_CODE_READY) toast('이메일 가입은 준비 중이에요.\n지금은 구글로 시작하거나 게스트로 입장해 주세요!', 3200); else emailBox('signup');
    };
  }
  async function google() {
    const f = await firebase(); if (!f) { noServer(); return; }
    const p = new f.F.auth.GoogleAuthProvider();
    try {
      const u = f.auth.currentUser;
      if (u && u.isAnonymous) await u.linkWithPopup(p); else await f.auth.signInWithPopup(p);
      done('구글 계정으로 로그인했어요!');
    } catch (e) {
      if (e.code === 'auth/credential-already-in-use') { await f.auth.signInWithCredential(e.credential); done('구글 계정으로 로그인했어요!'); return; }
      if (e.code !== 'auth/popup-closed-by-user') toast('구글 로그인을 못 했어요: ' + (e.code || e.message));
    }
  }
  const call = async (name, data) => { const f = await firebase(); return (await f.fn.httpsCallable(name)(data)).data; };
  // 이메일 → 인증번호 → (가입·재설정) 비밀번호 정하기
  function emailBox(purpose) {
    const box = mount(`<div class="au-h">${t(purpose === 'reset' ? '비밀번호 재설정' : '이메일로 시작하기')}</div><p class="au-p">${t('이메일로 인증번호 6자리를 보내 드려요.')}</p>
      <input class="au-in" type="email" inputmode="email" autocomplete="email" placeholder="email@example.com"><p class="au-err"></p>
      <div class="au-row"><button class="au-b s" data-a="back">${t('뒤로')}</button><button class="au-b e" data-a="ok">${t('인증번호 받기')}</button></div>`, true);
    box.onclick = async (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'back') { purpose === 'reset' ? pwLoginBox() : loginBox(); return; }
      const email = $(box, 'input').value.trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err(box, '이메일을 다시 확인해 주세요'); return; }
      a.disabled = true; err(box, '보내는 중...');
      try { await call('sendCode', { email, purpose }); codeBox(email, purpose); } catch (x) { a.disabled = false; err(box, x.message || '보내지 못했어요'); }
    };
  }
  function codeBox(email, purpose) {
    const box = mount(`<div class="au-h">${t('인증번호')}</div><p class="au-p">${email}\n${t('메일로 온 6자리를 넣어 주세요 (10분 안에).')}</p>
      <input class="au-in code" inputmode="numeric" maxlength="6" autocomplete="one-time-code"><p class="au-err"></p>
      <div class="au-row"><button class="au-b s" data-a="again">${t('다시 보내기')}</button><button class="au-b e" data-a="ok">${t('확인')}</button></div>`, true);
    box.onclick = async (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'again') { try { await call('sendCode', { email, purpose }); err(box, '다시 보냈어요'); } catch (x) { err(box, x.message); } return; }
      const code = $(box, 'input').value.trim(); if (!/^\d{6}$/.test(code)) { err(box, '6자리 숫자를 넣어 주세요'); return; }
      a.disabled = true;
      try {
        const f = await firebase(), r = await call('verifyCode', { email, code, purpose, over14: st.over14 !== false });
        await f.auth.signInWithCustomToken(r.token); pwSetBox(email);
      } catch (x) { a.disabled = false; err(box, x.message || '인증번호가 맞지 않아요'); }
    };
  }
  function pwSetBox(email) {
    const box = mount(`<div class="au-h">${t('비밀번호 정하기')}</div><p class="au-p">${t('다음부터는 이메일과 이 비밀번호로 들어와요. (8자 이상)')}</p>
      <input class="au-in" type="password" autocomplete="new-password" placeholder="${t('비밀번호')}"><input class="au-in" type="password" autocomplete="new-password" placeholder="${t('한 번 더')}" style="margin-top:8px"><p class="au-err"></p>
      <button class="au-b e" data-a="ok">${t('완료')}</button>`, true);
    box.onclick = async (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      const [p1, p2] = [...box.querySelectorAll('input')].map((x) => x.value);
      if (p1.length < 8) { err(box, '8자 이상으로 정해 주세요'); return; }
      if (p1 !== p2) { err(box, '두 비밀번호가 달라요'); return; }
      a.disabled = true;
      try { const f = await firebase(); await f.auth.currentUser.updatePassword(p1); await f.auth.currentUser.reload(); onUser(f.auth.currentUser); done('준비 끝! 이메일 계정으로 로그인했어요.'); } catch (x) { a.disabled = false; err(box, x.message); }
    };
  }
  function pwLoginBox() {
    if (!window.FIREBASE_CONFIG) { noServer(); return; }
    const box = mount(`<div class="au-h">${t('이메일 로그인')}</div>
      <input class="au-in" type="email" autocomplete="email" placeholder="email@example.com"><input class="au-in" type="password" autocomplete="current-password" placeholder="${t('비밀번호')}" style="margin-top:8px"><p class="au-err"></p>
      <div class="au-row"><button class="au-b s" data-a="back">${t('뒤로')}</button><button class="au-b e" data-a="ok">${t('로그인')}</button></div>
      <button class="au-small" data-a="reset">${t('비밀번호를 잊었어요 (재설정)')}</button>`, true);
    box.onclick = async (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'back') { loginBox(); return; }
      if (a.dataset.a === 'reset') { if (!window.EMAIL_CODE_READY) { err(box, '비밀번호 재설정은 준비 중이에요'); return; } emailBox('reset'); return; }
      const [em, pw] = [...box.querySelectorAll('input')].map((x) => x.value.trim());
      try { const f = await firebase(); await f.auth.signInWithEmailAndPassword(em.toLowerCase(), pw); done('로그인했어요!'); } catch (x) { err(box, '이메일 또는 비밀번호가 맞지 않아요'); }
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
    const box = mount(`<div class="au-h">${t('계정')}</div><p class="au-p">${t(label)}${st.email ? '\n' + st.email : ''}</p>
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
    const box = mount(`<div class="au-h">${t('계정연동이 필요합니다.')}</div><p class="au-p">${t('게스트는 결제를 할 수 없어요.\n구글이나 이메일 계정을 연동하면 결제할 수 있어요. (광고 보기는 지금도 돼요)')}</p>
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
