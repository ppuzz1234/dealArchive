import { useState } from "react";
import { DB } from "../data.js";
import { manwon, valuationTrack, fmtB, gaugeLayout, evalByBasis } from "../utils.js";
import { useApp } from "../context/AppContext.jsx";
import Chevron from "../components/Chevron.jsx";

/* 포트폴리오 여정 — 목록 → 종목 상세(라운드 기준 토글 + 밸류에이션 게이지 + 카탈리스트).
   종목 상세는 별도 라우트가 아니라 이 화면 안의 내부 스테이지로 관리하고,
   카탈리스트 상세는 화면 전환 없이 목록 안에서 아코디언으로 in-place expand 된다. */
export default function HnwPortfolio() {
  const { hnwHoldings } = useApp();

  // 매도 기능 — 우선 주석 처리하고 대신 보유 종목별 밸류에이션·카탈리스트 정보를 노출한다.
  // 재활성화 시 아래 상태/함수와 ExitStage·TaxStage 렌더 분기를 다시 연결하면 된다.
  // const { exitHolding, toast } = useApp();
  // const [target, setTarget] = useState(null);

  const rows = hnwHoldings
    .map((h, idx) => ({ ...h, idx, deal: DB.hnwDeals.find((d) => d.id === h.dealId) }))
    .filter((r) => r.deal);

  // const startExit = (r) => { setTarget(r); setStage("exit"); };
  // const finishExit = () => {
  //   exitHolding(target.idx);
  //   toast({ title: "매도 신청 접수", icon: "✓", body: `${target.deal.name} SPV 지분 매도 신청이 접수되었습니다.` });
  //   setTarget(null);
  //   setStage("list");
  // };

  // if (stage === "exit" && target) {
  //   return <ExitStage r={target} onBack={() => { setTarget(null); setStage("list"); }} onNext={() => setStage("tax")} />;
  // }
  // if (stage === "tax" && target) {
  //   return <TaxStage r={target} onDone={finishExit} />;
  // }

  const [stage, setStage] = useState("list"); // list | detail
  const [detailIdx, setDetailIdx] = useState(null);

  if (stage === "detail" && detailIdx != null) {
    const r = rows.find((x) => x.idx === detailIdx);
    if (r) return <DetailStage r={r} onBack={() => setStage("list")} />;
  }

  return <ListStage rows={rows} onOpen={(idx) => { setDetailIdx(idx); setStage("detail"); }} />;
}

function ValuationGauge({ acquired, confirmed, bandLow, bandHigh, mini = false }) {
  const layout = gaugeLayout({ acquired, confirmed, bandLow, bandHigh });
  return (
    <div className={"val-gauge" + (mini ? " mini" : "")}>
      <div className="val-gauge-fill" style={{ width: layout.fillPct + "%" }} />
      {layout.hasBand && <div className="val-gauge-band" style={{ left: layout.bandStartPct + "%" }} />}
      <div className="val-gauge-buy" style={{ left: layout.buyPct + "%" }} />
    </div>
  );
}

function GaugeLabels({ track, mini = false }) {
  return (
    <div className={"val-gauge-labels" + (mini ? " mini" : "")}>
      <span>취득 {fmtB(track.acquired)}</span>
      <span style={{ color: "var(--mint)", fontWeight: 700 }}>확정 {fmtB(track.confirmed)}</span>
      {track.bandHigh != null ? (
        <span style={{ color: "var(--blue)", fontWeight: 700 }}>밴드 {track.bandLow.toFixed(0)}~{track.bandHigh.toFixed(0)}</span>
      ) : (
        <span>진행 라운드 없음</span>
      )}
    </div>
  );
}

