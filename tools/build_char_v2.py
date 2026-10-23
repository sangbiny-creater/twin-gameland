"""캐릭터 v2 팩(character/<캐릭터>_character_v2_png_assets)을 게임용 파일로 만든다.

사용: python3 tools/build_char_v2.py eungyeol eungyeol2 [그림 폴더]
  그림 폴더를 안 주면 character/<캐릭터>_character_v2_png_assets/character_v2/<캐릭터>/base
  - common/chars/<look>.webp + .json : 모든 게임이 쓰는 포즈 아틀라스 (common/charv2.js가 읽음)
  - 메뉴·결과 화면용 얼굴/전신 그림 (기존 파일 이름 규칙 그대로)
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

src_name, look = sys.argv[1], sys.argv[2]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = sys.argv[3] if len(sys.argv) > 3 else f'{ROOT}/character/{src_name}_character_v2_png_assets/character_v2/{src_name}/base'
SRC = f'{SRC_DIR}/{src_name}_base_'
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
def hair_box(im):
    """머리카락(갈색) 덩어리: 가운데 x, 맨 위 y, 높이 → 포즈마다 머리 크기를 맞추는 기준"""
    a = np.array(im).astype(int); r, g, b_, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    m = (al > 128) & (r > 70) & (r < 190) & (g > 35) & (g < 130) & (b_ < 95) & (r > g + 15) & (g > b_)
    m = nd.binary_opening(m, iterations=2); lab, n = nd.label(m)
    if n == 0: return None
    sz = nd.sum(m, lab, range(1, n + 1)); ys, xs = np.where(lab == (np.argmax(sz) + 1))
    return xs.mean(), ys.min(), ys.max() - ys.min()
def bbox(im):
    return im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
def place(im, s, src, dst):
    """src 점을 기준으로 s배 하고 그 점을 dst에 둠 (512 캔버스)"""
    big = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    out = Image.new('RGBA', (512, 512)); out.alpha_composite(big, (round(dst[0] - src[0] * s), round(dst[1] - src[1] * s)))
    return out
med = lambda v: sorted(v)[len(v) // 2]
raw = {}
for p in BODY:
    im = clean(load(p), p in STRAYS)
    raw[p] = im.resize((512, 512), Image.LANCZOS) if im.width != 512 else im
hb = {p: hair_box(raw[p]) for p in BODY}
RUNS = [f'run_{i}' for i in range(6)]
ref_h = med([hb[r][2] for r in RUNS]); ref_cx = med([hb[r][0] for r in RUNS]); ref_top = med([hb[r][1] for r in RUNS])
norm = {}
# 1) 달리기: 프레임마다 머리 크기·좌우 위치를 같게 (크기가 들쭉날쭉하면 걸음이 어색해 보임)
for r in RUNS:
    im, (cx, top, h) = raw[r], hb[r]; k = ref_h / h; bb = bbox(im)
    if bb[3] >= 470:  # 땅에 닿은 프레임: 발 위치는 그대로, 머리 가운데만 맞춤
        norm[r] = place(im, k, (cx, bb[3]), (ref_cx, 488))
    else:             # 떠 있는 프레임: 머리 위치를 다른 프레임에 맞춤 (발은 공중)
        norm[r] = place(im, k, (cx, top), (ref_cx, ref_top))
# 2) 서 있는 포즈·점프: 머리 크기를 달리기와 같게 (서 있는 포즈는 발을 488에)
for p in ['idle', 'ready', 'happy', 'cheer', 'jump_up', 'jump_down']:
    im, (cx, top, h) = raw[p], hb[p]; k = max(0.8, min(1.25, ref_h / h)); bb = bbox(im)
    foot = (bb[0] + bb[2]) / 2
    norm[p] = place(im, k, (foot, bb[3]), (256, 488 if p not in ('jump_up', 'jump_down') else bb[3]))
for p in BODY: frames[p] = (norm.get(p, raw[p]), 0.6)
frames['tile_face'] = (load('tile_face'), 192 / load('tile_face').width)
for p in ['face_base', 'face_happy', 'face_sad', 'face_hurt']: frames[p] = (load(p), 256 / load(p).width)
# 헬리콥터: 몸체 + 조종사 + 유리를 미리 합쳐 둠 (조종사는 창문 가운데)
glass = load('heli_glass')
def heli(body, pilot):
    b = load(body)
    if b.width == 1024:  # 1024×640 팩: 몸체 → 조종사(창문 가운데에 맞춰 줄임) → 유리
        c = b.copy(); s = 0.85
        pi = load(pilot).resize((int(512 * s), int(512 * s)), Image.LANCZOS)
        c.alpha_composite(pi, (int(575 - 256 * s), int(335 - 256 * s)))
        c.alpha_composite(glass)
    else:  # 512 팩: 같은 좌표에 조종사 → 몸체 → 유리 (조종사 아래쪽이 몸체에 가려짐)
        c = Image.new('RGBA', b.size); c.alpha_composite(load(pilot)); c.alpha_composite(b); c.alpha_composite(glass)
    return c
HELI = {f'heli_{i}': (f'heli_body_{i}', 'pilot_fly') for i in range(3)}
HELI.update(heli_happy=('heli_body_1', 'pilot_happy'), heli_hurt=('heli_body_1', 'pilot_hurt'), heli_crash=('heli_body_crash', 'pilot_dizzy'))
hc = {k: heli(*v) for k, v in HELI.items()}
# 비행 프레임(0~2)을 합친 범위로 한 번만 자리 잡기 → 모든 헬기 프레임에 똑같이 적용
ub = None
for k in ('heli_0', 'heli_1', 'heli_2'):
    bb = hc[k].getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    ub = bb if ub is None else (min(ub[0], bb[0]), min(ub[1], bb[1]), max(ub[2], bb[2]), max(ub[3], bb[3]))
bw = ub[2] - ub[0]; cw = round(bw / 0.55); ch = round(cw * 640 / 1024); cx0 = (ub[0] + ub[2]) / 2; cy0 = (ub[1] + ub[3]) / 2
for k, c in hc.items():
    out = Image.new('RGBA', (cw, ch)); out.alpha_composite(c, (round(cw / 2 - cx0), round(ch / 2 - cy0)))
    frames[k] = (out.resize((1024, 640), Image.LANCZOS), 0.4)

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
    if name.startswith('swing'):  # 맨 위 12px(손·줄)의 가운데 x (캔버스 기준)
        al = np.array(im.getchannel('A')) > 60; ys, xs = np.where(al[:12])
        meta[name].append(round(ox + xs.mean(), 1))
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
trim(hc['heli_crash'], 200).save(f'{ROOT}/helicopter/assets/{look}_crash.png', optimize=True)
for k, p in [('idle', 'idle'), ('happy', 'happy'), ('dead', 'dead')]:
    trim(norm.get(p, raw[p]), 240).save(f'{ROOT}/stairs/assets/{look}_{k}.png', optimize=True)
trim(load('front_stand'), 600 if load('front_stand').width >= 1024 else 460).save(f'{ROOT}/common/costumes/{look}_base.png', optimize=True)
print(look, 'frames', len(meta), 'atlas', atlas.size, os.path.getsize(f'{ROOT}/common/chars/{look}.webp') // 1024, 'KB')
