import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { DB, companies as seedCompanies, companyOrder as seedOrder, defaultCompanyId, buildCompany } from "../data.js";
import { api } from "../api.js";
import { ROLE_TO_TYPE } from "../auth/roles.js";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

let _id = 0;

/* 개발용 우회 진입 (npm run dev 에서만 동작, 빌드에선 제거됨)
   URL에 ?dev 를 붙이면 로그인/온보딩 없이 법인투자(PC) 화면으로 바로 진입.
   예) http://localhost:4699/step1?dev — 탭을 닫거나 로그아웃할 때까지 유지 */
const DEV_KEY = "dealarchive-dev-enter";
const devBypass = (() => {
  if (!import.meta.env.DEV) return false;
  try {
    if (new URLSearchParams(window.location.search).has("dev")) sessionStorage.setItem(DEV_KEY, "1");
    return sessionStorage.getItem(DEV_KEY) === "1";
  } catch {
    return false;
  }
})();

export function AppProvider({ children }) {
  // ----- 화면 테마 (라이트/다크) — 선택값은 로컬 저장소에 유지 -----
  const [theme, setThemeState] = useState(() => localStorage.getItem("babel-theme") || "dark");
  const setTheme = useCallback((t) => {
    setThemeState(t);
    localStorage.setItem("babel-theme", t);
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // ----- 진입 게이트 (스플래시 → 로그인 → 타입선택 → 입장) -----
  // entered=false 이면 앱 본체(/) 접근 시 스플래시로 리다이렉트
  const [auth, setAuth] = useState({ entered: devBypass, user: null, provider: null });
  const [userType, setUserType] = useState(devBypass ? "institution" : null); // "hnw"(개인투자) | "institution"(법인투자) | "manager"(운용사)

  const signIn = useCallback((provider, user) => setAuth((a) => ({ ...a, user, provider })), []);
  const enter = useCallback(() => setAuth((a) => ({ ...a, entered: true })), []);
  // 로그아웃/역할변경 공용 — 인증 상태와 함께 개인 여정 상태도 비워
  // 다음 로그인 사용자에게 이전 세션의 진단/청약/보유내역이 남지 않게 한다.
  const reset = useCallback(() => {
    api.logout().catch(() => {}); // 세션 쿠키 삭제 — 실패해도 로컬 상태는 초기화
    try { sessionStorage.removeItem(DEV_KEY); } catch {} // 개발용 우회 진입도 해제
    setAuth({ entered: false, user: null, provider: null });
    setUserType(null);
    setDiag({ done: false, advisor: null });
    setVehicle({ trust: false, llc: false });
    setCommits({});
    setSectorInterest(null);
    setHnwHoldings([]);
  }, []);

  // ----- 세션 복원 (앱 부팅 시 1회) -----
  // OAuth 로그인 시 발급된 httpOnly 쿠키를 /api/auth/me 로 검증해
  // 브라우저를 껐다 켜도 로그인 상태를 되살린다. 온보딩 완료(역할 보유) 유저는
  // entered까지 열어 로그인 화면이 홈으로 통과시키게 한다.
  useEffect(() => {
    api.me()
      .then((r) => {
        if (!r.user || devBypass) return; // 우회 진입 중엔 세션 복원이 상태를 덮어쓰지 않게
        const type = ROLE_TO_TYPE[(r.user.roles || [])[0]];
        setAuth({ entered: Boolean(type), user: r.user, provider: r.user.provider });
        if (type) setUserType(type);
      })
      .catch(() => {}); // 백엔드 미기동/세션 없음 — 기존 로그인 흐름 유지
  }, []);

  // ----- 회사 레지스트리 (런타임 확장 가능) -----
  const [companies, setCompanies] = useState({ ...seedCompanies });
  const [companyOrder, setCompanyOrder] = useState([...seedOrder]);
  const [companyId, setCompanyId] = useState(defaultCompanyId);
  const company = companies[companyId];

  // ----- 여정 상태 (네비게이션 간 유지) -----
  const [diag, setDiag] = useState({ done: false, advisor: null });

  // 회사 전환 시 진단 상태 초기화 (새 회사로 재진단)
  const switchCompany = useCallback((id) => {
    setCompanyId(id);
    setDiag({ done: false, advisor: null });
  }, []);

  // 기업 검색에서 선택 — 미등록 회사면 진단 프로필 생성 후 레지스트리에 추가
  const registerCompany = useCallback((entry) => {
    const built = buildCompany(entry);
    setCompanies((prev) => (prev[built.id] ? prev : { ...prev, [built.id]: built }));
    setCompanyOrder((prev) => (prev.includes(built.id) ? prev : [built.id, ...prev]));
    setCompanyId(built.id);
    setDiag({ done: false, advisor: null });
    return built.id;
  }, []);

  const [vehicle, setVehicle] = useState({ trust: false, llc: false });
  const [commits, setCommits] = useState({}); // dealId -> 억

  // ----- 개인투자(HNW) 관심 산업(온보딩 중 선택) -----
  const [sectorInterest, setSectorInterest] = useState(null);

  // ----- 개인투자(HNW) 보유 SPV 지분 -----
  // DB(holding 테이블)가 원천이며 로그인 시 아래 useEffect로 불러온다.
  // 데모 로그인(userId 없음)이나 DB 미설정 시에는 메모리 상태로만 유지.
  const [hnwHoldings, setHnwHoldings] = useState([]); // { dealId, amount(만원), investedAt, holdingId? }
  const invest = useCallback(
    (dealId, amount) => {
      setHnwHoldings((h) => [...h, { dealId, amount, investedAt: Date.now() }]);
      const userId = auth.user?.userId;
      if (userId) api.invest(userId, dealId, amount).catch(() => {}); // 실패해도 화면 흐름 유지
    },
    [auth.user]
  );
  const exitHolding = useCallback((idx) => setHnwHoldings((h) => h.filter((_, i) => i !== idx)), []);

  // 로그인(userId 확보) 시 DB 보유내역으로 동기화 — 재로그인해도 포트폴리오 유지
  useEffect(() => {
    const userId = auth.user?.userId;
    if (!userId) return;
    api.holdings(userId)
      .then((r) => { if (r.persisted) setHnwHoldings(r.holdings); })
      .catch(() => {}); // 조회 실패 시 메모리 상태 유지
  }, [auth.user?.userId]);

  // ----- 토스트 / 방어 팝업 -----
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (opt) => {
      const id = ++_id;
      setToasts((t) => [...t, { id, ...opt }]);
      const ttl = opt.actions && opt.actions.length ? 4000 : 2000;
      setTimeout(() => dismiss(id), ttl);
      return id;
    },
    [dismiss]
  );

  // ----- 모달 (React 노드 보관) -----
  const [modal, setModal] = useState(null);
  const openModal = useCallback((node) => setModal(node), []);
  const closeModal = useCallback(() => setModal(null), []);

  const value = {
    theme, setTheme,
    auth, signIn, enter, reset,
    userType, setUserType,
    companies, companyOrder,
    companyId, company, switchCompany, registerCompany,
    diag, setDiag,
    vehicle, setVehicle,
    commits, setCommits,
    sectorInterest, setSectorInterest,
    hnwHoldings, invest, exitHolding,
    toasts, toast, dismiss,
    modal, openModal, closeModal,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
