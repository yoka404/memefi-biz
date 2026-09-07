function addrFromPath() {
  const parts = location.pathname.split("/").filter(Boolean);
  if (parts[0] === "p" && parts[1]) return parts[1].toLowerCase();
  return (new URLSearchParams(location.search).get("address") || "").toLowerCase();
}
function fmtPx(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  if (x >= 1) return "$" + x.toFixed(2);
  if (x >= 0.01) return "$" + x.toFixed(5);
  if (x > 0) return "$" + Number(x.toPrecision(4));
  return "—";
}
function fmtUsd(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  if (Math.abs(x) >= 1e9) return "$" + (x / 1e9).toFixed(2) + "B";
  if (Math.abs(x) >= 1e6) return "$" + (x / 1e6).toFixed(2) + "M";
  if (Math.abs(x) >= 1e3) return "$" + (x / 1e3).toFixed(1) + "K";
  return "$" + Math.round(x);
}
function prem(onchain, cash) {
  if (!Number.isFinite(onchain) || !Number.isFinite(cash) || cash <= 0) return null;
  return ((onchain / cash) - 1) * 100;
}
function setAvatar(img, urls) {
  const queue = urls.filter(Boolean);
  const next = () => {
    const u = queue.shift();
    if (!u) { img.removeAttribute("src"); img.alt = ""; return; }
    img.onerror = next;
    img.src = u;
  };
  next();
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
  const wrap = (Number(c.price) && Number(c.priceNative)) ? Number(c.price) / Number(c.priceNative) : onchain;
  const p = prem(wrap, cash);
  document.title = "$" + c.ticker + " / " + (c.pair || "") + " · MEMEFI";
  document.getElementById("pad").textContent = (c.launchpad || "airlock") + " · Robinhood Chain";
  title.textContent = (c.name || c.ticker) + "  " + c.ticker;
  document.getElementById("sub").textContent = "$" + c.ticker + " is quoted against tokenized " + (c.pair || "—") + ". Permanent file for this contract.";
  setAvatar(document.getElementById("avatar"), [c.logoDetail, c.logo, c.imageUri, c.dexImage]);
  if (data.flagged) {
    const f = document.getElementById("flag");
    f.hidden = false;
    f.textContent = "Flagged: " + data.flagged;
  }
  const socials = document.getElementById("socials");
  socials.innerHTML = (c.socials || []).map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${s.type}</a>`).join("") || "<span class=\"mute\">No socials in token metadata</span>";
  document.getElementById("pills").innerHTML = `
    <div><em>Last</em><b>${fmtPx(c.price)}</b></div>
    <div><em>${c.pair || "stock"} on-chain</em><b>${wrap != null ? fmtPx(wrap) : "—"}</b></div>
    <div><em>Cash</em><b>${cash != null ? fmtPx(cash) : "—"}</b></div>
    <div><em>Premium</em><b>${p == null ? "n/a" : ((p > 0 ? "+" : "") + p.toFixed(1) + "%")}</b></div>
    <div><em>Market cap</em><b>${fmtUsd(c.marketCap)}</b></div>
    <div><em>Volume 24h</em><b>${fmtUsd(c.volume24h)}</b></div>`;
  const rows = [
    ["Paired stock", (c.pair || "—") + (s && s.name ? " — " + s.name : "")],
    ["Liquidity", fmtUsd(c.liquidityUsd)],
    ["Stock locked", (c.stockLockedUnits != null ? Number(c.stockLockedUnits).toFixed(2) + " " + c.pair : "—") + " · " + fmtUsd(c.stockLockedUsd)],
    ["Holders", c.holders != null ? Number(c.holders).toLocaleString("en-US") : "—"],
    ["Fee", c.lpFeePct != null ? c.lpFeePct + "%" : "—"],
    ["LP", c.lockedForever ? "permanently locked" : "see contract"],
    ["Launched", c.launchedAt || "—"],
    ["Token", `<a href="https://robinscan.io/token/${c.address}" target="_blank" rel="noopener">${c.address}</a>`],
    ["Dex", c.poolId ? `<a href="https://dexscreener.com/robinhood/${c.poolId}" target="_blank" rel="noopener">DexScreener</a>` : "—"],
    ["Stock token", s && s.address ? `<a href="https://robinscan.io/token/${s.address}" target="_blank" rel="noopener">${s.address}</a>` : "—"]
  ];
  document.getElementById("file").innerHTML = rows.map((row) => `<tr><th>${row[0]}</th><td>${row[1]}</td></tr>`).join("");
}
main();
