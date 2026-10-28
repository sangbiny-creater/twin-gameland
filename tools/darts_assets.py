"""다트 게임 그림 만들기 → darts/assets/, hub/intro 에 webp로 저장 (게임 카드는 tools/game_cards.py).
  python3 tools/darts_assets.py
  · GPT 그림: dartsgame/GPT/G01~G06.PNG(카드·인트로·로고·배경), B01~B10.PNG(캐릭터 뒷모습 버튼, 초록 바탕),
    A01~A07.PNG(다트판·다트·게이지 틀·점·과녁 표시, 초록 바탕)
    (요청 글: making_GPT/다트게임/GPT_요청_다트게임_그림.txt)
  · 다트판(A01)은 링 위치를 재서 darts/art.js 의 R 값과 맞춰 둠 (점수 계산이 그림과 같아야 함) — 새 그림을 넣으면 출력되는 값으로 R 고치기
"""
import math, os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GPT = f'{ROOT}/dartsgame/GPT'
OUT = f'{ROOT}/darts/assets'


def key(path):
    """초록(#00FF00) 바탕을 투명하게. 그림 속 초록(다트판 초록 칸·은결 줄무늬 옷)은 남기고, 가장자리 초록 번짐만 빼기"""
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    k = g - np.maximum(r, b)
    al = np.clip((140 - k) / 60, 0, 1)            # k 80 이하 = 그림, 140 이상 = 바탕
    edge = al < 1
    a[..., 1] = np.where(edge, np.minimum(g, np.maximum(r, b) + 10), g)
    al[:12] = 0; al[-12:] = 0; al[:, :12] = 0; al[:, -12:] = 0  # 그림 모서리 얼룩 (GPT 그림 가장자리 몇 줄이 덜 초록일 때가 있음)
    out = Image.fromarray(a.astype(np.uint8)).convert('RGBA')
    out.putalpha(Image.fromarray((al * 255).astype(np.uint8)))
    return out


def save(im, name, w=None, lossless=True, q=88):
    # lossless=False 인 투명 그림은 색만 손실 압축, 투명도(alpha_quality=100)는 그대로
    if w and im.width != w:
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    p = f'{OUT}/{name}.webp'
    os.makedirs(os.path.dirname(p), exist_ok=True)
    if lossless: im.save(p, 'WEBP', lossless=True, quality=100, method=6)
    else: im.save(p, 'WEBP', quality=q, alpha_quality=100, method=6)
    print(name, im.size, f'{os.path.getsize(p) // 1024}KB')
    return im


def tight(im, pad=4):
    bb = im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    return im.crop((max(0, bb[0] - pad), max(0, bb[1] - pad), min(im.width, bb[2] + pad), min(im.height, bb[3] + pad)))


def parts(im, n):
    """가로로 늘어선 n 개 물건을 왼쪽부터 잘라 줌 (빈 세로 줄로 나눔)"""
    col = np.asarray(im.getchannel('A')).max(0) > 24
    runs, st = [], None
    for x, v in enumerate(list(col) + [False]):
        if v and st is None: st = x
        if not v and st is not None:
            if x - st > 20: runs.append((st, x))
            st = None
    assert len(runs) == n, runs
    return [tight(im.crop((x0, 0, x1, im.height))) for x0, x1 in runs]


def board():
    """다트판: 불 가운데를 그림 가운데로, 더블 링 바깥 반지름(DOUT)을 재서 art.js R 과 맞춤"""
    src = f'{GPT}/A01.PNG'
    a = np.asarray(Image.open(src).convert('RGB')).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    red = (r > 170) & (g < 90) & (b < 90)
    grn = (g > 90) & (g - r > 40) & (g - b > 20) & ~((g > 200) & (r < 80) & (b < 80))
    from scipy import ndimage
    lab, n = ndimage.label(red)
    h, w = red.shape
    best = min((math.hypot(xs.mean() - w / 2, ys.mean() - h / 2), xs.mean(), ys.mean())
               for i in range(1, n + 1) for ys, xs in [np.nonzero(lab == i)] if len(ys) > 200)
    cx, cy = best[1], best[2]
    rows = []
    for k in range(40):
        ang = (k * 9 + 4) * math.pi / 180
        seq = []
        for rr in range(0, int(min(w, h) / 2)):
            y, x = int(round(cy - math.cos(ang) * rr)), int(round(cx + math.sin(ang) * rr))
            seq.append('R' if red[y, x] else 'G' if grn[y, x] else '.')
        runs, cur, st = [], None, 0
        for i, c in enumerate(seq + ['#']):
            if c != cur:
                if cur in ('R', 'G') and i - st > 3: runs.append((st, i))
                cur, st = c, i
        if len(runs) == 4: rows.append([runs[0][1], runs[1][0], runs[1][1], runs[2][0], runs[2][1], runs[3][0], runs[3][1]])
    m = np.array(rows).mean(0)
    bull, outer, tin, tout, din, dout = (m[0] + m[1]) / 2, m[2] + 1, m[3], m[4], m[5], m[6]
    im = key(src)
    al = np.asarray(im.getchannel('A')) > 128
    ys, xs = np.nonzero(al)
    rim = max(cx - xs.min(), xs.max() - cx)
    print('board center', round(cx, 1), round(cy, 1), 'R (더블 바깥 = 1):',
          {k: round(v / dout, 3) for k, v in dict(bull=bull, outer=outer, tIn=tin, tOut=tout, dIn=din, rim=rim).items()})
    # 불 가운데가 그림 가운데에 오는 정사각으로 자름 (반지름 = 가장 먼 테두리까지)
    half = math.ceil(max(cx - xs.min(), xs.max() - cx, cy - ys.min(), ys.max() - cy)) + 2
    sq = Image.new('RGBA', (half * 2, half * 2))
    sq.paste(im, (half - round(cx), half - round(cy)))
    out = save(sq, 'board', 1000, lossless=False, q=90)  # 무손실은 900KB 넘어서 색만 손실 압축
    print('board.webp: 더블 바깥 반지름 =', round(dout * out.width / (half * 2), 1), 'px (그림 폭', out.width, ') → art.js BOARD_DOUT')


