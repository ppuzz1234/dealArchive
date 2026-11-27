/* 백엔드 API 헬퍼 — dev는 vite proxy(/api → :4700), 운영은 VITE_API_BASE(예: https://api.도메인/api).
   로그인 도입 전까지 현재 담당자는 X-User-Id 헤더로 전달한다. */
export const BASE = import.meta.env.VITE_API_BASE || "/api";

let currentUserId = null;
export const setApiUser = (id) => { currentUserId = id; };

async function req(path, { method = "GET", body, form } = {}) {
  const headers = {};
  if (currentUserId) headers["X-User-Id"] = String(currentUserId);
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: form || (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
  return data;
}

export const api = {
  meta: () => req("/meta"),
  users: () => req("/users"),
  addUser: (name) => req("/users", { method: "POST", body: { name } }),

  deals: (status) => req(`/deals${status ? `?status=${status}` : ""}`),
  deal: (id) => req(`/deals/${id}`),
  createDeal: (d) => req("/deals", { method: "POST", body: d }),
  updateDeal: (id, d) => req(`/deals/${id}`, { method: "PUT", body: d }),
  deleteDeal: (id) => req(`/deals/${id}`, { method: "DELETE" }),

  vote: (id, grade, comment) => req(`/deals/${id}/vote`, { method: "PUT", body: { grade, comment } }),
  unvote: (id) => req(`/deals/${id}/vote`, { method: "DELETE" }),
  ask: (id, body) => req(`/deals/${id}/questions`, { method: "POST", body: { body } }),
  answer: (qid, body) => req(`/questions/${qid}/answers`, { method: "POST", body: { body } }),
  deleteQuestion: (qid) => req(`/questions/${qid}`, { method: "DELETE" }),

  upload: (id, files) => {
    const form = new FormData();
    for (const f of files) form.append("files", f);
    return req(`/deals/${id}/attachments`, { method: "POST", form });
  },
  fileUrl: (aid) => `${BASE}/attachments/${aid}`,
  deleteFile: (aid) => req(`/attachments/${aid}`, { method: "DELETE" }),

  activity: (limit = 20) => req(`/activity?limit=${limit}`),
  feed: () => req("/feed"),
  addFeed: (d) => req("/feed", { method: "POST", body: d }),
  updateFeed: (id, d) => req(`/feed/${id}`, { method: "PUT", body: d }),
  deleteFeed: (id) => req(`/feed/${id}`, { method: "DELETE" }),
};
