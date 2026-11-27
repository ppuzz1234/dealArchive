/* 담당자 — 로그인/SSO 도입 전 단계의 간이 사용자 관리 (이름만으로 추가) */
import { useState } from "react";
import { useApp } from "../context.jsx";
import { api } from "../api.js";
import { Avatar, Loading } from "../components/ui.jsx";

export default function People() {
  const { users, deals, me, setUserId, reloadUsers, toast } = useApp();
  const [name, setName] = useState("");
  if (!deals) return <Loading />;

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try { await api.addUser(name.trim()); await reloadUsers(); setName(""); toast("추가했습니다"); }
    catch (err) { toast(err.message, "error"); }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>담당자</h1>
          <p className="sub">지금은 로그인 없이 이름을 골라 사용합니다. 권한·SSO는 이후 단계에서 붙입니다.</p>
        </div>
      </div>
      <div className="grid g-main">
        <section className="card table-wrap">
          <table className="dtable">
            <thead><tr><th>이름</th><th className="num">등록한 딜</th><th className="num">투표</th><th className="num">미답변 질문</th><th /></tr></thead>
            <tbody>
              {users.map((u) => {
                const open = deals.filter((d) => d.owner_id === u.id).reduce((s, d) => s + d.open_questions, 0);
                return (
                  <tr key={u.id} style={{ cursor: "default" }}>
                    <td><span className="row"><Avatar name={u.name} /><b>{u.name}</b>{me?.id === u.id && <span className="chip accent">현재</span>}</span></td>
                    <td className="num">{u.deal_count}</td>
                    <td className="num">{u.vote_count}</td>
                    <td className="num">{open || "-"}</td>
                    <td style={{ textAlign: "right" }}>{me?.id !== u.id && <button className="btn sm" onClick={() => setUserId(u.id)}>이 사람으로 전환</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <section className="card card-pad">
          <h3 style={{ fontSize: 15 }}>담당자 추가</h3>
          <form className="row mt-12" onSubmit={add}>
            <input style={{ flex: 1 }} placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} aria-label="이름" />
            <button className="btn primary">추가</button>
          </form>
        </section>
      </div>
    </>
  );
}
