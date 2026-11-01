"""(지금은 안 씀 — 2026-11-01 사용자가 GPT G03 배경으로 정함) 첫 화면 입구 배경(entrance4)의 놀이기구 받침 4개를 좌우로만 옮김 (QA2 2, 2026-11-01)
  python3 tools/park_shift.py
  GPT 다시 그리기(G01)는 받침을 덜 옮기고 나무·꽃도 조금씩 다시 그려서, 원본 그림에서 받침 둘레 타원 안만 옆으로 밀어 붙임
  → 타원 밖(나무·꽃·가로등·다른 받침)은 원본과 한 픽셀도 안 바뀜. 결과: hub/park/bg/entrance4.webp
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = f'{ROOT}/making_GPT/첫화면_놀이공원/V01.png'
# 받침(앞쪽 돌담까지) 타원: 가운데 x, 가운데 y, 반지름 rx·ry (V01 에서 눈금으로 잰 값), 옮길 거리 dx
#  가운데 꽃나무 덤불이 받침 바로 옆이라 타원은 받침에 꼭 맞게 (여유 3px)
MOVES = [(320, 773, 138, 87, -61), (706, 782, 139, 87, 74), (333, 441, 133, 81, -32), (693, 441, 131, 81, 34)]

if __name__ == '__main__':
    im = Image.open(SRC).convert('RGB'); out = im.copy(); A = np.asarray(im)
    for x, cy, RX, RY, dx in MOVES:
        shifted = Image.fromarray(np.roll(A, dx, axis=1))  # 원본을 dx 만큼 옆으로 민 그림
        m = Image.new('L', im.size, 0); d = ImageDraw.Draw(m)
        d.ellipse((x + dx - RX - 3, cy - RY - 3, x + dx + RX + 3, cy + RY + 3), fill=255)  # 새 자리 받침
        d.ellipse((x - RX - 9, cy - RY - 7, x + RX + 9, cy + RY + 7), fill=255)            # 옛 자리 (옆의 돌바닥으로 덮임, 둘레 테두리까지)
        m = m.filter(ImageFilter.GaussianBlur(2))
        out = Image.composite(shifted, out, m)
    out.save(f'{ROOT}/hub/park/bg/entrance4.webp', 'WEBP', quality=90, method=6)
    print('saved', out.size)
