'use strict';
// 난이도·보상 기준 문서 그리기 — 백오피스 탭(admin.js)과 PDF 인쇄 화면(print.html)이 같이 씀
// 자료: balance.json (tools/balance_doc.mjs 가 만듦) { date, blocks: [{ kicker|title|sub|h1|h2|p|li: 글 } | { table: [[칸…]…] } | { note: [글…] }] }
(function () {
  const H = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/\n/g, '<br>');
  function html(data) {
    let out = '', list = false;
    for (const b of data.blocks) {
      const k = Object.keys(b)[0], v = b[k];
      if (k !== 'li' && list) { out += '</ul>'; list = false; }
      if (k === 'li') { if (!list) { out += '<ul>'; list = true; } out += `<li>${H(v)}</li>`; }
      else if (k === 'table') out += `<div class="bd-tw"><table><thead><tr>${v[0].map((c) => `<th>${H(c)}</th>`).join('')}</tr></thead><tbody>${v.slice(1).map((r) => `<tr>${r.map((c) => `<td>${H(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      else if (k === 'note') out += `<div class="bd-note"><b>판단할 때 볼 점</b><ul>${v.map((x) => `<li>${H(x)}</li>`).join('')}</ul></div>`;
      else out += `<div class="bd-${k}">${H(v)}</div>`;
    }
    if (list) out += '</ul>';
    return `<div class="bd">${out}</div>`;
  }
  window.BalanceDoc = { html };
})();
