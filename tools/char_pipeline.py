"""새 캐릭터 자동 파이프라인 (캐릭터 이미지 제작 기준 v4)

  python3 tools/char_pipeline.py gen    <영문이름> <캐릭터명> <기준그림 폴더>   # OpenAI API로 53장 자동 생성 (OPENAI_API_KEY 필요)
  python3 tools/char_pipeline.py import <영문이름> <캐릭터명> <zip 또는 폴더> # GPT가 준 그림 가져오기 + 자동 검수 + 규격 맞추기
  python3 tools/char_pipeline.py build  <영문이름> <캐릭터명> <eunyu|eungyeol> # 게임용 그림 만들기 + 캐릭터 목록에 등록
  python3 tools/char_pipeline.py sheets <영문이름> <캐릭터명> <시트 그림 폴더> <eunyu|eungyeol> [기준그림 폴더]
        → GPT 시트 그림 14장을 잘라 검수하고, 90% 넘게 통과하면 게임에 바로 넣음 (v5 권장)
  python3 tools/char_pipeline.py all    <영문이름> <캐릭터명> <eunyu|eungyeol> <GPT zip(여러 개는 쉼표) 또는 기준그림 폴더> [기준그림 폴더]
        → (API 키가 있으면 gen) → import → build 를 한 번에

결과
  character/<영문이름>_v4/raw/      받은 원본 그림
  character/<영문이름>_v4/base/     규격에 맞춘 투명 PNG 55장 (<영문이름>_base_<포즈>.png)
  character/<영문이름>_v4/검수결과.txt, 모아보기.jpg, 다시요청.txt (통과 못 한 그림만 GPT에게 다시 부탁하는 글)
  common/chars/<영문이름>.webp/.json + 메뉴용 얼굴·전신 그림 + common/chars/looks.js 등록
"""
import base64, csv, glob, io, json, os, re, sys, time, urllib.request, zipfile
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as nd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV = f'{ROOT}/character/트윈게임랜드_새캐릭터_제작목록_v4.csv'

# ---------- 목록 ----------
def manifest():
    rows = list(csv.reader(open(CSV, encoding='utf-8-sig')))[1:]
    out = []
    for no, ch, gr, fn, sz, desc, game in rows:
        pose = fn.split('_base_')[1][:-4]
        w, h = map(int, sz.split('x'))
        out.append(dict(no=int(no), pose=pose, w=w, h=h, desc=desc, group=gr))
    return out

# 포즈 종류 → 맞추는 방법
def kind(pose):
    if pose.startswith('front_'): return 'front'
    if pose.startswith('face_'): return 'face'
    if pose.startswith('tile_'): return 'tile'
    if pose.startswith('ride_cloud'): return 'cloud'
    if pose.startswith('ride_'): return 'ride'
    if pose in ('grab',) or pose.startswith('swing_'): return 'hang'
    if pose in ('dead', 'stairs_dead', 'back_dead'): return 'lying'
    return 'ground'

# ---------- 그림 다루기 ----------
def remove_bg(im):
    """투명이면 그대로, 아니면 네 귀퉁이 색(초록·흰색 등)을 배경으로 보고 지움"""
    im = im.convert('RGBA'); a = np.array(im).astype(np.float32)
    if (a[..., 3] < 250).mean() > 0.05: return im
    h, w = a.shape[:2]; k = max(4, min(h, w) // 40)
    corners = np.concatenate([a[:k, :k, :3].reshape(-1, 3), a[:k, -k:, :3].reshape(-1, 3), a[-k:, :k, :3].reshape(-1, 3), a[-k:, -k:, :3].reshape(-1, 3)])
    bg = np.median(corners, 0)
    dist = np.sqrt(((a[..., :3] - bg) ** 2).sum(2))
    near = dist < 70
    lab, n = nd.label(near)
    edge_ids = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bgm = np.isin(lab, list(edge_ids))
    alpha = np.where(bgm, 0, 255).astype(np.float32)
    # 테두리 부드럽게 + 초록 번짐 빼기
    edge = nd.binary_dilation(bgm, iterations=2) & ~bgm
    alpha[edge] = np.clip((dist[edge] - 30) / 60, 0, 1) * 255
    if bg[1] > bg[0] + 60 and bg[1] > bg[2] + 60:  # 초록 배경: 남은 초록 기운 줄이기
        g = a[..., 1]; lim = np.maximum(a[..., 0], a[..., 2]); a[..., 1] = np.where(g > lim, lim, g)
    a[..., 3] = alpha
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))

def main_part(im):
    a = np.array(im); m = a[..., 3] > 40; lab, n = nd.label(m)
    if n <= 1: return im, 0.0
    sz = nd.sum(m, lab, range(1, n + 1)); order = np.argsort(sz)[::-1]
    second = sz[order[1]] / sz[order[0]]
    keep = np.zeros(n + 1, bool); keep[order[0] + 1] = True
    for i in order[1:]:
        if sz[i] > sz[order[0]] * 0.02: keep[i + 1] = True  # 손에 든 소품 등은 남김
    a[..., 3] = np.where(keep[lab], a[..., 3], 0)
    return Image.fromarray(a), float(second)

def bbox(im, t=40):
    return im.getchannel('A').point(lambda v: 255 if v > t else 0).getbbox()

def head_width(im):
    """위쪽 40% 안에서 가장 긴 연속 가로줄 길이 (치비 캐릭터는 머리가 가장 넓음)"""
    b = bbox(im); a = np.array(im)[b[1]:b[1] + int((b[3] - b[1]) * 0.4), b[0]:b[2], 3] > 60
    runs = []
    for row in a:
        xs = np.where(np.diff(np.concatenate([[0], row.astype(int), [0]])))[0]
        if len(xs): runs.append((xs[1::2] - xs[::2]).max())
    runs.sort(); return float(np.mean(runs[-6:])) if runs else float(b[2] - b[0])

def place(im, s, src, dst, size):
    big = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    out = Image.new('RGBA', size); out.alpha_composite(big, (round(dst[0] - src[0] * s), round(dst[1] - src[1] * s)))
    return out

STAND_H = 393   # 서 있는 키 (512 캔버스) — 쌍둥이 키를 똑같이 맞춤
FACE_REF = 190  # 얼굴·타일·탈것 크기 기준: 은결 v3 의 머리 폭(서 있는 키 393일 때). 머리카락이 넓은 캐릭터는 그만큼 크게

