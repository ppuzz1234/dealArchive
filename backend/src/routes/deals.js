import { Router } from "express";
import multer from "multer";
import { query, db } from "../db.js";
import { wrap, HttpError, currentUserId, requireUser, clean } from "../lib/http.js";
import { similarDeals } from "../lib/similarity.js";
import { METRICS, GRADES, STATUSES, isValidCategory, REGIONS } from "../taxonomy.js";

const r = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 10 } });

const GRADE_SCORE_SQL = `case v.grade when 'A' then 4 when 'B+' then 3 when 'B' then 2 else 1 end`;

/* 목록/상세 공용 SELECT — 투표 집계·Q&A·첨부 카운트 포함 */
const DEAL_SELECT = `
  select d.id, d.no, d.name, d.summary, d.structure, d.cases, d.risks, d.category, d.subcategory, d.region,
         d.vehicle, d.sourcing_model, d.target_return, d.horizon, d.liquidity_terms, d.min_ticket,
         d.grade_reason, d.next_action, d.tags, d.metrics, d.metrics_estimated, d.status, d.owner_id,
         to_char(d.review_date, 'YYYY-MM-DD') as review_date, d.created_at, d.updated_at,
         u.name as owner_name,
         (select count(*) from votes v where v.deal_id = d.id)::int as vote_count,
         (select avg(${GRADE_SCORE_SQL}) from votes v where v.deal_id = d.id)::float as avg_score,
         (select coalesce(json_agg(v.grade), '[]'::json) from votes v where v.deal_id = d.id) as grades,
         (select v.grade from votes v where v.deal_id = d.id and v.user_id = d.owner_id) as owner_grade,
         (select v.grade from votes v where v.deal_id = d.id and v.user_id = $1) as my_grade,
         (select count(*) from questions q where q.deal_id = d.id)::int as question_count,
         (select count(*) from questions q where q.deal_id = d.id
            and not exists (select 1 from answers a where a.question_id = q.id))::int as open_questions,
         (select count(*) from attachments a where a.deal_id = d.id)::int as attachment_count
    from deals d left join users u on u.id = d.owner_id`;

async function loadDeal(id, userId) {
  const { rows } = await query(`${DEAL_SELECT} where d.id = $2`, [userId, id]);
  if (!rows[0]) throw new HttpError(404, "딜을 찾을 수 없습니다");
  return rows[0];
}

/* 입력 정리 — 화면 양식(resume형)의 필드만 허용 */
const TEXT_FIELDS = ["name", "summary", "structure", "cases", "risks", "region", "vehicle", "sourcing_model",
  "target_return", "horizon", "liquidity_terms", "min_ticket", "grade_reason", "next_action"];

function normalize(body, { partial }) {
  const out = {};
  for (const f of TEXT_FIELDS) if (!partial || f in body) out[f] = clean(body[f]);
  if (!partial || "category" in body || "subcategory" in body) {
    if (!isValidCategory(body.category, body.subcategory)) throw new HttpError(400, "분류(대분류/소분류)가 올바르지 않습니다");
    out.category = body.category;
    out.subcategory = clean(body.subcategory);
  }
  if (out.region && !REGIONS.includes(out.region)) throw new HttpError(400, "지역 값이 올바르지 않습니다");
  if (!partial || "tags" in body) {
    out.tags = Array.isArray(body.tags) ? body.tags.map(clean).filter(Boolean).slice(0, 12) : [];
  }
  if (!partial || "metrics" in body) {
    const m = {};
    for (const { id } of METRICS) {
      const v = Number(body.metrics?.[id]);
      if (Number.isFinite(v) && v >= 1 && v <= 5) m[id] = Math.round(v);
    }
    out.metrics = m;
  }
  if ("status" in body) {
    if (!STATUSES.some((s) => s.id === body.status)) throw new HttpError(400, "상태 값이 올바르지 않습니다");
    out.status = body.status;
  }
  if ("review_date" in body) out.review_date = clean(body.review_date);
  if (!partial && !out.name) throw new HttpError(400, "상품명은 필수입니다");
  if (partial && "name" in out && !out.name) throw new HttpError(400, "상품명은 비울 수 없습니다");
  return out;
}

const validGrade = (g) => GRADES.some((x) => x.id === g);

// ---------- 목록 ----------
r.get("/", wrap(async (req, res) => {
  const params = [currentUserId(req)];
  let where = "";
  if (req.query.status) { params.push(req.query.status); where = ` where d.status = $${params.length}`; }
  const { rows } = await query(`${DEAL_SELECT}${where} order by d.id`, params);
  res.json(rows);
}));

// ---------- 상세 (투표·Q&A·첨부·유사 딜 포함) ----------
r.get("/:id", wrap(async (req, res) => {
  const id = Number(req.params.id);
  const deal = await loadDeal(id, currentUserId(req));
  const [votes, qs, ans, files, all] = await Promise.all([
    query(`select v.id, v.user_id, u.name as user_name, v.grade, v.comment, v.updated_at
             from votes v join users u on u.id = v.user_id where v.deal_id = $1 order by v.updated_at desc`, [id]),
    query(`select q.id, q.user_id, u.name as user_name, q.body, q.created_at
             from questions q join users u on u.id = q.user_id where q.deal_id = $1 order by q.created_at desc`, [id]),
    query(`select a.id, a.question_id, a.user_id, u.name as user_name, a.body, a.created_at
             from answers a join users u on u.id = a.user_id
            where a.question_id in (select id from questions where deal_id = $1) order by a.created_at`, [id]),
    query(`select a.id, a.filename, a.mime, a.size, a.user_id, u.name as user_name, a.created_at
             from attachments a left join users u on u.id = a.user_id where a.deal_id = $1 order by a.created_at desc`, [id]),
    query(`select id, category, subcategory, region, vehicle, metrics from deals`),
  ]);
  const questions = qs.rows.map((q) => ({ ...q, answers: ans.rows.filter((a) => a.question_id === q.id) }));
  res.json({
    ...deal,
    votes: votes.rows,
    questions,
    attachments: files.rows,
    similar: similarDeals(deal, all.rows),
  });
}));

