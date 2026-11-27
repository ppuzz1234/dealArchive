/* 글로벌 딜 피드 — 해외 딜·대체투자·금융 사례를 담당자가 직접 스크랩해 공유 (자동 수집은 추후) */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context.jsx";
import { api } from "../api.js";
import { catName, fmtAgo } from "../lib.js";
import { Empty, Icon, Loading, Modal } from "../components/ui.jsx";

const BLANK = { title: "", url: "", source: "", region: "", category: "", summary: "", published_on: "", deal_id: "" };

export default function Feed() {
  const { meta, deals, userId, run } = useApp();
  const [items, setItems] = useState(null);
  const [edit, setEdit] = useState(null);
  const [fRegion, setFRegion] = useState("");
  const [fCat, setFCat] = useState("");
  const [q, setQ] = useState("");

  const load = () => api.feed().then(setItems);
  useEffect(() => { load(); }, []);

  const list = useMemo(() => (items || []).filter((x) =>
    (!fRegion || x.region === fRegion) && (!fCat || x.category === fCat) &&
    (!q || [x.title, x.summary, x.source].filter(Boolean).some((t) => t.toLowerCase().includes(q.toLowerCase())))
  ), [items, fRegion, fCat, q]);

  if (!meta || !items) return <Loading />;

  const save = async () => {
    const body = { ...edit, deal_id: edit.deal_id || null };
    const ok = await run(() => (edit.id ? api.updateFeed(edit.id, body) : api.addFeed(body)), edit.id ? "수정했습니다" : "피드에 올렸습니다");
    if (ok) { setEdit(null); load(); }
  };
  const del = async (x) => { if (confirm("이 항목을 삭제할까요?") && await run(() => api.deleteFeed(x.id), "삭제했습니다")) load(); };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>글로벌 딜 피드</h1>
          <p className="sub">해외에서 일어나는 딜 · 대체투자 · 금융 사례를 스크랩하고 관련 아카이브 딜과 연결합니다</p>
        </div>
        <div className="actions"><button className="btn primary" onClick={() => (userId ? setEdit({ ...BLANK }) : run(async () => {}))}>+ 사례 올리기</button></div>
      </div>

      <div className="filters mb-16">
        <input type="search" placeholder="검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="검색" style={{ width: 200 }} />
        <select value={fRegion} onChange={(e) => setFRegion(e.target.value)} aria-label="지역">
          <option value="">지역 전체</option>{meta.regions.map((r) => <option key={r}>{r}</option>)}
        </select>
        <select value={fCat} onChange={(e) => setFCat(e.target.value)} aria-label="분류">
          <option value="">분류 전체</option>{meta.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <section className="card">
        {list.length === 0 && <Empty title="아직 올라온 사례가 없습니다">기사·리포트 링크와 한 줄 요약을 올려 팀과 공유해 보세요</Empty>}
        {list.map((x) => {
          const d = x.published_on ? new Date(x.published_on) : new Date(x.created_at);
          return (
            <article className="feed-item" key={x.id}>
              <div className="feed-date"><b>{d.getDate()}</b>{d.getFullYear()}.{d.getMonth() + 1}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h4>{x.url ? <a href={x.url} target="_blank" rel="noopener noreferrer">{x.title} <Icon name="link" width={13} /></a> : x.title}</h4>
                <div className="meta">
                  {x.source && <span className="chip">{x.source}</span>}
                  {x.region && <span className="chip">{x.region}</span>}
                  {x.category && <span className="chip">{catName(meta, x.category)}</span>}
                  {x.deal_id && <Link to={`/deals/${x.deal_id}`} className="chip accent">관련 딜 · {x.deal_name}</Link>}
                  <span>{x.user_name} · {fmtAgo(x.created_at)}</span>
                </div>
                {x.summary && <p className="sum">{x.summary}</p>}
              </div>
              {x.user_id === userId && (
                <div className="row" style={{ alignSelf: "flex-start" }}>
                  <button className="btn ghost sm" onClick={() => setEdit({ ...BLANK, ...Object.fromEntries(Object.entries(x).map(([k, v]) => [k, v ?? ""])) })} aria-label="수정"><Icon name="edit" /></button>
                  <button className="btn ghost sm" onClick={() => del(x)} aria-label="삭제"><Icon name="trash" /></button>
                </div>
              )}
            </article>
          );
        })}
      </section>

      {edit && (
        <Modal title={edit.id ? "사례 수정" : "글로벌 사례 올리기"} onClose={() => setEdit(null)}
          footer={<><button className="btn" onClick={() => setEdit(null)}>취소</button><button className="btn primary" onClick={save} disabled={!edit.title.trim()}>저장</button></>}>
          <F label="제목 *"><input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="예) Blackstone, 일본 물류센터 포트폴리오 인수" /></F>
          <F label="링크"><input type="url" value={edit.url} onChange={(e) => setEdit({ ...edit, url: e.target.value })} placeholder="https://" /></F>
          <div className="grid g-2" style={{ gap: 12 }}>
            <F label="출처"><input value={edit.source} onChange={(e) => setEdit({ ...edit, source: e.target.value })} placeholder="예) Bloomberg, FT, PEI" /></F>
            <F label="발표일"><input type="date" value={edit.published_on} onChange={(e) => setEdit({ ...edit, published_on: e.target.value })} /></F>
            <F label="지역"><select value={edit.region} onChange={(e) => setEdit({ ...edit, region: e.target.value })}><option value="">선택</option>{meta.regions.map((r) => <option key={r}>{r}</option>)}</select></F>
            <F label="분류"><select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}><option value="">선택</option>{meta.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></F>
          </div>
          <F label="관련 아카이브 딜">
            <select value={edit.deal_id} onChange={(e) => setEdit({ ...edit, deal_id: e.target.value })}>
              <option value="">없음</option>
              {(deals || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </F>
          <F label="요약 · 시사점"><textarea rows={4} value={edit.summary} onChange={(e) => setEdit({ ...edit, summary: e.target.value })} placeholder="무슨 딜인지, 우리에게 주는 시사점" /></F>
        </Modal>
      )}
    </>
  );
}

const F = ({ label, children }) => <label className="field"><span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>{children}</label>;
