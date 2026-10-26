"""캐시 버전 올리기: 모든 html/js/css/json 안의 ?v=… 와 ASSET_V 를 같은 새 값으로 바꿈.
폰이 예전 파일을 캐시에서 계속 쓰지 않게, 그림·코드를 바꾸면 커밋 전에 한 번 실행.
  python3 tools/bump_version.py          → 지금 시각(예: 202610251530)으로
  python3 tools/bump_version.py 20261025a
"""
import glob, os, re, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = ('_archive/', 'tools/', 'character/', 'image/', 'intro/', 'making_GPT/', 'memorygame/', 'molegame/', 'bakerygame/', 'dogsnackgame/', 'sacheonseong_game_assets_01_10/')


def files():
    for ext in ('html', 'js', 'css', 'json'):
        for f in glob.glob(f'{ROOT}/**/*.{ext}', recursive=True):
            rel = os.path.relpath(f, ROOT)
            if not rel.startswith(SKIP) and '/.' not in '/' + rel: yield f


def bump(v=None):
    v = v or time.strftime('%Y%m%d%H%M')
    n = 0
    for f in files():
        s = open(f, encoding='utf-8').read()
        t = re.sub(r'([?&]v=)[0-9A-Za-z]+', rf'\g<1>{v}', s)
        t = re.sub(r"(const ASSET_V = ')[0-9A-Za-z]+(')", rf'\g<1>{v}\g<2>', t)
        if t != s: open(f, 'w', encoding='utf-8').write(t); n += 1
    return v, n


if __name__ == '__main__':
    v, n = bump(sys.argv[1] if len(sys.argv) > 1 else None)
    print(f'캐시 버전 {v} — 파일 {n}개 바꿈')
