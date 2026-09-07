export const config = { maxDuration: 20 };

const FEEDS = [
  { source: "Decrypt", url: "https://decrypt.co/feed" },
  { source: "The Block", url: "https://www.theblock.co/rss.xml" },
  { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { source: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  { source: "Yahoo Finance", url: "https://finance.yahoo.com/news/rssindex" }
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
    .replace(/>/g, ">");
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
function badImage(url) {
  const u = String(url || "").toLowerCase();
  if (!/^https?:/.test(u)) return true;
  if (/news\.google|google\.com\/images|gstatic\.com|googleusercontent\.com\/icon|favicon|logo.*google|\/logo\./.test(u)) return true;
  if (/\.(svg)(\?|$)/.test(u) && /google|mexc/.test(u)) return true;
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
function publisherUrl(chunk, link) {
  const raw = decode(chunk);
  const urls = raw.match(/https?:\/\/[^\s"'<>]+/g) || [];
  const real = urls.find((u) => !/news\.google|google\.com\/rss/.test(u));
  if (real) return real.replace(/[.,)]+$/, "");
  return link;
}
function score(title, desc, source) {
  const t = (title + " " + desc + " " + source).toLowerCase();
  let s = 0;
  if (/stock[- ]paired|tokenized stock|tokenised stock/.test(t)) s += 8;
  if (/robinhood chain|tokenized (equity|share|etf|metal|gold|silver)/.test(t)) s += 6;
  if (/\bmemefi\b|meme\.fi/.test(t)) s += 7;
  if (/\b(nvda|amc|gld|slv|hood|hims|gme|mstr)\b/.test(t) && /meme|token/.test(t)) s += 5;
  if (/memecoin|meme coin|tokenized/.test(t)) s += 2;
  if (/wrapper|premium|depeg|cash close/.test(t)) s += 3;
  if (/bitcoin etf only|nft drop|airdrop/.test(t) && s < 4) s -= 3;
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
    if (!title || !link) continue;
    const descRaw = tag(chunk, "description");
    const desc = strip(descRaw).replace(/^https?:\/\/\S+$/, "").slice(0, 180);
    const url = publisherUrl(descRaw + " " + chunk, link);
    out.push({
      source: fallbackSource,
      title,
      blurb: desc && !desc.startsWith("<") && !/^href=/.test(desc) ? desc : "",
      url,
      image: pickImage(chunk),
      published: strip(tag(chunk, "pubDate")),
      score: score(title, desc, fallbackSource)
    });
  }
  return out;
}
async function pull(feed) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const r = await fetch(feed.url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "memefi.biz wire/1.2", Accept: "application/rss+xml, application/xml, text/xml" }
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
  if (!url || /news\.google/.test(url)) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 memefi.biz", Accept: "text/html" }
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
  res.setHeader("Cache-Control", "s-maxage=180, stale-while-revalidate=600");
  const bags = await Promise.all(FEEDS.map(pull));
  const seen = new Set();
  const mixed = bags.flat().filter((row) => {
    const key = (row.title || "").toLowerCase().slice(0, 80);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return row.score >= 2;
  });
  mixed.sort((a, b) => b.score - a.score || ((b.image ? 1 : 0) - (a.image ? 1 : 0)));
  const items = (mixed.length ? mixed : FALLBACK).slice(0, 10);
  await Promise.all(items.map(async (it) => {
    if (it.image && !badImage(it.image)) return;
    it.image = await ogImage(it.url);
  }));
  res.status(200).json({ generated: new Date().toISOString(), items });
}
