/* 공용 UI — 아이콘 · 등급 배지 · 딜 카드 · 모달 · 빈 상태 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context.jsx";
import { catName, consensus, gradeClass, fmtDate } from "../lib.js";
import { Radar } from "./charts.jsx";

const P = {
  dash: "M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z",
  archive: "M4 4h16v4H4zM5 8h14v12H5zM10 12h4",
  vote: "M9 11l3 3 8-8M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h11",
  plus: "M12 5v14M5 12h14",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-9 9h18M12 3c2.5 2.5 3.8 5.5 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3Z",
  users: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM22 19v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.3-4.3",
  menu: "M4 6h16M4 12h16M4 18h16",
  chevron: "M9 6l6 6-6 6",
  edit: "M4 20h4L19 9l-4-4L4 16v4Z",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  file: "M14 3H6v18h12V7l-4-4Zm0 0v4h4",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z",
  back: "M15 18l-6-6 6-6",
  link: "M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  msg: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z",
  clip: "M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7",
};

export const Icon = ({ name, ...p }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <path d={P[name]} />
  </svg>
);

export const Grade = ({ g, lg, title }) => (
  <span className={`grade ${gradeClass(g)} ${lg ? "lg" : ""}`} title={title}>{g || "TBD"}</span>
);

export const Avatar = ({ name }) => <span className="avatar" aria-hidden="true">{(name || "?").slice(-2)}</span>;

export function DealCard({ deal }) {
  const { meta } = useApp();
  const cg = consensus(deal);
  return (
    <Link to={`/deals/${deal.id}`} className="card deal-card">
      <div className="top">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="path">{catName(meta, deal.category)} › {catName(meta, deal.category, deal.subcategory)}</div>
          <h4>{deal.name}</h4>
        </div>
        <div style={{ width: 62, flex: "none" }}>
          <Radar metrics={meta.metrics} series={[{ name: deal.name, values: deal.metrics, color: "var(--s1)" }]} size={62} mini />
        </div>
      </div>
      <p className="desc">{deal.summary}</p>
      <div className="foot">
        <span className="row" style={{ gap: 5 }}><span className={`status-dot ${deal.status}`} />{deal.status === "review" ? "심사중" : "아카이브"}</span>
        <span>· {deal.owner_name}</span>
        {deal.region && <span>· {deal.region}</span>}
        <span className="r">
          {deal.open_questions > 0 && <span className="chip warn" title="미답변 질문">Q {deal.open_questions}</span>}
          <span className="muted">{deal.vote_count}표</span>
          <Grade g={cg} title="합의 등급(투표 평균)" />
        </span>
      </div>
    </Link>
  );
}

export function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="mh"><h3>{title}</h3><button className="btn ghost sm" style={{ marginLeft: "auto" }} onClick={onClose} aria-label="닫기">✕</button></div>
        <div className="mb">{children}</div>
        {footer && <div className="mf">{footer}</div>}
      </div>
    </div>
  );
}

export const Empty = ({ title, children }) => (
  <div className="empty"><b>{title}</b>{children}</div>
);

export const Loading = () => (
  <div className="grid" style={{ gap: 12 }}>
    <div className="skeleton" style={{ height: 28, width: 220 }} />
    <div className="skeleton" style={{ height: 120 }} />
    <div className="skeleton" style={{ height: 260 }} />
  </div>
);

export const DateText = ({ v }) => <span>{fmtDate(v)}</span>;
