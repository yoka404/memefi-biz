const PUBLIC_RPC = "https://rpc.mainnet.chain.robinhood.com";
const MAX_INFLIGHT = 6;
const CACHE_MS = 45000;
const BLOCK_MS = 12000;

const cache = new Map();
let inflight = 0;
const waiters = [];
let rpcIndex = 0;

function endpoints() {
  const out = [];
  if (process.env.RH_RPC_URL) out.push(process.env.RH_RPC_URL);
  if (process.env.ALCHEMY_RPC_URL && process.env.ALCHEMY_RPC_URL !== process.env.RH_RPC_URL) out.push(process.env.ALCHEMY_RPC_URL);
  out.push(PUBLIC_RPC);
  return out;
}

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > (hit.ttl || CACHE_MS)) {
    cache.delete(key);
    return null;
  }
  return hit.val;
}
function cacheSet(key, val, ttl) {
  cache.set(key, { val, at: Date.now(), ttl: ttl || CACHE_MS });
  if (cache.size > 800) {
    const first = cache.keys().next().value;
    cache.delete(first);
  }
}

function acquire() {
  if (inflight < MAX_INFLIGHT) {
    inflight += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => waiters.push(resolve));
}
function release() {
  const next = waiters.shift();
  if (next) next();
  else inflight = Math.max(0, inflight - 1);
}

async function post(url, method, params) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params: params || [] })
  });
  if (r.status === 429) {
    const err = new Error("429");
    err.code = 429;
    throw err;
  }
  if (!r.ok) return null;
  const data = await r.json();
  if (data && data.error && /429|rate|capacity/i.test(String(data.error.message || data.error))) {
    const err = new Error("429");
    err.code = 429;
    throw err;
  }
  return data && data.result !== undefined ? data.result : null;
}

async function rpc(method, params) {
  const key = method + ":" + JSON.stringify(params || []);
  const cached = cacheGet(key);
  if (cached !== null && cached !== undefined) return cached;
  const urls = endpoints();
  if (!urls.length) return null;
  await acquire();
  try {
    for (let attempt = 0; attempt < urls.length; attempt++) {
      const url = urls[(rpcIndex + attempt) % urls.length];
      try {
        const result = await post(url, method, params);
        cacheSet(key, result, method === "eth_blockNumber" ? BLOCK_MS : CACHE_MS);
        return result;
      } catch (e) {
        if (e && e.code === 429) {
          rpcIndex = (rpcIndex + 1) % urls.length;
          await new Promise((ok) => setTimeout(ok, 250 * (attempt + 1)));
          continue;
        }
      }
    }
    return cacheGet(key);
  } finally {
    release();
  }
}

export async function ethCall(to, data) {
  return rpc("eth_call", [{ to: to, data: data }, "latest"]);
}

export async function latestBlock() {
  const raw = await rpc("eth_blockNumber", []);
  if (!raw) return null;
  try {
    const n = Number(BigInt(raw));
    return Number.isFinite(n) ? n : null;
  } catch (e) {
    return null;
  }
}

export function decodeAddress(hex) {
  if (!hex || typeof hex !== "string" || hex.length < 42) return null;
  return ("0x" + hex.slice(-40)).toLowerCase();
}

function hexToInt(hex) {
  if (!hex || hex === "0x") return null;
  try { return BigInt(hex); } catch (e) { return null; }
}

export async function tokenOwner(address) {
  const raw = await ethCall(address, "0x8da5cb5b");
  return decodeAddress(raw);
}

export async function tokenBalance(token, holder) {
  if (!token || !holder) return 0;
  const data = "0x70a08231" + String(holder).toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const raw = await ethCall(token, data);
  const n = hexToInt(raw);
  if (n == null) return 0;
  return Number(n);
}

export async function tokenDecimals(address) {
  const raw = await ethCall(address, "0x313ce567");
  const n = hexToInt(raw);
  if (n == null) return 18;
  const d = Number(n);
  return Number.isFinite(d) && d >= 0 && d <= 36 ? d : 18;
}

export async function tokenSupply(address) {
  const raw = await ethCall(address, "0x18160ddd");
  const n = hexToInt(raw);
  if (n == null) return null;
  const dec = await tokenDecimals(address);
  const denom = 10 ** dec;
  const x = Number(n) / denom;
  return Number.isFinite(x) ? x : null;
}
