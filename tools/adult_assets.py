"""어른 은유·은결 그림 적용 (v0.4) — 받은 GPT 그림(character/adult/, 저장소에 안 올림)을 잘라 게임 그림으로
  python3 tools/adult_assets.py            # 전부
  python3 tools/adult_assets.py chars      # 공통 캐릭터 묶음·얼굴·팝업·캐릭터 고르기·구름·다운힐 SD
  python3 tools/adult_assets.py intro      # 인트로·카드·로고 (언어별로 합침)
  python3 tools/adult_assets.py games      # 다트·두더지·멍멍이·메모리·첫 화면
요청 글: making_GPT/성인캐릭터_교체/ (00_전체안내.txt)
  · 캐릭터 이름(eunyu3·eungyeol3)은 그대로 — v0.3 보관판(v0.3/)과 저장 데이터를 같이 쓰기 때문. 그림 내용만 바뀜
  · 스카이훅만 쓰는 포즈(run_*, grab, swing_* …)는 옛 그림을 그대로 묶음에 남김
  · 새 언어: LANGS 에 추가하고 character/adult/<게임>/L03.png 를 넣으면 됨 (예: 'ja': 'L03')
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as nd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = f'{ROOT}/character/adult'
BODY_H, FOOT = 393 / 512, 488 / 512  # common/charv2.js 와 같음
# 몸 높이 배율: 어른 체형은 머리가 작아서 같은 키로 그리면 얼굴이 안 보임. 은결(181cm)이 은유(164cm)보다 큼
K = {'eunyu': 1.15, 'eungyeol': 1.27}
LOOK = {'eunyu': 'eunyu3', 'eungyeol': 'eungyeol3'}
LETTER = {'eunyu': 'A', 'eungyeol': 'B'}
WEBP = dict(quality=86, alpha_quality=100, method=6)


def key(path, soft=True):
    """초록(#00FF00) 바탕을 투명하게. soft: 캐릭터용 — 머리카락 틈의 초록까지 지움 (로고는 초록 잎이 있어 soft=False)"""
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    k = g - np.maximum(r, b)
    al = np.clip((95 - k) / 60, 0, 1) if soft else np.clip((140 - k) / 60, 0, 1)
    near = nd.binary_dilation(al < 1, iterations=4 if soft else 1)
    a[..., 1] = np.where(near, np.minimum(g, np.maximum(r, b) + (0 if soft else 10)), g)
    al[:6] = 0; al[-6:] = 0; al[:, :6] = 0; al[:, -6:] = 0
    out = Image.fromarray(a.astype(np.uint8)).convert('RGBA')
    out.putalpha(Image.fromarray((al * 255).astype(np.uint8)))
    return out


def tight(im, pad=0):
    bb = im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    return im.crop((max(0, bb[0] - pad), max(0, bb[1] - pad), min(im.width, bb[2] + pad), min(im.height, bb[3] + pad)))


def cuts(im, n, rows=1):
    """시트에서 컷 n 개를 왼쪽→오른쪽(여러 줄이면 윗줄 먼저)으로"""
    m = np.asarray(im.getchannel('A')) > 24
    for it in (9, 6, 3, 1):  # 컷끼리 가까우면 덜 부풀려서 나눔
        lab, cnt = nd.label(nd.binary_dilation(m, iterations=it))
        boxes = [((lab[sl] == i).sum(), sl, i) for i, sl in enumerate(nd.find_objects(lab), 1)]
        boxes.sort(key=lambda b: -b[0])
        big = [b for b in boxes if b[0] > boxes[0][0] * 0.12]
        if len(big) >= n: break
    if len(big) < n:  # 머리카락이 맞닿은 컷: 세로로 가장 빈 줄을 찾아 나눔 (한 줄 시트만)
        if rows != 1: raise SystemExit(f'컷 {n}개를 못 찾음: {len(big)}')
        col = m.sum(0).astype(np.float32); xs = np.where(col > 0)[0]; x0, x1 = xs[0], xs[-1] + 1; cell = (x1 - x0) / n
        at = [x0]
        for i in range(1, n):
            lo, hi = round(x0 + cell * (i - .22)), round(x0 + cell * (i + .22)); at.append(lo + int(np.argmin(col[lo:hi])))
        at.append(x1)
        return [tight(im.crop((at[i], 0, at[i + 1], im.height))) for i in range(n)]
    boxes = big[:n]
    def cx(b): return (b[1][1].start + b[1][1].stop) / 2
    def cy(b): return (b[1][0].start + b[1][0].stop) / 2
    boxes.sort(key=cy); per = (n + rows - 1) // rows; ordered = []
    for r in range(rows): ordered += sorted(boxes[r * per:(r + 1) * per], key=cx)
    out = []
    for _, sl, i in ordered:
        p = np.array(im)[sl].copy(); p[..., 3][lab[sl] != i] = 0
        out.append(tight(Image.fromarray(p)))
    return out


def save(im, rel, **kw):
    p = f'{ROOT}/{rel}'; os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, 'WEBP', **(kw or WEBP)); return im


