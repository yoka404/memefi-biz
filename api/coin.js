export const config = { maxDuration: 30 };

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

async function dex(address) {
  try {
    const r = await fetch("https://api.dexscreener.com/latest/dex/tokens/" + address, {
      headers: { "User-Agent": "memefi.biz/1.0" }
    });
    if (!r.ok) return null;
    const data = await r.json();
    const pairs = data.pairs || [];
    const rh = pairs.filter((p) => p.chainId === "robinhood");
    const pool = rh.length ? rh : pairs;
    pool.sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0));
    return { best: pool[0] || null, all: pool };
  } catch (e) {
    return null;
  }
}

function ipfs(uri) {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) return "https://ipfs.io/ipfs/" + uri.slice(7);
  return uri;
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
    const r = await fetch("https://memefimarketcap.com/data.json", {
      headers: { "User-Agent": "memefi.biz desk" }
    });
    if (!r.ok) throw new Error("dump");
    const dump = await r.json();
    let coin = (dump.coins || []).find((c) => String(c.address || "").toLowerCase() === address);
    let flagged = null;
    if (!coin) {
      const a = (dump.anomalies || []).find((c) => String(c.address || "").toLowerCase() === address);
      if (a) {
        flagged = a.why || a.gate;
        coin = Object.assign({}, a, a.reported || {});
      }
    }
    const dxpack = await dex(address);
    const dx = dxpack && dxpack.best;
    if (!coin && !dx) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const quote = (dx && dx.quoteToken && dx.quoteToken.symbol) || (coin && coin.pair);
    const stock = quote && dump.stocks ? dump.stocks[quote] : null;
    const isEquity = Boolean(stock);
    const cash = isEquity ? await yahoo(quote) : null;
    const info = (dx && dx.info) || {};
    const logo = (coin && coin.logo) ? ("https://memefimarketcap.com/" + coin.logo) : null;
    const created = dx && dx.pairCreatedAt;
    const tx = dx && dx.txns && (dx.txns.h24 || dx.txns.h6);
    res.status(200).json({
      generated: dump.meta && dump.meta.generated,
      flagged,
      isEquity,
      coin: {
        ticker: (coin && coin.ticker) || (dx && dx.baseToken && dx.baseToken.symbol),
        name: (coin && coin.name) || (dx && dx.baseToken && dx.baseToken.name),
        address,
        poolId: (dx && dx.pairAddress) || (coin && coin.poolId),
        pair: quote,
        pairAddress: (dx && dx.quoteToken && dx.quoteToken.address) || (coin && coin.pairAddress),
        launchpad: (coin && coin.launchpad) || (dx && dx.dexId) || "dex",
        price: (dx && dx.priceUsd) || (coin && coin.price),
        priceNative: dx && dx.priceNative,
        change1h: dx && dx.priceChange && dx.priceChange.h1,
        change6h: dx && dx.priceChange && dx.priceChange.h6,
        change24h: dx && dx.priceChange && dx.priceChange.h24,
        marketCap: (dx && (dx.marketCap || dx.fdv)) || (coin && coin.marketCap),
        fdv: dx && dx.fdv,
        volume24h: (dx && dx.volume && dx.volume.h24) || (coin && coin.volume24h),
        liquidityUsd: (dx && dx.liquidity && dx.liquidity.usd) || (coin && coin.liquidityUsd),
        buys24h: tx && tx.buys,
        sells24h: tx && tx.sells,
        createdAt: created ? new Date(created).toISOString() : (coin && coin.launchedAt),
        stockLockedUnits: coin && coin.stockLockedUnits,
        stockLockedUsd: coin && coin.stockLockedUsd,
        holders: coin && (coin.holders || coin.holdersExclPoolManager || coin.holdersTotal),
        lockedForever: coin && coin.lockedForever,
        lpFeePct: coin && coin.lpFeePct,
        logo,
        logoDetail: (coin && coin.logoDetail) ? ("https://memefimarketcap.com/" + coin.logoDetail) : logo,
        imageUri: ipfs(coin && coin.imageUri),
        dexImage: info.imageUrl || null,
        banner: info.header || null,
        socials: collectSocials(dxpack && dxpack.all),
        dexUrl: dx && dx.url,
        chain: (dx && dx.chainId) || "robinhood"
      },
      stock: stock && {
        symbol: stock.symbol,
        name: stock.name,
        address: stock.address,
        onchain: stock.price,
        totalSupply: stock.totalSupply
      },
      cash
    });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
}
