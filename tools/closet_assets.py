"""옷장·아이템샵 그림 적용 (v0.4) — 받은 GPT 그림(character/adult2/closet·costume, 저장소에 안 올림)을 잘라 게임 그림으로
  python3 tools/closet_assets.py            # 전부
  python3 tools/closet_assets.py closet     # 방·옷걸이·전신·옷 칸·첫 화면 상반신·상점 그림
  python3 tools/closet_assets.py sheets     # 게임 안 옷 묶음 (common/chars/<look>_<옷>.webp/.json)
  python3 tools/closet_assets.py games      # 다트·멍멍이·두더지 옷 그림 (<게임>/assets/chars/<who>_<옷>…)
요청 글: making_GPT/성인캐릭터_교체2/ (21~27번)
  · 시트 차례(26번 글): G1 서기·기쁨 / G2 점프·실수 / G3 구름 상체 / G4·G5 다운힐 뒷모습 / G6·G7 계단 SD / G8 다트 / G9 멍멍이 / G10 두더지
  · 크기는 옷이 아니라 기준 시트로 잼: 모자·토끼 귀가 있어도 사람이 작아지지 않게
"""
import json, os, sys, unicodedata
import cv2
import numpy as np
from scipy import ndimage as nd
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import adult_assets as A
from adult_assets import ROOT, key, cuts, tight, scaled, save, ground_frame

SRC = f'{ROOT}/character/adult2'
GREEN_COAT = '(C16)'  # 은결 겨울옷은 초록 옷이라 초록 배경을 약하게 지움 (세게 지우면 옷에 구멍이 나고 회색이 됨)
OUTFITS = {
    'eunyu': {None: 1, 'uniform': 2, 'date': 3, 'casual': 4, 'school': 5, 'travel': 6, 'pajamas': 7, 'winter': 15, 'baker': 17},
    'eungyeol': {None: 8, 'streamer': 9, 'daily': 10, 'campus': 11, 'sport': 12, 'travel': 13, 'home': 14, 'winter': 16, 'baker': 18},
}
KO = {'eunyu': '은유', 'eungyeol': '은결'}
STAIRS_K = {'eunyu': 1.0, 'eungyeol': 1.04}  # tools/adult2_assets.py stairs() 와 같음
Q = dict(quality=84, alpha_quality=90, method=6)


# 얼굴 맞추기: 전신 그림(C)의 두 눈 가운데·눈 사이 ↔ 기본 옷 첫 화면 그림(Z01·Z02)·위치 표식의 두 눈 가운데·눈 사이 (그림에서 잰 값)
EYES = {'eunyu': ((497, 190), 78), 'eungyeol': ((503, 153), 65)}
HOME_EYES = {'eunyu': ((288, 197), 87), 'eungyeol': ((341, 186), 85)}
HOME_PAD = 90  # 왼쪽으로 뻗은 팔이 잘리지 않게 왼쪽을 넓힘 (첫 화면 그림은 오른쪽 끝 기준이라 얼굴 자리는 그대로, 지도는 hub.js 가 밀어 줌)
PIN_EYES = {'eunyu': ((97, 88), 39), 'eungyeol': ((98, 88), 36)}
PIN_CIRCLE = (100, 95, 83); PIN_BG = {'eunyu': (251, 214, 229, 255), 'eungyeol': (190, 228, 249, 255)}


def placed(im, who, target, size):
    """전신 그림을 얼굴이 target(두 눈 가운데, 눈 사이)에 맞게 키워 size 캔버스에 놓음"""
    (ex, ey), ed = EYES[who]; (tx, ty), td = target; k = td / ed
    p = scaled(im, k); c = Image.new('RGBA', size); c.paste(p, (round(tx - ex * k), round(ty - ey * k)), p)
    return c


