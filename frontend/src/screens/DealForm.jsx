/* 딜 등록 / 편집 — 이력서처럼 정해진 항목을 채우면 구조화된 데이터로 축적된다.
   신규 등록 시 작성 중 내용은 브라우저에 임시 저장(새로고침해도 유지). */
import { cloneElement, isValidElement, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../context.jsx";
import { api } from "../api.js";
import { GRADE_IDS, fmtSize, splitCases } from "../lib.js";
import { Radar } from "../components/charts.jsx";
import { Icon, Loading } from "../components/ui.jsx";

const DRAFT_KEY = "da.draft";
const EMPTY = {
  name: "", category: "", subcategory: "", region: "", vehicle: "", sourcing_model: "", tags: "",
  summary: "", structure: "", cases_overseas: "", cases_domestic: "",
  target_return: "", horizon: "", liquidity_terms: "", min_ticket: "",
  risks: "", next_action: "", grade: "", grade_reason: "", metrics: {},
};

const fromDeal = (d) => {
  const cs = splitCases(d.cases);
  return {
    ...EMPTY,
    ...Object.fromEntries(Object.keys(EMPTY).filter((k) => d[k] != null).map((k) => [k, d[k]])),
    tags: (d.tags || []).join(", "),
    cases_overseas: cs.find((c) => c.tag !== "국내")?.body || "",
    cases_domestic: cs.find((c) => c.tag === "국내")?.body || "",
    metrics: d.metrics || {},
  };
};

const readDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY)) || null; } catch { return null; } };
const writeDraft = (v) => { try { v ? localStorage.setItem(DRAFT_KEY, JSON.stringify(v)) : localStorage.removeItem(DRAFT_KEY); } catch { /* 저장 불가 */ } };

