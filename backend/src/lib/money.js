/* 금액 단위 환산 유틸.
   DB는 모든 금액을 원 단위 bigint(*_krw)로 저장한다(2026-07-09 의사결정).
   프론트 표기 단위(억/만원)와의 환산은 전부 이 모듈을 통해 API 경계에서 수행한다.
   - commitment 입력: 억 → 원 (eokToKrw)
   - holding 입력: 만원 → 원 (manToKrw)
   Number는 2^53까지 정수를 정확히 표현하므로 원 단위 금액(수천조 미만)에 안전하다. */

export const KRW_PER_MAN = 10_000n;      // 만원
export const KRW_PER_EOK = 100_000_000n; // 억원

const toBigInt = (v) => {
  if (typeof v === "bigint") return v;
  if (!Number.isFinite(Number(v))) throw new TypeError(`금액이 숫자가 아닙니다: ${v}`);
  return BigInt(Math.round(Number(v)));
};

/** 만원 → 원. 소수 입력(예: 1.5만원)도 원 단위로 정확히 환산. */
export function manToKrw(man) {
  return Number(BigInt(Math.round(Number(man) * 100)) * KRW_PER_MAN / 100n);
}

/** 억 → 원. 소수 입력(예: 0.5억)도 원 단위로 정확히 환산. */
export function eokToKrw(eok) {
  return Number(BigInt(Math.round(Number(eok) * 100)) * KRW_PER_EOK / 100n);
}

/** 원 → 만원 (표시용, 소수 2자리 반올림) */
export function krwToMan(krw) {
  return Number(toBigInt(krw) * 100n / KRW_PER_MAN) / 100;
}

/** 원 → 억 (표시용, 소수 2자리 반올림) */
export function krwToEok(krw) {
  return Number(toBigInt(krw) * 100n / KRW_PER_EOK) / 100;
}
