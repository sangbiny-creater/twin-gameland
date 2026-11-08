'use strict';
// 은유와 은결 백오피스 (https://sangbiny-creater.github.io/twin-gameland/admin/)
//  · 관리자: Firestore admins/{이메일} 문서가 있는 구글 계정 (server/README.md 4번). 데이터 보호는 server/firestore.rules 가 함 (이 화면은 공개돼도 관리자 아니면 아무것도 못 읽음)
//  · Firebase 가 아직 없으면 예시 데이터로 화면만 보여 줌 (데모)
//  · 데이터: users · sessions(사용 시간) · records(게임 기록) · payments · config/{catalog,terms,ops} · coupons · guilds · seasons (server/README.md)
const $ = (id) => document.getElementById(id);
const H = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtN = (n) => (+n || 0).toLocaleString('ko-KR');
const fmtT = (sec) => { sec = Math.round(sec || 0); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60); return h ? `${h}시간 ${m}분` : m ? `${m}분` : `${sec}초`; };
const fmtD = (ms) => { if (!ms) return '-'; const d = new Date(ms); return `${d.getFullYear() % 100}.${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const day = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const week = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); const y = new Date(d.getFullYear(), 0, 4); return `${d.getFullYear()}-W${String(1 + Math.round(((d - y) / 864e5 - 3 + ((y.getDay() + 6) % 7)) / 7)).padStart(2, '0')}`; };
const toast = (m) => { const t = $('toast'); t.textContent = m; t.classList.remove('hidden'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 2400); };
const GAMES = Object.fromEntries(Object.entries(Hub.GAMES).map(([k, g]) => [k, g.name])); GAMES.darts = GAMES.darts || '다트'; GAMES.hub = '첫 화면·메뉴';
const gname = (g) => GAMES[g] || g;
const PROV = { google: '구글', email: '이메일', guest: '게스트' };
// 결제 상품 기본 값 (common/monet.js PACKS·OFFERS 와 같게)
const PACKS0 = [{ id: 'diamond_60', name: '다이아 60', gems: 60, won: 1200 }, { id: 'diamond_140', name: '다이아 140', gems: 140, won: 2500 }, { id: 'diamond_300', name: '다이아 300', gems: 300, won: 5000 }, { id: 'diamond_650', name: '다이아 650', gems: 650, won: 10000 },
  { id: 'unlock_all', name: '모든 게임 열기', won: 6900 }, { id: 'gem_pass_30', name: '월 다이아 패스', won: 3900 }, { id: 'no_ads_reward', name: '광고 없이 보상', won: 5900 }];

// ---------- 데이터 (Firebase 또는 데모) ----------
let fb = null, me = null;
const DB = { users: [], sessions: [], records: [], payments: [], config: {}, coupons: [], guilds: [], seasons: [] };
const isDemo = () => !window.FIREBASE_CONFIG;
function demoData() {
  let s = 7; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const now = Date.now(), D = 864e5, games = ['shisen', 'memory', 'mole', 'giftsort', 'stairs', 'helicopter', 'downhill', 'bakery', 'dogsnack', 'darts'];
  for (let i = 0; i < 48; i++) {
    const p = r() < 0.45 ? 'guest' : r() < 0.6 ? 'google' : 'email', c = now - r() * 40 * D;
    DB.users.push({ id: 'demo' + i, provider: p, email: p === 'guest' ? '' : `user${i}@example.com`, createdAt: c, lastAt: c + r() * (now - c), status: i === 5 ? 'banned' : 'active', totalSec: 0, over14: true, name: r() < 0.5 ? '은유' : '은결' });
  }
  for (let k = 0; k < 900; k++) {
    const u = DB.users[Math.floor(r() * DB.users.length)], at = now - r() * 30 * D, g = games[Math.floor(r() * games.length)], sec = 30 + Math.round(r() * 900);
    DB.sessions.push({ uid: u.id, game: g, start: at, sec, day: day(at), mode: u.provider, name: u.name }); u.totalSec += sec;
    if (r() < 0.7) DB.records.push({ uid: u.id, game: g, stage: Math.floor(r() * 30), cleared: r() < 0.7, score: Math.round(r() * 5000), stars: Math.floor(r() * 4), at, day: day(at), week: week(at), month: day(at).slice(0, 7), name: u.name });
  }
  for (let k = 0; k < 26; k++) { const u = DB.users.filter((x) => x.provider !== 'guest')[Math.floor(r() * 20)], p = PACKS0[Math.floor(r() * PACKS0.length)], at = now - r() * 30 * D; DB.payments.push({ uid: u.id, email: u.email, product: p.id, won: p.won, at, day: day(at), status: 'test' }); }
  DB.guilds.push({ id: 'g1', name: '하늘 탐험대', leader: 'user3@example.com', members: 12, score: 15400, createdAt: now - 5 * D }, { id: 'g2', name: '별빛 원정대', leader: 'user7@example.com', members: 8, score: 9800, createdAt: now - 2 * D });
}
async function loadAll() {
  if (isDemo()) { demoData(); return; }
  const since = Date.now() - 31 * 864e5;
  const get = async (col, q) => (await (q || fb.db.collection(col)).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  const [users, sessions, records, payments, coupons, guilds, seasons, cfg] = await Promise.all([
    get('users'), get('sessions', fb.db.collection('sessions').where('start', '>=', since)), get('records', fb.db.collection('records').where('at', '>=', since)),
    get('payments'), get('coupons'), get('guilds'), get('seasons'), get('config')]);
  Object.assign(DB, { users, sessions, records, payments, coupons, guilds, seasons, config: Object.fromEntries(cfg.map((c) => [c.id, c])) });
}
async function saveDoc(col, id, data, merge = true) {
  if (isDemo()) { toast('데모라서 저장하지 않았어요 (서버 연결 후 저장돼요)'); return false; }
  await fb.db.collection(col).doc(id).set(data, { merge }); toast('저장했어요'); return true;
}

// ---------- 로그인 ----------
const loadJs = (u) => new Promise((ok, no) => { const s = document.createElement('script'); s.src = u; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
async function boot() {
  if (isDemo()) { $('demo').classList.remove('hidden'); $('btnLogin').classList.add('hidden'); $('who').textContent = '데모'; demoData(); renderTabs(); return; }
  for (const n of ['app', 'auth', 'firestore', 'storage']) await loadJs(`https://www.gstatic.com/firebasejs/10.12.2/firebase-${n}-compat.js`);
  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.FIREBASE_CONFIG);
  fb = { auth: app.auth(), db: app.firestore(), st: app.storage() };
  fb.auth.onAuthStateChanged(async (u) => {
    me = u; $('btnLogin').classList.toggle('hidden', !!u); $('btnLogout').classList.toggle('hidden', !u); $('who').textContent = u ? u.email : '';
    if (!u) { $('tabs').innerHTML = ''; $('main').innerHTML = `<div class="gate"><h2>관리자 로그인</h2><p class="note">관리자 구글 계정으로 로그인해 주세요.</p></div>`; return; }
    let admin = false; try { admin = (await fb.db.collection('admins').doc(u.email).get()).exists; } catch (e) { /* 권한 없음 */ }
    if (!admin) { $('tabs').innerHTML = ''; $('main').innerHTML = `<div class="gate"><h2>관리자가 아니에요</h2><p class="note">${H(u.email)} 계정은 백오피스를 쓸 수 없어요.</p></div>`; return; }
    $('main').innerHTML = '<p class="note">불러오는 중...</p>';
    try { await loadAll(); renderTabs(); } catch (e) { $('main').innerHTML = `<div class="panel">불러오지 못했어요: ${H(e.message)}</div>`; }
  });
}
$('btnLogin').onclick = () => fb && fb.auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
$('btnLogout').onclick = () => fb && fb.auth.signOut();

