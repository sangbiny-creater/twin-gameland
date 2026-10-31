"""QA 5차 그림 적용 (2026-10-31) → 게임 폴더에 webp로 저장
  python3 tools/qa5_assets.py
  · GPT 그림: making_GPT/첫화면_5차/ (요청 글: 같은 폴더 GPT_요청_5차_QA.txt, GPT_요청_대문아래_길.txt)
    C01~C04 캐릭터 고르기 첫 화면 · D01~D08 꾸미기 아이템 · N01~N05 이름표·이어하기권 · L01~L05 로고 · K01~K05 Sky Rider · F01~F02 대문 아래 광장·매표소
  · 초록 바탕 빼기·놀이기구 받침 맞추기는 tools/park_assets.py 와 같은 방법
"""
import os
import numpy as np
from PIL import Image
import park_assets as P

ROOT = P.ROOT
SRC = f'{ROOT}/making_GPT/첫화면_5차'
P.SRC = SRC
src = lambda n: f'{SRC}/{n}.png'


def save(im, path, w=None, h=None, lossless=True, q=86):
    if w and h: im = im.resize((w, h), Image.LANCZOS)
    elif w and im.width != w: im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    os.makedirs(os.path.dirname(f'{ROOT}/{path}'), exist_ok=True)
    if im.mode == 'RGBA' and lossless: im.save(f'{ROOT}/{path}', 'WEBP', lossless=True, quality=100, method=6)
    elif im.mode == 'RGBA': im.save(f'{ROOT}/{path}', 'WEBP', quality=q, alpha_quality=100, method=6)
    else: im.convert('RGB').save(f'{ROOT}/{path}', 'WEBP', quality=q, method=6)
    print(f'{path:42s} {im.size} {os.path.getsize(f"{ROOT}/{path}") // 1024}KB')


cut = lambda n: P.tight(P.key(src(n)))
cover = lambda im, w, h: (lambda s: im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS))(max(w / im.width, h / im.height))


def crop_center(im, w, h, cy=0.5):
    im = cover(im, w, h); x = (im.width - w) // 2; y = round((im.height - h) * cy)
    return im.crop((x, y, x + w, y + h))


def plate_box(path):
    """이름표 그림 속 크림색 글자 칸 [위, 오른쪽, 아래, 왼쪽] 비율 (hub.js PLATES 의 box)"""
    im = Image.open(f'{ROOT}/{path}').convert('RGBA'); W, H = im.size; px = im.load()
    cream = lambda p: p[3] > 200 and p[0] > 225 and p[1] > 200 and p[2] > 150 and p[0] - p[2] < 80
    cx, cy = W // 2, H // 2
    while not cream(px[cx, cy]) and cy < H - 1: cy += 1  # 가운데 장식(하트·별) 아래 크림색까지
    l = r = cx; t = b = cy
    while l > 0 and cream(px[l - 1, cy]): l -= 1
    while r < W - 1 and cream(px[r + 1, cy]): r += 1
    while t > 0 and cream(px[cx, t - 1]): t -= 1
    while b < H - 1 and cream(px[cx, b + 1]): b += 1
    return [round(t / H, 3), round((W - 1 - r) / W, 3), round((H - 1 - b) / H, 3), round(l / W, 3)], round(W / H, 3)


if __name__ == '__main__':
    # 캐릭터 고르기 첫 화면 (QA 1)
    save(Image.open(src('C01')).convert('RGB'), 'hub/select/bg.webp', w=1024)
    save(Image.open(src('C02')).convert('RGB'), 'hub/select/bg_land.webp', w=1536)
    save(cut('C03'), 'hub/select/eunyu.webp', w=420, lossless=False, q=90)
    save(cut('C04'), 'hub/select/eungyeol.webp', w=420, lossless=False, q=90)
    # 꾸미기 아이템 (QA 12·18): 지금 그림과 같은 폭
    for n, path, w in [('D01', 'gate_6', 640), ('D06', 'gate_7', 640), ('D07', 'gate_8', 640),
                       ('D02', 'statue_6', 260), ('D08', 'statue_7', 260), ('D04', 'statue_8', 260),
                       ('D03', 'fountain_6', 420), ('D05', 'fountain_7', 420)]:
        save(cut(n), f'hub/park/items/{path}.webp', w=w)
    # 이름표 (QA 17) + 이어하기권 (QA 24)
    for n, name in [('N01', 'star'), ('N02', 'rabbit'), ('N03', 'rainbow'), ('N04', 'flower')]:
        save(cut(n), f'hub/park/ui/plate_{name}.webp', w=300)
        print('   box', name, plate_box(f'hub/park/ui/plate_{name}.webp'))
    save(cut('N05'), 'common/ui/monet/pack_continue.webp', w=200)
    # 로고 (QA 19)
    for n, name in [('L01', 'star'), ('L02', 'rabbit'), ('L03', 'rainbow'), ('L04', 'heart'), ('L05', 'flower')]:
        save(cut(n), f'hub/park/ui/logo_{name}.webp', w=520)
    # Sky Rider (QA 21): 카드는 그림 안쪽 테두리 안만 잘라 480x592, 인트로 세로는 941x1672, 가로 1536x1024
    k1 = Image.open(src('K01')).convert('RGB')
    inner = k1.crop((22, 22, k1.width - 22, 22 + round((k1.width - 44) * 592 / 480)))
    save(inner, 'hub/cards/helicopter.webp', w=480, h=592)
    save(crop_center(inner, 164, 134, 0.7), 'shop/assets/games/helicopter.webp')
    save(crop_center(Image.open(src('K02')).convert('RGB'), 941, 1672), 'hub/intro/helicopter.webp')
    save(crop_center(Image.open(src('K03')).convert('RGB'), 1536, 1024), 'hub/intro/helicopter_land.webp')
    P.OUT = f'{ROOT}/hub/park'; P.ride(4, 'helicopter', pre='K')
    logo = cut('K05'); c = Image.new('RGBA', (1040, 532))
    s = min(1000 / logo.width, 520 / logo.height); logo = logo.resize((round(logo.width * s), round(logo.height * s)), Image.LANCZOS)
    c.alpha_composite(logo, ((1040 - logo.width) // 2, (532 - logo.height) // 2)); save(c, 'helicopter/assets/ui/keyart.webp')
    # 대문 아래 광장 (F01): 폭 1024, 위 351줄 (294줄 + 입구 그림과 흐리게 겹치는 57줄) / 매표소 (F02)
    f = Image.open(src('F01')).convert('RGB'); f = f.resize((1024, round(f.height * 1024 / f.width)), Image.LANCZOS)
    save(f.crop((0, 0, 1024, 351)), 'hub/park/bg/entrance4_foot.webp', q=90)
    save(cut('F02'), 'hub/park/ui/ticket.webp', w=360)
