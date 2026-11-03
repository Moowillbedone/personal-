/* UI kit shared by every screen. All helpers return HTML strings. Pins: pass {pin: n} to put a numbered marker on the element. */
(function () {
  const B = window.B;
  const esc = B.esc;
  const P = n => (n == null ? '' : ' data-pin="' + n + '"');
  const attrs = o => Object.keys(o || {}).filter(k => o[k] != null && o[k] !== false).map(k => ' ' + k + '="' + esc(o[k]) + '"').join('');
  const h = B.h = {};
  h.esc = esc;
  h.p = P;
  h.money = n => (n == null || n === '' ? '-' : Number(n).toLocaleString('ko-KR') + '원');
  h.num = n => (n == null ? '-' : Number(n).toLocaleString('ko-KR'));
  h.mask = name => { name = String(name || ''); return name.length < 2 ? name : name[0] + '*' + name.slice(2); };
  h.maskPhone = ph => String(ph || '').replace(/(\d{3})-?(\d{3,4})-?(\d{4})/, '$1-****-$3');
  h.chip = (t, cls) => '<span class="chip ' + (cls || '') + '">' + esc(t) + '</span>';
  const STATUS = {
    '운영': 'ok', '완료': 'ok', '수납 완료': 'ok', '확정': 'st-확정', '정상': 'ok', '재원': 'ok', '출석': 'ok', '승인': 'ok', '발송 완료': 'ok', '입금 완료': 'ok', '해결': 'ok', '통과': 'ok',
    '승인 대기': 'warn', '대기': 'warn', '휴원': 'warn', '미수': 'bad', '미납': 'bad', '연체': 'bad', '결석': 'bad', '거절': 'bad', '실패': 'bad', '퇴원': 'p2', '계약 종료': 'p2', '폐점': 'p2',
    '계획': 'p2', '예약': 'info', '진행 중': 'info', '접수': 'info', '검토 중': 'warn', '보완 요청': 'warn', '이의 신청': 'warn', '잠김': 'bad', '열림': 'ok', '(안)': 'st-안', '안': 'st-안', '미정': 'st-미정', '예시': 'st-예시', '법정': 'st-법정',
  };
  h.status = t => h.chip(t, STATUS[t] || '');
  h.kpi = o => '<div class="kpi ' + (o.tone || '') + '"' + P(o.pin) + '><div class="l">' + esc(o.l) + '</div><div class="v">' + (o.raw ? o.v : esc(o.v)) + '</div>' + (o.s ? '<div class="s">' + (o.raw ? o.s : esc(o.s)) + '</div>' : '') + '</div>';
  h.kpis = (arr, cols) => '<div class="grid g' + (cols || Math.min(4, arr.length)) + '">' + arr.map(h.kpi).join('') + '</div>';
  h.card = o => '<section class="card ' + (o.cls || '') + '"' + P(o.pin) + (o.id ? ' id="' + o.id + '"' : '') + '>' +
    ((o.title || o.right) ? '<div class="card-h"><h3>' + esc(o.title || '') + '</h3>' + (o.sub ? '<span class="sub">' + esc(o.sub) + '</span>' : '') + (o.right ? '<div class="r">' + o.right + '</div>' : '') + '</div>' : '') + (o.body || '') + '</section>';
  h.table = o => {
    const cols = o.cols || [];
    const head = '<tr>' + cols.map(c => '<th class="' + (c.num ? 'num' : '') + '"' + (c.w ? ' style="width:' + c.w + '"' : '') + '>' + esc(c.label) + '</th>').join('') + '</tr>';
    const rows = (o.rows || []).map((r, i) => '<tr' + (o.rowAttr ? o.rowAttr(r, i) : '') + '>' + cols.map(c => '<td class="' + (c.num ? 'num' : '') + '">' + (c.render ? c.render(r, i) : esc(r[c.k])) + '</td>').join('') + '</tr>').join('');
    const body = rows || '<tr><td colspan="' + cols.length + '"><div class="empty" style="border:0">' + esc(o.empty || '아직 데이터가 없어요.') + '</div></td></tr>';
    return '<div class="tbl-wrap"' + P(o.pin) + '><table class="tbl"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
  };
  h.btn = (label, o) => {
    o = o || {};
    const cls = 'btn' + (o.primary ? ' primary' : '') + (o.danger ? ' danger' : '') + (o.ghost ? ' ghost' : '') + (o.sm ? ' sm' : '') + (o.disabled ? ' disabled' : '');
    return '<button type="button" class="' + cls + '"' + attrs({ 'data-act': o.act, 'data-arg': o.arg, 'data-go': o.go, 'data-go-tab': o.goTab, title: o.title, id: o.id }) + (o.disabled ? ' disabled aria-disabled="true"' : '') + P(o.pin) + '>' + (o.lock ? '<span class="lock">잠김</span>' : '') + esc(label) + '</button>';
  };
  h.field = o => {
    o = o || {};
    let input;
    const a = attrs({ id: o.id, name: o.name, placeholder: o.ph, 'data-field': o.field });
    if (o.type === 'select') input = '<select class="inp' + (o.err ? ' bad' : '') + '"' + a + (o.disabled ? ' disabled' : '') + '>' + (o.options || []).map(x => { const v = typeof x === 'string' ? x : x.v, l = typeof x === 'string' ? x : x.l; return '<option' + (String(v) === String(o.value) ? ' selected' : '') + ' value="' + esc(v) + '">' + esc(l) + '</option>'; }).join('') + '</select>';
    else if (o.type === 'textarea') input = '<textarea class="inp' + (o.err ? ' bad' : '') + '"' + a + (o.disabled ? ' disabled' : '') + '>' + esc(o.value || '') + '</textarea>';
    else if (o.type === 'static') input = '<div class="inp" style="border-color:transparent;background:transparent;padding-left:0;font-weight:600">' + (o.raw ? o.value : esc(o.value)) + '</div>';
    else input = '<input class="inp' + (o.err ? ' bad' : '') + '" type="' + (o.type || 'text') + '" value="' + esc(o.value == null ? '' : o.value) + '"' + a + (o.readonly ? ' readonly' : '') + (o.disabled ? ' disabled' : '') + '>';
    return '<div class="field"' + P(o.pin) + '>' + (o.label ? '<label' + (o.id ? ' for="' + esc(o.id) + '"' : '') + '>' + esc(o.label) + (o.req ? '<span class="req">*</span>' : '') + (o.pol ? ' ' + h.polChip(o.pol) : '') + '</label>' : '') + input +
      (o.err ? '<div class="err">' + esc(o.err) + '</div>' : '') + (o.hint ? '<div class="hint">' + (o.rawHint ? o.hint : esc(o.hint)) + '</div>' : '') + '</div>';
  };
  h.opts = (list, cur, o) => {
    o = o || {};
    return '<div class="opts"' + P(o.pin) + '>' + list.map(x => {
      const v = typeof x === 'string' ? x : x.v, l = typeof x === 'string' ? x : x.l, dis = typeof x === 'object' && x.dis;
      return '<button type="button" class="opt' + (String(v) === String(cur) ? ' on' : '') + (dis ? ' dis' : '') + '"' + attrs({ 'data-act': dis ? null : o.act, 'data-arg': v, title: typeof x === 'object' ? x.title : null }) + '>' + esc(l) + '</button>';
    }).join('') + '</div>';
  };
  h.alert = (text, tone, o) => { o = o || {}; return '<div class="alert ' + (tone || 'info') + '"' + P(o.pin) + '>' + (o.title ? '<b>' + esc(o.title) + '</b>' : '') + '<div>' + (o.raw ? text : esc(text)) + '</div></div>'; };
  h.empty = (text, o) => '<div class="empty"' + P((o || {}).pin) + '>' + esc(text) + '</div>';
  h.steps = (arr, o) => '<div class="steps"' + P((o || {}).pin) + '>' + arr.map((s, i) => '<div class="step ' + (s.state || '') + '"><i>' + (s.state === 'done' ? '✓' : i + 1) + '</i>' + esc(s.label) + '</div>').join('') + '</div>';
  h.kv = (pairs, o) => '<dl class="kv"' + P((o || {}).pin) + '>' + pairs.map(([k, v, raw]) => '<dt>' + esc(k) + '</dt><dd>' + (raw ? v : esc(v)) + '</dd>').join('') + '</dl>';
  h.toggle = (on, o) => { o = o || {}; return '<button type="button" class="toggle' + (on ? ' on' : '') + '" role="switch" aria-checked="' + (on ? 'true' : 'false') + '"' + attrs({ 'data-act': o.act, 'data-arg': o.arg, title: o.title }) + P(o.pin) + '></button>'; };
  h.bar = (pct, o) => '<div class="bar"' + P((o || {}).pin) + '><i style="width:' + Math.max(0, Math.min(100, pct)) + '%;' + ((o || {}).color ? 'background:' + o.color : '') + '"></i></div>';
  h.row = (inner, o) => '<div class="row ' + ((o || {}).cls || '') + '"' + P((o || {}).pin) + '>' + inner + '</div>';

  /* ---------------- policies ---------------- */
  h.pol = code => (B.POLICIES || []).find(p => p.code === code) || { code, name: code, now: '-', status: '미정' };
  h.polChip = code => { const p = h.pol(code); return '<span class="chip st-' + p.status + '" title="' + esc(p.name + ', 지금 값 ' + p.now) + '">' + esc(code) + '</span>'; };
  // Effective value for a center: center value, then group value, then HQ default (12쪽 값을 찾는 순서)
  h.polValue = (code, center) => {
    const st = (B.store.pol || {})[code] || {};
    if (center && st.centers && st.centers[center.id]) return Object.assign({ from: '개별 센터' }, st.centers[center.id]);
    if (center && st.groups && st.groups[center.type]) return Object.assign({ from: '그룹 ' + center.type }, st.groups[center.type]);
    return { value: st.value != null ? st.value : h.pol(code).now, status: st.status || h.pol(code).status, from: '본사 기본값', next: st.reserved };
  };
  h.pv = (code, center, o) => {
    o = o || {};
    const v = h.polValue(code, center);
    const stt = v.status || h.pol(code).status;
    return '<span class="pv"' + P(o.pin) + '><b>' + esc(v.value) + '</b>' + (stt && stt !== '확정' ? h.chip(stt === '안' ? '(안)' : stt, 'st-' + stt) : '') +
      (o.from ? '<span class="muted small">' + esc(v.from) + '</span>' : '') + (v.next ? '<span class="next">' + esc(v.next.date) + '부터 ' + esc(v.next.value) + '</span>' : '') + '</span>';
  };

  /* HQ-08 편집 공통 패턴: scope tabs, value, status, center permission, range, start date, 근거, impact preview, history */
  h.policyEditor = (code, ctx, o) => {
    o = o || {};
    const p = h.pol(code), st = B.store.pol[code] = B.store.pol[code] || {};
    const ui = ctx.ui;
    const scope = ui[code + ':scope'] || '본사 기본값';
    const centers = B.store.centers.filter(c => c.status !== '계획');
    const scopes = ['본사 기본값', '직영', '가맹', '테스트베드', '개별 센터 (' + Object.keys(st.centers || {}).length + ')'];
    const draft = ui[code + ':draft'] != null ? ui[code + ':draft'] : (st.value != null ? st.value : p.now);
    const reason = ui[code + ':reason'] || '';
    const when = ui[code + ':when'] || '즉시';
    const contract = o.contract || ['POL-01', 'POL-02', 'POL-03', 'POL-04', 'POL-05', 'POL-06', 'POL-07', 'POL-08', 'POL-09'].includes(code);
    const affected = centers.filter(c => scope.startsWith('개별') ? (st.centers || {})[c.id] : scope === '본사 기본값' ? !((st.centers || {})[c.id]) && !((st.groups || {})[c.type]) : c.type === scope);
    const ro = !ctx.canEdit;
    const hist = (st.history || []).slice().reverse();
    return '<div class="stack">' +
      '<div class="card"' + P(o.pins && o.pins.scope) + '><div class="card-h"><h3>' + esc(p.code + ' ' + p.name) + '</h3>' + h.chip(p.status === '안' ? '(안)' : p.status, 'st-' + p.status) + '<span class="sub">' + esc(p.catName) + ', 결정 ' + esc(p.decider) + ', ' + esc(p.when) + '</span></div>' +
      h.opts(scopes, scope.startsWith('개별') ? scopes[4] : scope, { act: 'pe.scope' }).replace(/data-arg="([^"]*)"/g, (m, v) => 'data-arg="' + esc(code + '|' + v) + '"') +
      '<div class="grid g3" style="margin-top:12px">' +
      h.field({ label: '값', value: draft, id: 'pe-' + code, field: code + ':draft', pin: o.pins && o.pins.value, hint: '지금 표시값 ' + p.now, disabled: ro }) +
      h.field({ label: '상태', type: 'select', value: st.status || p.status, options: ['미정', '안', '예시', '확정', '법정'].map(x => ({ v: x, l: x === '안' ? '미확정(안)' : x })), field: code + ':status', disabled: ro || p.status === '법정' }) +
      h.field({ label: '적용 시작', type: 'select', value: when, options: ['즉시', '2027-04-01 0시 예약', '2027-05-01 0시 예약'], field: code + ':when', pin: o.pins && o.pins.when, disabled: ro }) +
      '</div><div class="grid g2" style="margin-top:10px">' +
      h.field({ label: '센터 권한', type: 'static', value: '직영은 ' + p.direct + ', 가맹은 ' + p.franchise, pin: o.pins && o.pins.perm }) +
      h.field({ label: '근거' + (contract ? ' (가맹 계약에 영향, 필수)' : ''), req: contract, value: reason, field: code + ':reason', ph: '회의록, 결재 문서, 계약 조항 번호', pin: o.pins && o.pins.reason, err: ui[code + ':err'], disabled: ro }) +
      '</div></div>' +
      '<div class="card"' + P(o.pins && o.pins.impact) + '><div class="card-h"><h3>바꾸기 전에 미리 보기</h3><span class="sub">영향 센터 수와 금액 변화를 먼저 보여 줘요</span></div>' +
      h.kv([['영향 센터', affected.length + '곳 (' + (affected.map(c => c.name).join(', ') || '없음') + ')'], ['개별 값이 있는 센터', Object.keys(st.centers || {}).map(id => (B.center(id) || {}).name + ' ' + st.centers[id].value).join(', ') || '없음 (개별 값은 그대로 유지돼요)'], ['적용 시점', when === '즉시' ? '저장하는 즉시' : when]]) +
      '<div class="row" style="margin-top:12px;justify-content:flex-end">' + h.btn('변경 저장', { primary: true, act: 'pe.save', arg: code, disabled: ro, pin: o.pins && o.pins.save }) + '</div></div>' +
      '<div class="card"' + P(o.pins && o.pins.history) + '><div class="card-h"><h3>이 정책의 변경 이력</h3></div>' +
      (hist.length ? '<div class="tl">' + hist.map(x => '<div><b>' + esc(x.date) + '</b> ' + esc(x.by) + '님이 ' + esc(x.from) + '에서 ' + esc(x.to) + '로 바꿨어요. 근거는 ' + esc(x.reason) + ', 영향 센터는 ' + esc(x.n) + '곳이에요.</div>').join('') + '</div>' : h.empty('아직 바꾼 기록이 없어요.')) + '</div></div>';
  };
  B.action('pe.scope', (ctx, arg) => { const [code, v] = arg.split('|'); ctx.ui[code + ':scope'] = v; });
  B.action('pe.save', (ctx, code) => {
    const ui = ctx.ui;
    readFields(ui);
    const p = h.pol(code), st = B.store.pol[code] = B.store.pol[code] || {};
    const contract = ['POL-01', 'POL-02', 'POL-03', 'POL-04', 'POL-05', 'POL-06', 'POL-07', 'POL-08', 'POL-09'].includes(code);
    if (contract && !(ui[code + ':reason'] || '').trim()) { ui[code + ':err'] = '가맹 계약에 영향을 주는 정책은 근거 없이 저장할 수 없어요.'; return; }
    ui[code + ':err'] = null;
    const to = ui[code + ':draft'] != null ? ui[code + ':draft'] : p.now, from = st.value != null ? st.value : p.now, when = ui[code + ':when'] || '즉시';
    const n = B.store.centers.filter(c => c.status !== '계획').length;
    st.history = st.history || [];
    st.history.push({ date: B.store.today, from, to, by: B.persona().name, reason: ui[code + ':reason'] || '-', n });
    if (when === '즉시') st.value = to; else st.reserved = { date: when.slice(5, 10).replace('-', '/'), value: to };
    if (ui[code + ':status']) st.status = ui[code + ':status'];
    B.toast(when === '즉시' ? code + ' 값을 바꿨어요. 모든 화면에 바로 반영돼요.' : code + ' 변경을 예약했어요. 그날 0시에 바뀌어요.');
  });
  function readFields(ui) {
    Array.prototype.forEach.call(document.querySelectorAll('#app [data-field]'), el => { ui[el.getAttribute('data-field')] = el.value; });
  }
  h.readFields = readFields;
  B.readForm = function (ui) { readFields(ui); return ui; };
})();
