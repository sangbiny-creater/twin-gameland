'use strict';
// 트윈 게임랜드 서버 기능 (Firebase Cloud Functions, 서울 리전)
//  sendCode   : 이메일로 인증번호 6자리 보내기 (가입 signup · 비밀번호 재설정 reset). 10분 유효, 5번 틀리면 다시 받기, 1분에 한 번
//  verifyCode : 인증번호 확인 → 계정 만들기/찾기 → 로그인 토큰. 게스트(익명)로 하던 사람은 같은 계정에 이메일을 붙여 기록이 이어짐
//  verifyPurchase : (앱 출시 때) 구글 플레이 결제 영수증 확인 → payments 기록 + 다이아 지급. 지금은 자리만
//  메일 보내기: SMTP (처음엔 Gmail 앱 비밀번호도 됨). 비밀 값은 코드에 넣지 않고 `firebase functions:secrets:set SMTP_USER` / `SMTP_PASS` 로 넣음
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
admin.initializeApp();
const db = admin.firestore();
const SMTP_USER = defineSecret('SMTP_USER'), SMTP_PASS = defineSecret('SMTP_PASS');
const OPT = { region: 'asia-northeast3', secrets: [SMTP_USER, SMTP_PASS] };
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');
const okEmail = (e) => typeof e === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && e.length < 200;

exports.sendCode = onCall(OPT, async (req) => {
  const email = String(req.data.email || '').trim().toLowerCase(), purpose = req.data.purpose === 'reset' ? 'reset' : 'signup';
  if (!okEmail(email)) throw new HttpsError('invalid-argument', '이메일을 다시 확인해 주세요');
  if (purpose === 'reset') { try { await admin.auth().getUserByEmail(email); } catch (e) { throw new HttpsError('not-found', '가입하지 않은 이메일이에요'); } }
  const ref = db.collection('emailCodes').doc(hash(email)), old = await ref.get();
  if (old.exists && Date.now() - old.data().sentAt < 60000) throw new HttpsError('resource-exhausted', '1분 뒤에 다시 보내 주세요');
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await ref.set({ code: hash(code + email), purpose, sentAt: Date.now(), tries: 0 });
  const mail = nodemailer.createTransport({ service: 'gmail', auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() } });
  await mail.sendMail({
    from: `"은유와 은결" <${SMTP_USER.value()}>`, to: email,
    subject: `[은유와 은결] 인증번호 ${code}`,
    text: `인증번호: ${code}\n\n10분 안에 게임 화면에 넣어 주세요.\n직접 요청하지 않았다면 이 메일은 무시해도 돼요.`,
  });
  return { ok: true };
});

exports.verifyCode = onCall(OPT, async (req) => {
  const email = String(req.data.email || '').trim().toLowerCase(), code = String(req.data.code || ''), purpose = req.data.purpose === 'reset' ? 'reset' : 'signup';
  if (!okEmail(email) || !/^\d{6}$/.test(code)) throw new HttpsError('invalid-argument', '인증번호를 다시 확인해 주세요');
  const ref = db.collection('emailCodes').doc(hash(email)), snap = await ref.get(), d = snap.data();
  if (!d || d.purpose !== purpose || Date.now() - d.sentAt > 600000) throw new HttpsError('deadline-exceeded', '인증번호가 지났어요. 다시 받아 주세요');
  if (d.tries >= 5) throw new HttpsError('resource-exhausted', '여러 번 틀렸어요. 인증번호를 다시 받아 주세요');
  if (d.code !== hash(code + email)) { await ref.update({ tries: d.tries + 1 }); throw new HttpsError('permission-denied', '인증번호가 맞지 않아요'); }
  await ref.delete();
  let user;
  try { user = await admin.auth().getUserByEmail(email); } catch (e) { user = null; }
  if (!user) {
    const me = req.auth && req.auth.token.firebase.sign_in_provider === 'anonymous' ? req.auth.uid : null; // 게스트 → 같은 계정에 이메일을 붙임
    user = me ? await admin.auth().updateUser(me, { email, emailVerified: true }) : await admin.auth().createUser({ email, emailVerified: true });
  } else if (!user.emailVerified) await admin.auth().updateUser(user.uid, { emailVerified: true });
  await db.collection('users').doc(user.uid).set({ provider: 'email', email, over14: req.data.over14 !== false, lastAt: Date.now() }, { merge: true });
  return { token: await admin.auth().createCustomToken(user.uid) };
});

// 앱(구글 플레이) 결제 확인 자리: 출시할 때 Google Play Developer API 로 purchaseToken 을 확인하고 지급
exports.verifyPurchase = onCall({ region: 'asia-northeast3' }, async (req) => {
  if (!req.auth || req.auth.token.firebase.sign_in_provider === 'anonymous') throw new HttpsError('permission-denied', '계정연동이 필요합니다.');
  throw new HttpsError('unimplemented', '앱 결제는 출시 준비 때 열어요');
});
