# Twin Gameland Korean-English UI Localization Map (5th Review - User Korean Edits + Final QA)

## Claude 적용 지침

- 이 문서는 현재 게임의 한국어 UI 문자열과 최종 권장 영어 UI 문자열을 1:1로 매칭한 적용 기준이다.
- `# 파일명` 아래의 표를 해당 소스 파일 범위로 본다.
- **현재 한글**이 코드에 존재하면 **권장 한글**로 먼저 교체하고, 영어 로케일에서는 **최종 영어**를 사용한다.
- **권장 한글은 사용자가 직접 검수·수정한 문구를 최우선 기준으로 삼는다. 최종 영어는 권장 한글의 의미를 기준으로 번역한다.**
- `{}`는 런타임 치환 자리이므로 **개수와 순서를 바꾸지 않는다**.
- `/`는 기존 목록에서 의도한 화면 줄바꿈 위치이므로 가능한 한 유지한다.
- 이모지, 숫자, 단위, 게임명은 표의 최종안을 그대로 사용한다.
- 문자열을 합치거나 쪼갤 때는 UI 레이아웃과 코드의 문자열 조합 방식을 먼저 확인한다. 특히 조사만 따로 있는 한국어 조각은 영어에서 문장 구조가 달라질 수 있다.
- 아래 명칭을 **확정 영문명**으로 사용하며 임의로 바꾸지 않는다:
  - 사천성 → `Mahjong Connect`
  - 메모리 게임 → `Memory Match`
  - 두더지 게임 → `Whack-A-Mole`
  - 다운힐 런너/러너 → `Downhill Runner`
  - 달콤 베이커리 → `Sweet Bakery`
  - 스카이 라이더 → `sky rider`
  - 계단 오르기 → `Stair climb`
  - 멍멍기 간식타임/멍멍이 간식 타임 → `Feed the Puppy`
  - 다트게임/다트 게임 → `Darts`
  - 매표소 → `Ticket Booth`
  - 옷장/캐릭터 꾸미기 → `Wardrobe`
  - 아이템샵/아이템 샵 → `Item Shop`
  - 투어 그룹 → `Tour Group`

## 5차 최종 검수 요약

- 사용자가 직접 수정한 **권장 한글을 기준 문구**로 삼아 전체 영문을 다시 대조했다.
- 권장 한글과 최종 영어의 의미가 어긋난 항목, 이전 문구가 영어에 남은 항목, 캐릭터 영문명 불일치를 수정했다.
- 권장 한글 자체의 조사·맞춤법·자연스러움도 다시 검수해 필요한 항목을 수정했다.
- `{}` 자리표시자의 개수와 순서는 유지했다.
- 확정 게임 영문명은 문서 상단의 명칭표를 그대로 유지했다.
- 최종 수동 검수에서 한글→영어 의미 대응, 용어 통일, UI 문구 자연스러움을 다시 확인했다.

## 문자열 매칭표

### `index.html`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 은유와 은결 | 은유와 은결 | Angela & Luke |
| 어느 캐릭터로 플레이 하시겠습니까? | 캐릭터 선택 | Select Character |
| 두 캐릭터 모두 플레이도 가능합니다. | 두 캐릭터 중 원하는 캐릭터로 플레이할 수 있어요. | You can play as either character. |
| 놀고, 꾸미고, 나만의 게임랜드! | 놀고, 꾸미고, 나만의 게임랜드! | Play, customize, and build your own Gameland! |
| 코인 · 아이템샵 | 코인 · 아이템샵 | Coins · Item Shop |
| 캐릭터 바꾸기 | 캐릭터 바꾸기 | Switch Character |
| 놀이기구 자리 바꾸기 | 놀이기구 위치 바꾸기 | Rearrange Rides |
| 놀이기구를 눌러 고르고, 바꿀 자리를 눌러요 | 먼저 놀이기구를 누른 후, 바꿀 자리를 눌러요 | Tap the ride you want to move, then tap its new spot. |
| 끌어서 옮겨도 돼요 | 끌어서 옮겨도 돼요 | You can also drag it to move. |
| 게임 고르기 | 게임 고르기 | Choose a Game |
| 0 / 12 클리어 | 0 / 12 클리어 | 0 / 12 Cleared |
| 앞 스테이지를 깨면 다음 돌다리가 열려요. 깬 스테이지는 다시 할 수 있어요! | 앞 스테이지를 깨면 다음 단계가 열려요. 깬 스테이지는 다시 할 수 있어요! | Clear the previous stage to unlock the next one. You can replay cleared stages! |
| ← 뒤로 | ← 뒤로 | ← Back |
| 이름 바꾸기 | 이름 바꾸기 | Change Name |
| 캐릭터 삭제 | 캐릭터 삭제 | Delete Character |
| 최근 기록 | 최근 기록 | Recent Results |
| 은유로 시작해요 | 은유로 시작해요 | Start as Angela |
| 이름을 입력하세요 | 이름을 입력하세요 | Enter your name |
| 1-1 하늘도시 1 | 1-1 하늘도시 1 | 1-1 Sky City 1 |
| 출발! | 출발! | Let's Go! |
| 🔊 소리 | 🔊 소리 | 🔊 Sound |
| ✏️ 이름 바꾸기 | ✏️ 이름 바꾸기 | ✏️ Change Name |
| 👦 캐릭터 바꾸기 | 👦 캐릭터 바꾸기 | 👦 Switch Character |
| 📖 기록 | 📖 기록 | 📖 Records |
| 🕰️ 예전 첫 화면 보기 (v0.1) | 🕰️ 예전 첫 화면 보기 (v0.1) | 🕰️ View Old Home Screen (v0.1) |
| 언어 · Language | 언어 · Language | Language |
| 동상 바꾸기 | 동상 바꾸기 | Change Statue |
| 새 꾸미기 아이템은 아이템샵에서 살 수 있어요 | 새 꾸미기는 아이템 샵에서 살 수 있어요. | You can buy new decorations in the Item Shop. |
| 홈 화면에 추가 | 홈 화면에 추가 | Add to Home Screen |
| 하면 주소창 없이 화면이 꽉 차요! | 하면 주소창 없이 전체 화면으로 볼 수 있어요! | for a full-screen experience without the address bar! |
| Safari 공유 버튼 | Safari 공유 버튼 | Safari Share button |
| → '홈 화면에 추가' | → '홈 화면에 추가' | → 'Add to Home Screen' |