def scaled(im, s): return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)


def fit_bottom(im, w, h, bg=None):
    s = min(w / im.width, h / im.height); p = scaled(im, s)
    c = Image.new('RGBA', (w, h), bg or (0, 0, 0, 0)); c.alpha_composite(p, ((w - p.width) // 2, h - p.height)); return c


# ---------- 공통 캐릭터 ----------
def ground_frame(cut, s, cw=512):
    """발이 FOOT 높이, 가로는 무게중심이 가운데 오는 charv2 프레임"""
    p = scaled(cut, s); a = np.asarray(p.getchannel('A')).astype(np.float32)
    mx = (a.sum(0) * np.arange(a.shape[1])).sum() / max(1, a.sum())
    ox, oy = round(cw / 2 - mx), round(FOOT * cw - p.height)
    return p, [ox, oy, cw, cw]


def face_frame(cut, cw=256):
    p = scaled(cut, min((cw - 8) / cut.width, (cw - 8) / cut.height))
    return p, [(cw - p.width) // 2, cw - p.height, cw, cw]


def build_look(who, frames):
    l = LETTER[who]; D = f'{SRC}/common_{who}'; k = K[who]
    # 서 있는 컷 키 = 393 * k. 시트마다 배율을 서 있는 컷으로 잼
    a2 = cuts(key(f'{D}/{l}02.png'), 4); s2 = 393 * k / a2[0].height
    for n, c in zip(['idle_0', 'idle_1', 'happy', 'cheer'], a2): frames[n] = ground_frame(c, s2)
    frames['idle'] = frames['idle_0']; frames['ready'] = frames['idle_0']
    a3 = cuts(key(f'{D}/{l}03.png'), 4)
    for n, c in zip(['jump_up', 'hit', 'dizzy', 'dead'], a3): frames[n] = ground_frame(c, s2)
    a4 = cuts(key(f'{D}/{l}04.png'), 5); s4 = 393 * k / a4[0].height
    for n, c in zip(['stairs_idle', 'stairs_ready', 'stairs_jump', 'stairs_land', 'stairs_fall'], a4): frames[n] = ground_frame(c, s4)
    a5 = cuts(key(f'{D}/{l}05.png'), 4)
    for n, c in zip(['stairs_hurt', 'stairs_dizzy', 'stairs_happy', 'stairs_dead'], a5): frames[n] = ground_frame(c, s4)
    a1 = cuts(key(f'{D}/{l}01.png'), 4)
    for n, c in zip(['face_base', 'face_happy', 'face_sad', 'face_hurt'], a1): frames[n] = face_frame(c)
    for n, c in [('tile_face', a1[0]), ('tile_happy', a1[1])]:  # 타일: 얼굴 쪽만 (아래는 타일 칸에서 잘림)
        h = c.crop((0, 0, c.width, min(c.height, round(c.width * 0.92))))
        frames[n] = face_frame(h, 192)
    # 구름 탑승: 지금 구름 그림 위에 어른 상체
    base = f'{ROOT}/character/{LOOK[who]}_v4/base/{LOOK[who]}_base_ride_cloud'
    body = Image.open(f'{base}_body.png').convert('RGBA')
    W, H = body.size; rides = cuts(key(f'{D}/{l}06.png'), 4); rh = H * (0.74 if who == 'eunyu' else 0.80)
    s6 = rh / np.median([r.height for r in rides])
    bb = body.getchannel('A').getbbox(); bh = bb[3] - bb[1]; cx = (bb[0] + bb[2]) / 2; seat = bb[1] + bh * 0.5
    front = body.copy(); fa = np.array(front); fa[:round(bb[1] + bh * 0.42), :, 3] = 0; front = Image.fromarray(fa)  # 구름 아랫부분이 몸 앞으로
    ext = round(H * 0.9); out = {}
    for n, r in zip(['ride_fly', 'ride_happy', 'ride_hurt', 'ride_dizzy'], rides):
        p = scaled(r, s6); c = Image.new('RGBA', (W + 2 * ext, H + ext))
        c.alpha_composite(body, (ext, ext)); c.alpha_composite(p, (round(ext + cx - p.width / 2), round(ext + seat - p.height))); c.alpha_composite(front, (ext, ext)); out[n] = c
    sc = 410 / W
    for n, r in [('heli_0', 'ride_fly'), ('heli_1', 'ride_fly'), ('heli_2', 'ride_fly'), ('heli_happy', 'ride_happy'), ('heli_hurt', 'ride_hurt'), ('heli_crash', 'ride_dizzy')]:
        bbx = out[r].getchannel('A').getbbox(); p = scaled(out[r].crop(bbx), sc)
        frames[n] = (p, [round((bbx[0] - ext) * sc), round((bbx[1] - ext) * sc), 410, 256])
    return a1, cuts(key(f'{D}/{l}07.png'), 5, rows=2), frames, out


def downhill_frames(who, frames):
    i0 = 1 if who == 'eunyu' else 3
    a, b = cuts(key(f'{SRC}/downhill_sd/S0{i0}.png'), 4), cuts(key(f'{SRC}/downhill_sd/S0{i0 + 1}.png'), 4)
    s = 393 / a[0].height
    for n, c in zip(['back_run_0', 'back_run_1', 'back_left', 'back_right'], a): frames[n] = ground_frame(c, s)
    for n, c in zip(['back_hit', 'back_happy', 'back_dead', 'back_boost'], b): frames[n] = ground_frame(c, s)


def pack(old_json, old_img, frames, look):
    """새 프레임 + (옛 묶음에서 안 바뀐 포즈: 스카이훅용) → common/chars/<look>.webp/.json"""
    old = json.load(open(old_json))['frames']; im0 = Image.open(old_img).convert('RGBA')
    items = []
    for n, (p, meta) in frames.items(): items.append((n, p, meta))
    for n, f in old.items():
        if n not in frames:
            x, y, w, h, *m = f; items.append((n, im0.crop((x, y, x + w, y + h)), m))
    uniq = {}; items.sort(key=lambda it: -it[1].height)
    W = 2048; x = y = rowh = 0; rects = {}
    for n, p, m in items:
        if id(p) in uniq: rects[n] = (uniq[id(p)], m); continue
        if x + p.width + 2 > W: x = 0; y += rowh + 2; rowh = 0
        uniq[id(p)] = (x, y, p.width, p.height); rects[n] = (uniq[id(p)], m); x += p.width + 2; rowh = max(rowh, p.height)
    A = Image.new('RGBA', (W, y + rowh))
    done = set()
    for n, p, m in items:
        if id(p) not in done: A.paste(p, uniq[id(p)][:2]); done.add(id(p))
    J = {'look': look, 'frames': {n: [*r, *m] for n, (r, m) in rects.items()}}
    json.dump(J, open(f'{ROOT}/common/chars/{look}.json', 'w'), separators=(',', ':'))
    save(A, f'common/chars/{look}.webp', quality=84, alpha_quality=100, method=6)
    print(look, A.size, len(J['frames']), f"{os.path.getsize(f'{ROOT}/common/chars/{look}.webp') // 1024}KB")


def chars():
    FACE_BG = {'eunyu': (255, 229, 238, 255), 'eungyeol': (222, 238, 255, 255)}
    OLD = f'{ROOT}/v0.3/common/chars'
    for who in LOOK:
        look = LOOK[who]; frames = {}
        faces, pops, frames, rides = build_look(who, frames)
        downhill_frames(who, frames)
        pack(f'{OLD}/{look}.json', f'{OLD}/{look}.webp', frames, look)
        # 얼굴 240 (바탕색 + 머리 쪽)
        for n, c in [('base', faces[0]), ('happy', faces[1]), ('sad', faces[2])]:
            save(fit_bottom(c, 240, 240, FACE_BG[who]).convert('RGB'), f'common/faces/{look}_{n}.webp', quality=88, method=6)
        for n, c in zip(['start', 'good', 'great', 'smile', 'sad'], pops):
            save(fit_bottom(c, 420, 420), f'common/ui/popup/chars/{who}_{n}.webp')
        # 캐릭터 고르기: 키 차이가 보이게 (은결 800 / 은유 725)
        a0 = tight(key(f'{SRC}/common_{who}/{LETTER[who]}00.png'))
        p = scaled(a0, (800 if who == 'eungyeol' else 725) / a0.height); p = scaled(p, min(1, 420 / p.width))
        c = Image.new('RGBA', (420, 817)); c.alpha_composite(p, ((420 - p.width) // 2, 817 - p.height)); save(c, f'hub/select/{who}.webp')
        # 결과 화면 작은 그림
        save(fit_bottom(tight(rides['ride_dizzy']), 300, 220), f'helicopter/assets/chars/{look}_crash.webp')
        save(fit_bottom(faces[0], 160, 160), f'helicopter/assets/chars/face_{look}.webp')
        save(fit_bottom(frames['stairs_happy'][0], 240, 300), f'stairs/assets/chars/{look}_happy.webp')
        save(fit_bottom(frames['stairs_dead'][0], 240, 300), f'stairs/assets/chars/{look}_dead.webp')


# ---------- 인트로·카드·로고 (언어별) ----------
LANGS = {'': 'L01', 'en': 'L02'}  # ''=한국어(지금 경로), 그 밖 = hub/intro/<언어>/, hub/cards/<언어>/
# 게임: (폴더, 세로 로고 (가운데 x, 위 y, 폭), 가로 로고 (x, y, 폭), 카드 자르기 위쪽 y(G01 기준 비율))
GAMES = {
    'helicopter': ('skyrider', (.5, .70, .72), (.5, .03, .34), .15),
    'stairs': ('stairs', (.5, .74, .78), (.5, .04, .36), .08),
    'shisen': ('shisen', (.5, .74, .70), (.5, .03, .32), .08),
    'downhill': ('downhill', (.5, .76, .76), (.5, .03, .36), .14),
    'memory': ('memory', (.5, .76, .78), (.5, .03, .36), .08),
    'mole': ('mole', (.5, .76, .78), (.5, .03, .36), .12),
    'bakery': ('bakery', (.5, .76, .78), (.5, .03, .36), .08),
    'dogsnack': ('dogsnack', (.5, .76, .72), (.5, .03, .34), .08),
    'darts': ('dart', (.5, .76, .78), (.5, .03, .34), .12),
}
PW, PH = 941, 1672
CARD_FRAME = f'{ROOT}/v0.3/hub/cards/shisen.webp'  # 카드 틀 (그림 칸 x10~470, y10~446 은 덮어씀)


def rounded(im, r):
    m = Image.new('L', im.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, im.width - 1, im.height - 1), r, fill=255)
    im = im.convert('RGBA'); im.putalpha(m); return im


def shadowed(base, logo, x, y):
    sh = Image.new('RGBA', base.size); a = logo.getchannel('A').point(lambda v: v // 2)
    sh.paste((30, 20, 40, 255), (x, y + 8), a); base.alpha_composite(sh.filter(ImageFilter.GaussianBlur(8))); base.alpha_composite(logo, (x, y))


def intro():
    for gid, (folder, pl, ll, ctop) in GAMES.items():
        D = f'{SRC}/{folder}'
        g1 = Image.open(f'{D}/G01.png').convert('RGB'); w = round(g1.height * 9 / 16); x0 = (g1.width - w) // 2
        port = g1.crop((x0, 0, x0 + w, g1.height)).resize((PW, PH), Image.LANCZOS).convert('RGBA')
        land = Image.open(f'{D}/G02.png').convert('RGB').resize((1536, 1024), Image.LANCZOS).convert('RGBA')
        for lang, f in LANGS.items():
            sub = f'{lang}/' if lang else ''
            logo = tight(key(f'{D}/{f}.png', soft=False))
            # 세로·가로 인트로
            for base, (cx, ty, lw), name in [(port, pl, gid), (land, ll, gid + '_land')]:
                c = base.copy(); lg = scaled(logo, c.width * lw / logo.width)
                shadowed(c, lg, round(c.width * cx - lg.width / 2), round(c.height * .835 - lg.height) if name == gid else round(c.height * ty))  # 세로: 로고 아래 끝이 START 버튼 위로
                save(c.convert('RGB'), f'hub/intro/{sub}{name}.webp', quality=84, method=6)
            # 카드: 세로 그림을 460x436 으로 잘라 지금 틀에 끼우고 로고를 아래에
            cw, ch = 460, 436; s = cw / g1.width; hh = round(ch / s); top = round(g1.height * ctop)
            pic = g1.crop((0, top, g1.width, top + hh)).resize((cw, ch), Image.LANCZOS).convert('RGBA')
            lg = scaled(logo, 400 / logo.width)
            if lg.height > 170: lg = scaled(lg, 170 / lg.height)
            shadowed(pic, lg, (cw - lg.width) // 2, ch - lg.height - 4)
            card = Image.open(CARD_FRAME).convert('RGBA'); card.alpha_composite(rounded(pic, 30), (10, 10))
            save(card.convert('RGB') if card.getchannel('A').getextrema()[0] == 255 else card, f'hub/cards/{sub}{gid}.webp', quality=88, method=6)
            # 준비 창 로고 (스카이 라이더는 준비 창 로고를 안 씀)
            if gid != 'helicopter':
                save(scaled(logo, 720 / logo.width), f"{gid}/assets/ui/logo{'_' + lang if lang else ''}.webp")
        print(gid)


# ---------- 게임 전용 ----------
def games():
    # 다트: 버튼(틀 2색 × 다트 3색), 왼쪽 아래 상체 3자세
    for who, fr, base in [('eunyu', 'D01', 0), ('eungyeol', 'D02', 3)]:
        frame = tight(key(f'{SRC}/dart/{fr}.png')); frame = scaled(frame, 300 / max(frame.size))
        for i, d in enumerate(['D03', 'D04', 'D05']):
            c = Image.new('RGBA', (300, 300)); c.alpha_composite(frame, ((300 - frame.width) // 2, (300 - frame.height) // 2))
            dart = tight(key(f'{SRC}/dart/{d}.png')); dart = scaled(dart, 200 / max(dart.size))
            c.alpha_composite(dart, ((300 - dart.width) // 2, (300 - dart.height) // 2)); save(c, f'darts/assets/btn/{who}_{i}.webp')
        for i, n in enumerate(['ready', 'aim', 'throw']):
            p = key(f'{SRC}/dart/P0{base + i + 1}.png'); p = p.crop((0, 0, p.width, p.height)); a = np.array(p); a[-8:, :, 3] = a[-9, :, 3]; a[:, :8, 3] = a[:, 9:10, 3]
            save(Image.fromarray(a).resize((560, 560), Image.LANCZOS), f'darts/assets/chars/{who}_{n}.webp')
    # 두더지 함정 캐릭터
    for n, f in [('eunyu', 'C11'), ('eunyu_hit', 'C12'), ('eungyeol', 'C13'), ('eungyeol_hit', 'C14')]:
        save(fit_bottom(tight(key(f'{SRC}/mole/{f}.png')), 456, 432), f'mole/assets/chars/{n}.webp')
    # 멍멍이 간식: 같은 틀로 잘라 8장 (기준: 몸 높이 BODY=440, 은유는 키 차이만큼 작게)
    for who, ids, h in [('eunyu', range(11, 15), 400), ('eungyeol', range(15, 19), 440)]:
        ims = [key(f'{SRC}/dogsnack/T{i}.png') for i in ids]
        bbs = [im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox() for im in ims]
        stand = bbs[0]; s = h / (stand[3] - stand[1])
        x0, x1 = min(b[0] for b in bbs), max(b[2] for b in bbs); y0, y1 = min(b[1] for b in bbs), max(b[3] for b in bbs)
        half = max(stand[0] / 2 + stand[2] / 2 - x0, x1 - (stand[0] + stand[2]) / 2); mid = (stand[0] + stand[2]) / 2
        for n, im, b in zip(['idle', 'throw', 'happy', 'sad'], ims, bbs):
            feet = stand[3]  # 8장의 발이 같은 높이로 그려져 있음
            c = im.crop((round(mid - half), y0, round(mid + half), feet + 4))
            save(scaled(c, s), f'dogsnack/assets/chars/{who}_{n}.webp')
    # 메모리 카드 (고른 22장, 번호 그대로)
    M = 'f04 f05 f10 s02 s05 s06 s09 s11 s13 s14 s15 s16 s17 s19 s23 s24 s29 s30 s31 s32 s33 s34'.split()
    for i, n in enumerate(M, 1):
        im = Image.open(f'{SRC}/memory/M{i:02d}.png').convert('RGB'); w = round(im.height * 240 / 262); x0 = (im.width - w) // 2
        im.crop((x0, 0, x0 + w, im.height)).resize((480, 524), Image.LANCZOS).save(f'{ROOT}/memory/assets/cards/{n}.webp', 'WEBP', quality=82, method=6)
    # 첫 화면
    H = f'{SRC}/hub'
    for f, rel, w in [('H01', 'hub/ui/map/coaster_eunyu.webp', 360), ('H02', 'hub/ui/map/coaster_eungyeol.webp', 360),
                      ('H07', 'common/ui/monet/attend.webp', 420), ('H08', 'common/ui/monet/locked.webp', 420), ('H09', 'common/ui/monet/welcome.webp', 420)]:
        p = tight(key(f'{H}/{f}.png')); save(scaled(p, w / p.width), rel)
    for f, who in [('H03', 'eunyu'), ('H04', 'eungyeol')]:
        p = tight(key(f'{H}/{f}.png')); save(scaled(p, 600 / p.width), f'hub/park/coaster/{who}.webp')
    ic = tight(key(f'{H}/H10.png')); s = max(ic.size); bg = Image.new('RGBA', (s, s), (140, 201, 240, 255)); bg.alpha_composite(ic, ((s - ic.width) // 2, (s - ic.height) // 2))
    bb = round(s * 0.02); bg = bg.crop((bb, bb, s - bb, s - bb)).convert('RGB')
    for n, z in [('icon-180', 180), ('icon-512', 512), ('favicon-16', 16), ('favicon-32', 32), ('favicon-192', 192)]:
        bg.resize((z, z), Image.LANCZOS).save(f'{ROOT}/hub/icons/{n}.png')
    bg.resize((48, 48), Image.LANCZOS).save(f'{ROOT}/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])


STEPS = {'chars': chars, 'intro': intro, 'games': games}
for k in (sys.argv[1:] or STEPS): STEPS[k]()
