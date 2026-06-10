/* =============================================================
   Miranda — Hero immersiva: choreography
   Self-contained. Coexists with chrome.js (which owns nav,
   footer, background, tweaks, magnetic buttons, page reveals).
   This script only drives the hero: ambient motes, the entrance
   sequence (.go + .settled finalizer), the live console (timer,
   typing title, status cycle), the count-ups (data-cu) and the
   matrix A/B tabs + console tilt/parallax.
   ============================================================= */
(function () {
  "use strict";
  const hero = document.querySelector(".imm");
  if (!hero) return; // only on the home hero

  const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const playEntrance = !RM && !document.hidden;

  if (!RM) document.body.classList.add("is-armed");
  if (playEntrance) {
    document.body.classList.add("go");
    setTimeout(() => document.body.classList.add("settled"), 2900);
  }

  /* ---------- ambient motes ---------- */
  (function motes() {
    const amb = document.getElementById("amb");
    if (!amb || RM) return;
    for (let i = 0; i < 14; i++) {
      const m = document.createElement("span");
      m.className = "mote";
      const s = 1.5 + Math.random() * 2.5;
      m.style.width = m.style.height = s + "px";
      m.style.left = Math.random() * 100 + "vw";
      m.style.top = (60 + Math.random() * 40) + "vh";
      m.style.setProperty("--md", (12 + Math.random() * 12) + "s");
      m.style.setProperty("--mo", (0.25 + Math.random() * 0.4).toFixed(2));
      m.style.animationDelay = (-Math.random() * 18) + "s";
      amb.appendChild(m);
    }
  })();

  /* ---------- console tilt + parallax chips ---------- */
  if (!RM) {
    const con = document.getElementById("heroConsole");
    const chips = hero.querySelectorAll(".chip-float");
    const wrap = hero.querySelector(".console-wrap");
    if (con && wrap) {
      wrap.addEventListener("pointermove", (e) => {
        const r = con.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        con.style.transform = "perspective(1100px) rotateX(" + (py * -3.2) + "deg) rotateY(" + (px * 4.4) + "deg)";
        chips.forEach(c => {
          const d = parseFloat(c.dataset.depth || 1);
          c.style.transform = "translate(" + (px * d * -10) + "px," + (py * d * -8) + "px)";
        });
      });
      wrap.addEventListener("pointerleave", () => {
        con.style.transform = "";
        chips.forEach(c => c.style.transform = "");
      });
    }
  }

  /* ---------- count-up (data-cu) ---------- */
  // IT thousands separator (dot). Manual, no locale-data dependency.
  function fmt(v, money) { return (money || v >= 1000) ? String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ".") : String(v); }
  function countUp(el, delay) {
    const target = parseFloat(el.getAttribute("data-cu"));
    const pre = el.getAttribute("data-prefix") || "";
    const suf = el.getAttribute("data-suffix") || "";
    const money = el.getAttribute("data-money") === "1";
    const finalTxt = pre + fmt(target, money) + suf;
    if (RM) { el.textContent = finalTxt; return; }
    setTimeout(() => {
      const dur = 1000, t0 = performance.now();
      (function tick(t) {
        const k = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - k, 3);
        el.textContent = pre + fmt(Math.round(target * e), money) + suf;
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
      // Guarantee the final value even where rAF is throttled/frozen
      // (capture/offscreen): timers still fire.
      setTimeout(() => { el.textContent = finalTxt; }, 1120);
    }, delay || 0);
  }
  hero.querySelectorAll("[data-cu]").forEach(c => countUp(c, c.closest("table.mtx") ? 1150 : 700));

  /* ---------- matrix A/B tabs ---------- */
  const tabs = hero.querySelectorAll(".mtx-tabs button");
  tabs.forEach(t => t.addEventListener("click", () => {
    tabs.forEach(x => x.classList.remove("on"));
    t.classList.add("on");
    const tool = t.getAttribute("data-tool");
    hero.querySelectorAll("[data-col]").forEach(c => c.classList.toggle("win", c.getAttribute("data-col") === tool));
    const b = hero.querySelector("#verdict .vtext b");
    if (b) b.textContent = "Decisione: Tool " + tool;
  }));

  /* ---------- status chip cycle ---------- */
  const statusText = document.getElementById("heroStatus");
  if (statusText && !RM) {
    const STAT = ["sessione di triage", "mappatura as-is", "criteri condivisi", "analisi adozione", "matrice + rischi"];
    let si = 0;
    setInterval(() => { si = (si + 1) % STAT.length; statusText.textContent = STAT[si]; }, 2800);
  }

  /* ---------- header timer ---------- */
  const timer = document.getElementById("heroTimer");
  if (timer) {
    if (!RM) {
      let s = 0;
      setInterval(() => { s++; timer.textContent = String(Math.floor(s/60)).padStart(2,"0") + ":" + String(s%60).padStart(2,"0"); }, 1000);
    } else { timer.textContent = "live"; }
  }

  /* ---------- typing console title ---------- */
  const ctitle = document.getElementById("heroCtitle");
  if (ctitle && !RM) {
    const txt = ctitle.textContent;
    ctitle.textContent = "";
    let i = 0;
    setTimeout(function step() {
      ctitle.textContent = txt.slice(0, i);
      if (i++ <= txt.length) setTimeout(step, 42);
    }, 360);
  }
})();
