function letterSvg(label) {
  const t = String(label || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' rx='12' fill='#16161c'/><text x='32' y='40' text-anchor='middle' font-family='Inter,system-ui,sans-serif' font-size='22' font-weight='650' fill='#c4c4cc'>" + t + "</text></svg>";
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
function pfp(c) {
  const addr = String(c.address || "").toLowerCase();
  const out = [];
  if (c.dexImage) out.push(c.dexImage);
  if (addr) {
    out.push("https://dd.dexscreener.com/ds-data/tokens/robinhood/" + addr + ".png?size=lg");
    out.push("https://dd.dexscreener.com/ds-data/tokens/robinhood/" + addr + ".png");
  }
  if (c.geckoImage) out.push(c.geckoImage);
  if (c.imageUri) {
    const u = String(c.imageUri);
    out.push(u.indexOf("ipfs://") === 0 ? "https://ipfs.io/ipfs/" + u.slice(7) : u);
  }
  if (c.logo) out.push("https://memefimarketcap.com/" + String(c.logo).replace(/^\//, ""));
  out.push(letterSvg(c.ticker || c.name));
  return out.filter(Boolean);
}
