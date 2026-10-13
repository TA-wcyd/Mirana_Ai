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

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (e) => {
      setIsListening(false);
      onError?.(e.error);
    };
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      onResult(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
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