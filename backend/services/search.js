const axios = require("axios");
const cheerio = require("cheerio");
const { GoogleGenerativeAI } = require("@google/generative-ai");

function cleanText(text) {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim();
}

function unwrapDdgUrl(rawUrl) {
  if (!rawUrl) return "";
  if (rawUrl.includes("uddg=")) {
    const match = rawUrl.match(/uddg=([^&]+)/);
    if (match) {
      try {
        return decodeURIComponent(match[1]);
      } catch (e) {
        return rawUrl;
      }
    }
  }
  if (rawUrl.startsWith("//")) return "https:" + rawUrl;
  return rawUrl;
}

// ─── Extract URL from user input if present ──────────────────────────────────
function extractUrl(text) {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s<>'"]+|www\.[^\s<>'"]+/i);
  if (!match) return null;
  let url = match[0];
  if (url.toLowerCase().startsWith("www.")) {
    url = "https://" + url;
  }
  return url;
}

// ─── Real-time and search query detector ─────────────────────────────────────
const REALTIME_PATTERNS = [
  /\b(score|result|match|won|beat|goal|goals|winner|lost|draw|vs\.?|versus|final|semifinal|quarter.?final|standings|table|fixture|kick.?off|half.?time|full.?time|line.?up|lineup|squad)\b/i,
  /\b(ucl|champions league|premier league|la liga|serie a|bundesliga|ligue1|world cup|euro|fa cup|copa del rey|mls|nba|nfl|ipl|bpl|cricket|tennis|f1|formula 1)\b/i,
  /\b(today|yesterday|tonight|this week|last week|last night|just now|right now|currently|latest|recent|breaking|now|2024|2025|2026)\b/i,
  /\b(price|rate|stock|crypto|bitcoin|btc|eth|ethereum|binance|exchange rate|usd|bdt|eur|gbp|shares|market)\b/i,
  /\b(news|happened|announcement|released|launched|died|elected|arrested|attack|earthquake|flood|war|crisis|summit|update|updates)\b/i,
  /\b(google|search|browse|look up|find out|tell me about|what is the|who won|who beat|what happened|how did .* do|who is|where is|check the web|check online)\b/i,
  /\b(weather|temperature|forecast|rain|sunny|storm|climate)\b/i,
];

function isRealTimeQuery(message) {
  if (!message) return false;
  if (extractUrl(message)) return true;
  return REALTIME_PATTERNS.some((pattern) => pattern.test(message));
}

// ─── Direct Webpage Scraper & Browser ────────────────────────────────────────
async function browseWebsite(rawUrl) {
  try {
    let targetUrl = rawUrl.trim();
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = "https://" + targetUrl;
    }

    console.log(`🌐 Browsing webpage: ${targetUrl}`);
    const res = await axios.get(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 9000,
      maxRedirects: 5,
    });

    const $ = cheerio.load(res.data);
    $("script, style, noscript, svg, nav, footer, header, iframe, form").remove();

    const title = cleanText($("title").text()) || targetUrl;
    const description = cleanText(
      $('meta[name="description"]').attr("content") ||
        $('meta[property="og:description"]').attr("content") ||
        ""
    );

    let text = cleanText($("main, article, #content, .content, body").text());
    if (text.length > 3500) {
      text = text.slice(0, 3500) + "... [content truncated]";
    }

    return {
      status: "success",
      url: targetUrl,
      title,
      description,
      content: text,
      source: "Web Browser",
    };
  } catch (err) {
    console.error(`❌ Browse website error for ${rawUrl}:`, err.message);
    return {
      status: "error",
      url: rawUrl,
      message: `Failed to browse ${rawUrl}: ${err.message}`,
    };
  }
}

// ─── Google News RSS Search (Real-time, zero rate limits) ─────────────────────
async function performGoogleNews(query) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const res = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
      timeout: 7000,
    });
    const $ = cheerio.load(res.data, { xmlMode: true });
    const items = [];

    $("item").each((i, el) => {
      if (items.length >= 6) return;
      const title = $(el).find("title").text().trim();
      const link = $(el).find("link").text().trim();
      const source = $(el).find("source").text().trim() || "Google News";
      const pubDate = $(el).find("pubDate").text().trim();
      const rawDesc = $(el).find("description").text();
      const snippet = cleanText(rawDesc.replace(/<[^>]+>/g, "")) || pubDate;

      if (title && link) {
        items.push({
          title,
          url: link,
          snippet,
          source: `Google News (${source})`,
        });
      }
    });

    return items;
  } catch (err) {
    console.error("❌ Google News RSS error:", err.message);
    return [];
  }
}

// ─── DuckDuckGo HTML Scraper ──────────────────────────────────────────────────
async function performDuckDuckGo(query) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 7000,
    });

    const $ = cheerio.load(data);
    const results = [];

    $(".result").each((i, el) => {
      if (results.length >= 6) return;
      const title = $(el).find(".result__title a").text().trim();
      const snippet = $(el).find(".result__snippet").text().trim();
      const rawLink =
        $(el).find(".result__url").attr("href") ||
        $(el).find(".result__title a").attr("href") ||
        "";
      const url = unwrapDdgUrl(rawLink);

      if (title && snippet && url) {
        results.push({
          title,
          url,
          snippet,
          source: "DuckDuckGo",
        });
      }
    });

    return results;
  } catch (err) {
    console.error("❌ DuckDuckGo HTML error:", err.message);
    return [];
  }
}

