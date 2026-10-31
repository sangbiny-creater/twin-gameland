"""v0.3 상용화 검수판 버튼·아이콘·안내 창 그림 만들기 → common/ui/monet/ 에 webp로 저장
  python3 tools/monet_assets.py
  · GPT 그림: making_GPT/상용화_버튼안내/U01~U11 (초록 바탕) — 요청 글: 같은 폴더 GPT_요청_상용화_버튼안내.txt
  · 창 틀(panel)·버튼(btn_*)은 common/monet.js 에서 border-image(9칸 나누기)로 늘려 씀
    → 그림을 다시 받으면 아래에서 출력하는 크기를 보고 monet.js 의 border-image 숫자(자르는 칸)도 다시 맞추기
"""
import os
import numpy as np
from scipy import ndimage
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = f'{ROOT}/making_GPT/상용화_버튼안내'
OUT = f'{ROOT}/common/ui/monet'


def src(n):
    for ext in ('png', 'PNG'):
        p = f'{SRC}/U{n:02d}.{ext}'
        if os.path.exists(p): return p
    raise FileNotFoundError(f'U{n:02d}')


def key(path, soft=False):
    """초록(#00FF00) 바탕을 투명하게, 가장자리 초록 번짐 빼기 (tools/park_assets.py 와 같은 방법)
    soft: 빛 번짐이 초록 위로 퍼진 그림(U10) — 초록 기운만큼 반투명으로, 남은 초록 기운은 모두 빼기"""
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    k = g - np.maximum(r, b)
    if soft:
        al = np.clip((150 - k) / 130, 0, 1)
        a[..., 1] = np.minimum(g, np.maximum(r, b) + 6)
    else:
        al = np.clip((140 - k) / 60, 0, 1)
        a[..., 1] = np.where(al < 1, np.minimum(g, np.maximum(r, b) + 10), g)
    al[:12] = 0; al[-12:] = 0; al[:, :12] = 0; al[:, -12:] = 0  # 그림 가장자리 얼룩
    out = Image.fromarray(a.astype(np.uint8)).convert('RGBA')
    out.putalpha(Image.fromarray((al * 255).astype(np.uint8)))
    return out


def tight(im, pad=4):
    bb = im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    return im.crop((max(0, bb[0] - pad), max(0, bb[1] - pad), min(im.width, bb[2] + pad), min(im.height, bb[3] + pad)))


def no_edge(im):
    """칸 가장자리에 걸친 작은 조각(옆 칸 그림이 삐져나온 것)을 지우기"""
    a = np.asarray(im).copy()
    lab, n = ndimage.label(a[..., 3] > 24)
    size = np.bincount(lab.ravel()); size[0] = 0
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    for i in edge:
        if size[i] < size.max() * 0.3: a[lab == i, 3] = 0
    return Image.fromarray(a)


def grid(im, rows, cols):
    """한 장에 반듯하게 놓인 여러 개를 칸으로 나눠 각각 꼭 맞게 자르기 (위 줄부터 왼쪽→오른쪽)"""
    w, h = im.width / cols, im.height / rows
    return [tight(no_edge(im.crop((round(c * w), round(r * h), round((c + 1) * w), round((r + 1) * h))))) for r in range(rows) for c in range(cols)]


def split(im, n, rows=False):
    """가로로(rows=True 면 세로로) 늘어선 n개를 투명한 틈에서 나누기 — 반짝이처럼 작은 조각은 옆 덩어리에 붙임"""
    col = (np.asarray(im.getchannel('A')) > 24).any(1 if rows else 0)
    segs, x = [], 0
    while x < len(col):
        if col[x]:
            s = x
            while x < len(col) and col[x]: x += 1
            segs.append([s, x])
        x += 1
    while len(segs) > n:  # 가장 좁은 조각을 가까운 옆 조각과 합치기
        i = min(range(len(segs)), key=lambda j: segs[j][1] - segs[j][0])
        if i == 0: j = 1
        elif i == len(segs) - 1: j = i - 1
        else: j = i - 1 if segs[i][0] - segs[i - 1][1] < segs[i + 1][0] - segs[i][1] else i + 1
        a, b = sorted((i, j)); segs[a] = [segs[a][0], segs[b][1]]; del segs[b]
    return [tight(im.crop((0, s, im.width, e) if rows else (s, 0, e, im.height))) for s, e in segs]


def save(im, name, w=None, lossless=True, q=88):
    if w and im.width != w: im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    p = f'{OUT}/{name}.webp'
    os.makedirs(OUT, exist_ok=True)
    if lossless: im.save(p, 'WEBP', lossless=True, quality=100, method=6)
    else: im.save(p, 'WEBP', quality=q, alpha_quality=100, method=6)
    print(f'{name:18s} {im.size} {os.path.getsize(p) // 1024}KB')


if __name__ == '__main__':
    save(tight(key(src(1))), 'panel', w=600, lossless=False)                       # U01 안내 창 틀
    save(tight(key(src(2))), 'ribbon', w=600)                      # U02 제목 리본
    for im, c in zip(split(key(src(3)), 4, rows=True), ['pink', 'gold', 'blue', 'gray']):
        save(im, f'btn_{c}', w=360)                                # U03 버튼 바탕 4색
    for im, c in zip(split(key(src(4)), 2, rows=True), ['ad_double', 'ad_continue']):
        save(im, f'btn_{c}', w=400)                                # U04 광고 버튼 2색
    for im, c in zip(grid(key(src(5)), 3, 3), ['lock', 'key', 'gem', 'ad', 'x2', 'continue', 'attend', 'gift', 'trial']):
        save(im, f'ico_{c}', w=128)                                # U05 아이콘 9개
    for i, im in enumerate(split(key(src(6)), 4)):
        save(im, f'pack_{i + 1}', w=200)                           # U06 다이아 상품 4개
    for im, c in zip(grid(key(src(7)), 2, 3), ['stamp_on', 'stamp_off', 'att_key', 'att_frame', 'att_gems', 'att_gift']):
        save(im, c, w=160)                                         # U07 출석 도장·보상
    save(tight(key(src(8))), 'welcome', w=360, lossless=False)     # U08 환영 선물 캐릭터
    save(tight(key(src(9))), 'locked', w=360, lossless=False)      # U09 잠김·체험 끝 캐릭터
    save(tight(key(src(10), soft=True)), 'unlocked_fx', w=420, lossless=False)  # U10 게임 열림 효과
    save(tight(key(src(11))), 'attend', w=360, lossless=False)     # U11 출석 캐릭터
