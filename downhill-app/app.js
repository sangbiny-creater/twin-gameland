'use strict';
// 다운힐 앱 흐름: 인트로 → 로그인(구글·이메일·게스트) → 캐릭터 고르기(겨울옷) → 시작 상자 → 게임 → 결과(이어하기·다시하기·자랑하기·X)
//  저장: localStorage 'downhill_app_v1' (game.js 의 Save). 트윈 게임랜드 사이트 저장(twin_gameland_v1)은 읽지도 쓰지도 않음
//  친구 링크: ?from=1234 (친구 기록 m) → 시작 상자에 "친구 기록 1,234m를 넘어 보세요!"
(function () {
  const D = window.__downhill, Save = D.Save, G = D.G;
  const $ = (id) => document.getElementById(id);
  const show = (id, on = true) => $(id).classList.toggle('hidden', !on);
  const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
  const NAME = { eunyu: '은유', eungyeol: '은결' };
  const ui = () => { D.Audio.unlock(); D.Audio.sfx('ui'); };
  // 앱 주소 (자랑하기 링크). 웹에서 열면 지금 주소, 앱(파일로 묶은 것)에서는 사이트 주소
  const WEB_URL = 'https://sangbiny-creater.github.io/twin-gameland/downhill-app/';
  const appUrl = () => (/^https?:$/.test(location.protocol) ? location.origin + location.pathname.replace(/index\.html$/, '') : WEB_URL);

  // ---------- 친구 링크 ----------
  const q = new URLSearchParams(location.search);
  const friend = Math.max(0, Math.min(999999, parseInt(q.get('from'), 10) || 0));
  if (friend && history.replaceState) history.replaceState(null, '', location.pathname); // 새로고침해도 주소에 남지 않게 (기록은 이번 접속 동안 기억)

  let toastT = 0;
  function toast(msg, ms = 2400) { const t = $('toast'); t.textContent = msg; show('toast'); clearTimeout(toastT); toastT = setTimeout(() => show('toast', false), ms); }

  // ---------- 화면 바꾸기 ----------
  const SCR = ['intro', 'login', 'select'];
  function screen(id) {
    SCR.forEach((s) => show(s, s === id));
    const game = !id; show('stage', game); show('adBar', game);
    if (game) requestAnimationFrame(D.resize);
  }
  function next() {
    if (!Save.data.auth) return loginScreen();
    if (!Save.data.char) return selectScreen();
    home();
  }

  // ---------- 인트로: 그림만 (누르거나 2.5초 뒤) ----------
  let introDone = false;
  const endIntro = () => { if (introDone) return; introDone = true; D.Audio.unlock(); next(); };
  $('intro').addEventListener('click', endIntro);
  setTimeout(endIntro, 2500);

  // ---------- 로그인 (Firebase: 구글·이메일 / 게스트는 이 기기에만) ----------
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  let fbReady = null;
  const loadJs = (u) => new Promise((ok, no) => { const s = document.createElement('script'); s.src = u; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  function firebase() {
    if (!window.FIREBASE_CONFIG) return Promise.resolve(null);
    if (!fbReady) {
      fbReady = (async () => {
        for (const n of ['app', 'auth']) await loadJs(`${SDK}firebase-${n}-compat.js`);
        const F = window.firebase, app = F.apps.length ? F.app() : F.initializeApp(window.FIREBASE_CONFIG);
        return { F, auth: app.auth() };
      })().catch((e) => { console.warn('firebase', e); fbReady = null; return null; });
    }
    return fbReady;
  }
  function signedIn(mode, u) {
    Save.data.auth = { mode, uid: u ? u.uid : 'local-' + Math.random().toString(36).slice(2, 10), email: (u && u.email) || '', at: Date.now() };
    Save.store();
  }
  function loginScreen() {
    screen('login'); show('loginMain'); show('loginEmail', false); show('accountBox', false);
  }
  async function google() {
    const f = await firebase(); if (!f) { toast('지금은 구글 로그인을 할 수 없어요.\n게스트로 시작해 주세요!'); return; }
    const p = new f.F.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
    try {
      const r = await f.auth.signInWithPopup(p);
      signedIn('google', r.user); toast('구글 계정으로 로그인했어요!');
      if (accountFrom) { accountFrom = false; home(); } else next();
    } catch (e) {
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') { try { sessionStorage.setItem('dh_redirect', '1'); } catch (x) { /* ignore */ } f.auth.signInWithRedirect(p); return; }
      toast('구글 로그인을 못 했어요 (' + (e.code || e.message) + ')');
    }
  }
  // 팝업이 막혀서 페이지를 옮겨 로그인하고 돌아온 경우
  try {
    if (sessionStorage.getItem('dh_redirect')) {
      sessionStorage.removeItem('dh_redirect');
      firebase().then((f) => f && f.auth.getRedirectResult()).then((r) => { if (r && r.user) { signedIn('google', r.user); toast('구글 계정으로 로그인했어요!'); if (introDone) next(); } }).catch(() => {});
    }
  } catch (e) { /* ignore */ }
  async function emailLogin() {
    const em = $('inEmail').value.trim().toLowerCase(), pw = $('inPw').value;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { $('emailErr').textContent = '이메일을 다시 확인해 주세요'; return; }
    if (!pw) { $('emailErr').textContent = '비밀번호를 넣어 주세요'; return; }
    const f = await firebase(); if (!f) { $('emailErr').textContent = '지금은 로그인할 수 없어요'; return; }
    $('btnEmailGo').disabled = true; $('emailErr').textContent = '';
    try { const r = await f.auth.signInWithEmailAndPassword(em, pw); signedIn('email', r.user); $('inPw').value = ''; toast('로그인했어요!'); if (accountFrom) { accountFrom = false; home(); } else next(); }
    catch (e) { $('emailErr').textContent = '이메일 또는 비밀번호가 맞지 않아요'; }
    $('btnEmailGo').disabled = false;
  }
  let accountFrom = false; // 시작 상자의 '계정'에서 왔는지 (로그인 뒤 시작 상자로)
  function accountScreen() {
    const a = Save.data.auth || {};
    screen('login'); show('loginMain', false); show('loginEmail', false); show('accountBox');
    $('accountText').textContent = a.mode === 'guest' ? '게스트로 하고 있어요.\n구글로 로그인하면 다른 기기에서도 이어서 할 수 있어요.' : `${a.mode === 'google' ? '구글 계정' : '이메일 계정'}${a.email ? '\n' + a.email : ''}`;
    show('btnLink', a.mode === 'guest');
  }
  $('btnGoogle').onclick = () => { ui(); google(); };
  $('btnEmail').onclick = () => { ui(); show('loginMain', false); show('loginEmail'); $('emailErr').textContent = ''; };
  $('btnEmailBack').onclick = () => { ui(); show('loginEmail', false); show('loginMain'); };
  $('btnEmailGo').onclick = () => { ui(); emailLogin(); };
  $('inPw').addEventListener('keydown', (e) => { if (e.key === 'Enter') emailLogin(); });
  $('btnGuest').onclick = () => { ui(); signedIn('guest', null); next(); };
  $('btnLink').onclick = () => { ui(); accountFrom = true; google(); };
  $('btnLogout').onclick = async () => {
    ui(); const f = Save.data.auth && Save.data.auth.mode !== 'guest' ? await firebase() : null;
    if (f) { try { await f.auth.signOut(); } catch (e) { /* ignore */ } }
    Save.data.auth = null; Save.store(); toast('로그아웃했어요'); loginScreen();
  };
  $('btnAccountClose').onclick = () => { ui(); accountFrom = false; home(); };
  // 이메일 입력 칸에서는 화면 이동 막기(game.js 의 touchmove 막기)를 풀어 줌
  ['inEmail', 'inPw'].forEach((id) => $(id).addEventListener('touchmove', (e) => e.stopPropagation()));

  // ---------- 캐릭터 고르기 (다운힐 겨울옷 그림) ----------
  function selectScreen() {
    screen('select');
    document.querySelectorAll('.sel-char').forEach((b) => {
      const look = D.lookOf(b.dataset.char); b.classList.toggle('on', b.dataset.char === Save.data.char);
      const im = b.querySelector('img'), paint = () => { im.src = window.CharV2 ? CharV2.url(look, 'idle') : ''; };
      if (window.CharV2) { const p = CharV2.load(look); if (CharV2.ready(look)) paint(); else if (p) p.then(paint); }
    });
  }
  document.querySelectorAll('.sel-char').forEach((b) => b.addEventListener('click', () => {
    ui(); Save.data.char = b.dataset.char; Save.store();
    document.querySelectorAll('.sel-char').forEach((x) => x.classList.toggle('on', x === b));
    if (window.CharV2) CharV2.load(D.lookOf(b.dataset.char));
    setTimeout(home, 260);
  }));

  // ---------- 시작 상자 ----------
  function home() {
    screen(null);
    if (G.state !== 'home') D.setState('home');
    D.resetRun(); // 뒤에 출발 장면
    ['touch', 'hud', 'pause', 'result', 'shareBox'].forEach((id) => show(id, false));
    const last = Math.max(1, Save.data.lastZone || 1);
    $('sbBest').textContent = fmt(Save.data.best);
    $('btnGoFrom').textContent = `${last}판부터 시작`;
    show('btnGoFrom', last > 1);
    $('sbFriend').textContent = friend ? `친구 기록 ${fmt(friend)}m를 넘어 보세요!` : '';
    show('sbFriend', !!friend);
    $('btnSound2').textContent = Save.data.sound ? '소리 켬' : '소리 끔';
    show('startBox');
  }
  function begin(zone) { show('startBox', false); D.startRun(zone); }
  $('btnGo').onclick = () => { ui(); begin(1); };
  $('btnGoFrom').onclick = () => { ui(); begin(Math.max(1, Save.data.lastZone || 1)); };
  $('btnChar').onclick = () => { ui(); selectScreen(); };
  $('btnAccount').onclick = () => { ui(); accountScreen(); };
  $('btnSound2').onclick = () => { Save.data.sound = !Save.data.sound; Save.store(); D.Audio.applyMute(); ui(); $('btnSound2').textContent = Save.data.sound ? '소리 켬' : '소리 끔'; };

  // ---------- 결과 ----------
  let lastRes = null;
  function onResult(r) {
    lastRes = r;
    show('btnCont', r.canContinue);
    const beat = friend && r.m > friend;
    $('resFriend').textContent = friend ? (beat ? `친구 기록 ${fmt(friend)}m를 넘었어요!` : `친구 기록 ${fmt(friend)}m까지 ${fmt(friend - r.m)}m 남았어요`) : '';
    show('resFriend', !!friend);
  }
  $('btnCloseR').onclick = () => { ui(); D.goHome(); };
  $('btnRetry').onclick = () => { ui(); show('result', false); D.startRun(G.startZone || 1); };
  $('btnCont').onclick = () => { ui(); rewardedAd().then((ok) => { if (ok && window.GameContinue && GameContinue.can()) { show('result', false); GameContinue.go(); } }); };
  $('btnShare').onclick = () => { ui(); share(); };

  // ---------- 광고 (지금은 가짜. 앱으로 묶을 때 AdMob 보상형 광고로 바꿈) ----------
  function rewardedAd() {
    return new Promise((done) => {
      show('adFake'); let n = 3; $('adCount').textContent = n;
      const t = setInterval(() => { n--; $('adCount').textContent = n; if (n <= 0) { clearInterval(t); show('adFake', false); done(true); } }, 1000);
    });
  }

  // ---------- 자랑하기: 공유 창(카카오톡·문자 등) → 안 되면 문자·링크 복사 ----------
  function shareData() {
    const m = lastRes ? lastRes.m : Save.data.best || 0, who = NAME[Save.data.char] || '은유';
    const url = `${appUrl()}?from=${m}`;
    const text = `[다운힐 러너] ${who}랑 눈 덮인 산을 ${fmt(m)}m 내려갔어요! 내 기록을 넘어 볼래?`;
    return { title: '다운힐 러너', text, url };
  }
  async function share() {
    const d = shareData();
    if (navigator.share) {
      try { await navigator.share(d); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    $('shareText').textContent = `${d.text}\n${d.url}`;
    const body = encodeURIComponent(`${d.text}\n${d.url}`);
    $('btnSms').href = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) ? `sms:&body=${body}` : `sms:?body=${body}`;
    show('shareBox');
  }
  $('btnCopy').onclick = async () => {
    ui(); const d = shareData(), s = `${d.text}\n${d.url}`;
    try { await navigator.clipboard.writeText(s); toast('복사했어요! 카카오톡에 붙여 넣어 보내 보세요'); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = s; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('복사했어요!'); } catch (x) { toast('복사하지 못했어요'); } ta.remove(); }
  };
  $('btnShareClose').onclick = () => { ui(); show('shareBox', false); };

  window.App = { onResult, home, screen, share, friend };
  screen('intro');
})();
