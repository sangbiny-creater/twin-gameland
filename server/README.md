# 로그인 · 백오피스 서버 (Firebase)

게임은 GitHub Pages(정적 파일)에 그대로 있고, 계정·기록·상점 값만 Firebase에 둬요.
Firebase를 연결하기 전에는 **게스트로만** 들어갈 수 있고(결제 불가), 백오피스는 **예시 데이터(데모)**로 보여요.

- 게임: https://sangbiny-creater.github.io/twin-gameland/
- 백오피스: https://sangbiny-creater.github.io/twin-gameland/admin/
- 개인정보 처리방침: https://sangbiny-creater.github.io/twin-gameland/legal/privacy.html (구글 플레이에 넣는 주소)
- 계정 삭제 요청: https://sangbiny-creater.github.io/twin-gameland/legal/delete.html (구글 플레이 '데이터 삭제' 칸)

## 사용자가 할 일 (한 번만)

1. **Firebase 프로젝트 만들기**: https://console.firebase.google.com → 프로젝트 추가 (개인 구글 계정이어도 돼요). 애널리틱스는 꺼도 됨.
2. **웹 앱 등록**: 프로젝트 설정 → 내 앱 → 웹(</>) → 나온 `firebaseConfig` 값을 Claude에게 주면 `common/firebase_config.js`에 넣어요. (공개돼도 괜찮은 값)
3. **로그인 방법 켜기**: Authentication → 로그인 방법 → **Google**, **이메일/비밀번호**, **익명** 세 개 사용 설정.
   Authentication → 설정 → 승인된 도메인에 `sangbiny-creater.github.io` 추가.
4. **관리자 등록**: Firestore Database 만들기(위치: `asia-northeast3` 서울) → 데이터 → 모음 `admins` → 문서 ID = 관리자 구글 이메일, 필드 아무거나(예: `role: "owner"`).
   (관리자 이메일을 공개 저장소 코드에 적지 않으려고 이렇게 해요)
5. **요금제 Blaze로 바꾸기** (인증번호 메일 보내는 서버 기능 때문에 필요. 사용량이 적으면 무료 범위 안이에요. 예산 알림을 1~5달러로 걸어 두기 추천)
6. **메일 보낼 계정**: 처음엔 Gmail 하나에 '앱 비밀번호'를 만들어 씀 (구글 계정 → 보안 → 2단계 인증 → 앱 비밀번호). 나중엔 회사 도메인 메일로 바꾸기.

## Claude(또는 개발자)가 올리는 것

```bash
npm i -g firebase-tools
firebase login
cd server && firebase use --add   # 1번에서 만든 프로젝트 고르기
firebase functions:secrets:set SMTP_USER   # 메일 주소
firebase functions:secrets:set SMTP_PASS   # 앱 비밀번호
cd functions && npm i && cd ..
firebase deploy --only firestore,storage,functions
```

## 데이터 구조 (Firestore)

| 모음 | 내용 | 누가 씀 |
|---|---|---|
| `users/{uid}` | provider(google·email·guest), email, agreedAt·agreeVer(약관 동의 시각·판), createdAt, lastAt, totalSec, status(active·banned), memo, profile(게임 저장 데이터 글) | 본인 / 관리자 |
| `sessions` | uid, game, start, sec, day — 화면에 머문 시간 | 본인 추가만 |
| `records` | uid, game, stage, cleared, score, stars, at, day, week(ISO 주, 백오피스), wk(일요일 시작 주, 랭킹), month, name, cid(캐릭터), look, face(얼굴 그림) — 게임 결과. 게임 안 랭킹 화면(ranking/)이 game·day 같음 조건으로 읽어 캐릭터마다 최고 기록을 계산 (새 색인 필요 없음) | 본인 추가, 로그인하면 읽기 |
| `payments` | uid, email, product, won, at, status(test = 웹 검수용 가짜 결제) | 앱(test) / 서버(진짜) |
| `config/catalog` | 상점 값: outfits·boosts·park·packs (백오피스 → 게임 다음 접속부터 적용) | 관리자 |
| `config/terms` | 개인정보 처리방침·이용약관 글 | 관리자 |
| `config/ops` | 공지·점검 모드 | 관리자 |
| `config/guild`, `guilds`, `seasons` | Group Tour(길드전) 준비 | 관리자 |
| `coupons/{번호}` | 쿠폰 보상 | 관리자 |
| `admins/{이메일}` | 백오피스 관리자 | 콘솔에서 직접 |
| `emailCodes` | 인증번호(암호화) | 서버만 |

## 규칙 요약

- 게스트(익명 로그인)는 결제 불가: 앱 `common/auth.js` canPay + 서버 `verifyPurchase` 둘 다 막음.
- 만 14세 미만은 계정(구글·이메일)을 만들 수 없음 (보호자 동의 절차를 만들기 전까지). 생년월일은 저장하지 않음.
- 비밀번호 찾기는 없고, 이메일 인증번호로 재설정만 됨.
- 순위는 지금 백오피스에서 records로 계산 (사용자가 많아지면 서버에서 미리 계산하도록 바꾸기).
