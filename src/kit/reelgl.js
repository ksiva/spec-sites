// Full-screen video "reel index": shows one of several <video> elements on a WebGL canvas and moves between them
// with a noise-driven displacement wipe. Falls back to a CSS crossfade without WebGL or with reduced motion.
import gsap from "gsap";

const VERT = `attribute vec2 p; varying vec2 vUv;
void main(){ vUv = p * 0.5 + 0.5; vUv.y = 1.0 - vUv.y; gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `precision highp float;
varying vec2 vUv;
uniform sampler2D uA, uB;
uniform float uP, uAspect, uTexAspect, uTime, uHalo;
uniform vec2 uMouse;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for(int i=0;i<4;i++){ v += a*n(p); p *= 2.02; a *= 0.5; } return v; }
vec2 cover(vec2 uv){ float r = uAspect / uTexAspect; return r > 1.0 ? vec2(uv.x, (uv.y-0.5)/r+0.5) : vec2((uv.x-0.5)*r+0.5, uv.y); }
void main(){
  vec2 uv = vUv;
  // a slow drift toward the pointer gives the frame some weight
  uv += (uMouse - 0.5) * 0.012;
  float field = fbm(uv * 3.0 + uTime * 0.05);
  float edge = smoothstep(uP - 0.18, uP + 0.18, field * 0.7 + uv.x * 0.3 + 0.0);
  float w = 1.0 - edge;                       // 0 = still A, 1 = B
  vec2 dA = vec2(field - 0.5) * 0.18 * w;
  vec2 dB = vec2(field - 0.5) * 0.18 * (1.0 - w);
  vec3 a = texture2D(uA, cover(uv + dA)).rgb;
  vec3 b = texture2D(uB, cover(uv - dB)).rgb;
  // a thin bright seam rides the wipe, like light leaking between frames
  float seam = smoothstep(0.0, 0.5, w) * smoothstep(1.0, 0.5, w);
  vec3 col = mix(a, b, w) + seam * 0.18 * vec3(1.0, 0.92, 0.8);
  // halation: highlights bleed a warm red-orange glow into their surroundings, like light scattering in film stock
  vec2 px = vec2(0.012, 0.012 * uAspect);
  vec3 glow = vec3(0.0);
  for (int k = 0; k < 8; k++) {
    float ang = float(k) * 0.7854;
    vec2 o = vec2(cos(ang), sin(ang)) * px;
    vec3 sA = texture2D(uA, cover(uv + dA + o)).rgb, sB = texture2D(uB, cover(uv - dB + o)).rgb;
    vec3 s = mix(sA, sB, w);
    glow += max(s - 0.62, 0.0);
  }
  col += glow / 8.0 * vec3(1.0, 0.36, 0.18) * uHalo;
  // vignette
  vec2 q = vUv - 0.5; col *= 1.0 - dot(q, q) * 0.55;
  gl_FragColor = vec4(col, 1.0);
}`;

export function createReel(canvas, videos, { texAspect = 16 / 9, duration = 1.4, halo = 0 } = {}) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches && !location.search.includes("motion");
  const gl = !reduce && canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false });
  let current = 0;
  videos.forEach((v, i) => { v.muted = true; v.loop = true; v.playsInline = true; if (i === 0) v.play().catch(() => {}); });

  if (!gl) {
    // Fallback: stack the videos and crossfade them.
    canvas.style.display = "none";
    videos.forEach((v, i) => { v.classList.add("reel-fallback"); v.style.opacity = i === 0 ? "1" : "0"; });
    return {
      show(i) {
        if (i === current) return;
        const prev = videos[current]; current = i;
        videos[i].play().catch(() => {});
        gsap.to(videos[i], { opacity: 1, duration: reduce ? 0 : 0.8 });
        gsap.to(prev, { opacity: 0, duration: reduce ? 0 : 0.8, onComplete: () => prev.pause() });
      },
      get index() { return current; },
    };
  }

  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n);
  const uP = U("uP"), uAspect = U("uAspect"), uTexAspect = U("uTexAspect"), uTime = U("uTime"), uMouse = U("uMouse");
  gl.uniform1i(U("uA"), 0);
  gl.uniform1i(U("uB"), 1);
  gl.uniform1f(uTexAspect, texAspect);
  gl.uniform1f(U("uHalo"), halo);

  const makeTex = () => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([10, 10, 10]));
    return t;
  };
  const texA = makeTex(), texB = makeTex();
  const state = { p: 0, a: 0, b: 0 };
  const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  addEventListener("pointermove", (e) => { mouse.tx = e.clientX / innerWidth; mouse.ty = e.clientY / innerHeight; });

  const upload = (tex, unit, video) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (video.readyState >= 2) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
  };
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const w = canvas.clientWidth, hgt = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(hgt * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(hgt * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    gl.uniform1f(uAspect, w / hgt);
  };
  const t0 = performance.now();
  gsap.ticker.add(() => {
    resize();
    mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;
    upload(texA, 0, videos[state.a]);
    upload(texB, 1, videos[state.b]);
    gl.uniform1f(uP, state.p);
    gl.uniform1f(uTime, (performance.now() - t0) / 1000);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  });

  let tween;
  return {
    show(i) {
      if (i === current) return;
      // Freeze where we are: whatever is on screen becomes A, the new film is B.
      const from = state.p > 0.5 ? state.b : state.a;
      tween?.kill();
      state.a = from; state.b = i; state.p = -0.25; current = i;
      videos[i].play().catch(() => {});
      tween = gsap.to(state, {
        p: 1.25, duration, ease: "power2.inOut",
        onComplete: () => { videos.forEach((v, k) => { if (k !== i) v.pause(); }); state.a = i; state.p = -0.25; },
      });
    },
    get index() { return current; },
  };
}
