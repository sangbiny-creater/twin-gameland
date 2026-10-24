"""GPT 그림 요청문 v6: 스카이훅 시트(S03~S07)를 얼굴:몸통:다리 = 1:1:1 비율로 다시 그리기
  python3 tools/make_prompts_v6.py → character/v6/GPT_요청_v6_<캐릭터>.txt
  같은 글을 character/<eid>_v4/다시요청.txt 에도 넣어서, 새 그림을 시트 폴더 끝에 넣기만 하면 그 시트가 바뀜
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_prompts_v5 import CHARS, SHEETS, COMMON
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REDO = ['S03', 'S04', 'S05', 'S06', 'S07']  # 스카이훅에 쓰는 그림

RATIO = """[비율 규칙 — 가장 중요, 모든 컷에서 지켜]
A. 첨부한 "비율기준" 그림을 봐: 왼쪽 노란 띠 = 얼굴(머리카락 빼고 이마부터 턱 끝까지), 분홍 띠 = 몸통(턱 밑부터 윗옷 끝까지), 파란 띠 = 다리(윗옷 끝부터 발바닥까지). 세 길이가 똑같아(1 : 1 : 1). 머리카락은 얼굴 위에 따로 얹혀 있어.
   색 띠·점선·초록 배경 모양은 길이 설명용이니 따라 그리지 마.
