import "@fontsource/noto-serif-sc/chinese-simplified-400.css";
import "@fontsource/noto-serif-sc/chinese-simplified-700.css";
import "@fontsource/noto-sans-sc/chinese-simplified-400.css";
import "@fontsource/noto-sans-sc/chinese-simplified-500.css";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

if (!document.querySelector(".ink-scene")) {
  const scene = document.createElement("div");
  scene.className = "ink-scene";
  scene.setAttribute("aria-hidden", "true");
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

if (!reduce) {
  const lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

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
      delay: 0.5,
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
  });
}
