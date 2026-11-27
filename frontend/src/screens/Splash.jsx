import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BrandMark from "../components/BrandMark.jsx";

/* 스플래시 — 금융·투자의 무게감을 담은 첫 화면.
   일정 시간(약 2.8초) 후 로그인 화면으로 전환. 탭하면 즉시 스킵. */
export default function Splash() {
  const navigate = useNavigate();
  const [exiting, setExiting] = useState(false);

  const go = () => {
    if (exiting) return;
    setExiting(true);
    setTimeout(() => navigate("/login", { replace: true }), 420);
  };

  useEffect(() => {
    const t = setTimeout(go, 2800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={"splash" + (exiting ? " out" : "")} onClick={go}>
      {/* 배경 — 시세 그리드 */}
      <svg className="splash-bg" viewBox="0 0 402 874" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {/* 그리드 */}
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={"h" + i} x1="0" y1={90 + i * 90} x2="402" y2={90 + i * 90} stroke="#1b2530" strokeWidth="1" />
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <line key={"v" + i} x1={i * 100} y1="0" x2={i * 100} y2="874" stroke="#161e27" strokeWidth="1" />
        ))}
      </svg>

      <div className="splash-glow" />

      <div className="splash-core">
        <div className="splash-mark"><BrandMark size={40} /></div>
        <div className="splash-eyebrow">Global Unlisted Investment Deal Platform</div>
        <h1 className="splash-title">PLUS<br /><span>Barbell</span></h1>
        <p className="splash-slogan">해외비상장 Private Deal 투자 플랫폼</p>
      </div>

      <div className="splash-foot">
        <div className="splash-bar"><i /></div>
        <span>검증된 글로벌 비상장 기업 투자 기회를 제공합니다</span>
      </div>
    </div>
  );
}
