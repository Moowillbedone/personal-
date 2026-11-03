/* Brain180 admin prototype core: registry, state, shell, dynamic PRD panel, pins, demo guide engine. */
(function () {
  const B = window.B = window.B || {};
  B.screens = {}; B.order = []; B.actions = {}; B.extenders = []; B.demoSteps = []; B.chapters = [];

  /* ---------------- registry ---------------- */
  B.screen = function (def) {
    if (!def || !def.id) throw new Error('screen needs id');
    def.devices = def.devices || ['pc'];
    def.prd = def.prd || { summary: '', items: [] };
    if (!B.screens[def.id]) B.order.push(def.id);
    B.screens[def.id] = def;
  };
  B.action = function (name, fn) { B.actions[name] = fn; };
  B.extend = function (fn) { B.extenders.push(fn); };
  B.demo = function (steps, chapters) { B.demoSteps = steps || []; B.chapters = chapters || []; };

  /* ---------------- IA, personas, permissions ---------------- */
  B.MENU = {
    hq: [
      { g: '대시보드', items: ['HQ-01'] },
      { g: '가맹 모집·계약', items: ['HQ-02', 'HQ-03'] },
      { g: '가맹점 관리', items: ['HQ-04', 'HQ-05', 'HQ-06'] },
      { g: '정책·요금 설정', items: ['HQ-07', 'HQ-08', 'HQ-09', 'HQ-10', 'HQ-11', 'HQ-12', 'HQ-13', 'HQ-14', 'HQ-15'] },
      { g: '정산', items: ['HQ-16', 'HQ-17'] },
      { g: '공급', items: ['HQ-18', 'HQ-19', 'HQ-20'] },
      { g: '소통·관리', items: ['HQ-21', 'HQ-22'] },
      { g: '확대 단계', items: ['HQ-23', 'HQ-24', 'HQ-25', 'HQ-26'] },
      { g: '공통', items: ['CM-02', 'CM-03'] },
    ],
    ct: [
      { g: '대시보드', items: ['CT-01'] },
      { g: '상담', items: ['CT-02', 'CT-03'] },
      { g: '원생', items: ['CT-04', 'CT-05', 'CT-06'] },
      { g: '수강·수납', items: ['CT-07', 'CT-08', 'CT-09', 'CT-10'] },
      { g: '운영', items: ['CT-11', 'CT-12', 'CT-13'] },
      { g: '알림톡', items: ['CT-14'] },
      { g: '본사', items: ['CT-15', 'CT-16', 'CT-17'] },
      { g: '설정', items: ['CT-18', 'CT-19', 'CT-20'] },
      { g: '확대 단계', items: ['CT-21', 'CT-22', 'CT-23', 'CT-24'] },
      { g: '공통', items: ['CM-02', 'CM-03'] },
      { g: '현장·학부모 화면 (검토 제안)', items: ['KS-01', 'PA-01'] },
    ],
  };
  B.HQ_ROLES = ['슈퍼관리자', '운영', '정산', '콘텐츠', 'SV'];
  B.CT_ROLES = ['원장', '실장·데스크', '교사', '보조교사'];
  // 7쪽 역할별 메뉴 권한표. ● 조회·편집, ◐ 일부 편집, ○ 조회만, – 메뉴 숨김
  const HQP = {
    dash: '●●●●●', franchise: '●●○–○', recruit: '●●–––', policy: '●◐◐–○', settle: '●○●––', alim: '●●○––', supply: '●●○––',
    content: '●○–●–', comm: '●●○●●', stats: '●●●○○', sv: '●○––●', account: '●––––', common: '●●●●●',
  };
  const CTP = {
    dash: '●●○○', consult: '●●○–', student: '●●○○', pay: '●●––', refund: '●◐––', cls: '●●○○', attend: '●●●●', learn: '●○●○',
    alim: '●●◐–', hq: '●◐––', setting: '●–––', staff: '●–––', notice: '●●○○', stats: '●○○–', waitlist: '●●○–', svreply: '●○––', privacy: '●◐––', common: '●●●●', field: '●●●●',
  };
  const PERM_ROW = {
    'HQ-01': 'dash', 'HQ-02': 'recruit', 'HQ-03': 'recruit', 'HQ-04': 'franchise', 'HQ-05': 'franchise', 'HQ-06': 'franchise',
    'HQ-07': 'policy', 'HQ-08': 'policy', 'HQ-09': 'policy', 'HQ-10': 'policy', 'HQ-11': 'policy', 'HQ-12': 'policy', 'HQ-13': 'policy', 'HQ-14': 'policy', 'HQ-15': 'policy',
    'HQ-16': 'settle', 'HQ-17': 'settle', 'HQ-18': 'alim', 'HQ-19': 'supply', 'HQ-20': 'content', 'HQ-21': 'comm', 'HQ-22': 'account',
    'HQ-23': 'stats', 'HQ-24': 'sv', 'HQ-25': 'comm', 'HQ-26': 'franchise',
    'CT-01': 'dash', 'CT-02': 'consult', 'CT-03': 'consult', 'CT-04': 'student', 'CT-05': 'student', 'CT-06': 'student',
    'CT-07': 'pay', 'CT-08': 'pay', 'CT-09': 'pay', 'CT-10': 'refund', 'CT-11': 'cls', 'CT-12': 'attend', 'CT-13': 'learn', 'CT-14': 'alim',
    'CT-15': 'hq', 'CT-16': 'hq', 'CT-17': 'notice', 'CT-18': 'setting', 'CT-19': 'setting', 'CT-20': 'staff',
    'CT-21': 'stats', 'CT-22': 'waitlist', 'CT-23': 'svreply', 'CT-24': 'privacy', 'CM-02': 'common', 'CM-03': 'common', 'KS-01': 'field', 'PA-01': 'field', 'CM-01': 'common', 'IN-01': 'common',
  };
  B.perm = function (screenId, persona) {
    persona = persona || B.persona();
    const row = PERM_ROW[screenId] || 'common';
    if (persona.side === 'hq') { const s = HQP[row] || '●●●●●'; return s[B.HQ_ROLES.indexOf(persona.role)] || '●'; }
    const s = CTP[row] || '●●●●'; return s[B.CT_ROLES.indexOf(persona.role)] || '●';
  };
  B.PERSONAS = [
    { id: 'hq:super', side: 'hq', role: '슈퍼관리자', name: '정본부', label: '본사 슈퍼관리자 정본부' },
    { id: 'hq:ops', side: 'hq', role: '운영', name: '홍길동', label: '본사 운영팀 홍길동' },
    { id: 'hq:fin', side: 'hq', role: '정산', name: '이수민', label: '본사 정산팀 이수민' },
    { id: 'hq:content', side: 'hq', role: '콘텐츠', name: '정다은', label: '본사 콘텐츠팀 정다은' },
    { id: 'hq:sv', side: 'hq', role: 'SV', name: '최민호', label: '본사 SV 최민호' },
    { id: 'ct:daechi1:원장', side: 'ct', center: 'daechi1', role: '원장', name: '김지원', label: '대치1센터 원장 김지원' },
    { id: 'ct:daechi1:실장·데스크', side: 'ct', center: 'daechi1', role: '실장·데스크', name: '송하늘', label: '대치1센터 실장 송하늘' },
    { id: 'ct:daechi1:교사', side: 'ct', center: 'daechi1', role: '교사', name: '한결', label: '대치1센터 교사 한결' },
    { id: 'ct:daechi1:보조교사', side: 'ct', center: 'daechi1', role: '보조교사', name: '문채원', label: '대치1센터 보조교사 문채원' },
    { id: 'ct:daegu:원장', side: 'ct', center: 'daegu', role: '원장', name: '오세린', label: '대구수성센터(가맹) 원장 오세린' },
    { id: 'ct:daegu:실장·데스크', side: 'ct', center: 'daegu', role: '실장·데스크', name: '배유진', label: '대구수성센터(가맹) 실장 배유진' },
    { id: 'ct:busan:원장', side: 'ct', center: 'busan', role: '원장', name: '최하은', label: '부산해운대센터(교습소) 원장 최하은' },
  ];

  /* ---------------- state & store ---------------- */
  B.state = { persona: 'hq:ops', screenId: 'HQ-01', tab: null, device: 'pc', pins: true, prdTab: 'screen', mode: 'free', step: 0, menuOpen: false, support: null, focusPins: [] };
  B.persona = function (id) { return B.PERSONAS.find(p => p.id === (id || B.state.persona)) || B.PERSONAS[1]; };
  B.clone = o => JSON.parse(JSON.stringify(o));
  B.initStore = function () { const s = B.baseStore(); B.extenders.forEach(f => f(s)); s.ui = s.ui || {}; return s; };
  B.center = function (id) { return (B.store.centers || []).find(c => c.id === id); };

  /* ---------------- helpers ---------------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  B.esc = esc;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  B.phaseOf = function (def, tab) {
    if (tab && def.tabs) { const t = def.tabs.find(x => x.id === tab); if (t && t.phase) return t.phase; }
    return def.phase || 'P1a';
  };

  function ctxFor(def) {
    const st = B.state, s = B.store, p = B.persona();
    const centerId = st.support || p.center || 'daechi1';
    s.ui[def.id] = s.ui[def.id] || {};
    const lvl = B.perm(def.id, p);
    return {
      s, st, def, ui: s.ui[def.id], persona: p, side: p.side, role: p.role, centerId, center: B.center(centerId),
      tab: st.tab || (def.tabs && def.tabs[0].id) || null, h: B.h, perm: lvl,
      canEdit: lvl === '●' || lvl === '◐', readOnly: lvl === '○', partial: lvl === '◐',
      go: B.go, toast: B.toast, today: s.today,
    };
  }
  B.ctx = function (id) { return ctxFor(B.screens[id || B.state.screenId]); };

  /* ---------------- navigation ---------------- */
  B.go = function (id, opts) {
    opts = opts || {};
    if (!B.screens[id]) { B.toast('아직 준비 중인 화면이에요 (' + id + ')'); return; }
    if (id !== B.state.screenId) B.closeModal();
    if (opts.persona) B.state.persona = opts.persona;
    const def = B.screens[id];
    B.state.screenId = id;
    B.state.tab = opts.tab || (def.tabs ? def.tabs[0].id : null);
    if (opts.device) B.state.device = opts.device;
    if (!def.devices.includes(B.state.device)) B.state.device = def.devices[0];
    B.state.menuOpen = false;
    if (!opts.keepFocus) B.state.focusPins = [];
    B.render();
    const main = $('.main') || $('.solo'); if (main && !opts.keepScroll) main.scrollTop = 0;
    const pb = $('.prd-body'); if (pb && !opts.keepScroll) pb.scrollTop = 0;
    if (B.state.mode !== 'demo') { try { history.replaceState(null, '', '#' + id); } catch (e) { /* sandbox */ } }
  };

  /* ---------------- toast & modal ---------------- */
  let toastTimer = null;
  B.toast = function (msg) {
    const app = $('#app'); if (!app) return;
    let t = $('.toast', app); if (t) t.remove();
    t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; app.appendChild(t);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 2200);
  };
  B.modal = function (o) {
    const app = $('#app'); B.closeModal();
    const back = document.createElement('div'); back.className = 'modal-back';
    back.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><div class="modal-h">' + esc(o.title || '') + '</div><div class="modal-b">' + (o.body || '') +
      '</div><div class="modal-f">' + (o.cancel === false ? '' : '<button class="btn" data-mclose>' + esc(o.cancel || '취소') + '</button>') +
      (o.ok ? '<button class="btn primary" data-mok>' + esc(o.ok) + '</button>' : '') + '</div></div>';
    app.appendChild(back);
    back.addEventListener('click', e => {
      if (e.target === back || e.target.closest('[data-mclose]')) { B.closeModal(); return; }
      if (e.target.closest('[data-mok]')) { const r = o.onOk ? o.onOk(back) : true; if (r !== false) { B.closeModal(); B.render(); } }
    });
    if (o.mount) o.mount(back);
  };
  B.closeModal = function () { const m = $('#app .modal-back'); if (m) m.remove(); };

  /* ---------------- rendering ---------------- */
  B.render = function () {
    const st = B.state, def = B.screens[st.screenId];
    if (!def) return;
    document.body.classList.toggle('pins-off', !st.pins);
    document.body.classList.toggle('demo', st.mode === 'demo');
    const dev = $('#device');
    dev.className = 'device ' + st.device;
    $('#browserBar').hidden = st.device !== 'pc';
    $('#browserUrl').textContent = 'admin.brain180.example/' + (def.side === 'hq' ? 'hq' : def.side === 'ct' ? 'center' : def.side) + '/' + def.id.toLowerCase();
    const ctx = ctxFor(def);
    const app = $('#app');
    let html;
    try {
      if (def.chrome === 'none') html = '<div class="solo">' + def.render(ctx) + '</div>';
      else html = shell(def, ctx);
    } catch (err) {
      console.error(err);
      html = '<div class="solo" style="padding:24px"><div class="alert bad"><b>화면 오류</b>' + esc(def.id + ': ' + err.message) + '</div></div>';
    }
    const keep = Array.prototype.slice.call(app.children).filter(el => el.classList.contains('toast') || el.classList.contains('modal-back'));
    app.innerHTML = html;
    keep.forEach(el => app.appendChild(el));
    try { if (def.mount && B.perm(def.id) !== '–') def.mount(app, ctx); } catch (err) { console.error(err); }
    decoratePins(def, ctx);
    renderPRD(def, ctx);
    renderToolbar(def);
    fit();
  };

  function shell(def, ctx) {
    const p = ctx.persona, side = p.side, st = B.state;
    const menu = B.MENU[side].map(g => {
      const items = g.items.filter(id => B.screens[id] && B.perm(id, p) !== '–').map(id => {
        const d = B.screens[id];
        const ph = d.phase && d.phase !== 'P1a' ? '<span class="ph ' + d.phase.toLowerCase() + '">' + d.phase + '</span>' : '';
        const ro = B.perm(id, p) === '○' ? ' ro' : '';
        return '<a data-go="' + id + '" class="' + (id === def.id ? 'on' : '') + ro + '">' + esc(d.menuLabel || d.title) + ph + '<span class="sid">' + id + '</span></a>';
      }).join('');
      return items ? '<div class="side-g"><div>' + esc(g.g) + '</div>' + items + '</div>' : '';
    }).join('');
    const c = ctx.center;
    const centerBox = side === 'ct'
      ? '<button class="head-center" data-go="CM-02" title="센터 전환">' + esc(c ? c.name : '') + ' <span class="chip ' + (c && c.type === '직영' ? 'navy' : c && c.type === '가맹' ? 'brand' : 'review') + '">' + esc(c ? c.type : '') + '</span> ▾</button>'
      : (st.support ? '<span class="head-center">지원 모드로 보는 센터 ' + esc(c ? c.name : '') + '</span>' : '');
    const lvl = B.perm(def.id, p);
    let body;
    if (lvl === '–') {
      body = '<div class="empty" style="margin-top:40px"><b>이 역할은 볼 수 없는 메뉴예요.</b><br>7쪽 권한표에서 ' + esc(p.role) + ' 역할은 이 메뉴가 숨겨져 있어요. 위쪽 사람 선택에서 다른 역할로 바꿔 보세요.</div>';
    } else {
      body = (lvl === '○' ? '<div class="ro-banner">보기만 할 수 있는 권한이에요 (' + esc(p.role) + '). 저장과 수정 버튼은 막혀 있어요.</div>' : '') +
        (st.support && side === 'hq' ? '<div class="support-banner"><b>본사 지원 모드</b>' + esc(c ? c.name : '') + ' 화면을 보고 있어요. 열람 사유가 기록되고, 원생 정보는 가려진 채로 보여요.<button class="btn sm" data-act="core.endSupport" style="margin-left:auto">지원 모드 끝내기</button></div>' : '') +
        pageHead(def, ctx) + def.render(ctx);
    }
    return '<div class="shell' + (st.menuOpen ? ' menu-open' : '') + '">' +
      '<header class="shell-head"><button class="menu-btn" data-act="core.menu">메뉴</button>' +
      '<div class="logo"><i>180</i>브레인180 <small>' + (side === 'hq' ? '본사 관리자' : '센터 관리자') + '</small></div>' + centerBox +
      '<div class="head-search">센터, 원생, 메뉴 검색</div>' +
      '<div class="head-right"><span class="bell">알림 <b>' + (side === 'hq' ? 3 : 2) + '</b></span><span>' + esc(p.role) + ' ' + esc(p.name) + '</span><button class="btn sm" data-go="CM-01">로그아웃</button></div></header>' +
      '<nav class="side" aria-label="메뉴">' + menu + '</nav>' +
      '<main class="main">' + body + '</main></div>';
  }

  function pageHead(def, ctx) {
    if (def.noHead) return '';
    const phase = B.phaseOf(def, ctx.tab);
    const tabs = def.tabs ? '<div class="tabs" role="tablist">' + def.tabs.map(t => '<button data-tab="' + t.id + '" class="' + (t.id === ctx.tab ? 'on' : '') + '">' + esc(t.label) +
      (t.phase && t.phase !== 'P1a' ? ' <span class="chip ' + t.phase.toLowerCase() + '">' + t.phase + '</span>' : '') + '</button>').join('') + '</div>' : '';
    const actions = def.headActions ? def.headActions(ctx) : '';
    return '<div class="ph-row"><div><div class="crumb">' + esc(def.crumb || '') + '</div><div class="ph-title"><h1>' + esc(def.title) + '</h1><span class="chip id">' + def.id + '</span><span class="chip ' + phase.toLowerCase() + '">' + phase + '</span></div></div>' +
      (actions ? '<div class="ph-actions">' + actions + '</div>' : '') + '</div>' + tabs;
  }

  /* ---------------- pins ---------------- */
  function prdItems(def, ctx) {
    return (def.prd.items || []).filter(it => !it.tab || it.tab === ctx.tab);
  }
  function decoratePins(def, ctx) {
    const items = prdItems(def, ctx);
    const kind = {}; items.forEach(it => { kind[it.n] = it.kind; });
    $$('#app [data-pin]').forEach(el => {
      const n = el.getAttribute('data-pin');
      if (/^(INPUT|TR|TD|TH|TBODY|THEAD|TABLE|SELECT|TEXTAREA|IMG|BR|HR)$/.test(el.tagName)) { console.warn('pin on unsupported element', n, el.tagName); return; }
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      el.classList.add('pin-host');
      const b = document.createElement('span');
      b.className = 'pin' + (kind[n] === 'review' ? ' review' : '') + (B.state.focusPins.includes(Number(n)) ? ' on' : '');
      b.textContent = n; b.setAttribute('data-n', n); b.title = '설명 보기 ' + n;
      el.appendChild(b);
      if (B.state.focusPins.includes(Number(n))) el.classList.add('focus');
    });
  }
  B.flashPin = function (n) {
    let host = $('#app [data-pin="' + n + '"]');
    if (!host) {
      const def = B.screens[B.state.screenId], it = (def.prd.items || []).find(x => String(x.n) === String(n));
      if (it && it.reveal && B.actions[it.reveal]) { B.actions[it.reveal](B.ctx(), it.revealArg); B.render(); host = $('#app [data-pin="' + n + '"]'); }
      if (it && it.tab && it.tab !== B.ctx().tab) { B.state.tab = it.tab; B.render(); host = $('#app [data-pin="' + n + '"]'); }
    }
    if (!host) { B.toast(n + '번 위치는 다른 탭이나 상태에서 보여요'); return; }
    host.scrollIntoView({ block: 'center', behavior: 'smooth' });
    host.classList.remove('flash'); void host.offsetWidth; host.classList.add('flash');
  };
  B.jumpCard = function (n) {
    B.state.prdTab = 'screen';
    const card = $('#prd [data-card="' + n + '"]');
    if (!card) return;
    $$('#prd .pcard').forEach(c => c.classList.remove('flash'));
    card.classList.add('flash'); card.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  /* ---------------- PRD panel ---------------- */
  const PHASE_TEXT = { P1a: 'P1a 직영 시범', P1b: 'P1b 가맹 개시', P2: 'P2 가맹 확대' };
  function chip(t, cls) { return '<span class="chip ' + (cls || '') + '">' + esc(t) + '</span>'; }
  B.impChip = function (id) {
    const imp = (B.REVIEW.imps || []).find(x => x.id === id);
    return '<span class="chip review" title="' + esc(imp ? imp.title : '') + '">검토 반영 ' + esc(id) + '</span>';
  };
  function renderPRD(def, ctx) {
    const st = B.state, prd = $('#prd');
    const spec = B.SPEC[def.id] || null;
    const phase = B.phaseOf(def, ctx.tab);
    const pages = def.pages || (spec ? spec.pages : []);
    const chan = def.channelText || (spec ? spec.channel : (def.devices.includes('mobile') ? '모바일 (학부모 휴대폰)' : def.devices.includes('kiosk') ? '공용 태블릿 (키오스크)' : 'PC 웹'));
    let head = '<div class="prd-head"><div class="prd-chips">' + chip(def.id, 'id') + chip(PHASE_TEXT[phase] || phase, phase.toLowerCase()) + chip(chan, 'line') +
      (pages && pages.length ? chip('원문 ' + pages.map(x => 'p.' + x).join(', '), 'line') : chip('검토 제안 화면 (원문 범위 밖)', 'review')) +
      '</div><h2>' + esc(def.title) + (def.tabs ? ' <small style="font-size:13px;color:var(--sub);font-weight:600">' + esc((def.tabs.find(t => t.id === ctx.tab) || {}).label || '') + '</small>' : '') + '</h2><p>' + esc(def.prd.summary || '') + '</p></div>';
    let narr = '';
    if (st.mode === 'demo' && B.demoSteps.length) {
      const s = B.demoSteps[st.step], tot = B.demoSteps.length;
      const per = B.persona(s.persona);
      narr = '<div class="narr" aria-live="polite"><div class="narr-top"><span><b>데모 ' + (st.step + 1) + ' / ' + tot + '</b> ' + esc(s.ch || '') + '</span><span>' + esc(s.phaseLabel || '') + '</span></div>' +
        '<h3>' + esc(s.title) + '</h3><p>' + esc(s.say) + '</p><div class="who">지금 화면을 쓰는 사람 <b>' + esc(per.label) + '</b></div>' +
        '<div class="narr-nav"><button data-demo="prev"' + (st.step === 0 ? ' disabled' : '') + '>‹ 이전</button><button class="primary" data-demo="next"' + (st.step === tot - 1 ? ' disabled' : '') + '>다음 ›</button></div></div>';
    }
    const tabs = '<div class="prd-tabs"><button data-prdtab="screen" class="' + (st.prdTab === 'screen' ? 'on' : '') + '">이 화면 기능</button><button data-prdtab="all" class="' + (st.prdTab === 'all' ? 'on' : '') + '">전체 PRD</button><button data-prdtab="guide" class="' + (st.prdTab === 'guide' ? 'on' : '') + '">데모 목차</button></div>';
    let body = '';
    if (st.prdTab === 'screen') body = screenPRD(def, ctx);
    else if (st.prdTab === 'all') body = B.overviewPRD();
    else body = guideList();
    prd.innerHTML = head + tabs + '<div class="prd-body">' + narr + body + '</div>';
  }
  function screenPRD(def, ctx) {
    const items = prdItems(def, ctx);
    let html = '<div class="prd-hint">왼쪽 화면의 숫자를 누르면 여기 설명으로 와요. 설명 카드를 누르면 왼쪽 위치가 반짝여요. 보라색 숫자는 검토 결과를 반영해 새로 넣은 기능이에요.</div>';
    if (def.prd.who) html += '<div class="prd-sec"><h5>누가 쓰나요</h5><p>' + esc(def.prd.who) + '</p></div>';
    html += items.map(it => {
      const pol = (it.pol || []).map(c => '<span class="chip ' + polStatusClass(c) + '" title="' + esc(polName(c)) + '">' + esc(c) + '</span>').join('');
      const imps = [].concat(it.imp || []).map(B.impChip).join('');
      return '<div class="pcard' + (it.kind === 'review' ? ' review' : '') + (B.state.focusPins.includes(it.n) ? ' focus' : '') + '" data-card="' + it.n + '"><span class="pn">' + it.n + '</span><div><h4>' + esc(it.t) + '</h4><p>' + esc(it.d) + '</p>' +
        ((pol || imps || it.ref) ? '<div class="pmeta">' + pol + imps + (it.ref ? chip(it.ref, 'line') : '') + '</div>' : '') + '</div></div>';
    }).join('');
    if (def.prd.open && def.prd.open.length) html += '<div class="prd-sec"><h5>아직 정해지지 않은 것</h5><ul>' + def.prd.open.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
    if (def.prd.rules && def.prd.rules.length) html += '<div class="prd-sec"><h5>지켜야 할 규칙</h5><ul>' + def.prd.rules.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
    return html;
  }
  function polName(c) { const p = (B.POLICIES || []).find(x => x.code === c); return p ? p.name + ', 지금 값 ' + p.now : c; }
  function polStatusClass(c) { const p = (B.POLICIES || []).find(x => x.code === c); return p ? 'st-' + p.status : ''; }
  function guideList() {
    if (!B.demoSteps.length) return '<div class="empty">데모 가이드를 준비 중이에요.</div>';
    let html = '<div class="prd-hint">위쪽의 이전, 다음 버튼이나 키보드의 왼쪽, 오른쪽 화살표 키로 넘겨요. 아래 목록을 누르면 그 단계로 바로 가요.</div>';
    let last = null;
    B.demoSteps.forEach((s, i) => {
      if (s.ch !== last) { html += (last !== null ? '</ul></div>' : '') + '<div class="prd-sec"><h5>' + esc(s.ch) + '</h5><ul>'; last = s.ch; }
      html += '<li><button class="prd-link" data-demo-go="' + i + '">' + (i + 1) + '. ' + esc(s.title) + '</button> <span class="muted small">' + esc(s.screen) + '</span></li>';
    });
    return html + '</ul></div>';
  }

  /* ---------------- toolbar ---------------- */
  function renderToolbar(def) {
    const st = B.state;
    $('#personaSel').value = st.persona;
    $$('#deviceSeg button').forEach(b => {
      const d = b.getAttribute('data-device');
      b.classList.toggle('on', st.device === d);
      b.disabled = !def.devices.includes(d);
      b.title = b.disabled ? '이 화면은 ' + def.devices.map(x => ({ pc: 'PC', tablet: '태블릿', mobile: '모바일', kiosk: '키오스크' })[x]).join(', ') + ' 전용이에요' : '';
    });
    $$('#modeSeg button').forEach(b => b.classList.toggle('on', b.getAttribute('data-mode') === st.mode));
    $('#pinBtn').classList.toggle('on', st.pins);
    const tot = B.demoSteps.length;
    const label = $('#tourLabel'), bar = $('#tourBar');
    if (st.mode === 'demo' && tot) {
      const s = B.demoSteps[st.step];
      label.innerHTML = '<b>' + (st.step + 1) + '/' + tot + '</b> ' + esc(s.title) + ' <span style="opacity:.7">(' + esc(s.ch) + ')</span>';
      bar.style.width = ((st.step + 1) / tot * 100) + '%';
      $('#prevBtn').disabled = st.step === 0; $('#nextBtn').disabled = st.step === tot - 1;
      $('#nextBtn').textContent = '다음 ›';
    } else {
      label.innerHTML = '자유 탐색 중 <b>' + esc(def.id) + '</b> ' + esc(def.title);
      bar.style.width = '0%';
      $('#prevBtn').disabled = false; $('#nextBtn').disabled = false;
      $('#nextBtn').textContent = tot ? '데모 시작 ›' : '다음 ›';
    }
    const p = B.persona();
    const ph = B.phaseOf(def, B.state.tab), c = B.center(B.state.support || p.center);
    const later = ph !== 'P1a' || (c && c.type !== '직영');
    const permText = { '●': '보고 고칠 수 있음', '◐': '일부만 고칠 수 있음', '○': '보기만 가능', '–': '메뉴 숨김' }[B.perm(def.id, p)] || '';
    $('#viewMeta').innerHTML = '<span>지금 사람 <b>' + esc(p.label) + '</b>, 권한 <b>' + esc(permText) + '</b></span><span>화면 속 날짜 <b>' + (later ? '2027년 10월 (가맹 개시 뒤 예시)' : '2027-03-08 월요일 (직영 시범 예시)') + '</b></span><span>운영 환경 <b>' +
      esc(def.devices.map(x => ({ pc: 'PC 웹', tablet: '태블릿', mobile: '학부모 휴대폰', kiosk: '공용 태블릿' })[x]).join(', ')) + '</b></span>';
  }

  /* ---------------- fit device to view ---------------- */
  function fit() {
    const fitEl = $('#fit'), inner = $('#fitInner'), dev = $('#device');
    const w = fitEl.clientWidth || 800;
    const dw = dev.offsetWidth, dh = dev.offsetHeight;
    const scale = Math.min(1, w / dw);
    inner.style.transform = 'scale(' + scale + ')';
    inner.style.left = Math.max(0, (w - dw * scale) / 2) + 'px';
    fitEl.style.height = (dh * scale) + 'px';
  }
  B.fit = fit;

  /* ---------------- demo engine ---------------- */
  B.demoGo = function (k) {
    const steps = B.demoSteps; if (!steps.length) return;
    k = Math.max(0, Math.min(steps.length - 1, k));
    B.store = B.clone(B.initialStore);
    for (let i = 0; i <= k; i++) {
      const s = steps[i];
      B.state.persona = s.persona || B.state.persona;
      B.state.support = s.support || null;
      [].concat(s.act || []).forEach(a => {
        const name = typeof a === 'string' ? a : a.name, arg = typeof a === 'string' ? undefined : a.arg;
        const fn = B.actions[name];
        if (!fn) { console.warn('demo act missing', name); return; }
        try { B.state.screenId = s.screen; B.state.tab = s.tab || null; fn(ctxFor(B.screens[s.screen] || B.screens[B.order[0]]), arg); } catch (e) { console.error('demo act failed', name, e); }
      });
    }
    const s = steps[k];
    B.state.mode = 'demo'; B.state.step = k; B.state.focusPins = (s.pins || []).map(Number);
    B.state.prdTab = 'screen';
    B.go(s.screen, { tab: s.tab, device: s.device || (B.screens[s.screen] ? B.screens[s.screen].devices[0] : 'pc'), keepFocus: true, persona: s.persona });
    try { history.replaceState(null, '', '#demo-' + (k + 1)); } catch (e) { /* sandbox */ }
    const first = s.pins && s.pins[0];
    if (first != null) setTimeout(() => { const h = $('#app [data-pin="' + first + '"]'); if (h) h.scrollIntoView({ block: 'center' }); const c = $('#prd [data-card="' + first + '"]'); if (c) c.scrollIntoView({ block: 'nearest' }); }, 30);
  };
  B.demoNext = function () { if (B.state.mode !== 'demo') B.demoGo(0); else B.demoGo(B.state.step + 1); };
  B.demoPrev = function () { if (B.state.mode !== 'demo') B.demoGo(0); else B.demoGo(B.state.step - 1); };
  B.setMode = function (m) {
    if (m === 'demo') { B.demoGo(B.state.mode === 'demo' ? B.state.step : 0); return; }
    B.state.mode = 'free'; B.state.focusPins = []; B.render();
    try { history.replaceState(null, '', '#' + B.state.screenId); } catch (e) { /* sandbox */ }
  };

  /* ---------------- core actions ---------------- */
  B.action('core.menu', () => { B.state.menuOpen = !B.state.menuOpen; });
  B.action('core.endSupport', () => { B.state.support = null; B.toast('지원 모드를 끝냈어요. 열람 기록이 남았어요.'); });
  B.action('core.startSupport', (ctx, centerId) => { B.state.support = centerId; });

  /* ---------------- events ---------------- */
  function onAppClick(e) {
    const pin = e.target.closest('.pin');
    if (pin) { e.preventDefault(); e.stopPropagation(); B.jumpCard(pin.getAttribute('data-n')); return; }
    const goEl = e.target.closest('[data-go]');
    if (goEl) { e.preventDefault(); const id = goEl.getAttribute('data-go'); if (B.state.mode === 'demo') B.state.mode = 'free'; B.go(id, { tab: goEl.getAttribute('data-go-tab') || undefined }); return; }
    const tabEl = e.target.closest('[data-tab]');
    if (tabEl && tabEl.closest('.tabs')) { B.state.tab = tabEl.getAttribute('data-tab'); B.render(); return; }
    const actEl = e.target.closest('[data-act]');
    if (actEl) {
      if (actEl.disabled || actEl.classList.contains('disabled')) return;
      const name = actEl.getAttribute('data-act'), fn = B.actions[name];
      if (!fn) { console.warn('missing action', name); B.toast('준비 중인 동작이에요'); return; }
      e.preventDefault();
      const r = fn(B.ctx(), actEl.getAttribute('data-arg'), actEl);
      if (r !== false) B.render();
    }
  }
  function onPrdClick(e) {
    const t = e.target.closest('[data-prdtab]'); if (t) { B.state.prdTab = t.getAttribute('data-prdtab'); B.render(); return; }
    const d = e.target.closest('[data-demo]'); if (d) { d.getAttribute('data-demo') === 'next' ? B.demoNext() : B.demoPrev(); return; }
    const dg = e.target.closest('[data-demo-go]'); if (dg) { B.demoGo(Number(dg.getAttribute('data-demo-go'))); return; }
    const sg = e.target.closest('[data-screen-go]'); if (sg) { B.state.mode = 'free'; B.state.prdTab = 'screen'; const sp = sg.getAttribute('data-persona'); B.go(sg.getAttribute('data-screen-go'), { persona: sp || undefined }); return; }
    const c = e.target.closest('[data-card]'); if (c) { B.flashPin(c.getAttribute('data-card')); }
  }

  B.boot = function () {
    const sel = $('#personaSel');
    sel.innerHTML = [['본사', 'hq'], ['대치1센터 (직영)', 'daechi1'], ['대구수성센터 (가맹)', 'daegu'], ['부산해운대센터 (테스트베드, 교습소)', 'busan']].map(([lab, key]) =>
      '<optgroup label="' + lab + '">' + B.PERSONAS.filter(p => (key === 'hq' ? p.side === 'hq' : p.center === key)).map(p => '<option value="' + p.id + '">' + esc(p.label) + '</option>').join('') + '</optgroup>').join('');
    sel.addEventListener('change', () => {
      const p = B.persona(sel.value); B.state.persona = p.id; B.state.mode = 'free'; B.state.support = null;
      const cur = B.screens[B.state.screenId];
      const same = cur && (cur.side === p.side || cur.side === 'cm');
      B.go(same ? B.state.screenId : (p.side === 'hq' ? 'HQ-01' : 'CT-01'));
    });
    $('#deviceSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; B.state.device = b.getAttribute('data-device'); B.render(); });
    $('#modeSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) B.setMode(b.getAttribute('data-mode')); });
    $('#pinBtn').addEventListener('click', () => { B.state.pins = !B.state.pins; B.render(); });
    $('#introBtn').addEventListener('click', () => { B.state.mode = 'free'; B.state.focusPins = []; B.go('IN-01'); });
    $('#prevBtn').addEventListener('click', B.demoPrev);
    $('#nextBtn').addEventListener('click', B.demoNext);
    $('#app').addEventListener('click', onAppClick);
    const keep = e => { const f = e.target.getAttribute && e.target.getAttribute('data-field'); if (!f) return; const ui = B.store.ui[B.state.screenId] = B.store.ui[B.state.screenId] || {}; ui[f] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; };
    $('#app').addEventListener('input', keep);
    $('#app').addEventListener('change', keep);
    $('#prd').addEventListener('click', onPrdClick);
    document.addEventListener('keydown', e => {
      if (/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); B.demoNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); B.demoPrev(); }
    });
    window.addEventListener('resize', fit);
    B.initialStore = B.initStore();
    B.store = B.clone(B.initialStore);
    const hash = (location.hash || '').slice(1);
    const m = /^demo-(\d+)$/.exec(hash);
    if (m && B.demoSteps.length) { B.demoGo(Number(m[1]) - 1); return; }
    if (B.screens[hash]) {
      const d = B.screens[hash];
      if (d.side === 'ct' || d.side === 'ks' || d.side === 'pa') B.state.persona = 'ct:daechi1:원장';
      B.go(hash); return;
    }
    B.go('IN-01');
  };
})();