def normalize(im, pose, size, scale_hint=None, std=210):
    """규격 캔버스에 맞추기: std = 이 캐릭터가 서 있는 키 393일 때의 머리 폭 (머리 폭 대신 키로 쌍둥이 크기를 맞춤)"""
    k = kind(pose); b = bbox(im); cx = (b[0] + b[2]) / 2
    hw = head_width(im); f = std / FACE_REF
    if k == 'front':
        s = 2 * std / hw; return place(im, s, (cx, b[3]), (512, 976), size), s
    if k == 'face':
        s = 360 * f / max(hw, b[2] - b[0]) ; return place(im, s, (cx, b[1]), (256, 40), size), s
    if k == 'tile':
        s = min(205 * f, 240) / (b[2] - b[0]); return place(im, s, (cx, (b[1] + b[3]) / 2), (128, 128), size), s
    if k == 'cloud':
        s = 600 / (b[2] - b[0]); return place(im, s, (cx, (b[1] + b[3]) / 2), (512, 380), size), s
    if k == 'ride':
        s = 250 * f / hw; return place(im, s, (cx, b[3]), (512, 370), size), s
    s = std / hw
    if scale_hint and (k == 'lying' or abs(s / scale_hint - 1) > 0.35): s = scale_hint  # 누운 자세 등은 다른 포즈 크기로
    if k == 'hang':
        # 팔 든 매달리기: 손끝~발 길이가 서 있는 키의 1.05배를 넘지 않게 (넘으면 줄 잡을 때 키가 커 보임)
        s = min(s, STAND_H * 1.05 / (b[3] - b[1]))
        top = np.array(im)[b[1]:b[1] + 12, :, 3] > 60; xs = np.where(top.any(0))[0]
        hx = xs.mean() if len(xs) else cx
        return place(im, s, (hx, b[1]), (256, 40), size), s
    a = np.array(im)[..., 3] > 60; ys, xs = np.where(a); mx = xs.mean()
    return place(im, s, (mx, b[3]), (256, 488), size), s

def qa(src_im, im_nobg, pose, ref_hist, full=None):
    """자동 검수: (실패 이유, 확인 필요) — full 은 조각을 지우기 전 그림"""
    bad, warn = [], []
    full = full if full is not None else im_nobg
    a = np.array(im_nobg); al = a[..., 3] > 40; H, W = al.shape
    if al.mean() < 0.02: bad.append('그림이 너무 작거나 비어 있음')
    opaque = a[al][:, :3]
    if len(opaque):
        # 도형으로 칠한 그림은 같은 색 하나로 넓게 칠해져 있음 → 가장 많은 색 20개가 차지하는 비율이 큼
        inner = a[nd.binary_erosion(al, iterations=3)][:, :3]
        if len(inner) > 500:
            code = (inner[:, 0].astype(np.int64) << 16) | (inner[:, 1].astype(np.int64) << 8) | inner[:, 2]
            _, cnt = np.unique(code, return_counts=True); flat = np.sort(cnt)[-20:].sum() / len(code)
            if flat > 0.45: bad.append(f'코드·도형으로 그린 그림 같음 (같은 색 비율 {flat:.0%})')
    # 조각을 지우기 전 그림에서: 화면 가장자리에 닿은 덩어리 = 잘린 몸이나 옆 그림 조각
    fa = np.array(full)[..., 3] > 40; lab, n = nd.label(fa)
    if n:
        sz = nd.sum(fa, lab, range(1, n + 1)); big = sz.max()
        for i, sl in enumerate(nd.find_objects(lab)):
            if sz[i] < big * 0.005: continue
            y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
            if x0 <= 1 or y0 <= 1 or x1 >= W - 1 or y1 >= H - 1:
                bad.append('몸이 잘렸거나 옆 그림 조각이 있음'); break
        # 라벨: 아래쪽의 납작한 네모 덩어리 (파일 이름 글자 칸)
        for i, sl in enumerate(nd.find_objects(lab)):
            y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop; h, w = y1 - y0, x1 - x0
            if sz[i] < big * 0.004 or h < 6: continue
            fill = sz[i] / (h * w); col = np.array(full)[y0:y1, x0:x1][fa[y0:y1, x0:x1]][:, :3].mean(0)
            if w > 2.2 * h and fill > 0.7 and y0 > H * 0.6 and col.min() > 170:
                bad.append('라벨 글자 칸이 그려져 있음'); break
    b = bbox(im_nobg)
    if b:
        # 칼로 자른 듯한 곧은 테두리 = 예전 그림을 잘라 붙인 흔적
        x0, y0, x1, y1 = b; hh, ww = y1 - y0, x1 - x0
        # (그린 그림은 테두리가 반투명하게 부드러움 / 잘라 낸 그림은 테두리 줄이 완전히 불투명)
        A = a[..., 3]
        cols = [(A[y0:y1, x0] >= 250).mean(), (A[y0:y1, x1 - 1] >= 250).mean()]
        rows = [(A[y0, x0:x1] >= 250).mean()] + ([(A[y1 - 1, x0:x1] >= 250).mean()] if kind(pose) not in ('ground', 'front', 'lying', 'face', 'ride') else [])
        if pose != 'ride_cloud_front' and (max(cols) > 0.25 or max(rows) > 0.35): bad.append('곧게 잘린 테두리 (예전 그림을 잘라 쓴 것 같음)')
        # 라벨 글자 칸: 아래쪽에 연분홍·흰색 가로 띠
        rgb = a[..., :3].astype(int)
        pale = al & (rgb[..., 0] > 232) & (rgb[..., 1] > 180) & (rgb[..., 2] > 195) & (np.abs(rgb[..., 0] - rgb[..., 2]) < 45)
        zone = pale[y0 + int(hh * 0.7):y1, x0:x1]; hits = 0
        for row in zone:
            d = np.diff(np.concatenate([[0], row.astype(int), [0]])); st = np.where(d == 1)[0]; en = np.where(d == -1)[0]
            if len(st) and (en - st).max() >= ww * 0.3: hits += 1
        pass  # (흰 양말·소매를 라벨로 잘못 보는 경우가 많아 덩어리 기준 검사만 씀)
        k = kind(pose); bh = (b[3] - b[1]) / H
        if k in ('ground', 'hang', 'front') and bh < 0.4: bad.append('캐릭터가 너무 작음 (조각 같음)')
        if k == 'ride' and bh < 0.25: bad.append('캐릭터가 너무 작음 (조각 같음)')
        if k in ('ground', 'hang') and not pose.startswith('back_') and head_width(im_nobg) > W * 0.75 and (b[3] - b[1]) < H * 0.6: bad.append('얼굴 일부만 크게 확대한 그림 같음')
    if ref_hist is not None and len(opaque) and not pose.startswith('ride_cloud'):
        h = hue_hist(opaque); c = float(np.minimum(h, ref_hist).sum())
        if c < 0.45: warn.append(f'기준 그림과 색이 많이 다름 (닮음 {c:.2f})')
    return list(dict.fromkeys(bad)), warn

