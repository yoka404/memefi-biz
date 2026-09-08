function norm(a) {
  return String(a || "").toLowerCase();
}
function up(s) {
  return String(s || "").toUpperCase();
}
const SKIP = new Set(["USDG", "USDC", "USDT", "DAI", "USD", "WETH", "ETH"]);

function stockSide(p, meme) {
  const want = norm(meme);
  const base = norm(p.baseToken && p.baseToken.address);
  const quote = norm(p.quoteToken && p.quoteToken.address);
  if (base === want) return up(p.quoteToken && p.quoteToken.symbol);
  if (quote === want) return up(p.baseToken && p.baseToken.symbol);
  return "";
}
function isStockQuote(p, meme) {
  const side = stockSide(p, meme);
  return side && !SKIP.has(side);
}
function bestPair(pairs, meme) {
  const want = norm(meme);
  const list = (pairs || []).filter((p) => {
    const base = norm(p.baseToken && p.baseToken.address);
    const quote = norm(p.quoteToken && p.quoteToken.address);
    return base === want || quote === want;
  });
  const stock = list.filter((p) => isStockQuote(p, meme));
  const pool = stock.length ? stock : list;
  pool.sort((a, b) => {
    const la = Number((a.liquidity && a.liquidity.usd) || 0);
    const lb = Number((b.liquidity && b.liquidity.usd) || 0);
    return lb - la;
  });
  return pool[0] || null;
}

function lockedFromPair(p, pairSym) {
  const want = up(pairSym);
  if (!want || !p) return {};
  const liq = p.liquidity || {};
  const qSym = up(p.quoteToken && p.quoteToken.symbol);
  const bSym = up(p.baseToken && p.baseToken.symbol);
  const qAmt = Number(liq.quote);
  const bAmt = Number(liq.base);
  const px = Number(p.priceUsd);
  const native = Number(p.priceNative);
  let units = null;
  if (qSym === want && Number.isFinite(qAmt) && qAmt > 0) units = qAmt;
  else if (bSym === want && Number.isFinite(bAmt) && bAmt > 0) units = bAmt;
  if (units == null) return {};
  let usd = null;
  if (qSym === want && Number.isFinite(px) && Number.isFinite(native) && native > 0) usd = units * (px / native);
  else if (bSym === want && Number.isFinite(px)) usd = units * px;
  return { stockLockedUnits: units, stockLockedUsd: Number.isFinite(usd) ? usd : null };
}

export async function dexToken(address) {
  if (!address) return null;
  try {
    const r = await fetch("https://api.dexscreener.com/tokens/v1/robinhood/" + encodeURIComponent(address), {
      headers: { Accept: "application/json" }
    });
    if (!r.ok) return null;
    const pairs = await r.json();
    const p = bestPair(Array.isArray(pairs) ? pairs : [], address);
    if (!p) return null;
    const side = stockSide(p, address);
    return {
      poolId: String(p.pairAddress || "").toLowerCase(),
      price: Number(p.priceUsd) || null,
      marketCap: Number(p.marketCap || p.fdv) || null,
      fdv: Number(p.fdv) || null,
      volume24h: p.volume && Number(p.volume.h24),
      change24h: p.priceChange && Number(p.priceChange.h24),
      liquidityUsd: p.liquidity && Number(p.liquidity.usd),
      dexImage: p.info && p.info.imageUrl,
      pairSymbol: side && !SKIP.has(side) ? side : null,
      raw: p
    };
  } catch (e) {
    return null;
  }
}

async function geckoImage(address) {
  if (!address) return null;
  try {
    const r = await fetch("https://api.geckoterminal.com/api/v2/networks/robinhood/tokens/" + encodeURIComponent(address), {
      headers: { Accept: "application/json", "User-Agent": "memefi.biz desk" }
    });
    if (!r.ok) return null;
    const data = await r.json();
    const a = data.data && data.data.attributes;
    return (a && (a.image_url || a.image)) || null;
  } catch (e) {
    return null;
  }
}

export async function fillDex(coins, limit) {
  const need = (coins || []).filter((c) => c && c.address).slice(0, limit || 24);
  await Promise.all(need.map(async (c) => {
    const live = await dexToken(c.address);
    if (live) {
      if (live.poolId) c.poolId = live.poolId;
      if (live.marketCap != null) c.marketCap = live.marketCap;
      if (live.price != null) c.price = live.price;
      if (live.volume24h != null) c.volume24h = live.volume24h;
      if (live.change24h != null) c.change24h = live.change24h;
      if (live.liquidityUsd != null) c.liquidityUsd = live.liquidityUsd;
      if (live.dexImage) c.dexImage = live.dexImage;
      if (live.pairSymbol) c.pair = live.pairSymbol;
      const lock = lockedFromPair(live.raw, c.pair);
      if (lock.stockLockedUnits != null) c.stockLockedUnits = lock.stockLockedUnits;
      if (lock.stockLockedUsd != null) c.stockLockedUsd = lock.stockLockedUsd;
    }
    if (!c.dexImage && !c.geckoImage) {
      const img = await geckoImage(c.address);
      if (img) c.geckoImage = img;
    }
  }));
  return coins;
}
