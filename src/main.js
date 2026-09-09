import "@fontsource/noto-serif-sc/chinese-simplified-400.css";
import "@fontsource/noto-serif-sc/chinese-simplified-700.css";
import "@fontsource/noto-sans-sc/chinese-simplified-400.css";
import "@fontsource/noto-sans-sc/chinese-simplified-500.css";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

const oldScene = document.querySelector(".ink-scene");
if (oldScene && !oldScene.querySelector(".ink-live")) {
  oldScene.remove();
}
if (!document.querySelector(".ink-scene")) {
  const scene = document.createElement("div");
  scene.className = "ink-scene";
  scene.setAttribute("aria-hidden", "true");
  scene.innerHTML = `
    <svg class="ink-filters" aria-hidden="true">
      <filter id="live-bleed" x="-40%" y="-40%" width="180%" height="180%">
        <feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="3" seed="7" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="42" xChannelSelector="R" yChannelSelector="G"/>
        <feGaussianBlur stdDeviation="2.2"/>
      </filter>
    </svg>
    <img class="ink-scene__wash" src="./ink-wash.svg" alt="" />
    <img class="ink-scene__haboku" src="./images/haboku.jpg" alt="" />
    <div class="ink-live"></div>
    <div class="ink-scene__grain"></div>
  `;
  document.body.prepend(scene);
}

if (!document.querySelector(".sheet")) {
  const bar = document.querySelector(".site-bar");
  const main = document.querySelector("main");
  const foot = document.querySelector(".site-end");
  if (bar && main) {
    const sheet = document.createElement("div");
    sheet.className = "sheet";
    bar.before(sheet);
    sheet.append(bar, main);
    if (foot) {
      sheet.append(foot);
    }
  }
}

const here = decodeURIComponent((location.pathname.split("/").pop() || "index.html") || "index.html");
const file = here === "" ? "index.html" : here;

document.querySelectorAll(".site-bar nav a").forEach((a) => {
  const href = (a.getAttribute("href") || "").replace("./", "");
  if (href === file || (file === "index.html" && (href === "" || href === "index.html"))) {
    a.setAttribute("aria-current", "page");
  }
});

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const wash = document.querySelector(".ink-scene__wash");
const haboku = document.querySelector(".ink-scene__haboku");
const grain = document.querySelector(".ink-scene__grain");
const live = document.querySelector(".ink-live");
const pointers = { x: 0, y: 0, tx: 0, ty: 0, down: false };
const lastPointer = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.4 };
let lastTrail = { x: lastPointer.x, y: lastPointer.y };
let lastY = window.scrollY;
let scrollV = 0;
let lastScrollSpawn = 0;
const cleanups = [];

function spawnInk(x, y, size, trail = false) {
  if (!live || live.childElementCount > 14) {
    return;
  }
  const blot = document.createElement("span");
  blot.className = trail ? "ink-blot ink-blot--trail" : "ink-blot";
  blot.style.left = `${x}px`;
  blot.style.top = `${y}px`;
  blot.style.setProperty("--ink-size", `${size}px`);
  blot.style.setProperty("--ink-rot", `${Math.round(Math.random() * 50 - 25)}deg`);
  live.append(blot);
  const clear = () => blot.remove();
  blot.addEventListener("animationend", clear, { once: true });
  window.setTimeout(clear, 1600);
}

function applyInkMotion() {
  pointers.x += (pointers.tx - pointers.x) * 0.1;
  pointers.y += (pointers.ty - pointers.y) * 0.1;
  scrollV *= 0.88;
  const y = window.scrollY;
  const pageH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const progress = Math.min(1, Math.max(0, y / pageH));
  const kick = Math.max(-36, Math.min(36, scrollV));
  const px = pointers.x * 36;
  const py = pointers.y * 24;
  if (wash) {
    wash.style.transform = `translate3d(${px * 0.4}px, ${progress * window.innerHeight * 0.22 + kick * 0.45 + py * 0.35}px, 0)`;
  }
  if (haboku) {
    haboku.style.transform = `translate3d(${px}px, ${progress * window.innerHeight * 0.38 + kick + py}px, 0)`;
  }
  if (grain) {
    grain.style.transform = `translate3d(${px * 0.12}px, ${progress * 18 + kick * 0.18}px, 0)`;
  }
}

