import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SCENARIOS, END_STATES, COMPARE_DEFAULT, INFO, TABLE, LAYER_NAMES } from './content.js';

THREE.ColorManagement.enabled = false;

// ---------- 彩繪圖譜著色器 ----------
const TIME = { value: 0 };
const INK = new THREE.Color('#2a1e18');

const VERT = `
varying vec3 vW; varying vec3 vN;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = `
uniform vec3 uColor; uniform vec3 uShade; uniform vec3 uInk;
uniform float uKind; uniform float uOpacity; uniform float uHi; uniform float uTime; uniform float uHatch;
uniform vec3 uFiber; uniform vec4 uCut;
uniform vec4 uAreR; uniform vec4 uAreL;
uniform vec4 uPaddle; uniform vec3 uPaddleR;
uniform vec4 uWound; uniform vec3 uWoundR;
varying vec3 vW; varying vec3 vN;
float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
vec2 vor(vec3 x){ vec3 p = floor(x); vec3 f = fract(x); float d1 = 8.0; float d2 = 8.0;
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec3 b = vec3(float(i), float(j), float(k));
    vec3 r = b - f + vec3(h3(p + b), h3(p + b + 17.1), h3(p + b + 31.7));
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return vec2(sqrt(d1), sqrt(d2)); }
void main(){
  if (uCut.w > 0.0 && distance(vW, uCut.xyz) < uCut.w) discard;
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vW);
  vec3 L = normalize((vec4(-0.45, 0.62, 0.65, 0.0) * viewMatrix).xyz);
  vec3 L2 = normalize((vec4(0.7, -0.15, 0.45, 0.0) * viewMatrix).xyz);
  float wrap = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
  float tone = smoothstep(0.16, 0.92, wrap);
  int k = int(uKind + 0.5);
  vec3 col = uColor; vec3 sh = uShade; float tex = 1.0;
  if (k == 10) {
    if (dot(N, normalize(uFiber)) > 0.15) { k = 0; col = vec3(0.91, 0.75, 0.65); sh = vec3(0.61, 0.42, 0.35); }
    else { k = 2; col = vec3(0.95, 0.81, 0.42); sh = vec3(0.72, 0.53, 0.18); }
  }
  if (k == 1) {
    vec3 d = normalize(uFiber - vW); vec3 t = cross(d, N); float tl = length(t);
    t = tl > 1e-4 ? t / tl : vec3(1.0, 0.0, 0.0);
    float s = dot(vW, t) * 1300.0 + vn(vW * 90.0) * 2.5;
    float st = 0.5 + 0.5 * sin(s);
    st = mix(st, 0.5, clamp(fwidth(s) / 3.0, 0.0, 1.0));
    tex = mix(0.80, 1.07, st) * (0.93 + 0.14 * vn(vW * 240.0));
  } else if (k == 2 || k == 9) {
    vec2 v = vor(vW * (k == 2 ? 170.0 : 230.0));
    float edge = smoothstep(0.0, 0.12, v.y - v.x);
    tex = mix(0.72, 1.06, edge) * (1.0 - 0.22 * v.x);
  } else if (k == 3) {
    tex = 0.93 + 0.09 * vn(vW * 300.0) - 0.08 * smoothstep(0.62, 0.9, vn(vW * 900.0));
  } else if (k == 4) {
    vec2 v = vor(vW * 75.0); float edge = smoothstep(0.0, 0.22, v.y - v.x);
    tex = mix(0.9, 1.03, edge) * (0.96 + 0.06 * vn(vW * 300.0));
  } else if (k == 0) {
    tex = 0.97 + 0.05 * vn(vW * 400.0);
  }
  vec3 c = mix(sh, col, tone) * tex;
  c += col * 0.10 * max(dot(N, L2), 0.0);
  if (k == 0 && uKind < 0.5) {
    float a1 = uAreR.w > 0.0 ? 1.0 - smoothstep(uAreR.w * 0.78, uAreR.w, distance(vW, uAreR.xyz)) : 0.0;
    float a2 = uAreL.w > 0.0 ? 1.0 - smoothstep(uAreL.w * 0.78, uAreL.w, distance(vW, uAreL.xyz)) : 0.0;
    float nip = max(uAreR.w > 0.0 ? 1.0 - smoothstep(0.003, 0.0045, distance(vW, uAreR.xyz)) : 0.0,
                    uAreL.w > 0.0 ? 1.0 - smoothstep(0.003, 0.0045, distance(vW, uAreL.xyz)) : 0.0);
    c = mix(c, vec3(0.66, 0.42, 0.37) * mix(0.68, 1.0, tone) * (0.94 + 0.1 * vn(vW * 900.0)), max(a1, a2) * 0.85);
    c = mix(c, vec3(0.55, 0.32, 0.28) * mix(0.7, 1.0, tone), nip * 0.8);
    if (uPaddle.w > 0.0) {
      float e = length((vW - uPaddle.xyz) / uPaddleR);
      c = mix(c, c * vec3(1.05, 1.0, 0.92), (1.0 - smoothstep(0.95, 1.0, e)) * uPaddle.w);
      c = mix(c, vec3(0.55, 0.2, 0.18), (1.0 - smoothstep(0.0, 0.035, abs(e - 1.0))) * uPaddle.w * 0.85);
    }
    if (uWound.w > 0.0) {
      float e = length((vW - uWound.xyz) / uWoundR);
      float m = (1.0 - smoothstep(0.92, 1.0, e)) * uWound.w;
      vec3 raw = mix(vec3(0.62, 0.2, 0.15), vec3(0.8, 0.5, 0.3), 0.35 * vn(vW * 80.0));
      c = mix(c, raw * mix(0.6, 1.0, tone), m);
    }
  }
  vec3 R = reflect(-L, N);
  float sp = pow(max(dot(R, V), 0.0), k == 7 ? 40.0 : 18.0);
  c += vec3(1.0, 0.97, 0.9) * sp * (k == 1 ? 0.18 : (k == 7 ? 0.55 : (k == 0 ? 0.06 : 0.1)));
  float hatch = step(0.5, fract((gl_FragCoord.x - gl_FragCoord.y) * 0.25));
  c = mix(c, c * 0.84, hatch * (1.0 - tone) * 0.5 * uHatch);
  float e = 1.0 - abs(dot(N, V));
  c = mix(c, uInk, smoothstep(0.72, 1.0, e) * 0.5);
  c = mix(c, vec3(1.0, 0.84, 0.32), uHi * 0.4 * (0.6 + 0.4 * sin(uTime * 3.2)));
  float alpha = uOpacity;
  if (k == 7) alpha *= mix(0.55, 0.92, e);
  if (k == 8) alpha *= mix(0.12, 0.65, smoothstep(0.3, 1.0, e));
  gl_FragColor = vec4(c, alpha);
}`;

const OUT_VERT = `uniform float uW; void main(){ vec3 p = position + normal * uW; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;
const OUT_FRAG = `uniform vec3 uInk; void main(){ gl_FragColor = vec4(uInk, 1.0); }`;
const outlineMat = new THREE.ShaderMaterial({ vertexShader: OUT_VERT, fragmentShader: OUT_FRAG, side: THREE.BackSide, uniforms: { uW: { value: 0.0007 }, uInk: { value: INK } } });

const KIND = { skin: 0, muscle: 1, fat: 2, bone: 3, gland: 4, plain: 5, implant: 7, margin: 8, omentum: 9, flap: 10 };

function atlasMat(kind, color, shade, opts = {}) {
  const m = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    side: opts.side ?? THREE.FrontSide,
    transparent: !!opts.transparent, depthWrite: opts.depthWrite ?? true,
    uniforms: {
      uColor: { value: new THREE.Color(color) }, uShade: { value: new THREE.Color(shade) }, uInk: { value: INK },
      uKind: { value: KIND[kind] }, uOpacity: { value: opts.opacity ?? 1 }, uHi: { value: 0 }, uTime: TIME, uHatch: { value: opts.hatch ?? 1 },
      uFiber: { value: opts.fiber ? opts.fiber.clone() : new THREE.Vector3(0, 3, 0) }, uCut: { value: new THREE.Vector4(0, 0, 0, 0) },
      uAreR: { value: new THREE.Vector4() }, uAreL: { value: new THREE.Vector4() },
      uPaddle: { value: new THREE.Vector4() }, uPaddleR: { value: new THREE.Vector3(0.045, 0.032, 0.06) },
      uWound: { value: new THREE.Vector4(0, 0.955, 0.11, 0) }, uWoundR: { value: new THREE.Vector3(0.13, 0.05, 0.08) }
    }
  });
  return m;
}

