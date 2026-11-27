/* 메타(분류·지표·등급) · 담당자 · 답변 · 첨부 다운로드 · 활동 로그 · 글로벌 피드 */
import { Router } from "express";
import { query } from "../db.js";
import { wrap, HttpError, requireUser, currentUserId, clean } from "../lib/http.js";
import { REVEAL_MIN_PEER_VOTES } from "../lib/visibility.js";
import { CATEGORIES, METRICS, GRADES, REGIONS, STATUSES } from "../taxonomy.js";

const r = Router();

r.get("/meta", (_req, res) => res.json({ categories: CATEGORIES, metrics: METRICS, grades: GRADES, regions: REGIONS, statuses: STATUSES }));

// ---------- 담당자 ----------
r.get("/users", wrap(async (_req, res) => {
  const { rows } = await query(
    `select u.id, u.name, u.team,
            (select count(*) from deals d where d.owner_id = u.id)::int as deal_count,
            (select count(*) from votes v where v.user_id = u.id)::int as vote_count
       from users u order by u.id`
  );
  res.json(rows);
}));

r.post("/users", wrap(async (req, res) => {
  const name = clean(req.body?.name);
  if (!name) throw new HttpError(400, "이름을 입력하세요");
  const { rows } = await query(
    "insert into users(name, team) values ($1,$2) on conflict (name) do update set team = coalesce(excluded.team, users.team) returning id, name, team",
    [name, clean(req.body?.team)]
  );
  res.status(201).json(rows[0]);
}));

// ---------- 답변 (딜 담당자만) / 질문 삭제 (작성자만) ----------
r.post("/questions/:qid/answers", wrap(async (req, res) => {
  const userId = requireUser(req);
  const body = clean(req.body?.body);
  if (!body) throw new HttpError(400, "답변 내용을 입력하세요");
  const { rows } = await query(
    "select d.owner_id from questions q join deals d on d.id = q.deal_id where q.id = $1", [Number(req.params.qid)]
  );
  if (!rows[0]) throw new HttpError(404, "질문을 찾을 수 없습니다");
  if (rows[0].owner_id !== userId) throw new HttpError(403, "딜 담당자만 답변할 수 있습니다");
  await query("insert into answers(question_id, user_id, body) values ($1,$2,$3)", [Number(req.params.qid), userId, body]);
  res.status(201).json({ ok: true });
}));

/* 질문·답변 수정/삭제 공통 — 작성자 본인만 */
async function ownRow(table, id, userId, label) {
  const { rows } = await query(`select user_id from ${table} where id = $1`, [id]);
  if (!rows[0]) throw new HttpError(404, `${label}을 찾을 수 없습니다`);
  if (rows[0].user_id !== userId) throw new HttpError(403, "작성자만 수정·삭제할 수 있습니다");
}

r.put("/questions/:qid", wrap(async (req, res) => {
  const userId = requireUser(req);
  const body = clean(req.body?.body);
  if (!body) throw new HttpError(400, "질문 내용을 입력하세요");
  const id = Number(req.params.qid);
  await ownRow("questions", id, userId, "질문");
  await query("update questions set body = $1, edited_at = now() where id = $2", [body, id]);
  res.json({ ok: true });
}));

r.put("/answers/:aid", wrap(async (req, res) => {
  const userId = requireUser(req);
  const body = clean(req.body?.body);
  if (!body) throw new HttpError(400, "답변 내용을 입력하세요");
  const id = Number(req.params.aid);
  await ownRow("answers", id, userId, "답변");
  await query("update answers set body = $1, edited_at = now() where id = $2", [body, id]);
  res.json({ ok: true });
}));

r.delete("/answers/:aid", wrap(async (req, res) => {
  const userId = requireUser(req);
  const id = Number(req.params.aid);
  await ownRow("answers", id, userId, "답변");
  await query("delete from answers where id = $1", [id]);
  res.json({ ok: true });
}));

r.delete("/questions/:qid", wrap(async (req, res) => {
  const userId = requireUser(req);
  const { rows } = await query("select user_id from questions where id = $1", [Number(req.params.qid)]);
  if (!rows[0]) throw new HttpError(404, "질문을 찾을 수 없습니다");
  if (rows[0].user_id !== userId) throw new HttpError(403, "작성자만 삭제할 수 있습니다");
  await query("delete from questions where id = $1", [Number(req.params.qid)]);
  res.json({ ok: true });
}));

