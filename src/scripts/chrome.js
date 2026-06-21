/* =============================================================
   Miranda — shared interactions
   Wires up the behaviors that used to be injected at runtime by
   the prototype's chrome.js. Header, footer and background are now
   real Astro components/layout markup; this script only wires the
   dynamic behaviors (scroll, reveal, magnetic, tilt, counters,
   decision console, accordions, before/after slider, FAQ, page
   transition curtain).
   ============================================================= */
(function () {
  "use strict";

  const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- Header: mobile menu + scrolled state ----
  function wireHeader() {
    const header = document.querySelector(".nav");
    const mobile = document.querySelector(".mobile-menu");
    const toggle = header && header.querySelector(".nav-toggle");
    if (toggle && mobile) {
      toggle.addEventListener("click", () => {
        const open = mobile.classList.toggle("open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
    if (header) {
      const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 20);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }
  }

  // ---- Curtain (page transitions) ----
  function wireTransitions() {
    const curtain = document.querySelector(".curtain");
    if (RM || !curtain) return;
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-nav], a[data-transition]");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || a.target === "_blank") return;
      if (href === location.pathname) return;
      e.preventDefault();
      curtain.classList.add("show");
      setTimeout(() => { location.href = href; }, 320);
    });
  }

  // ---- Reveal on scroll ----
  function wireReveal() {
    if (!document.hidden && !RM) document.documentElement.classList.add("js-anim");
    const vh = () => window.innerHeight;
    function show() {
      const h = vh();
      document.querySelectorAll(".reveal:not(.in)").forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.top < h * 0.92 && r.bottom > 0) el.classList.add("in");
      });
    }
    show();
    window.addEventListener("scroll", show, { passive: true });
    window.addEventListener("resize", show);
    setTimeout(show, 200);
    return show;
  }

  // ---- Magnetic buttons ----
  function wireMagnetic() {
    if (RM) return;
    document.querySelectorAll(".magnetic").forEach(btn => {
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        const mx = e.clientX - r.left - r.width / 2;
        const my = e.clientY - r.top - r.height / 2;
        btn.style.transform = "translate(" + mx * 0.16 + "px," + my * 0.26 + "px)";
      });
      btn.addEventListener("pointerleave", () => { btn.style.transform = ""; });
    });
  }

  // ---- Tilt panels ----
  function wireTilt() {
    if (RM) return;
    document.querySelectorAll("[data-tilt]").forEach(el => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = "perspective(1000px) rotateX(" + (py * -3.5) + "deg) rotateY(" + (px * 4.5) + "deg)";
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
  }

  // ---- Animated counters ----
  function wireCounters() {
    const els = [...document.querySelectorAll("[data-count]")];
    if (!els.length) return;
    function run() {
      els.forEach(el => {
        if (el.__done) return;
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.9 && r.bottom > 0) {
          el.__done = true;
          const target = parseFloat(el.getAttribute("data-count"));
          const suffix = el.getAttribute("data-suffix") || "";
          const prefix = el.getAttribute("data-prefix") || "";
          const dur = 1100;
          if (RM) { el.textContent = prefix + target + suffix; return; }
          const t0 = performance.now();
          (function tick(t) {
            const k = Math.min(1, (t - t0) / dur);
            const e = 1 - Math.pow(1 - k, 3);
            const val = Math.round(target * e);
            el.textContent = prefix + val + suffix;
            if (k < 1) requestAnimationFrame(tick);
          })(t0);
        }
      });
    }
    run();
    window.addEventListener("scroll", run, { passive: true });
    setTimeout(run, 300);
  }

  // ---- Scroll progress bar ----
  function wireProgress() {
    const bar = document.querySelector("[data-progress]");
    if (!bar) return;
    const upd = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + "%";
    };
    upd();
    window.addEventListener("scroll", upd, { passive: true });
  }

  // ---- Decision console (animated, switchable) ----
  function wireConsole() {
    document.querySelectorAll("[data-console]").forEach(root => {
      // running status line
      const status = root.querySelector("[data-status]");
      if (status) {
        const msgs = (status.getAttribute("data-status") || "").split("|");
        let i = 0;
        if (msgs.length > 1 && !RM) {
          setInterval(() => { i = (i + 1) % msgs.length; status.textContent = msgs[i]; }, 2600);
          status.textContent = msgs[0];
        }
      }
      // scan pulse over flow nodes
      const nodes = [...root.querySelectorAll(".flow .node")];
      if (nodes.length && !RM) {
        let s = 0;
        setInterval(() => {
          nodes.forEach(n => n.classList.remove("scan"));
          nodes[s].classList.add("scan");
          s = (s + 1) % nodes.length;
        }, 1400);
      }
      // comparison toggle
      const tabs = root.querySelectorAll("[data-tool]");
      tabs.forEach(t => t.addEventListener("click", () => {
        tabs.forEach(x => x.classList.remove("on"));
        t.classList.add("on");
        const tool = t.getAttribute("data-tool");
        root.querySelectorAll("[data-col]").forEach(c => {
          c.classList.toggle("win", c.getAttribute("data-col") === tool);
        });
      }));
    });
  }

  // ---- Expandable offer details ----
  function wireExpand() {
    document.querySelectorAll(".offer .toggle").forEach(t => {
      t.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        const card = t.closest(".offer");
        const open = card.classList.toggle("open");
        t.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
  }

  // ---- Before / after slider ----
  function wireBA() {
    document.querySelectorAll(".ba").forEach(ba => {
      const range = ba.querySelector("input[type=range]");
      const before = ba.querySelector(".before");
      const handle = ba.querySelector(".handle");
      if (!range || !before || !handle) return;
      const upd = () => { const v = range.value; before.style.width = v + "%"; handle.style.left = v + "%"; };
      const pane = before.querySelector(".pane");
      const setW = () => { if (pane) pane.style.width = ba.clientWidth + "px"; };
      setW();
      window.addEventListener("resize", setW);
      range.addEventListener("input", upd);
      upd();
    });
  }

  // ---- FAQ accordion ----
  function wireFAQ() {
    document.querySelectorAll(".qa button").forEach(b => {
      b.setAttribute("aria-expanded", "false");
      b.addEventListener("click", () => {
        const item = b.closest(".qa");
        const isOpen = item.classList.contains("open");
        // chiudi tutti
        document.querySelectorAll(".qa.open").forEach(el => {
          el.classList.remove("open");
          el.querySelector("button").setAttribute("aria-expanded", "false");
        });
        // apri questo se era chiuso
        if (!isOpen) {
          item.classList.add("open");
          b.setAttribute("aria-expanded", "true");
        }
      });
    });
  }

  // ---- Boot ----
  function boot() {
    wireHeader();
    wireProgress();
    wireReveal();
    wireMagnetic();
    wireTilt();
    wireCounters();
    wireConsole();
    wireExpand();
    wireBA();
    wireFAQ();
    if (window.lucide) lucide.createIcons();
    if (window.mountCockpit) window.mountCockpit();
    wireTransitions();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
