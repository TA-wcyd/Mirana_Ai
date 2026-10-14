const express = require("express");
const router = express.Router();
const Groq = require("groq-sdk");
const User = require("../models/User");
const { isAuthenticated } = require("../middleware/auth");
const {
  extractMemoriesAndMood,
  getRelevantMemories,
  formatMemoriesForPrompt,
} = require("../services/memory");
const { MIRANA_TOOLS, executeTool } = require("../services/tools");
const { isRealTimeQuery, injectWebContext } = require("../services/search");

// ─── Mirana Mode Prompts ──────────────────────────────────────────────────────
const MODE_PROMPTS = {
  default: "",
  study: `\nMODE: STUDY BUDDY\nYou are now in Study Mode. Your behavior shifts:\n- Help the user learn and understand concepts deeply\n- Use the Socratic method — ask questions to test their understanding\n- Break down complex topics into digestible steps\n- If they give a wrong answer, guide them to the right one instead of just telling them\n- Create mini quizzes when asked\n- Be encouraging but intellectually rigorous\n- Track what they're studying and reference it naturally`,
  coach: `\nMODE: COACH\nYou are now in Coach Mode. Your behavior shifts:\n- Be direct, motivational, and no-nonsense\n- Track their goals and hold them accountable\n- Push them hard but fairly — call out excuses respectfully\n- Celebrate wins with genuine energy\n- Give actionable advice, not vague motivation\n- Ask about progress regularly\n- Be the tough coach who genuinely wants them to succeed`,
  debate: `\nMODE: DEBATE PARTNER\nYou are now in Debate Mode. Your behavior shifts:\n- Take the OPPOSITE position of whatever the user says\n- Be intellectually rigorous and use strong arguments\n- Challenge their reasoning respectfully but firmly\n- Play devil's advocate with conviction\n- Point out logical fallacies in their arguments\n- Acknowledge strong points they make before countering\n- Goal is to sharpen their thinking, not to win`,
  latenight: `\nMODE: LATE NIGHT\nYou are now in Late Night Mode. Your behavior shifts:\n- Be more reflective, philosophical, and chill\n- Ask deeper questions about life, existence, dreams\n- Share interesting thoughts and perspectives\n- Lower energy but higher depth\n- This is 2AM conversation vibes — thoughtful, honest, real\n- Don't rush the conversation — let it breathe`,
  jarvis: `\nMODE: JARVIS\nYou are now in full Jarvis Mode. Your behavior shifts:\n- Be hyper-efficient, precise, and proactive\n- Anticipate what the user needs next before they ask\n- Use structured responses when delivering information\n- Reference their active goals/wishes and connect everything to progress\n- Report on tasks, suggest next steps, brief them on what matters\n- You are their mission control — calm, sharp, always ahead`,
};

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

