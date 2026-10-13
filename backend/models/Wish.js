const mongoose = require("mongoose");

const MilestoneSchema = new mongoose.Schema({
  title: { type: String, required: true },
  done: { type: Boolean, default: false },
  completedAt: { type: Date },
});

const CheckInSchema = new mongoose.Schema({
  note: { type: String, required: true },
  progressAtTime: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const WishSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    category: {
      type: String,
      enum: ["learning", "health", "career", "personal", "project", "finance", "relationship", "other"],
      default: "personal",
    },
    status: {
      type: String,
      enum: ["active", "completed", "paused", "cancelled"],
      default: "active",
      index: true,
    },
    priority: {
      type: String,
      enum: ["high", "medium", "low"],
      default: "medium",
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    deadline: { type: Date, default: null },
    milestones: [MilestoneSchema],
    checkIns: [CheckInSchema],
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

WishSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model("Wish", WishSchema);
