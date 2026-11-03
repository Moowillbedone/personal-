#!/usr/bin/env python3
"""Generate src/data-gen.js from the reviewed spec data (policies, screens, review)."""
import json, sys
from pathlib import Path
SP = Path(sys.argv[1])  # scratchpad out dir
OUT = Path(__file__).parent / 'src' / 'data-gen.js'
P = lambda *a: a
POL = [
 # code, cat, name, now, status, direct, franchise, decider, when, screens
 ('POL-01','A','학생 1인당 월 시스템 사용료','미정 (화면 예시 20,000원)','미정','내부 대체','불가','대표·경영지원','P1b 계약서 확정 전','CT-15,HQ-04,HQ-08,HQ-16'),
 ('POL-02','A','사용료 과금 기준','학습 계정 활성 수 (권장)','미정','통계만','불가','경영지원·IT','P1b','CT-06,CT-08,CT-15,HQ-01,HQ-06,HQ-08,HQ-16,HQ-17'),
 ('POL-03','A','월중 등록·퇴원 시 사용료','등록 전액, 퇴원 반환 없음 (안)','안','-','불가','경영지원','P1b','CT-15,HQ-08,HQ-12,HQ-17'),
 ('POL-04','A','사용료 청구 방식·청구일·납부기한','후불, 5일 청구, 15일 기한 (예시)','예시','-','불가','경영지원','P1b','CT-15,HQ-05,HQ-06,HQ-08,HQ-16'),
 ('POL-05','A','사용료 연체 단계','미정','미정','-','불가','경영지원·법무','P1b','CT-15,HQ-08,HQ-16'),
 ('POL-06','B','가맹금 항목표','가맹비 500만 원 (안)','안','해당 없음','불가','대표·경영지원','P1b','HQ-01,HQ-03,HQ-05,HQ-09,HQ-17'),
 ('POL-07','B','계약 기간·갱신 조건','미정','미정','해당 없음','불가','경영지원·법무','P1b','HQ-01,HQ-03,HQ-04,HQ-05,HQ-09,HQ-25,HQ-26'),
 ('POL-08','B','영업지역 기준','미정','미정','중첩 검사 대상','불가','대표·경영지원','P1b','HQ-02,HQ-03,HQ-05,HQ-09'),
 ('POL-09','B','필수품목·공급가 산정 방식','미정','미정','내부 공급','불가','경영지원','P1b','CT-16,HQ-09,HQ-17,HQ-19'),
 ('POL-10','C','교습 상품 템플릿','주 2회, 90분 (예시)','예시','본사 확정','템플릿 선택·추가','연구소·경영지원','P1a','CT-07,CT-11,CT-18,HQ-10'),
 ('POL-11','C','권장 교습비·이탈 처리','미정','미정','본사 확정가','자유 (경고·사유)','대표·경영지원','P1a 직영 / P1b 가맹','CT-07,CT-18,HQ-10,HQ-23,HQ-24'),
 ('POL-12','C','교육청 등록 교습비','센터 입력 필수','법정','입력','입력','법정','P1a','CT-01,CT-07,CT-18,CT-23,CT-24,HQ-01,HQ-06,HQ-10,HQ-23,HQ-24'),
 ('POL-13','C','할인 유형·사유 기록','형제, 장기, 프로모션 (예시)','예시','본사 정함','가능','경영지원','P1a','CT-07,CT-18,HQ-10'),
 ('POL-14','C','기타경비(교재비 등) 청구','미정','미정','본사 정함','가능 (실비)','경영지원','P1a','CT-06,CT-07,CT-10,CT-16,CT-18,HQ-09,HQ-10,HQ-12,HQ-19'),
 ('POL-15','D','허용 시설 유형·법정 정원','학원 (안)','안','불가','불가','대표·경영지원','P1a','CT-11,CT-19,CT-20,HQ-04,HQ-05,HQ-11,HQ-23,HQ-24'),
 ('POL-16','D','타임당 정원·교사 배치 기준','15명 (안)','안','본사','상한 안에서 가능','연구소','P1a','CT-01,CT-07,CT-11,CT-21,CT-22,HQ-04,HQ-05,HQ-11'),
 ('POL-17','D','시·도 교습시간 상한','지역별 값','법정','불가','불가','법정','P1a','CT-11,CT-19,HQ-05,HQ-11,HQ-23,HQ-24'),
 ('POL-18','D','등록 단위','월 단위 (안)','안','불가','불가','경영지원','P1a','CT-07,CT-08,HQ-11'),
 ('POL-19','D','월중 등록 교습비 처리','미정','미정','본사','선택 (게시 교습비와 일치)','경영지원','P1a','CT-07,CT-18,HQ-11'),
 ('POL-20','D','4·5주 달과 총 교습시간','미정','미정','본사','선택','경영지원','P1a','CT-08,CT-10,CT-18,CT-19,HQ-11,HQ-12'),
 ('POL-21','D','휴원·이월','미정','미정','본사','가능','경영지원','P1a','CT-06,CT-08,HQ-11'),
 ('POL-22','D','결석·보강','미정','미정','본사','가능','연구소','P1a','CT-06,CT-12,CT-21,CT-22,HQ-11'),
 ('POL-23','D','학습 계정 오픈·정지 조건','미정','미정','불가','불가','경영지원·IT','P1a','CT-04,CT-05,CT-06,CT-07,CT-08,HQ-11,HQ-16,HQ-20'),
 ('POL-24','D','재등록 청구 기간','20일~말일 (안)','안','본사','가능','경영지원','P1a','CT-01,CT-08,HQ-11'),
 ('POL-25','D','환불 규정','법정 기준','법정','법정','상향만','법정','P1a','CT-01,CT-06,CT-10,HQ-01,HQ-12,HQ-25,HQ-26'),
 ('POL-26','E','입학 테스트 검사 버전','미정','미정','불가','불가','연구소','P1a','CT-03,HQ-14,HQ-20,HQ-25,HQ-26'),
 ('POL-27','E','테스트비·상담비·수납 주체','테스트비 5만, 프로모션 3만 (안)','안','본사','가능 (권장가)','대표·경영지원','P1a','CT-02,CT-03,HQ-14'),
 ('POL-28','E','등록 시 테스트비 차감','2만 원 (안)','안','본사','가능','경영지원','P1a','CT-03,CT-07,HQ-14'),
 ('POL-29','E','재검사 허용 주기','미정','미정','불가','불가','연구소','P1a','CT-03,CT-13,HQ-13,HQ-14'),
 ('POL-30','E','결과지 전달·주소 보관','현장 출력, 주소 30일 (안)','안','본사','방식 선택, 기간은 단축만','경영지원','P1a','CT-03,CT-19,HQ-14,HQ-20'),
 ('POL-31','E','대상 학년 범위','미정','미정','불가','불가','대표·연구소','P1a','CT-03,HQ-13,HQ-20'),
 ('POL-32','E','레벨 체계','미정','미정','불가','불가','연구소','P1a','CT-13,HQ-13,HQ-20'),
 ('POL-33','E','승급 방식','미정','미정','불가','불가','연구소','P1a','CT-13,HQ-13'),
 ('POL-34','F','알림톡 과금','7원, 선불 충전 (안)','안','내부','불가','경영지원','P1a','CT-01,CT-14,HQ-01,HQ-05,HQ-15,HQ-16,HQ-17,HQ-18,HQ-25,HQ-26'),
 ('POL-35','F','자동 발송 항목','입·퇴실, 수납 켜짐 (예시)','예시','본사','가능','경영지원·IT','P1a','CT-04,CT-05,CT-08,CT-12,CT-14,CT-21,CT-22,HQ-15,HQ-18'),
 ('POL-36','F','결제 연동 방식','직영 결제선생, 가맹 수기 기록 (안)','안','결제선생','불가 (본사 지정)','경영지원·IT','P1a','CT-07,CT-08,CT-09,CT-10,HQ-04,HQ-05,HQ-15,HQ-16'),
 ('POL-37','F','수납 수단','카드, 계좌, 현금, 지역화폐 (예시)','예시','본사','선택','경영지원','P1a','CT-07,CT-09,HQ-05,HQ-15'),
 ('POL-38','F','패드 공급·지정 사양','미정','미정','본사','불가','IT·경영지원','P1a','CT-12,CT-19,HQ-09,HQ-15,HQ-19'),
 ('POL-39','F','입·퇴실 체크 방식','번호 입력 (예시)','예시','본사','선택','IT','P1a','CT-01,CT-12,CT-19,HQ-15'),
 ('POL-40','G','원생 개인정보 보관 기간','미정','미정','본사','단축만','경영지원·법무','P1a','CT-06,CT-23,CT-24,HQ-15,HQ-22,HQ-25,HQ-26'),
 ('POL-41','G','거래 증빙 보관 기간','5년 (법정)','법정','불가','불가','법정','P1a','CT-15,CT-23,CT-24,HQ-15,HQ-17,HQ-22'),
 ('POL-42','G','본사의 원생 정보 열람 범위','기본 마스킹 (안)','안','본사','불가','경영지원·법무','P1a','CM-01,CM-02,CM-03,CT-05,CT-17,HQ-01,HQ-05,HQ-15,HQ-17,HQ-22'),
 ('POL-43','G','동의서·처리방침 버전','v1 (예시)','예시','본사','불가','경영지원·법무','P1a','CT-05,CT-06,HQ-02,HQ-05,HQ-15'),
 ('POL-44','H','센터 유형별 기본 정책 세트','직영 / 가맹 / 테스트베드','안','불가','불가','대표','P1a','CM-03,HQ-03,HQ-04,HQ-05,HQ-07,HQ-08,HQ-09'),
]
CATS = {'A':'본사 과금','B':'가맹금·계약','C':'교습 상품·가격','D':'시설·정원·학사','E':'입학 테스트·레벨','F':'알림톡·결제·기기','G':'개인정보·보관','H':'센터 그룹'}
easy = {}
for n in (13, 14, 15):
    for it in json.load(open(SP / f'pages/p{n:02d}.json'))['items']:
        easy[it['code']] = it['easy']
