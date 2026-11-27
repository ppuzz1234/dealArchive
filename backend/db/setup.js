/* schema.sql을 DATABASE_URL 대상 Postgres에 적용한다.
   psql CLI 설치 여부와 무관하게 동작하도록 pg 드라이버로 직접 실행. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import "dotenv/config";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL이 설정되지 않았습니다. backend/.env에 추가하세요.");
  process.exit(1);
}

const schema = readFileSync(path.join(__dirname, "schema.sql"), "utf8");

/* Supabase 등 원격 Postgres는 SSL 필수(자체 CA라 인증서 검증은 생략). 로컬 docker는 SSL 미사용. */
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(DATABASE_URL);
const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(schema);
  console.log("schema.sql 적용 완료.");
} catch (err) {
  const detail = err.errors?.map((e) => e.message).join(", ") || err.message || String(err);
  console.error("스키마 적용 실패:", detail);
  process.exitCode = 1;
} finally {
  await client.end();
}