// ─── Wikipedia Search ────────────────────────────────────────────────────────
async function performWikipedia(query) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&format=json&utf8=`;
    const res = await axios.get(url, {
      headers: { "User-Agent": "MiranaAI/2.0 (personal AI assistant)" },
      timeout: 5000,
    });
    const items = (res.data?.query?.search || []).slice(0, 3).map((item) => ({
      title: item.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(
        item.title.replace(/ /g, "_")
      )}`,
      snippet: cleanText(item.snippet.replace(/<[^>]+>/g, "")),
      source: "Wikipedia",
    }));
    return items;
  } catch (err) {
    return [];
  }
}

// ─── Google Search via Gemini Grounding (with fallback) ───────────────────────
async function performGoogleSearch(query) {
  if (!process.env.GEMINI_API_KEY) return null;
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      tools: [{ googleSearch: {} }],
    });
    const res = await model.generateContent(
      `Search Google and provide concise factual real-time details for: "${query}".`
    );
    const summary = res.response.text();
    const candidate = res.response.candidates?.[0];
    const grounding = candidate?.groundingMetadata;

    const results = [];
    if (grounding?.groundingChunks) {
      grounding.groundingChunks.forEach((chunk) => {
        if (chunk.web?.uri && chunk.web?.title) {
          results.push({
            title: chunk.web.title,
            url: chunk.web.uri,
            snippet: summary.slice(0, 200) + "...",
            source: "Google Search",
          });
        }
      });
    }

    if (results.length > 0) {
      return {
        status: "success",
        source: "google",
        query,
        summary,
        results: results.slice(0, 6),
      };
    }
    return null;
  } catch (e) {
    // Quota reached or model error -> fall back smoothly
    return null;
  }
}

// ─── Unified Multi-Engine Web Search ─────────────────────────────────────────
async function performUnifiedWebSearch(query) {
  console.log(`🔍 Executing Unified Web Search for: "${query}"`);

  // 1. Try Google Search Grounding first
  const googleRes = await performGoogleSearch(query);
  if (googleRes && googleRes.results?.length > 0) {
    return googleRes;
  }

  // 2. Multi-engine parallel fallback: Google News + DuckDuckGo + Wikipedia
  const [newsResults, ddgResults, wikiResults] = await Promise.all([
    performGoogleNews(query),
    performDuckDuckGo(query),
    performWikipedia(query),
  ]);

  const combined = [];
  const seenUrls = new Set();
  for (const item of [...newsResults, ...ddgResults, ...wikiResults]) {
    if (item.url && !seenUrls.has(item.url)) {
      seenUrls.add(item.url);
      combined.push(item);
    }
  }

  if (combined.length > 0) {
    return {
      status: "success",
      source: "google_and_web",
      query,
      results: combined.slice(0, 6),
    };
  }

  return {
    status: "error",
    query,
    message: "No search results found.",
    results: [],
  };
}

// Backward-compatibility alias
const performWebSearch = performUnifiedWebSearch;

// ─── Force-inject real-time context before LLM call ──────────────────────────
async function injectWebContext(message) {
  try {
    const url = extractUrl(message);

    // If message contains a URL, browse that webpage directly!
    if (url) {
      console.log(`🌐 Scraping direct webpage for: ${url}`);
      const pageData = await browseWebsite(url);
      if (pageData.status === "success") {
        const contextText = `[SYSTEM NOTE - WEBPAGE CONTENT RETRIEVED]\nURL: ${pageData.url}\nTitle: "${pageData.title}"\nDescription: "${pageData.description}"\n\nPage Content:\n${pageData.content}\n\nUse this content to answer the user accurately.`;
        const searchResults = [
          {
            title: pageData.title,
            url: pageData.url,
            snippet: pageData.description || pageData.content.slice(0, 180) + "...",
            source: "Web Page",
          },
        ];
        return {
          contextText,
          searchResults,
          searchQuery: url,
          browsedUrl: pageData.url,
        };
      }
    }

    // Otherwise, clean query and perform multi-engine search
    const cleanedQuery = message
      .replace(/mirana|hey|can you|tell me|search google for|search for|browse|look up/gi, "")
      .trim();
    const searchQuery = cleanedQuery || message;

    const data = await performUnifiedWebSearch(searchQuery);
    if (data.status === "error" || !data.results?.length) return null;

    const lines = data.results
      .map((r) => `• [${r.source}] ${r.title}: ${r.snippet} (Link: ${r.url})`)
      .join("\n");

    const contextText = `[SYSTEM NOTE - LIVE GOOGLE & WEB SEARCH DATA Retrieved at ${new Date().toLocaleString()}]\nQuery: "${searchQuery}"\n\nResults:\n${lines}\n\nUse this live data to give an accurate, up-to-date answer. If asked, mention the sources.`;

    return {
      contextText,
      searchResults: data.results,
      searchQuery,
      source: data.source,
    };
  } catch (err) {
    console.error(`❌ Web context injection failed:`, err.message);
    return null;
  }
}

module.exports = {
  performGoogleSearch,
  performDuckDuckGo,
  performGoogleNews,
  performWikipedia,
  browseWebsite,
  performUnifiedWebSearch,
  performWebSearch,
  isRealTimeQuery,
  extractUrl,
  injectWebContext,
};
