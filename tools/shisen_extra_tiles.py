"""사천성 추가 타일 그림 만들기 → shisen/assets/sprites/extra.webp + extra.json
  python3 tools/shisen_extra_tiles.py
  · 다른 게임에서 쓰는 아이콘 같은 그림을 사천성 타일(크림색 판 + 갈색 테두리 + 아래 두께)에 얹어 만듦
  · 메모리 게임 카드(f**)는 바탕이 있는 정사각형 그림이라 둥근 네모로 잘라 넣음.
    은유·은결 그림은 기본 얼굴 타일과 확실히 다른 것만 (모자·책·끌어안기 등), 추억 카드(s**, 전체 장면 그림)는 쓰지 않음
  · 기존 사천성 타일(sprites.webp)은 그대로 두고, 게임이 두 묶음을 함께 씀 (이름 x_…)
"""
import json, os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = f'{ROOT}/shisen/assets/sprites'
TW, TH = 132, 146          # 타일 크기 (기존 타일의 2배쯤)
FACE = (8, 8, TW - 8, TH - 18)  # 그림이 들어가는 크림색 판

# (이름, 그림 종류, 원본) — atlas: (게임 sprites.json 경로, 프레임 이름) / file: 그림 파일 / card: 메모리 카드
SRC = [
    # 메모리 게임: 확실히 다른 은유·은결 + 아이콘 같은 그림
    ('x_mem_raincoat', 'card', 'memory/assets/cards/f02.webp'),
    ('x_mem_hug', 'card', 'memory/assets/cards/f08.webp'),
    ('x_mem_book', 'card', 'memory/assets/cards/f09.webp'),
    ('x_mem_explorer', 'card', 'memory/assets/cards/f11.webp'),
    ('x_mem_pinkhat', 'card', 'memory/assets/cards/f12.webp'),
    ('x_mem_bluehat', 'card', 'memory/assets/cards/f13.webp'),
    ('x_mem_pom', 'card', 'memory/assets/cards/f07.webp'),
    ('x_mem_dogs', 'card', 'memory/assets/cards/f14.webp'),
    ('x_mem_heli', 'card', 'memory/assets/cards/f16.webp'),
    ('x_mem_cake', 'card', 'memory/assets/cards/f17.webp'),
    # 두더지 게임
    ('x_mole', 'file', 'mole/assets/sprites/normal.webp'),
    ('x_mole_fast', 'file', 'mole/assets/sprites/fast.webp'),
    ('x_mole_tough', 'file', 'mole/assets/sprites/tough.webp'),
    ('x_hammer', 'file', 'mole/assets/sprites/hammer.webp'),
    # 달콤 베이커리
    ('x_cupcake', 'file', 'bakery/assets/sprites/cup_cream.webp'),
    ('x_muffin', 'file', 'bakery/assets/sprites/cup.webp'),
    ('x_burnt', 'file', 'bakery/assets/sprites/burnt.webp'),
    ('x_eclair', 'file', 'bakery/assets/sprites/eclair.webp'),
    ('x_roll', 'file', 'bakery/assets/sprites/roll.webp'),
    ('x_piping', 'file', 'bakery/assets/sprites/bag.webp'),
    # 헬리콥터
    ('x_windmill', 'atlas', ('helicopter/assets/sprites/sprites.json', 'windmill')),
    ('x_airship', 'atlas', ('helicopter/assets/sprites/sprites.json', 'airship')),
    ('x_seagull', 'atlas', ('helicopter/assets/sprites/sprites.json', 'seagull')),
    ('x_bolt', 'atlas', ('helicopter/assets/sprites/sprites.json', 'bolt')),
    ('x_magnet', 'atlas', ('helicopter/assets/sprites/sprites.json', 'magnet')),
    ('x_flag', 'atlas', ('helicopter/assets/sprites/sprites.json', 'ui_flag')),
    # 다운힐
    ('x_penguin', 'atlas', ('downhill/assets/sprites/sprites.json', 'penguin')),
    ('x_snowman', 'atlas', ('downhill/assets/sprites/sprites.json', 'snowman')),
    ('x_pines', 'atlas', ('downhill/assets/sprites/sprites.json', 'trees')),
    ('x_log', 'atlas', ('downhill/assets/sprites/sprites.json', 'log')),
    ('x_fence', 'atlas', ('downhill/assets/sprites/sprites.json', 'fence')),
    # 계단 오르기
    ('x_gift', 'atlas', ('stairs/assets/sprites/sprites.json', 'gift')),
    ('x_mystery', 'atlas', ('stairs/assets/sprites/sprites.json', 'mystery')),
    ('x_alarm', 'atlas', ('stairs/assets/sprites/sprites.json', 'time10')),
]


