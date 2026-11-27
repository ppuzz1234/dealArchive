import { Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "./context.jsx";
import Shell from "./components/Shell.jsx";
import Dashboard from "./screens/Dashboard.jsx";
import Explorer from "./screens/Explorer.jsx";
import DealDetail from "./screens/DealDetail.jsx";
import DealForm from "./screens/DealForm.jsx";
import Review from "./screens/Review.jsx";
import Feed from "./screens/Feed.jsx";
import People from "./screens/People.jsx";
import { Empty } from "./components/ui.jsx";

function Routed() {
  const { error } = useApp();
  if (error) {
    return (
      <div style={{ padding: 40 }}>
        <div className="card"><Empty title="API 서버에 연결할 수 없습니다">{error} — 백엔드(npm run dev:api)가 실행 중인지 확인하세요</Empty></div>
      </div>
    );
  }
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Dashboard />} />
        <Route path="deals" element={<Explorer />} />
        <Route path="deals/:id" element={<DealDetail />} />
        <Route path="deals/:id/edit" element={<DealForm />} />
        <Route path="new" element={<DealForm />} />
        <Route path="review" element={<Review />} />
        <Route path="feed" element={<Feed />} />
        <Route path="people" element={<People />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Routed />
    </AppProvider>
  );
}
