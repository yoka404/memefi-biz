export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
  const address = String(req.query.address || "");
  if (!address) {
    res.status(400).json({ error: "missing address" });
    return;
  }
  const url = "https://api.dexscreener.com/latest/dex/tokens/" + address;
  const r = await fetch(url, { headers: { "User-Agent": "memefi.biz/1.0" } });
  const data = await r.json();
  res.status(r.ok ? 200 : r.status).json(data);
}
