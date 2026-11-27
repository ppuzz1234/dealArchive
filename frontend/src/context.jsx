/* 앱 전역 상태 — 메타(분류·지표), 담당자, 현재 사용자, 딜 목록 캐시, 토스트, 테마 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setApiUser } from "./api.js";

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* 저장 불가 환경 */ } },
};

export function AppProvider({ children }) {
  const [meta, setMeta] = useState(null);
  const [users, setUsers] = useState([]);
  const [deals, setDeals] = useState(null);
  const [userId, setUserIdState] = useState(() => Number(store.get("da.user")) || null);
  const [theme, setThemeState] = useState(() => store.get("da.theme") || "system");
  const [toasts, setToasts] = useState([]);
  const [error, setError] = useState(null);

  setApiUser(userId);

  const toast = useCallback((msg, kind = "info") => {
    const id = Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const reloadDeals = useCallback(async () => {
    const list = await api.deals();
    setDeals(list);
    return list;
  }, []);

  const reloadUsers = useCallback(async () => setUsers(await api.users()), []);

  // 일정(딜소싱 마감일·심사일) — 딜이 등록되면 회차별 등록 현황이 바뀌므로 딜 목록과 함께 갱신
  const [schedule, setSchedule] = useState([]);
  const reloadSchedule = useCallback(async () => setSchedule(await api.schedule()), []);
  useEffect(() => { reloadSchedule().catch(() => {}); }, [deals, reloadSchedule]);

  useEffect(() => {
    Promise.all([api.meta(), api.users()])
      .then(([m, u]) => { setMeta(m); setUsers(u); })
      .catch((e) => setError(e.message));
  }, []);

  // 사용자 전환 시 my_grade 가 달라지므로 목록 재조회
  useEffect(() => { reloadDeals().catch((e) => setError(e.message)); }, [userId, reloadDeals]);

  useEffect(() => {
    if (theme === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const setUserId = (id) => { store.set("da.user", id ? String(id) : null); setApiUser(id); setUserIdState(id); };
  const setTheme = (t) => { store.set("da.theme", t); setThemeState(t); };

  const me = users.find((u) => u.id === userId) || null;

  /* 쓰기 동작 공통 — 담당자 미선택이면 막고, 에러는 토스트로 */
  const run = useCallback(async (fn, okMsg) => {
    if (!userId) { toast("먼저 오른쪽 위에서 담당자를 선택하세요", "error"); return null; }
    try {
      const out = await fn();
      if (okMsg) toast(okMsg);
      return out ?? true;
    } catch (e) {
      toast(e.message, "error");
      return null;
    }
  }, [userId, toast]);

  const value = useMemo(() => ({
    meta, users, deals, schedule, me, userId, setUserId, reloadDeals, reloadUsers, reloadSchedule, toast, run, theme, setTheme, error,
  }), [meta, users, deals, schedule, me, userId, reloadDeals, reloadUsers, reloadSchedule, toast, run, theme, error]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>)}
      </div>
    </Ctx.Provider>
  );
}
