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
PLATE = 296          # 받침 폭(px, 1024 그림 기준) → 화면에서 156 (놀이기구 칸 180)
# 자리: 아래에서 위로 채우는 순서. (x, y) = 받침 가운데 (그림 폭·높이 비율, y는 위에서부터)
SECTIONS = {
    'E': {'slots': [(0.27, 0.40), (0.73, 0.29)],
          'gate': (0.62, 0.885), 'shops': [(0.62, 0.655), (0.865, 0.685)]},
    'M1': {'slots': [(0.27, 0.82), (0.75, 0.68), (0.24, 0.36), (0.76, 0.22)], 'fountain': (0.51, 0.52)},
    'M2': {'slots': [(0.73, 0.85), (0.26, 0.68), (0.53, 0.47), (0.79, 0.28), (0.28, 0.16)]},
}


def plate_img():
    p = f'{ROOT}/hub/park/rides/empty.webp'
    im = Image.open(p).convert('RGBA')
    bb = im.getchannel('A').getbbox(); im = im.crop(bb)
    return im.resize((PLATE, round(im.height * PLATE / im.width)), Image.LANCZOS)


# 광장 사이 꽃밭·나무 덩어리 (x, y, 반지름) — 초안처럼 돌바닥 광장 사이사이에
GARDENS = {
    'E': [(0.50, 0.44, 70), (0.50, 0.18, 60), (0.14, 0.12, 80), (0.88, 0.47, 75), (0.40, 0.62, 55)],
    'M1': [(0.50, 0.80, 70), (0.50, 0.22, 70), (0.14, 0.56, 80), (0.86, 0.45, 75), (0.30, 0.60, 45)],
    'M2': [(0.50, 0.72, 65), (0.45, 0.25, 70), (0.86, 0.58, 80), (0.14, 0.43, 75), (0.70, 0.08, 50)],
}


def guide(name, sec, out):
    """연두 = 숲·꽃밭·나무, 베이지 = 넓은 돌바닥 광장(놀이공원 바닥), 파랑 = 강, 받침 = 놀이기구 자리(비워 두기)"""
    im = Image.new('RGB', (W, H), (150, 200, 120)); d = ImageDraw.Draw(im)
    pave = (238, 222, 190)
    # 놀이공원 바닥: 가운데 넓은 돌바닥 광장 (양옆 가장자리 10~14%만 숲·강)
    d.rounded_rectangle((0.12 * W, -60, 0.88 * W, H + 60), radius=120, fill=pave)
    for x, y in sec['slots']: d.ellipse((x * W - 215, y * H - 140, x * W + 215, y * H + 140), fill=pave)
    green = (176, 214, 140)
    for x, y, r in GARDENS[name]: d.ellipse((x * W - r * 1.4, y * H - r, x * W + r * 1.4, y * H + r), fill=green)
    river = (120, 180, 230)
    if name == 'E':  # 왼쪽 아래(롤러코스터가 덮는 곳)는 강·숲
        d.polygon([(0, 0.58 * H), (0.42 * W, 0.70 * H), (0.40 * W, H), (0, H)], fill=(150, 200, 120))
        d.line([(0, 0.64 * H), (0.20 * W, 0.72 * H), (0.30 * W, 0.84 * H), (0.34 * W, H)], fill=river, width=70)
    if name == 'M1': d.line([(0.95 * W, 0), (0.93 * W, 0.4 * H), (0.96 * W, 0.75 * H), (0.94 * W, H)], fill=river, width=55)
    if name == 'M2': d.line([(0.05 * W, 0), (0.07 * W, 0.35 * H), (0.04 * W, 0.6 * H), (0.06 * W, H)], fill=river, width=55)
    im = im.filter(ImageFilter.GaussianBlur(5)); d = ImageDraw.Draw(im)
    if 'fountain' in sec:
        x, y = sec['fountain'][0] * W, sec['fountain'][1] * H
        d.ellipse((x - 120, y - 75, x + 120, y + 75), fill=(150, 205, 245), outline=(255, 255, 255), width=10)
        d.ellipse((x - 30, y - 50, x + 30, y + 5), fill=(255, 220, 90))
    if 'gate' in sec:
        x, y = sec['gate'][0] * W, sec['gate'][1] * H
        d.rectangle((x - 230, y - 120, x + 230, y + 120), fill=(200, 210, 240), outline=(90, 110, 200), width=8)
    for x, y in sec.get('shops', []):
        d.rectangle((x * W - 105, y * H - 95, x * W + 105, y * H + 70), fill=(255, 205, 220), outline=(220, 90, 140), width=8)
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
