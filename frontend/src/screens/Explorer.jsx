/* 딜 아카이브 탐색기 — 대분류 › 소분류 › 개별 딜 드릴다운.
   상태는 URL 쿼리(cat, sub, q, grade, region, owner, status, view, sort)에 두어 공유·뒤로가기가 그대로 동작한다. */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../context.jsx";
import { GRADE_IDS, catName, consensus, fmtDate, matchesSearch, metricAverages, scoreToGrade, avg } from "../lib.js";
import { ChartCard, GradeLegend, Radar, TT, Treemap } from "../components/charts.jsx";
import { DealCard, Empty, Grade, Icon, Loading } from "../components/ui.jsx";

const SORTS = {
  score: { name: "평가순", fn: (a, b) => (b.avg_score ?? -1) - (a.avg_score ?? -1) || b.vote_count - a.vote_count },
  recent: { name: "최근 등록순", fn: (a, b) => new Date(b.created_at) - new Date(a.created_at) },
  name: { name: "이름순", fn: (a, b) => a.name.localeCompare(b.name, "ko") },
  no: { name: "번호순", fn: (a, b) => (a.no ?? 1e9) - (b.no ?? 1e9) || a.id - b.id },
};

export default function Explorer() {
  const { meta, deals, users } = useApp();
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const p = Object.fromEntries(sp.entries());
  const set = (patch) => {
    const next = { ...p, ...patch };
    for (const k of Object.keys(next)) if (!next[k]) delete next[k];
    setSp(next, { replace: false });
  };
  const view = p.view || "cards";
  const sort = SORTS[p.sort] ? p.sort : "score";

  // 분류 외 필터를 먼저 적용 → 트리·차트 카운트도 필터를 반영
  const filtered = useMemo(() => (deals || []).filter((d) =>
    matchesSearch(d, p.q) &&
    (!p.grade || (p.grade === "none" ? !consensus(d) : consensus(d) === p.grade)) &&
    (!p.region || d.region === p.region) &&
    (!p.owner || d.owner_name === p.owner) &&
    (!p.status || d.status === p.status)
  ), [deals, p.q, p.grade, p.region, p.owner, p.status]);

  if (!meta || !deals) return <Loading />;

  const cat = meta.categories.find((c) => c.id === p.cat);
  const sub = cat?.subs.find((s) => s.id === p.sub);
  const inScope = filtered.filter((d) => (!cat || d.category === cat.id) && (!sub || d.subcategory === sub.id));
  const list = [...inScope].sort(SORTS[sort].fn);
  const activeFilters = ["q", "grade", "region", "owner", "status"].filter((k) => p[k]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>딜 아카이브</h1>
          <div className="crumbs mt-8" aria-label="분류 경로">
            <button onClick={() => set({ cat: "", sub: "" })} className={!cat ? "cur" : ""}>전체 {filtered.length}</button>
            {cat && <><Icon name="chevron" width={12} /><button onClick={() => set({ sub: "" })} className={!sub ? "cur" : ""}>{cat.name}</button></>}
            {sub && <><Icon name="chevron" width={12} /><span className="cur">{sub.name}</span></>}
          </div>
        </div>
        <div className="actions">
          <div className="seg" role="group" aria-label="보기 방식">
            <button className={view === "cards" ? "on" : ""} onClick={() => set({ view: "" })}>카드</button>
            <button className={view === "table" ? "on" : ""} onClick={() => set({ view: "table" })}>표</button>
          </div>
        </div>
      </div>

      <div className="explorer">
        <CategoryTree meta={meta} deals={filtered} cat={p.cat} sub={p.sub} onPick={(c, s) => set({ cat: c, sub: s })} />

        <div className="grid" style={{ gap: 16, minWidth: 0 }}>
          <div className="filters">
            <input type="search" placeholder="검색" value={p.q || ""} onChange={(e) => set({ q: e.target.value })} aria-label="검색" style={{ width: 200 }} />
            <select value={p.grade || ""} onChange={(e) => set({ grade: e.target.value })} aria-label="합의 등급">
              <option value="">합의 등급 전체</option>
              {GRADE_IDS.map((g) => <option key={g} value={g}>{g}</option>)}
              <option value="none">미평가</option>
            </select>
            <select value={p.region || ""} onChange={(e) => set({ region: e.target.value })} aria-label="지역">
              <option value="">지역 전체</option>
              {meta.regions.map((r) => <option key={r}>{r}</option>)}
            </select>
            <select value={p.owner || ""} onChange={(e) => set({ owner: e.target.value })} aria-label="담당자">
              <option value="">담당자 전체</option>
              {users.map((u) => <option key={u.id}>{u.name}</option>)}
            </select>
            <select value={p.status || ""} onChange={(e) => set({ status: e.target.value })} aria-label="상태">
              <option value="">상태 전체</option>
              {meta.statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={sort} onChange={(e) => set({ sort: e.target.value === "score" ? "" : e.target.value })} aria-label="정렬">
              {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.name}</option>)}
            </select>
            {activeFilters.length > 0 && (
              <button className="btn ghost sm" onClick={() => set(Object.fromEntries(activeFilters.map((k) => [k, ""])))}>필터 초기화</button>
            )}
          </div>

          <DrillViz meta={meta} all={filtered} cat={cat} sub={sub} onPick={(c, s) => set({ cat: c, sub: s })} />

          {list.length === 0 ? (
            <div className="card"><Empty title="조건에 맞는 딜이 없습니다">필터를 줄이거나 다른 분류를 선택해 보세요</Empty></div>
          ) : view === "cards" ? (
            <div className="deal-cards">{list.map((d) => <DealCard key={d.id} deal={d} />)}</div>
          ) : (
            <div className="card table-wrap">
              <table className="dtable">
                <thead>
                  <tr>
                    <th onClick={() => set({ sort: "no" })}>No.</th>
                    <th onClick={() => set({ sort: "name" })}>상품명</th>
                    <th>분류</th><th>담당자</th><th>지역</th>
                    <th onClick={() => set({ sort: "" })}>합의</th><th>담당자 등급</th>
                    <th className="num">투표</th><th className="num">Q&A</th><th>심사일</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((d) => (
                    <tr key={d.id} onClick={() => nav(`/deals/${d.id}`)}>
                      <td className="muted">{d.no ?? "신규"}</td>
                      <td><div className="name">{d.name}</div>{d.status === "review" && <span className="chip accent">심사중</span>}</td>
                      <td><div>{catName(meta, d.category)}</div><div className="muted">{catName(meta, d.category, d.subcategory)}</div></td>
                      <td>{d.owner_name}</td>
                      <td>{d.region || "-"}</td>
                      <td><Grade g={consensus(d)} /></td>
                      <td><Grade g={d.owner_grade} hidden={d.self_hidden} /></td>
                      <td className="num">{d.vote_count}</td>
                      <td className="num">{d.question_count}{d.open_questions ? ` (${d.open_questions})` : ""}</td>
                      <td className="muted">{fmtDate(d.review_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function CategoryTree({ meta, deals, cat, sub, onPick }) {
  const [openSet, setOpenSet] = useState(() => new Set(cat ? [cat] : []));
  const toggle = (id) => setOpenSet((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  // 트리맵·경로 등 트리 밖에서 분류가 바뀌면 해당 대분류를 펼친다 (이후 접기는 사용자가 자유롭게)
  useEffect(() => { if (cat) setOpenSet((s) => (s.has(cat) ? s : new Set(s).add(cat))); }, [cat]);
  // 대분류 행: 다른 분류면 선택하며 펼치고, 이미 선택된 분류를 다시 누르면 접기/펼치기
  const pickCat = (id) => {
    if (cat === id && !sub) return toggle(id);
    onPick(id, "");
    setOpenSet((s) => new Set(s).add(id));
  };
  return (
    <nav className="card tree" aria-label="분류 체계">
      <button className={!cat ? "on" : ""} onClick={() => onPick("", "")}>전체<span className="n">{deals.length}</span></button>
      {meta.categories.map((c) => {
        const n = deals.filter((d) => d.category === c.id).length;
        const isOpen = openSet.has(c.id);
        return (
          <div key={c.id}>
            <button className={cat === c.id && !sub ? "on" : ""} onClick={() => pickCat(c.id)}
              aria-expanded={isOpen}>
              <span className={`caret ${isOpen ? "open" : ""}`} onClick={(e) => { e.stopPropagation(); toggle(c.id); }}><Icon name="chevron" width={14} /></span>
              {c.name}<span className="n">{n}</span>
            </button>
            {/* 항상 렌더링하고 높이만 전환 — 접고 펼 때 부드럽게 움직인다 */}
            <div className={`subs ${isOpen ? "open" : ""}`}>
              <div>
                {c.subs.map((s) => {
                  const sn = deals.filter((d) => d.category === c.id && d.subcategory === s.id).length;
                  return (
                    <button key={s.id} className={`sub ${sub === s.id ? "on" : ""}`} onClick={() => onPick(c.id, s.id)}>
                      {s.name}<span className="n">{sn}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

/* 현재 레벨의 시각화 — 전체: 대분류 트리맵 / 대분류: 소분류 트리맵 + 지표 비교 / 소분류: 지표 비교 */
function DrillViz({ meta, all, cat, sub, onPick }) {
  const groupTile = (key, label, list, onSel) => {
    const s = avg(list.map((d) => d.avg_score).filter((v) => v != null));
    return {
      key, label, value: list.length, grade: scoreToGrade(s), onSel,
      sub: `${list.length}건 · 평균 ${scoreToGrade(s) || "-"}`,
      tooltip: <TT title={label} rows={[["딜 수", `${list.length}건`], ["평균 점수", s ? `${s.toFixed(2)} / 4` : "-"], ["클릭", "하위로 이동"]]} />,
    };
  };

  if (!cat) {
    const items = meta.categories.map((c) => groupTile(c.id, c.name, all.filter((d) => d.category === c.id), () => onPick(c.id, "")));
    return (
      <ChartCard title="대분류" hint="면적 = 딜 수 · 색 = 합의 등급 · 클릭해서 소분류로" legend={<GradeLegend />}>
        <Treemap height={260} items={items} onSelect={(t) => t.onSel()} />
      </ChartCard>
    );
  }

  const catDeals = all.filter((d) => d.category === cat.id);
  const scope = sub ? catDeals.filter((d) => d.subcategory === sub.id) : catDeals;
  const base = sub ? catDeals : all;
  const series = [
    { name: sub ? sub.name : cat.name, values: metricAverages(meta, scope), color: "var(--s1)" },
    { name: sub ? `${cat.name} 평균` : "전체 평균", values: metricAverages(meta, base), color: "var(--s2)" },
  ];
  const radar = (
    <ChartCard title="6대 지표 평균" hint={`${scope.length}건 기준`}
      legend={series.map((s) => <span key={s.name}><i className="line" style={{ background: s.color }} />{s.name}</span>)}
      table={{ columns: ["지표", series[0].name, series[1].name], rows: meta.metrics.map((m) => [m.name, series[0].values[m.id]?.toFixed(1), series[1].values[m.id]?.toFixed(1)]) }}>
      <Radar metrics={meta.metrics} series={series} size={300} />
    </ChartCard>
  );

  if (sub) return <div className="grid g-2">{radar}<SubSummary scope={scope} cat={cat} sub={sub} /></div>;

  const items = cat.subs.map((s) => groupTile(s.id, s.name, catDeals.filter((d) => d.subcategory === s.id), () => onPick(cat.id, s.id)));
  return (
    <div className="grid g-2">
      <ChartCard title={`${cat.name} › 소분류`} hint={cat.desc} legend={<GradeLegend />}>
        <Treemap height={300} items={items} onSelect={(t) => t.onSel()} />
      </ChartCard>
      {radar}
    </div>
  );
}

function SubSummary({ scope, cat, sub }) {
  const nav = useNavigate();
  return (
    <section className="card">
      <div className="card-head"><h3>{sub.name}</h3><span className="hint">{cat.name}</span></div>
      <div className="card-body activity">
        {scope.length === 0 && <Empty title="딜 없음" />}
        {[...scope].sort(SORTS.score.fn).map((d) => (
          <button key={d.id} className="act" style={{ border: 0, borderTop: "1px solid var(--line)", background: "none", textAlign: "left", cursor: "pointer", alignItems: "center" }}
            onClick={() => nav(`/deals/${d.id}`)}>
            <Grade g={consensus(d)} />
            <div style={{ minWidth: 0 }}><div className="ellipsis" style={{ fontWeight: 600 }}>{d.name}</div><div className="muted" style={{ fontSize: 12 }}>{d.owner_name} · {d.region || "-"} · {d.vote_count}표</div></div>
          </button>
        ))}
      </div>
    </section>
  );
}
