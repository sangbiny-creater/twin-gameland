"""게임 선택 카드 다시 만들기 (메모리·두더지·베이커리·멍멍이 간식): GPT G01 원본 → hub/cards/<id>.webp
사천성 카드 틀(테두리·BEST 줄·게임 시작 버튼)은 그대로 두고 그림 칸(x10~470, y10~446)에 G01을 끼움.
로고 크기는 그대로(G01 폭을 칸 폭 460에 맞춤), 자르는 위치(top)만 정해서 은유·은결 머리가 잘리지 않게.
G01에서 머리끝~로고 끝이 칸보다 길면(메모리·베이커리), 캐릭터가 다 보이게 위에서 자르고
같은 디자인의 로고(G04, 배경 지운 <게임>/assets/ui/logo.webp)를 예전 카드와 같은 크기로 칸 아래쪽에 얹음.
  python3 tools/game_cards.py
"""
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 460, 436  # 그림 칸
# 게임: (G01 원본, G01에서 자를 위쪽 y, 얹을 로고 폭 px 또는 None) — 예전엔 위쪽을 215쯤 잘라 머리가 잘렸음
CARDS = {
    'memory': ('memorygame/image/1E7A6A2B-6B5F-409E-BE4B-54D47DD64E6B.PNG', 0, 380, 436),
    'mole': ('molegame/GPT/G01.PNG', 15, 400, 433),
    'bakery': ('bakerygame/GPT/G01.PNG', 20, 426, 430),
    'dogsnack': ('dogsnackgame/GPT/G01.PNG', 30, 410, 432),
}
# 마지막 숫자: 얹는 로고의 아래 끝 (그림 칸 안 y, 436 = BEST 줄 바로 위) — G01 원래 로고가 비치지 않게 그 위를 덮음


def rounded(im, r):
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, im.width - 1, im.height - 1), r, fill=255)
    im = im.convert('RGBA'); im.putalpha(m); return im


def build(gid, src, top, logo_w, logo_bottom):
    g1 = Image.open(os.path.join(ROOT, src)).convert('RGB')
    s = W / g1.width; h = round(H / s)
    top = max(0, min(top, g1.height - h))
    pic = g1.crop((0, top, g1.width, top + h)).resize((W, H), Image.LANCZOS).convert('RGBA')
    if logo_w:
        lg = Image.open(f'{ROOT}/{gid}/assets/ui/logo.webp').convert('RGBA')
        lg = lg.crop(lg.getbbox()); lg = lg.resize((logo_w, round(lg.height * logo_w / lg.width)), Image.LANCZOS)
        y0 = logo_bottom - lg.height
        # 로고 아래쪽 뒤로 G01 원래 로고 글자가 비치지 않게, 그 부분을 크게 흐린 배경으로 덮고(부드럽게 이어지게) 로고를 얹음
        cut = y0 + round(lg.height * 0.45)
        blur = pic.filter(ImageFilter.GaussianBlur(14))
        m = Image.new('L', pic.size, 0); d = ImageDraw.Draw(m)
        for y in range(cut - 24, H):
            d.line((0, y, W, y), fill=max(0, min(255, round(255 * (y - (cut - 24)) / 24))))
        pic = Image.composite(blur, pic, m)
        pic.alpha_composite(lg, ((W - logo_w) // 2, y0))
    card = Image.open(f'{ROOT}/hub/cards/shisen.webp').convert('RGBA')
    card.alpha_composite(rounded(pic, 30), (10, 10))
    card.save(f'{ROOT}/hub/cards/{gid}.webp', 'WEBP', quality=88, method=6)
    print(gid, 'top', top, '→', f'hub/cards/{gid}.webp')


if __name__ == '__main__':
    for gid, c in CARDS.items(): build(gid, *c)
