import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import Onboarding from "./pages/Onboarding";
import Chat from "./pages/Chat";
import Dashboard from "./pages/Dashboard";

import News from "./pages/News";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"          element={<Login />} />
        <Route path="/auth/callback"  element={<AuthCallback />} />
        <Route path="/onboarding"     element={<Onboarding />} />
        <Route path="/dashboard"      element={<Dashboard />} />
        <Route path="/chat"           element={<Chat />} />
        <Route path="/news"           element={<News />} />
        <Route path="*"               element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}