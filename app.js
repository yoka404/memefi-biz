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
  if (Math.abs(x) >= 1e9) return (x / 1e9).toFixed(2) + "B";
  if (Math.abs(x) >= 1e6) return (x / 1e6).toFixed(2) + "M";
  if (Math.abs(x) >= 1e3) return (x / 1e3).toFixed(1) + "K";
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
    timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit",
    hour12: false, year: "numeric", month: "2-digit", day: "2-digit"
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
  const inHours = !weekend && !holiday && minutes >= 570 && minutes < 960;
  let reason = "OPEN";
  if (weekend) reason = "WEEKEND · no mint";
  else if (holiday) reason = iso === "2026-09-07" ? "CLOSED · Labor Day · no mint" : "CLOSED · holiday · no mint";
  else if (minutes < 570) reason = "PRE-OPEN · cash last";
  else if (minutes >= 960) reason = "AFTER HOURS · no mint";
  return { open: inHours, reason };
}

let TAB = "top";
let CACHE = null;

function premium(onchainPx, cashPx) {
  if (!Number.isFinite(onchainPx) || !Number.isFinite(cashPx) || cashPx <= 0) return NaN;
  return ((onchainPx / cashPx) - 1) * 100;
}

function renderRows(list) {
  const q = (document.getElementById("q") && document.getElementById("q").value || "").trim().toUpperCase();
  const quotes = (CACHE && CACHE.quotes) || {};
  const onchain = (CACHE && CACHE.onchain) || {};
  const filtered = list.filter((c) => {
    if (!q) return true;
    return (c.ticker || "").toUpperCase().includes(q) || (c.pair || "").toUpperCase().includes(q) || (c.name || "").toUpperCase().includes(q);
  });
  const rows = document.getElementById("rows");
  rows.innerHTML = filtered.map((c) => {
    const chg = fmtChg(c.change24h);
    const wrap = onchain[c.pair];
    const cash = quotes[c.pair];
    const pr = fmtPrem(premium(wrap, cash));
    return `<tr>
      <td>$${c.ticker}</td>
      <td>${c.pair || "—"}</td>
      <td>${fmtPx(c.price)}</td>
      <td class="${chg.cls}">${chg.text}</td>
      <td>${fmtUsd(c.marketCap)}</td>
      <td>${wrap != null ? fmtPx(wrap) : "—"}</td>
      <td>${cash != null ? fmtPx(cash) : (c.pair === "SPCX" ? "pre-IPO" : "—")}</td>
      <td class="${pr.cls}">${pr.text}</td>
      <td>${fmtUsd(c.stockLockedUsd)}</td>
      <td>${fmtUsd(c.volume24h)}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="10">No matches</td></tr>`;
}

function paint() {
  if (!CACHE) return;
  const session = cashSession(new Date());
  const stamp = document.getElementById("live-stamp");
  if (stamp) stamp.textContent = session.reason;
  const sessEl = document.getElementById("session");
  if (sessEl) sessEl.textContent = session.reason;
  const agg = CACHE.aggregates || {};
  const snap = document.getElementById("snap");
  if (snap) snap.textContent = fmtUsd(agg.stockLockedUsd) + " stock locked · " + (agg.coins || "—") + " coins · " + (agg.equities || "—") + " equities · vol " + fmtUsd(agg.volume24h);
  const list = TAB === "new" ? CACHE.newest : CACHE.top;
  renderRows(list || []);

  const ai = (CACHE.top || []).find((c) => c.ticker === "AI");
  const meme = (CACHE.top || []).find((c) => c.ticker === "MEME" && c.pair === "AMC") || (CACHE.top || []).find((c) => c.ticker === "MEME");
  const focus = meme || ai;
  if (focus) {
    const el = document.getElementById("px");
    if (el) el.textContent = fmtPx(focus.price);
    const chg = fmtChg(focus.change24h);
    const s = document.getElementById("pxchg");
    if (s) { s.textContent = chg.text; s.className = chg.cls; }
    const wrap = CACHE.onchain[focus.pair];
    const under = document.getElementById("under");
    if (under && wrap != null) under.textContent = fmtPx(wrap);
    const cash = CACHE.quotes[focus.pair];
    const premEl = document.getElementById("prem");
    if (premEl) {
      const pr = fmtPrem(premium(wrap, cash));
      premEl.textContent = pr.text;
      premEl.className = pr.cls;
    }
    const lab = document.getElementById("focus-lab");
    if (lab) lab.textContent = focus.ticker;
    const ulab = document.getElementById("under-lab");
    if (ulab) ulab.textContent = (focus.pair || "") + " on-chain";
    const plab = document.getElementById("prem-lab");
    if (plab) plab.textContent = (focus.pair || "") + " premium";
  }
}

async function refresh() {
  try {
    const r = await fetch("/api/board");
    if (!r.ok) throw new Error("board");
    CACHE = await r.json();
    paint();
  } catch (e) {
    const rows = document.getElementById("rows");
    if (rows && !CACHE) rows.innerHTML = `<tr><td colspan="10">Board feed unavailable</td></tr>`;
  }
}

document.addEventListener("click", (e) => {
  const t = e.target;
  if (t && t.dataset && t.dataset.tab) {
    TAB = t.dataset.tab;
    document.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === TAB));
    paint();
  }
});
document.addEventListener("input", (e) => {
  if (e.target && e.target.id === "q") paint();
});

refresh();
setInterval(refresh, 90000);
