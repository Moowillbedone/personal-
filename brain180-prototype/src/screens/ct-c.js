/* CT-08 월 재등록 일괄 청구, CT-09 수납 내역·미수·일일 마감, CT-10 휴원·퇴원·환불, CT-11 반·시간표, CT-12 출결·보강. 원문 53~57쪽. */
(function () {
  const B = window.B, h = B.h, esc = B.esc;

  /* ---------------- 공용 도우미 (이 파일 전용) ---------------- */
  const U = (s, id) => (s.ui[id] = s.ui[id] || {});
  const num = n => Number(n || 0).toLocaleString('ko-KR');
  const pad = n => String(n).padStart(2, '0');
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const dow = d => DOW[new Date(d + 'T00:00:00Z').getUTCDay()];
  const addDays = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  const dayDiff = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5);
  const mdS = d => Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10));
  const dim = ym => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
  const HOLI = { '2027-03-01': '삼일절' };
  const dayList = days => String(days || '').split('·').map(x => x.trim()).filter(Boolean);
  const span = t => String(t || '').split('~');
  const toMin = hm => { const p = String(hm || '0:0').split(':').map(Number); return p[0] * 60 + (p[1] || 0); };
  const fromMin = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  const overlap = (t1, t2) => { const a = span(t1).map(toMin), b = span(t2).map(toMin); return a[0] < b[1] && b[0] < a[1]; };
  const shareDay = (d1, d2) => dayList(d1).some(x => dayList(d2).includes(x));
  const okTime = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || ''));
  const okDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
  // 반의 요일로 그달 수업 날짜를 세요. 공휴일은 빼고, from이 있으면 그날부터 세요.
  function sessions(days, ym, from) {
    const out = [], ds = dayList(days), n = dim(ym);
    for (let i = 1; i <= n; i++) { const d = ym + '-' + pad(i); if ((from && d < from) || HOLI[d]) continue; if (ds.includes(dow(d))) out.push(d); }
    return out;
  }
  const isDirect = c => !c || c.type === '직영';
  const varChip = () => h.chip('가변', 'info');
  const stChip = st => h.chip(st === '안' ? '(안)' : st, 'st-' + st);
  const polSt = code => h.pol(code).status;
  const isFixed = code => ['확정', '법정'].includes(polSt(code));
  const nameOf = (s, r) => { const st = r.student && s.students.find(x => x.id === r.student); return st ? h.mask(st.name) : (r.name || h.mask(r.student || '-')); };
  // 직영은 원문 52쪽 본사 확정가(주 3회는 변경신고가 끝날 때까지 교육청 등록액 340,000), 가맹은 센터 교습비
  const PRICE = { pr1: 260000, pr2: 340000, pr3: 150000 };
  function price(s, center, pid) {
    if (isDirect(center)) return PRICE[pid] || PRICE.pr1;
    const p = s.products.find(x => x.id === pid);
    return p ? ((p.centerPrice || {})[center.id] || p.recommend) : 0;
  }
  const prodShort = (s, pid) => { const p = s.products.find(x => x.id === pid); return p ? p.name.split(' · ')[0] : '-'; };
  function sel(o) {
    return '<select class="inp" data-field="' + esc(o.f) + '"' + (o.live ? ' data-live="1"' : '') + (o.dis ? ' disabled' : '') + ' aria-label="' + esc(o.label || o.f) + '" style="width:' + (o.w || 'auto') + '">' +
      o.opts.map(x => { const v = typeof x === 'string' ? x : x.v, l = typeof x === 'string' ? x : x.l; return '<option value="' + esc(v) + '"' + (String(v) === String(o.v) ? ' selected' : '') + (typeof x === 'object' && x.dis ? ' disabled' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>';
  }
  function inp(o) {
    return '<input class="inp' + (o.err ? ' bad' : '') + '" type="' + (o.type || 'text') + '" data-field="' + esc(o.f) + '" value="' + esc(o.v == null ? '' : o.v) + '"' + (o.live ? ' data-live="1"' : '') +
      (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.dis ? ' disabled' : '') + ' aria-label="' + esc(o.label || o.ph || o.f) + '"' + (o.w ? ' style="width:' + o.w + '"' : '') + '>';
  }
  const chk = (on, act, arg, dis, label) => '<input type="checkbox" class="ctc-chk"' + (on ? ' checked' : '') + (dis ? ' disabled' : '') + ' data-act="' + act + '"' + (arg != null ? ' data-arg="' + esc(arg) + '"' : '') + ' aria-label="' + esc(label || '선택') + '">';
  // 고르면 바로 다시 그리는 칸 (data-live)
  function live(root, ctx) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-live]'), el => {
      el.addEventListener('change', () => { ctx.ui[el.getAttribute('data-field')] = el.value; B.render(); });
    });
  }
  function readModal(back, id) { const el = back.querySelector('#' + id); return el ? el.value : ''; }

  /* ---------------- 이 파일 전용 스타일 ---------------- */
  (function () {
    if (document.getElementById('ctc-style')) return;
    const css = [
      '.ctc-line{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px;font-size:12.5px}',
      '.ctc-line h2{margin:0;font-size:16px}',
      '.ctc-pill{display:inline-flex;gap:6px;align-items:center;border:1px dashed #c4c9d3;border-radius:999px;padding:3px 10px;background:#fff;font-size:12px}',
      '.ctc-pill.bad{border-color:#f0b4ad;background:#fff8f7}',
      '.ctc-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}',
      '.ctc-bar .grow{margin-left:auto}',
      '.ctc-sum{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px 12px;font-size:12.5px;font-variant-numeric:tabular-nums}',
      '.ctc-sum>span:nth-child(even){text-align:right;font-weight:600}',
      '.ctc-sum .tot{border-top:1px solid var(--line);padding-top:6px;font-weight:800}',
      '.ctc-sum .sub{color:var(--sub);font-weight:600}',
      '.ctc-big{font-size:20px;font-weight:800;font-variant-numeric:tabular-nums}',
      '.ctc-form{display:grid;grid-template-columns:86px minmax(0,1fr);gap:8px 10px;align-items:center;font-size:12.3px}',
      '.ctc-form>label{font-size:11.5px;font-weight:700;color:var(--sub)}',
      '.ctc-form>label .req{color:var(--brand);margin-left:2px}',
      '.ctc-errs{margin-top:8px;display:flex;flex-direction:column;gap:3px;font-size:11.5px;color:var(--bad);font-weight:600}',
      '.ctc-note{font-size:11.5px;color:var(--sub);line-height:1.5}',
      '.ctc-box{border-radius:8px;padding:9px 11px;font-size:12.3px;background:var(--bg);display:flex;flex-direction:column;gap:6px}',
      '.ctc-box.review{background:var(--review-soft);color:#3c2a78}',
      '.ctc-rcpt{border:1px dashed #c9ced8;border-radius:9px;padding:10px 12px;background:#fcfcfd}',
      '.ctc-chk{width:15px;height:15px;cursor:pointer;margin:0}',
      '.tbl tr.ctc-off td{color:var(--mute);background:#fafbfc}',
      '.tbl tr.ctc-cut td{color:var(--mute)}',
      '.tbl tr.ctc-cut td .amt{text-decoration:line-through}',
      '.tbl tr.ctc-neg td{background:#fff8f7}',
      '.tbl td .sm2{font-size:11px;color:var(--mute)}',
      '.ctc-acts{display:flex;gap:4px;flex-wrap:wrap}',
      '.ctc-tt{display:grid;grid-template-columns:96px repeat(5,minmax(0,1fr));border:1px solid var(--line);border-radius:9px;overflow:hidden;background:#fff;font-size:12px}',
      '.ctc-tt>div{border-right:1px solid var(--line-2);border-bottom:1px solid var(--line-2);padding:5px;min-height:46px}',
      '.ctc-tt>div.hd{background:#f7f8fa;font-weight:700;color:var(--sub);min-height:0;text-align:center}',
      '.ctc-tt>div.tm{font-family:var(--mono);font-size:11px;color:var(--sub);background:#fafbfc}',
      '.ctc-tt>div.over{background:#f6f7f9;color:var(--mute);font-size:11px}',
      '.ctc-tt>div.cell{cursor:pointer}',
      '.ctc-tt>div.cell:hover{background:#fafbfc}',
      '.ctc-slot{display:block;width:100%;text-align:left;border:1px solid transparent;background:var(--navy-soft);border-radius:6px;padding:4px 6px;margin-bottom:3px;font-size:11.5px;cursor:pointer;color:var(--ink)}',
      '.ctc-slot.full{background:var(--bad-soft)}',
      '.ctc-slot.on{border-color:var(--navy);box-shadow:0 0 0 1px var(--navy)}',
      '.ctc-slot.draft{background:var(--review-soft);border-style:dashed;border-color:#b9a6ef}',
      '.ctc-slot b{display:block;font-size:11.5px}',
      '.ctc-meter{display:flex;gap:6px;align-items:center;font-size:11.5px}',
      '.ctc-meter .bar{flex:1}',
      '.ctc-hist{display:flex;flex-direction:column;gap:4px;font-size:11.5px;color:var(--sub);margin-top:8px}',
    ].join('\n');
    const el = document.createElement('style'); el.id = 'ctc-style'; el.textContent = css; document.head.appendChild(el);
  })();

  /* =====================================================================
     CT-08 월 재등록 일괄 청구 (p.53)
     ===================================================================== */
  const C8_BILLED = ['수납 완료', '미수', '발송 실패', '부분 납부'];
  const C8_ELIG = ['재원', '휴원', '휴원 예정', '퇴원 예정'];
  // 원문 예시 상태를 대치1센터 원생에게 나눠 줘요. 위쪽 숫자 칸은 이 표에 없는 원생까지 더해 128, 123, 71, 52가 되게 맞춰요.
  const C8_INIT = {
    s1: { st: '수납 완료', sent: '03-20', pay: '03-21 결제선생' },
    s2: { st: '수납 완료', sent: '03-20', pay: '03-21 카드', disc: 26000, discWhy: '형제 10% (예시)' },
    s3: { st: '미수', sent: '03-20' },
    s5: { st: '미수', sent: '03-20' },
    s6: { st: '제외', why: '휴원' },
    s7: { st: '수납 완료', sent: '03-20', pay: '03-22 결제선생' },
    s8: { st: '발송 실패', sent: '03-20', fail: '전화번호 오류' },
    s9: { st: '제외', why: '퇴원 예정' },
    s10: { st: '수납 완료', sent: '03-20', pay: '03-23 계좌이체' },
    s11: { st: '수납 완료', sent: '03-20', pay: '03-21 카드' },
  };
  const C8_POLS = [['POL-24', '재등록 청구 기간'], ['POL-18', '등록 단위 (월)'], ['POL-20', '4·5주 달 금액'], ['POL-13', '할인 이어받기'], ['POL-23', '미수 계정 정지']];
  B.extend(s => {
    const c = s.centers.find(x => x.id === 'daechi1');
    const rows = {};
    s.students.filter(st => st.center === 'daechi1' && C8_INIT[st.id]).forEach(st => { rows[st.id] = Object.assign({ disc: 0 }, C8_INIT[st.id]); });
    const R = Object.keys(rows).map(k => ({ r: rows[k], st: s.students.find(x => x.id === k) }));
    const cnt = f => R.filter(f).length;
    const due = R.filter(x => C8_BILLED.includes(x.r.st) && x.r.st !== '수납 완료').reduce((a, x) => a + price(s, c, x.st.product) - (x.r.disc || 0), 0);
    s.ct08 = {
      month: '2027-04', asOf: '2027-03-27', ver: '2027-03-20 정책 묶음 (예시)', ack: false, log: [],
      rows: { daechi1: rows },
      base: { daechi1: { target: 128 - R.length, hyu: 3 - cnt(x => x.r.why === '휴원'), out: 2 - cnt(x => x.r.why === '퇴원 예정'), billed: 123 - cnt(x => C8_BILLED.includes(x.r.st)), paid: 71 - cnt(x => x.r.st === '수납 완료'), due: 13520000 - due, remind: '' } },
    };
  });
  function c8rows(ctx) {
    const s = ctx.s, cid = ctx.centerId, R = s.ct08.rows[cid] = s.ct08.rows[cid] || {};
    // 이번 달 재원생으로 다음 달 명단을 자동으로 만들어요. 새로 들어온 원생은 발송 전으로 붙어요.
    s.students.filter(st => st.center === cid && C8_ELIG.includes(st.status) && !R[st.id]).forEach(st => {
      R[st.id] = st.status === '재원' ? { st: '발송 전', disc: 0 } : { st: '제외', why: /휴원/.test(st.status) ? '휴원' : '퇴원 예정', disc: 0 };
    });
    return Object.keys(R).map(id => {
      const st = s.students.find(x => x.id === id); if (!st) return null;
      const k = s.classes.find(x => x.id === st.cls);
      return { id, st, r: R[id], k, amt: price(s, ctx.center, st.product || 'pr1'), ses: k ? sessions(k.days, s.ct08.month).length : null };
    }).filter(Boolean);
  }
  function c8kpi(ctx, rows) {
    rows = rows || c8rows(ctx);
    const b = ctx.s.ct08.base[ctx.centerId] || { target: 0, hyu: 0, out: 0, billed: 0, paid: 0, due: 0 };
    const ex = why => rows.filter(x => x.r.st === '제외' && x.r.why === why).length;
    const billed = rows.filter(x => C8_BILLED.includes(x.r.st));
    const o = {
      target: b.target + rows.length, hyu: b.hyu + ex('휴원'), out: b.out + ex('퇴원 예정'),
      other: rows.filter(x => x.r.st === '제외' && !['휴원', '퇴원 예정'].includes(x.r.why)).length,
      billed: b.billed + billed.length, paid: b.paid + rows.filter(x => x.r.st === '수납 완료').length,
      fail: rows.filter(x => x.r.st === '발송 실패').length, pending: rows.filter(x => x.r.st === '발송 전').length,
    };
    o.unpaid = o.billed - o.paid;
    o.due = b.due + billed.filter(x => x.r.st !== '수납 완료').reduce((a, x) => a + x.amt - (x.r.disc || 0), 0);
    return o;
  }
  B.c8kpi = c8kpi; // 수납·미수·마감(CT-09) 미수 탭에서 같은 숫자를 써요
  const c8open = () => C8_POLS.filter(p => !isFixed(p[0]));
  const C8_TONE = { '수납 완료': 'ok', '미수': 'bad', '발송 실패': 'bad', '부분 납부': 'warn', '발송 전': 'info', '제외': 'p2' };

  B.screen({
    id: 'CT-08', side: 'ct', phase: 'P1a', devices: ['pc'], pages: [53],
    title: '월 재등록 일괄 청구', menuLabel: '재등록 청구', crumb: '수강·수납 > 수강 등록·수납 > 재등록',
    headActions: ctx => h.btn('엑셀', { act: 'CT08.excel' }) + h.btn('청구 일괄 발송', { primary: true, act: 'CT08.send', disabled: !ctx.canEdit }),
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, c = ctx.center, direct = isDirect(c);
      const rows = c8rows(ctx), k = c8kpi(ctx, rows);
      const ym = s.ct08.month, m = Number(ym.slice(5));
      const asOf = s.ct08.asOf, end = ym.slice(0, 4) + '-03-31', dd = dayDiff(asOf, end);
      const ses = d => sessions(d, ym).length;
      let html = '<div class="ctc-line"><h2>' + m + '월 재등록</h2>' +
        '<span class="ctc-pill" data-pin="1">청구 기간 3/20 ~ 3/31 ' + stChip(polSt('POL-24')) + varChip() + ' <b>마감까지 D-' + dd + '</b></span>' +
        '<span class="ctc-pill" data-pin="5">' + m + '월 4주 달 · 회차 ' + ses('월·수') + '</span>' +
        '<span class="muted small">시연 기준일 ' + mdS(asOf) + ' (청구가 진행 중인 원문 예시)</span></div>';
      html += h.alert(m + '월은 월·수 반 ' + ses('월·수') + '회, 화·목 반 ' + ses('화·목') + '회(목요일 5번), 금 반 ' + ses('금') + '회예요. 표의 회차 칸에서 반마다 확인해요. 월 정액과 회차 기준 중 무엇으로 받을지는 아직 미정이에요(POL-20).', 'review', { title: '검토 반영', pin: 9 });
      html += '<div style="margin-top:12px">' + h.kpis([
        { l: '대상', v: num(k.target), s: '휴원 ' + k.hyu + ' · 퇴원 예정 ' + k.out + ' 제외' + (k.other ? ', 기타 ' + k.other : '') },
        { l: '청구 발송', v: num(k.billed), s: direct ? '알림톡 · 결제선생' : '알림톡 · 방문 결제 대기' + (k.pending ? ' · 발송 전 ' + k.pending : '') },
        { l: '수납 완료', v: num(k.paid), s: (k.target ? Math.round(k.paid / k.target * 100) : 0) + '% · 청구 기준 ' + (k.billed ? Math.round(k.paid / k.billed * 100) : 0) + '%', tone: 'ok' },
        { l: '미수', v: num(k.unpaid), s: '₩ ' + num(k.due), tone: k.unpaid ? 'bad' : '' },
      ]) + '</div>';
      // 필터와 미수 관리
      const clsOpts = [{ v: '', l: '반 전체' }].concat(s.classes.filter(x => x.center === ctx.centerId).map(x => ({ v: x.id, l: x.name })));
      const stOpts = [{ v: '', l: '상태 전체' }].concat(['수납 완료', '미수', '발송 실패', '발송 전', '제외'].map(x => ({ v: x, l: x })));
      const checked = Object.keys(ui.chk || {}).filter(x => ui.chk[x]);
      html += '<div class="ctc-bar" style="margin-top:14px">' + sel({ f: 'f_st', v: ui.f_st || '', opts: stOpts, live: true, label: '상태' }) + sel({ f: 'f_cls', v: ui.f_cls || '', opts: clsOpts, live: true, label: '반' }) +
        '<div class="row" data-pin="3">' + h.opts([{ v: 'on', l: '미수만' }], ui.f_st === '미수' ? 'on' : '', { act: 'CT08.unpaidOnly' }) + h.btn('다시 안내' + (checked.length ? ' (' + checked.length + ')' : ''), { act: 'CT08.remind', disabled: !ctx.canEdit || !k.unpaid }) + '</div>' +
        '<span class="grow muted small">' + (s.ct08.base[ctx.centerId] && s.ct08.base[ctx.centerId].remind ? '미수 전체 다시 안내 ' + s.ct08.base[ctx.centerId].remind : '안내를 보내면 이 줄에 날짜가 남아요') + '</span></div>';
      // 검토 반영: 발송 실패와 중복 발송 막기
      html += h.alert((k.fail ? '발송 실패 ' + k.fail + '명이 있어요 (' + rows.filter(x => x.r.st === '발송 실패').map(x => h.mask(x.st.name) + ' ' + (x.r.fail || '')).join(', ') + '). 실패한 학생만 다시 보내요. ' : '발송 실패 0명이에요. ') +
        '청구 일괄 발송은 아직 안 보낸 학생' + (k.pending ? ' ' + k.pending + '명' : '') + '에게만 가고, 이미 보낸 학생에게는 다시 안내를 써요.' +
        (k.fail ? ' ' + h.btn('실패 건만 다시 보내기', { sm: true, act: 'CT08.retry', disabled: !ctx.canEdit }) : ''), k.fail ? 'warn' : 'review', { raw: true, pin: 7, title: '검토 반영' });
      // 명단
      const list = rows.filter(x => (!ui.f_st || x.r.st === ui.f_st) && (!ui.f_cls || x.st.cls === ui.f_cls));
      html += '<div style="margin-top:10px">' + h.table({
        pin: 2,
        cols: [
          { label: '선택', render: x => chk((ui.chk || {})[x.id], 'CT08.check', x.id, x.r.st !== '미수', h.mask(x.st.name) + ' 선택') },
          { label: '원생', render: x => esc(h.mask(x.st.name)) },
          { label: '반', render: x => esc(x.k ? x.k.name : '-') },
          { label: m + '월 상품', render: x => x.r.st === '제외' ? '-' : esc(prodShort(s, x.st.product)) },
          { label: '회차', render: x => x.r.st === '제외' || x.ses == null ? '-' : (x.ses > 8 ? h.chip(x.ses + '회', 'warn') : x.ses + '회') },
          { label: '금액', num: true, render: x => x.r.st === '제외' ? '-' : num(x.amt) + ' ' + varChip() },
          { label: '할인', num: true, render: x => x.r.disc ? '<span title="' + esc(x.r.discWhy || '') + '">-' + num(x.r.disc) + '</span>' : '-' },
          { label: '청구', render: x => x.r.st === '제외' ? '제외' : x.r.st === '발송 전' ? '<span class="muted">발송 전</span>' : esc(x.r.sent || '') + (x.r.st === '발송 실패' ? ' 실패' : ' 발송') + (x.r.remind ? '<div class="sm2">' + esc(x.r.remind) + '</div>' : '') },
          { label: '결제', render: x => esc(x.r.pay || '-') },
          { label: '상태', render: x => h.chip(x.r.st === '제외' ? (x.r.why === '휴원' ? '휴원 예정' : x.r.why) : x.r.st, C8_TONE[x.r.st] || '') },
          { label: '조치', render: x => '<div class="ctc-acts">' + (x.r.st === '발송 실패' ? h.btn('다시 보내기', { sm: true, act: 'CT08.retry', arg: x.id, disabled: !ctx.canEdit }) : '') +
            (x.r.st === '제외' ? h.btn('명단에 넣기', { sm: true, act: 'CT08.include', arg: x.id, disabled: !ctx.canEdit }) : '') +
            (x.r.st === '발송 전' || x.r.st === '미수' ? h.btn('빼기', { sm: true, act: 'CT08.exclude', arg: x.id, disabled: !ctx.canEdit }) : '') + '</div>' },
        ],
        rows: list,
        rowAttr: x => x.r.st === '제외' ? ' class="ctc-off"' : '',
        empty: '조건에 맞는 원생이 없어요.',
      }) + '<div class="small muted" style="margin-top:6px">표에는 이 센터 예시 원생만 보여요. 위쪽 숫자 칸은 센터 전체(대상 ' + num(k.target) + '명) 기준이에요.</div></div>';
      // 아래 카드 3개
      const pols = c8open();
      html += '<div class="grid g3" style="margin-top:14px">';
      html += h.card({
        title: '발송 방식', pin: 4,
        body: '<div class="stack" style="gap:8px">' +
          '<div class="ctc-box"' + (direct ? ' style="outline:2px solid var(--navy-soft)"' : '') + '><b>직영</b>결제선생 청구서 일괄 발송 (결제하면 수납이 자동으로 기록돼요)</div>' +
          '<div class="ctc-box"' + (!direct ? ' style="outline:2px solid var(--navy-soft)"' : '') + '><b>가맹</b>알림톡 안내와 센터 방문 결제 대기 목록</div>' +
          '<div class="small muted">이 센터는 ' + esc(c ? c.type : '직영') + '이에요. ' + h.polChip('POL-36') + '</div></div>',
      });
      html += h.card({
        title: m + '월 1일 처리', pin: 6,
        body: '<div class="ctc-note">미수납 원생은 학습 계정을 <b>5일</b> ' + varChip() + ' 유예한 뒤 멈춰요 ' + h.chip('미확정(안)', 'st-안') + '</div>' +
          '<div class="ctc-note" style="margin-top:6px">정지 전날 보호자에게 안내해요.</div>' +
          '<div class="ctc-box" style="margin-top:8px">지금 미수 ' + num(k.unpaid) + '명이 ' + m + '/1까지 내지 않으면 ' + m + '/5에 안내하고 ' + m + '/6에 계정을 멈춰요.</div>' +
          '<div class="small muted" style="margin-top:6px">본사 사용료 과금 기준에도 들어가요. ' + h.polChip('POL-23') + h.polChip('POL-02') + '</div>',
      });
      html += h.card({
        title: '계산에 쓴 정책 값', pin: 8,
        body: '<div class="stack" style="gap:6px">' + C8_POLS.map(p => '<div class="row" style="gap:6px">' + h.polChip(p[0]) + '<span class="small">' + esc(p[1]) + '</span><span style="margin-left:auto">' + stChip(polSt(p[0])) + '</span></div>').join('') +
          '<div class="small muted">보낸 청구마다 ' + esc(s.ct08.ver) + '을 함께 저장했어요.</div>' +
          (pols.length ? '<label class="row small" style="gap:6px;align-items:flex-start">' + chk(s.ct08.ack, 'CT08.ack', null, !ctx.canEdit, '임시 적용 승인 확인') + '<span>(안)이나 미정 값 ' + pols.length + '개를 본사 임시 적용 승인으로 쓰는 것을 확인했어요</span></label>' : '') +
          (ui.err_ack ? '<div class="ctc-errs">' + esc(ui.err_ack) + '</div>' : '') + '</div>',
      });
      html += '</div>';
      return html;
    },
    mount(root, ctx) { live(root, ctx); },
    prd: {
      summary: '매달 정해진 기간에 다니는 학생 모두에게 다음 달 학원비를 한꺼번에 청구해요. 누가 냈고 누가 안 냈는지도 여기서 챙겨요.',
      who: '원장과 실장·데스크가 써요. 교사와 보조교사에게는 메뉴가 안 보여요.',
      items: [
        { n: 1, t: '청구 기간', d: '매달 20일부터 말일까지(안) 다음 달 학원비를 청구해요. 한 달 단위로 1일에 시작하는 안이라 매달 모든 학생이 다시 내요. D-4는 청구 마감까지 남은 날이에요(시연 기준일 3/27).', pol: ['POL-24', 'POL-18'], ref: 'p.53 ①' },
        { n: 2, t: '대상 자동 생성', d: '이번 달 재원생으로 다음 달 명단을 자동으로 만들어요. 휴원 학생과 퇴원 예정 학생은 빼고, 상품과 할인은 이번 달 것을 이어받아요. 새로 등록한 원생은 발송 전으로 붙어요.', pol: ['POL-21'], ref: 'p.53 ②' },
        { n: 3, t: '미수 관리', d: '안 낸 학생만 골라 다시 안내해요. 가맹 센터는 안내 비용이 알림톡 잔액에서 빠지고, 직영은 본사 내부 비용으로 처리해요. 보내기 전에 대상 수와 비용을 한 번 더 보여 줘요.', pol: ['POL-35', 'POL-34'], ref: 'p.53 ③' },
        { n: 4, t: '발송 방식', d: '직영은 결제선생 청구서를 한꺼번에 보내고, 결제하면 수납이 자동으로 기록돼요. 가맹은 알림톡으로 안내하고 센터 방문 결제 대기 목록으로 챙겨요.', pol: ['POL-36'], ref: 'p.53 ④' },
        { n: 5, t: '4·5주 달', d: '다음 달 회차 수를 보여 줘요. 4월은 4주 달이라 월·수 반이 8회예요. 금액을 월 정액으로 받을지 회차 기준으로 받을지는 아직 미정이에요.', pol: ['POL-20'], ref: 'p.53 ⑤' },
        { n: 6, t: '1일 처리', d: '1일까지 안 낸 학생은 유예 기간 5일(안)이 지나면 학습 계정을 멈춰요. 멈추기 전날 보호자에게 알려요. 이 결과는 본사 사용료 계산에도 들어가요.', pol: ['POL-23', 'POL-02'], ref: 'p.53 ⑥' },
        { n: 7, t: '발송 실패와 다시 보내기', kind: 'review', imp: 'IMP-12', d: '한꺼번에 보내면 번호 오류로 못 받는 학생이 생겨요. 발송 실패 상태를 두고 실패한 학생만 다시 보내요. 일괄 발송은 아직 안 보낸 학생에게만 가서 같은 청구가 두 번 가지 않아요. 명단에서 뺄 때는 사유를 골라요.' },
        { n: 8, t: '계산에 쓴 정책 값 기록', kind: 'review', imp: 'IMP-10', pol: ['POL-24', 'POL-20'], d: '청구마다 계산에 쓴 정책 값과 버전을 함께 저장해요. (안)이나 미정 값이 들어 있으면 본사 임시 적용 승인을 확인해야 새 청구를 보낼 수 있어요.' },
        { n: 9, t: '반마다 회차 보여 주기', kind: 'review', imp: 'IMP-09', pol: ['POL-20'], d: '회차는 반의 요일마다 달라요. 2027년 4월은 월·수 반이 8회, 화·목 반은 목요일이 5번이라 9회예요. 표에 회차 칸을 두어 반마다 확인해요.' },
      ],
      open: ['재등록 청구 기간 20일부터 말일까지를 확정할지 (POL-24)', '4·5주 달 금액을 월 정액과 회차 기준 중 무엇으로 할지 (POL-20)', '미수 학생 학습 계정 유예 기간, 지금 안은 5일 (POL-23)', '유예 중인 학생을 본사 사용료에 셀지 (POL-02)', '휴원 허용 여부와 이월 방법 (POL-21)', '가맹 결제 연동 방식, 결제선생 답변 대기 (POL-36)'],
    },
  });

  B.action('CT08.status', (ctx, v) => { ctx.ui.f_st = v || ''; });
  B.action('CT08.cls', (ctx, v) => { ctx.ui.f_cls = v || ''; });
  B.action('CT08.unpaidOnly', ctx => { ctx.ui.f_st = ctx.ui.f_st === '미수' ? '' : '미수'; });
  B.action('CT08.check', (ctx, id) => { const c = ctx.ui.chk = ctx.ui.chk || {}; c[id] = !c[id]; });
  B.action('CT08.ack', ctx => { if (!ctx.canEdit) return; ctx.s.ct08.ack = !ctx.s.ct08.ack; if (ctx.s.ct08.ack) ctx.ui.err_ack = null; });
  B.action('CT08.excel', ctx => { ctx.s.audit.unshift({ at: '03-27 10:05', who: ctx.persona.name + ' (' + ctx.role + ')', what: '엑셀 다운로드', target: '4월 재등록 명단', reason: '재등록 확인' }); B.toast('4월 재등록 명단을 엑셀로 내려받았어요. 이름과 연락처는 가려진 채로 나가요.'); return false; });
  B.action('CT08.send', (ctx, arg, el) => {
    if (!ctx.canEdit) return;
    const s = ctx.s, ui = ctx.ui;
    if (arg && typeof arg === 'object' && arg.ack) s.ct08.ack = true;
    const rows = c8rows(ctx), pend = rows.filter(x => x.r.st === '발송 전');
    if (!pend.length) { B.toast('새로 보낼 학생이 없어요. 이미 보낸 학생에게는 일괄 발송이 다시 가지 않아요.'); return; }
    if (c8open().length && !s.ct08.ack) { ui.err_ack = '(안)이나 미정 값이 들어간 금액이에요. 본사 임시 적용 승인을 확인해 주세요.'; B.toast('계산에 쓴 정책 값을 먼저 확인해 주세요.'); return; }
    const direct = isDirect(ctx.center);
    const apply = () => {
      pend.forEach(x => { x.r.st = '미수'; x.r.sent = '03-27'; x.r.ver = s.ct08.ver; });
      s.ct08.log.unshift({ at: '03-27', what: '청구 일괄 발송 ' + pend.length + '명', by: ctx.persona.name });
      ui.err_ack = null;
      B.toast(pend.length + '명에게 4월 청구를 보냈어요. ' + (direct ? '결제하면 수납이 자동으로 기록돼요.' : '방문 결제 대기 목록에 올렸어요.'));
    };
    if (el) {
      B.modal({ title: '청구 일괄 발송 ' + pend.length + '명', ok: pend.length + '명에게 보내기',
        body: h.kv([['대상', pend.map(x => h.mask(x.st.name)).join(', ')], ['보내는 것', direct ? '결제선생 청구서' : '알림톡 안내와 방문 결제 대기 목록'], ['금액', num(pend.reduce((a, x) => a + x.amt - (x.r.disc || 0), 0)) + '원'], ['다시 가지 않는 학생', '이미 보낸 ' + num(c8kpi(ctx, rows).billed) + '명']]) + '<div class="small muted">보낸 청구는 결제 전까지 취소할 수 있어요.</div>',
        onOk: () => { apply(); } });
      return false;
    }
    apply();
  });
  B.action('CT08.remind', (ctx, arg, el) => {
    if (!ctx.canEdit) return;
    const s = ctx.s, ui = ctx.ui, c = ctx.center, direct = isDirect(c);
    const rows = c8rows(ctx), unpaid = rows.filter(x => x.r.st === '미수');
    let ids = Array.isArray(arg) ? arg : (arg && typeof arg === 'object' && Array.isArray(arg.ids)) ? arg.ids : null;
    if (!ids) { const chk = Object.keys(ui.chk || {}).filter(x => ui.chk[x]); if (chk.length) ids = chk; }
    const targets = ids ? unpaid.filter(x => ids.includes(x.id)) : unpaid;
    const k = c8kpi(ctx, rows), n = ids ? targets.length : k.unpaid - k.fail;
    if (!n) { B.toast('다시 안낼 미수 학생이 없어요.'); return; }
    const cost = n * 7;
    const apply = () => {
      targets.forEach(x => { x.r.remind = '03-27 다시 안내'; });
      if (!ids && s.ct08.base[ctx.centerId]) s.ct08.base[ctx.centerId].remind = '03-27 ' + num(n) + '명';
      if (!direct && s.alim.balances[ctx.centerId] != null) s.alim.balances[ctx.centerId] = Math.max(0, s.alim.balances[ctx.centerId] - cost);
      targets.forEach(x => s.alim.log.push({ at: '03-27 10:10', center: ctx.centerId, student: x.id, tpl: 'T04', name: '미납 안내', to: x.st.phone, text: '4월 수강료가 아직 납부되지 않았어요.', status: '발송 완료', src: 'CT-08' }));
      ui.chk = {};
      B.toast('미수 ' + num(n) + '명에게 다시 안내했어요.');
    };
    if (el) {
      B.modal({ title: '미수 ' + num(n) + '명에게 다시 안내', ok: num(n) + '명에게 보내기',
        body: h.kv([['대상', ids ? targets.map(x => h.mask(x.st.name)).join(', ') : '미수 전체 ' + num(n) + '명 (발송 실패 ' + k.fail + '명은 빼요)'], ['보내는 것', '미납 안내 알림톡'], ['비용', direct ? '직영은 본사 내부 비용으로 처리해요' : '알림톡 잔액에서 ' + num(cost) + '원 (건당 7원, 안)'], ['되돌리기', '보낸 안내는 취소할 수 없어요']]),
        onOk: () => { apply(); } });
      return false;
    }
    apply();
  });
  B.action('CT08.retry', (ctx, id) => {
    if (!ctx.canEdit) return;
    const rows = c8rows(ctx).filter(x => x.r.st === '발송 실패' && (!id || typeof id !== 'string' || x.id === id));
    if (!rows.length) { B.toast('다시 보낼 실패 건이 없어요.'); return; }
    rows.forEach(x => { x.r.st = '미수'; x.r.sent = '03-27'; x.r.fail = ''; x.r.remind = '번호 고친 뒤 다시 보냄'; });
    B.toast('실패한 ' + rows.length + '명에게만 다시 보냈어요.');
  });
  function c8exclude(ctx, id, why) {
    const x = c8rows(ctx).find(r => r.id === id); if (!x) return;
    x.r.prev = x.r.st; x.r.st = '제외'; x.r.why = why || '기타';
    if (why === '휴원' || why === '퇴원 예정') {
      ctx.s.ui['CT-06'] = Object.assign(ctx.s.ui['CT-06'] || {}, { student: id, want: why === '휴원' ? '휴원' : '퇴원' });
      B.toast(h.mask(x.st.name) + ' 학생을 명단에서 뺐어요. 원생 상세(CT-06)에서 ' + (why === '휴원' ? '휴원' : '퇴원') + ' 처리도 이어서 해요.');
    } else B.toast(h.mask(x.st.name) + ' 학생을 명단에서 뺐어요. 사유 ' + (why || '기타'));
  }
  B.action('CT08.exclude', (ctx, arg, el) => {
    if (!ctx.canEdit) return;
    const id = arg && typeof arg === 'object' ? arg.id : arg;
    if (arg && typeof arg === 'object' && arg.why) { c8exclude(ctx, id, arg.why); return; }
    if (el) {
      B.modal({ title: '재등록 명단에서 빼기', ok: '빼기',
        body: '<div class="field"><label for="ctc8-why">사유<span class="req">*</span></label><select class="inp" id="ctc8-why"><option>휴원</option><option>퇴원 예정</option><option>다른 반 이동 대기</option><option>기타</option></select></div><div class="small muted">휴원이나 퇴원이면 원생 상태도 바꿔야 해서 원생 상세로 이어 줘요.</div>',
        onOk: back => { c8exclude(ctx, id, readModal(back, 'ctc8-why')); } });
      return false;
    }
    c8exclude(ctx, id, '기타');
  });
  B.action('CT08.include', (ctx, id) => {
    if (!ctx.canEdit) return;
    const x = c8rows(ctx).find(r => r.id === id); if (!x) return;
    x.r.st = x.r.prev && x.r.prev !== '발송 전' && x.r.prev !== '제외' ? x.r.prev : '발송 전'; x.r.why = ''; x.r.prev = '';
    B.toast(h.mask(x.st.name) + ' 학생을 4월 명단에 넣었어요. ' + (x.r.st === '발송 전' ? '청구 일괄 발송 때 함께 보내요.' : ''));
  });
})();
