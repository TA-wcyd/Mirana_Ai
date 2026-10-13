const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Wish = require("../models/Wish");
const Notification = require("../models/Notification");
const { isAuthenticated } = require("../middleware/auth");
const { getMemoryStats, getAllMemories, getMoodTrend, getRecentMoods } = require("../services/memory");

// GET /api/dashboard — all dashboard data in one call
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "displayName email photo personality chats homeCountry currentCountry"
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

    // Run all queries in parallel
    const [
      memoryStats,
      allMemories,
      moodTrend,
      recentMoods,
      activeWishes,
      allWishes,
      notificationData,
    ] = await Promise.all([
      getMemoryStats(req.user._id),
      getAllMemories(req.user._id),
      getMoodTrend(req.user._id, 7),
      getRecentMoods(req.user._id, 10),
      Wish.find({ userId: req.user._id, status: "active" })
        .sort({ priority: -1, deadline: 1 })
        .limit(6)
        .lean(),
      Wish.find({ userId: req.user._id })
        .sort({ updatedAt: -1 })
        .lean(),
      Notification.find({ userId: req.user._id })
        .sort({ read: 1, createdAt: -1 })
        .limit(15)
        .lean(),
    ]);

    const recentMemories = allMemories.slice(0, 5);

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

    // Wish stats summary
    const wishStats = {
      total: allWishes.length,
      active: allWishes.filter((w) => w.status === "active").length,
      completed: allWishes.filter((w) => w.status === "completed").length,
    };

    // Upcoming deadlines (next 7 days)
    const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const upcomingDeadlines = activeWishes
      .filter((w) => w.deadline && new Date(w.deadline) <= sevenDays)
      .slice(0, 3);

    const unreadNotificationCount = notificationData.filter((n) => !n.read).length;

    res.json({
      greeting: timeGreeting,
      firstName,
      photo: user.photo,
      personality: {
        summary: user.personality?.summary || "",
        traits: user.personality?.traits || [],
        interests: user.personality?.interests || [],
        communicationStyle: user.personality?.communicationStyle || "casual",
      },
      memoryStats,
      recentMemories,
      moodTrend,
      recentMoods,
      recentChats,
      activeWishes,
      wishStats,
      upcomingDeadlines,
      notifications: notificationData,
      unreadNotificationCount,
    });
  } catch (err) {
    console.error("❌ GET /api/dashboard error:", err);
    res.status(500).json({ error: "Failed to load dashboard.", detail: err.message });
  }
});

module.exports = router;
