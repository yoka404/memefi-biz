export const config = { maxDuration: 20 };

const FEEDS = [
  { source: "Google News", url: "https://news.google.com/rss/search?q=stock-paired+memecoin+OR+%22tokenized+stock%22+meme+OR+Robinhood+Chain+memecoin&hl=en-US&gl=US&ceid=US:en" },
  { source: "Google News", url: "https://news.google.com/rss/search?q=memefi+OR+%22tokenized+gold%22+memecoin+OR+GLD+memecoin+Robinhood&hl=en-US&gl=US&ceid=US:en" },
  { source: "Decrypt", url: "https://decrypt.co/feed" },
  { source: "The Block", url: "https://www.theblock.co/rss.xml" },
  { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { source: "Cointelegraph", url: "https://cointelegraph.com/rss" }
];

const FALLBACK = [
  { source: "Decrypt", title: "BONER absorbed more than half of tokenized HIMS over a closed session.", blurb: "The cash stock barely moved when the tape reopened.", url: "https://decrypt.co/377463/crypto-meme-coin-stock-pairs-robinhood", score: 9 },
  { source: "Bankless", title: "Cornering the wrapper does not corner the listed share.", blurb: "Scale versus NYSE float remains the binding constraint.", url: "https://www.bankless.com/read/the-stock-paired-memecoin-squeeze-is-a-lie", score: 9 },
  { source: "DefiPrime", title: "Quoted in Nvidia: the stock-paired memecoin boom, measured on-chain.", blurb: "AI/NVDA remains the deepest semiconductor pair.", url: "https://defiprime.com/stock-paired-memecoins", score: 8 },
  { source: "The Block", title: "A Farmmi pairing spilled into the Nasdaq tape.", blurb: "Microcap cash prints are a different risk than NVDA or AMC.", url: "https://www.theblock.co/news/markets/2026-09-02-memecoin-shenanigans-nasdaq-microcap-mushroom-seller-farmmi-413374", score: 8 },
  { source: "memecoin.wiki", title: "Memefi as an era label, distinct from the 2024 Telegram game.", blurb: "The slogan predates most of the Robinhood pairs.", url: "https://memecoin.wiki/wiki/memefi", score: 6 }
];

function tag(block, name) {
  const cdata = block.match(new RegExp("<" + name + ">\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>", "i"));
  if (cdata) return cdata[1].trim();
  const plain = block.match(new RegExp("<" + name + ">([\\s\\S]*?)</" + name + ">", "i"));
  return plain ? plain[1].trim() : "";
}
function strip(html) {
  return String(html || "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
function score(title, desc) {
  const t = (title + " " + desc).toLowerCase();
  let s = 0;
  if (/stock[- ]paired|tokenized stock|tokenised stock/.test(t)) s += 8;
  if (/robinhood chain|tokenized (equity|share|etf|metal|gold|silver)/.test(t)) s += 6;
  if (/\bmemefi\b|meme\.fi/.test(t)) s += 7;
  if (/\b(nvda|amc|gld|slv|hood|hims|gme|mstr)\b/.test(t) && /meme/.test(t)) s += 5;
  if (/memecoin|meme coin/.test(t)) s += 2;
  if (/wrapper|premium|depeg|cash close/.test(t)) s += 3;
  if (/bitcoin|ethereum only|nft drop/.test(t) && s < 4) s -= 3;
  return s;
}
function parseFeed(xml, fallbackSource) {
  const out = [];
  const chunks = String(xml).split(/<item[\s>]/i).slice(1);
  for (const chunk of chunks) {
    const title = strip(tag(chunk, "title"));
    let link = strip(tag(chunk, "link"));
    if (!link) {
      const alt = chunk.match(/<link[^>]+href="([^"]+)"/i);
      if (alt) link = alt[1];
    }
    const desc = strip(tag(chunk, "description")).slice(0, 220);
    if (!title || !link) continue;
    let source = fallbackSource;
    const dash = title.match(/\s[-\u2013]\s([^\-\u2013]+)$/);
    if (fallbackSource === "Google News" && dash) {
      source = dash[1].trim();
    }
    out.push({
      source,
      title: title.replace(/\s[-\u2013]\s[^\-\u2013]+$/, "").trim(),
      blurb: desc || "Open web brief.",
      url: link,
      published: strip(tag(chunk, "pubDate")),
      score: score(title, desc)
    });
  }
  return out;
}

async function pull(feed) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(feed.url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "memefi.biz wire/1.0", Accept: "application/rss+xml, application/xml, text/xml" }
    });
    if (!r.ok) return [];
    const xml = await r.text();
    return parseFeed(xml, feed.source);
  } catch (e) {
    return [];
  } finally {
    clearTimeout(t);
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=180, stale-while-revalidate=600");
  const bags = await Promise.all(FEEDS.map(pull));
  const seen = new Set();
  const mixed = bags.flat().filter((row) => {
    const key = (row.title || "").toLowerCase().slice(0, 80);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return row.score >= 4;
  });
  mixed.sort((a, b) => b.score - a.score);
  const items = (mixed.length ? mixed : FALLBACK).slice(0, 8);
  res.status(200).json({ generated: new Date().toISOString(), items });
}