B. 모든 컷에서 얼굴 크기, 몸통 길이, 다리 길이가 비율기준 그림과 똑같아야 해. 자세가 바뀌면 목·어깨·팔꿈치·허리·무릎 관절만 굽히고, 몸·다리·얼굴 길이는 절대 늘이거나 줄이지 마.
C. 팔을 위로 들어도(점프·응원·매달리기) 몸통과 다리는 그대로야. 매달릴 때 몸이 아래로 늘어지거나 다리가 길어지면 안 돼. 팔만 위로 올라가.
D. 옆모습·비스듬한 모습·달리는 모습이어도 얼굴 크기는 정면과 같아. 머리를 더 크게 그리지 마.
E. 크기: 1줄 그림은 서 있는 컷의 키(머리카락 끝~발바닥)가 그림 세로의 약 60%(1024px 중 약 600px), 2줄 그림(S03)은 약 40%(약 420px). 앉거나 웅크린 컷도 같은 배율로 그려서 키만 낮아지게.
F. 은유와 은결은 쌍둥이야. 얼굴 크기·몸통 길이·다리 길이가 둘 다 같고, 머리 모양과 옷만 달라."""

def prompt(key):
    c = CHARS[key]; L = []
    L.append(f'[트윈 게임랜드 {c["name"]} 스카이훅 그림 다시 요청 v6]')
    L.append(f'첨부한 그림 2장: ① "{c["name"]}" 레퍼런스(얼굴·옷·그림체 기준) ② 비율기준(은유·은결 쌍둥이가 나란히 선 그림, 얼굴:몸통:다리 = 1:1:1).')
    L.append(f'"{c["name"]}"의 게임 그림 {len(REDO)}장을 그려 줘. 한 답변에 1장씩 아래 순서대로 그리고, 다 그리면 "다음: S○○"라고 한 줄만 쓰고 멈춰. 내가 "계속"이라고 하면 다음 장을 그려. 질문하거나 확인을 기다리지 마.')
    L.append('')
    L.append(f'[캐릭터 {c["name"]}] {c["desc"].replace("(2.5등신)", "(얼굴:몸통:다리 = 1:1:1, 비율기준 그림과 같음)")}')
    L.append('')
    L.append(RATIO)
    L.append('')
    L.append(COMMON)
    L.append('')
    L.append(f'[그릴 그림 {len(REDO)}장 — 컷 순서: 왼쪽에서 오른쪽, 2줄이면 윗줄 먼저]')
    for s in SHEETS:
        sid, title, canvas, rows, rule, cuts = s
        if sid not in REDO: continue
        lay = f'{len(cuts)}컷 가로 한 줄' if rows == 1 else f'{len(cuts)}컷, {rows}줄 × {len(cuts)//rows}칸'
        L.append('')
        L.append(f'{sid} {title} — {canvas}, {lay}')  # 줄 맨 앞 "S03 " 은 tools/char_pipeline.py 가 새 그림 자리를 찾는 표시
        L.append(f'  {rule}')
        if sid == 'S06': L.append('  매달려도 얼굴·몸통·다리 길이는 서 있을 때와 같음 (비율 규칙 C). 위로 뻗은 팔만 길게 보이고 몸은 늘어나지 않음')
        for i, cut in enumerate(cuts, 1): L.append(f'  {i}. {cut}')
    L.append('')
    L.append(f'[지금 {REDO[0]}부터 그려 줘.]')
    return '\n'.join(L)

def full_prompt(key):
    """새 레퍼런스로 처음부터 14장 전부 받을 때 (v5 순서 + v6 비율 규칙)"""
    c = CHARS[key]; L = []
    L.append(f'[트윈 게임랜드 {c["name"]} 게임 그림 요청 v6 — 14장]')
    L.append(f'첨부한 그림 2장: ① "{c["name"]}" 레퍼런스(얼굴·옷·그림체 기준) ② 비율기준(얼굴:몸통:다리 = 1:1:1).')
    L.append(f'"{c["name"]}"의 게임 그림 14장을 그려 줘. 한 답변에 1장씩 아래 순서대로 그리고, 다 그리면 "다음: S○○"라고 한 줄만 쓰고 멈춰. 내가 "계속"이라고 하면 다음 장을 그려. 질문하거나 확인을 기다리지 마.')
    L.append('')
    L.append(f'[캐릭터 {c["name"]}] {c["desc"].replace("(2.5등신)", "(얼굴:몸통:다리 = 1:1:1, 비율기준 그림과 같음)")}')
    L.append(''); L.append(RATIO); L.append(''); L.append(COMMON); L.append('')
    L.append('[그릴 그림 14장 — 컷 순서: 왼쪽에서 오른쪽, 2줄이면 윗줄 먼저]')
    for sid, title, canvas, rows, rule, cuts in SHEETS:
        lay = f'{len(cuts)}컷 가로 한 줄' if rows == 1 else f'{len(cuts)}컷, {rows}줄 × {len(cuts)//rows}칸'
        L.append(''); L.append(f'{sid} {title} — {canvas}, {lay}'); L.append(f'  {rule}')
        if sid == 'S06': L.append('  매달려도 얼굴·몸통·다리 길이는 서 있을 때와 같음 (비율 규칙 C). 위로 뻗은 팔만 길게 보이고 몸은 늘어나지 않음')
        for i, cut in enumerate(cuts, 1): L.append(f'  {i}. {cut}')
    L.append(''); L.append('[지금 S01부터 그려 줘.]')
    return '\n'.join(L)

def redo_prompt(key, sids):
    """검수에서 떨어진 시트만 다시 그릴 때"""
    c = CHARS[key]; L = [f'아래 그림만 처음 요청 규칙(비율 규칙 A~F, 공통 규칙 1~7) 그대로 다시 그려 줘. 비율기준 그림과 얼굴:몸통:다리 1:1:1. 한 답변에 1장씩, 다 그리면 "다음"이라고만 쓰고 멈춰.', '']
    for s in SHEETS:
        if s[0] in sids:
            sid, title, canvas, rows, rule, cuts = s
            lay = f'{len(cuts)}컷 가로 한 줄' if rows == 1 else f'{len(cuts)}컷, {rows}줄 × {len(cuts)//rows}칸'
            L += [f'{sid} {title} — {canvas}, {lay} (이미지 생성으로만, 초록 배경, 글자 없음, 레퍼런스와 같은 {c["name"]})', f'  {rule}'] + [f'  {i}. {x}' for i, x in enumerate(cuts, 1)] + ['']
    return '\n'.join(L)

def new_char_prompt(name='[이름]'):
    """새 캐릭터: 레퍼런스(키·비율이 달라도 됨) + 비율기준 그림 → S00 기준 정면 + 14장. 이름만 바꿔 쓰는 템플릿"""
    ratio = RATIO.replace(
        'F. 은유와 은결은 쌍둥이야. 얼굴 크기·몸통 길이·다리 길이가 둘 다 같고, 머리 모양과 옷만 달라.',
        'F. 새 캐릭터는 비율기준 그림의 은유·은결과 얼굴 크기·몸통 길이·다리 길이가 같아 (셋을 나란히 세우면 키와 얼굴 크기가 같게). 머리 모양·옷·소품만 달라.\n'
        'G. 레퍼런스의 키·등신·비율은 따르지 마 (어른처럼 길거나 아기처럼 짧아도 무시). 레퍼런스에서 가져오는 건 얼굴 생김새·머리 모양·색·옷·소품·그림체뿐이고, 비율은 언제나 1:1:1.\n'
        'H. 원피스·긴 코트처럼 윗옷 끝이 애매하면 "다리가 갈라지는 곳"을 몸통 끝으로 봐.')
    common = COMMON.replace('2. 첨부한 레퍼런스 그림의 캐릭터와 똑같이', '2. 레퍼런스와 S00 기준 그림의 캐릭터와 똑같이') + \
        '\n8. 몸에서 떨어진 것(떠 있는 별·하트·물음표·느낌표·땀방울·효과)과 몸 밖으로 크게 튀어나온 소품(긴 지팡이·큰 날개 등) 없음. 요청한 그림 말고 다른 그림을 더 그리지 마.'
    L = [f'[트윈 게임랜드 새 캐릭터 게임 그림 요청 v6 — 기준 1장 + 14장]',
         '첨부한 그림: ① 새 캐릭터 레퍼런스 (1장 이상) ② 비율기준 (은유·은결 쌍둥이가 나란히 선 그림, 얼굴:몸통:다리 = 1:1:1)'
         ' ③ (있으면) 캐릭터 제작 가이드 PDF — PDF는 참고용이고, 이 메시지의 규칙이 우선이야.',
         f'캐릭터 이름: {name} (이름은 그림에 쓰지 마)',
         '한 답변에 그림 1장씩 아래 순서대로 그리고, 다 그리면 "다음: S○○"라고 한 줄만 쓰고 멈춰. 내가 "계속"이라고 하면 다음 장을 그려. 질문하거나 확인을 기다리지 마.',
         '',
         '[S00 — 먼저 할 일 (첫 답변)]',
         '1. 레퍼런스를 보고 캐릭터 설명을 한 문단으로 써 줘: 나이 느낌 · 머리 모양과 색 · 눈 · 안경/머리핀 같은 액세서리 · 윗옷 · 바지/치마 · 양말 · 신발 · 가방/소품 · 대표 색. 앞으로 모든 그림은 이 설명과 똑같이 그려.',
         '2. S00 기준 정면 그림 — 가로 1536x1024, 1명: 정면을 보고 똑바로 선 전신, 두 팔은 몸 옆, 활짝 웃는 얼굴. 키(머리카락 끝~발바닥)는 그림 세로의 약 60%.'
         ' 얼굴:몸통:다리 = 1:1:1 이고 비율기준 그림의 은유·은결과 얼굴 크기·몸 비율이 같게.',
         '   S00 그림은 이 캐릭터의 비율·얼굴·옷 기준이야. S01부터 모든 그림은 S00과 같은 캐릭터·같은 비율로 그려.',
         '',
         f'[캐릭터 {name}] S00에서 쓴 설명대로 (얼굴:몸통:다리 = 1:1:1, 비율기준 그림과 같음)',
         '', ratio, '', common, '',
         '[그릴 그림 14장 (S00 다음) — 컷 순서: 왼쪽에서 오른쪽, 2줄이면 윗줄 먼저]']
    for sid, title, canvas, rows, rule, cuts in SHEETS:
        lay = f'{len(cuts)}컷 가로 한 줄' if rows == 1 else f'{len(cuts)}컷, {rows}줄 × {len(cuts)//rows}칸'
        L += ['', f'{sid} {title} — {canvas}, {lay}', f'  {rule}']
        if sid == 'S06': L.append('  매달려도 얼굴·몸통·다리 길이는 서 있을 때와 같음 (비율 규칙 C). 위로 뻗은 팔만 길게 보이고 몸은 늘어나지 않음')
        L += [f'  {i}. {cut}' for i, cut in enumerate(cuts, 1)]
    L += ['', '[지금 S00(캐릭터 설명 + 기준 정면 그림)부터 해 줘.]']
    return '\n'.join(L).replace('은유와 같은', '').replace('레퍼런스와 같은 은유', '레퍼런스와 같은 캐릭터')

if __name__ == '__main__':
    open(f'{ROOT}/character/v6/GPT_요청_v6_새캐릭터_템플릿.txt', 'w', encoding='utf-8').write(new_char_prompt())
    for k, c in CHARS.items():
        open(f'{ROOT}/character/v6/GPT_요청_v6_전체14장_{c["name"]}.txt', 'w', encoding='utf-8').write(full_prompt(k))
        open(f'{ROOT}/character/v6/GPT_요청_v6_다시그리기예시_{c["name"]}.txt', 'w', encoding='utf-8').write(redo_prompt(k, ['S06']))
    os.makedirs(f'{ROOT}/character/v6', exist_ok=True)
    for k, c in CHARS.items():
        t = prompt(k)
        open(f'{ROOT}/character/v6/GPT_요청_v6_{c["name"]}.txt', 'w', encoding='utf-8').write(t)
        if '--redo' in sys.argv:  # 시트 폴더에 새 그림만 넣으면 그 시트가 바뀌게
            d = f'{ROOT}/character/{c["eid"]}_v4'; os.makedirs(d, exist_ok=True)
            open(f'{d}/다시요청.txt', 'w', encoding='utf-8').write(t)
    print('ok')
