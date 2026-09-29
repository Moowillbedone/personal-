# Stock Tracker · 투자 판단 워크스페이스

미국주식의 **데이터 확인 → 후보 검토 → 위험 예산 → 매매 복기**를 연결하는 개인 도구다. 전략의 수익성은 검증 전이며, 자동 주문은 실행하지 않는다.

## 화면

| 경로 | 용도 |
|---|---|
| `/` | 시장 환경·데이터 상태·최대 5개 검토 후보·손실 예산 계산 |
| `/research` | 눌림목 / 200기간선 / 일목 / 섹터를 하나씩 탐색 |
| `/trade` | 종목별 근거·AI 해석·기술 분석·체결 기록 (소유자 전용) |
| `/techview` | 추세선·피보나치 상세 (소유자 전용) |
| `/stats` | 시간 순서 원장 손익과 관측 통계의 분리된 복기 (소유자 전용) |
| `/signals` | 원시 가격·거래량 이벤트. 기존 미검증 기대수익은 숨김 |
| `/methodology` | 데이터 범위·계산 의미·검증의 한계 |

## 아키텍처

GitHub Actions의 Python 워커가 Alpaca 봉과 외부 근거를 수집하고 Supabase에 기록한다. Next.js 15 / React 19 웹이 공개 시장 데이터와 소유자 전용 API를 읽으며 Vercel에서 서비스된다. Gemini는 수집된 근거의 해석에 사용한다. 소유자 API는 서버 service_role로 접근하며, 개인 테이블은 migration 020에서 public 읽기를 차단한다.

Alpaca IEX는 단일 거래소 시세다. historical SIP는 명시적 지연 구간을 사용한다. 원천 시각과 계산/조회 시각을 구분하며, 데이터가 불충분하면 판단과 평가액을 보류한다. 무료/비공식 공급자와 cron은 중단·지연될 수 있다.

## 개발

```sh
cd stock-tracker/apps/web
cp .env.example .env.local
# 환경 변수 입력 (.env.local은 Git 제외)
npm ci
npm run dev
```

UI와 빌드는 외부 자격증명 없이도 실행할 수 있다. 연결되지 않은 시장 데이터는 확인 불가로 표시된다. Node 22.18 이상(24 권장). 워커는 Python 3.12와 `worker/requirements.txt`를 사용한다. 실제 워커 실행은 DB 기록·일부 알림 전송을 수행하므로 테스트 명령과 구분한다.

```sh
npm test
npm run typecheck
npm run build
```

## 검토와 운영

- [전체 구조·발견한 오류·수정·남은 검증](docs/REVIEW-2026-09.md)
- [소유자 접근 보호·migration·운영 반영 순서](docs/RELEASE.md)

기존 DB의 성과 수치는 소급 정정하지 않는다. 수정된 도구가 실전 초과수익을 입증하는 것은 아니다. 수익성 판단은 고정 규칙·시간 분리 검증·비용 반영·모의 운용 기록을 확보한 뒤 한다.
