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
    const pairs = (data.pairs || []).filter((p) => p.chainId === "robinhood");
    return pairs[0] || (data.pairs && data.pairs[0]) || null;
  } catch (e) {
    return null;
  }
}

function ipfs(uri) {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) return "https://ipfs.io/ipfs/" + uri.slice(7);
  return uri;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
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
    const dx = await dex(address);
    if (!coin && !dx) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const stockSym = (coin && coin.pair) || (dx && dx.quoteToken && dx.quoteToken.symbol);
    const stock = stockSym && dump.stocks ? dump.stocks[stockSym] : null;
    const cash = stockSym ? await yahoo(stockSym) : null;
    const info = (dx && dx.info) || {};
    const socials = [];
    for (const s of info.socials || []) {
      if (s && s.url) socials.push({ type: s.type || "social", url: s.url });
    }
    for (const w of info.websites || []) {
      const url = typeof w === "string" ? w : w && w.url;
      if (url) socials.push({ type: "website", url });
    }
    const logo = (coin && coin.logo) ? ("https://memefimarketcap.com/" + coin.logo) : null;
    const logoDetail = (coin && coin.logoDetail) ? ("https://memefimarketcap.com/" + coin.logoDetail) : logo;
    res.status(200).json({
      generated: dump.meta && dump.meta.generated,
      flagged,
      coin: {
        ticker: (coin && coin.ticker) || (dx && dx.baseToken && dx.baseToken.symbol),
        name: (coin && coin.name) || (dx && dx.baseToken && dx.baseToken.name),
        address,
        poolId: (coin && coin.poolId) || (dx && dx.pairAddress),
        pair: stockSym,
        pairAddress: coin && coin.pairAddress,
        launchpad: coin && coin.launchpad,
        price: (dx && dx.priceUsd) || (coin && coin.price),
        priceNative: (dx && dx.priceNative) || (coin && coin.priceNative),
        change24h: dx && dx.priceChange && dx.priceChange.h24,
        marketCap: (dx && (dx.marketCap || dx.fdv)) || (coin && coin.marketCap),
        volume24h: (dx && dx.volume && dx.volume.h24) || (coin && coin.volume24h),
        liquidityUsd: (dx && dx.liquidity && dx.liquidity.usd) || (coin && coin.liquidityUsd),
        stockLockedUnits: coin && coin.stockLockedUnits,
        stockLockedUsd: coin && coin.stockLockedUsd,
        holders: coin && (coin.holders || coin.holdersExclPoolManager || coin.holdersTotal),
        launchedAt: coin && coin.launchedAt,
        lockedForever: coin && coin.lockedForever,
        lpFeePct: coin && coin.lpFeePct,
        description: (coin && (coin.description || coin.lore)) || "",
        logo,
        logoDetail,
        imageUri: ipfs(coin && coin.imageUri),
        dexImage: info.imageUrl || null,
        socials
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
