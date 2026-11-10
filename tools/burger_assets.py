"""버거 러시(burger) 그림 적용 — 받은 GPT 그림(character/burger/, 저장소에 안 올림)을 잘라 게임 그림으로
  python3 tools/burger_assets.py            # 전부
  python3 tools/burger_assets.py intro      # 인트로·카드·준비 창 로고 (한국어·영어)
  python3 tools/burger_assets.py play       # 가게 배경·장비·재료·사이드·아이콘·효과 (예전 그림)
  python3 tools/burger_assets.py v2         # 새 디자인 그림 N01~N13 (play 뒤에 돌려 같은 이름을 덮어씀)
  python3 tools/burger_assets.py v3         # 재료가 담긴 통 P01·P02·P04 + 음료·아이스크림 기계 P05 (P03·P02④는 안 씀)
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


KEEP_GREEN = {'lettuce', 'pile_lettuce', 'cider', 'machine_drink3', 'bin_lettuce', 'mach_cider', 'bint_lettuce'}  # 초록이 들어 있는 그림: 바깥과 이어진 초록만 지움 (나머지는 양파 고리 안쪽처럼 갇힌 초록까지 지움)


def drop_small(im, frac=0.02):
    """옆 칸에서 넘어온 작은 조각(가장 큰 덩어리의 2% 미만)을 지움"""
    import numpy as np
    from scipy import ndimage
    a = np.array(im); m = a[:, :, 3] > 20
    lab, k = ndimage.label(m)
    if k <= 1: return im
    sz = ndimage.sum(m, lab, range(1, k + 1)); keep = np.isin(lab, [i + 1 for i in range(k) if sz[i] >= sz.max() * frac])
    a[~keep, 3] = 0
    return A.tight(Image.fromarray(a))


def save_grid(name, cols, rows, names, size, folder, by_width=False, boxes=None):
    full, outer = A.key(src(name), soft=False), GS.key_out(src(name))
    w, h = full.width / cols, full.height / rows
    for k, n in enumerate(names):
        if not n: continue
        r, c = divmod(k, cols); box = (round(c * w), round(r * h), round((c + 1) * w), round((r + 1) * h))
        if boxes: box = tuple(round(v * full.width / 1024) for v in boxes[k])
        im = drop_small(A.tight(GS.drop_far(A.tight((outer if n in KEEP_GREEN else full).crop(box)), gap=40)))
        A.save(A.scaled(im, size / (im.width if by_width else max(im.size))), f'burger/assets/{folder}/{n}.webp')


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


def v2():
    """2026-11-10 새 디자인 (making_GPT/버거러시/10_새디자인_전체그림.txt)"""
    for n, name in [('N01', 'land'), ('N02', 'land_night')]:
        im = Image.open(src(f'v2/{n}')).convert('RGB')
        A.save(im.resize((1536, 1024), Image.LANCZOS), f'burger/assets/bg/{name}.webp', quality=84, method=6)
    save_grid('v2/N03', 1, 1, ['grill'], 640, 'ui')
    save_grid('v2/N04', 1, 1, ['machine_drink3'], 640, 'ui')
    save_grid('v2/N05', 1, 1, ['machine_ice'], 400, 'ui')
    save_grid('v2/N06', 2, 2, ['well_wide', 'well_tall', 'trash_well', 'icecream'], 320, 'ui',
              boxes=[(0, 0, 640, 512), (640, 0, 1024, 512), (0, 512, 512, 1024), (512, 512, 1024, 1024)])  # 넓은 통이 칸 경계를 넘어서
    save_grid('v2/N07', 2, 2, ['pile_bun_t', 'pile_bun_b', 'pile_cheese', 'pile_bacon'], 320, 'food')
    save_grid('v2/N08', 2, 2, ['pile_lettuce', 'pile_tomato', 'pile_onion', 'pile_patty_raw'], 320, 'food')
    # 쌓는 조각은 모두 같은 폭(320)으로 — 쌓을 때 폭이 같게 보이게
    save_grid('v2/N09', 2, 2, ['bun_b', 'bun_t', None, 'cheese'], 320, 'food', by_width=True)
    save_grid('v2/N10', 2, 2, ['lettuce', 'tomato', 'onion', 'bacon'], 320, 'food', by_width=True)
    save_grid('v2/N11', 2, 2, ['patty_raw', 'patty_cook', 'patty', 'patty_burnt'], 320, 'food', by_width=True)
    save_grid('v2/N12', 2, 2, ['cola', 'cider', 'juice', 'fries'], 240, 'food')
    save_grid('v2/N13', 1, 1, ['tray'], 400, 'ui')
    import shutil; shutil.move(f'{ROOT}/burger/assets/ui/icecream.webp', f'{ROOT}/burger/assets/food/icecream.webp')
    print('v2')


def v3():
    """2026-11-10 재료가 담긴 통 + 기계 (making_GPT/버거러시/11_재료통_음료_다시.txt)"""
    save_grid('v3/P01', 2, 2, ['bin_bun_t', 'bin_bun_b', 'bin_cheese', 'bin_bacon'], 360, 'food')
    save_grid('v3/P02', 2, 2, ['bin_lettuce', 'bin_tomato', 'bin_onion', None], 360, 'food')
    save_grid('v3/P04', 3, 1, ['bin_patty_raw', 'bin_fries', 'bin_trash'], 360, 'food')
    save_grid('v3/P05', 2, 2, ['mach_cola', 'mach_cider', 'mach_juice', 'mach_ice'], 360, 'food')
    if os.path.exists(src('v3/P06')):  # 세로 음료 기계 (12_음료기계_세로.txt) — P05 낮은 기계를 덮어씀
        save_grid('v3/P06', 4, 1, ['mach_cola', 'mach_cider', 'mach_juice', 'mach_ice'], 400, 'food')
    if os.path.exists(src('v3/P07')):  # 소스 (13_소스.txt): 왼쪽 통 · 오른쪽 쌓는 조각
        save_grid('v3/P07', 2, 1, ['bin_sauce', None], 360, 'food')
        save_grid('v3/P07', 2, 1, [None, 'sauce'], 320, 'food', by_width=True)
    if os.path.exists(src('v3/P08')) and os.path.exists(src('v3/P09')):  # 세로 재료 통 (14_세로재료통.txt)
        save_grid('v3/P08', 4, 1, ['bint_bun_t', 'bint_bun_b', 'bint_cheese', 'bint_bacon'], 360, 'food')
        save_grid('v3/P09', 4, 1, ['bint_lettuce', 'bint_tomato', 'bint_onion', 'bint_sauce'], 360, 'food')
    else:
        tall_bins()
    print('v3')


def tall_bins():
    """임시 세로 재료 통 bint_<id> (2026-11-10): 버리기 통에서 마크를 지운 빈 세로 통 + 넓은 통 속 재료를 위아래 2번.
    재료가 8개보다 적은 판에서 패티·감자튀김 칸과 같은 높이로 세움. GPT 세로 통 그림(14번)을 받으면 그걸로 바꿈"""
    import numpy as np
    from PIL import ImageDraw, ImageFilter
    D = f'{ROOT}/burger/assets/food/'
    t = np.array(Image.open(D + 'bin_trash.webp').convert('RGBA')).astype(float); h, w = t.shape[:2]
    y0, y1 = int(h * 0.33), int(h * 0.71)
    for y in range(y0 + 1, y1):
        k = (y - y0) / (y1 - y0); t[y, :, :3] = t[y0, :, :3] * (1 - k) + t[y1, :, :3] * k
    empty = Image.fromarray(t.astype('uint8'))
    for n in ['bun_t', 'bun_b', 'cheese', 'bacon', 'lettuce', 'tomato', 'onion', 'sauce']:
        if not os.path.exists(D + f'bin_{n}.webp'): continue
        b = Image.open(D + f'bin_{n}.webp').convert('RGBA'); bw, bh = b.size
        c = b.crop((int(bw * 0.075), int(bh * 0.065), int(bw * 0.925), int(bh * 0.785)))
        iw = int(w * 0.72); c = c.resize((iw, int(c.height * iw / c.width)), Image.LANCZOS)
        m = Image.new('L', c.size, 0); ImageDraw.Draw(m).rounded_rectangle((3, 3, c.width - 4, c.height - 4), 8, fill=255); m = m.filter(ImageFilter.GaussianBlur(3))
        ca = np.array(c); ca[:, :, 3] = np.minimum(ca[:, :, 3], np.array(m)); c = Image.fromarray(ca)
        out = empty.copy(); top, bot = int(h * 0.10), int(h * 0.86); step = min(c.height - 6, bot - top - c.height); y = top + (bot - top - c.height - step) // 2
        out.alpha_composite(c, ((w - c.width) // 2, y)); out.alpha_composite(c, ((w - c.width) // 2, y + step))
        A.save(out, f'burger/assets/food/bint_{n}.webp')


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
    todo = sys.argv[1:] or ['intro', 'play', 'v2', 'v3', 'guests', 'chars', 'map', 'ride']
    for t in todo: {'intro': intro, 'play': play, 'v2': v2, 'v3': v3, 'guests': guests, 'chars': chars, 'map': map_, 'ride': ride}[t]()
