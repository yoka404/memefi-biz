const GECKO = "https://api.geckoterminal.com/api/v2/networks/robinhood";
const STOCKKIT = "https://api.stockkit.dev/v1/assets";
const WETH = "0x0bd7d308f8e1639fab988df18a8011f41eacad73";
const USDG = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";
const SKIP = new Set([WETH, USDG, "0x0000000000000000000000000000000000000000"]);
const METALS = new Set(["GLD", "SLV"]);

function addrOf(rel) {
  const id = rel && rel.data && rel.data.id;
  if (!id) return "";
  return String(id).replace(/^robinhood_/, "").toLowerCase();
}
function padFromDex(id) {
  const s = String(id || "").toLowerCase();
  if (s.includes("pons")) return "pons";
  if (s.includes("long")) return "long";
  if (s.includes("bankr")) return "bankr";
  if (s.includes("feel")) return "feel";
  if (s.includes("flap")) return "flap";
  if (s.includes("pair")) return "pair";
  if (s.includes("uniswap") || s.includes("pools-trade")) return "uniswap";
  return "other";
}
async function getJson(url) {
  const r = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "memefi.biz indexer" }
  });
  if (!r.ok) throw new Error(url + " " + r.status);
  return r.json();
}
async function stockkit() {
  const data = await getJson(STOCKKIT);
  const assets = data.assets || [];
  const byAddr = {};
  const bySym = {};
  for (const a of assets) {
    if (!a || !a.address) continue;
    const row = {
      symbol: String(a.symbol || "").toUpperCase(),
      name: a.name || a.symbol,
      address: String(a.address).toLowerCase()
    };
    byAddr[row.address] = row;
    bySym[row.symbol] = row;
  }
  return { assets, byAddr, bySym };
}
async function geckoPage(path) {
  const data = await getJson(GECKO + path);
  return { pools: data.data || [], included: data.included || [] };
}
function tokensFrom(included) {
  const map = {};
  for (const row of included) {
    if (row.type !== "token") continue;
    const addr = String(row.id || "").replace(/^robinhood_/, "").toLowerCase();
    map[addr] = {
      address: addr,
      symbol: (row.attributes && row.attributes.symbol) || "",
      name: (row.attributes && row.attributes.name) || ""
    };
  }
  return map;
}
function ingest(bag, page, stocks) {
  const tokens = tokensFrom(page.included);
  for (const p of page.pools) {
    const a = p.attributes || {};
    const rel = p.relationships || {};
    const base = addrOf(rel.base_token);
    const quote = addrOf(rel.quote_token);
    if (!base || !quote) continue;
    const baseIsStock = !!stocks.byAddr[base];
    const quoteIsStock = !!stocks.byAddr[quote];
    if (baseIsStock === quoteIsStock) continue;
    if (SKIP.has(base) || SKIP.has(quote)) continue;
    const stock = quoteIsStock ? stocks.byAddr[quote] : stocks.byAddr[base];
    const memeAddr = quoteIsStock ? base : quote;
    const memeTok = tokens[memeAddr] || {};
    const dex = rel.dex && rel.dex.data && rel.dex.data.id;
    const liq = Number(a.reserve_in_usd);
    const prev = bag[memeAddr];
    if (prev && Number(prev.liquidityUsd || 0) >= (Number.isFinite(liq) ? liq : 0)) continue;
    bag[memeAddr] = {
      ticker: (memeTok.symbol || "").toUpperCase() || String(a.name || "").split("/")[0].trim(),
      name: memeTok.name || memeTok.symbol || String(a.name || "").split("/")[0].trim(),
      address: memeAddr,
      poolId: String(a.address || "").toLowerCase(),
      pair: stock.symbol,
      stockAddress: stock.address,
      launchpad: padFromDex(dex),
      price: Number(quoteIsStock ? a.base_token_price_usd : a.quote_token_price_usd) || null,
      change24h: a.price_change_percentage && Number(a.price_change_percentage.h24),
      change1h: a.price_change_percentage && Number(a.price_change_percentage.h1),
      change6h: a.price_change_percentage && Number(a.price_change_percentage.h6),
      marketCap: Number(a.market_cap_usd || a.fdv_usd) || null,
      fdv: Number(a.fdv_usd) || null,
      volume24h: a.volume_usd && Number(a.volume_usd.h24),
      liquidityUsd: Number.isFinite(liq) ? liq : null,
      createdAt: a.pool_created_at || null,
      onchain: Number(quoteIsStock ? a.quote_token_price_usd : a.base_token_price_usd) || null
    };
  }
}
export async function buildUniverse() {
  const stocks = await stockkit();
  const bag = {};
  const paths = [
    "/trending_pools?page=1&include=base_token,quote_token",
    "/trending_pools?page=2&include=base_token,quote_token",
    "/new_pools?page=1&include=base_token,quote_token",
    "/new_pools?page=2&include=base_token,quote_token",
    "/pools?page=1&include=base_token,quote_token",
    "/pools?page=2&include=base_token,quote_token",
    "/pools?page=3&include=base_token,quote_token",
    "/dexes/pons-v2/pools?page=1&include=base_token,quote_token",
    "/dexes/pons-v2/pools?page=2&include=base_token,quote_token",
    "/dexes/pons-v2-dex/pools?page=1&include=base_token,quote_token",
    "/dexes/pons-dot-family/pools?page=1&include=base_token,quote_token",
    "/dexes/bankr-robinhood/pools?page=1&include=base_token,quote_token"
  ];
  const pages = await Promise.all(paths.map((p) => geckoPage(p).catch(() => ({ pools: [], included: [] }))));
  for (const page of pages) ingest(bag, page, stocks);
  const coins = Object.values(bag);
  coins.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
  const metals = coins.filter((c) => METALS.has(c.pair));
  const newest = coins.slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const onchain = {};
  for (const c of coins) if (c.pair && c.onchain != null) onchain[c.pair] = c.onchain;
  return {
    source: "memefi-indexer",
    generated: new Date().toISOString(),
    wrappers: stocks.assets.length,
    coins,
    metals,
    newest: newest.slice(0, 80),
    onchain
  };
}