export default function DealForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const { meta, userId, run, reloadDeals, toast } = useApp();
  const nav = useNavigate();
  const [f, setF] = useState(() => (isEdit ? null : { ...EMPTY, ...(readDraft() || {}) }));
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => { if (isEdit) api.deal(id).then((d) => setF(fromDeal(d))).catch((e) => toast(e.message, "error")); }, [id, isEdit, toast]);
  useEffect(() => { if (!isEdit && f) writeDraft(f); }, [f, isEdit]);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const cat = meta?.categories.find((c) => c.id === f?.category);

  const done = useMemo(() => {
    if (!f || !meta) return {};
    return {
      basic: !!(f.name && f.category && f.subcategory),
      overview: !!f.summary,
      cases: !!(f.cases_overseas || f.cases_domestic || f.target_return),
      risk: !!f.risks,
      eval: meta.metrics.every((m) => f.metrics[m.id]),
    };
  }, [f, meta]);

  if (!meta || !f) return <Loading />;

  const steps = [
    ["basic", "기본 정보"], ["overview", "상품 개요"], ["cases", "사례 · 조건"], ["risk", "리스크"], ["eval", "평가"],
    ...(!isEdit ? [["files", "첨부"]] : []),
  ];

  const submit = async (e) => {
    e.preventDefault();
    if (!done.basic) { toast("상품명과 대분류·소분류는 필수입니다", "error"); document.getElementById("sec-basic")?.scrollIntoView({ behavior: "smooth" }); return; }
    const cases = [f.cases_overseas.trim(), f.cases_domestic.trim() && `국내: ${f.cases_domestic.trim()}`].filter(Boolean).join(" / ");
    const payload = {
      name: f.name, category: f.category, subcategory: f.subcategory, region: f.region, vehicle: f.vehicle,
      sourcing_model: f.sourcing_model, summary: f.summary, structure: f.structure, cases,
      target_return: f.target_return, horizon: f.horizon, liquidity_terms: f.liquidity_terms, min_ticket: f.min_ticket,
      risks: f.risks, next_action: f.next_action, grade_reason: f.grade_reason,
      tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
      metrics: f.metrics,
      ...(!isEdit && f.grade ? { grade: f.grade } : {}),
    };
    setSaving(true);
    const out = await run(async () => {
      const d = isEdit ? await api.updateDeal(id, payload) : await api.createDeal(payload);
      if (!isEdit && files.length) await api.upload(d.id, files);
      return d;
    }, isEdit ? "저장했습니다" : "딜을 등록했습니다 — 심사 보드에서 투표를 받을 수 있어요");
    setSaving(false);
    if (out) {
      if (!isEdit) writeDraft(null);
      await reloadDeals();
      nav(`/deals/${out.id}`);
    }
  };

  const resetDraft = () => { if (confirm("작성 중인 내용을 모두 지울까요?")) { writeDraft(null); setF({ ...EMPTY }); setFiles([]); } };

  return (
    <form onSubmit={submit}>
      <div className="page-head">
        <div>
          <h1>{isEdit ? "딜 편집" : "신규 딜 등록"}</h1>
          <p className="sub">{isEdit ? "변경 사항은 저장 즉시 모든 담당자에게 반영됩니다" : "검토한 딜을 정해진 양식으로 등록하면 '심사중' 상태로 다른 담당자의 투표·질문을 받습니다"}</p>
        </div>
        {!isEdit && <div className="actions"><button type="button" className="btn ghost" onClick={resetDraft}>새로 쓰기</button></div>}
      </div>

      <div className="form-layout">
        <nav className="card steps" aria-label="작성 단계">
          {steps.map(([k, label], i) => (
            <a key={k} href={`#sec-${k}`} className={done[k] || (k === "files" && files.length) ? "done" : ""}
              onClick={(e) => { e.preventDefault(); document.getElementById(`sec-${k}`)?.scrollIntoView({ behavior: "smooth" }); }}>
              <span className="num">{done[k] || (k === "files" && files.length) ? "✓" : i + 1}</span>{label}
            </a>
          ))}
        </nav>

        <div className="card">
          <section className="form-sec" id="sec-basic">
            <h3>1. 기본 정보</h3>
            <p className="desc">어떤 상품인지, 어디에 분류되는지</p>
            <div className="fields">
              <Field label="상품명" req full><input value={f.name} onChange={set("name")} placeholder="예) ABF 에버그린 펀드" required /></Field>
              <Field label="대분류" req>
                <select value={f.category} onChange={(e) => setF((x) => ({ ...x, category: e.target.value, subcategory: "" }))} required>
                  <option value="">선택</option>
                  {meta.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="소분류" req help={cat?.desc}>
                <select value={f.subcategory} onChange={set("subcategory")} required disabled={!cat}>
                  <option value="">{cat ? "선택" : "대분류를 먼저 선택"}</option>
                  {cat?.subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="지역" help="주요 사례·투자 대상 지역">
                <select value={f.region} onChange={set("region")}>
                  <option value="">선택</option>
                  {meta.regions.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="비히클"><input value={f.vehicle} onChange={set("vehicle")} placeholder="예) 사모 재간접 (FoFs), ETF, 일반사모 투자신탁" /></Field>
              <Field label="소싱 모델"><input value={f.sourcing_model} onChange={set("sourcing_model")} placeholder="예) 잡화점, Original" /></Field>
              <Field label="태그" help="쉼표로 구분"><input value={f.tags} onChange={set("tags")} placeholder="예) 에버그린, 월분배" /></Field>
            </div>
          </section>

          <section className="form-sec" id="sec-overview">
            <h3>2. 상품 개요</h3>
            <p className="desc">투자자가 무엇을 사고, 어떻게 돈을 버는지</p>
            <div className="fields">
              <Field label="상품 설명" req full help="한두 문장 요약 — 카드와 목록에 노출됩니다">
                <textarea rows={3} value={f.summary} onChange={set("summary")} placeholder="예) 카드·자동차·장비 대출 묶음에 선순위로 대출 → 매달 이자·원금 수취 · 만기 없는 에버그린 · 분기 환매" />
              </Field>
              <Field label="구조 · 수익원" full>
                <textarea rows={4} value={f.structure} onChange={set("structure")} placeholder="거래 구조, 현금흐름, 운용사·수탁사 등" />
              </Field>
            </div>
          </section>

          <section className="form-sec" id="sec-cases">
            <h3>3. 사례 · 핵심 조건</h3>
            <p className="desc">비교 가능한 국내외 선례와 투자 조건</p>
            <div className="fields">
              <Field label="해외 사례" full><textarea rows={3} value={f.cases_overseas} onChange={set("cases_overseas")} placeholder="예) Oaktree OABIX (미국, 2026.1) · 분배수익률 7.3%" /></Field>
              <Field label="국내 사례" full><textarea rows={2} value={f.cases_domestic} onChange={set("cases_domestic")} placeholder="예) 단건·만기형 사모펀드만 존재" /></Field>
              <Field label="기대수익률"><input value={f.target_return} onChange={set("target_return")} placeholder="예) 연 7~8%" /></Field>
              <Field label="투자기간 · 만기"><input value={f.horizon} onChange={set("horizon")} placeholder="예) 만기 없음(에버그린), 6년" /></Field>
              <Field label="유동성 · 환매 조건"><input value={f.liquidity_terms} onChange={set("liquidity_terms")} placeholder="예) 분기 환매, 순자산 5% 한도" /></Field>
              <Field label="최소 투자금액"><input value={f.min_ticket} onChange={set("min_ticket")} placeholder="예) 3억원" /></Field>
            </div>
          </section>

          <section className="form-sec" id="sec-risk">
            <h3>4. 리스크 · 검토사항</h3>
            <div className="fields">
              <Field label="리스크 · 검토사항" full><textarea rows={3} value={f.risks} onChange={set("risks")} placeholder="예) 분기 환매 한도·비유동성, 연체 급증 시 손실, 환율" /></Field>
              <Field label="검토 필요 사항 (Next)" full><textarea rows={2} value={f.next_action} onChange={set("next_action")} placeholder="예) 자산운용사 ETF 상품 담당에게 확인하기" /></Field>
            </div>
          </section>

          <section className="form-sec" id="sec-eval">
            <h3>5. 평가</h3>
            <p className="desc">6대 지표를 1~5점으로 매기면 육각형 차트와 유사 딜 추천에 사용됩니다</p>
            <div className="grid g-2" style={{ alignItems: "center" }}>
              <div>
                {meta.metrics.map((m) => (
                  <div className="metric-row" key={m.id}>
                    <div><div className="mn">{m.name}</div><div className="mh">{m.hint}</div></div>
                    <div className="scale" role="radiogroup" aria-label={m.name}>
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button type="button" key={v} role="radio" aria-checked={f.metrics[m.id] === v}
                          className={f.metrics[m.id] === v ? "on" : f.metrics[m.id] > v ? "fill" : ""}
                          onClick={() => setF((x) => ({ ...x, metrics: { ...x.metrics, [m.id]: v } }))}>{v}</button>
                      ))}
                    </div>
                    <div className="mv">{f.metrics[m.id] ?? "–"}</div>
                  </div>
                ))}
              </div>
              <Radar metrics={meta.metrics} series={[{ name: f.name || "이 딜", values: f.metrics, color: "var(--s1)" }]} size={280} />
            </div>
            <div className="fields mt-16">
              {!isEdit && (
                <Field label="내 등급" help="등록자 본인의 첫 투표로 기록됩니다 (선택)">
                  <div className="seg" role="radiogroup" aria-label="내 등급">
                    {GRADE_IDS.map((g) => <button type="button" key={g} className={f.grade === g ? "on" : ""} onClick={() => setF((x) => ({ ...x, grade: x.grade === g ? "" : g }))}>{g}</button>)}
                  </div>
                </Field>
              )}
              <Field label="순위 선정 사유" full><textarea rows={2} value={f.grade_reason} onChange={set("grade_reason")} placeholder="이 등급을 준 이유" /></Field>
            </div>
          </section>

          {!isEdit && (
            <section className="form-sec" id="sec-files">
              <h3>6. 첨부 자료</h3>
              <p className="desc">IM·티저·검토 메모 등 원문 파일 (파일당 15MB) — 등록 후에도 상세 화면에서 추가할 수 있습니다</p>
              <div className="dropzone" role="button" tabIndex={0} onClick={() => fileInput.current?.click()}
                onKeyDown={(e) => e.key === "Enter" && fileInput.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); setFiles((x) => [...x, ...e.dataTransfer.files]); }}>
                <Icon name="clip" width={16} style={{ verticalAlign: "-3px" }} /> 파일을 끌어다 놓거나 클릭해서 선택
              </div>
              <input ref={fileInput} type="file" multiple hidden onChange={(e) => { setFiles((x) => [...x, ...e.target.files]); e.target.value = ""; }} />
              <div className="files mt-8">
                {files.map((file, i) => (
                  <div className="file" key={i}>
                    <Icon name="file" width={18} /><span className="fn">{file.name}</span><span className="fs">{fmtSize(file.size)}</span>
                    <button type="button" className="btn ghost sm" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} aria-label="제거"><Icon name="trash" /></button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="form-actions">
            {!userId && <span className="muted" style={{ marginRight: "auto", alignSelf: "center" }}>오른쪽 위에서 담당자를 선택해야 등록할 수 있습니다</span>}
            <button type="button" className="btn" onClick={() => nav(-1)}>취소</button>
            <button className="btn primary" disabled={saving || !userId}>{saving ? "저장 중…" : isEdit ? "저장" : "등록하고 심사 요청"}</button>
          </div>
        </div>
      </div>
    </form>
  );
}

function Field({ label, req, full, help, children }) {
  const id = useId();
  const isControl = isValidElement(children) && ["input", "select", "textarea"].includes(children.type);
  return (
    <div className={`field ${full ? "full" : ""}`}>
      <label htmlFor={isControl ? id : undefined}>{label}{req && <span className="req">*</span>}</label>
      {isControl ? cloneElement(children, { id }) : children}
      {help && <span className="help">{help}</span>}
    </div>
  );
}