policies = [dict(code=c, cat=cat, catName=CATS[cat], name=nm, now=now, status=st, direct=d, franchise=f, decider=dec, when=w,
                 screens=sc.split(','), easy=easy.get(c, '')) for (c, cat, nm, now, st, d, f, dec, w, sc) in POL]
# screens: page refs, phase, channel, original title, easy summary
screens = {}
for f in sorted((SP / 'pages').glob('p*.json')):
    d = json.load(open(f))
    if d.get('kind') != '화면':
        continue
    for sid in d['screen_ids']:
        s = screens.setdefault(sid, {'pages': [], 'titles': [], 'phases': [], 'channel': d['channel'], 'summary': []})
        s['pages'].append(d['page']); s['titles'].append(d['title_original']); s['phases'] += d['phase']; s['summary'].append(d['summary'])
imp = json.load(open(SP / 'review/improve.json'))
core = json.load(open(SP / 'review/core.json'))
review = {
  'imps': [{k: i.get(k) for k in ('id','priority','severity','category','title','easy','easy_fix','evidence_pages')} for i in imp['improvements']],
  'top5': imp['top5'],
  'decisions': [{k: d.get(k) for k in ('no','topic','easy','recommendation','owner','deadline','policies')} for d in imp['decisions']],
  'core': {k: core[k] for k in ('one_liner','tldr','background','purpose','benefits','difficulties')},
  'bigPicture': core['big_picture'],
}
js = '/* generated by tools_gen_data.py from the reviewed spec data. Do not edit by hand. */\n'
js += 'B.POLICIES = ' + json.dumps(policies, ensure_ascii=False) + ';\n'
js += 'B.SPEC = ' + json.dumps(screens, ensure_ascii=False) + ';\n'
js += 'B.REVIEW = ' + json.dumps(review, ensure_ascii=False) + ';\n'
OUT.write_text(js, encoding='utf-8')
print('wrote', OUT, len(js), 'policies', len(policies), 'screens', len(screens), 'imps', len(review['imps']))
