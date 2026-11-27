import { useNavigate } from "react-router-dom";
import Chevron from "../components/Chevron.jsx";

/* 개인투자(HNW) 자격 안내 — 전문투자자 요건 설명 */
export default function HnwAbout() {
  const navigate = useNavigate();

  return (
    <div className="onb scroll">
      <div className="onb-inner">
        <button className="onb-back" onClick={() => navigate("/welcome/hnw/intro", { state: { scrollBottom: true } })}><Chevron dir="left" /> 뒤로</button>

        <header className="cs-head">
          <div className="view-eyebrow">INDIVIDUAL · 개인투자자 자격</div>
          <h1 className="cs-title">개인 전문투자자 자격이란</h1>
        </header>

        <div className="card">
          <p className="muted">
            아래 필수요건과 선택요건(1~3 중 택일)을 모두 충족하는 개인은 전문투자자로 등록하면, 일반 투자자에게는 열리지 않는
            비상장 기업 SPV(특수목적기구) 투자 기회에 접근할 수 있습니다.
          </p>
          <div className="divider" />
          <div className="build-step">
            <div className="req-badge">필수</div>
            <div className="req-detail">
              <h5>금융투자상품 잔고 요건</h5>
              <p>최근 5년 중 1년 이상 금융투자상품<sup>주1</sup> 잔고 5천만 원 이상</p>
            </div>
          </div>
          <div className="build-step">
            <div className="req-badge optional">선택</div>
            <div className="req-detail">
              <h5>선택요건 (1~3 중 택일)</h5>
              <p>1) 순재산 5억 원 이상 (부부합산 필수, 거주 부동산 관련 금액 제외)</p>
              <p className="meta">2) 소득 1억 원 이상 (부부합산 선택 가능, 합산 시 1.5억 원 이상)</p>
              <p className="meta">3) 전문가 자격증<sup>주2</sup> 보유자</p>
            </div>
          </div>
        </div>

        <div className="card mt-16">
          <p className="tiny">
            주1) 금융위원회가 정하여 고시하는 금융투자상품(금융투자업규정 제1-7조의2의2항)<br />
            · 자본시장법 제4조제3항에 따른 사채권(A등급 이하) 및 기업어음증권(A2등급 이하)<br />
            · 자본시장법 제4조제4항에 따른 지분증권<br />
            · 자본시장법 제4조제7항에 따른 파생결합증권<br />
            · 자본시장법 제9조제21항에 따른 집합투자증권(단, 법 제9조 제19항에 따른 사모집합투자기구의 집합투자증권 및 제229조 제1호의 증권집합투자기구의 집합투자증권에 한함)
          </p>
          <p className="tiny mt-8">
            주2) 공인회계사, 감정평가사, 변호사, 변리사, 세무사, 투자자산운용사, 금융투자분석사, 재무위험관리사 限
          </p>
        </div>

        <div className="card mt-16" style={{ background: "var(--panel-2)" }}>
          <div className="status-line"><span className="led a" />PLUS Barbell의 가장 고도화된 전문 금융 역량을 활용, 높은 수익률과 합리적 과세가 가능한 투자 전략을 제안드립니다.</div>
        </div>

        <button className="btn btn-primary btn-block mt-24" onClick={() => navigate("/welcome/hnw/signup")}>자격 확인하러 가기 →</button>
      </div>
    </div>
  );
}
