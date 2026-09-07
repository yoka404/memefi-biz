export const config = { maxDuration: 20 };

const FEEDS = [
  { source: "Decrypt", url: "https://decrypt.co/feed" },
  { source: "The Block", url: "https://www.theblock.co/rss.xml" },
  { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { source: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  { source: "Blockworks", url: "https://blockworks.co/feed" },
  { source: "The Defiant", url: "https://thedefiant.io/feed" },
  { source: "crypto.news", url: "https://crypto.news/feed" },
  { source: "DL News", url: "https://www.dlnews.com/arc/outboundfeeds/rss/" },
  { source: "Bankless", url: "https://www.bankless.com/feed" },
  { source: "BeInCrypto", url: "https://beincrypto.com/feed/" },
  { source: "Yahoo Finance", url: "https://finance.yahoo.com/news/rssindex" },
  { source: "MarketWatch", url: "https://www.marketwatch.com/rss/topstories" },
  { source: "RH tape", url: "https://news.google.com/rss/search?q=Robinhood+Chain+OR+%22tokenized+stocks%22+OR+%22stock+tokens%22+OR+memefi+OR+%22meme+stock%22&hl=en-US&gl=US&ceid=US:en" },
  { source: "RWA desk", url: "https://news.google.com/rss/search?q=RWA+OR+%22real+world+assets%22+OR+tokenization+crypto+OR+xStocks&hl=en-US&gl=US&ceid=US:en" },
  { source: "Meme tape", url: "https://news.google.com/rss/search?q=memecoin+OR+%22meme+coin%22+Robinhood+OR+Pons+OR+%22pair.fund%22&hl=en-US&gl=US&ceid=US:en" }
];

const FALLBACK = [
  { source: "Decrypt", title: "BONER absorbed more than half of tokenized HIMS over a closed session.", blurb: "The cash stock barely moved when the tape reopened.", url: "https://decrypt.co/377463/crypto-meme-coin-stock-pairs-robinhood", score: 9 },
  { source: "Bankless", title: "Cornering the wrapper does not corner the listed share.", blurb: "Scale versus NYSE float remains the binding constraint.", url: "https://www.bankless.com/read/the-stock-paired-memecoin-squeeze-is-a-lie", score: 9 },
  { source: "DefiPrime", title: "Quoted in Nvidia: the stock-paired memecoin boom, measured on-chain.", blurb: "AI/NVDA remains the deepest semiconductor pair.", url: "https://defiprime.com/stock-paired-memecoins", score: 8 }
];

function decode(html) {
  return String(html || "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&/g, "&")
    .replace(/"/g, '"')
    .replace(/&#39;|'/g, "'")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}
function strip(html) {
  return decode(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function tag(block, name) {
  const cdata = block.match(new RegExp("<" + name + ">\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>", "i"));
  if (cdata) return cdata[1].trim();
  const plain = block.match(new RegExp("<" + name + ">([\\s\\S]*?)</" + name + ">", "i"));
  return plain ? plain[1].trim() : "";
}
function isHome(url) {
  try {
    const u = new URL(url);
    const path = (u.pathname || "/").replace(/\/+$/, "") || "/";
    return path === "/" || path === "/news" || path === "/en" || path === "/home";
  } catch (e) {
    return true;
  }
}
function badImage(url) {
  const u = String(url || "").toLowerCase();
  if (!/^https?:/.test(u)) return true;
  if (/news\.google|google\.com\/images|gstatic\.com|googleusercontent\.com\/icon/.test(u)) return true;
  if (/favicon|default-logo|og-banners\/home|\/logo\.|sprite|placeholder/.test(u)) return true;
  return false;
}
function pickImage(chunk) {
  const hits = [];
  const media = String(chunk).matchAll(/<(?:media:content|media:thumbnail|enclosure)[^>]+(?:url|href)=["']([^"']+)["']/ig);
  for (const m of media) hits.push(decode(m[1]));
  const imgs = String(chunk).matchAll(/<img[^>]+src=["']([^"']+)["']/ig);
  for (const m of imgs) hits.push(decode(m[1]));
  return hits.find((u) => !badImage(u)) || null;
}
function articleUrl(chunk, link) {
  const raw = decode(chunk || "");
  const item = String(link || "").trim();
  if (/news\.google\.com\/rss\/articles\//.test(item)) return item;
  const urls = raw.match(/https?:\/\/[^\s"'<>]+/g) || [];
  const g = urls.find((u) => /news\.google\.com\/rss\/articles\//.test(u));
  if (g) return g.replace(/[.,)]+$/, "");
  const deep = urls.find((u) => !/news\.google|google\.com\/rss/.test(u) && !isHome(u));
  if (deep) return deep.replace(/[.,)]+$/, "");
  if (item && !isHome(item)) return item;
  return item || null;
}
function score(title, desc, source) {
  const t = (title + " " + desc + " " + source).toLowerCase();
  let s = 1;
  if (/stock[- ]paired|tokenized stock|tokenised stock|stock token/.test(t)) s += 8;
  if (/robinhood chain|tokenized (equity|share|etf|metal|gold|silver)/.test(t)) s += 6;
  if (/\bmemefi\b|meme\.fi/.test(t)) s += 7;
  if (/\b(nvda|amc|gld|slv|hood|hims|gme|mstr|tsla|spy)\b/.test(t)) s += 3;
  if (/rwa|real[- ]world asset|tokeniz/.test(t)) s += 4;
  if (/memecoin|meme coin|meme stock/.test(t)) s += 3;
  if (/rumor|rumour|unconfirmed|sources say|reportedly|whisper|leak/.test(t)) s += 3;
  if (/wrapper|premium|depeg|cash close|weekend/.test(t)) s += 3;
  if (/bitcoin|ethereum|solana|crypto|defi|etf/.test(t)) s += 1;
  if (/nft drop|airdrop claim|giveaway|sponsored/.test(t) && s < 5) s -= 4;
  return s;
}
function parseFeed(xml, fallbackSource) {
  const out = [];
  const chunks = String(xml).split(/<item[\s>]/i).slice(1);
  for (const chunk of chunks) {
    let title = strip(tag(chunk, "title"));
    let link = strip(tag(chunk, "link"));
    if (!link) {
      const alt = chunk.match(/<link[^>]+href="([^"]+)"/i);
      if (alt) link = alt[1];
    }
    const descRaw = tag(chunk, "description");
    const url = articleUrl(descRaw + " " + chunk, link);
    if (!title || !url || isHome(url)) continue;
    let sourceName = strip(tag(chunk, "source")) || fallbackSource;
    const split = title.match(/^(.*)\s[-|\u2013]\s([^\-]{2,40})$/);
    if (split && /google|tape|desk/i.test(fallbackSource)) {
      title = split[1].trim();
      sourceName = split[2].trim() || sourceName;
    }
    const desc = strip(descRaw).replace(/^https?:\/\/\S+$/, "").slice(0, 180);
    const blurb = desc && !/^https?:|^href=|^<a /i.test(desc) ? desc : "";
    out.push({
      source: sourceName.replace(/ - Google News$/i, "") || fallbackSource,
      title,
      blurb,
      url,
      image: pickImage(chunk),
      published: strip(tag(chunk, "pubDate")),
      score: score(title, desc, sourceName + " " + fallbackSource)
    });
  }
  return out;
}
async function pull(feed) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6500);
  try {
    const r = await fetch(feed.url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "memefi.biz wire/1.4", Accept: "application/rss+xml, application/xml, text/xml" }
    });
    if (!r.ok) return [];
    return parseFeed(await r.text(), feed.source);
  } catch (e) {
    return [];
  } finally {
    clearTimeout(t);
  }
}
async function ogImage(url) {
  if (!url || /news\.google/.test(url) || isHome(url)) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2200);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 memefi.biz", Accept: "text/html" },
      redirect: "follow"
    });
    if (!r.ok) return null;
    const html = await r.text();
    const og = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i) || html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    const img = og && og[1];
    return img && !badImage(img) ? img : null;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=90, stale-while-revalidate=400");
  const bags = await Promise.all(FEEDS.map(pull));
  const seen = new Set();
  const mixed = bags.flat().filter((row) => {
    const key = (row.title || "").toLowerCase().slice(0, 80);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    if (!row.url || isHome(row.url)) return false;
    return row.score >= 1;
  });
  mixed.sort((a, b) => b.score - a.score || ((b.image ? 1 : 0) - (a.image ? 1 : 0)));
  const items = (mixed.length ? mixed : FALLBACK).slice(0, 24);
  await Promise.all(items.slice(0, 12).map(async (it) => {
    if (it.image && !badImage(it.image)) return;
    it.image = await ogImage(it.url);
  }));
  res.status(200).json({ generated: new Date().toISOString(), items });
}
