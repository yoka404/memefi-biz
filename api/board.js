export const config = { maxDuration: 30 };
import { buildUniverse } from "../lib/indexer.js";
import { fillHolders } from "../lib/blockscout.js";
import { fillPads } from "../lib/airlock.js";
import { fillDex } from "../lib/dex.js";
import { padGroup } from "../lib/pads.js";

const YAHOO = ["AMC","NVDA","HIMS","MU","MSTR","TSLA","HOOD","AAPL","GME","SPY","MSFT","AMD","AMZN","META","GOOGL","NFLX","PLTR","INTC","BABA","COIN","RBLX","DJT","GLD","SLV","QQQ","IWM"];
const PIN = "0x385f4f8ae47651ce5f58f5265395a669f8281e18".toLowerCase();
const PIN_GG = "0xcacb0e9caccee63ec4d82952e561a291c68bcb68".toLowerCase();
const PIN_BONER = "0x98096d17e191b3da1d5f99a6d7b3584351b11e18".toLowerCase();
const JUNK = /^(test|asdf|qwer|xxxx|zzzz|aaaa|abcd|foo|bar|xxx)/i;
const TRUSTED = new Set(["long", "bankr", "feel", "flap", "pons"]);

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

function pickMcap(live, base) {
  const lm = Number(live && live.marketCap);
  const bm = Number(base && base.marketCap);
  const liq = Number((live && live.liquidityUsd) || (base && base.liquidityUsd));
  if (Number.isFinite(bm) && Number.isFinite(lm) && bm > 1e6 && lm > 0 && bm / lm > 8) return bm;
  if (Number.isFinite(lm) && Number.isFinite(bm) && bm > 0) {
    if (lm > 5e8 && bm < 5e8) return bm;
    if (lm / bm > 8) return bm;
  }
  if (Number.isFinite(lm) && Number.isFinite(liq) && liq > 0 && lm / liq > 400 && Number.isFinite(bm)) return bm;
  if (Number.isFinite(lm) && lm > 4e8 && !Number.isFinite(bm)) return null;
  if (Number.isFinite(lm)) return lm;
  if (Number.isFinite(bm)) return bm;
  return null;
}

function pickPad(base, live) {
  const b = base && base.launchpad;
  const l = live && live.launchpad;
  if (b && TRUSTED.has(padGroup(b))) return b;
  if (l && TRUSTED.has(padGroup(l))) return l;
  return b || l;
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
    liquidityUsd: c.liquidityUsd != null ? c.liquidityUsd : rep.liquidityUsd,
    stockLockedUnits: c.stockLockedUnits != null ? c.stockLockedUnits : rep.stockLockedUnits,
    stockLockedUsd: c.stockLockedUsd != null ? c.stockLockedUsd : rep.stockLockedUsd,
    holders: pickHolders(c),
    launchedAt: c.launchedAt,
    logo: c.logo || null,
    imageUri: c.imageUri || null,
    flagged: false,
    flag: null,
    listed: true
  }, extra || {});
}

function mergeRow(base, live) {
  if (!live) return base;
  return Object.assign({}, base, live, {
    launchpad: pickPad(base, live),
    holders: (base && base.holders != null) ? base.holders : live.holders,
    stockLockedUnits: (base && base.stockLockedUnits != null) ? base.stockLockedUnits : live.stockLockedUnits,
    stockLockedUsd: (base && base.stockLockedUsd != null) ? base.stockLockedUsd : live.stockLockedUsd,
    logo: (base && base.logo) || live.logo,
    imageUri: (base && base.imageUri) || live.imageUri,
    geckoImage: (base && base.geckoImage) || live.geckoImage,
    marketCap: pickMcap(live, base),
    price: live.price != null ? live.price : (base && base.price),
    volume24h: live.volume24h != null ? live.volume24h : (base && base.volume24h),
    change24h: live.change24h != null ? live.change24h : (base && base.change24h),
    pair: (base && base.pair) || live.pair,
    poolId: (base && base.poolId) || live.poolId,
    listed: Boolean((base && base.listed) || (live && live.listed)),
    liquidityUsd: live.liquidityUsd != null ? live.liquidityUsd : (base && base.liquidityUsd)
  });
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
  if (c.flagged && !trusted) return true;
  if (Number.isFinite(mcap) && mcap > 1e9) return true;
  if (Number.isFinite(mcap) && mcap > 4e8 && !c.listed && !trusted) return true;
  if (c.holders === 0 && Number.isFinite(mcap) && mcap > 5e5 && !c.listed) return true;
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
    stockLockedUnits: c.stockLockedUnits
  };
}

