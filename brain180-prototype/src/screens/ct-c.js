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
  // 쉬는 날 모음. 본사 공휴일과 지정 휴원일(HQ-11)에 센터 휴원일(CT-19)을 더해요. 날짜마다 이름을 붙여요.
  function holMap(s, cid) {
    const m = Object.assign({}, HOLI);
    const add = x => {
      if (!x || !okDate(x.from)) return;
      const end = okDate(x.to) && x.to > x.from ? x.to : x.from;
      for (let d = x.from, i = 0; d <= end && i < 62; d = addDays(d, 1), i++) if (!m[d]) m[d] = x.name || '휴원';
    };
    s = s || B.store;
    ((s.hq11 || {}).hol || []).forEach(add);
    const c19 = s.ct19 && s.ct19.centers && s.ct19.centers[cid];
    if (c19 && Array.isArray(c19.holidays)) c19.holidays.forEach(add);
    return m;
  }
  // 반의 요일로 그달 수업 날짜를 세요. 쉬는 날은 빼고, from이 있으면 그날부터 세요.
  function sessions(days, ym, from, hol) {
    const out = [], ds = dayList(days), n = dim(ym), H = hol || HOLI;
    for (let i = 1; i <= n; i++) { const d = ym + '-' + pad(i); if ((from && d < from) || H[d]) continue; if (ds.includes(dow(d))) out.push(d); }
    return out;
  }
  const isDirect = c => !c || c.type === '직영';
  const varChip = () => h.chip('가변', 'info');
  const stChip = st => h.chip(st === '안' ? '(안)' : st, 'st-' + st);
  const polSt = code => h.pol(code).status;
  const isFixed = code => ['확정', '법정'].includes(polSt(code));
  const nameOf = (s, r) => { const st = r.student && s.students.find(x => x.id === r.student); return st ? h.mask(st.name) : (r.name || h.mask(r.student || '-')); };
  // 직영은 원문 52쪽 본사 확정가(주 3회는 360,000으로 바꾸는 교육청 신고 중이라 지금 값 340,000), 가맹은 센터 교습비
  const PRICE = { pr1: 260000, pr2: 340000, pr3: 150000 };
  // HQ-14에 남긴 교육청 확인 결과. '등록 불필요'가 아니면 테스트비와 상담비는 아직 받을 수 없는 돈이에요.
  const eduSt = s => ((s.hq14 && s.hq14.edu) || {}).status || '확인 전';
  function price(s, center, pid) {
    if (isDirect(center)) return B.feeNow ? B.feeNow(s, center.id, pid) || PRICE[pid] || PRICE.pr1 : PRICE[pid] || PRICE.pr1;
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
  const C8_BILLED = ['수납 완료', '미수', '발송 실패', '부분 납부', '결제 취소'];
  const C8_UNPAID = ['미수', '부분 납부', '결제 취소']; // 청구는 갔고 돈은 덜 받은 상태. 다시 안내 대상이에요.
  const C8_ELIG = ['재원', '휴원', '휴원 예정', '퇴원 예정'];
  const c8owe = (amt, r) => amt - (r.disc || 0) - (r.part || 0);
  // 원문 예시 상태를 대치1센터 원생에게 나눠 줘요. 위쪽 숫자 칸은 이 표에 없는 원생까지 더해 128, 123, 71, 52가 되게 맞춰요.
  // 부분 납부와 결제 취소는 검토 반영(IMP-12)으로 더한 예시 상태예요.
  const C8_INIT = {
    s1: { st: '수납 완료', sent: '03-20', pay: '03-21 결제선생' },
    s2: { st: '수납 완료', sent: '03-20', pay: '03-21 카드', disc: 26000, discWhy: '형제 10% (예시)' },
    s3: { st: '미수', sent: '03-20' },
    s5: { st: '미수', sent: '03-20' },
    s6: { st: '제외', why: '휴원' },
    s7: { st: '결제 취소', sent: '03-20', pay: '03-22 결제선생 결제 뒤 취소 (예시)' },
    s8: { st: '발송 실패', sent: '03-20', fail: '전화번호 오류' },
    s9: { st: '제외', why: '퇴원 예정' },
    s10: { st: '부분 납부', sent: '03-20', pay: '03-23 계좌이체 100,000 (예시)', part: 100000 },
    s11: { st: '수납 완료', sent: '03-20', pay: '03-21 카드' },
  };
  const C8_POLS = [['POL-24', '재등록 청구 기간'], ['POL-18', '등록 단위 (월)'], ['POL-20', '4·5주 달 금액'], ['POL-13', '할인 이어받기'], ['POL-23', '미수 계정 정지']];
  B.extend(s => {
    const c = s.centers.find(x => x.id === 'daechi1');
    const rows = {};
    s.students.filter(st => st.center === 'daechi1' && C8_INIT[st.id]).forEach(st => { rows[st.id] = Object.assign({ disc: 0 }, C8_INIT[st.id]); });
    const R = Object.keys(rows).map(k => ({ r: rows[k], st: s.students.find(x => x.id === k) }));
    const cnt = f => R.filter(f).length;
    const due = R.filter(x => C8_BILLED.includes(x.r.st) && x.r.st !== '수납 완료').reduce((a, x) => a + c8owe(price(s, c, x.st.product), x.r), 0);
    s.ct08 = {
      month: '2027-04', asOf: '2027-03-27', baseDay: '2027-04-01', ver: '2027-03-20 정책 묶음 (예시)', ack: false, log: [],
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
    // 원생 상세(CT-06)에서 상태가 바뀌면 아직 보내지 않은 줄을 맞춰요. 휴원 복귀는 다시 대상, 휴원이나 퇴원 처리는 빼요. 직원이 직접 넣거나 뺀 줄(manual)은 그대로 둬요.
    s.students.filter(st => st.center === cid && R[st.id]).forEach(st => {
      const r = R[st.id];
      if (r.st === '제외' && !r.manual && ['휴원', '퇴원 예정'].includes(r.why) && st.status === '재원') Object.assign(r, { st: '발송 전', why: '', back: true });
      else if (r.st === '발송 전' && !r.manual && /휴원|퇴원/.test(st.status)) Object.assign(r, { st: '제외', why: /휴원/.test(st.status) ? '휴원' : '퇴원 예정' });
    });
    return Object.keys(R).map(id => {
      const st = s.students.find(x => x.id === id); if (!st) return null;
      const k = s.classes.find(x => x.id === st.cls);
      return { id, st, r: R[id], k, amt: price(s, ctx.center, st.product || 'pr1'), ses: k ? sessions(k.days, s.ct08.month, null, holMap(s, ctx.centerId)).length : null };
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
    o.due = b.due + billed.filter(x => x.r.st !== '수납 완료').reduce((a, x) => a + c8owe(x.amt, x.r), 0);
    return o;
  }
  B.c8kpi = c8kpi; // 수납·미수·마감(CT-09) 미수 탭에서 같은 숫자를 써요
  // 확정이나 법정이 아니고, 슈퍼관리자 임시 적용 승인 기록(HQ-07, s.pol[code].temp)도 없는 정책
  const c8temp = (s, code) => ((s.pol || {})[code] || {}).temp || null;
  const c8open = s => C8_POLS.filter(p => !isFixed(p[0]) && !c8temp(s, p[0]));
  const C8_TONE = { '수납 완료': 'ok', '미수': 'bad', '발송 실패': 'bad', '부분 납부': 'warn', '결제 취소': 'bad', '발송 전': 'info', '제외': 'p2' };

  B.screen({
    id: 'CT-08', side: 'ct', phase: 'P1a', devices: ['pc'], pages: [53],
    title: '월 재등록 일괄 청구', menuLabel: '재등록 청구', crumb: '수강·수납 > 수강 등록·수납 > 재등록',
    headActions: ctx => h.btn('엑셀', { act: 'CT08.excel' }) + h.btn('청구 일괄 발송', { primary: true, act: 'CT08.send', disabled: !ctx.canEdit }),
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, c = ctx.center, direct = isDirect(c);
      const rows = c8rows(ctx), k = c8kpi(ctx, rows);
      const ym = s.ct08.month, m = Number(ym.slice(5));
      const asOf = s.ct08.asOf, end = ym.slice(0, 4) + '-03-31', dd = dayDiff(asOf, end);
      const hm = holMap(s, ctx.centerId), ses = d => sessions(d, ym, null, hm).length;
      let html = '<div class="ctc-line"><h2>' + m + '월 재등록</h2>' +
        '<span class="ctc-pill" data-pin="1">청구 기간 3/20 ~ 3/31 ' + stChip(polSt('POL-24')) + varChip() + ' <b>마감까지 D-' + dd + '</b></span>' +
        '<span class="ctc-pill" data-pin="5">' + m + '월 4주 달 · 회차 ' + ses('월·수') + '</span>' +
        '<span class="muted small">시연 기준일 ' + mdS(asOf) + ' (청구가 진행 중인 원문 예시)</span></div>';
      html += h.alert(m + '월은 월·수 반 ' + ses('월·수') + '회, 화·목 반 ' + ses('화·목') + '회(목요일 5번), 금 반 ' + ses('금') + '회예요. 표의 회차 칸에서 반마다 확인해요. 월 정액과 회차 기준 중 무엇으로 받을지는 아직 미정이에요(POL-20).', 'review', { title: '검토 반영', pin: 9 });
      html += '<div style="margin-top:12px">' + h.kpis([
        { l: '대상', v: num(k.target), s: '휴원 예정 ' + k.hyu + ' · 퇴원 예정 ' + k.out + ' 제외' + (k.other ? ', 기타 ' + k.other : '') },
        { l: '청구 발송', v: num(k.billed), s: direct ? '알림톡 · 결제선생' : '알림톡 · 방문 결제 대기' + (k.pending ? ', 발송 전 ' + k.pending : '') },
        { l: '수납 완료', v: num(k.paid), s: (k.target ? Math.round(k.paid / k.target * 100) : 0) + '% · 청구 기준 ' + (k.billed ? Math.round(k.paid / k.billed * 100) : 0) + '%', tone: 'ok' },
        { l: '미수', v: num(k.unpaid), s: '₩ ' + num(k.due), tone: k.unpaid ? 'bad' : '' },
      ]) + '</div>';
      // 필터와 미수 관리
      const clsOpts = [{ v: '', l: '반 전체' }].concat(s.classes.filter(x => x.center === ctx.centerId).map(x => ({ v: x.id, l: x.name })));
      const stOpts = [{ v: '', l: '상태 전체' }].concat(['수납 완료', '미수', '부분 납부', '결제 취소', '발송 실패', '발송 전', '제외'].map(x => ({ v: x, l: x })));
      const checked = Object.keys(ui.chk || {}).filter(x => ui.chk[x]);
      html += '<div class="ctc-bar" style="margin-top:14px">' + sel({ f: 'f_st', v: ui.f_st || '', opts: stOpts, live: true, label: '상태' }) + sel({ f: 'f_cls', v: ui.f_cls || '', opts: clsOpts, live: true, label: '반' }) +
        '<div class="row" data-pin="3">' + h.opts([{ v: 'on', l: '미수만' }], ui.f_st === '미수' ? 'on' : '', { act: 'CT08.unpaidOnly' }) + h.btn('다시 안내' + (checked.length ? ' (' + checked.length + ')' : ''), { act: 'CT08.remind', disabled: !ctx.canEdit || !k.unpaid }) + '</div>' +
        '<span class="grow muted small">' + (s.ct08.base[ctx.centerId] && s.ct08.base[ctx.centerId].remind ? '미수 전체 다시 안내 ' + s.ct08.base[ctx.centerId].remind : '안내를 보내면 이 줄에 날짜가 남아요') + '</span></div>';
      // 검토 반영: 발송 실패와 중복 발송 막기
      html += h.alert((k.fail ? '발송 실패 ' + k.fail + '명이 있어요 (' + rows.filter(x => x.r.st === '발송 실패').map(x => h.mask(x.st.name) + ' ' + (x.r.fail || '')).join(', ') + '). 실패한 학생만 다시 보내요. ' : '발송 실패 0명이에요. ') +
        '청구 일괄 발송은 아직 안 보낸 학생' + (k.pending ? ' ' + k.pending + '명' : '') + '에게만 가고, 이미 보낸 학생에게는 다시 안내를 써요. 부분 납부와 결제 취소도 미수처럼 다시 안내로 챙겨요.' +
        (k.fail ? ' ' + h.btn('실패 건만 다시 보내기', { sm: true, act: 'CT08.retry', disabled: !ctx.canEdit }) : ''), k.fail ? 'warn' : 'review', { raw: true, pin: 7, title: '검토 반영' });
      // 명단
      const list = rows.filter(x => (!ui.f_st || x.r.st === ui.f_st) && (!ui.f_cls || x.st.cls === ui.f_cls));
      html += '<div style="margin-top:10px">' + h.table({
        cols: [
          { label: '선택', render: x => chk((ui.chk || {})[x.id], 'CT08.check', x.id, !C8_UNPAID.includes(x.r.st), h.mask(x.st.name) + ' 선택') },
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
            (x.r.st === '발송 전' || C8_UNPAID.includes(x.r.st) ? h.btn('빼기', { sm: true, act: 'CT08.exclude', arg: x.id, disabled: !ctx.canEdit }) : '') + '</div>' },
        ],
        rows: list,
        rowAttr: x => x.r.st === '제외' ? ' class="ctc-off"' : '',
        empty: '조건에 맞는 원생이 없어요.',
      }) + '<div class="small muted" data-pin="2" style="margin-top:6px;padding:4px 0 0 16px">이번 달 재원생으로 자동으로 만든 명단이에요. 휴원 예정, 퇴원 예정 원생은 빼고 상품과 할인은 이번 달 것을 이어받아요. 표에는 이 센터 예시 원생만 보이고, 위쪽 숫자 칸은 센터 전체(대상 ' + num(k.target) + '명) 기준이에요.</div></div>';
      // 아래 카드 3개
      const pols = c8open(s);
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
          '<div class="ctc-box" style="margin-top:8px">지금 미수 ' + num(k.unpaid) + '명이 ' + m + '/1까지 내지 않으면 ' + m + '/5에 안내하고 ' + m + '/6에 계정을 멈춰요 (유예 5일 안으로 센 예시).</div>' +
          '<div class="small muted" style="margin-top:6px">본사 사용료 과금 기준에도 들어가요. ' + h.polChip('POL-23') + h.polChip('POL-02') + '</div>',
      });
      html += h.card({
        title: '계산에 쓴 정책 값', pin: 8,
        body: '<div class="stack" style="gap:6px">' + C8_POLS.map(p => { const tp = c8temp(s, p[0]); return '<div class="row" style="gap:6px">' + h.polChip(p[0]) + '<span class="small">' + esc(p[1]) + '</span><span style="margin-left:auto">' + stChip(polSt(p[0])) + '</span></div>' + (tp ? '<div class="small muted" style="margin:-4px 0 0 4px;font-size:11px">임시 적용 승인 ' + esc(tp.by + ' ' + tp.date) + '</div>' : ''); }).join('') +
          '<div class="small muted">기준일 ' + mdS(s.ct08.baseDay) + ' (대상 기간 시작일). 보낸 청구마다 정책 값, 버전(' + esc(s.ct08.ver.replace(' (예시)', ', 예시')) + '), 기준일을 함께 저장했어요.</div>' +
          (pols.length ? '<label class="row small" style="gap:6px;align-items:flex-start;flex-wrap:nowrap">' + chk(s.ct08.ack, 'CT08.ack', null, !ctx.canEdit, '임시 적용 승인 기록 확인') + '<span>(안)이나 미정 값 ' + pols.length + '개에 슈퍼관리자의 임시 적용 승인 기록이 있는 것을 확인했어요</span></label>' : '<div class="small">확정이 아닌 값에는 모두 슈퍼관리자 임시 적용 승인 기록이 있어요.</div>') +
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
        { n: 2, t: '대상 자동 생성', d: '이번 달 재원생으로 다음 달 명단을 자동으로 만들어요. 휴원 예정 학생과 퇴원 예정 학생은 빼고, 상품과 할인은 이번 달 것을 이어받아요. 새로 등록한 원생은 발송 전으로 붙어요.', pol: ['POL-21'], ref: 'p.53 ②' },
        { n: 3, t: '미수 관리', d: '안 낸 학생만 골라 다시 안내해요. 가맹 센터는 안내 비용이 알림톡 잔액에서 빠지고, 직영은 본사 내부 비용으로 처리해요. 보내기 전에 대상 수와 비용을 한 번 더 보여 줘요.', pol: ['POL-35', 'POL-34'], ref: 'p.53 ③' },
        { n: 4, t: '발송 방식', d: '직영은 결제선생 청구서를 한꺼번에 보내고, 결제하면 수납이 자동으로 기록돼요. 가맹은 알림톡으로 안내하고 센터 방문 결제 대기 목록으로 챙겨요.', pol: ['POL-36'], ref: 'p.53 ④' },
        { n: 5, t: '4·5주 달', d: '다음 달 회차 수를 보여 줘요. 4월은 4주 달이라 월·수 반이 8회예요. 금액을 월 정액으로 받을지 회차 기준으로 받을지는 아직 미정이에요.', pol: ['POL-20'], ref: 'p.53 ⑤' },
        { n: 6, t: '1일 처리', d: '1일까지 안 낸 학생은 유예 기간 5일(안)이 지나면 학습 계정을 멈춰요. 멈추기 전날 보호자에게 알려요. 이 결과는 본사 사용료 계산에도 들어가요.', pol: ['POL-23', 'POL-02'], ref: 'p.53 ⑥' },
        { n: 7, t: '발송 실패와 다시 보내기', kind: 'review', imp: 'IMP-12', d: '한꺼번에 보내면 번호 오류로 못 받는 학생이 생겨요. 발송 실패, 부분 납부, 결제 취소 상태를 따로 두고 실패한 학생만 다시 보내요. 일괄 발송은 아직 안 보낸 학생에게만 가서 같은 청구가 두 번 가지 않아요. 명단에서 뺄 때는 사유를 고르고, 휴원이나 퇴원이면 원생 상세(CT-06)로 이어져요.' },
        { n: 8, t: '계산에 쓴 정책 값 기록', kind: 'review', imp: 'IMP-10', pol: ['POL-24', 'POL-20'], d: '청구마다 계산에 쓴 정책 값과 버전, 기준일을 함께 저장해요. 기준일은 대상 기간이 시작하는 4/1이에요. (안)이나 미정 값이 들어 있으면 슈퍼관리자의 임시 적용 승인 기록(HQ-07)이 있어야 새 청구를 보낼 수 있어요.' },
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
    const rows = c8rows(ctx), pend = rows.filter(x => x.r.st === '발송 전');
    if (!pend.length) { B.toast('새로 보낼 학생이 없어요. 이미 보낸 학생에게는 일괄 발송이 다시 가지 않아요.'); return; }
    if (arg && typeof arg === 'object' && arg.ack) s.ct08.ack = true;
    if (c8open(s).length && !s.ct08.ack) { ui.err_ack = '(안)이나 미정 값이 들어간 금액이에요. 슈퍼관리자 임시 적용 승인 기록을 확인해 주세요.'; B.toast('계산에 쓴 정책 값을 먼저 확인해 주세요.'); return; }
    const direct = isDirect(ctx.center);
    const apply = () => {
      const snap = C8_POLS.map(p => ({ code: p[0], status: polSt(p[0]), temp: c8temp(s, p[0]) ? '임시 적용 승인' : '' }));
      pend.forEach(x => { x.r.st = '미수'; x.r.sent = '03-27'; x.r.ver = s.ct08.ver; x.r.baseDay = s.ct08.baseDay; x.r.snap = snap; });
      s.ct08.log.unshift({ at: '03-27', what: '청구 일괄 발송 ' + pend.length + '명', by: ctx.persona.name });
      ui.err_ack = null;
      B.toast(pend.length + '명에게 4월 청구를 보냈어요. ' + (direct ? '결제하면 수납이 자동으로 기록돼요.' : '방문 결제 대기 목록에 올렸어요.'));
    };
    if (el) {
      B.modal({ title: '청구 일괄 발송 ' + pend.length + '명', ok: pend.length + '명에게 보내기',
        body: h.kv([['대상', pend.map(x => h.mask(x.st.name)).join(', ')], ['보내는 것', direct ? '결제선생 청구서' : '알림톡 안내와 방문 결제 대기 목록'], ['금액', num(pend.reduce((a, x) => a + c8owe(x.amt, x.r), 0)) + '원'], ['다시 가지 않는 학생', '이미 보낸 ' + num(c8kpi(ctx, rows).billed) + '명']]) + '<div class="small muted">청구마다 정책 값과 버전, 기준일 ' + mdS(s.ct08.baseDay) + '을 함께 저장해요.</div>',
        onOk: () => { apply(); } });
      return false;
    }
    apply();
  });
  B.action('CT08.remind', (ctx, arg, el) => {
    if (!ctx.canEdit) return;
    const s = ctx.s, ui = ctx.ui, c = ctx.center, direct = isDirect(c);
    const rows = c8rows(ctx), unpaid = rows.filter(x => C8_UNPAID.includes(x.r.st));
    let ids = Array.isArray(arg) ? arg : (arg && typeof arg === 'object' && Array.isArray(arg.ids)) ? arg.ids : null;
    if (!ids && arg !== 'all') { const chk = Object.keys(ui.chk || {}).filter(x => ui.chk[x]); if (chk.length) ids = chk; }
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
    x.r.prev = x.r.st; x.r.st = '제외'; x.r.why = why || '기타'; x.r.manual = true;
    if (why === '휴원' || why === '퇴원 예정') {
      ctx.s.ui['CT-06'] = Object.assign(ctx.s.ui['CT-06'] || {}, { student: id, want: why === '휴원' ? '휴원' : '퇴원' });
      // 상태 변경으로 바로 이어요 (IMP-12). 원생 상세 화면이 있으면 그 화면으로 가요.
      if (B.screens['CT-06']) B.go('CT-06');
      B.toast(h.mask(x.st.name) + ' 학생을 명단에서 뺐어요. 원생 상세(CT-06)에서 ' + (why === '휴원' ? '휴원' : '퇴원') + ' 처리를 이어서 해요.');
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
    x.r.st = x.r.prev && x.r.prev !== '발송 전' && x.r.prev !== '제외' ? x.r.prev : '발송 전'; x.r.why = ''; x.r.prev = ''; x.r.manual = true;
    B.toast(h.mask(x.st.name) + ' 학생을 4월 명단에 넣었어요. ' + (x.r.st === '발송 전' ? '청구 일괄 발송 때 함께 보내요.' : ''));
  });

  /* =====================================================================
     CT-09 수납 내역·미수·일일 마감 (p.54)
     ===================================================================== */
  B.extend(s => {
    s.ct09 = {
      clock: '17:20',
      // 원문 54쪽 예시 4건과, 현금영수증 확인을 보여 주는 예시 1건(17:10)
      rows: [
        { id: 'c9-1', center: 'daechi1', date: '03-08', time: '10:12', name: '윤*서', kind: '테스트비', item: '입학 테스트비', amount: 30000, method: '카드', approval: '8812**', cash: '', by: '실장 송하늘', subject: '입학 테스트', period: '2027-03-08 1회' },
        { id: 'c9-2', center: 'daechi1', date: '03-08', time: '14:40', name: '윤*서', kind: '교습비', item: '3월 교습비, 교재비', amount: 125000, method: '카드', approval: '9021**', cash: '', by: '실장 송하늘', subject: '브레인180 주 2회 · 90분', period: '2027년 3월 중 5회 (월중 등록)' },
        { id: 'c9-3', center: 'daechi1', date: '03-08', time: '15:05', name: '강*우', kind: '교습비', item: '4월 교습비', amount: 260000, method: '계좌이체', approval: '-', cash: '010-****-3346', by: '원장 김지원', subject: '브레인180 주 2회 · 90분', period: '2027-04-01 ~ 04-30' },
        { id: 'c9-4', center: 'daechi1', date: '03-08', time: '16:20', name: '임*희', kind: '상담비', item: '상담비', amount: null, method: '현금', approval: '-', cash: '발급', by: '실장 송하늘', subject: '상담', period: '2027-03-08' },
        { id: 'c9-5', center: 'daechi1', date: '03-08', time: '17:10', name: '김*우', kind: '교습비', item: '3월 교습비, 교재비 (예시)', amount: 275000, method: '현금', approval: '-', cash: '', by: '실장 송하늘', subject: '브레인180 주 2회 · 90분', period: '2027-03-01 ~ 03-31' },
      ],
      hist: [{ id: 'old1', at: '03-07 17:02', day: '03-07', what: '취소 120,000', amount: 120000, method: '카드', why: '중복 결제', by: '원장 김지원', done: true, appr: '마감 전 처리' }],
      cut: {}, closed: {}, cashNo: {},
      unpaid: [
        { id: 'u1', center: 'daechi1', name: '박*준', cls: 'L3-화목B', item: '3월 교습비', amount: 260000, billed: '03-02', last: '03-05 미납 안내' },
        { id: 'u2', center: 'daechi1', name: '이*린', cls: 'L2-월수B', item: '3월 교습비', amount: 260000, billed: '03-02', last: '03-05 미납 안내' },
        { id: 'u3', center: 'daechi1', name: '한*결', cls: 'L2-화목A', item: '3월 교습비', amount: 260000, billed: '03-02', last: '-' },
        { id: 'u4', center: 'daechi1', name: '최*윤', cls: 'L2-월수B', item: '3월 교습비', amount: 260000, billed: '03-04', last: '-' },
      ],
    };
  });
  const C9_DAY = '03-08';
  const who = ctx => (ctx.role === '실장·데스크' ? '실장' : ctx.role) + ' ' + ctx.persona.name;
  const tick = s => { s.ct09.clock = fromMin(toMin(s.ct09.clock) + 4); return s.ct09.clock; };
  const mtype = m => /결제선생/.test(m) ? '결제선생' : /지역화폐/.test(m) ? '지역화폐' : /현금/.test(m) ? '현금' : /이체|계좌/.test(m) ? '계좌이체' : '카드';
  // 수강 등록(CT-07)과 보호자 결제(PA-01)에서 온 수납에는 시각이 없어서 결제 완료 기록의 시각을 찾아 써요.
  function c9time(s, p) {
    if (p.time) return p.time;
    const x = ((s.pa01 || {}).extra || []).filter(e => e.kind === 'pay' && e.student === p.student && String(e.at || '').indexOf(p.date) >= 0).pop();
    const m = x && /(\d\d:\d\d)\s*$/.exec(x.at);
    return m ? m[1] : '';
  }
  // 결제선생 결제는 결제되면 저절로 기록돼요. 직원이 넣은 건은 다른 줄처럼 역할을 붙여요.
  function c9by(s, p) {
    if (/결제선생/.test(p.method || '')) return '결제선생 자동';
    const st = (s.staff || []).find(x => x.name === p.by && x.center === p.center);
    return st ? (st.role === '실장·데스크' ? '실장' : st.role) + ' ' + st.name : (p.by || '-');
  }
  function c9all(ctx) {
    const s = ctx.s, cid = ctx.centerId;
    const ext = (s.payments || []).filter(p => p.center === cid).map(p => ({
      id: p.id, center: p.center, date: p.date, time: c9time(s, p), student: p.student, kind: /테스트/.test(p.item) ? '테스트비' : /상담/.test(p.item) ? '상담비' : '교습비',
      item: p.item, amount: p.amount, method: p.method, approval: p.approval || '-', by: c9by(s, p), ext: true, src: p,
      cash: s.ct09.cashNo[p.id] || (p.receipt === '발급' && /현금|이체/.test(p.method) ? '발급' : ''),
    }));
    return s.ct09.rows.filter(r => r.center === cid).map(r => Object.assign({}, r, { cash: s.ct09.cashNo[r.id] || r.cash })).concat(ext);
  }
  function c9list(ctx, day) {
    return c9all(ctx).filter(r => day === 'week' ? r.date >= '03-02' && r.date <= C9_DAY : r.date === day)
      .sort((a, b) => (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99')));
  }
  const c9pending = (s, id) => s.ct09.hist.find(x => x.id === id && !x.done);
  const needCash = r => /현금|이체/.test(r.method) && Number(r.amount) >= 100000 && !r.cash;
  const c9missing = (ctx, day) => c9list(ctx, day).filter(r => !ctx.s.ct09.cut[r.id] && needCash(r));
  function c9tot(ctx, d) {
    const s = ctx.s, by = { '카드': 0, '결제선생': 0, '계좌이체': 0, '현금': 0, '지역화폐': 0 };
    let back = 0, backCash = 0, unknown = 0;
    c9list(ctx, d).forEach(r => {
      const a = Number(r.amount);
      if (r.amount == null || isNaN(a)) { unknown++; return; }
      if (a < 0) { back += a; if (mtype(r.method) === '현금') backCash += a; return; }
      by[mtype(r.method)] += a;
    });
    s.ct09.hist.filter(x => x.day === d && x.done && x.amount).forEach(x => { back -= x.amount; if (mtype(x.method) === '현금') backCash -= x.amount; });
    const noCash = by['카드'] + by['결제선생'] + by['계좌이체'] + by['지역화폐'];
    return { by, back, noCash, book: by['현금'] + backCash, unknown };
  }
  function c9unpaid(ctx) { return ctx.s.ct09.unpaid.filter(u => u.center === ctx.centerId && !u.paid); }

  function c9closeCard(ctx, full) {
    const s = ctx.s, ui = ctx.ui, d = C9_DAY, done = s.ct09.closed[d], live = c9tot(ctx, d), t = done && done.t ? done.t : live, c = ctx.center, err = ui.cerr || {};
    const moved = done && (live.noCash !== t.noCash || live.book !== t.book || live.back !== t.back);
    const cnt = done ? done.cash : (ui.cashCnt !== '' && ui.cashCnt != null && !isNaN(Number(String(ui.cashCnt).replace(/,/g, ''))) ? Number(String(ui.cashCnt).replace(/,/g, '')) : null);
    const cashTxt = cnt == null ? '<span class="muted">확인 중</span>' : num(cnt) + (cnt === t.book ? ' ' + h.chip('장부와 같음', 'ok') : ' ' + h.chip((cnt > t.book ? '남음 ' : '모자람 ') + num(Math.abs(cnt - t.book)), 'warn'));
    const recvTxt = cnt == null ? num(t.noCash) + ' + 현금' : num(t.noCash + cnt);
    const netTxt = cnt == null ? num(t.noCash + t.back) + ' + 현금' : num(t.noCash + cnt + t.back);
    let body = '<div class="ctc-sum">' +
      '<span>카드</span><span>' + num(t.by['카드']) + '</span>' +
      (t.by['결제선생'] ? '<span>결제선생</span><span>' + num(t.by['결제선생']) + '</span>' : '') +
      '<span>계좌이체</span><span>' + num(t.by['계좌이체']) + '</span>' +
      '<span>현금 <span class="muted small">장부 ' + num(t.book) + '</span></span><span>' + cashTxt + '</span>' +
      '<span>지역화폐</span><span>' + num(t.by['지역화폐']) + '</span>' +
      '<span class="tot">합계</span><span class="tot">' + recvTxt + '</span></div>';
    body += '<div class="ctc-box review" data-pin="7" style="margin-top:10px"><div class="ctc-sum">' +
      '<span class="sub">받은 돈</span><span>' + recvTxt + '</span><span class="sub">돌려준 돈 (환불, 취소)</span><span>' + (t.back ? '-' + num(-t.back) : '0') + '</span>' +
      '<span class="tot">순합계</span><span class="tot">' + netTxt + '</span></div>' +
      (isDirect(c) ? '<div class="small">직영 현금은 본사 계좌에 넣은 날도 등록해요. 입금 주기는 내규로 정해요 (미정).' + (done ? ' ' + (done.deposit ? h.chip('본사 입금 ' + done.deposit, 'ok') : h.btn('현금 본사 입금 등록', { sm: true, act: 'CT09.deposit', disabled: !ctx.canEdit })) : '') + '</div>' : '') + '</div>';
    if (t.unknown) body += '<div class="small muted" style="margin-top:6px">금액이 미정인 ' + t.unknown + '건은 합계에서 빠져요.</div>';
    if (moved) body += '<div class="small" style="margin-top:6px;color:var(--warn)">마감한 뒤에 바뀐 수납이 있어요. 다음 마감에 들어가요.</div>';
    if (!done && (ui.cashOpen || full)) {
      body += '<div class="ctc-form" style="margin-top:10px"><label>현금 시재</label>' + inp({ f: 'cashCnt', v: ui.cashCnt, ph: '센 금액 (원)', err: err.cash, label: '현금 시재' }) +
        '<label>차액 사유</label>' + inp({ f: 'cashWhy', v: ui.cashWhy, ph: '장부와 다르면 꼭 적어요', err: err.why, label: '차액 사유' }) + '</div>';
    }
    const errs = ['miss', 'cash', 'why'].filter(k => err[k]).map(k => '<div>' + esc(err[k]) + '</div>').join('');
    if (errs && !done) body += '<div class="ctc-errs">' + errs + '</div>';
    body += '<div class="row" style="margin-top:10px">' + (done
      ? h.chip('마감 완료 ' + done.at + ' ' + done.by, 'ok') + (done.diff ? '<span class="small muted">시재 차액 ' + num(done.diff) + ' · ' + esc(done.why) + '</span>' : '')
      : (full ? '' : h.btn('현금 시재 입력', { act: 'CT09.cashOpen', disabled: !ctx.canEdit })) + h.btn('마감', { primary: true, act: 'CT09.close', disabled: !ctx.canEdit })) + '</div>';
    return h.card({ title: '일일 마감 (' + mdS('2027-' + d) + ')', pin: 4, body });
  }
  function c9missBox(ctx) {
    const miss = c9missing(ctx, C9_DAY), s = ctx.s;
    if (!miss.length) return h.alert('현금이나 계좌이체로 10만 원 이상 받은 건은 모두 현금영수증 번호가 있어요. 빠진 건이 있으면 마감이 막혀요.', 'ok', { pin: 6, title: '검토 반영' });
    return h.alert('현금이나 계좌이체로 10만 원 이상 받았는데 현금영수증 번호가 없는 건이 ' + miss.length + '건 있어요. ' + (s.ct09.closed[C9_DAY] ? '다음 마감 전에 번호를 넣어 주세요' : '번호를 넣어야 마감할 수 있어요') + ' (발급 기준은 법정, 세무 확인 중).' +
      '<div class="ctc-acts" style="margin-top:6px">' + miss.map(r => '<span class="row" style="gap:4px"><b>' + esc(r.time || r.date) + ' ' + esc(nameOf(s, r)) + ' ' + esc(r.method) + ' ' + num(r.amount) + '</b>' + h.btn('번호 넣기', { sm: true, act: 'CT09.cashNo', arg: r.id, disabled: !ctx.canEdit }) + '</span>').join('') + '</div>', 'bad', { raw: true, pin: 6, title: '검토 반영' });
  }
  function c9approvalNote(ctx) {
    const s = ctx.s, wait = s.ct09.hist.filter(x => !x.done);
    return '<div class="ctc-box review" data-pin="8" style="margin-top:10px">마감한 날의 수납을 고치면 원장 승인을 받아요. 원장이 직접 고치면 사유가 본사 정산 담당에게 알림으로 가요.' +
      (wait.length ? wait.map(x => '<div class="row" style="gap:6px">' + h.chip('승인 대기', 'warn') + '<span>' + esc(x.at + ' ' + x.what + ' · ' + x.why + ' · ' + x.by) + '</span>' + h.btn('승인', { sm: true, act: 'CT09.approve', arg: x.id, disabled: ctx.role !== '원장' }) + '</div>').join('') : '') + '</div>';
  }

  B.screen({
    id: 'CT-09', side: 'ct', phase: 'P1a', devices: ['pc'], pages: [54],
    title: '수납 내역·미수·일일 마감', menuLabel: '수납·미수·마감', crumb: '수강·수납 > 수납·미수·마감',
    tabs: [{ id: 'a', label: '수납 내역' }, { id: 'b', label: '미수' }, { id: 'c', label: '일일 마감' }],
    headActions: () => h.btn('엑셀', { act: 'CT09.excel' }),
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, tab = ctx.tab;
      if (tab === 'b') return c9tabB(ctx);
      if (tab === 'c') return c9tabC(ctx);
      const day = ui.f_day || C9_DAY;
      const q = String(ui.f_q || '').trim();
      const list = c9list(ctx, day).filter(r => (!ui.f_m || mtype(r.method) === ui.f_m) && (!ui.f_k || (ui.f_k === '환불' ? Number(r.amount) < 0 : r.kind === ui.f_k)) && (!q || nameOf(s, r).includes(q) || (r.student && ((s.students.find(x => x.id === r.student) || {}).name || '').includes(q))));
      let html = '<div data-pin="1"><div class="ctc-bar">' +
        sel({ f: 'f_day', v: day, live: true, label: '기간', opts: [{ v: C9_DAY, l: '기간 3/8 (오늘)' }, { v: 'week', l: '기간 3/2 ~ 3/8' }] }) +
        sel({ f: 'f_m', v: ui.f_m || '', live: true, label: '수단', opts: [{ v: '', l: '수단 전체' }, '카드', '결제선생', '계좌이체', '현금', '지역화폐'] }) +
        sel({ f: 'f_k', v: ui.f_k || '', live: true, label: '구분', opts: [{ v: '', l: '구분 전체' }, '교습비', '테스트비', '상담비', '환불'] }) +
        inp({ f: 'f_q', v: ui.f_q, ph: '원생', w: '140px', label: '원생 검색' }) + h.btn('검색', { primary: true, act: 'CT09.search' }) + '</div>';
      html += c9missBox(ctx);
      html += '<div style="margin-top:10px">' + h.table({
        cols: [
          { label: '시각', render: r => '<span class="mono small">' + esc(day === 'week' ? r.date + ' ' + (r.time || '') : (r.time || '-')) + '</span>' },
          { label: '원생', render: r => esc(nameOf(s, r)) },
          { label: '구분', render: r => esc(r.item) + ((r.kind === '상담비' || r.kind === '테스트비') && eduSt(s) !== '등록 불필요' ? ' ' + h.chip('교육청 확인 전', 'warn') : '') + (Number(r.amount) < 0 ? ' ' + h.chip('환불', 'bad') : '') },
          { label: '금액', num: true, render: r => r.amount == null ? h.chip('미정', 'st-미정') + varChip() : '<span class="amt">' + (Number(r.amount) < 0 ? '-' + num(-r.amount) : num(r.amount)) + '</span>' },
          { label: '수단', render: r => esc(r.method) },
          { label: '승인번호', render: r => '<span class="mono small">' + esc(r.approval || '-') + '</span>' },
          { label: '현금영수증', render: r => r.cash ? '<span class="mono small">' + esc(r.cash) + '</span>' : needCash(r) && !s.ct09.cut[r.id] ? h.chip('번호 없음', 'bad') : '-' },
          { label: '처리자', render: r => esc(r.by || '-') },
          { label: '', render: r => s.ct09.cut[r.id] ? h.chip('취소', 'p2') : c9pending(s, r.id) ? h.chip('승인 대기', 'warn') : '<div class="ctc-acts">' + h.btn('영수증', { sm: true, act: 'CT09.rcpt', arg: r.id }) + (Number(r.amount) < 0 ? '' : h.btn('취소', { sm: true, act: 'CT09.cancel', arg: r.id, disabled: !ctx.canEdit })) + '</div>' },
        ],
        rows: list,
        rowAttr: r => s.ct09.cut[r.id] ? ' class="ctc-cut"' : Number(r.amount) < 0 ? ' class="ctc-neg"' : (ui.rcpt === r.id ? ' class="sel"' : ''),
        empty: '조건에 맞는 수납이 없어요.',
      }) + '</div></div>';
      const rc = ui.rcpt && c9all(ctx).find(r => r.id === ui.rcpt);
      html += '<div data-pin="2" style="margin-top:8px">' + (rc
        ? '<div class="ctc-rcpt"><div class="row" style="margin-bottom:6px"><b>영수증 미리 보기</b><span class="muted small">교습비 영수증</span>' + h.btn('닫기', { sm: true, act: 'CT09.rcpt', arg: rc.id }) + '</div>' +
          h.kv([['학습자', nameOf(s, rc)], ['과목', rc.subject || '브레인180 ' + (rc.item || '')], ['교습 기간', rc.period || '2027년 3월'], ['금액', rc.amount == null ? '미정' : num(rc.amount) + '원'], ['수단', rc.method + (rc.approval && rc.approval !== '-' ? ' ' + rc.approval : '')], ['현금영수증', rc.cash || '해당 없음'], ['발행', ctx.center ? ctx.center.name + ' (' + ctx.center.bizNo + ')' : '-']]) + '</div>'
        : '<div class="ctc-note" style="padding:4px 0 0 16px">영수증에는 학습자 이름, 과목, 교습 기간을 적고 현금영수증 번호도 함께 남겨요. 줄의 영수증 버튼을 누르면 여기에 미리 보기가 열려요. ' + h.polChip('POL-37') + '</div>') + '</div>';
      html += '<div class="grid g2" style="margin-top:14px">';
      html += h.card({
        title: '수정·취소 이력', pin: 3,
        body: h.table({ cols: [{ label: '일시', k: 'at' }, { label: '내용', k: 'what' }, { label: '사유', k: 'why' }, { label: '처리자', k: 'by' }, { label: '승인', render: x => x.done ? '<span class="small">' + esc(x.appr || '') + '</span>' : h.chip('승인 대기', 'warn') }], rows: s.ct09.hist, empty: '아직 고치거나 취소한 수납이 없어요.' }) +
          '<div class="small muted" style="margin-top:6px">사유 없이 고치거나 취소할 수 없고, 이력은 지워지지 않아요.</div>' + c9approvalNote(ctx),
      });
      html += c9closeCard(ctx, false);
      html += '</div>';
      const un = c9unpaid(ctx);
      html += '<div style="margin-top:12px">' + h.card({
        title: '미수 (탭 요약)', pin: 5, right: h.btn('미수 탭 열기', { sm: true, goTab: 'b', go: 'CT-09' }),
        body: '<div>' + un.length + '건, ' + num(un.reduce((a, u) => a + u.amount, 0)) + '원. 4월 재등록 미수는 재등록 화면(CT-08)에서 관리해요.</div>',
      }) + '</div>';
      return html;
    },
    mount(root, ctx) { live(root, ctx); },
    prd: {
      summary: '센터가 받은 돈을 시간 순서로 보고, 아직 못 받은 돈을 챙겨요. 하루가 끝나면 결제 수단별로 돈을 맞춰 보고 마감해요.',
      who: '원장과 실장·데스크가 써요. 마감한 날의 수정은 원장 승인을 받아요. 교사와 보조교사에게는 메뉴가 안 보여요.',
      items: [],
      open: ['상담비 금액과 받는 주체, 교육청 확인 결과 (POL-27)', '수납 수단 목록 확정, 지금은 예시 (POL-37)', '가맹 결제 연동 방식, 결제선생 답변 대기 (POL-36)', '직영 현금 보관 한도와 본사 입금 주기', '현금영수증 의무 발행 기준 금액, 세무사 확인 중'],
    },
  });
  // PRD 항목 (탭마다 보이는 번호가 달라요)
  (function () {
    const I = {
      1: { t: '수납 내역', d: '모든 수납을 시간 순서로 봐요. 직영의 결제선생 결제는 자동으로 들어오고, 가맹은 센터가 기록한 내역이에요. 기간, 수단, 구분으로 골라 볼 수 있어요. 원문 예시의 테스트비와 상담비 줄은 HQ-14 교육청 확인이 끝나기 전이면 노란 표시가 붙어요. 받으면 안 되는 돈이라 취소 사유에 \'교육청 확인 전에 받은 돈\'이 있어요.', pol: ['POL-36'], ref: 'p.54 ①' },
      2: { t: '영수증', d: '교습비 영수증에는 학습자 이름, 과목, 교습 기간을 적고 현금영수증 번호도 함께 남겨요. 영수증 버튼을 누르면 아래에 미리 보기가 열려요.', pol: ['POL-37'], ref: 'p.54 ②' },
      3: { t: '수정·취소', d: '수납을 고치거나 취소할 때는 사유를 꼭 골라요. 기록은 이력에 남고 지워지지 않아요.', ref: 'p.54 ③' },
      4: { t: '일일 마감', d: '수단별 합계와 현금 시재를 맞춰 보고 마감해요. 마감한 뒤에 고치려면 원장 승인이 있어야 해요.', ref: 'p.54 ④' },
      5: { t: '미수', d: '아직 못 받은 학생과 금액을 봐요. 다시 안내하거나 받은 돈을 바로 기록해요. 4월 재등록 미수는 재등록 화면(CT-08)에서 이어서 관리해요.', ref: 'p.54 ⑤' },
      6: { t: '현금영수증 빠짐 확인', kind: 'review', imp: 'IMP-13', d: '현금이나 계좌이체로 10만 원 이상 받았는데 현금영수증 번호가 없으면 빨갛게 표시해요. 번호를 넣어야 마감할 수 있어요. 발급 기준 금액은 법정이고 세무사 확인을 기다려요.' },
      7: { t: '받은 돈과 돌려준 돈', kind: 'review', imp: 'IMP-13', d: '마감표에 받은 돈, 돌려준 돈, 순합계를 나눠 보여 줘요. 환불과 취소는 처리한 날 마감에서 빼요. 시재가 장부와 다르면 차액 사유를 적어야 마감되고, 직영은 현금을 본사 계좌에 넣은 날도 등록해요.' },
      8: { t: '마감 뒤 수정 승인', kind: 'review', imp: ['IMP-14', 'IMP-28'], d: '마감한 날의 수납을 고치면 원장 승인을 받아요. 실장이 요청하면 원장이 승인하고, 원장이 직접 고치면 사유가 본사 정산 담당에게 알림으로 가요. 혼자 운영하는 센터에서도 기록이 남아요.' },
    };
    const tabsOf = { 1: ['a'], 2: ['a'], 3: ['a'], 4: ['a', 'c'], 5: ['a', 'b'], 6: ['a', 'c'], 7: ['a', 'c'], 8: ['a', 'c'] };
    const items = [];
    ['a', 'b', 'c'].forEach(tab => Object.keys(I).forEach(n => { if (tabsOf[n].includes(tab)) items.push(Object.assign({ n: Number(n), tab }, I[n])); }));
    B.screens['CT-09'].prd.items = items;
  })();
  function c9tabB(ctx) {
    const s = ctx.s, un = c9unpaid(ctx), k = B.c8kpi ? B.c8kpi(ctx) : null;
    let html = h.card({
      title: '미수', sub: un.length + '건 · ' + num(un.reduce((a, u) => a + u.amount, 0)) + '원', pin: 5,
      right: h.btn('미수 전체 다시 안내', { sm: true, act: 'CT09.remind', arg: 'all', disabled: !ctx.canEdit || !un.length }),
      body: h.table({
        cols: [
          { label: '원생', render: u => esc(u.name) }, { label: '반', k: 'cls' }, { label: '항목', k: 'item' },
          { label: '금액', num: true, render: u => num(u.amount) }, { label: '청구일', k: 'billed' }, { label: '최근 안내', k: 'last' },
          { label: '', render: u => '<div class="ctc-acts">' + h.btn('다시 안내', { sm: true, act: 'CT09.remind', arg: u.id, disabled: !ctx.canEdit }) + h.btn('수납 기록', { sm: true, primary: true, act: 'CT09.collect', arg: u.id, disabled: !ctx.canEdit }) + '</div>' },
        ],
        rows: un, empty: '못 받은 돈이 없어요.',
      }) + '<div class="small muted" style="margin-top:6px">받은 돈을 기록하면 수납 내역과 오늘 마감표에 바로 들어가요.</div>',
    });
    if (k) html += '<div style="margin-top:12px">' + h.alert('4월 재등록 미수 ' + num(k.unpaid) + '명 · ' + num(k.due) + '원은 재등록 화면에서 이어서 관리해요. ' + h.btn('재등록 미수 보기 (CT-08)', { sm: true, act: 'CT09.toCT08' }), 'info', { raw: true }) + '</div>';
    return html;
  }
  function c9tabC(ctx) {
    const s = ctx.s;
    let html = '<div class="grid g-side"><div class="stack">' + c9closeCard(ctx, true) + '</div><div class="stack">' + c9missBox(ctx) +
      h.card({ title: '지난 마감', body: Object.keys(s.ct09.closed).length ? '<div class="tl">' + Object.keys(s.ct09.closed).map(d => { const x = s.ct09.closed[d]; return '<div><b>' + esc(mdS('2027-' + d)) + '</b> ' + esc(x.at + ' ' + x.by) + ' · 현금 ' + num(x.cash) + (x.diff ? ' (차액 ' + num(x.diff) + ')' : '') + '</div>'; }).join('') + '</div>' : '<div class="small muted">3/7 마감 18:40 실장 송하늘 (예시). 오늘 마감은 아직이에요.</div>' }) +
      c9approvalNote(ctx) + '</div></div>';
    return html;
  }

  B.action('CT09.day', (ctx, v) => { ctx.ui.f_day = v || C9_DAY; });
  B.action('CT09.method', (ctx, v) => { ctx.ui.f_m = v || ''; });
  B.action('CT09.kind', (ctx, v) => { ctx.ui.f_k = v || ''; });
  B.action('CT09.search', () => {});
  B.action('CT09.excel', ctx => { ctx.s.audit.unshift({ at: '03-08 18:20', who: ctx.persona.name + ' (' + ctx.role + ')', what: '엑셀 다운로드', target: '3월 수납 내역', reason: '일일 마감' }); B.toast('수납 내역을 엑셀로 내려받았어요. 내려받은 기록이 남아요.'); return false; });
  B.action('CT09.rcpt', (ctx, id) => { ctx.ui.rcpt = ctx.ui.rcpt === id ? null : id; });
  B.action('CT09.cashOpen', ctx => { ctx.ui.cashOpen = !ctx.ui.cashOpen; });
  function c9cancel(ctx, id, why) {
    const s = ctx.s, r = c9all(ctx).find(x => x.id === id); if (!r) return;
    if (s.ct09.cut[id] || c9pending(s, id)) { B.toast('이미 취소했거나 승인을 기다리는 건이에요.'); return; }
    const closed = !!s.ct09.closed[r.date];
    const e = { id, at: '03-08 ' + tick(s), day: C9_DAY, what: '취소 ' + (r.amount == null ? '(금액 미정)' : num(r.amount)), amount: Number(r.amount) || 0, method: r.method, why: why || '중복 결제', by: who(ctx), done: true, appr: '마감 전 처리' };
    if (closed) {
      if (ctx.role === '원장') { e.appr = '원장 자기 승인, 본사 알림'; B.toast('마감한 날이라 원장 승인으로 처리했어요. 사유가 본사 정산 담당에게 알림으로 갔어요.'); }
      else { e.done = false; e.appr = ''; B.toast('마감한 날이라 원장에게 승인 요청을 보냈어요.'); }
    } else B.toast('취소를 기록했어요. 이력은 지워지지 않아요.');
    if (e.done) s.ct09.cut[id] = e;
    s.ct09.hist.unshift(e);
  }
  B.action('CT09.cancel', (ctx, arg, el) => {
    if (!ctx.canEdit) return;
    const id = arg && typeof arg === 'object' ? arg.id : arg;
    if (arg && typeof arg === 'object') { c9cancel(ctx, id, arg.why); return; }
    if (el) {
      const r = c9all(ctx).find(x => x.id === id); if (!r) return;
      const closed = !!ctx.s.ct09.closed[r.date];
      B.modal({ title: '수납 취소 · ' + nameOf(ctx.s, r) + ' ' + (r.amount == null ? '' : num(r.amount) + '원'), ok: closed && ctx.role !== '원장' ? '원장 승인 요청' : '취소 기록',
        body: '<div class="field"><label for="ctc9-why">사유<span class="req">*</span></label><select class="inp" id="ctc9-why"><option>중복 결제</option><option>금액을 잘못 입력</option><option>수단을 잘못 입력</option><option>보호자 요청</option><option>교육청 확인 전에 받은 돈</option></select></div>' +
          (closed ? h.alert(ctx.role === '원장' ? '마감한 날이에요. 원장이 직접 승인하면 사유가 본사 정산 담당에게 알림으로 가요.' : '마감한 날이에요. 원장 승인을 받아야 취소돼요.', 'review') : '<div class="small muted">취소한 금액은 오늘 마감표에서 돌려준 돈으로 빠지고, 원래 결제한 날의 마감은 그대로 둬요.</div>'),
        onOk: back => { c9cancel(ctx, id, readModal(back, 'ctc9-why')); } });
      return false;
    }
    c9cancel(ctx, id, '중복 결제');
  });
  B.action('CT09.approve', (ctx, id) => {
    if (ctx.role !== '원장') { B.toast('원장만 승인할 수 있어요.'); return; }
    const e = c9pending(ctx.s, id); if (!e) return;
    e.done = true; e.appr = '원장 승인 (' + ctx.persona.name + ')'; ctx.s.ct09.cut[id] = e;
    B.toast('취소를 승인했어요.');
  });
  B.action('CT09.cashNo', (ctx, arg, el) => {
    if (!ctx.canEdit) return;
    const id = arg && typeof arg === 'object' ? arg.id : arg;
    const set = no => {
      no = String(no || '').trim();
      if (!/^[0-9*-]{8,20}$/.test(no)) { B.toast('현금영수증 번호(휴대폰 번호나 승인번호)를 넣어 주세요.'); return false; }
      ctx.s.ct09.cashNo[id] = no; const p = (ctx.s.payments || []).find(x => x.id === id); if (p) p.receipt = '발급';
      if (ctx.ui.cerr) ctx.ui.cerr.miss = null;
      B.toast('현금영수증 번호를 넣었어요.');
    };
    if (arg && typeof arg === 'object') { set(arg.no); return; }
    if (el) {
      B.modal({ title: '현금영수증 번호 넣기', ok: '저장', body: '<div class="field"><label for="ctc9-no">번호<span class="req">*</span></label><input class="inp" id="ctc9-no" placeholder="010-0000-0000 또는 승인번호"></div><div class="ctc-errs" id="ctc9-no-err"></div>',
        onOk: back => { const r = set(readModal(back, 'ctc9-no')); if (r === false) { const e = back.querySelector('#ctc9-no-err'); if (e) e.textContent = '휴대폰 번호나 승인번호를 8자리 이상 숫자로 넣어 주세요.'; } return r; } });
      return false;
    }
  });
  B.action('CT09.close', (ctx, arg) => {
    if (!ctx.canEdit) return;
    const s = ctx.s, ui = ctx.ui, d = C9_DAY;
    if (s.ct09.closed[d]) { B.toast('이미 마감했어요.'); return; }
    if (arg && typeof arg === 'object') { if (arg.cash != null) ui.cashCnt = String(arg.cash); if (arg.why != null) ui.cashWhy = arg.why; }
    const t = c9tot(ctx, d), miss = c9missing(ctx, d), e = ui.cerr = {};
    if (miss.length) e.miss = '현금영수증 번호가 없는 건이 ' + miss.length + '건 있어요. 번호를 넣어야 마감할 수 있어요.';
    const cnt = Number(String(ui.cashCnt == null ? '' : ui.cashCnt).replace(/,/g, ''));
    if (ui.cashCnt == null || String(ui.cashCnt).trim() === '' || isNaN(cnt)) { e.cash = '현금 시재를 먼저 넣어 주세요.'; ui.cashOpen = true; }
    else if (cnt !== t.book && !String(ui.cashWhy || '').trim()) { e.why = '장부와 ' + num(Math.abs(cnt - t.book)) + '원 차이가 나요. 차액 사유를 적어 주세요.'; ui.cashOpen = true; }
    if (Object.keys(e).length) { B.toast('마감할 수 없어요. 빨간 글씨를 확인해 주세요.'); return; }
    s.ct09.closed[d] = { at: tick(s), by: who(ctx), cash: cnt, book: t.book, diff: cnt - t.book, why: String(ui.cashWhy || ''), deposit: '', t: { by: Object.assign({}, t.by), back: t.back, noCash: t.noCash, book: t.book, unknown: t.unknown } };
    ui.cashOpen = false; ui.cerr = {};
    B.toast('3/8 일일 마감을 했어요. 이제 이날 수납을 고치려면 원장 승인이 있어야 해요.');
  });
  B.action('CT09.deposit', ctx => { const x = ctx.s.ct09.closed[C9_DAY]; if (!x || !ctx.canEdit) return; x.deposit = '03-09 등록'; B.toast('현금 ' + num(x.cash) + '원 본사 계좌 입금을 등록했어요. 본사 대사(HQ-16)에서 확인해요.'); });
  B.action('CT09.remind', (ctx, arg) => {
    if (!ctx.canEdit) return;
    const s = ctx.s, list = c9unpaid(ctx).filter(u => arg === 'all' || !arg || u.id === arg);
    if (!list.length) return;
    list.forEach(u => { u.last = '03-08 미납 안내'; s.alim.log.push({ at: '03-08 ' + tick(s), center: ctx.centerId, student: u.id, tpl: 'T04', name: '미납 안내', to: '-', text: '3월 수강료가 아직 납부되지 않았어요.', status: '발송 완료', src: 'CT-09' }); });
    B.toast(list.length + '명에게 미납 안내를 보냈어요.' + (isDirect(ctx.center) ? '' : ' 알림톡 잔액에서 ' + num(list.length * 7) + '원 빠져요.'));
  });
  function c9collect(ctx, id, method) {
    const s = ctx.s, u = c9unpaid(ctx).find(x => x.id === id); if (!u) return;
    u.paid = C9_DAY;
    s.ct09.rows.push({ id: 'c9-' + (s.ct09.rows.length + 1), center: ctx.centerId, date: C9_DAY, time: tick(s), name: u.name, kind: '교습비', item: u.item, amount: u.amount, method: method || '카드', approval: /카드/.test(method || '카드') ? '단말기 승인' : '-', cash: '', by: who(ctx), subject: '브레인180 주 2회 · 90분', period: '2027-03-01 ~ 03-31' });
    B.toast(u.name + ' ' + num(u.amount) + '원 수납을 기록했어요.' + (/현금|이체/.test(method || '') ? ' 현금영수증 번호도 넣어 주세요.' : ''));
  }
  B.action('CT09.collect', (ctx, arg, el) => {
    if (!ctx.canEdit) return;
    const id = arg && typeof arg === 'object' ? arg.id : arg;
    if (arg && typeof arg === 'object') { c9collect(ctx, id, arg.method); return; }
    if (el) { B.modal({ title: '받은 돈 기록', ok: '기록', body: '<div class="field"><label for="ctc9-m">수단</label><select class="inp" id="ctc9-m"><option>카드</option><option>계좌이체</option><option>현금</option><option>지역화폐</option></select></div>', onOk: back => { c9collect(ctx, id, readModal(back, 'ctc9-m')); } }); return false; }
    c9collect(ctx, id, '카드');
  });
  B.action('CT09.toCT08', ctx => { ctx.s.ui['CT-08'] = Object.assign(ctx.s.ui['CT-08'] || {}, { f_st: '미수' }); B.go('CT-08'); return false; });

  /* =====================================================================
     CT-10 휴원·퇴원·환불 (p.55)
     ===================================================================== */
  B.extend(s => {
    s.ct10 = {
      // rf1은 대시보드(CT-01) 환불 기한 카드와 같은 id예요. 원문 55쪽 예시 그대로예요.
      cases: {
        rf1: { key: 'rf1', center: 'daechi1', name: '정*호', grade: '초5', cls: 'L3-월수A', days: '월·수', item: '3월 교습비', base: 260000, book: 0, paid: 260000, disc: '', reason: '퇴원 (학원 일정 겹침)', occur: '2027-03-06', status: '계산 완료', method: '카드 취소', log: [] },
        rf2: { key: 'rf2', center: 'daechi1', name: '오*린', grade: '초4', cls: 'L2-월수B', days: '월·수', item: '3월 교습비', base: 260000, book: 0, paid: 260000, disc: '', reason: '퇴원 (이사)', occur: '2027-03-08', status: '계산 중', method: '카드 취소', log: [] },
        // 본사 대시보드(HQ-01)의 환불 기한 D-2 대구수성센터 1건을 지원 모드로 열 때 보이는 예시예요. 금액은 대구 센터 교습비 290,000 기준이에요.
        rf3: { key: 'rf3', center: 'daegu', name: '문*아', grade: '초4', cls: 'L3-화목A', days: '화·목', item: '3월 교습비', base: 290000, book: 0, paid: 290000, disc: '', reason: '퇴원 (학습 중단)', occur: '2027-03-05', status: '계산 완료', method: '카드 취소', log: [] },
      },
    };
  });
  const C10_REASONS = ['퇴원 (학원 일정 겹침)', '퇴원 (이사)', '퇴원 (학습 중단)', '휴원 (질병)', '휴원 (개인 사정)', '센터 사정 (휴원, 폐원)'];
  function c10caseOf(s, st, extra) {
    extra = extra || {};
    const k = s.classes.find(c => c.id === st.cls) || {};
    const center = s.centers.find(c => c.id === st.center);
    const hist = ((s.ct06 || {}).hist || {})[st.id] || [];
    const row = hist.find(r => r.m === '2027-03');
    const base = row ? row.paid : price(s, center, st.product || 'pr1');
    const book = row ? (row.book || 0) : (s.extraFees[0] || {}).amount || 0;
    const reason = extra.reason ? (/^(퇴원|휴원|센터)/.test(extra.reason) ? extra.reason : '퇴원 (' + extra.reason + ')') : C10_REASONS[0];
    return { key: st.id, student: st.id, center: st.center, name: st.name, grade: st.grade, cls: k.name || '-', days: k.days || '월·수', item: '3월 교습비', base, book, paid: base + book, disc: row ? (row.disc || '') : '',
      since: st.since && st.since.slice(0, 7) === '2027-03' && st.since > '2027-03-01' ? st.since : '', reason, occur: extra.occur || '2027-03-06', status: '계산 중', method: '카드 취소', log: [] };
  }
  function c10case(ctx) {
    const s = ctx.s, ui = ctx.ui, C = s.ct10.cases;
    if (ui.refund && C[ui.refund]) { ui.key = ui.refund; c10clear(ui); }
    delete ui.refund;
    if (ui.student) {
      const st = s.students.find(x => x.id === ui.student);
      if (st) {
        const old = C[st.id];
        if (!old || old.status === '실행 완료' || ui.occur) C[st.id] = Object.assign(c10caseOf(s, st, { occur: ui.occur, reason: ui.reason }), old && old.status !== '실행 완료' ? { log: old.log } : {});
        ui.key = st.id; c10clear(ui);
      }
      ['student', 'occur', 'out', 'reason'].forEach(k => delete ui[k]);
    }
    // 지금 센터의 환불 건만 열어요. 대치1은 안내서대로 s1 윤서아, 다른 센터는 기한이 가장 가까운 건이에요.
    const mine = k => !!(k && C[k] && C[k].center === ctx.centerId);
    if (!mine(ui.key)) {
      ui.key = null;
      const st = s.students.find(x => x.id === 's1' && x.center === ctx.centerId);
      if (st) { if (!C.s1) C.s1 = c10caseOf(s, st, {}); ui.key = 's1'; }
      else {
        const list = Object.keys(C).filter(mine).map(k => C[k]);
        const open = list.filter(x => x.status !== '실행 완료').sort((a, b) => String(a.occur).localeCompare(String(b.occur)));
        ui.key = (open[0] || list[0] || {}).key || null;
      }
      c10clear(ui);
    }
    return ui.key ? C[ui.key] : null;
  }
  function c10clear(ui) { ['f_reason', 'f_occur', 'f_acct', 'f_memo', 'f_method', 'err'].forEach(k => delete ui[k]); }
  // 본사 환불 규정(HQ-12)에 저장된 값을 그대로 읽어요. 직영은 법정 기준, 가맹은 센터 상향 값이 법정보다 유리할 때만 써요.
  const C10_FR = { '반환 없음': [0, 1], '1/3': [1, 3], '1/2': [1, 2], '2/3': [2, 3], '3/4': [3, 4], '전액': [1, 1] };
  const C10_LEGAL = { a: '2/3', b: '1/2', c: '반환 없음', d: 5 };
  const C10_SEG = { a: '1/3 경과 전', b: '1/2 경과 전', c: '1/2 경과 후' };
  const c10fv = v => { const f = C10_FR[v] || C10_FR['반환 없음']; return f[0] / f[1]; };
  function c10rule(s, cid) {
    s = s || B.store;
    const hq = s.hq12 || {}, base = (hq.vals && hq.vals.base) || {}, c = (s.centers || []).find(x => x.id === cid);
    const unit = [1, 10, 100].includes(Number(base.round)) ? Number(base.round) : 10;
    const r = { a: C10_LEGAL.a, b: C10_LEGAL.b, c: C10_LEGAL.c, d: C10_LEGAL.d, unit, up: [], direct: isDirect(c) };
    if (c && !r.direct) {
      ['a', 'b', 'c'].forEach(k => { const v = base['up_' + cid + '_' + k]; if (C10_FR[v] && c10fv(v) > c10fv(r[k])) { r[k] = v; r.up.push(k); } });
      const d = Number(base['up_' + cid + '_d']); if (d > 0 && d < r.d) { r.d = d; r.up.push('d'); }
    }
    const vers = (hq.ver || []).filter(x => !x.date || x.date <= (s.today || '9999'));
    const ver = vers[vers.length - 1] || (hq.ver || [])[0];
    r.ver = ver ? ver.v + ' (' + ver.date + ')' : '';
    return r;
  }
  // 학원법 반환 기준 (교습기간 1개월 이내). 지난 회차는 반 시간표로 세요. 구간 나누기와 끝전 올림은 HQ-12 계산 미리보기와 같은 식이에요.
  function c10calc(cs, occur, today, s) {
    const rule = c10rule(s, cs.center), hm = holMap(s, cs.center);
    const ym = okDate(occur) ? occur.slice(0, 7) : '2027-03';
    const all = sessions(cs.days, ym, cs.since || null, hm), past = all.filter(d => d < occur);
    const n = all.length, k = past.length, r = n ? k / n : 0;
    const seg = k === 0 ? '' : r < 1 / 3 ? 'a' : r < 1 / 2 ? 'b' : 'c';
    const fracTxt = seg ? rule[seg] : '전액', f = C10_FR[fracTxt] || C10_FR['반환 없음'], frac = f[0] / f[1], up = !!seg && rule.up.includes(seg);
    const label = !seg ? '교습 시작 전이라 전액 반환' : C10_SEG[seg] + '이라 ' + (frac ? fracTxt + ' 반환' : '반환 없음') + (up ? ' (센터 상향 기준)' : '');
    const amount = Math.ceil(cs.base * f[0] / f[1] / rule.unit - 1e-9) * rule.unit;
    const due = okDate(occur) ? addDays(occur, rule.d) : '';
    const five = dayList(cs.days).some(w => { let c = 0; for (let i = 1; i <= dim(ym); i++) if (dow(ym + '-' + pad(i)) === w) c++; return c === 5; });
    const hol = Object.keys(hm).filter(d => d.slice(0, 7) === ym && dayList(cs.days).includes(dow(d))).sort().map(d => ({ d, name: hm[d] }));
    return { ym, n, k, r, past, frac, fracTxt, label, amount, due, dd: due ? dayDiff(today, due) : null, five, hol, same: all.includes(occur), rule, seg, up };
  }
  const C10_STEPS = ['계산', '요청', '승인', '실행 완료'];
  const c10stepIdx = st => ({ '계산 중': 0, '계산 완료': 0, '반려': 0, '승인 대기': 1, '승인': 2, '실행 완료': 3 })[st] || 0;
  const C10_TONE = { '실행 완료': 'ok', '승인 대기': 'warn', '반려': 'bad' };
  function c10vals(ctx, cs) { const ui = ctx.ui; return { reason: ui.f_reason || cs.reason, occur: ui.f_occur != null ? ui.f_occur : cs.occur, method: ui.f_method || cs.method, acct: ui.f_acct != null ? ui.f_acct : (cs.acct || ''), memo: ui.f_memo != null ? ui.f_memo : (cs.memo || '') }; }

  B.screen({
    id: 'CT-10', side: 'ct', phase: 'P1a', devices: ['pc'], pages: [55],
    title: '휴원·퇴원·환불', menuLabel: '환불 처리', crumb: '수강·수납 > 환불 처리',
    headActions: ctx => {
      const cs = c10case(ctx); if (!cs) return '';
      const done = cs.status === '실행 완료', wait = cs.status === '승인 대기';
      const main = ctx.partial
        ? h.btn(wait ? '승인 요청 보냄' : cs.status === '반려' ? '다시 요청' : '환불 요청', { primary: true, act: 'CT10.request', disabled: done || wait })
        : h.btn(wait ? '승인하고 환불 등록' : '환불 등록', { primary: true, act: 'CT10.register', disabled: done || !ctx.canEdit });
      return h.btn('취소', { act: 'CT10.reset', disabled: done }) + (wait && !ctx.partial ? h.btn('반려', { act: 'CT10.reject', disabled: !ctx.canEdit }) : '') + main;
    },
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, cs = c10case(ctx);
      if (!cs) return h.alert('학부모 환불과 본사 사용료 반환은 따로 처리해요. 사용료는 POL-03을 따라요.', 'info') + '<div style="margin-top:12px">' + h.empty('이 센터에는 기다리는 환불이 없어요. 원생 상세(CT-06)에서 퇴원을 처리하면 여기로 넘어와요.') + '</div>';
      const v = c10vals(ctx, cs), cal = c10calc(cs, v.occur, s.today, s), done = cs.status === '실행 완료';
      const e = ui.err || {}, ro = !ctx.canEdit || done;
      let html = h.alert('학부모 환불과 본사 사용료 반환은 따로 처리해요. 사용료는 POL-03을 따라요.', 'info');
      html += '<div class="ctc-line" style="margin-top:12px"><h2>환불 처리 · ' + esc(h.mask(cs.name)) + ' (' + esc(cs.grade) + ')</h2>' +
        '<span class="ctc-pill' + (cal.dd != null && cal.dd <= 2 ? ' bad' : '') + '" data-pin="4">' + (cal.due ? (done ? '반환 완료 ' + esc(cs.doneAt || '') : (cal.dd < 0 ? '반환 기한 지남 ' : '반환 기한 D-' + cal.dd + ' · ') + mdS(cal.due) + '까지') : '사유 발생일을 넣어 주세요') + '</span>' +
        '<span class="muted small">사유 발생일 ' + (okDate(v.occur) ? mdS(v.occur) : '-') + ' + ' + cal.rule.d + '일 ' + (cal.rule.up.includes('d') ? '(센터 상향, 법정은 5일)' : '(법정)') + (cal.dd != null && cal.dd <= 2 && !done ? ', 대시보드 경고 중' : '') + '</span>' + h.chip(cs.status, C10_TONE[cs.status] || 'info') + '</div>';
      html += '<div class="grid g2">';
      // 왼쪽: 반환 사유, 계산, 센터 기준
      html += '<div class="stack">';
      html += h.card({
        title: '반환 사유', pin: 1,
        body: '<div class="ctc-form"><label>사유</label>' + sel({ f: 'f_reason', v: v.reason, opts: C10_REASONS, dis: ro, label: '사유', w: '100%' }) +
          '<label>사유 발생일<span class="req">*</span></label><div>' + inp({ f: 'f_occur', v: v.occur, type: 'date', live: true, dis: ro, err: e.occur, label: '사유 발생일' }) + (e.occur ? '<div class="ctc-errs">' + esc(e.occur) + '</div>' : '') + '</div>' +
          '<label>연결</label><div>' + (cs.student ? h.btn('원생 상세 퇴원 처리 (CT-06)', { sm: true, act: 'CT10.toCT06' }) : '<span class="small">원생 상세 퇴원 처리 (CT-06)에서 넘어왔어요</span>') + '</div></div>',
      });
      html += h.card({
        title: '계산', pin: 2,
        body: '<div class="ctc-form">' +
          '<label>수납</label><span>' + esc(cs.item) + ' ' + num(cs.base) + ' (' + esc(cs.cls) + ' · 교습기간 1개월)</span>' +
          '<label>총 교습시간</label><span>' + cal.n + '회 × 90분 = ' + (cal.n * 90) + '분 ' + h.polChip('POL-20') + ' <span class="muted small">' + [cal.five ? '5주 달' : '4주 달'].concat(cal.hol.map(x => mdS(x.d) + (/휴원/.test(x.name) ? ' 휴원' : ' 공휴') + ' 제외')).concat(cs.since ? [mdS(cs.since) + ' 등록부터'] : []).join(', ') + '</span></span>' +
          '<label>경과</label><span>' + (cal.k ? cal.past.map(mdS).join(', ') + ' = ' : '') + cal.k + '회 ' + (cal.k * 90) + '분 (' + (cal.r * 100).toFixed(1) + '%)' + (cal.same ? ' <span class="muted small">사유 발생일 당일 수업은 넣지 않았어요</span>' : '') + '</span>' +
          '<label>구간</label><span>' + esc(cal.label) + '</span>' +
          '<label>교재비</label><span>' + h.chip('미정', 'st-미정') + varChip() + ' <span class="small muted">처리 방식 정책 대기</span></span></div>' +
          '<div class="ctc-box review" data-pin="7" style="margin-top:10px"><b>기준 금액은 실제로 낸 교습비예요</b>' +
          '<div>낸 돈 ' + num(cs.paid) + '원 = 교습비 ' + num(cs.base) + (cs.disc ? ' (' + esc(cs.disc) + ' 반영)' : '') + (cs.book ? ' + 교재비 ' + num(cs.book) : '') + '. 교재비는 빼고 교습비만 비율로 계산해요.</div>' +
          '<div>지난 회차는 출석이 아니라 반 시간표로 세요' + (cs.since ? '. 달 중간에 들어와서 ' + mdS(cs.since) + '부터 세었어요 (안).' : '.') + '</div></div>',
      });
      html += h.card({
        title: '센터 기준', pin: 3,
        body: (() => {
          const R = cal.rule;
          if (R.direct) return '<div>법정 기준 ' + h.chip('적용', 'ok') + ' <span class="small muted">직영 센터는 법정 기준을 그대로 써요</span></div><div class="small muted" style="margin-top:6px">가맹 센터는 학부모에게 더 유리하게만 바꿀 수 있어요 (HQ-12). ' + h.polChip('POL-25') + '</div>';
          if (!R.up.length) return '<div>법정 기준 ' + h.chip('적용', 'ok') + ' <span class="small muted">센터 상향 기준 없음</span></div><div class="small muted" style="margin-top:6px">가맹 센터는 학부모에게 더 유리하게만 바꿀 수 있어요 (HQ-12). ' + h.polChip('POL-25') + '</div>';
          return '<div>센터 상향 기준 ' + h.chip('적용', 'ok') + ' <span class="small muted">본사 환불 규정(HQ-12)에 저장된 값이에요</span></div>' +
            '<div class="ctc-sum" style="margin-top:6px">' + ['a', 'b', 'c'].map(k => '<span>' + C10_SEG[k] + '</span><span>' + esc(R[k]) + (R.up.includes(k) ? ' ' + h.chip('상향', 'info') : '') + '</span>').join('') +
            '<span>반환 기한</span><span>' + R.d + '일' + (R.up.includes('d') ? ' ' + h.chip('상향', 'info') : '') + '</span></div>' +
            '<div class="small muted" style="margin-top:6px">법정 기준보다 불리하게는 바꿀 수 없어요. ' + h.polChip('POL-25') + '</div>';
        })(),
      });
      html += '</div>';
      // 오른쪽: 반환액, 실행, 대기 목록
      html += '<div class="stack">';
      html += h.card({
        body: '<div class="ctc-sum"><span>' + esc(cs.item) + '</span><span>' + num(cs.base) + '</span><span>반환 비율</span><span>' + esc(cal.fracTxt) + '</span><span>교재비</span><span>-</span>' +
          '<span class="tot">반환액</span><span class="tot ctc-big">' + num(cal.amount) + '</span></div><div class="small muted" style="margin-top:4px">' + (cal.rule.unit === 1 ? '끝전 처리 1원 단위 그대로 (HQ-12)' : '끝전 처리 학부모에게 유리하게 ' + cal.rule.unit + '원 단위 올림 (예시, HQ-12)') + '</div>' +
          '<div class="ctc-box review" data-pin="9" style="margin-top:10px"><b>계산에 쓴 값</b>' +
          [['POL-25', '환불 규정, 학원법 반환 기준'], ['POL-20', '총 교습시간, 달력 회차로 임시 계산'], ['POL-14', '교재비 반환, 정책 대기']].map(p => '<div class="row" style="gap:6px">' + h.polChip(p[0]) + '<span class="small">' + esc(p[1]) + '</span><span style="margin-left:auto">' + stChip(polSt(p[0])) + '</span></div>').join('') +
          '<div class="small">기준일은 사유 발생일 ' + (okDate(v.occur) ? mdS(v.occur) : '-') + '이에요. ' + (done && cs.ruleVer ? '본사 환불 규정 ' + esc(cs.ruleVer) + '을 썼어요. ' : !done && cal.rule.ver ? '본사 환불 규정 ' + esc(cal.rule.ver) + '을 써요. ' : '') + (done ? '이 환불에 위 값과 상태, 기준일을 함께 저장했어요 (' + esc(cs.snapAt || '') + ').' : '법정 반환 기한이 있어서 미정 값이 있어도 막지 않고, 실행할 때 쓴 값과 상태를 함께 저장해요.') + '</div></div>',
      });
      const step = c10stepIdx(cs.status);
      html += h.card({
        title: '환불 실행', pin: 5,
        body: '<div class="ctc-form"><label>수단</label>' + h.opts(['카드 취소', '계좌 반환'], v.method, { act: ro ? null : 'CT10.method' }) +
          '<label>계좌</label><div>' + inp({ f: 'f_acct', v: v.method === '계좌 반환' ? v.acct : '', ph: '계좌 반환 때 넣어요', dis: ro || v.method !== '계좌 반환', err: e.acct, label: '계좌' }) + (e.acct ? '<div class="ctc-errs">' + esc(e.acct) + '</div>' : '') + '</div>' +
          '<label>메모</label>' + inp({ f: 'f_memo', v: v.memo, dis: ro, label: '메모' }) + '</div>' +
          '<div class="small muted" style="margin-top:6px">직영 결제선생 결제는 결제 취소로 처리돼요. 계좌번호는 가려서 저장해요. ' + h.polChip('POL-36') + '</div>' +
          '<div class="ctc-box review" data-pin="8" style="margin-top:10px">' + h.steps(C10_STEPS.map((l, i) => ({ label: l, state: i < step || (done && i === step) ? 'done' : i === step ? 'cur' : '' }))) +
          '<div class="small">' + (done ? '실행 ' + esc(cs.doneAt) + ', ' + esc(cs.doneBy || '') + (cs.reqBy ? ', 요청 ' + esc(cs.reqBy) : '') : cs.status === '승인 대기' ? esc(cs.reqBy) + '이 요청했어요. 원장이 승인하면 실행되고, 승인하지 않으면 사유를 남겨 반려해요.' : cs.status === '반려' ? esc(cs.rejBy || '원장') + '이 반려했어요 (' + esc(cs.rejWhy || '') + '). 고쳐서 다시 요청해요.' : ctx.partial ? '실장은 환불 요청까지 해요. 원장이 승인하고 실행해요.' : '원장은 바로 환불을 등록할 수 있어요. 실장이 요청하면 여기서 승인하거나 반려해요.') + '</div></div>',
      });
      const C = s.ct10.cases;
      const q = Object.keys(C).map(k => C[k]).filter(x => x.center === ctx.centerId && x.status !== '실행 완료').map(x => ({ x, c: c10calc(x, x.occur, s.today, s) })).sort((a, b) => (a.c.due || '').localeCompare(b.c.due || ''));
      html += h.card({
        title: '처리 대기 목록', pin: 6,
        body: h.table({
          cols: [
            { label: '원생', render: o => esc(h.mask(o.x.name)) },
            { label: '사유 발생', render: o => esc(o.x.occur.slice(5)) },
            { label: '기한', render: o => o.c.dd == null ? '-' : o.c.dd < 0 ? h.chip('지남', 'bad') : o.c.dd <= 2 ? h.chip('D-' + o.c.dd, 'bad') : 'D-' + o.c.dd },
            { label: '금액', num: true, render: o => o.x.status === '계산 중' ? '<span class="muted">계산 중</span>' : num(o.c.amount) },
            { label: '상태', render: o => h.chip(o.x.status, C10_TONE[o.x.status] || 'info') },
          ],
          rows: q, rowAttr: o => ' class="click' + (o.x.key === cs.key ? ' sel' : '') + '" data-act="CT10.open" data-arg="' + esc(o.x.key) + '"', empty: '기다리는 환불이 없어요.',
        }) + '<div class="small muted" style="margin-top:6px">기한이 가까운 순서예요. 교재비 같은 기타경비 처리 방식은 미정이에요. ' + h.polChip('POL-14') + '</div>',
      });
      html += '</div></div>';
      return html;
    },
    mount(root, ctx) { live(root, ctx); },
    prd: {
      summary: '학생이 그만두거나 쉬게 될 때 이미 낸 학원비 중 얼마를 언제까지 돌려줄지 법에 맞게 계산하고 기록해요.',
      who: '원장이 환불을 실행해요. 실장·데스크는 환불 요청까지만 할 수 있어요. 교사와 보조교사에게는 메뉴가 안 보여요.',
      items: [
        { n: 1, t: '반환 사유', d: '퇴원이나 휴원 같은 사유와 사유가 생긴 날을 적어요. 원생 상세(CT-06)에서 퇴원을 처리하면 이 화면으로 바로 넘어와요.', ref: 'p.55 ①' },
        { n: 2, t: '계산', d: '학원법 반환 기준(본사 환불 규정)에 따라 총 교습시간 중 지난 비율로 계산해요. 총 교습시간에는 4·5주 달 정책과 공휴일, 휴원일이 들어가요. 계산식은 HQ-12 미리 보기와 같아요.', pol: ['POL-25', 'POL-20'], ref: 'p.55 ②' },
        { n: 3, t: '센터 기준', d: '가맹 센터가 학부모에게 더 유리한 기준을 쓰면 그 기준으로 계산해요. 본사 환불 규정(HQ-12)에 센터별로 저장한 비율과 기한, 끝전 단위를 그대로 읽어요. 법정 기준보다 불리하게는 바꿀 수 없어요.', pol: ['POL-25'], ref: 'p.55 ③' },
        { n: 4, t: '반환 기한', d: '사유가 생긴 날부터 5일 안에 돌려줘야 해요(법정). 기한 2일 전부터 대시보드에 경고가 떠요.', ref: 'p.55 ④' },
        { n: 5, t: '환불 실행', d: '카드 취소나 계좌 반환을 기록해요. 직영의 결제선생 결제는 결제 취소로 처리돼요. 실행하면 수납 내역(CT-09)에 마이너스 금액이 남고 보호자에게 환불 안내가 가요.', pol: ['POL-36'], ref: 'p.55 ⑤' },
        { n: 6, t: '처리 대기', d: '기한이 가까운 순서로 보여 줘요. 줄을 누르면 그 환불을 열어요. 교재비 같은 기타경비를 어떻게 돌려줄지는 아직 미정이에요.', pol: ['POL-14'], ref: 'p.55 ⑥' },
        { n: 7, t: '기준 금액과 지난 회차', kind: 'review', imp: 'IMP-09', d: '돌려줄 돈의 기준은 실제로 낸 교습비예요. 할인과 차감은 반영하고 교재비는 빼요. 지난 회차는 출석이 아니라 그 학생 반의 시간표로 세요. 달 중간에 들어온 학생은 등록한 날부터 세는 안을 써요.' },
        { n: 8, t: '요청과 승인 단계', kind: 'review', imp: 'IMP-14', d: '환불을 계산, 요청, 승인, 실행 완료 순서로 나눠요. 실장이 요청하면 원장이 승인하고 실행해요. 승인하지 않으면 사유를 남기고 반려해서 계산 단계로 돌려보내요. 누가 언제 요청하고 승인했는지 남아요.' },
        { n: 9, t: '계산에 쓴 값 기록', kind: 'review', imp: 'IMP-10', pol: ['POL-20'], d: '환불마다 계산에 쓴 정책 값과 상태, 기준일을 함께 저장해요. 환불의 기준일은 사유 발생일이에요. 4·5주 달 정책(POL-20)이 미정이라 지금은 달력 회차로 계산한다고 보여 줘요. 환불은 5일 법정 기한이 있어서 미정 값이 있어도 막지 않아요.' },
      ],
      open: ['교재비 같은 기타경비 반환 방식 (POL-14)', '4·5주 달 총 교습시간 세는 법 (POL-20)', '끝전 처리 방식, 화면의 올림은 예시', '사유 발생일 당일 수업과 딱 1/3이 지난 날 같은 경계 계산', '달 중간 퇴원 때 본사 사용료, 돌려주지 않는 안 (POL-03)'],
      rules: ['환불은 사유가 생긴 날부터 5일 안에 해야 해요 (학원법, 법정).', '교습기간 1개월 이내는 1/3이 지나기 전 2/3, 1/2이 지나기 전 1/2를 돌려주고 그 뒤에는 돌려주지 않아요 (법정).'],
    },
  });

  function c10check(ctx, cs) {
    const v = c10vals(ctx, cs), e = ctx.ui.err = {};
    if (!okDate(v.occur)) e.occur = '사유 발생일을 넣어 주세요. 반환 기한을 이날부터 세요.';
    else if (v.occur > ctx.s.today) e.occur = '사유 발생일은 오늘이나 그 전이어야 해요.';
    if (v.method === '계좌 반환' && !/^[0-9-]{8,20}$/.test(String(v.acct || '').trim())) e.acct = '돌려받을 계좌번호를 넣어 주세요.';
    return Object.keys(e).length ? null : v;
  }
  function c10save(cs, v) { Object.assign(cs, { reason: v.reason, occur: v.occur, method: v.method, acct: v.acct, memo: v.memo }); }
  function c10exec(ctx, cs, v) {
    const s = ctx.s, cal = c10calc(cs, v.occur, s.today, s);
    c10save(cs, v);
    if (cs.status === '승인 대기') cs.apprBy = who(ctx);
    Object.assign(cs, { status: '실행 완료', amount: cal.amount, doneAt: '03-08 ' + tick(s), doneBy: who(ctx), snapAt: '03-08', baseDay: v.occur, ruleVer: cal.rule.ver, snap: ['POL-25', 'POL-20', 'POL-14'].map(c => ({ code: c, status: polSt(c) })) });
    cs.log.unshift({ at: cs.doneAt, what: '환불 실행 ' + num(cal.amount) + '원 (' + v.method + ')', by: who(ctx) });
    s.ct09.rows.push({ id: 'c9-r' + (s.ct09.rows.length + 1), center: cs.center || ctx.centerId, date: C9_DAY, time: cs.doneAt.slice(6), student: cs.student || null, name: cs.student ? null : cs.name, kind: '환불', item: cs.item + ' 환불', amount: -cal.amount, method: v.method, approval: '-', cash: '', by: who(ctx), subject: '환불', period: cs.item });
    // 보호자 환불 안내 (학부모에게 나가는 글에는 (안) 표시 없이 숫자만 써요)
    if (s.alim && Array.isArray(s.alim.log)) s.alim.log.push({ at: cs.doneAt, center: cs.center || ctx.centerId, student: cs.student || '', tpl: '', name: '환불 안내', to: '-', text: cs.item + ' ' + num(cal.amount) + '원을 ' + v.method + '로 돌려드렸어요.', status: '발송 완료', src: 'CT-10' });
    ctx.ui.err = {};
    B.toast(num(cal.amount) + '원 환불을 실행했어요. 수납 내역(CT-09)에 -' + num(cal.amount) + '원이 남고, 보호자에게 환불 안내가 갔어요.');
  }
  B.action('CT10.open', (ctx, key) => { if (ctx.s.ct10.cases[key]) { ctx.ui.key = key; c10clear(ctx.ui); } });
  B.action('CT10.method', (ctx, m) => { ctx.ui.f_method = m; });
  B.action('CT10.reset', ctx => { c10clear(ctx.ui); B.toast('입력한 내용을 되돌렸어요.'); });
  B.action('CT10.toCT06', ctx => { const cs = c10case(ctx); if (!cs || !cs.student) return; ctx.s.ui['CT-06'] = Object.assign(ctx.s.ui['CT-06'] || {}, { student: cs.student }); B.go('CT-06'); return false; });
  B.action('CT10.request', (ctx, arg) => {
    if (!ctx.canEdit) return;
    if (arg && typeof arg === 'object') Object.keys(arg).forEach(k => { ctx.ui['f_' + k] = arg[k]; });
    const cs = c10case(ctx); if (!cs || cs.status === '실행 완료') return;
    if (cs.status === '승인 대기') { B.toast('이미 원장 승인을 기다리고 있어요.'); return; }
    const v = c10check(ctx, cs); if (!v) { B.toast('빨간 글씨를 확인해 주세요.'); return; }
    c10save(cs, v); cs.status = '승인 대기'; cs.reqBy = who(ctx); cs.rejBy = ''; cs.rejWhy = '';
    cs.log.unshift({ at: '03-08 ' + tick(ctx.s), what: '환불 요청 ' + num(c10calc(cs, v.occur, ctx.s.today, ctx.s).amount) + '원', by: who(ctx) });
    B.toast('원장에게 환불 승인 요청을 보냈어요.');
  });
  B.action('CT10.register', (ctx, arg, el) => {
    if (!ctx.canEdit) return;
    if (ctx.partial) { B.toast('실장은 환불 요청까지 할 수 있어요.'); return; }
    if (arg && typeof arg === 'object') Object.keys(arg).forEach(k => { ctx.ui['f_' + k] = arg[k]; });
    const cs = c10case(ctx); if (!cs) return;
    if (cs.status === '실행 완료') { B.toast('이미 환불을 실행했어요.'); return; }
    const v = c10check(ctx, cs); if (!v) { B.toast('빨간 글씨를 확인해 주세요.'); return; }
    const cal = c10calc(cs, v.occur, ctx.s.today, ctx.s);
    if (el) {
      B.modal({ title: '환불 등록 · ' + h.mask(cs.name), ok: num(cal.amount) + '원 돌려주기',
        body: h.kv([['반환액', num(cal.amount) + '원 (' + cal.fracTxt + ')'], ['수단', v.method], ['기한', cal.due ? mdS(cal.due) + '까지' : '-'], ['되돌리기', '실행한 뒤에는 취소할 수 없어요']]) + (cs.status === '승인 대기' ? h.alert(cs.reqBy + '이 요청한 환불을 승인하고 실행해요.', 'review') : ''),
        onOk: () => { c10exec(ctx, cs, v); } });
      return false;
    }
    c10exec(ctx, cs, v);
  });
  // 원장이 실장의 요청을 받아들이지 않을 때. 사유를 남기고 계산 단계로 돌려보내요.
  const C10_REJECT = ['사유 발생일을 다시 확인해요', '금액을 다시 계산해요', '보호자와 다시 상담해요'];
  function c10reject(ctx, cs, why) {
    cs.status = '반려'; cs.rejBy = who(ctx); cs.rejWhy = why || C10_REJECT[0];
    cs.log.unshift({ at: '03-08 ' + tick(ctx.s), what: '환불 요청 반려 (' + cs.rejWhy + ')', by: who(ctx) });
    B.toast('환불 요청을 반려했어요. ' + (cs.reqBy || '요청한 사람') + '에게 사유가 가요.');
  }
  B.action('CT10.reject', (ctx, arg, el) => {
    if (!ctx.canEdit || ctx.partial) { B.toast('원장만 반려할 수 있어요.'); return; }
    const cs = c10case(ctx); if (!cs || cs.status !== '승인 대기') { B.toast('승인을 기다리는 요청이 없어요.'); return; }
    const why = typeof arg === 'string' && arg ? arg : arg && typeof arg === 'object' ? arg.why : '';
    if (!why && el) {
      B.modal({ title: '환불 요청 반려 · ' + h.mask(cs.name), ok: '반려',
        body: '<div class="field"><label for="ctc10-rej">사유<span class="req">*</span></label><select class="inp" id="ctc10-rej">' + C10_REJECT.map(x => '<option>' + esc(x) + '</option>').join('') + '</select></div><div class="small muted">반려하면 계산 단계로 돌아가고, 실장이 고쳐서 다시 요청해요.</div>',
        onOk: back => { c10reject(ctx, cs, readModal(back, 'ctc10-rej')); } });
      return false;
    }
    c10reject(ctx, cs, why);
  });

  /* =====================================================================
     CT-11 반·시간표 (p.56)
     ===================================================================== */
  B.extend(s => {
    // 부산해운대(교습소)와 대구수성(가맹) 예시 반. 원생 데이터(s13 b1, s14 d1)가 가리키는 반이에요.
    const add = k => { if (!s.classes.some(x => x.id === k.id)) s.classes.push(k); };
    add({ id: 'b1', center: 'busan', name: 'L2-월수A', level: 'L2', days: '월·수', time: '16:00~17:30', teacher: '최하은', assistant: '김보람', cap: 9, enrolled: 8, room: '1실' });
    add({ id: 'd1', center: 'daegu', name: 'L3-화목A', level: 'L3', days: '화·목', time: '16:00~17:30', teacher: '오세린', assistant: '', cap: 10, enrolled: 9, room: '1실' });
    s.ct11 = { log: [], seq: 1 };
  });
  const C11_DAYS = ['월', '화', '수', '목', '금'];
  const C11_SLOTS = ['14:30~16:00', '16:00~17:30', '17:50~19:20', '19:30~21:00', '21:10~22:40'];
  const C11_DAYSETS = ['월·수', '화·목', '금', '월', '화', '수', '목'];
  const LEGAL = { '원장': '교습자', '실장·데스크': '직원', '교사': '강사', '보조교사': '보조' };
  function teachOk(s, st) {
    if (!st) return { ok: false, why: '교직원 명단에 없음' };
    if (B.staffCanTeach) return B.staffCanTeach(st.id, s);
    if (/퇴사/.test(st.status || '')) return { ok: false, why: '퇴사' };
    if (!st.check) return { ok: false, why: '경력 조회 전' };
    const legal = LEGAL[st.role] || '직원';
    if (legal === '직원') return { ok: false, why: '직원 구분' };
    if ((legal === '강사' || legal === '보조') && (!st.notified || st.notified === '-')) return { ok: false, why: '교육청 통보일 없음' };
    return { ok: true, why: '' };
  }
  const staffOf = (s, cid) => s.staff.filter(x => x.center === cid && !/퇴사/.test(x.status || ''));
  function c11cap(ctx) {
    const c = ctx.center, m = /(\d+)/.exec(String(h.polValue('POL-16', c).value || '')), hq = m ? Number(m[1]) : 15;
    const parts = [['본사 ' + hq + (polSt('POL-16') === '안' ? '(안)' : ''), hq], ['시설 ' + c.facilityCap, c.facilityCap]];
    if (c.facility === '교습소') parts.push(['교습소 9', 9]);
    return { lim: Math.min.apply(null, parts.map(p => p[1])), text: 'min(' + parts.map(p => p[0]).join(', ') + ')' };
  }
  const c11same = (s, cid, days, time, selfId) => s.classes.filter(k => k.center === cid && k.id !== selfId && shareDay(k.days, days) && overlap(k.time, time));
  // 반 설정 초안. 기존 반을 고르면 그 값으로, 새 반이면 빈칸으로 시작해요.
  function c11draft(ctx) {
    const s = ctx.s, ui = ctx.ui, cid = ctx.centerId;
    const list = s.classes.filter(k => k.center === cid);
    if (ui.mode !== 'new' && (!ui.sel || !list.some(k => k.id === ui.sel))) ui.sel = (list.find(k => k.id === 'c2') || list[0] || {}).id;
    const k = ui.mode === 'new' ? null : list.find(x => x.id === ui.sel);
    const key = ui.mode === 'new' ? 'new' : (k ? k.id : '');
    if (ui.dkey !== key) {
      ui.dkey = key; ui.k_err = null;
      if (k) Object.assign(ui, { k_level: k.level, k_days: k.days, k_time: k.time, k_room: k.room, k_teacher: k.teacher, k_asst: k.assistant || '', k_cap: String(k.cap) });
      else Object.assign(ui, { k_level: ui.k_level || 'L2', k_days: ui.k_days || '월·수', k_time: ui.k_time || '16:00~17:30', k_room: '', k_teacher: '', k_asst: '', k_cap: '' });
    }
    return { k, d: { level: ui.k_level, days: ui.k_days, time: ui.k_time, room: ui.k_room, teacher: ui.k_teacher, asst: ui.k_asst, cap: ui.k_cap } };
  }
  function c11check(ctx, k, d) {
    const s = ctx.s, c = ctx.center, e = [], cap = Number(d.capOverride != null ? d.capOverride : d.cap), lim = c11cap(ctx).lim;
    if (!(cap > 0)) e.push('정원을 넣어 주세요.');
    else if (cap > lim) e.push('정원은 상한 ' + lim + '명을 넘을 수 없어요.');
    if (k && cap < k.enrolled) e.push('지금 ' + k.enrolled + '명이 다녀서 정원을 그보다 낮출 수 없어요.');
    if (toMin(span(d.time)[1]) > toMin(c.curfew)) e.push('교습시간 상한 ' + c.curfew + '을 넘는 타임은 저장할 수 없어요.');
    if (!d.room) e.push('강의실을 골라 주세요.');
    const same = c11same(s, c.id, d.days, d.time, k ? k.id : null);
    const sum = same.reduce((a, x) => a + x.cap, 0) + (cap || 0);
    if (cap > 0 && sum > c.facilityCap) e.push('같은 시간대 반 정원을 합치면 ' + sum + '명이라 일시수용능력 ' + c.facilityCap + '명을 넘어요. 정원을 ' + Math.max(0, c.facilityCap - (sum - cap)) + '명 이하로 하거나 다른 타임을 골라 주세요.');
    const room = same.find(x => x.room === d.room); if (d.room && room) e.push(d.room + '은 같은 시간에 ' + room.name + ' 반이 써요.');
    if (!d.teacher) e.push('교사를 골라 주세요.');
    [['교사', d.teacher], ['보조', d.asst]].forEach(([role, nm]) => {
      if (!nm) return;
      const t = teachOk(s, staffOf(s, c.id).find(x => x.name === nm));
      if (!t.ok) e.push(nm + ' 선생님은 ' + t.why + ' 상태라 ' + role + '로 넣을 수 없어요.');
      const busy = same.find(x => x.teacher === nm || x.assistant === nm); if (busy) e.push(nm + ' 선생님은 같은 시간에 ' + busy.name + ' 반을 맡고 있어요.');
    });
    if (d.asst && d.asst === d.teacher) e.push('교사와 보조를 같은 사람으로 넣을 수 없어요.');
    return e;
  }
  function c11assignCands(ctx) {
    const s = ctx.s, ui = ctx.ui, st = s.students.find(x => x.id === ui.assign && x.center === ctx.centerId);
    if (!st) return null;
    const c = ctx.center;
    const list = s.classes.filter(k => k.center === ctx.centerId).map(k => {
      const sameN = c11same(s, c.id, k.days, k.time, k.id).reduce((a, x) => a + x.enrolled, 0) + k.enrolled;
      const why = k.enrolled >= k.cap ? '정원 마감' : sameN + 1 > c.facilityCap ? '같은 시간대 ' + c.facilityCap + '명 초과' : '';
      return { k, why, lv: k.level === st.level };
    }).sort((a, b) => (b.lv - a.lv) || ((b.k.cap - b.k.enrolled) - (a.k.cap - a.k.enrolled)));
    return { st, list };
  }
  // 배정할 반: 직접 고른 반, CT-07에서 고른 반, 같은 레벨에서 자리가 있는 반 순서로 정해요.
  function c11want(ctx, A) {
    const ui = ctx.ui, all = ctx.s.classes.filter(k => k.center === ctx.centerId);
    return ui.aCls || (ui.cls && all.some(x => x.id === ui.cls) ? ui.cls : '') || ((A.list.find(o => o.lv && !o.why) || A.list.find(o => !o.why) || {}).k || {}).id || '';
  }

  B.screen({
    id: 'CT-11', side: 'ct', phase: 'P1a', devices: ['pc', 'tablet'], pages: [56],
    title: '반·시간표', menuLabel: '반·시간표', crumb: '운영 > 반·시간표',
    headActions: ctx => h.btn('+ 반 만들기', { primary: true, act: 'CT11.new', disabled: !ctx.canEdit }),
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, c = ctx.center, ro = !ctx.canEdit;
      const all = s.classes.filter(k => k.center === ctx.centerId);
      const { k, d } = c11draft(ctx);
      let html = '';
      // 검토 반영: 수납 뒤 넘어온 원생 반 배정
      const A = c11assignCands(ctx);
      if (!A && ui.assignShow) html += h.card({ title: '반 배정을 기다리는 원생', pin: 8, right: h.btn('닫기', { sm: true, act: 'CT11.assignLater' }), body: '<div class="small muted">지금 반 배정을 기다리는 원생이 없어요. 수강 등록·수납(CT-07)에서 수납을 마치면 여기로 넘어와요.</div>' }) + '<div style="height:12px"></div>';
      if (A) {
        const want = c11want(ctx, A);
        const wk = all.find(x => x.id === ui.cls);
        html += h.card({
          title: '반 배정을 기다리는 원생', sub: '수강 등록·수납에서 넘어왔어요', pin: 8, cls: '',
          right: h.btn('나중에', { sm: true, act: 'CT11.assignLater' }),
          body: '<div class="row" style="margin-bottom:8px"><b>' + esc(h.mask(A.st.name)) + '</b><span class="small">' + esc(A.st.grade + ' · 레벨 ' + A.st.level) + '</span>' + h.chip(A.st.status, A.st.status === '재원' ? 'ok' : 'info') +
            (wk ? '<span class="small muted">수납할 때 고른 반 ' + esc(wk.name) + '</span>' : '') + '</div>' +
            h.opts(A.list.map(o => ({ v: o.k.id, l: o.k.name + ' ' + o.k.enrolled + '/' + o.k.cap + (o.why ? ' ' + o.why : '') + (o.lv ? '' : ' (레벨 ' + o.k.level + ')'), dis: !!o.why })), want, { act: 'CT11.assignPick' }) +
            '<div class="row" style="margin-top:10px">' + h.btn('이 반에 넣기', { primary: true, act: 'CT11.assign', arg: want || '', disabled: ro || !want }) + '<span class="small muted">정원과 같은 시간대 합계를 다시 검사한 뒤 넣어요. 넣으면 출결 명단(CT-12)에 바로 보여요.</span></div>',
        }) + '<div style="height:12px"></div>';
      }
      html += '<div class="grid g-side">';
      // 왼쪽: 주간 시간표
      const tf = ui.f_teacher || '';
      const shown = all.filter(x => !tf || x.teacher === tf || x.assistant === tf);
      const slots = C11_SLOTS.slice(); all.forEach(x => { if (!slots.includes(x.time)) slots.push(x.time); });
      slots.sort((a, b) => toMin(span(a)[0]) - toMin(span(b)[0]));
      let tt = '<div class="ctc-tt"><div class="hd">타임</div>' + C11_DAYS.map(w => '<div class="hd">' + w + '</div>').join('');
      slots.forEach(t => {
        const over = toMin(span(t)[1]) > toMin(c.curfew);
        tt += '<div class="tm">' + esc(t) + '</div>';
        C11_DAYS.forEach((w, i) => {
          if (over) { tt += '<div class="over">' + (i === 0 ? '교습시간 상한 초과' : '') + '</div>'; return; }
          const here = shown.filter(x => x.time === t && dayList(x.days).includes(w));
          const draftHere = ui.mode === 'new' && d.time === t && dayList(d.days).includes(w);
          tt += '<div class="cell"' + (here.length || ro ? '' : ' data-act="CT11.new" data-arg="' + esc(w + '|' + t) + '" title="이 타임에 반 만들기"') + '>' +
            here.map(x => '<button type="button" class="ctc-slot' + (x.enrolled >= x.cap ? ' full' : '') + (ui.mode !== 'new' && x.id === ui.sel ? ' on' : '') + '" data-act="CT11.select" data-arg="' + esc(x.id) + '"><b>' + esc(x.name) + '</b>' + x.enrolled + '/' + x.cap + ' · ' + esc(x.teacher) + '</button>').join('') +
            (draftHere ? '<span class="ctc-slot draft"><b>새 반</b>정원 ' + esc(d.cap || '-') + '</span>' : '') + '</div>';
        });
      });
      tt += '</div>';
      const teachers = Array.from(new Set(all.map(x => x.teacher)));
      html += '<div class="stack"><div class="ctc-bar" data-pin="1">' + sel({ f: 'f_month', v: '2027-03', opts: [{ v: '2027-03', l: '2027년 3월' }], label: '달' }) +
        sel({ f: 'f_teacher', v: tf, live: true, label: '교사', opts: [{ v: '', l: '교사 전체' }].concat(teachers) }) +
        '<span class="small muted">회당 90분, 하루 2타임 운영 안 ' + h.polChip('POL-10') + ' · 빈칸을 누르면 그 타임에 반을 만들어요</span></div>' + tt + '</div>';
      // 오른쪽: 반 설정
      const capInfo = c11cap(ctx);
      const staff = staffOf(s, ctx.centerId);
      const opt = (cur, allowNone) => (allowNone ? [{ v: '', l: '없음' }] : [{ v: '', l: '고르세요' }]).concat(staff.map(x => { const t = teachOk(s, x); return { v: x.name, l: x.name + ' (' + x.role + ')' + (t.ok ? '' : ' ' + t.why), dis: !t.ok && x.name !== cur }; }));
      const same = c11same(s, ctx.centerId, d.days, d.time, k ? k.id : null);
      const capN = Number(d.cap) || 0, sum = same.reduce((a, x) => a + x.cap, 0) + capN;
      const noTeach = staff.filter(x => !teachOk(s, x).ok);
      const curT = [d.teacher, d.asst].filter(Boolean).map(nm => ({ nm, t: teachOk(s, staff.find(x => x.name === nm)) })).filter(o => !o.t.ok);
      const errs = ui.k_err || [];
      html += h.card({
        title: ui.mode === 'new' ? '새 반 만들기' : '반 설정 · ' + (k ? k.name : '-'), pin: 2,
        right: ui.mode === 'new' ? h.btn('닫기', { sm: true, act: 'CT11.closeNew' }) : '',
        body: '<div class="ctc-form">' +
          '<label>레벨</label>' + sel({ f: 'k_level', v: d.level, opts: ['L1', 'L2', 'L3'], dis: ro, label: '레벨', w: '100%' }) +
          '<label>요일·타임</label>' + (ui.mode === 'new'
            ? '<div class="row" style="gap:4px;flex-wrap:nowrap">' + sel({ f: 'k_days', v: d.days, opts: C11_DAYSETS, live: true, dis: ro, label: '요일', w: '50%' }) + sel({ f: 'k_time', v: d.time, opts: C11_SLOTS, live: true, dis: ro, label: '타임', w: '50%' }) + '</div>'
            : '<span>' + esc(d.days + ' ' + d.time) + '</span>') +
          '<label>강의실</label>' + sel({ f: 'k_room', v: d.room, opts: [{ v: '', l: '고르세요' }].concat(Array.from({ length: c.rooms || 1 }, (x, i) => (i + 1) + '실')), live: true, dis: ro, label: '강의실', w: '100%' }) +
          '<label>교사</label><div class="stack" style="gap:4px">' + sel({ f: 'k_teacher', v: d.teacher, opts: opt(d.teacher), dis: ro, label: '교사', w: '100%' }) + sel({ f: 'k_asst', v: d.asst, opts: opt(d.asst, true), dis: ro, label: '보조', w: '100%' }) + '</div>' +
          '<label>정원</label><div><div class="row" style="gap:6px;flex-wrap:nowrap">' + inp({ f: 'k_cap', v: d.cap, type: 'number', live: true, dis: ro, label: '정원', w: '70px' }) + varChip() + '</div><div class="small muted">상한 ' + capInfo.lim + ' = ' + esc(capInfo.text) + '</div></div>' +
          '<label>현재</label><span>' + (k ? k.enrolled + '명 · 대기 0' : '새 반이에요') + '</span></div>' +
          '<div class="small" data-pin="3" style="margin-top:10px;padding:4px 0 0 16px">' + (k && k.enrolled >= 15 && !d.asst ? h.chip('보조 권장', 'warn') + ' ' : '') + '학생 15명 이상이면 보조 교사 배치를 권해요 ' + h.polChip('POL-16') + '</div>' +
          '<div class="ctc-box review" data-pin="6" style="margin-top:8px"><b>같은 시간대 합계</b>' +
          '<div class="ctc-meter"><span>' + esc(d.days + ' ' + d.time) + '</span><span class="bar">' + h.bar(sum / c.facilityCap * 100, { color: sum > c.facilityCap ? 'var(--bad)' : '' }) + '</span><b>' + sum + ' / ' + c.facilityCap + '</b></div>' +
          '<div class="small">' + (same.length ? '함께 열리는 반 ' + same.map(x => x.name + ' 정원 ' + x.cap + ' (' + x.room + ')').join(', ') : '이 타임에 함께 열리는 반이 없어요') + '. 정원을 다 채워도 일시수용능력을 넘지 않게 정원 합계로 검사해요.</div></div>' +
          '<div class="ctc-box review" data-pin="7" style="margin-top:8px"><b>경력 조회를 마친 교직원만 배치해요</b>' +
          '<div class="small">' + (noTeach.length ? '고를 수 없는 사람 ' + noTeach.map(x => x.name + ' (' + teachOk(s, x).why + ')').join(', ') + '. ' : '') + '조회일과 교육청 통보일은 교직원 계정(CT-20)에서 넣어요.</div>' +
          (curT.length ? '<div class="small" style="color:var(--bad);font-weight:600">지금 배치된 ' + curT.map(o => o.nm + ' 선생님은 ' + o.t.why).join(', ') + ' 상태라 바꿔야 저장돼요.</div>' : '') + '</div>' +
          (errs.length ? '<div class="ctc-errs">' + errs.map(x => '<div>' + esc(x) + '</div>').join('') + '</div>' : '') +
          '<div class="row" style="margin-top:10px;justify-content:flex-end">' + h.btn(ui.mode === 'new' ? '반 만들기' : '저장', { primary: true, act: 'CT11.save', disabled: ro }) + '</div>',
      });
      html += '</div>';
      // 아래: 교습시간 검사, 교습소 센터, 대기자
      const lateSlot = slots.find(t => toMin(span(t)[1]) > toMin(c.curfew));
      html += '<div class="grid g2" style="margin-top:12px">';
      html += h.card({ title: '교습시간 검사', pin: 4, body: '<div>교습시간 상한 <b>' + esc(c.curfew) + '</b> ' + varChip() + ' (' + esc(c.region.split(' ')[0]) + ' 조례 값) ' + h.polChip('POL-17') + '</div><div class="small muted" style="margin-top:4px">' + (lateSlot ? esc(span(lateSlot)[0]) + ' 타임은 ' + esc(span(lateSlot)[1]) + '에 끝나서 저장할 수 없어요.' : '상한을 넘는 타임이 없어요.') + '</div>' });
      const tutor = c.facility === '교습소';
      html += h.card({ title: '교습소 센터', pin: 5, body: '<div>정원 상한 9명, 교습자 1명, 보조요원 1명</div><div class="small ' + (tutor ? '' : 'muted') + '" style="margin-top:4px">' + (tutor ? h.chip('적용 중', 'warn') + ' 이 센터는 교습소라 정원과 교직원 수가 자동으로 제한돼요.' : '이 센터는 학원이라 해당 없어요.') + ' ' + h.polChip('POL-15') + '</div>' });
      html += '</div>';
      html += '<div style="margin-top:12px">' + h.card({ title: '대기자', right: h.chip('P2', 'p2'), body: '<div class="small muted">정원이 찬 반의 대기자 명단과 자리 생김 알림은 확대 단계 화면(CT-22)에서 해요.</div>' }) + '</div>';
      return html;
    },
    mount(root, ctx) { live(root, ctx); },
    prd: {
      summary: '요일과 시간마다 어떤 반이 몇 명인지 보고, 반을 만들고 정원과 선생님을 정해요. 정원과 수업이 끝나는 시각은 법이 정한 선을 넘지 않게 자동으로 막아요.',
      who: '원장과 실장·데스크가 고쳐요. 교사와 보조교사는 보기만 해요.',
      items: [
        { n: 1, t: '주간 시간표', d: '타임마다 반과 정원 대비 인원을 봐요. 회당 90분, 하루 2타임 운영 안(10/21)을 기본 틀로 써요. 빈칸을 누르면 그 타임에 새 반을 만들어요.', pol: ['POL-10'], ref: 'p.56 ①' },
        { n: 2, t: '반 설정', d: '반을 누르면 오른쪽에서 레벨, 강의실, 교사, 정원을 바꿔요. 정원은 본사 기준, 시설 수용능력, 교습소 9명 가운데 가장 작은 값 안에서만 정해요. 지금 다니는 인원보다 낮출 수는 없어요.', pol: ['POL-15', 'POL-16'], ref: 'p.56 ②' },
        { n: 3, t: '교사 배치', d: '교사 1인당 학생 수 기준을 넘으면 보조 교사를 두라고 알려요. 화면은 15명 이상, 회의 안은 20명이라 숫자가 아직 엇갈려요.', pol: ['POL-16'], ref: 'p.56 ③' },
        { n: 4, t: '교습시간 상한', d: '지역 조례의 교습 종료 시각(서울 22:00, 법정)을 넘는 타임은 저장할 수 없어요. 시간표에서도 그 타임은 회색으로 막혀 있어요.', pol: ['POL-17'], ref: 'p.56 ④' },
        { n: 5, t: '교습소 제한', d: '교습소 센터는 동시 9명, 교습자 1명, 보조요원 1명 제한이 자동으로 걸려요(법정). 부산해운대센터로 바꿔 보면 상한이 9명으로 바뀌어요.', pol: ['POL-15'], ref: 'p.56 ⑤' },
        { n: 6, t: '같은 시간대 합계 검사', kind: 'review', imp: 'IMP-15', pol: ['POL-15', 'POL-16'], d: '같은 시간에 반이 여러 개 열리면 정원을 합쳐서 일시수용능력(대치1 24명, 예시)을 넘는지 봐요. 넘으면 저장을 막아요. 같은 강의실이나 같은 교사가 겹쳐도 막아요.' },
        { n: 7, t: '경력 조회 전 배치 금지', kind: 'review', imp: 'IMP-16', d: '성범죄와 아동학대 경력 조회를 마친 교직원만 교사와 보조로 고를 수 있어요. 강사와 보조는 교육청 통보일도 있어야 하고, 실장처럼 직원으로 등록된 사람은 수업에 넣지 않아요.' },
        { n: 8, t: '수납 뒤 반 배정 확정', kind: 'review', imp: 'IMP-18', cond: true, reveal: 'CT11.assignStart', d: '반은 수강 등록·수납(CT-07)에서 골라요. 수납을 마친 원생이 그 반을 고른 채로 여기로 넘어와서 흐름이 끊기지 않아요. 넣기 전에 정원과 같은 시간대 합계를 다시 검사하고, 고른 반이 없으면 같은 레벨 반을 먼저 보여 줘요. 넣으면 출결 명단에 바로 들어가요.' },
      ],
      open: ['학원과 교습소 중 무엇으로 할지, 지금은 학원 안 (POL-15)', '타임당 정원과 교사 1인당 학생 수, 정원 15명 안 (POL-16)', '회당 90분, 하루 2타임 운영을 확정할지 (POL-10)', '대치1 수용능력이 24명인지 30명인지', 'P2 전까지 꽉 찬 반의 대기 학생을 어떻게 받을지 (CT-22는 P2)'],
      rules: ['교습 종료 시각은 시·도 조례를 따라요 (서울 22:00, 법정).', '교습소는 동시 9명, 교습자 1명, 보조요원 1명까지예요 (법정).', '경력 조회를 하지 않은 사람은 수업에 넣지 않아요 (법정, 조회 시점은 법무 확인 중).'],
    },
  });

  B.action('CT11.select', (ctx, id) => { ctx.ui.mode = ''; ctx.ui.sel = id; });
  B.action('CT11.teacher', (ctx, v) => { ctx.ui.f_teacher = v || ''; });
  B.action('CT11.new', (ctx, arg) => {
    if (!ctx.canEdit) return;
    const ui = ctx.ui; ui.mode = 'new'; ui.dkey = null; ui.k_level = null; ui.k_days = null; ui.k_time = null;
    if (typeof arg === 'string' && arg.indexOf('|') > 0) { const p = arg.split('|'); ui.k_days = p[0] === '월' || p[0] === '수' ? '월·수' : p[0] === '화' || p[0] === '목' ? '화·목' : p[0]; ui.k_time = p[1]; }
    else if (arg && typeof arg === 'object') { ui.k_days = arg.days || null; ui.k_time = arg.time || null; ui.k_level = arg.level || null; }
    c11draft(ctx);
  });
  B.action('CT11.closeNew', ctx => { ctx.ui.mode = ''; ctx.ui.dkey = null; });
  B.action('CT11.save', (ctx, arg) => {
    if (!ctx.canEdit) return;
    const s = ctx.s, ui = ctx.ui;
    if (arg && typeof arg === 'object') { if (arg.sel) { ui.mode = ''; ui.sel = arg.sel; } c11draft(ctx); ['level', 'days', 'time', 'room', 'teacher', 'asst', 'cap'].forEach(f => { if (arg[f] != null) ui['k_' + f] = String(arg[f]); }); }
    else h.readFields(ui);
    const { k, d } = c11draft(ctx);
    const e = ui.k_err = c11check(ctx, k, d);
    if (e.length) { B.toast('저장할 수 없어요. 빨간 글씨를 확인해 주세요.'); return; }
    const cap = Number(d.cap);
    if (k) {
      Object.assign(k, { level: d.level, room: d.room, teacher: d.teacher, assistant: d.asst || '', cap });
      s.ct11.log.unshift({ at: '03-08', what: k.name + ' 반 설정 저장 (정원 ' + cap + ', 교사 ' + d.teacher + (d.asst ? ', 보조 ' + d.asst : '') + ')', by: who(ctx) });
      B.toast(k.name + ' 반 설정을 저장했어요.');
    } else {
      const base = d.level + '-' + d.days.replace(/·/g, '');
      let L = 'A'; while (s.classes.some(x => x.center === ctx.centerId && x.name === base + L)) L = String.fromCharCode(L.charCodeAt(0) + 1);
      const id = 'cn' + (s.ct11.seq++);
      s.classes.push({ id, center: ctx.centerId, name: base + L, level: d.level, days: d.days, time: d.time, teacher: d.teacher, assistant: d.asst || '', cap, enrolled: 0, room: d.room });
      ui.mode = ''; ui.sel = id; ui.dkey = null;
      s.ct11.log.unshift({ at: '03-08', what: base + L + ' 반 만들기', by: who(ctx) });
      B.toast(base + L + ' 반을 만들었어요. 수강 등록에서 고를 수 있어요.');
    }
    ui.k_err = null;
  });
  B.action('CT11.assignStart', (ctx, sid) => {
    const s = ctx.s, ui = ctx.ui;
    const st = s.students.find(x => x.id === sid && x.center === ctx.centerId) || s.students.find(x => x.center === ctx.centerId && !x.cls && ['재원', '수납 대기', '대기'].includes(x.status));
    if (st) { ui.assign = st.id; ui.aCls = null; }
    ui.assignShow = true;
  });
  B.action('CT11.assignPick', (ctx, id) => { ctx.ui.aCls = id; });
  B.action('CT11.assignLater', ctx => { const had = !!ctx.ui.assign; ctx.ui.assign = null; ctx.ui.aCls = null; ctx.ui.assignShow = false; if (had) B.toast('반 배정을 미뤘어요. 원생 상세(CT-06)에서 다시 할 수 있어요.'); });
  B.action('CT11.assign', (ctx, arg) => {
    if (!ctx.canEdit) return;
    const s = ctx.s, ui = ctx.ui, c = ctx.center;
    let sid = ui.assign, kid = '';
    if (arg && typeof arg === 'object') { sid = arg.student || sid; kid = arg.cls || ''; } else if (arg) kid = arg;
    if (!kid && sid) { const A = c11assignCands(Object.assign({}, ctx, { ui: Object.assign({}, ui, { assign: sid }) })); if (A) kid = c11want(ctx, A); }
    const st = s.students.find(x => x.id === sid), k = s.classes.find(x => x.id === kid && x.center === ctx.centerId);
    if (!st || !k) { B.toast('넣을 원생과 반을 골라 주세요.'); return; }
    if (k.enrolled >= k.cap) { B.toast(k.name + ' 반은 정원(' + k.cap + '명)이 찼어요.'); return; }
    const sameN = c11same(s, c.id, k.days, k.time, k.id).reduce((a, x) => a + x.enrolled, 0) + k.enrolled;
    if (sameN + 1 > c.facilityCap) { B.toast('같은 시간대 인원이 일시수용능력 ' + c.facilityCap + '명을 넘어서 넣을 수 없어요.'); return; }
    const from = s.classes.find(x => x.id === st.cls); if (from) from.enrolled = Math.max(0, from.enrolled - 1);
    st.cls = k.id; k.enrolled += 1;
    s.ct11.log.unshift({ at: '03-08', what: h.mask(st.name) + ' ' + k.name + ' 반 배정', by: who(ctx) });
    ui.assign = null; ui.aCls = null; ui.cls = null; ui.mode = ''; ui.sel = k.id; ui.assignShow = false;
    B.toast(h.mask(st.name) + ' 학생을 ' + k.name + ' 반에 넣었어요. 출결 명단에 바로 보여요.');
  });

  /* =====================================================================
     CT-12 출결·보강 (p.57)
     ===================================================================== */
  B.extend(s => {
    const T = s.today;
    s.ct12 = {
      now: '18:05', clock: '18:05',
      // 원생 데이터에 없는 같은 반 친구들 (원문 예시 상태를 보여 주려는 예시)
      roster: [
        { id: 'x1', center: 'daechi1', name: '김현수', cls: 'c1', level: 'L1' },
        { id: 'x2', center: 'daechi1', name: '최다윤', cls: 'c2', level: 'L2' },
        { id: 'x3', center: 'daechi1', name: '이하린', cls: 'c2', level: 'L2' },
      ],
      att: [
        { id: 'c12a1', center: 'daechi1', date: T, student: 'x1', cls: 'c1', in: '15:56', out: '17:34', device: '#1 입구 패드', alimIn: '발송 완료', alimOut: '발송 완료', appLogout: '완료', sync: '전송', src: '키오스크' },
        { id: 'c12a2', center: 'daechi1', date: T, student: 'x3', cls: 'c2', in: '17:48', out: '', device: '#1 입구 패드', alimIn: '발송 완료', alimOut: '', appLogout: '', sync: '전송', src: '키오스크' },
      ],
      // 키오스크(KS-01) 기록 s.attendance가 없는 빌드에서만 쓰는 자체 예시
      fallback: [
        { id: 'c12f1', center: 'daechi1', date: T, student: 's2', cls: 'c1', in: '15:55', out: '', device: '#1 입구 패드', alimIn: '발송 완료', alimOut: '', appLogout: '', sync: '전송', src: '키오스크' },
        { id: 'c12f2', center: 'daechi1', date: T, student: 's8', cls: 'c1', in: '15:58', out: '', device: '#1 입구 패드', alimIn: '발송 완료', alimOut: '', appLogout: '', sync: '대기', src: '키오스크' },
      ],
      edits: [], makeups: [], notified: {},
    };
  });
  const C12_ABS = 10, C12_NOOUT = 20; // 판정 기준 (분, 예시)
  const c12recs = s => (Array.isArray(s.attendance) ? s.attendance : s.ct12.fallback).concat(s.ct12.att);
  // 화면 기준 시각. 키오스크(KS-01)에서 더 늦은 시각에 찍은 기록이 있으면 그 시각까지 앞으로 옮겨요.
  function c12now(s) {
    let m = toMin(s.ct12.now);
    c12recs(s).filter(a => a.date === s.today).forEach(a => [a.in, a.out].forEach(v => { if (okTime(v)) m = Math.max(m, toMin(v)); }));
    return fromMin(m);
  }
  function c12status(s, k, rec) {
    const now = toMin(c12now(s)), t = k ? span(k.time).map(toMin) : [0, 0];
    if (rec && rec.status === '결석') return '결석';
    if (rec && rec.in && rec.out) return '퇴실';
    if (rec && rec.in) return k && now > t[1] + C12_NOOUT ? '미퇴실' : '수업 중';
    if (k && now > t[0] + C12_ABS) return '결석';
    return '예정';
  }
  function c12rows(ctx) {
    const s = ctx.s, cid = ctx.centerId, today = s.today, w = dow(today);
    const recs = c12recs(s).filter(a => a.center === cid && a.date === today);
    const people = [];
    s.classes.filter(k => k.center === cid && dayList(k.days).includes(w)).sort((a, b) => toMin(span(a.time)[0]) - toMin(span(b.time)[0])).forEach(k => {
      s.students.filter(st => st.center === cid && st.cls === k.id && !/휴원|퇴원$/.test(st.status) && st.status !== '상담').forEach(st => people.push({ id: st.id, name: st.name, level: st.level, k, st }));
      s.ct12.roster.filter(x => x.center === cid && x.cls === k.id).forEach(x => people.push({ id: x.id, name: x.name, level: x.level, k }));
    });
    recs.forEach(a => { if (!people.some(p => p.id === a.student)) { const st = s.students.find(x => x.id === a.student); const k = s.classes.find(x => x.id === (a.cls || (st || {}).cls)); people.push({ id: a.student, name: st ? st.name : a.student, level: st ? st.level : '', k, st }); } });
    return people.map(p => { const rec = recs.find(a => a.student === p.id); return Object.assign(p, { rec, status: c12status(s, p.k, rec), mk: s.ct12.makeups.find(m => m.student === p.id && m.from === today) }); });
  }
  const C12_TONE = { '퇴실': 'ok', '수업 중': 'info', '미퇴실': 'warn', '결석': 'bad', '예정': '' };
  function c12alim(s, p) {
    const r = p.rec;
    if (!r) return s.ct12.notified[p.id] ? '미등원 알림 발송' : '-';
    const f = v => v === '발송 완료';
    if (r.alimOut === '직원 확인 퇴실 발송') return '입실 발송, 직원 확인 퇴실 발송';
    if (f(r.alimIn) && f(r.alimOut)) return '입·퇴실 발송';
    if (f(r.alimIn)) return '입실 발송';
    if (r.alimIn === '대기') return '발송 대기';
    if (r.alimIn === '꺼짐') return '자동 발송 꺼짐';
    return '-';
  }
  function c12mkOpts(ctx, p) {
    const s = ctx.s, c = ctx.center, own = p.k, lv = p.level || (own || {}).level, out = [], hm = holMap(s, ctx.centerId);
    for (let i = 1; i <= 14; i++) {
      const d = addDays(s.today, i), w = dow(d); if (hm[d]) continue;
      s.classes.filter(k => k.center === ctx.centerId && k.level === lv && dayList(k.days).includes(w)).forEach(k => {
        if (own && (k.id === own.id || (dayList(own.days).includes(w) && overlap(own.time, k.time)))) return;
        const booked = s.ct12.makeups.filter(m => m.date === d && m.cls === k.id).length, free = k.cap - k.enrolled - booked;
        const sameN = s.classes.filter(x => x.center === ctx.centerId && dayList(x.days).includes(w) && overlap(x.time, k.time)).reduce((a, x) => a + x.enrolled, 0) + s.ct12.makeups.filter(m => m.date === d && overlap(m.time, k.time)).length;
        out.push({ v: d + '|' + k.id, l: mdS(d) + ' (' + w + ') ' + span(k.time)[0] + ' ' + k.name + (free > 0 ? ' · ' + free + '자리' : ' · 자리 없음'), dis: free <= 0 || sameN + 1 > c.facilityCap });
      });
    }
    return out;
  }
  function c12devices(ctx) {
    const s = ctx.s, d = s.ct19 && s.ct19.centers && s.ct19.centers[ctx.centerId];
    if (d && Array.isArray(d.devices)) return d.devices.map(x => ({ name: x.name, use: x.use, st: '정상' }));
    return [{ name: '#1 입구 패드', use: '입·퇴실', st: '정상' }, { name: '#2 검사용 패드', use: '입학 테스트', st: '정상' }];
  }

  B.screen({
    id: 'CT-12', side: 'ct', phase: 'P1a', devices: ['pc', 'tablet'], pages: [57],
    title: '출결·보강', menuLabel: '출결·보강', crumb: '운영 > 출결·보강',
    headActions: () => h.btn('엑셀', { act: 'CT12.excel' }),
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, c = ctx.center, ro = !ctx.canEdit;
      const rows = c12rows(ctx);
      const times = Array.from(new Set(rows.filter(p => p.k).map(p => p.k.time)));
      const list = rows.filter(p => (!ui.f_time || (p.k && p.k.time === ui.f_time)) && (!ui.f_st || p.status === ui.f_st));
      let html = '<div class="ctc-bar" data-pin="1">' + sel({ f: 'f_date', v: s.today, opts: [{ v: s.today, l: '오늘 ' + mdS(s.today) + ' (' + dow(s.today) + ')' }], label: '날짜' }) +
        sel({ f: 'f_time', v: ui.f_time || '', live: true, label: '타임', opts: [{ v: '', l: '타임 전체' }].concat(times) }) +
        sel({ f: 'f_st', v: ui.f_st || '', live: true, label: '상태', opts: [{ v: '', l: '상태 전체' }, '수업 중', '퇴실', '미퇴실', '결석', '예정'] }) +
        '<span class="small muted">' + esc(c12now(s)) + ' 기준 (예시) · 공용 패드는 퇴실 체크 때 학습 앱에서 자동 로그아웃해요 ' + h.polChip('POL-39') + '</span></div>';
      html += h.alert('수업 시작 ' + C12_ABS + '분 뒤까지 입실이 없으면 결석, 끝나고 ' + C12_NOOUT + '분 뒤까지 퇴실이 없으면 미퇴실로 봐요 (예시). 결석이면 보호자에게 미등원 알림을 보낼 수 있어요.', 'review', { title: '검토 반영', pin: 6 });
      html += '<div style="margin-top:10px">' + h.table({
        cols: [
          { label: '원생', render: p => esc(h.mask(p.name)) + (p.rec && p.rec.manual ? ' ' + h.chip('수동 수정') : '') },
          { label: '반', render: p => esc(p.k ? p.k.name : '-') },
          { label: '입실', render: p => '<span class="mono small">' + esc((p.rec && p.rec.in) || '-') + '</span>' },
          { label: '퇴실', render: p => '<span class="mono small">' + esc((p.rec && p.rec.out) || '-') + '</span>' },
          { label: '상태', render: p => h.chip(p.status, C12_TONE[p.status]) },
          { label: '알림톡', render: p => '<span class="small">' + esc(c12alim(s, p)) + '</span>' },
          { label: '패드 기록', render: p => p.rec ? (p.rec.sync === '대기' ? h.chip('전송 대기', 'warn') : '<span class="small">전송</span>') + (p.rec.out ? '<div class="sm2">앱 로그아웃 ' + esc(p.rec.appLogout || '-') + '</div>' : '') : '-' },
          { label: '조치', render: p => {
            if (p.status === '미퇴실') return h.btn('퇴실 처리', { sm: true, act: 'CT12.pickFix', arg: p.id, disabled: ro });
            if (p.status === '결석') return '<div class="ctc-acts">' + (p.mk ? h.chip('보강 ' + mdS(p.mk.date) + ' ' + p.mk.time.split('~')[0], 'ok') : h.btn('보강 잡기', { sm: true, act: 'CT12.pickMk', arg: p.id, disabled: ro })) +
              (s.ct12.notified[p.id] ? '' : h.btn('미등원 알림', { sm: true, act: 'CT12.notify', arg: p.id, disabled: ro })) + h.btn('입실 고치기', { sm: true, ghost: true, act: 'CT12.pickFix', arg: p.id, disabled: ro }) + '</div>';
            return '-';
          } },
        ],
        rows: list,
        rowAttr: p => (ui.fix === p.id || ui.mk === p.id) ? ' class="sel"' : '',
        empty: '오늘 이 조건의 출결이 없어요.',
      }) + '</div>';
      const recs = rows.filter(p => p.rec), waitSync = recs.filter(p => p.rec.sync === '대기').length, waitOut = recs.filter(p => p.rec.out && p.rec.appLogout && p.rec.appLogout !== '완료').length;
      html += '<div class="grid g2" style="margin-top:10px">' +
        '<div class="ctc-box" data-pin="2"><div class="row" style="gap:8px"><b>알림톡 자동 발송</b><span class="row" style="gap:4px">입실 ' + h.toggle(s.alim.auto['입실'], { act: ro ? null : 'CT12.auto', arg: '입실', title: '입실 알림 켜고 끄기' }) + '</span><span class="row" style="gap:4px">퇴실 ' + h.toggle(s.alim.auto['퇴실'], { act: ro ? null : 'CT12.auto', arg: '퇴실', title: '퇴실 알림 켜고 끄기' }) + '</span>' + h.polChip('POL-35') + '</div>' +
        '<div class="small">입실과 퇴실 때 보호자에게 정보성 알림톡이 자동으로 가요. 끄면 알림톡 화면(CT-14) 설정도 같이 바뀌어요.</div></div>' +
        '<div class="ctc-box review" data-pin="7"><b>패드 기록 전송과 앱 로그아웃</b><div class="small">전송 대기 ' + waitSync + '건 · 앱 로그아웃 대기 ' + waitOut + '건. 인터넷이 끊기면 패드에 모아 두었다가 연결되면 보내고, 알림톡에는 실제 체크 시각을 적어요.</div></div></div>';
      // 아래 카드 3개: 수동 수정, 보강, 키오스크 기기
      const fixP = ui.fix === 'none' ? null : rows.find(p => p.id === ui.fix) || rows.find(p => p.status === '미퇴실');
      const mkP = ui.mk === 'none' ? null : rows.find(p => p.id === ui.mk) || rows.find(p => p.status === '결석' && !p.mk);
      const fe = ui.m_err || {};
      let fixBody;
      if (fixP) {
        const isOut = !!(fixP.rec && fixP.rec.in);
        const defT = fixP.k ? span(fixP.k.time)[isOut ? 1 : 0] : '';
        if (ui.m_for !== fixP.id) { ui.m_for = fixP.id; ui.m_time = defT; ui.m_why = isOut ? '퇴실 체크 누락' : '입실 체크 누락'; ui.m_notify = 'on'; ui.m_err = null; }
        fixBody = '<div class="ctc-form"><label>원생</label><span>' + esc(h.mask(fixP.name)) + ' <span class="muted small">' + esc(fixP.k ? fixP.k.name : '') + '</span></span>' +
          '<label>' + (isOut ? '퇴실 시각' : '입실 시각') + '</label><div>' + inp({ f: 'm_time', v: ui.m_time, ph: '17:41', dis: ro, err: fe.time, label: isOut ? '퇴실 시각' : '입실 시각', w: '110px' }) + (fe.time ? '<div class="ctc-errs">' + esc(fe.time) + '</div>' : '') + '</div>' +
          '<label>사유<span class="req">*</span></label>' + sel({ f: 'm_why', v: ui.m_why, opts: [{ v: '', l: '고르세요' }, '퇴실 체크 누락', '입실 체크 누락', '번호를 잘못 누름', '패드 오류', '기타'], dis: ro, label: '사유', w: '100%' }) + '</div>' +
          (fe.why ? '<div class="ctc-errs">' + esc(fe.why) + '</div>' : '') +
          '<label class="row small" style="gap:6px;margin-top:8px;flex-wrap:nowrap">' + chk(ui.m_notify !== 'off', 'CT12.fixNotify', null, ro, '보호자 알림') + '<span>보호자에게 직원 확인 ' + (isOut ? '퇴실' : '입실') + '로 알려요</span></label>' +
          '<div class="row" style="justify-content:flex-end;margin-top:8px">' + h.btn('저장', { primary: true, act: 'CT12.fix', disabled: ro }) + '</div>';
      } else fixBody = '<div class="small muted">고칠 기록을 표에서 골라요. 퇴실 처리나 입실 고치기를 누르면 여기에 열려요.</div>';
      if (s.ct12.edits.length) fixBody += '<div class="ctc-hist">' + s.ct12.edits.slice(0, 3).map(x => '<div>' + esc(x.at + ' ' + x.name + ' ' + x.what + ' · ' + x.why + ' · ' + x.by) + '</div>').join('') + '<div>수정 이력은 지워지지 않아요.</div></div>';
      let mkBody;
      if (mkP) {
        const opts = c12mkOpts(ctx, mkP), used = s.ct12.makeups.filter(m => m.student === mkP.id && m.date.slice(0, 7) === s.today.slice(0, 7)).length;
        const firstOk = (opts.find(o => !o.dis) || {}).v || '';
        if (ui.k_for !== mkP.id) { ui.k_for = mkP.id; ui.k_slot = firstOk; ui.k_err = null; }
        mkBody = '<div class="ctc-form"><label>대상</label><span>' + esc(h.mask(mkP.name)) + ' (' + mdS(s.today) + ' 결석)</span></div>' +
          '<div class="field" style="margin-top:8px"><label>보강일</label>' + (opts.length ? sel({ f: 'k_slot', v: ui.k_slot, opts: opts, dis: ro, label: '보강일', w: '100%' }) : '<span class="small muted">2주 안에 같은 레벨 반이 없어요</span>') + '</div>' +
          '<div class="small" style="margin-top:8px">한도 월 2회 · 2주 ' + varChip() + ' ' + h.chip('미확정(안)', 'st-안') + ' <span class="muted">이번 달 ' + used + '회 씀</span></div>' +
          '<div class="ctc-box review" data-pin="8" style="margin-top:8px"><span class="small">같은 레벨 반 중 본인 정규 수업과 겹치지 않고 자리가 남은 타임만 고를 수 있어요. 보강 학생도 그 시간 인원에 넣어 세요.</span></div>' +
          (ui.k_err ? '<div class="ctc-errs">' + esc(ui.k_err) + '</div>' : '') +
          '<div class="row" style="justify-content:flex-end;margin-top:8px">' + h.btn('보강 저장', { primary: true, act: 'CT12.makeup', disabled: ro || !opts.length }) + '</div>';
      } else mkBody = '<div class="small muted">보강을 잡을 결석이 없어요. 결석 줄의 보강 잡기를 누르면 여기에 열려요.</div><div class="ctc-box review" data-pin="8" style="margin-top:8px"><span class="small">같은 레벨 반 중 본인 정규 수업과 겹치지 않고 자리가 남은 타임만 고를 수 있어요.</span></div>';
      if (s.ct12.makeups.length) mkBody += '<div class="ctc-hist">' + s.ct12.makeups.map(m => '<div>' + esc(m.name + ' ' + mdS(m.date) + ' ' + m.time.split('~')[0] + ' ' + m.clsName) + '</div>').join('') + '</div>';
      const devs = c12devices(ctx);
      html += '<div class="grid g3" style="margin-top:12px">' +
        h.card({ title: '수동 수정', pin: 3, right: fixP ? h.btn('닫기', { sm: true, act: 'CT12.pickFix', arg: 'none' }) : '', body: fixBody }) +
        h.card({ title: '보강', pin: 4, right: h.polChip('POL-22'), body: mkBody }) +
        h.card({ title: '키오스크 기기', pin: 5, body: '<div class="stack" style="gap:4px">' + devs.map(x => '<div class="small"><b>' + esc(x.name) + '</b> · ' + esc(x.st) + ' <span class="muted">(' + esc(x.use) + '용)</span></div>').join('') +
          '<div class="small">체크 방식 <b>' + esc(String(h.polValue('POL-39', c).value).replace(/\s*\(예시\)/, '')) + '</b> ' + varChip() + stChip(polSt('POL-39')) + '</div><div class="small muted">등록한 기기에서만 입실과 퇴실 체크가 돼요. ' + h.polChip('POL-38') + '</div>' +
          '<div class="row" style="margin-top:4px">' + h.btn('기기 관리', { sm: true, go: 'CT-19' }) + '</div></div>' }) +
        '</div>';
      return html;
    },
    mount(root, ctx) { live(root, ctx); },
    prd: {
      summary: '학생이 입구 패드(키오스크)로 들어오고 나간 기록을 봐요. 빠진 기록을 고치고, 결석한 학생의 보강도 여기서 잡아요.',
      who: '원장, 실장·데스크, 교사, 보조교사 모두 보고 고칠 수 있어요.',
      items: [
        { n: 1, t: '오늘 출결', d: '키오스크 입실과 퇴실 기록을 타임별로 봐요. 공용 패드는 퇴실 체크 때 학습 앱에서 자동으로 로그아웃해요(10/14 회의에서 나온 걱정).', pol: ['POL-39'], ref: 'p.57 ①' },
        { n: 2, t: '알림톡', d: '입실과 퇴실 때 보호자에게 정보성 알림톡이 자동으로 가요. 센터는 항목별로 끌 수 있고, 여기서 끄면 알림톡 화면(CT-14) 설정도 같이 바뀌어요.', pol: ['POL-35'], ref: 'p.57 ②' },
        { n: 3, t: '수동 수정', d: '빠진 입실이나 퇴실은 사유를 남기고 고쳐요. 고친 기록은 지워지지 않아요. 저장할 때 보호자에게 직원 확인 퇴실처럼 손으로 고친 기록이라고 알릴지 골라요.', ref: 'p.57 ③' },
        { n: 4, t: '보강', d: '결석한 회차의 보강을 정책 한도 안에서 잡아요. 지금 안은 한 달 2회, 결석 뒤 2주 이내예요. 보강 출석도 같은 키오스크로 체크해요.', pol: ['POL-22'], ref: 'p.57 ④' },
        { n: 5, t: '키오스크 기기', d: '등록한 기기에서만 입실과 퇴실 체크가 돼요. 기기 등록과 해제는 CT-19에서 해요. 체크 방식은 번호 입력(예시)이에요.', pol: ['POL-38', 'POL-39'], ref: 'p.57 ⑤' },
        { n: 6, t: '결석 판정과 미등원 알림', kind: 'review', imp: 'IMP-18', pol: ['POL-35'], d: '수업 시작 10분 뒤까지 입실이 없으면 결석, 끝나고 20분 뒤까지 퇴실이 없으면 미퇴실로 봐요(예시). 결석이면 보호자에게 미등원 알림을 보내요. 판정 시각과 미등원 알림은 아직 정책으로 정하지 않아서 예시 값으로 보여 줘요.' },
        { n: 7, t: '패드 기록 전송과 앱 로그아웃', kind: 'review', imp: 'IMP-05', d: '키오스크 기록이 서버에 들어왔는지, 퇴실 때 학습 앱 로그아웃이 됐는지 함께 보여 줘요. 인터넷이 끊기면 패드에 모아 두었다가 연결되면 다시 보내요.' },
        { n: 8, t: '보강 자리 검사', kind: 'review', imp: 'IMP-15', d: '보강 날짜는 같은 레벨 반 중에서 본인 정규 수업과 겹치지 않고 자리가 남은 타임만 보여 줘요. 보강 학생도 그 시간 인원에 넣어서 정원과 일시수용능력을 넘지 않게 해요.' },
      ],
      open: ['보강 한도, 지금 안은 월 2회와 결석 뒤 2주 (POL-22)', '입실과 퇴실 체크 방식, 번호와 QR과 개인 로그인 중에서 (POL-39)', '패드를 센터가 살지 본사가 납품할지 (POL-38)', '자동 발송 항목 최종 목록과 미등원 알림을 넣을지 (POL-35)', '결석과 미퇴실을 판정하는 기준 시각'],
    },
  });

  B.action('CT12.time', (ctx, v) => { ctx.ui.f_time = v || ''; });
  B.action('CT12.status', (ctx, v) => { ctx.ui.f_st = v || ''; });
  B.action('CT12.excel', ctx => { ctx.s.audit.unshift({ at: '03-08 18:10', who: ctx.persona.name + ' (' + ctx.role + ')', what: '엑셀 다운로드', target: '3/8 출결', reason: '출결 확인' }); B.toast('오늘 출결을 엑셀로 내려받았어요. 이름은 가려진 채로 나가요.'); return false; });
  B.action('CT12.pickFix', (ctx, id) => { ctx.ui.fix = id || null; });
  B.action('CT12.pickMk', (ctx, id) => { ctx.ui.mk = id || null; });
  B.action('CT12.fixNotify', ctx => { ctx.ui.m_notify = ctx.ui.m_notify === 'off' ? 'on' : 'off'; });
  B.action('CT12.auto', (ctx, k) => { if (!ctx.canEdit || !(k in ctx.s.alim.auto)) return; ctx.s.alim.auto[k] = !ctx.s.alim.auto[k]; B.toast(k + ' 알림톡 자동 발송을 ' + (ctx.s.alim.auto[k] ? '켰어요.' : '껐어요. 보호자에게 ' + k + ' 알림이 가지 않아요.')); });
  B.action('CT12.notify', (ctx, id) => {
    if (!ctx.canEdit) return;
    const s = ctx.s, p = c12rows(ctx).find(x => x.id === id); if (!p) return;
    const at = s.ct12.clock = fromMin(toMin(s.ct12.clock) + 1);
    s.ct12.notified[id] = at;
    s.alim.log.push({ at: '03-08 ' + at, center: ctx.centerId, student: id, tpl: '', name: '미등원 알림', to: p.st ? p.st.phone : '-', text: p.name + ' 학생이 아직 센터에 오지 않았어요. 수업 시작 ' + (p.k ? span(p.k.time)[0] : '') + '.', status: '발송 완료', src: 'CT-12' });
    B.toast(h.mask(p.name) + ' 보호자에게 미등원 알림을 보냈어요.');
  });
  B.action('CT12.fix', (ctx, arg) => {
    if (!ctx.canEdit) return;
    const s = ctx.s, ui = ctx.ui;
    if (arg && typeof arg === 'object') { if (arg.student) { ui.fix = arg.student; ui.m_for = arg.student; } if (arg.time != null) ui.m_time = arg.time; if (arg.why != null) ui.m_why = arg.why; if (arg.notify != null) ui.m_notify = arg.notify ? 'on' : 'off'; }
    else h.readFields(ui);
    const rows = c12rows(ctx), p = rows.find(x => x.id === ui.fix) || rows.find(x => x.status === '미퇴실');
    if (!p) { B.toast('고칠 기록을 표에서 골라 주세요.'); return; }
    const isOut = !!(p.rec && p.rec.in), e = ui.m_err = {};
    const t = String(ui.m_time || '').trim();
    if (!okTime(t)) e.time = '시각을 17:41처럼 넣어 주세요.';
    else if (isOut && toMin(t) < toMin(p.rec.in)) e.time = '퇴실 시각은 입실 시각(' + p.rec.in + ')보다 늦어야 해요.';
    if (!ui.m_why) e.why = '사유를 골라 주세요. 사유 없이 고칠 수 없어요.';
    if (Object.keys(e).length) { B.toast('빨간 글씨를 확인해 주세요.'); return; }
    const notify = ui.m_notify !== 'off';
    let rec = p.rec;
    if (isOut) { rec.out = t; rec.alimOut = notify ? '직원 확인 퇴실 발송' : '보내지 않음'; rec.appLogout = rec.appLogout || '완료'; }
    else {
      rec = { id: 'c12m' + (s.ct12.att.length + 1), center: ctx.centerId, date: s.today, student: p.id, cls: p.k ? p.k.id : '', in: t, out: '', device: '직원 수정', alimIn: notify ? '발송 완료' : '보내지 않음', alimOut: '', appLogout: '', sync: '전송', src: '직원 수정' };
      s.ct12.att.push(rec);
    }
    rec.manual = { by: who(ctx), why: ui.m_why };
    const at = s.ct12.clock = fromMin(toMin(s.ct12.clock) + 1);
    s.ct12.edits.unshift({ at: '03-08 ' + at, id: p.id, name: h.mask(p.name), what: (isOut ? '퇴실 ' : '입실 ') + t, why: ui.m_why, by: who(ctx) });
    if (notify) s.alim.log.push({ at: '03-08 ' + at, center: ctx.centerId, student: p.id, tpl: isOut ? 'T02' : 'T01', name: isOut ? '퇴실 알림' : '입실 알림', to: p.st ? p.st.phone : '-', text: p.name + ' 학생이 ' + t + '에 ' + (isOut ? '퇴실' : '입실') + '했어요 (직원 확인).', status: '발송 완료', src: 'CT-12' });
    ui.fix = null; ui.m_for = null; ui.m_err = null;
    B.toast(h.mask(p.name) + ' ' + (isOut ? '퇴실' : '입실') + ' ' + t + '을 기록했어요. 수정 이력이 남아요.');
  });
  B.action('CT12.makeup', (ctx, arg) => {
    if (!ctx.canEdit) return;
    const s = ctx.s, ui = ctx.ui;
    if (arg && typeof arg === 'object') { if (arg.student) { ui.mk = arg.student; ui.k_for = arg.student; } if (arg.slot) ui.k_slot = arg.slot; }
    else h.readFields(ui);
    const rows = c12rows(ctx), p = rows.find(x => x.id === ui.mk) || rows.find(x => x.status === '결석' && !x.mk);
    if (!p) { B.toast('보강할 결석을 골라 주세요.'); return; }
    const opts = c12mkOpts(ctx, p), o = opts.find(x => x.v === ui.k_slot);
    const used = s.ct12.makeups.filter(m => m.student === p.id && m.date.slice(0, 7) === s.today.slice(0, 7)).length;
    if (!o) { ui.k_err = '보강일을 골라 주세요.'; return; }
    if (o.dis) { ui.k_err = '그 타임은 자리가 없거나 같은 시간대 인원이 넘쳐요.'; return; }
    if (used >= 2) { ui.k_err = '이번 달 보강 한도 2회(안)를 다 썼어요.'; return; }
    const [d, kid] = ui.k_slot.split('|'), k = s.classes.find(x => x.id === kid);
    s.ct12.makeups.push({ student: p.id, name: h.mask(p.name), from: s.today, date: d, cls: kid, clsName: k.name, time: k.time, by: who(ctx) });
    ui.mk = null; ui.k_for = null; ui.k_err = null;
    B.toast(h.mask(p.name) + ' 보강을 ' + mdS(d) + ' (' + dow(d) + ') ' + span(k.time)[0] + ' ' + k.name + '로 잡았어요. 그날 같은 키오스크로 체크해요.');
  });
})();
