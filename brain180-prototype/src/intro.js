/* IN-01 처음 보는 분을 위한 안내. The landing page: what Brain180 is, who uses it, money flow, phases, how to read this prototype. */
(function () {
  const B = window.B, h = B.h, esc = B.esc;
  const KEY_TERMS = ['직영', '가맹', '테스트베드', '교습비', '시스템 사용료', '가맹금', '정보공개서', '알림톡', '결제선생', '법정대리인 동의'];
  const css = `
  .in-wrap { padding: 26px 34px 40px; display: flex; flex-direction: column; gap: 18px; background: #fbfbfc; min-height: 100%; }
  .in-hero h1 { margin: 0 0 6px; font-size: 24px; }
  .in-hero p { margin: 0; color: var(--sub); font-size: 13.5px; max-width: 760px; }
  .in-sec { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; }
  .in-sec h2 { margin: 0 0 10px; font-size: 15px; display: flex; gap: 8px; align-items: center; }
  .in-sec h2 span { font-size: 11px; color: var(--mute); font-weight: 600; }
  .in-cols { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  .in-col { background: var(--bg); border-radius: 10px; padding: 12px; font-size: 12.3px; }
  .in-col b { display: block; font-size: 13.5px; margin-bottom: 4px; }
  .in-col .chip { margin-bottom: 6px; }
  .in-phase { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .in-phase > div { border-radius: 10px; padding: 12px; border: 1px solid var(--line); font-size: 12.3px; }
  .in-phase .w { font-weight: 700; margin: 4px 0; }
  .in-legend { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 18px; font-size: 12.5px; }
  .in-legend > div { display: flex; gap: 10px; align-items: flex-start; }
  .in-dot { flex: none; width: 21px; height: 21px; border-radius: 50%; color: #fff; font-weight: 800; font-size: 11px; display: grid; place-items: center; }
  .in-terms { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 18px; font-size: 12.3px; }
  .in-terms dt { font-weight: 700; }
  .in-terms dd { margin: 0 0 6px; color: #3d4556; }
  .in-go { display: flex; gap: 8px; flex-wrap: wrap; }
  .tablet .in-cols { grid-template-columns: repeat(2, minmax(0, 1fr)); }`;

  B.screen({
    id: 'IN-01', side: 'cm', phase: 'P1a', devices: ['pc', 'tablet'], pages: [1, 4, 5, 6], chrome: 'none',
    title: '처음 보는 분을 위한 안내', channelText: '이 프로토타입 안내',
    render(ctx) {
      const R = B.REVIEW, bp = R.bigPicture || {};
      const phases = (bp.phases || []);
      const flows = (bp.money_flows || []);
      const terms = KEY_TERMS.map(t => (B.GLOSSARY || []).find(g => g.term === t || g.term.startsWith(t))).filter(Boolean);
      return '<style>' + css + '</style><div class="in-wrap">' +
        '<div class="in-hero"><h1>브레인180 관리자 시스템을 처음 보는 분께</h1><p>' + esc((R.core || {}).one_liner || '') + ' 이 화면은 설계서 v0.1(70쪽)을 그대로 눌러 볼 수 있게 만든 프로토타입이에요. 오른쪽 PRD에는 화면마다 기능 설명이 번호로 붙어 있어요.</p></div>' +
        '<section class="in-sec"' + h.p(1) + '><h2>브레인180은 무엇인가요</h2><p style="margin:0;font-size:12.8px">' + esc(bp.what || '') + '</p></section>' +
        '<section class="in-sec"' + h.p(2) + '><h2>누가 어떤 화면을 쓰나요 <span>화면 53개</span></h2><div class="in-cols">' +
        '<div class="in-col"><span class="chip id">HQ</span><b>본사 관리자 페이지</b>센터와 가맹 계약, 가격과 규칙(정책), 매달 정산, 교재와 콘텐츠 공급을 맡아요. 화면 26개, PC 전용이에요.</div>' +
        '<div class="in-col"><span class="chip id">CT</span><b>센터 관리자 페이지</b>상담부터 등록, 수납, 출결, 학습 확인까지 센터 하루 일을 해요. 직영과 가맹이 같은 화면을 써요. 화면 24개, 일부는 태블릿도 돼요.</div>' +
        '<div class="in-col"><span class="chip id">CM</span><b>공통</b>로그인, 센터 바꾸기, 본사 지원 모드, 목록과 개인정보 가리기 같은 공통 규칙이에요. 화면 3개예요.</div>' +
        '<div class="in-col"><span class="chip review">검토 제안</span><b>학부모와 학생 화면</b>설계서 범위 밖이지만 흐름을 이해하도록 넣었어요. 센터 입구 키오스크(KS-01)와 학부모 휴대폰(PA-01)이에요.</div>' +
        '</div></section>' +
        '<section class="in-sec"' + h.p(3) + '><h2>돈은 어떻게 흐르나요 <span>설계서 5쪽</span></h2>' + h.table({
          cols: [{ label: '어떤 돈', render: f => '<b>' + esc(f.what) + '</b>' }, { label: '내는 쪽', k: 'from' }, { label: '받는 쪽', k: 'to' }, { label: '쉽게 말하면', k: 'how' }],
          rows: flows,
        }) + '</section>' +
        '<section class="in-sec"' + h.p(4) + '><h2>언제 무엇을 여나요 <span>설계서 6쪽, 일정은 (안)</span></h2><div class="in-phase">' +
        phases.map(p => '<div><span class="chip ' + esc(String(p.code).toLowerCase()) + '">' + esc(p.code) + '</span><div class="w">' + esc(p.when) + '</div>' + esc(p.what) + '</div>').join('') + '</div></section>' +
        '<section class="in-sec"' + h.p(5) + '><h2>이 프로토타입 보는 법</h2><div class="in-legend">' +
        '<div><span class="in-dot" style="background:var(--brand)">1</span><span>빨간 번호는 설계서에 있는 기능이에요. 번호를 누르면 오른쪽 PRD의 같은 번호 설명으로 가요.</span></div>' +
        '<div><span class="in-dot" style="background:var(--review)">7</span><span>보라색 번호는 검토에서 찾은 빈틈을 채우려고 새로 넣은 기능이에요. 설명에 보완점 번호(IMP)가 붙어 있어요.</span></div>' +
        '<div><span class="chip st-안">(안)</span><span>회의에서 나온 제안이에요. 아직 확정이 아니에요. 예시는 화면용 가짜 값, 미정은 아직 정하지 않은 값, 법정은 법으로 정해진 값이에요.</span></div>' +
        '<div><span class="chip p1a">P1a</span><span>단계 표시예요. P1a 직영 시범, P1b 가맹 개시, P2 가맹 확대예요. 메뉴 옆에도 붙어 있어요.</span></div>' +
        '<div><span class="chip line">사람 선택</span><span>맨 위에서 본사 운영팀, 정산팀, 센터 원장, 실장, 교사로 바꿔 볼 수 있어요. 역할마다 보이는 메뉴와 고칠 수 있는 범위가 달라요(설계서 7쪽).</span></div>' +
        '<div><span class="chip line">PC · 태블릿</span><span>설계서가 태블릿도 된다고 한 화면만 태블릿 보기가 켜져요. 관리자 화면은 모두 PC가 기본이에요.</span></div>' +
        '</div></section>' +
        '<section class="in-sec"' + h.p(6) + '><h2>어디서부터 볼까요</h2><p style="margin:0 0 10px;font-size:12.8px">처음이라면 데모 가이드를 권해요. 위쪽 다음 버튼이나 키보드 오른쪽 화살표로 업무 순서대로 한 단계씩 넘어가요.</p><div class="in-go">' +
        h.btn('데모 가이드 처음부터 보기', { primary: true, act: 'IN.demo' }) + h.btn('본사 화면 둘러보기', { act: 'IN.hq' }) + h.btn('센터 화면 둘러보기', { act: 'IN.ct' }) + h.btn('키오스크 보기', { act: 'IN.ks' }) + h.btn('학부모 휴대폰 보기', { act: 'IN.pa' }) + '</div></section>' +
        '<section class="in-sec"' + h.p(7) + '><h2>먼저 알아 두면 좋은 말 <span>전체 96개는 오른쪽 전체 PRD 탭에 있어요</span></h2><dl class="in-terms">' +
        terms.map(t => '<div><dt>' + esc(t.term) + '</dt><dd>' + esc(t.easy) + '</dd></div>').join('') + '</dl></section>' +
        '</div>';
    },
    prd: {
      summary: '프로토타입을 처음 여는 사람이 전체 그림을 먼저 잡도록 돕는 안내 화면이에요. 설계서에는 없는 화면이에요.',
      who: '처음 보는 모든 사람(기획, 개발, 경영진, 센터 원장 후보)',
      items: [
        { n: 1, t: '브레인180이 무엇인지', d: '어떤 사업이고 이 설계서가 무엇을 만드는지 한 문단으로 알려 줘요.', ref: 'p.1, p.4' },
        { n: 2, t: '누가 어떤 화면을 쓰는지', d: '본사 화면 26개, 센터 화면 24개, 공통 3개로 나뉘어요. 학부모와 학생 화면은 설계서 범위 밖이라 검토 제안으로만 보여 줘요.', ref: 'p.2, p.8, p.9' },
        { n: 3, t: '돈의 흐름', d: '학원비, 사용료, 가맹금, 알림톡 충전, 교재 대금이 누구에게서 누구에게 가는지 한 표로 보여 줘요.', ref: 'p.5' },
        { n: 4, t: '단계와 일정', d: 'P1a 직영 시범, P1b 가맹 개시, P2 가맹 확대 순서로 열어요. 일정은 아직 (안)이에요.', ref: 'p.6' },
        { n: 5, t: '보는 법', d: '빨간 번호는 설계서 기능, 보라색 번호는 검토에서 더한 기능이에요. (안), 예시, 미정, 법정 표시와 사람 선택, 기기 선택을 설명해요.' },
        { n: 6, t: '시작 버튼', d: '데모 가이드를 처음부터 보거나, 본사, 센터, 키오스크, 학부모 화면으로 바로 갈 수 있어요.' },
        { n: 7, t: '먼저 알아 두면 좋은 말', d: '처음 보는 사람이 가장 많이 헷갈리는 말 10개를 쉬운 말로 풀었어요. 나머지 용어는 전체 PRD 탭에 있어요.' },
      ],
    },
  });
  B.action('IN.demo', () => { B.demoGo(0); return false; });
  B.action('IN.hq', () => { B.state.mode = 'free'; B.go('HQ-01', { persona: 'hq:ops' }); return false; });
  B.action('IN.ct', () => { B.state.mode = 'free'; B.go('CT-01', { persona: 'ct:daechi1:원장' }); return false; });
  B.action('IN.ks', () => { B.state.mode = 'free'; B.go('KS-01', { persona: 'ct:daechi1:실장·데스크' }); return false; });
  B.action('IN.pa', () => { B.state.mode = 'free'; B.go('PA-01', { persona: 'ct:daechi1:원장' }); return false; });
})();
