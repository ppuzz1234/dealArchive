/* Barbell 브랜드 마크 — 실제 바벨처럼 봉 양쪽에 원판을 3장씩(총 6장) 끼운 모양.
   안쪽→바깥쪽 순서로 원판 색상이 짙은 주황(#F37321) → 중간(#F89B6C) → 연한 살구색(#FBB584)으로
   이어지고, 원판 사이에는 살짝 간격을 두어 "여러 장이 꽂혀있다"는 느낌을 준다.
   봉의 양 끝은 가장 바깥 원판보다 더 바깥으로 나오도록 그린다.
   animated=true 이면 이 마크 자체가 로딩 인디케이터가 된다 — 양쪽 원판이 안쪽→중간→바깥쪽
   순서로 두 장씩(좌우 동시) 총 세 번 봉에 "꽂히는" 동작을 반복하며 로딩 중임을 표현한다. */
export default function BrandMark({ size = 22, animated = false }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40.84 24"
      fill="currentColor"
      aria-hidden="true"
      className={animated ? "brand-mark-loading" : undefined}
    >
      {/* 봉 — 원판보다 양끝이 더 길게 나온다. 길어진 만큼은 가운데 그립 구간이 늘어난다 */}
      <rect x="0.4" y="11.1" width="40.04" height="1.8" rx="0.9" fill="#B4A898" />

      {/* 왼쪽/오른쪽 안쪽 원판 — 로딩 시 1번째로, 좌우가 동시에 꽂힌다 */}
      <rect className="bm-plate bm-plate-0" fill="#F37321" style={{ "--dx": "-14px" }} x="10" y="5.385" width="2.8" height="13.23" rx="1.4" />
      <rect className="bm-plate bm-plate-0" fill="#F37321" style={{ "--dx": "14px" }} x="28.04" y="5.385" width="2.8" height="13.23" rx="1.4" />

      {/* 왼쪽/오른쪽 중간 원판 — 2번째 순번 */}
      <rect className="bm-plate bm-plate-1" fill="#F89B6C" style={{ "--dx": "-14px" }} x="6.7" y="5.385" width="2.8" height="13.23" rx="1.4" />
      <rect className="bm-plate bm-plate-1" fill="#F89B6C" style={{ "--dx": "14px" }} x="31.34" y="5.385" width="2.8" height="13.23" rx="1.4" />

      {/* 왼쪽/오른쪽 바깥 원판 — 3번째 순번, 이 시점에 원판 6장이 모두 쌓인다 */}
      <rect className="bm-plate bm-plate-2" fill="#FBB584" style={{ "--dx": "-14px" }} x="3.4" y="5.385" width="2.8" height="13.23" rx="1.4" />
      <rect className="bm-plate bm-plate-2" fill="#FBB584" style={{ "--dx": "14px" }} x="34.64" y="5.385" width="2.8" height="13.23" rx="1.4" />
    </svg>
  );
}
