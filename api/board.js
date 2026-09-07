export const config = { maxDuration: 30 };
import { buildUniverse } from "../lib/indexer.js";
import { fillHolders } from "../lib/blockscout.js";
import { fillPads } from "../lib/airlock.js";
import { fillDex } from "../lib/dex.js";
import { padGroup } from "../lib/pads.js";

const YAHOO = ["AMC","NVDA","HIMS","MU","MSTR","TSLA","HOOD","AAPL","GME","SPY","MSFT","AMD","AMZN","META","GOOGL","NFLX","PLTR","INTC","BABA","COIN","RBLX","DJT","GLD","SLV","QQQ","IWM","COST","LLY","BB"];
const PIN = "0x385f4f8ae47651ce5f58f5265395a669f8281e18".toLowerCase();
const PIN_GG = "0xcacb0e9caccee63ec4d82952e561a291c68bcb68".toLowerCase();
const PIN_BONER = "0x98096d17e191b3da1d5f99a6d7b3584351b11e18".toLowerCase();
const JUNK = /^(test|asdf|qwer|xxxx|zzzz|aaaa|abcd|foo|bar|xxx)/i;
const TRUSTED = new Set(["long", "bankr", "feel", "flap", "pons"]);
const MOVER_FLOOR = 3e6;

async function yahoo(symbol) {
  const url = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol) + "?interval=1d&range=5d";
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 memefi.biz" } });
  if (!r.ok) return null;
  const data = await r.json();
  const px = data.chart && data.chart.result && data.chart.result[0] && data.chart.result[0].meta && data.chart.result[0].meta.regularMarketPrice;
  return Number.isFinite(Number(px)) ? Number(px) : null;
}

function looksScam(c) {
  if (!c) return true;
  if (c.address === PIN || c.address === PIN_GG || c.address === PIN_BONER) return false;
  const tick = String(c.ticker || "");
  const name = String(c.name || "").replace(/\s+/g, "");
  if (JUNK.test(tick) || JUNK.test(name)) return true;
  if (/testasdas|asdasd|qwerty|aaaaaa/i.test(tick + name)) return true;
  const mcap = Number(c.marketCap);
  const liq = Number(c.liquidityUsd);
  const trusted = TRUSTED.has(padGroup(c.launchpad));
  if (Number.isFinite(mcap) && mcap > 1e9) return true;
  if (Number.isFinite(liq) && liq > 0 && liq < 100 && Number.isFinite(mcap) && mcap > 1e6 && !trusted) return true;
  return false;
}

function isTrusted(c) {
  if (!c) return false;
  if (c.address === PIN || c.address === PIN_GG || c.address === PIN_BONER) return true;
  return TRUSTED.has(padGroup(c.launchpad));
}

function buildLogos(rh) {
  const out = {};
  const keys = new Set(Object.keys(rh || {}));
  for (const s of YAHOO) keys.add(s);
  for (const sym of keys) {
    out[sym] = {
      stock: "https://financialmodelingprep.com/image-stock/" + encodeURIComponent(sym) + ".png",
      rh: rh && rh[sym] ? rh[sym] : null
    };
  }
  return out;
}

function lite(c) {
  return {
    ticker: c.ticker,
    name: c.name,
    address: c.address,
    pair: c.pair,
    price: c.price,
    marketCap: c.marketCap,
    change24h: c.change24h,
    stockLockedUsd: c.stockLockedUsd,
    stockLockedUnits: c.stockLockedUnits,
    dexImage: c.dexImage || null
  };
}

function buildSnapshot(uni, trusted) {
  const lockedUsd = trusted.reduce((n, c) => n + (Number(c.stockLockedUsd) || 0), 0);
  const lockedKnown = trusted.filter((c) => Number(c.stockLockedUsd) > 0).length;
  const vol = trusted.reduce((n, c) => n + (Number(c.volume24h) || 0), 0);
  const holders = trusted.reduce((n, c) => n + (Number(c.holders) || 0), 0);
  const pairs = new Set(trusted.map((c) => c.pair).filter(Boolean));
  const movers = trusted
    .filter((c) => Number.isFinite(Number(c.change24h)) && Number(c.marketCap) >= MOVER_FLOOR)
    .sort((a, b) => Number(b.change24h) - Number(a.change24h))
    .slice(0, 3)
    .map(lite);
  const locked = trusted.filter((c) => Number(c.stockLockedUsd) > 0).sort((a, b) => Number(b.stockLockedUsd) - Number(a.stockLockedUsd)).slice(0, 3).map(lite);
  return {
    stockLockedUsd: lockedUsd,
    stockLockedKnown: lockedKnown,
    coinsListed: trusted.length,
    launches: (uni && uni.coins && uni.coins.length) || trusted.length,
    equitiesPaired: (uni && uni.equitiesPaired) || pairs.size,
    volume24h: vol,
    holders: holders,
    movers: movers,
    locked: locked
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=60");
  try {
    const uni = await buildUniverse();
    const map = {};
    for (const c of (uni && uni.coins) || []) {
      const addr = String(c.address || "").toLowerCase();
      if (!addr) continue;
      map[addr] = Object.assign({}, c, { address: addr, listed: true });
    }
    if (!map[PIN]) map[PIN] = { ticker: "MEME", name: "A Meme Coin", address: PIN, pair: "AMC", launchpad: "long", listed: true };
    if (!map[PIN_GG]) map[PIN_GG] = { ticker: "GG", name: "Golden Goose", address: PIN_GG, pair: "GLD", launchpad: "uniswap", listed: true };
    if (!map[PIN_BONER]) map[PIN_BONER] = { ticker: "BONER", name: "Boner Coin", address: PIN_BONER, pair: "HIMS", launchpad: "long", listed: true };
    const raw = Object.values(map).filter((c) => !looksScam(c));
    const trusted = raw.filter(isTrusted).sort((a, b) => Number(b.marketCap || 0) - Number(a.marketCap || 0));
    await fillDex(trusted.slice(0, 40), 40);
    trusted.sort((a, b) => Number(b.marketCap || 0) - Number(a.marketCap || 0));
    await fillHolders(trusted.slice(0, 40), 16);
    await fillPads(trusted.slice(0, 24), 16);
    trusted.forEach((c, i) => { c.rank = i + 1; });
    const metals = trusted.filter((c) => c.pair === "GLD" || c.pair === "SLV");
    const newest = trusted.slice().sort((a, b) => String(b.createdAt || b.launchedAt || "").localeCompare(String(a.createdAt || a.launchedAt || ""))).slice(0, 80);
    const quotes = {};
    await Promise.all(YAHOO.map(async (s) => {
      try {
        const px = await yahoo(s);
        if (px != null) quotes[s] = px;
      } catch (e) {}
    }));
    res.status(200).json({
      generated: uni && uni.generated,
      source: "memefi-indexer+dex",
      wrappers: uni && uni.wrappers,
      aggregates: {
        coins: trusted.length,
        listed: trusted.length,
        launches: (uni && uni.coins && uni.coins.length) || trusted.length,
        metals: metals.length,
        volume24h: trusted.reduce((n, c) => n + (Number(c.volume24h) || 0), 0)
      },
      snapshot: buildSnapshot(uni, trusted),
      quotes,
      onchain: (uni && uni.onchain) || {},
      logos: buildLogos((uni && uni.logos) || {}),
      top: trusted.slice(0, 250),
      newest,
      metals,
      flagged: []
    });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
}