def hue_hist(rgb):
    im = Image.fromarray(rgb.reshape(-1, 1, 3).astype(np.uint8)).convert('HSV'); hsv = np.array(im).reshape(-1, 3)
    h = np.histogram(hsv[:, 0], bins=24, range=(0, 256), weights=(hsv[:, 1] > 40).astype(float))[0]
    return h / max(1, h.sum())

# ---------- import ----------
def find_files(src, tmp):
    if src.endswith('.zip'):
        os.makedirs(tmp, exist_ok=True); zipfile.ZipFile(src).extractall(tmp); src = tmp
    files = {}
    for f in glob.glob(f'{src}/**/*', recursive=True):
        if not re.search(r'\.(png|jpe?g|webp)$', f, re.I): continue
        name = os.path.splitext(os.path.basename(f))[0]
        m = re.search(r'_base_(.+)$', name) or re.search(r'^(?:\d+[_\-. ]*)?(.+)$', name)
        files[m.group(1).lower()] = f
    return files

def cmd_import(eid, cname, src, refdir=None):
    out = f'{ROOT}/character/{eid}_v4'; base = f'{out}/base'; raw = f'{out}/raw'
    os.makedirs(base, exist_ok=True); os.makedirs(raw, exist_ok=True)
    files = {}; touch = {}
    for one in src.split(','):
        tp = os.path.join(one, 'touch.json')
        if os.path.isdir(one) and os.path.exists(tp): touch.update(json.load(open(tp)))
    for i, one in enumerate(src.split(',')):  # zip 여러 개(part1,part2)는 쉼표로
        files.update(find_files(one, f'{out}/_unzip{i}'))
    if refdir:  # 기준 그림 2장은 GPT zip에 없으니 기준 그림 폴더에서
        for f in glob.glob(f'{refdir}/*'):
            for p in ('front_stand', 'face_base'):
                if p in os.path.basename(f) and p not in files: files[p] = f
    M = manifest()
    ref = files.get('front_stand')
    ref_hist = None
    if ref:
        r = remove_bg(Image.open(ref)); ra = np.array(r); ref_hist = hue_hist(ra[ra[..., 3] > 40][:, :3])
    report, redo, done = [], [], {}
    # 몸 그림 크기를 맞추려고 서 있는 포즈의 배율을 먼저 구함
    scales = []
    std = 210
    if files.get('idle_0'):  # 서 있는 그림의 키가 STAND_H 가 되는 머리 폭 = 이 캐릭터의 기준 머리 폭
        i0, _ = main_part(remove_bg(Image.open(files['idle_0']))); b0 = bbox(i0)
        std = head_width(i0) * STAND_H / (b0[3] - b0[1]); print(f"  기준 머리 폭 {std:.0f} (얼굴 배율 {std / FACE_REF:.2f})")
    order = sorted(M, key=lambda m: kind(m['pose']) == 'lying')
    for m in order:
        p = m['pose']; f = files.get(p)
        if not f: report.append(f'{m["no"]:>2}. {p}: ✕ 파일 없음'); redo.append((m, ['파일이 없어요'])); continue
        src_im = Image.open(f); src_im.save(f'{raw}/{eid}_base_{p}.png')
        full = remove_bg(src_im); im, _ = main_part(full)
        bad, warn = qa(src_im, im, p, ref_hist, full)
        if p in touch:  # 시트 그림: 잘라 쓴 흔적 검사는 빼고, 시트 가장자리에서 잘렸는지만 봄
            bad = [x for x in bad if '곧게 잘린' not in x and '조각이 있음' not in x]
            t = touch[p]; allow_bottom = kind(p) in ('face', 'tile', 'ride')
            if t[0] or t[1] or t[2] or (t[3] and not allow_bottom): bad.append('그림 가장자리에서 몸이 잘림')
        if bad:
            report.append(f'{m["no"]:>2}. {p}: ✕ ' + ' / '.join(bad + warn)); redo.append((m, bad + warn)); continue
        hint = float(np.median(scales)) if scales else None
        fixed, s = normalize(im, p, (m['w'], m['h']), hint, std)
        if kind(p) == 'ground': scales.append(s)
        fixed.save(f'{base}/{eid}_base_{p}.png', optimize=True); done[p] = True
        report.append(f'{m["no"]:>2}. {p}: ○' + (' (확인 필요: ' + ' / '.join(warn) + ')' if warn else ''))
    ok = len(done); total = len(M)
    head = [f'[{cname} / {eid}] 자동 검수 결과: 통과 {ok}/{total}', '']
    open(f'{out}/검수결과.txt', 'w', encoding='utf-8').write('\n'.join(head + sorted(report, key=lambda s: int(s.split('.')[0]))))
    # GPT에게 다시 부탁하는 글
    if redo:
        L = [f'캐릭터명: {cname}   영문 이름: {eid}', '',
             '아래 그림만 다시 그려줘. 규칙은 지난번 요청문과 같아 (이미지 생성 기능으로만, 코드·도형·잘라 쓰기 금지, 단색 초록 배경, 캐릭터 1명 전체가 화면 안에, 기준 그림과 같은 캐릭터).',
             '다 그리면 zip 파일 하나로 묶어서 줘 (zip으로 묶는 데만 코드를 써도 돼).', '']
        for m, why in sorted(redo, key=lambda x: x[0]['no']):
            L.append(f'- {eid}_base_{m["pose"]}.png — {m["desc"]}  ← 다시 그리는 이유: {", ".join(why)}')
        open(f'{out}/다시요청.txt', 'w', encoding='utf-8').write('\n'.join(L))
    elif os.path.exists(f'{out}/다시요청.txt'): os.remove(f'{out}/다시요청.txt')
    contact(base, raw, f'{out}/모아보기.jpg', eid, M)
    print('\n'.join(head)); print(f'  검수결과: {out}/검수결과.txt'); print(f'  모아보기: {out}/모아보기.jpg')
    if redo: print(f'  다시 요청할 그림 {len(redo)}장: {out}/다시요청.txt')
    return ok, total

