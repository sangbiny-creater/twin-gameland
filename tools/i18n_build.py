"""한국어/영어 다국어 표 만들기 → common/i18n_data.js
  python3 tools/i18n_build.py
  · 기준: docs/Twin_Gameland_KO_EN_Localization_5th_Final_Review_for_Claude.md 의 표 (현재 한글 | 권장 한글 | 최종 영어)
  · 표의 글은 번역 목록 모양(앞뒤 {} 를 뺀 것)이라, 코드에서 실제로 화면에 나오는 모양(tools/i18n_extract.py 의 full)을 찾아 앞뒤 {} 를 다시 붙임
    - 한국어판: 현재 한글 ≠ 권장 한글이면 권장 한글로 (코드 모양의 그 부분만 바꿈)
    - 영어판: 최종 영어. 앞의 {} 는 '{} 영어', 뒤의 {} 는 '영어 {}' 로 붙임
    - 조사(은(는)·을(를)·이(가)·(으)로·의·에게)가 이름 뒤에 붙는 문장은 아래 WHOLE 에 영어 완성 문장으로 따로 적음 ({0}{1}… 은 자리 순서)
  · 문서 뒤에 새로 생긴 글은 EXTRA 에 (한국어 그대로, 영어) 로 적음
  · 화면에 적용은 common/i18n.js (글자 칸·속성·캔버스 글자를 바꿈)
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import i18n_extract as X  # noqa: E402

MD = f'{ROOT}/docs/Twin_Gameland_KO_EN_Localization_5th_Final_Review_for_Claude.md'
OUT = f'{ROOT}/common/i18n_data.js'

# 조사가 붙는 문장: 코드 모양(앞뒤 {} 포함) → 영어 완성 문장
WHOLE = {
    '광고보고 다이아 {}개 ({}/{})': 'Watch ad: {0} Diamonds ({1}/{2})',
    '{}일': 'Day {0}',
    '선물 {}종류 · 카트 {}대{}': '{0} gift types · {1} carts{2}',
    '카트를 {}대 더 완성하면 리본이 풀려요!': 'Complete {0} more cart to untie the ribbon!',
    '{}대': '{0}',
    '🎁 보상 아이템: 💡 힌트 +{}': '🎁 Reward: 💡 Hint +{0}',
    '다이아가 {}개 모자라요!': 'You need {0} more Diamonds!',
    '{}을(를) 입었어요!': 'You put on {0}!',
    '지금 {}장 있어요': 'You have {0}',
    '{}일 남음': '{0} days left',
    '다이아 {}': '{0} Diamonds',
    '+{} 획득': '+{0} Earned',
    '{}일차': 'Day {0}',
    '다이아 {}개로 열기': 'Unlock with {0} Diamonds',
    '{} 적용! 첫 화면의 {}이(가) 바뀌어요': '{0} applied! The {1} on the home screen has changed.',
    '{}(으)로 바꿨어요!': 'Changed to {0}!',
    '{}에게 {}을(를) 사서 입힐까요? / {} {} 코인': 'Buy {1} for {0}? / {2} {3} Coins',
    '{}은(는) 곧 나와요!': '{0} is coming soon!',
    '{}을(를) 살까요? / {} 다이아 {}개': 'Buy {0}? / {1} {2} Diamonds',
    '{}을(를) 샀어요!': 'Purchased {0}!',
    "{}을(를) 샀어요! '적용하기'를 누르면 첫 화면에 놓여요": "Purchased {0}! Tap 'Apply' to place it on the home screen.",
    '{}을(를) 입었어요! 모든 게임에 적용돼요': 'Now wearing {0}! It appears in all games.',
    '{}의 기록': "{0}'s Records",
    '{}분 {}초': '{0} min {1} sec',
    # 앞에 이름·숫자가 붙어 영어 어순이 달라지는 문장
    '{} 바꾸기': 'Change {0}',
    '{}판부터 시작': 'Start from Round {0}',
    '{} 1개를 살까요?': 'Buy 1 {0}?',
    '{} 캐릭터를 지울까요?': 'Delete {0}?',
    '{}라운드 {}점!': 'Round {0}: {1} pts!',
    '{}라운드 {}점': 'Round {0}: {1} pts',
    '{}×{} 판{} · 타일 {}개 · 그림 {}종 · 제한 시간 {}': '{0}×{1} Board{2} · {3} Tiles · {4} Designs · Time Limit {5}',
    '{}: 다음 게임부터 사용해요': '{0}: Use from the next game',
    '{}: 안 쓰고 아껴 둘게요': '{0}: Save for later',
    '{}: 사용하지 않고 보관해요': '{0}: Save for later',
    '{} 다이아 {}개로 열기{}': '{0} Unlock for {1} Diamonds{2}',
    '오늘의 선물: {} 다이아 {}개{}': "Today's Reward: {0} {1} Diamonds{2}",
    '{} 콤보! ×{}': '{0} Combo! ×{1}',
    '{}콤보!': '{0} Combo!',
    '2배 받기 +{}': 'Claim 2× +{0}',
    # 버거 러시 (2026-11-08)
    '손님 {}명 · 재료 {}가지{}': '{0} guests · {1} ingredients{2}',
    '{}은(는) 이미 있어요': '{0} is already on the tray',
    '+{} 팁!': '+{0} Tip!',
    '{}명': '{0}',
}
# 문서 뒤에 새로 생긴 글 (2026-11-04 작업)
EXTRA = {
    # 주간 랭킹 (2026-11-10)
    '주간': 'Weekly', '전체': 'All-time', '지금은 예시 순위예요 (서버 연결 전)': 'Sample rankings for now (before server connection)',
    # 버거 러시 (2026-11-08)
    '버거 러시': 'Burger Rush', '햄버거 골목': 'Burger Alley', '양상추 농장': 'Lettuce Farm', '토마토 언덕': 'Tomato Hill', '양파 들판': 'Onion Fields',
    '베이컨 캠핑장': 'Bacon Campground', '바닷가 버거 트럭': 'Seaside Burger Truck', '감자튀김 성': 'French Fry Castle', '탄산 분수 공원': 'Fizzy Fountain Park',
    '별빛 드라이브': 'Starlight Drive', '아이스크림 왕국': 'Ice Cream Kingdom',
    '빵': 'Bun', '아래 빵': 'Bottom bun', '위 빵': 'Top bun', '패티': 'Patty', '생패티': 'Raw patty', '치즈': 'Cheese', '양상추': 'Lettuce', '토마토': 'Tomato',
    '양파': 'Onion', '베이컨': 'Bacon', '콜라': 'Cola', '사이다': 'Soda', '감자튀김': 'Fries', '치킨너겟': 'Nuggets', '아이스크림': 'Ice cream',
    '생패티를 눌러 구워요! 초록이 되면 눌러서 쟁반에 올려요': 'Tap a raw patty to cook it! When it turns green, tap it to put it on the tray.',
    '음료도 주문해요! 말풍선을 잘 봐요': 'Guests order drinks too! Check the speech bubble.',
    '패티를 너무 오래 두면 타요! 빨개지기 전에 눌러요': 'Patties burn if left too long! Tap before the bar turns red.',
    '쟁반이 2개! 쟁반을 눌러 골라요': 'Two trays! Tap a tray to choose it.',
    '패티 2장 버거가 나와요! 말풍선을 눌러 보세요': 'Double-patty burgers are here! Tap a bubble to check.',
    '아이스크림이 새로 나왔어요!': 'Ice cream is new on the menu!',
    '소스': 'Sauce', '소스가 새로 나왔어요!': 'Sauce is new on the menu!',
    '손님 말풍선을 누르면 재료를 크게 볼 수 있어요': "Tap a guest's bubble to see the ingredients up close.",
    '버거가 완성됐어요. 주문과 다르면 쓰레기통을 눌러요': "The burger is done. If it doesn't match, tap the trash can.",
    '더 쌓을 수 없어요': "Can't stack any more", '굽는 판이 꽉 찼어요': 'The grill is full', '사이드는 3개까지예요': 'Up to 3 sides',
    '아직 굽는 중이에요': 'Still cooking', '탄 패티는 버렸어요': 'Threw away the burnt patty',
    '주문과 달라요! 말풍선을 다시 봐요': "That's not the order! Check the bubble again.",
    '사이드 메뉴도 담아요!': 'Add the sides too!', '사이드가 달라요! 쓰레기통으로 비워요': 'Wrong sides! Empty the tray with the trash can.',
    '영업 끝! 클리어!': 'Closing time! Clear!', '화난 손님이 너무 많았어요': 'Too many guests left angry',
    '손님': 'Guests', '주문 보기': 'Order', '🍔 받은 손님': '🍔 Guests served', '💢 화나서 간 손님': '💢 Guests left angry',
    '폰을 가로로 돌려 주세요': 'Please turn your phone sideways',
    '손님 주문대로 버거를 쌓아 내줘요! 손님이 화나서 떠나면 하트 -1': 'Stack burgers just like the orders! If a guest leaves angry, you lose a heart.',
    '하트 -1': 'Heart -1',
    # 버거 러시 새 화면 (2026-11-10)
    '주스': 'Juice', '버리기': 'Trash', '패티를 눌러 구워요! 초록이 되면 눌러서 접시에 올려요': 'Tap a patty to cook it! When it turns green, tap it to put it on the plate.',
    '말풍선 버거를 꾹 누르면 재료를 크게 볼 수 있어요': 'Press and hold a burger in a bubble to see its ingredients.',
    '접시를 눌러 고르면 버거 2개를 같이 만들 수 있어요': 'Tap a plate to pick it, and make two burgers at once!',
    '패티 2장 버거가 나와요! 말풍선 버거를 꾹 눌러 보세요': 'Double-patty burgers are here! Press and hold a bubble burger to check.',
    '버거가 완성됐어요. 주문과 다르면 버리기를 눌러요': "The burger is done. If it doesn't match, tap Trash.",
    '사이드가 달라요! 버리기로 비워요': 'Wrong sides! Empty the plate with Trash.',
    '아직 안 나오는 메뉴예요': 'Not on the menu yet', '빈 접시가 없어요': 'No empty plate', '아래 빵부터 놓아요': 'Put the bottom bun first',
    # 선물가게 정리 (2026-11-08)
    '선물가게 정리': 'Gift Sort', '장난감 거리': 'Toy Street', '꽃집 정원': 'Flower Shop Garden', '사탕 과자점': 'Candy Shop',
    '바닷가 기념품점': 'Seaside Souvenirs', '눈꽃 선물마을': 'Snowflake Gift Village', '숲속 나무공방': 'Forest Workshop', '별빛 야시장': 'Starlight Night Market',
    '구름 풍선가게': 'Cloud Balloon Shop', '리본 공장': 'Ribbon Factory', '황금 선물궁전': 'Golden Gift Palace',
    '깜짝 상자': 'Mystery Box', '리본 카트': 'Ribbon Cart', '황금 선물': 'Golden Gift',
    '더 옮길 수 없어요! 되돌리기나 다시하기를 눌러요': 'No more moves! Tap Undo, or Retry from the pause menu.',
    '리본이 풀렸어요! 이제 이 카트도 쓸 수 있어요': 'The ribbon is untied! You can use this cart now.',
    '되돌릴 게 없어요': 'Nothing to undo', '되돌리기를 다 썼어요. 일시정지에서 다시하기를 해 볼까요?': 'No undos left. Retry from the pause menu?',
    '힌트가 없어요. 시작할 때 힌트 아이템을 고를 수 있어요': 'No hints left. You can pick a Hint item before you start.',
    '이대로는 풀기 어려워요. 되돌리기를 해 봐요!': 'This one looks stuck. Try Undo!',
    '카트 추가 아이템이 없어요. 시작할 때 고를 수 있어요': 'No Add Cart items. You can pick one before you start.',
    '이번 판 되돌리기 +5번': '+5 Undos this stage', '선물 1개를 놓을 수 있는 작은 카트를 놓아요': 'Adds a small cart that holds 1 gift',
    '남은 카트': 'Carts left', '되돌리기': 'Undo', '카트 추가': 'Add Cart',
    '같은 선물끼리 카트에 4개씩 모아요!': 'Sort 4 matching gifts into each cart!',
    '📦 옮긴 횟수': '📦 Moves', '🛒 완성한 카트': '🛒 Carts done',
    '카트를 눌러 선물을 들고, 같은 선물 위나 빈 카트를 눌러 옮겨요!': 'Tap a cart to pick up a gift, then tap a matching gift or an empty cart!',
    '물음표 상자는 맨 위가 되면 무슨 선물인지 보여요!': 'A ? box shows its gift when it reaches the top!',
    '리본 카트는 다른 카트를 하나 완성하면 풀려요!': 'Complete one cart to untie the ribbon cart!',
    '별 3개! 클리어!': '3 Stars! Clear!',
    '구글로 로그인': 'Log in with Google',
    '이메일로 로그인': 'Log in with email',
    '가입하기': 'Sign up',
    '비밀번호 재설정': 'Reset password',
    '처음 오셨네요! 가입 절차를 먼저 할게요.': "Welcome! Let's sign you up first.",
    '가입 완료! 구글 계정으로 로그인했어요.': 'Signed up! Logged in with Google.',
    '년': 'Year',
    '월': 'Month',
    '일': 'Day',
    '년·월·일을 모두 골라 주세요': 'Please choose year, month and day',
    '약관 동의': 'Agreements',
    '전체 동의': 'Agree to all',
    '[필수]': '[Required]',
    '개인정보 수집·이용 동의': 'Consent to collect and use personal data',
    '보기': 'View',
    '모으는 것: 이메일 주소 하나\n쓰는 곳: 계정 만들기, 게임 기록·구매 내역 보관\n보관 기간: 계정을 지울 때까지 (생년월일은 저장하지 않아요)': 'We collect: your email address only\nUsed for: creating your account, keeping game records and purchases\nKept until: you delete your account (we never store your birth date)',
    '필수 항목에 모두 동의해 주세요': 'Please agree to all required items',
    '어떤 계정으로 가입할까요?': 'Which account would you like to sign up with?',
    '구글로 가입하기': 'Sign up with Google',
    '이메일로 가입하기': 'Sign up with email',
    '비밀번호 재설정은 준비 중이에요.\n메일 보내는 서버를 올리면 열려요.': 'Password reset is coming soon.',
    '이메일 가입은 준비 중이에요.\n지금은 구글로 가입하거나 게스트로 입장해 주세요!': 'Email sign-up is coming soon.\nPlease sign up with Google or play as a guest for now!',
    '이메일 가입은 준비 중이에요.\n지금은 구글로 시작하거나 게스트로 입장해 주세요!': 'Email sign-up is coming soon.\nPlease continue with Google or play as a guest!',
    '비밀번호 재설정은 준비 중이에요': 'Password reset is coming soon',
    '은유와 은결': 'Eunyu & Eungyeol',
    '계정 연동': 'Link Account',
    '구글로 시작하기': 'Continue with Google',
    '이메일로 시작하기': 'Continue with Email',
    '게스트로 입장하기': 'Play as Guest',
    '이메일로 가입했어요 (로그인)': 'I have an email account (Log in)',
    '로그인하면 다른 기기에서도 이어서 할 수 있어요!': 'Log in to continue on any device!',
    '지금까지 한 기록을 그대로 가지고 계정에 연결해요.': 'Your progress so far moves to your account.',
    '게스트는 결제를 할 수 없어요.': 'Guests cannot make purchases.',
    '시작하면': 'By starting, you agree to the',
    '이용약관': 'Terms of Service',
    '과': ' and the',
    '개인정보 처리방침': 'Privacy Policy',
    '에 동의하게 돼요.': '.',
    '생년월일': 'Date of Birth',
    '나이 확인에만 쓰고 저장하지 않아요.': 'Used only to check your age. Not saved.',
    '생년월일을 넣어 주세요': 'Please enter your date of birth',
    '만 14세 미만은 보호자 동의가 필요해서 아직 가입할 수 없어요. 게스트로 즐겨 주세요!': "Players under 14 need a guardian's consent, so you cannot sign up yet. Please play as a guest!",
    '이메일로 인증번호 6자리를 보내 드려요.': 'We will email you a 6-digit code.',
    '인증번호 받기': 'Get Code',
    '이메일을 다시 확인해 주세요': 'Please check your email address',
    '인증번호': 'Verification Code',
    '메일로 온 6자리를 넣어 주세요 (10분 안에).': 'Enter the 6-digit code from the email (within 10 minutes).',
    '다시 보내기': 'Resend',
    '6자리 숫자를 넣어 주세요': 'Please enter 6 digits',
    '다시 보냈어요': 'Sent again',
    '비밀번호 정하기': 'Set Password',
    '다음부터는 이메일과 이 비밀번호로 들어와요. (8자 이상)': 'Next time, log in with your email and this password. (8+ characters)',
    '비밀번호': 'Password',
    '한 번 더': 'Confirm',
    '8자 이상으로 정해 주세요': 'Use 8 or more characters',
    '두 비밀번호가 달라요': 'The passwords do not match',
    '이메일 로그인': 'Email Login',
    '로그인': 'Log In',
    '비밀번호를 잊었어요 (재설정)': 'Forgot password (Reset)',
    '비밀번호 재설정': 'Reset Password',
    '이메일 또는 비밀번호가 맞지 않아요': 'Wrong email or password',
    '계정': 'Account',
    '게스트': 'Guest',
    '구글 계정': 'Google Account',
    '이메일 계정': 'Email Account',
    '로그아웃': 'Log Out',
    '계정 삭제 요청': 'Request Account Deletion',
    '로그아웃했어요': 'Logged out',
    '계정연동이 필요합니다.': 'Account linking required.',
    '게스트는 결제를 할 수 없어요.\n구글이나 이메일 계정을 연동하면 결제할 수 있어요. (광고 보기는 지금도 돼요)': 'Guests cannot make purchases.\nLink a Google or email account to buy. (You can still watch ads.)',
    '계정 연동하기': 'Link Account',
    '구글': 'Google',
    '이메일': 'Email',
    '구글 계정으로 로그인했어요!': 'Logged in with Google!',
    '로그인했어요!': 'Logged in!',
    '준비 끝! 이메일 계정으로 로그인했어요.': 'All set! Logged in with your email account.',
    '구글·이메일 로그인은 준비 중이에요.\n지금은 게스트로 입장해 주세요!': 'Google and email login are coming soon.\nPlease play as a guest for now!',
    '안내': 'Notice',
    '이용이 제한된 계정이에요.': 'This account is restricted.',
    '지금은 점검 중이에요. 잠시 뒤에 다시 와 주세요!': 'We are under maintenance. Please come back soon!',
    '보내는 중...': 'Sending...',
    # 옷장·아이템샵 새 구성 (2026-11-07, Claude 번역 — 사용자 확인 필요)
    '상점': 'Shop', '꾸미기': 'Decorate', '다이아 구매': 'Diamonds', '출석 보상': 'Attendance Reward', '오늘의 무료 다이아': 'Free Diamonds', '광고보기': 'Watch Ad',
    '놀이공원 꾸미기': 'Park Decorations',
    '앱에서는 여기서 구글 결제 창이 떠요 (값은 임시). 지금은 진짜 결제가 없어요.': 'In the app, Google Play payment opens here (prices are temporary). No real payment right now.',
    '첫 구매 2배': 'First Purchase ×2', '인기': 'Popular', '구매함': 'Purchased', '가지고 있어요': 'Owned', '착용 중': 'Wearing', '착용하기': 'Wear', '기본 옷': 'Default Outfit', '옷 구매': 'Buy Outfit',
    '게임랜드 유니폼': 'Gameland Uniform', '데이트룩': 'Date Look', '캐주얼룩': 'Casual Look', '학교풍룩': 'School Look', '여행룩': 'Travel Look', '토끼 잠옷': 'Bunny Pajamas', '겨울옷': 'Winter Outfit', '베이커리 옷': 'Bakery Outfit',
    '스트리머 룩': 'Streamer Look', '데일리룩': 'Daily Look', '캠퍼스룩': 'Campus Look', '운동복': 'Sportswear', '홈웨어': 'Homewear',
    '다운힐 러너가 천천히 가요': 'Downhill Runner goes slower', '달콤 베이커리가 천천히 가요': 'Sweet Bakery goes slower', '쿠폰 입력하기': 'Enter Coupon', '아이템 구매': 'Buy Item',
    '광고 보고': 'Watch Ad',
    '캐릭터 선택': 'Select Character',
    '함께 떠날 캐릭터를 선택해 주세요!': 'Choose your character!',
    '잠겨 있는 게임이에요!': 'This Game Is Locked!',
    '이 게임을 열고 더 많은 즐거움을 만나 보세요!': 'Unlock this game for more fun!',
    '열쇠 1개로 열기': 'Unlock with 1 Key',
    '한 번 열면 언제든지 계속 할 수 있어요!': 'Once unlocked, you can play any time!',
    '출석 체크': 'Daily Check-in',
    '최고 기록 달성!': 'New Best Record!',
    '일시정지': 'Paused',
    'v0.4 상용화 검수판': 'v0.4 Release Review Build',
    'v0.3 (어린이 캐릭터)로 가요!': 'Go to v0.3 (kid characters)!',
    'v0.4 (최신 버전)으로 가요!': 'Go to v0.4 (latest version)!',
    '놀이기구는 놀이기구끼리, 장식은 장식끼리만 바꿀 수 있어요': 'Rides can only swap with rides, and decorations with decorations.',
    '타일 자리를 섞어요': 'Shuffles the tiles',
    '적용 중': 'Equipped',
    '첫 화면에서': 'On Home Screen',
    '동상은 첫 화면에서 바꿔요! / 첫 화면의 동상을 누르면 가진 동상 중에서 골라 놓을 수 있어요.': 'Change statues on the home screen! / Tap a statue there to choose one you own.',
    '섞기': 'Shuffle',
    '은유': 'Angela', '은결': 'Luke',
    '동상은 첫 화면에서 바꿔요!': 'Change statues on the home screen!',
    '첫 화면의 동상을 누르면 가진 동상 중에서 골라 놓을 수 있어요.': 'Tap a statue there to choose one you own.',
    # 문서 표에 없던 한 낱말들 (번역 목록을 뽑을 때 빠졌던 것, Claude 번역 — 사용자 확인 필요)
    '소리': 'Sound', '언어': 'Language', '설정': 'Settings', '편집': 'Edit', '이름표': 'Nameplate', '처음대로': 'Reset', '완료': 'Done', '쉬움': 'Easy', '어려움': 'Hard',
    '닫기': 'Close', '켜짐': 'On', '꺼짐': 'Off', '아이템샵': 'Item Shop', '정말요?': 'Really?', '삭제': 'Delete', '뒤로': 'Back',
    '사천성': 'Mahjong Connect', '다트게임': 'Darts', '옷장': 'Wardrobe', '매표소': 'Ticket Booth', '장식': 'Decoration', '별': 'Star', '스카이훅': 'Skyhook', '실패': 'Failed', '하늘타기': 'sky rider',
    '하트': 'Heart', '보호막': 'Shield', '슬로우': 'Slow', '힌트': 'Hint', '폭탄': 'Bomb', '메인으로': 'Main Menu', '다시하기': 'Retry', '계속하기': 'Continue', '확인': 'OK', '사기': 'Buy', '일시정지': 'Paused',
    '원': 'KRW', '받기': 'Claim', '이어하기': 'Continue', '지도로': 'To Map', '나가기': 'Exit', '출석하기': 'Check In',
    '하늘도시': 'Sky City', '겨울왕국': 'Winter Kingdom', '벚꽃마을': 'Cherry Blossom Village', '구름왕국': 'Cloud Kingdom', '바닷속도시': 'Undersea City', '마법숲': 'Magic Forest', '별빛우주': 'Starlight Space', '황금성': 'Golden Castle', '놀이공원': 'Amusement Park', '숲속마을': 'Forest Village',
    '한복': 'Hanbok', '우비': 'Raincoat', '잠옷': 'Pajamas', '로마병사': 'Roman Soldier', '츄리닝': 'Tracksuit', '교복': 'School Uniform', '수영복': 'Swimsuit', '산타클로스': 'Santa Claus', '야구복': 'Baseball Uniform', '정장': 'Suit',
    '동상': 'Statue', '토끼': 'Bunny', '무지개': 'Rainbow', '특별': 'Special', '기본': 'Default', '꽃': 'Flower', '분수': 'Fountain', '대문': 'Gate', '로고': 'Logo', '친구': 'Friend',
    '이전': 'Previous', '다음': 'Next', '입기': 'Wear', '입력': 'Enter', '구매': 'Buy', '아이템': 'Items', '사용중': 'In Use', '보유': 'Owned', '핑크': 'Pink', '블루': 'Blue', '구매하기': 'Buy',
    '무적': 'Invincible', '자석': 'Magnet', '2배': '×2', '점프하기': 'Jump', '점프': 'Jump', '컵케이크': 'Cupcake', '금빛': 'Golden', '앗': 'Oops', '놓쳤어요': 'Missed', '꾹': 'Hold', '떼기': 'Release', '콤보': 'Combo',
    '쉴드': 'Shield', '스피드': 'Speed', '거리': 'Distance', '코인': 'Coins', '아리': 'Ari', '콩이': 'Kongi', '포미': 'Pomi', '뼈다귀': 'Bone', '강아지': 'Puppy',
    '가운데': 'Center', '십자': 'Cross', '고리': 'Ring', '마름모': 'Diamond Shape', '일반': 'Normal', '빠른': 'Fast', '2대': '2 Hits', '합계': 'Total', '라운드': 'Round', '누르기': 'Press', '트리플': 'Triple', '더블': 'Double', '홈으로': 'Home',
    '30초': '30 sec', '50점': '50 pts', '점': 'pts',
    # 꾸밈 글씨(<b>)로 조각난 안내 문장은 문장째로
    '같은 그림 2개를 선으로 이어요. / 선은 2번까지 꺾을 수 있고, 다른 타일은 지나갈 수 없어요.': 'Connect two matching tiles. / The path can turn up to twice, and can\'t pass through other tiles.',
    '빵이 노란 자리에 오면 화면을 톡! / 긴 빵은 꾹~ 누르고 있다가 끝에서 떼요 / Bad(놓침·함정)면 하트 -1 · 하트 2개로 시작, 다 없어지면 끝! / 긴 빵 위 하트는 시작·끝 모두 Perfect면 +1 (최대 3개)': 'Tap when a pastry reaches the Yellow Zone! / For long pastries, hold and release at the end. / Bad (miss or trap) = Heart -1 · Start with 2 hearts; game over when they\'re gone! / For hearts on long pastries, get Perfect at both start and end to gain +1 (max 3).',
    '처음에 카드를 잠깐 보여 줘요. 잘 기억해요! / 카드 2장을 뒤집어 같은 그림이면 짝을 찾은 거예요. / 틀리면 시간이 조금 줄어요!': 'The cards are briefly shown at the start. Memorize them! / Flip two cards; matching cards make a pair. / If they don\'t match, you lose a little time!',
    '구멍에서 튀어나오는 두더지를 톡톡 쳐요! 시간이 끝날 때 목표 점수를 넘으면 클리어! / 두더지를 놓치거나 은유·은결을 누르면 하트 -1, 하트가 다 없어지면 실패!': 'Whack the moles as they pop out! Reach the target score before time runs out to clear the stage! / If you miss a mole or hit Luke or Angela, you lose a heart. Lose all your hearts and it\'s game over!',
    '간식이 노란 줄에 오면 그 강아지를 톡! / 긴 소시지는 꾹~ 누르고 끝에서 떼요 / Bad면 하트 -1 · 하트가 다 없어지면 끝!': 'Tap the puppy when its treat reaches the Yellow Line! / For long sausages, hold and release at the end. / Bad = Heart -1 · Game over when all hearts are gone!',
    '① 막대 안 점이 원하는 곳에 오면 꾹 누르기 / ② 누르는 동안 과녁 표시가 위·아래로 움직여요 / 원하는 높이에서 손을 떼면 다트가 슝!': '① Hold when the marker reaches the spot you want. / ② While holding, the aim marker moves up and down. / Release at the height you want to throw the dart!',
}


def rows():
    md = open(MD, encoding='utf-8').read()
    out = []
    for m in re.finditer(r'^\| (.+?) \| (.+?) \| (.+?) \|$', md, re.M):
        a, b, c = (x.strip() for x in m.groups())
        if a in ('현재 한글', '---') or set(a) <= set('-'): continue
        out.append((a, b, c))
    return out


def adapt_en(full, part, en):
    """코드 모양 full 안의 part 를 영어 en 으로. 앞뒤에 붙은 {} 는 띄어서 붙임"""
    i = full.find(part)
    if i < 0: return None
    pre, post = full[:i], full[i + len(part):]
    pre = re.sub(r'\s+$', '', pre); post = re.sub(r'^\s+', '', post)
    return (pre + ' ' if pre else '') + en + (' ' + post if post else '')


def main():
    R = rows()
    _, ALL = X.pieces(ROOT)
    fulls = {}
    for _, part, full in ALL: fulls.setdefault(part, set()).add(full)
    ko, en, seen_en = [], [], set()

    def add(lst, a, b, seen=None):
        if a == b or not X.HANGUL.search(a): return
        if seen is not None:
            if a in seen: return
            seen.add(a)
        lst.append([a, b])

    for full, e in WHOLE.items(): add(en, full, e, seen_en)
    for cur, rec, e in R:
        forms = fulls.get(cur, {cur}) | ({cur} if cur not in fulls else set())
        for full in sorted(forms):
            if full in WHOLE: continue
            if rec != cur:
                ko.append([full, full.replace(cur, rec, 1)])
            add(en, full, adapt_en(full, cur, e) or e, seen_en)
            # 한국어판에서 권장 한글로 바뀐 모양도 영어로
            if rec != cur: add(en, full.replace(cur, rec, 1), adapt_en(full, cur, e) or e, seen_en)
        # 앞뒤 {} 가 그림·다른 칸으로 떨어져 화면 글이 표 모양 그대로인 경우도
        add(en, cur, e, seen_en)
        if rec != cur: add(en, rec, e, seen_en)
        if rec != cur and [cur, rec] not in ko: ko.append([cur, rec])
    for k, e in EXTRA.items():
        for full in sorted(fulls.get(k, {k})): add(en, full, adapt_en(full, k, e) or e, seen_en)
    ko = [p for p in ko if p[0] != '어려움']  # 지도 쉬움/어려움 버튼은 한국어판에서 한글로 (2026-11-07 시안)
    js = ('// 자동 생성: python3 tools/i18n_build.py (기준 docs/Twin_Gameland_KO_EN_Localization_5th_Final_Review_for_Claude.md) — 손으로 고치지 말고 표·tools/i18n_build.py 를 고치기\n'
          'window.I18N_DATA = ' + json.dumps({'ko': ko, 'en': en}, ensure_ascii=False, indent=0) + ';\n')
    open(OUT, 'w', encoding='utf-8').write(js)
    print(f'ko {len(ko)} · en {len(en)} → {os.path.relpath(OUT, ROOT)}')
    # 검사: {} 개수 (WHOLE 은 {0}… 개수)
    bad = []
    for a, b in en:
        na = a.count('{}'); nb = b.count('{}') + len(set(re.findall(r'\{\d\}', b)))
        if na != nb: bad.append((a, b))
    print('{} 개수 다른 것', len(bad))
    for a, b in bad[:40]: print('  ', a, '→', b)


if __name__ == '__main__':
    main()
