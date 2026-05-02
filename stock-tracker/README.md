# Stock Signal Tracker

NASDAQ + NYSE 시가총액 TOP 100 종목을 5분봉으로 트래킹하다가 갭상승 / 갭하락 / 거래량 급증 시그널이 발생하면 실시간으로 화면에 푸시하는 트래커.

> 데이터는 yfinance(약 15분 지연)를 사용하므로 즉시성이 중요한 초단타용은 아닙니다. 시그널 후보군 발굴 + 백테스트 시드 용도로 적합합니다.

## 아키텍처

```
GitHub Actions cron(매 5분)
   └─ worker/poll.py   ── yfinance batch fetch (200 tickers)
                        ── 갭 / 볼륨 시그널 감지
                        └─ Supabase Postgres (insert)
                                  └─ Realtime channel
                                       └─ Next.js on Vercel (live UI)
```

| 컴포넌트   | 위치          | 호스팅            | 비용 |
|------------|---------------|-------------------|------|
| 프론트     | `apps/web`    | Vercel            | Free |
| DB + Realtime | -          | Supabase (500MB)  | Free |
| 워커(Python)  | `worker`   | GitHub Actions    | Free |
| 데이터 소스   | -          | Yahoo Finance     | Free (15분 지연) |

## 1회성 셋업

### 1) Supabase 프로젝트 만들기

1. https://supabase.com 가입 → New project
2. 프로젝트 생성 후 **Settings → API** 에서 다음 3개 값 확인
   - `Project URL` (예: `https://xxxxx.supabase.co`)
   - `anon` public key
   - `service_role` secret key  ← **절대 클라이언트에 노출 금지**
3. **SQL Editor** 에서 [`supabase/migrations/001_initial.sql`](./supabase/migrations/001_initial.sql) 전체를 붙여넣고 실행
4. **Database → Replication** 에서 `signals` 테이블이 `supabase_realtime` publication 에 들어 있는지 확인 (위 SQL 마지막 줄에서 자동 추가됨)

### 2) GitHub repo Secrets 등록

이 저장소(`Moowillbedone/personal-`) → **Settings → Secrets and variables → Actions → New repository secret** 로 추가:

| Name                          | Value                          |
|-------------------------------|--------------------------------|
| `SUPABASE_URL`                | 위에서 확인한 Project URL      |
| `SUPABASE_SERVICE_ROLE_KEY`   | 위에서 확인한 service_role key |

그 다음 **Actions** 탭에서 두 워크플로를 각각 한 번씩 수동 실행:
1. `stock-tracker / refresh-universe` — 종목 마스터 채우기 (선행 필수)
2. `stock-tracker / poll` — 첫 데이터/시그널 수집

이후로는 cron이 자동 실행.

### 3) Vercel 배포 (프론트)

1. https://vercel.com → Add New → Project → `Moowillbedone/personal-` import
2. **Root Directory** 를 `stock-tracker/apps/web` 로 지정
3. **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon (public) key
4. Deploy

배포가 끝나면 발급된 URL에서 바로 시그널 리스트를 볼 수 있음.

## 로컬 개발

### 워커
```bash
cd stock-tracker/worker
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # 값 채우기
python refresh_universe.py
python poll.py
```

### 프론트 (Node 필요: `brew install node`)
```bash
cd stock-tracker/apps/web
cp .env.example .env.local # 값 채우기
npm install
npm run dev                # http://localhost:3000
```

## 시그널 감지 룰 (Phase 1)

`worker/lib/signals.py` 에서 조정:

| 파라미터         | 기본값 | 의미                                      |
|------------------|--------|-------------------------------------------|
| `GAP_PCT`        | 0.020  | 직전 봉 종가 대비 ±2.0% 이상 변동          |
| `VOL_RATIO`      | 3.0    | 직전 20봉 평균 대비 3배 이상 거래량        |
| `LOOKBACK_BARS`  | 20     | 거래량 평균 산출 윈도우                    |

만족 시 `signal_type` 은:
- `gap_up`        — 가격 임계 충족 + 상승
- `gap_down`      — 가격 임계 충족 + 하락
- `volume_spike`  — 거래량만 충족

## 다음 단계 (Phase 2 / 3 로드맵)

- [ ] **Phase 2**: 시그널 발생 시 텔레그램/디스코드 봇 알림
- [ ] **Phase 3**: 과거 동일 패턴(±10% 매칭) 백테스트로 `expected_1d/3d/5d` 채우기
- [ ] **Phase 3+**: 멀티팩터 필터 (RSI, MACD divergence, 섹터 흐름)
- [ ] **장기**: Alpaca paper trading API 연동 → 자동매매 실험

## 폴더 구조

```
stock-tracker/
├── apps/web/                  # Next.js 15 (App Router)
├── worker/                    # Python 워커
│   ├── refresh_universe.py
│   ├── poll.py
│   └── lib/{db,data,signals}.py
├── supabase/migrations/       # SQL 스키마
├── .github/workflows/         # cron 정의
└── README.md
```

## 주의

- 본 프로젝트는 **연구/취미 목적**입니다. 실제 투자 결정에 사용 시 발생하는 모든 손실은 사용자 책임입니다.
- yfinance 는 비공식 Yahoo Finance scraper 라 갑자기 차단/스로틀될 수 있음. 그 경우 Finnhub free tier (`finnhub-python`) 로 어댑터를 추가하면 됨.
