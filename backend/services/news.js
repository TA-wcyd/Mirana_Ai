const Parser = require("rss-parser");

// High-fidelity parser that captures MediaRSS namespaces (images)
const parser = new Parser({
  customFields: {
    item: [
      ['media:thumbnail', 'thumbnail'],
      ['media:content', 'mediaContent'],
      ['News:Image', 'bingImage']
    ],
  }
});

/**
 * Merges multiple RSS streams to provide a diverse global perspective (BBC, CNN, Google)
 */
async function getLatestNews(query) {
  try {
    const isSearch = query && query.trim() && query.trim().toLowerCase() !== "world";
    const finalQuery = isSearch ? query.trim() : "";
    
    // Define sources: Google News (aggregated), BBC, and CNN (direct)
    const sources = [
      isSearch 
        ? `https://news.google.com/rss/search?q=${encodeURIComponent(finalQuery)}&hl=en-US&gl=US&ceid=US:en`
        : `https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en`,
      isSearch
        ? `https://www.bing.com/news/search?q=${encodeURIComponent(finalQuery)}&format=rss` 
        : `http://feeds.bbci.co.uk/news/world/rss.xml`,
      !isSearch ? `http://rss.cnn.com/rss/edition.rss` : null
    ].filter(Boolean);

    console.log(`📡 Fetching network feed from ${sources.length} intelligence nodes...`);
    
    const results = await Promise.allSettled(sources.map(url => parser.parseURL(url)));
    
    let allItems = [];
    results.forEach((res, index) => {
      if (res.status === "fulfilled") {
        const urlStr = sources[index].toLowerCase();
        const feedSource = urlStr.includes("bbc") ? "BBC News" : 
                           urlStr.includes("cnn") ? "CNN Intelligence" : 
                           urlStr.includes("bing") ? "Bing Intel" : "Global Network";
        
        const mappedItems = res.value.items.map(item => {
          const titleParts = item.title.split(" - ");
          const sourceName = titleParts.length > 1 ? titleParts.pop() : feedSource;
          const actualTitle = titleParts.join(" - ");

          // Extract real thumbnail from various RSS extensions
          let thumbnail = null;
          if (item.thumbnail && item.thumbnail.$) thumbnail = item.thumbnail.$.url;
          else if (item.mediaContent && item.mediaContent.$) thumbnail = item.mediaContent.$.url;
          else if (item.bingImage) thumbnail = item.bingImage;

          return {
            title: actualTitle || item.title,
            link: item.link,
            pubDate: item.pubDate,
            source: sourceName,
            thumbnail: thumbnail // May be null, frontend will handle fallback
          };
        });
        allItems = [...allItems, ...mappedItems];
      }
    });

    // Remove duplicates by title and sort by most recent 
    const uniqueItems = Array.from(new Map(allItems.map(m => [m.title.toLowerCase().trim(), m])).values());
    const sorted = uniqueItems
      .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
      .slice(0, 18); // Increased density as requested

    return {
      status: "success",
      query: isSearch ? finalQuery : "World Headlines",
      articles: sorted
    };
  } catch (error) {
    console.error(`❌ Global feed failure:`, error.message);
    return {
      status: "error",
      message: "Neural feeds unstable. Re-syncing."
    };
  }
}

module.exports = { getLatestNews };
