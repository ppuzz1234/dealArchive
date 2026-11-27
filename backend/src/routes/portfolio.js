import { Router } from "express";
import { fof } from "../mockData.js";
import { listHoldings, createHolding, exitHolding } from "../services/portfolio.js";

const router = Router();

// GET /api/portfolio — Fund of Funds 통합 대시보드 데이터 (기관 화면용 목업 유지)
router.get("/", (_req, res) => res.json(fof));

// GET /api/portfolio/holdings?userId= — 개인 LP의 활성 보유내역 (DB)
router.get("/holdings", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "userId가 필요합니다." });
  try {
    const holdings = await listHoldings(String(userId));
    if (holdings === null) return res.json({ persisted: false, holdings: [] }); // DB 미설정
    res.json({ persisted: true, holdings });
  } catch (e) {
    console.error("list holdings error", e);
    res.status(500).json({ error: "보유내역 조회에 실패했습니다." });
  }
});

// POST /api/portfolio/invest — 투자 체결 { userId, dealSlug, amountMan(만원) }
router.post("/invest", async (req, res) => {
  const { userId, dealSlug, amountMan } = req.body || {};
  if (!userId || !dealSlug || !(Number(amountMan) > 0)) {
    return res.status(400).json({ error: "userId, dealSlug, amountMan(양수)이 필요합니다." });
  }
  try {
    const created = await createHolding({ userId, dealSlug, amountMan: Number(amountMan) });
    if (created === null) return res.json({ persisted: false }); // DB 미설정 — 프론트 상태로만 유지
    res.json({ persisted: true, ...created });
  } catch (e) {
    console.error("invest error", e);
    res.status(500).json({ error: "투자 기록 저장에 실패했습니다." });
  }
});

// POST /api/portfolio/exit — 매도 { userId, holdingId } (화면 재활성화 대비)
router.post("/exit", async (req, res) => {
  const { userId, holdingId } = req.body || {};
  if (!userId || !holdingId) return res.status(400).json({ error: "userId, holdingId가 필요합니다." });
  try {
    const ok = await exitHolding(holdingId, userId);
    res.json({ ok: Boolean(ok) });
  } catch (e) {
    console.error("exit error", e);
    res.status(500).json({ error: "매도 처리에 실패했습니다." });
  }
});

export default router;