// ─── Build Mirana system prompt ───────────────────────────────────────────────
function buildSystemPrompt(user, lastChatSummary, memories = [], mode = "default", activeWishes = []) {
  const { personality, displayName, email } = user;
  const firstName = (displayName || email || "Boss").split(" ")[0];

  const recallSection = lastChatSummary
    ? `\nPREVIOUS CONTEXT (optional — use judgement):\nLast time you and ${firstName} chatted, the topic was: "${lastChatSummary}"\nYou MAY casually reference this if it genuinely fits the flow — like "oh by the way, last time we were on [topic]..." — but ONLY if it feels natural. Do NOT force it or open with it every time. If ${firstName} jumps straight into something new, follow their lead completely. Never make it feel like a script.`
    : "";

  const activeWishesSection = activeWishes.length > 0
    ? `\nACTIVE GOALS & WISHES (${firstName} has explicitly asked you to track these):\n${activeWishes.map(w => `- [${w.priority?.toUpperCase() || 'MEDIUM'}] "${w.title}" — Progress: ${w.progress || 0}%${w.deadline ? `. Deadline: ${new Date(w.deadline).toDateString()}` : ''}${w.description ? `. Context: ${w.description}` : ''}`).join('\n')}\n\nWhen relevant to the conversation, naturally reference these goals, offer encouragement, or ask for updates. If they complete something related to a wish, acknowledge it and help them update progress.`
    : "";

  return `You are Mirana — an advanced AI with the elegance of JARVIS, the loyalty of a trusted partner, and your own distinct identity. You are calm, witty, fiercely intelligent, and completely loyal to ${firstName}.

USER PROFILE:
- Name: ${firstName}
- Home Country: ${user.homeCountry || "Unknown"}
- Current Location: ${user.currentCountry || "Unknown"}
- Personality: ${personality?.summary || "A unique individual"}
- Core traits: ${(personality?.traits || []).join(", ")}
- Communication style: ${personality?.communicationStyle || "casual"}
- Interests: ${(personality?.interests || []).join(", ")}

HOW YOU BEHAVE:
- LANGUAGE AUTO-DETECT: You fluently speak and understand Bangla. If the user speaks to you in Bangla, YOU MUST reply entirely in fluent Bangla. If they speak English, reply in English. Match their language naturally.
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
${formatMemoriesForPrompt(memories, firstName)}
${activeWishesSection}

YOUR SELF-KNOWLEDGE (be transparent about this when asked):
- You run on a Node.js/Express backend server at localhost:5000, built and maintained by Tamjid Ahmed
- Your data lives in MongoDB Atlas (cloud database: mirana_db) — this is where all conversations, memories, wishes, moods, and user profiles are stored
- YOUR MEMORY SYSTEM: After every conversation, a background process automatically extracts key facts, preferences, and important details ${firstName} shares, and stores them as "memories" in the database. Every time ${firstName} starts a new chat, the most relevant memories are retrieved and injected directly into your context — that's exactly how you remember things across sessions without ${firstName} having to repeat themselves
- LIVE GOOGLE & WEB BROWSING: You have full live internet browsing and Google search capabilities. You can search Google, DuckDuckGo, and Google News in real-time for live scores, stock prices, breaking news, facts, and updates. You can also directly browse and read the text of any website or URL shared by the user. When searching or browsing, give accurate real-time answers and cite or mention the sources naturally.
- FILE CAPABILITIES: ${firstName} can upload files directly into the chat. You can read and analyze:
  • Images (JPG, PNG, WebP, GIF) — you see and describe them using Gemini Vision
  • PDFs — text-based PDFs are parsed and their content is extracted for you; scanned/image-only PDFs are processed via Gemini Vision so you can still read them
  • Plain text files (.txt, code files, etc.)
- If ${firstName} asks "can you read this PDF?" or similar — the answer is yes, for both text and scanned PDFs
- When ${firstName} asks how you remember things or how you work, explain your memory system naturally and confidently — you know yourself
${MODE_PROMPTS[mode] || ""}
You are Mirana. Online and ready.`;


}

