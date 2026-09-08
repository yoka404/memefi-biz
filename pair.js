const ICONS = {
  x: '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M18.9 2H22l-6.8 7.8L23 22h-6.3l-4.9-6.4L6.3 22H3.2l7.3-8.4L1 2h6.5l4.4 5.8L18.9 2zm-1.1 18h1.7L6.3 3.9H4.5L17.8 20z"/></svg>',
  telegram: '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M21.5 3.2L2.7 10.4c-1.3.5-1.3 1.2-.2 1.5l4.8 1.5 11.1-7c.5-.3 1-.1.6.2l-9 8.2-.3 4.8c.5 0 .7-.2 1-.5l2.4-2.3 5 3.7c.9.5 1.6.2 1.8-.8l3.3-15.4c.3-1.4-.5-2-1.7-1.6z"/></svg>',
  website: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  discord: '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M19.3 5.2A18 18 0 0 0 14.9 4l-.2.4a16 16 0 0 1 3.1 1.2 16 16 0 0 0-13.6 0A16 16 0 0 1 9.3 4L9.1 4a18 18 0 0 0-4.4 1.2C1.9 9.1 1.2 12.8 1.4 16.5a18 18 0 0 0 5.4 2.7l.7-1.1a12 12 0 0 1-1.9-.9l.5-.4a13 13 0 0 0 11.8 0l.5.4a12 12 0 0 1-1.9.9l.7 1.1a18 18 0 0 0 5.4-2.7c.3-4.2-.5-7.8-2.3-11.3zM8.7 14.4c-.8 0-1.5-.8-1.5-1.7s.7-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7zm6.6 0c-.8 0-1.5-.8-1.5-1.7s.7-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7z"/></svg>',
  dex: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h10M4 17h7"/></svg>'
};
const SCAN = "https://rh-scan.com";

