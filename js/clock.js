// Claim countdown tiles: presentational only. Mirrors the countdown text
// that app.js writes into #cl-countdown ("Xd XXh XXm XXs") onto the four
// flip tiles, the way the reference claim page shows them.
(function () {
  var src = document.getElementById("cl-countdown");
  if (!src) return;
  var el = {
    d: document.getElementById("cdD"),
    h: document.getElementById("cdH"),
    m: document.getElementById("cdM"),
    s: document.getElementById("cdS"),
  };
  if (!el.d) return;
  function pad(n) { return String(n).padStart(2, "0"); }
  function sync() {
    var t = (src.textContent || "").trim();
    var m = /^(\d+)d\s+(\d+)h\s+(\d+)m\s+(\d+)s$/.exec(t);
    if (m) {
      el.d.textContent = m[1];
      el.h.textContent = pad(m[2]);
      el.m.textContent = pad(m[3]);
      el.s.textContent = pad(m[4]);
    } else if (/Claims are open/i.test(t)) {
      el.d.textContent = "0"; el.h.textContent = "00"; el.m.textContent = "00"; el.s.textContent = "00";
    } else {
      el.d.textContent = "––"; el.h.textContent = "––"; el.m.textContent = "––"; el.s.textContent = "––";
    }
  }
  sync();
  setInterval(sync, 500);
})();
