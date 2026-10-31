"""첫 화면(놀이공원, v0.2) 그림 만들기 → hub/park/ 에 webp로 저장
  python3 tools/park_assets.py
  · GPT 그림: making_GPT/첫화면_놀이공원/ P05~P26(1차: 놀이기구·로고·버튼·가게), Q01~Q07·R01~R02(2차: 배경·장식·롤러코스터)
    (요청 글: 같은 폴더 GPT_요청_첫화면_놀이공원.txt, GPT_요청_첫화면_2차.txt / 배치 안내도: tools/park_layout.py)
  · 배경 속 놀이기구 받침 자리는 hub/hub.js 의 PARK_SECTIONS 에 적어 둠 (그림을 다시 받으면 거기를 다시 재기)
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


def src(n, pre='P'):
    for ext in ('png', 'PNG'):
        p = f'{SRC}/{pre}{n:02d}.{ext}'
        if os.path.exists(p): return p
    raise FileNotFoundError(f'{pre}{n:02d}')


def key(path, trim_edge=True):
    """초록(#00FF00) 바탕을 투명하게, 가장자리 초록 번짐 빼기 (tools/darts_assets.py 와 같은 방법)"""
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    k = g - np.maximum(r, b)
    al = np.clip((140 - k) / 60, 0, 1)
    edge = al < 1
    a[..., 1] = np.where(edge, np.minimum(g, np.maximum(r, b) + 10), g)
    if trim_edge: al[:12] = 0; al[-12:] = 0; al[:, :12] = 0; al[:, -12:] = 0  # 그림 가장자리 얼룩 (롤러코스터는 레일이 가장자리까지라 안 지움)
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


def ride(n, name, pre='P'):
    im = key(src(n, pre))
    x0, x1, bot = plate(im)
    s = PLATE / (x1 - x0)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    cx, by = (x0 + x1) / 2 * s, bot * s
    c = Image.new('RGBA', (RW, RH))
    c.alpha_composite(im, (round(RW / 2 - cx), round(RH - PAD - by)))
    save(c, f'rides/{name}', lossless=False, q=88)


def bg(n, name, pre='Q'):
    im = Image.open(src(n, pre)).convert('RGB')
    if im.width != 1024: im = im.resize((1024, round(im.height * 1024 / im.width)), Image.LANCZOS)
    save(im, f'bg/{name}', q=82)


if __name__ == '__main__':
    # 배경 (2차): 입구 Q01, 가운데 A Q02, 가운데 B Q03, 맨 위 Q04
    for n, name in [(1, 'entrance'), (2, 'mid_a'), (3, 'mid_b'), (4, 'top')]: bg(n, name)
    ride(5, 'empty'); ride(6, 'soon')
    for i, g in enumerate(RIDES): ride(7 + i, g)
    for i in range(3): ride(5 + i, f'deco{i + 1}', 'Q')   # 남는 자리 장식: 꽃 정원·간식 카트·포토존
    # 롤러코스터 (2차 R01·R02): 레일이 왼쪽·아래 가장자리 밖으로 이어지므로 자르지 않고 그림 전체 그대로
    save(key(src(1, "R"), trim_edge=False), 'coaster/eungyeol', w=600, lossless=False, q=88)
    save(key(src(2, "R"), trim_edge=False), 'coaster/eunyu', w=600, lossless=False, q=88)
    for n, name, w in [(19, 'logo', 520), (20, 'gem', 96), (21, 'star', 96), (22, 'settings', 120), (23, 'sign', 440),
                       (24, 'edit', 120), (25, 'shop', 360), (26, 'dress', 360)]:
        save(tight(key(src(n))), f'ui/{name}', w=w, lossless=w <= 120, q=88)
