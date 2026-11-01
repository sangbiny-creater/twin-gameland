"""QA2 GPT 그림 적용 (2026-11-01) — making_GPT/QA2_6차/ 의 H01~H03 · J01~J03 · M01~M02 → 게임 폴더 webp
  python3 tools/qa2_assets.py
  (G01 배경은 GPT가 받침을 덜 옮기고 나무도 조금 다시 그려서 안 씀 → tools/park_shift.py 로 원본에서 받침만 옮김)
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage as nd
import park_assets as P

ROOT = P.ROOT
SRC = f'{ROOT}/making_GPT/QA2_6차'
cut = lambda n: P.tight(P.key(f'{SRC}/{n}.png'))


def save(im, path, w):
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    os.makedirs(os.path.dirname(f'{ROOT}/{path}'), exist_ok=True)
    im.save(f'{ROOT}/{path}', 'WEBP', lossless=True, quality=100, method=6)
    print(f'{path:36s} {im.size} {os.path.getsize(f"{ROOT}/{path}") // 1024}KB')


if __name__ == '__main__':
    save(cut('H01'), 'hub/select/sex_girl.webp', 140)
    save(cut('H02'), 'hub/select/sex_boy.webp', 140)
    save(cut('H03'), 'hub/select/lang.webp', 360)
    save(cut('M01'), 'hub/ui/map/mode_easy.webp', 420)
    save(cut('M02'), 'hub/ui/map/mode_hard.webp', 420)
    save(cut('J01'), 'common/ui/hud/pill.webp', 480)
    save(cut('J03'), 'common/ui/hud/board.webp', 480)
    # J02 아이콘 12개 시트 (3줄 x 4칸) → 덩어리마다 잘라 줄·칸 순서로
    sheet = P.key(f'{SRC}/J02.png')
    lab, n = nd.label(np.asarray(sheet.getchannel('A')) > 60)
    boxes = sorted(nd.find_objects(lab), key=lambda s: -(s[0].stop - s[0].start) * (s[1].stop - s[1].start))[:12]
    boxes.sort(key=lambda s: s[0].start + s[0].stop)  # 위에서부터 4개씩 한 줄, 줄 안에서는 왼쪽부터
    boxes = [b for k in range(0, 12, 4) for b in sorted(boxes[k:k + 4], key=lambda s: s[1].start)]
    names = ['coin', 'star', 'crown', 'heart', 'clock', 'flag', 'cards', 'fire', 'target', 'shoe', 'bolt', 'trophy']
    for nm, s in zip(names, boxes):
        im = sheet.crop((s[1].start - 3, s[0].start - 3, s[1].stop + 3, s[0].stop + 3))
        save(im, f'common/ui/hud/ico_{nm}.webp', 96)
