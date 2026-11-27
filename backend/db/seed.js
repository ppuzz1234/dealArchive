/* 프론트 data.js hnwDeals 목데이터를 DB(company/deal)로 시드.
   slug 기준 upsert라 반복 실행해도 안전(중복 생성 없음, 기존 holding 보존).
   금액 단위: data.js valuation=억원, minInvest=만원 → DB는 원(krw). */
import "dotenv/config";
import pg from "pg";
import { eokToKrw, manToKrw } from "../src/lib/money.js";

// data.js hnwDeals 대응 (표시용 메타데이터는 프론트에 남기고, 거래 핵심 필드만 시드)
const DEALS = [
  { slug: "openai",     company: "OpenAI",     sector: "인공지능",        round: "Series G",  valuationEok: 3000000, minInvestMan: 12000, filled: 68 },
  { slug: "anthropic",  company: "Anthropic",  sector: "인공지능",        round: "Series F",  valuationEok: 1830000, minInvestMan: 15000, filled: 55 },
  { slug: "stripe",     company: "Stripe",     sector: "핀테크·결제",     round: "Secondary", valuationEok: 1590000, minInvestMan: 18000, filled: 72 },
  { slug: "databricks", company: "Databricks", sector: "데이터·AI 플랫폼", round: "Series K",  valuationEok: 1340000, minInvestMan: 11000, filled: 61 },
  { slug: "anduril",    company: "Anduril",    sector: "방위산업 테크",    round: "Series H",  valuationEok: 610000,  minInvestMan: 20000, filled: 44 },
];

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL이 설정되지 않았습니다. backend/.env에 추가하세요.");
  process.exit(1);
}
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(DATABASE_URL);
const client = new pg.Client({ connectionString: DATABASE_URL, ssl: isLocal ? false : { rejectUnauthorized: false } });

try {
  await client.connect();
  for (const d of DEALS) {
    const co = await client.query(
      `insert into company (slug, name, sector, valuation_krw)
       values ($1, $2, $3, $4)
       on conflict (slug) do update set name = $2, sector = $3, valuation_krw = $4
       returning id`,
      [d.slug, d.company, d.sector, eokToKrw(d.valuationEok)]
    );
    await client.query(
      `insert into deal (slug, company_id, structure_type, name, round_label, round_valuation_krw, min_invest_krw, filled_pct, status)
       values ($1, $2, 'spv_single', $3, $4, $5, $6, $7, 'open')
       on conflict (slug) do update set
         company_id = $2, name = $3, round_label = $4, round_valuation_krw = $5,
         min_invest_krw = $6, filled_pct = $7`,
      [d.slug, co.rows[0].id, `${d.company} ${d.round} SPV`, d.round, eokToKrw(d.valuationEok), manToKrw(d.minInvestMan), d.filled]
    );
    console.log(`시드: ${d.company} (${d.round})`);
  }
  console.log("시드 완료.");
} catch (err) {
  console.error("시드 실패:", err.message || String(err));
  process.exitCode = 1;
} finally {
  await client.end();
}
