const PAIRS = [
  { id: "0xcbdfea90430a30ee4469c9902e120a77e7c7e4711d5643671c1d1957f2f1ce27", meme: "AI", stock: "NVDA" },
  { id: "0x9c89b04303dfa76f3f6fb02c2b77be0e8a00ab8fa00d507119acd54ab3e8640d", meme: "BONER", stock: "HIMS" },
  { id: "0xa1b6b4901eab312cac8a5cf6a22a5e7f649c5a6b4d2d0da5d9c75446fcd4de4b", meme: "MEME", stock: "AMC" },
  { id: "0xc3cc877a8a7d28efdb5dbec9ae71724652431e6411aa1a9fc8928028da554aa1", meme: "MOO", stock: "MU" },
  { id: "0x225cc98f7d66b29fef96377becc7bf89582e2ab7b923a09aee9719fd80eb94ca", meme: "SPACEHOOD", stock: "SPCX" },
  { id: "0xd1c2f6cb178a165a643deae8752098dea08d51b6170cd8e36e196ef03dc74751", meme: "SAYLORMOON", stock: "MSTR" }
];

function fmtPx(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  if (x >= 1) return x.toFixed(2);
  if (x >= 0.01) return x.toFixed(4);
  return x.toPrecision(3);
}
function fmtUsd(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  if (x >= 1e6) return (x / 1e6).toFixed(1) + "M";
  if (x >= 1e3) return (x / 1e3).toFixed(1) + "K";
  return x.toFixed(0);
}
function fmtChg(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return { text: "—", cls: "" };
  const sign = x > 0 ? "+" : "";
  return { text: sign + x.toFixed(1) + "%", cls: x >= 0 ? "up" : "dn" };
}

async function loadDex(ids) {
  const joined = ids.join(",");
  const urls = [
    "/api/pairs?ids=" + encodeURIComponent(joined),
    "https://api.dexscreener.com/latest/dex/pairs/robinhood/" + joined
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const data = await r.json();
      const list = data.pairs || (data.pair ? [data.pair] : []);
      if (list.length) return list;
    } catch (e) {}
  }
  return [];
}

function stockPriceFromPair(p) {
  const meme = Number(p.priceUsd);
  const native = Number(p.priceNative);
  if (Number.isFinite(meme) && Number.isFinite(native) && native > 0) return meme / native;
  return null;
}

async function refresh() {
  const rows = document.getElementById("rows");
  const list = await loadDex(PAIRS.map((p) => p.id));
  const byId = Object.fromEntries(list.map((p) => [p.pairAddress.toLowerCase(), p]));
  rows.innerHTML = PAIRS.map((meta) => {
    const p = byId[meta.id.toLowerCase()];
    if (!p) return `<tr><td>$${meta.meme}</td><td>${meta.stock}</td><td colspan="4">unavailable</td></tr>`;
    const chg = fmtChg((p.priceChange || {}).h24);
    const under = stockPriceFromPair(p);
    return `<tr>
      <td>$${meta.meme}</td>
      <td>${meta.stock}</td>
      <td>${fmtPx(p.priceUsd)}</td>
      <td class="${chg.cls}">${chg.text}</td>
      <td>${under == null ? "—" : fmtPx(under)}</td>
      <td>${fmtUsd((p.volume || {}).h24)}</td>
    </tr>`;
  }).join("");

  const meme = byId[PAIRS[2].id.toLowerCase()];
  const ai = byId[PAIRS[0].id.toLowerCase()];
  if (meme) {
    const el = document.getElementById("px");
    if (el) el.textContent = fmtPx(meme.priceUsd);
    const chg = fmtChg((meme.priceChange || {}).h24);
    const s = el && el.parentElement && el.parentElement.querySelector("s");
    if (s) { s.textContent = chg.text; s.className = chg.cls; }
    const amc = stockPriceFromPair(meme);
    const hood = document.getElementById("under");
    if (hood && amc != null) hood.textContent = fmtPx(amc);
  }
  if (ai) {
    const ratio = document.getElementById("ratio");
    if (ratio && ai.priceNative) ratio.textContent = Number(ai.priceNative).toPrecision(3);
  }
  const stamp = document.getElementById("live-stamp");
  if (stamp) stamp.textContent = "Live · DexScreener · " + new Date().toUTCString().slice(17, 25) + " UTC";
}

refresh();
setInterval(refresh, 30000);
