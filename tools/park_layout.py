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
PLATE = 260          # 받침 폭(px, 1024 그림 기준, 그림 폭의 25%) → 화면에서 137 (놀이기구 칸 158)
# 자리: 아래에서 위로 채우는 순서. (x, y) = 받침 가운데 (그림 폭·높이 비율, y는 위에서부터)
# E(입구)는 컨셉 초안 첫 화면 그대로: 놀이기구 6 + 가운데 분수대 + 오른쪽 가게 2 + 입구 문. 왼쪽 아래는 롤러코스터가 덮음
# M1·M2(가운데)는 놀이기구 6자리, M2는 M1을 좌우로 뒤집은 배치. 아래부터 E → M1 → M2 → M1 … → T(하늘)
# 게임은 아래 자리부터, Open soon 은 마지막 구간의 맨 위 자리, 그 사이 남는 자리는 장식
_M = [(0.28, 0.86), (0.74, 0.80), (0.50, 0.62), (0.22, 0.44), (0.78, 0.42), (0.50, 0.22)]
SECTIONS = {
    # 분수대는 받침 폭의 약 70% (그림 폭의 18%). 분수대를 줄인 만큼 둘레 자리를 안쪽으로 모음 (2차-2)
    'E': {'slots': [(0.51, 0.645), (0.26, 0.535), (0.75, 0.545), (0.31, 0.375), (0.75, 0.365), (0.53, 0.225)],
          'fountain': (0.53, 0.43), 'gate': (0.64, 0.90), 'shops': [(0.72, 0.755), (0.90, 0.775)]},
    'M1': {'slots': _M},
    'M2': {'slots': [(round(1 - x, 2), y) for x, y in _M]},
}


def plate_img():
    p = f'{ROOT}/hub/park/rides/empty.webp'
    im = Image.open(p).convert('RGBA')
    bb = im.getchannel('A').getbbox(); im = im.crop(bb)
    return im.resize((PLATE, round(im.height * PLATE / im.width)), Image.LANCZOS)


# 광장 사이 꽃밭·나무 덩어리 (x, y, 반지름) — 초안처럼 돌바닥 광장 사이사이에
GARDENS = {
    'E': [(0.53, 0.30, 40), (0.51, 0.53, 38), (0.15, 0.23, 70), (0.86, 0.22, 70), (0.88, 0.46, 50), (0.13, 0.45, 50), (0.31, 0.67, 40), (0.30, 0.13, 55), (0.76, 0.12, 55)],
    'M1': [(0.50, 0.80, 55), (0.50, 0.43, 60), (0.15, 0.66, 65), (0.86, 0.62, 60), (0.24, 0.20, 55), (0.78, 0.18, 55)],
    'M2': [(0.50, 0.80, 55), (0.50, 0.43, 60), (0.85, 0.66, 65), (0.14, 0.62, 60), (0.76, 0.20, 55), (0.22, 0.18, 55)],
}


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
    if name == 'M1': d.line([(0.95 * W, 0), (0.93 * W, 0.4 * H), (0.96 * W, 0.75 * H), (0.94 * W, H)], fill=river, width=50)
    if name == 'M2': d.line([(0.05 * W, 0), (0.07 * W, 0.35 * H), (0.04 * W, 0.6 * H), (0.06 * W, H)], fill=river, width=50)
    im = im.filter(ImageFilter.GaussianBlur(5)); d = ImageDraw.Draw(im)
    if 'fountain' in sec:
        x, y = sec['fountain'][0] * W, sec['fountain'][1] * H
        fw = 0.18 * W / 2  # 분수대 지름 = 그림 폭의 18% (받침 폭의 약 70%)
        d.ellipse((x - fw, y - fw * 0.6, x + fw, y + fw * 0.6), fill=(150, 205, 245), outline=(255, 255, 255), width=8)
        d.ellipse((x - 24, y - 40, x + 24, y + 4), fill=(255, 220, 90))
    if 'gate' in sec:
        x, y = sec['gate'][0] * W, sec['gate'][1] * H
        d.rectangle((x - 210, y - 105, x + 210, y + 105), fill=(200, 210, 240), outline=(90, 110, 200), width=8)
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
        for n, s in SECTIONS.items(): guide(n, s, f'{GPT}/안내도_{n}.png')
        guide_top(f'{GPT}/안내도_T.png')
    elif sys.argv[1:] == ['js']:
        print(json.dumps({k: {kk: vv for kk, vv in v.items()} for k, v in SECTIONS.items()}))
    else: print(__doc__)
