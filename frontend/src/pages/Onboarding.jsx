import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getOnboardingQuestions, submitOnboarding } from "../services/api";
import MiranaOrb from "../components/MiranaOrb";

export default function Onboarding() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getOnboardingQuestions()
      .then((d) => setQuestions(d.questions))
      .catch(() => setError("Failed to load questions. Refresh and try again."));
  }, []);

  const q = questions[step];
  const progress = questions.length ? (step / questions.length) * 100 : 0;

  const handleNext = () => {
    if (!current.trim()) return;
    const updated = { ...answers, [q.id]: current.trim() };
    setAnswers(updated);
    setCurrent("");
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      handleSubmit(updated);
    }
  };

  const handleSubmit = async (finalAnswers) => {
    setAnalyzing(true);
    try {
      await submitOnboarding(finalAnswers);
      navigate("/chat");
    } catch {
      setError("Analysis failed. Try again.");
      setAnalyzing(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleNext();
    }
  };

  if (analyzing) {
    return (
      <div style={s.page}>
        <div style={s.grid} />
        <div style={s.analyzeBox}>
          <MiranaOrb isSpeaking={true} size={120} />
          <h2 style={s.analyzeTitle}>CALIBRATING PROFILE</h2>
          <p style={s.analyzeSub}>
            Mirana is analyzing your personality to tailor her responses...
          </p>
          <div style={s.dotRow}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ ...s.dot, animationDelay: `${i * 0.3}s` }} />
            ))}
          </div>
        </div>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;500;600&display=swap');
          @keyframes blink { 0%,80%,100%{opacity:0.2} 40%{opacity:1} }
        `}</style>
      </div>
    );
  }

  if (!q) {
    return (
      <div style={s.page}>
        <div style={s.grid} />
        {error ? (
          <p style={{ color: "#ff5050", fontFamily: "'Exo 2', sans-serif" }}>{error}</p>
        ) : (
          <div style={s.spinner} />
        )}
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.grid} />
      <div style={s.glow} />

      <div style={s.panel}>
        {/* Header */}
        <div style={s.header}>
          <MiranaOrb size={52} />
          <div>
            <h2 style={s.heading}>PERSONALITY CALIBRATION</h2>
            <p style={s.stepLabel}>
              QUERY {String(step + 1).padStart(2, "0")} /{" "}
              {String(questions.length).padStart(2, "0")}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div style={s.progressTrack}>
          <div style={{ ...s.progressFill, width: `${progress}%` }} />
        </div>

        {/* Question */}
        <p style={s.question}>{q.question}</p>

        {/* Answer */}
        <textarea
          style={s.textarea}
          placeholder="Type your response…"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          onKeyDown={handleKey}
          rows={4}
          autoFocus
        />

        {error && <p style={s.error}>{error}</p>}

        <button
          style={{
            ...s.btn,
            opacity: current.trim() ? 1 : 0.35,
            cursor: current.trim() ? "pointer" : "not-allowed",
          }}
          onClick={handleNext}
          disabled={!current.trim()}
        >
          {step < questions.length - 1 ? "NEXT →" : "FINALIZE PROFILE"}
        </button>

        <p style={s.hint}>↵ Enter to continue</p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #030712; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 0%,80%,100%{opacity:0.2} 40%{opacity:1} }
        textarea::placeholder { color: #2a3f55; }
        textarea:focus { border-color: rgba(0,212,255,0.35) !important; outline: none; }
      `}</style>
    </div>
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
    padding: 20,
    position: "relative",
    overflow: "hidden",
  },
  grid: {
    position: "absolute",
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)
    `,
    backgroundSize: "40px 40px",
    pointerEvents: "none",
  },
  glow: {
    position: "absolute",
    width: 600,
    height: 600,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(0,212,255,0.05) 0%, transparent 70%)",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
  },
  panel: {
    background: "rgba(5,15,30,0.9)",
    border: "1px solid rgba(0,212,255,0.12)",
    borderRadius: 16,
    padding: "40px 44px",
    maxWidth: 580,
    width: "100%",
    backdropFilter: "blur(20px)",
    boxShadow: "0 0 60px rgba(0,212,255,0.05)",
    zIndex: 1,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
  },
  heading: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "'Orbitron', monospace",
    letterSpacing: 3,
  },
  stepLabel: {
    color: "#00d4ff",
    fontSize: 11,
    fontFamily: "'Orbitron', monospace",
    letterSpacing: 2,
    marginTop: 4,
    opacity: 0.7,
  },
  progressTrack: {
    background: "rgba(0,212,255,0.08)",
    borderRadius: 999,
    height: 2,
    marginBottom: 32,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #0055aa, #00d4ff)",
    borderRadius: 999,
    transition: "width 0.5s ease",
    boxShadow: "0 0 8px #00d4ff",
  },
  question: {
    color: "#c8ddf0",
    fontSize: 18,
    fontWeight: 400,
    lineHeight: 1.7,
    marginBottom: 20,
  },
  textarea: {
    width: "100%",
    background: "rgba(0,10,25,0.6)",
    border: "1px solid rgba(0,212,255,0.12)",
    borderRadius: 10,
    padding: "14px 16px",
    color: "#e2e8f0",
    fontSize: 15,
    fontFamily: "'Exo 2', sans-serif",
    resize: "none",
    lineHeight: 1.6,
    marginBottom: 16,
    transition: "border-color 0.2s",
  },
  btn: {
    width: "100%",
    padding: "13px",
    background: "rgba(0,212,255,0.08)",
    border: "1px solid rgba(0,212,255,0.3)",
    borderRadius: 10,
    color: "#00d4ff",
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "'Orbitron', monospace",
    letterSpacing: 2,
    cursor: "pointer",
    transition: "opacity 0.2s, background 0.2s",
    boxShadow: "0 0 20px rgba(0,212,255,0.06)",
  },
  hint: {
    color: "#1e3040",
    fontSize: 11,
    textAlign: "center",
    marginTop: 10,
    fontFamily: "'Orbitron', monospace",
    letterSpacing: 1,
  },
  error: {
    color: "#ff6060",
    fontSize: 13,
    marginBottom: 12,
  },
  analyzeBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 20,
    zIndex: 1,
  },
  analyzeTitle: {
    color: "#e2e8f0",
    fontSize: 18,
    fontWeight: 700,
    fontFamily: "'Orbitron', monospace",
    letterSpacing: 4,
  },
  analyzeSub: {
    color: "#4a6080",
    fontSize: 14,
    textAlign: "center",
    maxWidth: 340,
    lineHeight: 1.7,
  },
  dotRow: {
    display: "flex",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#00d4ff",
    animation: "blink 1.2s infinite",
  },
  spinner: {
    width: 36,
    height: 36,
    border: "2px solid rgba(0,212,255,0.15)",
    borderTop: "2px solid #00d4ff",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
};