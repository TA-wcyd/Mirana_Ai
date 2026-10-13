import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import MiranaOrb from "../components/MiranaOrb";
import { useVoice } from "../hooks/useVoice";
import {
  getMe, getChats, createChat, getChat,
  sendMessage, streamMessage, deleteChat, logout, uploadFile,
  getActiveWishes,
} from "../services/api";

const BASE = (import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== "")
  ? import.meta.env.VITE_API_URL
  : (import.meta.env.PROD ? "" : "http://localhost:5000");

export default function Chat() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(searchParams.get("session") || null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTitle, setActiveTitle] = useState("NEW SESSION");
  const [error, setError] = useState("");
  const [mode, setMode] = useState(searchParams.get("mode") || "default");
  const [activeWishes, setActiveWishes] = useState([]);
  const [wishPanelOpen, setWishPanelOpen] = useState(false);

  useEffect(() => {
    const newParams = new URLSearchParams();
    if (mode !== "default") newParams.set("mode", mode);
    if (activeChatId) newParams.set("session", activeChatId);
    setSearchParams(newParams, { replace: true });
  }, [mode, activeChatId, setSearchParams]);

  const activeChatIdRef = useRef(null);
  const loadingRef = useRef(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  const {
    speak, stopSpeaking, isSpeaking,
    startListening, stopListening, isListening,
    muted, toggleMute,
  } = useVoice();

  useEffect(() => { activeChatIdRef.current = activeChatId; }, [activeChatId]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);

  useEffect(() => {
    getMe()
      .then((d) => {
        if (!d.authenticated) return navigate("/login");
        if (!d.user.onboardingComplete) return navigate("/onboarding");
        setUser(d.user);
      })
      .catch(() => navigate("/login"));
  }, []);

  useEffect(() => {
    if (user) {
      loadChats();
      loadActiveWishes();

      // Vocal greeting on fresh login
      const justLoggedIn = sessionStorage.getItem("mirana_just_logged_in");
      if (justLoggedIn) {
        sessionStorage.removeItem("mirana_just_logged_in");
        // Small delay so voice engine + page are fully ready
        setTimeout(() => {
          speak("Systems online boss, what can I do for you?");
        }, 1500);
      }
    }
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, streamingText]);

  const loadChats = async () => {
    try {
      const data = await getChats();
      setChats(data.chats);
    } catch (err) {
      console.error("Failed to load chats:", err);
    }
  };

  const loadActiveWishes = async () => {
    try {
      const data = await getActiveWishes();
      setActiveWishes(data.wishes || []);
    } catch (err) { /* silent */ }
  };

  const openChat = async (chatId) => {
    try {
      setActiveChatId(chatId);
      activeChatIdRef.current = chatId;
      const data = await getChat(chatId);
      setMessages(data.chat.messages);
      setActiveTitle((data.chat.title || "SESSION").toUpperCase());
      stopSpeaking();
    } catch (err) {
      console.error("Failed to open chat:", err);
    }
  };

  const newChat = async () => {
    try {
      const data = await createChat();
      await loadChats();
      setActiveChatId(data.chatId);
      activeChatIdRef.current = data.chatId;
      setMessages([]);
      setActiveTitle("NEW SESSION");
      stopSpeaking();
      setTimeout(() => textareaRef.current?.focus(), 100);
    } catch (err) {
      console.error("Failed to create chat:", err);
    }
  };

  // ── Streaming send ────────────────────────────────────────────────────────
  const handleSend = useCallback(async (overrideText) => {
    const msg = (overrideText !== undefined ? overrideText : input).trim();
    if (!msg || loadingRef.current) return;

    setError("");
    setLoading(true);
    loadingRef.current = true;
    stopSpeaking();

    let chatId = activeChatIdRef.current;
    if (!chatId) {
      try {
        const data = await createChat();
        chatId = data.chatId;
        setActiveChatId(chatId);
        activeChatIdRef.current = chatId;
        await loadChats();
      } catch (err) {
        setError("Failed to start session. Is the backend running?");
        setLoading(false);
        loadingRef.current = false;
        return;
      }
    }

    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    if (overrideText === undefined) setInput("");

    let fullReply = "";
    setStreamingText("");

    try {
      abortControllerRef.current = new AbortController();

      const res = await streamMessage(chatId, msg, mode);

      if (!res.ok) {
        throw new Error("Stream request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // Keep incomplete line

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;

          try {
            const parsed = JSON.parse(payload);

            if (parsed.error) {
              throw new Error(parsed.error);
            }

            if (parsed.delta) {
              fullReply += parsed.delta;
              setStreamingText(fullReply);
            }

            if (parsed.done) {
              if (parsed.title && parsed.title !== "New Chat") {
                setActiveTitle(parsed.title.toUpperCase());
                loadChats();
              }
              // Refresh wishes in case a tool created/updated one
              loadActiveWishes();
            }
          } catch (parseErr) { /* bad JSON chunk, skip */ }
        }
      }

      // Streaming complete — commit the full message
      setStreamingText("");
      setMessages((prev) => [...prev, { role: "assistant", content: fullReply }]);
      speak(fullReply);

    } catch (err) {
      if (err.name === "AbortError") return;

      // Fallback to non-streaming if stream fails
      try {
        const data = await sendMessage(chatId, msg, mode);
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
        if (data.title) { setActiveTitle(data.title.toUpperCase()); loadChats(); }
        speak(data.reply);
        loadActiveWishes();
      } catch (fallbackErr) {
        const isNetworkDown =
          fallbackErr.message?.includes("Failed to fetch") ||
          fallbackErr.message?.includes("NetworkError") ||
          fallbackErr.message?.includes("Load failed");
        const errMsg = isNetworkDown
          ? "Systems offline. Check the backend is running, boss."
          : `Mirana encountered an error: ${fallbackErr.message || "Check server logs, boss."}`;
        setMessages((prev) => [...prev, { role: "assistant", content: errMsg }]);
        setError(fallbackErr.message || "Failed to send message");
        speak(isNetworkDown ? "Systems offline." : "Encountered an error, boss.");
      }
    } finally {
      setStreamingText("");
      setLoading(false);
      loadingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [input, mode, speak, stopSpeaking]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || loadingRef.current) return;

    let chatId = activeChatIdRef.current;
    if (!chatId) {
      try {
        const data = await createChat();
        chatId = data.chatId;
        setActiveChatId(chatId);
        activeChatIdRef.current = chatId;
        await loadChats();
      } catch (err) {
        setError("Failed to start session before upload.");
        return;
      }
    }

    e.target.value = "";
    setLoading(true);
    loadingRef.current = true;
    const userPrompt = input.trim();
    if (userPrompt) setInput("");

    setMessages((prev) => [...prev, { role: "user", content: `📎 [Uploaded: ${file.name}] ${userPrompt}` }]);

    try {
      const data = await uploadFile(chatId, file, userPrompt);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (!activeTitle || activeTitle === "NEW SESSION") {
        setActiveTitle(file.name.toUpperCase());
        loadChats();
      }
      speak(data.reply);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Failed to process the file, boss." }]);
      setError(err.message || "Upload failed");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  const handleMic = () => {
    if (isListening) { stopListening(); return; }
    startListening(
      (transcript) => { setInput(transcript); handleSend(transcript); },
      (err) => console.warn("STT error:", err)
    );
  };

  const handleDelete = async (chatId, e) => {
    e.stopPropagation();
    await deleteChat(chatId);
    if (activeChatIdRef.current === chatId) {
      setActiveChatId(null);
      activeChatIdRef.current = null;
      setMessages([]);
      setActiveTitle("NEW SESSION");
    }
    loadChats();
  };

  const handleLogout = async () => {
    stopSpeaking();
    await logout();
    navigate("/login");
  };

  const firstName = user?.displayName?.split(" ")[0] || "Boss";
  const canSend = input.trim().length > 0 && !loading;

  const PRIORITY_COLOR = { high: "#ef4444", medium: "#f59e0b", low: "#10b981" };
  const CATEGORY_ICON = {
    learning: "🧠", health: "💪", career: "🚀", personal: "⭐",
    project: "🛠️", finance: "💰", relationship: "❤️", other: "✨"
  };

  return (
    <div style={s.root}>
      <div style={s.grid} />

      {/* Sidebar */}
      <div style={{ ...s.sidebar, width: sidebarOpen ? 270 : 0 }}>
        <div style={s.sidebarInner}>
          <div style={s.sidebarLogo}>
            <MiranaOrb size={36} isSpeaking={isSpeaking} isListening={isListening} />
            <span style={s.logoText}>MIRANA</span>
          </div>

          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            <Link to="/dashboard" style={s.navLink}>DASHBOARD</Link>
            <Link to="/news" style={s.navLink}>GLOBAL FEED</Link>
          </div>

          <button style={s.newChatBtn} onClick={newChat}>
            <span>+</span> NEW SESSION
          </button>

          {/* Wish Quick Panel Toggle */}
          {activeWishes.length > 0 && (
            <button
              style={{ ...s.wishToggleBtn, background: wishPanelOpen ? "rgba(245,158,11,0.1)" : "rgba(0,212,255,0.03)" }}
              onClick={() => setWishPanelOpen((p) => !p)}
            >
              <span>⭐</span>
              <span style={{ flex: 1 }}>ACTIVE GOALS ({activeWishes.length})</span>
              <span style={{ fontSize: 10, opacity: 0.5 }}>{wishPanelOpen ? "▲" : "▼"}</span>
            </button>
          )}

          {/* Wish Quick Panel */}
          {wishPanelOpen && activeWishes.length > 0 && (
            <div style={s.wishPanel}>
              {activeWishes.map((w) => (
                <div key={w._id} style={s.wishMiniCard}
                  onClick={() => handleSend(`Give me a quick update check-in on my goal: "${w.title}"`)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 13 }}>{CATEGORY_ICON[w.category] || "✨"}</span>
                    <span style={s.wishMiniTitle}>{w.title}</span>
                    <span style={{ ...s.priorityDot, background: PRIORITY_COLOR[w.priority] || "#f59e0b" }} />
                  </div>
                  <div style={s.progressBarWrap}>
                    <div style={{ ...s.progressBar, width: `${w.progress}%`, background: PRIORITY_COLOR[w.priority] || "#f59e0b" }} />
                  </div>
                  <span style={s.progressLabel}>{w.progress}%</span>
                </div>
              ))}
            </div>
          )}

          <div style={s.chatList}>
            {chats.length === 0 && <p style={s.noChats}>No sessions yet</p>}
            {chats.map((c) => (
              <div
                key={c.id}
                onClick={() => openChat(c.id)}
                style={{
                  ...s.chatItem,
                  background: activeChatId === c.id ? "rgba(0,212,255,0.07)" : "transparent",
                  borderColor: activeChatId === c.id ? "rgba(0,212,255,0.2)" : "transparent",
                }}
              >
                <div style={s.chatItemContent}>
                  <span style={s.chatItemTitle}>{c.title}</span>
                  {c.summary && (
                    <span style={s.chatItemSummary}>{c.summary.slice(0, 55)}…</span>
                  )}
                </div>
                <button style={s.deleteBtn} onClick={(e) => handleDelete(c.id, e)}>×</button>
              </div>
            ))}
          </div>

          {user && (
            <div style={s.userFooter}>
              {user.photo && (
                <img src={user.photo} alt="" style={s.avatar} referrerPolicy="no-referrer" />
              )}
              <div style={s.userInfo}>
                <span style={s.userName}>{user.displayName}</span>
                <span style={s.userRole}>AUTHORIZED USER</span>
              </div>
              <button style={s.logoutBtn} onClick={handleLogout}>⏻</button>
            </div>
          )}
        </div>
      </div>

      {/* Main */}
      <div style={s.main}>
        <div style={s.topBar}>
          <button style={s.toggleBtn} onClick={() => setSidebarOpen((p) => !p)}>☰</button>
          <div style={s.topBarTitle}>
            <span style={s.sessionLabel}>SESSION</span>
            <span style={s.sessionName}>{activeTitle}</span>
          </div>

          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            style={s.modeSelect}
          >
            <option value="default">⚡ Standard</option>
            <option value="jarvis">🤖 Jarvis Mode</option>
            <option value="study">🧠 Study Buddy</option>
            <option value="coach">💪 Full Coach</option>
            <option value="debate">⚔️ Debate Partner</option>
            <option value="latenight">🌙 Late Night</option>
          </select>

          <div style={s.badges}>
            {(user?.personality?.traits || []).slice(0, 2).map((t) => (
              <span key={t} style={s.badge}>{t}</span>
            ))}
          </div>
          <button
            style={{ ...s.voiceCtrlBtn, color: muted ? "#4a6080" : "#00d4ff" }}
            onClick={toggleMute}
            title={muted ? "Unmute Mirana" : "Mute Mirana"}
          >
            {muted ? "🔇" : "🔊"}
          </button>
          {isSpeaking && (
            <button style={s.stopSpeakBtn} onClick={stopSpeaking}>⏹</button>
          )}
        </div>

        <div style={s.messages}>
          {messages.length === 0 && (
            <div style={s.orbArea}>
              <MiranaOrb isSpeaking={isSpeaking} isListening={isListening} size={140} />
              <h2 style={s.greeting}>Online, {firstName}.</h2>
              <p style={s.greetingSub}>
                {user?.personality?.summary
                  ? "I know how you think. What do you need?"
                  : "What's on your mind?"}
              </p>
              {activeWishes.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
                  {activeWishes.slice(0, 3).map((w) => (
                    <button key={w._id} style={s.wishChip}
                      onClick={() => handleSend(`Brief me on my goal: "${w.title}"`)}>
                      {CATEGORY_ICON[w.category] || "⭐"} {w.title}
                    </button>
                  ))}
                </div>
              )}
              {(user?.personality?.interests || []).length > 0 && (
                <div style={s.interestHints}>
                  {user.personality.interests.slice(0, 3).map((interest) => (
                    <button
                      key={interest}
                      style={s.hintChip}
                      disabled={loading}
                      onClick={() => handleSend(`Tell me something interesting about ${interest}`)}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.length > 0 && (isSpeaking || isListening) && (
            <div style={s.speakingOverlay}>
              <MiranaOrb isSpeaking={isSpeaking} isListening={isListening} size={60} />
              <p style={s.speakingLabel}>
                {isListening ? "LISTENING…" : "MIRANA SPEAKING…"}
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{ ...s.msgRow, justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              {m.role === "assistant" && <div style={s.miranaAvatar}>M</div>}
              <div style={{ ...s.bubble, ...(m.role === "user" ? s.userBubble : s.miranaBubble) }}>
                {m.content}
              </div>
              {m.role === "user" && user?.photo && (
                <img src={user.photo} alt="" style={s.userAvatarMsg} referrerPolicy="no-referrer" />
              )}
            </div>
          ))}

          {/* Live streaming bubble */}
          {streamingText && (
            <div style={{ ...s.msgRow, justifyContent: "flex-start" }}>
              <div style={s.miranaAvatar}>M</div>
              <div style={{ ...s.bubble, ...s.miranaBubble, ...s.streamingBubble }}>
                {streamingText}
                <span style={s.cursor}>▌</span>
              </div>
            </div>
          )}

          {loading && !streamingText && (
            <div style={{ ...s.msgRow, justifyContent: "flex-start" }}>
              <div style={s.miranaAvatar}>M</div>
              <div style={{ ...s.bubble, ...s.miranaBubble, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={s.dot} />
                <span style={{ ...s.dot, animationDelay: "0.2s" }} />
                <span style={{ ...s.dot, animationDelay: "0.4s" }} />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div style={s.inputBar}>
          {error && <div style={s.errorBanner}>⚠ {error}</div>}
          <div style={s.statusRow}>
            <span style={{
              ...s.statusDot,
              background: loading ? "#f59e0b" : isListening ? "#ff5050" : "#00d4ff"
            }} />
            <span style={s.statusText}>
              {isListening ? "LISTENING" : isSpeaking ? "SPEAKING" : loading ? (streamingText ? "STREAMING" : "PROCESSING") : "READY"}
            </span>
          </div>
          <div style={s.inputRow}>
            <textarea
              ref={textareaRef}
              style={s.input}
              placeholder="Message Mirana…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
              disabled={isListening}
            />
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleFileUpload}
              accept="image/*,.pdf,.txt"
            />
            <button
              style={{ ...s.iconBtn, color: "#00d4ff", border: "1px solid rgba(0,212,255,0.15)" }}
              onClick={() => fileInputRef.current?.click()}
              title="Attach Document/Image"
            >
              📎
            </button>
            <button
              style={{
                ...s.iconBtn,
                color: isListening ? "#ff5050" : "#4a6080",
                border: `1px solid ${isListening ? "rgba(255,80,80,0.4)" : "rgba(0,212,255,0.1)"}`,
              }}
              onClick={handleMic}
            >
              🎤
            </button>
            <button
              style={{ ...s.sendBtn, opacity: canSend ? 1 : 0.3 }}
              onClick={() => handleSend()}
              disabled={!canSend}
            >
              ↑
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #030712; overflow: hidden; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,212,255,0.15); border-radius: 4px; }
        textarea { min-height: 44px; max-height: 160px; overflow-y: auto; resize: none; }
        textarea::placeholder { color: #1e3040; }
        textarea:focus { outline: none; border-color: rgba(0,212,255,0.3) !important; }
        button:hover:not(:disabled) { filter: brightness(1.2); }
        @keyframes blink { 0%,80%,100%{opacity:0.15} 40%{opacity:1} }
        @keyframes statusPulse { from{opacity:0.5} to{opacity:1} }
        @keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
    </div>
  );
}

const CYAN = "#00d4ff";
const BG = "#030712";
const BORDER = "rgba(0,212,255,0.1)";
const TEXT = "#e2e8f0";
const MUTED = "#4a6080";

const s = {
  root: { display: "flex", height: "100vh", background: BG, fontFamily: "'Exo 2', sans-serif", color: TEXT, overflow: "hidden", position: "relative" },
  grid: { position: "absolute", inset: 0, backgroundImage: `linear-gradient(rgba(0,212,255,0.025) 1px, transparent 1px),linear-gradient(90deg, rgba(0,212,255,0.025) 1px, transparent 1px)`, backgroundSize: "40px 40px", pointerEvents: "none", zIndex: 0 },
  sidebar: { background: "rgba(3,8,20,0.95)", borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", transition: "width 0.25s ease", flexShrink: 0, overflow: "hidden", zIndex: 10 },
  sidebarInner: { width: 270, display: "flex", flexDirection: "column", height: "100%", padding: "20px 14px" },
  sidebarLogo: { display: "flex", alignItems: "center", gap: 12, marginBottom: 18, padding: "0 4px" },
  logoText: { fontFamily: "'Orbitron', monospace", fontWeight: 900, fontSize: 16, letterSpacing: 4, color: CYAN },
  navLink: { flex: 1, textAlign: "center", background: "rgba(0,212,255,0.05)", border: `1px solid ${BORDER}`, borderRadius: 6, color: CYAN, padding: "7px", fontSize: 9, fontWeight: 600, fontFamily: "'Orbitron', monospace", textDecoration: "none", letterSpacing: 1 },
  newChatBtn: { display: "flex", alignItems: "center", gap: 8, background: "rgba(0,212,255,0.05)", border: `1px solid ${BORDER}`, borderRadius: 8, color: CYAN, padding: "10px 14px", fontSize: 11, fontWeight: 600, fontFamily: "'Orbitron', monospace", letterSpacing: 2, cursor: "pointer", marginBottom: 10 },
  wishToggleBtn: { display: "flex", alignItems: "center", gap: 8, border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, color: "#f59e0b", padding: "9px 12px", fontSize: 10, fontWeight: 600, fontFamily: "'Orbitron', monospace", letterSpacing: 1, cursor: "pointer", marginBottom: 8 },
  wishPanel: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 10, maxHeight: 220, overflowY: "auto" },
  wishMiniCard: { background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.12)", borderRadius: 8, padding: "8px 10px", cursor: "pointer" },
  wishMiniTitle: { color: "#e2c080", fontSize: 11, fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  priorityDot: { width: 6, height: 6, borderRadius: "50%", flexShrink: 0 },
  progressBarWrap: { height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden", marginBottom: 4 },
  progressBar: { height: "100%", borderRadius: 2, transition: "width 0.5s ease" },
  progressLabel: { color: "#6b7280", fontSize: 9, fontFamily: "'Orbitron', monospace" },
  chatList: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 },
  noChats: { color: MUTED, fontSize: 12, textAlign: "center", marginTop: 20, fontStyle: "italic" },
  chatItem: { display: "flex", alignItems: "center", padding: "9px 10px", borderRadius: 8, cursor: "pointer", border: "1px solid transparent", transition: "background 0.15s", gap: 8 },
  chatItemContent: { flex: 1, overflow: "hidden" },
  chatItemTitle: { display: "block", color: "#8aaabb", fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  chatItemSummary: { display: "block", color: MUTED, fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2, lineHeight: 1.4 },
  deleteBtn: { background: "none", border: "none", color: "#2a3f55", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 2, flexShrink: 0 },
  userFooter: { display: "flex", alignItems: "center", gap: 10, padding: "14px 4px 0", borderTop: `1px solid ${BORDER}`, marginTop: 12 },
  avatar: { width: 32, height: 32, borderRadius: "50%", border: `1px solid ${BORDER}`, flexShrink: 0 },
  userInfo: { flex: 1, overflow: "hidden" },
  userName: { display: "block", color: TEXT, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  userRole: { display: "block", color: CYAN, fontSize: 9, fontFamily: "'Orbitron', monospace", letterSpacing: 1.5, opacity: 0.5, marginTop: 2 },
  logoutBtn: { background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 16, flexShrink: 0 },
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", zIndex: 1 },
  topBar: { display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", borderBottom: `1px solid ${BORDER}`, flexShrink: 0, background: "rgba(3,8,20,0.6)", backdropFilter: "blur(10px)" },
  toggleBtn: { background: "none", border: "none", color: MUTED, fontSize: 18, cursor: "pointer", padding: "4px 6px" },
  topBarTitle: { display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" },
  modeSelect: { background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 6, color: CYAN, padding: "5px 8px", fontSize: 11, fontFamily: "'Orbitron', monospace", outline: "none", cursor: "pointer" },
  sessionLabel: { color: CYAN, fontSize: 9, fontFamily: "'Orbitron', monospace", letterSpacing: 3, opacity: 0.5 },
  sessionName: { color: TEXT, fontSize: 13, fontWeight: 600, fontFamily: "'Orbitron', monospace", letterSpacing: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  badges: { display: "flex", gap: 6, flexShrink: 0 },
  badge: { background: "rgba(0,212,255,0.06)", border: `1px solid rgba(0,212,255,0.15)`, color: CYAN, borderRadius: 999, padding: "3px 10px", fontSize: 10, fontFamily: "'Orbitron', monospace", letterSpacing: 1, opacity: 0.7 },
  voiceCtrlBtn: { background: "none", border: "none", fontSize: 16, cursor: "pointer", flexShrink: 0, padding: 4 },
  stopSpeakBtn: { background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)", color: "#ff8080", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: "pointer", flexShrink: 0 },
  messages: { flex: 1, overflowY: "auto", padding: "24px 24px 16px", display: "flex", flexDirection: "column", gap: 14 },
  orbArea: { display: "flex", flexDirection: "column", alignItems: "center", gap: 14, paddingTop: 20, paddingBottom: 10 },
  greeting: { color: TEXT, fontSize: 22, fontWeight: 300, fontFamily: "'Orbitron', monospace", letterSpacing: 2, textAlign: "center" },
  greetingSub: { color: MUTED, fontSize: 14, textAlign: "center" },
  wishChip: { background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 20, color: "#e2c080", padding: "7px 14px", fontSize: 12, cursor: "pointer", fontFamily: "'Exo 2', sans-serif", transition: "all 0.2s" },
  interestHints: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 4 },
  hintChip: { background: "rgba(0,212,255,0.04)", border: `1px solid rgba(0,212,255,0.15)`, borderRadius: 20, color: "#7ab8cc", padding: "8px 16px", fontSize: 13, cursor: "pointer", fontFamily: "'Exo 2', sans-serif", transition: "all 0.2s" },
  speakingOverlay: { display: "flex", alignItems: "center", gap: 12, padding: "8px 0" },
  speakingLabel: { color: CYAN, fontSize: 10, fontFamily: "'Orbitron', monospace", letterSpacing: 3, opacity: 0.7 },
  msgRow: { display: "flex", alignItems: "flex-end", gap: 10, maxWidth: "78%", alignSelf: "stretch" },
  miranaAvatar: { width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #003366, #006699)", border: `1px solid rgba(0,212,255,0.3)`, display: "flex", alignItems: "center", justifyContent: "center", color: CYAN, fontSize: 12, fontWeight: 800, fontFamily: "'Orbitron', monospace", flexShrink: 0 },
  userAvatarMsg: { width: 28, height: 28, borderRadius: "50%", flexShrink: 0, border: `1px solid ${BORDER}` },
  bubble: { padding: "12px 16px", fontSize: 14, lineHeight: 1.65, maxWidth: "100%", wordBreak: "break-word", whiteSpace: "pre-wrap", fontFamily: "'Exo 2', sans-serif" },
  miranaBubble: { background: "rgba(0,20,45,0.8)", border: `1px solid rgba(0,212,255,0.1)`, borderRadius: "16px 16px 16px 4px", color: "#c8ddf0" },
  userBubble: { background: "linear-gradient(135deg, rgba(0,60,100,0.9), rgba(0,100,160,0.8))", border: `1px solid rgba(0,212,255,0.2)`, borderRadius: "16px 16px 4px 16px", color: TEXT, marginLeft: "auto" },
  streamingBubble: { borderColor: "rgba(0,212,255,0.25)", boxShadow: "0 0 12px rgba(0,212,255,0.06)" },
  cursor: { display: "inline-block", animation: "cursorBlink 0.8s infinite", color: CYAN, marginLeft: 1 },
  dot: { display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: CYAN, opacity: 0.15, animation: "blink 1.2s infinite", margin: "0 2px" },
  inputBar: { borderTop: `1px solid ${BORDER}`, padding: "12px 20px 16px", flexShrink: 0, background: "rgba(3,8,20,0.8)", backdropFilter: "blur(10px)" },
  errorBanner: { background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: 8, color: "#ff8080", padding: "8px 12px", fontSize: 12, marginBottom: 10 },
  statusRow: { display: "flex", alignItems: "center", gap: 6, marginBottom: 10 },
  statusDot: { width: 5, height: 5, borderRadius: "50%", display: "block", animation: "statusPulse 1.5s ease-in-out infinite alternate", transition: "background 0.3s" },
  statusText: { color: CYAN, fontSize: 9, fontFamily: "'Orbitron', monospace", letterSpacing: 2, opacity: 0.5 },
  inputRow: { display: "flex", alignItems: "flex-end", gap: 8 },
  input: { flex: 1, background: "rgba(0,10,25,0.6)", border: `1px solid rgba(0,212,255,0.12)`, borderRadius: 12, padding: "12px 16px", color: TEXT, fontSize: 14, fontFamily: "'Exo 2', sans-serif", lineHeight: 1.5, transition: "border-color 0.2s" },
  iconBtn: { width: 44, height: 44, borderRadius: 10, background: "rgba(0,10,25,0.6)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 },
  sendBtn: { width: 44, height: 44, borderRadius: 10, background: "linear-gradient(135deg, rgba(0,100,160,0.8), rgba(0,60,110,0.9))", border: `1px solid rgba(0,212,255,0.25)`, color: CYAN, fontSize: 18, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "opacity 0.2s" },
};