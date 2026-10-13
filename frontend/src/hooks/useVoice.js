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

  const startListening = useCallback((onResult, onError) => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onError?.("Speech recognition not supported in this browser.");
      return;
    }

    // Stop speaking when user starts talking
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);

    // Reset accumulated transcript
    accumulatedTranscriptRef.current = "";

    const recognition = new SpeechRecognition();
    // continuous + interimResults lets us keep listening across natural pauses
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (e) => {
      // Build the full transcript from all final results so far
      let finalText = "";
      let hasNewFinal = false;
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalText += e.results[i][0].transcript + " ";
          hasNewFinal = true;
        }
      }

      if (hasNewFinal) {
        accumulatedTranscriptRef.current = finalText.trim();
      }

      // Reset the 3-second silence timer every time speech is detected
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        const transcript = accumulatedTranscriptRef.current;
        recognition.stop();
        setIsListening(false);
        if (transcript) onResult(transcript);
      }, 3000);
    };

    recognition.onerror = (e) => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      setIsListening(false);
      // Ignore "no-speech" — user just didn't say anything
      if (e.error !== "no-speech") onError?.(e.error);
    };

    recognition.onend = () => {
      // onend fires when stop() is called — clean up
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    recognitionRef.current?.stop();
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