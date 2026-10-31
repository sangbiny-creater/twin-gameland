"""첫 화면 놀이공원 배치표 + GPT용 배치 안내도 그림
  python3 tools/park_layout.py guides   → making_GPT/첫화면_놀이공원/안내도_*.png (GPT에 첨부)
  python3 tools/park_layout.py js       → hub/hub.js 의 PARK_LAYOUT 에 붙여 넣을 값 출력

배경 한 장(1024x1536)마다 놀이기구 자리(받침 가운데, 0~1 비율)를 정해 두고, GPT가 그 자리를 비운 공원 그림을 그림.
화면에서는 아래부터 입구(E) → 가운데 A(분수대, M1) → 가운데 B(M2) → A → B … → 맨 위(T) 순서로 이어 붙이고,
아래 자리부터 게임 → Open soon → (남는 자리) 장식 순서로 채움.
"""
import os, sys, json
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GPT = f'{ROOT}/making_GPT/첫화면_놀이공원'
W, H = 1024, 1536
PLATE = 272          # 받침 폭(px, 1024 그림 기준) — hub.js PK.PLATE 와 같음
# 자리: 아래에서 위로 채우는 순서. (x, y) = 받침 가운데 (그림 폭·높이 비율, y는 위에서부터)
# 3차 배치 (2026-11): 분수대는 배경에서 빼고 아이템으로 (동상·분수·대문을 아이템샵에서 사서 바꿈)
#  E(입구): 놀이기구 7 + 가운데 작은 동상 자리 + 오른쪽 가게 2 + 아래 대문 자리(비움). 왼쪽 아래는 롤러코스터
#  M1(가운데 A): 놀이기구 9 + 가운데 동상 자리 + 맨 아래 가운데 분수 자리 / M2(가운데 B): M1 좌우 반전, 분수 자리 대신 놀이기구 (10)
#  아래부터 E → M1 → M2 → M1 … → T(하늘). 게임은 아래 자리부터, Open soon 은 마지막 구간 맨 위 자리, 남는 자리는 장식
_M = [(0.20, 0.87), (0.80, 0.87), (0.32, 0.68), (0.68, 0.68), (0.20, 0.495), (0.80, 0.495), (0.32, 0.31), (0.68, 0.31), (0.50, 0.125)]
SECTIONS = {
    'E': {'slots': [(0.50, 0.70), (0.25, 0.59), (0.75, 0.59), (0.25, 0.395), (0.75, 0.395), (0.30, 0.205), (0.70, 0.205)],
          'statue': (0.50, 0.40), 'gate': (0.62, 0.91), 'shops': [(0.72, 0.755), (0.90, 0.77)]},
    'M1': {'slots': _M, 'statue': (0.50, 0.49), 'fountain': (0.50, 0.855)},
    'M2': {'slots': [(0.50, 0.87)] + [(round(1 - x, 2), y) for x, y in _M], 'statue': (0.50, 0.49)},
}


# 4차 배치 (2026-11, 사용자 초안): 첫 화면에 놀이기구 6개(아래 가운데 → 양옆 → 동상 → 양옆 → 위 가운데),
#  그 위에 분수(놀이기구보다 작고 동상보다 큼, 그림 폭의 22%) → 양옆+동상 → 가운데 → 양옆 → 가운데 → 양옆.
#  이름표 자리까지 생각해 위아래 간격을 둠. 한 줄로 놓인 자리도 높이를 조금씩 어긋나게(완전한 일자 없음)
SECTIONS4 = {
    'E': {'slots': [(0.505, 0.583), (0.228, 0.484), (0.806, 0.499), (0.278, 0.300), (0.723, 0.292), (0.516, 0.139)],
          'statue': (0.50, 0.374), 'gate': (0.576, 0.93), 'shops': [(0.70, 0.725), (0.85, 0.765)]},
    'A': {'slots': [(0.228, 0.607), (0.761, 0.618), (0.483, 0.493), (0.25, 0.362), (0.752, 0.372), (0.515, 0.235), (0.27, 0.098), (0.735, 0.088)],
          'statue': (0.50, 0.637), 'fountain': (0.50, 0.83)},
    'B': {'slots': [(0.495, 0.835), (0.235, 0.612), (0.768, 0.603), (0.508, 0.488), (0.245, 0.358), (0.758, 0.368), (0.49, 0.232), (0.262, 0.094), (0.742, 0.102)],
          'statue': (0.50, 0.64)},
}
FOUNTAIN4 = 0.22   # 분수 지름 = 그림 폭의 22%


def plate_img():
    p = f'{ROOT}/hub/park/rides/empty.webp'
    im = Image.open(p).convert('RGBA')
    bb = im.getchannel('A').getbbox(); im = im.crop(bb)
    return im.resize((PLATE, round(im.height * PLATE / im.width)), Image.LANCZOS)


# 광장 사이 꽃밭·나무 덩어리 (x, y, 반지름) — 초안처럼 돌바닥 광장 사이사이에
GARDENS = {
    'E': [(0.50, 0.22, 38), (0.50, 0.58, 36), (0.12, 0.30, 55), (0.88, 0.30, 55), (0.50, 0.08, 45), (0.11, 0.50, 45), (0.89, 0.50, 45)],
    'M1': [(0.50, 0.68, 36), (0.50, 0.31, 36), (0.11, 0.59, 45), (0.89, 0.40, 45), (0.13, 0.21, 45), (0.87, 0.75, 45)],
    'M2': [(0.50, 0.68, 36), (0.50, 0.31, 36), (0.89, 0.59, 45), (0.11, 0.40, 45), (0.87, 0.21, 45), (0.13, 0.75, 45)],
}


