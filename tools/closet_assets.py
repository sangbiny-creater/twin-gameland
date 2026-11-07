"""옷장·아이템샵 그림 적용 (v0.4) — 받은 GPT 그림(character/adult2/closet·costume, 저장소에 안 올림)을 잘라 게임 그림으로
  python3 tools/closet_assets.py            # 전부
  python3 tools/closet_assets.py closet     # 방·옷걸이·전신·옷 칸·첫 화면 상반신·상점 그림
  python3 tools/closet_assets.py sheets     # 게임 안 옷 묶음 (common/chars/<look>_<옷>.webp/.json)
요청 글: making_GPT/성인캐릭터_교체2/ (21~27번)
  · 새 옷 시트가 오면 SHEETS 에 폴더를 넣고 profile.js OUTFITS 의 그 옷에 sheet: true
  · 시트 차례(26번 글): G1 서기·기쁨 / G3 구름 상체 / G4·G5 다운힐 뒷모습 / G6·G7 계단 SD / G8 다트 / G9 멍멍이 / G10 두더지
    (G2 점프·실수는 없어도 됨. G7 이 없으면 다친·기쁨 포즈는 G6 컷으로 대신함)
"""
import json, os, sys, unicodedata
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import adult_assets as A
from adult_assets import ROOT, key, cuts, tight, scaled, save, ground_frame

SRC = f'{ROOT}/character/adult2'
OUTFITS = {
    'eunyu': {None: 1, 'uniform': 2, 'date': 3, 'casual': 4, 'school': 5, 'travel': 6, 'pajamas': 7, 'winter': 15, 'baker': 17},
    'eungyeol': {None: 8, 'streamer': 9, 'daily': 10, 'campus': 11, 'sport': 12, 'travel': 13, 'home': 14, 'winter': 16, 'baker': 18},
}
SHEETS = [('eunyu', 'uniform', '은유_uniform게임랜드유니폼(C02)'), ('eungyeol', 'streamer', '은결_streamer스트리머룩(C09)')]
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
        ims = {oid: key(f'{D}/C{n:02d}.png') for oid, n in L.items()}
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


def folder(name):
    for x in os.listdir(f'{SRC}/costume'):
        if unicodedata.normalize('NFC', x) == unicodedata.normalize('NFC', name): return f'{SRC}/costume/{x}'
    raise SystemExit(f'폴더 없음: {name}')


def sheet_frames(who, D):
    k, frames = A.K[who], {}
    g = lambda n: key(f'{D}/G{n}.png')
    a = cuts(g(1), 4); s = 393 * k / a[0].height
    for n, c in zip(['idle_0', 'idle_1', 'happy', 'cheer'], a): frames[n] = ground_frame(c, s)
    frames['idle'] = frames['idle_0']; frames['ready'] = frames['idle_0']
    if os.path.exists(f'{D}/G2.png'):
        for n, c in zip(['jump_up', 'hit', 'dizzy', 'dead'], cuts(g(2), 4)): frames[n] = ground_frame(c, s)
    else:  # G2 는 베이커리 실수 순간에만 잠깐 보여서 받지 않음 → 서 있는 포즈로 (기본 옷으로 튀지 않게)
        for n in ['jump_up', 'hit', 'dizzy', 'dead']: frames[n] = frames['idle_1']
    # 구름 탑승 (tools/adult_assets.py build_look 와 같은 방법)
    base = f'{ROOT}/character/{A.LOOK[who]}_v4/base/{A.LOOK[who]}_base_ride_cloud'
    body = Image.open(f'{base}_body.png').convert('RGBA'); W, H = body.size
    rides = cuts(g(3), 4); ext = round(H * 0.9); rh = H * (0.74 if who == 'eunyu' else 0.80)
    s6 = rh / np.median([r.height for r in rides])
    bb = body.getchannel('A').getbbox(); bh = bb[3] - bb[1]; cx = (bb[0] + bb[2]) / 2; seat = bb[1] + bh * 0.5
    front = body.copy(); fa = np.array(front); fa[:round(bb[1] + bh * 0.42), :, 3] = 0; front = Image.fromarray(fa)
    out = {}
    for n, r in zip(['ride_fly', 'ride_happy', 'ride_hurt', 'ride_dizzy'], rides):
        p = scaled(r, s6); c = Image.new('RGBA', (W + 2 * ext, H + ext))
        c.alpha_composite(body, (ext, ext)); c.alpha_composite(p, (round(ext + cx - p.width / 2), round(ext + seat - p.height))); c.alpha_composite(front, (ext, ext)); out[n] = c
    sc = 410 / W
    for n, r in [('heli_0', 'ride_fly'), ('heli_1', 'ride_fly'), ('heli_2', 'ride_fly'), ('heli_happy', 'ride_happy'), ('heli_hurt', 'ride_hurt'), ('heli_crash', 'ride_dizzy')]:
        bbx = out[r].getchannel('A').getbbox(); p = scaled(out[r].crop(bbx), sc)
        frames[n] = (p, [round((bbx[0] - ext) * sc), round((bbx[1] - ext) * sc), 410, 256])
    a = cuts(g(4), 4); s = 393 / a[0].height
    for n, c in zip(['back_run_0', 'back_run_1', 'back_left', 'back_right'], a): frames[n] = ground_frame(c, s)
    for n, c in zip(['back_hit', 'back_happy', 'back_dead', 'back_boost'], cuts(g(5), 4)): frames[n] = ground_frame(c, s)
    a = cuts(g(6), 5); s = 393 * STAIRS_K[who] / a[0].height
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
    for who, oid, name in SHEETS: pack(sheet_frames(who, folder(name)), f'{A.LOOK[who]}_{oid}')


if __name__ == '__main__':
    what = sys.argv[1:] or ['closet', 'sheets']
    for w in what: dict(closet=closet, sheets=sheets)[w]()
