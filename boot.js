(function () {
  const boot = document.getElementById("boot");
  const fill = document.getElementById("boot-fill");
  if (!boot || !fill) return;
  let n = 8;
  const done = { board: false, wire: false };
  let closed = false;
  function paint(v) {
    n = Math.max(n, Math.min(100, v));
    fill.style.width = n + "%";
  }
  function close() {
    if (closed) return;
    closed = true;
    paint(100);
    boot.classList.add("done");
    setTimeout(function () { boot.classList.add("out"); }, 220);
    setTimeout(function () { if (boot.parentNode) boot.parentNode.removeChild(boot); }, 700);
  }
  window.bootMark = function (key) {
    if (key === "board") { done.board = true; paint(74); }
    if (key === "wire") { done.wire = true; paint(88); }
    if (done.board && done.wire) close();
  };
  const tick = setInterval(function () {
    if (closed) { clearInterval(tick); return; }
    if (n < 58) paint(n + Math.max(0.4, (58 - n) * 0.07));
  }, 70);
  setTimeout(function () { if (!closed) close(); }, 9000);
})();