def home_pin(who, oid, im):
    W, H = Image.open(f'{ROOT}/hub/park/home/{who}.webp').size; (tx, ty), td = HOME_EYES[who]
    save(placed(im, who, ((tx + HOME_PAD, ty), td), (W + HOME_PAD, H)), f'hub/park/home/{who}_{oid}.webp', **Q)
    # 위치 표식: 원 안만 새 옷으로 (틀은 기본 표식 그대로)
    pin = Image.open(f'{ROOT}/hub/ui/map/v4/pin_{who}.webp').convert('RGBA'); K = 4; cx, cy, r = PIN_CIRCLE
    (tx, ty), td = PIN_EYES[who]; big = (pin.width * K, pin.height * K)
    disc = Image.new('RGBA', big, PIN_BG[who]); disc.alpha_composite(placed(im, who, ((tx * K, ty * K), td * K), big))
    mask = Image.new('L', big); ImageDraw.Draw(mask).ellipse([(cx - r) * K, (cy - r) * K, (cx + r) * K, (cy + r) * K], fill=255)
    pin.paste(disc.resize(pin.size, Image.LANCZOS), (0, 0), mask.resize(pin.size, Image.LANCZOS))
    save(pin, f'hub/ui/map/v4/pin_{who}_{oid}.webp', **Q)


def closet():
    D = f'{SRC}/closet'
    for who, n in [('eunyu', 'R01'), ('eungyeol', 'R02')]:
        save(Image.open(f'{D}/{n}.png').convert('RGB').resize((900, 1350), Image.LANCZOS), f'closet/assets/room_{who}.webp', quality=82, method=6)
    h = tight(key(f'{D}/R03.png', soft=False)); save(scaled(h, 120 / h.width), 'closet/assets/hanger.webp')
    save(Image.open(f'{D}/S01.png').convert('RGB'), 'shop/assets/v4/top.webp', quality=82, method=6)
    for who, L in OUTFITS.items():
        ims = {oid: key(f'{D}/C{n:02d}.png', soft=n != 16) for oid, n in L.items()}
        # 모든 옷이 같은 틀: 자세가 같으니 옷을 바꿔도 사람이 움직이지 않게
        bbs = [im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox() for im in ims.values()]
        box = (min(b[0] for b in bbs) - 6, min(b[1] for b in bbs) - 6, max(b[2] for b in bbs) + 6, max(b[3] for b in bbs) + 6)
        # 얼굴 가운데가 그림 가운데에 오게 좌우를 맞춤 (팔을 뻗어서 옷 전체의 가운데와 다름) → 화면에서 얼굴이 칸 가운데
        a = np.asarray(ims[None].getchannel('A')) > 128; top = box[1] + 6; h = box[3] - box[1]
        fx = round(np.mean([np.where(r)[0].mean() for r in a[top + round(h * .04):top + round(h * .11)]]))
        half = max(fx - box[0], box[2] - fx); box = (fx - half, box[1], fx + half, box[3])
        for oid, im in ims.items():
            c = im.crop(box); c = scaled(c, 1100 / c.height)
            save(c, f'closet/assets/{who}_{oid or "base"}.webp', **Q)
            save(Image.open(f'{D}/D{L[oid]:02d}.png').convert('RGB').resize((260, 260), Image.LANCZOS), f'closet/assets/item_{who}_{oid or "base"}.webp', quality=80, method=6)
            if oid: home_pin(who, oid, im)
        print(who, box, len(ims))


def folder(who, oid):
    for x in os.listdir(f'{SRC}/costume'):
        if os.path.isdir(f'{SRC}/costume/{x}') and unicodedata.normalize('NFC', x).startswith(f'{KO[who]}_{oid}'): return f'{SRC}/costume/{x}'
    raise SystemExit(f'폴더 없음: {who} {oid}')


def ref_height(rel, n):
    """기준 시트(기본 옷)의 첫 컷 높이. 옷 시트는 같은 크기로 그려져 있어 이 값으로 배율을 잼"""
    return cuts(key(f'{ROOT}/character/{rel}.png'), n)[0].height


HOME_DIR = '(C14)'  # 은결 홈웨어 계단 첫 컷만 머리색이 보라로 나옴 → 데일리룩 같은 컷의 머리를 씀


def fix_hair(c, D):
    o = scaled(cuts(key(f'{folder("eungyeol", "daily")}/G6.png'), 5)[0], 1)
    o = o.resize((c.width, round(o.height * c.width / o.width)), Image.LANCZOS); out = c.copy()
    cut = round(c.height * .34); a = np.array(o); a[cut:] = 0; a[cut - 8:cut, :, 3] = (a[cut - 8:cut, :, 3] * np.linspace(1, 0, 8)[:, None]).astype(np.uint8)
    out.alpha_composite(Image.fromarray(a).crop((0, 0, c.width, min(c.height, o.height)))); return out


