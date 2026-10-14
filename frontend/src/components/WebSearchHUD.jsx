import React, { useState } from "react";

function getDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace("www.", "");
  } catch (e) {
    return "web";
  }
}

function getFavicon(url) {
  try {
    const parsed = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=32`;
  } catch (e) {
    return null;
  }
}

export function WebSearchHUD({ query, results = [], onBrowseUrl, isSpeaking = false }) {
  const [expanded, setExpanded] = useState(true);

  if (!results || results.length === 0) return null;

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setExpanded((prev) => !prev)}>
        <div style={styles.headerLeft}>
          <div style={styles.pulseDot} />
          <span style={styles.headerIcon}>🌐</span>
          <span style={styles.headerTitle}>GOOGLE & WEB RESULTS</span>
          {query && <span style={styles.queryTag}>"{query.slice(0, 35)}{query.length > 35 ? "…" : ""}"</span>}
        </div>
        <div style={styles.headerRight}>
          {isSpeaking && (
            <span style={styles.speakingBadge}>
              <span style={styles.waveBar} />
              <span style={{ ...styles.waveBar, animationDelay: "0.2s" }} />
              <span style={{ ...styles.waveBar, animationDelay: "0.4s" }} />
              TALKING
            </span>
          )}
          <span style={styles.countBadge}>{results.length} SOURCES</span>
          <button style={styles.toggleBtn} type="button">
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={styles.cardsGrid}>
          {results.map((item, idx) => {
            const domain = getDomain(item.url);
            const favicon = getFavicon(item.url);
            return (
              <div key={idx} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div style={styles.domainWrap}>
                    {favicon && (
                      <img
                        src={favicon}
                        alt=""
                        style={styles.favicon}
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    )}
                    <span style={styles.domainText}>{domain}</span>
                  </div>
                  {item.source && <span style={styles.sourceTag}>{item.source}</span>}
                </div>

                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.cardTitle}
                  title="Open source in new tab"
                >
                  {item.title} <span style={styles.externalArrow}>↗</span>
                </a>

                {item.snippet && (
                  <p style={styles.cardSnippet}>
                    {item.snippet.slice(0, 160)}
                    {item.snippet.length > 160 ? "…" : ""}
                  </p>
                )}

                <div style={styles.cardFooter}>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.openLinkBtn}
                  >
                    Open Link ↗
                  </a>
                  {onBrowseUrl && (
                    <button
                      type="button"
                      style={styles.browseBtn}
                      onClick={() => onBrowseUrl(item.url)}
                      title="Ask Mirana to browse and analyze this full page"
                    >
                      Browse Page 🔍
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    margin: "8px 0 12px 0",
    borderRadius: "12px",
    background: "linear-gradient(135deg, rgba(0, 25, 45, 0.85) 0%, rgba(0, 15, 30, 0.95) 100%)",
    border: "1px solid rgba(0, 212, 255, 0.25)",
    boxShadow: "0 4px 20px rgba(0, 212, 255, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
    overflow: "hidden",
    backdropFilter: "blur(12px)",
    maxWidth: "100%",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "9px 14px",
    background: "rgba(0, 212, 255, 0.06)",
    borderBottom: "1px solid rgba(0, 212, 255, 0.12)",
    cursor: "pointer",
    userSelect: "none",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
  },
  pulseDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: "#00d4ff",
    boxShadow: "0 0 8px #00d4ff",
    flexShrink: 0,
  },
  headerIcon: {
    fontSize: "14px",
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1.2px",
    color: "#00d4ff",
    whiteSpace: "nowrap",
  },
  queryTag: {
    fontSize: "11px",
    color: "#7dd3fc",
    opacity: 0.85,
    fontStyle: "italic",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexShrink: 0,
  },
  speakingBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "0.8px",
    color: "#34d399",
    background: "rgba(52, 211, 153, 0.12)",
    border: "1px solid rgba(52, 211, 153, 0.3)",
    padding: "2px 7px",
    borderRadius: "20px",
  },
  waveBar: {
    width: "2px",
    height: "8px",
    background: "#34d399",
    borderRadius: "1px",
    animation: "miranaPulse 0.8s infinite ease-in-out",
  },
  countBadge: {
    fontSize: "10px",
    fontWeight: "600",
    letterSpacing: "0.6px",
    color: "#94a3b8",
    background: "rgba(255, 255, 255, 0.05)",
    padding: "2px 6px",
    borderRadius: "4px",
  },
  toggleBtn: {
    background: "transparent",
    border: "none",
    color: "#00d4ff",
    fontSize: "10px",
    cursor: "pointer",
    padding: "2px 4px",
  },
  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: "10px",
    padding: "12px",
  },
  card: {
    background: "rgba(0, 10, 20, 0.65)",
    border: "1px solid rgba(0, 212, 255, 0.15)",
    borderRadius: "8px",
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    transition: "border-color 0.2s, transform 0.2s",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "6px",
  },
  domainWrap: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    overflow: "hidden",
  },
  favicon: {
    width: "14px",
    height: "14px",
    borderRadius: "2px",
    flexShrink: 0,
  },
  domainText: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#38bdf8",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  sourceTag: {
    fontSize: "9px",
    color: "#94a3b8",
    background: "rgba(255, 255, 255, 0.05)",
    padding: "1px 5px",
    borderRadius: "3px",
    whiteSpace: "nowrap",
  },
  cardTitle: {
    fontSize: "12.5px",
    fontWeight: "600",
    color: "#f1f5f9",
    textDecoration: "none",
    lineHeight: "1.35",
    marginBottom: "5px",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  externalArrow: {
    fontSize: "11px",
    color: "#00d4ff",
    opacity: 0.8,
  },
  cardSnippet: {
    fontSize: "11px",
    color: "#94a3b8",
    lineHeight: "1.4",
    margin: "0 0 10px 0",
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  cardFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "6px",
    paddingTop: "6px",
    borderTop: "1px solid rgba(255, 255, 255, 0.06)",
  },
  openLinkBtn: {
    fontSize: "10.5px",
    color: "#00d4ff",
    textDecoration: "none",
    fontWeight: "600",
  },
  browseBtn: {
    background: "rgba(0, 212, 255, 0.1)",
    border: "1px solid rgba(0, 212, 255, 0.25)",
    color: "#7dd3fc",
    fontSize: "10px",
    padding: "3px 7px",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "background 0.2s",
  },
};
