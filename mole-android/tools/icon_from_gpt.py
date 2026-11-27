"""GPT 아이콘 그림(making_GPT/두더지앱/A0?.png)으로 두더지 앱 아이콘·구글 플레이 그림 만들기
   python3 mole-android/tools/icon_from_gpt.py A03 A04   (아이콘 그림, 플레이 가로 그림)
   → mole-app/assets/app/icons/ (웹·홈 화면), mole-android/store/ (플레이 아이콘 512·그래픽 이미지 1024x500)
   그 다음 python3 mole-android/tools/make_icons.py 로 안드로이드 아이콘을 다시 만들어요."""
import os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '../..')
icon_id, wide_id = (sys.argv[1:3] + ['A03', 'A04'])[:2]
src = Image.open(f'{ROOT}/making_GPT/두더지앱/{icon_id}.png').convert('RGB')
s = min(src.size); src = src.crop(((src.width - s) // 2, (src.height - s) // 2, (src.width + s) // 2, (src.height + s) // 2))
OUT = f'{ROOT}/mole-app/assets/app/icons'; STORE = f'{ROOT}/mole-android/store'; os.makedirs(STORE, exist_ok=True)
for n, name in [(512, 'icon-512'), (192, 'icon-192'), (180, 'icon-180'), (32, 'favicon-32')]:
    src.resize((n, n), Image.LANCZOS).save(f'{OUT}/{name}.png', optimize=True)
src.resize((512, 512), Image.LANCZOS).save(f'{STORE}/play_icon_512.png', optimize=True)
# 잘려도 되는 아이콘(안드로이드 적응형·maskable): 가운데 그림을 줄이고 둘레를 그림 가장자리 색으로 채움
px = src.load(); edge = [px[x, y] for x in (4, s - 5) for y in (4, s - 5)]
bg = tuple(sum(c[i] for c in edge) // 4 for i in range(3))
from PIL import ImageDraw, ImageFilter
m = Image.new('RGB', (512, 512), bg); k = int(512 * 0.72); fe = 24  # 가장자리를 부드럽게 섞음
soft = Image.new('L', (k, k), 0); ImageDraw.Draw(soft).rectangle((fe, fe, k - fe, k - fe), fill=255); soft = soft.filter(ImageFilter.GaussianBlur(fe / 2))
m.paste(src.resize((k, k), Image.LANCZOS), ((512 - k) // 2, (512 - k) // 2), soft)
m.save(f'{OUT}/icon-maskable-512.png', optimize=True)
open(f'{STORE}/icon_bg.txt', 'w').write('#%02X%02X%02X\n' % bg)
# 플레이 그래픽 이미지 1024x500 (가로 그림을 비율 맞춰 가운데 자르기)
w = Image.open(f'{ROOT}/making_GPT/두더지앱/{wide_id}.png').convert('RGB'); r = 1024 / 500
cw, ch = (w.width, round(w.width / r)) if w.width / w.height < r else (round(w.height * r), w.height)
w.crop(((w.width - cw) // 2, (w.height - ch) // 2, (w.width + cw) // 2, (w.height + ch) // 2)).resize((1024, 500), Image.LANCZOS).save(f'{STORE}/feature_1024x500.png', optimize=True)
print('아이콘 만듦, 가장자리 색', '#%02X%02X%02X' % bg)
