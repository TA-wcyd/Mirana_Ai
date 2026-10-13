const { getLatestNews } = require("./news");
const { performWebSearch } = require("./search");
const Wish = require("../models/Wish");
const Notification = require("../models/Notification");

// ─── Tool Definitions (Groq function-calling format) ─────────────────────────
const MIRANA_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_latest_news",
      description: "Fetch the latest news headlines for a specific country or topic.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The country name or topic to search for (e.g., 'Bangladesh', 'USA', 'Technology').",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_web",
      description: "Search the web for real-time information. Use this when asked about recent events, current data, or anything you don't know.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to look up on the web.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get the current weather for a city. Use when the user asks about weather conditions.",
      parameters: {
        type: "object",
        properties: {
          city: {
            type: "string",
            description: "The city name to get weather for (e.g., 'Dhaka', 'London', 'New York').",
          },
        },
        required: ["city"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_time_date",
      description: "Get the current date and time. Use when the user asks what time or date it is.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_wish",
      description: "Create a tracked wish or goal for the user. Use this when the user expresses a desire, goal, or aspiration they want to achieve — like 'I want to learn guitar', 'I want to get fit', 'I want to launch my startup'.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short title of the wish/goal (max 60 chars)." },
          description: { type: "string", description: "More context about the goal." },
          category: {
            type: "string",
            enum: ["learning", "health", "career", "personal", "project", "finance", "relationship", "other"],
            description: "Category of the wish.",
          },
          priority: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "How important is this goal to the user?",
          },
          deadline: {
            type: "string",
            description: "Optional deadline in ISO date format (YYYY-MM-DD), e.g. '2025-12-31'.",
          },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_wish_progress",
      description: "Update the progress percentage on one of the user's active wishes. Use this when the user mentions completing something or making progress toward a goal.",
      parameters: {
        type: "object",
        properties: {
          wishTitle: {
            type: "string",
            description: "The title or partial title of the wish to update.",
          },
          progress: {
            type: "number",
            description: "New progress percentage (0-100).",
          },
          note: {
            type: "string",
            description: "Optional check-in note about this progress update.",
          },
        },
        required: ["wishTitle", "progress"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_wishes",
      description: "List the user's active wishes and goals. Use when the user asks what their goals are, or asks Mirana to brief them on their progress.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["active", "completed", "paused", "all"],
            description: "Filter wishes by status. Default is 'active'.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_wish",
      description: "Mark a wish as fully completed. Use when the user says they've achieved a goal.",
      parameters: {
        type: "object",
        properties: {
          wishTitle: {
            type: "string",
            description: "The title or partial title of the wish to mark complete.",
          },
        },
        required: ["wishTitle"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_reminder",
      description: "Set a reminder notification for the user. Use when the user asks to be reminded about something.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short reminder title." },
          body: { type: "string", description: "Full reminder message." },
        },
        required: ["title", "body"],
      },
    },
  },
];

