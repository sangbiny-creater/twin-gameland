"""다운힐 러너 그림(GPT) → 게임용 webp
원본: making_GPT/다운힐버튼/D01~D14 (요청 글: GPT_요청_다운힐_그림전체.txt)
  D01 인트로 세로 · D02 인트로 가로 · D03 게임 카드 · D04·D05 은유 뒷모습 8컷
  D06 화살표 · D07 점프 버튼 · D08 점프하기 아이템 · D09 눈 마을 집
  D10 눈 덮인 산 · D11 겨울 숲 · D12 얼음 계곡 · D13 오로라 설원 (하늘) · D14 로고
  (눈 마을 하늘은 아직 없어서 D10을 같이 씀 — 받으면 SKY 에 넣기)
  python3 tools/downhill_assets.py          # 전부
  python3 tools/downhill_assets.py back     # 은유 뒷모습만 (common/chars/eunyu3 의 back_* 8장 바꿈)
게임 카드(hub/cards/downhill.webp)는 tools/game_cards.py 로.
"""
import json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, f'{ROOT}/tools')
from ui_assets import unchroma, fit_w, save  # noqa: E402
from mole_assets import cover  # noqa: E402

SRC = f'{ROOT}/making_GPT/다운힐버튼'
UI = 'downhill/assets/ui'
# 하늘: 스테이지 순서(눈 덮인 산·겨울 숲·얼음 계곡·눈 마을·오로라 설원) → 원본
SKY = ['D10', 'D11', 'D12', 'D10', 'D13']


def src(n):
    return f'{SRC}/{n}.png'


def horizon(im):
    """그림 아래쪽 평평한 눈밭이 시작되는 줄(지평선) — 위로 올라가며 줄마다 색이 고르게 밝은 동안은 눈밭"""
    a = np.asarray(im.convert('L'), np.float32)
    y = a.shape[0] - 1
    while y > a.shape[0] * 0.6 and a[y].std() < 14 and a[y].mean() > 150: y -= 1
    return y + 1


def hub_images():
    g1, g2, g3 = (Image.open(src(n)).convert('RGB') for n in ('D01', 'D02', 'D03'))
    os.makedirs(f'{ROOT}/intro', exist_ok=True)
    g1.save(f'{ROOT}/intro/세로원본_다운힐러너_v2.png'); g2.save(f'{ROOT}/intro/가로_다운힐러너_v2.png')
    w = round(1536 * 9 / 16)
    g1.crop(((1024 - w) // 2, 0, (1024 + w) // 2, 1536)).resize((941, 1672), Image.LANCZOS).save(f'{ROOT}/hub/intro/downhill.webp', 'WEBP', quality=84, method=6)
    g2.save(f'{ROOT}/hub/intro/downhill_land.webp', 'WEBP', quality=84, method=6)
    # 아이템샵 게임 카드 164x134: 카드 그림의 썰매 타는 뒷모습 부분
    cover(g3.crop((0, 300, 1024, 1000)), 164, 134).save(f'{ROOT}/shop/assets/games/downhill.webp', 'WEBP', quality=88, method=6)
    # 단독 실행 첫 화면 576x448: 가로 인트로의 로고+캐릭터
    cover(g2, 576, 448, ay=0.3).save(f'{ROOT}/{UI}/keyart.webp', 'WEBP', quality=86, method=6)
    print('intro · shop · keyart ok')


def ui_images():
    left = fit_w(unchroma(src('D06')), 200)
    save(left, f'{UI}/btn_left.webp'); save(left.transpose(Image.FLIP_LEFT_RIGHT), f'{UI}/btn_right.webp')
    save(fit_w(unchroma(src('D07')), 240), f'{UI}/btn_jump.webp')
    save(fit_w(unchroma(src('D08')), 200), f'{UI}/item_jump.webp')
    save(fit_w(unchroma(src('D09')), 320), f'{UI}/house.webp')
    save(fit_w(unchroma(src('D14')), 800), f'{UI}/logo.webp')
    hz = []
    for i, n in enumerate(SKY):
        im = Image.open(src(n)).convert('RGB'); h = horizon(im)
        # 지평선 아래 눈밭은 게임이 그리니 조금만 남기고 자름
        im = im.crop((0, 0, im.width, min(im.height, h + 24)))
        save(im, f'downhill/assets/bg/sky_{i + 1}.webp', lossless=False)
        hz.append(h)
    print('지평선(위에서 px):', hz, '→ game.js SKY_HZ')


def back_frames():
    """은유 뒷모습: 시트를 잘라, 지금 그림(eunyu3)의 같은 포즈와 키·발 위치를 맞춰 아틀라스에서 바꿈"""
    from char_pipeline import split_sheet, bbox, head_width
    look = 'eunyu3'
    meta = json.load(open(f'{ROOT}/common/chars/{look}.json'))
    atlas = Image.open(f'{ROOT}/common/chars/{look}.webp').convert('RGBA')
    F = meta['frames']
    sheets = [('D04', ['back_run_0', 'back_run_1', 'back_left', 'back_right'], 'back_run_0'),
              ('D05', ['back_hit', 'back_happy', 'back_dead', 'back_boost'], 'back_boost')]
    new = {}; head = None
    for sid, names, ref in sheets:
        parts, err = split_sheet(src(sid), names, 1)
        if err: raise SystemExit(f'{sid}: {err}')
        # 한 시트는 같은 배율: 첫 시트는 기준 포즈의 키를 지금 그림의 키에 맞추고, 다음 시트는 머리 폭을 첫 시트와 같게
        if head is None:
            rb = bbox(parts[ref]); s = F[ref][3] / (rb[3] - rb[1]); head = head_width(parts[ref]) * s
        else: s = head / head_width(parts[ref])
        for nm, im in parts.items():
            b = bbox(im); im = im.crop(b); im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
            x, y, w, h, ox, oy, cw, ch = F[nm][:8]
            # 발(아래 끝) 가운데를 지금 그림과 같은 자리에
            nox = round(ox + w / 2 - im.width / 2); noy = oy + h - im.height
            new[nm] = (im, nox, noy, cw, ch)
    # 다시 묶기: 나머지 포즈는 그대로 잘라 와서 같은 방식으로 배치
    items = []
    for nm, v in F.items():
        if nm in new:
            im, ox, oy, cw, ch = new[nm]; extra = []
        else:
            x, y, w, h, ox, oy, cw, ch = v[:8]; extra = v[8:]
            im = atlas.crop((x, y, x + w, y + h))
        items.append((nm, im, ox, oy, cw, ch, extra))
    items.sort(key=lambda t: -t[1].height)
    AW = 2048; x = y = rowh = 0; pos = {}
    for nm, im, *_ in items:
        if x + im.width > AW: x = 0; y += rowh + 2; rowh = 0
        pos[nm] = (x, y); x += im.width + 2; rowh = max(rowh, im.height)
    out = Image.new('RGBA', (AW, y + rowh)); M = {}
    for nm, im, ox, oy, cw, ch, extra in items:
        px, py = pos[nm]; out.alpha_composite(im, (px, py))
        M[nm] = [px, py, im.width, im.height, ox, oy, cw, ch] + extra
    out.save(f'{ROOT}/common/chars/{look}.webp', quality=90, method=6)
    json.dump({'look': look, 'frames': M}, open(f'{ROOT}/common/chars/{look}.json', 'w'), separators=(',', ':'))
    print(look, 'back_* 8장 바꿈, atlas', out.size)


if __name__ == '__main__':
    arg = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if arg in ('all', 'hub'): hub_images()
    if arg in ('all', 'ui'): ui_images()
    if arg in ('all', 'back'): back_frames()
