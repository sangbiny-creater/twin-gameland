'use strict';
// [두더지 앱] downhill-app/app.js 를 복사해서 두더지(끝없이 이어지는 방식)에 맞게 고친 것
// 흐름: 인트로 → 언어(처음 한 번) → 로그인(구글·이메일·게스트) → 약관 동의 → 이름 만들기 → 시작 창 (캐릭터 고르기 없음) → 게임 → 결과(이어하기·다시하기·자랑하기·X)
//  · 계정 하나에 이름 하나 (예전 사이트처럼 캐릭터마다 이름 X). 이름은 모든 사람 통틀어 하나만 — 서버 names/{이름 열쇠} (사이트 common/names.js 와 같은 모음·같은 규칙)
//    인터넷이 안 될 때 만든 이름은 다음 접속 때 등록하고, 그새 다른 사람이 쓰고 있으면 이름을 다시 정하게 함
//  · 저장: localStorage 'mole_app_v1' (game.js 의 Save). 트윈 게임랜드 사이트 저장(twin_gameland_v1)·다운힐 앱 저장은 읽지도 쓰지도 않음
//  · 서버: 두더지 전용 Firebase 프로젝트 (lib/firebase_config.js, BROWN CRAB — 트윈 게임랜드·다운힐과 계정·이름·기록 완전 분리)
//    Firestore 규칙 mole-admin/server/firestore.rules · 백오피스 mole-admin/
//    users/{uid}.mo = { name, best, plays, agreedAt, agreeVer, createdAt, lastAt }
//    records(game 'mole-app') = 한 판 기록 (score = 점수, coins = 잡은 두더지, zone = 레벨) · config/mole = { notice, maintenance, maintenanceMsg }
//  · 친구 링크: ?from=12300&by=이름 → 시작 창에 "OOO님 점수 12,300점을 넘어 보세요!"
(function () {
  const D = window.__mole, Save = D.Save, G = D.G;
  const $ = (id) => document.getElementById(id);
  const show = (id, on = true) => $(id).classList.toggle('hidden', !on);
  const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
  const ui = () => { D.Audio.unlock(); D.Audio.sfx('ui'); };
  const T = (t) => (window.I18N && I18N.tr ? I18N.tr(t) : t); // 영어판 글자 (lib/i18n_data.js)
  const GAME = 'mole-app', TERMS_VER = '2026-11';
  const WEB = 'https://sangbiny-creater.github.io/twin-gameland/mole-app/'; // 앱 주소 (임시: 트윈 게임랜드 저장소. 새 주소가 정해지면 바꾸기 — index.html og: 주소도)
  // 앱 주소 (자랑하기 링크). 웹에서 열면 지금 주소, 앱(파일로 묶은 것)에서는 사이트 주소
  const appUrl = () => (/^https?:$/.test(location.protocol) ? location.origin + location.pathname.replace(/index\.html$/, '') : WEB);
  const dayOf = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  // 이름: 사이트 common/names.js 와 같은 규칙(띄어쓰기·영어 대소문자는 같은 이름으로 봄). 길이는 폭으로 셈:
  //  영어·숫자·기호 = 1칸, 한글 등 = 2칸, 15칸까지 (영어 15자 = 한글 7자)
  const NAME_W = 15;
  const charW = (c) => (c.codePointAt(0) < 0x80 ? 1 : 2);
  const fitW = (s) => { let w = 0, out = ''; for (const c of s) { if (w + charW(c) > NAME_W) break; w += charW(c); out += c; } return out; };
  const cleanName = (n) => fitW(String(n || '').replace(/[<>"'`]/g, '').replace(/\s+/g, ' ').trim()).trim();
  const keyOf = (n) => String(n || '').normalize('NFC').replace(/\s+/g, '').toLowerCase().replace(/\//g, '_').replace(/^\.+$/, '_');

  // ---------- Firebase 프로젝트가 바뀌면 (트윈 게임랜드 twin-gameland → 두더지 전용 프로젝트) 계정을 처음부터 ----------
  //  예전 프로젝트의 로그인·이름·기록은 새 프로젝트에 없어서, 이 기기에 남은 계정 정보는 지우고 로그인부터 다시 (언어·소리는 그대로)
  const PID = (window.FIREBASE_CONFIG || {}).projectId || '';
  if (Save.data.pid !== PID) {
    if (Save.data.auth) Object.assign(Save.data, { auth: null, agreed: null, name: null, nameKey: null, nameReg: false, best: 0, plays: 0, totalCaught: 0 });
    Save.data.pid = PID; Save.store();
  }

  // ---------- 친구 링크 ----------
  const q = new URLSearchParams(location.search);
  // 친구 기록은 이번 접속 동안 기억 (언어를 바꿔 다시 읽어도 그대로)
  let fq = { from: q.get('from'), by: q.get('by') };
  try { if (fq.from) sessionStorage.setItem('mo_friend', JSON.stringify(fq)); else fq = JSON.parse(sessionStorage.getItem('mo_friend') || '{}'); } catch (e) { /* ignore */ }
  const friend = Math.max(0, Math.min(99999999, parseInt(fq.from, 10) || 0));
  const friendBy = cleanName(fq.by);
  if (friend && history.replaceState) history.replaceState(null, '', location.pathname); // 새로고침해도 주소에 남지 않게 (기록은 이번 접속 동안 기억)
  const friendWho = friendBy ? (window.I18N && I18N.lang === 'en' ? friendBy : `${friendBy}님`) : '친구'; // 영어판은 '님' 없이
  const P = (n) => `${fmt(n)}점`; // 점수 글자

  let toastT = 0;
  function toast(msg, ms = 2400) { const t = $('toast'); t.textContent = msg; show('toast'); clearTimeout(toastT); toastT = setTimeout(() => show('toast', false), ms); }

  // ---------- 색(여자 분홍·남자 파랑) · 창 크기 ----------
  const paintWho = () => { document.documentElement.dataset.who = 'eunyu'; }; // 두더지 앱은 캐릭터 고르기가 없어서 창 색은 늘 분홍
  function fitZoom() { // 화면 전체 창(440 기준)을 앱 폭에 맞춤
    const w = $('app').clientWidth, h = $('app').clientHeight;
    document.documentElement.style.setProperty('--z', Math.max(0.6, Math.min(1.15, (w - 24) / 440, (h - 40) / 640)).toFixed(3));
  }
  // 리본 제목이 길면 글자만 줄임
  function fitTitles(root) {
    root.querySelectorAll('.sq-title').forEach((t) => { t.style.fontSize = ''; let f = 26; while (t.scrollWidth > t.clientWidth + 1 && f > 16) t.style.fontSize = (--f) + 'px'; });
  }
  addEventListener('resize', fitZoom);
  // 모든 글자 칸: 글자가 칸 안쪽 여백(padding, 최소 MINPAD) 안에 들어가게 — 넘으면 글자만 조금씩 줄임 (영어처럼 긴 글자)
  const MINPAD = 6;
  const FIT = '.sq-btn, .sq-title, .sel-ask b, .sel-lang, .rk-seg button, .rk-tabs button, .set-row, .sq-best, .sq-friend, .ck, .sq-links button, .gp-new';
  function textW(el) { let L = Infinity, R = -Infinity; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); while (w.nextNode()) { const n = w.currentNode; if (!n.nodeValue.trim()) continue; const r = document.createRange(); r.selectNodeContents(n); for (const q of r.getClientRects()) if (q.width) { L = Math.min(L, q.left); R = Math.max(R, q.right); } } return L === Infinity ? null : [L, R]; }
  function fitAll(root = document) {
    root.querySelectorAll(FIT).forEach((el) => {
      if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return;
      el.style.fontSize = '';
      let fs = parseFloat(getComputedStyle(el).fontSize); const min = fs * 0.6;
      for (let i = 0; i < 30; i++) {
        const t = textW(el); if (!t) break;
        const b = el.getBoundingClientRect(), cs = getComputedStyle(el), k = b.width / (el.offsetWidth || b.width || 1);
        const pl = Math.max(parseFloat(cs.paddingLeft) || 0, MINPAD) * k, pr = Math.max(parseFloat(cs.paddingRight) || 0, MINPAD) * k;
        if (t[0] >= b.left + pl - 0.5 && t[1] <= b.right - pr + 0.5 && el.scrollWidth <= el.clientWidth + 1) break;
        if (fs <= min) break;
        el.style.fontSize = (fs -= 0.5) + 'px';
      }
    });
  }
  let fitT = 0; const fitSoon = () => { clearTimeout(fitT); fitT = setTimeout(() => fitAll(), 60); };
  new MutationObserver(fitSoon).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
  addEventListener('resize', fitSoon);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitSoon);

  // ---------- 화면 바꾸기 ----------
  const SCR = ['intro', 'login', 'rank'];
  const BOX = ['loginMain', 'loginEmail', 'signupBox', 'langBox', 'termsBox', 'nameBox', 'blockBox', 'accountBox'];
  function screen(id) {
    SCR.forEach((s) => show(s, s === id));
    const game = !id; show('stage', game); show('adBar', game);
    if (window.Native && Native.on) Native.banner(game); // 앱: 맨 위 진짜 배너 광고는 게임 화면(시작 창 포함)에서만
    if (game) requestAnimationFrame(D.resize);
    paintWho(); fitZoom();
  }
  function box(id) { screen('login'); BOX.forEach((b) => show(b, b === id)); fitTitles($(id)); }
  let blocked = false;
  function next() {
    if (blocked) return;
    if (!Save.data.lang) return langScreen(false);
    if (!Save.data.auth) return box('loginMain');
    if (!Save.data.agreed) return termsScreen();
    if (!Save.data.name) return nameScreen();
    home();
  }
  function block(msg) { blocked = true; $('blockText').textContent = msg; box('blockBox'); }

  // ---------- 인트로: 그림만 (누르거나 2.5초 뒤) ----------
  let introDone = false;
  const endIntro = () => { if (introDone) return; introDone = true; D.Audio.unlock(); next(); };
  $('intro').addEventListener('click', endIntro);
  let skipIntro = false; try { skipIntro = !!sessionStorage.getItem('mo_skip_intro'); sessionStorage.removeItem('mo_skip_intro'); } catch (e) { /* ignore */ }
  setTimeout(endIntro, skipIntro ? 0 : 2500);

  // ---------- 서버 (Firebase: 로그인 · 이름 · 기록) ----------
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  let fbReady = null;
  const loadJs = (u) => new Promise((ok, no) => { const s = document.createElement('script'); s.src = u; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  const timeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
  function firebase() {
    if (!window.FIREBASE_CONFIG) return Promise.resolve(null);
    if (!fbReady) {
      const p = fbReady = (async () => {
        for (const n of ['app', 'auth', 'firestore']) await loadJs(`${SDK}firebase-${n}-compat.js`);
        const F = window.firebase, app = F.apps.length ? F.app() : F.initializeApp(window.FIREBASE_CONFIG);
        const f = { F, auth: app.auth(), db: app.firestore() };
        await new Promise((ok) => { const off = f.auth.onAuthStateChanged(() => { off(); ok(); }); });
        return f;
      })().catch((e) => { console.warn('firebase', e); return null; });
      p.then((f) => { if (!f && fbReady === p) fbReady = null; }); // 실패하면 다음에 다시
    }
    return timeout(fbReady, 8000);
  }
  const me = (f) => (f && f.auth.currentUser) || null;

  // 내 계정 문서 (users/{uid}): mo = 두더지 앱 칸. 처음이면 만듦 (규칙: 만들 때 status 'active')
  async function saveUser(mo = {}) {
    const f = await firebase(), u = me(f); if (!u) return;
    try {
      const ref = f.db.collection('users').doc(u.uid), s = await ref.get(), now = Date.now();
      const base = { name: Save.data.name || '', lastAt: now, ...mo };
      const first = { createdAt: now, best: Save.data.best || 0, plays: 0, agreedAt: (Save.data.agreed || {}).at || now, agreeVer: TERMS_VER, ...base };
      if (!s.exists) await ref.set({ provider: Save.data.auth.mode, email: u.email || '', createdAt: now, lastAt: now, status: 'active', totalSec: 0, app: 'mole', mo: first });
      else await ref.set({ lastAt: now, mo: s.data().mo ? base : first }, { merge: true });
    } catch (e) { console.warn('user', e); }
  }

  // 로그인 뒤: 서버에 이 계정의 이름·캐릭터·기록이 있으면 가져옴 (다른 기기에서 이어 하기)
  async function afterAuth(mode, u) {
    const prev = Save.data.auth;
    if (prev && prev.uid !== u.uid) Object.assign(Save.data, { agreed: null, name: null, nameKey: null, nameReg: false, best: 0, plays: 0, totalCaught: 0 });
    Save.data.auth = { mode, uid: u.uid, email: u.email || '', at: Date.now() };
    const f = await firebase();
    if (f && me(f)) {
      try {
        const s = await f.db.collection('users').doc(u.uid).get(), d = s.exists ? s.data() : null;
        if (d && d.status === 'banned') { Save.store(); block('이용이 제한된 계정이에요.'); return; }
        const mo = d && d.mo;
        if (mo) {
          if (mo.agreedAt) Save.data.agreed = { at: mo.agreedAt, ver: mo.agreeVer || TERMS_VER };
          if (mo.name) Object.assign(Save.data, { name: mo.name, nameKey: keyOf(mo.name), nameReg: true });
          Save.data.best = Math.max(Save.data.best || 0, mo.best || 0);
        }
      } catch (e) { console.warn('user', e); }
    }
    Save.store(); next();
  }

  // ---------- 로그인: 구글 · 이메일 · 게스트 ----------
  async function google() {
    const f = await firebase(); if (!f) { toast('인터넷 연결을 확인해 주세요.\n지금은 게스트로 시작할 수 있어요!'); return; }
    const p = new f.F.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
    const cur = me(f);
    if (window.Native && Native.on) { // 앱 안: 웹 팝업 대신 휴대폰의 구글 계정 고르기 → 받은 토큰으로 Firebase 로그인
      try {
        const cred = f.F.auth.GoogleAuthProvider.credential(await Native.googleIdToken());
        let r;
        if (cur && cur.isAnonymous) { // 게스트가 구글 계정 연결: 같은 계정(uid)이라 이름·기록이 그대로
          try { r = await cur.linkWithCredential(cred); } catch (e) {
            if (e.code !== 'auth/credential-already-in-use') throw e;
            await releaseName(); r = await f.auth.signInWithCredential(e.credential || cred);
          }
        } else r = await f.auth.signInWithCredential(cred);
        toast('구글 계정으로 로그인했어요!');
        await afterAuth('google', r.user);
      } catch (e) {
        if (/cancel/i.test((e && (e.code || e.message)) || '')) return;
        toast('구글 로그인을 못 했어요 (' + ((e && (e.code || e.message)) || '') + ')');
      }
      return;
    }
    try {
      let r;
      if (cur && cur.isAnonymous) { // 게스트가 구글 계정 연결: 같은 계정(uid)이라 이름·기록이 그대로
        try { r = await cur.linkWithPopup(p); } catch (e) {
          if (e.code !== 'auth/credential-already-in-use') throw e;
          await releaseName(); r = await f.auth.signInWithCredential(e.credential); // 이미 있는 구글 계정이면 그 계정으로 (게스트 이름은 놓아줌)
        }
      } else r = await f.auth.signInWithPopup(p);
      toast('구글 계정으로 로그인했어요!');
      await afterAuth('google', r.user);
    } catch (e) {
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') { try { sessionStorage.setItem('mo_redirect', '1'); } catch (x) { /* ignore */ } f.auth.signInWithRedirect(p); return; }
      toast('구글 로그인을 못 했어요 (' + (e.code || e.message) + ')');
    }
  }
  // 팝업이 막혀서 페이지를 옮겨 로그인하고 돌아온 경우
  try {
    if (sessionStorage.getItem('mo_redirect')) {
      sessionStorage.removeItem('mo_redirect');
      firebase().then((f) => f && f.auth.getRedirectResult()).then((r) => { if (r && r.user) { introDone = true; toast('구글 계정으로 로그인했어요!'); afterAuth('google', r.user); } }).catch(() => {});
    }
  } catch (e) { /* ignore */ }
  // ---------- 이메일 (Firebase 이메일·비밀번호): 로그인 · 가입하기(확인 메일) · 비밀번호 재설정(메일) ----------
  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const authErr = (e) => ({
    'auth/email-already-in-use': '이미 가입된 이메일이에요. 로그인해 주세요',
    'auth/invalid-email': '이메일을 다시 확인해 주세요',
    'auth/weak-password': '비밀번호는 6자 이상으로 정해 주세요',
    'auth/too-many-requests': '잠시 뒤에 다시 해 주세요',
    'auth/network-request-failed': '인터넷 연결을 확인해 주세요',
    'auth/operation-not-allowed': '이메일 가입이 아직 켜져 있지 않아요',
  })[e && e.code] || '이메일 또는 비밀번호가 맞지 않아요';
  async function emailLogin() {
    const em = $('inEmail').value.trim().toLowerCase(), pw = $('inPw').value;
    if (!EMAIL_RE.test(em)) { $('emailErr').textContent = '이메일을 다시 확인해 주세요'; return; }
    if (!pw) { $('emailErr').textContent = '비밀번호를 넣어 주세요'; return; }
    const f = await firebase(); if (!f) { $('emailErr').textContent = '인터넷 연결을 확인해 주세요'; return; }
    $('btnEmailGo').disabled = true; $('emailErr').textContent = '';
    try { const r = await f.auth.signInWithEmailAndPassword(em, pw); $('inPw').value = ''; toast('로그인했어요!'); await afterAuth('email', r.user); }
    catch (e) { $('emailErr').textContent = authErr(e); }
    $('btnEmailGo').disabled = false;
  }
  async function emailSignup() {
    const em = $('suEmail').value.trim().toLowerCase(), pw = $('suPw').value, pw2 = $('suPw2').value;
    if (!EMAIL_RE.test(em)) { $('suErr').textContent = '이메일을 다시 확인해 주세요'; return; }
    if (pw.length < 6) { $('suErr').textContent = '비밀번호는 6자 이상으로 정해 주세요'; return; }
    if (pw !== pw2) { $('suErr').textContent = '두 비밀번호가 달라요'; return; }
    const f = await firebase(); if (!f) { $('suErr').textContent = '인터넷 연결을 확인해 주세요'; return; }
    $('btnSuGo').disabled = true; $('suErr').textContent = '';
    try {
      f.auth.languageCode = Save.data.lang === 'en' ? 'en' : 'ko';
      const cur = me(f), cred = f.F.auth.EmailAuthProvider.credential(em, pw);
      const r = cur && cur.isAnonymous ? await cur.linkWithCredential(cred) : await f.auth.createUserWithEmailAndPassword(em, pw); // 게스트면 같은 계정에 이메일을 붙임 (기록 그대로)
      try { await r.user.sendEmailVerification(); } catch (x) { /* 확인 메일은 못 보내도 가입은 됨 */ }
      $('suPw').value = $('suPw2').value = '';
      toast('가입했어요! 확인 메일을 보냈어요', 3200);
      await afterAuth('email', r.user);
    } catch (e) { $('suErr').textContent = authErr(e); }
    $('btnSuGo').disabled = false;
  }
  async function pwReset() {
    const em = $('inEmail').value.trim().toLowerCase();
    if (!EMAIL_RE.test(em)) { $('emailErr').textContent = '비밀번호를 바꿀 이메일을 위에 적어 주세요'; return; }
    const f = await firebase(); if (!f) { $('emailErr').textContent = '인터넷 연결을 확인해 주세요'; return; }
    try { f.auth.languageCode = Save.data.lang === 'en' ? 'en' : 'ko'; await f.auth.sendPasswordResetEmail(em); $('emailErr').textContent = ''; toast('비밀번호를 바꾸는 메일을 보냈어요', 3200); }
    catch (e) { $('emailErr').textContent = e && e.code === 'auth/user-not-found' ? '가입되지 않은 이메일이에요' : authErr(e); }
  }
  $('btnToSignup').onclick = () => { ui(); $('suEmail').value = $('inEmail').value; $('suErr').textContent = ''; box('signupBox'); };
  $('btnSuBack').onclick = () => { ui(); box('loginEmail'); };
  $('btnSuGo').onclick = () => { ui(); emailSignup(); };
  $('suPw2').addEventListener('keydown', (e) => { if (e.key === 'Enter') emailSignup(); });
  $('btnPwReset').onclick = () => { ui(); pwReset(); };
  async function guest() {
    $('btnGuest').disabled = true;
    const f = await firebase();
    let u = me(f);
    if (f && (!u || !u.isAnonymous)) { try { u = (await f.auth.signInAnonymously()).user; } catch (e) { u = null; } }
    $('btnGuest').disabled = false;
    // 서버가 안 되면 이 기기 안에서만 (이름은 다음 접속 때 등록)
    await afterAuth('guest', u || { uid: 'local-' + Math.random().toString(36).slice(2, 10), email: '' });
  }
  $('btnGoogle').onclick = () => { ui(); google(); };
  // 서버(Firebase) 설정이 아직 없으면 구글·이메일 로그인은 숨기고 게스트만 (lib/firebase_config.js)
  if (!window.FIREBASE_CONFIG) ['btnGoogle', 'btnEmail', 'btnLink'].forEach((id) => $(id).classList.add('hidden'));
  $('btnEmail').onclick = () => { ui(); box('loginEmail'); $('emailErr').textContent = ''; };
  $('btnEmailBack').onclick = () => { ui(); box('loginMain'); };
  $('btnEmailGo').onclick = () => { ui(); emailLogin(); };
  $('inPw').addEventListener('keydown', (e) => { if (e.key === 'Enter') emailLogin(); });
  $('btnGuest').onclick = () => { ui(); guest(); };
  // 입력 칸에서는 화면 이동 막기(game.js 의 touchmove 막기)를 풀어 줌
  ['inEmail', 'inPw', 'inName', 'suEmail', 'suPw', 'suPw2'].forEach((id) => $(id).addEventListener('touchmove', (e) => e.stopPropagation()));

  // ---------- 약관 동의: [필수] 개인정보 수집·이용 · [필수] 이용약관 (체크) + 개인정보 처리방침 (보기만) ----------
  function termsScreen() { $('ckPrivacy').checked = false; $('ckTerms').checked = false; $('termsErr').textContent = ''; show('privacyDetail', false); box('termsBox'); }
  $('btnPrivacyMore').onclick = (e) => { e.preventDefault(); show('privacyDetail', $('privacyDetail').classList.contains('hidden')); };
  ['ckPrivacy', 'ckTerms'].forEach((id) => $(id).addEventListener('change', () => { $('termsErr').textContent = ''; }));
  $('btnTermsOk').onclick = () => {
    ui();
    if (!$('ckPrivacy').checked || !$('ckTerms').checked) { $('termsErr').textContent = '필수 항목에 모두 동의해 주세요'; return; }
    Save.data.agreed = { at: Date.now(), ver: TERMS_VER }; Save.store(); next();
  };
  $('btnTermsBack').onclick = () => { ui(); logout(true); };

  // ---------- 이름 만들기 (계정 하나에 이름 하나, 같은 이름은 하나만) ----------
  function nameScreen(msg) { $('inName').value = ''; $('nameErr').textContent = msg || ''; box('nameBox'); }
  // 이름 등록: 'ok' | 'taken' | 'offline' (비어 있거나 내 것일 때만, 트랜잭션)
  async function claimName(name) {
    const f = await firebase(), u = me(f); if (!u) return 'offline';
    const ref = f.db.collection('names').doc(keyOf(name));
    try {
      return await timeout(f.db.runTransaction(async (x) => {
        const s = await x.get(ref);
        if (s.exists && s.data().uid !== u.uid) return 'taken';
        x.set(ref, { uid: u.uid, cid: 'mo', pid: '', name, app: 'mole', at: Date.now() });
        return 'ok';
      }), 8000) || 'offline';
    } catch (e) { console.warn('names', e); return 'offline'; }
  }
  // 이름이 비어 있는지만 보기 (로그인 없이 읽기만): 'ok' | 'taken' | 'offline'
  async function checkName(name) {
    const f = await firebase(); if (!f) return 'offline';
    try { const s = await timeout(f.db.collection('names').doc(keyOf(name)).get(), 6000); if (!s) return 'offline'; return !s.exists || (me(f) && s.data().uid === me(f).uid) ? 'ok' : 'taken'; } catch (e) { return 'offline'; }
  }
  // 내 이름 놓아주기: 이 기기에 적힌 이름 + 서버에서 내 계정으로 등록된 이름을 모두 지움 (계정 삭제·게스트 로그아웃)
  async function releaseName() {
    const f = await firebase(), u = me(f); if (!u) return;
    const keys = new Set(); if (Save.data.nameKey) keys.add(Save.data.nameKey);
    try { (await f.db.collection('names').where('uid', '==', u.uid).get()).forEach((d) => keys.add(d.id)); } catch (e) { /* 그대로 */ }
    for (const k of keys) { try { await f.db.collection('names').doc(k).delete(); } catch (e) { /* 내 이름이 아니면 못 지움 */ } }
  }
  $('btnNameOk').onclick = async () => {
    ui();
    const n = cleanName($('inName').value);
    if ([...n].length < 2) { $('nameErr').textContent = '이름은 2글자 이상으로 정해 주세요'; return; }
    $('btnNameOk').disabled = true; $('nameErr').textContent = '확인하는 중...';
    let r = await claimName(n);
    if (r === 'offline') r = (await checkName(n)) === 'taken' ? 'taken' : 'offline';
    $('btnNameOk').disabled = false;
    if (r === 'taken') { $('nameErr').textContent = '이미 다른 사람이 쓰는 이름이에요'; return; }
    Object.assign(Save.data, { name: n, nameKey: keyOf(n), nameReg: r === 'ok' }); Save.store();
    $('nameErr').textContent = '';
    toast(T(`반가워요, ${n}님!`) + (r === 'ok' ? '' : '\n' + T('(인터넷이 연결되면 이름을 등록해요)')));
    saveUser(); next();
  };
  $('inName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnNameOk').click(); });
  // 쓰는 동안 15칸을 넘으면 넘은 글자만 뺌 (한글 조합 중에는 기다렸다가)
  const trimName = () => { const el = $('inName'), v = fitW(el.value); if (v !== el.value) el.value = v; };
  $('inName').addEventListener('input', (e) => { if (!e.isComposing) trimName(); });
  $('inName').addEventListener('compositionend', trimName);

  // ---------- 시작 창 (무한 방식이라 'N판부터'는 없음) ----------
  function home() {
    screen(null);
    if (G.state !== 'home') D.setState('home');
    D.resetRun(); // 뒤에 빈 구멍 풀밭
    ['hud', 'pause', 'result', 'shareBox'].forEach((id) => show(id, false));
    $('sbName').textContent = Save.data.name || '';
    $('sbBest').textContent = fmt(Save.data.best);
    $('sbFriend').textContent = friend ? `${friendWho} 점수 ${P(friend)}을 넘어 보세요!` : '';
    show('sbFriend', !!friend);
    show('startBox'); show('btnSettings'); show('setBox', false);
  }
  function begin() { show('startBox', false); show('btnSettings', false); D.startRun(); }
  $('btnGo').onclick = () => { ui(); begin(); };
  $('btnRank').onclick = () => { ui(); rankScreen(); };

  // ---------- 설정 (오른쪽 위, 트윈 게임랜드 설정 창과 같은 줄 모양) ----------
  const LANGS = { ko: '한국어', en: 'English' };
  function paintSettings() {
    const m = (Save.data.auth || {}).mode;
    $('setAccountVal').textContent = { guest: '게스트', google: '구글', email: '이메일' }[m] || '로그인';
    $('setSoundVal').textContent = Save.data.sound ? '켜짐' : '꺼짐';
    $('setLangVal').textContent = LANGS[Save.data.lang || 'ko'];
  }
  $('btnSettings').onclick = () => { ui(); paintSettings(); show('setBox'); fitTitles($('setBox')); };
  $('setClose').onclick = () => { ui(); show('setBox', false); };
  $('setAccount').onclick = () => { ui(); show('setBox', false); accountScreen(); };
  $('setSound').onclick = () => { Save.data.sound = !Save.data.sound; Save.store(); D.Audio.applyMute(); ui(); paintSettings(); };
  $('setLang').onclick = () => { ui(); show('setBox', false); langScreen(true); };

  // ---------- 이용약관 · 개인정보 처리방침: 게임 안 화면으로 (뒤로 버튼으로 돌아옴) ----------
  //  글 = 서버 config/mole_terms { terms, privacy, collect } (백오피스 '약관·개인정보' 탭에서 고침)
  //  아직 안 고쳤으면 기본 글: 이용약관 = 앱 안 legal/terms.txt (BROWN CRAB), 개인정보 처리방침 = brown-crab.com/privacy.html
  const DOC_DEF = { terms: ['legal/terms.txt', null], privacy: ['https://brown-crab.com/privacy.html', 'main'] }; // 기본 글 (백오피스에서 저장하면 그 글)
  let docsP = null;
  const htmlText = (el) => { // 화면에 안 그린 문서라 innerText 가 줄을 안 바꿈 → 문단·제목·목록마다 줄바꿈
    let out = ''; const BLOCK = /^(P|DIV|H[1-6]|LI|UL|OL|SECTION|ARTICLE|HEADER|FOOTER|TR|TABLE|BLOCKQUOTE)$/;
    const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3) out += c.nodeValue.replace(/\s+/g, ' '); else if (c.nodeType === 1) { if (c.tagName === 'BR') { out += '\n'; continue; } const b = BLOCK.test(c.tagName); if (b) out += '\n'; if (c.tagName === 'LI') out += '· '; walk(c); if (b) out += '\n'; } } };
    if (el.querySelector('p, h1, h2, h3, li, div, br')) walk(el); else out = el.textContent;
    return out.split('\n').map((l) => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  };
  function docs() {
    if (!docsP) docsP = (async () => {
      const out = {};
      try { const f = await firebase(); if (f) { const d = await timeout(f.db.collection('config').doc('mole_terms').get(), 6000); if (d && d.exists) Object.assign(out, d.data()); } } catch (e) { /* 기본 글 */ }
      for (const k of ['terms', 'privacy']) if (!out[k]) {
        try { const t = await (await fetch(DOC_DEF[k][0])).text(); if (!DOC_DEF[k][1]) { out[k] = t.trim(); continue; } const el = new DOMParser().parseFromString(t, 'text/html').querySelector(DOC_DEF[k][1]); out[k] = el ? htmlText(el) : ''; } catch (e) { out[k] = ''; }
      }
      if (out.collect) $('privacyDetail').textContent = out.collect;
      return out;
    })();
    return docsP;
  }
  async function docView(k) {
    $('docTitle').textContent = k === 'terms' ? '이용약관' : '개인정보 처리방침';
    $('docBody').textContent = T('불러오는 중이에요…');
    show('docView'); $('docView').scrollTop = 0;
    const d = await docs();
    $('docBody').textContent = d[k] || T('글을 불러오지 못했어요. 인터넷 연결을 확인해 주세요');
  }
  document.querySelectorAll('[data-doc]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); ui(); docView(b.dataset.doc); }));
  $('docBack').onclick = () => { ui(); show('docView', false); };
  setTimeout(() => docs(), 3000); // 약관 동의 화면의 '모으는 것' 글을 미리 서버 글로

  // ---------- 언어: 처음 접속 때 한 번 (그 뒤로는 설정·캐릭터 고르기의 언어 버튼) ----------
  let langBack = false;
  function langScreen(back) { langBack = back; box('langBox'); }
  document.querySelectorAll('#langBox [data-lang]').forEach((b) => b.addEventListener('click', () => {
    ui(); const was = (window.I18N && I18N.lang) || 'ko', v = b.dataset.lang;
    Save.data.lang = v; Save.store();
    if (v !== was) { try { sessionStorage.setItem('mo_skip_intro', '1'); } catch (e) { /* ignore */ } location.reload(); return; } // 화면 글자를 고른 언어로 다시 읽음 (lib/i18n.js)
    if (langBack) { langBack = false; if (Save.data.name) home(); else next(); } else next();
  }));

  // ---------- 계정 ----------
  function accountScreen() {
    const a = Save.data.auth || {};
    $('accountText').textContent = `${Save.data.name || ''}\n` + (a.mode === 'guest' ? T('게스트로 하고 있어요.') + '\n' + T('구글 계정을 연결하면 다른 기기에서도 이어서 할 수 있어요.') : `${T(a.mode === 'google' ? '구글 계정' : '이메일 계정')}${a.email ? '\n' + a.email : ''}`);
    show('btnLink', a.mode === 'guest' && !!window.FIREBASE_CONFIG);
    box('accountBox');
  }
  async function logout(silent) {
    const a = Save.data.auth || {};
    if (!silent && a.mode === 'guest' && !confirm('게스트 기록과 이름은 사라져요. 로그아웃할까요?')) return;
    const f = await firebase();
    if (a.mode === 'guest') await releaseName(); // 게스트 이름은 다른 사람이 쓸 수 있게 놓아줌
    if (f && me(f)) { try { await f.auth.signOut(); } catch (e) { /* ignore */ } }
    if (window.Native && Native.on) Native.googleSignOut(); // 앱: 다음에 구글 계정을 다시 고를 수 있게
    Object.assign(Save.data, { auth: null, agreed: null, name: null, nameKey: null, nameReg: false, best: 0, plays: 0, totalCaught: 0 });
    Save.store(); if (!silent) toast('로그아웃했어요'); next();
  }
  $('btnLink').onclick = () => { ui(); google(); };
  // 계정 삭제: 이름을 놓아주고, 서버 계정 문서에 삭제 요청 표시(이메일·이름 지움) → 로그인 계정 자체를 지움 → 이 기기 기록도 지움
  //  남은 게임 기록(records)과 계정 문서는 백오피스 '사용자' 탭에서 '데이터 지우기'로 지움 (규칙상 관리자만 지울 수 있어서)
  async function deleteAccount() {
    if (!confirm('계정을 지우면 이름과 기록이 모두 사라지고 되돌릴 수 없어요. 계정을 삭제할까요?')) return;
    const a = Save.data.auth || {}, f = await firebase(), u = me(f);
    if (a.mode !== 'guest' && !u) { toast('인터넷 연결을 확인해 주세요'); return; }
    if (u) {
      try {
        await releaseName();
        const ref = f.db.collection('users').doc(u.uid), sn = await ref.get(), now = Date.now();
        const mark = { email: '', deleteRequested: now, mo: { deleted: true, deletedAt: now, name: '' } };
        if (sn.exists) await ref.set(mark, { merge: true }); else await ref.set({ ...mark, provider: a.mode || 'guest', createdAt: now, status: 'active', totalSec: 0, app: 'mole' });
      } catch (e) { console.warn('delete mark', e); }
      try { await u.delete(); }
      catch (e) {
        if (e.code !== 'auth/requires-recent-login') { toast(T('계정을 지우지 못했어요') + ' (' + (e.code || e.message) + ')'); return; }
        // 오래전에 로그인했으면 한 번 더 로그인한 뒤 지움
        try {
          if (a.mode === 'google') await u.reauthenticateWithPopup(new f.F.auth.GoogleAuthProvider());
          else if (a.mode === 'email') { const pw = prompt(T('비밀번호를 한 번 더 넣어 주세요')); if (!pw) return; await u.reauthenticateWithCredential(f.F.auth.EmailAuthProvider.credential(u.email, pw)); }
          await u.delete();
        } catch (x) { toast(T('계정을 지우지 못했어요') + ' (' + (x.code || x.message) + ')'); return; }
      }
    }
    const keep = { lang: Save.data.lang, sound: Save.data.sound };
    Object.keys(Save.data).forEach((k) => { delete Save.data[k]; });
    Object.assign(Save.data, { best: 0, plays: 0, totalCaught: 0, auth: null, agreed: null, name: null, nameKey: null, nameReg: false }, keep);
    Save.store(); toast('계정을 삭제했어요'); next();
  }
  $('btnDelete').onclick = () => { ui(); deleteAccount(); };
  $('btnLogout').onclick = () => { ui(); logout(); };
  $('btnAccountClose').onclick = () => { ui(); home(); };

  // ---------- 결과 ----------
  let lastRes = null;
  function onResult(r) {
    lastRes = r;
    $('resTitle').textContent = r.isBest ? '최고 기록 달성!' : '게임 끝'; // 트윈 게임랜드 결과 창과 같은 제목 + NEW BEST!
    show('btnCont', r.canContinue);
    const beat = friend && r.score > friend;
    $('resFriend').textContent = friend ? (beat ? `${friendWho} 점수 ${P(friend)}을 넘었어요!` : `${friendWho} 점수 ${P(friend)}까지 ${P(friend - r.score)} 남았어요`) : '';
    show('resFriend', !!friend);
    fitTitles($('result'));
    record(r);
  }
  // 기록 보내기 (백오피스·나중에 순위): 서버가 안 되면 그냥 넘어감
  async function record(r) {
    Save.data.plays = (Save.data.plays || 0) + 1; Save.store();
    const f = await firebase(), u = me(f); if (!u || !r.score) return;
    const now = Date.now();
    try {
      await f.db.collection('records').add({ uid: u.uid, game: GAME, score: r.score, coins: r.caught || 0, combo: r.combo || 0, sec: r.sec || 0, stage: null, cleared: false, stars: 0, zone: r.level || 1, name: Save.data.name || '', cid: 'mo', look: '', at: now, day: dayOf(now), month: dayOf(now).slice(0, 7), sat: f.F.firestore.FieldValue.serverTimestamp() });
      await saveUser({ best: Save.data.best || 0, plays: f.F.firestore.FieldValue.increment(1) });
    } catch (e) { console.warn('record', e); }
  }
  $('btnCloseR').onclick = () => { ui(); D.goHome(); };
  $('btnRetry').onclick = () => { ui(); D.goHome(); }; // 다시하기 = 시작 창
  $('btnCont').onclick = () => { ui(); rewardedAd().then((ok) => { if (ok && window.GameContinue && GameContinue.can()) { show('result', false); GameContinue.go(); } }); };
  $('btnShare').onclick = () => { ui(); share(); };

  // ---------- 광고 (지금은 가짜. 앱으로 묶을 때 AdMob 보상형 광고로 바꿈) ----------
  async function rewardedAd() {
    if (window.Native && Native.on) { // 앱: 진짜 보상형 광고 (lib/native.js). 광고를 못 불러오면 그냥 이어하게 해 줌
      const r = await Native.rewarded();
      if (r === 'none') { toast('지금은 광고를 불러오지 못해서 그냥 이어서 해요'); return true; }
      if (!r) toast('광고를 끝까지 보면 이어서 할 수 있어요');
      return !!r;
    }
    return new Promise((done) => {
      show('adFake'); let n = 3; $('adCount').textContent = n;
      const t = setInterval(() => { n--; $('adCount').textContent = n; if (n <= 0) { clearInterval(t); show('adFake', false); done(true); } }, 1000);
    });
  }

  // ---------- 자랑하기: 공유 창(카카오톡·문자 등) → 안 되면 문자·링크 복사 ----------
  function shareData(o = {}) {
    const m = o.m != null ? o.m : lastRes ? lastRes.score : Save.data.best || 0, name = Save.data.name || '';
    const url = `${appUrl()}?from=${m}${name ? '&by=' + encodeURIComponent(name) : ''}`;
    const text = o.text || (name ? `[두더지 게임] ${name}님이 두더지를 톡톡 쳐서 ${P(m)}을 받았어요! 내 점수를 넘어 볼래?` : `[두더지 게임] 두더지를 톡톡 쳐서 ${P(m)}을 받았어요! 내 점수를 넘어 볼래?`);
    return { title: T('두더지 게임'), text: T(text), url };
  }
  let lastShare = {};
  async function share(o = {}) {
    lastShare = o; const d = shareData(o);
    if (navigator.share) {
      try { await navigator.share(d); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    let shown = d.url; try { shown = decodeURI(d.url); } catch (e) { /* 그대로 */ }
    $('shareText').textContent = `${d.text}\n${shown}`;
    const body = encodeURIComponent(`${d.text}\n${d.url}`);
    $('btnSms').href = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) ? `sms:&body=${body}` : `sms:?body=${body}`;
    show('shareBox'); fitTitles($('shareBox'));
  }
  $('btnCopy').onclick = async () => {
    ui(); const d = shareData(lastShare), s = `${d.text}\n${d.url}`;
    try { await navigator.clipboard.writeText(s); toast('복사했어요! 카카오톡에 붙여 넣어 보내 보세요'); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = s; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('복사했어요!'); } catch (x) { toast('복사하지 못했어요'); } ta.remove(); }
  };
  $('btnShareClose').onclick = () => { ui(); show('shareBox', false); };

  // ---------- 접속할 때: 정지·점검·공지 확인, 인터넷 없이 만든 이름 등록 ----------
  async function sync() {
    const f = await firebase(); if (!f) return;
    try {
      const o = await f.db.collection('config').doc('mole').get(), ops = o.exists ? o.data() : {};
      if (ops.maintenance) { block(ops.maintenanceMsg || '지금은 점검 중이에요. 잠시 뒤에 다시 와 주세요!'); return; }
      if (ops.notice && sessionStorage.getItem('mo_notice') !== ops.notice) { sessionStorage.setItem('mo_notice', ops.notice); setTimeout(() => toast(ops.notice, 4000), 2600); }
    } catch (e) { /* ignore */ }
    const a = Save.data.auth, u = me(f);
    if (!a || !u || u.uid !== a.uid) return; // 로그인이 풀렸으면 이 기기 기록으로 계속
    try {
      const s = await f.db.collection('users').doc(u.uid).get(), d = s.exists ? s.data() : null;
      if (d && d.status === 'banned') { block('이용이 제한된 계정이에요.'); return; }
      // 백오피스에서 '이름 다시 정하게' → 새 이름 정하기
      if (d && d.mo && d.mo.name === '' && Save.data.name && Save.data.nameReg) {
        Object.assign(Save.data, { name: null, nameKey: null, nameReg: false }); Save.store();
        if (introDone) nameScreen('이름을 다시 정해 주세요'); return;
      }
    } catch (e) { /* ignore */ }
    if (Save.data.name && !Save.data.nameReg) {
      const r = await claimName(Save.data.name);
      if (r === 'ok') { Save.data.nameReg = true; Save.store(); }
      else if (r === 'taken') { Object.assign(Save.data, { name: null, nameKey: null }); Save.store(); if (introDone) nameScreen('그새 다른 사람이 같은 이름을 만들었어요. 새 이름을 정해 주세요'); return; }
    }
    if (Save.data.name) saveUser();
  }
  if (Save.data.auth) sync(); else firebase().then(sync);

  // ---------- 랭킹: 트윈 게임랜드 주간 랭킹과 같은 화면 (주간·전체) + 점수·잡은 두더지 탭 ----------
  //  서버 records(game 'mole-app')에서 사람마다: 점수 = 한 판 최고 점수, 잡은 두더지 = 잡은 수 합. 주간 = 이번 주 일요일~토요일
  //  내 줄(또는 맨 아래 내 등수 칸)을 누르면 자랑하기 (공유)
  const TOP = 20, EN = Save.data.lang === 'en';
  let rkMode = 'week', rkKind = 'score', rkTicket = 0;
  const rkCache = {};
  const weekRange = () => { const s0 = new Date(); s0.setHours(0, 0, 0, 0); s0.setDate(s0.getDate() - s0.getDay()); const e = new Date(s0); e.setDate(s0.getDate() + 6); return [s0, e]; };
  const weekDays = () => { const [s0] = weekRange(); return [...Array(7)].map((_, i) => { const d = new Date(s0); d.setDate(s0.getDate() + i); return dayOf(d.getTime()); }); };
  function periodText() {
    const [a, b] = weekRange();
    if (EN) { const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return `${M[a.getMonth()]} ${a.getDate()} (Sun) – ${M[b.getMonth()]} ${b.getDate()} (Sat)`; }
    return `${a.getMonth() + 1}월 ${a.getDate()}일(일) ~ ${b.getMonth() + 1}월 ${b.getDate()}일(토)`;
  }
  async function fetchBoard(mode) {
    const f = await firebase(); if (!f) return null;
    let u = me(f); if (!u) { try { u = (await f.auth.signInAnonymously()).user; } catch (e) { return null; } } // 기록 읽기는 로그인한 사람만 (게스트 = 익명)
    let qy = f.db.collection('records').where('game', '==', GAME);
    if (mode === 'week') qy = qy.where('day', 'in', weekDays()); // 같음 조건만 → 서버 색인을 새로 만들지 않아도 됨
    const snap = await qy.limit(5000).get(), M = new Map();
    snap.forEach((d) => {
      const r = d.data(); if (!r.uid) return;
      const p = M.get(r.uid) || { uid: r.uid, name: '', look: '', at: 0, score: 0, caught: 0 };
      p.score = Math.max(p.score, r.score || 0); p.caught += r.coins || 0;
      if ((r.at || 0) >= p.at) { p.at = r.at || 0; p.name = r.name || '?'; p.look = r.look || ''; }
      M.set(r.uid, p);
    });
    return { uid: u.uid, list: [...M.values()] };
  }
  async function board() {
    const key = rkMode;
    if (!rkCache[key]) rkCache[key] = fetchBoard(rkMode).catch((e) => { console.warn('rank', e); delete rkCache[key]; return null; });
    const got = await rkCache[key];
    const meRow = { name: Save.data.name || '', look: '', me: true, score: 0, rank: '-' };
    if (!got) return { ok: false, list: [], me: meRow };
    const mine = got.list.find((x) => x.uid === got.uid);
    meRow.score = Math.max(mine ? mine[rkKind] : 0, rkKind === 'score' && rkMode === 'all' ? Save.data.best || 0 : 0);
    const all = got.list.filter((x) => x.uid !== got.uid).map((x) => ({ name: x.name, look: x.look, score: x[rkKind] })).filter((x) => x.score > 0);
    if (meRow.score > 0) all.push(meRow);
    all.sort((a, b) => b.score - a.score || (a.me ? -1 : b.me ? 1 : 0));
    all.forEach((x, i) => { x.rank = i + 1; });
    return { ok: true, list: all, me: meRow };
  }
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const faceOf = () => 'assets/sprites/normal.webp'; // 캐릭터 고르기가 없어서 모두 노란 안전모 두더지 얼굴
  function rowHTML(x, cls) {
    const n = typeof x.rank === 'number' && x.rank <= 3 ? x.rank : '';
    const ico = rkKind === 'score' ? 'lib/ui/crown.webp' : 'assets/sprites/normal.webp';
    return `<li class="rk-row ${cls}"${x.me ? ' data-me="1"' : ''}><span class="r-num" style="background-image:url(lib/rank/num${n}.webp)"><b>${x.rank}</b></span>`
      + `<span class="r-face"><img class="ph" src="${faceOf(x.look)}" alt=""><img class="ring" src="lib/rank/ring_pink.webp" alt=""></span>`
      + `<span class="r-name" translate="no">${esc(x.name)}</span><span class="r-score"><img src="${ico}" alt="">${x.score ? fmt(x.score) : '-'}</span></li>`;
  }
  let rkMe = null;
  async function renderRank() {
    document.querySelectorAll('#rkSeg button').forEach((b) => b.classList.toggle('on', b.dataset.mode === rkMode));
    $('rkSeg').dataset.mode = rkMode;
    document.querySelectorAll('#rkTabs button').forEach((b) => b.classList.toggle('on', b.dataset.kind === rkKind));
    $('rkPeriod').textContent = rkMode === 'week' ? periodText() : '';
    const t = ++rkTicket;
    $('rkList').innerHTML = ''; $('rkNote').textContent = '순위를 불러오는 중이에요…'; show('rkNote');
    const { ok, list, me: m } = await board();
    if (t !== rkTicket) return;
    rkMe = m;
    $('rkList').innerHTML = list.slice(0, TOP).map((x) => rowHTML(x, x.me ? 'me' : '')).join('');
    $('rkNote').textContent = !ok ? '순위를 불러오지 못했어요. 인터넷 연결을 확인해 주세요' : !list.length ? (rkMode === 'week' ? '이번 주 기록이 아직 없어요. 첫 번째 주인공이 되어 보세요!' : '아직 기록이 없어요. 첫 번째 주인공이 되어 보세요!') : '';
    show('rkNote', !!$('rkNote').textContent);
    const out = !(typeof m.rank === 'number' && m.rank <= TOP);
    show('rkMine', out); $('rank').classList.toggle('has-mine', out);
    $('rkMine').innerHTML = out ? `<ol class="rk-list">${rowHTML(m, 'mine')}</ol>` : '';
  }
  function rankScreen() { screen('rank'); $('rank').scrollTop = 0; Object.keys(rkCache).forEach((k) => delete rkCache[k]); renderRank(); }
  $('rkBack').onclick = () => { ui(); show('rkMine', false); home(); };
  document.querySelectorAll('#rkSeg button').forEach((b) => b.addEventListener('click', () => { if (b.dataset.mode === rkMode) return; ui(); rkMode = b.dataset.mode; renderRank(); }));
  document.querySelectorAll('#rkTabs button').forEach((b) => b.addEventListener('click', () => { if (b.dataset.kind === rkKind) return; ui(); rkKind = b.dataset.kind; renderRank(); }));
  // 내 순위를 누르면 자랑하기
  const shareRank = () => {
    if (!rkMe || !rkMe.score) { toast('먼저 한 판 해 보세요!'); return; }
    const kind = rkKind === 'score' ? '점수' : '잡은 두더지', per = rkMode === 'week' ? '주간' : '전체', val = rkKind === 'score' ? P(rkMe.score) : `${fmt(rkMe.score)}마리`;
    const text = typeof rkMe.rank === 'number' ? `[두더지 게임] ${rkMe.name}님은 ${per} ${kind} 랭킹 ${rkMe.rank}등! (${val}) 나를 넘어 볼래?` : `[두더지 게임] ${rkMe.name}님의 ${per} ${kind} 기록 ${val}! 나를 넘어 볼래?`;
    share({ text, m: Save.data.best || 0 });
  };
  $('rkList').addEventListener('click', (e) => { if (e.target.closest('[data-me]')) { ui(); shareRank(); } });
  $('rkMine').addEventListener('click', (e) => { if (e.target.closest('.rk-row')) { ui(); shareRank(); } });

  // 입력 칸 안내 글자 (lib/i18n.js 는 입력 칸을 건너뛰어서 여기서)
  document.querySelectorAll('input[placeholder]').forEach((i) => { i.placeholder = T(i.placeholder); });

  // ---------- 안드로이드 뒤로 가기 버튼 (앱에서만): 게임 중이면 일시정지, 떠 있는 창은 닫기, 아니면 앱을 내림 ----------
  if (window.Native) Native.onBack(() => {
    const open = (id) => !$(id).classList.contains('hidden');
    if (open('adFake')) return true;
    if (open('docView')) { show('docView', false); return true; }
    if (open('shareBox')) { show('shareBox', false); return true; }
    if (open('rank')) { show('rkMine', false); home(); return true; }
    if (G.state === 'play' || G.state === 'count') { $('btnPause').click(); return true; }
    if (G.state === 'pause') { $('btnResume').click(); return true; }
    if (open('setBox')) { show('setBox', false); return true; }
    if (open('login')) {
      if (open('loginEmail')) { box('loginMain'); return true; }
      if (open('signupBox')) { box('loginEmail'); return true; }
      if (open('accountBox')) { home(); return true; }
    }
    return false;
  });

  window.App = { onResult, home, screen, share, friend, checkName,
    __show: box, __go: (n) => ({ home, rank: rankScreen })[n]() }; // __show·__go = 검사 도구용
  paintWho(); fitZoom();
  screen('intro');
})();
