import { Router } from "express";
import crypto from "node:crypto";
import { upsertOAuthUser } from "../services/users.js";
import { issueSession } from "../services/session.js";

/* ============================================================
   구글 로그인 OAuth 2.0 (Authorization Code) — 실연동 라우트
   환경변수(backend/.env):
     GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL
   Google Cloud Console > API 및 서비스 > 사용자 인증 정보에서
   "OAuth 클라이언트 ID(웹 애플리케이션)"를 만들고, 승인된 리디렉션 URI에
   GOOGLE_CALLBACK_URL 과 동일한 값을 등록해야 한다.
   미설정 시 status.configured=false → 프론트는 데모 모드로 동작.
   로그인 성공 시 user_master/auth_identity 에 upsert 하고 userId를 함께 돌려준다.
   ============================================================ */
const router = Router();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const isConfigured = Boolean(CLIENT_ID && CLIENT_SECRET);

const callbackUrl = (req) =>
  process.env.GOOGLE_CALLBACK_URL ||
  `${req.protocol}://${req.get("host")}/api/auth/google/callback`;

// state 임시 저장 (CSRF 방지). 데모 규모 — 인메모리.
const states = new Set();

// GET /api/auth/google/status — 자격증명 설정 여부
router.get("/google/status", (_req, res) => res.json({ configured: isConfigured }));

// GET /api/auth/google/login — 구글 인증 페이지로 리다이렉트 (팝업이 이 URL을 연다)
router.get("/google/login", (req, res) => {
  if (!isConfigured) return res.status(503).send("구글 로그인이 설정되지 않았습니다.");
  const state = crypto.randomBytes(12).toString("hex");
  states.add(state);
  setTimeout(() => states.delete(state), 5 * 60 * 1000);

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", callbackUrl(req));
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  res.redirect(url.toString());
});

// 부모창으로 결과를 postMessage 하고 팝업을 닫는 HTML 응답
function relayHtml(payload) {
  const json = JSON.stringify({ source: "google-login", ...payload });
  return `<!doctype html><meta charset="utf-8"><body style="background:#0E1116;color:#9DAAB8;font-family:system-ui;display:grid;place-items:center;height:100vh">
<p>구글 로그인 처리 중…</p>
<script>
  try { (window.opener || window.parent).postMessage(${json}, "*"); } catch (e) {}
  setTimeout(function(){ window.close(); }, 300);
</script></body>`;
}

// GET /api/auth/google/callback — 구글 리다이렉트 수신 → 토큰 교환 → 프로필 조회 → DB upsert
router.get("/google/callback", async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.send(relayHtml({ error: String(error) }));
  if (!code || !state || !states.has(state)) {
    return res.send(relayHtml({ error: "유효하지 않은 인증 응답입니다." }));
  }
  states.delete(state);

  try {
    // 1) 코드 → 액세스 토큰 (구글은 POST form 방식)
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: String(code),
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: callbackUrl(req),
      }),
    });
    const token = await tokenRes.json();
    if (!token.access_token) {
      return res.send(relayHtml({ error: token.error_description || "토큰 교환 실패" }));
    }

    // 2) 액세스 토큰 → 사용자 프로필 (sub/name/email/picture)
    const meRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const me = await meRes.json();
    if (!me.sub) {
      return res.send(relayHtml({ error: "프로필 조회 실패" }));
    }

    // 3) DB upsert — 실패해도 로그인 흐름은 유지 (userId 없이 프로필만 전달)
    //    roles: 온보딩을 완료한 기존 유저 판별용 (프론트가 홈 직행 여부 결정)
    let db = null;
    try {
      db = await upsertOAuthUser({
        provider: "google",
        providerUid: me.sub,
        email: me.email || null,
        name: me.name || null,
        nickname: me.given_name || null,
        profileImageUrl: me.picture || null,
        rawProfile: me,
      });
    } catch (e) {
      console.error("google upsert error", e);
    }

    if (db?.userId) issueSession(res, db.userId); // 7일 세션 쿠키 — 브라우저 재시작 후 /api/auth/me 로 복원

    return res.send(
      relayHtml({
        profile: {
          id: me.sub,
          userId: db?.userId || null,
          isNewUser: db ? db.isNew : null,
          roles: db?.roles || [],
          name: me.name || "Google 사용자",
          email: me.email || "",
          nickname: me.given_name || "",
          profileImage: me.picture || "",
        },
      })
    );
  } catch (e) {
    console.error("google callback error", e);
    return res.send(relayHtml({ error: "구글 인증 처리 중 오류가 발생했습니다." }));
  }
});

export default router;
