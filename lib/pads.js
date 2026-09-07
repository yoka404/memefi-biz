export function padGroup(raw) {
  const s = String(raw || "").toLowerCase();
  if (s.includes("pons")) return "pons";
  if (s.includes("long")) return "long";
  if (s.includes("bankr")) return "bankr";
  if (s.includes("feel")) return "feel";
  if (s.includes("flap")) return "flap";
  return "other";
}

export function padLabel(raw) {
  const g = padGroup(raw);
  return { pons: "Pons", long: "long.xyz", bankr: "Bankr", feel: "feel.cash", flap: "Flap" }[g] || raw || "other";
}

export function padUrl(raw, address, ticker) {
  const a = String(address || "").toLowerCase();
  const t = encodeURIComponent(String(ticker || "").toLowerCase());
  const g = padGroup(raw);
  if (!a || a.length !== 42) return null;
  if (g === "long") return "https://app.long.xyz/tokens/" + a;
  if (g === "bankr") return "https://bankr.bot/terminal/trade?out=" + a + "&chain=robinhood";
  if (g === "feel") return t ? "https://feel.cash/" + t : "https://feel.cash";
  if (g === "flap") return "https://flap.sh/robinhood/" + a;
  if (g === "pons") return "https://www.ponsfamily.com/launchpad/" + a;
  return "https://rh-scan.com/token/" + a;
}
