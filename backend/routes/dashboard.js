const express = require("express");
const router = express.Router();
const User = require("../models/user");
const { isAuthenticated } = require("../middleware/auth");
const { getMemoryStats, getAllMemories, getMoodTrend, getRecentMoods } = require("../services/memory");

// GET /api/dashboard — all dashboard data in one call
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "displayName email photo personality chats"
    );
    if (!user) return res.status(404).json({ error: "User not found." });

    const firstName = (user.displayName || user.email || "Boss").split(" ")[0];

    // Time-aware greeting
    const hour = new Date().getHours();
    let timeGreeting;
    if (hour < 5) timeGreeting = `Still up, ${firstName}? Burning the midnight oil.`;
    else if (hour < 12) timeGreeting = `Good morning, ${firstName}.`;
    else if (hour < 17) timeGreeting = `Afternoon, ${firstName}.`;
    else if (hour < 21) timeGreeting = `Evening, ${firstName}.`;
    else timeGreeting = `Late night, ${firstName}. Everything good?`;

    // Memory stats
    const memoryStats = await getMemoryStats(req.user._id);

    // Recent memories (top 5)
    const allMemories = await getAllMemories(req.user._id);
    const recentMemories = allMemories.slice(0, 5);

    // Mood trend (last 7 days)
    const moodTrend = await getMoodTrend(req.user._id, 7);

    // Recent moods (last 10)
    const recentMoods = await getRecentMoods(req.user._id, 10);

    // Recent chats (last 5)
    const recentChats = user.chats
      .map((c) => ({
        id: c._id,
        title: c.title,
        summary: c.summary,
        updatedAt: c.updatedAt,
        messageCount: c.messages.length,
      }))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 5);

    // Personality summary
    const personality = {
      summary: user.personality?.summary || "",
      traits: user.personality?.traits || [],
      interests: user.personality?.interests || [],
      communicationStyle: user.personality?.communicationStyle || "casual",
    };

    res.json({
      greeting: timeGreeting,
      firstName,
      personality,
      memoryStats,
      recentMemories,
      moodTrend,
      recentMoods,
      recentChats,
      photo: user.photo,
    });
  } catch (err) {
    console.error("❌ GET /api/dashboard error:", err);
    res.status(500).json({ error: "Failed to load dashboard.", detail: err.message });
  }
});

module.exports = router;
