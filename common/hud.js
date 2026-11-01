'use strict';
// 게임 화면 위쪽 표시를 같은 모양으로 (모양: common/hud.css, 그림: common/ui/hud/ — GPT J01~J03)
//  게임 코드는 그대로 두고, 표시 칸에 .hp 와 아이콘(--hud-ico)만 붙임. 칸 이름 글자(BEST·콤보·레벨·남은 짝)는 아이콘이 대신해서 지움
(function () {
  const src = (document.currentScript && document.currentScript.src) || '';
  const ICO = (n) => `url("${new URL(`ui/hud/ico_${n}.webp`, src).href}")`;
  // [찾을 칸, 아이콘, 지울 글자]
  const RULES = [
    ['.pill.coins, .pill:has(#hudCoin)', 'coin'],
    ['.pill:has(#hudDist), .pill:has(#hudHeight)', 'shoe'],
    ['.best, .best-label', 'crown', /BEST/],
    ['#timerPill', 'clock'],
    ['#hudStage', 'flag'],
    ['.pill.left', 'cards', /남은 짝/],
    ['.pill.score', 'trophy'],
    ['.pill.combo', 'fire', /콤보/],
    ['.pill.level', 'bolt', /레벨/],
    ['.total .rnd', 'target', /라운드/],
  ];
  function dress() {
    const hud = document.getElementById('hud'); if (!hud) return;
    for (const [sel, ico, drop] of RULES) {
      hud.querySelectorAll(sel).forEach((el) => {
        if (el.classList.contains('hp')) return;
        el.classList.add('hp'); el.style.setProperty('--hud-ico', ICO(ico));
        if (drop) for (const t of [...el.childNodes]) if (t.nodeType === 3 && drop.test(t.textContent)) t.textContent = t.textContent.replace(drop, '').trim() ? t.textContent.replace(drop, '') : '';
      });
    }
    const total = hud.querySelector('.total'); if (total) total.classList.add('hp-board');
    // 스테이지 칸: 게임이 '스테이지 1-1' 로 바꿔 써도 깃발 아이콘이 있으니 '1-1' 만
    const st = document.getElementById('hudStage');
    if (st && !st.dataset.hp) {
      st.dataset.hp = '1';
      const trim = () => { const t = st.textContent; if (/^스테이지\s*/.test(t)) st.textContent = t.replace(/^스테이지\s*/, ''); };
      trim(); new MutationObserver(trim).observe(st, { childList: true, characterData: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', dress); else dress();
})();
