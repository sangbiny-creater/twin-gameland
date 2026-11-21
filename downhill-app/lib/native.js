'use strict';
// 안드로이드 앱(Capacitor, downhill-android/) 안에서만 켜지는 기능 — 웹(브라우저)에서는 Native.on = false 라 아무것도 안 함
//  · 광고: 맨 위 배너(#adBar 자리에 겹쳐 보임) · 광고 보고 이어하기(보상형) — @capacitor-community/admob, ID 는 lib/ads_config.js
//  · 구글 로그인: 앱 안에서는 웹 팝업 로그인이 막혀서, 휴대폰의 구글 계정 고르기 창으로 받은 토큰을 Firebase 에 넘김 (@capacitor-firebase/authentication)
//  · 뒤로 가기 버튼: 게임 중이면 일시정지, 창이 떠 있으면 닫기, 아니면 앱을 내림 (@capacitor/app)
(function () {
  const C = window.Capacitor, on = !!(C && C.isNativePlatform && C.isNativePlatform());
  const P = (n) => (C && C.Plugins && C.Plugins[n]) || null;
  const cfg = window.ADS_CONFIG || {};
  let ready = null, bannerOn = false, bannerWant = false, bannerH = 0;
  // 휴대폰 쪽이 답을 안 주면 마냥 기다리지 않게 (광고 준비가 멈추면 이어하기 버튼이 아무 반응 없던 문제)
  const wait = (p, ms, v) => Promise.race([p, new Promise((r) => setTimeout(() => r(v), ms))]);
  // 광고 준비: 동의(유럽 등 필요한 곳만 창이 뜸) → 시작
  function init() {
    if (!on || !P('AdMob')) return Promise.resolve(false);
    if (!ready) ready = (async () => {
      const A = P('AdMob');
      try { const ci = await wait(A.requestConsentInfo(), 5000, null); if (ci && ci.isConsentFormAvailable && ci.status === 'REQUIRED') await A.showConsentForm(); } catch (e) { /* 동의 설정이 없으면 그냥 */ }
      await wait(A.initialize({ initializeForTesting: !!cfg.test }), 8000);
      A.addListener('bannerAdSizeChanged', (s) => { bannerH = (s && s.height) || 0; document.documentElement.style.setProperty('--ad-h', Math.max(50, bannerH) + 'px'); });
      return true;
    })().catch((e) => { console.warn('admob', e); return false; });
    return ready;
  }
  // 맨 위 배너: 게임 화면(시작 창 포함)에서만 보이기
  async function banner(show) {
    bannerWant = show;
    if (!show && !ready) return; // 인트로·로그인 화면에서는 광고 준비를 시작하지 않음 (켤 때 화면이 늦게 넘어가던 문제)
    if (!(await init())) return;
    const A = P('AdMob');
    try {
      if (bannerWant && !bannerOn) { await A.showBanner({ adId: cfg.banner, adSize: 'ADAPTIVE_BANNER', position: 'TOP_CENTER', margin: 0, isTesting: !!cfg.test }); bannerOn = true; }
      else if (!bannerWant && bannerOn) { await A.removeBanner(); bannerOn = false; }
    } catch (e) { console.warn('banner', e); }
  }
  // 보상형 광고: 끝까지 보면 true. 광고를 못 불러오면 'none' (그때는 그냥 이어하게 해 줌 — app.js)
  async function rewarded() {
    if (!(await init())) return 'none';
    const A = P('AdMob');
    let got = false; const hs = [];
    try {
      const ok = await wait(A.prepareRewardVideoAd({ adId: cfg.rewarded, isTesting: !!cfg.test }).then(() => true), 12000, false);
      if (!ok) return 'none';
      hs.push(await A.addListener('onRewardedVideoAdReward', () => { got = true; }));
      const item = await A.showRewardVideoAd();
      return got || !!(item && (item.amount || item.type)); // 끝까지 봐서 보상을 받았으면 true, 중간에 닫으면 false
    } catch (e) { console.warn('rewarded', e); return got ? true : 'none'; }
    finally { hs.forEach((h) => h && h.remove && h.remove()); }
  }
  // 앱 안 구글 로그인: 구글 계정 고르기 → idToken
  async function googleIdToken() {
    const F = P('FirebaseAuthentication'); if (!F) throw new Error('no-plugin');
    const r = await F.signInWithGoogle();
    const t = r && r.credential && r.credential.idToken; if (!t) throw new Error('no-token');
    return t;
  }
  async function googleSignOut() { const F = P('FirebaseAuthentication'); if (F) { try { await F.signOut(); } catch (e) { /* ignore */ } } }
  // 뒤로 가기 버튼: handler() 가 true 를 돌려주면 처리한 것, 아니면 앱을 내림
  // 공유: 안드로이드 공유 창(카카오톡·문자 등을 고르는 창). 앱 안 웹 화면에는 navigator.share 가 없어서 따로 씀 (@capacitor/share)
  async function share(d) {
    const S = P('Share'); if (!on || !S) return false;
    try { await S.share({ title: d.title, text: d.text, url: d.url, dialogTitle: d.title }); } catch (e) { /* 닫으면 그냥 */ }
    return true;
  }
  function onBack(handler) {
    const A = P('App'); if (!on || !A) return;
    A.addListener('backButton', () => { let done = false; try { done = handler(); } catch (e) { /* ignore */ } if (!done) A.minimizeApp(); });
  }
  if (on) document.documentElement.classList.add('native');
  window.Native = { on, init, banner, rewarded, googleIdToken, googleSignOut, share, onBack };
})();
