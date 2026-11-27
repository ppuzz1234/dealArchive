/* DB 역할(user_role) ↔ 프론트 userType ↔ 유형별 홈 경로 매핑.
   Login(로그인 직후)과 AppContext(세션 복원) 양쪽에서 사용. */
export const ROLE_TO_TYPE = { lp_individual: "hnw", lp_institution: "institution", gp: "manager" };
export const HOME_BY_TYPE = { hnw: "/hnw", institution: "/", manager: "/gp/dashboard" };
