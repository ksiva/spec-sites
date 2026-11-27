// Shared motion kit for spec sites: Lenis smooth scroll + GSAP.
// Attributes:
//   data-split            headline: words rise in on load / when scrolled into view
//   data-reveal           block fades up when scrolled into view (children stagger with data-reveal="stagger")
//   data-parallax="0.15"  moves at a fraction of scroll speed
//   data-magnetic         element leans toward the pointer
//   data-cursor="Label"   custom cursor grows and shows Label while hovering
//   data-preview="src"    list row: floating video preview follows the pointer
//   data-hover-play       <video> inside plays on hover, pauses on leave
//   data-clip-reveal      image/video wrapper wipes open when scrolled into view
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger, SplitText);

// "?motion" in the URL forces full motion (for testing in browsers set to reduce motion).
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches && !location.search.includes("motion");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

function smoothScroll() {
  if (reduce) return null;
  const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

function splitHeadlines() {
  document.querySelectorAll("[data-split]").forEach((el) => {
    const split = SplitText.create(el, { type: "words,lines", mask: "lines" });
    if (reduce) return;
    gsap.from(split.words, {
      yPercent: 110,
      duration: 1.1,
      ease: "expo.out",
      stagger: 0.06,
      scrollTrigger: { trigger: el, start: "top 88%", once: true },
    });
  });
}

function reveals() {
  if (reduce) return;
  document.querySelectorAll("[data-reveal]").forEach((el) => {
    const targets = el.dataset.reveal === "stagger" ? el.children : el;
    gsap.from(targets, {
      y: 40,
      opacity: 0,
      duration: 1,
      ease: "power3.out",
      stagger: 0.08,
      scrollTrigger: { trigger: el, start: "top 85%", once: true },
    });
  });
  document.querySelectorAll("[data-clip-reveal]").forEach((el) => {
    gsap.fromTo(
      el,
      { clipPath: "inset(12% 12% 12% 12%)" },
      {
        clipPath: "inset(0% 0% 0% 0%)",
        ease: "none",
        scrollTrigger: { trigger: el, start: "top 90%", end: "top 35%", scrub: true },
      },
    );
  });
  document.querySelectorAll("[data-parallax]").forEach((el) => {
    const amount = parseFloat(el.dataset.parallax || "0.15");
    gsap.to(el, {
      yPercent: -100 * amount,
      ease: "none",
      scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true },
    });
  });
}

// Viewfinder cursor: four corner brackets follow the pointer. Over a link they pull focus and frame it;
// over a film (data-cursor) they open into a 16:9 frame with a REC light and a label.
function cursor() {
  if (!finePointer || reduce) return;
  const vf = document.createElement("div");
  vf.className = "kit-vf";
  vf.innerHTML = '<i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i><span class="kit-vf__rec"></span><span class="kit-vf__label"></span><span class="kit-vf__dot"></span>';
  document.body.append(vf);
  document.documentElement.classList.add("kit-cursor-on");
  const label = vf.querySelector(".kit-vf__label");
  const s = { x: -100, y: -100, w: 26, h: 26 };
  const to = (k, d) => gsap.quickTo(s, k, { duration: d, ease: "power3" });
  const xTo = to("x", 0.28), yTo = to("y", 0.28), wTo = to("w", 0.45), hTo = to("h", 0.45);
  let px = -100, py = -100, framed = null, moved = false;
  gsap.ticker.add(() => {
    if (framed) {
      const r = framed.getBoundingClientRect();
      xTo(r.left + r.width / 2); yTo(r.top + r.height / 2);
    }
    vf.style.transform = `translate(${s.x - s.w / 2}px, ${s.y - s.h / 2}px)`;
    vf.style.width = `${s.w}px`; vf.style.height = `${s.h}px`;
  });
  const free = () => { framed = null; vf.className = moved ? "kit-vf is-live" : "kit-vf"; wTo(26); hTo(26); xTo(px); yTo(py); };
  addEventListener("pointermove", (e) => {
    px = e.clientX; py = e.clientY;
    if (!moved) { moved = true; s.x = px; s.y = py; vf.classList.add("is-live"); }
    if (!framed) { xTo(px); yTo(py); }
  });
  document.documentElement.addEventListener("pointerleave", () => vf.classList.remove("is-live"));
  document.documentElement.addEventListener("pointerenter", () => { if (moved) vf.classList.add("is-live"); });
  document.querySelectorAll("[data-cursor]").forEach((el) => {
    el.addEventListener("pointerenter", () => { framed = null; label.textContent = el.dataset.cursor; vf.className = "kit-vf is-live is-media"; wTo(118); hTo(66); });
    el.addEventListener("pointerleave", free);
  });
  document.querySelectorAll("a, button").forEach((el) => {
    if (el.closest("[data-cursor]")) return;
    el.addEventListener("pointerenter", () => {
      // Pull focus onto the link: the brackets jump to frame it, with a little air.
      const r = el.getBoundingClientRect();
      if (r.width > innerWidth * 0.8 || r.height > 220) return; // big rows keep the free viewfinder
      framed = el; vf.className = "kit-vf is-live is-framed"; wTo(r.width + 18); hTo(r.height + 12);
    });
    el.addEventListener("pointerleave", free);
  });
  addEventListener("scroll", () => { if (framed) free(); }, { passive: true });
  addEventListener("pageshow", (e) => { if (e.persisted) free(); });
}

