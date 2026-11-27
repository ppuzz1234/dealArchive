/* 백엔드 API 헬퍼 (현재 화면은 src/data.js 목업을 사용).
   백엔드 연동 시 각 화면에서 data.js 대신 아래 함수들을 호출하도록 교체.
   dev 환경에서는 vite proxy(/api → :4700)로 전달됨. */
const BASE = import.meta.env.VITE_API_BASE || "/api";

async function req(path, options) {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    credentials: "include", // 운영에서 API가 서브도메인(api.도메인)일 때도 세션 쿠키 동봉
    ...options,
  });
  if (!res.ok) throw new Error(`API ${res.status} ${path}`);
  return res.json();
}

export const api = {
  health: () => req("/health"),
  // 세션 — httpOnly 쿠키 기반. me()는 브라우저 재시작 후 로그인 복원에 사용
  me: () => req("/auth/me"),
  logout: () => req("/auth/logout", { method: "POST" }),
  diagnose: (payload) => req("/diagnose", { method: "POST", body: JSON.stringify(payload || {}) }),
  advisors: () => req("/advisors"),
  consult: (id, question) => req(`/advisors/${id}/consult`, { method: "POST", body: JSON.stringify({ question }) }),
  tranches: () => req("/deals/tranches"),
  clubDeals: () => req("/deals/club"),
  commit: (dealId, amount) => req("/deals/commit", { method: "POST", body: JSON.stringify({ dealId, amount }) }),
  portfolio: () => req("/portfolio"),
  singaporeLicenses: () => req("/singapore/licenses"),
  // 온보딩 완료 시 역할 기록 — 다음 로그인부터 온보딩 스킵하고 홈 직행
  saveRole: (userId, userType) =>
    req("/users/role", { method: "POST", body: JSON.stringify({ userId, userType }) }),
  // 개인 LP 포트폴리오 (DB 영속화) — amount는 만원 단위
  holdings: (userId) => req(`/portfolio/holdings?userId=${encodeURIComponent(userId)}`),
  invest: (userId, dealSlug, amountMan) =>
    req("/portfolio/invest", { method: "POST", body: JSON.stringify({ userId, dealSlug, amountMan }) }),
};