// ---------- 탭 ----------
const TABS = [['dash', '대시보드'], ['users', '사용자'], ['games', '게임별 통계'], ['rank', '주간·월간 순위'], ['shop', '캐릭터샵·아이템샵'], ['pay', '결제 내역'], ['terms', '약관·개인정보'], ['guild', 'Group Tour (길드)'], ['ops', '운영 (공지·점검·쿠폰)'], ['balance', '난이도·보상 기준'], ['setup', '출시 준비']];
let tab = (location.hash || '#dash').slice(1);
function renderTabs() {
  $('tabs').innerHTML = TABS.map(([k, n]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${n}</button>`).join('');
  $('tabs').onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; tab = b.dataset.t; history.replaceState(null, '', '#' + tab); renderTabs(); };
  ($('main').innerHTML = ''), (VIEWS[tab] || VIEWS.dash)($('main'));
}
const bars = (pairs, cls = '', fmt = fmtN) => { const mx = Math.max(1, ...pairs.map((p) => p[1])); return `<div class="bars ${cls}">${pairs.map(([k, v]) => `<div style="height:${Math.max(2, (v / mx) * 100)}%" title="${k}: ${fmt(v)}"><i>${v ? fmt(v) : ''}</i><span>${k.slice(5)}</span></div>`).join('')}</div>`; };
const hbars = (pairs, fmt = fmtN) => { const mx = Math.max(1, ...pairs.map((p) => p[1])); return pairs.map(([k, v]) => `<div class="hbar"><span>${H(k)}</span><div><i style="width:${(v / mx) * 100}%"></i></div><b>${fmt(v)}</b></div>`).join(''); };
const lastDays = (n) => [...Array(n)].map((_, i) => day(Date.now() - (n - 1 - i) * 864e5));
const sum = (a, f) => a.reduce((s, x) => s + (f(x) || 0), 0);

const VIEWS = {
  dash(m) {
    const today = day(Date.now()), d7 = Date.now() - 7 * 864e5, U = DB.users, S = DB.sessions;
    const dau = new Set(S.filter((x) => x.day === today).map((x) => x.uid)).size, wau = new Set(S.filter((x) => x.start >= d7).map((x) => x.uid)).size;
    const days = lastDays(14), perDay = days.map((d) => [d, new Set(S.filter((x) => x.day === d).map((x) => x.uid)).size]), secDay = days.map((d) => [d, Math.round(sum(S.filter((x) => x.day === d), (x) => x.sec) / 60)]);
    const newDay = days.map((d) => [d, U.filter((u) => day(u.createdAt) === d).length]);
    const prov = Object.entries(PROV).map(([k, n]) => [n, U.filter((u) => u.provider === k).length]);
    m.innerHTML = `<h2>대시보드</h2><div class="cards">
      <div class="card"><small>전체 사용자</small><b>${fmtN(U.length)}</b></div><div class="card"><small>오늘 접속</small><b>${fmtN(dau)}</b></div>
      <div class="card"><small>7일 접속</small><b>${fmtN(wau)}</b></div><div class="card"><small>7일 새 사용자</small><b>${fmtN(U.filter((u) => u.createdAt >= d7).length)}</b></div>
      <div class="card"><small>오늘 사용 시간</small><b>${fmtT(sum(S.filter((x) => x.day === today), (x) => x.sec))}</b></div><div class="card"><small>1인 평균 사용 시간</small><b>${fmtT(sum(U, (u) => u.totalSec) / Math.max(1, U.length))}</b></div>
      <div class="card"><small>30일 결제(검수용 포함)</small><b>${fmtN(sum(DB.payments, (p) => p.won))}원</b></div><div class="card"><small>길드</small><b>${fmtN(DB.guilds.length)}</b></div></div>
      <div class="panel barsx"><h3>날마다 접속한 사람 (14일)</h3>${bars(perDay)}</div>
      <div class="panel barsx"><h3>날마다 사용 시간 (분, 14일)</h3>${bars(secDay, 'blue')}</div>
      <div class="panel barsx"><h3>날마다 새 사용자 (14일)</h3>${bars(newDay)}</div>
      <div class="grid2"><div class="panel"><h3>로그인 방식</h3>${hbars(prov)}</div>
      <div class="panel"><h3>게임별 사용 시간 (30일)</h3>${hbars(Object.keys(GAMES).map((g) => [gname(g), sum(S.filter((x) => x.game === g), (x) => x.sec)]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]), fmtT)}</div></div>`;
  },
  users(m) {
    m.innerHTML = `<h2>사용자 (${fmtN(DB.users.length)}명)</h2><p class="note">받는 개인정보는 이메일뿐이에요. 게스트는 이메일이 없어요. 정지하면 다음 접속부터 게임을 못 해요.</p>
      <div class="row"><input id="uq" placeholder="이메일·uid 찾기"><select id="up"><option value="">모든 방식</option>${Object.entries(PROV).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select><select id="us"><option value="lastAt">최근 접속순</option><option value="createdAt">가입순</option><option value="totalSec">사용 시간순</option></select></div>
      <div class="panel"><table><thead><tr><th>계정</th><th>방식</th><th>가입</th><th>최근 접속</th><th class="num">사용 시간</th><th>상태</th><th></th></tr></thead><tbody id="ub"></tbody></table></div>`;
    const draw = () => {
      const q = $('uq').value.trim().toLowerCase(), p = $('up').value, k = $('us').value;
      $('ub').innerHTML = DB.users.filter((u) => (!q || (u.email || '').includes(q) || u.id.includes(q)) && (!p || u.provider === p)).sort((a, b) => (b[k] || 0) - (a[k] || 0)).slice(0, 300)
        .map((u) => `<tr><td>${H(u.email || '(게스트)')}<br><small style="color:#aaa">${H(u.id)}</small></td><td><span class="tag ${u.provider}">${PROV[u.provider] || u.provider}</span></td><td>${fmtD(u.createdAt)}</td><td>${fmtD(u.lastAt)}</td><td class="num">${fmtT(u.totalSec)}</td>
          <td>${u.status === 'banned' ? '<span class="tag banned">정지</span>' : '정상'}${u.memo ? `<br><small>${H(u.memo)}</small>` : ''}</td>
          <td><button class="btn small ${u.status === 'banned' ? 'gray' : 'red'}" data-ban="${H(u.id)}">${u.status === 'banned' ? '정지 풀기' : '정지'}</button> <button class="btn small gray" data-memo="${H(u.id)}">메모</button> <button class="btn small gray" data-rec="${H(u.id)}">기록</button></td></tr>`).join('');
    };
    m.oninput = draw; draw();
    m.onclick = async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const u = DB.users.find((x) => x.id === (b.dataset.ban || b.dataset.memo || b.dataset.rec)); if (!u) return;
      if (b.dataset.ban) { const st = u.status === 'banned' ? 'active' : 'banned'; if (st === 'banned' && !confirm(`${u.email || u.id} 계정을 정지할까요?`)) return; if (await saveDoc('users', u.id, { status: st }) || isDemo()) { u.status = st; draw(); } }
      if (b.dataset.memo) { const t = prompt('메모 (관리자만 보여요)', u.memo || ''); if (t !== null && (await saveDoc('users', u.id, { memo: t }) || isDemo())) { u.memo = t; draw(); } }
      if (b.dataset.rec) { const R = DB.records.filter((x) => x.uid === u.id).sort((a, c) => c.at - a.at).slice(0, 50); alert(R.length ? R.map((x) => `${fmtD(x.at)}  ${gname(x.game)}  ${x.stage != null ? 'S' + (x.stage + 1) + ' ' : ''}${x.cleared ? '성공' : ''} ${fmtN(x.score)}점`).join('\n') : '최근 30일 기록이 없어요'); }
    };
  },
  games(m) {
    const S = DB.sessions, R = DB.records;
    const rows = Object.keys(GAMES).map((g) => { const s = S.filter((x) => x.game === g), r = R.filter((x) => x.game === g); return { g, sec: sum(s, (x) => x.sec), n: s.length, ppl: new Set(s.map((x) => x.uid)).size, plays: r.length, clear: r.filter((x) => x.cleared).length, best: Math.max(0, ...r.map((x) => x.score)) }; }).filter((x) => x.n || x.plays);
    m.innerHTML = `<h2>게임별 통계 (30일)</h2><div class="panel"><table><thead><tr><th>게임</th><th class="num">사용 시간</th><th class="num">접속</th><th class="num">사람 수</th><th class="num">1회 평균</th><th class="num">판 수</th><th class="num">성공률</th><th class="num">최고 점수</th></tr></thead><tbody>
      ${rows.sort((a, b) => b.sec - a.sec).map((x) => `<tr><td>${gname(x.g)}</td><td class="num">${fmtT(x.sec)}</td><td class="num">${fmtN(x.n)}</td><td class="num">${fmtN(x.ppl)}</td><td class="num">${fmtT(x.sec / Math.max(1, x.n))}</td><td class="num">${fmtN(x.plays)}</td><td class="num">${x.plays ? Math.round((x.clear / x.plays) * 100) + '%' : '-'}</td><td class="num">${fmtN(x.best)}</td></tr>`).join('')}</tbody></table></div>
      <h3>게임 기록 (최근 100개)</h3><div class="row"><select id="gq"><option value="">모든 게임</option>${Object.keys(GAMES).map((g) => `<option value="${g}">${gname(g)}</option>`).join('')}</select></div>
      <div class="panel"><table><thead><tr><th>때</th><th>게임</th><th>캐릭터</th><th>판</th><th>결과</th><th class="num">점수</th><th class="num">별</th></tr></thead><tbody id="gb"></tbody></table></div>`;
    const draw = () => { const g = $('gq').value; $('gb').innerHTML = R.filter((x) => !g || x.game === g).sort((a, b) => b.at - a.at).slice(0, 100).map((x) => `<tr><td>${fmtD(x.at)}</td><td>${gname(x.game)}</td><td>${H(x.name || '')}</td><td>${x.stage != null ? Hub.stageLabel(x.stage, Hub.GAMES[x.game] && Hub.GAMES[x.game].stages ? x.game : 'shisen') : '-'}</td><td>${x.cleared ? '성공' : '-'}</td><td class="num">${fmtN(x.score)}</td><td class="num">${x.stars || ''}</td></tr>`).join(''); };
    m.onchange = draw; draw();
  },
  rank(m) {
    const weeks = [...new Set(DB.records.map((x) => x.week))].sort().reverse(), months = [...new Set(DB.records.map((x) => x.month))].sort().reverse();
    m.innerHTML = `<h2>주간·월간 순위</h2><p class="note">게임마다 한 사람의 가장 높은 점수로 줄 세워요. (스테이지 게임은 깬 판 수 → 별 순)</p>
      <div class="row"><select id="rk"><option value="week">주간</option><option value="month">월간</option></select><select id="rp"></select><select id="rg">${Object.keys(GAMES).filter((g) => g !== 'hub' && g !== 'skyhook').sort((x, y) => DB.records.filter((r) => r.game === y).length - DB.records.filter((r) => r.game === x).length).map((g) => `<option value="${g}">${gname(g)}</option>`).join('')}</select></div>
      <div class="panel"><table><thead><tr><th>순위</th><th>계정</th><th>캐릭터</th><th class="num">점수</th><th class="num">판 수</th></tr></thead><tbody id="rb"></tbody></table></div>`;
    const draw = () => {
      const k = $('rk').value, list = k === 'week' ? weeks : months;
      if (!list.includes($('rp').value)) $('rp').innerHTML = list.map((p) => `<option>${p}</option>`).join('');
      const p = $('rp').value, g = $('rg').value, staged = !!(Hub.GAMES[g] && Hub.GAMES[g].stages), by = {};
      for (const x of DB.records.filter((r) => r[k] === p && r.game === g)) {
        const b = by[x.uid] || (by[x.uid] = { uid: x.uid, name: x.name, best: 0, plays: 0, clears: new Set(), stars: 0 });
        b.plays++; b.best = Math.max(b.best, x.score || 0); if (x.cleared) { b.clears.add(x.stage); b.stars += x.stars || 0; }
      }
      const users = Object.fromEntries(DB.users.map((u) => [u.id, u]));
      const L = Object.values(by).map((b) => ({ ...b, val: staged ? b.clears.size * 1000 + b.stars : b.best })).sort((a, b) => b.val - a.val).slice(0, 100);
      $('rb').innerHTML = L.map((b, i) => `<tr><td>${i + 1}</td><td>${H((users[b.uid] || {}).email || '(게스트)')}</td><td>${H(b.name || '')}</td><td class="num">${staged ? `${b.clears.size}판 · 별 ${b.stars}` : fmtN(b.best)}</td><td class="num">${b.plays}</td></tr>`).join('') || '<tr><td colspan="5">기록이 없어요</td></tr>';
    };
    m.onchange = draw; draw();
  },
  shop(m) {
    const cat = JSON.parse(JSON.stringify(DB.config.catalog || {})); cat.outfits = cat.outfits || {}; cat.park = cat.park || {}; cat.boosts = cat.boosts || {}; cat.packs = cat.packs || {};
    const O = Hub.OUTFITS, B = Hub.BOOSTS, P = Hub.PARK_ITEMS;
    const ov = (w, id) => (cat.outfits[w] || []).find((x) => x.id === id) || {};
    const outfitRows = (w) => [...O[w].filter((x) => !x.custom), ...(cat.outfits[w] || []).filter((x) => !O[w].some((y) => y.id === x.id && !y.custom))].map((it) => {
      const o = { ...it, ...ov(w, it.id) }, img = o.item || `../closet/assets/item_${w}_${o.id}.webp`;
      return `<tr><td><img class="thumb" src="${H(img)}" alt=""></td><td>${H(o.id)}${o.body ? ' <span class="tag">새 옷</span>' : ''}</td><td><input data-o="${w}|${o.id}|name" value="${H(o.name)}"></td><td><input class="num" type="number" data-o="${w}|${o.id}|price" value="${o.price}"> 💎</td><td><input data-o="${w}|${o.id}|note" value="${H(o.note || '')}" placeholder="효과 문구 (없으면 비움)"></td><td><label><input type="checkbox" data-o="${w}|${o.id}|hidden" ${o.hidden ? 'checked' : ''}> 숨김</label></td></tr>`;
    }).join('');
    m.innerHTML = `<h2>캐릭터샵·아이템샵</h2><p class="note">값을 바꾸고 맨 아래 '저장'을 누르면 다음 접속부터 게임에 적용돼요. 이미 산 물건은 그대로예요. 결제 상품(원화)은 앱 출시 때 구글 플레이 콘솔 값과 같게 맞춰야 해요.</p>
      <h3>옷장 · 은유</h3><div class="panel"><table><tbody>${outfitRows('eunyu')}</tbody></table></div>
      <h3>옷장 · 은결</h3><div class="panel"><table><tbody>${outfitRows('eungyeol')}</tbody></table></div>
      <h3>새 옷 추가</h3><div class="panel form"><p class="note">그림 2장이 필요해요: ① 옷장 가운데 전신 그림(투명 배경 PNG·WebP, 세로 약 1100px) ② 옷 칸 그림(정사각 260px). 새 옷은 옷장에만 보이고, 게임 안 그림은 기본 옷으로 나와요 (게임 그림까지 바꾸려면 GPT 시트 → tools/closet_assets.py).</p>
        <div class="grid2"><div><label>캐릭터</label><select id="nw"><option value="eunyu">은유</option><option value="eungyeol">은결</option></select></div><div><label>id (영어 소문자, 예: summer)</label><input id="ni"></div>
        <div><label>이름</label><input id="nn"></div><div><label>다이아 값</label><input id="np" type="number" value="100"></div>
        <div><label>전신 그림</label><input id="nb" type="file" accept="image/png,image/webp"></div><div><label>옷 칸 그림</label><input id="nt" type="file" accept="image/png,image/webp,image/jpeg"></div></div>
        <div class="row" style="margin-top:10px"><button class="btn" id="nAdd">새 옷 추가</button></div></div>
      <h3>아이템 (코인)</h3><div class="panel"><table><thead><tr><th>게임</th><th>아이템</th><th class="num">코인</th></tr></thead><tbody>${Object.entries(B).flatMap(([g, L]) => L.map((b) => `<tr><td>${gname(g)}</td><td>${H(b.name)}</td><td class="num"><input class="num" type="number" data-b="${g}.${b.id}" value="${cat.boosts[g + '.' + b.id] || b.price}"></td></tr>`)).join('')}</tbody></table></div>
      <h3>놀이공원 꾸미기 (다이아)</h3><div class="panel"><table><tbody>${Object.entries(P).map(([k, v]) => `<tr><td>${H(v.name)}</td><td>${v.items.length}종</td><td class="num"><input class="num" type="number" data-p="${k}" value="${cat.park[k] || v.price}"> 💎</td></tr>`).join('')}</tbody></table></div>
      <h3>결제 상품 (원화)</h3><div class="panel"><table><thead><tr><th>상품 id</th><th>이름</th><th class="num">값(원)</th><th class="num">다이아</th></tr></thead><tbody>${PACKS0.map((p) => { const o = { ...p, ...(cat.packs[p.id] || {}) }; return `<tr><td>${p.id}</td><td>${H(p.name)}</td><td class="num"><input class="num" type="number" data-k="${p.id}|won" value="${o.won}"></td><td class="num">${p.gems ? `<input class="num" type="number" data-k="${p.id}|gems" value="${o.gems}">` : '-'}</td></tr>`; }).join('')}</tbody></table></div>
      <div class="row"><button class="btn" id="shopSave">저장 (게임에 적용)</button></div>`;
    const collect = () => {
      m.querySelectorAll('[data-o]').forEach((el) => {
        const [w, id, f] = el.dataset.o.split('|'), L = cat.outfits[w] || (cat.outfits[w] = []); let o = L.find((x) => x.id === id); if (!o) { o = { id }; L.push(o); }
        o[f] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? +el.value : el.value;
      });
      m.querySelectorAll('[data-b]').forEach((el) => { cat.boosts[el.dataset.b] = +el.value; });
      m.querySelectorAll('[data-p]').forEach((el) => { cat.park[el.dataset.p] = +el.value; });
      m.querySelectorAll('[data-k]').forEach((el) => { const [id, f] = el.dataset.k.split('|'); (cat.packs[id] = cat.packs[id] || {})[f] = +el.value; });
      cat.updatedAt = Date.now();
    };
    $('shopSave').onclick = async () => { collect(); if (await saveDoc('config', 'catalog', cat, false)) DB.config.catalog = cat; };
    $('nAdd').onclick = async () => {
      const w = $('nw').value, id = $('ni').value.trim(), name = $('nn').value.trim(), price = +$('np').value, fb1 = $('nb').files[0], ft = $('nt').files[0];
      if (!/^[a-z][a-z0-9_]{1,20}$/.test(id) || O[w].some((x) => x.id === id)) { toast('id 를 영어 소문자로, 겹치지 않게 넣어 주세요'); return; }
      if (!name || !(price > 0) || !fb1 || !ft) { toast('이름·값·그림 2장을 모두 넣어 주세요'); return; }
      if (isDemo()) { toast('데모라서 올리지 않았어요'); return; }
      const up = async (f, n) => { const r = fb.st.ref(`shop/outfits/${w}_${id}_${n}_${Date.now()}`); await r.put(f, { contentType: f.type }); return r.getDownloadURL(); };
      toast('그림 올리는 중...'); collect();
      (cat.outfits[w] = cat.outfits[w] || []).push({ id, name, price, body: await up(fb1, 'body'), item: await up(ft, 'item') });
      cat.updatedAt = Date.now(); if (await saveDoc('config', 'catalog', cat, false)) { DB.config.catalog = cat; VIEWS.shop(m); }
    };
  },
  pay(m) {
    const P = DB.payments.slice().sort((a, b) => b.at - a.at), users = Object.fromEntries(DB.users.map((u) => [u.id, u]));
    const days = lastDays(30), name = (id) => (PACKS0.find((p) => p.id === id) || {}).name || id;
    m.innerHTML = `<h2>결제 내역</h2><p class="note">지금은 웹 검수용 가짜 결제(status: test)만 있어요. 앱 출시 후에는 구글 플레이 결제를 서버가 확인해서 여기에 쌓여요. 게스트는 결제할 수 없어요.</p>
      <div class="cards"><div class="card"><small>30일 합계</small><b>${fmtN(sum(P, (p) => p.won))}원</b></div><div class="card"><small>결제 수</small><b>${fmtN(P.length)}</b></div><div class="card"><small>결제한 사람</small><b>${fmtN(new Set(P.map((p) => p.uid)).size)}</b></div></div>
      <div class="panel barsx"><h3>날마다 결제 (원)</h3>${bars(days.map((d) => [d, sum(P.filter((p) => p.day === d), (p) => p.won)]))}</div>
      <div class="grid2"><div class="panel"><h3>상품별</h3>${hbars(PACKS0.map((p) => [p.name, sum(P.filter((x) => x.product === p.id), (x) => x.won)]), (v) => fmtN(v) + '원')}</div></div>
      <div class="panel"><table><thead><tr><th>때</th><th>계정</th><th>상품</th><th class="num">값</th><th>상태</th></tr></thead><tbody>${P.slice(0, 200).map((p) => `<tr><td>${fmtD(p.at)}</td><td>${H(p.email || (users[p.uid] || {}).email || p.uid)}</td><td>${H(name(p.product))}</td><td class="num">${fmtN(p.won)}원</td><td><span class="tag">${p.status === 'test' ? '검수용' : H(p.status)}</span></td></tr>`).join('') || '<tr><td colspan="5">없어요</td></tr>'}</tbody></table></div>`;
  },
  async terms(m) {
    const T = DB.config.terms || {};
    const def = async (f) => { try { const t = await (await fetch(`../legal/${f}.html`)).text(); const d = new DOMParser().parseFromString(t, 'text/html').querySelector('#doc'); return d ? d.innerText.trim() : ''; } catch (e) { return ''; } };
    m.innerHTML = `<h2>약관·개인정보</h2><p class="note">여기서 고친 글이 게임의 '개인정보 처리방침'·'이용약관' 화면에 그대로 보여요. 구글 플레이 등록 때 개인정보 처리방침 주소로 <b>https://sangbiny-creater.github.io/twin-gameland/legal/privacy.html</b> 을 넣어요. 회사 이름·연락처 등 [ ] 칸은 꼭 채워 주세요.</p>
      <h3>개인정보 수집·이용 동의 / 처리방침</h3><textarea id="tp"></textarea><h3>이용약관</h3><textarea id="tt"></textarea>
      <div class="row" style="margin-top:10px"><button class="btn" id="tSave">저장</button><span class="note" style="margin:0">${T.updatedAt ? '마지막 저장 ' + fmtD(T.updatedAt) : '아직 저장 안 함 (기본 글)'}</span></div>`;
    $('tp').value = T.privacy || await def('privacy'); $('tt').value = T.terms || await def('terms');
    $('tSave').onclick = async () => { const d = { privacy: $('tp').value, terms: $('tt').value, updatedAt: Date.now() }; if (await saveDoc('config', 'terms', d, false)) DB.config.terms = d; };
  },
  guild(m) {
    const S = DB.config.guild || { season: '', start: '', end: '', reward: '', maxMembers: 20, open: false };
    m.innerHTML = `<h2>Group Tour (길드)</h2><p class="note">첫 화면 매표소 자리에 열 길드전 준비 칸이에요. 지금은 길드와 시즌 설정만 저장해 두고, 게임 화면(길드 만들기·가입·길드전)은 다음 단계에서 만들어요.</p>
      <div class="panel form"><h3>시즌 설정</h3><div class="grid2"><div><label>시즌 이름</label><input id="gs" value="${H(S.season)}" placeholder="예: 2026 겨울 시즌"></div><div><label>최대 인원</label><input id="gm" type="number" value="${S.maxMembers}"></div>
        <div><label>시작</label><input id="ga" type="date" value="${H(S.start)}"></div><div><label>끝</label><input id="gb" type="date" value="${H(S.end)}"></div>
        <div><label>보상 (예: 1등 길드 다이아 300)</label><input id="gr" value="${H(S.reward)}"></div><div><label>열기</label><select id="go"><option value="0">닫힘 (준비 중)</option><option value="1" ${S.open ? 'selected' : ''}>열림</option></select></div></div>
        <div class="row" style="margin-top:10px"><button class="btn" id="gSave">시즌 저장</button></div></div>
      <div class="panel"><h3>길드 (${DB.guilds.length})</h3><table><thead><tr><th>이름</th><th>길드장</th><th class="num">인원</th><th class="num">점수</th><th>만든 날</th><th></th></tr></thead><tbody>${DB.guilds.map((g) => `<tr><td>${H(g.name)}</td><td>${H(g.leader)}</td><td class="num">${g.members || 0}</td><td class="num">${fmtN(g.score)}</td><td>${fmtD(g.createdAt)}</td><td><button class="btn small red" data-del="${H(g.id)}">삭제</button></td></tr>`).join('') || '<tr><td colspan="6">아직 없어요</td></tr>'}</tbody></table>
        <div class="row" style="margin-top:10px"><input id="gn" placeholder="새 길드 이름"><input id="gl" placeholder="길드장 이메일"><button class="btn" id="gAdd">길드 만들기</button></div></div>`;
    $('gSave').onclick = async () => { const d = { season: $('gs').value, maxMembers: +$('gm').value, start: $('ga').value, end: $('gb').value, reward: $('gr').value, open: $('go').value === '1' }; if (await saveDoc('config', 'guild', d, false)) DB.config.guild = d; };
    $('gAdd').onclick = async () => { const n = $('gn').value.trim(); if (!n) return; const g = { name: n, leader: $('gl').value.trim(), members: 1, score: 0, createdAt: Date.now() }; const id = 'g' + Date.now(); if (await saveDoc('guilds', id, g, false)) { DB.guilds.push({ id, ...g }); VIEWS.guild(m); } };
    m.onclick = async (e) => { const b = e.target.closest('[data-del]'); if (!b || !confirm('이 길드를 지울까요?')) return; if (!isDemo()) await fb.db.collection('guilds').doc(b.dataset.del).delete(); DB.guilds = DB.guilds.filter((g) => g.id !== b.dataset.del); VIEWS.guild(m); };
  },
  ops(m) {
    const O = DB.config.ops || {};
    m.innerHTML = `<h2>운영</h2><div class="panel form"><h3>공지 · 점검</h3><label>공지 (첫 화면에 한 번 떠요, 비우면 없음)</label><input id="on" value="${H(O.notice || '')}" style="width:100%">
        <label><input type="checkbox" id="om" ${O.maintenance ? 'checked' : ''} style="width:auto"> 점검 모드 (관리자 말고는 게임을 못 해요)</label><label>점검 안내 글</label><input id="omm" value="${H(O.maintenanceMsg || '지금은 점검 중이에요. 잠시 뒤에 다시 와 주세요!')}" style="width:100%">
        <div class="row" style="margin-top:10px"><button class="btn" id="oSave">저장</button></div></div>
      <div class="panel"><h3>쿠폰</h3><p class="note">쿠폰 번호와 보상을 만들어 두는 곳이에요. (지금 게임 안 쿠폰 입력은 기존 쿠폰만 받아요 — 서버 쿠폰은 연결 후 열어요)</p>
        <table><thead><tr><th>번호</th><th>보상</th><th>한 사람 한 번</th><th>끝나는 날</th></tr></thead><tbody>${DB.coupons.map((c) => `<tr><td>${H(c.id)}</td><td>${c.gems ? '다이아 ' + c.gems : ''} ${c.coins ? '코인 ' + c.coins : ''}</td><td>${c.once ? '예' : '아니오'}</td><td>${H(c.until || '-')}</td></tr>`).join('') || '<tr><td colspan="4">아직 없어요</td></tr>'}</tbody></table>
        <div class="row" style="margin-top:10px"><input id="cc" placeholder="쿠폰 번호 (영어·숫자)"><input id="cg" class="num" type="number" placeholder="다이아"><input id="ck" class="num" type="number" placeholder="코인"><input id="cu" type="date"><button class="btn" id="cAdd">쿠폰 만들기</button></div></div>`;
    $('oSave').onclick = async () => { const d = { notice: $('on').value.trim(), maintenance: $('om').checked, maintenanceMsg: $('omm').value, updatedAt: Date.now() }; if (await saveDoc('config', 'ops', d, false)) DB.config.ops = d; };
    $('cAdd').onclick = async () => { const id = $('cc').value.trim().toUpperCase().replace(/\s/g, ''); if (!/^[A-Z0-9]{4,20}$/.test(id)) { toast('쿠폰 번호는 영어·숫자 4~20자'); return; } const c = { gems: +$('cg').value || 0, coins: +$('ck').value || 0, once: true, until: $('cu').value, createdAt: Date.now() }; if (await saveDoc('coupons', id, c, false)) { DB.coupons.push({ id, ...c }); VIEWS.ops(m); } };
  },
  // 게임 난이도·보상 기준: admin/balance/ (tools/balance_doc.mjs 가 게임 코드에서 만든 문서 · Word · PDF)
  async balance(m) {
    m.innerHTML = `<div class="row bd-bar"><h2>게임 난이도·보상 기준</h2><span class="note" id="bdDate"></span>
      <a class="btn" href="balance/balance.docx?v=${Date.now()}" download="게임_난이도_보상_기준.docx">Word</a>
      <a class="btn ghost" href="balance/balance.pdf?v=${Date.now()}" download="게임_난이도_보상_기준.pdf">PDF</a></div>
      <div class="panel" id="bdDoc"><p class="note">불러오는 중...</p></div>`;
    try {
      const d = await (await fetch('balance/balance.json?v=' + Date.now())).json();
      $('bdDate').textContent = `기준일 ${d.date}`; $('bdDoc').innerHTML = BalanceDoc.html(d);
    } catch (e) { $('bdDoc').innerHTML = `<p class="note">문서를 불러오지 못했어요: ${H(e.message)}</p>`; }
  },
  setup(m) {
    const ok = !!window.FIREBASE_CONFIG;
    m.innerHTML = `<h2>출시 준비 (구글 플레이)</h2><p class="note">자세한 순서는 저장소의 <code>server/README.md</code>에 있어요.</p><div class="check">
      <div class="${ok ? 'ok' : ''}">${ok ? '✅' : '⬜'} Firebase 프로젝트 만들고 common/firebase_config.js 에 넣기</div>
      <div>⬜ Firebase 로그인 방법 켜기: Google · 이메일/비밀번호 · 익명(게스트)</div>
      <div>⬜ Blaze 요금제로 바꾸고 서버 기능 올리기 (인증번호 메일) — 사용량이 적으면 무료 범위</div>
      <div>⬜ 메일 보낼 계정 정하기 (처음엔 Gmail 앱 비밀번호 → 나중엔 회사 도메인 메일)</div>
      <div>⬜ 약관·개인정보 처리방침의 [ ] 칸 채우기 (운영자 이름·연락처)</div>
      <div>⬜ Google Play Console 개발자 등록 (개인 계정 가능, 등록비 25달러)</div>
      <div>⬜ 웹 게임을 안드로이드 앱으로 감싸기 (TWA 또는 Capacitor) + 구글 플레이 결제 연결</div>
      <div>⬜ 개인 개발자 계정: 비공개 테스트 12명 × 14일 뒤 정식 출시 신청</div></div>`;
  },
};
boot();
