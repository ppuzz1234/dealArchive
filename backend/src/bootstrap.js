/* 스키마 적용 + (비어 있으면) 시트 이관 시드. 서버 기동 시와 db/setup.js 에서 공용. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./db.js";
import { USERS, DEALS } from "../db/seed-data.js";
import { METRICS } from "./taxonomy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = fs.readFileSync(path.resolve(__dirname, "../db/schema.sql"), "utf8");

export async function applySchema() {
  await db.exec(SCHEMA);
}

export async function resetDb() {
  await db.exec(`drop table if exists market_items, attachments, answers, questions, votes, deals, users cascade;`);
}

export async function seedIfEmpty({ force = false } = {}) {
  const { rows } = await db.query("select count(*)::int as n from deals");
  if (rows[0].n > 0 && !force) return false;

  await db.tx(async (t) => {
    const ids = {};
    for (const u of USERS) {
      const r = await t.query(
        "insert into users(name) values ($1) on conflict (name) do update set name = excluded.name returning id",
        [u.name]
      );
      ids[u.name] = r.rows[0].id;
    }
    for (const d of DEALS) {
      const metrics = Object.fromEntries(METRICS.map((m, i) => [m.id, d.m[i]]));
      const r = await t.query(
        `insert into deals(no, name, summary, cases, risks, category, subcategory, region, vehicle, sourcing_model,
                           grade_reason, next_action, metrics, metrics_estimated, status, owner_id, review_date, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true,'archived',$14,$15,$15::date)
         returning id`,
        [d.no, d.name, d.summary, d.cases, d.risks, d.cat, d.sub, d.region, d.vehicle || null, d.sourcing || null,
         d.reason || null, d.next || null, JSON.stringify(metrics), ids[d.owner], d.date]
      );
      // 시트의 '우선순위' = 담당자 본인의 투표로 이관 (TBD는 미투표)
      if (d.grade) {
        await t.query(
          "insert into votes(deal_id, user_id, grade, created_at, updated_at) values ($1,$2,$3,$4::date,$4::date)",
          [r.rows[0].id, ids[d.owner], d.grade, d.date]
        );
      }
    }
  });
  return true;
}

export async function bootstrap() {
  await applySchema();
  const seeded = await seedIfEmpty();
  return { driver: db.kind, seeded };
}
