"""달콤 베이커리 임시 그림 만들기 (GPT 그림이 오기 전까지 쓰는 그림)
  python3 tools/bakery_placeholder.py
  · 저장소 루트에서 python3 -m http.server 8765 를 먼저 켜 두기 (캐릭터 그림을 fetch 로 읽어서 file:// 로는 안 됨)
  · tools/bakery_placeholder.html 을 헤드리스 크롬으로 캡처해서
    hub/cards/bakery.webp (두더지 카드 틀에 그림만 바꿔 끼움), hub/intro/bakery(_land).webp,
    shop/assets/games/bakery.webp, common/items/slow.webp·auto.webp 를 만듦
"""
import os, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
URL = 'http://localhost:8765/tools/bakery_placeholder.html?kind='
TMP = tempfile.mkdtemp()


def shot(kind, w, h):
    out = os.path.join(TMP, kind + '.png')
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
                    '--window-size=1700,1900', '--virtual-time-budget=5000', f'--screenshot={out}', URL + f'{kind}&w={w}&h={h}'],
                   stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL, check=True)
    return Image.open(out).convert('RGBA').crop((0, 0, w, h))


def save(im, rel, q=86):
    p = os.path.join(ROOT, rel)
    im.save(p, 'WEBP', quality=q)
    print(rel, im.size)


def main():
    save(shot('port', 941, 1672).convert('RGB'), 'hub/intro/bakery.webp')
    save(shot('land', 1536, 1024).convert('RGB'), 'hub/intro/bakery_land.webp', 84)
    save(shot('shop', 164, 134).convert('RGB'), 'shop/assets/games/bakery.webp')
    for k in ('slow', 'auto'):
        save(shot(k, 256, 256), f'common/items/{k}.webp')
    # 게임 카드: 두더지 카드 틀(흰 테두리·BEST 줄·게임 시작 버튼)에 위쪽 그림 칸만 바꿔 끼움
    frame = Image.open(os.path.join(ROOT, 'hub/cards/mole.webp')).convert('RGBA')
    pic = shot('card', 460, 436)
    mask = Image.new('L', (460, 436), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, 459, 435 + 40), 30, fill=255)
    fade = Image.new('L', (460, 436), 255)
    d = ImageDraw.Draw(fade)
    for i in range(22):
        d.line((0, 435 - i, 459, 435 - i), fill=int(255 * i / 22))
    m = Image.composite(mask, Image.new('L', mask.size, 0), fade)
    frame.paste(pic, (10, 10), m)
    save(frame.convert('RGB'), 'hub/cards/bakery.webp', 88)


if __name__ == '__main__':
    main()
