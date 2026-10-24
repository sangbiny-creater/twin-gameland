"""GPT 그림 비율 기준 그림 만들기 (캐릭터 제작 가이드 v1 4장)
레퍼런스 정면 그림의 키·비율이 달라도, 얼굴:몸통:다리 = 1:1:1 이고 얼굴 길이가 같은 "비율기준" 그림으로 바꿔 줌.

  1) 눈금 그림 만들기:  python3 tools/make_ratio_guide.py ruler
       → character/v6/눈금_<look>.png (키를 100으로 본 눈금이 옆에 붙은 정면 그림)
  2) 눈금 그림을 보고 5곳의 위치(0~100)를 읽음: 머리카락 맨 위, 이마(얼굴 시작), 턱 끝, 윗옷 끝, 발바닥
       · 이마: 앞머리에 가려졌으면 "앞머리 안쪽에 이마가 있을 자리" (눈썹보다 눈 높이만큼 위) — 쌍둥이 얼굴 폭이 같아 보이면 맞음
  3) 기준 그림 만들기:  python3 tools/make_ratio_guide.py eunyu=0,13,44,76,100 eungyeol=0,14,44,72,100
       → character/v6/비율기준.png (숫자를 안 주면 아래 MARK 값)
  레퍼런스 정면 그림 위치: character/ref_v5/<look>_기준_front_stand.png
"""
import os, sys
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import char_pipeline as C
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = f'{ROOT}/character/ref_v5/{{}}_기준_front_stand.png'
OUT = f'{ROOT}/character/v6'
F = 230  # 얼굴(이마~턱) 길이 px — 몸통·다리도 같은 길이
# 서 있는 키를 100으로 본 위치: 머리카락 맨 위, 이마(머리카락 아래 얼굴 시작), 턱, 윗옷 끝, 발바닥 (은유·은결 v3 에서 잰 값)
MARK = {'eunyu': (0, 13, 44, 76, 100), 'eungyeol': (0, 14, 44, 72, 100)}
BAND = [(255, 214, 102), (255, 140, 180), (90, 160, 255)]  # 얼굴 노랑, 몸통 분홍, 다리 파랑

def load(look):
    im = C.remove_bg(Image.open(REF.format(look))).convert('RGBA'); return im.crop(C.bbox(im))

def ruler(look):
    """눈금 그림: 키 100 기준 5칸마다 빨간 눈금"""
    im = load(look); im = im.resize((int(im.width * 780 / im.height), 780))
    cv = Image.new('RGB', (im.width + 120, 820), 'white'); cv.paste(im, (100, 20), im); d = ImageDraw.Draw(cv)
    for k in range(21):
        y = 20 + int(780 * k / 20); d.line((50, y, cv.width, y) if k % 2 == 0 else (50, y, 90, y), fill=(255, 0, 0) if k % 2 == 0 else (255, 150, 150))
        d.text((8, y - 7), str(k * 5), fill=(255, 0, 0))
    cv.save(f'{OUT}/눈금_{look}.png'); print('눈금 그림:', f'{OUT}/눈금_{look}.png')

def standard(look, mark):
    im = load(look); H = im.height; m = [round(H * p / 100) for p in mark]
    k = F / (m[2] - m[1]); W = round(im.width * k)  # 폭은 얼굴 배율로 (얼굴 길이가 같으면 얼굴 폭도 같아짐)
    parts = [im.crop((0, m[0], im.width, m[1])).resize((W, round((m[1] - m[0]) * k)), Image.LANCZOS)]
    for a, b in zip(m[1:4], m[2:5]): parts.append(im.crop((0, a, im.width, b)).resize((W, F), Image.LANCZOS))
    out = Image.new('RGBA', (W, sum(p.height for p in parts))); y = 0
    for p in parts: out.alpha_composite(p, (0, y)); y += p.height
    return out, parts[0].height

def guide(marks):
    ims = [standard(l, mk) for l, mk in marks.items()]
    top = max(h for _, h in ims); Hh = top + 3 * F
    cv = Image.new('RGB', (110 + sum(i.width + 80 for i, _ in ims) + 30, Hh + 60), (0, 255, 0)); d = ImageDraw.Draw(cv)
    for j, col in enumerate(BAND):  # 왼쪽 색 띠 + 가로 점선
        y0 = 30 + top + j * F; d.rectangle((20, y0 + 3, 70, y0 + F - 3), fill=col)
    for j in range(4):
        y = 30 + top + j * F
        for x in range(80, cv.width - 20, 24): d.line((x, y, x + 12, y), fill=(255, 255, 255), width=3)
    x = 110
    for im, h in ims: cv.paste(im, (x, 30 + top - h), im); x += im.width + 80
    cv.save(f'{OUT}/비율기준.png'); print('비율기준 그림:', f'{OUT}/비율기준.png', cv.size)

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    if sys.argv[1:2] == ['ruler']:
        for l in (sys.argv[2:] or list(MARK)): ruler(l)
    else:
        marks = dict(MARK)
        for a in sys.argv[1:]:
            l, v = a.split('='); marks[l] = tuple(float(x) for x in v.split(','))
        guide(marks)
