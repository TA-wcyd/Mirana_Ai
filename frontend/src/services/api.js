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
export const sendMessage = (chatId, message, mode = "default") =>
  req(`/api/chat/${chatId}/message`, {
    method: "POST",
    body: JSON.stringify({ message, mode }),
  });
export const deleteChat = (chatId) =>
  req(`/api/chat/${chatId}`, { method: "DELETE" });

// ── Dashboard & Mood ─────────────────────────────────────────────────────────
export const getDashboard = () => req("/api/dashboard");
export const getRecentMoods = (limit = 30) => req(`/api/mood/recent?limit=${limit}`);
export const getMoodTrend = (days = 7) => req(`/api/mood/trend?days=${days}`);

// ── Upload ───────────────────────────────────────────────────────────────────
export const uploadFile = async (chatId, file, prompt = "") => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("prompt", prompt);
  
  const res = await fetch(`${BASE}/api/upload/${chatId}/upload`, {
    method: "POST",
    credentials: "include",
    body: formData, // the browser will set the multipart/form-data content type automatically
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data;
};