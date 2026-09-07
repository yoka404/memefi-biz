export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
  const ids = String(req.query.ids || "");
  if (!ids) {
    res.status(400).json({ error: "missing ids" });
    return;
  }
  const url = "https://api.dexscreener.com/latest/dex/pairs/robinhood/" + ids;
  const r = await fetch(url, { headers: { "User-Agent": "memefi.biz/1.0" } });
  const data = await r.json();
  res.status(r.ok ? 200 : r.status).json(data);
}
