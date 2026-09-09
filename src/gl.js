const VERT = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uProgress;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p = p * 2.02 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  vec2 m = (uMouse - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float t = uTime * 0.12;
  float p = uProgress;

  float pull = length(uv - m);
  vec2 warp = uv;
  warp += 0.18 * vec2(
    fbm(uv * 2.4 + t),
    fbm(uv * 2.4 - t + 3.1)
  );
  warp -= m * (0.22 / (pull + 0.35));

  float n = fbm(warp * 3.2 + vec2(t * 0.7, -t * 0.4));
  float veins = smoothstep(0.42, 0.72, n + p * 0.18);
  float disc = smoothstep(0.62, 0.18, length(uv) - p * 0.12);

  vec3 ink = vec3(0.027, 0.031, 0.039);
  vec3 bone = vec3(0.937, 0.910, 0.863);
  vec3 cad = vec3(1.0, 0.176, 0.0);

  vec3 col = mix(ink, cad * 0.22, veins * 0.85);
  col = mix(col, cad, veins * veins * 0.55);
  col = mix(col, bone * 0.16, disc * 0.35);
  col += cad * (0.08 / (pull * 4.0 + 0.35));

  float vig = smoothstep(1.25, 0.15, length(uv));
  col *= vig;
  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) || "shader");
  }
  return sh;
}

export function createField(canvas) {
  const gl = canvas.getContext("webgl", {
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  });
  if (!gl) return { setMouse() {}, setProgress() {}, destroy() {} };

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, "uRes");
  const uTime = gl.getUniformLocation(prog, "uTime");
  const uMouse = gl.getUniformLocation(prog, "uMouse");
  const uProgress = gl.getUniformLocation(prog, "uProgress");

  const mouse = { x: 0.5, y: 0.5 };
  let progress = 0;
  let raf = 0;
  let start = performance.now();

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  };

  const draw = (now) => {
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.uniform2f(uMouse, mouse.x, 1 - mouse.y);
    gl.uniform1f(uProgress, progress);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    raf = requestAnimationFrame(draw);
  };

  resize();
  raf = requestAnimationFrame(draw);
  window.addEventListener("resize", resize);

  return {
    setMouse(x, y) {
      mouse.x = x;
      mouse.y = y;
    },
    setProgress(v) {
      progress = v;
    },
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    },
  };
}
