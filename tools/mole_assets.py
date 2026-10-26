"""두더지 게임 그림 만들기 → mole/assets/, hub/cards·intro, shop/assets/games, common/items 에 webp로 저장.
  python3 tools/mole_assets.py
  · GPT 그림: molegame/GPT/G01~G06.PNG(카드·인트로·로고·배경), M01~M10.PNG(두더지·구멍·망치·흙먼지, 초록 바탕),
    C01~C04.PNG(구멍에서 나온 은유·은결 기본·맞음)
    (요청 글: making_GPT/신규게임이미지_템플릿/GPT_요청_두더지게임_그림.txt, GPT_요청_두더지게임_캐릭터.txt)
  · 아이템 아이콘(점수 2배 별, 무지개 망치)만 GPT 기획 시트(molegame/…시트.webp)에서 잘라 씀
    — 크림색 바탕은 가장자리에서 이어진 곳만 지워 투명하게 (그림 속 흰 부분은 그대로)
"""
import glob, os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEET = f'{ROOT}/molegame/두더지게임_기획_비주얼시트_채팅첨부.webp'
OUT = f'{ROOT}/mole/assets'
GPT = f'{ROOT}/molegame/GPT'


def cutout(im, box, tol=34, keep=1):
    """box 를 잘라 가장자리와 이어진 바탕색을 투명하게. keep: 남길 큰 덩어리 수"""
    a = np.asarray(im.crop(box).convert('RGB')).astype(np.int32)
    h, w, _ = a.shape
    edge = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bgc = np.median(edge, axis=0)
    near = np.sqrt(((a - bgc) ** 2).sum(-1)) < tol
    lab, _ = ndimage.label(near)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    fg = ~bg
    lab2, n = ndimage.label(fg)
    if n > keep:
        sizes = ndimage.sum(fg, lab2, range(1, n + 1))
        big = np.argsort(sizes)[::-1][:keep] + 1
        fg = np.isin(lab2, big)
    fg = ndimage.binary_fill_holes(fg)
    alpha = Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    out = Image.fromarray(a.astype(np.uint8)).convert('RGBA')
    out.putalpha(alpha)
    bb = out.getbbox()
    return out.crop(bb) if bb else out


def save(im, name, scale=1.0, q=88):
    if scale != 1.0:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    p = f'{OUT}/{name}.webp'
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, 'WEBP', quality=q, method=6)
    print(name, im.size)


