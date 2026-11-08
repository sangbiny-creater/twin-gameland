'use strict';
// 사천성·메모리에 나오는 그림 목록 (백오피스 '게임 그림' 탭에서 넣고 빼기 → 서버 config/images → 이 기기 localStorage 'twin_images_v1')
//  · 묶음마다 개수(need)가 정해져 있음. 저장된 목록이 개수가 다르거나 없는 그림이 섞여 있으면 기본 목록(def)을 씀
//  · all: 고를 수 있는 그림 전부 (그림 파일이 있는 것). 새 그림을 넣거나 아주 지우는 건 코드에서만 (백오피스에는 삭제 없음)
//  · 사천성: 그림 묶음 shisen/assets/sprites/sprites.json · extra.json 의 이름 / 메모리: memory/assets/cards/<이름>.webp
(function (root) {
  const n2 = (k) => String(k).padStart(2, '0');
  const BASE = ['strawberry', 'banana', 'grape', 'cherry', 'orange', 'peach', 'watermelon', 'carrot', 'corn', 'mushroom',
    'clover', 'flower', 'star', 'heart', 'leaf', 'snowflake', 'sun', 'cloud', 'moon', 'cat', 'dog', 'paw'].map((n) => 't_' + n);
  // 다른 게임에서 가져온 아이콘 (x_mem_heli 헬리콥터는 Sky Rider 로 이름이 바뀌어 기본에서 뺌, QA 21)
  const EXTRA = ['mem_raincoat', 'mem_hug', 'mem_book', 'mem_explorer', 'mem_pinkhat', 'mem_bluehat', 'mem_pom', 'mem_dogs', 'mem_cake',
    'mole', 'mole_fast', 'mole_tough', 'hammer', 'cupcake', 'muffin', 'burnt', 'eclair', 'roll', 'piping',
    'windmill', 'airship', 'seagull', 'bolt', 'magnet', 'flag', 'penguin', 'snowman', 'pines', 'log', 'fence', 'gift', 'mystery', 'alarm',
    'bone', 'bone_gold', 'choco', 'onion', 'sausage', 'shihtzu', 'poodle', 'pomdog'].map((n) => 'x_' + n);
  const WORLD = (w) => Array.from({ length: 14 }, (_, k) => `w${w}_${k}`);
  const WORLD_NAMES = ['하늘도시', '숲속 나무마을', '겨울왕국', '석양의 항구', '벚꽃마을', '구름왕국', '바닷속도시', '마법숲', '별빛우주', '황금성'];
  const POOLS = {
    shisen: {
      common: { name: '공통 그림 (모든 월드에서 무작위로)', all: [...BASE, ...EXTRA, 'x_mem_heli'], def: [...BASE, ...EXTRA] },
      ...Object.fromEntries([5, 6, 7, 8, 9, 10].map((w) => [`w${w}`, {
        name: `${w}월드 ${WORLD_NAMES[w - 1]} 전용 그림 (그 월드에서 먼저 씀)`, all: WORLD(w),
        def: WORLD(w).filter((n) => !(w === 5 && (n === 'w5_2' || n === 'w5_3'))),
      }])),
    },
    memory: {
      fronts: { name: '그림 카드', all: Array.from({ length: 18 }, (_, k) => 'f' + n2(k)), def: Array.from({ length: 18 }, (_, k) => 'f' + n2(k)) },
      scenes: { name: '추억 카드 (은유·은결 일상, 쉬움 6월드부터 섞임)', all: Array.from({ length: 36 }, (_, k) => 's' + n2(k)), def: Array.from({ length: 36 }, (_, k) => 's' + n2(k)) },
    },
  };
  for (const g of Object.values(POOLS)) for (const p of Object.values(g)) p.need = p.def.length;
  const KEY = 'twin_images_v1';
  const saved = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } };
  // 이 묶음이 쓸 수 있는 목록인지: 개수가 맞고, 모두 고를 수 있는 그림이고, 겹치지 않음
  const valid = (p, list) => Array.isArray(list) && list.length === p.need && new Set(list).size === list.length && list.every((n) => p.all.includes(n));
  function list(game, pool) {
    const p = POOLS[game][pool], s = (saved()[game] || {})[pool];
    return valid(p, s) ? s.slice() : p.def.slice();
  }
  root.GameImages = { POOLS, KEY, list, valid };
})(typeof window !== 'undefined' ? window : globalThis);
