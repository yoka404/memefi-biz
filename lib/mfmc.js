const URL = "https://memefimarketcap.com/data.json";
let cache = null;
let at = 0;

export async function loadMfmc() {
  const now = Date.now();
  if (cache && now - at < 45000) return cache;
  const r = await fetch(URL, {
    headers: { Accept: "application/json", "User-Agent": "memefi.biz" }
  });
  if (!r.ok) throw new Error("mfmc " + r.status);
  const data = await r.json();
  const agg = data.aggregates || {};
  const listing = data.listing || {};
  const meta = data.meta || {};
  const coins = Array.isArray(data.coins) ? data.coins : [];
  const byAddr = {};
  for (const c of coins) {
    const a = String(c.address || "").toLowerCase();
    if (a) byAddr[a] = c;
  }
  cache = {
    generated: meta.generated || null,
    headBlock: meta.headBlock || null,
    stockLockedUsd: Number(agg.stockLockedUsd && agg.stockLockedUsd.total),
    stockLockedKnown: Number(agg.stockLockedUsd && agg.stockLockedUsd.known),
    marketCapUsd: Number(agg.marketCapUsd && agg.marketCapUsd.total),
    volume24h: Number(agg.volume24hUsd && agg.volume24hUsd.total),
    fees24h: Number(agg.fees24hUsd && agg.fees24hUsd.total),
    holders: Number(agg.holders && agg.holders.total),
    coinsListed: Number(agg.coinsListed),
    equitiesPaired: Number(agg.equitiesPaired),
    launches: Number(listing.totalLaunchesOnChain),
    coins,
    byAddr
  };
  at = now;
  return cache;
}

export function mergeMfmc(row, book) {
  if (!row || !book) return row;
  const hit = book.byAddr[String(row.address || "").toLowerCase()];
  if (!hit) return row;
  const out = Object.assign({}, row);
  if (hit.stockLockedUsd != null) out.stockLockedUsd = Number(hit.stockLockedUsd);
  if (hit.stockLockedUnits != null) out.stockLockedUnits = Number(hit.stockLockedUnits);
  if (hit.holders != null) out.holders = Number(hit.holders);
  if (hit.launchpad) out.launchpad = hit.launchpad;
  if (hit.poolId && !out.poolId) out.poolId = hit.poolId;
  if (hit.pair && !out.pair) out.pair = hit.pair;
  if (hit.marketCap != null && !(Number(out.marketCap) > 0)) out.marketCap = Number(hit.marketCap);
  if (hit.volume24h != null && out.volume24h == null) out.volume24h = Number(hit.volume24h);
  if (hit.change24h != null && out.change24h == null) out.change24h = Number(hit.change24h);
  if (hit.logo && !out.logo) out.logo = hit.logo;
  return out;
}
