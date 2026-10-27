"""멍멍이 간식 타임 GPT 그림 → 게임 그림 (게임 카드는 tools/game_cards.py)
  python3 tools/dogsnack_assets.py
  · 원본: dogsnackgame/GPT/ (G01~G06 카드·인트로·로고·배경, D01~D12 강아지·간식, 초록 바탕 — .gitignore)
    (요청 글: making_GPT/신규게임이미지_템플릿/GPT_요청_멍멍이간식_그림.txt)
  · 강아지: D01~D09 = 아리·콩이·포미 × 기본·입 벌림·슬픔 → 강아지마다 3장을 같은 틀로 잘라 표정이 바뀌어도 자리가 그대로
  · 줄줄이 소시지 D11: 매듭(가장 좁은 줄) 가운데에서 잘라 위 마디·가운데 마디·아래 마디 3조각
    → 게임은 위 + 가운데 × (n-2) + 아래 로 이어 붙여 길이를 맞춤 (양 끝은 늘 둥글게 마무리된 마디)
  · 결과: dogsnack/assets/{sprites,bg,ui}/*.webp, hub/intro/dogsnack(_land).webp, shop/assets/games/dogsnack.webp
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage
from mole_assets import chroma, cover

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GPT = f'{ROOT}/dogsnackgame/GPT'
OUT = f'{ROOT}/dogsnack/assets'


def save(im, name, w=None, q=88):
    if w: im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    p = f'{OUT}/{name}.webp'
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, 'WEBP', quality=q, method=6)
    print(name, im.size)
    return im


def bbox(im, th=40):
    return im.getchannel('A').point(lambda v: 255 if v > th else 0).getbbox()


def parts(im, k):
    """초록 지운 그림에서 큰 덩어리 k개를 왼쪽부터 (반짝이 같은 작은 조각은 가까운 덩어리에 붙임)"""
    a = np.asarray(im)[..., 3] > 40
    lab, n = ndimage.label(a)
    sz = ndimage.sum(a, lab, range(1, n + 1)); big = np.argsort(sz)[::-1][:k] + 1
    objs = ndimage.find_objects(lab)
    boxes = sorted([list((objs[b - 1][1].start, objs[b - 1][0].start, objs[b - 1][1].stop, objs[b - 1][0].stop)) for b in big])
    for j in range(n):  # 작은 조각 → 가로 가운데가 가까운 덩어리 틀에 넣기
        if j + 1 in big or sz[j] < 30: continue
        s = objs[j]; cx = (s[1].start + s[1].stop) / 2
        bx = min(boxes, key=lambda b: abs((b[0] + b[2]) / 2 - cx))
        bx[0] = min(bx[0], s[1].start); bx[1] = min(bx[1], s[0].start); bx[2] = max(bx[2], s[1].stop); bx[3] = max(bx[3], s[0].stop)
    return [im.crop(tuple(b)) for b in boxes]


def main():
    # 강아지 3마리 × 3표정: 같은 틀 (합친 테두리) — 앞발 아래 끝 = 그림 아래 끝
    for k in range(3):
        ims = [chroma(f'{GPT}/D{3 * k + i + 1:02d}.PNG') for i in range(3)]
        bs = [bbox(im) for im in ims]
        box = (min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs))
        for im, n in zip(ims, ('idle', 'open', 'sad')): save(im.crop(box), f'sprites/dog{k}_{n}', 300)
    # 뼈다귀 (보통·금빛), 양파·초콜릿
    bone, gold = parts(chroma(f'{GPT}/D10.PNG'), 2)
    save(bone, 'sprites/bone', 200); save(gold, 'sprites/bone_gold', 200)
    onion, choco = parts(chroma(f'{GPT}/D12.PNG'), 2)
    save(onion, 'sprites/onion', 180); save(choco, 'sprites/choco', 180)
    # 줄줄이 소시지: 매듭 = 폭이 소시지 폭의 45%보다 좁은 줄들의 가운데
    s = chroma(f'{GPT}/D11.PNG'); s = s.crop(bbox(s))
    wid = (np.asarray(s)[..., 3] > 128).sum(1); narrow = wid < wid.max() * 0.45
    narrow[:20] = narrow[-20:] = False
    lab, n = ndimage.label(narrow)
    knots = [int(np.mean(np.nonzero(lab == i + 1)[0])) for i in range(n)]
    print('sausage knots', knots, 'height', s.height)
    cuts = [0] + knots + [s.height]
    for name, (y0, y1) in (('top', cuts[0:2]), ('mid', cuts[2:4]), ('bot', cuts[-2:])):
        save(s.crop((0, y0, s.width, y1)), f'sprites/sausage_{name}', 120)
    # 배경 · 로고
    save(Image.open(f'{GPT}/G05.PNG').convert('RGB'), 'bg/port', q=82)
    save(Image.open(f'{GPT}/G06.PNG').convert('RGB'), 'bg/land', q=82)
    logo = chroma(f'{GPT}/G04.PNG'); logo = logo.crop(bbox(logo, 30))
    save(logo, 'ui/logo', 720, q=90)
    twins()
    hub_images()


def twins():
    """간식 던지는 은유·은결 T01~T08 (은유: 기본·던지기·기뻐함·아쉬움, 은결 같은 순서)
    캐릭터마다 4장을 같은 틀(합친 테두리)로 잘라 표정이 바뀌어도 발 자리가 그대로.
    기본 그림의 몸 높이를 360px 로 맞춤(쌍둥이 키 같게) → game.js TWIN_ART 의 ax(기본 몸 가운데 x 비율)·body(몸 높이 px)"""
    for c, (name, first) in enumerate((('eunyu', 1), ('eungyeol', 5))):
        ims = []
        for i in range(4):
            f = next(p for p in (f'{GPT}/T{first + i:02d}.PNG', f'{GPT}/T{first + i:02d}.png') if os.path.exists(p))
            ims.append(chroma(f))
        bs = [bbox(im) for im in ims]
        box = (min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs))
        idle = bs[0]; k = 360 / (idle[3] - idle[1])
        for im, pose in zip(ims, ('idle', 'throw', 'happy', 'sad')):
            out = im.crop(box); out = out.resize((round(out.width * k), round(out.height * k)), Image.LANCZOS)
            p = f'{OUT}/chars/{name}_{pose}.webp'; os.makedirs(os.path.dirname(p), exist_ok=True)
            out.save(p, 'WEBP', quality=88, method=6)
        print(name, 'size', out.size, 'ax', round(((idle[0] + idle[2]) / 2 - box[0]) / (box[2] - box[0]), 3),
              'foot', round((box[3] - idle[3]) * k), 'body', 360)


def hub_images():
    g1 = Image.open(f'{GPT}/G01.PNG').convert('RGB')
    # 인트로: 세로 G02 → 9:16 로 잘라 941x1672, 가로 G03 → 1536x1024 그대로
    g2 = Image.open(f'{GPT}/G02.PNG').convert('RGB'); g3 = Image.open(f'{GPT}/G03.PNG').convert('RGB')
    w = round(g2.height * 9 / 16)
    g2.crop(((g2.width - w) // 2, 0, (g2.width + w) // 2, g2.height)).resize((941, 1672), Image.LANCZOS).save(f'{ROOT}/hub/intro/dogsnack.webp', 'WEBP', quality=84, method=6)
    cover(g3, 1536, 1024).save(f'{ROOT}/hub/intro/dogsnack_land.webp', 'WEBP', quality=84, method=6)
    # 아이템샵 게임 카드 164x134: G01 캐릭터·강아지 부분
    cover(g1.crop((0, 60, 1024, 900)), 164, 134).save(f'{ROOT}/shop/assets/games/dogsnack.webp', 'WEBP', quality=88, method=6)
    print('hub images ok')


if __name__ == '__main__':
    import sys
    twins() if sys.argv[1:] == ['twins'] else main()