GARDENS.update({
    'A': [(0.50, 0.36, 40), (0.50, 0.10, 40), (0.11, 0.48, 45), (0.89, 0.48, 45), (0.13, 0.76, 45), (0.87, 0.76, 45)],
    'B': [(0.50, 0.36, 40), (0.50, 0.10, 40), (0.11, 0.48, 45), (0.89, 0.48, 45), (0.15, 0.80, 45), (0.85, 0.80, 45)],
})
GARDENS['E'] = [(0.50, 0.22, 34), (0.50, 0.47, 30), (0.11, 0.20, 45), (0.89, 0.18, 45), (0.10, 0.38, 40), (0.90, 0.40, 40)]


def guide(name, sec, out):
    """연두 = 숲·꽃밭·나무, 베이지 = 넓은 돌바닥 광장(놀이공원 바닥), 파랑 = 강, 받침 = 놀이기구 자리(비워 두기)"""
    im = Image.new('RGB', (W, H), (150, 200, 120)); d = ImageDraw.Draw(im)
    pave = (238, 222, 190)
    # 놀이공원 바닥: 가운데 넓은 돌바닥 광장 (양옆 가장자리 10~14%만 숲·강)
    d.rounded_rectangle((0.12 * W, -60, 0.88 * W, H + 60), radius=120, fill=pave)
    for x, y in sec['slots']: d.ellipse((x * W - 190, y * H - 125, x * W + 190, y * H + 125), fill=pave)
    green = (176, 214, 140)
    for x, y, r in GARDENS[name]: d.ellipse((x * W - r * 1.4, y * H - r, x * W + r * 1.4, y * H + r), fill=green)
    river = (120, 180, 230)
    if name == 'E':  # 왼쪽 아래(롤러코스터가 덮는 곳)는 강·숲, 강은 초안처럼 왼쪽에서 들어와 가운데 아래로
        d.polygon([(0, 0.62 * H), (0.44 * W, 0.72 * H), (0.42 * W, H), (0, H)], fill=(150, 200, 120))
        d.line([(0, 0.66 * H), (0.22 * W, 0.74 * H), (0.34 * W, 0.84 * H), (0.40 * W, H)], fill=river, width=60)
    if name in ('M1', 'A'): d.line([(0.95 * W, 0), (0.93 * W, 0.4 * H), (0.96 * W, 0.75 * H), (0.94 * W, H)], fill=river, width=50)
    if name in ('M2', 'B'): d.line([(0.05 * W, 0), (0.07 * W, 0.35 * H), (0.04 * W, 0.6 * H), (0.06 * W, H)], fill=river, width=50)
    im = im.filter(ImageFilter.GaussianBlur(5)); d = ImageDraw.Draw(im)
    if 'fountain' in sec:  # 분수 자리: 지름 = 그림 폭의 18%, 둥근 돌바닥으로 비워 둠
        x, y = sec['fountain'][0] * W, sec['fountain'][1] * H; fw = sec.get('fw', 0.18) * W / 2
        d.ellipse((x - fw, y - fw * 0.6, x + fw, y + fw * 0.6), fill=(150, 205, 245), outline=(255, 255, 255), width=8)
    if 'statue' in sec:  # 동상 자리: 지름 = 그림 폭의 11%, 작은 둥근 돌 받침 (비움)
        x, y = sec['statue'][0] * W, sec['statue'][1] * H; sw = 0.11 * W / 2
        d.ellipse((x - sw, y - sw * 0.6, x + sw, y + sw * 0.6), fill=(170, 170, 180), outline=(255, 255, 255), width=6)
    if 'gate' in sec:  # 대문 자리: 비워 둠 (대문은 따로 그려서 얹음)
        x, y = sec['gate'][0] * W, sec['gate'][1] * H
        d.rectangle((x - 225, y - 140, x + 225, y + 140), outline=(90, 110, 200), width=8)
    for x, y in sec.get('shops', []):
        d.rectangle((x * W - 95, y * H - 90, x * W + 95, y * H + 60), fill=(255, 205, 220), outline=(220, 90, 140), width=8)
    pl = plate_img()
    for x, y in sec['slots']: im.paste(pl, (round(x * W - pl.width / 2), round(y * H - pl.height / 2)), pl)
    im.save(out); print(out)


def guide_top(out):
    """맨 위(1024x1024): 위 55% 하늘·먼 산·성·롤러코스터, 아래 45% 숲·절벽, 산책로는 아래 가장자리 가운데에서 들어와 작은 전망대에서 끝"""
    im = Image.new('RGB', (W, W), (176, 214, 140)); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 0.55 * W), fill=(170, 215, 250))
    d.polygon([(0, 0.55 * W), (0.25 * W, 0.38 * W), (0.5 * W, 0.5 * W), (0.75 * W, 0.36 * W), (W, 0.55 * W)], fill=(140, 190, 150))
    pave = (238, 222, 190)
    d.line([(0.5 * W, W + 20), (0.5 * W, 0.8 * W)], fill=pave, width=150); d.ellipse((0.5 * W - 150, 0.72 * W - 80, 0.5 * W + 150, 0.72 * W + 80), fill=pave)
    im.filter(ImageFilter.GaussianBlur(6)).save(out); print(out)


if __name__ == '__main__':
    if sys.argv[1:] == ['guides']:
        for n, s in SECTIONS4.items(): guide(n, {**s, 'fw': FOUNTAIN4}, f'{GPT}/안내도4_{n}.png')
        guide_top(f'{GPT}/안내도_T.png')
    elif sys.argv[1:] == ['js']:
        print(json.dumps({k: {kk: vv for kk, vv in v.items()} for k, v in SECTIONS.items()}))
    else: print(__doc__)