def blank_tile():
    """기존 사천성 타일처럼: 아래 두께(진한 베이지) + 갈색 테두리 + 크림색 판(위가 조금 밝음)"""
    im = Image.new('RGBA', (TW, TH), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((2, 10, TW - 3, TH - 2), 18, fill=(214, 172, 132, 255), outline=(170, 120, 82, 255), width=3)
    d.rounded_rectangle((2, 2, TW - 3, TH - 12), 18, fill=(255, 247, 234, 255), outline=(190, 140, 100, 255), width=3)
    face = Image.new('RGBA', (TW, TH), (0, 0, 0, 0))
    fd = ImageDraw.Draw(face)
    for y in range(FACE[1], FACE[3]):  # 위 → 아래로 아주 살짝 진해짐
        k = (y - FACE[1]) / (FACE[3] - FACE[1])
        fd.line((FACE[0], y, FACE[2], y), fill=(255, int(248 - 12 * k), int(236 - 22 * k), 255))
    mask = Image.new('L', (TW, TH), 0)
    ImageDraw.Draw(mask).rounded_rectangle(FACE, 14, fill=255)
    im.paste(face, (0, 0), mask)
    return im


def load(kind, src):
    if kind == 'atlas':
        path, name = src
        x, y, w, h = json.load(open(f'{ROOT}/{path}'))[name][:4]
        return Image.open(f'{ROOT}/{path.replace(".json", ".webp")}').convert('RGBA').crop((x, y, x + w, y + h))
    return Image.open(f'{ROOT}/{src}').convert('RGBA')


def make(kind, src):
    tile = blank_tile()
    fx0, fy0, fx1, fy1 = FACE
    fw, fh = fx1 - fx0, fy1 - fy0
    img = load(kind, src)
    if kind == 'card':  # 바탕 있는 정사각형 그림 → 둥근 네모로 잘라 판 안에
        s = int(min(fw, fh) * 0.86)
        img = img.resize((s, s), Image.LANCZOS)
        m = Image.new('L', (s, s), 0)
        ImageDraw.Draw(m).rounded_rectangle((0, 0, s - 1, s - 1), s // 7, fill=255)
        x, y = fx0 + (fw - s) // 2, fy0 + (fh - s) // 2
        ring = Image.new('RGBA', (s + 6, s + 6), (0, 0, 0, 0))
        ImageDraw.Draw(ring).rounded_rectangle((0, 0, s + 5, s + 5), s // 7 + 3, fill=(255, 255, 255, 255))
        tile.alpha_composite(ring, (x - 3, y - 3))
        tile.paste(img, (x, y), m)
        return tile
    bb = img.getbbox()  # 투명 테두리 잘라 내고 판 안에 맞춤 (높이 78%, 너비 90%까지)
    if bb:
        img = img.crop(bb)
    k = min(fw * 0.9 / img.width, fh * 0.78 / img.height)  # 길쭉한 그림(에클레어·롤)은 옆으로 더 크게
    img = img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))), Image.LANCZOS)
    tile.alpha_composite(img, (fx0 + (fw - img.width) // 2, fy0 + (fh - img.height) // 2))
    return tile


def main():
    tiles = [(n, make(k, s)) for n, k, s in SRC]
    cols = 8
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * (TW + 2), rows * (TH + 2)), (0, 0, 0, 0))
    frames = {}
    for i, (n, t) in enumerate(tiles):
        x, y = (i % cols) * (TW + 2), (i // cols) * (TH + 2)
        sheet.alpha_composite(t, (x, y))
        frames[n] = [x, y, TW, TH]
    sheet.save(f'{OUT}/extra.webp', quality=90, method=6)
    json.dump(frames, open(f'{OUT}/extra.json', 'w'), ensure_ascii=False)
    print(len(frames), 'tiles →', f'{OUT}/extra.webp', sheet.size)


if __name__ == '__main__':
    main()
