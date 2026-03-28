import { useEffect, useRef } from "react";

export default function MiranaOrb({ isSpeaking, isListening, size = 100 }) {
  const state = isListening ? "listening" : isSpeaking ? "speaking" : "idle";

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {/* Outermost ambient glow */}
      <div
        style={{
          position: "absolute",
          width: "140%",
          height: "140%",
          borderRadius: "50%",
          background:
            state === "speaking"
              ? "radial-gradient(circle, rgba(0,212,255,0.12) 0%, transparent 70%)"
              : state === "listening"
              ? "radial-gradient(circle, rgba(255,80,80,0.1) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(0,212,255,0.05) 0%, transparent 70%)",
          animation:
            state === "speaking"
              ? "orbGlowFast 0.6s ease-in-out infinite alternate"
              : "orbGlowSlow 3s ease-in-out infinite alternate",
          transition: "background 0.4s",
        }}
      />

      {/* Outer rotating ring */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          border: `1px solid rgba(0,212,255,${state === "idle" ? "0.2" : "0.5"})`,
          borderTop: `2px solid ${state === "listening" ? "#ff5050" : "#00d4ff"}`,
          animation: `spinCW ${state === "speaking" ? "1s" : "4s"} linear infinite`,
          transition: "border-color 0.4s, animation-duration 0.4s",
        }}
      />

      {/* Middle counter-rotating ring */}
      <div
        style={{
          position: "absolute",
          width: "78%",
          height: "78%",
          borderRadius: "50%",
          border: `1px solid rgba(0,212,255,${state === "idle" ? "0.15" : "0.4"})`,
          borderRight: `1.5px solid ${state === "listening" ? "#ff5050" : "#00d4ff"}`,
          animation: `spinCCW ${state === "speaking" ? "1.5s" : "3s"} linear infinite`,
          transition: "border-color 0.4s",
        }}
      />

      {/* Inner ring */}
      <div
        style={{
          position: "absolute",
          width: "58%",
          height: "58%",
          borderRadius: "50%",
          border: `1px dashed rgba(0,212,255,${state === "idle" ? "0.1" : "0.3"})`,
          animation: `spinCW ${state === "speaking" ? "0.8s" : "8s"} linear infinite`,
        }}
      />

      {/* Core sphere */}
      <div
        style={{
          width: "44%",
          height: "44%",
          borderRadius: "50%",
          background:
            state === "listening"
              ? "radial-gradient(circle at 35% 35%, #ff8080, #cc0000)"
              : "radial-gradient(circle at 35% 35%, #60e8ff, #0055aa)",
          boxShadow:
            state === "speaking"
              ? "0 0 20px #00d4ff, 0 0 40px rgba(0,212,255,0.6), 0 0 80px rgba(0,212,255,0.3), inset 0 0 20px rgba(255,255,255,0.2)"
              : state === "listening"
              ? "0 0 15px #ff5050, 0 0 30px rgba(255,80,80,0.5)"
              : "0 0 10px #00d4ff, 0 0 20px rgba(0,212,255,0.3)",
          animation:
            state === "speaking"
              ? "pulseFast 0.5s ease-in-out infinite alternate"
              : "pulseSlow 3s ease-in-out infinite alternate",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.9)",
          fontSize: size * 0.13,
          fontWeight: 800,
          fontFamily: "'Orbitron', monospace",
          letterSpacing: 1,
          transition: "background 0.4s, box-shadow 0.4s",
        }}
      >
        M
      </div>

      <style>{`
        @keyframes spinCW    { to { transform: rotate(360deg); } }
        @keyframes spinCCW   { to { transform: rotate(-360deg); } }
        @keyframes pulseSlow { from { transform: scale(0.94); opacity: 0.85; } to { transform: scale(1.06); opacity: 1; } }
        @keyframes pulseFast { from { transform: scale(0.96); opacity: 0.9; } to { transform: scale(1.1); opacity: 1; } }
        @keyframes orbGlowSlow { from { opacity: 0.6; transform: scale(0.95); } to { opacity: 1; transform: scale(1.05); } }
        @keyframes orbGlowFast { from { opacity: 0.8; transform: scale(0.98); } to { opacity: 1; transform: scale(1.1); } }
      `}</style>
    </div>
  );
}