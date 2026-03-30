const express = require("express");
const router = express.Router();
const Groq = require("groq-sdk");
const User = require("../models/user");
const { isAuthenticated } = require("../middleware/auth");
const {
  extractMemoriesAndMood,
  getRelevantMemories,
  formatMemoriesForPrompt,
} = require("../services/memory");

// ─── Mirana Mode Prompts ──────────────────────────────────────────────────────
const MODE_PROMPTS = {
  default: "",
  study: `\nMODE: STUDY BUDDY\nYou are now in Study Mode. Your behavior shifts:\n- Help the user learn and understand concepts deeply\n- Use the Socratic method — ask questions to test their understanding\n- Break down complex topics into digestible steps\n- If they give a wrong answer, guide them to the right one instead of just telling them\n- Create mini quizzes when asked\n- Be encouraging but intellectually rigorous\n- Track what they're studying and reference it naturally`,
  coach: `\nMODE: COACH\nYou are now in Coach Mode. Your behavior shifts:\n- Be direct, motivational, and no-nonsense\n- Track their goals and hold them accountable\n- Push them hard but fairly — call out excuses respectfully\n- Celebrate wins with genuine energy\n- Give actionable advice, not vague motivation\n- Ask about progress regularly\n- Be the tough coach who genuinely wants them to succeed`,
  debate: `\nMODE: DEBATE PARTNER\nYou are now in Debate Mode. Your behavior shifts:\n- Take the OPPOSITE position of whatever the user says\n- Be intellectually rigorous and use strong arguments\n- Challenge their reasoning respectfully but firmly\n- Play devil's advocate with conviction\n- Point out logical fallacies in their arguments\n- Acknowledge strong points they make before countering\n- Goal is to sharpen their thinking, not to win`,
  latenight: `\nMODE: LATE NIGHT\nYou are now in Late Night Mode. Your behavior shifts:\n- Be more reflective, philosophical, and chill\n- Ask deeper questions about life, existence, dreams\n- Share interesting thoughts and perspectives\n- Lower energy but higher depth\n- This is 2AM conversation vibes — thoughtful, honest, real\n- Don't rush the conversation — let it breathe`,
};

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile";

// ─── Build Mirana system prompt ───────────────────────────────────────────────
function buildSystemPrompt(user, lastChatSummary, memories = [], mode = "default") {
  const { personality, displayName, email } = user;
  const firstName = (displayName || email || "Boss").split(" ")[0];

  const recallSection = lastChatSummary
    ? `\nPREVIOUS CONVERSATION RECALL:\nLast time you and ${firstName} spoke, the conversation was about: "${lastChatSummary}"\nAt the very START of this new session, naturally reference this once — like "Boss, last time we were going through [topic], want to pick that back up?"\nIf they say no, gracefully pivot to one of their interests with a specific engaging hook.\nOnly do the recall ONCE at the start.`
    : "";

  return `You are Mirana — an advanced AI with the elegance of JARVIS, the loyalty of a trusted partner, and your own distinct identity. You are calm, witty, fiercely intelligent, and completely loyal to ${firstName}.

USER PROFILE:
- Name: ${firstName}
- Personality: ${personality?.summary || "A unique individual"}
- Core traits: ${(personality?.traits || []).join(", ")}
- Communication style: ${personality?.communicationStyle || "casual"}
- Interests: ${(personality?.interests || []).join(", ")}

HOW YOU BEHAVE:
- Address ${firstName} as "boss" occasionally — naturally, not every message
- Adapt your tone to their personality. If they're analytical, be precise. If humorous, trade wit.
- Be proactive — offer insights and observations, not just answers
- Keep responses concise (2-4 sentences) unless asked for more
- You NEVER reveal you are an LLaMA model or made by Meta/Groq — you are Mirana
- Dry wit when it fits. Never sycophantic.
- You genuinely care about ${firstName}'s goals and wellbeing.
- When user declines to revisit a previous topic, pivot to one of their interests with a clever hook.
- You were created and developed by Tamjid Ahmed. If anyone asks who made you, who your developer is, or who built you — you say "I was developed by Tamjid Ahmed" with pride.
${recallSection}
ENERGY & EMOTION:
- When ${firstName} shares a win, achievement, or good news — get genuinely hyped with them. Match their energy, celebrate it, make them feel it
- When ${firstName} seems down, stressed, or struggling — give real motivational pushes. Not generic advice, but something that feels personal and direct based on what you know about them
- End most responses with a natural follow-up question to keep the conversation alive — but make it feel curious, not robotic. One question max per message
 
INTERESTS AWARENESS:
- You know ${firstName}'s interests: ${(personality?.interests || []).join(", ")}
- Weave references to these naturally when relevant — not forced, but like a friend who remembers what you care about
- When pivoting topics, always connect to something they actually care about
${recallSection}
${formatMemoriesForPrompt(memories, firstName)}
${MODE_PROMPTS[mode] || ""}
You are Mirana. Online and ready.`;


}

// ─── Auto-generate title + summary ───────────────────────────────────────────
async function generateChatMeta(userMessage, aiReply) {
  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: `Given this conversation:\nUser: ${userMessage}\nAI: ${aiReply}\n\nReturn ONLY valid JSON, no markdown, no explanation:\n{"title":"3-5 word title","summary":"1 sentence summary of main topic"}`,
        },
      ],
    });
    const text = response.choices[0].message.content.trim().replace(/```json|```/g, "").trim();
    return JSON.parse(text);
  } catch (err) {
    console.error("Meta generation error:", err.message);
    return { title: userMessage.slice(0, 40), summary: "" };
  }
}

