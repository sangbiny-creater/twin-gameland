"""주간 랭킹 그림 만들기
  python3 tools/ranking_assets.py
  · GPT 그림: making_GPT/주간랭킹/받은그림/ (요청 글: 같은 폴더 01~04_*.txt)
  · B02: 놀이공원 가운데 A 배경(mid4_a)의 랭킹 자리만 길바닥을 넓힌 그림. 사용자 요청대로 '그 자리만' 바꾸려고
    원본과 달라진 곳(빨간 원 둘레)만 골라 원본 위에 가장자리를 흐리게 덧붙임 → hub/park/bg/mid4_a_rank.webp (1차 B01 은 안 씀)
  · R02: 아이템샵·옷장과 한 세트인 랭킹 건물(이름표판 없음) → hub/park/ui/ranking.webp (이름은 코드의 흰 이름표)
  · E01·H01~H09·L01~L06·M01~M03·N01·F01~F04·C01·K01: 랭킹 화면 (ranking/) → ranking/assets/
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


if __name__ == '__main__':
    background(); house(); screen()
