/* CT-02 상담·테스트 예약 (reference screen). Spec p.46. */
(function () {
  const B = window.B, h = B.h, esc = B.esc;

  B.extend(s => {
    s.consults = {
      r4: { counselor: '김지원', interest: ['독서 습관', '글쓰기'], memo: '유형 결과 설명, 주 2회 권유, 일정 조율', result: '보류', recall: '2027-03-12', fee: '등록 시 면제' },
    };
  });

  B.screen({
    id: 'CT-02', side: 'ct', phase: 'P1a', devices: ['pc', 'tablet'], pages: [46],
    title: '상담·테스트 예약', menuLabel: '상담·테스트 예약', crumb: '상담 > 상담·테스트 예약',
    headActions: ctx => h.btn('+ 예약 등록', { primary: true, act: 'CT02.newForm', disabled: !ctx.canEdit, pin: 5 }),
    render(ctx) {
      const s = ctx.s, ui = ctx.ui;
      const list = s.reservations.filter(r => r.center === ctx.centerId && (!ui.kind || ui.kind === '전체' || r.kind === ui.kind));
      const sel = s.reservations.find(r => r.id === ui.sel) || list.find(r => r.status === '완료') || list[0];
      const rec = sel ? (s.consults[sel.id] = s.consults[sel.id] || { counselor: ctx.persona.name, interest: [], memo: '', result: sel.result === '-' ? '' : sel.result, recall: '', fee: '등록 시 면제' }) : null;
      let html = '';
      if (ui.form) html += formCard(ctx);
      html += '<div class="grid g-side">';
      html += h.card({
        title: '이번 주 예약', sub: '2027-03-08 ~ 03-14 (예시)', pin: 1,
        right: h.opts(['전체', '상담', '입학 테스트', '재테스트'], ui.kind || '전체', { act: 'CT02.kind' }),
        body: h.table({
          cols: [
            { label: '일시', k: 'at' },
            { label: '학생', render: r => esc(h.mask(r.student)) + ' <span class="muted small">' + esc(r.grade) + '</span>' },
            { label: '구분', k: 'kind' },
            { label: '경로', k: 'route' },
            { label: '보호자', render: r => '<span class="mono small">' + esc(h.maskPhone(r.guardianPhone)) + '</span>' },
            { label: '상태', render: r => h.status(r.status) },
            { label: '결과', render: r => r.result === '-' ? '<span class="muted">-</span>' : h.chip(r.result, { '등록': 'ok', '보류': 'warn', '미등록': 'p2' }[r.result]) },
          ],
          rows: list,
          rowAttr: r => ' class="click' + (sel && r.id === sel.id ? ' sel' : '') + '" data-act="CT02.select" data-arg="' + r.id + '"',
          empty: '이번 주에는 예약이 없어요. 오른쪽 위 예약 등록으로 넣어요.',
        }),
      });
      if (sel) {
        html += '<div class="stack">';
        html += h.card({
          title: '결과 연결', sub: h.mask(sel.student) + ' · ' + sel.kind, pin: 2,
          body: sel.status !== '완료'
            ? h.alert('테스트나 상담을 마치면 결과를 붙일 수 있어요.', 'info') + '<div class="row" style="margin-top:10px">' + h.btn('완료로 바꾸기', { act: 'CT02.done', arg: sel.id, disabled: !ctx.canEdit }) + (sel.kind !== '상담' ? h.btn('입학 테스트 시작', { go: 'CT-03' }) : '') + '</div>'
            : '<div class="row">' + h.opts(['등록', '보류', '미등록'], sel.result, { act: 'CT02.result' }) + '</div>' +
              (sel.result === '등록' ? '<div class="row" style="margin-top:10px">' + h.btn('원생 등록으로 이어서 하기', { primary: true, act: 'CT02.toRegister', arg: sel.id }) + '</div>' : '') +
              (sel.result === '보류' ? '<div style="margin-top:10px"' + h.p(7) + '>' + h.alert('다시 연락할 날 ' + (rec.recall || '미정') + '. 그날 대시보드 할 일에 올라와요. 14일이 지나도록 결과가 없으면 미등록으로 바꿀지 물어봐요.', 'review', { title: '검토 반영' }) + '</div>' : ''),
        });
        html += h.card({
          title: '상담 기록', pin: 3,
          body: '<div class="stack">' +
            h.field({ label: '상담자', type: 'select', value: rec.counselor, options: ['김지원', '송하늘'], field: 'counselor', disabled: !ctx.canEdit }) +
            '<div class="field"><label>관심 분야</label>' + h.opts(['독서 습관', '글쓰기', '스피치'].map(x => ({ v: x, l: (rec.interest.includes(x) ? '✓ ' : '') + x })), '', { act: 'CT02.interest' }) + '</div>' +
            h.field({ label: '상담 내용', type: 'textarea', value: rec.memo, field: 'memo', disabled: !ctx.canEdit }) +
            h.field({ label: '다시 연락할 날', type: 'date', value: rec.recall, field: 'recall', disabled: !ctx.canEdit }) +
            '<div class="row" style="justify-content:flex-end">' + h.btn('상담 기록 저장', { act: 'CT02.saveRec', arg: sel.id, disabled: !ctx.canEdit }) + '</div></div>',
        });
        html += h.card({ title: '상담비', pin: 4, body: feeBody(ctx, sel, rec) });
        html += '</div>';
      } else {
        html += h.empty('왼쪽 목록에서 예약을 고르면 결과와 상담 기록이 보여요.');
      }
      html += '</div>';
      return html;
    },
    prd: {
      summary: '새 학생이 들어오는 첫 관문이에요. 상담과 입학 테스트 예약을 잡고, 결과와 상담 내용을 남겨요.',
      who: '원장, 실장·데스크가 쓰고 교사는 보기만 해요. 보조교사에게는 메뉴가 안 보여요.',
      items: [
        { n: 1, t: '이번 주 예약 목록', d: '한 주 단위로 상담, 입학 테스트, 재테스트 예약을 봐요. 전화, 방문, 본사 문의 연결처럼 어디서 왔는지도 함께 남겨요. 보호자 번호는 가운데를 가려서 보여 줘요.', ref: 'p.46 ①', pol: ['POL-42'] },
        { n: 2, t: '결과 연결', d: '테스트나 상담을 마치면 등록, 보류, 미등록 중 하나를 붙여요. 등록을 고르면 원생 등록 화면(CT-05)으로 이름과 연락처를 넘겨서 바로 이어 써요.', ref: 'p.46 ②' },
        { n: 3, t: '상담 기록', d: '상담자, 관심 분야, 상담 내용, 다시 연락할 날을 적어요. 상담은 사람이 직접 해요.', ref: 'p.46 ③' },
        { n: 4, t: '상담비', d: '등록하면 면제하고 등록하지 않으면 받는 안이에요. 금액과 받는 주체는 아직 정하지 않았어요.', pol: ['POL-27'], ref: 'p.46 ④' },
        { n: 5, t: '예약 등록 폼과 겹침 검사', kind: 'review', d: '원문에는 예약 등록 버튼만 있고 입력 화면이 없었어요. 학생, 학년, 보호자 연락처, 구분, 일시, 상담자를 받고, 같은 시간에 상담자나 검사 패드가 겹치면 저장을 막아요.', imp: 'IMP-18' },
        { n: 6, t: '상담 단계 개인정보 안내', kind: 'review', cond: true, reveal: 'CT02.newForm', d: '아직 원생이 아닌 아이의 이름과 보호자 번호를 받는 단계예요. 예약을 저장할 때 수집 목적과 보관 기간을 보호자에게 알렸는지 체크하게 해요. 등록하지 않으면 정해진 기간 뒤 지워요.', imp: 'IMP-07' },
        { n: 7, t: '보류 상담 후속 알림', kind: 'review', cond: true, reveal: 'CT02.result', revealArg: '보류', d: '보류로 둔 상담은 다시 연락할 날에 대시보드 할 일로 올라와요. 결과가 오래 비어 있지 않도록 14일(예시)이 지나면 정리를 권해요.', imp: 'IMP-18' },
        { n: 8, t: '교육청 확인 전에는 상담비를 받지 않아요', kind: 'review', d: '테스트비와 상담비를 교습비 외 경비로 등록해야 하는지 확인되기 전까지 수납 버튼을 잠가 둬요. 본사가 HQ-14에 등록하지 않아도 된다는 회신을 기록하면 잠금이 풀리고, 상담비 금액이 정해져 있으면 받을 수 있어요.', imp: 'IMP-08', pol: ['POL-27'] },
      ],
      open: ['상담비 금액과 받는 주체(센터 또는 본사)', '보류를 미등록으로 바꾸는 기준 기간', '예약 확인과 전날 안내 알림톡을 자동 발송에 넣을지'],
    },
  });

  // HQ-14가 저장한 교육청 확인 기록. 등록 불필요 회신이 있어야 상담비 수납이 열려요. 기록이 없으면 확인 전으로 봐요.
  const eduOf = s => (s.hq14 && s.hq14.edu) || { status: '확인 전', date: '', ref: '' };
  // HQ-14 정책 값을 센터, 센터 유형, 본사 기본값 순서로 찾아요
  function hq14v(s, c, key) {
    const v = (s.hq14 && s.hq14.vals) || {};
    const keys = [c ? 'c:' + c.id : '', c ? c.type : '', 'base'].filter(Boolean);
    for (const k of keys) if (v[k] && Object.prototype.hasOwnProperty.call(v[k], key)) return v[k][key];
    return undefined;
  }
  const consultFee = (s, c) => { const n = hq14v(s, c, 'p27_consult'); return typeof n === 'number' && n > 0 ? n : null; };
  function feeBody(ctx, sel, rec) {
    const s = ctx.s, edu = eduOf(s), open = edu.status === '등록 불필요', amt = consultFee(s, ctx.center);
    const why = edu.status === '등록 필요'
      ? '교육청 등록 대상이라는 답을 받았어요. 센터별 등록액을 받기 전까지 수납 버튼이 잠겨 있어요.'
      : '교육청에 테스트비와 상담비를 교습비 외 경비로 등록해야 하는지 서면 답을 받기 전까지 받지 않아요. 수납 버튼이 잠겨 있어요.';
    const note = open
      ? h.alert('교육청에서 등록하지 않아도 된다는 답을 받았어요' + (edu.date ? ' (' + edu.date + (edu.ref ? ', ' + edu.ref : '') + ')' : '') + '. 본사가 HQ-14에 기록해서 수납 잠금이 풀렸어요.', 'review', { title: '검토 반영' })
      : h.alert(why, 'review', { title: '검토 반영' });
    let pay;
    if (rec.paid) pay = h.chip('수납 완료', 'ok') + '<span class="small">' + esc(h.money(rec.paid.amount) + ', ' + rec.paid.at + ' ' + rec.paid.by) + '</span>';
    else {
      const block = !open ? '교육청 확인 전에는 잠겨 있어요' : !ctx.canEdit ? '보기 전용이에요' : rec.fee !== '수납' ? '등록 시 면제로 두면 받지 않아요' : amt == null ? '상담비 금액이 아직 미정이에요' : '';
      pay = h.btn('수납하기', { act: 'CT02.pay', arg: sel.id, lock: !open, disabled: !!block, title: block || null }) +
        (open && block && ctx.canEdit ? '<span class="muted small">' + esc(block) + (rec.fee === '수납' && amt == null ? '. 본사가 HQ-14에서 금액을 정하면 받을 수 있어요.' : '.') + '</span>' : '');
    }
    return h.kv([['금액', (amt != null ? '<b>' + h.money(amt) + '</b>' + h.chip('(안)', 'st-안') : '<span class="muted">아직 정하지 않았어요</span>') + ' ' + h.polChip('POL-27'), true], ['처리', rec.fee]]) +
      '<div style="margin-top:10px">' + h.opts(['등록 시 면제', '수납'].map(v => ({ v, l: v, dis: !!rec.paid })), rec.fee, { act: 'CT02.fee' }) + '</div>' +
      '<div style="margin-top:10px"' + h.p(8) + '>' + note + '</div>' +
      '<div class="row" style="margin-top:10px">' + pay + '</div>';
  }

  function formCard(ctx) {
    const ui = ctx.ui;
    return h.card({
      title: '새 예약 등록', cls: '', pin: 6,
      right: h.btn('닫기', { sm: true, act: 'CT02.closeForm' }),
      body: '<div class="grid g3">' +
        h.field({ label: '학생 이름', req: true, value: ui.f_name || '', field: 'f_name', err: ui.f_err_name }) +
        h.field({ label: '학년', type: 'select', value: ui.f_grade || '초4', options: ['초1', '초2', '초3', '초4', '초5', '초6'], field: 'f_grade' }) +
        h.field({ label: '보호자 연락처', req: true, value: ui.f_phone || '', field: 'f_phone', ph: '010-0000-0000' }) +
        h.field({ label: '구분', type: 'select', value: ui.f_kind || '입학 테스트', options: ['입학 테스트', '상담', '재테스트'], field: 'f_kind' }) +
        h.field({ label: '일시', type: 'select', value: ui.f_at || '03-09 16:00', options: ['03-08 11:00', '03-09 16:00', '03-10 15:00', '03-11 17:00'], field: 'f_at', err: ui.f_err_at }) +
        h.field({ label: '경로', type: 'select', value: ui.f_route || '전화', options: ['전화', '방문', '본사 문의 연결'], field: 'f_route' }) +
        '</div><label class="row small" style="margin-top:10px"><input type="checkbox" data-field="f_notice"' + (ui.f_notice ? ' checked' : '') + '> 보호자에게 수집 목적(상담과 테스트 안내)과 보관 기간(등록하지 않으면 30일 뒤 삭제, 예시)을 알렸어요</label>' +
        (ui.f_err_notice ? '<div class="field"><div class="err">' + esc(ui.f_err_notice) + '</div></div>' : '') +
        '<div class="row" style="justify-content:flex-end;margin-top:10px">' + h.btn('예약 저장', { primary: true, act: 'CT02.save' }) + '</div>',
    });
  }

  B.action('CT02.kind', (ctx, v) => { ctx.ui.kind = v; });
  B.action('CT02.select', (ctx, id) => { ctx.ui.sel = id; });
  B.action('CT02.newForm', ctx => { ctx.ui.form = true; });
  B.action('CT02.closeForm', ctx => { ctx.ui.form = false; });
  B.action('CT02.save', (ctx, arg) => {
    const ui = ctx.ui, s = ctx.s;
    if (arg && typeof arg === 'object') Object.assign(ui, arg); // demo can pass form values
    ui.f_err_name = !ui.f_name ? '학생 이름을 넣어 주세요.' : null;
    const at = ui.f_at || '03-09 16:00';
    const clash = s.reservations.find(r => r.center === ctx.centerId && r.at === at && r.status === '예약');
    ui.f_err_at = clash ? '이 시간에는 이미 ' + h.mask(clash.student) + ' 예약이 있어요. 검사 패드와 상담자가 겹쳐요.' : null;
    ui.f_err_notice = !ui.f_notice ? '보호자에게 수집 목적과 보관 기간을 알렸는지 체크해 주세요.' : null;
    if (ui.f_err_name || ui.f_err_at || ui.f_err_notice) return;
    const id = 'r' + (s.reservations.length + 1);
    s.reservations.unshift({ id, center: ctx.centerId, at, student: ui.f_name, grade: ui.f_grade || '초4', kind: ui.f_kind || '입학 테스트', route: ui.f_route || '전화', guardianPhone: ui.f_phone || '010-0000-0000', status: '예약', result: '-' });
    ui.sel = id; ui.form = false; ['f_name', 'f_phone', 'f_notice'].forEach(k => { ui[k] = ''; });
    B.toast('예약을 저장했어요. 보호자에게 확인 알림톡이 나가요 (검토 제안).');
  });
  B.action('CT02.done', (ctx, id) => { const r = ctx.s.reservations.find(x => x.id === (id || ctx.ui.sel)); if (r) { r.status = '완료'; ctx.ui.sel = r.id; } });
  B.action('CT02.result', (ctx, v) => {
    const r = ctx.s.reservations.find(x => x.id === ctx.ui.sel) || ctx.s.reservations.find(x => x.status === '완료');
    if (!r) return; r.result = v; ctx.ui.sel = r.id;
    const rec = ctx.s.consults[r.id] = ctx.s.consults[r.id] || { counselor: ctx.persona.name, interest: [], memo: '', recall: '', fee: '등록 시 면제' };
    rec.result = v; if (v === '보류' && !rec.recall) rec.recall = '2027-03-12';
  });
  B.action('CT02.interest', (ctx, v) => { const r = ctx.ui.sel || 'r4'; const rec = ctx.s.consults[r]; if (!rec) return; rec.interest = rec.interest.includes(v) ? rec.interest.filter(x => x !== v) : rec.interest.concat(v); });
  B.action('CT02.saveRec', (ctx, id) => { const rec = ctx.s.consults[id]; if (!rec) return; ['counselor', 'memo', 'recall'].forEach(k => { if (ctx.ui[k] != null) rec[k] = ctx.ui[k]; }); B.toast('상담 기록을 저장했어요.'); });
  B.action('CT02.fee', (ctx, v) => { const rec = ctx.s.consults[ctx.ui.sel || 'r4']; if (rec && !rec.paid) rec.fee = v; });
  // 상담비 수납. HQ-14에 등록 불필요 회신이 기록되기 전에는 받지 않아요.
  B.action('CT02.pay', (ctx, arg) => {
    const s = ctx.s, edu = eduOf(s);
    if (edu.status !== '등록 불필요') { B.toast(edu.status === '등록 필요' ? '교육청 등록 대상이라 센터별 등록액을 받기 전에는 상담비를 받지 않아요.' : '교육청 확인 전에는 상담비를 받지 않아요.'); return false; }
    const lvl = B.perm('CT-02', ctx.persona); if (lvl !== '●' && lvl !== '◐') { B.toast('보기 전용이라 수납할 수 없어요.'); return false; }
    const id = (arg && typeof arg === 'object' ? arg.res : arg) || ctx.ui.sel;
    const r = s.reservations.find(x => x.id === id); if (!r) return false;
    const rec = s.consults[r.id] = s.consults[r.id] || { counselor: ctx.persona.name, interest: [], memo: '', recall: '', fee: '등록 시 면제' };
    if (arg && typeof arg === 'object' && arg.fee) rec.fee = arg.fee;
    if (rec.paid) { B.toast('이미 받은 상담비예요.'); return false; }
    if (rec.fee !== '수납') { B.toast('처리를 수납으로 바꾼 뒤에 받아요. 등록 시 면제로 두면 받지 않아요.'); return false; }
    const amt = consultFee(s, B.center(r.center) || ctx.center);
    if (amt == null) { B.toast('상담비 금액이 아직 미정이라 받을 수 없어요. 본사가 HQ-14에서 금액을 정해야 해요.'); return false; }
    rec.paid = { amount: amt, at: ctx.today, by: ctx.persona.name, method: '카드 단말기' };
    ctx.ui.sel = r.id;
    B.toast('상담비 ' + h.money(amt) + '을 받았어요.');
  });
  B.action('CT02.toRegister', (ctx, id) => {
    const r = ctx.s.reservations.find(x => x.id === id); if (!r) return;
    const reg = ctx.s.ui['CT-05'] = ctx.s.ui['CT-05'] || {};
    Object.assign(reg, { from: r.id, name: r.student, grade: r.grade, phone: r.guardianPhone });
    B.go('CT-05'); return false;
  });
})();
