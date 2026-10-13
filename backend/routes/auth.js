const express = require("express");
const passport = require("passport");
const router = express.Router();

// Start Google OAuth
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

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
    if (!req.user.onboardingComplete) {
      return res.redirect(`${frontend}/onboarding`);
    }
    res.redirect(`${frontend}/chat`);
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