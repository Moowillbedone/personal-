/* CT-13 학습 현황·레벨, CT-14 알림톡 발송·충전, CT-15 본사 청구서·거래원장, CT-16 교재·물품 주문, CT-17 본사 공지·자료실·1:1 문의. Spec p.58~62. */
(function () {
  const B = window.B, h = B.h, esc = B.esc;

  /* ---------------- small helpers (this file only) ---------------- */
  const pad = n => String(n).padStart(2, '0');
  const won = n => Number(n || 0).toLocaleString('ko-KR');
  const VAR = '<span class="chip navy" title="나중에 바뀔 수 있는 값이에요">가변</span>';
  const dash = t => '<span class="chip" style="background:#fff;border:1px dashed #aeb6c3;color:#3b4352">' + esc(t) + '</span>';
  const isDirect = c => !!c && c.type === '직영';
  const md = d => String(d || '').slice(5);
  const say = m => setTimeout(() => B.toast(m), 0); // engine re-renders after an action, so show the toast after that
  const stu = (s, id) => s.students.find(x => x.id === id);
  const short = c => (c ? c.name.replace('센터', '') : '');
  function addDays(d, n) { const t = new Date(d + 'T00:00:00'); t.setDate(t.getDate() + n); return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()); }
  function addMonths(d, n) { const p = d.split('-').map(Number); const t = new Date(p[0], p[1] - 1 + n, p[2]); return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()); }
  function dayDiff(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000); }
  function beforeDeadline(d) { const w = new Date(d + 'T00:00:00').getDay(); return w >= 1 && w <= 3; } // 수 18:00 마감 (예시)
  function friday(d) { const t = new Date(d + 'T00:00:00'); return addDays(d, (5 - t.getDay() + 7) % 7); }
  const shipOf = d => (beforeDeadline(d) ? friday(d) : addDays(friday(d), 7)); // 마감이 지나면 다음 주 금요일 출고
  // P1a 직영 화면은 오늘(2027-03-08), 가맹과 테스트베드 화면은 원문 예시 날짜(2027-10-04)를 써요.
  const workDate = ctx => (isDirect(ctx.center) ? ctx.s.today : '2027-10-04');
  function clock(s) { s.ctd.tick += 1; return pad(10 + Math.floor(s.ctd.tick / 6)) + ':' + pad((s.ctd.tick * 7) % 60); }
  function sel(field, value, options, o) {
    o = o || {};
    return '<select class="inp"' + (o.style ? ' style="' + o.style + '"' : ' style="width:auto;min-width:130px"') + ' data-field="' + field + '"' + (o.rerender ? ' data-rerender' : '') + (o.reset ? ' data-reset="' + o.reset + '"' : '') + (o.disabled ? ' disabled' : '') + '>' +
      options.map(x => { const v = typeof x === 'string' ? x : x.v, l = typeof x === 'string' ? x : x.l; return '<option value="' + esc(v) + '"' + (String(v) === String(value) ? ' selected' : '') + (x.dis ? ' disabled' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>';
  }
  const labeled = (label, inner) => '<div class="row" style="gap:6px"><span class="small muted">' + esc(label) + '</span>' + inner + '</div>';
  function bindRerender(root, ctx) {
    root.querySelectorAll('[data-rerender]').forEach(el => el.addEventListener('change', () => {
      ctx.ui[el.getAttribute('data-field')] = el.type === 'checkbox' ? el.checked : el.value;
      const r = el.getAttribute('data-reset'); if (r) ctx.ui[r] = null;
      B.render();
    }));
  }
  function scrollTo(root, ctx) { const id = ctx.ui._scroll; if (!id) return; ctx.ui._scroll = null; const el = root.querySelector('#' + id); if (el) setTimeout(() => el.scrollIntoView({ block: 'center' }), 0); }
  function staffLabel(ctx) { return ctx.persona.name + ' (' + short(ctx.center) + ' ' + ctx.persona.role.replace('·데스크', '') + ')'; }
  // 본사 지원 모드(hq)에서는 센터 화면을 보기만 해요. 고치려면 원장 동의가 필요해요(CM-02).
  const E = ctx => ctx.canEdit && ctx.side !== 'hq';
  // 7쪽 권한표의 ◐(일부 편집)는 범위가 정해지지 않았어요. 프로토타입에서는 설정과 돈이 걸린 확정 버튼만 막아요.
  const SET = ctx => E(ctx) && !ctx.partial;
  const toggleOff = title => '<button type="button" class="toggle" disabled title="' + esc(title) + '" style="opacity:.45;cursor:not-allowed"></button>';

  B.extend(s => {
    s.ctd = { tick: 0 };

    /* CT-13 학습 결과 (학습 시스템에서 받은 값, 예시) */
    s.ct13 = {
      synced: '2027-03-08 06:00', prevSynced: '2027-03-07 06:00', syncState: '정상', method: '원장 승인',
      // [독서퀴즈, 어휘퀴즈, 스피치 제출, 글쓰기 첨삭, 코칭 메모]
      scores: {
        s5: [72, 80, '3/4', '2/4', '요약 연습을 더 해요'], s11: [93, 95, '4/4', '4/4', '-'], s1: [84, 91, '4/4', '3/4 · 1 대기', '근거 찾기가 좋아졌어요'],
        s9: [78, 82, '3/4', '3/4', '-'], s2: [88, 90, '4/4', '3/4', '어휘 공부가 꾸준해요'], s8: [75, 79, '2/4', '2/4', '발표 연습을 권해요'],
        s7: [81, 77, '3/4', '3/4', '-'], s10: [90, 86, '4/4', '4/4', '-'],
      },
      promo: [
        { student: 's11', basis: '독서퀴즈 평균 93점 · 3개월', kind: '승급', status: '대상' },
        { student: 's1', basis: '원장 요청 · 레벨 조정 검토', kind: '재테스트', status: '대상' },
      ],
      tests: { s1: '2027-01-04', s11: '2027-01-04', s5: '2027-01-04', s3: '2027-03-06' },
      requests: [], log: [],
    };

    /* CT-14 알림톡 */
    s.ct14 = { avg7: { busan: 1560, daegu: 1600 }, warnDays: 3, safeLimit: 5000, groups: { busan: [{ id: 'g1', label: 'L2-화목A 보호자', n: 12 }] } };
    const log = s.alim.log;
    if (!log.some(x => x.center === 'busan')) log.push(
      { center: 'busan', at: '10-04 16:05', tpl: 'T01', n: 24, ok: 24, fail: 0, reason: '', cost: 168 },
      { center: 'busan', at: '10-04 09:00', tpl: 'T05', n: 38, ok: 37, fail: 1, reason: '번호 오류', cost: 259 });
    if (!log.some(x => x.center === 'daechi1')) log.push(
      { center: 'daechi1', at: '03-07 19:25', tpl: 'T02', n: 28, ok: 28, fail: 0, reason: '', cost: 196 },
      { center: 'daechi1', at: '03-07 16:05', tpl: 'T01', n: 26, ok: 25, fail: 1, reason: '번호 오류', cost: 175 });

    /* CT-15 청구서 원생별 근거와 거래원장 (HQ-17과 같은 내역, 예시) */
    s.ct15 = {
      date: '2027-10-06', account: '가상계좌 ○○은행 ****-****',
      rows: {
        'inv-daegu-09': [
          { name: '김민수', active: '09-01~09-30', days: 30, bill: '예', why: '', amt: 20000 },
          { name: '이준호', active: '09-01~09-18 (퇴원)', days: 18, bill: '예', why: '퇴원 반환 없음 (안)', amt: 20000 },
          { name: '박서윤', active: '09-15~09-30 (등록)', days: 16, bill: '예', why: '월중 등록 전액 (안)', amt: 20000 },
          { name: '정유아', active: '휴원', days: 0, bill: '아니오', why: '휴원 계정 정지', amt: 0 },
          { name: '… 60명', agg: true, active: '', days: null, bill: '', why: '', amt: 1200000 },
        ],
        'inv-busan-09': [{ name: '… 41명', agg: true, active: '', days: null, bill: '', why: '', amt: 738000 }],
      },
      ledger: {
        daegu: [
          { d: '08-10', k: '교재 주문', amt: 126000, settled: '08-15', note: '08-15 입금으로 정산했어요' },
          { d: '08-15', k: '입금', amt: -126000 },
          { d: '09-02', k: '알림톡 충전', amt: 50000, prepaid: true, note: '선불, 같은 날 입금' },
          { d: '10-05', k: '9월 청구서', inv: 'inv-daegu-09' },
        ],
        busan: [{ d: '10-05', k: '9월 청구서', inv: 'inv-busan-09' }],
      },
    };

    /* CT-16 교재·물품 */
    s.ct16 = {
      week: { daechi1: '3월 2주', mokdong: '3월 2주', bundang: '3월 2주', daegu: '10월 2주', busan: '10월 2주', incheon: '10월 2주' },
      dist: { daegu: { L2: 24, L3: 21 }, busan: { L1: 15, L2: 14, L3: 12 } },
      goods: [
        { id: 'kit3', name: '레벨 도서 키트 L3', type: '권장', price: 98000, def: 0 },
        { id: 'flyer', name: '홍보 전단 100매', type: '권장', price: 12000, def: 2 },
      ],
      wbPrice: 1800, deadline: '수 18:00', auto: {},
    };
    if (!s.orders.some(o => o.id === '#0712' && o.center === 'daegu')) s.orders.push({ id: '#0712', center: 'daegu', item: 'L1~L4 워크북 (10월 1주)', qty: 63, amount: 113400, status: '제작', date: '10-08', orderDate: '09-29', ship: '10-08' });

    /* CT-17 공지, 자료실, 문의, 서류, 열람 기록 */
    const addN = n => { if (!s.notices.some(x => x.title === n.title)) s.notices.push(n); };
    addN({ id: 'n-ct17-1', title: '4월 재등록 안내 문구 변경', must: true, date: '2027-03-05', cat: '운영', read: { daechi1: false, mokdong: true, bundang: false } });
    addN({ id: 'n-ct17-2', title: 'L3 워크북 개정 사항', must: false, date: '2027-03-02', cat: '교육', read: { daechi1: true, mokdong: false, bundang: false } });
    const addQ = q => { if (!s.inquiries.some(x => x.id === q.id)) s.inquiries.push(q); };
    addQ({ id: 'q1031', no: '#1031', center: 'daechi1', cat: '운영', title: '재등록 안내 문구 문의', status: '접수', date: '03-08', body: '4월 재등록 안내 문구에서 결제 기한을 어디에 넣는지 알려 주세요.' });
    addQ({ id: 'q1027', no: '#1027', center: 'daechi1', cat: '시스템', title: '결제선생 링크 오류', status: '완료', date: '03-07', body: '보호자가 결제 링크를 누르면 만료됐다고 나와요.', answer: '결제 링크 유효 시간을 다시 맞췄어요. 링크를 한 번 더 보내 주세요. (운영팀 홍길동, 03-07)' });
    s.ct17 = {
      bodies: {
        'n-ct17-1': '4월 재등록 안내 알림톡 문구가 바뀌어요. 금액 옆에 결제 기한을 함께 적어요. 3월 20일 재등록 청구부터 써요 (예시).',
        'n-ct17-2': 'L3 워크북 3주차 어휘 문항을 고쳤어요. 다음 주 인쇄분부터 바뀐 문항이 들어가요 (예시).',
      },
      readBy: {},
      files: [
        { id: 'f1', name: '센터 운영 매뉴얼', ver: 'v1.2', kind: '받기', cat: '운영' },
        { id: 'f2', name: '교습비 게시표 양식', ver: 'v1', kind: '받기', cat: '운영' },
        { id: 'f3', name: '입학 테스트 진행 영상', ver: 'v1', kind: '보기', cat: '교육' },
      ],
      dl: {},
      docs: {},
      views: {
        daechi1: [{ id: 'v1', at: '03-07 14:21', end: '03-07 14:38', who: '운영팀 홍길동', reason: '문의 #1027', screens: 'CT-07 수강 등록·수납, CT-09 수납·미수·마감', acts: '결제 링크 상태를 봤어요. 고친 것은 없어요.' }],
      },
      editReq: {
        daechi1: { at: '03-08 10:05', who: '운영팀 홍길동', screen: 'CT-08 재등록 안내 문구', reason: '문의 #1031 처리', status: '대기' },
      },
    };
  });

  /* ======================================================================
     CT-13 학습 현황·레벨 (p.58)
     ====================================================================== */
  const nextLevel = L => 'L' + (Number(String(L).replace(/\D/g, '')) + 1);
  function retestMonths(ctx) { const v = String(h.polValue('POL-29', ctx.center).value || ''); const m = /(\d+)\s*개월/.exec(v); return m ? Number(m[1]) : 6; }
  function availDate(ctx, st) { const t = ctx.s.ct13.tests[st.id] || st.since || ctx.today; return addMonths(t, retestMonths(ctx)); }
  function score(ctx, r, period) {
    const base = ctx.s.ct13.scores[r.id];
    if (!base || r.status === '휴원') return null;
    if (period === '2월') { if ((r.since || '') > '2027-02-28') return null; return [Math.max(0, base[0] - 4), Math.max(0, base[1] - 3), base[2], String(base[3]).replace(' · 1 대기', ''), '-']; }
    return base;
  }

  B.screen({
    id: 'CT-13', side: 'ct', phase: 'P1a', devices: ['pc', 'tablet'], pages: [58],
    title: '학습 현황·레벨', menuLabel: '학습 현황·레벨', crumb: '운영 > 학습 현황·레벨 관리',
    headActions: ctx => h.btn('엑셀', { act: 'CT13.excel' }),
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, d = s.ct13;
      // 입학 테스트(CT-03)에서 재원생 재테스트 결과가 넘어오면 그 원생을 재테스트 칸에 바로 보여 줘요
      if (ui.student && ui.from && ui._from !== ui.from) { ui._from = ui.from; ui.rt = ui.student; ui.reqForm = false; }
      const classes = s.classes.filter(c => c.center === ctx.centerId);
      const cls = classes.find(c => c.id === ui.cls) || classes.find(c => c.level === 'L3') || classes[0];
      const period = ui.period || '3월';
      const bad = d.syncState === '오류';
      let html = h.alert('학습 결과는 브레인180 학습 시스템에서 받아 보여 줘요. 학습 화면 자체는 학습 프로젝트 범위예요.', 'info', { pin: 1 });
      html += '<div class="row between" style="margin:14px 0 8px">' +
        '<div class="row" data-pin="2" style="padding-left:14px">' +
        labeled('반', cls ? sel('cls', cls.id, classes.map(c => ({ v: c.id, l: c.name })), { rerender: true }) : '<span class="muted small">반 없음</span>') +
        labeled('기간', sel('period', period, ['3월', '2월'], { rerender: true, style: 'width:auto;min-width:90px' })) + '</div>' +
        '<div class="row small" data-pin="6" style="gap:6px;padding-left:14px"><span class="muted">마지막 수신</span><b>' + esc(bad ? d.prevSynced : d.synced) + '</b><span class="muted">하루 1회 (예시)</span>' +
        h.chip(bad ? '수신 오류' : '정상', bad ? 'bad' : 'ok') + h.btn('다시 받기', { sm: true, act: 'CT13.sync' }) + '</div></div>';
      if (bad) html += '<div style="margin-bottom:8px">' + h.alert('오늘 결과를 받지 못했어요. 표는 ' + d.prevSynced + ' 값이에요. 다시 받기로도 안 되면 본사 1:1 문의로 알려 주세요.', 'bad') + '</div>';
      if (cls) {
        const rows = s.students.filter(x => x.center === ctx.centerId && x.cls === cls.id);
        const cell = (r, i) => {
          const sc = score(ctx, r, period);
          if (sc) return esc(sc[i]);
          if (i !== 0) return '<span class="muted">-</span>';
          return r.status === '휴원' ? h.chip('휴원 중', 'warn') : h.chip('결과 없음 (신규)', '');
        };
        html += h.table({
          cols: [
            { label: '원생', render: r => esc(h.mask(r.name)) + (r.status !== '재원' ? ' <span class="muted small">' + esc(r.status) + '</span>' : '') },
            { label: '독서퀴즈', num: true, render: r => cell(r, 0) },
            { label: '어휘퀴즈', num: true, render: r => cell(r, 1) },
            { label: '스피치 제출', render: r => cell(r, 2) },
            { label: '글쓰기 첨삭', render: r => cell(r, 3) },
            { label: '코칭 메모', render: r => cell(r, 4) },
            { label: '레벨', render: r => levelCell(ctx, r) },
          ],
          rows, empty: '이 반에는 아직 원생이 없어요.',
        });
        html += '<div class="small muted" style="margin-top:6px">점수는 ' + esc(period) + ' 평균이에요 (예시). 정원 ' + cls.cap + '명 중 ' + cls.enrolled + '명이 다니는 반이고, 예시 데이터가 있는 원생만 보여요.</div>';
      } else {
        html += h.empty('이 센터에는 아직 반이 없어요. 반·시간표(CT-11)에서 반을 만들면 여기에 나와요.');
      }
      html += '<div class="grid g2" style="margin-top:14px;align-items:start">' + promoCard(ctx) + retestCard(ctx) + '</div>';
      return html;
    },
    mount(root, ctx) { bindRerender(root, ctx); scrollTo(root, ctx); },
    prd: {
      summary: '학습 시스템에서 받은 아이들의 퀴즈 점수와 제출 현황을 반별로 모아 봐요. 다음 레벨로 올릴 아이와 시험을 다시 볼 아이도 여기서 정해요.',
      who: '원장과 교사가 보고 처리해요. 실장·데스크와 보조교사는 보기만 해요(7쪽 권한표). 승급 승인 버튼은 원장만 누를 수 있게 했어요.',
      items: [
        { n: 1, t: '범위', d: '이 화면은 학습 시스템에서 받은 결과를 보여 주기만 해요. 아이들이 공부하는 화면은 학습 프로젝트가 따로 만들어요.', ref: 'p.58 ①' },
        { n: 2, t: '반별 현황', d: '반과 기간을 고르면 독서퀴즈와 어휘퀴즈 점수, 스피치 제출, 글쓰기 첨삭, 선생님 코칭 메모, 지금 레벨이 한 표에 나와요. 점수는 모두 예시예요. 오른쪽 위 엑셀은 내려받는 이유를 남겨야 받아져요.', ref: 'p.58 ②' },
        { n: 3, t: '승급 대상', d: '본사가 정한 승급 방식에 따라 시스템이 후보를 골라 줘요. 자동 방식이면 확인만 하고, 원장 승인 방식이면 원장님이 승급 승인을 눌러요. 방식이 아직 안 정해져서 방식 미리 보기로 세 가지를 바꿔 볼 수 있어요.', pol: ['POL-33', 'POL-32'], ref: 'p.58 ③' },
        { n: 4, t: '재테스트', d: '마지막 시험 뒤 정해진 기간이 지나야 재테스트를 예약할 수 있어요. 기간 전에는 가능한 날만 보여 주고 예약 버튼을 잠가요. 화면의 6개월은 예시예요. 입학 테스트 화면(CT-03)에서 재테스트를 마치면 결과 레벨이 이 칸으로 넘어와요.', pol: ['POL-29'], ref: 'p.58 ④' },
        { n: 5, t: '승급은 레벨만 바꾸고 반 이동은 따로 해요', kind: 'review', imp: 'IMP-18', d: '원문은 승급하면 반도 함께 옮긴다고 했어요. 그러면 반을 옮기는 곳이 세 군데가 돼요. 그래서 승급 승인은 레벨과 콘텐츠 레벨만 바꾸고, 반은 원생 상세(CT-06)에서 정원과 적용일을 확인하고 옮겨요. 옮겨 갈 반에 자리가 없으면 반 이동 대기로 둬요.' },
        { n: 6, t: '결과 받은 시각과 신규 원생 표시', kind: 'review', imp: 'IMP-05', d: '학습 시스템에서 결과를 마지막으로 언제 받았는지 보여 줘요. 받지 못한 날은 빨간 경고가 떠요. 아직 결과가 없는 신규 원생은 빈칸 대신 결과 없음(신규)으로 보여요.' },
        { n: 7, t: '레벨 조정 요청', kind: 'review', imp: 'IMP-19', d: '레벨을 정하는 규칙이 아직 없어서 입학 때 레벨이 맞지 않는 아이가 생길 수 있어요. 원문대로면 이런 아이도 재테스트 기간을 기다려야 해요. 그래서 사유를 적어 레벨 조정을 요청하면 본사가 검토해서 정하게 했어요. 사유를 다섯 글자 이상 적어야 보낼 수 있어요.' },
      ],
      open: ['학습 시스템에서 어떤 결과를 언제 받아 올지 (학습 프로젝트와 아직 합의 전)', '승급 방식을 자동, 재테스트, 원장 승인 중 무엇으로 할지 (POL-33)', '레벨을 몇 단계로 나눌지 (POL-32)', '재테스트를 몇 개월 뒤 다시 볼 수 있는지 (POL-29, 화면 6개월은 예시)', '승급한 뒤 반 이동을 바로 할지 다음 달부터 할지', '재원생이 재테스트를 볼 때 테스트비를 받을지'],
    },
  });

  function levelCell(ctx, r) {
    const p = ctx.s.ct13.promo.find(x => x.student === r.id);
    if (p && p.status === '승인') return esc(r.level) + ' ' + (p.when !== '바로' ? h.chip(md(p.when) + '부터 ' + p.to, 'info') + ' ' : '') + h.chip(p.moved ? '반 이동 끝' : '반 이동 대기', p.moved ? 'ok' : 'warn');
    if (p && p.kind === '승급') return esc(r.level) + ' ' + h.chip(nextLevel(r.level) + ' 승급 대상', 'warn');
    return esc(r.level);
  }

  function promoCard(ctx) {
    const s = ctx.s, d = s.ct13, ui = ctx.ui, method = ui.method || d.method;
    const list = d.promo.filter(p => { const st = stu(s, p.student); return st && st.center === ctx.centerId; });
    const act = p => {
      const st = stu(s, p.student);
      if (p.status === '승인') return h.chip(p.to + ' 승인', 'ok') + ' ' + h.btn('반 이동', { sm: true, act: 'CT13.toMove', arg: p.student, disabled: !E(ctx) });
      if (p.kind === '재테스트' || method === '재테스트') {
        const av = availDate(ctx, st), open = ctx.today >= av;
        return h.btn('재테스트 예약', { sm: true, act: 'CT13.book', arg: p.student, disabled: !open || !E(ctx), title: open ? null : md(av) + '부터 예약할 수 있어요' }) + (open ? '' : ' <span class="small muted">' + md(av) + '부터</span>');
      }
      if (method === '자동') return h.chip('자동 승급 예정', 'info') + ' ' + h.btn('확인', { sm: true, act: 'CT13.approve', arg: p.student, disabled: !E(ctx) });
      return h.btn('승급 승인', { sm: true, act: 'CT13.approve', arg: p.student, disabled: !E(ctx) || ctx.role !== '원장', title: ctx.role !== '원장' ? '원장만 승인해요' : null });
    };
    const body = h.table({
      cols: [{ label: '원생', render: p => esc(h.mask(stu(s, p.student).name)) }, { label: '근거', render: p => esc(p.basis) }, { label: '처리', render: act }],
      rows: list, empty: '이번 기간에는 승급 대상이 없어요.',
      rowAttr: p => ' class="click' + (ui.rt === p.student ? ' sel' : '') + '" data-act="CT13.rt" data-arg="' + p.student + '"',
    }) +
      '<div class="row small muted" style="margin-top:8px;gap:6px">승급 방식은 본사 정책 (자동 / 재테스트 / 원장 승인) ' + dash('미확정(안)') + h.polChip('POL-33') + '</div>' +
      '<div class="row" style="margin-top:6px"><span class="small muted">방식 미리 보기</span>' + h.opts(['자동', '재테스트', '원장 승인'], method, { act: 'CT13.method' }) + '</div>' +
      (ui.ap ? approvePanel(ctx) : '') +
      '<div style="margin-top:10px">' + h.alert('승급 승인은 레벨과 콘텐츠 레벨만 바꿔요. 반은 원생 상세(CT-06)에서 정원과 적용일을 확인하고 옮겨요.', 'review', { pin: 5, title: '검토 반영' }) + '</div>';
    return h.card({ title: '승급 대상', sub: list.filter(p => p.status !== '승인').length + '명 대기', pin: 3, body });
  }

  function approvePanel(ctx) {
    const s = ctx.s, ui = ctx.ui, st = stu(s, ui.ap);
    if (!st) return '';
    const to = nextLevel(st.level);
    const target = s.classes.filter(c => c.center === ctx.centerId && c.level === to);
    const clsTxt = target.length ? target.map(c => c.name + ' 남은 자리 ' + Math.max(0, c.cap - c.enrolled) + '석').join(', ') : to + ' 반이 아직 없어요. 반이 열릴 때까지 반 이동 대기로 둬요.';
    return '<div class="card" id="ct13-ap" style="margin-top:10px;background:#fafbfc"><div class="card-h"><h3>승급 확인</h3><span class="sub">' + esc(h.mask(st.name)) + '</span><div class="r">' + h.btn('닫기', { sm: true, act: 'CT13.closeAp' }) + '</div></div>' +
      h.kv([['레벨', st.level + '에서 ' + to + '로 바꿔요'], ['콘텐츠 레벨', '학습 앱도 ' + to + ' 콘텐츠로 바뀌어요'], ['옮겨 갈 반', clsTxt]]) +
      '<div class="grid g2" style="margin-top:10px">' + h.field({ label: '적용일', type: 'select', value: ui.ap_when || '바로', options: [{ v: '바로', l: '바로 적용' }, { v: '2027-04-01', l: '다음 달 1일 (2027-04-01)' }], field: 'ap_when' }) + '</div>' +
      '<label class="row small" style="margin-top:8px"><input type="checkbox" data-field="ap_notify"' + (ui.ap_notify !== false ? ' checked' : '') + '> 보호자에게 알림톡으로 알려요</label>' +
      '<div class="row" style="justify-content:flex-end;margin-top:10px">' + h.btn(st.level + '에서 ' + to + '로 승급 확정', { primary: true, act: 'CT13.confirm', arg: st.id }) + '</div></div>';
  }

  function retestCard(ctx) {
    const s = ctx.s, d = s.ct13, ui = ctx.ui;
    const first = d.promo.find(p => p.kind === '재테스트' && (stu(s, p.student) || {}).center === ctx.centerId);
    const st = stu(s, ui.rt) || (first && stu(s, first.student)) || s.students.find(x => x.center === ctx.centerId && x.status === '재원');
    if (!st) return h.card({ title: '재테스트', pin: 4, body: h.empty('재테스트를 볼 원생이 없어요.') + '<div data-pin="7" class="small muted" style="margin-top:8px">레벨 조정 요청은 원생이 있을 때 쓸 수 있어요.</div>' });
    const test = d.tests[st.id] || st.since || ctx.today;
    const months = retestMonths(ctx), av = addMonths(test, months), open = ctx.today >= av;
    const reqs = d.requests.filter(r => r.student === st.id);
    const levels = ['L1', 'L2', 'L3', 'L4'].filter(L => L !== st.level).sort((a, b) => (a === nextLevel(st.level) ? -1 : b === nextLevel(st.level) ? 1 : 0));
    let box = '<div data-pin="7" style="margin-top:12px;border-top:1px solid var(--line-2);padding:10px 0 0 14px">' +
      '<div class="row between"><b style="font-size:12.5px">레벨 조정 요청</b>' + (ui.reqForm ? '' : h.btn('레벨 조정 요청', { sm: true, act: 'CT13.reqForm', disabled: !E(ctx) })) + '</div>' +
      '<div class="small muted" style="margin-top:4px">입학 때 정한 레벨이 맞지 않으면 기간과 상관없이 사유를 적어 본사에 요청해요.</div>';
    if (ui.reqForm) {
      box += '<div class="stack" style="margin-top:8px">' +
        h.field({ label: '바꿀 레벨', type: 'select', value: ui.req_to || levels[0], options: levels, field: 'req_to' }) +
        h.field({ label: '사유', req: true, type: 'textarea', value: ui.req_reason || '', field: 'req_reason', err: ui.req_err, ph: '예) 입학 테스트 날 컨디션 문제, 수업 4주 관찰 결과' }) +
        '<div class="row" style="justify-content:flex-end">' + h.btn('취소', { sm: true, act: 'CT13.reqClose' }) + h.btn('본사에 요청 보내기', { sm: true, primary: true, act: 'CT13.req', arg: st.id }) + '</div></div>';
    }
    box += reqs.map(r => '<div class="row small" style="margin-top:6px">' + esc(r.at) + ' ' + esc(r.from + '에서 ' + r.to + '로 요청') + ' ' + h.chip(r.status, r.status === '승인' ? 'ok' : 'warn') + '</div>').join('') + '</div>';
    // CT-03에서 넘어온 재테스트 결과
    let res = '';
    if (ui.student === st.id && ui.level && ui._from) {
      const p = d.promo.find(x => x.student === st.id && x.status === '승인' && x.basis === '재테스트 결과');
      res = '<div style="margin-top:10px">' + (p
        ? h.alert('재테스트 결과로 레벨을 ' + p.from + '에서 ' + p.to + '로 바꿨어요. 반 이동은 원생 상세(CT-06)에서 해요.', 'ok', { title: '재테스트 결과 반영' })
        : ui.level === st.level
          ? h.alert('입학 테스트(CT-03)에서 넘어온 결과도 ' + ui.level + '예요. 레벨은 그대로 둬요.', 'info', { title: '재테스트 결과' })
          : h.alert('입학 테스트(CT-03)에서 넘어온 결과는 ' + ui.level + '이고 지금 레벨은 ' + st.level + '예요.', 'info', { title: '재테스트 결과' }) +
            '<div class="row" style="justify-content:flex-end;margin-top:6px">' + h.btn('결과 레벨 ' + ui.level + '로 바꾸기', { sm: true, primary: true, act: 'CT13.applyRt', arg: st.id, disabled: !E(ctx) || ctx.role !== '원장', title: ctx.role !== '원장' ? '원장만 레벨을 바꿔요' : null }) + '</div>') + '</div>';
    }
    const body = h.kv([
      ['대상', h.mask(st.name) + ' (입학 테스트 ' + test + ')'],
      ['가능일', esc(av) + ' 이후 ' + dash(months + '개월 (예시)') + ' ' + VAR + ' ' + h.polChip('POL-29'), true],
      ['예약', open ? h.btn('재테스트 예약', { primary: true, act: 'CT13.book', arg: st.id, disabled: !E(ctx) }) : h.btn('가능일 전 예약 불가', { disabled: true }), true],
    ]) + res + box;
    return h.card({ title: '재테스트', sub: '승급 대상 목록에서 원생을 누르면 바뀌어요', pin: 4, body });
  }

  B.action('CT13.cls', (ctx, id) => { const c = ctx.s.classes.find(x => x.id === id && x.center === ctx.centerId); if (c) ctx.ui.cls = c.id; });
  B.action('CT13.period', (ctx, v) => { ctx.ui.period = v === '2월' ? '2월' : '3월'; });
  B.action('CT13.applyRt', (ctx, id) => {
    const ui = ctx.ui, st = stu(ctx.s, id || ui.student); if (!st || !ui.level) return;
    if (ctx.role !== '원장') { say('레벨은 원장만 바꿀 수 있어요.'); return; }
    const from = st.level, to = ui.level;
    if (from === to) return;
    const P = ctx.s.ct13.promo;
    let p = P.find(x => x.student === st.id);
    if (!p) { p = { student: st.id, kind: '재테스트' }; P.push(p); }
    Object.assign(p, { basis: '재테스트 결과', status: '승인', from, to, when: '바로', by: ctx.persona.name, at: md(ctx.today) });
    st.level = to; ctx.s.ct13.tests[st.id] = ctx.today;
    ctx.s.ct13.log.unshift({ at: md(ctx.today) + ' ' + clock(ctx.s), student: st.id, from, to, when: '바로', by: ctx.persona.name, why: '재테스트 결과' });
    say(h.mask(st.name) + ' 레벨을 ' + to + '로 바꿨어요. 반 이동은 따로 해요.');
  });
  B.action('CT13.method', (ctx, v) => { ctx.ui.method = v; ctx.ui.ap = null; });
  B.action('CT13.rt', (ctx, id) => { ctx.ui.rt = id; ctx.ui.reqForm = false; });
  B.action('CT13.approve', (ctx, id) => { ctx.ui.ap = id || 's11'; ctx.ui.ap_when = ctx.ui.ap_when || '바로'; ctx.ui._scroll = 'ct13-ap'; });
  B.action('CT13.closeAp', ctx => { ctx.ui.ap = null; });
  B.action('CT13.confirm', (ctx, arg) => {
    const o = arg && typeof arg === 'object' ? arg : { student: arg || ctx.ui.ap || 's11' };
    const st = stu(ctx.s, o.student); if (!st) return;
    if (ctx.role !== '원장') { say('승급 승인은 원장만 할 수 있어요.'); return; }
    const p = ctx.s.ct13.promo.find(x => x.student === st.id) || (ctx.s.ct13.promo.push({ student: st.id, basis: '원장 판단', kind: '승급', status: '대상' }), ctx.s.ct13.promo[ctx.s.ct13.promo.length - 1]);
    const from = st.level, to = nextLevel(from), when = o.when || ctx.ui.ap_when || '바로';
    const notify = o.notify != null ? !!o.notify : ctx.ui.ap_notify !== false;
    Object.assign(p, { status: '승인', from, to, when, notify, by: ctx.persona.name, at: md(ctx.today) });
    if (when === '바로') st.level = to;
    ctx.s.ct13.log.unshift({ at: md(ctx.today) + ' ' + clock(ctx.s), student: st.id, from, to, when, by: ctx.persona.name });
    ctx.ui.ap = null;
    say(h.mask(st.name) + ' 레벨을 ' + to + '로 바꿨어요.' + (notify ? ' 보호자에게 알림톡이 나가요.' : '') + ' 반 이동은 따로 해요.');
  });
  B.action('CT13.toMove', (ctx, id) => {
    const p = ctx.s.ct13.promo.find(x => x.student === id);
    const reg = ctx.s.ui['CT-06'] = ctx.s.ui['CT-06'] || {};
    Object.assign(reg, { student: id, from: 'CT-13', moveLevel: p ? p.to : null });
    B.go('CT-06'); return false;
  });
  B.action('CT13.book', (ctx, id) => {
    const st = stu(ctx.s, id || ctx.ui.rt || 's1'); if (!st) return;
    const av = availDate(ctx, st);
    if (ctx.today < av) { say(md(av) + ' 전에는 재테스트를 예약할 수 없어요. 레벨 조정 요청을 이용해 주세요.'); return; }
    const rid = 'r' + (ctx.s.reservations.length + 1);
    ctx.s.reservations.unshift({ id: rid, center: ctx.centerId, at: md(ctx.today) + ' 16:00', student: st.name, grade: st.grade, kind: '재테스트', route: '재원생', guardianPhone: st.phone, status: '예약', result: '-' });
    say('재테스트를 예약했어요. 상담·테스트 예약(CT-02)에서 볼 수 있어요.');
  });
  B.action('CT13.reqForm', ctx => { ctx.ui.reqForm = true; ctx.ui.req_err = null; });
  B.action('CT13.reqClose', ctx => { ctx.ui.reqForm = false; ctx.ui.req_err = null; });
  B.action('CT13.req', (ctx, arg) => {
    const ui = ctx.ui;
    if (arg && typeof arg === 'object') { if (arg.to) ui.req_to = arg.to; if (arg.reason != null) ui.req_reason = arg.reason; }
    const st = stu(ctx.s, (arg && typeof arg === 'object' ? arg.student : arg) || ui.rt || 's1'); if (!st) return;
    const reason = String(ui.req_reason || '').trim();
    if (reason.length < 5) { ui.reqForm = true; ui.req_err = '사유를 다섯 글자 이상 적어 주세요. 본사가 판단할 근거가 돼요.'; return; }
    const lv = ['L1', 'L2', 'L3', 'L4'].filter(L => L !== st.level);
    const to = ui.req_to && ui.req_to !== st.level ? ui.req_to : (lv.includes(nextLevel(st.level)) ? nextLevel(st.level) : lv[0]);
    ctx.s.ct13.requests.push({ id: 'lr' + (ctx.s.ct13.requests.length + 1), center: ctx.centerId, student: st.id, from: st.level, to, reason, status: '본사 검토 중', at: md(ctx.today), by: ctx.persona.name });
    ui.reqForm = false; ui.req_err = null; ui.req_reason = ''; ui.rt = st.id;
    say('레벨 조정 요청을 본사에 보냈어요.');
  });
  B.action('CT13.sync', (ctx, arg) => {
    const d = ctx.s.ct13;
    if (arg === 'fail') { d.syncState = '오류'; return; }
    d.prevSynced = d.synced; d.synced = ctx.today + ' ' + clock(ctx.s); d.syncState = '정상';
    say('학습 결과를 다시 받았어요.');
  });
  function excelLog(ctx, reason) {
    const cls = ctx.s.classes.find(c => c.id === ctx.ui.cls) || ctx.s.classes.find(c => c.center === ctx.centerId && c.level === 'L3');
    ctx.s.audit.unshift({ at: md(ctx.today) + ' ' + clock(ctx.s), who: staffLabel(ctx), what: '엑셀 다운로드', target: '학습 현황 ' + (cls ? cls.name : '') + ' ' + (ctx.ui.period || '3월'), reason });
    say('엑셀을 내려받았어요. 내려받은 이유가 기록돼요.');
  }
  B.action('CT13.excel', (ctx, arg) => {
    const reason = arg && typeof arg === 'object' ? arg.reason : arg;
    if (reason) { excelLog(ctx, reason); return; }
    B.modal({
      title: '엑셀 내려받기',
      body: '<div class="field"><label for="ct13-reason">내려받는 이유</label><select class="inp" id="ct13-reason"><option>학부모 상담 자료</option><option>반 편성 검토</option><option>본사 보고</option></select></div><div class="small muted">원생 이름이 들어 있는 파일이라 누가, 언제, 왜 내려받았는지 기록이 남아요 (CM-03).</div>',
      ok: '내려받기', onOk: back => { excelLog(B.ctx(), back.querySelector('#ct13-reason').value); },
    });
    return false;
  });

  /* ======================================================================
     CT-14 알림톡 발송·충전 (p.59)
     ====================================================================== */
  const AUTO = [['입실', 'T01', '입실', true], ['퇴실', 'T02', '퇴실', true], ['수납', 'T03', '수강료 안내'], ['미납', 'T04', '미납 안내'], ['재등록', 'T05', '재등록 안내'], ['결과지', 'T06', '결과지 링크']];
  const unitOf = () => { const m = /(\d+)\s*원/.exec(String(h.polValue('POL-34').value || '')); return m ? Number(m[1]) : 7; };
  function groupsOf(ctx) {
    const cls = ctx.s.classes.filter(c => c.center === ctx.centerId).map(c => ({ id: c.id, label: c.name + ' 보호자', n: c.enrolled }));
    return cls.concat(ctx.s.ct14.groups[ctx.centerId] || []).concat([{ id: 'all', label: '재원생 전체 보호자', n: (ctx.center || {}).students || 0 }]);
  }
  function grpOf(ctx) { const gs = groupsOf(ctx); return gs.find(g => g.id === ctx.ui.grp) || gs.find(g => g.id === 'c3') || gs.find(g => g.id === 'g1') || gs[0]; }
  function tplOf(ctx) { const ts = ctx.s.alim.templates; return ts.find(t => t.id === ctx.ui.tpl) || ts.find(t => t.id === 'T05' && t.status === '승인') || ts.find(t => t.id === 'T03' && t.status === '승인') || ts.find(t => t.status === '승인') || ts[0]; }
  function fill(ctx, t, g) {
    const st = ctx.s.students.find(x => x.center === ctx.centerId && (g.id === 'all' || x.cls === g.id)) || { name: '윤서아' };
    const month = (Number(workDate(ctx).slice(5, 7)) % 12) + 1;
    const pr = ctx.s.products[0], price = (pr.centerPrice && pr.centerPrice[ctx.centerId]) || pr.direct;
    return '[브레인180 ' + short(ctx.center) + '] ' + t.text.replace('#{학생명}', h.mask(st.name)).replace('#{시각}', '16:02').replace('#{월}', month + '월').replace('#{금액}', won(price)).replace('#{링크}', 'pay.example/b180');
  }
  function balInfo(ctx) {
    const fr = !isDirect(ctx.center), bal = ctx.s.alim.balances[ctx.centerId] || 0, avg = ctx.s.ct14.avg7[ctx.centerId];
    return { fr, bal, avg, days: avg ? Math.floor(bal / avg) : null };
  }
  // 새로 보낸 줄이 발송 내역 맨 위에 오도록 그날 마지막 발송 시각보다 조금 뒤 시각을 써요
  function sendTime(ctx) {
    const day = md(workDate(ctx));
    const last = ctx.s.alim.log.filter(x => x.center === ctx.centerId && String(x.at || '').indexOf(day + ' ') === 0).map(x => String(x.at).slice(6)).sort().pop();
    if (!last) return day + ' ' + clock(ctx.s);
    const m = Number(last.slice(0, 2)) * 60 + Number(last.slice(3, 5)) + 7;
    return day + ' ' + pad(Math.min(21, Math.floor(m / 60))) + ':' + pad(m >= 21 * 60 ? 0 : m % 60);
  }
  function sendError(ctx, t, g, cost) {
    if (!ctx.canEdit) return '이 역할은 알림톡을 보낼 수 없어요.';
    if (!t || t.status !== '승인') return '카카오 심사를 통과한 템플릿만 보낼 수 있어요.';
    if (!g || g.n <= 0) return '받는 사람이 없어요.';
    const b = balInfo(ctx);
    if (b.fr && b.bal < cost) return '잔액이 모자라요. 충전 요청을 먼저 해 주세요.';
    return null;
  }

  B.screen({
    id: 'CT-14', side: 'ct', phase: 'P1a', devices: ['pc'], pages: [59],
    title: '알림톡 발송·충전', menuLabel: '알림톡 발송·충전', crumb: '알림톡',
    headActions: ctx => h.btn('충전 요청', { act: 'CT14.topupForm', disabled: !SET(ctx) || isDirect(ctx.center), title: isDirect(ctx.center) ? '직영은 본사 내부 비용이라 충전하지 않아요' : ctx.partial ? '교사는 충전을 요청할 수 없어요' : null }) +
      h.btn('보내기', { primary: true, act: 'CT14.confirm', disabled: !E(ctx), pin: 8 }),
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, b = balInfo(ctx), unit = unitOf();
      const t = tplOf(ctx), g = grpOf(ctx), cost = g.n * unit;
      let html = '';
      if (ui.topup) {
        html += h.card({
          title: '충전 요청', sub: '입금하면 본사가 확인한 뒤 잔액을 채워요 (HQ-18)', right: h.btn('닫기', { sm: true, act: 'CT14.topupClose' }),
          body: '<div class="grid g3">' + h.field({ label: '충전 금액(원)', req: true, value: ui.tp_amount || '50000', field: 'tp_amount', err: ui.tp_err, hint: '1만 원 단위로 넣어요 (예시)' }) +
            h.field({ label: '입금 계좌', type: 'static', value: '본사 ' + s.ct15.account }) + h.field({ label: '처리 순서', type: 'static', value: '입금 대기, 본사 확인, 충전 완료' }) + '</div>' +
            '<div class="row" style="justify-content:flex-end;margin-top:10px">' + h.btn('충전 요청 보내기', { primary: true, act: 'CT14.topup' }) + '</div>',
        }) + '<div style="height:12px"></div>';
      }
      const tops = s.alim.topups.filter(x => x.center === ctx.centerId);
      html += '<div class="row" data-pin="4" style="margin-bottom:10px;padding-left:14px">' +
        (b.fr ? dash('잔액 ' + won(b.bal) + '원 · 약 ' + (b.days == null ? '-' : b.days) + '일분') : h.chip('직영 센터는 본사 내부 비용이라 잔액이 없어요', 'navy')) +
        '<span class="chip line">단가 ' + unit + '원 (안)</span>' + VAR + h.polChip('POL-34') +
        tops.map(x => h.chip('충전 요청 ' + won(x.amount) + '원 ' + x.status + ' (' + md(x.at) + ')', x.status === '입금 대기' ? 'warn' : 'ok')).join('') + '</div>';
      const low = b.fr && b.days != null && b.days <= s.ct14.warnDays;
      const warnText = b.fr
        ? (b.days < 1 ? '잔액이 하루치도 남지 않았어요. ' : '잔액이 약 ' + b.days + '일분 남았어요. ') + '최근 7일 평균 ' + won(b.avg) + '원(예시)으로 계산했어요. ' + (low ? '3일분(예시) 아래라 미리 알려 드려요. ' : '3일분(예시) 아래로 내려가면 미리 알려 드려요. ') + '0원이 돼도 입실과 퇴실 알림은 ' + won(s.ct14.safeLimit) + '원(예시)까지 이어서 보내고 다음 청구서에 더해요. 잔액은 성공한 건만 빠져요.'
        : '직영은 잔액이 없어서 발송이 멈추지 않아요. 가맹 센터는 3일분(예시) 아래로 내려가면 미리 경고하고, 잔액이 0원이 돼도 입실과 퇴실 알림은 이어서 보내요.';
      html += h.alert(warnText, low ? 'warn' : 'review', { pin: 6, title: low ? '잔액 경고' : '검토 반영' });
      const ts = s.alim.templates;
      const sendBody = h.kv([
        ['템플릿', sel('tpl', t.id, ts.map(x => ({ v: x.id, l: x.id + ' ' + x.name + (x.status !== '승인' ? ' (카카오 ' + x.status + ')' : ''), dis: x.status !== '승인' })), { rerender: true, disabled: !E(ctx), style: 'width:100%' }), true],
        ['받는 사람', sel('grp', g.id, groupsOf(ctx).map(x => ({ v: x.id, l: x.label + ' ' + x.n + '명' })), { rerender: true, disabled: !E(ctx), style: 'width:100%' }), true],
        ['미리보기', '<span style="font-weight:400;color:var(--sub)">' + esc(fill(ctx, t, g)) + '</span>', true],
        ['예상 비용', g.n + '건 × ' + unit + '원 = ' + won(cost) + '원 (예시)' + (b.fr ? '' : ', 본사 내부 비용')],
      ]) + '<div data-pin="2" class="small muted" style="margin-top:12px;display:inline-block;padding-left:14px">광고성 메시지는 보낼 수 없어요. 할인 행사 같은 광고는 수신 동의한 보호자에게만 다른 채널로 보내요.</div>';
      const autoRows = AUTO.map(a => ({ key: a[0], tpl: ts.find(x => x.id === a[1]), label: a[2], safe: a[3] }));
      const autoBody = h.table({
        cols: [
          { label: '항목', render: r => esc(r.label) + (r.safe ? ' ' + h.chip('안전 알림', 'navy') : '') },
          { label: '템플릿', render: r => '<span class="mono small">' + esc(r.tpl ? r.tpl.id : '-') + '</span>' + (r.tpl && r.tpl.status !== '승인' ? ' ' + h.chip('카카오 ' + r.tpl.status, 'warn') : '') },
          { label: '발송', render: r => {
            const ok = r.tpl && r.tpl.status === '승인';
            if (!ok) return toggleOff('카카오 심사를 통과하면 켤 수 있어요');
            if (!SET(ctx)) return toggleOff(ctx.partial ? '교사는 자동 발송을 바꿀 수 없어요' : '바꿀 권한이 없어요').replace('class="toggle"', 'class="toggle' + (s.alim.auto[r.key] ? ' on' : '') + '"');
            return h.toggle(!!s.alim.auto[r.key], { act: 'CT14.auto', arg: r.key, title: r.label + ' 자동 발송' });
          } },
        ],
        rows: autoRows,
      }) + '<div style="margin-top:10px">' + h.alert('카카오 심사 중이거나 반려된 템플릿은 고를 수 없고 자동 발송도 켤 수 없어요. 승인되면 다시 켤 수 있어요.', 'review', { pin: 7, title: '검토 반영' }) + '</div>';
      html += '<div class="grid g2" style="margin-top:12px;align-items:start;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr)">' +
        h.card({ title: '보내기', pin: 1, right: h.polChip('POL-35'), body: sendBody }) +
        h.card({ title: '자동 발송 설정', pin: 3, right: h.polChip('POL-35'), body: autoBody }) + '</div>';
      // 발송 묶음 행 {n, ok, fail, cost} 과 키오스크가 남기는 한 건짜리 행 {student, name, status} 를 같이 보여 줘요
      const logs = s.alim.log.filter(x => x.center === ctx.centerId).map(r => {
        const one = r.n == null, ok = one ? (r.status === '실패' ? 0 : 1) : r.ok, fail = one ? (r.status === '실패' ? 1 : 0) : r.fail;
        const tn = (ts.find(x => x.id === r.tpl) || {}).name || r.name || '';
        return { at: r.at, tpl: (r.tpl || '') + ' ' + tn, n: one ? 1 : r.n, ok, fail, reason: r.reason || '', cost: r.cost != null ? r.cost : ok * unit, wait: one && r.status === '대기' };
      }).sort((a, b) => String(b.at).localeCompare(String(a.at)));
      html += '<div style="margin-top:12px">' + h.card({
        title: '발송 내역', sub: logs.length + '건', pin: 5,
        body: h.table({
          cols: [
            { label: '일시', k: 'at' }, { label: '템플릿', render: r => esc(r.tpl) + (r.wait ? ' ' + h.chip('보내는 중', 'info') : '') }, { label: '건수', num: true, render: r => won(r.n) }, { label: '성공', num: true, render: r => won(r.ok) },
            { label: '실패', render: r => r.fail ? '<span style="color:var(--bad);font-weight:700">' + r.fail + '</span> ' + esc(r.reason ? '(' + r.reason + ')' : '') : '0' },
            { label: '비용', num: true, render: r => won(r.cost) },
            { label: '', render: r => r.fail ? h.btn('보호자 연락처 고치기', { sm: true, act: 'CT14.fix' }) : '' },
          ],
          rows: logs, empty: '아직 보낸 알림톡이 없어요.',
        }),
      }) + '</div>';
      return html;
    },
    mount(root, ctx) { bindRerender(root, ctx); },
    prd: {
      summary: '학부모에게 카카오 알림톡을 보내고, 저절로 나갈 알림을 켜고 꺼요. 가맹 센터는 미리 충전한 잔액으로 보내고, 충전 요청도 여기서 해요.',
      who: '원장과 실장·데스크가 보내고 설정을 바꿔요. 교사는 일부만 쓰고, 보조교사에게는 메뉴가 안 보여요(7쪽 권한표). 교사가 어디까지 쓰는지 정해지지 않아서 프로토타입에서는 보내기만 하고 자동 발송 설정과 충전 요청은 막아 두었어요.',
      items: [
        { n: 1, t: '보내기', d: '본사가 만들고 카카오 심사를 통과한 템플릿만 고를 수 있어요. 받는 사람 수와 예상 비용을 미리 보여 줘요. 화면 예시는 12건 × 7원 = 84원이에요.', pol: ['POL-35'], ref: 'p.59 ①' },
        { n: 2, t: '광고성 금지', d: '할인 행사 같은 광고는 알림톡으로 보낼 수 없어요. 광고는 받겠다고 동의한 보호자에게만 다른 채널로 보내요.', ref: 'p.59 ②' },
        { n: 3, t: '자동 발송 설정', d: '입실, 퇴실, 수강료 안내, 미납 안내, 재등록 안내, 결과지 링크를 하나씩 켜고 꺼요. 켜 두면 그 일이 생길 때 저절로 나가요.', pol: ['POL-35'], ref: 'p.59 ③' },
        { n: 4, t: '잔액과 충전', d: '가맹 센터는 돈을 미리 넣어 두고 쓰는 선불 충전 방식(안)이에요. 충전 요청을 하고 입금하면 본사가 확인한 뒤 잔액을 채워요(HQ-18). 잔액이 모자라면 자동 발송이 멈추기 전에 미리 알려 줘요. 직영 센터는 본사 내부 비용이라 잔액이 안 보여요.', pol: ['POL-34'], ref: 'p.59 ④' },
        { n: 5, t: '발송 내역', d: '언제 무엇을 몇 건 보냈는지, 몇 건 실패했는지, 비용이 얼마인지 남아요. 번호 오류 같은 실패 이유를 보고 보호자 연락처를 고쳐요.', ref: 'p.59 ⑤' },
        { n: 6, t: '잔액 경고와 안전 알림 보호', kind: 'review', imp: 'IMP-26', d: '최근 7일 평균 사용량으로 며칠 쓸 수 있는지 계산해서 3일분(예시) 아래면 미리 알려요. 잔액이 0원이 돼도 입실과 퇴실 알림은 정한 한도까지 보내고, 그 비용은 다음 청구서에 더해요. 잔액은 성공한 건만 빠져요.', pol: ['POL-34'] },
        { n: 7, t: '심사 중인 템플릿은 잠가요', kind: 'review', imp: 'IMP-06', d: '카카오 심사를 통과하지 못한 템플릿은 고를 수 없고 자동 발송도 켤 수 없어요. 심사 중이나 반려 표시가 붙은 줄이 잠긴 줄이에요. 승인되면 다시 켤 수 있어요.' },
        { n: 8, t: '보내기 전에 한 번 더 확인해요', kind: 'review', imp: 'IMP-18', d: '보내기를 누르면 받는 사람 수와 예상 비용, 보낸 뒤에는 취소할 수 없다는 안내를 한 번 더 보여 줘요. 버튼에는 12명에게 보내기처럼 대상 수를 적어요.' },
      ],
      open: ['알림톡 과금 방식을 선불 충전, 월 후불, 본사 부담 중 무엇으로 할지 (POL-34)', '잔액 경고 기준 금액과 며칠분 계산법', '충전할 때 얼마를 어느 계좌로 보내는지', '발송에 실패하면 일반 문자로 대신 보낼지', '실패한 건도 비용을 낼지', '광고 메시지를 보낼 별도 채널'],
      rules: ['광고성 정보는 미리 받겠다고 동의한 사람에게만 보내요. 밤 9시부터 아침 8시 사이에는 따로 동의를 받아야 해요. 법무가 기준을 확인하고 있어요.'],
    },
  });

  B.action('CT14.topupForm', ctx => { if (isDirect(ctx.center)) { say('직영 센터는 충전하지 않아요.'); return; } if (!SET(ctx)) { say('이 역할은 충전을 요청할 수 없어요.'); return; } ctx.ui.topup = true; ctx.ui.tp_err = null; });
  B.action('CT14.topupClose', ctx => { ctx.ui.topup = false; ctx.ui.tp_err = null; });
  B.action('CT14.topup', (ctx, arg) => {
    const ui = ctx.ui;
    if (isDirect(ctx.center)) { say('직영 센터는 충전하지 않아요.'); return; }
    if (!SET(ctx)) { say('이 역할은 충전을 요청할 수 없어요.'); return; }
    const raw = arg && typeof arg === 'object' ? arg.amount : (arg != null ? arg : (ui.tp_amount || '50000'));
    const amount = Number(String(raw).replace(/[,\s원]/g, ''));
    if (!amount || amount < 10000 || amount % 10000 !== 0) { ui.topup = true; ui.tp_amount = String(raw); ui.tp_err = '1만 원 단위로, 1만 원 이상 넣어 주세요.'; return; }
    ctx.s.alim.topups.unshift({ center: ctx.centerId, amount, status: '입금 대기', at: workDate(ctx) });
    ui.topup = false; ui.tp_err = null;
    say(won(amount) + '원 충전을 요청했어요. 입금하면 본사가 확인한 뒤 잔액을 채워요.');
  });
  B.action('CT14.auto', (ctx, arg) => {
    const key = arg && typeof arg === 'object' ? arg.key : arg;
    const a = AUTO.find(x => x[0] === key); if (!a) return;
    const t = ctx.s.alim.templates.find(x => x.id === a[1]);
    if (!t || t.status !== '승인') { say('카카오 심사를 통과한 뒤에 켤 수 있어요.'); return; }
    if (!SET(ctx)) { say('이 역할은 자동 발송을 바꿀 수 없어요.'); return; }
    const on = arg && typeof arg === 'object' && arg.on != null ? !!arg.on : !ctx.s.alim.auto[key];
    ctx.s.alim.auto[key] = on;
    say(a[2] + ' 자동 발송을 ' + (on ? '켰어요.' : '껐어요.'));
  });
  B.action('CT14.confirm', ctx => {
    const t = tplOf(ctx), g = grpOf(ctx), unit = unitOf(), cost = g.n * unit, b = balInfo(ctx);
    const err = sendError(ctx, t, g, cost); if (err) { say(err); return; }
    B.modal({
      title: '알림톡 보내기',
      body: h.kv([['템플릿', t.id + ' ' + t.name], ['받는 사람', g.label + ' ' + g.n + '명'], ['예상 비용', won(cost) + '원' + (b.fr ? ', 잔액 ' + won(b.bal) + '원에서 빠져요' : ', 본사 내부 비용')]]) +
        h.alert('보낸 뒤에는 취소할 수 없어요. 광고 내용이 들어 있지 않은지 한 번 더 봐 주세요.', 'warn'),
      ok: g.n + '명에게 보내기', onOk: () => { B.actions['CT14.send'](B.ctx(), { tpl: t.id, grp: g.id }); },
    });
    return false;
  });
  B.action('CT14.send', (ctx, arg) => {
    const ui = ctx.ui;
    if (arg && typeof arg === 'object') { if (arg.tpl) ui.tpl = arg.tpl; if (arg.grp) ui.grp = arg.grp; }
    const t = tplOf(ctx), g = grpOf(ctx), unit = unitOf(), cost = g.n * unit, b = balInfo(ctx);
    const err = sendError(ctx, t, g, cost); if (err) { say(err); return; }
    ctx.s.alim.log.unshift({ center: ctx.centerId, at: sendTime(ctx), tpl: t.id, n: g.n, ok: g.n, fail: 0, reason: '', cost });
    if (b.fr) ctx.s.alim.balances[ctx.centerId] = b.bal - cost;
    say(g.n + '명에게 보냈어요. 비용 ' + won(cost) + '원' + (b.fr ? '이 잔액에서 빠졌어요.' : '은 본사 내부 비용이에요.'));
  });
  B.action('CT14.fix', ctx => {
    const st = ctx.s.students.find(x => x.center === ctx.centerId && x.status === '재원');
    if (st) { const reg = ctx.s.ui['CT-06'] = ctx.s.ui['CT-06'] || {}; Object.assign(reg, { student: st.id, from: 'CT-14', moveLevel: null }); }
    B.go('CT-06'); return false;
  });

  /* ======================================================================
     CT-15 본사 청구서·거래원장 (p.60, P1b)
     청구서 객체(s.invoices)는 HQ-16, HQ-17과 같이 써요. 상태 흐름은 초안, 확인 대기, 확인 완료, 확정, 입금 완료(또는 연체)예요.
     ====================================================================== */
  const BOOKED = ['확정', '입금 완료', '연체']; // 본사가 확정한 청구서만 거래원장에 적어요
  const invTotal = inv => (inv.lines || []).reduce((a, l) => a + Number(l.a || 0), 0);
  const viewCenter = ctx => (isDirect(ctx.center) ? 'daegu' : ctx.centerId);
  function invOf(ctx) { const cid = viewCenter(ctx); return ctx.s.invoices.filter(i => i.center === cid).sort((a, b) => b.month.localeCompare(a.month))[0]; }
  function invRows(ctx, inv) { return ctx.s.ct15.rows[inv.id] || [{ name: '전체 원생', agg: true, active: '', days: null, bill: '', why: '', amt: inv.lines[0] ? inv.lines[0].a : 0 }]; }
  function disputeOpen(s, inv) {
    const d = inv.dispute; if (!d) return false;
    const m = s.hq16 && s.hq16.inv && s.hq16.inv[inv.id]; if (m && m.disputeDone) return false;
    return !(typeof d === 'object' && /완료|처리|닫|기각|반영|넘김/.test(d.status || ''));
  }
  const isBook = l => l.k === 'book' || /교재|도서|워크북/.test(l.t || '');
  // 이미 입금으로 정산이 끝난 주문이 청구서 줄에 또 들어 있는지 찾아요 (IMP-26)
  function dupOf(ctx, inv, l) {
    if (!isBook(l)) return null;
    const settled = (ctx.s.ct15.ledger[inv.center] || []).filter(r => r.settled);
    return settled.find(r => (l.order && String(l.order) === r.d) || String(l.t).indexOf(r.d) >= 0 || (r.order && String(l.t).indexOf(r.order) >= 0)) || null;
  }
  function billOfOrder(s, o) {
    const inv = s.invoices.find(i => i.center === o.center && (i.lines || []).some(l => l.order === o.id || String(l.t).indexOf(o.id) >= 0));
    return inv ? Number(inv.month.slice(5)) + '월 청구서에 들어 있어요' : '출고한 달 청구서에 더해요';
  }
  function ledgerRows(ctx, cid) {
    const s = ctx.s; let bal = 0; const out = [];
    const orders = s.orders.filter(o => o.center === cid && o.status !== '취소' && Number(o.amount) > 0 && /^\d\d-\d\d$/.test(String(o.orderDate || o.date || '')))
      .map(o => ({ d: o.orderDate || o.date, k: '교재 주문 ' + o.id, amt: Number(o.amount), bill: true, note: billOfOrder(s, o) }));
    // 알림톡 충전 요청(CT-14)과 본사 입금 확인(HQ-18)도 원장에 보여 줘요. 선불이라 잔액에는 더하지 않아요.
    const tops = ((s.alim || {}).topups || []).filter(x => x.center === cid && /^\d{4}-\d\d-\d\d$/.test(String(x.at || '')))
      .map(x => x.status === '충전 완료' ? { d: md(x.at), k: '알림톡 충전', amt: Number(x.amount), prepaid: true, note: '선불, 입금 확인 후 충전' } : { d: md(x.at), k: '알림톡 충전 요청', amt: Number(x.amount), bal: null, pend: true, note: x.status + ', 본사가 입금을 확인하면 충전돼요' });
    const rows = (s.ct15.ledger[cid] || []).concat(orders, tops).sort((a, b) => String(a.d).localeCompare(String(b.d)));
    rows.forEach(r => {
      if (r.inv) {
        const inv = s.invoices.find(i => i.id === r.inv); if (!inv || inv.status === '초안') return;
        const tot = invTotal(inv);
        if (BOOKED.includes(inv.status)) {
          bal += tot; out.push({ d: r.d, k: r.k, amt: tot, bal });
          if (inv.paid) { bal -= inv.paid; out.push({ d: md(inv.paidAt || inv.due), k: '입금', amt: -inv.paid, bal }); }
        } else out.push({ d: r.d, k: r.k, note: '본사가 확정하면 원장에 적혀요', amt: tot, bal: null, pending: true });
        return;
      }
      if (r.pend) { out.push({ d: r.d, k: r.k, note: r.note, amt: r.amt, bal: null, pending: true, wait: true }); return; }
      if (r.bill || r.prepaid) { out.push({ d: r.d, k: r.k, note: r.note, amt: r.amt, bal }); return; }
      bal += r.amt; out.push({ d: r.d, k: r.k, note: r.note, amt: r.amt, bal });
    });
    return out;
  }
  function stChip15(ctx, inv) {
    if (disputeOpen(ctx.s, inv)) return h.chip('이의 처리 중', 'warn');
    if (inv.status === '확인 대기') { const dd = inv.issued ? dayDiff(ctx.s.ct15.date, addDays(inv.issued, 3)) : null; return dash('확인 기간 ' + (dd == null ? '' : dd >= 0 ? 'D-' + dd : '끝남')); }
    const map = { '초안': ['발행 전', ''], '확인 완료': ['센터 확인 완료', 'info'], '확정': ['확정', 'ok'], '입금 완료': ['입금 완료', 'ok'], '연체': ['연체', 'bad'] };
    const m = map[inv.status] || [inv.status, ''];
    return h.chip(m[0], m[1]);
  }

  B.screen({
    id: 'CT-15', side: 'ct', phase: 'P1b', devices: ['pc'], pages: [60],
    title: '본사 청구서·거래원장', menuLabel: '청구서·납부', crumb: '본사 > 청구서·납부',
    headActions: ctx => { const inv = invOf(ctx); const ok = inv && BOOKED.includes(inv.status) && !isDirect(ctx.center); return h.btn('세금계산서 내려받기', { act: 'CT15.tax', disabled: !ok, title: ok ? null : '본사가 확정한 청구서만 세금계산서가 나와요' }); },
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, preview = isDirect(ctx.center), inv = invOf(ctx);
      let html = h.alert(preview
        ? '가맹 센터 전용 화면이에요. 직영 센터는 본사 내부 대체라 청구서가 없고, 실제 서비스에서는 이 메뉴가 보이지 않아요. 아래는 대구수성센터(가맹) 화면을 미리 보기로 보여 줘요.'
        : '가맹 센터 전용 화면이에요. 직영 센터는 본사 내부 대체라 이 메뉴가 보이지 않아요.', preview ? 'warn' : 'info', { pin: 1, title: preview ? '미리 보기' : null });
      if (!inv) return html + '<div style="margin-top:12px">' + h.empty('아직 받은 청구서가 없어요. 첫 청구서는 운영 시작 다음 달 5일에 와요 (예시).') + '</div>';
      const total = invTotal(inv), rows = invRows(ctx, inv), ro = preview || !E(ctx), open = disputeOpen(s, inv), draft = inv.status === '초안';
      const [y, m] = inv.month.split('-');
      if (draft) html += '<div style="margin-top:10px">' + h.alert('본사가 아직 ' + Number(m) + '월 청구서를 발행하지 않았어요. 발행되면 3일(예시) 동안 확인하고 이의를 낼 수 있어요. 아래 금액은 바뀔 수 있어요.', 'info', { title: '발행 전' }) + '</div>';
      const lineRow = l => {
        const dup = dupOf(ctx, inv, l);
        return '<div class="row between" style="font-size:12.3px"><span>' + esc(l.t) + (l.reason ? ' <span class="small muted">' + esc(l.reason) + '</span>' : '') + '</span><span style="font-variant-numeric:tabular-nums">' + won(l.a) + '</span></div>' +
          (dup ? '<div class="small" style="color:var(--bad);font-weight:600;margin:2px 0 4px">' + esc(dup.d + ' 주문은 ' + dup.settled + ' 입금으로 이미 정산했어요. 이의 신청으로 빼 달라고 해요.') + '</div>' : '');
      };
      const lines = '<div style="margin-top:10px;border:1px solid var(--line);border-radius:9px;padding:10px 12px;background:#fafbfc">' + (inv.lines || []).map(lineRow).join('') +
        '<div class="row between" style="border-top:1px solid var(--line);margin-top:6px;padding-top:6px"><b>합계 (예시)</b><b style="font-size:15px;font-variant-numeric:tabular-nums">' + won(total) + '</b></div></div>';
      const d = inv.dispute;
      const dText = d ? (typeof d === 'string' ? d : (d.kind ? '사유는 ' + d.kind + '. ' : '') + (d.memo || d.reason || '')) : '';
      const left = h.card({
        title: Number(y) + '년 ' + Number(m) + '월 청구서', pin: 2, right: stChip15(ctx, inv) + ' ' + h.polChip('POL-02') + h.polChip('POL-03'),
        body: h.table({
          cols: [
            { label: '원생', render: r => r.agg ? esc(r.name) : esc(h.mask(r.name)) },
            { label: '계정 활성', render: r => esc(r.active || '') },
            { label: '활성 일수', num: true, render: r => (r.days == null ? '' : r.days + '일') },
            { label: '과금', render: r => esc(r.bill || '') + (r.why ? ' <span class="small muted">' + esc(r.why) + '</span>' : '') },
            { label: '금액', num: true, render: r => won(r.amt) },
          ],
          rows,
        }) +
          '<div class="small muted" data-pin="8" style="margin-top:8px;display:inline-block;padding-left:14px">활성 일수는 학습 계정이 켜져 있던 날이에요. 휴원, 미수 유예, 가오픈 일수는 빼고 세는 검토안으로 셌어요. 세는 법은 아직 정하지 않았어요 ' + h.polChip('POL-02') + '</div>' +
          lines +
          (d ? '<div style="margin-top:10px">' + h.alert((d.amount ? won(d.amount) + '원 이의' : '이의') + (open ? '를 본사가 보고 있어요. ' : ' 처리 결과 ' + (d.status || '') + '. ') + dText + (open && d.due ? ' 본사 답변 기한 ' + md(d.due) + ' (예시).' : ''), open ? 'warn' : 'ok', { title: '이의 신청' }) + '</div>' : ''),
      });
      const can = !ro && inv.status === '확인 대기' && !open;
      const btns = '<div class="row" data-pin="3" style="margin-top:12px;padding-left:14px">' +
        h.btn('이의 신청', { act: 'CT15.dForm', disabled: !can }) + h.btn('확인 완료', { primary: true, act: 'CT15.confirm', disabled: !can || ctx.partial, title: can && ctx.partial ? '확인 완료는 원장이 눌러요' : null }) +
        (open ? '<span class="small muted">이의를 처리하는 동안에는 확인 완료를 누를 수 없어요.</span>' : draft ? '<span class="small muted">발행되면 누를 수 있어요.</span>' : inv.status === '확인 완료' ? '<span class="small muted">본사 확정을 기다리고 있어요.</span>' : '') + '</div>';
      const form = ui.dform && can ? '<div id="ct15-dform" style="margin-top:12px">' + disputeForm(ctx, inv, rows) + '</div>' : '';
      const paid = inv.paid || 0, hold = open ? Number((d && d.amount) || 0) : 0, payNow = Math.max(0, total - paid - hold);
      const pay = h.card({
        title: '납부', pin: 4, right: h.polChip('POL-04') + h.polChip('POL-05'),
        body: h.kv([
          ['납부 기한', Number(inv.due.slice(5, 7)) + '월 ' + Number(inv.due.slice(8, 10)) + '일 ' + VAR, true],
          ['입금 계좌', s.ct15.account],
          ['상태', h.status(inv.status === '연체' ? '연체' : paid >= total ? '입금 완료' : '미납'), true],
          ['이번에 낼 금액', draft ? '발행 후 정해져요' : won(payNow) + '원'],
        ]) +
          ((inv.status === '연체' || (s.ct15.date > inv.due && paid < total)) ? '<div style="margin-top:8px">' + h.alert('납부 기한이 지났어요. 연체 단계 안내가 나와요. 연체 단계는 아직 정하지 않았어요 (POL-05).', 'bad') + '</div>' : '') +
          '<div style="margin-top:10px">' + h.alert(hold
            ? '이의를 건 ' + won(hold) + '원은 처리될 때까지 내지 않아도 돼요. 나머지 ' + won(payNow) + '원은 기한까지 내요.'
            : '이의를 신청하면 그 금액만 처리될 때까지 미뤄요. 연체 중에도 원생 수납과 환불, 동의 기능은 막지 않아요.', 'review', { pin: 7, title: '검토 반영' }) + '</div>',
      });
      const led = ledgerRows(ctx, inv.center);
      const ledger = h.card({
        title: '거래원장', pin: 5, right: h.polChip('POL-41'),
        body: h.table({
          cols: [
            { label: '일자', render: r => '<span style="white-space:nowrap">' + esc(r.d) + '</span>' },
            { label: '구분', render: r => esc(r.k) + (r.note ? '<div class="small muted">' + esc(r.note) + '</div>' : '') },
            { label: '금액', num: true, render: r => '<span style="white-space:nowrap"' + (r.pending ? ' class="muted"' : '') + '>' + won(r.amt) + '</span>' },
            { label: '잔액', num: true, render: r => (r.bal == null ? h.chip(r.wait ? '입금 대기' : '확정 전', '') : '<span style="white-space:nowrap">' + won(r.bal) + '</span>') },
          ],
          rows: led, empty: '아직 거래가 없어요.',
        }) + '<div style="margin-top:10px">' + h.alert('원장과 청구서를 맞춰 봐서 이미 정산한 주문이 청구서에 또 들어 있으면 빨간 글씨로 알려요. 청구서는 본사가 확정한 뒤에 원장에 적혀요.', 'review', { pin: 6, title: '검토 반영' }) + '</div>',
      });
      html += '<div class="grid" style="margin-top:12px;align-items:start;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr)"><div>' + left + btns + form + '</div><div class="stack">' + pay + ledger + '</div></div>';
      return html;
    },
    mount(root, ctx) { bindRerender(root, ctx); scrollTo(root, ctx); },
    prd: {
      summary: '가맹 센터가 본사에 낼 돈의 월 청구서를 확인하고, 본사와 주고받은 돈의 기록인 거래원장을 봐요.',
      who: '원장이 청구서를 확인하고 이의를 신청해요. 실장·데스크는 일부만 쓸 수 있고, 교사와 보조교사에게는 메뉴가 안 보여요(7쪽 권한표). 일부가 어디까지인지 정해지지 않아서 프로토타입에서는 실장·데스크가 이의 신청까지 하고 확인 완료는 원장만 누르게 했어요.',
      items: [
        { n: 1, t: '대상', d: '가맹 센터만 쓰는 화면이에요. 직영 센터는 사용료를 본사 안에서 처리해서 청구서가 없어요. 직영 계정으로 열면 가맹 예시를 미리 보기로 보여 줘요.', pol: ['POL-01'], ref: 'p.60 ①' },
        { n: 2, t: '청구서', d: '본사가 만든 청구서를 원생별 과금 근거와 함께 봐요. 본사 화면(HQ-17)과 같은 내역이에요. 퇴원이나 월중 등록처럼 과금 규칙이 적용된 이유도 함께 나와요.', pol: ['POL-02', 'POL-03'], ref: 'p.60 ②' },
        { n: 3, t: '이의 신청', d: '확인 기간 안에 원생별로 이의를 신청하면 본사가 조정한 뒤 확정해요. 문제가 없으면 확인 완료를 눌러요.', ref: 'p.60 ③' },
        { n: 4, t: '납부', d: '납부 기한과 입금 계좌, 납부 상태를 보여 줘요. 기한이 지나면 연체 단계 안내가 나와요. 연체 단계는 아직 정하지 않았어요.', pol: ['POL-04', 'POL-05'], ref: 'p.60 ④' },
        { n: 5, t: '거래원장', d: '가맹금, 사용료, 알림톡 충전, 교재 대금, 입금과 잔액을 한 줄씩 봐요. 세금계산서도 여기서 내려받아요. 거래 증빙은 법에 따라 5년 보관해요.', pol: ['POL-41'], ref: 'p.60 ⑤' },
        { n: 6, t: '같은 돈을 두 번 청구하지 않아요', kind: 'review', imp: 'IMP-26', d: '원문 예시는 8월에 이미 입금한 교재 대금 126,000원을 9월 청구서에 또 넣었어요. 거래원장과 청구서를 맞춰 봐서 이런 줄이 있으면 빨간 글씨로 알려 주고, 이의 신청으로 빼 달라고 할 수 있어요. 청구서는 본사가 확정한 뒤에 원장에 적히고 세금계산서도 그때 나와요.' },
        { n: 7, t: '이의 금액만 납부를 미뤄요', kind: 'review', imp: 'IMP-27', d: '이의를 신청할 때 사유를 고르고 증빙을 붙여요. 이의를 건 금액만 처리될 때까지 미루고 나머지는 기한까지 내요. 연체 중에도 원생 수납과 환불은 막지 않아요.' },
        { n: 8, t: '학생별 활성 일수', kind: 'review', imp: 'IMP-22', d: '활성 학생을 어떻게 세는지 정하지 않아서 같은 퇴원생이 화면마다 다르게 나올 수 있었어요. 그래서 학생마다 며칠 활성이었는지 보이게 했어요. 일수는 검토 의견대로 휴원, 미수 유예, 가오픈 날을 빼고 세요. 이의를 처리할 때 근거가 돼요.', pol: ['POL-02'] },
      ],
      open: ['학생 1명당 사용료 금액 (POL-01, 화면 20,000원은 예시)', '활성 학생을 세는 방법 (POL-02)', '청구서 확인 기간과 납부 기한 (POL-04)', '연체 단계 (POL-05)', '부가세를 따로 붙일지', '확인 기간 안에 아무것도 누르지 않으면 저절로 확정할지'],
      rules: ['청구와 입금 증빙은 5년 보관해요 (법정, POL-41).'],
    },
  });

  function disputeForm(ctx, inv, rows) {
    const ui = ctx.ui;
    const opts = rows.map((r, i) => ({ v: 'r' + i, l: h.mask(r.name) + ' ' + won(r.amt) + '원', amt: r.amt, agg: r.agg })).filter(o => o.amt > 0 && !o.agg);
    (inv.lines || []).forEach((l, i) => { if (dupOf(ctx, inv, l)) opts.unshift({ v: 'l' + i, l: String(l.t).replace(/\s*\(.*\)\s*$/, '') + ' ' + won(l.a) + '원 (이미 정산)', amt: l.a }); });
    opts.push({ v: 'all', l: '청구서 전체', amt: invTotal(inv) });
    const cur = opts.find(o => o.v === String(ui.d_row)) || opts[0];
    const amount = ui.d_amount != null && ui.d_amount !== '' ? ui.d_amount : String(cur.amt);
    const reasons = ['이미 낸 금액이 또 있어요', '퇴원일이 달라요', '휴원인데 과금됐어요', '같은 학생이 두 번 과금됐어요', '금액이 달라요', '기타'];
    return h.card({
      title: '이의 신청', sub: '확인 기간 안에만 낼 수 있어요', right: h.btn('닫기', { sm: true, act: 'CT15.dClose' }),
      body: '<div class="grid" style="grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)">' +
        '<div class="field" style="grid-column:1 / -1"><label>대상</label>' + sel('d_row', cur.v, opts, { rerender: true, reset: 'd_amount', style: 'width:100%' }) + '</div>' +
        h.field({ label: '사유', type: 'select', value: ui.d_reason || (cur.v.charAt(0) === 'l' ? reasons[0] : reasons[1]), options: reasons, field: 'd_reason' }) +
        h.field({ label: '이의 금액(원)', req: true, value: amount, field: 'd_amount', err: ui.d_err_amount }) + '</div>' +
        '<div style="margin-top:10px">' + h.field({ label: '내용', req: true, type: 'textarea', value: ui.d_memo || '', field: 'd_memo', err: ui.d_err_memo, ph: '예) 9월 18일 퇴원했는데 계정이 25일까지 켜져 있었어요' }) + '</div>' +
        '<label class="row small" style="margin-top:8px"><input type="checkbox" data-field="d_file"' + (ui.d_file ? ' checked' : '') + '> 증빙 파일을 붙였어요 (출결표, 퇴원 확인서, 입금 내역 캡처)</label>' +
        '<div class="row" style="justify-content:flex-end;margin-top:10px">' + h.btn('이의 신청 보내기', { primary: true, act: 'CT15.dispute' }) + '</div>',
    });
  }

  B.action('CT15.dForm', ctx => { ctx.ui.dform = true; ctx.ui._scroll = 'ct15-dform'; ctx.ui.d_err_memo = null; ctx.ui.d_err_amount = null; });
  B.action('CT15.dClose', ctx => { ctx.ui.dform = false; });
  B.action('CT15.dispute', (ctx, arg) => {
    const ui = ctx.ui, s = ctx.s, inv = invOf(ctx);
    if (!inv || isDirect(ctx.center)) { say('가맹 센터만 이의를 신청할 수 있어요.'); return; }
    if (inv.status !== '확인 대기' || disputeOpen(s, inv)) { say('지금은 이의를 낼 수 없어요. 확인 기간이거나 처리 중인 이의가 없어야 해요.'); return; }
    if (arg && typeof arg === 'object') { ['row', 'reason', 'amount', 'memo', 'file'].forEach(k => { if (arg[k] != null) ui['d_' + k] = String(arg[k]).match(/^\d+$/) && k === 'row' ? 'r' + arg[k] : arg[k]; }); }
    const rows = invRows(ctx, inv);
    const key = String(ui.d_row || '');
    let target;
    if (key === 'all') target = { name: '청구서 전체', amt: invTotal(inv) };
    else if (key.charAt(0) === 'l') { const l = inv.lines[Number(key.slice(1))]; target = l ? { name: l.t, amt: l.a, line: true } : null; }
    else if (key.charAt(0) === 'r') target = rows[Number(key.slice(1))];
    if (!target) { const dl = (inv.lines || []).find(l => dupOf(ctx, inv, l)); target = dl ? { name: dl.t, amt: dl.a, line: true } : rows.find(r => !r.agg && r.amt > 0) || rows[0]; }
    const amount = Number(String(ui.d_amount != null && ui.d_amount !== '' ? ui.d_amount : target.amt).replace(/[,\s원]/g, ''));
    const memo = String(ui.d_memo || '').trim();
    ui.d_err_amount = !amount || amount < 0 || amount > invTotal(inv) ? '0원보다 크고 청구 합계보다 작은 금액을 넣어 주세요.' : null;
    ui.d_err_memo = memo.length < 5 ? '무엇이 다른지 다섯 글자 이상 적어 주세요.' : null;
    if (ui.d_err_amount || ui.d_err_memo) { ui.dform = true; return; }
    const who = target.line || target.name === '청구서 전체' ? target.name : h.mask(target.name);
    const kind = ui.d_reason || (target.line ? '이미 낸 금액이 또 있어요' : '퇴원일이 달라요');
    inv.dispute = { kind, reason: who + ' ' + won(amount) + '원, ' + kind + '. ' + memo, row: target.name, amount, memo, file: !!ui.d_file, at: md(s.ct15.date), by: short(ctx.center) + ' ' + ctx.persona.name, status: '접수', due: addDays(s.ct15.date, 2) };
    const m = s.hq16 && s.hq16.inv && s.hq16.inv[inv.id]; if (m) m.disputeDone = false;
    ui.dform = false; ui.d_memo = ''; ui.d_amount = null;
    say('이의 신청을 보냈어요. 본사가 조정한 뒤 확정해요.');
  });
  B.action('CT15.confirm', ctx => {
    const inv = invOf(ctx);
    if (!inv || isDirect(ctx.center)) { say('가맹 센터만 확인할 수 있어요.'); return; }
    if (inv.status !== '확인 대기' || disputeOpen(ctx.s, inv)) { say('지금은 확인 완료를 누를 수 없어요.'); return; }
    if (!SET(ctx)) { say('확인 완료는 원장이 눌러요.'); return; }
    inv.status = '확인 완료'; inv.confirmedAt = ctx.s.ct15.date; inv.confirmedBy = ctx.persona.name;
    say('청구서를 확인했어요. 본사가 확정하면 거래원장에 적히고 세금계산서가 나와요.');
  });
  B.action('CT15.tax', ctx => { const inv = invOf(ctx); if (!inv || !BOOKED.includes(inv.status)) { say('본사가 확정한 청구서만 세금계산서가 나와요.'); return; } say(Number(inv.month.slice(5)) + '월 세금계산서를 내려받았어요 (예시 파일).'); });

  /* ======================================================================
     CT-16 교재·물품 주문 (p.61)
     ====================================================================== */
  function levelDist(ctx) {
    const cls = ctx.s.classes.filter(c => c.center === ctx.centerId);
    if (cls.length) { const o = {}; cls.forEach(c => { o[c.level] = (o[c.level] || 0) + c.enrolled; }); return o; }
    return Object.assign({}, ctx.s.ct16.dist[ctx.centerId] || {});
  }
  function lines16(ctx) {
    const s = ctx.s, d = s.ct16, dist = levelDist(ctx), wk = d.week[ctx.centerId] || '이번 주';
    const waiting = {}; s.students.filter(x => x.center === ctx.centerId && x.status === '대기').forEach(x => { waiting[x.level] = (waiting[x.level] || 0) + 1; });
    const out = Object.keys(dist).sort().map(L => ({ id: 'wb' + L, level: L, name: L + ' 주간 워크북 (' + wk + ')', type: '필수', price: d.wbPrice, rec: dist[L] + (waiting[L] || 0), basis: '재원 ' + dist[L] + (waiting[L] ? ' + 등록 대기 ' + waiting[L] : '') }));
    d.goods.forEach(g => out.push({ id: g.id, name: g.name, type: g.type, price: g.price, rec: null, def: g.def }));
    return out;
  }
  const qtyOf = (ctx, l) => { const v = ctx.ui['q_' + l.id]; return v != null ? v : String(l.rec != null ? l.rec : l.def || 0); };
  const qnum = v => (/^\s*\d+\s*$/.test(String(v)) ? Number(v) : NaN);
  function totals16(ctx) {
    const ls = lines16(ctx); let req = 0, opt = 0, picked = 0;
    ls.forEach(l => { const q = qnum(qtyOf(ctx, l)); if (!isNaN(q)) { if (l.type === '필수') req += q * l.price; else opt += q * l.price; if (q > 0) picked += 1; } });
    return { ls, req, opt, all: req + opt, picked };
  }

  B.screen({
    id: 'CT-16', side: 'ct', phase: 'P1a', devices: ['pc'], pages: [61],
    title: '교재·물품 주문', menuLabel: '교재·물품 주문', crumb: '본사 > 교재·물품 주문',
    headActions: ctx => { const t = totals16(ctx); return h.btn('장바구니 (' + t.picked + ')', { act: 'CT16.cart', id: 'ct16-cart' }) + h.btn('주문하기', { primary: true, act: 'CT16.submit', disabled: !E(ctx) }); },
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, d = s.ct16, fr = !isDirect(ctx.center), t = totals16(ctx), wd = workDate(ctx);
      const auto = !!d.auto[ctx.centerId];
      let html = '<div class="row between" style="margin-bottom:10px">' +
        '<span data-pin="2" style="display:inline-flex;padding-left:14px">' + dash('이번 주 마감 ' + d.deadline + ', 금 출고 (예시)') + '</span>' +
        '<div class="row small" data-pin="6" style="gap:8px;border:1px solid var(--line);border-radius:9px;padding:5px 10px;background:#fff">' +
        (SET(ctx) ? h.toggle(auto, { act: 'CT16.auto', title: '정기 주문' }) : toggleOff(ctx.partial ? '정기 주문은 원장이 켜고 꺼요' : '바꿀 권한이 없어요').replace('class="toggle"', 'class="toggle' + (auto ? ' on' : '') + '"')) +
        '<span><b>정기 주문</b> <span class="muted">' + (auto ? '매주 ' + d.deadline + ' 마감 전에 권장 수량으로 저절로 주문해요' : '켜면 매주 권장 수량으로 저절로 주문해요') + '</span></span></div></div>';
      if (ui.err_none) html += '<div style="margin-bottom:10px">' + h.alert(ui.err_none, 'bad') + '</div>';
      if (ui.lastOrder) html += '<div style="margin-bottom:10px">' + h.alert(ui.lastOrder, 'ok') + '</div>';
      const table = h.table({
        cols: [
          { label: '품목', render: l => esc(l.name) },
          { label: '구분', render: l => h.chip(l.type, l.type === '필수' ? 'navy' : 'line') },
          { label: '단가', num: true, render: l => '<span class="muted">' + won(l.price) + '</span> ' + VAR },
          { label: '권장 수량', num: true, render: l => (l.rec == null ? '<span class="muted">-</span>' : '<b>' + l.rec + '</b><div class="small muted">' + esc(l.basis) + '</div>') },
          { label: '주문 수량', render: l => { const v = qtyOf(ctx, l), q = qnum(v); const err = ui['err_' + l.id]; const under = l.rec != null && !isNaN(q) && q < l.rec; return '<input class="inp' + (err ? ' bad' : '') + '" style="width:76px" inputmode="numeric" data-field="q_' + l.id + '" data-qty="' + l.id + '" value="' + esc(v) + '"' + (E(ctx) ? '' : ' disabled') + '>' + (err ? '<div class="small" style="color:var(--bad);font-weight:600">' + esc(err) + '</div>' : under ? '<div class="small" style="color:var(--warn)">권장보다 ' + (l.rec - q) + '권 적어요</div>' : ''); } },
          { label: '금액', num: true, render: l => { const q = qnum(qtyOf(ctx, l)); return '<span id="ct16-amt-' + l.id + '">' + (isNaN(q) ? '-' : won(q * l.price)) + '</span>'; } },
        ],
        rows: t.ls,
      });
      const sum = '<div style="margin-top:10px;border:1px solid var(--line);border-radius:9px;padding:10px 12px;background:#fafbfc">' +
        '<div class="row between" style="font-size:12.3px"><span>필수 품목</span><span id="ct16-req" style="font-variant-numeric:tabular-nums">' + won(t.req) + '</span></div>' +
        '<div class="row between" style="font-size:12.3px"><span>권장 품목</span><span id="ct16-opt" style="font-variant-numeric:tabular-nums">' + won(t.opt) + '</span></div>' +
        '<div class="row between" style="border-top:1px solid var(--line);margin-top:6px;padding-top:6px"><b>합계 (예시)' + (fr ? '' : ', 내부 출고') + '</b><b id="ct16-all" style="font-size:15px;font-variant-numeric:tabular-nums">' + won(t.all) + '</b></div></div>';
      html += h.card({
        title: '주문', sub: (d.week[ctx.centerId] || '') + ' 인쇄분', pin: 1, right: h.polChip('POL-09'),
        body: table + '<div style="margin-top:8px">' + h.alert('권장 수량은 추천 값이라 꼭 그만큼 사지 않아도 돼요. 레벨별 재원생 수에 등록을 기다리는 학생 수를 더해 계산하고, 숫자 아래에 계산 근거를 보여 줘요. 마감 뒤에 넣은 주문은 다음 주 마감으로 넘어가요.', 'review', { pin: 7, title: '검토 반영' }) + '</div>' + sum,
      });
      const orders = s.orders.filter(o => o.center === ctx.centerId).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
      const billOf = o => {
        if (!fr) return '내부 출고';
        const inv = s.invoices.find(i => i.center === o.center && (i.lines || []).some(l => l.order === o.id || String(l.t).indexOf(o.id) >= 0));
        if (inv) return Number(inv.month.slice(5)) + '월 청구서';
        const mm = Number(String(o.ship || o.date || '').slice(0, 2));
        return mm ? mm + '월 청구서 예정' : '-';
      };
      const canCancel = o => o.status === '접수' && beforeDeadline(wd);
      html += '<div style="margin-top:12px">' + h.card({
        title: '주문 내역', sub: orders.length + '건', pin: 3,
        body: h.table({
          cols: [
            { label: '주문', render: o => '<span class="mono">' + esc(o.id) + '</span>' },
            { label: '품목', k: 'item' },
            { label: '금액', num: true, render: o => (fr ? won(o.amount) : '<span class="muted">내부</span>') },
            { label: '상태', render: o => h.chip(o.status, { '접수': 'info', '제작': 'info', '출고': 'info', '배송 완료': 'ok', '반품 요청': 'warn', '취소': 'p2' }[o.status] || '') },
            { label: '출고', render: o => esc(o.ship || o.date || '-') },
            { label: '청구', render: o => '<span class="small">' + esc(o.status === '취소' ? '-' : billOf(o)) + '</span>' },
            { label: '', render: o => o.status === '배송 완료' ? h.btn('반품 요청', { sm: true, act: 'CT16.ret', arg: o.id, disabled: !E(ctx) }) : canCancel(o) ? h.btn('취소', { sm: true, act: 'CT16.cancel', arg: o.id, disabled: !E(ctx) }) : '' },
          ],
          rows: orders, empty: '아직 주문한 내역이 없어요.',
        }) + '<div style="margin-top:8px">' + h.alert(fr ? '청구 칸은 이 주문 대금이 들어갈 청구서예요. 이미 낸 주문은 청구서에 다시 넣지 않고, 주문하면 거래원장(CT-15)에 바로 한 줄 생겨요.' : '청구 칸은 이 주문 대금을 어떻게 처리하는지 보여 줘요. 직영은 내부 출고라 청구서가 없어요. 가맹은 들어갈 청구서 달이 나와요.', 'review', { pin: 5, title: '검토 반영' }) + '</div>',
      }) + '</div>';
      html += '<div class="small muted" data-pin="4" style="margin-top:12px;display:inline-block;padding-left:14px">가맹 센터 대금은 거래원장에 적혔다가 다음 청구서에 더해져요. 직영은 내부 출고예요. 학부모 교재비는 센터 설정에서 정해요 ' + h.polChip('POL-14') + '</div>';
      return html;
    },
    mount(root, ctx) {
      root.querySelectorAll('[data-qty]').forEach(el => el.addEventListener('input', () => {
        ctx.ui[el.getAttribute('data-field')] = el.value;
        const t = totals16(ctx);
        t.ls.forEach(l => { const q = qnum(qtyOf(ctx, l)); const a = root.querySelector('#ct16-amt-' + l.id); if (a) a.textContent = isNaN(q) ? '-' : won(q * l.price); });
        const set = (id, v) => { const e = root.querySelector('#' + id); if (e) e.textContent = v; };
        set('ct16-req', won(t.req)); set('ct16-opt', won(t.opt)); set('ct16-all', won(t.all));
        const cart = root.querySelector('#ct16-cart'); if (cart) cart.textContent = '장바구니 (' + t.picked + ')';
      }));
    },
    prd: {
      summary: '센터가 본사에서 교재와 도서 키트, 홍보물을 주문하고 배송 상태를 봐요. 교재는 매주 마감 시각까지 주문해야 그 주에 받아요.',
      who: '원장은 모두 쓰고 실장·데스크는 일부만 써요. 교사와 보조교사에게는 메뉴가 안 보여요(7쪽 권한표). 일부가 어디까지인지 정해지지 않아서 프로토타입에서는 실장·데스크도 주문하고 정기 주문 켜기만 원장이 해요.',
      items: [
        { n: 1, t: '주문', d: '본사가 등록한 품목만 주문해요. 필수 품목은 레벨별 재원생 수로 권장 수량을 미리 채워 줘요. 단가 옆 가변 표시는 나중에 값이 바뀔 수 있다는 뜻이에요.', pol: ['POL-09'], ref: 'p.61 ①' },
        { n: 2, t: '주간 마감', d: '교재는 처음에 주마다 인쇄해요. 수요일 18시까지 주문하면 그 주 금요일에 나가요(예시).', ref: 'p.61 ②' },
        { n: 3, t: '주문 내역', d: '제작, 출고, 배송 상태를 보고 배송이 끝난 주문은 반품을 요청해요. 접수 상태인 주문은 마감 전까지 취소할 수 있어요.', ref: 'p.61 ③' },
        { n: 4, t: '대금', d: '가맹 센터 주문 대금은 거래원장에 적혔다가 월 청구서에 더해져요. 직영은 본사 안에서 내부 출고로 처리해요. 학부모에게 받는 교재비는 센터 설정에서 따로 정해요.', pol: ['POL-14'], ref: 'p.61 ④' },
        { n: 5, t: '청구될 달 표시', kind: 'review', imp: 'IMP-26', d: '주문마다 어느 달 청구서에 들어가는지 보여 줘요. 이미 낸 주문은 청구서에 다시 넣지 않아요. 가맹 센터가 주문하면 거래원장(CT-15)에도 바로 한 줄 생겨요.' },
        { n: 6, t: '정기 주문', kind: 'review', imp: 'IMP-28', d: '혼자 운영하는 교습소 원장은 매주 주문을 챙기기 어려워요. 정기 주문을 켜 두면 매주 마감 전에 권장 수량으로 저절로 주문해요. 마감 전까지는 수량을 고칠 수 있어요.' },
        { n: 7, t: '권장 수량 계산 근거', kind: 'review', imp: 'IMP-19', d: '권장 수량은 추천 값이에요. 재원생 수에 등록을 기다리는 학생 수를 더해 계산하고, 그 근거를 숫자 아래에 보여 줘요. 권장보다 적게 넣으면 몇 권 모자란지 알려 줘요.' },
      ],
      open: ['필수 품목과 공급가 계산 방식 (POL-09, 가맹계약서에 적어야 해요)', '학부모에게 받는 교재비 금액 (POL-14)', '주문 마감 요일과 시각', '주문 수정과 반품 조건', '마감 뒤 들어온 신규생 몫을 따로 조금 주문하는 규칙'],
    },
  });

  function validate16(ctx) {
    const ui = ctx.ui, ls = lines16(ctx); let any = false, bad = false;
    ls.forEach(l => { const q = qnum(qtyOf(ctx, l)); ui['err_' + l.id] = isNaN(q) ? '0 이상 숫자로 넣어 주세요.' : null; if (isNaN(q)) bad = true; else if (q > 0) any = true; });
    ui.err_none = !bad && !any ? '주문할 수량을 하나 이상 넣어 주세요.' : null;
    return !bad && any;
  }
  function summary16(ctx) {
    const ls = lines16(ctx), wk = ctx.s.ct16.week[ctx.centerId] || '';
    const wb = ls.filter(l => l.level && qnum(qtyOf(ctx, l)) > 0).map(l => l.level);
    const parts = [];
    if (wb.length) parts.push((wb.length > 2 ? wb[0] + '~' + wb[wb.length - 1] : wb.join(', ')) + ' 주간 워크북 (' + wk + ')');
    ls.filter(l => !l.level && qnum(qtyOf(ctx, l)) > 0).forEach(l => parts.push(l.name + ' ' + qnum(qtyOf(ctx, l))));
    return parts.join(', ');
  }
  B.action('CT16.auto', ctx => { if (!SET(ctx)) { say('정기 주문은 원장이 켜고 꺼요.'); return; } const a = ctx.s.ct16.auto; a[ctx.centerId] = !a[ctx.centerId]; say(a[ctx.centerId] ? '정기 주문을 켰어요. 매주 마감 전에 권장 수량으로 주문해요.' : '정기 주문을 껐어요.'); });
  B.action('CT16.cart', ctx => {
    const t = totals16(ctx), fr = !isDirect(ctx.center);
    const list = t.ls.filter(l => qnum(qtyOf(ctx, l)) > 0);
    B.modal({
      title: '장바구니 (' + list.length + ')',
      body: list.length ? h.kv(list.map(l => [l.name, qnum(qtyOf(ctx, l)) + '개, ' + won(qnum(qtyOf(ctx, l)) * l.price) + '원'])) + '<div class="row between"><b>합계 (예시)</b><b>' + won(t.all) + '원' + (fr ? '' : ' (내부 출고)') + '</b></div>' : '<div class="muted">담긴 품목이 없어요.</div>',
      ok: list.length ? '주문하기' : null, cancel: '닫기',
      onOk: () => { const c = B.ctx(); if (!validate16(c)) return true; B.actions['CT16.order'](c, null); return true; },
    });
    return false;
  });
  B.action('CT16.submit', ctx => {
    if (!validate16(ctx)) return;
    const t = totals16(ctx), fr = !isDirect(ctx.center), ship = shipOf(workDate(ctx));
    B.modal({
      title: '주문 확인',
      body: h.kv([['품목', summary16(ctx)], ['합계 (예시)', won(t.all) + '원'], ['출고', md(ship) + ' (금)'], ['대금', fr ? (Number(ship.slice(5, 7)) + '월 청구서에 더해져요') : '내부 출고라 청구서가 없어요']]),
      ok: t.picked + '개 품목 주문하기', onOk: () => { B.actions['CT16.order'](B.ctx(), null); },
    });
    return false;
  });
  B.action('CT16.order', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui, fr = !isDirect(ctx.center), wd = workDate(ctx);
    if (!ctx.canEdit) { say('이 역할은 주문할 수 없어요.'); return; }
    if (arg && typeof arg === 'object') Object.keys(arg).forEach(k => { ui[k.indexOf('q_') === 0 ? k : 'q_' + k] = String(arg[k]); });
    if (!validate16(ctx)) return;
    const t = totals16(ctx), ship = shipOf(wd);
    const max = s.orders.reduce((a, o) => Math.max(a, Number(String(o.id).replace(/\D/g, '')) || 0), 0);
    const id = '#' + String(max + 1).padStart(4, '0');
    const qty = t.ls.reduce((a, l) => a + (qnum(qtyOf(ctx, l)) || 0), 0);
    const bill = fr ? Number(ship.slice(5, 7)) + '월 청구서' : '내부 출고';
    // 거래원장(CT-15)은 s.orders에서 가맹 주문 줄을 바로 만들어요
    s.orders.push({ id, center: ctx.centerId, item: summary16(ctx), qty, amount: fr ? t.all : 0, status: '접수', date: md(wd), orderDate: md(wd), ship: md(ship) });
    ui.lastOrder = id + ' 주문을 넣었어요. ' + md(ship) + '(금)에 출고돼요.' + (fr ? ' 대금 ' + won(t.all) + '원은 ' + bill + '에 더해져요.' : '');
    ui.err_none = null;
    say(id + ' 주문을 넣었어요.');
  });
  B.action('CT16.cancel', (ctx, id) => {
    const o = ctx.s.orders.find(x => x.id === id && x.center === ctx.centerId);
    if (!o || o.status !== '접수') { say('접수 상태인 주문만 취소할 수 있어요.'); return; }
    if (!beforeDeadline(workDate(ctx))) { say('이번 주 마감이 지나서 취소할 수 없어요.'); return; }
    o.status = '취소';
    if (ctx.ui.lastOrder && ctx.ui.lastOrder.indexOf(id) === 0) ctx.ui.lastOrder = null;
    say(id + ' 주문을 취소했어요.');
  });
  B.action('CT16.ret', (ctx, arg) => {
    const id = arg && typeof arg === 'object' ? arg.id : arg, reason = arg && typeof arg === 'object' ? arg.reason : null;
    const o = ctx.s.orders.find(x => x.id === id && x.center === ctx.centerId);
    if (!o || o.status !== '배송 완료') { say('배송이 끝난 주문만 반품을 요청할 수 있어요.'); return; }
    const done = r => { o.status = '반품 요청'; o.returnReason = r; say(id + ' 반품을 요청했어요. 본사가 확인하면 연락해요.'); };
    if (reason) { done(reason); return; }
    B.modal({
      title: id + ' 반품 요청',
      body: '<div class="field"><label for="ct16-ret">반품 사유</label><select class="inp" id="ct16-ret"><option>파손</option><option>잘못 인쇄</option></select></div><div class="small muted">주문 수량만큼 찍는 인쇄물이라 파손이나 잘못 인쇄된 경우만 받는 안이에요 (예시).</div>',
      ok: '반품 요청', onOk: back => { done(back.querySelector('#ct16-ret').value); },
    });
    return false;
  });

  /* ======================================================================
     CT-17 본사 공지·자료실·1:1 문의 (p.62)
     ====================================================================== */
  const TABS17 = [['notice', '공지'], ['files', '자료실'], ['qna', '1:1 문의'], ['docs', '제출 서류'], ['views', '본사 열람 기록']];
  const PHONE = /01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/;
  function docsOf(ctx) {
    const s = ctx.s, d = s.ct17.docs;
    d[ctx.centerId] = d[ctx.centerId] || [{ id: 'd1', name: '배상책임보험 증권', status: '승인', exp: '2028-02-28' }, { id: 'd2', name: '종사자 경력 조회', linked: true }];
    return d[ctx.centerId];
  }
  function viewsOf(ctx) {
    const s = ctx.s, c = ctx.center, own = (s.ct17.views[ctx.centerId] || []).slice();
    const fromAudit = s.audit.filter(a => c && a.target && a.target.indexOf(c.name) === 0 && /지원 모드|마스킹 해제|열람/.test(a.what))
      .map((a, i) => ({ id: 'a' + i, at: a.at, who: a.who, reason: a.reason, screens: a.target, acts: a.what }));
    return own.concat(fromAudit).sort((x, y) => String(y.at).localeCompare(String(x.at)));
  }

  function sec17(ctx, key, full) {
    const s = ctx.s, ui = ctx.ui, c = ctx.center;
    if (key === 'notice') {
      let ns = s.notices.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
      if (full && ui.nf === '필독만') ns = ns.filter(n => n.must);
      if (full && ui.nf === '안 읽음') ns = ns.filter(n => !(n.read || {})[ctx.centerId]);
      if (!full) ns = ns.slice(0, 3);
      const readCell = n => {
        const done = (n.read || {})[ctx.centerId];
        const by = (s.ct17.readBy[n.id] || []).filter(x => x.center === ctx.centerId)[0];
        if (n.must && !done) return h.btn('확인하기', { sm: true, act: 'CT17.read', arg: n.id, disabled: !E(ctx) });
        return done ? '확인' + (by ? ' <span class="small muted">' + esc(by.at + ' ' + by.name) + '</span>' : '') : '<span class="muted">읽지 않음</span>';
      };
      let body = (full ? '<div style="margin-bottom:8px">' + h.opts(['전체', '필독만', '안 읽음'], ui.nf || '전체', { act: 'CT17.nf' }) + '</div>' : '') +
        h.table({
          cols: [
            { label: '구분', render: n => esc(n.cat || '운영') },
            { label: '제목', render: n => esc(n.title) },
            { label: '필독', render: n => (n.must ? '●' : '') },
            { label: '확인', render: readCell },
            { label: '게시일', render: n => esc(md(n.date)) },
          ],
          rows: ns, empty: '조건에 맞는 공지가 없어요.',
          rowAttr: full ? n => ' class="click' + (ui.nsel === n.id ? ' sel' : '') + '" data-act="CT17.open" data-arg="' + n.id + '"' : null,
        });
      if (full && ui.nsel) { const n = s.notices.find(x => x.id === ui.nsel); if (n) body += '<div style="margin-top:10px">' + h.alert(s.ct17.bodies[n.id] || '본문 예시예요. 실제 공지 본문이 여기에 나와요.', 'info', { title: n.title }) + '</div>'; }
      const unread = s.notices.filter(n => n.must && !(n.read || {})[ctx.centerId]).length;
      return h.card({ title: '공지', sub: '필독 안 읽음 ' + unread + '건', pin: 1, right: full ? '' : h.btn('전체 보기', { sm: true, act: 'CT17.tab', arg: 'notice' }), body });
    }
    if (key === 'files') {
      const fs = s.ct17.files;
      return h.card({
        title: '자료실', pin: 2, right: full ? '' : h.btn('전체 보기', { sm: true, act: 'CT17.tab', arg: 'files' }),
        body: h.table({
          cols: [{ label: '자료', render: f => esc(f.name) + (full ? ' <span class="small muted">' + esc(f.cat) + '</span>' : '') }, { label: '버전', k: 'ver' },
            { label: '', render: f => h.btn(f.kind, { sm: true, act: 'CT17.get', arg: f.id }) + (full && s.ct17.dl[f.id] ? ' <span class="small muted">' + s.ct17.dl[f.id] + '번 받음</span>' : '') }],
          rows: fs,
        }),
      });
    }
    if (key === 'qna') {
      const qs = s.inquiries.filter(q => q.center === ctx.centerId).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.no || '').localeCompare(String(a.no || '')));
      const list = full ? qs : qs.slice(0, 3);
      let body = '';
      if (full && ui.qform) body += qnaForm(ctx);
      body += h.table({
        cols: [{ label: '번호', render: q => '<span class="mono small">' + esc(q.no || '-') + '</span>' }, { label: '분류', render: q => esc(q.cat || '운영') }, { label: '제목', k: 'title' }, { label: '상태', render: q => h.status(q.status) }],
        rows: list, empty: '아직 남긴 문의가 없어요.',
        rowAttr: full ? q => ' class="click' + (ui.qsel === q.id ? ' sel' : '') + '" data-act="CT17.qopen" data-arg="' + q.id + '"' : null,
      });
      if (full && ui.qsel) {
        const q = s.inquiries.find(x => x.id === ui.qsel);
        if (q) body += '<div class="stack" style="margin-top:10px">' + h.alert(q.body || '내용 없음', 'info', { title: '문의 ' + (q.no || q.id) }) + h.alert(q.answer || '아직 답변이 없어요. 보통 2일 안에 답해요 (예시).', q.answer ? 'ok' : 'warn', { title: '본사 답변' }) + '</div>';
      }
      body += '<div style="margin-top:10px">' + h.alert('원생 이름과 전화번호는 적지 말고 원생 번호로 남겨요. 본사는 원생 정보를 꼭 필요한 만큼만 받아요.', 'review', { pin: 8, title: '검토 반영' }) + '</div>';
      return h.card({ title: '1:1 문의', sub: '보통 2일 안에 답해요 (예시)', pin: 3, right: full ? '' : h.btn('전체 보기', { sm: true, act: 'CT17.tab', arg: 'qna' }), body });
    }
    if (key === 'docs') {
      const docs = docsOf(ctx), staff = s.staff.filter(x => x.center === ctx.centerId), done = staff.filter(x => x.check).length;
      const row = dc => {
        if (dc.linked) return { name: dc.name, status: staff.length && done === staff.length ? '완료' : '보완 요청', exp: '-', act: '<span data-pin="6" style="display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap;padding-left:14px"><span class="small">CT-20 조회일 기준 ' + staff.length + '명 중 ' + done + '명 완료, 원본은 올리지 않아요</span>' + h.btn('CT-20에서 입력', { sm: true, go: 'CT-20' }) + '</span>' };
        return { name: dc.name, status: dc.status, exp: dc.exp || '-', act: h.btn(dc.status === '승인' ? '갱신본 올리기' : dc.status === '검토 중' ? '검토 중' : '올리기', { sm: true, act: 'CT17.upload', arg: dc.id, disabled: !E(ctx) || dc.status === '검토 중' }) + (dc.uploaded ? ' <span class="small muted">' + esc(dc.uploaded) + ' 올림</span>' : '') };
      };
      return h.card({
        title: '제출 서류', sub: '만료 30일 전에 다시 요청해요 (HQ-06, 예시)', pin: 4, right: full ? '' : h.btn('전체 보기', { sm: true, act: 'CT17.tab', arg: 'docs' }),
        body: h.table({ cols: [{ label: '서류', k: 'name' }, { label: '상태', render: r => h.status(r.status) }, { label: '만료', k: 'exp' }, { label: '', render: r => r.act }], rows: docs.map(row) }),
      });
    }
    // views
    const vs = viewsOf(ctx), list = full ? vs : vs.slice(0, 2), er = s.ct17.editReq[ctx.centerId];
    let body = h.table({
      cols: [{ label: '일시', k: 'at' }, { label: '본사 사용자', k: 'who' }, { label: '사유', k: 'reason' }],
      rows: list, empty: '본사가 이 센터 화면을 연 기록이 없어요.',
      rowAttr: v => ' class="click' + (ui.vsel === v.id ? ' sel' : '') + '" data-act="CT17.vopen" data-arg="' + v.id + '"',
    });
    if (ui.vsel) { const v = vs.find(x => x.id === ui.vsel); if (v) body += '<div style="margin-top:8px">' + h.kv([['시작', v.at], ['끝', v.end || '기록 없음'], ['본 화면', v.screens || '-'], ['한 일', v.acts || '-']]) + '</div>'; }
    body += '<div data-pin="7" style="margin-top:10px;border:1px solid var(--review-soft);background:#faf8ff;border-radius:9px;padding:9px 11px">' +
      '<div class="row between"><b style="font-size:12.5px;color:var(--review)">편집 요청 ' + h.chip('P1b', 'p1b') + '</b>' + (er ? h.status(er.status) : '') + '</div>' +
      (er ? '<div style="margin-top:6px">' + h.kv([['요청한 사람', er.who + ' (' + er.at + ')'], ['고칠 화면', er.screen], ['사유', er.reason]].concat(er.decidedBy ? [['정한 사람', er.decidedBy + ' (' + er.decidedAt + ')']] : [])) + '</div>' +
        (er.status === '대기' ? '<div class="row" style="margin-top:6px">' + h.btn('승인', { sm: true, primary: true, act: 'CT17.edit', arg: 'ok', disabled: ctx.role !== '원장', title: ctx.role !== '원장' ? '원장만 정해요' : null }) + h.btn('거절', { sm: true, act: 'CT17.edit', arg: 'no', disabled: ctx.role !== '원장' }) + '</div>' : '')
        : '<div class="small muted" style="margin-top:4px">본사가 센터 화면을 고치겠다고 요청하면 원장이 여기서 승인하거나 거절해요.</div>') +
      '<div class="small muted" style="margin-top:4px">기록을 누르면 시작과 끝 시각, 본 화면, 한 일이 펼쳐져요.</div></div>';
    return h.card({ title: '본사 열람 기록', sub: '지원 모드 (CM-02)', pin: 5, right: (full ? '' : h.btn('전체 보기', { sm: true, act: 'CT17.tab', arg: 'views' })) + h.polChip('POL-42'), body });
  }

  function qnaForm(ctx) {
    const ui = ctx.ui;
    return '<div class="card" style="background:#fafbfc;margin-bottom:10px"><div class="card-h"><h3>새 문의</h3><div class="r">' + h.btn('닫기', { sm: true, act: 'CT17.qclose' }) + '</div></div>' +
      '<div class="grid" style="grid-template-columns:160px minmax(0,1fr);gap:10px">' +
      h.field({ label: '분류', type: 'select', value: ui.q_cat || '운영', options: ['정산', '시스템', '교재', '운영'], field: 'q_cat' }) +
      h.field({ label: '제목', req: true, value: ui.q_title || '', field: 'q_title', err: ui.q_err_title, ph: '무엇이 궁금한지 한 줄로 적어요' }) + '</div>' +
      '<div style="margin-top:10px">' + h.field({ label: '내용', req: true, type: 'textarea', value: ui.q_body || '', field: 'q_body', err: ui.q_err_body, ph: '원생은 원생 번호(예 s3)로 적어요' }) + '</div>' +
      '<label class="row small" style="margin-top:8px"><input type="checkbox" data-field="q_file"' + (ui.q_file ? ' checked' : '') + '> 화면 캡처를 붙였어요</label>' +
      '<div class="row" style="justify-content:flex-end;margin-top:8px">' + h.btn('문의 보내기', { primary: true, act: 'CT17.ask', disabled: !E(ctx) }) + '</div></div>';
  }

  B.screen({
    id: 'CT-17', side: 'ct', phase: 'P1a', devices: ['pc'], pages: [62],
    title: '본사 공지·자료실·1:1 문의', menuLabel: '공지·자료실·문의', crumb: '본사 > 공지·자료실·문의',
    headActions: ctx => h.btn('+ 문의하기', { primary: true, act: 'CT17.new', disabled: !E(ctx) }),
    render(ctx) {
      const ui = ctx.ui, cur = ui.tab || 'notice';
      let html = '<div class="tabs" role="tablist">' + TABS17.map(t => '<button type="button" data-act="CT17.tab" data-arg="' + t[0] + '" class="' + (t[0] === cur ? 'on' : '') + '">' + esc(t[1]) + '</button>').join('') + '</div>';
      html += sec17(ctx, cur, true);
      html += '<div class="grid g2" style="margin-top:12px;align-items:start">' + TABS17.filter(t => t[0] !== cur).map(t => sec17(ctx, t[0], false)).join('') + '</div>';
      return html;
    },
    prd: {
      summary: '본사 공지와 자료를 보고, 본사에 1:1로 묻고, 필요한 서류를 내요. 본사가 우리 센터 화면을 언제 왜 열어 봤는지도 확인해요.',
      who: '주로 원장이 써요. 7쪽 권한표에 이 메뉴 줄이 없어서, 프로토타입에서는 원장과 실장·데스크가 쓰고 교사와 보조교사는 보기만 하게 두었어요.',
      items: [
        { n: 1, t: '공지', d: '본사 공지를 봐요. 필독 공지는 확인하기를 눌러야 본사 확인율(HQ-21)에 잡혀요. 누가 언제 눌렀는지도 남아요.', ref: 'p.62 ①' },
        { n: 2, t: '자료실', d: '운영 매뉴얼, 교습비 게시표 양식, 교육 영상을 버전별로 내려받아요.', ref: 'p.62 ②' },
        { n: 3, t: '1:1 문의', d: '정산, 시스템, 교재, 운영 문의를 남기고 처리 상태를 봐요. 오른쪽 위 문의하기로 새 문의를 쓰고, 문의를 누르면 본사 답변이 보여요.', ref: 'p.62 ③' },
        { n: 4, t: '제출 서류', d: '운영을 시작할 때와 정기 갱신 때 내는 서류를 올리고 본사 검토 결과를 봐요(HQ-06).', ref: 'p.62 ④' },
        { n: 5, t: '본사 열람 기록', d: '본사가 지원 모드로 우리 센터 화면을 연 기록과 사유를 센터도 봐요(CM-02). 본사가 원생 정보를 어디까지 볼지는 아직 안이에요. 지금 안은 기본으로 가려서 보여 주는 거예요.', pol: ['POL-42'], ref: 'p.62 ⑤' },
        { n: 6, t: '경력 조회는 결과 원본 대신 조회일만', kind: 'review', imp: 'IMP-16', d: '성범죄와 아동학대 경력 조회 결과는 아주 민감한 정보예요. 원본 파일은 올리지 않고, 교직원 계정(CT-20)에 적은 조회일로 몇 명이 조회를 마쳤는지만 보여 줘요.' },
        { n: 7, t: '열람 상세와 편집 동의', kind: 'review', imp: 'IMP-14', d: '열람 기록을 누르면 시작과 끝 시각, 본 화면, 한 일이 펼쳐져요. 본사가 센터 화면을 고치겠다고 요청하면 원장이 여기서 승인하거나 거절해요. 편집 요청은 P1b 기능이에요.' },
        { n: 8, t: '문의에 원생 정보 적지 않기', kind: 'review', imp: 'IMP-04', d: '본사는 가맹 원생 정보를 맡아서 처리하는 쪽이라 꼭 필요한 것만 받아야 해요. 문의 내용에 전화번호가 들어가면 보내기를 막고 원생 번호로 남기라고 알려요.', pol: ['POL-42'] },
      ],
      open: ['7쪽 권한표에 공지, 자료실, 1:1 문의 줄이 없어서 역할별 권한을 정해야 해요', '필독 공지를 센터에서 누가 눌러야 확인으로 칠지', '1:1 문의 답변 기한 (HQ-21 화면은 2일, 예시)', '본사가 볼 수 있는 원생 정보 범위 (POL-42)'],
      rules: ['종사자 경력 조회 결과는 민감한 정보라 원본을 본사로 보내지 않아요. 본사가 어디까지 확인할지는 법무가 정해요.'],
    },
  });

  B.action('CT17.tab', (ctx, v) => { ctx.ui.tab = v || 'notice'; });
  B.action('CT17.nf', (ctx, v) => { ctx.ui.nf = v; });
  B.action('CT17.open', (ctx, id) => {
    const n = ctx.s.notices.find(x => x.id === id); if (!n) return;
    ctx.ui.nsel = ctx.ui.nsel === id ? null : id;
    if (!n.must) { n.read = n.read || {}; n.read[ctx.centerId] = true; }
  });
  B.action('CT17.read', (ctx, id) => {
    const n = ctx.s.notices.find(x => x.id === (id || 'n-ct17-1')); if (!n) return;
    n.read = n.read || {}; n.read[ctx.centerId] = true;
    const rb = ctx.s.ct17.readBy[n.id] = ctx.s.ct17.readBy[n.id] || [];
    rb.push({ center: ctx.centerId, name: ctx.persona.name, role: ctx.persona.role, at: md(ctx.today) });
    say('확인했어요. 본사 확인율에 반영돼요.');
  });
  B.action('CT17.get', (ctx, id) => { const f = ctx.s.ct17.files.find(x => x.id === id); if (!f) return; ctx.s.ct17.dl[id] = (ctx.s.ct17.dl[id] || 0) + 1; say(f.name + ' ' + f.ver + (f.kind === '보기' ? ' 영상을 열었어요.' : ' 파일을 내려받았어요.')); });
  B.action('CT17.new', ctx => { ctx.ui.tab = 'qna'; ctx.ui.qform = true; ctx.ui.q_err_title = null; ctx.ui.q_err_body = null; });
  B.action('CT17.qclose', ctx => { ctx.ui.qform = false; });
  B.action('CT17.qopen', (ctx, id) => { ctx.ui.qsel = ctx.ui.qsel === id ? null : id; });
  B.action('CT17.ask', (ctx, arg) => {
    const ui = ctx.ui, s = ctx.s;
    if (arg && typeof arg === 'object') ['cat', 'title', 'body', 'file'].forEach(k => { if (arg[k] != null) ui['q_' + k] = arg[k]; });
    ui.tab = 'qna'; ui.qform = true;
    const title = String(ui.q_title || '').trim(), body = String(ui.q_body || '').trim();
    ui.q_err_title = !title ? '제목을 넣어 주세요.' : null;
    ui.q_err_body = !body ? '내용을 넣어 주세요.' : PHONE.test(body + ' ' + title) ? '전화번호는 적지 말아 주세요. 원생은 원생 번호(예 s3)로 남겨요.' : null;
    if (ui.q_err_title || ui.q_err_body) return;
    const max = s.inquiries.reduce((a, q) => Math.max(a, Number(String(q.no || '').replace(/\D/g, '')) || 0), 1000);
    const q = { id: 'q' + (max + 1), no: '#' + (max + 1), center: ctx.centerId, cat: ui.q_cat || '운영', title, body, file: !!ui.q_file, status: '접수', date: md(ctx.today), by: ctx.persona.name };
    s.inquiries.push(q);
    ui.qform = false; ui.qsel = q.id; ui.q_title = ''; ui.q_body = ''; ui.q_file = false;
    say('문의 ' + q.no + '를 남겼어요. 보통 2일 안에 답해요 (예시).');
  });
  B.action('CT17.upload', (ctx, id) => {
    const dc = docsOf(ctx).find(x => x.id === id); if (!dc || dc.linked) return;
    dc.status = '검토 중'; dc.uploaded = md(ctx.today);
    say(dc.name + ' 파일을 올렸어요. 본사가 검토하면 결과가 여기에 나와요.');
  });
  B.action('CT17.vopen', (ctx, id) => { ctx.ui.vsel = ctx.ui.vsel === id ? null : id; });
  B.action('CT17.edit', (ctx, arg) => {
    const er = ctx.s.ct17.editReq[ctx.centerId]; if (!er || er.status !== '대기') return;
    if (ctx.role !== '원장') { say('편집 요청은 원장만 정해요.'); return; }
    er.status = arg === 'no' ? '거절' : '승인'; er.decidedBy = ctx.persona.name; er.decidedAt = md(ctx.today);
    say(er.status === '승인' ? '편집 요청을 승인했어요. 본사가 고친 내용도 열람 기록에 남아요.' : '편집 요청을 거절했어요.');
  });
})();
