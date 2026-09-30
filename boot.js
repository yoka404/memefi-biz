(function () {
  const boot = document.getElementById("boot");
  const fill = document.getElementById("boot-fill");
  const copy = document.getElementById("boot-copy");
  if (!boot || !fill) return;
  let n = 8;
  let closed = false;
  function say(s) {
    if (copy && s) copy.textContent = s;
  }
  function paint(v) {
    n = Math.max(n, Math.min(100, v));
    fill.style.width = n + "%";
  }
  function close() {
    if (closed) return;
    closed = true;
    paint(100);
    boot.classList.add("done");
    setTimeout(function () { boot.classList.add("out"); }, 180);
    setTimeout(function () { if (boot.parentNode) boot.parentNode.removeChild(boot); }, 560);
  }
  window.bootMark = function (key) {
    if (key === "wire") paint(55);
    if (key === "board") { paint(96); close(); }
  };
  say("Fetching data");
  const tick = setInterval(function () {
    if (closed) { clearInterval(tick); return; }
    if (n < 48) paint(n + Math.max(0.35, (48 - n) * 0.06));
  }, 70);
  setTimeout(function () { if (!closed) close(); }, 14000);
})();