/* ---------------- S12 · 포트폴리오 목록 ---------------- */
function ListStage({ rows, onOpen }) {
  const [basis, setBasis] = useState("confirmed"); // confirmed | band — 목록 전체에 적용되는 평가 기준

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const evals = rows.map((r) => evalByBasis(valuationTrack(r.deal), r.amount, basis));
  const totalNow = evals.reduce((s, e) => s + (e.useBand ? (e.value[0] + e.value[1]) / 2 : e.value), 0);
  const totalGain = totalNow - total;
  const totalPct = total > 0 ? (totalGain / total) * 100 : 0;

  return (
    <>
      <div className="view-head">
        <div className="view-eyebrow">INDIVIDUAL · 내 포트폴리오</div>
        <div className="view-title">내 비상장 포트폴리오</div>
      </div>

      <div className="card glow">
        <div className="card-head">
          <div className="card-title">내 비상장 포트폴리오</div>
          <button
            className="card-tag"
            style={{ cursor: "pointer", border: "none", fontFamily: "inherit" }}
            onClick={() => setBasis((b) => (b === "confirmed" ? "band" : "confirmed"))}
          >
            기준 : {basis === "band" ? "진행중 라운드 (밴드)" : "최근 확정 라운드"} ▾
          </button>
        </div>
        <div style={{ fontSize: 24, fontWeight: 800 }}>{manwon(total ? totalNow : 0)}</div>
        <div className="row" style={{ gap: 14, marginTop: 8, fontSize: 12.5 }}>
          <span className="muted">투자원금 {manwon(total)}</span>
          <span style={{ color: totalPct >= 0 ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
            평가손익 {totalGain >= 0 ? "+" : ""}{manwon(totalGain)} ({totalPct >= 0 ? "+" : ""}{totalPct.toFixed(1)}%)
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card mt-16"><p className="muted">아직 투자한 내역이 없습니다. 딜 홈에서 투자할 곳을 찾아보세요.</p></div>
      ) : (
        <>
          <div className="sorthint tiny muted mt-16">라운드 진행중 종목을 먼저 보여드려요</div>
          {rows.map((r, i) => (
            <PositionCard key={r.idx} r={r} basis={basis} onOpen={() => onOpen(r.idx)} first={i === 0} />
          ))}
        </>
      )}

      <p className="tiny muted mt-8">평가액은 최근 투자유치 밸류에이션 기반 추정치이며, 실제 매각 가능 가격과 다를 수 있습니다.</p>
    </>
  );
}

