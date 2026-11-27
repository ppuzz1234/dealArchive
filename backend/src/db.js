/* DB 어댑터 — DATABASE_URL 이 있으면 Postgres(pg 풀, 운영 Supabase), 없으면 PGlite(내장 Postgres, 로컬 파일).
   두 드라이버 모두 같은 SQL과 같은 { rows } 결과 형태를 쓰므로 라우트는 드라이버를 의식하지 않는다. */
import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATABASE_URL = process.env.DATABASE_URL || "";

let driver;

if (DATABASE_URL) {
  const pg = (await import("pg")).default;
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(DATABASE_URL);
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 5,
  });
  driver = {
    kind: "postgres",
    query: (text, params) => pool.query(text, params),
    exec: (sql) => pool.query(sql),
    close: () => pool.end(),
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const out = await fn({ query: (t, p) => client.query(t, p) });
        await client.query("commit");
        return out;
      } catch (e) {
        await client.query("rollback");
        throw e;
      } finally {
        client.release();
      }
    },
  };
} else {
  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir = process.env.PGLITE_DIR || path.resolve(__dirname, "../.data/pglite");
  fs.mkdirSync(path.dirname(dataDir), { recursive: true });
  const db = new PGlite(dataDir);
  await db.waitReady;
  driver = {
    kind: "pglite",
    dataDir,
    query: (text, params) => db.query(text, params),
    exec: (sql) => db.exec(sql),
    close: () => db.close(),
    tx:(fn) => db.transaction((t) => fn({ query: (q, p) => t.query(q, p) })),
  };
}

export const db = driver;
export const query = (text, params) => driver.query(text, params);
