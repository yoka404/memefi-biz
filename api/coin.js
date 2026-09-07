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

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=90, stale-while-revalidate=300");
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
    const coin = (dump.coins || []).find((c) => String(c.address || "").toLowerCase() === address);
    if (!coin) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const stock = (dump.stocks || {})[coin.pair] || null;
    const cash = coin.pair ? await yahoo(coin.pair) : null;
    res.status(200).json({
      generated: dump.meta && dump.meta.generated,
      headBlock: dump.meta && dump.meta.headBlock,
      coin: {
        id: coin.id,
        ticker: coin.ticker,
        name: coin.name,
        address: coin.address,
        poolId: coin.poolId,
        pair: coin.pair,
        pairAddress: coin.pairAddress,
        launchpad: coin.launchpad,
        price: coin.price,
        priceNative: coin.priceNative,
        change24h: coin.change24h,
        marketCap: coin.marketCap,
        volume24h: coin.volume24h,
        liquidityUsd: coin.liquidityUsd,
        stockLockedUnits: coin.stockLockedUnits,
        stockLockedUsd: coin.stockLockedUsd,
        holders: coin.holders || coin.holdersExclPoolManager || coin.holdersTotal,
        launchedAt: coin.launchedAt,
        lockedForever: coin.lockedForever,
        lpFeePct: coin.lpFeePct,
        description: coin.description || coin.lore || ""
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