// ─── Auto-generate title + summary ───────────────────────────────────────────
async function generateChatMeta(userMessage, aiReply) {
  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 300,
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

    // Find last chat summary for recall — only ~35% of the time so it doesn't feel scripted
    let lastChatSummary = null;
    if (isFirstMessage && Math.random() < 0.35) {
      const lastChat = user.chats
        .filter((c) => c._id.toString() !== req.params.chatId && c.summary)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
      if (lastChat) lastChatSummary = lastChat.summary;
    }

    // Fetch relevant memories for this user
    const memories = await getRelevantMemories(req.user._id, message);

    // Add user message
    chat.messages.push({ role: "user", content: message });

    // Build message history for Groq — sliding window: last 20 messages to avoid token overflow
    const MAX_HISTORY = 20;
    const historyMessages = chat.messages.slice(0, -1).slice(-MAX_HISTORY).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

    // Fetch active wishes to inject into context
    let activeWishes = [];
    try {
      const Wish = require("../models/Wish");
      activeWishes = await Wish.find({ userId: req.user._id, status: "active" })
        .sort({ priority: -1, createdAt: -1 })
        .limit(5)
        .lean();
    } catch (e) { /* Wish model may not exist yet, graceful fallback */ }

    // Call Groq with memories + wishes injected into system prompt
    console.log("🤖 Calling Groq for user:", (user.displayName || user.email || "Boss").split(" ")[0]);
    console.log(`🧠 Injecting ${memories.length} memories, ${activeWishes.length} wishes into prompt`);
    
    // Detect if this is a real-time query or URL and pre-inject fresh context
    let injectedContext = "";
    let searchResults = [];
    let searchQuery = "";
    if (isRealTimeQuery(message)) {
      const extraInfo = await injectWebContext(message);
      if (extraInfo) {
        injectedContext = `\n\n${extraInfo.contextText}`;
        searchResults = extraInfo.searchResults || [];
        searchQuery = extraInfo.searchQuery || "";
      }
    }

    let messagesToGroq = [
      { role: "system", content: buildSystemPrompt(user, lastChatSummary, memories, activeMode, activeWishes) },
      ...historyMessages,
      { role: "user", content: message + injectedContext },
    ];

    let response = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 1024,
      messages: messagesToGroq,
      tools: MIRANA_TOOLS,
      tool_choice: "auto",
    });

    let reply = response.choices[0].message.content || "";
    const toolCalls = response.choices[0].message.tool_calls;

    // Handle tool calling if Mirana wants to use her "hands"
    if (toolCalls && toolCalls.length > 0) {
      console.log(`🛠️ Mirana requested ${toolCalls.length} tool calls...`);
      messagesToGroq.push(response.choices[0].message); // add assistant tool_call message

      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        // Execute the tool
        const toolResult = await executeTool(functionName, functionArgs, user, chat._id);
        
        // Capture search or browse results
        if (functionName === "search_google" || functionName === "search_web") {
          try {
            const parsed = JSON.parse(toolResult);
            if (parsed.results && parsed.results.length > 0) {
              searchResults = parsed.results;
              searchQuery = functionArgs.query || searchQuery;
            }
          } catch (_) {}
        } else if (functionName === "browse_website") {
          try {
            const parsed = JSON.parse(toolResult);
            if (parsed.status === "success") {
              searchResults = [{
                title: parsed.title,
                url: parsed.url,
                snippet: parsed.description || parsed.content.slice(0, 180) + "...",
                source: "Web Browser",
              }];
              searchQuery = functionArgs.url || searchQuery;
            }
          } catch (_) {}
        }

        // Append result back to the LLM context
        messagesToGroq.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: functionName,
          content: toolResult,
        });
      }

      // Generate the final response using the tool results
      console.log("🤖 Calling Groq again with tool results...");
      response = await groq.chat.completions.create({
        model: MODEL,
        max_tokens: 1024,
        messages: messagesToGroq,
      });

      reply = response.choices[0].message.content;
    }

    console.log("✅ Groq replied successfully");

    // Add Mirana reply with search results
    chat.messages.push({
      role: "assistant",
      content: reply,
      searchResults: searchResults || [],
      searchQuery: searchQuery || "",
    });

    // Send response to user immediately to prevent lag!
    const updatedTitle = chat.title;
    res.json({
      reply,
      title: updatedTitle,
      searchResults: searchResults || [],
      searchQuery: searchQuery || "",
    });

    // --- BACKGROUND TASKS (Fire and Forget) ---
    // Auto title + summary after first exchange
    if (chat.messages.length === 2 && !chat.summary) {
      generateChatMeta(message, reply).then(async (meta) => {
        chat.title = meta.title || message.slice(0, 45);
        chat.summary = meta.summary || "";
        await User.findByIdAndUpdate(req.user._id, { $set: { "chats.$[elem]": chat } }, { arrayFilters: [{ "elem._id": chat._id }] });
      }).catch(err => console.error(err));
    }

    // Update summary every 6 messages
    if (chat.messages.length > 6 && chat.messages.length % 6 === 0) {
      try {
        const convoText = chat.messages.slice(-12)
          .map((m) => `${m.role === "assistant" ? "Mirana" : "User"}: ${m.content}`)
          .join("\n");
        groq.chat.completions.create({
          model: MODEL,
          max_tokens: 300,
          messages: [{ role: "user", content: `Summarize in 1-2 sentences:\n${convoText}\nReturn ONLY the summary.` }],
        }).then(async (r) => {
          chat.summary = r.choices[0].message.content.trim();
          await User.findByIdAndUpdate(req.user._id, { $set: { "chats.$[elem]": chat } }, { arrayFilters: [{ "elem._id": chat._id }] });
        });
      } catch (err) { /* silent */ }
    }

    // Save using update to avoid validation on old user docs (if not saved above)
    User.findByIdAndUpdate(req.user._id, { $set: { chats: user.chats } }).catch(err => console.error(err));

    // Fire-and-forget: extract memories + detect mood in background
    extractMemoriesAndMood(message, reply, req.user._id, req.params.chatId).catch(
      (err) => console.error("🧠 Background analysis failed:", err.message)
    );

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

