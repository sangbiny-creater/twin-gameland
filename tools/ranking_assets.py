"""주간 랭킹 그림 만들기 → hub/park/ 에 webp로 저장
  python3 tools/ranking_assets.py
  · GPT 그림: making_GPT/주간랭킹/받은그림/ (요청 글: 같은 폴더 위 01~03_*.txt)
  · B01: 놀이공원 가운데 A 배경(mid4_a)의 랭킹 자리만 고친 그림. 사용자 요청대로 '그 자리만' 바꾸려고
    원본과 달라진 곳(빨간 원 둘레)만 골라 원본 위에 가장자리를 흐리게 덧붙임 → hub/park/bg/mid4_a_rank.webp
  · R01: 글자 없는 빈 이름표판 랭킹 건물 → 초록 빼서 hub/park/ui/ranking.webp
    이름표판 크림색 칸 위치(그림 비율)를 출력 → hub.js RANK_HOUSE.box 에 적음
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, f'{ROOT}/tools')
from park_assets import key, tight  # noqa: E402

SRC = f'{ROOT}/making_GPT/주간랭킹/받은그림'


def background():
    A = Image.open(f'{ROOT}/hub/park/bg/mid4_a.webp').convert('RGB')
    B = Image.open(f'{SRC}/B01.png').convert('RGB')
    d = np.abs(np.asarray(A).astype(int) - np.asarray(B).astype(int)).mean(2)
    m = np.zeros(d.shape, np.uint8)
    box = (slice(880, 1215), slice(715, 960))  # 빨간 원 (745,1005)~(925,1185) 둘레
    m[box] = (d[box] > 22) * 255
    M = Image.fromarray(m).filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.GaussianBlur(8))
    Image.composite(B, A, M).save(f'{ROOT}/hub/park/bg/mid4_a_rank.webp', quality=90, method=6)
    print('mid4_a_rank.webp')


def house():
    im = tight(key(f'{SRC}/R01.png'), pad=4)
    W = 360
    im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
    im.save(f'{ROOT}/hub/park/ui/ranking.webp', 'WEBP', lossless=True, quality=100, method=6)
    # 이름표판 안 크림색 칸: 그림 왼쪽 아래 40% 안의 밝은 크림색 덩어리
    a = np.asarray(im.convert('RGB')).astype(int); al = np.asarray(im.getchannel('A'))
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    cream = (r > 235) & (g > 215) & (b > 190) & (r - b < 45) & (al > 200)
    h, w = cream.shape; cream[: int(h * 0.72)] = False; cream[:, int(w * 0.56):] = False
    ys, xs = np.nonzero(cream)
    t, bt, l, rt = ys.min(), ys.max(), xs.min(), xs.max()
    print(f'ranking.webp {im.size}  box(위,오른쪽,아래,왼쪽 비율) = '
          f'[{t / h:.3f}, {1 - rt / w:.3f}, {1 - bt / h:.3f}, {l / w:.3f}]')


if __name__ == '__main__':
    background(); house()
