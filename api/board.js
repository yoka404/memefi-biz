export const config = { maxDuration: 30 };
import { buildUniverse } from "../lib/indexer.js";
import { fillHolders } from "../lib/blockscout.js";

const YAHOO = ["AMC","NVDA","HIMS","MU","MSTR","TSLA","HOOD","AAPL","GME","SPY","MSFT","AMD","AMZN","META","GOOGL","NFLX","PLTR","INTC","BABA","COIN","RBLX","DJT","GLD","SLV","QQQ","IWM"];
const PIN = "0x385f4f8ae47651ce5f58f5265395a669f8281e18".toLowerCase();
const PIN_GG = "0xcacb0e9caccee63ec4d82952e561a291c68bcb68".toLowerCase();

async function yahoo(symbol) {
  const url = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol) + "?interval=1d&range=5d";
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 memefi.biz" } });
  if (!r.ok) return null;
  const data = await r.json();
  const px = data.chart && data.chart.result && data.chart.result[0] && data.chart.result[0].meta && data.chart.result[0].meta.regularMarketPrice;
  return Number.isFinite(Number(px)) ? Number(px) : null;
}

function pickHolders(c) {
  const n = c.holdersExclPoolManager ?? c.holders ?? c.holdersTotal ?? (c.reported && (c.reported.holdersExclPoolManager || c.reported.holders));
  const x = Number(n);
  return Number.isFinite(x) ? x : null;
}

function slimDump(c, extra) {
  const rep = c.reported || {};
  return Object.assign({
    ticker: c.ticker,
    name: c.name,
    launchpad: c.launchpad,
    address: String(c.address || "").toLowerCase(),
    poolId: c.poolId,
    pair: c.pair,
    price: c.price != null ? c.price : rep.price,
    change24h: c.change24h,
    marketCap: c.marketCap != null ? c.marketCap : rep.marketCap,
    volume24h: c.volume24h,
    stockLockedUnits: c.stockLockedUnits != null ? c.stockLockedUnits : rep.stockLockedUnits,
    stockLockedUsd: c.stockLockedUsd != null ? c.stockLockedUsd : rep.stockLockedUsd,
    holders: pickHolders(c),
    launchedAt: c.launchedAt,
    logo: c.logo || null,
    imageUri: c.imageUri || null,
    flagged: false,
    flag: null
  }, extra || {});
}

function mergeRow(base, live) {
  if (!live) return base;
  return Object.assign({}, base, live, {
    holders: live.holders != null ? live.holders : base.holders,
    stockLockedUnits: live.stockLockedUnits != null ? live.stockLockedUnits : base.stockLockedUnits,
    stockLockedUsd: live.stockLockedUsd != null ? live.stockLockedUsd : base.stockLockedUsd,
    logo: base.logo || live.logo,
    imageUri: base.imageUri || live.imageUri,
    marketCap: live.marketCap != null ? live.marketCap : base.marketCap,
    price: live.price != null ? live.price : base.price,
    volume24h: live.volume24h != null ? live.volume24h : base.volume24h,
    change24h: live.change24h != null ? live.change24h : base.change24h,
    pair: live.pair || base.pair,
    poolId: live.poolId || base.poolId
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=60");
  try {
    let uni = null;
    try { uni = await buildUniverse(); } catch (e) { uni = null; }
    let dump = null;
    try {
      const r = await fetch("https://memefimarketcap.com/data.json", { headers: { "User-Agent": "memefi.biz desk" } });
      if (r.ok) dump = await r.json();
    } catch (e) {}
    const map = {};
    if (dump && dump.coins) {
      for (const c of dump.coins) {
        if (!c || !c.address) continue;
        if (c.listingState && c.listingState !== "listed") continue;
        map[String(c.address).toLowerCase()] = slimDump(c);
      }
    }
    if (dump && dump.anomalies) {
      for (const c of dump.anomalies) {
        if (!c || !c.address) continue;
        const addr = String(c.address).toLowerCase();
        map[addr] = slimDump(c, { flagged: true, flag: c.gate || c.why || "anomalous" });
      }
    }
    for (const c of (uni && uni.coins) || []) {
      const addr = String(c.address || "").toLowerCase();
      if (!addr) continue;
      map[addr] = mergeRow(map[addr] || {}, c);
    }
    if (!map[PIN]) map[PIN] = { ticker: "MEME", name: "A Meme Coin", address: PIN, pair: "AMC", launchpad: "long", flagged: true, flag: "pinned" };
    if (!map[PIN_GG]) map[PIN_GG] = { ticker: "GG", name: "Golden Goose", address: PIN_GG, pair: "GLD", launchpad: "uniswap" };
    const coins = Object.values(map).sort((a, b) => Number(b.marketCap || 0) - Number(a.marketCap || 0));
    await fillHolders(coins.slice(0, 40), 12);
    coins.forEach((c, i) => { c.rank = i + 1; });
    const metals = coins.filter((c) => c.pair === "GLD" || c.pair === "SLV").sort((a, b) => Number(b.marketCap || 0) - Number(a.marketCap || 0));
    const newest = coins.slice().sort((a, b) => String(b.createdAt || b.launchedAt || "").localeCompare(String(a.createdAt || a.launchedAt || ""))).slice(0, 80);
    const quotes = {};
    await Promise.all(YAHOO.map(async (s) => {
      try {
        const px = await yahoo(s);
        if (px != null) quotes[s] = px;
      } catch (e) {}
    }));
    const onchain = Object.assign({}, (uni && uni.onchain) || {});
    if (dump && dump.stocks) {
      for (const [sym, row] of Object.entries(dump.stocks)) {
        if (row && Number.isFinite(Number(row.price)) && onchain[sym] == null) onchain[sym] = Number(row.price);
      }
    }
    res.status(200).json({
      generated: (uni && uni.generated) || (dump && dump.meta && dump.meta.generated),
      source: uni && uni.coins && uni.coins.length ? "memefi-indexer+registry" : "registry",
      wrappers: uni && uni.wrappers,
      aggregates: {
        coins: coins.length,
        listed: coins.length,
        launches: dump && dump.listing && dump.listing.totalLaunchesOnChain,
        metals: metals.length,
        volume24h: coins.reduce((n, c) => n + (Number(c.volume24h) || 0), 0)
      },
      quotes,
      onchain,
      top: coins.slice(0, 250),
      newest,
      metals,
      flagged: coins.filter((c) => c.flagged)
    });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
}
