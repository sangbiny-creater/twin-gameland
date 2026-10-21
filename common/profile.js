'use strict';
// 트윈 게임랜드 공통 저장소 — 모든 미니게임이 같이 쓰는 캐릭터 · 코인 · 기록 (이 기기 localStorage)
//
// 새 게임을 추가할 때:
//   1) GAMES 에 게임을 등록하고
//   2) COIN_RULES 에 보너스 규칙을 적고
//   3) 게임 결과가 나오면 Hub.record('<게임id>', { ... }) 를 부르면 됩니다.
//
// 코인 규칙(모든 게임 공통):
//   - 게임 안에서 먹은 코인 1개 = 지갑 1코인 (보이는 만큼 받음)
//   - 모든 게임은 "잘하는 1분 플레이 ≈ 코인 100~150개" 정도가 되도록 코인 배치를 맞춘다
//   - 클리어/거리 보너스는 난이도에 비례해서 준다
(function () {
  const KEY = 'twin_gameland_v1';
  const FREE_SLOTS = 2;  // 처음엔 2명(은유, 은결)까지 무료
  const MAX_CHARS = 8;

  const GAMES = {
    // 4개 월드 × 3스테이지 = 12스테이지 (1-1 ~ 4-3)
    skyhook: { name: 'Sky Hook Runner', path: 'skyhook/index.html', stages: 12, worlds: ['하늘도시', '숲속 나무마을', '겨울왕국', '석양의 항구'], perWorld: 3 },
    helicopter: { name: 'Twin Helicopter', path: 'helicopter/index.html' },
    stairs: { name: '계단 오르기', path: 'stairs/index.html' },
  };

  const COIN_RULES = {
    // 스테이지(0부터) 난이도에 비례: 1-1 클리어 +20, 4-3 클리어 +130. 첫 클리어 +30, 별 1개당 +5
    skyhook: (r, first) => (r.cleared ? 20 + r.stage * 10 + r.stars * 5 + (first ? 30 : 0) : 0),
    // 100m 마다 +5 (멀리 갈수록 어려워지므로 거리 = 난이도)
    helicopter: (r) => Math.floor(r.dist / 100) * 5,
    // 50계단(m) 마다 +5
    stairs: (r) => Math.floor(r.dist / 50) * 5,
  };

  // ---------- 아이템샵 카탈로그 ----------
  // 배경 스킨: 게임마다 따로 사고, 산 스킨 중 하나를 '적용'하면 그 게임 내내 그 배경으로 플레이
  const SKINS = [
    { id: 'default', name: '기본 하늘', price: 0 },
    { id: 'forest', name: '숲 속 마을', price: 200 },
    { id: 'park', name: '놀이공원', price: 300 },
    { id: 'winter', name: '겨울 왕국', price: 300 },
    { id: 'sunset', name: '석양의 항구', price: 300 },
    { id: 'night', name: '야경 도시', price: 300 },
    { id: 'space', name: '우주 여행', price: 300 },
    { id: 'desert', name: '사막 오아시스', price: 300 },
  ];
  // 게임 부스트: 1개씩 사서 모아 두고, '사용중'으로 켜 둔 것만 게임을 시작할 때 1개씩 쓰임
  const BOOSTS = {
    skyhook: [
      { id: 'life', name: '추가 목숨', desc: '하트 4개로 시작', price: 300 },
      { id: 'shield', name: '1회 보호', desc: '처음 한 번 안 다쳐요', price: 300 },
      { id: 'magnet', name: '코인 흡수', desc: '처음 20초 자석', price: 300 },
      { id: 'x2', name: '코인 2배', desc: '처음 30초 코인 2배', price: 300 },
    ],
    helicopter: [
      { id: 'life', name: '추가 목숨', desc: '하트 4개로 시작', price: 300 },
      { id: 'shield', name: '1회 보호', desc: '처음 한 번 안 다쳐요', price: 200 },
      { id: 'dash', name: '스타트 대시', desc: '출발 3초 슝~ 무적', price: 200 },
      { id: 'magnet', name: '코인 흡수', desc: '처음 20초 자석', price: 300 },
      { id: 'x2', name: '코인 2배', desc: '처음 30초 코인 2배', price: 300 },
    ],
    stairs: [
      { id: 'life', name: '추가 목숨', desc: '시작할 때 목숨 +1', price: 300 },
      { id: 'time', name: '시작 시간 증가', desc: '시작 시간 +10초', price: 200 },
      { id: 'shield', name: '1회 보호', desc: '한 번 떨어져도 OK', price: 300 },
      { id: 'wing', name: '날개', desc: '처음 15칸 무적', price: 200 },
      { id: 'magnet', name: '코인 흡수', desc: '처음 20초 자석', price: 300 },
      { id: 'x2', name: '코인 2배', desc: '처음 20초 코인 2배', price: 300 },
    ],
  };

  // 캐릭터 추가 가격: 3번째 300, 4번째 600, 5번째 900 ...
  const slotPrice = (n) => 300 * (n - FREE_SLOTS);

  function blank() { return { v: 1, chars: [], slots: FREE_SLOTS, activeId: null, nextId: 1, settings: { sound: true } }; }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (d && d.v === 1) return Object.assign(blank(), d);
    } catch (e) { /* private mode */ }
    return blank();
  }
  let data = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } }
  function reload() { data = load(); }

  function find(id) { return data.chars.find((c) => c.id === id) || null; }
  function gameRec(c, g) {
    if (!c.games[g]) c.games[g] = { plays: 0, best: 0, coins: 0, last: 0, stages: {} };
    return c.games[g];
  }

  function shopOf(c) {
    if (!c.shop) c.shop = { skins: {}, equipped: {}, boosts: {}, using: {} };
    return c.shop;
  }

  const Hub = {
    GAMES, FREE_SLOTS, MAX_CHARS, SKINS, BOOSTS,

    // ----- 아이템샵 -----
    ownsSkin(game, id, c = this.active()) { return id === 'default' || !!(c && shopOf(c).skins[game] && shopOf(c).skins[game].includes(id)); },
    equippedSkin(game, c = this.active()) { return (c && shopOf(c).equipped[game]) || 'default'; },
    buySkin(game, id, c = this.active()) {
      const sk = SKINS.find((s) => s.id === id);
      if (!c || !sk || this.ownsSkin(game, id, c)) return { ok: false, why: 'owned' };
      if (c.coins < sk.price) return { ok: false, why: 'coins' };
      c.coins -= sk.price;
      const sh = shopOf(c); (sh.skins[game] = sh.skins[game] || []).push(id);
      sh.equipped[game] = id; // 사면 바로 적용
      save(); return { ok: true };
    },
    equipSkin(game, id, c = this.active()) { if (c && this.ownsSkin(game, id, c)) { shopOf(c).equipped[game] = id; save(); } },
    boostCount(game, id, c = this.active()) { return (c && shopOf(c).boosts[game] && shopOf(c).boosts[game][id]) || 0; },
    isUsing(game, id, c = this.active()) { return !!(c && shopOf(c).using[game] && shopOf(c).using[game][id]); },
    buyBoost(game, id, c = this.active()) {
      const b = (BOOSTS[game] || []).find((x) => x.id === id);
      if (!c || !b) return { ok: false };
      if (c.coins < b.price) return { ok: false, why: 'coins' };
      c.coins -= b.price;
      const sh = shopOf(c); sh.boosts[game] = sh.boosts[game] || {}; sh.boosts[game][id] = (sh.boosts[game][id] || 0) + 1;
      sh.using[game] = sh.using[game] || {}; sh.using[game][id] = true; // 사면 '사용중'으로
      save(); return { ok: true };
    },
    setUsing(game, id, on, c = this.active()) {
      if (!c) return; const sh = shopOf(c); sh.using[game] = sh.using[game] || {}; sh.using[game][id] = !!on; save();
    },
    // 게임 시작 때 부름: '사용중'이고 1개 이상 있는 부스트를 1개씩 꺼내 쓰고, 쓴 부스트 id 목록을 돌려줌
    takeBoosts(game) {
      reload();
      const c = this.active(); if (!c) return [];
      const sh = shopOf(c), have = sh.boosts[game] || {}, use = sh.using[game] || {};
      const used = [];
      for (const b of BOOSTS[game] || []) {
        if (use[b.id] && have[b.id] > 0) { have[b.id]--; used.push(b.id); if (!have[b.id]) use[b.id] = false; }
      }
      if (used.length) save();
      return used;
    },
    boostName(game, id) { const b = (BOOSTS[game] || []).find((x) => x.id === id); return b ? b.name : id; },
    get settings() { return data.settings; },
    setSound(on) { data.settings.sound = !!on; save(); },
    reload,

    chars() { return data.chars; },
    get(id) { return find(id); },
    active() { return find(data.activeId); },
    setActive(id) { if (find(id)) { data.activeId = id; save(); } },

    slots() { return data.slots; },
    canCreate() { return data.chars.length < data.slots; },
    nextSlotPrice() { return data.slots >= MAX_CHARS ? null : slotPrice(data.slots + 1); },
    // 새 캐릭터 자리 사기 (payerId 캐릭터의 코인으로)
    buySlot(payerId) {
      const c = find(payerId), price = this.nextSlotPrice();
      if (!c || price == null || c.coins < price) return false;
      c.coins -= price; data.slots++; save(); return true;
    },
    create(name, look) {
      if (!this.canCreate()) return null;
      const c = { id: 'c' + data.nextId++, name: String(name).trim().slice(0, 8) || '친구', look: look === 'eungyeol' ? 'eungyeol' : 'eunyu', coins: 0, earned: 0, created: Date.now(), games: {}, history: [] };
      data.chars.push(c);
      if (!data.activeId) data.activeId = c.id;
      save(); return c;
    },
    rename(id, name) { const c = find(id); if (c) { c.name = String(name).trim().slice(0, 8) || c.name; save(); } },
    remove(id) {
      data.chars = data.chars.filter((c) => c.id !== id);
      if (data.activeId === id) data.activeId = data.chars[0] ? data.chars[0].id : null;
      save();
    },

    stageLabel(i) { const k = GAMES.skyhook.perWorld; return `${Math.floor(i / k) + 1}-${(i % k) + 1}`; },
    stageName(i) { const k = GAMES.skyhook.perWorld; return `${GAMES.skyhook.worlds[Math.floor(i / k)]} ${(i % k) + 1}`; },

    // 즐겨찾기 (캐릭터마다 따로). favs 순서 = 별을 누른 순서 → 로비는 최근 누른 게임부터
    isFav(game, c = this.active()) { return !!(c && c.favs && c.favs.includes(game)); },
    toggleFav(game, c = this.active()) {
      if (!c) return false;
      c.favs = c.favs || [];
      if (c.favs.includes(game)) c.favs = c.favs.filter((g) => g !== game); else c.favs.push(game);
      save(); return c.favs.includes(game);
    },

    rec(game, c = this.active()) { return c ? gameRec(c, game) : null; },
    starsTotal(c) { const r = c.games.skyhook; return r ? Object.values(r.stages).reduce((s, x) => s + (x.stars || 0), 0) : 0; },

    // 스카이훅 징검다리: 앞 스테이지를 깨야 다음이 열린다
    skyhookStage(i, c = this.active()) { const r = this.rec('skyhook', c); return (r && r.stages[i]) || { cleared: false, stars: 0, best: 0, plays: 0 }; },
    skyhookUnlocked(i, c = this.active()) { return i === 0 || this.skyhookStage(i - 1, c).cleared; },
    skyhookNext(c = this.active()) {
      for (let i = 0; i < GAMES.skyhook.stages; i++) if (!this.skyhookStage(i, c).cleared) return i;
      return GAMES.skyhook.stages - 1;
    },
    skyhookCleared(c = this.active()) { let n = 0; for (let i = 0; i < GAMES.skyhook.stages; i++) if (this.skyhookStage(i, c).cleared) n++; return n; },

    // 게임 결과 저장 + 코인 지급. 반환: { earned, bonus, newBest, firstClear, coins }
    //   skyhook:    { stage, cleared, dist, coins, stars }
    //   helicopter: { dist, coins }
    record(game, r) {
      reload(); // 다른 탭/게임에서 바뀌었을 수 있음
      const c = this.active();
      if (!c) return null;
      const g = gameRec(c, game);
      g.plays++; g.last = Date.now();
      let first = false, newBest = false;
      if (game === 'skyhook') {
        const st = g.stages[r.stage] || (g.stages[r.stage] = { cleared: false, stars: 0, best: 0, plays: 0 });
        st.plays++;
        if (r.dist > st.best) { st.best = r.dist; newBest = true; }
        if (r.cleared) { first = !st.cleared; st.cleared = true; st.stars = Math.max(st.stars, r.stars || 0); }
      }
      if (r.dist > g.best) { g.best = r.dist; if (game !== 'skyhook') newBest = true; }
      const bonus = COIN_RULES[game] ? COIN_RULES[game](r, first) : 0;
      const earned = (r.coins || 0) + bonus;
      g.coins += earned; c.coins += earned; c.earned += earned;
      c.history.unshift({ game, at: Date.now(), stage: r.stage, cleared: !!r.cleared, dist: r.dist, earned, stars: r.stars || 0 });
      c.history = c.history.slice(0, 30);
      save();
      return { earned, bonus, newBest, firstClear: first, coins: c.coins };
    },
  };
  window.Hub = Hub;
})();
