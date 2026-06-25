/* ============================================================
   MAMMOTH SURGE — interactions & animation
   ============================================================ */
(function () {
    "use strict";

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const smallScreen = window.matchMedia("(max-width: 760px)").matches;
    const conn = navigator.connection || {};
    const lowPower = !!conn.saveData || (navigator.deviceMemory && navigator.deviceMemory <= 4);

    // Run a function at most once per animation frame.
    function rafThrottle(fn) {
        let ticking = false, lastArgs;
        return function (...args) {
            lastArgs = args;
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(() => { ticking = false; fn.apply(this, lastArgs); });
            }
        };
    }

    /* ---------- Year ---------- */
    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    /* ---------- Sticky nav + scroll progress ---------- */
    const nav = document.getElementById("nav");
    const progress = document.getElementById("scroll-progress");

    function applyScroll() {
        scrollScheduled = false;
        const y = window.scrollY;
        if (nav) nav.classList.toggle("scrolled", y > 30);
        if (progress) {
            const h = document.documentElement.scrollHeight - window.innerHeight;
            progress.style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
        }
    }
    let scrollScheduled = false;
    function onScroll() {
        if (!scrollScheduled) {
            scrollScheduled = true;
            requestAnimationFrame(applyScroll);
        }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    applyScroll();

    /* ---------- Mobile menu ---------- */
    const burger = document.getElementById("nav-burger");
    const links = document.querySelector(".nav__links");
    if (burger && links) {
        const toggle = (open) => {
            const isOpen = open ?? !links.classList.contains("open");
            links.classList.toggle("open", isOpen);
            burger.setAttribute("aria-expanded", String(isOpen));
            document.body.style.overflow = isOpen ? "hidden" : "";
        };
        burger.addEventListener("click", () => toggle());
        links.querySelectorAll("a").forEach((a) =>
            a.addEventListener("click", () => toggle(false))
        );
    }

    /* ---------- Reveal on scroll (stagger by group) ---------- */
    const revealEls = Array.from(document.querySelectorAll("[data-reveal]"));
    if ("IntersectionObserver" in window && !prefersReduced) {
        // assign small stagger delays to siblings in the same container
        const groups = new Map();
        revealEls.forEach((el) => {
            const parent = el.closest("section, .hero__grid, .footer__inner") || document.body;
            const arr = groups.get(parent) || [];
            arr.push(el);
            groups.set(parent, arr);
        });
        groups.forEach((arr) => {
            arr.forEach((el, i) => {
                el.style.setProperty("--reveal-delay", Math.min(i * 0.07, 0.5) + "s");
            });
        });

        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) {
                        e.target.classList.add("in");
                        io.unobserve(e.target);
                    }
                });
            },
            { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
        );
        revealEls.forEach((el) => io.observe(el));
    } else {
        revealEls.forEach((el) => el.classList.add("in"));
    }

    /* ---------- Animated counters ---------- */
    const counters = Array.from(document.querySelectorAll(".count"));
    if ("IntersectionObserver" in window && counters.length) {
        const cio = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (!e.isIntersecting) return;
                    const el = e.target;
                    const target = parseFloat(el.dataset.target || "0");
                    const suffix = el.dataset.suffix || "";
                    const dur = 1500;
                    const start = performance.now();
                    const step = (now) => {
                        const p = Math.min((now - start) / dur, 1);
                        const eased = 1 - Math.pow(1 - p, 3);
                        el.textContent = Math.round(target * eased) + suffix;
                        if (p < 1) requestAnimationFrame(step);
                    };
                    if (prefersReduced) {
                        el.textContent = target + suffix;
                    } else {
                        requestAnimationFrame(step);
                    }
                    cio.unobserve(el);
                });
            },
            { threshold: 0.6 }
        );
        counters.forEach((c) => cio.observe(c));
    }

    /* ---------- Card spotlight (pointer-follow glow) ---------- */
    if (!coarse) {
        document.querySelectorAll(".card").forEach((card) => {
            const move = rafThrottle((cx, cy) => {
                const r = card.getBoundingClientRect();
                card.style.setProperty("--mx", ((cx - r.left) / r.width) * 100 + "%");
                card.style.setProperty("--my", ((cy - r.top) / r.height) * 100 + "%");
            });
            card.addEventListener("pointermove", (e) => move(e.clientX, e.clientY), { passive: true });
        });
    }

    /* ---------- Parallax on mammoth + product specs ---------- */
    const stage = document.getElementById("product-stage");
    const mcard = document.querySelector(".mammoth__card");
    if (stage && mcard && !prefersReduced && !coarse) {
        const specs = stage.querySelectorAll(".spec");
        const move = rafThrottle((cx, cy) => {
            const r = stage.getBoundingClientRect();
            const dx = (cx - r.left) / r.width - 0.5;
            const dy = (cy - r.top) / r.height - 0.5;
            mcard.style.transform = `rotateX(${-dy * 12}deg) rotateY(${dx * 16}deg)`;
            specs.forEach((s, i) => {
                const depth = (i + 1) * 6;
                s.style.transform = `translate(${dx * depth}px, ${dy * depth}px)`;
            });
        });
        stage.addEventListener("pointermove", (e) => move(e.clientX, e.clientY), { passive: true });
        stage.addEventListener("pointerleave", () => {
            mcard.style.transform = "";
            specs.forEach((s) => (s.style.transform = ""));
        });
    }

    /* ---------- Toast ---------- */
    const toast = document.getElementById("toast");
    let toastTimer;
    function showToast(msg) {
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
    }

    /* ---------- Checkout (Stripe via backend) ---------- */
    const API_BASE = ((window.MAMMOTH_CONFIG && window.MAMMOTH_CONFIG.apiBase) || "").replace(/\/$/, "");
    const PLAN_BY_LABEL = {
        "Single Surge": "single",
        "Mammoth Pack": "mammoth",
        "Beast Mode": "beast",
    };

    async function startCheckout(plan, btn) {
        if (!API_BASE) {
            // Demo mode — no backend configured yet.
            showToast("Checkout isn’t connected yet — add your API URL in js/config.js");
            return;
        }
        const original = btn ? btn.textContent : "";
        if (btn) {
            btn.disabled = true;
            btn.dataset.loading = "1";
            btn.textContent = "Redirecting…";
        }
        try {
            const res = await fetch(`${API_BASE}/api/checkout`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan, quantity: 1 }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.url) {
                throw new Error(data.error || `Checkout failed (${res.status})`);
            }
            window.location.assign(data.url); // → Stripe Checkout
        } catch (err) {
            showToast(`Checkout error: ${err.message}`);
            if (btn) {
                btn.disabled = false;
                delete btn.dataset.loading;
                btn.textContent = original;
            }
        }
    }

    document.querySelectorAll("[data-buy]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const plan = btn.dataset.plan || PLAN_BY_LABEL[btn.dataset.buy];
            if (plan) startCheckout(plan, btn);
            else showToast(`"${btn.dataset.buy}" added to cart — let's surge!`);
        });
    });

    // Generic "Add to Cart" CTAs (links) just guide users to the pricing table.
    document.querySelectorAll('a[href="#buy"]').forEach((a) => {
        a.addEventListener("click", () => {
            if (a.textContent.trim().toLowerCase().includes("add to cart")) {
                showToast("Pick your power pack below 👇");
            }
        });
    });

    /* ---------- Ember particle system (sprite-based, throttled) ---------- */
    const canvas = document.getElementById("ember-canvas");
    if (canvas && !prefersReduced && !smallScreen && !lowPower) {
        const ctx = canvas.getContext("2d");
        let w, h, embers, raf, last = 0;
        const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
        const FRAME = 1000 / 40; // cap ~40fps for ambient embers
        const COLORS = ["#ff8a2b", "#ff5a1f", "#f4c14b", "#ff3d2e", "#ffb347"];

        // Pre-render soft glow sprites ONCE (avoids per-particle shadowBlur each frame).
        const sprites = COLORS.map((hex) => {
            const n = parseInt(hex.slice(1), 16);
            const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
            const size = 24;
            const sc = document.createElement("canvas");
            sc.width = sc.height = size;
            const sx = sc.getContext("2d");
            const grd = sx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
            grd.addColorStop(0, `rgba(${r},${g},${b},1)`);
            grd.addColorStop(0.3, `rgba(${r},${g},${b},0.7)`);
            grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
            sx.fillStyle = grd;
            sx.fillRect(0, 0, size, size);
            return sc;
        });

        function makeEmber(initial) {
            return {
                x: Math.random() * w,
                y: initial ? Math.random() * h : h + Math.random() * 40 * DPR,
                r: (Math.random() * 2 + 0.8) * DPR,
                vy: (Math.random() * 0.6 + 0.25) * DPR,
                vx: (Math.random() - 0.5) * 0.4 * DPR,
                a: Math.random() * 0.5 + 0.2,
                tw: Math.random() * Math.PI * 2,
                tws: Math.random() * 0.04 + 0.01,
                s: (Math.random() * sprites.length) | 0,
            };
        }
        function resize() {
            w = canvas.width = Math.floor(innerWidth * DPR);
            h = canvas.height = Math.floor(innerHeight * DPR);
            canvas.style.width = innerWidth + "px";
            canvas.style.height = innerHeight + "px";
            const count = Math.min(40, Math.floor((innerWidth * innerHeight) / 36000));
            embers = Array.from({ length: count }, () => makeEmber(true));
        }
        function tick(now) {
            raf = requestAnimationFrame(tick);
            if (now - last < FRAME) return;
            last = now;
            ctx.clearRect(0, 0, w, h);
            ctx.globalCompositeOperation = "lighter";
            for (const e of embers) {
                e.y -= e.vy;
                e.x += e.vx + Math.sin(e.tw) * 0.3 * DPR;
                e.tw += e.tws;
                const flicker = 0.6 + Math.sin(e.tw * 2) * 0.4;
                const d = e.r * 7;
                ctx.globalAlpha = e.a * flicker;
                ctx.drawImage(sprites[e.s], e.x - d / 2, e.y - d / 2, d, d);
                if (e.y < -10 * DPR) Object.assign(e, makeEmber(false));
            }
            ctx.globalAlpha = 1;
        }
        resize();
        raf = requestAnimationFrame(tick);
        let rt;
        window.addEventListener("resize", () => {
            clearTimeout(rt);
            rt = setTimeout(resize, 200);
        });
        document.addEventListener("visibilitychange", () => {
            cancelAnimationFrame(raf);
            if (!document.hidden) { last = 0; raf = requestAnimationFrame(tick); }
        });
    }

    /* ---------- Marquee speed sync (pause when offscreen handled by CSS) ---------- */
})();
