import "@fontsource/noto-serif-sc/chinese-simplified-400.css";
import "@fontsource/noto-serif-sc/chinese-simplified-700.css";
import "@fontsource/noto-sans-sc/chinese-simplified-400.css";
import "@fontsource/noto-sans-sc/chinese-simplified-500.css";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

const oldScene = document.querySelector(".ink-scene");
if (oldScene && !oldScene.querySelector(".ink-canvas")) {
  oldScene.remove();
}
if (!document.querySelector(".ink-scene")) {
  const scene = document.createElement("div");
  scene.className = "ink-scene";
  scene.setAttribute("aria-hidden", "true");
  scene.innerHTML = `
    <img class="ink-scene__wash" src="./ink-wash.svg" alt="" />
    <img class="ink-scene__haboku" src="./images/haboku.jpg" alt="" />
    <div class="ink-live"><canvas class="ink-canvas"></canvas></div>
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
const canvas = live?.querySelector(".ink-canvas") || live?.appendChild(Object.assign(document.createElement("canvas"), { className: "ink-canvas" }));
const ctx = canvas?.getContext("2d", { alpha: true }) || null;
const pointers = { x: 0, y: 0, tx: 0, ty: 0, down: false };
const lastPointer = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.4 };
const stamps = [];
let lastTrail = null;
let lastY = window.scrollY;
let scrollV = 0;
let lastScrollSpawn = 0;
const cleanups = [];

function sizeCanvas() {
  if (!canvas || !ctx) {
    return;
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function addStamp(x, y, radius, duration) {
  if (stamps.length > 360) {
    stamps.splice(0, stamps.length - 360);
  }
  const seed = Math.random() * 8;
  stamps.push({
    x,
    y,
    r: radius * (0.78 + Math.random() * 0.36),
    rot: Math.random() * Math.PI * 2,
    seed,
    born: performance.now(),
    duration,
    lobes: [
      { x: 0, y: 0, sx: 1, sy: 0.72 + (seed % 1) * 0.2, a: 1 },
      { x: 0.22, y: -0.14, sx: 0.62, sy: 0.48, a: 0.45 },
      { x: -0.18, y: 0.16, sx: 0.5, sy: 0.58, a: 0.32 },
      { x: 0.08, y: 0.2, sx: 0.28, sy: 0.22, a: 0.22 },
    ],
  });
}

function spawnInk(x, y, size, trail = false) {
  addStamp(x, y, size * 0.4, trail ? 980 : 1450);
  if (!trail) {
    addStamp(x + (Math.random() - 0.5) * 28, y + (Math.random() - 0.5) * 22, size * 0.2, 1200);
  }
}

function strokeInk(x, y, size) {
  if (!lastTrail) {
    lastTrail = { x, y };
    spawnInk(x, y, size, true);
    return;
  }
  const dx = x - lastTrail.x;
  const dy = y - lastTrail.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 6) {
    return;
  }
  if (dist > 280) {
    lastTrail = { x, y };
    spawnInk(x, y, size, true);
    return;
  }
  const gap = 13;
  const steps = Math.max(1, Math.ceil(dist / gap));
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    spawnInk(lastTrail.x + dx * t, lastTrail.y + dy * t, size * (0.86 + Math.random() * 0.22), true);
  }
  lastTrail = { x, y };
}

function fillSoft(x, y, rx, ry, alpha) {
  if (!ctx || rx < 0.5 || ry < 0.5 || alpha <= 0) {
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const wash = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  wash.addColorStop(0, `rgb(24 23 21 / ${alpha})`);
  wash.addColorStop(0.34, `rgb(24 23 21 / ${alpha * 0.55})`);
  wash.addColorStop(0.68, `rgb(24 23 21 / ${alpha * 0.18})`);
  wash.addColorStop(1, "rgb(24 23 21 / 0)");
  ctx.fillStyle = wash;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBlot(stamp, alpha, radius) {
  if (!ctx) {
    return;
  }
  ctx.save();
  ctx.translate(stamp.x, stamp.y);
  ctx.rotate(stamp.rot);
  stamp.lobes.forEach((lobe) => {
    fillSoft(radius * lobe.x, radius * lobe.y, radius * lobe.sx, radius * lobe.sy, alpha * lobe.a);
  });
  ctx.restore();
}

function paintInk() {
  if (!ctx || !canvas) {
    return;
  }
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  const now = performance.now();
  let keep = 0;
  for (let i = 0; i < stamps.length; i += 1) {
    const stamp = stamps[i];
    const t = (now - stamp.born) / stamp.duration;
    if (t >= 1) {
      continue;
    }
    const fade = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88;
    drawBlot(stamp, Math.max(0, fade) * 0.34, stamp.r * (0.85 + t * 1.05));
    stamps[keep] = stamp;
    keep += 1;
  }
  stamps.length = keep;
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
    paintInk();
  };
  sizeCanvas();
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  applyInkMotion();
  const onResize = () => sizeCanvas();
  window.addEventListener("resize", onResize);
  cleanups.push(() => {
    gsap.ticker.remove(tick);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    lenis.destroy();
  });

  const onPointerMove = (event) => {
    lastPointer.x = event.clientX;
    lastPointer.y = event.clientY;
    pointers.tx = event.clientX / window.innerWidth - 0.5;
    pointers.ty = event.clientY / window.innerHeight - 0.5;
    strokeInk(
      event.clientX,
      event.clientY,
      pointers.down ? 108 + Math.random() * 24 : 86 + Math.random() * 20,
    );
  };
  const onPointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }
    pointers.down = true;
    lastPointer.x = event.clientX;
    lastPointer.y = event.clientY;
    lastTrail = { x: event.clientX, y: event.clientY };
    spawnInk(event.clientX, event.clientY, 176 + Math.random() * 40);
  };
  const onPointerUp = () => {
    pointers.down = false;
  };
  const onPointerLeave = () => {
    lastTrail = null;
    pointers.down = false;
  };

  document.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointerup", onPointerUp, { passive: true });
  window.addEventListener("pointercancel", onPointerUp, { passive: true });
  document.documentElement.addEventListener("mouseleave", onPointerLeave);
  cleanups.push(() => {
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
    document.documentElement.removeEventListener("mouseleave", onPointerLeave);
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
