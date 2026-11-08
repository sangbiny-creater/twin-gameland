'use strict';
// Firebase 연결 정보 (로그인·기록·백오피스). 비어 있으면 게스트로만 들어갈 수 있고, 기록은 이 기기에만 남아요.
//  만드는 법: server/README.md 1~3번. Firebase 콘솔 → 프로젝트 설정 → 내 앱(웹) → "SDK 설정 및 구성"의 값을 그대로 붙여 넣기.
//  이 값은 공개돼도 괜찮은 값이에요 (누가 무엇을 읽고 쓸지는 server/firestore.rules 가 막음). 비밀 키(서비스 계정)는 절대 여기 넣지 않기.
window.FIREBASE_CONFIG = null;
/* 예:
window.FIREBASE_CONFIG = {
  apiKey: '...', authDomain: 'twin-gameland.firebaseapp.com', projectId: 'twin-gameland',
  storageBucket: 'twin-gameland.appspot.com', messagingSenderId: '...', appId: '...',
};
*/
window.FIREBASE_REGION = 'asia-northeast3'; // 서울 (server/functions/index.js 와 같게)
// 백오피스 관리자: 공개 저장소에 이메일을 올리지 않으려고 코드에 적지 않음 → Firestore 'admins' 모음에 관리자 이메일 이름의 문서를 만듦 (server/README.md 4번)
