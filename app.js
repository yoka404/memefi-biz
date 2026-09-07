const PAIRS = [
  { id: "0xcbdfea90430a30ee4469c9902e120a77e7c7e4711d5643671c1d1957f2f1ce27", meme: "AI", stock: "NVDA" },
  { id: "0x9c89b04303dfa76f3f6fb02c2b77be0e8a00ab8fa00d507119acd54ab3e8640d", meme: "BONER", stock: "HIMS" },
  { id: "0xa1b6b4901eab312cac8a5cf6a22a5e7f649c5a6b4d2d0da5d9c75446fcd4de4b", meme: "MEME", stock: "AMC" },
  { id: "0xc3cc877a8a7d28efdb5dbec9ae71724652431e6411aa1a9fc8928028da554aa1", meme: "MOO", stock: "MU" },
  { id: "0x225cc98f7d66b29fef96377becc7bf89582e2ab7b923a09aee9719fd80eb94ca", meme: "SPACEHOOD", stock: "SPCX" },
  { id: "0xd1c2f6cb178a165a643deae8752098dea08d51b6170cd8e36e196ef03dc74751", meme: "SAYLORMOON", stock: "MSTR" }
];

const HOLIDAYS = new Set(["2026-09-07", "2026-11-26", "2026-12-25"]);

function fmtPx(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  if (x >= 100) return x.toFixed(2);
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
function fmtPrem(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return { text: "n/a", cls: "mute" };
  const sign = x > 0 ? "+" : "";
  let cls = "";
  if (x >= 20) cls = "fire";
  else if (x >= 5) cls = "up";
  else if (x <= -5) cls = "dn";
  return { text: sign + x.toFixed(1) + "%", cls };
}

function nyParts(d) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const o = {};
  for (const p of fmt.formatToParts(d)) o[p.type] = p.value;
  return o;
}
function cashSession(d) {
  const p = nyParts(d);
  const iso = p.year + "-" + p.month + "-" + p.day;
  const wd = p.weekday;
  const minutes = Number(p.hour) * 60 + Number(p.minute);
  const holiday = HOLIDAYS.has(iso);
  const weekend = wd === "Sat" || wd === "Sun";
  const openMins = 9 * 60 + 30;
  const closeMins = 16 * 60;
  const inHours = !weekend && !holiday && minutes >= openMins && minutes < closeMins;
  let reason = "OPEN";
  if (weekend) reason = "WEEKEND · no mint";
  else if (holiday) reason = iso === "2026-09-07" ? "CLOSED · Labor Day · no mint" : "CLOSED · holiday · no mint";
  else if (minutes < openMins) reason = "PRE-OPEN · cash last";
  else if (minutes >= closeMins) reason = "AFTER HOURS · no mint";
  return { open: inHours, reason, iso };
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

async function loadCloses() {
  try {
    const r = await fetch("/api/closes?symbols=AMC,NVDA,HIMS,MU,MSTR,TSLA,HOOD");
    if (!r.ok) return {};
    const data = await r.json();
    return data.quotes || {};
  } catch (e) {
    return {};
  }
}

function stockPriceFromPair(p) {
  const meme = Number(p.priceUsd);
  const native = Number(p.priceNative);
  if (Number.isFinite(meme) && Number.isFinite(native) && native > 0) return meme / native;
  return null;
}

async function refresh() {
  const session = cashSession(new Date());
  const stamp = document.getElementById("live-stamp");
  if (stamp) stamp.textContent = session.reason;
  const sessEl = document.getElementById("session");
  if (sessEl) sessEl.textContent = session.open ? "Cash open" : session.reason;

  const [list, quotes] = await Promise.all([
    loadDex(PAIRS.map((p) => p.id)),
    loadCloses()
  ]);
  const byId = Object.fromEntries(list.map((p) => [p.pairAddress.toLowerCase(), p]));
  const rows = document.getElementById("rows");
  rows.innerHTML = PAIRS.map((meta) => {
    const p = byId[meta.id.toLowerCase()];
    if (!p) return `<tr><td>$${meta.meme}</td><td>${meta.stock}</td><td colspan="5">unavailable</td></tr>`;
    const chg = fmtChg((p.priceChange || {}).h24);
    const under = stockPriceFromPair(p);
    const cash = quotes[meta.stock] && quotes[meta.stock].cash;
    const prem = under != null && cash ? ((under / cash) - 1) * 100 : NaN;
    const pr = fmtPrem(prem);
    return `<tr>
      <td>$${meta.meme}</td>
      <td>${meta.stock}</td>
      <td>${fmtPx(p.priceUsd)}</td>
      <td class="${chg.cls}">${chg.text}</td>
      <td>${under == null ? "—" : fmtPx(under)}</td>
      <td>${cash ? fmtPx(cash) : (meta.stock === "SPCX" ? "pre-IPO" : "—")}</td>
      <td class="${pr.cls}">${pr.text}</td>
      <td>${fmtUsd((p.volume || {}).h24)}</td>
    </tr>`;
  }).join("");

  const meme = byId[PAIRS[2].id.toLowerCase()];
  if (meme) {
    const el = document.getElementById("px");
    if (el) el.textContent = fmtPx(meme.priceUsd);
    const chg = fmtChg((meme.priceChange || {}).h24);
    const s = document.getElementById("pxchg") || (el && el.parentElement && el.parentElement.querySelector("s"));
    if (s) { s.textContent = chg.text; s.className = chg.cls; }
    const amc = stockPriceFromPair(meme);
    const underEl = document.getElementById("under");
    if (underEl && amc != null) underEl.textContent = fmtPx(amc);
    const cash = quotes.AMC && quotes.AMC.cash;
    const premEl = document.getElementById("prem");
    if (premEl && amc != null && cash) {
      const pr = fmtPrem(((amc / cash) - 1) * 100);
      premEl.textContent = pr.text;
      premEl.className = pr.cls;
    }
  }
}

refresh();
setInterval(refresh, 30000);
