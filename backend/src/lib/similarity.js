/* 유사 딜 — 분류(같은 소분류/대분류) + 6대 지표 거리 + 지역·비히클 일치를 가중합.
   점수는 0~1, 근거(reasons)를 함께 돌려 화면에서 "왜 비슷한지" 보여준다. */
import { METRICS } from "../taxonomy.js";

const MAX_DIST = Math.sqrt(METRICS.length * 16); // 각 지표 1~5 → 최대 차 4

function metricSimilarity(a, b) {
  a = a || {};
  b = b || {};
  const keys = METRICS.map((m) => m.id).filter((k) => a[k] != null && b[k] != null);
  if (keys.length < 3) return null;
  const d = Math.sqrt(keys.reduce((s, k) => s + (a[k] - b[k]) ** 2, 0) * (METRICS.length / keys.length));
  return 1 - d / MAX_DIST;
}

export function similarDeals(target, all, limit = 6) {
  return all
    .filter((d) => d.id !== target.id)
    .map((d) => {
      const reasons = [];
      let tax = 0;
      if (d.subcategory && d.subcategory === target.subcategory) { tax = 1; reasons.push("같은 소분류"); }
      else if (d.category === target.category) { tax = 0.6; reasons.push("같은 대분류"); }
      const ms = metricSimilarity(target.metrics, d.metrics);
      if (ms != null && ms >= 0.8) reasons.push(`지표 유사 ${Math.round(ms * 100)}%`);
      const sameRegion = d.region && d.region === target.region;
      if (sameRegion) reasons.push(`${d.region}`);
      const sameVehicle = d.vehicle && target.vehicle && d.vehicle === target.vehicle;
      if (sameVehicle) reasons.push("같은 비히클");
      const score = 0.4 * tax + 0.45 * (ms ?? 0.5) + 0.1 * (sameRegion ? 1 : 0) + 0.05 * (sameVehicle ? 1 : 0);
      return { id: d.id, score: Math.round(score * 100) / 100, metricSimilarity: ms, reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
