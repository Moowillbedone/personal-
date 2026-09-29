# 운영 반영 순서

이 변경은 코드 검토·로컬 테스트를 위한 브랜치다. 프로덕션 배포, 운영 DB migration, 과거 성과의 재계산은 별도 실행 단계다.

1. **기존 운영 상태와 원장을 백업한다.** 수집 워커의 마지막 정상 시각과 데이터 수를 기록한다.
2. Vercel 서버 환경에 `STOCK_TRACKER_OWNER_USER`(기본 owner), `STOCK_TRACKER_OWNER_PASSWORD`(고유한 ASCII 20자 이상)를 설정한다. GitHub 저장소 Secrets에도 같은 이름·값을 설정해 AI 스캔과 마감 리포트 워커가 개인 API에 인증하도록 한다. 사용자명을 생략하면 양쪽 모두 owner를 사용한다. `FRONT_URL`은 해당 Vercel HTTPS 주소와 일치해야 한다. 비밀번호를 NEXT_PUBLIC 변수나 Git에 넣지 않는다. 미설정 프로덕션은 개인 화면/API를 503으로 잠그고, 워커는 인증 누락 시 요청·알림 없이 실패한다. localhost의 개발 서버만 미설정 접근을 허용한다.
3. Supabase migration `019_pullback_source_timestamp.sql`과 `020_private_owner_data.sql`을 검토 후 순서대로 적용한다. 019는 컬럼 추가, 020은 개인 테이블의 anon/authenticated 접근 철회다. 원장 데이터 삭제는 없다. server/worker의 service_role 권한은 유지한다.
4. 웹과 워커를 같은 변경 버전으로 반영한다. pullback-intraday 작업을 실행해 실제 `pullback_bar_at`이 기록되는지 확인한다. 소스 시각 없는 기존 데이터는 홈 후보에서 빠지는 것이 정상이다.
5. 미인증 `/api/trades`, `/api/positions`, `/api/watchlist`가 401인지, 정상 소유자 접근이 되는지, Supabase anon으로 개인 테이블 SELECT가 거절되는지 확인한다. 공개 시장 스캐너는 읽을 수 있어야 한다.
6. 운영 시세의 원천 시각·피드·완료 일봉을 공급자와 대조한다. 미확인·오래된 자료가 정상/매수 후보로 표시되지 않는지 확인한다.
7. 과거 expected/realized 수치는 별도 검증 복사본에서 재계산한다. 방법 버전 없는 기존 결과를 현재 검증 자료로 사용하지 않는다. 본 변경은 기존 값의 자동 덮어쓰기/삭제를 수행하지 않는다.

## 검증 명령

웹(Node 22.18 이상 또는 24):

```sh
cd stock-tracker/apps/web
npm ci
npm test
npm run typecheck
npm run build
```

워커:

```sh
cd stock-tracker/worker
python3 -m unittest discover -s tests -v
```

## 되돌리기

웹/워커는 이전 커밋으로 되돌릴 수 있다. 추가한 nullable 원천시각 컬럼은 남겨도 이전 코드와 호환된다. 개인 테이블 읽기 권한은 보안을 위해 유지하고, 인증이 있는 수정 버전으로 롤백한다. 이전 공개 읽기/인증 없는 매매 API를 복구하지 않는다. 원장을 되돌리거나 삭제하는 작업은 이 배포에 필요하지 않다.
