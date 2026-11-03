/* HQ-01 대시보드, HQ-02 가맹 문의·영업 파이프라인, HQ-03 정보공개서·계약 게이트, HQ-04 센터 목록. 원문 p.19~22. */
(function () {
  const B = window.B, h = B.h, esc = B.esc;

  /* ---------------- 이 파일 전용 스타일 ---------------- */
  const CSS = [
    '.hqa-k5{display:grid;gap:12px;grid-template-columns:repeat(5,minmax(0,1fr))}',
    '.hqa-click{cursor:pointer;transition:border-color .15s,box-shadow .15s}',
    '.hqa-click:hover{border-color:#b9c3d8;box-shadow:0 2px 8px rgba(20,24,33,.06)}',
    '.hqa-sel{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--sub);font-weight:600;white-space:nowrap}',
    '.hqa-sel select{width:auto;min-width:92px}',
    '.hqa-filter{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
    '.hqa-line{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:5px 0;font-size:12.5px;border-bottom:1px solid var(--line-2)}',
    '.hqa-line:last-of-type{border-bottom:0}',
    '.hqa-line > b{color:var(--sub);font-weight:600;width:96px;flex:none}',
    '.hqa-line > span{flex:1;min-width:0}',
    '.hqa-note{font-size:11.5px;color:var(--mute);line-height:1.5}',
    '.hqa-chk{display:flex;flex-direction:column}',
    '.hqa-chk > div{display:flex;gap:8px;align-items:center;padding:7px 2px;border-bottom:1px solid var(--line-2);font-size:12.5px}',
    '.hqa-chk > div:last-child{border-bottom:0}',
    '.hqa-chk > div.hqa-click:hover{background:#fafbfc}',
    '.hqa-ic{width:18px;height:18px;border-radius:50%;display:inline-grid;place-items:center;font-size:11px;font-weight:800;flex:none;background:var(--gray-soft);color:var(--sub)}',
    '.hqa-ic.w{background:var(--warn-soft);color:var(--warn)}',
    '.hqa-ic.ok{background:var(--ok-soft);color:var(--ok)}',
    '.hqa-ic.no{background:var(--bad-soft);color:var(--bad)}',
    '.hqa-go{margin-left:auto;color:var(--mute);font-size:11px;white-space:nowrap}',
    '.hqa-bars{display:flex;align-items:flex-end;gap:8px;height:96px;padding:0 4px;border-bottom:1px solid var(--line)}',
    '.hqa-bars > div{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:3px;height:100%}',
    '.hqa-bars i{display:block;width:100%;background:#d3d8e2;border-radius:4px 4px 0 0}',
    '.hqa-bars .last i{background:var(--navy)}',
    '.hqa-bars span{font-size:10.5px;font-weight:700;color:var(--sub)}',
    '.hqa-axis{display:flex;gap:8px;padding:3px 4px 0;font-size:10.5px;color:var(--mute)}',
    '.hqa-axis span{flex:1;text-align:center}',
    '.hqa-board{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}',
    '.hqa-grp{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;border-radius:11px}',
    '.hqa-grp.gate{background:#f7f4fe;padding:6px;margin:-6px;border:1px dashed #c9b8f2}',
    '.hqa-col{background:#f3f4f7;border-radius:9px;padding:8px;min-height:236px;border:2px solid transparent}',
    '.hqa-grp.gate .hqa-col{background:#efeaff}',
    '.hqa-col.over{border-color:var(--navy);background:var(--navy-soft)}',
    '.hqa-col h4{margin:0 0 8px;font-size:12.5px;display:flex;gap:4px;align-items:center;min-height:22px}',
    '.hqa-col h4 .n{color:var(--sub)}',
    '.hqa-col h4 input{width:100%;padding:2px 6px;min-height:24px;font-size:12px}',
    '.hqa-lead{background:#fff;border:1px solid var(--line);border-radius:8px;padding:7px 9px;margin-bottom:6px;cursor:grab;font-size:11.5px;color:var(--sub);line-height:1.45}',
    '.hqa-lead b{display:block;font-size:13px;color:var(--ink)}',
    '.hqa-lead.sel{border-color:var(--navy);box-shadow:0 0 0 2px var(--navy-soft)}',
    '.hqa-lead .chip{margin-top:4px}',
    '.hqa-steps{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}',
    '.hqa-steps > div{border:1px solid #cfd4dc;border-radius:7px;padding:7px 6px;text-align:center;font-size:12px;font-weight:700;color:var(--sub);background:#fff}',
    '.hqa-steps .done{background:#eef0f4;color:var(--ok);border-color:#dfe3ea}',
    '.hqa-steps .cur{background:#1a1e26;color:#fff;border-color:#1a1e26}',
    '.hqa-dday{font-size:28px;font-weight:800;line-height:1.1}',
    '.hqa-warnline{color:var(--bad);font-weight:700;font-size:12.5px;margin-bottom:10px}',
    '.hqa-kvt{width:100%;border-collapse:collapse;font-size:12.5px}',
    '.hqa-kvt th{width:112px;text-align:left;background:#f7f8fa;color:var(--sub);font-weight:600;padding:7px 10px;border-bottom:1px solid var(--line-2);vertical-align:middle}',
    '.hqa-kvt td{padding:6px 10px;border-bottom:1px solid var(--line-2);vertical-align:middle}',
    '.hqa-kvt tr:last-child th,.hqa-kvt tr:last-child td{border-bottom:0}',
    '.hqa-legend{display:flex;gap:22px;align-items:center;flex-wrap:wrap;font-size:12px;color:var(--sub);margin-top:12px}',
    '.hqa-legend > span{display:inline-flex;align-items:center;gap:6px}',
    '.hqa-pg{display:flex;justify-content:center;gap:10px;font-size:12px;color:var(--sub);margin-top:8px}',
    '.hqa-sm{font-size:11px;color:var(--mute);display:block;line-height:1.35;font-weight:500}',
    '.hqa-exp90{background:var(--bad-soft);color:var(--bad);font-weight:700;border-radius:4px;padding:0 4px}',
    '.hqa-exp180{background:var(--warn-soft);color:var(--warn);font-weight:700;border-radius:4px;padding:0 4px}',
    '.hqa-chkbtn{display:inline-flex;align-items:center;gap:6px;border:0;background:none;padding:0;font-size:12.5px;cursor:pointer}',
    '.hqa-chkbtn i{width:15px;height:15px;border:1.5px solid #9aa3b2;border-radius:3px;display:inline-grid;place-items:center;font-style:normal;font-size:10px;font-weight:800}',
    '.hqa-chkbtn.on i{background:var(--navy);border-color:var(--navy);color:#fff}',
    '.hqa-file{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:7px;padding:3px 9px;font-size:12px;background:#fff}',
    '.hqa-mini td,.hqa-mini th{padding:5px 8px !important}',
    '.tbl tr.hqa-new td{background:#f6fbf8}',
    '.hqa-ph{padding-left:16px !important}',
    '.hqa-col{border:1px solid var(--line)}',
  ].join('\n');
  if (!document.getElementById('hqa-style')) {
    const st = document.createElement('style'); st.id = 'hqa-style'; st.textContent = CSS; document.head.appendChild(st);
  }

  /* ---------------- 날짜, 공통 도우미 ---------------- */
  const T = d => { const a = String(d).split('-').map(Number); return Date.UTC(a[0], a[1] - 1, a[2]); };
  const F = t => new Date(t).toISOString().slice(0, 10);
  const plus = (d, n) => F(T(d) + n * 864e5);
  const days = (a, b) => Math.round((T(a) - T(b)) / 864e5);
  const maxD = (a, b) => (a > b ? a : b);
  const okDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
  // 받침에 맞춰 조사를 고른다 (예: jo('송파점', '을', '를') = '송파점을').
  const jo = (w, a, b) => { w = String(w || ''); const c = w.charCodeAt(w.length - 1); const has = c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 > 0; return w + (has ? a : b); };

  // 선택 상자. 바꾸면 바로 동작을 부르고 화면을 다시 그린다 (mount에서 연결).
  function sel(o) {
    const opts = (o.options || []).map(x => { const v = typeof x === 'string' ? x : x.v, l = typeof x === 'string' ? x : x.l; return '<option value="' + esc(v) + '"' + (String(v) === String(o.value) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('');
    return '<label class="hqa-sel"' + h.p(o.pin) + '>' + (o.label ? '<span>' + esc(o.label) + '</span>' : '') +
      '<select class="inp" data-chg="' + esc(o.act) + '"' + (o.disabled ? ' disabled' : '') + ' aria-label="' + esc(o.label || o.aria || '') + '">' + opts + '</select></label>';
  }
  function bindChg(root) {
    Array.prototype.forEach.call(root.querySelectorAll('select[data-chg]'), el => {
      el.addEventListener('change', () => { const fn = B.actions[el.getAttribute('data-chg')]; if (fn && fn(B.ctx(), el.value, el) !== false) B.render(); });
    });
  }
  const line = (k, v) => '<div class="hqa-line"><b>' + esc(k) + '</b><span>' + v + '</span></div>';
  const ic = (kind, t) => '<span class="hqa-ic ' + (kind || '') + '">' + (t || (kind === 'ok' ? '✓' : kind === 'no' ? '✕' : kind === 'w' ? '!' : '·')) + '</span>';
  const typeChip = t => h.chip(t, t === '직영' ? 'navy' : t === '가맹' ? 'brand' : 'review');
  const polSt = st => (st && st !== '확정' ? h.chip(st === '안' ? '(안)' : st, 'st-' + st) : '');
  const who = ctx => ctx.persona.name + ' (본사 ' + ctx.persona.role + ')';
  // 동작 뒤 엔진이 화면을 다시 그리면 바로 띄운 알림이 지워져서, 다시 그린 다음에 띄운다.
  // 데모가 앞 단계 동작을 다시 돌릴 때는 지금 단계 동작의 알림만 보여 준다.
  let pending = [], curAct = null;
  function flush() {
    const last = pending[pending.length - 1]; pending = [];
    if (!last) return;
    if (B.state.mode === 'demo') {
      const st = (B.demoSteps || [])[B.state.step];
      const names = [].concat((st && st.act) || []).map(a => (typeof a === 'string' ? a : a.name));
      if (!names.includes(last.act)) return;
    }
    B.toast(last.msg);
  }
  const say = msg => { pending.push({ msg, act: curAct }); if (pending.length === 1) setTimeout(flush, 0); };
  function act(name, fn) {
    B.action(name, (ctx, arg, el) => { const prev = curAct; curAct = name; try { return fn(ctx, arg, el); } finally { curAct = prev; } });
  }

  // 엑셀 받기: CM-03 규칙대로 사유를 남겨야 받는다.
  function excelBox(ctx, prefix, target) {
    const ui = ctx.ui;
    if (!ui.xl) return '';
    return h.card({
      title: '엑셀 다운로드', sub: target, right: h.btn('닫기', { sm: true, act: prefix + '.excel' }),
      body: '<div class="grid g3" style="align-items:end">' +
        h.field({ label: '다운로드 사유', req: true, type: 'select', value: ui.xlWhy || '', options: [{ v: '', l: '사유를 골라요' }, '정기 보고', '운영 점검', '정산 확인', '기타'], field: 'xlWhy', err: ui.xlErr }) +
        h.field({ label: '자세한 내용', value: ui.xlMemo || '', field: 'xlMemo', ph: '예) 월간 경영회의 자료' }) +
        '<div class="field"><div class="row">' + h.btn('사유 남기고 받기', { primary: true, act: prefix + '.excelSave' }) + '</div></div></div>' +
        '<div class="hqa-note" style="margin-top:8px">원생 개인정보 없이 집계만 담겨요. 받은 사람과 시각, 사유가 감사 기록에 남아요 (CM-03).</div>',
    }) + '<div style="height:12px"></div>';
  }
  function excelSave(ctx, arg, target) {
    const ui = ctx.ui;
    if (arg && typeof arg === 'object') Object.assign(ui, arg);
    ui.xlErr = !ui.xlWhy ? '다운로드 사유를 골라 주세요.' : null;
    if (ui.xlErr) { ui.xl = true; return; }
    ctx.s.audit.unshift({ at: ctx.s.today.slice(5) + ' 방금', who: who(ctx), what: '엑셀 다운로드', target, reason: ui.xlWhy + (ui.xlMemo ? ', ' + ui.xlMemo : '') });
    ui.xl = false; ui.xlWhy = ''; ui.xlMemo = '';
    say('사유를 남기고 엑셀을 받았어요. 감사 기록에 남았어요.');
  }

  // 지원 모드로 센터 화면 열기: CM-02에서 사유를 받고 들어간다.
  function toSupport(ctx, center, target, reason) {
    ctx.s.ui['CM-02'] = Object.assign(ctx.s.ui['CM-02'] || {}, { center, target, next: target, reason, from: ctx.def ? ctx.def.id : 'HQ-01' });
    B.go('CM-02');
    return false;
  }
  function openCenter(ctx, id, from) {
    ctx.s.ui['HQ-05'] = Object.assign(ctx.s.ui['HQ-05'] || {}, { center: id, from: from || (ctx.def ? ctx.def.id : '') });
    B.go('HQ-05');
    return false;
  }

  /* ---------------- 데이터 ---------------- */
  B.extend(s => {
    s.hq01 = s.hq01 || {
      disc: { version: 'v1', regNo: '제2027-○○○○호', regDate: '2027-04-20', basis: '직영 운영 요건 예외', legal: '법무 검토 가정', renewDue: '2028-04-30', countFrom: '2027-01-04', countCenter: 'daechi1' },
      // 원문 p.19 센터별 현황 예시 숫자 (2027년 9월)
      sept: {
        daechi1: { n: 14, o: 3, rr: '94%', at: '96%', mi: '-' }, mokdong: { n: 11, o: 4, rr: '90%', at: '95%', mi: '-' },
        bundang: { n: 10, o: 2, rr: '92%', at: '95%', mi: '-' }, busan: { n: 9, o: 2, rr: '88%', at: '93%', mi: '2건' }, daegu: { n: 12, o: 5, rr: '89%', at: '92%', mi: '4건' },
      },
      alimLow: 10000,
    };
    // 가맹 희망자 카드 (원문 p.20 보드 예시). 기본 데이터 l1~l4는 그대로 두고 빈 칸만 채운다.
    const extra = {
      l1: { full: '인천 연수구', owner: '정본부', phone: '010-5120-3381', history: ['08/20 사업설명회', '09/01 정보공개서 등기 발송'] },
      l2: { full: '광주 서구', owner: '홍길동', phone: '010-6634-0912', history: ['09/02 홈페이지 문의', '09/16 설명회 참석'] },
      l3: { full: '경기 수원시 영통구', owner: '홍길동', phone: '010-2245-7781', history: ['09/10 전화'] },
      l4: { full: '대전 유성구', owner: '정본부', phone: '010-9012-4471', history: [] },
    };
    (s.leads || []).forEach(l => { const e = extra[l.id]; if (e) Object.keys(e).forEach(k => { if (l[k] == null) l[k] = e[k]; }); });
    const add = [
      { id: 'l5', ord: 1, name: '정재호', region: '대구 범어동', full: '대구 수성구 범어동', stage: '문의', source: '사업설명회', date: '2027-09-14', owner: '홍길동', phone: '010-4471-2093', history: [] },
      { id: 'l6', ord: 2, name: '윤지아', region: '울산 남구', full: '울산 남구', stage: '문의', source: '홈페이지', date: '2027-09-20', owner: '홍길동', phone: '010-3381-2290', history: [] },
      { id: 'l7', ord: 3, name: '한민석', region: '광주 봉선동', full: '광주 남구 봉선동', stage: '문의', source: '전화', date: '2027-09-25', owner: '정본부', phone: '010-7720-1184', history: [] },
      { id: 'l8', ord: 4, name: '배은수', region: '김포 장기동', full: '경기 김포시 장기동', stage: '문의', source: '홈페이지', date: '2027-10-01', owner: '홍길동', phone: '010-2093-5560', history: [] },
      { id: 'l9', ord: 5, name: '오세진', region: '부산 센텀', full: '부산 해운대구 센텀동', stage: '상담', source: '소개', date: '2027-09-28', owner: '홍길동', phone: '010-8812-3307', history: ['10/02 전화', '10/09 방문 상담'], open: '2028년 상반기' },
      { id: 'l10', ord: 6, name: '서지우', region: '창원 상남동', full: '경남 창원시 상남동', stage: '상담', source: '사업설명회', date: '2027-09-16', owner: '정본부', phone: '010-6610-2284', history: ['09/22 전화'] },
      { id: 'l11', ord: 7, name: '강현민', region: '대전 둔산동', full: '대전 서구 둔산동', stage: '설명회 참석', source: '사업설명회', date: '2027-08-30', owner: '홍길동', phone: '010-3329-0471', history: ['09/16 설명회 참석'] },
      { id: 'l12', ord: 8, name: '신하영', region: '세종 나성동', full: '세종 나성동', stage: '설명회 참석', source: '사업설명회', date: '2027-09-03', owner: '정본부', phone: '010-5582-1903', history: ['09/16 설명회 참석'] },
      { id: 'l13', ord: 9, name: '문정희', region: '청주 복대동', full: '충북 청주시 흥덕구 복대동', stage: '정보공개서 제공', source: '홈페이지', date: '2027-09-06', owner: '홍길동', phone: '010-4402-7719', history: ['09/13 방문 상담', '09/27 정보공개서 전자우편'], open: '2028년 상반기' },
    ];
    s.leads = s.leads || [];
    add.forEach(l => { if (!s.leads.some(x => x.id === l.id)) s.leads.push(l); });
    (s.leads || []).forEach(l => { if (l.stage === '상담' && !l.check) l.check = terrCheck(s, l); });
    s.hq02 = s.hq02 || { labels: { '문의': '문의', '상담': '상담', '설명회 참석': '설명회 참석' } };

    // 정보공개서·계약 게이트 진행 건. 윤가람(l1)은 기본 데이터 s.gate와 같은 건이다.
    const g = s.gate || {};
    s.hq03 = s.hq03 || { today: '2027-10-05', cases: {} };
    const cs = s.hq03.cases;
    if (!cs.l13) cs.l13 = {
      lead: 'l13', group: '가맹', center: null, newCenter: { id: 'cheongju', name: '청주복대센터', region: '충북 청주시' },
      disclosure: { given: '2027-09-27', method: '전자우편 + 수령 확인', proof: '수령확인서.pdf' }, advice: { on: false, file: '' },
      contract: { version: '표준 v1', given: '2027-09-28', file: '', signDate: '' },
      deposit: { method: '예치기관', inst: '○○은행', date: '2027-10-13', state: '예치 예정' }, signed: false, signedAt: '',
    };
    if (!cs.l1) cs.l1 = {
      lead: 'l1', group: '가맹', center: g.center || 'incheon', newCenter: null,
      disclosure: { given: g.disclosureGiven || '', method: '등기 우편', proof: g.disclosureProof || '' }, advice: { on: !!g.advised, file: g.advised ? '자문확인서.pdf' : '' },
      contract: { version: '표준 v1', given: g.contractGiven || '', file: '', signDate: '' },
      deposit: { method: '예치기관', inst: '', date: '', state: g.deposit ? '예치 완료' : '' }, signed: !!g.signed, signedAt: '',
    };
    if (!cs.l2) cs.l2 = {
      lead: 'l2', group: '가맹', center: null, newCenter: { id: 'gwangju', name: '광주서구센터', region: '광주 서구' },
      disclosure: { given: '', method: '', proof: '' }, advice: { on: false, file: '' },
      contract: { version: '표준 v1', given: '', file: '', signDate: '' }, deposit: { method: '예치기관', inst: '', date: '', state: '' }, signed: false, signedAt: '',
    };
    // 대구수성센터는 정원을 상한 안에서 12명으로 정했다 (원문 p.22 예시)
    const p16 = s.pol['POL-16'] = s.pol['POL-16'] || {};
    p16.centers = p16.centers || {};
    if (!p16.centers.daegu) p16.centers.daegu = { value: '12명', status: '예시', reason: '센터가 상한 안에서 정한 값 (예시)' };
  });

  /* ---------------- 공통 계산 ---------------- */
  function regDate(s) { const d = s.hq01.disc; return d.legal === '예외 불인정' ? null : d.regDate; }
  function isRegistered(s, ref) { const r = regDate(s); return !!r && ref >= r; }
  function oneYear(s) { return plus(s.hq01.disc.countFrom, 365); }
  function openPolicies(s) {
    const all = B.POLICIES || [];
    const n = all.filter(p => /P1a/.test(p.when)).filter(p => { const st = ((s.pol || {})[p.code] || {}).status || p.status; return st !== '확정' && st !== '법정'; }).length;
    return { n, total: all.length };
  }
  function prepOf(c) { return c.status === '계획' || c.status === '승인 대기'; }
  function countTypes(list) {
    const prep = list.filter(prepOf).length;
    const direct = list.filter(c => c.type === '직영' && !prepOf(c)).length;
    return { direct, fr: list.length - prep - direct, prep };
  }
  function feeBilled(s, month) {
    const inv = (s.invoices || []).filter(i => i.month === month);
    const total = inv.reduce((a, i) => a + i.lines.filter(l => /사용료/.test(l.t)).reduce((b, l) => b + l.a, 0), 0);
    const unpaid = inv.filter(i => i.status !== '입금 완료').length;
    return { total, unpaid };
  }
  function terrCheck(s, lead, exclude) {
    const full = lead.full || lead.region || '';
    const hit = (s.centers || []).find(c => c.id !== exclude && c.region && c.region !== '-' && full.indexOf(c.region) === 0);
    if (!hit) return { level: 'ok', center: null, text: '중첩 없음' };
    const active = hit.type !== '직영' && hit.status === '운영';
    return { level: active ? 'block' : 'warn', center: hit.id, text: jo(hit.name, '과', '와') + ' 중첩 · 반경 1km' };
  }
  function leadOf(s, id) { return (s.leads || []).find(l => l.id === id); }
  function caseInfo(c, today) {
    const d = c.disclosure || {}, k = c.contract || {};
    const shortOn = !!(c.advice && c.advice.on && c.advice.file);
    const rel = d.given ? plus(d.given, shortOn ? 7 : 14) : null;
    const cr = k.given ? plus(k.given, 14) : null;
    const avail = rel && cr ? maxD(rel, cr) : null;
    let status;
    if (c.signed) status = '체결 완료';
    else if (!d.given) status = '제공 준비';
    else if (today < rel) status = '숙려 중';
    else if (!k.given) status = '계약서 제공 전';
    else if (today < avail) status = '계약서 대기';
    else status = '체결 가능';
    return { rel, cr, avail, shortOn, status, dRel: rel ? days(rel, today) : null, dAvail: avail ? days(avail, today) : null };
  }
  const STAGES = ['문의', '상담', '설명회 참석', '정보공개서 제공', '계약 협의', '계약 완료'];
  const SALES = STAGES.slice(0, 3), GATE = STAGES.slice(3);
  function colOf(s, l) {
    const c = s.hq03.cases[l.id];
    if (c) {
      const inf = caseInfo(c, s.hq03.today);
      if (c.signed) return '계약 완료';
      if (c.disclosure.given && c.contract.given && s.hq03.today >= inf.rel) return '계약 협의';
      return '정보공개서 제공';
    }
    if (l.stage === '계약 대기') return '계약 협의';
    return STAGES.includes(l.stage) ? l.stage : '문의';
  }
  const srcOf = l => String(l.source || '').replace(' 문의', '');

  /* =====================================================================
     HQ-01 대시보드 (p.19)
     ===================================================================== */
  function hq01Centers(s, m) {
    if (m === '2027-03') return s.centers.filter(c => c.type === '직영' && c.opened !== '-' && c.opened <= '2027-03-31');
    return s.centers;
  }
  function hq01Rows(s, m, cs) {
    return cs.map(c => {
      const sp = m === '2027-09' ? (s.hq01.sept[c.id] || null) : null;
      const bal = c.type === '직영' ? null : (s.alim.balances || {})[c.id];
      return {
        c, n: sp ? sp.n : null, o: sp ? sp.o : null, rr: sp ? sp.rr : '-', at: sp ? sp.at : '-', mi: sp ? sp.mi : '-',
        bal, low: bal != null && bal < s.hq01.alimLow,
      };
    });
  }
  function hq01Checks(s, m, ref) {
    const out = [];
    if (m === '2027-09') {
      out.push({ k: 'refund', warn: true, t: '환불 기한 D-2 · 대구수성센터 1건', go: '지원 모드 CT-10' });
      out.push({ k: 'edu', warn: true, t: '교육청 변경신고 대기 · 2곳', go: 'HQ-04' });
      const low = s.centers.filter(c => c.type !== '직영' && (s.alim.balances || {})[c.id] != null && s.alim.balances[c.id] < s.hq01.alimLow);
      out.push({ k: 'alim', warn: low.length > 0, t: '알림톡 잔액 부족 · ' + (low.length ? low.map(c => c.name.replace('센터', '')).join(', ') : '0곳'), go: 'HQ-18' });
      const exp = s.centers.filter(c => c.contractEnd && c.contractEnd !== '-').map(c => days(c.contractEnd, ref));
      const n90 = exp.filter(d => d >= 0 && d <= 90).length, n180 = exp.filter(d => d >= 0 && d <= 180).length;
      out.push({ k: 'expire', warn: n90 > 0, t: '계약 만료 90일 이내 · ' + n90 + '곳' + (n180 > n90 ? ' (180일 이내 ' + n180 + '곳)' : ''), go: 'HQ-04' });
      const wait = s.centers.filter(c => c.status === '승인 대기');
      const plan = s.centers.filter(c => c.status === '계획');
      if (wait.length) out.push({ k: 'open:' + wait[0].id, warn: false, t: '운영 개시 승인 대기 · ' + wait.map(c => c.name).join(', '), go: 'HQ-06' });
      else out.push({ k: 'open:' + (plan[0] ? plan[0].id : ''), warn: false, t: '운영 개시 승인 대기 · 0곳' + (plan.length ? ', 오픈 준비 ' + plan.map(c => c.name).join(', ') : ''), go: 'HQ-06' });
    } else {
      const direct = s.centers.filter(c => c.type === '직영').map(c => c.id);
      const miss = s.students.filter(x => direct.includes(x.center) && x.paid === '미수');
      out.push({ k: 'miss', warn: miss.length > 0, t: '미수 · 대치1센터 ' + miss.length + '건', go: '지원 모드 CT-09' });
      const rc = s.payments.filter(p => p.method === '현금' && p.receipt !== '발급');
      out.push({ k: 'receipt', warn: rc.length > 0, t: '현금영수증 확인 · 대치1센터 ' + rc.length + '건', go: 'HQ-16' });
      const unread = [];
      s.notices.filter(n => n.must).forEach(n => Object.keys(n.read).forEach(cid => { if (!n.read[cid]) unread.push(cid); }));
      out.push({ k: 'notice', warn: unread.length > 0, t: '필독 공지 미확인 · ' + (unread.length ? unread.map(id => (B.center(id) || {}).name).join(', ') : '0곳'), go: 'HQ-21' });
      const q = s.inquiries.filter(x => x.status !== '해결');
      out.push({ k: 'inquiry', warn: false, t: '1:1 문의 처리 중 · ' + q.length + '건', go: 'HQ-21' });
      out.push({ k: 'open:', warn: false, t: '운영 개시 승인 대기 · 0곳', go: 'HQ-06' });
    }
    return out;
  }
  function gateSummary(s) {
    const cnt = {};
    Object.keys(s.hq03.cases).forEach(id => { const st = caseInfo(s.hq03.cases[id], s.hq03.today).status; cnt[st] = (cnt[st] || 0) + 1; });
    const parts = ['숙려 중', '체결 가능', '체결 완료'].filter(k => cnt[k]).map(k => k + ' ' + cnt[k] + '건');
    return parts.length ? parts.join(', ') : '진행 중인 건이 없어요';
  }

  function hq01Disc(ctx, m, ref) {
    const s = ctx.s, d = s.hq01.disc, reg = isRegistered(s, ref), legalB = d.legal === '예외 불인정';
    const legalTone = { '법무 검토 가정': 'warn', '예외 인정 (의견서 받음)': 'ok', '예외 불인정': 'bad' }[d.legal] || '';
    let body = '';
    if (reg) {
      body += line('정보공개서 ' + d.version, h.chip('등록', 'ok') + ' ' + esc(d.regDate) + ' ' + h.chip('예시', 'st-예시'));
      body += line('등록 근거', esc(d.basis) + ' ' + h.chip(d.legal, legalTone));
      body += line('정기 변경등록', esc(d.renewDue) + '까지 ' + h.chip('예시', 'st-예시'));
      body += line('가맹 계약 진행', esc(gateSummary(s)) + ' ' + h.btn('HQ-03 열기', { sm: true, go: 'HQ-03' }));
    } else {
      const n = days(ref, d.countFrom);
      body += line('정보공개서', h.chip('등록 전', 'bad') + ' ' + (legalB ? esc(oneYear(s)) + ' 뒤 등록 가능' : esc(d.regDate) + ' 등록 목표 ' + h.chip('예시', 'st-예시')));
      body += line('직영 운영 일수', '<b>D+' + n + ' / 365</b> <span class="muted small" style="display:block;white-space:nowrap">대치1센터 ' + esc(d.countFrom) + '부터 (예시)</span><span style="display:block;width:180px;margin-top:4px">' + h.bar(Math.min(100, n / 365 * 100), { color: 'var(--navy)' }) + '</span>');
      body += line('등록 근거', esc(d.basis) + ' ' + h.chip(d.legal, legalTone));
      body += line('잠긴 메뉴 P1b', ['HQ-03 계약', 'HQ-08 사용료', 'HQ-09 가맹금', 'HQ-17 청구서'].map(t => '<span class="chip bad">잠김 ' + esc(t) + '</span>').join(' '));
    }
    body += '<div style="margin-top:8px">' + sel({ label: '법무 검토 결과', value: d.legal, options: ['법무 검토 가정', '예외 인정 (의견서 받음)', '예외 불인정'], act: 'HQ01.legal', disabled: !ctx.canEdit }) + '</div>';
    const curA = !legalB;
    const sc = (on, t) => '<div style="margin-top:4px;' + (on ? 'font-weight:700' : 'opacity:.75') + '">' + (on ? h.chip('지금 가정', 'review') + ' ' : '') + t + '</div>';
    body += '<div style="margin-top:10px">' + h.alert(
      '<b style="display:block">가맹 개시 시나리오</b>' +
      sc(curA, 'A안 예외 인정이면 ' + esc(d.regDate) + ' 등록(예시), 2027년 2분기 가맹 개시') +
      sc(!curA, 'B안 예외 불인정이면 대치1센터 1년이 지난 ' + esc(oneYear(s)) + ' 뒤 등록, 2028년 1분기 가맹 개시') +
      (legalB ? '<div style="margin-top:4px">B안이면 P1b 개발을 미루고 직영 확장에 힘을 써요. HQ-03도 잠겨요.</div>' : ''),
      'review', { raw: true, pin: 6 }) + '</div>';
    body += '<div class="hqa-note" style="margin-top:8px">등록 전에는 직영 운영 일수(D+n/365)를 보여 주고 P1b 메뉴를 잠가요.</div>';
    return h.card({ title: '정보공개서·가맹 개시', pin: 2, right: polChips(['POL-06']), body });
  }
  const polChips = arr => arr.map(c => h.polChip(c)).join(' ');

  function hq01Trend(s, m, stu) {
    const series = m === '2027-03'
      ? [['1월', 128 / stu], ['2월', 128 / stu], ['3월', 1]]
      : [['4월', .64], ['5월', .7], ['6월', .76], ['7월', .82], ['8월', 374 / 412], ['9월', 1]];
    const label = m === '2027-03' ? { 2: String(stu) } : { 4: '374', 5: String(stu) };
    const bars = series.map((x, i) => '<div class="' + (i === series.length - 1 ? 'last' : '') + '">' + (label[i] ? '<span>' + esc(label[i]) + '</span>' : '') + '<i style="height:' + Math.round(x[1] * 78) + 'px"></i></div>').join('');
    return h.card({
      title: '재원생 추이', sub: m === '2027-03' ? '1~2월은 대치1센터만 운영' : '4~7월 막대는 예시',
      body: '<div class="hqa-bars">' + bars + '</div><div class="hqa-axis">' + series.map(x => '<span>' + x[0] + '</span>').join('') + '</div>',
    });
  }

  B.screen({
    id: 'HQ-01', side: 'hq', phase: 'P1a', devices: ['pc'], pages: [19],
    title: '대시보드', menuLabel: '대시보드', crumb: '본사 관리자 홈',
    headActions: ctx => '<div class="row"' + h.p(5) + '>' +
      sel({ aria: '기간', value: ctx.ui.month || '2027-09', options: [{ v: '2027-03', l: '2027년 3월 (오늘)' }, { v: '2027-09', l: '2027년 9월 (예시)' }], act: 'HQ01.month' }) +
      h.btn('엑셀', { act: 'HQ01.excel' }) + '</div>',
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, m = ui.month || '2027-09', p1a = m === '2027-03';
      const ref = p1a ? s.today : '2027-09-30';
      const cs = hq01Centers(s, m), rows = hq01Rows(s, m, cs);
      const tc = countTypes(cs), stu = cs.reduce((a, c) => a + (c.students || 0), 0);
      const pol = openPolicies(s);
      const sumN = rows.reduce((a, r) => a + (r.n || 0), 0), sumO = rows.reduce((a, r) => a + (r.o || 0), 0);
      const kpi = o => '<div class="kpi hqa-click' + (o.tone ? ' ' + o.tone : '') + '" role="button" data-act="HQ01.kpi" data-arg="' + o.go + '"' + h.p(o.pin) + '><div class="l">' + esc(o.l) + '</div><div class="v">' + o.v + '</div><div class="s">' + o.s + '</div></div>';
      let cards = kpi({ l: '운영 센터', v: String(cs.length), s: '직영 ' + tc.direct + ', 가맹 ' + tc.fr + ', 준비 ' + tc.prep, go: 'centers' }) +
        kpi({ l: '재원생', v: h.num(stu), s: p1a ? '직영 ' + cs.length + '곳 합계' : '전월 +38', go: 'students' }) +
        kpi({ l: '이번 달 신규 / 퇴원', v: p1a ? '- / -' : sumN + ' / ' + sumO, s: p1a ? '3월 마감(4/1 0시) 뒤 확정' : '재등록률 91%', go: 'newout' });
      if (p1a) {
        const direct = s.centers.filter(c => c.type === '직영').map(c => c.id);
        const paid = s.payments.filter(p => direct.includes(p.center)).reduce((a, p) => a + p.amount, 0);
        const miss = s.students.filter(x => direct.includes(x.center) && x.paid === '미수').length;
        cards += kpi({ l: '직영 수납 (사용료는 내부 대체)', v: h.money(paid), s: '미수 ' + miss + '건, 대치1센터 기록 (예시)', go: 'pay', pin: 9, tone: miss ? 'warn' : '' });
      } else {
        const fb = feeBilled(s, '2027-09');
        cards += kpi({ l: '사용료 청구', v: h.money(fb.total), s: '미납 ' + fb.unpaid + '건 · HQ-16 청구 합계', go: 'fee', tone: fb.unpaid ? 'warn' : '' });
      }
      cards += kpi({ l: '미확정 정책', v: pol.n + ' / ' + pol.total, s: 'P1a에 쓰는 정책 · HQ-07', go: 'policy', tone: 'bad' });

      let html = excelBox(ctx, 'HQ01', '센터별 현황 ' + m);
      if (!p1a && s.hq01.disc.legal === '예외 불인정') html += '<div style="margin-bottom:12px">' + h.alert('B안이면 2027년 9월에는 가맹 센터가 아직 없어요. 아래 카드와 표의 가맹 숫자는 A안 예시 그대로예요. 직영만 보려면 기간을 2027년 3월로 바꿔요.', 'warn', { title: 'B안 미리 보기' }) + '</div>';
      html += '<div class="hqa-k5"' + h.p(1) + '>' + cards + '</div>';
      html += '<div class="grid g3" style="margin-top:12px;align-items:start">';
      html += '<div class="stack">' + hq01Disc(ctx, m, ref) + '</div>';
      // 확인 필요
      const checks = hq01Checks(s, m, ref);
      const chk = h.card({
        title: '확인 필요', pin: 3, right: polChips(['POL-25', 'POL-12', 'POL-34', 'POL-07']),
        body: '<div class="hqa-chk">' + checks.map(c => '<div class="hqa-click" role="button" data-act="HQ01.check" data-arg="' + esc(c.k) + '">' + ic(c.warn ? 'w' : '', c.warn ? '!' : '·') + '<span>' + esc(c.t) + '</span><span class="hqa-go">' + esc(c.go) + '</span></div>').join('') + '</div>',
      });
      const open = s.decisions.filter(d => d.status !== '결정');
      const dec = h.card({
        title: '먼저 정할 10가지', sub: '미결 ' + open.length + ' / ' + s.decisions.length, pin: 7,
        right: h.btn('결정 관리표', { sm: true, act: 'HQ01.decision' }),
        body: '<div class="hqa-chk">' + open.slice(0, 3).map(d => '<div class="hqa-click" role="button" data-act="HQ01.decision">' + ic('', String(d.no)) + '<span>' + esc(d.topic) + '<span class="hqa-sm">결정 ' + esc(d.owner) + ' · ' + esc(d.deadline) + '</span></span></div>').join('') + '</div>',
      });
      html += '<div class="stack">' + chk + dec + '</div>';
      // 재원생 추이, 지표 정의
      const defs = h.card({
        title: '지표 정의', sub: '카드와 표가 같은 계산을 써요', pin: 8,
        body: '<table class="hqa-kvt hqa-mini">' +
          '<tr><th>재원생</th><td>그 달 수강권과 학습 계정이 모두 활성인 원생 수 ' + polSt('확정') + '<span class="hqa-sm">원문 정의</span></td></tr>' +
          '<tr><th>신규 / 퇴원</th><td>' + (p1a ? '월 마감 때 같은 계산으로 세요' : '아래 표 합계 ' + sumN + ' / ' + sumO + '<span class="hqa-sm">원문 카드 54명은 표 합계 56명과 달랐어요</span>') + '</td></tr>' +
          '<tr><th>사용료 청구</th><td>' + (p1a ? '직영은 내부 대체라 청구서가 없어요' : 'HQ-16 청구서의 사용료 합계' + '<span class="hqa-sm">원문 2,080,000원은 부산해운대 개별 단가 18,000원이 빠진 값으로 보여요</span>') + '</td></tr>' +
          '<tr><th>재등록률, 출석률</th><td>계산식 미정 ' + h.chip('미정', 'st-미정') + '</td></tr></table>',
      });
      html += '<div class="stack">' + hq01Trend(s, m, stu) + defs + '</div>';
      html += '</div>';
      // 센터별 현황
      const num = v => (v == null ? '-' : h.num(v));
      html += '<div style="margin-top:12px">' + h.card({
        title: '센터별 현황', pin: 4, right: '<span class="muted small">집계만 표시 · 원생 개인정보 없음</span> ' + h.polChip('POL-42'),
        body: h.table({
          cols: [
            { label: '센터', render: r => '<b>' + esc(r.c.name) + '</b>' },
            { label: '유형', render: r => esc(r.c.type) },
            { label: '재원생', num: true, render: r => h.num(r.c.students) },
            { label: '신규', num: true, render: r => num(r.n) },
            { label: '퇴원', num: true, render: r => num(r.o) },
            { label: '재등록률', num: true, render: r => esc(r.rr) },
            { label: '출석률', num: true, render: r => esc(r.at) },
            { label: '미수(센터)', render: r => esc(r.mi) },
            { label: '알림톡 잔액', num: true, render: r => (r.bal == null ? '-' : h.num(r.bal) + (r.low ? ' <span class="chip warn">부족</span>' : '')) },
            { label: '상태', render: r => h.status(r.c.status) },
          ],
          rows,
          rowAttr: r => ' class="click" data-act="HQ01.row" data-arg="' + r.c.id + '"',
        }) + (p1a ? '<div class="hqa-note" style="margin-top:8px">3월은 마감 전이라 신규, 퇴원, 재등록률, 출석률을 4월 1일 0시 마감 뒤 채워요. 가맹 센터는 정보공개서 등록 뒤에 생겨요.</div>' : '<div class="hqa-note" style="margin-top:8px">알림톡 잔액 부족 기준은 ' + h.money(s.hq01.alimLow) + ' (예시)이에요. 줄을 누르면 센터 상세(HQ-05)로 가요.</div>'),
      }) + '</div>';
      return html;
    },
    mount: bindChg,
    prd: {
      summary: '본사 직원이 로그인하면 처음 보는 화면이에요. 센터 수와 학생 수, 돈, 기한이 걸린 일, 가맹 개시 준비 상태를 한눈에 보고 오늘 무엇부터 챙길지 정해요.',
      who: '본사 역할 다섯 가지(슈퍼관리자, 운영, 정산, 콘텐츠, SV)가 모두 보고 써요.',
      items: [
        { n: 1, t: '핵심 지표', d: '운영 센터, 재원생, 이번 달 신규와 퇴원, 사용료 청구, 미확정 정책 수를 카드로 보여 줘요. 재원생은 그 달 수강권과 학습 계정이 둘 다 켜진 학생만 세요. 미확정 정책 수는 크게 띄워서 빨리 정하도록 재촉해요(HQ-07). 카드를 누르면 해당 목록으로 가요. 화면 숫자는 모두 예시예요.', pol: ['POL-02'], ref: 'p.19 ①' },
        { n: 2, t: '정보공개서·가맹 개시', d: '정보공개서 등록 상태와 근거(직영 1년 운영 또는 예외), 정기 변경등록 기한(2028-04-30, 예시)을 보여 줘요. 예외 인정 여부는 법무 검토 결과를 직접 골라 넣어요. 등록 전에는 직영 운영 일수를 D+n/365로 세고 가맹 계약, 가맹금, 사용료 메뉴(P1b)를 잠가요.', pol: ['POL-06'], ref: 'p.19 ②' },
        { n: 3, t: '확인 필요', d: '기한이 걸린 일을 한곳에 모아요. 환불 5일 기한(법정), 교육청 변경신고 대기, 알림톡 잔액 부족, 계약 만료 180일 전과 90일 전(법정), 운영 개시 승인 대기가 올라와요. 누르면 그 센터 화면(지원 모드)이나 본사 화면으로 가요.', pol: ['POL-25', 'POL-12', 'POL-34', 'POL-07'], ref: 'p.19 ③' },
        { n: 4, t: '센터별 현황', d: '직영과 가맹을 같은 지표로 나란히 비교해요. 원생 개인정보 없이 합계 숫자만 보여 줘요. 줄을 누르면 센터 상세(HQ-05)로 가요.', pol: ['POL-42'], ref: 'p.19 ④' },
        { n: 5, t: '기간과 다운로드', d: '월 단위로 골라 봐요. 2027년 3월을 고르면 직영만 있는 시범 단계 모습이 나와요. 엑셀은 다운로드 사유를 남겨야 받을 수 있어요(CM-03 규칙).', ref: 'p.19 ⑤' },
        { n: 6, t: '가맹 개시 두 가지 경우', kind: 'review', imp: 'IMP-20', d: '법무 결과가 예외 인정이면 A안으로 2027년 2분기에 가맹을 열어요. 불인정이면 B안으로 대치1센터 1년이 지난 2028-01-04 뒤에 정보공개서를 등록하고 2028년 1분기에 열어요. 결과를 바꾸면 이 화면과 HQ-03 잠금이 함께 바뀌어서 두 경우를 미리 볼 수 있어요. B안이면 P1b 개발을 미루고 직영에 힘을 써요.' },
        { n: 7, t: '먼저 정할 10가지 마감 관리', kind: 'review', imp: 'IMP-01', d: '부록 A의 먼저 정할 10가지를 결정자, 마감일과 함께 보여 줘요. 아직 못 정한 건이 몇 개인지 세고, 누르면 결정 관리표가 있는 정책 현황(HQ-07)으로 가요.' },
        { n: 8, t: '지표 정의를 한곳에', kind: 'review', imp: 'IMP-21', d: '카드 숫자를 아래 표와 HQ-16 청구서에서 같은 계산으로 가져와요. 원문 예시는 신규 54명인데 표 합계는 56명이었어요. 사용료 2,080,000원은 부산해운대 개별 단가가 빠진 값으로 보이고, HQ-16 사용료 합계는 1,998,000원이에요. 이 화면은 56명과 1,998,000원으로 맞춰요.' },
        { n: 9, t: '직영 시범 단계 카드', kind: 'review', imp: 'IMP-21', cond: true, reveal: 'HQ01.month', revealArg: '2027-03', d: '직영만 있는 2027년 3월에는 사용료 카드 대신 직영 수납액과 미수를 앞에 둬요. 직영은 사용료가 내부 대체라 청구서가 없어요. 확인 필요 칸에도 직영 미수와 현금영수증 확인이 올라오고, 신규와 퇴원은 월 마감 뒤에 채워요.' },
      ],
      open: ['신규, 퇴원, 재등록률, 출석률을 어떻게 계산할지', '직영 운영 일수를 어느 센터의 어느 날짜부터 셀지 (화면은 대치1센터 2027-01-04)', '알림톡 잔액이 얼마 아래면 부족으로 볼지 (화면은 1만 원, 예시)', '콘텐츠팀과 SV에게도 돈 관련 카드를 보여 줄지', '사용료를 무엇으로 셀지 (POL-02)'],
      rules: ['환불금은 사유가 생긴 날부터 5일 안에 돌려줘요 (법정).', '계약 만료 180일 전과 90일 전에 갱신 안내를 해요 (법정).', '정보공개서를 등록하기 전에는 가맹 계약과 가맹금 수령을 할 수 없어요 (법정).'],
    },
  });

  act('HQ01.month', (ctx, v) => { ctx.ui.month = v === '2027-03' ? '2027-03' : '2027-09'; });
  act('HQ01.legal', (ctx, v) => {
    if (!['법무 검토 가정', '예외 인정 (의견서 받음)', '예외 불인정'].includes(v)) return;
    ctx.s.hq01.disc.legal = v;
    say(v === '예외 불인정' ? 'B안으로 바꿨어요. 정보공개서는 ' + oneYear(ctx.s) + ' 뒤에 등록할 수 있고 HQ-03이 잠겨요.' : v === '예외 인정 (의견서 받음)' ? '예외 인정으로 바꿨어요. A안대로 ' + ctx.s.hq01.disc.regDate + ' 등록(예시)을 따라가요.' : '법무 검토 결과를 가정 상태로 되돌렸어요.');
  });
  act('HQ01.kpi', (ctx, k) => {
    const map = { centers: 'HQ-04', students: 'HQ-04', newout: 'HQ-04', fee: 'HQ-16', pay: 'HQ-16', policy: 'HQ-07' };
    if (k === 'centers' || k === 'students' || k === 'newout') ctx.s.ui['HQ-04'] = Object.assign(ctx.s.ui['HQ-04'] || {}, { only: '' });
    B.go(map[k] || 'HQ-04'); return false;
  });
  act('HQ01.check', (ctx, k) => {
    k = String(k || '');
    if (k === 'refund') return toSupport(ctx, 'daegu', 'CT-10', '환불 기한 D-2 확인');
    if (k === 'miss') return toSupport(ctx, 'daechi1', 'CT-09', '미수 확인');
    if (k === 'expire') { ctx.s.ui['HQ-04'] = Object.assign(ctx.s.ui['HQ-04'] || {}, { only: 'exp' }); B.go('HQ-04'); return false; }
    if (k === 'edu') { B.go('HQ-04'); return false; }
    if (k === 'alim') { B.go('HQ-18'); return false; }
    if (k === 'receipt') { B.go('HQ-16'); return false; }
    if (k === 'notice' || k === 'inquiry') { B.go('HQ-21'); return false; }
    if (k.indexOf('open:') === 0) { const id = k.slice(5); if (id) ctx.s.ui['HQ-06'] = Object.assign(ctx.s.ui['HQ-06'] || {}, { center: id }); B.go('HQ-06'); return false; }
  });
  act('HQ01.row', (ctx, id) => openCenter(ctx, id, 'HQ-01'));
  act('HQ01.decision', () => { B.go('HQ-07'); return false; });
  act('HQ01.excel', ctx => { ctx.ui.xl = !ctx.ui.xl; ctx.ui.xlErr = null; });
  act('HQ01.excelSave', (ctx, arg) => excelSave(ctx, arg, '센터별 현황 ' + (ctx.ui.month || '2027-09')));

  /* =====================================================================
     HQ-02 가맹 문의·영업 파이프라인 (p.20)
     ===================================================================== */
  function hq02Visible(s, ui) {
    const ref = s.hq03.today;
    const from = ui.period === '최근 30일' ? plus(ref, -30) : ui.period === '전체' ? '0000-00-00' : plus(ref, -90);
    return s.leads.filter(l => (l.date || '9999') >= from && (!ui.source || ui.source === '전체' || srcOf(l) === ui.source) && (!ui.owner || ui.owner === '전체' || l.owner === ui.owner));
  }
  function leadCard(s, l, selId) {
    const c = s.hq03.cases[l.id];
    let tag = '';
    if (c) {
      const inf = caseInfo(c, s.hq03.today);
      if (inf.status === '숙려 중') tag = h.chip('숙려 D-' + inf.dRel + ' · HQ-03', 'info');
      else if (inf.status === '체결 가능') tag = h.chip('체결 가능 · HQ-03', 'ok');
      else if (inf.status === '체결 완료') tag = h.chip('체결 완료', 'ok');
      else tag = h.chip(inf.status + ' · HQ-03', 'info');
    } else if (l.check && l.check.level !== 'ok') tag = h.chip('중첩 주의', 'warn');
    return '<div class="hqa-lead' + (l.id === selId ? ' sel' : '') + '" role="button" data-act="HQ02.select" data-arg="' + l.id + '" data-drag="' + l.id + '">' +
      '<b>' + esc(h.mask(l.name)) + '</b>' + esc(l.region) + ' · ' + esc(srcOf(l)) + (tag ? '<div>' + tag + '</div>' : '') + '</div>';
  }
  function hq02Form(ctx) {
    const ui = ctx.ui;
    return h.card({
      title: '문의 등록', sub: '직접 받은 문의 (전화, 소개, 설명회)', pin: 5, right: h.chip('P1b로 당김 (검토 제안)', 'review') + ' ' + h.btn('닫기', { sm: true, act: 'HQ02.closeForm' }),
      body: '<div class="grid g3">' +
        h.field({ label: '이름', req: true, value: ui.f_name || '', field: 'f_name', err: ui.f_err_name }) +
        h.field({ label: '연락처', req: true, value: ui.f_phone || '', field: 'f_phone', ph: '010-0000-0000', err: ui.f_err_phone }) +
        h.field({ label: '희망 지역', req: true, value: ui.f_region || '', field: 'f_region', ph: '예) 경기 화성시 동탄동', err: ui.f_err_region }) +
        h.field({ label: '유입 경로', type: 'select', value: ui.f_source || '전화', options: ['사업설명회', '홈페이지', '전화', '소개'], field: 'f_source' }) +
        h.field({ label: '담당', type: 'select', value: ui.f_owner || ctx.persona.name, options: ['홍길동', '정본부'], field: 'f_owner' }) +
        h.field({ label: '동의 받은 방법', type: 'select', value: ui.f_how || '', options: [{ v: '', l: '골라요' }, '통화 녹음', '문자 링크 동의', '서면 동의서'], field: 'f_how', err: ui.f_err_how, pol: 'POL-43' }) +
        '</div><label class="row small" style="margin-top:10px"><input type="checkbox" data-field="f_agree"' + (ui.f_agree ? ' checked' : '') + '> 희망자에게 수집 항목(이름, 연락처, 희망 지역), 목적(가맹 상담), 보관 기간(계약하지 않으면 처리방침 기간 뒤 파기)을 알리고 동의를 받았어요. 문안 v1 (예시)</label>' +
        (ui.f_err_agree ? '<div class="field"><div class="err">' + esc(ui.f_err_agree) + '</div></div>' : '') +
        '<div class="row" style="justify-content:flex-end;margin-top:10px">' + h.btn('문의 저장', { primary: true, act: 'HQ02.save', disabled: !ctx.canEdit }) + '</div>',
    }) + '<div style="height:12px"></div>';
  }
  function hq02Detail(ctx, l) {
    const s = ctx.s, ui = ctx.ui, c = s.hq03.cases[l.id], col = colOf(s, l), inGate = GATE.includes(col);
    const ck = l.check;
    const ckHtml = ck ? (ck.level === 'ok' ? h.chip(ck.text, 'ok') : h.chip(ck.text, 'warn')) + ' ' + h.chip('반경 예시', 'st-예시') : '<span class="muted">상담 단계에 들어오면 검사해요</span>';
    const kv = '<table class="hqa-kvt">' +
      '<tr><th>희망 지역</th><td>' + esc(l.full || l.region) + '</td></tr>' +
      '<tr><th>영업지역 검사</th><td><div class="row">' + ckHtml + ' ' + h.polChip('POL-08') + ' ' + h.btn('다시 검사', { sm: true, act: 'HQ02.check', arg: l.id, disabled: !ctx.canEdit }) + '</div></td></tr>' +
      '<tr><th>예상 오픈</th><td>' + esc(l.open || '미정') + '</td></tr>' +
      '<tr><th>상담 이력</th><td>' + (l.history && l.history.length ? esc(l.history.join(', ')) : '<span class="muted">아직 기록이 없어요</span>') + '</td></tr>' +
      '<tr><th>유입 경로, 담당</th><td>' + esc(srcOf(l)) + ', ' + esc(l.owner || '-') + (l.consent ? ' <span class="chip ok">동의 ' + esc(l.consent.how + ' ' + l.consent.date + ' ' + l.consent.ver) + '</span>' : '') + '</td></tr></table>';
    let side = '';
    if (!inGate) {
      side += '<div class="field"><label>단계 옮기기</label>' + h.opts(SALES.map(x => ({ v: x, l: s.hq02.labels[x] || x })), col, { act: 'HQ02.move' }).replace(/data-arg="([^"]*)"/g, (m0, v) => 'data-arg="' + esc(l.id) + '|' + v + '"') + '</div>';
    }
    side += '<div class="field" style="margin-top:10px"><label>상담 이력 더하기</label><div class="row" style="flex-wrap:nowrap">' +
      '<input class="inp" data-field="h_text" value="' + esc(ui.h_text || '') + '" placeholder="예) 10/12 전화 상담">' + h.btn('남기기', { act: 'HQ02.note', arg: l.id, disabled: !ctx.canEdit }) + '</div>' + (ui.h_err ? '<div class="err">' + esc(ui.h_err) + '</div>' : '') + '</div>';
    const nextBtn = inGate
      ? h.btn('HQ-03에서 진행 보기', { primary: true, act: 'HQ02.toGate', arg: l.id })
      : h.btn('정보공개서 제공 단계로 (HQ-03)', { primary: true, act: 'HQ02.toGate', arg: l.id, disabled: !ctx.canEdit });
    side += '<div style="margin-top:12px"' + h.p(4) + '>' + nextBtn +
      '<div class="hqa-note" style="margin-top:6px">정보공개서 제공부터는 HQ-03에서 법정 순서대로 처리해요. 이 화면에서는 계약을 등록할 수 없어요. 계약하지 않은 희망자 정보는 처리방침의 보관 기간이 지나면 파기해요.</div></div>';
    return h.card({
      title: '문의 상세', sub: h.mask(l.name) + ' · ' + col + (c ? ' · ' + caseInfo(c, s.hq03.today).status : ''), pin: 3,
      body: '<div class="grid" style="grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:16px;align-items:start">' + kv + '<div>' + side + '</div></div>',
    });
  }

  B.screen({
    id: 'HQ-02', side: 'hq', phase: 'P2', devices: ['pc'], pages: [20],
    title: '가맹 문의·영업 파이프라인', menuLabel: '가맹 문의', crumb: '가맹 모집·계약 > 가맹 문의',
    headActions: ctx => h.btn('+ 문의 등록', { primary: true, act: 'HQ02.newForm', disabled: !ctx.canEdit }),
    render(ctx) {
      const s = ctx.s, ui = ctx.ui;
      const vis = hq02Visible(s, ui);
      const selId = ui.sel && leadOf(s, ui.sel) ? ui.sel : 'l9';
      const lead = leadOf(s, selId) || vis[0];
      let html = '<div class="row between" style="margin-bottom:12px">' +
        '<div class="hqa-filter hqa-ph"' + h.p(2) + '>' +
        sel({ label: '기간', value: ui.period || '최근 90일', options: ['최근 30일', '최근 90일', '전체'], act: 'HQ02.period' }) +
        sel({ label: '유입', value: ui.source || '전체', options: ['전체', '사업설명회', '홈페이지', '전화', '소개'], act: 'HQ02.source' }) +
        sel({ label: '담당', value: ui.owner || '전체', options: ['전체', '홍길동', '정본부'], act: 'HQ02.owner' }) +
        '<span class="hqa-note">홈페이지 문의 폼은 범위 밖이라 접수만 받아 와요</span></div>' +
        (ui.editCols
          ? '<div class="row">' + h.btn('취소', { sm: true, act: 'HQ02.editCols' }) + h.btn('칸 이름 저장', { sm: true, primary: true, act: 'HQ02.saveCols' }) + '</div>'
          : h.btn('칸 이름 바꾸기', { sm: true, act: 'HQ02.editCols', disabled: !ctx.canEdit })) + '</div>';
      if (ui.form) html += hq02Form(ctx);
      const col = st => {
        const list = vis.filter(l => colOf(s, l) === st).sort((a, b) => (a.ord || 50) - (b.ord || 50));
        const lock = GATE.includes(st);
        const head = (!lock && ui.editCols)
          ? '<input class="inp" data-field="lbl_' + SALES.indexOf(st) + '" value="' + esc(ui['lbl_' + SALES.indexOf(st)] != null ? ui['lbl_' + SALES.indexOf(st)] : (s.hq02.labels[st] || st)) + '" aria-label="칸 이름">'
          : esc(lock ? st : (s.hq02.labels[st] || st)) + ' <span class="n">' + list.length + '</span>' + (lock ? ' <span class="chip review" title="HQ-03 진행 상태를 그대로 보여 줘요">잠김</span>' : '');
        return '<div class="hqa-col" data-drop="' + esc(st) + '"><h4>' + head + '</h4>' + list.map(l => leadCard(s, l, lead && lead.id)).join('') + (list.length ? '' : '<div class="hqa-note" style="text-align:center;padding:10px 0">비어 있어요</div>') + '</div>';
      };
      html += '<div class="hqa-board"' + h.p(1) + '>' +
        '<div class="hqa-grp">' + SALES.map(col).join('') + '</div>' +
        '<div class="hqa-grp gate"' + h.p(6) + '>' + GATE.map(col).join('') + '</div></div>';
      html += '<div class="hqa-note" style="margin:8px 0 12px">카드를 끌어 영업 단계(문의, 상담, 설명회 참석) 사이로 옮겨요. 보라색 칸은 HQ-03 진행 상태를 그대로 보여 주기만 해요.</div>';
      if (lead) html += hq02Detail(ctx, lead);
      return html;
    },
    mount(root) {
      bindChg(root);
      Array.prototype.forEach.call(root.querySelectorAll('[data-drag]'), el => {
        el.setAttribute('draggable', 'true');
        el.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', el.getAttribute('data-drag')); e.dataTransfer.effectAllowed = 'move'; });
      });
      Array.prototype.forEach.call(root.querySelectorAll('[data-drop]'), col => {
        col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('over'); });
        col.addEventListener('dragleave', () => col.classList.remove('over'));
        col.addEventListener('drop', e => {
          e.preventDefault(); col.classList.remove('over');
          const id = e.dataTransfer.getData('text/plain'); if (!id) return;
          const r = B.actions['HQ02.move'](B.ctx(), { id, stage: col.getAttribute('data-drop') });
          if (r !== false) B.render();
        });
      });
      const inp = root.querySelector('[data-field="h_text"]');
      if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') { const b = root.querySelector('[data-act="HQ02.note"]'); if (b) b.click(); } });
    },
    prd: {
      summary: '가맹점을 내고 싶은 사람(가맹 희망자)이 문의부터 계약까지 어디쯤 왔는지 카드로 관리해요. 정보공개서를 주는 순간부터는 HQ-03 게이트로 넘겨요.',
      who: '본사 슈퍼관리자와 운영팀만 써요. 정산, 콘텐츠, SV 역할에게는 메뉴가 보이지 않아요.',
      items: [
        { n: 1, t: '단계 보드', d: '문의, 상담, 설명회 참석, 정보공개서 제공, 계약 협의, 계약 완료 여섯 칸이에요. 희망자 한 명이 카드 한 장이고, 카드를 끌어 옆 칸으로 옮겨요. 영업 단계 칸 이름은 본사가 바꿀 수 있어요.', ref: 'p.20 ①' },
        { n: 2, t: '유입 경로와 필터', d: '사업설명회, 홈페이지, 전화, 소개처럼 어디서 알고 왔는지 남겨요. 기간(최근 90일), 유입, 담당으로 걸러 봐요. 홈페이지 문의 폼은 이 문서 범위 밖이라 들어온 문의만 받아 와요.', ref: 'p.20 ②' },
        { n: 3, t: '희망 지역 미리 검사', d: '상담 단계에 들어오면 희망 지역이 기존 센터 영업지역과 겹치는지 먼저 봐요. 여기서는 동 이름으로 참고만 하고, 계약 전에 HQ-03에서 확정 주소로 다시 봐요. 반경 1km는 예시이고 기준은 아직 정하지 않았어요.', pol: ['POL-08'], ref: 'p.20 ③' },
        { n: 4, t: '정보공개서 이후는 게이트로', d: '정보공개서 제공부터는 HQ-03에서 법이 정한 순서대로 처리해요. 이 화면에서는 계약을 등록할 수 없어요. 계약하지 않은 희망자 정보는 처리방침의 보관 기간이 지나면 지워요.', pol: ['POL-43'], ref: 'p.20 ④' },
        { n: 5, t: '문의 등록과 수집 동의 기록', kind: 'review', imp: 'IMP-24', cond: true, reveal: 'HQ02.newForm', d: '직접 받은 문의도 이름, 연락처, 희망 지역과 함께 동의 받은 방법과 문안 버전을 꼭 남겨요. 같은 연락처가 이미 있으면 새 카드를 만들지 않고 알려 줘요. 첫 가맹부터 쓰도록 이 기능만 P1b로 당겨요.', pol: ['POL-43'] },
        { n: 6, t: '법정 단계 칸은 HQ-03을 따라가요', kind: 'review', imp: 'IMP-24', d: '정보공개서 제공, 계약 협의, 계약 완료 칸은 HQ-03 진행 상태를 그대로 보여 주기만 해요. 카드를 끌어 넣으면 막고 HQ-03으로 안내해요. 그래서 법정 순서를 건너뛴 기록이 남지 않아요.' },
      ],
      open: ['영업지역을 반경, 행정동, 학교군 중 무엇으로 정할지 (POL-08)', '계약하지 않은 희망자 정보의 보관 기간', '홈페이지 문의 폼에서 넘어오는 항목', '정보공개서 등록 전에 설명회 같은 모집 활동을 어디까지 할지 (법무 확인)', '상담 뒤 포기한 희망자를 둘 종료 칸과 사유 목록'],
    },
  });

  act('HQ02.period', (ctx, v) => { ctx.ui.period = v; });
  act('HQ02.source', (ctx, v) => { ctx.ui.source = v; });
  act('HQ02.owner', (ctx, v) => { ctx.ui.owner = v; });
  act('HQ02.select', (ctx, id) => { if (leadOf(ctx.s, id)) { ctx.ui.sel = id; ctx.ui.h_err = null; } });
  act('HQ02.move', (ctx, arg) => {
    let id, stage;
    if (arg && typeof arg === 'object') { id = arg.id; stage = arg.stage; } else { const p = String(arg || '').split('|'); id = p[0]; stage = p[1]; }
    const s = ctx.s, l = leadOf(s, id); if (!l || !STAGES.includes(stage)) return;
    ctx.ui.sel = id;
    const from = colOf(s, l);
    if (from === stage) return;
    if (GATE.includes(stage)) { say('정보공개서 제공부터는 HQ-03에서 기록해요. 문의 상세의 다음 단계 버튼을 눌러요.'); return; }
    if (GATE.includes(from)) { say('이 카드는 HQ-03 진행 상태를 따라가요. 여기서 옮길 수 없어요.'); return; }
    if (!ctx.canEdit) return;
    l.stage = stage;
    if (stage === '상담') { l.check = terrCheck(s, l); say(s.hq02.labels[stage] + ' 단계로 옮겼어요. 영업지역 검사 결과 ' + l.check.text + '.'); }
    else say((s.hq02.labels[stage] || stage) + ' 단계로 옮겼어요.');
  });
  act('HQ02.check', (ctx, id) => { const l = leadOf(ctx.s, id || ctx.ui.sel || 'l9'); if (!l) return; l.check = terrCheck(ctx.s, l); say('영업지역 검사 결과 ' + l.check.text + '.'); });
  act('HQ02.note', (ctx, arg) => {
    const ui = ctx.ui;
    let id = arg, text = ui.h_text;
    if (arg && typeof arg === 'object') { id = arg.id; text = arg.text; }
    const l = leadOf(ctx.s, id || ui.sel || 'l9'); if (!l) return;
    if (!String(text || '').trim()) { ui.h_err = '남길 내용을 적어 주세요.'; return; }
    l.history = (l.history || []).concat(String(text).trim()); ui.h_text = ''; ui.h_err = null; ui.sel = l.id;
    say('상담 이력을 남겼어요.');
  });
  act('HQ02.toGate', (ctx, id) => {
    const s = ctx.s, l = leadOf(s, id || ctx.ui.sel || 'l9'); if (!l) return;
    if (!s.hq03.cases[l.id]) {
      if (!isRegistered(s, s.hq03.today)) { say('정보공개서 등록 전이라 정보공개서를 줄 수 없어요. HQ-01에서 등록 상태를 확인해요.'); return; }
      s.hq03.cases[l.id] = {
        lead: l.id, group: '가맹', center: null, newCenter: { id: 'c-' + l.id, name: l.region.split(' ').pop().replace(/동$/, '') + '센터', region: l.full || l.region },
        disclosure: { given: '', method: '', proof: '' }, advice: { on: false, file: '' }, contract: { version: '표준 v1', given: '', file: '', signDate: '' },
        deposit: { method: '예치기관', inst: '', date: '', state: '' }, signed: false, signedAt: '',
      };
    }
    s.ui['HQ-03'] = Object.assign(s.ui['HQ-03'] || {}, { case: l.id });
    B.go('HQ-03'); return false;
  });
  act('HQ02.newForm', ctx => { ctx.ui.form = true; });
  act('HQ02.closeForm', ctx => { ctx.ui.form = false; });
  act('HQ02.save', (ctx, arg) => {
    const ui = ctx.ui, s = ctx.s;
    if (arg && typeof arg === 'object') Object.assign(ui, arg);
    ui.form = true;
    const phone = String(ui.f_phone || '').trim();
    ui.f_err_name = !String(ui.f_name || '').trim() ? '이름을 넣어 주세요.' : null;
    const dup = phone && s.leads.find(l => l.phone && l.phone.replace(/-/g, '') === phone.replace(/-/g, ''));
    ui.f_err_phone = !/^01\d-?\d{3,4}-?\d{4}$/.test(phone) ? '연락처를 010-0000-0000 모양으로 넣어 주세요.' : dup ? '같은 연락처로 이미 문의한 ' + h.mask(dup.name) + ' 카드가 있어요. 그 카드에 이력을 더해요.' : null;
    ui.f_err_region = !String(ui.f_region || '').trim() ? '희망 지역을 넣어 주세요.' : null;
    ui.f_err_how = !ui.f_how ? '동의 받은 방법을 골라 주세요.' : null;
    ui.f_err_agree = !ui.f_agree ? '수집 항목과 목적, 보관 기간을 알리고 동의를 받았는지 체크해 주세요.' : null;
    if (ui.f_err_name || ui.f_err_phone || ui.f_err_region || ui.f_err_how || ui.f_err_agree) { if (dup) ui.sel = dup.id; return; }
    const id = 'l' + (s.leads.length + 1 + Object.keys(s.hq03.cases).length);
    const reg = String(ui.f_region).trim();
    const parts = reg.split(/\s+/);
    s.leads.push({
      id, name: String(ui.f_name).trim(), region: parts.length > 2 ? parts[0] + ' ' + parts[parts.length - 1] : reg, full: reg, stage: '문의', source: ui.f_source || '전화',
      date: s.hq03.today, owner: ui.f_owner || ctx.persona.name, phone, history: [s.hq03.today.slice(5).replace('-', '/') + ' ' + (ui.f_source || '전화') + ' 문의'],
      consent: { how: ui.f_how, date: s.hq03.today, ver: 'v1' },
    });
    ui.sel = id; ui.form = false;
    ['f_name', 'f_phone', 'f_region', 'f_how', 'f_agree'].forEach(k => { ui[k] = ''; });
    say('문의를 등록했어요. 동의 기록(' + s.leads[s.leads.length - 1].consent.how + ', 문안 v1)도 함께 남았어요.');
  });
  act('HQ02.editCols', ctx => { ctx.ui.editCols = !ctx.ui.editCols; SALES.forEach((x, i) => { ctx.ui['lbl_' + i] = null; }); });
  act('HQ02.saveCols', (ctx, arg) => {
    const ui = ctx.ui, lab = ctx.s.hq02.labels;
    SALES.forEach((st, i) => {
      const v = arg && typeof arg === 'object' ? arg[st] : ui['lbl_' + i];
      if (v != null && String(v).trim()) lab[st] = String(v).trim();
      ui['lbl_' + i] = null;
    });
    ui.editCols = false;
    say('영업 단계 칸 이름을 바꿨어요. 법정 단계 칸 이름은 바꿀 수 없어요.');
  });

  /* =====================================================================
     HQ-03 정보공개서·계약 게이트 (p.21)
     ===================================================================== */
  function hq03Conds(ctx, c, inf, lead) {
    const s = ctx.s, today = s.hq03.today, d = c.disclosure, k = c.contract;
    const terr = terrCheck(s, lead, c.center);
    return [
      { ok: isRegistered(s, today), t: '정보공개서 등록', v: 'v1, ' + s.hq01.disc.regDate + ' 등록 (예시)' },
      { ok: !!(d.given && d.proof), t: '정보공개서 제공과 수령 증빙', v: d.given ? d.given + ', ' + d.proof : '아직 주지 않았어요' },
      { ok: !!d.given && today >= inf.rel, t: '숙려기간 끝 (' + (inf.shortOn ? '7일, 자문' : '14일') + ')', v: d.given ? inf.rel + ' 해제' + (today < inf.rel ? ', ' + inf.dRel + '일 남음' : '') : '-' },
      { ok: !!k.given && today >= inf.cr, t: '계약서 제공 후 14일', v: k.given ? inf.cr + '부터' + (today < inf.cr ? ', ' + days(inf.cr, today) + '일 남음' : '') : '계약서를 아직 주지 않았어요' },
      { ok: terr.level !== 'block', warn: terr.level === 'warn', t: '영업지역 겹침', v: terr.level === 'block' ? terr.text + ', 계약 중인 가맹점이라 막아요' : terr.level === 'warn' ? terr.text + ', 직영과 겹쳐 경고만 해요' : '반경 1,000m 안에 겹치는 센터가 없어요' },
      { ok: !!k.file, t: '서명본과 실제 서명일', v: k.file ? k.file + ', 서명일 ' + k.signDate : inf.avail && today >= inf.avail ? '서명본을 아직 올리지 않았어요' : '체결 가능일부터 올릴 수 있어요' },
    ];
  }
  function hq03Locked(ctx) {
    const s = ctx.s, d = s.hq01.disc;
    return h.card({
      pin: 1, title: '이 화면은 잠겨 있어요',
      body: h.alert('정보공개서가 등록되지 않았어요. 등록 전에는 가맹 계약 체결과 가맹금 수령이 법으로 금지라서 화면 전체를 잠가요.', 'bad', { title: '잠김' }) +
        '<div style="margin-top:10px">' + line('법무 검토 결과', esc(d.legal)) + line('등록 가능 시점', d.legal === '예외 불인정' ? esc(oneYear(s)) + ' 뒤 (대치1센터 1년)' : esc(d.regDate) + ' (예시)') + '</div>' +
        '<div class="row" style="margin-top:10px">' + h.btn('HQ-01에서 등록 상태 보기', { go: 'HQ-01' }) + '</div>',
    });
  }

  B.screen({
    id: 'HQ-03', side: 'hq', phase: 'P1b', devices: ['pc'], pages: [21],
    title: '정보공개서·계약 게이트', menuLabel: '정보공개서·계약', crumb: '가맹 모집·계약 > 정보공개서·계약',
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, H = s.hq03, today = H.today;
      let html = '<div class="hqa-warnline">※ 정보공개서 등록 전에는 가맹 계약 체결과 가맹금 수령이 금지돼요. 테스트베드 가맹도 같아요.</div>';
      if (!isRegistered(s, today)) return html + '<div class="hqa-steps" style="margin-bottom:12px;opacity:.55">' + ['① 정보공개서 제공', '② 숙려기간', '③ 가맹계약서 제공', '④ 계약 체결', '⑤ 가맹금 예치', '⑥ 센터 등록'].map(t => '<div>잠김 ' + esc(t) + '</div>').join('') + '</div>' + hq03Locked(ctx);
      const ids = Object.keys(H.cases);
      const id = ui.case && H.cases[ui.case] ? ui.case : (H.cases.l13 ? 'l13' : ids[0]);
      const c = H.cases[id], lead = leadOf(s, c.lead) || { name: '-', region: '-' }, inf = caseInfo(c, today);
      const d = c.disclosure, k = c.contract, dep = c.deposit, ro = !ctx.canEdit;
      // 진행 건 고르기, 시연 기준일
      html += '<div class="row between" style="margin-bottom:10px">' +
        h.opts(ids.map(x => { const cc = H.cases[x], ll = leadOf(s, cc.lead) || { name: '-', region: '' }; return { v: x, l: h.mask(ll.name) + ' ' + ll.region + ' · ' + caseInfo(cc, today).status }; }), id, { act: 'HQ03.case' }) +
        sel({ label: '시연 기준일', value: today, options: [{ v: '2027-10-05', l: '2027-10-05 (예시)' }, { v: '2027-10-12', l: '2027-10-12' }], act: 'HQ03.today' }) + '</div>';
      const stTone = { '숙려 중': 'warn', '체결 가능': 'ok', '체결 완료': 'ok', '제공 준비': 'info' }[inf.status] || 'info';
      html += '<div class="row between" style="margin-bottom:10px"><div style="font-size:16px;font-weight:800">' + esc(h.mask(lead.name)) + ' (' + esc(lead.region) + ')</div>' + h.chip(inf.status, stTone) + '</div>';
      // ① 단계
      const depOk = dep.state === '예치 완료';
      const done = [!!d.given, !!d.given && today >= inf.rel, !!k.given, !!c.signed, depOk, !!c.centerDone];
      const cur = done.indexOf(false);
      const labels = ['① 정보공개서 제공', '② 숙려기간', '③ 가맹계약서 제공', '④ 계약 체결', '⑤ 가맹금 예치', '⑥ 센터 등록'];
      html += '<div class="hqa-steps"' + h.p(1) + '>' + labels.map((t, i) => '<div class="' + (done[i] ? 'done' : i === cur ? 'cur' : '') + '">' + (done[i] ? '✓ ' : '') + esc(t) + '</div>').join('') + '</div>';
      html += '<div class="grid g2" style="margin-top:14px;align-items:start">';
      // ② 정보공개서 제공
      let b2;
      if (d.given) {
        b2 = '<table class="hqa-kvt">' +
          '<tr><th>등록 번호</th><td>' + esc(s.hq01.disc.regNo) + '</td></tr>' +
          '<tr><th>버전</th><td>' + esc(s.hq01.disc.version) + ' (' + esc(s.hq01.disc.regDate) + ' 등록)</td></tr>' +
          '<tr><th>제공일</th><td>' + esc(d.given) + '</td></tr>' +
          '<tr><th>제공 방법</th><td>' + esc(d.method) + '</td></tr>' +
          '<tr><th>제공 증빙</th><td><span class="hqa-file">' + esc(d.proof) + '</span></td></tr>' +
          '<tr><th>인근가맹점 현황</th><td><div class="row"><span class="chip line">자동 생성 · 가까운 10곳</span>' + h.btn(ui.nearby ? '닫기' : '보기', { sm: true, act: 'HQ03.nearby' }) + '</div></td></tr></table>';
        if (ui.nearby) {
          const near = s.centers.filter(x => x.type !== '직영' && x.status !== '계획' && x.id !== c.center);
          b2 += '<div style="margin-top:8px">' + h.table({ cols: [{ label: '가맹점', k: 'name' }, { label: '소재지', k: 'region' }, { label: '전화', k: 'phone' }, { label: '개업', k: 'opened' }], rows: near }) +
            '<div class="hqa-note" style="margin-top:4px">지금은 가맹점이 ' + near.length + '곳뿐이라 ' + near.length + '곳만 넣었어요. 10곳보다 적을 때 직영을 넣을지는 아직 정하지 않았어요.</div></div>';
        }
      } else {
        b2 = '<div class="grid g2">' +
          h.field({ label: '제공일', type: 'date', value: ui.g_date || today, field: 'g_date', err: ui.g_err_date, disabled: ro }) +
          h.field({ label: '제공 방법', type: 'select', value: ui.g_method || '전자우편 + 수령 확인', options: ['전자우편 + 수령 확인', '등기 우편', '직접 전달'], field: 'g_method', disabled: ro }) + '</div>' +
          '<div class="field" style="margin-top:10px"><label>제공 증빙<span class="req">*</span></label><div class="row">' + (ui.g_proof ? '<span class="hqa-file">' + esc(ui.g_proof) + '</span>' : '') + h.btn(ui.g_proof ? '다시 첨부' : '수령 확인서 첨부', { sm: true, act: 'HQ03.proof', disabled: ro }) + '</div>' + (ui.g_err_proof ? '<div class="err">' + esc(ui.g_err_proof) + '</div>' : '') + '</div>' +
          '<div class="hqa-note" style="margin-top:8px">등록 번호 ' + esc(s.hq01.disc.regNo) + ', 버전 ' + esc(s.hq01.disc.version) + '이 자동으로 붙어요. 인근 가맹점 현황 문서도 함께 만들어요.</div>' +
          '<div class="row" style="justify-content:flex-end;margin-top:10px">' + h.btn('제공 기록 저장', { primary: true, act: 'HQ03.give', disabled: ro }) + '</div>';
      }
      html += h.card({ title: '정보공개서 제공', pin: 2, body: b2 });
      // ③ 숙려기간
      let b3;
      if (!d.given) b3 = h.empty('정보공개서를 주면 숙려기간이 시작돼요.');
      else {
        const released = today >= inf.rel;
        b3 = '<div style="margin-bottom:8px">' + (released ? '<span class="hqa-dday" style="color:var(--ok)">해제</span>' : '<span class="hqa-dday">D-' + inf.dRel + '</span>') + ' <span class="muted">' + esc(inf.rel) + ' 해제</span></div>' +
          '<table class="hqa-kvt"><tr><th>기본</th><td>14일 ' + h.chip('법정', 'st-법정') + '</td></tr>' +
          '<tr><th>단축</th><td><button type="button" class="hqa-chkbtn' + (c.advice.on ? ' on' : '') + '" data-act="HQ03.advice"' + (ro ? ' disabled' : '') + '><i>' + (c.advice.on ? '✓' : '') + '</i>변호사·가맹거래사 자문 확인서 제출 시 7일</button>' +
          '<div class="row" style="margin-top:6px">' + (c.advice.file ? '<span class="hqa-file">' + esc(c.advice.file) + '</span>' : '') + h.btn(c.advice.file ? '다시 첨부' : '첨부', { sm: true, act: 'HQ03.adviceFile', disabled: ro }) + '</div>' +
          (ui.adv_err ? '<div class="err" style="color:var(--bad);font-size:11px;font-weight:600">' + esc(ui.adv_err) + '</div>' : '') + '</td></tr></table>' +
          '<div class="hqa-note" style="margin-top:8px">해제 전에는 계약 체결과 가맹금 수령을 등록할 수 없어요.</div>';
      }
      html += h.card({ title: '숙려기간', pin: 3, body: b3 });
      // ④ 가맹계약서
      const lead2 = lead;
      const terr = terrCheck(s, lead2, c.center);
      const canUpload = !!(inf.avail && today >= inf.avail) && !c.signed;
      let b4 = '<table class="hqa-kvt">' +
        '<tr><th>계약서 버전</th><td>' + (k.given ? esc(k.version) : sel({ aria: '계약서 버전', value: ui.c_ver || '표준 v1', options: ['표준 v1'], act: 'HQ03.cver', disabled: ro })) + '</td></tr>' +
        '<tr><th>제공일</th><td>' + (k.given ? esc(k.given)
          : (d.given ? '<div class="row" style="flex-wrap:nowrap"><input class="inp" type="date" style="width:150px" data-field="c_date" value="' + esc(ui.c_date || today) + '"' + (ro ? ' disabled' : '') + '>' + h.btn('계약서 제공 기록', { sm: true, act: 'HQ03.contract', disabled: ro }) + '</div>' + (ui.c_err ? '<div class="err" style="color:var(--bad);font-size:11px;font-weight:600">' + esc(ui.c_err) + '</div>' : '')
            : '<span class="muted">정보공개서를 준 뒤에 줄 수 있어요</span>' + (ui.c_err ? '<div class="err" style="color:var(--bad);font-size:11px;font-weight:600">' + esc(ui.c_err) + '</div>' : ''))) + '</td></tr>' +
        '<tr><th>체결 가능일</th><td>' + (k.given ? esc(inf.cr) + ' 이후 (제공 후 14일)' : '-') + '</td></tr>' +
        '<tr><th>서명본</th><td><div' + h.p(8) + ' style="padding:2px 0">' +
          (k.file ? '<span class="hqa-file">' + esc(k.file) + '</span> <span class="muted small">서명일 ' + esc(k.signDate) + '</span>'
            : '<div class="row" style="flex-wrap:nowrap"><input class="inp" type="date" style="width:150px" aria-label="실제 서명일" data-field="signDate" value="' + esc(ui.signDate || '') + '"' + (canUpload && !ro ? '' : ' disabled') + '>' +
              h.btn('업로드', { sm: true, act: 'HQ03.upload', disabled: !canUpload || ro, title: canUpload ? '' : '체결 가능일부터 올릴 수 있어요' }) + '</div>' +
              '<span class="hqa-sm" style="margin-top:3px">실제 서명한 날을 넣어요' + (inf.avail ? '. ' + inf.avail + '보다 빠르면 막아요' : '') + '</span>' +
              (ui.up_err ? '<div class="err" style="color:var(--bad);font-size:11px;font-weight:600">' + esc(ui.up_err) + '</div>' : '')) + '</div></td></tr>' +
        '<tr><th>영업지역</th><td>반경 1,000m ' + h.chip('예시', 'st-예시') + ' ' + h.chip(terr.level === 'ok' ? '중첩 없음' : terr.text, terr.level === 'ok' ? 'line' : terr.level === 'block' ? 'bad' : 'warn') + '</td></tr></table>';
      html += h.card({ title: '가맹계약서', pin: 4, right: polChips(['POL-07', 'POL-08']), body: b4 });
      // ⑤ 가맹금 예치
      const tb = c.group === '테스트베드';
      const items = [['가맹비', tb ? '-' : '5,000,000원', tb ? '면제 (안)' : '-', tb ? '(안)' : '안'], ['교육비', '미정', '-', '미정'], ['보증금', '미정', '-', '미정']];
      let b5 = '<table class="hqa-kvt"><tr><th style="width:auto">항목</th><th style="width:auto">금액</th><th style="width:auto">면제</th><th style="width:auto">예치</th></tr>' +
        items.map(r => '<tr><td>' + r[0] + '</td><td>' + esc(r[1]) + ' ' + (r[3] === '미정' ? h.chip('미정', 'st-미정') : r[1] !== '-' ? h.chip('(안)', 'st-안') : '') + '</td><td>' + esc(r[2]) + '</td><td>' + (r[2] === '-' ? '대상' : '-') + '</td></tr>').join('') + '</table>';
      const method = ui.d_method || dep.method || '예치기관';
      b5 += '<table class="hqa-kvt" style="margin-top:8px"><tr><th>예치 방식</th><td>' + h.opts(['예치기관', '피해보상보험'], method, { act: 'HQ03.depMethod' }) + '</td></tr>' +
        '<tr><th>' + (method === '피해보상보험' ? '보험사·가입일' : '예치일·기관') + '</th><td>' +
        (depOk ? '<span class="chip ok">예치 완료</span> ' + esc(dep.inst + ' · ' + dep.date)
          : '<div class="row" style="flex-wrap:nowrap"><input class="inp" style="width:120px" aria-label="기관" data-field="d_inst" value="' + esc(ui.d_inst != null ? ui.d_inst : dep.inst || '') + '" placeholder="' + (method === '피해보상보험' ? '보험사' : '○○은행') + '"' + (ro ? ' disabled' : '') + '>' +
            '<input class="inp" type="date" style="width:140px" aria-label="날짜" data-field="d_date" value="' + esc(ui.d_date != null ? ui.d_date : dep.date || '') + '"' + (ro ? ' disabled' : '') + '>' +
            (dep.state === '예치 예정' ? h.chip('예정', 'info') : '') + '</div>' +
            (ui.d_err ? '<div class="err" style="color:var(--bad);font-size:11px;font-weight:600;margin-top:3px">' + esc(ui.d_err) + '</div>' : '') +
            '<div class="row" style="margin-top:6px">' + h.btn('예치 기록 저장', { sm: true, act: 'HQ03.deposit', disabled: !c.signed || ro, title: c.signed ? '' : '체결 뒤에 기록해요' }) + '</div>') +
        '</td></tr><tr><th>해제 예정</th><td>개업일 또는 계약 후 2개월 ' + h.chip('법정', 'st-법정') + '</td></tr></table>';
      html += h.card({ title: '가맹금 예치', pin: 5, right: polChips(['POL-06', 'POL-44']), body: b5 });
      html += '</div>';
      // ⑥ 체결 버튼, ⑦ 체결 조건
      const conds = hq03Conds(ctx, c, inf, lead);
      const allOk = conds.every(x => x.ok);
      const why = conds.filter(x => !x.ok).map(x => x.t === '숙려기간 끝 (14일)' || x.t === '숙려기간 끝 (7일, 자문)' ? (d.given ? '숙려기간 D-' + inf.dRel : '숙려기간 시작 전') : x.t === '계약서 제공 후 14일' ? (k.given ? '계약서 제공 후 14일 전' : '계약서 제공 전') : x.t === '서명본과 실제 서명일' ? '서명본 업로드 전' : x.t);
      let b6;
      if (c.signed) {
        b6 = '<div' + h.p(6) + '><div class="row">' + h.chip('체결 완료 ' + (c.signedAt || ''), 'ok') +
          h.btn('센터 등록으로 이어서 하기 (HQ-05)', { primary: true, act: 'HQ03.toCenter' }) + '</div>' +
          '<div class="hqa-note" style="margin-top:6px">' + (depOk ? '가맹금 예치까지 기록했어요.' : '가맹금 예치를 기록하면 ⑤ 단계가 끝나요.') + ' 센터는 계획 상태로 만들어졌어요.</div></div>';
      } else {
        b6 = '<div class="row"' + h.p(6) + '>' + h.btn('계약 체결 등록', { primary: true, act: 'HQ03.sign', disabled: !allOk || ro }) +
          '<span class="muted small">' + esc(allOk ? '조건을 모두 채웠어요' : why.join(', ')) + '</span></div>' +
          (ui.sign_err ? '<div class="err" style="color:var(--bad);font-size:11.5px;font-weight:600;margin-top:4px">' + esc(ui.sign_err) + '</div>' : '');
      }
      const chk = '<div' + h.p(7) + '><div class="hqa-chk">' + conds.map(x => '<div>' + ic(x.ok ? (x.warn ? 'w' : 'ok') : 'no') + '<span style="width:170px;flex:none;font-weight:600">' + esc(x.t) + '</span><span class="muted">' + esc(x.v) + '</span></div>').join('') + '</div>' +
        '<div class="hqa-note" style="margin-top:6px">' + (inf.avail ? '체결 가능 시작 <b>' + esc(inf.avail) + ' 0시</b>. 숙려 해제일과 계약서 제공 후 14일 중 늦은 날이에요. 기간을 세는 방식은 법무 확인 전이에요.' : '정보공개서와 계약서를 함께 줄 수 있어요. 두 기간이 같이 흘러가요.') + '</div></div>';
      html += '<div style="margin-top:12px">' + h.card({ title: '체결', sub: '조건이 모두 맞으면 열려요', body: '<div class="grid" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:18px;align-items:start">' + chk + '<div>' + b6 + '<div class="hqa-note" style="margin-top:10px">법 조항 해석은 부록 B와 원문 대조, 법무 확인 뒤 확정해요.</div></div></div>' }) + '</div>';
      return html;
    },
    mount: bindChg,
    prd: {
      summary: '가맹 계약을 법이 정한 순서대로만 진행하게 하는 관문이에요. 정보공개서를 주고 숙려기간을 지키고 계약서를 준 뒤에야 체결 버튼이 열려요. 체결 뒤에는 가맹금을 맡긴 기록을 남겨요.',
      who: '본사 슈퍼관리자와 운영팀만 써요. 정산, 콘텐츠, SV 역할에게는 메뉴가 보이지 않아요.',
      items: [
        { n: 1, t: '법정 순서와 잠금', d: '정보공개서 제공, 숙려기간, 계약서 제공, 체결, 예치 순서를 시스템이 지키게 해요. 정보공개서가 등록되지 않았으면 이 화면 전체가 잠겨요.', ref: 'p.21 ①' },
        { n: 2, t: '정보공개서 제공 기록', d: '등록 번호, 버전, 제공일, 제공 방법, 수령 증빙을 남겨요. 인근 가맹점 현황 문서(가까운 10곳, 법정)는 센터 데이터로 자동으로 만들어요.', ref: 'p.21 ②' },
        { n: 3, t: '숙려기간', d: '정보공개서를 준 뒤 14일(법정)을 기다려요. 변호사나 가맹거래사 자문 확인서를 내면 7일(법정)로 줄어요. 그 전에는 계약도 가맹금 수령도 할 수 없어요.', ref: 'p.21 ③' },
        { n: 4, t: '가맹계약서', d: '체결 14일 전까지(법정) 계약서를 주고 제공일을 적어요. 서명본은 계약이 끝난 뒤에도 법정 기간 동안 보관해요. 영업지역을 계약서에 적어요.', pol: ['POL-07', 'POL-08'], ref: 'p.21 ④' },
        { n: 5, t: '가맹금 예치', d: '가맹비, 교육비, 보증금 항목은 정책(POL-06)에서 가져와요. 가맹비 5,000,000원은 (안)이고 교육비와 보증금은 미정이에요. 예치기관에 맡겼는지 피해보상보험에 들었는지, 날짜와 기관을 남겨요. 테스트베드는 가맹비 면제가 (안)이에요.', pol: ['POL-06', 'POL-44'], ref: 'p.21 ⑤' },
        { n: 6, t: '체결 버튼', d: '조건이 모두 맞을 때만 열려요. 체결하면 센터가 계획 상태로 만들어지고 센터 등록(HQ-05)으로 이어져요. 법 조항 해석은 부록 B와 법무 확인 뒤 확정해요.', ref: 'p.21 ⑥' },
        { n: 7, t: '체결 조건 체크리스트', kind: 'review', imp: 'IMP-24', d: '정보공개서 숙려와 계약서 14일을 함께 흘러가게 해요. 둘 중 늦은 날을 체결 가능일로 한 가지 표현(0시부터)으로 보여 줘요. 계약 중인 가맹점 영업지역과 겹치면 계약서를 주거나 체결할 수 없게 막아요.' },
        { n: 8, t: '실제 서명일 검사', kind: 'review', imp: 'IMP-24', d: '체결 가능일 전에는 서명본 올리기가 잠겨 있어요. 올릴 때 실제 서명한 날을 받고, 체결 가능일보다 이르면 저장을 막고 감사 기록에 남겨요. 숙려기간 중 종이로 서명하고 날짜만 맞추는 일을 막아요.' },
      ],
      open: ['기간을 세는 방식 (제공일을 첫날로 셀지, 이메일은 보낸 날과 수령 확인한 날 중 무엇이 기준인지)', '가맹금이 모두 면제일 때 예치 단계를 건너뛸지', '숙려 중에 정보공개서 버전이 바뀌면 다시 주고 새로 셀지', '가맹점이 10곳보다 적을 때 인근 가맹점 문서에 직영을 넣을지', '교육비와 보증금 금액 (POL-06)'],
      rules: ['정보공개서 등록 전에는 가맹 계약 체결과 가맹금 수령이 금지예요. 테스트베드 가맹도 같아요 (법정).', '가맹금은 본사가 바로 받지 않고 예치기관에 맡기거나 피해보상보험에 들어요 (법정).', '예치한 가맹금은 개업일 또는 계약 후 2개월이 지나야 지급을 요청할 수 있어요 (법정).'],
    },
  });

  function curCase(ctx) { const H = ctx.s.hq03; const id = ctx.ui.case && H.cases[ctx.ui.case] ? ctx.ui.case : (H.cases.l13 ? 'l13' : Object.keys(H.cases)[0]); return H.cases[id]; }
  function clearForm(ui) { ['g_date', 'g_method', 'g_proof', 'g_err_date', 'g_err_proof', 'c_date', 'c_err', 'signDate', 'up_err', 'd_inst', 'd_date', 'd_err', 'd_method', 'adv_err', 'sign_err', 'nearby'].forEach(k => { ui[k] = null; }); }
  function syncGate(s, c) {
    if (c.lead !== 'l1' || !s.gate) return;
    s.gate.advised = !!(c.advice.on && c.advice.file);
    s.gate.signed = !!c.signed;
    if (c.deposit.state === '예치 완료') s.gate.deposit = c.deposit.inst + ' · ' + c.deposit.date;
  }
  act('HQ03.case', (ctx, id) => { if (ctx.s.hq03.cases[id]) { ctx.ui.case = id; clearForm(ctx.ui); } });
  act('HQ03.today', (ctx, v) => { if (!okDate(v)) return; ctx.s.hq03.today = v; ['c_err', 'up_err', 'd_err', 'sign_err', 'adv_err'].forEach(k => { ctx.ui[k] = null; }); });
  act('HQ03.nearby', ctx => { ctx.ui.nearby = !ctx.ui.nearby; });
  act('HQ03.proof', ctx => { ctx.ui.g_proof = '수령확인서.pdf'; ctx.ui.g_err_proof = null; });
  act('HQ03.give', (ctx, arg) => {
    const ui = ctx.ui, s = ctx.s, c = curCase(ctx); if (!c || c.disclosure.given) return;
    ui.c_err = null;
    if (arg && typeof arg === 'object') { if (arg.date) ui.g_date = arg.date; if (arg.method) ui.g_method = arg.method; if (arg.proof) ui.g_proof = arg.proof === true ? '수령확인서.pdf' : arg.proof; }
    const date = ui.g_date || s.hq03.today;
    ui.g_err_date = !okDate(date) ? '제공일을 넣어 주세요.' : date > s.hq03.today ? '앞으로의 날짜는 넣을 수 없어요.' : null;
    ui.g_err_proof = !ui.g_proof ? '수령 확인서 같은 증빙을 첨부해야 저장돼요.' : null;
    if (ui.g_err_date || ui.g_err_proof) return;
    c.disclosure = { given: date, method: ui.g_method || '전자우편 + 수령 확인', proof: ui.g_proof };
    const l = leadOf(s, c.lead); if (l && SALES.includes(l.stage)) l.stage = '정보공개서 제공';
    clearForm(ui); ui.case = c.lead;
    say('정보공개서 제공을 기록했어요. 숙려기간 14일이 ' + plus(date, 14) + '에 끝나요.');
  });
  act('HQ03.adviceFile', ctx => { const c = curCase(ctx); if (!c) return; c.advice.file = '자문확인서.pdf'; ctx.ui.adv_err = null; syncGate(ctx.s, c); });
  act('HQ03.advice', (ctx, v) => {
    const c = curCase(ctx); if (!c || !c.disclosure.given) return;
    const on = v === true || v === 'on' ? true : v === false || v === 'off' ? false : !c.advice.on;
    if (on && !c.advice.file) { ctx.ui.adv_err = '자문 확인서를 먼저 첨부해야 7일로 줄어요.'; return; }
    c.advice.on = on; ctx.ui.adv_err = null; syncGate(ctx.s, c);
    say(on ? '자문 확인서를 확인했어요. 숙려기간이 7일로 줄었어요.' : '숙려기간을 기본 14일로 되돌렸어요.');
  });
  act('HQ03.cver', (ctx, v) => { ctx.ui.c_ver = v; });
  act('HQ03.contract', (ctx, arg) => {
    const ui = ctx.ui, s = ctx.s, c = curCase(ctx); if (!c || c.contract.given) return;
    if (arg && typeof arg === 'object' && arg.date) ui.c_date = arg.date;
    const date = ui.c_date || s.hq03.today;
    const lead = leadOf(s, c.lead) || {};
    const terr = terrCheck(s, lead, c.center);
    if (!c.disclosure.given) { ui.c_err = '정보공개서를 먼저 줘야 해요.'; return; }
    if (!okDate(date) || date < c.disclosure.given || date > s.hq03.today) { ui.c_err = '제공일은 정보공개서 제공일(' + c.disclosure.given + ')과 오늘 사이로 넣어 주세요.'; return; }
    if (terr.level === 'block') { ui.c_err = '희망 지역이 ' + ((B.center(terr.center) || {}).name || '기존 가맹점') + ' 영업지역과 겹쳐요 (반경 1km, 예시). 계약 중인 가맹점이라 계약서를 줄 수 없어요. 영업지역을 다시 정해요.'; return; }
    c.contract.given = date; c.contract.version = ui.c_ver || '표준 v1'; ui.c_err = null; ui.c_date = null;
    say('계약서 제공을 기록했어요. ' + plus(date, 14) + '부터 체결할 수 있어요.');
  });
  act('HQ03.upload', (ctx, arg) => {
    const ui = ctx.ui, s = ctx.s, c = curCase(ctx); if (!c || c.signed) return;
    if (arg && typeof arg === 'object' && arg.signDate) ui.signDate = arg.signDate;
    const inf = caseInfo(c, s.hq03.today), lead = leadOf(s, c.lead) || { name: '' };
    if (!inf.avail || s.hq03.today < inf.avail) { ui.up_err = '체결 가능일(' + (inf.avail || '미정') + ') 전에는 서명본을 올릴 수 없어요.'; return; }
    const sd = ui.signDate;
    if (!okDate(sd)) { ui.up_err = '실제 서명한 날을 넣어 주세요.'; return; }
    if (sd > s.hq03.today) { ui.up_err = '앞으로의 날짜는 넣을 수 없어요.'; return; }
    if (sd < inf.avail) {
      ui.up_err = '서명일 ' + sd + '은 체결 가능일 ' + inf.avail + '보다 빨라요. 숙려기간 중 서명은 받을 수 없어 저장을 막고 감사 기록에 남겼어요.';
      s.audit.unshift({ at: s.hq03.today.slice(5) + ' 방금', who: who(ctx), what: '체결 가능일 전 서명본 업로드 시도', target: h.mask(lead.name) + ' 가맹계약서', reason: '서명일 ' + sd });
      return;
    }
    c.contract.file = '서명본_' + h.mask(lead.name) + '.pdf'; c.contract.signDate = sd; ui.up_err = null; ui.signDate = null;
    say('서명본을 올렸어요. 이제 계약 체결을 등록할 수 있어요.');
  });
  act('HQ03.sign', ctx => {
    const s = ctx.s, c = curCase(ctx); if (!c || c.signed) return;
    const inf = caseInfo(c, s.hq03.today), lead = leadOf(s, c.lead) || {};
    const bad = hq03Conds(ctx, c, inf, lead).filter(x => !x.ok);
    if (bad.length) { ctx.ui.sign_err = '아직 못 채운 조건이 있어요. ' + bad.map(x => x.t).join(', '); return; }
    c.signed = true; c.signedAt = s.hq03.today; ctx.ui.sign_err = null;
    if (!c.center && c.newCenter) {
      const nc = c.newCenter;
      if (!B.center(nc.id)) {
        const tpl = B.center('incheon') || s.centers[0];
        s.centers.push(Object.assign({}, tpl, { id: nc.id, name: nc.name, type: c.group || '가맹', status: '계획', director: (lead.name || '') + ' (예정)', students: 0, region: nc.region, opened: '-', contractEnd: '-', phone: '-', bizNo: '-', edu: '-' }));
      }
      c.center = nc.id;
    }
    if (lead.id) lead.stage = '계약 완료';
    syncGate(s, c);
    say('계약 체결을 등록했어요. ' + jo((B.center(c.center) || {}).name || '센터', '을', '를') + ' 계획 상태로 만들었어요. 가맹금 예치를 기록해요.');
  });
  act('HQ03.depMethod', (ctx, v) => { if (v === '예치기관' || v === '피해보상보험') { ctx.ui.d_method = v; const c = curCase(ctx); if (c) c.deposit.method = v; } });
  act('HQ03.deposit', (ctx, arg) => {
    const ui = ctx.ui, s = ctx.s, c = curCase(ctx); if (!c) return;
    if (arg && typeof arg === 'object') { if (arg.inst != null) ui.d_inst = arg.inst; if (arg.date != null) ui.d_date = arg.date; if (arg.method) { ui.d_method = arg.method; c.deposit.method = arg.method; } }
    if (!c.signed) { ui.d_err = '체결 전에는 가맹금을 받을 수 없어 예치도 기록할 수 없어요.'; return; }
    const inst = ui.d_inst != null ? ui.d_inst : c.deposit.inst, date = ui.d_date != null ? ui.d_date : c.deposit.date;
    if (!String(inst || '').trim() || !okDate(date)) { ui.d_err = '기관과 날짜를 모두 넣어 주세요.'; return; }
    if (date < c.signedAt) { ui.d_err = '예치일은 체결일(' + c.signedAt + ') 뒤여야 해요.'; return; }
    c.deposit = { method: ui.d_method || c.deposit.method || '예치기관', inst: String(inst).trim(), date, state: '예치 완료' };
    ui.d_err = null; ui.d_inst = null; ui.d_date = null;
    syncGate(s, c);
    say('가맹금 예치를 기록했어요. 개업일 또는 계약 후 2개월이 지나면 지급을 요청해요.');
  });
  act('HQ03.toCenter', ctx => {
    const c = curCase(ctx); if (!c || !c.signed) { say('체결을 먼저 등록해요.'); return; }
    c.centerDone = true;
    return openCenter(ctx, c.center, 'HQ-03');
  });

  /* =====================================================================
     HQ-04 센터 목록 (p.22)
     ===================================================================== */
  function capOf(c) {
    const pv = h.polValue('POL-16', c);
    const base = parseInt(String(pv.value).replace(/[^0-9]/g, ''), 10) || 15;
    if (!c.facilityCap) return { cap: null, tip: '시설 정보를 넣으면 계산돼요' };
    const vals = [base, c.facilityCap].concat(c.facility === '교습소' ? [9] : []);
    const cap = Math.min.apply(null, vals);
    const tip = (pv.from === '개별 센터' ? '센터 값 ' : '본사 기준 ') + base + '명, 시설 수용 ' + c.facilityCap + '명' + (c.facility === '교습소' ? ', 교습소 9명' : '') + ' 중 가장 작은 값';
    return { cap, tip };
  }
  function feeOf(c) {
    if (c.type === '직영') return { html: '내부 대체', extra: '' };
    const v = h.polValue('POL-01', c);
    let val = String(v.value), st = v.status;
    const m = /예시\s*([\d,]+원)/.exec(val); if (m) { val = m[1]; st = '예시'; }
    const html = '<b>' + esc(val) + '</b> ' + polSt(st) + (v.from === '개별 센터' ? ' ' + h.chip('개별', 'line') : '');
    const extra = v.from === '개별 센터' && v.until ? v.until + '까지 개별, 이후 기본값' : v.next ? v.next.date + '부터 ' + v.next.value : '';
    // 이미 계약한 센터는 새 기본값을 바로 붙이지 않고 계약 조항과 동의를 먼저 확인한다 (IMP-25)
    const consent = !!(v.next && v.from === '본사 기본값' && c.contractEnd && c.contractEnd !== '-');
    return { html, extra, consent };
  }
  function hq04Filter(s, ui) {
    const q = String(ui.qa || '').trim().replace(/-/g, '');
    const unpaid = (s.invoices || []).filter(i => i.status !== '입금 완료').map(i => i.center);
    return s.centers.filter(c =>
      (!ui.type || ui.type === '전체' || c.type === ui.type) &&
      (!ui.status || ui.status === '전체' || c.status === ui.status) &&
      (!ui.region || ui.region === '전체' || String(c.region).indexOf(ui.region) === 0) &&
      (!ui.sv || ui.sv === '전체' || c.sv === ui.sv) &&
      (!q || [c.name, c.director, String(c.bizNo).replace(/-/g, '')].some(x => String(x).replace(/-/g, '').indexOf(q) >= 0)) &&
      (ui.only !== 'exp' || (c.contractEnd !== '-' && days(c.contractEnd, s.today) <= 180)) &&
      (ui.only !== 'unpaid' || unpaid.includes(c.id)));
  }
  function hq04Form(ctx) {
    const ui = ctx.ui;
    return h.card({
      title: '센터 등록', sub: '직영 센터만 여기서 만들어요', pin: 5, right: h.btn('닫기', { sm: true, act: 'HQ04.closeForm' }),
      body: '<div class="grid g4">' +
        h.field({ label: '센터명', req: true, value: ui.f_name || '', field: 'f_name', ph: '예) 송파센터', err: ui.f_err_name }) +
        h.field({ label: '유형', type: 'select', value: '직영', options: [{ v: '직영', l: '직영' }], field: 'f_type', hint: '가맹은 HQ-03 계약 체결로만 생겨요' }) +
        h.field({ label: '시설', type: 'select', value: ui.f_fac || '학원', options: ['학원', '교습소'], field: 'f_fac', pol: 'POL-15' }) +
        h.field({ label: '지역', req: true, value: ui.f_region || '', field: 'f_region', ph: '예) 서울 송파구', err: ui.f_err_region }) +
        h.field({ label: '원장', value: ui.f_dir || '', field: 'f_dir', ph: '예정이면 비워 둬요' }) +
        h.field({ label: '사업자번호', req: true, value: ui.f_biz || '', field: 'f_biz', ph: '000-00-00000', err: ui.f_err_biz }) +
        h.field({ label: '담당 SV', type: 'select', value: ui.f_sv || '최민호', options: ['최민호', '정유나'], field: 'f_sv' }) +
        h.field({ label: '첫 상태', type: 'static', value: '계획' }) + '</div>' +
        '<div class="row" style="justify-content:space-between;margin-top:10px"><span class="hqa-note">시설 정보와 교육청 등록은 센터 상세(HQ-05)에서 넣어요. 상태는 HQ-06 승인으로 운영이 돼요.</span>' + h.btn('센터 저장', { primary: true, act: 'HQ04.save', disabled: !ctx.canEdit }) + '</div>',
    }) + '<div style="height:12px"></div>';
  }
  function hq04Rules() {
    const rows = [
      ['(새 센터)', '계획', '직영은 이 화면의 센터 등록, 가맹은 HQ-03 계약 체결', '센터 기본 정보'],
      ['계획', '승인 대기', 'HQ-05 센터 상세', '시설과 교육청 등록 정보를 채워 승인 요청'],
      ['승인 대기', '운영', 'HQ-06 운영 개시 승인', '체크리스트 통과, 본사 승인'],
      ['운영', '휴원', '미정', '조건과 사용료 처리 미정'],
      ['운영', '계약 종료', 'HQ-26 갱신·해지·폐점', '해지나 만료 처리'],
    ];
    return h.card({
      title: '센터 상태 전환 규칙', sub: '검토 제안', right: h.btn('닫기', { sm: true, act: 'HQ04.rules' }),
      body: h.table({ cols: [{ label: '지금 상태', render: r => h.status(r[0]) }, { label: '바뀌는 상태', render: r => h.status(r[1]) }, { label: '바꾸는 곳', render: r => esc(r[2]) }, { label: '조건', render: r => esc(r[3]) }], rows }) +
        '<div class="hqa-note" style="margin-top:6px">목록과 센터 상세에서는 상태를 바로 바꾸지 못해요. 정해진 화면을 거쳐야 HQ-03 게이트와 HQ-06 승인을 건너뛰지 않아요.</div>',
    }) + '<div style="height:12px"></div>';
  }

  B.screen({
    id: 'HQ-04', side: 'hq', phase: 'P1a', devices: ['pc'], pages: [22],
    title: '센터 목록', menuLabel: '센터 목록', crumb: '가맹점 관리 > 센터 목록',
    headActions: ctx => h.btn('엑셀', { act: 'HQ04.excel' }) + h.btn('+ 센터 등록', { primary: true, act: 'HQ04.newForm', disabled: !ctx.canEdit }),
    render(ctx) {
      const s = ctx.s, ui = ctx.ui;
      const regions = s.centers.map(c => String(c.region).split(' ')[0]).filter((v, i, a) => v && v !== '-' && a.indexOf(v) === i);
      let html = '<div class="row between" style="margin-bottom:12px">' +
        '<div class="hqa-filter hqa-ph"' + h.p(1) + '>' +
        sel({ label: '유형', value: ui.type || '전체', options: ['전체', '직영', '가맹', '테스트베드'], act: 'HQ04.type' }) +
        sel({ label: '상태', value: ui.status || '전체', options: ['전체', '계획', '승인 대기', '운영', '휴원', '계약 종료'], act: 'HQ04.status' }) +
        sel({ label: '지역', value: ui.region || '전체', options: ['전체'].concat(regions), act: 'HQ04.region' }) +
        sel({ label: '담당 SV', value: ui.sv || '전체', options: ['전체', '최민호', '정유나'], act: 'HQ04.sv' }) +
        '<input class="inp" style="width:200px" data-field="q" value="' + esc(ui.q || '') + '" placeholder="센터명·원장명·사업자번호" aria-label="검색어">' +
        h.btn('검색', { primary: true, act: 'HQ04.search' }) + ' ' + h.polChip('POL-44') + '</div>' +
        '<span class="hqa-ph" style="display:inline-block"' + h.p(7) + '>' + h.btn('상태 규칙', { sm: true, act: 'HQ04.rules' }) + '</span></div>';
      if (ui.rules) html += hq04Rules();
      html += excelBox(ctx, 'HQ04', '센터 목록');
      if (ui.form) html += hq04Form(ctx);
      // 카드
      const tc = countTypes(s.centers), stu = s.centers.reduce((a, c) => a + (c.students || 0), 0);
      const exp = s.centers.filter(c => c.contractEnd !== '-' && days(c.contractEnd, s.today) <= 180);
      const unpaid = (s.invoices || []).filter(i => i.status !== '입금 완료');
      const unpaidAmt = unpaid.reduce((a, i) => a + i.lines.reduce((b, l) => b + l.a, 0) - (i.paid || 0), 0);
      const kpi = o => '<div class="kpi' + (o.go == null ? '' : ' hqa-click') + (ui.only === o.go && o.go ? ' ok' : '') + '"' + (o.go == null ? '' : ' role="button" data-act="' + (o.go ? 'HQ04.only' : 'HQ04.clear') + '" data-arg="' + o.go + '"') + '><div class="l">' + esc(o.l) + '</div><div class="v">' + o.v + '</div><div class="s">' + o.s + '</div></div>';
      html += '<div class="grid g4">' +
        kpi({ l: '전체 센터', v: String(s.centers.length), s: '직영 ' + tc.direct + ', 가맹 ' + tc.fr + ', 준비 ' + tc.prep, go: '' }) +
        kpi({ l: '재원생', v: h.num(stu), s: '전월 +38' }) +
        kpi({ l: '계약 만료 180일 이내', v: String(exp.length), s: exp.length ? exp.map(c => c.name).join(', ') : '만료 알림 대상 없음', go: 'exp' }) +
        kpi({ l: '미납 청구', v: unpaid.length + '건', s: h.money(unpaidAmt) + ' · 누르면 해당 센터만', go: 'unpaid' }) + '</div>';
      const list = hq04Filter(s, ui);
      if (ui.only || ui.qa) html += '<div class="row" style="margin-top:10px"><span class="chip info">' + esc(ui.only === 'exp' ? '계약 만료 180일 이내' : ui.only === 'unpaid' ? '미납 청구가 있는 센터' : '검색어 ' + ui.qa) + '만 보는 중</span>' + h.btn('조건 지우기', { sm: true, act: 'HQ04.clear' }) + '</div>';
      // 표
      let pin2 = false, pin6 = false;
      const table = h.table({
        cols: [
          { label: '센터명', render: c => '<b>' + esc(c.name) + '</b>' + (ui.hl === c.id ? ' <span class="chip ok">새로 등록</span>' : '') },
          { label: '유형', render: c => typeChip(c.type) },
          { label: '상태', render: c => h.status(c.status) },
          { label: '시설', render: c => esc(c.facility) },
          { label: '정원(타임)', num: true, render: c => { const k = capOf(c); const p = !pin2 && c.facility === '교습소'; if (p) pin2 = true; return '<span title="' + esc(k.tip) + '"' + (p ? h.p(2) + ' class="hqa-ph" style="display:inline-block;padding-top:2px"' : '') + '>' + (k.cap == null ? '-' : k.cap) + '</span>'; } },
          { label: '원장', render: c => esc(c.director) },
          { label: '재원생', num: true, render: c => h.num(c.students) },
          { label: '사용료 단가', render: c => { const f = feeOf(c); const p = !pin6 && f.extra; if (p) pin6 = true; return f.html + (f.extra ? '<span class="hqa-sm' + (p ? ' hqa-ph' : '') + '"' + (p ? h.p(6) + ' style="margin-top:4px"' : '') + '>' + esc(f.extra) + (f.consent ? ' <span class="chip warn" title="계약 조항과 센터 동의를 확인한 뒤에 새 값을 붙여요">동의 확인 전</span>' : '') + '</span>' : ''); } },
          { label: '결제 연동', render: c => esc(c.pay) + (c.type !== '직영' && c.pay === '수기 기록' ? ' ' + h.chip('(안)', 'st-안') : '') },
          { label: '계약 만료', render: c => { if (c.contractEnd === '-' || !c.contractEnd) return '-'; const dl = days(c.contractEnd, s.today); return dl <= 90 ? '<span class="hqa-exp90">' + esc(c.contractEnd) + '</span>' : dl <= 180 ? '<span class="hqa-exp180">' + esc(c.contractEnd) + '</span>' : esc(c.contractEnd); } },
          { label: 'SV', render: c => esc(c.sv) },
        ],
        rows: list,
        rowAttr: c => ' class="click' + (ui.hl === c.id ? ' hqa-new' : '') + '" data-act="HQ04.open" data-arg="' + c.id + '"',
        empty: '조건에 맞는 센터가 없어요. 필터를 바꿔 보세요.',
      });
      html += '<div style="margin-top:12px">' + table + '</div>';
      html += '<div class="hqa-legend">' +
        (pin2 ? '' : '<span class="hqa-ph"' + h.p(2) + '>정원은 본사 기준, 시설 수용, 교습소 9명 중 가장 작은 값</span>') +
        '<span class="hqa-ph"' + h.p(3) + '>사용료 단가는 센터 개별 값, 그룹 값, 기본값 순서로 찾아요 ' + polChips(['POL-01', 'POL-36']) + '</span>' +
        '<span class="hqa-ph"' + h.p(4) + '>행을 누르면 센터 상세(HQ-05) ' + h.polChip('POL-07') + '</span>' +
        (pin6 ? '' : '<span class="hqa-ph"' + h.p(6) + '>예약된 변경과 개별 값 끝나는 날을 단가 아래에 보여 줘요</span>') + '</div>';
      html += '<div class="hqa-pg"><span>‹</span><b>1</b><span>›</span><span class="muted">' + list.length + '곳 중 1~' + list.length + '</span></div>';
      return html;
    },
    mount(root) {
      bindChg(root);
      const q = root.querySelector('[data-field="q"]');
      if (q) q.addEventListener('keydown', e => { if (e.key === 'Enter') { const b = root.querySelector('[data-act="HQ04.search"]'); if (b) b.click(); } });
    },
    prd: {
      summary: '직영, 가맹, 테스트베드 센터를 한 표에 모아 봐요. 센터를 빨리 찾고 정원과 사용료, 계약 만료를 한 번에 확인해요.',
      who: '본사 슈퍼관리자와 운영팀은 보고 고칠 수 있어요. 정산팀과 SV는 보기만 해요. 콘텐츠팀에게는 메뉴가 보이지 않아요.',
      items: [
        { n: 1, t: '검색과 필터', d: '유형(직영, 가맹, 테스트베드), 상태(계획, 승인 대기, 운영, 휴원, 계약 종료), 지역, 담당 SV로 걸러요. 센터명이나 원장명, 사업자번호로도 찾아요. 위쪽 카드를 누르면 같은 조건으로 표가 걸러져요.', pol: ['POL-44'], ref: 'p.22 ①' },
        { n: 2, t: '정원 표시', d: '시설 종류와 수용 인원으로 계산한 한 타임 최대 인원이에요. 교습소는 9명(법정)을 넘을 수 없어요. 본사 기준 15명(안)보다 작은 값이 나오면 그 값이 실제 정원이에요. 숫자에 마우스를 올리면 계산 근거가 보여요.', pol: ['POL-15', 'POL-16'], ref: 'p.22 ②' },
        { n: 3, t: '사용료 단가와 결제 연동', d: '센터 개별 값이 있으면 그 값, 없으면 그룹 값, 그것도 없으면 본사 기본값을 보여 줘요. 직영은 청구서 없이 통계만 내서 내부 대체로 적어요. 결제는 직영이 결제선생, 가맹이 수기 기록(안)이에요.', pol: ['POL-01', 'POL-36'], ref: 'p.22 ③' },
        { n: 4, t: '상세로 이동', d: '줄을 누르면 센터 상세(HQ-05)로 가요. 계약 만료 180일 전(노란색)과 90일 전(빨간색)에는 만료일을 칠해서 눈에 띄게 해요. 180일과 90일은 법정 기간이에요.', pol: ['POL-07'], ref: 'p.22 ④' },
        { n: 5, t: '센터 등록 화면', kind: 'review', imp: 'IMP-12', cond: true, reveal: 'HQ04.newForm', d: '원문에는 등록 버튼만 있고 입력 화면이 없었어요. 직영 센터만 여기서 만들고 첫 상태는 계획이에요. 가맹 센터는 HQ-03에서 계약을 맺어야 생겨요. 같은 이름이나 가맹 센터와 같은 사업자번호가 있으면 저장을 막아요.' },
        { n: 6, t: '다음 값과 개별 값 끝나는 날', kind: 'review', imp: 'IMP-25', d: '예약된 변경(11/1부터 25,000원, 예시)과 개별 값이 끝나는 날을 단가 아래에 작게 보여 줘요. 이미 계약한 센터에는 동의 확인 전 표시를 붙여요. 새 기본값은 계약 조항과 센터 동의를 확인한 곳에만 붙여요.', pol: ['POL-01'] },
        { n: 7, t: '센터 상태 전환 규칙', kind: 'review', imp: 'IMP-12', d: '센터 상태가 언제, 어느 화면에서 바뀌는지 표로 보여 줘요. 목록과 상세에서는 상태를 바로 바꾸지 못하고 정해진 화면(HQ-03, HQ-06, HQ-26)에서만 바뀌어요.' },
      ],
      open: ['센터 상태가 휴원과 계약 종료로 바뀌는 조건', 'SV에게 모든 센터를 보여 줄지 담당 센터만 보여 줄지', '카드 숫자를 상태별로 셀지 유형별로 셀지', '센터 등록 때 꼭 받을 항목'],
    },
  });

  ['type', 'status', 'region', 'sv'].forEach(k => act('HQ04.' + k, (ctx, v) => { ctx.ui[k] = v; }));
  act('HQ04.search', (ctx, arg) => { if (typeof arg === 'string' && arg) ctx.ui.q = arg; ctx.ui.qa = ctx.ui.q || ''; });
  act('HQ04.only', (ctx, v) => { ctx.ui.only = ctx.ui.only === v ? '' : (v || ''); });
  act('HQ04.clear', ctx => { ['only', 'q', 'qa'].forEach(k => { ctx.ui[k] = ''; }); ['type', 'status', 'region', 'sv'].forEach(k => { ctx.ui[k] = '전체'; }); });
  act('HQ04.open', (ctx, id) => openCenter(ctx, id, 'HQ-04'));
  act('HQ04.rules', ctx => { ctx.ui.rules = !ctx.ui.rules; });
  act('HQ04.excel', ctx => { ctx.ui.xl = !ctx.ui.xl; ctx.ui.xlErr = null; });
  act('HQ04.excelSave', (ctx, arg) => excelSave(ctx, arg, '센터 목록'));
  act('HQ04.newForm', ctx => { ctx.ui.form = true; });
  act('HQ04.closeForm', ctx => { ctx.ui.form = false; });
  act('HQ04.save', (ctx, arg) => {
    const ui = ctx.ui, s = ctx.s;
    if (arg && typeof arg === 'object') Object.assign(ui, arg);
    ui.form = true;
    const name = String(ui.f_name || '').trim(), biz = String(ui.f_biz || '').trim();
    ui.f_err_name = !name ? '센터명을 넣어 주세요.' : s.centers.some(c => c.name === name) ? '같은 이름의 센터가 이미 있어요.' : null;
    ui.f_err_region = !String(ui.f_region || '').trim() ? '지역을 넣어 주세요.' : null;
    const other = s.centers.find(c => c.type !== '직영' && c.bizNo === biz);
    ui.f_err_biz = !/^\d{3}-\d{2}-\d{5}$/.test(biz) ? '사업자번호를 000-00-00000 모양으로 넣어 주세요.' : other ? other.name + '의 사업자번호와 같아요. 다른 사업자의 번호로는 직영을 만들 수 없어요.' : null;
    if (ui.f_err_name || ui.f_err_region || ui.f_err_biz) return;
    const id = 'new' + (s.centers.length + 1);
    s.centers.push({
      id, name, type: '직영', status: '계획', facility: ui.f_fac || '학원', rooms: 0, roomCap: 0, facilityCap: 0, timeCap: 0, director: String(ui.f_dir || '').trim() || '-', students: 0,
      pay: '결제선생', fee: '내부 대체', sv: ui.f_sv || '최민호', region: String(ui.f_region).trim(), edu: '-', curfew: '22:00', opened: '-', contractEnd: '-', phone: '-', bizNo: biz,
    });
    ui.hl = id; ui.form = false; ui.type = '전체'; ui.status = '전체'; ui.only = ''; ui.qa = '';
    ['f_name', 'f_region', 'f_dir', 'f_biz'].forEach(k => { ui[k] = ''; });
    say(jo(name, '을', '를') + ' 계획 상태로 만들었어요. 시설 정보는 센터 상세(HQ-05)에서 넣어요.');
  });
})();
