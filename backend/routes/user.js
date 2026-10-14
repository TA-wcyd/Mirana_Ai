const express = require("express");
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");
const User = require("../models/User");
const { isAuthenticated } = require("../middleware/auth");

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;
const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const QUESTIONS = [
  { id: "morning",   question: "What's the first thing you do when you wake up?" },
  { id: "problem",   question: "When you hit a tough problem, what's your go-to move?" },
  { id: "social",    question: "How do you recharge — big social settings or alone time?" },
  { id: "passion",   question: "What could you talk about for hours without getting bored?" },
  { id: "flaw",      question: "Name one personal flaw you've made peace with." },
  { id: "decision",  question: "Gut instinct or full research before deciding?" },
  { id: "goal",      question: "What's the one thing you really want in the next 5 years?" },
  { id: "humor",     question: "Describe your sense of humor in one sentence." },
  { id: "stress",    question: "When things go wrong — shut down, talk it out, or go hard?" },
  { id: "worldview", question: "Sum up how you see the world in one line." },
];

// Helper to analyze answers using Groq first, then Gemini, with graceful fallback
async function analyzePersonalityAnswers(qaText, answers) {
  const prompt = `You are a personality analyst. Based on these answers, analyze this person.

${qaText}

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "summary": "2-3 sentence personality summary",
  "traits": ["trait1", "trait2", "trait3", "trait4", "trait5"],
  "communicationStyle": "one of: casual, formal, humorous, blunt, warm, analytical",
  "interests": ["interest1", "interest2", "interest3", "interest4"]
}`;

  // 1. Try Groq (fast, reliable)
  if (groq) {
    try {
      const completion = await groq.chat.completions.create({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are an expert personality psychologist. Output valid JSON only." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
      });
      const content = completion.choices[0]?.message?.content?.trim();
      if (content) {
        const parsed = JSON.parse(content);
        if (parsed.summary && parsed.traits) {
          return { personality: parsed, raw: content };
        }
      }
    } catch (groqErr) {
      console.warn("Groq personality analysis failed, trying Gemini:", groqErr.message);
    }
  }

  // 2. Try Gemini
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(prompt);
      const rawText = result.response.text().trim();
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.summary && parsed.traits) {
        return { personality: parsed, raw: rawText };
      }
    } catch (geminiErr) {
      console.warn("Gemini personality analysis failed:", geminiErr.message);
    }
  }

  // 3. Fallback personality derived gracefully from answers so onboarding never fails
  const passion = answers?.passion || "growth and learning";
  return {
    personality: {
      summary: `A motivated and insightful individual passionate about ${passion}, balancing practical problem-solving with a distinct personal worldview.`,
      traits: ["curious", "thoughtful", "adaptable", "determined", "open-minded"],
      communicationStyle: "casual",
      interests: [passion, "personal growth", "technology", "exploration"],
    },
    raw: "Fallback generated profile based on provided questionnaire responses.",
  };
}

// GET /api/user/onboarding-questions
router.get("/onboarding-questions", isAuthenticated, (req, res) => {
  res.json({ questions: QUESTIONS });
});

// POST /api/user/onboarding
router.post("/onboarding", isAuthenticated, async (req, res) => {
  try {
    const { answers } = req.body;
    if (!answers || Object.keys(answers).length < QUESTIONS.length) {
      return res.status(400).json({ error: "Please answer all questions." });
    }

    const qaText = QUESTIONS.map(
      (q) => `Q: ${q.question}\nA: ${answers[q.id] || "No answer"}`
    ).join("\n\n");

    const { personality, raw } = await analyzePersonalityAnswers(qaText, answers);

    await User.findByIdAndUpdate(req.user._id, {
      personalityAnswers: answers,
      personality: { ...personality, raw },
      onboardingComplete: true,
    });

    res.json({ success: true, personality });
  } catch (err) {
    console.error("Onboarding error:", err);
    res.status(500).json({ error: "Failed to save profile. Please try again." });
  }
});

module.exports = router;