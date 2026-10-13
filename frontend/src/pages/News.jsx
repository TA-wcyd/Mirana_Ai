import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import MiranaOrb from "../components/MiranaOrb";
import { getMe, getNews, logout } from "../services/api";

export default function News() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    getMe()
      .then((d) => {
        if (!d.authenticated) return navigate("/login");
        setUser(d.user);
        loadNews("");
      })
      .catch((err) => {
        console.error("News page auth error:", err);
        navigate("/login");
      });
  }, [navigate]);

  const loadNews = async (searchQuery) => {
    setLoading(true);
    setQuery(searchQuery || "Top Headlines"); // Update header immediately for feedback
    try {
      const data = await getNews(searchQuery);
      setArticles(data.articles || []);
      // Sync back with actual server query name if needed
      if (data.query) setQuery(data.query);
    } catch (err) {
      console.error("Failed to load news:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  if (loading && !user) {
    return (
      <div style={{ ...s.page, justifyContent: "center", alignItems: "center" }}>
        <MiranaOrb size={60} isSpeaking={true} />
        <p style={s.loadingText}>SYNCING NEWS NETWORK...</p>
      </div>
    );
  }

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
            <Link to="/dashboard" style={s.navItem}>DASHBOARD</Link>
            <Link to="/chat" style={s.navItem}>AI TERMINAL</Link>
            <div style={s.navItemActive}>GLOBAL FEED</div>
          </div>

          <div style={s.spacer} />

          {user && (
            <div style={s.userFooter}>
              {user.photo && <img src={user.photo} style={s.avatar} referrerPolicy="no-referrer" alt="" />}
              <div style={s.userInfo}>
                <span style={s.userName}>{user.displayName}</span>
                <span style={s.userRole}>AUTHORIZED</span>
              </div>
              <button style={s.logoutBtn} onClick={handleLogout}>⏻</button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={s.main}>
        <div style={s.header}>
          <h1 style={s.greeting}>Global Network Feed</h1>
          <p style={s.greetingSub}>
            Latest intelligence and headlines based on your region or topic. 
            Currently tracking: <span style={{color: "#fff"}}>{query.toUpperCase()}</span>
          </p>
        </div>

        <div style={s.searchBar}>
           <input 
             type="text" 
             placeholder="Search global topics (e.g. Madrid, AI, Stocks)..." 
             style={s.searchInput}
             value={query === "Top Headlines" ? "" : query}
             onChange={(e) => setQuery(e.target.value)}
             onKeyDown={(e) => {
               if (e.key === "Enter") loadNews(e.target.value);
             }}
           />
           <button style={s.searchBtn} onClick={() => loadNews(query)}>SEARCH</button>
        </div>

        {loading ? (
           <div style={s.loadingContainer}>
              <MiranaOrb size={50} isSpeaking={true} />
              <p style={s.loadingText}>Intercepting Global Feeds...</p>
           </div>
        ) : articles.length === 0 ? (
           <p style={s.emptyText}>No intelligence reports found for "{query}". Try a broader topic.</p>
        ) : (
          <div style={s.newsGrid}>
            {articles.map((article, idx) => (
              <a key={idx} href={article.link} target="_blank" rel="noreferrer" style={s.newsCard}>
                <div style={s.articleMeta}>
                  <span style={s.sourceBadge}>{article.source}</span>
                  <span style={s.dateText}>{new Date(article.pubDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                
                {/* 100% Automated Real-Time Thumbnail System */}
                <img 
                  src={article.thumbnail || `https://api.microlink.io/?url=${encodeURIComponent(article.link)}&embed=image.url&screenshot=true&meta=false`} 
                  alt="" 
                  style={s.articleImage} 
                  onError={(e) => {
                    // Final fallback if even Microlink fails (e.g. invalid URL)
                    e.target.src = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=1000&auto=format&fit=crop";
                  }}
                />

                <h3 style={s.articleTitle}>{article.title}</h3>
                <div style={s.readMore}>ACCESS PORTAL →</div>
              </a>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #030712; overflow: hidden; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,212,255,0.15); border-radius: 4px; }
        a { text-decoration: none; }
      `}</style>
    </div>
  );
}

const s = {
  page: { display: "flex", height: "100vh", background: "#030712", fontFamily: "'Exo 2', sans-serif", color: "#e2e8f0", overflow: "hidden", position: "relative" },
  grid: { position: "absolute", inset: 0, backgroundImage: `linear-gradient(rgba(0,212,255,0.025) 1px, transparent 1px),linear-gradient(90deg, rgba(0,212,255,0.025) 1px, transparent 1px)`, backgroundSize: "40px 40px", pointerEvents: "none", zIndex: 0 },
  loadingText: { marginTop: 20, color: "#00d4ff", fontFamily: "'Orbitron', monospace", letterSpacing: 3, fontSize: 12 },
  loadingContainer: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "40vh" },
  
  sidebar: { width: 220, background: "rgba(3,8,20,0.9)", borderRight: "1px solid rgba(0,212,255,0.1)", zIndex: 10, display: "flex", flexDirection: "column", flexShrink: 0 },
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

  searchBar: { marginBottom: 30, display: "flex", gap: 12, maxWidth: 800 },
  searchInput: { flex: 1, background: "rgba(0,10,25,0.6)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 8, padding: "16px 20px", color: "#fff", fontSize: 15, fontFamily: "'Exo 2', sans-serif", outline: "none", transition: "border-color 0.2s" },
  searchBtn: { background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)", borderRadius: 8, color: "#00d4ff", padding: "0 24px", fontSize: 12, fontWeight: 700, fontFamily: "'Orbitron', monospace", cursor: "pointer", transition: "all 0.2s" },
  
  newsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 24, maxWidth: 1200 },
  newsCard: { display: "flex", flexDirection: "column", background: "rgba(5,15,30,0.7)", border: "1px solid rgba(0,212,255,0.15)", borderRadius: 12, padding: 24, backdropFilter: "blur(10px)", cursor: "pointer", transition: "transform 0.2s, background 0.2s", ":hover": { background: "rgba(0,212,255,0.05)", transform: "translateY(-2px)" } },
  articleMeta: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sourceBadge: { background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)", color: "#00d4ff", borderRadius: 4, padding: "4px 8px", fontSize: 10, fontFamily: "'Orbitron', monospace", letterSpacing: 1 },
  dateText: { color: "#4a6080", fontSize: 11, fontFamily: "'Orbitron', monospace" },
  articleTitle: { fontSize: 16, fontWeight: 600, color: "#e2e8f0", lineHeight: 1.4, marginBottom: 20, flex: 1 },
  articleImage: { width: "100%", height: 160, objectFit: "cover", borderRadius: 8, marginBottom: 16, border: "1px solid rgba(0,212,255,0.1)" },
  readMore: { color: "#00d4ff", fontSize: 11, fontFamily: "'Orbitron', monospace", letterSpacing: 2, marginTop: "auto" },
  
  emptyText: { color: "#4a6080", fontSize: 14, fontStyle: "italic" },
};
