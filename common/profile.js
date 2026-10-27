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

  // 징검다리 게임(스카이훅·사천성·메모리 게임)이 같이 쓰는 10개 월드 (스카이훅 5판씩 50판 1-1 ~ 10-5, 사천성·메모리 게임 10판씩 100판 1-1 ~ 10-10)
  // 배경 그림은 common/worlds/w1.webp ~ w10.webp
  const WORLDS = ['하늘도시', '숲속 나무마을', '겨울왕국', '석양의 항구', '벚꽃마을', '구름왕국', '바닷속도시', '마법숲', '별빛우주', '황금성'];
  const GAMES = {
    skyhook: { name: 'Sky Hook Runner', path: 'skyhook/index.html', stages: 50, worlds: WORLDS, perWorld: 5 },
    helicopter: { name: 'Twin Helicopter', path: 'helicopter/index.html' },
    stairs: { name: '계단 오르기', path: 'stairs/index.html' },
    shisen: { name: '사천성', path: 'shisen/index.html', stages: 100, worlds: WORLDS, perWorld: 10 }, // 10개 월드 × 10판 (1-1 ~ 10-10)
    downhill: { name: '다운힐 러너', path: 'downhill/index.html' },
    memory: { name: '메모리 게임', path: 'memory/index.html', stages: 100, worlds: WORLDS, perWorld: 10 }, // 사천성처럼 10개 월드 × 10판
    mole: { name: '두더지 게임', path: 'mole/index.html', stages: 100, worlds: WORLDS, perWorld: 10 }, // 10개 월드 × 10판, 기록(best) = 최고 점수
    bakery: { name: '달콤 베이커리', path: 'bakery/index.html' }, // 끝없이 이어지는 게임, 기록(best) = 최고 점수
    dogsnack: { name: '멍멍이 간식 타임', path: 'dogsnack/index.html' }, // 3줄 버튼 리듬 게임 (베이커리와 같은 규칙·같은 기록 방식). 예전 이름 caketap(케이크 탭탭)
    darts: { name: '다트 게임', path: 'darts/index.html' }, // 카운트업 8라운드 × 3발, 기록(best) = 최고 점수
  };

  const COIN_RULES = {
    // 스테이지(0~49) 난이도에 비례: 1-1 클리어 +20 … 10-5 클리어 +167. 첫 클리어 +30, 별 1개당 +5
    skyhook: (r, first) => (r.cleared ? 20 + r.stage * 3 + r.stars * 5 + (first ? 30 : 0) : 0),
    // 100m 마다 +5 (멀리 갈수록 어려워지므로 거리 = 난이도)
    helicopter: (r) => Math.floor(r.dist / 100) * 5,
    // 50계단(m) 마다 +5
    stairs: (r) => Math.floor(r.dist / 50) * 5,
    // 스카이훅과 같은 징검다리 규칙 (100판이라 판마다 +1.5: 1-1 +20 … 10-10 +169)
    shisen: (r, first) => (r.cleared ? 20 + Math.round(r.stage * 1.5) + r.stars * 5 + (first ? 30 : 0) : 0),
    // 100m 마다 +5 (헬리콥터와 같은 거리 규칙)
    downhill: (r) => Math.floor(r.dist / 100) * 5,
    // 사천성과 같은 징검다리 규칙 (100판: 1-1 +20 … 10-10 +169)
    memory: (r, first) => (r.cleared ? 20 + Math.round(r.stage * 1.5) + r.stars * 5 + (first ? 30 : 0) : 0),
    // 사천성과 같은 징검다리 규칙
    mole: (r, first) => (r.cleared ? 20 + Math.round(r.stage * 1.5) + r.stars * 5 + (first ? 30 : 0) : 0),
    // 1000점마다 +5 (오래 버틸수록 빨라지므로 점수 = 난이도)
    bakery: (r) => Math.floor(r.dist / 1000) * 5,
    dogsnack: (r) => Math.floor(r.dist / 1000) * 5,
    // 100점마다 +10 (24발 합계 점수)
    darts: (r) => Math.floor(r.dist / 100) * 10,
  };

  // ---------- 아이템샵 카탈로그 ----------
  // 배경 스킨: 한 번 사서 '적용'하면 모든 게임 배경이 함께 바뀐다 (게임마다 자기 그림으로 그림)
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
  // 예전(게임별) 스킨 id → 공통 id
  const OLD_SKIN = { autumn: 'forest', moon: 'space' };
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
    // manual: 게임 화면의 버튼으로 하나씩 꺼내 쓰는 아이템 (판이 바뀌어도 수량 그대로)
    shisen: [
      { id: 'hint', name: '힌트', desc: '짝 하나를 알려줘요', price: 60, manual: true },
      { id: 'shuffle', name: '섞기', desc: '타일 위치를 섞어요', price: 80, manual: true },
      { id: 'time', name: '시간 추가', desc: '제한 시간 +10초', price: 80, manual: true },
      { id: 'bomb', name: '폭탄', desc: '짝 하나를 바로 없애요', price: 150, manual: true },
      { id: 'find', name: '자동 찾기', desc: '처음 20초 짝을 표시', price: 300 },
      { id: 'combo', name: '콤보 보너스', desc: '콤보 코인 2배', price: 300 },
    ],
    downhill: [
      { id: 'life', name: '추가 하트', desc: '하트 4개로 시작', price: 300 },
      { id: 'shield', name: '보호막', desc: '처음 한 번 안 다쳐요', price: 200 },
      { id: 'dash', name: '스타트 부스터', desc: '출발 5초 슝~ 무적', price: 200 },
      { id: 'magnet', name: '자석', desc: '처음 20초 코인 흡수', price: 300 },
      { id: 'x2', name: '코인 2배', desc: '처음 30초 코인 2배', price: 300 },
    ],
    memory: [
      { id: 'hint', name: '힌트', desc: '짝 하나를 잠깐 보여줘요', price: 60, manual: true },
      { id: 'find', name: '모두 보기', desc: '모든 카드를 2초 보여줘요', price: 120, manual: true },
      { id: 'time', name: '시간 추가', desc: '제한 시간 +10초', price: 80, manual: true },
      { id: 'bomb', name: '짝 맞추기', desc: '짝 하나를 바로 찾아요', price: 150, manual: true },
      { id: 'combo', name: '콤보 보너스', desc: '콤보 코인 2배', price: 300 },
    ],
    mole: [
      { id: 'time', name: '시간 추가', desc: '제한 시간 +10초', price: 80, manual: true },
      { id: 'double', name: '점수 2배', desc: '10초 동안 점수 2배', price: 100, manual: true },
      { id: 'rainbow', name: '무지개 망치', desc: '나온 두더지를 한꺼번에', price: 150, manual: true },
      { id: 'combo', name: '콤보 보너스', desc: '콤보 코인 2배', price: 300 },
    ],
    bakery: [
      { id: 'life', name: '추가 하트', desc: '하트 3개(최대)로 시작', price: 300 },
      { id: 'shield', name: '1회 보호', desc: '처음 한 번 실수해도 OK', price: 200 },
      { id: 'slow', name: '천천히 시작', desc: '처음 20초 천천히', price: 200 },
      { id: 'x2', name: '코인 2배', desc: '처음 30초 코인 2배', price: 300 },
    ],
    dogsnack: [
      { id: 'life', name: '추가 하트', desc: '하트 4개로 시작', price: 300 },
      { id: 'shield', name: '1회 보호', desc: '처음 한 번 실수해도 OK', price: 200 },
      { id: 'slow', name: '천천히 시작', desc: '처음 20초 천천히', price: 200 },
      { id: 'x2', name: '코인 2배', desc: '처음 30초 코인 2배', price: 300 },
    ],
  };

  // ---------- 캐릭터 꾸미기 (코스튬) ----------
  // 캐릭터(프로필)마다 산 옷을 따로 저장. 입은 옷은 모든 게임 플레이·메뉴 화면에 보임
  // 그림: common/costumes/<eunyu|eungyeol>_<id>.webp (달리기: _run0, _run1)
  const COSTUMES = [
    { id: 'hanbok', name: '한복', price: 300, desc: '고운 한복을 입었어요!' },
    { id: 'raincoat', name: '우비', price: 300, desc: '비 오는 날에도 신나게!' },
    { id: 'pajamas', name: '잠옷', price: 300, desc: '포근포근 곰돌이 잠옷이에요' },
    { id: 'roman', name: '로마병사', price: 300, desc: '용감한 고대 로마 병사!' },
    { id: 'tracksuit', name: '츄리닝', price: 300, desc: '편하게 달리기 좋은 츄리닝' },
    { id: 'dino', name: '공룡 옷', price: 300, desc: '귀여운 공룡이 되었어요!' },
    { id: 'school', name: '교복', price: 300, desc: '단정한 교복 차림!' },
    { id: 'swimsuit', name: '수영복', price: 300, desc: '물놀이 준비 완료!' },
    { id: 'wizard', name: '마법사 옷', price: 300, desc: '반짝반짝 마법 지팡이!' },
    { id: 'santa', name: '산타클로스', price: 300, desc: '선물을 나눠 주는 산타!' },
    { id: 'baseball', name: '야구복', price: 300, desc: '홈런을 노리는 야구 선수!' },
    { id: 'suit', name: '정장', price: 300, desc: '멋쟁이 정장 차림!' },
    { id: 'detective', name: '탐정 옷', price: 300, desc: '돋보기로 수수께끼 해결!' },
  ];
  // ---------- 쿠폰 ----------
  // 띄어쓰기·대소문자 상관없이 입력. once: 캐릭터마다 한 번만
  const COUPONS = {
    showmethemoney: { coins: 5000, once: false, msg: '코인 5000개를 받았어요!' },
    // 게임 테스트용 무적 (모든 캐릭터·모든 게임에 적용, 끌 때까지 유지)
    supermanon: { god: true, once: false, msg: '무적 모드 ON! 이제 안 죽어요' },
    supermanoff: { god: false, once: false, msg: '무적 모드 OFF' },
    // 모든 게임의 모든 스테이지 자물쇠 풀기 (모든 캐릭터, 계속 유지)
    openeverything: { openAll: true, once: false, msg: '모든 스테이지 자물쇠가 풀렸어요!' },
    closeeverything: { openAll: false, once: false, msg: '자물쇠가 다시 잠겼어요 (깬 스테이지까지만 열려요)' },
  };

  // 캐릭터 모양: 기본 은유·은결 + 새 캐릭터 v2 (그림은 common/chars, common/charv2.js)
  const LOOKS = (window.CHAR_LOOKS || [{ look: 'eunyu' }, { look: 'eungyeol' }]).map((l) => l.look);
  // 옷(코스튬) 그림이 있는 캐릭터
  const DRESSABLE = (window.CHAR_LOOKS || [{ look: 'eunyu', dress: true }, { look: 'eungyeol', dress: true }]).filter((l) => l.dress).map((l) => l.look);

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
  // 숨긴 옛 모습(hidden)은 같은 계열의 가장 새 모습으로 (이름·코인·진행도는 그대로)
  const lookInfo = (look) => (window.CHAR_LOOKS || []).find((l) => l.look === look);
  const lookBase = (look) => (lookInfo(look) || {}).base || (String(look).startsWith('eungyeol') ? 'eungyeol' : 'eunyu');
  const latestLook = (base) => {
    const shown = (window.CHAR_LOOKS || []).filter((l) => l.base === base && !l.hidden);
    return shown.length ? shown[shown.length - 1].look : base;
  };
  function upgradeLooks(d) {
    let changed = false;
    for (const c of d.chars) {
      const l = lookInfo(c.look);
      if (l && l.hidden) { c.look = latestLook(l.base); changed = true; }
    }
    return changed;
  }
  // 게임 이름이 바뀐 것: 예전 기록·아이템·즐겨찾기를 새 이름으로 옮김 (케이크 탭탭 → 멍멍이 간식 타임, 2026-10-26)
  const RENAMED = { caketap: 'dogsnack' };
  function upgradeGames(d) {
    let changed = false;
    for (const c of d.chars) {
      for (const [o, n] of Object.entries(RENAMED)) {
        if (c.games && c.games[o]) { if (!c.games[n]) c.games[n] = c.games[o]; delete c.games[o]; changed = true; }
        for (const h of c.history || []) if (h.game === o) { h.game = n; changed = true; }
        if (c.favs && c.favs.includes(o)) { c.favs = c.favs.map((g) => (g === o ? n : g)); changed = true; }
        const sh = c.shop;
        if (sh) for (const k of ['boosts', 'using']) if (sh[k] && sh[k][o]) { if (!sh[k][n]) sh[k][n] = sh[k][o]; delete sh[k][o]; changed = true; }
      }
    }
    return changed;
  }
  const upgrade = (d) => upgradeGames(d) | upgradeLooks(d);
  let data = load();
  if (upgrade(data)) try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } }
  function reload() { data = load(); upgrade(data); }

  function find(id) { return data.chars.find((c) => c.id === id) || null; }
  function gameRec(c, g) {
    if (!c.games[g]) c.games[g] = { plays: 0, best: 0, coins: 0, last: 0, stages: {} };
    return c.games[g];
  }

  function shopOf(c) {
    if (!c.shop) c.shop = { skins: {}, equipped: {}, boosts: {}, using: {} };
    const sh = c.shop;
    if (!Array.isArray(sh.skinAll)) { // 게임별로 샀던 스킨을 공통 스킨으로 옮기기
      const own = new Set();
      for (const g in sh.skins || {}) for (const id of sh.skins[g] || []) own.add(OLD_SKIN[id] || id);
      sh.skinAll = [...own].filter((id) => SKINS.some((k) => k.id === id));
      const eq = sh.equipped || {};
      const pick = [eq.skyhook, eq.stairs, eq.helicopter, eq.shisen].map((id) => OLD_SKIN[id] || id).find((id) => id && id !== 'default' && sh.skinAll.includes(id));
      sh.skinOn = pick || 'default';
    }
    return sh;
  }

  // 무적 모드일 때 화면 위에 작은 표시
  function godBadge() {
    if (typeof document === 'undefined') return;
    const put = () => {
      let el = document.getElementById('godBadge');
      if (!data.settings.god) { if (el) el.remove(); return; }
      if (!el) {
        el = document.createElement('div'); el.id = 'godBadge'; el.textContent = '🦸 무적 · 기록·코인 없음';
        el.style.cssText = 'position:fixed;left:50%;top:calc(4px + env(safe-area-inset-top));transform:translateX(-50%);z-index:99999;pointer-events:none;background:rgba(214,52,76,.88);color:#fff;font:15px Jua,system-ui,sans-serif;padding:2px 10px;border-radius:10px;';
        document.body.appendChild(el);
      }
    };
    if (document.body) put(); else document.addEventListener('DOMContentLoaded', put);
  }

  const Hub = {
    GAMES, WORLDS, FREE_SLOTS, MAX_CHARS, SKINS, BOOSTS, COSTUMES,

    // ----- 캐릭터 꾸미기 -----
    ownsCostume(id, c = this.active()) { return !!(c && (c.costumes || []).includes(id)); },
    costume(c = this.active()) { return (c && c.costume) || null; }, // 입은 옷 id (없으면 기본 옷)
    // 게임·메뉴에서 쓸 그림 경로 (기본 옷이면 null). base: 페이지 위치에 따라 '../' 등
    latestLook, lookBase, // 계열(은유/은결)의 가장 새 모습 · 모습의 계열
    canDress(c = this.active()) { return !!(c && DRESSABLE.includes(c.look)); },
    costumeImg(c = this.active(), base = '') { const id = this.canDress(c) && this.costume(c); return id ? `${base}common/costumes/${c.look}_${id}.webp?v=202610272252` : null; },
    buyCostume(id, c = this.active()) {
      const it = COSTUMES.find((x) => x.id === id);
      if (!c || !it || this.ownsCostume(id, c)) return { ok: false };
      if (c.coins < it.price) return { ok: false, why: 'coins' };
      c.coins -= it.price; c.costumes = [...(c.costumes || []), id]; c.costume = id; // 사면 바로 입음
      save(); return { ok: true };
    },
    wearCostume(id, c = this.active()) { if (!c) return; if (id && !this.ownsCostume(id, c)) return; c.costume = id || null; save(); },
    // 쿠폰: { ok, msg }
    redeem(code, c = this.active()) {
      const key = String(code || '').toLowerCase().replace(/\s+/g, '');
      const cp = COUPONS[key];
      if (!c || !cp) return { ok: false, msg: '없는 쿠폰 번호예요' };
      c.coupons = c.coupons || [];
      if (cp.once && c.coupons.includes(key)) return { ok: false, msg: '이미 사용한 쿠폰이에요' };
      c.coins += cp.coins || 0; c.earned += cp.coins || 0; c.coupons.push(key);
      if (cp.god != null) { data.settings.god = cp.god; godBadge(); }
      if (cp.openAll != null) data.settings.openAll = cp.openAll;
      save(); return { ok: true, msg: cp.msg, coins: c.coins };
    },

    // ----- 아이템샵 -----
    // 배경 스킨은 모든 게임 공통 (game 인자는 예전 코드 호환용이라 무시)
    ownsSkin(id, c = this.active()) { return id === 'default' || !!(c && shopOf(c).skinAll.includes(id)); },
    equippedSkin(game, c = this.active()) { return (c && shopOf(c).skinOn) || 'default'; },
    buySkin(id, c = this.active()) {
      const sk = SKINS.find((s) => s.id === id);
      if (!c || !sk || this.ownsSkin(id, c)) return { ok: false, why: 'owned' };
      if (c.coins < sk.price) return { ok: false, why: 'coins' };
      c.coins -= sk.price;
      const sh = shopOf(c); sh.skinAll.push(id);
      sh.skinOn = id; // 사면 바로 적용
      save(); return { ok: true };
    },
    equipSkin(id, c = this.active()) { if (c && this.ownsSkin(id, c)) { shopOf(c).skinOn = id; save(); } },
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
        if (b.manual) continue; // 버튼으로 쓰는 아이템은 여기서 꺼내지 않음
        if (use[b.id] && have[b.id] > 0) { have[b.id]--; used.push(b.id); if (!have[b.id]) use[b.id] = false; }
      }
      if (used.length) save();
      return used;
    },
    // ----- 아이템 수량 (구매·게임 보상·게임에서 사용을 모두 이 숫자 하나로) -----
    addBoost(game, id, n = 1, c = this.active()) {
      if (!c) return 0;
      const sh = shopOf(c); sh.boosts[game] = sh.boosts[game] || {}; sh.boosts[game][id] = Math.max(0, (sh.boosts[game][id] || 0) + n);
      save(); return sh.boosts[game][id];
    },
    // 1개 쓰기: 있으면 줄이고 true
    useBoost(game, id, c = this.active()) {
      if (!c || this.boostCount(game, id, c) <= 0) return false;
      shopOf(c).boosts[game][id]--; save(); return true;
    },
    // 캐릭터마다 한 번만 주는 기본 아이템
    starterKit(game, c = this.active()) {
      const KITS = { shisen: { hint: 3, shuffle: 2, time: 1 }, memory: { hint: 3, find: 1, time: 1 }, mole: { time: 1, double: 1, rainbow: 1 } };
      if (!c || !KITS[game]) return false;
      const sh = shopOf(c); sh.starter = sh.starter || {};
      if (sh.starter[game]) return false;
      for (const [id, n] of Object.entries(KITS[game])) { sh.boosts[game] = sh.boosts[game] || {}; sh.boosts[game][id] = (sh.boosts[game][id] || 0) + n; }
      sh.starter[game] = true; save(); return true;
    },
    boostName(game, id) { const b = (BOOSTS[game] || []).find((x) => x.id === id); return b ? b.name : id; },
    get settings() { return data.settings; },
    // 무적 모드 (쿠폰 supermanon / supermanoff)
    get god() { return !!data.settings.god; },
    setSound(on) { data.settings.sound = !!on; save(); },
    reload,

    chars() { return data.chars; },
    get(id) { return find(id); },
    active() { return find(data.activeId); },
    setActive(id) { if (find(id)) { data.activeId = id; save(); } },

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
      const c = { id: 'c' + data.nextId++, name: String(name).trim().slice(0, 8) || '친구', look: LOOKS.includes(look) && !(lookInfo(look) || {}).hidden ? look : latestLook(lookBase(look)), coins: 0, earned: 0, created: Date.now(), games: {}, history: [] };
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

    stageLabel(i, game = 'skyhook') { const k = GAMES[game].perWorld; return `${Math.floor(i / k) + 1}-${(i % k) + 1}`; },
    stageName(i, game = 'skyhook') { const k = GAMES[game].perWorld; return `${GAMES[game].worlds[Math.floor(i / k)]} ${(i % k) + 1}`; },

    // 즐겨찾기 (캐릭터마다 따로). favs 순서 = 별을 누른 순서 → 로비는 최근 누른 게임부터
    isFav(game, c = this.active()) { return !!(c && c.favs && c.favs.includes(game)); },
    toggleFav(game, c = this.active()) {
      if (!c) return false;
      c.favs = c.favs || [];
      if (c.favs.includes(game)) c.favs = c.favs.filter((g) => g !== game); else c.favs.push(game);
      save(); return c.favs.includes(game);
    },

    rec(game, c = this.active()) { return c ? gameRec(c, game) : null; },
    // 별 = 징검다리 게임(스카이훅·사천성)에서 모은 별 합계
    starsTotal(c) {
      let n = 0;
      for (const g of Object.keys(GAMES)) if (GAMES[g].stages && c.games[g]) n += Object.values(c.games[g].stages).reduce((s, x) => s + (x.stars || 0), 0);
      return n;
    },

    // 징검다리(스테이지) 게임: 앞 스테이지를 깨야 다음이 열린다
    stage(game, i, c = this.active()) { const r = this.rec(game, c); return (r && r.stages[i]) || { cleared: false, stars: 0, best: 0, plays: 0 }; },
    stageUnlocked(game, i, c = this.active()) { return i === 0 || !!data.settings.openAll || this.stage(game, i - 1, c).cleared; },
    stageNext(game, c = this.active()) {
      for (let i = 0; i < GAMES[game].stages; i++) if (!this.stage(game, i, c).cleared) return i;
      return GAMES[game].stages - 1;
    },
    stageCleared(game, c = this.active()) { let n = 0; for (let i = 0; i < GAMES[game].stages; i++) if (this.stage(game, i, c).cleared) n++; return n; },
    // 예전 이름 (스카이훅 코드에서 사용)
    skyhookStage(i, c) { return this.stage('skyhook', i, c); },
    skyhookUnlocked(i, c) { return this.stageUnlocked('skyhook', i, c); },
    skyhookNext(c) { return this.stageNext('skyhook', c); },

    // 게임 결과 저장 + 코인 지급. 반환: { earned, bonus, newBest, firstClear, coins }
    //   skyhook:    { stage, cleared, dist, coins, stars }
    //   helicopter: { dist, coins }
    //   shisen:     { stage, cleared, dist: 0, coins, stars, time(클리어까지 걸린 초) }
    //   memory:     shisen 과 같음
    //   mole:       { stage, cleared, dist(점수), coins, stars }
    //   bakery:     { dist(점수), coins, level(도착한 레벨) }
    //   dogsnack:   bakery 와 같음
    //   darts:      { dist(24발 합계 점수), coins }
  //   downhill:   { dist, coins }
    record(game, r) {
      reload(); // 다른 탭/게임에서 바뀌었을 수 있음
      const c = this.active();
      if (!c) return null;
      // 무적 모드(테스트용) 판은 기록·코인을 남기지 않음
      if (data.settings.god) return { earned: 0, bonus: 0, newBest: false, firstClear: false, coins: c.coins, god: true };
      const g = gameRec(c, game);
      g.plays++; g.last = Date.now();
      let first = false, newBest = false;
      const staged = !!GAMES[game].stages;
      if (staged) {
        const st = g.stages[r.stage] || (g.stages[r.stage] = { cleared: false, stars: 0, best: 0, plays: 0 });
        st.plays++;
        if (r.dist > st.best) { st.best = r.dist; newBest = true; }
        if (r.cleared) { first = !st.cleared; st.cleared = true; st.stars = Math.max(st.stars, r.stars || 0); }
        if (r.cleared && r.time > 0 && (!st.bestTime || r.time < st.bestTime)) { st.bestTime = r.time; newBest = true; } // 빠를수록 좋은 기록
      }
      if (r.dist > g.best) { g.best = r.dist; if (!staged) newBest = true; }
      if (r.level > (g.maxLevel || 0)) g.maxLevel = r.level; // 끝없는 게임에서 도착한 가장 높은 레벨 (베이커리: 그 레벨부터 다시 시작)
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
  godBadge();
})();
