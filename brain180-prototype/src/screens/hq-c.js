/* HQ-10~15 정책·요금 설정 (원문 29~34쪽).
   HQ-08 편집 공통 패턴(범위 탭, 저장 전 값, 변경 예약, 근거, 영향 미리보기, 변경 이력)을 여섯 화면이 같은 엔진으로 쓰고,
   화면마다 원문 와이어프레임의 고유 표와 미리보기를 그린다. 저장하면 B.store.pol[코드].history 에도 HQ-08과 같은 모양으로 남긴다. */
(function () {
  const B = window.B, h = B.h, esc = B.esc;
  const SC = ['본사 기본값', '직영', '가맹', '테스트베드', '개별 센터'];
  const WHEN = ['즉시', '2027-04-01 0시 예약', '2027-05-01 0시 예약'];
  const CFG = {};
  const K = sid => 'hq' + sid.slice(3);
  const A = sid => sid.replace('-', '');
  const WEEKS = [1, 2, 3, 4, 5], MINS = [60, 90, 120];

  /* ---------------- styles (scoped to .hqc) ---------------- */
  const CSS = [
    '.hqc .tabs.hqc-scope{margin-bottom:10px;align-items:center}',
    '.hqc-dirty{margin-left:auto;font-size:11.5px;font-weight:700;color:var(--warn);background:var(--warn-soft);border-radius:6px;padding:2px 8px}',
    '.hqc-sub{margin:-2px 0 10px}',
    '.hqc-o{display:inline-flex;align-items:center;gap:5px;border:0;background:none;padding:3px 6px;border-radius:6px;font-size:12.3px;color:var(--ink);line-height:1.4}',
    '.hqc-o:hover{background:var(--line-2)}',
    '.hqc-o.on{color:var(--navy);font-weight:700}',
    '.hqc-o:disabled{cursor:not-allowed;opacity:.65}',
    '.hqc-o .rd,.hqc-o .cb,.hqc-fx .cb{width:13px;height:13px;border:1.5px solid #9aa3b2;display:inline-block;position:relative;flex:none}',
    '.hqc-o .rd{border-radius:50%}',
    '.hqc-o .cb,.hqc-fx .cb{border-radius:3px}',
    '.hqc-o.on .rd{border-color:var(--navy)}',
    '.hqc-o.on .rd::after{content:"";position:absolute;inset:2px;border-radius:50%;background:var(--navy)}',
    '.hqc-o.on .cb,.hqc-fx .cb{background:var(--navy);border-color:var(--navy)}',
    '.hqc-o.on .cb::after,.hqc-fx .cb::after{content:"";position:absolute;left:3px;top:0;width:4px;height:7px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}',
    '.hqc-fx{display:inline-flex;align-items:center;gap:5px;font-size:12.3px}',
    '.hqc-fx .cb{opacity:.55}',
    '.hqc-opts{display:inline-flex;flex-wrap:wrap;gap:0 2px;border-radius:7px}',
    '.hqc-opts.ov{background:var(--navy-soft)}',
    '.hqc-in{display:inline-block;width:76px;min-height:28px;padding:3px 7px;font-variant-numeric:tabular-nums}',
    '.hqc-in.ov{background:var(--navy-soft);border-color:#9db1e6}',
    'select.hqc-in{width:auto;padding-right:4px}',
    '.hqc-next{font-size:11px;color:var(--info);font-weight:700;margin-left:4px;white-space:nowrap}',
    '.hqc-val{display:flex;align-items:center;gap:4px 6px;flex-wrap:wrap}',
    '.hqc-ptbl td{padding:6px 10px}',
    '.hqc-ptbl td.code{font-family:var(--mono);font-weight:600;white-space:nowrap;font-size:11.5px}',
    '.hqc-ptbl .hqc-pn{font-weight:700;display:inline-block;padding-left:16px}',
    '.hqc .hqc-tp{padding-left:18px}',
    '.hqc-st{border:1px solid var(--line);background:#fff;border-radius:6px;padding:2px 10px;font-size:11.5px;font-weight:700}',
    '.hqc-st.on{border-color:#a9dcbd;background:var(--ok-soft);color:var(--ok)}',
    '.hqc-st.off{color:var(--mute);border-style:dashed}',
    '.hqc .nw{white-space:nowrap}',
    '.hqc-kvt th{width:104px;vertical-align:middle}',
    '.hqc-kvt td{padding:6px 10px}',
    '.hqc-grid td{padding:6px 8px}',
    '.hqc-cell{display:inline-flex;align-items:center;gap:2px}',
    '.hqc-x{border:0;background:none;color:var(--mute);padding:0 4px;font-size:11.5px;text-decoration:underline;text-underline-offset:2px}',
    '.hqc-x:hover{color:var(--bad)}',
    '.hqc-off{border:1px dashed #cfd4dc;background:#fafbfc;color:var(--mute);border-radius:6px;padding:3px 10px;font-size:12px}',
    '.hqc-off:hover{border-color:var(--navy);color:var(--navy)}',
    '.hqc-line{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:10px}',
    '.hqc-hint{font-size:11.5px;color:var(--mute);margin-top:6px}',
    '.hqc-subh{font-size:12px;font-weight:700;color:var(--sub);margin:12px 0 6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}',
    '.hqc-rvbox{border:1px dashed #c9b6f2;background:#fbf9ff;border-radius:9px;padding:10px 12px;margin-top:12px}',
    '.hqc-rvbox .hqc-subh{margin-top:0}',
    '.hqc-rv{display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap}',
    '.hqc-ul{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:3px;font-size:12.5px}',
    '.hqc-note{background:#f1f2f4;border-left:3px solid #8a92a2;border-radius:6px;padding:9px 12px;font-size:12.3px;color:#3b4352}',
    '.hqc-preview{border:1.5px dashed #c9ced8;border-radius:10px;padding:16px;text-align:center;color:var(--sub);font-size:12.5px;line-height:1.7;margin-top:10px}',
    '.hqc-preview b{color:var(--ink);font-size:13.5px}',
    '.hqc-amt{font-size:15px}',
    '.hqc-err{color:var(--bad);font-size:11px;font-weight:600}',
    '.hqc-review{border:2px solid var(--navy);box-shadow:0 6px 20px rgba(31,63,143,.12)}',
    '.hqc-big{font-size:14px}',
    '.hqc-res{border-radius:9px;padding:10px 12px;font-size:12.5px;line-height:1.6;margin-top:10px}',
    '.hqc .tbl .num{text-align:right}',
    '.hqc .kv{grid-template-columns:96px minmax(0,1fr)}',
    '.hqc-bal td{white-space:nowrap;padding:7px 8px}',
    '.hqc-bal td:last-child{white-space:normal}',
  ].join('\n');
  (function inject() {
    if (typeof document === 'undefined' || document.getElementById('hqc-css')) return;
    const el = document.createElement('style'); el.id = 'hqc-css'; el.textContent = CSS; (document.head || document.body).appendChild(el);
  })();

  /* ---------------- seed data ---------------- */
  const TPL = {
    '학년별 4레벨': [
      { code: 'L1', name: '새싹', grade: '초2~3', score: '0~39', books: '6권', status: '사용' },
      { code: 'L2', name: '줄기', grade: '초3~4', score: '40~59', books: '6권', status: '사용' },
      { code: 'L3', name: '가지', grade: '초4~5', score: '60~79', books: '5권', status: '준비' },
      { code: 'L4', name: '열매', grade: '초5~6', score: '80~100', books: '5권', status: '준비' },
    ],
    '무학년 12단계': Array.from({ length: 12 }, (_, i) => ({ code: 'L' + (i + 1), name: '', grade: '전 학년', score: '', books: '', status: '준비' })),
    '저학년 2레벨': [{ code: 'L1', name: '', grade: '', score: '', books: '', status: '준비' }, { code: 'L2', name: '', grade: '', score: '', books: '', status: '준비' }],
  };
  const LEGAL = { a: '2/3', b: '1/2', c: '반환 없음', d: 5 };

  B.extend(s => {
    const t = {};
    WEEKS.forEach(w => MINS.forEach(m => { t['t_' + w + '_' + m] = null; }));
    Object.assign(t, { t_1_90: 150000, t_2_90: 260000, t_3_90: 360000, direct_fixed: true, dev_pct: 10, disc_sib: 10, disc_long: 5, disc_cap: 20, x_book: 15000, x_book_reg: '등록 완료' });
    // 직영 센터 교육청 등록액: 원문 52쪽(CT-07 대치1) 표 그대로. 목동, 분당은 같은 값(예시). 주 3회는 360,000원으로 변경신고 중.
    const reg = () => ({ t_1_90: { amt: 150000, st: '등록' }, t_2_90: { amt: 280000, st: '등록' }, t_3_90: { amt: 340000, st: '변경신고 중', next: 360000 } });
    s.hq10 = { vals: { base: t }, pending: [], log: [], edu: { daechi1: reg(), mokdong: reg(), bundang: reg() } };
    s.hq11 = {
      vals: { base: { p15: ['학원'], p16_cap: 15, p16_ratio: 10, p18: '월', p19: '', p20: '', p21_allow: true, p21_max: 1, p21_mode: '다음 달 차감', p22_n: 2, p22_due: '2주', p23: '', p23_grace: 5, p24_day: 20, p24_auto: true } },
      pending: [], log: [],
      hol: [{ from: '2027-02-06', to: '2027-02-09', name: '설날 연휴' }, { from: '2027-03-01', to: '2027-03-01', name: '삼일절' }, { from: '2027-08-02', to: '2027-08-06', name: '본사 지정 휴원 (예시)' }],
    };
    const up = { p14_refund: '미정', round: 10 };
    s.centers.filter(c => c.type !== '직영' && c.status !== '계획').forEach(c => { up['up_' + c.id + '_a'] = LEGAL.a; up['up_' + c.id + '_b'] = LEGAL.b; up['up_' + c.id + '_c'] = LEGAL.c; up['up_' + c.id + '_d'] = LEGAL.d; });
    s.hq12 = { vals: { base: up }, pending: [], log: [], ver: [{ v: 'v1', date: '2027-01-01', by: '정본부', note: '법정 기준 그대로 (예시)' }] };
    s.hq13 = { vals: { base: { p32: '학년별 4레벨', levels: B.clone(TPL['학년별 4레벨']), p31_min: '초1', p31_max: '초6', p31_block: true, p33: '', p33_avg: 80, p33_months: 3, p33_retest: 6, apply: '2028-01-01', map: {} } }, pending: [], log: [] };
    s.hq14 = {
      vals: { base: { p26: '', p27_payer: '', p27_fee: 50000, p27_promo: 30000, p27_end: '2027-12-31', p27_consult: '', p27_waive: true, p27_hq: '없음', p27_hq_amt: '', p27_hq_reason: '', p28_amt: 20000, p28_days: 30, p29_months: 6, p30_ways: ['현장 출력'], p30_days: 30, unreg_days: 30 } },
      pending: [], log: [], edu: { status: '확인 전', date: '', ref: '' },
    };
    s.hq15 = {
      vals: {
        base: { p34_price: 7, p34_mode: '선불 충전', p34_refund: true, p35: ['입실', '퇴실', '수납 안내', '미납', '재등록'], p36_direct: '결제선생', p36_fr: '수기 기록', p37: ['카드', '계좌', '현금', '지역화폐', '결제선생 링크'], p38: '', p39: '번호', p40: '', p42_mask: true, p42_who: '슈퍼관리자', p43_re: '수집 항목 추가 시', p34_warn: 3, p34_guard: true },
        'c:busan': { p39: 'QR' },
      },
      pending: [], log: [],
      // 최근 7일 하루 평균 알림톡 사용액(원, 예시). CT-14가 같은 값을 갖고 있으면 그 값을 써요.
      avg7: { busan: 1560, daegu: 1600 },
    };
    s.pol['POL-39'] = s.pol['POL-39'] || {};
    s.pol['POL-39'].centers = Object.assign({ busan: { value: 'QR (테스트베드 시험)', status: '예시' } }, s.pol['POL-39'].centers || {});
  });

  /* ---------------- engine: values, draft, scope ---------------- */
  const same = (a, b) => JSON.stringify(a == null ? null : a) === JSON.stringify(b == null ? null : b);
  const money = n => (n === '' || n == null) ? '-' : (typeof n === 'number' ? n.toLocaleString('ko-KR') : String(n));
  const toNum = v => { const t = String(v == null ? '' : v).replace(/[^\d.\-]/g, ''); return t === '' ? NaN : Number(t); };
  const isInt = (v, min, max) => typeof v === 'number' && Math.floor(v) === v && v >= (min == null ? -Infinity : min) && v <= (max == null ? Infinity : max);
  const uniq = a => Array.from(new Set(a));
  const mdS = t => { const m = /(\d{4})-(\d\d)-(\d\d)/.exec(t || ''); return m ? (+m[2]) + '/' + (+m[3]) : String(t || ''); };
  function st(ctx, sid) { return ctx.s[K(sid)]; }
  function opCenters() { return B.store.centers.filter(c => c.status !== '계획'); }
  function ro(ctx) { return !ctx.canEdit || ctx.role === '정산'; }
  function scopeK(ui) { const sc = ui.scope || SC[0]; if (sc === SC[0]) return 'base'; if (sc === '개별 센터') return 'c:' + (ui.center || 'daechi1'); return sc; }
  function scopeName(k) { if (k === 'base') return '본사 기본값'; if (k.indexOf('c:') === 0) { const c = B.center(k.slice(2)); return (c ? c.name : k) + ' 개별'; } return k + ' 그룹'; }
  function chain(k) {
    if (k === 'base') return ['base'];
    if (k.indexOf('c:') === 0) { const c = B.center(k.slice(2)); return [k, c ? c.type : null, 'base'].filter(Boolean); }
    return [k, 'base'];
  }
  function eff(ctx, sid, k, key, savedOnly) {
    const d = ctx.ui.draft || {}, v = st(ctx, sid).vals;
    for (const x of chain(k)) {
      if (!savedOnly && d[x] && Object.prototype.hasOwnProperty.call(d[x], key)) return d[x][key];
      if (v[x] && Object.prototype.hasOwnProperty.call(v[x], key)) return v[x][key];
    }
    return undefined;
  }
  // 범위 탭과 상관없이 본사 기본값에 두는 키 (HQ-12 센터별 상향 행), 범위 탭이 없는 화면(HQ-13)
  function kOf(ctx, sid, key) { const c = CFG[sid]; return c.noScope || (c.baseKeys && c.baseKeys.test(key)) ? 'base' : scopeK(ctx.ui); }
  function get(ctx, sid, key) { return eff(ctx, sid, kOf(ctx, sid, key), key); }
  function cur(ctx, sid, key) { const f = ctx.ui['f:' + key]; return f != null ? f : get(ctx, sid, key); }
  function setD(ctx, k, key, v) { const ui = ctx.ui; ui.draft = ui.draft || {}; ui.draft[k] = ui.draft[k] || {}; ui.draft[k][key] = v; }
  function set(ctx, sid, key, v) { if (!same(v, get(ctx, sid, key))) setD(ctx, kOf(ctx, sid, key), key, v); }
  function norm(sid, key, v) {
    const c = CFG[sid];
    if (c.num && c.num.test(key) && (typeof v === 'string' || typeof v === 'number')) {
      const t = String(v).replace(/[,\s원%일명회개월건]/g, '');
      if (t === '') return '';
      if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
      return String(v).trim();
    }
    return typeof v === 'string' ? v.trim() : v;
  }
  function absorb(ctx, sid) {
    const ui = ctx.ui, c = CFG[sid];
    if (c.absorb) c.absorb(ctx);
    Object.keys(ui).filter(x => x.indexOf('f:') === 0).forEach(x => { const key = x.slice(2); set(ctx, sid, key, norm(sid, key, ui[x])); delete ui[x]; });
  }
  function isOv(ctx, sid, key) {
    const k = kOf(ctx, sid, key); if (k === 'base') return false;
    const d = (ctx.ui.draft || {})[k], v = st(ctx, sid).vals[k];
    return !!((d && Object.prototype.hasOwnProperty.call(d, key)) || (v && Object.prototype.hasOwnProperty.call(v, key)));
  }
  const own = (o, key) => !!o && Object.prototype.hasOwnProperty.call(o, key);
  function changes(ctx, sid) {
    const d = ctx.ui.draft || {}, vals = st(ctx, sid).vals, out = [];
    Object.keys(d).forEach(k => Object.keys(d[k]).forEach(key => {
      const from = eff(ctx, sid, k, key, true), to = d[k][key];
      // 위 단계 값이 함께 바뀌면, 지금 값과 같은 하위 값도 따로 고정해야 하므로 변경으로 본다
      const parentMoving = k !== 'base' && chain(k).slice(1).some(x => own(d[x], key) && !same(d[x][key], eff(ctx, sid, x, key, true)));
      const changed = own(vals[k], key) ? !same(vals[k][key], to) : (!same(from, to) || parentMoving);
      if (changed) out.push({ k, key, from, to, code: CFG[sid].code(key, from, to) });
    }));
    return out;
  }
  function affected(ctx, sid, list) {
    const vals = st(ctx, sid).vals, names = [];
    uniq(list.map(x => x.k)).forEach(k => {
      const keys = list.filter(x => x.k === k).map(x => x.key);
      opCenters().forEach(c => {
        if (k.indexOf('c:') === 0) { if (c.id === k.slice(2)) names.push(c.name); return; }
        if (k !== 'base' && c.type !== k) return;
        const d = ctx.ui.draft || {}, ck = 'c:' + c.id;
        const fixed = keys.every(key => own(vals[ck], key) || own(d[ck], key) || (k === 'base' && (own(vals[c.type], key) || own(d[c.type], key))));
        if (!fixed) names.push(c.name);
      });
    });
    return uniq(names);
  }
  function fmtDefault(v) {
    if (v == null || v === '') return '미정';
    if (Array.isArray(v)) return v.length ? v.join(', ') : '없음';
    if (v === true) return '켬';
    if (v === false) return '끔';
    if (typeof v === 'number') return v.toLocaleString('ko-KR');
    if (typeof v === 'object') return '표 ' + Object.keys(v).length + '줄';
    return String(v);
  }
  function err(out, key, msg) { out.fields[key] = msg; if (out.errs.indexOf(msg) < 0) out.errs.push(msg); }
  function validate(ctx, sid, list) {
    const c = CFG[sid], out = { errs: [], warns: [], fields: {}, html: '', force: null, reasonReq: null };
    const ks = uniq(list.map(x => x.k).concat([CFG[sid].noScope ? 'base' : scopeK(ctx.ui)]));
    if (c.validate) ks.forEach(k => c.validate(ctx, out, key => eff(ctx, sid, k, key), k, list));
    if (out.reasonReq && !(ctx.ui.r_reason || '').trim()) { out.errs.push(out.reasonReq); out.reasonErr = out.reasonReq; }
    ctx.ui.err = out.fields;
    return out;
  }
  function codeText(ctx, sid, code, list, before) {
    const c = CFG[sid], items = list.filter(x => x.code === code), k = items[0].k;
    if (c.text && c.text[code]) return c.text[code](key => { const it = list.find(x => x.k === k && x.key === key); return before || !it ? eff(ctx, sid, k, key, true) : it.to; });
    return items.map(x => c.label(x.key) + ' ' + c.fmt(x.key, before ? x.from : x.to)).join(', ');
  }
  function polStatus(code) { return (B.store.pol[code] || {}).status || h.pol(code).status; }
  function confirm(ctx, sid, arg) {
    const ui = ctx.ui, c = CFG[sid], s0 = st(ctx, sid);
    if (arg && typeof arg === 'object') {
      if (arg.values) { Object.keys(arg.values).forEach(k => { ui['f:' + k] = arg.values[k]; }); absorb(ctx, sid); }
      if (arg.reason != null) ui.r_reason = arg.reason;
      if (arg.when) ui.r_when = arg.when;
    }
    const list = changes(ctx, sid);
    if (!list.length) { ui.review = false; B.toast('바꾼 값이 없어요.'); return; }
    const v = validate(ctx, sid, list);
    if (v.errs.length) { ui.review = true; ui._scroll = 0; B.toast('확인할 칸이 있어요. 빨간 글씨를 봐 주세요.'); return; }
    const when = v.force || ui.r_when || '즉시', reason = (ui.r_reason || '').trim() || '-';
    const aff = affected(ctx, sid, list), codes = uniq(list.map(x => x.code));
    const before = {}, after = {};
    codes.forEach(code => { before[code] = codeText(ctx, sid, code, list, true); after[code] = codeText(ctx, sid, code, list, false); });
    list.forEach(x => {
      if (when === '즉시') { s0.vals[x.k] = s0.vals[x.k] || {}; s0.vals[x.k][x.key] = x.to; }
      else s0.pending.push({ date: when.slice(0, 10), k: x.k, key: x.key, to: x.to });
    });
    const tag = when === '즉시' ? '' : ' (' + mdS(when) + ' 예약)';
    codes.forEach(code => {
      const p = ctx.s.pol[code] = ctx.s.pol[code] || {};
      p.history = p.history || [];
      p.history.push({ date: ctx.today, from: before[code], to: after[code] + tag, by: ctx.persona.name, reason, n: aff.length });
      if (c.text && c.text[code] && polStatus(code) !== '법정') {
        const k = list.find(x => x.code === code).k, txt = after[code];
        if (when === '즉시') {
          if (k === 'base') p.value = txt;
          else if (k.indexOf('c:') === 0) { p.centers = p.centers || {}; p.centers[k.slice(2)] = { value: txt, status: polStatus(code) }; }
          else { p.groups = p.groups || {}; p.groups[k] = { value: txt, status: polStatus(code) }; }
        } else if (k === 'base') p.reserved = { date: mdS(when), value: txt };
      }
    });
    s0.log.unshift({ at: ctx.today, by: ctx.persona.name, when, reason, n: aff.length, items: list.map(x => c.label(x.key, x.k) + ' ' + c.fmt(x.key, x.to) + ' (' + scopeName(x.k) + ')') });
    if (c.after) c.after(ctx, list, when);
    ctx.s.audit.unshift({ at: '03-08 ' + (10 + s0.log.length) + ':00', who: ctx.persona.name + ' (본사 ' + ctx.role + ')', what: '정책 변경', target: codes.join(', '), reason });
    ui.draft = {}; ui.review = false; ui.r_reason = ''; ui.r_when = '즉시'; ui.err = {};
    B.toast(when === '즉시' ? '저장했어요. 연결된 화면에 바로 반영돼요.' : '변경을 예약했어요. ' + when.slice(0, 10) + ' 0시에 바뀌어요.');
  }

  /* ---------------- small UI parts ---------------- */
  function card(o) {
    return '<section class="card ' + (o.cls || '') + '"' + (o.pin ? ' data-pin="' + o.pin + '"' : '') + '><div class="card-h"><h3>' + esc(o.title) + '</h3>' + (o.chip || '') +
      (o.sub ? '<span class="sub">' + esc(o.sub) + '</span>' : '') + (o.right ? '<div class="r">' + o.right + '</div>' : '') + '</div>' + (o.body || '') + '</section>';
  }
  function kvt(list, w) {
    return '<div class="tbl-wrap"><table class="tbl hqc-kvt"><tbody>' + list.map(r => '<tr><th' + (w ? ' style="width:' + w + 'px"' : '') + '>' + esc(r[0]) + '</th><td>' + r[1] + '</td></tr>').join('') + '</tbody></table></div>';
  }
  function stChip(code) {
    const s2 = polStatus(code);
    return h.chip({ '안': '미확정(안)', '미정': '미정', '예시': '예시', '법정': '법정', '확정': '확정' }[s2] || s2, 'st-' + s2);
  }
  const fmtIn = v => v == null ? '' : typeof v === 'number' ? v.toLocaleString('ko-KR') : String(v);
  function nx(ctx, sid, key) {
    const k = kOf(ctx, sid, key), p = st(ctx, sid).pending.filter(x => x.k === k && x.key === key).pop();
    return p ? '<span class="hqc-next">' + esc(mdS(p.date)) + '부터 ' + esc(CFG[sid].fmt(key, p.to)) + '</span>' : '';
  }
  function errOf(ctx, key) { return (ctx.ui.err || {})[key]; }
  function inp(ctx, sid, key, o) {
    o = o || {};
    const v = cur(ctx, sid, key), e = errOf(ctx, key);
    return '<input class="inp hqc-in' + (isOv(ctx, sid, key) ? ' ov' : '') + (e ? ' bad' : '') + '" type="' + (o.type || 'text') + '" data-field="f:' + esc(key) + '" value="' + esc(fmtIn(v)) + '"' +
      (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.ro ? ' disabled' : '') + ' aria-label="' + esc(o.label || CFG[sid].label(key)) + '" style="width:' + (o.w || 76) + 'px"' + (e ? ' title="' + esc(e) + '"' : '') + '>' + nx(ctx, sid, key);
  }
  function sel(ctx, sid, key, list, o) {
    o = o || {};
    const v = cur(ctx, sid, key);
    return '<select class="inp hqc-in' + (isOv(ctx, sid, key) ? ' ov' : '') + (errOf(ctx, key) ? ' bad' : '') + '" data-field="f:' + esc(key) + '"' + (o.ro ? ' disabled' : '') + ' aria-label="' + esc(o.label || CFG[sid].label(key)) + '">' +
      list.map(x => { const val = typeof x === 'string' ? x : x.v, l = typeof x === 'string' ? x : x.l; return '<option value="' + esc(val) + '"' + (String(val) === String(v) ? ' selected' : '') + (x.dis ? ' disabled' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>' + nx(ctx, sid, key);
  }
  function optBtn(sid, verb, arg, on, label, R, kind) {
    return '<button type="button" class="hqc-o' + (on ? ' on' : '') + '"' + (R ? ' disabled' : ' data-act="' + A(sid) + '.' + verb + '" data-arg="' + esc(arg) + '"') +
      ' role="' + (kind === 'rd' ? 'radio' : 'checkbox') + '" aria-checked="' + (on ? 'true' : 'false') + '"><i class="' + kind + '"></i>' + esc(label) + '</button>';
  }
  function rad(ctx, sid, key, list, R) {
    const v = cur(ctx, sid, key);
    return '<span class="hqc-opts' + (isOv(ctx, sid, key) ? ' ov' : '') + '" role="radiogroup">' + list.map(x => { const val = typeof x === 'object' ? x.v : x, l = typeof x === 'object' ? x.l : x; return optBtn(sid, 'set', key + '|' + val, String(v) === String(val), l, R, 'rd'); }).join('') + '</span>' + nx(ctx, sid, key);
  }
  function chks(ctx, sid, key, list, R) {
    const a = cur(ctx, sid, key) || [];
    return '<span class="hqc-opts' + (isOv(ctx, sid, key) ? ' ov' : '') + '">' + list.map(x => optBtn(sid, 'tog', key + '|' + x, a.indexOf(x) >= 0, x, R, 'cb')).join('') + '</span>' + nx(ctx, sid, key);
  }
  function chk1(ctx, sid, key, label, R) {
    const on = !!cur(ctx, sid, key);
    return '<span class="hqc-opts' + (isOv(ctx, sid, key) ? ' ov' : '') + '">' + optBtn(sid, 'set', key + '|' + (!on), on, label, R, 'cb') + '</span>' + nx(ctx, sid, key);
  }
  const fixedChk = label => '<span class="hqc-fx"><i class="cb"></i>' + esc(label) + '</span>';
  const reviewHead = (title, imp) => '<div class="hqc-subh">' + esc(title) + ' ' + B.impChip(imp) + '</div>';
  function ptable(rows) {
    return '<div class="tbl-wrap"><table class="tbl hqc-ptbl"><thead><tr><th style="width:68px">코드</th><th style="width:142px">정책</th><th>값</th><th style="width:72px">직영</th><th style="width:72px">가맹</th><th style="width:92px">상태</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }
  function prow(code, name, pin, val, d, f) {
    return '<tr><td class="code">' + esc(code) + '</td><td><span class="hqc-pn"' + (pin ? ' data-pin="' + pin + '"' : '') + '>' + esc(name) + '</span></td><td><div class="hqc-val">' + val + '</div></td><td>' + h.chip(d, 'line') + '</td><td>' + h.chip(f, 'line') + '</td><td>' + stChip(code) + '</td></tr>';
  }

  /* ---------------- shared frame: scope tabs, review panel, history ---------------- */
  function scopeBar(ctx, sid) {
    const ui = ctx.ui, vals = st(ctx, sid).vals, curSc = ui.scope || SC[0];
    const nInd = Object.keys(vals).filter(k => k.indexOf('c:') === 0 && Object.keys(vals[k]).length).length;
    const nDraft = changes(ctx, sid).length;
    let html = '<div class="tabs hqc-scope" role="tablist" aria-label="값을 정할 범위">' + SC.map(x => '<button type="button" role="tab" aria-selected="' + (x === curSc) + '" class="' + (x === curSc ? 'on' : '') + '" data-act="' + A(sid) + '.scope" data-arg="' + esc(x) + '">' + esc(x === '개별 센터' ? x + ' (' + nInd + ')' : x) + '</button>').join('') +
      (nDraft ? '<span class="hqc-dirty">저장 전 변경 ' + nDraft + '건</span>' : '') + '</div>';
    if (curSc === '개별 센터') {
      html += '<div class="row hqc-sub"><span class="small muted">센터</span>' + h.opts(opCenters().map(c => ({ v: c.id, l: c.name + (vals['c:' + c.id] && Object.keys(vals['c:' + c.id]).length ? ' (개별 값 있음)' : '') })), ui.center || 'daechi1', { act: A(sid) + '.center' }) + '</div>';
    }
    if (curSc !== SC[0]) html += '<div style="margin-bottom:10px">' + h.alert(scopeName(scopeK(ui)) + ' 값을 정하고 있어요. 파란 칸은 이 범위에서 따로 정한 값이고, 나머지 칸은 위 단계 값을 그대로 따라요.', 'info') + '</div>';
    return html;
  }
  function panel(ctx, sid) {
    const ui = ctx.ui, c = CFG[sid], list = changes(ctx, sid);
    if (!list.length) return '';
    const v = validate(ctx, sid, list), aff = affected(ctx, sid, list);
    const rows = list.map(x => '<tr><td>' + h.polChip(x.code) + ' ' + esc(c.label(x.key, x.k)) + '</td><td>' + esc(scopeName(x.k)) + '</td><td>' + esc(c.fmt(x.key, x.from)) + '</td><td><b>' + esc(c.fmt(x.key, x.to)) + '</b></td></tr>').join('');
    const whenField = v.force
      ? h.field({ label: '적용 시작', type: 'static', value: v.force + ' (바꿀 수 없어요)' })
      : h.field({ label: '적용 시작', type: 'select', value: ui.r_when || '즉시', options: WHEN, field: 'r_when' });
    return card({
      cls: 'hqc-review', title: '변경 예약 확인', sub: '저장하기 전에 바뀌는 값과 영향을 먼저 보여 줘요',
      body: '<div class="tbl-wrap"><table class="tbl"><thead><tr><th style="width:30%">정책</th><th style="width:14%">범위</th><th style="width:28%">지금 값</th><th style="width:28%">바꿀 값</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<div class="grid g2" style="margin-top:10px">' + whenField +
        h.field({ label: '근거', req: !!v.reasonReq, value: ui.r_reason || '', field: 'r_reason', ph: '회의록, 결재 문서, 계약 조항 번호', err: v.reasonErr }) + '</div>' +
        '<div style="margin-top:10px">' + h.kv([['영향 센터', aff.length + '곳 (' + (aff.join(', ') || '없음') + ')'], ['이미 낸 거래', '결제할 때 쓴 값과 버전을 그대로 둬요']]) + '</div>' +
        (v.html || '') +
        (v.errs.length ? '<div style="margin-top:10px">' + h.alert('<ul class="hqc-ul">' + v.errs.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>', 'bad', { title: '저장할 수 없어요', raw: true }) + '</div>' : '') +
        (v.warns.length ? '<div style="margin-top:8px">' + h.alert('<ul class="hqc-ul">' + v.warns.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>', 'warn', { title: '확인해 주세요', raw: true }) + '</div>' : '') +
        '<div class="row" style="justify-content:flex-end;margin-top:12px">' + h.btn('돌아가기', { act: A(sid) + '.back' }) + h.btn(v.force || (ui.r_when && ui.r_when !== '즉시') ? '예약 확정' : '저장 확정', { primary: true, act: A(sid) + '.confirm', disabled: ro(ctx) || v.errs.length > 0 }) + '</div>',
    });
  }
  function histCard(ctx, sid) {
    const s0 = st(ctx, sid), c = CFG[sid];
    const pend = s0.pending.length ? '<div class="hqc-subh" style="margin-top:0">예약된 변경</div><div class="row" style="margin-bottom:10px">' + s0.pending.map(p => h.chip(p.date + ' 0시 · ' + c.label(p.key, p.k) + ' ' + c.fmt(p.key, p.to) + ' (' + scopeName(p.k) + ')', 'info')).join('') + '</div>' : '';
    const log = s0.log.length
      ? '<div class="tl">' + s0.log.map(x => '<div><b>' + esc(x.at) + '</b> ' + esc(x.by) + ', ' + esc(x.when === '즉시' ? '바로 적용' : x.when) + ', 근거 ' + esc(x.reason) + ', 영향 ' + x.n + '곳<div class="small muted">' + esc(x.items.join(', ')) + '</div></div>').join('') + '</div>'
      : h.empty('아직 바꾼 기록이 없어요. 값을 고치고 변경 예약을 누르면 여기와 정책별 이력(HQ-08)에 함께 남아요.');
    return card({ title: '변경 이력', sub: '이 화면에서 바꾼 기록', body: pend + log });
  }
  function prep(ctx, sid) { if (ctx.ui.review) validate(ctx, sid, changes(ctx, sid)); }
  function frame(ctx, sid, inner) {
    let html = '<div class="hqc">';
    if (ctx.role === '정산') html += '<div style="margin-bottom:10px">' + h.alert('정산 담당은 사용료 정책만 고쳐요. 이 화면은 보기만 할 수 있어요.', 'warn') + '</div>';
    if (!CFG[sid].noScope) html += scopeBar(ctx, sid);
    if (ctx.ui.review) html += '<div style="margin-bottom:12px">' + panel(ctx, sid) + '</div>';
    return html + inner + '<div style="margin-top:12px">' + histCard(ctx, sid) + '</div></div>';
  }
  function heads(sid, label) {
    return ctx => h.btn('취소', { act: A(sid) + '.cancel' }) + h.btn(label || '변경 예약', { primary: true, act: A(sid) + '.reserve', disabled: ro(ctx) });
  }
  function mountFn(root, ctx) {
    const ui = ctx.ui, main = root.querySelector('.main');
    if (ui._keep && main) main.scrollTop = ui._scroll || 0;
    ui._keep = false;
    Array.prototype.forEach.call(root.querySelectorAll('[data-live]'), el => {
      el.addEventListener('change', () => {
        ui[el.getAttribute('data-field')] = el.value;
        ui._scroll = main ? main.scrollTop : 0; ui._keep = true;
        setTimeout(() => B.render(), 0);
      });
    });
  }
  function act(sid, verb, fn) {
    B.action(A(sid) + '.' + verb, function (ctx, arg, el) {
      if (el && typeof document !== 'undefined') { const m = document.querySelector('#app .main'); if (m) { ctx.ui._scroll = m.scrollTop; ctx.ui._keep = true; } }
      absorb(ctx, sid);
      return fn(ctx, arg, el);
    });
  }
  function common(sid) {
    const c = CFG[sid];
    act(sid, 'scope', (ctx, v) => { if (c.noScope || SC.indexOf(v) < 0) return; ctx.ui.scope = v; if (v === '개별 센터' && !ctx.ui.center) { const f = Object.keys(st(ctx, sid).vals).find(k => k.indexOf('c:') === 0); ctx.ui.center = f ? f.slice(2) : 'daechi1'; } });
    act(sid, 'center', (ctx, id) => { if (!c.noScope && B.center(id)) { ctx.ui.center = id; ctx.ui.scope = '개별 센터'; } });
    act(sid, 'set', (ctx, arg) => {
      if (arg && typeof arg === 'object') { Object.keys(arg).forEach(k => set(ctx, sid, k, norm(sid, k, arg[k]))); return; }
      const i = String(arg).indexOf('|'), key = String(arg).slice(0, i); let v = String(arg).slice(i + 1);
      if (v === 'true') v = true; else if (v === 'false') v = false;
      set(ctx, sid, key, norm(sid, key, v));
    });
    act(sid, 'tog', (ctx, arg) => {
      const i = String(arg).indexOf('|'), key = String(arg).slice(0, i), item = String(arg).slice(i + 1);
      const a = (get(ctx, sid, key) || []).slice(), j = a.indexOf(item);
      if (j >= 0) a.splice(j, 1); else a.push(item);
      const order = (c.order || {})[key] || [];
      a.sort((x, y) => order.indexOf(x) - order.indexOf(y));
      set(ctx, sid, key, a);
    });
    act(sid, 'edit', (ctx, arg) => {
      if (!arg || typeof arg !== 'object') return;
      if (!c.noScope && arg.scope && SC.indexOf(arg.scope) >= 0) ctx.ui.scope = arg.scope;
      if (!c.noScope && arg.center && B.center(arg.center)) { ctx.ui.center = arg.center; ctx.ui.scope = '개별 센터'; }
      Object.keys(arg).filter(k => k !== 'scope' && k !== 'center').forEach(k => { ctx.ui['f:' + k] = arg[k]; });
      absorb(ctx, sid);
    });
    act(sid, 'reserve', (ctx, arg) => {
      if (arg && typeof arg === 'object') { Object.keys(arg).forEach(k => { ctx.ui['f:' + k] = arg[k]; }); absorb(ctx, sid); }
      if (!changes(ctx, sid).length) { ctx.ui.review = false; B.toast('바꾼 값이 없어요. 표에서 값을 고친 뒤 눌러 주세요.'); return; }
      ctx.ui.review = true; ctx.ui._scroll = 0;
    });
    act(sid, 'back', ctx => { ctx.ui.review = false; ctx.ui.err = {}; });
    act(sid, 'confirm', (ctx, arg) => confirm(ctx, sid, arg));
    act(sid, 'cancel', ctx => {
      const n = changes(ctx, sid).length;
      ctx.ui.draft = {}; ctx.ui.review = false; ctx.ui.err = {};
      B.toast(n ? '저장 전 변경 ' + n + '건을 되돌렸어요.' : '되돌릴 변경이 없어요.');
    });
  }
  const WHO = '본사 슈퍼관리자가 고쳐요. 운영 담당과 정산 담당은 일부만 고칠 수 있는데, 이 프로토타입에서 정산 담당은 사용료 정책만 고치는 것으로 보고 여기서는 보기만 해요. SV는 보기만 하고 콘텐츠 담당에게는 메뉴가 안 보여요.';

  /* =====================================================================
     HQ-10 교습 상품·권장 교습비 (p.29)
     ===================================================================== */
  const T_LABEL = key => { const m = /^t_(\d)_(\d+)$/.exec(key); return m ? '주 ' + m[1] + '회 ' + m[2] + '분' : key; };
  function prodOf(ctx, key) { const m = /^t_(\d)_(\d+)$/.exec(key); return m ? ctx.s.products.find(p => p.perWeek === +m[1] && p.minutes === +m[2]) : null; }
  function onKeys(ctx) { const out = []; WEEKS.forEach(w => MINS.forEach(m => { const key = 't_' + w + '_' + m, v = eff(ctx, 'HQ-10', 'base', key); if (v != null) out.push(key); })); return out; }
  function regOf(ctx, cid, key) { const e = (ctx.s.hq10.edu || {})[cid] || {}; return e[key] || null; }
  function regRows(ctx, savedOnly) {
    const keys = onKeys(ctx);
    return opCenters().filter(c => c.type === '직영').map(c => ({
      c, cells: keys.map(key => {
        const price = eff(ctx, 'HQ-10', 'c:' + c.id, key, savedOnly), r = regOf(ctx, c.id, key), reg = r ? r.amt : null;
        return { key, price, reg, st: r ? r.st : '등록 전', next: r ? r.next : null, over: price != null && (reg == null || (typeof price === 'number' && price > reg)) };
      }),
    }));
  }
  function tcell(ctx, key, R) {
    const v = cur(ctx, 'HQ-10', key);
    if (v == null) return R ? '<span class="muted">미사용</span>' : '<button type="button" class="hqc-off" data-act="HQ10.cell" data-arg="' + key + '" title="눌러서 이 조합을 켜요">미사용</button>' + nx(ctx, 'HQ-10', key);
    return '<span class="hqc-cell">' + inp(ctx, 'HQ-10', key, { ro: R, w: 88, ph: '권장가', label: T_LABEL(key) + ' 권장가' }) + (R ? '' : '<button type="button" class="hqc-x" data-act="HQ10.cell" data-arg="' + key + '" title="미사용으로 바꿔요">끄기</button>') + '</span>';
  }
  function devTable(ctx) {
    const rows = [];
    opCenters().filter(c => c.type !== '직영').forEach(c => {
      ctx.s.products.forEach(p => {
        const price = (p.centerPrice || {})[c.id]; if (price == null) return;
        const key = 't_' + p.perWeek + '_' + p.minutes, rec = eff(ctx, 'HQ-10', 'c:' + c.id, key), pct = eff(ctx, 'HQ-10', 'c:' + c.id, 'dev_pct');
        if (typeof rec !== 'number') return;
        const diff = (price - rec) / rec * 100;
        rows.push({ c, p, price, rec, diff, over: typeof pct === 'number' && Math.abs(diff) > pct + 1e-9 });
      });
    });
    return h.table({
      cols: [
        { label: '센터', render: r => esc(r.c.name.replace('센터', '')) },
        { label: '상품', render: r => esc(T_LABEL('t_' + r.p.perWeek + '_' + r.p.minutes)) },
        { label: '센터 판매가', num: true, render: r => money(r.price) },
        { label: '권장가', num: true, render: r => money(r.rec) },
        { label: '차이', num: true, render: r => (r.diff > 0 ? '+' : '') + r.diff.toFixed(1) + '%' },
        { label: '처리', render: r => r.over ? h.chip('경고, 사유 남김', 'warn') : h.chip('범위 안', 'ok') },
      ],
      rows, empty: '비교할 가맹 센터 판매가가 없어요.',
    });
  }
  function r10(ctx) {
    prep(ctx, 'HQ-10');
    const sid = 'HQ-10', R = ro(ctx);
    const grid = '<div class="tbl-wrap"><table class="tbl hqc-grid"><thead><tr><th>주 횟수 \\ 회당</th>' + MINS.map(m => '<th>' + m + '분</th>').join('') + '</tr></thead><tbody>' +
      WEEKS.map(w => '<tr><td><b>주 ' + w + '회</b></td>' + MINS.map(m => '<td>' + tcell(ctx, 't_' + w + '_' + m, R) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
    const c1 = card({
      pin: 1, title: 'POL-10·11 상품 템플릿과 권장 교습비 (월)', chip: stChip('POL-11'),
      body: grid + '<div class="hqc-line" data-pin="2">' + chk1(ctx, sid, 'direct_fixed', '직영은 권장가를 확정가로 사용', R) + '</div>' +
        '<div class="hqc-hint">칸을 눌러 사용 여부와 권장가를 넣어요. 금액은 모두 예시예요. 가맹은 템플릿을 더 만들 수 있어요.</div>',
    });
    const c3 = card({
      pin: 3, title: 'POL-11 가맹 센터 이탈 처리', chip: stChip('POL-11'),
      body: kvt([
        ['경고 기준', '권장가 대비 ± ' + inp(ctx, sid, 'dev_pct', { ro: R, w: 52 }) + ' % <span class="small muted">(예시)</span>'],
        ['사유 입력', fixedChk('필수')],
        ['차단', '<span class="muted">하지 않음 (고정)</span> <span class="small muted">가격 구속 방지</span>'],
        ['기록 활용', '<span class="hqc-rv hqc-tp" data-pin="9">가격 비교 통계에만 써요. SV 점검과 계약 갱신 판단에는 쓰지 않아요 (고정)</span>'],
      ]) + '<div class="hqc-subh">가맹 센터 판매가 비교 <span class="muted" style="font-weight:400">예시 데이터, 저장 전 값으로 계산</span></div>' + devTable(ctx),
    });
    const rr = regRows(ctx), keys = onKeys(ctx), nOver = rr.reduce((n, r) => n + r.cells.filter(x => x.over).length, 0);
    const regTbl = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>직영 센터</th>' + keys.map(k => '<th>' + esc(T_LABEL(k)) + '</th>').join('') + '</tr></thead><tbody>' +
      rr.map(r => '<tr><td>' + esc(r.c.name.replace('센터', '')) + '</td>' + r.cells.map(x => '<td>' + (x.reg == null ? h.chip('등록액 없음', 'bad') + '<div class="small muted">등록 전 판매 잠김</div>'
        : (x.over ? h.chip('잠김', 'bad') : h.chip('판매', 'ok')) + ' <span class="small' + (x.over ? '' : ' muted') + '">' + money(x.price) + '</span>' +
          '<div class="small muted">등록 ' + money(x.reg) + (x.next ? ', ' + money(x.next) + ' 신고 중' : '') + '</div>' +
          (x.next && !R ? h.btn('수리 확인', { sm: true, ghost: true, act: 'HQ10.filed', arg: r.c.id + '|' + x.key }) : '')) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
    const c4 = card({
      pin: 4, title: 'POL-12 교육청 등록 교습비', chip: stChip('POL-12'),
      body: '<ul class="hqc-ul"><li>센터마다 교육청 등록액을 넣어야 팔 수 있어요</li><li>등록이나 변경신고가 끝나기 전에는 판매를 잠가요</li><li>등록액보다 많이 받는 수납은 막아요</li></ul>' +
        '<div class="hqc-rvbox" data-pin="7">' + reviewHead('직영 확정가와 등록액 대조', 'IMP-03') + regTbl +
        (nOver ? '<div style="margin-top:8px">' + h.alert('확정가가 등록액보다 높거나 등록액이 없는 칸이 ' + nOver + '곳이에요. 변경신고가 수리될 때까지 그 상품은 팔 수 없고, 재등록 기간과 겹치면 청구가 막혀요. 수리 확인은 문서 번호를 남겨야 돼요.', 'warn') + '</div>' +
          '<div class="row" style="margin-top:8px;justify-content:flex-end">' + h.btn('넘는 센터는 등록액으로 유지', { sm: true, act: 'HQ10.keepReg', disabled: R }) + '</div>'
          : '<div style="margin-top:8px">' + h.alert('직영 센터 모두 등록액 안에서 팔 수 있어요.', 'ok') + '</div>') + '</div>',
    });
    const c5 = card({
      pin: 5, title: 'POL-13 할인 유형', chip: stChip('POL-13'),
      body: '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>유형</th><th>기본</th><th>사유</th></tr></thead><tbody>' +
        '<tr><td>형제</td><td>' + inp(ctx, sid, 'disc_sib', { ro: R, w: 52 }) + ' %</td><td>필수</td></tr>' +
        '<tr><td>장기 등록 3개월</td><td>' + inp(ctx, sid, 'disc_long', { ro: R, w: 52 }) + ' %</td><td>필수</td></tr>' +
        '<tr><td>프로모션</td><td class="muted">센터 입력</td><td>필수</td></tr></tbody></table></div>' +
        '<div class="hqc-line">할인 상한 ' + inp(ctx, sid, 'disc_cap', { ro: R, w: 52 }) + ' % <span class="small muted">직영에만 적용, 모두 예시</span></div>',
    });
    const reg = cur(ctx, sid, 'x_book_reg');
    const c6 = card({
      pin: 6, title: 'POL-14 기타경비', chip: stChip('POL-14'),
      body: '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>항목</th><th>금액</th><th>기준</th><th>교육청 등록</th></tr></thead><tbody>' +
        '<tr><td class="nw">교재비 (월)</td><td class="nw">' + inp(ctx, sid, 'x_book', { ro: R, w: 70 }) + ' 원</td><td class="small">실비, 등록 항목만</td><td>' + rad(ctx, sid, 'x_book_reg', ['등록 완료', '신고 전'], R) + '</td></tr></tbody></table></div>' +
        '<div style="margin-top:8px" data-pin="8">' + (reg === '신고 전'
          ? h.alert('교재비가 신고 전이라 청구서와 결제 링크에 실리지 않아요. 영수증과 게시표에서도 빠져요.', 'bad', { title: '청구 잠김' })
          : h.alert('기타경비도 교습비처럼 등록 상태를 봐요. 신고 전인 항목은 청구서와 결제 링크에 실리지 않아요.', 'review', { title: '검토 반영' })) + '</div>',
    });
    return frame(ctx, sid, '<div class="grid g2"><div class="stack">' + c1 + c3 + '</div><div class="stack">' + c4 + c5 + c6 + '</div></div>');
  }
  CFG['HQ-10'] = {
    num: /^(t_|dev_pct$|disc_|x_book$)/,
    label: (key, k) => /^t_/.test(key) ? T_LABEL(key) + (k === '직영' || (k && k.indexOf('c:') === 0 && (B.center(k.slice(2)) || {}).type === '직영') ? ' 직영 확정가' : ' 권장가') : ({ direct_fixed: '직영 확정가 사용', dev_pct: '이탈 경고 기준', disc_sib: '형제 할인', disc_long: '장기 등록 할인', disc_cap: '직영 할인 상한', x_book: '교재비 (월)', x_book_reg: '교재비 교육청 등록' })[key] || key,
    fmt: (key, v) => {
      if (/^t_/.test(key)) return v == null ? '미사용' : v === '' ? '금액 없음' : money(v) + (typeof v === 'number' ? '원' : '');
      if (/^(dev_pct|disc_)/.test(key)) return v === '' || v == null ? '미정' : v + '%';
      if (key === 'x_book') return money(v) + (typeof v === 'number' ? '원' : '');
      return fmtDefault(v);
    },
    code: (key, from, to) => /^t_/.test(key) ? ((from == null || to == null) ? 'POL-10' : 'POL-11') : (key === 'direct_fixed' || key === 'dev_pct') ? 'POL-11' : /^disc_/.test(key) ? 'POL-13' : 'POL-14',
    validate(ctx, out, g) {
      WEEKS.forEach(w => MINS.forEach(m => { const key = 't_' + w + '_' + m, v = g(key); if (v == null) return; if (typeof v !== 'number' || v <= 0) err(out, key, '주 ' + w + '회 ' + m + '분 권장가를 숫자로 넣어 주세요.'); }));
      const d = g('dev_pct'); if (!(typeof d === 'number' && d > 0 && d < 100)) err(out, 'dev_pct', '이탈 경고 기준은 1부터 99 사이 숫자로 넣어 주세요.');
      [['disc_sib', '형제 할인'], ['disc_long', '장기 등록 할인'], ['disc_cap', '할인 상한']].forEach(([key, l]) => { const v = g(key); if (!(typeof v === 'number' && v >= 0 && v <= 100)) err(out, key, l + '은 0부터 100 사이 숫자로 넣어 주세요.'); });
      if (typeof g('disc_sib') === 'number' && typeof g('disc_cap') === 'number' && g('disc_sib') > g('disc_cap')) { const w = '형제 할인이 직영 할인 상한보다 커요. 직영 센터에서는 상한까지만 할인돼요.'; if (out.warns.indexOf(w) < 0) out.warns.push(w); }
      const x = g('x_book'); if (!(typeof x === 'number' && x >= 0)) err(out, 'x_book', '교재비를 숫자로 넣어 주세요.');
      const was = {}; regRows(ctx, true).forEach(r => r.cells.forEach(c => { was[r.c.id + c.key] = c.over; }));
      const over = regRows(ctx).reduce((a, r) => a.concat(r.cells.filter(c => c.over && !was[r.c.id + c.key]).map(c => r.c.name.replace('센터', '') + ' ' + T_LABEL(c.key))), []);
      const w2 = '이번 변경으로 등록액을 넘는 직영 칸 ' + over.length + '곳 (' + over.join(', ') + ')은 적용일 0시부터 판매가 잠겨요. 변경신고가 수리될 때까지 등록액을 유지하려면 대조표의 버튼을 눌러요.';
      if (over.length && out.warns.indexOf(w2) < 0) out.warns.push(w2);
    },
    text: {
      'POL-10': g => { const a = []; WEEKS.forEach(w => MINS.forEach(m => { if (g('t_' + w + '_' + m) != null) a.push('주 ' + w + '회 ' + m + '분'); })); return a.join(', ') || '없음'; },
      'POL-11': g => { const a = []; WEEKS.forEach(w => MINS.forEach(m => { const v = g('t_' + w + '_' + m); if (typeof v === 'number') a.push('주 ' + w + '회 ' + money(v) + '원'); })); return a.join(', ') + ', 이탈 경고 ±' + g('dev_pct') + '%'; },
      'POL-13': g => '형제 ' + g('disc_sib') + '%, 장기 ' + g('disc_long') + '%, 직영 상한 ' + g('disc_cap') + '%',
      'POL-14': g => '교재비 월 ' + money(g('x_book')) + '원' + (g('x_book_reg') === '신고 전' ? ' (신고 전)' : ''),
    },
    after(ctx, list, when) {
      if (when !== '즉시') return;
      uniq(list.filter(x => /^t_/.test(x.key) && (x.k === 'base' || x.k === '직영')).map(x => x.key)).forEach(key => {
        const rec = eff(ctx, 'HQ-10', 'base', key, true), dir = eff(ctx, 'HQ-10', '직영', key, true);
        let p = prodOf(ctx, key);
        if (!p && typeof rec === 'number') {
          const m = /^t_(\d)_(\d+)$/.exec(key);
          p = { id: 'pr' + (ctx.s.products.length + 1), name: '주 ' + m[1] + '회 · ' + m[2] + '분', perWeek: +m[1], minutes: +m[2], recommend: rec, direct: dir, edu: {}, centerPrice: {} };
          ctx.s.products.push(p);
        } else if (p && typeof rec === 'number') { p.recommend = rec; if (typeof dir === 'number') p.direct = dir; }
      });
    },
  };
  common('HQ-10');
  act('HQ-10', 'cell', (ctx, key) => {
    if (!/^t_\d_\d+$/.test(String(key))) return;
    const v = get(ctx, 'HQ-10', key);
    set(ctx, 'HQ-10', key, v == null ? '' : null);
  });
  act('HQ-10', 'filed', (ctx, arg) => {
    const o = arg && typeof arg === 'object' ? arg : (() => { const [center, key] = String(arg || '').split('|'); return { center, key }; })();
    const r = regOf(ctx, o.center, o.key), c = B.center(o.center);
    if (!r || !r.next || !c) { B.toast('변경신고 중인 칸이 아니에요.'); return; }
    const apply = doc => {
      const from = r.amt; r.amt = r.next; r.st = '등록'; r.doc = doc; delete r.next;
      ctx.s.hq10.log.unshift({ at: ctx.today, by: ctx.persona.name, when: '즉시', reason: '변경신고 수리 ' + doc, n: 1, items: [c.name + ' ' + T_LABEL(o.key) + ' 등록액 ' + money(from) + '원에서 ' + money(r.amt) + '원'] });
      const p = ctx.s.pol['POL-12'] = ctx.s.pol['POL-12'] || {};
      p.history = p.history || []; p.history.push({ date: ctx.today, from: c.name + ' ' + T_LABEL(o.key) + ' ' + money(from) + '원', to: money(r.amt) + '원 (변경신고 수리)', by: ctx.persona.name, reason: doc, n: 1 });
      ctx.s.audit.unshift({ at: '03-08 11:10', who: ctx.persona.name + ' (본사 ' + ctx.role + ')', what: '교육청 변경신고 수리 확인', target: c.name + ' ' + T_LABEL(o.key), reason: doc });
      B.toast(c.name + ' ' + T_LABEL(o.key) + ' 등록액을 ' + money(r.amt) + '원으로 바꿨어요. 판매 잠금이 풀려요.');
    };
    if (o.doc) { apply(String(o.doc)); return; }
    B.modal({
      title: '변경신고 수리 확인', ok: '수리 확인',
      body: '<p style="margin:0 0 8px">' + esc(c.name + ' ' + T_LABEL(o.key)) + ' 교습비를 ' + money(r.amt) + '원에서 ' + money(r.next) + '원으로 바꾸는 신고예요.</p>' +
        '<div class="field"><label>수리 문서 번호<span class="req">*</span></label><input class="inp" id="hqc-doc" placeholder="교육지원청 수리 공문 번호"><div class="err" id="hqc-doc-err" hidden></div></div>' +
        '<div class="hint">문서 번호를 남겨야 본사가 확인한 등록액으로 바뀌어요.</div>',
      onOk: back => {
        const v = (back.querySelector('#hqc-doc').value || '').trim();
        if (!v) { const e = back.querySelector('#hqc-doc-err'); e.textContent = '수리 문서 번호를 넣어 주세요.'; e.hidden = false; return false; }
        apply(v);
      },
    });
    return false;
  });
  act('HQ-10', 'keepReg', ctx => {
    let n = 0;
    regRows(ctx).forEach(r => r.cells.forEach(x => { if (x.over && x.reg != null) { setD(ctx, 'c:' + r.c.id, x.key, x.reg); n++; } }));
    if (!n) { B.toast('등록액을 넘는 칸이 없어요.'); return; }
    ctx.ui.review = true; ctx.ui._scroll = 0;
    B.toast('등록액을 넘는 ' + n + '칸에 등록액 개별 값을 넣었어요. 확인하고 저장해요.');
  });

  B.screen({
    id: 'HQ-10', side: 'hq', phase: 'P1a', devices: ['pc'], pages: [29],
    title: '교습 상품·권장 교습비', menuLabel: '교습 상품 가이드', crumb: '정책·요금 설정 > 교습 상품 가이드',
    headActions: heads('HQ-10'), render: r10, mount: mountFn,
    prd: {
      summary: '본사가 수업 상품과 권장 교습비, 할인, 교재비 규칙을 정하는 화면이에요. 위쪽 탭으로 그룹마다 다른 값을 줄 수 있고, 변경 예약을 누르면 바뀌는 값과 영향 센터를 먼저 보여 줘요(HQ-08과 같은 방식).',
      who: WHO + ' 값은 대표, 경영지원, 연구소가 정하고 센터는 CT-18에서 가져다 써요.',
      items: [
        { n: 1, t: '상품 템플릿', d: '주 몇 회와 한 번에 몇 분을 묶은 칸을 켜고 권장 월 교습비를 넣어요. 지금은 90분짜리 주 1회 150,000원, 주 2회 260,000원, 주 3회 360,000원이 켜져 있어요(모두 예시). 미사용 칸을 누르면 켜지고 끄기를 누르면 꺼져요. 가맹은 템플릿을 더 만들 수 있어요.', pol: ['POL-10', 'POL-11'], ref: 'p.29 ①' },
        { n: 2, t: '직영 확정가', d: '직영 센터는 본사가 운영하니까 권장가를 그대로 판매가로 써요. 직영 센터 화면에서는 가격을 바꿀 수 없어요.', pol: ['POL-11'], ref: 'p.29 ②' },
        { n: 3, t: '가맹 이탈 처리', d: '가맹 센터가 권장가와 다르게 정해도 저장돼요. 정한 범위(±10%, 예시)를 넘으면 경고하고 사유만 남겨요. 판매를 막는 기능은 가격 구속이 될 수 있어서 두지 않아요. 아래 비교표에서 대구수성 주 2회 290,000원이 +11.5%로 경고에 걸려요.', pol: ['POL-11'], ref: 'p.29 ③' },
        { n: 4, t: '교육청 등록 교습비', d: '시스템이 막는 가격 규칙은 이것 하나예요. 센터마다 교육청에 신고한 금액을 넣어야 하고, 신고가 끝나기 전이거나 신고 금액보다 많이 받으려 하면 막아요.', pol: ['POL-12'], ref: 'p.29 ④' },
        { n: 5, t: '할인', d: '할인은 가맹점이 알아서 정해요. 형제 10%, 장기 등록 3개월 5%가 들어 있고 프로모션은 센터가 넣어요(모두 예시). 할인할 때마다 사유를 남기고, 상한 20%(예시)는 직영에만 걸어요.', pol: ['POL-13'], ref: 'p.29 ⑤' },
        { n: 6, t: '기타경비', d: '교재비 같은 실비는 교육청에 등록한 항목만 받아요. 지금은 교재비 월 15,000원(예시)이에요. 영수증에는 교습비와 나눠서 적어요.', pol: ['POL-14'], ref: 'p.29 ⑥' },
        { n: 7, t: '직영 확정가와 등록액 대조', kind: 'review', imp: 'IMP-03', pol: ['POL-11', 'POL-12'], d: '권장가를 바꾸기 전에 직영 센터마다 새 가격이 교육청 등록액 이하인지 바로 보여 줘요. 지금 예시는 주 3회 360,000원이 등록액 340,000원보다 높아서 변경신고가 수리될 때까지 잠겨 있어요(CT-07과 같은 예시). 넘는 센터는 그동안 등록액으로 파는 개별 값을 버튼 하나로 넣고, 수리 확인은 문서 번호를 남겨야 해요.' },
        { n: 8, t: '기타경비도 등록 상태 확인', kind: 'review', imp: 'IMP-03', pol: ['POL-14'], d: '교재비에도 교육청 등록 상태를 둬요. 신고 전으로 바꾸면 그 항목은 청구서와 결제 링크에 실리지 않아요.' },
        { n: 9, t: '이탈 기록은 통계에만', kind: 'review', imp: 'IMP-25', pol: ['POL-11'], d: '권장가는 참고용이에요. 가맹 센터가 다르게 정한 기록은 가격 비교 통계에만 쓰고, SV 점검이나 계약 갱신 판단에는 쓰지 않아요. 가격 구속으로 오해받지 않게 하려는 거예요.' },
      ],
      open: ['실제로 팔 상품 구성(주 몇 회, 한 번에 몇 분)', '권장 교습비 금액', '권장가에서 몇 % 벗어나면 경고할지', '할인 종류와 직영 할인 상한, 할인을 겹쳐 쓸 수 있는지', '교재비 금액', '가맹 이탈 사유를 필수로 둘지 선택으로 돌릴지 (검토 의견은 선택)'],
      rules: ['교습비는 교육청에 등록한 금액을 넘어 받을 수 없어요 (학원법).', '본사가 가맹점 판매가를 강제하면 가격 구속이 될 수 있어요 (가맹사업법).'],
    },
  });

  /* =====================================================================
     HQ-11 시설·학사·등록 규칙 (p.30)
     ===================================================================== */
  const DOW = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
  const pad = n => (n < 10 ? '0' : '') + n;
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const md = t => String(t || '').slice(5);
  function sessions(ctx, ym, pattern) {
    const y = +ym.slice(0, 4), m = +ym.slice(5, 7), days = pattern.split('·').map(x => DOW[x.trim()]);
    const hol = st(ctx, 'HQ-11').hol, out = { n: 0, off: [] };
    for (let d = new Date(y, m - 1, 1); d.getMonth() === m - 1; d.setDate(d.getDate() + 1)) {
      if (days.indexOf(d.getDay()) < 0) continue;
      const t = ymd(d), hit = hol.find(x => t >= x.from && t <= x.to);
      if (hit) out.off.push(md(t) + ' ' + hit.name.replace(' (예시)', '')); else out.n++;
    }
    return out;
  }
  function capRows(ctx) {
    return opCenters().map(c => {
      const k = 'c:' + c.id, cap = eff(ctx, 'HQ-11', k, 'p16_cap'), ratio = eff(ctx, 'HQ-11', k, 'p16_ratio'), fac = eff(ctx, 'HQ-11', k, 'p15') || [];
      const classCap = Math.min(typeof cap === 'number' ? cap : Infinity, c.roomCap, c.facility === '교습소' ? 9 : Infinity);
      const cls = ctx.s.classes.filter(x => x.center === c.id), over = cls.filter(x => x.cap > classCap).length;
      // 같은 요일, 같은 시작 시각에 열리는 반 정원을 더해요 (IMP-15)
      const slot = {};
      cls.forEach(x => String(x.days || '').split('·').forEach(d => { const k = d.trim() + ' ' + String(x.time || '').slice(0, 5); slot[k] = (slot[k] || 0) + x.cap; }));
      const peakKey = Object.keys(slot).sort((a, b) => slot[b] - slot[a])[0], peak = peakKey ? slot[peakKey] : null;
      return { c, classCap, ok: fac.indexOf(c.facility) >= 0, teachers: typeof ratio === 'number' && ratio > 0 ? Math.ceil(classCap / ratio) : null, cls, over, maxCap: cls.reduce((m, x) => Math.max(m, x.cap), 0), peak, peakKey };
    });
  }
  function r11(ctx) {
    prep(ctx, 'HQ-11');
    const sid = 'HQ-11', R = ro(ctx), ui = ctx.ui;
    const rows = [
      prow('POL-15', '허용 시설 유형', 1, chks(ctx, sid, 'p15', ['학원', '교습소'], R) + '<span class="small muted">반 정원은 본사 값, 수용능력, 교습소 9명 중 가장 작은 값</span>', '불가', '불가'),
      prow('POL-16', '타임당 정원', 0, inp(ctx, sid, 'p16_cap', { ro: R, w: 48 }) + '명 · 교사 1인당 ' + inp(ctx, sid, 'p16_ratio', { ro: R, w: 48 }) + '명', '본사', '상한 안'),
      prow('POL-17', '교습시간 상한', 2, '지역 조례 값 ' + h.btn('지역표', { sm: true, act: 'HQ11.region' }) + ' <span class="muted">서울 22:00</span>', '불가', '불가'),
      prow('POL-18', '등록 단위', 3, rad(ctx, sid, 'p18', ['월', '4주', '회차권'], R), '불가', '불가'),
      prow('POL-19', '월중 등록 교습비', 0, rad(ctx, sid, 'p19', ['일할', '다음 달부터', '회차 기준'], R), '본사', '선택'),
      prow('POL-20', '4·5주 달', 0, rad(ctx, sid, 'p20', ['월 정액', '회차 차감'], R) + '<span class="small muted">총 교습시간 정의</span>', '본사', '선택'),
      prow('POL-21', '휴원·이월', 4, chk1(ctx, sid, 'p21_allow', '허용', R) + ' 최대 ' + inp(ctx, sid, 'p21_max', { ro: R, w: 40 }) + '개월 · ' + rad(ctx, sid, 'p21_mode', ['다음 달 차감', '기간 연장'], R), '본사', '가능'),
      prow('POL-22', '결석·보강', 0, '월 ' + inp(ctx, sid, 'p22_n', { ro: R, w: 40 }) + '회 · 기한 ' + inp(ctx, sid, 'p22_due', { ro: R, w: 56 }), '본사', '가능'),
      prow('POL-23', '계정 오픈·정지', 5, rad(ctx, sid, 'p23', ['수납 확인 즉시', '원장 승인', '가오픈 3일'], R) + ' · 미수 유예 ' + inp(ctx, sid, 'p23_grace', { ro: R, w: 40 }) + '일', '불가', '불가'),
      prow('POL-24', '재등록 청구 기간', 0, inp(ctx, sid, 'p24_day', { ro: R, w: 40 }) + '일 ~ 말일 · ' + chk1(ctx, sid, 'p24_auto', '자동 안내', R), '본사', '가능'),
    ];
    const hol = st(ctx, sid).hol;
    const holTbl = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>날짜</th><th>구분</th><th>회차 계산</th><th></th></tr></thead><tbody>' +
      hol.map((x, i) => '<tr><td class="mono">' + md(x.from) + (x.to !== x.from ? ' ~ ' + md(x.to) : '') + '</td><td>' + esc(x.name) + '</td><td>제외</td><td>' + (R ? '' : '<button type="button" class="hqc-x" data-act="HQ11.holDel" data-arg="' + i + '">삭제</button>') + '</td></tr>').join('') + '</tbody></table></div>';
    const holForm = R ? '' : '<div class="row" style="margin-top:10px;align-items:flex-end">' +
      '<div class="field"><label>시작일</label><input class="inp" type="date" data-field="h_from" value="' + esc(ui.h_from || '') + '" style="width:140px"></div>' +
      '<div class="field"><label>끝일</label><input class="inp" type="date" data-field="h_to" value="' + esc(ui.h_to || '') + '" style="width:140px"></div>' +
      '<div class="field" style="flex:1;min-width:120px"><label>이름</label><input class="inp" data-field="h_name" value="' + esc(ui.h_name || '') + '" placeholder="어린이날"></div>' +
      h.btn('추가', { act: 'HQ11.holAdd' }) + '</div>' + (ui.h_err ? '<div class="hqc-err" style="margin-top:4px">' + esc(ui.h_err) + '</div>' : '');
    const c6 = card({ pin: 6, title: '공휴일·본사 휴원일 (2027)', body: holTbl + holForm + '<div class="hqc-hint">센터 휴원일은 센터가 CT-19에서 넣어요.</div>' });
    const mon = ui.month || '2027-04';
    const pats = uniq(ctx.s.classes.filter(x => x.center === 'daechi1').map(x => x.days));
    const p20 = get(ctx, sid, 'p20');
    const sesTbl = h.table({
      cols: [
        { label: '반 요일', k: 'p' },
        { label: '회차', num: true, render: r => '<b>' + r.n + '회</b>' },
        { label: '빠지는 날', render: r => r.off.length ? '<span class="small">' + esc(r.off.join(', ')) + '</span>' : '<span class="muted small">없음</span>' },
        { label: '총 교습시간', num: true, render: r => (r.n * 90) + '분' },
        { label: '', render: r => h.btn('환불 계산에 쓰기', { sm: true, ghost: true, act: 'HQ11.toRefund', arg: mon + '|' + r.p }) },
      ],
      rows: pats.map(p => Object.assign({ p }, sessions(ctx, mon, p))),
    });
    const c8 = card({
      pin: 8, cls: '', title: '반 요일별 회차 미리보기', chip: B.impChip('IMP-09'),
      body: '<div class="row" style="margin-bottom:8px">' + h.opts(['2027-02', '2027-03', '2027-04', '2027-05', '2027-06', '2027-07', '2027-08'].map(x => ({ v: x, l: +x.slice(5) + '월' })), mon, { act: 'HQ11.month' }) + '</div>' + sesTbl +
        '<div class="hqc-hint">회당 90분(POL-10 예시), 대치1센터 반 기준이에요. ' + (p20 === '회차 차감' ? '회차 차감이라 회차가 다른 반은 그달 금액도 달라져요.' : p20 === '월 정액' ? '월 정액이라 회차가 달라도 같은 금액을 받아요.' : '4·5주 달 처리가 미정이라 금액 기준은 아직 못 정해요.') + '</div>',
    });
    const cr = capRows(ctx);
    const capTbl = h.table({
      cols: [
        { label: '센터', render: r => esc(r.c.name) + ' <span class="muted small">' + esc(r.c.type) + '</span>' },
        { label: '시설', render: r => esc(r.c.facility) + (r.ok ? '' : ' ' + h.chip('허용 밖', 'bad')) },
        { label: '강의실 정원', num: true, render: r => r.c.roomCap + '명' },
        { label: '반 정원 상한', num: true, render: r => '<b>' + r.classCap + '명</b>' },
        { label: '같은 시간 합계', num: true, render: r => (r.peak == null ? '<span class="muted">-</span>' : '<b' + (r.peak > r.c.facilityCap ? ' style="color:var(--bad)"' : '') + '>' + r.peak + '명</b>') + ' / ' + r.c.facilityCap + '명' },
        { label: '반 하나 교사', num: true, render: r => r.teachers == null ? '-' : r.teachers + '명' },
        { label: '지금 반 설정', render: r => !r.cls.length ? '<span class="muted">반 없음</span>' : (r.over ? h.chip(r.over + '개 반 정원(' + r.maxCap + '명)이 상한보다 커요', 'warn') : h.chip('반 정원 상한 안', 'ok')) + (r.peak > r.c.facilityCap ? ' ' + h.chip(r.peakKey + ' 합계가 수용능력보다 커요', 'bad') : '') },
      ],
      rows: cr,
    });
    const c7 = card({
      pin: 7, title: '센터별 정원 계산', chip: B.impChip('IMP-15'), sub: '저장 전 값으로 바로 계산',
      body: capTbl + '<div class="hqc-hint">반 하나는 본사 값, 강의실 정원, 교습소 9명 중 작은 값을 넘지 못해요. 같은 요일, 같은 시각에 열리는 반 정원을 더해도 시설 수용능력을 넘지 못해요. 반 설정은 CT-11에서 같은 규칙으로 검사해요. 대치1센터 반은 정원 15명인데 강의실이 12명이라 걸려요(모두 예시).</div>',
    });
    return frame(ctx, sid, ptable(rows) + '<div class="grid g2" style="margin-top:12px">' + c6 + c8 + '</div><div style="margin-top:12px">' + c7 + '</div>');
  }
  const L11 = { p15: '허용 시설 유형', p16_cap: '타임당 정원', p16_ratio: '교사 1인당 인원', p18: '등록 단위', p19: '월중 등록 교습비', p20: '4·5주 달', p21_allow: '휴원 허용', p21_max: '휴원 최대', p21_mode: '휴원 이월 방식', p22_n: '보강 횟수', p22_due: '보강 기한', p23: '계정 오픈 조건', p23_grace: '미수 유예', p24_day: '재등록 청구 시작일', p24_auto: '재등록 자동 안내' };
  CFG['HQ-11'] = {
    num: /^(p16_cap|p16_ratio|p21_max|p22_n|p23_grace|p24_day)$/,
    order: { p15: ['학원', '교습소'] },
    label: key => L11[key] || key,
    fmt: (key, v) => {
      if (v === '' || v == null) return '미정';
      if (typeof v !== 'number') return fmtDefault(v);
      return v + ({ p16_cap: '명', p16_ratio: '명', p21_max: '개월', p22_n: '회', p23_grace: '일', p24_day: '일' }[key] || '');
    },
    code: key => ({ p15: 'POL-15', p16_cap: 'POL-16', p16_ratio: 'POL-16', p18: 'POL-18', p19: 'POL-19', p20: 'POL-20', p21_allow: 'POL-21', p21_max: 'POL-21', p21_mode: 'POL-21', p22_n: 'POL-22', p22_due: 'POL-22', p23: 'POL-23', p23_grace: 'POL-23', p24_day: 'POL-24', p24_auto: 'POL-24' })[key] || 'POL-16',
    validate(ctx, out, g) {
      if (!(g('p15') || []).length) err(out, 'p15', '허용 시설 유형을 하나 이상 골라 주세요.');
      if (!isInt(g('p16_cap'), 1, 99)) err(out, 'p16_cap', '타임당 정원을 1 이상 정수로 넣어 주세요.');
      if (!isInt(g('p16_ratio'), 1, 99)) err(out, 'p16_ratio', '교사 1인당 인원을 1 이상 정수로 넣어 주세요.');
      if ((g('p15') || []).indexOf('교습소') >= 0 && g('p16_cap') > 9) { const w = '교습소는 동시 교습 9명(법정)이라 교습소 센터의 반 정원은 9명으로 잡혀요.'; if (out.warns.indexOf(w) < 0) out.warns.push(w); }
      if (g('p21_allow') && !isInt(g('p21_max'), 1, 12)) err(out, 'p21_max', '휴원 최대 기간을 1부터 12 사이 개월로 넣어 주세요.');
      if (!isInt(g('p22_n'), 0, 31)) err(out, 'p22_n', '보강 횟수를 0 이상 정수로 넣어 주세요.');
      if (!String(g('p22_due') || '').trim()) err(out, 'p22_due', '보강 기한을 넣어 주세요.');
      if (!isInt(g('p23_grace'), 0, 31)) err(out, 'p23_grace', '미수 유예를 0부터 31 사이 일수로 넣어 주세요.');
      if (!isInt(g('p24_day'), 1, 28)) err(out, 'p24_day', '재등록 청구 시작일은 1일부터 28일 사이로 넣어 주세요.');
    },
    text: {
      'POL-15': g => (g('p15') || []).join(', ') || '없음',
      'POL-16': g => g('p16_cap') + '명',
      'POL-18': g => g('p18') + ' 단위',
      'POL-19': g => g('p19') || '미정',
      'POL-20': g => g('p20') || '미정',
      'POL-21': g => g('p21_allow') ? '최대 ' + g('p21_max') + '개월, ' + g('p21_mode') : '허용 안 함',
      'POL-22': g => '월 ' + g('p22_n') + '회, 기한 ' + g('p22_due'),
      'POL-23': g => (g('p23') || '오픈 조건 미정') + ', 미수 유예 ' + g('p23_grace') + '일',
      'POL-24': g => g('p24_day') + '일~말일' + (g('p24_auto') ? ', 자동 안내' : ''),
    },
  };
  common('HQ-11');
  act('HQ-11', 'month', (ctx, v) => { if (/^2027-\d\d$/.test(String(v))) ctx.ui.month = v; });
  act('HQ-11', 'region', ctx => {
    const rows = opCenters().map(c => '<tr><td>' + esc(c.region) + '</td><td>' + esc(c.edu) + '</td><td class="mono">' + esc(c.curfew) + '</td></tr>').join('');
    B.modal({ title: '교습시간 상한 지역표', body: h.alert('시·도 조례 값이라 본사와 센터 모두 못 바꿔요. 시간표(CT-11)를 저장할 때 이 시각을 넘는 타임은 막아요.', 'info') + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>지역</th><th>교육지원청</th><th>상한</th></tr></thead><tbody>' + rows + '</tbody></table></div><div class="small muted">운영 센터 데이터 기준 (예시)</div>', cancel: '닫기' });
    return false;
  });
  act('HQ-11', 'holAdd', (ctx, arg) => {
    const ui = ctx.ui;
    if (arg && typeof arg === 'object') { ui.h_from = arg.from; ui.h_to = arg.to || ''; ui.h_name = arg.name; }
    const from = (ui.h_from || '').trim(), to = (ui.h_to || '').trim() || from, name = (ui.h_name || '').trim();
    const hol = st(ctx, 'HQ-11').hol;
    ui.h_err = !/^2027-\d\d-\d\d$/.test(from) ? '시작일을 2027년 날짜로 넣어 주세요.'
      : !/^2027-\d\d-\d\d$/.test(to) || to < from ? '끝일은 시작일과 같거나 뒤인 2027년 날짜여야 해요.'
        : !name ? '휴원일 이름을 넣어 주세요.'
          : hol.some(x => !(to < x.from || from > x.to)) ? '이미 들어 있는 날과 겹쳐요.' : null;
    if (ui.h_err) return;
    hol.push({ from, to, name }); hol.sort((a, b) => a.from < b.from ? -1 : 1);
    st(ctx, 'HQ-11').log.unshift({ at: ctx.today, by: ctx.persona.name, when: '즉시', reason: '공휴일 표', n: opCenters().length, items: ['휴원일 추가 ' + md(from) + (to !== from ? '~' + md(to) : '') + ' ' + name] });
    ui.h_from = ''; ui.h_to = ''; ui.h_name = '';
    if (from.slice(0, 7) >= '2027-02' && from.slice(0, 7) <= '2027-08') ui.month = from.slice(0, 7);
    B.toast('휴원일(' + name + ')을 추가했어요. 회차 미리보기와 환불 계산에 바로 반영돼요.');
  });
  act('HQ-11', 'holDel', (ctx, i) => {
    const hol = st(ctx, 'HQ-11').hol, x = hol[+i]; if (!x) return;
    B.modal({
      title: '휴원일 삭제', body: '<p style="margin:0"><b>' + esc(md(x.from) + (x.to !== x.from ? ' ~ ' + md(x.to) : '') + ' ' + x.name) + '</b></p><p style="margin:0">지우면 그날이 다시 회차에 들어가요. 이미 청구한 달이면 센터에 다시 계산 안내가 가요.</p>', ok: '삭제',
      onOk: () => { hol.splice(+i, 1); B.toast('휴원일을 지웠어요.'); },
    });
    return false;
  });
  act('HQ-11', 'toRefund', (ctx, arg) => {
    const [mon, pat] = String(arg || '2027-04|화·목').split('|'), r = sessions(ctx, mon, pat || '화·목');
    ctx.s.ui['HQ-12'] = Object.assign(ctx.s.ui['HQ-12'] || {}, { x_n: String(r.n), x_min: '90', x_from: +mon.slice(5) + '월 ' + pat + ' 반' });
    B.go('HQ-12'); return false;
  });

  B.screen({
    id: 'HQ-11', side: 'hq', phase: 'P1a', devices: ['pc'], pages: [30],
    title: '시설·학사·등록 규칙', menuLabel: '학사·등록', crumb: '정책·요금 설정 > 학사·등록',
    headActions: heads('HQ-11'), render: r11, mount: mountFn,
    prd: {
      summary: '센터 운영의 기본 규칙을 한 표로 정하는 화면이에요. 정원, 수업 마감 시각, 등록 단위, 휴원과 보강, 계정 열기, 재등록 기간, 공휴일을 정하고, 여기 값이 수강료와 환불 계산에 그대로 쓰여요.',
      who: WHO + ' 값은 대표, 경영지원, 연구소, IT가 나눠 정해요. 센터는 표에서 가능이나 선택으로 표시된 값만 CT-18, CT-19에서 바꿔요.',
      items: [
        { n: 1, t: '시설과 정원', d: '회의에서 나온 안(한 타임 15명, 20명이면 보조 교사)은 학원으로 등록해야 쓸 수 있어요. 교습소는 동시에 9명, 보조요원 1명까지예요(법정). 센터 정원은 이 값과 시설 수용능력 중 작은 값이에요. 교사 1명당 10명(예시)도 함께 정해요.', pol: ['POL-15', 'POL-16'], ref: 'p.30 ①' },
        { n: 2, t: '교습시간 상한', d: '시·도 조례가 정한 수업 마감 시각이에요. 지역표로 관리하고 서울은 22:00이에요. 이 시각을 넘는 타임은 시간표(CT-11)에 저장되지 않아요.', pol: ['POL-17'], ref: 'p.30 ②' },
        { n: 3, t: '등록 단위와 월중 등록, 4·5주 달', d: '월 단위로 매달 1일에 시작하는 것이 안이에요. 달 중간 등록과 4·5주 달 처리는 아직 못 정해서 선택지로 둬요. 4·5주 처리는 환불 계산의 총 교습시간을 정해요. 가맹은 게시한 교습비와 같게 골라요.', pol: ['POL-18', 'POL-19', 'POL-20'], ref: 'p.30 ③' },
        { n: 4, t: '휴원과 보강', d: '휴원은 최대 1개월이고, 쉬는 동안의 교습비는 다음 달 교습비에서 빼 줘요. 보강은 월 2회, 2주 안이에요(모두 예시). 가맹은 바꿀 수 있어요.', pol: ['POL-21', 'POL-22'], ref: 'p.30 ④' },
        { n: 5, t: '계정 오픈과 재등록', d: '돈을 먼저 내는 것이 원칙이에요(10/14). 학습 계정을 여는 때를 수납 확인 즉시, 원장 승인, 가오픈 3일 중에서 골라요. 미납이면 5일(예시) 기다려 줘요. 재등록 기간은 20일부터 말일까지(안)이고 안내가 자동으로 나가요.', pol: ['POL-23', 'POL-24'], ref: 'p.30 ⑤' },
        { n: 6, t: '공휴일과 본사 휴원일', d: '회차와 총 교습시간 계산에서 뺄 날을 관리해요. 설날 연휴, 삼일절, 본사 지정 휴원(예시)이 들어 있어요. 날짜와 이름을 넣고 추가하면 회차 미리보기에 바로 반영돼요. 센터 휴원일은 센터가 CT-19에서 넣어요.', ref: 'p.30 ⑥' },
        { n: 7, t: '센터별 정원 계산', kind: 'review', imp: 'IMP-15', pol: ['POL-15', 'POL-16'], d: '규칙은 두 개예요. 반 하나는 본사 값, 강의실 정원, 교습소 9명 중 가장 작은 값을 넘지 못해요. 같은 시간에 열리는 반 정원을 모두 더해도 시설 수용능력을 넘지 못해요. 센터마다 두 값을 계산하고, 지금 반 설정이 넘거나 허용 밖 시설이면 바로 표시해요.' },
        { n: 8, t: '반 요일별 회차 미리보기', kind: 'review', imp: 'IMP-09', pol: ['POL-20'], d: '반 요일마다 그달 수업이 몇 번인지 공휴일을 빼고 세어 줘요. 같은 달이라도 월·수 반과 화·목 반의 회차가 달라요. 고른 회차를 환불 계산 미리보기(HQ-12)로 바로 넘길 수 있어요.' },
      ],
      open: ['학원으로 할지 교습소로 할지 (부록 A 1번, P1a 전)', '한 타임 정원과 보조 교사를 붙이는 인원 기준', '달 중간 등록 학생의 수강료 계산 방법', '4주 달과 5주 달 처리 방법 (환불 계산에 바로 쓰여요)', '휴원 기간과 이월 방식, 보강 횟수와 기한', '학습 계정을 여는 시점과 미납 유예 일수', '1년치 공휴일과 임시공휴일을 누가 언제 넣는지'],
      rules: ['교습소는 동시 교습 9명까지예요 (학원법).', '시·도 조례의 교습시간 상한을 넘는 수업은 열 수 없어요.'],
    },
  });

  /* =====================================================================
     HQ-12 환불 규정 (p.31)
     ===================================================================== */
  const FR = [{ v: '반환 없음', n: 0, d: 1 }, { v: '1/3', n: 1, d: 3 }, { v: '1/2', n: 1, d: 2 }, { v: '2/3', n: 2, d: 3 }, { v: '3/4', n: 3, d: 4 }, { v: '전액', n: 1, d: 1 }];
  const frac = v => FR.find(x => x.v === v) || FR[0];
  const fval = v => frac(v).n / frac(v).d;
  const SEG = { a: '1/3 경과 전', b: '1/2 경과 전', c: '1/2 경과 후' };
  const upCenters = () => opCenters().filter(c => c.type !== '직영');
  const isUp = (ctx, id) => ['a', 'b', 'c'].some(x => fval(eff(ctx, 'HQ-12', 'base', 'up_' + id + '_' + x)) > fval(LEGAL[x])) || eff(ctx, 'HQ-12', 'base', 'up_' + id + '_d') < LEGAL.d;
  function addDays(t, n) { const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(t || ''); if (!m) return ''; return ymd(new Date(+m[1], +m[2] - 1, +m[3] + n)); }
  function calc(ctx) {
    const ui = ctx.ui, sid = 'HQ-12';
    const fee = toNum(ui.x_fee != null ? ui.x_fee : 260000), paid = toNum(ui.x_paid != null ? ui.x_paid : 260000);
    const n = toNum(ui.x_n != null ? ui.x_n : 9), min = toNum(ui.x_min != null ? ui.x_min : 90), el = toNum(ui.x_el != null ? ui.x_el : 1);
    const date = ui.x_date || '2027-03-06', cid = ui.x_center || '법정', basis = ui.x_base || '실제 낸 금액';
    const unit = eff(ctx, sid, 'base', 'round') || 10;
    const r = { fee, paid, n, min, el, date, cid, basis, unit, errs: [] };
    if (!(n > 0)) r.errs.push('회차를 1 이상 넣어 주세요.');
    if (!(min > 0)) r.errs.push('회당 시간을 넣어 주세요.');
    if (!(el >= 0) || el > n) r.errs.push('경과 회차는 0부터 총 회차 사이로 넣어 주세요.');
    if (!(fee > 0) || !(paid >= 0)) r.errs.push('금액을 숫자로 넣어 주세요.');
    if (r.errs.length) return r;
    r.total = n * min; r.elMin = el * min; r.pct = el / n;
    let seg, legal;
    if (el === 0) { seg = '교습 시작 전'; legal = '전액'; } else if (r.pct < 1 / 3) { seg = SEG.a; legal = LEGAL.a; r.sk = 'a'; } else if (r.pct < 1 / 2) { seg = SEG.b; legal = LEGAL.b; r.sk = 'b'; } else { seg = SEG.c; legal = LEGAL.c; r.sk = 'c'; }
    let ratio = legal, days = LEGAL.d;
    if (cid !== '법정' && B.center(cid)) {
      if (r.sk) { const cv = eff(ctx, sid, 'base', 'up_' + cid + '_' + r.sk); if (fval(cv) > fval(legal)) ratio = cv; }
      const cd = eff(ctx, sid, 'base', 'up_' + cid + '_d'); if (typeof cd === 'number' && cd < days) days = cd;
    }
    const base = basis === '정가' ? fee : paid, f = frac(ratio);
    r.seg = seg; r.legal = legal; r.ratio = ratio; r.up = ratio !== legal; r.base = base; r.days = days;
    r.amount = Math.ceil(base * f.n / f.d / unit - 1e-9) * unit;
    r.legalAmount = Math.ceil(base * frac(legal).n / frac(legal).d / unit - 1e-9) * unit;
    r.deadline = addDays(date, days); r.warnFrom = addDays(r.deadline, -2);
    return r;
  }
  function liveIn(ctx, key, def, w, type) {
    const v = ctx.ui[key] != null ? ctx.ui[key] : def;
    return '<input class="inp hqc-in" type="' + (type || 'text') + '" data-field="' + key + '" data-live="1" value="' + esc(type === 'date' ? v : fmtIn(typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v)) + '" style="width:' + w + 'px" aria-label="' + key + '">';
  }
  function r12(ctx) {
    prep(ctx, 'HQ-12');
    const sid = 'HQ-12', R = ro(ctx), ui = ctx.ui;
    const legalTbl = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>구분</th><th>반환 사유 발생 시점</th><th>반환액</th></tr></thead><tbody>' +
      [['교습기간 1개월 이내', '교습 시작 전', '이미 낸 교습비 전액'], ['', '총 교습시간의 1/3 경과 전', '2/3 해당액'], ['', '1/2 경과 전', '1/2 해당액'], ['', '1/2 경과 후', '반환하지 않음'],
        ['교습기간 1개월 초과', '교습 시작 전', '전액'], ['', '교습 시작 후', '사유가 생긴 달은 위 기준, 남은 달은 전액'], ['센터 사정으로 교습 불가', '-', '교습할 수 없게 된 날 기준 일할 계산액']]
        .map(r => '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td></tr>').join('') + '</tbody></table></div>';
    const c1 = card({ pin: 1, title: 'POL-25 법정 반환 기준 (학원법 시행령 별표4)', chip: stChip('POL-25'), body: legalTbl + '<div class="hqc-hint">읽기 전용이에요. 시스템 계산의 최소선이고, 법령 원문과 대조한 뒤 확정해요 (부록 B).</div>' });
    const below = id => ['a', 'b', 'c'].some(x => fval(eff(ctx, sid, 'base', 'up_' + id + '_' + x)) < fval(LEGAL[x])) || eff(ctx, sid, 'base', 'up_' + id + '_d') > LEGAL.d;
    const upRows = upCenters().map(c => {
      const k = 'up_' + c.id + '_', edit = ui.upEdit === c.id && !R;
      const cell = x => edit ? sel(ctx, sid, k + x, FR.map(f => f.v), { label: c.name + ' ' + SEG[x] }).replace('<select class="', '<select style="width:' + (x === 'c' ? 92 : 66) + 'px" class="') : esc(cur(ctx, sid, k + x)) + nx(ctx, sid, k + x);
      const e = ['a', 'b', 'c', 'd'].map(x => errOf(ctx, k + x)).filter(Boolean);
      const tag = below(c.id) ? h.chip('법정보다 불리', 'bad') : isUp(ctx, c.id) ? h.chip('상향', 'review') : h.chip('법정 그대로', 'line');
      return '<tr><td><div class="nw">' + esc(c.name.replace('센터', '')) + (R || edit ? '' : ' ' + h.btn('편집', { sm: true, ghost: true, act: 'HQ12.upEdit', arg: c.id })) + '</div>' + tag + (e.length ? '<div class="hqc-err">' + esc(e[0]) + '</div>' : '') + '</td><td>' + cell('a') + '</td><td>' + cell('b') + '</td><td>' + cell('c') + '</td><td class="nw">' +
        (edit ? inp(ctx, sid, k + 'd', { w: 34 }) + '일' : esc(cur(ctx, sid, k + 'd')) + '일') + '</td></tr>';
    }).join('');
    const editing = ui.upEdit && !R ? B.center(ui.upEdit) : null;
    const c2 = card({
      pin: 2, title: '센터 상향 설정',
      body: kvt([['가맹 센터', h.chip('상향만 가능', 'line') + ' <span class="small muted">예를 들어 1/2 경과 전에도 2/3 반환</span>'], ['직영 센터', h.chip('법정 기준', 'line')]]) +
        '<div class="hqc-subh">센터별 반환 기준</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>센터</th><th>1/3 경과 전</th><th>1/2 경과 전</th><th>1/2 경과 후</th><th>기한</th></tr></thead><tbody>' + upRows + '</tbody></table></div>' +
        (editing ? '<div class="row" style="margin-top:8px;justify-content:flex-end"><span class="small muted">' + esc(editing.name) + ' 기준을 고치는 중이에요</span>' + h.btn('편집 완료', { sm: true, primary: true, act: 'HQ12.upDone' }) + '</div>' : '') +
        '<div class="hqc-hint">법정 기준보다 학부모에게 불리한 값은 저장되지 않아요. 고친 값은 위쪽 저장을 눌러야 반영돼요.</div>',
    });
    const c3 = card({
      pin: 3, title: '계산 기준',
      body: kvt([
        ['총 교습시간', '해당 월 회차 × 회당 시간 ' + h.chip('POL-20 연동', 'line')],
        ['제외', '공휴일, 휴원일 ' + h.btn('휴원일 표 보기', { sm: true, ghost: true, go: 'HQ-11' })],
        ['교재비 등', rad(ctx, sid, 'p14_refund', ['미정', '받지 않은 주차분 반환'], R) + '<span class="small muted">미사용분 처리 방식</span>'],
      ]),
    });
    const c4 = card({ pin: 4, title: '기한', body: '<div class="hqc-big">반환 사유 발생일부터 <b>5일 이내</b> 반환</div><div class="hqc-hint">기한 2일 전부터 센터와 본사 대시보드(CT-01, HQ-01)에 경고가 떠요.</div>' });
    const r = calc(ctx);
    const pcOpts = [{ v: '법정', l: '법정 기준 (직영)' }].concat(upCenters().map(c => ({ v: c.id, l: c.name.replace('센터', '') + (isUp(ctx, c.id) ? ' (상향)' : '') })));
    const ok = !r.errs.length;
    const unitL = { 1: '1원 단위', 10: '10원 단위 올림', 100: '100원 단위 올림' }[r.unit] || r.unit + '원 단위 올림';
    const c5 = card({
      pin: 5, title: '계산 미리보기', sub: ui.x_from ? ui.x_from + ' 회차로 계산 중' : 'CT-10과 같은 계산',
      body: kvt([
        ['기준 센터', h.opts(pcOpts, r.cid, { act: 'HQ12.pc' })],
        ['교습비', liveIn(ctx, 'x_fee', 260000, 92) + ' 원'],
        ['총 교습시간', liveIn(ctx, 'x_n', 9, 40) + '회 × ' + liveIn(ctx, 'x_min', 90, 44) + '분' + (ok ? ' = <b>' + r.total + '분</b>' : '') + (String(r.n) === '9' && String(r.min) === '90' ? ' <span class="small muted">(5주 달, 공휴일 제외)</span>' : '')],
        ['경과', liveIn(ctx, 'x_el', 1, 40) + '회' + (ok ? ' = ' + r.elMin + '분 (' + (r.pct * 100).toFixed(1) + '%)' : '')],
        ['구간', ok ? esc(r.seg) + ', ' + esc(r.ratio) + ' 반환' + (r.up ? ' ' + h.chip('센터 상향 (법정 ' + r.legal + ')', 'review') : '') : '-'],
        ['반환액', ok ? '<b class="hqc-amt">' + money(r.amount) + '원</b> <span class="small muted">' + esc(unitL) + ' (예시)</span>' + (r.up ? '<div class="small muted">법정 기준보다 ' + money(r.amount - r.legalAmount) + '원 더 돌려줘요</div>' : '') : '-'],
        ['반환 기한', '사유 발생일 + ' + (ok ? r.days : 5) + '일'],
      ]) + (ok ? '' : '<div style="margin-top:8px">' + h.alert(r.errs.join(' '), 'bad') + '</div>') +
        '<div class="hqc-rvbox" data-pin="6">' + reviewHead('실제 낸 금액과 사유 발생일', 'IMP-09') + kvt([
          ['기준 금액', h.opts(['실제 낸 금액', '정가'], r.basis, { act: 'HQ12.base' })],
          ['실제 낸 금액', liveIn(ctx, 'x_paid', 260000, 92) + ' 원 <span class="small muted">할인과 테스트비 차감 반영</span>'],
          ['사유 발생일', liveIn(ctx, 'x_date', '2027-03-06', 140, 'date')],
          ['반환 기한', ok && r.deadline ? '<b>' + r.deadline + '</b> <span class="small muted">' + md(r.warnFrom) + '부터 대시보드 경고</span>' : '-'],
        ]) + '</div>',
    });
    const c9 = card({
      title: '계산 규칙 보완', sub: '검토 결과를 반영한 값',
      body: '<div class="hqc-rvbox" data-pin="7" style="margin-top:0">' + reviewHead('끝전 처리', 'IMP-29') + '<div class="hqc-val">' + rad(ctx, sid, 'round', [{ v: 1, l: '1원 단위' }, { v: 10, l: '10원 올림 (예시)' }, { v: 100, l: '100원 올림' }], R) + '</div><div class="hqc-hint">어느 단위든 학부모에게 불리하지 않게 올림만 써요.</div></div>' +
        '<div class="hqc-rvbox" data-pin="8">' + reviewHead('규정 버전', 'IMP-10') + verBox(ctx) + '</div>',
    });
    return frame(ctx, sid, '<div class="grid g2"><div class="stack">' + c1 + c2 + c9 + '</div><div class="stack">' + c3 + c4 + c5 + '</div></div>');
  }
  function verBox(ctx) {
    const ver = st(ctx, 'HQ-12').ver, last = ver[ver.length - 1];
    return '<div class="hqc-val">적용 규정 ' + h.chip(last.v + ' · ' + last.date, 'navy') + '<span class="small muted">환불 기록마다 이 버전을 함께 남겨요</span></div>' +
      '<div class="small" style="margin-top:6px">' + ver.slice().reverse().map(x => esc(x.v + ' ' + x.date + ' ' + x.by + ', ' + x.note)).join('<br>') + '</div>' +
      '<div class="hqc-hint">상향 기준을 낮추는 변경은 다음 달 1일부터 적용하고, 이미 결제한 수강권은 결제할 때 기준을 써요.</div>';
  }
  CFG['HQ-12'] = {
    num: /^(round|up_.*_d)$/,
    baseKeys: /^up_/,
    label: key => { const m = /^up_(\w+)_([abcd])$/.exec(key); if (m) { const c = B.center(m[1]); return (c ? c.name.replace('센터', '') : m[1]) + ' ' + (m[2] === 'd' ? '반환 기한' : SEG[m[2]]); } return ({ p14_refund: '교재비 미사용분', round: '끝전 처리' })[key] || key; },
    fmt: (key, v) => /_d$/.test(key) ? v + '일' : key === 'round' ? ({ 1: '1원 단위', 10: '10원 올림', 100: '100원 올림' }[v] || v) : fmtDefault(v),
    code: key => key === 'p14_refund' ? 'POL-14' : 'POL-25',
    validate(ctx, out, g, k, list) {
      upCenters().forEach(c => {
        ['a', 'b', 'c'].forEach(x => { const key = 'up_' + c.id + '_' + x; if (fval(g(key)) < fval(LEGAL[x])) err(out, key, c.name.replace('센터', '') + ' ' + SEG[x] + ' 반환이 법정(' + LEGAL[x] + ')보다 적어요. 학부모에게 불리한 값은 저장할 수 없어요.'); });
        const dk = 'up_' + c.id + '_d'; if (!isInt(g(dk), 1, LEGAL.d)) err(out, dk, c.name.replace('센터', '') + ' 반환 기한은 1일부터 5일 사이여야 해요.');
      });
      const lower = list.filter(x => /^up_/.test(x.key) && (/_d$/.test(x.key) ? x.to > x.from : fval(x.to) < fval(x.from)));
      if (lower.length) {
        out.force = '2027-04-01 0시 예약';
        const w = '상향 기준을 낮추는 변경이 있어서 다음 달 1일부터 적용해요. 이미 결제한 수강권은 결제할 때 기준을 써요.';
        if (out.warns.indexOf(w) < 0) out.warns.push(w);
      }
    },
    text: { 'POL-14': g => '교재비 미사용분 ' + g('p14_refund') },
    after(ctx, list, when) {
      const ver = st(ctx, 'HQ-12').ver;
      ver.push({ v: 'v' + (ver.length + 1), date: when === '즉시' ? ctx.today : when.slice(0, 10), by: ctx.persona.name, note: uniq(list.map(x => CFG['HQ-12'].label(x.key))).join(', ') + ' 변경' });
    },
  };
  common('HQ-12');
  act('HQ-12', 'upEdit', (ctx, id) => { if (B.center(id)) ctx.ui.upEdit = id; });
  act('HQ-12', 'upDone', ctx => { ctx.ui.upEdit = null; const v = validate(ctx, 'HQ-12', changes(ctx, 'HQ-12')); if (v.errs.length) B.toast(v.errs[0]); });
  act('HQ-12', 'pc', (ctx, v) => { ctx.ui.x_center = v === '법정' || B.center(v) ? v : '법정'; });
  act('HQ-12', 'base', (ctx, v) => { if (v === '정가' || v === '실제 낸 금액') ctx.ui.x_base = v; });
  act('HQ-12', 'calc', (ctx, arg) => {
    if (!arg || typeof arg !== 'object') return;
    const map = { fee: 'x_fee', paid: 'x_paid', n: 'x_n', min: 'x_min', el: 'x_el', date: 'x_date', center: 'x_center', base: 'x_base' };
    Object.keys(map).forEach(k => { if (arg[k] != null) ctx.ui[map[k]] = String(arg[k]); });
  });

  B.screen({
    id: 'HQ-12', side: 'hq', phase: 'P1a', devices: ['pc'], pages: [31],
    title: '환불 규정', menuLabel: '환불 규정', crumb: '정책·요금 설정 > 환불 규정',
    headActions: heads('HQ-12', '저장'), render: r12, mount: mountFn,
    prd: {
      summary: '학부모가 그만두거나 쉴 때 수강료를 얼마나 돌려줄지 정하는 화면이에요. 학원법의 최소 기준을 그대로 두고, 가맹 센터는 학부모에게 더 유리하게만 바꿀 수 있어요.',
      who: WHO + ' 법정 기준 표는 아무도 못 고쳐요. 계산 결과는 센터의 환불 처리 화면(CT-10)에서 그대로 써요.',
      items: [
        { n: 1, t: '법정 반환 기준', d: '학원법 시행령 별표4의 반환 표를 읽기 전용으로 보여 줘요. 시스템은 이 표보다 적게 돌려주는 계산을 하지 않아요. 법령 원문과 대조한 뒤 확정해요.', pol: ['POL-25'], ref: 'p.31 ①' },
        { n: 2, t: '센터 상향 설정', d: '가맹 센터는 기준을 올리는 쪽으로만 바꿀 수 있어요. 예를 들어 1/2이 지나기 전에도 2/3를 돌려주는 식이에요. 편집을 눌러 구간별 비율을 고르면 되고, 법정보다 적은 값은 저장되지 않아요. 직영은 법정 기준을 그대로 써요.', pol: ['POL-25'], ref: 'p.31 ②' },
        { n: 3, t: '계산 기준과 총 교습시간', d: '돌려줄 비율의 분모는 그달 회차 × 회당 시간이에요. 회차는 4·5주 달 정책(POL-20)이 정하고, 공휴일과 휴원일은 빼요. 교재비 같은 기타경비를 어떻게 돌려줄지는 아직 미정이에요. 검토에서는 받지 않은 주차분을 돌려주는 안이 나왔어요.', pol: ['POL-20', 'POL-14'], ref: 'p.31 ③' },
        { n: 4, t: '반환 기한', d: '사유가 생긴 날부터 5일 안에 돌려줘야 해요. 기한 2일 전부터 센터와 본사 대시보드에 경고가 떠요.', pol: ['POL-25'], ref: 'p.31 ④' },
        { n: 5, t: '계산 미리보기', d: '교습비 260,000원, 9회 × 90분 = 810분에서 1회가 지나면 11.1%라서 1/3 경과 전 구간이에요. 2/3를 돌려주고 끝전을 올려 173,340원이 돼요(예시). 칸의 숫자를 바꾸면 결과가 바로 바뀌어요. 학부모 환불과 본사 사용료 반환(POL-03)은 따로 계산해요.', pol: ['POL-25', 'POL-03'], ref: 'p.31 ⑤' },
        { n: 6, t: '실제 낸 금액과 사유 발생일', kind: 'review', imp: 'IMP-09', d: '할인과 테스트비 차감이 들어가면 학부모가 실제로 낸 돈은 정가보다 적어요. 기준 금액을 실제 낸 금액과 정가 중에서 골라 볼 수 있고, 사유 발생일을 넣으면 반환 기한 날짜와 경고 시작일을 바로 계산해 줘요.' },
        { n: 7, t: '끝전 처리', kind: 'review', imp: 'IMP-29', pol: ['POL-25'], d: '예시에 숨어 있던 끝전 올림 단위를 정책 값으로 꺼냈어요. 1원, 10원(예시), 100원 단위 중에서 고르고, 어느 경우에도 학부모에게 불리하지 않게 올림만 해요.' },
        { n: 8, t: '규정 버전', kind: 'review', imp: 'IMP-10', d: '환불 계산 결과에 그때 쓴 규정 버전을 함께 남겨요. 센터 상향 기준을 낮추는 변경은 바로 적용하지 않고 다음 달 1일로 예약돼요. 이미 결제한 수강권은 결제할 때 기준을 써요.' },
      ],
      open: ['교재비 같은 기타경비를 어떻게 돌려줄지 (POL-14)', '4주 달과 5주 달 처리 방법 (POL-20, 총 교습시간이 여기서 정해져요)', '법령 원문과 대조한 최종 확인 (부록 B)', '끝전을 몇 원 단위로 올릴지', '결석, 보강, 휴원 중에 사유가 생기면 경과 회차를 어떻게 세는지'],
      rules: ['사유 발생일부터 5일 안에 반환해요 (학원법 시행령 별표4).', '가맹 센터는 법정 기준보다 학부모에게 유리하게만 바꿀 수 있어요.'],
    },
  });

  /* =====================================================================
     HQ-13 레벨 체계·승급 (p.32)
     ===================================================================== */
  const GRADES = ['초1', '초2', '초3', '초4', '초5', '초6'];
  function gr(t) { t = String(t || '').replace(/\s/g, ''); if (t === '전학년') return [1, 6]; const m = /^초([1-6])(?:~초?([1-6]))?$/.exec(t); if (!m) return null; const a = +m[1], b = m[2] ? +m[2] : a; return a <= b ? [a, b] : null; }
  const gnum = t => { const m = /초([1-6])/.exec(t || ''); return m ? +m[1] : null; };
  function scoreR(t) { const m = /^(\d+)~(\d+)$/.exec(String(t || '').replace(/\s/g, '')); return m ? [+m[1], +m[2]] : null; }
  function gapCheck(levels, min, max) {
    const bad = [], gaps = [];
    levels.forEach(l => { if (!gr(l.grade)) bad.push(l.code); });
    for (let g = gnum(min) || 1; g <= (gnum(max) || 6); g++) if (!levels.some(l => { const r = gr(l.grade); return r && g >= r[0] && g <= r[1]; })) gaps.push('초' + g);
    return { bad, gaps };
  }
  function needMap(ctx) {
    const sid = 'HQ-13', a = (eff(ctx, sid, 'base', 'levels', true) || []).map(l => l.code), b = (eff(ctx, sid, 'base', 'levels') || []).map(l => l.code);
    return eff(ctx, sid, 'base', 'p32') !== eff(ctx, sid, 'base', 'p32', true) || a.join() !== b.join();
  }
  function lvCounts(ctx) { const out = {}; ctx.s.students.filter(x => ['재원', '휴원', '퇴원 예정'].indexOf(x.status) >= 0).forEach(x => { out[x.level] = (out[x.level] || 0) + 1; }); return out; }
  function assign(ctx) {
    const sid = 'HQ-13', ui = ctx.ui, levels = get(ctx, sid, 'levels') || [];
    const g = ui.a_grade || '초3', score = toNum(ui.a_score != null ? ui.a_score : 65), min = gnum(get(ctx, sid, 'p31_min')), max = gnum(get(ctx, sid, 'p31_max'));
    if (g === '예비 초1') return { tone: 'bad', text: '3월 1일 전 예비 초1은 입학 테스트를 막아요. 학년은 3월 1일 학년도 기준으로 계산해요.' };
    const gn = gnum(g);
    if (gn < min && get(ctx, sid, 'p31_block')) return { tone: 'bad', text: '대상 학년(' + get(ctx, sid, 'p31_min') + '부터)보다 어린 학년이라 입학 테스트를 막아요.' };
    if (isNaN(score) || score < 0 || score > 100) return { tone: 'bad', text: '읽기 점수를 0부터 100 사이로 넣어 주세요.' };
    const hit = levels.find(l => { const r = scoreR(l.score); return r && score >= r[0] && score <= r[1]; });
    if (!hit) return { tone: 'warn', text: score + '점이 들어갈 점수 구간이 레벨 표에 없어요. 원장이 직접 배정해요.' };
    const lvName = l => l.code + (l.name ? ' ' + l.name : '');
    const notes = ['읽기 ' + score + '점은 ' + lvName(hit) + ' 구간에 들어가요.'];
    let fin = hit, tone = 'ok';
    if (hit.status !== '사용') {
      const open = levels.filter(l => l.status === '사용' && scoreR(l.score)).sort((a, b) => Math.abs(scoreR(a.score)[0] - score) - Math.abs(scoreR(b.score)[0] - score))[0];
      if (open) { fin = open; notes.push('준비 중인 레벨이라 가장 가까운 열린 레벨 ' + lvName(open) + '에 배정하고 원장 메모를 남겨요.'); tone = 'warn'; } else { notes.push('열린 레벨이 없어서 대기 목록(CT-22)에 올려요.'); tone = 'warn'; }
    }
    const r = gr(fin.grade);
    if (r && (gn < r[0] || gn > r[1])) { notes.push(g + ' 학생은 ' + fin.code + ' 대상 학년(' + fin.grade + ') 밖이라 원장이 확인해요.'); tone = 'warn'; }
    if (gn > max) { notes.push('대상 학년 위라 원장이 확인해요.'); tone = 'warn'; }
    return { tone, text: notes.join(' '), level: lvName(fin) };
  }
  function r13(ctx) {
    prep(ctx, 'HQ-13');
    const sid = 'HQ-13', R = ro(ctx), ui = ctx.ui;
    const c1 = card({
      pin: 1, title: 'POL-32 레벨 체계', chip: stChip('POL-32'),
      body: '<div class="hqc-val">' + ['무학년 12단계 (10/14)', '학년별 4레벨 (10/21)', '저학년 2레벨 (10/20)', '직접 구성'].map(l => { const v = l.replace(/ \(.*\)$/, ''); return optBtn(sid, 'tpl', v, get(ctx, sid, 'p32') === v, l, R, 'rd'); }).join('') +
        '<span class="small muted">템플릿을 고르면 아래 표가 채워져요</span></div>',
    });
    const levels = get(ctx, sid, 'levels') || [];
    const cell = (i, f, w, ph) => { const key = 'lv_' + i + '_' + f, e = errOf(ctx, key), v = ui['f:' + key] != null ? ui['f:' + key] : levels[i][f];
      return '<input class="inp hqc-in' + (e ? ' bad' : '') + '" data-field="f:' + key + '" value="' + esc(v) + '"' + (R ? ' disabled' : '') + ' placeholder="' + esc(ph) + '" style="width:' + w + 'px" aria-label="' + esc(levels[i].code + ' ' + ph) + '"' + (e ? ' title="' + esc(e) + '"' : '') + '>'; };
    const lvTbl = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>코드</th><th>레벨명</th><th>대상 학년</th><th>읽기 테스트 구간</th><th>분기 도서 수</th><th>상태</th><th></th></tr></thead><tbody>' +
      levels.map((l, i) => '<tr><td class="mono">' + esc(l.code) + '</td><td>' + cell(i, 'name', 88, '이름 미정') + '</td><td>' + cell(i, 'grade', 88, '초2~3') + '</td><td>' + cell(i, 'score', 88, '0~39') + '</td><td>' + cell(i, 'books', 64, '미정') + '</td><td>' +
        (R ? h.chip(l.status, l.status === '사용' ? 'ok' : 'line') : '<button type="button" class="hqc-st ' + (l.status === '사용' ? 'on' : 'off') + '" data-act="HQ13.lvStatus" data-arg="' + i + '" title="사용과 준비를 바꿔요">' + esc(l.status) + '</button>') + '</td><td>' +
        (R || levels.length < 2 ? '' : '<button type="button" class="hqc-x" data-act="HQ13.delLevel" data-arg="' + i + '">삭제</button>') + '</td></tr>').join('') + '</tbody></table></div>';
    const gc = gapCheck(levels, get(ctx, sid, 'p31_min'), get(ctx, sid, 'p31_max'));
    const gapMsg = gc.bad.length ? h.alert(gc.bad.join(', ') + ' 대상 학년이 비었거나 형식이 달라요. 초2~3처럼 넣어 주세요.', 'bad', { title: '검사' })
      : gc.gaps.length ? h.alert(gc.gaps.join(', ') + ' 학생이 들어갈 레벨이 없어요. 대상 학년은 ' + get(ctx, sid, 'p31_min') + '부터인데 레벨 표가 그 학년을 덮지 않아요. 고치기 전에는 저장할 수 없어요.', 'bad', { title: '학년 빈틈' })
        : h.alert(get(ctx, sid, 'p31_min') + '부터 ' + get(ctx, sid, 'p31_max') + '까지 모든 학년에 들어갈 레벨이 있어요.', 'ok', { title: '검사 통과' });
    const c2 = card({
      pin: 2, title: '레벨 표 (예시)',
      body: lvTbl + '<div class="row" style="margin-top:8px">' + h.btn('+ 레벨 추가', { sm: true, act: 'HQ13.addLevel', disabled: R }) + '<span class="small muted">학습 시스템 콘텐츠와 연결</span>' + h.btn('HQ-20', { sm: true, ghost: true, go: 'HQ-20' }) + '</div>' +
        '<div class="hqc-rvbox" data-pin="6">' + reviewHead('학년 빈틈 검사', 'IMP-19') + gapMsg + '</div>',
    });
    const c3 = card({
      pin: 3, title: 'POL-31 대상 학년', chip: stChip('POL-31'),
      body: kvt([
        ['최저', sel(ctx, sid, 'p31_min', GRADES, { ro: R })],
        ['최고', sel(ctx, sid, 'p31_max', GRADES, { ro: R }) + (errOf(ctx, 'p31_max') ? '<div class="hqc-err">' + esc(errOf(ctx, 'p31_max')) + '</div>' : '')],
        ['검사 연령 검증', chk1(ctx, sid, 'p31_block', '최저 학년 미만이면 입학 테스트 차단', R)],
      ]) + '<div class="hqc-hint">유아 대상 시험 제한 때문에 초1 아래로는 내리지 않아요.</div>',
    });
    const c4 = card({
      pin: 4, title: 'POL-33 승급 방식', chip: stChip('POL-33'),
      body: kvt([
        ['방식', rad(ctx, sid, 'p33', ['독서퀴즈 자동', '재테스트 주기', '원장 승인'], R)],
        ['자동 기준', '평균 ' + inp(ctx, sid, 'p33_avg', { ro: R, w: 44 }) + '점 이상 ' + inp(ctx, sid, 'p33_months', { ro: R, w: 40 }) + '개월'],
        ['재테스트', inp(ctx, sid, 'p33_retest', { ro: R, w: 40 }) + '개월마다 <span class="small muted">POL-29 연동</span>'],
      ]),
    });
    const counts = lvCounts(ctx), oldLv = eff(ctx, sid, 'base', 'levels', true) || [], map = get(ctx, sid, 'map') || {}, newCodes = levels.map(l => l.code);
    const showMap = ui.mapOpen || needMap(ctx);
    const mapTbl = showMap ? '<div class="hqc-subh">기존 원생 레벨 매핑</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>지금 레벨</th><th>원생 수</th><th>새 레벨</th></tr></thead><tbody>' +
      oldLv.map(l => '<tr><td>' + esc(l.code + ' ' + l.name) + '</td><td class="num">' + (counts[l.code] || 0) + '명</td><td>' +
        '<select class="inp hqc-in' + (errOf(ctx, 'map') && !newCodes.includes(map[l.code]) ? ' bad' : '') + '" data-field="f:map_' + esc(l.code) + '"' + (R ? ' disabled' : '') + ' aria-label="' + esc(l.code) + ' 새 레벨">' +
        ['<option value="">고르기</option>'].concat(newCodes.map(c => '<option value="' + esc(c) + '"' + (map[l.code] === c ? ' selected' : '') + '>' + esc(c) + '</option>')).join('') + '</select></td></tr>').join('') + '</tbody></table></div>' +
      '<div class="hqc-hint">원생 수는 예시 데이터 기준이에요. 저장하면 HQ-20 콘텐츠 전환과 보호자 안내가 같은 날로 예약돼요.</div>' : '';
    const c5 = card({
      pin: 5, title: '체계 변경',
      body: '<div class="hqc-val">적용 시작일 ' + inp(ctx, sid, 'apply', { ro: R, w: 112, type: 'text' }) + ' · 기존 원생 레벨 매핑 표 ' + h.btn(showMap ? '매핑 닫기' : '매핑 편집', { sm: true, act: 'HQ13.mapOpen', disabled: R && !showMap }) + '</div>' +
        (errOf(ctx, 'apply') ? '<div class="hqc-err">' + esc(errOf(ctx, 'apply')) + '</div>' : '') + (errOf(ctx, 'map') ? '<div class="hqc-err">' + esc(errOf(ctx, 'map')) + '</div>' : '') + mapTbl,
    });
    const a = assign(ctx);
    const c7 = card({
      pin: 7, title: '배정 규칙 미리보기', chip: B.impChip('IMP-19'),
      body: kvt([
        ['학년', h.opts(['예비 초1'].concat(GRADES), ui.a_grade || '초3', { act: 'HQ13.agrade' })],
        ['읽기 점수', liveIn(ctx, 'a_score', 65, 52) + ' 점'],
      ]) + '<div class="hqc-res alert ' + a.tone + '">' + (a.level ? '<b>배정 레벨 ' + esc(a.level) + '</b>' : '') + '<div>' + esc(a.text) + '</div></div><div class="hqc-hint">점수를 먼저 보고, 대상 학년 밖이면 원장이 확인해요. CT-03 결과지가 같은 규칙을 써요.</div>',
    });
    return frame(ctx, sid, '<div class="stack">' + c1 + c2 + '<div class="grid g2">' + c3 + c4 + '</div><div class="grid g2">' + c5 + c7 + '</div></div>');
  }
  CFG['HQ-13'] = {
    noScope: true, // 원문 32쪽에는 범위 탭이 없어요. 센터는 직영, 가맹 모두 못 바꿔요.
    num: /^(p33_avg|p33_months|p33_retest)$/,
    label: key => ({ p32: '레벨 체계', levels: '레벨 표', p31_min: '대상 학년 최저', p31_max: '대상 학년 최고', p31_block: '검사 연령 검증', p33: '승급 방식', p33_avg: '자동 승급 평균', p33_months: '자동 승급 기간', p33_retest: '재테스트 주기', apply: '체계 적용 시작일', map: '기존 원생 매핑' })[key] || key,
    fmt: (key, v) => {
      if (key === 'levels') { const a = v || []; return a.length + '단계 (' + (a.length > 6 ? a[0].code + '~' + a[a.length - 1].code : a.map(l => [l.code, l.name, l.grade].filter(Boolean).join(' ')).join(', ')) + ')'; }
      if (key === 'map') return Object.keys(v || {}).map(k => k + '에서 ' + (v[k] || '?')).join(', ') || '없음';
      if (key === 'p33_avg') return v + '점';
      if (key === 'p33_months' || key === 'p33_retest') return v + '개월';
      return fmtDefault(v);
    },
    code: key => ({ p31_min: 'POL-31', p31_max: 'POL-31', p31_block: 'POL-31', p33: 'POL-33', p33_avg: 'POL-33', p33_months: 'POL-33', p33_retest: 'POL-33' })[key] || 'POL-32',
    absorb(ctx) {
      const ui = ctx.ui, sid = 'HQ-13';
      const lk = Object.keys(ui).filter(x => /^f:lv_\d+_\w+$/.test(x));
      if (lk.length) {
        const lv = B.clone(get(ctx, sid, 'levels') || []);
        lk.forEach(x => { const m = /^f:lv_(\d+)_(\w+)$/.exec(x); if (lv[+m[1]]) lv[+m[1]][m[2]] = String(ui[x]).trim(); delete ui[x]; });
        set(ctx, sid, 'levels', lv);
      }
      const mk = Object.keys(ui).filter(x => /^f:map_/.test(x));
      if (mk.length) {
        const map = Object.assign({}, get(ctx, sid, 'map') || {});
        mk.forEach(x => { map[x.slice(6)] = ui[x]; delete ui[x]; });
        set(ctx, sid, 'map', map);
      }
    },
    validate(ctx, out, g, k) {
      const levels = g('levels') || [];
      levels.forEach((l, i) => {
        if (!gr(l.grade)) err(out, 'lv_' + i + '_grade', l.code + ' 대상 학년을 초2~3처럼 넣어 주세요.');
        if (l.score && !scoreR(l.score)) err(out, 'lv_' + i + '_score', l.code + ' 점수 구간을 0~39처럼 넣어 주세요.');
      });
      const mn = gnum(g('p31_min')), mx = gnum(g('p31_max'));
      if (mn > mx) err(out, 'p31_max', '최고 학년이 최저 학년보다 낮아요.');
      const gc = gapCheck(levels, g('p31_min'), g('p31_max'));
      if (!gc.bad.length && gc.gaps.length) { const m = gc.gaps.join(', ') + ' 학생이 들어갈 레벨이 없어요. 레벨 표의 대상 학년이나 POL-31 최저 학년을 고쳐 주세요.'; if (out.errs.indexOf(m) < 0) out.errs.push(m); }
      const rs = levels.map(l => scoreR(l.score)).filter(Boolean).sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < rs.length; i++) if (rs[i][0] <= rs[i - 1][1]) { const w = '읽기 점수 구간이 겹치는 레벨이 있어요. 배정이 엇갈릴 수 있어요.'; if (out.warns.indexOf(w) < 0) out.warns.push(w); }
      if (k === 'base' && needMap(ctx)) {
        const map = g('map') || {}, codes = levels.map(l => l.code), left = (eff(ctx, 'HQ-13', 'base', 'levels', true) || []).map(l => l.code).filter(c => codes.indexOf(map[c]) < 0);
        if (left.length) err(out, 'map', '기존 원생 매핑을 마쳐 주세요 (' + left.join(', ') + ' 남음).');
        if (!/^\d{4}-\d\d-\d\d$/.test(g('apply') || '') || g('apply') <= ctx.today) err(out, 'apply', '체계 적용 시작일을 오늘 뒤 날짜로 넣어 주세요.');
      }
      if (!(typeof g('p33_avg') === 'number' && g('p33_avg') >= 0 && g('p33_avg') <= 100)) err(out, 'p33_avg', '자동 승급 평균 점수를 0부터 100 사이로 넣어 주세요.');
      if (!isInt(g('p33_months'), 1, 24)) err(out, 'p33_months', '자동 승급 기간을 개월 수로 넣어 주세요.');
      if (!isInt(g('p33_retest'), 1, 24)) err(out, 'p33_retest', '재테스트 주기를 개월 수로 넣어 주세요.');
    },
    text: {
      'POL-32': g => g('p32') + ' (' + (g('levels') || []).length + '단계)',
      'POL-31': g => g('p31_min') + '~' + g('p31_max'),
      'POL-33': g => (g('p33') || '미정') + ', 자동 평균 ' + g('p33_avg') + '점 ' + g('p33_months') + '개월',
    },
    after(ctx, list) {
      if (list.some(x => x.key === 'p32' || x.key === 'levels')) ctx.ui.mapOpen = false;
    },
  };
  common('HQ-13');
  act('HQ-13', 'tpl', (ctx, v) => {
    if (['무학년 12단계', '학년별 4레벨', '저학년 2레벨', '직접 구성'].indexOf(v) < 0) return;
    set(ctx, 'HQ-13', 'p32', v);
    if (TPL[v]) set(ctx, 'HQ-13', 'levels', B.clone(TPL[v]));
    if (needMap(ctx)) ctx.ui.mapOpen = true;
  });
  act('HQ-13', 'addLevel', ctx => { const lv = B.clone(get(ctx, 'HQ-13', 'levels') || []); lv.push({ code: 'L' + (lv.length + 1), name: '', grade: '', score: '', books: '', status: '준비' }); set(ctx, 'HQ-13', 'levels', lv); ctx.ui.mapOpen = true; });
  act('HQ-13', 'delLevel', (ctx, i) => { const lv = B.clone(get(ctx, 'HQ-13', 'levels') || []); if (lv.length < 2 || !lv[+i]) return; lv.splice(+i, 1); lv.forEach((l, j) => { l.code = 'L' + (j + 1); }); set(ctx, 'HQ-13', 'levels', lv); ctx.ui.mapOpen = true; });
  act('HQ-13', 'lvStatus', (ctx, i) => { const lv = B.clone(get(ctx, 'HQ-13', 'levels') || []); if (!lv[+i]) return; lv[+i].status = lv[+i].status === '사용' ? '준비' : '사용'; set(ctx, 'HQ-13', 'levels', lv); });
  act('HQ-13', 'mapOpen', ctx => { ctx.ui.mapOpen = !ctx.ui.mapOpen; });
  act('HQ-13', 'agrade', (ctx, v) => { if (v === '예비 초1' || GRADES.indexOf(v) >= 0) ctx.ui.a_grade = v; });
  act('HQ-13', 'assign', (ctx, arg) => { if (arg && typeof arg === 'object') { if (arg.grade) ctx.ui.a_grade = arg.grade; if (arg.score != null) ctx.ui.a_score = String(arg.score); } });

  B.screen({
    id: 'HQ-13', side: 'hq', phase: 'P1a', devices: ['pc'], pages: [32],
    title: '레벨 체계·승급', menuLabel: '레벨 체계', crumb: '정책·요금 설정 > 레벨 체계',
    headActions: heads('HQ-13'), render: r13, mount: mountFn,
    prd: {
      summary: '학생 실력을 몇 단계로 나눌지, 몇 학년을 받을지, 언제 다음 레벨로 올릴지 정하는 화면이에요. 회의 때마다 안이 달라서 여러 안을 템플릿으로 골라 볼 수 있어요. 센터별로 다르게 둘 수 없는 값이라 범위 탭이 없어요.',
      who: WHO + ' 센터는 직영과 가맹 모두 이 값을 못 바꿔요. 레벨 체계와 승급은 연구소가, 대상 학년은 대표와 연구소가 정해요.',
      items: [
        { n: 1, t: '체계 템플릿', d: '무학년 12단계(10/14), 학년별 4레벨(10/21), 저학년 2레벨(10/20), 직접 구성 중에서 골라요. 고르면 아래 레벨 표가 그 안으로 채워져요. 지금은 학년별 4레벨이 골라져 있어요.', pol: ['POL-32'], ref: 'p.32 ①' },
        { n: 2, t: '레벨 표', d: '레벨 이름, 대상 학년, 읽기 테스트 점수 구간, 분기에 읽을 책 수를 고쳐요. L1 새싹 초2~3 0~39점처럼 예시 값이 들어 있고(모두 예시), L3과 L4는 준비 상태예요. 상태 칸을 누르면 사용과 준비가 바뀌어요. 레벨은 학습 콘텐츠와 이어져 배포돼요(HQ-20).', pol: ['POL-32'], ref: 'p.32 ②' },
        { n: 3, t: '대상 학년', d: '회의마다 초4부터, 저학년, 5·6학년으로 말이 달랐어요. 유아 대상 시험을 제한하는 법 때문에 최저를 초1로 두고, 그보다 어리면 입학 테스트를 막아요.', pol: ['POL-31'], ref: 'p.32 ③' },
        { n: 4, t: '승급 방식', d: '독서퀴즈 성적으로 자동 승급(평균 80점 이상 3개월, 예시), 정기 재테스트(6개월마다, 안), 원장 승인 중에서 골라요. 아직 아무것도 고르지 않았어요. 재테스트는 재검사 주기(POL-29)와 이어져요.', pol: ['POL-33', 'POL-29'], ref: 'p.32 ④' },
        { n: 5, t: '체계 변경', d: '체계를 바꿀 때는 적용 시작일과 기존 원생의 새 레벨 매핑을 함께 저장해요. 템플릿을 바꾸면 매핑 표가 열리고, 매핑이 비어 있으면 변경 예약이 되지 않아요. 시작일 2028-01-01은 예시예요.', pol: ['POL-32'], ref: 'p.32 ⑤' },
        { n: 6, t: '학년 빈틈 검사', kind: 'review', imp: 'IMP-19', pol: ['POL-31', 'POL-32'], d: '레벨 표의 대상 학년을 모두 합쳐 POL-31 범위를 빠짐없이 덮는지 늘 검사해요. 지금 예시는 최저가 초1인데 L1이 초2부터라서 초1이 들어갈 레벨이 없어요. 빈 학년이 있으면 저장을 막아요.' },
        { n: 7, t: '배정 규칙 미리보기', kind: 'review', imp: 'IMP-19', d: '학년과 읽기 점수를 넣으면 어느 레벨로 갈지 보여 줘요. 점수를 먼저 보고, 대상 학년 밖이면 원장이 확인해요. 준비 중인 레벨이 나오면 가장 가까운 열린 레벨로 보내요. 3월 전 예비 초1은 검사를 막아요.' },
      ],
      open: ['레벨 체계를 12단계, 4레벨, 2레벨 중 무엇으로 할지 (부록 A 6번, P1a 전)', '몇 학년부터 몇 학년까지 받을지', '승급 방식과 기준 점수, 기간', '레벨 이름, 점수 구간, 분기 도서 수', '승급용 정기 재테스트 주기를 POL-29 재검사 허용 간격과 따로 둘지', '학년별 4레벨이 학년마다 4단계인지 전체 4단계인지'],
      rules: ['유아 대상 입학 시험과 레벨 시험은 제한돼요 (2026년 개정 학원법). 최저 학년을 초1 아래로 내리지 않아요.'],
    },
  });

  /* =====================================================================
     HQ-14 입학 테스트·상담 (p.33)
     ===================================================================== */
  const man = n => typeof n === 'number' && n % 10000 === 0 ? (n / 10000) + '만' : money(n) + '원';
  function r14(ctx) {
    prep(ctx, 'HQ-14');
    const sid = 'HQ-14', R = ro(ctx), ui = ctx.ui, hqPer = get(ctx, sid, 'p27_hq') === '검사 1건당';
    const c1 = card({
      pin: 1, title: 'POL-26 검사 버전', chip: stChip('POL-26'),
      body: kvt([['두뇌 유형 검사', rad(ctx, sid, 'p26', ['180문항 원본', '간단판 (약 15분)'], R)], ['읽기 테스트', '10~20분 · 총 35분 안팎, 상담 포함 1시간']]) + '<div class="hqc-hint">검사 버전은 HQ-20에서 배포해요.</div>',
    });
    const c2 = card({
      pin: 2, title: 'POL-27 테스트비·상담비', chip: stChip('POL-27'),
      body: kvt([
        ['수납 주체', rad(ctx, sid, 'p27_payer', ['센터', '본사'], R) + (get(ctx, sid, 'p27_payer') ? '' : '<span class="small muted">미정</span>')],
        ['테스트비 정가', inp(ctx, sid, 'p27_fee', { ro: R, w: 80 }) + ' 원 <span class="small muted">(안)</span>'],
        ['프로모션가', inp(ctx, sid, 'p27_promo', { ro: R, w: 80 }) + ' 원 <span class="small muted">(안)</span> 기간 ~ ' + inp(ctx, sid, 'p27_end', { ro: R, w: 100 })],
        ['상담비', inp(ctx, sid, 'p27_consult', { ro: R, w: 80, ph: '미정' }) + ' 원, ' + chk1(ctx, sid, 'p27_waive', '등록 시 면제', R)],
        ['본사 과금', '<div data-pin="7" class="hqc-val hqc-tp">' + rad(ctx, sid, 'p27_hq', ['없음', '검사 1건당'], R) + inp(ctx, sid, 'p27_hq_amt', { ro: R || !hqPer, w: 64, ph: '금액' }) + ' 원' +
          (hqPer ? '<div style="flex-basis:100%" class="hqc-val">근거 ' + inp(ctx, sid, 'p27_hq_reason', { ro: R, w: 210, ph: '계약 조항, 동의서 번호' }) + '</div>' : '<span class="small muted">검사 1건당을 고르면 근거가 있어야 저장돼요</span>') + '</div>'],
      ]),
    });
    const c3 = card({
      pin: 3, title: 'POL-28·29 등록 차감·재검사', chip: stChip('POL-28'),
      body: kvt([
        ['등록 시 차감', inp(ctx, sid, 'p28_amt', { ro: R, w: 80 }) + ' 원 <span class="small muted">(안)</span>, 유효 ' + inp(ctx, sid, 'p28_days', { ro: R, w: 40 }) + '일'],
        ['재검사 허용', inp(ctx, sid, 'p29_months', { ro: R, w: 40 }) + '개월 뒤부터 <span class="small muted">(예시)</span>'],
      ]),
    });
    const ways = get(ctx, sid, 'p30_ways') || [], days = get(ctx, sid, 'p30_days');
    const c4 = card({
      pin: 4, title: 'POL-30 결과지', chip: stChip('POL-30'),
      body: kvt([
        ['표시 항목', '두뇌 유형 (지수 없이), 읽기 레벨 ' + h.chip('고정', 'line')],
        ['전달 방식', chks(ctx, sid, 'p30_ways', ['현장 출력', '우편', '이메일', '알림톡 링크'], R)],
        ['주소 자동 삭제', inp(ctx, sid, 'p30_days', { ro: R, w: 44 }) + '일 <span class="small muted">(안) 센터는 단축만</span>'],
      ]) + '<div class="hqc-preview"><div class="small">결과지 미리보기</div><b>두뇌 유형 ○○형 · 읽기 레벨 L2</b><div>(상담은 사람이 진행)</div><div class="small" style="margin-top:6px">' +
        esc(ways.length ? ways.join(', ') + '로 전달해요.' : '전달 방식을 골라 주세요.') + (ways.indexOf('우편') >= 0 ? ' 우편 주소는 ' + esc(fmtIn(days)) + '일 뒤 자동으로 지워요.' : '') + '</div></div>',
    });
    const c5 = '<div data-pin="5">' + h.alert('테스트비와 상담비를 교습비 외에 받을 수 있는지, 등록 대상인지 교육청에 확인한 뒤 확정해요. 교습비 외 비용 징수는 점검 대상이에요.', 'bad', { title: '교육청에 확인해야 해요' }) + '</div>';
    const edu = st(ctx, sid).edu, es = ui.e_status || edu.status;
    // 저장 값('등록 필요', '등록 불필요')은 CT-02, CT-03이 함께 읽어서 그대로 두고 보이는 이름만 바꿔요
    const lockTxt = edu.status === '확인 전' ? '확인 전이라 CT-02 상담비와 CT-03 테스트비 수납을 잠가요. 그동안 입학 테스트는 무료예요.' : edu.status === '등록 필요' ? '교육청 등록 대상이에요. 센터별 등록액을 받기 전까지 수납은 계속 잠겨요.' : '등록이 필요 없다는 답을 받았어요. 센터 수납 잠금을 풀 수 있고, 공문은 근거로 남아요.';
    const c6 = card({
      pin: 6, title: '교육청 확인 기록', chip: B.impChip('IMP-08'),
      body: kvt([
        ['확인 상태', h.opts(['확인 전', '등록 필요', '등록 불필요'].map(x => ({ v: x, l: eduLabel(x), dis: R })), es, { act: 'HQ14.edu' })],
        ['확인일', '<input class="inp hqc-in" type="date" data-field="e_date" value="' + esc(ui.e_date != null ? ui.e_date : edu.date) + '" style="width:140px"' + (R ? ' disabled' : '') + ' aria-label="확인일">'],
        ['근거', '<input class="inp hqc-in" data-field="e_ref" value="' + esc(ui.e_ref != null ? ui.e_ref : edu.ref) + '" placeholder="공문 번호, 회신일" style="width:220px"' + (R ? ' disabled' : '') + ' aria-label="근거">' + ' ' + h.btn('기록', { sm: true, act: 'HQ14.eduSave', disabled: R })],
      ]) + (ui.e_err ? '<div class="hqc-err" style="margin-top:4px">' + esc(ui.e_err) + '</div>' : '') +
        '<div class="hqc-res alert ' + (edu.status === '등록 불필요' ? 'ok' : 'warn') + '">' + h.chip(eduLabel(edu.status), edu.status === '등록 불필요' ? 'ok' : 'warn') + ' ' + esc(lockTxt) + (edu.date ? ' <span class="small muted">' + esc(edu.date + ' ' + edu.ref) + '</span>' : '') + '</div>',
    });
    const c8 = card({
      pin: 8, title: '등록하지 않은 아이 기록', chip: B.impChip('IMP-07'),
      body: kvt([
        ['대상', '상담과 테스트만 하고 등록하지 않은 아이'],
        ['항목', '이름, 학년, 보호자 연락처, 검사 결과, 상담 기록'],
        ['보관', inp(ctx, sid, 'unreg_days', { ro: R, w: 44 }) + '일 뒤 자동 파기 <span class="small muted">(예시)</span>'],
        ['파기 기록', 'HQ-22 파기 대장에 남겨요'],
      ]) + '<div class="hqc-hint">CT-02 예약 때 보호자에게 알리는 보관 기간과 같은 값을 써요.</div>',
    });
    return frame(ctx, sid, '<div class="grid g2"><div class="stack">' + c1 + c2 + c3 + '</div><div class="stack">' + c4 + c5 + c6 + c8 + '</div></div>');
  }
  CFG['HQ-14'] = {
    num: /^(p27_fee|p27_promo|p27_consult|p27_hq_amt|p28_amt|p28_days|p29_months|p30_days|unreg_days)$/,
    order: { p30_ways: ['현장 출력', '우편', '이메일', '알림톡 링크'] },
    label: key => ({ p26: '두뇌 유형 검사 버전', p27_payer: '수납 주체', p27_fee: '테스트비 정가', p27_promo: '프로모션가', p27_end: '프로모션 기간', p27_consult: '상담비', p27_waive: '등록 시 상담비 면제', p27_hq: '본사 과금', p27_hq_amt: '검사 1건당 금액', p27_hq_reason: '본사 과금 근거', p28_amt: '등록 시 차감', p28_days: '차감 유효 기간', p29_months: '재검사 허용', p30_ways: '결과지 전달 방식', p30_days: '주소 자동 삭제', unreg_days: '미등록 아이 기록 보관' })[key] || key,
    fmt: (key, v) => {
      if (v === '' || v == null) return '미정';
      if (typeof v === 'number') return /days$/.test(key) ? v + '일' : key === 'p29_months' ? v + '개월' : money(v) + '원';
      return fmtDefault(v);
    },
    code: key => /^p26/.test(key) ? 'POL-26' : /^p27/.test(key) ? 'POL-27' : /^p28/.test(key) ? 'POL-28' : /^p29/.test(key) ? 'POL-29' : 'POL-30',
    validate(ctx, out, g, k) {
      const fee = g('p27_fee'), promo = g('p27_promo');
      if (!(typeof fee === 'number' && fee > 0)) err(out, 'p27_fee', '테스트비 정가를 숫자로 넣어 주세요.');
      if (!(typeof promo === 'number' && promo >= 0)) err(out, 'p27_promo', '프로모션가를 숫자로 넣어 주세요.');
      else if (typeof fee === 'number' && promo > fee) err(out, 'p27_promo', '프로모션가가 정가보다 높아요.');
      if (!/^\d{4}-\d\d-\d\d$/.test(g('p27_end') || '')) err(out, 'p27_end', '프로모션 기간 끝날을 2027-12-31처럼 넣어 주세요.');
      if (g('p27_consult') !== '' && !(typeof g('p27_consult') === 'number' && g('p27_consult') >= 0)) err(out, 'p27_consult', '상담비는 숫자로 넣거나 비워 두세요.');
      if (g('p27_hq') === '검사 1건당') {
        if (!(typeof g('p27_hq_amt') === 'number' && g('p27_hq_amt') > 0)) err(out, 'p27_hq_amt', '검사 1건당 금액을 넣어 주세요.');
        if (!String(g('p27_hq_reason') || '').trim()) err(out, 'p27_hq_reason', '가맹 센터에 새로 받는 돈이라 계약 조항이나 동의서 근거가 있어야 저장돼요.');
        const w = 'P1a에는 가맹 센터가 없어서 이 과금은 P1b부터 실제로 걸려요.'; if (out.warns.indexOf(w) < 0) out.warns.push(w);
      }
      const paid = typeof promo === 'number' && promo > 0 ? promo : fee, amt = g('p28_amt');
      if (!(typeof amt === 'number' && amt >= 0)) err(out, 'p28_amt', '등록 시 차감액을 숫자로 넣어 주세요.');
      else if (typeof paid === 'number' && amt > paid) err(out, 'p28_amt', '등록 시 차감액(' + money(amt) + '원)이 테스트비(' + money(paid) + '원)보다 커요.');
      if (!isInt(g('p28_days'), 1, 365)) err(out, 'p28_days', '차감 유효 기간을 일수로 넣어 주세요.');
      if (!isInt(g('p29_months'), 1, 36)) err(out, 'p29_months', '재검사 허용 시점을 개월 수로 넣어 주세요.');
      if (!(g('p30_ways') || []).length) err(out, 'p30_ways', '결과지 전달 방식을 하나 이상 골라 주세요.');
      if (!isInt(g('p30_days'), 1, 365)) err(out, 'p30_days', '주소 자동 삭제 기간을 일수로 넣어 주세요.');
      else if (k !== 'base') { const b = eff(ctx, 'HQ-14', 'base', 'p30_days'); if (g('p30_days') > b) err(out, 'p30_days', '센터 값은 본사 기본값 ' + b + '일보다 길게 정할 수 없어요. 줄이기만 할 수 있어요.'); }
      if (!isInt(g('unreg_days'), 1, 365)) err(out, 'unreg_days', '미등록 아이 기록 보관 기간을 일수로 넣어 주세요.');
    },
    text: {
      'POL-26': g => g('p26') || '미정',
      'POL-27': g => '테스트비 ' + man(g('p27_fee')) + ', 프로모션 ' + man(g('p27_promo')) + (g('p27_payer') ? ', ' + g('p27_payer') + ' 수납' : ''),
      'POL-28': g => money(g('p28_amt')) + '원, ' + g('p28_days') + '일 유효',
      'POL-29': g => g('p29_months') + '개월',
      'POL-30': g => (g('p30_ways') || []).join(', ') + ', 주소 ' + g('p30_days') + '일',
    },
  };
  common('HQ-14');
  act('HQ-14', 'edu', (ctx, v) => { if (['확인 전', '등록 필요', '등록 불필요'].indexOf(v) >= 0) ctx.ui.e_status = v; });
  function eduLabel(v) { return v === '등록 필요' ? '등록 대상' : v === '등록 불필요' ? '등록 대상 아님' : v; }
  act('HQ-14', 'eduSave', (ctx, arg) => {
    const ui = ctx.ui, edu = st(ctx, 'HQ-14').edu;
    if (arg && typeof arg === 'object') { if (arg.status) ui.e_status = arg.status; if (arg.date != null) ui.e_date = arg.date; if (arg.ref != null) ui.e_ref = arg.ref; }
    const status = ui.e_status || edu.status, date = (ui.e_date != null ? ui.e_date : edu.date || '').trim(), ref = (ui.e_ref != null ? ui.e_ref : edu.ref || '').trim();
    if (status === edu.status && date === edu.date && ref === edu.ref) { ui.e_err = null; B.toast('바뀐 내용이 없어요. 확인 상태를 고르고 확인일과 공문 번호를 넣어 주세요.'); return; }
    ui.e_err = status === '확인 전' ? '확인 전 상태는 기록할 게 없어요. 교육청 답을 받은 뒤 등록 대상이나 등록 대상 아님을 골라 주세요.'
      : !/^\d{4}-\d\d-\d\d$/.test(date) || !ref ? '확인 결과를 남기려면 확인일과 공문 번호를 함께 넣어 주세요.'
        : date > ctx.today ? '확인일은 오늘(' + ctx.today + ')이나 그 전 날짜여야 해요.' : null;
    if (ui.e_err) return;
    const prev = edu.status;
    Object.assign(edu, { status, date, ref });
    ui.e_status = null; ui.e_date = null; ui.e_ref = null;
    const p = ctx.s.pol['POL-27'] = ctx.s.pol['POL-27'] || {};
    p.history = p.history || []; p.history.push({ date: ctx.today, from: '교육청 ' + eduLabel(prev), to: '교육청 ' + eduLabel(status), by: ctx.persona.name, reason: ref, n: opCenters().length });
    ctx.s.audit.unshift({ at: '03-08 11:30', who: ctx.persona.name + ' (본사 ' + ctx.role + ')', what: '교육청 확인 기록', target: 'POL-27 테스트비·상담비', reason: eduLabel(status) + ', ' + ref });
    B.toast(status === '등록 불필요' ? '기록했어요. 이 기록이 있어야 센터가 테스트비와 상담비를 받을 수 있어요.' : '기록했어요. 센터별 등록액을 받기 전까지 수납은 잠겨 있어요.');
  });

  B.screen({
    id: 'HQ-14', side: 'hq', phase: 'P1a', devices: ['pc'], pages: [33],
    title: '입학 테스트·상담', menuLabel: '테스트·상담', crumb: '정책·요금 설정 > 테스트·상담',
    headActions: heads('HQ-14'), render: r14, mount: mountFn,
    prd: {
      summary: '입학 테스트 버전과 테스트비, 상담비, 등록 차감, 재검사 간격, 결과지 전달 방법을 정하는 화면이에요. 테스트비를 받아도 되는지는 아직 교육청에 확인해야 해요.',
      who: WHO + ' 검사 버전과 재검사 간격은 연구소가, 테스트비와 수납 주체는 대표와 경영지원이, 등록 차감과 결과지는 경영지원이 정해요. 센터는 CT-02, CT-03에서 이 값을 써요.',
      items: [
        { n: 1, t: '검사 버전', d: '두뇌 유형 검사를 180문항 원본으로 할지 약 15분짜리 간단판으로 할지 정해요(10/14 미정). 읽기 테스트는 10~20분이고, 합치면 35분 안팎, 상담까지 1시간이에요. 검사 버전은 HQ-20에서 배포해요.', pol: ['POL-26'], ref: 'p.33 ①' },
        { n: 2, t: '테스트비와 상담비', d: '정가 5만 원, 프로모션 3만 원(안)이고 프로모션은 2027-12-31(예시)까지예요. 상담비는 등록하면 면제, 등록하지 않으면 받는데 금액은 미정이에요. 받는 쪽을 센터로 할지 본사로 할지도 아직 정하지 않았어요. 센터가 받으면 가맹 센터는 권장가를 참고해 정해요. 프로모션가가 정가보다 높으면 저장되지 않아요.', pol: ['POL-27'], ref: 'p.33 ②' },
        { n: 3, t: '등록 차감과 재검사', d: '등록하면 테스트비 일부인 2만 원(안)을 교습비에서 빼 줘요. 테스트 뒤 30일(예시) 안에 등록해야 해요. 차감액이 실제 낸 테스트비보다 크면 저장되지 않아요. 재검사 허용 주기는 미정이고, 화면에는 6개월(예시)이 들어 있어요.', pol: ['POL-28', 'POL-29'], ref: 'p.33 ③' },
        { n: 4, t: '결과지', d: '두뇌 유형은 지수 없이 유형만, 읽기는 레벨만 보여 주고 상담은 사람이 해요(10/14 결정). 현장 출력이 기본이고 우편, 이메일, 알림톡 링크를 더 켤 수 있어요. 우편 주소는 30일(안) 뒤 자동으로 지우고, 센터는 이 기간을 줄이기만 해요.', pol: ['POL-30'], ref: 'p.33 ④' },
        { n: 5, t: '교육청 확인 안내', d: '테스트비와 상담비를 교습비 외에 받아도 되는지, 등록 대상인지 교육청에 확인한 뒤 확정해요. 교습비 외 비용 징수는 점검 대상이에요.', pol: ['POL-27'], ref: 'p.33 ⑤' },
        { n: 6, t: '교육청 확인 기록', kind: 'review', imp: 'IMP-08', pol: ['POL-27'], d: '확인 상태를 확인 전, 등록 대상, 등록 대상 아님 중에서 고르고 확인일과 공문 번호를 남겨요. 확인 전이면 CT-02 상담비와 CT-03 테스트비 수납을 잠그고 입학 테스트는 무료로 해요. 등록 필요로 나오면 교습비처럼 센터별 등록액을 받은 뒤에 열어요.' },
        { n: 7, t: '본사 과금 근거', kind: 'review', imp: 'IMP-25', pol: ['POL-27'], d: '검사 1건당 본사가 돈을 받는 쪽을 고르면 금액과 함께 계약 조항이나 동의서 근거를 넣어야 저장돼요. 가맹 센터에 새로 돈을 받는 일이라 HQ-08 사용료처럼 근거가 있어야 해요. 가맹 센터가 없는 P1a에는 실제로 걸리지 않아요.' },
        { n: 8, t: '등록하지 않은 아이 기록', kind: 'review', imp: 'IMP-07', pol: ['POL-30', 'POL-40'], d: '상담과 테스트만 하고 등록하지 않은 아이 기록을 30일(예시) 뒤 자동으로 지우고 HQ-22 파기 대장에 남겨요. CT-02 예약 때 보호자에게 알리는 보관 기간과 같은 값을 써요.' },
      ],
      open: ['검사 버전 (180문항 원본 또는 간단판)', '테스트비와 상담비를 센터가 받을지 본사가 받을지', '상담비 금액', '테스트비와 상담비를 받아도 되는지, 교육청 등록 대상인지', '다시 테스트를 볼 수 있는 간격', '본사가 검사 1건당 돈을 받을지', '본사가 받고 센터가 차감할 때 2만 원을 누가 부담할지'],
      rules: ['교습비 외 경비는 교육청에 등록한 항목만 받을 수 있어요 (학원법).', '만 14세 미만 아이 정보는 법정대리인 동의가 있어야 받아요.'],
    },
  });

  /* =====================================================================
     HQ-15 알림톡·결제·기기·개인정보 (p.34)
     ===================================================================== */
  function r15(ctx) {
    prep(ctx, 'HQ-15');
    const sid = 'HQ-15', R = ro(ctx), ui = ctx.ui;
    const rows = [
      prow('POL-34', '알림톡 과금', 1, '단가 ' + inp(ctx, sid, 'p34_price', { ro: R, w: 40 }) + '원 <span class="small muted">(안)</span>, ' + rad(ctx, sid, 'p34_mode', ['선불 충전', '월 후불', '본사 부담'], R) + ', ' + chk1(ctx, sid, 'p34_refund', '해지 시 잔액 환불', R), '내부', '불가'),
      prow('POL-35', '자동 발송 (정보성)', 2, chks(ctx, sid, 'p35', ['입실', '퇴실', '수납 안내', '미납', '재등록', '결과지'], R), '본사', '가능'),
      prow('POL-36', '결제 연동', 3, '직영 ' + sel(ctx, sid, 'p36_direct', ['결제선생'], { ro: R }) + ' · 가맹 ' + sel(ctx, sid, 'p36_fr', [{ v: '수기 기록', l: '수기 기록 (안)' }, { v: '가맹점 개별 결제선생', l: '가맹점 개별 결제선생 (답변 뒤 열림)', dis: true }], { ro: R }) + h.chip('결제선생 답변 대기', 'warn'), '결제선생', '불가'),
      prow('POL-37', '수납 수단', 0, chks(ctx, sid, 'p37', ['카드', '계좌', '현금', '지역화폐', '결제선생 링크'], R), '본사', '선택'),
      prow('POL-38', '패드 공급', 4, rad(ctx, sid, 'p38', ['직접 구매 (사양 안내)', '본사 납품'], R) + h.btn('지정 사양', { sm: true, act: 'HQ15.spec' }), '본사', '불가'),
      prow('POL-39', '입·퇴실 체크', 0, rad(ctx, sid, 'p39', ['번호', 'QR', '개인 로그인'], R), '본사', '선택'),
      prow('POL-40', '원생 정보 보관', 5, '퇴원 후 ' + inp(ctx, sid, 'p40', { ro: R, w: 44, ph: '미정' }) + '개월 <span class="small muted">미정, 센터는 단축만</span>', '본사', '단축만'),
      prow('POL-41', '거래 증빙 보관', 0, '5년', '불가', '불가'),
      prow('POL-42', '본사 열람 범위', 0, chk1(ctx, sid, 'p42_mask', '기본 마스킹', R) + ' · 해제 ' + sel(ctx, sid, 'p42_who', ['슈퍼관리자', '슈퍼관리자, 운영'], { ro: R }) + ' · 사유 필수', '본사', '불가'),
      prow('POL-43', '동의서·처리방침', 0, 'v1 (2027-01-01) ' + h.btn('문안', { sm: true, act: 'HQ15.text' }) + ' · 재동의 ' + sel(ctx, sid, 'p43_re', ['수집 항목 추가 시', '목적이나 보관 기간이 바뀔 때'], { ro: R }), '본사', '불가'),
    ];
    const note = '<div class="hqc-note" style="margin-top:10px">광고성 메시지(프로모션 안내 등)는 알림톡으로 보낼 수 없어요. 수신 동의자에게만, 21시~8시를 피해 별도 채널로 보내요.</div>';
    const nc = B.center(ui.nc || 'daechi1') || B.center('daechi1'), direct = nc.type === '직영';
    const payOn = direct ? get(ctx, sid, 'p36_direct') === '결제선생' : nc.pay === '결제선생';
    const subs = (payOn ? ['결제선생'] : []).concat(['알림톡 발송사']);
    const kvN = direct
      ? [['처리자', 'MSC Brain (본사)'], ['수탁자', subs.join(', ')], ['재수탁자', '없음']]
      : [['처리자', nc.name + ' (가맹 사업자)'], ['수탁자', 'MSC Brain (본사)'], ['재수탁자', subs.join(', ') + (payOn ? '' : ' (결제선생은 쓰지 않아 빠져요)')]];
    const sentence = direct
      ? nc.name + '는 MSC Brain(본사)이 직접 운영해요. 원생 정보는 MSC Brain이 처리하고, ' + (payOn ? '결제는 결제선생에, ' : '') + '알림 발송은 알림톡 발송사에 맡겨요.'
      : nc.name + '의 원생 정보는 ' + nc.name + '(가맹 사업자)가 처리하고, 학습 시스템 운영은 MSC Brain(본사)에 맡겨요. 본사는 ' + subs.join(', ') + '에 다시 맡겨요.';
    const c6 = card({
      pin: 6, title: '센터 유형별 처리자 고지', chip: B.impChip('IMP-04'),
      body: '<div class="row" style="margin-bottom:8px">' + h.opts(opCenters().map(c => ({ v: c.id, l: c.name.replace('센터', '') })), nc.id, { act: 'HQ15.nc' }) + '</div>' + h.kv(kvN) +
        '<div class="hqc-preview" style="text-align:left"><div class="small">동의서 고지 문구 미리보기 (' + esc(nc.type) + ')</div>' + esc(sentence) + '</div>' +
        '<div class="hqc-hint">원문 예시는 모든 센터에 처리자를 센터로 적었어요. 직영은 본사가 처리자라서 문구를 나눠요.</div>',
    });
    const p40 = get(ctx, sid, 'p40'), keep = p40 === '' || p40 == null ? '퇴원 후 미정' : '퇴원 후 ' + p40 + '개월';
    const unreg = (ctx.s.hq14 && ctx.s.hq14.vals.base.unreg_days) || 30;
    const c7 = card({
      pin: 7, title: '항목별 보관표', chip: B.impChip('IMP-07'),
      body: h.table({
        cols: [{ label: '항목', k: 'a' }, { label: '보관 기간', k: 'b' }, { label: '처리', k: 'c' }],
        rows: [
          { a: '기본 인적사항', b: keep, c: '기간 뒤 파기, HQ-22 파기 대장' },
          { a: '상담 기록 (미등록)', b: unreg + '일 (예시, HQ-14)', c: '자동 파기' },
          { a: '출결과 학습 결과', b: keep, c: '기간 뒤 파기' },
          { a: '수납 증빙', b: '5년 (법정)', c: '분리 보관, 열람 권한 좁힘' },
          { a: '동의 기록', b: '미정 (법무 확인)', c: '-' },
        ],
      }) + '<div style="margin-top:8px">' + h.alert('부록 B는 야간(21시~8시) 광고를 따로 동의한 사람에게만 보낼 수 있다고 적었어요. 표 아래 안내 문구도 이 기준으로 고쳐 써요.', 'review', { title: '검토 반영' }) + '</div>',
    });
    const price = get(ctx, sid, 'p34_price'), warnD = get(ctx, sid, 'p34_warn'), basePrice = eff(ctx, sid, 'base', 'p34_price', true) || 7;
    const bal = ctx.s.alim.balances || {}, avg7 = (ctx.s.ct14 && ctx.s.ct14.avg7) || st(ctx, sid).avg7 || {};
    const balRows = Object.keys(bal).map(id => {
      const c = B.center(id), n = typeof price === 'number' && price > 0 ? Math.floor(bal[id] / price) : null, top = (ctx.s.alim.topups || []).find(t => t.center === id && t.status !== '완료');
      const perDay = avg7[id] ? avg7[id] / basePrice : null, days = n != null && perDay ? n / perDay : null; // 하루 평균 건수는 저장된 단가로 환산해요
      return { c, b: bal[id], n, perDay, days, low: days != null && typeof warnD === 'number' && days < warnD, top };
    });
    const c8 = card({
      pin: 8, title: '알림톡 잔액 보호', chip: B.impChip('IMP-26'),
      body: '<div class="hqc-bal">' + h.table({
        cols: [
          { label: '센터', render: r => esc(r.c ? r.c.name.replace('센터', '') : '-') },
          { label: '잔액', num: true, render: r => money(r.b) + '원' },
          { label: '남은 건수', num: true, render: r => r.n == null ? '-' : money(r.n) + '건' },
          { label: '하루 평균', num: true, render: r => r.perDay == null ? '-' : Math.round(r.perDay) + '건' },
          { label: '남은 날', num: true, render: r => r.days == null ? '-' : '<b>' + (Math.floor(r.days * 10) / 10) + '일분</b>' },
          { label: '상태', render: r => (r.low ? h.chip('부족', 'warn') : h.chip('여유', 'ok')) + (r.top ? ' <span class="small muted">' + money(r.top.amount) + '원 ' + esc(r.top.status) + '</span>' : '') },
        ],
        rows: balRows,
      }) + '</div><div class="hqc-hint">하루 평균은 최근 7일 사용액(예시)을 저장된 단가로 나눈 건수예요. 직영은 본사 내부 비용이라 잔액이 없어요.</div>' +
        '<div class="hqc-line">남은 날이 ' + inp(ctx, sid, 'p34_warn', { ro: R, w: 48 }) + '일분 <span class="small muted">(예시)</span>보다 적으면 센터와 본사에 경고해요</div>' +
        '<div class="hqc-line">' + chk1(ctx, sid, 'p34_guard', '입·퇴실과 미납 안내는 잔액이 모자라도 정한 한도까지 보내고 다음 청구서에 더해요', R) + '</div>' +
        '<div class="hqc-hint">한도 금액은 아직 미정이에요. 잔액은 발송에 성공한 건만 빠져요.</div>',
    });
    return frame(ctx, sid, ptable(rows) + note + '<div class="grid g2" style="margin-top:12px">' + c6 + c8 + '</div><div style="margin-top:12px">' + c7 + '</div>');
  }
  CFG['HQ-15'] = {
    num: /^(p34_price|p40|p34_warn)$/,
    order: { p35: ['입실', '퇴실', '수납 안내', '미납', '재등록', '결과지'], p37: ['카드', '계좌', '현금', '지역화폐', '결제선생 링크'] },
    label: key => ({ p34_price: '알림톡 단가', p34_mode: '알림톡 요금 방식', p34_refund: '해지 시 잔액 환불', p35: '자동 발송 항목', p36_direct: '직영 결제 연동', p36_fr: '가맹 결제 연동', p37: '수납 수단', p38: '패드 공급', p39: '입·퇴실 체크', p40: '퇴원 후 보관', p42_mask: '기본 마스킹', p42_who: '마스킹 해제 권한', p43_re: '재동의 조건', p34_warn: '잔액 경고 기준', p34_guard: '필수 알림 보호' })[key] || key,
    fmt: (key, v) => {
      if (v === '' || v == null) return '미정';
      if (key === 'p34_price') return v + '원';
      if (key === 'p40') return v + '개월';
      if (key === 'p34_warn') return v + '일분';
      return fmtDefault(v);
    },
    code: key => ({ p34_price: 'POL-34', p34_mode: 'POL-34', p34_refund: 'POL-34', p34_warn: 'POL-34', p34_guard: 'POL-34', p35: 'POL-35', p36_direct: 'POL-36', p36_fr: 'POL-36', p37: 'POL-37', p38: 'POL-38', p39: 'POL-39', p40: 'POL-40', p42_mask: 'POL-42', p42_who: 'POL-42', p43_re: 'POL-43' })[key] || 'POL-34',
    validate(ctx, out, g, k) {
      if (!(typeof g('p34_price') === 'number' && g('p34_price') > 0)) err(out, 'p34_price', '알림톡 단가를 숫자로 넣어 주세요.');
      if (!(g('p37') || []).length) err(out, 'p37', '수납 수단을 하나 이상 켜 주세요.');
      const v = g('p40');
      if (v !== '' && v != null && !isInt(v, 1, 120)) err(out, 'p40', '보관 기간은 개월 수로 넣거나 비워 두세요.');
      if (k !== 'base' && typeof v === 'number') { const b = eff(ctx, 'HQ-15', 'base', 'p40'); if (typeof b === 'number' && v > b) err(out, 'p40', '센터 값은 본사 기본값 ' + b + '개월보다 길게 정할 수 없어요. 줄이기만 할 수 있어요.'); }
      if (!(typeof g('p34_warn') === 'number' && g('p34_warn') > 0 && g('p34_warn') <= 60)) err(out, 'p34_warn', '잔액 경고 기준을 1부터 60 사이 일수로 넣어 주세요.');
      if (!g('p42_mask')) { const w = '기본 마스킹을 끄면 본사 화면에 가맹 원생 정보가 그대로 보여요. 수탁자 범위를 넘을 수 있어요.'; if (out.warns.indexOf(w) < 0) out.warns.push(w); }
    },
    text: {
      'POL-34': g => g('p34_price') + '원, ' + g('p34_mode'),
      'POL-35': g => (g('p35') || []).join(', '),
      'POL-36': g => '직영 ' + g('p36_direct') + ', 가맹 ' + g('p36_fr'),
      'POL-37': g => (g('p37') || []).join(', '),
      'POL-38': g => g('p38') || '미정',
      'POL-39': g => g('p39'),
      'POL-40': g => g('p40') === '' || g('p40') == null ? '미정' : '퇴원 후 ' + g('p40') + '개월',
      'POL-42': g => g('p42_mask') ? '기본 마스킹, 해제 ' + g('p42_who') : '마스킹 안 함',
      'POL-43': g => 'v1, 재동의 ' + g('p43_re'),
    },
  };
  common('HQ-15');
  act('HQ-15', 'nc', (ctx, id) => { if (B.center(id)) ctx.ui.nc = id; });
  act('HQ-15', 'spec', () => {
    B.modal({ title: '패드 지정 사양', body: h.alert('아직 정하지 않았어요 (10/14). IT가 운영체제, 화면 크기, 검사 모드 잠금 지원을 정해요.', 'warn') + '<p style="margin:0" class="small muted">직영 패드는 본사가 사고, 가맹 공급 방식만 P1b 전에 정하는 안이 검토에서 나왔어요.</p>', cancel: '닫기' });
    return false;
  });
  act('HQ-15', 'text', ctx => {
    const v = st(ctx, 'HQ-15').vals.base;
    B.modal({
      title: '동의서·처리방침 v1 (2027-01-01)',
      body: h.kv([['버전', 'v1 (예시)'], ['재동의', v.p43_re], ['보관 기간', v.p40 ? '퇴원 후 ' + v.p40 + '개월' : '미정 (정해야 동의서를 쓸 수 있어요)'], ['직영 처리자', 'MSC Brain (본사)'], ['가맹 처리자', '각 가맹 사업자, 수탁자 MSC Brain']]) +
        h.alert('만 14세 미만은 법정대리인 동의를 받아요. 문안이 바뀌면 버전을 올리고 재동의 조건에 맞는 원생에게 다시 받아요.', 'info'),
      cancel: '닫기',
    });
    return false;
  });

  B.screen({
    id: 'HQ-15', side: 'hq', phase: 'P1a', devices: ['pc'], pages: [34],
    title: '알림톡·결제·기기·개인정보', menuLabel: '알림톡·결제·기기', crumb: '정책·요금 설정 > 알림톡·결제·기기',
    headActions: heads('HQ-15'), render: r15, mount: mountFn,
    prd: {
      summary: '알림톡 요금과 자동 발송, 학원비 받는 방법, 패드와 출석 체크, 학생 정보 보관과 열람 규칙을 한곳에서 정하는 화면이에요. 10개 규칙(POL-34~43) 중 법정인 거래 증빙 보관을 빼고 9개가 아직 확정 전이에요.',
      who: WHO + ' 값은 경영지원, IT, 법무가 정해요. 개별 센터 탭에는 부산해운대센터의 QR 체크 시험 값(예시)이 하나 들어 있어요.',
      items: [
        { n: 1, t: '알림톡 과금', d: '1건에 약 7원(안)이고 가맹 센터가 미리 충전해 두고 써요. 월 후불과 본사 부담도 고를 수 있어요. 해지하면 남은 돈을 돌려줘요. 직영은 본사 내부 비용이에요.', pol: ['POL-34'], ref: 'p.34 ①' },
        { n: 2, t: '자동 발송', d: '입실, 퇴실, 수납 안내, 미납, 재등록처럼 정보성 메시지만 자동으로 보내요. 결과지는 꺼져 있어요. 가맹 센터는 항목별로 끌 수 있어요. 광고성 메시지는 알림톡으로 보내지 않아요.', pol: ['POL-35'], ref: 'p.34 ②' },
        { n: 3, t: '결제 연동과 수납 수단', d: '직영은 결제선생으로, 가맹은 수기 기록(안)으로 받아요. 결제선생에 가맹점별 결제를 나눌 수 있는지 문의 중이고(10/21), 답에 따라 가맹점 개별 결제선생 선택지를 열어요. 수납 수단은 본사가 목록을 만들고 가맹이 골라 켜요.', pol: ['POL-36', 'POL-37'], ref: 'p.34 ③' },
        { n: 4, t: '기기', d: '패드를 센터가 사양 안내를 받아 직접 살지, 본사가 지정 사양으로 납품할지 아직 정하지 않았어요(10/14). 입·퇴실 체크는 번호, QR, 개인 로그인 중에서 센터가 골라요.', pol: ['POL-38', 'POL-39'], ref: 'p.34 ④' },
        { n: 5, t: '개인정보', d: '원문은 원생 정보의 처리자를 센터, 본사를 수탁자로 적었어요(직영은 6번에서 고쳐요). 본사 화면은 기본으로 가리고, 가림은 슈퍼관리자만 사유를 적고 풀어요. 퇴원 후 보관 기간은 미정이고 센터는 줄이기만 해요. 기간이 지난 정보는 자동으로 지우고 HQ-22 파기 대장에 남겨요. 거래 증빙은 법으로 5년 보관해요. 동의서는 버전으로 관리하고 모으는 항목이 늘면 다시 동의를 받아요.', pol: ['POL-40', 'POL-41', 'POL-42', 'POL-43'], ref: 'p.34 ⑤' },
        { n: 6, t: '센터 유형별 처리자 고지', kind: 'review', imp: 'IMP-04', pol: ['POL-42', 'POL-43'], d: '직영 센터는 본사가 직접 운영하니까 개인정보 처리자도 본사예요. 가맹 센터는 가맹 사업자가 처리자이고 본사는 맡아서 처리하는 수탁자예요. 센터를 고르면 그 센터 동의서에 들어갈 고지 문구를 미리 보여 줘요.' },
        { n: 7, t: '항목별 보관표', kind: 'review', imp: 'IMP-07', pol: ['POL-40', 'POL-41'], d: '기본 인적사항, 상담 기록, 출결과 학습 결과, 수납 증빙, 동의 기록의 보관 기간을 따로 정해요. 수납 증빙은 5년 동안 따로 보관해요. 야간 광고는 별도 동의가 있어야 한다는 부록 B 기준도 함께 보여 줘요.' },
        { n: 8, t: '알림톡 잔액 보호', kind: 'review', imp: 'IMP-26', pol: ['POL-34'], d: '충전 잔액으로 몇 건을 더 보낼 수 있는지, 최근 7일 평균으로 며칠을 더 쓸 수 있는지 센터마다 보여 줘요. 3일분(예시)보다 적으면 미리 경고해요. 입·퇴실과 미납 안내는 잔액이 모자라도 정한 한도까지 보내고 다음 청구서에 더해요. 경고 기준은 POL-34 아래에 둬요.' },
      ],
      open: ['알림톡 단가와 요금 방식 (선불 충전, 월 후불, 본사 부담)', '잔액 경고 기준과 잔액이 모자랄 때 필수 알림을 보내는 한도', '가맹 센터 결제 방식 (결제선생 답변 대기)', '패드를 직접 살지 본사가 납품할지', '퇴원 후 학생 정보 보관 기간 (동의서 v1 전에 정해야 해요)', '광고성 메시지를 보낼 별도 채널', '자동 발송 항목, 수납 수단, 출석 체크 방식, 마스킹 규칙, 동의서 문안 최종 확정'],
      rules: ['광고성 메시지는 수신 동의자에게만 보내요. 야간(21시~8시)은 별도 동의가 있어야 해요 (정보통신망법).', '거래 증빙은 5년 보관해요 (세법).', '만 14세 미만 아이 정보는 법정대리인 동의를 받아요.'],
    },
  });
})();