// ---------- 등록 (신규 온보딩 → 심사중) ----------
r.post("/", wrap(async (req, res) => {
  const userId = requireUser(req);
  const d = normalize(req.body || {}, { partial: false });
  const grade = req.body?.grade;
  if (grade && !validGrade(grade)) throw new HttpError(400, "등급은 A, B+, B, C 중 하나입니다");
  const id = await db.tx(async (t) => {
    const ins = await t.query(
      `insert into deals(name, summary, structure, cases, risks, category, subcategory, region, vehicle, sourcing_model,
                         target_return, horizon, liquidity_terms, min_ticket, grade_reason, next_action, tags, metrics,
                         metrics_estimated, status, owner_id, review_date)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,false,'review',$19,coalesce($20::date, current_date))
       returning id`,
      [d.name, d.summary, d.structure, d.cases, d.risks, d.category, d.subcategory, d.region, d.vehicle, d.sourcing_model,
       d.target_return, d.horizon, d.liquidity_terms, d.min_ticket, d.grade_reason, d.next_action, d.tags,
       JSON.stringify(d.metrics), userId, d.review_date || null]
    );
    const newId = ins.rows[0].id;
    if (grade) await t.query("insert into votes(deal_id, user_id, grade) values ($1,$2,$3)", [newId, userId, grade]);
    return newId;
  });
  res.status(201).json(await loadDeal(id, userId));
}));

// ---------- 수정 ----------
r.put("/:id", wrap(async (req, res) => {
  const userId = requireUser(req);
  const id = Number(req.params.id);
  await loadDeal(id, userId);
  const d = normalize(req.body || {}, { partial: true });
  const sets = [];
  const params = [];
  for (const [k, v] of Object.entries(d)) {
    params.push(k === "metrics" ? JSON.stringify(v) : v);
    sets.push(`${k} = $${params.length}${k === "review_date" ? "::date" : ""}`);
  }
  if ("metrics" in d) sets.push("metrics_estimated = false");
  if (!sets.length) throw new HttpError(400, "변경할 항목이 없습니다");
  sets.push("updated_at = now()");
  params.push(id);
  await query(`update deals set ${sets.join(", ")} where id = $${params.length}`, params);
  res.json(await loadDeal(id, userId));
}));

r.delete("/:id", wrap(async (req, res) => {
  const userId = requireUser(req);
  const deal = await loadDeal(Number(req.params.id), userId);
  if (deal.owner_id !== userId) throw new HttpError(403, "딜 담당자만 삭제할 수 있습니다");
  await query("delete from deals where id = $1", [deal.id]);
  res.json({ ok: true });
}));

// ---------- 투표 (1인 1표, 재투표 시 덮어쓰기) ----------
r.put("/:id/vote", wrap(async (req, res) => {
  const userId = requireUser(req);
  const id = Number(req.params.id);
  const { grade, comment } = req.body || {};
  if (!validGrade(grade)) throw new HttpError(400, "등급은 A, B+, B, C 중 하나입니다");
  await loadDeal(id, userId);
  await query(
    `insert into votes(deal_id, user_id, grade, comment) values ($1,$2,$3,$4)
     on conflict (deal_id, user_id) do update set grade = excluded.grade, comment = excluded.comment, updated_at = now()`,
    [id, userId, grade, clean(comment)]
  );
  res.json({ ok: true });
}));

r.delete("/:id/vote", wrap(async (req, res) => {
  const userId = requireUser(req);
  await query("delete from votes where deal_id = $1 and user_id = $2", [Number(req.params.id), userId]);
  res.json({ ok: true });
}));

// ---------- Q&A ----------
r.post("/:id/questions", wrap(async (req, res) => {
  const userId = requireUser(req);
  const body = clean(req.body?.body);
  if (!body) throw new HttpError(400, "질문 내용을 입력하세요");
  const id = Number(req.params.id);
  await loadDeal(id, userId);
  const { rows } = await query("insert into questions(deal_id, user_id, body) values ($1,$2,$3) returning id", [id, userId, body]);
  res.status(201).json({ id: rows[0].id });
}));

// ---------- 첨부파일 ----------
r.post("/:id/attachments", upload.array("files"), wrap(async (req, res) => {
  const userId = requireUser(req);
  const id = Number(req.params.id);
  await loadDeal(id, userId);
  for (const f of req.files || []) {
    // multer는 latin1로 파일명을 해석하므로 한글 파일명 복원
    const filename = Buffer.from(f.originalname, "latin1").toString("utf8");
    await query(
      "insert into attachments(deal_id, user_id, filename, mime, size, data) values ($1,$2,$3,$4,$5,$6)",
      [id, userId, filename, f.mimetype, f.size, f.buffer]
    );
  }
  res.status(201).json({ ok: true, count: (req.files || []).length });
}));

export default r;
