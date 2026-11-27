// 금액 포맷 (억/조) — 법인·펀드 스케일
export const won = (n) =>
  n >= 10000 ? Number((n / 10000).toFixed(2)) + "조" : n.toLocaleString() + "억";

// 금액 포맷 (만원/억) — 개인투자(HNW) 스케일
export const manwon = (n) =>
  n >= 10000 ? Number((n / 10000).toFixed(1)) + "억" : n.toLocaleString() + "만원";

/* ---------------- HNW 포트폴리오 · 밸류에이션 계산 (홈 요약 카드·포트폴리오 화면이 공유) ----------------
   confirmed = deal.valuation(억) / 10000  →  $B, 딜 리스트에서 이미 쓰는 won(deal.valuation)과 동일 숫자.
   acquired  = confirmed / (1 + roundChange%)  →  "종전 라운드 대비" 상승률을 역산한 취득 시점 가치.
   band는 deal.valuationBand([low, high], $B)가 있는 딜만 존재 — 없으면 "확정 기준". */
export function valuationTrack(deal) {
  const confirmed = deal.valuation / 10000;
  const acquired = confirmed / (1 + deal.roundChange / 100);
  const [bandLow, bandHigh] = deal.valuationBand || [];
  return { confirmed, acquired, bandLow, bandHigh };
}

export const fmtB = (n) => "$" + n.toFixed(1) + "B";

// 취득/확정/밴드 3점을 하나의 선형 스케일에 배치 — 밴드가 있으면 domainMax=bandHigh, 없으면 confirmed*1.4(여유 공간).
export function gaugeLayout({ acquired, confirmed, bandLow, bandHigh }) {
  const hasBand = bandHigh != null;
  const domainMax = hasBand ? bandHigh : confirmed * 1.4;
  return {
    hasBand,
    fillPct: Math.min(100, (confirmed / domainMax) * 100),
    bandStartPct: hasBand ? (bandLow / domainMax) * 100 : null,
    buyPct: Math.min(100, (acquired / domainMax) * 100),
  };
}

// 특정 라운드 기준(basis: "confirmed"|"band")으로 배수/평가액/수익률 계산.
// basis="band"인데 밴드가 없는 딜이면 자동으로 확정 기준으로 대체된다.
export function evalByBasis(track, amount, basis) {
  const useBand = basis === "band" && track.bandHigh != null;
  if (!useBand) {
    const mult = track.confirmed / track.acquired;
    return { useBand: false, mult, pct: (mult - 1) * 100, value: Math.round(amount * mult) };
  }
  const multLow = track.bandLow / track.acquired;
  const multHigh = track.bandHigh / track.acquired;
  return {
    useBand: true,
    mult: [multLow, multHigh],
    pct: [(multLow - 1) * 100, (multHigh - 1) * 100],
    value: [Math.round(amount * multLow), Math.round(amount * multHigh)],
  };
}

// 내비게이션 설정
export const NAV = [
  { group: "게이트웨이" },
  { to: "/", ic: "◈", label: "Barbell", end: true },
  { group: "자산이전 여정" },
  { to: "/step1", ic: "①", label: "진단 · 시뮬레이터", step: "STEP 1" },
  { to: "/step2", ic: "②", label: "비히클 설립", step: "STEP 2" },
  { to: "/step3", ic: "③", label: "한화 디지털 딜룸", step: "STEP 3" },
  { group: "코어 모듈" },
  { to: "/dual", ic: "⇄", label: "메인-승계 듀얼 시뮬레이터" },
  { to: "/bridge", ic: "✈", label: "글로벌 자산이전 브릿지" },
  { to: "/singapore", ic: "◉", label: "싱가포르 라이선스 허브" },
];

export const STEPS = [
  { to: "/step1", label: "진단" },
  { to: "/step2", label: "비히클 설립" },
  { to: "/step3", label: "딜룸 집행" },
];

export const BOTTOM = [
  { to: "/", ic: "◈", label: "Room", end: true },
  { to: "/step1", ic: "①", label: "진단" },
  { to: "/step2", ic: "②", label: "비히클" },
  { to: "/step3", ic: "③", label: "딜룸" },
  { sheet: true, ic: "⋯", label: "모듈" },
];

export const MODULE_ROUTES = ["/dual", "/bridge", "/singapore"];
