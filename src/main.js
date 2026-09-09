import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { createField } from "./gl.js";

gsap.registerPlugin(ScrollTrigger);

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = document.querySelector("#gl");
const stage = document.querySelector("#stage");
const ring = document.querySelector(".ring");
const core = document.querySelector(".core");
const blades = gsap.utils.toArray(".blades span");
const field = createField(canvas);

const xTo = gsap.quickTo(ring, "x", { duration: 0.7, ease: "power3" });
const yTo = gsap.quickTo(ring, "y", { duration: 0.7, ease: "power3" });
const cxTo = gsap.quickTo(core, "x", { duration: 0.45, ease: "power3" });
const cyTo = gsap.quickTo(core, "y", { duration: 0.45, ease: "power3" });

const onMove = (e) => {
  const nx = e.clientX / window.innerWidth;
  const ny = e.clientY / window.innerHeight;
  field.setMouse(nx, ny);
  const dx = (nx - 0.5) * 48;
  const dy = (ny - 0.5) * 48;
  xTo(dx);
  yTo(dy);
  cxTo(dx * 0.35);
  cyTo(dy * 0.35);
};

window.addEventListener("pointermove", onMove, { passive: true });

if (reduce) {
  gsap.set(ring, { scale: 1, rotate: -12 });
  gsap.set(core, { scale: 1 });
  field.setProgress(0.35);
} else {
  const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: stage,
      start: "top top",
      end: "+=280%",
      pin: true,
      scrub: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => field.setProgress(self.progress),
    },
  });

  gsap.set(ring, { scale: 0.18, rotate: 0 });
  gsap.set(core, { scale: 0 });
  gsap.set(blades, { xPercent: -110 });

  tl.to(ring, { scale: 1.08, rotate: 110, duration: 1.2 }, 0)
    .to(core, { scale: 1, duration: 0.4 }, 0.15)
    .to(
      blades,
      {
        xPercent: 0,
        duration: 0.55,
        stagger: { each: 0.08, from: "start" },
      },
      0.55,
    )
    .to(ring, { scale: 7.4, rotate: 210, duration: 0.9 }, 0.95)
    .to(core, { scale: 18, duration: 0.7 }, 1.05)
    .to(
      blades,
      {
        xPercent: 110,
        duration: 0.5,
        stagger: { each: 0.06, from: "end" },
      },
      1.35,
    )
    .to(ring, { scale: 1.2, rotate: 320, duration: 0.8 }, 1.7)
    .to(core, { scale: 1.15, duration: 0.5 }, 1.85);
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    field.destroy();
    ScrollTrigger.getAll().forEach((t) => t.kill());
    window.removeEventListener("pointermove", onMove);
  });
}
