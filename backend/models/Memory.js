const mongoose = require("mongoose");

const MemorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: [
        "personal",
        "goals",
        "preferences",
        "people",
        "events",
        "opinions",
        "facts",
      ],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    importance: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    tags: [String],
    source: {
      type: String, // chatId where this memory was extracted from
      default: "",
    },
    lastReferencedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Text index for content search
MemorySchema.index({ content: "text", tags: "text" });

// Compound index for fast user + category lookups
MemorySchema.index({ userId: 1, category: 1 });

// Compound index for deduplication checks
MemorySchema.index({ userId: 1, content: 1 });

module.exports = mongoose.model("Memory", MemorySchema);
