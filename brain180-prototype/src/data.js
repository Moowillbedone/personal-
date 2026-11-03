/* Base mock data. Every value is an example, like the spec's own screens. Screens may add more with B.extend(store => {...}). */
(function () {
  const B = window.B;
  B.baseStore = function () {
    return {
      today: '2027-03-08', todayLabel: '2027.03.08 (월)',
      centers: [
        { id: 'daechi1', name: '대치1센터', type: '직영', status: '운영', facility: '학원', rooms: 2, roomCap: 12, facilityCap: 24, timeCap: 15, director: '김지원', students: 128, pay: '결제선생', fee: '내부 대체', sv: '최민호', region: '서울 강남구', edu: '강남서초교육지원청', curfew: '22:00', opened: '2027-01-04', contractEnd: '-', phone: '02-555-0180', bizNo: '120-81-00180' },
        { id: 'mokdong', name: '목동센터', type: '직영', status: '운영', facility: '학원', rooms: 2, roomCap: 12, facilityCap: 24, timeCap: 15, director: '이도윤', students: 96, pay: '결제선생', fee: '내부 대체', sv: '최민호', region: '서울 양천구', edu: '강서양천교육지원청', curfew: '22:00', opened: '2027-03-02', contractEnd: '-', phone: '02-2650-0180', bizNo: '120-81-00180' },
        { id: 'bundang', name: '분당센터', type: '직영', status: '운영', facility: '학원', rooms: 2, roomCap: 12, facilityCap: 24, timeCap: 15, director: '박서준', students: 84, pay: '결제선생', fee: '내부 대체', sv: '최민호', region: '경기 성남시', edu: '성남교육지원청', curfew: '22:00', opened: '2027-03-02', contractEnd: '-', phone: '031-711-0180', bizNo: '120-81-00180' },
        { id: 'daegu', name: '대구수성센터', type: '가맹', status: '운영', facility: '학원', rooms: 2, roomCap: 10, facilityCap: 20, timeCap: 15, director: '오세린', students: 63, pay: '수기 기록', fee: '20,000원', sv: '정유나', region: '대구 수성구', edu: '대구동부교육지원청', curfew: '22:00', opened: '2027-10-01', contractEnd: '2032-09-30', phone: '053-760-0180', bizNo: '514-12-34567' },
        { id: 'busan', name: '부산해운대센터', type: '테스트베드', status: '운영', facility: '교습소', rooms: 1, roomCap: 9, facilityCap: 9, timeCap: 9, director: '최하은', students: 41, pay: '수기 기록', fee: '18,000원 (개별 특가)', sv: '정유나', region: '부산 해운대구', edu: '해운대교육지원청', curfew: '22:00', opened: '2027-10-01', contractEnd: '2032-09-30', phone: '051-740-0180', bizNo: '617-23-45678' },
        { id: 'incheon', name: '인천송도센터', type: '가맹', status: '계획', facility: '학원', rooms: 2, roomCap: 12, facilityCap: 24, timeCap: 15, director: '윤가람 (예정)', students: 0, pay: '수기 기록', fee: '20,000원', sv: '정유나', region: '인천 연수구', edu: '인천동부교육지원청', curfew: '22:00', opened: '-', contractEnd: '-', phone: '-', bizNo: '-' },
      ],
      staff: [
        { id: 'st1', center: 'daechi1', name: '김지원', role: '원장', check: '2026-12-10', twoFactor: true, phone: '010-2201-1801', status: '활성', notified: '2026-12-12' },
        { id: 'st2', center: 'daechi1', name: '송하늘', role: '실장·데스크', check: '2026-12-11', twoFactor: true, phone: '010-2201-1802', status: '활성', notified: '-' },
        { id: 'st3', center: 'daechi1', name: '한결', role: '교사', check: '2026-12-15', twoFactor: true, phone: '010-2201-1803', status: '활성', notified: '2026-12-16' },
        { id: 'st4', center: 'daechi1', name: '서도윤', role: '교사', check: '2026-12-15', twoFactor: false, phone: '010-2201-1804', status: '활성', notified: '2026-12-16' },
        { id: 'st5', center: 'daechi1', name: '문채원', role: '보조교사', check: '', twoFactor: false, phone: '010-2201-1805', status: '잠김 (경력 조회 전)', notified: '-' },
        { id: 'st6', center: 'busan', name: '최하은', role: '원장', check: '2027-09-20', twoFactor: true, phone: '010-3301-1801', status: '활성', notified: '-' },
        { id: 'st7', center: 'busan', name: '김보람', role: '보조교사', check: '2027-09-22', twoFactor: false, phone: '010-3301-1802', status: '활성', notified: '-' },
        { id: 'st8', center: 'daegu', name: '오세린', role: '원장', check: '2027-09-18', twoFactor: true, phone: '010-4401-1801', status: '활성', notified: '2027-09-19' },
        { id: 'st9', center: 'daegu', name: '배유진', role: '실장·데스크', check: '2027-09-18', twoFactor: true, phone: '010-4401-1802', status: '활성', notified: '-' },
      ],
      classes: [
        { id: 'c1', center: 'daechi1', name: 'L1-월수A', level: 'L1', days: '월·수', time: '16:00~17:30', teacher: '한결', assistant: '', cap: 15, enrolled: 13, room: '1실' },
        { id: 'c2', center: 'daechi1', name: 'L2-월수B', level: 'L2', days: '월·수', time: '17:50~19:20', teacher: '한결', assistant: '', cap: 15, enrolled: 14, room: '1실' },
        { id: 'c3', center: 'daechi1', name: 'L2-화목A', level: 'L2', days: '화·목', time: '16:00~17:30', teacher: '서도윤', assistant: '', cap: 15, enrolled: 12, room: '2실' },
        { id: 'c4', center: 'daechi1', name: 'L3-화목B', level: 'L3', days: '화·목', time: '17:50~19:20', teacher: '서도윤', assistant: '', cap: 15, enrolled: 15, room: '2실' },
        { id: 'c5', center: 'daechi1', name: 'L1-금A', level: 'L1', days: '금', time: '16:00~17:30', teacher: '한결', assistant: '', cap: 15, enrolled: 9, room: '1실' },
      ],
      // 직영 확정가와 등록액은 원문 52쪽 표와 같아요. 주 3회는 360,000원으로 바꾸는 변경신고 중이라 지금은 등록액 340,000원까지만 받아요.
      products: [
        { id: 'pr1', name: '주 2회 · 90분', perWeek: 2, minutes: 90, recommend: 260000, direct: 260000, edu: { daechi1: 280000, mokdong: 280000, bundang: 280000, daegu: 300000, busan: 250000 }, centerPrice: { daegu: 290000, busan: 250000 } },
        { id: 'pr2', name: '주 3회 · 90분', perWeek: 3, minutes: 90, recommend: 360000, direct: 360000, edu: { daechi1: 340000, mokdong: 340000, bundang: 340000, daegu: 400000, busan: 360000 }, centerPrice: { daegu: 380000, busan: 360000 } },
        { id: 'pr3', name: '주 1회 · 90분', perWeek: 1, minutes: 90, recommend: 150000, direct: 150000, edu: { daechi1: 150000, mokdong: 150000, bundang: 150000, daegu: 150000, busan: 135000 }, centerPrice: { daegu: 150000, busan: 135000 } },
      ],
      extraFees: [{ id: 'ex1', name: '교재비 (월)', amount: 15000, eduRegistered: true }],
      students: [
        { id: 's1', center: 'daechi1', name: '윤서아', grade: '초4', level: 'L2', cls: 'c3', status: '재원', guardian: '윤정민', phone: '010-3482-2210', since: '2027-01-04', product: 'pr1', account: '활성', paid: '수납 완료', consent: { date: '2027-01-04', method: '휴대폰 본인인증', version: 'v1' } },
        { id: 's2', center: 'daechi1', name: '한지율', grade: '초3', level: 'L1', cls: 'c1', status: '재원', guardian: '한상우', phone: '010-5521-9081', since: '2027-01-04', product: 'pr1', account: '활성', paid: '수납 완료', consent: { date: '2027-01-04', method: '휴대폰 본인인증', version: 'v1' } },
        { id: 's3', center: 'daechi1', name: '강민우', grade: '초5', level: 'L3', cls: 'c4', status: '재원', guardian: '강수진', phone: '010-7712-3346', since: '2027-03-06', product: 'pr1', account: '가오픈', paid: '미수', consent: { date: '2027-03-06', method: '휴대폰 본인인증', version: 'v1' } },
        { id: 's4', center: 'daechi1', name: '임채희', grade: '초4', level: 'L2', cls: '', status: '상담', guardian: '임도윤', phone: '010-2290-7710', since: '', product: '', account: '-', paid: '-', consent: null },
        { id: 's5', center: 'daechi1', name: '박하준', grade: '초6', level: 'L3', cls: 'c4', status: '재원', guardian: '박은영', phone: '010-4410-5521', since: '2027-01-04', product: 'pr2', account: '활성', paid: '미수', consent: { date: '2027-01-04', method: '서면 동의서', version: 'v1' } },
        { id: 's6', center: 'daechi1', name: '이서윤', grade: '초4', level: 'L2', cls: 'c2', status: '휴원', guardian: '이민호', phone: '010-8812-0401', since: '2027-01-11', product: 'pr1', account: '정지', paid: '-', consent: { date: '2027-01-11', method: '휴대폰 본인인증', version: 'v1' } },
        { id: 's7', center: 'daechi1', name: '최도현', grade: '초5', level: 'L2', cls: 'c2', status: '재원', guardian: '최지혜', phone: '010-6630-1122', since: '2027-01-04', product: 'pr1', account: '활성', paid: '수납 완료', consent: { date: '2027-01-04', method: '휴대폰 본인인증', version: 'v1' } },
        { id: 's8', center: 'daechi1', name: '정예린', grade: '초3', level: 'L1', cls: 'c1', status: '재원', guardian: '정우진', phone: '010-9901-3345', since: '2027-02-01', product: 'pr1', account: '활성', paid: '수납 완료', consent: { date: '2027-02-01', method: '카카오 인증', version: 'v1' } },
        { id: 's9', center: 'daechi1', name: '조시우', grade: '초4', level: 'L2', cls: 'c3', status: '퇴원 예정', guardian: '조현아', phone: '010-2234-8890', since: '2027-01-04', product: 'pr1', account: '활성', paid: '수납 완료', consent: { date: '2027-01-04', method: '휴대폰 본인인증', version: 'v1' } },
        { id: 's10', center: 'daechi1', name: '김나윤', grade: '초2', level: 'L1', cls: 'c5', status: '재원', guardian: '김태희', phone: '010-5512-6677', since: '2027-02-01', product: 'pr3', account: '활성', paid: '수납 완료', consent: { date: '2027-02-01', method: '휴대폰 본인인증', version: 'v1' } },
        { id: 's11', center: 'daechi1', name: '오지호', grade: '초5', level: 'L3', cls: 'c4', status: '재원', guardian: '오승연', phone: '010-7723-4456', since: '2027-01-04', product: 'pr2', account: '활성', paid: '수납 완료', consent: { date: '2027-01-04', method: '휴대폰 본인인증', version: 'v1' } },
        { id: 's12', center: 'daechi1', name: '신유나', grade: '초4', level: 'L2', cls: '', status: '대기', guardian: '신동혁', phone: '010-3390-1288', since: '', product: 'pr1', account: '-', paid: '-', consent: null },
        { id: 's13', center: 'busan', name: '장하람', grade: '초4', level: 'L2', cls: 'b1', status: '재원', guardian: '장미경', phone: '010-6612-0098', since: '2027-10-04', product: 'pr1', account: '활성', paid: '수납 완료', consent: { date: '2027-10-04', method: '휴대폰 본인인증', version: 'v1' } },
        { id: 's14', center: 'daegu', name: '배준서', grade: '초5', level: 'L3', cls: 'd1', status: '재원', guardian: '배선영', phone: '010-8890-3341', since: '2027-10-04', product: 'pr1', account: '활성', paid: '수납 완료', consent: { date: '2027-10-04', method: '휴대폰 본인인증', version: 'v1' } },
      ],
      reservations: [
        { id: 'r1', center: 'daechi1', at: '03-08 11:00', student: '윤시온', grade: '초4', kind: '입학 테스트', route: '전화', guardianPhone: '010-4420-2210', status: '예약', result: '-' },
        { id: 'r2', center: 'daechi1', at: '03-08 13:30', student: '한도율', grade: '초3', kind: '상담', route: '방문', guardianPhone: '010-7781-9081', status: '예약', result: '-' },
        { id: 'r3', center: 'daechi1', at: '03-06 15:00', student: '강민우', grade: '초5', kind: '입학 테스트', route: '본사 문의 연결', guardianPhone: '010-7712-3346', status: '완료', result: '등록' },
        { id: 'r4', center: 'daechi1', at: '03-05 16:00', student: '임채희', grade: '초4', kind: '입학 테스트', route: '전화', guardianPhone: '010-2290-7710', status: '완료', result: '보류' },
      ],
      payments: [
        { id: 'pay1', center: 'daechi1', date: '03-02', student: 's1', item: '3월 교습비, 교재비', amount: 275000, method: '결제선생 링크', approval: 'KP-27030201', receipt: '발급', by: '송하늘' },
        { id: 'pay2', center: 'daechi1', date: '03-02', student: 's2', item: '3월 교습비, 교재비', amount: 275000, method: '카드 단말기', approval: '30219881', receipt: '-', by: '송하늘' },
        { id: 'pay3', center: 'daechi1', date: '03-04', student: 's7', item: '3월 교습비, 교재비', amount: 275000, method: '계좌이체', approval: '-', receipt: '발급', by: '송하늘' },
        { id: 'pay4', center: 'daechi1', date: '03-05', student: 's11', item: '3월 교습비, 교재비', amount: 385000, method: '결제선생 링크', approval: 'KP-27030502', receipt: '발급', by: '김지원' },
        { id: 'pay5', center: 'daechi1', date: '03-06', student: 's8', item: '3월 교습비, 교재비', amount: 275000, method: '현금', approval: '-', receipt: '미발급', by: '송하늘' },
      ],
      invoices: [
        { id: 'inv-daegu-09', center: 'daegu', month: '2027-09', status: '확인 대기', issued: '2027-10-05', due: '2027-10-15', lines: [{ t: '시스템 사용료 63명 × 20,000원', a: 1260000 }, { t: '교재 대금 (주문 #0705 도서 키트)', a: 98000 }], paid: 0, dispute: null },
        { id: 'inv-busan-09', center: 'busan', month: '2027-09', status: '입금 완료', issued: '2027-10-05', due: '2027-10-15', lines: [{ t: '시스템 사용료 41명 × 18,000원 (개별 특가)', a: 738000 }], paid: 738000, dispute: null },
      ],
      alim: {
        balances: { daegu: 32400, busan: 4100 },
        templates: [
          { id: 'T01', name: '입실 알림', kind: '정보성', status: '승인', text: '#{학생명} 학생이 #{시각}에 입실했어요.' },
          { id: 'T02', name: '퇴실 알림', kind: '정보성', status: '승인', text: '#{학생명} 학생이 #{시각}에 퇴실했어요.' },
          { id: 'T03', name: '수강료 안내', kind: '정보성', status: '승인', text: '#{월} 수강료 #{금액}원 안내입니다. 결제 링크 #{링크}' },
          { id: 'T04', name: '미납 안내', kind: '정보성', status: '승인', text: '#{월} 수강료가 아직 납부되지 않았어요.' },
          { id: 'T05', name: '재등록 안내', kind: '정보성', status: '심사 중', text: '#{월} 재등록 기간이에요. #{금액}원' },
          { id: 'T06', name: '결과지 링크', kind: '정보성', status: '승인', text: '입학 테스트 결과지를 확인해 주세요. #{링크}' },
        ],
        auto: { '입실': true, '퇴실': true, '수납': true, '미납': true, '재등록': true, '결과지': false },
        topups: [{ center: 'busan', amount: 50000, status: '입금 대기', at: '2027-10-07' }],
        log: [],
      },
      notices: [
        { id: 'n1', title: '3월 재등록 청구는 20일부터 열려요', must: true, date: '2027-03-02', read: { daechi1: true, mokdong: true, bundang: false } },
        { id: 'n2', title: '입학 테스트 간단판 v1 배포 안내', must: false, date: '2027-02-24', read: { daechi1: true, mokdong: false, bundang: false } },
        { id: 'n3', title: '개인정보 처리방침 v1 게시 요청', must: true, date: '2027-02-15', read: { daechi1: true, mokdong: true, bundang: true } },
      ],
      inquiries: [
        { id: 'q1', center: 'daechi1', title: '재등록 청구 금액이 4월 회차와 달라요', status: '진행 중', date: '03-07' },
        { id: 'q2', center: 'mokdong', title: '키오스크 번호 입력이 안 돼요', status: '접수', date: '03-08' },
      ],
      orders: [
        { id: '#0698', center: 'daechi1', item: '레벨 교재 L2 (주간 인쇄분)', qty: 40, amount: 0, status: '배송 완료', date: '03-03' },
        { id: '#0705', center: 'daegu', item: '도서 키트', qty: 14, amount: 98000, status: '배송 완료', date: '09-24' },
      ],
      leads: [
        { id: 'l1', name: '윤가람', region: '인천 연수구', stage: '계약 대기', source: '사업설명회', date: '2027-08-20' },
        { id: 'l2', name: '조민석', region: '광주 서구', stage: '정보공개서 제공', source: '홈페이지 문의', date: '2027-09-02' },
        { id: 'l3', name: '나혜원', region: '수원 영통구', stage: '상담', source: '전화', date: '2027-09-10' },
        { id: 'l4', name: '권도훈', region: '대전 유성구', stage: '문의', source: '홈페이지 문의', date: '2027-09-12' },
      ],
      gate: { center: 'incheon', owner: '윤가람', disclosureGiven: '2027-09-01', disclosureProof: '등기 우편 수령증', nearbyGiven: '2027-09-01', contractGiven: '2027-09-03', advised: false, deposit: '', signed: false },
      decisions: [],
      audit: [
        { at: '03-08 09:12', who: '홍길동 (본사 운영)', what: '원생 정보 마스킹 해제', target: '대치1센터 강*우', reason: '1:1 문의 처리' },
        { at: '03-07 18:40', who: '송하늘 (대치1 실장)', what: '엑셀 다운로드', target: '3월 수납 내역', reason: '일일 마감' },
        { at: '03-07 10:02', who: '정본부 (슈퍼관리자)', what: '권한 변경', target: '정산 담당 정책 편집 범위', reason: '사용료 정책만 허용' },
      ],
      pol: {
        'POL-01': { centers: { busan: { value: '18,000원', status: '안', until: '2028-03-31', reason: '테스트베드 특가 6개월' } }, reserved: { date: '11/1', value: '25,000원' }, history: [{ date: '2027-01-20', from: '미정', to: '20,000원 (예시)', by: '정본부', reason: '10/21 회의 타사 회원비 참고', n: 5 }] },
        'POL-06': { groups: { '테스트베드': { value: '가맹비 면제 (안)', status: '안' } } },
        'POL-16': { value: '15명' },
      },
      ui: {},
    };
  };
  // 지금 실제로 청구하는 교습비. 직영은 HQ-10 확정가와 교육청 등록액 가운데 낮은 값이에요(변경신고가 수리되기 전에는 등록액까지만 받아요).
  // 가맹은 센터가 정한 교습비, 없으면 본사 권장가예요. CT-06, CT-07, CT-08, PA-01이 같은 값을 쓰게 여기 한 곳에 둬요.
  B.feeNow = function (s, centerId, pid) {
    const p = (s.products || []).find(x => x.id === pid); if (!p) return 0;
    const c = (s.centers || []).find(x => x.id === centerId) || {};
    if (c.type !== '직영') return (p.centerPrice || {})[c.id] || p.recommend;
    const k = 't_' + p.perWeek + '_' + p.minutes, H = s.hq10 || {};
    const base = (H.vals && H.vals.base) || {}, fee = typeof base[k] === 'number' ? base[k] : p.direct;
    const r = H.edu && H.edu[c.id] && H.edu[c.id][k];
    const edu = r ? r.amt : (p.edu || {})[c.id];
    return edu != null && edu < fee ? edu : fee;
  };
  // decisions from the review (부록 A 10가지 + 검토 의견)
  B.extend(s => {
    s.decisions = (B.REVIEW.decisions || []).map(d => ({ no: d.no, topic: d.topic, owner: d.owner, deadline: d.deadline, policies: d.policies, status: d.no === 1 ? '결정' : '미결', decided: d.no === 1 ? '학원 (2026-11-10)' : '' }));
  });
})();
