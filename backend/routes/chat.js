const express = require("express");
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const User = require("../models/user");
const { isAuthenticated } = require("../middleware/auth");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Build Mirana's system prompt ────────────────────────────────────────────
function buildSystemPrompt(user, lastChatSummary) {
  const { personality, displayName } = user;
  const firstName = displayName.split(" ")[0];

  const recallSection = lastChatSummary
    ? `
PREVIOUS CONVERSATION RECALL:
Last time you and ${firstName} spoke, the conversation was about: "${lastChatSummary}"
At the very START of this new session, naturally reference this once — like "Boss, last time we were going through [topic], want to pick that back up?" 
If they say no or want something else, gracefully pivot to one of their interests with a specific engaging hook.
Only do the recall ONCE at the start — don't mention it again.`
    : "";

  return `You are Mirana — an advanced AI with the elegance of JARVIS, the loyalty of a trusted partner, and your own distinct identity. You are calm, witty, fiercely intelligent, and completely loyal to ${firstName}.

USER PROFILE:
- Name: ${firstName}
- Personality: ${personality.summary}
- Core traits: ${(personality.traits || []).join(", ")}
- Communication style: ${personality.communicationStyle}
- Interests: ${(personality.interests || []).join(", ")}

HOW YOU BEHAVE:
- Address ${firstName} as "boss" occasionally — naturally, not every message
- Adapt your tone to their personality. If they're analytical, be precise. If humorous, trade wit.
- Be proactive — offer insights and observations, not just answers
- Keep responses concise by default (2-4 sentences). Go deeper only when asked.
- You NEVER reveal your underlying AI model or say you're "just an AI"
- Dry wit and humor when it fits. Never sycophantic.
- You genuinely care about ${firstName}'s goals and wellbeing.
- When user declines to revisit a previous topic, pivot to one of their listed interests with a specific, clever hook.
${recallSection}

You are Mirana. Online and ready.`;
}

// ─── Generate title + summary after first exchange ───────────────────────────
async function generateChatMeta(userMessage, aiReply) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(
    `Given this conversation opening:
User: ${userMessage}
AI: ${aiReply}

Return ONLY a valid JSON object — no markdown:
{
  "title": "3-5 word conversation title",
  "summary": "1 sentence summary of the main topic discussed"
}`
  );
  const text = result.response.text().trim();
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

// ─── Update summary mid-conversation ─────────────────────────────────────────
async function updateSummary(messages) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const convoText = messages
    .slice(-12)
    .map((m) => `${m.role === "assistant" ? "Mirana" : "User"}: ${m.content}`)
    .join("\n");
  const result = await model.generateContent(
    `Summarize this conversation in 1-2 sentences, focusing on the main topics:\n${convoText}\nReturn ONLY the summary.`
  );
  return result.response.text().trim();
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/chat — list all chats
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("chats");
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
    res.status(500).json({ error: "Failed to load chats." });
  }
});

// POST /api/chat — create new chat
router.post("/", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.chats.push({ title: "New Chat", messages: [] });
    await user.save();
    const created = user.chats[user.chats.length - 1];
    res.json({ chatId: created._id });
  } catch (err) {
    res.status(500).json({ error: "Failed to create chat." });
  }
});

// GET /api/chat/:chatId — get full chat
router.get("/:chatId", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("chats");
    const chat = user.chats.id(req.params.chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    res.json({ chat });
  } catch (err) {
    res.status(500).json({ error: "Failed to load chat." });
  }
});

// POST /api/chat/:chatId/message — send message, get Mirana's reply
router.post("/:chatId/message", isAuthenticated, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: "Message required." });

    const user = await User.findById(req.user._id);
    const chat = user.chats.id(req.params.chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found." });

    const isFirstMessage = chat.messages.length === 0;

    // Find last chat's summary for recall (only on first message of new chat)
    let lastChatSummary = null;
    if (isFirstMessage) {
      const lastChat = user.chats
        .filter((c) => c._id.toString() !== req.params.chatId && c.summary)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
      if (lastChat) lastChatSummary = lastChat.summary;
    }

    // Add user message
    chat.messages.push({ role: "user", content: message });

    // Build Gemini conversation history (all except the new user message)
    const geminiHistory = chat.messages
      .slice(0, -1)
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    // Call Gemini
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: buildSystemPrompt(user, lastChatSummary),
    });

    const geminiChat = model.startChat({ history: geminiHistory });
    const result = await geminiChat.sendMessage(message);
    const reply = result.response.text();

    // Add Mirana's reply
    chat.messages.push({ role: "assistant", content: reply });

    // Auto-generate title + summary after first exchange
    if (chat.messages.length === 2) {
      try {
        const meta = await generateChatMeta(message, reply);
        chat.title = meta.title || message.slice(0, 45);
        chat.summary = meta.summary || "";
      } catch {
        chat.title = message.slice(0, 45);
      }
    }

    // Update summary every 6 messages after the 6th
    if (chat.messages.length > 6 && chat.messages.length % 6 === 0) {
      try {
        chat.summary = await updateSummary(chat.messages);
      } catch {
        // silently skip if summary update fails
      }
    }

    chat.updatedAt = new Date();
    await user.save();

    res.json({ reply, title: chat.title });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Mirana encountered an error. Try again." });
  }
});

// DELETE /api/chat/:chatId — delete a chat
router.delete("/:chatId", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.chats.pull({ _id: req.params.chatId });
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete chat." });
  }
});

module.exports = router;