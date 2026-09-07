import { ethCall } from "./rpc.js";

const PONS_LOCKER = "0x267444d099b10fb5ed7c3cc7b7c767adca574952";
const PARTY_LOCKER_V3 = "0xd64c1f0f26b6f636520bc686f8e25cba58082cfe";
const PARTY_LOCKER_V2 = "0x7bdf342857bbb1ded76b3aa5e0c580d5c87ad49e";
const CUSTODY = [PONS_LOCKER, PARTY_LOCKER_V3, PARTY_LOCKER_V2];
const BALANCE_OF = "0x70a08231";

function norm(a) {
  return String(a || "").toLowerCase();
}
function isAddr(a) {
  return /^0x[a-f0-9]{40}$/.test(norm(a));
}
function decodeAmt(hex, decimals) {
  if (!hex || hex === "0x") return 0;
  try {
    const n = BigInt(hex);
    const d = decimals == null ? 18 : decimals;
    return Number(n) / Math.pow(10, d);
  } catch (e) {
    return 0;
  }
}
export async function tokenBalance(token, holder) {
  if (!isAddr(token) || !isAddr(holder)) return 0;
  const data = BALANCE_OF + norm(holder).slice(2).padStart(64, "0");
  const raw = await ethCall(token, data);
  return decodeAmt(raw, 18);
}

export async function fillOnchainLocked(coins, onchain) {
  if (!coins || !coins.length) return coins;
  const stocks = {};
  for (const c of coins) {
    const s = norm(c.stockAddress);
    if (!isAddr(s)) continue;
    if (!stocks[s]) stocks[s] = { address: s, symbol: c.pair, pools: [], price: onchain && onchain[c.pair] != null ? Number(onchain[c.pair]) : null };
    if (isAddr(c.poolId)) stocks[s].pools.push(norm(c.poolId));
    if (c.onchain != null && stocks[s].price == null) stocks[s].price = Number(c.onchain);
  }
  await Promise.all(Object.values(stocks).map(async (row) => {
    const holders = CUSTODY.concat(row.pools);
    const seen = new Set();
    let units = 0;
    for (const h of holders) {
      if (!h || seen.has(h)) continue;
      seen.add(h);
      units += await tokenBalance(row.address, h);
    }
    row.units = units;
    row.usd = row.price != null && units > 0 ? units * row.price : 0;
  }));
  for (const c of coins) {
    const row = stocks[norm(c.stockAddress)];
    if (!row) continue;
    const poolUnits = isAddr(c.poolId) ? await tokenBalance(c.stockAddress, c.poolId) : 0;
    const px = row.price != null ? row.price : (Number(c.onchain) || null);
    if (poolUnits > 0 && px != null) {
      c.stockLockedUnits = poolUnits;
      c.stockLockedUsd = poolUnits * px;
      c.lockedSource = "rpc";
    } else if ((!c.stockLockedUsd || c.stockLockedUsd === 0) && row.usd > 0 && px != null) {
      c.lockedSource = c.stockLockedUsd ? c.lockedSource : "dex";
    }
  }
  const totals = Object.values(stocks).reduce((n, r) => n + (r.usd || 0), 0);
  return { coins, custodyUsd: totals, byStock: stocks };
}
