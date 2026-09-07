function esc(s) {
  return String(s || '')
    .split('\u0026').join('\u0026amp;')
    .split('<').join('\u0026lt;')
    .split('>').join('\u0026gt;');
}
function letterSvg(label) {
  const t = String(label || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' rx='12' fill='#16161c'/><text x='32' y='40' text-anchor='middle' font-family='Inter,system-ui,sans-serif' font-size='22' font-weight='650' fill='#c4c4cc'>" + t + '</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '-';
  if (Math.abs(x) >= 1e9) return '$' + (x / 1e9).toFixed(2) + 'B';
  if (Math.abs(x) >= 1e6) return '$' + (x / 1e6).toFixed(2) + 'M';
  if (Math.abs(x) >= 1e3) return '$' + (x / 1e3).toFixed(1) + 'K';
  return '$' + x.toFixed(0);
}
function num(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x.toLocaleString('en-US') : '-';
}
function pct(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '-';
  if (x >= 10) return x.toFixed(1) + '%';
  if (x >= 1) return x.toFixed(2) + '%';
  return x.toFixed(3) + '%';
}
function chg(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return { t: '-', c: 'mute' };
  const sign = x >= 0 ? '+' : '';
  return { t: sign + x.toFixed(2) + '%', c: x >= 0 ? 'up' : 'dn' };
}
function avatars(c) {
  const a = String(c.address || '').toLowerCase();
  const tick = String(c.ticker || '').toLowerCase();
  const out = [];
  if (c.dexImage) out.push(c.dexImage);
  if (a) {
    out.push('https://dd.dexscreener.com/ds-data/tokens/robinhood/' + a + '.png');
    out.push('https://storage.long.xyz/tokens/' + a + '.png');
    out.push('https://storage.long.xyz/tokens/' + a + '.jpg');
  }
  if (tick) out.push('https://app.long.xyz/coins/' + encodeURIComponent(tick) + '.webp');
  out.push(letterSvg(c.ticker || c.name));
  return out.filter(Boolean);
}
function imgErr(el) {
  const rest = (el.getAttribute('data-alts') || '').split('|').filter(Boolean);
  if (!rest.length) {
    el.onerror = null;
    return;
  }
  el.src = rest.shift();
  el.setAttribute('data-alts', rest.join('|'));
}
function row(c, right, sub) {
  const href = c.address ? '/p/' + encodeURIComponent(c.address) : '#';
  const klass = (sub && sub.c) || 'mute';
  const extra = (sub && sub.t) || '';
  const imgs = avatars(c);
  const src = imgs[0] || '';
  const alts = imgs.slice(1).join('|');
  return '<li><a href="' + href + '"><img src="' + src + '" data-alts="' + alts + '" alt="" width="28" height="28" onerror="imgErr(this)"/><span><strong>' + esc(c.name || c.ticker) + '</strong> <em>' + esc(c.ticker || '') + ' / ' + esc(c.pair || '') + '</em></span><span class="r"><b>' + right + '</b><small class="' + klass + '">' + esc(extra) + '</small></span></a></li>';
}
function paintUtil(util) {
  const box = document.getElementById('snap-util');
  if (!box) return;
  if (!util || !(util.rows || []).length) {
    box.innerHTML = '';
    return;
  }
  const chips = (util.rows || []).filter(function (r) { return r.aum || r.lockedUsd; }).map(function (r) {
    const tip = r.symbol + ' wrapper AUM ' + money(r.aum) + '. ' + money(r.lockedUsd) + ' sits in meme pools (' + pct(r.pct) + '). AUM is on-chain supply times the wrapper print. Locked is the stock token in those pools.';
    return '<div class="u" data-tip="' + esc(tip) + '"><em>' + esc(r.symbol) + '</em><b>' + pct(r.pct) + '</b><small>' + money(r.lockedUsd) + ' / ' + money(r.aum) + '</small></div>';
  });
  const headTip = 'Wrapper AUM is on-chain supply of the official stock or metal token times its on-chain print. Locked is how much of that wrapper sits in meme pools on this tape. The percent is locked divided by AUM. If AUM rises and locked does not, utilization falls.';
  const total = '<div class="u total" data-tip="' + esc(headTip) + '"><em>Tape</em><b>' + pct(util.pct) + '</b><small>' + money(util.locked) + ' locked / ' + money(util.aum) + ' AUM</small></div>';
  box.innerHTML = total + chips.join('');
}
function paintSnapshot(s) {
  if (!s) return;
  function set(id, v) {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  }
  set('kpi-locked', money(s.stockLockedUsd));
  set('kpi-locked-sub', s.stockLockedKnown != null ? 'in meme pools / ' + num(s.stockLockedKnown) + ' priced' : 'in meme pools');
  set('kpi-coins', num(s.coinsListed));
  set('kpi-coins-sub', s.launches != null ? 'of ' + num(s.launches) + ' indexed pools' : 'listed');
  set('kpi-eq', num(s.equitiesPaired));
  set('kpi-vol', money(s.volume24h));
  const bits = [];
  if (s.fees24h != null) bits.push(money(s.fees24h) + ' fees');
  if (s.holders != null) bits.push(num(s.holders) + ' holders');
  set('kpi-vol-sub', bits.join(' / ') || '24h');
  const blk = document.getElementById('snap-block');
  if (blk) blk.textContent = s.headBlock ? 'block ' + num(s.headBlock) : 'on-chain';
  paintUtil(s.util);
  const movers = document.getElementById('snap-movers');
  if (movers) {
    const list = (s.movers || []).filter(function (c) { return Number(c.marketCap) >= 3e6; });
    const html = list.map(function (c) { return row(c, money(c.marketCap), chg(c.change24h)); }).join('');
    movers.innerHTML = html || '<li class="mute">No movers above $3M</li>';
  }
  const locked = document.getElementById('snap-locked');
  if (locked) {
    const html = (s.locked || []).map(function (c) {
      const units = Number.isFinite(Number(c.stockLockedUnits))
        ? Number(c.stockLockedUnits).toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' ' + (c.pair || '')
        : '';
      return row(c, money(c.stockLockedUsd), { t: units, c: 'mute' });
    }).join('');
    locked.innerHTML = html || '<li class="mute">No lock data</li>';
  }
}
async function bootSnap() {
  try {
    const r = await fetch('/api/board');
    if (!r.ok) return;
    const d = await r.json();
    paintSnapshot(d.snapshot);
  } catch (e) {}
}
window.paintSnapshot = paintSnapshot;
window.imgErr = imgErr;
bootSnap();
setInterval(bootSnap, 60000);
