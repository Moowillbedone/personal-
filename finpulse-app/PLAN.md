# FinPulse 대규모 업데이트 설계안

## 현재 문제점 분석

### 문제 1: 종목 상세 페이지 로딩 느림
- **원인**: `page.tsx`에서 `Promise.all([fetchCoins(), fetchStocks(), fetchNews()])` → 31개 주식 전부 Google Finance 스크래핑 (2~5초) + 뉴스 10개 RSS (3~8초) 을 기다린 후에야 렌더
- **TradingView iframe 추가 지연**: 외부 iframe 로딩에 추가 2~3초
- **결론**: 해당 종목 1개만 필요한데 31개 전체를 긁어옴 + 무거운 iframe

### 문제 2: 한국 주식(KRX) 차트 미지원
- **원인**: TradingView 임베디드 위젯이 KRX 데이터를 미지원
- **현재**: "TradingView에서 보기" 외부 링크 버튼만 표시 (260px placeholder)

### 문제 3: 핵심 기능(퀀트 투자) 부재
- 앱의 핵심 목표인 자동 매수/매도, 포트폴리오 구성 기능이 없음

---

## 해결 방안

### Step 1. 차트 시스템 교체 (문제 1 + 2 동시 해결)

**TradingView iframe → lightweight-charts + Yahoo Finance 데이터**

- `lightweight-charts` (TradingView 공식 오픈소스 차트 라이브러리) 설치
- Yahoo Finance API로 모든 종목(미국+한국) 히스토리컬 OHLCV 데이터 조회
- 결과: **모든 종목에서 동일한 인터랙티브 차트** + **iframe 대비 10배 빠른 로딩**

**Yahoo Finance 심볼 매핑:**
- 미국: `NVDA`, `AAPL` (그대로)
- 한국: `005930.KS` (KOSPI), `373220.KS` (KOSDAQ도 .KS 사용)
- 크립토: `BTC-USD`, `ETH-USD`

**차트 기능:**
- 캔들스틱 차트 (OHLCV)
- 기간 선택: 1W, 1M, 3M, 6M, 1Y
- 이동평균선 (MA5, MA20, MA60) 오버레이
- 거래량 히스토그램
- RSI 보조지표 (하단)
- 터치/줌 인터랙션

**신규 파일:**
- `/src/components/StockChart.tsx` — lightweight-charts 기반 차트 컴포넌트
- `/src/app/api/chart/[symbol]/route.ts` — Yahoo Finance 프록시 API

### Step 2. 종목 상세 페이지 속도 최적화 (문제 1)

**변경 사항:**
- `page.tsx` 서버 컴포넌트에서 **해당 종목 데이터만** 가져오도록 변경
- 31개 전체 스크래핑 대신 → 개별 종목 1개만 Google Finance 요청
- 뉴스는 캐시된 데이터만 사용 (추가 fetch 없음)
- **React Suspense** 적용으로 차트/뉴스 영역 비동기 로딩
- 가격 정보 → 즉시 표시, 차트 → 클라이언트에서 비동기 로딩

**예상 로딩 시간:** 기존 3~8초 → **0.5~1.5초**

### Step 3. 퀀트 투자 기능 (문제 3 — 대규모)

**하단 네비게이션 변경 (4탭 → 5탭):**
```
홈 | 마켓 | 퀀트(★) | 검색 | 설정
```
- 중앙에 퀀트 탭 배치 (하이라이트 효과, 핵심 기능 강조)

**퀀트 탭 구조:**

#### 3-1. 메인 대시보드 (`/quant`)
- 나의 전략 포트폴리오 요약 (수익률, 자산배분)
- 오늘의 매수/매도 시그널 알림
- 전략별 성과 미니카드

