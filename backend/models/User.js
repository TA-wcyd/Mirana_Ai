const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  role: { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const ChatSchema = new mongoose.Schema({
  title: { type: String, default: "New Chat" },
  summary: { type: String, default: "" }, // used for recall next session
  messages: [MessageSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const UserSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    email: { type: String, required: true },
    photo: { type: String, default: "" },
    onboardingComplete: { type: Boolean, default: false },
    personalityAnswers: { type: Map, of: String, default: {} },
    personality: {
      summary: { type: String, default: "" },
      traits: [String],
      communicationStyle: { type: String, default: "casual" },
      interests: [String],
      raw: { type: String, default: "" },
    },
    homeCountry: { type: String, default: "" },
    currentCountry: { type: String, default: "" },
    chats: [ChatSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model("User", UserSchema);