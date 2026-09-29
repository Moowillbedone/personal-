import Link from "next/link";

export default function MethodologyPage() {
  return (
    <div className="desk methodology">
      <div className="desk-heading">
        <div>
          <p className="eyebrow">EVIDENCE, NOT CERTAINTY</p>
          <h1>이 숫자는 어디까지 믿을 수 있을까.</h1>
          <p className="desk-subtitle">
            관측 사실, 규칙으로 만든 해석, 검증된 성과를 구분합니다.
          </p>
        </div>
      </div>
      <section className="desk-card">
        <h2>판단 데스크를 쓰는 순서</h2>
        <ol>
          <li>
            <strong>데이터부터 확인합니다.</strong> 화면을 불러온 시각과 실제
            시세 시각은 다릅니다. 기준 시각이 없거나 오래된 후보는 제외합니다.
          </li>
          <li>
            <strong>조건이 맞는 종목만 검토합니다.</strong> 15분봉
            추세·거래량·구조·지지·확인 모두 통과한 최신 후보만 최대 5개
            표시합니다. 종목명 순서이며 같은 섹터는 최대 2개입니다. 45분 기준과
            목록 제한은 화면 운영 규칙이며, 수익률을 높인다고 검증된 임계값이
            아닙니다.
          </li>
          <li>
            <strong>반대 근거를 찾습니다.</strong> 실적 발표 일정, 변동성,
            유동성, 기존 보유 종목과의 중복을 따로 확인합니다. 이 항목들은
            자동으로 검증되지 않습니다.
          </li>
          <li>
            <strong>손절 기준으로 수량을 계산합니다.</strong> 실제 거래할 상품의
            진입가·무효화 가격·목표가를 입력합니다. 계좌의 위험 한도와 투자금
            한도 중 작은 수량을 사용합니다.
          </li>
          <li>
            <strong>결과를 기록합니다.</strong> 진입 근거, 예정 손절, 실제 체결,
            수수료, 계획 준수 여부를 기록하고 모의 매매와 실전을 분리해
            복기합니다.
          </li>
        </ol>
      </section>
      <section className="desk-card">
        <h2>데이터의 의미와 빈틈</h2>
        <p>
          Alpaca IEX 가격은 한 거래소의 체결이며 전체 시장의 최우선 호가가
          아닙니다. SIP 지연 봉은 장중 즉시 체결 판단에 적합하지 않습니다. FRED
          VIX는 일별 관측치입니다. 데이터가 없으면 0이나 정상 상태로 대체하지
          않습니다.
        </p>
        <p className="mt-3">
          시장 환경은 QQQ 이동평균과 VIX에 대한 규칙입니다. 전체 미국 시장을
          대표하거나 다음 수익률을 예측하지 않습니다.
          200일선·일목·추세선·피보나치 터치는 관찰 조건입니다. 섹터 강세는 구성
          종목의 평균 가격 변화이며 실제 자금 유입을 측정한 값이 아닙니다.
        </p>
        <p className="mt-3">
          AI 점수는 모델의 자기 평가입니다. 검증된 승률이나 투자 비중으로
          변환하지 않습니다. 뉴스와 AI 요약의 원문·게시 시각도 직접 확인해야
          합니다.
        </p>
      </section>
      <section className="desk-card">
        <h2>아직 수익성이 검증된 전략은 아닙니다</h2>
        <p>
          기존 유사 사례 추정은 미래 정보 누출, 반복 표본, 체결 비용의 한계가
          있었습니다. 이전에 저장한 기대수익은 검증된 예측값으로 사용하지
          않습니다. 수정된 계산도 실전 초과수익을 입증하지는 않습니다.
        </p>
        <ol className="mt-4">
          <li>
            규칙을 고정한 뒤 시간 순서로 학습·검증 구간을 나누고, 결과가 확정된
            과거 사례만 사용합니다.
          </li>
          <li>
            종목 구성의 생존 편향, 반복·겹치는 거래, 슬리피지·수수료·스프레드를
            반영해야 합니다.
          </li>
          <li>
            순수익, 평균 손익비, 최대 낙폭, 표본 수, 보유 기간과 동일 기간
            벤치마크를 함께 비교합니다.
          </li>
          <li>
            이후 별도의 모의 운용 기록으로 재확인합니다. 한 번의 좋은
            백테스트만으로 투자 규모를 늘리지 않습니다.
          </li>
        </ol>
      </section>
      <section className="desk-card">
        <h2>실제 손익과 관찰 수익률</h2>
        <p>
          매매 복기의 실현손익은 입력한 매수·매도 기록을 시간 순서대로 계산한
          가중평균 원가 기준입니다. 기록하지 않은 체결·수수료·환율·세금은
          포함되지 않습니다. 추천 연계 가격 변화는 분석 이후 기초자산 가격이
          얼마나 움직였는지를 보는 진단 지표이며 내 계좌의 수익이 아닙니다.
        </p>
        <p className="mt-3">
          레버리지 ETF는 일별 목표 배수를 추구합니다. 며칠간의 수익이 기초자산
          수익의 단순 2배가 되지 않으며, ETF를 거래했다면 그 ETF의 가격으로
          계획과 손익을 계산해야 합니다. 손절 주문은 갭이나 유동성 부족 때
          계획가보다 불리하게 체결될 수 있습니다.
        </p>
        <div className="flex flex-wrap gap-5 mt-4">
          <a
            className="text-link"
            href="https://docs.alpaca.markets/docs/market-data-faq"
            target="_blank"
            rel="noreferrer"
          >
            Alpaca 데이터 설명 ↗
          </a>
          <a
            className="text-link"
            href="https://www.investor.gov/statement-single-stock"
            target="_blank"
            rel="noreferrer"
          >
            SEC 레버리지 ETF 설명 ↗
          </a>
          <a
            className="text-link"
            href="https://www.finra.org/investors/insights/stop-orders-factors-consider-during-volatile-markets"
            target="_blank"
            rel="noreferrer"
          >
            FINRA 손절 주문 설명 ↗
          </a>
        </div>
      </section>
      <Link href="/" className="text-link">
        ← 판단 데스크로 돌아가기
      </Link>
    </div>
  );
}
