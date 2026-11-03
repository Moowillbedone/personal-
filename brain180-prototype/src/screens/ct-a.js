/* CT-01 대시보드 (p.45), CT-03 입학 테스트·결과지 (p.47), CT-04 원생 목록 (p.48). */
(function () {
  const B = window.B, h = B.h, esc = B.esc;

  /* ---------- styles used only by this file (prefix cta-) ---------- */
  (function () {
    if (document.getElementById('cta-style')) return;
    const st = document.createElement('style');
    st.id = 'cta-style';
    st.textContent = [
      '.cta-g5{display:grid;gap:12px;grid-template-columns:repeat(5,minmax(0,1fr))}',
      '.cta-kpi{cursor:pointer}.cta-kpi:hover{border-color:#c4c9d3}',
      '.cta-kpi .lockv{font-size:13px;font-weight:700;color:var(--mute);padding:6px 0 2px}',
      '.cta-split{display:grid;gap:12px;grid-template-columns:minmax(0,1.12fr) minmax(0,1fr);align-items:start;margin-top:12px}',
      '.cta-sec{padding:4px 0 6px;border-top:1px solid var(--line-2)}.cta-sec:first-of-type{border-top:0}',
      '.cta-sec>h4{margin:6px 0 2px;font-size:11.5px;color:var(--sub);font-weight:700;display:flex;gap:6px;align-items:center}',
      '.cta-row{display:grid;grid-template-columns:62px minmax(0,1fr) auto 24px;gap:8px;align-items:center;padding:6px 0}',
      '.cta-row .t b{display:block;font-size:12.5px;line-height:1.4}.cta-row .t span{display:block;font-size:11.3px;color:var(--mute);line-height:1.4}',
      '.cta-row.done{opacity:.5}.cta-row.done .t b{text-decoration:line-through}',
      '.cta-row .chip{justify-content:center}',
      '.cta-chk{width:22px;height:22px;border:1.5px solid #c4c9d3;border-radius:6px;background:#fff;display:grid;place-items:center;font-size:12px;font-weight:800;color:#fff;padding:0}',
      '.cta-chk.on{background:var(--ok);border-color:var(--ok)}.cta-chk:disabled{opacity:.5}',
      '.cta-none{font-size:12px;color:var(--mute);padding:6px 0 4px}',
      '.cta-news>div{display:flex;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid var(--line-2);font-size:12.3px;cursor:pointer}',
      '.cta-news>div:last-child{border-bottom:0}.cta-news .dot{width:7px;height:7px;border-radius:50%;background:var(--brand);flex:none}.cta-news .dot.read{background:#d7dbe2}',
      '.cta-news .d{margin-left:auto;color:var(--mute);font-size:11.5px;white-space:nowrap}',
      '.cta-test{display:grid;gap:12px;grid-template-columns:minmax(0,1fr) 350px;align-items:start}',
      '.cta-form{display:grid;grid-template-columns:104px minmax(0,1fr);gap:9px 12px;align-items:center;font-size:12.5px}',
      '.cta-form>.k{color:var(--sub);font-weight:600}.cta-form>.v{min-width:0;display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
      '.cta-form>.v .inp{max-width:230px}.cta-form>.v.pin-host{padding-left:16px}',
      '.cta-check{display:flex;gap:8px;align-items:flex-start;font-size:12px;line-height:1.5;cursor:pointer}.cta-check input{margin-top:3px;flex:none}',
      '.cta-pinth{display:inline-block;padding-left:19px}',
      '.cta-pinpad{padding-left:18px}',
      '.cta-fee .cta-form{grid-template-columns:58px minmax(0,1fr)}',
      '.cta-who{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px}',
      '.cta-who .nm{font-size:15px;font-weight:800}',
      '.cta-sheet{border:1px solid var(--line);border-radius:10px;padding:14px 16px;background:#fff}',
      '.cta-sheet h4{margin:0 0 4px;font-size:14px}.cta-sheet .meta{font-size:11.5px;color:var(--sub);margin-bottom:10px}',
      '.cta-sheet .res{display:grid;grid-template-columns:76px minmax(0,1fr);gap:4px 10px;font-size:12.5px;margin-bottom:10px}',
      '.cta-sheet .res dt{color:var(--sub)}.cta-sheet .res dd{margin:0;font-weight:700}',
      '.cta-err{font-size:11px;color:var(--bad);font-weight:600;width:100%}',
      '.cta-filter{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.cta-filter .field{width:118px}.cta-filter .field.q{width:150px}',
      '.cta-bulk{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px;font-size:12.3px}',
      '.cta-bulk.pin-host{padding-left:16px}.cta-bulk .pg{margin-left:auto;color:var(--sub);font-size:12px;display:flex;gap:6px}.cta-bulk .pg b{color:var(--ink)}',
      '.cta-mini{border:1px solid var(--line);background:#fff;border-radius:6px;font-size:11px;padding:1px 6px;margin-left:4px;font-weight:600}',
      '.cta-log{font-size:11.8px;color:var(--sub);display:flex;flex-direction:column;gap:3px;margin-top:8px}',
    ].join('\n');
    document.head.appendChild(st);
  })();

  /* ---------- helpers ---------- */
  const U = (ctx, id) => (ctx.s.ui[id] = ctx.s.ui[id] || {});
  const toT = d => Date.parse(d + 'T00:00:00Z');
  const dday = (today, d) => Math.round((toT(d) - toT(today)) / 86400000);
  const addDays = (d, n) => new Date(toT(d) + n * 86400000).toISOString().slice(0, 10);
  const addMonths = (d, n) => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, dd)).toISOString().slice(0, 10); };
  const md = d => { const p = String(d).split('-'); return Number(p[1]) + '/' + Number(p[2]); };
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  const wd = d => WEEK[new Date(toT(d)).getUTCDay()];
  const ddChip = n => n == null ? '' : n < 0 ? h.chip('기한 지남', 'bad') : n === 0 ? h.chip('오늘', 'bad') : h.chip('D-' + n, n <= 3 ? 'bad' : n <= 7 ? 'warn' : 'line');
  const blindMoney = ctx => ctx.side === 'ct' && (ctx.role === '교사' || ctx.role === '보조교사');
  // 이 사람이 열 수 없는 화면(7쪽 권한표에서 –)으로 가는 버튼은 그리지 않아요.
  const canOpen = (ctx, id) => B.perm(id, ctx.persona) !== '–';
  const isUnread = (n, cid) => !(n.read || {})[cid];
  const clock = s => { s.ctaClock = (s.ctaClock || 0) + 1; const m = 9 * 60 + 40 + s.ctaClock * 4; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  const shortWho = ctx => ctx.persona.name + ' (' + String(ctx.center ? ctx.center.name : '').replace('센터', '') + ' ' + (ctx.role === '실장·데스크' ? '실장' : ctx.role) + ')';
  const gradeLabel = n => n == null ? '-' : n <= 0 ? '미취학' : n <= 6 ? '초' + n : n <= 9 ? '중' + (n - 6) : '고' + (n - 9);
  const gradeNum = g => { if (!g) return null; if (g === '미취학') return 0; const m = /^(초|중|고)(\d)/.exec(g); if (!m) return null; return Number(m[2]) + (m[1] === '중' ? 6 : m[1] === '고' ? 9 : 0); };
  // 3월 1일 학년도 기준. 1이면 초1
  const gradeFromBirth = (birth, today) => {
    const m = /^(\d{4})-\d{2}-\d{2}$/.exec(birth || ''); if (!m) return null;
    const [ty, tm] = today.split('-').map(Number);
    return (tm >= 3 ? ty : ty - 1) - Number(m[1]) - 6;
  };
  const polNum = (code, center, fb) => { const v = h.polValue(code, center).value; const m = /(\d[\d,]*)/.exec(String(v)); return m ? Number(m[1].replace(/,/g, '')) : fb; };
  const ACC = { '활성': 'ok', '가오픈': 'info', '유예': 'warn', '정지': 'bad' };

  /* ---------- data ---------- */
  B.extend(s => {
    s.ct01 = s.ct01 || {
      kpi: { daechi1: { attend: '13 / 29', attendSub: '입실 13, 결석 1, 예정 14', capPct: '정원 대비 85%', newOut: '14 / 3', wait: '대기 2', rereg: '71 / 128', unpaidCnt: 4, unpaidAmt: 1040000 } },
      refunds: [{ id: 'rf1', center: 'daechi1', name: '정*호', grade: '초5', occurred: '2027-03-06', amount: 173340 }],
      locks: [{ id: 'lk1', center: 'daechi1', title: '교습비 변경신고 대기', sub: '주 3회 상품 판매가 잠겨 있어요' }],
      noOut: [{ id: 'no1', center: 'daechi1', n: 2, when: '지난 수요일' }],
      rereg: { daechi1: { target: 128, out: 5, billed: 123 } },
      // 원문 예시의 반, 시각, 인원은 그대로 두고 교사만 교직원 명단에 있는 사람으로 맞춰요 (IMP-16, 명단에 없는 교사 배치 예시를 고침)
      timetable: { daechi1: [
        { time: '16:10~17:40', cls: 'L3-월수A', teacher: '서도윤', n: 15, cap: 15, in: 13 },
        { time: '17:50~19:20', cls: 'L2-월수B', teacher: '한결', n: 14, cap: 15, in: null },
      ] },
      orderDue: { day: 3, time: '18:00', ship: '금' },
      done: {},
    };
    s.ct03 = s.ct03 || { runs: {}, edu: '확인 전', minGrade: 1, pad: '센터 패드 #2' };
    s.ct04 = s.ct04 || { totals: { daechi1: { '휴원': 4, '대기': 2 } }, rereg: {}, pending: {}, history: [] };
    // 공지는 CT-17(공지·자료실) 데이터를 쓴다. CT-17이 없는 빌드에서만 같은 id로 넣는다.
    if (Array.isArray(s.notices) && !B.screens['CT-17']) {
      const addN = n => { if (!s.notices.some(x => x.id === n.id || x.title === n.title)) s.notices.push(n); };
      addN({ id: 'n-ct17-1', title: '4월 재등록 안내 문구 변경', must: true, date: '2027-03-05', cat: '운영', read: { daechi1: false, mokdong: true, bundang: false } });
      addN({ id: 'n-ct17-2', title: 'L3 워크북 개정 사항', must: false, date: '2027-03-02', cat: '교육', read: { daechi1: true, mokdong: false, bundang: false } });
    }
    if (Array.isArray(s.reservations) && !s.reservations.some(r => r.kind === '재테스트' && r.center === 'daechi1' && /^03-08/.test(r.at))) {
      s.reservations.push({ id: 'r-rt1', center: 'daechi1', at: '03-08 18:00', student: '오지호', grade: '초5', kind: '재테스트', route: '방문', guardianPhone: '010-7723-4456', status: '예약', result: '-' });
    }
  });

  /* =====================================================================
     CT-01 대시보드
     ===================================================================== */
  function kpiBox(o, ctx) {
    const go = o.go && canOpen(ctx, o.go) ? o.go : null;
    return '<div class="kpi' + (go ? ' cta-kpi' : '') + ' ' + (o.tone || '') + '"' + h.p(o.pin) + (go ? ' data-go="' + go + '" title="' + esc(o.title || '') + '"' : '') + '>' +
      '<div class="l">' + esc(o.l) + '</div>' + (o.lock ? '<div class="lockv">원장과 실장만 봐요</div>' : '<div class="v">' + esc(o.v) + '</div>') +
      '<div class="s">' + (o.rawS ? o.s : esc(o.s || '')) + '</div></div>';
  }
  function rereqPeriod(ctx) {
    const v = h.polValue('POL-24', ctx.center);
    const start = Number((/(\d+)일/.exec(String(v.value)) || [0, 20])[1]);
    const [y, m] = ctx.today.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const st = v.status && v.status !== '확정' ? ' (' + (v.status === '안' ? '안' : v.status) + ')' : '';
    return { start: y + '-' + String(m).padStart(2, '0') + '-' + String(start).padStart(2, '0'), text: m + '/' + start + '~' + m + '/' + last + st, next: (m % 12) + 1 };
  }
  function todoRow(ctx, r) {
    const done = !!((ctx.s.ct01.done[ctx.centerId] || {})[r.key]);
    return '<div class="cta-row' + (done ? ' done' : '') + '">' + (r.chip || ddChip(r.d)) +
      '<div class="t"><b>' + esc(r.title) + '</b>' + (r.sub ? '<span>' + esc(r.sub) + '</span>' : '') + '</div>' +
      (r.btn && (!r.to || canOpen(ctx, r.to)) ? h.btn(r.btn, { sm: true, act: r.act, arg: r.arg }) : '<span></span>') +
      '<button type="button" class="cta-chk' + (done ? ' on' : '') + '" data-act="CT01.done" data-arg="' + esc(r.key) + '" title="' + (done ? '처리 취소' : '처리했어요') + '"' + (ctx.canEdit ? '' : ' disabled') + '>' + (done ? '✓' : '') + '</button></div>';
  }
  function sortRows(ctx, rows) {
    const dn = ctx.s.ct01.done[ctx.centerId] || {};
    return rows.slice().sort((a, b) => (dn[a.key] ? 1 : 0) - (dn[b.key] ? 1 : 0) || (a.d == null ? 99 : a.d) - (b.d == null ? 99 : b.d));
  }
  function todoData(ctx) {
    const s = ctx.s, cid = ctx.centerId, c = ctx.center, blind = blindMoney(ctx), today = ctx.today;
    const A = [], M = [], C = [], T = [];
    if (!blind) {
      s.ct01.refunds.filter(x => x.center === cid).forEach(x => {
        const due = addDays(x.occurred, 5);
        A.push({ key: x.id, d: dday(today, due), title: '환불 반환 기한 ' + x.name + ' (' + x.grade + ')', sub: '사유 발생 ' + md(x.occurred) + ', 기한 ' + md(due) + ' (5일, 법정), ' + h.money(x.amount), btn: '환불 처리', act: 'CT01.open', arg: 'CT-10|' + x.id, to: 'CT-10' });
      });
      s.ct01.locks.filter(x => x.center === cid).forEach(x => A.push({ key: x.id, chip: h.chip('신고 대기', 'warn'), d: null, title: x.title, sub: x.sub, btn: '교습비 보기', act: 'CT01.open', arg: 'CT-18', to: 'CT-18' }));
    }
    s.ct01.noOut.filter(x => x.center === cid).forEach(x => A.push({ key: x.id, chip: h.chip('확인', 'warn'), d: null, title: '미퇴실 ' + x.n + '명 (' + x.when + ')', sub: '퇴실 기록이 없어요. 하원했는지 확인해요', btn: '출결 확인', act: 'CT01.open', arg: 'CT-12', to: 'CT-12' }));
    // 읽음 기준은 공지·자료실(CT-17)과 같아요. 이 센터 읽음 표시가 없으면 안 읽은 공지예요.
    const unread = (s.notices || []).filter(n => n.must && isUnread(n, cid));
    if (unread.length) A.push({ key: 'notice', chip: h.chip('필독', 'bad'), d: null, title: '본사 필독 공지 ' + unread.length + '건 미확인', sub: unread.map(n => n.title).join(', '), btn: '공지 열기', act: 'CT01.notice', arg: unread[0].id });
    if (c && c.type !== '직영') {
      const bal = ((s.alim || {}).balances || {})[cid];
      if (bal != null) {
        const per = Math.max(1, c.students * 2 * polNum('POL-34', c, 7));
        const days = Math.floor(bal / per), low = days <= 7;
        A.push({ key: 'alim', chip: h.chip(low ? '잔액 부족' : '잔액', low ? 'bad' : 'line'), d: null, title: '알림톡 잔액 ' + h.money(bal), sub: '입·퇴실 알림만 보내면 약 ' + days + '일 쓸 수 있어요. 7일치 아래면 부족으로 띄워요 (예시)', btn: '충전하기', act: 'CT01.open', arg: 'CT-14', to: 'CT-14' });
      }
    }
    if (!blind) {
      const p = rereqPeriod(ctx), rr = s.ct01.rereg[cid];
      const dd = dday(today, p.start);
      M.push({ key: 'rereg', d: dd, title: p.next + '월 재등록 청구 ' + (dd > 0 ? md(p.start) + ' 시작' : '진행 중'), sub: '기간 ' + p.text + (rr ? ', 대상 ' + rr.target + '명 중 휴원 예정과 퇴원 예정 ' + rr.out + '명을 빼고 ' + rr.billed + '명 (예시)' : ''), btn: '재등록 준비', act: 'CT01.open', arg: 'CT-08', to: 'CT-08' });
      const k = s.ct01.kpi[cid];
      const unpaid = k ? { n: k.unpaidCnt, amt: k.unpaidAmt } : { n: s.students.filter(x => x.center === cid && x.paid === '미수').length, amt: null };
      if (unpaid.n) M.push({ key: 'unpaid', chip: h.chip('미수', 'bad'), d: 0, title: '미수 ' + unpaid.n + '건' + (unpaid.amt ? ' ' + h.money(unpaid.amt) : ''), sub: '미납 안내를 다시 보내고 수납을 확인해요', btn: '미수 보기', act: 'CT01.open', arg: 'CT-09', to: 'CT-09' });
      if (c && c.type !== '직영') (s.invoices || []).filter(iv => iv.center === cid && iv.status !== '입금 완료').forEach(iv => {
        M.push({ key: 'inv-' + iv.id, chip: h.chip(iv.status, 'warn'), d: null, title: iv.month.slice(5).replace(/^0/, '') + '월 청구서 ' + iv.status, sub: '본사 청구서를 확인하고 납부 기한 ' + iv.due + '까지 내요', btn: '청구서 보기', act: 'CT01.open', arg: 'CT-15', to: 'CT-15' });
      });
      // 교재 주문 마감 (CT-16 원문 예시 수 18:00 마감, 금 출고)
      const od = s.ct01.orderDue, wd0 = new Date(toT(today)).getUTCDay();
      const due = addDays(today, (od.day - wd0 + 7) % 7);
      M.push({ key: 'order', d: dday(today, due), title: '이번 주 교재 주문 마감 ' + md(due) + ' (' + wd(due) + ') ' + od.time, sub: '마감까지 주문한 교재는 ' + od.ship + '요일에 나가요 (예시)', btn: '주문하기', act: 'CT01.open', arg: 'CT-16', to: 'CT-16' });
    }
    s.reservations.filter(r => r.center === cid && r.result === '보류').forEach(r => {
      const rec = (s.consults || {})[r.id] || {};
      const d = rec.recall ? dday(today, rec.recall) : null;
      C.push({ key: 'hold-' + r.id, d, chip: d == null ? h.chip('날짜 미정', 'warn') : null, title: '보류 상담 후속 ' + h.mask(r.student) + ' (' + r.grade + ')', sub: (rec.recall ? '다시 연락할 날 ' + md(rec.recall) : '다시 연락할 날을 정해 주세요') + ', 상담일 ' + r.at.slice(0, 5).replace('-', '/'), btn: '상담 기록', act: 'CT01.open', arg: 'CT-02|' + r.id, to: 'CT-02' });
    });
    // 수업에 넣을 수 있는지는 교직원 계정(CT-20)과 같은 규칙으로 봐요. 경력 조회일, 강사와 보조의 교육청 통보일.
    const teach = x => {
      if (B.staffCanTeach) return B.staffCanTeach(x.id, s);
      if (!x.check) return { ok: false, why: '경력 조회 전' };
      if ((x.role === '교사' || x.role === '보조교사') && (!x.notified || x.notified === '-')) return { ok: false, why: '교육청 통보일 없음' };
      return { ok: true };
    };
    const blocked = (s.staff || []).filter(x => x.center === cid && x.role !== '실장·데스크' && !/퇴사/.test(x.status || '')).map(x => ({ x, r: teach(x) })).filter(o => !o.r.ok);
    if (blocked.length) T.push({ key: 'staffcheck', chip: h.chip('배치 불가', 'bad'), d: null, title: '수업에 넣을 수 없는 교직원 ' + blocked.length + '명', sub: blocked.map(o => h.mask(o.x.name) + ' (' + o.x.role + ', ' + o.r.why + ')').join(', ') + '. 조회와 통보를 마치기 전에는 반과 시간표에 넣을 수 없어요', btn: '교직원 계정', act: 'CT01.open', arg: 'CT-20', to: 'CT-20' });
    return { A, M, C, T };
  }
  function todoCard(ctx) {
    const t = todoData(ctx), dn = ctx.s.ct01.done[ctx.centerId] || {}, blind = blindMoney(ctx);
    const seeConsult = canOpen(ctx, 'CT-02'), seeStaff = canOpen(ctx, 'CT-20');
    const all = t.A.concat(blind ? [] : t.M, seeConsult ? t.C : [], seeStaff ? t.T : []), left = all.filter(r => !dn[r.key]).length;
    const sec = (title, rows, pin, none) => '<div class="cta-sec"' + h.p(pin) + '><h4>' + esc(title) + ' <span class="muted">' + rows.length + '</span></h4>' +
      (rows.length ? sortRows(ctx, rows).map(r => todoRow(ctx, r)).join('') : '<div class="cta-none">' + esc(none) + '</div>') + '</div>';
    const hidden = (title, pin, text) => '<div class="cta-sec"' + h.p(pin) + '><h4>' + esc(title) + '</h4><div class="cta-none">' + esc(text) + '</div></div>';
    return h.card({
      title: '오늘 할 일', sub: '남은 일 ' + left + '건, 기한이 가까운 순서', id: 'ct01-todo',
      body: sec('기한·경고', t.A, 3, '오늘 기한이 걸린 일이 없어요.') +
        (blind ? hidden('이번 달 일정', 8, '재등록, 미수, 환불, 주문 같은 돈 관련 일은 원장과 실장에게만 보여요.') : sec('이번 달 일정', t.M, 8, '이번 달 일정이 없어요.')) +
        (seeConsult ? sec('상담 후속', t.C, 7, '보류로 둔 상담이 없어요.') : hidden('상담 후속', 7, '상담 기록은 원장, 실장, 교사에게만 보여요.')) +
        (seeStaff ? sec('교직원', t.T, 9, '수업에 넣지 못하는 교직원이 없어요.') : hidden('교직원', 9, '교직원 경력 조회 상태는 원장에게만 보여요.')),
    });
  }
  function timetableCard(ctx) {
    const s = ctx.s, cid = ctx.centerId, c = ctx.center;
    let rows = (s.ct01.timetable[cid] || null);
    if (!rows) {
      const w = wd(ctx.today);
      rows = s.classes.filter(c => c.center === cid && c.days.indexOf(w) >= 0).map(c => ({ time: c.time, cls: c.name, teacher: c.teacher + (c.assistant ? ' · 보조 ' + c.assistant : ''), n: c.enrolled, cap: c.cap, in: null }));
    }
    return h.card({
      title: '오늘 시간표', sub: wd(ctx.today) + '요일 ' + rows.length + '타임', pin: 4,
      body: h.table({
        cols: [
          { label: '타임', k: 'time' }, { label: '반', k: 'cls' }, { label: '교사', k: 'teacher' },
          { label: '인원', num: true, render: r => '<span class="' + (r.n >= r.cap ? 'money' : '') + '">' + r.n + '/' + r.cap + '</span>' },
          { label: '입실', num: true, render: r => r.in == null ? '<span class="muted">-</span>' : String(r.in) },
        ],
        rows, rowAttr: () => ' class="click" data-go="CT-12"', empty: '오늘은 수업이 없어요.',
      }) + '<div class="small muted" style="margin-top:8px">반 정원은 센터 상한 안에서만 잡혀요. ' +
        (c && c.facility === '교습소' ? '교습소는 동시 ' + c.timeCap + '명까지예요 ' + h.chip('법정', 'st-법정') : '타임당 ' + h.pv('POL-16', c)) + '</div>',
    });
  }
  function consultCard(ctx) {
    const s = ctx.s, mmdd = ctx.today.slice(5);
    const rows = s.reservations.filter(r => r.center === ctx.centerId && r.at.slice(0, 5) === mmdd).sort((a, b) => a.at < b.at ? -1 : 1);
    const can = canOpen(ctx, 'CT-02');
    return h.card({
      title: '오늘 상담·테스트', sub: rows.length + '건', pin: 5,
      body: h.table({
        cols: [
          { label: '시각', render: r => esc(r.at.slice(6)) },
          { label: '학생', render: r => esc(h.mask(r.student)) + ' <span class="muted small">(' + esc(r.grade) + ')</span>' },
          { label: '구분', k: 'kind' }, { label: '상태', render: r => h.status(r.status) },
        ],
        rows, rowAttr: r => can ? ' class="click" data-act="CT01.openRes" data-arg="' + r.id + '"' : '', empty: '오늘은 상담과 테스트 예약이 없어요.',
      }),
    });
  }
  function newsCard(ctx) {
    const s = ctx.s, cid = ctx.centerId, c = ctx.center;
    const list = (s.notices || []).slice().sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 3);
    let body = '<div class="cta-news">' + list.map(n => {
      const read = !isUnread(n, cid);
      return '<div data-act="CT01.notice" data-arg="' + esc(n.id) + '"><span class="dot' + (read ? ' read' : '') + '"></span>' + (n.must ? h.chip('필독', 'bad') : '') + '<span>' + esc(n.title) + '</span><span class="d">' + md(n.date) + '</span></div>';
    }).join('');
    if (c && c.type !== '직영') body += '<div' + (canOpen(ctx, 'CT-15') ? ' data-act="CT01.open" data-arg="CT-15"' : '') + '><span class="dot read"></span>' + h.chip('청구서', 'brand') + '<span>4월 청구서 확인 기간 4/5~4/8</span><span class="d">가맹</span></div>';
    body += '</div>';
    return h.card({ title: '본사 소식', sub: c && c.type === '직영' ? '직영은 청구서 일정이 없어요' : '공지와 청구서 일정', pin: 6, body });
  }

  B.screen({
    id: 'CT-01', side: 'ct', phase: 'P1a', devices: ['pc', 'tablet'], pages: [45],
    title: '대시보드', menuLabel: '대시보드', crumb: '센터 관리자 홈',
    headActions: ctx => '<span class="chip line" style="padding:6px 11px;font-size:12px">오늘 ' + esc(ctx.today) + ' (' + wd(ctx.today) + ')</span>',
    render(ctx) {
      const s = ctx.s, cid = ctx.centerId, c = ctx.center, blind = blindMoney(ctx);
      const k = s.ct01.kpi[cid] || {
        attend: '-', attendSub: '집계할 수업이 없어요', capPct: '정원 대비 -', newOut: '-', wait: '대기 -', rereg: '-',
        unpaidCnt: s.students.filter(x => x.center === cid && x.paid === '미수').length, unpaidAmt: null,
      };
      const p = rereqPeriod(ctx);
      let html = '<div class="cta-g5">';
      html += kpiBox({ l: '오늘 출결', v: k.attend, s: k.attendSub, go: 'CT-12', pin: 1, title: '출결 화면으로 가요' }, ctx);
      html += kpiBox({ l: '재원생', v: h.num(c ? c.students : 0), s: k.capPct, go: 'CT-04', title: '원생 목록으로 가요' }, ctx);
      html += kpiBox({ l: '이번 달 신규 / 퇴원', v: k.newOut, s: k.wait, go: 'CT-04' }, ctx);
      html += kpiBox({ l: p.next + '월 재등록', v: k.rereg, s: '기간 ' + p.text, go: blind ? null : 'CT-08', pin: 2, lock: blind, title: '재등록 화면으로 가요' }, ctx);
      html += kpiBox({ l: '미수', v: k.unpaidCnt + '건', s: blind ? '돈 관련 숫자는 가려져요' : k.unpaidAmt ? h.money(k.unpaidAmt) : '-', go: blind ? null : 'CT-09', pin: 10, lock: blind, tone: !blind && k.unpaidCnt ? 'bad' : '', title: '수납·미수 화면으로 가요' }, ctx);
      html += '</div>';
      html += '<div class="cta-split">' + todoCard(ctx) + '<div class="stack">' + timetableCard(ctx) + consultCard(ctx) + newsCard(ctx) + '</div></div>';
      return html;
    },
    prd: {
      summary: '원장과 실장이 출근해서 가장 먼저 보는 화면이에요. 오늘 처리할 일을 기한이 가까운 순서로 모으고, 출결과 학생 수, 시간표, 상담 예약, 본사 소식을 한곳에 보여 줘요.',
      who: '원장과 실장·데스크가 써요. 교사와 보조교사는 보기만 해요(7쪽 권한표). 여러 센터를 가진 원장은 위쪽 센터 이름을 눌러 바꿔 봐요(CM-02).',
      items: [
        { n: 1, t: '오늘 출결', d: '학생이 키오스크에서 찍은 입실과 퇴실 기록으로 세요. 예시는 13/29예요. 카드를 누르면 출결 화면(CT-12)으로 가요.', pol: ['POL-39'], ref: 'p.45 ①' },
        { n: 2, t: '재등록 진행률', d: '재등록 청구 기간(3/20~3/31, 안)에 다음 달 수납을 마친 학생 수를 보여 줘요. 예시는 71/128이에요. 누르면 재등록 화면(CT-08)으로 가요.', pol: ['POL-24'], ref: 'p.45 ②' },
        { n: 3, t: '기한·경고', d: '환불 반환 기한(사유가 생긴 날부터 5일, 법정), 교육청 변경신고를 기다리느라 판매가 잠긴 상품, 미퇴실, 안 읽은 필독 공지를 모아요. 가맹 센터에는 알림톡 잔액 부족도 떠요. 처리한 일은 오른쪽 칸을 체크하면 아래로 내려가요.', pol: ['POL-25', 'POL-12', 'POL-34'], ref: 'p.45 ③' },
        { n: 4, t: '오늘 시간표', d: '시간대마다 반, 교사, 정원 대비 인원, 입실 수를 보여 줘요. 반 정원은 센터 상한(타임당 15명, 안) 안에서만 잡혀요. 교습소는 동시 9명(법정)이 상한이에요.', pol: ['POL-16', 'POL-15'], ref: 'p.45 ④' },
        { n: 5, t: '오늘 상담·테스트', d: '오늘 잡힌 상담, 입학 테스트, 재테스트 예약이에요. 테스트 줄을 누르면 입학 테스트 화면(CT-03)이, 상담 줄을 누르면 예약 화면(CT-02)이 열려요.', ref: 'p.45 ⑤' },
        { n: 6, t: '본사 소식', d: '본사 공지와 청구서 일정을 보여 줘요. 필독 공지를 열어 확인하면 기한·경고에서 빠져요. 직영 센터는 본사 청구서를 받지 않아서 청구서 일정이 안 나와요.', ref: 'p.45 ⑥' },
        { n: 7, t: '보류 상담 후속', kind: 'review', imp: 'IMP-18', d: '상담 결과를 보류로 둔 학생은 다시 연락할 날이 오늘 할 일에 올라와요. 누르면 그 상담 기록(CT-02)이 열려서 바로 전화하고 결과를 고칠 수 있어요.' },
        { n: 8, t: '이번 달 일정', kind: 'review', imp: ['IMP-28', 'IMP-12'], d: '재등록 청구 시작까지 남은 날, 미수, 가맹 센터의 청구서 확인, 이번 주 교재 주문 마감을 할 일로 올려요. 재등록 대상은 CT-08처럼 휴원 예정과 퇴원 예정을 뺀 수로 세요. 혼자 운영하는 교습소 원장도 이번 달에 놓치면 안 되는 일을 한눈에 봐요.', pol: ['POL-24'] },
        { n: 9, t: '수업에 넣을 수 없는 교직원 경고', kind: 'review', imp: 'IMP-16', d: '성범죄와 아동학대 경력 조회일이 비어 있거나, 강사와 보조인데 교육청 통보일이 없는 교직원을 알려요. 이 조건을 채우기 전에는 반이나 시간표에 넣을 수 없어요. 시간표의 교사도 교직원 명단에 있는 사람만 나와요.' },
        { n: 10, t: '역할에 따라 가리는 숫자', kind: 'review', imp: 'IMP-14', d: '교사와 보조교사는 수납 메뉴를 못 봐요. 그래서 첫 화면에서도 미수, 재등록, 환불 숫자와 할 일을 가리고, 볼 수 없는 화면으로 가는 버튼도 숨겨요. 위쪽 사람 선택에서 교사로 바꾸면 가려진 모습을 볼 수 있어요.' },
      ],
      open: ['환불 경고를 기한 며칠 전부터 띄울지 (이 화면 예시는 D-3, 환불 화면은 2일 전)', '재등록 기간 전에는 재등록 카드에 무엇을 보여 줄지, 분모를 재원생 전체(128)로 둘지 청구 대상(123)으로 둘지', '출결 숫자에서 아직 오지 않은 학생을 어떤 상태로 셀지 (예시 13/29는 입실, 결석, 예정을 더하면 28명이에요)', '정원 대비 85%의 정원을 반 정원 합계로 볼지, 시설 수용 인원으로 볼지', '알림톡 잔액이 얼마 아래로 떨어지면 경고할지 (화면은 7일치, 예시)'],
      rules: ['환불은 사유가 생긴 날부터 5일 안에 돌려줘야 해요(법정).', '원생 이름과 보호자 연락처는 가려서 보여 줘요(CM-03).'],
    },
  });

  B.action('CT01.done', (ctx, key) => { const m = ctx.s.ct01.done[ctx.centerId] = ctx.s.ct01.done[ctx.centerId] || {}; m[key] = !m[key]; });
  B.action('CT01.open', (ctx, arg) => {
    const parts = String(arg || '').split('|'), to = parts[0], ref = parts[1];
    if (to === 'CT-02' && ref) U(ctx, 'CT-02').sel = ref;
    if (to === 'CT-03' && ref) U(ctx, 'CT-03').res = ref;
    if (to === 'CT-10') Object.assign(U(ctx, 'CT-10'), { from: 'CT-01', refund: ref || null });
    B.go(to); return false;
  });
  B.action('CT01.openRes', (ctx, id) => {
    const r = ctx.s.reservations.find(x => x.id === id); if (!r) return;
    if (r.kind === '상담') { U(ctx, 'CT-02').sel = r.id; B.go('CT-02'); }
    else { U(ctx, 'CT-03').res = r.id; B.go('CT-03'); }
    return false;
  });
  B.action('CT01.readNotice', (ctx, id) => {
    const n = (ctx.s.notices || []).find(x => x.id === id); if (!n) return;
    n.read = n.read || {}; n.read[ctx.centerId] = true;
    // 공지·자료실(CT-17)의 본사 확인율에도 같은 기록이 남아요
    const rb = ctx.s.ct17 && ctx.s.ct17.readBy;
    if (rb) { const arr = rb[n.id] = rb[n.id] || []; if (!arr.some(x => x.center === ctx.centerId && x.name === ctx.persona.name)) arr.push({ center: ctx.centerId, name: ctx.persona.name, role: ctx.persona.role, at: md(ctx.today) }); }
  });
  B.action('CT01.notice', (ctx, id) => {
    const n = (ctx.s.notices || []).find(x => x.id === id); if (!n) return;
    const unread = isUnread(n, ctx.centerId);
    if (!document.getElementById('app')) { B.actions['CT01.readNotice'](ctx, id); return; }
    B.modal({
      title: (n.must ? '[필독] ' : '') + n.title,
      body: '<div class="small muted">본사 공지 ' + esc(n.date) + '</div><div>' + esc(((ctx.s.ct17 || {}).bodies || {})[n.id] || n.title + ' 공지예요.') + '</div><div class="small muted">첨부와 지난 공지는 공지·자료실(CT-17)에서 봐요.</div>' +
        (unread ? h.alert('확인을 누르면 읽음으로 남고 기한·경고에서 빠져요.', 'info') : h.alert('이미 확인한 공지예요.', 'ok')),
      ok: unread && ctx.side === 'ct' ? '확인했어요' : null, cancel: '닫기',
      onOk: () => { B.actions['CT01.readNotice'](B.ctx('CT-01'), id); B.toast('필독 공지를 확인했어요.'); },
    });
    return false;
  });

  /* =====================================================================
     CT-03 입학 테스트·결과지
     ===================================================================== */
  const STEPS = ['학생 확인', '두뇌 유형 검사 (약 15분)', '읽기 테스트 (10~20분)', '결과 확인', '결과지 전달'];
  const isTest = r => r.kind === '입학 테스트' || r.kind === '재테스트';
  // 레벨 표 예시 (HQ-13, p.32). 대상 학년과 읽기 테스트 구간 모두 예시 값이에요.
  const LEVELS = {
    L1: { name: '새싹', g: [2, 3], s: [0, 39] }, L2: { name: '줄기', g: [3, 4], s: [40, 59] },
    L3: { name: '가지', g: [4, 5], s: [60, 79] }, L4: { name: '열매', g: [5, 6], s: [80, 100] },
  };
  const levelByScore = sc => Object.keys(LEVELS).find(k => sc >= LEVELS[k].s[0] && sc <= LEVELS[k].s[1]) || 'L1';
  const lvLabel = k => k + (LEVELS[k] ? ' (' + LEVELS[k].name + ')' : '');
  const lvGrades = k => LEVELS[k] ? '초' + LEVELS[k].g[0] + '~' + LEVELS[k].g[1] : '-';
  const inLevel = (k, g) => !LEVELS[k] || g == null || (g >= LEVELS[k].g[0] && g <= LEVELS[k].g[1]);
  // 정책 값을 HQ에서 바꾸지 않았으면 원문 화면 예시 문구를, 바꿨으면 정책 값을 그대로 보여 줘요
  const polOr = (code, c, wire) => { const v = h.polValue(code, c); return String(v.value) === String(h.pol(code).now) && !v.next ? wire : h.pv(code, c) + ' <span class="muted small">' + esc(v.from) + '</span>'; };
  function testRes(ctx) {
    const s = ctx.s, ui = U(ctx, 'CT-03');
    const list = s.reservations.filter(r => r.center === ctx.centerId && isTest(r));
    const fromCT02 = (s.ui['CT-02'] || {}).sel;
    const want = ui.res || (list.some(r => r.id === fromCT02) ? fromCT02 : null);
    const sel = list.find(r => r.id === want) || list.find(r => r.status === '예약') || list[0] || null;
    return { list, sel };
  }
  function runOf(ctx, r) {
    const runs = ctx.s.ct03.runs;
    return runs[r.id] = runs[r.id] || { step: 1, birth: '', gradeSaid: r.grade, grade: null, consent: false, reason: '', methods: ['현장 출력'], delivered: [], result: null, level: '', done: false };
  }
  const enrolledStudent = (ctx, r) => ctx.s.students.find(x => x.center === r.center && x.name === r.student && (x.status === '재원' || x.status === '휴원'));
  function formRows(rows) { return '<div class="cta-form">' + rows.map(([k, v, pin]) => '<div class="k">' + esc(k) + '</div><div class="v"' + h.p(pin) + '>' + v + '</div>').join('') + '</div>'; }

  B.screen({
    id: 'CT-03', side: 'ct', phase: 'P1a', devices: ['tablet', 'pc'], pages: [47],
    title: '입학 테스트·결과지', menuLabel: '입학 테스트', crumb: '상담 > 입학 테스트',
    headActions: ctx => {
      const { sel } = testRes(ctx); const rn = sel ? ctx.s.ct03.runs[sel.id] : null;
      return h.btn('결과지 출력', { primary: true, act: 'CT03.print', disabled: !ctx.canEdit || !(rn && rn.result), title: rn && rn.result ? '' : '검사를 마치면 출력할 수 있어요' });
    },
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, c = ctx.center;
      const { list, sel: r } = testRes(ctx);
      if (!r) return h.empty('테스트 예약이 없어요. 상담·테스트 예약(CT-02)에서 입학 테스트를 먼저 잡아요.');
      const rn = runOf(ctx, r), err = ui.t_err || {}, ro = !ctx.canEdit;
      const minG = s.ct03.minGrade;
      const picks = list.filter(x => x.status === '예약' || x.id === r.id);
      let html = '<div class="cta-who"><span class="nm">' + esc(h.mask(r.student)) + ' (' + esc(r.grade) + ')</span>' + h.chip(r.kind, r.kind === '재테스트' ? 'info' : 'navy') +
        '<span class="muted small">' + esc(r.at) + ', ' + esc(r.route) + ' 예약, 보호자 ' + esc(h.maskPhone(r.guardianPhone)) + '</span>' +
        '<div style="margin-left:auto">' + h.opts(picks.map(x => ({ v: x.id, l: x.at.slice(6) + ' ' + h.mask(x.student) })), r.id, { act: 'CT03.pick' }) + '</div></div>';
      html += '<div class="card" style="padding:10px 14px;margin-bottom:12px">' + h.steps(STEPS.map((l, i) => ({ label: l, state: rn.done || i + 1 < rn.step ? 'done' : i + 1 === rn.step ? 'cur' : 'lock' }))) + '</div>';

      /* ① 학생 확인 */
      const g = rn.grade, ask = rn.ask;
      let card1;
      if (rn.step === 1) {
        const tg = ui.t_grade || rn.gradeSaid || r.grade;
        const calc = gradeFromBirth(ui.t_birth || '', ctx.today);
        const askLine = ask ? '<div class="cta-log" style="width:100%;margin-top:4px"><div>' + h.chip(ctx.role === '원장' ? '확인 요청 받음' : '원장 확인 대기', 'warn') + ' ' + esc(ask.by) + ' 요청, 사유 ' + esc(ask.reason) +
          (ctx.role === '원장' ? '. 내용을 보고 확인하고 검사 시작을 누르면 원장 확인으로 남아요.' : '. 원장이 이 화면에서 확인하면 검사를 시작해요.') + '</div></div>' : '';
        card1 = formRows([
          ['생년월일', h.field({ field: 't_birth', value: ui.t_birth || '', ph: 'YYYY-MM-DD', err: err.birth, disabled: ro }) + (calc != null ? h.chip(gradeLabel(calc) + (calc >= minG ? ' 검사 가능' : ' 검사 불가'), calc >= minG ? 'ok' : 'bad') : '')],
          ['보호자 확인 학년', h.field({ type: 'select', field: 't_grade', value: tg, options: ['미취학', '초1', '초2', '초3', '초4', '초5', '초6'], disabled: ro, hint: '3월 1일 학년도 기준으로 생년월일과 맞춰 봐요' }) +
            (err.reason || ui.t_reason || ask ? h.field({ field: 't_reason', value: ui.t_reason || '', ph: '학년이 다른 이유 (조기 입학, 입학 유예 등)', err: err.reason, disabled: ro }) : '') + askLine, 7],
          ['검사 버전', '<b>간단판 v1</b>' + h.chip('미확정 (안)', 'st-안') + h.polChip('POL-26') + '<span class="muted small">본사 배포 버전만 골라요</span>'],
          ['진행 패드', esc(s.ct03.pad) + ' ' + h.chip('대기', 'line')],
          ['보호자 동의', '<label class="cta-check"><input type="checkbox" data-field="t_consent"' + (ui.t_consent ? ' checked' : '') + (ro ? ' disabled' : '') + '><span>테스트용 정보 수집에 동의받았어요. 이름, 생년월일, 검사 결과를 레벨 안내에만 쓰고, 등록하지 않으면 30일 뒤 지워요 (예시).</span></label>' + (err.consent ? '<div class="cta-err">' + esc(err.consent) + '</div>' : ''), 6],
        ]) + '<div class="row" style="justify-content:flex-end;margin-top:12px">' + h.btn('확인하고 검사 시작', { primary: true, act: 'CT03.check', disabled: ro }) + '</div>';
      } else {
        card1 = formRows([
          ['생년월일', esc(rn.birth.slice(0, 4)) + '-**-** ' + h.chip(gradeLabel(g) + ' 검사 가능', 'ok')],
          ['학년 판정', '보호자 확인 ' + esc(rn.gradeSaid) + ', 생년월일 ' + esc(gradeLabel(g)) + (rn.reason ? ' ' + h.chip('원장 확인 ' + (rn.approvedBy || ''), 'info') + '<span class="muted small">' + esc(rn.reason) + '</span>' : ' ' + h.chip('일치', 'ok')), 7],
          ['검사 버전', '<b>간단판 v1</b>' + h.chip('미확정 (안)', 'st-안') + h.polChip('POL-26')],
          ['진행 패드', esc(s.ct03.pad) + ' ' + (rn.step === 2 || rn.step === 3 ? h.chip('검사 모드 잠김', 'bad') : h.chip('잠금 풀림', 'line'))],
          ['보호자 동의', h.chip('동의 받음', 'ok') + '<span class="muted small">' + esc(rn.consentAt || ctx.today) + ', 등록하지 않으면 30일 뒤 삭제 (예시)</span>', 6],
        ]);
      }
      const left = [];
      left.push(h.card({ title: '학생 확인', pin: 1, sub: '대상 학년 ' + h.pol('POL-31').now + ', 화면은 초' + minG + ' 이상만 받아요 (예시)', body: card1 }));

      /* ② 진행과 결과 */
      let card2;
      const ruleLine = '<div class="small muted cta-pinpad" style="margin-top:10px"' + h.p(9) + '>결과가 나오면 읽기 점수 구간으로 레벨을 먼저 정해요. 학년이 그 레벨 대상 학년 밖이면 원장이 확인해요.</div>';
      if (rn.step === 1) card2 = '<div class="cta-none">검사를 시작하면 진행 상황이 여기 보여요. 두뇌 유형 검사 약 15분, 읽기 테스트 10~20분, 모두 35분 안팎이에요.</div>' + ruleLine;
      else if (rn.step === 2 || rn.step === 3) {
        const two = rn.step === 2;
        card2 = h.alert(s.ct03.pad + '에서 ' + (two ? '두뇌 유형 검사(약 15분)' : '읽기 테스트(10~20분)') + '를 보고 있어요. 패드는 검사 모드로 잠겨 있어요.', 'info') +
          '<div style="margin:10px 0">' + h.bar(two ? 35 : 75) + '</div>' +
          '<div class="row" style="justify-content:flex-end">' + h.btn(two ? '두뇌 유형 검사 끝남' : '읽기 테스트 끝남', { primary: true, act: 'CT03.next', disabled: ro }) + '</div>' + ruleLine;
      } else {
        const res = rn.result, sc = res.score, byScore = levelByScore(sc);
        const pick = rn.step === 4 ? (ui.t_level || res.level) : rn.level;
        const gNow = rn.grade != null ? rn.grade : gradeNum(r.grade), out = !inLevel(pick, gNow);
        card2 = formRows([
          ['두뇌 유형', '<b>' + esc(res.type) + '</b>'],
          ['읽기 레벨', '<b>' + esc(lvLabel(res.level)) + ', ' + sc + '점</b>'],
          ['소요', res.minutes + '분'],
          ['등록할 레벨', (rn.step === 4 ? h.opts(Object.keys(LEVELS).map(k => ({ v: k, l: k + ' ' + LEVELS[k].name })), pick, { act: 'CT03.level' }) : '<b>' + esc(lvLabel(pick)) + '</b>' + (rn.levelNote ? h.chip(rn.levelNote, 'info') : '')) +
            '<div class="hint" style="width:100%">읽기 ' + sc + '점은 ' + byScore + ' 구간(' + LEVELS[byScore].s.join('~') + '점)이에요. ' + pick + ' 대상 학년은 ' + lvGrades(pick) + '예요 (레벨 표 모두 예시).</div>' +
            (rn.step === 4 && out ? '<div class="cta-err">' + esc(gradeLabel(gNow) + '은 ' + pick + ' 대상 학년 밖이에요. ' + (ctx.role === '원장' ? '결과 확인을 누르면 원장 확인으로 남아요.' : '원장이 확인해야 넘어가요.')) + '</div>' : '') +
            (err.level ? '<div class="cta-err">' + esc(err.level) + '</div>' : ''), 9],
        ]) + (rn.step === 4 ? '<div class="row" style="justify-content:flex-end;margin-top:10px">' + h.btn('결과 확인', { primary: true, act: 'CT03.next', disabled: ro }) + '</div>' : '');
      }
      left.push(h.card({ title: '결과', pin: 2, sub: rn.step >= 4 ? '검사 끝' : rn.step > 1 ? '검사 중' : '검사 전', body: card2 }));

      /* ③ 전달 */
      const can5 = rn.step >= 5;
      const m = rn.methods;
      const reg = enrolledStudent(ctx, r);
      const t06 = ((s.alim || {}).templates || []).find(t => t.id === 'T06');
      const t06ok = !t06 || t06.status === '승인';
      let card3 = formRows([
        ['방식', h.opts(['현장 출력', '우편', '이메일', '알림톡 링크'].map(x => ({ v: x, l: (m.includes(x) ? '✓ ' : '') + x })), '', { act: 'CT03.method' })],
        ['우편 주소', m.includes('우편') ? h.field({ field: 't_addr', value: ui.t_addr || '', ph: '우편을 고르면 입력', err: err.addr, disabled: ro, hint: '' }) + '<span class="muted small">30일(안) 뒤 자동 삭제, ' + addDays(ctx.today, 30) + '에 지워져요</span>' + h.polChip('POL-30') : '<span class="muted small">우편을 고르면 입력해요. 30일(안) 뒤 자동 삭제</span>'],
      ].concat(m.includes('이메일') ? [['이메일', h.field({ field: 't_email', value: ui.t_email || '', ph: 'name@example.com', err: err.email, disabled: ro })]] : [])
        .concat(m.includes('알림톡 링크') ? [['알림톡 링크', '<span class="small">보호자 ' + esc(h.maskPhone(r.guardianPhone)) + '로 결과지 링크를 보내요 (T06 템플릿' + (t06ok ? ')' : ', ' + esc(t06.status) + '이라 지금은 못 보내요)') + '</span>']] : []));
      if (rn.delivered.length) card3 += '<div class="cta-log">' + rn.delivered.map(d => '<div>' + esc(d.at) + ' ' + esc(d.m) + (d.to ? ' (' + esc(d.to) + ')' : '') + ', ' + esc(d.by) + '</div>').join('') + '</div>';
      if (err.deliver) card3 += '<div class="cta-err" style="margin-top:6px">' + esc(err.deliver) + '</div>';
      card3 += '<div class="row" style="justify-content:flex-end;margin-top:12px">' +
        h.btn('전달 기록 저장', { act: 'CT03.deliver', disabled: ro || !can5, title: can5 ? '' : '결과를 확인하면 전달할 수 있어요' }) +
        h.btn(reg ? '레벨 관리로 결과 넘기기' : '원생 등록으로 이어서 하기', { primary: true, act: 'CT03.toRegister', disabled: ro || !can5 }) + '</div>';
      if (rn.done) card3 += h.alert(reg ? '결과를 레벨 관리(CT-13)로 넘겼어요 (레벨 ' + rn.level + ').' : '결과를 원생 등록(CT-05)으로 넘겼어요 (레벨 ' + rn.level + ').', 'ok');
      left.push(h.card({ title: '전달', pin: 3, sub: can5 ? '결과지를 보호자에게 전해요' : '결과를 확인한 뒤 열려요', body: card3 }));

      /* ④ 테스트비 (원문처럼 왼쪽 맨 아래) */
      const retest = addMonths(rn.result ? rn.result.date : ctx.today, 6);
      left.push(h.card({
        title: '테스트비', pin: 4, cls: 'cta-fee',
        body: formRows([
          ['금액', polOr('POL-27', c, '<b>30,000원</b>' + h.chip('(안)', 'st-안') + '<span class="muted small">프로모션, 정가 50,000원 (안)</span>') + h.polChip('POL-27')],
          ['수납', h.btn('수납하기', { lock: true, disabled: true, act: 'CT03.pay', title: '교육청 확인 전에는 잠겨 있어요' }) + '<div style="width:100%"' + h.p(8) + '>' + h.alert('교육청 확인 전이라 테스트비를 받지 않아요. 답이 올 때까지 입학 테스트는 무료로 해요.', 'review', { title: '검토 반영' }) + '</div>'],
          ['등록 시', polOr('POL-28', c, '<b>20,000원</b>' + h.chip('(안)', 'st-안') + '<span class="muted small">교습비에서 차감, 30일 유효 (예시)</span>') + h.polChip('POL-28')],
          ['재검사', polOr('POL-29', c, '<b>' + retest + ' 이후</b><span class="muted small">6개월 (예시)</span>') + h.polChip('POL-29')],
        ]),
      }));

      /* 오른쪽: 결과지 미리 보기, ⑤ 원칙 */
      const res = rn.result, lvShow = rn.level || (res && (ui.t_level || res.level));
      let sheet = '<div class="cta-sheet"><h4>브레인180 입학 테스트 결과지</h4>';
      if (res) {
        sheet += '<div class="meta">' + esc(h.mask(r.student)) + ', ' + esc(r.grade) + ' / ' + esc(res.date) + ' ' + esc(c ? c.name : '') + '</div>' +
          '<dl class="res"><dt>두뇌 유형</dt><dd>' + esc(res.type) + '</dd><dt>읽기 레벨</dt><dd>' + esc(lvLabel(lvShow)) + '</dd></dl>' +
          '<div class="small muted">유형 지수는 표시하지 않아요. 결과 설명과 프로그램 안내는 상담에서 해요.</div>';
      } else sheet += '<div class="cta-none">검사를 마치면 결과지 미리 보기가 나와요.</div>';
      sheet += '</div>';
      const right = [h.card({ title: '결과지 미리 보기', sub: rn.delivered.length ? '전달 ' + rn.delivered.length + '건' : '', body: sheet })];
      right.push(h.card({
        title: '결과지 원칙', pin: 5,
        body: '<ul class="small" style="margin:0 0 10px;padding-left:18px"><li>두뇌 유형은 지수 없이 유형만 보여 줘요.</li><li>읽기는 레벨만 보여 주고, 설명은 상담에서 해요 (10/14 결정).</li></ul>' +
          h.alert('최저 학년 미만이면 테스트를 시작할 수 없어요.' + (rn.blocked ? ' 이 학생은 생년월일로 보면 ' + gradeLabel(rn.blockedGrade) + '이에요.' : ''), 'bad') + '<div style="margin-top:6px">' + h.polChip('POL-31') + '</div>',
      }));
      html += '<div class="cta-test"><div class="stack">' + left.join('') + '</div><div class="stack">' + right.join('') + '</div></div>';
      return html;
    },
    prd: {
      summary: '처음 온 학생이 센터 패드로 두뇌 유형 검사와 읽기 테스트를 보는 화면이에요. 결과지를 보호자에게 전하고, 정한 레벨을 원생 등록(CT-05)으로 넘겨요.',
      who: '원장과 실장·데스크가 진행해요. 교사는 보기만 하고, 보조교사에게는 메뉴가 안 보여요(7쪽 권한표).',
      items: [
        { n: 1, t: '학생 확인', d: '생년월일로 학년을 확인해서 대상 학년 밖이면 시작을 막아요. 검사 버전은 본사가 배포한 것만 써요(간단판 v1, 미확정).', pol: ['POL-31', 'POL-26'], ref: 'p.47 ①' },
        { n: 2, t: '진행과 결과', d: '두뇌 유형 검사(약 15분)와 읽기 테스트(10~20분)를 차례로 봐요. 모두 35분 안팎이고, 그동안 진행 패드는 검사 모드로 잠겨요. 끝나면 두뇌 유형, 읽기 레벨과 점수, 걸린 시간이 나와요.', ref: 'p.47 ②' },
        { n: 3, t: '결과지 전달', d: '결과지는 바로 출력하고, 필요하면 우편, 이메일, 알림톡 링크로 보내요. 우편 주소는 30일(안) 뒤 저절로 지워요. 전달을 마치면 레벨을 원생 등록으로 넘겨요.', pol: ['POL-30'], ref: 'p.47 ③' },
        { n: 4, t: '테스트비', d: '정가 50,000원과 프로모션 30,000원, 등록하면 교습비에서 빼 주는 20,000원은 모두 (안)이고 정책에서 와요. 본사가 정책 값을 바꾸면 이 칸도 바뀌어요. 다시 검사할 수 있는 날(6개월 뒤, 예시)도 함께 알려 줘요.', pol: ['POL-27', 'POL-28', 'POL-29'], ref: 'p.47 ④' },
        { n: 5, t: '결과지 원칙', d: '두뇌 유형은 지수 없이 유형만, 읽기는 레벨만 보여 줘요. 설명은 상담에서 해요. 유아 대상 시험 제한 때문에 최저 학년보다 어린 아이는 검사하지 않아요.', pol: ['POL-31'], ref: 'p.47 ⑤' },
        { n: 6, t: '검사 전 보호자 동의', kind: 'review', imp: 'IMP-07', d: '아직 원생이 아닌 아이의 생년월일과 검사 결과를 저장하는 단계예요. 수집 항목, 목적, 보관 기간을 알리고 동의를 받아야 검사를 시작할 수 있어요. 등록하지 않으면 정해진 기간(화면은 30일, 예시) 뒤 지워요.' },
        { n: 7, t: '학년 판정 기준', kind: 'review', imp: 'IMP-19', d: '학년은 3월 1일 학년도 기준으로 생년월일에서 계산해요. 그래서 3월 전 예비 초1은 검사를 시작할 수 없어요. 보호자가 알려 준 학년과 다르면 사유를 적고 원장이 확인해야 넘어가요.', pol: ['POL-31'] },
        { n: 8, t: '교육청 확인 전 테스트비 잠금', kind: 'review', imp: 'IMP-08', d: '테스트비를 받아도 되는지 교육청 확인이 끝나기 전에는 수납 버튼을 잠가요. 그동안 입학 테스트는 무료로 해요.', pol: ['POL-27'] },
        { n: 9, t: '레벨 배정 기준', kind: 'review', imp: 'IMP-19', d: '등록할 레벨은 읽기 점수 구간으로 먼저 정해요. 학생 학년이 그 레벨의 대상 학년 밖이면 원장이 확인해야 결과를 확정해요. 레벨 표의 학년과 점수 구간은 아직 예시예요(HQ-13).', pol: ['POL-31'] },
      ],
      open: ['대상 학년 범위 (POL-31, 회의마다 초4부터, 2~4학년, 5·6학년으로 바뀌었어요)', '상담과 테스트 단계 정보를 보호자 동의로 받을지, 검사 계약 이행으로 볼지 (법무 확인)', '검사 버전을 180문항 원본으로 할지 간단판으로 할지 (POL-26)', '테스트비 금액과 받는 주체 (POL-27)', '재검사 주기 (POL-29, 화면의 6개월은 예시)', '검사 중 패드가 꺼지거나 아이가 그만두면 이어서 볼지 처음부터 볼지', '보호자가 링크로 여는 결과지 화면을 누가 만들지'],
      rules: ['유아 대상 시험 제한(2026년 개정 학원법)에 따라 최저 학년 미만은 검사하지 않아요.', '결과지에는 유형 지수를 싣지 않아요 (10/14 결정).'],
    },
  });

  function clearTestFields(ui) { ['t_birth', 't_grade', 't_reason', 't_consent', 't_addr', 't_email', 't_level', 't_err'].forEach(k => { delete ui[k]; }); }
  B.action('CT03.pick', (ctx, id) => { const ui = U(ctx, 'CT-03'); if (ui.res !== id) clearTestFields(ui); ui.res = id; });
  B.action('CT03.check', (ctx, arg) => {
    const ui = U(ctx, 'CT-03');
    if (arg && typeof arg === 'object') Object.assign(ui, arg);
    const { sel: r } = testRes(ctx); if (!r) return;
    const rn = runOf(ctx, r), err = ui.t_err = {}, minG = ctx.s.ct03.minGrade;
    const birth = String(ui.t_birth || '').trim();
    const said = ui.t_grade || rn.gradeSaid || r.grade;
    const g = gradeFromBirth(birth, ctx.today);
    rn.blocked = false;
    if (g == null) err.birth = '생년월일을 YYYY-MM-DD 형식으로 넣어 주세요.';
    else if (g < minG) { err.birth = '최저 학년 미만이라 테스트를 시작할 수 없어요.'; rn.blocked = true; rn.blockedGrade = g; }
    else if (gradeNum(said) !== g) {
      const why = String(ui.t_reason || '').trim();
      if (!why) err.reason = '보호자가 말한 학년(' + said + ')과 생년월일 학년(' + gradeLabel(g) + ')이 달라요. 이유를 적어 주세요.';
      else if (ctx.persona.role !== '원장') {
        rn.ask = { reason: why, said, by: ctx.persona.name };
        err.ask = true; B.toast('학년이 달라서 원장에게 확인을 요청했어요. 원장이 확인해야 검사를 시작해요.');
      }
    }
    if (!ui.t_consent) err.consent = '보호자 동의를 받아야 검사를 시작할 수 있어요.';
    if (Object.keys(err).length) return;
    ui.res = r.id;
    const diff = gradeNum(said) !== g;
    Object.assign(rn, { birth, gradeSaid: said, grade: g, consent: true, consentAt: ctx.today, reason: diff ? String(ui.t_reason).trim() : '', approvedBy: diff ? ctx.persona.name : '', ask: null, step: 2 });
    B.toast(ctx.s.ct03.pad + '를 검사 모드로 잠갔어요. 두뇌 유형 검사를 시작해요.');
  });
  B.action('CT03.next', (ctx, arg) => {
    const ui = U(ctx, 'CT-03');
    const { sel: r } = testRes(ctx); if (!r) return;
    const rn = runOf(ctx, r);
    if (rn.step === 2) { rn.step = 3; B.toast('두뇌 유형 검사를 마쳤어요. 읽기 테스트로 넘어가요.'); return; }
    if (rn.step === 3) {
      const st = enrolledStudent(ctx, r), o = arg && typeof arg === 'object' ? arg : {};
      // 예시 결과. 재원생 재테스트는 지금 레벨 구간 안의 점수로 채워요.
      const base = st && LEVELS[st.level] ? { level: st.level, score: { L1: 30, L2: 52, L3: 68, L4: 86 }[st.level] } : { level: 'L2', score: 52 };
      rn.result = Object.assign({ type: '○○형', level: base.level, score: base.score, minutes: 34, date: ctx.today, version: '간단판 v1' }, o);
      if (o.score != null && !o.level) rn.result.level = levelByScore(Number(o.score));
      rn.step = 4; r.status = '완료';
      B.toast('검사를 마쳤어요. 패드 잠금을 풀었어요.');
      return;
    }
    if (rn.step === 4) {
      if (arg && typeof arg === 'object' && arg.t_level) ui.t_level = arg.t_level;
      confirmLevel(ctx, r, rn);
    }
  });
  // 4단계 결과 확인. 학년이 레벨 대상 학년 밖이면 원장만 확정할 수 있어요 (IMP-19).
  function confirmLevel(ctx, r, rn) {
    const ui = U(ctx, 'CT-03');
    const pick = ui.t_level || rn.result.level;
    const gNow = rn.grade != null ? rn.grade : gradeNum(r.grade);
    ui.t_err = {};
    if (!inLevel(pick, gNow) && ctx.persona.role !== '원장') { ui.t_err.level = gradeLabel(gNow) + '은 ' + pick + ' 대상 학년(' + lvGrades(pick) + ', 예시) 밖이라 원장이 확인해야 해요.'; return false; }
    rn.level = pick; rn.levelNote = inLevel(pick, gNow) ? '' : '원장 확인'; rn.step = 5;
    return true;
  }
  B.action('CT03.level', (ctx, v) => { const ui = U(ctx, 'CT-03'); if (LEVELS[v]) ui.t_level = v; ui.t_err = {}; });
  B.action('CT03.method', (ctx, v) => {
    const { sel: r } = testRes(ctx); if (!r) return;
    const rn = runOf(ctx, r);
    rn.methods = rn.methods.includes(v) ? rn.methods.filter(x => x !== v) : rn.methods.concat(v);
  });
  B.action('CT03.deliver', (ctx, arg) => {
    const ui = U(ctx, 'CT-03');
    if (arg && typeof arg === 'object') { if (arg.methods) { const { sel: r0 } = testRes(ctx); if (r0) runOf(ctx, r0).methods = arg.methods.slice(); } Object.assign(ui, arg); delete ui.methods; }
    const { sel: r } = testRes(ctx); if (!r) return;
    const rn = runOf(ctx, r), err = ui.t_err = {};
    if (rn.step < 5) { err.deliver = '결과를 확인한 뒤에 전달할 수 있어요.'; return; }
    if (!rn.methods.length) err.deliver = '전달 방식을 하나 이상 골라 주세요.';
    if (rn.methods.includes('우편') && !String(ui.t_addr || '').trim()) err.addr = '우편을 고르면 주소를 넣어야 해요.';
    if (rn.methods.includes('이메일') && !/.+@.+\..+/.test(String(ui.t_email || ''))) err.email = '이메일 주소를 확인해 주세요.';
    const t06 = ((ctx.s.alim || {}).templates || []).find(t => t.id === 'T06');
    if (rn.methods.includes('알림톡 링크') && t06 && t06.status !== '승인') err.deliver = '결과지 링크 템플릿(T06)이 ' + t06.status + '이라 알림톡으로 보낼 수 없어요. 다른 방식을 골라 주세요.';
    if (Object.keys(err).length) return;
    const at = ctx.today.slice(5) + ' ' + clock(ctx.s), by = ctx.persona.name;
    rn.methods.forEach(m => {
      if (m === '현장 출력' && rn.delivered.some(d => d.m === m)) return;
      rn.delivered.push({ m, at, by, to: m === '우편' ? ui.t_addr : m === '이메일' ? ui.t_email : m === '알림톡 링크' ? h.maskPhone(r.guardianPhone) : '' });
    });
    B.toast('결과지 전달을 기록했어요.' + (rn.methods.includes('우편') ? ' 우편 주소는 ' + addDays(ctx.today, 30) + '에 지워져요.' : ''));
  });
  B.action('CT03.print', ctx => {
    const { sel: r } = testRes(ctx); if (!r) return;
    const rn = runOf(ctx, r); if (!rn.result) { B.toast('검사를 마치면 출력할 수 있어요.'); return; }
    if (rn.step === 4 && !confirmLevel(ctx, r, rn)) { B.toast('등록할 레벨을 먼저 확정해 주세요.'); return; }
    if (!rn.delivered.some(d => d.m === '현장 출력')) rn.delivered.push({ m: '현장 출력', at: ctx.today.slice(5) + ' ' + clock(ctx.s), by: ctx.persona.name, to: '' });
    B.toast('결과지를 출력했어요.');
  });
  B.action('CT03.toRegister', ctx => {
    const ui = U(ctx, 'CT-03');
    const { sel: r } = testRes(ctx); if (!r) return;
    const rn = runOf(ctx, r);
    ui.t_err = {};
    if (rn.step < 5) { ui.t_err.deliver = '결과를 확인한 뒤에 넘길 수 있어요.'; return; }
    if (!rn.delivered.length) { ui.t_err.deliver = '결과지를 먼저 전달해 주세요. 현장 출력만 해도 돼요.'; return; }
    rn.done = true; r.status = '완료';
    const st = enrolledStudent(ctx, r);
    if (st) { Object.assign(U(ctx, 'CT-13'), { student: st.id, cls: st.cls || undefined, level: rn.level, from: r.id }); B.go('CT-13'); return false; }
    Object.assign(U(ctx, 'CT-05'), { from: r.id, name: r.student, grade: rn.gradeSaid || r.grade, phone: r.guardianPhone, level: rn.level, testDate: rn.result.date, testType: rn.result.type });
    B.go('CT-05'); return false;
  });
  B.action('CT03.pay', () => { B.toast('교육청 확인 전에는 테스트비를 받지 않아요.'); return false; });
  B.action('CT03.reset', ctx => { const { sel: r } = testRes(ctx); if (r) delete ctx.s.ct03.runs[r.id]; clearTestFields(U(ctx, 'CT-03')); });

  /* =====================================================================
     CT-04 원생 목록
     ===================================================================== */
  const TABS = ['재원', '휴원', '퇴원', '대기'];
  const tabOf = st => (st === '재원' || st === '퇴원 예정') ? '재원' : st === '수납 대기' ? '대기' : st;
  const clsName = (s, id) => { const c = s.classes.find(x => x.id === id); return c ? c.name : (id ? id : '-'); };
  function rereg(ctx, st) {
    const x = ctx.s.ct04.rereg[st.id];
    if (x) return x;
    if (st.status === '재원') {
      const p = rereqPeriod(ctx);
      return { state: dday(ctx.today, p.start) > 0 ? '청구 전' : '청구 발송' };
    }
    if (st.status === '퇴원 예정') return { state: '대상 아님', why: '퇴원 예정' };
    if (st.status === '휴원') return { state: '대상 아님', why: '휴원' };
    return { state: '-' };
  }
  function filtered(ctx) {
    const s = ctx.s, ui = ctx.ui, q = ui.q || {};
    const tab = ui.tab || '재원';
    return s.students.filter(x => x.center === ctx.centerId && x.status !== '상담' && tabOf(x.status) === tab)
      .filter(x => !q.cls || q.cls === '전체' || x.cls === q.cls)
      .filter(x => !q.level || q.level === '전체' || x.level === q.level)
      .filter(x => !q.pay || q.pay === '전체' || (q.pay === '수납 완료' || q.pay === '미수' ? x.paid === q.pay : rereg(ctx, x).state === q.pay))
      .filter(x => !q.acc || q.acc === '전체' || x.account === q.acc)
      .filter(x => { const t = String(q.text || '').trim(); if (!t) return true; return x.name.indexOf(t) >= 0 || x.phone.replace(/-/g, '').slice(-4) === t.replace(/-/g, '').slice(-4) && t.replace(/\D/g, '').length >= 4; });
  }
  function tabCount(ctx, t) {
    const s = ctx.s, cid = ctx.centerId, c = ctx.center;
    const cnt = arr => arr.filter(x => x.center === cid && x.status !== '상담' && tabOf(x.status) === t).length;
    const init = (B.initialStore && B.initialStore.students) || s.students;
    const delta = cnt(s.students) - cnt(init);
    const tot = (s.ct04.totals[cid] || {});
    if (t === '재원' && c && c.students) return c.students + delta;
    if (tot[t] != null) return tot[t] + delta;
    const n = cnt(s.students); return n || null;
  }
  function selIds(ctx) { const m = ctx.ui.sel || {}; return Object.keys(m).filter(k => m[k]); }
  function selStudents(ctx) { const ids = selIds(ctx); return ctx.s.students.filter(x => ids.includes(x.id)); }

  function studentTable(ctx, rows) {
    const s = ctx.s, sel = ctx.ui.sel || {}, ro = !ctx.canEdit;
    const allOn = rows.length && rows.every(x => sel[x.id]);
    const next = rereqPeriod(ctx).next, cur = Number(ctx.today.slice(5, 7));
    const head = '<tr><th style="width:30px"><input type="checkbox" aria-label="모두 고르기" data-act="CT04.checkAll"' + (allOn ? ' checked' : '') + (ro ? ' disabled' : '') + '></th>' +
      ['이름', '학년', '레벨', '반', '수강권'].map(x => '<th>' + x + '</th>').join('') +
      '<th><span class="cta-pinth"' + h.p(6) + '>' + cur + '월 수납</span></th><th>' + next + '월 재등록</th><th>계정</th><th>보호자</th><th>등록일</th></tr>';
    const body = rows.map(x => {
      const pr = s.products.find(p => p.id === x.product);
      const waiting = x.status === '대기' || x.status === '수납 대기';
      const pass = x.status === '휴원' ? cur + '월 휴원' : waiting ? '수납 전' : pr ? cur + '월 · 주 ' + pr.perWeek + '회' : '-';
      const rr = rereg(ctx, x), pend = s.ct04.pending[x.id];
      let rrHtml;
      if (rr.state === '제외') rrHtml = h.chip('제외 (' + rr.reason + ')', 'p2') + (ctx.canEdit ? '<button type="button" class="cta-mini" data-act="CT04.include" data-arg="' + x.id + '">다시 넣기</button>' : '');
      else if (rr.state === '승인 대기') rrHtml = h.chip('제외 승인 대기', 'warn') + (ctx.role === '원장' ? '<button type="button" class="cta-mini" data-act="CT04.approve" data-arg="' + x.id + '">승인</button>' : '');
      else if (rr.state === '대상 아님') rrHtml = h.chip('대상 아님 (' + rr.why + ')', 'line');
      else if (rr.state === '-') rrHtml = '<span class="muted">-</span>';
      else rrHtml = h.chip(rr.state, rr.state === '청구 전' ? 'line' : 'info');
      return '<tr class="click' + (sel[x.id] ? ' sel' : '') + '" data-act="CT04.open" data-arg="' + x.id + '">' +
        '<td><input type="checkbox" aria-label="' + esc(h.mask(x.name)) + ' 고르기" data-act="CT04.check" data-arg="' + x.id + '"' + (sel[x.id] ? ' checked' : '') + (ro ? ' disabled' : '') + '></td>' +
        '<td><b>' + esc(h.mask(x.name)) + '</b>' + (x.status === '퇴원 예정' ? ' ' + h.chip('퇴원 예정', 'p2') : x.status === '수납 대기' ? ' ' + h.chip('수납 대기', 'warn') : '') + '</td>' +
        '<td>' + esc(x.grade) + '</td><td>' + esc(x.level || '-') + '</td>' +
        '<td>' + esc(clsName(s, x.cls)) + (pend ? '<div class="small muted">' + esc(md(pend.date)) + '부터 ' + esc(clsName(s, pend.to)) + '</div>' : '') + '</td>' +
        '<td>' + esc(pass) + '</td>' +
        '<td>' + (x.paid === '-' ? '<span class="muted">-</span>' : h.status(x.paid)) + '</td>' +
        '<td>' + rrHtml + '</td>' +
        '<td>' + (x.account === '-' ? '<span class="muted">-</span>' : h.chip(x.account, ACC[x.account] || '')) + '</td>' +
        '<td class="mono small">' + esc(h.maskPhone(x.phone)) + '</td>' +
        '<td class="small">' + esc(x.since || '-') + '</td></tr>';
    }).join('') || '<tr><td colspan="11"><div class="empty" style="border:0">' + ((ctx.ui.tab || '재원') === '퇴원' ? '퇴원생이 없어요. 퇴원생은 보관 기간(POL-40, 미정) 동안만 여기 보여요.' : '조건에 맞는 원생이 없어요. 필터를 바꿔 보세요.') + '</div></td></tr>';
    return '<div' + h.p(2) + '><div class="tbl-wrap"><table class="tbl"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div></div>';
  }

  function bulkPanel(ctx) {
    const s = ctx.s, ui = ctx.ui, mode = ui.bulk, list = selStudents(ctx), n = list.length, c = ctx.center, ro = !ctx.canEdit;
    const titles = { move: '반 이동', msg: '알림톡 보내기', exclude: '재등록 대상 제외' };
    const res = ui.bulkResult && ui.bulkResult.mode === mode ? ui.bulkResult : null;
    let body = h.steps([{ label: '미리보기', state: 'done' }, { label: '확인', state: res ? 'done' : 'cur' }, { label: '실행', state: res ? 'done' : 'lock' }, { label: '결과', state: res ? 'cur' : 'lock' }]);
    body += '<div style="margin-top:10px">';
    if (res) {
      body += h.alert(res.msg, res.fail.length ? 'warn' : 'ok', { title: '성공 ' + res.ok.length + '명, 실패 ' + res.fail.length + '명' });
      if (res.fail.length) body += '<div class="cta-log">' + res.fail.map(f => '<div>' + esc(f.name) + ' ' + esc(f.why) + '</div>').join('') + '</div>';
      if (res.next && res.next.length) body += '<div class="row" style="margin-top:10px">' + res.next.map(x => h.btn(h.mask(x.name) + ' 상태 변경 (CT-06)', { sm: true, act: 'CT04.toDetail', arg: x.id + '|' + x.want })).join('') + '</div>';
      body += '</div>';
      return h.card({ title: titles[mode] + ' 결과', sub: '이력에 남았어요', pin: 5, right: h.btn('닫기', { sm: true, act: 'CT04.closeBulk' }), body });
    }
    body += '<div class="small" style="margin-bottom:8px">대상 <b>' + n + '명</b> ' + esc(list.map(x => h.mask(x.name)).join(', ')) + '</div>';
    let run = '', undo = '', block = '';
    if (mode === 'move') {
      const cls = s.classes.filter(x => x.center === ctx.centerId);
      const tgt = cls.find(x => x.id === ui.b_cls);
      body += '<div class="field"><label>옮길 반</label>' + h.opts(cls.map(x => ({ v: x.id, l: x.name + ' ' + x.enrolled + '/' + x.cap })), ui.b_cls || '', { act: 'CT04.target' }) + '</div>';
      body += '<div class="field" style="margin-top:8px"><label>적용일</label>' + h.opts(['다음 수업부터', '4월 1일부터'], ui.b_when || '다음 수업부터', { act: 'CT04.when' }) + '</div>';
      if (tgt) {
        const movers = list.filter(x => x.cls !== tgt.id);
        const after = tgt.enrolled + movers.length;
        const same = cls.filter(x => x.days === tgt.days && x.time === tgt.time);
        const sameAfter = same.reduce((a, x) => a + x.enrolled, 0) + movers.length;
        const fac = c ? c.facilityCap : 0;
        const lvlDiff = movers.filter(x => x.level && x.level !== tgt.level);
        body += '<div class="cta-log" style="margin-top:10px">' +
          '<div>' + esc(tgt.name) + ' 인원 ' + tgt.enrolled + '명에 ' + movers.length + '명을 더하면 <b>' + after + '명</b>, 반 정원 ' + tgt.cap + '명 ' + (after > tgt.cap ? h.chip('넘쳐요', 'bad') : h.chip('괜찮아요', 'ok')) + '</div>' +
          '<div>같은 시간대(' + esc(tgt.days + ' ' + tgt.time) + ') 합계 <b>' + sameAfter + '명</b>, 일시수용능력 ' + fac + '명 ' + (sameAfter > fac ? h.chip('넘쳐요', 'bad') : h.chip('괜찮아요', 'ok')) + '</div>' +
          (lvlDiff.length ? '<div>' + h.chip('레벨 다름', 'warn') + ' ' + esc(lvlDiff.map(x => h.mask(x.name) + ' ' + x.level).join(', ')) + ', 옮길 반 레벨은 ' + esc(tgt.level) + '</div>' : '') + '</div>';
        if (after > tgt.cap) block = tgt.name + ' 정원 ' + tgt.cap + '명을 ' + (after - tgt.cap) + '명 넘어서 옮길 수 없어요.';
        else if (sameAfter > fac) block = '같은 시간대 합계가 일시수용능력 ' + fac + '명을 넘어요.';
      }
      const nMove = tgt ? list.filter(x => x.cls !== tgt.id).length : n;
      if (tgt && !nMove) block = '고른 원생이 모두 이미 ' + tgt.name + ' 반이에요.';
      run = nMove + '명 반 이동'; undo = '되돌릴 수 있어요. 다시 옮기면 돼요.';
    } else if (mode === 'msg') {
      const tpls = ((s.alim || {}).templates || []);
      body += '<div class="field"><label>템플릿 (본사 승인 정보성만)</label>' + h.opts(tpls.map(t => ({ v: t.id, l: t.name + (t.status !== '승인' ? ' (' + t.status + ')' : ''), dis: t.status !== '승인', title: t.status !== '승인' ? '승인된 템플릿만 보낼 수 있어요' : '' })), ui.b_tpl || '', { act: 'CT04.tpl' }) + '</div>';
      const t = tpls.find(x => x.id === ui.b_tpl);
      const unit = polNum('POL-34', c, 7), cost = n * unit;
      const bal = c && c.type !== '직영' ? ((s.alim || {}).balances || {})[ctx.centerId] : null;
      if (t) body += '<div class="cta-sheet" style="margin-top:8px;padding:10px 12px"><div class="small muted">미리 보기 (' + esc(list[0] ? h.mask(list[0].name) : '') + ')</div><div class="small">' + esc(t.text.replace('#{학생명}', list[0] ? h.mask(list[0].name) : '').replace('#{월}', (t.id === 'T04' ? Number(ctx.today.slice(5, 7)) : rereqPeriod(ctx).next) + '월')) + '</div></div>';
      body += '<div class="cta-log" style="margin-top:8px"><div>받는 사람 <b>' + n + '명</b>, 예상 비용 ' + n + '건 × ' + unit + '원 = <b>' + h.money(cost) + '</b> ' + h.chip('(안)', 'st-안') + '</div>' +
        '<div>' + (bal == null ? '직영은 본사 비용으로 처리해요 (내부 대체).' : '알림톡 잔액 ' + h.money(bal) + ', 보낸 뒤 ' + h.money(bal - cost)) + '</div></div>';
      if (!t) block = '보낼 템플릿을 골라 주세요.';
      else if (bal != null && bal < cost) block = '알림톡 잔액이 부족해요. 충전한 뒤 보내 주세요.';
      run = n + '명에게 보내기'; undo = '보낸 알림톡은 되돌릴 수 없어요.';
    } else if (mode === 'exclude') {
      body += '<div class="field cta-pinpad"' + h.p(4) + '><label>제외 사유<span class="req">*</span></label>' + h.opts(['휴원 예정', '퇴원 예정', '장학', '기타'], ui.b_reason || '', { act: 'CT04.reason' }) +
        (ui.b_reason === '기타' ? '<input class="inp" style="margin-top:6px" data-field="b_memo" placeholder="사유를 적어 주세요" value="' + esc(ui.b_memo || '') + '">' : '') +
        (ui.b_err ? '<div class="err">' + esc(ui.b_err) + '</div>' : '') +
        '<div class="hint">' + (ui.b_reason === '휴원 예정' || ui.b_reason === '퇴원 예정' ? '제외한 뒤 원생 상세(CT-06)에서 상태를 바꿔요. 상태가 재원으로 남으면 계정이 계속 열려 있어요.' : ui.b_reason ? '장학과 기타 사유는 원장이 승인해야 빠져요.' : '사유를 골라야 뺄 수 있어요.') + '</div></div>';
      const notTarget = list.filter(x => x.status !== '재원');
      if (notTarget.length) body += '<div class="cta-log"><div>' + h.chip('대상 아님', 'line') + ' ' + esc(notTarget.map(x => h.mask(x.name) + ' (' + x.status + ')').join(', ')) + ' 학생은 원래 청구 대상이 아니라서 빼요.</div></div>';
      const nEx = n - notTarget.length;
      if (!ui.b_reason) block = '제외 사유를 골라 주세요.';
      else if (!nEx) block = '고른 원생 중 재등록 청구 대상이 없어요.';
      const askOnly = (ui.b_reason === '장학' || ui.b_reason === '기타') && ctx.persona.role !== '원장';
      run = nEx + '명 제외' + (askOnly ? ' 요청' : ''); undo = '청구 전까지는 다시 넣을 수 있어요.';
    }
    body += '<div class="row" style="margin-top:12px;align-items:center"><span class="small muted">' + esc(undo) + '</span><span style="margin-left:auto"></span>' + h.btn('취소', { act: 'CT04.closeBulk' }) + h.btn(run, { primary: true, act: 'CT04.run', disabled: ro || !!block || !n, danger: mode === 'exclude' }) + '</div>';
    if (block && (ui.b_cls || ui.b_tpl || mode === 'exclude')) body += '<div class="cta-err" style="text-align:right;margin-top:4px">' + esc(block) + '</div>';
    body += '</div>';
    return h.card({ title: titles[mode] + ' 확인', sub: '실행하기 전에 대상과 결과를 먼저 봐요', pin: 5, right: h.btn('닫기', { sm: true, act: 'CT04.closeBulk' }), body });
  }

  B.screen({
    id: 'CT-04', side: 'ct', phase: 'P1a', devices: ['pc', 'tablet'], pages: [48],
    title: '원생 목록', menuLabel: '원생 목록', crumb: '원생 > 원생 목록',
    headActions: ctx => h.btn('알림톡 보내기', { act: 'CT04.msg', disabled: !ctx.canEdit }) + '<span style="display:inline-flex;margin-left:6px"' + h.p(7) + '>' + h.btn('엑셀', { act: 'CT04.excel', disabled: !ctx.canEdit }) + '</span>' + h.btn('+ 원생 등록', { primary: true, go: 'CT-05', disabled: !ctx.canEdit }),
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, ro = !ctx.canEdit;
      const tab = ui.tab || '재원';
      const cls = s.classes.filter(x => x.center === ctx.centerId);
      const rows = filtered(ctx);
      const n = selIds(ctx).length;
      const sel = (field, label, opts) => h.field({ type: 'select', field, value: ui[field] || (field === 'f_status' ? tab : '전체'), options: opts.map(o => typeof o === 'string' ? { v: o, l: label + ' ' + o } : { v: o.v, l: label + ' ' + o.l }) });
      let html = '<div class="cta-filter"' + h.p(1) + '>' +
        sel('f_status', '상태', TABS) + sel('f_cls', '반', ['전체'].concat(cls.map(x => ({ v: x.id, l: x.name })))) + sel('f_level', '레벨', ['전체', 'L1', 'L2', 'L3']) +
        sel('f_pay', '수납', ['전체', '수납 완료', '미수', '청구 전', '제외']) + sel('f_acc', '계정', ['전체', '활성', '가오픈', '유예', '정지']) +
        '<div class="field q"><input class="inp" data-field="f_q" placeholder="이름·연락처 뒷자리" value="' + esc(ui.f_q || '') + '"></div>' + h.btn('검색', { primary: true, act: 'CT04.search' }) +
        (ui.q && Object.keys(ui.q).some(k => ui.q[k] && ui.q[k] !== '전체') ? h.btn('초기화', { ghost: true, sm: true, act: 'CT04.resetFilter' }) : '') + '</div>';
      html += '<div class="tabs" style="margin-top:12px">' + TABS.map(t => { const k = tabCount(ctx, t); return '<button type="button" class="' + (t === tab ? 'on' : '') + '" data-act="CT04.tab" data-arg="' + t + '">' + t + (k != null ? ' ' + k : '') + '</button>'; }).join('') + '</div>';
      html += studentTable(ctx, rows);
      const total = tabCount(ctx, tab) || rows.length, pages = Math.max(1, Math.ceil(total / 11));
      html += '<div class="cta-bulk"' + h.p(3) + '><span>선택한 원생 <b>' + n + '명</b></span>' +
        h.btn('반 이동', { sm: true, act: 'CT04.bulk', arg: 'move', disabled: ro || !n }) + h.btn('알림톡', { sm: true, act: 'CT04.bulk', arg: 'msg', disabled: ro || !n }) + h.btn('재등록 대상 제외', { sm: true, act: 'CT04.bulk', arg: 'exclude', disabled: ro || !n }) +
        '<span class="pg">‹ <b>1</b>' + (pages > 1 ? ' 2' : '') + (pages > 2 ? ' 3' : '') + (pages > 4 ? ' … ' + pages : pages === 4 ? ' 4' : '') + ' ›<span class="muted">(예시 ' + rows.length + '명 표시)</span></span></div>';
      if (ui.bulk) html += '<div style="margin-top:12px">' + bulkPanel(ctx) + '</div>';
      const hist = s.ct04.history.filter(x => x.center === ctx.centerId).slice(0, 4);
      if (hist.length) html += '<div class="card" style="margin-top:12px"><div class="card-h"><h3>최근 일괄 작업</h3><span class="sub">일괄 작업도 이력에 남아요</span></div><div class="cta-log">' + hist.map(x => '<div>' + esc(x.at) + ' ' + esc(x.who) + ', ' + esc(x.what) + ' ' + x.n + '명, ' + esc(x.detail) + '</div>').join('') + '</div></div>';
      return html;
    },
    prd: {
      summary: '센터에 다니는 학생 명단이에요. 상태, 반, 레벨, 수납, 학습 계정으로 골라 보고, 여러 학생을 골라 한 번에 처리해요.',
      who: '원장과 실장·데스크가 써요. 교사와 보조교사는 보기만 해요(7쪽 권한표).',
      items: [
        { n: 1, t: '필터', d: '상태(재원, 휴원, 퇴원, 대기), 반, 레벨, 재등록 수납 상태, 학습 계정 상태로 걸러요. 이름이나 연락처 뒷자리 4개로도 찾아요. 검색을 누르면 적용돼요.', ref: 'p.48 ①' },
        { n: 2, t: '목록 정보', d: '수강권, 다음 달 재등록 상태, 학습 계정 상태(활성, 유예, 정지)를 한 줄에 봐요. 보호자 연락처는 가운데를 가려서 보여 줘요(CM-03). 줄을 누르면 원생 상세(CT-06)가 열려요.', pol: ['POL-23'], ref: 'p.48 ②' },
        { n: 3, t: '일괄 작업', d: '여러 원생을 골라 반 이동, 알림톡 발송, 재등록 대상 제외를 해요. 일괄 작업도 누가 언제 했는지 이력에 남아요.', pol: ['POL-35'], ref: 'p.48 ③' },
        { n: 4, t: '재등록 제외 사유', kind: 'review', imp: 'IMP-12', cond: true, reveal: 'CT04.bulk', revealArg: 'exclude', d: '재등록 대상에서 뺄 때는 사유를 꼭 골라요. 휴원이나 퇴원 사유면 원생 상세(CT-06)에서 상태를 바꾸도록 바로 이어 주고, 장학이나 기타 사유는 원장이 승인해야 빠져요. 돈을 안 냈는데 재원 상태와 학습 계정이 그대로 남는 일을 막아요.' },
        { n: 5, t: '일괄 작업 확인 단계', kind: 'review', imp: ['IMP-18', 'IMP-15'], cond: true, reveal: 'CT04.bulk', revealArg: 'move', d: '미리보기, 확인, 실행, 결과 순서로 가요. 반 이동은 옮길 반 정원과 같은 시간대 인원 합계(일시수용능력)를 검사하고, 알림톡은 승인된 템플릿만 고르게 하고 예상 비용과 잔액을 보여 줘요. 버튼에는 몇 명에게 무엇을 하는지, 아래에는 되돌릴 수 있는지를 적고, 끝나면 성공과 실패를 나눠 보여 줘요.', pol: ['POL-16', 'POL-34'] },
        { n: 6, t: '이번 달 수납과 다음 달 재등록 나눠 보기', kind: 'review', imp: 'IMP-12', d: '한 칸에 두 달 정보가 섞이지 않게 3월 수납과 4월 재등록을 나눠요. 재등록 청구 기간(20일~말일, 안)이 오기 전에는 4월 칸에 청구 전이라고 보여요.', pol: ['POL-24'] },
        { n: 7, t: '엑셀 내려받기 기록', kind: 'review', imp: 'IMP-14', d: '명단을 엑셀로 내려받을 때마다 사유와 항목을 골라요(CM-03). 연락처와 생년월일은 기본으로 빠져 있고, 넣더라도 가운데를 가려서 내보내요. 누가 왜 무엇을 내려받았는지 감사 로그에 남아요.', pol: ['POL-42'] },
      ],
      open: ['대기가 등록 후 수납 전 학생인지, 정원이 차서 기다리는 학생인지', '학습 계정을 언제 열고 막을지, 미수일 때 며칠 기다려 줄지 (POL-23)', '자동으로 보낼 알림톡 항목 (POL-35, 지금 값은 예시)', '퇴원생을 보관 기간(POL-40) 동안 목록에 어떻게 보여 줄지'],
      rules: ['보호자 연락처는 역할과 상관없이 기본으로 가려요. 풀 때마다 사유를 남겨요(CM-03).'],
    },
  });

  B.action('CT04.tab', (ctx, t) => { const ui = U(ctx, 'CT-04'); ui.tab = t; ui.f_status = t; });
  B.action('CT04.search', (ctx, arg) => {
    const ui = U(ctx, 'CT-04');
    if (arg && typeof arg === 'object') Object.assign(ui, arg);
    if (ui.f_status) ui.tab = ui.f_status;
    ui.q = { cls: ui.f_cls, level: ui.f_level, pay: ui.f_pay, acc: ui.f_acc, text: ui.f_q };
  });
  B.action('CT04.resetFilter', ctx => { const ui = U(ctx, 'CT-04'); ['f_cls', 'f_level', 'f_pay', 'f_acc', 'f_q'].forEach(k => { delete ui[k]; }); ui.q = {}; });
  B.action('CT04.check', (ctx, id) => { const ui = U(ctx, 'CT-04'); ui.sel = ui.sel || {}; ui.sel[id] = !ui.sel[id]; });
  B.action('CT04.checkAll', ctx => {
    const ui = U(ctx, 'CT-04'); ui.sel = ui.sel || {};
    const rows = filtered(B.ctx('CT-04')); const on = !rows.every(x => ui.sel[x.id]);
    rows.forEach(x => { ui.sel[x.id] = on; });
  });
  B.action('CT04.pick', (ctx, ids) => {
    const ui = U(ctx, 'CT-04'); ui.sel = {};
    (Array.isArray(ids) ? ids : String(ids || '').split(',')).map(x => String(x).trim()).filter(Boolean).forEach(id => { ui.sel[id] = true; });
  });
  B.action('CT04.bulk', (ctx, mode, el) => {
    const ui = U(ctx, 'CT-04');
    if (!selIds(Object.assign({}, ctx, { ui })).length) {
      if (el) { B.toast('원생을 먼저 골라 주세요.'); return false; }
      const vis = ctx.s.students.filter(x => x.center === ctx.centerId && x.status === '재원').slice(0, 2);
      ui.sel = {}; vis.forEach(x => { ui.sel[x.id] = true; });
      ui.tab = '재원';
    }
    ui.bulk = mode || 'move'; ui.bulkResult = null; ui.b_err = null;
  });
  B.action('CT04.msg', (ctx, arg, el) => B.actions['CT04.bulk'](ctx, 'msg', el));
  B.action('CT04.closeBulk', ctx => { const ui = U(ctx, 'CT-04'); ui.bulk = null; ui.bulkResult = null; ['b_cls', 'b_when', 'b_tpl', 'b_reason', 'b_memo', 'b_err'].forEach(k => { delete ui[k]; }); });
  B.action('CT04.target', (ctx, v) => { U(ctx, 'CT-04').b_cls = v; });
  B.action('CT04.when', (ctx, v) => { U(ctx, 'CT-04').b_when = v; });
  B.action('CT04.tpl', (ctx, v) => { U(ctx, 'CT-04').b_tpl = v; });
  B.action('CT04.reason', (ctx, v) => { const ui = U(ctx, 'CT-04'); ui.b_reason = v; ui.b_err = null; });
  B.action('CT04.run', (ctx, arg) => {
    const s = ctx.s, ui = U(ctx, 'CT-04'), c = ctx.center;
    if (arg && typeof arg === 'object') {
      if (arg.mode) ui.bulk = arg.mode;
      if (arg.ids) B.actions['CT04.pick'](ctx, arg.ids);
      ['target', 'when', 'tpl', 'reason', 'memo'].forEach(k => { if (arg[k] != null) ui[{ target: 'b_cls', when: 'b_when', tpl: 'b_tpl', reason: 'b_reason', memo: 'b_memo' }[k]] = arg[k]; });
    }
    const list = s.students.filter(x => selIds({ ui }).includes(x.id));
    const mode = ui.bulk; if (!mode || !list.length) return;
    const at = ctx.today.slice(5) + ' ' + clock(s), who = ctx.persona.name;
    const ok = [], fail = [], next = [];
    let msg = '', detail = '';
    if (mode === 'move') {
      const tgt = s.classes.find(x => x.id === ui.b_cls && x.center === ctx.centerId);
      if (!tgt) { B.toast('옮길 반을 골라 주세요.'); return; }
      const movers = list.filter(x => x.cls !== tgt.id);
      const same = s.classes.filter(x => x.center === ctx.centerId && x.days === tgt.days && x.time === tgt.time);
      if (tgt.enrolled + movers.length > tgt.cap) { B.toast(tgt.name + ' 정원이 넘쳐서 옮길 수 없어요.'); return; }
      if (c && same.reduce((a, x) => a + x.enrolled, 0) + movers.length > c.facilityCap) { B.toast('같은 시간대 합계가 일시수용능력을 넘어요.'); return; }
      const when = ui.b_when || '다음 수업부터';
      list.forEach(x => {
        if (x.cls === tgt.id) { fail.push({ name: h.mask(x.name), why: '이미 이 반이에요' }); return; }
        if (when === '4월 1일부터') s.ct04.pending[x.id] = { to: tgt.id, date: '2027-04-01' };
        else {
          const from = s.classes.find(k => k.id === x.cls); if (from) from.enrolled = Math.max(0, from.enrolled - 1);
          tgt.enrolled += 1; x.cls = tgt.id; delete s.ct04.pending[x.id];
        }
        ok.push(h.mask(x.name));
      });
      detail = tgt.name + ', ' + when; msg = ok.length + '명을 ' + (when === '4월 1일부터' ? '4월 1일부터 옮기도록 예약했어요' : '옮겼어요') + ' (' + tgt.name + ').';
    } else if (mode === 'msg') {
      const tpl = ((s.alim || {}).templates || []).find(x => x.id === ui.b_tpl);
      if (!tpl || tpl.status !== '승인') { B.toast('승인된 템플릿을 골라 주세요.'); return; }
      const unit = polNum('POL-34', c, 7), cost = list.length * unit;
      const bals = (s.alim || {}).balances || {};
      if (c && c.type !== '직영') { if ((bals[ctx.centerId] || 0) < cost) { B.toast('알림톡 잔액이 부족해요.'); return; } bals[ctx.centerId] -= cost; }
      list.forEach(x => { if (!x.phone) fail.push({ name: h.mask(x.name), why: '보호자 번호가 없어요' }); else ok.push(h.mask(x.name)); });
      detail = tpl.name + ', ' + h.money(ok.length * unit); msg = ok.length + '명에게 ' + tpl.name + ' 알림톡을 보냈어요 (예시).';
    } else if (mode === 'exclude') {
      const reason = ui.b_reason, memo = String(ui.b_memo || '').trim();
      if (!reason) { ui.b_err = '제외 사유를 골라 주세요.'; return; }
      if (reason === '기타' && !memo) { ui.b_err = '기타 사유는 내용을 적어 주세요.'; return; }
      const needApprove = (reason === '장학' || reason === '기타') && ctx.persona.role !== '원장';
      list.forEach(x => {
        if (x.status !== '재원') { fail.push({ name: h.mask(x.name), why: '원래 청구 대상이 아니에요 (' + x.status + ')' }); return; }
        s.ct04.rereg[x.id] = { state: needApprove ? '승인 대기' : '제외', reason: reason === '기타' ? memo : reason, by: who, at };
        ok.push(h.mask(x.name));
        if (reason === '휴원 예정' || reason === '퇴원 예정') next.push({ id: x.id, name: x.name, want: reason.replace(' 예정', '') });
      });
      detail = (reason === '기타' ? memo : reason) + (needApprove ? ', 원장 승인 대기' : '');
      msg = ok.length + '명을 ' + rereqPeriod(ctx).next + '월 재등록 대상에서 ' + (needApprove ? '빼 달라고 원장에게 요청했어요.' : '뺐어요.') + (next.length ? ' 원생 상세에서 상태를 바꿔 마무리해요.' : '');
    }
    s.ct04.history.unshift({ center: ctx.centerId, at, who, what: { move: '반 이동', msg: '알림톡', exclude: '재등록 제외' }[mode], n: ok.length, detail });
    ui.bulkResult = { mode, ok, fail, next, msg };
    ui.sel = {};
    B.toast(msg);
  });
  B.action('CT04.include', (ctx, id) => { delete ctx.s.ct04.rereg[id]; B.toast('재등록 대상에 다시 넣었어요.'); });
  B.action('CT04.approve', (ctx, id) => {
    const x = ctx.s.ct04.rereg[id]; if (!x) return;
    if (ctx.persona.role !== '원장') { B.toast('원장만 승인할 수 있어요.'); return; }
    x.state = '제외'; x.approvedBy = ctx.persona.name;
    const st = ctx.s.students.find(k => k.id === id);
    ctx.s.ct04.history.unshift({ center: ctx.centerId, at: ctx.today.slice(5) + ' ' + clock(ctx.s), who: ctx.persona.name, what: '재등록 제외 승인', n: 1, detail: (st ? h.mask(st.name) + ', ' : '') + x.reason });
    B.toast('재등록 제외를 승인했어요.');
  });
  B.action('CT04.open', (ctx, id) => { Object.assign(U(ctx, 'CT-06'), { student: id, from: 'CT-04' }); B.go('CT-06'); return false; });
  B.action('CT04.toDetail', (ctx, arg) => {
    const [id, want] = String(arg || '').split('|');
    Object.assign(U(ctx, 'CT-06'), { student: id, from: 'CT-04', want: want || null });
    B.go('CT-06'); return false;
  });
  // CM-03 다운로드 규칙. 사유와 항목을 고르고, 개인정보 항목은 기본으로 빼요. 연락처를 넣으면 가운데를 가려요 (IMP-14).
  const XLS_REASONS = ['학부모 상담 명단', '재등록 상담 준비', '일일 마감', '기타'];
  const XLS_ITEMS = [{ k: '이름', on: true }, { k: '학년', on: true }, { k: '반', on: true }, { k: '레벨', on: true }, { k: '연락처', on: false, pi: true }, { k: '생년월일', on: false, pi: true }];
  B.action('CT04.excel', (ctx, arg) => {
    const s = ctx.s;
    const log = (reason, items) => {
      const n = filtered(B.ctx('CT-04')).length;
      const pi = items.filter(k => k === '연락처' || k === '생년월일');
      (s.audit = s.audit || []).unshift({ at: ctx.today.slice(5) + ' ' + clock(s), who: shortWho(ctx), what: '엑셀 다운로드', target: '원생 목록 ' + n + '명, 항목 ' + items.join(', ') + (pi.length ? ' (가운데 가림)' : ''), reason });
      B.toast('엑셀을 내려받았어요. 사유와 항목이 감사 로그에 남았어요.');
    };
    if (arg && (typeof arg === 'string' || typeof arg === 'object')) {
      const reason = typeof arg === 'object' ? arg.reason : arg;
      const items = typeof arg === 'object' && Array.isArray(arg.items) ? arg.items : XLS_ITEMS.filter(x => x.on).map(x => x.k);
      if (reason) { log(String(reason), items); return; }
    }
    B.modal({
      title: '엑셀 내려받기',
      body: '<div class="field"><label for="cta-xls">내려받는 사유<span class="req">*</span></label><select class="inp" id="cta-xls"><option value="">사유를 골라 주세요</option>' + XLS_REASONS.map(x => '<option>' + esc(x) + '</option>').join('') + '</select>' +
        '<input class="inp" id="cta-xls-memo" style="margin-top:6px" placeholder="기타를 고르면 사유를 적어 주세요"><div class="err" id="cta-xls-err" hidden>사유를 골라야 내려받을 수 있어요.</div></div>' +
        '<div class="field" style="margin-top:10px"><label>항목</label><div class="row" style="gap:12px;flex-wrap:wrap">' +
        XLS_ITEMS.map(x => '<label class="cta-check"><input type="checkbox" data-xls="' + esc(x.k) + '"' + (x.on ? ' checked' : '') + '><span>' + esc(x.k) + (x.pi ? ' (개인정보)' : '') + '</span></label>').join('') + '</div></div>' +
        '<div class="small muted">개인정보 항목은 꼭 필요할 때만 골라요. 연락처와 생년월일은 가운데를 가린 채로 나가요. 누가 왜 내려받았는지 감사 로그에 남아요.</div>',
      ok: '내려받기',
      onOk: back => {
        let v = back.querySelector('#cta-xls').value;
        const memo = back.querySelector('#cta-xls-memo').value.trim();
        const errEl = back.querySelector('#cta-xls-err');
        if (!v || (v === '기타' && !memo)) { errEl.textContent = !v ? '사유를 골라야 내려받을 수 있어요.' : '기타 사유를 적어 주세요.'; errEl.hidden = false; return false; }
        if (v === '기타') v = memo;
        const items = Array.prototype.map.call(back.querySelectorAll('[data-xls]:checked'), el => el.getAttribute('data-xls'));
        if (!items.length) { errEl.textContent = '항목을 하나 이상 골라 주세요.'; errEl.hidden = false; return false; }
        log(v, items); return true;
      },
    });
    return false;
  });
})();
