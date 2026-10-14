const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");
const Memory = require("../models/Memory");
const Mood = require("../models/Mood");

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;
const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;
const MAX_MEMORIES_PER_USER = 150;

// ─── Combined: Extract memories + Detect mood in ONE API call ───────────────
async function extractMemoriesAndMood(userMessage, aiReply, userId, chatId) {
  try {
    let parsed = null;

    // 1. Try Groq (fast, reliable, no tight 20 req/day quota)
    if (groq) {
      try {
        const completion = await groq.chat.completions.create({
          model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: "You are an analysis engine. Return ONLY valid JSON with keys 'memories' (array) and 'mood' (object).",
            },
            {
              role: "user",
              content: `User said: "${userMessage}"\nAI replied: "${aiReply}"\n\nReturn JSON in format:\n{\n  "memories": [\n    {\n      "category": "personal|goals|preferences|people|events|opinions|facts",\n      "content": "concise fact (max 1 sentence)",\n      "importance": "low|medium|high",\n      "tags": ["relevant", "tags"]\n    }\n  ],\n  "mood": {\n    "mood": "happy|excited|neutral|stressed|sad|angry|curious",\n    "confidence": 0.8\n  }\n}`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
        });
        const content = completion.choices[0]?.message?.content?.trim();
        if (content) {
          parsed = JSON.parse(content);
        }
      } catch (groqErr) {
        console.warn("Groq memory extraction error, falling back to Gemini:", groqErr.message);
      }
    }

    // 2. Try Gemini fallback
    if (!parsed && genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(
          `You are an analysis engine. Do TWO things from this conversation exchange:

1. Extract any facts about the user worth remembering long-term.
2. Detect the user's current mood/emotional state.

User said: "${userMessage}"
AI replied: "${aiReply}"

Return ONLY valid JSON (no markdown, no explanation):
{
  "memories": [
    {
      "category": "personal|goals|preferences|people|events|opinions|facts",
      "content": "concise fact (max 1 sentence)",
      "importance": "low|medium|high",
      "tags": ["relevant", "tags"]
    }
  ],
  "mood": {
    "mood": "happy|excited|neutral|stressed|sad|angry|curious",
    "confidence": 0.8
  }
}`
        );
        const rawText = result.response.text().trim();
        const cleaned = rawText.replace(/```json|```/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch (geminiErr) {
        console.warn("Gemini memory extraction error:", geminiErr.message);
      }
    }

    if (!parsed) {
      return { memories: [], mood: null };
    }

    // Handle memories
    const memories = parsed.memories || [];
    const saved = [];
    if (Array.isArray(memories)) {
      for (const mem of memories) {
        if (!mem.content || !mem.category) continue;
        const isDuplicate = await checkDuplicate(userId, mem.content);
        if (isDuplicate) continue;
        const doc = await Memory.create({
          userId,
          category: mem.category,
          content: mem.content,
          importance: mem.importance || "medium",
          tags: mem.tags || [],
          source: chatId || "",
        });
        saved.push(doc);
      }
      await pruneMemories(userId);
      if (saved.length > 0) {
        console.log(`🧠 Stored ${saved.length} new memories for user ${userId}`);
      }
    }

    // Handle mood
    if (parsed.mood && parsed.mood.mood) {
      await Mood.create({
        userId,
        mood: parsed.mood.mood,
        confidence: parsed.mood.confidence || 0.7,
        source: chatId || "",
        messageSnippet: userMessage.slice(0, 60),
      });
      console.log(`😊 Mood detected: ${parsed.mood.mood} (${Math.round((parsed.mood.confidence || 0.7) * 100)}%)`);
    }

    return { memories: saved, mood: parsed.mood };
  } catch (err) {
    console.error("🧠 Memory+Mood extraction error:", err.message);
    return { memories: [], mood: null };
  }
}

// Legacy wrapper for backward compatibility
async function extractMemories(userMessage, aiReply, userId, chatId) {
  const result = await extractMemoriesAndMood(userMessage, aiReply, userId, chatId);
  return result.memories;
}

// ─── Check if a similar memory already exists ────────────────────────────────
async function checkDuplicate(userId, newContent) {
  // Check for exact or very similar content
  const existing = await Memory.findOne({
    userId,
    content: { $regex: escapeRegex(newContent.slice(0, 50)), $options: "i" },
  });
  return !!existing;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Get relevant memories for system prompt injection ───────────────────────
async function getRelevantMemories(userId, currentMessage) {
  try {
    // Get all memories, prioritized by importance and recency
    const memories = await Memory.find({ userId })
      .sort({ importance: -1, lastReferencedAt: -1, createdAt: -1 })
      .limit(30)
      .lean();

    if (memories.length === 0) return [];

    // Separate high-importance (always include) from others
    const high = memories.filter((m) => m.importance === "high");
    const medium = memories.filter((m) => m.importance === "medium");
    const low = memories.filter((m) => m.importance === "low");

    // Build final list: all high + top medium + some low (max 20 total for prompt size)
    const selected = [
      ...high,
      ...medium.slice(0, 12 - high.length),
      ...low.slice(0, Math.max(0, 20 - high.length - medium.length)),
    ].slice(0, 20);

    // Update lastReferencedAt for selected memories
    const selectedIds = selected.map((m) => m._id);
    if (selectedIds.length > 0) {
      Memory.updateMany(
        { _id: { $in: selectedIds } },
        { $set: { lastReferencedAt: new Date() } }
      ).catch(() => {}); // fire and forget
    }

    return selected;
  } catch (err) {
    console.error("🧠 Memory retrieval error:", err.message);
    return [];
  }
}

// ─── Format memories for system prompt ───────────────────────────────────────
function formatMemoriesForPrompt(memories, firstName) {
  if (!memories || memories.length === 0) return "";

  const grouped = {};
  for (const mem of memories) {
    if (!grouped[mem.category]) grouped[mem.category] = [];
    grouped[mem.category].push(mem.content);
  }

  const categoryLabels = {
    personal: "Personal details",
    goals: "Goals & ambitions",
    preferences: "Preferences & likes",
    people: "People in their life",
    events: "Upcoming events & deadlines",
    opinions: "Opinions & views",
    facts: "Things they've shared",
  };

  let section = `\nWHAT YOU REMEMBER ABOUT ${firstName}:\n`;
  for (const [category, items] of Object.entries(grouped)) {
    const label = categoryLabels[category] || category;
    section += `${label}:\n`;
    for (const item of items) {
      section += `  - ${item}\n`;
    }
  }
  section += `\nUse these memories NATURALLY. Don't list them out or say "I remember that..." — just reference them like a friend who naturally knows these things. Only bring up a memory when it's actually relevant to the current conversation.`;

  return section;
}

// ─── Prune old memories when over limit ──────────────────────────────────────
async function pruneMemories(userId) {
  const count = await Memory.countDocuments({ userId });
  if (count <= MAX_MEMORIES_PER_USER) return;

  const excess = count - MAX_MEMORIES_PER_USER;

  // Delete oldest low-importance memories first
  const toDelete = await Memory.find({ userId })
    .sort({ importance: 1, lastReferencedAt: 1, createdAt: 1 })
    .limit(excess)
    .select("_id");

  if (toDelete.length > 0) {
    await Memory.deleteMany({ _id: { $in: toDelete.map((d) => d._id) } });
    console.log(`🧹 Pruned ${toDelete.length} old memories for user ${userId}`);
  }
}

// ─── Get all memories for a user (for API) ───────────────────────────────────
async function getAllMemories(userId) {
  return Memory.find({ userId })
    .sort({ category: 1, importance: -1, createdAt: -1 })
    .lean();
}

// ─── Get memory stats ────────────────────────────────────────────────────────
async function getMemoryStats(userId) {
  const memories = await Memory.find({ userId }).lean();
  const byCategory = {};
  const byImportance = { high: 0, medium: 0, low: 0 };

  for (const mem of memories) {
    byCategory[mem.category] = (byCategory[mem.category] || 0) + 1;
    byImportance[mem.importance] = (byImportance[mem.importance] || 0) + 1;
  }

  return {
    total: memories.length,
    maxCapacity: MAX_MEMORIES_PER_USER,
    byCategory,
    byImportance,
  };
}

// ─── Delete a specific memory ────────────────────────────────────────────────
async function deleteMemory(userId, memoryId) {
  return Memory.findOneAndDelete({ _id: memoryId, userId });
}

// ─── Get mood data for dashboard ─────────────────────────────────────────────
async function getRecentMoods(userId, limit = 30) {
  return Mood.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

async function getMoodTrend(userId, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const moods = await Mood.find({
    userId,
    createdAt: { $gte: since },
  })
    .sort({ createdAt: 1 })
    .lean();

  // Group by day
  const byDay = {};
  for (const m of moods) {
    const day = m.createdAt.toISOString().split("T")[0];
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(m.mood);
  }

  // Get dominant mood per day
  const trend = Object.entries(byDay).map(([date, dayMoods]) => {
    const counts = {};
    for (const mood of dayMoods) counts[mood] = (counts[mood] || 0) + 1;
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return { date, mood: dominant[0], count: dayMoods.length };
  });

  return trend;
}

module.exports = {
  extractMemories,
  extractMemoriesAndMood,
  getRelevantMemories,
  formatMemoriesForPrompt,
  getAllMemories,
  getMemoryStats,
  deleteMemory,
  getRecentMoods,
  getMoodTrend,
};