def contact(base, raw, path, eid, M):
    F = ImageFont.truetype('/System/Library/Fonts/AppleSDGothicNeo.ttc', 13)
    cell = 130; cols = 11; rows = (len(M) + cols - 1) // cols
    c = Image.new('RGB', (cols * cell, rows * (cell + 18)), (90, 140, 200)); d = ImageDraw.Draw(c)
    for i, m in enumerate(M):
        x = (i % cols) * cell; y = (i // cols) * (cell + 18); p = m['pose']
        f = f'{base}/{eid}_base_{p}.png'; ok = os.path.exists(f)
        if not ok and os.path.exists(f'{raw}/{eid}_base_{p}.png'): f = f'{raw}/{eid}_base_{p}.png'
        if os.path.exists(f):
            t = Image.open(f).convert('RGBA'); t.thumbnail((cell - 6, cell - 6)); bg = Image.new('RGB', t.size, (90, 140, 200)); bg.paste(t, mask=t.getchannel('A')); c.paste(bg, (x + 3, y + 3))
        if not ok: d.rectangle((x + 1, y + 1, x + cell - 2, y + cell - 2), outline=(230, 40, 60), width=4)
        d.text((x + 3, y + cell + 1), p[:18], font=F, fill=(255, 255, 255) if ok else (255, 210, 210))
    c.save(path, quality=85)


# ---------- 시트 방식 (v5): GPT가 그림 1장에 같은 묶음 포즈를 나란히 그림 → 자동으로 잘라 파일로 ----------
# 한 장에 같이 그리면 머리 크기·그림체가 가장 잘 맞아요. 순서: 왼쪽 → 오른쪽, 윗줄 → 아랫줄
SHEETS = [
    ('S01', '얼굴 표정 4', ['face_base', 'face_happy', 'face_sad', 'face_hurt'], 1),
    ('S02', '정면 전신 2', ['front_stand', 'front_cheer'], 1),
    ('S03', '달리기 8 (2줄)', [f'run_{i}' for i in range(8)], 2),
    ('S04', '서기·출발·멈춤', ['idle_0', 'idle_1', 'run_start', 'run_stop'], 1),
    ('S05', '점프·착지', ['jump_up', 'jump_down', 'land', 'release'], 1),
    ('S06', '줄 매달리기', ['grab', 'swing_0', 'swing_1', 'swing_2'], 1),
    ('S07', '다침·기쁨·응원·넘어짐', ['hit', 'happy', 'cheer', 'dead'], 1),
    ('S08', '계단 1 (3/4 시점)', ['stairs_idle', 'stairs_ready', 'stairs_jump', 'stairs_land', 'stairs_fall'], 1),
    ('S09', '계단 2 (3/4 시점)', ['stairs_hurt', 'stairs_dizzy', 'stairs_happy', 'stairs_dead'], 1),
    ('S10', '뒷모습 달리기', ['back_run_0', 'back_run_1', 'back_left', 'back_right'], 1),
    ('S11', '뒷모습 동작', ['back_hit', 'back_happy', 'back_dead', 'back_boost'], 1),
    ('S12', '구름 탑승 상반신', ['ride_fly', 'ride_happy', 'ride_hurt', 'ride_dizzy'], 1),
    ('S13', '사천성 타일 얼굴', ['tile_face', 'tile_happy'], 1),
    ('S14', '별구름 탈것', ['ride_cloud_body'], 1),
]

def split_sheet(path, names, rows):
    """초록 배경 시트에서 캐릭터 덩어리를 찾아 순서대로 잘라 돌려줌. 개수가 안 맞으면 None"""
    im = remove_bg(Image.open(path)); a = np.array(im); m = a[..., 3] > 40
    N = len(names); H0, W0 = m.shape
    if names[0].startswith('stairs_'):  # 계단 블록(회색, 채도 낮음) 먼저 지움
        rgb = a[..., :3].astype(int); sat = rgb.max(2) - rgb.min(2); v = rgb.max(2)
        gray = m & (sat < 24) & (v > 100) & (v < 240)
        gl, gn = nd.label(nd.binary_opening(gray, iterations=2))
        if gn:
            gsz = nd.sum(gray, gl, range(1, gn + 1))
            kill = nd.binary_dilation(np.isin(gl, [i + 1 for i, v2 in enumerate(gsz) if v2 > 2500]), iterations=2)
            a[..., 3] = np.where(kill, 0, a[..., 3]); m = a[..., 3] > 40
    m2 = nd.binary_closing(m, structure=np.ones((5, 5)))  # 머리카락·손가락 사이 작은 틈 메우기
    lab, n = nd.label(m2)
    if n == 0: return None, '그림에서 캐릭터를 못 찾음'
    sz = nd.sum(m2, lab, range(1, n + 1)); order = np.argsort(sz)[::-1]
    big = [i for i in order if sz[i] > sz[order[0]] * 0.15]
    if names[0].startswith('stairs_'):  # 사람과 떨어진 계단 블록 덩어리(거의 다 흐린 회색)는 사람으로 안 셈
        rgb = a[..., :3].astype(int); dull = (rgb.max(2) - rgb.min(2)) < 45
        big = [i for i in big if dull[lab == i + 1].mean() < 0.6]
    if len(big) < N and rows == 1:
        # 캐릭터끼리 살짝 붙은 경우: 세로로 가장 비어 있는 곳에서 나눔
        col = m.sum(0).astype(float); xs = np.where(col > 0)[0]; L, R = xs.min(), xs.max()
        cuts = []
        for k in range(1, N):
            c0 = L + (R - L) * k / N; lo, hi = int(c0 - (R - L) / N * 0.35), int(c0 + (R - L) / N * 0.35)
            cuts.append(lo + int(np.argmin(col[lo:hi])))
        lab = np.zeros_like(lab); edges = [0] + cuts + [W0]
        for k in range(N):
            part = m2.copy(); part[:, :edges[k]] = False; part[:, edges[k + 1]:] = False
            pl, pn = nd.label(part)
            if pn: psz = nd.sum(part, pl, range(1, pn + 1)); lab[pl == (np.argmax(psz) + 1)] = k + 1
        n = N; sz = nd.sum(lab > 0, lab, range(1, N + 1)); order = np.argsort(sz)[::-1]
        big = list(range(N))
    if len(big) < N: return None, f'캐릭터가 {N}명이어야 하는데 {len(big)}명만 보임 (붙어 있거나 빠짐)'
    if len(big) > N: return None, f'캐릭터가 {N}명이어야 하는데 {len(big)}명이 그려짐 (다른 묶음 그림 같음)'
    keep = big
    objs = nd.find_objects(lab)
    boxes = [(objs[i], i + 1) for i in keep]
    cy = lambda b: (b[0][0].start + b[0][0].stop) / 2; cx = lambda b: (b[0][1].start + b[0][1].stop) / 2
    boxes.sort(key=cy)
    per = (N + rows - 1) // rows; ordered = []
    for r in range(rows): ordered += sorted(boxes[r * per:(r + 1) * per], key=cx)
    out = {}; touch = {}
    for name, (sl, li) in zip(names, ordered):
        touch[name] = [sl[1].start <= 2, sl[0].start <= 2, sl[1].stop >= W0 - 2, sl[0].stop >= H0 - 2]  # 왼·위·오른·아래
        pad = 6; y0, y1 = max(0, sl[0].start - pad), min(a.shape[0], sl[0].stop + pad); x0, x1 = max(0, sl[1].start - pad), min(a.shape[1], sl[1].stop + pad)
        piece = a[y0:y1, x0:x1].copy(); mask = nd.binary_dilation(lab[y0:y1, x0:x1] == li, iterations=3)
        piece[..., 3] = np.where(mask, piece[..., 3], 0)
        if name.startswith('stairs_'):  # GPT가 계단 블록을 같이 그린 경우 지움
            rgb = piece[..., :3].astype(int); sat = rgb.max(2) - rgb.min(2); v = rgb.max(2)
            gray = (sat < 40) & (v > 110) & (v < 238) & (piece[..., 3] > 40)
            gray[:int(piece.shape[0] * 0.55)] = False
            # 베이지 블록은 피부색과 비슷해서 크기로 가름: 넓고 매끈한 덩어리(몸의 8% 넘게)면 블록 (다리·얼굴은 훨씬 작음)
            beige = (sat < 62) & (v > 150) & (v < 253) & (piece[..., 3] > 40); beige[:int(piece.shape[0] * 0.5)] = False
            bl, bn = nd.label(nd.binary_opening(beige, iterations=4))
            if bn:
                bsz = nd.sum(bl > 0, bl, range(1, bn + 1)); body = (piece[..., 3] > 40).sum()
                gray = gray | nd.binary_dilation(np.isin(bl, [i + 1 for i, v2 in enumerate(bsz) if v2 > body * 0.08]), iterations=4)
            gl, gn = nd.label(nd.binary_opening(gray, iterations=2))
            if gn:
                gsz = nd.sum(gray, gl, range(1, gn + 1))
                kill = np.isin(gl, [i + 1 for i, v2 in enumerate(gsz) if v2 > 1500])
                kill = nd.binary_dilation(kill, iterations=2)
                piece[..., 3] = np.where(kill, 0, piece[..., 3])
                # 발밑에 남은 블록 윗면(흐린 색, 테두리 선만 진함): 신발 색(진한 색) 맨 아래보다 밑은 지움
                strong = (piece[..., 3] > 40) & (sat > 60)
                rows_s = np.where(strong.sum(1) >= 3)[0]
                if len(rows_s): piece[rows_s.max() + 10:, :, 3] = 0
                kp, kn = nd.label(piece[..., 3] > 40)
                if kn > 1:
                    ksz = nd.sum(piece[..., 3] > 40, kp, range(1, kn + 1)); keepm = kp == (np.argmax(ksz) + 1)
                    keepm = nd.binary_dilation(keepm, iterations=2); piece[..., 3] = np.where(keepm, piece[..., 3], 0)
        c = Image.fromarray(piece); big = Image.new('RGBA', (c.width + 80, c.height + 80)); big.alpha_composite(c, (40, 40))
        out[name] = big
    split_sheet.touch.update(touch)
    return out, None
split_sheet.touch = {}

def sheet_shape(parts):
    """잘라낸 캐릭터들의 모양 특징: 매달림(손이 맨 위 가운데에 좁게) · 뒷모습(얼굴 살색 적음) · 상반신(키가 낮음)"""
    hang = back = ride = 0
    for im in parts:
        a = np.array(im); al = a[..., 3] > 60; b = bbox(im); w = b[2] - b[0]; h = b[3] - b[1]
        top = al[b[1]:b[1] + max(3, int(h * 0.08)), b[0]:b[2]]; tw = np.where(top.any(0))[0]
        if len(tw) and (tw.max() - tw.min()) < w * 0.4: hang += 1
        up = a[b[1]:b[1] + int(h * 0.45), b[0]:b[2]]; r, g, bb, aa = [up[..., i].astype(int) for i in range(4)]
        skin = ((aa > 128) & (r > 200) & (g > 150) & (bb > 120) & (r > bb + 25)).sum() / max(1, (aa > 128).sum())
        if skin < 0.06: back += 1
        if h < w * 1.35: ride += 1
    n = max(1, len(parts)); return hang / n, back / n, ride / n

EXPECT = {'S06': 'hang', 'S12': 'ride'}
def shape_ok(sid, parts):
    hang, back, ride = sheet_shape(list(parts.values()))
    want = EXPECT.get(sid)
    if want == 'hang': return hang >= 0.5
    if want == 'back': return back >= 0.5
    if want == 'ride': return ride >= 0.5
    if sid in ('S01', 'S13', 'S14', 'S07', 'S02'): return True  # 얼굴·넘어짐 등은 모양으로 안 가림
    return hang < 0.5

def cmd_sheets(eid, cname, folder, refdir=None):
    """folder 안의 시트 그림(저장한 순서 = S01~S14)을 잘라 import 까지"""
    imgs = sorted([f for f in glob.glob(f'{folder}/*') if re.search(r'\.(png|jpe?g|webp)$', f, re.I)], key=lambda f: (os.path.getmtime(f), f))
    named = {}
    for f in imgs:  # 파일 이름에 S01 같은 번호가 있으면 그걸 씀
        mm = re.search(r'S(\d{2})', os.path.basename(f), re.I)
        if mm: named[f'S{mm.group(1)}'] = f
    rest = [f for f in imgs if f not in named.values()]
    # 14장 뒤에 더 넣은 그림 = 다시요청.txt 로 다시 받은 시트 (요청한 순서대로 그 시트를 바꿈)
    vd = f'{ROOT}/character/{eid}_v4'; os.makedirs(vd, exist_ok=True)
    try: redo_map = json.load(open(f'{vd}/다시배정.json'))
    except Exception: redo_map = {}
    extra = [f for f in rest[len(SHEETS) - len(named):] if os.path.basename(f) not in redo_map.values()]
    if extra and os.path.exists(f'{vd}/다시요청.txt'):
        asked = re.findall(r'^(S\d{2}) ', open(f'{vd}/다시요청.txt', encoding='utf-8').read(), re.M)
        for sid, f in zip(asked, extra): redo_map[sid] = os.path.basename(f)
        json.dump(redo_map, open(f'{vd}/다시배정.json', 'w'), ensure_ascii=False)
    rest = rest[:len(SHEETS) - len(named)]
    redo_f = {sid: f'{folder}/{b}' for sid, b in redo_map.items() if os.path.exists(f'{folder}/{b}')}
    out = f'{ROOT}/character/{eid}_v4/cut'; os.makedirs(out, exist_ok=True)
    log = []; check = []
    for sid, title, names, rows in SHEETS:
        f = named.get(sid) or (rest.pop(0) if rest else None)
        f = redo_f.get(sid, f)  # 다시 받은 그림이 있으면 그걸 씀 (원래 순서 자리는 그대로 넘김)
        if not f: log.append(f'{sid} {title}: ✕ 시트 그림 없음'); continue
        parts, err = split_sheet(f, names, rows)  # 저장한 순서를 그대로 믿음 (다른 시트를 끌어오지 않음)
        if err: log.append(f'{sid} {title}: ✕ {err} ({os.path.basename(f)})'); continue
        for nm, im in parts.items(): im.save(f'{out}/{eid}_base_{nm}.png')
        check.append((sid, title, f))
        log.append(f'{sid} {title}: ○ {len(parts)}장 잘라냄 ({os.path.basename(f)})')
    # 구름 앞부분: 구름 몸체 아래쪽 45%를 잘라 캐릭터 앞에 겹침
    cb = f'{out}/{eid}_base_ride_cloud_body.png'
    if os.path.exists(cb):
        c = Image.open(cb).convert('RGBA'); a = np.array(c); b = bbox(c)
        a[:b[1] + int((b[3] - b[1]) * 0.55), :, 3] = 0; Image.fromarray(a).save(f'{out}/{eid}_base_ride_cloud_front.png')
    json.dump(split_sheet.touch, open(f'{out}/touch.json', 'w'))
    open(f'{ROOT}/character/{eid}_v4/시트자르기.txt', 'w', encoding='utf-8').write('\n'.join(log))
    # 시트 확인 그림: 묶음 이름 옆에 그 묶음으로 쓰인 그림 (순서가 맞는지 눈으로 확인)
    F = ImageFont.truetype('/System/Library/Fonts/AppleSDGothicNeo.ttc', 22)
    c = Image.new('RGB', (2 * 620, ((len(check) + 1) // 2) * 230), (245, 248, 252)); d = ImageDraw.Draw(c)
    for i, (sid, title, f) in enumerate(check):
        x, y = (i % 2) * 620, (i // 2) * 230; t = Image.open(f).convert('RGB'); t.thumbnail((400, 210)); c.paste(t, (x + 210, y + 10))
        d.text((x + 10, y + 90), f'{sid}\n{title}', font=F, fill=(30, 40, 70))
    c.save(f'{ROOT}/character/{eid}_v4/시트확인.jpg', quality=82)
    print('\n'.join(log))
    res = cmd_import(eid, cname, out, refdir)
    # 다시 요청은 시트 단위로 (통과 못 한 그림이 들어 있는 시트만, GPT에 그대로 붙여 넣는 글)
    try:
        sys.path.insert(0, f'{ROOT}/tools'); import make_prompts_v5 as MP
        key = 'eungyeol' if eid.startswith('eungyeol') else 'eunyu'
        rep = open(f'{ROOT}/character/{eid}_v4/검수결과.txt', encoding='utf-8').read()
        fails = {ln.split('. ')[1].split(':')[0] for ln in rep.splitlines() if '✕' in ln and '. ' in ln}
        need = [sid for sid, title, names, rows in SHEETS if fails & set(names)]
        if 'ride_cloud_front' in fails and 'S14' not in need: need.append('S14')
        path = f'{ROOT}/character/{eid}_v4/다시요청.txt'
        if need:
            why = {sid: sorted({ln.split('✕ ')[1] for ln in rep.splitlines() if '✕' in ln and ln.split('. ')[1].split(':')[0] in dict((x[0], x[2]) for x in SHEETS)[sid]}) for sid in need}
            body = ['아래 그림만 처음 규칙 그대로 다시 그려 줘. 한 답변에 1장씩, 다 그리면 "다음"이라고만 쓰고 멈춰.', '']
            for sid in need: body += [MP.one_sheet(key, sid), f'  (다시 그리는 이유: {" / ".join(why[sid])})', '']
            open(path, 'w', encoding='utf-8').write('\n'.join(body)); print(f'  다시 그릴 시트: {", ".join(need)} → {path}')
    except Exception as e: print('  (다시요청 만들기 실패)', e)
    return res

# ---------- gen (OpenAI 이미지 API) ----------
STYLE = ('Chibi child character, 2~2.5 heads tall, soft watercolor anime style, clean dark outline 3-4px, '
         'exactly the same character, face, hair, hair ribbon, glasses, outfit, colors and art style as the reference images. '
         'Single character only, full body fully inside the frame, centered, transparent background, no text, no shadow, no props unless asked.')
POSE_EN = {}  # 필요하면 포즈 설명을 영어로 덮어쓰기
def multipart(fields, files):
    bnd = '----twin' + str(time.time()).replace('.', ''); body = io.BytesIO()
    for k, v in fields.items(): body.write(f'--{bnd}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    for k, (fn, data, ct) in files:
        body.write(f'--{bnd}\r\nContent-Disposition: form-data; name="{k}"; filename="{fn}"\r\nContent-Type: {ct}\r\n\r\n'.encode()); body.write(data); body.write(b'\r\n')
    body.write(f'--{bnd}--\r\n'.encode()); return body.getvalue(), bnd

def gen_one(key, refs, prompt, out):
    files = []
    for r in refs:
        b = io.BytesIO(); Image.open(r).convert('RGBA').save(b, 'PNG'); files.append(('image[]', (os.path.basename(r), b.getvalue(), 'image/png')))
    body, bnd = multipart({'model': os.environ.get('OPENAI_IMAGE_MODEL', 'gpt-image-1'), 'prompt': prompt, 'size': '1024x1024',
                           'background': 'transparent', 'quality': 'high', 'n': '1'}, files)
    req = urllib.request.Request('https://api.openai.com/v1/images/edits', data=body, method='POST',
                                 headers={'Authorization': f'Bearer {key}', 'Content-Type': f'multipart/form-data; boundary={bnd}'})
    with urllib.request.urlopen(req, timeout=300) as r: j = json.loads(r.read())
    open(out, 'wb').write(base64.b64decode(j['data'][0]['b64_json']))

def cmd_gen(eid, cname, refdir, only=None):
    key = os.environ.get('OPENAI_API_KEY')
    if not key: print('OPENAI_API_KEY 가 없어요. ChatGPT에서 받은 zip을 import 로 넣어 주세요.'); return False
    refs = sorted(glob.glob(f'{refdir}/*front_stand*'))[:1] + sorted(glob.glob(f'{refdir}/*face_base*'))[:1]
    refs += [f for f in sorted(glob.glob(f'{refdir}/*')) if re.search(r'\.(png|jpe?g|webp)$', f, re.I) and f not in refs][:2]
    if not refs: print('기준 그림이 없어요:', refdir); return False
    gdir = f'{ROOT}/character/{eid}_v4/gen'; os.makedirs(gdir, exist_ok=True)
    # 기준 그림 2장은 그대로 씀
    for p in ('front_stand', 'face_base'):
        f = sorted(glob.glob(f'{refdir}/*{p}*'))
        if f: Image.open(f[0]).save(f'{gdir}/{eid}_base_{p}.png')
    for m in manifest():
        p = m['pose']; out = f'{gdir}/{eid}_base_{p}.png'
        if (only and p not in only) or (not only and os.path.exists(out)): continue
        prompt = f'{STYLE} Character: {cname}. Pose / content: {POSE_EN.get(p, m["desc"])} (file {p}).'
        if kind(p) == 'cloud': prompt = f'A fluffy white cartoon cloud vehicle for the character, no character, matching the art style. {m["desc"]}. Transparent background, no text.'
        for tryn in range(3):
            try: gen_one(key, refs, prompt, out); print('  그림 생성', p); break
            except Exception as e: print('  다시 시도', p, e); time.sleep(5)
    return gdir

# ---------- build ----------
def cmd_build(eid, cname, base_look):
    src = f'{ROOT}/character/{eid}_v4/base'; S = lambda p: f'{src}/{eid}_base_{p}.png'
    have = lambda p: os.path.exists(S(p))
    L = lambda p: Image.open(S(p)).convert('RGBA')
    frames = {}
    alias = {'idle': 'idle_0', 'ready': 'stairs_ready', 'dizzy': 'stairs_dizzy'}
    body = ['idle_0', 'idle_1', 'run_start', 'run_stop', 'jump_up', 'jump_down', 'land', 'grab', 'release', 'hit', 'happy', 'cheer', 'dead'] + \
           [f'run_{i}' for i in range(8)] + [f'swing_{i}' for i in range(3)] + \
           ['stairs_idle', 'stairs_ready', 'stairs_jump', 'stairs_land', 'stairs_fall', 'stairs_hurt', 'stairs_dizzy', 'stairs_happy', 'stairs_dead'] + \
           ['back_run_0', 'back_run_1', 'back_left', 'back_right', 'back_hit', 'back_happy', 'back_dead', 'back_boost']
    for p in body:
        if have(p): frames[p] = (L(p), 0.6)
    for a, b in alias.items():
        if b in frames: frames[a] = frames[b]
    for p in ['tile_face', 'tile_happy']:
        if have(p): frames[p] = (L(p), 0.75)
    for p in ['face_base', 'face_happy', 'face_sad', 'face_hurt']:
        if have(p): frames[p] = (L(p), 0.5)
    # 헬리콥터 자리: 구름 비행선 (구름 몸체 → 캐릭터 → 구름 앞부분 → 구름 얼굴)
    shared = f'{ROOT}/character/shared'
    def ride(face_pose, rider):
        if not (have('ride_cloud_body') and have(rider)): return None
        c = L('ride_cloud_body').copy(); c.alpha_composite(L(rider))
        if have('ride_cloud_front'): c.alpha_composite(L('ride_cloud_front'))
        fp = f'{shared}/ride_cloud_face_{face_pose}.png'
        if os.path.exists(fp): c.alpha_composite(Image.open(fp).convert('RGBA').resize(c.size))
        return c
    for name, (fc, rd) in {'heli_0': ('base', 'ride_fly'), 'heli_1': ('base', 'ride_fly'), 'heli_2': ('base', 'ride_fly'),
                            'heli_happy': ('happy', 'ride_happy'), 'heli_hurt': ('hurt', 'ride_hurt'), 'heli_crash': ('dizzy', 'ride_dizzy')}.items():
        im = ride(fc, rd)
        if im: frames[name] = (im, 0.4)
    items = []
    for name, (im, s) in frames.items():
        cw, ch = round(im.width * s), round(im.height * s); im2 = im.resize((cw, ch), Image.LANCZOS)
        bb = im2.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
        if not bb: continue
        items.append((name, im2.crop(bb), bb[0], bb[1], cw, ch))
    items.sort(key=lambda t: -t[1].height)
    AW = 2048; x = y = rowh = 0; pos = {}
    for name, im, *_ in items:
        if x + im.width > AW: x = 0; y += rowh + 2; rowh = 0
        pos[name] = (x, y); x += im.width + 2; rowh = max(rowh, im.height)
    atlas = Image.new('RGBA', (AW, y + rowh)); meta = {}
    for name, im, ox, oy, cw, ch in items:
        px, py = pos[name]; atlas.alpha_composite(im, (px, py)); meta[name] = [px, py, im.width, im.height, ox, oy, cw, ch]
        if name.startswith('swing') or name == 'grab':  # 줄 잡는 손(맨 위 가운데)
            al = np.array(im.getchannel('A')) > 60; xs = np.where(al[:12].any(0))[0]
            meta[name] += [round(ox + (xs.mean() if len(xs) else im.width / 2), 1), oy, 0.0]
    os.makedirs(f'{ROOT}/common/chars', exist_ok=True)
    atlas.save(f'{ROOT}/common/chars/{eid}.webp', quality=90, method=6)
    json.dump({'look': eid, 'frames': meta}, open(f'{ROOT}/common/chars/{eid}.json', 'w'), separators=(',', ':'))
    # 메뉴·결과 화면 그림
    BG = {'eunyu': (255, 228, 238), 'eungyeol': (221, 238, 255)}.get(base_look, (236, 244, 252))
    def face_jpg(p, out):
        # 머리카락 폭이 아니라 같은 크기(얼굴 360 기준)로 잘라서 쌍둥이 얼굴 크기가 같게 (머리카락이 넓으면 옆이 조금 잘림)
        im = L(p); bb = bbox(im); side = 382; cx = (bb[0] + bb[2]) // 2; top = max(0, bb[1] - 8)
        c = im.crop((cx - side // 2, top, cx + side // 2, top + side)); bg = Image.new('RGBA', c.size, BG + (255,)); bg.alpha_composite(c)
        bg.convert('RGB').resize((240, 240), Image.LANCZOS).save(out, quality=90)
    for k, p in [('base', 'face_base'), ('happy', 'face_happy'), ('sad', 'face_sad')]:
        if have(p): face_jpg(p, f'{ROOT}/skyhook/assets/{eid}_{k}.jpg')
    def trim(im, h):
        im = im.crop(bbox(im)); return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
    if have('face_base'): trim(L('face_base'), 138).save(f'{ROOT}/helicopter/assets/face_{eid}.png', optimize=True)
    if 'heli_crash' in frames: trim(frames['heli_crash'][0], 200).save(f'{ROOT}/helicopter/assets/{eid}_crash.png', optimize=True)
    for k, p in [('idle', 'stairs_idle'), ('happy', 'stairs_happy'), ('dead', 'stairs_dead')]:
        if have(p): trim(L(p), 240).save(f'{ROOT}/stairs/assets/{eid}_{k}.png', optimize=True)
    if have('front_stand'): trim(L('front_stand'), 600).save(f'{ROOT}/common/costumes/{eid}_base.png', optimize=True)
    register(eid, cname, base_look)
    print(f'게임 그림 완료: common/chars/{eid}.webp ({len(meta)}장), 캐릭터 목록 등록: {cname}')

def register(eid, cname, base_look):
    p = f'{ROOT}/common/chars/looks.js'; s = open(p, encoding='utf-8').read()
    line = f"  {{ look: '{eid}', name: '{cname}', base: '{base_look}', atlas: true, dress: false, isNew: true }},"
    s = re.sub(rf"\n  \{{ look: '{re.escape(eid)}',[^\n]*", '', s)
    s = s.replace('  // @@NEW_LOOKS@@', line + '\n  // @@NEW_LOOKS@@')
    open(p, 'w', encoding='utf-8').write(s)
    # 캐시 버전 올리기 (폰에서 새 그림이 바로 보이게)
    v = time.strftime('%Y%m%d%H%M')
    for f in glob.glob(f'{ROOT}/*/index.html') + [f'{ROOT}/index.html']:
        t = open(f, encoding='utf-8').read(); t2 = re.sub(r'(chars/looks\.js|common/charv2\.js)\?v=\w+', rf'\1?v={v}', t)
        if t2 != t: open(f, 'w', encoding='utf-8').write(t2)
    c = f'{ROOT}/common/charv2.js'; t = open(c, encoding='utf-8').read()
    open(c, 'w', encoding='utf-8').write(re.sub(r'(common/chars/\$\{look\}\.(?:json|webp))\?v=\w+', rf'\1?v={v}', t))

# ---------- main ----------
if __name__ == '__main__':
    a = sys.argv[1:]
    if not a: print(__doc__); sys.exit()
    cmd = a[0]
    if cmd == 'gen': cmd_gen(a[1], a[2], a[3], a[4:] or None)
    elif cmd == 'sheets':
        ok, total = cmd_sheets(a[1], a[2], a[3], a[5] if len(a) > 5 else None)
        if len(a) > 4 and ok >= total * 0.9: cmd_build(a[1], a[2], a[4])
        elif len(a) > 4: print(f'통과 {ok}/{total}장이라 게임에 넣지 않았어요. 다시요청.txt 를 GPT에게 보내 주세요.')
    elif cmd == 'import': cmd_import(a[1], a[2], a[3], a[4] if len(a) > 4 else None)
    elif cmd == 'build': cmd_build(a[1], a[2], a[3])
    elif cmd == 'all':
        eid, cname, base_look, src = a[1:5]; refdir = a[5] if len(a) > 5 else None
        if os.environ.get('OPENAI_API_KEY') and not src.endswith('.zip'):
            refdir = refdir or src; src = cmd_gen(eid, cname, src)
        ok, total = cmd_import(eid, cname, src, refdir)
        if ok >= total * 0.9: cmd_build(eid, cname, base_look)
        else: print(f'통과 {ok}/{total}장이라 게임에 넣지 않았어요. 다시요청.txt 를 GPT에게 보내 주세요.')
    else: print(__doc__)