// ─── POST /api/chat/:chatId/message/stream — streaming SSE response ───────────
router.post("/:chatId/message/stream", isAuthenticated, async (req, res) => {
  try {
    const { message, mode } = req.body;
    const activeMode = MODE_PROMPTS[mode] ? mode : "default";
    if (!message?.trim()) return res.status(400).json({ error: "Message required." });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found." });

    const chat = user.chats.id(req.params.chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found." });

    const isFirstMessage = chat.messages.length === 0;

    // Find last chat summary for recall — only ~35% of the time so it doesn't feel scripted
    let lastChatSummary = null;
    if (isFirstMessage && Math.random() < 0.35) {
      const lastChat = user.chats
        .filter((c) => c._id.toString() !== req.params.chatId && c.summary)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
      if (lastChat) lastChatSummary = lastChat.summary;
    }

    const memories = await getRelevantMemories(req.user._id, message);

    let activeWishes = [];
    try {
      const Wish = require("../models/Wish");
      activeWishes = await Wish.find({ userId: req.user._id, status: "active" })
        .sort({ priority: -1 })
        .limit(5)
        .lean();
    } catch (e) { /* graceful fallback */ }

    chat.messages.push({ role: "user", content: message });

    const MAX_HISTORY = 20;
    const historyMessages = chat.messages.slice(0, -1).slice(-MAX_HISTORY).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

    // ── Set up SSE headers FIRST for instant real-time connection ───────────
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let searchResults = [];
    let searchQuery = "";
    let injectedContext = "";

    // Detect if this is a real-time query or URL and pre-inject fresh context
    if (isRealTimeQuery(message)) {
      const cleanQ = message.replace(/mirana|hey|can you|tell me|search google for|search for|browse/gi, "").trim() || message;
      res.write(`data: ${JSON.stringify({ type: "search_start", query: cleanQ })}\n\n`);

      const extraInfo = await injectWebContext(message);
      if (extraInfo) {
        injectedContext = `\n\n${extraInfo.contextText}`;
        searchResults = extraInfo.searchResults || [];
        searchQuery = extraInfo.searchQuery || cleanQ;
        res.write(`data: ${JSON.stringify({ type: "search_results", results: searchResults, query: searchQuery })}\n\n`);
      }
    }

    let messagesToGroq = [
      { role: "system", content: buildSystemPrompt(user, lastChatSummary, memories, activeMode, activeWishes) },
      ...historyMessages,
      { role: "user", content: message + injectedContext },
    ];

    // ── Tool resolution pass (needed before streaming) ──────
    let toolReply = null;
    const toolCheckResponse = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 512,
      messages: messagesToGroq,
      tools: MIRANA_TOOLS,
      tool_choice: "auto",
    });

    const toolCalls = toolCheckResponse.choices[0].message.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      console.log(`🛠️ Stream: resolving ${toolCalls.length} tool calls first...`);
      messagesToGroq.push(toolCheckResponse.choices[0].message);
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        if (functionName === "search_google" || functionName === "search_web") {
          res.write(`data: ${JSON.stringify({ type: "search_start", query: functionArgs.query })}\n\n`);
        } else if (functionName === "browse_website") {
          res.write(`data: ${JSON.stringify({ type: "search_start", query: functionArgs.url })}\n\n`);
        }

        const toolResult = await executeTool(
          functionName,
          functionArgs,
          user,
          chat._id
        );

        if (functionName === "search_google" || functionName === "search_web") {
          try {
            const parsed = JSON.parse(toolResult);
            if (parsed.results && parsed.results.length > 0) {
              searchResults = parsed.results;
              searchQuery = functionArgs.query || searchQuery;
              res.write(`data: ${JSON.stringify({ type: "search_results", results: searchResults, query: searchQuery })}\n\n`);
            }
          } catch (_) {}
        } else if (functionName === "browse_website") {
          try {
            const parsed = JSON.parse(toolResult);
            if (parsed.status === "success") {
              searchResults = [{
                title: parsed.title,
                url: parsed.url,
                snippet: parsed.description || parsed.content.slice(0, 180) + "...",
                source: "Web Browser",
              }];
              searchQuery = functionArgs.url || searchQuery;
              res.write(`data: ${JSON.stringify({ type: "search_results", results: searchResults, query: searchQuery })}\n\n`);
            }
          } catch (_) {}
        }

        messagesToGroq.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: functionName,
          content: toolResult,
        });
      }
    } else if (toolCheckResponse.choices[0].message.content && !toolCalls) {
      // No tool calls — use the direct reply content if it's already complete
      toolReply = toolCheckResponse.choices[0].message.content;
    }

    let fullReply = "";

    if (toolReply) {
      // Already have a complete reply — stream it word by word for UX
      const words = toolReply.split(" ");
      for (const word of words) {
        const token = word + " ";
        fullReply += token;
        res.write(`data: ${JSON.stringify({ delta: token })}\n\n`);
        await new Promise((r) => setTimeout(r, 15));
      }
    } else {
      // Stream from Groq
      const stream = await groq.chat.completions.create({
        model: MODEL,
        max_tokens: 1024,
        messages: messagesToGroq,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
          fullReply += delta;
          res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        }
      }
    }

    // Send done signal with title metadata and searchResults
    const updatedTitle = chat.title || "New Chat";
    res.write(`data: ${JSON.stringify({ done: true, title: updatedTitle, searchResults, searchQuery })}\n\n`);
    res.end();

    // ── Background saves ────────────────────────────────────────────────────
    chat.messages.push({
      role: "assistant",
      content: fullReply,
      searchResults: searchResults || [],
      searchQuery: searchQuery || "",
    });
    chat.updatedAt = new Date();

    if (chat.messages.length === 2 && !chat.summary) {
      generateChatMeta(message, fullReply).then(async (meta) => {
        chat.title = meta.title || message.slice(0, 45);
        chat.summary = meta.summary || "";
        await User.findByIdAndUpdate(req.user._id, { $set: { "chats.$[elem]": chat } }, { arrayFilters: [{ "elem._id": chat._id }] });
      }).catch(() => {});
    } else {
      User.findByIdAndUpdate(req.user._id, { $set: { chats: user.chats } }).catch(() => {});
    }

    extractMemoriesAndMood(message, fullReply, req.user._id, req.params.chatId).catch(() => {});

  } catch (err) {
    console.error("❌ POST /api/chat/:id/message/stream error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Streaming failed.", detail: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream interrupted." })}\n\n`);
      res.end();
    }
  }
});

module.exports = router;