def main():
    board()
    # 다트 3개 (분홍·노랑·파랑): 바늘 끝이 그림 아래 가운데
    for i, d in enumerate(parts(key(f'{GPT}/A02.PNG'), 3)): save(d, f'dart_{i}', None if d.height <= 260 else round(d.width * 260 / d.height))
    # 게이지 막대 틀: 안쪽 흰 칸 위치 출력 (game.js BAR_IN)
    bar = tight(key(f'{GPT}/A03.PNG'))
    a = np.asarray(bar.convert('RGB')).astype(int)
    white = (a.min(-1) > 225)
    ys, xs = np.nonzero(white[:, :])
    mid = bar.height // 2
    row = np.nonzero(white[mid])[0]; colw = np.nonzero(white[:, bar.width // 2])[0]
    bar = save(bar, 'bar', 600)
    sx = 600 / (a.shape[1])
    print('bar inner x', round(row.min() / a.shape[1], 4), round(row.max() / a.shape[1], 4), 'y', round(colw.min() / a.shape[0], 4), round(colw.max() / a.shape[0], 4))
    for i, d in enumerate(parts(key(f'{GPT}/A04.PNG'), 3)): save(d, f'dot_{i}', 96)
    # 과녁 표시 3색: 그림 가운데(작은 점)가 가운데 오게 정사각으로
    for i in range(3):
        im = key(f'{GPT}/A{5 + i:02d}.PNG')
        al = np.asarray(im.getchannel('A')) > 128
        ys, xs = np.nonzero(al)
        cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
        half = math.ceil(max(cx - xs.min(), xs.max() - cx, cy - ys.min(), ys.max() - cy)) + 4
        save(im.crop((round(cx - half), round(cy - half), round(cx + half), round(cy + half))), f'reticle_{i}', 220)
    # 캐릭터 뒷모습 버튼: 10장 모두 같은 틀(합친 테두리)로 잘라 크기·자리가 그대로
    names = ['idle', 'aim', 'throw', 'happy', 'sad']
    ims = [key(f'{GPT}/B{i + 1:02d}.PNG') for i in range(10)]
    bb = [im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox() for im in ims]
    box = (min(b[0] for b in bb) - 4, min(b[1] for b in bb) - 4, max(b[2] for b in bb) + 4, max(b[3] for b in bb) + 4)
    print('button box', box)
    for i, im in enumerate(ims):
        save(im.crop(box), f'btn/{"eunyu" if i < 5 else "eungyeol"}_{names[i % 5]}', 300)
    # 배경 (세로만), 로고
    save(Image.open(f'{GPT}/G05.PNG').convert('RGB'), 'bg/port', 768, lossless=False, q=80)
    save(tight(key(f'{GPT}/G04.PNG')), 'ui/logo', 640, lossless=False, q=90)
    # 인트로: 세로 G02 → 9:16 로 잘라 941x1672, 가로 G03 → 1536x1024
    g2 = Image.open(f'{GPT}/G02.PNG').convert('RGB'); g3 = Image.open(f'{GPT}/G03.PNG').convert('RGB')
    w = round(1536 * 9 / 16)
    g2.crop(((1024 - w) // 2, 0, (1024 + w) // 2, 1536)).resize((941, 1672), Image.LANCZOS).save(f'{ROOT}/hub/intro/darts.webp', 'WEBP', quality=84, method=6)
    g3.save(f'{ROOT}/hub/intro/darts_land.webp', 'WEBP', quality=84, method=6)
    print('hub intro ok')


if __name__ == '__main__':
    main()
