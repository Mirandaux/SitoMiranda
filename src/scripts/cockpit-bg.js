/* =============================================================
   Miranda — Cockpit Field
   Shared cinematic background engine. Canvas 2D, no dependency.
   A drifting field of nodes with connecting "decision lines",
   depth parallax, cursor magnetism and wine accent pulses.
   Honors prefers-reduced-motion and pauses when offscreen.
   ============================================================= */
(function () {
  "use strict";

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const PALETTE = {
    node: "rgba(183, 196, 220, ",      // cool blue-grey nodes
    nodeWarm: "rgba(176, 106, 126, ",  // mauve
    line: "rgba(74, 119, 168, ",       // system blue connections
    accent: "rgba(124, 34, 63, ",      // wine accent
    accentGlow: "rgba(176, 106, 126, " // mauve glow
  };

  class CockpitField {
    constructor(canvas, opts) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      const o = opts || {};
      this.density = o.density != null ? o.density : 0.00010; // nodes per px^2
      this.maxNodes = o.maxNodes || 140;
      this.linkDist = o.linkDist || 150;
      this.speed = o.speed != null ? o.speed : 0.18;
      this.accentRatio = o.accentRatio != null ? o.accentRatio : 0.10;
      this.parallax = o.parallax != null ? o.parallax : 26;
      this.pointerPull = o.pointerPull != null ? o.pointerPull : 0.9;
      this.glow = o.glow != null ? o.glow : true;

      this.nodes = [];
      this.baseMax = this.maxNodes;
      this.scaleMult = 1;
      this.colAccent = PALETTE.accent;
      this.colAccentGlow = PALETTE.accentGlow;
      this.pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999, active: false };
      this.parX = 0; this.parY = 0; this.tParX = 0; this.tParY = 0;
      this.t = 0;
      this.running = false;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);

      this._resize = this._resize.bind(this);
      this._frame = this._frame.bind(this);
      this._onMove = this._onMove.bind(this);
      this._onLeave = this._onLeave.bind(this);

      this._resize();
      this._seed();

      window.addEventListener("resize", this._resize, { passive: true });
      window.addEventListener("pointermove", this._onMove, { passive: true });
      window.addEventListener("pointerleave", this._onLeave, { passive: true });

      // Pause when offscreen
      if ("IntersectionObserver" in window) {
        this.io = new IntersectionObserver((entries) => {
          const vis = entries.some((e) => e.isIntersecting);
          if (vis) this.start(); else this.stop();
        }, { threshold: 0 });
        this.io.observe(canvas);
      } else {
        this.start();
      }

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this.stop(); else if (this._inView) this.start();
      });

      if (REDUCED) { this._drawStatic(); this.stop(); }

      (window.__cockpitFields = window.__cockpitFields || []).push(this);
    }

    setScale(mult) {
      this.scaleMult = mult;
      this.maxNodes = Math.round(this.baseMax * mult);
      this._seed();
      if (!this.running) this._drawStatic();
    }
    setAccent(name) {
      if (name === "blue") { this.colAccent = PALETTE.line; this.colAccentGlow = "rgba(74, 119, 168, "; }
      else if (name === "mauve") { this.colAccent = PALETTE.nodeWarm; this.colAccentGlow = PALETTE.accentGlow; }
      else { this.colAccent = PALETTE.accent; this.colAccentGlow = PALETTE.accentGlow; }
      if (!this.running) this._drawStatic();
    }

    _resize() {
      const r = this.canvas.getBoundingClientRect();
      this.w = Math.max(1, r.width);
      this.h = Math.max(1, r.height);
      this.canvas.width = Math.round(this.w * this.dpr);
      this.canvas.height = Math.round(this.h * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this._seed();
      if (REDUCED || !this.running) this._drawStatic();
    }

    _seed() {
      const target = Math.min(this.maxNodes, Math.round(this.w * this.h * this.density));
      const nodes = [];
      for (let i = 0; i < target; i++) {
        const z = Math.random();          // depth 0=far 1=near
        nodes.push({
          x: Math.random() * this.w,
          y: Math.random() * this.h,
          z,
          vx: (Math.random() - 0.5) * this.speed * (0.4 + z),
          vy: (Math.random() - 0.5) * this.speed * (0.4 + z),
          r: 0.6 + z * 2.0,
          accent: Math.random() < this.accentRatio,
          pulse: Math.random() * Math.PI * 2
        });
      }
      this.nodes = nodes;
    }

    _onMove(e) {
      this.pointer.tx = e.clientX;
      this.pointer.ty = e.clientY;
      this.pointer.active = true;
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      this.tParX = ((e.clientX - cx) / cx) * this.parallax;
      this.tParY = ((e.clientY - cy) / cy) * this.parallax;
    }
    _onLeave() {
      this.pointer.active = false;
      this.tParX = 0; this.tParY = 0;
    }

    start() {
      this._inView = true;
      if (REDUCED) { this._drawStatic(); return; }
      if (this.running) return;
      this.running = true;
      this.raf = requestAnimationFrame(this._frame);
    }
    stop() {
      this._inView = false;
      this.running = false;
      if (this.raf) cancelAnimationFrame(this.raf);
    }

    _localPointer() {
      const r = this.canvas.getBoundingClientRect();
      return {
        x: this.pointer.x - r.left,
        y: this.pointer.y - r.top,
        active: this.pointer.active && this.pointer.x > r.left && this.pointer.x < r.right &&
                this.pointer.y > r.top && this.pointer.y < r.bottom
      };
    }

    _frame() {
      if (!this.running) return;
      this.t += 1;
      // ease pointer + parallax
      this.pointer.x += (this.pointer.tx - this.pointer.x) * 0.12;
      this.pointer.y += (this.pointer.ty - this.pointer.y) * 0.12;
      this.parX += (this.tParX - this.parX) * 0.05;
      this.parY += (this.tParY - this.parY) * 0.05;
      this._draw();
      this.raf = requestAnimationFrame(this._frame);
    }

    _step(n) {
      n.x += n.vx; n.y += n.vy;
      const m = 40;
      if (n.x < -m) n.x = this.w + m; else if (n.x > this.w + m) n.x = -m;
      if (n.y < -m) n.y = this.h + m; else if (n.y > this.h + m) n.y = -m;
    }

    _draw() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.w, this.h);
      const nodes = this.nodes;
      const lp = this._localPointer();

      for (let i = 0; i < nodes.length; i++) this._step(nodes[i]);

      // connection lines
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        const ax = a.x + this.parX * a.z, ay = a.y + this.parY * a.z;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const bx = b.x + this.parX * b.z, by = b.y + this.parY * b.z;
          const dx = ax - bx, dy = ay - by;
          const d2 = dx * dx + dy * dy;
          if (d2 < this.linkDist * this.linkDist) {
            const d = Math.sqrt(d2);
            const alpha = (1 - d / this.linkDist) * 0.22 * (0.4 + (a.z + b.z) / 2);
            ctx.strokeStyle = PALETTE.line + alpha.toFixed(3) + ")";
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
          }
        }
      }

      // pointer magnetic lines (wine "decision lines")
      if (lp.active) {
        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i];
          const ax = a.x + this.parX * a.z, ay = a.y + this.parY * a.z;
          const dx = ax - lp.x, dy = ay - lp.y;
          const d2 = dx * dx + dy * dy;
          const R = 190;
          if (d2 < R * R) {
            const d = Math.sqrt(d2) || 1;
            const alpha = (1 - d / R) * 0.5;
            ctx.strokeStyle = PALETTE.accent + (alpha * 0.7).toFixed(3) + ")";
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(lp.x, lp.y);
            ctx.stroke();
            // gentle pull
            a.x -= (dx / d) * this.pointerPull * (1 - d / R) * 0.6;
            a.y -= (dy / d) * this.pointerPull * (1 - d / R) * 0.6;
          }
        }
      }

      // nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const x = n.x + this.parX * n.z, y = n.y + this.parY * n.z;
        const pulse = 0.7 + Math.sin(this.t * 0.02 + n.pulse) * 0.3;
        if (n.accent) {
          if (this.glow) {
            const g = ctx.createRadialGradient(x, y, 0, x, y, n.r * 6);
            g.addColorStop(0, this.colAccentGlow + (0.28 * pulse).toFixed(3) + ")");
            g.addColorStop(1, this.colAccentGlow + "0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, n.r * 6, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = this.colAccent + (0.85 * pulse).toFixed(3) + ")";
        } else {
          ctx.fillStyle = (n.z > 0.6 ? PALETTE.nodeWarm : PALETTE.node) + (0.5 * n.z + 0.18).toFixed(3) + ")";
        }
        ctx.beginPath();
        ctx.arc(x, y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    _drawStatic() {
      // one calm frame for reduced motion
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.w, this.h);
      const nodes = this.nodes;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < this.linkDist * this.linkDist) {
            const d = Math.sqrt(d2);
            ctx.strokeStyle = PALETTE.line + ((1 - d / this.linkDist) * 0.16).toFixed(3) + ")";
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        ctx.fillStyle = (n.accent ? PALETTE.accent : PALETTE.node) + (0.5 * n.z + 0.2).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // Auto-mount any <canvas data-cockpit>
  function mountAll() {
    document.querySelectorAll("canvas[data-cockpit]").forEach((c) => {
      if (c.__mounted) return;
      c.__mounted = true;
      const read = (k, d) => {
        const v = c.getAttribute("data-" + k);
        return v == null ? d : parseFloat(v);
      };
      new CockpitField(c, {
        density: read("density", 0.00010),
        maxNodes: read("max", 140),
        linkDist: read("link", 150),
        speed: read("speed", 0.18),
        accentRatio: read("accent", 0.10),
        parallax: read("parallax", 26),
        pointerPull: read("pull", 0.9),
        glow: c.getAttribute("data-glow") !== "off"
      });
    });
  }

  window.CockpitField = CockpitField;
  window.mountCockpit = mountAll;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountAll);
  } else {
    mountAll();
  }
})();
