function norm(a) {
  return String(a || "").toLowerCase();
}

function bestPair(pairs, meme) {
  const want = norm(meme);
  const list = (pairs || []).filter((p) => {
    const base = norm(p.baseToken && p.baseToken.address);
    const quote = norm(p.quoteToken && p.quoteToken.address);
    return base === want || quote === want;
  });
  list.sort((a, b) => {
    const la = Number((a.liquidity && a.liquidity.usd) || 0);
    const lb = Number((b.liquidity && b.liquidity.usd) || 0);
    const ma = Number(a.marketCap || a.fdv || 0);
    const mb = Number(b.marketCap || b.fdv || 0);
    return (lb - la) || (mb - ma);
  });
  return list[0] || null;
}

export async function dexToken(address) {
  if (!address) return null;
  try {
    const r = await fetch("https://api.dexscreener.com/tokens/v1/robinhood/" + encodeURIComponent(address), {
      headers: { Accept: "application/json" }
    });
    if (!r.ok) return null;
    const pairs = await r.json();
    const p = bestPair(Array.isArray(pairs) ? pairs : [], address);
    if (!p) return null;
    const base = norm(p.baseToken && p.baseToken.address);
    const memeIsBase = base === norm(address);
    return {
      poolId: String(p.pairAddress || "").toLowerCase(),
      price: Number(p.priceUsd) || null,
      marketCap: Number(p.marketCap || p.fdv) || null,
      fdv: Number(p.fdv) || null,
      volume24h: p.volume && Number(p.volume.h24),
      change24h: p.priceChange && Number(p.priceChange.h24),
      liquidityUsd: p.liquidity && Number(p.liquidity.usd),
      dexImage: p.info && p.info.imageUrl
    };
  } catch (e) {
    return null;
  }
}

export async function fillDex(coins, limit) {
  const need = (coins || []).filter((c) => c && c.address).slice(0, limit || 24);
  await Promise.all(need.map(async (c) => {
    const live = await dexToken(c.address);
    if (!live) return;
    if (live.poolId) c.poolId = live.poolId;
    if (live.marketCap != null) c.marketCap = live.marketCap;
    if (live.price != null) c.price = live.price;
    if (live.volume24h != null) c.volume24h = live.volume24h;
    if (live.change24h != null) c.change24h = live.change24h;
    if (live.liquidityUsd != null) c.liquidityUsd = live.liquidityUsd;
    if (live.dexImage) c.dexImage = live.dexImage;
  }));
  return coins;
}
