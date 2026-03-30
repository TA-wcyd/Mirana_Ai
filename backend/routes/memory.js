const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/auth");
const {
  getAllMemories,
  getMemoryStats,
  deleteMemory,
} = require("../services/memory");

// ─── GET /api/memory — list all memories ─────────────────────────────────────
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const memories = await getAllMemories(req.user._id);
    res.json({ memories });
  } catch (err) {
    console.error("❌ GET /api/memory error:", err);
    res.status(500).json({ error: "Failed to load memories.", detail: err.message });
  }
});

// ─── GET /api/memory/stats — memory stats ────────────────────────────────────
router.get("/stats", isAuthenticated, async (req, res) => {
  try {
    const stats = await getMemoryStats(req.user._id);
    res.json(stats);
  } catch (err) {
    console.error("❌ GET /api/memory/stats error:", err);
    res.status(500).json({ error: "Failed to load memory stats.", detail: err.message });
  }
});

// ─── DELETE /api/memory/:id — delete a memory ───────────────────────────────
router.delete("/:id", isAuthenticated, async (req, res) => {
  try {
    const deleted = await deleteMemory(req.user._id, req.params.id);
    if (!deleted) return res.status(404).json({ error: "Memory not found." });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ DELETE /api/memory/:id error:", err);
    res.status(500).json({ error: "Failed to delete memory.", detail: err.message });
  }
});

module.exports = router;
