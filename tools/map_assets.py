"""스테이지 지도 새 디자인 그림 (GPT S01~S13, making_GPT/스테이지지도/) → hub/ui/map/
  python3 tools/map_assets.py
  S01·S02 배경(1024x1536), S03·S04 롤러코스터 캐릭터, S05~S13 게임별 판 표시 3상태 (섬 받침 폭이 모두 같게 맞춤)
"""
import os
import numpy as np
from PIL import Image
import park_assets as P

ROOT = P.ROOT
SRC = f'{ROOT}/making_GPT/스테이지지도'
OUT = f'{ROOT}/hub/ui/map'
STONE_W = 300   # 판 표시 그림 폭 (섬 받침 폭 기준으로 맞춤)


def save(im, name, lossless=True, q=88):
    p = f'{OUT}/{name}.webp'
    if im.mode == 'RGBA' and lossless: im.save(p, 'WEBP', lossless=True, quality=100, method=6)
    else: im.convert('RGB').save(p, 'WEBP', quality=q, method=6)
    print(f'{name:28s} {im.size} {os.path.getsize(p) // 1024}KB')


def island(im):
    """섬 받침(풀밭)의 왼쪽·오른쪽 끝: 그림 아래쪽 55% 안에서 가장 넓은 가로줄"""
    al = np.asarray(im.getchannel('A')) > 128
    rows = np.nonzero(al.any(1))[0]; top, bot = rows[0], rows[-1]
    best = (0, 0, 0)
    for y in range(int(top + (bot - top) * 0.45), bot):
        xs = np.nonzero(al[y])[0]
        if len(xs) and xs[-1] - xs[0] > best[1] - best[0]: best = (xs[0], xs[-1], y)
    return best


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for n, name in [('S01', 'bg_first'), ('S02', 'bg_next')]:
        save(Image.open(f'{SRC}/{n}.png').convert('RGB').resize((1024, 1536), Image.LANCZOS), name, lossless=False)
    for n, name in [('S03', 'coaster_eunyu'), ('S04', 'coaster_eungyeol')]:
        im = P.tight(P.key(f'{SRC}/{n}.png')); im = im.resize((360, round(im.height * 360 / im.width)), Image.LANCZOS); save(im, name)
    # 판 표시: 섬 받침 폭을 모두 같게 (받침 폭 = 그림 폭의 STONE_W 기준 0.8), 받침 가운데가 그림 가운데, 받침 아래가 같은 높이
    K = 300
    for k, (g, st) in enumerate([(g, st) for g in ('mole', 'memory', 'shisen') for st in ('cleared', 'current', 'locked')]):
        im = P.key(f'{SRC}/S{5 + k:02d}.png'); im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox())
        x0, x1, y = island(im); s = (K * 0.82) / (x1 - x0)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        cx = (x0 + x1) / 2 * s
        c = Image.new('RGBA', (K, 320)); c.alpha_composite(im, (round(K / 2 - cx), 320 - im.height))
        save(c, f'stone_{g}_{st}')
