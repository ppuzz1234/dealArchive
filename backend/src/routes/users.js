import { Router } from "express";
import { saveUserRole } from "../services/users.js";

/* 유저 온보딩/역할 API.
   프론트 userType("hnw"|"institution"|"manager") ↔ DB user_role_type 매핑은 여기서 처리. */
const router = Router();

const TYPE_TO_ROLE = {
  hnw: "lp_individual",
  institution: "lp_institution",
  manager: "gp",
};

// POST /api/users/role — 온보딩 완료 시 역할 기록 { userId, userType }
router.post("/role", async (req, res) => {
  const { userId, userType } = req.body || {};
  const role = TYPE_TO_ROLE[userType];
  if (!userId || !role) {
    return res.status(400).json({ error: "userId와 userType(hnw|institution|manager)이 필요합니다." });
  }
  try {
    const saved = await saveUserRole(userId, role);
    res.json({ ok: true, persisted: saved, role });
  } catch (e) {
    console.error("save role error", e);
    res.status(500).json({ error: "역할 저장에 실패했습니다." });
  }
});

export default router;
