/* 앱 셸 — 사이드바 내비 · 상단 검색 · 담당자 선택(로그인 전 단계) · 테마 */
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context.jsx";
import { api } from "../api.js";
import { Avatar, Icon } from "./ui.jsx";

export default function Shell() {
  const { deals, me, userId } = useApp();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);

  const review = deals?.filter((d) => d.status === "review") || [];
  const pending = userId ? review.filter((d) => !d.my_grade).length : 0;

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">P</div>
          <div><div className="brand-name">DealArchive</div><div className="brand-sub">PLUS 소싱 매트릭스</div></div>
        </div>
        <nav className="nav" aria-label="주 메뉴">
          <NavLink to="/" end><Icon name="dash" />대시보드</NavLink>
          <NavLink to="/deals"><Icon name="archive" />딜 아카이브<span className="count">{deals?.length ?? "–"}</span></NavLink>
          <div className="nav-label">신규 딜 심사</div>
          <NavLink to="/review"><Icon name="vote" />심사 보드{pending > 0 && <span className="count" title="내 투표 대기">{pending}</span>}</NavLink>
          <NavLink to="/new"><Icon name="plus" />딜 등록</NavLink>
          <div className="nav-label">인사이트</div>
          <NavLink to="/feed"><Icon name="globe" />글로벌 딜 피드</NavLink>
          <NavLink to="/people"><Icon name="users" />담당자</NavLink>
        </nav>
        <div className="sidebar-foot">{me ? `${me.name}님으로 작업 중` : "담당자를 선택하세요"}</div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <Topbar onMenu={() => setOpen(true)} />
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}

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
