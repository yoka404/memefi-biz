export const config = { maxDuration: 30 };

const YAHOO = ["AMC","NVDA","HIMS","MU","MSTR","TSLA","HOOD","AAPL","GME","SPY","MSFT","AMD","AMZN","META","GOOGL","NFLX","PLTR","INTC","BABA","COIN","RBLX","DJT","GLD","QQQ","IWM"];

async function yahoo(symbol) {
  const url = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol) + "?interval=1d&range=5d";
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 memefi.biz" } });
  if (!r.ok) return null;
  const data = await r.json();
  const px = data.chart && data.chart.result && data.chart.result[0] && data.chart.result[0].meta && data.chart.result[0].meta.regularMarketPrice;
  return Number.isFinite(Number(px)) ? Number(px) : null;
}

function slim(c, rank) {
  return {
    rank: rank || c.rank || null,
    ticker: c.ticker,
    name: c.name,
    launchpad: c.launchpad,
    address: c.address,
    poolId: c.poolId,
    pair: c.pair,
    price: c.price,
    change24h: c.change24h,
    marketCap: c.marketCap,
    volume24h: c.volume24h,
    stockLockedUnits: c.stockLockedUnits,
    stockLockedUsd: c.stockLockedUsd,
    holders: c.holders || c.holdersExclPoolManager || c.holdersTotal || null,
    launchedAt: c.launchedAt
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=90, stale-while-revalidate=300");
  try {
    const r = await fetch("https://memefimarketcap.com/data.json", {
      headers: { "User-Agent": "memefi.biz desk" }
    });
    if (!r.ok) throw new Error("dump " + r.status);
    const dump = await r.json();
    const coins = (dump.coins || []).filter((c) => c && c.listingState === "listed");
    const ranked = coins.slice().sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
    const top = ranked.slice(0, 200).map((c, i) => slim(c, i + 1));
    const newest = coins
      .slice()
      .sort((a, b) => String(b.launchedAt || "").localeCompare(String(a.launchedAt || "")))
      .slice(0, 80)
      .map((c, i) => slim(c, i + 1));
    const quotes = {};
    await Promise.all(YAHOO.map(async (s) => {
      try {
        const px = await yahoo(s);
        if (px != null) quotes[s] = px;
      } catch (e) {}
    }));
    const onchain = {};
    const stocks = dump.stocks || {};
    for (const [sym, row] of Object.entries(stocks)) {
      if (row && Number.isFinite(Number(row.price))) onchain[sym] = Number(row.price);
    }
    const listing = dump.listing || {};
    res.status(200).json({
      generated: dump.meta && dump.meta.generated,
      headBlock: dump.meta && dump.meta.headBlock,
      aggregates: {
        coins: (dump.aggregates && dump.aggregates.coinsListed) || coins.length,
        launches: listing.totalLaunchesOnChain,
        listed: listing.listed,
        equities: (dump.aggregates && dump.aggregates.equitiesPaired) || Object.keys(stocks).length,
        volume24h: dump.aggregates && dump.aggregates.volume24hUsd && dump.aggregates.volume24hUsd.total,
        stockLockedUsd: dump.aggregates && dump.aggregates.stockLockedUsd && dump.aggregates.stockLockedUsd.total,
        byLaunchpad: listing.byLaunchpad || {}
      },
      quotes,
      onchain,
      top,
      newest
    });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
}
