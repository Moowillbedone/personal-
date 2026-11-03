/* CT-05 원생 등록·법정대리인 동의 (p.49), CT-06 원생 상세 (p.50, 51), CT-07 수강 등록·수납 (p.52). */
(function () {
  const B = window.B, h = B.h, esc = B.esc;

  /* ---------------- 공통 값과 날짜 계산 ---------------- */
  const TODAY = '2027-03-08', NOW = '2027-03-08 11:52';
  const HOLI = { '2027-03-01': '삼일절' };
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const DMAP = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
  const VER = 'v1';
  const BOOK = 15000, TESTFEE = 20000;
  const PHONE = /^01[016789]-?\d{3,4}-?\d{4}$/;
  const pad = n => String(n).padStart(2, '0');
  const D = s => { const a = String(s).split('-').map(Number); return new Date(Date.UTC(a[0], a[1] - 1, a[2])); };
  const F = d => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  const okDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(D(s).getTime());
  const addDays = (s, n) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return F(d); };
  const addMonths = (s, n) => { const d = D(s); d.setUTCMonth(d.getUTCMonth() + n); return F(d); };
  const between = (a, b) => Math.round((D(b) - D(a)) / 864e5);
  const dow = s => D(s).getUTCDay();
  const dim = ym => { const a = ym.split('-').map(Number); return new Date(Date.UTC(a[0], a[1], 0)).getUTCDate(); };
  const nextYm = ym => { const a = ym.split('-').map(Number); return a[1] === 12 ? (a[0] + 1) + '-01' : a[0] + '-' + pad(a[1] + 1); };
  const prevYm = ym => { const a = ym.split('-').map(Number); return a[1] === 1 ? (a[0] - 1) + '-12' : a[0] + '-' + pad(a[1] - 1); };
  const md = s => String(s || '').slice(5);
  const mon = ym => Number(String(ym).slice(5, 7)) + '월';
  const digits = s => String(s || '').replace(/\D/g, '');
  const floor10 = n => Math.floor(n / 10) * 10;
  const num = h.num, money = h.money;
  function age(birth) {
    if (!okDate(birth)) return null;
    const b = birth.split('-').map(Number), t = TODAY.split('-').map(Number);
    let a = t[0] - b[0]; if (t[1] < b[1] || (t[1] === b[1] && t[2] < b[2])) a--; return a;
  }
  const clsDays = c => (c ? String(c.days).split('·').map(x => DMAP[x.trim()]).filter(x => x != null) : []);
  function sessions(c, ym) {
    const out = [], days = clsDays(c);
    for (let i = 1; i <= dim(ym); i++) { const d = ym + '-' + pad(i); if (!HOLI[d] && days.includes(dow(d))) out.push(d); }
    return out;
  }
  const ST_TONE = { '재원': 'ok', '수납 대기': 'warn', '휴원': 'warn', '휴원 예정': 'warn', '퇴원 예정': 'p2', '퇴원': 'p2', '상담': 'info', '대기': 'info' };
  const stChip = t => h.chip(t, ST_TONE[t] || '');
  const acctLabel = a => (!a || a === '-' ? '계정 없음' : '계정 ' + a);
  const acctTone = a => (a === '활성' ? 'ok' : a === '정지' ? 'warn' : a === '가오픈' ? 'info' : '');

  /* ---------------- 이 파일 전용 스타일 ---------------- */
  (function () {
    if (document.getElementById('ctb-style')) return;
    const css = [
      '.ctb-fr{display:grid;grid-template-columns:96px minmax(0,1fr);gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line-2)}',
      '.ctb-fr:last-child{border-bottom:0}',
      '.ctb-fr>label{font-size:11.5px;font-weight:700;color:var(--sub)}',
      '.ctb-fr>label .req{color:var(--brand);margin-left:2px}',
      '.ctb-fr.rv{background:var(--review-soft);border-radius:8px;padding:7px 8px;margin:4px 0;border-bottom:0}',
      '.ctb-in{display:flex;gap:8px;align-items:center;flex-wrap:wrap;min-width:0}',
      '.ctb-in>.inp{width:auto;flex:1 1 140px;min-width:0}',
      '.ctb-err{font-size:11px;color:var(--bad);font-weight:600;margin-top:3px}',
      '.ctb-hint{font-size:11px;color:var(--sub);margin-top:3px}',
      '.ctb-fr.rv .ctb-hint{color:#4a25a8}',
      '.ctb-chk{display:inline-flex;gap:6px;align-items:center;font-size:12.3px;white-space:nowrap}',
      '.ctb-link{display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:#fff;border:1px solid var(--line);border-radius:10px;padding:9px 14px;font-size:12.5px}',
      '.ctb-sub{margin-top:10px;border-radius:8px;padding:9px 11px;font-size:12.3px;display:flex;flex-direction:column;gap:7px;background:var(--bg)}',
      '.ctb-sub.review{background:var(--review-soft);color:#3c2a78}',
      '.ctb-next{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 14px;font-size:12.3px}',
      '.ctb-strike{text-decoration:line-through;color:var(--mute);font-size:12px}',
      '.ctb-ul{margin:0;padding-left:16px}',
      '.ctb-sh-top{display:flex;gap:10px;align-items:center;flex-wrap:wrap}',
      '.ctb-who{display:flex;gap:6px;align-items:center;flex-wrap:wrap;min-width:0}',
      '.ctb-nm{font-size:17px;font-weight:800;margin-right:2px}',
      '.ctb-nav{display:flex;gap:2px;border-top:1px solid var(--line-2);margin-top:12px;padding-top:8px;flex-wrap:wrap}',
      '.ctb-sec{background:none;border:0;border-radius:7px;padding:5px 11px;font-size:12.5px;font-weight:700;color:var(--mute)}',
      '.ctb-sec:hover{background:var(--line-2)}',
      '.ctb-sec.on{background:var(--brand-soft);color:var(--brand)}',
      '.ctb-cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border:1px solid var(--line);border-radius:9px;overflow:hidden;font-size:11.5px}',
      '.ctb-cal>div{border-right:1px solid var(--line-2);border-bottom:1px solid var(--line-2);min-height:40px;padding:4px 6px;display:flex;flex-direction:column;gap:1px;background:#fff}',
      '.ctb-cal>div:nth-child(7n){border-right:0}',
      '.ctb-cal>div.hd{min-height:0;background:#f7f8fa;font-weight:700;color:var(--sub);text-align:center;display:block;padding:4px}',
      '.ctb-cal>div.blank{background:#fafbfc}',
      '.ctb-cal .mk{font-weight:700;font-size:11px}',
      '.ctb-cal .k-공휴{color:var(--mute);background:#fafafb}',
      '.ctb-cal .k-출석 .mk{color:var(--ok)}',
      '.ctb-cal .k-결석{background:#fff8f7}.ctb-cal .k-결석 .mk{color:var(--bad)}',
      '.ctb-cal .k-보강 .mk{color:var(--info)}',
      '.ctb-cal .k-예정 .mk{color:#aab1bd;font-weight:600}',
      '.ctb-cal .click{cursor:pointer}.ctb-cal .click:hover{background:#ffeceb}',
      '.ctb-cal .today{box-shadow:inset 0 0 0 2px var(--navy)}',
      '.ctb-cal .sel{box-shadow:inset 0 0 0 2px var(--bad)}',
      '.ctb-two{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:12px;align-items:start}',
      '.ctb-sum{display:flex;flex-direction:column;gap:5px;font-size:12.5px}',
      '.ctb-sum>div{display:flex;justify-content:space-between;gap:10px}',
      '.ctb-sum .money{font-weight:600}',
      '.ctb-sum .tot{border-top:1px solid var(--line);padding-top:7px;margin-top:3px;font-size:14.5px;font-weight:800}',
      '.ctb-rad{font-size:14px;color:var(--navy)}',
      '.tbl tr.ctb-off td{color:var(--mute);background:#fafbfc}',
      '.ctb-pay{display:flex;flex-direction:column;gap:2px;font-size:12px;color:var(--sub)}',
      '.ctb-pay b{color:var(--ink)}',
      '.ctb-pay .on{color:var(--ink);font-weight:600}',
      '.ctb-rcpt{border:1px dashed #c9ced8;border-radius:9px;padding:10px 12px;background:#fcfcfd}',
    ].join('\n');
    const el = document.createElement('style'); el.id = 'ctb-style'; el.textContent = css; document.head.appendChild(el);
  })();

  /* ---------------- 입력 부품 (이 파일 전용) ---------------- */
  function inp(o) {
    return '<input class="inp' + (o.err ? ' bad' : '') + '" type="' + (o.type || 'text') + '" data-field="' + o.f + '" value="' + esc(o.v == null ? '' : o.v) + '"' +
      (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.dis ? ' disabled' : '') + (o.w ? ' style="max-width:' + o.w + '"' : '') + ' aria-label="' + esc(o.label || o.ph || o.f) + '">';
  }
  function sel(o) {
    return '<select class="inp' + (o.err ? ' bad' : '') + '" data-field="' + o.f + '"' + (o.dis ? ' disabled' : '') + (o.w ? ' style="max-width:' + o.w + '"' : '') + ' aria-label="' + esc(o.label || o.f) + '">' +
      o.opts.map(x => { const v = typeof x === 'string' ? x : x.v, l = typeof x === 'string' ? x : x.l; return '<option value="' + esc(v) + '"' + (String(v) === String(o.v) ? ' selected' : '') + (typeof x === 'object' && x.dis ? ' disabled' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>';
  }
  const chk = (f, on, label, dis) => '<label class="ctb-chk"><input type="checkbox" data-field="' + f + '"' + (on ? ' checked' : '') + (dis ? ' disabled' : '') + '> ' + esc(label) + '</label>';
  function fr(label, inner, o) {
    o = o || {};
    return '<div class="ctb-fr' + (o.rv ? ' rv' : '') + '"' + h.p(o.pin) + '><label>' + esc(label) + (o.req ? '<span class="req">*</span>' : '') + '</label><div><div class="ctb-in">' + inner + '</div>' +
      (o.err ? '<div class="ctb-err">' + esc(o.err) + '</div>' : '') + (o.hint ? '<div class="ctb-hint">' + esc(o.hint) + '</div>' : '') + '</div></div>';
  }
  const form = rows => '<div>' + rows.join('') + '</div>';
  const rowEnd = inner => '<div class="row" style="justify-content:flex-end;margin-top:10px">' + inner + '</div>';
  function pickSel(id, list, cur) {
    return '<select class="inp" id="' + id + '" style="width:auto;min-width:170px" aria-label="원생 고르기">' +
      list.map(x => '<option value="' + esc(x.id) + '"' + (x.id === cur ? ' selected' : '') + '>' + esc(x.label) + '</option>').join('') + '</select>';
  }
  // 날짜나 체크를 바꾸면 계산을 다시 그려야 하는 칸
  function live(root, id, keys) {
    keys.forEach(k => Array.prototype.forEach.call(root.querySelectorAll('[data-field="' + k + '"]'), el => el.addEventListener('change', () => {
      const ui = B.store.ui[id] = B.store.ui[id] || {};
      ui[k] = el.type === 'checkbox' ? el.checked : el.value; B.render();
    })));
  }
  // 데모가 다른 화면 단계에서 동작을 불러도 그 화면의 입력 상태와 권한으로 돌게 해요
  function sc(ctx, id) {
    const lvl = B.perm(id, ctx.persona);
    return Object.assign({}, ctx, { ui: (ctx.s.ui[id] = ctx.s.ui[id] || {}), perm: lvl, canEdit: lvl === '●' || lvl === '◐', readOnly: lvl === '○', partial: lvl === '◐' });
  }
  const A5 = (n, fn) => B.action(n, (ctx, a, el) => fn(sc(ctx, 'CT-05'), a, el));
  const A6 = (n, fn) => B.action(n, (ctx, a, el) => fn(sc(ctx, 'CT-06'), a, el));
  const A7 = (n, fn) => B.action(n, (ctx, a, el) => fn(sc(ctx, 'CT-07'), a, el));
  function goOr(id, msg) { if (B.screens[id]) { B.go(id); return false; } B.toast(msg); return undefined; }

  /* ---------------- 예시 데이터 ---------------- */
  B.extend(s => {
    // 오늘 동의까지 마치고 수납을 기다리는 원생 (최도현 s7의 동생, 보호자 같음)
    s.students.push({ id: 'sx1', center: 'daechi1', name: '최서아', grade: '초4', level: 'L2', cls: '', status: '수납 대기', guardian: '최지혜', phone: '010-6630-1122', since: '', product: '', account: '-', paid: '-', consent: { date: '2027-03-08', method: '휴대폰 본인인증', version: 'v1' } });
    s.reservations.push({ id: 'rx1', center: 'daechi1', at: '03-08 10:00', student: '최서아', grade: '초4', kind: '입학 테스트', route: '방문', guardianPhone: '010-6630-1122', status: '완료', result: '등록' });
    s.ct05 = { info: { sx1: { test: '2027-03-08', level: 'L2', brain: '○○형', sibling: 's7', school: '○○초', from: 'rx1', items: { privacy: true, entrust: true, alim: true, mkt: false } } } };
    s.ct06 = {
      hist: {
        s1: [
          { m: '2027-03', pid: 'pr1', fee: 260000, disc: '', paid: 260000, date: '03-02', acct: '활성', method: '결제선생 링크', book: 15000 },
          { m: '2027-02', pid: 'pr1', fee: 260000, disc: '', paid: 260000, date: '01-27', acct: '활성', method: '카드', book: 15000 },
          { m: '2027-01', pid: 'pr1', fee: 260000, disc: '테스트비 차감 20,000', paid: 240000, date: '01-04', acct: '활성', method: '카드', book: 15000 },
        ],
      },
      log: {
        s1: [
          { at: '2027-03-02', what: '3월 수강권 시작', by: '시스템' },
          { at: '2027-02-01', what: '2월 수강권 시작', by: '시스템' },
          { at: '2027-01-04', what: '원생 등록, L2-화목A 배정, 법정대리인 동의 (휴대폰 본인인증, v1)', by: '원장 김지원' },
        ],
      },
      att: { s1: { '2027-03-04': '결석' } },
      mk: {}, st: {}, req: {}, cons: {},
    };
    s.ct07 = { flow: {}, want: {} };
  });

  /* ---------------- 공용 조회 ---------------- */
  const cent = (s, id) => s.centers.find(c => c.id === id) || {};
  const prodName = (s, pid) => (s.products.find(p => p.id === pid) || {}).name || '-';
  // 직영은 원문 52쪽 본사 확정가 표, 가맹은 센터가 정한 교습비
  function catalog(s, center) {
    if (!center || center.type === '직영') return [
      { pid: 'pr3', name: '주 1회 · 90분', fee: 150000, edu: 150000 },
      { pid: 'pr1', name: '주 2회 · 90분', fee: 260000, edu: 280000 },
      { pid: 'pr2', name: '주 3회 · 90분', fee: 360000, edu: 340000, eduNew: 360000, filing: true },
    ];
    return ['pr3', 'pr1', 'pr2'].map(id => s.products.find(p => p.id === id)).filter(Boolean)
      .map(p => ({ pid: p.id, name: p.name, fee: (p.centerPrice || {})[center.id] || p.recommend, edu: (p.edu || {})[center.id] || 0 }));
  }
  const lockOf = r => (r.filing ? '신고 중' : r.fee > r.edu ? '등록액 초과' : '');
  function dataFee(s, st) { const p = s.products.find(x => x.id === st.product); if (!p) return 0; const c = cent(s, st.center); return c.type === '직영' ? p.direct : ((p.centerPrice || {})[c.id] || p.recommend); }
  function ensure(s) { s.ct06 = s.ct06 || {}; ['hist', 'log', 'att', 'mk', 'st', 'req', 'cons', 'moves'].forEach(k => { s.ct06[k] = s.ct06[k] || {}; }); s.ct05 = s.ct05 || { info: {} }; s.ct05.info = s.ct05.info || {}; s.ct07 = s.ct07 || { flow: {}, want: {} }; }
  function hist(s, st) {
    ensure(s);
    if (s.ct06.hist[st.id]) return s.ct06.hist[st.id];
    const rows = [];
    if (st.since && st.product) {
      const fee = dataFee(s, st), first = st.since.slice(0, 7), end = first > '2027-03' ? first : '2027-03';
      const months = []; for (let ym = first; ym <= end && months.length < 12; ym = nextYm(ym)) months.push(ym);
      months.forEach((m, i) => {
        const last = i === months.length - 1, pay = m === '2027-03' ? s.payments.find(p => p.student === st.id) : null;
        const unpaid = st.paid === '미수' && last;
        rows.unshift({ m, pid: st.product, fee, disc: i === 0 ? '테스트비 차감 20,000' : '', paid: unpaid ? null : fee - (i === 0 ? TESTFEE : 0),
          date: unpaid ? '' : i === 0 ? md(st.since) : pay ? pay.date : md(prevYm(m) + '-25'), acct: last && st.account !== '활성' ? (st.account === '-' ? '없음' : st.account) : '활성',
          method: pay ? pay.method : '카드', book: BOOK });
      });
    }
    s.ct06.hist[st.id] = rows; return rows;
  }
  function stOf(s, st) {
    ensure(s);
    if (!s.ct06.st[st.id]) {
      const o = {};
      if (/휴원/.test(st.status)) o.leave = { from: '2027-03-02', to: '2027-03-31', carry: '다음 달 차감', at: '2027-03-02' };
      if (/퇴원/.test(st.status)) o.out = { date: '2027-03-31', reason: '학원 일정 겹침', occur: '2027-03-05', refund: '환불 없음', at: '2027-03-05' };
      s.ct06.st[st.id] = o;
    }
    return s.ct06.st[st.id];
  }
  function logs(s, st) {
    ensure(s);
    if (s.ct06.log[st.id]) return s.ct06.log[st.id];
    const out = [], c = s.classes.find(x => x.id === st.cls), dir = '원장 ' + (cent(s, st.center).director || '');
    if (st.since) {
      out.push({ at: st.since, what: '원생 등록' + (c ? ', ' + c.name + ' 배정' : ''), by: dir });
      hist(s, st).slice(0, -1).forEach(r => out.push({ at: r.m === '2027-03' ? '2027-03-02' : r.m + '-01', what: mon(r.m) + ' 수강권 시작', by: '시스템' }));
    }
    const S = stOf(s, st);
    if (S.leave) out.push({ at: S.leave.at, what: '휴원 시작 (' + md(S.leave.from) + ' ~ ' + md(S.leave.to) + ', ' + S.leave.carry + ')', by: dir });
    if (S.out) out.push({ at: S.out.at, what: '퇴원 처리 (퇴원일 ' + S.out.date + ', ' + S.out.reason + ')', by: dir });
    out.sort((a, b) => (a.at < b.at ? 1 : -1));
    s.ct06.log[st.id] = out; return out;
  }
  const addLog = (ctx, st, what) => { logs(ctx.s, st).unshift({ at: TODAY, what, by: ctx.role + ' ' + ctx.persona.name }); };
  function testInfo(s, st) {
    ensure(s);
    const info = s.ct05.info[st.id];
    let date = info && info.test;
    if (!date) { const r = s.reservations.find(x => x.center === st.center && x.student === st.name && /테스트/.test(x.kind) && x.status === '완료'); if (r) date = '2027-' + r.at.slice(0, 5); }
    return date ? { date, valid: addDays(date, 30) >= TODAY } : null;
  }

  // 반 이동 기록을 거꾸로 따라가서 그날 다니던 반을 찾아요
  function clsOn(s, st, d) {
    ensure(s);
    let id = st.cls;
    (s.ct06.moves[st.id] || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1)).forEach(m => { if (m.date > d) id = m.from; });
    return s.classes.find(x => x.id === id) || null;
  }

  /* ======================================================================
     CT-05 원생 등록·법정대리인 동의
     ====================================================================== */
  function c05init(ctx) {
    const ui = ctx.ui, s = ctx.s;
    if (!ui._init) {
      ui._init = true;
      if (ui.name == null) {
        const r = s.reservations.find(x => x.id === 'r1' && x.center === ctx.centerId);
        if (r) Object.assign(ui, { from: r.id, name: r.student, grade: r.grade, phone: r.guardianPhone });
      }
    }
    if (ui._from !== ui.from) {
      if ('_from' in ui) ['verified', 'dup', 'dupChoice', 'e', 'c_privacy', 'c_entrust', 'c_mkt', 'consent', '_rcUsed', 'birth'].forEach(k => { delete ui[k]; });
      ui._from = ui.from;
    }
    const g = Number(String(ui.grade || '초4').replace(/\D/g, '')) || 4;
    const d = { name: '', grade: '초4', phone: '', birth: (2021 - g) + '-05-12', school: '', g_name: '', g_rel: '모', alim: true, method: '휴대폰 본인인증', c_privacy: false, c_entrust: false, c_mkt: false };
    Object.keys(d).forEach(k => { if (ui[k] == null) ui[k] = d[k]; });
    if (ui.g_name) ui.guardian = ui.g_name; // 학부모 휴대폰(PA-01)이 보호자 이름을 읽어 가요
    // 원생 상세(CT-06) 재입학으로 들어오면 예전 기록을 찾아 다시 등록을 골라 둬요
    if (/^readmit:/.test(ui.from || '') && !ui.dup) { findDup(ctx); if (ui.dup.same) ui.dupChoice = '기존 원생 다시 등록'; }
    // 보호자가 자기 휴대폰(PA-01)에서 동의를 마치면 그 결과를 받아요
    const rc = ui.consent, gn = String(ui.g_name || '').trim();
    if (rc && rc.status === '인증 완료' && (!rc.student || rc.student === 'reg') && !ui._rcUsed) {
      ui.c_privacy = true; ui.c_entrust = true;
      if (rc.marketing) ui.c_mkt = !!(rc.marketing.alim || rc.marketing.sms);
      if (gn && PHONE.test(ui.phone || '')) { ui.verified = { name: gn, phone: ui.phone, method: (rc.method || '휴대폰 본인인증') + ' (보호자 휴대폰)', at: rc.at || NOW }; ui._rcUsed = true; }
    }
  }
  function notice(c) {
    const t = c ? c.type : '직영';
    if (t === '직영') return { proc: 'MSC Brain (본사가 직접 운영하는 직영 센터)', trust: '결제선생 (결제), 알림톡 발송사 (발송)', kind: '직영용 문안' };
    const pay = c.pay === '결제선생';
    return { proc: c.name + ' (가맹 사업자, 원장 ' + c.director + ')', trust: 'MSC Brain (시스템 운영), ' + (pay ? '결제선생 (결제, 재수탁), ' : '') + '알림톡 발송사 (발송, 재수탁)', kind: (t === '테스트베드' ? '테스트베드' : '가맹') + '용 문안', note: pay ? '' : '결제선생을 쓰지 않는 센터라 수탁자에서 결제선생을 뺐어요. ' };
  }
  function findDup(ctx) {
    const ui = ctx.ui, s = ctx.s, ph = digits(ui.phone);
    const list = ph.length >= 10 ? s.students.filter(x => x.center === ctx.centerId && digits(x.phone) === ph) : [];
    const same = list.find(x => x.name === String(ui.name || '').trim());
    // 이름까지 같은데 아직 다니는 원생이면 새로 만들지 않고 원생 상세로 보내요. 퇴원했거나 퇴원 예정이면 다시 등록할 수 있어요.
    const active = same && !/퇴원/.test(same.status) ? same : null;
    ui.dup = { phone: ph, ids: list.map(x => x.id), same: same && !active ? same.id : null, active: active ? active.id : null };
    const okChoices = active ? [] : same ? ['기존 원생 다시 등록', '새로 만들기'] : ['형제로 연결', '새로 만들기'];
    if (!list.length || !okChoices.includes(ui.dupChoice)) ui.dupChoice = null;
  }
  function doVerify(ctx, res) {
    const ui = ctx.ui; ui.e = ui.e || {};
    const gn = String(ui.g_name || '').trim();
    if (!gn || !PHONE.test(ui.phone || '')) { ui.verified = null; ui.e.verify = '보호자 이름과 휴대폰 번호를 먼저 넣어 주세요.'; return false; }
    if (ui.method === '서면 동의서') { ui.verified = { name: gn, phone: ui.phone, method: '서면 동의서', at: NOW, file: '서면동의서_' + (ui.name || '원생') + '.jpg' }; delete ui.e.verify; return true; }
    const r = res && typeof res === 'object' && res.name ? { name: res.name, phone: res.phone || ui.phone } : { name: gn, phone: ui.phone };
    if (r.name !== gn || digits(r.phone) !== digits(ui.phone)) {
      ui.verified = null; ui.e.verify = '인증한 사람(' + h.mask(r.name) + ', ' + h.maskPhone(r.phone) + ')이 입력한 보호자와 달라요. 보호자 본인이 다시 인증해야 저장돼요.'; return false;
    }
    ui.verified = { name: r.name, phone: r.phone, method: ui.method, at: NOW }; delete ui.e.verify; return true;
  }

  function dupBox(ctx) {
    const ui = ctx.ui, s = ctx.s, d = ui.dup, ro = !ctx.canEdit, e = ui.e || {};
    const fresh = d && d.phone === digits(ui.phone);
    let inner;
    if (!fresh) inner = '<div class="row"><span>보호자 번호로 이미 다니는 원생과 형제를 찾아요.</span>' + h.btn('기존 기록 찾기', { sm: true, act: 'CT05.findDup', disabled: ro }) + '</div>';
    else if (!d.ids.length) inner = '<span>같은 번호로 등록된 원생이 없어요. 새 원생으로 만들어요.</span>';
    else {
      const list = d.ids.map(id => s.students.find(x => x.id === id)).filter(Boolean);
      inner = '<div><b>같은 보호자 번호로 등록된 원생</b> ' + list.map(x => esc(h.mask(x.name)) + ' (' + esc(x.grade) + ', ' + esc(x.status) + ')').join(', ') + '</div>' +
        (d.active ? '<div class="row"><span>이름까지 같은 원생이 이미 다니고 있어요. 새로 만들지 않고 원생 상세에서 확인해요.</span>' + h.btn('원생 상세 보기', { sm: true, act: 'CT05.toDetail', arg: d.active }) + '</div>' : h.opts((d.same ? ['기존 원생 다시 등록', '새로 만들기'] : ['형제로 연결', '새로 만들기']).map(v => ({ v, l: v, dis: ro })), ui.dupChoice || '', { act: 'CT05.dupChoice' }) +
        (ui.dupChoice === '형제로 연결' ? '<div class="small">보호자를 한 번만 저장하고 두 아이를 묶어요. 수강 등록에서 형제 할인 10%(예시)와 사유가 바로 채워져요.</div>' : '') +
        (ui.dupChoice === '기존 원생 다시 등록' ? '<div class="small">예전 기록에 이어서 등록하고, 동의는 지금 문안으로 다시 받아요.</div>' : ''));
    }
    return '<div class="ctb-sub review"' + h.p(8) + '>' + inner + (e.dup ? '<div class="ctb-err">' + esc(e.dup) + '</div>' : '') + '</div>';
  }

  function c05render(ctx) {
    c05init(ctx);
    const s = ctx.s, ui = ctx.ui, e = ui.e || {}, ro = !ctx.canEdit;
    const a = age(ui.birth);
    const r = s.reservations.find(x => x.id === ui.from);
    const readmit = /^readmit:/.test(ui.from || '') ? s.students.find(x => x.id === ui.from.slice(8)) : null;
    const level = ui.level || (readmit ? readmit.level : r ? 'L2' : '');
    const waitCls = /^waitlist:/.test(ui.from || '') && ui.cls ? s.classes.find(x => x.id === ui.cls) : null;
    let html = '';
    const errs = Object.keys(e).map(k => e[k]).filter(Boolean);
    if (errs.length) html += '<div style="margin-bottom:12px">' + h.alert('<ul class="ctb-ul">' + errs.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>', 'bad', { title: '저장하지 못했어요', raw: true }) + '</div>';

    // 1 테스트 결과 연결
    html += '<div class="ctb-link"' + h.p(1) + '><b>입학 테스트 결과 연결</b>' +
      (r ? '<span>' + esc(h.mask(r.student)) + '</span><span class="muted">' + esc(ui.testDate || '2027-' + r.at.slice(0, 5)) + ' ' + esc(r.kind) + '</span>' + h.chip('레벨 ' + level, 'navy') + h.chip(ui.testType || '○○형', 'navy') + '<span class="muted small">테스트 결과에서 레벨과 두뇌 유형을 채웠어요. 다시 입력하지 않아요.</span>'
        : waitCls ? '<span>' + esc(h.mask(ui.name)) + '</span>' + h.chip('대기 명단에서 등록', 'info') + h.chip('희망 반 ' + waitCls.name, 'navy') + '<span class="muted small">수강 등록에서 이 반을 먼저 골라 둬요. 레벨은 테스트를 보면 바뀌어요.</span>'
        : readmit ? '<span>' + esc(h.mask(readmit.name)) + '</span>' + h.chip('재입학', 'review') + '<span class="muted small">예전 레벨 ' + esc(readmit.level) + '을 불러왔어요. 다시 테스트하면 결과로 바뀌어요.</span>'
          : '<span class="muted">연결된 결과가 없어요. 상담·테스트 예약(CT-02)에서 등록 결과를 붙이면 여기로 이어져요.</span>') + '</div>';

    // 학생 / 보호자
    const ageChip = a == null ? h.chip('생년월일을 넣으면 판정해요', '') : a < 14 ? h.chip('만 ' + a + '세 · 법정대리인 동의 대상', 'info') : h.chip('만 ' + a + '세 · 본인 동의', 'ok');
    const student = h.card({
      title: '학생', body: form([
        fr('이름', inp({ f: 'name', v: ui.name, err: e.name, dis: ro, label: '학생 이름' }), { req: true, err: e.name }),
        fr('생년월일', inp({ f: 'birth', type: 'date', v: ui.birth, err: e.birth, dis: ro, w: '160px', label: '생년월일' }) + '<span style="margin-left:6px;padding-left:12px"' + h.p(2) + '>' + ageChip + '</span>', { req: true, err: e.birth }),
        fr('학교·학년', inp({ f: 'school', v: ui.school, ph: '○○초', dis: ro, label: '학교' }) + sel({ f: 'grade', v: ui.grade, opts: ['초1', '초2', '초3', '초4', '초5', '초6'], dis: ro, w: '84px', label: '학년' })),
        fr('레벨', '<b>' + esc(level || '-') + '</b><span class="muted small">테스트 결과</span>'),
        fr('두뇌 유형', '<b>' + esc(ui.testType || '○○형') + '</b><span class="muted small">테스트 결과</span>'),
      ]),
    });
    const guard = h.card({
      title: '보호자 (법정대리인)', body: form([
        fr('이름', inp({ f: 'g_name', v: ui.g_name, ph: '보호자 이름', err: e.g_name, dis: ro }), { req: true, err: e.g_name }),
        fr('관계', sel({ f: 'g_rel', v: ui.g_rel, opts: ['모', '부', '조부모', '기타 법정대리인'], dis: ro, w: '170px', label: '관계' })),
        fr('휴대폰', inp({ f: 'phone', v: ui.phone, ph: '010-0000-0000', err: e.phone, dis: ro, label: '보호자 휴대폰' }), { req: true, err: e.phone }),
        fr('알림톡 수신', chk('alim', ui.alim, '입실, 퇴실, 수납 안내 (정보성)', ro) + h.polChip('POL-35')),
      ]) + dupBox(ctx),
    });

    // 3 법정대리인 동의
    const v = ui.verified, gn = String(ui.g_name || '').trim();
    const vOk = v && v.name === gn && digits(v.phone) === digits(ui.phone);
    const vBtn = ui.method === '서면 동의서' ? '서면 동의서 사진 올리기' : '보호자 본인인증 요청';
    const status = !v ? h.chip('인증 전', 'warn') + h.btn(vBtn, { sm: true, primary: true, act: 'CT05.verify', disabled: ro })
      : vOk ? h.chip('인증 완료 · ' + v.at, 'ok') + '<span class="muted small">' + esc(v.method + (v.file ? ', ' + v.file : '') + ', 보호자 ' + h.mask(v.name)) + '</span>'
        : h.chip('보호자 정보가 바뀌어 다시 인증해야 해요', 'bad') + h.btn('다시 인증', { sm: true, act: 'CT05.verify', disabled: ro });
    const methods = [
      { v: '휴대폰 본인인증', l: '휴대폰 본인인증 (센터 태블릿)', dis: ro },
      { v: '서면 동의서', l: '서면 동의서 (사진 올리기)', dis: ro },
      { v: '카카오 인증', l: '카카오 인증 (P1a 제외)', dis: true, title: '시범 기간에는 쓰지 않아요 (검토 반영)' },
    ];
    const consent = h.card({
      title: '법정대리인 동의', pin: 3, sub: a != null && a < 14 ? '만 14세 미만이라 꼭 받아야 저장돼요' : '',
      right: '<span style="display:inline-block;padding-left:14px"' + h.p(9) + '>' + h.btn('항목별 동의 내용 보기', { sm: true, act: 'CT05.terms' }) + '</span>',
      body: form([
        fr('확인 방법', h.opts(methods, ui.method, { act: 'CT05.method' }) + h.polChip('POL-43')),
        fr('필수 동의', chk('c_privacy', ui.c_privacy, '개인정보 수집·이용', ro) + chk('c_entrust', ui.c_entrust, '처리 위탁 고지 확인', ro), { err: e.consent }),
        fr('선택 동의', chk('c_mkt', ui.c_mkt, '마케팅 정보 수신 (광고성)', ro) + '<span class="muted small">필수와 따로 받아요</span>'),
        fr('문안 버전', '<b>v1 (2027-01-01)</b>' + h.chip('예시', 'st-예시') + '<span class="muted small">동의 일시와 방법을 함께 저장해요</span>'),
        fr('상태', status, { pin: 7, rv: true, err: e.verify, hint: '시범에서는 센터 태블릿 본인인증과 서면 동의서 사진만 받아요. 인증한 사람이 입력한 보호자와 다르면 저장되지 않아요.' }),
      ]),
    });

    // 4 처리 위탁 고지 (6 검토 반영)
    const n = notice(ctx.center);
    const orig = '개인정보 처리자 ' + (ctx.center ? ctx.center.name : '대치1센터') + ', 수탁자 MSC Brain (시스템 운영), 결제선생 (결제), 알림톡 발송사 (발송)';
    const nc = h.card({
      title: '처리 위탁 고지', pin: 4, right: h.polChip('POL-42') + h.polChip('POL-44') + h.polChip('POL-36'),
      body: '<dl class="kv"><dt>개인정보 처리자</dt><dd>' + esc(n.proc) + '</dd><dt>수탁자</dt><dd>' + esc(n.trust) + '</dd></dl>' +
        '<div class="muted small" style="margin-top:6px">아이에게 직접 받는 정보는 동의에 꼭 필요한 것만 받아요. 고지는 쉬운 말로 써요.</div>' +
        '<div style="margin-top:10px"' + h.p(6) + '>' + h.alert(
          '<div>센터 유형과 결제 연동에 맞춰 ' + esc(n.kind) + '을 자동으로 골랐어요. ' + esc(n.note || '') + '원문 예시는 직영인 대치1센터를 처리자로, MSC Brain을 수탁자로 적었어요. 직영은 본사가 직접 운영해서 처리자가 MSC Brain이에요.</div>' +
          '<div class="row" style="margin-top:6px">' + h.btn(ui.showOrig ? '원문 문안 닫기' : '원문 문안과 비교', { sm: true, act: 'CT05.compare' }) + '</div>' +
          (ui.showOrig ? '<div class="ctb-strike" style="margin-top:6px">원문 예시 ' + esc(orig) + '</div>' : ''), 'review', { title: '검토 반영', raw: true }) + '</div>',
    });

    // 5 다음 단계
    const next = '<div class="ctb-next"' + h.p(5) + '><span>저장하면 수강 등록·수납(CT-07)으로 이어져요. 학습 계정을 여는 때는 계정 오픈 정책을 따르고 아직 정하지 않았어요.</span>' + h.polChip('POL-23') +
      '<span class="row" style="margin-left:auto">' + h.btn('취소', { act: 'CT05.cancel' }) + h.btn('저장 후 수강 등록', { primary: true, act: 'CT05.register', disabled: ro }) + '</span></div>';

    html += '<div class="grid g2" style="margin-top:12px;align-items:start">' + student + guard + '</div>' +
      '<div class="stack" style="margin-top:12px">' + consent + nc + '</div>' + next;
    return html;
  }

  function termsBody(ctx) {
    const n = notice(ctx.center);
    const item = (t, rows) => '<div style="border:1px solid var(--line);border-radius:8px;padding:9px 11px"><b>' + esc(t) + '</b>' + h.kv(rows, {}).replace('class="kv"', 'class="kv" style="grid-template-columns:86px minmax(0,1fr);margin-top:6px;font-size:12px"') + '</div>';
    return '<div class="muted small">보호자 휴대폰과 센터 태블릿에 같은 문안을 보여 줘요. 문안 v1은 예시예요.</div>' +
      item('개인정보 수집·이용 (필수)', [['목적', '수업 운영, 출결과 수납 안내'], ['받는 정보', '학생 이름, 생년월일, 학교와 학년, 보호자 이름과 휴대폰'], ['보관 기간', '퇴원 후 ' + h.pv('POL-40', ctx.center), true], ['거부하면', '등록할 수 없어요']]) +
      item('처리 위탁 고지 확인 (필수)', [['처리자', n.proc], ['수탁자', n.trust], ['거부하면', '등록할 수 없어요']]) +
      item('마케팅 정보 수신 (선택, 광고성)', [['목적', '행사와 할인 소식'], ['받는 정보', '보호자 휴대폰'], ['보관 기간', '동의를 거둘 때까지'], ['거부하면', '수업에는 아무 영향이 없어요']]);
  }

  B.screen({
    id: 'CT-05', side: 'ct', phase: 'P1a', devices: ['pc', 'tablet'], pages: [49],
    title: '원생 등록·법정대리인 동의', menuLabel: '원생 등록', crumb: '원생 > 원생 등록',
    headActions: ctx => h.btn('취소', { act: 'CT05.cancel' }) + h.btn('저장 후 수강 등록', { primary: true, act: 'CT05.register', disabled: !ctx.canEdit }),
    render: c05render,
    mount(root) { live(root, 'CT-05', ['birth']); },
    prd: {
      summary: '입학 테스트를 본 아이를 정식 원생으로 올리고, 보호자에게 개인정보 동의를 받아요. 저장하면 바로 수강 등록과 수납으로 이어져요.',
      who: '원장과 실장·데스크가 입력해요. 교사와 보조교사는 보기만 해요. 동의와 본인인증은 보호자가 센터 태블릿에서 직접 해요.',
      items: [
        { n: 1, t: '테스트 결과 연결', d: '입학 테스트 결과를 불러와 레벨과 두뇌 유형을 채워요. 상담 화면(CT-02)에서 넘어온 이름, 학년, 보호자 번호도 그대로 이어 써서 다시 입력하지 않아요.', ref: 'p.49 ①' },
        { n: 2, t: '만 14세 미만 자동 판정', d: '생년월일을 넣으면 만 나이를 바로 계산해요. 만 14세 미만(법정)이면 법정대리인 동의가 있어야 저장돼요. 초등학생은 모두 여기에 해당해요.', ref: 'p.49 ②' },
        { n: 3, t: '법정대리인 동의', d: '보호자가 직접 동의했는지 확인할 수 있는 방법으로 받아요. 받은 방법과 일시, 문안 버전을 함께 저장해요. 광고성 마케팅 수신은 선택 동의로 따로 물어요.', pol: ['POL-43', 'POL-35'], ref: 'p.49 ③' },
        { n: 4, t: '처리 위탁 고지', d: '아이 정보를 책임지는 곳(처리자)과 일을 맡아 하는 곳(수탁자)을 보호자에게 알려요. 아이에게 직접 받는 정보는 꼭 필요한 것만 받고, 안내는 쉬운 말로 써요.', pol: ['POL-42'], ref: 'p.49 ④' },
        { n: 5, t: '다음 단계', d: '저장하면 수강 등록·수납 화면(CT-07)으로 넘어가요. 학습 계정을 언제 열지는 계정 오픈 정책을 따르는데, 아직 정하지 않아서 확정처럼 적지 않았어요.', pol: ['POL-23'], ref: 'p.49 ⑤' },
        { n: 6, t: '직영 센터 고지를 바르게', kind: 'review', imp: 'IMP-04', pol: ['POL-44', 'POL-36'], d: '원문 예시는 직영인 대치1센터를 처리자로, 본사(MSC Brain)를 수탁자로 적었어요. 직영은 본사가 직접 운영하니까 처리자가 본사예요. 센터 유형과 결제 연동 방식에 맞춰 직영용과 가맹용 문안을 자동으로 골라요.' },
        { n: 7, t: '시범용 동의 방법과 본인 대조', kind: 'review', imp: 'IMP-05', d: '시범에서는 센터 태블릿 본인인증과 서면 동의서 사진 두 가지만 써요. 인증한 사람이 입력한 보호자와 다르면 저장을 막아요. 카카오 인증과 원격 동의 링크는 학부모 동의 화면을 맡을 팀을 정한 뒤로 미뤄요.' },
        { n: 8, t: '기존 원생과 형제 찾기', kind: 'review', imp: 'IMP-11', d: '보호자 휴대폰 번호로 이미 등록된 원생을 찾아요. 찾으면 형제로 연결할지 새로 만들지 고르고, 같은 이름이면 기존 원생 다시 등록도 고를 수 있어요. 형제로 이으면 수강 등록 화면에서 형제 할인 10%(예시)와 사유가 바로 채워져요.' },
        { n: 9, t: '항목별 동의 내용 보기', kind: 'review', imp: 'IMP-07', pol: ['POL-40'], d: '체크 칸만 있으면 보호자가 무엇에 동의하는지 알기 어려워요. 항목마다 목적, 받는 정보, 보관 기간, 거부하면 생기는 일을 보여 줘요. 보관 기간은 아직 미정이라 미정으로 보여요.' },
      ],
      open: ['동의서 문안과 다시 동의받을 조건 (POL-43, v1은 예시)', '퇴원 후 원생 정보 보관 기간 (POL-40)', '학습 계정을 여는 때 (POL-23)', '직영용과 가맹용 고지 문안의 법무 확인 (부록 A 10번)'],
      rules: ['만 14세 미만 아이의 개인정보는 법정대리인 동의를 받아야 쓸 수 있어요 (개인정보 보호법, 법정).', '광고성 알림은 따로 받은 선택 동의가 있을 때만 보내요.'],
    },
  });

  A5('CT05.method', (ctx, v) => { c05init(ctx); if (v === '카카오 인증') return; ctx.ui.method = v; ctx.ui.verified = null; });
  A5('CT05.verify', (ctx, arg) => {
    c05init(ctx); if (!ctx.canEdit) return;
    if (typeof arg === 'string' && arg && arg !== 'undefined') ctx.ui.method = arg;
    if (doVerify(ctx, arg)) B.toast(ctx.ui.method === '서면 동의서' ? '서면 동의서 사진을 올렸어요. 확인 일시와 함께 저장돼요.' : '보호자가 센터 태블릿에서 본인인증을 마쳤어요.');
  });
  A5('CT05.findDup', (ctx, ph) => { c05init(ctx); if (typeof ph === 'string' && ph) ctx.ui.phone = ph; findDup(ctx); });
  A5('CT05.dupChoice', (ctx, v) => { c05init(ctx); if (!ctx.ui.dup) findDup(ctx); ctx.ui.dupChoice = v; if (ctx.ui.e) delete ctx.ui.e.dup; });
  A5('CT05.compare', ctx => { ctx.ui.showOrig = !ctx.ui.showOrig; });
  A5('CT05.toDetail', (ctx, id) => { ctx.s.ui['CT-06'] = Object.assign(ctx.s.ui['CT-06'] || {}, { student: id || (ctx.ui.dup || {}).active }); B.go('CT-06'); return false; });
  A5('CT05.terms', ctx => { B.modal({ title: '항목별 동의 내용', body: termsBody(ctx), cancel: '닫기' }); return false; });
  // 데모용: 실장이 폼 칸을 채운 상태로 만들어요. 검사와 저장은 하지 않아요 (저장은 CT05.register).
  A5('CT05.fill', (ctx, arg) => {
    c05init(ctx); if (!ctx.canEdit || !arg || typeof arg !== 'object') return;
    const o = Object.assign({}, arg); delete o.verify; delete o.dupChoice; delete o.consent; delete o.verified;
    Object.assign(ctx.ui, o);
    if (ctx.ui.g_name) ctx.ui.guardian = ctx.ui.g_name;
    c05init(ctx);
  });
  A5('CT05.cancel', ctx => {
    const from = ctx.ui.from || '';
    if (/^r/.test(from) && B.screens['CT-02']) { B.go('CT-02'); return false; }
    return goOr('CT-04', '등록을 멈췄어요. 입력한 내용은 이 화면에 남아 있어요.');
  });
  A5('CT05.register', (ctx, arg) => {
    c05init(ctx);
    const ui = ctx.ui, s = ctx.s;
    if (!ctx.canEdit) return;
    if (arg && typeof arg === 'object') {
      const o = Object.assign({}, arg); delete o.verify; delete o.dupChoice;
      Object.assign(ui, o);
      if (arg.verify) doVerify(ctx, typeof arg.verify === 'object' ? arg.verify : null);
      if (arg.dupChoice) { findDup(ctx); ui.dupChoice = arg.dupChoice; }
    }
    const e = ui.e = {};
    const name = String(ui.name || '').trim(), gn = String(ui.g_name || '').trim();
    if (!name) e.name = '학생 이름을 넣어 주세요.';
    const a = age(ui.birth);
    if (a == null) e.birth = '생년월일을 넣어 주세요. 만 나이로 동의 방법을 정해요.';
    if (!gn) e.g_name = '보호자 이름을 넣어 주세요.';
    if (!PHONE.test(ui.phone || '')) e.phone = '보호자 휴대폰을 010-0000-0000 모양으로 넣어 주세요.';
    if (!ui.c_privacy || !ui.c_entrust) e.consent = '필수 동의 두 가지가 모두 있어야 저장돼요.';
    if (a != null && a < 14) {
      const v = ui.verified;
      if (!v) e.verify = ui.method === '서면 동의서' ? '서면 동의서 사진을 먼저 올려 주세요.' : '보호자 본인인증을 먼저 마쳐 주세요.';
      else if (v.name !== gn || digits(v.phone) !== digits(ui.phone)) e.verify = '인증한 뒤 보호자 정보가 바뀌었어요. 다시 인증해 주세요.';
    }
    findDup(ctx);
    if (ui.dup.active) e.dup = '이미 다니는 원생이에요. 원생 상세(CT-06)에서 확인해 주세요.';
    else if (ui.dup.ids.length && !ui.dupChoice) e.dup = '같은 보호자 번호로 등록된 원생이 있어요. 어떻게 할지 골라 주세요.';
    if (Object.keys(e).length) { B.toast('빨간 칸을 고치면 저장돼요.'); return; }
    ensure(s);
    const r = s.reservations.find(x => x.id === ui.from);
    const re = /^readmit:/.test(ui.from || '') ? s.students.find(x => x.id === ui.from.slice(8)) : null;
    const level = ui.level || (re ? re.level : r ? 'L2' : '');
    const consent = { date: TODAY, method: ui.verified ? ui.verified.method : '휴대폰 본인인증', version: VER };
    let st;
    if (ui.dupChoice === '기존 원생 다시 등록' && ui.dup.same) {
      st = s.students.find(x => x.id === ui.dup.same);
      Object.assign(st, { grade: ui.grade, level, cls: '', status: '수납 대기', guardian: gn, account: '-', paid: '-', consent });
      addLog(ctx, st, '재입학 (기존 기록에 이어서 등록, 법정대리인 동의 ' + consent.method + ', 문안 ' + VER + ')');
    } else {
      let n = s.students.length + 1; while (s.students.some(x => x.id === 's' + n)) n++;
      st = { id: 's' + n, center: ctx.centerId, name, grade: ui.grade, level, cls: '', status: '수납 대기', guardian: gn, phone: ui.phone, since: '', product: '', account: '-', paid: '-', consent };
      s.students.push(st);
      s.ct06.hist[st.id] = []; s.ct06.log[st.id] = [];
      addLog(ctx, st, '원생 등록, 법정대리인 동의 (' + consent.method + ', 문안 ' + VER + ')');
    }
    s.ct05.info[st.id] = {
      test: ui.testDate || (r ? '2027-' + r.at.slice(0, 5) : (s.ct05.info[st.id] || {}).test), level, brain: ui.testType || '○○형', school: ui.school, from: ui.from, wantCls: ui.cls || null,
      sibling: ui.dupChoice === '형제로 연결' ? ui.dup.ids[0] : null, rel: ui.g_rel,
      items: { privacy: true, entrust: true, alim: !!ui.alim, mkt: !!ui.c_mkt, at: ui.verified ? ui.verified.at : NOW, method: consent.method },
    };
    if (r && r.status === '완료') r.result = '등록';
    s.ui['CT-07'] = Object.assign(s.ui['CT-07'] || {}, { student: st.id });
    s.ui['CT-05'] = {};
    B.toast(st.name + ' 원생을 등록했어요. 수강 등록·수납으로 이어서 해요.');
    B.go('CT-07'); return false;
  });

  /* ======================================================================
     CT-06 원생 상세
     ====================================================================== */
  function c06student(ctx) {
    const s = ctx.s, ui = ctx.ui;
    let st = s.students.find(x => x.id === ui.student && x.center === ctx.centerId);
    if (!st) st = s.students.find(x => x.id === 's1' && x.center === ctx.centerId) || s.students.find(x => x.center === ctx.centerId && x.since) || s.students.find(x => x.center === ctx.centerId);
    return st || null;
  }
  const isTeacher = ctx => ctx.role === '교사' || ctx.role === '보조교사';
  const RQ_HOW = ['휴대폰 본인인증', '센터 방문 신분증 확인', '서면 요청서'];

  function c06head(ctx, st, tab) {
    const s = ctx.s, ro = !ctx.canEdit, c = s.classes.find(x => x.id === st.cls), info = s.ct05.info[st.id] || {};
    const un = ctx.ui.unmask === st.id;
    const want = s.ct07.want[st.id] ? s.classes.find(x => x.id === s.ct07.want[st.id]) : null;
    const btns = '<div class="row" style="margin-left:auto"' + (tab === 'a' ? h.p(2) : '') + '>' +
      h.btn('휴원', { act: 'CT06.open', arg: 'leave', disabled: ro || st.status !== '재원' }) +
      h.btn('퇴원', { act: 'CT06.open', arg: 'out', disabled: ro || /퇴원/.test(st.status) || st.status === '수납 대기' }) +
      h.btn('반 이동', { act: 'CT06.open', arg: 'move', disabled: ro || st.status !== '재원' || !c }) + '</div>';
    const secs = [['수강·상태', 'a'], ['출결', 'b'], ['학습', 'b'], ['상담', null], ['수납', 'b'], ['동의 이력', 'b']];
    const nav = '<div class="ctb-nav"' + (tab === 'a' ? h.p(1) : '') + '>' + secs.map(([l, t]) => t
      ? '<button type="button" class="ctb-sec' + (t === tab ? ' on' : '') + '" data-go="CT-06" data-go-tab="' + t + '">' + esc(l) + '</button>'
      : '<button type="button" class="ctb-sec" data-act="CT06.consult">' + esc(l) + '</button>').join('') + '</div>';
    return '<section class="card" style="margin-bottom:12px"><div class="ctb-sh-top"><div class="ctb-who"><span class="ctb-nm">' + esc(un ? st.name : h.mask(st.name)) + '</span>' +
      h.chip(st.grade) + h.chip(st.level || '-') + h.chip(info.brain || '○○형') + h.chip(c ? c.name : want ? want.name + ' 배정 대기' : '반 배정 전', c ? 'navy' : 'warn') + stChip(st.status) + h.chip(acctLabel(st.account), acctTone(st.account)) + '</div>' + btns + '</div>' +
      '<div class="muted small" style="margin-top:6px">보호자 ' + esc(un ? st.guardian : h.mask(st.guardian)) + ' <span class="mono">' + esc(un ? st.phone : h.maskPhone(st.phone)) + '</span>' +
      (st.since ? ', 등록 ' + esc(st.since) : '') + (un ? ' <span class="chip review">가림 해제 중, 10분 뒤 다시 가려져요 (예시)</span>' : '') + '</div>' + nav + '</section>';
  }

  function leavePanel(ctx, st) {
    const ui = ctx.ui, ro = !ctx.canEdit;
    return h.card({
      title: '휴원 신청', pin: 3, right: h.btn('닫기', { sm: true, act: 'CT06.close', arg: 'leave' }),
      body: form([
        fr('기간', inp({ f: 'lv_from', type: 'date', v: ui.lv_from || '2027-04-01', dis: ro, w: '150px' }) + '<span>~</span>' + inp({ f: 'lv_to', type: 'date', v: ui.lv_to || '2027-04-30', dis: ro, w: '150px' }), { err: ui.e_lv }),
        fr('최대', '<b>1개월</b>' + h.chip('(안)', 'st-안') + h.polChip('POL-21')),
        fr('이월', h.opts(['다음 달 차감', '기간 연장'].map(v => ({ v, l: v, dis: ro })), ui.lv_carry || '다음 달 차감', { act: 'CT06.carry' })),
        fr('계정', '휴원 기간 정지' + h.polChip('POL-23')),
      ]) + rowEnd(h.btn('신청', { primary: true, act: 'CT06.leave', disabled: ro })),
    });
  }
  function refundDue(s, st, date) {
    if (!okDate(date)) return null;
    const c = s.classes.find(x => x.id === st.cls);
    for (const r of hist(s, st).filter(x => x.paid != null)) {
      if (r.m + '-01' > date) return mon(r.m) + ' 수강권을 이미 냈고 아직 시작 전이에요. 전액 돌려줘야 해요.';
      if (r.m === date.slice(0, 7) && c) {
        const all = sessions(c, r.m), past = all.filter(d => d <= date).length;
        if (past * 2 < all.length) return mon(r.m) + ' 수강권 ' + all.length + '회 중 ' + past + '회만 지나서 법정 기준으로 돌려줄 돈이 있어요.';
      }
    }
    return null;
  }
  function outPanel(ctx, st) {
    const ui = ctx.ui, ro = !ctx.canEdit, s = ctx.s;
    const date = ui.out_date || '2027-03-31', refund = ui.out_refund || '환불 계산';
    const due = refundDue(s, st, date);
    const opts = [{ v: '환불 계산', l: '환불 계산 (CT-10으로 이어서)', dis: ro }, { v: '환불 없음', l: '환불 없음', dis: ro || !!due, title: due ? '돌려줄 돈이 있어서 고를 수 없어요' : null }];
    return h.card({
      title: '퇴원 처리', pin: 4, right: h.btn('닫기', { sm: true, act: 'CT06.close', arg: 'out' }),
      body: form([
        fr('퇴원일', inp({ f: 'out_date', type: 'date', v: date, dis: ro, w: '160px' }), { req: true, err: ui.e_out_date }),
        fr('사유', sel({ f: 'out_reason', v: ui.out_reason || '학원 일정 겹침', opts: ['학원 일정 겹침', '이사', '학습 효과 불만족', '비용 부담', '기타'], dis: ro, w: '200px' }), { req: true }),
        '<div' + h.p(7) + '>' +
        fr('사유 발생일', inp({ f: 'out_occur', type: 'date', v: ui.out_occur == null ? TODAY : ui.out_occur, dis: ro, w: '160px' }), { req: true, rv: true, err: ui.e_out_occur, hint: '보호자가 퇴원을 알린 날이에요. 환불 반환 기한 5일(법정)을 이날부터 세요.' }) +
        fr('환불', h.opts(opts, refund, { act: 'CT06.refund' }), { rv: !!due, err: ui.e_out_refund, hint: due ? due + ' 그래서 환불 없음은 고를 수 없어요.' : '' }) +
        '</div>',
        fr('계정', '퇴원일 다음 날 정지' + h.polChip('POL-25') + h.polChip('POL-40')),
      ]) + rowEnd(h.btn('퇴원 처리', { danger: true, act: 'CT06.out', disabled: ro })),
    });
  }
  function movePanel(ctx, st) {
    const ui = ctx.ui, ro = !ctx.canEdit, s = ctx.s, c = s.classes.find(x => x.id === st.cls);
    const lv = ui.mvHint || st.level;
    const list = s.classes.filter(x => x.center === st.center && x.id !== st.cls).sort((a, b) => (a.level === lv ? 0 : 1) - (b.level === lv ? 0 : 1));
    const opts = [{ v: '', l: '반을 골라 주세요' }].concat(list.map(x => ({ v: x.id, l: x.name + ' (' + x.enrolled + '/' + x.cap + ')' + (x.enrolled >= x.cap ? ' 정원 마감' : '') + (x.level !== lv ? ' 레벨 ' + x.level : ''), dis: x.enrolled >= x.cap })));
    return h.card({
      title: '반 이동', right: h.btn('닫기', { sm: true, act: 'CT06.close', arg: 'move' }),
      body: (ui.mvHint ? '<div class="small" style="margin-bottom:6px">' + h.chip('레벨 관리에서 넘어옴', 'info') + ' ' + esc(ui.mvHint) + '로 올리기로 했어요. ' + esc(ui.mvHint) + ' 반을 먼저 보여 줘요.</div>' : '') + form([
        fr('지금 반', '<b>' + esc(c ? c.name + ' ' + c.days + ' ' + c.time : '-') + '</b>'),
        fr('옮길 반', sel({ f: 'mv_cls', v: ui.mv_cls || '', opts, dis: ro }), { req: true, err: ui.e_mv }),
        fr('적용일', inp({ f: 'mv_date', type: 'date', v: ui.mv_date || '2027-03-15', dis: ro, w: '160px' }), { req: true, hint: '주 수업 횟수가 바뀌면 수강 등록·수납(CT-07)에서 차액을 계산해요.' }),
      ]) + rowEnd(h.btn('반 이동', { primary: true, act: 'CT06.move', disabled: ro })),
    });
  }
  function undoCard(ctx, st) {
    const S = stOf(ctx.s, st), ro = !ctx.canEdit;
    const within = S.out ? between(S.out.at, TODAY) <= 7 : false;
    const canReturn = /휴원/.test(st.status);
    const canCancel = /퇴원/.test(st.status) && within;
    const canRe = st.status === '퇴원' || (/퇴원/.test(st.status) && !within);
    const note = canReturn ? (st.status === '휴원 예정' ? '휴원 시작 전이에요. 신청을 취소하면 그대로 재원이에요.' : '휴원 중이에요. 일찍 돌아오면 오늘부터 계정이 다시 열려요.')
      : canCancel ? '퇴원 처리 ' + md(S.out.at) + ', 7일(예시) 안이라 원장이 취소할 수 있어요.'
        : canRe ? '퇴원한 원생이에요. 재입학하면 예전 기록에 이어서 등록해요.' : '지금은 되돌릴 상태가 없어요.';
    return h.card({
      title: '상태 되돌리기', pin: 6, sub: '검토 반영',
      body: '<div class="small" style="margin-bottom:6px">지금 상태 ' + stChip(st.status) + ' ' + esc(note) + '</div>' +
        form([fr('되돌린 이유', sel({ f: 'undo_reason', v: ctx.ui.undo_reason || '잘못 처리', opts: ['잘못 처리', '보호자 요청', '일정 변경'], dis: ro, w: '170px' }))]) +
        '<div class="row" style="margin-top:8px">' +
        h.btn(st.status === '휴원 예정' ? '휴원 신청 취소' : '휴원 복귀', { act: 'CT06.undo', arg: 'return', disabled: ro || !canReturn }) +
        h.btn('퇴원 취소', { act: 'CT06.undo', arg: 'cancelOut', disabled: ro || !canCancel || ctx.role !== '원장', title: ctx.role !== '원장' ? '원장만 할 수 있어요' : null }) +
        h.btn('재입학', { act: 'CT06.undo', arg: 'readmit', disabled: ro || !canRe }) + '</div>' +
        '<div class="muted small" style="margin-top:6px">퇴원 취소는 7일 안(예시)에 원장만 해요. 되돌린 이유는 상태 이력에 남아요.</div>',
    });
  }

  function c06a(ctx, st) {
    const s = ctx.s, ui = ctx.ui;
    let html = h.card({
      title: '수강 이력',
      body: h.table({
        cols: [
          { label: '월', k: 'm' },
          { label: '상품', render: r => esc(prodName(s, r.pid)) },
          { label: '교습비', num: true, render: r => num(r.fee) },
          { label: '할인', render: r => esc(r.disc || '없음') },
          { label: '수납', num: true, render: r => (r.paid == null ? h.chip('미수', 'bad') : num(r.paid) + ' <span class="muted small">' + esc(r.date) + '</span>') },
          { label: '계정', render: r => h.chip(r.acct, r.acct === '활성' ? 'ok' : r.acct === '정지' ? 'warn' : r.acct === '예정' ? 'info' : '') },
        ],
        rows: hist(s, st), empty: '아직 수강 이력이 없어요. 수강 등록·수납(CT-07)에서 수납하면 여기에 쌓여요.',
      }),
    });
    const panels = [];
    if (ui.pLeave) panels.push(leavePanel(ctx, st));
    if (ui.pOut) panels.push(outPanel(ctx, st));
    if (ui.pMove) panels.push(movePanel(ctx, st));
    if (panels.length) html += '<div class="grid g2" style="margin-top:12px;align-items:start">' + panels.join('') + '</div>';
    html += '<div class="grid g-side" style="margin-top:12px;align-items:start">' + h.card({
      title: '상태 이력', pin: 5,
      body: h.table({ cols: [{ label: '일시', k: 'at', w: '96px' }, { label: '변경', k: 'what' }, { label: '처리자', k: 'by', w: '110px' }], rows: logs(s, st), empty: '아직 상태 변화가 없어요.' }),
    }) + undoCard(ctx, st) + '</div>';
    return html;
  }

  function calHtml(ctx, st) {
    const s = ctx.s, ui = ctx.ui, c = s.classes.find(x => x.id === st.cls), ym = '2027-03';
    if (!c) return h.empty('반 배정 전이라 출결이 없어요. 반·시간표(CT-11)에서 반을 정하면 달력이 채워져요.');
    const att = s.ct06.att[st.id] || {}, mks = s.ct06.mk[st.id] || [];
    const daysOn = d => clsDays(clsOn(s, st, d));
    const canMk = ctx.canEdit;
    let cells = ['월', '화', '수', '목', '금', '토', '일'].map(x => '<div class="hd">' + x + '</div>').join('');
    const lead = (dow(ym + '-01') + 6) % 7;
    for (let i = 0; i < lead; i++) cells += '<div class="blank"></div>';
    let nAtt = 0, nAbs = 0, nMk = 0;
    for (let i = 1; i <= dim(ym); i++) {
      const d = ym + '-' + pad(i), mk = mks.find(x => x.day === d), done = mks.find(x => x.absent === d);
      let k = '', label = '';
      if (HOLI[d]) { k = '공휴'; label = '공휴'; }
      else if (att[d]) { k = att[d]; label = att[d] === '결석' ? (done ? '결석 (보강 예정)' : '결석') : att[d]; }
      else if (mk) { k = '보강'; label = d <= TODAY ? '보강 ●' : '보강 예정'; }
      else if (daysOn(d).includes(dow(d))) { k = d <= TODAY ? '출석' : '예정'; label = d <= TODAY ? '●' : '수업'; }
      if (k === '출석') nAtt++; if (k === '결석') nAbs++; if (k === '보강') nMk++;
      const click = k === '결석' && !done && canMk;
      cells += '<div class="k-' + k + (d === TODAY ? ' today' : '') + (ui.mkFor === d ? ' sel' : '') + (click ? ' click' : '') + '"' + (click ? ' data-act="CT06.absent" data-arg="' + d + '" role="button" title="보강 잡기"' : '') + '><span>' + i + '</span><span class="mk">' + esc(label) + '</span></div>';
    }
    const tail = (7 - ((lead + dim(ym)) % 7)) % 7;
    for (let i = 0; i < tail; i++) cells += '<div class="blank"></div>';
    let panel = '';
    if (ui.mkFor) {
      const used = mks.filter(x => x.absent.slice(0, 7) === ui.mkFor.slice(0, 7)).length;
      const cand = [];
      for (let i = 1; i <= 14 && cand.length < 4; i++) {
        const d = addDays(ui.mkFor, i); if (d < TODAY || HOLI[d]) continue;
        const w = dow(d), own = clsOn(s, st, d); if (clsDays(own).includes(w)) continue;
        s.classes.filter(x => x.center === st.center && x.id !== (own ? own.id : '') && x.level === st.level && clsDays(x).includes(w)).forEach(x => { if (cand.length < 4) cand.push({ d, c: x }); });
      }
      panel = '<div class="ctb-sub" style="margin-top:8px"><div class="row"><b>' + esc(md(ui.mkFor)) + ' 결석 보강 잡기</b><span class="muted small">이번 달 ' + used + '/2회 (안), 결석일부터 2주 안</span>' + h.btn('닫기', { sm: true, act: 'CT06.absent', arg: ui.mkFor }) + '</div>' +
        (used >= 2 ? '<div class="ctb-err">이번 달 보강은 2회(안)까지라 더 잡을 수 없어요.</div>'
          : cand.length ? '<div class="row">' + cand.map(x => h.btn(md(x.d) + ' (' + DOW[dow(x.d)] + ') ' + x.c.name + ' ' + x.c.time.slice(0, 5), { sm: true, act: 'CT06.makeup', arg: x.d + '|' + x.c.id })).join('') + '</div>'
            : '<div class="muted small">2주 안에 같은 레벨 반 자리가 없어요.</div>') + '</div>';
    }
    return '<div class="ctb-cal">' + cells + '</div><div class="small muted" style="margin-top:6px">● 출석 ' + nAtt + ', 결석 ' + nAbs + ', 보강 ' + nMk + '. 보강은 월 2회까지, 결석일부터 2주 안 (안) ' + h.polChip('POL-22') + '</div>' + panel;
  }
  function payRows(s, st) {
    const out = [];
    hist(s, st).forEach(r => {
      const m = mon(r.m), how = String(r.method || '').replace(' 링크', '').replace(' 단말기', '');
      if (r.paid == null) { out.push({ date: '-', what: m + ' 교습비', amt: r.fee, how: '-', m: r.m, unpaid: true }); return; }
      out.push({ date: r.date, what: m + ' 교습비', amt: r.paid, how, m: r.m });
      if (r.book) out.push({ date: r.date, what: m + ' 교재비', amt: r.book, how, m: r.m });
    });
    return out;
  }
  function consentRows(s, st) {
    if (!st.consent) return [];
    const info = s.ct05.info[st.id] || {}, it = info.items || {}, v = st.consent.version, how = st.consent.method.replace('휴대폰 본인인증', '휴대폰 인증'), d = st.consent.date;
    const rows = [{ at: d, item: '수집·이용 (필수)', ver: v, how }, { at: d, item: '처리 위탁 고지 확인 (필수)', ver: v, how }, { at: d, item: '마케팅 (선택)', ver: v, how: it.mkt ? how : '미동의' }];
    return (s.ct06.cons[st.id] || []).concat(rows);
  }
  function c06b(ctx, st) {
    const s = ctx.s, teacher = isTeacher(ctx), ro = !ctx.canEdit;
    const learnOk = st.account === '활성' || st.account === '가오픈';
    let html = '<div class="grid g2" style="align-items:start">' +
      h.card({ title: '출결 (3월)', pin: 1, body: calHtml(ctx, st) }) +
      h.card({
        title: '학습', sub: '학습 시스템 결과', pin: 2,
        body: learnOk ? h.table({ cols: [{ label: '항목', k: 'k' }, { label: '3월', k: 'v' }], rows: [{ k: '독서퀴즈 평균', v: '84점' }, { k: '어휘퀴즈', v: '91점' }, { k: '스피치 제출', v: '4/4' }, { k: '글쓰기 첨삭', v: '3/4, 1건 대기' }] }) +
          '<div class="muted small" style="margin-top:6px">값은 학습 시스템에서 받아요 (예시). 세부 학습 화면은 학습 프로젝트 범위예요.</div>'
          : h.empty('학습 계정이 열리지 않아 받은 결과가 없어요.'),
      }) + '</div>';
    html += '<div style="margin:12px 0"' + h.p(7) + '>' + h.alert(teacher ? '교사와 보조교사는 수업에 필요한 출결과 학습만 봐요. 수납, 동의 이력, 요청 기록은 원장과 실장만 볼 수 있어요.' : '수납, 동의 이력, 요청 기록은 원장과 실장만 봐요. 교사와 보조교사에게는 이 칸들이 가려져요.', 'review', { title: '검토 반영' }) + '</div>';
    const lock = t => h.card({ title: t, body: h.empty(t + '은 원장과 실장만 볼 수 있어요.') });
    html += '<div class="grid g2" style="align-items:start">' +
      (teacher ? lock('수납').replace('<section', '<section' + h.p(3)) : h.card({
        title: '수납', pin: 3, right: h.polChip('POL-14'),
        body: h.table({
          cols: [{ label: '일자', k: 'date' }, { label: '내용', k: 'what' }, { label: '금액', num: true, render: r => (r.unpaid ? h.chip('미수 ' + num(r.amt), 'bad') : num(r.amt)) }, { label: '수단', k: 'how' },
            { label: '영수증', render: r => (r.unpaid ? '-' : h.btn('보기', { sm: true, act: 'CT06.receipt', arg: r.m })) }],
          rows: payRows(s, st), empty: '아직 수납 내역이 없어요.',
        }) + '<div class="muted small" style="margin-top:6px">교습비와 교재비 같은 기타경비를 줄을 나눠 보여 줘요.</div>',
      })) +
      (teacher ? lock('동의 이력').replace('<section', '<section' + h.p(4)) : h.card({
        title: '동의 이력', pin: 4, right: h.polChip('POL-43'),
        body: h.table({ cols: [{ label: '일시', k: 'at' }, { label: '항목', k: 'item' }, { label: '버전', render: r => esc(r.ver) + (r.ver !== VER ? ' ' + h.chip('재동의 대상', 'warn') : '') }, { label: '방법', k: 'how' }], rows: consentRows(s, st), empty: '받은 동의가 없어요. 원생 등록(CT-05)에서 받아요.' }) +
          '<div class="muted small" style="margin-top:6px">지금 문안은 ' + VER + ' (예시)예요. 문안이 바뀌면 다시 동의받을 원생에 재동의 대상 표시가 떠요.</div>',
      })) + '</div>';
    const reqs = s.ct06.req[st.id] || [];
    html += h.card({
      title: '개인정보 요청', pin: 5, right: h.chip('P2', 'p2') + h.btn('CT-24 열기', { sm: true, go: 'CT-24' }), cls: '',
      body: '<div class="small">보호자의 열람, 정정, 삭제 요청을 받고 처리한 기록은 확대 단계 화면(CT-24)에서 다뤄요.</div>' +
        (teacher ? '<div class="ctb-sub review"' + h.p(6) + '><b>요청 기록</b><span class="small">요청 기록은 원장과 실장만 볼 수 있어요.</span></div>'
          : '<div class="ctb-sub review"' + h.p(6) + '><div class="row"><b>요청 기록</b><span class="small">CT-24가 나오기 전까지 여기에 적어요. 처리 기한 10일 (예시)</span></div>' +
          '<div class="row"><span class="small">본인 확인</span>' + sel({ f: 'rq_how', v: ctx.ui.rq_how || RQ_HOW[0], opts: RQ_HOW, dis: ro, w: '170px', label: '본인 확인 방법' }) + '<span class="small">새 요청</span>' + h.opts(['열람', '정정', '삭제', '동의 철회'].map(v => ({ v, l: v, dis: ro })), '', { act: 'CT06.req' }) + '</div>' +
          (reqs.length ? h.table({ cols: [{ label: '접수일', k: 'at' }, { label: '요청', k: 'kind' }, { label: '본인 확인', k: 'how' },
            { label: '처리 기한', render: r => esc(r.due) + (r.status === '처리 완료' ? '' : ' ' + h.chip('D-' + Math.max(0, between(TODAY, r.due)), between(TODAY, r.due) <= 3 ? 'bad' : 'warn')) },
            { label: '처리일', render: r => (r.done ? esc(r.done) + ' <span class="muted small">' + esc(r.by) + '</span>' : h.status('접수')) },
            { label: '통지일', render: r => (r.notice ? esc(r.notice) + ' <span class="muted small">' + esc(r.noticeHow) + '</span>' : '-') },
            { label: '', render: r => (r.status === '처리 완료' ? '' : h.btn('처리 완료', { sm: true, act: 'CT06.reqDone', arg: r.id, disabled: ro })) }], rows: reqs }) : '<span class="muted small">받은 요청이 없어요.</span>') + '</div>'),
    });
    return '<div style="margin-top:0">' + html + '</div>';
  }

  // 원생 목록(CT-04)의 want, 레벨 관리(CT-13)의 moveLevel 을 받으면 해당 창을 한 번 열어 줘요
  function c06handoff(ctx, st) {
    const ui = ctx.ui;
    if (!ui.want && !ui.moveLevel) return;
    if (ui.want === '휴원') ui.pLeave = true;
    if (ui.want === '퇴원') ui.pOut = true;
    if (ui.moveLevel) {
      ui.pMove = true; ui.mvHint = ui.moveLevel;
      const c = ctx.s.classes.filter(x => x.center === st.center && x.id !== st.cls && x.level === ui.moveLevel && x.enrolled < x.cap).sort((a, b) => (b.cap - b.enrolled) - (a.cap - a.enrolled))[0];
      ui.mv_cls = c ? c.id : '';
    }
    delete ui.want; delete ui.moveLevel;
  }
  function c06render(ctx) {
    const st = c06student(ctx);
    if (!st) return h.empty('이 센터에는 아직 원생이 없어요. 원생 등록(CT-05)에서 먼저 등록해 주세요.');
    ensure(ctx.s);
    if (ctx.ui.student !== st.id) ctx.ui.student = st.id;
    c06handoff(ctx, st);
    const tab = ctx.tab || 'a';
    return c06head(ctx, st, tab) + (tab === 'a' ? c06a(ctx, st) : c06b(ctx, st));
  }

  B.screen({
    id: 'CT-06', side: 'ct', phase: 'P1a', devices: ['pc', 'tablet'], pages: [50, 51],
    title: '원생 상세', menuLabel: '원생 상세', crumb: '원생 > 원생 목록 > 원생 상세',
    tabs: [{ id: 'a', label: '수강·상태', phase: 'P1a' }, { id: 'b', label: '출결·학습·수납·동의', phase: 'P1a' }],
    headActions: ctx => {
      const st = c06student(ctx); if (!st) return '';
      const list = ctx.s.students.filter(x => x.center === ctx.centerId).map(x => ({ id: x.id, label: h.mask(x.name) + ' ' + x.grade + ' ' + x.status }));
      return pickSel('ct06-pick', list, st.id) + h.btn(ctx.ui.unmask === st.id ? '다시 가리기' : '마스킹 해제', { act: 'CT06.unmask' });
    },
    render: c06render,
    mount(root) {
      const pk = root.querySelector('#ct06-pick');
      if (pk) pk.addEventListener('change', () => { B.actions['CT06.student'](B.ctx(), pk.value); B.render(); });
      live(root, 'CT-06', ['out_date']);
    },
    prd: {
      summary: '원생 한 명의 수강, 상태, 출결, 학습, 수납, 동의 기록을 한곳에서 봐요. 휴원, 퇴원, 반 이동도 여기서 처리해요.',
      who: '원장과 실장·데스크가 상태를 바꿔요. 교사와 보조교사는 보기만 해요. 이름과 번호는 가려서 보여 주고, 풀 때는 사유를 남겨요.',
      items: [
        { n: 1, tab: 'a', t: '탭 구성', d: '수강·상태, 출결, 학습, 상담, 수납, 동의 이력으로 나눠 봐요. 이 탭은 수강·상태예요. 출결, 학습, 수납, 동의 이력은 옆 탭에 모았고, 상담을 누르면 상담 기록 창이 열려요.', ref: 'p.50 ①' },
        { n: 2, tab: 'a', t: '상태 변경 버튼', d: '휴원, 퇴원, 반 이동 버튼이에요. 바뀐 상태는 학습 계정과 본사 사용료 과금에 그대로 반영돼요. 사용료를 무엇으로 셀지는 아직 미정이에요.', pol: ['POL-02'], ref: 'p.50 ②' },
        { n: 3, tab: 'a', t: '휴원', cond: true, reveal: 'CT06.open', revealArg: 'leave', d: '쉬는 기간과 이미 낸 돈을 넘기는 방식을 정해요. 최대 1개월과 다음 달 차감은 (안)이에요. 쉬는 동안 학습 계정은 멈춰요.', pol: ['POL-21', 'POL-23'], ref: 'p.50 ③' },
        { n: 4, tab: 'a', t: '퇴원', cond: true, reveal: 'CT06.open', revealArg: 'out', d: '퇴원일과 사유를 꼭 적어요. 돌려줄 돈이 있으면 환불 처리(CT-10)로 이어져요. 퇴원생 정보는 보관 기간이 지나면 자동으로 지우는데, 그 기간은 아직 미정이에요.', pol: ['POL-25', 'POL-40'], ref: 'p.50 ④' },
        { n: 5, tab: 'a', t: '상태 이력', d: '수강권 시작, 반 이동, 휴원, 퇴원 같은 변화를 누가 언제 했는지 남겨요.', ref: 'p.50 ⑤' },
        { n: 6, tab: 'a', t: '상태 되돌리기', kind: 'review', imp: 'IMP-12', d: '휴원 중에 일찍 돌아오거나 퇴원을 잘못 눌렀을 때 되돌릴 길이 없었어요. 휴원 복귀, 퇴원 취소, 재입학을 넣었어요. 퇴원 취소는 7일 안(예시)에 원장만 하고, 되돌린 이유는 상태 이력에 남아요.' },
        { n: 7, tab: 'a', t: '사유 발생일과 환불 없음 막기', kind: 'review', imp: 'IMP-09', cond: true, reveal: 'CT06.open', revealArg: 'out', pol: ['POL-25'], d: '퇴원 창에 사유 발생일 칸을 꼭 채우게 해서 환불 반환 기한 5일(법정)을 이날부터 세요. 퇴원일 뒤에 시작하는 수강권을 이미 냈거나, 이번 달 수업이 퇴원일까지 절반도 지나지 않았으면 돌려줄 돈이 있어요. 그때는 환불 없음을 고를 수 없어요.' },
        { n: 1, tab: 'b', t: '출결', d: '한 달 달력으로 출석, 결석, 보강, 공휴일을 봐요. 결석한 날을 누르면 같은 레벨 반으로 보강을 잡아요. 보강은 월 2회까지, 2주 안(안)이고, 원문에 세는 기준이 없어서 이 화면은 결석한 달과 결석일을 기준으로 세요.', pol: ['POL-22'], ref: 'p.51 ①' },
        { n: 2, tab: 'b', t: '학습', d: '학습 시스템에서 받은 결과를 요약해 보여 줘요. 문제를 풀고 첨삭하는 세부 화면은 학습 프로젝트에서 만들어요.', ref: 'p.51 ②' },
        { n: 3, tab: 'b', t: '수납', d: '수납 내역과 영수증을 봐요. 교습비와 교재비 같은 기타경비는 줄을 나눠 보여 줘요.', pol: ['POL-14'], ref: 'p.51 ③' },
        { n: 4, tab: 'b', t: '동의 이력', d: '동의 항목, 문안 버전, 일시, 방법을 남겨요. 문안이 바뀌어 다시 동의를 받아야 하면 표시해요.', pol: ['POL-43'], ref: 'p.51 ④' },
        { n: 5, tab: 'b', t: '개인정보 요청 (P2)', d: '보호자가 정보를 보여 달라거나, 고치거나 지워 달라고 하면 확대 단계의 별도 화면(CT-24)에서 처리해요.', ref: 'p.51 ⑤' },
        { n: 6, tab: 'b', t: '요청 기록 칸', kind: 'review', imp: 'IMP-07', d: '1~2월 시범에는 엑셀 접수 대장으로 받고, 3월 확장 전부터 CT-24가 나올 때까지 이 칸에 적어요. 접수일, 요청 종류, 본인 확인 방법, 처리일, 통지일을 남기고 남은 날을 보여 줘요. 처리 기한 10일은 예시이고 법정 기한은 법무가 확인하고 있어요.' },
        { n: 7, tab: 'b', t: '탭별 보기 권한', kind: 'review', imp: 'IMP-14', d: '교사와 보조교사도 원생 메뉴를 볼 수 있어서 수납과 동의 기록까지 보였어요. 수업에 필요한 출결과 학습만 보이게 하고, 수납, 동의 이력, 요청 기록은 원장과 실장만 보게 나눴어요.' },
      ],
      open: ['휴원 최대 기간과 이월 방식 (POL-21)', '학습 계정을 멈추고 여는 조건 (POL-23)', '사용료를 세는 기준 (POL-02)', '퇴원생 정보 보관 기간 (POL-40)', '보강 횟수와 기한을 세는 기준 (POL-22)', '퇴원 취소를 허용하는 기간 (7일은 예시)'],
      rules: ['교습 시작 전이면 낸 교습비를 모두, 절반이 지나기 전이면 법정 비율만큼 돌려줘요 (학원법 시행령 별표4, 법정).'],
    },
  });

  A6('CT06.student', (ctx, id) => { ctx.ui.student = id; ['from', 'want', 'moveLevel', 'mvHint', 'pLeave', 'pOut', 'pMove', 'mkFor', 'e_lv', 'e_out_date', 'e_out_occur', 'e_out_refund', 'e_mv'].forEach(k => { delete ctx.ui[k]; }); });
  A6('CT06.open', (ctx, p) => {
    const st = c06student(ctx); if (!st) return;
    if (p && typeof p === 'object') { if (p.student) ctx.ui.student = p.student; p = p.panel; }
    B.state.tab = 'a';
    if (p === 'leave') ctx.ui.pLeave = true; else if (p === 'out') ctx.ui.pOut = true; else if (p === 'move') ctx.ui.pMove = true;
  });
  A6('CT06.close', (ctx, p) => { if (p === 'leave') ctx.ui.pLeave = false; else if (p === 'out') ctx.ui.pOut = false; else { ctx.ui.pMove = false; ctx.ui.mvHint = null; } });
  A6('CT06.carry', (ctx, v) => { ctx.ui.lv_carry = v; });
  A6('CT06.refund', (ctx, v) => { ctx.ui.out_refund = v; delete ctx.ui.e_out_refund; });
  A6('CT06.leave', (ctx, arg) => {
    const st = c06student(ctx), ui = ctx.ui; if (!st || !ctx.canEdit) return;
    if (arg && typeof arg === 'object') { if (arg.from) ui.lv_from = arg.from; if (arg.to) ui.lv_to = arg.to; if (arg.carry) ui.lv_carry = arg.carry; }
    const from = ui.lv_from || '2027-04-01', to = ui.lv_to || '2027-04-30', carry = ui.lv_carry || '다음 달 차감';
    ui.pLeave = true; ui.e_lv = null;
    if (st.status !== '재원') { ui.e_lv = '재원 중인 원생만 휴원을 신청할 수 있어요.'; return; }
    if (!okDate(from) || !okDate(to) || to < from) { ui.e_lv = '시작일과 끝나는 날을 바르게 넣어 주세요.'; return; }
    const max = addDays(addMonths(from, 1), -1);
    if (to > max) { ui.e_lv = '휴원은 최대 1개월(안)까지예요. ' + max + '까지로 줄여 주세요.'; return; }
    const S = stOf(ctx.s, st); logs(ctx.s, st);
    S.leave = { from, to, carry, at: TODAY };
    st.status = from > TODAY ? '휴원 예정' : '휴원';
    if (from <= TODAY) st.account = '정지';
    addLog(ctx, st, '휴원 신청 (' + from + ' ~ ' + md(to) + ', 이월 ' + carry + ')');
    ui.pLeave = false;
    B.toast(md(from) + '부터 휴원이에요. 그 기간에는 학습 계정이 멈추고 사용료 집계에도 반영돼요.');
  });
  A6('CT06.out', (ctx, arg) => {
    const st = c06student(ctx), ui = ctx.ui, s = ctx.s; if (!st || !ctx.canEdit) return;
    if (arg && typeof arg === 'object') { ['date', 'reason', 'occur', 'refund'].forEach(k => { if (arg[k] != null) ui['out_' + k] = arg[k]; }); }
    const date = ui.out_date || '2027-03-31', reason = ui.out_reason || '학원 일정 겹침', occur = ui.out_occur == null ? TODAY : ui.out_occur, refund = ui.out_refund || '환불 계산';
    ui.pOut = true; ui.e_out_date = ui.e_out_occur = ui.e_out_refund = null;
    if (!okDate(date) || date < TODAY) ui.e_out_date = '퇴원일은 오늘이나 그 뒤로 넣어 주세요.';
    if (!okDate(occur)) ui.e_out_occur = '사유 발생일을 넣어 주세요. 환불 기한을 이날부터 세요.';
    else if (occur > TODAY) ui.e_out_occur = '사유 발생일은 오늘이나 그 전이어야 해요.';
    const due = refundDue(s, st, date);
    if (due && refund === '환불 없음') ui.e_out_refund = '돌려줄 돈이 있어서 환불 없음으로 처리할 수 없어요.';
    if (ui.e_out_date || ui.e_out_occur || ui.e_out_refund) return;
    const S = stOf(s, st); logs(s, st);
    S.out = { date, reason, occur, refund, at: TODAY };
    st.status = date > TODAY ? '퇴원 예정' : '퇴원';
    addLog(ctx, st, '퇴원 처리 (퇴원일 ' + date + ', ' + reason + ', 사유 발생일 ' + occur + ', ' + refund + ')');
    ui.pOut = false;
    if (refund === '환불 계산') {
      s.ui['CT-10'] = Object.assign(s.ui['CT-10'] || {}, { student: st.id, occur, out: date, reason });
      if (B.screens['CT-10']) { B.toast('퇴원을 처리했어요. 환불 처리로 이어서 해요.'); B.go('CT-10'); return false; }
      B.toast('퇴원을 처리했어요. 환불 처리(CT-10)로 사유 발생일 ' + occur + '을 넘겼어요.');
      return;
    }
    B.toast('퇴원을 처리했어요. 퇴원일 다음 날 학습 계정이 멈춰요.');
  });
  A6('CT06.move', (ctx, arg) => {
    const st = c06student(ctx), ui = ctx.ui, s = ctx.s; if (!st || !ctx.canEdit) return;
    if (arg && typeof arg === 'object') { if (arg.cls) ui.mv_cls = arg.cls; if (arg.date) ui.mv_date = arg.date; } else if (typeof arg === 'string' && /^c/.test(arg)) ui.mv_cls = arg;
    ui.pMove = true; ui.e_mv = null;
    const to = s.classes.find(x => x.id === ui.mv_cls), from = s.classes.find(x => x.id === st.cls), date = ui.mv_date || '2027-03-15';
    if (!to) { ui.e_mv = '옮길 반을 골라 주세요.'; return; }
    if (to.enrolled >= to.cap) { ui.e_mv = to.name + ' 반은 정원(' + to.cap + '명)이 찼어요.'; return; }
    if (!okDate(date)) { ui.e_mv = '적용일을 넣어 주세요.'; return; }
    logs(s, st);
    if (from) from.enrolled = Math.max(0, from.enrolled - 1);
    to.enrolled += 1; st.cls = to.id;
    (s.ct06.moves[st.id] = s.ct06.moves[st.id] || []).push({ date, from: from ? from.id : '', to: to.id });
    addLog(ctx, st, '반 이동 ' + (from ? from.name : '-') + '에서 ' + to.name + '로 (' + md(date) + '부터)');
    ui.pMove = false; ui.mv_cls = ''; ui.mvHint = null;
    B.toast(to.name + '로 옮겼어요. ' + md(date) + '부터 출결 명단이 바뀌어요.');
  });
  A6('CT06.undo', (ctx, kind) => {
    const st = c06student(ctx), s = ctx.s, ui = ctx.ui; if (!st || !ctx.canEdit) return;
    const S = stOf(s, st), why = ui.undo_reason || '잘못 처리'; logs(s, st);
    if (kind === 'return') {
      if (!/휴원/.test(st.status)) { B.toast('휴원 중인 원생이 아니에요.'); return; }
      const before = st.status; S.leave = null; st.status = '재원'; st.account = '활성';
      addLog(ctx, st, (before === '휴원 예정' ? '휴원 신청 취소' : '휴원 복귀') + ' (' + why + ')');
      B.toast(before === '휴원 예정' ? '휴원 신청을 취소했어요.' : '휴원에서 돌아왔어요. 학습 계정이 다시 열렸어요.');
    } else if (kind === 'cancelOut') {
      if (ctx.role !== '원장') { B.toast('퇴원 취소는 원장만 할 수 있어요.'); return; }
      if (!/퇴원/.test(st.status) || !S.out || between(S.out.at, TODAY) > 7) { B.toast('7일(예시)이 지나 취소할 수 없어요. 재입학으로 처리해 주세요.'); return; }
      S.out = null; st.status = '재원'; st.account = st.account === '-' ? '-' : '활성';
      addLog(ctx, st, '퇴원 취소 (' + why + ')');
      B.toast('퇴원을 취소했어요. 이유가 상태 이력에 남았어요.');
    } else if (kind === 'readmit') {
      s.ui['CT-05'] = { from: 'readmit:' + st.id, name: st.name, grade: st.grade, phone: st.phone, g_name: st.guardian, level: st.level };
      if (B.screens['CT-05']) { B.go('CT-05'); return false; }
    }
  });
  A6('CT06.unmask', (ctx, reason) => {
    const st = c06student(ctx); if (!st) return;
    if (ctx.ui.unmask === st.id) { ctx.ui.unmask = null; return; }
    const apply = r => {
      ctx.s.ui['CT-06'].unmask = st.id;
      ctx.s.audit.unshift({ at: '03-08 14:10', who: ctx.persona.name + ' (' + (ctx.center ? ctx.center.name : '') + ' ' + ctx.role + ')', what: '원생 정보 마스킹 해제', target: (ctx.center ? ctx.center.name + ' ' : '') + h.mask(st.name), reason: r });
      B.toast('10분(예시) 동안 가린 정보를 보여 줘요. 해제 기록이 남았어요.');
    };
    if (typeof reason === 'string' && reason) { apply(reason); return; }
    B.modal({
      title: '마스킹 해제', ok: '해제',
      body: '<div>' + esc(h.mask(st.name)) + ' 원생의 이름과 보호자 번호를 잠깐 보여 줘요. 누가, 언제, 왜 풀었는지 접속기록에 남아요.</div>' +
        '<select class="inp" id="ct06-why" aria-label="해제 사유"><option>보호자 전화 응대</option><option>수납 확인</option><option>서류 발급</option></select>',
      onOk: back => { apply(back.querySelector('#ct06-why').value); },
    });
    return false;
  });
  A6('CT06.consult', ctx => {
    const st = c06student(ctx); if (!st) return false;
    const rs = ctx.s.reservations.filter(r => r.center === st.center && r.student === st.name);
    const body = rs.length ? rs.map(r => { const c = (ctx.s.consults || {})[r.id]; return '<div class="ctb-sub" style="margin-top:0"><b>' + esc('2027-' + r.at + ' ' + r.kind) + '</b><span>결과 ' + esc(r.result) + (c ? ', 상담자 ' + esc(c.counselor) : '') + '</span>' + (c && c.memo ? '<span class="muted">' + esc(c.memo) + '</span>' : '') + '</div>'; }).join('')
      : '<div class="muted">남긴 상담 기록이 없어요. 상담·테스트 예약(CT-02)에서 남긴 기록이 여기에 보여요.</div>';
    B.modal({ title: '상담 기록', body, cancel: '닫기' }); return false;
  });
  A6('CT06.absent', (ctx, d) => { ctx.ui.mkFor = ctx.ui.mkFor === d ? null : d; B.state.tab = 'b'; });
  A6('CT06.makeup', (ctx, arg) => {
    const st = c06student(ctx), s = ctx.s, ui = ctx.ui; if (!st || !ctx.canEdit) return;
    let absent = ui.mkFor, day, cls;
    if (arg && typeof arg === 'object') { absent = arg.absent || absent; day = arg.day; cls = arg.cls; } else if (typeof arg === 'string') { const p = arg.split('|'); day = p[0]; cls = p[1]; }
    const att = s.ct06.att[st.id] || {};
    if (!absent || att[absent] !== '결석') { B.toast('결석한 날을 먼저 골라 주세요.'); return; }
    const list = s.ct06.mk[st.id] = s.ct06.mk[st.id] || [];
    if (list.some(x => x.absent === absent)) { B.toast('이미 보강을 잡은 결석이에요.'); return; }
    if (list.filter(x => x.absent.slice(0, 7) === absent.slice(0, 7)).length >= 2) { B.toast('이번 달 보강은 2회(안)까지예요.'); return; }
    if (!day || day < absent || between(absent, day) > 14) { B.toast('보강은 결석일부터 2주 안(안)에서만 잡을 수 있어요.'); return; }
    const c = s.classes.find(x => x.id === cls);
    list.push({ absent, day, cls: cls || '' });
    logs(s, st); addLog(ctx, st, md(absent) + ' 결석 보강 등록 (' + md(day) + (c ? ' ' + c.name : '') + ')');
    ui.mkFor = null; B.state.tab = 'b';
    B.toast(md(day) + (c ? ' ' + c.name : '') + ' 수업으로 보강을 잡았어요.');
  });
  A6('CT06.receipt', (ctx, m) => {
    const st = c06student(ctx); if (!st) return false;
    const r = hist(ctx.s, st).find(x => x.m === m); if (!r || r.paid == null) return false;
    const un = ctx.ui.unmask === st.id;
    B.modal({ title: mon(m) + ' 영수증', cancel: '닫기', body: '<div class="ctb-rcpt">' + h.kv([['학습자', un ? st.name : h.mask(st.name)], ['과목', '브레인180 ' + prodName(ctx.s, r.pid)], ['교습 기간', m + '-01 ~ ' + md(m + '-' + pad(dim(m)))], ['교습비', money(r.paid)], ['기타경비', r.book ? '교재비 ' + money(r.book) : '없음'], ['합계', '<b>' + money(r.paid + (r.book || 0)) + '</b>', true], ['수단', r.method], ['수납일', r.date]]) + '</div>' });
    return false;
  });
  A6('CT06.req', (ctx, arg) => {
    const st = c06student(ctx), s = ctx.s; if (!st || !ctx.canEdit || isTeacher(ctx)) return;
    let kind = arg, how = ctx.ui.rq_how || RQ_HOW[0];
    if (arg && typeof arg === 'object') { kind = arg.kind; if (arg.how) how = arg.how; }
    kind = kind || '열람';
    const list = s.ct06.req[st.id] = s.ct06.req[st.id] || [];
    list.unshift({ id: 'q' + st.id + '-' + (list.length + 1), at: TODAY, kind, how, due: addDays(TODAY, 10), status: '접수' });
    B.state.tab = 'b';
    B.toast(kind + ' 요청을 접수했어요. 처리 기한은 ' + addDays(TODAY, 10) + '이에요 (예시).');
  });
  A6('CT06.reqDone', (ctx, id) => {
    const st = c06student(ctx), s = ctx.s; if (!st || !ctx.canEdit || isTeacher(ctx)) return;
    const r = (s.ct06.req[st.id] || []).find(x => x.id === id) || (s.ct06.req[st.id] || []).find(x => x.status === '접수'); if (!r) return;
    r.status = '처리 완료'; r.done = TODAY; r.by = ctx.role + ' ' + ctx.persona.name; r.notice = TODAY; r.noticeHow = '알림톡'; B.state.tab = 'b';
    B.toast('요청을 처리하고 보호자에게 결과를 알렸어요. 처리일과 통지일이 남았어요.');
  });

  /* ======================================================================
     CT-07 수강 등록·수납
     ====================================================================== */
  const flow = (s, id) => { ensure(s); return s.ct07.flow[id] = s.ct07.flow[id] || { stage: '작성 중' }; };
  function c07cands(ctx) { return ctx.s.students.filter(x => x.center === ctx.centerId && (x.status === '수납 대기' || x.paid === '미수' || x.status === '상담' || x.status === '대기')); }
  function c07student(ctx) {
    const s = ctx.s, ui = ctx.ui;
    let st = s.students.find(x => x.id === ui.student && x.center === ctx.centerId);
    if (!st) st = s.students.find(x => x.center === ctx.centerId && x.status === '수납 대기') || c07cands(ctx)[0] || null;
    return st;
  }
  function bestClass(s, st) {
    if (st.cls) return st.cls;
    const list = s.classes.filter(c => c.center === st.center && c.enrolled < c.cap);
    const same = list.filter(c => c.level === st.level).sort((a, b) => (b.cap - b.enrolled) - (a.cap - a.enrolled));
    return (same[0] || list[0] || {}).id || '';
  }
  function c07prep(ctx) {
    const st = c07student(ctx); if (!st) return null;
    const ui = ctx.ui, s = ctx.s; ensure(s);
    ui.student = st.id;
    if (ui.cur !== st.id) {
      ['pid', 'start', 'cls', 'mmethod', 'disc', 'reason', 'test', 'book', 'paym', 'approval', 'cashNo', 'ack', 'e'].forEach(k => { delete ui[k]; });
      ui.cur = st.id;
      const info = s.ct05.info[st.id] || {}, sib = info.sibling ? s.students.find(x => x.id === info.sibling) : null;
      const cat = catalog(s, ctx.center);
      ui.pid = cat.some(r => r.pid === st.product && !lockOf(r)) ? st.product : 'pr1';
      // 새로 들어오거나 다시 들어오는 원생은 예시 시작일 3/15로, 이미 다니는 원생(미수 등)은 원래 시작일로 열어요
      ui.start = st.status === '수납 대기' && (!st.since || st.since < TODAY) ? '2027-03-15' : (st.since || '2027-03-15');
      const wc = info.wantCls ? s.classes.find(x => x.id === info.wantCls && (x.enrolled < x.cap || x.id === st.cls)) : null;
      ui.cls = wc ? wc.id : bestClass(s, st);
      ui.mmethod = '회차 기준';
      ui.disc = sib ? '형제 10%' : '없음';
      ui.reason = sib ? '형제 ' + h.mask(sib.name) + ' 재원' : '';
      ui.test = true; ui.book = true; ui.paym = '카드 단말기'; ui.ack = false; ui.cashNo = '';
    }
    // 이미 수납이 기록된 원생(학부모 휴대폰 결제 PA-01, 예전 수납)은 그 기록으로 완료 상태를 보여 줘요
    const f = flow(s, st.id);
    if (f.stage !== '수납 완료' && st.paid === '수납 완료') {
      const pay = s.payments.filter(p => p.student === st.id).slice(-1)[0];
      if (pay) {
        const mm = /(\d+)월/.exec(pay.item || ''), ym = mm ? '2027-' + pad(mm[1]) : TODAY.slice(0, 7);
        const book = /교재비/.test(pay.item || '') ? BOOK : 0;
        const from = st.since && st.since.slice(0, 7) === ym ? st.since : ym + '-01';
        Object.assign(f, { stage: '수납 완료', payId: pay.id, at: '2027-' + pay.date, method: pay.method, approval: pay.approval || '-', total: pay.amount, fee: pay.amount - book, book,
          period: from + ' ~ ' + md(ym + '-' + pad(dim(ym))), pid: st.product || ui.pid, cls: st.cls || ui.cls, snap: [], cash: '', lines: [[pay.item, pay.amount]],
          via: ui.paidVia === 'PA-01' ? '학부모 휴대폰 결제' : '이전 수납 기록' });
        if (st.status === '수납 대기') { st.status = '재원'; if (!st.since) st.since = from; if (!st.product) st.product = ui.pid; }
      }
    }
    return st;
  }
  function c07calc(ctx, st) {
    const s = ctx.s, ui = ctx.ui, cat = catalog(s, ctx.center);
    const row = cat.find(r => r.pid === ui.pid) || cat[1] || cat[0];
    const c = s.classes.find(x => x.id === ui.cls);
    const start = okDate(ui.start) ? ui.start : '2027-03-15', ym = start.slice(0, 7), day = Number(start.slice(8));
    const fee = row.fee, method = ui.mmethod || '회차 기준';
    let base = fee, label = mon(ym) + ' 교습비', bym = ym, pStart = start, frac = '', formula = '', partial = false;
    if (day > 1) {
      partial = true;
      if (method === '회차 기준') {
        const all = c ? sessions(c, ym) : [], after = all.filter(d => d >= start);
        base = all.length ? floor10(fee * after.length / all.length) : 0;
        label += ' ' + num(fee) + ' × ' + after.length + '/' + all.length + '회';
        frac = Number(start.slice(5, 7)) + '/' + day + ' 이후 ' + after.length + '회, ' + mon(ym) + ' ' + all.length + '회 (' + (c ? c.name + ' ' + c.days : '반 없음') + ', 공휴일은 빼고 세요)';
        formula = '월 교습비 × 남은 회차 ÷ 그달 회차';
      } else if (method === '일할') {
        const n = dim(ym), left = n - day + 1;
        base = floor10(fee * left / n); label += ' ' + num(fee) + ' × ' + left + '/' + n + '일';
        frac = Number(start.slice(5, 7)) + '/' + day + '부터 ' + left + '일, ' + mon(ym) + ' ' + n + '일';
        formula = '월 교습비 × 남은 날짜 ÷ 그달 날짜';
      } else {
        bym = nextYm(ym); pStart = bym + '-01'; base = fee; label = mon(bym) + ' 교습비';
        frac = mon(ym) + '은 받지 않고 ' + mon(bym) + ' 1일부터 시작해요';
        formula = '다음 달 교습비 전액';
      }
    }
    const rate = ui.disc === '형제 10%' ? 0.1 : ui.disc === '장기 5%' ? 0.05 : 0;
    const disc = floor10(base * rate);
    const ti = testInfo(s, st);
    const test = ti && ti.valid && ui.test !== false ? TESTFEE : 0;
    const book = ui.book !== false ? BOOK : 0;
    const total = Math.max(0, base - disc - test + book);
    return { row, fee, base, label, partial, frac, formula, method, ym: bym, start: pStart, period: pStart + ' ~ ' + md(bym + '-' + pad(dim(bym))), rate, disc, discLabel: rate ? ui.disc.replace(' ', ' 할인 ') : '', ti, test, book, total, cls: c };
  }
  function polUsed(ctx, cl) {
    const list = [];
    if (!ctx.center || ctx.center.type === '직영') list.push(['POL-11', '직영 교습비 ' + num(cl.fee)]);
    if (cl.partial) list.push(['POL-19', '월중 ' + cl.method]);
    if (cl.disc) list.push(['POL-13', cl.discLabel]);
    if (cl.test) list.push(['POL-28', '테스트비 차감 ' + num(cl.test)]);
    if (cl.book) list.push(['POL-14', '교재비 ' + num(cl.book)]);
    return list.map(([code, what]) => ({ code, what, status: h.pol(code).status, ver: 'v' + ((((B.store.pol || {})[code] || {}).history || []).length + 1) }));
  }
  function c07check(ctx, st, cl, mode) {
    const ui = ctx.ui, s = ctx.s, e = {};
    const f = flow(s, st.id);
    if (f.stage === '수납 완료') { e.top = '이미 수납을 마쳤어요.'; return e; }
    if (!st.consent) e.top = '법정대리인 동의가 없어요. 원생 등록(CT-05)에서 동의부터 받아 주세요.';
    if (lockOf(cl.row)) e.pid = cl.row.name + ' 상품은 ' + lockOf(cl.row) + ' 상태라 팔 수 없어요.';
    const c = cl.cls;
    if (!c) e.cls = '반을 골라 주세요.';
    else if (c.enrolled >= c.cap && c.id !== st.cls) e.cls = c.name + ' 반은 정원(' + c.cap + '명)이 찼어요.';
    if (!okDate(ui.start)) e.start = '수강 시작일을 넣어 주세요.';
    if (cl.rate && !String(ui.reason || '').trim()) e.reason = '할인 사유를 적어 주세요.';
    if (polUsed(ctx, cl).some(x => x.status !== '확정' && x.status !== '법정') && !ui.ack) e.ack = '(안), 예시, 미정 값이 들어간 금액이에요. 슈퍼관리자 임시 적용 승인 기록을 확인해 주세요.';
    if (mode === 'manual' && ui.paym === '카드 단말기' && !/^[0-9A-Za-z-]{6,14}$/.test(String(ui.approval || '').trim())) e.approval = '카드 단말기 승인번호를 넣어 주세요.';
    return e;
  }
  function finishPay(ctx, st, cl, method, approval) {
    const s = ctx.s, ui = ctx.ui, f = flow(s, st.id);
    hist(s, st); logs(s, st);
    let n = s.payments.length + 1; while (s.payments.some(p => p.id === 'pay' + n)) n++;
    const id = 'pay' + n;
    s.payments.push({ id, center: ctx.centerId, date: md(TODAY), student: st.id, item: mon(cl.ym) + ' 교습비' + (cl.book ? ', 교재비' : ''), amount: cl.total, method, approval: approval || '-', receipt: ui.cashNo ? '발급' : '-', by: ctx.persona.name });
    const snap = polUsed(ctx, cl).map(x => ({ code: x.code, what: x.what, status: x.status, ver: x.ver }));
    const lines = [[cl.label, cl.base]].concat(cl.disc ? [[cl.discLabel, -cl.disc]] : [], cl.test ? [['테스트비 차감', -cl.test]] : [], cl.book ? [['교재비', cl.book]] : []);
    Object.assign(f, { lines, via: '', stage: '수납 완료', payId: id, at: TODAY, base: cl.start, method, approval: approval || '-', total: cl.total, fee: cl.total - cl.book, book: cl.book, period: cl.period, pid: cl.row.pid, cls: ui.cls, snap, cash: ui.cashNo || '' });
    const discTxt = [cl.discLabel ? cl.discLabel + ' (' + ui.reason + ')' : '', cl.test ? '테스트비 차감 20,000' : ''].filter(Boolean).join(', ');
    const rows = s.ct06.hist[st.id].filter(r => r.m !== cl.ym);
    rows.unshift({ m: cl.ym, pid: cl.row.pid, fee: cl.fee, disc: discTxt, paid: cl.total - cl.book, date: md(TODAY), acct: '활성', method, book: cl.book });
    s.ct06.hist[st.id] = rows;
    st.product = cl.row.pid; st.status = '재원'; st.paid = '수납 완료'; st.account = '활성'; if (!st.since) st.since = cl.start;
    s.ct07.want[st.id] = ui.cls;
    addLog(ctx, st, mon(cl.ym) + ' 수강권 시작 (' + md(cl.start) + '부터' + (cl.partial ? ', 월중 ' + cl.method : '') + ')');
    addLog(ctx, st, '수납 ' + num(cl.total) + '원 (' + method + '), 학습 계정 열림');
    s.ui['CT-11'] = Object.assign(s.ui['CT-11'] || {}, { assign: st.id, cls: ui.cls });
    B.toast('수납을 기록했어요. 영수증을 보내고 학습 계정을 열었어요.');
  }

  function c07render(ctx) {
    const s = ctx.s, ui = ctx.ui;
    const st = c07prep(ctx);
    if (!st) return h.empty('수납할 원생이 없어요. 원생 등록(CT-05)에서 새 원생을 먼저 등록해 주세요.');
    const f = flow(s, st.id), done = f.stage === '수납 완료', wait = f.stage === '결제 대기', lock = done || wait;
    const ro = !ctx.canEdit, e = ui.e || {};
    const cl = c07calc(ctx, st), cat = catalog(s, ctx.center), info = s.ct05.info[st.id] || {};
    const direct = !ctx.center || ctx.center.type === '직영', linkOk = ctx.center && ctx.center.pay === '결제선생';
    let html = '';
    // 원생 줄
    html += '<div class="ctb-link" style="margin-bottom:10px"><b style="font-size:15px">' + esc(st.name) + ' (' + esc(st.grade) + ')</b>' + h.chip('레벨 ' + (st.level || '-'), 'navy') + stChip(done ? '재원' : st.status) +
      '<span class="muted small">보호자 ' + esc(h.mask(st.guardian)) + ' <span class="mono">' + esc(h.maskPhone(st.phone)) + '</span></span>' +
      (cl.ti ? '<span class="muted small">입학 테스트 ' + esc(md(cl.ti.date)) + '</span>' : '') +
      (info.sibling ? h.chip('형제 연결', 'review') : '') + '</div>';
    const steps = done ? ['done', 'done', 'done', 'done'] : wait ? ['done', 'done', 'cur', ''] : ['done', 'cur', '', ''];
    html += '<div class="card" style="padding:8px 12px;margin-bottom:12px">' + h.steps([{ label: '① 상품' }, { label: '② 할인·차감' }, { label: '③ 결제' }, { label: '④ 영수증·계정 오픈' }].map((x, i) => ({ label: x.label.slice(2), state: steps[i] }))) + '</div>';
    const errs = Object.keys(e).map(k => e[k]).filter(Boolean);
    if (errs.length) html += '<div style="margin-bottom:12px">' + h.alert('<ul class="ctb-ul">' + errs.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' + (e.top && !st.consent ? '<div class="row" style="margin-top:6px">' + h.btn('원생 등록으로 가기', { sm: true, act: 'CT07.toRegister' }) + '</div>' : ''), 'bad', { title: '수납하지 못했어요', raw: true }) + '</div>';

    // 1 상품
    const prod = h.card({
      title: '상품 선택', pin: 1, right: h.polChip('POL-10') + h.polChip('POL-11') + h.polChip('POL-12'),
      body: h.table({
        cols: [
          { label: '', w: '28px', render: r => (lockOf(r) ? '<span class="ctb-rad muted">○</span>' : '<span class="ctb-rad">' + (r.pid === cl.row.pid ? '●' : '○') + '</span>') },
          { label: '상품', render: r => '<b>' + esc(r.name) + '</b>' },
          { label: direct ? '교습비 (본사 확정가)' : '교습비 (센터 결정)', num: true, render: r => num(r.fee) + ' ' + h.chip('예시', 'st-예시') },
          { label: '교육청 등록액', num: true, render: r => (r.filing ? num(r.edu) + '에서 ' + num(r.eduNew) + '<br><span class="muted small">변경신고 중</span>' : num(r.edu)) },
          { label: '판매', render: r => (lockOf(r) ? h.chip('잠김', 'bad') : h.chip('판매', 'ok')) },
        ],
        rows: cat,
        rowAttr: r => (lockOf(r) ? ' class="ctb-off" title="' + esc(lockOf(r)) + ' 상태라 고를 수 없어요"' : ' class="click' + (r.pid === cl.row.pid ? ' sel' : '') + '"' + (lock || ro ? '' : ' data-act="CT07.product" data-arg="' + r.pid + '"')),
      }) + '<div class="muted small" style="margin-top:6px">교육청 등록액을 넘거나 신고가 끝나지 않은 상품은 고를 수 없어요.</div>' + (e.pid ? '<div class="ctb-err">' + esc(e.pid) + '</div>' : ''),
    });
    // 2 시작·월중 처리 (7 검토 반영)
    const clsOpts = s.classes.filter(c => c.center === st.center).map(c => ({ v: c.id, l: c.name + ' (' + c.enrolled + '/' + c.cap + ')' + (c.id === st.cls ? ' 지금 반' : c.enrolled >= c.cap ? ' 정원 마감' : '') + (c.level !== st.level ? ' 레벨 ' + c.level : ''), dis: c.enrolled >= c.cap && c.id !== st.cls }));
    const mOpts = ['회차 기준', '일할', '다음 달부터'].map(v => ({ v, l: v, dis: lock || ro }));
    const startCard = h.card({
      title: '시작·월중 처리', pin: 2, right: h.polChip('POL-18') + h.polChip('POL-19') + h.polChip('POL-16'),
      body: form([
        fr('수강 시작', inp({ f: 'start', type: 'date', v: ui.start, dis: lock || ro, w: '160px', err: e.start }) + '<span class="muted small">월 단위, 1일 시작 (안)</span>', { err: e.start }),
        fr('월중 등록', h.opts(mOpts, cl.method, { act: 'CT07.mmethod' }) + h.chip(h.pol('POL-19').status, 'st-' + h.pol('POL-19').status), { pin: 7, rv: true, hint: cl.partial ? cl.frac + '. 계산식은 ' + cl.formula + '.' : '1일에 시작해서 한 달 치를 받아요.' }),
        fr('반', sel({ f: 'cls', v: ui.cls, opts: clsOpts, dis: lock || ro, err: e.cls }), { err: e.cls, hint: '정원이 남은 반만 고를 수 있어요. 괄호 안은 지금 인원과 정원이에요.' }),
      ]),
    });
    // 3 할인·차감
    const dOpts = ['없음', '형제 10%', '장기 5%'].map(v => ({ v, l: v, dis: lock || ro }));
    const discCard = h.card({
      title: '할인·차감', pin: 3, right: h.polChip('POL-13') + h.polChip('POL-28') + h.polChip('POL-14'),
      body: form([
        fr('할인', h.opts(dOpts, ui.disc || '없음', { act: 'CT07.disc' }) + (cl.rate ? inp({ f: 'reason', v: ui.reason, ph: '할인 사유', dis: lock || ro, err: e.reason, label: '할인 사유' }) : ''), { err: e.reason }),
        fr('테스트비 차감', cl.ti ? chk('test', ui.test !== false && cl.ti.valid, '-20,000', lock || ro || !cl.ti.valid) + h.chip('(안)', 'st-안') + '<span class="muted small">' + esc(md(cl.ti.date)) + ' 테스트, 30일 유효' + (cl.ti.valid ? '' : ', 기간 지남') + '</span>' : '<span class="muted small">연결된 입학 테스트가 없어요</span>'),
        fr('기타경비', chk('book', ui.book !== false, '교재비 15,000', lock || ro) + h.chip('예시', 'st-예시')),
      ]),
    });
    // 계산 요약 (6 검토 반영)
    const used = polUsed(ctx, cl), risky = used.filter(x => x.status !== '확정' && x.status !== '법정');
    const line = (l, v, cls) => '<div' + (cls ? ' class="' + cls + '"' : '') + '><span>' + esc(l) + '</span><span class="money">' + v + '</span></div>';
    const sumCard = h.card({
      title: '금액 계산', sub: done ? '수납 완료' : '예시 값으로 계산',
      body: '<div class="ctb-sum">' + (done ? (f.lines || []).map(x => line(x[0], (x[1] < 0 ? '-' : '') + num(Math.abs(x[1])))).join('') + line('수납한 금액', num(f.total), 'tot')
        : line(cl.label, num(cl.base)) + (cl.disc ? line(cl.discLabel, '-' + num(cl.disc)) : '') + (cl.test ? line('테스트비 차감', '-' + num(cl.test)) : '') + (cl.book ? line('교재비', num(cl.book)) : '') +
        line('결제 금액 (예시)', num(cl.total), 'tot')) + '</div><div class="muted small" style="margin-top:4px">끝전은 10원 미만을 버려요 (예시)</div>' +
        '<div class="ctb-sub review"' + h.p(6) + '>' + (done
          ? (f.via ? '<b>' + esc(f.via) + '로 들어온 수납이에요</b><span>계산 근거는 그 거래에 함께 저장돼 있어요. 기준일 ' + esc(f.at) + '</span>' : '<b>저장한 계산 근거</b><span>' + f.snap.map(x => esc(x.code + ' ' + x.what + ' (' + (x.status === '안' ? '안' : x.status) + ', ' + x.ver + ')')).join(', ') + '. 기준일 ' + esc(f.base || f.at) + ' (수강 시작일), 수납일 ' + esc(f.at) + '</span>')
          : risky.length ? '<b>아직 정하지 않은 값이 금액에 들어갔어요</b><div class="row">' + risky.map(x => '<span class="chip st-' + x.status + '" title="' + esc(h.pol(x.code).name) + '">' + esc(x.code + ' ' + x.what) + '</span>').join('') + '</div>' +
            chk('ack', !!ui.ack, '슈퍼관리자의 임시 적용 승인 기록을 확인했어요', lock || ro) + (e.ack ? '<div class="ctb-err">' + esc(e.ack) + '</div>' : '') + '<span class="small">수납하면 계산에 쓴 정책 값과 버전, 기준일(수강 시작일)을 거래에 함께 저장해요. 영수증과 알림톡에는 (안) 표시 없이 숫자만 나가요.</span>'
            : '<span>금액에 쓴 정책 값이 모두 확정됐어요. 수납하면 값과 버전, 기준일을 거래에 함께 저장해요.</span>') + '</div>',
    });
    // 4 결제 (8 결제 대기, 검토 반영)
    const pOpts = ['카드 단말기', '계좌이체', '현금', '지역화폐'].map(v => ({ v, l: v, dis: lock || ro }));
    let payBody = form([
      fr('수단', h.opts(pOpts, ui.paym || '카드 단말기', { act: 'CT07.paym' }), { hint: '센터가 켠 수단만 보여요. 수단 목록은 예시예요.' }),
      fr('직영', '<span class="ctb-pay"><span class="' + (direct ? 'on' : '') + '">결제선생 링크를 보내면 결제되는 대로 자동 기록해요</span></span>'),
      fr('가맹', '<span class="ctb-pay"><span class="' + (direct ? '' : 'on') + '">단말기로 결제한 뒤 승인번호를 적어요</span></span>'),
    ].concat(ui.paym === '카드 단말기' && !done ? [fr('승인번호', inp({ f: 'approval', v: ui.approval, ph: '단말기 영수증의 승인번호', dis: lock || ro, err: e.approval }), { err: e.approval })] : [])) +
      '<div class="row" style="margin-top:10px">' + h.btn('결제선생 링크 보내기', { primary: direct && !lock, act: 'CT07.sendLink', disabled: lock || ro || !linkOk, title: linkOk ? null : '결제선생을 쓰지 않는 센터예요' }) +
      h.btn('수납 기록', { primary: !direct && !lock, act: 'CT07.pay', disabled: done || ro }) + '</div>';
    if (wait) payBody += '<div class="ctb-sub review"' + h.p(8) + '><div class="row"><b>결제 대기</b>' + h.chip('링크 보냄 ' + f.linkAt.slice(11), 'warn') + '</div>' +
      h.kv([['금액', num(f.total) + '원'], ['링크 유효', '72시간 (예시)'], ['자리 잡아 두기', (cl.cls ? cl.cls.name : '') + ' 1자리, 24시간 (예시)'], ['보낸 횟수', f.sent + '회']]) +
      '<div class="row">' + h.btn('결제 완료 알림 받기 (시연)', { sm: true, primary: true, act: 'CT07.paid' }) + h.btn('링크 다시 보내기', { sm: true, act: 'CT07.resend', disabled: ro }) + h.btn('결제 대기 취소', { sm: true, danger: true, act: 'CT07.cancelWait', disabled: ro }) + '</div></div>';
    const payCard = h.card({ title: '결제', pin: 4, right: h.polChip('POL-36') + h.polChip('POL-37'), body: payBody });
    // 5 영수증·계정
    const p23 = h.pol('POL-23').status;
    const rcCard = h.card({
      title: '영수증·계정', pin: 5, right: h.polChip('POL-23'),
      body: done
        ? '<div class="ctb-rcpt">' + h.kv([['학습자', st.name], ['과목', '브레인180 ' + prodName(s, f.pid)], ['교습 기간', f.period], ['교습비', money(f.fee)], ['기타경비', f.book ? '교재비 ' + money(f.book) : '없음'], ['합계', '<b>' + money(f.total) + '</b>', true], ['수단', f.method + (f.approval !== '-' ? ' ' + f.approval : '')], ['현금영수증', f.cash ? h.maskPhone(f.cash) + ' 발급' : '해당 없음']]) + '</div>' +
          '<div class="row" style="margin-top:8px">' + h.chip('학습 계정 열림 · ' + f.at, 'ok') + '<span class="muted small">수납 확인 즉시 여는 안을 따랐어요</span></div>' +
          '<div class="row" style="margin-top:10px">' + h.btn('반 배정으로 이어서 하기', { primary: true, act: 'CT07.toAssign' }) + h.btn('원생 상세 보기', { act: 'CT07.toDetail' }) + h.btn('영수증 다시 보내기', { act: 'CT07.resendReceipt' }) + '</div>'
        : '<div class="small">영수증에는 학습자 이름, 과목, 교습 기간, 금액을 적어요.</div>' +
          form([fr('현금영수증', inp({ f: 'cashNo', v: ui.cashNo, ph: '휴대폰 번호', dis: lock || ro, label: '현금영수증 휴대폰 번호' })),
            fr('학습 계정', '수납 확인 시 오픈 ' + h.chip('(안)', 'st-안') + '<span class="muted small">POL-23 ' + esc(p23) + ', 수납 확인 즉시, 원장 승인, 가오픈 가운데 정해요</span>')]),
    });
    html += '<div class="ctb-two"><div class="stack">' + prod + startCard + discCard + '</div><div class="stack">' + sumCard + payCard + rcCard + '</div></div>';
    return html;
  }

  B.screen({
    id: 'CT-07', side: 'ct', phase: 'P1a', devices: ['pc', 'tablet'], pages: [52],
    title: '수강 등록·수납', menuLabel: '수강 등록·수납', crumb: '수강·수납 > 수강 등록·수납',
    headActions: ctx => {
      const st = c07student(ctx); if (!st) return '';
      const list = c07cands(ctx); if (!list.some(x => x.id === st.id)) list.unshift(st);
      return pickSel('ct07-pick', list.map(x => ({ id: x.id, label: x.name + ' (' + x.grade + ', ' + (x.status === '재원' && x.paid === '미수' ? '미수' : x.status) + ')' })), st.id);
    },
    render: c07render,
    mount(root) {
      const pk = root.querySelector('#ct07-pick');
      if (pk) pk.addEventListener('change', () => { B.actions['CT07.student'](B.ctx(), pk.value); B.render(); });
      live(root, 'CT-07', ['start', 'cls', 'test', 'book']);
    },
    prd: {
      summary: '새 원생이 들을 상품과 반을 고르고, 할인과 차감을 넣어 금액을 계산해요. 수납하면 영수증을 주고 학습 계정을 열어요.',
      who: '원장과 실장·데스크가 써요. 교사와 보조교사에게는 이 메뉴가 보이지 않아요.',
      items: [
        { n: 1, t: '상품', d: '센터가 파는 상품만 나와요. 직영은 본사가 정한 값을, 가맹은 센터가 정한 교습비를 써요. 교육청 등록액을 넘거나 변경신고 중인 상품은 잠겨서 고를 수 없어요.', pol: ['POL-10', 'POL-11', 'POL-12'], ref: 'p.52 ①' },
        { n: 2, t: '시작·월중 처리', d: '월 단위로 매달 1일에 시작하는 것이 (안)이에요. 달 중간에 시작하면 일할, 다음 달부터, 회차 기준 가운데 정책에서 정한 방식으로 계산해요. 반은 정원이 남은 곳만 고를 수 있어요.', pol: ['POL-18', 'POL-19', 'POL-16'], ref: 'p.52 ②' },
        { n: 3, t: '할인·차감', d: '할인은 센터가 정하고 사유를 꼭 남겨요. 입학 테스트비 20,000원(안)은 테스트 후 30일 안에 등록하면 빼 주고, 교재비 15,000원(예시) 같은 기타경비는 더해요.', pol: ['POL-13', 'POL-28', 'POL-14'], ref: 'p.52 ③' },
        { n: 4, t: '결제', d: '직영은 결제선생 링크로 결제하면 자동으로 기록돼요. 가맹은 센터 단말기로 결제한 뒤 승인번호를 적어요. 수납 수단은 센터가 켜 둔 것만 나와요.', pol: ['POL-36', 'POL-37'], ref: 'p.52 ④' },
        { n: 5, t: '영수증·계정 오픈', d: '영수증에는 학습자 이름, 과목, 교습 기간, 금액을 적어요. 학습 계정은 계정 오픈 정책에 따라 열려요. 지금 화면은 수납을 확인하면 바로 여는 (안)을 따라요.', pol: ['POL-23'], ref: 'p.52 ⑤' },
        { n: 6, t: '(안) 값 경고와 계산 근거 저장', kind: 'review', imp: 'IMP-10', d: '아직 정하지 않은 값으로 실제 돈을 받을 수 있었어요. 금액에 (안), 예시, 미정 값이 들어가면 목록으로 보여 주고, 슈퍼관리자의 임시 적용 승인 기록을 확인해야 수납돼요. 수납할 때 쓴 정책 값과 버전, 기준일(수강 시작일)을 거래와 함께 저장해요.' },
        { n: 7, t: '월중 계산 이름과 식 맞추기', kind: 'review', imp: 'IMP-09', pol: ['POL-19'], d: '원문은 일할이라고 적고 실제로는 회차로 나눴어요(5/9회, 예시). 방식을 고르면 쓰는 식과 숫자가 그대로 보이게 했어요. 회차는 고른 반의 수업 요일로 세고 공휴일은 빼요.' },
        { n: 8, t: '결제 대기 상태', kind: 'review', imp: 'IMP-12', cond: true, reveal: 'CT07.sendLink', revealArg: { ack: true }, d: '결제선생 링크를 보낸 뒤 아직 내지 않은 상태가 없었어요. 결제 대기로 두고 링크 유효 시간과 자리를 잡아 두는 시간(모두 예시)을 보여 줘요. 다시 보내기와 취소도 여기서 해요.' },
      ],
      open: ['월중 등록 계산 방식 (POL-19)', '학습 계정을 여는 때 (POL-23)', '테스트비 차감 금액과 유효 기간 (POL-28)', '기타경비 항목과 금액 (POL-14)', '할인 종류와 상한 (POL-13)', '직영 교습비 확정가 (POL-11)', '결제선생 연동 범위 (POL-36, 답변 기다리는 중)', '끝전을 버리는 단위'],
      rules: ['교육청에 등록한 교습비보다 많이 받을 수 없어요 (학원법, 법정).', '영수증에는 학습자 이름, 과목, 교습 기간, 금액을 적어요.'],
    },
  });

  const c07guard = (ctx, msg) => { const st = c07prep(ctx); if (!st) return null; const f = flow(ctx.s, st.id); if (f.stage !== '작성 중') { B.toast(msg || (f.stage === '결제 대기' ? '결제 대기 중에는 금액을 바꿀 수 없어요. 결제 대기를 먼저 취소해 주세요.' : '이미 수납을 마쳤어요.')); return null; } return st; };
  A7('CT07.student', (ctx, id) => { ctx.ui.student = id; });
  A7('CT07.product', (ctx, pid) => {
    if (!c07guard(ctx)) return;
    const r = catalog(ctx.s, ctx.center).find(x => x.pid === pid); if (!r) return;
    if (lockOf(r)) { B.toast(r.name + ' 상품은 ' + lockOf(r) + ' 상태라 고를 수 없어요.'); return; }
    ctx.ui.pid = pid; if (ctx.ui.e) delete ctx.ui.e.pid;
  });
  A7('CT07.mmethod', (ctx, v) => { if (!c07guard(ctx)) return; ctx.ui.mmethod = v; });
  A7('CT07.disc', (ctx, v) => {
    const st = c07guard(ctx); if (!st) return;
    ctx.ui.disc = v;
    const info = ctx.s.ct05.info[st.id] || {}, sib = info.sibling ? ctx.s.students.find(x => x.id === info.sibling) : null;
    if (v === '형제 10%' && !ctx.ui.reason && sib) ctx.ui.reason = '형제 ' + h.mask(sib.name) + ' 재원';
    if (v === '없음' && ctx.ui.e) delete ctx.ui.e.reason;
  });
  A7('CT07.paym', (ctx, v) => { if (!c07guard(ctx)) return; ctx.ui.paym = v; });
  A7('CT07.sendLink', (ctx, arg) => {
    const st = c07guard(ctx); if (!st || !ctx.canEdit) return;
    if (arg && typeof arg === 'object') Object.assign(ctx.ui, arg);
    if (!ctx.center || ctx.center.pay !== '결제선생') { B.toast('결제선생을 쓰지 않는 센터예요. 단말기로 결제하고 수납 기록을 눌러 주세요.'); return; }
    const cl = c07calc(ctx, st), e = ctx.ui.e = c07check(ctx, st, cl, 'link');
    if (Object.keys(e).length) { B.toast('빨간 글씨를 확인해 주세요.'); return; }
    const f = flow(ctx.s, st.id);
    Object.assign(f, { stage: '결제 대기', linkAt: '2027-03-08 11:58', sent: 1, total: cl.total });
    B.toast('보호자 ' + h.maskPhone(st.phone) + '로 결제선생 링크를 보냈어요.');
  });
  A7('CT07.resend', ctx => { const st = c07prep(ctx); if (!st) return; const f = flow(ctx.s, st.id); if (f.stage !== '결제 대기') return; f.sent = (f.sent || 1) + 1; B.toast('결제 링크를 다시 보냈어요. 유효 시간이 처음부터 다시 시작돼요 (예시).'); });
  A7('CT07.cancelWait', ctx => { const st = c07prep(ctx); if (!st) return; const f = flow(ctx.s, st.id); if (f.stage !== '결제 대기') return; f.stage = '작성 중'; B.toast('결제 대기를 취소했어요. 잡아 둔 자리를 풀었어요.'); });
  A7('CT07.paid', ctx => {
    const st = c07prep(ctx); if (!st) return;
    const f = flow(ctx.s, st.id);
    if (f.stage !== '결제 대기') { B.toast('먼저 결제선생 링크를 보내 주세요.'); return; }
    const cl = c07calc(ctx, st);
    finishPay(ctx, st, cl, '결제선생 링크', 'KP-27030801');
  });
  A7('CT07.pay', (ctx, arg) => {
    const st = c07prep(ctx); if (!st || !ctx.canEdit) return;
    const f = flow(ctx.s, st.id);
    if (f.stage === '수납 완료') { B.toast('이미 수납을 마쳤어요.'); return; }
    if (arg && typeof arg === 'object') { const o = Object.assign({}, arg); if (o.method) { o.paym = o.method; delete o.method; } Object.assign(ctx.ui, o); }
    const cl = c07calc(ctx, st), e = ctx.ui.e = c07check(ctx, st, cl, 'manual');
    if (Object.keys(e).length) { B.toast('빨간 글씨를 확인해 주세요.'); return; }
    if (f.stage === '결제 대기') f.stage = '작성 중';
    finishPay(ctx, st, cl, ctx.ui.paym || '카드 단말기', ctx.ui.paym === '카드 단말기' ? String(ctx.ui.approval).trim() : '-');
  });
  A7('CT07.toAssign', ctx => {
    const st = c07prep(ctx); if (!st) return;
    ctx.s.ui['CT-11'] = Object.assign(ctx.s.ui['CT-11'] || {}, { assign: st.id, cls: ctx.s.ct07.want[st.id] || ctx.ui.cls });
    return goOr('CT-11', '반·시간표(CT-11) 화면으로 원생을 넘겼어요.');
  });
  A7('CT07.toDetail', ctx => { const st = c07prep(ctx); if (!st) return; ctx.s.ui['CT-06'] = Object.assign(ctx.s.ui['CT-06'] || {}, { student: st.id }); B.go('CT-06'); return false; });
  A7('CT07.toRegister', ctx => {
    const st = c07prep(ctx); if (!st) return;
    ctx.s.ui['CT-05'] = { name: st.name, grade: st.grade, phone: st.phone, g_name: st.guardian, level: st.level };
    return goOr('CT-05', '원생 등록(CT-05)으로 정보를 넘겼어요.');
  });
  A7('CT07.resendReceipt', ctx => { const st = c07prep(ctx); if (!st) return; B.toast('보호자 ' + h.maskPhone(st.phone) + '로 영수증을 다시 보냈어요.'); });
})();
