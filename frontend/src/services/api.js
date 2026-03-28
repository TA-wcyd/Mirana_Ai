const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const req = async (path, options = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
};

// ── Auth ─────────────────────────────────────────────────────────────────────
export const getMe = () => req("/auth/me");
export const logout = () => req("/auth/logout", { method: "POST" });
export const loginWithGoogle = () => {
  window.location.href = `${BASE}/auth/google`;
};

// ── Onboarding ───────────────────────────────────────────────────────────────
export const getOnboardingQuestions = () => req("/api/user/onboarding-questions");
export const submitOnboarding = (answers) =>
  req("/api/user/onboarding", {
    method: "POST",
    body: JSON.stringify({ answers }),
  });

// ── Chat ─────────────────────────────────────────────────────────────────────
export const getChats = () => req("/api/chat");
export const createChat = () => req("/api/chat", { method: "POST" });
export const getChat = (chatId) => req(`/api/chat/${chatId}`);
export const sendMessage = (chatId, message) =>
  req(`/api/chat/${chatId}/message`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
export const deleteChat = (chatId) =>
  req(`/api/chat/${chatId}`, { method: "DELETE" });