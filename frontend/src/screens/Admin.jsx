/* 관리자 — 일정 관리. 달력에서 딜소싱 마감일 · 심사일을 지정/수정/취소한다.
   (로그인 도입 전이라 담당자를 선택한 누구나 사용할 수 있다) */
import { useMemo, useState } from "react";
import { useApp } from "../context.jsx";
import { api } from "../api.js";
import { SCHEDULE_KINDS, ddayOf, fmtDday, fmtMD, parseYmd, toYmd } from "../lib.js";
import { Empty, Icon, Modal } from "../components/ui.jsx";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function Admin() {
  const { schedule, users, userId, run, reloadSchedule } = useApp();
  const today = toYmd(new Date());
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [edit, setEdit] = useState(null); // { id?, kind, date, note }
  const [drag, setDrag] = useState(null); // 끌고 있는 일정
  const [over, setOver] = useState(null); // 끌어다 올려둔 날짜(ymd)

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay());
    const weeks = Math.ceil((month.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7);
    return Array.from({ length: weeks * 7 }, (_, i) => {
      const d = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i);
      return { ymd: toYmd(d), day: d.getDate(), out: d.getMonth() !== month.getMonth(), dow: d.getDay() };
    });
  }, [month]);

  const byDate = useMemo(() => {
    const m = {};
    for (const e of schedule) (m[e.date] ||= []).push(e);
    return m;
  }, [schedule]);

  const move = (n) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const goToday = () => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); };
  const openNew = (date) => setEdit({ kind: (byDate[date] || []).some((e) => e.kind === "sourcing") ? "review" : "sourcing", date, note: "" });
  const openEdit = (e) => setEdit({ id: e.id, kind: e.kind, date: e.date, note: e.note || "" });

  const save = async (ev) => {
    ev?.preventDefault();
    if (!edit.date) return;
    const body = { kind: edit.kind, date: edit.date, note: edit.note };
    const ok = await run(() => (edit.id ? api.updateSchedule(edit.id, body) : api.addSchedule(body)), edit.id ? "일정을 수정했습니다" : "일정을 지정했습니다");
    if (ok) { await reloadSchedule(); const d = parseYmd(edit.date); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setEdit(null); }
  };
  const cancelEvent = async () => {
    if (!confirm(`${fmtMD(edit.date)} ${SCHEDULE_KINDS[edit.kind]} 일정을 취소할까요?`)) return;
    if (await run(() => api.deleteSchedule(edit.id), "일정을 취소했습니다")) { await reloadSchedule(); setEdit(null); }
  };

  // 드래그앤드랍 — 달력의 일정을 다른 날짜 칸에 놓으면 그 날짜로 옮긴다 (종류·메모는 그대로)
  const onDragStart = (ev, e) => {
    ev.dataTransfer.effectAllowed = "move";
    ev.dataTransfer.setData("text/plain", String(e.id)); // Firefox는 데이터가 있어야 드래그가 시작된다
    setDrag(e);
  };
  const endDrag = () => { setDrag(null); setOver(null); };
  const onDragOver = (ev, ymd) => {
    if (!drag) return; // 파일 등 외부 드래그는 받지 않는다
    ev.preventDefault();
    ev.dataTransfer.dropEffect = ymd === drag.date ? "none" : "move";
    if (over !== ymd) setOver(ymd);
  };
  const onDrop = async (ev, ymd) => {
    if (!drag) return;
    ev.preventDefault();
    const e = drag;
    endDrag();
    if (ymd === e.date) return;
    const ok = await run(() => api.updateSchedule(e.id, { kind: e.kind, date: ymd, note: e.note || "" }),
      `${SCHEDULE_KINDS[e.kind]} 일정을 ${fmtMD(ymd)}로 옮겼습니다`);
    if (ok) await reloadSchedule();
  };

  const upcoming = schedule.filter((e) => e.date >= today);
  const past = schedule.filter((e) => e.date < today).reverse().slice(0, 6);
  const missing = (e) => users.filter((u) => !e.submitted?.includes(u.id));

  const row = (e) => {
    const n = ddayOf(e.date);
    const miss = e.kind === "sourcing" ? missing(e) : null;
    return (
      <button key={e.id} className="sched-item" onClick={() => openEdit(e)}>
        <i className={`sched-dot ${e.kind}`} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="row" style={{ gap: 8 }}>
            <b>{SCHEDULE_KINDS[e.kind]}</b><span className="muted">{fmtMD(e.date)}</span>
            <span className={`dday ${n >= 0 && n <= 1 ? "urgent" : ""}`} style={{ marginLeft: "auto" }}>{fmtDday(n)}</span>
          </div>
          {e.note && <div className="muted" style={{ fontSize: 12 }}>{e.note}</div>}
          {miss && n >= 0 && (
            <div style={{ fontSize: 12, marginTop: 2 }}>
              {miss.length === 0
                ? <span className="muted">전원 등록 완료 ({users.length}명)</span>
                : <><span className="muted">미등록 {miss.length}/{users.length}명 · </span>{miss.map((u) => u.name).join(", ")}</>}
            </div>
          )}
        </div>
      </button>
    );
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>관리자 · 일정 관리</h1>
          <p className="sub">달력에서 날짜를 눌러 딜소싱 마감일과 심사일을 지정합니다. 지정한 일정을 누르면 수정하거나 취소할 수 있고, 다른 날짜로 끌어다 놓으면 날짜가 바뀝니다.</p>
        </div>
        <div className="actions"><button className="btn primary" onClick={() => openNew(today)}>+ 일정 지정</button></div>
      </div>
      {!userId && <p className="muted" style={{ marginBottom: 12 }}>오른쪽 위에서 담당자를 선택해야 일정을 변경할 수 있습니다.</p>}

      <div className="grid g-main">
        <section className="card">
          <div className="card-head">
            <h3>{month.getFullYear()}년 {month.getMonth() + 1}월</h3>
            <span className="hint cal-legend">
              <span><i className="sched-dot sourcing" />딜소싱 마감일</span><span><i className="sched-dot review" />심사일</span>
            </span>
            <div className="row" style={{ marginLeft: "auto", gap: 4 }}>
              <button className="btn sm" onClick={() => move(-1)} aria-label="이전 달"><Icon name="back" /></button>
              <button className="btn sm" onClick={goToday}>오늘</button>
              <button className="btn sm" onClick={() => move(1)} aria-label="다음 달"><Icon name="chevron" /></button>
            </div>
          </div>
          <div className="card-body">
            <div className="cal" role="grid" aria-label={`${month.getFullYear()}년 ${month.getMonth() + 1}월 일정`}>
              {WEEKDAYS.map((w, i) => <div key={w} className={`cal-wd ${i === 0 ? "sun" : ""}`}>{w}</div>)}
              {cells.map((c) => (
                <div key={c.ymd} role="gridcell" tabIndex={0}
                  className={`cal-cell ${c.out ? "out" : ""} ${c.ymd === today ? "today" : ""} ${c.dow === 0 ? "sun" : ""} ${drag && over === c.ymd && c.ymd !== drag.date ? "drop" : ""}`}
                  onClick={() => openNew(c.ymd)}
                  onDragOver={(ev) => onDragOver(ev, c.ymd)}
                  onDrop={(ev) => onDrop(ev, c.ymd)}
                  onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) openNew(c.ymd); }}
                  aria-label={`${c.ymd} 일정 지정`}>
                  <span className="cal-day">{c.day}</span>
                  {(byDate[c.ymd] || []).map((e) => (
                    <button key={e.id} className={`cal-ev ${e.kind} ${drag?.id === e.id ? "dragging" : ""}`} title={e.note || SCHEDULE_KINDS[e.kind]}
                      draggable={!!userId} onDragStart={(ev) => onDragStart(ev, e)} onDragEnd={endDrag}
                      onClick={(ev) => { ev.stopPropagation(); openEdit(e); }}>
                      {SCHEDULE_KINDS[e.kind]}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h3>다가오는 일정</h3><span className="hint">딜소싱 마감일에는 이번 회차 미등록 담당자 표시</span></div>
          <div className="card-body">
            {upcoming.length === 0 ? <Empty title="지정된 일정이 없습니다">달력에서 날짜를 눌러 지정하세요</Empty> : upcoming.map(row)}
            {past.length > 0 && <><div className="nav-label" style={{ padding: "14px 0 6px" }}>지난 일정</div>{past.map(row)}</>}
          </div>
        </section>
      </div>

      {edit && (
        <Modal title={edit.id ? "일정 수정" : "일정 지정"} onClose={() => setEdit(null)}
          footer={<>
            {edit.id && <button className="btn danger" style={{ marginRight: "auto" }} onClick={cancelEvent} disabled={!userId}>일정 취소</button>}
            <button className="btn" onClick={() => setEdit(null)}>닫기</button>
            <button className="btn primary" onClick={save} disabled={!userId || !edit.date}>{edit.id ? "저장" : "지정"}</button>
          </>}>
          <form className="fields" onSubmit={save}>
            <div className="field full">
              <label>종류</label>
              <div className="seg" role="radiogroup" aria-label="일정 종류">
                {Object.entries(SCHEDULE_KINDS).map(([k, label]) => (
                  <button type="button" key={k} role="radio" aria-checked={edit.kind === k} className={edit.kind === k ? "on" : ""}
                    onClick={() => setEdit((x) => ({ ...x, kind: k }))}>{label}{k === "sourcing" ? "일" : ""}</button>
                ))}
              </div>
            </div>
            <div className="field full">
              <label htmlFor="sched-date">날짜</label>
              <input id="sched-date" type="date" value={edit.date} onChange={(e) => setEdit((x) => ({ ...x, date: e.target.value }))} required />
            </div>
            <div className="field full">
              <label htmlFor="sched-note">메모 (선택)</label>
              <input id="sched-note" value={edit.note} onChange={(e) => setEdit((x) => ({ ...x, note: e.target.value }))} placeholder="예) 12월 1차 소싱, 오후 2시 회의실 A" />
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
