import { Router } from "express";
import { readSession, clearSession, isSessionEnabled } from "../services/session.js";
import { getUserWithRoles } from "../services/users.js";

/* 세션 복원/해제 라우트.
   - GET  /api/auth/me     : 쿠키의 JWT 검증 → 유저정보+역할 반환 (미로그인 시 user:null)
   - POST /api/auth/logout : 세션 쿠키 삭제 */
const router = Router();

router.get("/me", async (req, res) => {
  if (!isSessionEnabled()) return res.json({ user: null });
  const session = readSession(req);
  if (!session) return res.json({ user: null });
  try {
    const user = await getUserWithRoles(session.userId);
    if (!user) {
      clearSession(res); // 세션은 유효하나 유저가 없음(탈퇴 등) — 쿠키 정리
      return res.json({ user: null });
    }
    res.json({ user });
  } catch (e) {
    console.error("session me error", e);
    res.status(500).json({ error: "세션 확인에 실패했습니다." });
  }
});

router.post("/logout", (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

export default router;