const PAL = {
  skin: ['#e9c2aa', '#a06e5c'], fat: ['#f2cf6b', '#b8862e'], gland: ['#f2cdc4', '#bb8579'],
  muscle: ['#b9473d', '#5e1d1a'], tendon: ['#e9e3d2', '#9f9884'], bone: ['#efe6cf', '#a99a78'], cart: ['#d6e2e4', '#8ea4aa'],
  omentum: ['#f1d47e', '#b89236'], stomach: ['#dc9e93', '#8f5048'], liver: ['#93412f', '#4a1a14'], colon: ['#d8a882', '#8a5a3a'],
  artery: ['#c8392b', '#6e1610'], vein: ['#4262a8', '#1e2f5a'], nerve: ['#e6c552', '#8f7420'],
  implant: ['#cfe6f2', '#5f8fae'], expander: ['#e4e9ec', '#7d8a94'], tumor: ['#6b4467', '#2d1a2c'], margin: ['#3f9c7a', '#1f5a44'],
  cavity: ['#b04a3e', '#5a1a14'], scar: '#7c2219', design: '#1f6a6f'
};

// ---------- 解剖分層 ----------
const SUPERFICIAL = ['pecmaj', 'serratus', 'lat_', 'rectus', 'extobl', 'deltoid', 'teres', 'linea_alba'];
function layerOf(name) {
  if (name === 'skin') return 0;
  if (name.startsWith('fat')) return 1;
  if (name.startsWith('gland')) return 2;
  if (SUPERFICIAL.some((p) => name.startsWith(p))) return 3;
  return 4;
}
function side(name) { return name.endsWith('_l') ? 1 : -1; }
function fiberFor(name) {
  const s = side(name);
  if (name.startsWith('pecmaj')) return new THREE.Vector3(0.17 * s, 1.33, 0.03);
  if (name.startsWith('pecmin')) return new THREE.Vector3(0.13 * s, 1.39, 0.03);
  if (name.startsWith('serratus')) return new THREE.Vector3(0.07 * s, 1.3, -0.09);
  if (name.startsWith('lat')) return new THREE.Vector3(0.16 * s, 1.34, 0.0);
  if (name.startsWith('rectus')) return new THREE.Vector3(0.04 * s, 3.0, 0.1);
  if (name.startsWith('extobl')) return new THREE.Vector3(0.0, 0.6, 0.25);
  if (name.startsWith('deltoid')) return new THREE.Vector3(0.19 * s, 1.15, 0.0);
  if (name.startsWith('teres')) return new THREE.Vector3(0.15 * s, 1.3, 0.0);
  if (name.startsWith('intercostal')) return new THREE.Vector3(0.0, 0.5, 0.2);
  return new THREE.Vector3(0, 3, 0);
}
function materialFor(name) {
  if (name === 'skin') return atlasMat('skin', ...PAL.skin, { side: THREE.DoubleSide });
  if (/^(pecmaj|pecmin|serratus|lat_|rectus|extobl|deltoid|teres|intercostal)/.test(name)) return atlasMat('muscle', ...PAL.muscle, { fiber: fiberFor(name) });
  if (name === 'linea_alba') return atlasMat('plain', ...PAL.tendon);
  if (name.startsWith('cart')) return atlasMat('bone', ...PAL.cart);
  if (name === 'omentum') return atlasMat('omentum', ...PAL.omentum, { side: THREE.DoubleSide });
  if (name === 'stomach') return atlasMat('plain', ...PAL.stomach);
  if (name === 'liver') return atlasMat('plain', ...PAL.liver);
  if (name === 'colon') return atlasMat('plain', ...PAL.colon);
  return atlasMat('bone', ...PAL.bone);
}

// ---------- 場景 ----------
const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);
renderer.setScissorTest(true);
const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 10);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.minDistance = 0.18; controls.maxDistance = 2.2;

const CAMS = {
  front: { t: [0, 1.17, 0.05], p: [0, 1.2, 0.95] },
  oblique: { t: [-0.06, 1.25, 0.06], p: [-0.5, 1.33, 0.66] },
  side: { t: [-0.08, 1.24, 0.0], p: [-0.86, 1.3, 0.12] },
  back: { t: [0, 1.22, 0], p: [-0.2, 1.3, -0.9] },
  abdomen: { t: [0, 1.06, 0.06], p: [0.05, 1.15, 0.86] }
};
const VIEW_LABELS = [['front', '正面'], ['oblique', '斜側'], ['side', '側面'], ['back', '背面'], ['abdomen', '腹部']];

let BASE = null; // 載入後的共用資料
const instances = [];

// ---------- 乳房建模 ----------
const SIDES = { R: -1, L: 1 };
const Q_LOCAL = { uoq: [0.038, 0.035], liq: [-0.032, -0.03] };
function sideFrame(s) {
  const f = new THREE.Vector3(0.25 * s, -0.05, 1).normalize();
  return { s, f };
}
function profile(du, dw, p) {
  const shape = p.shape;
  if (shape === 'round') {
    const rx = du > 0 ? 0.075 : 0.068, ry = dw > 0 ? 0.075 : 0.06;
    const r2 = (du / rx) ** 2 + ((dw + 0.004) / ry) ** 2;
    return r2 >= 1 ? 0 : p.P * Math.pow(1 - r2, 0.75);
  }
  const rx = du > 0 ? 0.085 : 0.068, ry = dw > 0 ? 0.095 : 0.062;
  const r2 = (du / rx) ** 2 + ((dw + 0.005) / ry) ** 2;
  if (r2 >= 1) return 0;
  if (shape === 'flat' || p.P < 0.0005) return 0.0015 * (1 - r2);
  let f = Math.pow(1 - r2, 1.35);
  if (dw > 0) f *= 1 - 0.32 * Math.min(dw / ry, 1);
  return p.P * f;
}
function breastField(du, dw, p) {
  let D = profile(du, dw, p);
  const nat = p.shape === 'natural' && p.P > 0.0005;
  if (p.areola && p.P > 0.02) {
    const dn2 = (du - 0.006) ** 2 + (dw + 0.016) ** 2;
    D += 0.004 * Math.exp(-dn2 / (2 * 0.0045 ** 2));
  }
  if (p.defect > 0) {
    const q = Q_LOCAL[p.dq || 'uoq'];
    D -= p.defect * Math.exp(-((du - q[0]) ** 2 + (dw - q[1]) ** 2) / (2 * 0.024 ** 2));
  }
  const drop = nat ? 0.016 * (p.P / 0.064) * Math.max(D / Math.max(p.P, 1e-4), 0) ** 2 : 0;
  return { D, drop };
}

