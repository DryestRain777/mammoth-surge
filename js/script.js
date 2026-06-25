/* ============================================================
   MAMMOTH SURGE — interactions & animation
   ============================================================ */
(function () {
    "use strict";

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---------- Year ---------- */
    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    /* ---------- Sticky nav + scroll progress ---------- */
    const nav = document.getElementById("nav");
    const progress = document.getElementById("scroll-progress");

    function onScroll() {
        const y = window.scrollY;
        if (nav) nav.classList.toggle("scrolled", y > 30);
        if (progress) {
            const h = document.documentElement.scrollHeight - window.innerHeight;
            progress.style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
        }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

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
    document.querySelectorAll(".card").forEach((card) => {
        card.addEventListener("pointermove", (e) => {
            const r = card.getBoundingClientRect();
            card.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
            card.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
        });
    });

    /* ---------- Parallax on mammoth + product specs ---------- */
    const stage = document.getElementById("product-stage");
    const card = document.querySelector(".mammoth__card");
    if (stage && card && !prefersReduced && window.matchMedia("(pointer:fine)").matches) {
        stage.addEventListener("pointermove", (e) => {
            const r = stage.getBoundingClientRect();
            const dx = (e.clientX - r.left) / r.width - 0.5;
            const dy = (e.clientY - r.top) / r.height - 0.5;
            card.style.transform = `rotateX(${-dy * 12}deg) rotateY(${dx * 16}deg)`;
            stage.querySelectorAll(".spec").forEach((s, i) => {
                const depth = (i + 1) * 6;
                s.style.transform = `translate(${dx * depth}px, ${dy * depth}px)`;
            });
        });
        stage.addEventListener("pointerleave", () => {
            card.style.transform = "";
            stage.querySelectorAll(".spec").forEach((s) => (s.style.transform = ""));
        });
    }

    /* ---------- Buy buttons -> toast ---------- */
    const toast = document.getElementById("toast");
    let toastTimer;
    function showToast(msg) {
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
    }
    document.querySelectorAll("[data-buy]").forEach((btn) => {
        btn.addEventListener("click", () => {
            showToast(`"${btn.dataset.buy}" added to cart — let's surge!`);
        });
    });
    // Generic "Add to Cart" / "Surge Now" CTAs without a plan
    document.querySelectorAll('a[href="#buy"]').forEach((a) => {
        a.addEventListener("click", () => {
            // let smooth-scroll happen; subtle confirmation only on showcase CTA
            if (a.textContent.trim().toLowerCase().includes("add to cart")) {
                showToast("Pick your power pack below 👇");
            }
        });
    });

    /* ---------- Ember particle system ---------- */
    const canvas = document.getElementById("ember-canvas");
    if (canvas && !prefersReduced) {
        const ctx = canvas.getContext("2d");
        let w, h, embers, raf;
        const DPR = Math.min(window.devicePixelRatio || 1, 2);
        const COLORS = ["#ff8a2b", "#ff5a1f", "#f4c14b", "#ff3d2e", "#ffb347"];

        function resize() {
            w = canvas.width = Math.floor(innerWidth * DPR);
            h = canvas.height = Math.floor(innerHeight * DPR);
            canvas.style.width = innerWidth + "px";
            canvas.style.height = innerHeight + "px";
            const count = Math.min(70, Math.floor((innerWidth * innerHeight) / 26000));
            embers = Array.from({ length: count }, makeEmber);
        }
        function makeEmber(initial) {
            return {
                x: Math.random() * w,
                y: initial ? Math.random() * h : h + Math.random() * 40 * DPR,
                r: (Math.random() * 2 + 0.6) * DPR,
                vy: (Math.random() * 0.6 + 0.25) * DPR,
                vx: (Math.random() - 0.5) * 0.4 * DPR,
                a: Math.random() * 0.5 + 0.2,
                tw: Math.random() * Math.PI * 2,
                tws: Math.random() * 0.04 + 0.01,
                c: COLORS[(Math.random() * COLORS.length) | 0],
            };
        }
        function tick() {
            ctx.clearRect(0, 0, w, h);
            ctx.globalCompositeOperation = "lighter";
            for (const e of embers) {
                e.y -= e.vy;
                e.x += e.vx + Math.sin(e.tw) * 0.3 * DPR;
                e.tw += e.tws;
                const flicker = 0.6 + Math.sin(e.tw * 2) * 0.4;
                ctx.globalAlpha = e.a * flicker;
                ctx.beginPath();
                ctx.fillStyle = e.c;
                ctx.shadowBlur = 12 * DPR;
                ctx.shadowColor = e.c;
                ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
                ctx.fill();
                if (e.y < -10 * DPR) Object.assign(e, makeEmber(false));
            }
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
            raf = requestAnimationFrame(tick);
        }
        resize();
        tick();
        let rt;
        window.addEventListener("resize", () => {
            clearTimeout(rt);
            rt = setTimeout(resize, 200);
        });
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) cancelAnimationFrame(raf);
            else raf = requestAnimationFrame(tick);
        });
    }

    /* ---------- Marquee speed sync (pause when offscreen handled by CSS) ---------- */
})();
