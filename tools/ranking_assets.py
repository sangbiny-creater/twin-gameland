"""주간 랭킹 그림 만들기
  python3 tools/ranking_assets.py
  · GPT 그림: making_GPT/주간랭킹/받은그림/ (요청 글: 같은 폴더 01~04_*.txt)
  · B02: 놀이공원 가운데 A 배경(mid4_a)의 랭킹 자리만 길바닥을 넓힌 그림. 사용자 요청대로 '그 자리만' 바꾸려고
    원본과 달라진 곳(빨간 원 둘레)만 골라 원본 위에 가장자리를 흐리게 덧붙임 → hub/park/bg/mid4_a_rank.webp (1차 B01 은 안 씀)
  · R02: 아이템샵·옷장과 한 세트인 랭킹 건물(이름표판 없음) → hub/park/ui/ranking.webp (이름은 코드의 흰 이름표)
  · E01·H01~H09·L01~L06·M01~M03·N01·F01~F04·C01·K01: 1차 랭킹 화면 그림 → ranking/assets/ (2차 화면에서는 star 만 씀)
  · T01~T09: 2차 랭킹 화면 (사용자가 고른 시안, 2026-11-12) → ranking/assets/v2/. 분홍(은유)·파랑(은결)판 따로
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, f'{ROOT}/tools')
from park_assets import key, tight  # noqa: E402

SRC = f'{ROOT}/making_GPT/주간랭킹/받은그림'
OUT = f'{ROOT}/ranking/assets'


def background():
    A = Image.open(f'{ROOT}/hub/park/bg/mid4_a.webp').convert('RGB')
    B = Image.open(f'{SRC}/B02.png').convert('RGB')
    d = np.abs(np.asarray(A).astype(int) - np.asarray(B).astype(int)).mean(2)
    m = np.zeros(d.shape, np.uint8)
    box = (slice(860, 1212), slice(700, 1012))  # 빨간 원 (715,960)~(975,1215) 둘레 (원 밖 아래 가로등은 원본 그대로)
    m[box] = (d[box] > 22) * 255
    M = Image.fromarray(m).filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.GaussianBlur(8))
    Image.composite(B, A, M).save(f'{ROOT}/hub/park/bg/mid4_a_rank.webp', quality=90, method=6)
    print('mid4_a_rank.webp')


def house():
    im = tight(key(f'{SRC}/R02.png'), pad=4)
    im = im.resize((360, round(im.height * 360 / im.width)), Image.LANCZOS)
    im.save(f'{ROOT}/hub/park/ui/ranking.webp', 'WEBP', lossless=True, quality=100, method=6)
    print('ranking.webp', im.size)


# 랭킹 화면 조각: GPT 번호 → (파일 이름, 저장 폭 px)
PARTS = {
    'H01': ('title', 720), 'H02': ('tab_on', 420), 'H03': ('tab_off', 420), 'H04': ('period', 640),
    'H05': ('game_on', 220), 'H06': ('game_off', 220), 'H07': ('arrow', 120), 'H08': ('board', 720), 'H09': ('divider', 720),
    'L01': ('row1', 900), 'L02': ('row2', 900), 'L03': ('row3', 900), 'L04': ('row', 900), 'L05': ('row_me', 900), 'L06': ('row_mine', 900),
    'M01': ('medal1', 160), 'M02': ('medal2', 160), 'M03': ('medal3', 160), 'N01': ('badge', 120),
    'F01': ('frame1', 200), 'F02': ('frame2', 200), 'F03': ('frame3', 200), 'F04': ('frame', 200),
    'C01': ('crown', 120), 'K01': ('star', 80),
}


def screen():
    os.makedirs(f'{OUT}/ui', exist_ok=True)
    e = Image.open(f'{SRC}/E01.png').convert('RGB').resize((720, 1080), Image.LANCZOS)
    e.save(f'{OUT}/bg.webp', quality=84, method=6)
    print('bg.webp', e.size)
    for n, (name, w) in PARTS.items():
        im = tight(key(f'{SRC}/{n}.png'), pad=2)
        im = im.resize((w, max(1, round(im.height * w / im.width))), Image.LANCZOS)
        im.save(f'{OUT}/ui/{name}.webp', 'WEBP', quality=90, alpha_quality=100, method=6)
        print(f'{name:9s} {im.size}  폭/높이 {im.width / im.height:.3f}')


def pieces(path):
    """한 장에 여러 조각(2x2·위아래 줄): 초록을 빼고 빈 줄·빈 칸으로 나눠 위→아래, 왼→오른 순서로"""
    im = key(path); al = np.asarray(im.getchannel('A')) > 40
    def runs(v, gap=12):
        out, s0, last = [], None, -99
        for i in np.nonzero(v)[0]:
            if s0 is None: s0 = i
            elif i - last > gap: out.append((s0, last + 1)); s0 = i
            last = i
        if s0 is not None: out.append((s0, last + 1))
        return out
    res = []
    for y0, y1 in runs(al.any(1)):
        for x0, x1 in runs(al[y0:y1].any(0)):
            res.append(tight(im.crop((x0, y0, x1, y1)), pad=2))
    return res


V2 = {  # GPT 번호 → 조각 이름들 (한 장에 하나면 이름 하나), 저장 폭
    'T03': (['seg_pink_week', 'seg_pink_all', 'seg_blue_week', 'seg_blue_all'], 360),
    'T04': (['num1', 'num2', 'num3', 'num'], 96),
    'T05': (['ring_pink', 'ring_blue', 'line_pink', 'line_blue'], 120),
    'T06': (['panel_pink'], 600), 'T07': (['panel_blue'], 600),
    'T08': (['me_pink', 'me_blue', 'divider'], 900),
    'T09': (['mine_pink', 'mine_blue'], 900),
}


def screen2():
    out = f'{OUT}/v2'; os.makedirs(out, exist_ok=True)
    for n, name in (('T01', 'bg_pink'), ('T02', 'bg_blue')):
        Image.open(f'{SRC}/{n}.png').convert('RGB').resize((720, 1080), Image.LANCZOS).save(f'{out}/{name}.webp', quality=84, method=6)
    for n, (names, w) in V2.items():
        ps = pieces(f'{SRC}/{n}.png')
        assert len(ps) == len(names), f'{n}: 조각 {len(ps)}개 (기대 {len(names)})'
        for im, name in zip(ps, names):
            im = im.resize((w, max(1, round(im.height * w / im.width))), Image.LANCZOS)
            im.save(f'{out}/{name}.webp', 'WEBP', quality=90, alpha_quality=100, method=6)
            print(f'{name:14s} {im.size}  폭/높이 {im.width / im.height:.3f}')


if __name__ == '__main__':
    if 'v2' in sys.argv: screen2()
    else: background(); house(); screen(); screen2()
