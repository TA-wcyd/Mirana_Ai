import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import MiranaOrb from "../components/MiranaOrb";
import { getDashboard, logout } from "../services/api";

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Dashboard error:", err);
        navigate("/login");
      });
  }, [navigate]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  if (loading || !data) {
    return (
      <div style={{ ...s.page, justifyContent: "center", alignItems: "center" }}>
        <MiranaOrb size={60} isSpeaking={true} />
        <p style={s.loadingText}>SYNCING SECURE DATA...</p>
      </div>
    );
  }

  // Generate simple bars for mood chart
  const moodColors = {
    happy: "#10b981",
    excited: "#f59e0b",
    neutral: "#3b82f6",
    curious: "#8b5cf6",
    stressed: "#ef4444",
    sad: "#64748b",
    angry: "#dc2626",
  };

  const trendData = data.moodTrend || [];
  const maxCount = Math.max(...trendData.map((d) => d.count), 1);

  return (
    <div style={s.page}>
      <div style={s.grid} />
      
      {/* Sidebar (mini version) */}
      <div style={s.sidebar}>
        <div style={s.sidebarInner}>
          <div style={s.logoArea}>
            <MiranaOrb size={28} />
            <span style={s.logoText}>MIRANA</span>
          </div>
          
          <div style={s.navGroup}>
            <div style={s.navItemActive}>DASHBOARD</div>
            <Link to="/chat" style={s.navItem}>AI TERMINAL</Link>
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
      </div>

      {/* Main Content */}
      <div style={s.main}>
        <div style={s.header}>
          <h1 style={s.greeting}>{data.greeting}</h1>
          <p style={s.greetingSub}>
            Intelligence systems online. {data.memoryStats?.total || 0} facts securely stored.
          </p>
        </div>

        <div style={s.dashboardGrid}>
          {/* Quick Actions (Row) */}
          <div style={{ ...s.card, gridColumn: "1 / -1", background: "rgba(0,10,25,0.4)" }}>
            <h2 style={s.cardTitle}>Quick Protocols</h2>
            <div style={s.quickActions}>
              <button style={s.actionBtn} onClick={() => navigate("/chat?mode=default")}>
                <span style={{...s.actionIcon, color: "#00d4ff"}}>💬</span>
                Standard Chat
              </button>
              <button style={s.actionBtn} onClick={() => navigate("/chat?mode=study")}>
                <span style={{...s.actionIcon, color: "#10b981"}}>🧠</span>
                Study Mode
              </button>
              <button style={s.actionBtn} onClick={() => navigate("/chat?mode=coach")}>
                <span style={{...s.actionIcon, color: "#f59e0b"}}>⚡</span>
                Coach Mode
              </button>
              <button style={s.actionBtn} onClick={() => navigate("/chat?mode=debate")}>
                <span style={{...s.actionIcon, color: "#ef4444"}}>⚔️</span>
                Debate Mode
              </button>
            </div>
          </div>

          {/* Identity & Memory Card */}
          <div style={s.card}>
            <h2 style={s.cardTitle}>Core Identity</h2>
            <p style={s.personalitySummary}>{data.personality.summary || "Profile gathering..."}</p>
            
            <div style={s.badges}>
              {data.personality.traits?.slice(0, 3).map(t => <span key={t} style={s.badge}>{t}</span>)}
            </div>

            <div style={s.divider} />
            
            <h2 style={s.cardTitle}>Recent Memories Stored</h2>
            {data.recentMemories?.length === 0 ? (
              <p style={s.emptyText}>No long-term memories extracted yet.</p>
            ) : (
              <div style={s.memoryList}>
                {data.recentMemories?.map((m) => (
                  <div key={m._id} style={s.memoryItem}>
                    <span style={s.memoryCategory}>[{m.category.toUpperCase()}]</span>
                    <span style={s.memoryText}>{m.content}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Emotional Telemetry Card */}
          <div style={s.card}>
            <h2 style={s.cardTitle}>Emotional Telemetry (7 Days)</h2>
            {trendData.length === 0 ? (
              <p style={s.emptyText}>No mood data recorded yet.</p>
            ) : (
              <div style={s.chartArea}>
                <div style={s.chartGrid}>
                  {/* Y-axis lines could go here via CSS background */}
                  {trendData.map((day, i) => {
                    const height = (day.count / maxCount) * 100;
                    return (
                      <div key={i} style={s.chartColumn} title={`${day.date}: ${day.mood} (${day.count})`}>
                        <div style={s.barWrap}>
                          <div 
                            style={{
                              ...s.bar,
                              height: `${height}%`,
                              background: moodColors[day.mood] || "#00d4ff",
                            }} 
                          />
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
                Current State: <strong style={{color: moodColors[data.recentMoods[0].mood] || "#00d4ff"}}>
                  {data.recentMoods[0].mood.toUpperCase()}
                </strong>
              </div>
            )}
          </div>

          {/* Recent Sessions */}
          <div style={{ ...s.card, gridColumn: "1 / -1" }}>
            <h2 style={s.cardTitle}>Recent Sessions</h2>
            {data.recentChats?.length === 0 ? (
              <p style={s.emptyText}>No chat history found.</p>
            ) : (
              <div style={s.sessionGrid}>
                {data.recentChats?.map(c => (
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
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #030712; overflow: hidden; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,212,255,0.15); border-radius: 4px; }
        button:hover { filter: brightness(1.2); }
      `}</style>
    </div>
  );
}

const s = {
  page: { display: "flex", height: "100vh", background: "#030712", fontFamily: "'Exo 2', sans-serif", color: "#e2e8f0", overflow: "hidden", position: "relative" },
  grid: { position: "absolute", inset: 0, backgroundImage: `linear-gradient(rgba(0,212,255,0.025) 1px, transparent 1px),linear-gradient(90deg, rgba(0,212,255,0.025) 1px, transparent 1px)`, backgroundSize: "40px 40px", pointerEvents: "none", zIndex: 0 },
  loadingText: { marginTop: 20, color: "#00d4ff", fontFamily: "'Orbitron', monospace", letterSpacing: 3, fontSize: 12 },
  
  sidebar: { width: 220, background: "rgba(3,8,20,0.9)", borderRight: "1px solid rgba(0,212,255,0.1)", zIndex: 10, display: "flex", flexDirection: "column" },
  sidebarInner: { display: "flex", flexDirection: "column", height: "100%", padding: "20px 14px" },
  logoArea: { display: "flex", alignItems: "center", gap: 10, marginBottom: 40, padding: "0 8px" },
  logoText: { fontFamily: "'Orbitron', monospace", fontWeight: 900, fontSize: 16, letterSpacing: 4, color: "#00d4ff" },
  
  navGroup: { display: "flex", flexDirection: "column", gap: 6 },
  navItemActive: { background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 8, padding: "12px 14px", color: "#00d4ff", fontSize: 13, fontWeight: 600, fontFamily: "'Orbitron', monospace", letterSpacing: 1 },
  navItem: { padding: "12px 14px", color: "#4a6080", fontSize: 13, fontWeight: 500, fontFamily: "'Orbitron', monospace", letterSpacing: 1, textDecoration: "none", transition: "color 0.2s" },
  
  spacer: { flex: 1 },
  userFooter: { display: "flex", alignItems: "center", gap: 10, paddingTop: 14, borderTop: "1px solid rgba(0,212,255,0.1)" },
  avatar: { width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(0,212,255,0.1)" },
  userInfo: { flex: 1, overflow: "hidden" },
  userName: { display: "block", color: "#e2e8f0", fontSize: 12, fontWeight: 600, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" },
  userRole: { display: "block", color: "#00d4ff", fontSize: 9, fontFamily: "'Orbitron', monospace", letterSpacing: 1.5, opacity: 0.5, marginTop: 2 },
  logoutBtn: { background: "none", border: "none", color: "#4a6080", cursor: "pointer", fontSize: 16 },

  main: { flex: 1, padding: "40px", overflowY: "auto", zIndex: 1, position: "relative" },
  header: { marginBottom: 30 },
  greeting: { fontSize: 32, fontWeight: 300, fontFamily: "'Orbitron', monospace", color: "#fff", letterSpacing: 1, marginBottom: 8 },
  greetingSub: { color: "#00d4ff", fontSize: 13, fontFamily: "'Orbitron', monospace", letterSpacing: 2, opacity: 0.7 },

  dashboardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 24, maxWidth: 1200 },
  card: { background: "rgba(5,15,30,0.7)", border: "1px solid rgba(0,212,255,0.15)", borderRadius: 12, padding: 24, backdropFilter: "blur(10px)" },
  cardTitle: { fontSize: 12, fontFamily: "'Orbitron', monospace", letterSpacing: 2, color: "#4a6080", textTransform: "uppercase", marginBottom: 16, borderBottom: "1px solid rgba(0,212,255,0.1)", paddingBottom: 8 },
  
  personalitySummary: { fontSize: 14, lineHeight: 1.6, color: "#cbd5e1", marginBottom: 12 },
  badges: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 },
  badge: { background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.15)", color: "#00d4ff", borderRadius: 999, padding: "3px 10px", fontSize: 10, fontFamily: "'Orbitron', monospace", letterSpacing: 1, opacity: 0.8 },
  divider: { height: 1, background: "rgba(0,212,255,0.1)", margin: "20px 0" },
  
  memoryList: { display: "flex", flexDirection: "column", gap: 8 },
  memoryItem: { background: "rgba(0,10,25,0.5)", padding: "10px 12px", borderRadius: 6, borderLeft: "2px solid #00d4ff", display: "flex", gap: 8, fontSize: 13 },
  memoryCategory: { color: "#00d4ff", fontFamily: "'Orbitron', monospace", fontSize: 10, opacity: 0.7, shrink: 0 },
  memoryText: { color: "#cbd5e1" },
  
  emptyText: { color: "#4a6080", fontSize: 13, fontStyle: "italic" },

  chartArea: { height: 160, marginBottom: 16 },
  chartGrid: { display: "flex", alignItems: "flex-end", gap: 12, height: "100%", borderBottom: "1px solid rgba(0,212,255,0.1)", paddingBottom: 8 },
  chartColumn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%" },
  barWrap: { flex: 1, width: "100%", display: "flex", alignItems: "flex-end", background: "rgba(255,255,255,0.02)", borderRadius: 4 },
  bar: { width: "100%", borderRadius: 4, transition: "height 0.5s ease-out", minHeight: 4 },
  dateLabel: { fontSize: 10, color: "#4a6080", fontFamily: "'Orbitron', monospace" },
  latestMood: { fontSize: 13, color: "#cbd5e1", display: "flex", gap: 6, alignItems: "center", background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: 6 },

  quickActions: { display: "flex", gap: 12, flexWrap: "wrap" },
  actionBtn: { flex: "1 1 calc(25% - 12px)", minWidth: 140, background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 8, padding: "16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, color: "#e2e8f0", fontSize: 13, fontWeight: 600, fontFamily: "'Exo 2', sans-serif", transition: "all 0.2s" },
  actionIcon: { fontSize: 18 },

  sessionGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 },
  sessionCard: { background: "rgba(0,212,255,0.03)", border: "1px solid rgba(0,212,255,0.1)", borderRadius: 8, padding: 16, cursor: "pointer", transition: "background 0.2s" },
  sessionTitle: { fontSize: 14, fontWeight: 600, color: "#8aaabb", marginBottom: 6 },
  sessionSummary: { fontSize: 12, color: "#4a6080", marginBottom: 12, lineHeight: 1.4, height: 34, overflow: "hidden" },
  sessionMeta: { fontSize: 10, fontFamily: "'Orbitron', monospace", color: "#00d4ff", opacity: 0.5 },
};
