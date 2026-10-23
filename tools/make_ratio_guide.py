"""GPT 그림 비율 기준 그림 만들기: 은유·은결 정면 그림을 얼굴:몸통:다리 = 1:1:1 로 맞춰 나란히 놓고 옆에 색 띠
  python3 tools/make_ratio_guide.py → character/v6/비율기준.png
"""
import os, sys
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import char_pipeline as C
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = 230  # 얼굴(이마~턱) 길이 px — 몸통·다리도 같은 길이
# 서 있는 키를 100으로 본 위치: 머리카락 맨 위, 이마(머리카락 아래 얼굴 시작), 턱, 윗옷 끝, 발바닥
MARK = {'eunyu': (0, 13, 44, 76, 100), 'eungyeol': (0, 14, 44, 72, 100)}
BAND = [(255, 214, 102), (255, 140, 180), (90, 160, 255)]  # 얼굴 노랑, 몸통 분홍, 다리 파랑

def standard(look):
    im = C.remove_bg(Image.open(f'{ROOT}/character/ref_v5/{look}_기준_front_stand.png')).convert('RGBA'); im = im.crop(C.bbox(im))
    H = im.height; m = [round(H * p / 100) for p in MARK[look]]
    k = F / (m[2] - m[1]); W = round(im.width * k)  # 폭은 얼굴 배율로
    parts = [im.crop((0, m[0], im.width, m[1])).resize((W, round((m[1] - m[0]) * k)), Image.LANCZOS)]
    for a, b in zip(m[1:4], m[2:5]): parts.append(im.crop((0, a, im.width, b)).resize((W, F), Image.LANCZOS))
    out = Image.new('RGBA', (W, sum(p.height for p in parts))); y = 0
    for p in parts: out.alpha_composite(p, (0, y)); y += p.height
    return out, parts[0].height

ims = [standard(l) for l in ('eunyu', 'eungyeol')]
top = max(h for _, h in ims); Hh = top + 3 * F
cv = Image.new('RGB', (110 + sum(i.width + 80 for i, _ in ims) + 30, Hh + 60), (0, 255, 0)); d = ImageDraw.Draw(cv)
for j, col in enumerate(BAND):  # 왼쪽 색 띠 + 가로 점선
    y0 = 30 + top + j * F; d.rectangle((20, y0 + 3, 70, y0 + F - 3), fill=col)
for j in range(4):
    y = 30 + top + j * F
    for x in range(80, cv.width - 20, 24): d.line((x, y, x + 12, y), fill=(255, 255, 255), width=3)
x = 110
for im, h in ims:
    cv.paste(im, (x, 30 + top - h), im); x += im.width + 80
os.makedirs(f'{ROOT}/character/v6', exist_ok=True)
cv.save(f'{ROOT}/character/v6/비율기준.png'); print('ok', cv.size)
