const BASE = "https://api.blockscout.com/4663/api/v2";

function key() {
  return process.env.BLOCKSCOUT_API_KEY || "";
}

export async function tokenHolders(address) {
  const k = key();
  if (!k || !address) return null;
  try {
    const url = BASE + "/tokens/" + encodeURIComponent(address) + "?apikey=" + encodeURIComponent(k);
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const data = await r.json();
    const n = Number(data.holders_count || data.holders || data.holder_count);
    return Number.isFinite(n) ? n : null;
  } catch (e) {
    return null;
  }
}

export async function fillHolders(coins, limit) {
  const k = key();
  if (!k || !coins || !coins.length) return coins;
  const need = coins.filter((c) => c && c.address && c.holders == null).slice(0, limit || 12);
  await Promise.all(need.map(async (c) => {
    const n = await tokenHolders(c.address);
    if (n != null) c.holders = n;
  }));
  return coins;
}
