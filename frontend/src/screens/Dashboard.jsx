/* 대시보드 — 아카이브 전체를 한눈에: KPI · 분류 트리맵 · 분류별 등급 분포 · 지표 히트맵 · 지역/담당자 · 최근 활동 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context.jsx";
import { api } from "../api.js";
import { GRADE_IDS, avg, consensus, ddayOf, fmtAgo, fmtDday, fmtMD, gradeVar, metricAverages, parseYmd, scoreToGrade, sourcingNudge, toYmd, upcomingEvent } from "../lib.js";
import { ChartCard, GradeLegend, GradeStackBars, HBars, Heatmap, SeqLegend, TT, Treemap } from "../components/charts.jsx";
import { Avatar, Grade, Loading, Empty } from "../components/ui.jsx";

export default function Dashboard() {
  const { meta, deals, schedule, userId } = useApp();
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
      mix: deals.reduce((m, d) => { m[consensus(d) || "none"] += 1; return m; }, { A: 0, "B+": 0, B: 0, C: 0, none: 0 }),
      aCount: deals.filter((d) => consensus(d) === "A").length,
      pending: userId ? review.filter((d) => !d.my_grade).length : null,
      openQ: deals.reduce((s, d) => s + d.open_questions, 0),
      tbd: deals.filter((d) => !d.vote_count).length,
    };
  }, [meta, deals, userId]);

  if (!view) return <Loading />;
  const nudge = sourcingNudge(schedule, userId);
  const toCat = (id) => nav(`/deals?cat=${id}`);

  return (
    <>
      <div className="page-head dash-head">
        <div>
          <div className="eyebrow">{todayLabel()}</div>
          <h1>딜 아카이브 <em>한눈에 보기</em></h1>
        </div>
        <div className="actions"><Link to="/new" className="btn dark">+ 딜 등록</Link></div>
      </div>

      <RoundStrip schedule={schedule} nudge={nudge} userId={userId} />

      <div className="card kpi-panel">
        <div className="kpi hero">
          <div><div className="label">전체 딜</div><div className="value">{deals.length}<small>건</small></div></div>
          <div>
            <div className="mix" role="img" aria-label={MIX_KEYS.map((k) => `${MIX_LABEL(k)} ${view.mix[k]}건`).join(", ")}>
              {MIX_KEYS.filter((k) => view.mix[k]).map((k) => <i key={k} style={{ flex: view.mix[k], background: mixColor(k) }} />)}
            </div>
            <div className="legend">
              {MIX_KEYS.map((k) => <span key={k}><i style={{ background: mixColor(k) }} />{MIX_LABEL(k)} {view.mix[k]}</span>)}
            </div>
          </div>
        </div>
        <Kpi label="합의 A등급" value={view.aCount} meta="투표 평균 3.5 이상" />
        <Kpi label="심사중" value={view.review.length} meta={<Link to="/review">심사 보드 →</Link>} />
        <Kpi label="내 투표 대기" value={view.pending} meta={!userId ? "담당자 선택 필요" : view.pending ? "심사중 딜 중 미투표" : "모두 투표했습니다"} />
        <Kpi label="미답변 질문" value={view.openQ} meta={view.openQ ? "담당자 답변 대기" : "답변 대기 없음"} />
      </div>

      <div className="grid g-main">
        <ChartCard
          title="분류별 딜 맵" hint="면적 = 딜 수 · 색 = 합의 등급. 타일을 누르면 해당 분류로 이동"
          legend={<GradeLegend />}
          table={{ columns: ["대분류", "딜 수", "평균 점수", "합의 등급"], rows: view.byCat.map((x) => [x.c.name, x.list.length, x.avgScore?.toFixed(2), scoreToGrade(x.avgScore) || "미평가"]) }}
        >
          <Treemap
            height={330}
            onSelect={(t) => toCat(t.key)}
            items={view.byCat.map((x) => ({
              key: x.c.id, label: x.c.name, value: x.list.length, grade: scoreToGrade(x.avgScore),
              sub: `${x.list.length}건 · 평균 ${scoreToGrade(x.avgScore) || "-"}`,
              subShort: scoreToGrade(x.avgScore) ? `평균 ${scoreToGrade(x.avgScore)}` : "미평가",
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
                    <Avatar name={a.user_name} />
                    <div style={{ minWidth: 0 }}>
                      <div className="act-line">
                        <span className="tag">{ACT_KIND[a.kind]}</span>
                        <b>{a.user_name}</b>
                        <Link to={`/deals/${a.deal_id}`} className="ellipsis">{a.deal_name}</Link>
                        {a.kind === "vote" && <Grade g={a.detail} />}
                      </div>
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

const ACT_KIND = { deal: "등록", vote: "투표", question: "질문", answer: "답변" };
const MIX_KEYS = [...GRADE_IDS, "none"];
const MIX_LABEL = (k) => (k === "none" ? "미평가" : k);
const mixColor = (k) => (k === "none" ? "var(--g-none)" : gradeVar(k));
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const todayLabel = () => { const d = new Date(); return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`; };

/* KPI 한 칸 — 0건은 흐리게 해서 볼 것만 눈에 띄게 */
function Kpi({ label, value, meta }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className={`value ${value === 0 ? "zero" : ""}`}>{value ?? "–"}</div>
      <div className="meta">{meta}</div>
    </div>
  );
}

/* 회차 띠 — 다가오는 딜소싱 마감일 · 심사일을 타임라인으로. 마감 D-1·당일에 미등록이면 등록 독려로 강조 */
function RoundStrip({ schedule, nudge, userId }) {
  const sourcing = upcomingEvent(schedule, "sourcing");
  const review = upcomingEvent(schedule, "review");
  if (!sourcing && !review) return null;
  const events = [sourcing && { label: "딜소싱 마감", date: sourcing.date }, review && { label: "심사일", date: review.date }]
    .filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
  const next = events[0];
  const steps = [{ label: "오늘", date: toYmd(new Date()) }, ...events];
  const submitted = sourcing && userId && sourcing.submitted?.includes(userId);
  const title = nudge
    ? `딜소싱 마감이 ${nudge.dday === 0 ? "오늘" : "내일"}(${fmtMD(nudge.date)})입니다`
    : `다음 일정은 ${next.label} ${fmtMD(next.date)}입니다`;
  const desc = nudge
    ? `이번 회차에 아직 등록한 딜이 없습니다. 마감 전에 딜을 등록해 주세요.${nudge.note ? ` ${nudge.note}` : ""}`
    : !sourcing ? "지정된 딜소싱 마감일이 없습니다."
      : submitted ? "이번 회차 딜을 등록했습니다."
        : userId ? "이번 회차에 아직 등록한 딜이 없습니다." : "담당자를 선택하면 내 등록 현황이 표시됩니다.";
  return (
    <div className={`round ${nudge ? "urgent" : ""}`} role={nudge ? "alert" : undefined}>
      <div className="round-lead">
        <div className="round-dday">{fmtDday(ddayOf((nudge || next).date))}</div>
        <div><b>{title}</b><p>{desc}</p></div>
      </div>
      <ol className="round-steps" aria-label="이번 회차 일정">
        {steps.map((s, i) => {
          const d = parseYmd(s.date);
          return (
            <li key={i} className={i > 0 && s.date === next.date && s.label === next.label ? "now" : ""}>
              <i /><b>{s.label}</b><span>{d.getMonth() + 1}.{d.getDate()} {WEEKDAYS[d.getDay()]}</span>
            </li>
          );
        })}
      </ol>
      {nudge && <Link to="/new" className="btn primary">지금 딜 등록</Link>}
    </div>
  );
}