function prepBreastRegions(skinGeom) {
  const pos = skinGeom.attributes.position;
  const regions = {};
  for (const [key, s] of Object.entries(SIDES)) {
    // 找乳房基底中心(胸前皮膚)
    let best = -1, bd = 1e9;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (z < 0.03) continue;
      const d = (x - 0.097 * s) ** 2 + (y - 1.252) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    const c = new THREE.Vector3().fromBufferAttribute(pos, best);
    const idx = [], du = [], dw = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (z < 0.02) continue;
      const a = (x - c.x) * s, b = y - c.y;
      if ((a / 0.1) ** 2 + (b / 0.11) ** 2 > 1.2) continue;
      idx.push(i); du.push(a); dw.push(b);
    }
    regions[key] = { s, c, idx: Int32Array.from(idx), du: Float32Array.from(du), dw: Float32Array.from(dw), frame: sideFrame(s) };
  }
  return regions;
}

function subsetGeometry(skinGeom, region, rMax) {
  const index = skinGeom.index.array;
  const inR = new Map();
  for (let k = 0; k < region.idx.length; k++) {
    const r2 = (region.du[k] / (region.du[k] > 0 ? 0.085 : 0.068)) ** 2 + ((region.dw[k] + 0.005) / (region.dw[k] > 0 ? 0.095 : 0.062)) ** 2;
    if (r2 < rMax * rMax) inR.set(region.idx[k], k);
  }
  const map = new Map(); const src = []; const regionK = []; const tris = [];
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    if (!inR.has(a) || !inR.has(b) || !inR.has(c)) continue;
    for (const v of [a, b, c]) {
      if (!map.has(v)) { map.set(v, src.length); src.push(v); regionK.push(inR.get(v)); }
      tris.push(map.get(v));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(src.length * 3), 3));
  g.setIndex(tris);
  g.userData = { src: Int32Array.from(src), regionK: Int32Array.from(regionK) };
  return g;
}

// ---------- 疤痕 ----------
const SCAR_DEFS = {
  bcs_uoq: { side: 'R', local: [[0.02, 0.06], [0.04, 0.052], [0.055, 0.037], [0.064, 0.02]] },
  axilla: { world: [[-0.135, 1.285, 0.05], [-0.148, 1.3, 0.025], [-0.156, 1.315, 0.0]] },
  imf_medial: { side: 'R', local: [[-0.06, -0.04], [-0.042, -0.056], [-0.02, -0.064], [0.002, -0.066]] },
  mast_line: { side: 'R', local: [[-0.058, 0.0], [-0.02, -0.006], [0.02, -0.007], [0.06, 0.0], [0.078, 0.008]] },
  abd_design: { ellipse: [0, 0.955, 0.125, 0.05], dashed: true },
  abd_line: { world: [[-0.135, 0.955, 0.1], [-0.07, 0.935, 0.12], [0, 0.93, 0.12], [0.07, 0.935, 0.12], [0.135, 0.955, 0.1]] },
  umb: { ellipse: [0.0075, 1.0175, 0.008, 0.008] },
  ports: { marks: [[0.05, 1.1], [-0.055, 1.06], [0.0075, 1.0]] }
};
const raycaster = new THREE.Raycaster();
function projectOnSkin(inst, x, y, zGuess = 0.12) {
  const dirOut = new THREE.Vector3(x, 0, zGuess).normalize();
  const origin = new THREE.Vector3(0, y, 0).addScaledVector(dirOut, 0.6);
  raycaster.set(origin, dirOut.clone().negate());
  raycaster.far = 0.7;
  const hit = raycaster.intersectObject(inst.skin, false)[0];
  if (!hit) return null;
  const n = hit.face.normal.clone();
  return { p: hit.point, n };
}
function buildScars(inst, keys) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: PAL.scar });
  const dmat = new THREE.MeshBasicMaterial({ color: PAL.design });
  const reg = inst.regions.R;
  for (const key of keys) {
    const def = SCAR_DEFS[key]; if (!def) continue;
    let pts3 = [];
    if (def.local) pts3 = def.local.map(([a, b]) => [reg.c.x + reg.s * a, reg.c.y + b, 0.12]);
    else if (def.world) pts3 = def.world;
    else if (def.ellipse) {
      const [cx, cy, rx, ry] = def.ellipse;
      for (let i = 0; i <= 40; i++) { const t = (i / 40) * Math.PI * 2; pts3.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t), 0.12]); }
    } else if (def.marks) {
      for (const [x, y] of def.marks) {
        const h = projectOnSkin(inst, x, y); if (!h) continue;
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 12, 8), mat);
        m.position.copy(h.p).addScaledVector(h.n, 0.0008); m.scale.set(1.6, 0.6, 0.6); g.add(m);
      }
      continue;
    }
    const hits = pts3.map(([x, y, z]) => projectOnSkin(inst, x, y, z)).filter(Boolean);
    if (hits.length < 2) continue;
    const curve = new THREE.CatmullRomCurve3(hits.map((h) => h.p.clone().addScaledVector(h.n, 0.0018)), !!def.ellipse);
    if (def.dashed) {
      const L = curve.getLength(); const n = Math.floor(L / 0.006);
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.0013, 8, 6), dmat);
        m.position.copy(curve.getPointAt(i / n)); g.add(m);
      }
      continue;
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.0011, 6, !!def.ellipse), mat));
    const L = curve.getLength(); const n = Math.max(2, Math.floor(L / 0.008));
    for (let i = 1; i < n; i++) {
      const u = i / n; const p = curve.getPointAt(u); const t = curve.getTangentAt(u);
      const out = p.clone().setY(0).normalize(); const perp = new THREE.Vector3().crossVectors(t, out).normalize();
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.0005, 0.0005, 0.006, 5), mat);
      st.position.copy(p); st.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), perp); g.add(st);
    }
  }
  return g;
}

// ---------- 建立一個病人模型實例 ----------
function tubeFromCurve(points, r) {
  const v = points.map((p) => new THREE.Vector3(...p));
  const clean = v.filter((p, i) => i === 0 || p.distanceTo(v[i - 1]) > 1e-4);
  if (clean.length < 2) return null;
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(clean), Math.max(8, clean.length * 6), r, 6, false);
}

