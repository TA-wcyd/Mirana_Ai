import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe, loginWithGoogle } from "../services/api";

const BOOT_LINES = [
  "INITIALIZING MIRANA SYSTEMS...",
  "LOADING PERSONALITY ENGINE...",
  "ESTABLISHING SECURE CONNECTION...",
  "READY.",
];

export default function Login() {
  const navigate = useNavigate();
  const [bootLine, setBootLine] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getMe()
      .then((d) => {
        if (d.authenticated) {
          sessionStorage.setItem("mirana_just_logged_in", "true");
          navigate(d.user.onboardingComplete ? "/chat" : "/onboarding");
        }
      })
      .catch(() => {});
  }, []);

  // Boot sequence animation
  useEffect(() => {
    if (bootLine >= BOOT_LINES.length - 1) {
      setTimeout(() => setReady(true), 400);
      return;
    }
    const t = setTimeout(() => setBootLine((p) => p + 1), 600);
    return () => clearTimeout(t);
  }, [bootLine]);

  return (
    <div style={s.page}>
      {/* Grid background */}
      <div style={s.grid} />
      {/* Radial glow */}
      <div style={s.glow} />

      <div style={s.panel}>
        {/* Top status bar */}
        <div style={s.statusBar}>
          <span style={s.statusDot} />
          <span style={s.statusText}>MIRANA OS v2.5 — SECURE</span>
        </div>

        {/* Logo */}
        <div style={s.orbWrap}>
          <div style={s.orbOuter} />
          <div style={s.orbMid} />
          <div style={s.orbCore}>M</div>
        </div>

        <h1 style={s.title}>MIRANA</h1>
        <p style={s.subtitle}>Personal AI Intelligence System</p>

        {/* Boot sequence */}
        <div style={s.bootBox}>
          {BOOT_LINES.slice(0, bootLine + 1).map((line, i) => (
            <p key={i} style={{ ...s.bootLine, opacity: i === bootLine ? 1 : 0.4 }}>
              {line}
            </p>
          ))}
        </div>

        {/* Auth button */}
        <button
          style={{
            ...s.authBtn,
            opacity: ready ? 1 : 0,
            transform: ready ? "translateY(0)" : "translateY(10px)",
            pointerEvents: ready ? "auto" : "none",
          }}
          onClick={loginWithGoogle}
        >
          <GoogleIcon />
          AUTHENTICATE WITH GOOGLE
        </button>

        <p style={s.hint}>Identity verification required to access Mirana</p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #030712; }
        @keyframes loginSpin { to { transform: rotate(360deg); } }
        @keyframes loginPulse { from { opacity: 0.7; transform: scale(0.95); } to { opacity: 1; transform: scale(1.05); } }
        @keyframes loginGlow { from { opacity: 0.4; } to { opacity: 0.9; } }
      `}</style>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" style={{ marginRight: 10, flexShrink: 0 }}>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#030712",
    fontFamily: "'Exo 2', sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  grid: {
    position: "absolute",
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px)
    `,
    backgroundSize: "40px 40px",
    pointerEvents: "none",
  },
  glow: {
    position: "absolute",
    width: 700,
    height: 700,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
  },
  panel: {
    background: "rgba(5,15,30,0.85)",
    border: "1px solid rgba(0,212,255,0.15)",
    borderRadius: 16,
    padding: "44px 48px",
    maxWidth: 420,
    width: "90%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    backdropFilter: "blur(20px)",
    boxShadow: "0 0 60px rgba(0,212,255,0.06), inset 0 1px 0 rgba(0,212,255,0.1)",
    zIndex: 1,
  },
  statusBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    alignSelf: "stretch",
    marginBottom: 32,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#00d4ff",
    boxShadow: "0 0 6px #00d4ff",
    animation: "loginGlow 1.5s ease-in-out infinite alternate",
    display: "block",
  },
  statusText: {
    color: "#00d4ff",
    fontSize: 10,
    fontFamily: "'Orbitron', monospace",
    letterSpacing: 2,
    opacity: 0.7,
  },
  orbWrap: {
    position: "relative",
    width: 80,
    height: 80,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  orbOuter: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    border: "1px solid rgba(0,212,255,0.3)",
    borderTop: "2px solid #00d4ff",
    animation: "loginSpin 4s linear infinite",
  },
  orbMid: {
    position: "absolute",
    width: "75%",
    height: "75%",
    borderRadius: "50%",
    border: "1px solid rgba(0,212,255,0.2)",
    borderRight: "1.5px solid #00d4ff",
    animation: "loginSpin 3s linear infinite reverse",
  },
  orbCore: {
    width: "44%",
    height: "44%",
    borderRadius: "50%",
    background: "radial-gradient(circle at 35% 35%, #60e8ff, #0055aa)",
    boxShadow: "0 0 15px #00d4ff, 0 0 30px rgba(0,212,255,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: 13,
    fontWeight: 800,
    fontFamily: "'Orbitron', monospace",
    animation: "loginPulse 3s ease-in-out infinite alternate",
  },
  title: {
    color: "#e2e8f0",
    fontSize: 32,
    fontWeight: 900,
    fontFamily: "'Orbitron', monospace",
    letterSpacing: 8,
    marginBottom: 6,
    textShadow: "0 0 20px rgba(0,212,255,0.3)",
  },
  subtitle: {
    color: "#4a6080",
    fontSize: 11,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 28,
    fontFamily: "'Orbitron', monospace",
  },
  bootBox: {
    alignSelf: "stretch",
    background: "rgba(0,0,0,0.3)",
    border: "1px solid rgba(0,212,255,0.08)",
    borderRadius: 8,
    padding: "12px 16px",
    marginBottom: 28,
    minHeight: 90,
  },
  bootLine: {
    color: "#00d4ff",
    fontSize: 11,
    fontFamily: "'Orbitron', monospace",
    letterSpacing: 1,
    marginBottom: 4,
    transition: "opacity 0.3s",
  },
  authBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,212,255,0.06)",
    border: "1px solid rgba(0,212,255,0.3)",
    borderRadius: 10,
    color: "#00d4ff",
    padding: "13px 28px",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "'Orbitron', monospace",
    letterSpacing: 2,
    cursor: "pointer",
    width: "100%",
    transition: "all 0.5s ease, background 0.2s",
    boxShadow: "0 0 20px rgba(0,212,255,0.08)",
  },
  hint: {
    color: "#253040",
    fontSize: 11,
    marginTop: 16,
    textAlign: "center",
    fontFamily: "'Exo 2', sans-serif",
  },
};