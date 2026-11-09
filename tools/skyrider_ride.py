"""스카이 라이더 구름 탑승 그림(heli_*)만 다시 만들어 캐릭터 묶음(common/chars/<look>.webp/.json)에 바꿔 넣음
  python3 tools/skyrider_ride.py
  · 다른 포즈는 지금 묶음 그림 그대로 둠 (전체를 다시 만들지 않음)
  · 자르기·합치기는 tools/adult_assets.py 의 ride_cuts·ride_frames (closet_assets.py 도 같은 것을 씀)
  · 원본: character/adult/common_<who>/<A|B>06.png, character/adult2/costume/<옷>/G3.png (저장소에 안 올림)
"""
import json, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import adult_assets as A
import closet_assets as C
from adult_assets import ROOT, key, tight, fit_bottom, save


def replace(look, new):
    J = json.load(open(f'{ROOT}/common/chars/{look}.json')); im = Image.open(f'{ROOT}/common/chars/{look}.webp').convert('RGBA')
    crops, frames = {}, {}
    for n, (x, y, w, h, *m) in J['frames'].items():
        if n in new: continue
        r = (x, y, w, h)
        if r not in crops: crops[r] = im.crop((x, y, x + w, y + h))
        frames[n] = (crops[r], m)
    # 같은 그림을 쓰는 프레임(heli_0·1·2)은 한 장만
    same = {}
    for n, (p, m) in new.items():
        k = p.tobytes(); same.setdefault(k, p); frames[n] = (same[k], m)
    C.pack(frames, look)


def main():
    for who in A.LOOK:
        l = A.LETTER[who]; look = A.LOOK[who]
        rides = A.ride_cuts(key(f'{A.SRC}/common_{who}/{l}06.png'), 4); rh = np.median([r.height for r in rides])
        hf, out = A.ride_frames(who, rides); replace(look, hf)
        save(fit_bottom(tight(out['ride_dizzy']), 300, 220), f'helicopter/assets/chars/{look}_crash.webp')
        for oid in C.OUTFITS[who]:
            if not oid: continue
            D = C.folder(who, oid)
            hf, _ = A.ride_frames(who, A.ride_cuts(key(f'{D}/G3.png', soft=C.GREEN_COAT not in D), 4), rh)
            replace(f'{look}_{oid}', hf)


if __name__ == '__main__':
    main()
