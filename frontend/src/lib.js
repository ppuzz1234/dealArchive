/* 공용 유틸 — 등급 계산, 분류 이름, 포맷 */

export const GRADE_IDS = ["A", "B+", "B", "C"];
export const GRADE_SCORE = { A: 4, "B+": 3, B: 2, C: 1 };
export const gradeClass = (g) => (g === "B+" ? "g-Bp" : g ? `g-${g}` : "g-none");
export const gradeVar = (g) => `var(--${gradeClass(g)})`;

/* 평균 점수 → 가장 가까운 등급 (백엔드 taxonomy.scoreToGrade 와 동일) */
export const scoreToGrade = (s) => {
  if (s == null || Number.isNaN(s)) return null;
  if (s >= 3.5) return "A";
  if (s >= 2.5) return "B+";
  if (s >= 1.5) return "B";
  return "C";
};

/* 합의 등급 — 투표 평균 */
export const consensus = (deal) => scoreToGrade(deal?.avg_score);

export const gradeDist = (grades = []) => {
  const out = { A: 0, "B+": 0, B: 0, C: 0 };
  for (const g of grades) if (g in out) out[g] += 1;
  return out;
};

export function catName(meta, cat, sub) {
  const c = meta?.categories.find((x) => x.id === cat);
  if (!c) return cat || "-";
  if (!sub) return c.name;
  return c.subs.find((s) => s.id === sub)?.name || sub;
}

export const fmtDate = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

export const fmtAgo = (v) => {
  const t = new Date(v).getTime();
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}일 전`;
  return fmtDate(v);
};

export const fmtSize = (n) => (n < 1024 ? `${n}B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)}KB` : `${(n / 1024 / 1024).toFixed(1)}MB`);

export const initials = (name = "") => name.slice(-2);

/* "해외 사례 / 국내: ..." 형식의 사례 문자열을 해외/국내로 분리 */
export function splitCases(text) {
  if (!text) return [];
  const idx = text.search(/\/\s*국내\s*:/);
  if (idx < 0) return [{ tag: "사례", body: text.trim() }];
  return [
    { tag: "해외", body: text.slice(0, idx).trim() },
    { tag: "국내", body: text.slice(idx).replace(/^\/\s*국내\s*:\s*/, "").trim() },
  ];
}

export const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

export function metricAverages(meta, deals) {
  const out = {};
  for (const m of meta.metrics) {
    out[m.id] = avg(deals.map((d) => d.metrics?.[m.id]).filter((v) => v != null));
  }
  return out;
}

export const matchesSearch = (d, q) => {
  if (!q) return true;
  const s = q.trim().toLowerCase();
  return [d.name, d.summary, d.cases, d.risks, d.owner_name, d.vehicle, ...(d.tags || [])]
    .filter(Boolean)
    .some((t) => t.toLowerCase().includes(s));
};
