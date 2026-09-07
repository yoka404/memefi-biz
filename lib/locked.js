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
function decodeAmt(hex) {
  if (!hex || hex === "0x") return 0;
  try {
    return Number(BigInt(hex)) / 1e18;
  } catch (e) {
    return 0;
  }
}
async function tokenBalance(token, holder) {
  if (!isAddr(token) || !isAddr(holder)) return 0;
  const data = BALANCE_OF + norm(holder).slice(2).padStart(64, "0");
  const raw = await ethCall(token, data);
  return decodeAmt(raw);
}

export async function fillOnchainLocked(coins, onchain) {
  const list = (coins || []).filter((c) => isAddr(c.stockAddress));
  const jobs = [];
  const seen = new Set();
  function add(token, holder) {
    const key = norm(token) + ":" + norm(holder);
    if (seen.has(key)) return;
    seen.add(key);
    jobs.push({ token: norm(token), holder: norm(holder) });
  }
  for (const c of list) {
    for (const h of CUSTODY) add(c.stockAddress, h);
    if (isAddr(c.poolId)) add(c.stockAddress, c.poolId);
  }
  const bal = {};
  await Promise.all(jobs.map(async (j) => {
    bal[j.token + ":" + j.holder] = await tokenBalance(j.token, j.holder);
  }));
  for (const c of list) {
    const px = (onchain && onchain[c.pair] != null) ? Number(onchain[c.pair]) : Number(c.onchain);
    const poolUnits = isAddr(c.poolId) ? (bal[norm(c.stockAddress) + ":" + norm(c.poolId)] || 0) : 0;
    if (poolUnits > 0 && px > 0) {
      c.stockLockedUnits = poolUnits;
      c.stockLockedUsd = poolUnits * px;
      c.lockedSource = "rpc";
    }
  }
  const byStock = {};
  for (const c of list) {
    const s = norm(c.stockAddress);
    if (!byStock[s]) {
      const px = (onchain && onchain[c.pair] != null) ? Number(onchain[c.pair]) : Number(c.onchain);
      let units = 0;
      for (const h of CUSTODY) units += bal[s + ":" + h] || 0;
      byStock[s] = { symbol: c.pair, units, usd: px > 0 ? units * px : 0 };
    }
  }
  const custodyUsd = Object.values(byStock).reduce((n, r) => n + (r.usd || 0), 0);
  return { custodyUsd, byStock };
}
