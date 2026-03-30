const mongoose = require("mongoose");

const MoodSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    mood: {
      type: String,
      enum: ["happy", "excited", "neutral", "stressed", "sad", "angry", "curious"],
      required: true,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.7,
    },
    source: {
      type: String, // chatId
      default: "",
    },
    messageSnippet: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

MoodSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Mood", MoodSchema);
