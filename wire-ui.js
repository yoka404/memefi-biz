function clean(s) {
  let t = String(s || "");
  for (let i = 0; i < 3; i++) {
    t = t.split("\u0026amp;").join("&").split("\u0026lt;").join("<").split("\u0026gt;").join(">").split("\u0026quot;").join('"');
  }
  t = t.replace(/<[^>]*>/g, " ").replace(/<[^>]*$/g, " ");
  t = t.replace(/https?:\/\/news\.google\.com\/\S+/g, " ");
  return t.replace(/\s+/g, " ").trim();
}
function okBlurb(s) {
  const t = String(s || "");
  if (!t) return "";
  if (/href\s*=|<a\s|news\.google|<font|<|>/i.test(t)) return "";
  return t.slice(0, 140);
}
function hue(s) {
  let n = 0;
  const t = String(s || "wire");
  for (let i = 0; i < t.length; i++) n = (n * 33 + t.charCodeAt(i)) >>> 0;
  return 230 + (n % 70);
}
function goodImg(url) {
  const u = String(url || "");
  if (!/^https?:/i.test(u)) return false;
  if (/news\.google|gstatic|google\.com\/images|default-logo|og-banners\/home|favicon/i.test(u)) return false;
  return true;
}
function paintWire(items) {
  const track = document.getElementById("wire-track");
  const dots = document.getElementById("wire-dots");
  if (!track) return;
  const list = (items || []).filter((it) => it && it.title && it.url).slice(0, 20);
  if (!list.length) {
    track.innerHTML = '<article class="wire-card empty"><p>Wire is quiet.</p></article>';
    return;
  }
  track.innerHTML = list.map((it, i) => {
    const href = String(it.url || "#").replace(/"/g, "");
    const img = String(it.image || "").replace(/"/g, "");
    const src = clean(it.source || "Wire");
    const title = clean(it.title || "");
    const blurb = okBlurb(clean(it.blurb || ""));
    const photo = goodImg(img)
      ? '<img src="' + img + '" alt="" loading="' + (i ? "lazy" : "eager") + '" onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),{className:\'ph\',style:\'--h:' + hue(src) + '\',innerHTML:this.parentNode.nextElementSibling ? this.parentNode.nextElementSibling.innerHTML : \'\'}))"/>'
      : '<div class="ph" style="--h:' + hue(src + title) + '"><em>' + src + '</em><b>' + title + '</b></div>';
    return '<a class="wire-card" href="' + href + '" target="_blank" rel="noopener">' +
      '<div class="shot">' + photo + '</div>' +
      '<div class="copy"><em>' + src + '</em><strong>' + title + '</strong>' +
      (blurb ? '<span>' + blurb + '</span>' : '') +
      '</div></a>';
  }).join("");
  if (dots) {
    dots.innerHTML = list.map((_, i) => '<button type="button" data-w="' + i + '"' + (i === 0 ? ' class="on"' : '') + '></button>').join("");
  }
  const tag = document.getElementById("wire-tag");
  if (tag) { tag.textContent = "Live"; tag.classList.add("on-air"); }
}
function scrollToCard(i) {
  const track = document.getElementById("wire-track");
  if (!track) return;
  const card = track.children[i];
  if (card) card.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  document.querySelectorAll("#wire-dots button").forEach((b, n) => b.classList.toggle("on", n === i));
}
function currentIndex() {
  const track = document.getElementById("wire-track");
  if (!track || !track.children.length) return 0;
  const x = track.scrollLeft;
  let best = 0;
  let dist = Infinity;
  Array.from(track.children).forEach((el, i) => {
    const d = Math.abs(el.offsetLeft - x);
    if (d < dist) { dist = d; best = i; }
  });
  return best;
}
async function loadCarousel() {
  try {
    const r = await fetch("/api/wire", { cache: "no-store" });
    if (!r.ok) return;
    const data = await r.json();
    paintWire(data.items || []);
  } catch (e) {}
}
document.addEventListener("click", (e) => {
  const t = e.target;
  if (!t) return;
  if (t.id === "wire-prev" || (t.closest && t.closest("#wire-prev"))) {
    scrollToCard(Math.max(0, currentIndex() - 1));
  }
  if (t.id === "wire-next" || (t.closest && t.closest("#wire-next"))) {
    const track = document.getElementById("wire-track");
    const max = track ? track.children.length - 1 : 0;
    scrollToCard(Math.min(max, currentIndex() + 1));
  }
  if (t.dataset && t.dataset.w != null) scrollToCard(Number(t.dataset.w));
});
setTimeout(() => {
  const el = document.getElementById("wire-track");
  if (!el) return;
  el.addEventListener("scroll", () => {
    const i = currentIndex();
    document.querySelectorAll("#wire-dots button").forEach((b, n) => b.classList.toggle("on", n === i));
  }, { passive: true });
}, 0);
loadCarousel();
setInterval(loadCarousel, 120000);
