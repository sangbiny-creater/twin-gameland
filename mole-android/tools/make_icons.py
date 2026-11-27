"""두더지 앱 안드로이드 아이콘·시작 화면 그림 만들기 (mole-app 의 아이콘·로고에서)
   python3 mole-android/tools/make_icons.py   ← 아이콘 그림(mole-app/assets/app/icons/)을 바꾸면 다시 돌리기"""
import glob, os
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); APP = os.path.join(HERE, '../../mole-app'); RES = os.path.join(HERE, '../android/app/src/main/res')
icon = Image.open(f'{APP}/assets/app/icons/icon-512.png').convert('RGBA')
mask = Image.open(f'{APP}/assets/app/icons/icon-maskable-512.png').convert('RGBA')
for d, n in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    ic = icon.resize((n, n), Image.LANCZOS); ic.save(f'{RES}/mipmap-{d}/ic_launcher.png')
    m = Image.new('L', (n * 4, n * 4), 0); ImageDraw.Draw(m).ellipse((0, 0, n * 4 - 1, n * 4 - 1), fill=255)
    r = Image.new('RGBA', (n, n), (0, 0, 0, 0)); r.paste(ic, (0, 0), m.resize((n, n), Image.LANCZOS)); r.save(f'{RES}/mipmap-{d}/ic_launcher_round.png')
    f = round(n * 108 / 48); mask.resize((f, f), Image.LANCZOS).save(f'{RES}/mipmap-{d}/ic_launcher_foreground.png')  # 적응형 아이콘 앞 그림 (가운데가 보이는 칸)
open(f'{RES}/values/ic_launcher_background.xml', 'w').write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#6FD445</color>\n</resources>\n')
# 시작 화면(안드로이드 11 이하): 풀색 바탕 + 로고
logo = Image.open(f'{APP}/assets/ui/logo.webp').convert('RGBA')
for p in glob.glob(f'{RES}/drawable*/splash.png'):
    w, h = Image.open(p).size
    s = Image.new('RGBA', (w, h), (188, 218, 82, 255)); lw = int(min(w, h) * 0.7); lg = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
    s.alpha_composite(lg, ((w - lw) // 2, (h - lg.height) // 2)); s.convert('RGB').save(p)
print('아이콘·시작 화면 그림 만듦')
