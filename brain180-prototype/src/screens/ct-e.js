/* CT-18~CT-24 센터 설정(교습비, 센터 정보, 교직원)과 확대 단계(통계, 대기자, 점검 회신, 개인정보 요청). 원문 63~67쪽. */
(function () {
  const B = window.B, h = B.h, esc = B.esc, P = h.p;

  /* ---------------- 이 파일 전용 작은 부품 ---------------- */
  // h.table과 같지만 머리글에 핀을 달 수 있어요 (c.head는 HTML 그대로)
  function T(cols, rows, o) {
    o = o || {};
    const head = '<tr>' + cols.map(c => '<th class="' + (c.num ? 'num' : '') + '"' + (c.w ? ' style="width:' + c.w + '"' : '') + '>' + (c.head != null ? c.head : esc(c.label)) + '</th>').join('') + '</tr>';
    const body = (rows || []).map((r, i) => '<tr' + (o.rowAttr ? o.rowAttr(r, i) : '') + '>' + cols.map(c => '<td class="' + (c.num ? 'num' : '') + '">' + (c.render ? c.render(r, i) : esc(r[c.k])) + '</td>').join('') + '</tr>').join('');
    return '<div class="tbl-wrap"' + P(o.pin) + '><table class="tbl"><thead>' + head + '</thead><tbody>' +
      (body || '<tr><td colspan="' + cols.length + '"><div class="empty" style="border:0">' + esc(o.empty || '아직 데이터가 없어요.') + '</div></td></tr>') + '</tbody></table></div>';
  }
  const hp = (label, n) => '<span data-pin="' + n + '" style="display:inline-block;margin-top:3px;padding-left:15px">' + esc(label) + '</span>';
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
  const dayDiff = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
  const md = s => String(s || '').slice(5);
  const WD = '일월화수목금토';
  const num = v => { const n = parseInt(String(v == null ? '' : v).replace(/[^0-9]/g, ''), 10); return isNaN(n) ? null : n; };
  const won = h.money;
  const errLine = t => t ? '<div class="small" style="color:var(--bad);font-weight:600;margin-top:4px">' + esc(t) + '</div>' : '';
  const note = (t, o) => '<div class="small muted"' + P((o || {}).pin) + ' style="margin-top:8px">' + esc(t) + '</div>';
  const label = t => '<div class="small" style="font-weight:700;color:var(--sub);margin-bottom:4px">' + esc(t) + '</div>';
  const check = (field, on, text, o) => '<label class="row small"' + P((o || {}).pin) + ' style="gap:6px;align-items:flex-start;flex-wrap:nowrap;margin-top:8px"><input type="checkbox" data-field="' + field + '"' + (on ? ' checked' : '') + ((o || {}).disabled ? ' disabled' : '') + ' style="margin-top:2px"><span>' + esc(text) + '</span></label>';
  const tick = (on, text, act, arg, dis) => '<button type="button" class="opt' + (on ? ' on' : '') + (dis ? ' dis' : '') + '"' + (dis ? '' : ' data-act="' + act + '" data-arg="' + esc(arg) + '"') + '>' + (on ? '✓ ' : '') + esc(text) + '</button>';
  const reviewBox = (inner, pin, extra) => '<div' + P(pin) + ' style="padding:10px;border:1px solid #ddd2f7;border-radius:8px;background:#fbf9ff;' + (extra || '') + '">' + inner + '</div>';
  // 엔진은 동작이 끝나면 화면을 다시 그려서 바로 띄운 알림이 지워져요. 다시 그린 뒤에 띄워요.
  const say = m => setTimeout(() => B.toast(m), 0);
  // select와 날짜 칸은 바꾸는 즉시 다시 그려서 계산 결과를 보여 줘요
  function live(root, ctx, fields, after) {
    fields.forEach(f => {
      const el = root.querySelector('[data-field="' + f + '"]');
      if (!el) return;
      el.addEventListener('change', () => { ctx.ui[f] = el.type === 'checkbox' ? el.checked : el.value; if (after) after(f, el.value); B.render(); });
    });
  }
  const objArg = a => a && typeof a === 'object';
  // 받침에 맞춰 조사를 붙여요. 숫자와 영문 끝 글자도 읽는 소리로 봐요 (L2-화목A는, 260,000원으로)
  const jongOf = w => {
    const ch = String(w == null ? '' : w).trim().slice(-1), c = ch.charCodeAt(0);
    if (c >= 0xAC00 && c <= 0xD7A3) { const j = (c - 0xAC00) % 28; return j === 0 ? 0 : j === 8 ? 'l' : 1; }
    if (/[0-9]/.test(ch)) return '178'.includes(ch) ? 'l' : '036'.includes(ch) ? 1 : 0;
    if (/[a-z]/i.test(ch)) return /[lr]/i.test(ch) ? 'l' : /[mn]/i.test(ch) ? 1 : 0;
    return 0;
  };
  const J = (w, a, b) => String(w) + (a === '으로' ? (jongOf(w) === 1 ? '으로' : '로') : (jongOf(w) ? a : b));
  // h.pv와 같지만 값 안의 (예시), (안) 글자를 빼고 상태 칩 하나만 붙여요. 값이 미정이면 칩만 보여요.
  const pvl = (code, c) => {
    const v = h.polValue(code, c), st = v.status || h.pol(code).status;
    const t = String(v.value == null ? '' : v.value).replace(/\s*\((안|예시|미정|법정)\)\s*/g, ' ').trim();
    const chip = st && st !== '확정' ? h.chip(st === '안' ? '(안)' : st, 'st-' + st) : '';
    return '<span class="pv">' + (t && t !== '미정' ? '<b>' + esc(t) + '</b>' : '') + chip + '</span>';
  };

  /* =====================================================================
     CT-18 교습 상품·교습비 (p.63)
     ===================================================================== */
  const WARN_PCT = 10; // HQ-10 경고 기준, 권장가 대비 ±10% (예시)
  const REASONS = ['지역 시세·임대료', '원가 상승', '수업 구성 차이', '그 밖의 사유'];
  B.extend(s => {
    s.ct18 = {
      groupRec: { pr3: 150000, pr1: 260000, pr2: 360000 }, // 가맹 그룹 권장가 (p.63, p.29 예시)
      centers: {
        daegu: {
          prices: { pr3: 150000, pr1: 290000, pr2: 400000 },
          edu: { pr3: { amount: 150000, status: '등록' }, pr1: { amount: 300000, status: '등록' }, pr2: { amount: 380000, status: '변경신고 중', pending: 400000, proof: '변경신고서 접수증.pdf' } },
          reasons: { pr1: { reason: '지역 시세·임대료', memo: '수성구 평균 교습비 기준' }, pr2: { reason: '지역 시세·임대료', memo: '' } },
          discounts: [{ type: '형제', value: '10%' }, { type: '장기 3개월', value: '5%' }, { type: '개원 프로모션', value: '1개월 20%' }],
          extras: [{ id: 'ex1', name: '교재비 (월)', amount: 15000, edu: 15000, status: '등록' }],
          midMonth: '일할', weeks45: '회차 차감', history: [],
        },
      },
    };
  });
  const prodsOf = s => s.products.slice().sort((a, b) => a.perWeek - b.perWeek);
  const shortName = p => p.name.split(' · ')[0];
  function ct18Data(s, c) {
    const all = s.ct18.centers;
    if (!all[c.id]) {
      const direct = c.type === '직영';
      const d = all[c.id] = {
        prices: {}, edu: {}, reasons: {},
        discounts: [{ type: '형제', value: '10%' }, { type: '장기 3개월', value: '5%' }, { type: '개원 프로모션', value: '1개월 20%' }],
        extras: s.extraFees.map(x => ({ id: x.id, name: x.name, amount: x.amount, edu: x.eduRegistered ? x.amount : null, status: x.eduRegistered ? '등록' : '미등록' })),
        midMonth: '일할', weeks45: '회차 차감', history: [],
      };
      s.products.forEach(p => {
        d.prices[p.id] = direct ? p.direct : ((p.centerPrice || {})[c.id] || p.recommend);
        const a = (p.edu || {})[c.id];
        d.edu[p.id] = a ? { amount: a, status: '등록' } : { amount: null, status: '미등록' };
      });
    }
    return all[c.id];
  }
  const recOf = (s, c, p) => c.type === '직영' ? p.direct : (s.ct18.groupRec[p.id] || p.recommend);
  function saleOf(price, e) {
    if (!e || e.amount == null || e.status === '미등록') return { ok: false, why: e && e.status === '확인 대기' ? '확인 대기' : '교육청 등록 전' };
    if (e.status === '변경신고 중' || e.status === '확인 대기') return { ok: false, why: e.status };
    if (price != null && price > e.amount) return { ok: false, why: '등록액 초과' };
    return { ok: true, why: '' };
  }
  const extraSale = x => saleOf(x.amount, { amount: x.edu, status: x.status });
  const pctOf = (price, rec) => (price == null || !rec) ? null : (price - rec) / rec * 100;
  const pctTxt = v => v == null ? '-' : (Math.abs(v) < 0.05 ? '0%' : (v > 0 ? '+' : '') + v.toFixed(1) + '%');
  const pctNum = t => { const m = /(\d+(?:\.\d+)?)\s*%/.exec(String(t || '')); return m ? Number(m[1]) : 0; };
  const eduChip = st => h.chip(st, { '등록': 'ok', '변경신고 중': 'warn', '확인 대기': 'warn', '미등록': 'bad' }[st] || '');
  function ct18Rows(ctx) {
    const s = ctx.s, c = ctx.center, d = ct18Data(s, c), ui = ctx.ui;
    return prodsOf(s).map(p => {
      const draft = ui['p_' + p.id];
      const price = draft != null && draft !== '' ? num(draft) : d.prices[p.id];
      const rec = recOf(s, c, p), e = d.edu[p.id] || { amount: null, status: '미등록' };
      return { p, id: p.id, rec, price, diff: pctOf(price, rec), e, sale: saleOf(price, e) };
    });
  }
  function diffHtml(r, edit) {
    const over = r.diff != null && Math.abs(r.diff) > WARN_PCT;
    return esc(pctTxt(r.diff)) + (over ? ' ' + h.chip('경고', 'warn') + (edit ? ' <button type="button" class="btn sm ghost" data-act="CT18.sel" data-arg="' + r.id + '">사유</button>' : '') : '');
  }

  B.screen({
    id: 'CT-18', side: 'ct', phase: 'P1a', devices: ['pc'], pages: [63],
    title: '교습 상품·교습비', menuLabel: '교습 상품·교습비', crumb: '설정 > 교습 상품·교습비',
    headActions: ctx => h.btn('교습비 게시표 출력', { act: 'CT18.print' }) + h.btn('광고 표시 문구', { act: 'CT18.ad' }) +
      h.btn('저장', { primary: true, act: 'CT18.save', disabled: !ctx.canEdit || ctx.center.type === '직영', title: ctx.center.type === '직영' ? '직영 센터는 본사 확정가를 보기만 해요' : null }),
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, c = ctx.center, d = ct18Data(s, c), direct = c.type === '직영', edit = ctx.canEdit && !direct;
      const rows = ct18Rows(ctx), perr = ui.p_err || {};
      let html = '<div class="stack">';
      html += h.alert('<span class="chip ' + (direct ? 'navy' : 'brand') + '">' + (direct ? '직영 센터 화면' : '가맹 센터 화면') + ' (' + esc(c.name) + ')</span> ' +
        esc(direct ? '교습비는 본사 확정가로 보이고 바꿀 수 없어요. 가맹 센터는 같은 화면에서 교습비를 직접 정해요.' : '교습비는 센터가 정해요. 직영 센터에서는 본사 확정가가 보이고 수정할 수 없어요.') +
        ' <button type="button" class="btn sm" style="margin-left:6px" data-act="CT18.view" data-arg="' + (direct ? '가맹' : '직영') + '">' + (direct ? '가맹 화면과 비교' : '직영 화면과 비교') + '</button>', direct ? 'info' : 'warn', { raw: true, pin: 1 });
      html += h.card({
        title: '교습 상품', sub: '경고 기준 권장가 대비 ±' + WARN_PCT + '% (예시, HQ-10)', right: h.polChip('POL-10') + h.polChip('POL-11') + h.polChip('POL-12'),
        body: T([
          { label: '상품 (템플릿)', render: r => '<b>' + esc(r.p.name) + '</b>' },
          { head: hp(direct ? '본사 확정가' : '권장가', 2) + ' <span class="chip st-예시">예시</span>', num: true, render: r => won(r.rec) },
          { label: '센터 교습비', num: true, render: r => edit
            ? '<input class="inp' + (perr[r.id] ? ' bad' : '') + '" data-field="p_' + r.id + '" value="' + esc(ui['p_' + r.id] != null ? ui['p_' + r.id] : r.price) + '" inputmode="numeric" aria-label="' + esc(r.p.name) + ' 센터 교습비" style="width:112px;min-height:28px;padding:3px 8px;text-align:right">' + errLine(perr[r.id])
            : won(r.price) + (direct ? '<div class="small muted">수정 불가</div>' : '') },
          { label: '차이', render: r => '<span id="ct18-diff-' + r.id + '">' + diffHtml(r, edit) + '</span>' },
          { head: hp('교육청 등록액', 3), num: true, render: r => (r.e.amount != null ? won(r.e.amount) : '<span class="muted">미등록</span>') + (r.e.pending ? '<div class="small muted">' + won(r.e.pending) + (r.e.amount != null ? '으로 변경신고 중' : ' 확인 대기') + '</div>' : '') },
          { label: '등록 상태', render: r => eduChip(r.e.status) },
          { label: '판매', render: r => r.sale.ok ? h.chip('판매', 'ok') : h.chip('잠김', 'bad') + '<div class="small muted">' + esc(r.sale.why) + '</div>' },
        ], rows),
      });
      const devs = direct ? [] : rows.filter(r => r.diff != null && Math.abs(r.diff) > WARN_PCT);
      const sel = devs.find(r => r.id === ui.sel) || devs[0];
      html += '<div class="grid g2" style="align-items:start"><div class="stack">' + (sel ? reasonCard(ctx, sel, devs, d) : direct ? historyCard(ctx, d) : '') + eduCard(ctx, rows, d) + '</div>' + previewCard(ctx, rows, d) + '</div>';
      html += '<div class="grid g3" style="align-items:start">' + discCard(ctx, d, direct) + extraCard(ctx, d, direct) + midCard(ctx, d, direct) + '</div>';
      return html + '</div>';
    },
    mount(root, ctx) {
      // 센터 교습비를 고치는 동안 차이(%)를 바로 다시 계산해요
      Array.prototype.forEach.call(root.querySelectorAll('[data-field^="p_"]'), el => {
        el.addEventListener('input', () => {
          const pid = el.getAttribute('data-field').slice(2);
          const p = ctx.s.products.find(x => x.id === pid); if (!p) return;
          const price = num(el.value), rec = recOf(ctx.s, ctx.center, p);
          const out = root.querySelector('#ct18-diff-' + pid);
          if (out) out.innerHTML = diffHtml({ id: pid, diff: pctOf(price, rec) }, true);
        });
      });
      live(root, ctx, ['e_prod']);
    },
    prd: {
      summary: '센터에서 파는 수업 상품의 교습비와 할인, 교재비, 월 중간 등록 계산법을 정하는 화면이에요. 가맹 센터는 직접 정하고, 직영 센터는 본사 확정가를 보기만 해요.',
      who: '원장만 써요. 7쪽 권한표에서 센터 설정은 원장만 보고 고칠 수 있고, 실장과 교사, 보조교사에게는 메뉴가 안 보여요.',
      items: [
        { n: 1, t: '직영·가맹 차이', d: '가맹 센터는 교습비를 직접 정하고, 직영 센터는 본사 확정가를 보기만 해요. 화면 모양은 같아요. 가맹 센터가 직접 정하는 기능은 가맹이 시작되는 P1b부터 쓰여요(POL-11). 맨 위 띠의 비교 버튼으로 두 화면을 오가며 볼 수 있어요.', pol: ['POL-11'], ref: 'p.63 ①' },
        { n: 2, t: '권장가', d: '본사 상품 틀과 권장가를 보여 주고, 센터 교습비와 몇 % 차이 나는지 바로 계산해요. 권장가 260,000원(예시)에 센터 교습비가 290,000원이면 +11.5%예요.', pol: ['POL-10', 'POL-11'], ref: 'p.63 ②' },
        { n: 3, t: '교육청 등록액', d: '교육청에 등록한 금액을 넘거나 변경신고가 끝나지 않은 상품은 판매가 잠겨요. 시스템이 막는 가격 규칙은 이것 하나뿐이에요.', pol: ['POL-12'], ref: 'p.63 ③' },
        { n: 4, t: '이탈 경고', cond: true, reveal: 'CT18.view', revealArg: '가맹', d: '가맹 센터가 권장가에서 10%(예시, HQ-10)를 넘게 벗어나도 저장은 돼요. 본사가 가격을 강제하지 않도록 경고만 하고 사유를 받아요. 사유는 본사 통계에만 쓰여요.', pol: ['POL-11'], ref: 'p.63 ④' },
        { n: 5, t: '할인', d: '할인 종류와 값은 가맹 센터가 정하고, 할인을 쓸 때마다 사유를 남겨요. 직영 센터는 본사가 정한 할인만 써요.', pol: ['POL-13'], ref: 'p.63 ⑤' },
        { n: 6, t: '기타경비', d: '교재비 같은 돈은 실제 드는 만큼만 받고, 교육청에 등록한 항목만 받아요.', pol: ['POL-14'], ref: 'p.63 ⑥' },
        { n: 7, t: '월중·4·5주 처리', d: '달 중간에 등록할 때와 수업이 4번인 달, 5번인 달의 계산법을 본사가 허락한 보기 중에서 골라요. 고른 방법은 게시한 교습비와 같아야 해요. 게시표와 광고 문구는 위쪽 버튼으로 출력해요.', pol: ['POL-19', 'POL-20'], ref: 'p.63 ⑦' },
        { n: 8, t: '등록액 변경은 수리 문서를 붙여 신고해요', kind: 'review', imp: 'IMP-03', d: '등록액을 새로 넣거나 바꿀 때는 교육청 등록증이나 변경신고 수리 문서를 꼭 붙여요. 본사 운영팀이 확인하기 전까지는 변경신고 중이나 확인 대기로 남고, 그동안 그 상품은 팔 수 없어요. 숫자를 실수로 높게 넣어도 잠금이 풀리지 않아요.', pol: ['POL-12'] },
        { n: 9, t: '기타경비에도 등록액과 잠금', kind: 'review', imp: 'IMP-03', d: '원문에는 교재비 같은 기타경비에 등록액 칸이 없었어요. 교습비와 똑같이 등록액과 판매 칸을 두고, 등록하지 않았거나 등록액을 넘는 항목은 잠가서 수강 등록에서 고를 수 없게 해요.', pol: ['POL-14'] },
        { n: 10, t: '청구 금액 미리 보기', kind: 'review', imp: 'IMP-09', d: '상품과 등록일, 할인을 고르면 실제 청구 금액을 계산해 보여 줘요. 정가, 월중 비례, 할인, 테스트비 차감, 기타경비 순서로 계산하고, 끝전은 학부모에게 불리하지 않게 처리해요(예시).', pol: ['POL-19', 'POL-13'] },
      ],
      open: [
        '상품 틀과 권장가 금액(POL-10, POL-11)은 아직 예시예요.',
        '권장가에서 몇 %를 벗어나면 경고할지 정하지 않았어요. HQ-10에는 10%가 예시로 나와 있어요.',
        '여러 할인을 겹쳐 쓸 수 있는지와 계산 순서(POL-13)',
        '기타경비 항목과 금액(POL-14)',
        '월중 등록 계산법(POL-19)과 4주 달, 5주 달 처리(POL-20)',
        '변경신고 중을 등록으로 바꾸는 사람과 필요한 증빙. 원문에 없어서 8번처럼 본사 운영팀이 수리 문서를 확인하는 안을 넣었어요.',
      ],
      rules: ['교육청에 등록한 교습비를 넘겨 받을 수 없어요(학원법, POL-12).', '가맹 센터 판매가를 본사가 강제하면 가격 구속이 될 수 있어서 경고만 해요(가맹사업법).'],
    },
  });

  function reasonCard(ctx, r, devs, d) {
    const ui = ctx.ui, rs = d.reasons[r.id] || {};
    const reason = ui['r_reason_' + r.id] != null ? ui['r_reason_' + r.id] : (rs.reason || '');
    const memo = ui['r_memo_' + r.id] != null ? ui['r_memo_' + r.id] : (rs.memo || '');
    return h.card({
      title: '권장가 이탈 사유', pin: 4,
      right: devs.length > 1 ? h.opts(devs.map(x => ({ v: x.id, l: shortName(x.p) })), r.id, { act: 'CT18.sel' }) : '',
      body: '<div class="stack" style="gap:10px">' + h.kv([['상품', esc(r.p.name) + ' (' + esc(pctTxt(r.diff)) + ')', true]]) +
        '<div class="grid g2" style="gap:10px">' +
        h.field({ label: '사유', req: true, type: 'select', field: 'r_reason_' + r.id, value: reason, options: [{ v: '', l: '고르세요' }].concat(REASONS), err: ui.r_err === r.id ? '권장가를 10% 넘게 벗어났어요. 사유를 골라 주세요.' : null, disabled: !ctx.canEdit }) +
        h.field({ label: '메모', field: 'r_memo_' + r.id, value: memo, ph: '예) 수성구 평균 교습비 기준', disabled: !ctx.canEdit }) +
        '</div><div class="small muted">저장은 돼요. 사유는 본사 통계(HQ-23)에만 쓰여요.</div></div>',
    });
  }
  function historyCard(ctx, d) {
    const hist = d.history.slice().reverse();
    const name = id => { const p = ctx.s.products.find(x => x.id === id); return p ? p.name : id; };
    return h.card({
      title: '교습비 변경 이력', sub: '본사 확정가가 바뀌면 남아요',
      body: hist.length ? '<div class="tl">' + hist.map(x => '<div><b>' + esc(x.date) + '</b> ' + esc(name(x.id)) + ' ' + won(x.from) + '에서 ' + J(won(x.to), '으로') + ', ' + esc(x.by) + '</div>').join('') + '</div>'
        : '<div class="small muted">아직 바뀐 기록이 없어요. 본사가 HQ-10에서 확정가를 바꾸면 적용일과 함께 여기에 남고, 게시표를 다시 출력하라고 알려 줘요.</div>',
    });
  }
  function eduCard(ctx, rows, d) {
    const ui = ctx.ui, dis = !ctx.canEdit;
    const pend = rows.filter(r => r.e.pending).map(r => ({ id: r.id, name: r.p.name, from: r.e.amount, to: r.e.pending, proof: r.e.proof }))
      .concat(d.extras.filter(x => x.status === '확인 대기').map(x => ({ id: x.id, name: x.name, from: null, to: x.pending, proof: x.proof })));
    const list = pend.length
      ? '<div class="list" style="margin-top:8px">' + pend.map(x => '<div><div style="flex:1;min-width:0"><b>' + esc(x.name) + '</b> <span class="small">' + (x.from != null ? won(x.from) + '에서 ' + J(won(x.to), '으로') : won(x.to) + ' 새로 등록') + '</span><div class="small muted">' + (x.proof ? '첨부 ' + esc(x.proof) : '첨부 없음') + ', 본사 확인 대기</div></div>' +
        h.btn('본사 확인 반영 (시연)', { sm: true, ghost: true, act: 'CT18.eduConfirm', arg: x.id, title: '본사 운영팀이 수리 문서를 확인한 결과를 받아 봐요' }) + '</div>').join('') + '</div>'
      : '<div class="small muted" style="margin-top:8px">본사 확인을 기다리는 신고가 없어요.</div>';
    return h.card({
      title: '등록액 변경 신고', sub: '수리 문서를 붙여야 올라가요', pin: 8,
      body: '<div class="grid g3" style="gap:8px;align-items:start">' +
        h.field({ label: '상품', type: 'select', field: 'e_prod', value: ui.e_prod || 'pr2', options: prodsOf(ctx.s).map(p => ({ v: p.id, l: p.name })), disabled: dis }) +
        h.field({ label: '새 등록액', field: 'e_amount', value: ui.e_amount || '', ph: '400000', err: ui.e_err_amount, disabled: dis }) +
        '<div class="field"><label>수리 문서</label>' + (ui.e_file
          ? '<div class="row" style="gap:4px;flex-wrap:nowrap"><span class="chip info" style="overflow:hidden;text-overflow:ellipsis;max-width:110px">' + esc(ui.e_file) + '</span>' + h.btn('빼기', { sm: true, ghost: true, act: 'CT18.attach', arg: 'off' }) + '</div>'
          : h.btn('파일 첨부', { act: 'CT18.attach', arg: 'on', disabled: dis })) + errLine(ui.e_err_file) + '</div>' +
        '</div><div class="row" style="justify-content:space-between;margin-top:10px;flex-wrap:nowrap"><span class="small muted">본사가 확인하면 등록으로 바뀌어요. 그 전에는 판매가 잠겨요.</span>' + h.btn('변경 신고 올리기', { act: 'CT18.eduSubmit', disabled: dis }) + '</div>' + list,
    });
  }
  function previewCard(ctx, rows, d) {
    const ui = ctx.ui, c = ctx.center, direct = c.type === '직영';
    const r = rows.find(x => x.id === (ui.pv_prod || 'pr1')) || rows[0];
    const day = ui.pv_day || '1일 등록', disc = ui.pv_disc || '할인 없음';
    const mid = direct ? null : (ui.mid || d.midMonth);
    const lines = []; let base = r.price || 0, memo = '';
    lines.push(['교습비 정가 (' + shortName(r.p) + ')', base]);
    if (day === '15일 등록') {
      if (direct) memo = '직영 월중 계산법(POL-19)이 미정이라 정가로 보여 줘요.';
      else if (mid === '일할') { const v = Math.floor(base * 16 / 30 / 10) * 10; lines.push(['월중 일할 (4/15~4/30, 16/30일)', v - base]); base = v; }
      else if (mid === '다음 달부터') { lines.push(['이번 달은 받지 않고 다음 달부터', -base]); base = 0; }
      else memo = '남은 회차로 계산하려면 반 요일이 있어야 해요. 수강 등록(CT-07)에서 반을 고르면 계산돼요.';
    }
    if (disc !== '할인 없음') {
      const dc = d.discounts.find(x => x.type === disc);
      const v = dc ? Math.ceil(base * pctNum(dc.value) / 100 / 10) * 10 : 0;
      if (v) { lines.push(['할인 ' + disc + ' ' + dc.value, -v]); base -= v; }
    }
    const ex = d.extras.filter(x => extraSale(x).ok);
    ex.forEach(x => lines.push([x.name, x.amount]));
    const total = base + ex.reduce((a, x) => a + x.amount, 0);
    const optRow = (t, list, cur, act) => '<div class="row" style="gap:6px;flex-wrap:nowrap"><span class="small muted" style="width:46px;flex:none">' + esc(t) + '</span>' + h.opts(list, cur, { act }) + '</div>';
    return h.card({
      title: '청구 금액 미리 보기', sub: '4월 기준 (30일)', pin: 10,
      body: '<div class="stack" style="gap:8px">' +
        optRow('상품', rows.map(x => ({ v: x.id, l: shortName(x.p) })), r.id, 'CT18.pvProd') +
        optRow('등록일', ['1일 등록', '15일 등록'], day, 'CT18.pvDay') +
        optRow('할인', ['할인 없음'].concat(d.discounts.map(x => x.type)), disc, 'CT18.pvDisc') + '</div>' +
        '<div class="list" style="margin-top:10px">' + lines.map(([k, v]) => '<div><span style="flex:1">' + esc(k) + '</span><span class="money">' + (v < 0 ? '-' : '') + won(Math.abs(v)) + '</span></div>').join('') +
        '<div><b style="flex:1">청구 금액</b><b class="money" style="font-size:15px">' + won(total) + '</b></div></div>' +
        (memo ? '<div style="margin-top:8px">' + h.alert(memo, 'info') + '</div>' : '') +
        (!r.sale.ok ? '<div style="margin-top:8px">' + h.alert('이 상품은 판매가 잠겨 있어서 청구서에 실을 수 없어요 (' + r.sale.why + ').', 'bad') + '</div>' : '') +
        note('정가, 월중 비례, 할인, 테스트비 차감, 기타경비 순서로 계산해요. 테스트비는 교육청 확인 전이라 받지 않아서 빼는 금액도 없어요. 청구 금액은 10원 미만을 버리고, 할인은 10원 미만을 올려서 학부모에게 불리하지 않게 해요 (예시).'),
    });
  }
  function discCard(ctx, d, direct) {
    const ui = ctx.ui, edit = ctx.canEdit && !direct;
    const tb = T([{ label: '유형', k: 'type' }, { label: '값', k: 'value' }].concat(edit ? [{ label: '', render: (x, i) => h.btn('삭제', { sm: true, ghost: true, act: 'CT18.delDisc', arg: String(i) }) }] : []), d.discounts, { empty: '할인이 없어요.' });
    const add = edit ? '<div class="row" style="margin-top:8px;flex-wrap:nowrap;gap:6px"><input class="inp" data-field="dc_type" aria-label="할인 유형" placeholder="유형" value="' + esc(ui.dc_type || '') + '" style="flex:1;min-width:0"><input class="inp" data-field="dc_value" aria-label="할인 값" placeholder="10%" value="' + esc(ui.dc_value || '') + '" style="width:72px">' + h.btn('추가', { sm: true, act: 'CT18.addDisc' }) + '</div>' + errLine(ui.dc_err) : '';
    return h.card({ title: '할인', pin: 5, right: h.polChip('POL-13'), body: tb + add + note(direct ? '본사가 정한 할인만 써요. 할인 상한은 20%예요 (예시, 직영에만).' : '할인을 적용할 때마다 사유를 남겨요 (CT-07).') });
  }
  function extraCard(ctx, d, direct) {
    const ui = ctx.ui, edit = ctx.canEdit && !direct;
    const tb = T([
      { label: '항목', k: 'name' },
      { label: '금액', num: true, render: x => won(x.amount) },
      { head: hp('등록액', 9), num: true, render: x => x.edu != null ? won(x.edu) : (x.pending ? '<span class="small muted">' + won(x.pending) + '<br>확인 대기</span>' : '<span class="muted">-</span>') },
      { label: '판매', render: x => { const sl = extraSale(x); return sl.ok ? h.chip('판매', 'ok') : h.chip('잠김', 'bad') + '<div class="small muted">' + esc(sl.why) + '</div>'; } },
    ], d.extras);
    const add = edit ? '<div class="grid g3" style="gap:6px;margin-top:8px"><input class="inp" data-field="ex_name" aria-label="기타경비 항목" placeholder="항목" value="' + esc(ui.ex_name || '') + '"><input class="inp" data-field="ex_amount" aria-label="금액" placeholder="금액" value="' + esc(ui.ex_amount || '') + '"><input class="inp" data-field="ex_edu" aria-label="교육청 등록액" placeholder="등록액" value="' + esc(ui.ex_edu || '') + '"></div>' +
      errLine(ui.ex_err) + '<div class="row" style="justify-content:flex-end;margin-top:6px">' + h.btn('항목 추가', { sm: true, act: 'CT18.addExtra' }) + '</div>' : '';
    return h.card({ title: '기타경비', pin: 6, right: h.polChip('POL-14'), body: tb + add + note('실비로만, 교육청에 등록한 항목만 받아요.') });
  }
  function midCard(ctx, d, direct) {
    const ui = ctx.ui;
    const body = direct
      ? h.kv([['월중 등록', pvl('POL-19', ctx.center), true], ['4·5주 달', pvl('POL-20', ctx.center), true]]) + note('직영 센터는 본사 값을 그대로 써요.')
      : '<div class="stack" style="gap:10px"><div>' + label('월중 등록') + h.opts(['일할', '다음 달부터', '남은 회차'], ui.mid || d.midMonth, { act: 'CT18.mid' }) + '</div><div>' + label('4·5주 달') + h.opts(['월 정액', '회차 차감'], ui.w45 || d.weeks45, { act: 'CT18.w45' }) + '</div></div>' +
        note('본사가 허용한 보기 중에서 골라요. 게시 교습비와 같게 맞춰요.');
    return h.card({ title: '월중·4·5주 처리', pin: 7, right: h.polChip('POL-19') + h.polChip('POL-20'), body });
  }

  B.action('CT18.view', (ctx, v) => {
    B.state.persona = v === '가맹' ? 'ct:daegu:원장' : 'ct:daechi1:원장';
    Object.keys(ctx.ui).forEach(k => { delete ctx.ui[k]; });
  });
  B.action('CT18.sel', (ctx, id) => { ctx.ui.sel = id; ctx.ui.r_err = null; });
  B.action('CT18.mid', (ctx, v) => { if (ctx.canEdit) ctx.ui.mid = v; });
  B.action('CT18.w45', (ctx, v) => { if (ctx.canEdit) ctx.ui.w45 = v; });
  B.action('CT18.pvProd', (ctx, v) => { ctx.ui.pv_prod = v; });
  B.action('CT18.pvDay', (ctx, v) => { ctx.ui.pv_day = v; });
  B.action('CT18.pvDisc', (ctx, v) => { ctx.ui.pv_disc = v; });
  B.action('CT18.save', (ctx, arg) => {
    const s = ctx.s, c = ctx.center, ui = ctx.ui, d = ct18Data(s, c);
    if (c.type === '직영' || !ctx.canEdit) { say('직영 센터 교습비는 본사 확정가라 여기서 바꾸지 않아요.'); return; }
    if (objArg(arg)) {
      Object.keys(arg.prices || {}).forEach(k => { ui['p_' + k] = String(arg.prices[k]); });
      Object.keys(arg.reasons || {}).forEach(k => { ui['r_reason_' + k] = arg.reasons[k].reason || ''; ui['r_memo_' + k] = arg.reasons[k].memo || ''; });
      if (arg.midMonth) ui.mid = arg.midMonth;
      if (arg.weeks45) ui.w45 = arg.weeks45;
    }
    const rows = ct18Rows(ctx), errs = {};
    rows.forEach(r => { if (r.price == null || r.price <= 0) errs[r.id] = '금액을 숫자로 넣어 주세요.'; });
    ui.p_err = errs; ui.r_err = null;
    if (Object.keys(errs).length) return;
    const reasonOf = r => ui['r_reason_' + r.id] != null ? ui['r_reason_' + r.id] : (d.reasons[r.id] || {}).reason;
    const miss = rows.find(r => r.diff != null && Math.abs(r.diff) > WARN_PCT && !reasonOf(r));
    if (miss) { ui.sel = miss.id; ui.r_err = miss.id; say('권장가에서 10% 넘게 벗어난 상품은 사유를 골라야 저장돼요.'); return; }
    rows.forEach(r => {
      if (r.price !== d.prices[r.id]) { d.history.push({ date: s.today, id: r.id, from: d.prices[r.id], to: r.price, by: ctx.persona.name }); d.prices[r.id] = r.price; }
      if (ui['r_reason_' + r.id] != null) d.reasons[r.id] = { reason: ui['r_reason_' + r.id], memo: ui['r_memo_' + r.id] || '' };
      delete ui['p_' + r.id]; delete ui['r_reason_' + r.id]; delete ui['r_memo_' + r.id];
    });
    if (ui.mid) d.midMonth = ui.mid;
    if (ui.w45) d.weeks45 = ui.w45;
    delete ui.mid; delete ui.w45;
    const locked = ct18Rows(ctx).filter(r => !r.sale.ok).map(r => shortName(r.p));
    say('저장했어요.' + (locked.length ? ' ' + locked.join(', ') + ' 상품은 판매가 잠겨 있어요.' : ' 모든 상품을 팔 수 있어요.'));
  });
  B.action('CT18.attach', (ctx, v) => { ctx.ui.e_file = v === 'off' ? '' : '교습비 변경신고 수리 통지서.pdf'; ctx.ui.e_err_file = null; });
  B.action('CT18.eduSubmit', (ctx, arg) => {
    const ui = ctx.ui, d = ct18Data(ctx.s, ctx.center);
    if (!ctx.canEdit) return;
    if (objArg(arg)) { if (arg.prod) ui.e_prod = arg.prod; if (arg.amount != null) ui.e_amount = String(arg.amount); if (arg.file) ui.e_file = arg.file === true ? '교습비 변경신고 수리 통지서.pdf' : arg.file; }
    const pid = ui.e_prod || 'pr2', amt = num(ui.e_amount);
    ui.e_err_amount = !amt ? '새 등록액을 숫자로 넣어 주세요.' : null;
    ui.e_err_file = !ui.e_file ? '교육청 등록증이나 변경신고 수리 문서를 붙여 주세요.' : null;
    if (ui.e_err_amount || ui.e_err_file) return;
    const e = d.edu[pid] = d.edu[pid] || { amount: null, status: '미등록' };
    e.pending = amt; e.proof = ui.e_file; e.status = e.amount != null ? '변경신고 중' : '확인 대기';
    ui.e_amount = ''; ui.e_file = '';
    say('신고를 올렸어요. 본사가 확인할 때까지 이 상품은 판매가 잠겨요.');
  });
  B.action('CT18.eduConfirm', (ctx, id) => {
    const d = ct18Data(ctx.s, ctx.center);
    const e = d.edu[id];
    if (e && e.pending) { e.amount = e.pending; e.status = '등록'; delete e.pending; say('본사가 수리 문서를 확인했어요. 등록액이 ' + J(won(e.amount), '으로') + ' 바뀌었어요.'); return; }
    const x = d.extras.find(y => y.id === id);
    if (x && x.pending) { x.edu = x.pending; x.status = '등록'; delete x.pending; say(x.name + ' 등록을 본사가 확인했어요.'); }
  });
  B.action('CT18.addDisc', (ctx, arg) => {
    const ui = ctx.ui, d = ct18Data(ctx.s, ctx.center);
    if (ctx.center.type === '직영' || !ctx.canEdit) return;
    if (objArg(arg)) { ui.dc_type = arg.type; ui.dc_value = arg.value; }
    const type = (ui.dc_type || '').trim(), value = (ui.dc_value || '').trim();
    const pv = pctNum(/%/.test(value) ? value : value + '%');
    ui.dc_err = !type ? '할인 유형을 넣어 주세요.' : !(pv > 0 && pv <= 100) ? '할인 값은 10%처럼 넣어 주세요.' : d.discounts.some(x => x.type === type) ? '같은 이름의 할인이 이미 있어요.' : null;
    if (ui.dc_err) return;
    d.discounts.push({ type, value: /%/.test(value) ? value : value + '%' });
    ui.dc_type = ''; ui.dc_value = '';
    say('할인을 추가했어요. 적용할 때마다 사유를 남겨요.');
  });
  B.action('CT18.delDisc', (ctx, i) => { const d = ct18Data(ctx.s, ctx.center); if (ctx.canEdit && ctx.center.type !== '직영') d.discounts.splice(Number(i), 1); });
  B.action('CT18.addExtra', (ctx, arg) => {
    const ui = ctx.ui, d = ct18Data(ctx.s, ctx.center);
    if (ctx.center.type === '직영' || !ctx.canEdit) return;
    if (objArg(arg)) { ui.ex_name = arg.name; ui.ex_amount = String(arg.amount || ''); ui.ex_edu = arg.edu != null ? String(arg.edu) : ''; }
    const name = (ui.ex_name || '').trim(), amount = num(ui.ex_amount), edu = num(ui.ex_edu);
    ui.ex_err = !name ? '항목 이름을 넣어 주세요.' : !amount ? '금액을 숫자로 넣어 주세요.' : null;
    if (ui.ex_err) return;
    d.extras.push(Object.assign({ id: 'ex' + (d.extras.length + 1) + '-' + Date.now() % 1000, name, amount, edu: null }, edu ? { status: '확인 대기', pending: edu, proof: '센터 입력' } : { status: '미등록' }));
    ui.ex_name = ''; ui.ex_amount = ''; ui.ex_edu = '';
    say(edu ? '항목을 넣었어요. 본사가 등록액을 확인하기 전까지 판매가 잠겨요.' : '항목을 넣었어요. 교육청 등록 전이라 판매가 잠겨요.');
  });
  B.action('CT18.print', ctx => {
    const rows = ct18Rows(ctx), d = ct18Data(ctx.s, ctx.center);
    const sale = rows.filter(r => r.sale.ok);
    B.modal({
      title: '교습비 게시표 (' + ctx.center.name + ')', ok: '출력', cancel: '닫기',
      body: T([{ label: '교습 과정', render: r => esc(r.p.name) }, { label: '월 교습비', num: true, render: r => won(d.prices[r.id]) }, { label: '교육청 등록액', num: true, render: r => won(r.e.amount) }], sale, { empty: '팔 수 있는 상품이 없어요.' }) +
        T([{ label: '기타경비', k: 'name' }, { label: '금액', num: true, render: x => won(x.amount) }], d.extras.filter(x => extraSale(x).ok), { empty: '받는 기타경비가 없어요.' }) +
        '<div class="small muted">판매가 잠긴 상품은 게시표에 나오지 않아요. 월중 등록은 ' + esc(ctx.center.type === '직영' ? '본사 값' : (d.midMonth + ', 4·5주 달은 ' + d.weeks45)) + '으로 적혀요.</div>',
      onOk: () => { say('게시표를 출력했어요. 센터 안 잘 보이는 곳에 붙여 주세요.'); },
    });
    return false;
  });
  B.action('CT18.ad', ctx => {
    const rows = ct18Rows(ctx).filter(r => r.sale.ok), d = ct18Data(ctx.s, ctx.center);
    const text = '브레인180 ' + ctx.center.name + ' 교습비 ' + rows.map(r => r.p.name + ' 월 ' + won(d.prices[r.id])).join(', ') + ' (교재비 별도). 교육청 등록 교습비 이하로 받아요.';
    B.modal({ title: '광고 표시 문구', ok: '복사', cancel: '닫기', body: '<textarea class="inp" readonly style="min-height:90px">' + esc(text) + '</textarea><div class="small muted">학원 광고에는 교습비를 함께 적어야 해요. 판매가 잠긴 상품은 빠져요.</div>', onOk: () => { say('광고 문구를 복사했어요.'); } });
    return false;
  });

  /* =====================================================================
     CT-19 센터 정보·운영시간·휴원일·기기 (p.64)
     ===================================================================== */
  B.extend(s => { s.ct19 = { centers: {} }; });
  function ct19Data(s, c) {
    if (!s.ct19.centers[c.id]) s.ct19.centers[c.id] = {
      hours: { wd: ['14:00', '21:30'], sat: ['10:00', '14:00'] },
      holidays: [
        { id: 'h1', from: '2027-03-01', to: '', name: '삼일절 (본사)', kind: '본사' },
        { id: 'h2', from: '2027-05-04', to: '2027-05-05', name: '센터 휴원', kind: '센터' },
        { id: 'h3', from: '2027-08-02', to: '2027-08-06', name: '본사 지정 휴원 (예시)', kind: '본사' },
      ],
      devices: [{ id: 'd1', name: '#1 입구 패드', use: '입·퇴실', date: '2027-01-02' }, { id: 'd2', name: '#2 패드', use: '입학 테스트', date: '2027-01-02' }],
      methods: ['현장 출력'], keepDays: 30, regNo: '제○○호', seq: 3,
    };
    return s.ct19.centers[c.id];
  }
  // 재등록 청구가 열리는 날(POL-24, 20일 안) 전이면 이번 달까지, 뒤면 다음 달까지 청구가 끝난 달로 봐요
  const billedUntil = today => { const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7)); if (Number(today.slice(8, 10)) < 20) return today.slice(0, 7); return m === 12 ? (y + 1) + '-01' : y + '-' + pad(m + 1); };
  function holImpact(s, c, from, to) {
    if (!from) return null;
    const end = to && to >= from ? to : from;
    const hit = {}; let sessions = 0, n = 0;
    for (let d = from; d <= end && n < 31; d = addDays(d, 1), n++) {
      const w = WD[new Date(d + 'T00:00:00').getDay()];
      s.classes.filter(k => k.center === c.id && k.days.indexOf(w) >= 0).forEach(k => { hit[k.id] = k; sessions++; });
    }
    const cls = Object.keys(hit).map(k => hit[k]);
    return { days: n, cls, sessions, students: cls.reduce((a, k) => a + k.enrolled, 0), billed: from.slice(0, 7) <= billedUntil(s.today) };
  }
  const holDate = x => md(x.from) + (x.to ? ' ~ ' + md(x.to) : '');

  B.screen({
    id: 'CT-19', side: 'ct', phase: 'P1a', devices: ['pc'], pages: [64],
    title: '센터 정보·운영시간·휴원일·기기', menuLabel: '센터 정보·휴원일', crumb: '설정 > 센터 정보·휴원일',
    headActions: ctx => h.btn('저장', { primary: true, act: 'CT19.save', disabled: !ctx.canEdit }),
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, c = ctx.center, d = ct19Data(s, c), dis = !ctx.canEdit;
      const info = h.card({
        title: '센터 정보', pin: 1, right: h.polChip('POL-15'),
        body: h.kv([['센터명', c.name + ' (' + c.type + ')'], ['시설', c.facility + ' · 일시수용능력 ' + c.facilityCap + '명'], ['교육청 등록번호', d.regNo], ['정원 상한', h.pv('POL-16', c), true]]) +
          reviewBox(h.kv([['강의실', c.rooms + '개, 실당 ' + c.roomCap + '명'], ['값 출처', '본사 시설 정보 (HQ-05)']]) + '<div class="small" style="color:#4a25a8;margin-top:6px">반 설정(CT-11)과 수강 등록(CT-07)도 이 값 하나를 읽어요.</div>', 8, 'margin-top:10px') +
          note('본사가 관리하는 값이에요. 바꾸려면 1:1 문의로 요청해요.'),
      });
      const HL = { o_wd1: '평일 여는 시간', o_wd2: '평일 닫는 시간', o_sat1: '토요일 여는 시간', o_sat2: '토요일 닫는 시간' };
      const t = (f, v) => '<input type="text" class="inp mono" data-field="' + f + '" value="' + esc(v) + '" placeholder="00:00" inputmode="numeric" aria-label="' + HL[f] + '" style="width:92px;text-align:center"' + (dis ? ' disabled' : '') + '>';
      const g = (f, i, base) => ui[f] != null && ui[f] !== '' ? ui[f] : base[i];
      const hourRow = (lab, a, b) => '<div class="row" style="flex-wrap:nowrap;gap:8px"><span class="small muted" style="width:52px">' + esc(lab) + '</span>' + a + '<span class="muted">~</span>' + b + '</div>';
      const hours = h.card({
        title: '운영시간', pin: 2, right: h.polChip('POL-17'),
        body: '<div class="stack" style="gap:8px">' +
          hourRow('평일', t('o_wd1', g('o_wd1', 0, d.hours.wd)), t('o_wd2', g('o_wd2', 1, d.hours.wd))) +
          hourRow('토요일', t('o_sat1', g('o_sat1', 0, d.hours.sat)), t('o_sat2', g('o_sat2', 1, d.hours.sat))) +
          '<div class="row" style="gap:8px"><span class="small muted" style="width:52px">상한</span><b>' + esc(c.curfew) + '</b>' + h.chip('법정', 'st-법정') + '<span class="small muted">' + esc(c.region) + ' 조례</span></div>' +
          '</div>' + errLine(ui.o_err) + note('조례 상한을 넘는 시간은 저장되지 않아요. 반 시간표(CT-11)도 같은 상한으로 검사해요.'),
      });
      const imp = ui.hol ? holImpact(s, c, ui.h_from, ui.h_to) : null;
      const holForm = ui.hol
        ? reviewBox('<div class="grid g3" style="gap:8px">' +
            h.field({ label: '시작일', type: 'date', field: 'h_from', value: ui.h_from || '', err: ui.h_err_from }) +
            h.field({ label: '끝나는 날', type: 'date', field: 'h_to', value: ui.h_to || '' }) +
            h.field({ label: '이름', field: 'h_name', value: ui.h_name != null ? ui.h_name : '센터 휴원' }) + '</div>' +
            (imp ? '<div class="small" style="margin-top:8px">그 기간 수업이 있는 반 <b>' + (imp.cls.length ? esc(imp.cls.map(k => k.name).join(', ')) + '</b>, 학생 ' + imp.students + '명, ' + imp.sessions + '회차' : '없음</b>') + '</div>' +
              (imp.billed && imp.sessions ? '<div style="margin-top:8px">' + h.alert('이미 교습비를 청구한 달이에요. 빠지는 회차를 어떻게 채울지 골라야 저장돼요.', 'review') + '<div style="margin-top:6px">' + h.opts(['보강', '다음 달 차감'], ui.h_fix || '', { act: 'CT19.fix' }) + '</div>' + errLine(ui.h_err_fix) + '</div>' : '') : '') +
            '<div class="row" style="justify-content:flex-end;margin-top:8px">' + h.btn('취소', { sm: true, act: 'CT19.holClose' }) + h.btn('휴원일 저장', { sm: true, primary: true, act: 'CT19.addHol' }) + '</div>', 7, 'margin-top:10px')
        : '<div class="row" style="justify-content:space-between;margin-top:10px;flex-wrap:nowrap;gap:8px">' + h.btn('+ 센터 휴원일', { act: 'CT19.holForm', disabled: dis }) +
          '<span class="small"' + P(7) + ' style="color:#4a25a8;padding-left:16px">청구가 끝난 달에 넣으면 보강이나 다음 달 차감을 골라요</span></div>';
      const hol = h.card({
        title: '휴원일', pin: 3, right: h.polChip('POL-20'),
        body: T([
          { label: '날짜', render: x => '<span class="mono small">' + esc(holDate(x)) + '</span>' },
          { label: '구분', render: x => esc(x.name) + (x.fix ? '<div class="small muted">' + esc((x.impact || '수업 없음') + ', ' + x.fix) + '</div>' : '') },
          { label: '회차', render: () => '제외' },
          { label: '', render: x => x.kind === '센터' && !dis ? h.btn('삭제', { sm: true, ghost: true, act: 'CT19.delHol', arg: x.id }) : '<span class="small muted">' + (x.kind === '센터' ? '' : '본사') + '</span>' },
        ], d.holidays) + holForm,
      });
      const devForm = ui.dev
        ? reviewBox('<div class="grid g3" style="gap:8px">' + h.field({ label: '기기 이름', field: 'd_name', value: ui.d_name || '', ph: '#3 상담실 패드', err: ui.d_err_name }) +
          h.field({ label: '용도', type: 'select', field: 'd_use', value: ui.d_use || '입·퇴실', options: ['입·퇴실', '입학 테스트'] }) +
          h.field({ label: '연결 코드', field: 'd_code', value: ui.d_code || '', ph: '패드 앱의 6자리', err: ui.d_err_code, hint: '1회용 코드 (예시)' }) + '</div>' +
          '<div class="row" style="justify-content:flex-end;margin-top:6px">' + h.btn('취소', { sm: true, act: 'CT19.devClose' }) + h.btn('기기 등록', { sm: true, primary: true, act: 'CT19.addDev' }) + '</div>', 10, 'margin-top:10px')
        : '<div class="small"' + P(10) + ' style="color:#4a25a8;padding-left:16px;margin-top:8px">패드 앱에 뜬 연결 코드로 등록하고, 해제할 때는 확인 창을 거쳐요</div>';
      const dev = h.card({
        title: '키오스크 기기', pin: 4, right: h.polChip('POL-39'),
        body: T([
          { label: '기기', k: 'name' }, { label: '용도', k: 'use' }, { label: '등록일', render: x => '<span class="mono small">' + esc(x.date) + '</span>' },
          { label: '', render: x => h.btn('해제', { sm: true, act: 'CT19.delDev', arg: x.id, disabled: dis }) },
        ], d.devices, { empty: '등록한 패드가 없어요. 입·퇴실 체크를 받을 수 없어요.' }) +
          '<div class="row" style="margin-top:10px;gap:8px">' + (ui.dev ? '' : h.btn('+ 기기 등록', { act: 'CT19.devForm', disabled: dis })) + '<span class="small muted">체크 방식</span>' + pvl('POL-39', c) + '</div>' + devForm,
      });
      const methods = ui.methods || d.methods;
      const keep = ui.r_keep != null && ui.r_keep !== '' ? ui.r_keep : d.keepDays;
      const result = h.card({
        title: '결과지 전달', pin: 5, right: h.polChip('POL-30'),
        body: '<div class="stack" style="gap:10px"><div>' + label('방식') + '<div class="opts">' + ['현장 출력', '이메일', '알림톡 링크', '우편'].map(m => tick(methods.indexOf(m) >= 0, m, 'CT19.method', m, dis)).join('') + '</div></div>' +
          '<div>' + label('주소 보관') + '<div class="row" style="gap:6px;flex-wrap:nowrap"><input class="inp" data-field="r_keep" aria-label="주소 보관 일수" value="' + esc(keep) + '" style="width:64px"' + (dis ? ' disabled' : '') + '><span>일</span>' + h.chip('(안)', 'st-안') + '<span class="small muted">본사 값 30일, 줄이기만 할 수 있어요</span></div>' + errLine(ui.r_err) + '</div></div>' +
          reviewBox('<div class="small" style="color:#4a25a8">우편을 고르면 주소를 받아요. 보관 기간이 끝난 주소는 자동으로 지우고 파기 대장(HQ-22)에 남겨요.</div>', 9, 'margin-top:10px;padding:8px 10px'),
      });
      const padCard = h.card({
        title: '패드', pin: 6, right: h.polChip('POL-38'),
        body: '<div class="row" style="gap:8px"><span class="small muted">공급 방식</span>' + pvl('POL-38', c) + '<span class="small muted" style="margin-left:8px">지정 사양 확인</span>' + h.btn('사양표', { sm: true, act: 'CT19.spec' }) + '</div>' +
          note('센터가 직접 살지 본사가 납품할지 아직 정하지 않았어요 (10/14 회의). 직접 구매로 정해지면 사양표와 맞는지 확인해요.'),
      });
      return '<div class="grid g2">' + info + hours + hol + dev + result + padCard + '</div>';
    },
    mount(root, ctx) { live(root, ctx, ['h_from', 'h_to']); },
    prd: {
      summary: '원장님이 센터 기본 정보, 문 여는 시간, 쉬는 날, 출석 체크용 패드를 한곳에서 정하는 화면이에요. 법과 본사 기준을 넘는 값은 저장되지 않아요.',
      who: '원장만 써요. 7쪽 권한표에서 센터 설정은 원장만 보고 고칠 수 있어요. 직영과 가맹이 같은 화면을 써요.',
      items: [
        { n: 1, t: '센터 정보', d: '시설 유형, 수용 인원, 교육청 등록번호, 정원 상한은 본사가 관리해요. 센터는 보기만 하고, 바꾸려면 1:1 문의로 요청해요. 정원 상한 15명은 (안)이에요.', pol: ['POL-15', 'POL-16'], ref: 'p.64 ①' },
        { n: 2, t: '운영시간', d: '평일과 토요일에 문 여는 시간을 정해요. 지역 조례가 정한 교습시간 상한(대치1은 22:00, 법정)을 넘기면 저장되지 않아요.', pol: ['POL-17'], ref: 'p.64 ②' },
        { n: 3, t: '휴원일', d: '본사 공휴일과 본사 지정 휴원일에 센터 휴원일을 더해요. 휴원일은 수업 회차와 총 교습시간 계산에서 빠져요.', pol: ['POL-20'], ref: 'p.64 ③' },
        { n: 4, t: '키오스크 기기', d: '입·퇴실 체크와 입학 테스트에 쓸 패드를 등록하거나 해제해요. 등록한 패드에서만 입·퇴실 체크를 받아요. 체크 방식은 번호 입력이 예시로 들어가 있어요.', pol: ['POL-39'], ref: 'p.64 ④' },
        { n: 5, t: '결과지 전달', d: '입학 테스트 결과지를 주는 방법을 본사가 허락한 보기 중에서 골라요. 주소를 보관하는 기간은 본사 값 30일(안)보다 줄이기만 할 수 있어요.', pol: ['POL-30'], ref: 'p.64 ⑤' },
        { n: 6, t: '패드', d: '패드를 센터가 직접 살지 본사가 납품할지 아직 정하지 않았어요(10/14 회의). 직접 구매로 정해지면 사양표로 지정 사양을 확인해요.', pol: ['POL-38'], ref: 'p.64 ⑥' },
        { n: 7, t: '청구가 끝난 달의 휴원일', kind: 'review', imp: 'IMP-09', d: '이미 교습비를 받은 달에 휴원일을 넣으면 받은 돈과 회차가 어긋나요. 그래서 보강과 다음 달 차감 중 하나를 꼭 고르게 하고, 그날 수업이 있는 반과 학생 수를 먼저 보여 줘요. 저장하면 그 반 보호자에게 알림톡이 나가요.', pol: ['POL-20', 'POL-24'] },
        { n: 8, t: '시설 값은 본사 값 하나만 읽어요', kind: 'review', imp: 'IMP-15', d: '같은 대치1센터인데 원문 예시는 수용 인원 30명, 반 설정(CT-11)은 24명으로 달랐어요. 본사가 HQ-05에 넣은 값 하나만 읽고, 강의실 수와 실당 정원도 함께 보여 줘요.', pol: ['POL-15', 'POL-16'] },
        { n: 9, t: '우편 선택지와 주소 자동 삭제', kind: 'review', imp: 'IMP-07', d: '원문 선택지에는 우편이 없었는데 정책(POL-30)과 입학 테스트(CT-03)에는 있어요. 우편을 보기에 넣고, 보관 기간이 끝난 주소는 자동으로 지운 뒤 파기 대장(HQ-22)에 남겨요.', pol: ['POL-30'] },
        { n: 10, t: '연결 코드로 등록하고 확인 후 해제', kind: 'review', imp: 'IMP-05', d: '원문에는 기기를 어떻게 연결하는지가 없었어요. 패드 앱에 뜬 1회용 연결 코드 6자리(예시)를 넣어야 등록돼요. 해제할 때는 확인 창을 띄우고, 마지막 입·퇴실 패드면 출결을 받을 수 없다고 먼저 알려요. 이미 들어온 입·퇴실 기록은 그대로 남아요.', pol: ['POL-39'] },
      ],
      open: [
        '정원 상한 15명은 (안)이에요. 학원으로 할지 교습소로 할지(POL-15)가 먼저 정해져야 해요.',
        '입·퇴실 체크 방식(POL-39)은 번호 입력이 예시예요. QR이나 개인 로그인도 보기에 있어요.',
        '결과지 전달 방식과 주소 보관 기간(POL-30)',
        '패드 공급 방식(POL-38). 결정 시점이 부록 A와 정책 목록에서 서로 달라요.',
        '센터당 패드 최대 대수와, 분실했을 때 해제하는 권한을 센터와 본사 중 누가 가질지',
        '센터 정보 변경을 1:1 문의로 받을 때 본사가 확인하는 방법',
      ],
      rules: ['지역 조례의 교습시간 상한을 넘겨 교습할 수 없어요(POL-17, 법정).'],
    },
  });

  B.action('CT19.save', (ctx, arg) => {
    const ui = ctx.ui, c = ctx.center, d = ct19Data(ctx.s, c);
    if (!ctx.canEdit) return;
    if (objArg(arg)) Object.assign(ui, arg);
    const v = k => ui[k] != null && ui[k] !== '' ? ui[k] : null;
    const wd = [v('o_wd1') || d.hours.wd[0], v('o_wd2') || d.hours.wd[1]], sat = [v('o_sat1') || d.hours.sat[0], v('o_sat2') || d.hours.sat[1]];
    const cur = c.curfew || '22:00';
    ui.o_err = null; ui.r_err = null;
    const hm = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (![wd[0], wd[1], sat[0], sat[1]].every(x => hm.test(x))) ui.o_err = '시간은 14:00처럼 24시간 형식으로 넣어 주세요.';
    else if (wd[0] >= wd[1] || sat[0] >= sat[1]) ui.o_err = '끝나는 시간이 여는 시간보다 늦어야 해요.';
    else if (wd[1] > cur || sat[1] > cur) ui.o_err = '지역 조례의 교습시간 상한보다 늦어서 저장할 수 없어요 (상한 ' + cur + ').';
    const keep = num(v('r_keep') != null ? v('r_keep') : d.keepDays);
    const methods = ui.methods || d.methods;
    if (!keep || keep < 1) ui.r_err = '보관 기간을 1일 이상으로 넣어 주세요.';
    else if (keep > 30) ui.r_err = '본사 값 30일(안)보다 길게 할 수 없어요. 줄이기만 할 수 있어요.';
    else if (!methods.length) ui.r_err = '결과지 전달 방식을 하나 이상 골라 주세요.';
    if (ui.o_err || ui.r_err) return;
    d.hours = { wd, sat }; d.keepDays = keep; d.methods = methods.slice();
    ['o_wd1', 'o_wd2', 'o_sat1', 'o_sat2', 'r_keep', 'methods'].forEach(k => { delete ui[k]; });
    say('저장했어요. 운영시간과 결과지 설정이 바로 반영돼요.');
  });
  B.action('CT19.method', (ctx, m) => {
    const d = ct19Data(ctx.s, ctx.center);
    const cur = (ctx.ui.methods || d.methods).slice(), i = cur.indexOf(m);
    if (i >= 0) cur.splice(i, 1); else cur.push(m);
    ctx.ui.methods = cur;
  });
  B.action('CT19.holForm', ctx => { Object.assign(ctx.ui, { hol: true, h_from: '', h_to: '', h_name: '센터 휴원', h_fix: '', h_err_from: null, h_err_fix: null }); });
  B.action('CT19.holClose', ctx => { ctx.ui.hol = false; });
  B.action('CT19.fix', (ctx, v) => { ctx.ui.h_fix = v; ctx.ui.h_err_fix = null; });
  B.action('CT19.addHol', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui, c = ctx.center, d = ct19Data(s, c);
    if (!ctx.canEdit) return;
    if (objArg(arg)) { ui.hol = true; ui.h_from = arg.from || ''; ui.h_to = arg.to || ''; if (arg.name) ui.h_name = arg.name; if (arg.fix) ui.h_fix = arg.fix; }
    const from = ui.h_from || '', to = ui.h_to || '';
    ui.h_err_from = !from ? '시작일을 골라 주세요.' : from < s.today ? '지난 날짜에는 휴원일을 넣을 수 없어요.' : to && to < from ? '끝나는 날이 시작일보다 앞이에요.' :
      d.holidays.some(x => from <= (x.to || x.from) && (to || from) >= x.from) ? '이미 휴원일로 들어 있는 날이 있어요.' : null;
    ui.h_err_fix = null;
    if (ui.h_err_from) return;
    const imp = holImpact(s, c, from, to);
    if (imp.billed && imp.sessions && !ui.h_fix) { ui.h_err_fix = '보강과 다음 달 차감 중 하나를 골라 주세요.'; return; }
    const fix = imp.billed && imp.sessions ? ui.h_fix : '';
    d.holidays.push({ id: 'h' + (++d.seq), from, to: to && to > from ? to : '', name: (ui.h_name || '센터 휴원').trim(), kind: '센터', fix, impact: imp.cls.map(k => k.name).join(', ') });
    d.holidays.sort((a, b) => a.from < b.from ? -1 : 1);
    ui.hol = false;
    say('휴원일을 넣었어요. 회차 계산에서 빠져요.' + (imp.cls.length ? ' 해당 반 보호자 ' + imp.students + '명에게 알림톡이 나가요.' + (fix ? ' 빠진 ' + imp.sessions + '회차는 ' + J(fix, '으로') + ' 처리해요.' : '') : ''));
  });
  B.action('CT19.delHol', (ctx, id) => { const d = ct19Data(ctx.s, ctx.center); if (ctx.canEdit) d.holidays = d.holidays.filter(x => !(x.id === id && x.kind === '센터')); });
  B.action('CT19.devForm', ctx => { Object.assign(ctx.ui, { dev: true, d_name: '', d_use: '입·퇴실', d_code: '', d_err_name: null, d_err_code: null }); });
  B.action('CT19.devClose', ctx => { ctx.ui.dev = false; });
  B.action('CT19.addDev', (ctx, arg) => {
    const ui = ctx.ui, d = ct19Data(ctx.s, ctx.center);
    if (!ctx.canEdit) return;
    if (objArg(arg)) { ui.dev = true; ui.d_name = arg.name || ''; ui.d_use = arg.use || '입·퇴실'; ui.d_code = arg.code || ''; }
    const name = (ui.d_name || '').trim(), code = String(ui.d_code || '').trim();
    ui.d_err_name = !name ? '기기 이름을 넣어 주세요.' : d.devices.some(x => x.name === name) ? '같은 이름의 기기가 있어요.' : null;
    ui.d_err_code = !/^\d{6}$/.test(code) ? '패드 앱에 뜬 연결 코드 6자리를 넣어 주세요.' : null;
    if (ui.d_err_name || ui.d_err_code) return;
    d.devices.push({ id: 'd' + (d.devices.length + 1) + '-' + code.slice(-2), name, use: ui.d_use || '입·퇴실', date: ctx.s.today });
    ui.dev = false;
    say(J(name, '을', '를') + ' 등록했어요. 이 패드에서 ' + (ui.d_use === '입학 테스트' ? '입학 테스트를' : '입·퇴실 체크를') + ' 받아요.');
  });
  B.action('CT19.delDev', (ctx, arg) => {
    const d = ct19Data(ctx.s, ctx.center);
    if (!ctx.canEdit) return;
    const id = objArg(arg) ? arg.id : arg;
    const dev = d.devices.find(x => x.id === id); if (!dev) return;
    const doit = () => { d.devices = d.devices.filter(x => x.id !== id); say(dev.name + ' 연결을 해제했어요. 이제 이 패드로는 체크를 받지 않아요.'); };
    if (objArg(arg)) { doit(); return; }
    const last = dev.use === '입·퇴실' && d.devices.filter(x => x.use === '입·퇴실').length === 1;
    B.modal({
      title: '기기 해제', ok: '해제', onOk: () => { doit(); },
      body: '<p style="margin:0">' + esc(dev.name) + ' (' + esc(dev.use) + ') 연결을 해제할까요?</p>' + (last ? h.alert('입·퇴실 패드가 하나도 남지 않아요. 새 패드를 등록하기 전까지 출결 체크를 받을 수 없어요.', 'warn') : '') + '<p class="small muted" style="margin:0">이미 들어온 입·퇴실 기록은 그대로 남아요.</p>',
    });
    return false;
  });
  B.action('CT19.spec', () => {
    B.modal({ title: '패드 지정 사양', cancel: '닫기', body: h.kv([['공급 방식', pvl('POL-38'), true], ['지정 사양', '정책이 정해지면 본사가 올려요']]) + '<div class="small muted">직접 구매로 정해지면 화면 크기, 운영체제, 카메라처럼 키오스크와 입학 테스트에 필요한 조건을 이 표로 확인해요.</div>' });
    return false;
  });

  /* =====================================================================
     CT-20 교직원 계정 (p.65)
     ===================================================================== */
  const LEGAL = { '원장': '교습자', '실장·데스크': '직원', '교사': '강사', '보조교사': '보조' };
  B.extend(s => {
    s.ct20 = {
      meta: {
        st1: { legal: '교습자', docs: true, edu: '이수', agency: '관할 경찰서', clear: true },
        st2: { legal: '직원', docs: false, edu: '이수', agency: '관할 경찰서', clear: true },
        st3: { legal: '강사', docs: true, edu: '이수', agency: '관할 경찰서', clear: true },
        st4: { legal: '강사', docs: true, edu: '이수', agency: '관할 경찰서', clear: true },
        st5: { legal: '보조', docs: true, edu: '미이수', agency: '', clear: false },
        st6: { legal: '교습자', docs: true, edu: '이수', agency: '관할 경찰서', clear: true },
        st7: { legal: '보조', docs: true, edu: '이수', agency: '관할 경찰서', clear: true },
        st8: { legal: '교습자', docs: true, edu: '이수', agency: '관할 경찰서', clear: true },
        st9: { legal: '직원', docs: false, edu: '이수', agency: '관할 경찰서', clear: true },
      },
      retired: {},
    };
  });
  function meta(s, st) { return s.ct20.meta[st.id] = s.ct20.meta[st.id] || { legal: LEGAL[st.role] || '직원', docs: false, edu: '미이수', agency: '', clear: !!st.check }; }
  const isOut = st => /퇴사/.test(st.status || '');
  function canTeach(s, st) {
    const m = meta(s, st);
    if (isOut(st)) return { ok: false, why: '퇴사' };
    if (!st.check) return { ok: false, why: '경력 조회 전' };
    if (m.legal === '직원') return { ok: false, why: '직원 구분' };
    if ((m.legal === '강사' || m.legal === '보조') && (!st.notified || st.notified === '-')) return { ok: false, why: '교육청 통보일 없음' };
    return { ok: true, why: '' };
  }
  // 반·시간표(CT-11) 같은 다른 화면에서 쓸 수 있게 열어 둬요
  B.staffCanTeach = function (staffId, store) { const s = store || B.store; const st = (s.staff || []).find(x => x.id === staffId || x.name === staffId); return st ? canTeach(s, st) : { ok: false, why: '교직원 명단에 없음' }; };
  const acctChip = st => /^활성/.test(st.status) ? h.chip('활성', 'ok') : isOut(st) ? h.chip('비활성', 'p2') : h.chip('잠김', 'bad');

  B.screen({
    id: 'CT-20', side: 'ct', phase: 'P1a', devices: ['pc'], pages: [65],
    title: '교직원 계정', menuLabel: '교직원 계정', crumb: '설정 > 교직원 계정',
    headActions: ctx => h.btn('+ 교직원 등록', { primary: true, act: 'CT20.new', disabled: !ctx.canEdit }),
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, c = ctx.center, dis = !ctx.canEdit;
      const staff = s.staff.filter(x => x.center === c.id);
      const table = T([
        { label: '이름', render: st => '<b>' + esc(st.name) + '</b>' },
        { label: '역할', k: 'role' },
        { label: '구분', render: st => esc(meta(s, st).legal) },
        { label: '자격 서류', render: st => meta(s, st).docs ? h.btn('보기', { sm: true, act: 'CT20.docs', arg: st.id }) : '<span class="muted">-</span>' },
        { head: hp('경력 조회일', 2), render: st => st.check ? '<span class="mono small">' + esc(st.check) + '</span>' : h.chip('조회 전', 'bad') },
        { label: '교육청 통보', render: st => st.notified && st.notified !== '-' ? '<span class="mono small">' + esc(st.notified) + '</span>' : '<span class="muted">-</span>' },
        { label: '필수 교육', render: st => meta(s, st).edu === '이수' ? '이수' : h.chip('미이수', 'warn') },
        { label: '계정', render: st => acctChip(st) + '<div class="small muted">2단계 ' + (st.twoFactor ? '사용' : '미사용') + '</div>' },
        { label: '수업 배치', render: st => { const t = canTeach(s, st); return t.ok ? h.chip('가능', 'ok') : h.chip('불가', 'bad') + '<div class="small muted">' + esc(t.why) + '</div>'; } },
        { head: hp('관리', 8), render: st => isOut(st) ? '<span class="small muted">퇴사 ' + esc(md(s.ct20.retired[st.id] || '')) + '</span>'
          : h.btn('수정', { sm: true, act: 'CT20.edit', arg: st.id, disabled: dis }) + ' ' + (st.role === '원장' ? h.btn('퇴사', { sm: true, disabled: true, title: '원장 계정은 본사(HQ-05)에서 바꿔요' }) : h.btn('퇴사', { sm: true, danger: true, act: 'CT20.retire', arg: st.id, disabled: dis })) },
      ], staff, { rowAttr: st => st.id === ui.editId ? ' class="sel"' : '' });
      const nOk = staff.filter(x => canTeach(s, x).ok).length;
      let html = h.card({ title: '교직원', sub: staff.length + '명, 수업 배치 가능 ' + nOk + '명', pin: 1, body: table });
      html += '<div class="grid g2" style="align-items:start;margin-top:12px">' + (ui.form !== false ? staffForm(ctx) : '') + '<div class="stack">' + shopCard(ctx) + assignCard(ctx) + '</div></div>';
      html += '<div class="row"' + P(5) + ' style="gap:8px;margin-top:12px;padding:9px 12px;background:#fff;border:1px solid var(--line);border-radius:8px"><b class="small">계정 보안</b>' +
        h.chip('2단계 인증 원장 필수', 'navy') + h.chip('실장과 교사는 본사 설정에 따라 선택', '') + '<span class="small muted">퇴사하면 바로 비활성으로 바뀌고 접속 기록은 남아요 (CM-01).</span></div>';
      return html;
    },
    mount(root, ctx) { live(root, ctx, ['f_role', 'a_staff', 'a_cls'], f => { if (f === 'f_role') ctx.ui.f_legal = LEGAL[ctx.ui.f_role]; if (f !== 'f_role') ctx.ui.a_msg = null; }); },
    prd: {
      summary: '원장님이 센터에서 일하는 선생님과 직원의 계정을 만들고 관리하는 화면이에요. 성범죄와 아동학대 경력을 조회한 날이 있어야 계정이 열려요.',
      who: '원장만 써요. 7쪽 권한표에서 교직원 계정 메뉴는 원장만 보고 고칠 수 있어요. 원장 계정을 바꾸거나 막는 일은 본사(HQ-05)가 해요.',
      items: [
        { n: 1, t: '교직원 목록', d: '역할(원장, 실장, 교사, 보조교사)과 법에서 쓰는 구분(교습자, 강사, 보조, 직원)을 따로 관리해요. 자격 서류, 경력 조회일, 교육청 통보일, 필수 교육, 계정 상태를 한 줄에서 봐요.', ref: 'p.65 ①' },
        { n: 2, t: '경력 조회', d: '보조요원까지 일하는 사람 모두 성범죄와 아동학대 경력 조회일이 있어야 계정이 열려요. 강사와 보조요원을 뽑으면 교육청에 알려야 해서 통보일도 남겨요.', ref: 'p.65 ②' },
        { n: 3, t: '등록', d: '이름, 역할, 구분, 경력 조회, 필수 교육 이수 여부를 넣어 교직원을 등록해요. 교육과 인증 관리는 확대 단계(HQ-25)에서 붙여요.', ref: 'p.65 ③', reveal: 'CT20.new' },
        { n: 4, t: '교습소 제한', d: '교습소 센터는 교습자 1명과 보조요원 1명까지만 등록돼요(법정). 강사는 둘 수 없어서 저장을 막아요. 학원인 대치1센터는 해당 없어요.', pol: ['POL-15'], ref: 'p.65 ④' },
        { n: 5, t: '계정 보안', d: '원장은 2단계 인증을 꼭 써요. 실장과 교사는 본사 설정에 따라 골라요. 퇴사하면 바로 계정을 막고 접속 기록은 남겨요(CM-01).', ref: 'p.65 ⑤' },
        { n: 6, t: '경력 조회 전에는 수업 배치 금지', kind: 'review', imp: 'IMP-16', d: '로그인만 막으면 조회 전 선생님이 반에 들어갈 수 있었어요. 조회일이 있고, 강사와 보조는 교육청 통보일도 있어야 수업 배치 가능이 돼요. 직원 구분인 사람도 수업에 넣을 수 없어요. 반 설정(CT-11)의 교사 목록도 같은 규칙으로 가능인 사람만 보여 줘야 해요.' },
        { n: 7, t: '조회 결과 원본은 올리지 않아요', kind: 'review', imp: 'IMP-16', reveal: 'CT20.new', d: '범죄 경력 자료는 민감한 정보라서 파일을 받지 않아요. 조회일, 조회한 곳, 결격 사유 없음 확인, 확인한 사람만 기록해요. 본사와 제출 서류(CT-17)에는 조회를 마쳤는지만 보여요.' },
        { n: 8, t: '휴대폰, 초대 문자, 퇴사 처리', kind: 'review', imp: 'IMP-14', d: '등록할 때 휴대폰 번호를 받아 초대 문자를 보내요. 목록의 퇴사 버튼을 누르면 바로 로그아웃되고 계정이 막히며, 기억한 기기도 풀려요. 접속 기록은 그대로 남아요. 원장 계정은 본사가 바꿔요.' },
      ],
      open: [
        '실장과 교사에게 2단계 인증을 꼭 쓰게 할지 본사 기본값',
        '역할과 법적 구분을 짝짓는 규칙. 지금은 등록 창에서 역할을 고르면 원장 교습자, 실장 직원, 교사 강사, 보조교사 보조가 기본값으로 채워지고 예외일 때만 바꿔요(검토 제안).',
        '경력 조회를 몇 년마다 다시 할지',
        '교육청 통보 대상이 강사만인지 보조요원까지인지, 퇴사할 때도 알리는지',
        '교습소에서 직원 계정을 허용할지',
        '필수 교육 과정과 이수 관리 방식(P2, HQ-25)',
      ],
      rules: ['학원 종사자는 성범죄와 아동학대 경력을 조회해야 해요(법정, 조회 시점은 법무 확인).', '교습소는 교습자 1명과 보조요원 1명까지만 둘 수 있어요(법정).'],
    },
  });

  function staffForm(ctx) {
    const ui = ctx.ui, e = ui.f_err || {}, dis = !ctx.canEdit;
    const ed = ui.editId ? ctx.s.staff.find(x => x.id === ui.editId) : null;
    const role = ui.f_role || '보조교사', legal = ui.f_legal || LEGAL[role];
    return h.card({
      title: ed ? '교직원 정보 수정' : '교직원 등록', sub: ed ? ed.name : '', pin: 3, right: h.btn('닫기', { sm: true, act: 'CT20.close' }),
      body: '<div class="grid g2" style="gap:10px">' +
        h.field({ label: '이름', req: true, field: 'f_name', value: ui.f_name || '', err: e.name, disabled: dis }) +
        h.field({ label: '역할', req: true, type: 'select', field: 'f_role', value: role, options: ['원장', '실장·데스크', '교사', '보조교사'], disabled: dis || (ed && ed.role === '원장') }) +
        '<div class="field"><label>구분</label>' + h.opts(['교습자', '강사', '보조', '직원'], legal, { act: 'CT20.legal' }) + (e.legal ? '<div class="err">' + esc(e.legal) + '</div>' : '') + '</div>' +
        h.field({ label: '휴대폰', req: true, field: 'f_phone', value: ui.f_phone || '', ph: '010-0000-0000', err: e.phone, hint: '초대 문자가 이 번호로 가요', disabled: dis }) +
        '</div>' +
        reviewBox('<div class="small" style="font-weight:700;color:var(--review);margin-bottom:6px">경력 조회 (성범죄·아동학대)</div><div class="grid g3" style="gap:8px">' +
          h.field({ label: '조회일', type: 'date', field: 'f_check', value: ui.f_check || '', err: e.check, disabled: dis }) +
          h.field({ label: '조회한 곳', type: 'select', field: 'f_agency', value: ui.f_agency || '관할 경찰서', options: ['관할 경찰서', '그 밖의 기관'], disabled: dis }) +
          h.field({ label: '교육청 통보일', type: 'date', field: 'f_notified', value: ui.f_notified || '', hint: '강사와 보조는 있어야 수업 배치', disabled: dis }) + '</div>' +
          check('f_clear', !!ui.f_clear, '조회 결과 결격 사유가 없음을 확인했어요 (확인자 ' + ctx.persona.name + ')', { disabled: dis }) + errLine(e.clear) +
          '<div class="small muted" style="margin-top:6px">조회 결과 파일은 올리지 않아요. 본사와 제출 서류(CT-17)에는 조회를 마쳤는지만 보여요.</div>', 7, 'margin-top:12px') +
        '<div class="row" style="gap:12px;margin-top:10px;align-items:flex-end;flex-wrap:nowrap"><div style="width:160px;flex:none">' + h.field({ label: '필수 교육', type: 'select', field: 'f_edu', value: ui.f_edu || '미이수', options: ['미이수', '이수'], hint: 'P2에 HQ-25와 연동', disabled: dis }) + '</div>' +
        '<div style="flex:1"></div><div style="padding-bottom:18px">' + h.btn(ed ? '수정 저장' : '저장하고 초대 문자 보내기', { primary: true, act: 'CT20.save', disabled: dis }) + '</div></div>',
    });
  }
  function shopCard(ctx) {
    const s = ctx.s, c = ctx.center, shop = c.facility === '교습소';
    let body = '<div>교습소는 교습자(원장) 1명과 보조요원 1명까지만 등록돼요. 강사는 둘 수 없어요.</div>';
    if (shop) {
      const act = s.staff.filter(x => x.center === c.id && !isOut(x));
      const n = l => act.filter(x => meta(s, x).legal === l).length;
      body += '<div style="margin-top:8px">' + h.kv([['교습자', n('교습자') + ' / 1명'], ['보조요원', n('보조') + ' / 1명'], ['강사', n('강사') + ' / 0명']]) + '</div>';
    } else body += note('이 센터는 ' + c.facility + '이라 해당 없어요.');
    return h.card({ title: '교습소 센터 제한', pin: 4, right: h.polChip('POL-15'), body });
  }
  function assignCard(ctx) {
    const s = ctx.s, c = ctx.center, ui = ctx.ui;
    const staff = s.staff.filter(x => x.center === c.id && !isOut(x)), cls = s.classes.filter(k => k.center === c.id);
    if (!cls.length || !staff.length) return h.card({ title: '수업 배치 확인', pin: 6, body: h.empty('이 센터에는 아직 반이 없어요.') });
    const sid = ui.a_staff || (staff.find(x => !x.check) || staff.find(x => !canTeach(s, x).ok) || staff[0]).id;
    const kid = ui.a_cls || cls[cls.length - 1].id;
    const as = ui.a_as || '보조';
    const msg = ui.a_msg;
    return h.card({
      title: '수업 배치 확인', sub: '반·시간표(CT-11)와 같은 규칙', pin: 6,
      body: '<div class="grid g2" style="gap:8px">' +
        h.field({ label: '교직원', type: 'select', field: 'a_staff', value: sid, options: staff.map(x => { const t = canTeach(s, x); return { v: x.id, l: x.name + ' (' + (t.ok ? '가능' : '불가, ' + t.why) + ')' }; }) }) +
        h.field({ label: '반', type: 'select', field: 'a_cls', value: kid, options: cls.map(k => ({ v: k.id, l: k.name + ' ' + k.time })) }) + '</div>' +
        '<div class="row" style="justify-content:space-between;margin-top:8px">' + h.opts(['담당 교사', '보조'], as, { act: 'CT20.as' }) + h.btn('반에 넣기', { act: 'CT20.assign', disabled: !ctx.canEdit }) + '</div>' +
        (msg ? '<div style="margin-top:8px">' + h.alert(msg.text, msg.ok ? 'ok' : 'bad') + '</div>' : ''),
    });
  }

  B.action('CT20.new', ctx => {
    const ui = ctx.ui;
    ['f_name', 'f_phone', 'f_check', 'f_notified', 'f_agency', 'f_edu'].forEach(k => { ui[k] = ''; });
    Object.assign(ui, { form: true, editId: null, f_role: '보조교사', f_legal: '보조', f_clear: false, f_err: {} });
  });
  B.action('CT20.close', ctx => { ctx.ui.form = false; ctx.ui.editId = null; ctx.ui.f_err = {}; });
  B.action('CT20.legal', (ctx, v) => { ctx.ui.f_legal = v; });
  B.action('CT20.as', (ctx, v) => { ctx.ui.a_as = v; ctx.ui.a_msg = null; });
  B.action('CT20.edit', (ctx, id) => {
    const s = ctx.s, st = s.staff.find(x => x.id === id); if (!st) return;
    const m = meta(s, st);
    Object.assign(ctx.ui, { form: true, editId: id, f_name: st.name, f_role: st.role, f_legal: m.legal, f_phone: st.phone || '', f_check: st.check || '', f_notified: st.notified && st.notified !== '-' ? st.notified : '', f_agency: m.agency || '관할 경찰서', f_clear: !!m.clear, f_edu: m.edu, f_err: {} });
  });
  B.action('CT20.save', (ctx, arg) => {
    const s = ctx.s, c = ctx.center, ui = ctx.ui;
    if (!ctx.canEdit) return;
    if (objArg(arg)) {
      if (arg.id && arg.id !== ui.editId) B.actions['CT20.edit'](ctx, arg.id);
      Object.keys(arg).forEach(k => { if (k !== 'id') ui[k.indexOf('f_') === 0 ? k : 'f_' + k] = arg[k]; });
      if (arg.role && !arg.legal && !arg.f_legal) ui.f_legal = LEGAL[arg.role];
    }
    const ed = ui.editId ? s.staff.find(x => x.id === ui.editId) : null;
    const role = ui.f_role || '보조교사', legal = ui.f_legal || LEGAL[role];
    const e = {};
    const name = String(ui.f_name || '').trim();
    if (!name) e.name = '이름을 넣어 주세요.';
    const phone = String(ui.f_phone || '').trim();
    if (!/^01[016789]-?\d{3,4}-?\d{4}$/.test(phone)) e.phone = '휴대폰 번호를 010-0000-0000 모양으로 넣어 주세요.';
    const chk = ui.f_check || '';
    if (chk && chk > s.today) e.check = '조회일은 오늘보다 뒤일 수 없어요.';
    if (chk && !ui.f_clear) e.clear = '결격 사유가 없음을 확인했는지 체크해 주세요.';
    if (c.facility === '교습소') {
      const others = s.staff.filter(x => x.center === c.id && x.id !== ui.editId && !isOut(x));
      const cnt = l => others.filter(x => meta(s, x).legal === l).length;
      if (legal === '강사') e.legal = '교습소에는 강사를 둘 수 없어요.';
      else if (legal === '교습자' && cnt('교습자') >= 1) e.legal = '교습소는 교습자를 1명만 둘 수 있어요.';
      else if (legal === '보조' && cnt('보조') >= 1) e.legal = '교습소는 보조요원을 1명까지만 둘 수 있어요.';
    }
    ui.f_err = e;
    if (Object.keys(e).length) return;
    let st = ed;
    if (!st) {
      const next = Math.max.apply(null, s.staff.map(x => num(x.id) || 0)) + 1;
      st = { id: 'st' + next, center: c.id, name, role, check: '', twoFactor: false, phone, status: '', notified: '-' };
      s.staff.push(st);
    }
    Object.assign(st, { name, role: ed && ed.role === '원장' ? '원장' : role, check: chk, phone, notified: ui.f_notified || '-' });
    st.status = chk ? '활성' : '잠김 (경력 조회 전)';
    Object.assign(meta(s, st), { legal, edu: ui.f_edu || '미이수', agency: chk ? (ui.f_agency || '관할 경찰서') : '', clear: !!ui.f_clear, by: chk ? ctx.persona.name : '' });
    const t = canTeach(s, st);
    ui.form = false; ui.editId = null;
    say((ed ? name + ' 님 정보를 고쳤어요.' : name + ' 님을 등록하고 초대 문자를 보냈어요.') + (chk ? ' 계정이 열렸어요.' : ' 경력 조회일을 넣기 전까지 계정은 잠겨 있어요.') + (chk && !t.ok ? ' 수업 배치는 아직 안 돼요 (' + t.why + ').' : ''));
  });
  B.action('CT20.retire', (ctx, arg) => {
    const s = ctx.s;
    if (!ctx.canEdit) return;
    const id = objArg(arg) ? arg.id : arg;
    const st = s.staff.find(x => x.id === id); if (!st || st.role === '원장' || isOut(st)) return;
    const doit = date => {
      st.status = '비활성 (퇴사)'; st.twoFactor = false; s.ct20.retired[id] = date;
      const mine = s.classes.filter(k => k.center === st.center && (k.teacher === st.name || k.assistant === st.name)).map(k => k.name);
      say(st.name + ' 님을 퇴사 처리했어요. 바로 로그아웃되고 기억한 기기도 풀렸어요. 접속 기록은 남아요.' + (mine.length ? ' 맡은 반 ' + mine.join(', ') + '의 담당을 바꿔 주세요.' : ''));
    };
    if (objArg(arg)) { doit(arg.date || s.today); return; }
    B.modal({
      title: '퇴사 처리', ok: '퇴사 처리',
      body: '<p style="margin:0">' + esc(st.name) + ' (' + esc(st.role) + ') 님을 퇴사 처리할까요?</p>' + h.field({ label: '퇴사일', type: 'date', value: s.today, id: 'ct20-retire-date' }) + '<p class="small muted" style="margin:0">누르면 바로 로그아웃되고 계정이 막혀요. 접속 기록은 그대로 남아요.</p>',
      onOk: back => { const el = back.querySelector('#ct20-retire-date'); doit((el && el.value) || s.today); },
    });
    return false;
  });
  B.action('CT20.docs', (ctx, id) => {
    const st = ctx.s.staff.find(x => x.id === id); if (!st) return false;
    B.modal({ title: '자격 서류 (' + st.name + ')', cancel: '닫기', body: h.kv([['구분', meta(ctx.s, st).legal], ['서류', '자격증 사본 (예시 파일)']]) + '<div class="small muted">원장만 열 수 있고, 열 때마다 기록이 남아요. 경력 조회 결과는 여기에 올리지 않아요.</div>' });
    return false;
  });
  B.action('CT20.assign', (ctx, arg) => {
    const s = ctx.s, c = ctx.center, ui = ctx.ui;
    if (!ctx.canEdit) return;
    if (objArg(arg)) { if (arg.staff) ui.a_staff = arg.staff; if (arg.cls) ui.a_cls = arg.cls; if (arg.as) ui.a_as = arg.as; }
    const staff = s.staff.filter(x => x.center === c.id && !isOut(x)), cls = s.classes.filter(k => k.center === c.id);
    const st = staff.find(x => x.id === ui.a_staff) || staff.find(x => !x.check) || staff.find(x => !canTeach(s, x).ok) || staff[0];
    const k = cls.find(x => x.id === ui.a_cls) || cls[cls.length - 1];
    if (!st || !k) return;
    ui.a_staff = st.id; ui.a_cls = k.id;
    const as = ui.a_as || '보조', t = canTeach(s, st);
    if (!t.ok) { ui.a_msg = { ok: false, text: st.name + ' 님은 수업에 넣을 수 없어요 (' + t.why + '). 조건을 채우면 바로 넣을 수 있어요.' }; return; }
    if (as === '보조') k.assistant = st.name; else k.teacher = st.name;
    ui.a_msg = { ok: true, text: k.name + ' ' + (as === '보조' ? '보조' : '담당 교사') + '로 ' + st.name + ' 님을 넣었어요. 반·시간표(CT-11)에 바로 보여요.' };
  });

  /* =====================================================================
     CT-21 센터 통계 (p.66, P2)
     ===================================================================== */
  B.extend(s => {
    s.ct21 = {
      // 월말 자동 저장 기록 (모두 예시). 1~3월 퇴원 합계 8명은 퇴원 사유 5, 2, 1과 맞춰요.
      months: { daechi1: [{ m: '1월', active: 104, add: 105, out: 1, saved: '01-31 23:59' }, { m: '2월', active: 122, add: 22, out: 4, saved: '02-28 23:59' }, { m: '3월', active: 128, add: 9, out: 3, saved: '' }] },
      attend: { c1: [94, 40], c2: [91, 35], c3: [88, 52], c4: [92, 30], c5: [85, 45] },
      reasons: { daechi1: [['학원 일정 겹침', 5], ['이사', 2], ['비용', 1], ['학습 효과', 0], ['기타 (메모)', 0]] },
    };
  });
  function monthsOf(s, c) {
    if (s.ct21.months[c.id]) return s.ct21.months[c.id];
    if (!c.opened || c.opened === '-' || c.opened > s.today) return [];
    return [{ m: Number(s.today.slice(5, 7)) + '월', active: c.students, add: c.students, out: 0, saved: '' }];
  }
  const METRIC = { '재원생': 'active', '신규': 'add', '퇴원': 'out' };

  B.screen({
    id: 'CT-21', side: 'ct', phase: 'P2', devices: ['pc'], pages: [66],
    title: '센터 통계', menuLabel: '센터 통계', crumb: '센터 통계',
    headActions: ctx => '<div style="width:150px">' + h.field({ type: 'select', field: 'period', value: ctx.ui.period || '2027 상반기', options: ['2027 상반기', '2027 1분기'] }) + '</div>',
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, c = ctx.center;
      const data = monthsOf(s, c);
      const slots = (ui.period === '2027 1분기' ? [1, 2, 3] : [1, 2, 3, 4, 5, 6]).map(n => n + '월');
      const metric = ui.metric || '재원생', key = METRIC[metric];
      const max = Math.max(1, ...data.map(x => x[key]));
      const selM = data.find(x => x.m === ui.month) || data[data.length - 1];
      const bars = '<div style="display:flex;align-items:flex-end;gap:6px;height:128px;margin-top:10px">' + slots.map(m => {
        const x = data.find(y => y.m === m);
        if (!x) return '<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:3px;height:100%"><i style="display:block;width:100%;height:18px;border:1px dashed #cfd4dc;border-radius:4px 4px 0 0"></i><span class="small muted">' + m + '</span></div>';
        const on = selM && selM.m === m, hgt = Math.max(4, Math.round(x[key] / max * 88));
        return '<button type="button" data-act="CT21.month" data-arg="' + m + '" title="' + m + ' ' + metric + ' ' + x[key] + '명" style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:3px;height:100%;background:none;border:0;padding:0">' +
          '<span class="small" style="font-weight:700">' + x[key] + '</span><i style="display:block;width:100%;height:' + hgt + 'px;background:' + (on ? 'var(--navy)' : '#a9b8dd') + ';border-radius:4px 4px 0 0"></i><span class="small' + (on ? '' : ' muted') + '" style="' + (on ? 'font-weight:700' : '') + '">' + m + '</span></button>';
      }).join('') + '</div>';
      const card1 = h.card({
        title: '재원생 추이', pin: 1, right: h.opts(['재원생', '신규', '퇴원'], metric, { act: 'CT21.metric' }),
        body: data.length ? bars + '<div class="small" style="margin-top:8px">' + esc(selM.m) + (selM.saved ? ' 말' : ' (' + md(s.today) + ' 기준)') + ' 재원생 <b>' + selM.active + '명</b>, 신규 ' + selM.add + '명, 퇴원 ' + selM.out + '명 <span class="muted">(예시)</span></div>'
          : h.empty('이 센터는 ' + (c.opened && c.opened !== '-' ? c.opened + '에 문을 열어' : '아직 문을 열지 않아') + ' 쌓인 통계가 없어요.'),
      });
      const am = ui.att || '출석률', ai = am === '출석률' ? 0 : 1;
      const cls = s.classes.filter(k => k.center === c.id);
      const card2 = h.card({
        title: '출석률', pin: 2, right: h.opts(['출석률', '보강 사용률'], am, { act: 'CT21.att' }),
        body: cls.length ? '<div class="stack" style="gap:7px;margin-top:4px">' + cls.map(k => { const v = (s.ct21.attend[k.id] || [])[ai]; return '<div><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><span class="small"><b>' + esc(k.name) + '</b> <span class="muted">' + esc(k.time) + '</span></span><span class="small" style="font-weight:700">' + (v != null ? v + '%' : '-') + '</span></div>' + h.bar(v || 0, { color: ai ? '#7a8fc9' : null }) + '</div>'; }).join('') + '</div>' +
          note(ai ? '보강 규칙(POL-22)이 미정이라 계산식도 아직 정하지 않았어요. 값은 예시예요.' : '반과 타임별 3월 출석률이에요 (예시).')
          : h.empty('이 센터에는 아직 반이 없어요.'),
      });
      const rs = s.ct21.reasons[c.id] || [];
      const rmax = Math.max(1, ...rs.map(r => r[1])), rsum = rs.reduce((a, r) => a + r[1], 0);
      const card3 = h.card({
        title: '퇴원 사유', pin: 3, sub: rsum ? '퇴원 ' + rsum + '명 (예시)' : '',
        body: rs.length ? '<div class="stack" style="gap:7px;margin-top:4px">' + rs.map(r => '<div><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><span class="small">' + esc(r[0]) + '</span><span class="small" style="font-weight:700">' + r[1] + '명</span></div>' + h.bar(r[1] / rmax * 100, { color: '#c86a7a' }) + '</div>').join('') + '</div>' + note('퇴원 처리(CT-06, CT-10)에서 고른 사유 코드로 세요.')
          : h.empty('아직 퇴원한 원생이 없어요.'),
      });
      const defs = h.card({
        title: '지표 계산식', sub: '검토 제안, 대시보드와 같은 식을 써요', pin: 4,
        body: T([
          { label: '지표', render: r => '<b>' + esc(r[0]) + '</b>' }, { label: '계산식', render: r => '<span class="small">' + esc(r[1]) + '</span>' }, { label: '기준', render: r => '<span class="small">' + esc(r[2]) + '</span>' }, { label: '같이 쓰는 화면', render: r => '<span class="small mono" style="white-space:nowrap">' + esc(r[3]) + '</span>' },
        ], [
          ['재원생', '수강권과 학습 계정이 모두 활성인 원생 수', '매월 말일', 'HQ-01, CT-01'],
          ['신규', '그달 처음 수강권을 산 원생 수', '수납일', 'CT-07'],
          ['퇴원', '그달 퇴원일이 들어간 원생 수', '퇴원일', 'CT-06, CT-10'],
          ['출석률', '출석 횟수를 예정 회차로 나눈 값 (휴원일과 학생 휴원 기간은 빼고, 보강 출석은 따로 세요)', '수업일', 'CT-12'],
          ['보강 사용률', '쓴 보강 횟수를 받을 수 있는 보강 횟수로 나눈 값', 'POL-22 미정', 'CT-12'],
        ]),
      });
      const snaps = h.card({
        title: '월말 자동 저장 기록', sub: '1월 시범부터 쌓아요', pin: 5,
        body: T([
          { label: '월', k: 'm' }, { label: '재원생', num: true, k: 'active' }, { label: '신규', num: true, k: 'add' }, { label: '퇴원', num: true, k: 'out' },
          { label: '저장', render: x => x.saved ? '<span class="small mono">' + esc(x.saved) + '</span>' : h.chip('이번 달 말 저장', 'info') },
        ], data, { empty: '아직 저장된 달이 없어요.' }) +
          '<div style="margin-top:8px">' + label('퇴원 사유 코드') + '<div class="row" style="gap:4px">' + ['학원 일정 겹침', '이사', '비용', '학습 효과', '기타 (메모)'].map(x => h.chip(x, 'line')).join('') + '</div></div>' +
          note('화면은 P2에 만들어도 재료는 P1a부터 매월 말일에 자동으로 저장해요.'),
      });
      return '<div class="grid g3" style="align-items:start">' + card1 + card2 + card3 + '</div><div class="grid" style="grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:12px;margin-top:12px;align-items:start">' + defs + snaps + '</div>';
    },
    mount(root, ctx) { live(root, ctx, ['period']); },
    prd: {
      summary: '학생 수 변화, 출석률, 그만둔 이유를 그래프로 보여 주는 센터 통계 화면이에요. 1차에서는 대시보드 숫자로 대신하고, 확대 단계(P2)에 만들어요.',
      who: '7쪽 권한표에 이 메뉴 줄이 없어서 누가 보는지 정해지지 않았어요. 프로토타입에서는 원장이 쓰고 실장과 교사는 보기만 하게 두었어요. 보조교사에게는 숨겼어요.',
      items: [
        { n: 1, t: '재원생 추이', d: '달마다 재원생, 신규, 퇴원 수를 막대로 보여 줘요. 막대를 누르면 그달 숫자가 나와요. 1차(P1a)에서는 대시보드 지표로 대신해요.', ref: 'p.66 ①' },
        { n: 2, t: '출석률', d: '반과 타임마다 출석률과 보강 사용률을 보여 줘요. 보강을 몇 번까지 해 줄지(POL-22)가 미정이라 보강 사용률 계산법도 아직 정하지 않았어요.', pol: ['POL-22'], ref: 'p.66 ②' },
        { n: 3, t: '퇴원 사유', d: '퇴원 처리 때 받은 사유가 어떻게 나뉘는지 보여 줘요. 원문 예시는 학원 일정 겹침 5명, 이사 2명, 비용 1명이에요.', ref: 'p.66 ③' },
        { n: 4, t: '지표 계산식 표', kind: 'review', imp: 'IMP-21', d: '같은 숫자가 화면마다 다르게 나오지 않도록 지표마다 계산식, 기준, 같이 쓰는 화면을 적어 둬요. 본사와 센터 대시보드(HQ-01, CT-01)가 통계와 같은 식을 써요.' },
        { n: 5, t: '1월부터 쌓는 기록', kind: 'review', imp: 'IMP-21', d: '화면은 P2에 만들어도 재료는 1월 시범부터 쌓아야 지난 달을 다시 볼 수 있어요. 매달 말일에 재원생, 신규, 퇴원 수를 자동으로 저장하고, 퇴원 사유는 정해진 코드로 받아요.' },
      ],
      open: ['센터 통계를 누가 볼 수 있는지', '출석률 계산식 확정. 4번 표의 식(휴원일과 학생 휴원 기간을 빼고, 보강 출석은 따로 셈)은 검토 제안이에요.', '보강 사용률 계산법(POL-22 미정)', '퇴원 사유 코드 목록 확정'],
    },
  });
  B.action('CT21.metric', (ctx, v) => { ctx.ui.metric = v; });
  B.action('CT21.month', (ctx, v) => { ctx.ui.month = v; });
  B.action('CT21.att', (ctx, v) => { ctx.ui.att = v; });
  B.action('CT21.period', (ctx, v) => { ctx.ui.period = v; });

  /* =====================================================================
     CT-22 대기자 관리 (p.66, P2)
     ===================================================================== */
  const W_DAY = '03-09'; // 원문 예시 등록일에 맞춘 이 화면의 기준일 (P2 예시)
  B.extend(s => {
    s.ct22 = {
      list: [
        { id: 'w1', center: 'daechi1', name: '한도율', grade: '초3', cls: 'c3', date: '03-08', status: '대기', phone: '010-7781-9081', consent: true },
        { id: 'w2', center: 'daechi1', name: '서하진', grade: '초4', cls: 'c4', date: '03-09', status: '안내 발송', phone: '010-6620-4471', consent: true, sentAt: '03-09 10:00', due: '03-10 10:00', seat: '3월 말 퇴원 예정 1명 (예시)' },
      ],
      seq: 2,
    };
  });
  const W_CHIP = { '대기': ['대기', 'warn'], '안내 발송': ['자리 생김 · 안내 발송', 'info'], '수락': ['수락', 'ok'], '거절': ['거절', 'p2'], '시간 초과': ['시간 초과', 'p2'], '등록 완료': ['등록 완료', 'ok'] };
  const wChip = st => h.chip((W_CHIP[st] || [st])[0], (W_CHIP[st] || [])[1]);
  const wOpen = w => w.status === '대기' || w.status === '안내 발송' || w.status === '수락';
  const nextDay = t => { const [d, tm] = t.split(' '); return md(addDays('2027-' + d, 1)) + ' ' + tm; };
  function sendNext(s, clsId, except) {
    const w = s.ct22.list.find(x => x.cls === clsId && x.status === '대기' && x.id !== except);
    if (!w) return null;
    w.status = '안내 발송'; w.sentAt = W_DAY + ' 15:00'; w.due = nextDay(w.sentAt);
    return w;
  }

  B.screen({
    id: 'CT-22', side: 'ct', phase: 'P2', devices: ['pc'], pages: [66],
    title: '대기자 관리', menuLabel: '대기자 관리', crumb: '운영 > 반·시간표 > 대기자',
    headActions: ctx => h.btn('+ 대기 등록', { primary: true, act: 'CT22.newForm', disabled: !ctx.canEdit }),
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, c = ctx.center, dis = !ctx.canEdit;
      const all = s.ct22.list.filter(w => w.center === c.id);
      const openList = all.filter(wOpen);
      const list = (ui.filter || '진행 중') === '진행 중' ? openList : all;
      const K = id => s.classes.find(k => k.id === id) || { name: id, cap: 0, enrolled: 0 };
      const sel = all.find(w => w.id === ui.sel) || openList.find(w => w.status === '안내 발송') || openList[0];
      let html = '';
      if (ui.form) html += formCard(ctx) + '<div style="height:12px"></div>';
      const table = T([
        { label: '순번', render: w => wOpen(w) ? String(openList.indexOf(w) + 1) : '<span class="muted">-</span>' },
        { label: '학생', render: w => esc(h.mask(w.name)) + ' <span class="muted small">(' + esc(w.grade) + ')</span>' },
        { head: hp('희망 반 (정원)', 5), render: w => { const k = K(w.cls), free = k.cap - k.enrolled; return esc(k.name) + ' <span class="small muted">' + k.enrolled + '/' + k.cap + '</span>' + (w.status === '대기' && free > 0 ? ' ' + h.chip('빈자리 ' + free + '개', 'review') : ''); } },
        { label: '등록일', render: w => '<span class="mono small">' + esc(w.date) + '</span>' },
        { label: '상태', render: w => wChip(w.status) + (w.seat && w.status === '안내 발송' ? '<div class="small muted">' + esc(w.seat) + '</div>' : '') },
        { label: '응답 기한', render: w => w.status === '안내 발송' ? '<span class="mono small">' + esc(w.due) + '</span>까지' : '<span class="muted">-</span>' },
      ], list, { rowAttr: w => ' class="click' + (sel && w.id === sel.id ? ' sel' : '') + '" data-act="CT22.select" data-arg="' + w.id + '"', empty: '기다리는 학생이 없어요.' });
      html += h.card({
        title: '대기 명단', sub: W_DAY + ' 기준 (예시)', pin: 1, right: h.polChip('POL-16') + h.opts(['진행 중', '전체'], ui.filter || '진행 중', { act: 'CT22.filter' }),
        body: table + (ui.form ? '' : '<div class="row"' + P(3) + ' style="gap:6px;margin-top:10px;padding:8px 10px;border-radius:8px;background:var(--review-soft);color:#4a25a8"><span class="small">대기 등록 때 보호자 동의를 받아요. 대기가 끝나면 30일(예시) 뒤 이름과 연락처를 자동으로 지워요.</span></div>'),
      });
      // 자리 생김 안내 (반별)
      const cls = s.classes.filter(k => k.center === c.id);
      const rows = cls.map(k => ({ k, wait: all.filter(w => w.cls === k.id && w.status === '대기').length, hold: all.filter(w => w.cls === k.id && (w.status === '안내 발송' || w.status === '수락')).length }));
      const seatCard = h.card({
        title: '자리 생김 안내', pin: 2, right: h.polChip('POL-35'),
        body: '<div class="small" style="margin-bottom:8px">자리가 생기면 순번대로 알림톡을 보내요. 24시간 안에 응답이 없으면 다음 순번으로 넘어가요.</div>' +
          T([
            { label: '반', render: r => '<b>' + esc(r.k.name) + '</b> <span class="small muted">' + esc(r.k.days) + '</span>' },
            { label: '정원', render: r => r.k.enrolled + '/' + r.k.cap },
            { label: '대기', render: r => r.wait ? r.wait + '명' : '<span class="muted">0</span>' },
            { label: '안내 중', render: r => r.hold ? r.hold + '명' : '<span class="muted">0</span>' },
            { label: '', render: r => h.btn('자리 생김 안내', { sm: true, act: 'CT22.seat', arg: r.k.id, disabled: dis || !r.wait }) },
          ], rows, { empty: '이 센터에는 아직 반이 없어요.' }) + note('24시간은 원문에 근거 표시가 없어서 미정이에요. 안내 중인 자리는 수강 등록(CT-07)에서 잠가 둬요.'),
      });
      const step = st => ({ '대기': 0, '안내 발송': 1, '수락': 2, '등록 완료': 3, '거절': 2, '시간 초과': 2 })[st];
      let flow;
      if (!sel) flow = h.empty('명단에서 학생을 고르면 응답을 처리할 수 있어요.');
      else {
        const k = K(sel.cls), i = step(sel.status), free = k.cap - k.enrolled;
        const end = sel.status === '거절' || sel.status === '시간 초과';
        flow = h.steps([{ label: '대기' }, { label: '안내 발송' }, { label: end ? sel.status : '수락' }, { label: '등록 완료' }].map((x, j) => ({ label: x.label, state: j < i || sel.status === '등록 완료' ? 'done' : j === i ? 'cur' : '' }))) +
          '<div style="margin-top:8px">' + h.kv([['학생', h.mask(sel.name) + ' (' + sel.grade + ')'], ['희망 반', k.name + ' ' + k.time], ['보호자', h.maskPhone(sel.phone)]].concat(sel.status === '안내 발송' ? [['안내', sel.sentAt + ' 발송, ' + sel.due + '까지 응답']] : [])) + '</div>' +
          '<div class="row" style="margin-top:10px;gap:6px">' +
          (sel.status === '안내 발송' ? h.btn('수락', { primary: true, act: 'CT22.reply', arg: sel.id + '|수락', disabled: dis }) + h.btn('거절', { act: 'CT22.reply', arg: sel.id + '|거절', disabled: dis }) + h.btn('시간 초과', { act: 'CT22.reply', arg: sel.id + '|시간 초과', disabled: dis }) : '') +
          (sel.status === '수락' ? h.btn('원생 등록으로 이어서 하기', { primary: true, act: 'CT22.toRegister', arg: sel.id, disabled: dis }) : '') +
          (sel.status === '대기' && free > 0 ? h.btn('대기 대신 바로 등록', { primary: true, act: 'CT22.toRegister', arg: sel.id, disabled: dis }) : '') +
          (sel.status === '대기' && free <= 0 ? '<span class="small muted">자리가 생기면 왼쪽에서 안내를 보내요.</span>' : '') +
          (end || sel.status === '등록 완료' ? '<span class="small muted">처리가 끝난 대기예요.</span>' : '') + '</div>';
      }
      const replyCard = h.card({ title: '응답 처리', sub: sel ? h.mask(sel.name) : '', pin: 4, body: flow });
      html += '<div class="grid g2" style="margin-top:12px;align-items:start">' + seatCard + replyCard + '</div>';
      return html;
    },
    mount(root, ctx) { live(root, ctx, ['w_cls']); },
    prd: {
      summary: '정원이 찬 반에 들어가려고 기다리는 학생을 순서대로 관리하는 화면이에요. 자리가 나면 순번대로 알림톡으로 안내해요.',
      who: '7쪽 권한표에 따로 줄이 없어요. 반·시간표 메뉴 아래라서 원장과 실장이 쓰고 교사는 보기만 하게 두었어요. 보조교사에게는 숨겼어요.',
      items: [
        { n: 1, t: '대기 명단', d: '정원이 찬 반의 대기자를 순번으로 관리해요. 반이 찼는지는 타임당 정원 15명(안, POL-16) 기준으로 봐요.', pol: ['POL-16'], ref: 'p.66 ①' },
        { n: 2, t: '자리 생김 안내', d: '퇴원이나 반 이동으로 자리가 나면 순번대로 알림톡을 보내요. 24시간 안에 답이 없으면 다음 순번으로 넘어가요. 24시간은 원문에 근거 표시가 없어서 미정이에요.', pol: ['POL-35'], ref: 'p.66 ②' },
        { n: 3, t: '대기 단계 개인정보', kind: 'review', imp: 'IMP-07', d: '대기자는 아직 원생이 아닐 수 있어요. 대기 등록 때 보호자에게 연락처 수집과 이용 동의를 받고, 대기가 끝나면 30일(예시) 뒤 자동으로 지워요.' },
        { n: 4, t: '응답 처리와 등록 연결', kind: 'review', imp: 'IMP-18', d: '안내를 보낸 뒤 수락, 거절, 시간 초과 중 하나로 마무리해요. 수락하면 원생 등록(CT-05)으로 이름과 연락처를 넘겨 바로 이어 써요. 거절이나 시간 초과면 같은 반 다음 순번에게 안내가 가요.' },
        { n: 5, t: '자리가 있는 반은 대기 대신 등록', kind: 'review', imp: ['IMP-18', 'IMP-15'], d: '원문 예시의 L2-화목A는 12/15로 자리가 남아 있었어요. 자리가 있는 반에는 대기 등록을 막고 바로 등록하도록 안내해요. 정원 검사는 수강 등록(CT-07), 반 설정(CT-11)과 같은 기준을 써요.', pol: ['POL-16'] },
      ],
      open: [
        '자리 생김 안내를 자동 발송 항목(POL-35)과 알림톡 템플릿(HQ-18)에 넣을지',
        '24시간 응답 기한을 바꿀 수 있는 값으로 둘지, 밤과 주말도 셀지',
        '학부모가 알림톡 버튼으로 답할지 전화로 답할지',
        '대기 순번을 반별로 매길지 센터 전체로 매길지',
        'P1a 화면에 보이는 대기 숫자와 이 명단을 같은 것으로 볼지',
      ],
    },
  });
  function formCard(ctx) {
    const s = ctx.s, ui = ctx.ui, c = ctx.center;
    const cls = s.classes.filter(k => k.center === c.id);
    const kid = ui.w_cls || (cls.find(k => k.enrolled >= k.cap) || cls[0] || {}).id;
    const k = cls.find(x => x.id === kid);
    const free = k ? k.cap - k.enrolled : 0;
    return h.card({
      title: '대기 등록', right: h.btn('닫기', { sm: true, act: 'CT22.closeForm' }),
      body: '<div class="grid g4" style="gap:10px">' +
        h.field({ label: '학생 이름', req: true, field: 'w_name', value: ui.w_name || '', err: ui.w_err_name }) +
        h.field({ label: '학년', type: 'select', field: 'w_grade', value: ui.w_grade || '초4', options: ['초1', '초2', '초3', '초4', '초5', '초6'] }) +
        h.field({ label: '보호자 연락처', req: true, field: 'w_phone', value: ui.w_phone || '', ph: '010-0000-0000', err: ui.w_err_phone }) +
        h.field({ label: '희망 반', type: 'select', field: 'w_cls', value: kid, options: cls.map(x => ({ v: x.id, l: x.name + ' (' + x.enrolled + '/' + x.cap + ')' })), err: ui.w_err_cls }) + '</div>' +
        (k && free > 0 && !ui.w_err_cls ? '<div style="margin-top:8px">' + h.alert(J(k.name, '은', '는') + ' 자리가 ' + free + '개 남아 있어요. 대기 대신 바로 등록해요.', 'review') + '</div>' : '') +
        reviewBox(check('w_consent', !!ui.w_consent, '보호자에게 대기 안내용 연락처 수집과 이용 동의를 받았어요. 대기가 끝나면 30일(예시) 뒤 자동으로 지워요.').replace('margin-top:8px', 'margin-top:0') + errLine(ui.w_err_consent), 3, 'margin-top:10px;padding:8px 12px 8px 16px') +
        '<div class="row" style="justify-content:flex-end;margin-top:10px">' + h.btn('대기 저장', { primary: true, act: 'CT22.save' }) + '</div>',
    });
  }
  B.action('CT22.filter', (ctx, v) => { ctx.ui.filter = v; });
  B.action('CT22.select', (ctx, id) => { ctx.ui.sel = id; });
  B.action('CT22.newForm', ctx => { Object.assign(ctx.ui, { form: true, w_name: '', w_phone: '', w_consent: false, w_err_name: null, w_err_phone: null, w_err_cls: null, w_err_consent: null }); });
  B.action('CT22.closeForm', ctx => { ctx.ui.form = false; });
  B.action('CT22.save', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui, c = ctx.center;
    if (!ctx.canEdit) return;
    if (objArg(arg)) { ui.form = true; Object.keys(arg).forEach(k => { ui[k.indexOf('w_') === 0 ? k : 'w_' + k] = arg[k]; }); }
    const cls = s.classes.filter(k => k.center === c.id);
    const k = cls.find(x => x.id === ui.w_cls) || cls.find(x => x.enrolled >= x.cap) || cls[0];
    ui.w_err_name = !String(ui.w_name || '').trim() ? '학생 이름을 넣어 주세요.' : null;
    ui.w_err_phone = !/^01[016789]-?\d{3,4}-?\d{4}$/.test(String(ui.w_phone || '').trim()) ? '보호자 연락처를 010-0000-0000 모양으로 넣어 주세요.' : null;
    ui.w_err_cls = !k ? '희망 반을 골라 주세요.' : k.enrolled < k.cap ? J(k.name, '은', '는') + ' 자리가 ' + (k.cap - k.enrolled) + '개 남아 있어서 대기로 받을 수 없어요. 바로 등록해 주세요.' : null;
    ui.w_err_consent = !ui.w_consent ? '보호자 동의를 받았는지 체크해 주세요.' : null;
    if (ui.w_err_name || ui.w_err_phone || ui.w_err_cls || ui.w_err_consent) return;
    const id = 'w' + (++s.ct22.seq);
    s.ct22.list.push({ id, center: c.id, name: ui.w_name.trim(), grade: ui.w_grade || '초4', cls: k.id, date: W_DAY, status: '대기', phone: ui.w_phone.trim(), consent: true });
    ui.form = false; ui.sel = id; ui.filter = '진행 중';
    const n = s.ct22.list.filter(w => w.center === c.id && wOpen(w)).length;
    say(k.name + ' 대기로 넣었어요. 명단 순번 ' + n + '번이에요. 이 반에 자리가 생기면 먼저 기다린 학생부터 알림톡이 가요.');
  });
  B.action('CT22.seat', (ctx, clsId) => {
    if (!ctx.canEdit) return;
    const w = sendNext(ctx.s, clsId);
    if (!w) { say('이 반에 기다리는 학생이 없어요.'); return; }
    ctx.ui.sel = w.id;
    say(h.mask(w.name) + ' 보호자에게 자리 생김 알림톡을 보냈어요. ' + w.due + '까지 응답을 기다려요.');
  });
  B.action('CT22.reply', (ctx, arg) => {
    const s = ctx.s;
    if (!ctx.canEdit) return;
    const [id, ans] = objArg(arg) ? [arg.id, arg.answer] : String(arg).split('|');
    const w = s.ct22.list.find(x => x.id === id); if (!w || w.status !== '안내 발송') return;
    w.status = ans; ctx.ui.sel = w.id;
    if (ans === '수락') { say('수락했어요. 원생 등록으로 이어서 하면 이름과 연락처가 넘어가요.'); return; }
    const nx = sendNext(s, w.cls, w.id);
    if (nx) ctx.ui.sel = nx.id;
    say(ans + '로 정리했어요. ' + (nx ? '같은 반 다음 순번 ' + h.mask(nx.name) + '에게 안내를 보냈어요.' : '다음 순번이 없어요. 자리는 수강 등록에서 바로 쓸 수 있어요.'));
  });
  B.action('CT22.toRegister', (ctx, id) => {
    const s = ctx.s, w = s.ct22.list.find(x => x.id === id); if (!w) return;
    w.status = '등록 완료';
    const reg = s.ui['CT-05'] = s.ui['CT-05'] || {};
    Object.assign(reg, { from: 'waitlist:' + w.id, name: w.name, grade: w.grade, phone: w.phone, cls: w.cls });
    B.go('CT-05'); return false;
  });

  /* =====================================================================
     CT-23 운영 점검 결과 회신 (p.67, P2)
     ===================================================================== */
  const P2D = '2027-07-12'; // 원문 7월 예시 날짜에 맞춘 이 화면의 기준일 (P2 예시)
  B.extend(s => {
    s.ct23 = {
      items: [
        { id: 'sv1', date: '2027-07-02', item: '종사자 경력 조회', result: '보완', due: '2027-07-16', status: '보완 요청', sv: '최민호', memo: '경력 조회일이 없는 종사자가 있어요.', reply: null },
        { id: 'sv2', date: '2027-07-02', item: '교습비 게시', result: '적합', due: '', status: '적합', sv: '최민호', memo: '', reply: null },
      ],
      files: {},
    };
  });
  const SV_CHIP = { '보완': 'warn', '적합': 'ok', '재보완': 'bad' };
  const isCheckItem = it => /경력 조회/.test(it.item);

  B.screen({
    id: 'CT-23', side: 'ct', phase: 'P2', devices: ['pc'], pages: [67],
    title: '운영 점검 결과 회신', menuLabel: '운영 점검', crumb: '본사 > 운영 점검',
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, c = ctx.center, dis = !ctx.canEdit;
      const items = s.ct23.items;
      const sel = items.find(x => x.id === ui.sel) || items.find(x => x.status === '보완 요청' || x.status === '재보완') || items[0];
      const table = T([
        { label: '점검일', render: x => '<span class="mono small">' + esc(md(x.date)) + '</span>' },
        { label: '항목', render: x => '<b>' + esc(x.item) + '</b>' + (x.memo ? '<div class="small muted">' + esc(x.memo) + '</div>' : '') },
        { label: '결과', render: x => h.chip(x.result, SV_CHIP[x.result]) },
        { label: '보완 기한', render: x => x.due ? '<span class="mono small">' + esc(md(x.due)) + '</span>' + (x.status === '보완 요청' || x.status === '재보완' ? ' <span class="small muted">(' + dayDiff(P2D, x.due) + '일 남음)</span>' : '') : '-' },
        { label: '회신', render: x => (x.status === '보완 요청' || x.status === '재보완') ? h.btn('회신하기', { sm: true, primary: sel && sel.id === x.id, act: 'CT23.open', arg: x.id, disabled: dis }) : x.status === '회신 완료' ? h.chip('회신 완료, 재점검 대기', 'info') : '<span class="muted">-</span>' },
      ], items, { rowAttr: x => sel && x.id === sel.id ? ' class="sel"' : '' });
      let html = h.card({ title: '점검 결과', sub: '본사 SV ' + (c.sv || '') + ', ' + P2D + ' 기준 (P2 예시)', pin: 1, right: h.polChip('POL-12'), body: table });
      if (sel && (sel.result !== '적합' || sel.reply)) html += '<div style="margin-top:12px">' + replyCard(ctx, sel) + '</div>';
      else html += '<div style="margin-top:12px">' + h.empty('보완할 항목을 고르면 회신을 쓸 수 있어요.') + '</div>';
      return html;
    },
    prd: {
      summary: '본사 SV(센터 운영을 점검하는 담당자)가 점검한 결과를 보고, 고친 내용을 증빙과 함께 회신하는 화면이에요.',
      who: '7쪽 권한표에 따로 줄이 없어요. 본사 메뉴 아래라서 원장이 회신하고 실장은 보기만 하게 두었어요. 교사와 보조교사에게는 숨겼어요.',
      items: [
        { n: 1, t: '점검 결과', d: '본사 SV 점검(HQ-24)의 항목별 결과와 보완 기한을 봐요. 원문 예시는 7월 2일 점검, 7월 16일까지 보완이에요.', pol: ['POL-12'], ref: 'p.67 ①' },
        { n: 2, t: '회신', reveal: 'CT23.open', revealArg: 'sv1', d: '보완 조치 내용과 증빙 사진이나 파일을 올리면 본사가 다시 점검해요. 재점검 결과는 적합이나 재보완으로 돌아와요.', ref: 'p.67 ②' },
        { n: 3, t: '경력 조회는 파일 대신 조회일로 확인', kind: 'review', imp: 'IMP-16', reveal: 'CT23.open', revealArg: 'sv1', d: '종사자 경력 조회 항목은 범죄 경력 파일이 본사로 넘어가지 않게 파일 첨부를 막아요. 교직원 계정(CT-20)에 모든 종사자의 조회일이 들어 있는지만 확인하고, 다 채워져야 회신할 수 있어요.' },
      ],
      open: ['보완 기한(예시 14일)을 누가 어떤 기준으로 정하는지', '보완 기한을 넘기면 경고로 끝나는지, 계약상 조치(POL-07)로 이어지는지', '본사가 증빙을 보고 반려할 때 센터에 알리는 방법'],
    },
  });
  function replyCard(ctx, it) {
    const s = ctx.s, ui = ctx.ui, c = ctx.center, dis = !ctx.canEdit;
    const stage = { '보완 요청': 1, '재보완': 1, '회신 완료': 2, '적합': 4 }[it.status] || 1;
    const steps = h.steps([{ label: '보완 요청 ' + md(it.date) }, { label: '센터 회신' + (it.reply ? ' ' + md(it.reply.date) : '') }, { label: '본사 재점검' }, { label: '적합' }].map((x, i) => ({ label: x.label, state: i < stage ? 'done' : i === stage ? 'cur' : '' })));
    let ev;
    if (isCheckItem(it)) {
      const staff = s.staff.filter(x => x.center === c.id && !isOut(x));
      const done = staff.filter(x => x.check).length;
      ev = reviewBox('<div class="row" style="justify-content:space-between;flex-wrap:nowrap"><b class="small" style="color:var(--review)">증빙은 교직원 계정의 조회일로 확인해요</b><span class="small">조회일 입력 <b>' + done + ' / ' + staff.length + '명</b></span></div>' +
        '<div class="row" style="gap:4px;margin-top:6px">' + staff.map(x => h.chip(x.name + ' ' + (x.check ? x.check : '조회 전'), x.check ? 'ok' : 'bad')).join('') + '</div>' +
        '<div class="row" style="justify-content:space-between;margin-top:8px;flex-wrap:nowrap"><span class="small muted">범죄 경력 파일은 올리지 않아요. 본사에는 조회를 마쳤는지만 보여요.</span>' + h.btn('교직원 계정에서 입력', { sm: true, go: 'CT-20' }) + '</div>', 3, 'margin-top:10px');
    } else {
      const files = s.ct23.files[it.id] || [];
      ev = '<div style="margin-top:10px">' + label('증빙 사진·파일') + '<div class="row" style="gap:4px">' + files.map(f => h.chip(f, 'info')).join('') + h.btn('사진 추가', { sm: true, act: 'CT23.addFile', arg: it.id + '|photo', disabled: dis }) + h.btn('파일 추가', { sm: true, act: 'CT23.addFile', arg: it.id + '|file', disabled: dis }) + '</div></div>';
    }
    let body;
    if (it.status === '회신 완료' || it.status === '적합') {
      body = steps + '<div style="margin-top:10px">' + h.kv([['조치 내용', it.reply ? it.reply.text : '-'], ['증빙', it.reply ? it.reply.evidence : '-'], ['회신일', it.reply ? it.reply.date : '-']]) + '</div>' +
        (isCheckItem(it) ? ev : '') +
        (it.status === '회신 완료' ? '<div class="row" style="justify-content:flex-end;margin-top:10px;gap:6px"><span class="small muted">본사 SV가 재점검하면 결과가 여기로 와요.</span>' + h.btn('재점검 결과 적합 (시연)', { sm: true, ghost: true, act: 'CT23.recheck', arg: it.id + '|적합' }) + h.btn('재보완 (시연)', { sm: true, ghost: true, act: 'CT23.recheck', arg: it.id + '|재보완' }) + '</div>' : '');
    } else {
      body = steps + (it.status === '재보완' ? '<div style="margin-top:8px">' + h.alert('본사가 재보완을 요청했어요. 조치를 더 하고 다시 회신해 주세요.', 'bad') + '</div>' : '') +
        '<div style="margin-top:10px">' + h.field({ label: '조치 내용', req: true, type: 'textarea', field: 'r_text', value: ui.r_text || '', ph: '예) 보조교사 경력 조회를 마치고 조회일을 입력했어요.', err: ui.r_err_text, disabled: dis }) + '</div>' + ev + errLine(ui.r_err_ev) +
        '<div class="row" style="justify-content:space-between;margin-top:10px"><span class="small muted">보완 기한 ' + md(it.due) + ', ' + dayDiff(P2D, it.due) + '일 남았어요.</span>' + h.btn('회신 보내기', { primary: true, act: 'CT23.send', arg: it.id, disabled: dis }) + '</div>';
    }
    return h.card({ title: '회신', sub: it.item, pin: 2, body });
  }
  B.action('CT23.open', (ctx, id) => { ctx.ui.sel = id; ctx.ui.r_err_text = null; ctx.ui.r_err_ev = null; });
  B.action('CT23.addFile', (ctx, arg) => {
    const [id, kind] = String(arg).split('|');
    const f = ctx.s.ct23.files[id] = ctx.s.ct23.files[id] || [];
    f.push(kind === 'photo' ? '조치 사진 ' + (f.length + 1) + '.jpg' : '증빙 문서 ' + (f.length + 1) + '.pdf');
    ctx.ui.r_err_ev = null;
  });
  B.action('CT23.send', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui, c = ctx.center;
    if (!ctx.canEdit) return;
    const id = objArg(arg) ? arg.id : arg;
    if (objArg(arg) && arg.text != null) ui.r_text = arg.text;
    const it = s.ct23.items.find(x => x.id === (id || ui.sel)); if (!it) return;
    ui.sel = it.id;
    ui.r_err_text = !String(ui.r_text || '').trim() ? '어떤 조치를 했는지 적어 주세요.' : null;
    let evidence = '';
    if (isCheckItem(it)) {
      const staff = s.staff.filter(x => x.center === c.id && !isOut(x)), miss = staff.filter(x => !x.check);
      ui.r_err_ev = miss.length ? '조회일이 없는 종사자가 있어요 (' + miss.map(x => x.name).join(', ') + '). 교직원 계정에서 먼저 넣어 주세요.' : null;
      evidence = '교직원 계정 조회일 ' + staff.length + '명 모두 입력';
    } else {
      const files = s.ct23.files[it.id] || [];
      ui.r_err_ev = !files.length ? '증빙 사진이나 파일을 하나 이상 올려 주세요.' : null;
      evidence = files.join(', ');
    }
    if (ui.r_err_text || ui.r_err_ev) return;
    it.reply = { text: ui.r_text.trim(), evidence, date: P2D };
    it.status = '회신 완료';
    ui.r_text = '';
    say('회신했어요. 본사 SV가 재점검해요.');
  });
  B.action('CT23.recheck', (ctx, arg) => {
    const [id, r] = objArg(arg) ? [arg.id, arg.result] : String(arg).split('|');
    const it = ctx.s.ct23.items.find(x => x.id === id); if (!it) return;
    if (r === '적합') { it.status = '적합'; it.result = '적합'; it.memo = ''; say('재점검 결과 적합이에요. 이 항목은 끝났어요.'); }
    else { it.status = '재보완'; it.result = '재보완'; say('본사가 재보완을 요청했어요.'); }
    ctx.ui.sel = it.id;
  });

  /* =====================================================================
     CT-24 개인정보 열람·정정·삭제 요청 (p.67, P2)
     ===================================================================== */
  const DUE_DAYS = 10; // 접수 후 처리 기한 (원문 예시 07-03 접수, 07-13 기한)
  B.extend(s => {
    s.ct24 = {
      list: [
        { id: 'q1', center: 'daechi1', date: '2027-07-03', student: '이하린', type: '정정', detail: '보호자 연락처', requester: '모', due: '2027-07-13', status: '처리 완료', verify: '휴대폰 본인인증', result: '보호자 연락처를 새 번호로 고쳤어요.', notifyBy: '알림톡', notified: '2027-07-04', ext: {} },
        { id: 'q2', center: 'daechi1', date: '2027-07-05', student: '한시결', type: '삭제', detail: '퇴원생', requester: '부', due: '2027-07-15', status: '확인 중', verify: '', result: '', notifyBy: '', notified: '', ext: {} },
      ],
      seq: 2,
    };
  });
  const Q_CHIP = { '접수': 'info', '확인 중': 'warn', '처리 중': 'info', '처리 완료': 'ok', '일부 처리': 'warn', '거절': 'bad' };
  const qOpen = q => q.status === '접수' || q.status === '확인 중' || q.status === '처리 중';
  const extTargets = c => ['학습 앱 (학습 프로젝트)', c.pay === '결제선생' ? '결제선생' : null, '알림톡 발송사'].filter(Boolean);
  const DEL_TABLE = [
    ['보호자 연락처, 주소', '바로 삭제', '요청'],
    ['학습 기록, 검사 결과', '바로 삭제', '요청'],
    ['수납 기록, 영수증', '분리 보관 5년', 'POL-41 법정'],
    ['동의 이력', '분리 보관', 'POL-40 기간 미정'],
    ['접속기록', '보관', '법무 확인'],
  ];

  B.screen({
    id: 'CT-24', side: 'ct', phase: 'P2', devices: ['pc'], pages: [67],
    title: '개인정보 열람·정정·삭제 요청', menuLabel: '개인정보 요청', crumb: '원생 > 개인정보 요청',
    headActions: ctx => h.btn('+ 요청 접수', { primary: true, act: 'CT24.newForm', disabled: !ctx.canEdit }),
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, c = ctx.center;
      const list = s.ct24.list.filter(q => q.center === c.id);
      const sel = list.find(q => q.id === ui.sel) || list.find(qOpen) || list[0];
      const direct = c.type === '직영';
      const who = h.alert(direct
        ? '이 센터 원생 정보의 처리자는 MSC Brain(본사)이에요. 센터가 접수와 처리를 하고, 결과는 본사 개인정보 보호책임자에게도 남아요.'
        : '이 센터 원생 정보의 처리자는 가맹 사업자(원장)이고, 본사는 맡아 관리하는 수탁자예요. 본사로 들어온 요청도 이 목록으로 넘어와요.', 'review', { title: '처리자', pin: 4 });
      const soon = list.filter(q => qOpen(q) && dayDiff(P2D, q.due) <= 3);
      const warn = soon.length
        ? h.alert(soon.map(q => h.mask(q.student) + ' ' + q.type + ' 요청 기한이 ' + dayDiff(P2D, q.due) + '일 남았어요 (' + md(q.due) + ').').join(' ') + ' 대시보드(CT-01) 기한 칸에도 올라가요.', 'warn', { title: '기한 임박', pin: 5 })
        : h.alert('기한이 3일 안으로 남은 요청이 없어요.', 'ok', { title: '기한', pin: 5 });
      let html = '<div class="grid g2" style="align-items:stretch">' + who + warn + '</div>';
      if (ui.form) html += '<div style="margin-top:12px">' + reqForm(ctx) + '</div>';
      const table = T([
        { label: '접수일', render: q => '<span class="mono small">' + esc(md(q.date)) + '</span>' },
        { label: '원생', render: q => esc(h.mask(q.student)) },
        { label: '요청', render: q => esc(q.type + (q.detail ? ' (' + q.detail + ')' : '')) },
        { label: '요청자', k: 'requester' },
        { label: '기한', render: q => '<span class="mono small">' + esc(md(q.due)) + '</span>' + (qOpen(q) ? ' <span class="small ' + (dayDiff(P2D, q.due) <= 3 ? '' : 'muted') + '" style="' + (dayDiff(P2D, q.due) <= 3 ? 'color:var(--warn);font-weight:700' : '') + '">D-' + dayDiff(P2D, q.due) + '</span>' : '') },
        { label: '상태', render: q => h.chip(q.status, Q_CHIP[q.status]) },
      ], list, { rowAttr: q => ' class="click' + (sel && q.id === sel.id ? ' sel' : '') + '" data-act="CT24.sel" data-arg="' + q.id + '"', empty: '받은 요청이 없어요.' });
      html += '<div style="margin-top:12px">' + h.card({ title: '요청 목록', sub: P2D + ' 기준 (P2 예시)', pin: 1, right: h.polChip('POL-40'), body: table }) + '</div>';
      if (sel) html += '<div class="grid g2" style="margin-top:12px;align-items:start">' + procCard(ctx, sel) + delCard(ctx, sel) + '</div>';
      return html;
    },
    mount(root, ctx) { live(root, ctx, ['n_type']); },
    prd: {
      summary: '학부모가 우리 아이 정보를 보여 달라, 고쳐 달라, 지워 달라고 한 요청을 기한 안에 처리하고 기록하는 화면이에요.',
      who: '7쪽 권한표에 따로 줄이 없어요. 프로토타입에서는 원장이 처리를 마치고, 실장은 접수와 본인 확인까지만 해요. 교사와 보조교사에게는 숨겼어요.',
      items: [
        { n: 1, t: '요청 접수', d: '보호자의 열람, 정정, 삭제 요청을 받아 기한 안에 처리해요. 접수하면 기한이 접수일에서 10일(예시) 뒤로 바로 계산돼요.', pol: ['POL-40'], ref: 'p.67 ①' },
        { n: 2, t: '처리 기록', d: '본인이나 법정대리인인지 확인한 방법, 처리 결과, 결과를 알린 날을 남겨요. 법으로 보관해야 하는 정보는 삭제 대상에서 빼요.', pol: ['POL-41'], ref: 'p.67 ②' },
        { n: 3, t: '삭제 처리표와 외부 전달', kind: 'review', imp: 'IMP-07', reveal: 'CT24.sel', revealArg: 'q2', d: '삭제 요청이면 정보 종류마다 바로 지울지 따로 보관할지 보여 줘요. 수납 기록과 영수증은 5년(법정) 따로 보관해요. 학습 앱과 결제, 알림톡 업체에도 삭제를 요청하고 완료를 확인해야 처리를 마칠 수 있어요.', pol: ['POL-40', 'POL-41'] },
        { n: 4, t: '처리 책임자 표시', kind: 'review', imp: 'IMP-04', d: '직영 센터 원생 정보의 처리자는 MSC Brain(본사)이고, 가맹 센터는 가맹 사업자예요. 원문은 모든 센터를 똑같이 적어서 직영 고지가 틀렸어요. 센터 유형에 맞는 처리자를 위에 보여 줘요.', pol: ['POL-42'] },
        { n: 5, t: '기한 3일 전 경고', kind: 'review', imp: 'IMP-07', d: '처리 기한이 3일 남은 요청은 위에 경고로 띄우고 대시보드(CT-01) 기한 칸에도 올려요. 원문에는 상태가 처리 완료와 확인 중 두 가지뿐이라 늦어지는 요청을 놓치기 쉬웠어요.' },
      ],
      open: ['퇴원생 개인정보 보관 기간(POL-40 미정)', '처리 기한 10일이 정책 값인지 고정 값인지 (법정 기한은 법무 확인)', '본인 확인 방법 목록', '본사로 들어온 요청을 센터로 넘기는 방법'],
      rules: ['거래 증빙(영수증, 청구서)은 5년 보관해야 해요(POL-41, 법정).', '만 14세 미만 원생은 법정대리인이 요청해요.'],
    },
  });
  function reqForm(ctx) {
    const s = ctx.s, ui = ctx.ui, c = ctx.center;
    const st = s.students.filter(x => x.center === c.id);
    const pick = st.find(x => x.id === ui.n_student) || null;
    return h.card({
      title: '요청 접수', right: h.btn('닫기', { sm: true, act: 'CT24.closeForm' }),
      body: '<div class="grid g4" style="gap:10px">' +
        h.field({ label: '원생', req: true, type: 'select', field: 'n_student', value: ui.n_student || '', options: [{ v: '', l: '고르세요' }].concat(st.map(x => ({ v: x.id, l: h.mask(x.name) + ' (' + x.grade + ', ' + x.status + ')' }))), err: ui.n_err_student }) +
        h.field({ label: '요청', type: 'select', field: 'n_type', value: ui.n_type || '열람', options: ['열람', '정정', '삭제'] }) +
        h.field({ label: '내용', field: 'n_detail', value: ui.n_detail || '', ph: '예) 보호자 연락처', err: ui.n_err_detail }) +
        h.field({ label: '요청자', type: 'select', field: 'n_req', value: ui.n_req || '모', options: ['모', '부', '본인', '그 밖의 법정대리인'] }) + '</div>' +
        '<div class="row" style="justify-content:space-between;margin-top:10px"><span class="small">접수일 <b>' + md(P2D) + '</b>, 처리 기한 <b>' + md(addDays(P2D, DUE_DAYS)) + '</b> (접수 후 ' + DUE_DAYS + '일, 예시)</span>' + h.btn('접수', { primary: true, act: 'CT24.save' }) + '</div>' +
        ((ui.n_type === '삭제' && pick && pick.status === '재원') ? '<div style="margin-top:8px">' + h.alert('재원 중인 원생이에요. 지우면 수업과 수납을 이어 갈 수 없어서 퇴원 처리와 함께 안내해요.', 'warn') + '</div>' : ''),
    });
  }
  function procCard(ctx, q) {
    const ui = ctx.ui, dis = !ctx.canEdit, boss = ctx.canEdit && !ctx.partial;
    const stage = { '접수': 1, '확인 중': 1, '처리 중': 2 }[q.status] || 4;
    const steps = h.steps(['접수', '본인 확인', '처리', '결과 통지'].map((x, i) => ({ label: x, state: i < stage ? 'done' : i === stage ? 'cur' : '' })));
    let body = steps;
    if (!qOpen(q)) {
      body += '<div style="margin-top:10px">' + h.kv([['본인 확인', q.verify || '-'], ['처리 결과', q.result || '-'], ['결과 통지', (q.notifyBy || '-') + (q.notified ? ', ' + q.notified : '')]]) + '</div>' + note('처리 기록은 지우지 않고 보관해요.');
    } else {
      const vm = ui.q_verify || q.verify || '';
      body += '<div style="margin-top:10px">' + label('본인 확인 방법') + h.opts(['휴대폰 본인인증', '방문 신분증 확인', '서면 위임장'], vm, { act: 'CT24.verify' }) +
        (q.status !== '처리 중' ? '<div class="row" style="margin-top:6px;gap:6px">' + h.btn('확인 완료', { sm: true, act: 'CT24.verified', arg: q.id, disabled: dis }) + errLine(ui.q_err_verify) + '</div>' : '<div class="small muted" style="margin-top:4px">' + esc(J(q.verify, '으로')) + ' 확인했어요.</div>') + '</div>' +
        '<div style="margin-top:10px">' + h.field({ label: '처리 결과', type: 'textarea', field: 'q_result', value: ui.q_result || '', ph: q.type === '삭제' ? '예) 연락처와 학습 기록을 지우고 수납 기록은 5년 따로 보관해요.' : '예) 요청한 정보를 고쳤어요.', err: ui.q_err_result, disabled: dis || q.status !== '처리 중' }) + '</div>' +
        '<div class="row" style="margin-top:8px;gap:6px"><span class="small muted">통지</span>' + h.opts(['알림톡', '문자', '서면'], ui.q_notify || '알림톡', { act: 'CT24.notify' }) + '</div>' + errLine(ui.q_err_done) +
        '<div class="row" style="justify-content:flex-end;margin-top:10px;gap:6px">' +
        ['거절', '일부 처리', '처리 완료'].map(o => h.btn(o, { primary: o === '처리 완료', danger: o === '거절', act: 'CT24.finish', arg: q.id + '|' + o, disabled: !boss || q.status !== '처리 중', title: !boss ? '처리를 마치는 일은 원장만 해요' : q.status !== '처리 중' ? '본인 확인을 먼저 마쳐요' : null })).join('') + '</div>';
    }
    return h.card({ title: '처리 기록', sub: h.mask(q.student) + ' ' + q.type, pin: 2, right: h.polChip('POL-41'), body });
  }
  function delCard(ctx, q) {
    const c = ctx.center;
    if (q.type !== '삭제') return h.card({ title: '삭제 처리표', body: h.empty(q.type + ' 요청이라 삭제 처리표는 쓰지 않아요.') });
    const tg = extTargets(c), done = tg.filter(t => q.ext[t]).length;
    return h.card({
      title: '삭제 처리표', sub: '정보마다 처리 방법이 달라요', pin: 3,
      body: T([{ label: '정보', k: 0 }, { label: '처리', render: r => h.chip(r[1], /바로/.test(r[1]) ? 'bad' : 'info') }, { label: '근거', render: r => '<span class="small">' + esc(r[2]) + '</span>' }], DEL_TABLE) +
        '<div style="margin-top:10px">' + label('외부에도 삭제 요청 (' + done + ' / ' + tg.length + ' 완료)') + '<div class="opts">' + tg.map(t => tick(!!q.ext[t], t, 'CT24.ext', q.id + '|' + t, !ctx.canEdit || !qOpen(q))).join('') + '</div></div>' +
        note(c.pay === '결제선생' ? '결제선생을 쓰는 센터라 결제 업체도 들어가요.' : '이 센터는 결제선생을 쓰지 않아 결제 업체는 빠져요.'),
    });
  }
  B.action('CT24.sel', (ctx, id) => { Object.assign(ctx.ui, { sel: id, q_verify: '', q_result: '', q_err_verify: null, q_err_result: null, q_err_done: null }); });
  B.action('CT24.newForm', ctx => { Object.assign(ctx.ui, { form: true, n_student: '', n_type: '열람', n_detail: '', n_req: '모', n_err_student: null, n_err_detail: null }); });
  B.action('CT24.closeForm', ctx => { ctx.ui.form = false; });
  B.action('CT24.save', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui, c = ctx.center;
    if (!ctx.canEdit) return;
    if (objArg(arg)) { ui.form = true; Object.keys(arg).forEach(k => { ui[k.indexOf('n_') === 0 ? k : 'n_' + (k === 'requester' ? 'req' : k)] = arg[k]; }); }
    const st = s.students.find(x => x.id === ui.n_student && x.center === c.id);
    const type = ui.n_type || '열람';
    ui.n_err_student = !st ? '원생을 골라 주세요.' : null;
    ui.n_err_detail = type === '정정' && !String(ui.n_detail || '').trim() ? '무엇을 고쳐 달라는지 적어 주세요.' : null;
    if (ui.n_err_student || ui.n_err_detail) return;
    const id = 'q' + (++s.ct24.seq);
    s.ct24.list.push({ id, center: c.id, date: P2D, student: st.name, type, detail: String(ui.n_detail || '').trim(), requester: ui.n_req || '모', due: addDays(P2D, DUE_DAYS), status: '접수', verify: '', result: '', notifyBy: '', notified: '', ext: {} });
    ui.form = false; ui.sel = id; ui.q_verify = ''; ui.q_result = '';
    say('요청을 접수했어요. 처리 기한은 ' + md(addDays(P2D, DUE_DAYS)) + '이에요.');
  });
  B.action('CT24.verify', (ctx, v) => { ctx.ui.q_verify = v; ctx.ui.q_err_verify = null; });
  B.action('CT24.notify', (ctx, v) => { ctx.ui.q_notify = v; });
  B.action('CT24.verified', (ctx, arg) => {
    const ui = ctx.ui;
    if (!ctx.canEdit) return;
    const id = objArg(arg) ? arg.id : arg;
    if (objArg(arg) && arg.method) ui.q_verify = arg.method;
    const q = ctx.s.ct24.list.find(x => x.id === id); if (!q || !qOpen(q)) return;
    ui.sel = q.id;
    if (!ui.q_verify) { ui.q_err_verify = '확인 방법을 골라 주세요.'; return; }
    q.verify = ui.q_verify; q.status = '처리 중'; ui.q_err_verify = null;
    say('본인 확인을 마쳤어요. 이제 처리할 수 있어요.');
  });
  B.action('CT24.ext', (ctx, arg) => {
    const [id, t] = objArg(arg) ? [arg.id, arg.target] : String(arg).split('|');
    const q = ctx.s.ct24.list.find(x => x.id === id); if (!q || !ctx.canEdit) return;
    if (t === '*') extTargets(ctx.center).forEach(x => { q.ext[x] = true; }); else q.ext[t] = !q.ext[t];
    ctx.ui.q_err_done = null;
  });
  B.action('CT24.finish', (ctx, arg) => {
    const ui = ctx.ui, c = ctx.center;
    if (!ctx.canEdit || ctx.partial) { say('처리를 마치는 일은 원장만 해요.'); return; }
    const [id, outcome] = objArg(arg) ? [arg.id, arg.outcome || '처리 완료'] : String(arg).split('|');
    if (objArg(arg)) { if (arg.result != null) ui.q_result = arg.result; if (arg.notifyBy) ui.q_notify = arg.notifyBy; }
    const q = ctx.s.ct24.list.find(x => x.id === id); if (!q) return;
    ui.sel = q.id; ui.q_err_done = null; ui.q_err_result = null;
    if (q.status !== '처리 중') { ui.q_err_done = '본인 확인을 먼저 마쳐 주세요.'; return; }
    if (!String(ui.q_result || '').trim()) { ui.q_err_result = outcome === '거절' ? '거절 사유를 적어 주세요. 보호자에게 그대로 알려요.' : '처리 결과를 적어 주세요.'; return; }
    if (q.type === '삭제' && outcome !== '거절') {
      const miss = extTargets(c).filter(t => !q.ext[t]);
      if (miss.length) { ui.q_err_done = '외부 삭제 완료를 모두 확인해야 마칠 수 있어요 (' + miss.join(', ') + ').'; return; }
    }
    Object.assign(q, { status: outcome, result: ui.q_result.trim(), notifyBy: ui.q_notify || '알림톡', notified: P2D });
    ui.q_result = ''; ui.q_verify = '';
    say(outcome + '로 마치고 보호자에게 ' + J(q.notifyBy, '으로') + ' 결과를 알렸어요. 처리 기록은 보관돼요.');
  });
})();
