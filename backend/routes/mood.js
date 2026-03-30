const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/auth");
const { getRecentMoods, getMoodTrend } = require("../services/memory");

// GET /api/mood/recent — last N mood entries
router.get("/recent", isAuthenticated, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const moods = await getRecentMoods(req.user._id, limit);
    res.json({ moods });
  } catch (err) {
    console.error("❌ GET /api/mood/recent error:", err);
    res.status(500).json({ error: "Failed to load moods.", detail: err.message });
  }
});

// GET /api/mood/trend — mood trend over N days
router.get("/trend", isAuthenticated, async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 90);
    const trend = await getMoodTrend(req.user._id, days);
    res.json({ trend });
  } catch (err) {
    console.error("❌ GET /api/mood/trend error:", err);
    res.status(500).json({ error: "Failed to load mood trend.", detail: err.message });
  }
});

module.exports = router;
