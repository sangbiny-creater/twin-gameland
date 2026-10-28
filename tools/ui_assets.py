"""화면 그림(GPT) → 게임용 webp: 초록 배경 지우기·자르기·크기 맞추기
원본: making_GPT/화면그림_다시/ (M01~M08 지도, T01 첫 화면 배너, S01·S02 아이템샵), making_GPT/버튼/ (B01 START, B02 게임 시작)
  python3 tools/ui_assets.py          # 그림 전부 다시 만들기
  python3 tools/ui_assets.py cards    # 게임 카드(hub/cards/*.webp)의 "게임 시작" 버튼을 B02로 바꾸기 (카드마다 한 번만)
"""
import os, sys, glob
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = f'{ROOT}/making_GPT/화면그림_다시'
BTN = f'{ROOT}/making_GPT/버튼'


def unchroma(path):
    """초록(#00FF00) 배경 → 투명. 가장자리 초록 번짐도 지움. 물건 크기로 잘라서 돌려줌"""
    a = np.array(Image.open(path).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    gx = g - np.maximum(r, b)  # 초록이 얼마나 튀는지
    alpha = np.clip(1 - (gx - 40) / 90, 0, 1)  # 40 이하면 그대로, 130 넘으면 투명
    g2 = np.minimum(g, np.maximum(r, b) + 12)  # 반투명 가장자리의 초록 기 빼기
    a[..., 1] = np.where(alpha < 1, g2, g)
    out = np.dstack([a, alpha * 255]).astype(np.uint8)
    im = Image.fromarray(out, 'RGBA')
    bb = Image.fromarray((alpha > 0.1).astype(np.uint8) * 255).getbbox()
    return im.crop(bb)


def fit_w(im, w):
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)


def save(im, rel, lossless=True):
    p = f'{ROOT}/{rel}'; os.makedirs(os.path.dirname(p), exist_ok=True)
    if lossless: im.save(p, 'WEBP', lossless=True, method=6)
    else: im.save(p, 'WEBP', quality=86, method=6)
    print(rel, im.size)


def band(path, ratio, cy):
    """가로 그림에서 가운데 띠 자르기: ratio = 가로/세로, cy = 띠 가운데 (그림 높이 대비 0~1)"""
    im = Image.open(path).convert('RGB'); h = round(im.width / ratio)
    y0 = max(0, min(im.height - h, round(im.height * cy - h / 2)))
    return im.crop((0, y0, im.width, y0 + h))


def build():
    # 지도: 돌다리 4종은 같은 크기 틀(가장 큰 것 기준)에 바닥을 맞춰 넣음 → 바꿔 끼워도 안 흔들림
    stones = {k: unchroma(f'{SRC}/{m}.png') for k, m in (('cleared', 'M01'), ('open', 'M02'), ('locked', 'M03'), ('next', 'M04'))}
    W = max(s.width for s in stones.values()); H = max(s.height for s in stones.values())
    for k, s in stones.items():
        c = Image.new('RGBA', (W, H)); c.alpha_composite(s, ((W - s.width) // 2, H - s.height))
        save(fit_w(c, 300), f'hub/ui/map/stone_{k}.webp')
    save(fit_w(unchroma(f'{SRC}/M05.png'), 200), 'hub/ui/map/trophy.webp')
    save(fit_w(unchroma(f'{SRC}/M06.png'), 72), 'hub/ui/map/star.webp')
    save(fit_w(unchroma(f'{SRC}/M07.png'), 72), 'hub/ui/map/star_off.webp')
    save(fit_w(unchroma(f'{SRC}/M08.png'), 420), 'hub/ui/map/label.webp')
    # 첫 화면 배너 (1024x299 비율), 아이템샵 배너 (1536x420 → 화면에선 가로:세로 3.66), 집 아이콘
    save(band(f'{SRC}/T01.png', 1024 / 299, .495).resize((1024, 299), Image.LANCZOS), 'hub/ui/title.webp', lossless=False)
    save(band(f'{SRC}/S01.png', 1536 / 420, .48).resize((1024, 280), Image.LANCZOS), 'shop/assets/ui/banner.webp', lossless=False)
    save(fit_w(unchroma(f'{SRC}/S02.png'), 96), 'shop/assets/ui/home.webp')
    # 버튼
    save(fit_w(unchroma(f'{BTN}/B01.png'), 420), 'hub/ui/btn_start.webp')


# 카드 맨 아래 "게임 시작" 버튼 자리 (480x592 카드 안): 지금 버튼(그림자 포함) 대략 x 24~464, y 484~582
CARD_BTN = (24, 484, 464, 582)


def cards():
    b02 = unchroma(f'{BTN}/B02.png')
    x0, y0, x1, y1 = CARD_BTN
    # B02는 글자가 버튼 폭을 거의 다 채워서 가운데만 늘릴 수 없음 → 자리 높이에 맞추고 옆으로만 살짝(약 13%) 넓힘
    btn = b02.resize((380, 92), Image.LANCZOS)
    for p in sorted(glob.glob(f'{ROOT}/hub/cards/*.webp')):
        if os.path.basename(p) == 'soon.webp': continue
        card = Image.open(p).convert('RGBA'); a = np.array(card)
        # 버튼 자리를 바로 위(BEST 줄 아래) 배경색으로 위아래 채우기 (카드 바탕은 거의 흰 세로 그라데이션)
        row = a[y0 - 2, x0:x1].copy()
        a[y0:y1, x0:x1] = row[None, :, :]
        card = Image.fromarray(a, 'RGBA')
        card.alpha_composite(btn, ((480 - btn.width) // 2, 487))
        card.save(p, 'WEBP', quality=88, method=6)
        print('card', os.path.basename(p))


if __name__ == '__main__':
    cards() if sys.argv[1:] == ['cards'] else build()
