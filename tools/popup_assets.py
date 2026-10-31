"""게임 시작·끝·일시정지 팝업 그림 만들기 → common/ui/popup/ (아이템 아이콘은 common/items/) 에 webp로 저장
  python3 tools/popup_assets.py
  · GPT 그림: making_GPT/팝업_v2/ A01~A12(UI 세트), E01~E10(캐릭터 표정) — 요청 글: 같은 폴더 GPT_요청_A·B, 정리: docs/spec/팝업_아이템_정리_v1.md
  · 창 틀(panel)·버튼(btn_*)은 common/popup.css 에서 border-image 로 늘려 씀 → 그림을 다시 받으면 출력 크기를 보고 popup.css 숫자도 다시 맞추기
  · 초록 지우기·자르기는 tools/monet_assets.py 와 같은 방법
"""
import os
import numpy as np
from PIL import Image
import monet_assets as M

ROOT = M.ROOT
SRC = f'{ROOT}/making_GPT/팝업_v2'
OUT = f'{ROOT}/common/ui/popup'


def src(n):
    for ext in ('png', 'PNG'):
        p = f'{SRC}/{n}.{ext}'
        if os.path.exists(p): return p
    raise FileNotFoundError(n)


def save(im, name, w=None, lossless=True, q=88, out=OUT):
    M.OUT = out
    M.save(im, name, w, lossless, q)


def clean_sides(im, y0, y1):
    """창 틀 옆면의 점 장식 지우기: y0~y1 사이 옆면을 장식 없는 한 줄(y0 바로 위)로 채움 → 늘려 써도 모양이 같게"""
    a = np.asarray(im).copy()
    w = a.shape[1]; side = int(w * 0.16)
    row = a[y0 - 1]
    for y in range(y0, y1):
        a[y, :side] = row[:side]; a[y, w - side:] = row[w - side:]
    return Image.fromarray(a)


if __name__ == '__main__':
    # A01 창 틀: 옆면 점 장식(위 하트 아래 ~ 아래 별 위)을 민무늬로
    p = M.tight(M.key(src('A01')))
    h = p.height
    p = clean_sides(p, int(h * 0.17), int(h * 0.84))
    save(p, 'panel', w=600, lossless=False)
    save(M.tight(M.key(src('A02'), soft=False)), 'scene', w=720, lossless=False)   # A02 그림 칸 배경
    save(M.tight(M.key(src('A03'))), 'ribbon', w=600, lossless=False)              # A03 제목 리본
    for im, c in zip(M.split(M.key(src('A04')), 5, rows=True), ['pink', 'blue', 'mint', 'purple', 'gray']):
        save(im, f'btn_{c}', w=360)                                                 # A04 버튼 5색
    for im, c in zip(M.split(M.key(src('A05')), 2, rows=True), ['ad_double', 'ad_continue']):
        save(im, f'btn_{c}', w=400)                                                 # A05 광고 버튼
    for im, c in zip(M.split(M.key(src('A06')), 2), ['close', 'pause']):
        save(im, f'btn_{c}', w=128)                                                 # A06 닫기·일시정지
    for im, c in zip(M.split(M.key(src('A07')), 3), ['slot', 'slot_on', 'badge']):
        save(im, c, w=200 if c != 'badge' else 64)                                  # A07 아이템 칸·수량 배지
    for im, c in zip(M.grid(M.key(src('A08')), 2, 3), ['shield', 'slow', 'time', 'hint', 'bomb', 'find']):
        save(im, c, w=160, out=f'{ROOT}/common/items')                              # A08 아이템 아이콘 (하트는 common/ui/heart.webp)
    for im, c in zip(M.grid(M.key(src('A09')), 3, 3), ['play', 'retry', 'home', 'map', 'next', 'games', 'pause', 'continue', 'coins']):
        save(im, f'ico_{c}', w=96)                                                  # A09 버튼 위 아이콘
    for im, c in zip(M.split(M.key(src('A10')), 2), ['star_on', 'star_off']):
        save(im, c, w=160)                                                          # A10 별
    for im, c in zip(M.grid(M.key(src('A11')), 3, 1), ['title_clear', 'title_fail', 'title_best']):
        save(im, c, w=480, lossless=False)                                          # A11 제목 글자
    for im, c in zip(M.grid(M.key(src('A12')), 2, 3), ['flag', 'coin', 'star', 'crown', 'time', 'gem']):
        save(im, f'row_{c}', w=80)                                                  # A12 결과 줄 아이콘
    # E01~E10 캐릭터 표정: 10장 모두 같은 틀(그림 전체, 위·양옆 투명)로 → 바꿔 끼워도 위치가 안 흔들림
    os.makedirs(f'{OUT}/chars', exist_ok=True)
    for i, who in enumerate(['eunyu', 'eungyeol']):
        for j, mood in enumerate(['start', 'great', 'good', 'smile', 'sad']):
            im = M.key(src(f'E{i * 5 + j + 1:02d}'))
            a = np.asarray(im).copy(); a[-12:, :, 3] = np.asarray(im)[-13:-12, :, 3]  # 아래 끝은 몸이 닿게 (가장자리 지우기 되돌림)
            save(Image.fromarray(a).crop((256, 0, 1280, 1024)), f'chars/{who}_{mood}', w=420, lossless=False)
