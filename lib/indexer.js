const GECKO = "https://api.geckoterminal.com/api/v2/networks/robinhood";
const STOCKKIT = "https://api.stockkit.dev/v1/assets";
const DEX_TOKENS = "https://api.dexscreener.com/latest/dex/tokens/";
const WETH = "0x0bd7d308f8e1639fab988df18a8011f41eacad73";
const USDG = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";
const SKIP = new Set([WETH, USDG, "0x0000000000000000000000000000000000000000"]);
const METALS = new Set(["GLD", "SLV"]);
const PRIORITY = ["NVDA","AMC","HIMS","MU","AAPL","SPY","GME","MSTR","TSLA","GLD","SLV","HOOD","LLY","PFE","RKLB","SPCX","COST","AMD","COIN","PLTR","MSFT","AMZN","META","NFLX","INTC","BABA","QQQ","IWM","BB","DJT"];

function norm(a) {
  return String(a || "").toLowerCase();
}
function up(s) {
  return String(s || "").toUpperCase();
}
function padFromDex(id) {
  const s = String(id || "").toLowerCase();
  if (s.includes("pons")) return "pons";
  if (s.includes("long") || s.includes("doppler") || s.includes("airlock")) return "long";
  if (s.includes("flap")) return "flap";
  return "unknown";
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
  const logos = {};
  for (const a of assets) {
    if (!a || !a.address) continue;
    const row = {
      symbol: up(a.symbol),
      name: a.name || a.symbol,
      address: norm(a.address),
      logoUrl: a.logoUrl || null
    };
    byAddr[row.address] = row;
    bySym[row.symbol] = row;
    if (row.logoUrl) logos[row.symbol] = row.logoUrl;
  }
  return { assets, byAddr, bySym, logos };
}
function putCoin(bag, row) {
  if (!row || !row.address) return;
  const prev = bag[row.address];
  const liq = Number(row.liquidityUsd) || 0;
  if (prev && Number(prev.liquidityUsd || 0) >= liq) {
    if (!prev.dexImage && row.dexImage) prev.dexImage = row.dexImage;
    if (!prev.geckoImage && row.geckoImage) prev.geckoImage = row.geckoImage;
    if (prev.stockLockedUnits == null && row.stockLockedUnits != null) prev.stockLockedUnits = row.stockLockedUnits;
    if (prev.stockLockedUsd == null && row.stockLockedUsd != null) prev.stockLockedUsd = row.stockLockedUsd;
    return;
  }
  bag[row.address] = row;
}
function ingestDexPair(bag, p, stocks) {
  if (!p || String(p.chainId || "").toLowerCase() !== "robinhood") return;
  const base = norm(p.baseToken && p.baseToken.address);
  const quote = norm(p.quoteToken && p.quoteToken.address);
  if (!base || !quote) return;
  if (SKIP.has(base) || SKIP.has(quote)) return;
  const baseIsStock = !!stocks.byAddr[base];
  const quoteIsStock = !!stocks.byAddr[quote];
  if (baseIsStock === quoteIsStock) return;
  const stock = quoteIsStock ? stocks.byAddr[quote] : stocks.byAddr[base];
  const meme = quoteIsStock ? p.baseToken : p.quoteToken;
  const memeAddr = quoteIsStock ? base : quote;
  const liq = p.liquidity || {};
  const liqUsd = Number(liq.usd);
  const qAmt = Number(liq.quote);
  const bAmt = Number(liq.base);
  const px = Number(p.priceUsd);
  const native = Number(p.priceNative);
  let units = null;
  let lockedUsd = null;
  if (quoteIsStock && qAmt > 0) {
    units = qAmt;
    if (px > 0 && native > 0) lockedUsd = units * (px / native);
  } else if (baseIsStock && bAmt > 0) {
    units = bAmt;
    if (px > 0) lockedUsd = units * px;
  }
  const ch = p.priceChange || {};
  const created = p.pairCreatedAt;
  putCoin(bag, {
    ticker: up(meme && meme.symbol),
    name: (meme && meme.name) || (meme && meme.symbol),
    address: memeAddr,
    poolId: norm(p.pairAddress),
    pair: stock.symbol,
    stockAddress: stock.address,
    launchpad: padFromDex(p.dexId),
    price: quoteIsStock ? px : px,
    change24h: ch.h24 != null ? Number(ch.h24) : null,
    change1h: ch.h1 != null ? Number(ch.h1) : null,
    change6h: ch.h6 != null ? Number(ch.h6) : null,
    marketCap: Number(p.marketCap || p.fdv) || null,
    fdv: Number(p.fdv) || null,
    volume24h: p.volume && Number(p.volume.h24),
    liquidityUsd: Number.isFinite(liqUsd) ? liqUsd : null,
    createdAt: created ? new Date(created).toISOString() : null,
    onchain: (quoteIsStock && px > 0 && native > 0) ? (px / native) : (baseIsStock ? px : null),
    stockLockedUnits: units,
    stockLockedUsd: lockedUsd,
    dexImage: p.info && p.info.imageUrl,
    listed: true
  });
}
async function dexPairs(addrs) {
  const out = [];
  for (let i = 0; i < addrs.length; i += 4) {
    const chunk = addrs.slice(i, i + 4);
    try {
      const data = await getJson(DEX_TOKENS + chunk.join(","));
      for (const p of (data.pairs || [])) out.push(p);
    } catch (e) {}
  }
  return out;
}
async function dexForWrappers(stocks) {
  const seen = new Set();
  const first = [];
  for (const s of PRIORITY) {
    const row = stocks.bySym[s];
    if (row && row.address && !seen.has(row.address)) {
      seen.add(row.address);
      first.push(row.address);
    }
  }
  const rest = [];
  for (const a of stocks.assets) {
    const addr = a && a.address;
    if (!addr || seen.has(addr)) continue;
    seen.add(addr);
    rest.push(addr);
  }
  const a = await dexPairs(first);
  const b = await dexPairs(rest.slice(0, 80));
  return a.concat(b);
}
async function geckoPage(path) {
  const data = await getJson(GECKO + path);
  return { pools: data.data || [], included: data.included || [] };
}
function addrOf(rel) {
  const id = rel && rel.data && rel.data.id;
  if (!id) return "";
  return String(id).replace(/^robinhood_/, "").toLowerCase();
}
function tokensFrom(included) {
  const map = {};
  for (const row of included) {
    if (row.type !== "token") continue;
    const addr = String(row.id || "").replace(/^robinhood_/, "").toLowerCase();
    const a = row.attributes || {};
    map[addr] = { address: addr, symbol: a.symbol || "", name: a.name || "", image: a.image_url || a.image || null };
  }
  return map;
}
function ingestGecko(bag, page, stocks) {
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
    putCoin(bag, {
      ticker: up(memeTok.symbol) || String(a.name || "").split("/")[0].trim(),
      name: memeTok.name || memeTok.symbol || String(a.name || "").split("/")[0].trim(),
      address: memeAddr,
      poolId: norm(a.address),
      pair: stock.symbol,
      stockAddress: stock.address,
      launchpad: padFromDex(dex),
      price: Number(quoteIsStock ? a.base_token_price_usd : a.quote_token_price_usd) || null,
      change24h: a.price_change_percentage && Number(a.price_change_percentage.h24),
      marketCap: Number(a.market_cap_usd || a.fdv_usd) || null,
      fdv: Number(a.fdv_usd) || null,
      volume24h: a.volume_usd && Number(a.volume_usd.h24),
      liquidityUsd: Number(a.reserve_in_usd) || null,
      createdAt: a.pool_created_at || null,
      onchain: Number(quoteIsStock ? a.quote_token_price_usd : a.base_token_price_usd) || null,
      geckoImage: memeTok.image || null,
      listed: true
    });
  }
}
export async function buildUniverse() {
  const stocks = await stockkit();
  const bag = {};
  const dexPairsFound = await dexForWrappers(stocks);
  for (const p of dexPairsFound) ingestDexPair(bag, p, stocks);
  const geckoPaths = [];
  for (const kind of ["trending_pools", "new_pools", "pools"]) {
    for (let page = 1; page <= 3; page++) geckoPaths.push("/" + kind + "?page=" + page + "&include=base_token,quote_token");
  }
  const pages = await Promise.all(geckoPaths.map((p) => geckoPage(p).catch(() => ({ pools: [], included: [] }))));
  for (const page of pages) ingestGecko(bag, page, stocks);
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
    onchain,
    logos: stocks.logos || {},
    equitiesPaired: new Set(coins.map((c) => c.pair).filter(Boolean)).size
  };
}