function magnetic() {
  if (!finePointer || reduce) return;
  document.querySelectorAll("[data-magnetic]").forEach((el) => {
    const xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "elastic.out(1, 0.4)" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "elastic.out(1, 0.4)" });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.35);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
    });
    el.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
  });
}

function hoverPreviews() {
  const rows = document.querySelectorAll("[data-preview]");
  if (!rows.length || !finePointer) return;
  const box = document.createElement("div");
  box.className = "kit-preview";
  box.innerHTML = '<video muted loop playsinline preload="none"></video>';
  document.body.append(box);
  const video = box.firstElementChild;
  const xTo = gsap.quickTo(box, "x", { duration: 0.5, ease: "power3" });
  const yTo = gsap.quickTo(box, "y", { duration: 0.5, ease: "power3" });
  const rTo = gsap.quickTo(box, "rotation", { duration: 0.8, ease: "power3" });
  let current = null;
  let px = -1, py = -1, lastX = 0;
  const show = (row) => {
    if (px < 0) return; // no real pointer position yet: never show it in a corner
    current = row;
    if (video.getAttribute("src") !== row.dataset.preview) video.src = row.dataset.preview;
    video.play().catch(() => {});
    gsap.to(box, { scale: 1, opacity: 1, duration: 0.45, ease: "power3.out", overwrite: "auto" });
  };
  const hide = (now = false) => {
    current = null;
    if (now) { gsap.killTweensOf(box, "scale,opacity"); gsap.set(box, { scale: 0.6, opacity: 0 }); video.pause(); return; }
    gsap.to(box, { scale: 0.6, opacity: 0, duration: 0.35, ease: "power2.in", overwrite: "auto", onComplete: () => { if (!current) video.pause(); } });
  };
  addEventListener("pointermove", (e) => {
    if (px < 0) gsap.set(box, { x: e.clientX, y: e.clientY }); // first move: start where the pointer is
    px = e.clientX; py = e.clientY;
    xTo(px); yTo(py);
    rTo(gsap.utils.clamp(-8, 8, (px - lastX) * 0.6)); lastX = px;
    const row = e.target.closest?.("[data-preview]");
    if (row && row !== current) show(row);
    else if (!row && current) hide();
  });
  // Scrolling moves rows under a still pointer without pointer events, so re-check what is under it.
  addEventListener("scroll", () => {
    if (px < 0) return;
    const row = document.elementFromPoint(px, py)?.closest("[data-preview]");
    if (row && row !== current) show(row);
    else if (!row && current) hide();
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => hide());
  // Leaving the page (a link, the curtain) or coming back from the browser cache: start clean.
  addEventListener("pagehide", () => hide(true));
  addEventListener("pageshow", (e) => { if (e.persisted) { hide(true); px = -1; } });
  document.addEventListener("click", (e) => { if (e.target.closest?.("a[href]")) hide(true); });
}

function hoverPlay() {
  const els = document.querySelectorAll("[data-hover-play]");
  // Touch screens have no hover: play only the card nearest the middle of the screen, one at a time.
  const io = !finePointer && "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => entries.forEach((e) => {
        const v = e.target.querySelector("video");
        if (!v) return;
        if (e.isIntersecting) { v.preload = "auto"; v.play().catch(() => {}); e.target.classList.add("is-playing"); }
        else { v.pause(); e.target.classList.remove("is-playing"); }
      }), { rootMargin: "-40% 0px -40% 0px" })
    : null;
  els.forEach((el) => {
    const v = el.querySelector("video");
    if (!v) return;
    if (io) { io.observe(el); return; }
    el.addEventListener("pointerenter", () => v.play().catch(() => {}));
    el.addEventListener("pointerleave", () => v.pause());
  });
}

function pageIn(delay = 0) {
  if (reduce) return;
  gsap.from("[data-page-in]", { opacity: 0, y: 16, duration: 0.9, ease: "power3.out", stagger: 0.05, delay });
}

// Film grain: a small noise tile redrawn a few times a second, laid over the page.
function grain() {
  if (reduce) return;
  const c = document.createElement("canvas");
  c.width = c.height = 160;
  const ctx = c.getContext("2d");
  const layer = document.createElement("div");
  layer.className = "kit-grain";
  document.body.append(layer);
  const frames = Array.from({ length: 4 }, () => {
    const img = ctx.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    return `url(${c.toDataURL()})`;
  });
  let k = 0;
  setInterval(() => { layer.style.backgroundImage = frames[k++ % frames.length]; }, 90);
}

