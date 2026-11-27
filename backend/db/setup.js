/* 스키마 적용 / 시드 / 초기화
   npm run db:setup  -w backend   # 스키마만 적용
   npm run db:seed   -w backend   # 스키마 + (비어 있으면) 시트 34건 시드
   npm run db:reset  -w backend   # 모든 테이블 삭제 후 재생성 + 시드 (주의: 데이터 삭제) */
import { applySchema, resetDb, seedIfEmpty } from "../src/bootstrap.js";
import { db } from "../src/db.js";

const args = new Set(process.argv.slice(2));

if (args.has("--reset")) {
  await resetDb();
  console.log("✓ tables dropped");
}
await applySchema();
console.log(`✓ schema applied (${db.kind})`);
if (args.has("--seed")) {
  const seeded = await seedIfEmpty();
  console.log(seeded ? "✓ seeded" : "· deals already present — seed skipped");
}
process.exit(0);
