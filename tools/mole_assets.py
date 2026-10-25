"""두더지 게임 그림 만들기: GPT 기획 시트 한 장(molegame/…시트.webp)에서 잘라 mole/assets/ 에 webp로 저장.
  python3 tools/mole_assets.py
  · 크림색 바탕은 가장자리에서 이어진 곳만 지워 투명하게 (그림 속 흰 부분은 그대로)
  · GPT 그림(making_GPT/신규게임이미지_템플릿/GPT_요청_두더지게임_그림.txt)이 오면 같은 이름으로 바꿔 넣으면 됨
"""
import os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEET = f'{ROOT}/molegame/두더지게임_기획_비주얼시트_채팅첨부.webp'
OUT = f'{ROOT}/mole/assets'


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


def main():
    sh = Image.open(SHEET).convert('RGB')
    # 두더지 (3번 칸). 2대 두더지: 왼쪽 = 처음(헬멧), 오른쪽 = 한 대 맞은 뒤(화난 얼굴)
    save(cutout(sh, (28, 508, 246, 668)), 'sprites/mole_normal', 2)
    save(cutout(sh, (258, 508, 478, 668)), 'sprites/mole_fast', 2)
    save(cutout(sh, (490, 508, 655, 668)), 'sprites/mole_tough', 2)
    save(cutout(sh, (662, 508, 818, 668)), 'sprites/mole_tough2', 2)
    # 이펙트·아이템
    save(cutout(sh, (1290, 870, 1375, 950)), 'sprites/star', 2)
    save(cutout(sh, (1395, 862, 1510, 955)), 'sprites/rainbow', 2)
    # 배경: 시트의 가로 배경 칸에는 구멍이 그려져 있어 위쪽 하늘·울타리 띠와 맨 아래 꽃밭 띠만 씀 (풀밭·구멍은 게임이 그림)
    sky = sh.crop((330, 738, 812, 864))
    save(sky.resize((sky.width * 3, sky.height * 3), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.0)), 'bg/sky', q=80)
    fl = sh.crop((330, 952, 812, 996))
    save(fl.resize((fl.width * 3, fl.height * 3), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.8)), 'bg/flowers', q=80)
    # 로고 + 대표 그림 (시트 왼쪽 위)
    key = sh.crop((12, 2, 448, 452))
    save(key.crop((0, 0, 436, 200)), 'ui/logo', 1, q=90)
    # 아이템 아이콘 (아이템샵·로비·게임이 같이 씀): 점수 2배 = 별, 한번에 제거 = 무지개 망치
    for name, box in (('double', (1290, 870, 1375, 950)), ('rainbow', (1395, 862, 1510, 955))):
        im = cutout(sh, box); im.thumbnail((140, 140), Image.LANCZOS)
        im.save(f'{ROOT}/common/items/{name}.webp', 'WEBP', quality=90, method=6); print('items', name, im.size)
    hub_images(key)


def rounded(im, r):
    m = Image.new('L', im.size, 0)
    from PIL import ImageDraw
    ImageDraw.Draw(m).rounded_rectangle((0, 0, im.width - 1, im.height - 1), r, fill=255)
    im = im.convert('RGBA'); im.putalpha(m); return im


def cover(im, w, h, ay=0.5):
    s = max(w / im.width, h / im.height)
    r = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (r.width - w) // 2, round((r.height - h) * ay)
    return r.crop((x, y, x + w, y + h))


def hub_images(key):
    """GPT 그림(G01~G03)이 오기 전 임시: 시트 대표 그림으로 게임 카드·인트로·아이템샵 카드"""
    # 게임 카드: 사천성 카드 틀(테두리·BEST 줄·게임 시작 버튼)에 그림 칸(x10~470, y10~446)만 바꿔 끼움
    card = Image.open(f'{ROOT}/hub/cards/shisen.webp').convert('RGBA')
    card.alpha_composite(rounded(cover(key, 460, 436, 0.0), 30), (10, 10))
    card.save(f'{ROOT}/hub/cards/mole.webp', 'WEBP', quality=88, method=6)
    # 인트로 세로 941x1672: 흐린 바탕 + 대표 그림을 위쪽에 크게
    blur = lambda w, h: cover(key, w, h).filter(ImageFilter.GaussianBlur(28)).point(lambda v: min(255, int(v * 0.95)))
    pt = blur(941, 1672).convert('RGBA'); k = key.resize((941, round(450 * 941 / 436)), Image.LANCZOS)
    pt.alpha_composite(rounded(k, 0), (0, 300))
    pt.convert('RGB').save(f'{ROOT}/hub/intro/mole.webp', 'WEBP', quality=84, method=6)
    # 인트로 가로 1536x1024: 폰 가로는 아래 28%가 잘리므로 그림을 위쪽 3%~75%에
    ld = blur(1536, 1024).convert('RGBA'); hh = 740; k = key.resize((round(436 * hh / 450), hh), Image.LANCZOS)
    ld.alpha_composite(rounded(k, 40), ((1536 - k.width) // 2, 30))
    ld.convert('RGB').save(f'{ROOT}/hub/intro/mole_land.webp', 'WEBP', quality=84, method=6)
    # 아이템샵 게임 카드 164x134: 캐릭터 부분
    cover(key.crop((0, 170, 436, 450)), 164, 134).save(f'{ROOT}/shop/assets/games/mole.webp', 'WEBP', quality=88, method=6)
    print('hub images ok')


if __name__ == '__main__':
    main()