// Curtain between pages: covers on leaving, lifts on arriving.
function pageTransitions() {
  const curtain = document.createElement("div");
  curtain.className = "kit-curtain";
  document.body.append(curtain);
  const cameIn = sessionStorage.getItem("kit-curtain") === "1";
  sessionStorage.removeItem("kit-curtain");
  if (cameIn && !reduce) {
    gsap.set(curtain, { yPercent: 0 });
    gsap.to(curtain, { yPercent: -100, duration: 0.9, ease: "expo.inOut", delay: 0.05 });
  } else {
    gsap.set(curtain, { yPercent: 100 });
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a || reduce || e.metaKey || e.ctrlKey || e.shiftKey || a.target === "_blank") return;
    const to = new URL(a.href, location.href);
    if (to.origin !== location.origin || (to.pathname === location.pathname && to.hash)) return;
    e.preventDefault();
    sessionStorage.setItem("kit-curtain", "1");
    gsap.fromTo(curtain, { yPercent: 100 }, { yPercent: 0, duration: 0.7, ease: "expo.inOut", onComplete: () => { location.href = to.href; } });
  });
  // Back/forward from the cache: make sure the curtain is not left covering the page.
  addEventListener("pageshow", (e) => { if (e.persisted) gsap.set(curtain, { yPercent: 100 }); });
  return cameIn;
}

/** Intro loader: counts to 100 while `ready` resolves, then lifts. Shown once per visit. */
export function loader(ready, label = "") {
  if (reduce || sessionStorage.getItem("kit-loaded")) return Promise.resolve(false);
  sessionStorage.setItem("kit-loaded", "1");
  const el = document.createElement("div");
  el.className = "kit-loader";
  el.innerHTML = `<span class="kit-loader__label">${label}</span><span class="kit-loader__n">0</span><span class="kit-loader__bar"></span>`;
  document.body.append(el);
  const n = el.querySelector(".kit-loader__n");
  const bar = el.querySelector(".kit-loader__bar");
  const count = { v: 0 };
  const climb = gsap.to(count, { v: 86, duration: 1.6, ease: "power2.out", onUpdate: () => { n.textContent = Math.round(count.v); gsap.set(bar, { scaleX: count.v / 100 }); } });
  const timeout = new Promise((r) => setTimeout(r, 3500));
  return Promise.race([ready, timeout]).then(() => new Promise((done) => {
    climb.kill();
    gsap.timeline({ onComplete: () => { el.remove(); done(true); } })
      .to(count, { v: 100, duration: 0.45, ease: "power1.out", onUpdate: () => { n.textContent = Math.round(count.v); gsap.set(bar, { scaleX: count.v / 100 }); } })
      .to(el.children, { yPercent: -120, opacity: 0, duration: 0.5, stagger: 0.04, ease: "power3.in" })
      .to(el, { yPercent: -100, duration: 0.9, ease: "expo.inOut" }, "-=0.2");
  }));
}

// Film player: any element with data-film-src opens a full-screen player (click, Enter or Space).
function filmPlayer() {
  const triggers = document.querySelectorAll("[data-film-src]");
  if (!triggers.length) return;
  const dlg = document.createElement("dialog");
  dlg.className = "kit-player";
  dlg.innerHTML = `<div class="kit-player__frame"><video controls playsinline loop></video></div>
    <div class="kit-player__meta"><span class="kit-player__t"></span><span class="kit-player__m"></span></div>
    <button class="kit-player__close" aria-label="Close player">Close</button>`;
  document.body.append(dlg);
  const v = dlg.querySelector("video");
  const open = (el) => {
    v.src = el.dataset.filmSrc;
    dlg.querySelector(".kit-player__t").textContent = el.dataset.filmTitle || "";
    dlg.querySelector(".kit-player__m").textContent = el.dataset.filmMeta || "";
    dlg.showModal();
    v.currentTime = 0; v.play().catch(() => {});
    if (!reduce) gsap.fromTo(dlg.querySelector(".kit-player__frame"), { clipPath: "inset(10% 10% 10% 10%)", opacity: 0 }, { clipPath: "inset(0% 0% 0% 0%)", opacity: 1, duration: 0.7, ease: "expo.out" });
  };
  triggers.forEach((el) => {
    if (!el.hasAttribute("tabindex")) el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.addEventListener("click", (e) => { if (e.target.closest("a")) return; open(el); });
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(el); } });
  });
  dlg.querySelector(".kit-player__close").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener("close", () => v.pause());
}

export function initMotion({ grain: withGrain = true } = {}) {
  const lenis = smoothScroll();
  const cameIn = pageTransitions();
  splitHeadlines();
  reveals();
  cursor();
  magnetic();
  hoverPreviews();
  hoverPlay();
  filmPlayer();
  pageIn(cameIn ? 0.45 : 0);
  if (withGrain) grain();
  return { lenis, gsap, ScrollTrigger };
}
