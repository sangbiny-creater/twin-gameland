'use strict';
// 순위 스냅샷 (1시간마다 찍어 두는 순위표) — 게임 화면은 이 결과 문서 1개만 읽음 (게임 기록 수천 개를 읽지 않게)
//  · 10분마다 실행. 게임 랭킹·주간 투어 랭킹은 매시 정각이 지난 첫 실행에서만 새로 매김 ("1시간 전 기준" 순위)
//    그룹투어 주 1회 이벤트는 이벤트 1시간 동안 10분마다, 끝난 뒤 20분 안에 한 번 더 매겨서 '최종'
//  · 새로 들어온 기록만 읽음 (records.sat = 서버가 받은 시각, common/auth.js 가 넣음). 처음 한 번만 예전 기록 전부
//  · 순위는 점수가 오르기만 해서(최고 점수·판마다 최고 별) 상위 100명만 들고 있어도 정확함
//  공개(누구나 읽기) ranks/{id}:
//    {게임}_all · {게임}_w{주}  : { at, top: [{ k, uid, cid, name, face, score }] }  주 = 일요일 날짜 (records.wk)
//    tours_w{주}               : { at, list: [{ id, name, mark, open, max, count, guide, score, by: { 멤버키: 포인트 } }] }
//    ev_{이벤트 id}            : { at, final, list: [{ id, name, mark, best, total, plays, by: { 멤버키: { best, total, plays } } }] }
//  서버만(규칙에서 막음): rankp/{게임__uid_cid} 캐릭터별 누적, rankagg/{tp_w주 | ev_id} 합계, rankjobs/state 읽은 곳까지(cursor·evCursor)
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

