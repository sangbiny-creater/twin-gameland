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
}
# 문서 뒤에 새로 생긴 글 (2026-11-04 작업)
EXTRA = {
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
