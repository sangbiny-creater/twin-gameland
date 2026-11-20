'use strict';
// 두더지 게임 Firebase 연결 정보 — BROWN CRAB 전용 프로젝트 (트윈 게임랜드 twin-gameland·다운힐 brown-crab-downhill 과 완전히 따로)
//  아직 프로젝트를 만들지 않아서 비어 있어요 → 비어 있으면 게스트로만 할 수 있고, 기록·이름은 이 기기에만 남아요 (랭킹은 안 보임).
//  프로젝트를 만들면(mole-app/README.md '두더지 전용 Firebase 만들기') 콘솔 → 프로젝트 설정 → 내 앱(웹) → "SDK 설정 및 구성"의 값을 아래에 넣고,
//  mole-admin/firebase_config.js 에도 같은 값을 넣어요. 이 값은 공개돼도 괜찮은 값이에요 (누가 무엇을 읽고 쓸지는 Firestore 규칙이 막음: mole-admin/server/firestore.rules).
window.FIREBASE_CONFIG = null;
// 예: window.FIREBASE_CONFIG = { apiKey: '…', authDomain: 'brown-crab-mole.firebaseapp.com', projectId: 'brown-crab-mole', storageBucket: 'brown-crab-mole.firebasestorage.app', messagingSenderId: '…', appId: '…' };
