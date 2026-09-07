function esc(s) {
  return String(s || "").replace(/[&<>"']/g, function (c) {
    return ({ "&": "&", "<": "<", ">": ">", '"': """, "'": "&#39;" })[c];
  });
}
function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  if (Math.abs(x) >= 1e9) return "$" + (x / 1e9).toFixed(2) + "B";
  if (Math.abs(x) >= 1e6) return "$" + (x / 1e6).toFixed(2) + "M";
  if (Math.abs(x) >= 1e3) return "$" + (x / 1e3).toFixed(1) + "K";
  return "$" + x.toFixed(0);
}
function num(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x.toLocaleString("en-US") : "—";
}
function chg(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return { t: "—", c: "mute" };
  return { t: (x >= 0 ? "▲ " : "▼ ") + Math.abs(x).toFixed(2) + "%", c: x >= 0 ? "up" : "dn" };
}
function row(c, right, sub) {
  const href = c.address ? "/p/" + encodeURIComponent(c.address) : "#";
  return `<li><a href="${href}"><span><strong>${esc(c.name || c.ticker)}</strong> <em>${esc(c.ticker || "")} · ${esc(c.pair || "")}</em></span><span class="r"><b>${right}</b><small class="${sub.c || "mute"}">${sub.t || ""}</small></span></a></li>`;
}
function paintSnapshot(s) {
  if (!s) return;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("kpi-locked", money(s.stockLockedUsd));
  set("kpi-locked-sub", s.stockLockedKnown != null ? "unwithdrawable · " + num(s.stockLockedKnown) + " priced pools" : "unwithdrawable");
  set("kpi-coins", num(s.coinsListed));
  set("kpi-coins-sub", s.launches != null ? "of " + num(s.launches) + " on-chain launches" : "listed");
  set("kpi-eq", num(s.equitiesPaired));
  set("kpi-vol", money(s.volume24h));
  const bits = [];
  if (s.fees24h != null) bits.push(money(s.fees24h) + " fees");
  if (s.holders != null) bits.push(num(s.holders) + " holders");
  set("kpi-vol-sub", bits.join(" · ") || "24h");
  const blk = document.getElementById("snap-block");
  if (blk) blk.textContent = s.headBlock ? "block " + num(s.headBlock) : "on-chain";
  const movers = document.getElementById("snap-movers");
  if (movers) movers.innerHTML = (s.movers || []).map((c) => {
    const d = chg(c.change24h);
    return row(c, money(c.price), d);
  }).join("") || "<li class=\"mute\">No movers</li>";
  const locked = document.getElementById("snap-locked");
  if (locked) locked.innerHTML = (s.locked || []).map((c) => {
    const units = Number.isFinite(Number(c.stockLockedUnits)) ? Number(c.stockLockedUnits).toLocaleString("en-US", { maximumFractionDigits: 1 }) + " " + (c.pair || "") : "";
    return row(c, money(c.stockLockedUsd), { t: units, c: "mute" });
  }).join("") || "<li class=\"mute\">No lock data</li>";
}
if (typeof window !== "undefined") window.paintSnapshot = paintSnapshot;
