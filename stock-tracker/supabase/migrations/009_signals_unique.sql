-- 009: signals 테이블에 (symbol, ts) UNIQUE INDEX 추가
--
-- 배경: poll worker가 동시 여러 개 실행될 때 같은 5분 bar에 대해
-- 둘 다 detect → application-level signal_exists() 통과 → 둘 다 insert
-- → 중복 발생. 2026-05-22 시점에 5/22 시그널 801건 중 389건이 중복
-- (48%) 였음. 5/21은 1404건 중 511건 중복 (36%).
--
-- 적용 순서:
--   1. 기존 중복 cleanup 완료 (Python 스크립트로 1586건 삭제, 5/23)
--   2. 이 migration으로 UNIQUE INDEX 생성
--   3. lib/db.py의 insert_signals를 upsert(ignore_duplicates=True)로
--      변경 (동시 race condition시 PostgreSQL이 conflict 잡아서 ignore)
--
-- 검증: INDEX 생성 후 race condition 시 INSERT 두 번째 시도는
-- duplicate key error 대신 silently 무시됨 (upsert ignore_duplicates).
CREATE UNIQUE INDEX IF NOT EXISTS signals_symbol_ts_unique
  ON signals(symbol, ts);
