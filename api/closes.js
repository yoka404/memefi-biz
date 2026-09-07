const SYMBOLS = ["AMC", "NVDA", "HIMS", "MU", "MSTR", "TSLA", "HOOD"];

async function yahoo(symbol) {
  const url = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol) + "?interval=1d&range=5d";
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 memefi.biz" } });
  if (!r.ok) throw new Error(symbol + " " + r.status);
  const data = await r.json();
  const meta = data.chart.result[0].meta;
  return {
    symbol,
    cash: Number(meta.regularMarketPrice),
    currency: meta.currency,
    exchange: meta.fullExchangeName || meta.exchangeName
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  const raw = String(req.query.symbols || SYMBOLS.join(","));
  const symbols = raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const out = {};
  await Promise.all(symbols.map(async (s) => {
    try { out[s] = await yahoo(s); }
    catch (e) { out[s] = { symbol: s, cash: null, error: String(e.message || e) }; }
  }));
  res.status(200).json({ quotes: out });
}