### `hub/hub.js`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 캐릭터를 먼저 골라요! | 캐릭터를 골라요! | Choose a character! |
| 처음 시작하기 | 처음 시작하기 | Start New Game |
| 영어판은 준비 중이에요! | 영어판은 준비 중이에요! | English version coming soon! |
| 캐릭터 만들기 | 캐릭터 만들기 | Create Character |
| 이름을 적어 주세요! | 이름을 적어 주세요! | Enter a name! |
| 징검다리 {} / {} · 다음 | 징검다리 {} / {} · 다음 | Stages {} / {} · Next |
| BEST {}m · {}번 비행 | 최고 {}m · {}번 비행 | Best: {}m · {} Flights |
| 아직 안 해봤어요 | 아직 안 해봤어요 | Not Played Yet |
| BEST {}m · {}번 비행 / 모은 코인 | 최고 {}m · {}번 비행 / 모은 코인 | Best: {}m · {} Flights / Coins Collected |
| 계단 오르기 | 계단 오르기 | Stair climb |
| BEST {}m · {}번 도전 | 최고 {}m · {}번 도전 | Best: {}m · {} Attempts |
| BEST {}m · {}번 도전 / 모은 코인 | 최고 {}m · {}번 도전 / 모은 코인 | Best: {}m · {} Attempts / Coins Collected |
| 징검다리 {} / {} · 어려움 {} / {} · {}번 도전 / 모은 코인 | 징검다리 {} / {} · 어려움 {} / {} · {}번 도전 / 모은 코인 | Easy {} / {} · Hard {} / {} · {} Attempts / Coins Collected |
| 다운힐 러너 | 다운힐 러너 | Downhill Runner |
| 장애물을 피해 끝없이 내려가요! | 장애물을 피해 계속 내려가요! | Dodge obstacles and race downhill! |
| 메모리 게임 | 메모리 게임 | Memory Match |
| 징검다리 {} / {} · {}번 도전 / 모은 코인 | 징검다리 {} / {} · {}번 도전 / 모은 코인 | Stages {} / {} · {} Attempts / Coins Collected |
| 두더지 게임 | 두더지 게임 | Whack-A-Mole |
| 징검다리 {} / {} · {}번 도전 / 최고 점수 {} · 모은 코인 | 징검다리 {} / {} · {}번 도전 / 최고 점수 {} · 모은 코인 | Stages {} / {} · {} Attempts / Best {} · Coins Collected |
| 달콤 베이커리 | 달콤 베이커리 | Sweet Bakery |
| BEST {}점 · {}번 도전 | BEST {}점 · {}번 도전 | Best: {} pts · {} Attempts |
| 박자에 맞춰 생크림을 쭉! | 타이밍에 맞춰 생크림을 쭉! | Pipe the cream with perfect timing! |
| BEST {}점 · {}번 도전 / 모은 코인 | BEST {}점 · {}번 도전 / 모은 코인 | Best: {} pts · {} Attempts / Coins Collected |
| 멍멍이 간식 타임 | 멍멍이 간식 타임 | Feed the Puppy |
| 멍멍이들에게 간식을 톡톡! | 멍멍이들에게 간식을 톡톡! | Tap to give the puppies treats! |
| 다트 게임 | 다트 게임 | Darts |
| 다트를 던져 점수를 모아요! | 다트를 던져 고득점을 노려보세요! | Throw darts and rack up points! |
| 분 {}초 | 분 {}초 | min {} sec |
| 스카이훅 러너 | 스카이훅 러너 | Skyhook Runner |
| 스카이 라이더 | 스카이 라이더 | sky rider |
| 다운힐 런너 | 다운힐 러너 | Downhill Runner |
| 멍멍이 간식타임 | 멍멍이 간식 타임 | Feed the Puppy |
| 투어 그룹 | 투어 그룹 | Tour Group |
| 길드는 곧 열려요! 친구들과 함께하는 곳이에요 | 매표소는 곧 열려요! 친구들과 함께하는 곳이에요 | Ticket Booth is coming soon! Play together with friends. |
| 바꾸기 | 바꾸기 | Change |
| 오늘은 어떤 게임을 / 플레이할까? ♡ | 오늘은 어떤 게임을 / 플레이할까? ♡ | What should we / play today? ♡ |
| 좋아하는 게임으로 / 가득 채워 가는 / 나만의 게임랜드! ♡ | 좋아하는 게임으로 / 가득 채워 가는 / 나만의 게임랜드! ♡ | Fill it with / your favorite games— / your very own Gameland! ♡ |
| 사용 중 | 사용 중 | In Use |
| (으)로 바꿨어요! | (으)로 바꿨어요! | Changed! |
| 배치를 저장했어요! | 배치를 저장했어요! | Layout saved! |
| 처음 배치로 돌려놓았어요 | 처음 배치로 돌려놓았어요 | Reset to the original layout. |
| 다이아는 곧 만날 수 있어요! 💎 | 다이아는 준비 중입니다! 💎 | Diamonds are coming soon! 💎 |
| 새 놀이기구가 곧 열려요! | 새 게임이 곧 열려요! | New games are coming soon! |
| 새 이름 (8글자까지) | 새 이름 (12글자까지) | New name (up to 12 characters) |
| 이름을 바꿨어요! | 이름을 바꿨어요! | Name changed! |
| 어려움 모드는 곧 열려요! | Hard 모드는 곧 열려요! | Hard Mode is coming soon! |
| 쉬움 1-10 까지 깨면 어려움이 열려요! | Easy 1-10까지 깨면 Hard가 열려요! | Clear Easy 1-10 to unlock Hard Mode! |
| · 어려움 | · Hard | · Hard |
| / {} 클리어 | / {} 클리어 | / {} Cleared |
| 쉬움에서 같은 월드를 다 깨면 열려요! | 같은 월드의 Easy를 다 깨면 열려요! | Clear the same world on Easy to unlock! |
| 앞 스테이지를 먼저 깨요! | 앞 스테이지를 먼저 깨요! | Clear the previous stage first! |
| / {} 클리어 · ⭐ | / {} 클리어 · ⭐ | / {} Cleared · ⭐ |
| 쉬움에서 한 월드(N-1 ~ N-10)를 다 깨면 어려움의 같은 월드가 열려요. | 한 월드(N-1 ~ N-10)의 Easy를 다 깨면 Hard가 열려요. | Clear an entire world (N-1 to N-10) on Easy to unlock the same world on Hard. |
| 어려움 | Hard | Hard |
| 쉬움 {} 까지 깨면 열려요! | Easy {}까지 깨면 열려요! | Clear Easy {} to unlock! |
| 마지막 트로피 | 마지막 트로피 | Final Trophy |
| 빈 별 | 빈 별 | Empty Star |
| 최고 점수 {}점 | 최고 점수 {}점 | Best Score: {} |
| 가장 빨리 깬 기록 | 최단 클리어 기록 | Fastest Clear Time |
| 최고 기록 {}m | 최고 기록 {}m | Best: {}m |
| 점수가 높을수록 별이 늘어요. | 점수가 높을수록 별이 늘어요. | Earn more stars with a higher score. |
| 시간이 많이 남을수록 별이 늘어요. | 시간이 많이 남을수록 별이 늘어요. | Earn more stars with more time remaining. |
| 남은 하트가 많을수록 별이 늘어요. | 남은 하트가 많을수록 별이 늘어요. | Earn more stars with more hearts remaining. |
| 클리어! {} · {}번 도전 / | 클리어! {} · {}번 도전 / | Cleared! {} · {} Attempts / |
| 아직 못 깼어요. {}{}번 도전 / 깨면 다음 돌다리가 열려요! | 아직 못 깼어요. {}{}번 도전 / 깨면 다음 단계가 열려요! | Not cleared yet. {}{} Attempts / Clear it to unlock the next stepping stone! |
| 처음 도전하는 스테이지예요! / 깨면 다음 돌다리가 열려요. | 처음 도전하는 스테이지예요! / 깨면 다음 단계가 열려요. | First attempt! / Clear it to unlock the next stepping stone. |
| 다시 하기 | 다시 하기 | Retry |
| 의 기록 | 의 기록 | ’s Record |
| 지금 코인 {} · 지금까지 모은 코인 {} · 별 | 보유 코인 {} · 누적 코인 {} · 별 | Coins: {} · Total Earned: {} · Stars |
| 아직 기록이 없어요. 게임을 해봐요! | 아직 기록이 없어요. 게임을 해봐요! | No records yet. Play a game! |
| 클리어 | 클리어 | Clear |
| 캐릭터를 지울까요? | 캐릭터를 지울까요? | Delete this character? |
| 코인 {}개와 모든 기록이 사라지고, / 되돌릴 수 없어요. | 코인 {}개와 모든 기록이 사라지고, / 되돌릴 수 없어요. | {} coins and all records will be deleted. / This cannot be undone. |
| 캐릭터를 지웠어요. | 캐릭터를 지웠어요. | Character deleted. |

### `common/gamepop.js`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 시간 추가 | 시간 추가 | Extra Time |
| 모두 보기 | 모두 보기 | Reveal All |
| 게임 선택 | 게임 선택 | Select Game |
| 지도 보기 | 지도 보기 | View Map |
| 다음 스테이지 | 다음 스테이지 | Next Stage |
| 판부터 시작 | 판부터 시작 | Start from Round |
| 아이템을 누르면 이번 판에 써요 | 아이템을 누르면 이번 판에 사용해요 | Tap an item to use it this round. |
| 시작하기 | 시작하기 | Start |
| 준비 중 | 준비 중 | Coming Soon |
| 아이템 구매 | 아이템 구매 | Buy Item |
| 코인 / 코인이 {}개 모자라요. / 게임을 해서 코인을 모아요! | 코인 / 코인이 {}개 부족해요. / 게임을 해서 코인을 모아요! | Coins / You need {} more coins. / Play games to earn coins! |
| 1개를 살까요? | 1개를 살까요? | Buy 1? |
| 코인 (지금 {}) | 코인 (지금 {}) | Coins (You have {}) |
| 을(를) 샀어요! | 을(를) 샀어요! | Purchased! |
| 취소 | 취소 | Cancel |
| 최고 기록! | 최고 기록! | New Record! |
| 게임 끝 | 게임 끝 | Game Over |
| 터치하면 다시 시작! | 터치하면 다시 시작! | Tap to restart! |

