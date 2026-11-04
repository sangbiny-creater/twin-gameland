'use strict';
// 고를 수 있는 캐릭터 목록. tools/char_pipeline.py register 가 새 캐릭터를 여기에 자동으로 추가해요.
//  look: 저장·그림 파일 이름 / name: 캐릭터 만들기 버튼 이름 / base: 같은 계열 기본 캐릭터(색·예비 그림)
//  atlas: true 면 common/chars/<look>.webp 포즈 그림을 씀 / dress: 옷(코스튬) 그림이 있는지
//  hidden: true 면 캐릭터 만들기에 안 나오고, 이 모습인 캐릭터는 같은 계열의 가장 새 모습으로 바뀜
window.CHAR_LOOKS = [
  { look: 'eunyu', name: '은유 스타일', base: 'eunyu', atlas: false, dress: true, hidden: true },
  { look: 'eungyeol', name: '은결 스타일', base: 'eungyeol', atlas: false, dress: true, hidden: true },
  { look: 'eunyu2', name: '은유 v2', base: 'eunyu', atlas: true, dress: false, isNew: true, hidden: true },
  { look: 'eungyeol2', name: '은결 v2', base: 'eungyeol', atlas: true, dress: false, isNew: true, hidden: true },
  { look: 'eunyu3', name: '은유', base: 'eunyu', atlas: true, dress: false, isNew: true },
  { look: 'eungyeol3', name: '은결', base: 'eungyeol', atlas: true, dress: false, isNew: true },
  // @@NEW_LOOKS@@ (이 줄 위에 새 캐릭터가 추가돼요)
];
