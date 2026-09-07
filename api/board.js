export const config = { maxDuration: 30 };
import { buildUniverse } from "../lib/indexer.js";
import { fillHolders } from "../lib/blockscout.js";
import { fillPads } from "../lib/airlock.js";
import { fillDex } from "../lib/dex.js";
import { padGroup } from "../lib/pads.js";
import { tokenSupply, latestBlock } from "../lib/rpc.js";

const YAHOO = ["AMC","NVDA","HIMS","MU","MSTR","TSLA","HOOD","AAPL","GME","SPY","MSFT","AMD","AMZN","META","GOOGL","NFLX","PLTR","INTC","BABA","COIN","RBLX","DJT","GLD","SLV","QQQ","IWM","COST","LLY","BB"];
const PIN = "0x385f4f8ae47651ce5f58f5265395a669f8281e18".toLowerCase();
const PIN_GG = "0xcacb0e9caccee63ec4d82952e561a291c68bcb68".toLowerCase();
const PIN_BONER = "0x98096d17e191b3da1d5f99a6d7b3584351b11e18".toLowerCase();
const PINS = new Set([PIN, PIN_GG, PIN_BONER]);
const JUNK = /^(test|asdf|qwer|xxxx|zzzz|aaaa|abcd|foo|bar|xxx)/i;
const TRUSTED = new Set(["long", "bankr", "feel", "flap", "pons"]);
const TAPE_FLOOR = 1e5;
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
  if (PINS.has(c.address)) return false;
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

function onTape(c) {
  if (!c) return false;
  if (PINS.has(c.address)) return true;
  return Number(c.marketCap) >= TAPE_FLOOR;
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

async function wrapperUtil(coins, onchain) {
  const by = {};
  for (const c of coins || []) {
    const sym = String(c.pair || "").toUpperCase();
    if (!sym) continue;
    if (!by[sym]) by[sym] = { symbol: sym, lockedUsd: 0, stockAddress: null };
    by[sym].lockedUsd += Number(c.stockLockedUsd) || 0;
    if (!by[sym].stockAddress && c.stockAddress) by[sym].stockAddress = c.stockAddress;
  }
  const rows = Object.values(by).sort((a, b) => b.lockedUsd - a.lockedUsd).slice(0, 8);
  await Promise.all(rows.map(async (row) => {
    row.onchain = onchain && onchain[row.symbol] != null ? Number(onchain[row.symbol]) : null;
    row.supply = row.stockAddress ? await tokenSupply(row.stockAddress) : null;
    row.aum = (row.supply != null && row.onchain != null) ? row.supply * row.onchain : null;
    row.pct = (row.aum > 0) ? (row.lockedUsd / row.aum) * 100 : null;
  }));
  const aum = rows.reduce((n, r) => n + (Number(r.aum) || 0), 0);
  const locked = rows.reduce((n, r) => n + (Number(r.lockedUsd) || 0), 0);
  return {
    rows,
    aum: aum || null,
    locked: locked || null,
    pct: aum > 0 ? (locked / aum) * 100 : null
  };
}

function buildSnapshot(uni, world, tape, util, headBlock) {
  const lockedUsd = world.reduce((n, c) => n + (Number(c.stockLockedUsd) || 0), 0);
  const lockedKnown = world.filter((c) => Number(c.stockLockedUsd) > 0).length;
  const vol = world.reduce((n, c) => n + (Number(c.volume24h) || 0), 0);
  const holders = world.reduce((n, c) => n + (Number(c.holders) || 0), 0);
  const pairs = new Set(world.map((c) => c.pair).filter(Boolean));
  const movers = tape
    .filter((c) => Number.isFinite(Number(c.change24h)) && Number(c.marketCap) >= MOVER_FLOOR)
    .sort((a, b) => Number(b.change24h) - Number(a.change24h))
    .slice(0, 3)
    .map(lite);
  const locked = world.filter((c) => Number(c.stockLockedUsd) > 0).sort((a, b) => Number(b.stockLockedUsd) - Number(a.stockLockedUsd)).slice(0, 3).map(lite);
  return {
    stockLockedUsd: lockedUsd,
    stockLockedKnown: lockedKnown,
    coinsListed: world.length,
    launches: (uni && uni.coins && uni.coins.length) || world.length,
    equitiesPaired: pairs.size,
    volume24h: vol,
    holders: holders,
    movers: movers,
    locked: locked,
    util: util || null,
    headBlock: headBlock || null
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
    if (!map[PIN_GG]) map[PIN_GG] = { ticker: "GG", name: "Golden Goose", address: PIN_GG, pair: "GLD", launchpad: "pons", listed: true };
    if (!map[PIN_BONER]) map[PIN_BONER] = { ticker: "BONER", name: "Boner Coin", address: PIN_BONER, pair: "HIMS", launchpad: "long", listed: true };
    const world = Object.values(map).filter((c) => !looksScam(c));
    world.sort((a, b) => Number(b.marketCap || 0) - Number(a.marketCap || 0));
    await fillDex(world.slice(0, 200), 80);
    const tape = world.filter(onTape).sort((a, b) => Number(b.marketCap || 0) - Number(a.marketCap || 0));
    await fillHolders(world.slice(0, 80), 20);
    await fillPads(tape.slice(0, 40), 40);
    tape.forEach((c, i) => { c.rank = i + 1; });
    const metals = tape.filter((c) => c.pair === "GLD" || c.pair === "SLV");
    const newest = tape.slice().sort((a, b) => String(b.createdAt || b.launchedAt || "").localeCompare(String(a.createdAt || a.launchedAt || ""))).slice(0, 80);
    const quotes = {};
    await Promise.all(YAHOO.map(async (s) => {
      try {
        const px = await yahoo(s);
        if (px != null) quotes[s] = px;
      } catch (e) {}
    }));
    const onchain = (uni && uni.onchain) || {};
    const util = await wrapperUtil(world, onchain);
    const head = await latestBlock();
    res.status(200).json({
      generated: uni && uni.generated,
      source: "memefi-indexer+dex",
      wrappers: uni && uni.wrappers,
      aggregates: {
        coins: tape.length,
        listed: tape.length,
        tracked: world.length,
        launches: (uni && uni.coins && uni.coins.length) || world.length,
        metals: metals.length,
        volume24h: world.reduce((n, c) => n + (Number(c.volume24h) || 0), 0)
      },
      snapshot: buildSnapshot(uni, world, tape, util, head),
      quotes,
      onchain,
      logos: buildLogos((uni && uni.logos) || {}),
      top: tape,
      newest,
      metals,
      flagged: []
    });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
}