### `common/monet.js`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 열쇠 1개 | 열쇠 1개 | 1 Key |
| 다이아 10개 | 다이아 10개 | 10 Diamonds |
| 다이아 20개 | 다이아 20개 | 20 Diamonds |
| 특별 코스튬 (준비 중) | 특별 코스튬 (준비 중) | Special Costume (Coming Soon) |
| 모든 게임 열기 | 모든 게임 열기 | Unlock All Games |
| 잠긴 게임을 한 번에 모두 열어요 (한 번만) | 잠긴 게임을 한 번에 모두 열어요 (한 번만) | Unlock all locked games at once (one-time purchase). |
| 월 다이아 패스 | 월 다이아 패스 | Monthly Diamond Pass |
| 바로 60개 + 30일 동안 매일 10개 | 바로 60개 + 30일 동안 매일 10개 | 60 now + 10 daily for 30 days |
| 광고 없이 보상 | 광고 없이 보상 받기 | Ad-Free Rewards |
| 광고 보상을 광고 없이 바로 (계속) | 광고를 보지 않고 바로 보상을 받아요 (계속) | Claim ad rewards instantly without watching ads |
| 이어하기권 10장 | 이어하기권 10장 | 10 Continue Tickets |
| 열쇠 | 열쇠 | Keys |
| 다이아 | 다이아 | Diamonds |
| 광고 자리 | 광고 자리 | Ad Area |
| 앱에서는 여기서 보상형 광고가 나와요 / (웹 검수판: {}초 뒤 광고를 본 것처럼 이어져요) | 앱에서는 여기서 보상형 광고가 나와요 / (웹 검수판: {}초 뒤 광고를 본 것처럼 이어져요) | A rewarded ad appears here in the app. / (Web review build: continues after {} sec as if the ad was watched.) |
| 가지고 있어요 | 보유 중 | Owned |
| 일 남음 | 일 남음 | days remaining |
| 내일 또 | 내일 다시 | Come Back Tomorrow |
| 첫 구매 2배 | 첫 구매 2배 | First Purchase ×2 |
| 인기 | 인기 | Popular |
| 다이아 상점 | 다이아 상점 | Diamond Shop |
| 검수용 · 진짜 결제 없음 | 검수용 · 진짜 결제 없음 | Review Build · No Real Payment |
| 광고 보고 받기{} {}개 · 오늘 {}번 남음 | 광고 보고 받기{} · {}개 · 오늘 {}번 남음 | Watch Ad{} · Get {} · {} left today |
| 지금 {}장 | 지금 {}장 | You have {} |
| 앱에서는 여기서 구글 결제 창이 떠요 (값은 🟡 임시). | 앱에서는 여기서 구글 결제 창이 떠요 (값은 🟡 임시). | The Google Play purchase window appears here in the app (🟡 values are temporary). |
| 상품 ID: | 상품 ID: | Product ID: |
| 다이아가 모자라요 | 다이아가 부족해요 | Not Enough Diamonds |
| 이어하기권 + | 이어하기권 + | Continue Tickets + |
| 다이아 {}개 | 다이아 {}개 | {} Diamonds |
| 첫 결제라서 2배로 받아요! | 첫 결제라서 2배로 받아요! | First purchase bonus: 2× rewards! |
| 검수용 가짜 결제 · | 검수용 가짜 결제 · | Test Purchase · |
| 여기가 앱의 결제 창 자리예요. / 확인을 누르면 바로 들어와요 (돈 안 나감). | 여기가 앱의 결제 창 자리예요. / 확인을 누르면 바로 들어와요 (돈 안 나감). | The app purchase window appears here. / Tap Confirm to receive it instantly (no charge). |
| 확인 (가짜 결제 {}) | 확인 (가짜 결제 {}) | Confirm (Test Purchase {}) |
| +{} · 패스 {}일 | +{} · 패스 {}일 | +{} · Pass {} days |
| 열쇠로 열기 ({}개 있음) | 열쇠로 열기 ({}개 있음) | Unlock with Key ({} owned) |
| (모자라요) | (부족해요) | (Not enough) |
| 다이아 {}개로 열기 | 다이아 {}개로 열기 | Unlock for {} Diamonds |
| ▶ 체험해 보기 | ▶ 체험하기 | ▶ Try It |
| 열 수 없어요 | 잠김 | Locked |
| 열림! | 열림! | Unlocked! |
| 잠긴 게임이에요. 열쇠나 다이아로 열 수 있어요. | 잠긴 게임이에요. 열쇠나 다이아로 열 수 있어요. | This game is locked. Unlock it with a Key or Diamonds. |
| 한 번 열면 한 판만이 아니라 이 게임을 언제든지 계속 할 수 있어요! / 다이아로 연 횟수에 따라 값이 올라요: | 한 번 열면 이 게임을 계속 플레이할 수 있어요! / 다이아로 게임을 연 횟수에 따라 가격이 올라요: | Once unlocked, the game stays unlocked permanently! / The Diamond price increases based on how many games you've unlocked with Diamonds: |
| 게임 {}판마다 | 게임 {}판마다 | Every {} Games |
| 게임 | 게임 | Games |
| 기록 | 기록 | Records |
| 달성! | 달성! | Achieved! |
| 첫 클리어! | 첫 클리어! | First Clear! |
| +{} 다이아 획득! | +{} 다이아 획득! | +{} Diamonds! |
| 다음 다이아까지 {}판 | 다음 다이아까지 {}판 | {} games until next Diamond reward |
| 월드 | 월드 | World |
| 별 {}개! | 별 {}개! | {} Stars! |
| 기록 {}{} 달성! | 기록 {}{} 달성! | New Record: {}{}! |
| +{} 코인 | +{} 코인 | +{} Coins |
| 2배 받기 | 2배 받기 | Claim 2× |
| 받았어요! | 받았어요! | Claimed! |
| 2배 받기 + | 2배 받기 + | Claim 2× + |
| 연결 예정이에요 | 준비 중이에요 | Coming Soon |
| 이어하기권 {}장 | 이어하기권 {}장 | {} Continue Tickets |
| 체험은 1-1, 1-2까지예요. / 계속하려면 게임을 열어요! | 체험은 1-1, 1-2까지예요. / 계속하려면 게임을 열어요! | Trial includes 1-1 and 1-2. / Unlock the game to continue! |
| 체험 {}라운드까지 | 체험 {}라운드까지 | Trial: up to Round {} |
| 체험 {}라운드가 끝났어요! / 열면 8라운드 끝까지 할 수 있어요. | 체험 {}라운드가 끝났어요! / 열면 8라운드 끝까지 할 수 있어요. | The {}-round trial is over! / Unlock to play all 8 rounds. |
| 체험 {}초 | 체험 {}초 | {}-sec Trial |
| 체험 {}초가 끝났어요! / 열면 끝까지 할 수 있어요. | 체험 {}초가 끝났어요! / 열면 끝까지 할 수 있어요. | The {}-sec trial is over! / Unlock to play to the end. |
| 체험 | 체험 | Trial |
| ▶ 체험해 보기 (1-1, 1-2) | ▶ 체험해 보기 (1-1, 1-2) | ▶ Try It (1-1, 1-2) |
| ▶ 체험해 보기 ({}라운드) | ▶ 체험해 보기 ({}라운드) | ▶ Try It ({} Rounds) |
| ▶ 체험해 보기 ({}초) | ▶ 체험해 보기 ({}초) | ▶ Try It ({} sec) |
| 체험은 쉬움 1-1, 1-2까지예요. / 열면 모든 판을 할 수 있어요! | 체험은 Easy 1-1, 1-2까지예요. / 열면 모든 판을 할 수 있어요! | Trial includes Easy 1-1 and 1-2. / Unlock to play all stages! |
| 환영 선물 | 환영 선물 | Welcome Gift |
| v0.3 상용화 검수판 | v0.3 상용화 검수판 | v0.3 Release Review Build |
| 처음에는 {}이 열려 있어요. / 잠긴 게임 하나를 열 수 있는 {} 열쇠 1개를 줄게요! | 처음에는 {}이 열려 있어요. / 잠긴 게임 하나를 열 수 있는 {} 열쇠 1개를 줄게요! | {} is unlocked at the start. / Here's 1 {} Key to unlock one locked game! |
| 월 다이아 패스: {} +{} ({}일 남음) | 월 다이아 패스: {} +{} ({}일 남음) | Monthly Diamond Pass: {} +{} ({} days left) |
| 일 선물: | 일 선물: | Day Reward: |
| 일째 선물: | 일째 선물: | Day Reward: |
| 출석 {}일째 | 출석 {}일째 | Login Day {} |
| 오늘의 선물: {} 다이아 {}개 | 오늘의 선물: {} 다이아 {}개 | Today's Reward: {} Diamonds {} |
| 누적 출석이에요 (빠진 날이 있어도 이어져요) | 누적 출석이에요 (빠진 날이 있어도 초기화되지 않아요) | Login days are cumulative (missing a day won't reset your progress). |

### `common/profile.js`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 숲속 나무마을 | 숲속 나무마을 | Woodland Village |
| 석양의 항구 | 석양의 항구 | Sunset Harbor |
| 기본 하늘 | 기본 하늘 | Default Sky |
| 숲 속 마을 | 숲 속 마을 | Forest Village |
| 겨울 왕국 | 겨울 왕국 | Winter Kingdom |
| 야경 도시 | 야경 도시 | Night City |
| 우주 여행 | 우주 여행 | Space Journey |
| 사막 오아시스 | 사막 오아시스 | Desert Oasis |
| 하트 4칸에 3개로 시작해요 | 하트 4칸 중 3개로 시작해요 | Start with 3 of 4 hearts |
| 처음 한 번은 다쳐도 괜찮아요 | 처음 한 번은 다쳐도 괜찮아요 | Blocks the first hit |
| 처음 20초 동안 천천히 움직여요 | 처음 20초 동안 이동 속도가 느려져요 | Slower movement for the first 20 sec |
| 짝 하나를 알려 줘요 | 짝 하나를 알려 줘요 | Reveals one matching pair |
| 제한 시간 +10초 | 제한 시간 +10초 | Time +10 sec |
| 짝 하나를 바로 이어 줘요 | 짝 하나를 바로 이어 줘요 | Instantly matches one pair |
| 모든 카드를 잠깐 보여 줘요 | 모든 카드를 잠깐 보여 줘요 | Briefly reveals all cards |
| 추가 목숨 | 추가 목숨 | Extra Life |
| 하트 4개로 시작 | 하트 4개로 시작 | Start with 4 hearts |
| 1회 보호 | 1회 보호 | 1-Hit Shield |
| 처음 한 번 안 다쳐요 | 처음 한 번 안 다쳐요 | Blocks the first hit |
| 코인 흡수 | 코인 흡수 | Coin Magnet |
| 처음 20초 자석 | 처음 20초 동안 자석 효과 | Magnet for first 20 sec |
| 코인 2배 | 코인 2배 | Double Coins |
| 처음 30초 코인 2배 | 처음 30초 동안 코인 2배 | Double coins for first 30 sec |
| 고운 한복을 입었어요! | 고운 한복을 입었어요! | A beautiful Korean hanbok! |
| 비 오는 날에도 신나게! | 비 오는 날에도 신나게! | Fun even on rainy days! |
| 포근포근 곰돌이 잠옷이에요 | 포근포근 곰돌이 잠옷이에요 | Cozy teddy-bear pajamas! |
| 용감한 고대 로마 병사! | 용감한 고대 로마 병사! | A brave ancient Roman soldier! |
| 편하게 달리기 좋은 츄리닝 | 편하게 달리기 좋은 츄리닝 | A comfy tracksuit made for running! |
| 공룡 옷 | 공룡 옷 | Dinosaur Costume |
| 귀여운 공룡이 되었어요! | 귀여운 공룡이 되었어요! | Turn into a cute dinosaur! |
| 단정한 교복 차림! | 단정한 교복 차림! | A neat school uniform! |
| 물놀이 준비 완료! | 물놀이 준비 완료! | Ready to make a splash! |
| 마법사 옷 | 마법사 옷 | Wizard Costume |
| 반짝반짝 마법 지팡이! | 반짝반짝 마법 지팡이! | A sparkling magic wand! |
| 선물을 나눠 주는 산타! | 선물을 나눠 주는 산타! | Santa is here with gifts! |
| 홈런을 노리는 야구 선수! | 홈런을 노리는 야구 선수! | Swing for a home run! |
| 멋쟁이 정장 차림! | 멋쟁이 정장 차림! | Looking sharp in a stylish suit! |
| 탐정 옷 | 탐정 옷 | Detective Costume |
| 돋보기로 수수께끼 해결! | 돋보기로 수수께끼 해결! | Solve mysteries with a magnifying glass! |
| 토끼 동상 | 토끼 동상 | Bunny Statue |
| 별 트로피 | 별 트로피 | Star Trophy |
| 하트 곰 | 하트 곰 | Heart Bear |
| 무지개 유니콘 | 무지개 유니콘 | Rainbow Unicorn |
| 왕관 강아지 | 왕관 강아지 | Crowned Puppy |
| 은결 동상 | 은결 동상 | Eungyeol Statue |
| 은유 동상 | 은유 동상 | Eunyu Statue |
| 꽃 요정 동상 | 꽃 요정 동상 | Flower Fairy Statue |
| 별 분수 | 별 분수 | Star Fountain |
| 하트 분수 | 하트 분수 | Heart Fountain |
| 고래 분수 | 고래 분수 | Whale Fountain |
| 무지개 분수 | 무지개 분수 | Rainbow Fountain |
| 꽃 분수 | 꽃 분수 | Flower Fountain |
| 돌 분수 | 돌 분수 | Stone Fountain |
| 토끼 분수 | 토끼 분수 | Bunny Fountain |
| 토끼 성 대문 | 토끼 성 대문 | Bunny Castle Gate |
| 사탕 과자 대문 | 사탕 과자 대문 | Candy Gate |
| 꽃 정원 대문 | 꽃 정원 대문 | Flower Garden Gate |
| 별빛 우주 대문 | 별빛 우주 대문 | Starlight Space Gate |
| 겨울 눈 성 대문 | 겨울 눈 성 대문 | Snow Castle Gate |
| 성 대문 | 성 대문 | Castle Gate |
| 하트 대문 | 하트 대문 | Heart Gate |
| 무지개 대문 | 무지개 대문 | Rainbow Gate |
| 나무 이름표 | 나무 이름표 | Wooden Nameplate |
| 리본 이름표 | 리본 이름표 | Ribbon Nameplate |
| 별 이름표 | 별 이름표 | Star Nameplate |
| 토끼 이름표 | 토끼 이름표 | Bunny Nameplate |
| 무지개 이름표 | 무지개 이름표 | Rainbow Nameplate |
| 꽃 이름표 | 꽃 이름표 | Flower Nameplate |
| 기본 로고 | 기본 로고 | Default Logo |
| 별 로고 | 별 로고 | Star Logo |
| 토끼 로고 | 토끼 로고 | Bunny Logo |
| 무지개 로고 | 무지개 로고 | Rainbow Logo |
| 하트 로고 | 하트 로고 | Heart Logo |
| 꽃 로고 | 꽃 로고 | Flower Logo |
| 코인 5000개를 받았어요! | 코인 5000개를 받았어요! | You got 5,000 coins! |
| 무적 모드 ON! 이제 안 죽어요 | 무적 모드 ON! 이제 안 죽어요 | Invincible Mode ON! You won't take damage. |
| 무적 모드 OFF | 무적 모드 OFF | Invincible Mode OFF |
| 모든 스테이지 자물쇠가 풀렸어요! | 모든 스테이지 자물쇠가 풀렸어요! | All stages unlocked! |
| 자물쇠가 다시 잠겼어요 (깬 스테이지까지만 열려요) | 자물쇠가 다시 잠겼어요 (깬 스테이지까지만 열려요) | Stage locks restored (only cleared stages remain open). |
| v0.1 (예전 카드 목록)으로 가요! | v0.1 (예전 카드 목록)으로 가요! | Go to v0.1 (old card list)! |
| v0.2 (놀이공원)로 가요! | v0.2 (놀이공원)로 가요! | Go to v0.2 (amusement park)! |
| v0.3 (지금 버전)으로 가요! | v0.3 (지금 버전)으로 가요! | Go to v0.3 (current version)! |
| 다이아 100개를 받았어요! (검수용) | 다이아 100개를 받았어요! (검수용) | You got 100 Diamonds! (Review only) |
| 게임 잠금·열쇠·출석을 처음 상태로 돌렸어요 (검수용) | 게임 잠금·열쇠·출석을 처음 상태로 돌렸어요 (검수용) | Game locks, Keys, and login rewards reset to initial state (Review only). |
| 처음 시작하는 상태로 돌아가요! | 처음 시작하는 상태로 돌아가요! | Reset to a fresh start! |
| 하루가 지났어요! 첫 화면에서 출석해 보세요 | 하루가 지났어요! 첫 화면에서 출석해 보세요 | A day has passed! Check in on the home screen. |
| 🦸 무적 · 기록·코인 없음 | 🦸 무적 · 기록·코인 없음 | 🦸 Invincible · No records or coins |
| 없는 쿠폰 번호예요 | 유효하지 않은 쿠폰 번호예요 | Invalid coupon code. |
| 이미 사용한 쿠폰이에요 | 이미 사용한 쿠폰이에요 | This coupon has already been used. |

### `shop/index.html`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 트윈 게임랜드 | 트윈 게임랜드 | Twin Gameland |
| 아이템 샵 — 게임을 더 재미있게! 나만의 스타일로 꾸며보세요! | 아이템 샵 — 게임을 더 재미있게! 나만의 스타일로 꾸며 보세요! | Item Shop — Power up your games and make Gameland your own! |
| 캐릭터 꾸미기 | 캐릭터 꾸미기 | Wardrobe |
| 배경 스킨 | 배경 스킨 | Background Skins |
| 한 번 사면 모든 게임 배경이 함께 바뀌어요! | 한 번 사면 모든 게임 배경이 함께 바뀌어요! | Buy once to use this background in every game! |
| 더 보기 | 더 보기 | See More |
| 🎮 게임을 골라 부스트를 사세요 | 🎮 게임을 골라 부스트를 사세요 | 🎮 Choose a game and buy boosts |
| 게임 부스트 | 게임 부스트 | Game Boosts |
| 게임을 더 쉽게! 다양한 부스트 아이템을 사용해보세요! | 게임을 더 쉽게! 다양한 부스트 아이템을 사용해보세요! | Use boosts to make games easier! |
| 보유 아이템 | 보유 아이템 | Owned Items |
| 이미 보유하고 있는 아이템이에요! | 이미 보유하고 있는 아이템이에요! | You already own this item! |
| 놀이공원 꾸미기 | 놀이공원 꾸미기 | Park Decorations |
| 다이아로 사서 첫 화면을 꾸며요! 동상·분수·대문·이름표·로고 | 다이아로 사서 첫 화면을 꾸며요! 동상·분수·대문·이름표·로고 | Buy with Diamonds and decorate your home screen! Statues · Fountains · Gates · Nameplates · Logos |
| 🎟️ 쿠폰 입력하기 | 🎟️ 쿠폰 입력하기 | 🎟️ Enter Coupon |
| 기본 옷 | 기본 옷 | Default Outfit |
| 입은 옷은 모든 게임과 메뉴 화면에 바로 적용돼요! | 입은 옷은 모든 게임과 메뉴 화면에 바로 적용돼요! | Your outfit appears in all games and menus! |
| 받은 쿠폰 번호를 입력해 주세요. | 받은 쿠폰 번호를 입력해 주세요. | Enter your coupon code. |
| 쿠폰 번호 | 쿠폰 번호 | Coupon Code |

### `shop/shop.js`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 한 번 사면 모든 게임에서 같이 써요! | 한 번 사면 모든 게임에서 같이 써요! | Buy once and use it in every game! |
| 은(는) 곧 나와요! | 은(는) 곧 나와요! | Coming Soon! |
| 적용중 | 적용 중 | Equipped |
| 적용하기 | 적용하기 | Apply |
| 코인이 {}개 모자라요. 게임을 해서 모아요! | 코인이 {}개 부족해요. 게임을 해서 모아요! | You need {} more coins. Play games to earn them! |
| 배경 스킨 구매 | 배경 스킨 구매 | Buy Background Skin |
| 모든 게임 배경을 / {}(으)로 바꿀까요? / {} {} 코인 | 모든 게임 배경을 / {}(으)로 바꿀까요? / {} {} 코인 | Change all game backgrounds / to {}? / {} {} Coins |
| 적용! 모든 게임 배경이 바뀌어요 | 적용! 모든 게임 배경이 바뀌어요 | Applied! All game backgrounds have changed. |
| 적용! 모든 게임에 바뀌어요 | 적용 완료! 모든 게임에 반영돼요 | Applied to all games! |
| 게임 화면의 버튼으로 하나씩 꺼내 써요 | 게임 화면의 버튼을 눌러 하나씩 사용해요 | Use them one at a time from the in-game button. |
| 게임 시작 창에서 골라서 써요 | 게임 시작 창에서 골라 사용해요 | Choose one before starting the game. |
| — {} / 쓰는 게임: {} / {} / 1개를 살까요? {} {} 코인 | — {} / 쓰는 게임: {} / {} / 1개를 살까요? {} {} 코인 | — {} / Used in: {} / {} / Buy 1? {} {} Coins |
| +1! 지금 {}개 있어요 | +1! 지금 {}개 있어요 | +1! You now have {}. |
| 부스트 구매 | 부스트 구매 | Buy Boost |
| — {} / 1개를 살까요? {} {} 코인 | — {} / 1개를 살까요? {} {} 코인 | — {} / Buy 1? {} {} Coins |
| 아직 가진 부스트가 없어요. / 왼쪽 게임 부스트에서 살 수 있어요! | 아직 보유한 부스트가 없어요. / 왼쪽 게임 부스트에서 살 수 있어요! | You don't have any boosts yet. / Buy them from Game Boosts on the left! |
| 게임 화면 버튼으로 써요 | 게임 화면의 버튼으로 사용해요 | Use it with the in-game button. |
| 안 씀 | 사용 안 함 | Not Using |
| : 다음 게임부터 사용해요 | : 다음 게임부터 사용해요 | : Use from the next game |
| : 안 쓰고 아껴 둘게요 | : 사용하지 않고 보관해요 | : Save for later |
| 처음 입고 있던 옷이에요 | 처음 입고 있던 옷이에요 | Your default outfit. |
| 새 캐릭터 옷은 준비 중이에요. 곧 입을 수 있어요! | 새 캐릭터 옷은 준비 중이에요. 곧 입을 수 있어요! | New character outfits are coming soon! |
| 새 캐릭터 옷은 준비 중이에요 👗 | 새 캐릭터 옷은 준비 중이에요 👗 | New character outfits are coming soon 👗 |
| 입는 중 | 착용 중 | Equipped |
| ✓ 입는 중 | ✓ 착용 중 | ✓ Equipped |
| ✓ 가지고 있어요 | ✓ 가지고 있어요 | ✓ Owned |
| 을(를) 입었어요! 모든 게임에 적용돼요 | 을(를) 입었어요! 모든 게임에 적용돼요 | Outfit equipped! It will appear in all games. |
| 의상 구매 | 의상 구매 | Buy Outfit |
| 에게 {}을(를) 사서 입힐까요? / {} {} 코인 | 에게 {}을(를) 사서 입힐까요? / {} {} 코인 | Buy {} and equip it on the character? / {} {} Coins |
| 구매 완료! 바로 입었어요 | 구매 완료! 바로 입었어요 | Purchased and equipped! |
| 적용! 첫 화면의 {}이(가) 바뀌어요 | 적용! 첫 화면의 {}이(가) 바뀌어요 | Applied! {} on the home screen has changed. |
| 다이아가 {}개 모자라요! 첫 화면의 다이아 칸에서 모을 수 있어요 | 다이아가 {}개 부족해요! 첫 화면의 다이아 메뉴에서 모을 수 있어요 | You need {} more Diamonds! You can get them from the Diamond section on the home screen. |
| 을(를) 살까요? / {} 다이아 {}개 | 을(를) 살까요? / {} 다이아 {}개 | Buy it? / {} Diamonds {} |
| 을(를) 샀어요! '적용하기'를 누르면 첫 화면에 놓여요 | 을(를) 샀어요! '적용하기'를 누르면 첫 화면에 놓여요 | Purchased! Tap 'Apply' to place it on the home screen. |

### `downhill/game.js`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 눈 덮인 산 | 눈 덮인 산 | Snowy Mountain |
| 겨울 숲 | 겨울 숲 | Winter Forest |
| 얼음 계곡 | 얼음 계곡 | Ice Valley |
| 눈 마을 | 눈 마을 | Snow Village |
| 오로라 설원 | 오로라 설원 | Aurora Snowfield |
| 부스트: | 부스트: | Boost: |
| 점프! | 점프! | Jump! |
| 보호막! | 보호막! | Shield! |
| 무적! | 무적! | Invincible! |
| 하트 -1 | 하트 -1 | Heart -1 |
| 쾅! | 쾅! | Crash! |
| 슝~! | 슝~! | Whoosh! |
| 하트 +1 | 하트 +1 | Heart +1 |
| 자석! | 자석! | Magnet! |
| 점프하기 +1 | 점프하기 +1 | Jump +1 |
| 화면 왼쪽·오른쪽을 눌러 피해요 | 화면 왼쪽·오른쪽을 눌러 피해요 | Tap the left or right side to dodge. |
| ← → 키로 피해요 | ← → 키로 피해요 | Use ← → keys to dodge. |
| 슝~ | 슝~ | Whoosh! |
| 무적 모드라서 기록·코인이 없어요 | 무적 모드라서 기록·코인이 없어요 | No records or coins in Invincible Mode. |
| +{} 코인 획득! | +{} 코인 획득! | +{} Coins! |
| (거리 보너스 +{}) | (거리 보너스 +{}) | (Distance Bonus +{}) |
| 내 코인 | 내 코인 | My Coins |

### `downhill/index.html`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 은유와 은결의 다운힐 러너 | 은유와 은결의 다운힐 러너 | Luke & Angela's Downhill Runner |
| 누구랑 내려갈까? | 누구랑 내려갈까? | Who do you want to play as? |
| 잠깐 쉬어요 | 잠깐 쉬어요 | Paused |
| 이동 거리 | 이동 거리 | Distance |
| 획득 코인 | 획득 코인 | Coins |
| 최대 콤보 | 최대 콤보 | Max Combo |
| BEST 기록 | 최고 기록 | Best |

### `bakery/game.js`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 레벨 {}부터 시작하기 | 레벨 {}부터 시작하기 | Start from Level {} |
| 톡! | 톡! | Tap! |
| 긴 빵 | 긴 빵 | Long Pastry |
| 꾹~ 떼기 | 꾹~ 떼기 | Hold~ Release |
| 하트 긴 빵 | 하트 긴 빵 | Heart Pastry |
| 둘 다 Perfect면 하트 +1 | 둘 다 Perfect면 하트 +1 | Perfect on both = Heart +1 |
| 탄 빵·빈 접시 | 탄 빵·빈 접시 | Burnt Pastry · Empty Plate |
| 누르면 안 돼요! | 누르면 안 돼요! | Don't tap! |
| BEST {}점 | 최고 {}점 | Best: {} pts |
| · 가장 높은 레벨 | · 가장 높은 레벨 | · Highest Level |
| 너무 빨라요! | 너무 빨라요! | Too fast! |
| 너무 일찍 뗐어요 | 너무 일찍 뗐어요 | Released too early! |
| 앗! 탄 빵이에요 | 앗! 탄 빵이에요 | Oops! Burnt pastry! |
| 앗! 빈 접시예요 | 앗! 빈 접시예요 | Oops! Empty plate! |
| 콤보! × | 콤보! × | Combo! × |
| 봐줬어요! | 한 번 막아줬어요! | Protected! |
| 하트가 다 떨어졌어요! | 하트가 다 떨어졌어요! | You're out of hearts! |
| (점수 보너스 +{}) | (점수 보너스 +{}) | (Score Bonus +{}) |
| 개 | 개 | x |
| 번 | 번 | times |
| 레벨 | 레벨 | Level |
| 점 | 점 | pts |
| 준비! | 준비! | Ready! |
| 시작! | 시작! | Start! |
| 레벨 {}! 더 빨라져요 | 레벨 {}! 더 빨라져요 | Level {}! Faster now! |
| 레벨 {}부터 시작! | 레벨 {}부터 시작! | Start from Level {}! |
| 컵케이크가 노란 자리에 오면 화면을 톡! | 컵케이크가 노란 자리에 오면 화면을 톡! | Tap when the cupcake reaches the yellow zone! |
| 긴 빵은 앞에서 꾹~ 누르고 끝에서 떼요! | 긴 빵은 앞에서 꾹~ 누르고 끝에서 떼요! | Hold at the start of the long pastry and release at the end! |
| 탄 빵·빈 접시는 누르면 안 돼요! | 탄 빵·빈 접시는 누르면 안 돼요! | Don't tap burnt pastries or empty plates! |
| 🐢 천천히 {}초 | 🐢 천천히 {}초 | 🐢 Slow {} sec |
| 🪙 코인 2배 {}초 | 🪙 코인 2배 {}초 | 🪙 Double Coins {} sec |
| 🛡️ 1회 보호 | 🛡️ 1회 보호 | 🛡️ 1-Hit Shield |
| 버전 | 버전 | Version |

### `bakery/index.html`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 은유와 은결의 달콤 베이커리 | 은유와 은결의 달콤 베이커리 | Luke & Angela's Sweet Bakery |
| 노란 자리 | 노란 자리 | Yellow Zone |
| 에 오면 화면을 | 에 오면 화면을 | When it reaches, |
| 긴 빵은 | 긴 빵은 | For long pastries, |
| 꾹~ | 꾹~ | Hold~ |
| 누르고 있다가 끝에서 떼요 | 누르고 있다가 끝에서 떼요 | and release at the end. |
| (놓침·함정)면 하트 -1 · 하트 2개로 시작, 다 없어지면 끝! | (놓침·함정)면 하트 -1 · 하트 2개로 시작, 다 없어지면 끝! | Miss or hit a trap = Heart -1 · Start with 2 hearts; game over when they're gone! |
| 긴 빵 위 하트는 | 긴 빵 위 하트는 | For hearts on long pastries, |
| 시작·끝 모두 Perfect | 시작·끝 모두 Perfect | get Perfect at both start and end |
| 면 +1 (최대 3개) | 면 +1 (최대 3개) | to gain +1 (max 3). |
| BEST 0점 | 최고 0점 | Best: 0 pts |
| 어디서부터 할까요? | 어디서부터 할까요? | Where would you like to start? |
| 레벨 5부터 시작하기 | 레벨 5부터 시작하기 | Start from Level 5 |
| 처음부터 하기 | 처음부터 하기 | Start from Level 1 |
| 오늘의 베이커리 끝! | 오늘의 베이커리 끝! | Bakery Complete! |
| 🧁 만든 케이크 | 🧁 만든 케이크 | 🧁 Cakes Made |
| ✨ 완벽 | ✨ 완벽 | ✨ Perfect |
| 🚀 도착한 레벨 | 🚀 도착한 레벨 | 🚀 Level Reached |
| 🔥 최대 콤보 | 🔥 최대 콤보 | 🔥 Max Combo |
| 🪙 획득 코인 | 🪙 획득 코인 | 🪙 Coins |
| 👑 BEST 기록 | 👑 최고 기록 | 👑 Best |

### `stairs/game.js`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 숲속 마을 | 숲속 마을 | Forest Village |
| 날개 덕분에 휴~ | 휴~ 날개 덕분에 살았어요! | Whew! The wings saved you! |
| 하트 -1 (남은 하트 {}) | 하트 -1 (남은 하트 {}) | Heart -1 ({} left) |
| 목숨 +1 | 목숨 +1 | Life +1 |
| +5초 | +5초 | +5 sec |
| +10초 | +10초 | +10 sec |
| 코인 2배! | 코인 2배! | Double Coins! |
| 날개! 15칸 무적 | 날개! 15칸 무적 | Wings! Invincible for 15 steps |
| 위로 가기 · 방향 전환 버튼을 눌러요 | 위로 가기 · 방향 전환 버튼을 눌러요 | Tap Move Up or Change Direction |
| ↑ 위로 가기 · 스페이스 방향 전환 | ↑ 위로 가기 · 스페이스 방향 전환 | ↑ Move Up · Space = Change Direction |
| 칸 | 칸 | steps |
| (높이 보너스 +{}) | (높이 보너스 +{}) | (Height Bonus +{}) |

### `stairs/index.html`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 방향 전환 | 방향 전환 | Change Direction |
| 위로 가기 | 위로 가기 | Move Up |
| 은유와 은결의 계단 오르기 | 은유와 은결의 계단 오르기 | Luke & Angela's Stair climb |
| 누구랑 오를까? | 누구랑 오를까? | Who do you want to play as? |
| 최고 기록 | 최고 기록 | Best Record |
| m · 코인 | m · 코인 | m · Coins |
| 📱 세로로 세워서 하면 더 크게 보여요 | 📱 세로로 세워서 하면 더 크게 보여요 | 📱 Rotate to portrait for a larger view. |

### `helicopter/game.js`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 쉴드! | 쉴드! | Shield! |
| 앗, 땅이다! | 앗, 땅이다! | Oops, the ground! |
| 아야! | 아야! | Ouch! |
| 스피드! | 스피드! | Speed! |
| 화면을 터치하면 출발! | 화면을 터치하면 출발! | Tap the screen to start! |
| 스페이스 / 클릭하면 출발! | 스페이스 / 클릭하면 출발! | Press Space / Click to start! |

### `helicopter/index.html`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 누가 별 구름을 탈까? | 누구로 플레이할까요? | Who do you want to play as? |
| 꾹 누르면 위로 · 손 떼면 아래로 · 파이프를 피해 멀리 날아가요! | 꾹 누르면 위로 · 손 떼면 아래로 · 파이프를 피해 멀리 날아가요! | Hold to rise · Release to descend · Dodge the pipes and fly as far as you can! |
| m · 도착한 곳 | m · 비행 거리 | m · Distance Flown |
| 가로로 돌리면 더 크게 볼 수 있어요 ↻ | 가로로 돌리면 더 크게 볼 수 있어요 ↻ | Rotate to landscape for a larger view ↻ |

### `dogsnack/game.js`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 쌍둥이 간식 | 쌍둥이 간식 | Twin Treat |
| 두 줄 같이 | 두 줄 같이 | Both Puppies |
| 긴 소시지 | 긴 소시지 | Long Sausage |
| 하트 소시지 | 하트 소시지 | Heart Sausage |
| 둘 다 Perfect | 둘 다 Perfect | Perfect on Both |
| 양파·초콜릿 | 양파·초콜릿 | Onion · Chocolate |
| 주면 안 돼요 | 주면 안 돼요 | Don't feed these! |
| 앗! 양파는 안 돼요 | 앗! 양파는 안 돼요 | Oops! No onions! |
| 앗! 초콜릿은 안 돼요 | 앗! 초콜릿은 안 돼요 | Oops! No chocolate! |
| 간식이 노란 줄에 오면 그 강아지를 톡! | 간식이 노란 줄에 오면 그 강아지를 톡! | Tap that puppy when the treat reaches the yellow line! |
| 긴 소시지는 꾹~ 누르고 끝에서 떼요! | 긴 소시지는 꾹~ 누르고 끝에서 떼요! | Hold for long sausages and release at the end! |
| 쌍둥이 간식은 두 강아지를 같이 톡! | 쌍둥이 간식은 두 강아지를 같이 톡! | For Twin Treats, tap both puppies together! |
| 양파·초콜릿은 주면 안 돼요! | 양파·초콜릿은 주면 안 돼요! | Don't feed onions or chocolate! |

### `dogsnack/index.html`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 은유와 은결의 멍멍이 간식 타임 | 은유와 은결의 멍멍이 간식 타임 | Luke & Angela's Feed the Puppy |
| 노란 줄 | 노란 줄 | Yellow Line |
| 에 오면 그 | 에 오면 그 | When it reaches, tap that |
| 를 톡! | 를 톡! | puppy! |
| 긴 소시지는 | 긴 소시지는 | For long sausages, |
| 누르고 끝에서 떼요 | 누르고 끝에서 떼요 | hold and release at the end. |
| 면 하트 -1 · 하트가 다 없어지면 끝! | 면 하트 -1 · 하트가 다 없어지면 끝! | = Heart -1 · Game over when all hearts are gone! |
| 배부른 멍멍이들! | 배부른 멍멍이들! | Puppies Are Full! |
| 🦴 먹인 간식 | 🦴 먹인 간식 | 🦴 Treats Fed |

### `shisen/game.js`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 스테이지 | 스테이지 | Stage |
| (2층 {}개 · 3층 {}개) | (2층 {}개 · 3층 {}개) | (Layer 2: {} · Layer 3: {}) |
| (2층 {}개) | (2층 {}개) | (Layer 2: {}) |
| ×{} 판{} · 타일 {}개 · 그림 {}종 · 제한 시간 | ×{} 판{} · 타일 {}개 · 그림 {}종 · 제한 시간 | ×{} Board{} · {} Tiles · {} Designs · Time Limit |
| 선이 2번 넘게 꺾이거나 막혀 있어요 | 선이 2번보다 많이 꺾이거나 다른 타일에 막혀 있어요 | The path turns more than twice or is blocked. |
| 이을 수 있는 짝이 없어서 섞었어요! | 이을 수 있는 짝이 없어서 섞었어요! | No connectable pairs, so the tiles were shuffled! |
| 힌트가 없어요. 아이템샵에서 살 수 있어요 | 힌트가 없어요. 아이템 샵에서 살 수 있어요 | No Hints left. Get more in the Item Shop. |
| 섞기가 없어요. 아이템샵에서 살 수 있어요 | 섞기 아이템이 없어요. 아이템 샵에서 살 수 있어요 | No Shuffles left. Get more in the Item Shop. |
| 시간 추가가 없어요. 아이템샵에서 살 수 있어요 | 시간 추가 아이템이 없어요. 아이템 샵에서 살 수 있어요 | No Extra Time left. Get more in the Item Shop. |
| 💡 힌트 | 💡 힌트 | 💡 Hint |
| 🔀 섞기 | 🔀 섞기 | 🔀 Shuffle |
| ⏱ 시간 추가 | ⏱ 시간 추가 | ⏱ Extra Time |
| 💣 폭탄 | 💣 폭탄 | 💣 Bomb |
| 스테이지 클리어! | 스테이지 클리어! | Stage Clear! |
| 시간 초과! | 시간 초과! | Time's Up! |
| , 첫 클리어! | , 첫 클리어! | , First Clear! |
| (클리어 보너스 +{}{}) | (클리어 보너스 +{}{}) | (Clear Bonus +{}{}) |
| 🎁 보상 아이템: | 🎁 보상 아이템: | 🎁 Reward Item: |
| 🔍 자동 찾기 | 🔍 자동 찾기 | 🔍 Auto Match |
| 🌈 콤보 2배 | 🌈 콤보 2배 | 🌈 2× Combo |

### `shisen/index.html`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 스테이지 1-1 | 스테이지 1-1 | Stage 1-1 |
| 남은 짝 | 남은 짝 | Pairs Left |
| 은유와 은결의 사천성 | 은유와 은결의 사천성 | Luke & Angela's Mahjong Connect |
| 1-1 꽃 정원 1 | 1-1 꽃 정원 1 | 1-1 Flower Garden 1 |
| 같은 그림 2개를 선으로 이어요. | 같은 그림 2개를 선으로 이어요. | Connect two matching tiles. |
| 2번까지 꺾을 수 있고 | 2번까지 꺾을 수 있고 | The path can turn up to twice |
| , 다른 타일은 지나갈 수 없어요. | , 다른 타일은 지나갈 수 없어요. | , and can't pass through other tiles. |
| 타일 24개 · 제한 시간 2:30 | 타일 24개 · 제한 시간 2:30 | 24 Tiles · Time Limit 2:30 |
| ⏱ 클리어 시간 | ⏱ 클리어 시간 | ⏱ Clear Time |

### `shisen/levels.js`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 위아래 쌍둥이 | 위아래 쌍둥이 | Top & Bottom Pairs |
| 네 귀퉁이 | 네 귀퉁이 | Four Corners |
| 좌우 쌍둥이 | 좌우 쌍둥이 | Left & Right Pairs |
| 세 기둥 | 세 기둥 | Three Columns |

### `memory/game.js`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 찾아요! | 찾아요! | Find the Pairs! |
| 카드 {}장 ({}쌍) · 미리 보기 {}초 · 제한 시간 | 카드 {}장 ({}쌍) · 미리 보기 {}초 · 제한 시간 | {} Cards ({} Pairs) · Preview {} sec · Time Limit |
| -{}초 | -{}초 | -{} sec |
| 콤보! | 콤보! | Combo! |
| 모두 보기가 없어요. 아이템샵에서 살 수 있어요 | 모두 보기 아이템이 없어요. 아이템 샵에서 살 수 있어요 | No Reveal All items left. Get more in the Item Shop. |
| 🔍 모두 보기 | 🔍 모두 보기 | 🔍 Reveal All |
| 💥 짝 맞추기 | 💥 짝 맞추기 | 💥 Auto Match |
| 장 | 장 | Cards |
| 기억해요! | 기억해요! | Memorize! |

### `memory/index.html`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 짝 맞추기 | 짝 맞추기 | Match Pairs |
| 은유와 은결의 메모리 게임 | 은유와 은결의 메모리 게임 | Angela & Luke's Memory Match |
| 처음에 카드를 잠깐 보여 줘요. | 처음에 카드를 잠깐 보여 줘요. | The cards are briefly shown at the start. |
| 잘 기억해요! | 잘 기억해요! | Memorize them! |
| 카드 2장을 뒤집어 | 카드 2장을 뒤집어 | Flip two cards. |
| 같은 그림 | 같은 그림 | Matching cards |
| 이면 짝을 찾은 거예요. | 이면 짝을 찾은 거예요. | make a pair. |
| 틀리면 시간이 | 틀리면 시간이 | If they don't match, you lose |
| 줄어요! | 줄어요! | time! |
| 카드 6장 · 제한 시간 0:45 | 카드 6장 · 제한 시간 0:45 | 6 Cards · Time Limit 0:45 |
| 🃏 뒤집은 횟수 | 🃏 뒤집은 횟수 | 🃏 Flips |

### `mole/game.js`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 놓쳤어요! | 놓쳤어요! | Missed! |
| 하트 두더지 | 하트 두더지 | Heart Mole |
| 제한 시간 {}초 · 목표 {}점 | 제한 시간 {}초 · 목표 {}점 | Time Limit {} sec · Target {} pts |
| 한 번 더! | 한 번 더! | One More Hit! |
| ⭐ 점수 2배 | ⭐ 점수 2배 | ⭐ Double Score |
| 🌈 무지개 망치 | 🌈 무지개 망치 | 🌈 Rainbow Hammer |
| 가 없어요. 아이템샵에서 살 수 있어요 | 가 없어요. 아이템 샵에서 살 수 있어요 | is unavailable. Get more in the Item Shop. |
| 두더지가 나왔을 때 써요! | 두더지가 나왔을 때 써요! | Use it when a mole pops up! |
| 점수 2배! | 점수 2배! | Double Score! |
| 하트가 없어요! | 하트가 없어요! | No hearts left! |
| 타임 업! 클리어! | 타임 업! 클리어! | Time's Up! Stage Clear! |
| 타임 업! | 타임 업! | Time's Up! |
| 아쉬워요! | 아쉬워요! | So Close! |
| 하트를 다 잃었어요 | 하트를 다 잃었어요 | You lost all your hearts. |
| 목표 점수를 못 넘었어요 | 목표 점수에 도달하지 못했어요 | You didn't reach the target score. |
| 마리 | 마리 | Moles |
| 초 | 초 | sec |
| ⭐ 점수 2배 {}초 | ⭐ 점수 2배 {}초 | ⭐ Double Score {} sec |

### `mole/index.html`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 시간 +10초 | 시간 +10초 | Time +10 sec |
| 점수 2배 | 점수 2배 | Double Score |
| 무지개 망치 | 무지개 망치 | Rainbow Hammer |
| 은유와 은결의 두더지 게임 | 은유와 은결의 두더지 게임 | Luke & Angela's Whack-A-Mole |
| 구멍에서 튀어나오는 두더지를 | 구멍에서 튀어나오는 두더지를 | Whack the moles |
| 쳐요! 시간이 끝날 때 | 쳐요! 시간이 끝날 때 | as they pop out! When time runs out, |
| 목표 점수 | 목표 점수 | the target score |
| 를 넘으면 클리어! | 를 넘으면 클리어! | or higher to clear the stage! |
| 은유·은결을 누르면 | 은유·은결을 누르면 | If you hit Luke & Angela, |
| , 하트가 다 없어지면 실패! | , 하트가 다 없어지면 실패! | you lose a heart. Lose all your hearts and it's game over! |
| 제한 시간 30초 · 목표 1,000점 | 제한 시간 30초 · 목표 1,000점 | Time Limit 30 sec · Target 1,000 pts |
| ⭐ 점수 | ⭐ 점수 | ⭐ Score |
| 🎯 목표 점수 | 🎯 목표 점수 | 🎯 Target Score |
| 🔨 잡은 두더지 | 🔨 잡은 두더지 | 🔨 Moles Whacked |

### `darts/game.js`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 합계 {}점 | 합계 {}점 | Total {} pts |
| 가운데를 노려 봐! | 가운데를 노려 봐! | Aim for the center! |
| 할 수 있어! | 할 수 있어! | You can do it! |
| 힘내! | 힘내! | You got this! |
| 아깝다! | 아깝다! | So close! |
| 괜찮아! | 괜찮아! | No worries! |
| 다음엔 들어갈 거야! | 다음엔 들어갈 거야! | You'll nail it next time! |
| 불이다! 최고야! | 불스아이! 최고야! | Bullseye! Awesome! |
| 한가운데! 대단해! | 한가운데! 대단해! | Dead center! Amazing! |
| 트리플! 세 배야! | 트리플! 세 배야! | Triple! Three times the points! |
| 와! 세 배! | 와! 세 배! | Wow! Triple points! |
| 더블! 두 배! | 더블! 두 배! | Double! Twice the points! |
| 두 배 점수야! | 두 배 점수야! | Double points! |
| 불이야! 50점! | 불스아이! 50점! | Bullseye! 50 points! |
| 바깥 불도 50점! | 아우터 불! 50점! | Outer Bull! 50 points! |
| 좋아! | 좋아! | Nice! |
| 잘했어! | 잘했어! | Great job! |
| 라운드 {}점! | 라운드 {}점! | Round {} pts! |
| 100점 넘었어요! 코인 +5 | 100점 넘었어요! 코인 +5 | Over 100 points! +5 Coins |
| 아주 잘했어요! | 아주 잘했어요! | Excellent! |
| 좋아요! | 좋아요! | Good! |
| 다음 라운드 힘내요! | 다음 라운드 힘내요! | Go for it next round! |
| 마지막 라운드! | 마지막 라운드! | Final Round! |
| 끝까지 힘내요! | 끝까지 힘내요! | Finish strong! |
| 점! 멋져! | 점! 멋져! | points! Awesome! |
| 다트 챔피언! | 다트 챔피언! | Darts Champion! |
| 다트 실력자! | 다트 실력자! | Darts Pro! |
| 다트 끝! | 다트 게임 끝! | Darts Complete! |
| 라운드 {}점 | 라운드 {}점 | Round {} pts |
| 손 떼면 발사! | 손 떼면 발사! | Release to Throw! |
| 꾹 누르기 | 꾹 누르기 | Hold |

### `darts/index.html`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 은유와 은결의 다트 게임 | 은유와 은결의 다트 게임 | Luke & Angela's Darts |
| ① 막대 안 | ① 막대 안 | ① When the marker |
| 이 원하는 곳에 오면 | 이 원하는 곳에 오면 | reaches the spot you want, |
| ② 누르는 동안 | ② 누르는 동안 | ② while holding, |
| 과녁 표시 | 과녁 표시 | the aim marker |
| 가 위·아래로 움직여요 | 가 위·아래로 움직여요 | moves up and down. |
| 원하는 높이에서 | 원하는 높이에서 | At the height you want, |
| 손을 떼면 | 손을 떼면 | release your finger |
| 다트가 슝! | 다트가 슝! | and throw the dart! |
| 점수 ×3 | 점수 ×3 | Score ×3 |
| 점수 ×2 | 점수 ×2 | Score ×2 |
| 한 라운드에 다트 3개 · 8라운드(24개) 점수를 모두 더해요 | 한 라운드에 다트 3개 · 8라운드(24개) 점수를 모두 더해요 | 3 darts per round · Add up all scores across 8 rounds (24 darts) |
| 🎯 불 (D-BULL · S-BULL) | 🎯 불 (D-BULL · S-BULL) | 🎯 Bull (D-BULL · S-BULL) |
| ✨ 트리플 · 더블 | ✨ 트리플 · 더블 | ✨ Triple · Double |
| 🏆 가장 잘한 라운드 | 🏆 가장 잘한 라운드 | 🏆 Best Round |

### `skyhook/game.js`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 탭 / 스페이스 = 점프! | 탭 / 스페이스 = 점프! | Tap / Space = Jump! |
| 공중에서 꾹! = 훅 걸기 | 공중에서 꾹! = 훅 걸기 | Hold in midair = Hook! |
| 밟으면 무너져요! 멈추지 말고 건너요 | 밟으면 무너져요! 멈추지 말고 건너요 | It crumbles when stepped on! Keep moving! |
| 움직이는 발판! 타이밍을 맞춰요 | 움직이는 발판! 타이밍을 맞춰요 | Moving platform! Time it right. |
| 징검다리! 리듬에 맞춰 톡톡 | 징검다리! 리듬에 맞춰 톡톡 | Stepping stones! Keep the rhythm. |
| 계단! 한 칸씩 점프 | 계단! 한 칸씩 점프 | Stairs! Jump up one step at a time. |
| 앗! 다시 가자! | 앗! 다시 가자! | Oops! Try again! |
| 자석 {}초 | 자석 {}초 | Magnet {} sec |
| 코인2배 {}초 | 코인 2배 {}초 | Double Coins {} sec |
| 최고 {}m | 최고 {}m | Best {}m |

### `skyhook/index.html`

| 현재 한글 | 권장 한글 | 최종 영어 |
|---|---|---|
| 누구랑 달릴까? | 누구랑 달릴까? | Who do you want to play as? |
| · 최고 | · 최고 | · Best |
| 탭/스페이스 = 점프 · 공중에서 꾹 누르기 = 훅! · 손 떼면 슝~ | 탭/스페이스 = 점프 · 공중에서 꾹 누르기 = 훅! · 손 떼면 슝~ | Tap/Space = Jump · Hold in midair = Hook · Release = Swing! |
| 스테이지 선택 | 스테이지 선택 | Select Stage |
| 탭/스페이스 = 점프 · 공중에서 꾹 = 훅 · 손 떼면 슝~ | 탭/스페이스 = 점프 · 공중에서 꾹 = 훅 · 손 떼면 슝~ | Tap/Space = Jump · Hold in midair = Hook · Release = Swing! |

## 최종 검수에서 추가로 발견·수정한 항목

아래는 사용자가 수정한 권장 한글을 기준으로 다시 대조하면서 추가로 발견한 항목이다.

- `두 캐릭터 모두 플레이할 수 있어요.` → `두 캐릭터 중 원하는 캐릭터로 플레이할 수 있어요.`: 동시에 두 캐릭터를 플레이한다는 뜻으로 읽힐 수 있어 의미를 명확하게 했다.
- `새 게임이 곧 열려요!`의 영어가 이전 놀이기구 문구인 `New rides are coming soon!`으로 남아 있어 `New games are coming soon!`으로 수정했다.
- `같은 월드의 Easy을` → `같은 월드의 Easy를`: 조사를 수정했다.
- `준비 중이예요` → `준비 중이에요`: 맞춤법을 수정했다.
- `누구로 플레이를 할까요?` → `누구로 플레이할까요?`: 게임 UI에서 더 자연스럽고 간결하게 수정했다.
- `오늘의 베이커리 종료!` → `오늘의 베이커리 끝!`: 어린이용 게임 결과 화면에서 더 자연스러운 표현으로 되돌렸다.
- 메모리 게임 영문 타이틀에 남아 있던 `Eunyu & Eungyeol`을 문서의 영문 캐릭터명 기준인 `Angela & Luke`로 통일했다.
- 다트의 `D-BULL · S-BULL` 전체를 가리키는 영어 표기는 `Bullseye`보다 `Bull`이 정확해 `Bull`로 수정했다. 개별 중앙 적중 메시지의 `Bullseye!`는 그대로 유지했다.

### 유지했지만 구현 시 확인할 표현

- `Hard`, `Easy`, `BEST`처럼 한글 UI 안에 영어가 섞인 표현은 게임의 난이도/기록 레이블로 의도된 것으로 보고 유지했다. 한글 UI를 완전한 한국어로 통일하려면 `어려움`, `쉬움`, `최고`로 별도 일괄 변경할 수 있다.
- `분 {}초`는 자리표시자가 하나뿐이므로 영어를 `min {} sec`로 유지했다. 실제 코드에서 분 값이 앞쪽에 별도로 결합되는 구조인지 반드시 확인한다.
- `아우터 불! 50점!`은 일반적인 표준 다트 점수 체계와 다를 수 있다. Twin Gameland 자체 규칙이 50점이라면 그대로 사용하고, 표준 다트 규칙을 따를 경우 게임 로직과 문구를 함께 확인한다.

## 구현 주의

- 한국어는 `은(는)`, `을(를)`, `이(가)` 같은 조사가 동적 이름 뒤에 붙지만 영어에는 대응 조사가 없다. 영어 로케일에서 한국어 문자열 조각을 단순 치환하지 말고 완성 문장 템플릿을 사용한다.
- `분 {}초`, `의 기록`, `에게 {}을(를)...`, `을(를) 샀어요!`처럼 앞뒤 문자열과 결합되는 항목은 실제 코드에서 결합 순서를 확인한다.
- `분 {}초`의 영어는 자리표시자를 늘리지 않기 위해 `min {} sec`로 매칭했다. 앞에 분(minute) 값이 별도 문자열/값으로 붙는 구조인지 코드에서 확인한다.
- 영어는 한국어보다 길어질 수 있으므로 버튼/카드 영역은 자동 줄바꿈 또는 최소 폭을 확인한다.
- 캐릭터 이름의 영문 표기는 이 문서에서 `Angela`, `Luke`로 통일한다. 한글은 은유(여자), 은결(남자) 순서로 나오고 영어는 Luke(남자), Angela(여자) 순서로 나온다
