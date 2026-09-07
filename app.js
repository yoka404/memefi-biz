const HOLIDAYS = new Set(["2026-09-07", "2026-11-26", "2026-12-25"]);
const PADS = { long: ["long", "long.xyz"], bankr: ["bankr"], feel: ["feel", "feel.cash"], flap: ["flap"] };

function fmtPx(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  if (x >= 100) return x.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (x >= 1) return "$" + x.toFixed(2);
  if (x >= 0.01) return "$" + x.toFixed(5);
  if (x > 0) return "$" + x.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
  return "—";
}
function fmtNum(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  if (x >= 100) return x.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (x >= 1) return x.toFixed(2);
  return x.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
function fmtUsd(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  if (Math.abs(x) >= 1e9) return "$" + (x / 1e9).toFixed(2) + "B";
  if (Math.abs(x) >= 1e6) return "$" + (x / 1e6).toFixed(2) + "M";
  if (Math.abs(x) >= 1e3) return "$" + (x / 1e3).toFixed(1) + "K";
  return "$" + x.toFixed(0);
}
function fmtChg(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return { text: "—", cls: "mute" };
  const sign = x > 0 ? "▲ " : x < 0 ? "▼ " : "";
  return { text: sign + Math.abs(x).toFixed(2) + "%", cls: x > 0 ? "up" : x < 0 ? "dn" : "mute" };
}
function fmtPrem(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return { text: "—", cls: "mute" };
  const sign = x > 0 ? "+" : "";
  let cls = "mute";
  if (x >= 20) cls = "fire";
  else if (x >= 2) cls = "up";
  else if (x <= -2) cls = "dn";
  return { text: sign + x.toFixed(1) + "%", cls };
}
function padLabel(raw) {
  const s = String(raw || "").toLowerCase();
  if (s.includes("long")) return "long.xyz";
  if (s.includes("bankr")) return "Bankr";
  if (s.includes("feel")) return "feel.cash";
  if (s.includes("flap")) return "Flap";
  return raw || "other";
}
function padGroup(raw) {
  const s = String(raw || "").toLowerCase();
  if (s.includes("long")) return "long";
  if (s.includes("bankr")) return "bankr";
  if (s.includes("feel")) return "feel";
  if (s.includes("flap")) return "flap";
  return "other";
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
  if (weekend) return { open: false, reason: "WEEKEND · no mint" };
  if (holiday) return { open: false, reason: iso === "2026-09-07" ? "CLOSED · Labor Day · no mint" : "CLOSED · holiday · no mint" };
  if (minutes < 570) return { open: false, reason: "PRE-OPEN · cash last" };
  if (minutes >= 960) return { open: false, reason: "AFTER HOURS · no mint" };
  return { open: true, reason: "OPEN" };
}

let TAB = "top";
let PAD = "all";
let CACHE = null;

function premium(onchainPx, cashPx) {
  if (!Number.isFinite(onchainPx) || !Number.isFinite(cashPx) || cashPx <= 0) return NaN;
  return ((onchainPx / cashPx) - 1) * 100;
}
function matchesQuery(c, q) {
  if (!q) return true;
  const needle = q.toLowerCase();
  const addr = String(c.address || "").toLowerCase();
  const pool = String(c.poolId || "").toLowerCase();
  if (addr.includes(needle) || pool.includes(needle)) return true;
  const u = q.toUpperCase();
  return (c.ticker || "").toUpperCase().includes(u) || (c.pair || "").toUpperCase().includes(u) || (c.name || "").toUpperCase().includes(u);
}

function renderRows(list) {
  const raw = (document.getElementById("q") && document.getElementById("q").value || "").trim();
  const quotes = (CACHE && CACHE.quotes) || {};
  const onchain = (CACHE && CACHE.onchain) || {};
  const filtered = list.filter((c) => {
    if (PAD !== "all" && padGroup(c.launchpad) !== PAD) return false;
    return matchesQuery(c, raw);
  });
  const rows = document.getElementById("rows");
  const looksAddr = /^0x[a-fA-F0-9]{40}$/.test(raw);
  rows.innerHTML = filtered.map((c, i) => {
    const chg = fmtChg(c.change24h);
    const wrap = onchain[c.pair];
    const cash = quotes[c.pair];
    const pr = fmtPrem(premium(wrap, cash));
    const href = c.address ? "/p/" + c.address : "";
    const logo = c.address ? "https://memefimarketcap.com/assets/logos/coin/" + c.address + ".webp" : "/memefi.png";
    return `<tr data-href="${href}">
      <td class="num">${c.rank || i + 1}</td>
      <td>
        <a class="pair namecell" href="${href}">
          <img src="${logo}" alt="" onerror="this.src='/memefi.png'"/>
          <span class="nm"><strong>${c.name || c.ticker} <span>${c.ticker}</span></strong><small>${padLabel(c.launchpad)}</small></span>
        </a>
      </td>
      <td><div class="stock"><b>${c.pair || "—"}</b><em>${wrap != null ? fmtPx(wrap).replace(/^\$/, "$") : (cash != null ? fmtPx(cash) : "—")}</em></div></td>
      <td class="px">${c.price != null ? (Number(c.price) >= 1 ? "$" + Number(c.price).toFixed(2) : fmtPx(c.price)) : "—"}</td>
      <td class="${chg.cls}">${chg.text}</td>
      <td class="mcap">${fmtUsd(c.marketCap)}</td>
      <td class="vol">${fmtUsd(c.volume24h)}</td>
      <td class="locked"><b>${c.stockLockedUnits != null ? fmtNum(c.stockLockedUnits) + " " + (c.pair || "") : "—"}</b><small>${fmtUsd(c.stockLockedUsd)}</small></td>
      <td class="${pr.cls}">${pr.text}</td>
      <td>${c.holders != null ? Number(c.holders).toLocaleString("en-US") : "—"}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="10">${looksAddr ? `Open file: <a class="pair" href="/p/${raw.toLowerCase()}">${raw.toLowerCase()}</a>` : "No matches"}</td></tr>`;
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
  if (snap) {
    const listed = agg.listed || agg.coins || "—";
    const launches = agg.launches ? Number(agg.launches).toLocaleString("en-US") : "—";
    snap.textContent = Number(listed).toLocaleString("en-US") + " listed of " + launches + " launches · " + (agg.equities || "—") + " equities · " + fmtUsd(agg.stockLockedUsd) + " stock locked · vol " + fmtUsd(agg.volume24h);
  }
  renderRows(TAB === "new" ? (CACHE.newest || []) : (CACHE.top || []));

  const focus = (CACHE.top || []).find((c) => c.ticker === "MEME" && c.pair === "AMC") || (CACHE.top || []).find((c) => c.ticker === "AI") || (CACHE.top || [])[0];
  if (focus) {
    const el = document.getElementById("px");
    if (el) el.textContent = fmtPx(focus.price).replace(/^\$/, "");
    const chg = fmtChg(focus.change24h);
    const s = document.getElementById("pxchg");
    if (s) { s.textContent = chg.text; s.className = chg.cls; }
    const wrap = CACHE.onchain[focus.pair];
    const under = document.getElementById("under");
    if (under && wrap != null) under.textContent = fmtPx(wrap).replace(/^\$/, "");
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
    return;
  }
  if (t && t.dataset && t.dataset.pad) {
    PAD = t.dataset.pad;
    document.querySelectorAll("[data-pad]").forEach((b) => b.classList.toggle("on", b.dataset.pad === PAD));
    paint();
    return;
  }
  const tr = t && t.closest && t.closest("tr[data-href]");
  if (tr && tr.dataset.href && t.tagName !== "A") location.href = tr.dataset.href;
});
document.addEventListener("input", (e) => {
  if (e.target && e.target.id === "q") paint();
});

refresh();
setInterval(refresh, 90000);
