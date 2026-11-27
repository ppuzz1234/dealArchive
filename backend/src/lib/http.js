/* 라우트 공통 — async 에러 전달, 현재 사용자(로그인 전 단계: X-User-Id 헤더), 입력 정리 */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* 로그인/SSO 도입 전까지는 화면에서 고른 담당자 id를 헤더로 받는다. */
export function currentUserId(req) {
  const id = Number(req.get("x-user-id"));
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function requireUser(req) {
  const id = currentUserId(req);
  if (!id) throw new HttpError(400, "담당자를 먼저 선택하세요 (X-User-Id)");
  return id;
}

export const clean = (v) => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};