function createInstance() {
  const inst = { root: new THREE.Group(), parts: [], byName: new Map(), state: null, key: {} };
  const scene = new THREE.Scene(); scene.add(inst.root); inst.scene = scene;
  const addPart = (name, mesh, layer, opts = {}) => {
    mesh.name = name; mesh.userData.layer = layer; mesh.userData.info = opts.info || name;
    if (opts.outline !== false) { const o = new THREE.Mesh(mesh.geometry, outlineMat); o.raycast = () => {}; mesh.add(o); mesh.userData.outline = o; }
    inst.root.add(mesh); inst.parts.push(mesh); inst.byName.set(name, mesh); return mesh;
  };
  for (const b of BASE.meshes) {
    const geom = b.name === 'skin' ? b.geometry.clone() : b.geometry;
    addPart(b.name, new THREE.Mesh(geom, materialFor(b.name)), layerOf(b.name));
  }
  inst.skin = inst.byName.get('skin');
  inst.skin.userData.base = Float32Array.from(inst.skin.geometry.attributes.position.array);
  inst.regions = prepBreastRegions(inst.skin.geometry);
  for (const key of ['R', 'L']) {
    const fg = subsetGeometry(inst.skin.geometry, inst.regions[key], 1.0);
    const gg = subsetGeometry(inst.skin.geometry, inst.regions[key], 0.86);
    addPart('fat_' + key, new THREE.Mesh(fg, atlasMat('fat', ...PAL.fat, { side: THREE.DoubleSide })), 1, { info: 'fat', outline: false });
    addPart('gland_' + key, new THREE.Mesh(gg, atlasMat('gland', ...PAL.gland, { side: THREE.DoubleSide })), 2, { info: 'gland', outline: false });
  }
  // 血管
  for (const [name, splines] of Object.entries(BASE.curves)) {
    const kind = /artery|arteries/i.test(name) ? 'artery' : /nerve/i.test(name) ? 'nerve' : 'vein';
    const r = kind === 'artery' ? 0.0019 : kind === 'vein' ? 0.0023 : 0.0013;
    const g = new THREE.Group(); g.name = name; g.userData.layer = 4; g.userData.vessel = true;
    const mat = atlasMat('plain', ...PAL[kind], { hatch: 0 });
    for (const sp of splines) { const tg = tubeFromCurve(sp, r); if (tg) { const m = new THREE.Mesh(tg, mat); m.userData.info = name; m.name = name; g.add(m); } }
    g.userData.mat = mat; inst.root.add(g); inst.byName.set(name, g);
  }
  // 腫瘤、安全邊界、缺損
  const tg = new THREE.IcosahedronGeometry(0.0095, 3); const tp = tg.attributes.position;
  for (let i = 0; i < tp.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(tp, i); v.multiplyScalar(1 + 0.22 * Math.sin(v.x * 900) * Math.cos(v.y * 700) + 0.12 * Math.sin(v.z * 1300)); tp.setXYZ(i, v.x, v.y, v.z); }
  tg.computeVertexNormals();
  inst.tumor = addPart('tumor', new THREE.Mesh(tg, atlasMat('plain', ...PAL.tumor)), 9, { info: 'tumor' });
  inst.margin = addPart('margin', new THREE.Mesh(new THREE.SphereGeometry(0.02, 32, 24), atlasMat('margin', ...PAL.margin, { transparent: true, depthWrite: false, hatch: 0 })), 9, { info: 'margin', outline: false });
  inst.cavity = addPart('cavity', new THREE.Mesh(new THREE.SphereGeometry(0.021, 32, 24), atlasMat('plain', ...PAL.cavity, { side: THREE.BackSide })), 9, { info: 'cavity', outline: false });
  // 皮瓣
  const sph = new THREE.SphereGeometry(1, 48, 32);
  inst.flaps = {
    ld: addPart('flap_ld', new THREE.Mesh(sph, atlasMat('muscle', ...PAL.muscle, { fiber: new THREE.Vector3(-0.17, 1.33, 0.02) })), 9, { info: 'flap_ld' }),
    omentum: addPart('flap_omentum', new THREE.Mesh(sph, atlasMat('omentum', ...PAL.omentum)), 9, { info: 'flap_omentum' }),
    tram: addPart('flap_tram', new THREE.Mesh(sph, atlasMat('flap', ...PAL.skin)), 9, { info: 'flap_tram' }),
    diep: addPart('flap_diep', new THREE.Mesh(sph, atlasMat('flap', ...PAL.skin)), 9, { info: 'flap_diep' })
  };
  inst.pedicle = new THREE.Mesh(new THREE.BufferGeometry(), atlasMat('muscle', ...PAL.muscle, { fiber: new THREE.Vector3(0.04, 3, 0.1) }));
  inst.pedicle.userData.info = 'flap_tram'; inst.root.add(inst.pedicle);
  inst.implant = addPart('implant', new THREE.Mesh(sph, atlasMat('implant', ...PAL.implant, { transparent: true, depthWrite: false })), 9, { info: 'implant' });
  inst.port = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.003, 24), atlasMat('bone', '#c9cfd4', '#6f7880'));
  inst.root.add(inst.port);
  inst.anast = addPart('anast', new THREE.Mesh(new THREE.SphereGeometry(0.0065, 16, 12), atlasMat('plain', '#ffd34d', '#b88a00', { hatch: 0 })), 9, { info: 'anast', outline: false });
  inst.anast.material.depthTest = false; inst.anast.renderOrder = 10;
  inst.scars = new THREE.Group(); inst.root.add(inst.scars);
  computeTargets(inst);
  return inst;
}

function regionBasePoint(inst, key, du, dw) {
  const reg = inst.regions[key]; const base = inst.skin.userData.base;
  let best = 0, bd = 1e9;
  for (let k = 0; k < reg.idx.length; k++) { const d = (reg.du[k] - du) ** 2 + (reg.dw[k] - dw) ** 2; if (d < bd) { bd = d; best = k; } }
  const i = reg.idx[best];
  return new THREE.Vector3(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]);
}

function computeTargets(inst) {
  const f = inst.regions.R.frame.f;
  inst.q = {};
  for (const [k, [a, b]] of Object.entries(Q_LOCAL)) inst.q[k] = regionBasePoint(inst, 'R', a, b).addScaledVector(f, 0.016);
  const mound = regionBasePoint(inst, 'R', 0, -0.004);
  inst.mound = mound.clone().addScaledVector(f, 0.022);
  // 胸大肌表面 → 假體位置
  const pec = inst.byName.get('pecmaj_r');
  raycaster.set(new THREE.Vector3(mound.x, mound.y, 0.5), new THREE.Vector3(0, 0, -1)); raycaster.far = 1;
  const hit = pec ? raycaster.intersectObject(pec, false)[0] : null;
  inst.chestWall = hit ? hit.point.clone().addScaledVector(f, -0.012) : mound.clone().addScaledVector(f, -0.02);
  // 吻合點:內乳動脈約第三肋間
  const ita = BASE.curves['Internal thoracic artery.r']?.[0] || [[-0.03, 1.32, 0.09]];
  let ap = ita[0], bd = 1e9; for (const p of ita) { const d = Math.abs(p[1] - 1.33); if (d < bd) { bd = d; ap = p; } }
  inst.anastPos = new THREE.Vector3(...ap);
  // 皮瓣路徑
  const abd = new THREE.Vector3(0, 0.955, 0.1);
  inst.paths = {
    ld: { curve: new THREE.CatmullRomCurve3([new THREE.Vector3(-0.15, 1.24, 0.0), new THREE.Vector3(-0.16, 1.3, 0.04), new THREE.Vector3(-0.13, 1.33, 0.08), inst.q.uoq.clone()]), s0: new THREE.Vector3(0.03, 0.05, 0.012), s1: new THREE.Vector3(0.026, 0.022, 0.017), anchor: new THREE.Vector3(-0.135, 1.33, -0.005), r: 0.005 },
    omentum: { curve: new THREE.CatmullRomCurve3([new THREE.Vector3(0.0, 1.04, 0.07), new THREE.Vector3(0.0, 1.12, 0.11), new THREE.Vector3(-0.01, 1.2, 0.125), inst.q.liq.clone()]), s0: new THREE.Vector3(0.05, 0.03, 0.01), s1: new THREE.Vector3(0.028, 0.02, 0.016), anchor: new THREE.Vector3(0.02, 1.1, 0.055), r: 0.0035 },
    tram: { curve: new THREE.CatmullRomCurve3([abd.clone(), new THREE.Vector3(0, 0.98, 0.15), new THREE.Vector3(-0.03, 1.12, 0.15), inst.mound.clone()]), s0: new THREE.Vector3(0.125, 0.05, 0.02), s1: new THREE.Vector3(0.066, 0.062, 0.026), anchor: new THREE.Vector3(0.045, 1.2, 0.1), r: 0.009 },
    diep: { curve: new THREE.CatmullRomCurve3([abd.clone(), new THREE.Vector3(0, 0.97, 0.22), new THREE.Vector3(-0.06, 1.12, 0.26), inst.mound.clone()]), s0: new THREE.Vector3(0.125, 0.05, 0.02), s1: new THREE.Vector3(0.066, 0.062, 0.026), anchor: null, r: 0.0016 }
  };
}

