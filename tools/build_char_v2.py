"""캐릭터 v2 팩(character/<캐릭터>_character_v2_png_assets)을 게임용 파일로 만든다.

사용: python3 tools/build_char_v2.py eungyeol eungyeol2
  - common/chars/<look>.webp + .json : 모든 게임이 쓰는 포즈 아틀라스 (common/charv2.js가 읽음)
  - 메뉴·결과 화면용 얼굴/전신 그림 (기존 파일 이름 규칙 그대로)
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

src_name, look = sys.argv[1], sys.argv[2]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = f'{ROOT}/character/{src_name}_character_v2_png_assets/character_v2/{src_name}/base/{src_name}_base_'
BG = {'eunyu': (255, 228, 238), 'eungyeol': (221, 238, 255)}[src_name]

def load(p):
    return Image.open(SRC + p + '.png').convert('RGBA')

def clean(im, strays=False):
    """strays=True: 옆 칸에서 딸려 온 조각(몸 위쪽에 떨어져 있는 신발·줄무늬 등)을 지움"""
    if not strays: return im
    a = np.array(im)
    m = a[..., 3] > 20
    lab, n = nd.label(m)
    if n <= 1: return im
    objs = nd.find_objects(lab); sizes = nd.sum(m, lab, range(1, n + 1))
    main = int(np.argmax(sizes)); top = objs[main][0].start
    keep = np.zeros(n + 1, bool)
    for i, sl in enumerate(objs, 1):
        if i - 1 == main or sl[0].start >= top - 4: keep[i] = True
    a[..., 3] = np.where(keep[lab], a[..., 3], 0)
    return Image.fromarray(a)

STRAYS = {'ready', 'run_0', 'run_1', 'run_2', 'run_3', 'run_4', 'run_5'}
BODY = ['idle', 'ready', 'run_0', 'run_1', 'run_2', 'run_3', 'run_4', 'run_5', 'jump_up', 'jump_down', 'land',
        'swing_0', 'swing_1', 'hit', 'dizzy', 'happy', 'cheer', 'dead',
        'back_run_0', 'back_run_1', 'back_left', 'back_right', 'back_hit', 'back_happy', 'back_dead', 'back_boost']
frames = {}  # name -> (image, scale)
for p in BODY: frames[p] = (clean(load(p), p in STRAYS), 0.6)
frames['tile_face'] = (load('tile_face'), 0.75)
for p in ['face_base', 'face_happy', 'face_sad', 'face_hurt']: frames[p] = (load(p), 0.5)
# 헬리콥터: 몸체 + 조종사 + 유리를 미리 합쳐 둠 (조종사는 창문 가운데)
glass = load('heli_glass')
def heli(body, pilot):
    c = load(body).copy(); s = 0.85
    pi = load(pilot).resize((int(512 * s), int(512 * s)), Image.LANCZOS)
    c.alpha_composite(pi, (int(575 - 256 * s), int(335 - 256 * s)))
    c.alpha_composite(glass); return c
for i in range(3): frames[f'heli_{i}'] = (heli(f'heli_body_{i}', 'pilot_fly'), 0.4)
frames['heli_happy'] = (heli('heli_body_1', 'pilot_happy'), 0.4)
frames['heli_hurt'] = (heli('heli_body_1', 'pilot_hurt'), 0.4)
frames['heli_crash'] = (heli('heli_body_crash', 'pilot_dizzy'), 0.4)

# 아틀라스로 묶기: [x, y, w, h, 잘라낸 위치 ox, oy, 원래 캔버스 cw, ch] (모두 줄인 크기 기준)
items = []
for name, (im, s) in frames.items():
    cw, ch = round(im.width * s), round(im.height * s)
    im = im.resize((cw, ch), Image.LANCZOS)
    bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    items.append((name, im.crop(bb), bb[0], bb[1], cw, ch))
items.sort(key=lambda t: -t[1].height)
AW = 2048; x = y = rowh = 0; pos = {}
for name, im, ox, oy, cw, ch in items:
    if x + im.width > AW: x = 0; y += rowh + 2; rowh = 0
    pos[name] = (x, y); x += im.width + 2; rowh = max(rowh, im.height)
atlas = Image.new('RGBA', (AW, y + rowh), (0, 0, 0, 0))
meta = {}
for name, im, ox, oy, cw, ch in items:
    px, py = pos[name]; atlas.alpha_composite(im, (px, py))
    meta[name] = [px, py, im.width, im.height, ox, oy, cw, ch]
os.makedirs(f'{ROOT}/common/chars', exist_ok=True)
atlas.save(f'{ROOT}/common/chars/{look}.webp', quality=90, method=6)
json.dump({'look': look, 'frames': meta}, open(f'{ROOT}/common/chars/{look}.json', 'w'), separators=(',', ':'))

# ----- 메뉴·결과 화면용 그림 (기존 이름 규칙) -----
def face_jpg(p, out):  # 240×240 동그라미 얼굴 (배경색 있음)
    im = load(p); bb = im.getchannel('A').getbbox()
    cx = (bb[0] + bb[2]) // 2; side = int((bb[3] - bb[1]) * 1.02); top = bb[1] - 6
    c = im.crop((cx - side // 2, top, cx + side // 2, top + side))
    bg = Image.new('RGBA', c.size, BG + (255,)); bg.alpha_composite(c)
    bg.convert('RGB').resize((240, 240), Image.LANCZOS).save(out, quality=90)
for k, p in [('base', 'face_base'), ('happy', 'face_happy'), ('sad', 'face_sad')]:
    face_jpg(p, f'{ROOT}/skyhook/assets/{look}_{k}.jpg')
def trim(im, h):
    im = im.crop(im.getchannel('A').getbbox()); return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
trim(load('face_base'), 138).save(f'{ROOT}/helicopter/assets/face_{look}.png', optimize=True)
trim(heli('heli_body_crash', 'pilot_dizzy'), 200).save(f'{ROOT}/helicopter/assets/{look}_crash.png', optimize=True)
for k, p in [('idle', 'idle'), ('happy', 'happy'), ('dead', 'dead')]:
    trim(clean(load(p), p in STRAYS), 240).save(f'{ROOT}/stairs/assets/{look}_{k}.png', optimize=True)
trim(load('front_stand'), 600).save(f'{ROOT}/common/costumes/{look}_base.png', optimize=True)
print(look, 'frames', len(meta), 'atlas', atlas.size, os.path.getsize(f'{ROOT}/common/chars/{look}.webp') // 1024, 'KB')