function addrFromPath() {
  const parts = location.pathname.split("/").filter(Boolean);
  if (parts[0] === "p" && parts[1]) return parts[1].toLowerCase();
  return (new URLSearchParams(location.search).get("address") || "").toLowerCase();
}
function fmtPx(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  if (x >= 1) return "$" + x.toLocaleString("en-US", { maximumFractionDigits: 2 });
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
function fmtChg(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return (x >= 0 ? "+" : "") + x.toFixed(2) + "%";
}
function prem(onchain, cash) {
  if (!Number.isFinite(onchain) || !Number.isFinite(cash) || cash <= 0) return null;
  return ((onchain / cash) - 1) * 100;
}
function socialKind(type, url) {
  const t = String(type || "").toLowerCase();
  const u = String(url || "").toLowerCase();
  if (t === "twitter" || u.includes("x.com") || u.includes("twitter.com")) return "x";
  if (t === "telegram" || u.includes("t.me")) return "telegram";
  if (t === "discord" || u.includes("discord")) return "discord";
  if (t === "website" || t === "web") return "website";
  return "website";
}
function labelKind(k) {
  return { x: "X", telegram: "Telegram", discord: "Discord", website: "Website", dex: "Dex" }[k] || k;
}
function padPretty(raw) {
  const s = String(raw || "").toLowerCase();
  if (s === "pons-v3") return "Pons V3";
  if (s === "pons-v2") return "Pons V2";
  if (s === "pons-v1" || s === "pons") return "Pons V1";
  if (s.includes("long")) return "long.xyz";
  if (s.includes("bankr")) return "Bankr";
  if (s.includes("feel")) return "feel.cash";
  if (s.includes("flap")) return "Flap";
  if (s === "o1") return "o1.exchange";
  if (s === "pair") return "pair.fund";
  return raw || "dex";
}
function shortAddr(a) {
  const s = String(a || "");
  if (s.length < 12) return s;
  return s.slice(0, 6) + "…" + s.slice(-4);
}
function copyBtn(value) {
  if (!value) return "";
  return '<button type="button" class="copy" data-copy="' + String(value).replace(/"/g, "") + '">Copy</button>';
}
function addrCell(value, href) {
  if (!value) return "—";
  const link = href
    ? '<a href="' + href + '" target="_blank" rel="noopener"><code>' + shortAddr(value) + '</code></a>'
    : '<code>' + shortAddr(value) + '</code>';
  return '<div class="addr">' + link + copyBtn(value) + '</div>';
}
function setAvatar(img, urls) {
  const queue = urls.filter(Boolean);
  const sk = document.getElementById("avatar-skel");
  img.hidden = false;
  if (sk) sk.remove();
  const next = () => {
    const u = queue.shift();
    if (!u) { img.removeAttribute("src"); return; }
    img.onerror = next;
    img.src = u;
  };
  next();
}
function xlHeader(url) {
  if (!url) return null;
  if (url.indexOf("cdn.dexscreener.com/cms") === -1) return url;
  return url.replace(/width=\d+/, "width=1500").replace(/height=\d+/, "height=500");
}
function setBanner(url, address) {
  const b = document.getElementById("banner");
  if (!b) return;
  const queue = [];
  const xl = xlHeader(url);
  if (xl) queue.push(xl);
  if (url && url !== xl) queue.push(url);
  if (address) {
    queue.push("https://dd.dexscreener.com/ds-data/tokens/robinhood/" + address + "/header.png?size=xl");
    queue.push("https://dd.dexscreener.com/ds-data/tokens/robinhood/" + address + "/header.png");
  }
  const next = () => {
    const u = queue.shift();
    if (!u) { b.hidden = true; b.removeAttribute("src"); return; }
    b.hidden = false;
    b.onerror = next;
    b.src = u;
  };
  next();
}
function loadChart(poolId, address) {
  const box = document.getElementById("chart");
  if (!box) return;
  const pool = poolId && String(poolId).length > 12 ? String(poolId) : "";
  const src = pool
    ? "https://www.geckoterminal.com/robinhood/pools/" + encodeURIComponent(pool) + "?embed=1&info=0&swaps=0&light_chart=0&chart_type=price"
    : "https://www.geckoterminal.com/robinhood/tokens/" + encodeURIComponent(address) + "?embed=1&info=0&swaps=0&light_chart=0";
  box.innerHTML = '<iframe title="GeckoTerminal chart" src="' + src + '" allow="clipboard-write" loading="lazy"></iframe>';
}
async function copyText(value, btn) {
  try {
    await navigator.clipboard.writeText(value);
    if (btn) {
      const prev = btn.textContent;
      btn.textContent = "Copied";
      btn.classList.add("ok");
      setTimeout(() => { btn.textContent = prev; btn.classList.remove("ok"); }, 1200);
    }
  } catch (e) {}
}
document.addEventListener("click", (e) => {
  const btn = e.target && e.target.closest && e.target.closest("[data-copy]");
  if (!btn) return;
  e.preventDefault();
  copyText(btn.getAttribute("data-copy"), btn.classList.contains("copy") ? btn : null);
});

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
  const equity = data.isEquity;
  const wrap = equity && s && s.onchain;
  const p = equity ? prem(wrap, cash) : null;
  document.title = (c.name || c.ticker) + " · MEMEFI";
  document.getElementById("pad").textContent = "robinhood · " + padPretty(c.launchpad);
  title.textContent = c.name || c.ticker;
  document.getElementById("chips").innerHTML =
    '<span class="chip">$' + (c.ticker || "") + '</span>' +
    (c.pair ? '<span class="chip">quoted in ' + c.pair + '</span>' : '') +
    '<span class="chip">' + padPretty(c.launchpad) + '</span>' +
    '<button type="button" class="chip copy" data-copy="' + c.address + '">' + shortAddr(c.address) + ' · copy</button>';
  document.getElementById("sub").textContent = equity
    ? "$" + c.ticker + " is quoted against tokenized " + c.pair + "."
    : "$" + c.ticker + " pool is quoted in " + (c.pair || "the paired asset") + ".";
  setAvatar(document.getElementById("avatar"), [
    c.dexImage,
    "https://storage.long.xyz/tokens/" + c.address + ".png",
    "https://storage.long.xyz/tokens/" + c.address + ".jpg",
    "https://dd.dexscreener.com/ds-data/tokens/robinhood/" + c.address + ".png",
    c.geckoImage,
    c.logoDetail,
    c.logo,
    c.imageUri
  ]);
  setBanner(c.banner, c.address);
  if (data.flagged) {
    const f = document.getElementById("flag");
    f.hidden = false;
    f.textContent = "Flagged: " + data.flagged;
  }
  const links = (c.socials || []).map((row) => {
    const k = socialKind(row.type, row.url);
    return '<a href="' + row.url + '" target="_blank" rel="noopener">' + (ICONS[k] || "") + labelKind(k) + '</a>';
  });
  if (c.poolId) links.push('<a href="https://www.geckoterminal.com/robinhood/pools/' + c.poolId + '" target="_blank" rel="noopener">' + ICONS.website + 'GeckoTerminal</a>');
  else links.push('<a href="https://www.geckoterminal.com/robinhood/tokens/' + c.address + '" target="_blank" rel="noopener">' + ICONS.website + 'GeckoTerminal</a>');
  if (c.dexUrl) links.push('<a href="' + c.dexUrl + '" target="_blank" rel="noopener">' + ICONS.dex + 'DexScreener</a>');
  links.push('<a href="' + SCAN + '/token/' + c.address + '" target="_blank" rel="noopener">' + ICONS.dex + 'RH-scan</a>');
  document.getElementById("socials").innerHTML = links.join("");
  const chg = Number(c.change24h);
  const chgHtml = Number.isFinite(chg) ? '<s class="' + (chg >= 0 ? "up" : "dn") + '">' + fmtChg(chg) + '</s>' : "";
  let pills = '' +
    '<div><em>Price</em><b>' + fmtPx(c.price) + '</b>' + chgHtml + '</div>' +
    '<div><em>Market cap</em><b>' + fmtUsd(c.marketCap) + '</b></div>' +
    '<div><em>FDV</em><b>' + fmtUsd(c.fdv) + '</b></div>' +
    '<div><em>Volume 24h</em><b>' + fmtUsd(c.volume24h) + '</b></div>' +
    '<div><em>Liquidity</em><b>' + fmtUsd(c.liquidityUsd) + '</b></div>';
  if (equity) {
    pills += '' +
    '<div data-tip="Last on-chain print of the official wrapper."><em>' + c.pair + ' on-chain</em><b>' + (wrap != null ? fmtPx(wrap) : "—") + '</b></div>' +
    '<div data-tip="Last regular-session print."><em>Cash close</em><b>' + (cash != null ? fmtPx(cash) : "—") + '</b></div>' +
    '<div data-tip="Wrapper / cash close − 1."><em>Premium</em><b>' + (p == null ? "n/a" : ((p > 0 ? "+" : "") + p.toFixed(1) + "%")) + '</b></div>';
  } else {
    pills += '<div><em>1h</em><b class="' + (Number(c.change1h) >= 0 ? "up" : "dn") + '">' + fmtChg(c.change1h) + '</b></div>';
  }
  document.getElementById("pills").innerHTML = pills;
  loadChart(c.poolId, c.address);
  const rows = [
    ["Launchpad", padPretty(c.launchpad)],
    ["Quote asset", c.pair || "—"],
    ["Market cap", fmtUsd(c.marketCap)],
    ["Fully diluted", fmtUsd(c.fdv)],
    ["Volume 24h", fmtUsd(c.volume24h)],
    ["Liquidity", fmtUsd(c.liquidityUsd)],
    ["Holders", c.holders != null ? Number(c.holders).toLocaleString("en-US") : "—"],
    ["Buys / sells 24h", (c.buys24h != null || c.sells24h != null) ? (c.buys24h || 0) + " / " + (c.sells24h || 0) : "—"],
    ["1h / 6h / 24h", [c.change1h, c.change6h, c.change24h].map(fmtChg).join(" · ")],
    ["Created", c.createdAt ? new Date(c.createdAt).toUTCString() : "—"],
    ["Token", addrCell(c.address, SCAN + "/token/" + c.address)],
    ["Pool", c.poolId ? addrCell(c.poolId, "https://www.geckoterminal.com/robinhood/pools/" + c.poolId) : "—"]
  ];
  if (equity) {
    rows.splice(2, 0, ["Paired stock", c.pair + (s && s.name ? " — " + s.name : "")]);
    rows.push(["Asset locked", (c.stockLockedUnits != null ? Number(c.stockLockedUnits).toLocaleString("en-US", { maximumFractionDigits: 2 }) + " " + c.pair : "—") + " · " + fmtUsd(c.stockLockedUsd)]);
    rows.push(["Stock token", s && s.address ? addrCell(s.address, SCAN + "/token/" + s.address) : "—"]);
  }
  document.getElementById("file").innerHTML = rows.map((row) => '<tr><th>' + row[0] + '</th><td>' + row[1] + '</td></tr>').join("");
}
main();
