import jwt from "jsonwebtoken";

/* 세션 (JWT + httpOnly 쿠키).
   OAuth 로그인 성공 시 userId를 담은 JWT를 쿠키로 발급 → 브라우저 재시작 후에도
   GET /api/auth/me 로 로그인 상태를 복원한다. JWT_SECRET 미설정 시 세션 없이 동작(데모 호환). */

const SECRET = process.env.JWT_SECRET || "";
const COOKIE_NAME = "dealarchive_session";
const MAX_AGE_DAYS = 7;

export const isSessionEnabled = () => Boolean(SECRET);

export function issueSession(res, userId) {
  if (!SECRET || !userId) return;
  const token = jwt.sign({ sub: userId }, SECRET, { expiresIn: `${MAX_AGE_DAYS}d` });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production", // 로컬(http)에서는 false, 운영(https)에서는 true
    maxAge: MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function readSession(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token || !SECRET) return null;
  try {
    const payload = jwt.verify(token, SECRET);
    return { userId: payload.sub };
  } catch {
    return null; // 만료/변조 — 미로그인으로 취급
  }
}

export function clearSession(res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}
