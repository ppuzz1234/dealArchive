/* 심사 보드 — 신규 등록(심사중) 딜의 투표 진행 · 내 투표 대기 · 미답변 질문 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context.jsx";
import { catName, consensus, fmtDate } from "../lib.js";
import { Empty, Grade, Loading } from "../components/ui.jsx";

export default function Review() {
  const { meta, deals, users, userId } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState("all");
  if (!meta || !deals) return <Loading />;

  const review = deals.filter((d) => d.status === "review");
  const tabs = {
    all: { name: "전체", list: review },
    pending: { name: "내 투표 대기", list: review.filter((d) => userId && !d.my_grade) },
    mine: { name: "내가 올린 딜", list: review.filter((d) => d.owner_id === userId) },
    open: { name: "내 딜 미답변 질문", list: deals.filter((d) => d.open_questions > 0 && (d.owner_id === userId || !userId)) },
  };
  const list = [...tabs[tab].list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const voters = Math.max(1, users.length);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>심사 보드</h1>
          <p className="sub">담당자가 등록한 신규 딜에 A · B+ · B · C로 투표하고, 궁금한 점은 Q&amp;A로 남깁니다</p>
        </div>
        <div className="actions"><Link to="/new" className="btn primary">+ 딜 등록</Link></div>
      </div>

      <div className="seg mb-16" role="tablist">
        {Object.entries(tabs).map(([k, t]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            {t.name} <span className="muted">{t.list.length}</span>
          </button>
        ))}
      </div>

      <section className="card">
        <div className="rv-row head">
          <div>딜</div><div>담당자 등급</div><div>투표 진행</div><div>합의 등급</div><div>내 투표 · Q&amp;A</div>
        </div>
        {list.length === 0 && (
          <Empty title={tab === "pending" ? "투표할 딜이 없습니다" : tab === "open" ? "답변 대기 중인 질문이 없습니다" : "심사중인 딜이 없습니다"}>
            {tab === "all" && <>새로 검토한 딜을 <Link to="/new" style={{ color: "var(--accent-ink)" }}>등록</Link>해 보세요</>}
          </Empty>
        )}
        {list.map((d) => (
          <div key={d.id} className="rv-row" style={{ cursor: "pointer" }} onClick={() => nav(`/deals/${d.id}${tab === "open" ? "#qa" : ""}`)}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }} className="ellipsis">{d.name}</div>
              <div className="muted" style={{ fontSize: 12 }}>{catName(meta, d.category)} › {catName(meta, d.category, d.subcategory)} · {d.owner_name} · {fmtDate(d.created_at)}</div>
            </div>
            <div><Grade g={d.owner_grade} /></div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{d.vote_count} / {voters}명</div>
              <div style={{ height: 8, borderRadius: 99, background: "color-mix(in srgb, var(--s1) 18%, var(--panel-2))" }}
                role="meter" aria-valuemin={0} aria-valuemax={voters} aria-valuenow={d.vote_count} aria-label="투표 진행">
                <div style={{ height: 8, borderRadius: 99, background: "var(--s1)", width: `${Math.min(100, (d.vote_count / voters) * 100)}%` }} />
              </div>
            </div>
            <div className="row"><Grade g={consensus(d)} />{d.avg_score != null && <span className="muted">{d.avg_score.toFixed(1)}</span>}</div>
            <div className="row">
              {d.my_grade ? <Grade g={d.my_grade} title="내 투표" /> : <span className="chip warn">미투표</span>}
              {d.question_count > 0 && <span className={`chip ${d.open_questions ? "warn" : ""}`}>Q {d.question_count}{d.open_questions ? ` · 대기 ${d.open_questions}` : ""}</span>}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
