"""버거 러시(burger) 그림 적용 — 받은 GPT 그림(character/burger/, 저장소에 안 올림)을 잘라 게임 그림으로
  python3 tools/burger_assets.py            # 전부
  python3 tools/burger_assets.py intro      # 인트로·카드·준비 창 로고 (한국어·영어)
  python3 tools/burger_assets.py play       # 가게 배경·장비·재료·사이드·아이콘·효과
  python3 tools/burger_assets.py guests     # 손님 8명 × 표정 3
  python3 tools/burger_assets.py chars      # 은유·은결 상반신 4자세 × 옷 9벌
  python3 tools/burger_assets.py map        # 스테이지 지도 배경 10장
  python3 tools/burger_assets.py ride       # 첫 화면 놀이기구
요청 글: making_GPT/버거러시/ (00_전체안내.txt)
"""
import os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import adult_assets as A  # 초록 지우기·자르기·저장·인트로 합치기
import giftsort_assets as GS  # 바깥 초록만 지우기·칸 자르기·한 줄 시트 나누기

ROOT = A.ROOT
SRC = f'{ROOT}/character/burger'
OUTFITS = GS.OUTFITS
POSES = ['idle', 'oops', 'happy', 'cheer']
GUESTS = ['bear', 'rabbit', 'cat', 'puppy', 'panda', 'penguin', 'fox', 'raccoon']


def src(p): return f'{SRC}/{p}.png'


def intro():
    A.SRC = SRC
    A.GAMES = {'burger': ('basic', (.5, .76, .80), (.5, .03, .40), .14)}
    A.intro()


KEEP_GREEN = {'lettuce'}  # 초록이 들어 있는 그림: 바깥과 이어진 초록만 지움 (나머지는 양파 고리 안쪽처럼 갇힌 초록까지 지움)


def save_grid(name, cols, rows, names, size, folder):
    full, outer = A.key(src(name), soft=False), GS.key_out(src(name))
    w, h = full.width / cols, full.height / rows
    for k, n in enumerate(names):
        if not n: continue
        r, c = divmod(k, cols); box = (round(c * w), round(r * h), round((c + 1) * w), round((r + 1) * h))
        im = A.tight(GS.drop_far(A.tight((outer if n in KEEP_GREEN else full).crop(box)), gap=40))
        A.save(A.scaled(im, size / max(im.size)), f'burger/assets/{folder}/{n}.webp')


def play():
    for n, name in [('P01', 'land'), ('P02', 'land_night')]:
        im = Image.open(src(f'play/{n}')).convert('RGB')
        A.save(im.resize((1536, 1024), Image.LANCZOS), f'burger/assets/bg/{name}.webp', quality=84, method=6)
    save_grid('play/K01', 1, 1, ['grill'], 720, 'ui')
    save_grid('play/K02', 2, 2, ['machine_drink', 'machine_fry', 'machine_ice', 'trash'], 300, 'ui')
    save_grid('play/K03', 2, 2, ['bin', 'tray', 'cover', 'plate'], 300, 'ui')
    # 재료 조각은 모두 같은 폭 기준(최대 변 320)으로 — 쌓을 때 코드가 폭을 맞춤
    save_grid('play/I01', 2, 2, ['bun_b', 'bun_t', 'lettuce', 'tomato'], 320, 'food')
    save_grid('play/I02', 2, 2, ['onion', 'cheese', 'bacon', 'paper'], 320, 'food')
    save_grid('play/I03', 2, 2, ['patty_raw', 'patty_cook', 'patty', 'patty_burnt'], 320, 'food')
    save_grid('play/I04', 2, 2, ['cola', 'cider', 'fries', 'nuggets'], 240, 'food')
    save_grid('play/I05', 2, 2, ['icecream', 'cup', 'fry_box', 'bag'], 240, 'food')
    save_grid('play/U01', 2, 2, ['bubble', 'rotate', 'tip', 'recipe'], 320, 'ui')
    save_grid('play/E01', 3, 2, ['steam', 'smoke', 'spark', 'heart', 'sweat', 'check'], 120, 'fx')
    print('play')


def guests():
    for i, gid in enumerate(GUESTS):
        p = src(f'guest/M{i + 1:02d}')
        cs = GS.cuts_row(GS.key_out(p, T=110, W=50), n=3, look=A.key(p))
        s = 300 / max(c.height for c in cs)
        for pose, cut in zip(['wait', 'angry', 'happy'], cs):
            q = A.scaled(cut, s); c = Image.new('RGBA', (320, 320)); c.alpha_composite(q, ((320 - q.width) // 2, 320 - q.height))
            A.save(c, f'burger/assets/guests/{gid}_{pose}.webp')
    print('guests')


def chars():
    CW, CH, IDLE_H = 460, 600, 420
    for who, L in [('eunyu', 'A'), ('eungyeol', 'B')]:
        for i, outfit in enumerate(OUTFITS[who]):
            p = src(f'char/{L}{i + 1:02d}')
            if not os.path.exists(p): continue
            cs = GS.cuts_row(GS.key_out(p, T=110, W=50), look=A.key(p)); s = IDLE_H / cs[0].height
            for pose, cut in zip(POSES, cs):
                q = A.scaled(cut, s)
                if q.height > CH or q.width > CW: q = A.scaled(q, min(CH / q.height, CW / q.width))
                c = Image.new('RGBA', (CW, CH)); c.alpha_composite(q, ((CW - q.width) // 2, CH - q.height))
                A.save(c, f"burger/assets/chars/{who}{'_' + outfit if outfit else ''}_{pose}.webp")
        print(who)


def map_():
    for i in range(1, 11):
        im = Image.open(src(f'map/W{i:02d}')).convert('RGB').resize((1024, 1536), Image.LANCZOS)
        A.save(im, f'hub/ui/map/burger/w{i}.webp', quality=82, method=6)
    print('map')


def ride():
    import park_assets as P
    P.OUT = f'{ROOT}/hub/park'; P.src = lambda n, pre: src('basic/R01'); P.ride(1, 'burger'); print('ride')


if __name__ == '__main__':
    todo = sys.argv[1:] or ['intro', 'play', 'guests', 'chars', 'map', 'ride']
    for t in todo: {'intro': intro, 'play': play, 'guests': guests, 'chars': chars, 'map': map_, 'ride': ride}[t]()