def chroma(src):
    """초록(#00FF00) 바탕을 투명하게, 가장자리 초록 번짐은 빼기 (src: 파일 경로 또는 그림)"""
    a = np.asarray((Image.open(src) if isinstance(src, str) else src).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    k = g - np.maximum(r, b)                      # 초록에 가까울수록 큼
    al = np.clip((140 - k) / 80, 0, 1)            # k 60 이하 = 그림, 140 이상 = 바탕
    a[..., 1] = np.minimum(g, np.maximum(r, b) + 12)  # 초록 번짐 빼기
    out = Image.fromarray(a.astype(np.uint8)).convert('RGBA')
    out.putalpha(Image.fromarray((al * 255).astype(np.uint8)))
    return out


def main():
    sh = Image.open(SHEET).convert('RGB')
    # 아이템 아이콘 (아이템샵·로비·게임이 같이 씀): 점수 2배 = 별, 한번에 제거 = 무지개 망치
    for name, box in (('double', (1290, 870, 1375, 950)), ('rainbow', (1395, 862, 1510, 955))):
        im = cutout(sh, box); im.thumbnail((140, 140), Image.LANCZOS)
        im.save(f'{ROOT}/common/items/{name}.webp', 'WEBP', quality=90, method=6); print('items', name, im.size)
    # 두더지 7장: 모두 같은 틀로 잘라 크기·위치(몸 아래 끝)가 그대로 맞게. 1254 그림의 x 57~1197, y 30~1110
    #  → 456x432, 몸 아래 끝은 높이의 약 95.5% (game.js MOLE_FOOT)
    names = ['normal', 'normal_hit', 'fast', 'fast_hit', 'tough', 'tough_crack', 'tough_hit']
    for i, n in enumerate(names):
        save(chroma(f'{GPT}/M{i + 1:02d}.PNG').crop((57, 30, 1197, 1110)), f'sprites/{n}', 0.4)
    # 하트 두더지 M11·M12 (요청 글: GPT_요청_두더지게임_하트두더지.txt) — 있으면 같은 틀로. 넣은 뒤 game.js HAS_HEART_ART = true
    for i, n in ((11, 'heart'), (12, 'heart_hit')):
        if os.path.exists(f'{GPT}/M{i}.PNG'):
            im = Image.open(f'{GPT}/M{i}.PNG')
            if im.size != (1254, 1254): im = im.resize((1254, 1254), Image.LANCZOS)
            save(chroma(im).crop((57, 30, 1197, 1110)), f'sprites/{n}', 0.4)
    # 함정 캐릭터(구멍에서 나온 은유·은결, C01~C04): 두더지와 같은 틀로 잘라 같은 크기·자리
    #  새 캐릭터: 신규캐릭터 템플릿 S15·S16 → molegame/GPT/두더지_<영문이름>.PNG, 두더지_<영문이름>_맞음.PNG
    #  (만든 뒤 mole/game.js MOLE_CHARS 에 <영문이름> 추가)
    src = {'eunyu': ('C01', 'C02'), 'eungyeol': ('C03', 'C04')}
    for f in glob.glob(f'{GPT}/두더지_*.PNG') + glob.glob(f'{GPT}/두더지_*.png'):
        n = os.path.splitext(os.path.basename(f))[0][4:]
        if not n.endswith('_맞음'): src[n] = (f'두더지_{n}', f'두더지_{n}_맞음')
    for look, (a, b) in src.items():
        for name, out in ((a, look), (b, look + '_hit')):
            path = next((p for p in (f'{GPT}/{name}.PNG', f'{GPT}/{name}.png') if os.path.exists(p)), None)
            if not path: print('없음:', name); continue
            im = Image.open(path)
            if im.size != (1254, 1254): im = im.resize((1254, 1254), Image.LANCZOS)  # 두더지(1254 정사각)와 같은 틀
            save(chroma(im).crop((57, 30, 1197, 1110)), f'chars/{out}', 0.4)
    # 구멍: 뒤(통째) + 앞(안쪽 가운데 줄보다 아래의 흙 테두리만) — 두더지를 그 사이에 그림
    #  잘라 낸 틀 x 36~1216, y 409~891 → 안쪽(어두운 곳) 가운데 (604, 229), 반지름 416x129 (game.js HOLE_*)
    hole = chroma(f'{GPT}/M08.PNG')
    dark = (np.asarray(hole.convert('L')) < 60) & (np.asarray(hole.getchannel('A')) > 200)
    lab, n = ndimage.label(dark); sz = ndimage.sum(dark, lab, range(1, n + 1))
    inner = ndimage.binary_fill_holes(lab == np.argmax(sz) + 1)
    ys, xs = np.nonzero(inner); cy = (ys.min() + ys.max()) // 2
    print('hole inner', xs.min(), xs.max(), ys.min(), ys.max(), 'cy', cy)
    front = np.asarray(hole).copy()
    keep = np.zeros(inner.shape, bool); keep[cy:] = True; keep &= ~inner
    front[..., 3] = np.where(keep, front[..., 3], 0)
    box = (36, 409, 1216, 891)
    save(hole.crop(box), 'sprites/hole_back', 0.34)
    save(Image.fromarray(front).crop(box), 'sprites/hole_front', 0.34)
    # 망치·흙먼지
    save(chroma(f'{GPT}/M09.PNG').crop((57, 59, 1148, 1191)), 'sprites/hammer', 0.26)
    save(chroma(f'{GPT}/M10.PNG').crop((47, 282, 1212, 1035)), 'sprites/dust', 0.26)
    # 배경 (구멍 없음): 세로 G05, 가로 G06 — 울타리 아래 잔디가 시작하는 높이는 game.js BG_GRASS
    save(Image.open(f'{GPT}/G05.PNG').convert('RGB'), 'bg/port', 1, q=82)
    save(Image.open(f'{GPT}/G06.PNG').convert('RGB'), 'bg/land', 1, q=82)
    # 로고 (초록 지우고 꼭 맞게 잘라 가로 720)
    logo = chroma(f'{GPT}/G04.PNG'); logo = logo.crop(logo.getchannel('A').point(lambda v: 255 if v > 30 else 0).getbbox())
    save(logo, 'ui/logo', 720 / logo.width, q=90)
    hub_images()


def cover(im, w, h, ay=0.5):
    s = max(w / im.width, h / im.height)
    r = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (r.width - w) // 2, round((r.height - h) * ay)
    return r.crop((x, y, x + w, y + h))


def rounded(im, r):
    from PIL import ImageDraw
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, im.width - 1, im.height - 1), r, fill=255)
    im = im.convert('RGBA'); im.putalpha(m); return im


def hub_images():
    g1 = Image.open(f'{GPT}/G01.PNG').convert('RGB')
    # 게임 카드: 사천성 카드 틀(테두리·BEST 줄·게임 시작 버튼)에 그림 칸(x10~470, y10~446)만 바꿔 끼움. 로고가 그림 칸 아래쪽에
    pic = g1.crop((0, 215, 1024, 215 + round(1024 * 436 / 460))).resize((460, 436), Image.LANCZOS)
    card = Image.open(f'{ROOT}/hub/cards/shisen.webp').convert('RGBA')
    card.alpha_composite(rounded(pic, 30), (10, 10))
    card.save(f'{ROOT}/hub/cards/mole.webp', 'WEBP', quality=88, method=6)
    # 인트로: 세로 G02 → 9:16 로 잘라 941x1672, 가로 G03 → 1536x1024 그대로. 원본은 intro/ 에 보관
    g2 = Image.open(f'{GPT}/G02.PNG').convert('RGB'); g3 = Image.open(f'{GPT}/G03.PNG').convert('RGB')
    g2.save(f'{ROOT}/intro/세로원본_7_두더지게임.png'); g3.save(f'{ROOT}/intro/가로_7_두더지게임.png')
    w = round(1536 * 9 / 16)
    g2.crop(((1024 - w) // 2, 0, (1024 + w) // 2, 1536)).resize((941, 1672), Image.LANCZOS).save(f'{ROOT}/hub/intro/mole.webp', 'WEBP', quality=84, method=6)
    g3.save(f'{ROOT}/hub/intro/mole_land.webp', 'WEBP', quality=84, method=6)
    # 아이템샵 게임 카드 164x134: G01 캐릭터 부분
    cover(g1.crop((0, 0, 1024, 720)), 164, 134).save(f'{ROOT}/shop/assets/games/mole.webp', 'WEBP', quality=88, method=6)
    print('hub images ok')


if __name__ == '__main__':
    main()