// ---------- 첨부 다운로드 / 삭제 ----------
r.get("/attachments/:aid", wrap(async (req, res) => {
  const { rows } = await query("select filename, mime, data from attachments where id = $1", [Number(req.params.aid)]);
  if (!rows[0]) throw new HttpError(404, "파일을 찾을 수 없습니다");
  const f = rows[0];
  res.setHeader("Content-Type", f.mime || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(f.filename)}`);
  res.send(Buffer.from(f.data));
}));

r.delete("/attachments/:aid", wrap(async (req, res) => {
  const userId = requireUser(req);
  const { rows } = await query(
    "select a.user_id, d.owner_id from attachments a join deals d on d.id = a.deal_id where a.id = $1", [Number(req.params.aid)]
  );
  if (!rows[0]) throw new HttpError(404, "파일을 찾을 수 없습니다");
  if (rows[0].user_id !== userId && rows[0].owner_id !== userId) throw new HttpError(403, "업로드한 사람 또는 딜 담당자만 삭제할 수 있습니다");
  await query("delete from attachments where id = $1", [Number(req.params.aid)]);
  res.json({ ok: true });
}));

// ---------- 최근 활동 (등록·투표·질문·답변) ----------
r.get("/activity", wrap(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  // 담당자 본인의 투표는 자가 평가 공개 조건(다른 담당자 N명 투표)을 채운 뒤에만 다른 사람의 활동 로그에 나온다
  const { rows } = await query(
    `select * from (
       select 'deal' as kind, d.created_at as at, u.name as user_name, d.id as deal_id, d.name as deal_name, null as detail
         from deals d left join users u on u.id = d.owner_id where d.no is null
       union all
       select 'vote', v.updated_at, u.name, d.id, d.name, v.grade
         from votes v join users u on u.id = v.user_id join deals d on d.id = v.deal_id where v.user_id <> d.owner_id
            or (d.no is null and (d.owner_id = $2::int
                 or (select count(*) from votes p where p.deal_id = d.id and p.user_id <> d.owner_id) >= $3::int))
       union all
       select 'question', q.created_at, u.name, d.id, d.name, left(q.body, 80)
         from questions q join users u on u.id = q.user_id join deals d on d.id = q.deal_id
       union all
       select 'answer', a.created_at, u.name, d.id, d.name, left(a.body, 80)
         from answers a join users u on u.id = a.user_id join questions q on q.id = a.question_id join deals d on d.id = q.deal_id
     ) x order by at desc limit $1`,
    [limit, currentUserId(req), REVEAL_MIN_PEER_VOTES]
  );
  res.json(rows);
}));

// ---------- 글로벌 딜·시장 피드 ----------
const FEED_SELECT = `select m.id, m.title, m.url, m.source, m.region, m.category, m.summary,
         to_char(m.published_on, 'YYYY-MM-DD') as published_on, m.deal_id, d.name as deal_name,
         m.user_id, u.name as user_name, m.created_at
    from market_items m left join deals d on d.id = m.deal_id left join users u on u.id = m.user_id`;

r.get("/feed", wrap(async (_req, res) => {
  const { rows } = await query(`${FEED_SELECT} order by coalesce(m.published_on, m.created_at::date) desc, m.id desc`);
  res.json(rows);
}));

function feedInput(b = {}) {
  const title = clean(b.title);
  if (!title) throw new HttpError(400, "제목을 입력하세요");
  const url = clean(b.url);
  if (url && !/^https?:\/\//i.test(url)) throw new HttpError(400, "링크는 http(s):// 로 시작해야 합니다");
  return [title, url, clean(b.source), clean(b.region), clean(b.category), clean(b.summary),
    clean(b.published_on), b.deal_id ? Number(b.deal_id) : null];
}

r.post("/feed", wrap(async (req, res) => {
  const userId = requireUser(req);
  const { rows } = await query(
    `insert into market_items(title, url, source, region, category, summary, published_on, deal_id, user_id)
     values ($1,$2,$3,$4,$5,$6,$7::date,$8,$9) returning id`,
    [...feedInput(req.body), userId]
  );
  res.status(201).json({ id: rows[0].id });
}));

r.put("/feed/:fid", wrap(async (req, res) => {
  requireUser(req);
  await query(
    `update market_items set title=$1, url=$2, source=$3, region=$4, category=$5, summary=$6, published_on=$7::date, deal_id=$8
      where id = $9`,
    [...feedInput(req.body), Number(req.params.fid)]
  );
  res.json({ ok: true });
}));

r.delete("/feed/:fid", wrap(async (req, res) => {
  const userId = requireUser(req);
  const { rows } = await query("select user_id from market_items where id = $1", [Number(req.params.fid)]);
  if (!rows[0]) throw new HttpError(404, "항목을 찾을 수 없습니다");
  if (rows[0].user_id !== userId) throw new HttpError(403, "작성자만 삭제할 수 있습니다");
  await query("delete from market_items where id = $1", [Number(req.params.fid)]);
  res.json({ ok: true });
}));

export default r;
