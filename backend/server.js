const dns = require("node:dns");

dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

require("dotenv").config({ quiet: true });

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo").MongoStore;
const passport = require("passport");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");

const app = express();
const isProd = process.env.NODE_ENV === "production";

// Enable reverse proxy support for Render HTTPS / TLS termination
if (isProd) {
  app.set("trust proxy", 1);
}

require("./config/passport");

app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin) return callback(null, true);
      if (!process.env.FRONTEND_URL) return callback(null, true);
      const cleanFrontendUrl = process.env.FRONTEND_URL.replace(/\/$/, "");
      if (origin === cleanFrontendUrl || origin === "http://localhost:5173" || origin === "http://localhost:5000") {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "mirana_session_secret",
    resave: false,
    saveUninitialized: false,
    proxy: isProd,
    // Persist sessions in MongoDB so they survive Render restarts / cold starts
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
      ttl: 7 * 24 * 60 * 60, // 7 days in seconds
      autoRemove: "native",
    }),
    cookie: {
      secure: isProd,
      sameSite: isProd ? "none" : "lax", // "none" required for cross-site cookies in production
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use("/auth", require("./routes/auth"));
app.use("/api/user", require("./routes/user"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/memory", require("./routes/memory"));
app.use("/api/mood", require("./routes/mood"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/upload", require("./routes/upload"));
app.use("/api/news", require("./routes/news"));
app.use("/api/wishes", require("./routes/wishes"));
app.use("/api/notifications", require("./routes/notifications"));

// Health check endpoint for Render monitoring
app.get("/health", (req, res) => {
  const dbStateMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  const database = dbStateMap[mongoose.connection.readyState] || "unknown";

  res.status(database === "connected" ? 200 : 503).json({
    api: "online",
    database,
  });
});

// Serve frontend build in production if available
const frontendDist = path.join(__dirname, "../frontend/dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // Express 5 wildcard routing for Single Page Application
  app.get("/{*splat}", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/auth") || req.path === "/health") {
      return next();
    }
    res.sendFile(path.join(frontendDist, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.json({ message: "Mirana API is alive", status: "online" });
  });
}

app.get("/fix-users", async (req, res) => {
  const User = require("./models/User");
  const result = await User.updateMany(
    { displayName: { $exists: false } },
    { $set: { displayName: "User", onboardingComplete: false } }
  );

  res.json({ fixed: result.modifiedCount });
});

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("Error: MONGO_URI is not defined in backend/.env");
  process.exit(1);
}

app.listen(PORT, () => {
  console.log("Mirana API server is online");
  console.log(`Listening on http://localhost:${PORT}`);
});

mongoose.set("strictQuery", false);

mongoose.connection.on("connected", () => {
  console.log("MongoDB connected successfully");
  // Start proactive agent scheduler after DB is ready
  const { startScheduler } = require("./services/scheduler");
  startScheduler();
});

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected");
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB runtime error:", err.message);
});

async function connectToDatabase() {
  console.log("Attempting MongoDB connection...");

  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
    });
  } catch (err) {
    console.error("MongoDB connection failed.");

    if (err.code === "ECONNREFUSED" && err.syscall === "querySrv") {
      console.error(
        "SRV DNS lookup failed. Your network may be blocking MongoDB SRV records."
      );
      console.error(
        "If this keeps happening, switch Atlas to a standard mongodb:// connection string."
      );
      return;
    }

    console.error(
      "Most likely cause: your current public IP is not allowed in MongoDB Atlas Network Access."
    );
    console.error(
      "Temporary dev fix: allow 0.0.0.0/0 in Atlas, or use a stable public IP or VPN."
    );

    if (process.env.DEBUG_DB_ERRORS === "true") {
      console.error(err);
    }
  }
}

connectToDatabase();
