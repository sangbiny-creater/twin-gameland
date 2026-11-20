'use strict';
// 다운힐 앱 광고(AdMob) 설정 — 안드로이드 앱 안에서만 씀 (웹에서는 가짜 광고 자리)
//  지금은 구글이 주는 '테스트 광고 ID' (누르거나 봐도 돈이 안 되고, 계정에 문제도 안 생김).
//  AdMob 에 앱을 등록하고 광고 단위 2개(배너·보상형)를 만들면 받은 ID 로 바꾸고 test 를 false 로.
//  앱 ID(ca-app-pub-…~…)는 ~/Documents/downhill-android/android/app/src/main/res/values/strings.xml 의 admob_app_id 에.
window.ADS_CONFIG = {
  test: true,
  banner: 'ca-app-pub-3940256099942544/9214589741',   // 맨 위 배너 (적응형 배너, 테스트 ID)
  rewarded: 'ca-app-pub-3940256099942544/5224354917', // 광고 보고 이어하기 (보상형, 테스트 ID)
};
