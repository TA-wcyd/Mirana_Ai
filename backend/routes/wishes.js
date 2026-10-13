const express = require("express");
const router = express.Router();
const Wish = require("../models/Wish");
const { isAuthenticated } = require("../middleware/auth");

// ─── GET /api/wishes — list all wishes ───────────────────────────────────────
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { userId: req.user._id };
    if (status) filter.status = status;

    const wishes = await Wish.find(filter)
      .sort({ priority: -1, createdAt: -1 })
      .lean();

    res.json({ wishes });
  } catch (err) {
    console.error("❌ GET /api/wishes error:", err);
    res.status(500).json({ error: "Failed to load wishes.", detail: err.message });
  }
});

// ─── GET /api/wishes/active — active wishes (for dashboard + prompt) ─────────
router.get("/active", isAuthenticated, async (req, res) => {
  try {
    const wishes = await Wish.find({ userId: req.user._id, status: "active" })
      .sort({ priority: -1, deadline: 1 })
      .limit(10)
      .lean();

    res.json({ wishes });
  } catch (err) {
    console.error("❌ GET /api/wishes/active error:", err);
    res.status(500).json({ error: "Failed to load active wishes.", detail: err.message });
  }
});

// ─── POST /api/wishes — create a wish ────────────────────────────────────────
router.post("/", isAuthenticated, async (req, res) => {
  try {
    const { title, description, category, priority, deadline, milestones } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "Title is required." });

    const wish = await Wish.create({
      userId: req.user._id,
      title: title.trim(),
      description: description?.trim() || "",
      category: category || "personal",
      priority: priority || "medium",
      deadline: deadline ? new Date(deadline) : null,
      milestones: (milestones || []).map((m) => ({ title: m, done: false })),
    });

    console.log(`⭐ New wish created for user ${req.user._id}: "${wish.title}"`);
    res.json({ wish });
  } catch (err) {
    console.error("❌ POST /api/wishes error:", err);
    res.status(500).json({ error: "Failed to create wish.", detail: err.message });
  }
});

// ─── PATCH /api/wishes/:id — update progress / status / fields ───────────────
router.patch("/:id", isAuthenticated, async (req, res) => {
  try {
    const { progress, status, description, priority, deadline, checkInNote, milestoneId, milestoneDone } = req.body;

    const wish = await Wish.findOne({ _id: req.params.id, userId: req.user._id });
    if (!wish) return res.status(404).json({ error: "Wish not found." });

    if (progress !== undefined) wish.progress = Math.min(100, Math.max(0, Number(progress)));
    if (status !== undefined) wish.status = status;
    if (description !== undefined) wish.description = description;
    if (priority !== undefined) wish.priority = priority;
    if (deadline !== undefined) wish.deadline = deadline ? new Date(deadline) : null;

    // Handle milestone toggle
    if (milestoneId !== undefined && milestoneDone !== undefined) {
      const ms = wish.milestones.id(milestoneId);
      if (ms) {
        ms.done = milestoneDone;
        ms.completedAt = milestoneDone ? new Date() : null;
      }
    }

    // Handle a check-in note
    if (checkInNote?.trim()) {
      wish.checkIns.push({ note: checkInNote.trim(), progressAtTime: wish.progress });
    }

    // Auto-complete if progress hits 100
    if (wish.progress >= 100 && wish.status === "active") {
      wish.status = "completed";
      wish.completedAt = new Date();
    }

    await wish.save();
    console.log(`✅ Wish "${wish.title}" updated — ${wish.progress}% [${wish.status}]`);
    res.json({ wish });
  } catch (err) {
    console.error("❌ PATCH /api/wishes/:id error:", err);
    res.status(500).json({ error: "Failed to update wish.", detail: err.message });
  }
});

// ─── POST /api/wishes/:id/milestone — add a milestone ────────────────────────
router.post("/:id/milestone", isAuthenticated, async (req, res) => {
  try {
    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "Milestone title required." });

    const wish = await Wish.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $push: { milestones: { title: title.trim(), done: false } } },
      { new: true }
    );
    if (!wish) return res.status(404).json({ error: "Wish not found." });

    res.json({ wish });
  } catch (err) {
    console.error("❌ POST /api/wishes/:id/milestone error:", err);
    res.status(500).json({ error: "Failed to add milestone.", detail: err.message });
  }
});

// ─── DELETE /api/wishes/:id — delete a wish ──────────────────────────────────
router.delete("/:id", isAuthenticated, async (req, res) => {
  try {
    const deleted = await Wish.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!deleted) return res.status(404).json({ error: "Wish not found." });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ DELETE /api/wishes/:id error:", err);
    res.status(500).json({ error: "Failed to delete wish.", detail: err.message });
  }
});

module.exports = router;
