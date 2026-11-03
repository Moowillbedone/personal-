# 브레인180 관리자 프로토타입 작업 안내서

설계서 v0.1(70쪽)의 화면 53개를 클릭해 볼 수 있는 프로토타입으로 만든다. 왼쪽은 실제처럼 움직이는 관리자 화면이고, 오른쪽은 번호가 붙은 동적 PRD 패널이다. 위쪽 ‹ 이전 · 다음 › 버튼으로 전체 업무 흐름 데모를 넘겨 본다.

## 1. 폴더와 빌드

- `src/core.js` 엔진(등록, 상태, 화면 틀, PRD 패널, 번호 핀, 데모). 화면 작업자는 고치지 않는다.
- `src/ui.js` 부품(`B.h.*`). 고치지 않는다. 필요한 부품은 자기 화면 파일 안에 작은 함수로 만든다.
- `src/data.js` 기본 예시 데이터, `src/data-gen.js` 정책 44개와 화면별 원문 정보와 검토 결과(자동 생성).
- `src/screens/<그룹>.js` 화면 파일. 한 파일에 여러 화면을 넣는다. 반드시 `(function(){ ... })();`로 감싼다.
- `src/manifest/<그룹>.json` 데모 작성자를 위한 화면 요약(아래 7절).
- 기준 예시: `src/screens/ct-02.js` (상담·테스트 예약). 먼저 읽고 같은 방식으로 만든다.
- 빌드: `python3 build.py <출력폴더> --only=내파일.js` (내 파일만 묶어서 시험). 전체 빌드는 `python3 build.py <출력폴더>`.
- 점검: `node tools/check_screens.js <출력폴더>/index.html <스크린샷폴더> 화면ID...`
  모든 줄이 `OK`가 될 때까지 고친다. 스크린샷은 Read로 열어 눈으로도 확인한다.

## 2. 화면 등록

```js
B.screen({
  id: 'CT-07', side: 'ct',            // 'hq' 본사, 'ct' 센터, 'cm' 공통, 'ks' 키오스크, 'pa' 학부모 휴대폰
  phase: 'P1a',                        // P1a | P1b | P2 (탭마다 다르면 tabs[].phase)
  devices: ['pc', 'tablet'],           // 원문 채널 그대로. 'PC 웹'만이면 ['pc']. 키오스크 ['kiosk'], 학부모 ['mobile']
  pages: [52],                         // 원문 쪽 번호
  title: '수강 등록·수납', menuLabel: '수강 등록·수납', crumb: '수강·수납 > 수강 등록·수납',
  tabs: [{ id: 'a', label: '수강·상태', phase: 'P1a' }, { id: 'b', label: '출결·학습·수납·동의', phase: 'P1a' }], // 선택
  chrome: 'none',                      // 선택: 로그인, 키오스크, 휴대폰처럼 관리자 틀 없이 꽉 차게 그릴 때
  headActions: ctx => h.btn('+ 등록', { primary: true, act: 'CT07.new', pin: 6 }), // 선택: 제목 오른쪽 버튼
  render(ctx) { return '...html...'; },
  mount(root, ctx) { },                // 선택: 꼭 필요할 때만. 대부분은 data-act로 해결된다.
  prd: { summary: '...', who: '...', items: [ ... ], open: [ ... ], rules: [ ... ] },
});
```

`ctx`에 들어 있는 것: `s`(전체 데이터), `ui`(이 화면 전용 임시 상태, `s.ui[화면ID]`), `persona`, `side`, `role`, `centerId`, `center`, `tab`, `h`(부품), `perm`(● ◐ ○ –), `canEdit`, `readOnly`, `partial`, `today`.

## 3. 움직임 (동적 동작)

