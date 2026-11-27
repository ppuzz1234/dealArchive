/* Postgres 커넥션 풀 (Supabase Session pooler / 로컬 docker 공용).
   DATABASE_URL 미설정 시 pool=null — 각 라우트는 DB 없이도 데모 흐름을 유지해야 한다. */
import "dotenv/config";
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL || "";
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(DATABASE_URL);

export const pool = DATABASE_URL
  ? new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 5, // Supabase pooler를 거치므로 서버측 풀은 작게 유지
    })
  : null;
