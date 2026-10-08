import { ALGOS, ORDER, META } from "./algorithms.js";
import { LANGS } from "./code-samples.js";
import { GEN } from "./sorting.js";

(function () {
  "use strict";

  /* ============================================================
   State and UI bindings
   ============================================================ */
  const $ = (id) => document.getElementById(id);
  const cv = $("cv"),
    ctx = cv.getContext("2d");
  const stage = $("stage");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* roundRect arrived in Safari 16.4 / Firefox 112 — fall back to a plain rect there
   so older engines still paint bars instead of throwing on every frame */
  if (ctx && typeof ctx.roundRect !== "function") {
    ctx.roundRect = function (x, y, w, h) {
      this.rect(x, y, w, h);
      return this;
    };
  }

  const S = {
    algo: "bubble",
    n: 32,
    values: [],
    speed: 0.6,
    sound: false,
    ruler: true,
    barStyle: "round",
    frames: [],
    raf: 0,
    nframes: 0,
    acc: 0,
    delay: 0,
    playing: false,
    done: true,
    finAt: -1,
    hover: -1,
    distribution: "random",
    busy: false,
    maxValue: 32,
    size: 1200,
    dpr: 1,
  };
  const SORTED_ARR = () => new Set(S.values.map((_, i) => i));

  /* ============================================================
   4. Utils
   ============================================================ */
  function fmt(n) {
    return n.toLocaleString("en-US");
  }
  function hex2rgb(h) {
    const v = parseInt(h.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  function mix(c1, c2, t) {
    return [
      c1[0] + (c2[0] - c1[0]) * t,
      c1[1] + (c2[1] - c1[1]) * t,
      c1[2] + (c2[2] - c1[2]) * t,
    ];
  }
  function css(c, a) {
    return (
      "rgba(" +
      (c[0] | 0) +
      "," +
      (c[1] | 0) +
      "," +
      (c[2] | 0) +
      "," +
      (a === undefined ? 1 : a) +
      ")"
    );
  }
  function shade(c, t) {
    return c.map((v) => Math.max(0, Math.min(255, v * t)));
  }
  function timeStr(t) {
    return t.toFixed(2) + "s";
  }

  function genArray(n) {
    const a =
      S.distribution === "custom"
        ? S.values.slice()
        : Array.from({ length: n }, (_, i) => i + 1);
    if (S.distribution === "reverse") return a.reverse();
    if (S.distribution === "nearly") {
      for (let i = 0; i < Math.max(1, Math.round(n / 12)); i++) {
        const j = Math.floor(Math.random() * (n - 1));
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
      }
      return a;
    }
    if (S.distribution === "duplicates")
      return a.map(() => 1 + Math.floor(Math.random() * Math.min(5, n)));
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  /* ============================================================
   5. Audio — pentatonic sonification
   ============================================================ */
  const MAJ_PENT = [0, 2, 4, 7, 9];
  let AC = null,
    master = null,
    voices = 0;
  function audioOn() {
    return S.sound && AC && AC.state === "running";
  }
  function ensureAudio() {
    if (AC) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    AC = new Ctx();
    master = AC.createGain();
    master.gain.value = 0.16;
    master.connect(AC.destination);
  }
  function tone(midi, gain, dur) {
    if (!audioOn() || voices > 12) return;
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const o = AC.createOscillator(),
      g = AC.createGain();
    o.type = "triangle";
    o.frequency.value = f;
    const t = AC.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(master);
    voices++;
    o.onended = () => {
      voices--;
    };
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  function midiFor(v) {
    const steps = 25;
    const idx = Math.min(
      MAJ_PENT.length - 1,
      Math.floor(((v - 1) / steps) * MAJ_PENT.length),
    );
    const oct = Math.min(1, Math.floor((v - 1) / steps));
    return 58 + MAJ_PENT[Math.max(0, idx)] + oct * 12;
  }

  /* ============================================================
   6. Frame generation
   ============================================================ */
  /* one generator frame -> the compact render frame used everywhere below */
  function convertFrame(f, fallback) {
    return {
      a: f.a || fallback,
      i: f.i === undefined ? -1 : f.i,
      j: f.j === undefined ? -1 : f.j,
      k: f.k === undefined ? -1 : f.k,
      dig: f.dig === undefined ? -1 : f.dig,
      cmp: f.cmp | 0,
      swp: f.swp | 0,
      wrt: f.wrt | 0,
      s: f.sorted || null,
      hint: f.hint || "",
      aux: f.aux || null,
      auxLabel: f.auxLabel || null,
      buckets: f.buckets || null,
      swap: !!f.swap,
      step: f.step || null,
      fin: !!f.fin,
    };
  }
  /* trim the leading "nothing sorted yet" prefix and subsample runaway runs */
  function finishFrames(all, values) {
    const initial = convertFrame(
      {
        a: values.slice(),
        sorted: new Set(),
        step: null,
        hint: "初始数组。点击播放，或用方向键开始逐步探索。",
      },
      values,
    );
    const frames = [initial, ...all];
    if (frames.length > 240000) {
      const step = Math.ceil(frames.length / 240000);
      const slim = [];
      for (let i = 0; i < frames.length; i += step) slim.push(frames[i]);
      if (slim[slim.length - 1] !== frames[frames.length - 1])
        slim.push(frames[frames.length - 1]);
      return slim;
    }
    return frames;
  }
  /* build the whole timeline in slices, yielding to the browser between them so the
   "计算中…" state actually paints instead of the page freezing on ~25k frames */
  let buildToken = 0;
  function buildFramesChunked(done, fail, token) {
    const out = [];
    const fallback = S.values;
    const it = GEN[S.algo](fallback);
    const CHUNK = 2500;
    function step() {
      if (token !== buildToken) return; // superseded by a newer run
      try {
        for (let i = 0; i < CHUNK; i++) {
          const r = it.next();
          if (r.done) {
            done(finishFrames(out, fallback));
            return;
          }
          out.push(convertFrame(r.value, fallback));
        }
        setTimeout(step, 0);
      } catch (err) {
        fail(err);
      }
    }
    step();
  }

  /* synchronous helper (used by tests) — same compact frame shape as the chunked builder */
  function buildFrames() {
    const out = [];
    const it = GEN[S.algo](S.values);
    let r = it.next();
    while (!r.done) {
      out.push(convertFrame(r.value, S.values));
      r = it.next();
    }
    return finishFrames(out, S.values);
  }

  /* ============================================================
   7. Playback
   ============================================================ */
  function resetAnim() {
    S.acc = 0;
    S.delay = 0.7;
    S.done = S.frames.length === 0;
    S.finAt = -1;
  }
  function restart(paused) {
    S.raf = 0;
    S.acc = 0;
    S.delay = 0;
    S.done = false;
    S.finAt = -1;
    S.playing = !paused;
    if (S.playing) {
      S.delay = 0.75;
      if (audioOn() && AC.state === "suspended") AC.resume();
    }
    setPlayIcon();
    if (codeState) {
      resetCodeCounts();
      codeState.step = undefined;
    }
    const f = S.frames[0];
    setText("cfProg", "0%");
    setText("cfNote", f ? f.hint : "");
    updateChips(0, 0);
  }
  function advance(dt) {
    if (S.playing && S.delay > 0) {
      S.delay -= dt;
      if (S.delay < 0) S.delay = 0;
      return;
    }
    if (!S.playing || S.done) return;
    const fps = 2 * Math.pow(120, S.speed);
    const steps = dt * fps;
    if (steps <= 0) return;
    S.acc += steps;
    const inc = Math.floor(S.acc);
    if (inc > 0) {
      S.acc -= inc;
      S.raf = Math.min(S.nframes - 1, S.raf + inc);
      if (S.raf >= S.nframes - 1) {
        S.done = true;
        S.playing = false;
        setPlayIcon();
        finishChime();
      }
    }
  }
  function finishChime() {
    S.finAt = performance.now();
    if (!audioOn()) return;
    let i = 0;
    const iv = setInterval(() => {
      if (!audioOn() || i > 23) {
        clearInterval(iv);
        return;
      }
      tone(62 + Math.round((i * 9) / 23) + (i % 2 ? 4 : 0), 0.07, 0.5);
      i++;
    }, 42);
  }

  /* ============================================================
   8. Canvas
   ============================================================ */
  /* re-measure the code panel (cheap, only on resize) */
  function remeasureCode() {
    if (!codeState) return;
    const main = $("codeMain"),
      wrap = $("codeWrap");
    if (main) codeState.viewH = Math.max(40, main.clientHeight || codeState.h);
    if (wrap) codeState.wrapW = wrap.clientWidth;
  }
  function resize() {
    const r = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    S.size = Math.max(200, r.width);
    S.dpr = dpr;
    cv.width = Math.round(r.width * dpr);
    cv.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* Work out how the bars travelled between two frames, so the animation can slide them
   from their old slot to their new one instead of growing and shrinking in place.
   Handles a single element shifting (insertion/shell/radix), a two-element swap
   (bubble/selection/heap/quick/cocktail) and — when the move is unambiguous — a whole
   block being rewritten (merge). Returns [{from,to}] on the 0..1 index scale. */
  function detectMoves(from, to) {
    if (!from || !to || from.length !== to.length) return null;
    const n = from.length;
    const byValue = new Map();
    // Match equal values in order and keep unchanged slots in place.
    // Temporary insertion/merge snapshots can have different multisets:
    // fall back to height interpolation instead of inventing a movement.
    for (let i = 0; i < n; i++) {
      if (from[i] === to[i]) continue;
      if (!byValue.has(from[i])) byValue.set(from[i], []);
      byValue.get(from[i]).push(i);
    }
    const moves = [];
    for (let i = 0; i < n; i++) {
      if (from[i] === to[i]) continue;
      const positions = byValue.get(to[i]);
      if (!positions || !positions.length) return null;
      const src = positions.shift();
      moves.push({ from: src, to: i });
      if (moves.length > n) return null;
    }
    return moves.length ? moves : null;
  }

  /* apply the detected moves to a copy of the source snapshot (used to verify detection) */
  function applyMoves(from, moves) {
    const out = from.slice();
    const src = from.slice();
    for (let k = 0; k < moves.length; k++)
      out[moves[k].to] = src[moves[k].from];
    return out;
  }

  /* rebuilt if exactly two positions exchanged values between two frames */
  function findSwapPair(from, to) {
    if (!from || !to || from.length !== to.length) return null;
    let i = -1,
      j = -1,
      diff = 0;
    for (let p = 0; p < from.length; p++) {
      if (from[p] !== to[p]) {
        diff++;
        if (diff > 2) return null;
        if (i < 0) i = p;
        else j = p;
      }
    }
    if (diff !== 2) return null;
    return from[i] === to[j] && from[j] === to[i] ? [i, j] : null;
  }

  let moveCache = { idx: -1, moves: null };
  function cachedMoves(idx, from, to) {
    if (moveCache.idx !== idx) {
      moveCache.idx = idx;
      moveCache.moves = detectMoves(from, to);
    }
    return moveCache.moves;
  }

  function draw() {
    const W = S.size,
      H = stage.getBoundingClientRect().height;
    ctx.clearRect(0, 0, W, H);

    const n = S.n;
    const nf = S.frames.length;
    const idx = Math.min(nf - 1, S.raf);
    const cur = nf ? S.frames[idx] : null;
    const nxt = nf && idx < nf - 1 && !S.done ? S.frames[idx + 1] : null;
    const t = S.done ? 1 : reducedMotion.matches ? 0 : Math.min(1, S.acc);
    const A = cur ? cur.a : S.values;

    const ac = ALGOS[S.algo].ac,
      ac2 = ALGOS[S.algo].ac2;
    const AC1 = hex2rgb(ac),
      AC2 = hex2rgb(ac2);
    const SORTED_COLOR = [136, 186, 240];
    const MUT = [55, 73, 94],
      MUT_HI = [86, 115, 149];
    const sortedSet = S.done || !cur ? SORTED_ARR() : cur.s;

    const bucketRow = !!(cur && cur.buckets);
    const auxBar = !!(cur && cur.aux);
    const bandH = bucketRow ? 58 : auxBar ? 34 : 0;
    const rulerH = 0;
    const padL = 20,
      padR = 20,
      padT = 48;
    const padB = 16 + bandH + rulerH;
    const x0 = padL,
      x1 = W - padR;
    const y0 = padT,
      y1 = H - padB;
    const bw = Math.max(1.15, (x1 - x0) / n);

    /* vertical frame lines */
    if (S.ruler) {
      ctx.strokeStyle = "rgba(255,255,255,.030)";
      ctx.lineWidth = 1;
      for (let g = 0; g <= 4; g++) {
        const gx = Math.round(x0 + ((x1 - x0) * g) / 4) + 0.5;
        ctx.beginPath();
        ctx.moveTo(gx, y0 - 14);
        ctx.lineTo(gx, y1 + 6);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(180,203,235,.42)";
      ctx.font = '9px "SF Mono",ui-monospace,Menlo,monospace';
      ctx.textAlign = "center";
      for (let g = 0; g <= 4; g++) {
        ctx.fillText(
          g === 0
            ? "a[0]"
            : g === 4
              ? "a[" + (n - 1) + "]"
              : String(Math.round(((n - 1) * g) / 4)),
          x0 + ((x1 - x0) * g) / 4,
          y0 - 20,
        );
      }
    }

    /* bars */
    const range = S.maxValue;
    const hover = S.hover;
    const w = Math.max(1, bw - (bw > 7 ? 1.6 : bw > 3 ? 0.9 : 0.45));

    function barColor(p, v, extraLight) {
      if (sortedSet && sortedSet.has(p)) return SORTED_COLOR;
      return mix(MUT, MUT_HI, v / range);
    }

    /* paint one bar of height h with its top at topY; x is the left edge */
    function paintBar(x, topY, h, c, opts) {
      const o = opts || {};
      const g = ctx.createLinearGradient(0, topY, 0, topY + h);
      g.addColorStop(0, css(shade(c, 1.04), 0.97));
      g.addColorStop(1, css(shade(c, 0.72), 0.85));
      ctx.fillStyle = g;
      if (o.overlap) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(Math.round(x) - 2.5, topY - 6, Math.round(w) + 5, h + 8);
        ctx.clip();
        if (S.barStyle === "round") {
          ctx.beginPath();
          ctx.roundRect(Math.round(x), topY, w, h, Math.min(w / 2, 3.5));
          ctx.fill();
        } else if (S.barStyle === "thin") {
          ctx.fillRect(
            Math.round(x) + (bw - w) / 2,
            topY,
            Math.max(1, w * 0.5),
            h,
          );
        } else {
          ctx.fillRect(Math.round(x), topY, w, h);
        }
        ctx.restore();
        ctx.strokeStyle = css(shade(c, 1.5), 0.85);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(
          Math.round(x) - 1,
          topY - 1,
          w + 2,
          h + 1,
          Math.min(w / 2, 3.5),
        );
        ctx.stroke();
      } else {
        if (S.barStyle === "round") {
          ctx.beginPath();
          ctx.roundRect(x, topY, w, h, Math.min(w / 2, 3.5));
          ctx.fill();
        } else if (S.barStyle === "thin") {
          ctx.fillRect(x + (bw - w) / 2, topY, Math.max(1, w * 0.5), h);
        } else {
          ctx.fillRect(x, topY, w, h);
        }
      }
      if (o.cap) {
        ctx.fillStyle = css(c, o.capAlpha === undefined ? 0.55 : o.capAlpha);
        ctx.fillRect(Math.round(x) - 1, topY - 4, w + 2, 2);
      }
    }

    /* Bars that moved between the two frames travel sideways into their new slot —
     a swap crosses over, a shift slides one place, a block rewrite glides together.
     No vertical arc: a straight horizontal translation. */
    const moves = nxt && t < 1 ? cachedMoves(idx, A, nxt.a) : null;
    const eased = t * t * (3 - 2 * t);
    const moved = moves && moves.length && moves.length <= 64 ? moves : null;

    const movingFrom = {};
    if (moved)
      for (let k = 0; k < moved.length; k++) movingFrom[moved[k].from] = 1;

    for (let p = 0; p < n; p++) {
      if (movingFrom[p]) continue; // drawn as a travelling bar below
      const vA = A[p],
        vB = nxt ? nxt.a[p] : vA;
      const v = vA + (vB - vA) * t;
      const h = Math.max(1.2, (v / range) * (y1 - y0));
      const bx = x0 + p * bw;
      let c;
      if (cur && (p === cur.i || p === cur.j || p === cur.k)) c = AC2;
      else c = barColor(p, v);
      if (p === hover) c = mix(c, [255, 255, 255], 0.35);

      paintBar(bx, y1 - h, h, c, {
        overlap: false,
        cap: !!(cur && (p === cur.i || p === cur.j) && !S.done),
      });
    }

    if (moved) {
      for (let k = 0; k < moved.length; k++) {
        const src = moved[k].from,
          dst = moved[k].to;
        const v = A[src];
        const h = Math.max(1.2, (v / range) * (y1 - y0));
        const shift = (dst - src) * bw * eased;
        /* the bar keeps its own height while it travels, and takes the colour of the
         slot it is heading for so overlapping travellers stay distinguishable */
        const c = mix(barColor(dst, v), AC2, 0.22);
        paintBar(x0 + src * bw + shift, y1 - h, h, c, {
          overlap: true,
          cap: true,
          capAlpha: 0.9,
        });
      }
    }

    /* baseline */
    ctx.strokeStyle = "rgba(255,255,255,.16)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0 - 4, y1 + 0.5);
    ctx.lineTo(x1 + 4, y1 + 0.5);
    ctx.stroke();

    /* merge buffer strip */
    if (auxBar) {
      const ay = y1 + 17,
        ah = 12;
      ctx.fillStyle = "rgba(255,255,255,.045)";
      ctx.fillRect(x0, ay, x1 - x0, ah);
      const m = cur.aux.length;
      if (m) {
        const w2 = (x1 - x0) / m;
        for (let q = 0; q < m; q++) {
          const v = cur.aux[q];
          const hh = Math.max(1.5, (v / range) * ah);
          ctx.fillStyle = css(AC1, 0.85);
          ctx.fillRect(x0 + q * w2, ay + ah - hh, Math.max(1, w2 - 1), hh);
        }
      }
      ctx.fillStyle = "rgba(255,255,255,.42)";
      ctx.font = '9.5px "SF Mono",ui-monospace,Menlo,monospace';
      ctx.textAlign = "right";
      ctx.fillText(cur.auxLabel || "work buffer", x1, ay - 5);
    }

    /* radix buckets */
    if (bucketRow) {
      const by = y1 + 15,
        bh = 34;
      const total = x1 - x0;
      const cw = total / 10;
      for (let b = 0; b < 10; b++) {
        const bx = x0 + b * cw;
        const items = cur.buckets[b] || [];
        const active = items.length > 0;
        const isCur = cur.dig === b;
        ctx.fillStyle = active
          ? isCur
            ? css(AC1, 0.17)
            : "rgba(255,255,255,.07)"
          : "rgba(255,255,255,.022)";
        ctx.beginPath();
        ctx.roundRect(bx + 1.5, by, cw - 3, bh, 4);
        ctx.fill();
        if (isCur) {
          ctx.strokeStyle = css(AC1, 0.75);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.roundRect(bx + 1.5, by, cw - 3, bh, 4);
          ctx.stroke();
        }
        if (active) {
          const w2 = (cw - 6) / items.length;
          for (let q = 0; q < items.length; q++) {
            const hh = Math.max(1.5, (items[q] / range) * (bh - 4));
            ctx.fillStyle = css(
              mix(AC1, [255, 255, 255], q / Math.max(1, items.length)),
              0.9,
            );
            ctx.fillRect(
              bx + 3 + q * w2,
              by + bh - 2 - hh,
              Math.max(1, w2 - 0.7),
              hh,
            );
          }
        }
        ctx.fillStyle = active ? css(AC2, 0.9) : "rgba(255,255,255,.22)";
        ctx.font = '9.5px "SF Mono",ui-monospace,Menlo,monospace';
        ctx.textAlign = "center";
        ctx.fillText(String(b), bx + cw / 2, by + bh + 11);
      }
    }

    /* hover tooltip */
    if (hover >= 0 && hover < n) {
      const v = A[hover];
      const h = Math.max(1.2, (v / range) * (y1 - y0));
      const bx = x0 + hover * bw + bw / 2;
      const label = "a[" + hover + "] = " + Math.round(v);
      ctx.font = '10px "SF Mono",ui-monospace,Menlo,monospace';
      const tw = ctx.measureText(label).width + 14;
      let tx = bx - tw / 2;
      tx = Math.max(4, Math.min(W - tw - 4, tx));
      const ty = Math.max(4, y1 - h - 30);
      ctx.fillStyle = "rgba(12,14,19,.92)";
      ctx.strokeStyle = "rgba(255,255,255,.16)";
      ctx.beginPath();
      ctx.roundRect(tx, ty, tw, 20, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#e9eff7";
      ctx.textAlign = "left";
      ctx.fillText(label, tx + 7, ty + 14);
      ctx.strokeStyle = css(AC1, 0.5);
      ctx.beginPath();
      ctx.moveTo(bx, ty + 20);
      ctx.lineTo(bx, y1 - h);
      ctx.stroke();
    }

    /* finish sweep */
    if (S.finAt > 0 && !reducedMotion.matches) {
      const age = (performance.now() - S.finAt) / 1000;
      if (age > 1.35) S.finAt = -1;
      else {
        const prog = age / 1.35;
        const head = prog * (x1 - x0);
        const grad = ctx.createLinearGradient(x0 + head - 190, 0, x0 + head, 0);
        grad.addColorStop(0, "rgba(198,225,255,0)");
        grad.addColorStop(1, "rgba(198,225,255,.38)");
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, y0 - 26, head, y1 - y0 + 30);
        ctx.clip();
        ctx.fillStyle = grad;
        ctx.fillRect(x0 + head - 190, y0 - 26, 190, y1 - y0 + 30);
        ctx.restore();
        const pulse = Math.sin(prog * Math.PI);
        ctx.strokeStyle = css(SORTED_COLOR, 0.85 * (1 - prog));
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x0 + head, y0 - 22 + pulse * 6);
        ctx.lineTo(x0 + head, y1 + 6 - pulse * 6);
        ctx.stroke();
      }
    }

    /* hint + frame readout */
    if (cur) {
      ctx.font = '11px "SF Mono",ui-monospace,Menlo,monospace';
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255,255,255,.44)";
      // The readable explanation lives below the chart, not on top of the bars.
    }
    $("tick").textContent =
      "frame " +
      String(idx).padStart(4, "0") +
      " / " +
      String(Math.max(0, nf - 1)).padStart(4, "0");
  }

  /* ============================================================
   9. UI sync
   ============================================================ */
  function setPlayIcon() {
    $("playIcon").innerHTML = S.playing
      ? '<path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" fill="currentColor" stroke="none"/>'
      : '<path d="M7 4l12 8-12 8z" fill="currentColor" stroke="none"/>';
    $("stateText").textContent = S.playing
      ? "运行中"
      : S.done
        ? "已完成"
        : "已暂停";
    $("playLabel").textContent = S.playing
      ? "暂停播放"
      : S.done
        ? "再看一次"
        : "开始播放";
    $("play").setAttribute(
      "aria-label",
      S.playing ? "暂停播放" : S.done ? "重新播放" : "开始播放",
    );
    $("statusBadge").dataset.state = S.playing
      ? "playing"
      : S.done
        ? "done"
        : "paused";
    if (codeState) {
      codeState.step = undefined;
      if (S.playing) codeState.manual = false;
    }
  }
  function paintStats(cmp, swp, wrt, time, prog, hint) {
    setText("cfProg", Math.round(prog * 100) + "%");
    setText("cfNote", hint || "");
  }
  /* Statistics always describe the current frame, including during seeking. */
  function updateCards() {
    const nf = S.frames.length;
    const idx = Math.min(nf - 1, S.raf);
    const cur = nf ? S.frames[idx] : null;
    const prog = nf - 1 > 0 ? idx / (nf - 1) : 1;
    setText("cfProg", Math.round(prog * 100) + "%");
    setText("metricComparisons", fmt(cur ? cur.cmp : 0));
    setText("metricSwaps", fmt(cur ? cur.swp : 0));
    setText("metricWrites", fmt(cur ? cur.wrt : 0));
    setText(
      "metricFrame",
      Math.max(0, idx) + " / " + Math.max(0, nf - 1) + " 帧",
    );
    setText(
      "currentHint",
      cur && cur.hint ? cur.hint : "准备好了。点击播放，或用方向键逐步探索。",
    );
    const progress = Math.round(prog * 100);
    if ($("metricProgress").dataset.value !== String(progress)) {
      $("metricProgress").dataset.value = progress;
      $("metricProgress").innerHTML = progress + "<em>%</em>";
    }
    const timeline = $("timeline");
    timeline.max = Math.max(0, nf - 1);
    timeline.value = Math.max(0, idx);
    timeline.setAttribute(
      "aria-valuetext",
      progress + "%，第 " + Math.max(0, idx) + " 帧",
    );
    syncSlider(timeline);
    $("prevFrame").disabled = S.busy || idx <= 0;
    $("nextFrame").disabled = S.busy || idx >= nf - 1;
    /* cfNote follows the throttled highlight (see updateCode) so it cannot churn */
  }

  /* ============================================================
   10. Loop
   ============================================================ */
  let last = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    if (!last) last = ts;
    let dt = (ts - last) / 1000;
    last = ts;
    if (dt > 0.08) dt = 0.08;
    if (!document.hidden) advance(dt);
    draw();
    updateCards();
    const fi = Math.min(S.nframes - 1, S.raf);
    const fr = S.frames.length ? S.frames[fi] : null;
    countStepHits(Math.max(0, fi));
    updateCode(fr);
  }
  requestAnimationFrame(frame);

  /* ============================================================
   11. Actions
   ============================================================ */
  /* Keep the learning material in sync with the selected algorithm. */
  function updateChips(cmp) {
    const A = ALGOS[S.algo];
    setText("chipAlgo", "n = " + S.n);
    $("heroName").innerHTML =
      A.name + '<span class="algo-english">' + A.en + "</span>";
    setText(
      "algoIndex",
      "/ " + String(ORDER.indexOf(S.algo) + 1).padStart(2, "0"),
    );
    setText("learningTitle", META[S.algo].title);
    setText("algorithmAbout", A.about);
    setText("timeComplexity", "平均时间 " + META[S.algo].time);
    setText("spaceComplexity", "额外空间 " + META[S.algo].space);
    setText("stability", META[S.algo].stable ? "稳定排序" : "不稳定排序");
    $("badge").textContent = A.en.toUpperCase() + " — " + A.cmpHint;
  }
  function computeStats() {
    const F = S.frames;
    if (!F.length) return;
    const lastF = F[F.length - 1];
    updateChips(lastF.cmp);
  }

  function regenerate(autoplay = false, values = null) {
    S.playing = false;
    S.values = values ? values.slice() : genArray(S.n);
    S.n = S.values.length;
    S.maxValue = Math.max(1, ...S.values);
    $("size").value = S.n;
    $("sizeOut").textContent = S.n;
    syncSlider($("size"));
    moveCache = { idx: -1, moves: null };
    S.hover = -1;
    setBusy(true);
    const token = ++buildToken;
    buildFramesChunked(
      function (frames) {
        if (token !== buildToken) return;
        S.frames = frames;
        S.nframes = S.frames.length;
        resetAnim();
        restart(!autoplay);
        computeStats();
        resetCodeCounts();
        markHotLines();
        setBusy(false);
        updateCards();
        updateCode(S.frames[0]);
      },
      function (err) {
        if (token !== buildToken) return;
        S.frames = [];
        S.nframes = 0;
        S.done = true;
        S.playing = false;
        setBusy(false);
        setPlayIcon();
        $("stateText").textContent = "生成失败";
        setText("cfNote", String(err && err.message ? err.message : err));
      },
      token,
    );
  }
  function setBusy(b) {
    S.busy = b;
    $("canvasLoading").hidden = !b;
    ["play", "timeline", "restart"].forEach((id) => ($(id).disabled = b));
    $("stateText").textContent = b
      ? "计算中…"
      : S.playing
        ? "运行中"
        : S.done
          ? "已完成"
          : "已暂停";
    cv.style.opacity = b ? "0.45" : "1";
  }
  function selectAlgo(key) {
    if (!ALGOS[key] || key === S.algo) return;
    S.algo = key;
    document.body.style.setProperty("--accent", ALGOS[key].ac);
    document.body.style.setProperty("--accent2", ALGOS[key].ac2);
    [...$("algos").children].forEach((b) => {
      b.setAttribute("aria-selected", String(b.dataset.key === key));
      b.tabIndex = b.dataset.key === key ? 0 : -1;
    });
    updateChips(0);
    buildCodePanel();
    regenerate(false, S.values);
  }
  function buildLangTabs() {
    const bar = $("langbar");
    bar.innerHTML = "";
    CODE_LANGS.forEach(function (L) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "lang";
      b.role = "tab";
      b.dataset.lang = L.id;
      b.setAttribute("aria-selected", String(L.id === codeLang));
      b.tabIndex = L.id === codeLang ? 0 : -1;
      b.innerHTML = L.label + "<em>" + L.short + "</em>";
      b.addEventListener("click", function () {
        showLang(L.id);
      });
      bar.appendChild(b);
    });
  }
  function buildAlgoTabs() {
    const nav = $("algos");
    nav.innerHTML = "";
    ORDER.forEach((k) => {
      const A = ALGOS[k];
      const b = document.createElement("button");
      b.className = "algo";
      b.type = "button";
      b.role = "tab";
      b.dataset.key = k;
      b.style.setProperty("--ac", A.ac);
      b.setAttribute("aria-selected", String(k === S.algo));
      b.tabIndex = k === S.algo ? 0 : -1;
      b.innerHTML =
        '<span class="algo-index">' +
        String(ORDER.indexOf(k) + 1).padStart(2, "0") +
        '</span><span class="algo-label">' +
        A.name +
        '<span class="cn">' +
        A.en +
        '</span></span><span class="algo-arrow" aria-hidden="true">↗</span>';
      b.addEventListener("click", () => selectAlgo(k));
      nav.appendChild(b);
    });
    document.body.style.setProperty("--accent", ALGOS[S.algo].ac);
    document.body.style.setProperty("--accent2", ALGOS[S.algo].ac2);
  }

  /* sliders */
  function syncSlider(el) {
    const min = +el.min,
      max = +el.max,
      v = +el.value;
    el.style.setProperty(
      "--p",
      (((v - min) / (max - min)) * 100).toFixed(2) + "%",
    );
  }
  function speedLabel() {
    const fps = 2 * Math.pow(120, S.speed);
    $("speedOut").textContent =
      (fps < 10 ? fps.toFixed(1) : Math.round(fps)) + " 步/秒";
  }

  /* pointer */
  function hitTest(clientX) {
    const r = cv.getBoundingClientRect();
    const n = S.n,
      padL = 20,
      padR = 20;
    const x0 = padL,
      x1 = r.width - padR;
    const bw = (x1 - x0) / n;
    const p = Math.floor((clientX - r.left - x0) / bw);
    return p >= 0 && p < n ? p : -1;
  }
  cv.addEventListener("mousemove", (e) => {
    S.hover = hitTest(e.clientX);
  });
  cv.addEventListener("mouseleave", () => {
    S.hover = -1;
  });
  cv.addEventListener("pointerdown", (e) => {
    S.hover = hitTest(e.clientX);
  });
  /* touch and pen never fire mouseleave, so clear the highlight on release too */
  ["pointerup", "pointercancel", "pointerleave"].forEach((ev) =>
    cv.addEventListener(ev, () => {
      S.hover = -1;
    }),
  );

  /* ============================================================
   12. Live code panel — multi-language
   ============================================================ */
  const CODE_LANGS = [
    { id: "js", label: "JavaScript", short: "JS" },
    { id: "py", label: "Python", short: "PY" },
    { id: "c", label: "C", short: "C" },
    { id: "java", label: "Java", short: "JAVA" },
  ];
  const KW_BY_LANG = {
    js: [
      "for",
      "while",
      "if",
      "else",
      "const",
      "let",
      "var",
      "function",
      "return",
      "break",
      "continue",
      "yield",
      "new",
      "of",
      "in",
      "true",
      "false",
      "null",
    ],
    py: [
      "for",
      "while",
      "if",
      "elif",
      "else",
      "def",
      "return",
      "break",
      "continue",
      "in",
      "not",
      "and",
      "or",
      "True",
      "False",
      "None",
      "range",
      "len",
      "max",
      "set",
    ],
    c: [
      "for",
      "while",
      "if",
      "else",
      "int",
      "void",
      "static",
      "return",
      "break",
      "continue",
      "const",
      "printf",
      "sizeof",
    ],
    java: [
      "for",
      "while",
      "if",
      "else",
      "int",
      "void",
      "static",
      "return",
      "break",
      "continue",
      "boolean",
      "public",
      "class",
      "new",
      "true",
      "false",
      "null",
      "System",
    ],
  };
  function kwRegex(lang) {
    return new RegExp(
      "(^|[^\\w$])(" + KW_BY_LANG[lang].join("|") + ")(?![\\w$])",
      "g",
    );
  }
  /* split a source line into code and its comment, so phones can drop the comment
   column (which is what makes the long lines long) and show it in the footer */
  function splitComment(line, lang) {
    if (lang === "c") {
      const m = line.match(/^(.*?)(\s*\/\*.*\*\/)\s*$/);
      if (m) return [m[1], m[2].trim()];
    }
    const i = line.indexOf(lang === "py" ? "#" : "//");
    if (i < 0) return [line, ""];
    return [line.slice(0, i), line.slice(i)];
  }

  function escHtml(t) {
    return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  /* Colour comments, keywords, calls and numbers.
   Tokens are parked as \x00N\x00 placeholders first so a later pass can never match
   inside the HTML a previous pass inserted. */
  function highlight(line, lang) {
    const ci = line.indexOf("//");
    const hash = line.indexOf("#");
    const cut = ci < 0 ? hash : hash < 0 ? ci : Math.min(ci, hash);
    const codeText = cut >= 0 ? line.slice(0, cut) : line;
    const comment = cut >= 0 ? line.slice(cut) : "";
    let t = escHtml(codeText);
    const spans = [];
    const park = function (html) {
      spans.push(html);
      return "\u0000" + (spans.length - 1) + "\u0000";
    };
    t = t.replace(/\b(\d+)\b/g, function (m) {
      return park('<span class="tk-n">' + m + "</span>");
    });
    t = t.replace(/([A-Za-z_$][\w$]*)(\s*\()/g, function (_, fn, br) {
      return park('<span class="tk-f">' + fn + "</span>") + br;
    });
    t = t.replace(kwRegex(lang), function (_, pre, kw) {
      return pre + park('<span class="tk-k">' + kw + "</span>");
    });
    t = t.replace(/\u0000(\d+)\u0000/g, function (_, i) {
      return spans[+i];
    });
    return (
      t + (comment ? '<span class="tk-c">' + escHtml(comment) + "</span>" : "")
    );
  }

  const codeEls = {};
  let codeState = null;
  let gutterTimer = 0;
  let codeLang = "js";

  function syncCompact() {
    if (!codeEls.pane) return;
    const narrow = window.innerWidth <= 620;
    if (codeEls.pane.classList.contains("compact") !== narrow) {
      codeEls.pane.classList.toggle("compact", narrow);
      buildCodePanel();
    }
  }
  /* full-screen code reading (especially useful on a phone) */
  function toggleCodeFull() {
    const pane = $("codepane");
    const on = !pane.classList.contains("expanded");
    pane.classList.toggle("expanded", on);
    document.body.classList.toggle("codefull", on);
    $("expandCode").setAttribute("aria-pressed", String(on));
    /* the panel just changed size: re-measure and re-place the highlight */
    remeasureCode();
    const fi = Math.min(S.nframes - 1, S.raf);
    if (S.frames.length) {
      codeState.step = undefined;
      updateCode(S.frames[fi]);
    }
  }
  function showLang(lang) {
    codeLang = lang;
    [...$("langbar").children].forEach(function (b) {
      b.setAttribute("aria-selected", String(b.dataset.lang === lang));
      b.tabIndex = b.dataset.lang === lang ? 0 : -1;
    });
    buildCodePanel();
    // keep the current frame highlighted in the newly rendered language
    const fi = Math.min(S.nframes - 1, S.raf);
    if (S.frames.length) updateCode(S.frames[fi]);
  }

  function buildCodePanel() {
    if (gutterTimer) {
      clearInterval(gutterTimer);
      gutterTimer = 0;
    }
    codeEls.pane = $("codepane");
    codeEls.wrap = $("codeWrap");
    codeEls.lines = $("codeLines");
    codeEls.pre = $("codePre");
    codeEls.hl = $("lnHl");
    codeEls.main = $("codeMain");
    const def = ALGOS[S.algo];
    const pack = LANGS[S.algo][codeLang];
    const src = pack.code;
    codeEls.lines.innerHTML = src
      .map(function (_, i) {
        return '<span id="gut' + (i + 1) + '">' + (i + 1) + "</span>";
      })
      .join("");
    const compact = codeEls.pane.classList.contains("compact");
    codeEls.pre.innerHTML = src
      .map(function (l, i) {
        const shown = splitComment(l, codeLang)[0].replace(/\s+$/, "");
        return (
          '<span class="cl" id="cl' +
          (i + 1) +
          '">' +
          (highlight(shown, codeLang) || "&nbsp;") +
          "</span>"
        );
      })
      .join("");
    $("codeName").textContent = def.en;
    $("codeMeta").textContent =
      def.note +
      " · " +
      CODE_LANGS.filter(function (l) {
        return l.id === codeLang;
      })[0].label;
    const lh0 = parseFloat(getComputedStyle(codeEls.pre).lineHeight) || 19;
    codeEls.wrap.style.setProperty("--lh", lh0 + "px");
    const r = codeEls.main.getBoundingClientRect();
    const h = r.height || codeEls.wrap.getBoundingClientRect().height || 300;
    /* width of one monospace character, used to keep the active part of a long
     line inside the viewport when the panel is narrower than the code */
    let charW = 0;
    try {
      const probe = document.createElement("span");
      probe.style.cssText =
        "position:absolute;visibility:hidden;white-space:pre";
      probe.textContent = "x".repeat(40);
      codeEls.pre.appendChild(probe);
      charW = probe.getBoundingClientRect().width / 40;
      codeEls.pre.removeChild(probe);
    } catch (e) {
      charW = 0;
    }
    codeState = {
      lh: lh0,
      h: h,
      viewH: Math.max(40, h),
      wrapW: codeEls.wrap.clientWidth || 0,
      /* -1 forces the first frame after a rebuild to set both transforms */
      appliedScroll: -1,
      appliedLine: -1,
      hlOn: false,
      smooth: false,
      step: undefined,
      line: -1,
      scroll: 0,
      max: src.length,
      charW: charW,
      hits: new Array(src.length + 1).fill(0),
      hitsAt: 0,
      paintedAt: -1,
      lines: {},
    };
    markHotLines();
    setText("lineChip", "行 —");
    setText("cfLine", "—");
    setText("cfHits", "0");
    setText("cfNote", "点击播放，跟随算法执行。");
  }

  /* resolve the frame's semantic step to a line in the active language */
  function updateCode(frame) {
    if (!codeState || !frame) return;
    const pack = LANGS[S.algo][codeLang];
    const step = frame.step;
    if (step === codeState.step) {
      if (codeState.line > 0)
        setText("cfHits", fmt(codeState.hits[codeState.line] || 0));
      return;
    }
    /* The highlight follows the running line immediately — the writes below only happen
     when the line actually changes, so this costs nothing when the step repeats. */
    const now =
      typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now();
    codeState.step = step;
    if (step === null) {
      if (codeState.line > 0 || codeState.hlOn) {
        if (codeState.hlOn) {
          codeEls.hl.classList.remove("on");
          codeState.hlOn = false;
        }
        if (codeState.line > 0 && codeState.lines[codeState.line])
          codeState.lines[codeState.line].classList.remove("on");
        codeState.lines = {};
        codeState.line = -1;
        setText("lineChip", "行 —");
        setText("cfLine", "—");
      }
      setText("cfHits", "0");
      setText("cfNote", frame.hint || "排序完成。");
      return;
    }
    codeState.paintedAt = now;
    const ln = (step && pack.steps[step]) || -1;
    /* the guard above already ensures the highlighted line really changed */
    if (
      codeState.line > 0 &&
      codeState.line !== ln &&
      codeState.lines[codeState.line]
    ) {
      codeState.lines[codeState.line].classList.remove("on");
    }
    codeState.lines = {};
    if (ln > 0 && ln <= codeState.max) {
      const el = $("cl" + ln);
      if (el) {
        el.classList.add("on");
        codeState.lines[ln] = el;
      }
      const y = (ln - 1) * codeState.lh;
      const viewH = codeState.viewH || Math.max(40, codeState.h);
      /* Scroll only when the line approaches an edge. Re-centring on every step made the
       code jitter up and down whenever two active lines were far apart, which read as a
       flicker; a comfort band (a couple of lines at the bottom, one at the top) keeps a
       back-and-forth pair like compare/swap on screen together without any movement. */
      const lineTop = (ln - 1) * codeState.lh;
      const band = codeState.lh * (ln > codeState.line ? 2.5 : 1) + 6;
      const needsScroll =
        lineTop < codeState.scroll + 4 ||
        lineTop > codeState.scroll + viewH - band;
      if (needsScroll && !codeState.manual) {
        const maxScroll = Math.max(0, codeState.max * codeState.lh - viewH);
        codeState.scroll = Math.min(
          maxScroll,
          Math.max(0, lineTop - viewH * 0.34),
        );
      }
      /* Write only what actually changed. Rewriting the same style/text every frame
       recreates text nodes and forces layout, which reads as a flicker. */
      if (codeState.appliedScroll !== codeState.scroll) {
        codeEls.lines.style.transform =
          "translateY(" + -codeState.scroll + "px)";
        codeEls.pre.style.transform = "translateY(" + -codeState.scroll + "px)";
        if (codeState.appliedLine > 0) {
          codeEls.hl.style.transform =
            "translateY(" +
            ((codeState.appliedLine - 1) * codeState.lh - codeState.scroll) +
            "px)";
        }
        codeState.appliedScroll = codeState.scroll;
      }
      if (codeState.appliedLine !== ln) {
        /* the bar is a sibling of the code text, so it needs the content position minus
         the scroll offset — otherwise it stays at its unscrolled y and vanishes when the
         panel scrolls (which is what happened on phones) */
        codeEls.hl.style.transform =
          "translateY(" + (y - codeState.scroll) + "px)";
        codeState.appliedLine = ln;
      }
      if (!codeState.hlOn) {
        codeEls.hl.classList.add("on");
        codeState.hlOn = true;
      }
      codeState.smooth = false;
      /* pan sideways so the step token on the active line stays readable */
      if (codeEls.wrap && codeState.charW > 0) {
        const src = splitComment(
          pack.code[ln - 1] || "",
          codeLang,
        )[0].trimEnd();
        const indent = src.length - src.replace(/^\s+/, "").length;
        const c0 = indent * codeState.charW;
        const c1 = src.replace(/\s+$/, "").length * codeState.charW;
        const view = codeEls.main.clientWidth;
        let want = codeEls.main.scrollLeft;
        if (c1 <= view + 1) want = 0;
        else if (c1 - want > view)
          want = Math.max(0, Math.min(c0 - 6, c1 - view + 8));
        if (want !== codeEls.main.scrollLeft) codeEls.main.scrollLeft = want;
      }
      setText("lineChip", "行 " + ln);
      setText("cfLine", ln + " / " + codeState.max);
      const c = splitComment(pack.code[ln - 1] || "", codeLang)[1];
      setText(
        "cfNote",
        c ? c.replace(/^[\/\*#\s]+|[\*\/\s]+$/g, "") : frame.hint || "",
      );
      codeState.line = ln;
    } else {
      if (codeState.hlOn) {
        codeEls.hl.classList.remove("on");
        codeState.hlOn = false;
      }
      codeState.line = -1;
      setText("lineChip", "行 —");
      setText("cfLine", "—");
      setText("cfNote", "");
    }
    if (codeState.line > 0)
      setText("cfHits", fmt(codeState.hits[codeState.line] || 0));
  }

  /* assign textContent only when it differs — avoids recreating text nodes each frame */
  const _textCache = {};
  function setText(id, value) {
    window.__tw = window.__tw || {};
    const c =
      window.__tw[id] ||
      (window.__tw[id] = { calls: 0, writes: 0, last: null });
    c.calls++;
    if (_textCache[id] === value) return;
    c.writes++;
    c.last = value;
    _textCache[id] = value;
    const el = $(id);
    if (el) el.textContent = value;
  }

  /* the gutter shows line numbers until a line has executed, then its execution count */
  function paintGutter() {
    if (!codeState) return;
    const counts = codeState.hits;
    const max = Math.max.apply(null, counts.concat([0]));
    let hot = -1;
    for (let l = 1; l <= codeState.max; l++) {
      const slot = $("gut" + l);
      if (!slot) continue;
      const txt = String(l);
      slot.title = "执行 " + counts[l] + " 次";
      const isCount = counts[l] > 0;
      if (slot._t !== txt) {
        slot._t = txt;
        slot.textContent = txt;
      }
      if (slot._c !== isCount) {
        slot._c = isCount;
        slot.classList.toggle("cnt", isCount);
      }
      if (counts[l] === max && max > 0) hot = l;
    }
    setText("cfHot", hot > 0 ? "第 " + hot + " 行 · " + fmt(max) + " 次" : "—");
  }
  function markHotLines() {
    paintGutter();
    if (codeState) codeState.paintedAt = S.raf;
    clearInterval(gutterTimer);
    gutterTimer = setInterval(function () {
      if (!codeState) return;
      if (S.raf !== codeState.paintedAt) {
        paintGutter();
        codeState.paintedAt = S.raf;
      }
    }, 220);
  }

  /* rebuild the per-line execution counters whenever the timeline changes */
  function resetCodeCounts() {
    if (!codeState) return;
    codeState.hits = new Array(codeState.max + 1).fill(0);
    codeState.hitsAt = 0;
    setText("cfHits", "0");
    paintGutter();
  }
  function countStepHits(idx) {
    if (!codeState) return;
    const frames = S.frames;
    if (idx < codeState.hitsAt) {
      codeState.hits = new Array(codeState.max + 1).fill(0);
      codeState.hitsAt = 0;
    }
    const pack = LANGS[S.algo][codeLang];
    for (let f = codeState.hitsAt; f <= idx && f < frames.length; f++) {
      const st = frames[f] && frames[f].step;
      const ln = st && pack.steps[st];
      if (ln > 0 && ln <= codeState.max) codeState.hits[ln]++;
    }
    codeState.hitsAt = idx + 1;
  }

  /* ============================================================
   13. Wiring
   ============================================================ */
  /* resume() is async, so queue the confirmation tone behind it */
  function resumeAudio(andThen) {
    if (!AC) {
      if (andThen) andThen();
      return;
    }
    if (AC.state === "running") {
      if (andThen) andThen();
      return;
    }
    const p = AC.resume();
    if (p && p.then)
      p.then(() => {
        if (andThen) andThen();
      }).catch(() => {});
    else if (andThen) andThen();
  }
  $("play").addEventListener("click", () => {
    if (S.busy || !S.frames.length) return;
    ensureAudio();
    resumeAudio();
    if (S.done) {
      restart(false);
      return;
    }
    S.playing = !S.playing;
    setPlayIcon();
  });
  $("shuffle").addEventListener("click", () => regenerate());
  $("restart").addEventListener("click", () => restart(true));
  function seekFrame(index) {
    if (S.busy || !S.frames.length) return;
    S.raf = Math.max(0, Math.min(S.nframes - 1, index));
    S.acc = 0;
    S.delay = 0;
    S.finAt = -1;
    S.playing = false;
    S.done = S.raf === S.nframes - 1;
    if (codeState) codeState.manual = false;
    setPlayIcon();
    countStepHits(S.raf);
    updateCode(S.frames[S.raf]);
    updateCards();
  }
  $("timeline").addEventListener("input", (e) => seekFrame(+e.target.value));
  $("prevFrame").addEventListener("click", () => seekFrame(S.raf - 1));
  $("nextFrame").addEventListener("click", () => seekFrame(S.raf + 1));
  $("distribution").addEventListener("change", (e) => {
    S.distribution = e.target.value;
    $("size").disabled = false;
    regenerate();
  });
  $("sound").addEventListener("click", () => {
    ensureAudio();
    S.sound = !S.sound;
    $("sound").setAttribute("aria-pressed", String(S.sound));
    if (S.sound) resumeAudio(() => tone(69, 0.1, 0.25));
  });
  $("ruler").addEventListener("click", () => {
    S.ruler = !S.ruler;
    $("ruler").setAttribute("aria-pressed", String(S.ruler));
  });
  function toggleCode() {
    if ($("codepane").classList.contains("expanded")) toggleCodeFull();
    const hide = !$("codepane").classList.contains("hidden");
    $("codepane").classList.toggle("hidden", hide);
    $("work").classList.toggle("nocode", hide);
    $("codeToggle").setAttribute("aria-pressed", String(!hide));
    setTimeout(resize, 0); // the canvas pane just got wider — remeasure
  }
  $("codeToggle").addEventListener("click", toggleCode);
  $("expandCode").addEventListener("click", toggleCodeFull);
  document.querySelectorAll(".seg [data-style]").forEach((b) => {
    b.addEventListener("click", () => {
      S.barStyle = b.dataset.style;
      document
        .querySelectorAll(".seg [data-style]")
        .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    });
  });
  $("speed").addEventListener("input", (e) => {
    S.speed = +e.target.value;
    syncSlider(e.target);
    speedLabel();
  });
  $("size").addEventListener("input", (e) => {
    $("sizeOut").textContent = e.target.value;
    syncSlider(e.target);
  });
  $("size").addEventListener("change", (e) => {
    S.n = +e.target.value;
    regenerate();
  });

  // Dialogs keep focus inside and restore it to the invoking control on close.
  function openDialog(id) {
    S.playing = false;
    setPlayIcon();
    $(id).showModal();
  }
  $("customOpen").addEventListener("click", () => {
    $("customValues").value = S.values.join(", ");
    $("customError").hidden = true;
    openDialog("customDialog");
  });
  $("helpOpen").addEventListener("click", () => openDialog("helpDialog"));
  document
    .querySelectorAll("[data-close]")
    .forEach((button) =>
      button.addEventListener("click", () => button.closest("dialog").close()),
    );
  document.querySelectorAll("dialog").forEach((dialog) =>
    dialog.addEventListener("click", (event) => {
      const r = dialog.getBoundingClientRect();
      if (
        event.target === dialog &&
        (event.clientX < r.left ||
          event.clientX > r.right ||
          event.clientY < r.top ||
          event.clientY > r.bottom)
      )
        dialog.close();
    }),
  );
  $("customForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const tokens = $("customValues")
      .value.trim()
      .split(/[\s,，;；]+/);
    const values = tokens.map(Number);
    let error = "";
    if (
      tokens.some((t) => !/^\d+$/.test(t)) ||
      values.some((v) => !Number.isSafeInteger(v) || v < 1 || v > 999)
    )
      error = "请只输入 1–999 之间的正整数，用逗号或空格分隔。";
    else if (values.length < 2 || values.length > 180)
      error = "请输入 2–180 个数字。";
    if (error) {
      $("customError").textContent = error;
      $("customError").hidden = false;
      return;
    }
    S.distribution = "custom";
    $("distribution").value = "custom";
    $("size").disabled = true;
    $("customDialog").close();
    regenerate(false, values);
  });
  let comparisonToken = 0;
  let toastTimer;
  function notify(message) {
    clearTimeout(toastTimer);
    $("toast").textContent = message;
    $("toast").hidden = false;
    toastTimer = setTimeout(() => ($("toast").hidden = true), 2500);
  }
  $("copyCode").addEventListener("click", async () => {
    const code = LANGS[S.algo][codeLang].code.join("\n");
    try {
      await navigator.clipboard.writeText(code);
      notify("当前语言的代码已复制");
    } catch {
      notify("复制不可用，请在全屏代码中选择并复制");
    }
  });
  $("compareOpen").addEventListener("click", () => {
    openDialog("compareDialog");
    const values = S.values.slice(),
      current = S.algo,
      token = ++comparisonToken;
    $("compareDescription").textContent =
      "当前 " +
      values.length +
      " 个数字 · " +
      $("distribution").selectedOptions[0].textContent +
      "。以下统计使用相同输入，逐一执行全部算法。";
    $("compareBody").innerHTML =
      '<tr><td colspan="7">正在计算当前数组的完整轨迹…</td></tr>';
    const rows = [];
    let i = 0;
    function next() {
      if (!$("compareDialog").open || token !== comparisonToken) return;
      const key = ORDER[i++];
      let last;
      for (const frame of GEN[key](values)) last = frame;
      const m = META[key];
      rows.push(
        '<tr data-current="' +
          (key === current) +
          '"><td>' +
          ALGOS[key].name +
          "</td><td>" +
          m.time +
          "</td><td>" +
          m.space +
          "</td><td>" +
          (m.stable ? "稳定" : "不稳定") +
          "</td><td>" +
          fmt(last.cmp) +
          "</td><td>" +
          fmt(last.swp) +
          "</td><td>" +
          fmt(last.wrt) +
          "</td></tr>",
      );
      if (i < ORDER.length) setTimeout(next, 0);
      else $("compareBody").innerHTML = rows.join("");
    }
    setTimeout(next, 0);
  });
  // Accessible tab navigation stays within the relevant tablist.
  for (const [id, attribute, select] of [
    ["algos", "key", selectAlgo],
    ["langbar", "lang", showLang],
  ]) {
    $(id).addEventListener("keydown", (event) => {
      const tabs = [...$(id).children],
        index = tabs.indexOf(event.target);
      if (index < 0) return;
      let next = index;
      if (["ArrowRight", "ArrowDown"].includes(event.key))
        next = (index + 1) % tabs.length;
      else if (["ArrowLeft", "ArrowUp"].includes(event.key))
        next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      event.preventDefault();
      event.stopPropagation();
      select(tabs[next].dataset[attribute]);
      tabs[next].focus();
    });
  }
  $("codeWrap").addEventListener(
    "wheel",
    (event) => {
      if (!codeState || Math.abs(event.deltaY) <= Math.abs(event.deltaX))
        return;
      const max = Math.max(0, codeState.max * codeState.lh - codeState.viewH);
      const next = Math.max(0, Math.min(max, codeState.scroll + event.deltaY));
      if (next === codeState.scroll) return;
      event.preventDefault();
      if (S.playing) {
        S.playing = false;
        setPlayIcon();
      }
      codeState.scroll = next;
      codeState.appliedScroll = next;
      codeState.manual = true;
      codeEls.lines.style.transform = "translateY(" + -next + "px)";
      codeEls.pre.style.transform = "translateY(" + -next + "px)";
      codeEls.hl.style.transform =
        "translateY(" +
        ((codeState.appliedLine - 1) * codeState.lh - next) +
        "px)";
    },
    { passive: false },
  );

  document.addEventListener("keydown", (e) => {
    if (
      e.defaultPrevented ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      e.target.closest('input,textarea,select,[contenteditable="true"],dialog')
    )
      return;
    if (document.querySelector("dialog[open]")) return;
    if (e.target.closest("button,a") && e.code === "Space") return;
    if (e.code === "Space") {
      e.preventDefault();
      $("play").click();
    } else if (e.key === "r" || e.key === "R") {
      $("shuffle").click();
    } else if (e.key === "1") {
      $("ruler").click();
    } else if (e.key === "m" || e.key === "M") {
      $("sound").click();
    } else if (e.key === "c" || e.key === "C") {
      toggleCode();
    } else if (e.key === "f" || e.key === "F") {
      toggleCodeFull();
    } else if (
      e.key === "Escape" &&
      $("codepane").classList.contains("expanded")
    ) {
      toggleCodeFull();
    } else if (e.key === "l" || e.key === "L") {
      const i = CODE_LANGS.findIndex(function (x) {
        return x.id === codeLang;
      });
      showLang(CODE_LANGS[(i + 1) % CODE_LANGS.length].id);
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      seekFrame(S.raf + (e.key === "ArrowRight" ? 1 : -1));
    }
  });

  let rt = 0;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      resize();
      syncCompact();
      remeasureCode();
    }, 90);
  });
  window.addEventListener("orientationchange", () => setTimeout(resize, 200));

  /* ============================================================
   13. Boot
   ============================================================ */
  buildAlgoTabs();
  buildLangTabs();
  codeEls.pane = $("codepane");
  codeEls.pane.classList.toggle("compact", window.innerWidth <= 620);
  buildCodePanel();
  resize();
  syncSlider($("speed"));
  syncSlider($("size"));
  speedLabel();
  updateChips(0);
  regenerate();
  new ResizeObserver(() => {
    resize();
    remeasureCode();
  }).observe(stage);
  window.__sortingAtlas = {
    select: function (key) {
      if (ALGOS[key]) selectAlgo(key);
    },
    load: function (algo, values) {
      buildToken++;
      if (ALGOS[algo]) S.algo = algo;
      S.values = values.slice();
      S.n = values.length;
      S.maxValue = Math.max(1, ...values);
      moveCache = { idx: -1, moves: null };
      S.frames = buildFrames();
      S.nframes = S.frames.length;
      S.raf = 0;
      S.acc = 0;
      S.done = false;
      S.playing = false;
      S.hover = -1;
      if (typeof buildCodePanel === "function") buildCodePanel();
      updateChips(0);
      setBusy(false);
      setPlayIcon();
      updateCards();
      return { frames: S.nframes, values: S.values.slice() };
    },
    findSwap: function (i) {
      return findSwapPair(
        S.frames[i] && S.frames[i].a,
        S.frames[i + 1] && S.frames[i + 1].a,
      );
    },
    goto: function (i, frac) {
      seekFrame(i);
      S.acc = frac || 0;
    },
    /* for automated checks: inked x-runs on one scanline of the canvas */
    sampleRow: function (pxAboveBaseline) {
      const r = cv.getBoundingClientRect();
      const Hcss = r.height;
      const rulerH = 0;
      const y1 = Hcss - 16 - rulerH;
      const dpr = cv.width / r.width;
      const y = Math.max(0, Math.round((y1 - pxAboveBaseline) * dpr));
      const d = ctx.getImageData(0, y, cv.width, 1).data;
      const runs = [];
      let start = -1;
      for (let x = 0; x < cv.width; x++) {
        const a = d[x * 4 + 3],
          rr = d[x * 4],
          gg = d[x * 4 + 1],
          bb = d[x * 4 + 2];
        const inked = a > 40 && rr + gg + bb > 90;
        if (inked && start < 0) start = x;
        if (!inked && start >= 0) {
          runs.push([Math.round(start / dpr), Math.round(x / dpr)]);
          start = -1;
        }
      }
      if (start >= 0)
        runs.push([Math.round(start / dpr), Math.round(cv.width / dpr)]);
      return { y: y, dpr: dpr, runs: runs, baseline: y1 };
    },
    /* publish the swap geometry so it can be verified without pixel scraping */
    frameCount: function () {
      return S.nframes;
    },
    swapAt: function (i) {
      /* any movement, not just a strict two-element swap */
      const from = S.frames[i] && S.frames[i].a,
        to = S.frames[i + 1] && S.frames[i + 1].a;
      const mv = detectMoves(from, to);
      const g =
        mv && mv.length
          ? mv.map(function (m) {
              return m.from;
            })
          : null;
      if (!g) return null;
      const r = cv.getBoundingClientRect();
      const bw = Math.max(1.15, (r.width - 20 - 20) / Math.max(1, S.n));
      const out = { bw: bw, pair: g, moves: mv, positions: {} };
      const easedOf = function (t) {
        return t * t * (3 - 2 * t);
      };
      [0, 0.25, 0.5, 0.75, 1].forEach(function (t) {
        const f = easedOf(t),
          pos = {};
        for (let k = 0; k < mv.length; k++) {
          const m = mv[k];
          pos[k] = {
            from: m.from,
            to: m.to,
            slot: m.from,
            centre: m.from * bw + bw / 2 + (m.to - m.from) * bw * f,
            lift: 0,
          };
        }
        out.positions[t] = pos;
      });
      return out;
    },
    /* diagnostics: why might the highlighted line sit outside the code viewport? */
    codeDebug: function () {
      if (!codeState) return null;
      const el = codeState.line > 0 ? $("cl" + codeState.line) : null;
      const main = $("codeMain").getBoundingClientRect();
      const eb = el ? el.getBoundingClientRect() : null;
      return {
        line: codeState.line,
        step: codeState.step,
        lh: codeState.lh,
        h: codeState.h,
        scroll: codeState.scroll,
        max: codeState.max,
        panelClientH: codeEls.main.clientHeight,
        mainTop: Math.round(main.top),
        mainBottom: Math.round(main.bottom),
        mainH: Math.round(main.height),
        elTop: eb ? Math.round(eb.top) : null,
        elBottom: eb ? Math.round(eb.bottom) : null,
        inside: eb
          ? eb.top >= main.top - 1 && eb.bottom <= main.bottom + 1
          : null,
        transform: codeEls.pre.style.transform,
        hlTransform: codeEls.hl.style.transform,
        /* used by the automated checks: is the HIGHLIGHT BAR itself on screen and in line
         with its row? (the row can be in view while the bar is not) */
        hlOn: codeState.hlOn,
        appliedLine: codeState.appliedLine,
        hlTop: Math.round(codeEls.hl.getBoundingClientRect().top),
        hlInside: (function () {
          const b = codeEls.hl.getBoundingClientRect(),
            m = codeEls.main.getBoundingClientRect();
          return b.bottom > m.top + 1 && b.top < m.bottom - 1;
        })(),
        hlAligned:
          Math.abs(
            codeEls.hl.getBoundingClientRect().top -
              (el ? el.getBoundingClientRect().top : 0),
          ) < 2,
        appliedScroll: codeState.appliedScroll,
        codeStateScroll: codeState.scroll,
        viewH: codeState.viewH,
        lh: codeState.lh,
        step: codeState.step,
        preTransform: codeEls.pre.style.transform,
      };
    },
    colX: function (p) {
      const r = cv.getBoundingClientRect();
      const padL = 20,
        padR = 20;
      const bw = (r.width - padR - padL) / S.n;
      return padL + p * bw + bw / 2;
    },
    arrays: function (i) {
      return {
        from: S.frames[i] ? S.frames[i].a.slice() : null,
        to: S.frames[i + 1] ? S.frames[i + 1].a.slice() : null,
      };
    },
    freeze: function (pct) {
      S.raf = Math.max(0, Math.round((S.nframes - 1) * pct));
      S.acc = 0;
      S.done = false;
      S.playing = false;
      if (typeof setPlayIcon === "function") setPlayIcon();
    },
    frameAt: function (i) {
      return S.frames[i] || null;
    },
    detect: function (a, b) {
      return detectMoves(a, b);
    },
    stepsForLang: function () {
      return LANGS[S.algo][codeLang].steps;
    },
    state: function () {
      var f = S.frames[Math.min(S.nframes - 1, S.raf)] || null;
      return {
        algo: S.algo,
        n: S.n,
        nframes: S.nframes,
        raf: S.raf,
        step: f ? f.step : null,
        hint: f ? f.hint : "",
        done: S.done,
        playing: S.playing,
      };
    },
  };
})();