// ---------- 狀態 ----------
const BASE_STATE = {
  peel: 0, R: { P: 0.064, shape: 'natural', areola: true, defect: 0, dq: 'uoq', gland: true, fat: true }, L: { P: 0.064, shape: 'natural', areola: true, defect: 0, dq: 'uoq', gland: true, fat: true },
  tq: 'uoq', tumor: 0, margin: 0, cut: 0, scars: [], paddle: 0, wound: 0, ghostSkin: 1, ghostMus: 1, hi: [], vessels: [],
  flap: { kind: null, t: 0, vis: 0 }, imp: { kind: null, fill: 0, vis: 0 }, anast: 0
};
function merge(a, b) {
  if (b === undefined) return structuredClone(a);
  if (Array.isArray(b) || typeof b !== 'object' || b === null) return structuredClone(b);
  const out = structuredClone(a ?? {});
  for (const k of Object.keys(b)) out[k] = (a && typeof a[k] === 'object' && !Array.isArray(a[k]) && a[k] !== null) ? merge(a[k], b[k]) : structuredClone(b[k]);
  return out;
}
function stepState(scnId, i) {
  const scn = SCENARIOS.find((s) => s.id === scnId); const st = scn.steps[i];
  const s = merge(BASE_STATE, st.state);
  s.peel = st.peel ?? 0; s.cam = st.cam || 'front';
  if (s.R.dq === undefined) s.R.dq = s.tq;
  return s;
}
function lerpState(a, b, t) {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * t;
  if (Array.isArray(b) || typeof b !== 'object' || b === null) return b;
  const o = {}; for (const k of Object.keys(b)) o[k] = lerpState(a?.[k], b[k], t); return o;
}
function prepareFrom(from, to) {
  const f = structuredClone(from);
  if (to.flap.kind && f.flap.kind !== to.flap.kind) f.flap = { kind: to.flap.kind, t: 0, vis: to.flap.vis };
  if (!to.flap.kind && f.flap.kind) to.flap = { ...f.flap, vis: 0 };
  if (to.imp.kind && !f.imp.kind) f.imp = { kind: to.imp.kind, fill: 0, vis: 0 };
  if (to.imp.kind && f.imp.kind && f.imp.kind !== to.imp.kind) f.imp.kind = to.imp.kind;
  if (!to.imp.kind && f.imp.kind) to.imp = { ...f.imp, vis: 0 };
  return f;
}

// ---------- 套用狀態 ----------
function updateBreasts(inst, s) {
  const k = JSON.stringify([s.R, s.L]);
  if (inst.key.breast === k) return false;
  inst.key.breast = k;
  const geom = inst.skin.geometry; const arr = geom.attributes.position.array; const base = inst.skin.userData.base;
  arr.set(base);
  inst.nipple = {};
  for (const key of ['R', 'L']) {
    const reg = inst.regions[key]; const p = s[key]; const f = reg.frame.f;
    let maxD = -1, maxI = -1;
    for (let j = 0; j < reg.idx.length; j++) {
      const i = reg.idx[j]; const { D, drop } = breastField(reg.du[j], reg.dw[j], p);
      arr[i * 3] += f.x * D; arr[i * 3 + 1] += f.y * D - drop; arr[i * 3 + 2] += f.z * D;
      const dn = (reg.du[j] - 0.006) ** 2 + (reg.dw[j] + 0.016) ** 2;
      if (D > 0.01 && dn < 0.0004 && D - dn * 20 > maxD) { maxD = D - dn * 20; maxI = i; }
    }
    inst.nipple[key] = maxI >= 0 && p.areola ? new THREE.Vector3(arr[maxI * 3], arr[maxI * 3 + 1], arr[maxI * 3 + 2]) : null;
    // 脂肪與乳腺殼
    for (const [part, scale, off] of [['fat_', 1, -0.004], ['gland_', 0.72, -0.006]]) {
      const m = inst.byName.get(part + key); const g = m.geometry; const pa = g.attributes.position.array; const { src, regionK } = g.userData;
      for (let v = 0; v < src.length; v++) {
        const i = src[v], j = regionK[v]; const { D, drop } = breastField(reg.du[j], reg.dw[j], p);
        const d = Math.max(D * scale + off, -0.003);
        pa[v * 3] = base[i * 3] + f.x * d; pa[v * 3 + 1] = base[i * 3 + 1] + f.y * d - drop * scale; pa[v * 3 + 2] = base[i * 3 + 2] + f.z * d;
      }
      g.attributes.position.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
      m.userData.sideP = p.P;
    }
  }
  geom.attributes.position.needsUpdate = true; geom.computeVertexNormals(); geom.computeBoundingSphere(); geom.computeBoundingBox();
  // 皮島:放在乳房中央
  const mu = inst.skin.material.uniforms;
  const nR = regionBasePoint(inst, 'R', 0.004, -0.008).addScaledVector(inst.regions.R.frame.f, Math.max(breastField(0.004, -0.008, s.R).D, 0));
  inst.paddleCenter = nR;
  mu.uPaddle.value.set(nR.x, nR.y, nR.z, mu.uPaddle.value.w);
  return true;
}

function setOpacity(mesh, op) {
  const mats = [];
  mesh.traverse((o) => { if (o.material && o.material.uniforms?.uOpacity) mats.push(o.material); });
  for (const m of new Set(mats)) {
    m.uniforms.uOpacity.value = op;
    const tr = op < 0.995 || m.userData.alwaysTransparent;
    if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
    m.depthWrite = op > 0.6;
  }
  mesh.visible = op > 0.01;
  if (mesh.userData.outline) mesh.userData.outline.visible = op > 0.97;
}