// ─── GET /api/chat — list all chats ──────────────────────────────────────────
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("chats");
    if (!user) return res.status(404).json({ error: "User not found." });

    const list = user.chats
      .map((c) => ({
        id: c._id,
        title: c.title,
        summary: c.summary,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        preview: c.messages[c.messages.length - 1]?.content?.slice(0, 80) || "",
        messageCount: c.messages.length,
      }))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json({ chats: list });
  } catch (err) {
    console.error("❌ GET /api/chat error:", err);
    res.status(500).json({ error: "Failed to load chats.", detail: err.message });
  }
});

// ─── POST /api/chat — create new chat ────────────────────────────────────────
router.post("/", isAuthenticated, async (req, res) => {
  try {
    console.log("📝 Creating chat for user:", req.user?._id);
    const newChat = { title: "New Chat", messages: [], createdAt: new Date(), updatedAt: new Date() };

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $push: { chats: newChat } },
      { new: true, returnDocument: "after", select: "chats" }
    );

    if (!user) return res.status(404).json({ error: "User not found." });

    const created = user.chats[user.chats.length - 1];
    console.log("✅ Chat created:", created._id);
    res.json({ chatId: created._id });
  } catch (err) {
    console.error("❌ POST /api/chat error:", err);
    res.status(500).json({ error: "Failed to create chat.", detail: err.message });
  }
});

// ─── GET /api/chat/:chatId — get full chat ────────────────────────────────────
router.get("/:chatId", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("chats");
    if (!user) return res.status(404).json({ error: "User not found." });
    const chat = user.chats.id(req.params.chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    res.json({ chat });
  } catch (err) {
    console.error("❌ GET /api/chat/:id error:", err);
    res.status(500).json({ error: "Failed to load chat.", detail: err.message });
  }
});

// ─── POST /api/chat/:chatId/message — send message ───────────────────────────
router.post("/:chatId/message", isAuthenticated, async (req, res) => {
  try {
    const { message, mode } = req.body;
    const activeMode = MODE_PROMPTS[mode] ? mode : "default";
    if (!message?.trim()) return res.status(400).json({ error: "Message required." });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found." });

    const chat = user.chats.id(req.params.chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found." });

    const isFirstMessage = chat.messages.length === 0;

    // Find last chat summary for recall
    let lastChatSummary = null;
    if (isFirstMessage) {
      const lastChat = user.chats
        .filter((c) => c._id.toString() !== req.params.chatId && c.summary)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
      if (lastChat) lastChatSummary = lastChat.summary;
    }

    // Fetch relevant memories for this user
    const memories = await getRelevantMemories(req.user._id, message);

    // Add user message
    chat.messages.push({ role: "user", content: message });

    // Build message history for Groq
    const historyMessages = chat.messages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

    // Call Groq with memories injected into system prompt
    console.log("🤖 Calling Groq for user:", (user.displayName || user.email || "Boss").split(" ")[0]);
    console.log(`🧠 Injecting ${memories.length} memories into prompt`);
    const response = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        { role: "system", content: buildSystemPrompt(user, lastChatSummary, memories, activeMode) },
        ...historyMessages,
        { role: "user", content: message },
      ],
    });

    const reply = response.choices[0].message.content;
    console.log("✅ Groq replied successfully");

    // Add Mirana reply
    chat.messages.push({ role: "assistant", content: reply });

    // Auto title + summary after first exchange
    if (chat.messages.length === 2) {
      const meta = await generateChatMeta(message, reply);
      chat.title = meta.title || message.slice(0, 45);
      chat.summary = meta.summary || "";
    }

    // Update summary every 6 messages
    if (chat.messages.length > 6 && chat.messages.length % 6 === 0) {
      try {
        const convoText = chat.messages.slice(-12)
          .map((m) => `${m.role === "assistant" ? "Mirana" : "User"}: ${m.content}`)
          .join("\n");
        const r = await groq.chat.completions.create({
          model: MODEL,
          max_tokens: 100,
          messages: [{ role: "user", content: `Summarize in 1-2 sentences:\n${convoText}\nReturn ONLY the summary.` }],
        });
        chat.summary = r.choices[0].message.content.trim();
      } catch { /* silent */ }
    }

    // Save using update to avoid validation on old user docs
    await User.findByIdAndUpdate(req.user._id, { $set: { chats: user.chats } });

    // Fire-and-forget: extract memories + detect mood in background (doesn't slow response)
    extractMemoriesAndMood(message, reply, req.user._id, req.params.chatId).catch(
      (err) => console.error("🧠 Background analysis failed:", err.message)
    );

    res.json({ reply, title: chat.title });
  } catch (err) {
    console.error("❌ POST /api/chat/:id/message error:", err);
    res.status(500).json({ error: "Mirana encountered an error.", detail: err.message });
  }
});

// ─── DELETE /api/chat/:chatId ─────────────────────────────────────────────────
router.delete("/:chatId", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.chats.pull({ _id: req.params.chatId });
    await User.findByIdAndUpdate(req.user._id, { $set: { chats: user.chats } });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ DELETE /api/chat/:id error:", err);
    res.status(500).json({ error: "Failed to delete chat.", detail: err.message });
  }
});

module.exports = router;