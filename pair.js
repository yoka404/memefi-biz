function addrFromPath() {
  const parts = location.pathname.split("/").filter(Boolean);
  if (parts[0] === "p" && parts[1]) return parts[1].toLowerCase();
  const q = new URLSearchParams(location.search).get("address");
  return (q || "").toLowerCase();
}
function fmtPx(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  if (x >= 100) return x.toFixed(2);
  if (x >= 1) return x.toFixed(2);
  if (x >= 0.01) return x.toFixed(4);
  return x.toPrecision(4);
}
function fmtUsd(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  if (Math.abs(x) >= 1e9) return (x / 1e9).toFixed(2) + "B";
  if (Math.abs(x) >= 1e6) return (x / 1e6).toFixed(2) + "M";
  if (Math.abs(x) >= 1e3) return (x / 1e3).toFixed(1) + "K";
  return String(Math.round(x));
}
function prem(onchain, cash) {
  if (!Number.isFinite(onchain) || !Number.isFinite(cash) || cash <= 0) return null;
  return ((onchain / cash) - 1) * 100;
}

async function main() {
  const address = addrFromPath();
  const title = document.getElementById("title");
  if (!/^0x[a-f0-9]{40}$/.test(address)) {
    title.textContent = "Unknown pair";
    return;
  }
  const r = await fetch("/api/coin?address=" + address);
  if (!r.ok) {
    title.textContent = "Pair not on the board";
    return;
  }
  const data = await r.json();
  const c = data.coin;
  const s = data.stock;
  const cash = data.cash;
  const onchain = s && s.onchain;
  const p = prem(onchain, cash);
  document.title = "$" + c.ticker + " / " + c.pair + " · MEMEFI";
  document.getElementById("pad").textContent = (c.launchpad || "airlock") + " · Robinhood Chain";
  title.textContent = "$" + c.ticker + " / " + c.pair;
  document.getElementById("sub").textContent = (c.name || c.ticker) + " is quoted against tokenized " + c.pair + ". This file is permanent for this contract.";
  document.getElementById("pills").innerHTML = `
    <div><em>Last</em><b>${fmtPx(c.price)}</b></div>
    <div><em>${c.pair} on-chain</em><b>${onchain != null ? fmtPx(onchain) : "—"}</b></div>
    <div><em>Cash</em><b>${cash != null ? fmtPx(cash) : "—"}</b></div>
    <div><em>Premium</em><b>${p == null ? "n/a" : ((p > 0 ? "+" : "") + p.toFixed(1) + "%")}</b></div>`;
  const rows = [
    ["Name", c.name || "—"],
    ["Ticker", "$" + c.ticker],
    ["Paired stock", c.pair + (s && s.name ? " — " + s.name : "")],
    ["Market cap", fmtUsd(c.marketCap)],
    ["Volume 24h", fmtUsd(c.volume24h)],
    ["Liquidity", fmtUsd(c.liquidityUsd)],
    ["Stock locked", (c.stockLockedUnits != null ? Number(c.stockLockedUnits).toFixed(2) + " " + c.pair : "—") + " · " + fmtUsd(c.stockLockedUsd)],
    ["Holders", c.holders != null ? c.holders : "—"],
    ["Fee", c.lpFeePct != null ? c.lpFeePct + "%" : "—"],
    ["LP locked", c.lockedForever ? "permanent" : "see contract"],
    ["Launched", c.launchedAt || "—"],
    ["Token", `<a href="https://robinscan.io/token/${c.address}" target="_blank" rel="noopener">${c.address}</a>`],
    ["Pool", c.poolId ? `<a href="https://dexscreener.com/robinhood/${c.poolId}" target="_blank" rel="noopener">DexScreener</a>` : "—"],
    ["Stock token", s && s.address ? `<a href="https://robinscan.io/token/${s.address}" target="_blank" rel="noopener">${s.address}</a>` : "—"]
  ];
  document.getElementById("file").innerHTML = rows.map((row) => `<tr><th>${row[0]}</th><td>${row[1]}</td></tr>`).join("");
}
main();
