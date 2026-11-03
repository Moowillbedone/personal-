/* CM-01 로그인·2단계 인증 (p.16), CM-02 센터 전환·본사 지원 모드 (p.17), CM-03 공통 UI·데이터 규칙 (p.18),
   KS-01 키오스크 입·퇴실, PA-01 학부모 휴대폰 (원문 범위 밖 검토 제안, IMP-05). */
(function () {
  const B = window.B, h = B.h, esc = B.esc;

  /* ---------------- scoped styles (cmk-) ---------------- */
  const CSS = [
    '.cmk-err{font-size:11.5px;color:var(--bad);font-weight:600}',
    '.cmk-note{font-size:11.5px;color:var(--sub);background:var(--bg);border-radius:8px;padding:7px 10px}',
    '.cmk-sub{border:1px dashed #cfd4dc;border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:8px;background:#fcfcfd}',
    '.cmk-sub p{margin:0;font-size:12px;color:var(--sub)}',
    '.cmk-check{display:inline-flex;gap:6px;align-items:center;font-size:12.3px;cursor:pointer}',
    '.cmk-check input{width:15px;height:15px;margin:0;flex:none}',
    '.cmk-link{background:none;border:0;padding:0;color:var(--navy);font-size:12px;text-decoration:underline;text-underline-offset:2px;cursor:pointer;text-align:left;align-self:flex-start}',
    '.cmk-full .btn{width:100%;justify-content:center;padding:9px 12px}',
    '.cmk-pp{padding-left:18px!important}',
    '.cmk-pinr > .pin{left:auto;right:-9px}',
    /* login */
    '.cmk-login{min-height:100%;display:flex;flex-direction:column;background:linear-gradient(180deg,#eef0f4,#e4e7ed)}',
    '.cmk-top{height:46px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:#2b2f38;color:#fff}',
    '.cmk-top b{display:flex;align-items:center;gap:8px;font-size:14px}',
    '.cmk-top b i{width:22px;height:22px;border-radius:6px;background:var(--brand);color:#fff;font-style:normal;font-size:11px;display:grid;place-items:center}',
    '.cmk-top span{font-family:var(--mono);font-size:11.5px;color:#b9c0cc}',
    '.cmk-flow{flex:1;display:flex;align-items:center;justify-content:center;gap:12px;padding:24px 22px 14px}',
    '.cmk-lcard{flex:0 1 300px;min-width:0;background:#fff;border:1px solid var(--line);border-radius:12px;padding:18px 18px 16px;box-shadow:0 8px 28px rgba(20,24,33,.08);display:flex;flex-direction:column;gap:10px}',
    '.cmk-lcard.dim{opacity:.55}',
    '.cmk-lcard.cur{border-color:var(--navy);box-shadow:0 0 0 3px var(--navy-soft),0 8px 28px rgba(20,24,33,.08)}',
    '.cmk-lcard h2{margin:0;font-size:15px}',
    '.cmk-lcard p{margin:0;font-size:12.3px;color:var(--sub)}',
    '.cmk-tag{align-self:flex-start;font-size:11.5px;font-weight:700;color:var(--sub);background:var(--bg);border-radius:6px;padding:2px 8px}',
    '.cmk-chev{flex:none;width:11px;height:11px;border-top:2px solid #9aa1ae;border-right:2px solid #9aa1ae;transform:rotate(45deg)}',
    '.cmk-code{font-family:var(--mono);font-size:22px;letter-spacing:.45em;text-align:center;padding:8px}',
    '.cmk-dest{display:flex;flex-direction:column;gap:6px}',
    '.cmk-dest div{display:flex;justify-content:space-between;gap:8px;padding:7px 10px;border-radius:8px;background:var(--bg);font-size:12.3px}',
    '.cmk-dest div.on{background:var(--navy-soft);color:var(--navy);font-weight:700}',
    '.cmk-dest span{font-family:var(--mono);font-size:11px}',
    '.cmk-lockline{font-size:12px;color:var(--sub);display:flex;flex-direction:column;gap:6px}',
    '.cmk-foot{text-align:center;color:var(--sub);font-size:12px;padding:0 20px 20px}',
    /* support band */
    '.cmk-band{display:flex;align-items:center;flex-wrap:wrap;gap:6px 0;background:#c8102e;color:#fff;border-radius:8px;padding:8px 12px 8px 18px;font-size:12.3px;margin-bottom:12px}',
    '.cmk-band b{margin-right:10px}',
    '.cmk-band > span:not(.pin){padding:0 10px;border-left:1px solid rgba(255,255,255,.45)}',
    '.cmk-band > b + span{border-left:0;padding-left:0}',
    '.cmk-band > span.r{margin-left:auto;display:flex;gap:6px;border-left:0;padding-right:0}',
    '.cmk-band.preview{margin:6px 0 0;font-size:11.5px;padding:6px 8px 6px 18px;gap:4px}',
    '.cmk-band.preview > b{margin-right:4px}',
    '.cmk-band.preview > span:not(.pin){border-left:0;padding:1px 7px;background:rgba(255,255,255,.16);border-radius:4px}',
    '.cmk-prev{margin-top:12px}',
    /* common rules */
    '.cmk-filter{display:grid;grid-template-columns:104px 120px minmax(120px,1fr) auto 96px 96px;gap:8px;align-items:end;margin-bottom:8px}',
    '.cmk-dimtbl{opacity:.5}',
    '.cmk-noperm{border:1px solid var(--line);border-radius:8px;padding:12px;background:var(--bg);display:flex;flex-direction:column;gap:3px;font-size:12.5px}',
    '.cmk-noperm span{color:var(--sub);font-size:12px}',
    '.cmk-warnbox{margin-top:10px;border:1px solid #f1d28c;background:#fffbf0;border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:8px;font-size:12.5px}',
    '.cmk-rows{display:grid;grid-template-columns:64px minmax(0,1fr);gap:8px 10px;align-items:center;font-size:12.5px;margin:0}',
    '.cmk-rows dt{color:var(--sub);margin:0}',
    '.cmk-rows dd{margin:0;display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
    '.cmk-blue{color:var(--info)}',
    '.cmk-var{display:inline-block;margin-left:4px;font-size:10px;font-weight:700;color:#fff;background:var(--info);border-radius:4px;padding:0 4px;line-height:1.6;vertical-align:1px}',
    /* kiosk */
    '.cmk-kiosk{min-height:100%;display:flex;flex-direction:column;background:#eef2f8}',
    '.cmk-k-head{display:flex;align-items:center;gap:16px;padding:14px 24px;background:#16213a;color:#fff}',
    '.cmk-k-logo{display:flex;align-items:center;gap:9px;font-weight:800;font-size:16px}',
    '.cmk-k-logo i{width:28px;height:28px;border-radius:8px;background:var(--brand);font-style:normal;font-size:12px;display:grid;place-items:center}',
    '.cmk-k-clock{margin-left:auto;display:flex;align-items:baseline;gap:10px}',
    '.cmk-k-clock b{font-size:26px;font-family:var(--mono)}',
    '.cmk-k-clock span{color:#b9c3d6;font-size:13px}',
    '.cmk-k-dev{display:flex;align-items:center;gap:6px;font-size:12.5px;color:#d9e0ec;background:rgba(255,255,255,.08);border-radius:8px;padding:5px 10px}',
    '.cmk-k-main{flex:1;display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:18px;padding:18px 24px 8px}',
    '.cmk-k-panel{background:#fff;border-radius:18px;padding:22px 24px;box-shadow:0 6px 24px rgba(20,33,58,.08);display:flex;flex-direction:column;gap:14px;min-width:0}',
    '.cmk-k-panel h2{margin:0;font-size:28px;line-height:1.3}',
    '.cmk-k-panel p{margin:0;font-size:16px;color:var(--sub)}',
    '.cmk-k-state{flex:1;display:flex;flex-direction:column;gap:12px;justify-content:center}',
    '.cmk-k-big{font-size:20px;font-weight:700;color:var(--ink)}',
    '.cmk-k-ico{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;font-size:28px;font-weight:800;color:#fff;background:var(--ok)}',
    '.cmk-k-ico.bad{background:var(--bad)}',
    '.cmk-k-ico.out{background:var(--navy)}',
    '.cmk-k-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px;font-size:15px}',
    '.cmk-k-list li{background:var(--bg);border-radius:10px;padding:8px 12px}',
    '.cmk-k-btns{display:flex;gap:10px;flex-wrap:wrap}',
    '.cmk-k-btns .btn{font-size:17px;padding:12px 22px;border-radius:12px}',
    '.cmk-k-sum{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    '.cmk-k-sum > div{background:var(--bg);border-radius:12px;padding:10px 14px;display:flex;flex-direction:column}',
    '.cmk-k-sum b{font-size:24px;font-family:var(--mono);line-height:1.2}',
    '.cmk-k-sum span{font-size:13px;font-weight:700}',
    '.cmk-k-sum em{font-style:normal;font-size:12px;color:var(--sub)}',
    '.cmk-k-label{font-size:15px;font-weight:700;text-align:center;color:var(--sub)}',
    '.cmk-k-digits{display:flex;gap:12px;justify-content:center}',
    '.cmk-k-digits i{width:58px;height:66px;border-radius:12px;border:2px solid #d5d9e0;display:grid;place-items:center;font-style:normal;font-size:30px;font-weight:800;font-family:var(--mono);background:#fff}',
    '.cmk-k-digits i.on{border-color:var(--navy)}',
    '.cmk-k-pad{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}',
    '.cmk-k-pad button{height:68px;border-radius:14px;border:1px solid #d5d9e0;background:#f7f8fa;font-size:26px;font-weight:700;color:var(--ink)}',
    '.cmk-k-pad button.fn{font-size:16px;color:var(--sub)}',
    '.cmk-k-pad button.ok{background:var(--navy);border-color:var(--navy);color:#fff;font-size:18px}',
    '.cmk-k-foot{display:flex;align-items:center;gap:14px;padding:8px 24px 14px;font-size:13px;color:var(--sub)}',
    '.cmk-k-net{display:inline-flex;align-items:center;gap:6px;font-weight:700;color:var(--ok)}',
    '.cmk-k-net::before{content:"";width:9px;height:9px;border-radius:50%;background:currentColor}',
    '.cmk-k-net.off{color:var(--bad)}',
    '.cmk-k-admin{margin-left:auto;background:#fff;border:1px solid var(--line);border-radius:10px;padding:7px 14px;font-weight:700;color:var(--sub)}',
    /* phone */
    '.cmk-phone{position:absolute;inset:0;display:flex;flex-direction:column;background:#fff}',
    '.cmk-ph-status{height:30px;flex:none;display:flex;justify-content:space-between;align-items:center;padding:0 20px;font-size:12.5px}',
    '.cmk-ph-ind{display:flex;gap:2px;align-items:flex-end}',
    '.cmk-ph-ind i{width:3px;background:#1a1e26;border-radius:1px}',
    '.cmk-ph-ind i:nth-child(1){height:4px}.cmk-ph-ind i:nth-child(2){height:6px}.cmk-ph-ind i:nth-child(3){height:8px}.cmk-ph-ind i:nth-child(4){height:10px}',
    '.cmk-ph-head{flex:none;display:flex;align-items:center;gap:10px;padding:8px 14px;border-bottom:1px solid var(--line);min-height:54px}',
    '.cmk-ph-title{display:flex;align-items:center;gap:9px;min-width:0}',
    '.cmk-ph-title b{display:block;font-size:14px;line-height:1.3}',
    '.cmk-ph-title small{display:block;font-size:11px;color:var(--mute)}',
    '.cmk-av{width:32px;height:32px;border-radius:10px;background:var(--brand);color:#fff;font-size:11px;font-weight:800;display:grid;place-items:center;flex:none}',
    '.cmk-av.navy{background:var(--navy)}',
    '.cmk-ph-body{flex:1;min-height:0;overflow-y:auto;overflow-anchor:none;padding:14px 12px;display:flex;flex-direction:column;gap:12px}',
    '.cmk-ph-body.chat{background:#dfe6ee}',
    '.cmk-day{align-self:center;font-size:11px;color:#4f5868;background:rgba(255,255,255,.65);border-radius:10px;padding:2px 10px}',
    '.cmk-msg{display:flex;gap:8px;align-items:flex-start}',
    '.cmk-bw{display:flex;flex-direction:column;gap:3px;min-width:0;max-width:256px}',
    '.cmk-from{font-size:11px;color:#4f5868}',
    '.cmk-bub{background:#fff;border-radius:4px 14px 14px 14px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.06)}',
    '.cmk-bh{background:#f3f4f7;font-size:11px;font-weight:700;color:var(--sub);padding:6px 11px}',
    '.cmk-bt{padding:9px 11px;font-size:12.5px;line-height:1.55}',
    '.cmk-bb{display:block;width:calc(100% - 22px);margin:0 11px 11px;border:1px solid var(--line);background:#fff;border-radius:8px;padding:7px;font-size:12.3px;font-weight:700;color:var(--ink)}',
    '.cmk-time{font-size:10.5px;color:#6b7383}',
    '.cmk-msg.sys .cmk-bh{background:#e2f4ea;color:var(--ok)}',
    '.cmk-pa-nav.tabs{flex:none;margin:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid var(--line);border-bottom:0;background:#fff;gap:0}',
    '.cmk-pa-nav.tabs button{justify-content:center;padding:10px 2px 14px;font-size:11.5px;border-bottom:0;border-top:2px solid transparent}',
    '.cmk-pa-nav.tabs button.on{border-top-color:var(--brand);border-bottom-color:transparent}',
    '.cmk-psec{border:1px solid var(--line);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:9px;background:#fff;flex:none}',
    '.cmk-psec h3{margin:0;font-size:14px}',
    '.cmk-psec p{margin:0;font-size:12.3px;color:var(--sub)}',
    '.cmk-phone .kv{grid-template-columns:76px minmax(0,1fr);font-size:12.3px}',
    '.cmk-phone .grid{gap:8px}',
    '.cmk-amt{font-size:26px;font-weight:800;font-variant-numeric:tabular-nums}',
    '.cmk-lines{display:flex;flex-direction:column;gap:5px;font-size:12.5px}',
    '.cmk-lines div{display:flex;justify-content:space-between;gap:8px}',
    '.cmk-lines div.tot{border-top:1px solid var(--line);padding-top:6px;font-weight:800}',
    '.cmk-blur{filter:blur(3px);user-select:none;pointer-events:none}',
  ].join('\n');
  try {
    if (!document.getElementById('cmk-style')) { const el = document.createElement('style'); el.id = 'cmk-style'; el.textContent = CSS; document.head.appendChild(el); }
  } catch (e) { /* no DOM */ }

  /* ---------------- small helpers ---------------- */
  const pad2 = n => String(n).padStart(2, '0');
  // 동작 뒤 엔진이 화면을 다시 그리면 바로 띄운 알림이 지워져서, 다시 그린 다음에 띄워요. 데모가 앞 단계를 다시 돌릴 때는 지금 화면 것만 남겨요.
  function say(msg) { const at = B.state.screenId; setTimeout(() => { if (B.state.screenId === at) B.toast(msg); }, 0); }
  const U = (s, id) => (s.ui[id] = s.ui[id] || {});
  const md = s => s.today.slice(5);
  function tick(s) { s.cmkClock = (s.cmkClock || 560) + 1; const m = s.cmkClock; return md(s) + ' ' + pad2(Math.floor(m / 60)) + ':' + pad2(m % 60); }
  function whoLabel(p) {
    if (p.side === 'hq') return p.name + ' (본사 ' + p.role + ')';
    const c = B.center(p.center);
    return p.name + ' (' + (c ? c.name.replace(/센터$/, '') : '') + ' ' + p.role + ')';
  }
  function audit(s, who, what, target, reason) { s.audit.unshift({ at: tick(s), who, what, target, reason: reason || '-' }); }
  function chk(field, on, label, o) {
    o = o || {};
    return '<label class="cmk-check' + (o.cls ? ' ' + o.cls : '') + '"' + h.p(o.pin) + '><input type="checkbox" data-field="' + field + '"' + (on ? ' checked' : '') + (o.disabled ? ' disabled' : '') + '> <span>' + esc(label) + '</span></label>';
  }
  const typeChip = t => t === '직영' ? 'navy' : t === '가맹' ? 'brand' : 'review';
  const addMin = (hhmm, d) => { const [a, b] = String(hhmm).split(':').map(Number); const m = a * 60 + b + d; return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60); };
  const fillTpl = (t, v) => String(t || '').replace(/#\{([^}]+)\}/g, (m, k) => (v[k] != null ? v[k] : m));
  const DAYS = '일월화수목금토';
  function dayLabel(ymd) { const [y, m, d] = ymd.split('-').map(Number); return y + '년 ' + m + '월 ' + d + '일 (' + DAYS[new Date(y, m - 1, d).getDay()] + ')'; }

  /* ---------------- data ---------------- */
  B.extend(s => {
    s.cm01 = { first: { 'ct:daegu:실장·데스크': true }, saved: {}, remembered: {} };
    s.cm02 = {
      extra: { 'ct:daegu:원장': [{ id: 'beomeo', name: '대구범어센터', type: '가맹', att: '오픈 준비' }] },
      att: { daegu: '47/52 (예시)' },
      last: {},
      log: [
        { at: '03-05 14:21', who: '홍길동 (본사 운영)', center: 'daegu', reason: '1:1 문의 대응 (#1042)', memo: '청구서 조정 문의 확인', seen: 'CT-15 본사 청구서·거래원장 열람', end: '03-05 14:38' },
        { at: '03-08 09:05', who: '홍길동 (본사 운영)', center: 'daechi1', reason: '1:1 문의 대응 (재등록 청구 금액)', memo: '4월 회차 금액 확인', seen: 'CT-08 재등록 대상 열람', end: '03-08 09:31' },
      ],
    };
    s.cm03 = {
      rows: [
        { id: 'e1', name: '김민수', grade: '초5', phone: '010-2381-5678', birth: '2016-05-14', status: '재원', cls: 'L3-화목B', fee: 260000, next: '4/1부터 270,000' },
        { id: 'e2', name: '이서린', grade: '초4', phone: '010-7720-1290', birth: '2017-02-03', status: '재원', cls: 'L2-화목A', fee: 260000, next: '' },
        { id: 'e3', name: '박지준', grade: '초6', phone: '010-5512-7731', birth: '2015-09-21', status: '재원', cls: 'L3-화목B', fee: 360000, next: '' },
        { id: 'e4', name: '정하윤', grade: '초3', phone: '010-3304-8812', birth: '2018-01-30', status: '휴원', cls: 'L1-월수A', fee: 260000, next: '' },
      ],
      unmask: null, downloads: [],
    };
    // 키오스크 입·퇴실 기록. CT-12가 읽는 공용 출결 데이터 (오늘 L1-월수A 수업 입실 2건, 예시)
    if (!Array.isArray(s.attendance)) s.attendance = [];
    s.attendance.push(
      { id: 'att1', center: 'daechi1', date: s.today, student: 's2', cls: 'c1', in: '15:55', out: '', device: '#1 입구 패드', alimIn: '발송 완료', alimOut: '', appLogout: '', sync: '전송', src: '키오스크' },
      { id: 'att2', center: 'daechi1', date: s.today, student: 's8', cls: 'c1', in: '15:58', out: '', device: '#1 입구 패드', alimIn: '발송 완료', alimOut: '', appLogout: '', sync: '전송', src: '키오스크' }
    );
    s.ks01 = { clock: '16:05', offline: false };
    // 학부모 대화방 예시 (박하준 s5, 주 3회 상품과 교재비로 계산)
    // 직영 주 3회는 변경신고 중이라 지금 등록액(340,000원)까지만 받아요 (B.feeNow)
    const book = s.extraFees[0].amount, amt = h.num(B.feeNow(s, 'daechi1', 'pr2') + book);
    s.pa01 = {
      seed: [
        { student: 's5', at: '2027-01-02 15:10', tpl: 'T06', name: '결과지 링크', text: '입학 테스트 결과지를 확인해 주세요.' },
        { student: 's5', at: '2027-02-20 10:00', tpl: 'T05', name: '재등록 안내', text: '3월 재등록 기간이에요. ' + amt + '원' },
        { student: 's5', at: '2027-02-20 10:01', tpl: 'T03', name: '수강료 안내', text: '3월 수강료 ' + amt + '원 안내입니다.' },
        { student: 's5', at: '2027-02-26 10:00', tpl: 'T04', name: '미납 안내', text: '3월 수강료가 아직 납부되지 않았어요.' },
        { student: 's5', at: '2027-03-04 17:45', tpl: 'T01', name: '입실 알림', text: '박하준 학생이 17:45에 입실했어요.' },
        { student: 's5', at: '2027-03-04 19:25', tpl: 'T02', name: '퇴실 알림', text: '박하준 학생이 19:25에 퇴실했어요.' },
      ],
      extra: [],
    };
  });

  /* =====================================================================
     CM-01 로그인·2단계 인증 (p.16)
     ===================================================================== */
  const ACC = {
    'hq:super': 'hq-super', 'hq:ops': 'hq-ops', 'hq:fin': 'hq-fin', 'hq:content': 'hq-content', 'hq:sv': 'hq-sv',
    'ct:daechi1:원장': 'daechi1-director', 'ct:daechi1:실장·데스크': 'daechi1-desk', 'ct:daechi1:교사': 'daechi1-teacher', 'ct:daechi1:보조교사': 'daechi1-assistant',
    'ct:daegu:원장': 'daegu-director', 'ct:daegu:실장·데스크': 'daegu-desk', 'ct:busan:원장': 'busan-director',
  };
  const DEMO_PW = 'brain180!';
  const accOf = p => ACC[p.id] || p.id;
  const personaByAcc = id => B.PERSONAS.find(p => accOf(p) === String(id || '').trim());
  const isMulti = (s, p) => !!(s.cm02 && s.cm02.extra[p.id]);
  const destOf = (s, p) => (p.side === 'hq' ? 'HQ-01' : isMulti(s, p) ? 'CM-02' : 'CT-01');
  const DEST_BTN = { 'HQ-01': '본사 대시보드로 들어가기', 'CT-01': '센터 대시보드로 들어가기', 'CM-02': '센터 선택으로 가기' };
  const need2fa = p => p.side === 'hq' || p.role === '원장';
  const staffOf = (s, p) => (p.side === 'ct' ? s.staff.find(x => x.center === p.center && x.name === p.name) : null);
  const pwRule = v => /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(v || '');
  function cm01Reset(ui, p) {
    Object.assign(ui, { step: 'login', pw: '', code: '', err: null, codeErr: null, find: false, lost: false, entered: false, method: 'app', np1: '', np2: '', pledge: false, firstErr: null, remember: false, rcode: '', rErr: null, forceFirst: false });
    ui.id = accOf(p); ui.idFor = p.id;
  }

  B.screen({
    id: 'CM-01', side: 'cm', phase: 'P1a', devices: ['pc', 'tablet'], pages: [16], chrome: 'none',
    title: '로그인·2단계 인증', menuLabel: '로그인', crumb: '로그인',
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, p = ctx.persona;
      if (ui.idFor !== p.id) { cm01Reset(ui, p); ui.fails = 0; ui.locked = false; }
      if (ui.entered) cm01Reset(ui, p);
      const step = ui.step || 'login';
      const dest = destOf(s, p);
      const shared = p.side === 'ct';
      const st = staffOf(s, p);

      const login = '<section class="cmk-lcard' + (step === 'login' ? ' cur' : '') + '">' +
        '<h2>브레인180 관리자 로그인</h2>' +
        '<div class="cmk-pp" data-pin="1"><span class="cmk-tag">본사·센터 계정 공통</span></div>' +
        h.field({ label: '아이디', value: ui.id, field: 'id', disabled: step !== 'login', hint: '위쪽 사람 선택에 맞춰 시연 계정이 채워져요' + (s.cm01.saved[p.id] ? ' (저장한 아이디)' : '') }) +
        h.field({ label: '비밀번호', type: 'password', value: ui.pw || '', field: 'pw', ph: '비밀번호', disabled: step !== 'login' || ui.locked, hint: '시연 비밀번호 ' + DEMO_PW }) +
        '<div class="row between">' + chk('saveId', ui.saveId, '아이디 저장') + '<button type="button" class="cmk-link" data-act="CM01.find">비밀번호 찾기</button></div>' +
        (ui.find ? findPanel(s, p, st) : '') +
        (ui.err ? '<div class="cmk-err">' + esc(ui.err) + '</div>' : '') +
        '<div class="cmk-full">' + h.btn(step === 'login' ? '로그인' : '비밀번호 확인 완료', { primary: step === 'login', act: 'CM01.login', disabled: step !== 'login' || ui.locked }) + '</div>' +
        '<div class="cmk-lockline cmk-pp" data-pin="3">' + (ui.locked
          ? h.alert('비밀번호를 5번 틀려서 10분 동안 잠겼어요 (예시). 10분 뒤 다시 하거나 비밀번호 찾기로 새로 정해요.', 'bad') + '<div class="row">' + h.btn('10분 지난 뒤로 보기 (시연)', { sm: true, act: 'CM01.unlock' }) + '</div>'
          : '<span>5회 실패 시 10분 잠금 (예시)' + (ui.fails ? ' <b style="color:var(--bad)">' + ui.fails + '/5회 틀림</b>' : '') + '</span>') + '</div>' +
        '</section>';

      const on2 = step === '2fa';
      const two = '<section class="cmk-lcard' + (on2 ? ' cur' : step === 'login' ? ' dim' : '') + '" data-pin="2">' +
        '<div class="row between"><h2>2단계 인증</h2>' + h.chip(need2fa(p) ? '필수' : '본사 설정으로 켜짐', need2fa(p) ? 'brand' : 'info') + '</div>' +
        '<p>' + (ui.method === 'sms' ? '휴대폰 문자로 받은 6자리 코드를 입력하세요.' : '등록된 인증 앱의 6자리 코드를 입력하세요.') + '</p>' +
        '<input class="inp cmk-code' + (ui.codeErr ? ' bad' : '') + '" maxlength="6" inputmode="numeric" autocomplete="one-time-code" aria-label="인증 코드 6자리" data-field="code" placeholder="000000" value="' + esc(ui.code || '') + '"' + (on2 ? '' : ' disabled') + '>' +
        (ui.codeErr ? '<div class="cmk-err">' + esc(ui.codeErr) + '</div>' : '') +
        chk('remember', !shared && ui.remember, '이 기기 30일 동안 기억 (예시)', { pin: 5, cls: 'cmk-pp', disabled: !on2 || shared }) +
        '<div class="small muted cmk-pp" style="margin-top:-6px">' + (shared ? '이 센터는 데스크 기기를 공용 기기로 정해 두어서 기억을 켤 수 없어요 (센터 설정).' : '처음에는 꺼져 있어요. 기억한 기기는 계정 설정에서 지워요.') + '</div>' +
        '<div class="cmk-full">' + h.btn('확인', { primary: on2, act: 'CM01.verify', disabled: !on2 }) + '</div>' +
        '<button type="button" class="cmk-link" data-act="CM01.sms">인증 앱이 없으면 휴대폰 문자로 받기</button>' +
        '<div class="cmk-pp" data-pin="6"><button type="button" class="cmk-link" data-act="CM01.lost">인증 수단을 잃어버렸어요</button></div>' +
        (ui.lost ? lostPanel(ui, p) : '') +
        '</section>';

      const rows = [['본사 계정', 'HQ-01', p.side === 'hq'], ['센터 계정', 'CT-01', p.side === 'ct' && dest === 'CT-01'], ['다점포 원장', 'CM-02 센터 선택', dest === 'CM-02']];
      let roleBody = '<div class="cmk-dest">' + rows.map(r => '<div class="' + (r[2] ? 'on' : '') + '">' + esc(r[0]) + '<span>' + esc(r[1]) + '</span></div>').join('') + '</div>' +
        '<p class="small">첫 로그인에는 비밀번호 변경과 보안 서약을 받아요.</p>';
      if (step === 'first') {
        roleBody += '<div class="cmk-sub"><b class="small">첫 로그인 · ' + esc(p.name) + '</b>' +
          h.field({ label: '새 비밀번호', type: 'password', value: ui.np1 || '', field: 'np1', hint: '영문, 숫자, 특수문자를 섞어 8자 이상 (예시)' }) +
          h.field({ label: '새 비밀번호 확인', type: 'password', value: ui.np2 || '', field: 'np2' }) +
          chk('pledge', ui.pledge, '개인정보 보안 서약에 동의해요. 원생 정보는 업무에만 쓰고 밖으로 가져가지 않아요.') +
          (ui.firstErr ? '<div class="cmk-err">' + esc(ui.firstErr) + '</div>' : '') +
          '<div class="cmk-full">' + h.btn('저장하고 계속', { primary: true, act: 'CM01.first' }) + '</div></div>';
      } else if (step === 'done') {
        roleBody += h.alert(p.label + ' 계정으로 로그인했어요. 접속기록에 남았어요 (HQ-22).', 'ok') +
          '<div class="cmk-full">' + h.btn(DEST_BTN[dest], { primary: true, act: 'CM01.enter' }) + '</div>';
      }
      roleBody += '<div class="small muted cmk-pp" data-pin="7">오래 쓰지 않으면 자동으로 로그아웃해요. 몇 분으로 할지는 아직 정하지 않았어요.</div>';
      const role = '<section class="cmk-lcard' + (step === 'first' || step === 'done' ? ' cur' : ' dim') + '" data-pin="4"><h2>역할별 첫 화면</h2>' + roleBody + '</section>';

      return '<div class="cmk-login"><div class="cmk-top"><b><i>180</i>브레인180 관리자</b><span>admin.brain180.example</span></div>' +
        '<div class="cmk-flow">' + login + '<i class="cmk-chev" aria-hidden="true"></i>' + two + '<i class="cmk-chev" aria-hidden="true"></i>' + role + '</div>' +
        '<div class="cmk-foot">학생과 학부모는 여기서 로그인하지 않아요. 학습 앱 계정과 관리자 계정은 따로예요.</div></div>';
    },
    prd: {
      summary: '본사와 센터 직원이 관리자 페이지에 들어오는 문이에요. 비밀번호 다음에 인증 앱 숫자를 한 번 더 넣고, 역할에 맞는 첫 화면으로 들어가요.',
      who: '본사 5개 역할(슈퍼관리자, 운영, 정산, 콘텐츠, SV)과 센터 4개 역할(원장, 실장·데스크, 교사, 보조교사)이 모두 같은 주소로 로그인해요. 학생과 학부모는 쓰지 않아요.',
      items: [
        { n: 1, t: '하나의 로그인, 역할로 나뉘는 첫 화면', d: '본사와 센터가 같은 주소로 로그인하고, 계정이 어디 소속인지에 따라 들어가는 곳이 달라요. 학생과 학부모 로그인은 없고, 학습 앱 계정과 관리자 계정은 따로예요.', ref: 'p.16 ①' },
        { n: 2, t: '2단계 인증', d: '비밀번호 다음에 인증 앱의 6자리 숫자를 넣어요. 본사 계정 전원과 원장은 꼭 하고, 실장과 교사는 본사 설정에 따라 해요. 인증 앱이 없으면 예외로 문자를 받을 수 있어요. 기억해 둔 기기는 계정 설정에서 지울 수 있어요.', ref: 'p.16 ②' },
        { n: 3, t: '실패 잠금과 비밀번호 찾기', d: '비밀번호를 5번 틀리면 10분 동안 잠겨요(예시). 비밀번호는 영문, 숫자, 특수문자를 섞어 8자 이상이에요(예시). 잊어버리면 등록된 휴대폰으로 본인 확인을 하고 재설정 링크를 받아요.', ref: 'p.16 ③' },
        { n: 4, t: '역할별 첫 화면과 접속기록', d: '본사 계정은 본사 대시보드(HQ-01), 센터 계정은 센터 대시보드(CT-01), 센터를 여러 곳 맡은 원장은 센터 선택(CM-02)으로 가요. 첫 로그인에는 비밀번호를 바꾸고 보안 서약을 해요. 로그인 성공과 실패는 접속기록(HQ-22)에 남아요.', pol: ['POL-42'], ref: 'p.16 ④' },
        { n: 5, t: '이 기기 기억은 처음에 꺼 둬요', kind: 'review', imp: 'IMP-14', d: '원문 그림에는 이 기기 30일 기억이 처음부터 켜져 있었어요. 여러 직원이 같이 쓰는 센터 데스크 PC에서는 다른 사람이 원장 권한으로 쓸 수 있어요. 그래서 처음에는 꺼 두고, 본사나 센터가 공용 기기로 정한 곳에서는 아예 켤 수 없게 해요.' },
        { n: 6, t: '인증 수단을 잃어버렸을 때', kind: 'review', imp: 'IMP-14', d: '휴대폰을 바꾸거나 잃어버리면 로그인을 못 해요. 본사 계정은 슈퍼관리자가, 원장은 본사 운영팀이, 교직원은 원장이 본인 확인 뒤 초기화해요. 처음 등록할 때 받은 1회용 복구 코드로도 들어올 수 있어요.' },
        { n: 7, t: '오래 쓰지 않으면 자동 로그아웃', kind: 'review', imp: 'IMP-14', d: '관리자 화면에는 아무것도 안 하면 로그아웃하는 규칙이 없었어요. 공용 PC를 켜 둔 채 자리를 비우는 일을 막으려고 넣어요. 몇 분으로 할지와 같은 계정의 동시 로그인을 허용할지는 아직 정하지 않았어요.' },
      ],
      open: ['잠금 횟수 5회, 잠금 10분, 비밀번호 규칙 (모두 예시 값)', '이 기기 기억 기간 30일 (그림에만 나온 값)', '실장과 교사의 2단계 인증을 켜는 화면, 보조교사도 해야 하는지', '문자 인증을 허용하는 예외 기준', '자동 로그아웃 시간과 동시 로그인 허용 여부'],
    },
  });

  function findPanel(s, p, st) {
    const phone = st ? h.maskPhone(st.phone) : '본사 인사 정보에 등록된 번호';
    return '<div class="cmk-sub"><b class="small">비밀번호 찾기</b><p>등록된 휴대폰 ' + esc(phone) + '로 본인 확인을 하면 새 비밀번호를 정하는 링크를 보내요.</p>' +
      '<div class="row">' + h.btn('본인 확인하고 링크 받기', { sm: true, act: 'CM01.sendReset' }) + h.btn('닫기', { sm: true, ghost: true, act: 'CM01.find' }) + '</div></div>';
  }
  function lostPanel(ui, p) {
    const mine = p.side === 'hq' ? 0 : p.role === '원장' ? 1 : 2;
    const who = [['본사 계정', '슈퍼관리자 (HQ-22)'], ['원장', '본사 운영팀 (HQ-05 계정 탭)'], ['교직원', '원장 (CT-20)']];
    return '<div class="cmk-sub"><b class="small">인증 수단 복구</b><p>휴대폰을 바꾸거나 잃어버렸다면 초기화를 요청해요. 본인 확인 뒤 다음 로그인 때 새로 등록하고, 이 과정은 감사 로그에 남아요.</p>' +
      '<div class="cmk-dest">' + who.map((w, i) => '<div class="' + (i === mine ? 'on' : '') + '">' + esc(w[0]) + '<span>' + esc(w[1]) + '</span></div>').join('') + '</div>' +
      h.field({ label: '1회용 복구 코드', value: ui.rcode || '', field: 'rcode', ph: '처음 등록할 때 받은 코드', err: ui.rErr }) +
      '<div class="row">' + h.btn('복구 코드로 들어가기', { sm: true, act: 'CM01.recover' }) + h.btn('초기화 요청', { sm: true, act: 'CM01.askReset' }) + '</div></div>';
  }

  B.action('CM01.login', (ctx, arg) => {
    const s = ctx.s, ui = U(s, 'CM-01'), p0 = B.persona();
    if (ui.idFor !== p0.id) { cm01Reset(ui, p0); ui.fails = 0; ui.locked = false; }
    if (arg && typeof arg === 'object') Object.assign(ui, arg);
    if (ui.locked) { ui.err = '잠겨 있어요. 10분 뒤 다시 해 주세요 (예시).'; return; }
    ui.err = null;
    const id = String(ui.id || '').trim(), pw = String(ui.pw || '');
    if (!id || !pw) { ui.err = '아이디와 비밀번호를 넣어 주세요.'; return; }
    const target = personaByAcc(id);
    if (!target || pw !== DEMO_PW) {
      ui.fails = (ui.fails || 0) + 1;
      audit(s, target ? whoLabel(target) : '알 수 없는 아이디 ' + id, '로그인 실패', '관리자 페이지', '비밀번호 불일치 ' + ui.fails + '회');
      if (ui.fails >= 5) { ui.locked = true; audit(s, target ? whoLabel(target) : id, '계정 잠금', '관리자 페이지', '5회 실패, 10분 잠금 (예시)'); }
      ui.err = '아이디 또는 비밀번호가 맞지 않아요 (' + ui.fails + '/5).';
      return;
    }
    const sf = staffOf(s, target);
    if (sf && /잠김/.test(sf.status)) {
      audit(s, whoLabel(target), '로그인 차단', '관리자 페이지', '경력 조회 전 계정');
      ui.err = '경력 조회 전이라 계정이 아직 열리지 않았어요. 원장에게 문의해 주세요 (CT-20).';
      return;
    }
    if (target.id !== B.state.persona) { B.state.persona = target.id; ui.idFor = target.id; }
    ui.fails = 0; ui.step = '2fa'; ui.method = 'app'; ui.code = ''; ui.codeErr = null;
    if (arg && arg.first) ui.forceFirst = true;
  });
  B.action('CM01.verify', (ctx, arg) => {
    const s = ctx.s, ui = U(s, 'CM-01'), p = B.persona();
    if (arg && typeof arg === 'object') Object.assign(ui, arg); else if (arg != null && /^\d{6}$/.test(String(arg))) ui.code = String(arg);
    if (ui.step !== '2fa') { ui.codeErr = '먼저 아이디와 비밀번호로 로그인해 주세요.'; return; }
    const code = String(ui.code || '').replace(/\D/g, '');
    if (code.length !== 6) { ui.codeErr = '6자리 숫자를 넣어 주세요.'; return; }
    ui.codeErr = null;
    if (ui.remember && p.side !== 'ct') { s.cm01.remembered[p.id] = '2027-04-07'; say('이 기기를 30일 동안 기억해요 (예시). 계정 설정에서 지울 수 있어요.'); }
    if (s.cm01.first[p.id] || ui.forceFirst) { ui.step = 'first'; return; }
    ui.step = 'done';
    audit(s, whoLabel(p), '로그인 성공', '관리자 페이지', ui.method === 'sms' ? '2단계 인증 문자 (예외 수단)' : '2단계 인증 앱');
  });
  B.action('CM01.first', (ctx, arg) => {
    const s = ctx.s, ui = U(s, 'CM-01'), p = B.persona();
    if (arg && typeof arg === 'object') Object.assign(ui, arg);
    if (ui.step !== 'first') return;
    ui.firstErr = !pwRule(ui.np1) ? '새 비밀번호는 영문, 숫자, 특수문자를 섞어 8자 이상으로 만들어 주세요.'
      : ui.np1 !== ui.np2 ? '새 비밀번호 두 칸이 서로 달라요.'
      : !ui.pledge ? '보안 서약에 동의해야 들어갈 수 있어요.' : null;
    if (ui.firstErr) return;
    s.cm01.first[p.id] = false; ui.forceFirst = false; ui.step = 'done';
    audit(s, whoLabel(p), '로그인 성공 (첫 로그인)', '관리자 페이지', '비밀번호 변경, 보안 서약');
  });
  B.action('CM01.enter', ctx => {
    const s = ctx.s, ui = U(s, 'CM-01'), p = B.persona();
    if (ui.step !== 'done') { say('인증을 마치면 들어갈 수 있어요.'); return; }
    if (ui.saveId) s.cm01.saved[p.id] = true;
    ui.entered = true;
    B.go(destOf(s, p)); return false;
  });
  B.action('CM01.quick', (ctx, arg) => {
    const s = ctx.s, ui = U(s, 'CM-01');
    cm01Reset(ui, B.persona()); ui.fails = 0; ui.locked = false; ui.pw = DEMO_PW;
    B.actions['CM01.login'](ctx, arg && arg.first ? { first: true } : null);
    B.actions['CM01.verify'](ctx, '180180');
    if (ui.step === 'first' && arg && arg.np) B.actions['CM01.first'](ctx, { np1: arg.np, np2: arg.np, pledge: true });
    if (arg && arg.enter && ui.step === 'done') return B.actions['CM01.enter'](ctx);
  });
  B.action('CM01.sms', ctx => {
    const s = ctx.s, ui = U(s, 'CM-01'), p = B.persona(), sf = staffOf(s, p);
    if (ui.step !== '2fa') { say('먼저 아이디와 비밀번호로 로그인해 주세요.'); return false; }
    ui.method = 'sms';
    say('등록된 휴대폰' + (sf ? ' ' + h.maskPhone(sf.phone) : '') + '로 인증 코드를 보냈어요. 문자는 예외 수단이에요.');
  });
  B.action('CM01.find', ctx => { const ui = U(ctx.s, 'CM-01'); ui.find = !ui.find; });
  B.action('CM01.sendReset', ctx => {
    const ui = U(ctx.s, 'CM-01'); ui.find = false;
    audit(ctx.s, whoLabel(B.persona()), '비밀번호 재설정 요청', '관리자 페이지', '등록 휴대폰 본인 확인');
    say('본인 확인을 마치면 재설정 링크를 문자로 보내요 (시연).');
  });
  B.action('CM01.unlock', ctx => { const ui = U(ctx.s, 'CM-01'); ui.locked = false; ui.fails = 0; ui.err = null; say('10분이 지나 잠금이 풀렸어요 (시연).'); });
  B.action('CM01.lost', ctx => { const ui = U(ctx.s, 'CM-01'); ui.lost = !ui.lost; });
  B.action('CM01.recover', (ctx, arg) => {
    const s = ctx.s, ui = U(s, 'CM-01'), p = B.persona();
    if (typeof arg === 'string') ui.rcode = arg;
    if (ui.step === 'login') { ui.rErr = '먼저 아이디와 비밀번호로 로그인해 주세요.'; return; }
    if (!String(ui.rcode || '').trim()) { ui.rErr = '복구 코드를 넣어 주세요.'; return; }
    ui.rErr = null; ui.lost = false; ui.step = 'done';
    audit(s, whoLabel(p), '로그인 성공 (복구 코드)', '관리자 페이지', '다음 로그인 때 인증 앱 다시 등록');
    say('복구 코드로 들어왔어요. 다음 로그인 때 인증 앱을 다시 등록해요.');
  });
  B.action('CM01.askReset', ctx => {
    audit(ctx.s, whoLabel(B.persona()), '2단계 인증 초기화 요청', '관리자 페이지', '인증 수단 분실');
    say('초기화 요청을 보냈어요. 담당자가 본인 확인 뒤 풀어 줘요.');
  });

  /* =====================================================================
     CM-02 센터 전환·본사 지원 모드 (p.17)
     ===================================================================== */
  function attText(s, c) {
    const n = (s.attendance || []).filter(a => a.center === c.id && a.date === s.today).length;
    if (n) return '입실 ' + n + '명';
    return (s.cm02.att || {})[c.id] || '-';
  }
  function band(c, live) {
    return '<div class="cmk-band' + (live ? '' : ' preview') + '" data-pin="3"><b>본사 지원 모드</b><span>' + esc(c ? c.name : '') + '</span><span>읽기 전용</span><span>남은 시간 24:12 (예시)</span><span>모든 동작이 기록됩니다</span>' +
      (live ? '<span class="r">' + h.btn('센터 화면 보기', { sm: true, go: 'CT-01' }) + h.btn('지원 모드 종료', { sm: true, act: 'CM02.end' }) + '</span>' : '') + '</div>';
  }
  // HQ-01 같은 화면이 s.ui['CM-02'] = {center, reason, next, from}을 넘기면 사유를 미리 채우고, 열고 나서 next 화면으로 가요
  const supportDest = ui => { const n = ui.next || ui.target; return n && /^CT-/.test(n) ? n : 'CT-01'; };
  function closeOpenLogs(s) { s.cm02.log.forEach(l => { if (!l.end) l.end = tick(s); }); }
  const directNote = () => '<div data-pin="7" style="margin-top:8px">' + h.alert('직영 센터는 본사(MSC Brain)가 원생 정보 처리자예요. 직영 업무를 돕는 본사 직원에게 직영 센터 계정을 따로 줄지, 지원 모드로 열게 할지 정하는 중이에요 (부록 A 결정 10번).', 'review', { title: '검토 반영' }) + '</div>';
  const blockNote = () => '<div data-pin="5" style="margin-top:10px">' + h.alert('지원 모드에서는 원생 정보가 가려진 채로 보이고, 엑셀 다운로드와 마스킹 해제 버튼이 잠겨요.', 'review', { title: '검토 반영' }) + '</div>';

  B.screen({
    id: 'CM-02', side: 'cm', phase: 'P1a', devices: ['pc'], pages: [17],
    title: '센터 전환·본사 지원 모드', menuLabel: '센터 전환·지원 모드', crumb: 'GNB > 센터 선택',
    render(ctx) {
      const s = ctx.s, p = ctx.persona, hq = p.side === 'hq';
      if (!B.state.support && s.cm02.log.some(l => !l.end)) closeOpenLogs(s);
      const sup = hq && B.state.support ? B.center(B.state.support) : null;
      let html = sup ? band(sup, true) : '';
      html += '<div class="grid g2" style="align-items:start">' + (hq ? pickHQ(ctx) : pickCT(ctx)) + (hq ? openCard(ctx, !sup) : ruleCard(ctx)) + '</div>';
      html += '<div style="margin-top:12px">' + logCard(ctx) + '</div>';
      return html;
    },
    prd: {
      summary: '센터를 여러 곳 맡은 원장이 센터를 바꿔 보고, 본사 직원이 도우려고 센터 화면을 잠깐 여는 곳이에요. 열 때마다 사유를 남기고, 원생 정보는 가린 채로 보여요.',
      who: '센터 전환은 여러 센터를 맡은 원장이 써요. 지원 모드는 본사 직원이 열고, 어느 본사 역할까지 열 수 있는지는 아직 정하지 않았어요. 센터 원장은 본사가 연 기록을 봐요.',
      items: [
        { n: 1, t: '다점포 원장의 센터 전환', d: '한 사람이 여러 센터를 맡으면 위쪽 센터 선택에서 바꿔요. 센터마다 데이터가 나뉘어 있어서 목록과 검색은 고른 센터 안에서만 돼요. 마지막으로 쓴 센터로 시작해요.', ref: 'p.17 ①' },
        { n: 2, t: '본사 지원 모드', d: '본사가 문의 대응이나 정산 확인, 점검 때문에 센터 화면을 열 때 사유를 꼭 넣어요. 기본은 읽기 전용이고, 고쳐야 할 때는 센터 원장의 동의를 받아요. 원생 정보는 지원 모드에서도 가려져요. 열면 그 센터의 대시보드(CT-01)를 본사 사람으로 보고, 본사 대시보드 경고에서 넘어오면 사유를 미리 채워 줘요.', pol: ['POL-42'], ref: 'p.17 ②' },
        { n: 3, t: '지원 모드 표시', d: '지원 모드인 동안 화면 위에 빨간 띠를 고정해서 지금 남의 센터를 보고 있다는 걸 알려요. 30분이 지나면 저절로 끝나요(예시).', ref: 'p.17 ③' },
        { n: 4, t: '기록', d: '열람 사유와 본 화면과 동작을 감사 로그(HQ-22)에 남겨요. 센터도 본사가 언제 왜 열었는지 볼 수 있어요(CT-17).', ref: 'p.17 ④' },
        { n: 5, t: '지원 모드에서는 내려받기와 해제를 막아요', kind: 'review', imp: 'IMP-14', d: '읽기 전용이라면서 원생 명단을 파일로 가져갈 수 있으면 안 돼요. 지원 모드에서는 엑셀 다운로드와 마스킹 해제 버튼을 잠가요. 공통 규칙 화면(CM-03)에서도 같이 잠겨요.' },
        { n: 6, t: '편집 요청은 P1b부터', kind: 'review', imp: 'IMP-14', d: '원장이 어디서 어떻게 동의하는지 흐름이 아직 없어요. 그래서 P1a에서는 읽기 전용만 열고, 센터 동의를 받는 편집 요청은 다음 단계로 미뤄요.' },
        { n: 7, t: '직영 센터는 처리자가 본사예요', kind: 'review', imp: 'IMP-04', cond: true, reveal: 'CM02.pick', revealArg: 'daechi1', d: '직영 센터는 본사(MSC Brain)가 직접 운영해서 원생 정보 처리자도 본사예요. 직영 업무를 돕는 본사 직원에게 직영 센터 계정을 줄지, 지원 모드로 열게 할지 정해야 해요. 직영 센터를 고르면 이 안내가 보여요.' },
      ],
      open: ['지원 모드 자동 종료 30분 (예시)', '편집 요청에 원장이 동의하는 방법', '지원 모드를 쓸 수 있는 본사 역할과 사유 목록', '직영 센터를 돕는 본사 직원의 계정 방식 (부록 A 결정 10번)', '지원 모드를 P1a에 열지 P1b로 미룰지 (검토 의견 IMP-02는 P1b로 미루고 그동안 공유 시트와 메신저로 대신하자는 안)'],
    },
  });

  function pickHQ(ctx) {
    const s = ctx.s, ui = ctx.ui, cur = ui.center || 'daegu';
    const rows = s.centers.filter(c => c.status === '운영');
    return h.card({
      title: '센터 선택', sub: '열 센터를 골라요', pin: 1,
      body: h.table({
        cols: [
          { label: '센터', render: c => '<b>' + esc(c.name) + '</b>' },
          { label: '유형', render: c => h.chip(c.type, typeChip(c.type)) },
          { label: '원장', k: 'director' },
          { label: '오늘 출결', render: c => esc(attText(s, c)) },
        ],
        rows, rowAttr: c => ' class="click' + (c.id === cur ? ' sel' : '') + '" data-act="CM02.pick" data-arg="' + c.id + '"',
      }) + '<div class="hint small muted" style="margin-top:8px">행을 누르면 오른쪽 센터 칸에 들어가요. 목록과 검색은 연 센터 안에서만 돼요.</div>',
    });
  }
  function myCenters(s, p) {
    const own = B.center(p.center);
    return [{ id: own.id, name: own.name, type: own.type, att: attText(s, own), open: true }].concat((s.cm02.extra[p.id] || []).map(x => Object.assign({ open: false }, x)));
  }
  function pickCT(ctx) {
    const s = ctx.s, p = ctx.persona, list = myCenters(s, p);
    const last = s.cm02.last[p.id] || p.center;
    return h.card({
      title: '센터 선택', sub: p.name + ' ' + p.role, pin: 1,
      body: h.table({
        cols: [
          { label: '센터', render: c => '<b>' + esc(c.name) + '</b>' + (c.id === last ? ' ' + h.chip('마지막 사용', 'info') : '') },
          { label: '유형', render: c => h.chip(c.type, typeChip(c.type)) },
          { label: '내 역할', render: () => esc(p.role) },
          { label: '오늘 출결', render: c => esc(c.att) },
          { label: '', render: c => c.open ? h.btn('열기', { sm: true, act: 'CM02.switch', arg: c.id }) : h.btn('열기', { sm: true, disabled: true, title: '오픈 준비 중이라 아직 열 수 없어요' }) },
        ],
        rows: list,
        rowAttr: c => ' class="click' + (c.id === last ? ' sel' : '') + '" data-act="CM02.switch" data-arg="' + c.id + '"',
      }) + '<div class="small muted" style="margin-top:8px">마지막으로 쓴 센터로 시작해요.' + (list.length === 1 ? ' 지금 계정은 센터 한 곳만 맡고 있어요. 대구수성센터 원장으로 바꾸면 여러 센터가 보여요.' : '') + '</div>',
    });
  }
  function openCard(ctx, preview) {
    const s = ctx.s, ui = ctx.ui;
    const cid = ui.center || 'daegu', c = B.center(cid);
    const base = ['', '1:1 문의 대응 (#1042)', '정산 확인', '운영 점검 (SV)', '장애 확인', '기타 (메모에 적어요)'];
    const reason = ui.reason == null ? '1:1 문의 대응 (#1042)' : ui.reason;
    const reasons = reason && !base.includes(reason) ? base.concat(reason) : base;
    const next = supportDest(ui), nextDef = B.screens[next];
    const fromNote = ui.from ? '<div class="small muted">' + esc(ui.from) + '에서 넘어와 사유를 미리 채웠어요. 열면 ' + esc(next + (nextDef ? ' ' + nextDef.title : '')) + ' 화면으로 가요.</div>' : '';
    return h.card({
      title: '센터 화면 열기 (본사)', pin: 2,
      body: '<div class="stack" style="gap:10px">' +
        h.field({ label: '센터', req: true, type: 'select', value: cid, options: s.centers.filter(x => x.status === '운영').map(x => ({ v: x.id, l: x.name + ' (' + x.type + ')' })), field: 'center' }) +
        h.field({ label: '사유', req: true, type: 'select', value: reason, options: reasons.map(r => ({ v: r, l: r || '사유를 골라요' })), field: 'reason', err: ui.err_reason }) +
        h.field({ label: '메모', value: ui.memo || '', field: 'memo', ph: '청구서 조정 문의 확인', err: ui.err_memo }) + fromNote +
        '<div class="field"><label>권한</label><div class="row">' + h.opts([{ v: '읽기 전용', l: '읽기 전용' }, { v: '편집', l: '편집 요청 (센터 동의 뒤)', dis: true, title: 'P1b부터 열어요' }], '읽기 전용') +
        '<span class="cmk-pp" data-pin="6">' + h.chip('편집 요청은 P1b부터', 'review') + '</span></div></div></div>' +
        blockNote() + (c && c.type === '직영' ? directNote() : '') +
        (preview ? '<div class="cmk-prev"><div class="small muted">열면 화면 위에 이 띠가 붙어요</div>' + band(c, false) + '</div>' : '') +
        '<div class="row" style="justify-content:flex-end;margin-top:12px">' + h.btn('취소', { act: 'CM02.cancel' }) + h.btn('열기', { primary: true, act: 'CM02.open', disabled: !ctx.canEdit }) + '</div>',
    });
  }
  function ruleCard(ctx) {
    const c = ctx.center;
    return h.card({
      title: '본사 지원 모드', sub: '본사가 우리 센터 화면을 열 때', pin: 2,
      body: h.kv([['사유', '열 때마다 꼭 남겨요'], ['권한', '기본은 읽기 전용이에요'], ['원생 정보', '지원 모드에서도 가려져요'], ['자동 종료', '30분 뒤 끝나요 (예시)']]) +
        '<div class="cmk-prev"><div class="small muted">본사 화면 위에는 이 띠가 붙어요</div>' + band(c, false) + '</div>' +
        '<div class="row" style="margin-top:10px"><span class="cmk-pp" data-pin="6">' + h.chip('편집 요청은 P1b부터', 'review') + '</span><span class="small muted">P1a에는 본사가 우리 센터 내용을 고칠 수 없어요.</span></div>' +
        blockNote() + (c && c.type === '직영' ? directNote() : ''),
    });
  }
  function logCard(ctx) {
    const s = ctx.s, p = ctx.persona, hq = p.side === 'hq';
    const mine = (hq ? s.cm02.log : s.cm02.log.filter(l => l.center === p.center)).slice().reverse();
    return h.card({
      title: hq ? '지원 모드 기록' : '본사 열람 기록', sub: hq ? 'HQ-22 감사 로그에도 남아요' : '센터는 CT-17에서도 같은 기록을 봐요', pin: 4,
      body: h.table({
        cols: [
          { label: '연 시각', k: 'at' }, { label: '본사 담당', k: 'who' },
          { label: '센터', render: l => esc((B.center(l.center) || {}).name || l.center) },
          { label: '사유', k: 'reason' }, { label: '메모', k: 'memo' }, { label: '본 화면과 동작', k: 'seen' },
          { label: '끝난 시각', render: l => (l.end ? esc(l.end) : h.chip('진행 중', 'info')) },
        ],
        rows: mine, empty: '아직 본사가 이 센터를 연 기록이 없어요.',
      }),
    });
  }

  B.action('CM02.pick', (ctx, id) => {
    const ui = U(ctx.s, 'CM-02');
    if (B.center(id)) ui.center = id;
    ui.err_reason = null;
  });
  B.action('CM02.cancel', ctx => {
    const ui = U(ctx.s, 'CM-02');
    Object.assign(ui, { reason: '1:1 문의 대응 (#1042)', memo: '', err_reason: null, err_memo: null });
    ['next', 'target', 'from'].forEach(k => { delete ui[k]; });
  });
  B.action('CM02.open', (ctx, arg) => {
    const s = ctx.s, ui = U(s, 'CM-02'), p = B.persona();
    if (typeof arg === 'string' && B.center(arg)) ui.center = arg;
    else if (arg && typeof arg === 'object') Object.assign(ui, arg);
    if (p.side !== 'hq') { say('지원 모드는 본사 계정만 열 수 있어요.'); return false; }
    const reason = ui.reason == null ? '1:1 문의 대응 (#1042)' : ui.reason;
    ui.err_reason = !reason ? '사유를 골라 주세요. 사유 없이 센터 화면을 열 수 없어요.' : null;
    ui.err_memo = /^기타/.test(reason) && !String(ui.memo || '').trim() ? '기타를 고르면 메모를 꼭 적어요.' : null;
    if (ui.err_reason || ui.err_memo) return;
    const cid = ui.center || 'daegu', c = B.center(cid);
    const dest = supportDest(ui), destDef = B.screens[dest];
    closeOpenLogs(s);
    const at = tick(s);
    s.cm02.log.push({ at, who: whoLabel(p), center: cid, reason, memo: ui.memo || '-', seen: dest + (destDef ? ' ' + destDef.title : '') + ' 열람 (읽기 전용)', end: '' });
    s.audit.unshift({ at, who: whoLabel(p), what: '지원 모드 열람', target: c.name, reason });
    B.state.support = cid;
    ['next', 'target', 'from'].forEach(k => { delete ui[k]; });
    const moved = !!destDef;
    if (moved) B.go(dest);
    say(c.name + ' 화면을 읽기 전용으로 열었어요. 사유와 본 화면이 기록돼요.');
    if (moved) return false;
  });
  B.action('CM02.end', ctx => {
    closeOpenLogs(ctx.s); B.state.support = null;
    say('지원 모드를 끝냈어요. 기록이 남았어요.');
  });
  B.action('CM02.switch', (ctx, id) => {
    const s = ctx.s, p = B.persona();
    if (p.side !== 'ct') { say('센터 전환은 센터 계정에서 써요. 본사는 지원 모드로 열어요.'); return false; }
    const ex = (s.cm02.extra[p.id] || []).find(x => x.id === id);
    if (ex) { say(ex.name + '는 오픈 준비 중이라 아직 열 수 없어요. 운영 개시 승인(HQ-06) 뒤에 열려요.'); return false; }
    s.cm02.last[p.id] = p.center;
    if (B.screens['CT-01']) { B.go('CT-01'); return false; }
    say(B.center(p.center).name + '로 시작해요.');
  });

  /* =====================================================================
     CM-03 공통 UI·데이터 규칙 (p.18)
     ===================================================================== */
  function canUnmask(ctx) {
    const p = B.persona();
    if (p.side === 'hq' && B.state.support) return { ok: false, why: '지원 모드에서는 풀 수 없어요' };
    if (p.side === 'hq') return p.role === '슈퍼관리자' ? { ok: true } : { ok: false, why: '본사 화면은 기본으로 가려요' };
    return ['원장', '실장·데스크'].includes(p.role) ? { ok: true } : { ok: false, why: '이 역할은 풀 수 없어요' };
  }
  function cm03Rows(s, ui) {
    const a = ui.applied || { st: '재원', cls: '전체', q: '', sort: '이름순' };
    const q = String(a.q || '').trim();
    let rows = s.cm03.rows.filter(r => (a.st === '전체' || r.status === a.st) && (a.cls === '전체' || r.cls === a.cls) && (!q || r.name.includes(q) || r.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '') || '#')));
    if (a.sort === '학년순') rows = rows.slice().sort((x, y) => x.grade.localeCompare(y.grade));
    return rows;
  }
  const bMask = b => b.slice(0, 4) + '-**-**';

  B.screen({
    id: 'CM-03', side: 'cm', phase: 'P1a', devices: ['pc', 'tablet'], pages: [18],
    title: '공통 UI·데이터 규칙', menuLabel: '공통 UI·데이터 규칙', crumb: '모든 화면 > 공통 규칙 적용 예',
    render(ctx) {
      const s = ctx.s, ui = ctx.ui;
      if (ui.dl === undefined) ui.dl = true;
      const a = ui.applied || { st: '재원', cls: '전체', q: '', sort: '이름순', size: '20개씩' };
      const rows = cm03Rows(s, ui);
      const un = s.cm03.unmask;
      const can = canUnmask(ctx);
      const state = ui.state || '정상';

      const filt = '<div class="cmk-filter cmk-pinr" data-pin="1">' +
        h.field({ label: '상태', type: 'select', value: ui.f_st || a.st, options: ['재원', '휴원', '전체'], field: 'f_st' }) +
        h.field({ label: '반', type: 'select', value: ui.f_cls || a.cls, options: ['전체', 'L1-월수A', 'L2-화목A', 'L3-화목B'], field: 'f_cls' }) +
        h.field({ label: '검색어', value: ui.q == null ? a.q : ui.q, field: 'q', ph: '이름·연락처 검색' }) +
        '<div class="field"><label>&nbsp;</label>' + h.btn('검색', { primary: true, act: 'CM03.search' }) + '</div>' +
        h.field({ label: '정렬', type: 'select', value: ui.f_sort || a.sort, options: ['이름순', '학년순'], field: 'f_sort' }) +
        h.field({ label: '한 페이지', type: 'select', value: ui.f_size || a.size || '20개씩', options: ['20개씩', '50개씩'], field: 'f_size' }) +
        '</div><div class="small muted" style="margin-bottom:10px">' + h.chip('필터 기억 중', 'info') + ' 검색 조건, 정렬, 페이지 크기는 화면을 떠났다 돌아와도 그대로예요.</div>';

      const isUn = r => un && un.id === r.id;
      const table = h.table({
        cols: [
          { label: '이름', render: r => isUn(r) ? '<b>' + esc(r.name) + '</b> ' + h.chip('해제 중', 'warn') : esc(h.mask(r.name)) },
          { label: '학년', k: 'grade' },
          { label: '보호자 연락처', render: r => '<span class="mono small">' + esc(isUn(r) ? r.phone : h.maskPhone(r.phone)) + '</span>' },
          { label: '생년월일', render: r => '<span class="mono small">' + esc(isUn(r) ? r.birth : bMask(r.birth)) + '</span>' },
          { label: '수강료', num: true, render: r => h.num(r.fee) + '<span class="cmk-var">가변</span>' },
          { label: '다음 변경', render: r => r.next ? esc(r.next) + '<span class="cmk-var">가변</span>' : '<span class="muted">-</span>' },
        ],
        rows: state === '빈 목록' ? [] : rows,
        empty: '조건에 맞는 원생이 없어요. 필터를 바꾸거나 검색어를 지워 보세요.',
      });
      let listBody = filt;
      if (state === '오류') listBody += h.alert('목록을 불러오지 못했어요. 잠시 뒤 다시 해 주세요.', 'bad') + '<div class="row" style="margin-top:8px">' + h.btn('다시 시도', { sm: true, act: 'CM03.state', arg: '정상' }) + '</div>';
      else if (state === '불러오는 중') listBody += '<div class="cmk-note" role="status">원생 목록을 불러오는 중이에요. 잠시만 기다려 주세요.</div><div class="cmk-dimtbl" style="margin-top:8px">' + h.table({ cols: [{ label: '이름' }, { label: '학년' }, { label: '보호자 연락처' }, { label: '생년월일' }, { label: '수강료' }, { label: '다음 변경' }], rows: [], empty: '불러오는 중' }) + '</div>';
      else if (state === '오프라인') listBody += h.alert('인터넷 연결이 끊겼어요. 마지막으로 불러온 목록을 보여 줘요. 저장과 다운로드는 연결되면 다시 해요.', 'warn') + '<div class="cmk-dimtbl" style="margin-top:8px">' + table + '</div>';
      else listBody += table;
      listBody += '<div class="row" style="margin-top:10px" data-pin="2">' + h.btn('마스킹 해제', { act: 'CM03.unmaskForm', arg: 'open', disabled: !can.ok, title: can.why }) +
        '<span class="cmk-pp" data-pin="7">' + h.chip('한 명씩만', 'review') + '</span>' +
        '<span class="small muted">사유를 넣고 풀어요. 10분 뒤 다시 가려요 (예시).</span>' + (can.ok ? '' : h.chip(can.why, 'warn')) + '</div>';
      if (ui.umForm && can.ok) {
        const pool = rows.length ? rows : s.cm03.rows;
        listBody += '<div class="cmk-sub" style="margin-top:10px"><div class="grid g3" style="align-items:end">' +
          h.field({ label: '대상 (한 명만)', type: 'select', value: ui.um_id || pool[0].id, options: pool.map(r => ({ v: r.id, l: h.mask(r.name) + ' ' + r.grade })), field: 'um_id' }) +
          h.field({ label: '사유', req: true, type: 'select', value: ui.um_reason || '', options: [{ v: '', l: '사유를 골라요' }, '보호자 전화 상담', '수납 확인', '1:1 문의 처리'], field: 'um_reason', err: ui.um_err }) +
          '<div class="field"><div class="row">' + h.btn('취소', { act: 'CM03.unmaskForm', arg: 'close' }) + h.btn('해제', { primary: true, act: 'CM03.unmask' }) + '</div></div></div></div>';
      }
      if (un) {
        const r = s.cm03.rows.find(x => x.id === un.id);
        listBody += '<div style="margin-top:10px">' + h.alert(h.mask(r.name) + ' 학생 정보를 ' + un.at.slice(6) + '에 풀었어요. 10분 뒤 다시 가려요 (예시). 사유 ' + un.reason, 'warn') + '<div class="row" style="margin-top:6px">' + h.btn('지금 다시 가리기', { sm: true, act: 'CM03.remask' }) + '</div></div>';
      }
      listBody += '<div class="row cmk-pp" style="margin-top:12px" data-pin="10"><span class="small muted">목록 상태 미리 보기</span>' + h.opts(['정상', '빈 목록', '불러오는 중', '오류', '오프라인'], state, { act: 'CM03.state' }) + '</div>';

      let html = h.card({ title: '원생 목록 (예시 화면)', sub: '공통 규칙 적용 예', right: h.btn('엑셀 다운로드', { act: 'CM03.dl', arg: 'open', pin: 3 }), body: listBody });
      html += '<div class="grid g2" style="margin-top:12px;align-items:start">' + dlCard(ctx, rows) + '<div class="stack">' + noPermCard(ctx) + dirtyCard(ctx) + varCard(ctx) + '</div></div>';
      return html;
    },
    prd: {
      summary: '모든 관리자 화면에 똑같이 지키는 약속을 실제 목록 예시로 보여 줘요. 목록과 검색, 개인정보 가리기, 엑셀 내려받기, 바뀔 수 있는 값 표시, 권한 없음 안내, 저장 안 하고 나갈 때 경고가 들어 있어요.',
      who: '본사와 센터의 모든 관리자에게 똑같이 적용해요. 마스킹 해제와 원본 내려받기는 권한이 있는 사람만 해요. 누가 권한자인지는 아직 정하지 않아서, 이 프로토타입은 검토 의견대로 센터 원장과 실장, 본사 슈퍼관리자만 풀 수 있게 해 두었어요.',
      items: [
        { n: 1, t: '목록 공통', d: '검색 조건과 정렬과 페이지 크기는 메뉴마다 기억해서, 화면을 떠났다 돌아와도 그대로예요. 날짜는 2027-03-01처럼 쓰고, 금액은 천 단위 쉼표를 찍고 원을 생략해요.', ref: 'p.18 ①' },
        { n: 2, t: '개인정보 마스킹', d: '이름 가운데 글자, 연락처 가운데 4자리, 생년월일의 월과 일을 가려요. 해제는 권한 있는 사람이 사유를 남기고 하고, 10분 뒤 다시 가려요(예시). 본사 화면은 기본으로 가려요.', pol: ['POL-42'], ref: 'p.18 ②' },
        { n: 3, t: '다운로드', d: '엑셀을 내려받을 때마다 사유와 항목을 고르고 기록해요. 연락처와 생년월일 같은 개인정보 항목은 처음에 체크가 꺼져 있어서, 꼭 필요한 것만 골라 켜요. 다운로드 기록은 매월 점검해요(HQ-22).', ref: 'p.18 ③' },
        { n: 4, t: '가변 값 표기', d: '정책에서 온 값이 아직 확정되지 않았으면 (안)을 붙이고, 예약된 변경이 있으면 다음 값을 같이 보여 줘요. 법으로 정해진 값은 회색 법정 표시를 붙이고 고칠 수 없게 잠가요.', pol: ['POL-44'], ref: 'p.18 ④' },
        { n: 5, t: '권한 없음', d: '볼 수 없는 메뉴는 숨기는 것이 기본이에요. 주소로 직접 들어오면 이 안내를 보여 줘요. 본사 사람에게는 슈퍼관리자에게 요청하라고 안내해요.', ref: 'p.18 ⑤' },
        { n: 6, t: '이탈 경고', d: '입력하다가 다른 메뉴로 가면 저장할지 물어봐요. 3분마다 임시 저장해요(예시). 메모 칸에 적고 다른 메뉴로 가기를 눌러 보세요.', ref: 'p.18 ⑥' },
        { n: 7, t: '해제는 한 명씩만', kind: 'review', imp: 'IMP-14', d: '목록 위 버튼 한 번으로 모든 원생이 풀리면 위험해요. 해제할 원생을 한 명 고르고 사유를 넣어야 풀려요. 해제한 사람과 사유는 감사 로그에 남아요.' },
        { n: 8, t: '파일 속 개인정보도 가려서 내보내요', kind: 'review', imp: 'IMP-14', cond: true, reveal: 'CM03.dl', revealArg: 'open', d: '개인정보가 가장 많이 새는 곳은 내려받은 파일이에요. 파일 안의 이름과 연락처도 기본으로 가려서 내보내고, 원본은 마스킹 해제 권한이 있는 사람만 받아요.' },
        { n: 9, t: '학부모에게는 숫자만 나가요', kind: 'review', imp: 'IMP-10', d: '(안), 가변, 법정 같은 표시는 관리자 화면에만 붙여요. 알림톡과 영수증처럼 학부모에게 나가는 글에는 숫자만 써요. 아직 (안)이나 미정인 값으로 돈을 받으려 하면 경고하고, 슈퍼관리자가 임시로 쓰도록 승인한 기록이 있어야 써요.' },
        { n: 10, t: '빈 목록, 불러오는 중, 오류, 끊김 상태', kind: 'review', imp: 'IMP-18', d: '목록이 비었을 때, 불러오는 동안, 불러오다 실패했을 때, 인터넷이 끊겼을 때 무엇을 보여 줄지 정해 둬요. 목록 아래 버튼으로 상태를 바꿔 볼 수 있어요.' },
      ],
      open: ['센터에서 마스킹을 풀 수 있는 역할', '다시 가리는 시간 10분, 임시 저장 간격 3분 (예시)', '다운로드 사유 목록에 넣을 보기', '파일 속 개인정보를 가릴지 원본으로 줄지'],
      rules: ['원생 개인정보는 역할과 상관없이 기본으로 가리고, 풀 때마다 사유를 남겨요 (7쪽 권한표)'],
    },
  });

  function dlCard(ctx, rows) {
    const s = ctx.s, ui = ctx.ui, p = ctx.persona;
    const mineDl = s.cm03.downloads.slice(0, 3);
    const recent = mineDl.length ? '<div class="small" style="margin-top:4px"><b>최근 다운로드</b>' + mineDl.map(d => '<div class="muted">' + esc(d.at) + ' ' + esc(d.who) + ', ' + esc(d.items) + (d.raw ? ' (원본)' : ' (가림)') + '</div>').join('') + '</div>' : '';
    if (!ui.dl) {
      return h.card({ title: '엑셀 다운로드', body: '<div class="small muted">목록 위 엑셀 다운로드를 누르면 사유와 항목을 고르는 창이 열려요.</div>' + recent });
    }
    const raw = !!ui.dl_raw;
    const sup = p.side === 'hq' && !!B.state.support;
    return h.card({
      title: '엑셀 다운로드', sub: rows.length + '명 (지금 목록)', right: h.btn('닫기', { sm: true, act: 'CM03.dl', arg: 'close' }),
      body: '<div class="stack" style="gap:10px">' +
        h.field({ label: '사유', req: true, type: 'select', value: ui.dl_reason == null ? '학부모 상담 명단' : ui.dl_reason, options: [{ v: '', l: '사유를 골라요' }, '학부모 상담 명단', '일일 마감', '본사 제출 자료', '기타'], field: 'dl_reason', err: ui.dl_err }) +
        '<div class="field"><label>항목</label><div class="row">' + chk('dl_name', ui.dl_name !== false, '이름') + chk('dl_grade', ui.dl_grade !== false, '학년') + chk('dl_phone', !!ui.dl_phone, '연락처') + chk('dl_birth', !!ui.dl_birth, '생년월일') + '</div></div>' +
        '<div class="field cmk-pp" data-pin="8"><label>파일 속 개인정보</label>' + h.opts(['가려서 내보내기', '원본 (해제 권한자만)'], raw ? '원본 (해제 권한자만)' : '가려서 내보내기', { act: 'CM03.dlRaw' }) + '</div>' +
        '<div class="cmk-note">개인정보 항목은 꼭 필요한 것만 고르세요. 다운로드 내역은 기록되고 매월 점검해요 (HQ-22).</div>' +
        (ui.dl_err2 ? '<div class="cmk-err">' + esc(ui.dl_err2) + '</div>' : sup ? '<div class="cmk-err">지원 모드에서는 내려받을 수 없어요.</div>' : '') +
        '<div class="row" style="justify-content:flex-end">' + h.btn('취소', { act: 'CM03.dl', arg: 'close' }) + h.btn('다운로드', { primary: true, act: 'CM03.download', disabled: !ctx.canEdit || sup, title: sup ? '지원 모드에서는 잠겨 있어요' : '' }) + '</div>' + recent + '</div>',
    });
  }
  function noPermCard(ctx) {
    const p = ctx.persona, side = p.side === 'hq' ? 'hq' : 'ct';
    const hidden = [];
    (B.MENU[side] || []).forEach(g => g.items.forEach(id => { if (B.perm(id, p) === '–') hidden.push(B.screens[id] ? (B.screens[id].menuLabel || B.screens[id].title) : id); }));
    const ask = p.side === 'hq' ? '슈퍼관리자에게 권한을 요청하세요.' : p.role === '원장' ? '본사 1:1 문의로 권한을 요청하세요.' : '원장에게 권한을 요청하세요.';
    return h.card({
      title: '권한 없음', pin: 5,
      body: '<div class="cmk-noperm"><b>이 메뉴를 볼 권한이 없습니다.</b><span>' + esc(ask) + '</span></div>' +
        '<div class="small muted" style="margin-top:8px">메뉴는 숨기는 것이 기본이에요. 주소로 직접 들어오면 이 안내를 보여 줘요.</div>' +
        '<div class="small" style="margin-top:4px">지금 역할(' + esc(p.role) + ')에게 숨겨진 메뉴가 ' + (hidden.length ? esc(hidden.slice(0, 5).join(', ')) + (hidden.length > 5 ? ' 외 ' + (hidden.length - 5) + '개' : '') : '없어요') + '</div>',
    });
  }
  function dirtyCard(ctx) {
    const ui = ctx.ui;
    return h.card({
      title: '저장하지 않은 변경', pin: 6,
      body: h.field({ label: '상담 메모 (예시 입력 칸)', value: ui.draft || '', field: 'draft', ph: '여기에 적고 다른 메뉴로 가기를 눌러 보세요' }) +
        '<div class="row" style="margin-top:8px">' + h.btn('저장', { sm: true, act: 'CM03.saveDraft' }) + h.btn('다른 메뉴로 가기', { sm: true, act: 'CM03.leave' }) +
        '<span class="small muted">' + (ui.savedAt ? '저장 ' + esc(ui.savedAt) : '3분마다 임시 저장해요 (예시)') + '</span></div>' +
        (ui.warn ? '<div class="cmk-warnbox"><b>변경 내용을 저장하지 않았습니다. 나갈까요?</b><div class="row">' + h.btn('머무르기', { sm: true, act: 'CM03.stay' }) + h.btn('나가기', { sm: true, danger: true, act: 'CM03.leaveNow' }) + '</div></div>' : ''),
    });
  }
  function varCard(ctx) {
    return h.card({
      title: '가변 값 표기', pin: 4,
      body: '<dl class="cmk-rows">' +
        '<dt>미확정</dt><dd><b class="cmk-blue">20,000</b>' + h.chip('(안)', 'st-안') + '</dd>' +
        '<dt>예약</dt><dd><span class="pv"><b>20,000</b><span class="next">3/1부터 25,000</span></span></dd>' +
        '<dt>법정</dt><dd>' + h.chip('법정', 'st-법정') + '<input class="inp" value="5년" disabled aria-label="법정 값" style="width:70px;min-height:26px;padding:2px 8px"><span class="small muted">고칠 수 없어요</span></dd>' +
        '</dl>' +
        '<div class="small muted" style="margin:10px 0 4px">이 프로토타입에 들어 있는 정책 값</div>' +
        '<dl class="cmk-rows"><dt>POL-01</dt><dd>' + h.pv('POL-01', ctx.center) + '</dd><dt>POL-16</dt><dd>' + h.pv('POL-16', ctx.center) + '</dd><dt>POL-41</dt><dd>' + h.pv('POL-41', ctx.center) + '</dd></dl>' +
        '<div class="cmk-sub" data-pin="9" style="margin-top:10px"><b class="small">학부모에게 나가는 글</b>' +
        '<dl class="cmk-rows"><dt>관리자</dt><dd><b>20,000</b>' + h.chip('(안)', 'st-안') + '</dd><dt>알림톡</dt><dd>20,000원</dd></dl>' +
        '<p>(안), 가변, 법정 표시는 관리자 화면에만 붙여요. (안) 값으로 돈을 받으려 하면 경고하고, 슈퍼관리자가 임시 사용을 승인해야 받을 수 있어요.</p></div>',
    });
  }

  B.action('CM03.search', (ctx, arg) => {
    const ui = U(ctx.s, 'CM-03');
    if (arg && typeof arg === 'object') Object.assign(ui, arg);
    ui.applied = { st: ui.f_st || '재원', cls: ui.f_cls || '전체', q: ui.q || '', sort: ui.f_sort || '이름순', size: ui.f_size || '20개씩' };
    ui.state = '정상';
  });
  B.action('CM03.state', (ctx, v) => { U(ctx.s, 'CM-03').state = v || '정상'; });
  B.action('CM03.unmaskForm', (ctx, v) => {
    const ui = U(ctx.s, 'CM-03');
    const can = canUnmask(ctx);
    if (v !== 'close' && !can.ok) { say(can.why); return false; }
    ui.umForm = v === 'open' ? true : v === 'close' ? false : !ui.umForm; ui.um_err = null;
  });
  B.action('CM03.unmask', (ctx, arg) => {
    const s = ctx.s, ui = U(s, 'CM-03'), p = B.persona();
    if (arg && typeof arg === 'object') Object.assign(ui, arg);
    const can = canUnmask(ctx);
    if (!can.ok) { say(can.why); return false; }
    const id = ui.um_id || (cm03Rows(s, ui)[0] || s.cm03.rows[0]).id;
    if (!ui.um_reason) { ui.umForm = true; ui.um_err = '사유를 골라 주세요.'; return; }
    const r = s.cm03.rows.find(x => x.id === id);
    audit(s, whoLabel(p), '원생 정보 마스킹 해제', '원생 목록 (예시) ' + h.mask(r.name), ui.um_reason);
    s.cm03.unmask = { id, reason: ui.um_reason, at: s.audit[0].at };
    ui.umForm = false; ui.um_reason = ''; ui.um_err = null;
    say('한 명만 풀었어요. 10분 뒤 다시 가려요 (예시).');
  });
  B.action('CM03.remask', ctx => { ctx.s.cm03.unmask = null; say('다시 가렸어요.'); });
  B.action('CM03.dl', (ctx, v) => { const ui = U(ctx.s, 'CM-03'); ui.dl = v === 'close' ? false : true; ui.dl_err = null; ui.dl_err2 = null; });
  B.action('CM03.dlRaw', (ctx, v) => { U(ctx.s, 'CM-03').dl_raw = /^원본/.test(String(v || '')); });
  B.action('CM03.download', (ctx, arg) => {
    const s = ctx.s, ui = U(s, 'CM-03'), p = B.persona();
    if (arg && typeof arg === 'object') Object.assign(ui, arg);
    ui.dl = true;
    const reason = ui.dl_reason == null ? '학부모 상담 명단' : ui.dl_reason;
    ui.dl_err = reason ? null : '사유를 골라 주세요.';
    ui.dl_err2 = null;
    const items = [['dl_name', '이름', true], ['dl_grade', '학년', true], ['dl_phone', '연락처', false], ['dl_birth', '생년월일', false]].filter(([k, , d]) => (ui[k] == null ? d : !!ui[k])).map(x => x[1]);
    if (p.side === 'hq' && B.state.support) ui.dl_err2 = '지원 모드에서는 내려받을 수 없어요.';
    else if (ui.dl_raw && !canUnmask(ctx).ok) ui.dl_err2 = '원본 파일은 마스킹 해제 권한이 있는 사람만 받을 수 있어요.';
    else if (!items.length) ui.dl_err2 = '내려받을 항목을 하나 이상 골라 주세요.';
    if (ui.dl_err || ui.dl_err2) return;
    const n = cm03Rows(s, ui).length;
    audit(s, whoLabel(p), '엑셀 다운로드', '원생 목록 (예시) ' + n + '명, ' + items.join(', ') + (ui.dl_raw ? ', 원본' : ', 가림'), reason);
    s.cm03.downloads.unshift({ at: s.audit[0].at, who: whoLabel(p), items: items.join(', '), raw: !!ui.dl_raw, reason, n });
    say('원생목록_2027-03-08.xlsx를 만들었어요 (시연). 다운로드 기록이 남았어요.');
  });
  B.action('CM03.saveDraft', ctx => { const ui = U(ctx.s, 'CM-03'); ui.savedDraft = ui.draft || ''; ui.savedAt = tick(ctx.s).slice(6); ui.warn = false; say('저장했어요.'); });
  B.action('CM03.leave', (ctx, arg) => {
    const ui = U(ctx.s, 'CM-03');
    if (typeof arg === 'string') ui.draft = arg;
    if ((ui.draft || '') !== (ui.savedDraft || '')) { ui.warn = true; return; }
    const dest = B.persona().side === 'hq' ? 'HQ-01' : 'CT-01';
    if (B.screens[dest]) { B.go(dest); return false; }
    say('저장할 내용이 없어서 바로 나가요.');
  });
  B.action('CM03.stay', ctx => { U(ctx.s, 'CM-03').warn = false; });
  B.action('CM03.leaveNow', ctx => {
    const ui = U(ctx.s, 'CM-03'); ui.draft = ui.savedDraft || ''; ui.warn = false;
    const dest = B.persona().side === 'hq' ? 'HQ-01' : 'CT-01';
    if (B.screens[dest]) { B.go(dest); return false; }
    say('저장하지 않은 내용을 버리고 나가요.');
  });

  /* =====================================================================
     KS-01 키오스크 입·퇴실 (검토 제안, 원문 범위 밖)
     근거 p.10~11 업무 흐름 ⑤, p.57 CT-12, p.64 CT-19, IMP-05
     ===================================================================== */
  const ksCenter = () => B.state.support || B.persona().center || 'daechi1';
  function ksErr(ui, t, m) { ui.mode = 'err'; ui.errT = t; ui.errM = m; ui.digits = ''; }
  function ksLookup(s, ui, code, time) {
    code = String(code || '');
    ui.time = time || null;
    if (!/^\d{4}$/.test(code)) { ksErr(ui, '번호 4자리를 모두 눌러 주세요', '출결 번호는 4자리예요.'); return; }
    const list = s.students.filter(st => st.center === ksCenter() && String(st.phone || '').replace(/\D/g, '').slice(-4) === code && ['재원', '퇴원 예정', '휴원'].includes(st.status));
    if (!list.length) { ksErr(ui, '등록된 번호가 아니에요', '번호를 다시 확인해 주세요. 계속 안 되면 데스크에 말해 주세요.'); return; }
    if (list.length === 1 && list[0].status === '휴원') { ksErr(ui, '휴원 중이에요', '휴원 기간에는 입실 기록을 남기지 않아요. 데스크에 말해 주세요.'); return; }
    ui.cands = list.map(x => x.id); ui.sel = list.length === 1 ? list[0].id : null; ui.mode = 'confirm';
  }
  function ksSend(s, rec, st, key, at) {
    const status = key === '입실' ? rec.alimIn : rec.alimOut;
    if (status === '꺼짐') return;
    const tpl = s.alim.templates.find(x => x.id === (key === '입실' ? 'T01' : 'T02'));
    s.alim.log.push({ at: md(s) + ' ' + at, center: rec.center, student: st.id, tpl: tpl ? tpl.id : '', name: tpl ? tpl.name : key + ' 알림', to: st.phone, text: fillTpl(tpl ? tpl.text : '', { 학생명: st.name, 시각: at }), status, src: 'KS-01' });
  }
  function ksCheck(s, ui, sid, time) {
    const ks = s.ks01, st = s.students.find(x => x.id === sid);
    if (!st) return;
    const cls = s.classes.find(c => c.id === st.cls);
    const span = cls ? cls.time.split('~') : null;
    const today = s.attendance.filter(a => a.student === sid && a.date === s.today);
    const open = today.find(a => a.in && !a.out);
    const sendState = key => (ks.offline ? '대기' : s.alim.auto[key] ? '발송 완료' : '꺼짐');
    if (!open && today.length) { ksErr(ui, '오늘은 이미 퇴실했어요', '다시 들어왔다면 데스크에 말해 주세요. 선생님이 출결·보강(CT-12)에서 고쳐요.'); return; }
    if (!open) {
      const at = time || (span ? addMin(span[0], -5) : ks.clock);
      const rec = { id: 'att' + (s.attendance.length + 1), center: ksCenter(), date: s.today, student: sid, cls: st.cls || '', in: at, out: '', device: '#1 입구 패드', alimIn: sendState('입실'), alimOut: '', appLogout: '', sync: ks.offline ? '대기' : '전송', src: '키오스크' };
      s.attendance.push(rec);
      ksSend(s, rec, st, '입실', at);
      ks.clock = at; ui.mode = 'in'; ui.last = rec.id;
    } else {
      const at = time || (span ? addMin(span[1], 5) : addMin(open.in, 90));
      open.out = at; open.alimOut = sendState('퇴실'); open.appLogout = ks.offline ? '대기' : '완료';
      if (ks.offline) open.sync = '대기';
      ksSend(s, open, st, '퇴실', at);
      ks.clock = at; ui.mode = 'out'; ui.last = open.id;
    }
    ui.digits = ''; ui.cands = null;
  }
  function ksFlush(s) {
    let n = 0;
    s.attendance.forEach(a => {
      if (a.sync !== '대기') return;
      a.sync = '전송'; n++;
      if (a.alimIn === '대기') a.alimIn = '발송 완료';
      if (a.alimOut === '대기') a.alimOut = '발송 완료';
      if (a.appLogout === '대기') a.appLogout = '완료';
    });
    s.alim.log.forEach(l => { if (l.status === '대기') l.status = '발송 완료'; });
    return n;
  }

  B.screen({
    id: 'KS-01', side: 'ks', phase: 'P1a', devices: ['kiosk'], pages: [], chrome: 'none',
    title: '키오스크 입·퇴실', menuLabel: '키오스크 입·퇴실', crumb: '현장 > 키오스크',
    render(ctx) {
      const s = ctx.s, ui = ctx.ui, ks = s.ks01, c = B.center(ksCenter());
      const mode = ui.mode || 'idle';
      const digits = ui.digits || '';
      const todays = s.attendance.filter(a => a.center === c.id && a.date === s.today);
      const nIn = todays.length, nOut = todays.filter(a => a.out).length;
      const nAlim = todays.filter(a => a.alimIn === '발송 완료').length, nLogout = todays.filter(a => a.appLogout === '완료').length;
      const queued = todays.filter(a => a.sync === '대기').length;
      const stOf = id => s.students.find(x => x.id === id);
      const clsLine = st => { const cl = s.classes.find(x => x.id === st.cls); return cl ? cl.name + ' ' + cl.time + ' · ' + cl.room : '오늘은 정규 수업이 없어요'; };

      let state = '';
      if (mode === 'confirm') {
        const cands = (ui.cands || []).map(stOf).filter(Boolean);
        const st = stOf(ui.sel);
        const open = st && s.attendance.find(a => a.student === st.id && a.date === s.today && a.in && !a.out);
        state = '<div class="cmk-k-state" data-pin="5"><div class="small muted" style="font-size:14px">이름을 한 번 더 확인해요</div>' +
          (st
            ? '<h2>' + esc(h.mask(st.name)) + ' 학생 맞나요?</h2><p>' + esc(clsLine(st)) + '</p><p>' + (open ? open.in + '에 입실했어요. 지금 누르면 퇴실로 기록해요.' : '지금 누르면 입실로 기록해요.') + '</p>' +
              '<div class="cmk-k-btns">' + h.btn(open ? '맞아요, 퇴실' : '맞아요, 입실', { primary: true, act: 'KS01.confirm' }) + h.btn('아니에요', { act: 'KS01.reset' }) + '</div>'
            : '<h2>같은 번호가 ' + cands.length + '명이에요</h2><p>내 이름을 골라 주세요.</p><div class="cmk-k-btns">' + cands.map(x => h.btn(h.mask(x.name) + ' ' + x.grade, { act: 'KS01.pick', arg: x.id })).join('') + h.btn('다시 누르기', { act: 'KS01.reset' }) + '</div>') +
          '</div>';
      } else if ((mode === 'in' || mode === 'out') && s.attendance.some(a => a.id === ui.last)) {
        const rec = s.attendance.find(a => a.id === ui.last), st = stOf(rec.student);
        const alim = mode === 'in' ? rec.alimIn : rec.alimOut;
        const alimText = alim === '발송 완료' ? '보호자에게 ' + (mode === 'in' ? '입실' : '퇴실') + ' 알림톡을 보냈어요' : alim === '대기' ? '연결되면 보호자에게 알림톡을 보내요' : '센터가 ' + (mode === 'in' ? '입실' : '퇴실') + ' 알림톡을 꺼 두었어요';
        state = '<div class="cmk-k-state"><i class="cmk-k-ico' + (mode === 'out' ? ' out' : '') + '">✓</i><h2>' + (mode === 'in' ? '입실했어요' : '퇴실했어요') + '</h2>' +
          '<div class="cmk-k-big">' + esc(h.mask(st.name)) + ' · ' + esc(mode === 'in' ? rec.in : rec.out) + '</div><ul class="cmk-k-list">' +
          (mode === 'out' ? '<li>' + (rec.appLogout === '완료' ? '학습 앱에서 자동으로 로그아웃했어요' : '연결되면 학습 앱을 로그아웃해요') + '</li>' : '<li>오늘 수업 ' + esc(clsLine(st)) + '</li>') +
          '<li>' + esc(alimText) + '</li></ul><div class="cmk-k-btns">' + h.btn('처음으로', { act: 'KS01.reset' }) + '</div></div>';
      } else if (mode === 'err') {
        state = '<div class="cmk-k-state"><i class="cmk-k-ico bad">!</i><h2>' + esc(ui.errT) + '</h2><p>' + esc(ui.errM) + '</p><div class="cmk-k-btns">' + h.btn('다시 누르기', { act: 'KS01.reset' }) + '</div></div>';
      } else if (mode === 'pin') {
        state = '<div class="cmk-k-state"><h2>관리자 PIN</h2><p>설정은 관리자 PIN을 넣어야 열려요. 학생 화면과 관리자 화면은 따로 돌아가요.</p>' + (ui.pinErr ? '<div class="cmk-err" style="font-size:14px">' + esc(ui.pinErr) + '</div>' : '') + '<div class="cmk-k-btns">' + h.btn('닫기', { act: 'KS01.reset' }) + '</div></div>';
      } else if (mode === 'admin') {
        state = '<div class="cmk-k-state"><h2>관리자 메뉴</h2><p>이 패드는 ' + esc(c.name) + '에 등록된 #1 입구 패드예요.</p><div class="cmk-k-btns">' +
          h.btn('출결 화면 열기 (CT-12)', { go: 'CT-12' }) + h.btn('기기 설정 (CT-19)', { go: 'CT-19' }) + h.btn(ks.offline ? '연결 되살리기' : '연결 끊김 시험', { act: 'KS01.offline' }) + h.btn('닫기', { act: 'KS01.reset' }) + '</div></div>';
      } else {
        state = '<div class="cmk-k-state"><h2>어서 와요</h2><p>출결 번호 4자리를 누르고 확인을 눌러요.</p><p class="small" style="font-size:13px">출결 번호는 보호자 휴대폰 뒤 4자리예요 (예시).</p></div>';
      }

      const pinMode = mode === 'pin';
      const boxes = [0, 1, 2, 3].map(i => '<i class="' + (i === digits.length ? 'on' : '') + '">' + (digits[i] ? (pinMode ? '•' : esc(digits[i])) : '') + '</i>').join('');
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '지움', '0', '확인'];
      const pad = keys.map(k => '<button type="button" class="' + (k === '확인' ? 'ok' : k === '지움' ? 'fn' : '') + '" data-act="KS01.key" data-arg="' + k + '">' + k + '</button>').join('');

      return '<div class="cmk-kiosk">' +
        '<header class="cmk-k-head"><div class="cmk-k-logo"><i>180</i>브레인180 ' + esc(c.name) + ' 입·퇴실</div>' +
        '<div class="cmk-k-clock"><b>' + esc(ks.clock) + '</b><span>' + esc(s.todayLabel) + '</span></div>' +
        '<div class="cmk-k-dev" data-pin="4">#1 입구 패드 ' + h.chip('등록된 기기', 'ok') + '</div></header>' +
        '<div class="cmk-k-main"><section class="cmk-k-panel">' + state +
        '<div class="cmk-k-sum"><div data-pin="2"><b>' + nIn + '</b><span>오늘 입실</span><em>입실 알림톡 ' + nAlim + '건</em></div><div data-pin="3"><b>' + nOut + '</b><span>오늘 퇴실</span><em>학습 앱 로그아웃 ' + nLogout + '건</em></div></div>' +
        '<div class="small muted">기록은 출결·보강(CT-12)에 바로 쌓여요. 다른 학생 이름은 이 화면에 보이지 않아요.</div></section>' +
        '<section class="cmk-k-panel" data-pin="1"><div class="cmk-k-label">' + (pinMode ? '관리자 PIN' : '출결 번호') + '</div><div class="cmk-k-digits">' + boxes + '</div><div class="cmk-k-pad">' + pad + '</div></section></div>' +
        '<footer class="cmk-k-foot"><span class="cmk-k-net' + (ks.offline ? ' off' : '') + ' cmk-pp" data-pin="6">' + (ks.offline ? '연결 끊김 · 이 패드에 ' + queued + '건 저장 중' : '연결 정상') + '</span>' +
        '<span>체크 방식 번호 입력 (POL-39 예시)</span><button type="button" class="cmk-k-admin" data-act="KS01.admin" data-pin="7">관리자</button></footer></div>';
    },
    prd: {
      summary: '학생이 센터 입구 패드에서 번호를 눌러 들어오고 나가는 화면이에요. 원문에는 없는 검토 제안 화면이고, 업무 흐름(11쪽)과 출결·보강(CT-12), 센터 정보 화면(CT-19)의 키오스크 기기 칸을 바탕으로 그렸어요.',
      who: '학생이 직접 눌러요. 관리자 로그인과 따로 돌아가고, 설정은 관리자 PIN을 아는 직원만 열어요. 기록은 원장, 실장·데스크, 교사, 보조교사가 출결·보강(CT-12)에서 봐요.',
      items: [
        { n: 1, t: '번호 입력', d: '학생이 출결 번호 4자리를 누르고 확인을 눌러요. 이 프로토타입은 보호자 휴대폰 뒤 4자리를 번호로 썼어요(예시). 체크 방식은 번호 입력이 예시이고, QR이나 개인 로그인도 보기에 있어요.', pol: ['POL-39'], ref: 'p.11 ⑤ ①' },
        { n: 2, t: '입실 기록과 입실 알림톡', d: '처음 누르면 입실로 기록하고, 보호자에게 입실 알림톡을 자동으로 보내요. 센터가 자동 발송을 꺼 두면 보내지 않아요. 기록은 바로 출결·보강(CT-12)에 쌓여요.', pol: ['POL-35'], ref: 'p.11 ⑤ ②' },
        { n: 3, t: '퇴실 체크와 학습 앱 자동 로그아웃', d: '한 번 더 누르면 퇴실로 기록하고 퇴실 알림톡을 보내요. 공용 패드에서 학생이 로그아웃하지 않고 나가는 일이 있어서, 퇴실 체크 때 학습 앱을 자동으로 로그아웃해요(10/14 회의).', pol: ['POL-35'], ref: 'p.11 ⑤ ④, p.57 ①' },
        { n: 4, t: '등록된 기기에서만', d: '센터가 등록한 패드에서만 입실과 퇴실 체크를 받아요. 기기 등록과 해제는 센터 정보 화면(CT-19)의 키오스크 기기 칸에서 해요. 패드를 어떻게 공급할지는 아직 정하지 않았어요.', pol: ['POL-38'], ref: 'p.57 ⑤, p.64 ④' },
        { n: 5, t: '이름을 한 번 더 확인해요', kind: 'review', imp: 'IMP-05', cond: true, reveal: 'KS01.number', revealArg: '5521', d: '번호를 잘못 누르면 남의 출결이 찍혀요. 가린 이름을 보여 주고 맞는지 한 번 더 물어요. 같은 번호가 둘이면 이름을 고르게 하고, 같은 날 이미 퇴실했으면 다시 찍지 않고 데스크로 안내해요.' },
        { n: 6, t: '인터넷이 끊겨도 기록해요', kind: 'review', imp: 'IMP-05', d: '연결이 끊기면 체크 기록을 패드에 저장해 두고, 다시 연결되면 기록과 알림톡과 로그아웃을 한꺼번에 보내요. 관리자 메뉴에서 연결 끊김을 시험해 볼 수 있어요.' },
        { n: 7, t: '관리자 화면과 따로 돌아가요', kind: 'review', imp: 'IMP-05', d: '키오스크는 관리자 로그인과 따로 돌아가요. 설정을 열려면 관리자 PIN을 넣어야 하고, 기기는 1회용 코드로 등록하는 안이에요. 이 화면을 어느 팀이 만들지는 아직 정하지 않았어요.' },
      ],
      open: ['입·퇴실 체크 방식과 출결 번호를 무엇으로 할지 (POL-39 예시)', '패드 기종과 공급 방식 (POL-38 미정)', '키오스크 화면을 맡을 팀 (관리자 페이지 팀이 새 화면 ID로 맡는 안)', '결석과 미퇴실을 판정하는 기준 시각'],
      rules: ['입실과 퇴실 알림톡은 정보성 메시지예요. 광고를 섞지 않아요 (POL-35)'],
    },
  });

  B.action('KS01.key', (ctx, k) => {
    const s = ctx.s, ui = U(s, 'KS-01');
    if (['in', 'out', 'err'].includes(ui.mode)) { ui.mode = 'idle'; ui.digits = ''; }
    if (ui.mode === 'confirm' || ui.mode === 'admin') return false;
    const d = ui.digits || '';
    if (k === '지움') { ui.digits = d.slice(0, -1); return; }
    if (k === '확인') {
      if (ui.mode === 'pin') {
        if (d.length !== 4) { ui.pinErr = 'PIN을 끝까지 눌러 주세요.'; return; }
        ui.pinErr = null; ui.mode = 'admin'; ui.digits = ''; return;
      }
      ksLookup(s, ui, d); return;
    }
    if (/^\d$/.test(k) && d.length < 4) ui.digits = d + k;
  });
  B.action('KS01.number', (ctx, arg) => {
    const s = ctx.s, ui = U(s, 'KS-01');
    const code = arg && typeof arg === 'object' ? arg.code : arg;
    ui.digits = String(code || '');
    ksLookup(s, ui, code, arg && typeof arg === 'object' ? arg.time : null);
  });
  B.action('KS01.pick', (ctx, id) => { U(ctx.s, 'KS-01').sel = id; });
  B.action('KS01.confirm', (ctx, arg) => {
    const s = ctx.s, ui = U(s, 'KS-01');
    if (ui.mode !== 'confirm' || !ui.sel) return;
    ksCheck(s, ui, ui.sel, (arg && arg.time) || ui.time);
  });
  B.action('KS01.check', (ctx, arg) => {
    const s = ctx.s, ui = U(s, 'KS-01');
    const code = arg && typeof arg === 'object' ? arg.code : arg, time = arg && typeof arg === 'object' ? arg.time : null;
    ui.digits = String(code || '');
    ksLookup(s, ui, code, time);
    if (ui.mode === 'confirm') {
      if (!ui.sel && arg && arg.student) ui.sel = arg.student;
      if (ui.sel) ksCheck(s, ui, ui.sel, time);
    }
  });
  B.action('KS01.reset', ctx => { Object.assign(U(ctx.s, 'KS-01'), { mode: 'idle', digits: '', cands: null, sel: null, errT: null, errM: null, pinErr: null, time: null }); });
  B.action('KS01.admin', ctx => { Object.assign(U(ctx.s, 'KS-01'), { mode: 'pin', digits: '', pinErr: null }); });
  B.action('KS01.offline', (ctx, v) => {
    const s = ctx.s, ks = s.ks01;
    const next = v == null || v === '' ? !ks.offline : (v === true || v === 'true' || v === '끊김');
    if (ks.offline && !next) {
      ks.offline = false;
      const n = ksFlush(s);
      say(n ? '다시 연결됐어요. 저장해 둔 기록 ' + n + '건과 알림톡을 보냈어요.' : '다시 연결됐어요.');
    } else if (next) { ks.offline = true; say('연결 끊김을 시험해요. 체크 기록은 이 패드에 저장돼요.'); }
  });

  /* =====================================================================
     PA-01 학부모 휴대폰 (검토 제안, 원문 범위 밖, IMP-05·IMP-07)
     ===================================================================== */
  function paStudent(ctx) {
    const s = ctx.s, ui = U(s, 'PA-01');
    const reg = s.ui['CT-05'];
    if (ui.student === 'reg' && reg && reg.name) {
      const cs = reg.consent && reg.consent.status === '인증 완료' ? { date: String(reg.consent.at || s.today).slice(0, 10), method: reg.consent.method, version: reg.consent.version } : null;
      return { id: 'reg', pseudo: true, center: ksCenter(), name: reg.name, grade: reg.grade || '초4', guardian: reg.guardian || '보호자', phone: reg.phone || '', level: reg.level || '', status: '상담', product: 'pr1', paid: '-', account: '-', cls: '', consent: cs };
    }
    return s.students.find(x => x.id === ui.student) || s.students.find(x => x.id === 's5') || s.students[0];
  }
  const c07flow = (s, st) => (s.ct07 && s.ct07.flow && st ? s.ct07.flow[st.id] : null) || null;
  function billFor(s, ui, st) {
    if (ui.bill && (!ui.bill.student || ui.bill.student === st.id)) return ui.bill;
    // CT-07에서 결제 링크를 보냈거나 수납을 마친 원생은 그때 계산한 줄과 금액을 그대로 보여 줘요
    const f = c07flow(s, st);
    if (f && (f.stage === '결제 대기' || f.stage === '수납 완료') && f.lines && f.lines.length) {
      const fp = s.products.find(p => p.id === (f.pid || st.product)) || {};
      const fm = ((/(\d+)월/.exec(String(f.lines[0][0])) || [])[1] || String(Number(s.today.slice(5, 7)))) + '월';
      return { student: st.id, month: fm, lines: f.lines.map(l => ({ t: l[0], a: l[1] })), total: f.total, product: fp.name || '' };
    }
    const pr = s.products.find(p => p.id === (st.product || 'pr1')) || s.products[0];
    const c = B.center(st.center) || {};
    const fee = B.feeNow(s, c.id, pr.id);
    const lines = [{ t: '3월 교습비 (' + pr.name + ')', a: fee }, { t: s.extraFees[0].name, a: s.extraFees[0].amount }];
    return { student: st.id, month: '3월', lines, total: lines.reduce((x, l) => x + l.a, 0), product: pr.name };
  }
  // 교습 기간은 CT-07에서 정한 수강 시작일을 따라가요. CT-07 거래가 있으면 그 기간을, 수강 시작일만 있으면 그날부터 그달 말일까지,
  // 둘 다 없으면 청구한 달 1일부터 말일까지 보여 줘요.
  const okDay = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
  function paPeriod(s, st, bill) {
    const f = c07flow(s, st), c7 = s.ui['CT-07'] || {};
    let from = f && f.stage !== '작성 중' && f.period ? String(f.period).split(' ~ ')[0] : '';
    if (!okDay(from) && c7.student === st.id && okDay(c7.start)) {
      from = c7.start;
      if (c7.mmethod === '다음 달부터' && from.slice(8) !== '01') { const y = +from.slice(0, 4), m = +from.slice(5, 7); from = (m === 12 ? (y + 1) + '-01' : y + '-' + pad2(m + 1)) + '-01'; }
    }
    if (!okDay(from)) { const m = /(\d+)월/.exec((bill && bill.month) || ''); from = s.today.slice(0, 4) + '-' + (m ? pad2(m[1]) : s.today.slice(5, 7)) + '-01'; }
    const y = +from.slice(0, 4), m = +from.slice(5, 7);
    return from + ' ~ ' + from.slice(0, 8) + pad2(new Date(Date.UTC(y, m, 0)).getUTCDate());
  }
  const full = at => (at.length <= 11 ? '2027-' + at : at);
  function paMsgs(s, ui, st) {
    let list = (s.pa01.seed || []).filter(m => m.student === st.id).map(m => Object.assign({}, m));
    (s.alim.log || []).filter(l => l.student === st.id && l.status === '발송 완료').forEach(l => list.push({ at: full(l.at), tpl: l.tpl, name: l.name, text: l.text }));
    (s.pa01.extra || []).filter(m => m.student === st.id).forEach(m => list.push(m));
    if (st.pseudo && st.level && !list.some(m => m.tpl === 'T06')) list.push({ at: s.today + ' 12:05', tpl: 'T06', name: '결과지 링크', text: '입학 테스트 결과지를 확인해 주세요.' });
    if (ui.bill && ui.bill.student === st.id && !list.some(m => m.tpl === 'T03')) list.push({ at: full(ui.bill.at || md(s) + ' 12:10'), tpl: 'T03', name: '수강료 안내', text: ui.bill.month + ' 수강료 ' + h.num(ui.bill.total) + '원 안내입니다.' });
    return list.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  }
  const PA_NAV = [['chat', '알림톡'], ['pay', '결제'], ['consent', '인증·동의'], ['result', '결과지']];

  B.screen({
    id: 'PA-01', side: 'pa', phase: 'P1a', devices: ['mobile'], pages: [], chrome: 'none',
    title: '학부모 휴대폰', menuLabel: '학부모 휴대폰', crumb: '현장 > 학부모 휴대폰',
    tabs: [{ id: 'chat', label: '알림톡 대화방' }, { id: 'pay', label: '결제 링크' }, { id: 'consent', label: '본인인증·동의' }, { id: 'result', label: '결과지 링크' }],
    render(ctx) {
      const s = ctx.s, st = paStudent(ctx), c = B.center(st.center) || ctx.center, tab = ctx.tab || 'chat';
      const head = {
        chat: '<div class="cmk-ph-title" data-pin="1"><span class="cmk-av">180</span><div><b>브레인180 ' + esc(c.name) + '</b><small>알림톡 채널 · 보호자 ' + esc(st.guardian) + '</small></div></div>',
        pay: '<div class="cmk-ph-title"><span class="cmk-av navy">결제</span><div><b>결제 링크</b><small>결제선생 연동 (시연 화면)</small></div></div>',
        consent: '<div class="cmk-ph-title"><span class="cmk-av navy">인증</span><div><b>보호자 본인인증</b><small>법정대리인 동의 (만 14세 미만)</small></div></div>',
        result: '<div class="cmk-ph-title"><span class="cmk-av">180</span><div><b>입학 테스트 결과지</b><small>알림톡 링크로 연 화면</small></div></div>',
      }[tab];
      const body = tab === 'chat' ? paChat(ctx, st, c) : tab === 'pay' ? paPay(ctx, st, c) : tab === 'consent' ? paConsent(ctx, st, c) : paResult(ctx, st, c);
      return '<div class="cmk-phone"><div class="cmk-ph-status"><b>' + esc(s.ks01.clock) + '</b><span class="cmk-ph-ind" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div>' +
        '<div class="cmk-ph-head">' + head + '</div><div class="cmk-ph-body' + (tab === 'chat' ? ' chat' : '') + '">' + body + '</div>' +
        '<div class="tabs cmk-pa-nav" role="tablist">' + PA_NAV.map(([id, l]) => '<button type="button" data-tab="' + id + '" class="' + (id === tab ? 'on' : '') + '">' + esc(l) + '</button>').join('') + '</div></div>';
    },
    mount(root, ctx) {
      if ((ctx.tab || 'chat') !== 'chat') return;
      const b = root.querySelector('.cmk-ph-body.chat');
      if (b && !(B.state.focusPins || []).includes(2)) b.scrollTop = b.scrollHeight;
    },
    prd: {
      summary: '학부모가 자기 휴대폰으로 받는 알림톡, 결제 링크, 보호자 본인인증, 결과지 링크를 한곳에 모았어요. 원문 범위 밖의 검토 제안 화면이에요. 관리자 화면에서 한 일이 학부모에게 어떻게 보이는지 확인할 때 써요.',
      who: '학부모(법정대리인)가 자기 휴대폰에서 봐요. 센터 직원은 이 화면을 쓰지 않고, 결과를 관리자 화면(CT-05, CT-07, CT-12, CT-14)에서 확인해요.',
      items: [
        { n: 1, tab: 'chat', t: '알림톡 대화방', d: '센터 알림톡 채널에서 오는 메시지가 한 대화방에 쌓여요. 입실, 퇴실, 수강료 안내, 미납 안내, 재등록 안내, 결과지 링크 같은 정보성 메시지만 와요. 키오스크(KS-01)에서 체크하면 여기에 바로 새 메시지가 생겨요.', pol: ['POL-35'], imp: 'IMP-05', ref: 'p.11 ⑤ ②⑤' },
        { n: 2, tab: 'chat', t: '수강료 안내와 결제 버튼', d: '재등록 기간(20일부터 말일까지, 안)에 수강료 안내가 결제 버튼과 함께 와요. 직영은 결제선생 링크로 받아요. 버튼을 누르면 결제 링크 탭으로 가요.', pol: ['POL-24', 'POL-36'], ref: 'p.10 ③ ③' },
        { n: 3, tab: 'pay', t: '결제 링크 페이지', d: '받는 곳과 금액과 항목을 보여 줘요. 직영 센터는 본사(MSC Brain) 계좌로 받아요. 카드나 계좌이체를 골라 결제해요.', pol: ['POL-36', 'POL-37'], imp: 'IMP-05', ref: 'p.52 ④' },
        { n: 4, tab: 'pay', t: '결제하면 수납 기록과 학습 계정이 이어져요', d: '결제가 끝나면 센터의 수강 등록·수납(CT-07)에 자동으로 기록되고, 학습 계정이 열려요. 수납 확인 즉시 열지, 원장 승인 뒤 열지, 며칠 먼저 열어 줄지는 아직 정하지 않았어요(POL-23 미정). 영수증에는 학습자 이름, 과목, 교습 기간, 금액을 적어요.', pol: ['POL-23'], ref: 'p.10 ② ⑦⑧, p.52 ⑤' },
        { n: 5, tab: 'consent', t: '보호자 본인인증과 동의', d: '초등학생은 모두 만 14세 미만이라 법정대리인 동의가 필요해요. 보호자가 휴대폰 본인인증을 하고 필수 항목에 동의하면, 방법과 일시와 문안 버전이 원생 등록(CT-05)에 저장돼요. P1a에는 센터 태블릿에서 보호자가 이 화면을 직접 쓰고, 집에서 여는 원격 링크는 다음 단계로 미루는 안이에요.', pol: ['POL-43'], imp: 'IMP-05', ref: 'p.49 ②③' },
        { n: 6, tab: 'consent', t: '처리자를 바르게 알려요', kind: 'review', imp: 'IMP-04', d: '직영 센터는 본사가 직접 운영해서 개인정보 처리자도 MSC Brain이에요. 원문 예시는 센터를 처리자로 적어서 직영에서는 틀린 고지가 돼요. 센터 유형과 결제 방식에 따라 처리자와 수탁자 문구가 저절로 바뀌어요.' },
        { n: 7, tab: 'result', t: '결과지 링크', d: '입학 테스트 결과지는 바로 출력하는 것이 기본이고, 센터가 켜면 알림톡 링크로도 보내요(안). 두뇌 유형은 지수 없이 유형만, 읽기는 레벨만 보여 주고 설명은 상담에서 해요.', pol: ['POL-30'], imp: 'IMP-05', ref: 'p.47 ③⑤' },
        { n: 8, tab: 'consent', t: '광고 수신은 따로, 보관 기간은 미리 알려요', kind: 'review', imp: 'IMP-07', d: '광고 수신은 선택 동의로 받고, 받는 경로와 밤 9시부터 아침 8시 사이(법정 야간 시간) 수신을 따로 물어요. 동의한 날과 철회한 날을 저장해요. 그만둔 뒤 정보를 얼마나 보관할지(POL-40)는 아직 정하지 않아서, 정해지면 이 화면에 적어요.', pol: ['POL-40'] },
        { n: 9, tab: 'result', t: '결과지 링크는 보호자 확인 뒤에 열려요', kind: 'review', imp: 'IMP-05', ref: 'p.47 검토 의견', d: '결과지에는 아이의 두뇌 유형과 읽기 레벨이 들어 있어서 링크만 알면 아무나 보면 안 돼요. 보호자 휴대폰 뒤 4자리를 넣어야 열리고, 7일(예시)이 지나면 링크를 닫아요. 이 링크 페이지를 누가 만들지는 아직 정하지 않았어요.' },
        { n: 10, tab: 'pay', t: '학부모에게는 숫자만 보여요', kind: 'review', imp: 'IMP-10', d: '관리자 화면의 (안), 가변, 법정 같은 표시는 학부모 화면과 영수증에 나오지 않고 숫자만 보여요. 아직 (안)인 금액으로 청구하려 하면 관리자 화면에서 먼저 경고해요.' },
      ],
      open: ['원격 동의 링크를 언제 열지 (P1a는 센터 태블릿 안)', '결과지를 알림톡 링크로도 보낼지 (POL-30 안)', '퇴원 뒤 개인정보 보관 기간 (POL-40 미정)', '알림톡 발신 프로필을 센터 이름으로 할지, 본사 채널 하나로 할지'],
      rules: ['만 14세 미만 아동의 개인정보는 법정대리인 동의를 받아요 (법정)', '알림톡에는 광고를 넣지 않아요. 광고는 수신 동의한 사람에게만 따로 보내요', '거래 증빙은 5년 보관해요 (POL-41 법정)'],
    },
  });

  function paChat(ctx, st, c) {
    const s = ctx.s, ui = ctx.ui;
    const list = paMsgs(s, ui, st);
    if (!list.length) return '<div class="cmk-day">아직 받은 메시지가 없어요</div>';
    const lastBill = list.map(m => m.tpl).lastIndexOf('T03');
    let day = '', html = '';
    list.forEach((m, i) => {
      const d = m.at.slice(0, 10);
      if (d !== day) { day = d; html += '<div class="cmk-day">' + esc(dayLabel(d)) + '</div>'; }
      const btn = (m.tpl === 'T03' || m.tpl === 'T04') ? '<button type="button" class="cmk-bb" data-act="PA01.tab" data-arg="pay">결제하기</button>'
        : m.tpl === 'T06' ? '<button type="button" class="cmk-bb" data-act="PA01.tab" data-arg="result">결과지 보기</button>' : '';
      html += '<div class="cmk-msg' + (m.kind === 'pay' ? ' sys' : '') + '"><span class="cmk-av">' + (m.kind === 'pay' ? '결제' : '180') + '</span><div class="cmk-bw"' + (i === lastBill ? ' data-pin="2"' : '') + '><div class="cmk-from">' + (m.kind === 'pay' ? '결제선생' : '브레인180 ' + esc(c.name)) + '</div>' +
        '<div class="cmk-bub"><div class="cmk-bh">' + esc(m.kind === 'pay' ? '결제 완료' : m.name) + '</div><div class="cmk-bt">' + esc(m.text) + '</div>' + btn + '</div>' +
        '<div class="cmk-time">' + esc(m.at.slice(11)) + '</div></div></div>';
    });
    return html;
  }
  function paPay(ctx, st, c) {
    const s = ctx.s, ui = ctx.ui;
    const bill = billFor(s, ui, st);
    const direct = c.type === '직영';
    const paid = ui.receipt && ui.paidFor === st.id;
    const already = !paid && st.paid === '수납 완료';
    const method = ui.method || '카드';
    // CT-07에서 결제 링크를 보낸 원생은 상품이 아직 비어 있어도 결제할 수 있어요
    const pend = c07flow(s, st), linked = !!(pend && pend.stage === '결제 대기');
    const notReady = !linked && (st.pseudo || st.status === '상담' || !st.product);
    let html = '<section class="cmk-psec" data-pin="3"><div class="small muted">' + (notReady ? '등록하면 받게 될 결제 요청 (미리 보기)' : esc(bill.month) + ' 수강료 결제 요청') + '</div>' +
      '<div><b>브레인180 ' + esc(c.name) + '</b><div class="small muted">받는 곳 ' + (direct ? 'MSC Brain (본사 직영)' : esc(c.name) + ' 사업자') + '</div></div>' +
      '<div class="cmk-amt">' + h.money(bill.total) + '</div><div class="cmk-lines">' +
      bill.lines.map(l => '<div><span>' + esc(l.t) + '</span><span>' + h.money(l.a) + '</span></div>').join('') +
      '<div class="tot"><span>결제 금액</span><span>' + h.money(bill.total) + '</span></div></div>' +
      h.kv([['학생', st.name + ' (' + st.grade + ')'], ['교습 기간', paPeriod(s, st, bill)]]) +
      '<div class="cmk-note cmk-pp" data-pin="10">학부모 화면에는 (안) 같은 표시를 붙이지 않고 숫자만 보여 줘요.</div></section>';
    if (notReady) {
      html += '<section class="cmk-psec" data-pin="4"><h3>아직 결제할 수 없어요</h3><p>원생 등록(CT-05)과 수강 등록(CT-07)을 마치면 센터가 결제 링크를 보내요.</p></section>';
    } else if (paid || already) {
      const r = ui.receipt || {};
      const p = s.payments.slice().reverse().find(x => x.student === st.id) || {};
      html += '<section class="cmk-psec" data-pin="4"><div class="row between"><h3>결제 완료</h3>' + h.chip('수납 완료', 'ok') + '</div>' +
        h.kv([['승인번호', r.approval || p.approval || '-'], ['결제 수단', r.method || p.method || '-'], ['학습자', st.name], ['과목', '브레인180 (' + (bill.product || '교습') + ')'], ['교습 기간', paPeriod(s, st, bill)], ['금액', h.money(r.total || p.amount || bill.total)]]) +
        '<p>' + (paid && r.opened ? '학습 계정이 열렸어요. 오늘부터 학습 앱에 로그인할 수 있어요.' : '학습 계정은 계속 쓸 수 있어요.') + ' 센터 수납 기록(CT-07)에 자동으로 남았어요.</p>' +
        '<div class="row">' + h.btn('센터 화면에서 보기 (CT-07)', { sm: true, go: 'CT-07' }) + '</div></section>';
    } else {
      html += '<section class="cmk-psec" data-pin="4"><h3>결제 수단</h3>' + h.opts(['카드', '계좌이체'], method, { act: 'PA01.method' }) +
        '<div class="cmk-full">' + h.btn(h.money(bill.total) + ' 결제하기', { primary: true, act: 'PA01.pay' }) + '</div>' +
        '<p>결제하면 센터 수납 기록(CT-07)에 바로 남아요. ' + (st.account === '활성' ? '학습 계정은 계속 열려 있어요.' : st.account === '가오픈' ? '지금은 가오픈 상태이고, 결제하면 정식으로 열려요.' : '결제하면 학습 계정이 열려요.') + '</p></section>';
    }
    return html;
  }
  function paConsent(ctx, st, c) {
    const s = ctx.s, ui = ctx.ui;
    const done = !!st.consent && !ui.redo;
    const direct = c.type === '직영', usesPay = c.pay === '결제선생';
    const mk = done ? ((st.consent && st.consent.marketing) || {}) : { alim: ui.c_mk_alim, sms: ui.c_mk_sms, night: ui.c_mk_night };
    let html = '<section class="cmk-psec" data-pin="5"><div class="row between"><h3>보호자 본인인증</h3>' + (done ? h.chip('동의 완료', 'ok') : h.chip('동의 전', 'warn')) + '</div>' +
      '<p>' + esc(st.name) + ' 학생(' + esc(st.grade) + ')은 만 14세 미만이라 보호자(법정대리인) 동의가 있어야 등록할 수 있어요.</p>';
    if (done) {
      html += h.kv([['동의한 날', st.consent.date], ['확인 방법', st.consent.method], ['문안 버전', st.consent.version]]) +
        '<button type="button" class="cmk-link" data-act="PA01.redo">처음부터 다시 해 보기 (시연)</button>';
    } else {
      html += h.field({ label: '보호자 이름', value: ui.c_name == null ? st.guardian : ui.c_name, field: 'c_name' }) +
        '<div class="grid g2">' + h.field({ label: '통신사', type: 'select', value: ui.c_tel || 'SKT', options: ['SKT', 'KT', 'LG U+', '알뜰폰'], field: 'c_tel' }) +
        h.field({ label: '휴대폰', value: ui.c_phone == null ? st.phone : ui.c_phone, field: 'c_phone' }) + '</div>' +
        '<div class="row">' + h.btn(ui.codeSent ? '다시 받기' : '인증번호 받기', { sm: true, act: 'PA01.sendCode' }) +
        (ui.codeSent ? '<input class="inp mono" style="width:130px" maxlength="6" inputmode="numeric" aria-label="인증번호 6자리" data-field="c_code" value="' + esc(ui.c_code || '') + '" placeholder="6자리">' : '') + '</div>' +
        '<div class="small muted">P1a에는 센터 태블릿에서 보호자가 이 화면을 직접 써요. 집에서 여는 원격 링크는 다음 단계예요.</div>';
    }
    html += '</section>';
    const trustee = direct ? '결제선생 (결제), 알림톡 발송사 (발송)' : 'MSC Brain (시스템 운영)' + (usesPay ? ', 결제선생 (결제)' : '') + ', 알림톡 발송사 (발송, 재위탁)';
    html += '<section class="cmk-psec" data-pin="6"><div class="row between"><h3>개인정보 처리 고지</h3>' + h.chip('검토 반영', 'review') + '</div>' +
      h.kv([['처리자', direct ? 'MSC Brain (본사 직영)' : c.name + ' 사업자'], ['수탁자', trustee]]) +
      '<p>' + (direct ? '직영 센터는 본사가 직접 운영해서 처리자가 MSC Brain이에요.' : '가맹 센터는 센터 사업자가 처리자이고, 본사는 맡아서 관리해요.') + '</p></section>';
    html += '<section class="cmk-psec"><h3>동의 항목</h3>' +
      chk('c_req1', done || !!ui.c_req1, '(필수) 개인정보 수집·이용', { disabled: done }) +
      chk('c_req2', done || !!ui.c_req2, '(필수) 처리 위탁 고지 확인', { disabled: done }) +
      '<div class="cmk-sub" data-pin="8"><b class="small">(선택) 광고성 정보 수신</b>' +
      chk('c_mk_alim', !!mk.alim, '알림톡으로 받기', { disabled: done }) + chk('c_mk_sms', !!mk.sms, '문자로 받기', { disabled: done }) +
      chk('c_mk_night', !!mk.night, '밤 9시부터 아침 8시 사이에도 받기', { disabled: done }) +
      '<p>동의한 날과 철회한 날을 저장하고, 언제든 끌 수 있어요. 그만둔 뒤 정보를 보관하는 기간은 아직 정하지 않았어요 (POL-40 미정).</p></div>' +
      h.kv([['문안 버전', 'v1 (2027-01-01, 예시)']]) +
      (ui.c_err ? '<div class="cmk-err">' + esc(ui.c_err) + '</div>' : '') +
      (done ? '' : '<div class="cmk-full">' + h.btn('동의하고 제출', { primary: true, act: 'PA01.consent' }) + '</div>') + '</section>';
    return html;
  }
  function paResult(ctx, st, c) {
    const s = ctx.s, ui = ctx.ui;
    const ok = ui.rOk === st.id;
    const lv = st.level || (s.ui['CT-05'] || {}).level || '-';
    const r = s.reservations.find(x => x.student === st.name && x.result !== '-');
    const gate = ok
      ? '<section class="cmk-psec" data-pin="9"><div class="row between"><h3>보호자 확인 완료</h3>' + h.chip('검토 반영', 'review') + '</div><p>이 링크는 정해진 기간이 지나면 닫혀요. 다시 보려면 센터에 요청해요.</p></section>'
      : '<section class="cmk-psec" data-pin="9"><div class="row between"><h3>보호자 확인</h3>' + h.chip('검토 반영', 'review') + '</div><p>결과지에는 아이 정보가 있어서 보호자 확인 뒤에 열려요. 보호자 휴대폰 뒤 4자리를 넣어 주세요.</p>' +
        '<div class="row"><input class="inp mono" style="width:110px" maxlength="4" inputmode="numeric" aria-label="휴대폰 뒤 4자리" data-field="r4" value="' + esc(ui.r4 || '') + '" placeholder="4자리">' + h.btn('확인', { sm: true, primary: true, act: 'PA01.openResult' }) + '</div>' +
        (ui.rErr ? '<div class="cmk-err">' + esc(ui.rErr) + '</div>' : '') + '<div class="small muted">시연 번호 ' + esc(String(st.phone || '').slice(-4)) + '</div></section>';
    const sheet = '<section class="cmk-psec" data-pin="7"><h3>브레인180 입학 테스트 결과지</h3><div class="' + (ok ? '' : 'cmk-blur') + '">' +
      h.kv([['학생', (ok ? st.name : h.mask(st.name)) + ' · ' + st.grade], ['센터', c.name], ['검사일', r ? '2027-' + r.at.slice(0, 5) : '센터에 물어보세요'], ['두뇌 유형', '○○형'], ['읽기 레벨', lv]]) +
      '<p style="margin-top:8px">유형 지수는 표시하지 않아요. 결과 설명과 프로그램 안내는 상담에서 해요.</p></div>' +
      '<div class="cmk-note">센터에서 바로 출력하는 것이 기본이에요. 알림톡 링크는 센터가 켰을 때만 와요 (POL-30 안).</div></section>';
    return gate + sheet;
  }

  B.action('PA01.tab', (ctx, t) => { if (['chat', 'pay', 'consent', 'result'].includes(t)) B.state.tab = t; });
  B.action('PA01.student', (ctx, arg) => {
    const s = ctx.s, ui = U(s, 'PA-01');
    if (arg && typeof arg === 'object') { if (arg.student) ui.student = arg.student; if (arg.bill) ui.bill = arg.bill; }
    else if (arg) ui.student = arg;
    ui.rOk = null; ui.redo = false;
  });
  B.action('PA01.method', (ctx, v) => { U(ctx.s, 'PA-01').method = v; });
  B.action('PA01.pay', (ctx, arg) => {
    const s = ctx.s, ui = U(s, 'PA-01');
    if (arg && typeof arg === 'object') { if (arg.student) ui.student = arg.student; if (arg.method) ui.method = arg.method; if (arg.bill) ui.bill = arg.bill; }
    else if (typeof arg === 'string' && s.students.some(x => x.id === arg)) ui.student = arg;
    const st = paStudent({ s, ui });
    // CT-07에서 결제 대기로 둔 원생이면 그 거래를 그대로 결제해요
    const pend = st && !st.pseudo ? c07flow(s, st) : null;
    if (pend && pend.stage === '결제 대기' && B.actions['PA01.payLink']) return B.actions['PA01.payLink'](ctx, { student: st.id, method: ui.method });
    if (!st || st.pseudo || st.status === '상담' || !st.product) { say('원생 등록과 수강 등록을 마친 뒤 결제 링크가 와요.'); return; }
    if (st.paid === '수납 완료') { say('이미 결제했어요.'); return; }
    const bill = billFor(s, ui, st);
    const n = s.payments.length + 1;
    const approval = 'KP-270308' + pad2(n);
    const at = tick(s);
    s.payments.push({ id: 'pay' + n, center: st.center, date: md(s), student: st.id, item: bill.month + ' 교습비, 교재비', amount: bill.total, method: '결제선생 링크', approval, receipt: '발급', by: '결제선생 자동 기록' });
    const opened = st.account !== '활성';
    st.paid = '수납 완료';
    if (opened) st.account = '활성';
    ui.paidFor = st.id;
    ui.receipt = { approval, method: ui.method || '카드', total: bill.total, opened, at };
    s.pa01.extra.push({ student: st.id, at: '2027-' + at, kind: 'pay', name: '결제 완료', text: bill.month + ' 수강료 ' + h.money(bill.total) + ' 결제가 끝났어요. 승인번호 ' + approval });
    s.ui['CT-07'] = Object.assign(s.ui['CT-07'] || {}, { student: st.id, paidVia: 'PA-01' });
    if (!st.cls) s.ui['CT-11'] = Object.assign(s.ui['CT-11'] || {}, { assign: st.id });
    say('결제가 끝났어요. 센터 수납 기록과 학습 계정에 바로 반영돼요.');
  });
  B.action('PA01.sendCode', ctx => { const ui = U(ctx.s, 'PA-01'); ui.codeSent = true; ui.c_err = null; say('인증번호를 문자로 보냈어요 (시연). 아무 6자리 숫자나 넣어 보세요.'); });
  B.action('PA01.redo', ctx => { const ui = U(ctx.s, 'PA-01'); Object.assign(ui, { redo: true, codeSent: false, c_code: '', c_req1: false, c_req2: false, c_mk_alim: false, c_mk_sms: false, c_mk_night: false, c_err: null }); });
  B.action('PA01.consent', (ctx, arg) => {
    const s = ctx.s, ui = U(s, 'PA-01');
    if (typeof arg === 'string') ui.student = arg;
    else if (arg && typeof arg === 'object') {
      if (arg.student) ui.student = arg.student;
      Object.assign(ui, { redo: true, codeSent: true, c_code: arg.code || '123456', c_req1: arg.req1 !== false, c_req2: arg.req2 !== false, c_mk_alim: !!arg.mkAlim, c_mk_sms: !!arg.mkSms, c_mk_night: !!arg.mkNight });
    }
    const st = paStudent({ s, ui });
    if (!st) return;
    if (st.consent && !ui.redo) { say('이미 동의를 받았어요.'); return; }
    ui.c_err = !ui.codeSent ? '먼저 인증번호를 받아 주세요.'
      : !/^\d{6}$/.test(String(ui.c_code || '')) ? '문자로 받은 6자리 숫자를 넣어 주세요.'
      : !(ui.c_req1 && ui.c_req2) ? '필수 항목 두 개에 모두 동의해야 등록할 수 있어요.' : null;
    if (ui.c_err) return;
    const at = tick(s).slice(6);
    const rec = { date: s.today, method: '휴대폰 본인인증', version: 'v1', at, marketing: { alim: !!ui.c_mk_alim, sms: !!ui.c_mk_sms, night: !!ui.c_mk_night, date: s.today } };
    if (!st.pseudo) { const real = s.students.find(x => x.id === st.id); if (real) real.consent = rec; }
    s.ui['CT-05'] = Object.assign(s.ui['CT-05'] || {}, { consent: { student: st.id, status: '인증 완료', at: s.today + ' ' + at, method: '휴대폰 본인인증', version: 'v1', marketing: rec.marketing } });
    ui.redo = false;
    say('동의를 받았어요. 원생 등록(CT-05)에 방법과 일시와 문안 버전이 저장돼요.');
  });
  B.action('PA01.openResult', (ctx, arg) => {
    const s = ctx.s, ui = U(s, 'PA-01');
    if (arg != null && typeof arg !== 'object') ui.r4 = String(arg);
    const st = paStudent({ s, ui });
    if (String(ui.r4 || '') === String(st.phone || '').replace(/\D/g, '').slice(-4)) { ui.rOk = st.id; ui.rErr = null; }
    else ui.rErr = '번호가 맞지 않아요. 센터에 등록한 보호자 휴대폰 뒤 4자리를 넣어 주세요.';
  });
  // CT-07에서 결제선생 링크를 보내 결제 대기로 둔 원생을 보호자가 휴대폰에서 결제해요.
  // 수납 기록은 CT07.paid가 남기고, 이 화면은 그 원생의 결제 완료와 영수증을 보여 줘요.
  B.action('PA01.payLink', (ctx, arg) => {
    const s = ctx.s, ui = U(s, 'PA-01');
    const sid = (arg && typeof arg === 'object' ? arg.student : arg) || (s.ui['CT-07'] || {}).student;
    const st = s.students.find(x => x.id === sid);
    const f = st && s.ct07 && s.ct07.flow ? s.ct07.flow[st.id] : null;
    if (!st || !f || f.stage !== '결제 대기' || !B.actions['CT07.paid']) { say('센터가 결제 링크를 보내면 여기서 결제할 수 있어요.'); return; }
    if (arg && typeof arg === 'object' && arg.method) ui.method = arg.method;
    Object.assign(ui, { student: st.id, rOk: null, redo: false });
    B.actions['CT07.paid'](ctx);
    if (f.stage !== '수납 완료') return;
    const pr = s.products.find(p => p.id === f.pid) || {};
    const month = ((/(\d+)월/.exec((f.lines && f.lines[0] && f.lines[0][0]) || '') || [])[1] || '3') + '월';
    ui.bill = { student: st.id, month, lines: (f.lines || []).map(l => ({ t: l[0], a: l[1] })), total: f.total, product: pr.name || '', at: md(s) + ' 11:58' };
    ui.paidFor = st.id;
    ui.receipt = { approval: f.approval, method: ui.method || '카드', total: f.total, opened: true, at: md(s) + ' 12:03' };
    s.pa01.extra.push({ student: st.id, at: s.today + ' 12:03', kind: 'pay', name: '결제 완료', text: month + ' 수강료 ' + h.money(f.total) + ' 결제가 끝났어요. 승인번호 ' + f.approval });
    say('결제가 끝났어요. 센터 수납 기록(CT-07)과 학습 계정에 바로 반영돼요.');
  });
})();
