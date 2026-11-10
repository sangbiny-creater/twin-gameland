'use strict';
// 캐릭터 이름 · 캐릭터 ID (모든 화면 공통, common/profile.js 가 auth.js 다음에 불러옴)
//  · 캐릭터 ID(pid): 캐릭터마다 6자리 (숫자 + 영어 대문자, 헷갈리는 0·O·1·I 는 뺌 → 32가지 × 6자리 = 약 10억 개)
//    그룹투어 친구 초대 등에서 씀. 저장 데이터의 캐릭터에 c.pid 로 들어가고, 서버 pids/{ID} 에 주인(uid)·캐릭터 번호·이름을 적어 둠
//  · 이름: 모든 사람 통틀어 같은 이름은 하나만 (띄어쓰기·영어 대소문자는 같은 것으로 봄). 서버 names/{이름 열쇠} 에 주인을 적어 둠
//    만들 때 중복 확인. 이름 바꾸기는 첫 번째는 무료, 두 번째부터 다이아 RENAME_GEMS 개 (c.renames = 바꾼 횟수)
//  · 서버 없이(인터넷 끊김) 만든 캐릭터·이 기능 전에 만든 캐릭터는 다음 접속 때 등록(sync). 다른 사람이 먼저 쓰는 이름이면
//    c.nameTaken = true → 첫 화면에서 '이름을 바꿔 주세요' 창 (이때는 무료)
//  · 저장 데이터 twin_gameland_v1 의 캐릭터에 칸만 더함: pid · pidReg(서버 등록됨) · nameKey(등록한 이름 열쇠) · renames · nameTaken
(function () {
  if (window.Names) return;
  const RENAME_GEMS = 100;
  const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const newPid = () => { let s = ''; const r = new Uint32Array(6); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(r) : r.forEach((_, i) => { r[i] = Math.random() * 1e9; }); for (let i = 0; i < 6; i++) s += ABC[r[i] % ABC.length]; return s; };
  const okPid = (p) => /^[A-Z0-9]{6}$/.test(String(p || ''));
  // 이름 열쇠: 앞뒤·가운데 띄어쓰기 없이, 영어는 소문자. 서버 문서 이름에 못 쓰는 / 는 _ 로
  const keyOf = (name) => String(name || '').normalize('NFC').replace(/\s+/g, '').toLowerCase().replace(/\//g, '_').replace(/^\.+$/, '_');
  const clean = (name) => String(name || '').replace(/[<>"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 8);
  const t = (s) => (window.I18N && I18N.tr ? I18N.tr(s) : s);

  // 서버 (게스트도 익명 로그인으로 씀). 3초 안에 안 되면 null
  let fbP = null;
  function server() {
    if (fbP) return fbP;
    fbP = (async () => {
      for (let i = 0; i < 40 && !window.Auth; i++) await new Promise((r) => setTimeout(r, 100));
      if (!window.Auth) return null;
      const f = await Auth.firebase(); if (!f) return null;
      if (!f.auth.currentUser) { try { await f.auth.signInAnonymously(); } catch (e) { return null; } }
      return f;
    })().catch(() => null);
    const p = fbP; fbP.then((f) => { if (!f && fbP === p) fbP = null; }); // 실패하면 다음에 다시
    return fbP;
  }
  const timeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r('timeout'), ms))]);

  // 이 이름을 쓸 수 있는지: 'ok' | 'taken' | 'bad' | 'offline'  (mine: 지금 내 캐릭터면 그 캐릭터는 괜찮음)
  async function check(name, mine) {
    const n = clean(name), k = keyOf(n); if (!n || !k) return 'bad';
    const f = await timeout(server(), 4000); if (!f || f === 'timeout') return 'offline';
    try {
      const s = await timeout(f.db.collection('names').doc(k).get(), 5000); if (s === 'timeout') return 'offline';
      if (!s.exists) return 'ok';
      return s.data().uid === f.auth.currentUser.uid ? 'ok' : 'taken'; // 같은 계정(다른 폰에서 만든 같은 캐릭터 포함)이면 괜찮음
    } catch (e) { return 'offline'; }
  }
  // 이름 등록 (트랜잭션: 비어 있거나 내 것일 때만). 성공하면 예전 이름 열쇠는 지움. 'ok' | 'taken' | 'offline'
  async function claim(c, name) {
    const f = await timeout(server(), 4000); if (!f || f === 'timeout') return 'offline';
    const uid = f.auth.currentUser.uid, k = keyOf(name), ref = f.db.collection('names').doc(k);
    try {
      const r = await f.db.runTransaction(async (x) => {
        const s = await x.get(ref);
        if (s.exists && s.data().uid !== uid) return 'taken';
        x.set(ref, { uid, pid: c.pid || '', cid: c.id, name: clean(name), at: Date.now() });
        return 'ok';
      });
      if (r === 'ok' && c.nameKey && c.nameKey !== k) f.db.collection('names').doc(c.nameKey).delete().catch(() => {});
      return r;
    } catch (e) { console.warn('names', e); return 'offline'; }
  }
  // 캐릭터 ID 등록 (처음 만든 캐릭터만 겹치면 새로 뽑음). 이름이 바뀌면 같이 고침
  async function claimPid(c) {
    const f = await timeout(server(), 4000); if (!f || f === 'timeout') return false;
    const uid = f.auth.currentUser.uid;
    for (let i = 0; i < 5; i++) {
      const ref = f.db.collection('pids').doc(c.pid);
      try {
        const r = await f.db.runTransaction(async (x) => {
          const s = await x.get(ref);
          if (s.exists && s.data().uid !== uid) return 'taken';
          x.set(ref, { uid, cid: c.id, name: c.name, look: c.look, at: (s.exists && s.data().at) || Date.now() });
          return 'ok';
        });
        if (r === 'ok') return true;
        // 다른 사람 ID 와 겹침: 아직 서버에 등록한 적 없는 ID 면 새로 뽑음 (등록했던 ID 는 다른 계정에서 이어 하는 같은 캐릭터라 그대로)
        if (c.pidReg) return true;
        const np = newPid(); Hub.mutateChar(c.id, (x) => { x.pid = np; }); c.pid = np;
      } catch (e) { console.warn('pid', e); return false; }
    }
    return false;
  }

  // 모든 캐릭터: ID 가 없으면 만들고, 서버에 ID·이름을 등록 (첫 화면·그룹투어 화면에서 부름)
  let syncing = null;
  function sync() {
    if (!window.Hub || !Hub.chars) return Promise.resolve();
    // ID 는 서버 없이도 바로 (이 기기에서)
    for (const c of Hub.chars()) if (!okPid(c.pid)) Hub.mutateChar(c.id, (x) => { x.pid = newPid(); });
    if (syncing) return syncing;
    syncing = (async () => {
      for (const c0 of Hub.chars()) {
        let c = Hub.chars().find((x) => x.id === c0.id); if (!c) continue;
        if (!c.pidReg || c.pidName !== c.name) { if (await claimPid(c)) Hub.mutateChar(c.id, (x) => { x.pidReg = true; x.pidName = x.name; }); }
        c = Hub.chars().find((x) => x.id === c0.id);
        if (c.nameKey !== keyOf(c.name) && !c.nameTaken) {
          const r = await claim(c, c.name);
          if (r === 'ok') Hub.mutateChar(c.id, (x) => { x.nameKey = keyOf(x.name); delete x.nameTaken; });
          else if (r === 'taken') Hub.mutateChar(c.id, (x) => { x.nameTaken = true; });
        }
      }
    })().finally(() => { syncing = null; });
    return syncing;
  }

  // 이름 바꾸기 값: 바꾼 적 없거나 이름이 겹쳐서 바꿔야 하면 무료
  const renameCost = (c) => (!c || c.nameTaken || !(c.renames > 0) ? 0 : RENAME_GEMS);
  // 이름 바꾸기 (중복 확인 → 다이아 → 등록). { ok, msg }
  async function rename(c, name) {
    const n = clean(name);
    if (!n) return { ok: false, msg: '이름을 적어 주세요!' };
    if (n === c.name && !c.nameTaken) return { ok: false, msg: '지금 이름과 같아요' };
    const cost = renameCost(c);
    if (cost && Hub.gems(c) < cost) return { ok: false, msg: `다이아가 ${cost - Hub.gems(c)}개 모자라요!` };
    const r = await claim(c, n);
    if (r === 'taken') return { ok: false, msg: '이미 다른 사람이 쓰는 이름이에요' };
    if (r === 'offline') return { ok: false, msg: '이름을 확인하려면 인터넷 연결이 필요해요' };
    const forced = !!c.nameTaken;
    Hub.mutateChar(c.id, (x) => { x.name = n; x.nameKey = keyOf(n); delete x.nameTaken; if (!forced) x.renames = (x.renames || 0) + 1; if (cost) x.gems = (x.gems || 0) - cost; });
    sync();
    return { ok: true, msg: cost ? `이름을 바꿨어요! (다이아 -${cost})` : '이름을 바꿨어요!' };
  }
  // 새 캐릭터 이름 확인 (만들기 전). 서버가 안 되면 일단 만들고 나중에 등록 (겹치면 그때 무료로 바꾸기)
  async function canCreate(name) {
    const r = await check(name);
    if (r === 'taken') return { ok: false, msg: '이미 다른 사람이 쓰는 이름이에요' };
    if (r === 'bad') return { ok: false, msg: '이름을 적어 주세요!' };
    return { ok: true };
  }
  // 캐릭터를 지우면 이름·ID 를 놓아줌 (다른 사람이 쓸 수 있게)
  async function release(c) {
    const f = await timeout(server(), 4000); if (!f || f === 'timeout' || !c) return;
    if (c.nameKey) f.db.collection('names').doc(c.nameKey).delete().catch(() => {});
  }
  // ID 로 캐릭터 찾기 → { pid, uid, cid, name, look } 또는 null
  async function find(pid) {
    pid = String(pid || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (!okPid(pid)) return null;
    const f = await timeout(server(), 4000); if (!f || f === 'timeout') return null;
    try { const s = await f.db.collection('pids').doc(pid).get(); return s.exists ? { pid, ...s.data() } : null; } catch (e) { return null; }
  }

  window.Names = { RENAME_GEMS, keyOf, clean, check, canCreate, rename, renameCost, sync, release, find, newPid, t };
  // 어느 화면이든 들어오면 등록 안 된 것만 등록 (다 등록된 뒤에는 서버에 묻지 않음)
  if (window.Hub && !/\/admin\//.test(location.pathname)) setTimeout(sync, 1500);
})();
