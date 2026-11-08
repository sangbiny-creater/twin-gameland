"""난이도·보상 기준 문서 → Word(.docx). tools/balance_doc.mjs 가 부름
  python3 tools/balance_docx.py admin/balance/balance.json admin/balance/balance.docx
"""
import json, sys
from docx import Document
from docx.enum.section import WD_ORIENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor, Mm

PINK, NAVY, GRAY = RGBColor(0xB9, 0x2C, 0x62), RGBColor(0x33, 0x41, 0x5C), RGBColor(0x6B, 0x72, 0x80)
FONT = 'Malgun Gothic'


def shade(cell, hex_):
    p = cell._tc.get_or_add_tcPr(); s = OxmlElement('w:shd')
    s.set(qn('w:val'), 'clear'); s.set(qn('w:color'), 'auto'); s.set(qn('w:fill'), hex_); p.append(s)


def borders(t, color='E5D3DA'):
    # 표 테두리를 직접 넣음 (Table Grid 스타일이 없는 프로그램에서도 보이게)
    pr = t._tbl.tblPr; b = OxmlElement('w:tblBorders')
    for side in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        e = OxmlElement(f'w:{side}'); e.set(qn('w:val'), 'single'); e.set(qn('w:sz'), '6'); e.set(qn('w:color'), color); b.append(e)
    pr.append(b)


def run(par, text, size=10, bold=False, color=None):
    lines = str(text).split('\n')
    for i, ln in enumerate(lines):
        r = par.add_run(ln); r.font.size = Pt(size); r.bold = bold; r.font.name = FONT
        r._element.rPr.rFonts.set(qn('w:eastAsia'), FONT)
        if color: r.font.color.rgb = color
        if i < len(lines) - 1: r.add_break()


def main(src, dst):
    data = json.load(open(src, encoding='utf-8'))
    doc = Document()
    sec = doc.sections[0]  # 가로 A4 (표가 넓어서)
    sec.orientation = WD_ORIENT.LANDSCAPE; sec.page_width, sec.page_height = Mm(297), Mm(210)
    for side in ('left_margin', 'right_margin', 'top_margin', 'bottom_margin'): setattr(sec, side, Mm(14))
    st = doc.styles['Normal']; st.font.name = FONT; st.font.size = Pt(10); st.element.rPr.rFonts.set(qn('w:eastAsia'), FONT)
    for b in data['blocks']:
        k, v = next(iter(b.items()))
        if k == 'table':
            t = doc.add_table(rows=len(v), cols=len(v[0])); t.style = 'Table Grid'; borders(t)
            for i, row in enumerate(v):
                for j, c in enumerate(row):
                    cell = t.cell(i, j); cell.text = ''
                    run(cell.paragraphs[0], c, 9, bold=i == 0, color=RGBColor(0x7A, 0x23, 0x48) if i == 0 else None)
                    if i == 0: shade(cell, 'FCE4EE')
            doc.add_paragraph()
        elif k == 'note':
            t = doc.add_table(rows=1, cols=1); t.style = 'Table Grid'; borders(t, 'F0DC94'); c = t.cell(0, 0); shade(c, 'FFF6D8'); c.text = ''
            run(c.paragraphs[0], '판단할 때 볼 점', 10, True, RGBColor(0x8A, 0x64, 0x00))
            for x in v: run(c.add_paragraph(), '• ' + x, 9.5)
            doc.add_paragraph()
        elif k == 'h1': run(doc.add_heading(level=1), v, 15, True, PINK)
        elif k == 'h2': run(doc.add_heading(level=2), v, 12, True, NAVY)
        elif k == 'title': run(doc.add_paragraph(), v, 20, True, PINK)
        elif k in ('kicker', 'sub'): run(doc.add_paragraph(), v, 9.5, color=GRAY)
        elif k == 'li': run(doc.add_paragraph(style='List Bullet'), v)
        else: run(doc.add_paragraph(), v)
    doc.save(dst); print('balance.docx', len(data['blocks']), '칸')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
