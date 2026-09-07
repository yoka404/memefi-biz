function rpcUrl() {
  return process.env.RH_RPC_URL || process.env.ALCHEMY_RPC_URL || "";
}

async function rpc(method, params) {
  const url = rpcUrl();
  if (!url) return null;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: method, params: params || [] })
    });
    if (!r.ok) return null;
    const dataOut = await r.json();
    return dataOut.result || null;
  } catch (e) {
    return null;
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
