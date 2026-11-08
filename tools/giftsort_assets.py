"""선물가게 정리(giftsort) 그림 적용 — 받은 GPT 그림(character/giftsort/, 저장소에 안 올림)을 잘라 게임 그림으로
  python3 tools/giftsort_assets.py            # 전부
  python3 tools/giftsort_assets.py intro      # 인트로·카드·준비 창 로고 (한국어·영어)
  python3 tools/giftsort_assets.py play       # 가게 배경·카트·선물 상자·버튼·반짝 조각
  python3 tools/giftsort_assets.py chars      # 은유·은결 상반신 4자세 × 옷 9벌
  python3 tools/giftsort_assets.py map        # 스테이지 지도 배경 10장
  python3 tools/giftsort_assets.py ride       # 첫 화면 놀이기구 (R01 이 없으면 카트·상자로 만든 임시 그림)
요청 글: making_GPT/선물가게정리/ (00_전체안내.txt)
"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import adult_assets as A  # 초록 지우기·자르기·저장·인트로 합치기를 같이 씀

ROOT = A.ROOT
SRC = f'{ROOT}/character/giftsort'
OUT = f'{ROOT}/giftsort/assets'
GIFTS = ['rabbit', 'star', 'heart', 'clover', 'bear', 'car', 'candy', 'cloud', 'flower', 'moon', 'puppy', 'snow']
OUTFITS = {'eunyu': ['', 'uniform', 'date', 'casual', 'school', 'travel', 'pajamas', 'winter', 'baker'],
           'eungyeol': ['', 'streamer', 'daily', 'campus', 'sport', 'travel', 'home', 'winter', 'baker']}
POSES = ['idle', 'think', 'happy', 'cheer']


def src(p): return f'{SRC}/{p}.png'


def key_out(path, T=200, W=30):
    """바깥과 이어진 초록만 지움 — 초록 클로버 상자처럼 그림 안의 초록은 남김 (카트는 안쪽 빈 칸이 막혀 있어 A.key 를 씀)"""
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]; k = g - np.maximum(r, b)
    al = np.clip((T - k) / W, 0, 1); bgm = al < .5
    lab, _ = nd.label(bgm); out = np.isin(lab, np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])) & bgm
    al = np.where(out, al, 1.0); edge = nd.binary_dilation(out, iterations=2)
    a[..., 1] = np.where(edge & (al < 1), np.minimum(g, np.maximum(r, b) + 10), g)
    im = Image.fromarray(a.astype(np.uint8)).convert('RGBA'); im.putalpha(Image.fromarray((al * 255).astype(np.uint8))); return im


def cuts_row(im, n=4, sm=4, look=None):
    """한 줄 시트의 컷 n 개 — 머리카락·가방이 옆 컷과 닿아 있어도 나눔
    ① 아래쪽 띠(허리 근처)에서 세로로 가장 빈 줄로 n 칸을 나눠 씨앗을 정하고 ② 씨앗에서 몸을 따라 동시에 넓혀 가며 픽셀마다 주인을 정함
       (들어 올린 손처럼 옆 칸 위로 뻗은 부분도 몸에 이어져 있으면 제 주인에게 감)"""
    al = np.asarray(im.getchannel('A')); m = al > 128
    small = m[::sm, ::sm]; H, W = small.shape
    rows = np.nonzero(small.any(1))[0]; band = small[max(rows[0], rows[-1] - (rows[-1] - rows[0]) // 5):rows[-1] + 1]
    col = band.sum(0).astype(float); xs = np.nonzero(col)[0]; x0, x1 = xs[0], xs[-1] + 1; cell = (x1 - x0) / n; at = [x0]
    for i in range(1, n):
        lo, hi = round(x0 + cell * (i - .3)), round(x0 + cell * (i + .3)); at.append(lo + int(np.argmin(col[lo:hi])))
    at.append(x1)
    lab = np.zeros((H, W), np.int32); y0 = rows[-1] - (rows[-1] - rows[0]) // 5
    for k in range(n): lab[y0:, at[k]:at[k + 1]][small[y0:, at[k]:at[k + 1]]] = k + 1
    for _ in range(H + W):  # 몸을 따라 한 칸씩 넓힘
        grown = False
        for k in range(1, n + 1):
            add = nd.binary_dilation(lab == k) & small & (lab == 0)
            if add.any(): lab[add] = k; grown = True
        if not grown: break
    # 떨어진 조각(손끝·머리카락 끝)은 가장 가까운 주인에게
    idx = nd.distance_transform_edt(lab == 0, return_distances=False, return_indices=True)
    lab = lab[idx[0], idx[1]]
    full = np.kron(lab, np.ones((sm, sm), np.int32))[:al.shape[0], :al.shape[1]]
    # look: 실제 색·투명도를 가져올 그림 (머리카락 틈의 초록까지 지운 것). 둘 다 불투명한 곳만 남김
    arr = np.array(look if look is not None else im); a2 = np.minimum(arr[..., 3], al); out = []
    for k in range(1, n + 1):
        p = arr.copy(); p[..., 3] = np.where(full == k, a2, 0); out.append(A.tight(drop_far(Image.fromarray(p))))
    return out


def drop_far(im, gap=24):
    """몸에서 gap px 넘게 떨어진 작은 조각(옆 컷의 손끝·상자 귀퉁이)을 지움"""
    a = np.array(im); m = a[..., 3] > 24
    lab, cnt = nd.label(m)
    if cnt < 2: return im
    size = nd.sum(m, lab, range(1, cnt + 1)); main = lab == (int(np.argmax(size)) + 1)
    near = nd.binary_dilation(main, iterations=gap)
    keep = np.isin(lab, np.unique(lab[near & m]))
    a[..., 3] = np.where(keep, a[..., 3], 0); return Image.fromarray(a)


def grid(path, cols, rows):
    """칸으로 나눠 자르기 (점선 테두리처럼 조각난 그림도 한 칸 = 한 개)"""
    im = key_out(path); w, h = im.width / cols, im.height / rows
    return [A.tight(im.crop((round(c * w), round(r * h), round((c + 1) * w), round((r + 1) * h)))) for r in range(rows) for c in range(cols)]


def intro():
    A.SRC = SRC
    A.GAMES = {'giftsort': ('basic', (.5, .76, .80), (.5, .03, .36), .10)}
    A.intro()


def play():
    for n, name in [('P01', 'port'), ('P02', 'land')]:
        im = Image.open(src(f'play/{n}')).convert('RGB')
        A.save(im.resize((1024, round(im.height * 1024 / im.width)) if im.width < im.height else (1536, round(im.height * 1536 / im.width)), Image.LANCZOS),
               f'giftsort/assets/bg/{name}.webp', quality=82, method=6)
    # 카트: K01·K02 는 같은 틀 (K01 의 테두리 상자로 둘 다 자름 → 리본 카트가 빈 카트와 정확히 겹침)
    k1 = A.key(src('play/K01'), soft=False); bb = k1.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    k2 = A.key(src('play/K02'), soft=False)
    for im, name in [(k1, 'cart'), (k2, 'cart_lock')]:
        c = im.crop(bb); A.save(A.scaled(c, 300 / c.width), f'giftsort/assets/ui/{name}.webp')
    A.save(A.scaled(A.tight(A.key(src('play/K03'), soft=False)), 0.3), 'giftsort/assets/ui/topper.webp')
    # 선물 상자 12종 + 특수 4개: 같은 폭(240)으로
    boxes = grid(src('play/S01'), 2, 2) + grid(src('play/S02'), 2, 2) + grid(src('play/S03'), 2, 2)
    sp = grid(src('play/S04'), 2, 2)
    for im, name in zip(boxes + sp, GIFTS + ['gold', 'mystery', 'bow', 'slot']):
        A.save(A.scaled(im, 240 / im.width), f'giftsort/assets/gifts/{name}.webp')
    for im, name in zip(grid(src('play/U01'), 2, 2), ['undo', 'addcart', 'retry', 'peek']):
        A.save(A.scaled(im, 160 / max(im.size)), f'giftsort/assets/ui/{name}.webp')
    for i, im in enumerate(grid(src('play/E01'), 3, 2)):
        A.save(A.scaled(im, 96 / max(im.size)), f'giftsort/assets/fx/p{i}.webp')
    print('play')


def chars():
    # 4컷을 같은 배율로: 기본 자세 키가 IDLE_H 가 되게, 캔버스 아래 가운데에 (허리 잘린 선 = 아래 끝)
    CW, CH, IDLE_H = 460, 600, 420
    for who, L in [('eunyu', 'A'), ('eungyeol', 'B')]:
        for i, outfit in enumerate(OUTFITS[who]):
            p = src(f'char/{L}{i + 1:02d}')
            if not os.path.exists(p): continue
            cs = cuts_row(key_out(p, T=110, W=50), look=A.key(p)); s = IDLE_H / cs[0].height
            for pose, cut in zip(POSES, cs):
                q = A.scaled(cut, s)
                if q.height > CH or q.width > CW: q = A.scaled(q, min(CH / q.height, CW / q.width))
                c = Image.new('RGBA', (CW, CH)); c.alpha_composite(q, ((CW - q.width) // 2, CH - q.height))
                A.save(c, f"giftsort/assets/chars/{who}{'_' + outfit if outfit else ''}_{pose}.webp")
        print(who)


def map_():
    for i in range(1, 11):
        im = Image.open(src(f'map/W{i:02d}')).convert('RGB').resize((1024, 1536), Image.LANCZOS)
        A.save(im, f'hub/ui/map/giftsort/w{i}.webp', quality=82, method=6)
    print('map')


def ride():
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import park_assets as P
    if os.path.exists(src('basic/R01')):
        P.OUT = f'{ROOT}/hub/park'; P.src = lambda n, pre: src('basic/R01'); P.ride(1, 'giftsort'); return
    # 임시: 빈 받침(empty.webp) 위에 상자를 채운 카트 4대
    base = Image.open(f'{ROOT}/hub/park/rides/empty.webp').convert('RGBA')
    cart = Image.open(f'{OUT}/ui/cart.webp').convert('RGBA')
    cw = 64; cart = A.scaled(cart, cw / cart.width)
    for k, (g, dx, dy) in enumerate([('rabbit', -96, -6), ('car', 96, -6), ('star', -34, 12), ('clover', 34, 12)]):
        c = cart.copy(); box = Image.open(f'{OUT}/gifts/{g}.webp').convert('RGBA'); box = A.scaled(box, cw * .9 / box.width)
        y = round(c.height * .78)
        for j in range(4):
            y -= round(c.height * .158); c.alpha_composite(box, ((c.width - box.width) // 2, y - box.height + round(c.height * .158)))
        base.alpha_composite(c, (base.width // 2 + dx - c.width // 2, base.height - 112 - c.height + dy))
    A.save(base, 'hub/park/rides/giftsort.webp', quality=88, alpha_quality=100, method=6)
    print('ride (임시)')


if __name__ == '__main__':
    todo = sys.argv[1:] or ['intro', 'play', 'chars', 'map', 'ride']
    for t in todo: {'intro': intro, 'play': play, 'chars': chars, 'map': map_, 'ride': ride}[t]()
