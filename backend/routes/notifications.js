const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const { isAuthenticated } = require("../middleware/auth");

// ─── GET /api/notifications — list notifications (unread first) ───────────────
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ read: 1, createdAt: -1 })
      .limit(limit)
      .lean();

    const unreadCount = await Notification.countDocuments({
      userId: req.user._id,
      read: false,
    });

    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error("❌ GET /api/notifications error:", err);
    res.status(500).json({ error: "Failed to load notifications.", detail: err.message });
  }
});

// ─── PATCH /api/notifications/:id/read — mark one as read ────────────────────
router.patch("/:id/read", isAuthenticated, async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark notification as read." });
  }
});

// ─── PATCH /api/notifications/read-all — mark all as read ────────────────────
router.patch("/read-all", isAuthenticated, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark all as read." });
  }
});

// ─── DELETE /api/notifications/:id — delete one ───────────────────────────────
router.delete("/:id", isAuthenticated, async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete notification." });
  }
});

module.exports = router;
