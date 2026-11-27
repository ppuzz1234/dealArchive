/* 앱 셸 — 사이드바 내비 · 상단 검색 · 담당자 선택(로그인 전 단계) · 테마 */
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context.jsx";
import { api } from "../api.js";
import { SCHEDULE_KINDS, ddayOf, fmtDday, fmtMD, parseYmd, sourcingNudge, upcomingEvent } from "../lib.js";
import { Avatar, Icon } from "./ui.jsx";

export default function Shell() {
  const { deals, schedule, me, userId } = useApp();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);

  const review = deals?.filter((d) => d.status === "review") || [];
  const pending = userId ? review.filter((d) => !d.my_grade).length : 0;
  const nudge = sourcingNudge(schedule, userId);

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link to="/" className="brand" aria-label="DealArchive 대시보드 홈">
          <div className="brand-mark">P</div>
          <div><div className="brand-name">DealArchive</div><div className="brand-sub">PLUS 소싱 매트릭스</div></div>
        </Link>
        <nav className="nav" aria-label="주 메뉴">
          <NavItem to="/" end icon="dash">대시보드</NavItem>
          <NavItem to="/deals" icon="archive">딜 아카이브<span className="count">{deals?.length ?? "–"}</span></NavItem>
          <div className="nav-label">신규 딜 심사</div>
          <NavItem to="/review" icon="vote">심사 보드{pending > 0 && <span className="count" title="내 투표 대기">{pending}</span>}</NavItem>
          <NavItem to="/new" icon="plus" className={nudge ? "nudge" : ""}
            title={nudge ? `딜소싱 마감 ${fmtMD(nudge.date)}: 이번 회차에 아직 딜을 등록하지 않았습니다` : undefined}>
            딜 등록{nudge && <span className="dday urgent">{fmtDday(nudge.dday)}</span>}
          </NavItem>
          <div className="nav-label">인사이트</div>
          <NavItem to="/feed" icon="globe">글로벌 딜 피드</NavItem>
          <NavItem to="/people" icon="users">담당자</NavItem>
          <div className="nav-label">관리</div>
          <NavItem to="/admin" icon="cal">관리자 · 일정</NavItem>
        </nav>
        <div className="side-sched" aria-label="다가오는 일정">
          <h6>다가오는 일정</h6>
          {Object.entries(SCHEDULE_KINDS).map(([kind, label]) => {
            const e = upcomingEvent(schedule, kind);
            const n = e ? ddayOf(e.date) : null;
            const d = e ? parseYmd(e.date) : null;
            const hot = e && n <= 1;
            return (
              <Link to="/admin" key={kind} className="sched-row" title={e?.note || undefined}>
                <span className={`cal-chip ${hot ? "hot" : ""}`} aria-hidden="true">
                  {d ? <><small>{d.getMonth() + 1}월</small><b>{d.getDate()}</b></> : <b>–</b>}
                </span>
                <span className="txt"><span className="lbl">{label}</span><span className="dt">{d ? `${WEEKDAYS[d.getDay()]}요일` : "미정"}</span></span>
                {e && <span className={`dday ${hot ? "urgent" : ""}`}>{fmtDday(n)}</span>}
              </Link>
            );
          })}
        </div>
        <div className="sidebar-foot">{me ? <><Avatar name={me.name} />{me.name}님으로 작업 중</> : "담당자를 선택하세요"}</div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <Topbar onMenu={() => setOpen(true)} />
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}

/* 메뉴 한 줄 — 현재 위치는 채움(fill) 아이콘, 나머지는 선(regular) 아이콘 */
function NavItem({ to, end, icon, className = "", title, children }) {
  return (
    <NavLink to={to} end={end} title={title} className={({ isActive }) => `${isActive ? "active" : ""} ${className}`}>
      {({ isActive }) => <><Icon name={icon} weight={isActive ? "fill" : "regular"} />{children}</>}
    </NavLink>
  );
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function Topbar({ onMenu }) {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const { theme, setTheme } = useApp();
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  return (
    <header className="topbar">
      <button className="btn ghost sm menu-btn" onClick={onMenu} aria-label="메뉴 열기"><Icon name="menu" /></button>
      <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); nav(`/deals?q=${encodeURIComponent(q)}`); }}>
        <Icon name="search" />
        <input type="search" placeholder="딜 이름 · 사례 · 리스크 · 담당자 검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="딜 검색" />
      </form>
      <div className="spacer" />
      <button className="btn ghost sm" onClick={() => setTheme(isDark ? "light" : "dark")} aria-label={isDark ? "라이트 모드" : "다크 모드"}>
        <Icon name={isDark ? "sun" : "moon"} />
      </button>
      <UserPicker />
    </header>
  );
}

function UserPicker() {
  const { users, me, setUserId, reloadUsers, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  // 처음 방문 시 바로 선택하도록 열어 둔다
  useEffect(() => { if (users.length && !me) setOpen(true); }, [users.length, me]);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const u = await api.addUser(name.trim());
      await reloadUsers();
      setUserId(u.id);
      setName("");
      setOpen(false);
      toast(`${u.name}님을 추가했습니다`);
    } catch (err) { toast(err.message, "error"); }
  };

  return (
    <div className="user-pick" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        <Avatar name={me?.name || "?"} />
        <span style={{ fontWeight: 600 }}>{me ? me.name : "담당자 선택"}</span>
      </button>
      {open && (
        <div className="popover" role="menu">
          <div className="muted" style={{ fontSize: 12, padding: "4px 8px" }}>누구로 작업할까요? (로그인 도입 전 임시 선택)</div>
          {users.map((u) => (
            <button key={u.id} role="menuitem" className={`item ${me?.id === u.id ? "on" : ""}`} onClick={() => { setUserId(u.id); setOpen(false); }}>
              <Avatar name={u.name} />{u.name}<span className="muted" style={{ marginLeft: "auto", fontSize: 12 }}>딜 {u.deal_count}</span>
            </button>
          ))}
          <hr />
          <form className="add" onSubmit={add}>
            <input placeholder="새 담당자 이름" value={name} onChange={(e) => setName(e.target.value)} aria-label="새 담당자 이름" />
            <button className="btn sm">추가</button>
          </form>
        </div>
      )}
    </div>
  );
}
