/* HQ-05 센터 상세, HQ-06 운영 개시 승인, HQ-07 정책 현황·변경 이력, HQ-08 시스템 사용료(편집 공통 패턴), HQ-09 가맹금·계약 조건. 원문 p.23~28. */
(function () {
  const B = window.B, h = B.h, esc = B.esc;
  // 클릭으로 부른 동작은 스크롤 위치를 지킨 채 다시 그린다. 데모처럼 el 없이 부르면 엔진에 맡긴다.
  const act = (n, f) => B.action(n, (ctx, arg, el) => { const r = f(ctx, arg, el); if (el && r !== false) { rerender(); return false; } return r; });
  const say = m => B.toast(m);
  const P = n => (n == null ? '' : ' data-pin="' + n + '"');

  /* ---------------- 이 파일 전용 스타일 (.hqb-) ---------------- */
  const CSS = [
    '.hqb-sub{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:-2px 0 12px}',
    '.hqb-sub h2{margin:0;font-size:17px}',
    '.hqb-sub .r{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:12px;color:var(--sub);font-weight:600}',
    '.hqb-form{display:flex;flex-direction:column}',
    '.hqb-fr{display:grid;grid-template-columns:108px minmax(0,1fr);gap:10px;align-items:center;padding:5px 0;border-bottom:1px solid var(--line-2);min-height:40px}',
    '.hqb-fr:last-child{border-bottom:0}',
    '.hqb-fl{font-size:12px;font-weight:700;color:var(--sub)}',
    '.hqb-fl .req{color:var(--brand);margin-left:2px}',
    '.hqb-fv{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;font-size:12.5px}',
    '.hqb-in{display:inline-block;width:auto;min-height:30px;padding:4px 8px}',
    '.hqb-in.xs{width:70px}.hqb-in.s{width:110px}.hqb-in.m{width:160px}.hqb-in.l{width:230px}.hqb-in.xl{width:100%;max-width:400px}',
    '.hqb-opts{display:inline-flex;flex-wrap:wrap;gap:0 2px}',
    '.hqb-o{display:inline-flex;align-items:center;gap:5px;border:0;background:none;padding:3px 6px;border-radius:6px;font-size:12.3px;color:var(--ink);line-height:1.4}',
    '.hqb-o:hover{background:var(--line-2)}',
    '.hqb-o.on{color:var(--navy);font-weight:700}',
    '.hqb-o:disabled{cursor:not-allowed;opacity:.55}',
    '.hqb-o .rd,.hqb-o .cb{width:13px;height:13px;border:1.5px solid #9aa3b2;display:inline-block;position:relative;flex:none}',
    '.hqb-o .rd{border-radius:50%}.hqb-o .cb{border-radius:3px}',
    '.hqb-o.on .rd{border-color:var(--navy)}',
    '.hqb-o.on .rd::after{content:"";position:absolute;inset:2px;border-radius:50%;background:var(--navy)}',
    '.hqb-o.on .cb{background:var(--navy);border-color:var(--navy)}',
    '.hqb-o.on .cb::after{content:"";position:absolute;left:3px;top:0;width:4px;height:7px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}',
    '.hqb-var{display:inline-block;font-size:10px;font-weight:700;color:#fff;background:var(--navy);border-radius:4px;padding:0 5px;line-height:16px}',
    '.hqb-note{font-size:11.5px;color:var(--mute);line-height:1.5}',
    '.hqb-err{color:var(--bad);font-size:11.5px;font-weight:600;width:100%}',
    '.hqb-rv{border:1px dashed #c9b6f2;background:#fbf9ff;border-radius:9px;padding:10px 12px;font-size:12.3px;color:#3d2a7a;line-height:1.55}',
    '.hqb-rv h4{margin:0 0 6px;font-size:12.5px;color:var(--review);display:flex;gap:6px;align-items:center;flex-wrap:wrap}',
    '.hqb-rv .hqb-tw{margin-top:6px}',
    '.hqb-tw{border:1px solid var(--line);border-radius:9px;background:#fff}',
    '.hqb-tw .tbl th:first-child{border-top-left-radius:9px}.hqb-tw .tbl th:last-child{border-top-right-radius:9px}',
    '.hqb-tw .tbl td{padding:7px 10px}',
    '.hqb-tw th span[data-pin]{display:inline-block}',
    '.hqb-tw tr.click{cursor:pointer}.hqb-tw tr.click:hover td{background:#fafbfc}',
    '.hqb-tw tr.sel td{background:#f3f6fd}',
    '.hqb-tw tr.off td{color:var(--mute)}',
    '.hqb-mini .tbl td,.hqb-mini .tbl th{padding:5px 8px;font-size:11.8px}',
    '.hqb-map{border:1.5px dashed #c9ced8;border-radius:9px;min-height:84px;display:grid;place-items:center;text-align:center;color:var(--mute);font-size:12px;padding:12px;background:#fafbfc;margin-top:10px}',
    '.hqb-blue{color:var(--navy);font-weight:600}',
    '.hqb-next{font-size:11px;color:var(--info);font-weight:700;white-space:nowrap}',
    '.hqb-k5{display:grid;gap:10px;grid-template-columns:repeat(5,minmax(0,1fr))}',
    '.hqb-k5 .kpi{cursor:pointer}',
    '.hqb-k5 .kpi.on{border-color:var(--navy);box-shadow:0 0 0 2px var(--navy-soft)}',
    '.hqb-k5 .kpi.rv{border-color:#c9b6f2;background:#fbf9ff}',
    '.hqb-filter{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}',
    '.hqb-filter label{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--sub)}',
    '.hqb-itabs{margin-bottom:10px}',
    '.hqb-itabs button .n{font-size:11px;color:var(--mute);font-weight:600}',
    '.hqb-pager{display:flex;gap:4px;justify-content:center;margin-top:10px}',
    '.hqb-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
    '.hqb-cols{display:grid;gap:12px;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);align-items:start}',
    '.hqb-dirty{font-size:11px;font-weight:700;color:var(--warn);background:var(--warn-soft);border-radius:6px;padding:2px 8px}',
    '.hqb-sum{display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap}',
    '.hqb-cap{font-size:15px;font-weight:800}',
    '.hqb-box{border:1px solid var(--line);border-radius:9px;padding:10px 12px;background:#fafbfc}',
    '.hqb-box h4{margin:0 0 8px;font-size:12.5px}',
    '.hqb-st{display:inline-flex;align-items:center;border-radius:999px;padding:1px 9px;font-size:11.5px;font-weight:700;border:1px solid var(--line);background:#fff;white-space:nowrap}',
    '.hqb-st.ok{background:#3b4352;border-color:#3b4352;color:#fff}',
    '.hqb-st.wait{border-style:dashed;color:var(--sub)}',
    '.hqb-st.bad{border-color:#f0b4ad;color:var(--bad);background:#fff8f7}',
    '.hqb-st.na{color:var(--mute);background:var(--gray-soft);border-color:transparent}',
    '.hqb-big{font-size:13.5px;font-weight:800}',
    '.hqb-grid2{display:grid;gap:12px;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}',
    '.hqb-tw td [data-pin],.hqb-tw th [data-pin]{padding-left:14px}',
    '.hqb-sum[data-pin],.hqb-pinpad{padding-left:14px}',
    '.hqb-fr[data-pin] > .hqb-fl{padding-left:14px}',
    '.hqb-itabs button[data-pin]{padding-left:18px}',
    '.hqb-cols .field[data-pin] > label{padding-left:14px}',
    '.hqb-snap{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 12px;margin-top:6px}',
    '.hqb-snap > div{background:#fff;border:1px solid #e3dafb;border-radius:7px;padding:5px 9px;display:flex;justify-content:space-between;gap:8px;font-size:12px}',
    '.hqb-snap span{color:var(--sub)}',
    '.hqb-tw tr.exp > td{background:#f7f9fe;padding:10px 12px}',
    '.hqb-stack{display:flex;flex-direction:column;gap:12px;min-width:0}',
    '.hqb-nw{white-space:nowrap}',
  ].join('\n');
  (function inject() {
    if (typeof document === 'undefined' || document.getElementById('hqb-css')) return;
    const el = document.createElement('style'); el.id = 'hqb-css'; el.textContent = CSS; (document.head || document.body).appendChild(el);
  })();

  /* ---------------- 작은 도구 ---------------- */
  const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const toN = v => { const t = String(v == null ? '' : v).replace(/[^\d.\-]/g, ''); return t === '' ? NaN : Number(t); };
  const won = n => (isNaN(n) ? '-' : Number(n).toLocaleString('ko-KR') + '원');
  const comma = n => (isNaN(n) ? '-' : Number(n).toLocaleString('ko-KR'));
  const md = d => { const m = /(\d{4})-(\d\d)-(\d\d)/.exec(d || ''); return m ? (+m[2]) + '/' + (+m[3]) : String(d || ''); };
  const okDate = d => /^\d{4}-\d\d-\d\d$/.test(String(d || '')) && !isNaN(new Date(d + 'T00:00:00').getTime());
  const days = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
  const addDays = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  // 받침에 따라 '으로/로'
  function ro(word) {
    const t = String(word == null ? '' : word).replace(/[\s)\]]+$/, ''), ch = t.slice(-1);
    if (!ch) return '로';
    const c = ch.charCodeAt(0);
    if (c >= 0xac00 && c <= 0xd7a3) { const j = (c - 0xac00) % 28; return j === 0 || j === 8 ? '로' : '으로'; }
    if (/[0-9]/.test(ch)) return '036'.indexOf(ch) >= 0 ? '으로' : '로';
    return '로';
  }
  const chg = (from, to) => from + '에서 ' + to + ro(to);
  function jo(word, a, b) { const t = String(word || '').replace(/[\s)\]]+$/, ''), c = t.slice(-1).charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? a : b; }
  const eul = w => w + jo(w, '을', '를'), eun = w => w + jo(w, '은', '는');
  function iga(word) { const t = String(word || '').replace(/[\s)\]]+$/, ''), c = t.slice(-1).charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? '이' : '가'; }
  function getPath(o, path) { let t = o; for (let i = 0; i < path.length; i++) { if (t == null) return undefined; t = t[path[i]]; } return t; }
  function setPath(o, path, v) {
    let t = o;
    for (let i = 0; i < path.length - 1; i++) { if (t[path[i]] == null) t[path[i]] = {}; t = t[path[i]]; }
    const k = path[path.length - 1];
    if (v === undefined) delete t[k]; else t[k] = clone(v);
  }
  const undoItem = (s, store, path) => ({ store, path, prev: clone(getPath(store === 'pol' ? s.pol : s[store], path)) });
  function undoApply(s, items) { (items || []).forEach(u => { const root = u.store === 'pol' ? s.pol : s[u.store]; if (root) setPath(root, u.path, u.prev); }); }
  function who(ctx) { return { by: ctx.persona.name, role: ctx.persona.side === 'hq' ? ({ '슈퍼관리자': '슈퍼관리자', '운영': '운영팀', '정산': '정산팀', '콘텐츠': '콘텐츠팀', 'SV': 'SV' })[ctx.role] || ctx.role : ctx.role }; }
  function audit(ctx, what, target, reason) { ctx.s.audit.unshift({ at: ctx.today.slice(5) + ' 방금', who: ctx.persona.name + ' (본사 ' + ctx.role + ')', what, target, reason: reason || '-' }); }
  let SEQ = 0;
  function polHist(ctx, code, e) {
    const p = ctx.s.pol[code] = ctx.s.pol[code] || {};
    p.history = p.history || [];
    p.history.push(Object.assign({ date: ctx.today, n: 1, seq: ++SEQ }, who(ctx), e));
  }
  const opCount = s => s.centers.filter(c => c.status !== '계획').length;
  const frCenters = s => s.centers.filter(c => c.type !== '직영' && c.status === '운영');
  const varChip = () => '<span class="hqb-var">가변</span>';
  const stLabel = st => (st === '안' ? '미확정(안)' : st || '-');
  const stChip = st => h.chip(stLabel(st), st === '확정' ? 'ok' : 'st-' + st);
  const statusOf = code => ((B.store.pol || {})[code] || {}).status || h.pol(code).status;
  const errLine = t => (t ? '<div class="hqb-err">' + esc(t) + '</div>' : '');

  function form(rows) {
    return '<div class="hqb-form">' + rows.filter(Boolean).map(r => '<div class="hqb-fr"' + P(r.pin) + '><div class="hqb-fl">' + esc(r.l) + (r.req ? '<span class="req">*</span>' : '') + '</div><div class="hqb-fv">' + r.v + '</div></div>').join('') + '</div>';
  }
  function tbl(cols, rows, o) {
    o = o || {};
    const head = '<tr>' + cols.map(c => '<th' + (c.num ? ' class="num"' : '') + (c.w ? ' style="width:' + c.w + '"' : '') + '>' + (c.raw ? c.label : esc(c.label)) + '</th>').join('') + '</tr>';
    const body = rows.length
      ? rows.map(r => r.full != null ? '<tr' + (r.attr || '') + '><td colspan="' + cols.length + '">' + r.full + '</td></tr>' : '<tr' + (r.attr || '') + '>' + r.cells.map((x, i) => '<td' + (cols[i] && cols[i].num ? ' class="num"' : '') + '>' + x + '</td>').join('') + '</tr>').join('')
      : '<tr><td colspan="' + cols.length + '"><div class="empty" style="border:0;padding:14px">' + esc(o.empty || '아직 없어요.') + '</div></td></tr>';
    return '<div class="hqb-tw' + (o.cls ? ' ' + o.cls : '') + '"' + P(o.pin) + '><table class="tbl"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
  }
  function radio(list, cur, o) {
    o = o || {};
    return '<span class="hqb-opts">' + list.map(x => {
      const v = typeof x === 'string' ? x : x.v, l = typeof x === 'string' ? x : x.l, dis = o.dis || (typeof x === 'object' && x.dis);
      return '<button type="button" class="hqb-o' + (String(v) === String(cur) ? ' on' : '') + '"' + (dis ? ' disabled' : ' data-act="' + esc(o.act) + '" data-arg="' + esc((o.prefix || '') + v) + '"') +
        (typeof x === 'object' && x.title ? ' title="' + esc(x.title) + '"' : '') + '><i class="rd"></i>' + esc(l) + '</button>';
    }).join('') + '</span>';
  }
  function check(on, label, o) {
    o = o || {};
    return '<button type="button" class="hqb-o' + (on ? ' on' : '') + '"' + (o.dis ? ' disabled' : ' data-act="' + esc(o.act) + '" data-arg="' + esc(o.arg) + '"') + '><i class="cb"></i>' + esc(label) + '</button>';
  }
  function inp(field, value, o) {
    o = o || {};
    return '<input class="inp hqb-in ' + (o.size || 'm') + (o.err ? ' bad' : '') + '" type="' + (o.type || 'text') + '" data-field="' + esc(field) + '" value="' + esc(value == null ? '' : value) + '"' +
      (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.live ? ' data-live="1"' : '') + (o.dis ? ' disabled' : '') + ' aria-label="' + esc(o.label || field) + '">';
  }
  function sel(field, value, options, o) {
    o = o || {};
    return '<select class="inp hqb-in ' + (o.size || 'm') + '" data-field="' + esc(field) + '"' + (o.live ? ' data-live="sel"' : '') + (o.dis ? ' disabled' : '') + ' aria-label="' + esc(o.label || field) + '">' +
      options.map(x => { const v = typeof x === 'string' ? x : x.v, l = typeof x === 'string' ? x : x.l; return '<option value="' + esc(v) + '"' + (String(v) === String(value) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>';
  }
  const rvBox = (title, imp, body, pin, style) => '<div class="hqb-rv"' + P(pin) + (style ? ' style="' + style + '"' : '') + '><h4>' + esc(title) + B.impChip(imp) + '</h4>' + body + '</div>';

  /* 선택 상자와 입력 칸을 고르면 바로 다시 그린다 (입력 중에는 잠깐 쉬었다가) */
  const LIVE_HOOK = {};
  let liveTimer = null;
  function rerender() {
    const m = document.querySelector('#app .main'), top = m ? m.scrollTop : 0;
    B.render();
    const m2 = document.querySelector('#app .main'); if (m2) m2.scrollTop = top;
  }
  function mountLive(root) {
    const uiNow = () => (B.store.ui[B.state.screenId] = B.store.ui[B.state.screenId] || {});
    root.querySelectorAll('[data-live="sel"]').forEach(el => el.addEventListener('change', () => {
      const f = el.getAttribute('data-field'), u = uiNow();
      u[f] = el.value;
      const hook = LIVE_HOOK[B.state.screenId + ':' + f]; if (hook) hook(u, el.value);
      rerender();
    }));
    root.querySelectorAll('[data-live="1"]').forEach(el => el.addEventListener('input', () => {
      const f = el.getAttribute('data-field'); uiNow()[f] = el.value;
      clearTimeout(liveTimer);
      liveTimer = setTimeout(() => {
        if (document.activeElement !== el) return;
        let pos = null; try { pos = el.selectionStart; } catch (e) { pos = null; }
        rerender();
        const n = document.querySelector('#app [data-field="' + f + '"]');
        if (n) { n.focus(); try { if (pos != null) n.setSelectionRange(pos, pos); } catch (e) { /* number input */ } }
      }, 450);
    }));
  }

  /* =====================================================================
     예시 데이터
     ===================================================================== */
  B.extend(s => {
    // 동탄센터: 원문 p.19, p.22, p.25 예시의 직영 승인 대기 센터
    if (!s.centers.some(c => c.id === 'dongtan')) {
      s.centers.push({ id: 'dongtan', name: '동탄센터', type: '직영', status: '승인 대기', facility: '학원', rooms: 2, roomCap: 12, facilityCap: 24, timeCap: 15, director: '한소윤', students: 0, pay: '결제선생', fee: '내부 대체', sv: '최민호', region: '경기 화성시', edu: '화성오산교육지원청', curfew: '22:00', opened: '-', contractEnd: '-', phone: '031-8015-0180', bizNo: '120-81-00180' });
    }
    [
      { id: 'st20', center: 'dongtan', name: '한소윤', role: '원장', check: '2027-02-20', twoFactor: true, phone: '010-5102-1801', status: '활성', notified: '-' },
      { id: 'st21', center: 'dongtan', name: '강민지', role: '교사', check: '2027-02-22', twoFactor: false, phone: '010-5102-1802', status: '잠김 (운영 개시 전)', notified: '2027-02-23' },
      { id: 'st22', center: 'dongtan', name: '오하린', role: '보조교사', check: '', twoFactor: false, phone: '010-5102-1803', status: '잠김 (경력 조회 전)', notified: '-' },
      // 인천송도센터: 2027-10-04 계약(HQ-03) 뒤 오픈을 준비하는 가맹 센터. 원장과 실장은 경력 조회를 마쳤다 (예시)
      { id: 'st23', center: 'incheon', name: '윤가람', role: '원장', check: '2027-10-05', twoFactor: true, phone: '010-6203-1801', status: '잠김 (운영 개시 전)', notified: '2027-10-06' },
      { id: 'st24', center: 'incheon', name: '조은솔', role: '실장·데스크', check: '2027-10-06', twoFactor: false, phone: '010-6203-1802', status: '잠김 (운영 개시 전)', notified: '-' },
    ].forEach(x => { if (!s.staff.some(y => y.id === x.id)) s.staff.push(x); });
    // 교직원 계정(CT-20)이 같은 사람을 같은 구분으로 보이게 한다. 이미 있는 값은 건드리지 않는다
    if (s.ct20 && s.ct20.meta) {
      if (!s.ct20.meta.st23) s.ct20.meta.st23 = { legal: '교습자', docs: true, edu: '이수', agency: '관할 경찰서', clear: true };
      if (!s.ct20.meta.st24) s.ct20.meta.st24 = { legal: '직원', docs: false, edu: '이수', agency: '관할 경찰서', clear: true };
    }

    s.hq05 = s.hq05 || {
      info: {
        daegu: { owner: '정민재', addr: '대구 수성구 ○○로 00, 3층', area: '82㎡', subject: '독서·논술 (예시)', eduNo: '제○○호', methods: { 카드: true, 계좌: true, 현금: true, 지역화폐: true }, alim: '브레인180 대구수성 (심사 완료)', kiosks: 2 },
        busan: { owner: '최하은', addr: '부산 해운대구 ○○로 00, 2층', area: '', subject: '독서·논술 (예시)', eduNo: '제○○호', methods: { 카드: true, 계좌: true, 현금: true, 지역화폐: false }, alim: '브레인180 부산해운대 (심사 완료)', kiosks: 2 },
        dongtan: { owner: 'MSC Brain (본사 직영)', addr: '경기 화성시 ○○로 00, 2층', area: '', subject: '독서·논술 (예시)', eduNo: '제○○호', methods: { 카드: true, 계좌: true, 현금: true, 지역화폐: false }, alim: '브레인180 동탄 (심사 중)', kiosks: 2 },
      },
      contract: {
        daegu: { ver: '표준 v1', given: '2027-05-06', signed: '2027-05-24', start: '2027-06-14', status: '유효', snap: { fee: '5,000,000원 (납부)', term: '3년', radius: '1,000m', royalty: '20,000원 (예시)' }, amends: [] },
        busan: { ver: '표준 v1', given: '2027-04-28', signed: '2027-05-17', start: '2027-06-01', status: '유효', snap: { fee: '면제 (테스트베드, 안)', term: '3년', radius: '1,000m', royalty: '18,000원 (개별 특가)' }, amends: [{ date: '2027-05-20', item: '사용료 단가', from: '20,000원 (예시)', to: '18,000원', doc: '부속합의서 #3' }] },
      },
      fees: {
        daegu: [{ name: '가맹비', amount: '5,000,000원', how: '납부 2027-05-24', escrow: '예치, 개업 뒤 해제', paid: true }, { name: '교육비', amount: '', how: '-', escrow: '-' }, { name: '보증금', amount: '', how: '-', escrow: '-' }],
        busan: [{ name: '가맹비', amount: '0원', how: '면제 (테스트베드 그룹, 안)', escrow: '-', exempt: true }, { name: '교육비', amount: '', how: '-', escrow: '-' }, { name: '보증금', amount: '', how: '-', escrow: '-' }],
      },
      entrust: {
        daegu: { signed: '2027-05-24', consent: {} },
        busan: { signed: '2027-05-17', consent: { 알림톡: { date: '2027-05-17', how: '서면' } } },
      },
      checked: {},
    };

    // 가맹 계약 만료일은 원문 예시를 따른다. 대구수성 2030-06-13 (p.22, p.24, p.44), 부산해운대 2030-05-31 (p.22).
    // 기본 데이터는 2032-09-30이라 센터 목록(HQ-04)과 갱신(HQ-26)이 서로 다른 날짜를 보였다.
    [['daegu', '2030-06-13'], ['busan', '2030-05-31']].forEach(([id, end]) => { const c = s.centers.find(x => x.id === id); if (c && c.contractEnd === '2032-09-30') c.contractEnd = end; });

    s.hq06 = s.hq06 || {
      cases: {
        dongtan: {
          docs: {
            biz: { st: '승인', file: '사업자등록증.pdf', by: '홍길동', at: '2027-03-02' },
            reg: { st: '승인', file: '학원등록증.pdf', by: '홍길동', at: '2027-03-03' },
            fee: { st: '검토 중', file: '교습비등록내역.pdf', at: '2027-03-05' },
            ins: { st: '대기' }, ent: { st: '대기' }, staff: {}, post: { st: '미제출' },
            kiosk: { st: '완료' }, pay: { st: '완료', note: 'KP-DT0180' }, alim: { st: '심사 중' },
          },
          fees: [{ p: 'pr1', edu: 280000, price: 260000 }, { p: 'pr2', edu: 360000, price: 360000 }, { p: 'pr3', edu: null, price: 150000 }],
          request: null, approvedAt: '', approvedBy: '', sel: 'fee',
        },
      },
    };

    s.hq08 = s.hq08 || { basis: '학습 계정 활성 수', mid: '전액', out: '반환 없음', pay: '후불', billDay: '5', due: '15', od1: '7', od2: '15', od3: '30', next: {}, notice: null, consent: {} };
    s.hq09 = s.hq09 || {
      fees: [
        { id: 'fee', name: '가맹비', amount: '5,000,000', st: '안', exempt: '테스트베드 그룹 면제 (안)', escrow: true, disc: true, note: '10/14 회의, 보통 500만 원선' },
        { id: 'edu', name: '교육비', amount: '', st: '미정', exempt: '-', escrow: true, disc: true, note: '원장과 교사 초기 교육' },
        { id: 'dep', name: '보증금', amount: '', st: '미정', exempt: '-', escrow: true, disc: true, note: '계약 종료 시 반환' },
      ],
      term: '5', a180: true, a90: true,
      terr: { basis: '반경', radius: '1,000', overlap: '경고', incDirect: true, incPlan: true },
      items: [
        { id: 'i1', name: '주간 교재 인쇄본', kind: '필수', how: '인쇄 원가 + N% (미정)', contract: '예' },
        { id: 'i2', name: '학습 패드', kind: '권장', how: 'POL-38 결정 후', contract: '예' },
        { id: 'i3', name: '홍보물', kind: '권장', how: '실비', contract: '-' },
      ],
      next: {}, todos: [],
    };

    // 정책 저장소 예시 (원문 p.24, p.26, p.27). 기존 값은 지우지 않고 빈 곳만 채운다.
    const pol = s.pol;
    const P01 = pol['POL-01'] = pol['POL-01'] || {};
    P01.history = P01.history || [];
    if (!P01.history.some(x => x.seed === 'busan')) P01.history.push({ seed: 'busan', date: '2027-05-20', at: '16:40', from: '20,000원 (예시)', to: '18,000원 (부산해운대 개별)', text: '부산해운대 개별 값 18,000원 등록 (2028-03-31까지)', scope: '센터', by: '이수민', role: '정산팀', reason: '부속합의서 #3', n: 1 });
    if (P01.reserved && !P01.reserved.full) P01.reserved.full = '2027-11-01';
    const P27 = pol['POL-27'] = pol['POL-27'] || {};
    P27.history = P27.history || [];
    if (!P27.history.some(x => x.seed)) P27.history.push({ seed: 1, date: '2027-09-14', at: '10:12', from: '프로모션가 30,000원', to: '12/31 종료 예약', text: '프로모션가 30,000원을 12/31에 끝내도록 예약', scope: '기본값', by: '홍길동', role: '운영팀', reason: '9/10 경영회의', n: 7 });
    if (!P27.reserved) P27.reserved = { date: '1/1', full: '2028-01-01', value: '프로모션 종료' };
    const P44 = pol['POL-44'] = pol['POL-44'] || {};
    P44.history = P44.history || [];
    if (!P44.history.some(x => x.seed)) P44.history.push({ seed: 1, date: '2027-01-20', at: '09:05', from: '-', to: '테스트베드 그룹', text: '테스트베드 그룹 생성, 가맹비 면제(안)', scope: '그룹', by: '정본부', role: '슈퍼관리자', reason: '10/14 회의', n: 1 });
    const P04 = pol['POL-04'] = pol['POL-04'] || {}; P04.centers = P04.centers || {};
    if (!P04.centers.daegu) P04.centers.daegu = { value: '후불, 5일 청구, 20일 기한', short: '20일', status: '예시', reason: '자동이체일 협의, 부속합의서', until: '' };
    const P34 = pol['POL-34'] = pol['POL-34'] || {}; P34.centers = P34.centers || {};
    if (!P34.centers.daegu) P34.centers.daegu = { value: '6원, 선불 충전', short: '6원', status: '예시', reason: '대량 발송 협의', until: '' };
    const P16 = pol['POL-16'] = pol['POL-16'] || {}; P16.centers = P16.centers || {};
    if (!P16.centers.daegu) P16.centers.daegu = { value: '12명', status: '예시', reason: '센터가 상한 안에서 정한 값 (예시)' };
    // 처음부터 있던 이력은 예시 기록으로 표시한다 (방금 바꾼 기록과 구분)
    Object.keys(pol).forEach(code => (pol[code].history || []).forEach(e => { if (!e.seed) e.seed = 'base'; }));
  });

  /* =====================================================================
     HQ-05 센터 상세 (p.23 기본·시설, p.24 계약·영업지역·개별 정책)
     ===================================================================== */
  const BASE_SHORT = { 'POL-01': '20,000원 (예시)', 'POL-04': '15일', 'POL-16': '15명 (안)', 'POL-34': '7원 (안)' };
  const POL_NAME = { 'POL-01': '사용료 단가', 'POL-04': '납부기한', 'POL-16': '타임당 정원', 'POL-34': '알림톡 단가' };
  const CONTRACT_POL = ['POL-01', 'POL-02', 'POL-03', 'POL-04', 'POL-05', 'POL-06', 'POL-07', 'POL-08', 'POL-09'];
  const F5 = ['f_name', 'f_addr', 'f_eduNo', 'f_subject', 'f_area', 'f_cap', 'f_fac', 'f_sv', 'f_methods'];

  function c5(ctx) {
    let id = ctx.ui.center;
    if (!id || !B.center(id)) { id = 'daechi1'; ctx.ui.center = id; }
    return B.center(id);
  }
  function info5(s, c) {
    const I = s.hq05.info;
    if (!I[c.id]) {
      const plan = c.status === '계획';
      I[c.id] = { owner: c.type === '직영' ? 'MSC Brain (본사 직영)' : String(c.director || '').replace(' (예정)', ''), addr: c.region + ' ○○로 00', area: '', subject: '독서·논술 (예시)', eduNo: plan ? '' : '제○○호', methods: { 카드: true, 계좌: true, 현금: true, 지역화폐: false }, alim: plan ? '등록 전' : '브레인180 ' + c.name.replace('센터', '') + ' (심사 완료)', kiosks: plan ? 0 : 2 };
    }
    return I[c.id];
  }
  const kioskN = (s, c, I) => { const d = s.ct19 && s.ct19.centers && s.ct19.centers[c.id]; return d && d.devices ? d.devices.length : I.kiosks; };
  const staffOf = (s, c) => s.staff.filter(x => x.center === c.id && !/퇴사/.test(x.status));
  const staffText = list => ['원장', '실장·데스크', '교사', '보조교사'].map(r => [r, list.filter(x => x.role === r).length]).filter(x => x[1]).map(x => x[0] + ' ' + x[1]).join(', ') || '등록 전';
  const maskTel = t => (t && t !== '-' ? String(t).replace(/^(\d{2,3})-(\d{3,4})-(\d{4})$/, '$1-***-****') : '-');
  const maskBiz = b => (b && b !== '-' ? String(b).replace(/(\d{3}-\d{2}-)\d{5}$/, '$1*****') : '-');
  function capInfo(c, fac, facCap) {
    const pv = h.polValue('POL-16', c);
    const base = parseInt(String(pv.value), 10) || 15;
    const own = pv.from === '개별 센터';
    const terms = [[own ? '센터 값' : '본사', base, own ? '' : '(안)'], ['수용', facCap]];
    if (fac === '교습소') terms.push(['교습소', 9]);
    const cap = Math.min.apply(null, terms.map(t => t[1]));
    return { cap, terms, slotCap: fac === '교습소' ? Math.min(9, facCap) : facCap };
  }
  function slots(s, c, slotCap) {
    const m = {}, order = [];
    s.classes.filter(k => k.center === c.id).forEach(k => {
      const key = k.days + ' ' + k.time;
      if (!m[key]) { m[key] = { key, list: [], sum: 0 }; order.push(key); }
      m[key].list.push(k); m[key].sum += k.enrolled;
    });
    return order.map(k => Object.assign(m[k], { over: m[k].sum > slotCap }));
  }
  function typeDiff(s, from, to) {
    const out = [];
    Object.keys(s.pol).sort().forEach(code => {
      const g = s.pol[code].groups || {}, a = g[from], b = g[to];
      if ((a && a.value) !== (b && b.value)) out.push({ code, from: a ? a.value : '기본값 따름', to: b ? b.value : '기본값 따름' });
    });
    return out;
  }
  function contract5(s, c) {
    if (s.hq05.contract[c.id]) return s.hq05.contract[c.id];
    if (c.type === '직영') return null;
    const cases = s.hq03 && s.hq03.cases ? Object.keys(s.hq03.cases).map(k => s.hq03.cases[k]) : [];
    const cs = cases.find(x => x.center === c.id);
    if (cs) return { ver: (cs.contract && cs.contract.version) || '표준 v1', given: (cs.contract && cs.contract.given) || '-', signed: cs.signed ? cs.signedAt : '', status: cs.signed ? '유효' : '체결 전', gate: true };
    return { ver: '표준 v1', given: '-', signed: '', status: '체결 전', gate: true };
  }
  function signedViaGate(s, c) {
    const K = contract5(s, c);
    return !!(K && K.signed);
  }
  const dirty5 = ui => F5.some(k => ui[k] != null);
  function reset5(ui) {
    F5.concat(['e_name', 'e_eduNo', 'e_cap', 'typeTo', 'typeReason', 'e_type', 'e_req', 'indOpen', 'amOpen', 'conOpen', 'e_ind', 'e_am', 'e_con']).forEach(k => { delete ui[k]; });
  }
  LIVE_HOOK['HQ-05:center'] = u => reset5(u);

  function typeBox(ctx, c) {
    const ui = ctx.ui, to = ui.typeTo, from = c.type;
    const cross = (from === '직영') !== (to === '직영');
    if (cross) {
      return '<div style="margin-top:10px">' + h.alert(from + '에서 ' + to + ro(to) + ' 바꾸려면 정보공개서와 계약 게이트(HQ-03)를 거쳐야 해요. 이 화면에서는 바꿀 수 없어요. 원생 정보 처리자도 바뀌어서 보호자에게 알리고 다시 동의를 받아야 해요.', 'warn', { title: '유형 변경' }) +
        '<div class="hqb-actions" style="margin-top:8px">' + h.btn('HQ-03 열기', { sm: true, go: 'HQ-03' }) + h.btn('취소', { sm: true, act: 'HQ05.typeCancel' }) + '</div></div>';
    }
    const diff = typeDiff(ctx.s, from, to);
    return '<div class="hqb-box" style="margin-top:10px"><h4>유형을 ' + esc(to) + ro(to) + ' 바꾸면 달라지는 정책 ' + diff.length + '개</h4>' +
      (diff.length ? tbl([{ label: '정책' }, { label: '지금 (' + from + ')' }, { label: '바뀐 뒤 (' + to + ')' }], diff.map(d => ({ cells: [h.polChip(d.code) + ' ' + esc(h.pol(d.code).name), esc(d.from), '<b>' + esc(d.to) + '</b>'] })), { cls: 'hqb-mini' }) : '<div class="hqb-note">그룹 값이 같아서 달라지는 정책이 없어요.</div>') +
      '<div class="hqb-note" style="margin-top:6px">이미 맺은 계약 값은 바뀌지 않아요. 계약·영업지역 탭에서 계약한 날 값을 확인해요.</div>' +
      '<div class="hqb-fv" style="margin-top:8px">' + inp('typeReason', ui.typeReason || '', { size: 'xl', ph: '바꾸는 사유와 근거 문서', err: ui.e_type, label: '유형 변경 사유' }) + errLine(ui.e_type) + '</div>' +
      '<div class="hqb-actions" style="margin-top:8px">' + h.btn('유형 바꾸기', { sm: true, primary: true, act: 'HQ05.typeApply' }) + h.btn('취소', { sm: true, act: 'HQ05.typeCancel' }) + '</div></div>';
  }

  function tab5a(ctx, c) {
    const s = ctx.s, ui = ctx.ui, ro5 = !ctx.canEdit, I = info5(s, c);
    const fac = ui.f_fac || c.facility;
    const facCap = ui.f_cap != null && ui.f_cap !== '' ? (parseInt(ui.f_cap, 10) || 0) : c.facilityCap;
    const ci = capInfo(c, fac, facCap);
    const methods = Object.assign({}, I.methods, ui.f_methods || {});
    const region = String(c.region || '').split(' ')[0];
    const statusBtn = c.status === '계획' ? h.btn('운영 개시 승인 요청', { sm: true, primary: true, act: 'HQ05.reqOpen', disabled: ro5 })
      : c.status === '승인 대기' ? h.btn('승인 화면 열기', { sm: true, act: 'HQ05.toOpen' }) : '';
    const basic = h.card({
      title: '기본 정보',
      body: form([
        { l: '센터명', req: true, v: inp('f_name', ui.f_name != null ? ui.f_name : c.name, { size: 'l', dis: ro5, err: ui.e_name, label: '센터명' }) + errLine(ui.e_name) },
        { l: '센터 유형', req: true, pin: 1, v: radio(['직영', '가맹', '테스트베드'], ui.typeTo || c.type, { act: 'HQ05.type', dis: ro5 }) + h.polChip('POL-44') },
        { l: '상태', pin: 6, v: h.status(c.status) + '<span class="hqb-note">운영 개시 승인(HQ-06)으로만 바뀌어요</span>' + statusBtn + errLine(ui.e_req) },
        { l: '사업자등록번호', v: '<span class="mono">' + esc(maskBiz(c.bizNo)) + '</span>' },
        { l: '대표자', v: esc(I.owner) },
        { l: '주소', v: inp('f_addr', ui.f_addr != null ? ui.f_addr : I.addr, { size: 'xl', dis: ro5, label: '주소' }) },
        { l: '연락처', v: '<span class="mono">' + esc(maskTel(c.phone)) + '</span>' },
      ]) + (ui.typeTo ? typeBox(ctx, c) : ''),
    });
    const capHTML = '<span class="hqb-cap">' + ci.cap + '명</span><span class="hqb-note">= min(' + ci.terms.map(t => t[0] + ' ' + t[1] + (t[2] || '')).join(', ') + ')</span>' + varChip();
    let facWarn = '';
    if (fac === '교습소') {
      const st = staffOf(s, c), teach = st.filter(x => x.role === '교사' || x.role === '실장·데스크').length, asst = st.filter(x => x.role === '보조교사').length;
      facWarn = '<div style="margin-top:8px">' + h.alert('교습소는 교습자 1명과 보조요원 1명까지예요. 지금 원장 말고 교사·실장 ' + teach + '명, 보조교사 ' + asst + '명이 있어요. 저장하면 교직원 화면(CT-20)에 이 제한이 걸려요.', teach > 0 || asst > 1 ? 'warn' : 'info', { title: '교습소' }) + '</div>';
    }
    const facility = h.card({
      title: '시설·정원', pin: 2, right: h.polChip('POL-15') + h.polChip('POL-16'),
      body: form([
        { l: '시설 유형', req: true, v: radio(['학원', '교습소'], fac, { act: 'HQ05.fac', dis: ro5 }) },
        { l: '교육청 등록번호', req: true, pin: 3, v: inp('f_eduNo', ui.f_eduNo != null ? ui.f_eduNo : I.eduNo, { size: 's', ph: '제○○호', dis: ro5, err: ui.e_eduNo, label: '교육청 등록번호' }) + '<span class="hqb-note">' + esc(c.edu) + '</span>' + h.polChip('POL-17') + errLine(ui.e_eduNo) },
        { l: '교습과목', v: inp('f_subject', ui.f_subject != null ? ui.f_subject : I.subject, { size: 'm', dis: ro5, label: '교습과목' }) },
        { l: '면적·강의실', v: inp('f_area', ui.f_area != null ? ui.f_area : I.area, { size: 'xs', ph: '㎡', dis: ro5, label: '면적' }) + '<span>' + c.rooms + '실</span>' },
        { l: '일시수용능력', v: inp('f_cap', facCap, { size: 'xs', type: 'number', live: true, dis: ro5, err: ui.e_cap, label: '일시수용능력' }) + '<span>명</span><span class="hqb-note">등록증 기준</span>' + errLine(ui.e_cap) },
        { l: '정원 상한', v: capHTML },
        { l: '교습시간 상한', v: '<b class="mono">' + esc(c.curfew) + '</b>' + varChip() + '<span class="hqb-note">' + esc(region) + ' 조례 값 (예시)</span>' },
      ]) + facWarn,
    });
    const ops = h.card({
      title: '운영·연동', pin: 4, right: h.polChip('POL-36') + h.polChip('POL-37'),
      body: form([
        { l: '결제 연동', v: esc(c.pay) + ' ' + h.chip('(안)', 'st-안') + varChip() + '<span class="hqb-note">' + (c.type === '직영' ? '직영 기본값' : '가맹 기본값') + '</span>' },
        { l: '수납 수단', v: ['카드', '계좌', '현금', '지역화폐'].map(m => check(methods[m], m, { act: 'HQ05.method', arg: m, dis: ro5 })).join('') },
        { l: '알림톡 발신', v: esc(I.alim) },
        { l: '키오스크 기기', v: kioskN(s, c, I) + '대 등록<span class="hqb-note">CT-19에서 관리해요</span>' },
      ]),
    });
    const dir = staffOf(s, c).find(x => x.role === '원장');
    const acct = h.card({
      title: '담당·계정', pin: 5,
      body: form([
        { l: '담당 SV', v: sel('f_sv', ui.f_sv || c.sv, ['최민호', '정유나'], { size: 's', dis: ro5, label: '담당 SV' }) },
        { l: '원장 계정', v: dir ? esc(dir.name) + ' · ' + (dir.twoFactor ? '2단계 인증 사용' : '2단계 인증 등록 전') : '<span class="hqb-note">아직 없어요</span>' },
        { l: '교직원 수', v: esc(staffText(staffOf(s, c))) },
        { l: '운영 개시', v: c.opened && c.opened !== '-' ? esc(c.opened) + ' 승인' + h.btn('HQ-06 기록', { sm: true, act: 'HQ05.toOpen' }) : '<span class="hqb-note">승인 전</span>' + h.btn('운영 개시 승인 보기', { sm: true, act: 'HQ05.toOpen' }) },
      ]),
    });
    const sl = slots(s, c, ci.slotCap), over = sl.filter(x => x.over);
    const slotBody = sl.length
      ? '<div class="hqb-note" style="margin-bottom:8px">반 하나는 ' + ci.cap + '명까지, 같은 시간대 반 인원 합계는 일시수용능력 ' + ci.slotCap + '명까지예요.</div>' +
        tbl([{ label: '시간대' }, { label: '반' }, { label: '인원 합계', num: true }, { label: '결과' }], sl.map(x => ({
          cells: ['<span class="mono">' + esc(x.key) + '</span>', esc(x.list.map(k => k.name + ' ' + k.enrolled + '명').join(', ')), x.sum + ' / ' + ci.slotCap + '명', x.over ? h.chip('넘어요', 'bad') : h.chip('괜찮아요', 'ok')],
        })), { cls: 'hqb-mini' }) +
        (over.length ? '<div style="margin-top:8px">' + h.alert(over.length + '개 시간대가 넘어요. 저장하면 넘는 반에는 새 학생 배정을 막고 센터에 정리를 요청해요.', 'bad') + '</div>' : '')
      : h.empty('이 센터에는 아직 반이 없어요. 반을 만들면 같은 시간대 합계를 여기서 검사해요.');
    const slotCard = h.card({ title: '같은 시간대 정원 합계', pin: 7, right: B.impChip('IMP-15'), body: slotBody });
    return '<div class="hqb-grid2"><div class="hqb-stack">' + basic + ops + '</div><div class="hqb-stack">' + facility + acct + '</div></div><div style="margin-top:12px">' + slotCard + '</div>';
  }

  function tab5b(ctx, c) {
    const s = ctx.s, ui = ctx.ui, ro5 = !ctx.canEdit, fr = c.type !== '직영';
    const K = contract5(s, c);
    // 1 계약
    let cBody;
    if (!fr) {
      cBody = h.alert('직영 센터는 본사가 직접 운영해서 가맹 계약이 없어요.', 'info') + '<div style="margin-top:8px">' + form([{ l: '운영 형태', v: '본사 직영' }, { l: '개설일', v: esc(c.opened) }]) + '</div>' +
        '<div class="hqb-actions" style="margin-top:8px"><span class="hqb-note">가맹 계약 예시는 가맹 센터에서 봐요</span>' + h.btn('대구수성센터 보기', { sm: true, act: 'HQ05.center', arg: 'daegu' }) + '</div>';
    } else if (!K.signed) {
      cBody = form([{ l: '계약서', v: esc(K.ver) + ' · 서명 전' }, { l: '제공일 · 체결일', v: esc(K.given) + ' · -' }, { l: '상태', v: h.chip('체결 전', 'warn') }]) +
        '<div style="margin-top:8px">' + h.alert('체결 전이에요. HQ-03 계약 게이트에서 체결하면 그날 값이 이 센터 계약 값으로 고정돼요.', 'info') + '</div><div class="hqb-actions" style="margin-top:8px">' + h.btn('HQ-03 열기', { sm: true, go: 'HQ-03' }) + '</div>';
    } else {
      const end = c.contractEnd && c.contractEnd !== '-' ? c.contractEnd : '';
      const a180 = end ? addDays(end, -180) : '', left = end ? days(ctx.today, a180) : null;
      const snap = K.snap || {};
      const am = ui.amOpen ? '<div class="hqb-box" style="margin-top:8px"><h4>부속합의서 등록</h4><div class="hqb-fv">' +
        sel('am_item', ui.am_item || '사용료 단가', ['사용료 단가', '계약 기간', '영업지역 반경', '가맹비'], { size: 's', label: '바꿀 항목' }) +
        inp('am_value', ui.am_value || '', { size: 's', ph: '새 값', label: '새 값' }) + inp('am_doc', ui.am_doc || '', { size: 'm', ph: '부속합의서 번호나 파일', label: '근거 문서' }) + errLine(ui.e_am) + '</div>' +
        '<div class="hqb-actions" style="margin-top:8px">' + h.btn('등록', { sm: true, primary: true, act: 'HQ05.amendSave' }) + h.btn('닫기', { sm: true, act: 'HQ05.amendClose' }) + '</div></div>' : '';
      cBody = form([
        { l: '계약서', v: esc(K.ver) + ' · 서명본' + h.btn('보기', { sm: true, act: 'HQ05.viewFile' }) },
        { l: '제공일 · 체결일', v: esc(K.given) + ' · ' + esc(K.signed) },
        { l: '계약 기간', v: esc(K.start || c.opened) + ' ~ ' + esc(c.contractEnd) + varChip() },
        { l: '만료 알림', v: '180일 전 · 90일 전<span class="hqb-note">갱신 요구 기간' + (a180 ? ', 첫 알림 ' + a180 + (left > 0 ? ' (' + left + '일 남음)' : '') : '') + '</span>' },
        { l: '상태', v: h.chip(K.status, K.status === '유효' ? 'ok' : 'warn') },
      ]) + rvBox('계약한 날 고정한 값', 'IMP-25',
        '<div class="hqb-note" style="color:#4a25a8">정책 값(HQ-08, HQ-09)이 바뀌어도 이 센터 값은 그대로예요. 부속합의서를 등록해야만 바뀌어요.</div>' +
        '<div class="hqb-snap">' + [['가맹비', snap.fee], ['계약 기간', snap.term], ['영업지역 반경', snap.radius], ['사용료 단가', snap.royalty]].map(r => '<div><span>' + esc(r[0]) + '</span><b>' + esc(r[1] || '-') + '</b></div>').join('') + '</div>' +
        ((K.amends || []).length ? '<div class="hqb-note" style="margin-top:6px">' + K.amends.map(a => esc(a.date + ' ' + a.item + ' ' + chg(a.from, a.to) + ' (' + a.doc + ')')).join('<br>') + '</div>' : '') +
        '<div class="hqb-actions" style="margin-top:8px">' + h.btn('부속합의서 등록', { sm: true, act: 'HQ05.amendOpen', disabled: ro5 }) + '</div>' + am, 6, 'margin-top:10px');
    }
    const contract = h.card({ title: '계약', pin: 1, right: h.polChip('POL-07'), body: cBody });
    // 2 영업지역
    const radius = fr && K && K.snap ? K.snap.radius : (s.hq09.terr.radius + 'm');
    const checked = s.hq05.checked[c.id];
    const terr = h.card({
      title: '영업지역', pin: 2, right: h.polChip('POL-08'),
      body: form([
        { l: '기준', v: '반경 ' + esc(radius) + (fr && K && K.snap ? h.chip('계약 값', 'review') : varChip()) },
        { l: '중첩 검사', v: h.chip('중첩 없음', 'ok') + '<span class="hqb-note">직영·가맹 전체 대상' + (checked ? ', ' + checked + ' 검사' : '') + '</span>' + h.btn('다시 검사', { sm: true, act: 'HQ05.overlap' }) },
      ]) + '<div class="hqb-map">지도에 센터 위치와 반경을 표시해요<br>행정동과 학교군 경계는 P2에 붙여요</div>',
    });
    // 3 가맹금
    let fBody;
    if (!fr) fBody = h.empty('직영 센터는 가맹금이 없어요.');
    else {
      const rows = s.hq05.fees[c.id] || s.hq09.fees.map(f => ({ name: f.name, amount: f.amount ? f.amount + '원' : '', how: '계약 전', escrow: f.escrow ? '예치 대상 (HQ-03)' : '-', policy: true, st: f.st }));
      fBody = tbl([{ label: '항목' }, { label: '금액' }, { label: '처리' }, { label: '예치' }], rows.map(f => ({
        cells: [esc(f.name),
          f.paid ? '<b>' + esc(f.amount) + '</b>' + h.chip('납부액', 'ok') : f.exempt ? '<b>' + esc(f.amount) + '</b>' : f.amount ? esc(f.amount) + ' ' + stChip(f.st || '안') + varChip() : stChip('미정') + varChip(),
          esc(f.how), esc(f.escrow)],
      })), { cls: 'hqb-mini' }) + '<div class="hqb-note" style="margin-top:6px">항목표는 HQ-09 정책에서 와요. 이미 낸 금액은 (안) 대신 실제 낸 금액을 보여 줘요.</div>';
    }
    const fees = h.card({ title: '가맹금', pin: 3, right: h.polChip('POL-06'), body: fBody });
    // 4 개별 정책
    const indRows = Object.keys(s.pol).sort().filter(code => (s.pol[code].centers || {})[c.id]).map(code => {
      const st = s.pol[code], x = st.centers[c.id], g = (st.groups || {})[c.type];
      return { cells: [h.polChip(code) + ' ' + esc(POL_NAME[code] || h.pol(code).name), esc(g ? g.value : (BASE_SHORT[code] || h.polValue(code).value)), '<b class="hqb-nw">' + esc(x.short || x.value) + '</b>', '<span class="hqb-nw">' + esc(x.until ? '~' + x.until : '-') + '</span>', esc(x.reason || '-')] };
    });
    const polOpts = (fr ? ['POL-01', 'POL-04', 'POL-16', 'POL-34'] : ['POL-16']).map(code => ({ v: code, l: code + ' ' + POL_NAME[code] }));
    const indForm = ui.indOpen ? '<div class="hqb-box" style="margin-top:8px"><h4>개별 값 추가</h4><div class="hqb-form">' +
      '<div class="hqb-fr"><div class="hqb-fl">정책</div><div class="hqb-fv">' + sel('ind_code', ui.ind_code || polOpts[0].v, polOpts, { size: 'm', label: '정책' }) + '</div></div>' +
      '<div class="hqb-fr"><div class="hqb-fl">이 센터 값</div><div class="hqb-fv">' + inp('ind_value', ui.ind_value || '', { size: 's', ph: '예) 20일', label: '이 센터 값' }) + '</div></div>' +
      '<div class="hqb-fr"><div class="hqb-fl">기간</div><div class="hqb-fv">' + sel('ind_period', ui.ind_period || '날짜 지정', ['날짜 지정', '계약 종료 시까지'], { size: 's', live: true, label: '기간' }) + ((ui.ind_period || '날짜 지정') === '날짜 지정' ? inp('ind_until', ui.ind_until || '', { size: 's', type: 'date', label: '끝나는 날' }) : '') + '</div></div>' +
      '<div class="hqb-fr"><div class="hqb-fl">사유</div><div class="hqb-fv">' + inp('ind_reason', ui.ind_reason || '', { size: 'xl', ph: '왜 이 센터만 다른지', label: '사유' }) + '</div></div>' +
      '<div class="hqb-fr"><div class="hqb-fl">근거 문서</div><div class="hqb-fv">' + inp('ind_doc', ui.ind_doc || '', { size: 'l', ph: '부속합의서 번호나 파일', label: '근거 문서' }) + '</div></div></div>' +
      errLine(ui.e_ind) + '<div class="hqb-actions" style="margin-top:8px">' + h.btn('저장', { sm: true, primary: true, act: 'HQ05.indSave' }) + h.btn('닫기', { sm: true, act: 'HQ05.indClose' }) + '</div></div>' : '';
    const indiv = h.card({
      title: '개별 정책', pin: 4, right: h.polChip('POL-04') + h.polChip('POL-34'),
      body: tbl([{ label: '정책' }, { label: '그룹 값' }, { label: '이 센터 값' }, { label: '기간' }, { label: '사유·근거' }], indRows, { cls: 'hqb-mini', empty: '이 센터만 다른 값이 없어요.' }) +
        '<div class="hqb-actions" style="margin-top:8px">' + h.btn('+ 개별 값 추가', { sm: true, act: 'HQ05.indOpen', disabled: ro5 }) + '<span class="hqb-note">가맹 계약에 영향을 주는 정책은 근거를 꼭 붙여요</span></div>' + indForm,
    });
    // 5 서류·위탁
    let eBody, eRv;
    if (!fr) {
      eBody = '<div class="hqb-fv">개인정보 처리 위탁계약 ' + h.chip('해당 없음 (직영)', 'line') + '</div>';
      eRv = rvBox('직영은 본사가 처리자예요', 'IMP-04', '직영 센터의 원생 정보는 MSC Brain이 직접 처리해요. 본사와 센터 사이 위탁계약은 해당 없고, 결제선생과 알림톡 발송사가 본사의 수탁자예요. 원생 동의서(CT-05)도 처리자를 본사로 적어요.', 7, 'margin-top:10px');
    } else {
      const E = s.hq05.entrust[c.id] || { signed: '', consent: {} };
      const usePay = c.pay === '결제선생';
      eBody = '<div class="hqb-fv">개인정보 처리 위탁계약 ' + (E.signed ? h.chip('체결 · ' + E.signed, 'ok') : h.chip('체결 전', 'warn')) + '<span>재위탁 ' + (usePay ? '결제선생, 알림톡 발송사' : '알림톡 발송사') + ' 고지</span></div>';
      const subs = [{ k: '결제선생', job: '결제 처리', use: usePay }, { k: '알림톡', name: '알림톡 발송사', job: '알림톡 발송', use: true }];
      const conForm = ui.conOpen ? '<div class="hqb-fv" style="margin-top:8px">' + inp('con_date', ui.con_date || ctx.today, { size: 's', type: 'date', label: '동의 받은 날' }) + sel('con_how', ui.con_how || '서면', ['서면', '전자서명'], { size: 's', label: '동의 방법' }) +
        h.btn('기록', { sm: true, primary: true, act: 'HQ05.consent' }) + h.btn('닫기', { sm: true, act: 'HQ05.conClose' }) + errLine(ui.e_con) + '</div>' : '';
      eRv = rvBox('재위탁처마다 센터 동의를 남겨요', 'IMP-04',
        '<div>본사가 일을 다시 맡길 때는 위탁자인 센터의 동의가 필요할 수 있어요(법무 확인). 센터가 쓰지 않는 업체는 고지에서 빠져요.</div>' +
        tbl([{ label: '재위탁처' }, { label: '맡기는 일' }, { label: '이 센터' }, { label: '센터 동의' }], subs.map(x => {
          const cs = (E.consent || {})[x.k];
          return { attr: x.use ? '' : ' class="off"', cells: [esc(x.name || x.k), esc(x.job), x.use ? '사용' : '안 써요 (' + esc(c.pay) + ')', !x.use ? '해당 없음' : cs ? h.chip('동의 ' + cs.date + ' ' + cs.how, 'ok') : h.chip('기록 없음', 'warn') + h.btn('동의 기록', { sm: true, act: 'HQ05.conOpen', disabled: ro5 })] };
        }), { cls: 'hqb-mini' }) + conForm, 7, 'margin-top:10px');
    }
    const docs = h.card({ title: '서류·위탁 (탭 요약)', pin: 5, right: h.polChip('POL-42') + h.polChip('POL-43'), body: eBody + eRv });
    return '<div class="hqb-grid2"><div class="hqb-stack">' + contract + fees + '</div><div class="hqb-stack">' + terr + indiv + '</div></div><div style="margin-top:12px">' + docs + '</div>';
  }

  B.screen({
    id: 'HQ-05', side: 'hq', phase: 'P1a', devices: ['pc'], pages: [23, 24],
    title: '센터 상세', menuLabel: '센터 상세', crumb: '가맹점 관리 > 센터 목록 > 센터 상세',
    tabs: [{ id: 'a', label: '기본·시설', phase: 'P1a' }, { id: 'b', label: '계약·영업지역·개별 정책', phase: 'P1b' }],
    headActions: ctx => h.btn('센터 목록', { go: 'HQ-04' }) + (ctx.tab === 'a' ? h.btn('저장', { primary: true, act: 'HQ05.save', disabled: !ctx.canEdit }) : ''),
    render(ctx) {
      const c = c5(ctx), ui = ctx.ui;
      const head = '<div class="hqb-sub"><h2>' + esc(c.name) + '</h2>' + h.chip(c.type, c.type === '직영' ? 'navy' : c.type === '가맹' ? 'brand' : 'review') + h.status(c.status) +
        (ctx.tab === 'a' && dirty5(ui) ? '<span class="hqb-dirty">저장하지 않은 변경이 있어요</span>' : '') +
        '<span class="r">센터 ' + sel('center', c.id, ctx.s.centers.map(x => ({ v: x.id, l: x.name + ' (' + x.type + ')' })), { size: 'l', live: true, label: '센터 고르기' }) + '</span></div>';
      return head + (ctx.tab === 'b' ? tab5b(ctx, c) : tab5a(ctx, c));
    },
    mount(root) { mountLive(root); },
    prd: {
      summary: '센터 한 곳의 기본 정보와 시설, 계약과 영업지역, 이 센터만 다른 값을 보고 고치는 화면이에요. 정원과 교습시간처럼 법과 이어진 값은 시스템이 계산하고 검사해요.',
      who: '본사 슈퍼관리자와 운영팀이 보고 고쳐요. 정산팀과 SV는 보기만 하고, 콘텐츠팀에게는 메뉴가 안 보여요. 센터는 같은 시설 정보를 CT-19에서 보기만 해요.',
      items: [
        { n: 1, tab: 'a', t: '센터 유형', d: '직영, 가맹, 테스트베드 가운데 하나를 골라요. 고른 유형의 그룹 기본 규칙이 붙어요. 유형을 바꾸려 하면 달라지는 정책과 값을 먼저 보여 주고 사유를 받아요.', pol: ['POL-44'], ref: 'p.23 ①' },
        { n: 2, tab: 'a', t: '시설과 정원 상한', d: '정원 상한은 본사 기준, 일시수용능력, 교습소 9명 가운데 가장 작은 값으로 자동 계산해요. 교습소를 고르면 교습자 1명과 보조요원 1명 제한이 교직원 화면에 걸려요.', pol: ['POL-15', 'POL-16'], ref: 'p.23 ②' },
        { n: 3, tab: 'a', t: '교육청 등록과 교습시간', d: '등록번호와 교습과목은 등록증에 적힌 그대로 넣어요. 교습시간 상한은 지역 조례 값을 불러와 시간표를 저장할 때 검사해요.', pol: ['POL-17'], ref: 'p.23 ③' },
        { n: 4, tab: 'a', t: '결제와 수납 연동', d: '직영은 결제선생, 가맹은 수기 기록이 기본(안)이에요. 결제선생 답변에 따라 바뀔 수 있어요. 수납 수단은 센터가 쓰는 것만 켜요.', pol: ['POL-36', 'POL-37'], ref: 'p.23 ④' },
        { n: 5, tab: 'a', t: '담당과 계정', d: '담당 SV는 점검(P2)과 문의 배정에 써요. 원장 계정은 2단계 인증을 꼭 거쳐야 해요(CM-01).', ref: 'p.23 ⑤' },
        { n: 6, tab: 'a', kind: 'review', imp: 'IMP-12', t: '상태는 승인으로만 바뀌어요', d: '원문은 상태를 이 화면에서 바로 고치게 그렸어요. 그러면 운영 개시 승인을 건너뛸 수 있어서 상태는 보기만 하게 했어요. 계획 상태 센터는 여기서 승인을 요청하고, 운영은 HQ-06 승인으로만 돼요. 직영과 가맹 사이 유형 전환도 계약 게이트(HQ-03)로 보내요.' },
        { n: 7, tab: 'a', kind: 'review', imp: 'IMP-15', t: '같은 시간대 정원 합계', d: '반 하나의 상한만 보면 같은 시간에 반이 여럿 열릴 때 합계가 수용능력을 넘을 수 있어요. 시간대마다 반 인원을 더해 일시수용능력과 견줘요. 시설 유형을 교습소로 바꿔 보면 넘는 시간대가 바로 보여요.', pol: ['POL-15', 'POL-16'] },
        { n: 1, tab: 'b', t: '계약', d: '계약서 버전, 제공일, 체결일, 기간, 서명본을 관리해요. 만료 180일 전과 90일 전에 본사와 센터 모두에게 알려요. 이때가 가맹점이 갱신을 요구할 수 있는 기간이에요.', pol: ['POL-07'], ref: 'p.24 ①' },
        { n: 2, tab: 'b', t: '영업지역', d: '계약서에 적은 영업지역을 기준대로 보여 주고, 새 센터를 등록할 때 겹치는지 검사해요. 직영 센터도 검사 대상이에요. 행정동과 학교군 경계 지도는 P2에 붙여요.', pol: ['POL-08'], ref: 'p.24 ②' },
        { n: 3, tab: 'b', t: '가맹금', d: '항목표는 정책(HQ-09)에서 오고, 센터마다 납부, 면제, 예치 상태를 기록해요.', pol: ['POL-06'], ref: 'p.24 ③' },
        { n: 4, tab: 'b', t: '개별 정책', d: '그룹 값과 다른 값을 이 센터에만 줘요. 기간과 사유를 꼭 적어요. 사용료나 청구처럼 가맹 계약에 영향을 주는 정책은 근거 문서가 없으면 저장되지 않아요.', pol: ['POL-04', 'POL-34'], ref: 'p.24 ④' },
        { n: 5, tab: 'b', t: '개인정보 위탁', d: '가맹 센터의 원생 정보 처리자는 센터이고 본사는 수탁자예요. 위탁계약을 맺었는지와 재위탁처를 기록해요.', pol: ['POL-42', 'POL-43'], ref: 'p.24 ⑤' },
        { n: 6, tab: 'b', kind: 'review', imp: 'IMP-25', cond: true, reveal: 'HQ05.center', revealArg: 'daegu', t: '계약한 날 값 고정', d: '정책 값이 바뀌어도 이미 맺은 계약은 흔들리지 않게 계약한 날의 가맹비, 기간, 영업지역, 사용료를 이 센터 값으로 따로 저장해요. 이미 낸 돈에는 (안) 대신 실제 낸 금액을 보여 줘요. 계약 값은 부속합의서를 등록해야만 바뀌어요. 가맹 센터에서 보여요.' },
        { n: 7, tab: 'b', kind: 'review', imp: 'IMP-04', t: '재위탁 동의와 직영 처리자', d: '본사가 일을 다시 맡길 때는 센터 동의가 필요할 수 있어요(법무 확인). 재위탁처마다 동의 날짜와 방법을 남기고, 센터가 쓰지 않는 업체는 고지에서 빼요. 직영 센터는 본사가 처리자라 위탁계약이 해당 없어요.', pol: ['POL-42'] },
      ],
      open: ['학원으로만 열지 교습소도 허용할지(POL-15)', '본사 기준 타임당 정원 15명(안)(POL-16)', '가맹 결제 방식(POL-36)과 수납 수단을 본사와 센터 중 누가 켜는지', '계약 기간과 갱신 조건(POL-07), 영업지역 기준(POL-08)', '어떤 정책이 가맹 계약에 영향을 주는지 전체 목록'],
      rules: ['교습소는 한 번에 9명까지만 가르칠 수 있어요(법정).', '가맹점은 만료 180일 전부터 90일 전 사이에 갱신을 요구할 수 있어요(법정).'],
    },
  });

  act('HQ05.center', (ctx, id) => { if (!B.center(id)) return; reset5(ctx.ui); ctx.ui.center = id; });
  act('HQ05.type', (ctx, v) => {
    const c = c5(ctx); if (!ctx.canEdit) return;
    ctx.ui.typeTo = v === c.type ? null : v; ctx.ui.e_type = null;
  });
  act('HQ05.typeCancel', ctx => { ctx.ui.typeTo = null; ctx.ui.e_type = null; ctx.ui.typeReason = ''; });
  act('HQ05.typeApply', (ctx, arg) => {
    const ui = ctx.ui, s = ctx.s, c = c5(ctx);
    if (arg && typeof arg === 'object') { if (arg.to) ui.typeTo = arg.to; if (arg.reason != null) ui.typeReason = arg.reason; }
    const to = ui.typeTo; if (!to || to === c.type || !ctx.canEdit) return;
    if ((c.type === '직영') !== (to === '직영')) { ui.e_type = '직영과 가맹 사이 전환은 HQ-03에서 해요.'; return; }
    const reason = String(ui.typeReason || '').trim();
    if (!reason) { ui.e_type = '바꾸는 사유와 근거 문서를 적어 주세요.'; return; }
    const idx = s.centers.indexOf(c), from = c.type;
    polHist(ctx, 'POL-44', { from, to, text: c.name + ' 유형 ' + chg(from, to), scope: '센터', reason, n: 1, undo: [undoItem(s, 'centers', [idx, 'type'])] });
    c.type = to;
    audit(ctx, '센터 유형 변경', c.name, reason);
    ui.typeTo = null; ui.typeReason = ''; ui.e_type = null;
    say(c.name + ' 유형을 ' + to + ro(to) + ' 바꿨어요. 그룹 기본 규칙이 새로 붙어요.');
  });
  act('HQ05.fac', (ctx, v) => { if (ctx.canEdit) { const c = c5(ctx); ctx.ui.f_fac = v === c.facility ? null : v; if (ctx.ui.f_fac == null) delete ctx.ui.f_fac; } });
  act('HQ05.method', (ctx, m) => {
    if (!ctx.canEdit) return;
    const c = c5(ctx), I = info5(ctx.s, c);
    const cur = Object.assign({}, I.methods, ctx.ui.f_methods || {});
    cur[m] = !cur[m];
    ctx.ui.f_methods = cur;
  });
  act('HQ05.save', (ctx, arg) => {
    const ui = ctx.ui, s = ctx.s, c = c5(ctx), I = info5(s, c);
    if (arg && typeof arg === 'object') {
      const map = { name: 'f_name', addr: 'f_addr', eduNo: 'f_eduNo', subject: 'f_subject', area: 'f_area', cap: 'f_cap', facility: 'f_fac', sv: 'f_sv' };
      Object.keys(arg).forEach(k => { if (map[k]) ui[map[k]] = String(arg[k]); });
    }
    if (!ctx.canEdit) return;
    if (!dirty5(ui)) { say('바꾼 값이 없어요.'); return; }
    const name = String(ui.f_name != null ? ui.f_name : c.name).trim();
    const eduNo = String(ui.f_eduNo != null ? ui.f_eduNo : I.eduNo).trim();
    const cap = ui.f_cap != null && ui.f_cap !== '' ? Number(ui.f_cap) : c.facilityCap;
    ui.e_name = name ? null : '센터명을 넣어 주세요.';
    ui.e_eduNo = !eduNo ? '교육청 등록번호를 등록증 그대로 넣어 주세요.' : !/^제.+호$/.test(eduNo) ? '등록증 표기대로 제○○호 모양으로 넣어 주세요.' : null;
    ui.e_cap = !(cap > 0 && Math.floor(cap) === cap) ? '일시수용능력은 1 이상의 정수로 넣어 주세요.' : null;
    if (ui.e_name || ui.e_eduNo || ui.e_cap) { say('저장하지 못했어요. 빨간 글씨를 확인해 주세요.'); return; }
    const fac = ui.f_fac || c.facility, facChanged = fac !== c.facility;
    c.name = name; c.facility = fac; c.facilityCap = cap; if (ui.f_sv) c.sv = ui.f_sv;
    I.eduNo = eduNo; if (ui.f_addr != null) I.addr = ui.f_addr; if (ui.f_subject != null) I.subject = ui.f_subject; if (ui.f_area != null) I.area = ui.f_area;
    if (ui.f_methods) I.methods = Object.assign({}, ui.f_methods);
    const over = slots(s, c, fac === '교습소' ? Math.min(9, cap) : cap).filter(x => x.over).length;
    audit(ctx, '센터 정보 수정', c.name, facChanged ? '시설 유형 ' + fac : '기본·시설');
    F5.forEach(k => { delete ui[k]; });
    say('저장했어요.' + (over ? ' 정원을 넘는 시간대 ' + over + '곳에 새 학생 배정을 막고 센터에 정리를 요청했어요.' : ''));
  });
  act('HQ05.reqOpen', ctx => {
    const s = ctx.s, c = c5(ctx), I = info5(s, c);
    if (!ctx.canEdit || c.status !== '계획') return;
    if (c.type !== '직영' && !signedViaGate(s, c)) { ctx.ui.e_req = '가맹 계약을 체결하기 전이라 승인을 요청할 수 없어요 (HQ-03).'; return; }
    if (!I.eduNo) { ctx.ui.e_req = '교육청 등록번호를 먼저 넣어 주세요.'; return; }
    c.status = '승인 대기'; ctx.ui.e_req = null;
    audit(ctx, '운영 개시 승인 요청', c.name, '시설과 교육청 등록 정보 입력');
    s.ui['HQ-06'] = Object.assign(s.ui['HQ-06'] || {}, { center: c.id });
    say(eul(c.name) + ' 승인 대기로 바꿨어요. 운영 개시 승인 화면으로 가요.');
    B.go('HQ-06'); return false;
  });
  act('HQ05.toOpen', ctx => { const c = c5(ctx); ctx.s.ui['HQ-06'] = Object.assign(ctx.s.ui['HQ-06'] || {}, { center: c.id }); B.go('HQ-06'); return false; });
  act('HQ05.viewFile', () => { say('서명본 파일을 열어요 (예시).'); return false; });
  act('HQ05.overlap', ctx => { const c = c5(ctx); ctx.s.hq05.checked[c.id] = ctx.today; say('반경 안에 다른 센터가 없어요. 직영과 계획 센터까지 검사했어요.'); });
  act('HQ05.indOpen', ctx => { if (ctx.canEdit) { ctx.ui.indOpen = true; ctx.ui.e_ind = null; } });
  act('HQ05.indClose', ctx => { ctx.ui.indOpen = false; ctx.ui.e_ind = null; });
  act('HQ05.indSave', (ctx, arg) => {
    const ui = ctx.ui, s = ctx.s, c = c5(ctx);
    if (arg && typeof arg === 'object') {
      ui.indOpen = true;
      ['code', 'value', 'period', 'until', 'reason', 'doc'].forEach(k => { if (arg[k] != null) ui['ind_' + k] = String(arg[k]); });
    }
    if (!ctx.canEdit) return;
    const fr = c.type !== '직영';
    const code = ui.ind_code || (fr ? 'POL-01' : 'POL-16');
    const value = String(ui.ind_value || '').trim(), period = ui.ind_period || '날짜 지정', until = ui.ind_until || '';
    const reason = String(ui.ind_reason || '').trim(), doc = String(ui.ind_doc || '').trim();
    let e = null;
    if (!fr && code !== 'POL-16') e = '직영은 사용료와 청구가 없어서 이 정책을 따로 둘 수 없어요.';
    else if (!value) e = '이 센터 값을 넣어 주세요.';
    else if (period === '날짜 지정' && !okDate(until)) e = '끝나는 날을 넣어 주세요. 기간은 꼭 정해야 해요.';
    else if (period === '날짜 지정' && until <= ctx.today) e = '끝나는 날은 오늘 뒤여야 해요.';
    else if (!reason) e = '왜 이 센터만 다른지 사유를 적어 주세요.';
    else if (CONTRACT_POL.includes(code) && !doc) e = '가맹 계약에 영향을 주는 정책이라 근거 문서가 있어야 저장돼요.';
    else if (code === 'POL-16') { const n = toN(value), base = parseInt(String(h.polValue('POL-16').value), 10) || 15; if (isNaN(n) || n <= 0) e = '정원은 숫자로 넣어 주세요.'; else if (n > base) e = '본사 기준 ' + base + '명 (안)을 넘을 수 없어요.'; }
    ui.e_ind = e; if (e) return;
    const st = s.pol[code] = s.pol[code] || {}; st.centers = st.centers || {};
    const prevV = st.centers[c.id] ? st.centers[c.id].value : (BASE_SHORT[code] || h.polValue(code).value);
    const u = undoItem(s, 'pol', [code, 'centers', c.id]);
    st.centers[c.id] = { value, short: value, status: '예시', until: period === '날짜 지정' ? until : '계약 종료 시', reason: reason + (doc ? ', ' + doc : '') };
    polHist(ctx, code, { from: prevV, to: value + ' (' + c.name + ' 개별)', scope: '센터', reason: doc || reason, n: 1, undo: [u] });
    ['ind_value', 'ind_until', 'ind_reason', 'ind_doc', 'e_ind'].forEach(k => { delete ui[k]; });
    ui.indOpen = false;
    say(c.name + '에 ' + code + ' 개별 값을 저장했어요. 정책 현황(HQ-07) 이력에도 남았어요.');
  });
  act('HQ05.amendOpen', ctx => { if (ctx.canEdit) { ctx.ui.amOpen = true; ctx.ui.e_am = null; } });
  act('HQ05.amendClose', ctx => { ctx.ui.amOpen = false; ctx.ui.e_am = null; });
  act('HQ05.amendSave', (ctx, arg) => {
    const ui = ctx.ui, s = ctx.s, c = c5(ctx), K = s.hq05.contract[c.id];
    if (arg && typeof arg === 'object') { ui.amOpen = true; if (arg.item) ui.am_item = arg.item; if (arg.value != null) ui.am_value = String(arg.value); if (arg.doc != null) ui.am_doc = String(arg.doc); }
    if (!ctx.canEdit || !K) return;
    const item = ui.am_item || '사용료 단가', value = String(ui.am_value || '').trim(), doc = String(ui.am_doc || '').trim();
    ui.e_am = !value ? '새 값을 넣어 주세요.' : !doc ? '부속합의서 번호나 파일이 있어야 계약 값을 바꿀 수 있어요.' : null;
    if (ui.e_am) return;
    const key = { '가맹비': 'fee', '계약 기간': 'term', '영업지역 반경': 'radius', '사용료 단가': 'royalty' }[item];
    const from = K.snap[key];
    K.snap[key] = value; K.amends = K.amends || []; K.amends.push({ date: ctx.today, item, from, to: value, doc });
    if (key === 'royalty') {
      const st = s.pol['POL-01'] = s.pol['POL-01'] || {}; st.centers = st.centers || {};
      const u = undoItem(s, 'pol', ['POL-01', 'centers', c.id]);
      st.centers[c.id] = { value, status: '확정', until: '', reason: doc };
      polHist(ctx, 'POL-01', { from: from || '-', to: value + ' (' + c.name + ' 개별)', scope: '센터', reason: doc, n: 1, undo: [u] });
    }
    audit(ctx, '부속합의서 등록', c.name + ' ' + item, doc);
    ui.amOpen = false; ['am_value', 'am_doc'].forEach(k => { delete ui[k]; });
    say('부속합의서를 등록했어요. ' + item + ' 계약 값이 ' + value + ro(value) + ' 바뀌었어요.');
  });
  act('HQ05.conOpen', ctx => { if (ctx.canEdit) { ctx.ui.conOpen = true; ctx.ui.e_con = null; } });
  act('HQ05.conClose', ctx => { ctx.ui.conOpen = false; });
  act('HQ05.consent', (ctx, arg) => {
    const ui = ctx.ui, s = ctx.s, c = c5(ctx);
    if (arg && typeof arg === 'object') { if (arg.date) ui.con_date = arg.date; if (arg.how) ui.con_how = arg.how; }
    if (!ctx.canEdit || c.type === '직영') return;
    const date = ui.con_date || ctx.today;
    if (!okDate(date) || date > ctx.today) { ui.e_con = '동의 받은 날을 오늘이나 그 전으로 넣어 주세요.'; ui.conOpen = true; return; }
    const E = s.hq05.entrust[c.id] = s.hq05.entrust[c.id] || { signed: '', consent: {} };
    E.consent = E.consent || {}; E.consent['알림톡'] = { date, how: ui.con_how || '서면' };
    ui.conOpen = false; ui.e_con = null;
    say('알림톡 발송사 재위탁 동의를 기록했어요.');
  });

  /* =====================================================================
     HQ-06 운영 개시 승인 (p.25)
     ===================================================================== */
  const DOCS6 = [
    { id: 'biz', name: '사업자등록증', kind: '필수', note: '-' },
    { id: 'reg', name: '학원 등록증 (교습소 신고증)', kind: '필수', note: '시설 유형 대조 (HQ-05)' },
    { id: 'fee', name: '교육청 교습비 등록 내역', kind: '필수', note: '센터 상품과 금액 대조', pin: 2 },
    { id: 'ins', name: '배상책임보험 증권', kind: '필수', note: '만료일 관리' },
    { id: 'ent', name: '개인정보 처리 위탁계약', kind: '필수', note: '본사와 센터 사이' },
    { id: 'staff', name: '종사자 경력 조회 (성범죄·아동학대)', kind: '필수', note: 'CT-20 연동', pin: 3 },
    { id: 'post', name: '교습비 게시 사진', kind: '필수', note: 'CT-18 게시표 출력' },
    { id: 'kiosk', name: '키오스크 기기 등록', kind: '시스템', note: 'CT-19' },
    { id: 'pay', name: '결제 연동 (직영)', kind: '시스템', note: '결제선생 가맹점 ID' },
    { id: 'alim', name: '알림톡 발신 프로필', kind: '시스템', note: 'HQ-18' },
  ];
  const applies6 = (d, c) => (d.id === 'ent' ? c.type !== '직영' : d.id === 'pay' ? c.type === '직영' || c.pay === '결제선생' : true);
  const addYear = d => (okDate(d) ? addDays((Number(d.slice(0, 4)) + 1) + d.slice(4), -1) : '');
  function c6(ctx) {
    let id = ctx.ui.center;
    if (!id || !B.center(id)) { const w = ctx.s.centers.find(c => c.status === '승인 대기'); id = w ? w.id : 'daechi1'; ctx.ui.center = id; }
    return B.center(id);
  }
  function case6(s, c) {
    const C = s.hq06.cases;
    if (C[c.id]) return C[c.id];
    const done = c.status === '운영', at = done ? c.opened : '';
    const d = {};
    DOCS6.forEach(x => { d[x.id] = x.kind === '시스템' ? { st: done ? '완료' : '대기' } : done ? { st: '승인', file: x.name.split(' ')[0] + '.pdf', by: '홍길동', at } : { st: '미제출' }; });
    if (done) d.ins.exp = addYear(c.opened);
    const fees = s.products.map(p => ({ p: p.id, edu: (p.edu || {})[c.id] != null ? p.edu[c.id] : null, price: c.type === '직영' ? p.direct : ((p.centerPrice || {})[c.id] != null ? p.centerPrice[c.id] : p.recommend) }));
    return (C[c.id] = { docs: d, fees, request: null, approvedAt: done ? c.opened : '', approvedBy: done ? '정본부' : '', sel: 'fee' });
  }
  // 화면 속 날짜. 직영은 오늘(2027-03-08), 가맹과 테스트베드는 계약 게이트 날짜와 교직원 조회일 가운데 늦은 날 (P1b 예시)
  function day6(ctx, c) {
    if (c.type === '직영') return ctx.today;
    const s = ctx.s, ds = [ctx.today, (s.hq03 && s.hq03.today) || ''];
    staffOf(s, c).forEach(p => { ds.push(p.check || ''); ds.push(p.notified || ''); });
    return ds.filter(okDate).sort().pop() || ctx.today;
  }
  const staff6 = (s, c) => { const st = staffOf(s, c); return { list: st, n: st.filter(x => x.check).length, all: st.length, done: st.length > 0 && st.every(x => x.check) }; };
  function feeCheck(s, K) {
    return K.fees.map(f => { const p = s.products.find(x => x.id === f.p) || { name: f.p }; const res = f.edu == null ? 'lock' : f.price > f.edu ? 'over' : 'ok'; return Object.assign({ name: p.name, res }, f); });
  }
  function st6(t) {
    const cls = { '승인': 'ok', '완료': 'ok', '검토 중': 'wait', '대기': 'wait', '심사 중': 'wait', '보완 요청': 'bad', '미제출': 'bad', '해당 없음': 'na' }[t] || 'wait';
    return '<span class="hqb-st ' + cls + '">' + esc(t) + '</span>';
  }
  function gate6(s, c, K) {
    const miss = [], warn = [];
    DOCS6.forEach(x => {
      if (!applies6(x, c)) return;
      const d = K.docs[x.id] || {};
      if (x.id === 'staff') { const sf = staff6(s, c); if (!sf.done) miss.push('종사자 경력 조회 ' + sf.n + ' / ' + sf.all + '명'); return; }
      if (x.kind === '필수' && d.st !== '승인') miss.push(x.name);
      if (x.kind === '시스템') { if (x.id === 'alim') { if (d.st !== '완료') warn.push({ name: x.name, st: d.st || '대기' }); } else if (d.st !== '완료') miss.push(x.name); }
    });
    return { miss, warn };
  }
  function detail6(ctx, c, K) {
    const s = ctx.s, ui = ctx.ui, id = K.sel || 'fee', x = DOCS6.find(d => d.id === id) || DOCS6[2], d = K.docs[x.id] || {};
    const ro6 = !ctx.canEdit || c.status === '운영';
    const sim = (label, a) => h.btn(label, { sm: true, ghost: true, act: a, arg: x.id, disabled: ro6 });
    let body = '';
    if (x.id === 'ent' && !applies6(x, c)) {
      body = h.alert('직영 센터는 본사가 직접 운영해서 본사와 센터 사이 위탁계약을 맺을 상대가 없어요. 이 항목은 해당 없음으로 두고 승인 조건에서 빼요.', 'review', { title: '검토 반영' });
    } else if (x.id === 'staff') {
      const sf = staff6(s, c);
      body = tbl([{ label: '이름' }, { label: '역할' }, { label: '조회일' }, { label: '확인' }], sf.list.map(p => ({ cells: [esc(p.name), esc(p.role), p.check ? esc(p.check) : h.chip('조회 전', 'bad'), p.check ? '조회 기관 확인, 결격 사유 없음' : '수업 배치 막힘 (CT-20)'] })), { cls: 'hqb-mini', empty: '교직원이 아직 없어요. 원장이 CT-20에서 등록해요.' }) +
        '<div class="hqb-note" style="margin-top:6px">조회일은 센터가 CT-20에 넣으면 바로 반영돼요.</div>' +
        (sf.done ? '' : '<div class="hqb-actions" style="margin-top:6px">' + h.btn('조회일을 넣은 것으로 보기 (시연)', { sm: true, ghost: true, act: 'HQ06.staffSim', disabled: ro6 }) + '</div>');
    } else if (x.kind === '시스템') {
      const note = x.id === 'alim' ? h.alert('외부 심사라 끝나는 날을 우리가 정할 수 없어요. 그래서 승인 조건에서 빼고 경고만 띄워요. 심사가 끝나기 전에는 미리 등록한 대체 문자 발신번호로 알림을 보내요.', 'review', { title: '검토 반영' }) : '';
      body = form([{ l: '상태', v: st6(applies6(x, c) ? d.st : '해당 없음') }, { l: '연결 화면', v: esc(x.note) + (d.note ? ' · ' + esc(d.note) : '') }]) + note +
        (applies6(x, c) && d.st !== '완료' ? '<div class="hqb-actions" style="margin-top:8px">' + sim(x.id === 'alim' ? '심사 끝난 것으로 보기 (시연)' : '완료된 것으로 보기 (시연)', 'HQ06.sysDone') + '</div>' : '');
    } else {
      let extra = '';
      if (x.id === 'fee') {
        const fc = feeCheck(s, K);
        extra = '<div style="margin-top:8px">' + tbl([{ label: '상품' }, { label: '교육청 등록 금액', num: true }, { label: '센터 판매가 (CT-18)', num: true }, { label: '결과' }], fc.map(f => ({
          cells: [esc(f.name), f.edu == null ? '등록 전' : comma(f.edu), comma(f.price), f.res === 'ok' ? h.chip('맞아요', 'ok') : f.res === 'lock' ? h.chip('판매 잠김', 'warn') : h.chip('등록 금액보다 비싸요', 'bad')],
        })), { cls: 'hqb-mini' }) + '<div class="hqb-note" style="margin-top:6px">교육청에 등록하기 전인 상품은 판매가 잠겨요. 등록 금액보다 비싼 상품이 있으면 승인할 수 없어요.</div></div>';
      }
      if (x.id === 'ins') extra = '<div class="hqb-fv" style="margin-top:8px"><span class="hqb-fl">보험 만료일</span>' + inp('ins_exp', ui.ins_exp != null ? ui.ins_exp : (d.exp || ''), { size: 's', type: 'date', dis: ro6, label: '보험 만료일' }) + '<span class="hqb-note">만료 30일 전(예시)에 다시 요청해요</span></div>';
      body = form([
        { l: '상태', v: st6(d.st || '미제출') },
        { l: '파일', v: d.file ? esc(d.file) + (d.at ? '<span class="hqb-note">' + esc(d.at) + ' 올림</span>' : '') : '<span class="hqb-note">센터가 CT-17 자료실에서 올리면 여기 떠요</span>' },
        { l: '검토자', v: d.by ? '운영팀 ' + esc(d.by) : '-' },
      ]) + extra + errLine(ui.e_doc) +
        (d.st === '승인' ? '' : '<div class="hqb-actions" style="margin-top:8px">' + (d.file
          ? h.btn('승인', { sm: true, primary: true, act: 'HQ06.ok', arg: x.id, disabled: ro6 }) + inp('doc_reason', ui.doc_reason || '', { size: 'l', ph: '보완 사유', dis: ro6, label: '보완 사유' }) + h.btn('이 서류 보완 요청', { sm: true, act: 'HQ06.back', arg: x.id, disabled: ro6 })
          : sim('센터가 올린 것으로 보기 (시연)', 'HQ06.sim')) + '</div>');
    }
    return h.card({ title: x.name, sub: x.kind + ' 서류 검토', body });
  }

  B.screen({
    id: 'HQ-06', side: 'hq', phase: 'P1a', devices: ['pc'], pages: [25],
    title: '운영 개시 승인', menuLabel: '오픈 준비', crumb: '가맹점 관리 > 오픈 준비',
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, c = c6(ctx), K = case6(s, c), ro6 = !ctx.canEdit;
      const sf = staff6(s, c);
      const req = DOCS6.filter(x => x.kind === '필수' && applies6(x, c)), sys = DOCS6.filter(x => x.kind === '시스템' && applies6(x, c));
      const reqOk = req.filter(x => (x.id === 'staff' ? sf.done : (K.docs[x.id] || {}).st === '승인')).length;
      const sysOk = sys.filter(x => (K.docs[x.id] || {}).st === '완료').length;
      const g = gate6(s, c, K), opened = c.status === '운영';
      const head = '<div class="hqb-sub"><h2>' + esc(c.name) + '</h2>' + h.chip(c.type, c.type === '직영' ? 'navy' : c.type === '가맹' ? 'brand' : 'review') + h.status(c.status) +
        '<span class="hqb-sum"' + P(1) + '>' + h.chip('필수 ' + req.length + '개 중 ' + reqOk + '개 승인', reqOk === req.length ? 'ok' : 'line') + h.chip('시스템 ' + sys.length + '개 중 ' + sysOk + '개 완료', sysOk === sys.length ? 'ok' : 'line') + '</span>' +
        '<span class="r">센터 ' + sel('center', c.id, s.centers.map(x => ({ v: x.id, l: x.name + ' · ' + x.status })), { size: 'l', live: true, label: '센터 고르기' }) + '</span></div>';
      const banner = opened ? h.alert(eun(c.name) + ' ' + (K.approvedAt || c.opened) + '에 운영 개시를 승인했어요' + (K.approvedBy ? ' (' + K.approvedBy + ')' : '') + '. 원생 등록과 수납 메뉴가 열려 있어요.' + (K.alimOff ? ' 알림톡 심사가 끝날 때까지 알림은 대체 문자로 나가요.' : ''), 'ok', { title: '승인 완료' }) + '<div style="height:10px"></div>'
        : K.request ? h.alert(K.request.date + ' 센터에 보완을 요청했어요. ' + K.request.reason, 'warn', { title: '보완 요청 보냄' }) + '<div style="height:10px"></div>' : '';
      const rows = DOCS6.map(x => {
        const d = K.docs[x.id] || {}, ap = applies6(x, c);
        let kind = esc(x.kind), stv, file = d.file ? h.btn('파일', { sm: true, act: 'HQ06.file', arg: x.id }) : '-', note = esc(x.note);
        if (x.id === 'ent') kind = '<span' + P(7) + '>' + (ap ? h.chip('가맹 필수', 'review') : h.chip('해당 없음 (직영)', 'review')) + '</span>';
        if (x.id === 'alim') kind = '<span' + P(8) + '>' + esc(x.kind) + ' ' + h.chip('권장', 'review') + '</span>';
        if (x.id === 'staff') { stv = st6(sf.done ? '승인' : sf.n + ' / ' + sf.all + '명'); file = '<span' + P(6) + '>' + h.chip('원본 안 받음', 'review') + '</span>'; }
        else stv = st6(ap ? (d.st || '미제출') : '해당 없음');
        if (x.pin) note = '<span' + P(x.pin) + '>' + note + '</span>';
        return { attr: ' class="click' + (K.sel === x.id ? ' sel' : '') + (ap ? '' : ' off') + '" data-act="HQ06.sel" data-arg="' + x.id + '"', cells: ['<b>' + esc(x.name) + '</b>', kind, stv, file, d.by ? '운영팀 ' + esc(d.by) : '-', note] };
      });
      const table = tbl([{ label: '서류·항목' }, { label: '구분' }, { label: '상태' }, { label: '파일' }, { label: '검토자' }, { label: '비고' }], rows);
      const reqBox = ui.reqOpen && !opened ? '<div class="hqb-box" style="margin-top:10px"><h4>센터에 보완 요청</h4><div class="hqb-fv">' + inp('req_reason', ui.req_reason || '', { size: 'xl', ph: '무엇을 언제까지 보완할지', label: '보완 요청 사유' }) +
        h.btn('보내기', { sm: true, primary: true, act: 'HQ06.request' }) + h.btn('닫기', { sm: true, act: 'HQ06.reqClose' }) + errLine(ui.e_req) + '</div></div>' : '';
      const errOpen = ui.e_open && !opened && g.miss.length ? '<div style="margin-top:10px">' + h.alert('아직 끝나지 않은 항목이 있어요. ' + g.miss.join(', '), 'bad', { title: '승인할 수 없어요' }) + '</div>' : '';
      const warn = !opened && g.warn.length ? '<span class="hqb-note">' + esc(g.warn.map(w => w.name + iga(w.name) + ' ' + w.st + '이어도 승인할 수 있어요').join('. ')) + '</span>' : '';
      const bottom = '<div class="hqb-actions" style="margin-top:12px">' + h.btn('보완 요청', { act: 'HQ06.reqOpen', disabled: ro6 || opened }) +
        '<span class="hqb-actions hqb-pinpad"' + P(4) + '>' + h.btn(opened ? '운영 중' : '운영 개시 승인', { primary: true, act: 'HQ06.open', disabled: ro6 || opened || g.miss.length > 0 }) +
        '<span class="hqb-note">' + (opened ? '승인을 마쳤어요' : g.miss.length ? '필수 항목이 모두 승인돼야 열려요 (남은 ' + g.miss.length + '개)' : '모두 준비됐어요. 승인하면 원생 등록과 수납 메뉴가 열려요') + '</span></span>' + warn + '</div>' + reqBox + errOpen;
      const p2 = h.card({ title: '오픈 준비 체크리스트', pin: 5, right: h.chip('P2', 'p2'), body: '<div class="hqb-note">인테리어 가이드 확인, 간판과 로고, 홍보물, 개원 설명회 일정은 확대 단계에서 붙여요. 회의 결정대로 직영 시범 센터도 이 승인 절차를 똑같이 거쳐요.</div>' });
      return head + banner + table + '<div style="margin-top:12px">' + detail6(ctx, c, K) + '</div>' + '<div style="margin-top:12px">' + p2 + '</div>' + bottom;
    },
    mount(root) { mountLive(root); },
    prd: {
      summary: '새 센터가 문을 열기 전에 서류와 시스템 준비가 끝났는지 확인하고, 본사가 운영 시작을 허락하는 화면이에요. 법에 필요한 서류 없이 수업을 시작하지 않게 막아요.',
      who: '본사 슈퍼관리자와 운영팀이 서류를 검토하고 승인해요. 정산팀과 SV는 보기만 하고, 콘텐츠팀에게는 메뉴가 안 보여요. 센터 원장은 CT-17 자료실에서 서류를 올리고 결과를 봐요.',
      items: [
        { n: 1, t: '필수 서류', d: '법정 서류와 본사 요구 서류를 나눠 받아요. 센터는 CT-17 자료실에서 올려요. 보험처럼 만료일이 있는 서류는 만료 30일 전(예시)에 다시 요청해요. 줄을 누르면 아래에서 바로 검토해요.', ref: 'p.25 ①' },
        { n: 2, t: '교습비 등록 대조', d: '교육청에 등록한 상품별 금액과 센터 교습 상품(CT-18)을 하나씩 맞춰 봐요. 아직 등록하지 않은 상품은 판매가 잠기고, 등록 금액보다 비싼 상품이 있으면 승인하지 못해요.', pol: ['POL-12'], ref: 'p.25 ②' },
        { n: 3, t: '종사자 경력 조회', d: '원장, 강사, 보조요원 모두 성범죄와 아동학대 경력 조회일이 있어야 해요(CT-20). 한 명이라도 빠지면 승인 버튼이 켜지지 않아요. 인천송도센터(가맹) 예시는 원장 윤가람과 실장 조은솔이 2027년 10월에 조회를 마친 상태라, 서류만 갖추면 승인까지 이어져요. 동탄센터는 보조교사 한 명이 아직 조회 전이에요.', ref: 'p.25 ③' },
        { n: 4, t: '승인의 효과', d: '필수 항목이 모두 승인돼야 운영 개시 승인 버튼이 켜져요. 승인하면 센터가 운영 상태가 되고 원생 등록과 수납 메뉴가 열려요. 가맹 센터는 다음 달 1일부터 사용료를 내요. 부족하면 보완 요청으로 센터에 돌려보내요.', pol: ['POL-02', 'POL-04'], ref: 'p.25 ④' },
        { n: 5, t: '직영도 같은 절차', d: '회의 결정대로 직영 시범 센터도 이 절차를 거쳐요. 인테리어와 간판 같은 오픈 준비 체크리스트는 확대 단계(P2)에서 붙여요.', ref: 'p.25 ⑤' },
        { n: 6, kind: 'review', imp: 'IMP-16', t: '조회일만 남기고 원본은 안 받아요', d: '범죄경력 조회 결과 원본은 민감정보일 수 있어서 본사가 받지 않아요(법무 확인이 남아 있어요). 조회일, 조회 기관, 확인한 사람만 남기고, 조회 전인 사람은 수업에 배치되지 않아요.' },
        { n: 7, kind: 'review', imp: 'IMP-04', t: '직영은 위탁계약이 해당 없어요', d: '직영 센터는 본사가 직접 운영해서 본사와 센터 사이 위탁계약을 맺을 상대가 없어요. 위탁계약은 가맹 센터에만 필수로 걸어요. 그래서 동탄센터는 필수 서류가 7개가 아니라 6개예요.', pol: ['POL-42'] },
        { n: 8, kind: 'review', imp: 'IMP-06', t: '외부 심사 항목은 경고만', d: '알림톡 발신 프로필은 외부 심사를 거쳐서 언제 끝날지 우리가 정할 수 없어요. 그래서 승인 조건에서 빼고 경고만 띄워요. 심사가 끝나기 전에는 미리 등록한 대체 문자 발신번호로 알림을 보내요.' },
      ],
      open: ['시스템 항목 가운데 무엇까지 끝나야 승인되는지(지금은 키오스크와 결제 연동만 조건)', '만료 서류 재요청 시점 30일(예시)과 기한을 넘겼을 때 조치', '승인 전 센터에서 열어 둘 메뉴(상담 예약, 대기자)', '가맹 사용료 과금 기준과 청구 방식(POL-02, POL-04)'],
    },
  });

  LIVE_HOOK['HQ-06:center'] = u => { ['e_open', 'e_doc', 'e_req', 'reqOpen', 'ins_exp', 'doc_reason'].forEach(k => { delete u[k]; }); };
  act('HQ06.center', (ctx, id) => { if (!B.center(id)) return; LIVE_HOOK['HQ-06:center'](ctx.ui); ctx.ui.center = id; });
  act('HQ06.sel', (ctx, id) => { const c = c6(ctx), K = case6(ctx.s, c); K.sel = id; ctx.ui.e_doc = null; });
  act('HQ06.file', (ctx, id) => { const c = c6(ctx), K = case6(ctx.s, c); K.sel = id; say('제출 파일을 열어요 (예시).'); });
  act('HQ06.ok', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui, c = c6(ctx), K = case6(s, c);
    const id = arg && typeof arg === 'object' ? arg.doc : arg;
    if (arg && typeof arg === 'object' && arg.exp) ui.ins_exp = arg.exp;
    if (!ctx.canEdit || !id) return;
    const d = K.docs[id] = K.docs[id] || {}; K.sel = id;
    if (!d.file) { ui.e_doc = '센터가 아직 올리지 않았어요.'; return; }
    if (id === 'fee') { const bad = feeCheck(s, K).filter(f => f.res === 'over'); if (bad.length) { ui.e_doc = '등록 금액보다 비싼 상품이 있어요. ' + bad.map(f => f.name).join(', ') + '. CT-18에서 판매가를 고치거나 교육청 변경신고를 먼저 해요.'; return; } }
    if (id === 'ins') { const exp = ui.ins_exp != null ? ui.ins_exp : d.exp; if (!okDate(exp)) { ui.e_doc = '보험 만료일을 넣어 주세요.'; return; } if (exp <= day6(ctx, c)) { ui.e_doc = '이미 끝난 보험이에요. 새 증권을 받아 주세요.'; return; } d.exp = exp; }
    d.st = '승인'; d.by = ctx.persona.name; d.at = day6(ctx, c); ui.e_doc = null;
    const nx = DOCS6.find(x => x.kind === '필수' && applies6(x, c) && x.id !== 'staff' && (K.docs[x.id] || {}).st !== '승인');
    if (nx) K.sel = nx.id;
    say(eul((DOCS6.find(x => x.id === id) || {}).name) + ' 승인했어요.' + (id === 'ins' ? ' 만료 30일 전에 다시 요청할게요.' : ''));
  });
  act('HQ06.back', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui, c = c6(ctx), K = case6(s, c);
    const id = arg && typeof arg === 'object' ? arg.doc : arg;
    if (arg && typeof arg === 'object' && arg.reason) ui.doc_reason = arg.reason;
    if (!ctx.canEdit || !id) return;
    const reason = String(ui.doc_reason || '').trim();
    if (!reason) { K.sel = id; ui.e_doc = '무엇을 보완할지 사유를 적어 주세요.'; return; }
    const d = K.docs[id]; d.st = '보완 요청'; d.reason = reason; ui.doc_reason = ''; ui.e_doc = null;
    say('센터에 이 서류 보완을 요청했어요. CT-17 자료실에 떠요.');
  });
  act('HQ06.sim', (ctx, id) => {
    const c = c6(ctx), K = case6(ctx.s, c), x = DOCS6.find(d => d.id === id); if (!x) return;
    K.docs[id] = Object.assign(K.docs[id] || {}, { st: '검토 중', file: x.name.split(' ')[0] + '.pdf', at: day6(ctx, c) }); K.sel = id; ctx.ui.e_doc = null;
  });
  act('HQ06.sysDone', (ctx, id) => { const c = c6(ctx), K = case6(ctx.s, c); K.docs[id] = Object.assign(K.docs[id] || {}, { st: '완료' }); K.sel = id; });
  act('HQ06.staffSim', ctx => {
    const s = ctx.s, c = c6(ctx), K = case6(s, c);
    const day = day6(ctx, c);
    staffOf(s, c).forEach(p => { if (!p.check) { p.check = day; if (/경력 조회 전/.test(p.status)) p.status = '활성'; } });
    K.sel = 'staff';
    say('모든 교직원의 경력 조회일이 들어왔어요.');
  });
  act('HQ06.reqOpen', ctx => { if (ctx.canEdit) { ctx.ui.reqOpen = true; ctx.ui.e_req = null; } });
  act('HQ06.reqClose', ctx => { ctx.ui.reqOpen = false; ctx.ui.e_req = null; });
  act('HQ06.request', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui, c = c6(ctx), K = case6(s, c);
    if (arg && typeof arg === 'object' && arg.reason) ui.req_reason = arg.reason;
    if (!ctx.canEdit || c.status === '운영') return;
    const reason = String(ui.req_reason || '').trim();
    if (!reason) { ui.reqOpen = true; ui.e_req = '무엇을 보완할지 적어 주세요.'; return; }
    K.request = { date: day6(ctx, c), reason, by: ctx.persona.name };
    ui.reqOpen = false; ui.req_reason = ''; ui.e_req = null;
    audit(ctx, '운영 개시 보완 요청', c.name, reason);
    say('센터에 보완 요청을 보냈어요. CT-17 자료실과 알림에 떠요.');
  });
  act('HQ06.open', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui;
    if (arg && typeof arg === 'object' && arg.center && B.center(arg.center)) ui.center = arg.center;
    const c = c6(ctx), K = case6(s, c);
    if (!ctx.canEdit) return;
    if (c.status === '운영') { say('이미 운영 중인 센터예요.'); return; }
    const g = gate6(s, c, K);
    if (g.miss.length) { ui.e_open = true; return; }
    ui.e_open = null;
    const day = day6(ctx, c);
    c.status = '운영'; c.opened = day;
    K.approvedAt = day; K.approvedBy = ctx.persona.name; K.alimOff = g.warn.length > 0; K.request = null;
    staffOf(s, c).forEach(p => { if (/운영 개시 전/.test(p.status)) p.status = '활성'; });
    audit(ctx, '운영 개시 승인', c.name, '필수 서류와 시스템 확인');
    say(eul(c.name) + ' 운영으로 바꿨어요. 원생 등록과 수납 메뉴가 열렸어요.' + (c.type !== '직영' ? ' 다음 달 1일부터 사용료 과금 대상이에요.' : ''));
  });

  /* =====================================================================
     HQ-07 정책 현황·변경 이력 (p.26)
     ===================================================================== */
  const MONEY = ['POL-01', 'POL-02', 'POL-03', 'POL-04', 'POL-05', 'POL-06', 'POL-09', 'POL-11', 'POL-13', 'POL-14', 'POL-19', 'POL-20', 'POL-27', 'POL-28', 'POL-34'];
  const unconf = st => st === '미정' || st === '안' || st === '예시';
  function editScreen(code) {
    const n = Number(code.slice(4));
    if (n <= 5 || n === 44) return 'HQ-08'; if (n <= 9) return 'HQ-09'; if (n <= 14) return 'HQ-10'; if (n <= 24) return 'HQ-11'; if (n === 25) return 'HQ-12';
    if ([29, 31, 32, 33].includes(n)) return 'HQ-13'; if (n <= 30) return 'HQ-14'; return 'HQ-15';
  }
  function resvKey(r) {
    if (!r) return '';
    if (r.full) return r.full;
    const m = /(\d+)\/(\d+)/.exec(r.date || ''); if (!m) return '9999';
    const y = Number(m[1]) >= 3 ? 2027 : 2028;
    return y + '-' + String(m[1]).padStart(2, '0') + '-' + String(m[2]).padStart(2, '0');
  }
  function polRows(s) {
    return (B.POLICIES || []).map(p => {
      const st = s.pol[p.code] || {};
      const status = st.status || p.status;
      const g = Object.keys(st.groups || {}).length, cn = Object.keys(st.centers || {}).length;
      return { p, st, status, value: st.value != null ? st.value : p.now, scope: status === '법정' ? '-' : '기본' + (g ? ', 그룹 ' + g : '') + (cn ? ', 센터 ' + cn : ''), resv: st.reserved || null, money: MONEY.includes(p.code), temp: st.temp || null };
    });
  }
  function filt7(rows, ui) {
    return rows.filter(r => {
      if (ui.cat && ui.cat !== '전체' && r.p.cat !== ui.cat) return false;
      if (ui.st && ui.st !== '전체') { if (ui.st === '미확정' && !unconf(r.status)) return false; if (ui.st !== '미확정' && r.status !== ui.st) return false; }
      if (ui.dep && ui.dep !== '전체' && r.p.decider !== ui.dep) return false;
      if (ui.when && ui.when !== '전체' && r.p.when.indexOf(ui.when) < 0) return false;
      if (ui.resv && !r.resv) return false;
      if (ui.money && !(r.money && unconf(r.status))) return false;
      const q = String(ui.qq || '').trim();
      if (q && (r.p.code + ' ' + r.p.name).toLowerCase().indexOf(q.toLowerCase()) < 0) return false;
      return true;
    });
  }
  function histRows(s) {
    const out = [];
    Object.keys(s.pol).forEach(code => (s.pol[code].history || []).forEach((e, i) => out.push({ code, i, e })));
    // 화면에서 방금 바꾼 기록(예시가 아닌 것)을 맨 위에 둔다
    const rank = e => (e.seed ? 0 : 1);
    return out.sort((a, b) => rank(b.e) - rank(a.e) || ((b.e.date || '') + (b.e.at || '')).localeCompare((a.e.date || '') + (a.e.at || '')) || (b.e.seq || 0) - (a.e.seq || 0) || b.i - a.i);
  }
  const histText = e => e.text || chg(e.from, e.to);

  function list7(ctx, rows) {
    const ui = ctx.ui, per = 12, pages = Math.max(1, Math.ceil(rows.length / per)), pg = Math.min(pages, Math.max(1, ui.pg || 1));
    const show = rows.slice((pg - 1) * per, pg * per);
    const moneyMode = !!ui.money;
    const cols = [{ label: '코드', w: '70px' }, { label: '정책' }, { label: '현재 값' }, { label: '<span' + P(3) + '>상태</span>', raw: true }, { label: '적용 범위' }, { label: '<span' + P(4) + '>다음 변경</span>', raw: true }, { label: '결정 부서' }, { label: '시점' }];
    if (moneyMode) cols.push({ label: '점검' });
    const tr = show.map(r => {
      const cells = ['<span class="mono">' + esc(r.p.code) + '</span>',
        esc(r.p.name) + (r.money && unconf(r.status) ? ' ' + h.chip('돈 계산', 'review') : '') + (r.temp ? ' ' + h.chip('임시 적용 승인', 'line') : ''),
        '<span class="' + (r.status === '안' || r.status === '예시' ? 'hqb-blue' : '') + '">' + esc(r.value) + '</span>',
        stChip(r.status), esc(r.scope), r.resv ? '<span class="hqb-next">' + esc(r.resv.date) + '부터 ' + esc(r.resv.value) + '</span>' : '-', esc(r.p.decider), esc(r.p.when)];
      if (moneyMode) cells.push(r.temp ? '<span class="hqb-note">' + esc(r.temp.by + ' ' + r.temp.date) + '</span>' : h.btn('임시 적용 승인', { sm: true, act: 'HQ07.temp', arg: r.p.code, disabled: !ctx.canEdit }));
      return { attr: ' class="click" data-act="HQ07.open" data-arg="' + r.p.code + '" title="' + esc(editScreen(r.p.code)) + ' 편집 화면으로 가요"', cells };
    });
    const pager = pages > 1 ? '<div class="hqb-pager">' + Array.from({ length: pages }, (x, i) => h.btn(String(i + 1), { sm: true, primary: i + 1 === pg, act: 'HQ07.page', arg: String(i + 1) })).join('') + '</div>' : '';
    const moneyNote = moneyMode ? '<div style="margin-bottom:8px">' + h.alert('돈이 오가는 정책이 아직 (안)이에요. 청구와 판매에 쓰려면 확정하거나 슈퍼관리자가 임시 적용을 승인해야 해요.' + (ui.e_temp ? ' ' + ui.e_temp : ''), ui.e_temp ? 'bad' : 'review', { title: '검토 반영' }) + '</div>' : '';
    return moneyNote + tbl(cols, tr, { pin: 2, empty: '조건에 맞는 정책이 없어요.' }) + '<div class="hqb-note" style="margin-top:6px">줄을 누르면 그 정책의 편집 화면(HQ-08~15)으로 가요. ' + rows.length + '개 중 ' + show.length + '개를 보고 있어요.</div>' + pager;
  }
  function log7(ctx) {
    const s = ctx.s, list = histRows(s);
    return tbl([{ label: '일시' }, { label: '정책' }, { label: '변경 내용' }, { label: '범위' }, { label: '변경자' }, { label: '근거' }, { label: '영향 센터', num: true }, { label: '' }], list.map(x => ({
      cells: ['<span class="mono">' + esc(x.e.date + (x.e.at ? ' ' + x.e.at : '')) + '</span>', '<span class="mono">' + esc(x.code) + '</span>', esc(histText(x.e)) + (x.e.undone ? ' ' + h.chip('되돌림', 'line') : ''), esc(x.e.scope || '기본값'),
        esc((x.e.role ? x.e.role + ' ' : '') + (x.e.by || '-')), esc(x.e.reason || '-'), String(x.e.n == null ? '-' : x.e.n),
        x.e.undo && !x.e.undone ? h.btn('되돌리기', { sm: true, act: 'HQ07.undo', arg: x.code + '#' + x.i, disabled: !ctx.canEdit }) : ''],
    })), { empty: '아직 바꾼 기록이 없어요.' }) + '<div class="hqb-note" style="margin-top:6px">되돌리기도 새 변경으로 남아요. 정책 편집 화면에서 저장한 기록만 되돌릴 수 있어요.</div>';
  }
  function dec7(ctx) {
    const s = ctx.s, ui = ctx.ui, R = (B.REVIEW.decisions || []);
    const f = ui.dfilter || '전체';
    const list = s.decisions.filter(d => f === '전체' || (f === '미결' ? d.status !== '결정' : d.status === '결정'));
    const selNo = ui.dsel != null ? Number(ui.dsel) : (s.decisions.find(d => d.status !== '결정') || s.decisions[0] || {}).no;
    const owners = {}; s.decisions.filter(d => d.status !== '결정').forEach(d => String(d.owner).split(/,\s*/).forEach(o => { owners[o] = (owners[o] || 0) + 1; }));
    const head = '<div class="hqb-actions" style="margin-bottom:8px">' + h.opts(['전체', '미결', '결정'], f, { act: 'HQ07.dfilter' }) + '<span class="hqb-note">미결 ' + s.decisions.filter(d => d.status !== '결정').length + ' / ' + s.decisions.length + '</span>' +
      Object.keys(owners).map(o => h.chip(o + ' ' + owners[o], 'line')).join('') + '</div>';
    const detailOf = d => {
      const r = R.find(x => x.no === d.no) || {};
      return '<div><h4 style="margin:0 0 6px;font-size:12.5px">#' + d.no + ' ' + esc(d.topic) + '</h4>' +
        form([{ l: '쉬운 설명', v: esc(r.easy || '-') }, { l: '기본안 (검토 의견)', v: '<span style="line-height:1.55">' + esc(r.recommendation || '-') + '</span>' }, { l: '결정자 · 마감', v: esc(d.owner + ' · ' + d.deadline) }]) +
        (d.status === '결정' ? '<div class="hqb-note" style="margin-top:6px">' + esc('결정 ' + d.decided + (d.meeting ? ', 근거 ' + d.meeting : '') + (d.by ? ', 기록 ' + d.by : '')) + '</div>'
          : '<div class="hqb-fv" style="margin-top:8px">' + inp('dec_text', ui.dec_text || '', { size: 'l', ph: '무엇으로 정했는지', dis: !ctx.canEdit, label: '결정 내용' }) + inp('dec_meet', ui.dec_meet || '', { size: 'm', ph: '근거 회의나 결재', dis: !ctx.canEdit, label: '근거 회의' }) +
            check(ui.dec_conf !== false, '관련 정책을 확정으로 바꿔요', { act: 'HQ07.dconf', arg: '1', dis: !ctx.canEdit }) + h.btn('결정 기록', { sm: true, primary: true, act: 'HQ07.decide', arg: String(d.no), disabled: !ctx.canEdit }) + errLine(ui.e_dec) + '</div>') + '</div>';
    };
    const trs = [];
    list.forEach(d => {
      trs.push({ attr: ' class="click' + (d.no === selNo ? ' sel' : '') + '" data-act="HQ07.dsel" data-arg="' + d.no + '"',
        cells: ['<b>#' + d.no + '</b>', esc(d.topic), (d.policies || []).map(c => h.polChip(c)).join(' '), esc(d.owner), esc(d.deadline), d.status === '결정' ? h.chip('결정', 'ok') : h.chip('미결', 'warn'), esc(d.decided || '-')] });
      if (d.no === selNo) trs.push({ attr: ' class="exp"', full: detailOf(d) });
    });
    const table = tbl([{ label: '번호', w: '48px' }, { label: '정할 일' }, { label: '관련 정책' }, { label: '결정자' }, { label: '마감 (제안)' }, { label: '상태' }, { label: '결정 내용' }], trs, { empty: '조건에 맞는 결정이 없어요.' });
    const detail = '';
    return h.alert('마감까지 결정이 나지 않으면 문서의 (안) 값을 시범 확정값으로 써요. 결정을 기록하면 관련 정책이 확정으로 바뀌고 변경 이력에 남아요.', 'review', { title: '검토 반영' }) + '<div style="height:10px"></div>' + head + table + detail;
  }

  B.screen({
    id: 'HQ-07', side: 'hq', phase: 'P1a', devices: ['pc'], pages: [26],
    title: '정책 현황·변경 이력', menuLabel: '정책 현황', crumb: '정책·요금 설정 > 정책 현황',
    headActions: ctx => '<span' + P(6) + '>' + h.btn('결정 요청 목록 출력', { act: 'HQ07.print' }) + '</span>',
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, rows = polRows(s);
      const nOpen = rows.filter(r => unconf(r.status)).length, nLegal = rows.filter(r => r.status === '법정').length;
      // 대시보드(HQ-01)와 같은 기준. P1a에 쓰는 정책 가운데 아직 확정하지 않은 수
      const nOpenA = rows.filter(r => unconf(r.status) && /P1a/.test(r.p.when)).length;
      const resv = rows.filter(r => r.resv).sort((a, b) => resvKey(a.resv).localeCompare(resvKey(b.resv)));
      const nMoney = rows.filter(r => r.money && unconf(r.status)).length, nTemp = rows.filter(r => r.money && unconf(r.status) && r.temp).length;
      const cats = (B.POLICIES || []).map(p => p.cat).filter((v, i, a) => a.indexOf(v) === i);
      const kv = ui.kq || 'all';
      const k = (o) => '<div class="kpi' + (o.tone ? ' ' + o.tone : '') + (kv === o.key ? ' on' : '') + '" role="button" data-act="HQ07.kpi" data-arg="' + o.key + '"' + P(o.pin) + '><div class="l">' + esc(o.l) + '</div><div class="v">' + o.v + '</div><div class="s">' + esc(o.s) + '</div></div>';
      const kpis = '<div class="hqb-k5">' +
        k({ key: 'all', l: '전체 정책', v: rows.length, s: '분류 ' + cats.length, pin: 1 }) +
        k({ key: 'open', l: '미확정 (안)', v: nOpenA, s: 'P1a에 쓰는 정책, 전체 ' + nOpen + '개', tone: 'warn' }) +
        k({ key: 'legal', l: '법정', v: nLegal, s: '수정 불가' }) +
        k({ key: 'resv', l: '예약 변경', v: resv.length, s: resv.length ? '다음 ' + resv[0].resv.date : '없음' }) +
        k({ key: 'money', l: '돈 계산에 쓰는 미확정', v: nMoney, s: '임시 적용 승인 ' + nTemp + '개', tone: 'rv', pin: 8 }) + '</div>';
      const deps = ['전체'].concat((B.POLICIES || []).map(p => p.decider).filter((v, i, a) => a.indexOf(v) === i));
      const filters = '<div class="hqb-filter">' +
        '<label>분류 ' + sel('cat', ui.cat || '전체', [{ v: '전체', l: '전체' }].concat(cats.map(c => ({ v: c, l: c + ' ' + ((B.POLICIES || []).find(p => p.cat === c) || {}).catName }))), { size: 's', live: true, label: '분류' }) + '</label>' +
        '<label>상태 ' + sel('st', ui.st || '전체', ['전체', '미확정', '확정', '법정'], { size: 's', live: true, label: '상태' }) + '</label>' +
        '<label>결정 부서 ' + sel('dep', ui.dep || '전체', deps, { size: 's', live: true, label: '결정 부서' }) + '</label>' +
        '<label>시점 ' + sel('when', ui.when || '전체', ['전체', 'P1a', 'P1b'], { size: 'xs', live: true, label: '시점' }) + '</label>' +
        inp('q', ui.q || '', { size: 'm', ph: '정책명·코드', label: '검색어' }) + h.btn('검색', { act: 'HQ07.search' }) +
        ((ui.resv || ui.money || (ui.st && ui.st !== '전체') || ui.qq) ? h.btn('조건 지우기', { sm: true, ghost: true, act: 'HQ07.kpi', arg: 'all' }) : '') + '</div>';
      const view = ui.view || 'list', hist = histRows(s), openDec = s.decisions.filter(d => d.status !== '결정').length;
      const tabs = '<div class="tabs hqb-itabs">' +
        '<button type="button" class="' + (view === 'list' ? 'on' : '') + '" data-act="HQ07.view" data-arg="list">정책 목록 <span class="n">' + filt7(rows, ui).length + '</span></button>' +
        '<button type="button" class="' + (view === 'log' ? 'on' : '') + '" data-act="HQ07.view" data-arg="log"' + P(5) + '>변경 이력 <span class="n">' + hist.length + '</span></button>' +
        '<button type="button" class="' + (view === 'dec' ? 'on' : '') + '" data-act="HQ07.view" data-arg="dec"' + P(7) + '>결정 관리표 <span class="n">미결 ' + openDec + '</span></button></div>';
      const body = view === 'log' ? log7(ctx) : view === 'dec' ? dec7(ctx) : list7(ctx, filt7(rows, ui));
      return kpis + '<div style="height:10px"></div>' + filters + tabs + body;
    },
    mount(root) { mountLive(root); },
    prd: {
      summary: '정책 44개가 지금 정해졌는지, 언제 바뀔 예정인지, 누가 왜 바꿨는지를 한 화면에서 봐요. 아직 안 정한 정책을 빨리 결정하도록 재촉하는 화면이에요.',
      who: '슈퍼관리자는 보고 고쳐요. 운영팀과 정산팀은 일부만 고치고, SV는 보기만 해요. 콘텐츠팀에게는 메뉴가 안 보여요.',
      items: [
        { n: 1, t: '요약', d: '전체, 미확정, 법정, 예약 변경 수를 보여 줘요. 미확정 카드는 원문 예시처럼 P1a에 쓰는 정책 가운데 아직 확정하지 않은 31개를 세서 대시보드(HQ-01)와 같은 숫자예요. P1b 정책까지 더하면 40개라서 카드 아래에 함께 적었어요. 법정은 원문 그림에 5개로 나오지만 7장 정책 목록에서 법정인 것은 POL-12, 17, 25, 41 네 개라서 목록대로 4를 보여 줘요. 카드를 누르면 아래 목록이 그 조건으로 걸러져요.', ref: 'p.26 ①' },
        { n: 2, t: '정책 목록', d: '7장 정책 목록과 같은 데이터를 한 곳에서만 관리해요. 줄을 누르면 그 정책의 편집 화면(HQ-08~15)으로 가요. 적용 범위에는 그룹 값과 개별 센터 값이 몇 개인지 보여요.', pol: ['POL-44'], ref: 'p.26 ②' },
        { n: 3, t: '상태', d: '미확정(안)은 회의 안이나 예시 값이라 모든 화면에 (안)이 붙어요. 확정은 결재가 끝난 값이고, 법정은 법령 값이라 고칠 수 없어요.', ref: 'p.26 ③' },
        { n: 4, t: '예약 변경', d: '적용 시작일이 앞으로인 변경을 보여 줘요. 그날 0시에 바뀌어요.', ref: 'p.26 ④' },
        { n: 5, t: '변경 이력', d: '바뀌기 전 값과 바뀐 값, 범위, 바꾼 사람, 근거, 영향 센터 수를 남겨요. 되돌릴 때도 새 변경으로 기록해요.', ref: 'p.26 ⑤' },
        { n: 6, t: '결정 요청 목록', d: '미확정 정책을 결정 부서별로 묶어 출력해요. 부록 A와 같은 형식이에요.', ref: 'p.26 ⑥' },
        { n: 7, kind: 'review', imp: 'IMP-01', t: '결정 관리표', d: '부록 A의 정할 일에는 마감일과 결정자가 없어서 누가 언제까지 정할지 알 수 없었어요. 결정마다 결정자, 마감, 기본안, 상태를 한 표로 보고, 결정을 기록하면 관련 정책이 확정으로 바뀌고 이력이 남아요. 마감까지 못 정하면 (안) 값을 시범 확정값으로 쓰기로 미리 정해 둬요.' },
        { n: 8, kind: 'review', imp: 'IMP-10', t: '돈 계산 정책 점검', d: '사용료나 테스트비처럼 돈이 오가는 정책이 아직 (안)이면 청구와 판매에 그대로 쓰일 수 있어요. 그런 정책 수를 따로 세고, 쓰려면 슈퍼관리자가 임시 적용을 승인한 기록을 남겨요.', pol: ['POL-01', 'POL-27'] },
      ],
      open: ['정책을 확정으로 바꿀 때 누가 어떻게 결재하는지', '예약 변경을 취소하거나 고치는 방법', '법령이 바뀔 때 법정 값을 누가 어디서 고치는지'],
    },
  });

  LIVE_HOOK['HQ-07:cat'] = u => { u.pg = 1; };
  LIVE_HOOK['HQ-07:st'] = u => { u.pg = 1; u.kq = u.st === '미확정' ? 'open' : u.st === '법정' ? 'legal' : 'all'; u.resv = false; u.money = false; };
  LIVE_HOOK['HQ-07:dep'] = u => { u.pg = 1; };
  LIVE_HOOK['HQ-07:when'] = u => { u.pg = 1; };
  act('HQ07.view', (ctx, v) => { ctx.ui.view = v; });
  act('HQ07.kpi', (ctx, v) => {
    const ui = ctx.ui; ui.kq = v; ui.pg = 1; ui.view = 'list'; ui.resv = false; ui.money = false; ui.e_temp = null;
    if (v === 'all') { ui.st = '전체'; ui.cat = '전체'; ui.dep = '전체'; ui.when = '전체'; ui.q = ''; ui.qq = ''; }
    if (v !== 'all') ui.when = v === 'open' ? 'P1a' : '전체';
    if (v === 'open') ui.st = '미확정';
    if (v === 'legal') ui.st = '법정';
    if (v === 'resv') { ui.st = '전체'; ui.resv = true; }
    if (v === 'money') { ui.st = '전체'; ui.money = true; }
  });
  act('HQ07.search', (ctx, q) => { if (typeof q === 'string') ctx.ui.q = q; ctx.ui.qq = ctx.ui.q || ''; ctx.ui.pg = 1; ctx.ui.view = 'list'; });
  act('HQ07.page', (ctx, n) => { ctx.ui.pg = Number(n) || 1; });
  act('HQ07.open', (ctx, code) => { const id = editScreen(code); if (!B.screens[id]) { say(id + ' 화면은 아직 준비 중이에요.'); return; } B.go(id); return false; });
  act('HQ07.temp', (ctx, code) => {
    const s = ctx.s;
    if (!ctx.canEdit) return;
    if (ctx.role !== '슈퍼관리자') { ctx.ui.e_temp = '임시 적용은 슈퍼관리자만 승인할 수 있어요.'; say(ctx.ui.e_temp); return; }
    const st = s.pol[code] = s.pol[code] || {}, status = st.status || h.pol(code).status;
    const u = undoItem(s, 'pol', [code, 'temp']);
    st.temp = { by: ctx.persona.name, date: ctx.today };
    polHist(ctx, code, { from: stLabel(status), to: stLabel(status) + ', 임시 적용 승인', text: '임시 적용 승인 (시범 운영에 (안) 값 사용)', scope: '기본값', reason: '돈 계산 정책 점검', n: opCount(s), undo: [u] });
    ctx.ui.e_temp = null;
    say(code + ' 임시 적용을 승인했어요. 변경 이력에 남았어요.');
  });
  act('HQ07.undo', (ctx, key) => {
    const s = ctx.s, m = /^(POL-\d+)#(\d+)$/.exec(String(key || '')); if (!m || !ctx.canEdit) return;
    const st = s.pol[m[1]] || {}, e = (st.history || [])[Number(m[2])];
    if (!e || !e.undo || e.undone) return;
    undoApply(s, e.undo);
    e.undone = true;
    polHist(ctx, m[1], { from: e.to, to: e.from, text: '되돌리기, ' + histText(e), scope: e.scope, reason: '되돌리기 (' + e.date + ' 변경)', n: e.n });
    say('되돌렸어요. 되돌린 것도 새 변경으로 남았어요.');
  });
  act('HQ07.print', ctx => {
    const rows = polRows(ctx.s).filter(r => unconf(r.status));
    const g = {}; rows.forEach(r => { (g[r.p.decider] = g[r.p.decider] || []).push(r); });
    const body = Object.keys(g).map(k => '<div><b>' + esc(k) + ' (' + g[k].length + ')</b><div class="hqb-note">' + g[k].map(r => esc(r.p.code + ' ' + r.p.name + ', ' + stLabel(r.status) + ', ' + r.p.when)).join('<br>') + '</div></div>').join('');
    B.modal({ title: '결정 요청 목록 (미확정 ' + rows.length + '개)', body: '<div class="hqb-note">부록 A와 같은 형식으로 결정 부서별로 묶었어요.</div><div style="max-height:380px;overflow:auto;display:flex;flex-direction:column;gap:10px">' + body + '</div>', ok: '출력', cancel: '닫기', onOk: () => { say('결정 요청 목록을 출력했어요 (시연).'); return true; } });
    return false;
  });
  act('HQ07.dfilter', (ctx, v) => { ctx.ui.dfilter = v; });
  act('HQ07.dsel', (ctx, no) => { ctx.ui.dsel = Number(no); ctx.ui.e_dec = null; ctx.ui.view = 'dec'; });
  act('HQ07.dconf', ctx => { ctx.ui.dec_conf = ctx.ui.dec_conf === false; });
  act('HQ07.decide', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui;
    let no = Number(arg);
    if (arg && typeof arg === 'object') { no = Number(arg.no); if (arg.text != null) ui.dec_text = arg.text; if (arg.meeting != null) ui.dec_meet = arg.meeting; if (arg.confirm === false) ui.dec_conf = false; }
    ui.view = 'dec'; if (no) ui.dsel = no;
    if (!ctx.canEdit) return;
    const d = s.decisions.find(x => x.no === no); if (!d) return;
    if (d.status === '결정') { say('이미 결정한 건이에요.'); return; }
    const text = String(ui.dec_text || '').trim(), meet = String(ui.dec_meet || '').trim();
    ui.e_dec = !text ? '무엇으로 정했는지 적어 주세요.' : !meet ? '근거 회의나 결재 문서를 적어 주세요.' : null;
    if (ui.e_dec) return;
    d.status = '결정'; d.decided = text + ' (' + ctx.today + ')'; d.meeting = meet; d.by = ctx.persona.name;
    let n = 0;
    if (ui.dec_conf !== false) (d.policies || []).forEach(code => {
      const st = s.pol[code] = s.pol[code] || {}, old = st.status || h.pol(code).status;
      if (old === '법정' || old === '확정') return;
      const u = undoItem(s, 'pol', [code, 'status']);
      st.status = '확정'; n++;
      polHist(ctx, code, { from: stLabel(old), to: '확정', text: '결정 #' + d.no + ' 기록으로 확정 (' + text + ')', scope: '기본값', reason: meet, n: opCount(s), undo: [u] });
    });
    ui.dec_text = ''; ui.dec_meet = ''; ui.dec_conf = true;
    const nx = s.decisions.find(x => x.status !== '결정'); if (nx) ui.dsel = nx.no;
    say('결정 #' + d.no + ' 내용을 기록했어요.' + (n ? ' 관련 정책 ' + n + '개가 확정으로 바뀌었어요.' : ''));
  });

  /* =====================================================================
     HQ-08 시스템 사용료 (편집 공통 패턴, p.27)
     ===================================================================== */
  const C8 = 'POL-01';
  const WHEN8 = '2027-11-01 0시 예약';
  const OPT8 = [
    { k: 'basis', code: 'POL-02', label: '과금 기준', list: ['학습 계정 활성 수', '기준일 재원생', '출석 1회 이상'] },
    { k: 'mid', code: 'POL-03', label: '월중 등록', list: ['전액', '일할', '다음 달부터'] },
    { k: 'out', code: 'POL-03', label: '퇴원 시', list: ['반환 없음', '일할 반환'] },
    { k: 'pay', code: 'POL-04', label: '청구 방식', list: ['선불', '후불'] },
    { k: 'billDay', code: 'POL-04', label: '청구일', unit: '일' },
    { k: 'due', code: 'POL-04', label: '납부기한', unit: '일' },
    { k: 'od1', code: 'POL-05', label: '안내', unit: '일' },
    { k: 'od2', code: 'POL-05', label: '경고', unit: '일' },
    { k: 'od3', code: 'POL-05', label: '신규 원생 등록 제한', unit: '일' },
  ];
  const baseVal8 = st => (st.value != null ? st.value : '20,000원');
  function scopeVal8(st, scope, ui) {
    const base = baseVal8(st);
    if (scope === '가맹' || scope === '테스트베드' || scope === '직영') { const g = (st.groups || {})[scope]; return g ? g.value : base; }
    if (scope === '개별 센터') { const cid = ui.p_center || 'busan', x = (st.centers || {})[cid]; if (x) return x.value; const c = B.center(cid); const g = c && (st.groups || {})[c.type]; return g ? g.value : base; }
    return base;
  }
  function init8(ctx) {
    const ui = ctx.ui, st = ctx.s.pol[C8] = ctx.s.pol[C8] || {};
    if (ui[C8 + ':scope'] && ui[C8 + ':scope'].indexOf('개별') === 0) ui[C8 + ':scope'] = '개별 센터';
    if (ui[C8 + ':draft'] == null) ui[C8 + ':draft'] = scopeVal8(st, ui[C8 + ':scope'] || '본사 기본값', ui);
    if (ui[C8 + ':when'] == null) ui[C8 + ':when'] = WHEN8;
    return st;
  }
  // 센터 값, 그룹 값, 기본값 순서로 찾는다 (12쪽 규칙, 청구서와 같은 순서)
  function eff8(st, c) {
    const x = (st.centers || {})[c.id]; if (x) return { v: toN(x.value), from: '개별 값' };
    const g = (st.groups || {})[c.type]; if (g) return { v: toN(g.value), from: '그룹 값' };
    return { v: toN(baseVal8(st)), from: '기본값' };
  }
  function preview8(ctx) {
    const s = ctx.s, ui = ctx.ui, st = s.pol[C8] || {};
    const scope = ui[C8 + ':scope'] || '본사 기본값';
    const fr = frCenters(s);
    const cur = toN(scopeVal8(st, scope, ui)), dN = toN(ui[C8 + ':draft']);
    const next = clone(st);
    let label;
    if (!isNaN(dN) && dN !== cur && scope !== '직영') {
      label = '입력한 값 ' + won(dN) + ' 기준';
      if (scope === '본사 기본값') next.value = won(dN);
      else if (scope === '개별 센터') { next.centers = next.centers || {}; next.centers[ui.p_center || 'busan'] = { value: won(dN) }; }
      else { next.groups = next.groups || {}; next.groups[scope] = { value: won(dN) }; }
    } else if (st.reserved) { label = '예약된 변경 ' + st.reserved.date + '부터 ' + st.reserved.value + ' 기준'; next.value = st.reserved.value; }
    else label = '바뀌는 값 없음';
    const accounts = fr.reduce((a, c) => a + (c.students || 0), 0);
    const baseNow = toN(baseVal8(st)), baseNext = toN(baseVal8(next));
    const rows = fr.map(c => { const a = eff8(st, c), b = eff8(next, c); return { c, n: c.students || 0, a, b, diff: (b.v - a.v) * (c.students || 0) }; });
    const tA = rows.reduce((x, r) => x + r.a.v * r.n, 0), tB = rows.reduce((x, r) => x + r.b.v * r.n, 0);
    const kept = rows.filter(r => r.a.from !== '기본값').length;
    const naive = '<span><b>' + comma(accounts * baseNow) + '</b>원에서 <b>' + comma(accounts * baseNext) + '</b>원' + ro('원') + '</span><span class="hqb-note">(' + (accounts * (baseNext - baseNow) >= 0 ? '+' : '') + comma(accounts * (baseNext - baseNow)) + ', 예시)</span>';
    const body = '<div class="hqb-note" style="margin-bottom:6px">' + esc(label) + '</div>' + form([
      { l: '대상', v: '가맹 ' + fr.length + '곳 (' + ['테스트베드', '가맹'].map(t => t + ' ' + fr.filter(c => c.type === t).length).join(', ') + ')' },
      { l: '과금 계정', v: accounts + '명' },
      { l: '월 청구 예상', v: scope === '본사 기본값' ? naive : '<span class="hqb-note">아래 센터별 계산을 봐요</span>' },
    ]) + '<div class="hqb-note" style="margin-top:4px">개별 값이 있는 센터(' + kept + '곳)는 바뀌지 않아요.</div>' +
      rvBox('청구서와 같은 순서로 다시 셌어요', 'IMP-10',
        tbl([{ label: '센터' }, { label: '계정', num: true }, { label: '지금', num: true }, { label: '바뀐 뒤', num: true }, { label: '차이', num: true }], rows.map(r => ({
          cells: [esc(r.c.name.replace('센터', '')) + (r.a.from !== '기본값' ? ' <span class="hqb-note">' + r.a.from + '</span>' : ''), r.n, comma(r.a.v), comma(r.b.v), (r.diff >= 0 ? '+' : '') + comma(r.diff)],
        })).concat([{ cells: ['<b>합계</b>', accounts, '<b>' + comma(tA) + '</b>', '<b>' + comma(tB) + '</b>', '<b>' + (tB - tA >= 0 ? '+' : '') + comma(tB - tA) + '</b>'] }]), { cls: 'hqb-mini' }) +
        '<div style="margin-top:6px">원문 예시 +520,000원은 부산해운대 개별 값 18,000원을 무시하고 104명 모두에 기본값을 곱했어요. 청구서는 대상 달 1일의 값으로 계산해서 즉시 적용 대신 다음 달 1일 예약만 받아요. 이 표는 대상 센터가 모두 새 값을 쓴다고 보고 셌어요. 동의 확인 전 센터는 9번 표를 봐요.</div>', 8, 'margin-top:10px');
    return h.card({ title: '영향 미리보기', pin: 7, body });
  }
  function notice8(ctx) {
    const s = ctx.s, N = s.hq08.notice, n = N ? (s.notices || []).find(x => x.id === N.id) : null, CS = s.hq08.consent || {};
    const rows = frCenters(s).map(c => {
      const K = (s.hq05.contract || {})[c.id] || {}, st = s.pol[C8] || {}, ind = (st.centers || {})[c.id];
      const target = !ind, read = n && n.read ? n.read[c.id] : undefined, cs = CS[c.id];
      const apply = !target ? '<span class="hqb-note">개별 값 유지</span>'
        : cs ? h.chip('동의 ' + cs.date, 'ok')
        : h.chip('동의 확인 전', 'warn') + ' ' + h.btn('동의 확인', { sm: true, act: 'HQ08.consent', arg: c.id, disabled: !ctx.canEdit });
      return { cells: ['<span class="hqb-nw">' + esc(c.name.replace('센터', '')) + '</span>', esc((K.ver || '표준 v1') + (target ? ', 제7조' : '')),
        !target ? '해당 없음' : !n ? h.chip('저장하면 보내요', 'line') : read ? h.chip('확인', 'ok') : h.chip('보냄, 미확인', 'warn'), apply] };
    });
    return h.card({
      title: '가맹점 통지와 동의', pin: 9, right: B.impChip('IMP-25'),
      body: tbl([{ label: '센터' }, { label: '계약 근거' }, { label: '필독 공지' }, { label: '새 값 적용' }], rows, { cls: 'hqb-mini' }) +
        '<div class="hqb-note" style="margin-top:6px">변경 예약을 저장하면 새 값을 쓸 센터에 필독 공지(CT-17)를 보내고 확인 여부를 남겨요. 기본은 새로 계약하는 센터부터 적용해요. 이미 계약한 센터는 계약 조항이나 동의를 확인한 곳에만 새 값을 적용하고, 확인 전에는 계약한 날 값(HQ-05)을 그대로 써요. 동의 요청은 HQ-21에서 보내요.</div>',
    });
  }
  function nextNote8(s, k) { const x = (s.hq08.next || {})[k]; return x ? '<span class="hqb-next">' + esc(x.md) + '부터 ' + esc(x.value) + '</span>' : ''; }

  B.screen({
    id: 'HQ-08', side: 'hq', phase: 'P1b', devices: ['pc'], pages: [27],
    title: '시스템 사용료', menuLabel: '사용료·가맹금', crumb: '정책·요금 설정 > 사용료·가맹금',
    headActions: ctx => h.btn('취소', { act: 'HQ08.cancel', disabled: !ctx.canEdit }) + h.btn('변경 예약', { primary: true, act: 'HQ08.save', disabled: !ctx.canEdit }),
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, st = init8(ctx), ro8 = !ctx.canEdit;
      const scope = ui[C8 + ':scope'] || '본사 기본값';
      let ed = h.policyEditor(C8, ctx, { pins: { scope: 1, value: 2, when: 3, reason: 4 } });
      ed = ed.replace(/data-act="pe\.scope"/g, 'data-act="HQ08.scope"').replace('data-field="POL-01:draft"', 'data-field="POL-01:draft" data-live="1"');
      const wi = ed.indexOf('data-field="POL-01:when"'), wj = ed.indexOf('</select>', wi);
      if (wi > 0 && wj > wi) { const w = ui[C8 + ':when']; ed = ed.slice(0, wj) + '<option value="' + WHEN8 + '"' + (w === WHEN8 ? ' selected' : '') + '>' + WHEN8 + '</option>' + ed.slice(wj); }
      const sv = ui[C8 + ':status'];
      if (sv) { const si = ed.indexOf('data-field="POL-01:status"'), sj = ed.indexOf('</select>', si); if (si > 0 && sj > si) ed = ed.slice(0, si) + ed.slice(si, sj).replace(/ selected/g, '').replace('value="' + sv + '"', 'selected value="' + sv + '"') + ed.slice(sj); }
      const i2 = ed.lastIndexOf('<div class="card"', ed.indexOf('<h3>바꾸기 전에 미리 보기</h3>'));
      const i3 = ed.lastIndexOf('<div class="card"', ed.indexOf('<h3>이 정책의 변경 이력</h3>'));
      const part1 = ed.slice('<div class="stack">'.length, i2), part3 = ed.slice(i3, ed.length - '</div>'.length);
      const quick = '<div class="hqb-actions" style="margin-top:-4px"><span class="hqb-note">근거 빠르게 넣기</span>' + ['가맹계약서 제7조 (사용료)', '가맹점 동의서', '결재 문서 (경영지원)'].map(x => h.btn(x, { sm: true, ghost: true, act: 'HQ08.basis', arg: x, disabled: ro8 })).join('') + '</div>';
      let scopeBox = '';
      if (scope === '직영') scopeBox = h.alert('직영은 사용료 대신 내부 대체로 처리하고 통계만 남겨요. 직영 값은 둘 수 없어요.', 'info');
      else if (scope === '개별 센터') {
        const list = Object.keys(st.centers || {}).map(id => (B.center(id) || { name: id }).name + ' ' + st.centers[id].value + (st.centers[id].until ? ' (' + st.centers[id].until + '까지)' : '')).join(', ') || '없음';
        scopeBox = '<div class="hqb-box">' + form([
          { l: '센터', v: sel('p_center', ui.p_center || 'busan', frCenters(s).map(c => ({ v: c.id, l: c.name })), { size: 'm', live: true, label: '센터' }) },
          { l: '끝나는 날', req: true, v: inp('p_until', ui.p_until || '', { size: 's', type: 'date', label: '끝나는 날' }) + '<span class="hqb-note">개별 값은 기간이 꼭 있어야 해요</span>' },
          { l: '지금 개별 값', v: esc(list) },
        ]) + '</div>';
      } else if (scope !== '본사 기본값') scopeBox = '<div class="hqb-note">' + esc(scope) + ' 그룹 값을 넣으면 그 그룹 센터는 기본값 대신 이 값을 써요. 개별 값이 있는 센터는 그대로예요.</div>';
      const errs = ui.errs8 && ui.errs8.length ? h.alert(ui.errs8.join(' '), 'bad', { title: '저장할 수 없어요' }) : '';
      const v = k => (ui['o_' + k] != null ? ui['o_' + k] : s.hq08[k]);
      const optRow = o => radio(o.list, v(o.k), { act: 'HQ08.opt', prefix: o.k + '|', dis: ro8 }) + nextNote8(s, o.k);
      const ninp = (k, lab) => inp('o_' + k, v(k), { size: 'xs', type: 'number', dis: ro8, label: lab }) + nextNote8(s, k);
      const pol234 = h.card({
        title: '과금 기준, 월중 처리, 청구', pin: 5, right: stChip('안') + h.polChip('POL-02') + h.polChip('POL-03') + h.polChip('POL-04'),
        body: form([
          { l: '과금 기준', v: optRow(OPT8[0]) },
          { l: '월중 등록', v: optRow(OPT8[1]) },
          { l: '퇴원 시', v: optRow(OPT8[2]) },
          { l: '청구', v: optRow(OPT8[3]) + '<span>청구일</span>' + ninp('billDay', '청구일') + '<span>일, 기한</span>' + ninp('due', '납부기한') + '<span>일</span>' + varChip() },
          { l: '직영·가맹 권한', v: h.chip('직영 내부 대체, 통계만', 'line') + h.chip('가맹 변경 불가', 'line') },
        ]),
      });
      const pol5 = h.card({
        title: 'POL-05 연체 단계', pin: 6, right: stChip('안') + h.polChip('POL-05'),
        body: tbl([{ label: '경과' }, { label: '조치' }, { label: '알림' }], [
          { cells: [ninp('od1', '안내 경과일') + ' 일' + varChip(), '안내', '원장 알림톡과 메일'] },
          { cells: [ninp('od2', '경고 경과일') + ' 일' + varChip(), '경고', '본사 담당 연락'] },
          { cells: [ninp('od3', '등록 제한 경과일') + ' 일' + varChip(), '신규 원생 등록 제한', '기존 원생 학습은 유지'] },
        ], { cls: 'hqb-mini' }) +
          rvBox('연체 중에도 학부모 업무는 막지 않아요', 'IMP-27', '<div class="hqb-actions">' + ['원생 동의 (CT-05)', '수납 (CT-07)', '환불 (CT-10)', '영수증'].map(x => h.chip(x + ' 유지', 'ok')).join('') + '</div><div style="margin-top:6px">이의 신청 중인 금액은 연체 금액에서 빼요. 등록 제한을 남기려면 계약서와 정보공개서에 분명히 적어야 해요.</div>', 10, 'margin-top:10px'),
      });
      const left = '<div class="stack">' + part1 + quick + scopeBox + errs + pol234 + pol5 + '</div>';
      const right = '<div class="stack">' + preview8(ctx) + notice8(ctx) + part3 + '</div>';
      return '<div class="hqb-cols">' + left + right + '</div>';
    },
    mount(root) { mountLive(root); },
    prd: {
      summary: '가맹 센터가 학생 1명당 매달 본사에 내는 시스템 사용료를 정하고 바꾸는 화면이에요. 다른 정책 편집 화면도 이 화면과 같은 모양으로 만들어요.',
      who: '슈퍼관리자는 모든 값을 고쳐요. 정산팀은 사용료 정책을 고치고 운영팀은 일부만 고쳐요. SV는 보기만 하고, 가맹 센터는 이 값을 바꿀 수 없어요.',
      items: [
        { n: 1, t: '적용 범위 탭', d: '모든 정책 화면에 같은 탭이 있어요. 기본값 위에 직영, 가맹, 테스트베드 그룹 값이 덮이고, 그 위에 개별 센터 값이 덮여요. 개별 값이 있는 탭에는 개수가 보이고, 위 값을 바꿔도 아래 값은 그대로예요.', pol: ['POL-44'], ref: 'p.27 ①' },
        { n: 2, t: '값과 상태', d: '미확정이면 모든 화면에 (안)이 붙어요. 확정은 결재 근거가 있을 때만 고를 수 있어요.', pol: ['POL-01'], ref: 'p.27 ②' },
        { n: 3, t: '적용 시작일', d: '즉시 또는 예약으로 정해요. 진행 중인 달을 건드리지 않도록 다음 달 1일이 기본이에요. 예약은 그날 0시에 적용되고 정책 현황(HQ-07)에 보여요. 사용료는 8번 규칙 때문에 예약만 받아요.', ref: 'p.27 ③' },
        { n: 4, t: '근거 필수', d: '사용료는 가맹금에 해당할 수 있어서 계약 조항이나 가맹점 동의가 있어야 바꿔요. 근거가 없으면 저장되지 않아요.', ref: 'p.27 ④' },
        { n: 5, t: '과금 기준과 월중 처리, 청구', d: '가맹 수납은 수기라 검증할 수 없어서 학습 계정 활성 수로 세는 것을 권해요. 월중 등록 전액과 퇴원 반환 없음(안)은 업계 관행이에요. 청구일 5일과 기한 15일은 예시예요.', pol: ['POL-02', 'POL-03', 'POL-04'], ref: 'p.27 ⑤' },
        { n: 6, t: '연체 단계', d: '7일, 15일, 30일(예시)이 지나면 안내, 경고, 신규 원생 등록 제한으로 올라가요. 기존 원생의 학습은 막지 않아요. 단계와 조치는 계약서에 근거가 있어야 해요.', pol: ['POL-05'], ref: 'p.27 ⑥' },
        { n: 7, t: '영향 미리보기', d: '저장하기 전에 대상 센터 수, 과금 계정 수, 월 청구액 변화를 계산해 보여 줘요. 금액을 고치면 바로 다시 계산해요.', ref: 'p.27 ⑦' },
        { n: 8, kind: 'review', imp: 'IMP-10', t: '청구서와 같은 순서로 계산', d: '원문 예시는 부산해운대 개별 값 18,000원을 무시하고 104명 모두에 새 기본값을 곱해 +520,000원으로 셌어요. 청구서처럼 센터 값, 그룹 값, 기본값 순서로 찾으면 +315,000원이에요. 청구서는 대상 달 1일의 값으로 계산해서 즉시 적용은 막아요.', pol: ['POL-01'] },
        { n: 9, kind: 'review', imp: 'IMP-25', t: '가맹점 통지와 동의', d: '사용료 기본값을 바꾸면 기본은 새로 계약하는 센터부터 적용해요. 이미 계약한 센터는 계약 조항이나 동의를 확인한 곳에만 새 값을 쓰고, 센터마다 동의 확인을 눌러 기록해요. 변경 예약을 저장하면 새 값을 쓸 센터에 필독 공지(CT-17)가 가고 확인했는지 남아요.' },
        { n: 10, kind: 'review', imp: 'IMP-27', t: '연체 중에도 학부모 업무는 그대로', d: '연체 단계가 올라가도 원생 동의, 수납, 환불, 영수증은 막지 않아요. 이의 신청 중인 금액은 연체에서 빼고, 등록 제한을 남기려면 계약서와 정보공개서에 적어야 해요.', pol: ['POL-05'] },
      ],
      open: ['사용료 금액(POL-01). 10/21 회의에서 타사 회원비가 약 2만 원이라는 이야기만 나왔어요', '학생 수를 세는 기준(POL-02)', '월중 등록과 퇴원 처리(POL-03)', '선불 또는 후불, 청구일과 납부기한(POL-04)', '연체 단계와 조치, 계약서 근거(POL-05)'],
    },
  });

  LIVE_HOOK['HQ-08:p_center'] = u => { const st = B.store.pol[C8] || {}; u[C8 + ':draft'] = scopeVal8(st, '개별 센터', u); };
  act('HQ08.scope', (ctx, arg) => {
    const ui = ctx.ui, st = init8(ctx);
    let v = String(arg || ''); if (v.indexOf('|') >= 0) v = v.split('|')[1];
    if (v.indexOf('개별') === 0) v = '개별 센터';
    ui[C8 + ':scope'] = v; ui[C8 + ':draft'] = scopeVal8(st, v, ui); ui.errs8 = null;
  });
  act('HQ08.opt', (ctx, arg) => { const [k, v] = String(arg || '').split('|'); if (k && ctx.canEdit) ctx.ui['o_' + k] = v; });
  act('HQ08.basis', (ctx, v) => { ctx.ui[C8 + ':reason'] = v; ctx.ui[C8 + ':err'] = null; });
  act('HQ08.consent', (ctx, cid) => {
    const s = ctx.s, c = B.center(cid); if (!ctx.canEdit || !c) return;
    s.hq08.consent = s.hq08.consent || {};
    if (s.hq08.consent[cid]) { say('이미 동의를 확인한 센터예요.'); return; }
    s.hq08.consent[cid] = { date: ctx.today, by: ctx.persona.name };
    audit(ctx, '사용료 변경 동의 확인', c.name, '가맹점 동의서');
    say(c.name + ' 동의를 기록했어요. 예약일부터 이 센터에도 새 값을 적용해요.');
  });
  act('HQ08.cancel', ctx => {
    const ui = ctx.ui, st = ctx.s.pol[C8] || {};
    Object.keys(ui).forEach(k => { if (k.indexOf('o_') === 0 || k.indexOf(C8 + ':') === 0) delete ui[k]; });
    ui.errs8 = null; ui.p_until = '';
    ui[C8 + ':draft'] = baseVal8(st); ui[C8 + ':when'] = WHEN8;
    say('고치던 값을 지웠어요.');
  });
  act('HQ08.save', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui;
    if (arg && typeof arg === 'object') {
      const map = { value: 'draft', when: 'when', reason: 'reason', status: 'status' };
      Object.keys(map).forEach(k => { if (arg[k] != null) ui[C8 + ':' + map[k]] = String(arg[k]); });
      if (arg.scope) { ui[C8 + ':scope'] = arg.scope; }
      if (arg.center) ui.p_center = arg.center; if (arg.until) ui.p_until = arg.until;
      OPT8.forEach(o => { if (arg[o.k] != null) ui['o_' + o.k] = String(arg[o.k]); });
    }
    const st = init8(ctx), p = h.pol(C8);
    if (!ctx.canEdit) return;
    const scope = ui[C8 + ':scope'] || '본사 기본값', when = ui[C8 + ':when'] || '즉시', reason = String(ui[C8 + ':reason'] || '').trim();
    const errs = [], changes = [];
    const curTxt = scopeVal8(st, scope, ui), dTxt = String(ui[C8 + ':draft'] || '').trim(), dN = toN(dTxt);
    if (dTxt && dN !== toN(curTxt)) {
      if (isNaN(dN) || dN <= 0) errs.push('금액은 숫자로 넣어 주세요. 예) 25,000원.');
      else if (scope === '직영') errs.push('직영은 내부 대체라 직영 값을 둘 수 없어요.');
      else changes.push({ kind: 'value', to: won(dN) });
    }
    const stOld = st.status || p.status, stNew = ui[C8 + ':status'];
    if (stNew && stNew !== stOld) {
      if (stNew === '확정' && !/결재/.test(reason)) errs.push('확정은 결재 근거가 있을 때만 골라요. 근거에 결재 문서를 넣어 주세요.');
      else if (stNew === '법정') errs.push('법정은 법령으로 정한 값에만 써요.');
      else changes.push({ kind: 'status', to: stNew });
    }
    const vv = k => (ui['o_' + k] != null ? String(ui['o_' + k]) : String(s.hq08[k]));
    OPT8.forEach(o => { if (vv(o.k) !== String(s.hq08[o.k])) changes.push({ kind: 'opt', o, to: vv(o.k) }); });
    const iv = k => Number(vv(k));
    const isInt = (n, a, b) => Math.floor(n) === n && n >= a && n <= b;
    if (!isInt(iv('billDay'), 1, 28)) errs.push('청구일은 1일에서 28일 사이로 넣어 주세요.');
    else if (!isInt(iv('due'), 1, 31) || iv('due') <= iv('billDay')) errs.push('납부기한은 청구일보다 뒤 날짜로 넣어 주세요.');
    if (!(isInt(iv('od1'), 1, 90) && isInt(iv('od2'), 1, 90) && isInt(iv('od3'), 1, 120) && iv('od1') < iv('od2') && iv('od2') < iv('od3'))) errs.push('연체 단계는 안내, 경고, 등록 제한 순서로 날짜가 늘어나야 해요.');
    if (!changes.length && !errs.length) { ui.errs8 = null; say('바꾼 값이 없어요.'); return; }
    if (when === '즉시') errs.push('사용료 정책은 달 단위로 청구해요. 즉시 대신 다음 달 1일 같은 예약 날짜를 골라 주세요.');
    if (scope === '개별 센터' && changes.some(x => x.kind === 'value') && !okDate(ui.p_until)) errs.push('개별 값은 끝나는 날을 꼭 넣어 주세요.');
    ui[C8 + ':err'] = reason ? null : '가맹 계약에 영향을 주는 정책은 근거 없이 저장할 수 없어요.';
    ui.errs8 = errs;
    if (errs.length || !reason) { say('저장하지 못했어요. 빨간 글씨를 확인해 주세요.'); return; }
    const full = when.slice(0, 10), mdw = md(full), tag = ' (' + mdw + ' 예약)';
    let noticeCenters = [];
    changes.forEach(x => {
      if (x.kind === 'value') {
        let u, sc;
        if (scope === '본사 기본값') { u = undoItem(s, 'pol', [C8, 'reserved']); st.reserved = { date: mdw, full, value: x.to }; sc = '기본값'; }
        else if (scope === '개별 센터') { const cid = ui.p_center || 'busan'; st.centers = st.centers || {}; u = undoItem(s, 'pol', [C8, 'centers', cid]); st.centers[cid] = { value: x.to, status: stNew || stOld, until: ui.p_until, reason, start: full }; sc = '센터'; }
        else { st.groups = st.groups || {}; u = undoItem(s, 'pol', [C8, 'groups', scope]); st.groups[scope] = { value: x.to, status: stNew || stOld, start: full }; sc = '그룹 ' + scope; }
        const tgt = frCenters(s).filter(c => eff8(st, c).from === (scope === '본사 기본값' ? '기본값' : scope === '개별 센터' ? '개별 값' : '그룹 값') && (scope !== '개별 센터' || c.id === (ui.p_center || 'busan')));
        noticeCenters = noticeCenters.concat(tgt.map(c => c.id));
        polHist(ctx, C8, { from: curTxt, to: x.to + tag, scope: sc, reason, n: tgt.length, undo: [u] });
      } else if (x.kind === 'status') {
        const u = undoItem(s, 'pol', [C8, 'status']); st.status = x.to;
        polHist(ctx, C8, { from: stLabel(stOld), to: stLabel(x.to), text: '상태 ' + chg(stLabel(stOld), stLabel(x.to)), scope: '기본값', reason, n: frCenters(s).length, undo: [u] });
      } else {
        const o = x.o, from = String(s.hq08[o.k]) + (o.unit || ''), to = x.to + (o.unit || '');
        const u1 = undoItem(s, 'hq08', ['next', o.k]), u2 = undoItem(s, 'pol', [o.code, 'reserved']);
        s.hq08.next[o.k] = { full, md: mdw, value: to };
        const ps = s.pol[o.code] = s.pol[o.code] || {}; ps.reserved = { date: mdw, full, value: o.label + ' ' + to };
        polHist(ctx, o.code, { from: o.label + ' ' + from, to: o.label + ' ' + to + tag, scope: '기본값', reason, n: frCenters(s).length, undo: [u1, u2] });
      }
    });
    if (noticeCenters.length) {
      const id = 'n8-' + ((s.notices || []).length + 1), read = {};
      noticeCenters.forEach(cid => { read[cid] = false; });
      const vtxt = (changes.find(x => x.kind === 'value') || {}).to;
      s.notices.unshift({ id, title: '시스템 사용료 변경 예약 안내 (' + mdw + '부터 ' + vtxt + ')', must: true, date: ctx.today, read });
      s.hq08.notice = { id, centers: noticeCenters, date: ctx.today };
    }
    audit(ctx, '정책 변경 예약', changes.map(x => (x.o ? x.o.code : C8)).filter((v, i, a) => a.indexOf(v) === i).join(', '), reason);
    OPT8.forEach(o => { delete ui['o_' + o.k]; });
    ui[C8 + ':status'] = null; ui[C8 + ':reason'] = ''; ui[C8 + ':err'] = null; ui.errs8 = null;
    ui[C8 + ':draft'] = scopeVal8(st, scope, ui);
    say('변경을 예약했어요. ' + mdw + ' 0시에 바뀌고 정책 현황(HQ-07)에 보여요.' + (noticeCenters.length ? ' 센터 ' + noticeCenters.length + '곳에 필독 공지를 보냈어요.' : ''));
  });

  /* =====================================================================
     HQ-09 가맹금·계약 조건 (p.28)
     ===================================================================== */
  const SC9 = ['본사 기본값', '직영', '가맹', '테스트베드', '개별 센터 (0)'];
  const WHEN9 = [WHEN8, '2027-04-01 0시 예약', '즉시'];
  function draft9(ctx) {
    const s = ctx.s, ui = ctx.ui, H = s.hq09;
    const val = (key, saved) => (ui[key] != null ? ui[key] : saved);
    return {
      fees: H.fees.map(f => Object.assign({}, f, { amount: val('f9_fee_' + f.id, f.amount) })).concat(ui.f9_new || []),
      term: val('f9_term', H.term), a180: val('f9_a180', H.a180), a90: val('f9_a90', H.a90),
      terr: { basis: val('f9_basis', H.terr.basis), radius: val('f9_radius', H.terr.radius), overlap: val('f9_overlap', H.terr.overlap), incDirect: val('f9_incDirect', H.terr.incDirect), incPlan: val('f9_incPlan', H.terr.incPlan) },
      items: H.items.map(it => Object.assign({}, it, { how: val('f9_how_' + it.id, it.how) })),
    };
  }
  function changes9(ctx) {
    const H = ctx.s.hq09, D = draft9(ctx), out = [];
    const num = v => String(v == null ? '' : v).replace(/[^\d]/g, '');
    H.fees.forEach((f, i) => { const d = D.fees[i]; if (num(d.amount) !== num(f.amount)) out.push({ code: 'POL-06', label: f.name + ' 금액', from: f.amount ? f.amount + '원' : '미정', to: num(d.amount) ? comma(Number(num(d.amount))) + '원' : '미정', path: ['fees', i, 'amount'], val: num(d.amount) ? comma(Number(num(d.amount))) : '', key: 'fee_' + f.id }); });
    (ctx.ui.f9_new || []).forEach((f, i) => out.push({ code: 'POL-06', label: '항목 추가 ' + f.name, from: '-', to: f.amount ? f.amount + '원' : '미정', add: f, key: 'new_' + i }));
    if (String(D.term) !== String(H.term)) out.push({ code: 'POL-07', label: '계약 기간', from: H.term + '년', to: D.term + '년', path: ['term'], val: String(D.term), key: 'term' });
    if (D.a180 !== H.a180) out.push({ code: 'POL-07', label: '180일 전 알림', from: H.a180 ? '켬' : '끔', to: D.a180 ? '켬' : '끔', path: ['a180'], val: D.a180, key: 'a180' });
    if (D.a90 !== H.a90) out.push({ code: 'POL-07', label: '90일 전 알림', from: H.a90 ? '켬' : '끔', to: D.a90 ? '켬' : '끔', path: ['a90'], val: D.a90, key: 'a90' });
    if (num(D.terr.radius) !== num(H.terr.radius)) out.push({ code: 'POL-08', label: '반경', from: H.terr.radius + 'm', to: comma(Number(num(D.terr.radius))) + 'm', path: ['terr', 'radius'], val: comma(Number(num(D.terr.radius))), key: 'radius' });
    const ovl = v => (v === '영역 안 차단' ? '가맹점 영역 안만 차단' : v);
    if (D.terr.overlap !== H.terr.overlap) out.push({ code: 'POL-08', label: '중첩 시', from: ovl(H.terr.overlap), to: ovl(D.terr.overlap), path: ['terr', 'overlap'], val: D.terr.overlap, key: 'overlap' });
    if (D.terr.incDirect !== H.terr.incDirect) out.push({ code: 'POL-08', label: '직영 포함', from: H.terr.incDirect ? '예' : '아니요', to: D.terr.incDirect ? '예' : '아니요', path: ['terr', 'incDirect'], val: D.terr.incDirect, key: 'incDirect' });
    if (D.terr.incPlan !== H.terr.incPlan) out.push({ code: 'POL-08', label: '계획 센터 포함', from: H.terr.incPlan ? '예' : '아니요', to: D.terr.incPlan ? '예' : '아니요', path: ['terr', 'incPlan'], val: D.terr.incPlan, key: 'incPlan' });
    H.items.forEach((it, i) => { const d = D.items[i]; if (String(d.how).trim() !== String(it.how)) out.push({ code: 'POL-09', label: it.name + ' 공급가', from: it.how, to: String(d.how).trim(), path: ['items', i, 'how'], val: String(d.how).trim(), key: 'how_' + it.id }); });
    return out;
  }
  function nn9(s, key) { const x = (s.hq09.next || {})[key]; return x ? '<span class="hqb-next">' + esc(x.md) + '부터 ' + esc(x.value) + '</span>' : ''; }
  const fr9 = s => s.centers.filter(c => c.type !== '직영' && (s.hq05.contract[c.id] || {}).signed);

  B.screen({
    id: 'HQ-09', side: 'hq', phase: 'P1b', devices: ['pc'], pages: [28],
    title: '가맹금·계약 조건', menuLabel: '가맹금·계약 조건', crumb: '정책·요금 설정 > 사용료·가맹금',
    headActions: ctx => { const ro9 = !ctx.canEdit || ctx.role === '정산'; return h.btn('취소', { act: 'HQ09.cancel', disabled: ro9 }) + h.btn('변경 예약', { primary: true, act: 'HQ09.save', disabled: ro9 }); },
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, H = s.hq09, D = draft9(ctx);
      const scope = ui.scope9 || '본사 기본값';
      const ro9 = !ctx.canEdit || ctx.role === '정산' || scope !== '본사 기본값';
      const tb = scope === '테스트베드';
      let html = '';
      if (ctx.role === '정산') html += h.alert('정산팀은 사용료 정책만 고칠 수 있어서 이 화면은 보기만 해요.', 'warn') + '<div style="height:10px"></div>';
      if (ui.confirm9) {
        const list = changes9(ctx);
        html += h.card({
          title: '변경 예약 확인', sub: '저장하기 전에 바뀌는 값을 먼저 봐요',
          body: tbl([{ label: '정책' }, { label: '항목' }, { label: '지금' }, { label: '바뀐 뒤' }], list.map(x => ({ cells: [h.polChip(x.code), esc(x.label), esc(x.from), '<b>' + esc(x.to) + '</b>'] })), { cls: 'hqb-mini', empty: '바뀐 값이 없어요.' }) +
            '<div class="hqb-form" style="margin-top:8px">' +
            '<div class="hqb-fr"><div class="hqb-fl">적용 시작</div><div class="hqb-fv">' + sel('f9_when', ui.f9_when || WHEN8, WHEN9, { size: 'm', label: '적용 시작' }) + '<span class="hqb-note">이미 계약한 센터 값은 바뀌지 않아요</span></div></div>' +
            '<div class="hqb-fr"><div class="hqb-fl">근거<span class="req">*</span></div><div class="hqb-fv">' + inp('f9_reason', ui.f9_reason || '', { size: 'xl', ph: '회의록, 결재 문서, 법무 의견', err: ui.e9_reason, label: '근거' }) + errLine(ui.e9_reason) + '</div></div></div>' +
            '<div style="margin-top:8px">' + h.alert('정보공개서에 적힌 값이 바뀌어요. 저장하면 정보공개서 변경등록 할 일이 생겨요.', 'warn') + '</div>' + errLine(ui.e9) +
            '<div class="hqb-actions" style="margin-top:10px;justify-content:flex-end">' + h.btn('닫기', { act: 'HQ09.close' }) + h.btn('변경 예약 확정', { primary: true, act: 'HQ09.commit' }) + '</div>',
        }) + '<div style="height:12px"></div>';
      }
      html += '<div class="row" style="margin-bottom:12px">' + h.opts(SC9, scope.indexOf('개별') === 0 ? SC9[4] : scope, { act: 'HQ09.scope' }) + h.polChip('POL-44') + '</div>';
      if (scope === '직영') html += h.alert('직영 센터는 가맹금과 계약 조건이 해당 없어요. 영업지역 겹침 검사에만 직영 센터가 들어가요.', 'info') + '<div style="height:12px"></div>';
      else if (scope === '가맹') html += h.alert('가맹 그룹에 따로 둔 값이 없어서 본사 기본값을 그대로 써요.', 'info') + '<div style="height:12px"></div>';
      else if (tb) html += h.alert('테스트베드 그룹은 가맹비 면제 (안)이 기본값이에요. 센터를 테스트베드 그룹에 넣으면 자동으로 적용돼요.', 'info') + '<div style="height:12px"></div>';
      else if (scope !== '본사 기본값') html += h.alert('개별 값이 없어요. 계약을 맺으면 그날 값이 센터 계약 값으로 고정돼요(HQ-05).', 'info') + '<div style="height:12px"></div>';
      // POL-06
      const feeRows = D.fees.map((f, i) => {
        const isNew = i >= H.fees.length;
        const amt = tb && f.id === 'fee' ? h.chip('면제 (안)', 'st-안') + '<span class="hqb-note">그룹 값</span>'
          : (ro9 || isNew ? '<b>' + esc(f.amount ? f.amount + '원' : '미정') + '</b>' : inp('f9_fee_' + f.id, f.amount, { size: 's', ph: '미정', label: f.name + ' 금액' }) + '<span>원</span>') + (isNew ? h.chip('추가 예정', 'warn') : stChip(f.st || '미정')) + varChip() + nn9(s, 'fee_' + f.id);
        return { cells: ['<b>' + esc(f.name) + '</b>', amt, esc(f.exempt || '-'), f.escrow ? '예' : '아니요', f.disc !== false ? '예' : '-', esc(f.note || '-')] };
      });
      const addForm = ui.add9 ? '<div class="hqb-box" style="margin-top:8px"><h4>항목 추가</h4><div class="hqb-fv">' + inp('f9_nname', ui.f9_nname || '', { size: 'm', ph: '항목 이름', label: '항목 이름' }) + inp('f9_namt', ui.f9_namt || '', { size: 's', ph: '금액 (비우면 미정)', label: '금액' }) +
        check(ui.f9_nesc !== false, '예치 대상', { act: 'HQ09.nesc', arg: '1' }) + h.btn('추가', { sm: true, primary: true, act: 'HQ09.addItem' }) + h.btn('닫기', { sm: true, act: 'HQ09.addClose' }) + errLine(ui.e9_add) + '</div></div>' : '';
      const todos = (H.todos || []).length ? '<div style="margin-top:6px">' + H.todos.map(t => h.chip(t.date + ' ' + t.t + ' (' + t.codes.join(', ') + ')', 'warn')).join(' ') + '</div>' : '';
      const signed = fr9(s);
      const pol6 = h.card({
        title: 'POL-06 가맹금 항목표', pin: 1, right: stChip(statusOf('POL-06')) + h.polChip('POL-06'),
        body: tbl([{ label: '항목' }, { label: '금액' }, { label: '<span' + P(2) + '>면제 조건</span>', raw: true }, { label: '<span' + P(3) + '>예치 대상</span>', raw: true }, { label: '정보공개서 반영' }, { label: '비고' }], feeRows, { cls: 'hqb-mini' }) +
          '<div class="hqb-actions" style="margin-top:8px">' + h.btn('+ 항목 추가', { sm: true, act: 'HQ09.addOpen', disabled: ro9 }) + '<span class="hqb-note">항목을 바꾸면 정보공개서 변경 등록이 필요하다는 알림을 띄워요</span></div>' +
          (ui.discWarn ? '<div style="margin-top:8px">' + h.alert('항목표가 바뀌었어요. 정보공개서 변경 등록이 필요해요. 변경 예약을 저장하면 할 일로 남겨요.', 'warn') + '</div>' : '') + addForm +
          rvBox('정보공개서와 이미 맺은 계약', 'IMP-25', '<div>값을 바꾸면 정보공개서 변경등록 할 일이 생겨요. 이미 계약한 센터 ' + signed.length + '곳(' + esc(signed.map(c => c.name.replace('센터', '')).join(', ') || '없음') + ')은 계약한 날 값이 그대로이고, 바꾸려면 HQ-05에서 부속합의서를 등록해요.</div>' + todos, 7, 'margin-top:10px'),
      });
      // POL-07
      const pol7 = h.card({
        title: 'POL-07 계약 기간·갱신', pin: 4, right: stChip(statusOf('POL-07')) + h.polChip('POL-07'),
        body: form([
          { l: '계약 기간', v: (ro9 ? '<b>' + esc(D.term) + '</b>' : inp('f9_term', D.term, { size: 'xs', type: 'number', label: '계약 기간' })) + '<span>년 (예시)</span>' + varChip() + nn9(s, 'term') + errLine(ui.e9_term) },
          { l: '만료 알림', v: check(D.a180, '180일 전', { act: 'HQ09.tog', arg: 'a180', dis: ro9 }) + check(D.a90, '90일 전', { act: 'HQ09.tog', arg: 'a90', dis: ro9 }) },
          { l: '갱신 거절 사유', v: sel('f9_rej', '목록 관리', ['목록 관리'], { size: 's', dis: true, label: '갱신 거절 사유' }) + '<span class="hqb-note">법무 확인 뒤 사유 목록을 채워요</span>' },
          { l: '비고', v: '<span class="hqb-note">갱신 요구는 만료 180~90일 전에 해요. 갱신은 총 10년까지 보장돼요 (법정)</span>' },
          { l: '거절 통지 기한', pin: 9, v: '갱신 요구를 받은 날부터 15일 안' + h.chip('법정', 'st-법정') + B.impChip('IMP-27') + '<span class="hqb-note">요구를 받으면 기한을 계산해 대시보드(HQ-01)에 띄워요. 법무 확인이 필요해요.</span>' },
        ]),
      });
      // POL-08
      const pol8 = h.card({
        title: 'POL-08 영업지역 기준', pin: 5, right: stChip(statusOf('POL-08')) + h.polChip('POL-08'),
        body: form([
          { l: '기준', v: radio([{ v: '반경', l: '반경' }, { v: '행정동', l: '행정동 (P2)', dis: true, title: '경계 데이터가 준비되는 P2에 열려요' }, { v: '학교군', l: '학교군 (P2)', dis: true, title: '경계 데이터가 준비되는 P2에 열려요' }], D.terr.basis, { act: 'HQ09.opt', prefix: 'basis|', dis: ro9 }) +
            (ro9 ? '<b>' + esc(D.terr.radius) + '</b>' : inp('f9_radius', D.terr.radius, { size: 'xs', label: '반경' })) + '<span>m</span>' + varChip() + nn9(s, 'radius') + errLine(ui.e9_radius) },
          { l: '중첩 시', v: radio([{ v: '경고', l: '경고' }, { v: '등록 차단', l: '등록 차단' }, { v: '영역 안 차단', l: '가맹점 영역 안만 차단' }], D.terr.overlap, { act: 'HQ09.opt', prefix: 'overlap|', dis: ro9 }) + nn9(s, 'overlap') },
          { l: '검사 대상', v: check(D.terr.incDirect, '직영 포함', { act: 'HQ09.tog', arg: 'incDirect', dis: ro9 }) + check(D.terr.incPlan, '계획 센터 포함', { act: 'HQ09.tog', arg: 'incPlan', dis: ro9 }) },
        ]) + rvBox('다른 가맹점 영역 안 출점은 막아요', 'IMP-24', '<div>원문 기본값인 경고만으로는 계약한 영업지역 안에 새 센터가 들어설 수 있어요. 가맹점 영역 안만 차단을 고르면 계약이 유효한 가맹점 영역 안은 막고, 일부만 겹치거나 직영과 겹치면 경고해요. 예외는 그 가맹점 서면 동의서와 법무 승인을 거쳐야 열려요. P1b에는 경계 데이터가 없어서 반경만 열어요.</div>' +
          (ro9 || D.terr.overlap === '영역 안 차단' ? '' : '<div class="hqb-actions" style="margin-top:6px">' + h.btn('검토 제안대로 고르기', { sm: true, act: 'HQ09.opt', arg: 'overlap|영역 안 차단' }) + '</div>'), 8, 'margin-top:10px'),
      });
      // POL-09
      const pol9 = h.card({
        title: 'POL-09 필수품목·공급가 산정 방식', pin: 6, right: stChip(statusOf('POL-09')) + h.polChip('POL-09') + h.polChip('POL-38'),
        body: tbl([{ label: '품목' }, { label: '구분' }, { label: '공급가 산정 방식' }, { label: '계약서 기재' }], D.items.map(it => ({
          cells: ['<b>' + esc(it.name) + '</b>', '<span class="hqb-st ' + (it.kind === '필수' ? 'ok' : '') + '">' + esc(it.kind) + '</span>', (ro9 ? esc(it.how) : inp('f9_how_' + it.id, it.how, { size: 'l', label: it.name + ' 공급가' })) + varChip() + nn9(s, 'how_' + it.id), esc(it.contract)],
        })), { cls: 'hqb-mini' }) + '<div class="hqb-note" style="margin-top:6px">필수 품목과 공급가 산정 방식은 계약서에 적어야 해요. 학부모 교재비(POL-14)와는 따로예요.</div>',
      });
      html += pol6 + '<div class="hqb-grid2" style="margin-top:12px">' + pol7 + pol8 + '</div><div style="margin-top:12px">' + pol9 + '</div>';
      return html;
    },
    mount(root) { mountLive(root); },
    prd: {
      summary: '가맹점이 계약할 때 내는 돈, 계약 기간, 영업지역, 꼭 사야 하는 물건을 본사가 정하는 화면이에요. 여기 값은 정보공개서와 계약서에 똑같이 들어가요.',
      who: '슈퍼관리자는 보고 고쳐요. 운영팀은 일부만 고치고, 정산팀은 사용료 정책만 고칠 수 있어서 이 화면은 보기만 해요. SV는 보기만 하고 콘텐츠팀에게는 메뉴가 안 보여요. 값은 대표, 경영지원, 법무가 정해요.',
      items: [
        { n: 1, t: '가맹금 항목표', d: '항목과 금액, 면제 조건, 예치 대상을 한 표로 관리해요. 정보공개서에 적힌 내용과 같아야 해서 항목을 바꾸면 정보공개서 변경 등록 알림을 띄워요.', pol: ['POL-06'], ref: 'p.28 ①' },
        { n: 2, t: '면제는 그룹 기본값으로', d: '초기 10곳 면제 안은 테스트베드 그룹의 기본값으로 처리해요. 센터를 테스트베드 그룹에 넣으면 자동으로 적용돼요. 위쪽 테스트베드 탭에서 확인해요.', pol: ['POL-44'], ref: 'p.28 ②' },
        { n: 3, t: '예치 대상', d: '예치 대상 항목은 계약 게이트(HQ-03)에서 예치 기록이 있어야 받은 돈으로 처리돼요.', ref: 'p.28 ③' },
        { n: 4, t: '계약 기간과 갱신', d: '만료 180일 전과 90일 전에 알림을 보내요. 갱신을 거절할 때는 목록에서 사유를 골라 기록해요. 계약 기간 5년은 예시예요.', pol: ['POL-07'], ref: 'p.28 ④' },
        { n: 5, t: '영업지역', d: '계약서에 적는 기준이에요. 센터를 등록할 때 HQ-05에서 겹치는지 검사해요. 반경 1,000m는 예시예요.', pol: ['POL-08'], ref: 'p.28 ⑤' },
        { n: 6, t: '필수품목과 공급가', d: '필수 품목과 공급가 계산 방식은 계약서에 적어야 해요. 학부모가 내는 교재비(POL-14)와는 따로예요.', pol: ['POL-09', 'POL-38'], ref: 'p.28 ⑥' },
        { n: 7, kind: 'review', imp: 'IMP-25', t: '정보공개서 변경등록과 기존 계약', d: '값을 바꾸면 정보공개서 변경등록 할 일이 생겨요. 이미 계약한 센터는 계약한 날 값이 그대로이고, 바꾸려면 부속합의서를 등록해요.' },
        { n: 8, kind: 'review', imp: 'IMP-24', t: '다른 가맹점 영역 안 출점 차단', d: '원문 기본값은 겹쳐도 경고만 해서 다른 가맹점 동네에 새 센터가 들어설 수 있었어요. 계약이 유효한 가맹점 영역 안이면 막고, 일부만 겹치거나 직영과 겹치면 경고하는 선택지를 더했어요. P1b에는 경계 데이터가 없어서 반경만 열어요.', pol: ['POL-08'] },
        { n: 9, kind: 'review', imp: 'IMP-27', t: '갱신 거절 통지 기한', d: '갱신 요구를 받으면 15일 안에 거절 여부를 서면으로 알려야 해요(법정). 법무 확인이 남아 있어요. 요구를 받은 날부터 기한을 계산해 대시보드에 띄워요.', pol: ['POL-07'] },
      ],
      open: ['가맹비 금액(500만 원은 회의 안), 교육비와 보증금 금액', '테스트베드 10곳 가맹비 면제 여부', '계약 기간을 몇 년으로 할지', '영업지역 기준과 거리, 겹칠 때 경고만 할지 막을지', '주간 교재 공급가의 N%', '학습 패드 공급 방식(POL-38)'],
      rules: ['갱신 요구 기간은 만료 180일 전부터 90일 전까지이고, 갱신은 총 10년까지 보장돼요(법정).', '정보공개서에 적힌 가맹금과 계약 조건이 바뀌면 변경등록을 해야 해요.'],
    },
  });

  act('HQ09.scope', (ctx, v) => { ctx.ui.scope9 = String(v || '').indexOf('개별') === 0 ? '개별 센터' : v; });
  act('HQ09.opt', (ctx, arg) => {
    const [k, v] = String(arg || '').split('|'); if (!k || !ctx.canEdit || ctx.role === '정산') return;
    if (k === 'basis' && v !== '반경') { say('행정동과 학교군은 경계 데이터가 준비되는 P2에 열려요.'); return; }
    ctx.ui['f9_' + k] = v;
  });
  act('HQ09.tog', (ctx, k) => { if (!ctx.canEdit || ctx.role === '정산') return; const D = draft9(ctx); const cur = k === 'a180' || k === 'a90' ? D[k] : D.terr[k]; ctx.ui['f9_' + k] = !cur; });
  act('HQ09.addOpen', ctx => { if (ctx.canEdit && ctx.role !== '정산') { ctx.ui.add9 = true; ctx.ui.e9_add = null; } });
  act('HQ09.addClose', ctx => { ctx.ui.add9 = false; ctx.ui.e9_add = null; });
  act('HQ09.nesc', ctx => { ctx.ui.f9_nesc = ctx.ui.f9_nesc === false; });
  act('HQ09.addItem', (ctx, arg) => {
    const ui = ctx.ui;
    if (arg && typeof arg === 'object') { if (arg.name != null) ui.f9_nname = arg.name; if (arg.amount != null) ui.f9_namt = String(arg.amount); if (arg.escrow === false) ui.f9_nesc = false; }
    if (!ctx.canEdit || ctx.role === '정산') return;
    const name = String(ui.f9_nname || '').trim(), raw = String(ui.f9_namt || '').replace(/[^\d]/g, '');
    if (!name) { ui.e9_add = '항목 이름을 넣어 주세요.'; ui.add9 = true; return; }
    if (ctx.s.hq09.fees.concat(ui.f9_new || []).some(f => f.name === name)) { ui.e9_add = '같은 이름의 항목이 이미 있어요.'; ui.add9 = true; return; }
    ui.f9_new = (ui.f9_new || []).concat([{ id: 'n' + Date.now().toString(36), name, amount: raw ? comma(Number(raw)) : '', st: '안', exempt: '-', escrow: ui.f9_nesc !== false, disc: true, note: '새 항목' }]);
    ui.f9_nname = ''; ui.f9_namt = ''; ui.f9_nesc = true; ui.add9 = false; ui.e9_add = null; ui.discWarn = true;
    say('항목을 추가했어요. 정보공개서 변경 등록이 필요해요.');
  });
  act('HQ09.cancel', ctx => { Object.keys(ctx.ui).forEach(k => { if (k.indexOf('f9_') === 0 || k.indexOf('e9') === 0) delete ctx.ui[k]; }); ctx.ui.confirm9 = false; ctx.ui.discWarn = false; ctx.ui.add9 = false; say('고치던 값을 지웠어요.'); });
  act('HQ09.close', ctx => { ctx.ui.confirm9 = false; ctx.ui.e9 = null; ctx.ui.e9_reason = null; });
  function validate9(ctx) {
    const ui = ctx.ui, D = draft9(ctx);
    const term = Number(D.term), rad = Number(String(D.terr.radius).replace(/[^\d]/g, ''));
    ui.e9_term = !(Math.floor(term) === term && term >= 1 && term <= 10) ? '계약 기간은 1년에서 10년 사이로 넣어 주세요. 갱신은 총 10년까지 보장돼요.' : null;
    ui.e9_radius = !(rad >= 100 && rad <= 10000) ? '반경은 100m에서 10,000m 사이로 넣어 주세요.' : null;
    return !ui.e9_term && !ui.e9_radius;
  }
  act('HQ09.save', (ctx, arg, el) => {
    const ui = ctx.ui;
    if (!ctx.canEdit || ctx.role === '정산') return;
    if (arg && typeof arg === 'object') {
      const map = { fee: 'f9_fee_fee', edu: 'f9_fee_edu', dep: 'f9_fee_dep', term: 'f9_term', radius: 'f9_radius', overlap: 'f9_overlap', reason: 'f9_reason', when: 'f9_when' };
      Object.keys(map).forEach(k => { if (arg[k] != null) ui[map[k]] = String(arg[k]); });
      return B.actions['HQ09.commit'](ctx);
    }
    if (!validate9(ctx)) { say('확인할 칸이 있어요. 빨간 글씨를 봐 주세요.'); return; }
    if (!changes9(ctx).length) { say('바꾼 값이 없어요.'); return; }
    ui.confirm9 = true;
    if (el) { B.render(); return false; }
  });
  act('HQ09.commit', (ctx, arg) => {
    const s = ctx.s, ui = ctx.ui, H = s.hq09;
    if (arg && typeof arg === 'object') { if (arg.reason != null) ui.f9_reason = arg.reason; if (arg.when) ui.f9_when = arg.when; }
    if (!ctx.canEdit || ctx.role === '정산') return;
    if (!validate9(ctx)) { ui.confirm9 = true; say('확인할 칸이 있어요. 빨간 글씨를 봐 주세요.'); return; }
    const list = changes9(ctx);
    if (!list.length) { ui.confirm9 = false; say('바꾼 값이 없어요.'); return; }
    const reason = String(ui.f9_reason || '').trim(), when = ui.f9_when || WHEN8;
    if (!reason) { ui.confirm9 = true; ui.e9_reason = '가맹 계약에 영향을 주는 정책이라 근거 없이 저장할 수 없어요.'; return; }
    ui.e9_reason = null;
    const now = when === '즉시', full = now ? ctx.today : when.slice(0, 10), mdw = md(full);
    const byCode = {};
    list.forEach(x => {
      const undo = [];
      if (x.add) { undo.push(undoItem(s, 'hq09', ['fees'])); H.fees.push(Object.assign({}, x.add)); }
      else if (now) { undo.push(undoItem(s, 'hq09', x.path)); setPath(H, x.path, x.val); }
      else { undo.push(undoItem(s, 'hq09', ['next', x.key])); H.next[x.key] = { full, md: mdw, value: x.to }; }
      (byCode[x.code] = byCode[x.code] || { from: [], to: [], undo: [] });
      byCode[x.code].from.push(x.label + ' ' + x.from); byCode[x.code].to.push(x.label + ' ' + x.to); byCode[x.code].undo = byCode[x.code].undo.concat(undo);
    });
    Object.keys(byCode).forEach(code => {
      const b = byCode[code], ps = s.pol[code] = s.pol[code] || {};
      if (!now) { b.undo.push(undoItem(s, 'pol', [code, 'reserved'])); ps.reserved = { date: mdw, full, value: b.to.join(', ') }; }
      else if (code === 'POL-06') { b.undo.push(undoItem(s, 'pol', [code, 'value'])); const f = H.fees[0]; ps.value = f.name + ' ' + (f.amount ? f.amount + '원' : '미정'); }
      polHist(ctx, code, { from: b.from.join(', '), to: b.to.join(', ') + (now ? '' : ' (' + mdw + ' 예약)'), text: b.from.join(', ') + '에서 ' + b.to.join(', ') + (now ? '' : ' (' + mdw + ' 예약)'), scope: '기본값', reason, n: s.centers.filter(c => c.type !== '직영').length, undo: b.undo });
    });
    H.todos = H.todos || [];
    H.todos.unshift({ date: ctx.today, t: '정보공개서 변경등록', codes: Object.keys(byCode) });
    audit(ctx, '정책 변경' + (now ? '' : ' 예약'), Object.keys(byCode).join(', '), reason);
    Object.keys(ui).forEach(k => { if (k.indexOf('f9_') === 0 && k !== 'f9_when') delete ui[k]; });
    ui.confirm9 = false; ui.discWarn = false; ui.e9 = null;
    say((now ? '저장했어요. ' : '변경을 예약했어요. ' + mdw + ' 0시에 바뀌어요. ') + '정보공개서 변경등록 할 일을 만들었어요.');
  });
})();
