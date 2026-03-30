// 1. DNS Fix
const dns = require("node:dns");
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

// 2. Core Dependencies
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const cookieParser = require("cookie-parser");

// 3. Initialize App FIRST
const app = express();

// 4. Passport Config
require("./config/Passport");

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "mirana_session_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,           // must be false on localhost (no HTTPS)
      sameSite: "lax",         // allows cross-origin cookie on localhost
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/auth", require("./routes/auth"));
app.use("/api/user", require("./routes/user"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/memory", require("./routes/memory"));
app.use("/api/mood", require("./routes/mood"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/upload", require("./routes/upload"));

app.get("/", (req, res) => {
  res.json({ message: "Mirana API is alive 🔥", status: "Online" });
});

// One-time fix: patch user documents missing required fields
app.get("/fix-users", async (req, res) => {
  const User = require("./models/user");
  const result = await User.updateMany(
    { displayName: { $exists: false } },
    { $set: { displayName: "User", onboardingComplete: false } }
  );
  res.json({ fixed: result.modifiedCount });
});

// ─── DB Connection & Server Start ────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ Error: MONGO_URI is not defined in .env file");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected successfully");
    app.listen(PORT, () => {
      console.log(`🚀 Mirana Systems Online`);
      console.log(`📡 Server running on port: ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:");
    console.error(err);
  });