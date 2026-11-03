/* HQ-16~20 본사 정산·공급 화면. 원문 p.35~40. */
(function () {
  const B = window.B, h = B.h, esc = B.esc, P = h.p;
  const won = n => (n == null || n === '' ? '-' : Number(n).toLocaleString('ko-KR'));
  const sum = (arr, f) => (arr || []).reduce((a, x) => a + (f ? f(x) : x), 0);
  const cname = (s, id) => ((s.centers || []).find(c => c.id === id) || {}).name || id;
  const ctype = (s, id) => ((s.centers || []).find(c => c.id === id) || {}).type || '';
  const muted = t => '<span class="muted">' + esc(t) + '</span>';
  const small = t => '<span class="muted small">' + esc(t) + '</span>';
  // 엔진이 동작 뒤 화면을 다시 그리면서 알림을 지우므로, 다시 그린 다음에 띄워요.
  const say = msg => { const at = B.state.screenId; setTimeout(() => { if (B.state.screenId === at) B.toast(msg); }, 0); };
  const deny = ctx => { if (ctx.canEdit) return false; say('보기만 할 수 있는 권한이에요. 정산이나 담당 역할로 바꿔 주세요.'); return true; };

  function card2(o) {
    return '<section class="card ' + (o.cls || '') + '"' + P(o.pin) + (o.style ? ' style="' + o.style + '"' : '') + '><div class="card-h"><h3>' + esc(o.title) + '</h3>' + (o.chip || '') +
      (o.sub ? '<span class="sub">' + esc(o.sub) + '</span>' : '') + (o.right ? '<div class="r">' + o.right + '</div>' : '') + '</div>' + (o.body || '') + '</section>';
  }
  function sel(field, value, options, o) {
    o = o || {};
    return '<select class="inp rr" data-field="' + esc(field) + '" style="width:auto;min-width:' + (o.w || 110) + 'px"' + (o.disabled ? ' disabled' : '') + (o.title ? ' title="' + esc(o.title) + '"' : '') + '>' +
      options.map(x => { const v = typeof x === 'string' ? x : x.v, l = typeof x === 'string' ? x : x.l; return '<option value="' + esc(v) + '"' + (String(v) === String(value) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>';
  }
  function bindRR(root, ctx) {
    Array.prototype.forEach.call(root.querySelectorAll('select.rr'), el => el.addEventListener('change', () => { ctx.ui[el.getAttribute('data-field')] = el.value; B.render(); }));
  }
  function radios(field, value, list, dis) {
    return list.map(x => '<label class="row" style="gap:5px;font-size:12.5px;display:inline-flex;margin-right:14px"><input type="radio" name="' + field + '" value="' + esc(x) + '" data-field="' + field + '"' + (x === value ? ' checked' : '') + (dis ? ' disabled' : '') + '>' + esc(x) + '</label>').join('');
  }
  function tbl(o) { const pin = o.pin; const c = Object.assign({}, o); delete c.pin; return '<div' + P(pin) + '>' + h.table(c) + '</div>'; }
  function formRow(label, inner) {
    return '<div style="display:grid;grid-template-columns:92px minmax(0,1fr);gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid var(--line-2)"><div class="small" style="font-weight:700;color:var(--sub)">' + esc(label) + '</div><div>' + inner + '</div></div>';
  }
  function note(text, pin, o) {
    o = o || {};
    return '<div class="small" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;color:var(--sub);' + (pin != null ? 'padding-left:16px;' : '') + (o.style || '') + '"' + P(pin) + '>' + text + '</div>';
  }
  function nw(t) { return '<span style="white-space:nowrap">' + esc(t) + '</span>';
  }

  /* ---------------- data ---------------- */
  B.extend(s => {
    // 9월 청구서를 원문 p.35 예시 값으로 맞춰요. HQ-16, HQ-17, CT-15가 같은 객체를 봐요.
    const inv = id => (s.invoices || []).find(x => x.id === id);
    const bu = inv('inv-busan-09'), dg = inv('inv-daegu-09');
    if (bu) Object.assign(bu, { month: '2027-09', status: '확인 대기', issued: '2027-10-05', due: '2027-10-15', paid: 0, dispute: bu.dispute || null,
      lines: [{ t: '시스템 사용료 41명 × 18,000원 (개별 특가)', a: 738000, k: 'fee' }, { t: '알림톡 후불 사용분', a: 12400, k: 'alim' }, { t: '교재 대금', a: 84000, k: 'book' }] });
    if (dg) Object.assign(dg, { month: '2027-09', status: '초안', issued: '', due: '2027-10-15', paid: 0, dispute: dg.dispute || null,
      lines: [{ t: '시스템 사용료 63명 × 20,000원', a: 1260000, k: 'fee' }, { t: '시스템 장애 보상', a: -20000, k: 'adj', item: '시스템 장애 보상', reason: '9/10 접속 장애 4시간', hours: 4, by: '정산팀장' }, { t: '교재 대금 (08-10 교재 주문분)', a: 126000, k: 'book', order: '08-10' }] });

    s.hq16 = {
      inv: {
        'inv-busan-09': { accts: 41, unit: 18000, unitNote: '개별 특가', tax: '발행 전', confirmBy: '10-08', reissue: false },
        'inv-daegu-09': { accts: 63, unit: 20000, unitNote: '', tax: '발행 전', confirmBy: '', reissue: false },
      },
      direct: [{ c: 'daechi1', n: 128 }, { c: 'mokdong', n: 96 }, { c: 'bundang', n: 84 }],
      mism: [
        { id: 'm1', center: 'daegu', inv: 'inv-daegu-09', student: '이*호', acct: '활성', st: '퇴원 (9/18)', cause: '퇴원 처리 후 계정 미정지', affects: false, state: '확인 전' },
        { id: 'm2', center: 'busan', inv: 'inv-busan-09', student: '김*아', acct: '활성', st: '휴원', cause: '휴원 계정 정책 확인', affects: true, state: '확인 전' },
      ],
      asked: false, routeFixed: false, log: [],
      sep: [
        { id: 'd1', date: '09-01', center: 'daechi1', student: '김*수', rec: 234000, method: '카드', via: '결제선생', pg: 234000, pgSt: '승인', bank: '09-03 입금', result: '일치' },
        { id: 'd2', date: '09-01', center: 'daechi1', student: '이*린', rec: 260000, method: '카드', via: '단말기', pg: null, bank: '-', result: '결제 누락' },
        { id: 'd3', date: '09-02', center: 'mokdong', student: '박*준', rec: 260000, method: '링크', via: '결제선생', pg: 260000, pgSt: '승인', bank: '-', result: '입금 지연' },
        { id: 'd4', date: '09-03', center: 'bundang', student: '최*윤', rec: 234000, method: '링크', via: '결제선생', pg: 260000, pgSt: '승인', bank: '09-06 입금', result: '금액 불일치' },
        { id: 'd5', date: '09-07', center: 'daechi1', student: '정*호', rec: -173340, method: '환불', via: '결제선생', pg: -173340, pgSt: '취소', bank: '09-09 차감', result: '일치' },
      ],
      rs: {}, reconLog: [], pg: {}, settled: false, reported: {},
    };

    s.hq17 = {
      students: {
        'inv-daegu-09': [
          { n: '김*수', per: '09-01 ~ 09-30', ev: '-', bill: '예', why: '', a: 20000 },
          { n: '이*호', per: '09-01 ~ 09-18', ev: '퇴원 09-18', bill: '예', why: '퇴원 반환 없음 (안)', a: 20000 },
          { n: '박*윤', per: '09-15 ~ 09-30', ev: '등록 09-15', bill: '예', why: '월중 등록 전액 (안)', a: 20000 },
          { n: '정*아', per: '-', ev: '휴원 9월', bill: '아니오', why: '휴원 계정 정지', a: 0 },
          { n: '… 60명', per: '', ev: '', bill: '', why: '', a: 1200000, rest: true },
        ],
      },
      ledger: {
        daegu: [
          { d: '05-24', t: '가맹비', c: 5000000, p: 5000000 },
          { d: '08-10', t: '교재 주문', c: 126000, p: 0 },
          { d: '08-15', t: '입금', c: 0, p: 126000 },
          { d: '09-02', t: '알림톡 충전', c: 50000, p: 50000 },
        ],
        busan: [{ d: '-', t: '가맹비 (테스트베드 면제, 안)', c: 0, p: 0 }],
      },
    };

    // 알림톡: 원문 p.38 템플릿 심사 상태와 잔액
    const A = s.alim = s.alim || { balances: {}, templates: [], auto: {}, topups: [], log: [] };
    const st = { T04: '심사 중', T05: '승인', T06: '반려' };
    (A.templates || []).forEach(t => { if (st[t.id]) t.status = st[t.id]; if (t.id === 'T01') t.text = '#{학생명} 학생이 #{시각}에 입실했습니다.'; });
    A.balances = Object.assign(A.balances || {}, { busan: 3120, daegu: 41500 });
    A.log = A.log || [];
    [{ at: '10-04 16:05', center: 'busan', tpl: 'T01', n: 24, ok: 24, fail: 0, cost: 168 },
      { at: '10-04 09:00', center: 'busan', tpl: 'T05', n: 38, ok: 37, fail: 1, reason: '번호 오류', cost: 259 }].forEach(r => {
      if (!A.log.some(x => x.at === r.at && x.tpl === r.tpl)) A.log.push(r);
    });
    s.hq18 = {
      usage: { busan: 18900, daegu: 22400, direct: 61200 },
      used: { T01: 5, T02: 5, T03: 5, T04: '-', T05: 4, T06: '-' },
      vars: { T01: '학생명·시각', T02: '학생명·시각', T03: '금액·링크', T04: '금액·기한', T05: '월·금액', T06: '링크' },
      reason: { T06: '링크를 누르면 무엇을 보는지 안내 문구가 부족해요 (예시)' },
      th: null, grace: {}, asked: {},
    };

    // 교재·물품: 원문 p.39 주문 예시를 더해요
    s.orders = s.orders || [];
    const o5 = s.orders.find(o => o.id === '#0705' && o.center === 'daegu');
    if (o5) Object.assign(o5, { item: '도서 키트 L3', qty: 1, amount: 98000, status: '배송 완료', date: '09-24' });
    [{ id: '#0712', center: 'daegu', item: 'L1~L4 워크북 (10월 2주)', qty: 63, amount: 113400, status: '제작', date: '10-08' },
      { id: '#0711', center: 'busan', item: 'L2 워크북, 전단', qty: 41, qtyText: '41 · 2', amount: 97800, status: '접수', date: '10-08' },
      { id: '#0698', center: 'busan', item: 'L2 워크북', qty: 3, amount: 5400, status: '반품 요청', date: '-' }].forEach(o => {
      if (!s.orders.some(x => x.id === o.id && x.center === o.center)) s.orders.push(o);
    });
    s.hq19 = {
      products: [
        { id: 'g1', name: 'L2 주간 워크북 (10월 2주)', must: '필수', unit: '권', price: 1800, calc: '인쇄 원가 + N%', stock: '주문 수량만큼 인쇄', sale: '판매' },
        { id: 'g2', name: 'L3 주간 워크북 (10월 2주)', must: '필수', unit: '권', price: 1800, calc: '인쇄 원가 + N%', stock: '주문 수량만큼 인쇄', sale: '판매' },
        { id: 'g3', name: '레벨 도서 키트 L2', must: '권장', unit: '세트', price: 98000, calc: '시중가 이하', stock: '재고 14', sale: '판매' },
        { id: 'g4', name: '학습 패드 (지정 사양)', must: '권장', unit: '대', price: null, calc: 'POL-38 결정 후', stock: '-', sale: '준비' },
        { id: 'g5', name: '홍보 전단', must: '권장', unit: '100매', price: 12000, calc: '실비', stock: '재고 40', sale: '판매' },
      ],
      sched: {}, todo: [], spare: 0, closed: false, rush: false, view: '가맹 주문',
    };

    // 콘텐츠 배포: 원문 p.40
    s.hq20 = {
      versions: [
        { v: '2027.3', level: 'L1~L4', books: 46, sessions: 138, status: '배포 중', date: '2027-07-05' },
        { v: '2027.4', level: 'L1~L4', books: 48, sessions: 144, status: '예정', date: '2027-10-04' },
      ],
      centers: ['daechi1', 'mokdong', 'busan', 'daegu'],
      open: { daechi1: [1, 1, 1, 0], mokdong: [1, 1, 0, 0], busan: [0, 1, 1, 0], daegu: [1, 1, 1, 1] },
      block: {}, testVer: { daechi1: '간단판 v1', mokdong: '간단판 v1', busan: '간단판 v1', daegu: '간단판 v1' },
      test: { brain: '간단판 v1', read: 'v1', report: '유형·레벨형 v1' }, deployed: null,
      scheduled: null, drafts: [], checked: false, errors: 0,
    };
  });

  /* ---------------- invoice helpers (HQ-16, HQ-17) ---------------- */
  const LV = ['L1', 'L2', 'L3', 'L4'];
  const monthLabel = m => (m ? Number(String(m).slice(5, 7)) + '월' : '');
  function kindOf(l) {
    if (l.k) return l.k;
    const t = l.t || '';
    if (/사용료/.test(t)) return 'fee';
    if (/알림톡/.test(t)) return 'alim';
    if (/교재|도서|워크북/.test(t)) return 'book';
    if (/조정|보상|정정|차감/.test(t) || Number(l.a) < 0) return 'adj';
    return 'etc';
  }
  const part = (inv, k) => sum((inv.lines || []).filter(l => kindOf(l) === k), l => Number(l.a) || 0);
  const total = inv => sum(inv.lines || [], l => Number(l.a) || 0);
  const findInv = (s, id) => (s.invoices || []).find(x => x.id === id);
  const ORDER = ['busan', 'daegu'];
  const monthInvs = s => (s.invoices || []).filter(i => (i.month || '2027-09') === '2027-09' && ctype(s, i.center) !== '직영')
    .sort((a, b) => (ORDER.indexOf(a.center) + 1 || 9) - (ORDER.indexOf(b.center) + 1 || 9));
  function meta(s, inv) {
    const M = s.hq16.inv;
    if (!M[inv.id]) M[inv.id] = { accts: 0, unit: 0, unitNote: '', tax: '발행 전', confirmBy: '', reissue: false };
    return M[inv.id];
  }
  function disputeOpen(s, inv) {
    const d = inv.dispute;
    if (!d) return false;
    if (meta(s, inv).disputeDone) return false;
    if (typeof d === 'object' && /완료|처리|닫|기각|반영/.test(d.status || '')) return false;
    return true;
  }
  const disputeText = d => (typeof d === 'string' ? d : (d && (d.reason || d.text || d.memo || d.title)) || '이의 신청');
  // 접수일, 처리 상태, 본사 답변 기한 (CT-15가 due를 넣으면 그 날짜, 없으면 예시 날짜)
  const disputeMeta = d => { const o = d && typeof d === 'object' ? d : {}; return (o.at ? '접수 ' + o.at + ', ' : '') + '상태 ' + (o.status || '접수') + ', 본사 답변 기한 ' + (o.due ? String(o.due).slice(-5) : '10-09 (예시)'); };
  const blockers = (s, center) => s.hq16.mism.filter(m => m.center === center && !m.done && m.affects);
  const CONF = ['확정', '입금 완료', '연체'];
  function invChip(s, inv) {
    if (disputeOpen(s, inv)) return h.chip('이의 신청', 'warn');
    const map = { '초안': ['초안', ''], '확인 대기': ['센터 확인 중', 'info'], '센터 확인 중': ['센터 확인 중', 'info'], '확인 완료': ['센터 확인 완료', 'info'], '확정': ['확정', 'ok'], '입금 완료': ['입금 완료', 'ok'], '연체': ['연체', 'bad'] };
    const m = map[inv.status] || [inv.status || '-', ''];
    return h.chip(m[0], m[1]) + (meta(s, inv).reissue ? ' ' + h.chip('재발행 대기', 'warn') : '');
  }
  function addLog(s, text) { s.hq16.log.unshift(text); }

  /* ---------------- HQ-16 (1/2) 월 마감·청구 ---------------- */
  function stageBar(labels, done, pin) {
    const cur = done.indexOf(false);
    return '<div style="display:grid;grid-template-columns:repeat(' + labels.length + ',minmax(0,1fr));gap:6px;margin-bottom:12px"' + P(pin) + '>' + labels.map((l, i) => {
      const stt = i === cur ? 'cur' : done[i] ? 'done' : 'todo';
      const style = stt === 'cur' ? 'background:var(--navy);color:#fff;border-color:var(--navy)' : stt === 'done' ? 'background:#eef0f4;color:var(--sub)' : 'background:#fff;color:var(--sub)';
      return '<div style="border:1px solid #cfd4dc;border-radius:7px;padding:6px 6px;font-size:11.8px;font-weight:700;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' + style + '">' + (stt === 'done' ? '✓ ' : '') + esc(l) + '</div>';
    }).join('') + '</div>';
  }

  function closeTab(ctx) {
    const s = ctx.s, H = s.hq16, ro = !ctx.canEdit;
    const invs = monthInvs(s);
    const open = H.mism.filter(m => !m.done);
    const okSt = ['확인 완료'].concat(CONF);
    const done = [true, open.length === 0, invs.every(i => i.status !== '초안'), invs.every(i => okSt.includes(i.status) && !disputeOpen(s, i)),
      invs.every(i => CONF.includes(i.status)), invs.every(i => meta(s, i).tax === '발행 완료'), invs.every(i => i.status === '입금 완료')];
    const labels = ['① 스냅샷 10/1 0시', '② 대사' + (open.length ? ' (불일치 ' + open.length + ')' : ''), '③ 청구서 초안', '④ 센터 확인 D-3', '⑤ 확정', '⑥ 세금계산서', '⑦ 입금'];
    let html = stageBar(labels, done, 1);

    const accts = sum(invs, i => meta(s, i).accts);
    const over = invs.filter(i => i.status === '연체').length;
    html += h.kpis([
      { l: '청구 대상', v: '가맹 ' + invs.length + '곳', s: '직영 3곳은 통계만' },
      { l: '과금 계정', v: won(accts), s: '학습 계정 활성 기준' },
      { l: '청구 예정액', v: won(sum(invs, total)), s: '사용료, 알림톡, 교재 합계' },
      { l: '연체', v: String(over), s: over ? '연체 단계 적용 중' : '단계 없음', tone: over ? 'bad' : '' },
    ], 4);

    // ③ 청구서 표
    const rows = invs.map(i => ({ inv: i, c: i.center })).concat(H.direct.map(d => ({ c: d.c, n: d.n })));
    const dash = '<span class="muted">-</span>';
    html += '<div style="margin-top:12px"></div>' + tbl({
      pin: 3,
      cols: [
        { label: '센터', render: r => r.inv ? '<b>' + esc(cname(s, r.c)) + '</b>' : muted(cname(s, r.c)) },
        { label: '유형', render: r => r.inv ? esc(ctype(s, r.c)) : muted(ctype(s, r.c)) },
        { label: '과금 계정', num: true, render: r => r.inv ? won(meta(s, r.inv).accts) : muted(won(r.n)) },
        { label: '단가', render: r => r.inv ? won(meta(s, r.inv).unit) + ' ' + (meta(s, r.inv).unitNote ? h.chip('개별', 'navy') + ' ' : '') + h.chip('예시', 'st-예시') : muted('내부 대체') },
        { label: '사용료', num: true, render: r => r.inv ? won(part(r.inv, 'fee')) : muted('(' + won(r.n * 20000) + ')') },
        { label: '조정', num: true, render: r => r.inv && part(r.inv, 'adj') ? won(part(r.inv, 'adj')) : dash },
        { label: '알림톡', num: true, render: r => r.inv && part(r.inv, 'alim') ? won(part(r.inv, 'alim')) : dash },
        { label: '교재', num: true, render: r => r.inv && part(r.inv, 'book') ? won(part(r.inv, 'book')) : dash },
        { label: '합계', num: true, render: r => r.inv ? '<b>' + won(total(r.inv)) + '</b>' : muted('청구 없음') },
        { label: '상태', render: r => r.inv ? invChip(s, r.inv) : h.chip('통계', '') },
        { label: '계산서 / 입금 / 연체', render: r => r.inv ? '<span class="small">' + esc((meta(s, r.inv).tax === '발행 완료' ? '발행' : '-') + ' / ' + (r.inv.status === '입금 완료' ? '입금' : '-') + ' / ' + (r.inv.status === '연체' ? '1단계' : '-')) + '</span>' : muted('해당 없음') },
      ],
      rows,
      rowAttr: r => r.inv ? ' class="click" data-act="HQ16.open" data-arg="' + r.inv.id + '" title="청구서 상세(HQ-17)로 가요"' : '',
    });

    // ⑧ 검토 반영 청구 경로 검사 (IMP-26)
    const issues = routeIssues(s);
    html += '<div style="margin-top:10px"' + P(8) + '>' + (issues.length
      ? h.alert('<div>' + issues.map(x => '<div style="margin:2px 0">' + esc(x.text) + '</div>').join('') + '</div>' +
        (issues.some(x => x.fix) ? '<div style="margin-top:8px">' + h.btn('중복 줄 빼고 다시 계산', { sm: true, act: 'HQ16.fixRoute', disabled: ro }) + '</div>' : ''), 'review', { title: '청구 경로 검사', raw: true })
      : h.alert('같은 돈을 두 번 청구한 줄이 없어요. 교재 줄에는 출고한 주문 번호가 붙어 있어요.', 'review', { title: '청구 경로 검사' })) + '</div>';

    // ② 대사 결과
    const act = 104 - H.mism.filter(m => m.done && m.how !== 'keep').length;
    const enr = 102 + H.mism.filter(m => m.done && m.how === 'keep').length;
    html += '<div style="margin-top:12px"></div>' + card2({
      pin: 2, title: '대사 결과', sub: '스냅샷 10/1 0시 기준',
      right: h.btn(H.asked ? '확인 요청 완료' : '센터에 확인 요청', { sm: true, act: 'HQ16.request', disabled: ro || H.asked || !open.length }),
      body: '<div style="margin-bottom:8px;font-size:13px">학습 계정 활성 ' + act + '명, 원생 상태 재원 ' + enr + '명. ' + (open.length ? '<b>' + open.length + '건을 확인해야 해요.</b>' : '<b>모두 맞췄어요.</b>') + '</div>' +
        h.table({
          cols: [
            { label: '센터', render: m => esc(cname(s, m.center)) },
            { label: '원생', k: 'student' },
            { label: '계정 상태', render: m => esc(m.done && m.how !== 'keep' ? '정지' : m.acct) },
            { label: '원생 상태', k: 'st' },
            { label: '추정 원인', k: 'cause' },
            { label: '9월 금액', render: m => m.affects ? h.chip('영향 있음', 'bad') : h.chip('영향 없음', '') },
            { label: '처리', render: m => m.done ? h.chip('처리 완료', 'ok') + ' ' + small(m.note || '') :
              (m.state !== '확인 전' ? small(m.state) + ' ' : '') + (m.affects
                ? h.btn('과금 제외', { sm: true, act: 'HQ16.resolve', arg: m.id + '|exclude', disabled: ro }) + ' ' + h.btn('과금 유지', { sm: true, ghost: true, act: 'HQ16.resolve', arg: m.id + '|keep', disabled: ro })
                : h.btn('계정 정지 반영', { sm: true, act: 'HQ16.resolve', arg: m.id + '|stop', disabled: ro })) },
          ],
          rows: H.mism,
        }) +
        '<div style="margin-top:10px"' + P(7) + '>' + h.alert('9월 금액에 영향이 없는 불일치는 확정을 막지 않고 경고만 해요. 영향이 있는 건은 그 센터의 발행과 확정만 막아요. 지금 막힌 센터 ' +
          (invs.filter(i => blockers(s, i.center).length).map(i => cname(s, i.center)).join(', ') || '없음') + '.', 'review', { title: '검토 반영' }) + '</div>',
    });

    // ④ ⑤ ⑥ 단계별 처리
    const confirmRow = i => {
      const c = cname(s, i.center), m = meta(s, i);
      let btn = '';
      const blk = blockers(s, i.center).length > 0, why = '9월 금액에 영향을 주는 대사 불일치가 남아 있어요';
      const wait = blk ? '<span class="small" style="color:var(--bad);white-space:nowrap">불일치 처리 후</span>' : '';
      if (i.status === '초안') btn = wait + h.btn('발행', { sm: true, primary: true, act: 'HQ16.issue', arg: i.id, disabled: ro || blk, title: blk ? why : '' });
      else if (disputeOpen(s, i)) btn = h.btn('조정하러 가기', { sm: true, act: 'HQ16.open', arg: i.id });
      else if (i.status === '확인 대기' || i.status === '센터 확인 중') btn = h.btn('센터 확인 완료', { sm: true, act: 'HQ16.centerOk', arg: i.id, disabled: ro });
      else if (i.status === '확인 완료') btn = wait + h.btn('확정', { sm: true, primary: true, act: 'HQ16.confirm', arg: i.id, disabled: ro || blk, title: blk ? why : '' });
      else btn = small('확정 완료');
      return '<div><b style="min-width:92px;white-space:nowrap">' + esc(c) + '</b>' + invChip(s, i) + (m.confirmBy && !CONF.includes(i.status) ? '<span class="muted small" style="white-space:nowrap">기한 ' + esc(m.confirmBy) + '</span>' : '') + '<span style="margin-left:auto;display:flex;gap:6px;align-items:center">' + btn + '</span></div>';
    };
    const disputes = invs.filter(i => disputeOpen(s, i));
    const dLine = i => {
      const d = i.dispute;
      return '<div style="margin:6px 0 2px"><b>' + esc(cname(s, i.center)) + '</b> ' + esc(disputeText(d)) +
        '<div class="small" style="margin:2px 0 5px">' + esc(disputeMeta(d)) + '</div>' +
        h.btn('다음 달로 넘기고 확정', { sm: true, act: 'HQ16.carry', arg: i.id, disabled: ro }) + '</div>';
    };
    const c4 = card2({
      pin: 4, title: '센터 확인·이의',
      body: '<div class="list">' + invs.map(confirmRow).join('') + '</div>' + small('센터 확인 기간 청구서 발행 후 3일 (예시). 센터는 CT-15에서 이의를 신청해요.') +
        '<div style="margin-top:8px"' + P(9) + '>' + h.alert('확정 마감 10-09 (예시). 월합계 세금계산서는 다음 달 10일까지 발급해요 (법정, 세무사 확인 전). 마감까지 못 끝낸 이의는 다음 달 조정으로 넘기고 확정해요.' +
          (disputes.length ? '<div style="margin-top:6px">' + disputes.map(dLine).join('') + '</div>'
            : '<div class="small" style="margin-top:6px">지금 열린 이의가 없어요. 센터가 CT-15에서 이의를 내면 접수일, 처리 상태, 본사 답변 기한이 여기 보여요.</div>'),
        'review', { title: '검토 반영', raw: true }) + '</div>',
    });
    const c5 = card2({
      pin: 5, title: '세금계산서',
      body: '<div class="list">' + invs.map(i => { const m = meta(s, i); return '<div><b style="min-width:92px">' + esc(cname(s, i.center)) + '</b>' + h.chip(m.tax, m.tax === '발행 완료' ? 'ok' : '') + '<span style="margin-left:auto">' +
        (m.tax !== '발행 완료' ? h.btn('발행', { sm: true, act: 'HQ16.tax', arg: i.id, disabled: ro || !CONF.includes(i.status), title: CONF.includes(i.status) ? '' : '확정한 뒤 발행해요' }) : small('외부 서비스 접수')) + '</span></div>'; }).join('') + '</div>' +
        small('외부 세금계산서 서비스로 발행하고 상태를 받아 와요. 과세 구분은 세무 확인 전이에요.'),
    });
    const c6 = card2({
      pin: 6, title: '입금·연체', chip: h.polChip('POL-04') + h.polChip('POL-05'),
      body: '<div class="list">' + invs.map(i => '<div><span><b style="white-space:nowrap">' + esc(cname(s, i.center)) + '</b><br><span class="muted small" style="white-space:nowrap">기한 ' + esc(String(i.due || '').slice(5)) + '</span></span>' +
        (i.status === '입금 완료' ? h.chip('입금 완료', 'ok') : i.status === '연체' ? h.chip('연체 1단계', 'bad') : '') + '<span style="margin-left:auto;display:flex;gap:6px">' +
        (i.status !== '입금 완료' ? h.btn('입금 확인', { sm: true, act: 'HQ16.paid', arg: i.id, disabled: ro || !(CONF.includes(i.status)) }) + (i.status !== '연체' ? h.btn('연체 적용', { sm: true, ghost: true, act: 'HQ16.overdue', arg: i.id, disabled: ro || i.status !== '확정' }) : '') : '') + '</span></div>').join('') + '</div>' +
        small('납부 기한은 매월 15일 (예시). 연체 단계 내용은 아직 정하지 않았어요.'),
    });
    html += '<div class="grid" style="margin-top:12px;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr)">' + c4 + c5 + c6 + '</div>';
    if (H.log.length) html += '<div class="card" style="margin-top:12px"><div class="card-h"><h3>이번 달 마감 기록</h3></div><div class="tl">' + H.log.slice(0, 6).map(x => '<div>' + esc(x) + '</div>').join('') + '</div></div>';
    return html;
  }

  function routeIssues(s) {
    const out = [];
    monthInvs(s).forEach(i => {
      const c = cname(s, i.center);
      const prepaid = s.alim && s.alim.balances && s.alim.balances[i.center] != null;
      if (prepaid && part(i, 'alim')) out.push({ fix: true, text: c + ' 알림톡 ' + won(part(i, 'alim')) + '원. 이 센터는 알림톡을 선불로 충전해 써요 (HQ-18). 후불로 또 청구하면 두 번 받아요.' });
      (i.lines || []).filter(l => kindOf(l) === 'book').forEach(l => {
        const paidBefore = l.order && !String(l.order).startsWith('#') && ((s.hq17.ledger[i.center] || []).some(x => x.t === '입금' && x.p >= l.a));
        if (paidBefore) out.push({ fix: true, text: c + ' 교재 ' + won(l.a) + '원은 ' + l.order + ' 주문분이고 이미 입금됐어요 (HQ-17 원장). 9월에 출고한 주문은 ' + shippedOrders(s, i.center).map(o => o.id + ' ' + won(o.amount) + '원').join(', ') + '이에요 (HQ-19).' });
        else if (!l.order) out.push({ fix: false, text: c + ' 교재 ' + won(l.a) + '원은 어느 주문인지 번호가 없어요. HQ-19 주문과 맞춰 주세요.' });
      });
    });
    return out;
  }
  const shippedOrders = (s, center) => (s.orders || []).filter(o => o.center === center && /배송 완료|출고/.test(o.status) && String(o.date || '').startsWith('09'));

  /* ---------------- HQ-16 (2/2) 직영 수납 대사 ---------------- */
  const TYPES = ['결제 누락', '입금 지연', '금액 불일치', '취소 미반영'];
  function marchRows(s) {
    return (s.payments || []).filter(p => ctype(s, p.center) === '직영').map(p => {
      const st = (s.students || []).find(x => x.id === p.student);
      const m = String(p.method || '');
      const via = /결제선생/.test(m) ? '결제선생' : /단말기|카드/.test(m) ? '단말기' : /현금/.test(m) ? '현금' : /이체/.test(m) ? '계좌이체' : /지역화폐/.test(m) ? '지역화폐' : '기타';
      const short = via === '결제선생' ? '링크' : via === '단말기' ? '카드' : via === '계좌이체' ? '이체' : via;
      return { id: p.id, date: p.date, center: p.center, student: h.mask(st ? st.name : p.student), rec: p.amount, method: short, via, pg: via === '결제선생' ? p.amount : null, pgSt: '승인',
        bank: via === '결제선생' ? '정산 대기' : '-', result: via === '결제선생' ? '일치' : '결제 누락', receipt: p.receipt };
    });
  }
  function reconRows(s, month) {
    const base = month === '2027-03' ? marchRows(s) : s.hq16.sep;
    return base.map(r => Object.assign({}, r, s.hq16.rs[r.id] || {}));
  }
  const isOpen = r => r.result !== '일치' && !r.done && !r.auto;
  function resultChip(r) {
    if (r.done) return h.chip('처리 완료', 'ok') + ' ' + small(r.done.act);
    if (r.auto) return h.chip(r.auto, 'info');
    return h.chip(r.result, { '일치': 'ok', '결제 누락': 'bad', '입금 지연': 'warn', '금액 불일치': 'warn', '취소 미반영': 'warn' }[r.result] || '');
  }
  function initForm(ui, r) {
    if (!r || ui.formFor === r.id) return;
    ui.formFor = r.id;
    ui.f_type = TYPES.includes(r.result) ? r.result : '결제 누락';
    ui.f_act = r.result === '결제 누락' ? '결제 재요청' : '메모만';
    ui.f_memo = r.id === 'd2' ? '현장 카드 결제 후 결제선생 미연동' : '';
    ui.f_rcpt = ''; ui.f_err = null;
  }

  function reconTab(ctx) {
    const s = ctx.s, H = s.hq16, ui = ctx.ui, ro = !ctx.canEdit, month = ui.month || '2027-09';
    const all = reconRows(s, month);
    const open = all.filter(isOpen);
    let k;
    if (month === '2027-09') {
      k = [{ l: '수납 기록 (센터)', v: '314건', s: '₩ 85,120,000' }, { l: '결제선생 결제', v: '312건', s: '₩ 84,560,000' }, { l: '본사 계좌 입금', v: '309건', s: '₩ 83,900,000' }];
    } else {
      const pg = all.filter(r => r.pg != null);
      k = [{ l: '수납 기록 (센터)', v: all.length + '건', s: '₩ ' + won(sum(all, r => r.rec)) }, { l: '결제선생 결제', v: pg.length + '건', s: '₩ ' + won(sum(pg, r => r.pg)) }, { l: '본사 계좌 입금', v: '0건', s: '정산 대기 ' + pg.length + '건' }];
    }
    k.push({ l: '불일치', v: open.length + '건', s: open.length ? '처리 전' : '모두 처리했어요', tone: open.length ? 'warn' : 'ok' });
    let html = '<div' + P(1) + '>' + h.kpis(k, 4) + '</div>';

    const fst = ui.fst || '전체', fct = ui.fct || '직영 전체';
    html += '<div class="row" style="margin:12px 0 10px"' + P(2) + '>' +
      sel('fst', fst, [{ v: '전체', l: '상태 전체' }, { v: '일치', l: '상태 일치' }, { v: '불일치', l: '상태 불일치' }, { v: '처리 완료', l: '상태 처리 완료' }]) +
      sel('fct', fct, [{ v: '직영 전체', l: '센터 직영 전체' }].concat(H.direct.map(d => ({ v: d.c, l: '센터 ' + cname(s, d.c) })))) +
      h.btn(ui.only ? '불일치만 보는 중' : '불일치만', { act: 'HQ16.only', primary: !!ui.only }) +
      small('센터 수납 기록, 결제선생 결제, 본사 계좌 입금을 한 건씩 맞춰요') + '</div>';
    const rows = all.filter(r => (fct === '직영 전체' || r.center === fct) && (!ui.only || isOpen(r)) &&
      (fst === '전체' || (fst === '일치' && r.result === '일치') || (fst === '불일치' && isOpen(r)) || (fst === '처리 완료' && (r.done || r.auto))));
    let cur = all.find(r => r.id === ui.sel && isOpen(r)) || open[0] || null;
    if (cur) { ui.sel = cur.id; initForm(ui, cur); }
    html += tbl({
      pin: 3,
      cols: [
        { label: '일자', k: 'date' },
        { label: '센터', render: r => esc(cname(s, r.center)) },
        { label: '원생', k: 'student' },
        { label: '수납 기록', render: r => won(r.rec) + ' ' + esc(r.method) },
        { label: '결제선생', render: r => r.pg != null ? won(r.pg) + ' ' + esc(r.pgSt || '승인') : '-' },
        { label: '본사 입금', k: 'bank' },
        { label: '대사 결과', render: resultChip },
      ],
      rows,
      rowAttr: r => isOpen(r) ? ' class="click' + (cur && r.id === cur.id ? ' sel' : '') + '" data-act="HQ16.pick" data-arg="' + r.id + '"' : '',
      empty: '조건에 맞는 수납이 없어요.',
    });
    html += '<div class="small muted" style="margin:6px 2px 0">불일치 유형은 결제 누락, 입금 지연, 금액 불일치, 취소 미반영 네 가지예요. 줄을 누르면 아래에서 처리해요.</div>';

    // ④ 불일치 처리 + ⑤ 검토 반영
    let form;
    if (cur) {
      const viaText = { '단말기': '현장 카드 단말기 수납', '현금': '현장 현금 수납', '계좌이체': '계좌이체 수납', '결제선생': '결제선생 수납', '지역화폐': '지역화폐 수납' }[cur.via] || cur.via;
      const needRcpt = (cur.via === '현금' || cur.via === '계좌이체') && Math.abs(cur.rec) >= 100000;
      form = '<div class="small" style="margin-bottom:4px"><b>' + esc(cur.date + ' ' + cname(s, cur.center) + ' ' + cur.student) + '</b> ' + small(won(cur.rec) + '원, ' + viaText) + '</div>' +
        formRow('유형', sel('f_type', ui.f_type, TYPES, { disabled: ro, w: 140 })) +
        formRow('조치', '<div>' + radios('f_act', ui.f_act, ['수납 기록 취소', '결제 재요청', '메모만'], ro) + '</div><div style="margin-top:4px">' + h.chip('검토 반영', 'review') + ' ' + radios('f_act', ui.f_act, ['현장 수납 확인', '차액 환불 (CT-10)'], ro) + '</div>') +
        formRow('메모', '<input class="inp" data-field="f_memo" value="' + esc(ui.f_memo || '') + '"' + (ro ? ' disabled' : '') + ' placeholder="조치 이유를 남겨요">') +
        (needRcpt ? formRow('현금영수증', cur.receipt === '발급' ? h.chip('발급 확인', 'ok') : '<input class="inp" data-field="f_rcpt" value="' + esc(ui.f_rcpt || '') + '" placeholder="승인번호 (CT-07 기록에 없음)"' + (ro ? ' disabled' : '') + '>') : '') +
        (ui.f_err ? '<div class="field"><div class="err">' + esc(ui.f_err) + '</div></div>' : '') +
        '<div class="row" style="margin-top:10px">' + h.btn('처리 완료', { primary: true, act: 'HQ16.fix', arg: cur.id, disabled: ro }) + '</div>';
    } else {
      form = h.empty('남은 불일치가 없어요. 대사 결과를 직영 매출 보고에 넣을 수 있어요.') +
        '<div class="row" style="margin-top:10px">' + h.btn(H.reported[month] ? '매출 보고에 반영했어요' : '직영 매출 보고에 반영', { primary: !H.reported[month], act: 'HQ16.report', disabled: ro || !!H.reported[month] }) + '</div>';
    }
    const rv = cur && cur.via === '단말기'
      ? '결제선생 기록이 없는 카드 수납이에요. 현장 단말기로 받았다면 결제 재요청을 하지 말고 VAN 매출과 맞춰요. 재요청하면 학부모가 두 번 결제해요.' +
        '<div style="margin-top:6px">' + (cur.van ? h.chip('VAN 매출 ' + cur.date + ' ' + won(cur.rec) + '원 승인 확인 (예시)', 'ok') : h.btn('VAN 매출 불러오기', { sm: true, act: 'HQ16.van', arg: cur.id, disabled: ro })) + '</div>'
      : cur && (cur.via === '현금' || cur.via === '계좌이체')
        ? (cur.via === '현금' ? '현금은 일일 마감 시재(CT-09)와 맞춰요.' : '계좌이체는 본사 통장 내역과 맞춰요.') + ' 10만 원 이상이면 현금영수증 발급을 확인해요 (법정, 세무사 확인 전).'
        : '단말기 카드는 VAN 매출과, 계좌이체는 통장과, 현금은 일일 마감 시재와 맞춰요. 결제선생 결제는 건별로, 통장 입금은 정산 묶음으로 맞춰요.';
    form += '<div style="margin-top:10px"' + P(5) + '>' + h.alert(rv, 'review', { title: '현장 수납', raw: true }) + '</div>';
    if (H.reconLog.length) form += '<div style="margin-top:10px"><div class="small" style="font-weight:700;color:var(--sub);margin-bottom:4px">처리 기록</div><div class="list">' +
      H.reconLog.slice(0, 5).map(x => '<div class="small"><b>' + esc(x.head) + '</b>' + h.chip(x.act, '') + '<span class="muted">' + esc(x.memo) + '</span><span class="muted" style="margin-left:auto">' + esc(x.by) + '</span></div>').join('') + '</div></div>';

    // ⑥ 정산 묶음과 수수료
    let settle;
    if (month === '2027-09') {
      const unexplained = H.settled ? 0 : 400000;
      settle = h.kv([
        ['결제선생 결제', '84,560,000원'],
        ['정산 대기', '260,000원 (목동센터 박*준)'],
        ['수수료', H.settled ? '400,000원 (정산 내역, 예시)' : '정산 내역을 받기 전'],
        ['정산 예정일', '정산 주기 확인 전 (미정)'],
        ['본사 계좌 입금', '83,900,000원'],
        ['설명 안 된 차이', '<b style="color:' + (unexplained ? 'var(--bad)' : 'var(--ok)') + '">' + won(unexplained) + '원</b>', true],
      ]) + '<div style="margin-top:10px">' + (H.settled
        ? h.alert('결제 금액과 입금 금액의 차이 660,000원을 정산 대기 260,000원과 수수료 400,000원으로 나눴어요. 박*준 건은 다음 정산 묶음에 들어와요.', 'ok')
        : h.alert('결제 84,560,000원과 입금 83,900,000원이 660,000원 달라요. 260,000원은 정산 대기예요. 나머지 400,000원이 수수료인지 오류인지는 정산 내역을 받아야 알 수 있어요.', 'warn')) + '</div>' +
        '<div class="row" style="margin-top:10px">' + h.btn(H.settled ? '정산 내역 반영 완료' : '정산 내역 올리기 (엑셀)', { act: 'HQ16.settle', disabled: ro || H.settled }) + small('API 연결 전에는 엑셀로 올려요') + '</div>';
    } else {
      const pg = all.filter(r => r.pg != null);
      settle = h.kv([['결제선생 결제', won(sum(pg, r => r.pg)) + '원 (' + pg.length + '건)'], ['정산', '아직 정산 전이에요'], ['수수료', '결제선생 계약 확인 전 (미정)']]) +
        '<div style="margin-top:10px">' + h.alert('결제선생 정산이 들어오면 묶음 단위로 통장 입금과 맞춰요. 정산 주기와 수수료율은 아직 받지 못했어요.', 'info') + '</div>';
    }
    html += '<div class="grid g2" style="margin-top:12px;align-items:start">' +
      card2({ pin: 4, title: '불일치 처리', sub: open.length ? '남은 ' + open.length + '건' : '', body: form }) +
      card2({ pin: 6, title: '결제선생 정산 묶음', chip: h.chip('검토 반영', 'review'), sub: '수수료를 뺀 금액이 묶음으로 들어와요', body: settle }) + '</div>';
    return html;
  }

  B.screen({
    id: 'HQ-16', side: 'hq', phase: 'P1b', devices: ['pc'], pages: [35, 36],
    title: '월 마감·청구', menuLabel: '월 마감·청구', crumb: '정산 > 월 마감·청구',
    tabs: [{ id: 'a', label: '청구서', phase: 'P1b' }, { id: 'b', label: '직영 수납 대사', phase: 'P1a' }],
    headActions: ctx => ctx.tab === 'b'
      ? sel('month', ctx.ui.month || '2027-09', [{ v: '2027-09', l: '2027년 9월' }, { v: '2027-03', l: '2027년 3월 (시범)' }], { w: 130 }) + h.btn('결제선생 내역 불러오기', { act: 'HQ16.loadPg', disabled: !ctx.canEdit }) + h.btn('엑셀', { act: 'HQ16.excel' })
      : sel('cmonth', '2027-09', [{ v: '2027-09', l: '2027년 9월' }], { w: 120 }) + h.btn('엑셀', { act: 'HQ16.excel' }),
    render(ctx) { return ctx.tab === 'b' ? reconTab(ctx) : closeTab(ctx); },
    mount(root, ctx) { bindRR(root, ctx); },
    prd: {
      summary: '본사가 매달 가맹 센터에 보낼 청구서를 만들고(청구서 탭), 직영 센터가 받은 학원비가 본사 통장에 제대로 들어왔는지 맞춰 보는(직영 수납 대사 탭) 화면이에요.',
      who: '본사 정산 담당과 슈퍼관리자가 처리해요. 운영 담당은 보기만 해요. 콘텐츠 담당과 SV에게는 메뉴가 안 보여요. 가맹 센터 원장은 같은 청구서를 CT-15에서 봐요.',
      items: [
        { n: 1, tab: 'a', t: '마감 단계', d: '매월 1일 0시에 돈을 매길 숫자를 사진 찍듯 저장해요. 그다음 대사, 청구서 초안, 센터 확인, 확정, 세금계산서, 입금 순서로 7단계를 밟아요. 지금 멈춘 단계가 진하게 보여요.', pol: ['POL-02'], ref: 'p.35 ①' },
        { n: 2, tab: 'a', t: '대사', d: '학습 계정이 켜진 학생 수와 원생 상태가 재원인 학생 수를 맞춰 봐요. 가맹 센터는 수납을 손으로 적어서, 시스템이 직접 켜고 끄는 계정 수를 돈을 매기는 근거로 써요. 안 맞는 학생은 센터에 확인을 요청해요.', pol: ['POL-02', 'POL-23'], ref: 'p.35 ②' },
        { n: 3, tab: 'a', t: '청구서 구성', d: '가맹 센터 청구서는 사용료, 알림톡 후불 요금, 교재 대금, 조정을 더해요. 직영 3곳은 본사 센터라 청구서를 만들지 않고 금액만 통계로 남겨요. 줄을 누르면 청구서 상세(HQ-17)로 가요.', pol: ['POL-01', 'POL-34'], ref: 'p.35 ③' },
        { n: 4, tab: 'a', t: '센터 확인과 이의', d: '청구서를 발행하면 센터가 CT-15에서 보고 3일(예시) 안에 이의를 신청할 수 있어요. 센터가 확인하면 확정 버튼이 열려요.', ref: 'p.35 ④' },
        { n: 5, tab: 'a', t: '세금계산서', d: '확정한 청구서는 외부 서비스로 전자세금계산서를 발행하고 처리 상태를 받아 와요. 어느 항목에 세금이 붙는지는 세무 확인이 남아 있어요.', ref: 'p.35 ⑤' },
        { n: 6, tab: 'a', t: '입금과 연체', d: '납부 기한(예시 15일)까지 입금을 확인해요. 기한이 지나면 연체 단계를 적용하는데, 단계마다 무엇을 할지는 아직 정하지 않았어요.', pol: ['POL-04', 'POL-05'], ref: 'p.35 ⑥' },
        { n: 7, tab: 'a', kind: 'review', imp: 'IMP-22', t: '금액에 영향이 있는 불일치만 막아요', d: '원문은 불일치가 하나라도 남으면 모든 센터의 확정을 막았어요. 9월 금액에 영향이 없는 건(달 중간 퇴원생 등)은 경고만 하고, 영향이 있는 건만 그 센터의 발행과 확정을 막아요. 센터마다 따로 진행해요.', pol: ['POL-02'] },
        { n: 8, tab: 'a', kind: 'review', imp: 'IMP-26', t: '같은 돈을 두 번 청구하지 않게 검사해요', d: '선불로 충전해 쓰는 센터에 알림톡 후불이 또 들어 있거나, 이미 입금된 교재 대금이 다시 실려 있으면 알려 줘요. 중복 줄 빼고 다시 계산을 누르면 겹친 줄을 빼고, 교재 줄을 9월에 출고한 주문 번호로 다시 묶어요. 주문 번호가 없는 교재 줄도 따로 알려 줘요.', pol: ['POL-34', 'POL-09'] },
        { n: 9, tab: 'a', kind: 'review', imp: ['IMP-27', 'IMP-26'], t: '이의 처리 기한과 확정 마감', d: '센터 이의는 접수일, 처리 상태, 본사 답변 기한을 함께 보여 줘요. 세금계산서는 다음 달 10일까지 발급해야 해요(법정, 세무사 확인 전). 그래서 확정 마감일(예시 9일)까지 못 끝낸 이의는 다음 달 조정으로 넘기고 청구서는 먼저 확정해요.' },
        { n: 1, tab: 'b', t: '대상', d: '결제선생과 연결한 직영 센터의 수납만 맞춰 봐요. 가맹 센터 수납은 여기서 보지 않아요. 위쪽 숫자는 센터 기록, 결제선생, 본사 통장 세 곳의 건수와 금액이에요.', pol: ['POL-36'], ref: 'p.36 ①' },
        { n: 2, tab: 'b', t: '3자 대사', d: '센터 수납 기록과 결제선생 결제와 본사 계좌 입금을 한 건씩 맞춰요. 결제선생 내역 불러오기로 결제 기록을 가져와요. 불일치만 버튼으로 안 맞는 건만 골라 볼 수 있어요.', ref: 'p.36 ②' },
        { n: 3, tab: 'b', t: '불일치 유형', d: '결제 누락, 입금 지연, 금액 불일치, 취소 미반영 네 가지로 나눠요. 금액 불일치는 할인을 다르게 넣었을 때처럼 생겨요.', ref: 'p.36 ③' },
        { n: 4, tab: 'b', t: '처리 기록', d: '줄을 골라 유형과 조치와 메모를 남기고 처리 완료를 눌러요. 환불(CT-10)은 취소 건으로 맞추고, 다 맞추면 결과를 직영 매출 보고에 넣어요.', ref: 'p.36 ④' },
        { n: 5, tab: 'b', kind: 'review', imp: 'IMP-13', t: '현장 수납은 수단별로 맞춰요', d: '단말기 카드, 계좌이체, 현금은 결제선생을 거치지 않아서 늘 결제 누락으로 떠요. 카드는 VAN 매출과, 계좌이체는 통장과, 현금은 일일 마감 시재와 맞추는 현장 수납 확인을 넣었어요. 이미 받은 건에 결제 재요청을 고르면 막고, 10만 원 이상 현금과 계좌이체는 현금영수증 번호를 받아요.', pol: ['POL-37'] },
        { n: 6, tab: 'b', kind: 'review', imp: 'IMP-13', t: '결제선생 정산은 묶음으로, 수수료까지 맞춰요', d: '결제선생은 여러 결제를 모아 수수료를 뺀 금액을 한 번에 넣어 줘요. 그래서 통장 입금은 정산 묶음 단위로 맞춰요. 정산 내역을 올리면 결제와 입금의 차이가 수수료인지 오류인지 나눠 보여요.', pol: ['POL-36'] },
      ],
      open: ['1인당 사용료 금액(POL-01)과 과금 기준(POL-02)', '알림톡을 선불로 할지 후불로 할지(POL-34)', '청구일, 납부 기한, 연체 단계(POL-04, POL-05)와 센터 확인 기간', '센터가 확인 기간 안에 답하지 않으면 자동으로 확정할지', '결제선생 정산 내역을 API로 받을지 엑셀로 올릴지, 수수료율과 정산 주기', '입금이 며칠 늦으면 입금 지연으로 볼지'],
      rules: ['청구와 입금 증빙은 5년 보관해요(POL-41, 법정).', '월합계 세금계산서는 다음 달 10일까지 발급해요(법정, 세무사 확인 전).', '현금과 계좌이체로 10만 원 이상 받으면 현금영수증 발급 대상이에요(법정, 세무사 확인 전).'],
    },
  });

  /* HQ-16 actions: 청구서 */
  B.action('HQ16.open', (ctx, id) => {
    const reg = ctx.s.ui['HQ-17'] = ctx.s.ui['HQ-17'] || {};
    reg.invoice = id || 'inv-daegu-09'; reg.adj = false;
    B.go('HQ-17'); return false;
  });
  B.action('HQ16.request', ctx => {
    if (deny(ctx)) return;
    const H = ctx.s.hq16; H.asked = true;
    H.mism.filter(m => !m.done).forEach(m => { m.state = '센터 답변 대기 (기한 10-03, 예시)'; });
    addLog(ctx.s, '대사 불일치 ' + H.mism.filter(m => !m.done).length + '건 센터에 확인 요청');
    say('센터에 확인을 요청했어요. 센터 대시보드 할 일에 올라가요.');
  });
  B.action('HQ16.resolve', (ctx, arg) => {
    if (deny(ctx)) return;
    const s = ctx.s, H = s.hq16;
    let id = arg, how = null;
    if (arg && typeof arg === 'object') { id = arg.id; how = arg.how; } else if (typeof arg === 'string' && arg.includes('|')) { [id, how] = arg.split('|'); }
    const m = H.mism.find(x => x.id === (id || (H.mism.find(y => !y.done) || {}).id));
    if (!m || m.done) return;
    how = how || (m.affects ? 'exclude' : 'stop');
    m.done = true; m.how = how;
    if (how === 'stop') m.note = '계정 정지, 10월부터 과금 제외';
    if (how === 'keep') m.note = '센터 확인 결과 재원, 과금 유지';
    if (how === 'exclude') {
      const inv = findInv(s, m.inv);
      if (inv) {
        const meta1 = meta(s, inv);
        meta1.accts = Math.max(0, meta1.accts - 1);
        const fee = (inv.lines || []).find(l => kindOf(l) === 'fee');
        if (fee) { fee.a = meta1.accts * meta1.unit; fee.t = '시스템 사용료 ' + meta1.accts + '명 × ' + won(meta1.unit) + '원' + (meta1.unitNote ? ' (' + meta1.unitNote + ')' : ''); }
        if (inv.status !== '초안') meta1.reissue = true;
        const rows = s.hq17.students[inv.id];
        if (rows) { const r = rows.find(x => x.n === m.student); if (r) Object.assign(r, { bill: '아니오', why: '휴원 일수 제외 (검토안)', a: 0 }); }
      }
      m.note = '휴원 계정 정지, 9월 과금에서 제외';
    }
    addLog(s, cname(s, m.center) + ' ' + m.student + ' ' + m.note);
    say(cname(s, m.center) + ' ' + m.student + ' 건을 처리했어요.' + (how === 'exclude' ? ' 청구 금액이 바뀌었어요.' : ''));
  });
  B.action('HQ16.fixRoute', ctx => {
    if (deny(ctx)) return;
    const s = ctx.s;
    monthInvs(s).forEach(inv => {
      let changed = false;
      const prepaid = s.alim && s.alim.balances && s.alim.balances[inv.center] != null;
      if (prepaid && part(inv, 'alim')) { inv.lines = inv.lines.filter(l => kindOf(l) !== 'alim'); changed = true; }
      const dup = (inv.lines || []).filter(l => kindOf(l) === 'book' && l.order && !String(l.order).startsWith('#'));
      if (dup.length) {
        inv.lines = inv.lines.filter(l => dup.indexOf(l) < 0);
        shippedOrders(s, inv.center).forEach(o => inv.lines.push({ t: '교재 대금 (주문 ' + o.id + ' ' + o.item + ')', a: o.amount, k: 'book', order: o.id }));
        changed = true;
      }
      if (changed && inv.status !== '초안') meta(s, inv).reissue = true;
    });
    s.hq16.routeFixed = true;
    addLog(s, '청구 경로 검사 반영, 중복 줄을 빼고 다시 계산');
    say('중복 줄을 빼고 다시 계산했어요. 청구 예정액이 바뀌었어요.');
  });
  B.action('HQ16.issue', (ctx, id) => {
    if (deny(ctx)) return;
    const s = ctx.s, inv = findInv(s, id || 'inv-daegu-09');
    if (!inv) return;
    if (inv.status !== '초안') { say('이미 발행한 청구서예요.'); return; }
    if (blockers(s, inv.center).length) { say(cname(s, inv.center) + '는 9월 금액에 영향을 주는 불일치가 남아 있어서 발행할 수 없어요.'); return; }
    inv.status = '확인 대기'; inv.issued = '2027-10-05';
    const m = meta(s, inv); m.confirmBy = '10-08'; m.reissue = false;
    addLog(s, cname(s, inv.center) + ' 9월 청구서 발행, 센터 확인 요청 (기한 10-08)');
    say(cname(s, inv.center) + ' 9월 청구서를 발행했어요. 센터는 CT-15에서 3일(예시) 안에 확인해요.');
  });
  B.action('HQ16.centerOk', (ctx, id) => {
    if (deny(ctx)) return;
    const s = ctx.s, inv = findInv(s, id || 'inv-busan-09');
    if (!inv) return;
    if (disputeOpen(s, inv)) { say('센터 이의가 남아 있어요. 조정하거나 다음 달로 넘겨 주세요.'); return; }
    if (inv.status !== '확인 대기' && inv.status !== '센터 확인 중') { say('센터 확인 단계가 아니에요.'); return; }
    inv.status = '확인 완료';
    addLog(s, cname(s, inv.center) + ' 센터 확인 완료');
    say(cname(s, inv.center) + '가 청구서를 확인했어요. 이제 확정할 수 있어요.');
  });
  B.action('HQ16.dispute', (ctx, arg) => {
    const s = ctx.s, o = arg && typeof arg === 'object' ? arg : { inv: arg };
    const inv = findInv(s, o.inv || 'inv-daegu-09');
    if (!inv) return;
    inv.dispute = { reason: o.reason || '이*호 학생은 9/18 퇴원했는데 9월 사용료가 붙었어요.', at: '10-07', due: '2027-10-09', status: '접수', by: cname(s, inv.center) };
    meta(s, inv).disputeDone = false;
    if (inv.status === '확인 완료') inv.status = '확인 대기';
    addLog(s, cname(s, inv.center) + ' 이의 신청 접수');
    say(cname(s, inv.center) + '가 이의를 신청했어요.');
  });
  B.action('HQ16.carry', (ctx, id) => {
    if (deny(ctx)) return;
    const s = ctx.s, inv = findInv(s, id || (monthInvs(s).find(i => disputeOpen(s, i)) || {}).id);
    if (!inv) return;
    if (blockers(s, inv.center).length) { say('9월 금액에 영향을 주는 대사 불일치가 남아 있어 확정할 수 없어요.'); return; }
    const m = meta(s, inv); m.disputeDone = true; m.carried = disputeText(inv.dispute);
    if (inv.dispute && typeof inv.dispute === 'object') inv.dispute.status = '처리 완료 (다음 달 조정)';
    inv.status = '확정'; m.confirmedAt = '10-09'; m.reissue = false;
    addLog(s, cname(s, inv.center) + ' 이의를 10월 조정으로 넘기고 확정 (10-09)');
    say('이의를 다음 달 조정으로 넘기고 확정했어요. 거래원장에 9월 청구서가 적혔어요.');
  });
  B.action('HQ16.confirm', (ctx, id) => {
    if (deny(ctx)) return;
    const s = ctx.s, inv = findInv(s, id || (monthInvs(s).find(i => i.status === '확인 완료') || {}).id);
    if (!inv) return;
    if (blockers(s, inv.center).length) { say(cname(s, inv.center) + '는 9월 금액에 영향을 주는 불일치가 남아 있어서 확정할 수 없어요.'); return; }
    if (disputeOpen(s, inv)) { say('센터 이의가 남아 있어요.'); return; }
    if (inv.status !== '확인 완료') { say('센터 확인을 먼저 받아야 해요.'); return; }
    const mt = meta(s, inv), resent = mt.reissue;
    inv.status = '확정'; mt.confirmedAt = '10-09'; mt.reissue = false;
    addLog(s, cname(s, inv.center) + ' 9월 청구서 확정' + (resent ? ', 바뀐 금액으로 재발송' : '') + ', 거래원장 기록');
    say(cname(s, inv.center) + ' 청구서를 ' + (resent ? '바뀐 금액으로 다시 보내고 ' : '') + '확정했어요. 거래원장(HQ-17)에 적혔어요.');
  });
  B.action('HQ16.tax', (ctx, id) => {
    if (deny(ctx)) return;
    const s = ctx.s, inv = findInv(s, id);
    if (!inv) return;
    if (!CONF.includes(inv.status)) { say('확정한 뒤에 발행해요.'); return; }
    meta(s, inv).tax = '발행 완료';
    addLog(s, cname(s, inv.center) + ' 전자세금계산서 발행');
    say(cname(s, inv.center) + ' 세금계산서를 외부 서비스로 발행했어요.');
  });
  B.action('HQ16.paid', (ctx, id) => {
    if (deny(ctx)) return;
    const s = ctx.s, inv = findInv(s, id);
    if (!inv) return;
    if (!CONF.includes(inv.status)) { say('확정한 청구서만 입금을 맞춰요.'); return; }
    if (inv.status === '입금 완료') return;
    inv.status = '입금 완료'; inv.paid = total(inv);
    const L = s.hq17.ledger[inv.center] = s.hq17.ledger[inv.center] || [];
    L.push({ d: '10-15', t: '입금', c: 0, p: inv.paid });
    addLog(s, cname(s, inv.center) + ' 입금 확인 ' + won(inv.paid) + '원');
    say(cname(s, inv.center) + ' 입금 ' + won(inv.paid) + '원을 확인했어요.');
  });
  B.action('HQ16.overdue', (ctx, id) => {
    if (deny(ctx)) return;
    const s = ctx.s, inv = findInv(s, id);
    if (!inv || inv.status !== '확정') { say('확정했지만 입금 전인 청구서에만 적용해요.'); return; }
    inv.status = '연체';
    addLog(s, cname(s, inv.center) + ' 연체 1단계 안내 (POL-05 미정)');
    say('연체 1단계를 적용했어요. 센터에 안내가 나가요. 단계 내용은 아직 미정이에요.');
  });
  B.action('HQ16.excel', () => { say('엑셀은 내려받는 이유를 남겨야 받을 수 있어요 (CM-03).'); return false; });

  /* HQ-16 actions: 직영 수납 대사 */
  B.action('HQ16.month', (ctx, v) => { ctx.ui.month = v === '2027-03' || v === '3월' ? '2027-03' : '2027-09'; ctx.ui.sel = null; ctx.ui.formFor = null; });
  B.action('HQ16.only', ctx => { ctx.ui.only = !ctx.ui.only; });
  B.action('HQ16.pick', (ctx, id) => { ctx.ui.sel = id; });
  B.action('HQ16.loadPg', ctx => {
    if (deny(ctx)) return;
    const m = ctx.ui.month || '2027-09'; ctx.s.hq16.pg[m] = true;
    const n = m === '2027-09' ? 312 : reconRows(ctx.s, m).filter(r => r.pg != null).length;
    say((m === '2027-09' ? '9월' : '3월') + ' 결제선생 결제 ' + n + '건을 불러왔어요.');
  });
  B.action('HQ16.van', (ctx, id) => {
    if (deny(ctx)) return;
    const H = ctx.s.hq16, rid = id || ctx.ui.sel || 'd2';
    H.rs[rid] = Object.assign(H.rs[rid] || {}, { van: true });
    ctx.ui.sel = rid; ctx.ui.f_err = null;
    say('VAN 매출 내역에서 같은 날 같은 금액 승인을 찾았어요 (예시).');
  });
  B.action('HQ16.fix', (ctx, arg, el) => {
    if (deny(ctx)) return;
    const s = ctx.s, H = s.hq16, ui = ctx.ui, month = ui.month || '2027-09';
    let rid = typeof arg === 'string' ? arg : null;
    if (arg && typeof arg === 'object') {
      rid = arg.row || ui.sel;
      ui.formFor = rid;
      if (arg.type) ui.f_type = arg.type; if (arg.act) ui.f_act = arg.act; if (arg.memo != null) ui.f_memo = arg.memo; if (arg.rcpt != null) ui.f_rcpt = arg.rcpt;
    } else if (el && document.querySelector('#app [data-field="f_memo"]')) {
      const box = document.querySelector('#app [data-field="f_memo"]'); ui.f_memo = box.value;
      const ck = document.querySelector('#app input[name="f_act"]:checked'); if (ck) ui.f_act = ck.value;
      const rc = document.querySelector('#app [data-field="f_rcpt"]'); if (rc) ui.f_rcpt = rc.value;
    }
    const all = reconRows(s, month);
    const r = all.find(x => x.id === (rid || ui.sel)) || all.find(isOpen);
    if (!r || !isOpen(r)) return;
    ui.sel = r.id;
    const act = ui.f_act || '메모만', memo = String(ui.f_memo || '').trim();
    let err = null;
    if (!memo) err = '메모를 남겨 주세요. 매출 보고에서 이유를 다시 봐요.';
    else if (act === '결제 재요청' && r.via !== '결제선생') err = '현장에서 이미 받은 수납이에요. 결제 재요청을 하면 학부모가 두 번 결제해요. 현장 수납 확인을 골라 주세요.';
    else if (act === '결제 재요청' && r.pg != null) err = '결제선생에 이미 결제가 있어요. 결제 재요청은 결제 기록이 없을 때만 써요.';
    else if (act === '현장 수납 확인' && r.via === '결제선생') err = '결제선생으로 받은 건이에요. 현장 수납 확인은 단말기, 계좌이체, 현금 수납에만 써요.';
    else if (act === '현장 수납 확인' && r.via === '단말기' && !r.van) err = 'VAN 매출 내역을 먼저 불러와 같은 금액이 있는지 맞춰 주세요.';
    else if (act === '현장 수납 확인' && (r.via === '현금' || r.via === '계좌이체') && Math.abs(r.rec) >= 100000 && r.receipt !== '발급' && !String(ui.f_rcpt || '').trim()) err = '10만 원 이상 현금, 계좌이체는 현금영수증 발급 대상이에요. 승인번호를 넣거나 센터에 발급을 요청해 주세요.';
    else if (act === '차액 환불 (CT-10)' && (r.pg == null || r.pg === r.rec)) err = '두 금액이 같거나 결제 기록이 없어요. 차액 환불은 금액이 다른 건에만 써요.';
    ui.f_err = err;
    if (err) return;
    H.rs[r.id] = Object.assign(H.rs[r.id] || {}, { done: { type: ui.f_type || r.result, act, memo, by: ctx.persona.name, rcpt: ui.f_rcpt || '' } });
    H.reconLog.unshift({ head: r.date + ' ' + cname(s, r.center) + ' ' + r.student, act, memo, by: ctx.persona.name });
    ui.formFor = null; ui.sel = null; ui.f_err = null;
    const diff = r.pg != null ? Math.abs(r.pg - r.rec) : 0;
    say(act === '차액 환불 (CT-10)' ? '차액 ' + won(diff) + '원 환불을 CT-10으로 넘겼어요.' : '처리했어요. 대사 결과에 남았어요.');
  });
  B.action('HQ16.settle', ctx => {
    if (deny(ctx)) return;
    const H = ctx.s.hq16; H.settled = true;
    H.rs.d3 = Object.assign(H.rs.d3 || {}, { auto: '정산 대기', bank: '다음 정산 묶음' });
    say('정산 내역을 올렸어요. 수수료와 정산 대기를 나눠 보여 줘요.');
  });
  B.action('HQ16.report', ctx => {
    if (deny(ctx)) return;
    const m = ctx.ui.month || '2027-09';
    if (reconRows(ctx.s, m).some(isOpen)) { say('남은 불일치를 먼저 처리해 주세요.'); return; }
    ctx.s.hq16.reported[m] = true;
    say((m === '2027-09' ? '9월' : '3월') + ' 직영 매출 보고에 대사 결과를 넣었어요.');
  });

  /* ---------------- HQ-17 거래원장·청구서 상세 ---------------- */
  function studentRows(s, inv) {
    if (s.hq17.students[inv.id]) return s.hq17.students[inv.id];
    if (inv.center === 'busan') {
      const m2 = s.hq16.mism.find(m => m.id === 'm2');
      const ex = m2 && m2.done && m2.how === 'exclude';
      return [{ n: '김*아', per: '계정 활성', ev: '휴원', bill: ex ? '아니오' : '예', why: ex ? '휴원 일수 제외 (검토안)' : '대사 확인 중', a: ex ? 0 : 18000 }, { n: '… 40명', a: 720000, rest: true }];
    }
    const m = meta(s, inv);
    return [{ n: '… ' + m.accts + '명', a: part(inv, 'fee'), rest: true }];
  }
  function ledgerRows(s, inv) {
    const rows = (s.hq17.ledger[inv.center] || []).map(x => Object.assign({}, x));
    const conf = CONF.includes(inv.status);
    rows.push({ d: String(inv.issued || '2027-10-05').slice(5), t: monthLabel(inv.month) + ' 청구서', c: total(inv), p: 0, pending: !conf, inv: true });
    rows.sort((a, b) => (a.d === '-' ? '' : a.d).localeCompare(b.d === '-' ? '' : b.d) || (a.inv ? -1 : 0));
    let bal = 0;
    rows.forEach(r => { if (r.pending) { r.bal = null; return; } bal += (Number(r.c) || 0) - (Number(r.p) || 0); r.bal = bal; });
    return rows;
  }
  const APPR = [{ v: '정산팀장', l: '정산팀장' }, { v: '정본부', l: '정본부 (슈퍼관리자)' }];
  function adjForm(ctx, inv) {
    const ui = ctx.ui, me = ctx.persona.name, s = ctx.s;
    const item = ui.f_item || '시스템 장애 보상';
    const dOpen = disputeOpen(s, inv);
    return card2({
      title: '조정 추가', sub: cname(s, inv.center) + ' ' + monthLabel(inv.month) + ' 청구서',
      right: h.btn('닫기', { sm: true, act: 'HQ17.adjClose' }),
      body: '<div class="grid g4">' +
        h.field({ label: '항목', type: 'select', value: item, options: ['시스템 장애 보상', '이의 반영', '오류 정정', '기타'], field: 'f_item', err: ui.f_err_item }) +
        h.field({ label: '금액', req: true, type: 'number', value: ui.f_amt || '', field: 'f_amt', ph: '-20000', hint: '빼 주는 금액은 마이너스로 넣어요', err: ui.f_err_amt }) +
        h.field({ label: '사유', req: true, value: ui.f_reason || '', field: 'f_reason', ph: '장애 일시, 이의 내용', err: ui.f_err_reason }) +
        h.field({ label: '승인자', type: 'select', value: ui.f_appr || '정산팀장', options: APPR, field: 'f_appr' }) +
        '</div><div class="grid g4" style="margin-top:10px">' +
        h.field({ label: '장애 시간 (시간)', type: 'number', value: ui.f_hours || '', field: 'f_hours', ph: '4', hint: '장애 보상이면 꼭 넣어요', err: ui.f_err_hours }) +
        '<div style="grid-column:span 3">' + (dOpen
          ? h.alert('센터 이의 ' + String(disputeText(inv.dispute)).replace(/[.\s]+$/, '') + '. 저장하면 이 이의를 조정으로 닫아요.', 'review')
          : '<div class="small muted" style="padding-top:24px">열린 센터 이의가 없어요.</div>') + '</div>' +
        '</div><div class="row" style="justify-content:space-between;margin-top:10px">' + small('입력 ' + me + '. 장애 보상 계산식은 아직 없어요 (미정).') + h.btn('조정 저장', { primary: true, act: 'HQ17.adjSave', disabled: !ctx.canEdit }) + '</div>',
    }) + '<div style="height:12px"></div>';
  }
  function adjNote(ctx, inv) {
    const s = ctx.s, d = inv.dispute;
    return '<div style="margin-top:8px;padding:9px 10px;border-radius:8px;background:var(--review-soft);color:#4a25a8;font-size:12.3px;line-height:1.6"' + P(6) + '>' +
      '장애 보상 계산식은 아직 없어요 (미정). 가동률 목표와 장애 시간별 보상식을 정하기 전까지는 장애 시간과 사유를 꼭 남기고 승인자가 확인해요.' +
      (disputeOpen(s, inv)
        ? '<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(74,37,168,.15);color:var(--ink)"><b>센터 이의</b> ' + esc(disputeText(d)) +
          '<div class="row" style="margin-top:4px"><span class="muted small">' + esc(disputeMeta(d)) + '</span>' +
          '<span style="margin-left:auto">' + h.btn('이의 반영 조정 넣기', { sm: true, act: 'HQ17.adjForm', arg: '이의 반영', disabled: !ctx.canEdit }) + '</span></div></div>'
        : '') + '</div>';
  }

  B.screen({
    id: 'HQ-17', side: 'hq', phase: 'P1b', devices: ['pc'], pages: [37],
    title: '센터 거래원장·청구서 상세', menuLabel: '청구서 상세', crumb: '정산 > 청구서 상세',
    headActions: ctx => {
      const inv = findInv(ctx.s, ctx.ui.invoice) || findInv(ctx.s, 'inv-daegu-09');
      const draft = !inv || inv.status === '초안';
      return h.btn('재발행', { act: 'HQ17.reissue', disabled: !ctx.canEdit || draft, title: draft ? '발행 전 초안이에요. HQ-16에서 먼저 발행해요' : '' }) + h.btn('조정 추가', { primary: true, act: 'HQ17.adjForm', disabled: !ctx.canEdit });
    },
    render(ctx) {
      const s = ctx.s, ui = ctx.ui;
      const inv = findInv(s, ui.invoice) || findInv(s, 'inv-daegu-09') || (s.invoices || [])[0];
      if (!inv) return h.empty('청구서가 없어요.');
      ui.invoice = inv.id;
      const m = meta(s, inv), fee = part(inv, 'fee'), adj = part(inv, 'adj'), alim = part(inv, 'alim'), book = part(inv, 'book'), tot = total(inv);
      let html = '<div class="row" style="margin-bottom:12px"><b style="font-size:15px">' + esc(cname(s, inv.center)) + ' 거래원장·청구서</b>' +
        '<span style="margin-left:auto"></span>' + h.opts((s.invoices || []).filter(i => ctype(s, i.center) !== '직영').map(i => ({ v: i.id, l: cname(s, i.center) + ' ' + monthLabel(i.month) })), inv.id, { act: 'HQ17.pick' }) + '</div>';
      if (ui.adj) html += adjForm(ctx, inv);

      const srows = studentRows(s, inv);
      const left = card2({
        pin: 1, title: '2027년 ' + monthLabel(inv.month) + ' 청구서', chip: invChip(s, inv),
        body: h.table({
          cols: [
            { label: '원생', render: r => r.rest ? '<span class="muted" style="white-space:nowrap">' + esc(r.n) + '</span>' : nw(r.n) }, { label: '계정 활성 기간', render: r => nw(r.per || '') }, { label: '등록·퇴원', render: r => nw(r.ev || '') }, { label: '과금', render: r => nw(r.bill || '') },
            { label: '사유', render: r => esc(r.why || '') }, { label: '금액', num: true, render: r => nw(won(r.a)) },
          ],
          rows: srows,
        }) + '<div class="small muted" style="margin-top:6px">원생 이름은 가려서 보여요. 센터도 CT-15에서 같은 내역을 봐요.</div>',
      }) + card2({
        pin: 2, title: '조정',
        body: h.table({
          cols: [{ label: '항목', render: l => esc(l.item || l.t) }, { label: '금액', num: true, render: l => won(l.a) },
            { label: '사유', render: l => esc((l.reason || '-') + (l.hours && !/시간/.test(l.reason || '') ? ' (장애 ' + l.hours + '시간)' : '')) }, { label: '승인', render: l => esc(l.by || '-') + (l.input ? ' ' + small('입력 ' + l.input) : '') }],
          rows: (inv.lines || []).filter(l => kindOf(l) === 'adj'), empty: '이번 달 조정이 없어요.',
        }) + adjNote(ctx, inv),
      });
      const vat = ui.vat || '미정';
      const taxable = vat === '전부 과세' ? tot : vat === '교재 면세' ? tot - book : 0;
      const vatAmt = Math.round(taxable * 0.1);
      const line = (a, b, strong) => '<div class="row between" style="padding:3px 0' + (strong ? ';border-top:1px solid var(--line);margin-top:4px;padding-top:7px;font-weight:800;font-size:14px' : '') + '"><span>' + a + '</span><span class="money">' + b + '</span></div>';
      const totals = '<section class="card">' +
        line('사용료 ' + m.accts + '명 × ' + won(m.unit) + (m.unitNote ? ' (' + esc(m.unitNote) + ', 예시)' : ' (예시)'), won(fee)) +
        line('조정', adj ? won(adj) : '-') + (alim ? line('알림톡', won(alim)) : '') +
        line('교재 대금' + ((inv.lines || []).filter(l => kindOf(l) === 'book' && String(l.order || '').startsWith('#')).map(l => ' ' + l.order).join('')), book ? won(book) : '-') +
        line('합계 (부가세 별도, 예시)', won(tot), true) +
        '<div style="margin-top:10px;padding:10px;border-radius:8px;background:var(--review-soft)"' + P(7) + '><div class="row" style="margin-bottom:6px"><b class="small" style="color:#4a25a8">부가세를 더한 납부 금액</b>' +
        h.opts([{ v: '미정', l: '세무 확인 전' }, { v: '전부 과세', l: '전부 과세 (예시)' }, { v: '교재 면세', l: '교재 면세 (예시)' }], vat, { act: 'HQ17.vat' }) + '</div>' +
        (vat === '교재 면세' ? line('과세 공급가액', won(tot - book)) + line('면세 (교재)', won(book)) : line('공급가액', won(tot))) +
        line('부가세', vat === '미정' ? '세무 확인 전' : won(vatAmt)) + line('납부할 금액', vat === '미정' ? '세무 확인 후 정해요' : won(tot + vatAmt), true) + '</div></section>';

      const lrows = ledgerRows(s, inv);
      const right = card2({
        pin: 3, title: '세금계산서',
        body: h.kv([
          ['상태', h.chip(m.tax, m.tax === '발행 완료' ? 'ok' : ''), true],
          ['과세 구분', '세무 확인 ' + h.chip('미정', 'st-미정'), true],
          ['수정 발행', m.taxFix ? h.btn('수정세금계산서 발행', { sm: true, act: 'HQ17.taxFix', disabled: !ctx.canEdit }) : muted(m.taxFixed ? '수정세금계산서 발행 완료' : '확정 후 조정 시 수정세금계산서'), true],
        ]),
      }) + card2({
        pin: 4, title: '거래원장',
        body: h.table({
          cols: [{ label: '일자', render: r => nw(r.d) }, { label: '구분', render: r => r.pending ? muted(r.t + ' (확정 전)') : esc(r.t) },
            { label: '청구', num: true, render: r => r.c ? (r.pending ? '<span class="muted" style="white-space:nowrap">' + won(r.c) + '</span>' : nw(won(r.c))) : '' }, { label: '입금', num: true, render: r => r.p ? nw(won(r.p)) : '' },
            { label: '잔액', num: true, render: r => r.bal == null ? muted('-') : nw(won(r.bal)) }],
          rows: lrows,
        }) + '<div class="small muted" style="margin-top:6px">가맹금, 사용료, 알림톡 충전, 교재, 조정, 입금을 모두 적어요. 잔액이 남으면 미수, 마이너스면 선수예요.</div>' +
          note(CONF.includes(inv.status) ? '확정한 ' + monthLabel(inv.month) + ' 청구서를 원장에 적었어요.' : monthLabel(inv.month) + ' 청구서는 확정 전이라 원장에 아직 안 적었어요. 확정하는 날 적혀요.', 8, { style: 'margin-top:8px;padding:7px 9px;border-radius:7px;background:var(--review-soft);color:#4a25a8' }),
      }) + card2({
        pin: 5, title: '보관', chip: h.polChip('POL-41'),
        body: '<div class="small">청구와 입금 증빙은 5년 보관해요 ' + h.chip('법정', 'st-법정') + '</div>',
      });
      html += '<div class="grid" style="align-items:start;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)"><div class="stack">' + left + totals + '</div><div class="stack">' + right + '</div></div>';
      return html;
    },
    prd: {
      summary: '가맹 센터 한 곳의 한 달 청구서를 학생 한 명 단위로 풀어 보고, 본사와 그 센터가 주고받은 돈을 장부 한 장으로 보는 화면이에요.',
      who: '본사 정산 담당과 슈퍼관리자가 보고 조정해요. 운영 담당은 보기만 해요. 콘텐츠 담당과 SV에게는 메뉴가 안 보여요. 가맹 센터 원장은 CT-15에서 같은 내용을 봐요.',
      items: [
        { n: 1, t: '학생별 과금 근거', d: '학습 계정이 켜진 기간과 등록일, 퇴원일로 돈을 매겼는지와 그 이유를 보여 줘요. 달 중간에 들어와도 한 달 치를 받고, 나가도 돌려주지 않는 안이 사유에 적혀요. 학생 이름은 가려서 보여요.', pol: ['POL-02', 'POL-03', 'POL-42'], ref: 'p.37 ①' },
        { n: 2, t: '조정', d: '장애 보상이나 오류 정정처럼 금액을 고칠 때는 이유와 승인한 사람을 남겨요. 오른쪽 위 조정 추가로 넣어요.', ref: 'p.37 ②' },
        { n: 3, t: '세금계산서', d: '청구서를 확정한 뒤 발행해요. 확정한 다음 금액이 바뀌면 수정세금계산서를 발행해요.', ref: 'p.37 ③' },
        { n: 4, t: '거래원장', d: '가맹금, 사용료, 알림톡 충전, 교재, 조정, 입금을 한 장에 모아요. 줄마다 남은 돈이 얼마인지 잔액으로 보여요.', pol: ['POL-06', 'POL-09', 'POL-34'], ref: 'p.37 ④' },
        { n: 5, t: '보관', d: '청구와 입금 증빙은 법에 따라 5년 동안 보관해요. 누구도 기간을 줄일 수 없어요.', pol: ['POL-41'], ref: 'p.37 ⑤' },
        { n: 6, kind: 'review', imp: 'IMP-27', t: '장애 보상과 이의는 근거를 남겨 조정해요', d: '장애 보상을 얼마 해 줄지 기준이 없어서 담당자 마음대로 정할 수 있었어요. 가동률 목표와 장애 시간별 보상식이 정해지기 전까지는 장애 시간을 꼭 넣어야 저장돼요. 센터 이의는 접수일과 답변 기한을 보여 주고, 이의 반영 조정으로 닫아요.' },
        { n: 7, kind: 'review', imp: 'IMP-23', t: '부가세를 더한 납부 금액', d: '원문 합계는 부가세 별도라서 센터가 실제로 낼 돈이 보이지 않았어요. 과세 구분을 고르면 공급가액, 부가세, 납부할 금액을 나눠 보여 줘요. 어느 항목에 세금이 붙는지는 세무 확인 전이에요.' },
        { n: 8, kind: 'review', imp: 'IMP-26', t: '확정한 청구서만 원장에 적어요', d: '확인 기간 중인 청구서를 원장에 먼저 적으면 조정할 때 원장과 세금계산서를 다 고쳐야 해요. 그래서 확정한 날 원장에 적고, 그 전에는 흐리게 예정으로만 보여 줘요.' },
      ],
      open: ['학생 1인당 사용료 금액(POL-01). 지금 보이는 20,000원은 예시예요', '달 중간에 등록하거나 퇴원한 학생의 사용료(POL-03, 안)', '달 중간에 휴원하거나 돌아온 학생의 사용료', '사용료와 교재 대금에 부가세가 붙는지', '장애 시간별 보상 금액 기준'],
      rules: ['청구와 입금 증빙은 5년 보관해요(POL-41, 법정).'],
    },
  });

  B.action('HQ17.pick', (ctx, id) => { ctx.ui.invoice = id; ctx.ui.adj = false; });
  B.action('HQ17.vat', (ctx, v) => { ctx.ui.vat = v; });
  B.action('HQ17.adjForm', (ctx, item) => { ctx.ui.adj = true; if (typeof item === 'string' && item) ctx.ui.f_item = item; ['f_err_amt', 'f_err_reason', 'f_err_hours', 'f_err_item'].forEach(k => { ctx.ui[k] = null; }); });
  B.action('HQ17.adjClose', ctx => { ctx.ui.adj = false; });
  B.action('HQ17.adjSave', (ctx, arg, el) => {
    if (deny(ctx)) return;
    const s = ctx.s, ui = ctx.ui;
    if (arg && typeof arg === 'object') { if (arg.invoice) ui.invoice = arg.invoice; if (arg.item) ui.f_item = arg.item; if (arg.amount != null) ui.f_amt = String(arg.amount); if (arg.reason != null) ui.f_reason = arg.reason; if (arg.hours != null) ui.f_hours = String(arg.hours); if (arg.approver) ui.f_appr = arg.approver; }
    else if (el) h.readFields(ui);
    const inv = findInv(s, ui.invoice || 'inv-daegu-09'); if (!inv) return;
    const me = ctx.persona.name, appr = APPR.find(x => x.v === ui.f_appr) || APPR[0];
    const item = ui.f_item || '시스템 장애 보상';
    const amt = Number(String(ui.f_amt || '').replace(/[^\d-]/g, ''));
    const hours = Number(String(ui.f_hours || '').replace(/[^\d.]/g, ''));
    ui.f_err_amt = !amt ? '금액을 숫자로 넣어 주세요. 빼 주는 금액은 마이너스예요.' : null;
    ui.f_err_reason = !String(ui.f_reason || '').trim() ? '사유를 넣어 주세요. 센터도 CT-15에서 같은 사유를 봐요.' : null;
    ui.f_err_hours = item === '시스템 장애 보상' && !(hours > 0) ? '장애 시간을 넣어 주세요. 보상 계산식이 정해지면 이 시간으로 금액을 계산해요.' : null;
    ui.f_err_item = item === '이의 반영' && !disputeOpen(s, inv) ? '열린 센터 이의가 없어요. 다른 항목을 골라 주세요.' : null;
    ui.adj = true;
    if (ui.f_err_amt || ui.f_err_reason || ui.f_err_hours || ui.f_err_item) return;
    inv.lines.push({ t: item, a: amt, k: 'adj', item, reason: ui.f_reason, hours: hours || null, by: appr.l, input: me });
    const m = meta(s, inv);
    if (m.tax === '발행 완료') m.taxFix = true;
    else if (inv.status !== '초안') m.reissue = true;
    if (disputeOpen(s, inv)) { m.disputeDone = true; if (typeof inv.dispute === 'object') inv.dispute.status = '조정 반영'; }
    addLog(s, cname(s, inv.center) + ' 조정 ' + won(amt) + '원 (' + ui.f_reason + ')');
    ui.adj = false; ui.f_amt = ''; ui.f_reason = ''; ui.f_hours = '';
    say('조정을 넣었어요. ' + (m.taxFix ? '확정 뒤 조정이라 수정세금계산서를 발행해요.' : m.reissue ? '센터에 다시 보내려면 재발행을 눌러 주세요.' : '합계에 바로 반영됐어요.'));
  });
  B.action('HQ17.reissue', ctx => {
    if (deny(ctx)) return;
    const s = ctx.s, inv = findInv(s, ctx.ui.invoice || 'inv-daegu-09'); if (!inv) return;
    if (inv.status === '초안') { say('아직 발행 전이에요. HQ-16에서 먼저 발행해요.'); return; }
    const m = meta(s, inv); m.reissue = false;
    addLog(s, cname(s, inv.center) + ' 청구서 재발행 ' + won(total(inv)) + '원');
    say('청구서를 다시 보냈어요. 센터 CT-15에 새 금액 ' + won(total(inv)) + '원이 보여요.');
  });
  B.action('HQ17.taxFix', ctx => {
    if (deny(ctx)) return;
    const s = ctx.s, inv = findInv(s, ctx.ui.invoice || 'inv-daegu-09'); if (!inv) return;
    const m = meta(s, inv); m.taxFix = false; m.taxFixed = true;
    say('수정세금계산서를 발행했어요.');
  });

  /* ---------------- HQ-18 알림톡 관리 ---------------- */
  const LOCK = { T01: 'CT-12 입실 알림', T02: 'CT-12 퇴실 알림', T03: 'CT-07 수강료 안내', T04: 'CT-08 미수 안내', T05: 'CT-08 재등록 안내', T06: 'CT-03 결과지 알림톡 링크' };
  const SAMPLE = { '학생명': '김*수', '시각': '15:02', '금액': '260,000', '링크': 'pay.brain180.example/a1', '월': '11월', '기한': '11-05' };
  const fill = t => String(t || '').replace(/#\{([^}]+)\}/g, (m, k) => SAMPLE[k] || m);
  const tplChip = st => h.chip(st, st === '승인' ? 'ok' : st === '반려' ? 'bad' : 'warn');
  function tplTab(ctx) {
    const s = ctx.s, ui = ctx.ui, H = s.hq18, ro = !ctx.canEdit, T = s.alim.templates || [];
    const t = T.find(x => x.id === ui.sel) || T[0] || {};
    const pc = ui.pc || 'daechi1';
    let html = '';
    if (ui.form) {
      html += card2({
        title: '템플릿 등록', sub: '저장하면 카카오 심사를 요청해요', right: h.btn('닫기', { sm: true, act: 'HQ18.closeForm' }),
        body: '<div class="grid g3">' + h.field({ label: '이름', req: true, value: ui.f_name || '', field: 'f_name', ph: '예) 보강 일정 안내', err: ui.f_err_name }) +
          h.field({ label: '구분', type: 'select', value: '정보성', options: [{ v: '정보성', l: '정보성' }, { v: '광고성', l: '광고성 (다루지 않아요)' }], field: 'f_kind', disabled: true }) +
          h.field({ label: '변수', value: ui.f_vars || '', field: 'f_vars', ph: '학생명·시각' }) + '</div>' +
          '<div style="margin-top:10px">' + h.field({ label: '본문', req: true, type: 'textarea', value: ui.f_body || '', field: 'f_body', ph: '#{학생명} 학생의 보강은 #{시각}이에요.', err: ui.f_err_body }) + '</div>' +
          '<div class="row" style="justify-content:flex-end;margin-top:10px">' + h.btn('카카오 심사 요청', { primary: true, act: 'HQ18.save', disabled: ro }) + '</div>',
      }) + '<div style="height:12px"></div>';
    }
    const table = tbl({
      pin: 1,
      cols: [{ label: '코드', k: 'id' }, { label: '이름', k: 'name' }, { label: '구분', render: r => esc(r.kind || '정보성') }, { label: '카카오 심사', render: r => tplChip(r.status) },
        { label: '변수', render: r => esc(H.vars[r.id] || (String(r.text || '').match(/#\{([^}]+)\}/g) || []).map(x => x.slice(2, -1)).join('·') || '-') }, { label: '사용 센터', render: r => esc(String(H.used[r.id] != null ? H.used[r.id] : '-')) }],
      rows: T,
      rowAttr: r => ' class="click' + (r.id === t.id ? ' sel' : '') + '" data-act="HQ18.pick" data-arg="' + r.id + '"',
    });
    const pending = T.filter(x => x.status !== '승인');
    const lockCard = card2({
      pin: 7, title: '심사 전 템플릿에 묶인 기능', chip: h.chip('검토 반영', 'review'),
      body: (pending.length ? '<div class="list">' + pending.map(x => '<div><b style="white-space:nowrap">' + esc(x.id + ' ' + x.name) + '</b>' + tplChip(x.status) +
        '<span class="small muted">' + esc(LOCK[x.id] ? LOCK[x.id] + ' 기능이 잠겨 있어요' : '연결된 기능이 없어요') + (x.status === '반려' && H.reason[x.id] ? '. 반려 사유 ' + H.reason[x.id] : '') + '</span>' +
        '<span style="margin-left:auto">' + (x.status === '반려' ? h.btn('고쳐서 재심사', { sm: true, act: 'HQ18.resubmit', arg: x.id, disabled: ro }) : h.btn('심사 결과 받기', { sm: true, act: 'HQ18.review', arg: x.id, disabled: ro })) + '</span></div>').join('') + '</div>'
        : h.alert('모든 템플릿이 승인됐어요. 센터 기능이 모두 열렸어요.', 'ok')) +
        '<div class="small" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--line-2)"><b>발신 프로필</b> 센터 이름으로 보내면 센터마다 채널 등록과 심사가 따로 필요할 수 있어요. 본사 채널 하나에 센터 이름을 넣는 방식이 되는지 대행사에 확인하기 전이에요 ' + h.chip('미정', 'st-미정') + '</div>',
    });
    const bubble = (head, body, sub) => '<div style="background:#fff;border-radius:12px;padding:10px 12px;font-size:12.3px;line-height:1.55;box-shadow:0 1px 2px rgba(0,0,0,.06)"><b>[브레인180 ' + esc(cname(s, pc)) + ']</b><br>' + esc(body) + (sub ? '<div class="muted small" style="margin-top:4px">' + esc(sub) + '</div>' : '') + '</div>';
    const preview = '<section class="card" style="border-radius:20px;background:#f1f2f4;border:2px solid #d5d9e0"' + P(3) + '><div class="row between" style="margin-bottom:10px"><b class="small" style="color:var(--sub)">미리보기 ' + esc(t.id || '') + '</b>' +
      sel('pc', pc, (s.centers || []).filter(c => c.status === '운영').map(c => ({ v: c.id, l: c.name })), { w: 120 }) + '</div><div class="stack" style="gap:8px">' +
      bubble('', t.text || '', '') + bubble('', fill(t.text), '실제 값으로 바꾼 모습 (예시 값)') + '</div><div class="small muted" style="margin-top:8px">보내는 이름은 센터 이름으로 나와요.</div></section>';
    html += '<div class="grid g-side" style="align-items:start"><div class="stack">' + table +
      note('정보성 메시지만 등록해요. 입실과 퇴실, 수강료와 미납, 재등록, 결과지 링크처럼 꼭 알릴 내용이에요. 할인이나 이벤트 같은 광고성은 다루지 않아요.' + h.polChip('POL-35'), 2, { style: 'padding:2px 2px 2px 20px' }) +
      lockCard + '</div>' + preview + '</div>';
    return html;
  }
  function balTab(ctx) {
    const s = ctx.s, H = s.hq18, ro = !ctx.canEdit, A = s.alim;
    const th = H.th;
    const rows = ['busan', 'daegu'].map(c => {
      const tp = (A.topups || []).find(x => x.center === c && x.status === '입금 대기');
      const bal = A.balances[c] || 0, use = H.usage[c] || 0;
      const low = th != null ? bal < th : bal < use;
      return { c, bal, use, tp, low };
    });
    const table = tbl({
      pin: 4,
      cols: [
        { label: '센터', render: r => r.c === 'direct' ? muted('직영 3곳') : esc(cname(s, r.c)) },
        { label: '잔액', num: true, render: r => r.c === 'direct' ? muted('-') : won(r.bal) },
        { label: '이번 달 사용', num: true, render: r => won(r.use) },
        { label: '충전 요청', render: r => r.tp ? won(r.tp.amount) + ' ' + small('(입금 대기)') : '-' },
        { label: '상태', render: r => r.c === 'direct' ? h.chip('내부', '') : r.low ? h.chip('부족', 'bad') : h.chip('정상', 'ok') },
        { label: '처리', render: r => r.tp ? h.btn('입금 확인하고 충전', { sm: true, act: 'HQ18.topup', arg: r.c, disabled: ro }) : '' },
      ],
      rows: rows.concat([{ c: 'direct', use: H.usage.direct }]),
    });
    const rv = card2({
      pin: 8, title: '잔액 경고 기준과 안전 알림', chip: h.chip('검토 반영', 'review'),
      body: '<div class="row" style="align-items:flex-end">' + h.field({ label: '부족 경고 기준 (원)', value: th != null ? th : '', field: 'f_th', ph: '기준 미정', type: 'number' }) +
        h.btn('기준 적용', { act: 'HQ18.threshold', disabled: ro }) + small(th != null ? '잔액이 ' + won(th) + '원보다 적으면 부족이에요.' : '기준이 정책에 없어요. 지금은 이번 달 사용액보다 적으면 부족으로 보여요 (예시).') + '</div>' +
        '<div class="small muted" style="margin-top:6px">검토안은 POL-34에 기준을 두고, 최근 7일 평균 사용량으로 며칠분이 남았는지 계산해 경고하는 방식이에요.</div>' +
        '<div class="list" style="margin-top:8px">' + ['busan', 'daegu'].map(c => '<div>' + h.toggle(!!H.grace[c], { act: 'HQ18.grace', arg: c, title: '안전 알림 유예' }) + '<span class="small"><b>' + esc(cname(s, c)) + '</b> 충전금이 0원이어도 입실, 퇴실, 미납처럼 꼭 보낼 안내는 정해진 한도(미정)까지 보내고 비용은 다음 청구서에 붙여요</span></div>').join('') + '</div>',
    });
    return h.kpis([
      { l: '가맹 충전 잔액 합계', v: won(sum(['busan', 'daegu'], c => A.balances[c] || 0)) + '원', s: '선불 충전 (안)' },
      { l: '이번 달 사용', v: won(H.usage.busan + H.usage.daegu + H.usage.direct) + '원', s: '직영 61,200원은 내부 비용' },
      { l: '입금 대기 충전', v: (A.topups || []).filter(x => x.status === '입금 대기').length + '건', s: '본사 입금 확인 후 충전' },
      { l: '알림톡 단가', v: '7원', s: '(안) POL-34' },
    ], 4) + '<div style="height:12px"></div>' + table +
      note('계약이 끝나면 남은 잔액을 돌려줘요 (HQ-26).' + h.polChip('POL-34') + h.btn('해지 정산 보기', { sm: true, go: 'HQ-26' }), 6, { style: 'margin:10px 2px 12px' }) + rv;
  }
  function statTab(ctx) {
    const s = ctx.s, H = s.hq18, ro = !ctx.canEdit, L = s.alim.log || [];
    const tname = id => { const t = (s.alim.templates || []).find(x => x.id === id); return t ? id + ' ' + t.name : (id || '-'); };
    const fails = L.map((r, i) => Object.assign({ i }, r)).filter(r => Number(r.fail) > 0);
    return h.kpis([
      { l: '이번 달 발송', v: won(sum(L, r => Number(r.n) || 0)) + '건' }, { l: '성공', v: won(sum(L, r => Number(r.ok) || 0)) + '건', tone: 'ok' },
      { l: '실패', v: won(sum(L, r => Number(r.fail) || 0)) + '건', tone: fails.length ? 'warn' : '' }, { l: '비용', v: won(sum(L, r => Number(r.cost) || 0)) + '원', s: '성공한 건만 7원 (안)' },
    ], 4) + '<div style="height:12px"></div>' + h.table({
      cols: [{ label: '일시', render: r => esc(r.at || '-') }, { label: '센터', render: r => esc(cname(s, r.center)) }, { label: '템플릿', render: r => esc(tname(r.tpl)) },
        { label: '건수', num: true, render: r => won(r.n) }, { label: '성공', num: true, render: r => won(r.ok) }, { label: '실패', num: true, render: r => Number(r.fail) ? '<b style="color:var(--bad)">' + won(r.fail) + '</b>' : '0' }, { label: '비용', num: true, render: r => won(r.cost) }],
      rows: L, empty: '아직 발송 기록이 없어요.',
    }) + '<div style="height:12px"></div>' + card2({
      pin: 5, title: '발송 실패',
      body: (fails.length ? '<div class="list">' + fails.map(r => '<div><b>' + esc(cname(s, r.center)) + '</b><span class="small">' + esc(tname(r.tpl) + ' 실패 ' + r.fail + '건, 사유 ' + (r.reason || '확인 중')) + '</span>' +
        h.chip('대체 문자 미발송', '') + '<span style="margin-left:auto">' + (H.asked[r.i] ? h.chip('번호 확인 요청 완료', 'info') : h.btn('센터에 번호 확인 요청', { sm: true, act: 'HQ18.askFix', arg: String(r.i), disabled: ro })) + '</span></div>').join('') + '</div>'
        : h.empty('실패한 발송이 없어요.')) + '<div class="small muted" style="margin-top:8px">대체 문자를 보낼지는 비용 정책을 따라요. 정책이 아직 없어 보내지 않아요.</div>',
    });
  }

  B.screen({
    id: 'HQ-18', side: 'hq', phase: 'P1a', devices: ['pc'], pages: [38],
    title: '알림톡 관리', menuLabel: '알림톡', crumb: '알림톡',
    tabs: [{ id: 'tpl', label: '템플릿' }, { id: 'bal', label: '센터별 잔액·충전' }, { id: 'stat', label: '발송 통계' }],
    headActions: ctx => h.btn('+ 템플릿 등록', { primary: true, act: 'HQ18.newForm', disabled: !ctx.canEdit }),
    render(ctx) { return ctx.tab === 'bal' ? balTab(ctx) : ctx.tab === 'stat' ? statTab(ctx) : tplTab(ctx); },
    mount(root, ctx) { bindRR(root, ctx); },
    prd: {
      summary: '학부모에게 가는 카카오 알림톡 문구 틀(템플릿)을 본사가 만들어 심사받고, 센터별 충전금과 발송 결과를 관리하는 화면이에요.',
      who: '본사 운영 담당과 슈퍼관리자가 템플릿과 충전을 관리해요. 정산 담당은 보기만 해요. 콘텐츠 담당과 SV에게는 메뉴가 안 보여요. 센터는 CT-14에서 승인된 템플릿을 골라 보내고 충전을 요청해요.',
      items: [
        { n: 1, tab: 'tpl', t: '템플릿은 본사가 만들어요', d: '본사가 템플릿을 만들고 카카오 심사를 받아요. 센터는 승인된 템플릿을 고르기만 해요. 오른쪽 위 템플릿 등록을 누르면 심사 요청까지 이어져요.', pol: ['POL-35'], ref: 'p.38 ①' },
        { n: 2, tab: 'tpl', t: '정보성만 등록해요', d: '입실과 퇴실 알림, 수강료 안내, 미납 안내, 재등록 안내, 결과지 링크처럼 꼭 알려야 하는 정보만 등록해요. 할인이나 이벤트 같은 광고 문구가 들어가면 등록을 막아요.', pol: ['POL-35'], ref: 'p.38 ②' },
        { n: 3, tab: 'tpl', t: '미리보기', d: '변수를 실제 값으로 바꿔 보여 줘요. 보내는 이름은 센터 이름으로 나와요. 목록에서 템플릿을 고르고 센터를 바꿔 볼 수 있어요.', ref: 'p.38 ③' },
        { n: 7, tab: 'tpl', kind: 'review', imp: 'IMP-06', t: '심사 전 템플릿에 묶인 기능은 잠가요', d: '미납 안내는 심사 중이고 결과지 링크는 반려됐는데, 센터 화면(CT-08, CT-03, CT-14)에는 이 알림을 보내는 기능이 그려져 있어요. 승인 전 템플릿에 묶인 센터 기능은 잠그고, 반려되면 사유를 보여 주고 고쳐서 다시 심사에 올려요. 센터 이름으로 보낼 발신 프로필 방식도 대행사 확인 전이라 함께 보여 줘요.' },
        { n: 4, tab: 'bal', t: '잔액과 충전', d: '가맹 센터는 미리 충전해 두고 써요(안). 본사가 입금을 확인하면 충전되고, 잔액이 모자라면 부족으로 보여요. 직영은 본사 내부 비용으로 모아요.', pol: ['POL-34'], ref: 'p.38 ④' },
        { n: 6, tab: 'bal', t: '해지하면 잔액을 돌려줘요', d: '계약이 끝나면 남은 충전금을 돌려줘요. 해지 정산은 HQ-26에서 해요.', pol: ['POL-34'], ref: 'p.38 ⑥' },
        { n: 8, tab: 'bal', kind: 'review', imp: 'IMP-26', t: '잔액 경고 기준과 안전 알림', d: '부족 경고를 띄울 기준 금액이 정책에 없었어요. 기준 금액을 넣으면 상태가 바로 바뀌어요. 충전금이 0원이어도 입실, 퇴실, 미납처럼 꼭 보낼 안내는 정해진 한도까지 보내고 비용은 다음 청구서에 붙이는 설정을 센터마다 켤 수 있어요.', pol: ['POL-34'] },
        { n: 5, tab: 'stat', t: '발송 실패', d: '실패한 건은 이유와 함께 남겨요. 대신 문자를 보낼지는 비용 정책을 따르는데, 아직 정책이 없어 보내지 않아요. 번호 오류는 센터에 고쳐 달라고 요청해요.', ref: 'p.38 ⑤' },
      ],
      open: ['알림톡 단가와 선불, 후불 방식(POL-34)', '잔액 부족 경고 기준 금액', '실패했을 때 대체 문자를 보낼지와 그 비용을 누가 낼지', '센터마다 발신 프로필을 따로 심사받을지, 본사 채널 하나로 보낼지'],
    },
  });

  B.action('HQ18.pick', (ctx, id) => { ctx.ui.sel = id; });
  B.action('HQ18.center', (ctx, id) => { ctx.ui.pc = id; });
  B.action('HQ18.newForm', ctx => { ctx.ui.form = true; B.state.tab = 'tpl'; });
  B.action('HQ18.closeForm', ctx => { ctx.ui.form = false; });
  B.action('HQ18.save', (ctx, arg, el) => {
    if (deny(ctx)) return;
    const s = ctx.s, ui = ctx.ui;
    if (arg && typeof arg === 'object') { ['name', 'body', 'vars'].forEach(k => { if (arg[k] != null) ui['f_' + k] = arg[k]; }); }
    else if (el) h.readFields(ui);
    ui.form = true;
    const name = String(ui.f_name || '').trim(), body = String(ui.f_body || '').trim();
    ui.f_err_name = name ? null : '이름을 넣어 주세요.';
    ui.f_err_body = !body ? '본문을 넣어 주세요.' : /할인|이벤트|프로모션|무료|특가|혜택|증정/.test(body) ? '광고성 문구가 들어 있어요. 알림톡에는 정보성 메시지만 등록해요.' : null;
    if (ui.f_err_name || ui.f_err_body) return;
    const T = s.alim.templates;
    const id = 'T' + String(T.length + 1).padStart(2, '0');
    T.push({ id, name, kind: '정보성', status: '심사 중', text: body });
    s.hq18.vars[id] = ui.f_vars || (body.match(/#\{([^}]+)\}/g) || []).map(x => x.slice(2, -1)).join('·') || '-';
    s.hq18.used[id] = '-';
    ui.sel = id; ui.form = false; ui.f_name = ''; ui.f_body = ''; ui.f_vars = '';
    say(id + ' 템플릿을 카카오 심사에 올렸어요. 승인되면 센터가 고를 수 있어요.');
  });
  B.action('HQ18.review', (ctx, id) => {
    if (deny(ctx)) return;
    const t = (ctx.s.alim.templates || []).find(x => x.id === (id || 'T04')); if (!t) return;
    t.status = '승인'; if (ctx.s.hq18.used[t.id] === '-') ctx.s.hq18.used[t.id] = 0;
    say(t.id + ' ' + t.name + ' 심사가 승인됐어요. ' + (LOCK[t.id] ? LOCK[t.id] + ' 잠금이 풀렸어요.' : '센터가 고를 수 있어요.'));
  });
  B.action('HQ18.resubmit', (ctx, id) => {
    if (deny(ctx)) return;
    const t = (ctx.s.alim.templates || []).find(x => x.id === (id || 'T06')); if (!t) return;
    t.status = '심사 중';
    say(t.id + ' 문구를 고쳐 다시 심사에 올렸어요.');
  });
  B.action('HQ18.topup', (ctx, c) => {
    if (deny(ctx)) return;
    const s = ctx.s, A = s.alim, center = c || 'busan';
    const tp = (A.topups || []).find(x => x.center === center && x.status === '입금 대기'); if (!tp) return;
    tp.status = '충전 완료';
    A.balances[center] = (A.balances[center] || 0) + tp.amount;
    const L = s.hq17.ledger[center] = s.hq17.ledger[center] || [];
    L.push({ d: String(tp.at || '2027-10-07').slice(5), t: '알림톡 충전', c: tp.amount, p: tp.amount });
    say(cname(s, center) + ' 입금을 확인하고 ' + won(tp.amount) + '원을 충전했어요. 거래원장(HQ-17)에도 적혔어요.');
  });
  B.action('HQ18.threshold', (ctx, v, el) => {
    if (deny(ctx)) return;
    let val = v;
    if (val == null) { const box = el && document.querySelector('#app [data-field="f_th"]'); val = box ? box.value : ctx.ui.f_th; }
    const n = Number(String(val || '').replace(/[^\d]/g, ''));
    ctx.s.hq18.th = n > 0 ? n : null;
    say(n > 0 ? '부족 경고 기준을 ' + won(n) + '원으로 적용했어요 (예시).' : '기준을 비웠어요.');
  });
  B.action('HQ18.grace', (ctx, c) => {
    if (deny(ctx)) return;
    const g = ctx.s.hq18.grace, center = c || 'busan'; g[center] = !g[center];
    say(cname(ctx.s, center) + ' 안전 알림 유예를 ' + (g[center] ? '켰어요.' : '껐어요.'));
  });
  B.action('HQ18.askFix', (ctx, i) => {
    if (deny(ctx)) return;
    const L = ctx.s.alim.log || [];
    const idx = i != null ? Number(i) : L.findIndex(r => Number(r.fail) > 0);
    if (idx < 0) return;
    ctx.s.hq18.asked[idx] = true;
    say('센터에 보호자 번호를 확인해 달라고 요청했어요.');
  });

  /* ---------------- HQ-19 교재·물품 ---------------- */
  const okey = o => o.id + '@' + o.center;
  const NEXT = { '접수': '제작', '제작': '출고', '출고': '배송 완료' };
  const NEXT_LABEL = { '접수': '제작 시작', '제작': '출고 처리', '출고': '배송 완료 처리' };
  const ordChip = st => h.chip(st, { '배송 완료': 'ok', '출고': 'info', '제작': 'info', '접수': '', '반품 요청': 'warn', '반품 완료': '', '반품 거절': 'bad' }[st] || '');
  function billOf(s, o) {
    if (ctype(s, o.center) === '직영') return muted('내부 출고');
    if (/반품/.test(o.status)) return muted('청구 없음');
    if (!/출고|배송 완료/.test(o.status)) return muted('출고하면 정해져요');
    const mm = Number(String(o.date || '').slice(0, 2));
    return esc(cname(s, o.center).replace('센터', '') + ' ' + (mm ? mm + '월' : '') + ' 청구서') + ' ' + small(o.id);
  }
  function prodTab(ctx) {
    const s = ctx.s, H = s.hq19, ui = ctx.ui, ro = !ctx.canEdit;
    let html = '';
    if (ui.form) {
      html += card2({
        title: '상품 등록', right: h.btn('닫기', { sm: true, act: 'HQ19.closeForm' }),
        body: '<div class="grid g4">' + h.field({ label: '품목', req: true, value: ui.f_name || '', field: 'f_name', ph: 'L2 주간 워크북 (10월 3주)', err: ui.f_err_name }) +
          h.field({ label: 'POL-09 품목 분류', type: 'select', value: ui.f_cat || '주간 교재 인쇄본', options: ['주간 교재 인쇄본', '홍보물', '학습 패드'], field: 'f_cat', hint: '구분과 산정 방식은 품목표에서 가져와요' }) +
          h.field({ label: '단위', value: ui.f_unit || '권', field: 'f_unit' }) +
          h.field({ label: '공급가 (원)', type: 'number', value: ui.f_price || '', field: 'f_price', ph: '미정이면 비워요' }) + '</div>' +
          '<div class="row" style="justify-content:flex-end;margin-top:10px">' + h.btn('상품 저장', { primary: true, act: 'HQ19.save', disabled: ro }) + '</div>',
      }) + '<div style="height:12px"></div>';
    }
    if (ui.pf) {
      const p = H.products.find(x => x.id === ui.pf) || {};
      html += card2({
        title: '공급가 바꾸기', sub: p.name, chip: h.chip('검토 반영', 'review'), right: h.btn('닫기', { sm: true, act: 'HQ19.priceClose' }),
        body: '<div class="grid g3">' + h.field({ label: '새 공급가 (원)', req: true, type: 'number', value: ui.p_price || '', field: 'p_price', hint: '지금 ' + (p.price != null ? won(p.price) + '원' : '미정'), err: ui.p_err_price }) +
          h.field({ label: '적용 시작', type: 'select', value: ui.p_when || '다음 주 마감부터', options: ['다음 주 마감부터', '2027-11-01 0시 예약'], field: 'p_when' }) +
          h.field({ label: '근거', req: true, value: ui.p_reason || '', field: 'p_reason', ph: '원가 견적서, 계약 조항 번호', err: ui.p_err_reason }) + '</div>' +
          '<div style="margin-top:10px">' + h.alert('영향 센터 가맹 2곳 (대구수성센터, 부산해운대센터). 직영은 내부 출고라 금액이 바뀌지 않아요.' + (p.must === '필수' ? ' 필수품목이라 정보공개서 변경등록 할 일이 아래에 생겨요.' : ''), 'review') + '</div>' +
          '<div class="row" style="justify-content:flex-end;margin-top:10px">' + h.btn('변경 예약', { primary: true, act: 'HQ19.priceSave', arg: p.id, disabled: ro }) + '</div>',
      }) + '<div style="height:12px"></div>';
    }
    html += tbl({
      pin: 1,
      cols: [
        { label: '품목', k: 'name' },
        { label: '구분', render: p => h.chip(p.must, p.must === '필수' ? 'navy' : '') },
        { label: '단위', k: 'unit' },
        { label: '공급가', render: p => (p.price != null ? won(p.price) : '미정') + ' ' + h.chip(p.price != null ? '예시' : '미정', p.price != null ? 'st-예시' : 'st-미정') + (H.sched[p.id] ? ' ' + small(H.sched[p.id].when + ' ' + won(H.sched[p.id].price)) : '') },
        { label: '산정 방식', k: 'calc' }, { label: '재고·인쇄', k: 'stock' },
        { label: '판매', render: p => h.chip(p.sale, p.sale === '판매' ? 'ok' : 'warn') },
        { label: '', render: p => p.price != null ? h.btn('바꾸기', { sm: true, ghost: true, act: 'HQ19.priceForm', arg: p.id, disabled: ro }) : '' },
      ],
      rows: H.products,
    });
    const sched = Object.keys(H.sched).map(id => { const p = H.products.find(x => x.id === id) || {}; return '<div><b style="white-space:nowrap">' + esc(p.name || id) + '</b><span class="small">' + esc(won(p.price) + '원에서 ' + won(H.sched[id].price) + '원, ' + H.sched[id].when) + '</span></div>'; }).join('');
    html += '<div class="grid g2" style="margin-top:12px;align-items:start">' + card2({
      pin: 2, title: '교재 인쇄 주기', chip: h.polChip('POL-14'),
      body: h.steps([{ label: '주간 인쇄 (지금)', state: 'cur' }, { label: '제본으로 전환 (1년쯤 뒤, 안)', state: '' }]) +
        '<div class="small" style="margin-top:8px;line-height:1.7">처음에는 교재를 주마다 인쇄해요 (10/20 회의). 그래서 레벨과 주차마다 상품을 나눠요. 학부모가 내는 교재비(POL-14)는 센터가 정하고 공급가와 따로예요.</div>',
    }) + card2({
      pin: 6, title: '공급가 변경 예약', chip: h.chip('검토 반영', 'review'),
      body: (sched ? '<div class="list">' + sched + '</div>' : '<div class="small muted">예약된 변경이 없어요. 표에서 바꾸기를 누르면 근거와 적용일을 받고 영향 센터를 먼저 보여 줘요.</div>') +
        (H.todo.length ? '<div class="small" style="margin-top:8px;font-weight:700;color:var(--sub)">생긴 할 일</div><div class="tl" style="margin-top:4px">' + H.todo.map(x => '<div>' + esc(x) + '</div>').join('') + '</div>' : ''),
    }) + '</div>';
    return html;
  }
  function orderTab(ctx) {
    const s = ctx.s, H = s.hq19, ui = ctx.ui, ro = !ctx.canEdit;
    const view = ui.view || '가맹 주문';
    const list = (s.orders || []).filter(o => view === '가맹 주문' ? ctype(s, o.center) !== '직영' : ctype(s, o.center) === '직영')
      .slice().sort((a, b) => String(b.id).localeCompare(String(a.id)));
    const act = o => {
      if (o.status === '반품 요청') return h.btn('반품 승인', { sm: true, act: 'HQ19.ret', arg: okey(o) + '|ok', disabled: ro }) + ' ' + h.btn('거절', { sm: true, ghost: true, act: 'HQ19.ret', arg: okey(o) + '|no', disabled: ro });
      if (NEXT[o.status]) return h.btn(NEXT_LABEL[o.status], { sm: true, act: 'HQ19.step', arg: okey(o), disabled: ro });
      return '';
    };
    return '<div class="row" style="margin-bottom:14px;padding-left:4px"' + P(3) + '>' + h.chip('이번 주 마감 수 18:00, 금 출고 (예시)', 'line') + small('재원생 레벨 분포로 권장 수량을 자동 계산해요') +
      h.btn('주간 인쇄 마감 보기', { sm: true, ghost: true, act: 'HQ19.toWeek' }) + '<span style="margin-left:auto"></span>' + h.opts(['가맹 주문', '직영 내부 출고'], view, { act: 'HQ19.view' }) + '</div>' +
      tbl({
        pin: 4,
        cols: [{ label: '주문', k: 'id' }, { label: '센터', render: o => esc(cname(s, o.center)) }, { label: '품목', k: 'item' },
          { label: '수량', num: true, render: o => esc(o.qtyText || won(o.qty)) }, { label: '금액', num: true, render: o => ctype(s, o.center) === '직영' ? muted('내부') : won(o.amount) },
          { label: '상태', render: o => ordChip(o.status) }, { label: '출고', k: 'date' }, { label: '청구서', render: o => billOf(s, o) }, { label: '처리', render: act }],
        rows: list, empty: '주문이 없어요.',
      }) +
      note('가맹 센터 대금은 거래원장(HQ-17)에 적히고 월 청구서에 합쳐져요. 직영은 내부 출고라 청구가 없어요. 패드는 공급 방식이 정해지면 팔아요.' + h.polChip('POL-38') + h.btn('거래원장 보기', { sm: true, ghost: true, act: 'HQ19.toLedger' }), 5, { style: 'margin:10px 2px' }) +
      '<div' + P(7) + '>' + h.alert('대금은 출고한 날이 속한 달의 청구서에 주문 번호를 붙여 넣어요 (출고일 기준, 예시). 청구서 칸에서 어느 달에 들어가는지 바로 봐요. 반품을 승인하면 청구에서 빠져요.', 'review', { title: '검토 반영' }) + '</div>';
  }
  function weekTab(ctx) {
    const s = ctx.s, H = s.hq19, ro = !ctx.canEdit, open = s.hq20.open;
    const lv = c => { const o = open[c]; return o ? LV.filter((x, i) => o[i]).join(', ') : '설정 전'; };
    const ord = c => (s.orders || []).filter(o => o.center === c && /워크북/.test(o.item) && o.date === '10-08');
    const rows = (s.centers || []).filter(c => c.status === '운영').map(c => {
      const os = ord(c.id), direct = c.type === '직영';
      const rec = c.students + (H.spare || 0);
      const q = direct ? rec : sum(os, o => Number(o.qty) || 0);
      return { c: c.id, type: c.type, st: c.students, rec, q, os, direct };
    });
    const totalQ = sum(rows, r => r.q);
    return card2({
      pin: 3, title: '주간 인쇄 마감', sub: '10월 2주 · 수 18:00 마감, 금 출고 (예시)', chip: H.closed ? h.chip('마감 완료', 'ok') : h.chip('주문 받는 중', 'info'),
      right: h.btn(H.closed ? '인쇄 지시 완료' : '마감하고 인쇄 지시', { primary: !H.closed, act: 'HQ19.close', disabled: ro || H.closed }),
      body: h.table({
        cols: [{ label: '센터', render: r => esc(cname(s, r.c)) + ' ' + small(r.type) }, { label: '열린 레벨 (HQ-20)', render: r => esc(lv(r.c)) }, { label: '재원생', num: true, render: r => won(r.st) },
          { label: '권장 수량', num: true, render: r => won(r.rec) }, { label: '주문 수량', num: true, render: r => r.direct ? muted('내부 출고') : r.os.length ? won(r.q) + ' ' + small(r.os.map(o => o.id).join(', ')) : muted('주문 없음') },
          { label: '인쇄 수량', num: true, render: r => '<b>' + won(r.q) + '</b>' }],
        rows,
      }) + '<div class="row between" style="margin-top:8px"><span class="small muted">권장 수량은 재원생 수에 여유분을 더해요. 열린 레벨 워크북만 인쇄해요.</span><b>인쇄 합계 ' + won(totalQ) + '권</b></div>',
    }) + '<div style="height:12px"></div>' + card2({
      pin: 8, title: '마감 뒤 신규생 대비', chip: h.chip('검토 반영', 'review'),
      body: '<div class="row" style="align-items:flex-end">' + h.field({ label: '센터 여유분 (권)', type: 'number', value: H.spare || '', field: 'f_spare', ph: '0' }) + h.btn('여유분 적용', { act: 'HQ19.spare', disabled: ro }) +
        '<span style="margin-left:auto"></span>' + h.toggle(H.rush, { act: 'HQ19.rush', title: '긴급 소량 주문' }) + '<span class="small">마감 뒤 긴급 소량 주문 받기' + (H.rush ? ' (켜짐, 다음 출고에 함께 보내요)' : '') + '</span></div>' +
        '<div class="small muted" style="margin-top:8px">수요일 마감 뒤에 등록한 학생도 그 주 워크북을 받을 수 있게 해요. 여유분 권수는 정해지지 않았어요.</div>',
    });
  }

  B.screen({
    id: 'HQ-19', side: 'hq', phase: 'P1a', devices: ['pc'], pages: [39],
    title: '교재·물품', menuLabel: '교재·물품', crumb: '교재·물품',
    tabs: [{ id: 'prod', label: '상품' }, { id: 'order', label: '주문 처리' }, { id: 'week', label: '주간 인쇄 마감' }],
    headActions: ctx => h.btn('+ 상품 등록', { primary: true, act: 'HQ19.newForm', disabled: !ctx.canEdit }),
    render(ctx) { return ctx.tab === 'order' ? orderTab(ctx) : ctx.tab === 'week' ? weekTab(ctx) : prodTab(ctx); },
    prd: {
      summary: '본사가 센터에 파는 교재와 물품을 등록하고, 센터 주문을 매주 모아 인쇄하고 출고하는 화면이에요.',
      who: '본사 운영 담당과 슈퍼관리자가 상품과 주문을 관리해요. 정산 담당은 보기만 해요. 콘텐츠 담당과 SV에게는 메뉴가 안 보여요. 센터 원장은 CT-16에서 주문해요.',
      items: [
        { n: 1, tab: 'prod', t: '상품', d: '교재, 도서 키트, 패드, 홍보물을 등록해요. 필수인지 권장인지와 공급가를 매기는 방법은 계약서와 같아야 해요. 학습 패드는 공급 방식이 정해지기 전이라 준비 상태예요.', pol: ['POL-09'], ref: 'p.39 ①' },
        { n: 2, tab: 'prod', t: '교재 인쇄 주기', d: '처음에는 교재를 주마다 인쇄하고 1년쯤 뒤 제본으로 바꿔요(10/20 회의). 그래서 레벨과 주차마다 상품을 나눠요. 학부모가 내는 교재비는 센터가 정하고 공급가와 따로예요.', pol: ['POL-14'], ref: 'p.39 ②' },
        { n: 6, tab: 'prod', kind: 'review', imp: 'IMP-25', t: '공급가를 바꿀 때 근거와 적용일을 받아요', d: '필수품목 공급가는 정보공개서에 적는 값인데, 원문에는 공급가를 바꾸는 절차가 없었어요. 바꾸기를 누르면 근거와 적용 시작일을 꼭 받고, 영향을 받는 센터를 먼저 보여 줘요. 필수품목이면 정보공개서 변경등록 할 일도 함께 생겨요.', pol: ['POL-09'] },
        { n: 3, tab: 'order', t: '주간 마감', d: '매주 마감 시각(예시 수요일 18시)까지 들어온 주문을 모아서 인쇄하고 금요일에 출고해요. 권장 수량은 재원생 레벨 분포로 계산해요.', ref: 'p.39 ③' },
        { n: 4, tab: 'order', t: '주문 처리', d: '주문을 접수, 제작, 출고, 배송 완료 순서로 넘겨요. 반품 요청은 승인하거나 거절해요.', ref: 'p.39 ④' },
        { n: 5, tab: 'order', t: '대금', d: '가맹 센터 주문 대금은 거래원장(HQ-17)에 적혀 월 청구서에 합쳐져요. 직영은 내부 출고라 돈이 오가지 않아요. 패드는 공급 방식이 정해지면 팔아요.', pol: ['POL-38'], ref: 'p.39 ⑤' },
        { n: 7, tab: 'order', kind: 'review', imp: 'IMP-26', t: '대금은 출고한 달 청구서에 들어가요', d: '대금이 어느 달 청구서에 들어갈지 기준이 없어서 같은 돈을 두 번 받을 수 있었어요. 주문일, 출고일, 배송 완료일 중 하나로 정해야 하는데, 여기서는 출고일 기준(예시)으로 그 달 청구서에 주문 번호를 붙여 넣어요. 표의 청구서 칸에서 바로 확인해요.' },
        { n: 3, tab: 'week', t: '주간 마감', d: '이번 주 마감까지 들어온 주문과 직영 내부 출고를 모아 인쇄 수량을 정해요. 열린 레벨(HQ-20)의 워크북만 인쇄해요. 마감하면 접수된 주문이 제작으로 넘어가요.', ref: 'p.39 ③' },
        { n: 8, tab: 'week', kind: 'review', imp: 'IMP-19', t: '마감 뒤 신규생을 위한 여유분', d: '수요일 마감 뒤에 등록한 학생은 그 주 워크북을 받을 방법이 없었어요. 센터 여유분을 정하거나 긴급 소량 주문을 열어 둘 수 있어요.' },
      ],
      open: ['필수품목과 공급가 계산법, 인쇄 원가에 더하는 N%(POL-09)', '학습 패드를 본사가 납품할지(POL-38)', '주간 마감 요일과 시각', '반품과 주문 취소 기준'],
    },
  });

  B.action('HQ19.newForm', ctx => { ctx.ui.form = true; B.state.tab = 'prod'; });
  B.action('HQ19.closeForm', ctx => { ctx.ui.form = false; });
  B.action('HQ19.save', (ctx, arg, el) => {
    if (deny(ctx)) return;
    const s = ctx.s, ui = ctx.ui;
    if (arg && typeof arg === 'object') { ['name', 'cat', 'unit', 'price'].forEach(k => { if (arg[k] != null) ui['f_' + k] = String(arg[k]); }); }
    else if (el) h.readFields(ui);
    ui.form = true;
    const name = String(ui.f_name || '').trim();
    ui.f_err_name = name ? null : '품목 이름을 넣어 주세요.';
    if (ui.f_err_name) return;
    const cat = ui.f_cat || '주간 교재 인쇄본';
    const map = { '주간 교재 인쇄본': ['필수', '인쇄 원가 + N%', '주문 수량만큼 인쇄'], '홍보물': ['권장', '실비', '재고 0'], '학습 패드': ['권장', 'POL-38 결정 후', '-'] }[cat];
    const price = Number(String(ui.f_price || '').replace(/[^\d]/g, ''));
    s.hq19.products.push({ id: 'g' + (s.hq19.products.length + 1), name, must: map[0], unit: ui.f_unit || '권', price: price || null, calc: map[1], stock: map[2], sale: price ? '판매' : '준비' });
    ui.form = false; ui.f_name = ''; ui.f_price = '';
    say(name + ' 상품을 등록했어요. 구분은 POL-09 품목표대로 ' + (map[0] === '필수' ? '필수예요.' : '권장이에요.'));
  });
  B.action('HQ19.priceForm', (ctx, id) => { ctx.ui.pf = id || 'g1'; ctx.ui.p_err_price = null; ctx.ui.p_err_reason = null; B.state.tab = 'prod'; });
  B.action('HQ19.priceClose', ctx => { ctx.ui.pf = null; });
  B.action('HQ19.priceSave', (ctx, arg, el) => {
    if (deny(ctx)) return;
    const s = ctx.s, ui = ctx.ui;
    if (arg && typeof arg === 'object') { ui.pf = arg.id || ui.pf || 'g1'; if (arg.price != null) ui.p_price = String(arg.price); if (arg.when) ui.p_when = arg.when; if (arg.reason != null) ui.p_reason = arg.reason; }
    else { if (arg) ui.pf = arg; if (el) h.readFields(ui); }
    const p = s.hq19.products.find(x => x.id === (ui.pf || 'g1')); if (!p) return;
    const price = Number(String(ui.p_price || '').replace(/[^\d]/g, ''));
    ui.p_err_price = price > 0 ? null : '새 공급가를 숫자로 넣어 주세요.';
    ui.p_err_reason = String(ui.p_reason || '').trim() ? null : '근거 없이 공급가를 바꿀 수 없어요. 견적서나 계약 조항을 적어 주세요.';
    if (ui.p_err_price || ui.p_err_reason) return;
    const when = ui.p_when || '다음 주 마감부터';
    s.hq19.sched[p.id] = { price, when: when === '다음 주 마감부터' ? '다음 주부터' : '11/1부터' };
    if (p.must === '필수') s.hq19.todo.unshift('정보공개서 변경등록 확인 (' + p.name + ' 공급가 ' + won(p.price) + '원에서 ' + won(price) + '원, 근거 ' + ui.p_reason + ')');
    ui.pf = null; ui.p_price = ''; ui.p_reason = '';
    say('공급가 변경을 예약했어요. 영향 센터 2곳에 미리 안내해요.');
  });
  B.action('HQ19.view', (ctx, v) => { ctx.ui.view = v; });
  B.action('HQ19.toWeek', () => { B.state.tab = 'week'; });
  B.action('HQ19.toLedger', ctx => { const r = ctx.s.ui['HQ-17'] = ctx.s.ui['HQ-17'] || {}; r.invoice = 'inv-daegu-09'; B.go('HQ-17'); return false; });
  const findOrder = (s, key) => (s.orders || []).find(o => okey(o) === key || o.id === key);
  B.action('HQ19.step', (ctx, key) => {
    if (deny(ctx)) return;
    const o = findOrder(ctx.s, key || '#0712@daegu'); if (!o || !NEXT[o.status]) return;
    o.status = NEXT[o.status];
    if (o.status === '출고' && (!o.date || o.date === '-')) o.date = '10-08';
    say(o.id + ' 주문을 ' + o.status + ' 단계로 넘겼어요.' + (o.status === '출고' && ctype(ctx.s, o.center) !== '직영' ? ' 출고한 달 청구서에 주문 번호로 들어가요.' : ''));
  });
  B.action('HQ19.ret', (ctx, arg) => {
    if (deny(ctx)) return;
    let key = arg, ok = true;
    if (arg && typeof arg === 'object') { key = arg.key; ok = arg.ok !== false; } else if (typeof arg === 'string' && arg.includes('|')) { const p = arg.split('|'); key = p[0]; ok = p[1] !== 'no'; }
    const o = findOrder(ctx.s, key || '#0698@busan'); if (!o || o.status !== '반품 요청') return;
    o.status = ok ? '반품 완료' : '반품 거절';
    say(o.id + ' 반품을 ' + (ok ? '승인했어요. 청구에서 빠져요.' : '거절했어요. 센터에 사유를 알려요.'));
  });
  B.action('HQ19.close', ctx => {
    if (deny(ctx)) return;
    const s = ctx.s; s.hq19.closed = true;
    (s.orders || []).filter(o => o.status === '접수').forEach(o => { o.status = '제작'; });
    say('10월 2주 주문을 마감했어요. 인쇄 수량을 인쇄소에 보냈어요.');
  });
  B.action('HQ19.spare', (ctx, v, el) => {
    if (deny(ctx)) return;
    let val = v;
    if (val == null) { const box = el && document.querySelector('#app [data-field="f_spare"]'); val = box ? box.value : ctx.ui.f_spare; }
    ctx.s.hq19.spare = Math.max(0, Number(val) || 0);
    say('센터마다 여유분 ' + ctx.s.hq19.spare + '권을 더해 권장 수량을 다시 계산했어요.');
  });
  B.action('HQ19.rush', ctx => { if (deny(ctx)) return; ctx.s.hq19.rush = !ctx.s.hq19.rush; });

  /* ---------------- HQ-20 콘텐츠 배포·검사 버전 ---------------- */
  function studentsAt(s, c, lv) {
    const st = (s.students || []).filter(x => x.center === c && x.level === lv && /재원|휴원|퇴원 예정/.test(x.status)).length;
    const cls = (s.classes || []).filter(x => x.center === c && x.level === lv).length;
    return { st, cls };
  }
  B.screen({
    id: 'HQ-20', side: 'hq', phase: 'P1a', devices: ['pc'], pages: [40],
    title: '콘텐츠 배포·검사 버전', menuLabel: '콘텐츠 배포', crumb: '콘텐츠 배포',
    headActions: ctx => h.btn('배포 예약', { primary: true, act: 'HQ20.form', disabled: !ctx.canEdit }),
    render(ctx) {
      const s = ctx.s, H = s.hq20, ui = ctx.ui, ro = !ctx.canEdit;
      let html = '<div style="border-left:4px solid #6b7280;background:#f4f5f7;border-radius:6px;padding:10px 14px;font-size:12.8px;margin-bottom:12px"' + P(1) + '>콘텐츠 제작과 수정은 브레인180 학습 시스템(별도 학습 프로젝트)에서 해요. 이 화면은 버전을 받아 센터에 여는 일만 해요.</div>';
      if (ui.form) {
        html += card2({
          title: '배포 예약', right: h.btn('닫기', { sm: true, act: 'HQ20.closeForm' }),
          body: '<div class="grid g3">' + h.field({ label: '버전', type: 'select', value: ui.f_v || '2027.4', options: H.versions.filter(v => v.status !== '배포 중').map(v => v.v), field: 'f_v' }) +
            h.field({ label: '적용일', type: 'date', value: ui.f_date || '2027-10-04', field: 'f_date', err: ui.f_err_date }) +
            h.field({ label: '진행 중 원생', type: 'static', value: '다음 회차부터 새 버전' }) + '</div>' +
            '<div class="row" style="justify-content:flex-end;margin-top:10px">' + h.btn('예약 저장', { primary: true, act: 'HQ20.schedule', disabled: ro }) + '</div>',
        }) + '<div style="height:12px"></div>';
      }
      html += card2({
        pin: 2, title: '커리큘럼 버전',
        body: h.table({
          cols: [{ label: '버전', k: 'v' }, { label: '레벨', render: v => esc(v.level) + ' ' + h.chip('(안)', 'st-안') }, { label: '도서', render: v => v.books + '권' }, { label: '회차', k: 'sessions' },
            { label: '상태', render: v => h.chip(v.status, v.status === '배포 중' ? 'ok' : v.status === '배포 예약' ? 'info' : '') }, { label: '적용일', k: 'date' }],
          rows: H.versions,
        }) + note(H.scheduled ? '배포를 예약하며 센터 공지 초안(' + (H.drafts[0] || H.scheduled.v) + ')을 만들었어요. 적용일 전 마지막 주문 마감부터 ' + H.scheduled.v + ' 워크북으로 받아요.' : '배포를 예약하면 센터 공지 초안과 워크북 버전 전환이 함께 잡혀요.', 8,
          { style: 'margin-top:8px;padding:7px 9px;border-radius:7px;background:var(--review-soft);color:#4a25a8' }),
      });
      const lvTable = h.table({
        cols: [{ label: '센터', render: c => esc(cname(s, c)) }].concat(LV.map((lv, i) => ({
          label: lv, render: c => {
            const on = H.open[c][i], bl = H.block[c + '|' + lv];
            return '<label style="display:inline-flex;gap:4px;align-items:center;cursor:pointer"><input type="checkbox" data-act="HQ20.toggle" data-arg="' + c + '|' + lv + '"' + (on ? ' checked' : '') + (ro ? ' disabled' : '') + '>' + (bl ? '<span class="small" style="color:var(--warn);white-space:nowrap" title="신규 배정 중지">신규 중지</span>' : '') + '</label>';
          },
        }))).concat([{ label: '검사 버전', render: c => esc(H.testVer[c]) }]),
        rows: H.centers,
      });
      const pend = ui.pending;
      const guard = pend
        ? h.alert(cname(s, pend.c) + ' ' + pend.lv + '에 재원생 ' + pend.st + '명, 반 ' + pend.cls + '개가 있어요. 닫으면 기존 반과 학생이 센터 화면에서 사라져요. 닫는 대신 신규 배정만 막을까요?' +
          '<div class="row" style="margin-top:6px">' + h.btn('신규 배정만 막기', { sm: true, primary: true, act: 'HQ20.block', arg: pend.c + '|' + pend.lv }) + h.btn('취소', { sm: true, act: 'HQ20.cancel' }) + '</div>', 'review', { raw: true, title: '닫기 전 확인' })
        : '<div class="small" style="padding:7px 9px;border-radius:7px;background:var(--review-soft);color:#4a25a8">학생이 있는 레벨은 바로 닫지 않고 재원생과 반 수를 먼저 보여 줘요.</div>';
      const t = H.test;
      const right = card2({
        pin: 4, title: '입학 테스트 버전', chip: h.polChip('POL-26') + h.polChip('POL-30'),
        body: formRow('두뇌 유형', sel('t_brain', ui.t_brain || t.brain, ['간단판 v1', '원본 180문항'], { disabled: ro }) + ' ' + h.chip('미정', 'st-미정')) +
          formRow('읽기 테스트', sel('t_read', ui.t_read || t.read, ['v1'], { disabled: ro })) +
          formRow('결과지 템플릿', sel('t_report', ui.t_report || t.report, ['유형·레벨형 v1'], { disabled: ro })) +
          '<div class="row between" style="margin-top:8px">' + small(H.deployed ? '배포 완료 ' + H.deployed : '결과지는 유형과 레벨만 보여 줘요') + h.btn('센터에 배포', { sm: true, act: 'HQ20.test', disabled: ro }) + '</div>',
      });
      const open = s.hq16.mism.filter(m => !m.done);
      const sync = card2({
        pin: 5, title: '학습 계정 연동', chip: h.polChip('POL-23'),
        body: h.kv([['계정 신호', '활성과 정지, 수강권과 POL-23 기준'], ['학습 결과 받기', '하루 1회와 실시간 이벤트 ' + h.chip('미정', 'st-미정'), true], ['연동 오류', H.errors + '건 (최근 7일)']]) +
          '<div style="margin-top:8px;padding:9px 10px;border-radius:8px;background:var(--review-soft)"' + P(6) + '><div class="row between"><b class="small" style="color:#4a25a8">매일 계정 상태 맞춰 보기</b>' +
          h.btn(H.checked ? '다시 점검' : '점검 실행', { sm: true, act: 'HQ20.check', disabled: ro }) + '</div>' +
          (H.checked ? (open.length ? '<div class="list" style="margin-top:4px">' + open.map(m => '<div class="small"><b>' + esc(cname(s, m.center)) + ' ' + esc(m.student) + '</b>' + esc(m.st + '인데 학습 계정 활성') +
            '<span style="margin-left:auto">' + h.btn('정지 신호 다시 보내기', { sm: true, act: 'HQ20.resend', arg: m.id, disabled: ro }) + '</span></div>').join('') + '</div>' +
            '<div class="row" style="margin-top:4px">' + h.btn('HQ-16 대사에서 보기', { sm: true, ghost: true, act: 'HQ20.toRecon' }) + '</div>'
            : '<div class="small" style="margin-top:4px;color:var(--ok)">학습 시스템과 관리자 기록이 모두 같아요.</div>')
            : '<div class="small muted" style="margin-top:4px">학습 시스템 계정 상태와 관리자 기록을 비교해 다른 건을 찾아요.</div>') + '</div>',
      });
      html += '<div class="grid g2" style="align-items:start;margin-top:12px">' + card2({
        pin: 3, title: '센터별 개방 레벨', chip: h.polChip('POL-32') + h.polChip('POL-31'),
        body: lvTable + '<div class="small muted" style="margin:6px 0 8px">체크한 레벨만 센터의 반 편성과 원생 레벨에 나타나요. 레벨 체계는 HQ-13에서 가져와요.</div>' + '<div' + P(7) + '>' + guard + '</div>',
      }) + '<div class="stack">' + right + sync + '</div></div>';
      return html;
    },
    mount(root, ctx) { bindRR(root, ctx); },
    prd: {
      summary: '학습 앱 팀이 만든 커리큘럼 버전을 받아 센터마다 열어 주고, 입학 테스트 버전과 학습 계정 신호를 관리하는 화면이에요.',
      who: '본사 콘텐츠 담당과 슈퍼관리자가 보고 고쳐요. 운영 담당은 보기만 해요. 정산 담당과 SV에게는 메뉴가 안 보여요.',
      items: [
        { n: 1, t: '범위 구분', d: '콘텐츠를 만들고 고치는 일은 별도 학습 프로젝트에서 해요. 이 화면은 버전을 받아 센터에 여는 일만 해요(10/20 회의).', ref: 'p.40 ①' },
        { n: 2, t: '커리큘럼 버전', d: '학습 시스템에서 확정한 버전을 받아 적용일을 정해요. 배우는 중인 학생은 다음 회차부터 새 버전을 써요. 오른쪽 위 배포 예약으로 적용일을 잡아요.', ref: 'p.40 ②' },
        { n: 3, t: '센터별 개방 레벨', d: '센터의 대상 학년과 준비 상황에 맞춰 열 레벨을 골라요. 체크한 레벨만 센터의 반 편성과 원생 레벨에 나타나요. 레벨 체계는 HQ-13에서 가져오고 아직 (안)이에요.', pol: ['POL-32', 'POL-31'], ref: 'p.40 ③' },
        { n: 4, t: '검사 버전과 결과지', d: '입학 테스트 버전과 결과지 틀을 골라 센터에 배포해요. 결과지는 유형과 레벨만 보여 주는 형식이에요. 원본으로 할지 간단판으로 할지는 아직 정하지 않아서 미정으로 보여요.', pol: ['POL-26', 'POL-30'], ref: 'p.40 ④' },
        { n: 5, t: '학습 계정 연동', d: '수강권과 계정 오픈 규칙에 따라 학습 계정을 열고 닫는 신호를 보내요. 학습 결과는 받아서 CT-13에 보여 줘요.', pol: ['POL-23'], ref: 'p.40 ⑤' },
        { n: 6, kind: 'review', imp: ['IMP-05', 'IMP-22'], t: '어긋난 계정은 찾아서 다시 보내요', d: '정지 신호가 빠지면 퇴원생에게도 사용료가 붙을 수 있어요. 매일 학습 시스템 계정 상태와 관리자 기록을 맞춰 보고, 다른 건은 정지 신호를 다시 보내거나 HQ-16 대사로 넘겨요.' },
        { n: 7, kind: 'review', imp: 'IMP-19', t: '학생이 있는 레벨은 바로 닫지 않아요', d: '체크를 풀면 그 레벨의 반과 학생이 센터 화면에서 사라질 수 있었어요. 재원생과 반 수를 먼저 보여 주고, 학생이 있으면 닫는 대신 신규 배정만 막아요.' },
        { n: 8, kind: 'review', imp: 'IMP-19', t: '배포 예약할 때 공지와 교재도 같이 바꿔요', d: '새 버전은 도서 수와 회차가 바뀌어요. 배포를 예약하면 센터 공지 초안을 만들고, 적용일 전 마지막 주문 마감부터 새 버전 워크북으로 받게 표시해요.' },
      ],
      open: ['레벨 체계와 대상 학년(POL-32, POL-31)', '입학 테스트를 원본으로 할지 간단판으로 할지(POL-26)', '학습 계정을 열고 닫는 때(POL-23)', '학습 프로젝트와 주고받을 신호와 항목'],
    },
  });

  B.action('HQ20.form', ctx => { ctx.ui.form = true; });
  B.action('HQ20.closeForm', ctx => { ctx.ui.form = false; });
  B.action('HQ20.schedule', (ctx, arg, el) => {
    if (deny(ctx)) return;
    const s = ctx.s, H = s.hq20, ui = ctx.ui;
    if (arg && typeof arg === 'object') { if (arg.v) ui.f_v = arg.v; if (arg.date) ui.f_date = arg.date; }
    else if (el) h.readFields(ui);
    const v = H.versions.find(x => x.v === (ui.f_v || '2027.4')); if (!v) return;
    const date = ui.f_date || '2027-10-04';
    ui.f_err_date = date <= '2027-07-05' ? '지금 배포 중인 버전 적용일보다 뒤여야 해요.' : null;
    ui.form = true;
    if (ui.f_err_date) return;
    v.status = '배포 예약'; v.date = date;
    H.scheduled = { v: v.v, date };
    H.drafts.unshift(v.v + ' 커리큘럼 적용 안내 (' + date + ')');
    ui.form = false;
    say(v.v + ' 배포를 ' + date + '로 예약했어요. 센터 공지 초안을 만들었어요.');
  });
  B.action('HQ20.toggle', (ctx, arg) => {
    if (deny(ctx)) return;
    const s = ctx.s, H = s.hq20;
    const [c, lv] = String(arg || 'daechi1|L3').split('|');
    const i = LV.indexOf(lv); if (!H.open[c] || i < 0) return;
    if (H.open[c][i]) {
      const n = studentsAt(s, c, lv);
      if (n.st || n.cls) { ctx.ui.pending = { c, lv, st: n.st, cls: n.cls }; return; }
      H.open[c][i] = 0; delete H.block[c + '|' + lv];
      say(cname(s, c) + ' ' + lv + '를 닫았어요.');
    } else {
      H.open[c][i] = 1; delete H.block[c + '|' + lv];
      say(cname(s, c) + ' ' + lv + '를 열었어요. 반 편성에 나타나요.');
    }
    ctx.ui.pending = null;
  });
  B.action('HQ20.block', (ctx, arg) => {
    if (deny(ctx)) return;
    const s = ctx.s, H = s.hq20, p = ctx.ui.pending || {};
    const [c, lv] = String(arg || (p.c + '|' + p.lv)).split('|');
    H.block[c + '|' + lv] = true; ctx.ui.pending = null;
    say(cname(s, c) + ' ' + lv + '는 열어 둔 채 신규 배정만 막았어요. 기존 반은 그대로예요.');
  });
  B.action('HQ20.cancel', ctx => { ctx.ui.pending = null; });
  B.action('HQ20.test', (ctx, arg) => {
    if (deny(ctx)) return;
    const H = ctx.s.hq20, ui = ctx.ui;
    if (arg && typeof arg === 'object') { if (arg.brain) ui.t_brain = arg.brain; if (arg.read) ui.t_read = arg.read; if (arg.report) ui.t_report = arg.report; }
    H.test = { brain: ui.t_brain || H.test.brain, read: ui.t_read || H.test.read, report: ui.t_report || H.test.report };
    Object.keys(H.testVer).forEach(c => { H.testVer[c] = H.test.brain; });
    H.deployed = H.test.brain + ', 읽기 ' + H.test.read;
    say('입학 테스트와 결과지 버전을 센터에 배포했어요 (' + H.test.brain + ', ' + H.test.report + ').');
  });
  B.action('HQ20.check', ctx => {
    if (deny(ctx)) return;
    ctx.s.hq20.checked = true;
    const n = ctx.s.hq16.mism.filter(m => !m.done).length;
    say(n ? '학습 시스템과 관리자 기록이 ' + n + '건 달라요.' : '모두 같아요.');
  });
  B.action('HQ20.resend', (ctx, id) => {
    if (deny(ctx)) return;
    const s = ctx.s, m = s.hq16.mism.find(x => x.id === (id || 'm1')); if (!m || m.done) return;
    m.done = true; m.how = m.affects ? 'exclude' : 'stop';
    m.note = '정지 신호 재전송 (HQ-20)';
    if (m.affects) {
      const inv = findInv(s, m.inv);
      if (inv) {
        const mt = meta(s, inv); mt.accts = Math.max(0, mt.accts - 1);
        const fee = (inv.lines || []).find(l => kindOf(l) === 'fee');
        if (fee) { fee.a = mt.accts * mt.unit; fee.t = '시스템 사용료 ' + mt.accts + '명 × ' + won(mt.unit) + '원' + (mt.unitNote ? ' (' + mt.unitNote + ')' : ''); }
        if (inv.status !== '초안') mt.reissue = true;
      }
    }
    addLog(s, cname(s, m.center) + ' ' + m.student + ' 정지 신호 재전송 (HQ-20)');
    say(cname(s, m.center) + ' ' + m.student + ' 계정에 정지 신호를 다시 보냈어요. HQ-16 대사에도 반영됐어요.');
  });
  B.action('HQ20.toRecon', () => { B.go('HQ-16', { tab: 'a' }); return false; });
})();