- 버튼과 행에 `data-act="CT07.pay" data-arg="s3"`를 단다. `B.action('CT07.pay', (ctx, arg, el) => { ... })`로 등록한다. 동작이 끝나면 엔진이 화면을 다시 그린다. 다시 그리지 않으려면 `return false`.
- 동작 이름은 `화면ID에서 하이픈을 뺀 것.동사` 형식(`HQ03.unlock`, `CT05.register`). 다른 화면과 겹치지 않게 한다.
- 입력 칸에는 `data-field="키"`를 단다(`h.field({ field: 'f_name' })`). 사용자가 입력하면 `ctx.ui[키]`에 자동 저장되므로 render에서 `value: ctx.ui.f_name`으로 다시 그린다.
- 화면 이동은 `data-go="CT-05"`(탭은 `data-go-tab`) 또는 동작 안에서 `B.go('CT-05'); return false;`.
- 다른 화면에 값을 넘길 때는 `ctx.s.ui['CT-05'] = Object.assign(ctx.s.ui['CT-05'] || {}, { name: '...' })` 다음 `B.go`.
- 데모가 같은 동작을 부를 수 있어야 한다. 동작은 `el`이 없어도 돌아가야 하고, `arg`로 객체를 받아도 처리해야 한다(예: `CT02.save`는 `arg`가 객체면 폼 값으로 쓴다).
- 알림은 `B.toast('...')`, 확인 창은 `B.modal({ title, body, ok, onOk })`. `alert()`, `confirm()`, `prompt()`, `localStorage`, 외부 스크립트, `fetch`는 쓰지 않는다.
- 권한: `ctx.canEdit`가 거짓이면 저장 버튼을 `disabled`로 그린다. 보기 전용 안내 띠와 메뉴 숨김은 엔진이 한다.

## 4. 데이터

- 기본 데이터는 `src/data.js`를 읽어 본다(centers, staff, classes, products, extraFees, students, reservations, payments, invoices, alim, notices, inquiries, orders, leads, gate, decisions, audit, pol).
- 더 필요하면 `B.extend(s => { s.ct07 = s.ct07 || {...}; })`처럼 화면 이름을 딴 새 키로 더한다. 남의 키를 지우거나 모양을 바꾸지 않는다. 기존 배열에 예시 행을 더하는 것은 괜찮다.
- 오늘은 2027-03-08(월)이다. P1b, P2 화면은 원문처럼 2027년 9~10월 예시 날짜를 써도 된다.
- 센터: daechi1 대치1(직영, 학원), mokdong 목동(직영), bundang 분당(직영), daegu 대구수성(가맹), busan 부산해운대(테스트베드, 교습소, 정원 9), incheon 인천송도(가맹, 계획). 재원생 합계 412명.
- 정책 값은 `h.pv('POL-16', ctx.center)`로 보여 준다(센터 값, 그룹 값, 본사 기본값 순서로 찾고 (안), 예시, 미정 표시와 예약 변경을 붙인다). 정책 칩은 `h.polChip('POL-16')`.
- 정책 편집 화면(HQ-08~15)은 공통 패턴 `h.policyEditor('POL-01', ctx, { pins: { scope: 1, value: 2, when: 3, reason: 4, impact: 5, save: 6, history: 7 } })`을 쓴다.

## 5. 번호 핀과 PRD

- 원문 와이어프레임의 Description 번호(①②③…)를 그대로 1, 2, 3…으로 쓴다. 그 위치의 요소에 `h.card({ pin: 1 })`, `h.field({ pin: 2 })`, `h.btn('...', { pin: 3 })`처럼 넣거나 감싸는 div에 `data-pin="4"`를 단다.
- 핀은 div, section, button, label, span 같은 감싸는 요소에만 단다. `input`, `tr`, `td`, `table`, `select`에는 달지 않는다(표는 `h.table({ pin })`이 감싸는 div에 단다).
- 검토 결과를 반영해 새로 넣은 기능은 원문 번호 다음 번호를 이어 쓰고 PRD 항목에 `kind: 'review', imp: 'IMP-xx'`를 넣는다. 보라색 핀으로 보인다.
- 특정 상태에서만 보이는 핀은 PRD 항목에 `cond: true`와 `reveal: '동작이름', revealArg: ...`를 넣는다. 카드를 누르면 그 상태를 열어 위치를 보여 준다. 탭 전용이면 `tab: '탭id'`.
- PRD 항목: `{ n, t: '짧은 제목', d: '쉬운 설명 1~3문장', pol: ['POL-23'], ref: 'p.52 ②', kind, imp }`.
- `summary` 한 줄 목적, `who` 누가 쓰고 누가 보기만 하는지(7쪽 권한표 기준), `open` 아직 안 정해진 것, `rules` 지켜야 할 법·규칙(선택).
- 한 화면에 PRD 항목은 원문 번호 수 + 검토 반영 1~4개. 모든 PRD 항목은 화면에 같은 번호 핀이 있어야 하고, 모든 핀은 PRD 항목이 있어야 한다.

