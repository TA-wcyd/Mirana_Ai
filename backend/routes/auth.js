const express = require("express");
const passport = require("passport");
const router = express.Router();

// Start Google OAuth
router.get("/google", (req, res, next) => {
  // Debug: log the exact redirect_uri being sent to Google
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const resolvedCallback = process.env.GOOGLE_CALLBACK_URL ||
    `${proto}://${host}/auth/google/callback`;
  console.log("[OAuth] GOOGLE_CALLBACK_URL env:", process.env.GOOGLE_CALLBACK_URL);
  console.log("[OAuth] Resolved redirect_uri sent to Google:", resolvedCallback);
  next();
}, passport.authenticate("google", { scope: ["profile", "email"] }));

const getFrontendUrl = () => (process.env.FRONTEND_URL || "").replace(/\/$/, "");

// Google callback
router.get(
  "/google/callback",
  (req, res, next) => {
    const frontend = getFrontendUrl();
    passport.authenticate("google", {
      failureRedirect: `${frontend}/login?error=auth_failed`,
    })(req, res, next);
  },
  (req, res) => {
    const frontend = getFrontendUrl();
    const target = req.user.onboardingComplete
      ? `${frontend}/chat`
      : `${frontend}/onboarding`;

    // Explicitly save session before redirecting — required with Express 5 + MongoStore
    // to guarantee the session is flushed to MongoDB before the browser's next request
    req.session.save((err) => {
      if (err) {
        console.error("[auth] Session save error after Google OAuth:", err);
      }
      res.redirect(target);
    });
  }
);

// Get current user
router.get("/me", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    user: {
      id: req.user._id,
      displayName: req.user.displayName,
      email: req.user.email,
      photo: req.user.photo,
      onboardingComplete: req.user.onboardingComplete,
      personality: req.user.personality,
    },
  });
});

// Logout
router.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });
});

module.exports = router;