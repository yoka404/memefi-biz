function padGroup(raw) {
  const s = String(raw || "").toLowerCase();
  if (s.includes("pons")) return "pons";
  if (s.includes("long")) return "long";
  if (s.includes("bankr")) return "bankr";
  if (s.includes("feel")) return "feel";
  if (s.includes("flap")) return "flap";
  if (s.includes("o1") || s.includes("swapx")) return "o1";
  return "other";
}
function padLabel(raw) {
  const s = String(raw || "").toLowerCase();
  if (s.includes("pons-v3") || s.includes("ponsv3")) return "Pons V3";
  if (s.includes("pons-v2") || s.includes("ponsv2")) return "Pons V2";
  if (s.includes("pons-v1") || s.includes("ponsv1")) return "Pons V1";
  if (s.includes("pons")) return "Pons";
  const g = padGroup(raw);
  return { long: "long.xyz", bankr: "Bankr", feel: "feel.cash", flap: "Flap", o1: "o1" }[g] || raw || "other";
}
function padUrl(raw, address, ticker) {
  const a = String(address || "").toLowerCase();
  const t = encodeURIComponent(String(ticker || "").toLowerCase());
  const g = padGroup(raw);
  if (!/^0x[a-f0-9]{40}$/.test(a)) return null;
  if (g === "long") return "https://app.long.xyz/tokens/" + a;
  if (g === "bankr") return "https://bankr.bot/terminal/trade?out=" + a + "&chain=robinhood";
  if (g === "feel") return t ? "https://feel.cash/" + t : "https://feel.cash";
  if (g === "flap") return "https://flap.sh/robinhood/" + a;
  if (g === "pons") return "https://www.ponsfamily.com/launchpad/" + a;
  if (g === "o1") return "https://launch.o1.exchange/token/" + a;
  return "https://rh-scan.com/token/" + a;
}