function applyState(inst, s) {
  inst.state = s;
  const changed = updateBreasts(inst, s);
  const peel = s.peel;
  for (const m of inst.parts) {
    const L = m.userData.layer; if (L === undefined || L > 4) continue;
    let op = L < 4 ? Math.min(Math.max(L + 1 - peel, 0), 1) : 1;
    if (L === 0) op *= s.ghostSkin;
    if (L === 3) op *= s.ghostMus;
    if (m.name.startsWith('fat_') || m.name.startsWith('gland_')) { const sd = s[m.name.slice(-1)]; if (sd.P < 0.008 || !sd[m.name.startsWith('fat_') ? 'fat' : 'gland'] || s.ghostSkin < 0.9 || peel < 0.3) op = 0; }
    setOpacity(m, op);
    if (m.material.uniforms) m.material.uniforms.uHi.value = s.hi.some((h) => m.name.startsWith(h)) ? 1 : 0;
  }
  const deep = peel >= 1.5 || s.ghostSkin < 0.9 || s.ghostMus < 0.9;
  for (const [name, obj] of inst.byName) if (obj.userData.vessel) { obj.userData.mat.uniforms.uHi.value = s.vessels.includes(name) ? 1 : 0; obj.visible = deep; }
  // 乳暈、皮島、傷口
  const mu = inst.skin.material.uniforms;
  const nR = inst.nipple?.R, nL = inst.nipple?.L;
  mu.uAreR.value.set(nR?.x || 0, nR?.y || 0, nR?.z || 0, nR ? 0.017 : 0);
  mu.uAreL.value.set(nL?.x || 0, nL?.y || 0, nL?.z || 0, nL ? 0.017 : 0);
  mu.uPaddle.value.w = s.paddle;
  mu.uWound.value.w = s.wound;
  // 腫瘤與缺損
  const q = inst.q[s.tq];
  inst.tumor.position.copy(q); inst.margin.position.copy(q); inst.cavity.position.copy(q);
  setOpacity(inst.tumor, peel >= 1.5 || s.ghostSkin < 0.9 ? s.tumor : 0);
  setOpacity(inst.margin, peel >= 1.5 ? s.margin * (1 - s.cut) : 0);
  const filled = s.flap.kind && (s.flap.kind === 'ld' || s.flap.kind === 'omentum') && s.flap.t > 0.98;
  setOpacity(inst.cavity, peel >= 1.5 && s.cut > 0.01 && !filled ? Math.min(s.cut, 1) : 0);
  for (const key of ['fat_R', 'gland_R']) inst.byName.get(key).material.uniforms.uCut.value.set(q.x, q.y, q.z, 0.021 * s.cut);
  // 皮瓣
  for (const [k, m] of Object.entries(inst.flaps)) {
    if (s.flap.kind !== k || s.flap.vis < 0.01) { setOpacity(m, 0); continue; }
    const path = inst.paths[k]; const t = THREE.MathUtils.smoothstep(s.flap.t, 0, 1);
    m.position.copy(path.curve.getPointAt(t));
    const sc = path.s0.clone().lerp(path.s1, THREE.MathUtils.smoothstep(t, 0.55, 1)); m.scale.copy(sc);
    const fwd = t < 0.5 ? new THREE.Vector3(0, 0, 1) : inst.regions.R.frame.f.clone();
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), fwd.normalize());
    if (k === 'tram' || k === 'diep') m.material.uniforms.uFiber.value.copy(fwd);
    // 局部填補在皮膚之下:皮膚顯示時隱藏
    const under = (k === 'ld' || k === 'omentum') ? (peel >= 1.5 || s.ghostSkin < 0.9 ? 1 : 0) : (t > 0.98 && peel < 0.5 && s.ghostSkin > 0.9 ? 0 : 1);
    setOpacity(m, s.flap.vis * under);
  }
  updatePedicle(inst, s);
  // 假體
  if (s.imp.kind && s.imp.vis > 0.01) {
    const f = inst.regions.R.frame.f; const fill = s.imp.fill; const half = 0.004 + 0.016 * fill;
    inst.implant.position.copy(inst.chestWall).addScaledVector(f, half);
    inst.implant.scale.set(0.054, 0.05, half); inst.implant.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), f);
    inst.implant.userData.info = s.imp.kind;
    const col = s.imp.kind === 'expander' ? PAL.expander : PAL.implant;
    inst.implant.material.uniforms.uColor.value.set(col[0]); inst.implant.material.uniforms.uShade.value.set(col[1]);
    const vis = peel >= 0.5 || s.ghostSkin < 0.9 ? s.imp.vis * 0.9 : 0;
    setOpacity(inst.implant, vis); inst.implant.material.userData.alwaysTransparent = true;
    inst.port.visible = s.imp.kind === 'expander' && vis > 0.01;
    inst.port.position.copy(inst.implant.position).addScaledVector(f, half + 0.001).add(new THREE.Vector3(0, -0.012, 0));
    inst.port.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), f);
  } else { setOpacity(inst.implant, 0); inst.port.visible = false; }
  // 吻合點
  inst.anast.position.copy(inst.anastPos); setOpacity(inst.anast, s.anast);
  inst.anast.scale.setScalar(1 + 0.35 * Math.sin(TIME.value * 4));
  // 疤痕
  const sk = JSON.stringify([s.scars, inst.key.breast]);
  if (inst.key.scars !== sk) {
    inst.key.scars = sk; inst.root.remove(inst.scars);
    inst.scars.traverse((o) => o.geometry?.dispose());
    inst.scars = buildScars(inst, s.scars); inst.root.add(inst.scars);
  }
  inst.scars.visible = peel < 0.5 && s.ghostSkin > 0.3;
  return changed;
}

function updatePedicle(inst, s) {
  const k = s.flap.kind; const path = k && inst.paths[k];
  const show = path && s.flap.vis > 0.01 && (path.anchor || s.anast > 0.01) && (peel(s) || k === 'tram');
  if (!show) { inst.pedicle.visible = false; return; }
  const end = inst.flaps[k].position.clone();
  const start = path.anchor ? path.anchor.clone() : inst.anastPos.clone();
  const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0, 0.02));
  inst.pedicle.geometry.dispose();
  inst.pedicle.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([start, mid, end]), 24, path.r, 8, false);
  const mu = inst.pedicle.material.uniforms;
  const col = k === 'omentum' ? PAL.omentum : k === 'diep' ? PAL.artery : PAL.muscle;
  mu.uColor.value.set(col[0]); mu.uShade.value.set(col[1]); mu.uKind.value = k === 'omentum' ? KIND.omentum : k === 'diep' ? KIND.plain : KIND.muscle;
  inst.pedicle.userData.info = k === 'omentum' ? 'gastro-omental' : k === 'diep' ? 'anast' : k === 'ld' ? 'Thoracodorsal' : 'flap_tram';
  inst.pedicle.visible = true;
  setOpacity(inst.pedicle, s.flap.vis);
}
function peel(s) { return s.peel >= 1.5 || s.ghostSkin < 0.9 || s.ghostMus < 0.9; }

// ---------- 介面 ----------
const ui = {
  tabs: document.getElementById('tabs'), steps: document.getElementById('steps'), stepText: document.getElementById('stepText'),
  scnTag: document.getElementById('scnTag'), scnName: document.getElementById('scnName'), scnOne: document.getElementById('scnOne'),
  prev: document.getElementById('prev'), next: document.getElementById('next'), peel: document.getElementById('peel'), peelName: document.getElementById('peelName'),
  views: document.getElementById('views'), mSingle: document.getElementById('m-single'), mCompare: document.getElementById('m-compare'),
  cmpbar: document.getElementById('cmpbar'), cmplabels: document.getElementById('cmplabels'), selA: document.getElementById('selA'), selB: document.getElementById('selB'),
  cmpA: document.getElementById('cmpA'), cmpB: document.getElementById('cmpB'), loading: document.getElementById('loading'), callout: document.getElementById('callout'),
  infoName: document.getElementById('infoName'), infoEn: document.getElementById('infoEn'), infoText: document.getElementById('infoText'), infoClin: document.getElementById('infoClin'),
  pros: document.getElementById('pros'), cons: document.getElementById('cons'), fit: document.getElementById('fit'), pcTitle: document.getElementById('pcTitle'), table: document.getElementById('cmpTable')
};
const app = { scn: 'bcs', step: 0, mode: 'single', peelOverride: null, tween: null, camTween: null, pick: null };

