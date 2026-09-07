export const config = { maxDuration: 30 };
import { tokenHolders } from "../lib/blockscout.js";
const METALS = new Set(["GLD","SLV"]);

function padNorm(raw) {
  const s = String(raw || "").toLowerCase();
  if (s.includes("pons")) return "pons";
  if (s.includes("long") || s.includes("doppler") || s.includes("airlock")) return "long";
  if (s.includes("bankr")) return "bankr";
  if (s.includes("feel")) return "feel";
  if (s.includes("flap")) return "flap";
  return raw || "dex";
}

async function yahoo(symbol) {
  try {
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol) + "?interval=1d&range=5d";
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 memefi.biz" } });
    if (!r.ok) return null;
    const data = await r.json();
    const px = data.chart.result[0].meta.regularMarketPrice;
    return Number.isFinite(Number(px)) ? Number(px) : null;
  } catch (e) {
    return null;
  }
}

async function stockkitMap() {
  try {
    const r = await fetch("https://api.stockkit.dev/v1/assets", { headers: { "User-Agent": "memefi.biz" } });
    if (!r.ok) return {};
    const data = await r.json();
    const out = {};
    for (const a of data.assets || []) {
      if (!a || !a.symbol) continue;
      out[String(a.symbol).toUpperCase()] = {
        symbol: String(a.symbol).toUpperCase(),
        name: a.name || a.symbol,
        address: String(a.address || "").toLowerCase()
      };
    }
    return out;
  } catch (e) {
    return {};
  }
}

function pairScore(p, stocks) {
  const liq = (p.liquidity && p.liquidity.usd) || 0;
  const q = p.quoteToken && p.quoteToken.symbol;
  if (METALS.has(q)) return 3e12 + liq;
  if (stocks && stocks[q]) return 2e12 + liq;
  return liq;
}

async function dex(address, stocks) {
  try {
    const r = await fetch("https://api.dexscreener.com/latest/dex/tokens/" + address, {
      headers: { "User-Agent": "memefi.biz/1.0" }
    });
    if (!r.ok) return null;
    const data = await r.json();
    const pairs = data.pairs || [];
    const rh = pairs.filter((p) => p.chainId === "robinhood");
    const pool = rh.length ? rh : pairs;
    pool.sort((a, b) => pairScore(b, stocks) - pairScore(a, stocks));
    return { best: pool[0] || null, all: pool };
  } catch (e) {
    return null;
  }
}

function lockedFrom(dx, quote) {
  if (!dx || !dx.liquidity) return {};
  const qSym = String((dx.quoteToken && dx.quoteToken.symbol) || "").toUpperCase();
  const bSym = String((dx.baseToken && dx.baseToken.symbol) || "").toUpperCase();
  const want = String(quote || "").toUpperCase();
  const qAmt = Number(dx.liquidity.quote);
  const bAmt = Number(dx.liquidity.base);
  const px = Number(dx.priceUsd);
  const native = Number(dx.priceNative);
  let units = null;
  if (qSym === want && qAmt > 0) units = qAmt;
  else if (bSym === want && bAmt > 0) units = bAmt;
  if (units == null) return {};
  let usd = null;
  if (qSym === want && px > 0 && native > 0) usd = units * (px / native);
  else if (bSym === want && px > 0) usd = units * px;
  return { stockLockedUnits: units, stockLockedUsd: usd };
}

function keySocial(type, url) {
  const u = String(url || "").toLowerCase().replace(/\/$/, "");
  const t = String(type || "").toLowerCase();
  if (t === "twitter" || u.includes("x.com") || u.includes("twitter.com")) return "x:" + u.replace("twitter.com", "x.com");
  if (t === "telegram" || u.includes("t.me")) return "tg:" + u;
  if (t === "discord" || u.includes("discord")) return "dc:" + u;
  return "web:" + u;
}

function collectSocials(pairs) {
  const seen = new Set();
  const out = [];
  for (const p of pairs || []) {
    const info = p.info || {};
    for (const s of info.socials || []) {
      if (!s || !s.url) continue;
      const k = keySocial(s.type, s.url);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ type: s.type || "social", url: s.url });
    }
    for (const w of info.websites || []) {
      const url = typeof w === "string" ? w : w && w.url;
      if (!url) continue;
      const k = keySocial("website", url);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ type: "website", url });
    }
  }
  return out;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=60");
  const address = String(req.query.address || "").toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(address)) {
    res.status(400).json({ error: "bad address" });
    return;
  }
  try {
    const stocks = await stockkitMap();
    const dxpack = await dex(address, stocks);
    const dx = dxpack && dxpack.best;
    if (!dx) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const quote = String((dx.quoteToken && dx.quoteToken.symbol) || "").toUpperCase();
    const stock = quote && stocks[quote] ? stocks[quote] : null;
    const isEquity = Boolean(stock && stock.address);
    const isMetal = METALS.has(quote);
    const cash = isEquity || isMetal ? await yahoo(quote) : null;
    const info = dx.info || {};
    const lock = lockedFrom(dx, quote);
    const created = dx.pairCreatedAt;
    const tx = dx.txns && (dx.txns.h24 || dx.txns.h6);
    const holders = await tokenHolders(address);
    const wrapPx = (Number(dx.priceUsd) > 0 && Number(dx.priceNative) > 0) ? Number(dx.priceUsd) / Number(dx.priceNative) : null;
    res.status(200).json({
      generated: new Date().toISOString(),
      flagged: null,
      isEquity: isEquity || isMetal,
      isMetal,
      coin: {
        ticker: dx.baseToken && dx.baseToken.symbol,
        name: (dx.baseToken && dx.baseToken.name) || (dx.baseToken && dx.baseToken.symbol),
        address,
        poolId: dx.pairAddress,
        pair: quote,
        pairAddress: (dx.quoteToken && dx.quoteToken.address) || (stock && stock.address),
        launchpad: padNorm(dx.dexId),
        price: dx.priceUsd,
        priceNative: dx.priceNative,
        change1h: dx.priceChange && dx.priceChange.h1,
        change6h: dx.priceChange && dx.priceChange.h6,
        change24h: dx.priceChange && dx.priceChange.h24,
        marketCap: dx.marketCap || dx.fdv,
        fdv: dx.fdv,
        volume24h: dx.volume && dx.volume.h24,
        liquidityUsd: dx.liquidity && dx.liquidity.usd,
        buys24h: tx && tx.buys,
        sells24h: tx && tx.sells,
        createdAt: created ? new Date(created).toISOString() : null,
        stockLockedUnits: lock.stockLockedUnits,
        stockLockedUsd: lock.stockLockedUsd,
        holders,
        logo: null,
        logoDetail: null,
        imageUri: null,
        dexImage: info.imageUrl || null,
        banner: info.header || null,
        socials: collectSocials(dxpack && dxpack.all),
        dexUrl: dx.url,
        chain: dx.chainId || "robinhood"
      },
      stock: stock && {
        symbol: stock.symbol,
        name: stock.name,
        address: stock.address,
        onchain: wrapPx,
        totalSupply: null
      },
      cash
    });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
}
