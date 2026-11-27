/* 공용 UI — 아이콘 · 등급 배지 · 딜 카드 · 모달 · 빈 상태 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context.jsx";
import { catName, consensus, gradeClass, fmtDate } from "../lib.js";
import { Radar } from "./charts.jsx";
import {
  CalendarCheck, CaretLeft, CaretRight, ChartPieSlice, ChatCircleText, FileText, Gavel, Handshake, IdentificationBadge,
  LinkSimple, List, MagnifyingGlass, Moon, Newspaper, Paperclip, PencilSimple, Sun, Trash, Vault,
} from "@phosphor-icons/react";

/* 아이콘 — Phosphor. 화면 코드는 이름으로만 쓰고, 어떤 그림인지는 여기서만 정한다.
   메뉴 아이콘은 딜/금융 성격의 세트(원형 차트 · 금고 · 의사봉 · 악수 · 신문 · 사원증 · 달력 체크). */
const ICONS = {
  dash: ChartPieSlice, archive: Vault, vote: Gavel, plus: Handshake, globe: Newspaper, users: IdentificationBadge, cal: CalendarCheck,
  search: MagnifyingGlass, menu: List, chevron: CaretRight, back: CaretLeft, edit: PencilSimple, trash: Trash,
  file: FileText, sun: Sun, moon: Moon, link: LinkSimple, msg: ChatCircleText, clip: Paperclip,
};

/* width: 한 변 크기(px). weight: regular | fill | bold … (선택된 메뉴는 fill) */
export const Icon = ({ name, width = 18, weight = "regular", ...p }) => {
  const Cmp = ICONS[name];
  return Cmp ? <Cmp size={width} weight={weight} aria-hidden="true" {...p} /> : null;
};

/* hidden: 아직 공개되지 않은 담당자 자가 등급 — '?' 로 표시 */
export const Grade = ({ g, lg, title, hidden }) => (
  <span className={`grade ${gradeClass(hidden ? null : g)} ${lg ? "lg" : ""}`}
    title={hidden ? "다른 담당자 3명 이상이 투표하면 공개됩니다" : title}
    aria-label={hidden ? "비공개" : undefined}>{hidden ? "?" : g || "TBD"}</span>
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
