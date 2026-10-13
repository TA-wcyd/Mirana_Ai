const axios = require("axios");
const cheerio = require("cheerio");

// ─── Real-time query detector ─────────────────────────────────────────────────
const REALTIME_PATTERNS = [
  /\b(score|result|match|won|beat|goal|goals|winner|lost|draw|vs\.?|versus|final|semifinal|quarter.?final|standings|table|fixture|kick.?off|half.?time|full.?time|line.?up|lineup|squad)\b/i,
  /\b(ucl|champions league|premier league|la liga|serie a|bundesliga|ligue1|world cup|euro|fa cup|copa del rey|mls|nba|nfl|ipl|bpl)\b/i,
  /\b(today|yesterday|tonight|this week|last week|last night|just now|right now|currently|latest|recent|breaking|now|2024|2025|2026)\b/i,
  /\b(price|rate|stock|crypto|bitcoin|eth|binance|exchange rate|usd|bdt|eur|gbp)\b/i,
  /\b(news|happened|announcement|released|launched|died|elected|arrested|attack|earthquake|flood|war|crisis|summit)\b/i,
  /\b(search|look up|find out|tell me about|what is the|who won|who beat|what happened|how did .* do)\b/i,
];

function isRealTimeQuery(message) {
  return REALTIME_PATTERNS.some((pattern) => pattern.test(message));
}

// ─── Custom robust DuckDuckGo HTML Scraper ──────────────────────────────────
async function performWebSearch(query) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      timeout: 8000,
    });

    const $ = cheerio.load(data);
    let results = [];

    $('.result').each((i, el) => {
      if (results.length >= 5) return;
      
      const title = $(el).find('.result__title a').text().trim();
      const snippet = $(el).find('.result__snippet').text().trim();
      const link = $(el).find('.result__url').attr('href') || "";

      if (title && snippet) {
        results.push({ title, snippet, url: link });
      }
    });

    if (!results.length) throw new Error("No results found on DDG HTML.");

    return {
      status: "success",
      source: "duckduckgo_html",
      query,
      retrievedAt: new Date().toISOString(),
      results,
    };
  } catch (e) {
    console.error(`❌ Web Search failed for "${query}":`, e.message);
    return { status: "error", query, message: "Search unavailable right now." };
  }
}

// ─── Force-inject real-time context before Groq call ─────────────────────────
async function injectWebContext(message) {
  try {
    console.log(`🌐 Scraping Web Context for: "${message.slice(0, 60)}"`);
    const searchQuery = message.replace(/mirana|hey|can you|tell me/gi, "").trim();
    
    const data = await performWebSearch(searchQuery);
    if (data.status === "error") return null;

    const lines = data.results.map((r) => `• ${r.title}: ${r.snippet}`).join("\n");
    return `[SYSTEM NOTE - LIVE WEB SEARCH DATA Retrieved at ${new Date().toLocaleString()}]\nQuery: "${data.query}"\n\nResults:\n${lines}\n\nUse this data to give an accurate, up-to-date answer. Do not say you don't know if the data is provided in these results.`;
  } catch (err) {
    console.error(`❌ Web context injection failed:`, err.message);
    return null;
  }
}

module.exports = { performWebSearch, isRealTimeQuery, injectWebContext };