def clean(c):
    """컷에 묻어 온 옆 컷의 머리카락 조각을 지움"""
    a = np.array(c); lab, n = nd.label(a[..., 3] > 24); sz = nd.sum(a[..., 3] > 24, lab, range(1, n + 1))
    a[..., 3][~np.isin(lab, [i + 1 for i, v in enumerate(sz) if v > sz.max() * .05])] = 0
    return tight(Image.fromarray(a))


def sheet_frames(who, D, R):
    k, frames = A.K[who], {}
    g = lambda n: key(f'{D}/G{n}.png', soft=GREEN_COAT not in D)
    a = cuts(g(1), 4); s = 393 * k / R['stand']
    for n, c in zip(['idle_0', 'idle_1', 'happy', 'cheer'], a): frames[n] = ground_frame(c, s)
    frames['idle'] = frames['idle_0']; frames['ready'] = frames['idle_0']
    if os.path.exists(f'{D}/G2.png'):
        for n, c in zip(['jump_up', 'hit', 'dizzy', 'dead'], cuts(g(2), 4)): frames[n] = ground_frame(c, s)
    else:  # G2 는 베이커리 실수 순간에만 잠깐 보여서 받지 않음 → 서 있는 포즈로 (기본 옷으로 튀지 않게)
        for n in ['jump_up', 'hit', 'dizzy', 'dead']: frames[n] = frames['idle_1']
    # 구름 탑승 (tools/adult_assets.py build_look 와 같은 방법)
    frames.update(A.ride_frames(who, A.ride_cuts(g(3), 4), R['ride'])[0])
    a = cuts(g(4), 4); s = 393 / R['back']
    for n, c in zip(['back_run_0', 'back_run_1', 'back_left', 'back_right'], a): frames[n] = ground_frame(c, s)
    for n, c in zip(['back_hit', 'back_happy', 'back_dead', 'back_boost'], cuts(g(5), 4)): frames[n] = ground_frame(c, s)
    a = [clean(c) for c in cuts(g(6), 5)]; s = 393 * STAIRS_K[who] / R['stairs']
    if who == 'eungyeol' and D.endswith(HOME_DIR): a[0] = fix_hair(a[0], D)
    for n, c in zip(['stairs_idle', 'stairs_ready', 'stairs_jump', 'stairs_land', 'stairs_fall'], a): frames[n] = ground_frame(c, s)
    if os.path.exists(f'{D}/G7.png'):
        for n, c in zip(['stairs_hurt', 'stairs_dizzy', 'stairs_happy', 'stairs_dead'], cuts(g(7), 4)): frames[n] = ground_frame(c, s)
    else:
        for n, f in [('stairs_hurt', 'stairs_fall'), ('stairs_dizzy', 'stairs_fall'), ('stairs_dead', 'stairs_fall'), ('stairs_happy', 'stairs_jump')]: frames[n] = frames[f]
    return frames


def pack(frames, name):
    """입은 옷 묶음: 바뀌는 포즈만 담음 (없는 포즈는 charv2.js 가 기본 묶음에서 씀)"""
    uniq = {}; items = sorted(frames.items(), key=lambda it: -it[1][0].height); W = 2048; x = y = rowh = 0; rects = {}
    for n, (p, m) in items:
        if id(p) in uniq: rects[n] = (uniq[id(p)], m); continue
        if x + p.width + 2 > W: x = 0; y += rowh + 2; rowh = 0
        uniq[id(p)] = (x, y, p.width, p.height); rects[n] = (uniq[id(p)], m); x += p.width + 2; rowh = max(rowh, p.height)
    im = Image.new('RGBA', (W, y + rowh)); done = set()
    for n, (p, m) in items:
        if id(p) not in done: im.paste(p, uniq[id(p)][:2]); done.add(id(p))
    json.dump({'look': name, 'frames': {n: [*r, *m] for n, (r, m) in rects.items()}}, open(f'{ROOT}/common/chars/{name}.json', 'w'), separators=(',', ':'))
    save(im, f'common/chars/{name}.webp', quality=84, alpha_quality=100, method=6)
    print(name, im.size, len(rects), f"{os.path.getsize(f'{ROOT}/common/chars/{name}.webp') // 1024}KB")


