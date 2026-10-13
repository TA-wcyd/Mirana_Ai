const BASE = (import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== "")
  ? import.meta.env.VITE_API_URL
  : (import.meta.env.PROD ? "" : "http://localhost:5000");

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
export const loginWithGoogle = () => { window.location.href = `${BASE}/auth/google`; };

// ── Onboarding ───────────────────────────────────────────────────────────────
export const getOnboardingQuestions = () => req("/api/user/onboarding-questions");
export const submitOnboarding = (answers) =>
  req("/api/user/onboarding", { method: "POST", body: JSON.stringify({ answers }) });

// ── Chat ─────────────────────────────────────────────────────────────────────
export const getChats = () => req("/api/chat");
export const createChat = () => req("/api/chat", { method: "POST" });
export const getChat = (chatId) => req(`/api/chat/${chatId}`);
export const sendMessage = (chatId, message, mode = "default") =>
  req(`/api/chat/${chatId}/message`, { method: "POST", body: JSON.stringify({ message, mode }) });
export const deleteChat = (chatId) => req(`/api/chat/${chatId}`, { method: "DELETE" });

// ── Streaming chat (SSE-based, token by token) ────────────────────────────────
export const streamMessage = (chatId, message, mode = "default") => {
  return fetch(`${BASE}/api/chat/${chatId}/message/stream`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, mode }),
  });
};

// ── Dashboard & Mood ──────────────────────────────────────────────────────────
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
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data;
};

// ── News ─────────────────────────────────────────────────────────────────────
export const getNews = (query = "") => req(`/api/news${query ? `?q=${encodeURIComponent(query)}` : ""}`);

// ── Wishes ───────────────────────────────────────────────────────────────────
export const getWishes = (status = "") => req(`/api/wishes${status ? `?status=${status}` : ""}`);
export const getActiveWishes = () => req("/api/wishes/active");
export const createWish = (data) => req("/api/wishes", { method: "POST", body: JSON.stringify(data) });
export const updateWish = (id, data) => req(`/api/wishes/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteWish = (id) => req(`/api/wishes/${id}`, { method: "DELETE" });
export const addMilestone = (id, title) =>
  req(`/api/wishes/${id}/milestone`, { method: "POST", body: JSON.stringify({ title }) });

// ── Notifications ─────────────────────────────────────────────────────────────
export const getNotifications = (limit = 20) => req(`/api/notifications?limit=${limit}`);
export const markNotificationRead = (id) => req(`/api/notifications/${id}/read`, { method: "PATCH" });
export const markAllNotificationsRead = () => req("/api/notifications/read-all", { method: "PATCH" });
export const deleteNotification = (id) => req(`/api/notifications/${id}`, { method: "DELETE" });

// ── Memory ───────────────────────────────────────────────────────────────────
export const getMemories = () => req("/api/memory");
export const deleteMemory = (id) => req(`/api/memory/${id}`, { method: "DELETE" });