export const config = { maxDuration: 30 };

const YAHOO = ["AMC","NVDA","HIMS","MU","MSTR","TSLA","HOOD","AAPL","GME","SPY","MSFT","AMD","AMZN","META","GOOGL","NFLX","PLTR","INTC","BABA","COIN","RBLX","DJT","GLD","SLV","QQQ","IWM"];
const METALS = new Set(["GLD","SLV"]);
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

function slim(c, rank, extra) {
  const rep = c.reported || {};
  return Object.assign({
    rank: rank || c.rank || null,
    ticker: c.ticker,
    name: c.name,
    launchpad: c.launchpad,
    address: c.address,
    poolId: c.poolId,
    pair: c.pair,
    price: c.price != null ? c.price : rep.price,
    change24h: c.change24h,
    marketCap: c.marketCap != null ? c.marketCap : rep.marketCap,
    volume24h: c.volume24h,
    stockLockedUnits: c.stockLockedUnits != null ? c.stockLockedUnits : rep.stockLockedUnits,
    stockLockedUsd: c.stockLockedUsd != null ? c.stockLockedUsd : rep.stockLockedUsd,
    holders: c.holders || c.holdersExclPoolManager || c.holdersTotal || null,
    launchedAt: c.launchedAt,
    logo: c.logo || null,
    imageUri: c.imageUri || null,
    flagged: false,
    flag: null
  }, extra || {});
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=60");
  try {
    const r = await fetch("https://memefimarketcap.com/data.json", {
      headers: { "User-Agent": "memefi.biz desk" }
    });
    if (!r.ok) throw new Error("dump " + r.status);
    const dump = await r.json();
    const coins = (dump.coins || []).filter((c) => c && c.listingState === "listed");
    const ranked = coins.slice().sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
    let top = ranked.slice(0, 200).map((c, i) => slim(c, i + 1));
    const newest = coins
      .slice()
      .sort((a, b) => String(b.launchedAt || "").localeCompare(String(a.launchedAt || "")))
      .slice(0, 80)
      .map((c, i) => slim(c, i + 1));
    let metals = coins
      .filter((c) => METALS.has(String(c.pair || "").toUpperCase()))
      .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
      .slice(0, 120)
      .map((c, i) => slim(c, i + 1));
    const anomalies = dump.anomalies || [];
    const flagged = anomalies.map((c) => slim(c, null, { flagged: true, flag: c.gate || c.why || "anomalous" }));
    const pin = flagged.find((c) => String(c.address || "").toLowerCase() === PIN) ||
      slim({
        ticker: "MEME",
        name: "A Meme Coin",
        launchpad: "long",
        address: PIN,
        poolId: "0x27ccf0a6d1ee74840220715bcca7d3b01e0d33aa30d0259b47ae1585b3f4c071",
        pair: "AMC"
      }, null, { flagged: true, flag: "excluded-from-reference-rank" });
    const gg = slim({
      ticker: "GG",
      name: "Golden Goose",
      launchpad: "uniswap",
      address: PIN_GG,
      poolId: "0x9009d141e9189ca9d19d565468078383c192c2fa1d6f855957507bf8539643c5",
      pair: "GLD"
    }, null, {});
    if (!top.some((c) => String(c.address || "").toLowerCase() === PIN)) top = [pin].concat(top);
    if (!metals.some((c) => String(c.address || "").toLowerCase() === PIN_GG)) metals = [gg].concat(metals);
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
        metals: metals.length,
        volume24h: dump.aggregates && dump.aggregates.volume24hUsd && dump.aggregates.volume24hUsd.total,
        stockLockedUsd: dump.aggregates && dump.aggregates.stockLockedUsd && dump.aggregates.stockLockedUsd.total,
        byLaunchpad: listing.byLaunchpad || {}
      },
      quotes,
      onchain,
      top,
      newest,
      metals,
      flagged
    });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
}