function el(tag, attrs = {}, text) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text !== undefined) e.textContent = text; return e; }

function buildUI() {
  for (const s of SCENARIOS) {
    const b = el('button', { class: 'tab', 'aria-pressed': 'false', 'data-id': s.id }); b.textContent = s.short;
    b.addEventListener('click', () => selectScenario(s.id)); ui.tabs.append(b);
  }
  for (const [id, label] of VIEW_LABELS) {
    const b = el('button', { class: 'ctl', 'aria-pressed': 'false', 'data-v': id }, label);
    b.addEventListener('click', () => flyTo(id)); ui.views.append(b);
  }
  for (const sel of [ui.selA, ui.selB]) for (const e of END_STATES) sel.append(el('option', { value: e.id }, e.label));
  ui.selA.addEventListener('change', setupCompare); ui.selB.addEventListener('change', setupCompare);
  ui.prev.addEventListener('click', () => goStep(app.step - 1));
  ui.next.addEventListener('click', () => goStep(app.step + 1));
  ui.peel.addEventListener('input', () => { app.peelOverride = Number(ui.peel.value); ui.peelName.textContent = LAYER_NAMES[app.peelOverride]; for (const i of instances) { if (i.target) i.target.peel = app.peelOverride; } });
  ui.mSingle.addEventListener('click', () => setMode('single'));
  ui.mCompare.addEventListener('click', () => setMode('compare'));
  // 對照表
  const thead = el('thead'); const hr = el('tr'); hr.append(el('th')); for (const c of TABLE.cols) hr.append(el('th', {}, c)); thead.append(hr);
  const tbody = el('tbody'); for (const r of TABLE.rows) { const tr = el('tr'); tr.append(el('th', {}, r[0])); for (const c of r.slice(1)) tr.append(el('td', {}, c)); tbody.append(tr); }
  ui.table.append(thead, tbody);
}

function selectScenario(id) {
  app.scn = id; app.step = 0;
  const scn = SCENARIOS.find((s) => s.id === id);
  for (const b of ui.tabs.children) b.setAttribute('aria-pressed', String(b.dataset.id === id));
  ui.scnTag.textContent = scn.tag; ui.scnName.textContent = scn.name; ui.scnOne.textContent = scn.one;
  ui.steps.replaceChildren(...scn.steps.map((st, i) => {
    const li = el('li'); const b = el('button'); b.append(el('span', { class: 'n' }, String(i + 1)), el('span', {}, st.title));
    b.addEventListener('click', () => goStep(i)); li.append(b); return li;
  }));
  ui.pcTitle.textContent = scn.name + ':優點與限制';
  for (const [k, list] of [['pros', scn.pros], ['cons', scn.cons], ['fit', scn.fit]]) ui[k].replaceChildren(...list.map((t) => el('li', {}, t)));
  const [a, b] = COMPARE_DEFAULT[id]; ui.selA.value = a; ui.selB.value = b;
  if (app.mode === 'compare') setupCompare(); else goStep(0, true);
}

function goStep(i, instant = false) {
  const scn = SCENARIOS.find((s) => s.id === app.scn);
  i = Math.max(0, Math.min(scn.steps.length - 1, i)); app.step = i;
  if (app.mode !== 'single') setMode('single');
  ui.steps.querySelectorAll('button').forEach((b, k) => { if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
  ui.stepText.textContent = scn.steps[i].text;
  ui.prev.disabled = i === 0; ui.next.disabled = i === scn.steps.length - 1;
  app.peelOverride = null;
  const to = stepState(app.scn, i);
  ui.peel.value = String(Math.round(to.peel)); ui.peelName.textContent = LAYER_NAMES[Math.round(to.peel)];
  transition(instances[0], to, instant ? 0 : (scn.steps[i].dur || 1300));
  flyTo(to.cam, instant);
}

function transition(inst, to, dur) {
  const from = inst.state ? prepareFrom(inst.target || inst.state, to) : to;
  inst.target = to; inst.tween = { from, to, t0: performance.now(), dur };
  if (!dur) { inst.tween = null; applyState(inst, to); }
}

function flyTo(id, instant = false) {
  const c = CAMS[id]; if (!c) return;
  for (const b of ui.views.children) b.setAttribute('aria-pressed', String(b.dataset.v === id));
  const toT = new THREE.Vector3(...c.t); const toP = new THREE.Vector3(...c.p);
  const v = viewports()[0]; const aspect = v.w / Math.max(v.h, 1);
  if (aspect < 1.2) toP.sub(toT).multiplyScalar(Math.pow(1.2 / aspect, 0.85)).add(toT);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (instant || reduce) { camera.position.copy(toP); controls.target.copy(toT); controls.update(); app.camTween = null; return; }
  app.camTween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: toP, t1: toT, s: performance.now(), dur: 1100 };
}

function endState(id) { const e = END_STATES.find((x) => x.id === id); return stepState(e.from[0], e.from[1]); }
function setMode(mode) {
  app.mode = mode;
  ui.mSingle.setAttribute('aria-pressed', String(mode === 'single')); ui.mCompare.setAttribute('aria-pressed', String(mode === 'compare'));
  ui.cmpbar.hidden = mode !== 'compare'; ui.cmplabels.hidden = mode !== 'compare';
  if (mode === 'compare') setupCompare(); else { const to = stepState(app.scn, app.step); transition(instances[0], to, 600); }
  resize();
}
function setupCompare() {
  if (app.mode !== 'compare') return;
  const pv = app.peelOverride ?? 0;
  const a = endState(ui.selA.value), b = endState(ui.selB.value); a.peel = pv; b.peel = pv;
  transition(instances[0], a, 900); transition(instances[1], b, 900);
  ui.cmpA.textContent = END_STATES.find((e) => e.id === ui.selA.value).label;
  ui.cmpB.textContent = END_STATES.find((e) => e.id === ui.selB.value).label;
  if (!app.camTween) flyTo('oblique');
}

// ---------- 點選說明 ----------
function infoKey(obj) {
  const n = obj.userData.info || obj.name || '';
  if (INFO[n]) return n;
  for (const k of Object.keys(INFO)) if (n.startsWith(k) || n.includes(k)) return k;
  return null;
}
function showInfo(key, point, inst) {
  const d = INFO[key]; if (!d) return;
  ui.infoName.textContent = d.zh; ui.infoEn.textContent = d.en; ui.infoText.textContent = d.text || '';
  ui.infoClin.hidden = !d.clin; ui.infoClin.textContent = d.clin ? '臨床重點:' + d.clin : '';
  app.pick = { point: point.clone(), label: d.zh, inst };
}
let downXY = null;
canvas.addEventListener('pointerdown', (e) => { downXY = [e.clientX, e.clientY]; canvas.style.cursor = 'grabbing'; });
canvas.addEventListener('pointerup', (e) => {
  canvas.style.cursor = 'grab';
  if (!downXY || Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]) > 6) return;
  const r = canvas.getBoundingClientRect(); const vp = viewports();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  const k = vp.findIndex((v) => x >= v.x && x <= v.x + v.w && y >= r.height - v.y - v.h && y <= r.height - v.y);
  if (k < 0) return; const v = vp[k]; const inst = instances[k];
  camera.aspect = v.w / v.h; camera.updateProjectionMatrix();
  const ndc = new THREE.Vector2(((x - v.x) / v.w) * 2 - 1, -((y - (r.height - v.y - v.h)) / v.h) * 2 + 1);
  raycaster.setFromCamera(ndc, camera); raycaster.far = 10;
  const hits = raycaster.intersectObject(inst.root, true).filter((h) => {
    let o = h.object; while (o && o !== inst.root) { if (!o.visible) return false; o = o.parent; }
    const op = h.object.material?.uniforms?.uOpacity?.value ?? 1; return op > 0.3 && h.object.material !== outlineMat;
  });
  for (const h of hits) { let o = h.object; let key = infoKey(o); if (!key && o.parent) key = infoKey(o.parent); if (key) { showInfo(key, h.point, inst); return; } }
});