function PositionCard({ r, basis, onOpen, first }) {
  const { deal, amount } = r;
  const track = valuationTrack(deal);
  const hasBand = track.bandHigh != null;
  const ev = evalByBasis(track, amount, basis);
  const up = ev.useBand ? ev.pct[0] >= 0 : ev.pct >= 0;

  return (
    <div className="poscard" onClick={onOpen} style={{ marginTop: first ? 10 : 10, cursor: "pointer" }}>
      <div className="row" style={{ gap: 9 }}>
        <div className="deal-ic" style={{ width: 32, height: 32, fontSize: 15, background: `color-mix(in srgb, ${deal.accent} 16%, transparent)` }}>{deal.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{deal.name}</div>
          <div className="tiny muted">{deal.sector} · SPV</div>
        </div>
        {hasBand ? (
          <span className="badge-live"><span className="led g" />{deal.tag.split("·").pop().trim()} 진행중</span>
        ) : (
          <span className="card-tag">확정 기준</span>
        )}
      </div>

      <div className="row between" style={{ marginTop: 10, marginBottom: 8, alignItems: "baseline" }}>
        <span className="tiny muted">원금 {manwon(amount)}</span>
        <span>
          <b style={{ fontSize: 15 }}>
            {ev.useBand ? `${manwon(ev.value[0])} ~ ${manwon(ev.value[1])}` : manwon(ev.value)}
          </b>
          <span style={{ marginLeft: 5, fontSize: 11.5, fontWeight: 700, color: up ? "var(--green)" : "var(--red)" }}>
            {ev.useBand
              ? `${ev.pct[0] >= 0 ? "+" : ""}${ev.pct[0].toFixed(1)}%~${ev.pct[1] >= 0 ? "+" : ""}${ev.pct[1].toFixed(1)}%`
              : `${ev.pct >= 0 ? "+" : ""}${ev.pct.toFixed(1)}%`}
          </span>
        </span>
      </div>

      <ValuationGauge {...track} mini />
      <GaugeLabels track={track} mini />
    </div>
  );
}

/* ---------------- S13 · 종목 상세 (라운드 기준 토글 + 카탈리스트) ---------------- */
function DetailStage({ r, onBack }) {
  const { deal, amount } = r;
  const track = valuationTrack(deal);
  const hasBand = track.bandHigh != null;
  const [segBasis, setSegBasis] = useState("confirmed");
  const [catFilter, setCatFilter] = useState("all");
  const [openId, setOpenId] = useState(null);

  const ev = evalByBasis(track, amount, segBasis);
  const up = ev.useBand ? ev.pct[0] >= 0 : ev.pct >= 0;
  const catalysts = deal.catalysts || [];
  const upCount = catalysts.filter((c) => c.tone === "up").length;
  const downCount = catalysts.length - upCount;
  const shown = catalysts.filter((c) => catFilter === "all" || c.tone === catFilter);

  return (
    <>
      <button className="onb-back" onClick={onBack}><Chevron dir="left" /> 포트폴리오</button>

      <div className="row" style={{ gap: 10, marginTop: 10, marginBottom: 16 }}>
        <div className="deal-ic" style={{ width: 38, height: 38, fontSize: 17, background: `color-mix(in srgb, ${deal.accent} 16%, transparent)` }}>{deal.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{deal.name}</div>
          <div className="tiny muted">{deal.sector} · SPV 보유</div>
        </div>
        {hasBand ? (
          <span className="badge-live"><span className="led g" />{deal.tag.split("·").pop().trim()} 진행중</span>
        ) : (
          <span className="card-tag">확정 기준</span>
        )}
      </div>

      <div className="seg">
        <button className={"seg-btn" + (segBasis === "confirmed" ? " on" : "")} onClick={() => setSegBasis("confirmed")}>최근 확정 라운드</button>
        <button
          className={"seg-btn" + (segBasis === "band" ? " on" : "")}
          onClick={() => hasBand && setSegBasis("band")}
          disabled={!hasBand}
          style={!hasBand ? { opacity: .4, cursor: "not-allowed" } : undefined}
        >
          진행중 라운드 (밴드)
        </button>
      </div>

      <div className="card mt-12" style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <div>
          <div className="tiny muted">내 투자원금</div>
          <div style={{ fontSize: 17, fontWeight: 800, marginTop: 4 }}>{manwon(amount)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="tiny muted">추정 평가액 · {segBasis === "band" ? "진행중 밴드" : "확정 라운드"} 기준</div>
          <div style={{ fontSize: 17, fontWeight: 800, marginTop: 4, color: up ? "var(--green)" : "var(--red)" }}>
            {ev.useBand ? `${manwon(ev.value[0])} ~ ${manwon(ev.value[1])}` : manwon(ev.value)}
          </div>
          <div className="tiny" style={{ color: up ? "var(--green)" : "var(--red)", fontWeight: 700, marginTop: 2 }}>
            {ev.useBand
              ? `+${ev.pct[0].toFixed(1)}% ~ +${ev.pct[1].toFixed(1)}%`
              : `${ev.pct >= 0 ? "+" : ""}${ev.pct.toFixed(1)}%`}
          </div>
        </div>
      </div>

      <div className="card-title mt-24">밸류에이션 위치 <span className="tiny muted" style={{ fontWeight: 400 }}>기업가치 · $B</span></div>
      <ValuationGauge {...track} />
      <GaugeLabels track={track} />
      <p className="tiny muted mt-8">
        내 취득가 대비 확정 ×{(track.confirmed / track.acquired).toFixed(2)}
        {hasBand && ` · 진행중 밴드 ×${(track.bandLow / track.acquired).toFixed(1)}~${(track.bandHigh / track.acquired).toFixed(1)}`}
      </p>

      <div className="card-title mt-24">카탈리스트 <span className="tiny muted" style={{ fontWeight: 400 }}>최근 30일 · 호재 {upCount} / 악재 {downCount}</span></div>
      {catalysts.length > 0 && (
        <div className="ratio-bar mt-8">
          <div className="u" style={{ flex: upCount || 0.001 }} />
          <div className="d" style={{ flex: downCount || 0.001 }} />
        </div>
      )}
      <div className="hnw-filter-row mt-8">
        <button className={"hnw-filter-chip" + (catFilter === "all" ? " active" : "")} onClick={() => setCatFilter("all")}>전체</button>
        <button className={"hnw-filter-chip" + (catFilter === "up" ? " active" : "")} onClick={() => setCatFilter("up")}>호재</button>
        <button className={"hnw-filter-chip" + (catFilter === "down" ? " active" : "")} onClick={() => setCatFilter("down")}>악재</button>
      </div>

      <div className="card mt-8 analysis-card">
        {shown.length === 0 && <p className="tiny muted" style={{ padding: "14px 16px" }}>해당하는 카탈리스트가 없어요.</p>}
        {shown.map((c) => (
          <CatalystRow
            key={c.id}
            c={c}
            all={catalysts}
            open={openId === c.id}
            onToggle={() => setOpenId(openId === c.id ? null : c.id)}
          />
        ))}
      </div>

      <p className="tiny muted mt-16">평가액은 추정치이며 실제 매각 가능 가격과 다를 수 있습니다. 호재·악재 분류는 정보 제공 목적이며 투자권유가 아닙니다.</p>
    </>
  );
}

/* 카탈리스트 한 줄 + 탭하면 그 자리에서 펼쳐지는 상세(라우트 이동 없음, 기존 analysis-collapse 아코디언 재사용) */
function CatalystRow({ c, all, open, onToggle }) {
  const { toast } = useApp();
  const counters = (c.counterIds || []).map((id) => all.find((x) => x.id === id)).filter(Boolean);

  return (
    <div className="analysis-sec">
      <button className="analysis-head" onClick={onToggle}>
        <span className={"cat-dir " + c.tone}>{c.tone === "up" ? "↗" : "↘"}</span>
        <span style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{c.title}</div>
          <div className="tiny muted mt-2">
            {c.source} · {c.date} · <b style={{ color: c.tone === "up" ? "var(--green)" : "var(--red)" }}>{c.tone === "up" ? "호재" : "악재"}</b> · {c.tag}
          </div>
        </span>
        <span className={"analysis-caret" + (open ? " open" : "")}><Chevron dir="right" size={12} /></span>
      </button>

      <div className={"analysis-collapse" + (open ? " open" : "")}>
        <div className="analysis-collapse-inner">
          <div className="analysis-body">
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              <span className={"pill " + (c.tone === "up" ? "sr" : "dn")}>{c.tone === "up" ? "▲ 호재" : "▼ 악재"}</span>
              <span className="card-tag">{c.tag}</span>
              <span className="card-tag">영향도 {c.impact}</span>
            </div>

            <div className="analysis-row">
              <b>AI 3줄 요약</b>
              {c.aiSummary.map((s, i) => <p className="tiny mt-4" key={i}>· {s}</p>)}
            </div>

            {counters.length > 0 && (
              <div className="analysis-row">
                <b>함께 볼 반대 신호</b>
                {counters.map((cc) => (
                  <p className="tiny mt-4" key={cc.id}>
                    {cc.tone === "up" ? "↗" : "↘"} {cc.title} <span className="muted">· {cc.source}</span>
                  </p>
                ))}
              </div>
            )}

            <button
              className="btn btn-line btn-block mt-8"
              onClick={() => toast({ title: "데모 안내", icon: "ℹ️", body: "이 데모에서는 원문 기사를 제공하지 않아요." })}
            >
              원문 기사 보기 →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- S14 · 즉시매도 vs 대기 비교 ---------------- */
function ExitStage({ r, onBack, onNext }) {
  const now = Math.round(r.amount * (1 + r.deal.demoReturn / 100));
  const later = Math.round(now * 1.15); // 대기 시 가정치 (확정 아님)

  return (
    <>
      <button className="onb-back" onClick={onBack}><Chevron dir="left" /> 뒤로</button>

      <div className="view-head">
        <div className="view-eyebrow">SPV 지분 매도 · {r.deal.name}</div>
        <div className="view-title">지금 매도할까요, 기다릴까요?</div>
        <div className="view-sub">SPV 지분 매도는 회사 동의 절차가 포함될 수 있어 체결까지 시간이 걸릴 수 있어요.</div>
      </div>

      <div className="grid g-2">
        <div className="metric"><div className="label">지금 매도(세전)</div><div className="value mint">{manwon(now)}</div></div>
        <div className="metric"><div className="label">6개월 대기 시(예상)</div><div className="value" style={{ fontSize: 18 }}>{manwon(later)}</div><div className="delta">확정 아님, 변할 수 있어요</div></div>
      </div>

      <div className="card mt-16" style={{ background: "var(--panel-2)" }}>
        <div className="status-line"><span className="led a" />한 번에 다 팔지 않고 나눠 파는 것도 방법이에요. 매도에는 회사 동의 절차가 포함될 수 있어요.</div>
      </div>

      <button className="btn btn-primary btn-block mt-16" onClick={onNext}>매도 진행하기</button>
    </>
  );
}

/* ---------------- S15 · 세금 정리 ---------------- */
function TaxStage({ r, onDone }) {
  const { toast } = useApp();
  const now = Math.round(r.amount * (1 + r.deal.demoReturn / 100));
  const gain = Math.max(0, now - r.amount);
  const tax = Math.round(gain * 0.22);
  const net = now - tax;

  return (
    <>
      <div className="view-head">
        <div className="view-eyebrow">세금 정리</div>
        <div className="view-title">세금 내역이 정리됐어요</div>
      </div>

      <div className="card">
        <div className="row between" style={{ padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
          <span className="muted" style={{ fontSize: 12.5 }}>매도 차익</span><span>{manwon(gain)}</span>
        </div>
        <div className="row between" style={{ padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
          <span className="muted" style={{ fontSize: 12.5 }}>양도소득세(약 22%)</span><span style={{ color: "var(--red)" }}>-{manwon(tax)}</span>
        </div>
        <div className="row between mt-8">
          <span style={{ fontWeight: 700 }}>세후 수령액</span>
          <span style={{ color: "var(--mint)", fontWeight: 700, fontSize: 17 }}>{manwon(net)}</span>
        </div>
      </div>

      <div className="card mt-16" style={{ background: "var(--panel-2)" }}>
        <div className="status-line"><span className="led a" />이 숫자는 참고용이에요. 실제 신고는 세무사와 확인해 주세요.</div>
      </div>

      <button
        className="btn btn-line btn-block mt-16"
        onClick={() => toast({ title: "세무사 연결 요청 접수", icon: "✓", body: "담당 세무사가 곧 연락드릴 예정이에요." })}
      >
        세무사와 연결하기
      </button>
      <button className="btn btn-primary btn-block mt-8" onClick={onDone}>완료 · 포트폴리오로 돌아가기</button>
    </>
  );
}
