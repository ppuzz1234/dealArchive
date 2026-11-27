/* 일정 — 딜소싱 마감일(sourcing) · 심사일(review). 관리자 메뉴에서 지정/수정/취소한다.
   딜소싱 마감일에는 '이번 회차에 딜을 등록한 담당자'(submitted)를 함께 내려보내 화면이 미등록자를 독려할 수 있게 한다.
   회차 = 직전 딜소싱 마감일 다음 날 ~ 이번 마감일. 직전 마감일이 없으면 이 일정을 만든 날부터. (날짜는 한국 시간 기준) */
import { Router } from "express";
import { query } from "../db.js";
import { wrap, HttpError, requireUser, clean } from "../lib/http.js";

const r = Router();
const KINDS = ["sourcing", "review"];
const KST_DATE = (col) => `to_char((${col} at time zone 'Asia/Seoul')::date, 'YYYY-MM-DD')`;

function input(body = {}) {
  if (!KINDS.includes(body.kind)) throw new HttpError(400, "일정 종류는 딜소싱 마감일 또는 심사일입니다");
  const date = String(body.date || "");
  const t = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : null;
  if (!t || Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== date) throw new HttpError(400, "날짜가 올바르지 않습니다");
  return [body.kind, date, clean(body.note)];
}

const duplicate = (e) => {
  if (e.code === "23505") throw new HttpError(409, "같은 날짜에 같은 종류의 일정이 이미 있습니다");
  throw e;
};

r.get("/", wrap(async (_req, res) => {
  const [ev, deals] = await Promise.all([
    query(`select id, kind, to_char(event_date, 'YYYY-MM-DD') as date, note, ${KST_DATE("created_at")} as created_on
             from schedule_events order by event_date, kind`),
    query(`select owner_id, ${KST_DATE("created_at")} as d from deals where owner_id is not null`),
  ]);
  let prev = null;
  const out = ev.rows.map((e) => {
    if (e.kind !== "sourcing") return e;
    // 문자열(YYYY-MM-DD) 비교 = 날짜 비교
    const from = prev ? null : (e.created_on < e.date ? e.created_on : e.date);
    const after = prev;
    const submitted = [...new Set(deals.rows
      .filter((d) => d.d <= e.date && (after ? d.d > after : d.d >= from))
      .map((d) => d.owner_id))];
    prev = e.date;
    return { ...e, submitted, window_after: after, window_from: from };
  });
  res.json(out);
}));

r.post("/", wrap(async (req, res) => {
  const userId = requireUser(req);
  const { rows } = await query(
    "insert into schedule_events(kind, event_date, note, created_by) values ($1,$2::date,$3,$4) returning id",
    [...input(req.body), userId]
  ).catch(duplicate);
  res.status(201).json({ id: rows[0].id });
}));

r.put("/:id", wrap(async (req, res) => {
  requireUser(req);
  const { rows } = await query(
    "update schedule_events set kind = $1, event_date = $2::date, note = $3, updated_at = now() where id = $4 returning id",
    [...input(req.body), Number(req.params.id)]
  ).catch(duplicate);
  if (!rows[0]) throw new HttpError(404, "일정을 찾을 수 없습니다");
  res.json({ ok: true });
}));

r.delete("/:id", wrap(async (req, res) => {
  requireUser(req);
  await query("delete from schedule_events where id = $1", [Number(req.params.id)]);
  res.json({ ok: true });
}));

export default r;
