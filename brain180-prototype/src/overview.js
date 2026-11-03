/* "전체 PRD" tab: the whole-product PRD built from the review data and the live screen registry. */
(function () {
  const B = window.B, esc = B.esc;
  const personaFor = id => id.startsWith('HQ') ? 'hq:ops' : (id.startsWith('CT') || id.startsWith('KS') || id.startsWith('PA')) ? 'ct:daechi1:원장' : '';
  const link = id => { const d = B.screens[id]; return '<button class="prd-link" data-screen-go="' + id + '" data-persona="' + personaFor(id) + '">' + id + (d ? ' ' + esc(d.title) : '') + '</button>'; };
  B.overviewPRD = function () {
    const R = B.REVIEW, core = R.core || {};
    const ids = B.order.slice();
    const phaseOf = id => { const d = B.screens[id]; if (!d) return '-'; if (d.tabs) return d.tabs.map(t => t.phase || d.phase).filter((v, i, a) => a.indexOf(v) === i).join('/'); return d.phase || 'P1a'; };
    const byPhase = ph => ids.filter(id => /^(HQ|CT|CM)/.test(id) && phaseOf(id).split('/').includes(ph));
    const reflected = {};
    ids.forEach(id => (B.screens[id].prd.items || []).forEach(it => [].concat(it.imp || []).forEach(x => { (reflected[x] = reflected[x] || []).push(id); })));
    const uniq = a => a.filter((v, i) => a.indexOf(v) === i);
    let h = '';
    h += '<div class="prd-sec"><h5>한 줄로 말하면</h5><p>' + esc(core.one_liner || '') + '</p></div>';
    h += '<div class="prd-sec"><h5>다섯 줄 요약</h5><ul>' + (core.tldr || []).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
    h += '<div class="prd-sec"><h5>배경</h5><p>' + esc((core.background || {}).summary || '') + '</p></div>';
    h += '<div class="prd-sec"><h5>목적</h5><p>' + esc((core.purpose || {}).summary || '') + '</p></div>';
    h += '<div class="prd-sec"><h5>운영 환경 (설계서 화면별 채널 확인 결과)</h5><table class="ov-table"><tr><th>환경</th><th>화면</th></tr>' +
      '<tr><td>PC 웹</td><td>53개 전부. 본사 관리자 페이지는 PC 웹 전용이에요.</td></tr>' +
      '<tr><td>태블릿 겸용</td><td>14개. CM-01, CM-03, HQ-24, CT-01~07, CT-11~13이고, CT-03 입학 테스트는 태블릿이 먼저예요.</td></tr>' +
      '<tr><td>모바일</td><td>관리자 화면은 없어요. 학부모가 받는 알림톡과 결제 링크, 보호자 본인인증만 휴대폰이에요(원문 범위 밖). 데모에서는 PA-01로 보여 줘요.</td></tr>' +
      '<tr><td>공용 태블릿</td><td>센터 입구 키오스크 입·퇴실(원문 범위 밖, IMP-05). 데모에서는 KS-01로 보여 줘요.</td></tr></table></div>';
    h += '<div class="prd-sec"><h5>단계별 화면</h5><table class="ov-table"><tr><th>단계</th><th>뜻</th><th>화면</th></tr>' +
      [['P1a', '2027년 1~2월 대치1센터 직영 시범, 3월 직영 확장'], ['P1b', '정보공개서를 등록한 뒤 가맹 개시'], ['P2', '가맹 확대 (모집, 점검, 통계, 교육)']].map(([ph, m]) =>
        '<tr><td><span class="chip ' + ph.toLowerCase() + '">' + ph + '</span></td><td>' + esc(m) + '</td><td>' + byPhase(ph).length + '개</td></tr>').join('') + '</table></div>';
    ['P1a', 'P1b', 'P2'].forEach(ph => {
      h += '<div class="prd-sec"><h5>' + ph + ' 화면 목록</h5><ul>' + byPhase(ph).map(id => '<li>' + link(id) + '</li>').join('') + '</ul></div>';
    });
    h += '<div class="prd-sec"><h5>검토 제안으로 더한 화면</h5><ul>' + ids.filter(id => /^(KS|PA)/.test(id)).map(id => '<li>' + link(id) + '</li>').join('') + '</ul></div>';
    h += '<div class="prd-sec"><h5>먼저 정해야 할 10가지 (부록 A)</h5><ul>' + (R.decisions || []).map(d => '<li><b>' + d.no + '. ' + esc(d.topic) + '</b><br><span class="muted small">결정 ' + esc(d.owner) + ' · ' + esc(d.deadline) + '</span></li>').join('') + '</ul></div>';
    h += '<div class="prd-sec"><h5>보완점 30개와 프로토타입 반영 위치</h5><ul>' + (R.imps || []).map(i => {
      const where = uniq(reflected[i.id] || []);
      return '<li><span class="chip ' + (i.priority === 'P0' ? 'brand' : i.priority === 'P1' ? 'info' : 'p2') + '">' + esc(i.priority) + '</span> <b>' + esc(i.id) + '</b> ' + esc(i.title) +
        '<br><span class="small">' + (where.length ? '반영 화면 ' + where.map(link).join(', ') : '<span class="muted">화면이 아니라 문서나 운영으로 풀어야 해요</span>') + '</span></li>';
    }).join('') + '</ul></div>';
    if (B.chapters.length) h += '<div class="prd-sec"><h5>데모 가이드 구성</h5><ul>' + B.chapters.map(c => '<li><b>' + esc(c.title) + '</b> ' + esc(c.desc || '') + '</li>').join('') + '</ul></div>';
    return h;
  };
})();
