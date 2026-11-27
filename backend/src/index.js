/* dotenv는 반드시 첫 import — db.js 등이 모듈 스코프에서 process.env를 읽는다 */
import "dotenv/config";
import express from "express";
import cors from "cors";

import { bootstrap } from "./bootstrap.js";
import { db } from "./db.js";
import deals from "./routes/deals.js";
import misc from "./routes/misc.js";

const app = express();
const PORT = process.env.PORT || 4700;
const ORIGIN = (process.env.CORS_ORIGIN || "http://localhost:4699").split(",").map((s) => s.trim());

app.use(cors({ origin: ORIGIN }));
app.use(express.json({ limit: "2mb" }));

app.use((req, _res, next) => {
  if (req.method !== "GET") console.log(`${new Date().toISOString()}  ${req.method} ${req.url}`);
  next();
});

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, service: "dealarchive-api", version: "0.2.0", time: new Date().toISOString() })
);

app.use("/api/deals", deals);
app.use("/api", misc);

app.use((_req, res) => res.status(404).json({ error: "Not Found" }));

app.use((err, _req, res, _next) => {
  if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "파일은 15MB 이하만 업로드할 수 있습니다" });
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
});

const info = await bootstrap();

// 정상 종료 — PGlite는 닫지 않고 끊기면 다음 기동 때 복구 과정을 거친다
const shutdown = async () => {
  try { await db.close(); } finally { process.exit(0); }
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

app.listen(PORT, () => {
  console.log(`\n  DealArchive API  ▸ http://localhost:${PORT}/api/health`);
  console.log(`  DB: ${info.driver}${info.seeded ? " (시트 34건 시드 완료)" : ""}  ·  CORS: ${ORIGIN.join(", ")}\n`);
});
