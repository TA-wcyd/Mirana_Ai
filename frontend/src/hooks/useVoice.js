import { useState, useRef, useCallback, useEffect } from "react";

function stripMarkdown(text) {
  if (!text) return "";
  return text
    .replace(/[*_~`]/g, '') // Remove formatting characters
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Extract text from links
    .replace(/#/g, ''); // Remove header hashes
}

// Female voice priority list across OS/browsers
const FEMALE_VOICE_NAMES = [
  "Google UK English Female",
  "Microsoft Aria Online (Natural)",
  "Microsoft Zira Desktop",
  "Samantha",
  "Karen",
  "Moira",
  "Veena",
  "Fiona",
  "Victoria",
  "Tessa",
];

function getBestFemaleVoice(voices) {
  // Try exact name matches first
  for (const name of FEMALE_VOICE_NAMES) {
    const found = voices.find((v) => v.name.includes(name));
    if (found) return found;
  }
  // Fallback: any English voice with "female" in name
  const byGender = voices.find(
    (v) => v.lang.startsWith("en") && v.name.toLowerCase().includes("female")
  );
  if (byGender) return byGender;
  // Fallback: any English voice
  return voices.find((v) => v.lang.startsWith("en")) || voices[0];
}

// Voices load async — this resolves when ready
function loadVoices() {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) return resolve(voices);
    window.speechSynthesis.onvoiceschanged = () => {
      resolve(window.speechSynthesis.getVoices());
    };
  });
}

export function useVoice() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [muted, setMuted] = useState(false);
  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);

  // Preload voices on mount
  useEffect(() => {
    if (window.speechSynthesis) loadVoices();
  }, []);

  const speak = useCallback(
    async (text) => {
      if (!window.speechSynthesis || muted) return;

      // Cancel any current speech
      window.speechSynthesis.cancel();

      const voices = await loadVoices();
      const voice = getBestFemaleVoice(voices);

      const cleanText = stripMarkdown(text);
      const utterance = new SpeechSynthesisUtterance(cleanText);
      if (voice) utterance.voice = voice;
      utterance.rate = 1.0;
      utterance.pitch = 1.05;
      utterance.volume = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [muted]
  );

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  const toggleMute = useCallback(() => {
    if (!muted) window.speechSynthesis?.cancel();
    setMuted((prev) => !prev);
    setIsSpeaking(false);
  }, [muted]);

  const silenceTimerRef = useRef(null);
  const accumulatedTranscriptRef = useRef("");
  const isManuallyStoppedRef = useRef(false);
  const onResultRef = useRef(null);
  const onErrorRef = useRef(null);
  const onInterimRef = useRef(null);

  const finalizeAndSend = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    const text = accumulatedTranscriptRef.current?.trim();
    accumulatedTranscriptRef.current = "";
    setIsListening(false);
    try {
      recognitionRef.current?.stop();
    } catch (_) {}

    if (!isManuallyStoppedRef.current && text) {
      onResultRef.current?.(text);
    }
  }, []);

  const startListening = useCallback((onResult, onError, onInterim) => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition ||
      window.mozSpeechRecognition ||
      window.msSpeechRecognition;

    if (!SpeechRecognition) {
      onError?.(
        window.isSecureContext === false
          ? "Speech recognition requires HTTPS or localhost."
          : "Speech recognition is not supported in this browser."
      );
      return;
    }

    // Stop speaking when user starts talking
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);

    // Cancel any existing timer & reset state
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    accumulatedTranscriptRef.current = "";
    isManuallyStoppedRef.current = false;
    onResultRef.current = onResult;
    onErrorRef.current = onError;
    onInterimRef.current = onInterim;

    try {
      const recognition = new SpeechRecognition();
      const isMobile =
        typeof navigator !== "undefined" &&
        /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );

      // Mobile browsers (especially iOS Safari & Chrome Android) require continuous=false
      // for stable speech capture without aborting or dropping events.
      recognition.continuous = !isMobile;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (e) => {
        let combined = "";
        for (let i = 0; i < e.results.length; i++) {
          const item = e.results[i];
          if (item && item[0]) {
            combined += item[0].transcript + " ";
          }
        }
        const text = combined.trim();
        if (text) {
          accumulatedTranscriptRef.current = text;
          onInterimRef.current?.(text);
        }

        // Reset the 3-second countdown every time new speech is detected
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          finalizeAndSend();
        }, 3000);
      };

      recognition.onerror = (e) => {
        console.warn("Speech recognition error:", e.error);
        // "no-speech" happens frequently if user pauses before speaking — don't abort if text already recorded
        if (e.error === "no-speech") {
          return;
        }
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
        setIsListening(false);
        onErrorRef.current?.(e.error);
      };

      recognition.onend = () => {
        // If stopped manually by user clicking the mic button
        if (isManuallyStoppedRef.current) {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
          accumulatedTranscriptRef.current = "";
          setIsListening(false);
          return;
        }

        // On mobile, the recognizer often finishes on pause before the 3s timer expires.
        // DO NOT cancel the silence timer! It will fire when 3s finishes and send the input.
        if (silenceTimerRef.current) {
          return;
        }

        // If recognizer ended and we have a transcript but timer wasn't running, start 3s timer
        if (accumulatedTranscriptRef.current?.trim()) {
          silenceTimerRef.current = setTimeout(() => {
            finalizeAndSend();
          }, 3000);
          return;
        }

        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setIsListening(false);
      onError?.(err?.message || "Failed to start microphone.");
    }
  }, [finalizeAndSend]);

  const stopListening = useCallback(() => {
    isManuallyStoppedRef.current = true;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    accumulatedTranscriptRef.current = "";
    try {
      recognitionRef.current?.stop();
    } catch (_) {}
    setIsListening(false);
  }, []);

  return {
    speak,
    stopSpeaking,
    isSpeaking,
    startListening,
    stopListening,
    isListening,
    muted,
    toggleMute,
  };
}