const STAGE = new Set(['skyhook', 'shisen', 'memory', 'mole', 'giftsort', 'burger']); // 징검다리 게임 = 판마다 최고 별 합
const TOPN = 100, PLAY_PT = 10, STAR_PT = 10;
const H = 3600e3;
const pad = (n) => String(n).padStart(2, '0');
// 한국 시간 기준 주(일요일 날짜) — 게임 화면(common/auth.js wk)과 같은 모양
const wkOf = (ms) => { const d = new Date(ms + 9 * H); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const safe = (s) => String(s || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120);
const okFace = (f) => (/^common\/(faces|costumes)\/[a-z0-9_]+\.webp$/.test(f || '') ? f : '');
const stSum = (st) => Object.values(st || {}).reduce((n, x) => n + (x || 0), 0);

async function newRecords(db, cursor, backfill) {
  const out = []; let last = cursor;
  if (backfill) { // 처음 한 번: sat 없는 예전 기록까지 전부
    const s = await db.collection('records').limit(30000).get();
    s.forEach((d) => out.push(d.data()));
    return { out, last: admin.firestore.Timestamp.now() };
  }
  for (let i = 0; i < 10; i++) {
    let q = db.collection('records').orderBy('sat').limit(5000);
    if (last) q = q.where('sat', '>', last);
    const s = await q.get(); if (s.empty) break;
    s.forEach((d) => out.push(d.data()));
    last = s.docs[s.docs.length - 1].get('sat');
    if (s.size < 5000) break;
  }
  return { out, last };
}

// 게임 랭킹: 새 기록 → 캐릭터별 누적(rankp) → 바뀐 점수만 순위표에 넣기
async function updateGameBoards(db, recs, now) {
  const groups = new Map();
  for (const r of recs) {
    if (!r.uid || !r.game || r.god) continue;
    const id = `${safe(r.game)}__${safe(r.uid)}_${safe(r.cid || r.name)}`;
    (groups.get(id) || groups.set(id, []).get(id)).push(r);
  }
  const boards = new Map(); // id → { top }
  const board = async (id) => { if (!boards.has(id)) { const s = await db.collection('ranks').doc(id).get(); boards.set(id, { top: (s.exists && s.data().top) || [] }); } return boards.get(id); };
  const put = async (bid, e) => { const b = await board(bid); b.top = b.top.filter((x) => x.k !== e.k); b.top.push(e); b.top.sort((a, c) => c.score - a.score || (a.at || 0) - (c.at || 0)); b.top = b.top.slice(0, TOPN); b.dirty = true; };
  const cur = wkOf(now);
  let batch = db.batch(), n = 0;
  for (const [id, rs] of groups) {
    const ref = db.collection('rankp').doc(id), s = await ref.get();
    const r0 = rs[0], stage = STAGE.has(r0.game);
    const p = s.exists ? s.data() : { uid: r0.uid, cid: r0.cid || '', game: r0.game, all: { best: 0, st: {} }, wk: { id: '', best: 0, st: {} } };
    rs.sort((a, b) => (a.at || 0) - (b.at || 0));
    for (const r of rs) {
      const w = r.wk || wkOf(r.at || now);
      if (w > p.wk.id) p.wk = { id: w, best: 0, st: {} };
      const add = (o) => { if (stage) { if (r.stage != null && (r.stars || 0) > (o.st[r.stage] || 0)) o.st[r.stage] = r.stars || 0; } else o.best = Math.max(o.best || 0, r.score || 0); };
      add(p.all); if (w === p.wk.id) add(p.wk);
      if ((r.at || 0) >= (p.at || 0)) { p.at = r.at || 0; p.name = String(r.name || '?').slice(0, 12); p.face = okFace(r.face); p.look = r.look || ''; }
    }
    batch.set(ref, p); if (++n >= 400) { await batch.commit(); batch = db.batch(); n = 0; }
    const e = { k: `${p.uid}|${p.cid || p.name}`, uid: p.uid, cid: p.cid || '', name: p.name, face: p.face, look: p.look, at: p.at };
    const all = stage ? stSum(p.all.st) : p.all.best, wks = stage ? stSum(p.wk.st) : p.wk.best;
    if (all > 0) await put(`${safe(p.game)}_all`, { ...e, score: all });
    if (wks > 0 && p.wk.id >= wkOf(now - 8 * 864e5)) await put(`${safe(p.game)}_w${p.wk.id}`, { ...e, score: wks });
  }
  if (n) await batch.commit();
  for (const [id, b] of boards) if (b.dirty || id.endsWith('_w' + cur)) await db.collection('ranks').doc(id).set({ at: now, top: b.top });
}

// 주간 투어 포인트: 판 하나 10점 + 별 하나 10점 (멤버키 uid_cid)
async function updateTourBoard(db, recs, now) {
  const cur = wkOf(now), aggRef = db.collection('rankagg').doc('tp_w' + cur);
  const s = await aggRef.get(), p = (s.exists && s.data().p) || {};
  for (const r of recs) { if (!r.uid || r.god || (r.wk || wkOf(r.at || now)) !== cur) continue; const k = `${r.uid}_${r.cid || ''}`; p[k] = (p[k] || 0) + PLAY_PT + (r.stars || 0) * STAR_PT; }
  await aggRef.set({ p, at: now });
  const ts = await db.collection('tours').limit(1000).get(), list = [];
  ts.forEach((d) => {
    const t = d.data(), by = {}; let score = 0;
    for (const k of Object.keys(t.mem || {})) if (p[k]) { by[k] = p[k]; score += p[k]; }
    list.push({ id: d.id, name: t.name || '', mark: t.mark || 1, open: t.open !== false, max: t.max || 20, count: Object.keys(t.mem || {}).length, guide: ((t.mem || {})[t.gk] || {}).n || '', score, by, createdAt: t.createdAt || 0 });
  });
  list.sort((a, b) => b.score - a.score || a.createdAt - b.createdAt);
  await db.collection('ranks').doc('tours_w' + cur).set({ at: now, list });
}

// 주 1회 이벤트: 그 게임, 이벤트 시간 안의 기록만 (멤버 최고 점수 합 = 보상 순위, 모든 점수 합 = 투어 랭킹)
async function updateEvent(db, ev, recs, now, final) {
  const end = ev.start + (ev.min || 60) * 60000, aggRef = db.collection('rankagg').doc('ev_' + safe(ev.id));
  const s = await aggRef.get(), p = (s.exists && s.data().p) || {};
  for (const r of recs) {
    if (!r.uid || r.god || r.game !== ev.game || (r.at || 0) < ev.start || (r.at || 0) >= end) continue;
    const k = `${r.uid}_${r.cid || ''}`, o = p[k] || { best: 0, total: 0, plays: 0 };
    o.best = Math.max(o.best, r.score || 0); o.total += r.score || 0; o.plays++; p[k] = o;
  }
  await aggRef.set({ p, at: now });
  const ts = await db.collection('tours').limit(1000).get(), list = [];
  ts.forEach((d) => {
    const t = d.data(), by = {}; let best = 0, total = 0, plays = 0;
    for (const [k, m] of Object.entries(t.mem || {})) { const o = p[k]; if (!o || (m.at || 0) >= end) continue; by[k] = o; best += o.best; total += o.total; plays += o.plays; }
    if (plays) list.push({ id: d.id, name: t.name || '', mark: t.mark || 1, best, total, plays, by });
  });
  await db.collection('ranks').doc('ev_' + safe(ev.id)).set({ at: now, final: !!final, game: ev.game, list });
}

exports.rankSnapshot = onSchedule({ schedule: 'every 10 minutes', timeZone: 'Asia/Seoul', region: 'asia-northeast3', memory: '512MiB', timeoutSeconds: 300 }, async () => {
  const db = admin.firestore(), now = Date.now();
  const stRef = db.collection('rankjobs').doc('state'), st = (await stRef.get()).data() || {};
  const hourDue = Math.floor(now / H) !== Math.floor((st.rankAt || 0) / H);
  const cfg = (await db.collection('config').doc('guild').get()).data() || {}, ev = cfg.event && cfg.event.start && cfg.event.game ? cfg.event : null;
  const evEnd = ev ? ev.start + (ev.min || 60) * 60000 : 0;
  const evDue = ev && now >= ev.start && now < evEnd + 20 * 60000 && st.evFinal !== ev.id;
  if (!hourDue && !evDue) return;
  const next = { ...st };
  // 이벤트: 이벤트 시간 동안만 따로 읽은 곳(evCursor)부터 새 기록을 읽어 이벤트 합계에 더함
  if (evDue) {
    if (next.evId !== ev.id) { next.evId = ev.id; next.evCursor = admin.firestore.Timestamp.fromMillis(ev.start - 60000); }
    const { out, last } = await newRecords(db, next.evCursor, false);
    const fin = now >= evEnd + 10 * 60000;
    await updateEvent(db, ev, out, now, fin);
    next.evCursor = last || next.evCursor; if (fin) next.evFinal = ev.id;
  }
  // 게임 랭킹·주간 투어 랭킹: 매시 정각이 지난 첫 실행에서, 지난번부터 들어온 기록으로
  if (hourDue) {
    const { out, last } = await newRecords(db, st.cursor || null, !st.backfilled);
    await updateGameBoards(db, out, now);
    await updateTourBoard(db, out, now);
    next.cursor = last || st.cursor || null; next.backfilled = true; next.rankAt = now;
    await db.collection('ranks').doc('_meta').set({ at: now }); // 게임 화면: 이 문서가 3시간 안이면 스냅샷을 씀 (아니면 예전처럼 직접 계산)
  }
  await stRef.set(next);
});
