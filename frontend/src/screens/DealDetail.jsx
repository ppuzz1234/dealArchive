/* 딜 상세 — 상품 정보 · 육각형 지표(분류 평균 비교) · 등급 투표 · Q&A · 첨부 · 유사 딜 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../context.jsx";
import { api } from "../api.js";
import { GRADE_IDS, catName, consensus, fmtAgo, fmtDate, fmtSize, gradeDist, metricAverages, splitCases } from "../lib.js";
import { ChartCard, GradeSplitBar, Radar } from "../components/charts.jsx";
import { Avatar, Empty, Grade, Icon, Loading } from "../components/ui.jsx";

export default function DealDetail() {
  const { id } = useParams();
  const { meta, deals, userId, run, reloadDeals } = useApp();
  const nav = useNavigate();
  const [deal, setDeal] = useState(null);
  const [err, setErr] = useState(null);

  const load = useCallback(() => api.deal(id).then(setDeal).catch((e) => setErr(e.message)), [id]);
  useEffect(() => { setDeal(null); load(); }, [load, userId]);
  const refresh = async () => { await load(); reloadDeals(); };

  if (err) return <div className="card"><Empty title="딜을 불러오지 못했습니다">{err}</Empty></div>;
  if (!deal || !meta || !deals) return <Loading />;

  const isOwner = deal.owner_id === userId;
  const cg = consensus(deal);
  const peers = deals.filter((d) => d.subcategory === deal.subcategory);
  const catPeers = deals.filter((d) => d.category === deal.category);
  const compare = peers.length > 1 ? { name: `${catName(meta, deal.category, deal.subcategory)} 평균`, list: peers } : { name: `${catName(meta, deal.category)} 평균`, list: catPeers };
  const series = [
    { name: deal.name, values: deal.metrics, color: "var(--s1)" },
    { name: compare.name, values: metricAverages(meta, compare.list), color: "var(--s2)" },
  ];

  // 담당자 등급(A/B+/B/C)은 다른 담당자 reveal_min명 이상이 투표해야 공개된다. 6대 지표는 항상 공개.
  const hidden = deal.self_hidden;

  const setStatus = async (status) => {
    if (await run(() => api.updateDeal(deal.id, { status }), status === "archived" ? "아카이브로 편입했습니다" : "심사중으로 되돌렸습니다")) refresh();
  };
  const remove = async () => {
    if (!confirm(`'${deal.name}' 딜을 삭제할까요? 투표·질문·첨부도 함께 삭제됩니다.`)) return;
    if (await run(() => api.deleteDeal(deal.id), "삭제했습니다")) { await reloadDeals(); nav("/deals"); }
  };

  return (
    <>
      <div className="detail-head">
        <div style={{ flex: 1, minWidth: 260 }}>
          <div className="path">
            <Link to="/deals">아카이브</Link><Icon name="chevron" width={12} />
            <Link to={`/deals?cat=${deal.category}`}>{catName(meta, deal.category)}</Link><Icon name="chevron" width={12} />
            <Link to={`/deals?cat=${deal.category}&sub=${deal.subcategory}`}>{catName(meta, deal.category, deal.subcategory)}</Link>
          </div>
          <h1>{deal.name}</h1>
          <div className="meta">
            {deal.status === "review" ? <span className="chip accent">심사중</span> : <span className="chip">아카이브</span>}
            {deal.no != null && <span className="chip">시트 No.{deal.no}</span>}
            <span className="chip">담당 {deal.owner_name}</span>
            <span className="chip">심사일 {fmtDate(deal.review_date)}</span>
            {deal.region && <span className="chip">{deal.region}</span>}
            {deal.tags?.map((t) => <span key={t} className="chip">#{t}</span>)}
          </div>
        </div>
        <div className="grade-box card card-pad">
          <div className="gb"><Grade g={deal.owner_grade} lg hidden={hidden} />담당자 등급</div>
          <div className="gb"><Grade g={cg} lg />합의 등급</div>
          <div className="gb"><b style={{ fontSize: 22, color: "var(--txt)" }}>{deal.vote_count}</b>투표</div>
        </div>
        <div className="actions" style={{ width: "100%", justifyContent: "flex-end", marginLeft: 0 }}>
          {isOwner && (deal.status === "review"
            ? <button className="btn" onClick={() => setStatus("archived")}>아카이브로 편입</button>
            : <button className="btn" onClick={() => setStatus("review")}>심사중으로 되돌리기</button>)}
          <Link className="btn" to={`/deals/${deal.id}/edit`}><Icon name="edit" />편집</Link>
          {isOwner && <button className="btn danger" onClick={remove}><Icon name="trash" />삭제</button>}
        </div>
      </div>

      <div className="grid g-main">
        <div className="grid" style={{ gap: 16, alignContent: "start" }}>
          <section className="card">
            <Sec title="상품 설명" body={deal.summary} />
            {deal.structure && <Sec title="구조 · 수익원" body={deal.structure} />}
            <div className="sec">
              <h4>국내외 사례</h4>
              {deal.cases ? (
                <div className="case-list">
                  {splitCases(deal.cases).map((c, i) => <div className="case" key={i}><span className="tag">{c.tag}</span><div className="body">{c.body}</div></div>)}
                </div>
              ) : <div className="body empty">미입력</div>}
            </div>
            <Sec title="리스크 · 검토사항" body={deal.risks} />
            <div className="sec">
              <h4>핵심 조건</h4>
              <div className="kv">
                <KV k="비히클" v={deal.vehicle} /><KV k="소싱 모델" v={deal.sourcing_model} />
                <KV k="기대수익률" v={deal.target_return} /><KV k="투자기간·만기" v={deal.horizon} />
                <KV k="유동성·환매" v={deal.liquidity_terms} /><KV k="최소 투자금액" v={deal.min_ticket} />
              </div>
            </div>
            <Sec title="순위 선정 사유" body={deal.grade_reason} />
            <Sec title="검토 필요 사항 (Next)" body={deal.next_action} />
          </section>

          <QA deal={deal} isOwner={isOwner} onChange={refresh} />
          <Files deal={deal} isOwner={isOwner} onChange={refresh} />
        </div>

        <div className="grid" style={{ gap: 16, alignContent: "start" }}>
          <ChartCard
            title="6대 지표"
            hint={deal.metrics_estimated ? "초기 추정치 — 편집에서 확정" : "1~5점"}
            right={deal.metrics_estimated && <span className="chip warn" title="시트 내용을 근거로 한 추정치입니다">추정치</span>}
            legend={series.map((s) => <span key={s.name}><i className="line" style={{ background: s.color }} />{s.name}</span>)}
            table={{ columns: ["지표", "이 딜", compare.name], rows: meta.metrics.map((m) => [m.name, deal.metrics?.[m.id], series[1].values[m.id]?.toFixed(1)]) }}
          >
            <Radar metrics={meta.metrics} series={series} size={320} />
          </ChartCard>
          <VotePanel deal={deal} onChange={refresh} />
        </div>
      </div>

      <section className="card mt-16">
        <div className="card-head"><h3>유사한 딜</h3><span className="hint">분류 · 6대 지표 거리 · 지역 · 비히클 기준</span></div>
        <div className="card-body">
          <div className="similar">
            {deal.similar.map((s) => {
              const d = deals.find((x) => x.id === s.id);
              if (!d) return null;
              return (
                <Link key={s.id} to={`/deals/${s.id}`} className="sim">
                  <div style={{ width: 56, flex: "none" }}>
                    <Radar metrics={meta.metrics} series={[{ name: d.name, values: d.metrics, color: "var(--s1)" }]} size={56} mini />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="row"><div className="nm" style={{ flex: 1 }}>{d.name}</div><Grade g={consensus(d)} /></div>
                    <div className="muted" style={{ fontSize: 12 }}>{catName(meta, d.category, d.subcategory)} · 유사도 {Math.round(s.score * 100)}</div>
                    <div className="why">{s.reasons.map((r) => <span key={r} className="chip">{r}</span>)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}

const Sec = ({ title, body }) => (
  <div className="sec"><h4>{title}</h4><div className={`body ${body ? "" : "empty"}`}>{body || "미입력"}</div></div>
);
const KV = ({ k, v }) => <div><div className="k">{k}</div><div className="v">{v || <span className="muted">-</span>}</div></div>;

function VotePanel({ deal, onChange }) {
  const { userId, run } = useApp();
  const mine = deal.votes.find((v) => v.user_id === userId);
  const [grade, setGrade] = useState(mine?.grade || null);
  const [comment, setComment] = useState(mine?.comment || "");
  useEffect(() => { setGrade(mine?.grade || null); setComment(mine?.comment || ""); }, [mine?.grade, mine?.comment, userId]);

  const submit = async () => {
    if (!grade) return;
    if (await run(() => api.vote(deal.id, grade, comment), mine ? "투표를 수정했습니다" : "투표했습니다")) onChange();
  };
  const cancel = async () => { if (await run(() => api.unvote(deal.id), "투표를 취소했습니다")) onChange(); };

  return (
    <section className="card">
      <div className="card-head"><h3>등급 투표</h3><span className="hint">A · B+ · B · C 중 선택 · 1인 1표</span></div>
      <div className="card-body">
        <div className="vote-grades" role="radiogroup" aria-label="등급 선택">
          {GRADE_IDS.map((g) => (
            <button key={g} role="radio" aria-checked={grade === g} className={grade === g ? "on" : ""} onClick={() => setGrade(g)}>{g}</button>
          ))}
        </div>
        <textarea className="mt-8" rows={2} style={{ width: "100%" }} placeholder="의견 (선택) — 등급을 준 이유" value={comment} onChange={(e) => setComment(e.target.value)} />
        <div className="row mt-8" style={{ justifyContent: "flex-end" }}>
          {mine && <button className="btn ghost sm" onClick={cancel}>투표 취소</button>}
          <button className="btn primary sm" disabled={!grade || !userId} onClick={submit}>{mine ? "투표 수정" : "투표하기"}</button>
        </div>
        {!userId && <p className="muted mt-8" style={{ fontSize: 12 }}>오른쪽 위에서 담당자를 선택하면 투표할 수 있습니다.</p>}

        <div className="mt-16"><GradeSplitBar dist={gradeDist(deal.votes.map((v) => v.grade))} /></div>

        <div className="mt-16">
          {deal.self_hidden && (
            <div className="voter">
              <Avatar name={deal.owner_name} />
              <div style={{ minWidth: 0 }}>
                <div className="row"><span className="who">{deal.owner_name}</span><span className="chip">담당자</span><Grade hidden /></div>
                <div className="c">다른 담당자 {deal.reveal_min}명 이상이 투표하면 공개됩니다 (현재 {deal.peer_votes}/{deal.reveal_min})</div>
              </div>
            </div>
          )}
          {!deal.self_hidden && deal.owner_id === userId && deal.owner_grade && deal.peer_votes < deal.reveal_min && (
            <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>
              내 등급은 다른 담당자에게 아직 '?'로 보입니다 — {deal.reveal_min - deal.peer_votes}명 더 투표하면 공개 (현재 {deal.peer_votes}/{deal.reveal_min})
            </p>
          )}
          {deal.votes.map((v) => (
            <div className="voter" key={v.id}>
              <Avatar name={v.user_name} />
              <div style={{ minWidth: 0 }}>
                <div className="row"><span className="who">{v.user_name}</span>{v.user_id === deal.owner_id && <span className="chip">담당자</span>}<Grade g={v.grade} /></div>
                {v.comment && <div className="c">{v.comment}</div>}
              </div>
              <span className="when">{fmtAgo(v.updated_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function QA({ deal, isOwner, onChange }) {
  const { userId, run } = useApp();
  const [q, setQ] = useState("");
  const [replies, setReplies] = useState({});

  const ask = async (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    if (await run(() => api.ask(deal.id, q), "질문을 남겼습니다")) { setQ(""); onChange(); }
  };
  const answer = async (qid) => {
    const body = replies[qid];
    if (!body?.trim()) return;
    if (await run(() => api.answer(qid, body), "답변을 등록했습니다")) { setReplies((r) => ({ ...r, [qid]: "" })); onChange(); }
  };
  const del = async (x) => {
    const msg = x.answers.length ? `질문을 삭제할까요? 달린 답변 ${x.answers.length}개도 함께 삭제됩니다.` : "질문을 삭제할까요?";
    if (confirm(msg) && await run(() => api.deleteQuestion(x.id), "삭제했습니다")) onChange();
  };
  const delAnswer = async (aid) => { if (confirm("답변을 삭제할까요?") && await run(() => api.deleteAnswer(aid), "삭제했습니다")) onChange(); };

  // 수정 중인 글 — { type: "q" | "a", id, body }. 작성자 본인만 수정·삭제 가능
  const [editing, setEditing] = useState(null);
  const isEditing = (type, id) => editing?.type === type && editing.id === id;
  const saveEdit = async () => {
    if (!editing?.body.trim()) return;
    const call = editing.type === "q" ? () => api.editQuestion(editing.id, editing.body) : () => api.editAnswer(editing.id, editing.body);
    if (await run(call, "수정했습니다")) { setEditing(null); onChange(); }
  };
  const editor = (label) => (
    <div className="qa-edit">
      <textarea rows={2} autoFocus value={editing.body} aria-label={label}
        onChange={(e) => setEditing((x) => ({ ...x, body: e.target.value }))}
        onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); }} />
      <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
        <button type="button" className="btn ghost sm" onClick={() => setEditing(null)}>취소</button>
        <button type="button" className="btn primary sm" onClick={saveEdit} disabled={!editing.body.trim()}>저장</button>
      </div>
    </div>
  );
  const tools = (type, item, onDelete) => item.user_id === userId && !isEditing(type, item.id) && (
    <span className="qa-tools">
      <button className="btn ghost sm" onClick={() => setEditing({ type, id: item.id, body: item.body })}>수정</button>
      <button className="btn ghost sm" onClick={onDelete}>삭제</button>
    </span>
  );

  return (
    <section className="card" id="qa">
      <div className="card-head"><h3>Q&amp;A</h3><span className="hint">누구나 질문 · {deal.owner_name}님(담당자)이 답변</span></div>
      <div className="card-body">
        <form onSubmit={ask} className="row" style={{ alignItems: "flex-start" }}>
          <textarea rows={2} style={{ flex: 1 }} placeholder="이 딜에 대해 궁금한 점을 남겨 주세요" value={q} onChange={(e) => setQ(e.target.value)} aria-label="질문" />
          <button className="btn primary" disabled={!userId || !q.trim()}>질문</button>
        </form>
        <div className="qa mt-16">
          {deal.questions.length === 0 && <Empty title="아직 질문이 없습니다" />}
          {deal.questions.map((x) => (
            <div className="q" key={x.id}>
              <div className="q-head"><span className="who">{x.user_name}</span><span>{fmtAgo(x.created_at)}</span>
                {x.edited_at && <span title={`${fmtAgo(x.edited_at)} 수정`}>(수정됨)</span>}
                {x.answers.length === 0 && <span className="chip warn">답변 대기</span>}
                {tools("q", x, () => del(x))}
              </div>
              {isEditing("q", x.id) ? editor("질문 수정") : <div className="q-body">{x.body}</div>}
              {x.answers.map((a) => (
                <div className="a" key={a.id}>
                  <div className="q-head"><span className="who">{a.user_name}</span><span>{fmtAgo(a.created_at)}</span>
                    {a.edited_at && <span title={`${fmtAgo(a.edited_at)} 수정`}>(수정됨)</span>}
                    {tools("a", a, () => delAnswer(a.id))}
                  </div>
                  {isEditing("a", a.id) ? editor("답변 수정") : <div className="q-body">{a.body}</div>}
                </div>
              ))}
              {isOwner && (
                <div className="reply">
                  <textarea rows={1} placeholder="답변 작성" value={replies[x.id] || ""} onChange={(e) => setReplies((r) => ({ ...r, [x.id]: e.target.value }))} aria-label="답변" />
                  <button className="btn sm" onClick={() => answer(x.id)} disabled={!replies[x.id]?.trim()}>답변</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Files({ deal, isOwner, onChange }) {
  const { userId, run } = useApp();
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const send = async (files) => {
    if (!files?.length) return;
    if (await run(() => api.upload(deal.id, [...files]), `${files.length}개 파일을 올렸습니다`)) onChange();
  };
  const del = async (f) => { if (confirm(`${f.filename} 파일을 삭제할까요?`) && await run(() => api.deleteFile(f.id), "삭제했습니다")) onChange(); };
  return (
    <section className="card">
      <div className="card-head"><h3>첨부 자료</h3><span className="hint">IM · 티저 · 검토 메모 등 (파일당 15MB)</span></div>
      <div className="card-body">
        <div className="files">
          {deal.attachments.map((f) => (
            <div className="file" key={f.id}>
              <Icon name="file" width={18} />
              <a className="fn" href={api.fileUrl(f.id)} download>{f.filename}</a>
              <span className="fs">{fmtSize(f.size)} · {f.user_name} · {fmtDate(f.created_at)}</span>
              {(f.user_id === userId || isOwner) && <button className="btn ghost sm" onClick={() => del(f)} aria-label="삭제"><Icon name="trash" /></button>}
            </div>
          ))}
        </div>
        <div
          className={`dropzone mt-8 ${over ? "over" : ""}`}
          role="button" tabIndex={0}
          onClick={() => input.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); send(e.dataTransfer.files); }}
        >
          <Icon name="clip" width={16} style={{ verticalAlign: "-3px" }} /> 파일을 끌어다 놓거나 클릭해서 업로드
        </div>
        <input ref={input} type="file" multiple hidden onChange={(e) => { send(e.target.files); e.target.value = ""; }} />
      </div>
    </section>
  );
}
