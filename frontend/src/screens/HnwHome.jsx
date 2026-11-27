import { useNavigate } from "react-router-dom";
import { DB } from "../data.js";
import { manwon, valuationTrack, evalByBasis } from "../utils.js";
import { useApp } from "../context/AppContext.jsx";
import { Donut } from "../components/Charts.jsx";

/* "홈" 탭 — 인사말 + 내 포트폴리오 요약 카드 + 글로벌 투자 시의성 뉴스.
   요약 카드의 총액·수익률은 포트폴리오 화면(HnwPortfolio.jsx)과 동일한
   밸류에이션 로직(utils.js의 valuationTrack/evalByBasis, "확정 라운드" 기준)을 그대로 재사용해
   두 화면의 숫자가 항상 일치하도록 한다. */
export default function HnwHome() {
  const navigate = useNavigate();
  const { auth, hnwHoldings } = useApp();
  const name = auth.user?.name || auth.user?.nickname || "고객";

  const rows = hnwHoldings
    .map((h) => ({ ...h, deal: DB.hnwDeals.find((d) => d.id === h.dealId) }))
    .filter((r) => r.deal)
    .map((r) => {
      const ev = evalByBasis(valuationTrack(r.deal), r.amount, "confirmed");
      return { ...r, current: ev.value, pct: ev.pct };
    });

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const totalNow = rows.reduce((s, r) => s + r.current, 0);
  const totalGain = totalNow - total;
  const totalPct = total > 0 ? (totalGain / total) * 100 : 0;

  const segments = rows.map((r) => ({ v: r.current, c: r.deal.accent }));

  return (
    <>
      <div className="row between" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{name}</div>
        <span className="hnw-bell">🔔</span>
      </div>

      <button className="card hnw-home-summary" onClick={() => navigate("/hnw/portfolio")}>
        <div className="row between">
          <div>
            <div className="tiny">내 포트폴리오</div>
            {rows.length > 0 ? (
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{manwon(totalNow)}</div>
            ) : (
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, color: "var(--txt-2)" }}>아직 투자한 SPV가 없어요</div>
            )}
          </div>
          <div className="row" style={{ gap: 10 }}>
            {rows.length > 0 && (
              <span style={{ color: totalPct >= 0 ? "var(--green)" : "var(--red)", fontWeight: 700, fontSize: 15 }}>
                {totalPct >= 0 ? "+" : ""}{totalPct.toFixed(1)}%
              </span>
            )}
            <span className="ut-caret" style={{ marginLeft: 0 }}>›</span>
          </div>
        </div>

        {rows.length > 0 && (
          <>
            <div className="divider" />
            <div className="row" style={{ alignItems: "center", gap: 46, margin: "12px 0 2px" }}>
              <Donut segments={segments} size={130} thickness={15} center={{ top: manwon(totalNow), bottom: "평가액" }} />
              <div className="legend" style={{ flex: 1, minWidth: 0 }}>
                {rows.map((r) => (
                  <div className="row" key={r.idx}>
                    <span className="sw" style={{ background: r.deal.accent }} />
                    {r.deal.name}
                    <span className="row-nums">
                      <span className="pct" style={{ color: r.pct >= 0 ? "var(--green)" : "var(--red)" }}>
                        {r.pct >= 0 ? "+" : ""}{r.pct.toFixed(1)}%
                      </span>
                      <span className="amt">{manwon(r.current)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </button>

      <div className="view-head mt-24">
        <div className="view-eyebrow">TODAY · 글로벌 투자 소식</div>
        <div className="view-title" style={{ fontSize: 19 }}>지금 알아두면 좋은 소식</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {DB.hnwNews.map((n, i) => (
          <div className="card" key={i}>
            <div className="row between">
              <span className="tiny">{n.tag}</span>
              <span className="tiny">{n.when}</span>
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 6 }}>{n.title}</div>
          </div>
        ))}
      </div>
    </>
  );
}
