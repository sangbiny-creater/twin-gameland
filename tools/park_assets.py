"""첫 화면(놀이공원, v0.2) 그림 만들기 → hub/park/ 에 webp로 저장
  python3 tools/park_assets.py
  · GPT 그림: making_GPT/첫화면_놀이공원/P01~P26 (요청 글: 같은 폴더 GPT_요청_첫화면_놀이공원.txt)
  · 놀이기구(P06~P16)는 받침(둥근 꽃밭)의 폭·아랫선을 재서 모두 같은 크기·같은 자리에 오게 맞춤
    → 어느 자리에 놓아도 받침이 똑같이 보임 (hub.js 의 놀이기구 칸 크기와 같음: 폭 RW, 받침 아래 = 그림 아래에서 PAD)
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = f'{ROOT}/making_GPT/첫화면_놀이공원'
OUT = f'{ROOT}/hub/park'
RIDES = ['skyhook', 'helicopter', 'stairs', 'shisen', 'downhill', 'memory', 'mole', 'bakery', 'dogsnack', 'darts']
RW, RH, PLATE, PAD = 460, 470, 400, 14   # 놀이기구 그림 크기, 받침 폭, 받침 아래 여백 (px)


def src(n):
    for ext in ('png', 'PNG'):
        p = f'{SRC}/P{n:02d}.{ext}'
        if os.path.exists(p): return p
    raise FileNotFoundError(f'P{n:02d}')


def key(path):
    """초록(#00FF00) 바탕을 투명하게, 가장자리 초록 번짐 빼기 (tools/darts_assets.py 와 같은 방법)"""
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    k = g - np.maximum(r, b)
    al = np.clip((140 - k) / 60, 0, 1)
    edge = al < 1
    a[..., 1] = np.where(edge, np.minimum(g, np.maximum(r, b) + 10), g)
    al[:12] = 0; al[-12:] = 0; al[:, :12] = 0; al[:, -12:] = 0
    out = Image.fromarray(a.astype(np.uint8)).convert('RGBA')
    out.putalpha(Image.fromarray((al * 255).astype(np.uint8)))
    return out


def tight(im, pad=4):
    bb = im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    return im.crop((max(0, bb[0] - pad), max(0, bb[1] - pad), min(im.width, bb[2] + pad), min(im.height, bb[3] + pad)))


def save(im, name, w=None, lossless=True, q=86):
    if w and im.width != w: im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    p = f'{OUT}/{name}.webp'
    os.makedirs(os.path.dirname(p), exist_ok=True)
    if im.mode == 'RGBA' and lossless: im.save(p, 'WEBP', lossless=True, quality=100, method=6)
    elif im.mode == 'RGBA': im.save(p, 'WEBP', quality=q, alpha_quality=100, method=6)
    else: im.save(p, 'WEBP', quality=q, method=6)
    print(f'{name:22s} {im.size} {os.path.getsize(p) // 1024}KB')


def plate(im):
    """받침(둥근 꽃밭)의 왼쪽·오른쪽 끝과 아랫선: 그림 아래쪽 30% 안에서 가장 넓은 가로줄"""
    al = np.asarray(im.getchannel('A')) > 128
    rows = np.nonzero(al.any(1))[0]; top, bot = rows[0], rows[-1]
    best = (0, 0, 0)
    for y in range(int(bot - (bot - top) * 0.3), bot + 1):
        xs = np.nonzero(al[y])[0]
        if len(xs) and xs[-1] - xs[0] > best[1] - best[0]: best = (xs[0], xs[-1], y)
    return best[0], best[1], bot


def ride(n, name):
    im = key(src(n))
    x0, x1, bot = plate(im)
    s = PLATE / (x1 - x0)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    cx, by = (x0 + x1) / 2 * s, bot * s
    c = Image.new('RGBA', (RW, RH))
    c.alpha_composite(im, (round(RW / 2 - cx), round(RH - PAD - by)))
    save(c, f'rides/{name}', lossless=False, q=88)


def bg(n, name):
    im = Image.open(src(n)).convert('RGB')
    if im.width != 1024: im = im.resize((1024, round(im.height * 1024 / im.width)), Image.LANCZOS)
    save(im, f'bg/{name}', q=82)


if __name__ == '__main__':
    # P02(가운데 A)는 GPT가 작게(533px) 줘서 흐려서 안 씀 → 가운데는 P03 한 장을 좌우로 뒤집어 번갈아 씀 (hub.js)
    for n, name in [(1, 'entrance'), (3, 'mid'), (4, 'top')]: bg(n, name)
    ride(5, 'empty'); ride(6, 'soon')
    for i, g in enumerate(RIDES): ride(7 + i, g)
    save(tight(key(src(17))), 'coaster/eungyeol', w=640, lossless=False, q=88)
    save(tight(key(src(18))), 'coaster/eunyu', w=640, lossless=False, q=88)
    for n, name, w in [(19, 'logo', 520), (20, 'gem', 96), (21, 'star', 96), (22, 'settings', 120), (23, 'sign', 440),
                       (24, 'edit', 120), (25, 'shop', 360), (26, 'dress', 360)]:
        save(tight(key(src(n))), f'ui/{name}', w=w, lossless=w <= 120, q=88)
