function rpcUrl() {
  return process.env.RH_RPC_URL || "";
}

export async function ethCall(to, data) {
  const url = rpcUrl();
  if (!url || !to) return null;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "eth_call",
        params: [{ to: to, data: data }, "latest"]
      })
    });
    if (!r.ok) return null;
    const dataOut = await r.json();
    return dataOut.result || null;
  } catch (e) {
    return null;
  }
}

export function decodeAddress(hex) {
  if (!hex || typeof hex !== "string" || hex.length < 42) return null;
  return ("0x" + hex.slice(-40)).toLowerCase();
}

export async function tokenOwner(address) {
  const raw = await ethCall(address, "0x8da5cb5b");
  return decodeAddress(raw);
}
