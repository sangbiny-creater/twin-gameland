'use strict';
// 메인 화면·아이템샵이 같이 쓰는 버튼 효과음(blip)과 아래쪽 알림(toast, 화면에 #toast 가 있어야 함)
(function () {
  let actx = null, toastT = 0;
  // f: 음 높이(Hz), d: 길이(초). 소리 설정이 꺼져 있으면 조용히
  function blip(f = 700, d = 0.09) {
    if (!window.Hub || !Hub.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d + 0.02);
    } catch (e) { /* no audio */ }
  }
  function toast(text) {
    const el = document.getElementById('toast'); el.textContent = text; el.classList.remove('hidden');
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.add('hidden'), 1800);
  }
  window.UI = { blip, toast };
})();
