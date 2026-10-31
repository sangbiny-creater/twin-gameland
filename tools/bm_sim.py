"""BM(다이아·광고) 밸런스 시뮬레이션 — 플레이 성향 5명 × 지금 규칙 / A·B·C 안, 30·90일
  python3 tools/bm_sim.py
  · 숫자 출처: common/monet.js(게임 열기 가격·출석·10판마다 1개), common/profile.js(꾸미기 값·코인 규칙),
    각 게임 levels.js(판 수·제한 시간). 사람이 직접 한 플레이 기록이 아니라 '성향별 하루 플레이 양·실력'을 가정한 계산이에요.
  · 결과는 docs/bm/BM_제안_v1.md 에 표로 옮김
"""
import math

# ---------- 게임 (v0.3 목록 9개) ----------
STAGE = {'shisen': 200, 'memory': 100, 'mole': 100}                         # 판 수 (사천성은 쉬움 100 + 어려움 100)
ENDLESS = ['downhill', 'bakery', 'dogsnack', 'helicopter', 'stairs', 'darts']
LOCKED = 6                                                                   # 처음 잠긴 게임 수 (다운힐·베이커리·두더지만 열림)
UNLOCK = [60, 80, 100, 120, 140, 160, 180]                                   # 지금 다이아 열기 가격
DECO_TOTAL = 5 * 20 + 5 * 30 + 6 * 40 + 5 * 20 + 5 * 30                     # 꾸미기 전부(동상·분수·대문·이름표·로고) = 740
MIN_PER_PLAY = 1.8                                                           # 한 판 평균(분): 스테이지 판 1~2분, 끝없는 게임 1~3분

# ---------- 플레이 성향 5명 (밸런스팀 역할) ----------
PEOPLE = [
    # 이름, 하루 분, 주당 일수, 스테이지 클리어율, 광고 보는 비율(보상 창이 뜰 때), 꾸미기 욕심(0~1)
    ('① 가볍게 (출퇴근 5분)', 6, 5, 0.55, 0.0, 0.2),
    ('② 매일 꾸준히 (하루 15분)', 15, 7, 0.70, 0.5, 0.5),
    ('③ 기록 도전 (하루 40분)', 40, 7, 0.85, 1.0, 0.3),
    ('④ 꾸미기 수집 (하루 20분)', 20, 6, 0.70, 0.3, 1.0),
    ('⑤ 편하게 결제 (하루 15분, 광고 안 봄)', 15, 7, 0.70, 0.0, 0.8),
]

# ---------- 안 (다이아 주는 기준) ----------
PLANS = {
    'now': dict(name='지금 규칙', att=1, every=10, stage_world=0, stage_star=0, endless_ms=0, ad_gem=0, ad_cap=0, unlock=UNLOCK),
    'A': dict(name='A안 광고로 모으기', att=1, every=10, stage_world=3, stage_star=2, endless_ms=12, ad_gem=2, ad_cap=5, unlock=[40, 50, 60, 70, 80, 90, 100]),
    'B': dict(name='B안 균형 (추천)', att=2, every=10, stage_world=5, stage_star=3, endless_ms=20, ad_gem=2, ad_cap=3, unlock=UNLOCK),
    'C': dict(name='C안 편의 결제', att=1, every=15, stage_world=3, stage_star=0, endless_ms=10, ad_gem=1, ad_cap=2, unlock=[80, 100, 120, 140, 160, 180, 200]),
}


def simulate(person, plan, days):
    name, mins, dpw, clear, adr, deco = person
    P = PLANS[plan]
    gems = 0; keys = 1  # 환영 선물 열쇠 1개
    plays = 0; opened = 0; d_unlocks = 0; worlds = 0; prog = 0.0; ms_left = len(ENDLESS) * 5
    day_open_all = None; att = 0
    for day in range(1, days + 1):
        if (day - 1) % 7 >= dpw: continue
        att += 1; gems += P['att']
        if att == 10: keys += 1
        if att == 50: gems += 20
        n = max(1, round(mins / MIN_PER_PLAY)); plays += n
        gems += (plays // P['every']) - ((plays - n) // P['every'])
        # 스테이지 판: 하루 판의 40%가 스테이지 게임(열린 것 기준), 클리어율만큼 진행 → 월드(10판)마다 보상
        stage_clears = n * 0.4 * clear
        prog += stage_clears
        new_worlds = int(prog // 10) - worlds
        if new_worlds > 0:
            worlds += new_worlds; gems += new_worlds * P['stage_world']
            gems += round(new_worlds * P['stage_star'] * (clear - 0.4) / 0.6)  # 별 30개 다 모으는 월드 비율
        # 끝없는 게임 기록 이정표: 처음 며칠에 많이, 뒤로 갈수록 드물게 (게임당 5단계)
        if ms_left > 0 and P['endless_ms']:
            hit = min(ms_left, 2 if day <= 7 else (1 if day % 3 == 0 else 0))
            if mins >= 30: hit = min(ms_left, hit + 1)
            ms_left -= hit; gems += round(hit * P['endless_ms'] / 5)
        # 광고 보고 다이아 (보상형, 하루 상한)
        gems += min(P['ad_cap'], round(n * 0.3 * adr)) * P['ad_gem']
        # 게임 열기: 열쇠 먼저, 그다음 다이아(다음 가격이 되면 바로)
        while opened < LOCKED and keys > 0: keys -= 1; opened += 1
        while opened < LOCKED and gems >= P['unlock'][min(d_unlocks, 6)]:
            gems -= P['unlock'][min(d_unlocks, 6)]; d_unlocks += 1; opened += 1
        if opened >= LOCKED and day_open_all is None: day_open_all = day
    return dict(gems_left=gems, opened=opened, day_open_all=day_open_all, plays=plays)


def total_free(person, plan, days):
    """그 기간에 무료로 버는 다이아 합계 (쓰지 않았다고 치고)"""
    r = simulate(person, plan, days)
    spent = sum(PLANS[plan]['unlock'][:max(0, r['opened'] - 2)])  # 열쇠 2개(환영·출석 10일)는 다이아 안 씀
    return r['gems_left'] + spent, r


if __name__ == '__main__':
    print(f'꾸미기 전부 = {DECO_TOTAL} 다이아, 잠긴 게임 6개 다이아로만 = {sum(UNLOCK[:6])} (열쇠 2개 쓰면 {sum(UNLOCK[:4])})')
    for plan in PLANS:
        print('\n##', PLANS[plan]['name'], '| 열기 가격', PLANS[plan]['unlock'][:6])
        print('| 성향 | 30일 무료 다이아 | 30일에 연 게임 | 모두 연 날 | 90일 무료 다이아 | 90일에 연 게임 |')
        for p in PEOPLE:
            g30, r30 = total_free(p, plan, 30); g90, r90 = total_free(p, plan, 90)
            print(f"| {p[0]} | {g30} | {r30['opened']}/6 | {r90['day_open_all'] or '90일 넘음'} | {g90} | {r90['opened']}/6 |")