#### 3-2. 전략 라이브러리 (`/quant/strategies`)
- 사전 구축된 퀀트 전략 5가지:
  1. **골든크로스/데드크로스** — MA(5) × MA(20) 교차
  2. **RSI 과매수/과매도** — RSI 30 이하 매수, 70 이상 매도
  3. **볼린저밴드 회귀** — 하단밴드 터치 시 매수, 상단 터치 시 매도
  4. **모멘텀 순위** — 최근 N일 수익률 상위 종목 매수
  5. **듀얼 모멘텀** — 절대/상대 모멘텀 결합

- 각 전략 카드: 설명, 최근 수익률, 승률, MDD 표시

#### 3-3. 전략 상세 + 백테스트 (`/quant/strategies/[id]`)
- 전략 파라미터 설정 (예: MA 기간, RSI 임계값)
- **백테스트 엔진**: Yahoo Finance 히스토리컬 데이터 기반
  - 기간: 1Y, 3Y, 5Y
  - 결과: 누적 수익률 차트, CAGR, MDD, 샤프비율, 승률
  - 벤치마크 비교 (KOSPI / S&P500 대비)
- 매수/매도 시점 차트에 마커 표시

#### 3-4. 포트폴리오 (`/quant/portfolio`)
- **모의 투자 (Paper Trading)**
  - 초기 자본금 설정 (기본 1억원)
  - 전략 적용 시 자동으로 포지션 생성
  - 실시간 수익/손실 추적
- 보유 종목 리스트 (종목, 수량, 평균단가, 현재가, 수익률)
- 자산 배분 파이차트
- 거래 내역 (매수/매도 히스토리)

#### 3-5. 시그널 (`/quant/signals`)
- 현재 활성 전략에서 발생한 매수/매도 시그널
- 종목별 시그널 강도 (매수강도: 강/중/약)
- 실시간 업데이트 (RSS 데이터 + 가격 기반)

**신규 파일:**
```
/src/app/quant/
├── page.tsx              — 퀀트 메인 대시보드 (서버)
├── QuantClient.tsx       — 대시보드 클라이언트
├── strategies/
│   ├── page.tsx          — 전략 라이브러리
│   └── [id]/
│       └── page.tsx      — 전략 상세 + 백테스트
├── portfolio/
│   └── page.tsx          — 포트폴리오 관리
└── signals/
    └── page.tsx          — 매매 시그널

/src/lib/
├── quant.ts              — 퀀트 전략 엔진 (MA, RSI, BB 계산)
├── backtest.ts           — 백테스트 엔진
└── portfolio-store.ts    — 포트폴리오 로컬 스토리지
```

---

## 구현 순서 (총 3단계)

### Phase A: 차트 교체 + 속도 최적화
1. `npm install lightweight-charts` 설치
2. `/src/app/api/chart/[symbol]/route.ts` — Yahoo Finance 프록시 API 생성
3. `/src/components/StockChart.tsx` — 새 차트 컴포넌트 (캔들, MA, 볼륨, RSI)
4. `StockDetailClient.tsx` — TradingView → StockChart 교체
5. `page.tsx` (stock detail) — 전체 fetch 대신 개별 종목만 fetch
6. 빌드 & 배포 & 검증

### Phase B: 하단 네비 변경 + 퀀트 기초
7. `BottomNav.tsx` — 5탭으로 변경 (퀀트 탭 추가)
8. `/src/lib/quant.ts` — 기술적 지표 계산 (MA, RSI, BB, 모멘텀)
9. `/src/lib/backtest.ts` — 백테스트 엔진
10. `/src/app/quant/page.tsx` — 퀀트 메인 대시보드
11. `/src/app/quant/strategies/page.tsx` — 전략 라이브러리

### Phase C: 전략 상세 + 포트폴리오
12. `/src/app/quant/strategies/[id]/page.tsx` — 백테스트 UI
13. `/src/lib/portfolio-store.ts` — 포트폴리오 스토리지
14. `/src/app/quant/portfolio/page.tsx` — 포트폴리오 관리
15. `/src/app/quant/signals/page.tsx` — 시그널 대시보드
16. 최종 빌드 & 배포 & 전체 테스트
