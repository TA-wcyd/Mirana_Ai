const express = require("express");
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const User = require("../models/User");
const { isAuthenticated } = require("../middleware/auth");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(
      `You are a personality analyst. Based on these answers, analyze this person.

${qaText}

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "summary": "2-3 sentence personality summary",
  "traits": ["trait1", "trait2", "trait3", "trait4", "trait5"],
  "communicationStyle": "one of: casual, formal, humorous, blunt, warm, analytical",
  "interests": ["interest1", "interest2", "interest3", "interest4"]
}`
    );

    const rawText = result.response.text().trim();
    let personality = {};

    try {
      personality = JSON.parse(rawText.replace(/```json|```/g, "").trim());
    } catch {
      personality = {
        summary: "A unique individual with their own perspective on the world.",
        traits: ["curious", "thoughtful"],
        communicationStyle: "casual",
        interests: ["life", "growth", "learning"],
      };
    }

    await User.findByIdAndUpdate(req.user._id, {
      personalityAnswers: answers,
      personality: { ...personality, raw: rawText },
      onboardingComplete: true,
    });

    res.json({ success: true, personality });
  } catch (err) {
    console.error("Onboarding error:", err);
    res.status(500).json({ error: "Failed to analyze personality." });
  }
});

module.exports = router;