def sheets():
    for who, L in OUTFITS.items():
        l = A.LETTER[who]; c = f'adult/common_{who}/{l}'
        rides = A.ride_cuts(key(f'{ROOT}/character/{c}06.png'), 4)
        R = dict(stand=ref_height(f'{c}02', 4), ride=np.median([r.height for r in rides]),
                 back=ref_height(f'adult/downhill_sd/S0{1 if who == "eunyu" else 3}', 4), stairs=ref_height(f'adult2/stairs_sd/U0{1 if who == "eunyu" else 3}', 5))
        for oid in L:
            if oid and (not ONLY or f'{who}:{oid}' in ONLY): pack(sheet_frames(who, folder(who, oid), R), f'{A.LOOK[who]}_{oid}')


# ---------- 다트·멍멍이·두더지: 기본 그림의 얼굴 자리에 옷 입은 컷의 얼굴을 맞춤 ----------
# 기본 그림(<게임>/assets/chars)에서 얼굴이 있는 네모 (x0, y0, x1, y1)
FACE = {
    'eunyu': {'darts': [(200, 120, 330, 240), (218, 140, 328, 260), (186, 140, 306, 260)],
              'dogsnack': [(100, 14, 146, 57), (92, 14, 136, 57), (92, 14, 136, 57), (92, 14, 136, 57)], 'mole': [(130, 110, 320, 300), (130, 110, 320, 300)]},
    'eungyeol': {'darts': [(200, 108, 320, 228), (218, 118, 328, 238), (186, 118, 286, 228)],
                 'dogsnack': [(120, 14, 170, 57), (130, 14, 180, 57), (110, 14, 160, 57), (120, 14, 170, 57)], 'mole': [(130, 90, 320, 280), (130, 90, 320, 280)]},
}
SCALES = dict(darts=np.geomspace(.7, 1.7, 60), dogsnack=np.geomspace(.42, .75, 40), mole=np.geomspace(.5, .85, 30))


def split_all(im, n, to=None):
    """cuts 와 같지만 떨어진 작은 조각(던진 간식)은 to 번째 컷에 붙여 줌 (to 없으면 버림)"""
    m = np.asarray(im.getchannel('A')) > 24
    for it in (9, 6, 3, 1):
        lab, cnt = nd.label(nd.binary_dilation(m, iterations=it)); sizes = nd.sum(m, lab, range(1, cnt + 1))
        big = [i + 1 for i, v in enumerate(sizes) if v > sizes.max() * .12]
        if len(big) == n: break
    else: return cuts(im, n)
    objs = nd.find_objects(lab); big.sort(key=lambda i: objs[i - 1][1].start); owner = {}
    for i in range(1, cnt + 1):
        owner[i] = i if i in big else big[to] if to is not None else 0
    out = []; arr = np.array(im)
    for b in big:
        keep = np.isin(lab, [i for i, o in owner.items() if o == b]); p = arr.copy(); p[..., 3][~keep] = 0
        out.append(tight(Image.fromarray(p)))
    return out


def gray(im):
    bg = Image.new('RGBA', im.size, (235, 235, 235, 255)); bg.alpha_composite(im.convert('RGBA'))
    return cv2.cvtColor(np.asarray(bg.convert('RGB')), cv2.COLOR_RGB2GRAY)


def find_face(tpl, cut, scales):
    """cut 을 키우고 줄이며 얼굴(tpl)이 가장 잘 맞는 배율·자리"""
    best = (-1, 1, 0, 0); g = gray(cut)
    for s in scales:
        w, h = round(g.shape[1] * s), round(g.shape[0] * s)
        if w < tpl.shape[1] or h < tpl.shape[0]: continue
        r = cv2.matchTemplate(cv2.resize(g, (w, h), interpolation=cv2.INTER_AREA), tpl, cv2.TM_CCOEFF_NORMED); _, v, _, (x, y) = cv2.minMaxLoc(r)
        if v > best[0]: best = (v, s, x, y)
    return best


