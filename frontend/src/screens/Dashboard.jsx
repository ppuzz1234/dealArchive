/* 대시보드 — 아카이브 전체를 한눈에: KPI · 분류 트리맵 · 분류별 등급 분포 · 지표 히트맵 · 지역/담당자 · 최근 활동 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context.jsx";
import { api } from "../api.js";
import { avg, consensus, fmtAgo, metricAverages, scoreToGrade } from "../lib.js";
import { ChartCard, GradeLegend, GradeStackBars, HBars, Heatmap, SeqLegend, TT, Treemap } from "../components/charts.jsx";
import { Grade, Loading, Empty } from "../components/ui.jsx";

export default function Dashboard() {
  const { meta, deals, userId } = useApp();
  const nav = useNavigate();
  const [activity, setActivity] = useState([]);
  useEffect(() => { api.activity(12).then(setActivity).catch(() => {}); }, [deals]);

  const view = useMemo(() => {
    if (!meta || !deals) return null;
    const byCat = meta.categories.map((c) => {
      const list = deals.filter((d) => d.category === c.id);
      const scores = list.map((d) => d.avg_score).filter((v) => v != null);
      const counts = { A: 0, "B+": 0, B: 0, C: 0, none: 0 };
      for (const d of list) counts[consensus(d) || "none"] += 1;
      return { c, list, counts, avgScore: avg(scores), metrics: metricAverages(meta, list) };
    }).filter((x) => x.list.length);

    const regions = meta.regions.map((r) => ({ key: r, label: r, value: deals.filter((d) => d.region === r).length })).filter((r) => r.value).sort((a, b) => b.value - a.value);
    const owners = Object.values(deals.reduce((acc, d) => {
      const k = d.owner_name || "미지정";
      acc[k] = acc[k] || { key: k, label: k, value: 0 };
      acc[k].value += 1;
      return acc;
    }, {})).sort((a, b) => b.value - a.value);

    const review = deals.filter((d) => d.status === "review");
    const top = [...deals].filter((d) => d.avg_score != null).sort((a, b) => b.avg_score - a.avg_score || b.vote_count - a.vote_count).slice(0, 6);
    return {
      byCat, regions, owners, review, top,
      aCount: deals.filter((d) => consensus(d) === "A").length,
      pending: userId ? review.filter((d) => !d.my_grade).length : null,
      openQ: deals.reduce((s, d) => s + d.open_questions, 0),
      tbd: deals.filter((d) => !d.vote_count).length,
    };
  }, [meta, deals, userId]);

  if (!view) return <Loading />;
  const toCat = (id) => nav(`/deals?cat=${id}`);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>딜 아카이브 대시보드</h1>
          <p className="sub">분류·등급·6대 지표로 본 전체 딜 현황 — 타일이나 막대를 누르면 해당 분류로 들어갑니다</p>
        </div>
        <div className="actions"><Link to="/new" className="btn primary">+ 딜 등록</Link></div>
      </div>

      <div className="kpis">
        <div className="card kpi"><div className="label">전체 딜</div><div className="value">{deals.length}</div><div className="meta">{view.byCat.length}개 대분류 · 미평가 {view.tbd}건</div></div>
        <div className="card kpi"><div className="label">합의 A등급</div><div className="value">{view.aCount}</div><div className="meta">투표 평균 3.5 이상</div></div>
        <div className="card kpi"><div className="label">심사중</div><div className="value">{view.review.length}</div><Link className="meta" to="/review">심사 보드 →</Link></div>
        <div className="card kpi"><div className="label">내 투표 대기</div><div className="value">{view.pending ?? "–"}</div><div className="meta">{userId ? "심사중 딜 중 미투표" : "담당자 선택 필요"}</div></div>
        <div className="card kpi"><div className="label">미답변 질문</div><div className="value">{view.openQ}</div><div className="meta">담당자 답변 대기</div></div>
      </div>

      <div className="grid g-main">
        <ChartCard
          title="분류별 딜 맵" hint="면적 = 딜 수 · 색 = 합의 등급(투표 평균)"
          legend={<GradeLegend />}
          table={{ columns: ["대분류", "딜 수", "평균 점수", "합의 등급"], rows: view.byCat.map((x) => [x.c.name, x.list.length, x.avgScore?.toFixed(2), scoreToGrade(x.avgScore) || "미평가"]) }}
        >
          <Treemap
            height={330}
            onSelect={(t) => toCat(t.key)}
            items={view.byCat.map((x) => ({
              key: x.c.id, label: x.c.name, value: x.list.length, grade: scoreToGrade(x.avgScore),
              sub: `${x.list.length}건 · 평균 ${scoreToGrade(x.avgScore) || "-"}`,
              tooltip: <TT title={x.c.name} rows={[["딜 수", `${x.list.length}건`], ["평균 점수", x.avgScore ? `${x.avgScore.toFixed(2)} / 4` : "-"], ["소분류", `${new Set(x.list.map((d) => d.subcategory)).size}개`]]} />,
            }))}
          />
        </ChartCard>

        <ChartCard
          title="분류별 등급 분포" hint="딜별 합의 등급 기준"
          legend={<GradeLegend />}
          table={{ columns: ["대분류", "A", "B+", "B", "C", "미평가"], rows: view.byCat.map((x) => [x.c.name, x.counts.A, x.counts["B+"], x.counts.B, x.counts.C, x.counts.none]) }}
        >
          <GradeStackBars rows={view.byCat.map((x) => ({ key: x.c.id, label: x.c.name, counts: x.counts }))} onSelect={(r) => toCat(r.key)} />
        </ChartCard>
      </div>

      <div className="grid g-main mt-16">
        <ChartCard
          title="분류 × 6대 지표" hint="분류 내 딜들의 지표 평균(1~5)"
          legend={<SeqLegend />}
          table={{ columns: ["대분류", ...meta.metrics.map((m) => m.name)], rows: view.byCat.map((x) => [x.c.name, ...meta.metrics.map((m) => x.metrics[m.id]?.toFixed(1))]) }}
        >
          <Heatmap cols={meta.metrics} onSelect={(r) => toCat(r.key)}
            rows={view.byCat.map((x) => ({ key: x.c.id, label: x.c.name, values: x.metrics, n: x.list.length }))} />
        </ChartCard>

        <section className="card">
          <div className="card-head"><h3>최근 활동</h3><span className="hint">등록 · 투표 · 질문 · 답변</span></div>
          <div className="card-body">
            {activity.length === 0 ? <Empty title="아직 활동이 없습니다">딜에 투표하거나 질문을 남기면 여기에 표시됩니다</Empty> : (
              <div className="activity">
                {activity.map((a, i) => (
                  <div className="act" key={i}>
                    <div style={{ minWidth: 0 }}>
                      <b>{a.user_name}</b>{" "}
                      {a.kind === "deal" && "님이 딜을 등록했습니다 · "}
                      {a.kind === "vote" && <>님이 <Grade g={a.detail} /> 투표 · </>}
                      {a.kind === "question" && "님이 질문 · "}
                      {a.kind === "answer" && "님이 답변 · "}
                      <Link to={`/deals/${a.deal_id}`}>{a.deal_name}</Link>
                      {(a.kind === "question" || a.kind === "answer") && <div className="muted ellipsis">“{a.detail}”</div>}
                    </div>
                    <span className="t">{fmtAgo(a.at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid g-3 mt-16">
        <ChartCard title="지역별 딜" hint="주요 사례 기준"
          table={{ columns: ["지역", "딜 수"], rows: view.regions.map((r) => [r.label, r.value]) }}>
          <HBars rows={view.regions} onSelect={(r) => nav(`/deals?region=${encodeURIComponent(r.key)}`)} />
        </ChartCard>
        <ChartCard title="담당자별 딜"
          table={{ columns: ["담당자", "딜 수"], rows: view.owners.map((r) => [r.label, r.value]) }}>
          <HBars rows={view.owners} onSelect={(r) => nav(`/deals?owner=${encodeURIComponent(r.key)}`)} />
        </ChartCard>
        <section className="card">
          <div className="card-head"><h3>상위 평가 딜</h3><span className="hint">투표 평균순</span></div>
          <div className="card-body activity">
            {view.top.map((d) => (
              <Link key={d.id} to={`/deals/${d.id}`} className="act" style={{ alignItems: "center" }}>
                <Grade g={consensus(d)} />
                <div style={{ minWidth: 0 }}><div className="ellipsis" style={{ fontWeight: 600 }}>{d.name}</div><div className="muted" style={{ fontSize: 12 }}>{d.owner_name} · {d.vote_count}표</div></div>
                <span className="t">{d.avg_score.toFixed(2)}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
