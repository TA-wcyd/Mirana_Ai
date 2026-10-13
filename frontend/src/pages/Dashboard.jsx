import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import MiranaOrb from "../components/MiranaOrb";
import {
  getDashboard, logout,
  createWish, updateWish, deleteWish,
  markNotificationRead, markAllNotificationsRead, deleteNotification,
  deleteMemory,
} from "../services/api";

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);
  return isMobile;
}

const PRIORITY_COLOR = { high: "#ef4444", medium: "#f59e0b", low: "#10b981" };
const CATEGORY_ICON = {
  learning: "🧠", health: "💪", career: "🚀", personal: "⭐",
  project: "🛠️", finance: "💰", relationship: "❤️", other: "✨"
};
const MOOD_COLORS = {
  happy: "#10b981", excited: "#f59e0b", neutral: "#3b82f6",
  curious: "#8b5cf6", stressed: "#ef4444", sad: "#64748b", angry: "#dc2626",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [notifOpen, setNotifOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showWishForm, setShowWishForm] = useState(false);
  const [wishForm, setWishForm] = useState({ title: "", description: "", category: "personal", priority: "medium", deadline: "" });
  const [wishFormLoading, setWishFormLoading] = useState(false);
  const [localWishes, setLocalWishes] = useState([]);
  const [localNotifications, setLocalNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [memories, setMemories] = useState([]);

  // Close sidebar on desktop resize
  useEffect(() => { if (!isMobile) setSidebarOpen(false); }, [isMobile]);

  const load = () => {
    getDashboard()
      .then((res) => {
        setData(res);
        setLocalWishes(res.activeWishes || []);
        setLocalNotifications(res.notifications || []);
        setUnreadCount(res.unreadNotificationCount || 0);
        setMemories(res.recentMemories || []);
        setLoading(false);
      })
      .catch(() => navigate("/login"));
  };

  useEffect(() => { load(); }, []);

  const handleLogout = async () => { await logout(); navigate("/login"); };

  // ── Notification handlers ────────────────────────────────────────────────
  const handleReadNotif = async (id) => {
    setLocalNotifications((prev) => prev.map((n) => n._id === id ? { ...n, read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
    await markNotificationRead(id).catch(() => {});
  };
  const handleReadAll = async () => {
    setLocalNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    await markAllNotificationsRead().catch(() => {});
  };
  const handleDeleteNotif = async (id) => {
    const notif = localNotifications.find((n) => n._id === id);
    if (notif && !notif.read) setUnreadCount((c) => Math.max(0, c - 1));
    setLocalNotifications((prev) => prev.filter((n) => n._id !== id));
    await deleteNotification(id).catch(() => {});
  };

  // ── Wish handlers ────────────────────────────────────────────────────────
  const handleCreateWish = async (e) => {
    e.preventDefault();
    if (!wishForm.title.trim()) return;
    setWishFormLoading(true);
    try {
      const res = await createWish(wishForm);
      setLocalWishes((prev) => [res.wish, ...prev]);
      setShowWishForm(false);
      setWishForm({ title: "", description: "", category: "personal", priority: "medium", deadline: "" });
    } catch (err) { console.error(err); }
    setWishFormLoading(false);
  };

  const handleUpdateProgress = async (id, delta) => {
    const wish = localWishes.find((w) => w._id === id);
    if (!wish) return;
    const newProgress = Math.min(100, Math.max(0, (wish.progress || 0) + delta));
    setLocalWishes((prev) => prev.map((w) => w._id === id ? { ...w, progress: newProgress } : w));
    await updateWish(id, { progress: newProgress }).catch(() => {});
  };

  const handleCompleteWish = async (id) => {
    setLocalWishes((prev) => prev.map((w) => w._id === id ? { ...w, status: "completed", progress: 100 } : w));
    await updateWish(id, { status: "completed", progress: 100 }).catch(() => {});
  };

  const handleDeleteWish = async (id) => {
    setLocalWishes((prev) => prev.filter((w) => w._id !== id));
    await deleteWish(id).catch(() => {});
  };

  const handleDeleteMemory = async (id) => {
    setMemories((prev) => prev.filter((m) => m._id !== id));
    await deleteMemory(id).catch(() => {});
  };

  if (loading || !data) {
    return (
      <div style={{ ...s.page, justifyContent: "center", alignItems: "center" }}>
        <MiranaOrb size={60} isSpeaking={true} />
        <p style={s.loadingText}>SYNCING SECURE DATA...</p>
      </div>
    );
  }

  const trendData = data.moodTrend || [];
  const maxCount = Math.max(...trendData.map((d) => d.count), 1);
  const activeWishCount = localWishes.filter((w) => w.status === "active").length;

  const SidebarContent = () => (
    <div style={s.sidebarInner}>
      <div style={s.logoArea}>
        {isMobile && (
          <button style={s.closeSidebarBtn} onClick={() => setSidebarOpen(false)}>✕</button>
        )}
        <MiranaOrb size={28} />
        <span style={s.logoText}>MIRANA</span>
      </div>

      <div style={s.navGroup}>
        <div style={s.navItemActive}>DASHBOARD</div>
        <Link to="/chat" style={s.navItem} onClick={() => setSidebarOpen(false)}>AI TERMINAL</Link>
        <Link to="/news" style={s.navItem} onClick={() => setSidebarOpen(false)}>GLOBAL FEED</Link>
      </div>

      {/* Tab navigation */}
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 4 }}>
        {[
          { key: "overview", label: "OVERVIEW", icon: "◈" },
          { key: "wishes", label: "MY GOALS", icon: "⭐" },
          { key: "memory", label: "MEMORY BANK", icon: "🧠" },
          { key: "mood", label: "EMOTIONAL LOG", icon: "📊" },
        ].map((tab) => (
          <button key={tab.key} style={{
            ...s.tabBtn,
            background: activeTab === tab.key ? "rgba(0,212,255,0.1)" : "transparent",
            color: activeTab === tab.key ? "#00d4ff" : "#4a6080",
            borderColor: activeTab === tab.key ? "rgba(0,212,255,0.2)" : "transparent",
          }} onClick={() => { setActiveTab(tab.key); setSidebarOpen(false); }}>
            <span style={{ marginRight: 8 }}>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      <div style={s.spacer} />

      <div style={s.userFooter}>
        {data.photo && <img src={data.photo} style={s.avatar} referrerPolicy="no-referrer" alt="" />}
        <div style={s.userInfo}>
          <span style={s.userName}>{data.firstName}</span>
          <span style={s.userRole}>AUTHORIZED</span>
        </div>
        <button style={s.logoutBtn} onClick={handleLogout}>⏻</button>
      </div>
    </div>
  );

  return (
    <div style={s.page}>
      <div style={s.grid} />

      {/* Mobile sidebar overlay */}
      {isMobile && sidebarOpen && (
        <div style={s.mobileOverlay} onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      {isMobile ? (
        <div style={{
          ...s.sidebar,
          position: "fixed",
          left: sidebarOpen ? 0 : "-100%",
          top: 0, bottom: 0, zIndex: 200,
          transition: "left 0.3s ease",
        }}>
          <SidebarContent />
        </div>
      ) : (
        <div style={s.sidebar}>
          <SidebarContent />
        </div>
      )}

      {/* Main */}
      <div style={s.main}>
        {/* Top bar */}
        <div style={s.topBar}>
          {/* Hamburger on mobile */}
          {isMobile && (
            <button style={s.hamburgerBtn} onClick={() => setSidebarOpen(true)}>☰</button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ ...s.greeting, fontSize: isMobile ? 15 : 22 }}>{data.greeting}</h1>
            {!isMobile && (
              <p style={s.greetingSub}>
                {data.memoryStats?.total || 0} memories · {activeWishCount} active goals · Intelligence systems online
              </p>
            )}
          </div>

          {/* Notification Bell */}
          <div style={{ position: "relative" }}>
            <button style={s.bellBtn} onClick={() => setNotifOpen((p) => !p)}>
              🔔
              {unreadCount > 0 && (
                <span style={s.notifBadge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </button>

            {notifOpen && (
              <div style={{ ...s.notifDropdown, width: isMobile ? "calc(100vw - 32px)" : 360, right: isMobile ? -8 : 0 }}>
                <div style={s.notifHeader}>
                  <span style={s.notifTitle}>INTEL FEED</span>
                  {unreadCount > 0 && (
                    <button style={s.notifReadAll} onClick={handleReadAll}>Mark all read</button>
                  )}
                </div>
                {localNotifications.length === 0 ? (
                  <p style={s.notifEmpty}>No notifications yet.</p>
                ) : (
                  <div style={s.notifList}>
                    {localNotifications.map((n) => (
                      <div key={n._id} style={{ ...s.notifItem, opacity: n.read ? 0.5 : 1 }}
                        onClick={() => !n.read && handleReadNotif(n._id)}>
                        {!n.read && <div style={s.notifDot} />}
                        <div style={{ flex: 1 }}>
                          <div style={s.notifItemTitle}>{n.title}</div>
                          <div style={s.notifItemBody}>{n.body}</div>
                          <div style={s.notifItemTime}>{new Date(n.createdAt).toLocaleDateString()}</div>
                        </div>
                        <button style={s.notifDelBtn}
                          onClick={(e) => { e.stopPropagation(); handleDeleteNotif(n._id); }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {!isMobile && (
            <button style={s.chatBtn} onClick={() => navigate("/chat?mode=jarvis")}>
              🤖 JARVIS MODE
            </button>
          )}
        </div>

        {/* Scrollable content */}
        <div style={{ ...s.content, paddingBottom: isMobile ? 80 : 28 }}>

          {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
          {activeTab === "overview" && (
            <div style={{ ...s.dashboardGrid, gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(380px, 1fr))" }}>
              {/* Quick Protocols */}
              <div style={{ ...s.card, gridColumn: isMobile ? "1" : "1 / -1", background: "rgba(0,5,15,0.5)" }}>
                <h2 style={s.cardTitle}>Quick Protocols</h2>
                <div style={s.quickActions}>
                  {[
                    { mode: "default", icon: "💬", label: "Standard Chat", color: "#00d4ff" },
                    { mode: "jarvis", icon: "🤖", label: "Jarvis Mode", color: "#a78bfa" },
                    { mode: "study", icon: "🧠", label: "Study Mode", color: "#10b981" },
                    { mode: "coach", icon: "⚡", label: "Coach Mode", color: "#f59e0b" },
                    { mode: "debate", icon: "⚔️", label: "Debate Mode", color: "#ef4444" },
                    { mode: "latenight", icon: "🌙", label: "Late Night", color: "#818cf8" },
                  ].map((m) => (
                    <button key={m.mode} style={s.actionBtn} onClick={() => navigate(`/chat?mode=${m.mode}`)}>
                      <span style={{ ...s.actionIcon, color: m.color }}>{m.icon}</span>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Upcoming Deadlines */}
              {data.upcomingDeadlines?.length > 0 && (
                <div style={{ ...s.card, background: "rgba(239,68,68,0.04)", borderColor: "rgba(239,68,68,0.15)" }}>
                  <h2 style={{ ...s.cardTitle, color: "#ef4444" }}>⏰ Deadline Alert</h2>
                  {data.upcomingDeadlines.map((w) => {
                    const daysLeft = Math.ceil((new Date(w.deadline) - new Date()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={w._id} style={s.deadlineItem}>
                        <span style={s.deadlineIcon}>{CATEGORY_ICON[w.category] || "⭐"}</span>
                        <div style={{ flex: 1 }}>
                          <div style={s.deadlineTitle}>{w.title}</div>
                          <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginTop: 4 }}>
                            <div style={{ height: "100%", width: `${w.progress}%`, background: "#ef4444", borderRadius: 2 }} />
                          </div>
                        </div>
                        <span style={{ ...s.deadlineBadge, background: daysLeft <= 1 ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.15)", color: daysLeft <= 1 ? "#ef4444" : "#f59e0b" }}>
                          {daysLeft <= 0 ? "TODAY" : daysLeft === 1 ? "1 DAY" : `${daysLeft} DAYS`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Core Identity */}
              <div style={s.card}>
                <h2 style={s.cardTitle}>Core Identity</h2>
                <p style={s.personalitySummary}>{data.personality.summary || "Profile gathering..."}</p>
                <div style={s.badges}>
                  {data.personality.traits?.slice(0, 5).map((t) => (
                    <span key={t} style={s.badge}>{t}</span>
                  ))}
                </div>
              </div>

              {/* Wish Stats */}
              <div style={s.card}>
                <h2 style={s.cardTitle}>Goal Intelligence</h2>
                <div style={s.statsGrid}>
                  <div style={s.statBox}>
                    <span style={s.statNum}>{data.wishStats?.active || 0}</span>
                    <span style={s.statLabel}>ACTIVE</span>
                  </div>
                  <div style={s.statBox}>
                    <span style={s.statNum}>{data.wishStats?.completed || 0}</span>
                    <span style={s.statLabel}>COMPLETED</span>
                  </div>
                  <div style={s.statBox}>
                    <span style={s.statNum}>{data.memoryStats?.total || 0}</span>
                    <span style={s.statLabel}>MEMORIES</span>
                  </div>
                </div>
                <button style={s.viewMoreBtn} onClick={() => { setActiveTab("wishes"); }}>
                  View All Goals →
                </button>
              </div>

              {/* Mood Telemetry */}
              <div style={s.card}>
                <h2 style={s.cardTitle}>Emotional Telemetry (7 Days)</h2>
                {trendData.length === 0 ? (
                  <p style={s.emptyText}>No mood data recorded yet.</p>
                ) : (
                  <div style={s.chartArea}>
                    <div style={s.chartGrid}>
                      {trendData.map((day, i) => {
                        const height = (day.count / maxCount) * 100;
                        return (
                          <div key={i} style={s.chartColumn} title={`${day.date}: ${day.mood} (${day.count})`}>
                            <div style={s.barWrap}>
                              <div style={{ ...s.bar, height: `${height}%`, background: MOOD_COLORS[day.mood] || "#00d4ff" }} />
                            </div>
                            <span style={s.dateLabel}>{day.date.split("-").slice(1).join("/")}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {data.recentMoods?.length > 0 && (
                  <div style={s.latestMood}>
                    Current State: <strong style={{ color: MOOD_COLORS[data.recentMoods[0].mood] || "#00d4ff" }}>
                      {data.recentMoods[0].mood.toUpperCase()}
                    </strong>
                  </div>
                )}
              </div>

              {/* Recent Sessions */}
              <div style={{ ...s.card, gridColumn: isMobile ? "1" : "1 / -1" }}>
                <h2 style={s.cardTitle}>Recent Sessions</h2>
                {data.recentChats?.length === 0 ? (
                  <p style={s.emptyText}>No chat history found.</p>
                ) : (
                  <div style={s.sessionGrid}>
                    {data.recentChats?.map((c) => (
                      <div key={c.id} style={s.sessionCard} onClick={() => navigate(`/chat?session=${c.id}`)}>
                        <h3 style={s.sessionTitle}>{c.title}</h3>
                        <p style={s.sessionSummary}>{c.summary || "New session..."}</p>
                        <span style={s.sessionMeta}>{c.messageCount} messages</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── WISHES TAB ───────────────────────────────────────────────── */}
          {activeTab === "wishes" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <h2 style={s.tabPageTitle}>⭐ My Goals & Wishes</h2>
                <button style={s.addWishBtn} onClick={() => setShowWishForm((p) => !p)}>
                  + ADD GOAL
                </button>
              </div>

              {/* Add wish form */}
              {showWishForm && (
                <form onSubmit={handleCreateWish} style={s.wishForm}>
                  <div style={s.wishFormGrid}>
                    <input style={{ ...s.formInput, gridColumn: "1 / -1" }} placeholder="Goal title (e.g. Learn Spanish by December)" value={wishForm.title}
                      onChange={(e) => setWishForm((p) => ({ ...p, title: e.target.value }))} required />
                    <textarea style={{ ...s.formInput, gridColumn: "1 / -1", minHeight: 60, resize: "vertical" }}
                      placeholder="Description / context (optional)"
                      value={wishForm.description}
                      onChange={(e) => setWishForm((p) => ({ ...p, description: e.target.value }))} />
                    <select style={s.formSelect} value={wishForm.category}
                      onChange={(e) => setWishForm((p) => ({ ...p, category: e.target.value }))}>
                      {["learning", "health", "career", "personal", "project", "finance", "relationship", "other"].map((c) => (
                        <option key={c} value={c}>{CATEGORY_ICON[c]} {c.charAt(0).toUpperCase() + c.slice(1)}</option>
                      ))}
                    </select>
                    <select style={s.formSelect} value={wishForm.priority}
                      onChange={(e) => setWishForm((p) => ({ ...p, priority: e.target.value }))}>
                      <option value="high">🔴 High Priority</option>
                      <option value="medium">🟡 Medium Priority</option>
                      <option value="low">🟢 Low Priority</option>
                    </select>
                    <input type="date" style={{ ...s.formInput }} placeholder="Deadline (optional)"
                      value={wishForm.deadline}
                      onChange={(e) => setWishForm((p) => ({ ...p, deadline: e.target.value }))} />
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <button type="submit" style={s.formSubmitBtn} disabled={wishFormLoading}>
                      {wishFormLoading ? "Creating..." : "✓ Create Goal"}
                    </button>
                    <button type="button" style={s.formCancelBtn} onClick={() => setShowWishForm(false)}>Cancel</button>
                  </div>
                </form>
              )}

              {localWishes.length === 0 ? (
                <div style={s.emptyState}>
                  <span style={{ fontSize: 48 }}>⭐</span>
                  <p style={{ color: "#4a6080", marginTop: 12 }}>No goals set yet. Tell Mirana what you want to achieve — she'll track it for you.</p>
                  <button style={s.chatBtn} onClick={() => navigate("/chat?mode=jarvis")} >
                    Tell Mirana Your Goals →
                  </button>
                </div>
              ) : (
                <div style={s.wishGrid}>
                  {localWishes.map((w) => (
                    <div key={w._id} style={{ ...s.wishCard, borderColor: `${PRIORITY_COLOR[w.priority]}30`, opacity: w.status === "completed" ? 0.6 : 1 }}>
                      <div style={s.wishCardHeader}>
                        <span style={{ fontSize: 20 }}>{CATEGORY_ICON[w.category] || "✨"}</span>
                        <div style={{ flex: 1 }}>
                          <div style={s.wishCardTitle}>{w.title}</div>
                          {w.deadline && (
                            <div style={s.wishDeadline}>
                              📅 {new Date(w.deadline).toDateString()}
                            </div>
                          )}
                        </div>
                        <span style={{ ...s.priorityTag, background: `${PRIORITY_COLOR[w.priority]}20`, color: PRIORITY_COLOR[w.priority] }}>
                          {w.priority?.toUpperCase()}
                        </span>
                      </div>

                      {w.description && <p style={s.wishDesc}>{w.description}</p>}

                      {/* Progress bar */}
                      <div style={{ marginTop: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={s.progressText}>PROGRESS</span>
                          <span style={{ ...s.progressText, color: PRIORITY_COLOR[w.priority] }}>{w.progress || 0}%</span>
                        </div>
                        <div style={s.bigProgressBarWrap}>
                          <div style={{
                            ...s.bigProgressBar,
                            width: `${w.progress || 0}%`,
                            background: `linear-gradient(90deg, ${PRIORITY_COLOR[w.priority]}aa, ${PRIORITY_COLOR[w.priority]})`,
                          }} />
                        </div>
                      </div>

                      {/* Controls */}
                      {w.status === "active" && (
                        <div style={s.wishControls}>
                          <button style={s.wishControlBtn} onClick={() => handleUpdateProgress(w._id, -10)} title="−10%">−10</button>
                          <button style={s.wishControlBtn} onClick={() => handleUpdateProgress(w._id, 10)} title="+10%">+10</button>
                          <button style={{ ...s.wishControlBtn, color: "#10b981", borderColor: "rgba(16,185,129,0.2)" }}
                            onClick={() => handleCompleteWish(w._id)}>✓ Complete</button>
                          <button style={{ ...s.wishControlBtn, color: "#4a6080", marginLeft: "auto" }}
                            onClick={() => navigate(`/chat?mode=default`)}>💬 Discuss</button>
                          <button style={{ ...s.wishControlBtn, color: "#ef4444", borderColor: "rgba(239,68,68,0.2)" }}
                            onClick={() => handleDeleteWish(w._id)}>🗑</button>
                        </div>
                      )}
                      {w.status === "completed" && (
                        <div style={{ ...s.priorityTag, background: "rgba(16,185,129,0.1)", color: "#10b981", marginTop: 10, textAlign: "center" }}>
                          ✓ COMPLETED
                        </div>
                      )}

                      {/* Category tag */}
                      <div style={s.wishCategory}>{w.category?.toUpperCase()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── MEMORY TAB ───────────────────────────────────────────────── */}
          {activeTab === "memory" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <h2 style={s.tabPageTitle}>🧠 Memory Bank</h2>
                <span style={{ color: "#4a6080", fontSize: 12, fontFamily: "'Orbitron', monospace" }}>
                  {memories.length} / {data.memoryStats?.maxCapacity || 150} STORED
                </span>
              </div>
              {memories.length === 0 ? (
                <div style={s.emptyState}>
                  <span style={{ fontSize: 48 }}>🧠</span>
                  <p style={{ color: "#4a6080", marginTop: 12 }}>No memories stored yet. Start chatting and Mirana will remember what matters.</p>
                </div>
              ) : (
                <div style={s.memoryGrid}>
                  {memories.map((m) => (
                    <div key={m._id} style={s.memoryCard}>
                      <div style={s.memoryCategoryTag}>{m.category?.toUpperCase()}</div>
                      <p style={s.memoryCardText}>{m.content}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                        <span style={{ ...s.importanceBadge, background: m.importance === "high" ? "rgba(239,68,68,0.1)" : m.importance === "medium" ? "rgba(245,158,11,0.1)" : "rgba(100,116,139,0.1)", color: m.importance === "high" ? "#ef4444" : m.importance === "medium" ? "#f59e0b" : "#64748b" }}>
                          {m.importance?.toUpperCase()}
                        </span>
                        <button style={s.memoryDelBtn} onClick={() => handleDeleteMemory(m._id)}>🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── MOOD TAB ─────────────────────────────────────────────────── */}
          {activeTab === "mood" && (
            <div>
              <h2 style={{ ...s.tabPageTitle, marginBottom: 24 }}>📊 Emotional Intelligence Log</h2>
              <div style={s.dashboardGrid}>
                <div style={{ ...s.card, gridColumn: "1 / -1" }}>
                  <h2 style={s.cardTitle}>7-Day Mood Trend</h2>
                  {trendData.length === 0 ? (
                    <p style={s.emptyText}>No data yet.</p>
                  ) : (
                    <div style={{ ...s.chartArea, height: 200 }}>
                      <div style={s.chartGrid}>
                        {trendData.map((day, i) => {
                          const height = (day.count / maxCount) * 100;
                          return (
                            <div key={i} style={{ ...s.chartColumn, gap: 10 }} title={`${day.date}: ${day.mood} (${day.count})`}>
                              <div style={{ ...s.barWrap, background: `${MOOD_COLORS[day.mood]}10` }}>
                                <div style={{ ...s.bar, height: `${height}%`, background: MOOD_COLORS[day.mood] || "#00d4ff", boxShadow: `0 0 8px ${MOOD_COLORS[day.mood]}60` }} />
                              </div>
                              <span style={{ ...s.dateLabel, textAlign: "center" }}>{day.mood?.toUpperCase().slice(0, 3)}</span>
                              <span style={{ ...s.dateLabel, fontSize: 9 }}>{day.date.split("-").slice(1).join("/")}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div style={s.card}>
                  <h2 style={s.cardTitle}>Recent Moods</h2>
                  {(data.recentMoods || []).slice(0, 8).map((m, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(0,212,255,0.05)" }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: MOOD_COLORS[m.mood] || "#00d4ff", flexShrink: 0 }} />
                      <span style={{ color: MOOD_COLORS[m.mood] || "#00d4ff", fontFamily: "'Orbitron', monospace", fontSize: 11, fontWeight: 600 }}>{m.mood?.toUpperCase()}</span>
                      {m.messageSnippet && <span style={{ color: "#4a6080", fontSize: 11, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>"{m.messageSnippet}"</span>}
                      <span style={{ color: "#2a3f55", fontSize: 10 }}>{new Date(m.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
                <div style={s.card}>
                  <h2 style={s.cardTitle}>Mood Distribution</h2>
                  {Object.entries(
                    (data.recentMoods || []).reduce((acc, m) => {
                      acc[m.mood] = (acc[m.mood] || 0) + 1;
                      return acc;
                    }, {})
                  ).sort((a, b) => b[1] - a[1]).map(([mood, count]) => (
                    <div key={mood} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ color: MOOD_COLORS[mood] || "#00d4ff", fontFamily: "'Orbitron', monospace", fontSize: 10 }}>{mood?.toUpperCase()}</span>
                        <span style={{ color: "#4a6080", fontSize: 10 }}>{count}x</span>
                      </div>
                      <div style={{ height: 4, background: "rgba(255,255,255,0.04)", borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${(count / (data.recentMoods?.length || 1)) * 100}%`, background: MOOD_COLORS[mood] || "#00d4ff", borderRadius: 2, transition: "width 0.5s" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Mobile Bottom Nav */}
      {isMobile && (
        <div style={s.mobileBottomNav}>
          {[
            { key: "overview", icon: "◈", label: "HOME" },
            { key: "wishes", icon: "⭐", label: "GOALS" },
            { key: "memory", icon: "🧠", label: "MEMORY" },
            { key: "mood", icon: "📊", label: "MOOD" },
          ].map((tab) => (
            <button key={tab.key} style={{
              ...s.mobileNavBtn,
              color: activeTab === tab.key ? "#00d4ff" : "#4a6080",
              borderTop: activeTab === tab.key ? "2px solid #00d4ff" : "2px solid transparent",
            }} onClick={() => setActiveTab(tab.key)}>
              <span style={{ fontSize: 18 }}>{tab.icon}</span>
              <span style={{ fontSize: 8, fontFamily: "'Orbitron', monospace", letterSpacing: 1 }}>{tab.label}</span>
            </button>
          ))}
          <button style={{ ...s.mobileNavBtn, color: "#4a6080" }} onClick={() => navigate("/chat?mode=jarvis")}>
            <span style={{ fontSize: 18 }}>🤖</span>
            <span style={{ fontSize: 8, fontFamily: "'Orbitron', monospace", letterSpacing: 1 }}>JARVIS</span>
          </button>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #030712; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,212,255,0.15); border-radius: 4px; }
        button:hover:not(:disabled) { filter: brightness(1.15); }
      `}</style>
    </div>
  );
}

const s = {
  page: { display: "flex", height: "100vh", background: "#030712", fontFamily: "'Exo 2', sans-serif", color: "#e2e8f0", overflow: "hidden", position: "relative" },
  grid: { position: "absolute", inset: 0, backgroundImage: `linear-gradient(rgba(0,212,255,0.025) 1px, transparent 1px),linear-gradient(90deg, rgba(0,212,255,0.025) 1px, transparent 1px)`, backgroundSize: "40px 40px", pointerEvents: "none", zIndex: 0 },
  loadingText: { marginTop: 20, color: "#00d4ff", fontFamily: "'Orbitron', monospace", letterSpacing: 3, fontSize: 12 },
  mobileOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 199, backdropFilter: "blur(2px)" },
  sidebar: { width: 230, background: "rgba(3,8,20,0.97)", borderRight: "1px solid rgba(0,212,255,0.1)", zIndex: 10, display: "flex", flexDirection: "column", flexShrink: 0 },
  sidebarInner: { display: "flex", flexDirection: "column", height: "100%", padding: "20px 14px" },
  logoArea: { display: "flex", alignItems: "center", gap: 10, marginBottom: 30, padding: "0 8px" },
  logoText: { fontFamily: "'Orbitron', monospace", fontWeight: 900, fontSize: 16, letterSpacing: 4, color: "#00d4ff" },
  closeSidebarBtn: { background: "none", border: "none", color: "#4a6080", fontSize: 18, cursor: "pointer", marginRight: 4, padding: 4 },
  navGroup: { display: "flex", flexDirection: "column", gap: 4 },
  navItemActive: { background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 8, padding: "10px 14px", color: "#00d4ff", fontSize: 11, fontWeight: 600, fontFamily: "'Orbitron', monospace", letterSpacing: 1 },
  navItem: { padding: "10px 14px", color: "#4a6080", fontSize: 11, fontWeight: 500, fontFamily: "'Orbitron', monospace", letterSpacing: 1, textDecoration: "none" },
  tabBtn: { display: "flex", alignItems: "center", border: "1px solid transparent", borderRadius: 8, padding: "9px 12px", fontSize: 10, fontWeight: 600, fontFamily: "'Orbitron', monospace", letterSpacing: 1, cursor: "pointer", background: "transparent", transition: "all 0.15s" },
  spacer: { flex: 1 },
  userFooter: { display: "flex", alignItems: "center", gap: 10, paddingTop: 14, borderTop: "1px solid rgba(0,212,255,0.1)" },
  avatar: { width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(0,212,255,0.1)" },
  userInfo: { flex: 1, overflow: "hidden" },
  userName: { display: "block", color: "#e2e8f0", fontSize: 12, fontWeight: 600, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" },
  userRole: { display: "block", color: "#00d4ff", fontSize: 9, fontFamily: "'Orbitron', monospace", letterSpacing: 1.5, opacity: 0.5, marginTop: 2 },
  logoutBtn: { background: "none", border: "none", color: "#4a6080", cursor: "pointer", fontSize: 16 },
  hamburgerBtn: { background: "none", border: "none", color: "#00d4ff", fontSize: 20, cursor: "pointer", padding: "4px 6px", flexShrink: 0 },
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", zIndex: 1 },
  topBar: { display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid rgba(0,212,255,0.1)", flexShrink: 0, background: "rgba(3,8,20,0.6)", backdropFilter: "blur(10px)" },
  greeting: { fontSize: 22, fontWeight: 300, fontFamily: "'Orbitron', monospace", color: "#fff", letterSpacing: 1, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  greetingSub: { color: "#00d4ff", fontSize: 11, fontFamily: "'Orbitron', monospace", letterSpacing: 2, opacity: 0.6 },
  content: { flex: 1, overflowY: "auto", padding: "20px 16px" },
  bellBtn: { position: "relative", background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.15)", borderRadius: 10, padding: "8px 12px", color: "#00d4ff", fontSize: 16, cursor: "pointer", flexShrink: 0 },
  notifBadge: { position: "absolute", top: -4, right: -4, background: "#ef4444", color: "#fff", borderRadius: "50%", width: 18, height: 18, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Orbitron', monospace", fontWeight: 700 },
  notifDropdown: { position: "absolute", top: "calc(100% + 10px)", right: 0, width: 360, background: "rgba(5,12,28,0.98)", border: "1px solid rgba(0,212,255,0.15)", borderRadius: 12, backdropFilter: "blur(20px)", zIndex: 100, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" },
  notifHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(0,212,255,0.1)" },
  notifTitle: { fontFamily: "'Orbitron', monospace", fontSize: 10, color: "#00d4ff", letterSpacing: 2 },
  notifReadAll: { background: "none", border: "none", color: "#4a6080", fontSize: 11, cursor: "pointer" },
  notifEmpty: { padding: 20, color: "#4a6080", fontSize: 13, textAlign: "center" },
  notifList: { maxHeight: 380, overflowY: "auto" },
  notifItem: { display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px", borderBottom: "1px solid rgba(0,212,255,0.05)", cursor: "pointer", transition: "background 0.15s", position: "relative" },
  notifDot: { width: 7, height: 7, borderRadius: "50%", background: "#00d4ff", flexShrink: 0, marginTop: 5 },
  notifItemTitle: { color: "#e2e8f0", fontSize: 12, fontWeight: 600, marginBottom: 4 },
  notifItemBody: { color: "#8aabb8", fontSize: 12, lineHeight: 1.5 },
  notifItemTime: { color: "#2a3f55", fontSize: 10, marginTop: 6, fontFamily: "'Orbitron', monospace" },
  notifDelBtn: { background: "none", border: "none", color: "#2a3f55", cursor: "pointer", fontSize: 14, flexShrink: 0, padding: "0 4px" },
  chatBtn: { background: "linear-gradient(135deg, rgba(0,100,160,0.8), rgba(0,60,110,0.9))", border: "1px solid rgba(0,212,255,0.25)", borderRadius: 8, color: "#00d4ff", padding: "10px 18px", fontSize: 11, fontWeight: 600, fontFamily: "'Orbitron', monospace", letterSpacing: 1, cursor: "pointer", whiteSpace: "nowrap" },
  dashboardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 },
  card: { background: "rgba(5,15,30,0.7)", border: "1px solid rgba(0,212,255,0.12)", borderRadius: 14, padding: 18, backdropFilter: "blur(10px)" },
  cardTitle: { fontSize: 10, fontFamily: "'Orbitron', monospace", letterSpacing: 2, color: "#4a6080", textTransform: "uppercase", marginBottom: 14, borderBottom: "1px solid rgba(0,212,255,0.08)", paddingBottom: 8 },
  quickActions: { display: "flex", gap: 10, flexWrap: "wrap" },
  actionBtn: { flex: "1 1 calc(33% - 10px)", minWidth: 120, background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.12)", borderRadius: 8, padding: "12px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: "#e2e8f0", fontSize: 12, fontWeight: 600, fontFamily: "'Exo 2', sans-serif", transition: "all 0.2s" },
  actionIcon: { fontSize: 16 },
  deadlineItem: { display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid rgba(239,68,68,0.08)" },
  deadlineIcon: { fontSize: 18 },
  deadlineTitle: { color: "#e2e8f0", fontSize: 13, fontWeight: 500 },
  deadlineBadge: { borderRadius: 6, padding: "4px 8px", fontSize: 10, fontFamily: "'Orbitron', monospace", fontWeight: 700 },
  personalitySummary: { fontSize: 14, lineHeight: 1.6, color: "#cbd5e1", marginBottom: 12 },
  badges: { display: "flex", gap: 6, flexWrap: "wrap" },
  badge: { background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.15)", color: "#00d4ff", borderRadius: 999, padding: "3px 10px", fontSize: 10, fontFamily: "'Orbitron', monospace", letterSpacing: 1, opacity: 0.8 },
  statsGrid: { display: "flex", gap: 12, marginBottom: 16 },
  statBox: { flex: 1, background: "rgba(0,212,255,0.03)", border: "1px solid rgba(0,212,255,0.08)", borderRadius: 10, padding: "14px 10px", textAlign: "center" },
  statNum: { display: "block", fontSize: 28, fontWeight: 700, fontFamily: "'Orbitron', monospace", color: "#00d4ff", marginBottom: 4 },
  statLabel: { display: "block", fontSize: 9, fontFamily: "'Orbitron', monospace", color: "#4a6080", letterSpacing: 1 },
  viewMoreBtn: { background: "none", border: "1px solid rgba(0,212,255,0.15)", borderRadius: 6, color: "#00d4ff", padding: "8px 14px", fontSize: 11, cursor: "pointer", fontFamily: "'Orbitron', monospace", letterSpacing: 1 },
  emptyText: { color: "#4a6080", fontSize: 13, fontStyle: "italic" },
  chartArea: { height: 160, marginBottom: 12 },
  chartGrid: { display: "flex", alignItems: "flex-end", gap: 10, height: "100%", borderBottom: "1px solid rgba(0,212,255,0.08)", paddingBottom: 8 },
  chartColumn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%" },
  barWrap: { flex: 1, width: "100%", display: "flex", alignItems: "flex-end", background: "rgba(255,255,255,0.02)", borderRadius: 4 },
  bar: { width: "100%", borderRadius: "4px 4px 0 0", transition: "height 0.5s ease-out", minHeight: 4 },
  dateLabel: { fontSize: 9, color: "#4a6080", fontFamily: "'Orbitron', monospace" },
  latestMood: { fontSize: 12, color: "#cbd5e1", display: "flex", gap: 6, alignItems: "center", background: "rgba(0,0,0,0.2)", padding: "8px 12px", borderRadius: 6, marginTop: 8 },
  sessionGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 },
  sessionCard: { background: "rgba(0,212,255,0.03)", border: "1px solid rgba(0,212,255,0.08)", borderRadius: 10, padding: 16, cursor: "pointer", transition: "background 0.2s" },
  sessionTitle: { fontSize: 13, fontWeight: 600, color: "#8aaabb", marginBottom: 6 },
  sessionSummary: { fontSize: 11, color: "#4a6080", marginBottom: 10, lineHeight: 1.4, height: 32, overflow: "hidden" },
  sessionMeta: { fontSize: 9, fontFamily: "'Orbitron', monospace", color: "#00d4ff", opacity: 0.5 },
  tabPageTitle: { fontSize: 18, fontWeight: 300, fontFamily: "'Orbitron', monospace", color: "#fff", letterSpacing: 2 },
  addWishBtn: { background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, color: "#f59e0b", padding: "10px 18px", fontSize: 11, fontWeight: 600, fontFamily: "'Orbitron', monospace", letterSpacing: 1, cursor: "pointer" },
  wishForm: { background: "rgba(5,15,30,0.8)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 14, padding: 20, marginBottom: 24 },
  wishFormGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  formInput: { background: "rgba(0,10,25,0.6)", border: "1px solid rgba(0,212,255,0.12)", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 13, fontFamily: "'Exo 2', sans-serif", outline: "none", width: "100%" },
  formSelect: { background: "rgba(0,10,25,0.6)", border: "1px solid rgba(0,212,255,0.12)", borderRadius: 8, padding: "10px 12px", color: "#e2e8f0", fontSize: 13, fontFamily: "'Exo 2', sans-serif", outline: "none", cursor: "pointer" },
  formSubmitBtn: { background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, color: "#f59e0b", padding: "10px 20px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Orbitron', monospace" },
  formCancelBtn: { background: "transparent", border: "1px solid rgba(0,212,255,0.1)", borderRadius: 8, color: "#4a6080", padding: "10px 20px", fontSize: 12, cursor: "pointer" },
  wishGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 },
  wishCard: { background: "rgba(5,15,30,0.7)", border: "1px solid rgba(0,212,255,0.1)", borderRadius: 14, padding: 18, backdropFilter: "blur(10px)", position: "relative" },
  wishCardHeader: { display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 8 },
  wishCardTitle: { color: "#e2e8f0", fontSize: 14, fontWeight: 600, lineHeight: 1.4 },
  wishDeadline: { color: "#4a6080", fontSize: 11, marginTop: 4 },
  priorityTag: { borderRadius: 6, padding: "4px 8px", fontSize: 9, fontFamily: "'Orbitron', monospace", fontWeight: 700, flexShrink: 0 },
  wishDesc: { color: "#64748b", fontSize: 12, lineHeight: 1.5, marginTop: 6 },
  progressText: { color: "#4a6080", fontSize: 9, fontFamily: "'Orbitron', monospace", letterSpacing: 1 },
  bigProgressBarWrap: { height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" },
  bigProgressBar: { height: "100%", borderRadius: 3, transition: "width 0.5s ease" },
  wishControls: { display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" },
  wishControlBtn: { background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.12)", borderRadius: 6, color: "#00d4ff", padding: "8px 12px", fontSize: 12, cursor: "pointer", fontFamily: "'Exo 2', sans-serif" },
  wishCategory: { position: "absolute", top: 14, right: 14, fontSize: 8, fontFamily: "'Orbitron', monospace", color: "#2a3f55", letterSpacing: 1 },
  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 20px", gap: 12, textAlign: "center" },
  memoryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 },
  memoryCard: { background: "rgba(5,15,30,0.7)", border: "1px solid rgba(0,212,255,0.1)", borderRadius: 12, padding: 16 },
  memoryCategoryTag: { fontSize: 8, fontFamily: "'Orbitron', monospace", color: "#00d4ff", letterSpacing: 2, marginBottom: 8, opacity: 0.7 },
  memoryCardText: { color: "#cbd5e1", fontSize: 13, lineHeight: 1.5 },
  importanceBadge: { borderRadius: 4, padding: "3px 8px", fontSize: 9, fontFamily: "'Orbitron', monospace", fontWeight: 600 },
  memoryDelBtn: { background: "none", border: "none", color: "#2a3f55", cursor: "pointer", fontSize: 13 },
  // Mobile bottom nav
  mobileBottomNav: { position: "fixed", bottom: 0, left: 0, right: 0, height: 64, background: "rgba(3,8,20,0.97)", borderTop: "1px solid rgba(0,212,255,0.12)", display: "flex", alignItems: "stretch", zIndex: 150, backdropFilter: "blur(16px)" },
  mobileNavBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, background: "none", border: "none", cursor: "pointer", transition: "color 0.2s", padding: "8px 4px" },
};