// ─── Tool Executor ────────────────────────────────────────────────────────────
async function executeTool(toolName, args, user, chatId) {
  console.log(`🛠️ Executing tool: ${toolName}`, args);

  // ── News ──────────────────────────────────────────────────────────────────
  if (toolName === "get_latest_news") {
    const result = await getLatestNews(args.query);
    return JSON.stringify(result);
  }

  // ── Web Search ────────────────────────────────────────────────────────────
  if (toolName === "search_web") {
    try {
      const searchData = await performWebSearch(args.query);
      return JSON.stringify(searchData);
    } catch (error) {
      console.error(`❌ Web search error:`, error.message);
      return JSON.stringify({ status: "error", message: "Failed to fetch web results." });
    }
  }

  // ── Weather ───────────────────────────────────────────────────────────────
  if (toolName === "get_weather") {
    try {
      const apiKey = process.env.OPENWEATHER_API_KEY;
      if (!apiKey) {
        // Fallback: use web search for weather
        const searchResults = await search(`weather in ${args.city} today`);
        const top = searchResults.results.slice(0, 3).map((r) => r.description).join(" | ");
        return JSON.stringify({ status: "fallback", city: args.city, info: top });
      }
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(args.city)}&appid=${apiKey}&units=metric`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("City not found");
      const data = await response.json();
      return JSON.stringify({
        status: "success",
        city: data.name,
        country: data.sys.country,
        temp: data.main.temp,
        feels_like: data.main.feels_like,
        description: data.weather[0].description,
        humidity: data.main.humidity,
        wind_speed: data.wind.speed,
      });
    } catch (error) {
      return JSON.stringify({ status: "error", message: `Could not get weather for ${args.city}.` });
    }
  }

  // ── Time & Date ───────────────────────────────────────────────────────────
  if (toolName === "get_time_date") {
    const now = new Date();
    return JSON.stringify({
      status: "success",
      date: now.toDateString(),
      time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      iso: now.toISOString(),
      dayOfWeek: now.toLocaleDateString("en-US", { weekday: "long" }),
    });
  }

  // ── Create Wish ───────────────────────────────────────────────────────────
  if (toolName === "create_wish") {
    try {
      const wish = await Wish.create({
        userId: user._id,
        title: args.title,
        description: args.description || "",
        category: args.category || "personal",
        priority: args.priority || "medium",
        deadline: args.deadline ? new Date(args.deadline) : null,
      });
      console.log(`⭐ Tool created wish for user ${user._id}: "${wish.title}"`);
      return JSON.stringify({ status: "success", wishId: wish._id, title: wish.title, message: `Wish "${wish.title}" has been created and saved.` });
    } catch (error) {
      return JSON.stringify({ status: "error", message: "Failed to create wish." });
    }
  }

  // ── Update Wish Progress ──────────────────────────────────────────────────
  if (toolName === "update_wish_progress") {
    try {
      // Find wish by partial title match
      const wishes = await Wish.find({ userId: user._id, status: { $in: ["active", "paused"] } });
      const wish = wishes.find((w) =>
        w.title.toLowerCase().includes(args.wishTitle.toLowerCase()) ||
        args.wishTitle.toLowerCase().includes(w.title.toLowerCase().split(" ")[0])
      );
      if (!wish) return JSON.stringify({ status: "error", message: `No active wish matching "${args.wishTitle}" found.` });

      wish.progress = Math.min(100, Math.max(0, Number(args.progress)));
      if (args.note) wish.checkIns.push({ note: args.note, progressAtTime: wish.progress });
      if (wish.progress >= 100) { wish.status = "completed"; wish.completedAt = new Date(); }
      await wish.save();

      return JSON.stringify({ status: "success", title: wish.title, progress: wish.progress, status: wish.status });
    } catch (error) {
      return JSON.stringify({ status: "error", message: "Failed to update wish." });
    }
  }

  // ── List Wishes ───────────────────────────────────────────────────────────
  if (toolName === "list_wishes") {
    try {
      const statusFilter = args.status === "all" ? {} : { status: args.status || "active" };
      const wishes = await Wish.find({ userId: user._id, ...statusFilter })
        .sort({ priority: -1, createdAt: -1 })
        .limit(10)
        .lean();

      if (wishes.length === 0) return JSON.stringify({ status: "success", message: "No wishes found.", wishes: [] });

      return JSON.stringify({
        status: "success",
        count: wishes.length,
        wishes: wishes.map((w) => ({
          id: w._id,
          title: w.title,
          category: w.category,
          priority: w.priority,
          progress: w.progress,
          status: w.status,
          deadline: w.deadline ? new Date(w.deadline).toDateString() : null,
          milestones: w.milestones?.length || 0,
          completedMilestones: w.milestones?.filter((m) => m.done).length || 0,
        })),
      });
    } catch (error) {
      return JSON.stringify({ status: "error", message: "Failed to list wishes." });
    }
  }

  // ── Complete Wish ─────────────────────────────────────────────────────────
  if (toolName === "complete_wish") {
    try {
      const wishes = await Wish.find({ userId: user._id, status: "active" });
      const wish = wishes.find((w) => w.title.toLowerCase().includes(args.wishTitle.toLowerCase()));
      if (!wish) return JSON.stringify({ status: "error", message: `No active wish matching "${args.wishTitle}" found.` });

      wish.status = "completed";
      wish.progress = 100;
      wish.completedAt = new Date();
      await wish.save();

      // Create a milestone notification
      await Notification.create({
        userId: user._id,
        type: "milestone",
        title: "🎉 Goal Achieved!",
        body: `You completed "${wish.title}" — Mirana is proud of you, boss.`,
        wishId: wish._id,
      });

      return JSON.stringify({ status: "success", message: `"${wish.title}" marked as completed!` });
    } catch (error) {
      return JSON.stringify({ status: "error", message: "Failed to complete wish." });
    }
  }

  // ── Set Reminder (stored as a notification) ───────────────────────────────
  if (toolName === "set_reminder") {
    try {
      await Notification.create({
        userId: user._id,
        type: "system",
        title: `🔔 ${args.title}`,
        body: args.body,
      });
      return JSON.stringify({ status: "success", message: `Reminder set: "${args.title}". I'll make sure you don't forget, boss.` });
    } catch (error) {
      return JSON.stringify({ status: "error", message: "Failed to set reminder." });
    }
  }

  // Fallback
  return JSON.stringify({ error: `Tool "${toolName}" not found.` });
}

module.exports = { MIRANA_TOOLS, executeTool };
