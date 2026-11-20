'use strict';
// 다운힐 러너 앱 백오피스 (https://downhill.brown-crab.com/admin/)
//  · 트윈 게임랜드 백오피스(admin/)와 따로. 같은 Firebase 프로젝트, 같은 관리자(Firestore admins/{이메일})
//  · 보는 것: users/{uid}.dh(다운힐 앱 칸) · records(game 'downhill-app') · names(app 'downhill') · config/downhill(공지·점검)
//  · 데이터 보호는 server/firestore.rules 가 함 (이 화면은 공개돼도 관리자가 아니면 아무것도 못 읽음)
const GAME = 'downhill-app';
const $ = (id) => document.getElementById(id);
const H = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtN = (n) => (+n || 0).toLocaleString('ko-KR');
const fmtD = (ms) => { if (!ms) return '-'; const d = new Date(ms); return `${d.getFullYear() % 100}.${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const day = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const toast = (m) => { const t = $('toast'); t.textContent = m; t.classList.remove('hidden'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 2400); };
const PROV = { google: '구글', email: '이메일', guest: '게스트' };
const CHAR = { eunyu: '여자', eungyeol: '남자' };
const sum = (a, f) => a.reduce((s, x) => s + (f(x) || 0), 0);
const lastDays = (n) => [...Array(n)].map((_, i) => day(Date.now() - (n - 1 - i) * 864e5));
const bars = (pairs, cls = '') => { const mx = Math.max(1, ...pairs.map((p) => p[1])); return `<div class="bars ${cls}">${pairs.map(([k, v]) => `<div style="height:${Math.max(2, (v / mx) * 100)}%" title="${k}: ${fmtN(v)}"><i>${v ? fmtN(v) : ''}</i><span>${k.slice(5)}</span></div>`).join('')}</div>`; };
const hbars = (pairs) => { const mx = Math.max(1, ...pairs.map((p) => p[1])); return pairs.map(([k, v]) => `<div class="hbar"><span>${H(k)}</span><div><i style="width:${(v / mx) * 100}%"></i></div><b>${fmtN(v)}</b></div>`).join(''); };

// ---------- 데이터 ----------
let fb = null;
const DB = { users: [], records: [], names: [], ops: {} };
async function loadAll() {
  const since = Date.now() - 31 * 864e5;
  const get = async (q) => (await q.get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  const [users, records, names, ops] = await Promise.all([
    get(fb.db.collection('users').where('dh.createdAt', '>', 0)),
    get(fb.db.collection('records').where('at', '>=', since)),
    get(fb.db.collection('names').where('app', '==', 'downhill')),
    fb.db.collection('config').doc('downhill').get(),
  ]);
  DB.users = users.map((u) => ({ ...u, dh: u.dh || {} }));
  DB.records = records.filter((r) => r.game === GAME);
  DB.names = names;
  DB.ops = ops.exists ? ops.data() : {};
}
async function save(col, id, data) { await fb.db.collection(col).doc(id).set(data, { merge: true }); toast('저장했어요'); }

// ---------- 로그인 (관리자만) ----------
const loadJs = (u) => new Promise((ok, no) => { const s = document.createElement('script'); s.src = u; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
async function boot() {
  for (const n of ['app', 'auth', 'firestore']) await loadJs(`https://www.gstatic.com/firebasejs/10.12.2/firebase-${n}-compat.js`);
  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.FIREBASE_CONFIG);
  fb = { auth: app.auth(), db: app.firestore() };
  fb.auth.onAuthStateChanged(async (u) => {
    $('btnLogin').classList.toggle('hidden', !!u && !u.isAnonymous); $('btnLogout').classList.toggle('hidden', !u || u.isAnonymous); $('who').textContent = u && !u.isAnonymous ? u.email : '';
    if (!u || u.isAnonymous) { $('tabs').innerHTML = ''; $('main').innerHTML = '<div class="gate"><h2>관리자 로그인</h2><p class="note">관리자 구글 계정으로 로그인해 주세요.</p></div>'; return; }
    let admin = false; try { admin = (await fb.db.collection('admins').doc(u.email).get()).exists; } catch (e) { /* 권한 없음 */ }
    if (!admin) { $('tabs').innerHTML = ''; $('main').innerHTML = `<div class="gate"><h2>관리자가 아니에요</h2><p class="note">${H(u.email)} 계정은 백오피스를 쓸 수 없어요.</p></div>`; return; }
    $('main').innerHTML = '<p class="note">불러오는 중...</p>';
    try { await loadAll(); renderTabs(); } catch (e) { $('main').innerHTML = `<div class="panel">불러오지 못했어요: ${H(e.message)}</div>`; }
  });
}
$('btnLogin').onclick = () => { if (!fb) return; const p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' }); fb.auth.signInWithPopup(p); };
$('btnLogout').onclick = () => fb && fb.auth.signOut();

// ---------- 탭 ----------
const TABS = [['dash', '대시보드'], ['users', '사용자'], ['rank', '기록·순위'], ['names', '이름'], ['ops', '운영 (공지·점검)']];
let tab = (location.hash || '#dash').slice(1);
function renderTabs() {
  $('tabs').innerHTML = TABS.map(([k, n]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${n}</button>`).join('') + '<button data-t="reload">새로고침</button>';
  $('tabs').onclick = async (e) => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    if (b.dataset.t === 'reload') { $('main').innerHTML = '<p class="note">불러오는 중...</p>'; await loadAll(); renderTabs(); return; }
    tab = b.dataset.t; history.replaceState(null, '', '#' + tab); renderTabs();
  };
  $('main').innerHTML = ''; (VIEWS[tab] || VIEWS.dash)($('main'));
}
const nameOf = (u) => u.dh.name || '(이름 없음)';
const VIEWS = {
  dash(m) {
    const U = DB.users, R = DB.records, today = day(Date.now()), d7 = Date.now() - 7 * 864e5, days = lastDays(14);
    m.innerHTML = `<h2>대시보드</h2><div class="cards">
      <div class="card"><small>전체 사용자</small><b>${fmtN(U.length)}</b></div>
      <div class="card"><small>오늘 접속</small><b>${fmtN(U.filter((u) => day(u.dh.lastAt || 0) === today).length)}</b></div>
      <div class="card"><small>7일 접속</small><b>${fmtN(U.filter((u) => (u.dh.lastAt || 0) >= d7).length)}</b></div>
      <div class="card"><small>7일 새 사용자</small><b>${fmtN(U.filter((u) => (u.dh.createdAt || 0) >= d7).length)}</b></div>
      <div class="card"><small>오늘 판 수</small><b>${fmtN(R.filter((r) => r.day === today).length)}</b></div>
      <div class="card"><small>30일 판 수</small><b>${fmtN(R.length)}</b></div>
      <div class="card"><small>30일 평균 거리</small><b>${fmtN(Math.round(sum(R, (r) => r.score) / Math.max(1, R.length)))}m</b></div>
      <div class="card"><small>최고 기록</small><b>${fmtN(Math.max(0, ...U.map((u) => u.dh.best || 0)))}m</b></div></div>
      <div class="panel barsx"><h3>날마다 판 수 (14일)</h3>${bars(days.map((d) => [d, R.filter((r) => r.day === d).length]))}</div>
      <div class="panel barsx"><h3>날마다 한 사람 수 (14일)</h3>${bars(days.map((d) => [d, new Set(R.filter((r) => r.day === d).map((r) => r.uid)).size]), 'blue')}</div>
      <div class="panel barsx"><h3>날마다 새 사용자 (14일)</h3>${bars(days.map((d) => [d, U.filter((u) => day(u.dh.createdAt || 0) === d).length]))}</div>
      <div class="grid2"><div class="panel"><h3>로그인 방식</h3>${hbars(Object.entries(PROV).map(([k, n]) => [n, U.filter((u) => u.provider === k).length]))}</div>
      <div class="panel"><h3>고른 캐릭터</h3>${hbars(Object.entries(CHAR).map(([k, n]) => [n, U.filter((u) => u.dh.char === k).length]))}</div></div>`;
  },
  users(m) {
    m.innerHTML = `<h2>사용자 (${fmtN(DB.users.length)}명)</h2><p class="note">정지하면 다음 접속부터 게임을 못 해요. '이름 다시 정하게'를 누르면 이름을 놓아주고, 그 사람은 다음 접속 때 새 이름을 정해요.</p>
      <div class="row"><input id="uq" type="text" placeholder="이름·이메일·uid 찾기"><select id="up"><option value="">모든 방식</option>${Object.entries(PROV).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select>
      <select id="us"><option value="lastAt">최근 접속순</option><option value="createdAt">가입순</option><option value="best">기록순</option><option value="plays">판 수순</option></select></div>
      <div class="panel"><table><thead><tr><th>이름</th><th>캐릭터</th><th>방식</th><th>이메일</th><th class="num">BEST</th><th class="num">판 수</th><th>가입</th><th>최근 접속</th><th>상태</th><th></th></tr></thead><tbody id="ub"></tbody></table></div>`;
    const draw = () => {
      const q = $('uq').value.trim().toLowerCase(), p = $('up').value, k = $('us').value;
      $('ub').innerHTML = DB.users.filter((u) => (!q || nameOf(u).toLowerCase().includes(q) || (u.email || '').includes(q) || u.id.toLowerCase().includes(q)) && (!p || u.provider === p))
        .sort((a, b) => (b.dh[k] || 0) - (a.dh[k] || 0)).slice(0, 500)
        .map((u) => `<tr><td><b>${H(nameOf(u))}</b><br><small style="color:#aaa">${H(u.id)}</small></td><td>${u.dh.char ? `<span class="tag ${u.dh.char}">${CHAR[u.dh.char]}</span>` : '-'}</td>
          <td><span class="tag ${u.provider}">${PROV[u.provider] || H(u.provider)}</span></td><td>${H(u.email || '-')}</td><td class="num">${fmtN(u.dh.best)}m</td><td class="num">${fmtN(u.dh.plays)}</td>
          <td>${fmtD(u.dh.createdAt)}</td><td>${fmtD(u.dh.lastAt)}</td><td>${u.status === 'banned' ? '<span class="tag banned">정지</span>' : '정상'}${u.memo ? `<br><small>${H(u.memo)}</small>` : ''}</td>
          <td><button class="btn small ${u.status === 'banned' ? 'gray' : 'red'}" data-ban="${H(u.id)}">${u.status === 'banned' ? '정지 풀기' : '정지'}</button> <button class="btn small gray" data-memo="${H(u.id)}">메모</button> <button class="btn small gray" data-rec="${H(u.id)}">기록</button> <button class="btn small gray" data-rename="${H(u.id)}">이름 다시 정하게</button></td></tr>`).join('') || '<tr><td colspan="10">아직 사용자가 없어요</td></tr>';
    };
    m.oninput = draw; draw();
    m.onclick = async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const u = DB.users.find((x) => x.id === (b.dataset.ban || b.dataset.memo || b.dataset.rec || b.dataset.rename)); if (!u) return;
      if (b.dataset.ban) { const st = u.status === 'banned' ? 'active' : 'banned'; if (st === 'banned' && !confirm(`${nameOf(u)} 계정을 정지할까요?`)) return; await save('users', u.id, { status: st }); u.status = st; draw(); }
      if (b.dataset.memo) { const t = prompt('메모 (관리자만 보여요)', u.memo || ''); if (t !== null) { await save('users', u.id, { memo: t }); u.memo = t; draw(); } }
      if (b.dataset.rec) { const R = DB.records.filter((x) => x.uid === u.id).sort((a, c) => c.at - a.at).slice(0, 50); alert(R.length ? R.map((x) => `${fmtD(x.at)}  ${fmtN(x.score)}m  (${x.zone || 1}판까지)`).join('\n') : '최근 30일 기록이 없어요'); }
      if (b.dataset.rename) {
        if (!u.dh.name || !confirm(`'${u.dh.name}' 이름을 놓아주고, 다음 접속 때 새 이름을 정하게 할까요?`)) return;
        const key = String(u.dh.name).normalize('NFC').replace(/\s+/g, '').toLowerCase().replace(/\//g, '_');
        try { const s = await fb.db.collection('names').doc(key).get(); if (s.exists && s.data().uid === u.id) await fb.db.collection('names').doc(key).delete(); } catch (x) { /* ignore */ }
        await save('users', u.id, { dh: { name: '' } }); u.dh.name = ''; draw();
      }
    };
  },
  rank(m) {
    const top = DB.users.filter((u) => u.dh.best > 0 && u.status !== 'banned').sort((a, b) => b.dh.best - a.dh.best).slice(0, 50);
    const recent = [...DB.records].sort((a, b) => b.at - a.at).slice(0, 100);
    m.innerHTML = `<h2>기록·순위</h2><div class="grid2">
      <div class="panel"><h3>BEST 순위 (전체, 50등까지)</h3><table><thead><tr><th class="num">등수</th><th>이름</th><th class="num">BEST</th><th class="num">판 수</th></tr></thead><tbody>
        ${top.map((u, i) => `<tr><td class="num">${i + 1}</td><td>${H(nameOf(u))}</td><td class="num">${fmtN(u.dh.best)}m</td><td class="num">${fmtN(u.dh.plays)}</td></tr>`).join('') || '<tr><td colspan="4">아직 기록이 없어요</td></tr>'}</tbody></table></div>
      <div class="panel"><h3>최근 판 (100개)</h3><table><thead><tr><th>시각</th><th>이름</th><th class="num">거리</th><th class="num">판</th><th class="num">코인</th></tr></thead><tbody>
        ${recent.map((r) => `<tr><td>${fmtD(r.at)}</td><td>${H(r.name || '-')}</td><td class="num">${fmtN(r.score)}m</td><td class="num">${r.zone || 1}</td><td class="num">${fmtN(r.coins)}</td></tr>`).join('') || '<tr><td colspan="5">최근 30일 기록이 없어요</td></tr>'}</tbody></table></div></div>`;
  },
  names(m) {
    const by = Object.fromEntries(DB.users.map((u) => [u.id, u]));
    m.innerHTML = `<h2>이름 (${fmtN(DB.names.length)}개)</h2><p class="note">다운힐 앱에서 만든 이름이에요. 같은 이름은 하나만 쓸 수 있어요 (트윈 게임랜드 사이트 이름과도 겹치지 않게 같은 목록을 써요).</p>
      <div class="panel"><table><thead><tr><th>이름</th><th>주인 uid</th><th>방식</th><th>만든 때</th></tr></thead><tbody>
      ${[...DB.names].sort((a, b) => (b.at || 0) - (a.at || 0)).map((n) => `<tr><td>${H(n.name)}</td><td><small>${H(n.uid)}</small></td><td>${by[n.uid] ? PROV[by[n.uid].provider] || '' : '-'}</td><td>${fmtD(n.at)}</td></tr>`).join('') || '<tr><td colspan="4">아직 이름이 없어요</td></tr>'}</tbody></table></div>`;
  },
  ops(m) {
    const o = DB.ops;
    m.innerHTML = `<h2>운영 (공지·점검)</h2><p class="note">앱을 열 때 읽어요. 공지는 접속할 때 한 번 아래에 잠깐 떠요. 점검 중이면 게임을 못 하고 안내 글만 보여요.</p>
      <div class="panel"><h3>공지</h3><textarea id="opNotice" placeholder="비워 두면 공지 없음">${H(o.notice || '')}</textarea>
      <h3>점검</h3><label><input type="checkbox" id="opMaint" ${o.maintenance ? 'checked' : ''}> 점검 중 (게임 막기)</label>
      <textarea id="opMsg" placeholder="점검 안내 글 (비워 두면 '지금은 점검 중이에요. 잠시 뒤에 다시 와 주세요!')" style="margin-top:8px">${H(o.maintenanceMsg || '')}</textarea>
      <p><button class="btn" id="opSave">저장</button></p></div>`;
    $('opSave').onclick = async () => {
      const d = { notice: $('opNotice').value.trim(), maintenance: $('opMaint').checked, maintenanceMsg: $('opMsg').value.trim(), at: Date.now() };
      if (d.maintenance && !confirm('점검 중으로 바꾸면 지금부터 아무도 게임을 못 해요. 저장할까요?')) return;
      await save('config', 'downhill', d); DB.ops = d;
    };
  },
};
boot().catch((e) => { $('main').innerHTML = `<div class="panel">시작하지 못했어요: ${H(e.message)}</div>`; });