## 6. 글쓰기 (의뢰인 요청, 꼭 지킨다)

- 화면 문구는 실제 관리자 서비스처럼 짧고 분명하게 쓴다. PRD 설명은 초등학생도 이해하게 "~해요"체로 쓴다.
- 줄표(—, –, ㅡ), 화살표(→), 단어 세 개 이상을 가운뎃점(·)으로 잇는 나열, "제목: 설명" 식 콜론, 강조용 따옴표를 쓰지 않는다. '직영·가맹'처럼 굳은 두 단어 짝과 원문 화면 이름은 괜찮다.
- "~함", "~필요", "~부재", "~미비" 같은 명사형 끝맺음, "핵심은", "중요한 점은", "체계적", "효과적" 같은 빈 말을 쓰지 않는다.
- 숫자는 원문 그대로 쓰고 상태를 밝힌다. (안), 예시, 미정, 법정. 원문에 없는 숫자를 지어내지 않는다. 예시로 꼭 필요하면 "(예시)"를 붙인다.
- 이모지는 쓰지 않는다.

## 7. manifest (데모 작성자용)

`src/manifest/<그룹>.json`:
```json
{ "screens": [ { "id": "CT-07", "tabs": ["a"], "pins": [1,2,3,4,5,6], "review_pins": [6],
  "actions": [ { "name": "CT07.pay", "arg": "학생 id 또는 {method:'결제선생 링크'}", "does": "수납을 기록하고 학습 계정을 연다" } ],
  "reads": "ctx.ui.student (학생 id)를 받으면 그 학생으로 시작", "demo_hint": "1월 신규 등록 장면에서 쓰면 좋다" } ] }
```

## 8. 화면 사이 약속 (데모가 이어지도록)

- CT-02 등록 결과에서 CT-05로 `s.ui['CT-05'] = { from, name, grade, phone }`를 넘긴다.
- CT-03은 `s.ui['CT-03'].res`(예약 id)로 시작하고, 결과지 레벨을 `s.ui['CT-05'].level`로 넘긴다.
- CT-05 등록이 끝나면 새 학생 id를 `s.ui['CT-07'].student`로 넘긴다. CT-07 수납이 끝나면 `s.ui['CT-11'].assign`(학생 id)로 반 배정을 이어 간다.
- CT-06, CT-10은 `s.ui[화면].student`(학생 id)로 연다. 없으면 s1(윤서아).
- HQ-05, HQ-06은 `s.ui[화면].center`(센터 id)로 연다. 없으면 daechi1. HQ-17은 `s.ui['HQ-17'].invoice`.
- 본사 지원 모드는 `B.action('core.startSupport')` 대신 CM-02에서 사유를 받고 `B.state.support = 센터id`로 들어간다.

## 9. 검토 반영 (보완점 IMP-01~30)

`src/data-gen.js`의 `B.REVIEW.imps`에 30개가 있다. 내 화면과 관계있는 보완점을 화면 안에 실제 기능으로 넣는다. 예를 들면 이렇다.
- IMP-04 직영 센터 동의서의 처리자를 MSC Brain(본사)으로 바르게 고지 (CT-05)
- IMP-15 같은 시간대 반 인원 합계로 정원 검사 (CT-11)
- IMP-16 경력 조회 전 교직원은 시간표에 배치 못 함 (CT-11, CT-20)
- IMP-10 거래마다 계산에 쓴 정책 버전 저장, (안) 값으로 돈 계산 시 경고 (CT-07, CT-08, CT-10, HQ-07)
- IMP-12 원생 상태 되돌리기(휴원 복귀, 퇴원 취소) (CT-06)
- IMP-13 직영 현장 수납 대사와 현금영수증 확인 (CT-09, HQ-16)
- IMP-01 결정 관리표(마감일, 결정자) (HQ-07, HQ-01)
화면으로 보여 줄 수 없는 보완점(일정, 계약, 문서)은 억지로 넣지 않는다.