function buildSnapshot(dump, trusted) {
  const agg = (dump && dump.aggregates) || {};
  const listing = (dump && dump.listing) || {};
  const lockedUsd = agg.stockLockedUsd && agg.stockLockedUsd.total;
  const vol = agg.volume24hUsd && agg.volume24hUsd.total;
  const fees = agg.fees24hUsd && agg.fees24hUsd.total;
  const holders = agg.holders && agg.holders.total;
  const movers = trusted.filter((c) => Number.isFinite(Number(c.change24h))).sort((a, b) => Number(b.change24h) - Number(a.change24h)).slice(0, 3).map(lite);
  const locked = trusted.filter((c) => Number(c.stockLockedUsd) > 0).sort((a, b) => Number(b.stockLockedUsd) - Number(a.stockLockedUsd)).slice(0, 3).map(lite);
  return {
    stockLockedUsd: lockedUsd,
    stockLockedKnown: agg.stockLockedUsd && agg.stockLockedUsd.known,
    coinsListed: agg.coinsListed || listing.listed,
    launches: listing.totalLaunchesOnChain,
    equitiesPaired: agg.equitiesPaired,
    volume24h: vol,
    fees24h: fees,
    holders: holders,
    headBlock: dump && dump.meta && dump.meta.headBlock,
    movers: movers,
    locked: locked
  };
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
        const trustedPad = TRUSTED.has(padGroup(c.launchpad));
        map[addr] = slimDump(c, { flagged: !trustedPad, flag: c.gate || c.why || null, listed: trustedPad });
      }
    }
    for (const c of (uni && uni.coins) || []) {
      const addr = String(c.address || "").toLowerCase();
      if (!addr) continue;
      map[addr] = mergeRow(map[addr] || { listed: false }, c);
    }
    if (!map[PIN]) map[PIN] = { ticker: "MEME", name: "A Meme Coin", address: PIN, pair: "AMC", launchpad: "long", listed: true };
    if (!map[PIN_GG]) map[PIN_GG] = { ticker: "GG", name: "Golden Goose", address: PIN_GG, pair: "GLD", launchpad: "uniswap", listed: true };
    if (!map[PIN_BONER]) map[PIN_BONER] = { ticker: "BONER", name: "Boner Coin", address: PIN_BONER, pair: "HIMS", launchpad: "long", listed: true };
    const raw = Object.values(map).filter((c) => !looksScam(c));
    const trusted = raw.filter(isTrusted).sort((a, b) => Number(b.marketCap || 0) - Number(a.marketCap || 0));
    await fillDex(trusted.slice(0, 30), 24);
    trusted.sort((a, b) => Number(b.marketCap || 0) - Number(a.marketCap || 0));
    await fillHolders(trusted.slice(0, 40), 8);
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
    const onchain = Object.assign({}, (uni && uni.onchain) || {});
    if (dump && dump.stocks) {
      for (const [sym, row] of Object.entries(dump.stocks)) {
        if (row && Number.isFinite(Number(row.price)) && onchain[sym] == null) onchain[sym] = Number(row.price);
      }
    }
    res.status(200).json({
      generated: (uni && uni.generated) || (dump && dump.meta && dump.meta.generated),
      source: uni && uni.coins && uni.coins.length ? "memefi-indexer+dex" : "registry+dex",
      wrappers: uni && uni.wrappers,
      aggregates: {
        coins: trusted.length,
        listed: trusted.filter((c) => c.listed).length,
        launches: dump && dump.listing && dump.listing.totalLaunchesOnChain,
        metals: metals.length,
        volume24h: trusted.reduce((n, c) => n + (Number(c.volume24h) || 0), 0)
      },
      snapshot: buildSnapshot(dump, trusted),
      quotes,
      onchain,
      logos: buildLogos((uni && uni.logos) || {}),
      top: trusted.slice(0, 250),
      newest,
      metals,
      flagged: raw.filter((c) => c.flagged)
    });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
}
