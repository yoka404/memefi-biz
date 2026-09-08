const HOSTS = ["https://api.fxtwitter.com/status/", "https://api.vxtwitter.com/status/"];
const PIN = [
  "2097223244692574351",
  "2096189719310725292"
];

function relevant(text) {
  const t = String(text || "").toLowerCase();
  return /robinhood|tokenized stock|tokenised stock|stock token|memefi|meme\.fi|stock[- ]paired|tokenized|rwa|xstocks/.test(t);
}

async function fx(id) {
  for (const host of HOSTS) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    try {
      const r = await fetch(host + id, {
        signal: ctrl.signal,
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 memefi.biz" }
      });
      if (!r.ok) continue;
      const data = await r.json();
      const tw = data && (data.tweet || data);
      const text = tw && (tw.text || (tw.raw_text && tw.raw_text.text));
      if (!text) continue;
      const media = tw.media || {};
      const photos = (media.photos || media.all || []).map((p) => p.url || p).filter((u) => /^https?:/.test(String(u)));
      const author = (tw.author && (tw.author.screen_name || tw.author.name)) || "X";
      return {
        source: "@" + String(author).replace(/^@/, ""),
        title: String(text).replace(/\s+/g, " ").trim().slice(0, 180),
        blurb: "",
        url: tw.url || ("https://x.com/i/status/" + id),
        image: photos[0] || null,
        published: tw.created_timestamp ? new Date(Number(tw.created_timestamp) * 1000).toISOString() : "",
        score: 16,
        kind: "x"
      };
    } catch (e) {
    } finally {
      clearTimeout(t);
    }
  }
  return null;
}

export async function pullX() {
  const tweets = await Promise.all(PIN.map(fx));
  return tweets.filter((row) => row && row.title && relevant(row.title));
}
