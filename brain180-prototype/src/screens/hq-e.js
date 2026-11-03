/* HQ-21~26 본사 소통, 계정·권한, 확대 단계 화면. 원문 p.41~44. */
(function () {
  const B = window.B, h = B.h, esc = B.esc, P = h.p;
  const say = m => B.toast(m);
  const isObj = a => !!a && typeof a === 'object';
  const md = d => { d = String(d || ''); return /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(5, 10) : d; };
  const toDate = d => { const [y, m, dd] = String(d).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)); };
  const fmt = dt => dt.toISOString().slice(0, 10);
  const addDays = (d, n) => { const t = toDate(d); t.setUTCDate(t.getUTCDate() + n); return fmt(t); };
  const addMonths = (d, n) => { const t = toDate(d); t.setUTCMonth(t.getUTCMonth() + n); return fmt(t); };
  const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
  const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
  const fullOf = (ctx, mmdd) => (/^\d{2}-\d{2}/.test(String(mmdd)) ? ctx.today.slice(0, 4) + '-' + String(mmdd).slice(0, 5) : String(mmdd).slice(0, 10));
  const cobj = (s, id) => (s.centers || []).find(c => c.id === id) || { id, name: id };
  const cname = (s, id) => cobj(s, id).name;
  const won = n => Number(n || 0).toLocaleString('ko-KR') + '원';
  const small = t => '<span class="small muted">' + esc(t) + '</span>';
  const PHONE = /01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/;
  const live = s => s.centers.filter(c => c.status === '운영');
  // 숫자로 끝나는 날짜, 버전 뒤에 붙는 조사 (0 1 3 6 7 8은 받침이 있고, 1 7 8은 ㄹ 받침이라 '로')
  const iyeyo = t => t + (/[013678]$/.test(t) ? '이에요' : '예요');
  const ro = t => t + (/[036]$/.test(t) ? '으로' : '로');
  const eul = t => t + (/[013678]$/.test(t) ? '을' : '를');

  function tb(o) { const pin = o.pin; const c = Object.assign({}, o); delete c.pin; return '<div' + P(pin) + '>' + h.table(c) + '</div>'; }
  function rbox(inner, pin, style) {
    return '<div' + P(pin) + ' style="border:1px solid #d9ccfa;background:#faf8ff;border-radius:9px;padding:9px 12px;' + (style || '') + '">' + inner + '</div>';
  }
  function rtitle(t) { return '<b class="small" style="color:var(--review)">' + esc(t) + '</b>'; }
  function line(label, inner, o) {
    o = o || {};
    return '<div style="display:grid;grid-template-columns:' + (o.w || 104) + 'px minmax(0,1fr);gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid var(--line-2)"><div class="small" style="font-weight:700;color:var(--sub)">' + esc(label) + '</div><div>' + inner + '</div></div>';
  }
  function errLine(t) { return t ? '<div class="field"><div class="err">' + esc(t) + '</div></div>' : ''; }
  function chk(field, on, label, dis) { return '<label class="row small" style="gap:6px;flex-wrap:nowrap"><input type="checkbox" data-field="' + field + '"' + (on ? ' checked' : '') + (dis ? ' disabled' : '') + '> ' + esc(label) + '</label>'; }
  function clock(s) { s.hqe = s.hqe || { t: 0 }; s.hqe.t += 1; const m = 16 * 60 + s.hqe.t * 3; return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  function whoLabel(ctx) {
    const p = ctx.persona;
    if (p.side === 'hq') return p.name + (p.role === '슈퍼관리자' ? ' (슈퍼관리자)' : ' (본사 ' + p.role + ')');
    return p.name + ' (' + (ctx.center ? ctx.center.name.replace('센터', '') : '') + ' ' + p.role + ')';
  }
  function audit(ctx, what, target, reason, extra) {
    ctx.s.audit.unshift(Object.assign({ at: md(ctx.today) + ' ' + clock(ctx.s), who: whoLabel(ctx), what, target, reason: reason || '-' }, extra || {}));
  }
  function deny(ctx, ok) { if (ok == null ? ctx.canEdit : ok) return false; say('보기만 할 수 있는 권한이에요. 위쪽에서 쓸 수 있는 역할로 바꿔 주세요.'); return true; }
  function bump(v) { const m = /^v(\d+)(?:\.(\d+))?$/.exec(v || 'v1'); if (!m) return 'v1'; return 'v' + m[1] + '.' + ((Number(m[2]) || 0) + 1); }

  /* ======================================================================
     data
     ====================================================================== */
  B.extend(s => {
    // 공지와 1:1 문의는 CT-17과 같은 배열을 써요. CT-17이 없는 빌드에서도 같은 id로 넣어요.
    const addN = n => { if (!s.notices.some(x => x.id === n.id || x.title === n.title)) s.notices.push(n); };
    addN({ id: 'n-ct17-1', title: '4월 재등록 안내 문구 변경', must: true, date: '2027-03-05', cat: '운영', read: { daechi1: false, mokdong: true, bundang: false } });
    addN({ id: 'n-ct17-2', title: 'L3 워크북 개정 사항', must: false, date: '2027-03-02', cat: '교육', read: { daechi1: true, mokdong: false, bundang: false } });
    // 원문 p.41 1:1 문의 예시 3건. 경과일(1일, 2일)이 원문과 같도록 오늘(03-08) 기준 날짜를 붙였어요.
    const addQ = q => { if (!s.inquiries.some(x => x.id === q.id || (x.no && x.no === q.no))) s.inquiries.push(q); };
    addQ({ id: 'q1042', no: '#1042', center: 'daegu', cat: '정산', title: '9월 청구서 조정 문의', status: '처리 중', date: '03-07', owner: '정산팀 이수민', body: '9월 청구서의 교재 대금이 주문한 금액과 달라 보여요. 조정할 수 있는지 알려 주세요.' });
    addQ({ id: 'q1041', no: '#1041', center: 'busan', cat: '시스템', title: '키오스크 기기 해제', status: '완료', date: '03-05', owner: 'IT 이OO', body: '키오스크 태블릿을 바꿨어요. 예전 기기 등록을 풀어 주세요.', answer: '예전 기기 등록을 풀었어요. 새 기기에서 센터 코드를 다시 넣어 주세요. (IT 이OO)' });
    addQ({ id: 'q1039', no: '#1039', center: 'daegu', cat: '교재', title: '워크북 수량 부족', status: '접수', date: '03-06', owner: '', body: '이번 주 워크북이 주문한 수량보다 적게 왔어요.' });
    s.hq21 = {
      seq: 0, sla: 2,
      owner: { q1: '운영팀 홍길동', q1027: '운영팀 홍길동' },
      renotify: {},
      files: [
        { id: 'f1', cat: '운영 매뉴얼', name: '센터 운영 매뉴얼', ver: 'v1.2', dl: 18, kind: '받기', hist: [] },
        { id: 'f2', cat: '양식', name: '교습비 게시표 양식', ver: 'v1', dl: 9, kind: '받기', hist: [] },
        { id: 'f4', cat: '마케팅', name: '개원 전단 소스', ver: 'v2', dl: 6, kind: '받기', hist: [] },
        { id: 'f3', cat: '교육', name: '입학 테스트 진행 영상', ver: 'v1', dl: 11, kind: '보기', hist: [] },
      ],
      consent: [],
    };
    if (s.ct17 && Array.isArray(s.ct17.files) && !s.ct17.files.some(f => f.id === 'f4')) s.ct17.files.push({ id: 'f4', name: '개원 전단 소스', ver: 'v2', kind: '받기', cat: '마케팅' });

    // 감사 로그. 원문 p.42 예시 줄을 3월 예시 날짜로 더해요 (같은 배열을 CT-17, CM-02가 같이 써요).
    const addA = a => { if (!s.audit.some(x => x.at === a.at && x.what === a.what)) s.audit.push(a); };
    addA({ at: '03-07 14:21', who: '홍길동 (본사 운영)', what: '지원 모드 열람', target: '대구수성센터', reason: '문의 #1042' });
    addA({ at: '03-07 11:02', who: '이수민 (본사 정산)', what: '엑셀 다운로드', target: '9월 청구서', reason: '정산 검토' });
    addA({ at: '03-06 17:45', who: '정본부 (슈퍼관리자)', what: '마스킹 해제', target: '대치1센터 원생 1명', sid: 's5', reason: '개인정보 정정 요청' });
    addA({ at: '03-06 10:05', who: '송하늘 (대치1 실장·데스크)', what: '원생 정보 수정', target: '대치1센터 원생 1명', sid: 's1', reason: '보호자 연락처 변경 요청' });
    addA({ at: '03-05 09:10', who: '홍길동 (본사 운영)', what: '정책 변경', target: 'POL-01', reason: '경영회의' });
    addA({ at: '03-04 08:58', who: 'jung.mj (센터)', what: '로그인 실패 5회', target: '계정 잠금', reason: '-', ip: '211.*.*.*' });
    // 2월 접속기록 점검(월 점검 탭)에 들어가는 2월 예시 줄
    addA({ at: '02-24 16:05', who: '정본부 (슈퍼관리자)', what: '마스킹 해제', target: '대치1센터 원생 1명', sid: 's2', reason: '보호자 연락처 확인 요청' });
    addA({ at: '02-12 10:30', who: '홍길동 (본사 운영)', what: '지원 모드 열람', target: '대치1센터', reason: '결제 링크 오류 확인' });

    s.hq22 = {
      accounts: [
        { id: 'a1', name: '정본부', login: 'jung.bb', role: '슈퍼관리자', tf: true, status: '활성' },
        { id: 'a2', name: '홍길동', login: 'hong.gd', role: '운영', tf: true, status: '활성' },
        { id: 'a3', name: '이수민', login: 'lee.sm', role: '정산', tf: true, status: '활성' },
        { id: 'a4', name: '정다은', login: 'jung.de', role: '콘텐츠', tf: true, status: '활성' },
        { id: 'a5', name: '최민호', login: 'choi.mh', role: 'SV', tf: true, status: '활성' },
        { id: 'a6', name: '정유나', login: 'jung.yn', role: 'SV', tf: true, status: '활성' },
      ],
      matrix: Object.assign({}, M04),
      scopes: { 'policy|1': [], 'policy|2': ['A'] },
      pending: null,
      check: { month: '2월', from: '02-01', to: '02-28', dl: 42, dlOk: false, maskOk: false, status: '대기', done: '', checker: '' },
      checks: [],
      ledger: [
        { id: 'd1', date: '', kind: '퇴원생 개인정보', n: 12, basis: '보관 기간 만료 (POL-40)', status: '대상 추출', notified: '' },
        { id: 'd2', date: '', kind: '거래 증빙 (영수증, 청구서)', n: null, basis: '5년 보관 뒤 파기 (POL-41)', status: '보관 중', notified: '' },
      ],
    };

    // HQ-23 통계. 표 숫자는 원문 p.43 예시 그대로예요.
    s.hq23 = {
      rows: [
        { center: 'daechi1', active: 128, add: 14, out: 3, keep: 92, levels: [['L1', 22], ['L2', 51], ['L3', 55]] },
        { center: 'daegu', active: 63, add: 12, out: 5, keep: 86, levels: [['L1', 10], ['L2', 24], ['L3', 21], ['L4', 8]] },
      ],
      reasons: { daegu: '지역 시세' },
      // CT-21 원문 예시(p.66) 퇴원 사유
      outReasons: { daechi1: [['학원 일정 겹침', 5], ['이사', 2], ['비용', 1]] },
    };

    // HQ-24 운영 점검. 원문 p.43 예시 일정 2건.
    if (!s.ct23) s.ct23 = { items: [{ id: 'sv1', date: '2027-07-02', item: '종사자 경력 조회', result: '보완', due: '2027-07-16', status: '보완 요청', sv: '최민호', memo: '경력 조회일이 없는 종사자가 있어요.', reply: null }], files: {} };
    s.hq24 = {
      visits: [
        { id: 'v-0715', date: '2027-07-15', center: 'daegu', sv: '정유나', status: '예정', tpl: 'v2', res: {}, memo: {}, link: {}, re: {} },
        { id: 'v-0702', date: '2027-07-02', center: 'busan', sv: '정유나', status: '완료', tpl: 'v1', res: { fee: '적합', cap: '적합', staff: '보완', priv: '적합' }, memo: { staff: '경력 조회일이 없는 종사자가 있어요.' }, link: { staff: 'sv1' }, re: {} },
      ],
      seq: 0,
    };

    // HQ-25 교육·인증. 이수 표시는 교직원 예시 데이터(data.js staff) 기준이에요.
    s.hq25 = {
      courses: [
        { id: 'c1', name: '센터 운영 기본', target: '원장', must: true, done: { st1: '이수', st6: '이수', st8: '이수' } },
        { id: 'c2', name: '브레인180 코칭', target: '교사·보조', must: true, done: { st3: '이수', st4: '이수', st7: '이수' } },
        { id: 'c3', name: '검사 해석 상담자 인증', target: '원장·실장', must: true, cert: true, done: { st1: '이수', st8: '이수' } },
      ],
      temp: {}, reminded: '',
    };

    // HQ-26 갱신·해지·폐점. 대구수성 줄은 원문 p.44 예시, 부산해운대는 센터 기본 데이터의 계약 만료일이에요.
    s.hq26 = {
      renewals: [
        { id: 'rn1', center: 'daegu', end: '2030-06-13', req: '2029-12-20', status: '검토 중', decision: null },
        { id: 'rn2', center: 'busan', end: (s.centers.find(c => c.id === 'busan') || {}).contractEnd || '2030-05-31', req: '', status: '요구 전', decision: null },
      ],
      term: null,
      close: null,
    };
  });

  /* ======================================================================
     HQ-21 공지·자료실·1:1 문의 (p.41)
     ====================================================================== */
  function groupIds(s, g) {
    const L = live(s);
    if (g === '전체') return L.map(c => c.id);
    if (g === '직영') return L.filter(c => c.type === '직영').map(c => c.id);
    if (g === '가맹') return L.filter(c => c.type !== '직영').map(c => c.id);
    return [];
  }
  // 받는 센터. HQ-21에서 올린 공지는 to에 적어 두고, 예전 공지는 read 키로 셉니다.
  // CT-17이 받는 센터로 거르지 않아서 다른 센터가 확인해도 받는 센터 수가 바뀌지 않게 해요.
  const toOf = n => (Array.isArray(n.to) ? n.to : Object.keys(n.read || {}));
  function targetLabel(s, n) {
    if (n.target) return n.target;
    const ids = toOf(n).slice().sort().join(',');
    for (const g of ['전체', '직영', '가맹']) if (groupIds(s, g).slice().sort().join(',') === ids) return g;
    return '센터 지정 ' + toOf(n).length + '곳';
  }
  const unreadOf = n => toOf(n).filter(k => !(n.read || {})[k]);
  const nCat = n => n.cat || (/(청구서|사용료|정산)/.test(n.title) ? '정산' : /(테스트|워크북|교재|교육)/.test(n.title) ? '교육' : '운영');
  const qStatus = st => (st === '진행 중' ? '처리 중' : st === '해결' ? '완료' : st);
  const qDone = q => qStatus(q.status) === '완료';
  // 정산은 본사 청구서, 사용료 문의만. 학부모 재등록 청구 금액 같은 센터 수납 문의는 운영으로 봐요.
  const qCat = q => q.cat || (/(청구서|사용료|정산|가맹금)/.test(q.title) ? '정산' : /(키오스크|오류|링크|로그인|기기)/.test(q.title) ? '시스템' : /(워크북|교재|도서)/.test(q.title) ? '교재' : '운영');
  const qOwner = (s, q) => q.owner || s.hq21.owner[q.id] || '';
  function defaultOwner(s, q) {
    const cat = qCat(q);
    if (cat === '정산') return '정산팀 이수민';
    if (cat === '교재') return '운영팀 홍길동';
    if (cat === '시스템') return 'IT 이OO';
    return 'SV ' + (cobj(s, q.center).sv || '최민호');
  }
  const OWNERS = ['정산팀 이수민', '운영팀 홍길동', 'IT 이OO', 'SV 최민호', 'SV 정유나', '콘텐츠팀 정다은'];
  function qElapsed(ctx, q) {
    if (qDone(q)) return { t: '-', over: false };
    if (q.status === '센터 회신 대기') return { t: '멈춤', over: false };
    const d = Math.max(0, diffDays(fullOf(ctx, q.date), ctx.today));
    return { t: d + '일', over: d >= ctx.s.hq21.sla };
  }
  const QCHIP = { '접수': 'info', '처리 중': 'warn', '센터 회신 대기': 'review', '완료': 'ok' };
  const canAnswer = (ctx, q) => ctx.canEdit || (!!qOwner(ctx.s, q) && qOwner(ctx.s, q).indexOf(ctx.persona.name) >= 0);

  function notice21(ctx) {
    const s = ctx.s, ui = ctx.ui;
    let list = s.notices.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (ui.nf === '필독') list = list.filter(n => n.must);
    if (ui.nf === '미확인 있음') list = list.filter(n => n.must && unreadOf(n).length);
    let body = '';
    if (ui.form) body += compose21(ctx);
    body += h.table({
      cols: [
        { label: '구분', render: n => esc(nCat(n)) },
        { label: '제목', render: n => '<b>' + esc(n.title) + '</b>' },
        { label: '대상', render: n => esc(targetLabel(s, n)) },
        { label: '필독', render: n => (n.must ? '●' : '') },
        { label: '확인', render: n => { const tot = toOf(n).length, un = unreadOf(n).length; return '<span class="mono small">' + (tot - un) + '/' + tot + '</span>' + (n.must && un ? ' ' + h.btn('미확인 보기', { sm: true, act: 'HQ21.unread', arg: n.id }) : ''); } },
        { label: '게시일', render: n => '<span class="mono small">' + esc(md(n.date)) + '</span>' },
      ],
      rows: list, empty: '조건에 맞는 공지가 없어요.',
      rowAttr: n => (ui.unread === n.id ? ' class="sel"' : ''),
    });
    const n = s.notices.find(x => x.id === ui.unread);
    if (n) {
      const ids = unreadOf(n), rn = s.hq21.renotify[n.id] || {};
      body += '<div class="card" style="margin-top:12px;background:#fafbfc"><div class="card-h"><h3>미확인 센터</h3><span class="sub">' + esc(n.title) + '</span><div class="r">' +
        h.btn('다시 알리기', { sm: true, primary: true, act: 'HQ21.renotify', arg: n.id, disabled: !ctx.canEdit || !ids.length }) + h.btn('닫기', { sm: true, act: 'HQ21.unread', arg: '' }) + '</div></div>' +
        h.table({
          cols: [{ label: '센터', render: c => esc(c.name) }, { label: '유형', render: c => h.chip(c.type, c.type === '직영' ? 'navy' : 'brand') }, { label: '원장', render: c => esc(c.director) }, { label: '다시 알림', render: c => (rn[c.id] ? '<span class="mono small">' + esc(rn[c.id]) + '</span>' : '<span class="muted">-</span>') }],
          rows: ids.map(id => cobj(s, id)), empty: '모든 센터가 확인했어요.',
        }) + '<div class="small muted" style="margin-top:6px">센터 원장이 CT-17에서 확인하기를 누르면 이 목록에서 빠져요. 센터 대시보드(CT-01)에도 미확인 경고가 떠요.</div></div>';
    }
    return h.card({ title: '공지', sub: '필독 미확인 ' + s.notices.filter(x => x.must && unreadOf(x).length).length + '건', pin: 1, right: h.opts(['전체', '필독', '미확인 있음'], ui.nf || '전체', { act: 'HQ21.nf' }), body });
  }
  function compose21(ctx) {
    const s = ctx.s, ui = ctx.ui, tg = ui.n_target || '전체';
    const ids = tg === '센터 지정' ? (ui.n_centers || []) : groupIds(s, tg);
    const L = live(s);
    return '<div class="card" style="background:#fafbfc;margin-bottom:12px"><div class="card-h"><h3>새 공지</h3><div class="r">' + h.btn('닫기', { sm: true, act: 'HQ21.closeForm' }) + '</div></div>' +
      '<div class="grid" style="grid-template-columns:150px minmax(0,1fr);gap:10px">' +
      h.field({ label: '구분', type: 'select', value: ui.n_cat || '운영', options: ['운영', '정산', '교육', '마케팅'], field: 'n_cat' }) +
      h.field({ label: '제목', req: true, value: ui.n_title || '', field: 'n_title', err: ui.n_err_title, ph: '센터가 목록에서 바로 알아보게 짧게 적어요' }) + '</div>' +
      '<div class="field" style="margin-top:10px"><label>받는 센터<span class="req">*</span></label>' +
      h.opts(['전체', '직영', '가맹', '센터 지정'].map(g => ({ v: g, l: g + (g === '센터 지정' ? '' : ' ' + groupIds(s, g).length + '곳') })), tg, { act: 'HQ21.target' }) +
      (tg === '센터 지정' ? '<div style="margin-top:6px">' + h.opts(L.map(c => ({ v: c.id, l: ((ui.n_centers || []).includes(c.id) ? '✓ ' : '') + c.name })), '', { act: 'HQ21.pick' }) + '</div>' : '') +
      '<div class="hint">받는 센터 ' + ids.length + '곳' + (ids.length ? ' (' + esc(ids.map(id => cname(s, id)).join(', ')) + ')' : '') + '</div>' + errLine(ui.n_err_target) + '</div>' +
      '<div style="margin-top:10px">' + h.field({ label: '본문', req: true, type: 'textarea', value: ui.n_body || '', field: 'n_body', err: ui.n_err_body }) + '</div>' +
      '<div class="row between" style="margin-top:10px">' + chk('n_must', ui.n_must, '필독 공지예요. 센터가 확인하기를 눌러야 해요') +
      h.btn('공지 올리기', { primary: true, act: 'HQ21.post', disabled: !ctx.canEdit }) + '</div></div>';
  }

  function files21(ctx) {
    const s = ctx.s, ui = ctx.ui, F = s.hq21.files;
    const extra = f => (s.ct17 && s.ct17.dl && s.ct17.dl[f.id]) || 0;
    let body = '';
    if (ui.fform) {
      body += '<div class="card" style="background:#fafbfc;margin-bottom:12px"><div class="card-h"><h3>자료 올리기</h3><div class="r">' + h.btn('닫기', { sm: true, act: 'HQ21.fileForm', arg: 'close' }) + '</div></div>' +
        '<div class="grid" style="grid-template-columns:150px minmax(0,1fr) 150px;gap:10px;align-items:start">' +
        h.field({ label: '분류', type: 'select', value: ui.u_cat || '운영 매뉴얼', options: ['운영 매뉴얼', '양식', '마케팅', '교육'], field: 'u_cat' }) +
        h.field({ label: '자료 이름', req: true, value: ui.u_name || '', field: 'u_name', err: ui.u_err }) +
        h.field({ label: '형태', type: 'select', value: ui.u_kind || '문서', options: ['문서', '영상'], field: 'u_kind' }) + '</div>' +
        '<div class="row between" style="margin-top:10px"><span class="small muted">처음 올리면 v1로 시작해요. 센터 자료실(CT-17)에 바로 보여요.</span>' + h.btn('올리기', { primary: true, act: 'HQ21.upload', disabled: !ctx.canEdit }) + '</div></div>';
    }
    body += h.table({
      cols: [
        { label: '분류', k: 'cat' },
        { label: '자료', render: f => '<b>' + esc(f.name) + '</b>' + (f.kind === '보기' ? ' ' + h.chip('영상', 'line') : '') },
        { label: '버전', render: f => '<span class="mono">' + esc(f.ver) + '</span>' },
        { label: '다운로드', num: true, render: f => h.num(f.dl + extra(f)) },
        { label: '', render: f => h.btn('버전 기록', { sm: true, act: 'HQ21.fileSel', arg: f.id }) },
      ],
      rows: F, rowAttr: f => (ui.fsel === f.id ? ' class="sel"' : ''),
    });
    const f = F.find(x => x.id === ui.fsel);
    if (f) {
      body += '<div class="grid g2" style="margin-top:12px;align-items:start"><div class="card" style="background:#fafbfc"><div class="card-h"><h3>' + esc(f.name) + '</h3><span class="sub">지금 ' + esc(f.ver) + '</span></div>' +
        (f.hist.length ? '<div class="tl">' + f.hist.map(x => '<div><b class="mono">' + esc(x.ver) + '</b> ' + esc(x.date) + ', ' + esc(x.by) + '<div class="small muted">' + esc(x.note) + '</div></div>').join('') + '</div>'
          : '<div class="small muted">이 화면에서 올린 새 버전이 여기 쌓여요. 센터가 내려받은 횟수는 ' + h.num(f.dl + extra(f)) + '번이에요.</div>') + '</div>' +
        '<div class="card" style="background:#fafbfc"><div class="card-h"><h3>새 버전 올리기</h3><span class="sub">' + esc(f.ver) + '에서 ' + esc(bump(f.ver)) + '로</span></div>' +
        h.field({ label: '바뀐 내용', req: true, type: 'textarea', value: ui.f_note || '', field: 'f_note', err: ui.f_err, ph: '예) 3장 수납 마감 절차를 고쳤어요' }) +
        '<div class="row" style="justify-content:flex-end;margin-top:8px">' + h.btn('새 버전 올리기', { primary: true, act: 'HQ21.newVer', arg: f.id, disabled: !ctx.canEdit }) + '</div></div></div>';
    }
    return h.card({ title: '자료실', sub: '버전과 다운로드 기록', pin: 2, right: h.btn('+ 자료 올리기', { sm: true, act: 'HQ21.fileForm', disabled: !ctx.canEdit }), body });
  }

  function qna21(ctx) {
    const s = ctx.s, ui = ctx.ui;
    let qs = s.inquiries.slice().sort((a, b) => (qDone(a) - qDone(b)) || String(b.date).localeCompare(String(a.date)) || String(b.no || '').localeCompare(String(a.no || '')));
    if (ui.qf === '처리 전') qs = qs.filter(q => !qDone(q));
    if (ui.qf === '기준 넘음') qs = qs.filter(q => qElapsed(ctx, q).over);
    const unassigned = s.inquiries.filter(q => !qDone(q) && !qOwner(s, q)).length;
    let html = rbox('<div class="row between" style="flex-wrap:nowrap;gap:12px"><div>' + rtitle('분류별 기본 담당') +
      '<div class="small" style="margin-top:3px">정산은 정산팀, 교재는 운영팀, 시스템은 IT, 그 밖의 문의는 센터 담당 SV가 맡아요. 배정받은 사람은 보기 전용 권한이어도 답할 수 있어요.</div></div>' +
      h.btn('미배정 ' + unassigned + '건 기본 담당으로', { sm: true, act: 'HQ21.autoAssign', disabled: !ctx.canEdit || !unassigned }) + '</div>', 5, 'margin-bottom:12px');
    html += h.table({
      cols: [
        { label: '번호', render: q => '<span class="mono small">' + esc(q.no || '-') + '</span>' },
        { label: '센터', render: q => esc(cname(s, q.center)) },
        { label: '분류', render: q => esc(qCat(q)) },
        { label: '제목', render: q => '<b>' + esc(q.title) + '</b>' },
        { label: '상태', render: q => h.chip(qStatus(q.status), QCHIP[qStatus(q.status)] || '') },
        { label: '담당', render: q => (qOwner(s, q) ? esc(qOwner(s, q)) : '<span class="muted">-</span>') },
        { label: '경과', render: q => { const e = qElapsed(ctx, q); return (e.over ? '<b style="color:var(--bad)">' + esc(e.t) + '</b> ' + h.chip('기준 넘음', 'bad') : esc(e.t)); } },
      ],
      rows: qs, empty: '조건에 맞는 문의가 없어요.',
      rowAttr: q => ' class="click' + (ui.sel === q.id ? ' sel' : '') + '" data-act="HQ21.select" data-arg="' + esc(q.id) + '"',
    });
    const q = s.inquiries.find(x => x.id === ui.sel);
    html += q ? '<div style="margin-top:12px">' + detail21(ctx, q) + '</div>' : '<div class="empty" style="margin-top:12px">문의를 누르면 내용과 답변 칸이 열려요.</div>';
    return h.card({ title: '1:1 문의', sub: '처리 기준 ' + s.hq21.sla + '일 (예시)', pin: 3, right: h.opts(['전체', '처리 전', '기준 넘음'], ui.qf || '전체', { act: 'HQ21.qf' }), body: html });
  }
  function detail21(ctx, q) {
    const s = ctx.s, ui = ctx.ui, st = qStatus(q.status), owner = qOwner(s, q), can = canAnswer(ctx, q), done = qDone(q);
    const left = '<div class="stack">' + h.kv([['센터', cname(s, q.center)], ['분류', qCat(q)], ['접수', md(fullOf(ctx, q.date))], ['상태', h.chip(st, QCHIP[st] || ''), true]]) +
      h.alert(q.body || '내용이 없어요.', 'info', { title: '문의 ' + (q.no || '') }) +
      (q.answer ? h.alert(q.answer, 'ok', { title: '보낸 답변' }) : '') +
      (!done ? h.field({ label: '답변', type: 'textarea', value: ui.q_ans || '', field: 'q_ans', err: ui.q_err, disabled: !can, ph: '센터 화면(CT-17)에 그대로 보여요' }) +
        '<div class="row between">' + (can && !ctx.canEdit ? small('배정받은 문의라서 답할 수 있어요.') : '<span></span>') +
        '<div class="row">' + h.btn(st === '센터 회신 대기' ? '처리 중으로 되돌리기' : '센터 회신 대기', { sm: true, act: 'HQ21.wait', arg: q.id, disabled: !can }) + h.btn('답변 보내기', { primary: true, act: 'HQ21.answer', arg: q.id, disabled: !can }) + '</div></div>'
        : '<div class="row" style="justify-content:flex-end">' + h.btn('다시 열기', { sm: true, act: 'HQ21.reopen', arg: q.id, disabled: !ctx.canEdit }) + '</div>') + '</div>';
    let right = '<div class="stack"><div class="field"><label>담당</label>' +
      '<div class="row" style="flex-wrap:nowrap">' + '<select class="inp" data-field="q_owner"' + (!ctx.canEdit ? ' disabled' : '') + '>' + ['', ...OWNERS].map(o => '<option value="' + esc(o) + '"' + ((ui.q_owner != null ? ui.q_owner : owner) === o ? ' selected' : '') + '>' + esc(o || '배정 전') + '</option>').join('') + '</select>' +
      h.btn('배정', { sm: true, act: 'HQ21.assign', arg: q.id, disabled: !ctx.canEdit || done }) + '</div><div class="hint">기본 담당 ' + esc(defaultOwner(s, q)) + '</div></div>';
    if (qCat(q) === '정산' && cobj(s, q.center).type !== '직영') {
      const inv = (s.invoices || []).find(x => x.center === q.center);
      right += rbox(rtitle('청구서 조정은 이의 신청으로') + '<div class="small" style="margin-top:3px">청구서 금액을 고치는 일은 센터 청구서 화면(CT-15)의 이의 신청으로 받아야 청구서 확정 전에 반영돼요.</div>' +
        '<div class="row" style="margin-top:8px">' + h.btn('이의 신청 안내 넣기', { sm: true, act: 'HQ21.disputeTpl', arg: q.id, disabled: !can || done }) + (inv ? h.btn('청구서 상세 (HQ-17)', { sm: true, act: 'HQ21.toInvoice', arg: inv.id }) : '') + '</div>', 6);
    }
    right += '</div>';
    return '<div class="card" style="background:#fafbfc"><div class="card-h"><h3>' + esc((q.no ? q.no + ' ' : '') + q.title) + '</h3><span class="sub">' + esc(owner ? '담당 ' + owner : '배정 전') + '</span></div>' +
      '<div class="grid" style="grid-template-columns:minmax(0,1fr) 300px;gap:14px;align-items:start">' + left + right + '</div></div>';
  }

  function consent21(ctx) {
    const s = ctx.s, ui = ctx.ui, F = live(s).filter(c => c.type !== '직영');
    const picked = ui.c_centers || F.map(c => c.id);
    let body = '<div class="small muted" style="margin-bottom:10px">광고나 판촉 비용을 가맹점과 나눠 낼 때 쓰는 요청이에요. 센터별 분담액을 적어 보내고, 모두 답하면 집행 내역을 알려요.</div>' +
      '<div class="grid" style="grid-template-columns:minmax(0,1fr) 150px 150px;gap:10px;align-items:start">' +
      h.field({ label: '요청 제목', req: true, value: ui.c_title || '', field: 'c_title', err: ui.c_err_title, ph: '예) 가을 개원 공동 광고 분담' }) +
      h.field({ label: '센터별 분담액 (원)', req: true, value: ui.c_amount || '', field: 'c_amount', err: ui.c_err_amount, ph: '숫자만' }) +
      h.field({ label: '동의 기한', type: 'date', value: ui.c_due || '', field: 'c_due', err: ui.c_err_due }) + '</div>' +
      '<div class="field" style="margin-top:10px"><label>받는 가맹 센터</label>' + h.opts(F.map(c => ({ v: c.id, l: (picked.includes(c.id) ? '✓ ' : '') + c.name })), '', { act: 'HQ21.cPick' }) + errLine(ui.c_err_centers) + '</div>' +
      '<div class="row" style="justify-content:flex-end;margin-top:10px">' + h.btn('동의 요청 보내기', { primary: true, act: 'HQ21.cSend', disabled: !ctx.canEdit }) + '</div>';
    s.hq21.consent.forEach(r => {
      const resp = Object.keys(r.resp), wait = resp.filter(k => r.resp[k].st === '대기').length, yes = resp.filter(k => r.resp[k].st === '동의');
      body += '<div class="card" style="margin-top:12px;background:#fafbfc"><div class="card-h"><h3>' + esc(r.title) + '</h3><span class="sub">문안 ' + esc(r.ver) + ', 보낸 날 ' + esc(r.sent) + (r.due ? ', 기한 ' + esc(md(r.due)) : '') + '</span><div class="r">' +
        (r.notified ? h.chip('집행 내역 통보 ' + r.notified, 'ok') : h.btn('집행 내역 통보', { sm: true, primary: true, act: 'HQ21.cNotify', arg: r.id, disabled: !ctx.canEdit || wait > 0 || !yes.length, title: wait ? '모든 센터가 답해야 보낼 수 있어요' : null })) + '</div></div>' +
        '<div class="row" style="gap:6px">' + resp.map(cid => {
          const x = r.resp[cid];
          return '<span class="row" style="gap:4px;border:1px solid var(--line);border-radius:8px;padding:4px 8px;background:#fff">' + esc(cname(s, cid)) + ' ' + h.chip(x.st, x.st === '동의' ? 'ok' : x.st === '거절' ? 'bad' : 'warn') +
            (x.st === '대기' ? h.btn('동의 (시연)', { sm: true, ghost: true, act: 'HQ21.cResp', arg: r.id + '|' + cid + '|동의' }) + h.btn('거절 (시연)', { sm: true, ghost: true, act: 'HQ21.cResp', arg: r.id + '|' + cid + '|거절' }) : '') + '</span>';
        }).join('') + '</div>' +
        '<div class="small muted" style="margin-top:6px">동의한 센터 ' + yes.length + '곳만 ' + won(r.amount) + '씩 나눠 내요. 거절한 센터는 분담하지 않아요.</div></div>';
    });
    const rows = [];
    s.hq21.consent.forEach(r => Object.keys(r.resp).forEach(cid => rows.push({ r, cid, x: r.resp[cid] })));
    const rec = h.card({
      title: '동의 기록', sub: '공지 확인과 따로 저장해요',
      body: tb({
        pin: 7,
        cols: [
          { label: '요청', render: o => esc(o.r.title) },
          { label: '문안', render: o => '<span class="mono small">' + esc(o.r.ver) + '</span>' },
          { label: '센터', render: o => esc(cname(s, o.cid)) },
          { label: '점주', render: o => esc(o.x.by || cobj(s, o.cid).director) },
          { label: '찬반', render: o => h.chip(o.x.st, o.x.st === '동의' ? 'ok' : o.x.st === '거절' ? 'bad' : 'warn') },
          { label: '일시', render: o => (o.x.at ? '<span class="mono small">' + esc(o.x.at) + '</span>' : '<span class="muted">-</span>') },
          { label: '분담액', num: true, render: o => (o.x.st === '거절' ? '<span class="muted">0원</span>' : won(o.r.amount)) },
          { label: '통보일', render: o => esc(o.r.notified || '-') },
        ],
        rows, empty: '아직 보낸 동의 요청이 없어요. 위에서 요청을 보내면 센터별 답이 여기 쌓여요.',
      }),
    });
    return '<div class="stack">' + h.card({ title: '동의 요청', pin: 4, right: h.chip('P2', 'p2'), body }) + rec + '</div>';
  }

  B.screen({
    id: 'HQ-21', side: 'hq', phase: 'P1a', devices: ['pc'], pages: [41],
    title: '공지·자료실·1:1 문의', menuLabel: '공지·자료실·문의', crumb: '소통 > 공지·자료실·1:1 문의',
    tabs: [{ id: 'a', label: '공지', phase: 'P1a' }, { id: 'b', label: '자료실', phase: 'P1a' }, { id: 'c', label: '1:1 문의', phase: 'P1a' }, { id: 'd', label: '동의 요청', phase: 'P2' }],
    headActions: ctx => h.btn('+ 공지 작성', { primary: true, act: 'HQ21.compose', disabled: !ctx.canEdit }),
    render(ctx) {
      if (ctx.tab === 'b') return files21(ctx);
      if (ctx.tab === 'c') return qna21(ctx);
      if (ctx.tab === 'd') return consent21(ctx);
      return notice21(ctx);
    },
    prd: {
      summary: '본사가 센터에 공지를 보내고, 매뉴얼과 양식을 자료실에 올리고, 센터가 남긴 1:1 문의에 답하는 소통 창구예요. 센터는 CT-17에서 같은 내용을 받아 봐요.',
      who: '본사 슈퍼관리자, 운영, 콘텐츠, SV가 쓰고 정산은 보기만 해요(7쪽 권한표). 정산 담당도 자기에게 배정된 문의에는 답할 수 있게 했어요(검토 반영).',
      items: [
        { n: 1, tab: 'a', t: '공지', d: '공지를 쓸 때 받는 센터(전체, 직영, 가맹, 센터 지정)와 필독 여부를 정해요. 필독 공지는 확인하지 않은 센터를 따로 모아 보고 원장에게 다시 알려요. 센터가 CT-17에서 확인하기를 누르면 숫자가 바로 바뀌어요.', ref: 'p.41 ①' },
        { n: 2, tab: 'b', t: '자료실', d: '운영 매뉴얼, 교습비 게시표 양식, 마케팅 소재, 교육 영상을 버전을 붙여 올려요. 새 버전을 올리면 센터 자료실에 바뀐 판이 바로 보이고, 센터가 내려받은 횟수가 쌓여요. 원문 예시는 센터 운영 매뉴얼 v1.2를 18번 받았어요.', ref: 'p.41 ②' },
        { n: 3, tab: 'c', t: '1:1 문의', d: '센터 문의를 분류하고 담당자를 정해 접수, 처리 중, 완료로 관리해요. 처리 기준 시간(예시 2일)이 지나도 끝나지 않으면 경과일이 빨갛게 바뀌어요. 답변을 보내면 센터 화면(CT-17)에 바로 보여요.', ref: 'p.41 ③' },
        { n: 4, tab: 'd', t: '동의 요청 (P2)', d: '광고나 판촉 비용을 가맹점이 나눠 낼 때는 미리 동의를 받고, 돈을 어디에 썼는지 알려야 해요. 센터별 분담액을 적어 요청하고, 모두 답하면 집행 내역을 통보해요. 원문은 확대 단계에서 공지 유형 하나로 넣자고 했는데, 프로토타입은 동의 기록을 따로 남기려고 탭을 나눴어요(7번).', ref: 'p.41 ④' },
        { n: 5, tab: 'c', t: '분류별 담당 배정과 답변 권한', kind: 'review', imp: 'IMP-14', d: '분류에 따라 기본 담당이 정해져요. 정산은 정산팀, 교재는 운영팀, 시스템은 IT, 그 밖의 문의는 센터 담당 SV가 맡아요. 배정받은 사람은 메뉴 권한이 보기 전용이어도 그 문의에 답할 수 있어요(IMP-14). 센터 자료를 기다릴 때는 회신 대기로 두고 경과일을 멈추고, 끝난 문의는 다시 열 수 있어요. 기본 담당과 회신 대기는 p.41 검토 의견이에요.' },
        { n: 6, tab: 'c', t: '청구서 조정 문의는 이의 신청으로', kind: 'review', imp: 'IMP-27', cond: true, reveal: 'HQ21.select', revealArg: 'q1042', d: '청구서 금액을 고쳐 달라는 문의는 정식 이의 신청(CT-15)으로 들어와야 청구서 확정(HQ-16) 전에 반영돼요. 정산 문의를 열면 이의 신청 안내를 답변에 넣는 버튼과 청구서 상세(HQ-17) 바로가기가 나와요.' },
        { n: 7, tab: 'd', t: '동의 기록은 공지 확인과 따로', kind: 'review', imp: 'IMP-25', d: '공지의 확인 버튼만으로는 누가 어떤 내용에 동의했는지 증빙이 약해요. 문안 버전, 동의한 점주, 일시, 찬반, 분담액, 집행 내역 통보일을 따로 저장해요. 검토 의견은 이 기능을 P1b로 앞당기자고 해요.' },
      ],
      open: ['1:1 문의 처리 기준 시간 (예시 2일)과 달력일, 영업일 중 무엇으로 셀지', '필독 공지를 다시 알리는 채널과 횟수', '시스템 문의를 맡을 IT 역할을 본사 역할에 넣을지', '광고·판촉비 동의를 P1b로 앞당길지와 필요한 동의 비율 (법무 확인)'],
      rules: ['광고·판촉비를 가맹점과 나눠 내려면 미리 동의를 받고 집행 내역을 알려야 해요. 가맹사업법 요건이고 세부는 법무가 확인하기 전이에요.'],
    },
  });

  B.action('HQ21.compose', ctx => { B.state.tab = 'a'; ctx.ui.form = true; ['n_err_title', 'n_err_body', 'n_err_target'].forEach(k => { ctx.ui[k] = null; }); });
  B.action('HQ21.closeForm', ctx => { ctx.ui.form = false; });
  B.action('HQ21.nf', (ctx, v) => { ctx.ui.nf = v; });
  B.action('HQ21.target', (ctx, v) => { ctx.ui.n_target = v; ctx.ui.n_err_target = null; });
  B.action('HQ21.pick', (ctx, id) => { const a = ctx.ui.n_centers = (ctx.ui.n_centers || []).slice(); const i = a.indexOf(id); if (i >= 0) a.splice(i, 1); else a.push(id); ctx.ui.n_err_target = null; });
  B.action('HQ21.post', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui;
    if (deny(ctx)) return;
    if (isObj(arg)) {
      ['cat', 'title', 'target', 'body'].forEach(k => { if (arg[k] != null) ui['n_' + k] = arg[k]; });
      if (arg.must != null) ui.n_must = !!arg.must;
      if (arg.centers) ui.n_centers = arg.centers.slice();
    }
    ui.form = true;
    const title = String(ui.n_title || '').trim(), body = String(ui.n_body || '').trim(), tg = ui.n_target || '전체';
    const ids = tg === '센터 지정' ? (ui.n_centers || []) : groupIds(s, tg);
    ui.n_err_title = !title ? '제목을 넣어 주세요.' : null;
    ui.n_err_body = !body ? '본문을 넣어 주세요.' : null;
    ui.n_err_target = !ids.length ? '받는 센터를 한 곳 이상 골라 주세요.' : null;
    if (ui.n_err_title || ui.n_err_body || ui.n_err_target) return;
    s.hq21.seq += 1;
    const id = 'n-hq21-' + s.hq21.seq, read = {};
    ids.forEach(c => { read[c] = false; });
    s.notices.push({ id, title, must: !!ui.n_must, date: ctx.today, cat: ui.n_cat || '운영', target: tg === '센터 지정' ? '센터 지정 ' + ids.length + '곳' : tg, to: ids.slice(), read, body, by: ctx.persona.name });
    if (s.ct17 && s.ct17.bodies) s.ct17.bodies[id] = body;
    ui.form = false; ui.n_title = ''; ui.n_body = ''; ui.n_must = false; ui.nf = '전체';
    say('공지를 올렸어요. 받는 센터 ' + ids.length + '곳에 바로 보여요.');
  });
  B.action('HQ21.unread', (ctx, id) => { ctx.ui.unread = id || null; });
  B.action('HQ21.renotify', (ctx, id) => {
    const s = ctx.s, n = s.notices.find(x => x.id === (id || ctx.ui.unread)) || s.notices.find(x => x.must && unreadOf(x).length);
    if (!n || deny(ctx)) return;
    const ids = unreadOf(n); if (!ids.length) { say('모든 센터가 이미 확인했어요.'); return; }
    const at = md(ctx.today) + ' ' + clock(s), rn = s.hq21.renotify[n.id] = s.hq21.renotify[n.id] || {};
    ids.forEach(c => { rn[c] = at; });
    ctx.ui.unread = n.id;
    say('미확인 ' + ids.length + '곳 원장에게 다시 알렸어요.');
  });
  B.action('HQ21.fileForm', (ctx, v) => { ctx.ui.fform = v !== 'close'; ctx.ui.u_err = null; });
  B.action('HQ21.fileSel', (ctx, id) => { ctx.ui.fsel = ctx.ui.fsel === id ? null : id; ctx.ui.f_err = null; });
  B.action('HQ21.upload', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui;
    if (deny(ctx)) return;
    if (isObj(arg)) { if (arg.cat) ui.u_cat = arg.cat; if (arg.name != null) ui.u_name = arg.name; if (arg.kind) ui.u_kind = arg.kind; }
    ui.fform = true;
    const name = String(ui.u_name || '').trim();
    ui.u_err = !name ? '자료 이름을 넣어 주세요.' : s.hq21.files.some(f => f.name === name) ? '같은 이름의 자료가 있어요. 그 자료에 새 버전을 올려 주세요.' : null;
    if (ui.u_err) return;
    s.hq21.seq += 1;
    const f = { id: 'f-hq21-' + s.hq21.seq, cat: ui.u_cat || '운영 매뉴얼', name, ver: 'v1', dl: 0, kind: ui.u_kind === '영상' ? '보기' : '받기', hist: [{ ver: 'v1', date: md(ctx.today), by: ctx.persona.name, note: '처음 올렸어요' }] };
    s.hq21.files.push(f);
    if (s.ct17 && Array.isArray(s.ct17.files)) s.ct17.files.push({ id: f.id, name: f.name, ver: f.ver, kind: f.kind, cat: f.cat });
    ui.fform = false; ui.u_name = ''; ui.fsel = f.id;
    say(name + ' v1을 올렸어요. 센터 자료실에 바로 보여요.');
  });
  B.action('HQ21.newVer', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui;
    if (deny(ctx)) return;
    const id = isObj(arg) ? arg.id : arg, f = s.hq21.files.find(x => x.id === (id || ui.fsel)); if (!f) return;
    if (isObj(arg) && arg.note != null) ui.f_note = arg.note;
    ui.fsel = f.id;
    const note = String(ui.f_note || '').trim();
    ui.f_err = !note ? '무엇이 바뀌었는지 적어 주세요. 센터가 버전 기록에서 봐요.' : null;
    if (ui.f_err) return;
    const from = f.ver; f.ver = bump(f.ver);
    f.hist.unshift({ ver: f.ver, date: md(ctx.today), by: ctx.persona.name, note: note + ' (' + from + '에서 올렸어요)' });
    const cf = s.ct17 && Array.isArray(s.ct17.files) && s.ct17.files.find(x => x.id === f.id); if (cf) cf.ver = f.ver;
    ui.f_note = '';
    say(f.name + ' ' + eul(f.ver) + ' 올렸어요. 센터 자료실에 바뀐 판이 보여요.');
  });
  B.action('HQ21.qf', (ctx, v) => { ctx.ui.qf = v; });
  B.action('HQ21.select', (ctx, id) => { B.state.tab = 'c'; ctx.ui.sel = id; ctx.ui.q_err = null; ctx.ui.q_owner = null; ctx.ui.q_ans = ''; });
  B.action('HQ21.assign', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui;
    if (deny(ctx)) return;
    let id = arg, owner = ui.q_owner;
    if (isObj(arg)) { id = arg.id; owner = arg.owner; } else if (String(arg).indexOf('|') > 0) { [id, owner] = String(arg).split('|'); }
    const q = s.inquiries.find(x => x.id === (id || ui.sel)); if (!q) return;
    q.owner = owner || defaultOwner(s, q);
    if (qStatus(q.status) === '접수') q.status = '처리 중';
    ui.sel = q.id; ui.q_owner = null;
    say((q.no || '문의') + ' 담당을 정했어요. 담당 ' + q.owner);
  });
  B.action('HQ21.autoAssign', ctx => {
    const s = ctx.s;
    if (deny(ctx)) return;
    const list = s.inquiries.filter(q => !qDone(q) && !qOwner(s, q));
    list.forEach(q => { q.owner = defaultOwner(s, q); if (qStatus(q.status) === '접수') q.status = '처리 중'; });
    say(list.length ? '미배정 ' + list.length + '건을 분류별 기본 담당에게 배정했어요.' : '미배정 문의가 없어요.');
  });
  B.action('HQ21.wait', (ctx, id) => {
    const q = ctx.s.inquiries.find(x => x.id === (id || ctx.ui.sel)); if (!q) return;
    if (!canAnswer(ctx, q)) { deny(ctx, false); return; }
    q.status = q.status === '센터 회신 대기' ? '처리 중' : '센터 회신 대기';
    say(q.status === '센터 회신 대기' ? '센터 회신을 기다리는 동안 경과일을 멈춰요.' : '다시 처리 중으로 돌렸어요.');
  });
  B.action('HQ21.disputeTpl', (ctx, id) => {
    ctx.ui.sel = id || ctx.ui.sel || 'q1042';
    ctx.ui.q_ans = '청구서 금액 조정은 센터 관리자 본사 청구서 화면(CT-15)의 이의 신청으로 남겨 주세요. 확인 기간 안에 올리면 청구서 확정 전에 반영해요. 기간이 지나면 다음 달 청구에서 조정해요.';
  });
  B.action('HQ21.toInvoice', (ctx, inv) => { const r = ctx.s.ui['HQ-17'] = ctx.s.ui['HQ-17'] || {}; r.invoice = inv || 'inv-daegu-09'; B.go('HQ-17'); return false; });
  B.action('HQ21.answer', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui;
    const id = isObj(arg) ? arg.id : arg, q = s.inquiries.find(x => x.id === (id || ui.sel)); if (!q) return;
    if (isObj(arg) && arg.text != null) ui.q_ans = arg.text;
    ui.sel = q.id; B.state.tab = 'c';
    if (!canAnswer(ctx, q)) { deny(ctx, false); return; }
    const text = String(ui.q_ans || '').trim();
    ui.q_err = !text ? '답변을 넣어 주세요.' : PHONE.test(text) ? '답변에 전화번호를 넣지 말아 주세요. 원생은 원생 번호로 적어요.' : null;
    if (ui.q_err) return;
    const owner = qOwner(s, q) || defaultOwner(s, q);
    if (!q.owner) q.owner = owner;
    q.answer = text + ' (' + owner + ', ' + md(ctx.today) + ')';
    q.status = '완료'; q.doneAt = md(ctx.today);
    ui.q_ans = '';
    say('답변을 보냈어요. 센터 화면(CT-17)에 바로 보여요.');
  });
  B.action('HQ21.reopen', (ctx, id) => { const q = ctx.s.inquiries.find(x => x.id === (id || ctx.ui.sel)); if (!q || deny(ctx)) return; q.status = '처리 중'; say('문의를 다시 열었어요.'); });
  B.action('HQ21.cPick', (ctx, id) => {
    const F = live(ctx.s).filter(c => c.type !== '직영').map(c => c.id);
    const a = (ctx.ui.c_centers || F).slice(), i = a.indexOf(id);
    if (i >= 0) a.splice(i, 1); else a.push(id);
    ctx.ui.c_centers = a; ctx.ui.c_err_centers = null;
  });
  B.action('HQ21.cSend', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui;
    if (deny(ctx)) return;
    if (isObj(arg)) { if (arg.title != null) ui.c_title = arg.title; if (arg.amount != null) ui.c_amount = String(arg.amount); if (arg.due != null) ui.c_due = arg.due; if (arg.centers) ui.c_centers = arg.centers.slice(); }
    B.state.tab = 'd';
    const F = live(s).filter(c => c.type !== '직영').map(c => c.id);
    const ids = ui.c_centers || F, title = String(ui.c_title || '').trim(), amount = Number(String(ui.c_amount || '').replace(/[^\d]/g, ''));
    ui.c_err_title = !title ? '요청 제목을 넣어 주세요.' : null;
    ui.c_err_amount = !amount ? '센터별 분담액을 숫자로 넣어 주세요.' : null;
    ui.c_err_due = ui.c_due && ui.c_due < ctx.today ? '기한은 오늘 뒤로 잡아 주세요.' : null;
    ui.c_err_centers = !ids.length ? '받는 센터를 한 곳 이상 골라 주세요.' : null;
    if (ui.c_err_title || ui.c_err_amount || ui.c_err_due || ui.c_err_centers) return;
    s.hq21.seq += 1;
    const resp = {}; ids.forEach(c => { resp[c] = { st: '대기' }; });
    s.hq21.consent.unshift({ id: 'cr' + s.hq21.seq, title, ver: 'v1', amount, due: ui.c_due || '', sent: md(ctx.today), by: ctx.persona.name, resp, notified: '' });
    ui.c_title = ''; ui.c_amount = ''; ui.c_due = '';
    say('동의 요청을 ' + ids.length + '곳에 보냈어요. 센터 원장이 답하면 동의 기록에 쌓여요.');
  });
  B.action('HQ21.cResp', (ctx, arg) => {
    const s = ctx.s;
    const [rid, cid, ans] = isObj(arg) ? [arg.id, arg.center, arg.answer] : String(arg).split('|');
    const r = s.hq21.consent.find(x => x.id === rid) || s.hq21.consent[0]; if (!r || !r.resp[cid]) return;
    r.resp[cid] = { st: ans === '거절' ? '거절' : '동의', by: cobj(s, cid).director, at: md(ctx.today) + ' ' + clock(s) };
    B.state.tab = 'd';
  });
  B.action('HQ21.cNotify', (ctx, id) => {
    const r = ctx.s.hq21.consent.find(x => x.id === id) || ctx.s.hq21.consent[0]; if (!r || deny(ctx)) return;
    const resp = Object.values(r.resp);
    if (resp.some(x => x.st === '대기')) { say('아직 답하지 않은 센터가 있어요.'); return; }
    if (!resp.some(x => x.st === '동의')) { say('동의한 센터가 없어서 집행하지 않아요.'); return; }
    r.notified = md(ctx.today); B.state.tab = 'd';
    say('집행 내역을 동의한 센터에 알렸어요.');
  });

  /* ======================================================================
     HQ-22 계정·권한·감사 로그 (p.42)
     ====================================================================== */
  const ROLES = ['슈퍼관리자', '운영', '정산', '콘텐츠', 'SV'];
  const MROWS = [['dash', '대시보드'], ['franchise', '가맹점 관리 (센터·계약·개별 정책)'], ['recruit', '가맹 모집·정보공개서 게이트'], ['policy', '정책·요금 설정'], ['settle', '정산 (마감·청구·대사)'], ['alim', '알림톡'], ['supply', '교재·물품'], ['content', '콘텐츠 배포·검사 버전'], ['comm', '공지·자료실·1:1 문의'], ['stats', '통계·리포트'], ['sv', '운영 점검(SV)'], ['account', '계정·권한·감사 로그']];
  // 7쪽 역할별 메뉴 권한 매트릭스 (기본값)
  var M04 = { dash: '●●●●●', franchise: '●●○–○', recruit: '●●–––', policy: '●◐◐–○', settle: '●○●––', alim: '●●○––', supply: '●●○––', content: '●○–●–', comm: '●●○●●', stats: '●●●○○', sv: '●○––●', account: '●––––' };
  const SYM = ['●', '◐', '○', '–'];
  const SYMT = { '●': '조회·편집', '◐': '일부 편집', '○': '조회만', '–': '숨김' };
  const FUNCS = ['조회', '작성', '수정', '승인', '내려받기'];
  function polCats() { const m = {}; (B.POLICIES || []).forEach(p => { if (!m[p.cat]) m[p.cat] = { cat: p.cat, name: p.catName, codes: [] }; m[p.cat].codes.push(p.code); }); return Object.values(m); }
  function scopeText(key, list) {
    const row = key.split('|')[0];
    if (!list || !list.length) return '범위가 아직 정해지지 않았어요';
    if (row === 'policy') return polCats().filter(c => list.includes(c.cat)).map(c => c.name + ' (' + c.codes[0] + '~' + c.codes[c.codes.length - 1].slice(4) + ')').join(', ') + ' 정책만';
    return list.join(', ') + '만';
  }
  function kindOf(what) {
    if (/로그인/.test(what)) return '로그인';
    if (/다운로드/.test(what)) return '다운로드';
    if (/마스킹/.test(what)) return '마스킹 해제';
    if (/지원 모드/.test(what)) return '지원 모드 열람';
    if (/정책/.test(what)) return '정책 변경';
    if (/권한|계정/.test(what)) return '권한·계정';
    if (/원생/.test(what)) return '원생 정보';
    if (/파기/.test(what)) return '파기';
    return '기타';
  }
  function taskOf(what) {
    if (/다운로드/.test(what)) return '다운로드';
    if (/출력|인쇄/.test(what)) return '출력';
    if (/파기|삭제/.test(what)) return '삭제';
    if (/마스킹|열람|조회/.test(what)) return '조회';
    if (/변경|수정|잠금|생성|등록|점검|결정/.test(what)) return '수정';
    return '-';
  }
  const isCenterWho = w => /\(센터\)/.test(w) || (!/본사|슈퍼/.test(w) && /(대치|목동|분당|대구|부산|인천)/.test(w));
  const ipOf = e => e.ip || (isCenterWho(e.who || '') ? '211.*.*.*' : '10.0.*.*');
  function auditRows(ctx, f) {
    f = f || {};
    return ctx.s.audit.slice().sort((a, b) => String(b.at).localeCompare(String(a.at))).filter(e => {
      if (f.kind && f.kind !== '전체' && kindOf(e.what) !== f.kind) return false;
      if (f.user === '본사' && isCenterWho(e.who || '')) return false;
      if (f.user === '센터' && !isCenterWho(e.who || '')) return false;
      if (f.period && f.period !== '전체') {
        const d = /^\d{2}-\d{2}/.test(e.at) ? diffDays(fullOf(ctx, e.at), ctx.today) : 0;
        if (d > (f.period === '최근 7일' ? 7 : 30)) return false;
      }
      return true;
    });
  }
  function targetCell(s, e) {
    if (!e.sid) return esc(e.target || '-');
    const st = (s.students || []).find(x => x.id === e.sid);
    return esc(e.target || '') + '<div class="small">' + h.chip('원생 ' + e.sid, 'review') + (st ? ' <span class="muted">' + esc(h.mask(st.name)) + '</span>' : '') + '</div>';
  }

  function acct22(ctx) {
    const s = ctx.s, ui = ctx.ui, A = s.hq22.accounts;
    let body = '';
    if (ui.aform) {
      body += '<div class="card" style="background:#fafbfc;margin-bottom:12px"><div class="card-h"><h3>새 본사 계정</h3><div class="r">' + h.btn('닫기', { sm: true, act: 'HQ22.closeAcct' }) + '</div></div>' +
        '<div class="grid g3">' +
        h.field({ label: '이름', req: true, value: ui.a_name || '', field: 'a_name', err: ui.a_err_name }) +
        h.field({ label: '아이디', req: true, value: ui.a_login || '', field: 'a_login', err: ui.a_err_login, ph: '영문 소문자와 점 3자 이상' }) +
        h.field({ label: '역할', type: 'select', value: ui.a_role || '운영', options: ROLES, field: 'a_role' }) + '</div>' +
        '<div class="row between" style="margin-top:10px"><label class="row small" style="gap:6px"><input type="checkbox" checked disabled> 2단계 인증 필수 (끌 수 없어요)</label>' + h.btn('계정 만들기', { primary: true, act: 'HQ22.saveAcct' }) + '</div></div>';
    }
    body += h.table({
      cols: [
        { label: '이름', render: a => '<b>' + esc(a.name) + '</b>' },
        { label: '역할', k: 'role' },
        { label: '2단계', render: a => (a.tf ? '사용' : h.chip('첫 로그인 때 등록', 'warn')) },
        { label: '상태', render: a => h.chip(a.status, a.status === '활성' ? 'ok' : a.status === '잠김' ? 'bad' : 'warn') + (a.lockReason ? ' ' + small(a.lockReason) : '') },
        { label: '관리', render: a => (a.role === '슈퍼관리자' && a.id === 'a1' ? small('본인') : a.status === '잠김' ? h.btn('잠금 풀기', { sm: true, act: 'HQ22.unlock', arg: a.id }) : h.btn('잠그기', { sm: true, act: 'HQ22.lockAsk', arg: a.id })) },
      ],
      rows: A, rowAttr: a => (ui.lock === a.id ? ' class="sel"' : ''),
    });
    const la = A.find(a => a.id === ui.lock);
    if (la) {
      body += '<div class="card" style="margin-top:10px;background:#fafbfc"><div class="card-h"><h3>' + esc(la.name) + ' 계정 잠그기</h3><div class="r">' + h.btn('취소', { sm: true, act: 'HQ22.lockAsk', arg: '' }) + '</div></div>' +
        '<div class="row between"><div class="row">' + h.opts(['퇴사', '부서 이동', '장기 미접속', '기타'], ui.l_reason || '', { act: 'HQ22.lockReason' }) + '</div>' + h.btn('바로 잠그기', { danger: true, act: 'HQ22.lock', arg: la.id }) + '</div>' + errLine(ui.l_err) + '</div>';
    }
    return h.card({ title: '본사 계정', sub: '모두 2단계 인증, 퇴사나 이동 때 바로 잠가요', pin: 1, body });
  }
  function role22(ctx) {
    const s = ctx.s, ui = ctx.ui, edit = !!ui.edit, M = edit ? ui.draft : s.hq22.matrix, SC = edit ? ui.dscope : s.hq22.scopes;
    const cell = (row, i) => {
      const v = M[row][i], key = row + '|' + i, lockSelf = row === 'account' && i === 0;
      const st = 'min-width:34px;font-size:14px;padding:2px 8px' + (ui.scopeCell === key ? ';border-color:var(--review);background:var(--review-soft)' : '');
      if (edit && !lockSelf) return '<button type="button" class="btn sm" style="' + st + '" data-act="HQ22.cell" data-arg="' + key + '" title="' + esc(SYMT[v]) + '">' + esc(v) + '</button>';
      if (v === '◐') return '<button type="button" class="btn sm ghost" style="' + st + '" data-act="HQ22.scope" data-arg="' + key + '" title="일부 편집 범위 보기">' + esc(v) + '</button>';
      return '<span style="font-size:14px;padding:0 10px" title="' + esc(SYMT[v]) + '">' + esc(v) + '</span>';
    };
    const table = h.table({
      cols: [{ label: '메뉴', render: r => esc(r[1]) }].concat(ROLES.map((r, i) => ({ label: r, render: x => cell(x[0], i) }))),
      rows: MROWS,
    });
    const legend = '<div class="row small muted" style="margin-top:8px;gap:14px">' + SYM.map(x => '<span>' + esc(x) + ' ' + esc(SYMT[x]) + '</span>').join('') + '<span>7쪽 권한 매트릭스가 기본값이에요</span></div>';
    const key = ui.scopeCell || 'policy|2';
    const [srow, si] = key.split('|'), cur = (M[srow] || '')[Number(si)];
    let sc = rtitle('일부 편집 범위') + '<div class="small" style="margin-top:4px"><b>' + esc((MROWS.find(r => r[0] === srow) || [])[1] || '') + '</b>, ' + esc(ROLES[Number(si)] || '') + ' 역할 ' + esc(cur || '') + '</div>';
    if (cur === '◐') {
      sc += '<div class="small" style="margin-top:3px">' + esc(scopeText(key, SC[key])) + '</div>';
      if (edit) {
        const opts = srow === 'policy' ? polCats().map(c => ({ v: c.cat, l: ((SC[key] || []).includes(c.cat) ? '✓ ' : '') + c.name })) : FUNCS.map(f => ({ v: f, l: ((SC[key] || []).includes(f) ? '✓ ' : '') + f }));
        sc += '<div style="margin-top:6px">' + h.opts(opts, '', { act: 'HQ22.scopePick' }) + '</div>';
      }
    } else sc += '<div class="small muted" style="margin-top:3px">일부 편집(◐) 칸을 누르면 어떤 정책이나 기능까지 되는지 보여요.</div>';
    const pd = s.hq22.pending;
    sc += '<div style="border-top:1px solid #e3dafc;margin-top:9px;padding-top:8px">' + rtitle('두 사람 확인') +
      (pd ? '<div class="small" style="margin-top:3px">' + '변경 ' + pd.diffs.length + '건이 승인을 기다려요. 올린 사람 ' + esc(pd.by) + '</div><ul class="small" style="margin:4px 0 0;padding-left:18px">' + pd.diffs.map(d => '<li>' + esc(d.t) + '</li>').join('') + '</ul>' +
        '<div class="row" style="margin-top:6px">' + h.btn('보호책임자 승인 (시연)', { sm: true, primary: true, act: 'HQ22.approve', arg: 'ok' }) + h.btn('반려', { sm: true, act: 'HQ22.approve', arg: 'no' }) + '</div>'
        : '<div class="small" style="margin-top:3px">권한을 바꾸면 바로 적용하지 않고 개인정보 보호책임자가 승인해야 반영돼요.</div>') + '</div>';
    const right = edit ? h.btn('취소', { sm: true, act: 'HQ22.cancelRole' }) + h.btn('변경 올리기', { sm: true, primary: true, act: 'HQ22.saveRole' }) : h.btn('권한 편집', { sm: true, act: 'HQ22.editRole', disabled: !!pd, title: pd ? '승인을 기다리는 변경이 있어요' : null });
    return '<div class="grid" style="grid-template-columns:minmax(0,1fr) 290px;gap:12px;align-items:start">' +
      h.card({ title: '역할·권한', sub: '역할 ' + ROLES.length + '개, 메뉴 권한 매트릭스' + (edit ? ' 편집 중' : ''), pin: 2, right, body: table + legend + (edit ? '<div class="small muted" style="margin-top:4px">칸을 누를 때마다 조회·편집, 일부 편집, 조회만, 숨김 순서로 바뀌어요. 슈퍼관리자의 계정·권한 칸은 바꿀 수 없어요.</div>' : '') }) +
      rbox(sc, 7) + '</div>';
  }
  function log22(ctx) {
    const s = ctx.s, ui = ctx.ui, f = { period: ui.lg_period || '최근 7일', kind: ui.lg_kind || '전체', user: ui.lg_user || '전체' };
    const rows = auditRows(ctx, f);
    const filters = '<div class="row" style="align-items:flex-end;gap:10px;margin-bottom:10px">' +
      '<div style="width:130px">' + h.field({ label: '기간', type: 'select', value: f.period, options: ['최근 7일', '최근 30일', '전체'], field: 'lg_period' }) + '</div>' +
      '<div style="width:150px">' + h.field({ label: '구분', type: 'select', value: f.kind, options: ['전체', '로그인', '다운로드', '마스킹 해제', '지원 모드 열람', '정책 변경', '권한·계정', '원생 정보', '파기'], field: 'lg_kind' }) + '</div>' +
      '<div style="width:120px">' + h.field({ label: '사용자', type: 'select', value: f.user, options: ['전체', '본사', '센터'], field: 'lg_user' }) + '</div>' +
      h.btn('검색', { primary: true, act: 'HQ22.search' }) + h.btn('엑셀', { act: 'HQ22.excel' }) + '<span class="small muted" style="margin-left:auto">' + rows.length + '건</span></div>';
    const strip = rbox('<div class="row between" style="flex-wrap:nowrap;gap:10px"><div>' + rtitle('원생 단위 접속기록') + '<div class="small" style="margin-top:2px">원생 정보를 보거나 고친 일은 원생 번호와 업무(조회, 수정, 삭제, 출력, 다운로드)로 남겨요. 이 화면을 검색하거나 내려받은 일도 기록돼요.</div></div>' +
      h.btn('원생 정보만 보기', { sm: true, act: 'HQ22.onlyStudent' }) + '</div>', 6, 'margin-bottom:10px');
    const table = h.table({
      cols: [
        { label: '일시', render: e => '<span class="mono small">' + esc(e.at) + '</span>' },
        { label: '사용자', render: e => esc(e.who) },
        { label: '구분', render: e => esc(kindOf(e.what) === '기타' ? e.what : e.what) },
        { label: '대상', render: e => targetCell(s, e) },
        { label: '업무', render: e => esc(taskOf(e.what)) },
        { label: '사유', render: e => esc(e.reason || '-') },
        { label: 'IP', render: e => '<span class="mono small">' + esc(ipOf(e)) + '</span>' },
      ],
      rows: rows.slice(0, 12), empty: '조건에 맞는 기록이 없어요.',
    });
    return h.card({ title: '감사 로그', sub: '접속기록 1년 이상 보관, 규모에 따라 2년 (법정)', pin: 3, right: h.polChip('POL-42'), body: filters + strip + table + (rows.length > 12 ? '<div class="small muted" style="margin-top:6px">최근 12건만 보여요. 나머지는 엑셀로 받아요.</div>' : '') });
  }
  // 점검 기간(c.from ~ c.to, MM-DD) 안의 기록만 월 점검 대상으로 봐요.
  const inCheck = (c, e) => { const d = String(e.at || '').slice(0, 5); return /^\d{2}-\d{2}$/.test(d) && d >= c.from && d <= c.to; };
  function selfRows(s) { const c = s.hq22.check; return s.audit.filter(e => inCheck(c, e) && /정본부|슈퍼관리자/.test(e.who || '')); }
  function check22(ctx) {
    const s = ctx.s, ui = ctx.ui, c = s.hq22.check, done = c.status === '완료';
    const maskN = s.audit.filter(e => inCheck(c, e) && /마스킹|지원 모드/.test(e.what)).length, mine = selfRows(s);
    const pol40 = h.polValue('POL-40'), decided = !['미정', '안'].includes(pol40.status);
    const rowItem = (label, ok, arg, dis) => '<div class="row between" style="padding:8px 0;border-bottom:1px solid var(--line-2);flex-wrap:nowrap"><span>' + label + '</span>' +
      (ok ? h.chip('확인 완료', 'ok') : h.btn('확인 완료', { sm: true, act: 'HQ22.ck', arg, disabled: dis })) + '</div>';
    let mBody = '<div class="row between" style="margin-bottom:6px"><b>' + esc(c.month) + ' 접속기록 점검</b>' + h.chip(done ? '완료 ' + c.done : '대기', done ? 'ok' : 'warn') + '</div>' +
      '<div class="row between" style="padding:8px 0;border-bottom:1px solid var(--line-2);flex-wrap:nowrap"><span>접속기록 살펴보기 <span class="small muted">' + esc(c.from + ' ~ ' + c.to) + '</span></span>' + h.btn('감사 로그 보기', { sm: true, act: 'HQ22.ckLog' }) + '</div>' +
      rowItem('개인정보 다운로드 사유 확인 <b>' + c.dl + '건</b> <span class="small muted">(원문 예시)</span>', c.dlOk, 'dl', done) +
      rowItem('마스킹 해제와 지원 모드 열람 사유 확인 <b>' + maskN + '건</b>', c.maskOk, 'mask', done);
    if (!done) {
      mBody += '<div class="row" style="align-items:flex-end;margin-top:10px;flex-wrap:nowrap"><div style="flex:1">' + h.field({ label: '점검자', type: 'select', value: ui.ck_checker || '개인정보 보호책임자 (지정 예정)', options: ['개인정보 보호책임자 (지정 예정)', '정본부 (슈퍼관리자)'], field: 'ck_checker', err: ui.ck_err }) + '</div>' +
        h.btn('점검 완료 기록', { primary: true, act: 'HQ22.ckDone' }) + '</div>';
    } else mBody += '<div class="small" style="margin-top:8px">' + esc(c.month) + ' 점검을 ' + esc(c.done) + '에 마쳤어요. 점검자 ' + esc(c.checker) + '. 다음 점검은 다음 달 초에 열려요.</div>';
    const selfBox = rbox(rtitle('점검자와 기록 주인 나누기') + '<div class="small" style="margin-top:3px">이번 점검 대상에 슈퍼관리자 기록이 <b>' + mine.length + '건</b> 있어요. 본인 기록이 있는 사람은 점검자가 될 수 없어요.</div>' +
      (mine.length ? '<ul class="small" style="margin:4px 0 0;padding-left:18px">' + mine.slice(0, 3).map(e => '<li>' + esc(e.at + ' ' + e.what + ', ' + (e.target || '')) + '</li>').join('') + '</ul>' : ''), 8);
    const L = s.hq22.ledger;
    let dBody = h.table({
      cols: [
        { label: '일자', render: d => esc(d.date || '-') },
        { label: '구분', render: d => '<b>' + esc(d.kind) + '</b>' },
        { label: '건수', num: true, render: d => '<span style="white-space:nowrap">' + (d.n == null ? '-' : h.num(d.n) + '명') + '</span>' },
        { label: '근거', render: d => esc(d.basis) },
        { label: '상태', render: d => h.chip(d.status, d.status === '파기 완료' ? 'ok' : d.status === '보관 중' ? 'info' : 'warn') + (d.notified ? '<div class="small muted">센터 알림 ' + esc(d.notified) + '</div>' : '') },
        { label: '', render: d => (d.status === '대상 추출' ? '<div class="row" style="gap:4px;flex-wrap:nowrap">' + h.btn('센터에 알림', { sm: true, act: 'HQ22.dNotify', arg: d.id, disabled: !!d.notified }) + h.btn('파기 실행', { sm: true, danger: decided, act: 'HQ22.dRun', arg: d.id, lock: !decided, disabled: !decided, title: decided ? null : '보관 기간(POL-40)이 정해지기 전에는 실행할 수 없어요' }) + '</div>' : '') },
      ],
      rows: L,
    });
    const twoStep = rbox(rtitle('두 단계 파기') + '<div class="grid g2" style="gap:10px;margin-top:6px"><div class="small"><b>지우는 것</b><div>연락처, 생년월일, 학습 기록</div></div><div class="small"><b>따로 5년 보관</b> ' + h.polChip('POL-41') + '<div>이름과 결제 내역 (접근 권한을 줄인 보관 영역)</div></div></div>' +
      '<div class="small" style="margin-top:6px">원생 보관 기간 ' + h.pv('POL-40') + (decided ? ' 정해졌어요. 실행할 수 있어요.' : ' 정해지기 전에는 대상만 뽑고 실제 파기는 잠가 둬요.') + '</div>', 9);
    return h.card({ title: '월 점검', sub: '접속기록과 다운로드 사유를 매달 점검 (법정)', pin: 4, body: '<div class="grid" style="grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start"><div>' + mBody + '</div>' + selfBox + '</div>' }) +
      '<div style="margin-top:12px">' + h.card({ title: '파기 대장', sub: '보관 기간이 끝난 정보를 지운 기록', pin: 5, right: h.polChip('POL-40') + h.polChip('POL-41'), body: dBody + '<div style="margin-top:10px">' + twoStep + '</div>' }) + '</div>';
  }
  function mini22(ctx, key) {
    const s = ctx.s, c = s.hq22.check, open = t => h.btn('열기', { sm: true, act: 'HQ22.tab', arg: t });
    if (key === 'acct') return h.card({ title: '본사 계정', pin: 1, right: open('acct'), body: h.table({ cols: [{ label: '이름', k: 'name' }, { label: '역할', k: 'role' }, { label: '2단계', render: a => (a.tf ? '사용' : '등록 전') }], rows: s.hq22.accounts.slice(0, 3) }) + '<div class="small muted" style="margin-top:6px">계정 ' + s.hq22.accounts.length + '개, 잠김 ' + s.hq22.accounts.filter(a => a.status === '잠김').length + '개</div>' });
    if (key === 'role') return h.card({ title: '역할·권한', pin: 2, body: '<div>역할 5개, 메뉴 권한 매트릭스 편집</div><div class="small muted" style="margin-top:2px">7쪽 매트릭스가 기본값' + (s.hq22.pending ? ', 승인 대기 1건' : '') + '</div><div style="margin-top:10px">' + h.btn('권한 편집', { act: 'HQ22.editRole', disabled: !!s.hq22.pending }) + '</div>' });
    if (key === 'log') { const r = auditRows(ctx, {}).slice(0, 2); return h.card({ title: '감사 로그', pin: 3, right: open('log'), body: '<div class="list">' + r.map(e => '<div class="small"><span class="mono">' + esc(e.at) + '</span> ' + esc(e.who) + ', ' + esc(e.what) + '</div>').join('') + '</div><div class="small muted" style="margin-top:4px">전체 ' + s.audit.length + '건</div>' }); }
    return h.card({ title: '월 점검·파기', pin: 4, right: open('check'), body: '<div class="stack" style="gap:6px"><div>' + esc(c.month) + ' 접속기록 점검 ' + h.chip(c.status === '완료' ? '완료' : '대기', c.status === '완료' ? 'ok' : 'warn') + (c.status === '완료' ? ' <span class="small muted">' + esc(c.done + ', 점검자 ' + c.checker) + '</span>' : '') + '</div>' +
      '<div>다운로드 ' + c.dl + '건 사유 확인 ' + h.chip(c.dlOk ? '완료' : '대기', c.dlOk ? 'ok' : 'warn') + '</div>' +
      '<div' + P(5) + ' style="padding-left:14px">파기 대상 퇴원생 ' + s.hq22.ledger[0].n + '명 (보관 기간 만료) ' + h.chip(s.hq22.ledger[0].status, s.hq22.ledger[0].status === '파기 완료' ? 'ok' : 'warn') + '</div></div>' });
  }

  B.screen({
    id: 'HQ-22', side: 'hq', phase: 'P1a', devices: ['pc'], pages: [42],
    title: '계정·권한·감사 로그', menuLabel: '계정·권한', crumb: '계정·권한 > 계정·권한·감사 로그',
    tabs: [{ id: 'acct', label: '본사 계정' }, { id: 'role', label: '역할·권한' }, { id: 'log', label: '감사 로그' }, { id: 'check', label: '월 점검·파기 대장' }],
    headActions: ctx => h.btn('+ 본사 계정', { primary: true, act: 'HQ22.newAcct', disabled: !ctx.canEdit }),
    render(ctx) {
      const t = ctx.tab || 'acct';
      const main = t === 'role' ? role22(ctx) : t === 'log' ? log22(ctx) : t === 'check' ? check22(ctx) : acct22(ctx);
      const others = ['acct', 'role', 'log', 'check'].filter(x => x !== t).map(x => mini22(ctx, x)).join('');
      return main + '<div class="grid g3" style="margin-top:12px;align-items:start">' + others + '</div>';
    },
    prd: {
      summary: '본사 직원 계정을 만들고 역할별 메뉴 권한을 정해요. 누가 언제 무엇을 했는지 남긴 감사 로그를 매달 점검하고, 보관 기간이 끝난 개인정보를 지운 기록을 남기는 곳이에요.',
      who: '본사 슈퍼관리자만 써요. 운영, 정산, 콘텐츠, SV에게는 메뉴가 보이지 않아요(7쪽 권한표).',
      items: [
        { n: 1, t: '본사 계정', d: '본사 계정은 모두 2단계 인증을 써요. 새 계정은 첫 로그인 때 인증 수단을 등록해야 열려요. 퇴사하거나 부서를 옮기면 바로 잠그고, 잠근 일도 감사 로그에 남아요.', ref: 'p.42 ①' },
        { n: 2, t: '역할·권한', d: '7쪽 권한표를 기본값으로 역할 5개의 메뉴별 권한을 고쳐요. 칸을 누를 때마다 조회·편집, 일부 편집, 조회만, 숨김 순서로 바뀌어요. 바꾼 일도 감사 로그에 남아요.', ref: 'p.42 ②' },
        { n: 3, t: '감사 로그', d: '로그인, 내려받기, 마스킹 해제, 지원 모드 열람, 정책 변경을 일시, 사용자, 대상, 사유, IP와 함께 남겨요. 기간, 구분, 사용자로 찾고 엑셀로 받아요. 접속기록은 1년 이상(규모에 따라 2년, 법정) 보관해요.', pol: ['POL-42'], ref: 'p.42 ③' },
        { n: 4, t: '월 점검', d: '매달 접속기록과 개인정보 다운로드 사유를 살펴보고 결과를 남겨요. 두 가지를 다 확인해야 점검 완료로 기록돼요. 원문 예시는 다운로드 42건의 사유를 확인했어요.', ref: 'p.42 ④' },
        { n: 5, t: '파기 대장', d: '보관 기간이 끝난 원생 정보를 지우고, 지운 날짜와 건수와 근거를 대장에 적어요. 영수증 같은 거래 증빙은 법정 기간(5년)을 채운 뒤 지워요. 원문 예시는 퇴원생 12명이에요.', pol: ['POL-40', 'POL-41'], ref: 'p.42 ⑤' },
        { n: 6, tab: 'log', t: '원생 단위 접속기록', kind: 'review', imp: 'IMP-14', d: '센터 직원이 원생 정보를 보거나 고친 일도 남겨요. 대상 칸에는 원생 번호를 저장하고 화면에서는 이름을 가려요. 업무 칸에 조회, 수정, 삭제, 출력, 다운로드 중 무엇을 했는지 적고, 감사 로그를 검색하거나 내려받은 일도 기록해요.' },
        { n: 7, tab: 'role', t: '일부 편집 범위와 두 사람 확인', kind: 'review', imp: 'IMP-14', d: '일부 편집 칸은 어떤 정책이나 기능까지 되는지 목록으로 정해요. 7쪽 예시처럼 정산 담당은 사용료 정책(POL-01~05)만 고쳐요. 권한을 바꾸면 바로 적용하지 않고 개인정보 보호책임자가 승인해야 반영돼요. 이 두 사람 확인은 p.42 검토 의견이에요.' },
        { n: 8, tab: 'check', t: '점검자와 기록 주인 나누기', kind: 'review', imp: 'IMP-14', d: '스스로 권한을 쓰고 스스로 점검하면 확인이 되지 않아요. 점검 기간에 본인 기록이 있는 사람은 점검자로 고를 수 없게 막고, 슈퍼관리자가 한 일은 따로 보여 줘요. p.42 검토 의견에서 나온 안이에요.' },
        { n: 9, tab: 'check', t: '두 단계 파기와 실행 잠금', kind: 'review', imp: 'IMP-07', d: '원생 정보를 지울 때 연락처와 학습 기록은 지우고, 증빙에 꼭 필요한 이름과 결제 내역만 따로 5년 보관해요. 보관 기간(POL-40)이 정해지기 전에는 대상만 뽑고 실제 파기는 잠가 둬요. 지우기 전에 센터에 먼저 알려요.', pol: ['POL-40', 'POL-41'] },
      ],
      open: ['원생 개인정보 보관 기간 (POL-40 미정)', '접속기록을 1년 보관할지 2년 보관할지', '본사가 볼 수 있는 원생 정보 범위 (POL-42 안)', '권한을 메뉴보다 더 잘게 나눌 단위', '개인정보 보호책임자를 누구로 둘지'],
      rules: ['접속기록은 1년 이상, 규모에 따라 2년 보관해요 (법정).', '접속기록과 개인정보 다운로드 사유는 매달 점검해요 (법정).', '거래 증빙은 5년 보관해요 (POL-41 법정).'],
    },
  });

  B.action('HQ22.tab', (ctx, v) => { B.state.tab = v || 'acct'; });
  B.action('HQ22.newAcct', ctx => { B.state.tab = 'acct'; ctx.ui.aform = true; ctx.ui.a_err_name = null; ctx.ui.a_err_login = null; });
  B.action('HQ22.closeAcct', ctx => { ctx.ui.aform = false; });
  B.action('HQ22.saveAcct', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui;
    if (deny(ctx)) return;
    if (isObj(arg)) { if (arg.name != null) ui.a_name = arg.name; if (arg.login != null) ui.a_login = arg.login; if (arg.role) ui.a_role = arg.role; }
    B.state.tab = 'acct'; ui.aform = true;
    const name = String(ui.a_name || '').trim(), login = String(ui.a_login || '').trim();
    ui.a_err_name = !name ? '이름을 넣어 주세요.' : null;
    ui.a_err_login = !login ? '아이디를 넣어 주세요.' : !/^[a-z][a-z0-9._-]{2,}$/.test(login) ? '영문 소문자로 시작하는 3자 이상으로 넣어 주세요.' : s.hq22.accounts.some(a => a.login === login) ? '이미 쓰는 아이디예요.' : null;
    if (ui.a_err_name || ui.a_err_login) return;
    const role = ui.a_role || '운영';
    s.hq22.accounts.push({ id: 'a' + (s.hq22.accounts.length + 1) + '-' + login, name, login, role, tf: false, status: '초대 중' });
    audit(ctx, '계정 생성', name + ' (' + role + ')', '신규 입사');
    ui.aform = false; ui.a_name = ''; ui.a_login = '';
    say(name + ' 계정을 만들었어요. 첫 로그인 때 2단계 인증을 등록해야 열려요.');
  });
  B.action('HQ22.lockAsk', (ctx, id) => { B.state.tab = 'acct'; ctx.ui.lock = id || null; ctx.ui.l_err = null; ctx.ui.l_reason = ''; });
  B.action('HQ22.lockReason', (ctx, v) => { ctx.ui.l_reason = v; ctx.ui.l_err = null; });
  B.action('HQ22.lock', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui;
    if (deny(ctx)) return;
    let id = arg, reason = ui.l_reason;
    if (isObj(arg)) { id = arg.id; reason = arg.reason; } else if (String(arg).indexOf('|') > 0) [id, reason] = String(arg).split('|');
    const a = s.hq22.accounts.find(x => x.id === id); if (!a) return;
    B.state.tab = 'acct'; ui.lock = a.id;
    if (!reason) { ui.l_err = '잠그는 이유를 골라 주세요.'; return; }
    a.status = '잠김'; a.lockReason = reason; ui.lock = null; ui.l_reason = '';
    audit(ctx, '계정 잠금', a.name + ' (' + a.role + ')', reason);
    say(a.name + ' 계정을 잠갔어요. 감사 로그에 남았어요.');
  });
  B.action('HQ22.unlock', (ctx, id) => {
    const a = ctx.s.hq22.accounts.find(x => x.id === id); if (!a || deny(ctx)) return;
    a.status = '2단계 재등록 대기'; a.tf = false; a.lockReason = '';
    audit(ctx, '계정 잠금 해제', a.name + ' (' + a.role + ')', '2단계 인증 다시 등록');
    say(a.name + ' 계정 잠금을 풀었어요. 2단계 인증을 다시 등록해야 써요.');
  });
  B.action('HQ22.editRole', ctx => {
    const s = ctx.s;
    if (deny(ctx)) return;
    if (s.hq22.pending) { say('승인을 기다리는 변경이 있어요.'); return; }
    B.state.tab = 'role';
    ctx.ui.edit = true; ctx.ui.draft = Object.assign({}, s.hq22.matrix); ctx.ui.dscope = JSON.parse(JSON.stringify(s.hq22.scopes));
  });
  B.action('HQ22.cancelRole', ctx => { ctx.ui.edit = false; });
  B.action('HQ22.cell', (ctx, key) => {
    const ui = ctx.ui;
    if (!ui.edit) { B.actions['HQ22.editRole'](ctx); if (!ui.edit) return; }
    const [row, i] = String(key).split('|'), idx = Number(i);
    if (row === 'account' && idx === 0) { say('슈퍼관리자의 계정·권한 메뉴는 끌 수 없어요.'); return; }
    const cur = ui.draft[row][idx], next = SYM[(SYM.indexOf(cur) + 1) % SYM.length];
    ui.draft[row] = ui.draft[row].slice(0, idx) + next + ui.draft[row].slice(idx + 1);
    if (next === '◐') { ui.scopeCell = key; ui.dscope[key] = ui.dscope[key] || []; }
  });
  B.action('HQ22.scope', (ctx, key) => { B.state.tab = 'role'; ctx.ui.scopeCell = key; });
  B.action('HQ22.scopePick', (ctx, v) => {
    const ui = ctx.ui, key = ui.scopeCell || 'policy|2'; if (!ui.edit) return;
    ui.scopeCell = key;
    const a = (ui.dscope[key] || []).slice(), i = a.indexOf(v);
    if (i >= 0) a.splice(i, 1); else a.push(v);
    ui.dscope[key] = a;
  });
  B.action('HQ22.saveRole', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui;
    if (deny(ctx)) return;
    if (!ui.edit) { ui.edit = true; ui.draft = Object.assign({}, s.hq22.matrix); ui.dscope = JSON.parse(JSON.stringify(s.hq22.scopes)); }
    if (isObj(arg) && Array.isArray(arg.changes)) {
      arg.changes.forEach(c => {
        const idx = ROLES.indexOf(c.role); if (idx < 0 || !ui.draft[c.row] || (c.row === 'account' && idx === 0)) return;
        ui.draft[c.row] = ui.draft[c.row].slice(0, idx) + c.to + ui.draft[c.row].slice(idx + 1);
        if (c.scope) ui.dscope[c.row + '|' + idx] = c.scope.slice();
      });
    }
    B.state.tab = 'role';
    const diffs = [];
    MROWS.forEach(([row, label]) => ROLES.forEach((r, i) => {
      const a = s.hq22.matrix[row][i], b = ui.draft[row][i], key = row + '|' + i;
      const sa = JSON.stringify(s.hq22.scopes[key] || []), sb = JSON.stringify(ui.dscope[key] || []);
      if (a !== b) diffs.push({ t: label + ', ' + r + ' ' + SYMT[a] + '에서 ' + SYMT[b] + (b === '◐' ? ' (' + scopeText(key, ui.dscope[key]) + ')' : '') });
      else if (b === '◐' && sa !== sb) diffs.push({ t: label + ', ' + r + ' 일부 편집 범위 ' + scopeText(key, ui.dscope[key]) });
    }));
    if (!diffs.length) { say('바뀐 칸이 없어요.'); return; }
    const noScope = [];
    MROWS.forEach(([row]) => ROLES.forEach((r, i) => { const key = row + '|' + i; if (ui.draft[row][i] === '◐' && s.hq22.matrix[row][i] !== '◐' && !(ui.dscope[key] || []).length) noScope.push(key); }));
    if (noScope.length) { ui.scopeCell = noScope[0]; say('일부 편집으로 바꾼 칸은 범위를 하나 이상 골라 주세요.'); return; }
    s.hq22.pending = { by: ctx.persona.name, diffs, draft: Object.assign({}, ui.draft), scopes: JSON.parse(JSON.stringify(ui.dscope)) };
    ui.edit = false;
    say('권한 변경 ' + diffs.length + '건을 올렸어요. 개인정보 보호책임자가 승인하면 반영돼요.');
  });
  B.action('HQ22.approve', (ctx, v) => {
    const s = ctx.s, pd = s.hq22.pending; if (!pd) return;
    B.state.tab = 'role';
    if (v === 'no') { s.hq22.pending = null; say('권한 변경을 반려했어요. 지금 권한은 그대로예요.'); return; }
    s.hq22.matrix = pd.draft; s.hq22.scopes = pd.scopes; s.hq22.pending = null;
    audit(ctx, '권한 변경', pd.diffs.map(d => d.t).join('; '), '보호책임자 승인');
    say('권한 변경을 반영했어요. 감사 로그에 남았어요.');
  });
  B.action('HQ22.ckLog', ctx => { B.state.tab = 'log'; ctx.ui.lg_period = '최근 30일'; ctx.ui.lg_kind = '전체'; ctx.ui.lg_user = '전체'; });
  B.action('HQ22.onlyStudent', ctx => { B.state.tab = 'log'; ctx.ui.lg_kind = '원생 정보'; ctx.ui.lg_period = '최근 30일'; });
  B.action('HQ22.search', (ctx, arg) => {
    const ui = ctx.ui;
    if (isObj(arg)) { if (arg.period) ui.lg_period = arg.period; if (arg.kind) ui.lg_kind = arg.kind; if (arg.user) ui.lg_user = arg.user; }
    B.state.tab = 'log';
    audit(ctx, '감사 로그 조회', '기간 ' + (ui.lg_period || '최근 7일') + ', 구분 ' + (ui.lg_kind || '전체') + ', 사용자 ' + (ui.lg_user || '전체'), '-');
  });
  function excel22(ctx, reason) {
    const ui = ctx.ui, n = auditRows(ctx, { period: ui.lg_period || '최근 7일', kind: ui.lg_kind || '전체', user: ui.lg_user || '전체' }).length;
    audit(ctx, '엑셀 다운로드', '감사 로그 ' + n + '건', reason);
    B.state.tab = 'log';
    say('감사 로그 ' + n + '건을 내려받았어요. 내려받은 일도 기록했어요.');
  }
  B.action('HQ22.excel', (ctx, arg) => {
    const reason = isObj(arg) ? arg.reason : (typeof arg === 'string' && arg ? arg : null);
    if (reason) { excel22(ctx, reason); return; }
    B.modal({
      title: '감사 로그 엑셀 받기', ok: '받기',
      body: '<div class="small">내려받는 이유를 골라요. 이 기록도 감사 로그에 남아요.</div>' + h.field({ label: '사유', type: 'select', id: 'hq22-xr', options: ['월 점검', '법무 요청', '수사기관 요청', '기타'], value: '월 점검' }),
      onOk: back => { excel22(B.ctx('HQ-22'), back.querySelector('#hq22-xr').value); },
    });
    return false;
  });
  B.action('HQ22.ck', (ctx, k) => { const c = ctx.s.hq22.check; B.state.tab = 'check'; if (c.status === '완료') return; if (k === 'dl') c.dlOk = true; if (k === 'mask') c.maskOk = true; ctx.ui.ck_err = null; });
  B.action('HQ22.ckDone', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui, c = s.hq22.check;
    if (deny(ctx)) return;
    if (isObj(arg) && arg.checker) ui.ck_checker = arg.checker;
    B.state.tab = 'check';
    const checker = ui.ck_checker || '개인정보 보호책임자 (지정 예정)';
    if (!c.dlOk || !c.maskOk) { ui.ck_err = '다운로드 사유와 마스킹 해제 사유를 모두 확인해 주세요.'; return; }
    const mine = selfRows(s).length;
    if (/슈퍼관리자/.test(checker) && mine) { ui.ck_err = '점검 대상에 본인 기록이 ' + mine + '건 있어요. 다른 사람이 점검해 주세요.'; return; }
    ui.ck_err = null;
    c.status = '완료'; c.done = md(ctx.today); c.checker = checker.replace(' (지정 예정)', '');
    s.hq22.checks.unshift({ month: c.month, done: c.done, checker: c.checker, dl: c.dl });
    audit(ctx, '접속기록 월 점검', c.month + ' 접속기록', '점검자 ' + c.checker);
    say(c.month + ' 접속기록 점검을 기록했어요.');
  });
  B.action('HQ22.dNotify', (ctx, id) => {
    const d = ctx.s.hq22.ledger.find(x => x.id === (id || 'd1')); if (!d || deny(ctx)) return;
    B.state.tab = 'check';
    d.notified = md(ctx.today);
    say('파기 대상 ' + d.n + '명을 센터에 먼저 알렸어요.');
  });
  B.action('HQ22.dRun', (ctx, id) => {
    const d = ctx.s.hq22.ledger.find(x => x.id === (id || 'd1')); if (!d || deny(ctx)) return;
    B.state.tab = 'check';
    const pol40 = h.polValue('POL-40');
    if (['미정', '안'].includes(pol40.status)) { say('보관 기간(POL-40)이 정해지기 전에는 파기할 수 없어요.'); return; }
    if (!d.notified) { say('센터에 먼저 알린 뒤 파기해요.'); return; }
    d.status = '파기 완료'; d.date = md(ctx.today);
    audit(ctx, '개인정보 파기', d.kind + ' ' + d.n + '명', d.basis);
    say(d.kind + ' ' + d.n + '명을 파기했어요. 이름과 결제 내역은 증빙 보관 영역으로 옮겼어요.');
  });

  /* ======================================================================
     HQ-23 통계·리포트 (p.43 위)
     ====================================================================== */
  function devRows(s) {
    const pr = (s.products || []).find(p => p.id === 'pr1'); if (!pr) return [];
    return live(s).filter(c => c.type !== '직영').map(c => {
      const price = (pr.centerPrice || {})[c.id];
      return { c, price, rec: pr.recommend, pct: price ? (price - pr.recommend) / pr.recommend * 100 : null, reason: s.hq23.reasons[c.id] || '', product: pr.name };
    });
  }
  const pctTxt = p => (p > 0 ? '+' : '') + p.toFixed(1) + '%';
  function barChart(vals, labels, o) {
    o = o || {};
    return '<div style="display:flex;align-items:flex-end;gap:7px;height:96px;border-bottom:1px solid var(--line);padding:0 2px">' +
      vals.map((v, i) => '<div style="flex:1;height:100%;display:flex;align-items:flex-end"><i style="display:block;width:100%;height:' + v + '%;border-radius:4px 4px 0 0;background:' + (o.lightFirst && i === 0 ? '#c3cde6' : 'var(--navy)') + '"></i></div>').join('') + '</div>' +
      '<div style="display:flex;gap:7px;padding:3px 2px 0">' + labels.map(l => '<div class="small muted" style="flex:1;text-align:center;font-size:10.5px">' + esc(l) + '</div>').join('') + '</div>';
  }
  function hbars(list, max) {
    return '<div class="stack" style="gap:6px">' + list.map(([k, v]) => '<div style="display:grid;grid-template-columns:96px minmax(0,1fr) 40px;gap:8px;align-items:center"><span class="small">' + esc(k) + '</span>' + h.bar(max ? v / max * 100 : 0) + '<span class="small mono" style="text-align:right">' + esc(v) + '</span></div>').join('') + '</div>';
  }

  B.screen({
    id: 'HQ-23', side: 'hq', phase: 'P2', devices: ['pc'], pages: [43], channelText: 'PC 웹',
    title: '통계·리포트', menuLabel: '통계·리포트', crumb: '통계·리포트',
    headActions: ctx => h.opts(['2027 상반기', '2027 하반기'], ctx.ui.period || '2027 상반기', { act: 'HQ23.period' }) + h.btn('엑셀', { act: 'HQ23.excel', pin: 6 }),
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, type = ui.type || '전체', half2 = (ui.period || '2027 상반기') === '2027 하반기';
      if (ui.row === undefined) ui.row = 'daechi1';
      let rows = half2 ? [] : s.hq23.rows.filter(r => type === '전체' || (type === '직영' ? cobj(s, r.center).type === '직영' : cobj(s, r.center).type !== '직영'));
      const dev = devRows(s), above = dev.filter(r => r.pct > 0), avg = above.length ? above.reduce((a, r) => a + r.pct, 0) / above.length : 0;
      const sv = ctx.role === 'SV';
      let html = '<div class="grid g3" style="align-items:stretch">';
      html += h.card({ title: '재원생 추이', pin: 1, right: h.opts(['전체', '직영', '가맹'], type, { act: 'HQ23.type' }), body: half2 ? h.empty('하반기 집계는 7월 말부터 쌓여요.') : barChart([54, 60, 66, 71, 76, 84], ['1월', '2월', '3월', '4월', '5월', '6월']) + '<div class="small muted" style="margin-top:6px">' + esc(type) + ' 센터 월말 재원생 (예시 그래프)</div>' });
      html += h.card({ title: '유지율 (등록 월별)', pin: 2, body: half2 ? h.empty('하반기 집계는 7월 말부터 쌓여요.') : barChart([94, 86, 84, 80, 78], ['1월 등록', '2월', '3월', '4월', '5월'], { lightFirst: true }) + '<div class="small muted" style="margin-top:6px">등록한 달 묶음이 남아 있는 비율 (예시 그래프)</div>' });
      html += h.card({
        title: '권장가 이탈', pin: 3, right: h.polChip('POL-11'),
        body: '<div style="font-size:15px;font-weight:700">가맹 ' + dev.length + '곳 중 ' + above.length + '곳 <span class="muted" style="font-weight:600">평균 ' + (above.length ? pctTxt(avg) : '0%') + '</span></div>' +
          '<div class="small muted">사유 ' + esc(above.map(r => r.reason).filter(Boolean).join(', ') || '-') + ', 대표 상품 ' + esc(dev[0] ? dev[0].product : '') + ' 기준</div>' +
          '<div style="margin-top:10px">' + rbox('<div class="row between" style="flex-wrap:nowrap;gap:8px"><span class="small"><b style="color:var(--review)">참고용, 평가에 쓰지 않아요</b><br>SV 점검과 갱신 거절 사유에도 쓰지 않아요.</span>' +
            h.btn(ui.dev ? '접기' : '센터별 보기', { sm: true, act: 'HQ23.dev', disabled: sv, title: sv ? 'SV 역할에게는 센터별 상세를 보여 주지 않아요' : null }) + '</div>', 5) + '</div>' +
          (ui.dev && !sv ? '<div style="margin-top:8px">' + h.table({ cols: [{ label: '센터', render: r => '<span style="white-space:nowrap">' + esc(r.c.name.replace('센터', '')) + '</span>' }, { label: '받는 값', num: true, render: r => '<span style="white-space:nowrap">' + (r.price ? won(r.price) : '-') + '</span>' }, { label: '차이', num: true, render: r => '<span style="white-space:nowrap">' + (r.pct == null ? '-' : pctTxt(r.pct)) + '</span>' }], rows: dev }) + '<div class="small muted" style="margin-top:4px">권장가 ' + won(dev[0] ? dev[0].rec : 0) + ' 기준</div></div>' : ''),
      });
      html += '</div>';
      const defs = ui.defs ? '<div style="margin-top:10px">' + h.table({
        cols: [{ label: '지표', k: 'k' }, { label: '계산식', k: 'f' }, { label: '기준일', k: 'd' }, { label: '출처', k: 'src' }],
        rows: [
          { k: '재원', f: '수강권과 학습 계정이 모두 켜진 학생 수 (HQ-01과 같은 정의)', d: '말일 23:59 자동 저장', src: 'CT-06, 월말 저장' },
          { k: '신규', f: '기간 안에 첫 수납을 마친 학생 수', d: '수납일', src: 'CT-07' },
          { k: '퇴원', f: '기간 안에 퇴원 처리한 학생 수, 사유 코드 필수', d: '퇴원일', src: 'CT-06' },
          { k: '유지율', f: '등록 월 묶음 중 등록 3개월(예시) 뒤에도 재원인 비율', d: '등록 월 + 3개월 말일', src: '월말 저장' },
        ],
      }) + '<div class="small muted" style="margin-top:6px">대시보드(HQ-01)의 재등록률은 재등록 대상 중 수납을 마친 비율이라 유지율과 숫자가 달라요.</div></div>' : '';
      html += h.card({
        title: '센터별 현황', sub: (ui.period || '2027 상반기') + ', 센터 단위 집계', cls: '',
        right: '<span' + P(4) + ' style="display:inline-flex">' + h.btn(ui.defs ? '지표 정의 접기' : '지표 정의', { sm: true, act: 'HQ23.defs' }) + '</span>',
        body: h.table({
          cols: [
            { label: '센터', render: r => '<b>' + esc(cname(s, r.center)) + '</b> ' + h.chip(cobj(s, r.center).type, cobj(s, r.center).type === '직영' ? 'navy' : 'brand') },
            { label: '재원', num: true, render: r => h.num(r.active) },
            { label: '신규', num: true, render: r => h.num(r.add) },
            { label: '퇴원', num: true, render: r => h.num(r.out) },
            { label: '유지율', num: true, render: r => r.keep + '%' },
            { label: '레벨 분포', render: r => '<span class="row" style="gap:4px">' + r.levels.map(([l, n]) => h.chip(l + ' ' + n, 'line')).join('') + '</span>' },
          ],
          rows, empty: half2 ? '하반기 집계는 7월 말부터 쌓여요.' : '이 유형에는 집계된 센터가 없어요.',
          rowAttr: r => ' class="click' + (ui.row === r.center ? ' sel' : '') + '" data-act="HQ23.row" data-arg="' + r.center + '"',
        }) + defs,
      }).replace(/^<section class="card "/, '<section class="card " style="margin-top:12px"');
      const sel = rows.find(r => r.center === ui.row);
      if (sel) {
        const rs = (s.ct21 && s.ct21.reasons && s.ct21.reasons[sel.center] ? s.ct21.reasons[sel.center].filter(x => x[1] > 0) : null) || s.hq23.outReasons[sel.center] || [];
        const maxL = Math.max.apply(null, sel.levels.map(x => x[1]));
        html += '<div class="grid g2" style="margin-top:12px;align-items:start">' +
          h.card({ title: cname(s, sel.center) + ' 퇴원 사유', sub: '퇴원 처리 때 고른 사유 코드', body: rs.length ? hbars(rs, Math.max.apply(null, rs.map(x => x[1]))) + '<div class="small muted" style="margin-top:6px">센터 통계(CT-21) 원문 예시 값이에요. 위 표의 퇴원 수와 집계 기준이 달라요.</div>' : h.empty('이 센터는 아직 사유 집계가 없어요.') }) +
          h.card({ title: cname(s, sel.center) + ' 레벨 분포', sub: '재원 ' + sel.active + '명', body: hbars(sel.levels, maxL) }) + '</div>';
      }
      return html;
    },
    prd: {
      summary: '센터별 재원생 수, 유지율, 가격 현황을 모아 보는 통계 화면이에요. 가맹 확대 단계(P2)에 만들고, 그 전에는 대시보드 지표로 대신해요.',
      who: '본사 슈퍼관리자, 운영, 정산이 쓰고 콘텐츠와 SV는 보기만 해요(7쪽 권한표).',
      items: [
        { n: 1, t: '재원생 추이', d: '센터와 유형(직영, 가맹)별로 달마다 재원생이 어떻게 바뀌는지 봐요. 유형 버튼을 누르면 아래 표도 함께 걸러져요. 1차에서는 대시보드(HQ-01) 지표로 대신해요.', ref: 'p.43 ①' },
        { n: 2, t: '유지율 (등록 월별)', d: '같은 달에 등록한 학생 묶음이 얼마나 남아 있는지와 퇴원 사유가 어떻게 나뉘는지 봐요. 표에서 센터 줄을 누르면 퇴원 사유와 레벨 분포가 펼쳐져요. 원문 예시는 대치1센터 92%, 대구수성센터 86%예요.', ref: 'p.43 ②' },
        { n: 3, t: '권장가 이탈', d: '가맹 센터가 권장 교습비와 다르게 받는 현황과 사유를 봐요. 원문 예시는 가맹 2곳 중 1곳, 평균 +11.5%, 사유 지역 시세예요. 가격을 강제하지 않고 참고만 해요.', pol: ['POL-11'], ref: 'p.43 ③' },
        { n: 4, t: '지표 정의 한곳에서', kind: 'review', imp: 'IMP-21', d: '재원, 신규, 퇴원, 유지율의 계산식과 기준일을 한 표로 보여 줘요. 대시보드(HQ-01)와 센터 통계(CT-21)도 같은 정의를 써야 숫자가 어긋나지 않아요.' },
        { n: 5, t: '권장가 이탈은 참고용', kind: 'review', imp: 'IMP-25', d: '이 숫자는 평가에 쓰지 않는다고 늘 보여 줘요. SV 점검과 갱신 거절 사유에도 쓰지 않고, SV 역할에게는 센터별 상세를 숨겨요. 가격을 묶는다는 오해를 막으려는 거예요.', pol: ['POL-11'] },
        { n: 6, t: '엑셀은 센터 집계만', kind: 'review', imp: 'IMP-04', d: '본사는 가맹 원생 정보를 맡아 처리하는 쪽이라 통계도 센터 단위 집계로만 내려받아요. 인원이 아주 적은 칸(예시 5명 미만)은 가리고, 내려받은 일과 사유를 감사 로그(HQ-22)에 남겨요.' },
      ],
      open: ['유지율과 재등록률 계산식', '권장 교습비 금액과 이탈 처리 (POL-11 미정)', '통계 작성을 개인정보 위탁 목적에 넣을지 (법무 확인)', '월말 자동 저장에 원생 상태, 레벨, 등록 월을 넣을지', '원문 예시끼리 숫자가 달라요. 이 화면은 대치1센터 상반기 퇴원 3명인데 CT-21 퇴원 사유는 합계 8건이에요. 같은 기간과 정의로 맞춰야 해요.'],
    },
  });
  B.action('HQ23.period', (ctx, v) => { ctx.ui.period = v; ctx.ui.row = null; });
  B.action('HQ23.type', (ctx, v) => { ctx.ui.type = v; ctx.ui.row = null; });
  B.action('HQ23.row', (ctx, id) => { ctx.ui.row = ctx.ui.row === id ? null : id; });
  B.action('HQ23.defs', ctx => { ctx.ui.defs = !ctx.ui.defs; });
  B.action('HQ23.dev', ctx => { if (ctx.role === 'SV') { say('SV 역할에게는 센터별 상세를 보여 주지 않아요.'); return; } ctx.ui.dev = !ctx.ui.dev; });
  function excel23(ctx, reason) {
    const period = ctx.ui.period || '2027 상반기';
    audit(ctx, '엑셀 다운로드', '통계 리포트 ' + period + ' (센터 집계)', reason);
    say('센터 집계 ' + period + ' 리포트를 내려받았어요. 감사 로그에 남았어요.');
  }
  B.action('HQ23.excel', (ctx, arg) => {
    const reason = isObj(arg) ? arg.reason : (typeof arg === 'string' && arg ? arg : null);
    if (reason) { excel23(ctx, reason); return; }
    B.modal({
      title: '통계 리포트 엑셀 받기', ok: '받기',
      body: '<label class="row small" style="gap:6px"><input type="radio" checked> 센터 단위 집계</label>' +
        '<label class="row small muted" style="gap:6px"><input type="radio" disabled> 원생 단위 (막혀 있어요. 본사는 집계만 받아요)</label>' +
        '<div class="small muted">인원이 5명(예시)보다 적은 칸은 가려서 내보내요.</div>' +
        h.field({ label: '사유', type: 'select', id: 'hq23-xr', options: ['운영 회의 자료', '가맹 지원', '기타'], value: '운영 회의 자료' }),
      onOk: back => { excel23(B.ctx('HQ-23'), back.querySelector('#hq23-xr').value); },
    });
    return false;
  });

  /* ======================================================================
     HQ-24 운영 점검(SV) (p.43 아래)
     ====================================================================== */
  const SVI = {
    fee: { t: '교습비 게시·광고 표시', pol: ['POL-12'] },
    cap: { t: '정원·교습시간 준수', pol: ['POL-15', 'POL-17'] },
    staff: { t: '종사자 경력 조회' },
    priv: { t: '개인정보 관리' },
    roll: { t: '재원생 명부·출석부 실사', review: true },
    rcpt: { t: '영수증 표본 대조', review: true },
  };
  const TPL = { v1: ['fee', 'cap', 'staff', 'priv'], v2: ['fee', 'cap', 'staff', 'priv', 'roll', 'rcpt'] };
  const RCHIP = { '적합': 'ok', '보완': 'warn', '재보완': 'bad', '해당 없음': 'line' };
  const visitOf = (ctx, id) => ctx.s.hq24.visits.find(v => v.id === (id || ctx.ui.sel)) || ctx.s.hq24.visits.find(v => v.id === 'v-0702') || ctx.s.hq24.visits[0];
  const ct23 = (s, id) => (s.ct23 && s.ct23.items || []).find(x => x.id === id);
  function staffInfo(s, cid) {
    const st = s.staff.filter(x => x.center === cid && !/퇴사/.test(x.status || ''));
    return { n: st.length, done: st.filter(x => x.check).length, miss: st.filter(x => !x.check).map(x => x.name) };
  }

  function checklist24(ctx, v) {
    const s = ctx.s, ui = ctx.ui, open = v.status === '예정', keys = TPL[v.tpl] || TPL.v1, later = TPL.v2.filter(k => !keys.includes(k));
    let firstReview = true;
    const row = (k, inner, extra, pin) => '<div' + P(pin) + ' style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px ' + (SVI[k].review ? '8px' : '0') + ';border-bottom:1px solid var(--line-2);' + (SVI[k].review ? 'background:#faf8ff;border-radius:6px;' : '') + '">' +
      '<div><span style="font-weight:600">' + esc(SVI[k].t) + '</span> ' + (SVI[k].pol || []).map(h.polChip).join(' ') + (SVI[k].review ? ' ' + h.chip('검토 반영', 'review') : '') + (extra || '') + '</div><div>' + inner + '</div></div>';
    let body = rbox('<span class="small"><b style="color:var(--review)">교습비는 교육청 등록액을 넘는지와 게시했는지만 봐요.</b> 권장 교습비와 다르게 받는 것은 점검하지 않아요.</span>', 5, 'margin-bottom:8px');
    keys.forEach(k => {
      const r = v.res[k], si = k === 'staff' ? staffInfo(s, v.center) : null;
      let extra = '';
      if (k === 'staff') extra = '<div' + P(6) + ' class="small" style="margin:7px 0 7px;padding-left:14px;color:var(--review)">교직원 계정(CT-20) 조회일 지금 ' + si.done + '/' + si.n + '명 입력, 결과 파일은 받지 않아요' + (open ? ' ' + h.btn('조회일로 판정', { sm: true, ghost: true, act: 'HQ24.staffAuto', arg: v.id }) : '') + '</div>';
      if (r === '보완' && v.memo[k]) extra += '<div class="small muted" style="margin-top:2px">' + esc(v.memo[k]) + '</div>';
      if (open && r === '보완') extra += '<div style="margin-top:4px">' + h.field({ value: ui['m_' + k] != null ? ui['m_' + k] : (v.memo[k] || ''), field: 'm_' + k, ph: '보완할 내용을 적어요 (필수)', err: (ui.v_err_memo || []).includes(k) ? '보완 이유를 적어 주세요.' : null }) + '</div>';
      const inner = open ? h.opts(['적합', '보완', '해당 없음'], r || '', { act: 'HQ24.judge' }).replace(/data-arg="([^"]*)"/g, (m, x) => 'data-arg="' + esc(v.id + '|' + k + '|' + x) + '"')
        : (r ? h.chip(r, RCHIP[r]) + (v.re[k] ? ' ' + h.chip('재점검 ' + v.re[k], RCHIP[v.re[k]]) : '') : '<span class="muted">-</span>');
      let pin = null;
      if (SVI[k].review && firstReview) { pin = 4; firstReview = false; }
      body += row(k, inner, extra, pin);
    });
    if (later.length) {
      body += '<div' + P(firstReview ? 4 : null) + ' style="margin-top:8px;padding:8px 10px;border:1px dashed #d9ccfa;border-radius:8px;background:#faf8ff"><div class="small" style="color:var(--review);font-weight:700">다음 점검부터 들어가는 항목 (템플릿 v2)</div>' +
        '<div class="row" style="gap:4px;margin-top:4px">' + later.map(k => h.chip(SVI[k].t, 'review')).join('') + '</div></div>';
    }
    if (open) body += errLine(ui.v_err) + '<div class="row between" style="margin-top:10px"><span class="small muted">모든 항목을 기록해야 마칠 수 있어요.</span>' + h.btn('점검 완료', { primary: true, act: 'HQ24.finish', arg: v.id, disabled: !ctx.canEdit }) + '</div>';
    return h.card({ title: '체크리스트', sub: cname(s, v.center) + ' ' + md(v.date) + ', 템플릿 ' + v.tpl + ' (예시)', pin: 2, body });
  }
  function flow24(ctx, v) {
    const s = ctx.s, keys = Object.keys(v.res).filter(k => v.res[k] === '보완');
    let body;
    if (!keys.length) {
      body = h.steps([{ label: '보완 요청' }, { label: '센터 회신 (CT-23)' }, { label: '재점검' }, { label: '적합' }]) +
        '<div class="small muted" style="margin-top:6px">' + (v.status === '예정' ? '점검을 마치면 보완 항목이 센터 회신 화면(CT-23)으로 넘어가요.' : '이 점검에는 보완 항목이 없어요.') + '</div>';
    } else {
      body = keys.map(k => {
        const it = ct23(s, v.link[k]), st = it ? it.status : '보완 요청';
        const stage = st === '적합' ? 4 : st === '재보완' ? 1 : st === '회신 완료' ? 2 : 1;
        let html = '<div style="padding:8px 0;border-bottom:1px solid var(--line-2)"><div class="row between"><b>' + esc(SVI[k].t) + '</b>' + h.chip(st, st === '적합' ? 'ok' : st === '회신 완료' ? 'info' : st === '재보완' ? 'bad' : 'warn') + '</div>' +
          h.steps([{ label: '보완 요청 ' + md(v.date) }, { label: '센터 회신 (CT-23)' }, { label: '재점검' }, { label: '적합' }].map((x, i) => ({ label: x.label, state: i < stage ? 'done' : i === stage ? 'cur' : '' }))) +
          (it ? '<div class="small muted">보완 기한 ' + esc(md(it.due)) + ' (점검 뒤 14일, 예시)' + (it.reply ? ', 센터 회신 ' + esc(it.reply.text) : '') + '</div>' : '');
        if (it && st === '회신 완료') html += '<div class="row" style="margin-top:6px">' + h.btn('재점검 적합', { sm: true, primary: true, act: 'HQ24.recheck', arg: v.id + '|' + k + '|적합', disabled: !ctx.canEdit }) + h.btn('재보완 요청', { sm: true, act: 'HQ24.recheck', arg: v.id + '|' + k + '|재보완', disabled: !ctx.canEdit }) + '</div>';
        else if (it && (st === '보완 요청' || st === '재보완')) html += '<div class="row" style="margin-top:6px">' + h.btn('센터 화면에서 보기 (CT-23)', { sm: true, act: 'HQ24.toCenter', arg: v.center }) + '</div>';
        return html + '</div>';
      }).join('');
    }
    return h.card({ title: '보완 요청', sub: '센터 회신과 재점검', pin: 3, body });
  }

  B.screen({
    id: 'HQ-24', side: 'hq', phase: 'P2', devices: ['pc', 'tablet'], pages: [43], channelText: 'PC 웹·태블릿',
    title: '운영 점검(SV)', menuLabel: '운영 점검(SV)', crumb: '운영 점검(SV)',
    headActions: ctx => h.btn('+ 점검 일정', { primary: true, act: 'HQ24.newVisit', disabled: !ctx.canEdit }),
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, v = visitOf(ctx);
      let html = '';
      if (ui.vform) {
        const F = live(s).filter(c => c.type !== '직영');
        html += h.card({
          title: '새 점검 일정', right: h.btn('닫기', { sm: true, act: 'HQ24.closeVisit' }),
          body: '<div class="grid g3">' + h.field({ label: '센터', type: 'select', value: ui.n_center || F[0].id, options: F.map(c => ({ v: c.id, l: c.name })), field: 'n_center' }) +
            h.field({ label: '일자', req: true, type: 'date', value: ui.n_date || '', field: 'n_date', err: ui.n_err }) +
            h.field({ label: 'SV', type: 'select', value: ui.n_sv || '정유나', options: ['정유나', '최민호'], field: 'n_sv' }) + '</div>' +
            '<div class="row between" style="margin-top:10px"><span class="small muted">새 일정은 검토 반영 템플릿 v2로 점검해요.</span>' + h.btn('일정 저장', { primary: true, act: 'HQ24.addVisit' }) + '</div>',
        }).replace(/^<section class="card "/, '<section class="card " style="margin-bottom:12px"');
      }
      html += '<div class="grid g2" style="align-items:start">' +
        h.card({
          title: '일정', pin: 1,
          body: h.table({
            cols: [{ label: '일자', render: x => '<span class="mono">' + esc(md(x.date)) + '</span>' }, { label: '센터', render: x => esc(cname(s, x.center)) }, { label: 'SV', k: 'sv' }, { label: '상태', render: x => h.chip(x.status, x.status === '완료' ? 'ok' : 'info') }],
            rows: s.hq24.visits, rowAttr: x => ' class="click' + (x.id === v.id ? ' sel' : '') + '" data-act="HQ24.select" data-arg="' + x.id + '"',
          }) + '<div class="small muted" style="margin-top:6px">일정을 누르면 오른쪽에 그날 체크리스트가 열려요. 현장에서는 태블릿으로 기록해요.</div>',
        }) + checklist24(ctx, v) + '</div>';
      html += '<div style="margin-top:12px">' + flow24(ctx, v) + '</div>';
      return html;
    },
    prd: {
      summary: 'SV(가맹점 운영 점검 담당)가 센터를 찾아가 법과 본사 기준을 지키는지 점검하고, 보완할 일을 센터에 보내 다시 점검하는 화면이에요. 현장에서는 태블릿으로 기록해요.',
      who: '본사 SV와 슈퍼관리자가 쓰고 운영은 보기만 해요. 정산과 콘텐츠에게는 메뉴가 보이지 않아요(7쪽 권한표).',
      items: [
        { n: 1, t: '점검 일정', d: '담당 SV가 센터 방문 일정을 잡고 예정, 완료로 관리해요. 일정을 누르면 그날 체크리스트가 열려요. 원문 예시는 07-15 대구수성센터 예정, 07-02 부산해운대센터 완료예요.', ref: 'p.43 ①' },
        { n: 2, t: '체크리스트', d: '교습비 게시와 광고 표시, 정원과 교습시간, 종사자 경력 조회, 개인정보 관리를 적합이나 보완으로 기록해요. 모든 항목을 기록해야 점검을 마칠 수 있고, 보완에는 이유를 꼭 적어요.', pol: ['POL-12', 'POL-15', 'POL-17'], ref: 'p.43 ②' },
        { n: 3, t: '보완 요청', d: '보완 항목은 센터 회신 화면(CT-23)으로 바로 넘어가요. 센터가 고친 내용을 회신하면 SV가 다시 점검해 적합이나 재보완으로 닫아요. 보완 기한은 점검 뒤 14일(예시)이에요.', ref: 'p.43 ③' },
        { n: 4, t: '명부 실사와 영수증 대조', kind: 'review', imp: 'IMP-30', d: '원생 수를 센터 입력만 믿으면 사용료가 샐 수 있어요. 다음 점검부터 재원생 명부와 출석부 실사, 영수증 표본 대조를 체크리스트에 넣어요. 어느 판 체크리스트로 점검했는지(템플릿 버전)도 함께 남겨요.' },
        { n: 5, t: '권장가 이탈은 점검하지 않아요', kind: 'review', imp: 'IMP-25', d: '교습비는 교육청 등록액을 넘는지와 게시했는지만 봐요. 권장 교습비와 다르게 받는 것은 점검 항목에서 빼서 가격을 묶는다는 오해를 막아요.', pol: ['POL-11', 'POL-12'] },
        { n: 6, t: '경력 조회는 조회일로 확인', kind: 'review', imp: 'IMP-16', d: '범죄 경력 조회 결과는 아주 민감한 정보예요. 결과 파일을 받지 않고 교직원 계정(CT-20)의 조회일이 모두 들어 있는지만 확인해요. 조회일로 판정 버튼을 누르면 빠진 사람이 있을 때 보완으로 적어요.' },
      ],
      open: ['체크리스트 항목을 누가 고치는지와 판정 기준', '점검 주기와 보완 기한 (CT-23 예시 14일)', '보완을 되풀이할 때의 조치', '현장에서 인터넷이 끊길 때 임시 저장 방법'],
    },
  });
  B.action('HQ24.select', (ctx, id) => { ctx.ui.sel = id; ctx.ui.v_err = null; ctx.ui.v_err_memo = []; });
  B.action('HQ24.newVisit', ctx => { ctx.ui.vform = true; ctx.ui.n_err = null; });
  B.action('HQ24.closeVisit', ctx => { ctx.ui.vform = false; });
  B.action('HQ24.addVisit', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui;
    if (deny(ctx)) return;
    if (isObj(arg)) { if (arg.center) ui.n_center = arg.center; if (arg.date) ui.n_date = arg.date; if (arg.sv) ui.n_sv = arg.sv; }
    ui.vform = true;
    const F = live(s).filter(c => c.type !== '직영');
    const center = ui.n_center || F[0].id, date = ui.n_date || '';
    ui.n_err = !isDate(date) ? '점검 일자를 골라 주세요.' : s.hq24.visits.some(x => x.center === center && x.date === date) ? '같은 날 같은 센터 점검이 이미 있어요.' : null;
    if (ui.n_err) return;
    s.hq24.seq += 1;
    const v = { id: 'v-new' + s.hq24.seq, date, center, sv: ui.n_sv || '정유나', status: '예정', tpl: 'v2', res: {}, memo: {}, link: {}, re: {} };
    s.hq24.visits.push(v); s.hq24.visits.sort((a, b) => b.date.localeCompare(a.date));
    ui.vform = false; ui.sel = v.id; ui.n_date = '';
    say(cname(s, center) + ' ' + md(date) + ' 점검 일정을 잡았어요.');
  });
  B.action('HQ24.judge', (ctx, arg) => {
    const [vid, k, r] = isObj(arg) ? [arg.visit, arg.item, arg.result] : String(arg).split('|');
    const v = visitOf(ctx, vid); if (!v || v.status !== '예정') return;
    v.res[k] = r; ctx.ui.sel = v.id; ctx.ui.v_err = null;
    if (r !== '보완') ctx.ui.v_err_memo = (ctx.ui.v_err_memo || []).filter(x => x !== k);
  });
  B.action('HQ24.staffAuto', (ctx, vid) => {
    const v = visitOf(ctx, vid); if (!v || v.status !== '예정') return;
    const si = staffInfo(ctx.s, v.center);
    if (!si.miss.length) { v.res.staff = '적합'; say('모든 종사자의 조회일이 들어 있어서 적합으로 적었어요.'); }
    else { v.res.staff = '보완'; v.memo.staff = '조회일이 없는 종사자 ' + si.miss.join(', '); ctx.ui.m_staff = v.memo.staff; say('조회일이 없는 종사자가 있어 보완으로 적었어요.'); }
    ctx.ui.sel = v.id;
  });
  B.action('HQ24.finish', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui;
    if (deny(ctx)) return;
    const vid = isObj(arg) ? arg.visit : arg, v = visitOf(ctx, vid); if (!v || v.status !== '예정') return;
    if (isObj(arg)) { Object.assign(v.res, arg.results || {}); Object.keys(arg.memo || {}).forEach(k => { ui['m_' + k] = arg.memo[k]; }); }
    ui.sel = v.id;
    const keys = TPL[v.tpl] || TPL.v1, miss = keys.filter(k => !v.res[k]);
    Object.keys(v.res).forEach(k => { if (ui['m_' + k] != null) v.memo[k] = String(ui['m_' + k]).trim(); });
    const noMemo = keys.filter(k => v.res[k] === '보완' && !v.memo[k]);
    ui.v_err = miss.length ? '아직 기록하지 않은 항목이 ' + miss.length + '개 있어요 (' + miss.map(k => SVI[k].t).join(', ') + ').' : null;
    ui.v_err_memo = noMemo;
    if (miss.length || noMemo.length) { if (!ui.v_err) ui.v_err = '보완 항목에는 이유를 적어 주세요.'; return; }
    v.status = '완료';
    const fix = keys.filter(k => v.res[k] === '보완');
    if (!s.ct23) s.ct23 = { items: [], files: {} };
    fix.forEach(k => {
      const id = 'sv-' + v.id + '-' + k;
      s.ct23.items.push({ id, date: v.date, item: SVI[k].t, result: '보완', due: addDays(v.date, 14), status: '보완 요청', sv: v.sv, memo: v.memo[k], reply: null, center: v.center });
      v.link[k] = id;
    });
    keys.filter(k => v.res[k] === '적합').forEach(k => { delete ui['m_' + k]; });
    say(fix.length ? '점검을 마쳤어요. 보완 ' + fix.length + '건을 센터 회신 화면(CT-23)으로 보냈어요.' : '점검을 마쳤어요. 모든 항목이 적합이에요.');
  });
  B.action('HQ24.recheck', (ctx, arg) => {
    const s = ctx.s;
    if (deny(ctx)) return;
    const [vid, k, r] = isObj(arg) ? [arg.visit, arg.item, arg.result] : String(arg).split('|');
    const v = visitOf(ctx, vid), it = v && ct23(s, v.link[k]); if (!it) return;
    if (r === '적합') { it.status = '적합'; it.result = '적합'; it.memo = ''; v.re[k] = '적합'; say('재점검 결과 적합으로 닫았어요.'); }
    else { it.status = '재보완'; it.result = '재보완'; v.re[k] = '재보완'; say('재보완을 요청했어요. 센터가 다시 회신해요.'); }
    ctx.ui.sel = v.id;
  });
  B.action('HQ24.toCenter', (ctx, cid) => { const pid = cid === 'daegu' ? 'ct:daegu:원장' : cid === 'busan' ? 'ct:busan:원장' : 'ct:daechi1:원장'; B.state.mode = 'free'; B.go('CT-23', { persona: pid, device: 'pc' }); return false; });

  /* ======================================================================
     HQ-25 교육·인증 (p.44 위)
     ====================================================================== */
  const TROLES = { '원장': ['원장'], '교사·보조': ['교사', '보조교사'], '원장·실장': ['원장', '실장·데스크'], '전체': ['원장', '실장·데스크', '교사', '보조교사'] };
  const peopleOf = (s, course) => s.staff.filter(x => (TROLES[course.target] || []).includes(x.role) && !/퇴사/.test(x.status || ''));
  const centersWithStaff = s => s.centers.filter(c => s.staff.some(x => x.center === c.id));
  function certOf(s, cid) {
    const cc = s.hq25.courses.find(c => c.cert);
    return s.staff.filter(x => x.center === cid && ['원장', '실장·데스크'].includes(x.role) && cc && cc.done[x.id]);
  }

  B.screen({
    id: 'HQ-25', side: 'hq', phase: 'P2', devices: ['pc'], pages: [44],
    title: '교육·인증', menuLabel: '교육·인증', crumb: '교육·인증',
    headActions: ctx => h.btn('+ 과정', { primary: true, act: 'HQ25.newCourse', disabled: !ctx.canEdit }),
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, C = s.hq25.courses;
      if (ui.course === undefined) ui.course = 'c3';
      let left = '';
      if (ui.cform) {
        left += '<div class="card" style="background:#fafbfc;margin-bottom:12px"><div class="card-h"><h3>새 과정</h3><div class="r">' + h.btn('닫기', { sm: true, act: 'HQ25.closeCourse' }) + '</div></div>' +
          '<div class="grid" style="grid-template-columns:minmax(0,1fr) 150px;gap:10px">' + h.field({ label: '과정 이름', req: true, value: ui.c_name || '', field: 'c_name', err: ui.c_err }) +
          h.field({ label: '대상', type: 'select', value: ui.c_target || '전체', options: Object.keys(TROLES), field: 'c_target' }) + '</div>' +
          '<div class="row between" style="margin-top:10px">' + chk('c_must', ui.c_must !== false, '필수 과정이에요') + h.btn('과정 만들기', { primary: true, act: 'HQ25.addCourse' }) + '</div></div>';
      }
      left += h.table({
        cols: [
          { label: '과정', render: c => '<b>' + esc(c.name) + '</b>' + (c.cert ? ' ' + h.chip('상담 권한 조건', 'info') : '') },
          { label: '대상', k: 'target' },
          { label: '필수', render: c => (c.must ? '●' : '') },
          { label: '이수', render: c => { const p = peopleOf(s, c), d = p.filter(x => c.done[x.id]).length; return '<div style="display:flex;gap:8px;align-items:center;min-width:120px"><span class="mono">' + d + '/' + p.length + '</span><div style="flex:1">' + h.bar(p.length ? d / p.length * 100 : 0) + '</div></div>'; } },
        ],
        rows: C, rowAttr: c => ' class="click' + (ui.course === c.id ? ' sel' : '') + '" data-act="HQ25.course" data-arg="' + c.id + '"',
      }) + '<div class="small muted" style="margin-top:6px">원문 예시는 3/3, 8/11, 2/4예요. 화면 숫자는 지금 등록된 교직원으로 세요. 1차에서는 교직원 계정(CT-20)의 이수 칸으로 대신해요.</div>';
      const c = C.find(x => x.id === ui.course);
      if (c) {
        const ppl = peopleOf(s, c);
        left += '<div class="card" style="margin-top:12px;background:#fafbfc"><div class="card-h"><h3>' + esc(c.name) + '</h3><span class="sub">대상 ' + esc(c.target) + ' ' + ppl.length + '명</span><div class="r">' + h.btn('닫기', { sm: true, act: 'HQ25.course', arg: c.id }) + '</div></div>' +
          h.table({
            cols: [
              { label: '이름', render: x => '<b>' + esc(x.name) + '</b>' },
              { label: '센터', render: x => esc(cname(s, x.center)) },
              { label: '역할', k: 'role' },
              { label: '이수', render: x => (c.done[x.id] ? h.chip(c.done[x.id] === '이수' ? '이수' : '이수 ' + c.done[x.id], 'ok') : h.chip('미이수', 'bad')) },
            ].concat(c.cert ? [{ label: '상담 권한 (CT-03)', render: x => (c.done[x.id] ? h.chip('있음', 'ok') : (s.hq25.temp[x.center] && s.hq25.temp[x.center].who === x.name ? h.chip('임시 ~' + md(s.hq25.temp[x.center].until), 'review') : '<span class="muted">없음</span>')) }] : [])
              .concat([{ label: '', render: x => h.btn(c.done[x.id] ? '취소' : '이수 처리', { sm: true, act: 'HQ25.done', arg: c.id + '|' + x.id, disabled: !ctx.canEdit }) }]),
            rows: ppl, empty: '대상자가 없어요.',
          }) + '</div>';
      }
      // 인증과 권한
      const CW = centersWithStaff(s);
      const certRows = CW.map(cc => ({ c: cc, who: certOf(s, cc.id), temp: s.hq25.temp[cc.id] }));
      const need = certRows.filter(r => !r.who.length);
      let cert = '<div class="list">' + certRows.map(r => '<div style="flex-wrap:wrap"><b style="min-width:92px">' + esc(r.c.name.replace('센터', '')) + '</b>' +
        (r.who.length ? r.who.map(x => h.chip(x.name, 'ok')).join(' ') : h.chip('상담할 사람 없음', 'bad')) + (r.temp ? ' ' + h.chip('임시 ' + r.temp.who + ' ~' + md(r.temp.until), 'review') : '') + '</div>').join('') + '</div>' +
        '<div class="small muted" style="margin-top:6px">인증 없는 사람은 입학 테스트 결과 상담(CT-03)을 할 수 없어요.</div>';
      let temp = rtitle('인증자가 없는 센터의 임시 권한');
      if (!need.length) temp += '<div class="small" style="margin-top:3px">지금은 모든 센터에 인증자가 있어요.</div>';
      need.forEach(r => {
        temp += '<div style="margin-top:6px"><div class="small"><b>' + esc(r.c.name) + '</b> 원장 ' + esc(r.c.director) + '</div>';
        if (r.temp) temp += '<div class="row between small" style="margin-top:3px"><span>' + esc(md(r.temp.until)) + '까지, 사유 ' + esc(r.temp.reason) + '</span>' + h.btn('거두기', { sm: true, act: 'HQ25.tempEnd', arg: r.c.id, disabled: !ctx.canEdit }) + '</div>';
        else if (ui.temp === r.c.id) temp += '<div style="margin-top:4px">' + h.field({ value: ui.t_reason || '', field: 't_reason', ph: '사유, 예) 인증 교육 4월 예정', err: ui.t_err }) + '<div class="row" style="justify-content:flex-end;margin-top:4px">' + h.btn('취소', { sm: true, act: 'HQ25.tempAsk', arg: '' }) + h.btn('30일(예시) 허용', { sm: true, primary: true, act: 'HQ25.tempGive', arg: r.c.id }) + '</div></div>';
        else temp += '<div class="row" style="margin-top:3px">' + h.btn('임시 권한 주기', { sm: true, act: 'HQ25.tempAsk', arg: r.c.id, disabled: !ctx.canEdit }) + '</div>';
        temp += '</div>';
      });
      // 미이수 알림과 오픈 전 교육
      const musts = C.filter(x => x.must), missing = [];
      musts.forEach(x => peopleOf(s, x).forEach(p => { if (!x.done[p.id]) missing.push({ c: x, p }); }));
      const planned = s.centers.filter(x => x.status === '계획');
      // 한 사람이 필수 과정 여러 개를 못 들었으면 한 번만 센다 (알림은 과정마다 나가요)
      const missWho = missing.map(m => m.p).filter((p, i, a) => a.findIndex(q => q.id === p.id) === i);
      let remind = rtitle('미이수 알림과 오픈 전 교육') + '<div class="small" style="margin-top:3px">필수 과정 미이수 ' + missWho.length + '명, ' + missing.length + '건' + (missWho.length ? ' (' + esc(missWho.map(p => p.name).join(', ')) + ')' : '') + '</div>' +
        planned.map(x => '<div class="small" style="margin-top:3px">' + esc(x.name) + ' 원장 ' + esc(x.director) + '은 센터 운영 기본을 아직 듣지 않았어요. 운영을 시작하기 전에 마치도록 알려요.</div>').join('') +
        '<div class="row between" style="margin-top:6px">' + (s.hq25.reminded ? small('마지막 알림 ' + s.hq25.reminded) : '<span></span>') + h.btn('미이수자에게 알림', { sm: true, act: 'HQ25.remind', disabled: !ctx.canEdit || !missing.length }) + '</div>';
      return '<div class="grid g-side" style="align-items:start">' + h.card({ title: '과정·이수', sub: '과정을 누르면 대상자 명단이 열려요', pin: 1, body: left }) +
        '<div class="stack">' + h.card({ title: '인증과 권한', pin: 2, right: h.polChip('POL-26'), body: cert }) + rbox(temp, 3) + rbox(remind, 4) + '</div></div>';
    },
    prd: {
      summary: '원장과 교사가 꼭 들어야 하는 교육과 이수 현황, 검사 해석 상담자 인증을 관리하는 화면이에요. 인증이 있어야 입학 테스트 결과 상담을 할 수 있어요.',
      who: '7쪽 권한표에 교육·인증 줄이 없어요. 프로토타입에서는 공지·자료실·1:1 문의 줄을 따라 슈퍼관리자, 운영, 콘텐츠, SV가 쓰고 정산은 보기만 해요.',
      items: [
        { n: 1, t: '과정·이수', d: '과정마다 대상, 필수 여부, 이수 인원을 봐요. 과정을 누르면 대상자 명단이 펼쳐지고 이수 처리를 해요. 원문 예시는 3/3, 8/11, 2/4이고, 화면 숫자는 지금 등록된 교직원으로 세요. 1차에서는 교직원 계정(CT-20)의 이수 칸으로 대신해요.', ref: 'p.44 ①' },
        { n: 2, t: '인증과 권한', d: '검사 해석 상담자 인증을 받은 사람만 입학 테스트 결과 상담(CT-03)을 할 수 있어요. 센터마다 상담할 수 있는 사람을 보여 주고, 아무도 없으면 빨갛게 알려요.', pol: ['POL-26'], ref: 'p.44 ②' },
        { n: 3, t: '인증자가 없는 센터의 임시 권한', kind: 'review', imp: 'IMP-14', d: '인증자가 한 명도 없으면 그 센터는 결과 상담을 못 해요. 본사가 사유를 남기고 기간을 정해(예시 30일) 원장에게 임시 권한을 줘요. 기간이 끝나거나 원장이 인증을 받으면 풀리고, 준 일은 감사 로그에 남아요. p.44 검토 의견에서 나온 안이에요.' },
        { n: 4, t: '미이수 알림과 오픈 전 교육', kind: 'review', imp: 'IMP-17', d: '검토 의견은 문을 열기 전에 원장, 실장, 교사 교육을 마치자고 해요. 필수 교육을 마치지 않은 사람에게 알림을 보내고, 문을 열 준비 중인 센터 원장은 운영을 시작하기 전에 마치도록 따로 보여 줘요.' },
      ],
      open: ['교육 과정 목록, 인증 유효 기간, 재교육 주기', '입학 테스트 검사 버전 (POL-26 미정)에 따라 인증 교육 내용이 바뀌는지', '7쪽 권한표에 교육·인증 줄을 넣을지와 누가 과정을 만들지'],
    },
  });
  B.action('HQ25.newCourse', ctx => { ctx.ui.cform = true; ctx.ui.c_err = null; });
  B.action('HQ25.closeCourse', ctx => { ctx.ui.cform = false; });
  B.action('HQ25.addCourse', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui;
    if (deny(ctx)) return;
    if (isObj(arg)) { if (arg.name != null) ui.c_name = arg.name; if (arg.target) ui.c_target = arg.target; if (arg.must != null) ui.c_must = !!arg.must; }
    ui.cform = true;
    const name = String(ui.c_name || '').trim();
    ui.c_err = !name ? '과정 이름을 넣어 주세요.' : s.hq25.courses.some(c => c.name === name) ? '같은 이름의 과정이 있어요.' : null;
    if (ui.c_err) return;
    const c = { id: 'c' + (s.hq25.courses.length + 1), name, target: ui.c_target || '전체', must: ui.c_must !== false, done: {} };
    s.hq25.courses.push(c);
    ui.cform = false; ui.c_name = ''; ui.course = c.id;
    say(name + ' 과정을 만들었어요. 대상자 ' + peopleOf(s, c).length + '명이 미이수로 잡혀요.');
  });
  B.action('HQ25.course', (ctx, id) => { ctx.ui.course = ctx.ui.course === id ? null : id; });
  B.action('HQ25.done', (ctx, arg) => {
    const s = ctx.s;
    if (deny(ctx)) return;
    const [cid, sid] = isObj(arg) ? [arg.course, arg.staff] : String(arg).split('|');
    const c = s.hq25.courses.find(x => x.id === cid); if (!c) return;
    const p = s.staff.find(x => x.id === sid); if (!p) return;
    if (c.done[sid]) { delete c.done[sid]; say(p.name + ' 이수를 취소했어요.'); }
    else {
      c.done[sid] = md(ctx.today);
      if (c.cert && s.hq25.temp[p.center] && certOf(s, p.center).length) delete s.hq25.temp[p.center];
      say(p.name + ' ' + c.name + ' 이수를 기록했어요.' + (c.cert ? ' 입학 테스트 상담 권한이 열려요.' : ''));
    }
    ctx.ui.course = c.id;
  });
  B.action('HQ25.tempAsk', (ctx, cid) => { ctx.ui.temp = cid || null; ctx.ui.t_err = null; });
  B.action('HQ25.tempGive', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui;
    if (deny(ctx)) return;
    const cid = isObj(arg) ? arg.center : arg;
    if (isObj(arg) && arg.reason != null) ui.t_reason = arg.reason;
    const c = cobj(s, cid); ui.temp = cid;
    const reason = String(ui.t_reason || '').trim();
    ui.t_err = !reason ? '임시 권한을 주는 사유를 적어 주세요.' : null;
    if (ui.t_err) return;
    const who = (s.staff.find(x => x.center === cid && x.role === '원장') || {}).name || c.director;
    s.hq25.temp[cid] = { who, until: addDays(ctx.today, 30), reason, by: ctx.persona.name };
    audit(ctx, '권한 변경', c.name + ' ' + who + ' 입학 테스트 상담 임시 권한', reason);
    ui.temp = null; ui.t_reason = '';
    say(c.name + ' ' + who + ' 원장에게 30일 임시 권한을 줬어요. 감사 로그에 남았어요.');
  });
  B.action('HQ25.tempEnd', (ctx, cid) => { if (deny(ctx)) return; delete ctx.s.hq25.temp[cid]; say('임시 권한을 거뒀어요.'); });
  B.action('HQ25.remind', ctx => {
    const s = ctx.s;
    if (deny(ctx)) return;
    let n = 0; s.hq25.courses.filter(x => x.must).forEach(x => peopleOf(s, x).forEach(p => { if (!x.done[p.id]) n += 1; }));
    s.hq25.reminded = md(ctx.today);
    say('필수 과정 미이수 ' + n + '건을 본인과 원장에게 알렸어요.');
  });

  /* ======================================================================
     HQ-26 갱신·해지·폐점 (p.44 아래)
     ====================================================================== */
  const REASONS = ['계약 위반 반복 (운영 점검 기록)', '가맹금이나 사용료 미납', '기타'];
  const CLOSE = [
    { k: 'k1', t: '학부모와 교육청 안내', review: true, d: '폐점일과 환불, 이관 안내를 보호자에게 보내고 교육청 폐원 신고를 확인해요.' },
    { k: 'k2', t: '원생 이관과 환불 정리', d: '보호자가 동의한 원생만 다른 센터로 옮기고 나머지는 환불해요. 환불은 5일 안에 해요.', pol: ['POL-25'] },
    { k: 'k3', t: '학습 계정과 교직원 계정 정지, 키오스크와 패드 해제', review: true, d: '학습 계정은 사용료 과금 기준이라 먼저 멈춰요.' },
    { k: 'k4', t: '미정산 확정', d: '마지막 달 사용료와 교재 대금을 확정하고 다음 달 청구를 멈춰요 (HQ-16).' },
    { k: 'k5', t: '알림톡 잔액 환불', d: '', pol: ['POL-34'] },
    { k: 'k6', t: '원생 데이터 반환과 파기', d: '', pol: ['POL-40'] },
  ];
  const rnOf = (ctx, id) => ctx.s.hq26.renewals.find(r => r.id === (id || ctx.ui.rn)) || ctx.s.hq26.renewals[0];
  const RNCHIP = { '검토 중': 'warn', '요구 전': 'line', '갱신 확정': 'ok', '조건 변경 통지': 'info', '거절 통지': 'bad' };

  function renewDetail(ctx, rn) {
    const s = ctx.s, ui = ctx.ui, start = addDays(rn.end, -180), stop = addDays(rn.end, -90);
    let html = '<div class="grid g2" style="gap:14px;align-items:start;margin-top:12px"><div>' +
      h.kv([['계약 만료', rn.end], ['갱신 요구 기간', start + ' ~ ' + stop + ' ' + h.chip('법정', 'st-법정'), true], ['갱신 요구', rn.req ? rn.req + ' ' + h.chip(rn.req >= start && rn.req <= stop ? '기간 안' : '기간 밖', rn.req >= start && rn.req <= stop ? 'ok' : 'bad') : '아직 없어요', true], ['최장 보장', '10년 ' + h.chip('법정', 'st-법정'), true], ['계약 기간', h.pv('POL-07'), true]]) + '</div><div>';
    if (rn.req) {
      const due = addDays(rn.req, 15);
      html += rbox(rtitle('거절 통지 기한') + '<div style="font-size:15px;font-weight:700;margin-top:2px">' + esc(due) + '</div><div class="small">갱신 요구를 받은 날부터 15일 안에 사유를 적어 서면으로 알려야 해요. 기한까지 알리지 않으면 같은 조건으로 갱신된 것으로 봐요. 기한 계산법은 법무 확인 전이에요.</div>', 3);
    } else {
      html += '<div class="card" style="background:#fafbfc"><div class="card-h"><h3>갱신 요구 접수</h3></div>' + h.field({ label: '받은 날', type: 'date', value: ui.rq_date || '', field: 'rq_date', err: ui.rq_err, hint: '만료 180일 전부터 90일 전 사이에 받은 요구만 갱신 요구로 봐요' }) +
        '<div class="row" style="justify-content:flex-end;margin-top:8px">' + h.btn('접수', { primary: true, act: 'HQ26.receive', arg: rn.id, disabled: !ctx.canEdit }) + '</div></div>';
    }
    html += '</div></div>';
    if (rn.req && rn.status === '검토 중') {
      const dec = ui.dec || '';
      html += '<div class="card" style="margin-top:12px;background:#fafbfc"><div class="card-h"><h3>결정</h3><span class="sub">' + esc(cname(s, rn.center)) + '</span></div>' +
        h.opts(['같은 조건으로 갱신', '조건 바꿔 갱신', '거절'], dec, { act: 'HQ26.decide' });
      if (dec === '조건 바꿔 갱신') {
        html += '<div class="grid" style="grid-template-columns:minmax(0,1fr) 170px;gap:10px;margin-top:10px">' + h.field({ label: '바뀌는 조건', req: true, type: 'textarea', value: ui.rn_cond || '', field: 'rn_cond', err: ui.rn_err_cond }) +
          h.field({ label: '서면 통지일', req: true, type: 'date', value: ui.rn_date || '', field: 'rn_date', err: ui.rn_err_date, hint: stop + '까지' }) + '</div>';
      }
      if (dec === '거절') {
        html += '<div class="field" style="margin-top:10px"><label>거절 사유<span class="req">*</span></label>' +
          h.opts(REASONS.map(r => ({ v: r, l: r })).concat([{ v: '권장 교습비 이탈', l: '권장 교습비 이탈', dis: true, title: '가격을 묶는 것으로 볼 수 있어 거절 사유로 쓸 수 없어요' }]), ui.rn_reason || '', { act: 'HQ26.reason' }) + errLine(ui.rn_err_reason) + '</div>' +
          '<div class="grid" style="grid-template-columns:minmax(0,1fr) 170px;gap:10px;margin-top:10px">' + h.field({ label: '사유 설명', value: ui.rn_memo || '', field: 'rn_memo', ph: '운영 점검(HQ-24) 보완 기록 번호 등' }) +
          h.field({ label: '서면 통지일', req: true, type: 'date', value: ui.rn_date || '', field: 'rn_date', err: ui.rn_err_date, hint: addDays(rn.req, 15) + '까지' }) + '</div>';
      }
      html += '<div class="row" style="justify-content:flex-end;margin-top:10px">' + h.btn('결정 저장', { primary: true, act: 'HQ26.save', arg: rn.id, disabled: !ctx.canEdit || !dec }) + '</div></div>';
    } else if (rn.decision) {
      const d = rn.decision;
      html += '<div class="card" style="margin-top:12px;background:#fafbfc"><div class="card-h"><h3>결정 기록</h3>' + h.chip(rn.status, RNCHIP[rn.status]) + '</div>' +
        h.kv([['결정', d.decision], ['통지일', d.date || '-'], ['사유', d.reason || '-'], ['조건', d.cond || '-'], ['기록', d.by]]) +
        (d.decision === '거절' ? '<div class="row between" style="margin-top:10px"><span class="small muted">만료일에 계약이 끝나요. 폐점 체크리스트를 미리 열어 둘 수 있어요.</span>' + h.btn('폐점 처리 준비', { sm: true, primary: true, act: 'HQ26.startClose', arg: rn.center, disabled: !ctx.canEdit || !!s.hq26.close }) + '</div>' : '') + '</div>';
    }
    return html;
  }
  function term26(ctx) {
    const s = ctx.s, ui = ctx.ui, F = live(s).filter(c => c.type !== '직영'), t = s.hq26.term || {};
    const cid = ui.t_center || t.center || 'daegu', type = ui.t_type || t.type || '본사 해지';
    const svN = s.hq24.visits.filter(v => v.center === cid && Object.values(v.res).includes('보완')).length;
    let body = '<div class="row" style="gap:6px">' + h.opts(F.map(c => ({ v: c.id, l: c.name })), cid, { act: 'HQ26.tCenter' }) + '</div>' +
      '<div style="margin-top:8px">' + h.opts(['만료', '합의 해지', '본사 해지', '점주 해지'], type, { act: 'HQ26.tType' }) + '</div>';
    if (type === '본사 해지') {
      const st = (t.center === cid && t.type === type ? t.steps : null) || {};
      const steps = [['t1', '위반 사실 기록'], ['t2', '1차 서면 시정 요구'], ['t3', '2차 서면 통지'], ['t4', '해지']];
      const next = steps.find(x => !st[x[0]]);
      const earliest = st.t2 ? addMonths(st.t2, 2) : '';
      body += '<div style="margin-top:10px">' + h.steps(steps.map(x => ({ label: x[1] + (st[x[0]] ? ' ' + md(st[x[0]]) : ''), state: st[x[0]] ? 'done' : next && next[0] === x[0] ? 'cur' : '' }))) + '</div>' +
        '<div class="small" style="margin-top:6px">운영 점검(HQ-24) 보완 기록 ' + svN + '건을 근거로 붙여요. 첫 서면 통지 뒤 2개월 이상 지나야 해지할 수 있어요' + (earliest ? ' (가장 빠른 날 ' + earliest + ')' : '') + '.</div>';
      if (next) {
        body += '<div class="row" style="align-items:flex-end;margin-top:8px;flex-wrap:nowrap"><div style="width:170px">' + h.field({ label: next[1] + ' 날짜', type: 'date', value: ui.t_date || '', field: 't_date', err: ui.t_err }) + '</div>' +
          h.btn(next[1] + ' 기록', { primary: true, act: 'HQ26.tStep', disabled: !ctx.canEdit }) + '</div>';
      } else body += '<div style="margin-top:8px">' + h.alert('해지를 기록했어요. 폐점 체크리스트로 이어 가요.', 'ok') + '</div>';
    } else {
      body += '<div class="small" style="margin-top:10px">' + esc({ '만료': '갱신을 거절했거나 갱신 요구가 없으면 만료일에 계약이 끝나요.', '합의 해지': '양쪽이 서명한 합의서를 올리고 끝나는 날을 정해요.', '점주 해지': '점주가 보낸 해지 통지서를 받은 날과 끝나는 날을 기록해요.' }[type]) + ' 끝나는 날이 정해지면 폐점 체크리스트로 이어 가요.</div>';
    }
    return rbox('<div class="row between" style="margin-bottom:6px">' + rtitle('계약 종료 유형과 법정 절차') + '</div>' + body, 4);
  }
  function close26(ctx) {
    const s = ctx.s, ui = ctx.ui, cl = s.hq26.close, F = live(s).filter(c => c.type !== '직영');
    const cid = cl ? cl.center : (ui.cl_center || 'daegu'), c = cobj(s, cid);
    const pol40 = h.polValue('POL-40'), decided = !['미정', '안'].includes(pol40.status);
    const bal = (s.alim && s.alim.balances && s.alim.balances[cid]) || 0;
    let head = '';
    if (!cl) head = '<div class="row between" style="margin-bottom:10px;flex-wrap:nowrap"><div class="row">' + h.opts(F.map(x => ({ v: x.id, l: x.name })), cid, { act: 'HQ26.clCenter' }) + '</div>' + h.btn('폐점 처리 시작', { primary: true, act: 'HQ26.startClose', arg: cid, disabled: !ctx.canEdit }) + '</div>';
    else head = '<div class="row between" style="margin-bottom:10px"><b>' + esc(c.name) + '</b>' + h.chip(cl.doneAll ? '폐점 처리 완료' : '진행 중', cl.doneAll ? 'ok' : 'info') + '</div>';
    let firstReview = true;
    const rows = CLOSE.map((x, i) => {
      const done = cl && cl.steps[x.k], prevDone = !cl ? false : i === 0 || !!cl.steps[CLOSE[i - 1].k], can = cl && !done && prevDone;
      let d = x.d;
      if (x.k === 'k2') d = '재원생 ' + h.num(c.students || 0) + '명 (센터 입력 기준). ' + d;
      if (x.k === 'k5') d = done && cl.refund != null ? '충전금 ' + won(cl.refund) + '을 센터에 돌려줬어요.' : '남은 충전금 ' + won(bal) + '을 센터에 돌려줘요. 돌려주는 방식은 정책 안이에요.';
      let extra = '';
      if (x.k === 'k6') extra = rbox(rtitle('반환 뒤 두 단계 파기') + '<div class="small" style="margin-top:2px">원생 데이터를 센터에 돌려준 뒤 연락처와 학습 기록은 지우고, 이름과 결제 내역만 5년 따로 보관해요 (POL-41). 파기하면 HQ-22 파기 대장에 적혀요. 보관 기간 ' + h.pv('POL-40') + (decided ? '' : ', 정해지기 전에는 반환까지만 하고 파기는 대기해요.') + '</div>', 6, 'margin-top:6px');
      let pin = null;
      if (x.review && firstReview) { pin = 5; firstReview = false; }
      return '<div' + P(pin) + ' style="display:grid;grid-template-columns:26px minmax(0,1fr) auto;gap:10px;align-items:start;padding:9px ' + (x.review ? '8px' : '0') + ';border-bottom:1px solid var(--line-2);' + (x.review ? 'background:#faf8ff;border-radius:6px;' : '') + (cl ? '' : 'opacity:.85') + '">' +
        '<span class="mono" style="width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:800;' + (done ? 'background:var(--ok);color:#fff' : 'border:2px solid #c9ced8;color:var(--sub)') + '">' + (done ? '✓' : i + 1) + '</span>' +
        '<div><b>' + esc(x.t) + '</b> ' + (x.review ? h.chip('검토 반영', 'review') + ' ' : '') + (x.pol || []).map(h.polChip).join(' ') + '<div class="small muted" style="margin-top:2px">' + esc(d) + '</div>' + extra + '</div>' +
        '<div style="text-align:right">' + (done ? '<span class="small muted">' + esc(done) + '</span>' : h.btn('완료', { sm: true, primary: !!can, act: 'HQ26.clStep', arg: x.k, disabled: !can || !ctx.canEdit, title: cl && !prevDone ? '앞 단계를 먼저 마쳐요' : null })) + '</div></div>';
    }).join('');
    return h.card({ title: '폐점 처리', sub: '앞 단계를 마쳐야 다음 단계가 열려요', pin: 2, right: h.polChip('POL-25') + h.polChip('POL-34') + h.polChip('POL-40'), body: head + rows });
  }

  B.screen({
    id: 'HQ-26', side: 'hq', phase: 'P2', devices: ['pc'], pages: [44],
    title: '갱신·해지·폐점', menuLabel: '갱신·해지·폐점', crumb: '가맹점 관리 > 계약',
    render(ctx) {
      const s = ctx.s, rn = rnOf(ctx);
      let html = h.card({
        title: '갱신', pin: 1, right: h.polChip('POL-07'),
        body: h.table({
          cols: [{ label: '센터', render: r => '<b>' + esc(cname(s, r.center)) + '</b>' }, { label: '만료', render: r => '<span class="mono">' + esc(r.end) + '</span>' }, { label: '갱신 요구', render: r => (r.req ? '접수 ' + esc(r.req) : '<span class="muted">-</span>') }, { label: '상태', render: r => h.chip(r.status, RNCHIP[r.status] || '') }],
          rows: s.hq26.renewals, rowAttr: r => ' class="click' + (r.id === rn.id ? ' sel' : '') + '" data-act="HQ26.select" data-arg="' + r.id + '"',
        }) + renewDetail(ctx, rn),
      });
      html += '<div class="grid" style="grid-template-columns:minmax(0,1fr) 330px;gap:12px;margin-top:12px;align-items:start">' + close26(ctx) + term26(ctx) + '</div>';
      return html;
    },
    prd: {
      summary: '가맹 계약을 연장하는 갱신, 계약을 끝내는 해지, 문을 닫는 폐점에 할 일을 모은 화면이에요. 법이 정한 기한을 놓치지 않게 날짜를 계산해 보여 줘요.',
      who: '본사 슈퍼관리자와 운영이 쓰고 정산과 SV는 보기만 해요. 콘텐츠에게는 메뉴가 보이지 않아요(7쪽 권한표의 가맹점 관리 줄).',
      items: [
        { n: 1, t: '갱신', d: '계약 만료 180일 전부터 90일 전 사이에 들어온 갱신 요구를 접수해요. 거절하려면 사유를 적어 서면으로 알려야 하고, 알리지 않으면 같은 조건으로 갱신된 것으로 봐요. 원문 예시는 대구수성센터 2030-06-13 만료, 2029-12-20 접수, 검토 중이에요.', pol: ['POL-07'], ref: 'p.44 ①' },
        { n: 2, t: '해지·폐점', d: '원생 이관과 환불, 미정산 확정, 알림톡 잔액 환불, 원생 데이터 반환과 파기를 체크리스트로 처리해요. 앞 단계를 마쳐야 다음 단계가 열려요.', pol: ['POL-25', 'POL-34', 'POL-40'], ref: 'p.44 ②' },
        { n: 3, t: '거절 통지 기한 계산', kind: 'review', imp: ['IMP-27', 'IMP-25'], cond: true, reveal: 'HQ26.select', revealArg: 'rn1', d: '갱신 요구를 받은 날부터 15일 안에 거절 사유를 서면으로 알려야 해요. 접수일로 기한을 계산해 보여 주고, 기한을 넘긴 통지일은 저장을 막아요. 권장 교습비 이탈은 거절 사유로 고를 수 없어요(IMP-25). 기한 계산법은 법무가 확인하기 전이에요.' },
        { n: 4, t: '해지 유형과 법정 절차', kind: 'review', imp: 'IMP-27', d: '만료, 합의 해지, 본사 해지, 점주 해지를 나눠요. 본사 해지는 위반 사실을 기록하고 서면으로 두 번 고칠 기회를 알린 뒤, 첫 통지에서 2개월 이상 지나야 해지할 수 있어요. 운영 점검(HQ-24)의 보완 기록을 근거로 붙여요. 예외 사유가 있어서 법무가 확인하기 전이에요.' },
        { n: 5, t: '빠진 폐점 단계', kind: 'review', imp: 'IMP-27', d: '원문 체크리스트에 학부모와 교육청 안내, 학습 계정과 교직원 계정 정지, 키오스크와 패드 해제를 더했어요. 원생은 보호자가 동의한 경우에만 다른 센터로 옮기고 나머지는 환불해요.' },
        { n: 6, t: '데이터 반환과 두 단계 파기', kind: 'review', imp: 'IMP-07', d: '원생 데이터를 센터에 돌려준 뒤 연락처와 학습 기록은 지우고, 증빙에 필요한 이름과 결제 내역만 5년 따로 보관해요. 마지막 단계를 마치면 계정·권한 화면(HQ-22) 파기 대장에 자동으로 적혀요.', pol: ['POL-40', 'POL-41'] },
      ],
      open: ['계약 기간과 갱신 조건 (POL-07 미정)', '해지 때 알림톡 잔액을 돌려주는 방식 (POL-34 안)', '원생 개인정보 보관 기간 (POL-40 미정)', '폐점 때 학부모 환불을 누가 책임질지', '가맹은 P1b에 시작되는데 이 화면은 P2라서, 그 사이 폐점이 생기면 쓸 수기 절차'],
      rules: ['갱신 요구 기간은 만료 180일 전부터 90일 전까지예요 (법정).', '갱신요구권은 최장 10년까지 보장돼요 (법정).', '환불은 사유가 생긴 날부터 5일 안에 해요 (POL-25 법정).'],
    },
  });
  B.action('HQ26.select', (ctx, id) => { ctx.ui.rn = id; ctx.ui.dec = ''; ['rn_err_reason', 'rn_err_date', 'rn_err_cond', 'rq_err'].forEach(k => { ctx.ui[k] = null; }); });
  B.action('HQ26.decide', (ctx, v) => { ctx.ui.dec = v; ['rn_err_reason', 'rn_err_date', 'rn_err_cond'].forEach(k => { ctx.ui[k] = null; }); });
  B.action('HQ26.reason', (ctx, v) => { ctx.ui.rn_reason = v; ctx.ui.rn_err_reason = null; });
  B.action('HQ26.receive', (ctx, arg) => {
    const ui = ctx.ui;
    if (deny(ctx)) return;
    const id = isObj(arg) ? arg.id : arg, rn = rnOf(ctx, id); if (!rn) return;
    if (isObj(arg) && arg.date) ui.rq_date = arg.date;
    ui.rn = rn.id;
    const d = ui.rq_date || '', start = addDays(rn.end, -180), stop = addDays(rn.end, -90);
    ui.rq_err = !isDate(d) ? '받은 날을 골라 주세요.' : (d < start || d > stop) ? '갱신 요구 기간(' + start + ' ~ ' + stop + ') 밖이에요. 기간 밖 요구는 갱신 요구로 보지 않아요.' : null;
    if (ui.rq_err) return;
    rn.req = d; rn.status = '검토 중'; ui.rq_date = '';
    say(cname(ctx.s, rn.center) + ' 갱신 요구를 접수했어요. 거절 통지 기한은 ' + iyeyo(addDays(d, 15)) + '.');
  });
  B.action('HQ26.save', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui;
    if (deny(ctx)) return;
    const id = isObj(arg) ? arg.id : arg, rn = rnOf(ctx, id); if (!rn || rn.status !== '검토 중') return;
    if (isObj(arg)) {
      if (arg.decision) ui.dec = arg.decision;
      if (arg.reason != null) ui.rn_reason = arg.reason;
      if (arg.memo != null) ui.rn_memo = arg.memo;
      if (arg.date != null) ui.rn_date = arg.date;
      if (arg.cond != null) ui.rn_cond = arg.cond;
    }
    ui.rn = rn.id;
    const dec = ui.dec, due = addDays(rn.req, 15), stop = addDays(rn.end, -90), d = ui.rn_date || '';
    ui.rn_err_reason = ui.rn_err_date = ui.rn_err_cond = null;
    if (!dec) { say('결정을 먼저 골라 주세요.'); return; }
    if (dec === '거절') {
      if (/권장/.test(ui.rn_reason || '')) ui.rn_err_reason = '권장 교습비 이탈은 거절 사유로 쓸 수 없어요.';
      else if (!ui.rn_reason) ui.rn_err_reason = '거절 사유를 골라 주세요.';
      ui.rn_err_date = !isDate(d) ? '서면 통지일을 골라 주세요.' : d < rn.req ? '갱신 요구를 받은 날보다 앞설 수 없어요.' : d > due ? '기한(' + due + ')을 넘겼어요. 기한을 넘기면 같은 조건으로 갱신된 것으로 봐요.' : null;
      if (ui.rn_err_reason || ui.rn_err_date) return;
      rn.status = '거절 통지';
      rn.decision = { decision: '거절', reason: ui.rn_reason + (ui.rn_memo ? ', ' + ui.rn_memo : ''), date: d, by: ctx.persona.name };
    } else if (dec === '조건 바꿔 갱신') {
      ui.rn_err_cond = !String(ui.rn_cond || '').trim() ? '바뀌는 조건을 적어 주세요.' : null;
      ui.rn_err_date = !isDate(d) ? '서면 통지일을 골라 주세요.' : d > stop ? '조건 변경은 만료 90일 전(' + stop + ')까지 알려야 해요.' : null;
      if (ui.rn_err_cond || ui.rn_err_date) return;
      rn.status = '조건 변경 통지';
      rn.decision = { decision: '조건 바꿔 갱신', cond: String(ui.rn_cond).trim(), date: d, by: ctx.persona.name };
    } else {
      rn.status = '갱신 확정';
      rn.decision = { decision: '같은 조건으로 갱신', date: '', by: ctx.persona.name };
    }
    audit(ctx, '갱신 결정', cname(s, rn.center) + ' ' + rn.decision.decision, rn.decision.reason || rn.decision.cond || '-');
    ui.dec = ''; ui.rn_date = ''; ui.rn_reason = ''; ui.rn_memo = ''; ui.rn_cond = '';
    say(cname(s, rn.center) + ' 갱신을 ' + (rn.status === '거절 통지' ? '거절하고 서면 통지를 기록했어요.' : rn.status === '갱신 확정' ? '같은 조건으로 확정했어요.' : '조건을 바꿔 통지했어요.'));
  });
  B.action('HQ26.tCenter', (ctx, v) => { ctx.ui.t_center = v; ctx.ui.t_err = null; });
  B.action('HQ26.tType', (ctx, v) => { ctx.ui.t_type = v; ctx.ui.t_err = null; });
  B.action('HQ26.tStep', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui;
    if (deny(ctx)) return;
    if (isObj(arg)) { if (arg.center) ui.t_center = arg.center; if (arg.date) ui.t_date = arg.date; ui.t_type = '본사 해지'; }
    const cid = ui.t_center || (s.hq26.term && s.hq26.term.center) || 'daegu', type = ui.t_type || '본사 해지';
    if (type !== '본사 해지') return;
    if (!s.hq26.term || s.hq26.term.center !== cid || s.hq26.term.type !== type) s.hq26.term = { center: cid, type, steps: {} };
    const st = s.hq26.term.steps, order = ['t1', 't2', 't3', 't4'], k = order.find(x => !st[x]); if (!k) return;
    const d = ui.t_date || '';
    const prev = order[order.indexOf(k) - 1];
    ui.t_err = !isDate(d) ? '날짜를 골라 주세요.' : prev && d < st[prev] ? '앞 단계(' + st[prev] + ')보다 앞설 수 없어요.' : (k === 't4' && d < addMonths(st.t2, 2)) ? '첫 서면 통지(' + st.t2 + ') 뒤 2개월 이상 지나야 해요. 가장 빠른 날은 ' + iyeyo(addMonths(st.t2, 2)) + '.' : null;
    if (ui.t_err) return;
    st[k] = d; ui.t_date = '';
    const names = { t1: '위반 사실', t2: '1차 서면 시정 요구', t3: '2차 서면 통지', t4: '해지' };
    audit(ctx, '계약 해지 절차', cname(s, cid) + ' ' + names[k], d);
    say(names[k] + ' 날짜를 ' + ro(d) + ' 기록했어요.');
  });
  B.action('HQ26.clCenter', (ctx, v) => { ctx.ui.cl_center = v; });
  B.action('HQ26.startClose', (ctx, arg) => {
    const s = ctx.s;
    if (deny(ctx)) return;
    if (s.hq26.close) { say('이미 진행 중인 폐점 처리가 있어요.'); return; }
    const cid = (isObj(arg) ? arg.center : arg) || ctx.ui.cl_center || 'daegu';
    s.hq26.close = { center: cid, steps: {}, doneAll: false, by: ctx.persona.name };
    audit(ctx, '폐점 처리 시작', cname(s, cid), '-');
    say(cname(s, cid) + ' 폐점 체크리스트를 열었어요. 학부모와 교육청 안내부터 해요.');
  });
  B.action('HQ26.clStep', (ctx, k) => {
    const s = ctx.s, cl = s.hq26.close;
    if (deny(ctx)) return;
    if (!cl) { say('먼저 폐점 처리를 시작해 주세요.'); return; }
    const i = CLOSE.findIndex(x => x.k === k); if (i < 0 || cl.steps[k]) return;
    if (i > 0 && !cl.steps[CLOSE[i - 1].k]) { say('앞 단계를 먼저 마쳐 주세요.'); return; }
    cl.steps[k] = md(ctx.today) + ' ' + ctx.persona.name;
    const c = cobj(s, cl.center);
    if (k === 'k6') {
      const pol40 = h.polValue('POL-40'), decided = !['미정', '안'].includes(pol40.status);
      s.hq22.ledger.push({ id: 'd-close-' + cl.center, date: decided ? md(ctx.today) : '', kind: c.name + ' 폐점 원생 정보', n: c.students || 0, basis: '폐점, 센터에 반환 뒤 파기 (POL-40)', status: decided ? '파기 완료' : '대상 추출', notified: md(ctx.today) });
      cl.doneAll = true;
      audit(ctx, '폐점 처리 완료', c.name, decided ? '원생 정보 파기' : '반환 완료, 파기 대기 (POL-40 미정)');
      say('폐점 체크리스트를 모두 마쳤어요. 파기 대장(HQ-22)에 적었어요.');
      return;
    }
    if (k === 'k5') { cl.refund = (s.alim && s.alim.balances && s.alim.balances[cl.center]) || 0; if (s.alim && s.alim.balances) s.alim.balances[cl.center] = 0; }
    say(CLOSE[i].t + ' 단계를 마쳤어요.');
  });
})();
