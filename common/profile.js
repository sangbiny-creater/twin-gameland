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
    helicopter: { name: '하늘타기', path: 'helicopter/index.html' }, // Sky Rider (예전 이름 Twin Helicopter, 저장 이름은 helicopter 그대로)
    stairs: { name: '계단 오르기', path: 'stairs/index.html' },
    // 10개 월드 × 10판 (1-1 ~ 10-10) + 어려움 100판 (판 번호 100~199, 어려움 N월드는 쉬움 N월드를 다 깨면 열림)
    shisen: { name: '사천성', path: 'shisen/index.html', stages: 100, worlds: WORLDS, perWorld: 10, hard: true },
    downhill: { name: '다운힐 러너', path: 'downhill/index.html' },
    memory: { name: '메모리 게임', path: 'memory/index.html', stages: 100, worlds: WORLDS, perWorld: 10, hard: true }, // 10개 월드 × 10판 + 어려움 100판(번호 100~199, 사천성과 같은 규칙)
    mole: { name: '두더지 게임', path: 'mole/index.html', stages: 100, worlds: WORLDS, perWorld: 10, hard: true }, // 10개 월드 × 10판 + 어려움 100판(번호 100~199, 사천성과 같은 규칙), 기록(best) = 최고 점수
    bakery: { name: '달콤 베이커리', path: 'bakery/index.html' }, // 끝없이 이어지는 게임, 기록(best) = 최고 점수
    dogsnack: { name: '멍멍이 간식 타임', path: 'dogsnack/index.html' }, // 3줄 버튼 리듬 게임 (베이커리와 같은 규칙·같은 기록 방식). 예전 이름 caketap(케이크 탭탭)
    darts: { name: '다트 게임', path: 'darts/index.html' }, // 카운트업 8라운드 × 3발, 기록(best) = 최고 점수
    // 선물가게 정리 (Water Sort 방식): 10개 월드 × 10판 + 어려움 100판 (사천성과 같은 규칙). 월드는 이 게임만의 선물가게 거리
    giftsort: { name: '선물가게 정리', path: 'giftsort/index.html', stages: 100, perWorld: 10, hard: true,
      worlds: ['장난감 거리', '꽃집 정원', '사탕 과자점', '바닷가 기념품점', '눈꽃 선물마을', '숲속 나무공방', '별빛 야시장', '구름 풍선가게', '리본 공장', '황금 선물궁전'] },
    // 버거 러시 (햄버거 가게 타이쿤, 가로 전용): 10개 월드 × 10판 + 어려움 100판 (사천성과 같은 규칙). 기록(best) = 받은 손님 수
    burger: { name: '버거 러시', path: 'burger/index.html', stages: 100, perWorld: 10, hard: true,
      worlds: ['햄버거 골목', '양상추 농장', '토마토 언덕', '양파 들판', '베이컨 캠핑장', '바닷가 버거 트럭', '감자튀김 성', '탄산 분수 공원', '별빛 드라이브', '아이스크림 왕국'] },
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
    // 사천성과 같은 징검다리 규칙
    giftsort: (r, first) => (r.cleared ? 20 + Math.round(r.stage * 1.5) + r.stars * 5 + (first ? 30 : 0) : 0),
    burger: (r, first) => (r.cleared ? 20 + Math.round(r.stage * 1.5) + r.stars * 5 + (first ? 30 : 0) : 0),
  };

  // ---------- 아이템샵 카탈로그 ----------
  // 게임 부스트: 1개씩 사서 모아 두고, '사용중'으로 켜 둔 것만 게임을 시작할 때 1개씩 쓰임
  // 아이템 (팝업 v2, docs/spec/팝업_아이템_정리_v1.md): 아이템샵에서 파는 것은 이 8개뿐, 수량은 모든 게임이 같이 씀(sh.boosts._all)
  //  하트 = 하트 3칸·2개 대신 4칸·3개로 시작 / 보호막 = 처음 한 번 안 다침 / 슬로우 = 처음 20초 천천히 (무제한형·두더지는 시작 팝업에서 체크)
  //  힌트·시간 추가·섞기(사천성만)·폭탄·모두 보기(메모리만) = 시작 팝업에서 고르면 그 판에 1개 (게임 화면 버튼으로 씀, 안 써도 판이 시작되면 1개 쓴 것)
  //  게임 안에서만 줍는 아이템(자석·코인 2배·날개 등)은 팔지 않음. 스카이훅·다트는 이번에 안 바꿔서 예전 그대로(게임별 수량)
  const ITEMS = {
    life: { name: '하트', price: 300, games: ['downhill', 'bakery', 'stairs', 'helicopter', 'dogsnack', 'mole', 'burger'], desc: '하트 4칸에 3개로 시작해요' },
    shield: { name: '보호막', price: 200, games: ['downhill', 'bakery', 'stairs', 'helicopter', 'dogsnack'], desc: '처음 한 번은 다쳐도 괜찮아요' },
    slow: { name: '슬로우', price: 200, games: ['downhill', 'bakery', 'stairs', 'helicopter', 'dogsnack'], desc: '처음 20초 동안 천천히 움직여요' },
    hint: { name: '힌트', price: 60, games: ['shisen', 'memory', 'giftsort'], desc: '짝 하나를 알려 줘요', manual: true },
    time: { name: '시간 추가', price: 80, games: ['shisen', 'memory'], desc: '제한 시간 +10초', manual: true },
    shuffle: { name: '섞기', price: 80, games: ['shisen'], desc: '타일 자리를 섞어요', manual: true },
    bomb: { name: '폭탄', price: 150, games: ['shisen', 'memory'], desc: '짝 하나를 바로 이어 줘요', manual: true },
    find: { name: '모두 보기', price: 120, games: ['memory'], desc: '모든 카드를 잠깐 보여 줘요', manual: true },
    undo: { name: '되돌리기', price: 60, games: ['giftsort'], desc: '이번 판 되돌리기 +5번', manual: true },
    addcart: { name: '카트 추가', price: 100, games: ['giftsort'], desc: '선물 1개를 놓을 수 있는 작은 카트를 놓아요', manual: true },
  };
  const ITEM_IDS = Object.keys(ITEMS);
  const BOOSTS = {
    skyhook: [
      { id: 'life', name: '추가 목숨', desc: '하트 4개로 시작', price: 300 },
      { id: 'shield', name: '1회 보호', desc: '처음 한 번 안 다쳐요', price: 300 },
      { id: 'magnet', name: '코인 흡수', desc: '처음 20초 자석', price: 300 },
      { id: 'x2', name: '코인 2배', desc: '처음 30초 코인 2배', price: 300 },
    ],
    helicopter: ['life', 'shield', 'slow'],
    stairs: ['life', 'shield', 'slow'],
    shisen: ['hint', 'time', 'shuffle', 'bomb'],
    downhill: ['life', 'shield', 'slow'],
    memory: ['hint', 'time', 'find', 'bomb'],
    mole: ['life'],
    bakery: ['life', 'shield', 'slow'],
    dogsnack: ['life', 'shield', 'slow'],
    giftsort: ['hint', 'undo', 'addcart'],
    burger: ['life'],
  };
  for (const g of Object.keys(BOOSTS)) if (typeof BOOSTS[g][0] === 'string') BOOSTS[g] = BOOSTS[g].map((id) => ({ id, ...ITEMS[id], shared: true }));


  // ---------- 옷장 (v0.4) ----------
  // 캐릭터마다 다이아로 사서(c.outfits) 입음(c.outfit, 없으면 기본 옷). 예전 어린이 옷(c.costumes·c.costume)은 v0.3 보관판 것이라 건드리지 않음
  // 그림: closet/assets/<eunyu|eungyeol>_<id>.webp 전신 · item_<…>.webp 옷 칸 · hub/park/home/<…>_<id>.webp 첫 화면 상반신 (tools/closet_assets.py)
  // sheet: 게임 안 포즈 묶음이 있는 옷 (common/chars/<look>_<id>) / slow: 입으면 그 게임이 OUTFIT_SLOW 배로 천천히 / 값은 🟡 임시
  const OUTFIT_PRICE = 100, OUTFIT_SLOW = 0.85;
  const OUTFITS = {
    eunyu: [
      { id: 'uniform', name: '게임랜드 유니폼', price: OUTFIT_PRICE }, { id: 'date', name: '데이트룩', price: OUTFIT_PRICE },
      { id: 'casual', name: '캐주얼룩', price: OUTFIT_PRICE }, { id: 'school', name: '학교풍룩', price: OUTFIT_PRICE },
      { id: 'travel', name: '여행룩', price: OUTFIT_PRICE }, { id: 'pajamas', name: '토끼 잠옷', price: OUTFIT_PRICE },
      { id: 'winter', name: '겨울옷', price: 150, slow: 'downhill', note: '다운힐 러너가 천천히 가요' },
      { id: 'baker', name: '베이커리 옷', price: 150, slow: 'bakery', note: '달콤 베이커리가 천천히 가요' },
    ],
    eungyeol: [
      { id: 'streamer', name: '스트리머 룩', price: OUTFIT_PRICE }, { id: 'daily', name: '데일리룩', price: OUTFIT_PRICE },
      { id: 'campus', name: '캠퍼스룩', price: OUTFIT_PRICE }, { id: 'sport', name: '운동복', price: OUTFIT_PRICE },
      { id: 'travel', name: '여행룩', price: OUTFIT_PRICE }, { id: 'home', name: '홈웨어', price: OUTFIT_PRICE },
      { id: 'winter', name: '겨울옷', price: 150, slow: 'downhill', note: '다운힐 러너가 천천히 가요' },
      { id: 'baker', name: '베이커리 옷', price: 150, slow: 'bakery', note: '달콤 베이커리가 천천히 가요' },
    ],
  };
  // ---------- 쿠폰 ----------
  // 띄어쓰기·대소문자 상관없이 입력. once: 캐릭터마다 한 번만
  // ---------- 놀이공원 꾸미기 (v0.3 첫 화면) ----------
  // 동상·분수·대문·이름표·로고 테두리: 1번은 처음부터 가짐, 2번부터는 아이템샵 '놀이공원 꾸미기'에서 다이아로 삼 (가격 🟡 임시값)
  // 테마(별·토끼·무지개·하트·꽃·기본)마다 동상·분수·대문·이름표·로고가 하나씩 (그림을 받는 대로 items 에 추가)
  // 그림: 동상·분수·대문 hub/park/items/<종류>_<번호>.webp, 이름표 hub/park/ui/plate_<id>.webp, 로고 hub/park/ui/logo(_<id>).webp
  // 캐릭터마다: parkItems = { statue: [2, 4] … 산 번호 }, parkDeco = { '<구간>-<종류>': 번호, plate: 번호, logo: 번호 }
  // 기본(성) 테마: 대문 6번(로고 같은 성 대문), 동상 6번 은결·7번 은유(돌 동상), 분수 6번(돌 분수), 이름표 1번(나무), 로고 1번 — 처음부터 가짐 (free)
  //  예전에 처음부터 주던 1번(토끼 동상·별 분수·토끼 성 대문)도 그대로 가짐. 기본으로 놓이는 것: def (동상은 캐릭터 따라 은유 7번 / 은결 6번)
  const PARK_ITEMS = {
    statue: { name: '동상', price: 20, items: ['토끼 동상', '별 트로피', '하트 곰', '무지개 유니콘', '왕관 강아지', '은결 동상', '은유 동상', '꽃 요정 동상'],
      themes: ['토끼', '별', '하트', '무지개', '특별', '기본', '기본', '꽃'], free: [1, 6, 7], def: { eunyu: 7, eungyeol: 6 } },
    fountain: { name: '분수', price: 30, items: ['별 분수', '하트 분수', '고래 분수', '무지개 분수', '꽃 분수', '돌 분수', '토끼 분수'],
      themes: ['별', '하트', '특별', '무지개', '꽃', '기본', '토끼'], free: [1, 6], def: 6 },
    gate: { name: '대문', price: 40, items: ['토끼 성 대문', '사탕 과자 대문', '꽃 정원 대문', '별빛 우주 대문', '겨울 눈 성 대문', '성 대문', '하트 대문', '무지개 대문'],
      themes: ['토끼', '특별', '꽃', '별', '특별', '기본', '하트', '무지개'], free: [1, 6], def: 6 },
    plate: { name: '이름표', price: 20, items: ['나무 이름표', '리본 이름표', '별 이름표', '토끼 이름표', '무지개 이름표', '꽃 이름표'],
      ids: ['wood', 'ribbon', 'star', 'rabbit', 'rainbow', 'flower'], themes: ['기본', '하트', '별', '토끼', '무지개', '꽃'], free: [1], def: 1 },
    logo: { name: '로고', price: 30, items: ['기본 로고', '별 로고', '토끼 로고', '무지개 로고', '하트 로고', '꽃 로고'],
      ids: ['', 'star', 'rabbit', 'rainbow', 'heart', 'flower'], themes: ['기본', '별', '토끼', '무지개', '하트', '꽃'], free: [1], def: 1 },
  };
  // 백오피스에서 바꾼 상점 값 (common/auth.js 가 서버 config/catalog 를 이 기기에 받아 둠 → 다음 화면부터 적용)
  //  outfits: { eunyu: [{ id, name, price, note, hidden, body, item }] } — 없는 id 는 새 옷(옷장에만 보임, 게임 안 그림은 기본 옷)
  //  boosts: { '<게임>.<id>': 값 } · park: { statue: 값 … }
  try {
    const cat = JSON.parse(localStorage.getItem('twin_catalog_v1') || 'null');
    if (cat && cat.outfits) for (const w of Object.keys(OUTFITS)) for (const o of cat.outfits[w] || []) {
      const it = OUTFITS[w].find((x) => x.id === o.id);
      if (it) Object.assign(it, o); else if (o.id && o.body && o.item) OUTFITS[w].push({ price: OUTFIT_PRICE, ...o, custom: true });
    }
    if (cat && cat.park) for (const k of Object.keys(cat.park)) if (PARK_ITEMS[k] && cat.park[k] > 0) PARK_ITEMS[k].price = cat.park[k];
    if (cat && cat.boosts) for (const [k, v] of Object.entries(cat.boosts)) { const [g, id] = k.split('.'), b = Array.isArray(BOOSTS[g]) && BOOSTS[g].find((x) => x && x.id === id); if (b && v > 0) b.price = v; }
  } catch (e) { /* ignore */ }
  // 아이템샵·고르기 창에 보이는 순서: 기본 테마 먼저
  for (const K of Object.values(PARK_ITEMS)) K.order = K.items.map((_, k) => k + 1).sort((a, b) => (K.themes[b - 1] === '기본') - (K.themes[a - 1] === '기본') || a - b);
  const parkItemImg = (kind, n) => {
    const K = PARK_ITEMS[kind]; if (!K) return '';
    if (kind === 'plate') return `hub/park/ui/plate_${K.ids[n - 1] || 'wood'}.webp`;
    if (kind === 'logo') { const id = K.ids[n - 1]; return `hub/park/ui/logo${id ? '_' + id : ''}.webp`; }
    return `hub/park/items/${kind}_${n}.webp`;
  };
  const COUPONS = {
    showmethemoney: { coins: 5000, once: false, msg: '코인 5000개를 받았어요!' },
    // 게임 테스트용 무적 (모든 캐릭터·모든 게임에 적용, 끌 때까지 유지)
    supermanon: { god: true, once: false, msg: '무적 모드 ON! 이제 안 죽어요' },
    supermanoff: { god: false, once: false, msg: '무적 모드 OFF' },
    // 모든 게임의 모든 스테이지 자물쇠 풀기 (모든 캐릭터, 계속 유지)
    openeverything: { openAll: true, once: false, msg: '모든 스테이지 자물쇠가 풀렸어요!' },
    closeeverything: { openAll: false, once: false, msg: '자물쇠가 다시 잠겼어요 (깬 스테이지까지만 열려요)' },
    // 버전 이동 (보관판 v0.1·v0.2 ↔ 기본 v0.3). go: 사이트 맨 위 폴더 기준 주소
    enterv1: { ver: '0.1', go: 'v0.1/', once: false, msg: 'v0.1 (예전 카드 목록)으로 가요!' },
    enterv2: { ver: '0.2', go: 'v0.2/', once: false, msg: 'v0.2 (놀이공원)로 가요!' },
    enterv3: { ver: '0.3', go: 'v0.3/', once: false, msg: 'v0.3 (어린이 캐릭터)로 가요!' },
    enterv4: { ver: '', go: 'index.html', once: false, msg: 'v0.4 (최신 버전)으로 가요!' },
    // v0.3 상용화 검수용 (docs/spec/트윈게임랜드_스펙_v1.3.md)
    showmethediamond: { gems: 100, once: false, msg: '다이아 100개를 받았어요! (검수용)' },
    resetv3: { resetV3: true, once: false, msg: '게임 잠금·열쇠·출석을 처음 상태로 돌렸어요 (검수용)' },
    // 검수용: 처음 깔았을 때처럼 (모든 캐릭터·코인·기록 지움, 지우기 전 내용은 twin_gameland_v1_backup 에 한 벌 남김)
    restart: { restart: true, go: 'index.html', once: false, msg: '처음 시작하는 상태로 돌아가요!' },
    // 검수용: 하루가 지난 것처럼 (오늘 출석을 아직 안 한 상태로 → 첫 화면에서 다음 날 출석 창이 뜸)
    dayplus: { dayPlus: true, go: 'index.html', once: false, msg: '하루가 지났어요! 첫 화면에서 출석해 보세요' },
  };
  // restart 쿠폰이 지우는 이 사이트의 저장 (같은 주소를 쓰는 다른 사이트 저장은 건드리지 않음)
  const SITE_KEYS = ['twin_tip_closed', 'twin_gameland_mapmode', 'skyhook_v1', 'twinheli_v1', 'stairs_v1', 'shisen_v1', 'downhill_v1', 'memory_v1', 'mole_v1', 'bakery_v2', 'dogsnack_v1', 'darts_v1'];

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
  // 화면 색: 은유 = 분홍, 은결 = 파랑 (html data-who, common/popup.css 등이 씀). 마지막에 플레이한 캐릭터를 따름
  const paintWho = () => { const c = window.Hub && Hub.active(); document.documentElement.dataset.who = c && lookBase(c.look) === 'eungyeol' ? 'eungyeol' : 'eunyu'; };
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
  // 팝업 v2 (2026-11-01): 게임마다 따로 세던 7개 아이템(하트·보호막·슬로우·힌트·시간 추가·폭탄·모두 보기) 수량을 모든 게임 같이 쓰는 칸(_all)으로 모음
  //  예전 이름: 추가 하트·추가 목숨(life) · 1회 보호(shield) · 천천히 시작(slow) · 짝 맞추기(bomb). 한 번만 (sh.items2)
  function upgradeItems(d) {
    let changed = false;
    for (const c of d.chars) {
      const sh = c.shop; if (!sh) continue;
      // 2026-11-04: 섞기도 같이 쓰는 칸으로 (사천성 수량을 옮김, 한 번만)
      if (sh.items2 && !sh.items3) { const all = sh.boosts._all = sh.boosts._all || {}, s = sh.boosts.shisen || {}; if (s.shuffle) { all.shuffle = (all.shuffle || 0) + s.shuffle; delete s.shuffle; } sh.items3 = true; changed = true; }
      if (sh.items2) continue;
      sh.boosts = sh.boosts || {}; const all = sh.boosts._all = sh.boosts._all || {};
      for (const g of Object.keys(sh.boosts)) {
        if (g === '_all' || g === 'skyhook' || g === 'darts') continue;
        for (const id of Object.keys(sh.boosts[g])) {
          if (!(BOOSTS[g] || []).some((b) => b.id === id && b.shared)) continue;
          all[id] = (all[id] || 0) + (sh.boosts[g][id] || 0); delete sh.boosts[g][id];
        }
      }
      sh.items2 = sh.items3 = true; changed = true;
    }
    return changed;
  }
  const upgrade = (d) => upgradeGames(d) | upgradeLooks(d) | upgradeItems(d);
  let data = load();
  if (upgrade(data)) try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } }
  function reload() { data = load(); upgrade(data); }

  function find(id) { return data.chars.find((c) => c.id === id) || null; }
  function gameRec(c, g) {
    if (!c.games[g]) c.games[g] = { plays: 0, best: 0, coins: 0, last: 0, stages: {} };
    return c.games[g];
  }

  // 수량을 넣어 두는 칸: 7개 아이템은 모든 게임 같이(_all), 그 밖(스카이훅·다트, 게임 안 버튼 아이템 섞기 등)은 게임마다
  const bk = (game, id) => ((BOOSTS[game] || []).some((b) => b.id === id && b.shared) ? '_all' : game);
  function shopOf(c) {
    if (!c.shop) c.shop = { skins: {}, equipped: {}, boosts: {}, using: {} };
    const sh = c.shop;
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

  // 화면 높이: 아이폰(iOS 26 사파리·홈 화면 앱)은 visualViewport·innerHeight 가 실제 보이는 화면보다 작게 나와서
  // 아래에 빈 띠가 생김 → 화면에 꽉 붙인(position: fixed; top 0; bottom 0) 투명 막대의 높이까지 보고 가장 큰 값을 씀
  window.fullViewH = function () {
    let p = document.getElementById('__vh');
    if (!p && document.body) { p = document.createElement('div'); p.id = '__vh'; p.style.cssText = 'position:fixed;left:0;top:0;bottom:0;width:0;visibility:hidden;pointer-events:none'; document.body.appendChild(p); }
    const vv = window.visualViewport;
    return Math.max(vv ? vv.height : 0, window.innerHeight, p ? p.offsetHeight : 0);
  };

  const whoFile = (c) => (lookBase(c.look) === 'eungyeol' ? 'eungyeol' : 'eunyu');
  const Hub = {
    GAMES, WORLDS, FREE_SLOTS, MAX_CHARS, BOOSTS, ITEMS,

    // ----- 옷장 -----
    costume(c = this.active()) { return (c && c.costume) || null; }, // 예전 어린이 옷 (게임의 예전 코드가 물어봄)
    latestLook, lookBase, // 계열(은유/은결)의 가장 새 모습 · 모습의 계열
    canDress(c = this.active()) { return !!(c && DRESSABLE.includes(c.look)); },
    costumeImg(c = this.active(), base = '') { const id = this.canDress(c) && this.costume(c); return id ? `${base}common/costumes/${c.look}_${id}.webp?v=202611102225` : null; },
    outfits(c = this.active()) { return c ? OUTFITS[lookBase(c.look)].filter((x) => !x.hidden || (c.outfits || []).includes(x.id)) : []; },
    outfit(c = this.active()) { return (c && c.outfit) || null; }, // 입은 옷 id (없으면 기본 옷)
    ownsOutfit(id, c = this.active()) { return !id || !!(c && (c.outfits || []).includes(id)); },
    buyOutfit(id, c = this.active()) {
      const it = this.outfits(c).find((x) => x.id === id);
      if (!c || !it || this.ownsOutfit(id, c)) return { ok: false };
      if ((c.gems || 0) < it.price) return { ok: false, why: 'gems' };
      c.gems -= it.price; c.outfits = [...(c.outfits || []), id]; c.outfit = id; // 사면 바로 입음
      save(); return { ok: true };
    },
    wearOutfit(id, c = this.active()) { if (c && this.ownsOutfit(id, c)) { c.outfit = id || null; save(); } },
    // 그 모습의 캐릭터가 입은 옷에 게임 안 포즈 묶음이 있으면 옷 id (common/charv2.js 가 묶음을 겹쳐 씀)
    outfitSheet(look) {
      const a = this.active(), c = a && a.look === look ? a : this.chars().find((x) => x.look === look);
      const it = c && this.outfits(c).find((x) => x.id === c.outfit);
      return it && !it.custom ? it.id : null;
    },
    // 다트·멍멍이·두더지 그림 이름에 붙일 옷: 'eunyu' → '_uniform' (기본 옷이면 '')
    outfitTag(who) {
      const a = this.active(), c = a && lookBase(a.look) === who ? a : this.chars().find((x) => lookBase(x.look) === who), id = c && c.outfit;
      return id && !(OUTFITS[who].find((x) => x.id === id) || {}).custom ? `_${id}` : '';
    },
    // 입은 옷의 게임 효과: 속도 배율 (겨울옷 = 다운힐, 베이커리 옷 = 달콤 베이커리)
    outfitSpeed(game, c = this.active()) { const it = c && this.outfits(c).find((x) => x.id === c.outfit); return it && it.slow === game ? OUTFIT_SLOW : 1; },
    // 첫 화면·지도 구석의 내 캐릭터 그림 / 지도 위치 표식 (입은 옷 그대로)
    homeImg(c = this.active()) { const id = this.builtinOutfit(c); return `hub/park/home/${whoFile(c)}${id ? '_' + id : ''}.webp`; },
    builtinOutfit(c = this.active()) { const id = this.outfit(c), it = c && OUTFITS[lookBase(c.look)].find((x) => x.id === id); return it && !it.custom ? id : null; },
    pinImg(c = this.active()) { const id = this.builtinOutfit(c); return `hub/ui/map/v4/pin_${whoFile(c)}${id ? '_' + id : ''}.webp`; },
    // 쿠폰: { ok, msg }
    redeem(code, c = this.active()) {
      const key = String(code || '').toLowerCase().replace(/\s+/g, '');
      const cp = COUPONS[key];
      if (!c || !cp) return { ok: false, msg: '없는 쿠폰 번호예요' };
      if (cp.restart) {
        try {
          const old = localStorage.getItem(KEY); if (old) localStorage.setItem(KEY + '_backup', old);
          localStorage.removeItem(KEY); SITE_KEYS.forEach((k) => localStorage.removeItem(k)); sessionStorage.clear();
        } catch (e) { /* ignore */ }
        data = blank(); godBadge(); return { ok: true, msg: cp.msg, go: cp.go, restart: true };
      }
      c.coupons = c.coupons || [];
      if (cp.once && c.coupons.includes(key)) return { ok: false, msg: '이미 사용한 쿠폰이에요' };
      c.coins += cp.coins || 0; c.earned += cp.coins || 0; c.coupons.push(key);
      if (cp.god != null) { data.settings.god = cp.god; godBadge(); }
      if (cp.openAll != null) data.settings.openAll = cp.openAll;
      if (cp.gems) c.gems = (c.gems || 0) + cp.gems;
      if (cp.resetV3) delete c.v3;
      if (cp.dayPlus && c.v3 && c.v3.att) c.v3.att.last = ''; // 출석 기록의 '마지막 날'만 비움 (누적 일수는 그대로)
      if (cp.ver != null) { try { if (cp.ver) sessionStorage.setItem('twin_ver', cp.ver); else sessionStorage.removeItem('twin_ver'); } catch (e) { /* ignore */ } }
      save(); return { ok: true, msg: cp.msg, coins: c.coins, go: cp.go };
    },

    // ----- 아이템샵 -----
    boostCount(game, id, c = this.active()) { const k = bk(game, id); return (c && shopOf(c).boosts[k] && shopOf(c).boosts[k][id]) || 0; },
    isUsing(game, id, c = this.active()) { return !!(c && shopOf(c).using[game] && shopOf(c).using[game][id]); },
    buyBoost(game, id, c = this.active()) {
      const b = (BOOSTS[game] || []).find((x) => x.id === id);
      if (!c || !b) return { ok: false };
      if (c.coins < b.price) return { ok: false, why: 'coins' };
      c.coins -= b.price;
      const sh = shopOf(c), k = bk(game, id); sh.boosts[k] = sh.boosts[k] || {}; sh.boosts[k][id] = (sh.boosts[k][id] || 0) + 1;
      if (k !== '_all') { sh.using[game] = sh.using[game] || {}; sh.using[game][id] = true; } // 스카이훅: 사면 '사용중'으로 (7개 아이템은 시작 팝업에서 고름)
      save(); return { ok: true };
    },
    setUsing(game, id, on, c = this.active()) {
      if (!c) return; const sh = shopOf(c); sh.using[game] = sh.using[game] || {}; sh.using[game][id] = !!on; save();
    },
    // 게임 시작 때 부름: '사용중'이고 1개 이상 있는 부스트를 1개씩 꺼내 쓰고, 쓴 부스트 id 목록을 돌려줌
    takeBoosts(game) {
      reload();
      const c = this.active(); if (!c) return [];
      const sh = shopOf(c), use = sh.using[game] || {};
      const used = [];
      for (const b of BOOSTS[game] || []) {
        if (b.manual) continue; // 버튼으로 쓰는 아이템은 여기서 꺼내지 않음
        const have = sh.boosts[bk(game, b.id)] || {};
        if (use[b.id] && have[b.id] > 0) { have[b.id]--; used.push(b.id); if (!have[b.id]) use[b.id] = false; }
      }
      if (used.length) save();
      return used;
    },
    // ----- 아이템 수량 (구매·게임 보상·게임에서 사용을 모두 이 숫자 하나로) -----
    addBoost(game, id, n = 1, c = this.active()) {
      if (!c) return 0;
      const sh = shopOf(c), k = bk(game, id); sh.boosts[k] = sh.boosts[k] || {}; sh.boosts[k][id] = Math.max(0, (sh.boosts[k][id] || 0) + n);
      save(); return sh.boosts[k][id];
    },
    // 1개 쓰기: 있으면 줄이고 true
    useBoost(game, id, c = this.active()) {
      if (!c || this.boostCount(game, id, c) <= 0) return false;
      shopOf(c).boosts[bk(game, id)][id]--; save(); return true;
    },
    // 캐릭터마다 한 번만 주는 기본 아이템
    starterKit(game, c = this.active()) {
      const KITS = { shisen: { hint: 3, shuffle: 2, time: 1 }, memory: { hint: 3, find: 1, time: 1 }, mole: { time: 1, double: 1, rainbow: 1 }, giftsort: { hint: 2, undo: 2, addcart: 1 } };
      if (!c || !KITS[game]) return false;
      const sh = shopOf(c); sh.starter = sh.starter || {};
      if (sh.starter[game]) return false;
      for (const [id, n] of Object.entries(KITS[game])) { const k = bk(game, id); sh.boosts[k] = sh.boosts[k] || {}; sh.boosts[k][id] = (sh.boosts[k][id] || 0) + n; }
      sh.starter[game] = true; save(); return true;
    },
    boostName(game, id) { const b = (BOOSTS[game] || []).find((x) => x.id === id); return b ? b.name : id; },
    get settings() { return data.settings; },
    // 무적 모드 (쿠폰 supermanon / supermanoff)
    get god() { return !!data.settings.god; },
    setSound(on) { data.settings.sound = !!on; save(); },
    setLang(l) { data.settings.lang = l; save(); }, // 'ko' | 'en' (영어판 준비 중)
    reload,

    chars() { return data.chars; },
    get(id) { return find(id); },
    active() { return find(data.activeId); },
    paintWho,
    setActive(id) { if (find(id)) { data.activeId = id; save(); paintWho(); } },

    canCreate() { return data.chars.length < data.slots; },
    nextSlotPrice() { return data.slots >= MAX_CHARS ? null : slotPrice(data.slots + 1); },
    // 새 캐릭터 자리 사기 (payerId 캐릭터의 코인으로)
    buySlot(payerId) {
      const c = find(payerId), price = this.nextSlotPrice();
      if (!c || price == null || c.coins < price) return false;
      c.coins -= price; data.slots++; save(); return true;
    },
    create(name, look) {
      // v0.3: 캐릭터는 은유 1명·은결 1명 (자리 사기 없음). 보관판 v0.1·v0.2는 예전 규칙(자리)
      if (this.ver === '0.4' ? data.chars.some((x) => lookBase(x.look) === lookBase(look)) : !this.canCreate()) return null;
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

    // 어려움 판(번호가 판 수 이상)은 앞에 "어려움"
    stageLabel(i, game = 'skyhook') { const G = GAMES[game], k = G.perWorld, h = i >= G.stages; if (h) i -= G.stages; return `${h ? '어려움 ' : ''}${Math.floor(i / k) + 1}-${(i % k) + 1}`; },
    stageName(i, game = 'skyhook') { const G = GAMES[game], k = G.perWorld; i %= G.stages; return `${G.worlds[Math.floor(i / k)]} ${(i % k) + 1}`; },

    // 첫 화면 놀이공원 배치 (캐릭터마다 따로): 게임 id 순서. 없으면 기본 배치 (v0.2 첫 화면)
    park(c = this.active()) { return (c && Array.isArray(c.park)) ? c.park.slice() : null; },
    PARK_ITEMS, parkItemImg,
    ownsParkItem(kind, n, c = this.active()) { const K = PARK_ITEMS[kind]; return !!K && (K.free.includes(n) || !!(c && c.parkItems && (c.parkItems[kind] || []).includes(n))); },
    buyParkItem(kind, n, c = this.active()) {
      const K = PARK_ITEMS[kind];
      if (!c || !K || n < 1 || n > K.items.length || this.ownsParkItem(kind, n, c)) return { ok: false };
      if ((c.gems || 0) < K.price) return { ok: false, why: 'gems' }; // 다이아로 삼
      c.gems -= K.price; c.parkItems = c.parkItems || {}; c.parkItems[kind] = [...(c.parkItems[kind] || []), n];
      save(); return { ok: true };
    },
    // 자리(key = '<구간 번호>-<종류>', 이름표·로고는 'plate'·'logo')에 놓인 것
    //  (그 자리에서 따로 안 골랐으면 아이템샵 '적용하기'로 고른 그 종류 전체(key = 종류 이름), 그것도 없으면 기본 def)
    parkDeco(key, c = this.active()) {
      if (c && c.parkDeco && c.parkDeco[key]) return c.parkDeco[key];
      const kind = key.includes('-') ? key.split('-')[1] : key, d = PARK_ITEMS[kind] && PARK_ITEMS[kind].def;
      if (c && c.parkDeco && c.parkDeco[kind]) return c.parkDeco[kind];
      return typeof d === 'object' ? d[c ? lookBase(c.look) : 'eunyu'] || 1 : d || 1; // 동상: 은유 캐릭터는 은유 동상, 은결 캐릭터는 은결 동상
    },
    setParkDeco(key, n, c = this.active()) { if (!c) return; c.parkDeco = c.parkDeco || {}; c.parkDeco[key] = n; save(); },
    // 아이템샵 '적용하기': 그 종류의 모든 자리를 n번으로 (자리마다 따로 고른 것도 지움)
    applyParkKind(kind, n, c = this.active()) {
      if (!c || !this.ownsParkItem(kind, n, c)) return;
      c.parkDeco = c.parkDeco || {};
      for (const k of Object.keys(c.parkDeco)) if (k.endsWith('-' + kind)) delete c.parkDeco[k];
      c.parkDeco[kind] = n; save();
    },
    // 아이템샵에 '적용 중'으로 보일 번호들: 첫 화면에 실제로 놓인 것만 (첫 화면이 적어 둔 자리 목록으로 셈, 없으면 종류 전체 값)
    parkKindUsed(kind, c = this.active()) {
      let keys = null; try { keys = (JSON.parse(localStorage.getItem('twin_park_spots') || '{}') || {})[kind]; } catch (e) { /* ignore */ }
      return new Set((keys && keys.length ? keys : [kind]).map((k) => this.parkDeco(k, c)));
    },
    setPark(order, c = this.active()) { if (!c) return; if (order) c.park = order.slice(); else delete c.park; save(); },
    // 다이아 (v0.3 상용화 검수: common/monet.js 가 늘리고 씀. 보관판 v0.1·v0.2에서는 보이기만)
    gems(c = this.active()) { return (c && c.gems) || 0; },
    // 지금 보고 있는 버전: 보관판이면 '0.1'·'0.2', 기본 주소면 '0.4' (상용화 기능은 0.4에서. v0.3 보관판은 v0.3/ 폴더가 따로 있음)
    get ver() {
      const m = location.pathname.match(/\/v(0\.[12])\//); if (m) return m[1]; // 보관판 첫 화면 주소
      try { return sessionStorage.getItem('twin_ver') || '0.4'; } catch (e) { return '0.4'; } // 게임·아이템샵: 이 탭에서 들어온 버전
    },
    // 지금 캐릭터 데이터를 고치고 저장 (다른 탭·게임에서 바뀐 것을 먼저 다시 읽음). fn(c) 의 반환값을 돌려줌
    mutate(fn) { reload(); const c = this.active(); if (!c) return null; const r = fn(c); save(); return r; },
    // 코인 더 주기 (v0.3 광고 2배 받기 등)
    addCoins(n, c = this.active()) { if (!c || !(n > 0)) return; c.coins += n; c.earned += n; save(); },
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
    //  · 어려움 판(hard 게임, 번호 = 판 수 + h): 쉬움에서 같은 월드 마지막 판(N-10)을 깼고, 어려움 앞 판도 깼으면 열림
    stageUnlocked(game, i, c = this.active()) {
      const G = GAMES[game];
      if (data.settings.openAll) return true;
      if (G.hard && i >= G.stages) {
        const h = i - G.stages, k = G.perWorld;
        return this.stage(game, Math.floor(h / k) * k + k - 1, c).cleared && (h === 0 || this.stage(game, i - 1, c).cleared);
      }
      return i === 0 || this.stage(game, i - 1, c).cleared;
    },
    // hard: true 면 어려움 판들 중에서
    stageNext(game, c = this.active(), hard = false) {
      const o = hard ? GAMES[game].stages : 0;
      for (let i = o; i < o + GAMES[game].stages; i++) if (!this.stage(game, i, c).cleared) return i;
      return o + GAMES[game].stages - 1;
    },
    stageCleared(game, c = this.active(), hard = false) {
      const o = hard ? GAMES[game].stages : 0; let n = 0;
      for (let i = o; i < o + GAMES[game].stages; i++) if (this.stage(game, i, c).cleared) n++;
      return n;
    },
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
  Object.assign(Hub, { OUTFITS, BOOSTS, COUPONS }); // 백오피스 상점 관리·쿠폰 목록이 기본 값을 읽음
  window.Hub = Hub;
  godBadge();
  paintWho();
  // v0.3 상용화 검수 기능(잠금·체험·다이아·출석·가짜 광고)은 기본 주소(v0.3)에서만: 이 파일 옆 monet.js 를 불러옴
  if (Hub.ver === '0.4' && document.currentScript && !/\/admin\//.test(location.pathname)) { // 백오피스는 상점 값만 읽음
    const src = document.currentScript.src, add = (n, then) => { const s = document.createElement('script'); s.src = src.replace(/profile\.js(\?.*)?$/, n + '$1'); if (then) s.onload = then; document.head.appendChild(s); };
    add('monet.js');
    add('firebase_config.js', () => add('auth.js')); // 로그인·기록 보내기 (common/auth.js)
  }
})();
