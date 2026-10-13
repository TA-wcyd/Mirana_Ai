const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["morning_brief", "wish_reminder", "weekly_recap", "milestone", "streak", "system"],
      default: "system",
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    read: { type: Boolean, default: false, index: true },
    wishId: { type: mongoose.Schema.Types.ObjectId, ref: "Wish", default: null },
    actionUrl: { type: String, default: "" }, // e.g. "/chat?mode=jarvis"
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, read: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", NotificationSchema);
