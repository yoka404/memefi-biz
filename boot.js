(function () {
  const boot = document.getElementById("boot");
  const fill = document.getElementById("boot-fill");
  const copy = document.getElementById("boot-copy");
  if (!boot || !fill) return;
  let n = 8;
  const done = { board: false, wire: false };
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
    say("Live");
    boot.classList.add("done");
    setTimeout(function () { boot.classList.add("out"); }, 280);
    setTimeout(function () { if (boot.parentNode) boot.parentNode.removeChild(boot); }, 750);
  }
  window.bootMark = function (key) {
    if (key === "board") { done.board = true; paint(74); say("Reading chain"); }
    if (key === "wire") { done.wire = true; paint(88); say("Reading wire"); }
    if (done.board && done.wire) close();
  };
  const tick = setInterval(function () {
    if (closed) { clearInterval(tick); return; }
    if (n < 58) paint(n + Math.max(0.4, (58 - n) * 0.07));
  }, 70);
  setTimeout(function () { if (!closed) close(); }, 9000);
})();
