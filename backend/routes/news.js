const express = require("express");
const router = express.Router();
const { getLatestNews } = require("../services/news");
const { isAuthenticated } = require("../middleware/auth");

// ─── GET /api/news ──────────────────────────────────────────────────────────
// Fetches news based on User's location or a default query
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const userQuery = req.query.q || req.user?.currentCountry || req.user?.homeCountry || "World";
    
    // Fetch news using the existing service
    const newsData = await getLatestNews(userQuery);

    if (newsData.status === "error") {
      return res.status(500).json({ error: newsData.message });
    }

    res.json({
      query: newsData.query,
      articles: newsData.articles,
    });
  } catch (err) {
    console.error("❌ GET /api/news error:", err);
    res.status(500).json({ error: "Failed to load news.", detail: err.message });
  }
});

module.exports = router;
