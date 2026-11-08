"""어른 캐릭터 2차 그림 적용 (v0.4 디자인 시안) — character/adult2/ → 게임 그림
  python3 tools/adult2_assets.py
요청 글: making_GPT/성인캐릭터_교체2/ (00_전체안내.txt)
  · 팝업 공통 재료(분홍=은유, 파랑=은결) → common/ui/popup/v4/ (common/popup.css 가 씀)
  · 캐릭터 선택 → hub/select/ · 환영·출석·잠금 → common/ui/monet/ · 결과 캐릭터 → common/ui/popup/chars/
  · 계단 SD → common/chars 묶음의 stairs_* · 다운힐 빛 → downhill/assets/ui/ · 롤러코스터 → hub/park/coaster/
"""
import json, os, shutil, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import adult_assets as A
from adult_assets import ROOT, key, tight, cuts, save, scaled, ground_frame, pack

SRC = f'{ROOT}/character/adult2'
UI = 'common/ui/popup/v4'


def plain_bottom(im, R=112):
    """창 틀 아래쪽 양 귀퉁이를 장식 없는 둥근 모서리로 다시 그림 (옆 테두리의 색 띠를 안쪽 깊이에 따라 그대로 씀)"""
    a = np.array(im).astype(np.float32); H, W = a.shape[:2]
    mid = a[H // 2]; x0 = int(np.where(mid[:, 3] > 128)[0][0]); x1 = int(np.where(mid[:, 3] > 128)[0][-1])
    col = a[:, W // 2]; y1 = int(np.where(col[:, 3] > 128)[0][-1])
    lo = max(0, x0 - 3); band = a[H // 2, lo:x0 + 120].copy()  # 깊이별 색 (왼쪽 가장자리에서 안쪽으로)
    B = 165  # 다시 그리는 칸
    for y in range(y1 - B, H):
        for x in list(range(0, x0 + B)) + list(range(x1 - B, W)):
            ex = x0 + R - x if x < W / 2 else x - (x1 - R); ey = y - (y1 - R)
            if ex > 0 and ey > 0: d = R - (ex * ex + ey * ey) ** .5
            else: d = min(x - x0, x1 - x, y1 - y)
            i = d + (x0 - lo)
            a[y, x] = (0, 0, 0, 0) if d < -1.5 else band[int(np.clip(i, 0, len(band) - 1))]
    return Image.fromarray(a.astype(np.uint8))


def ui():
    for f, n, w in [('K01', 'panel_pink', 600), ('K02', 'panel_blue', 600), ('K03', 'ribbon_pink', 680), ('K04', 'ribbon_blue', 680),
                    ('K05', 'btn_pink', 420), ('K06', 'btn_blue', 420), ('K07', 'fill_pink', 420), ('K08', 'fill_blue', 420), ('K09', 'x_pink', 120), ('K10', 'x_blue', 120)]:
        p = tight(key(f'{SRC}/ui/{f}.png', soft=False)); p = scaled(p, w / p.width)
        if n.startswith('panel'): p = plain_bottom(p)  # 버튼이 가리는 아래 귀퉁이 별·하트 없앰
        save(p, f'{UI}/{n}.webp'); print(n, p.size)


def select():
    for f, n, sz in [('Y01', 'bg', (1024, 1536)), ('Y02', 'bg_land', (1536, 1024))]:
        # 하늘이 초록으로 와서 하늘색으로 채움 (구름·풍선은 그대로)
        p = key(f'{SRC}/select/{f}.png'); sky = Image.new('RGBA', p.size); h = p.height
        for y in range(h):
            t = min(1, y / (h * .62)); sky.paste((round(92 + 150 * t), round(182 + 62 * t), round(246 + 8 * t), 255), (0, y, p.width, y + 1))
        sky.alpha_composite(p); sky.convert('RGB').resize(sz, Image.LANCZOS).save(f'{ROOT}/hub/select/{n}.webp', 'WEBP', quality=84, method=6)
    for f, n, w in [('Y03', 'card_eunyu', 480), ('Y04', 'card_eungyeol', 480), ('Y05', 'name_pink', 420), ('Y06', 'name_blue', 420), ('Y07', 'lang_pink', 420), ('Y08', 'lang_blue', 420)]:
        p = tight(key(f'{SRC}/select/{f}.png')); p = scaled(p, w / p.width)
        if n == 'card_eunyu':  # 은유 칸 높이를 은결 칸과 같게: 아래 흰 칸을 늘림 (캐릭터 크기는 그대로)
            at = 700; a = np.array(p); p = Image.fromarray(np.concatenate([a[:at], np.repeat(a[at:at + 1], 43, 0), a[at:]]))
        save(p, f'hub/select/{n}.webp'); print(n, p.size)


def monet():
    for f, n in [('W01', 'welcome'), ('L01', 'locked'), ('N01', 'attend_eunyu'), ('N02', 'attend_eungyeol')]:
        p = tight(key(f'{SRC}/monet/{f}.png')); p = scaled(p, 720 / p.width); save(p, f'common/ui/monet/{n}.webp'); print(n, p.size)
    for c, n in zip(cuts(key(f'{SRC}/monet/N03.png'), 5), ['normal', 'today_pink', 'today_blue', 'done', 'd10']):
        save(scaled(c, 160 / c.width), f'common/ui/monet/cell_{n}.webp')


def result():
    for who, b in [('eunyu', 1), ('eungyeol', 5)]:
        for i, n in enumerate(['best', 'clear', 'end', 'sad']):
            p = tight(key(f'{SRC}/result/R0{b + i}.png')); p = scaled(p, 660 / p.width); save(p, f'common/ui/popup/chars/{who}_{n}.webp'); print(who, n, p.size)


def stairs():
    names = (['stairs_idle', 'stairs_ready', 'stairs_jump', 'stairs_land', 'stairs_fall'], ['stairs_hurt', 'stairs_dizzy', 'stairs_happy', 'stairs_dead'])
    for who, b, k in [('eunyu', 1, 1.0), ('eungyeol', 3, 1.04)]:
        look = A.LOOK[who]; a = cuts(key(f'{SRC}/stairs_sd/U0{b}.png'), 5); c = cuts(key(f'{SRC}/stairs_sd/U0{b + 1}.png'), 4)
        s = 393 * k / a[0].height; frames = {}
        for n, x in zip(names[0], a): frames[n] = ground_frame(x, s)
        for n, x in zip(names[1], c): frames[n] = ground_frame(x, s)
        pack(f'{ROOT}/common/chars/{look}.json', f'{ROOT}/common/chars/{look}.webp', frames, look)
        A.fit_bottom  # 결과 작은 그림
        save(A.fit_bottom(frames['stairs_happy'][0], 240, 300), f'stairs/assets/chars/{look}_happy.webp')
        save(A.fit_bottom(frames['stairs_dead'][0], 240, 300), f'stairs/assets/chars/{look}_dead.webp')


def fx():
    save(scaled(tight(key(f'{SRC}/downhill_fx/D11.png', soft=False)), 240 / tight(key(f'{SRC}/downhill_fx/D11.png', soft=False)).width), 'downhill/assets/ui/item_burst.webp')
    r = tight(key(f'{SRC}/downhill_fx/D12.png', soft=False)); save(scaled(r, 240 / r.width), 'downhill/assets/ui/item_ring.webp')


def coaster():
    for f, who in [('H01', 'eunyu'), ('H02', 'eungyeol')]:
        p = tight(key(f'{SRC}/hub/{f}.png', soft=False)); p = scaled(p, 620 / p.width)
        # 차 앞부분이 그림 끝에서 곧게 잘려 있어서 오른쪽 위·아래 귀퉁이를 둥글게
        a = np.array(p); W, Hh = p.size; y0 = int(np.where(a[:, -3, 3] > 128)[0][0]); r = 110
        yy, xx = np.ogrid[:Hh, :W]
        a[(xx > W - r) & (yy >= y0) & (yy < y0 + r) & ((xx - (W - r)) ** 2 + (yy - (y0 + r)) ** 2 > r * r), 3] = 0
        a[(xx > W - r) & (yy > Hh - r) & ((xx - (W - r)) ** 2 + (yy - (Hh - r)) ** 2 > r * r), 3] = 0
        p = Image.fromarray(a); save(p, f'hub/park/coaster/{who}.webp'); print(who, p.size)


def home():
    # 첫 화면 왼쪽 아래: 기본 그림(A00·B00)의 가슴 위 — 얼굴이 크게 보이게
    for who, l, top in [('eunyu', 'A', .35), ('eungyeol', 'B', .33)]:
        p = tight(key(f'{ROOT}/character/adult/common_{who}/{l}00.png'))
        p = tight(p.crop((0, 0, p.width, round(p.height * top)))); p = scaled(p, 620 / p.height)
        if who == 'eungyeol':  # 손이 오른쪽으로 오게 뒤집고, 머리 꼭대기·턱 높이를 은유와 맞춤 (윗머리 끝 y 30 ↔ 18)
            p = p.transpose(Image.FLIP_LEFT_RIGHT); c = Image.new('RGBA', p.size); c.alpha_composite(p, (0, 12)); p = c
        save(p, f'hub/park/home/{who}.webp'); print(who, p.size)


def map4():
    # 스테이지 지도 재료 (12_지도_재료) + 두더지 배경 → hub/ui/map/v4/, hub/ui/map/mole/
    P = f'{SRC}/map/parts'; ims = [key(f'{P}/P0{i}.png') for i in range(1, 6)]
    bbs = [im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox() for im in ims]
    box = (min(b[0] for b in bbs), min(b[1] for b in bbs), max(b[2] for b in bbs), max(b[3] for b in bbs))
    for im, n in zip(ims, ['tent_red', 'tent_blue', 'tent_yellow', 'tent_now', 'tent_lock']):
        c = im.crop(box); save(scaled(c, 360 / c.width), f'hub/ui/map/v4/{n}.webp')
    print('tent box', box, (box[2] - box[0]) / (box[3] - box[1]))
    for f, n, w in [('P06', 'pin_eunyu', 200), ('P07', 'pin_eungyeol', 200), ('P08', 'back_pink', 120), ('P09', 'back_blue', 120), ('P10', 'flag', 90), ('P11', 'name_pink', 460), ('P12', 'name_blue', 460)]:
        p = tight(key(f'{P}/{f}.png', soft=False)); save(scaled(p, w / p.width), f'hub/ui/map/v4/{n}.webp')
    import glob
    for g in ('mole', 'shisen', 'memory'):
        for f in sorted(glob.glob(f'{SRC}/map/{g}/B*.png')):
            n = int(os.path.basename(f)[1:3]); os.makedirs(f'{ROOT}/hub/ui/map/{g}', exist_ok=True)
            Image.open(f).convert('RGB').resize((1024, 1536), Image.LANCZOS).save(f'{ROOT}/hub/ui/map/{g}/w{n}.webp', 'WEBP', quality=82, method=6)


def plates():
    # 받침·디딤돌 (17_지도_받침) → 코드가 배경 위에 올림. 받침이 없는 배경(B05·B07)
    p = tight(key(f'{SRC}/map/parts/Q01.png')); save(scaled(p, 300 / p.width), 'hub/ui/map/v4/plate.webp'); print('plate', p.size)
    q = tight(key(f'{SRC}/map/parts/Q02.png')); save(scaled(q, 150 / q.width), 'hub/ui/map/v4/stone.webp')
    import glob
    for g in ('shisen', 'memory'):  # 받침 구간이 빈 배경 (19·20번 글)
        os.makedirs(f'{ROOT}/hub/ui/map/{g}', exist_ok=True)
        for f in sorted(glob.glob(f'{SRC}/map2/{g}/B*.png')):
            n = int(os.path.basename(f)[1:3]); Image.open(f).convert('RGB').resize((1024, 1536), Image.LANCZOS).save(f'{ROOT}/hub/ui/map/{g}/w{n}.webp', 'WEBP', quality=82, method=6)
    for n in (5, 7):
        Image.open(f'{SRC}/map/mole/B0{n}.png').convert('RGB').resize((1024, 1536), Image.LANCZOS).save(f'{ROOT}/hub/ui/map/mole/w{n}.webp', 'WEBP', quality=82, method=6)


def login():
    # 로그인·계정 창 (28_로그인_계정) → hub/login/ (common/auth.js 가 씀)
    P = f'{SRC}/login'
    for f, n in [('L01', 'welcome'), ('L02', 'link'), ('L04', 'repair')]:
        p = tight(key(f'{P}/{f}.png')); save(scaled(p, 720 / p.width), f'hub/login/{n}.webp'); print(n, p.size)
    for p, n in zip(cuts(key(f'{P}/L03.png'), 6, rows=2), ['birth', 'mail', 'lock', 'key', 'ticket', 'card']):
        save(scaled(p, 160 / max(p.size)), f'hub/login/i_{n}.webp'); print(n, p.size)


if __name__ == '__main__':
    STEPS = dict(login=login, ui=ui, select=select, monet=monet, result=result, stairs=stairs, fx=fx, coaster=coaster, home=home, map4=map4, plates=plates)
    for k in (sys.argv[1:] or STEPS): STEPS[k]()
