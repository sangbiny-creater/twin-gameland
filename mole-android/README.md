# 두더지 게임 안드로이드 앱 (`mole-android/`)

`mole-app/`(웹 앱)을 **Capacitor**로 감싸서 구글 플레이에 올릴 안드로이드 앱으로 만든 곳이에요.
앱 화면·게임 코드는 `mole-app/` 에서만 고쳐요. 여기서는 앱 포장(아이콘·광고 ID·서명)만 다뤄요.

- 앱 이름(임시): 두더지 게임 · 패키지 이름: `com.browncrab.mole` (한 번 올리면 못 바꿈)
- 광고: AdMob 맨 위 배너 + 광고 보고 이어하기(보상형) — 지금은 **구글 테스트 광고 ID**
- 로그인: 구글·이메일·게스트 — Firebase `brown-crab-mole`(browncrab0213). 앱 안 구글 로그인 설정 `android/app/google-services.json` 넣음(2026-11-27, 공개돼도 되는 값), `variables.gradle` 의 `rgcfaIncludeGoogle = true`
- 뒤로 가기 버튼: 게임 중이면 일시정지, 창이 떠 있으면 닫기, 아니면 앱을 내림
- 세로 고정, 시작 화면은 풀색 바탕 + 로고

## 만드는 법 (Claude가 함)

```
cd mole-android
npm install                        # 처음 한 번
npm run apk                        # 시험용 앱(APK) → android/app/build/outputs/apk/debug/app-debug.apk
npm run aab                        # 구글 플레이에 올릴 파일(AAB) → android/app/build/outputs/bundle/release/app-release.aab
python3 tools/make_icons.py        # 아이콘·시작 화면 그림을 바꿨을 때
```
- 필요한 것: Java 21 (`~/Library/Java/JavaVirtualMachines/jdk-21…`, `JAVA_HOME` 으로 지정), Android SDK 36
- 출시용 서명 열쇠: `~/Documents/brown-crab-keys/mole-upload.jks` + `mole-keystore.properties`(비밀번호)
  → **저장소에 올리지 않아요. 잃어버리면 앱을 업데이트하기 어려우니 USB·클라우드 등 안전한 곳에 꼭 따로 보관.**
  빌드할 때는 `mole-keystore.properties` 를 `android/keystore.properties` 로 복사해 둬요(올라가지 않음).
- 버전을 올릴 때: `android/app/build.gradle` 의 `versionCode`(1, 2, 3…)와 `versionName`

## 사용자가 해야 할 일 (계정이 필요해서 Claude가 대신 못 함)

### 1. 두더지 전용 Firebase 만들기 — ✅ 2026-11-27 Claude가 만듦 (`brown-crab-mole`, 웹 앱·Android 앱·SHA-1 두 개 등록까지). 남은 것: 플레이에 올린 뒤 '앱 서명 키' SHA-1 추가하고 `google-services.json` 다시 받기
1. https://console.firebase.google.com → 프로젝트 추가 → 이름 `brown-crab-mole` (애널리틱스는 꺼도 돼요)
2. **Authentication** → 시작하기 → 로그인 방법: `Google`·`이메일/비밀번호`·`익명` 세 개 사용 설정
   - 설정 → 승인된 도메인에 `sangbiny-creater.github.io` 추가
3. **Firestore Database** → 데이터베이스 만들기 → 위치 `asia-northeast3 (서울)` → 규칙 탭에 `mole-admin/server/firestore.rules` 내용을 붙여 넣고 게시
4. Firestore에서 모음 `admins` → 문서 ID = 백오피스에 쓸 **관리자 구글 이메일** (안에 아무 칸 하나, 예: `on: true`)
5. 프로젝트 설정 → 내 앱 → **웹 앱 추가** → 나오는 `firebaseConfig` 값을 Claude에게 알려 주기
6. 프로젝트 설정 → 내 앱 → **Android 앱 추가** → 패키지 `com.browncrab.mole`, SHA-1에 아래 두 개 넣기 → `google-services.json` 내려받아 Claude에게 주기
   - 출시용 열쇠 SHA-1: `16:88:DD:FF:5B:B5:EE:E7:3D:CF:A1:C7:03:F4:45:31:FE:51:C5:6A`
   - 시험용(디버그) 열쇠 SHA-1: 이 문서 맨 아래
   - 구글 플레이에 올린 뒤 Play Console → 앱 무결성 → '앱 서명 키 인증서'의 SHA-1도 추가 (안 하면 플레이에서 받은 앱의 구글 로그인이 안 됨)

### 2. AdMob — 이미 있는 AdMob 계정으로
1. https://admob.google.com → 앱 → 앱 추가 → Android → "아직 앱스토어에 없음" → 이름 `두더지 게임`
2. 나온 **앱 ID**(`ca-app-pub-…~…`)를 Claude에게
3. 그 앱에서 광고 단위 2개 만들기: **배너**(이름 예: 맨위 배너) · **보상형**(이름 예: 이어하기) → 광고 단위 ID(`ca-app-pub-…/…`) 2개를 Claude에게
4. 개인정보 보호 및 메시지 → 유럽 규정(GDPR) 메시지 만들기 (앱 안 동의 창은 이미 연결돼 있음)
5. 결제 → 게시자 ID(`pub-…`)를 Claude에게 → `brown-crab.com/app-ads.txt` 를 만들어 올려요 (광고 수익을 받으려면 필요)
   - 진짜 광고 ID로 바꾸기 전에는 내 앱의 광고를 내가 누르지 않기 (계정 정지 위험)

### 3. 구글 플레이 — 개발자 계정으로
1. Play Console → 앱 만들기 (앱 이름·기본 언어 한국어·게임·무료)
2. 테스트 → **내부 테스트** → 새 버전 → `app-release.aab` 올리기 (Claude가 만들어 둠)
3. 앱 콘텐츠: 개인정보처리방침 `https://brown-crab.com/privacy.html` (**AdMob 광고·광고 ID 항목 추가 필요** — Claude가 글 고쳐 드릴 수 있음),
   광고 포함 '예', 데이터 보안(이름·게임 기록·이메일 수집, 광고 ID 사용), 콘텐츠 등급 설문, 대상 연령(어린이 대상이면 광고 설정이 달라짐 — 정해서 알려 주기),
   계정 삭제 주소 `https://brown-crab.com/delete.html`

## 플레이 스토어 그림 (`store/`)
- `play_icon_512.png` (앱 아이콘 512) · `feature_1024x500.png` (그래픽 이미지) — `tools/icon_from_gpt.py` 로 GPT 그림에서 만듦

## 디버그 열쇠 SHA-1 (시험용 앱의 구글 로그인용)
(빌드하면 `~/.android/debug.keystore` 로 생김 — 아래 줄은 Claude가 채움)
- `E6:95:DB:DB:B0:F4:14:83:22:24:0F:B4:95:77:FB:C9:8F:72:B9:37`
