import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../services/api";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    getMe()
      .then((d) => {
        if (d.authenticated) {
          navigate(d.user.onboardingComplete ? "/chat" : "/onboarding");
        } else {
          navigate("/login");
        }
      })
      .catch(() => navigate("/login"));
  }, []);

  return (
    <div style={s.page}>
      <div style={s.spinner} />
      <p style={s.text}>ESTABLISHING SECURE LINK…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#030712",
    gap: 20,
    fontFamily: "'Orbitron', monospace",
  },
  spinner: {
    width: 40,
    height: 40,
    border: "2px solid rgba(0,212,255,0.15)",
    borderTop: "2px solid #00d4ff",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  text: {
    color: "#00d4ff",
    fontSize: 10,
    letterSpacing: 3,
    opacity: 0.7,
  },
};