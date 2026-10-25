"""달콤 베이커리 GPT 그림 → 게임 그림
  python3 tools/bakery_assets.py
  · 원본: bakerygame/GPT/ (G01~G06, B01~B10 — .gitignore)
  · B01~B05 컵케이크는 같은 틀(합친 테두리)로 잘라서 컵 바닥 높이를 맞춤, B06 접시는 따로
  · 결과: bakery/assets/sprites/*.webp, bakery/assets/bg/land.webp + 치수는 화면에 출력 → bakery/art.js SPR 표에 적기
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'bakerygame/GPT')
OUT = os.path.join(ROOT, 'bakery/assets/sprites')


def key(path):
    """초록 배경을 투명하게 (가장자리 초록 번짐도 뺌)"""
    im = np.array(Image.open(path).convert('RGB')).astype(float)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    k = g - np.maximum(r, b)
    a = np.clip(1 - (k - 40) / 80, 0, 1)
    g2 = np.where(k > 20, np.minimum(g, np.maximum(r, b) + 20), g)
    return Image.fromarray(np.dstack([r, g2, b, a * 255]).astype(np.uint8))


def bbox(im):
    a = np.array(im)[..., 3] > 24
    ys, xs = np.where(a)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def save(im, name, w):
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=88)
    return im


def main():
    os.makedirs(OUT, exist_ok=True)
    # 컵케이크 5장: 합친 테두리로 똑같이 자름 → 컵 바닥 = 그림 아래 끝
    cups = {n: key(f'{SRC}/B0{i}.png') for i, n in enumerate(['cup', 'cup_cream', 'gold', 'gold_cream', 'burnt'], 1)}
    boxes = [bbox(im) for im in cups.values()]
    box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
    cupw = bbox(cups['cup'])  # 크림 없는 컵케이크 폭 = 게임 속 크기 기준
    print('cup box', box, 'cup width ratio', round((cupw[2] - cupw[0]) / (box[2] - box[0]), 3),
          'cup center x', round(((cupw[0] + cupw[2]) / 2 - box[0]) / (box[2] - box[0]), 3))
    for n, im in cups.items():
        out = save(im.crop(box), n, 300)
    print('cup sprite', out.size)
    pl = key(f'{SRC}/B06.png'); out = save(pl.crop(bbox(pl)), 'plate', 260); print('plate', out.size)
    for n, i in (('roll', 7), ('eclair', 8), ('cream', 9)):
        im = key(f'{SRC}/B0{i}.png'); out = save(im.crop(bbox(im)), n, 900); print(n, out.size)
    bag = key(f'{SRC}/B10.png'); out = save(bag.crop(bbox(bag)), 'bag', 220); print('bag', out.size)
    Image.open(f'{SRC}/G06.png').convert('RGB').save(os.path.join(ROOT, 'bakery/assets/bg/land.webp'), 'WEBP', quality=84)


if __name__ == '__main__':
    main()
