const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["user", "assistant"],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  llmUsed: {
    type: String,
    enum: ["claude", "gemini", "openai"],
    default: "claude",
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const SessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Short topic title like "Epstein Files" or "Bayern vs Real Madrid"
    topic: {
      type: String,
      default: "General Chat",
    },

    // One-liner summary of what was discussed (used for welcome greeting)
    summary: {
      type: String,
      default: "",
    },

    // Full message history for this session
    messages: [MessageSchema],

    // Is this the active/latest session?
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Session", SessionSchema);