def game_set(who, game, names, pics, full=False):
    """시트 컷들을 기본 그림과 같은 얼굴 크기·자리로. 반환 [(이름, 얼굴 왼쪽 위에 맞춘 그림, 놓을 x, y)]"""
    tpls, m = [], []
    for n, box, p in zip(names, FACE[who][game], pics):
        base = Image.open(f'{ROOT}/{game}/assets/chars/{who}{n}.webp').convert('RGBA'); t = gray(base.crop(box)); tpls.append((base, box, t)); m.append(find_face(t, p, SCALES[game]))
    s = float(np.median([x[1] for x in m])); out = []
    if game == 'dogsnack':  # 얼굴이 작아 배율이 흔들림 → 얼굴~발 긴 거리로 다시 잼 (첫 자세 기준)
        base, box, t = tpls[0]; p = pics[0]; feet = base.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()[3]
        pb = p.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()[3]
        for _ in range(3): y = find_face(t, p, [s])[3]; s *= (feet - box[1]) / (pb * s - y)
    for (base, box, t), p, n in zip(tpls, pics, names):
        v, _, x, y = find_face(t, p, [s]); out.append((n, base, scaled(p, s), box[0] - x, box[1] - y, v))
    return s, out


ONLY = [x for x in os.environ.get('ONLY', '').split(',') if x]  # ONLY=eungyeol:winter 그 옷만 다시


def games():
    Q2 = dict(quality=86, alpha_quality=100, method=6)
    for who, L in OUTFITS.items():
        for oid in L:
            if not oid: continue
            D = folder(who, oid); g = lambda n: key(f'{D}/G{n}.png', soft=GREEN_COAT not in D)
            # 다트: 560 칸 그대로, 그림이 아래 끝에 못 미치면 그만큼 내려서 몸이 뜨지 않게
            s, L8 = game_set(who, 'darts', ['_ready', '_aim', '_throw'], split_all(g(8), 3))
            down = max(0, *[560 - (y + p.height) + 2 for _, _, p, x, y, _ in L8])
            for n, base, p, x, y, v in L8:
                y += down; c = Image.new('RGBA', base.size); c.alpha_composite(p, (max(x, 0), max(y, 0)), (max(-x, 0), max(-y, 0)))
                save(c, f'darts/assets/chars/{who}_{oid}{n}.webp', **Q2)
            print(who, oid, 'darts', round(s, 2), [round(x[5], 2) for x in L8], down)
            # 멍멍이: 발을 기본 그림 아래 끝에, 모자는 위로 넘쳐도 됨 (dogsnack/game.js 가 그림 크기대로 그림). 좌우는 가운데 기준으로 넓힘
            s, L9 = game_set(who, 'dogsnack', ['_idle', '_throw', '_happy', '_sad'], split_all(g(9), 4, 1))
            print(who, oid, 'dogsnack', round(s, 3), [round(x[5], 2) for x in L9])
            W, H = L9[0][1].size
            for n, base, p, x, y, v in L9:
                bb = p.getchannel('A').point(lambda t: 255 if t > 24 else 0).getbbox(); y2 = H - 4 - bb[3]; ex = max(0, -(x + bb[0]), x + bb[2] - W, 0); et = max(0, -(y2 + bb[1]))
                c = Image.new('RGBA', (W + 2 * ex, H + et)); c.alpha_composite(p, (x + ex, y2 + et))
                save(c, f'dogsnack/assets/chars/{who}_{oid}{n}.webp', **Q2)
            # 두더지: 그림 아래 끝을 맞춤, 모자는 위로 (mole/game.js 가 그림 크기대로 그림)
            s, L10 = game_set(who, 'mole', ['', '_hit'], cuts(g(10), 2))
            print(who, oid, 'mole', round(s, 2), [round(x[5], 2) for x in L10])
            for n, base, p, x, y, v in L10:
                W, H = base.size; y2 = H - p.height; ex = max(0, -x, x + p.width - W); et = max(0, -y2)
                c = Image.new('RGBA', (W + 2 * ex, H + et)); c.alpha_composite(p, (x + ex, y2 + et))
                save(c, f'mole/assets/chars/{who}_{oid}{n}.webp', **Q2)


if __name__ == '__main__':
    what = sys.argv[1:] or ['closet', 'sheets', 'games']
    for w in what: dict(closet=closet, sheets=sheets, games=games)[w]()