if (!reduce) {
  const lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
  lenis.on("scroll", () => {
    ScrollTrigger.update();
  });

  const onScroll = () => {
    const y = window.scrollY;
    const dy = y - lastY;
    lastY = y;
    scrollV += dy * 0.22;
    applyInkMotion();
    const now = performance.now();
    if (Math.abs(dy) > 18 && now - lastScrollSpawn > 140) {
      lastScrollSpawn = now;
      spawnInk(
        lastPointer.x + (Math.random() - 0.5) * 48,
        lastPointer.y,
        90 + Math.min(80, Math.abs(dy) * 0.35),
        true,
      );
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  const tick = (time) => {
    lenis.raf(time * 1000);
    applyInkMotion();
  };
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  applyInkMotion();
  cleanups.push(() => {
    gsap.ticker.remove(tick);
    window.removeEventListener("scroll", onScroll);
    lenis.destroy();
  });

  const onPointerMove = (event) => {
    lastPointer.x = event.clientX;
    lastPointer.y = event.clientY;
    pointers.tx = event.clientX / window.innerWidth - 0.5;
    pointers.ty = event.clientY / window.innerHeight - 0.5;
    const dx = event.clientX - lastTrail.x;
    const dy = event.clientY - lastTrail.y;
    const dist = Math.hypot(dx, dy);
    const gap = pointers.down ? 18 : 24;
    if (dist < gap) {
      return;
    }
    const steps = Math.min(5, Math.max(1, Math.floor(dist / gap)));
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      spawnInk(
        lastTrail.x + dx * t,
        lastTrail.y + dy * t,
        pointers.down ? 90 + Math.random() * 36 : 70 + Math.random() * 34,
        true,
      );
    }
    lastTrail = { x: event.clientX, y: event.clientY };
  };
  const onPointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }
    pointers.down = true;
    lastPointer.x = event.clientX;
    lastPointer.y = event.clientY;
    lastTrail = { x: event.clientX, y: event.clientY };
    spawnInk(event.clientX, event.clientY, 150 + Math.random() * 70);
  };
  const onPointerUp = () => {
    pointers.down = false;
  };

  document.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointerup", onPointerUp, { passive: true });
  window.addEventListener("pointercancel", onPointerUp, { passive: true });
  cleanups.push(() => {
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
  });

  const intro = document.querySelectorAll(".hero .kicker, .hero h1, .hero p, .hero-frame, .chapter-head .vol, .chapter-head h1, .chapter-head .lead");
  if (intro.length) {
    gsap.from(intro, {
      autoAlpha: 0,
      y: 26,
      duration: 1.05,
      stagger: 0.08,
      ease: "power3.out",
    });
  }

  const seal = document.querySelector(".seal");
  if (seal) {
    gsap.from(seal, {
      scale: 1.55,
      autoAlpha: 0,
      rotate: -28,
      duration: 0.62,
      delay: 0.55,
      ease: "power3.out",
    });
  }

  gsap.utils.toArray(".ink-rise").forEach((el) => {
    gsap.from(el, {
      autoAlpha: 0,
      y: 20,
      duration: 0.78,
      ease: "power2.out",
      scrollTrigger: {
        trigger: el,
        start: "top 88%",
        once: true,
      },
    });
  });

  gsap.utils.toArray(".hero-frame img, .wide-fig img, .spread-fig img").forEach((img) => {
    gsap.from(img, {
      scale: 1.08,
      filter: "grayscale(0.55) contrast(1.05)",
      duration: 1.35,
      ease: "power2.out",
      scrollTrigger: {
        trigger: img.closest("figure") || img,
        start: "top 86%",
        once: true,
      },
    });
  });
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    ScrollTrigger.getAll().forEach((t) => t.kill());
    cleanups.forEach((fn) => fn());
  });
}
