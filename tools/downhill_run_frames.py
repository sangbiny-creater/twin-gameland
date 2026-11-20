"""다운힐 앱 뒷모습 달리기 그림(GPT R01~R08, making_GPT/다운힐앱/) → downhill-app/lib/chars/<look>_run.webp + .json
 · 흰 바탕을 그림 가장자리에서부터 지움 (바깥과 이어진 흰 부분만 — 흰 바지처럼 테두리 안 흰색은 남음)
 · 크기·발 위치는 지금 게임의 겨울옷 back_run_0 과 같게 (512 캔버스, 첫 장 발 = 그 발 높이). 공중에 뜬 장면은 뜬 그대로
 · 프레임 이름 back_run4_0~3 (오른발 → 모임 → 왼발 → 모임), charv2.js 형식 [x, y, w, h, ox, oy, cw, ch]
   python3 tools/downhill_run_frames.py
"""
import json, os
from PIL import Image, ImageDraw, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'making_GPT', '다운힐앱')
OUT = os.path.join(ROOT, 'downhill-app', 'lib', 'chars')

def cut(path):
    """흰 바탕 지운 그림(원본 캔버스 크기 그대로)과 캐릭터 사각형"""
    im = Image.open(path).convert('RGBA'); w, h = im.size
    work = im.convert('RGB'); M = (255, 0, 255)
    for x, y in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        if sum(work.getpixel((x, y))) > 700: ImageDraw.floodfill(work, (x, y), M, thresh=40)
    al = Image.new('L', (w, h), 255); a = al.load(); p = work.load()
    for y in range(h):
        for x in range(w):
            if p[x, y] == M: a[x, y] = 0
    al = al.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))  # 가장자리 흰 띠 없애기
    im.putalpha(al)
    return im, al.point(lambda v: 255 if v > 40 else 0).getbbox()

for look, files in [('eunyu3', ['R01', 'R02', 'R03', 'R04']), ('eungyeol3', ['R05', 'R06', 'R07', 'R08'])]:
    old = json.load(open(os.path.join(OUT, f'{look}_winter.json')))['frames']['back_run_0']
    w0, h0, ox0, oy0 = old[2], old[3], old[4], old[5]
    foot, cx = oy0 + h0, ox0 + w0 / 2
    cuts = [cut(os.path.join(SRC, f + '.png')) for f in files]
    b1 = cuts[0][1]
    s = h0 / (b1[3] - b1[1])                       # 첫 장 키 = 지금 back_run_0 키
    mid1 = (b1[0] + b1[2]) / 2
    tiles = []
    for im, bb in cuts:
        t = im.crop(bb); t = t.resize((max(1, round(t.width * s)), max(1, round(t.height * s))), Image.LANCZOS)
        ox = round(cx + (bb[0] - mid1) * s)          # 가로: 첫 장 몸 가운데 = 지금 그림 가운데
        oy = round(foot - (b1[3] - bb[1]) * s)       # 세로: 첫 장 발 = 지금 발 (나머지는 원본 높이 차이 그대로)
        tiles.append((t, ox, oy))
    W = sum(t.width for t, _, _ in tiles) + 4 * len(tiles); H = max(t.height for t, _, _ in tiles)
    atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0)); x = 0; frames = {}
    for i, (t, ox, oy) in enumerate(tiles):
        atlas.paste(t, (x, 0), t); frames[f'back_run4_{i}'] = [x, 0, t.width, t.height, ox, oy, 512, 512]; x += t.width + 4
    atlas.save(os.path.join(OUT, f'{look}_run.webp'), lossless=True, method=6)
    json.dump({'frames': frames}, open(os.path.join(OUT, f'{look}_run.json'), 'w'))
    print(look, 'scale', round(s, 3), {k: v[4:6] + v[2:4] for k, v in frames.items()}, 'old', [ox0, oy0, w0, h0])
