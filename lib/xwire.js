const ACCOUNTS = ["WhaleInsider", "memefibiz", "TheBlock__", "Decrypt", "banklesshq"];
const PIN = ["2097223244692574351"];

function relevant(text) {
  const t = String(text || "").toLowerCase();
  return /robinhood chain|tokenized stock|tokenised stock|stock token|memefi|meme\.fi|stock[- ]paired|tokenized (equity|share|etf)|rwa|xstocks|hood chain/.test(t);
}

async function fx(id) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch("https://api.fxtwitter.com/status/" + id, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "memefi.biz wire" }
    });
    if (!r.ok) return null;
    const data = await r.json();
    const tw = data && data.tweet;
    if (!tw || !tw.text) return null;
    const photos = ((tw.media && tw.media.photos) || []).map((p) => p.url || p).filter(Boolean);
    const author = (tw.author && (tw.author.screen_name || tw.author.name)) || "X";
    return {
      source: "@" + String(author).replace(/^@/, ""),
      title: String(tw.text).replace(/\s+/g, " ").trim().slice(0, 180),
      blurb: "",
      url: tw.url || ("https://x.com/i/status/" + id),
      image: photos[0] || (tw.author && tw.author.avatar_url) || null,
      published: tw.created_timestamp ? new Date(Number(tw.created_timestamp) * 1000).toISOString() : "",
      score: relevant(tw.text) ? 8 : 2
    };
  } catch (e) {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function profileIds(handle) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch("https://r.jina.ai/https://x.com/" + handle, {
      signal: ctrl.signal,
      headers: { Accept: "text/plain", "User-Agent": "memefi.biz wire" }
    });
    if (!r.ok) return [];
    const text = await r.text();
    const ids = [];
    const re = /status\/(\d{15,})/g;
    let m;
    while ((m = re.exec(text))) {
      if (!ids.includes(m[1])) ids.push(m[1]);
    }
    return ids.slice(0, 5);
  } catch (e) {
    return [];
  } finally {
    clearTimeout(t);
  }
}

export async function pullX() {
  const bags = await Promise.all(ACCOUNTS.map(profileIds));
  const ids = [];
  for (const id of PIN) if (!ids.includes(id)) ids.push(id);
  for (const bag of bags) {
    for (const id of bag) if (!ids.includes(id)) ids.push(id);
  }
  const tweets = await Promise.all(ids.slice(0, 12).map(fx));
  return tweets.filter((row) => row && row.title && (row.score >= 8 || relevant(row.title)));
}
