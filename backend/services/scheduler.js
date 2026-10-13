const cron = require("node-cron");
const User = require("../models/User");
const Wish = require("../models/Wish");
const Notification = require("../models/Notification");
const Groq = require("groq-sdk");
const { getLatestNews } = require("./news");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

// ─── Generate a morning brief for one user ────────────────────────────────────
async function generateMorningBrief(user) {
  try {
    const firstName = (user.displayName || user.email || "Boss").split(" ")[0];

    // Get active wishes
    const activeWishes = await Wish.find({ userId: user._id, status: "active" })
      .sort({ priority: -1 })
      .limit(5)
      .lean();

    // Get deadlines in the next 7 days
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingDeadlines = activeWishes.filter(
      (w) => w.deadline && new Date(w.deadline) <= sevenDaysLater
    );

    // Fetch news from user's country
    let newsSnippet = "";
    try {
      const newsQuery = user.currentCountry || user.homeCountry || "world";
      const news = await getLatestNews(newsQuery);
      if (news?.headlines?.length > 0) {
        newsSnippet = `Top headlines from ${newsQuery}: ${news.headlines.slice(0, 3).join("; ")}`;
      }
    } catch (e) { /* silent */ }

    const wishSummary = activeWishes.length > 0
      ? activeWishes.map((w) => `- "${w.title}" (${w.progress}% done)`).join("\n")
      : "No active goals set yet.";

    const deadlineSummary = upcomingDeadlines.length > 0
      ? `⚠️ Deadlines this week: ${upcomingDeadlines.map((w) => `"${w.title}" due ${new Date(w.deadline).toDateString()}`).join(", ")}`
      : "";

    const prompt = `You are Mirana, a sharp personal AI. Write a short morning brief for ${firstName}.

Personality: ${user.personality?.summary || "A motivated individual"}
Active goals:\n${wishSummary}
${deadlineSummary}
${newsSnippet ? `News context: ${newsSnippet}` : ""}

Write a punchy, personalized morning brief (3-5 sentences max). Be like JARVIS — efficient, warm, actionable. Reference their goals. End with one motivating line. No filler.`;

    const response = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const brief = response.choices[0].message.content.trim();

    await Notification.create({
      userId: user._id,
      type: "morning_brief",
      title: `☀️ Good Morning, ${firstName}`,
      body: brief,
    });

    console.log(`☀️ Morning brief generated for ${firstName}`);
  } catch (err) {
    console.error(`❌ Morning brief failed for user ${user._id}:`, err.message);
  }
}

// ─── Check for upcoming wish deadlines ────────────────────────────────────────
async function checkDeadlines() {
  try {
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Find wishes with deadlines in the next 3 days that haven't been notified today
    const urgentWishes = await Wish.find({
      status: "active",
      deadline: { $gte: now, $lte: threeDaysLater },
      progress: { $lt: 100 },
    }).populate("userId", "displayName email").lean();

    for (const wish of urgentWishes) {
      if (!wish.userId) continue;

      const daysLeft = Math.ceil((new Date(wish.deadline) - now) / (1000 * 60 * 60 * 24));
      const label = daysLeft === 0 ? "TODAY" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;

      // Check if we already sent a deadline notification for this wish today
      const alreadyNotified = await Notification.findOne({
        userId: wish.userId._id,
        wishId: wish._id,
        type: "wish_reminder",
        createdAt: { $gte: new Date(now.setHours(0, 0, 0, 0)) },
      });

      if (!alreadyNotified) {
        await Notification.create({
          userId: wish.userId._id,
          type: "wish_reminder",
          title: `⏰ Deadline Alert: "${wish.title}"`,
          body: `Boss, "${wish.title}" is due ${label} and you're at ${wish.progress}%. Time to push.`,
          wishId: wish._id,
        });
        console.log(`⏰ Deadline alert sent for wish "${wish.title}"`);
      }
    }
  } catch (err) {
    console.error("❌ Deadline check failed:", err.message);
  }
}

// ─── Weekly recap ─────────────────────────────────────────────────────────────
async function generateWeeklyRecap() {
  try {
    const users = await User.find({ onboardingComplete: true }).select("_id displayName email personality").lean();

    for (const user of users) {
      try {
        const firstName = (user.displayName || user.email || "Boss").split(" ")[0];
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const allWishes = await Wish.find({ userId: user._id }).lean();
        const active = allWishes.filter((w) => w.status === "active");
        const completed = allWishes.filter((w) => w.completedAt && new Date(w.completedAt) >= oneWeekAgo);

        if (active.length === 0 && completed.length === 0) continue; // Skip users with no goals

        const prompt = `You are Mirana. Write a short weekly recap for ${firstName}.

Completed this week: ${completed.length > 0 ? completed.map((w) => `"${w.title}"`).join(", ") : "Nothing completed yet."}
Still active: ${active.length > 0 ? active.map((w) => `"${w.title}" (${w.progress}%)`).join(", ") : "No active goals."}

Write a 2-3 sentence weekly check-in. Be honest about progress. Celebrate wins. Push harder on active ones. Sign off as Mirana.`;

        const response = await groq.chat.completions.create({
          model: MODEL,
          max_tokens: 150,
          messages: [{ role: "user", content: prompt }],
        });

        await Notification.create({
          userId: user._id,
          type: "weekly_recap",
          title: `📊 Weekly Intel — ${firstName}`,
          body: response.choices[0].message.content.trim(),
        });

        console.log(`📊 Weekly recap sent to ${firstName}`);
      } catch (e) {
        console.error(`Weekly recap failed for ${user._id}:`, e.message);
      }
    }
  } catch (err) {
    console.error("❌ Weekly recap job failed:", err.message);
  }
}

// ─── Morning brief runner — all active users ──────────────────────────────────
async function runMorningBriefs() {
  try {
    const users = await User.find({ onboardingComplete: true })
      .select("_id displayName email photo personality homeCountry currentCountry")
      .lean();

    console.log(`☀️ Running morning briefs for ${users.length} users...`);
    for (const user of users) {
      await generateMorningBrief(user);
    }
  } catch (err) {
    console.error("❌ Morning brief run failed:", err.message);
  }
}

// ─── Start all cron jobs ──────────────────────────────────────────────────────
function startScheduler() {
  console.log("⏰ Mirana scheduler started");

  // Morning brief — every day at 8:00 AM server time
  cron.schedule("0 8 * * *", () => {
    console.log("☀️ [CRON] Running morning briefs...");
    runMorningBriefs();
  });

  // Deadline checker — every day at 9:00 AM
  cron.schedule("0 9 * * *", () => {
    console.log("⏰ [CRON] Checking wish deadlines...");
    checkDeadlines();
  });

  // Weekly recap — every Sunday at 7:00 PM
  cron.schedule("0 19 * * 0", () => {
    console.log("📊 [CRON] Generating weekly recaps...");
    generateWeeklyRecap();
  });
}

module.exports = { startScheduler, runMorningBriefs, checkDeadlines, generateWeeklyRecap };
