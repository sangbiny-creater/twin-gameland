"""화면에 나오는 한글 뽑기 (영문판 번역 목록·다국어 표 만들기용): HTML 글자·속성(alt·aria-label·title·placeholder) + JS 문자열 (주석은 뺌)
   python3 tools/i18n_extract.py <저장소> <출력 txt>   → 한 줄에 하나 (번역 목록 docs/영문판_번역대상_한글목록.txt 와 같은 모양)
   tools/i18n_build.py 가 pieces() 로 '번역 목록 글'(앞뒤 {} 뺀 것)과 '실제 코드 모양'(앞뒤 {} 그대로)을 같이 씀
"""
import os, re, sys
from html.parser import HTMLParser

HANGUL = re.compile(r'[가-힣]')
DIRS = ['index.html', 'hub', 'common', 'shop', 'downhill', 'bakery', 'stairs', 'helicopter', 'dogsnack', 'shisen', 'memory', 'mole', 'darts', 'giftsort', 'skyhook']
SKIP_DIR = {'assets', 'chars', 'costumes', 'faces', 'items', 'ui', 'worlds', 'icons', 'cards', 'intro', 'park', 'select'}


def skip_str(src, i):
    """src[i] 가 따옴표일 때 그 문자열 끝 다음 자리"""
    q, j = src[i], i + 1
    while j < len(src):
        if src[j] == '\\': j += 2; continue
        if q == '`' and src.startswith('${', j): j = match_brace(src, j + 2); continue
        if src[j] == q: return j + 1
        if src[j] == '\n' and q != '`': return j
        j += 1
    return j


def match_brace(src, j):
    """${ 다음 자리 j 에서 짝이 맞는 } 다음 자리"""
    depth = 1
    while j < len(src) and depth:
        d = src[j]
        if d in '\'"`': j = skip_str(src, j); continue
        if d == '{': depth += 1
        elif d == '}': depth -= 1
        j += 1
    return j


def js_strings(src):
    """JS 소스에서 문자열 리터럴만 (주석 제외). 템플릿 문자열의 ${...} 는 {} 로 바꾸고, 그 안의 문자열도 따로 뽑음"""
    out, i, n = [], 0, len(src)
    while i < n:
        if src.startswith('//', i): i = src.find('\n', i); i = n if i < 0 else i; continue
        if src.startswith('/*', i): j = src.find('*/', i + 2); i = n if j < 0 else j + 2; continue
        c = src[i]
        if c in '\'"`':
            q, j, buf = c, i + 1, []
            while j < n:
                d = src[j]
                if d == '\\': buf.append(src[j:j + 2]); j += 2; continue
                if q == '`' and src.startswith('${', j):
                    k = match_brace(src, j + 2); out += js_strings(src[j + 2:k - 1]); buf.append('{}'); j = k; continue
                if d == q or (d == '\n' and q != '`'): break
                buf.append(d); j += 1
            out.append(''.join(buf)); i = j + 1; continue
        i += 1
    return out


class H(HTMLParser):
    def __init__(self):
        super().__init__(); self.items = []; self.skip = 0; self.scripts = []; self.cur = None
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'): self.skip += 1; self.cur = [] if tag == 'script' else None
        for k, v in attrs:
            if k in ('alt', 'aria-label', 'title', 'placeholder', 'content') and v and HANGUL.search(v): self.items.append(v)
    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.skip -= 1
            if tag == 'script' and self.cur is not None: self.scripts.append(''.join(self.cur)); self.cur = None
    def handle_data(self, d):
        if self.skip:
            if self.cur is not None: self.cur.append(d)
            return
        t = ' '.join(d.split())
        if t and HANGUL.search(t): self.items.append(t)


def clean(s):
    """한 문자열 → 화면 글자 조각 목록. 줄바꿈(<br>)은 ' / ', 글자 꾸밈(b·i·small·em·strong)은 빼고, 그 밖의 태그(div·h3·p·img·button…)는 따로 나눔"""
    s = s.replace('\\n', ' ').replace('\\\'', "'").replace('\\"', '"')
    s = re.sub(r'<br\s*/?>', ' / ', s)
    s = re.sub(r'</?(b|i|small|em|strong)\b[^>]*>', '', s)
    parts = re.split(r'<[^>]+>', s)
    out = []
    for p in parts:
        p = ' '.join(p.split()).strip(' /')
        full = p
        p = re.sub(r'^(\{\}\s*)+|(\s*\{\})+$', '', p).strip() if re.fullmatch(r'[\s{}]*', p) is None else p
        if p: out.append((p, full))
    return out


def pieces(ROOT):
    files = []
    for d in DIRS:
        p = os.path.join(ROOT, d)
        if os.path.isfile(p): files.append(p); continue
        for base, dirs, fs in os.walk(p):
            dirs[:] = [x for x in dirs if x not in SKIP_DIR or base == p and x not in SKIP_DIR]
            for f in sorted(fs):
                if f.endswith(('.html', '.js')) and not f.startswith('i18n'): files.append(os.path.join(base, f))

    seen, lines, ALL = set(), [], []
    for f in files:
        src = open(f, encoding='utf-8').read()
        got = []
        if f.endswith('.html'):
            h = H(); h.feed(src); got += h.items
            for sc in h.scripts: got += js_strings(sc)
        else:
            got += js_strings(src)
        rel = os.path.relpath(f, ROOT)
        block = []
        for g in got:
            if not HANGUL.search(g): continue
            if re.fullmatch(r'[A-Za-z0-9_./\-?=&%:#]*', g): continue   # 파일 이름·주소
            for part, full in clean(g):
                ALL.append((rel, part, full))
                if part and HANGUL.search(part) and part not in seen:
                    seen.add(part); block.append(part)
        if block:
            lines.append(f'# {rel}')
            lines += block
    return lines, ALL


if __name__ == '__main__':
    lines, _ = pieces(sys.argv[1])
    open(sys.argv[2], 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    print(sum(1 for l in lines if not l.startswith('#')), 'items')