// ---------- 版面與繪製 ----------
function viewports() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (app.mode !== 'compare') return [{ x: 0, y: 0, w, h }];
  if (w < 640) return [{ x: 0, y: h / 2, w, h: h / 2 }, { x: 0, y: 0, w, h: h / 2 }];
  return [{ x: 0, y: 0, w: w / 2, h }, { x: w / 2, y: 0, w: w / 2, h }];
}
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) renderer.setSize(w, h, false);
  ui.cmplabels.style.flexDirection = w < 640 ? 'column' : 'row';
}
window.addEventListener('resize', resize);

function frame(now) {
  TIME.value = now / 1000;
  for (const inst of instances) {
    if (inst.tween) {
      const { from, to, t0, dur } = inst.tween; let t = Math.min((now - t0) / dur, 1);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const s = lerpState(from, to, e);
      if (app.peelOverride !== null) s.peel = app.peelOverride;
      applyState(inst, s);
      if (t >= 1) inst.tween = null;
    } else if (inst.target) {
      const s = inst.target; if (app.peelOverride !== null) s.peel = app.peelOverride;
      applyState(inst, s);
    }
  }
  if (app.camTween) {
    const c = app.camTween; let t = Math.min((now - c.s) / c.dur, 1); const e = 1 - (1 - t) ** 3;
    camera.position.lerpVectors(c.p0, c.p1, e); controls.target.lerpVectors(c.t0, c.t1, e);
    if (t >= 1) app.camTween = null;
  }
  controls.update();
  resize();
  const vps = viewports(); const H = canvas.clientHeight;
  renderer.setScissorTest(false); renderer.clear(); renderer.setScissorTest(true);
  vps.forEach((v, k) => {
    renderer.setViewport(v.x, v.y, v.w, v.h); renderer.setScissor(v.x, v.y, v.w, v.h);
    camera.aspect = v.w / v.h; camera.updateProjectionMatrix();
    renderer.render(instances[k].scene, camera);
  });
  // 標籤
  if (app.pick && app.pick.inst === instances[0] || (app.pick && app.mode === 'compare')) {
    const k = instances.indexOf(app.pick.inst); const v = vps[k];
    if (v) {
      camera.aspect = v.w / v.h; camera.updateProjectionMatrix();
      const p = app.pick.point.clone().project(camera);
      const sx = v.x + (p.x + 1) / 2 * v.w, sy = H - v.y - (p.y + 1) / 2 * v.h;
      const ok = p.z < 1 && sx > 0 && sx < canvas.clientWidth && sy > 0 && sy < H;
      ui.callout.hidden = !ok; if (ok) { ui.callout.style.left = sx + 'px'; ui.callout.style.top = sy + 'px'; ui.callout.textContent = app.pick.label; }
    } else ui.callout.hidden = true;
  } else ui.callout.hidden = true;
  requestAnimationFrame(frame);
}

// 去除原始男性模型的乳頭凸點:以周圍環帶擬合二次曲面,取代中心區的深度
function flattenMaleNipples(geom) {
  const pos = geom.attributes.position.array; const n = pos.length / 3;
  for (const s of [-1, 1]) {
    // 找乳頭:乳房區內最凸出的點
    let ci = -1, best = -1;
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      if (z < 0.05 || (x - 0.105 * s) ** 2 + (y - 1.285) ** 2 > 0.03 ** 2) continue;
      const score = z - 0.25 * Math.abs(x) ; if (score > best) { best = score; ci = i; }
    }
    if (ci < 0) continue;
    const cx = pos[ci * 3], cy = pos[ci * 3 + 1];
    const A = [], B = [];
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3] - cx, y = pos[i * 3 + 1] - cy, z = pos[i * 3 + 2]; if (z < 0.03) continue;
      const r = Math.hypot(x, y); if (r < 0.036 || r > 0.07) continue;
      A.push([1, x, y, x * x, y * y, x * y]); B.push(z);
    }
    const c = lstsq(A, B); if (!c) continue;
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3] - cx, y = pos[i * 3 + 1] - cy; if (pos[i * 3 + 2] < 0.03) continue;
      const r = Math.hypot(x, y); if (r > 0.036) continue;
      const fit = c[0] + c[1] * x + c[2] * y + c[3] * x * x + c[4] * y * y + c[5] * x * y;
      const w = r < 0.026 ? 1 : 1 - (r - 0.026) / 0.01;
      pos[i * 3 + 2] += (fit - pos[i * 3 + 2]) * w;
    }
  }
  geom.attributes.position.needsUpdate = true; geom.computeVertexNormals();
}
function lstsq(A, B) {
  const m = A[0]?.length; if (!m || A.length < m) return null;
  const M = Array.from({ length: m }, () => new Array(m + 1).fill(0));
  for (let r = 0; r < A.length; r++) for (let i = 0; i < m; i++) { for (let j = 0; j < m; j++) M[i][j] += A[r][i] * A[r][j]; M[i][m] += A[r][i] * B[r]; }
  for (let i = 0; i < m; i++) {
    let p = i; for (let k = i + 1; k < m; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
    [M[i], M[p]] = [M[p], M[i]]; if (Math.abs(M[i][i]) < 1e-14) return null;
    for (let k = 0; k < m; k++) { if (k === i) continue; const f = M[k][i] / M[i][i]; for (let j = i; j <= m; j++) M[k][j] -= f * M[i][j]; }
  }
  return M.map((row, i) => row[m] / row[i]);
}

// ---------- 載入 ----------
// 優先讀 chest.glb;若主機不提供 .glb,改讀 base64 包裝的 chest-glb.json
async function loadModel() {
  let buf = null;
  try { const r = await fetch('chest.glb'); if (r.ok && !(r.headers.get('content-type') || '').includes('text/html')) buf = await r.arrayBuffer(); } catch (e) { buf = null; }
  if (!buf || buf.byteLength < 1000) {
    const j = await (await fetch('chest-glb.json')).json();
    const bin = atob(j.data); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); buf = u8.buffer;
  }
  return new GLTFLoader().parseAsync(buf, '');
}
async function boot() {
  buildUI();
  const [gltf, meta] = await Promise.all([loadModel(), fetch('meta.json').then((r) => r.json())]);
  const meshes = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.index) { const idx = []; for (let i = 0; i < g.attributes.position.count; i++) idx.push(i); g.setIndex(idx); }
    meshes.push({ name: o.name || o.parent?.name, geometry: g });
  });
  const skin = meshes.find((m) => m.name === 'skin');
  if (skin) flattenMaleNipples(skin.geometry);
  BASE = { meshes, curves: meta.curves };
  instances.push(createInstance(), createInstance());
  ui.loading.hidden = true;
  resize();
  selectScenario('bcs');
  requestAnimationFrame(frame);
}
boot().catch((err) => { ui.loading.textContent = '模型載入失敗:' + err.message; console.error(err); });
