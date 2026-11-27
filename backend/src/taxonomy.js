/* 분류 체계 · 6대 지표 · 등급 — 프론트는 GET /api/meta 로 받아 사용한다(단일 기준).
   대분류/소분류를 추가·변경할 때는 이 파일만 고치면 된다. id는 DB에 저장되므로 기존 id는 바꾸지 말 것. */

export const CATEGORIES = [
  {
    id: "credit", name: "크레딧·구조화",
    desc: "대출채권·유동화·리스크 이전 등 이자/프리미엄 수취형",
    subs: [
      { id: "abf", name: "자산담보대출(ABF)" },
      { id: "ils", name: "보험연계증권(ILS)" },
      { id: "srt", name: "은행 리스크이전(SRT)" },
      { id: "securitization", name: "유동화·ABS" },
      { id: "private_credit", name: "사모신용" },
    ],
  },
  {
    id: "real_asset", name: "실물자산·원자재",
    desc: "실물 보유형 원자재·금속",
    subs: [
      { id: "metals", name: "금속" },
      { id: "energy_commodity", name: "에너지 원자재" },
    ],
  },
  {
    id: "infra", name: "인프라·에너지전환",
    desc: "장기 이용료·리스 기반 인프라와 탈탄소 자산",
    subs: [
      { id: "energy_infra", name: "에너지 인프라" },
      { id: "transport", name: "교통 인프라" },
      { id: "transition", name: "탈탄소·전환" },
      { id: "space_defense", name: "우주·방산" },
    ],
  },
  {
    id: "real_estate", name: "부동산·레저",
    desc: "해외 부동산·호스피탈리티·토큰화 부동산",
    subs: [
      { id: "tokenized_re", name: "토큰화 부동산" },
      { id: "hospitality", name: "호스피탈리티·레저" },
      { id: "residential", name: "해외 주거" },
    ],
  },
  {
    id: "passion", name: "패션자산·IP",
    desc: "스포츠·음악·미술·악기 등 취향 기반 자산과 로열티",
    subs: [
      { id: "sports", name: "스포츠" },
      { id: "royalty", name: "로열티·음악" },
      { id: "art", name: "미술·갤러리" },
      { id: "collectibles", name: "악기·컬렉터블" },
    ],
  },
  {
    id: "insurance", name: "보험·연금",
    desc: "보험사 상품 구조를 활용한 연금·보장형",
    subs: [
      { id: "annuity", name: "연금" },
      { id: "fx_insurance", name: "외화보험" },
      { id: "pnc", name: "손해보험" },
    ],
  },
  {
    id: "liquid_alt", name: "리퀴드 얼터너티브",
    desc: "상장·일일유동성 전략형 ETF/펀드",
    subs: [
      { id: "buffer", name: "버퍼·옵션 전략" },
      { id: "managed_futures", name: "매니지드 퓨처스" },
      { id: "extension", name: "롱숏·확장 전략" },
    ],
  },
  {
    id: "digital", name: "디지털자산",
    desc: "크립토·토큰화·온체인 시장",
    subs: [
      { id: "crypto_income", name: "크립토 인컴" },
      { id: "tokenized_credit", name: "토큰화 신용" },
      { id: "onchain_market", name: "온체인 마켓" },
    ],
  },
  {
    id: "private_markets", name: "사모시장·GP",
    desc: "운용사 지분·세컨더리 등 사모시장 구조",
    subs: [
      { id: "gp_stakes", name: "GP 지분" },
      { id: "secondaries", name: "세컨더리" },
    ],
  },
  {
    id: "wm", name: "WM 솔루션·플랫폼",
    desc: "증여·승계·패밀리오피스 등 서비스형 솔루션",
    subs: [
      { id: "gifting", name: "증여·승계" },
      { id: "family_office", name: "패밀리오피스" },
    ],
  },
];

/* 육각형 6대 지표 — 1~5점. 높을수록 유리(안정성 = 하방방어가 강할수록 높음). */
export const METRICS = [
  { id: "return", name: "기대수익", hint: "목표·과거 수익률 수준" },
  { id: "stability", name: "안정성", hint: "하방방어·손실 가능성(높을수록 안정)" },
  { id: "liquidity", name: "유동성", hint: "환매·매도 용이성" },
  { id: "feasibility", name: "실행가능성", hint: "국내 규제·상품화 난이도(높을수록 쉬움)" },
  { id: "appeal", name: "고객매력도", hint: "HNW 수요·스토리" },
  { id: "synergy", name: "그룹 시너지", hint: "한화 밸류체인 연계" },
];

/* 등급 — 시트의 '우선순위'와 동일. 투표도 같은 4단계로만 받는다. */
export const GRADES = [
  { id: "A", score: 4 },
  { id: "B+", score: 3 },
  { id: "B", score: 2 },
  { id: "C", score: 1 },
];

export const REGIONS = ["북미", "유럽", "일본", "중동", "아시아", "글로벌", "국내"];

export const STATUSES = [
  { id: "review", name: "심사중" },
  { id: "archived", name: "아카이브" },
];

export const gradeScore = (g) => GRADES.find((x) => x.id === g)?.score ?? null;

/* 평균 점수 → 가장 가까운 등급 */
export const scoreToGrade = (s) => {
  if (s == null) return null;
  if (s >= 3.5) return "A";
  if (s >= 2.5) return "B+";
  if (s >= 1.5) return "B";
  return "C";
};

export const isValidCategory = (cat, sub) => {
  const c = CATEGORIES.find((x) => x.id === cat);
  return !!c && (!sub || c.subs.some((s) => s.id === sub));
};
