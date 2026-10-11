import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SCENARIOS as BASE_SCENARIOS, END_STATES as BASE_END, COMPARE_DEFAULT, INFO, LAYER_NAMES, PERF_MAP } from './content.js';
import { CATS, BASE_META, EXTRA_SCENARIOS, TECH_BY_ID, DONORS, ZONE_L3 } from './techniques.js';
const SCENARIOS = [...BASE_SCENARIOS.map((s) => ({ ...s, ...(BASE_META[s.id] || {}) })), ...EXTRA_SCENARIOS];
const END_STATES = [...BASE_END, ...EXTRA_SCENARIOS.filter((x) => !BASE_END.some((e) => e.id === x.id)).map((x) => ({ id: x.id, label: x.short, from: [x.id, x.steps.length - 1] }))];
import { CONFIG, INCISIONS, ZONES, analyze, incisionPaths, postShape } from './oncoplasty.js';
import { PRESETS, QN } from './compare.js';

THREE.ColorManagement.enabled = false;

// ---------- 彩繪圖譜著色器 ----------
const TIME = { value: 0 };
const INK = new THREE.Color('#2a1e18');

const VERT = `
varying vec3 vW; varying vec3 vN;
void main(){
  vec4 lp = vec4(position, 1.0); vec3 ln = normal;
#ifdef USE_INSTANCING
  lp = instanceMatrix * lp; ln = mat3(instanceMatrix) * ln;
#endif
  vec4 w = modelMatrix * lp;
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * ln);
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
  c = mix(c, c * 0.84, hatch * (1.0 - tone) * (k == 0 ? 0.18 : 0.5) * uHatch);
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

// ---------- 腋下淋巴結 ----------
const NODE_COL = { I: ['#9ccc65', '#4e7a2a'], II: ['#f0a848', '#8a5a16'], III: ['#d9604a', '#7a2416'], IMN: ['#a59be6', '#4a3f8a'] };
function nodeLevel(name) { return name.startsWith('nodes_III') ? 'III' : name.startsWith('nodes_II') ? 'II' : name.startsWith('nodes_I') ? 'I' : 'IMN'; }
// 把一個含多顆淋巴結的網格拆成各自獨立的淋巴結
function splitComponents(geom) {
  const idx = geom.index.array; const n = geom.attributes.position.count; const parent = Int32Array.from({ length: n }, (_, i) => i);
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  for (let t = 0; t < idx.length; t += 3) { const a = find(idx[t]), b = find(idx[t + 1]), c = find(idx[t + 2]); parent[b] = a; parent[find(c)] = a; }
  // 位置相同的頂點也合併(glTF 會在法線接縫處拆頂點)
  const pos = geom.attributes.position; const key = new Map();
  for (let i = 0; i < n; i++) { const k = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`; if (key.has(k)) { const a = find(key.get(k)), b = find(i); parent[b] = a; } else key.set(k, i); }
  const groups = new Map();
  for (let t = 0; t < idx.length; t += 3) { const r = find(idx[t]); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(idx[t], idx[t + 1], idx[t + 2]); }
  return [...groups.values()].filter((g) => g.length >= 24).map((tris) => { const g = geom.clone(); g.setIndex(tris); g.computeBoundingSphere(); return g; });
}

// ---------- 解剖分層 ----------
const LIMB = /^(gracilis|vastlat|rectfem|sartorius|tfl|addlong|glutmax|femur|humerus|deltoid|teres|hip_|scapula|clavicle)/;
const LIMB_V = /femoral|gluteal|circumflex|Perforating|Cephalic|Brachial|Axillary nerve/i;
const SUPERFICIAL = ['pecmaj', 'serratus', 'lat_', 'rectus', 'extobl', 'deltoid', 'teres', 'linea_alba', 'glutmax', 'gracilis', 'vastlat', 'rectfem', 'sartorius', 'tfl', 'addlong'];
function layerOf(name) {
  if (name.startsWith('nodes_')) return 9;
  if (name === 'skin' || name === 'skin_arm') return 0;
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
  if (name.startsWith('glutmax')) return new THREE.Vector3(0.17 * s, 0.75, -0.02);
  if (/^(gracilis|vastlat|rectfem|addlong)/.test(name)) return new THREE.Vector3(0.09 * s, -1.0, 0.0);
  if (name.startsWith('sartorius')) return new THREE.Vector3(0.0, -1.0, 0.05);
  if (name.startsWith('tfl')) return new THREE.Vector3(0.14 * s, 0.4, 0.0);
  if (name.startsWith('intobl')) return new THREE.Vector3(0.0, 1.4, 0.25);
  return new THREE.Vector3(0, 3, 0);
}
function materialFor(name) {
  if (name === 'skin' || name === 'skin_arm') return atlasMat('skin', ...PAL.skin, { side: THREE.DoubleSide });
  if (name.startsWith('nodes_')) { const c = NODE_COL[nodeLevel(name)]; return atlasMat('plain', c[0], c[1]); }
  if (/^(pecmaj|pecmin|serratus|lat_|rectus|extobl|intobl|deltoid|teres|intercostal|glutmax|gracilis|vastlat|rectfem|sartorius|tfl|addlong)/.test(name)) return atlasMat('muscle', ...PAL.muscle, { fiber: fiberFor(name) });
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
  abdomen: { t: [0, 1.06, 0.06], p: [0.05, 1.15, 0.86] },
  perf: { t: [0, 0.99, 0.1], p: [0.0, 1.03, 0.6] },
  perfObl: { t: [-0.012, 0.99, 0.095], p: [-0.24, 1.03, 0.29] },
  full: { t: [0, 1.0, 0.02], p: [-0.35, 1.15, 1.9] },
  backLow: { t: [0, 0.9, -0.05], p: [-0.35, 1.05, -1.05] },
  thigh: { t: [-0.06, 0.74, 0.04], p: [-0.35, 0.88, 0.95] },
  thighIn: { t: [-0.05, 0.76, 0.0], p: [0.45, 0.86, 0.75] },
  thighBack: { t: [-0.07, 0.78, -0.05], p: [-0.3, 0.88, -0.95] },
  lateral: { t: [-0.12, 1.2, 0.0], p: [-0.95, 1.25, 0.25] },
  backLat: { t: [-0.12, 1.2, -0.05], p: [-0.8, 1.3, -0.6] },
  axilla: { t: [-0.125, 1.315, 0.005], p: [-0.37, 1.25, 0.31] },
  torso: { t: [-0.03, 1.13, 0.05], p: [-0.28, 1.21, 1.3] },
  glandZoom: { t: [-0.1, 1.245, 0.13], p: [-0.21, 1.275, 0.42] },
  simL: { t: [0.085, 1.24, 0.1], p: [0.2, 1.29, 0.78] },
  simR: { t: [-0.085, 1.24, 0.1], p: [-0.2, 1.29, 0.78] }
};
const VIEW_LABELS = [['front', '正面'], ['oblique', '斜側'], ['side', '側面'], ['back', '背面'], ['abdomen', '腹部']];

let BASE = null; // 載入後的共用資料
const instances = [];

// ---------- 乳房建模 ----------
const SIDES = { R: -1, L: 1 };
// 象限位置:相對乳頭(du 向外側為正、dw 向上為正,公尺;依乳房大小縮放)
const Q_N = QN;
function sideFrame(s) {
  const f = new THREE.Vector3(0.25 * s, -0.05, 1).normalize();
  return { s, f };
}

// ---------- 病人條件:量測值(或罩杯快選)、年齡、下垂程度、上下極比例 ----------
// 罩杯 = 上胸圍 − 下胸圍(台灣/日本尺碼,每 2.5 cm 一級)
const CUP_D = { A: 10, B: 12.5, C: 15, D: 17.5, E: 20, F: 22.5 };
const cupOf = (d) => { const ks = Object.keys(CUP_D); let best = ks[0]; for (const k of ks) if (Math.abs(CUP_D[k] - d) < Math.abs(CUP_D[best] - d)) best = k; return d < 8.75 ? 'AA' : d > 23.75 ? 'G+' : best; };
// 預設略為美化(較挺、上半部較飽滿),讓病人看到的外形有心理支持;仍可在面板調整
// 預設為「挺」的理想外形(衛教的心理支持);年齡選項才帶入下垂
const AGE_DEF = { ideal: { pt: 0, full: 0.85 }, y: { pt: 0.3, full: 0.7 }, m: { pt: 0.6, full: 0.6 }, o: { pt: 1.2, full: 0.45 }, e: { pt: 1.8, full: 0.35 } };
const PROFILE = { mode: 'cup', cup: 'C', age: 'ideal', pt: 0, ratio: 0.45, full: 0.85, ver: 0,
  height: 160, weight: 55, underbust: 75, bust: 90, snn: 19, nn: 19, imd: 3, snu: 40 };
// 美學比例(Hwang 2015,西洋繪畫分析;Penn 1955 等邊三角形):胸骨上切跡到乳頭 ≈ 兩乳頭間距 ≈ 0.46 × 胸骨上切跡到肚臍
const idealSNN = (snu) => 0.46 * snu;
const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
const clampN = (v, a, b) => Math.min(Math.max(v, a), b);
// 量測值(cm)。罩杯快選時,其他距離用該罩杯的常見值
function measures() {
  if (PROFILE.mode === 'meas') {
    return { d: clampN(PROFILE.bust - PROFILE.underbust, 5, 30), ub: clampN(PROFILE.underbust, 60, 120), snn: clampN(PROFILE.snn, 14, 40), nn: clampN(PROFILE.nn, 14, 32), imd: clampN(PROFILE.imd, 0.5, 8) };
  }
  const d = CUP_D[PROFILE.cup] ?? 15;
  // 罩杯快選:乳頭位置用美學比例(模型的胸骨上切跡到肚臍約 40 cm),大罩杯略低、略寬
  const sn = idealSNN(PROFILE.snu) + (d - 15) * 0.15;
  return { d, ub: 75, snn: sn, nn: sn, imd: 3 };
}
const bmi = () => PROFILE.weight / (PROFILE.height / 100) ** 2;

// 狀態中的乳房參數 + 病人條件 → 實際幾何。P、sc 為相對預設乳房的倍數;pt:絕對下垂程度(0–3);ptosis:相對病人的倍數
const GEO = new Map();
const NOTCH_Y = 1.41, C_X = 0.097, C_Y = 1.252; // 胸骨上切跡高度、乳房區域中心(模型座標)
function geomOf(p) {
  const key = JSON.stringify([p.P, p.Pabs, p.sc, p.shape, p.lift, p.pt, p.ptosis, p.upper, p.ratio, PROFILE.ver]);
  let g = GEO.get(key); if (g) return g;
  const M = measures(); const sc = p.sc || 1; const round = p.shape === 'round';
  // 突度由上下胸圍差決定;基底寬度由下胸圍(胸廓大小)決定
  const P = p.Pabs ?? (p.P / 0.064) * M.d * 0.0031 * sc; // 係數依 iRBSM 平均形狀的側面剖面校正
  const W = clampN(M.ub * 0.17, 10, 20) / 100 * sc;
  let pt = p.pt ?? PROFILE.pt * (p.ptosis ?? 1);
  if (round) pt = Math.min(pt, 0.2);
  const full = round ? 0.95 : p.upper != null ? 0.35 + p.upper : PROFILE.full;
  const ratio = p.ratio ?? PROFILE.ratio;
  const lift = p.lift || 0;
  // 乳頭位置:乳頭間距決定左右,胸骨上切跡到乳頭距離決定高度
  const xN = M.nn / 200; const uN = xN - C_X;
  const yV = NOTCH_Y - Math.sqrt(Math.max((M.snn / 100) ** 2 - xN ** 2, 0.0025));
  const Rmed = clampN(xN - M.imd / 200, 0.04, W * 0.75); const Rlat = Math.max(W - Rmed, 0.045);
  const H = W * 0.95; const Rup = ratio * H, Rlo = (1 - ratio) * H;
  const soft = PROFILE.mode === 'meas' ? clampN(1 + 0.04 * (bmi() - 25), 0.9, 1.4) : 1;
  const dropA = p.shape === 'natural' && P > 0.0005 ? soft * (0.045 * pt) * Math.sqrt(W / 0.1275) * Math.min(P / 0.054, 1.4) * (1 - Math.min(lift / 0.02, 0.6)) : 0;
  // 量測模式:量到的乳頭高度已含下垂,基底往上補回;罩杯快選:量測值代表未下垂,下垂時乳頭往下
  let wN = yV - C_Y + lift + (PROFILE.mode === 'meas' ? 0.85 * dropA : 0);
  wN = Math.min(wN, NOTCH_Y - 0.055 - C_Y - Rup); // 乳房上緣不超過約第二肋
  g = { P, sc: W / 0.1275, pt, full, ratio, top: wN + Rup, bot: wN - Rlo, wN, uN, shape: p.shape, round, Rup, Rlo, Rlat, Rmed, aU: 1.4 - 0.65 * full, dropA };
  g.wV = g.wN - 0.85 * g.dropA; // 下垂後看到的乳頭高度(基底座標)
  // 下垂時乳頭沿乳房表面往下、往外滑,朝向外下方
  const slide = g.round ? 0 : Math.max(pt - 0.8, 0); g.nU = g.uN + 0.004 * slide * g.sc; g.nW = g.wN - 0.0075 * slide * g.sc;
  if (GEO.size > 400) GEO.clear();
  GEO.set(key, g); return g;
}
// 預設乳房(病人條件)的估計體積(mL),以數值積分
let VOL = { ver: -1, ml: 0 };
function estVolume() {
  if (VOL.ver === PROFILE.ver) return VOL.ml;
  const g = geomOf(BASE_STATE.R); const p = { ...BASE_STATE.R, g, areola: false }; const h = 0.002; let v = 0;
  for (let u = g.uN - g.Rmed; u <= g.uN + g.Rlat; u += h) for (let w = g.bot; w <= g.top; w += h) v += Math.max(breastField(u, w, p).D, 0) * h * h;
  VOL = { ver: PROFILE.ver, ml: v * 1e6 }; return VOL.ml;
}
// 四個方向的半徑平滑過渡(避免在乳頭十字方向出現摺痕)
const rBlend = (v, a, b, sc) => a + (b - a) * smooth(-0.025 * sc, 0.025 * sc, v);
// 正面看:水滴形。下極飽滿圓弧、上極依飽滿度呈凹、直或凸;乳頭在最突出處
function profile(du, dw, g) {
  const u = du - g.uN, w = dw - g.wN;
  const x = u / rBlend(u, g.Rmed, g.Rlat, g.sc), y = w / rBlend(w, g.Rlo, g.Rup, g.sc);
  const t2 = x * x + y * y; if (t2 >= 1) return 0;
  if (g.shape === 'flat' || g.P < 0.0005) return 0.0015 * (1 - t2);
  const t = Math.sqrt(t2);
  const down = y < 0 && t > 1e-6 ? Math.pow(-y / t, 1.5) : 0;
  // 寬圓的穹頂(超橢圓):中央平緩、邊緣才收;下緣較陡,形成乳房下皺褶
  // 圓形(假體):寬而飽滿的穹頂、上極外凸;邊緣以圓角收進胸壁,避免一圈摺痕
  // 自然乳房:越挺(下垂越少)下極越緊實渾圓,下垂時下極才變得飽滿下沉
  const sag = Math.min(g.pt, 1);
  const dome = g.round ? Math.pow(1 - Math.pow(t, 2.4), 0.58) * (0.55 + 0.45 * smooth(1.0, 0.8, t)) : Math.pow(1 - Math.pow(t, 2.2 + 0.8 * sag), 0.62 - 0.12 * sag - 0.08 * down);
  if (y <= 0 || g.round) return g.P * dome;
  const cone = Math.pow(1 - t, g.aU);
  const upper = dome + (cone - dome) * smooth(0.25, 0.85, t);
  return g.P * (dome + (upper - dome) * Math.pow(y / t, 0.7));
}
function breastField(du, dw, p) {
  const g = p.g || geomOf(p);
  let D = profile(du, dw, g);
  if (p.areola && g.P > 0.008) {
    const dn2 = (du - g.nU - (p.nsu || 0)) ** 2 + (dw - g.nW - (p.nsw || 0)) ** 2;
    D += 0.004 * Math.exp(-dn2 / (2 * 0.0045 ** 2));
  }
  const D0 = D;
  if (p.defect > 0) {
    const q = Q_N[p.dq || 'uoq'];
    D -= p.defect * Math.exp(-((du - g.uN - q[0] * g.sc) ** 2 + (dw - g.wV - q[1] * g.sc) ** 2) / (2 * 0.024 ** 2));
  }
  for (const q of p.defects || []) if (q.d > 0) D -= q.d * Math.exp(-((du - q.u) ** 2 + (dw - q.w) ** 2) / (2 * q.s ** 2));
  if (D < D0) D = D0 > 0 ? Math.max(D, D0 * 0.12) : D0; // 凹陷不會深過原有組織厚度
  let drop = 0;
  if (g.dropA > 0 && D0 > 1e-6) {
    // 下垂:乳頭與下極往下掉;往兩側與上方衰減較快,避免皮膚折疊
    const f = Math.max(D / g.P, 0); const u = du - g.uN, w = dw - g.wN;
    const x = u / rBlend(u, g.Rmed, g.Rlat, g.sc), y = w / rBlend(w, g.Rlo, g.Rup, g.sc); const r = Math.hypot(x, y); const t = Math.min(r, 1);
    const downness = y < 0 && r > 1e-6 ? -y / r : 0; const lo = Math.min(Math.max(-y, 0), 1);
    // 整個乳房像袋子一樣往下垂(依組織厚度),下緣維持寬 U 形而不是收成錐狀
    drop = g.dropA * Math.pow(Math.min(f, 1.1), 0.85) * (1 + 0.2 * lo * (0.5 + 0.5 * downness));
  }
  return { D, drop };
}
// 乳頭在局部座標的位置(含移位)
// 乳頭乳暈的小隆起
function nipBump(du, dw, p, g) { if (!p.areola) return 0; const dn2 = (du - g.nU - (p.nsu || 0)) ** 2 + (dw - g.nW - (p.nsw || 0)) ** 2; return 0.004 * Math.exp(-dn2 / (2 * 0.0045 ** 2)); }
function nipLocal(p) { const g = geomOf(p); return [g.nU + (p.nsu || 0), g.nW + (p.nsw || 0)]; }

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
    const idx = [], du = [], dw = [], wt = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      // 前胸為主;往側胸(z 變小)逐漸減弱變形,避免在邊界撕裂
      if (z < 0.0 || Math.abs(x) > 0.19) continue;
      const a = (x - c.x) * s, b = y - c.y;
      if ((a / 0.125) ** 2 + (b / 0.135) ** 2 > 1.2) continue;
      idx.push(i); du.push(a); dw.push(b); wt.push(smooth(0.0, 0.035, z));
    }
    regions[key] = { s, c, idx: Int32Array.from(idx), du: Float32Array.from(du), dw: Float32Array.from(dw), wt: Float32Array.from(wt), frame: sideFrame(s) };
  }
  return regions;
}

function subsetGeometry(skinGeom, region, rMax) {
  const index = skinGeom.index.array;
  const inR = new Map();
  for (let k = 0; k < region.idx.length; k++) {
    const r2 = (region.du[k] / (region.du[k] > 0 ? 0.118 : 0.092)) ** 2 + ((region.dw[k] + 0.004) / (region.dw[k] > 0 ? 0.108 : 0.09)) ** 2;
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
const nipArc = (r, a0, a1, n = 12) => Array.from({ length: n + 1 }, (_, i) => { const t = a0 + ((a1 - a0) * i) / n; return [r * Math.sin(t), r * Math.cos(t)]; });
const SCAR_DEFS = {
  // nip:相對乳頭的局部座標(du 外側為正、dw 向上),imf:相對乳房下皺褶
  bcs_uoq: { side: 'R', nip: nipArc(0.052, 0.35, 1.05) },
  axilla: { world: [[-0.135, 1.285, 0.05], [-0.148, 1.3, 0.025], [-0.156, 1.315, 0.0]] },
  imf_medial: { side: 'R', imf: [[-0.062, 0.012], [-0.045, 0.004], [-0.025, 0.001], [-0.005, 0.0015]] },
  mast_line: { side: 'R', local: [[-0.058, 0.0], [-0.02, -0.006], [0.02, -0.007], [0.06, 0.0], [0.078, 0.008]] },
  abd_design: { ellipse: [0, 0.955, 0.125, 0.05], dashed: true },
  abd_line: { world: [[-0.135, 0.955, 0.1], [-0.07, 0.935, 0.12], [0, 0.93, 0.12], [0.07, 0.935, 0.12], [0.135, 0.955, 0.1]] },
  umb: { ellipse: [0.0075, 1.0175, 0.008, 0.008] },
  ports: { marks: [[0.05, 1.1], [-0.055, 1.06], [0.0075, 1.0]] },
  axR_d: { world: [[-0.135, 1.285, 0.05], [-0.148, 1.3, 0.025], [-0.156, 1.315, 0.0]], dashed: true },
  axL_d: { world: [[0.135, 1.285, 0.05], [0.148, 1.3, 0.025], [0.156, 1.315, 0.0]], dashed: true }
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
function projectRadialAxis(inst, x, y, z, ax, az) {
  const dir = new THREE.Vector3(x - ax, 0, z - az); const dist = dir.length(); dir.normalize();
  const origin = new THREE.Vector3(ax, y, az).addScaledVector(dir, dist + 0.05);
  raycaster.set(origin, dir.clone().negate()); raycaster.far = 0.14;
  const hit = raycaster.intersectObject(inst.skin, false)[0];
  return hit ? { p: hit.point, n: hit.face.normal.clone() } : null;
}
function projectAlongNormal(inst, x, y, z, n) {
  raycaster.set(new THREE.Vector3(x, y, z).addScaledVector(n, 0.08), n.clone().negate()); raycaster.far = 0.2;
  const hit = raycaster.intersectObject(inst.skin, false)[0];
  return hit ? { p: hit.point, n: hit.face.normal.clone() } : null;
}
function projectAlong(inst, x, y, f, zRef = 0.15) {
  const origin = new THREE.Vector3(x, y, zRef).addScaledVector(f, 0.45);
  raycaster.set(origin, f.clone().negate()); raycaster.far = 0.9;
  const hit = raycaster.intersectObject(inst.skin, false)[0];
  return hit ? { p: hit.point, n: hit.face.normal.clone() } : null;
}
function buildScars(inst, keys, custom = [], wscars = []) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: PAL.scar });
  const dmat = new THREE.MeshBasicMaterial({ color: PAL.design });
  const reg = inst.regions.R;
  for (const key of keys) {
    const def = SCAR_DEFS[key]; if (!def) continue;
    if (def.nip || def.imf) { custom = [...custom, { side: def.side, ref: def.imf ? 'imf' : null, pts: (def.nip || def.imf).map(([a, b]) => [SIDES[def.side] * a, b]), dashed: !!def.dashed }]; continue; }
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
    addScarCurve(g, inst, pts3, !!def.ellipse, !!def.dashed, mat, dmat);
  }
  // 供區疤痕:世界座標,沿身體或大腿中軸徑向投影
  for (const w of wscars) {
    const [ax, az] = w.axis || [0, 0];
    const nn = w.n ? new THREE.Vector3(...w.n).normalize() : null;
    addScarCurve(g, inst, w.pts, !!w.closed, !!w.dashed, mat, dmat, (x, y, z) => projectRadialAxis(inst, x, y, z, ax, az) || (nn && projectAlongNormal(inst, x, y, z, nn)));
  }
  // 個人化刀口:facing 座標(相對乳頭);ref 'imf' 時 Y 相對乳房下皺褶,由前下方投影到皺褶
  for (const c of custom) {
    const p = inst.state?.[c.side] || BASE_STATE[c.side]; const reg = inst.regions[c.side]; const f = reg.frame.f;
    const [nu, nw] = nipLocal(p);
    const n = inst.nipple?.[c.side] || regionBasePoint(inst, c.side, nu, nw);
    if (c.ref === 'imf') {
      const gm = geomOf(p); const fold = regionBasePoint(inst, c.side, gm.uN, gm.bot + 0.003);
      const d = f.clone().add(new THREE.Vector3(0, -0.9, 0)).normalize();
      addScarCurve(g, inst, c.pts.map(([X, Y]) => [n.x + X, fold.y + Y, fold.z]), !!c.closed, !!c.dashed, mat, dmat, (x, y, z) => projectAlong(inst, x, y, d, z));
      continue;
    }
    addScarCurve(g, inst, c.pts.map(([X, Y]) => [n.x + X, n.y + Y, 0.12]), !!c.closed, !!c.dashed, mat, dmat, (x, y) => projectAlong(inst, x, y, f, n.z));
  }
  return g;
}
function addScarCurve(g, inst, pts3, closed, dashed, mat, dmat, proj) {
  {
    const hits = pts3.map(([x, y, z]) => (proj ? proj(x, y, z) : projectOnSkin(inst, x, y, z))).filter(Boolean);
    if (hits.length < 2) return;
    const curve = new THREE.CatmullRomCurve3(hits.map((h) => h.p.clone().addScaledVector(h.n, 0.0018)), closed);
    if (dashed) {
      const L = curve.getLength(); const n = Math.max(6, Math.floor(L / Math.min(0.006, Math.max(L / 14, 0.002))));
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.0013, 8, 6), dmat);
        m.position.copy(curve.getPointAt(i / n)); g.add(m);
      }
      return;
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.0011, 6, closed), mat));
    const L = curve.getLength(); const n = Math.max(2, Math.floor(L / 0.008));
    for (let i = 1; i < n; i++) {
      const u = i / n; const p = curve.getPointAt(u); const t = curve.getTangentAt(u);
      const out = p.clone().setY(0).normalize(); const perp = new THREE.Vector3().crossVectors(t, out).normalize();
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.0005, 0.0005, 0.006, 5), mat);
      st.position.copy(p); st.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), perp); g.add(st);
    }
  }
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
    const own = b.name === 'skin' || b.name === 'pecmaj_r' || b.name === 'pecmaj_l';
    const m = addPart(b.name, new THREE.Mesh(own ? b.geometry.clone() : b.geometry, materialFor(b.name)), layerOf(b.name));
    if (b.name.startsWith('pecmaj')) { m.userData.basePos = Float32Array.from(m.geometry.attributes.position.array); m.userData.baseNrm = Float32Array.from(m.geometry.attributes.normal.array); }
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
  // 隆乳假體(雙側)
  const tear = new THREE.SphereGeometry(1, 48, 32); const tpp = tear.attributes.position;
  for (let i = 0; i < tpp.count; i++) { const y = tpp.getY(i); const z = tpp.getZ(i); tpp.setZ(i, y > 0 ? z * (1 - 0.5 * y) : z * 1.06); tpp.setY(i, y * (y > 0 ? 0.95 : 1)); }
  tear.computeVertexNormals(); inst.geoms = { round: sph, tear };
  inst.augM = {};
  for (const key of ['R', 'L']) inst.augM[key] = addPart('aug_' + key, new THREE.Mesh(sph, atlasMat('implant', ...PAL.implant, { transparent: true, depthWrite: false })), 9, { info: 'aug' });
  // 術式庫通用皮瓣(最多兩塊,供疊加皮瓣)、血管蒂、穿通枝標記、ADM、脂肪滴
  inst.gfm = [0, 1].map((i) => addPart('gflap_' + i, new THREE.Mesh(sph, atlasMat('flap', ...PAL.skin)), 9, { info: 'gflap' }));
  inst.gped = new THREE.Mesh(new THREE.BufferGeometry(), atlasMat('plain', ...PAL.artery)); inst.gped.userData.info = 'gflap'; inst.root.add(inst.gped);
  inst.gArc = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), atlasMat('plain', '#1f6a6f', '#0e3a3d', { hatch: 0, transparent: true }), 22);
  inst.gArc.material.depthTest = false; inst.gArc.renderOrder = 11; inst.gArc.visible = false; inst.root.add(inst.gArc);
  inst.perf = addPart('perf', new THREE.Mesh(new THREE.SphereGeometry(0.004, 14, 10), atlasMat('plain', '#e23b2e', '#7a1510', { hatch: 0 })), 9, { info: 'perf', outline: false });
  inst.perf.material.depthTest = false; inst.perf.renderOrder = 10;
  inst.adm = addPart('adm', new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), atlasMat('plain', '#f1dfae', '#a88b4a', { side: THREE.DoubleSide, transparent: true, depthWrite: false })), 9, { info: 'adm', outline: false });
  inst.admWrap = new THREE.SphereGeometry(1, 32, 16); inst.admLower = inst.adm.geometry;
  inst.fatDrops = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), atlasMat('fat', ...PAL.fat), 220); inst.fatDrops.name = 'fatdrop'; inst.fatDrops.userData.info = 'fatdrop'; inst.root.add(inst.fatDrops);
  const drape = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), atlasMat('plain', '#c9d6dc', '#7d8f98', { hatch: 0 }));
  drape.position.set(0, 0.805, 0.012); drape.scale.set(0.04, 0.062, 0.06); drape.name = 'drape'; drape.userData.info = 'drape'; inst.root.add(drape);
  computeTargets(inst);
  buildAxilla(inst);
  buildGlandDetail(inst);
  buildFatDrops(inst);
  buildAbdFat(inst);
  buildPerfMap(inst);
  return inst;
}

// ---------- 下腹皮下脂肪層(剝層時顯示) ----------
function buildAbdFat(inst) {
  const sg = inst.skin.geometry; const pos = sg.attributes.position, nrm = sg.attributes.normal; const idx = sg.index.array;
  const ok = (v) => { const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v); return y > 0.88 && y < 1.12 && Math.abs(x) < 0.13 && z > 0.05 && nrm.getZ(v) > 0.55; };
  const map = new Map(); const src = []; const tris = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2]; if (!ok(a) || !ok(b) || !ok(c)) continue;
    for (const v of [a, b, c]) { if (!map.has(v)) { map.set(v, src.length); src.push(v); } tris.push(map.get(v)); }
  }
  const arr = new Float32Array(src.length * 3);
  src.forEach((v, i) => { arr[i * 3] = pos.getX(v) - nrm.getX(v) * 0.003; arr[i * 3 + 1] = pos.getY(v) - nrm.getY(v) * 0.003; arr[i * 3 + 2] = pos.getZ(v) - nrm.getZ(v) * 0.003; });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3)); g.setIndex(tris); g.computeVertexNormals();
  inst.abdFat = addPartTo(inst, 'subq_abd', new THREE.Mesh(g, atlasMat('fat', ...PAL.fat, { side: THREE.DoubleSide })), 1, 'fat');
}
function addPartTo(inst, name, mesh, layer, info) {
  mesh.name = name; mesh.userData.layer = layer; mesh.userData.info = info; inst.root.add(mesh); inst.parts.push(mesh); inst.byName.set(name, mesh); return mesh;
}

// ---------- DIEP 穿通枝地圖(以肚臍為原點的 CTA 報告示意) ----------
const UMB = new THREE.Vector3(0, 1.0175, 0.115);
function labelSprite(text, col) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = 'rgba(255,255,255,0.92)'; x.strokeStyle = col; x.lineWidth = 5;
  x.beginPath(); x.roundRect(4, 4, 120, 56, 14); x.fill(); x.stroke();
  x.fillStyle = '#1d1d1f'; x.font = 'bold 38px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 64, 34);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  sp.scale.set(0.014, 0.007, 1); sp.renderOrder = 12; return sp;
}
function curveAtY(pts, y) {
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) { const t = (y - a[1]) / (b[1] - a[1]); return new THREE.Vector3(a[0] + (b[0] - a[0]) * t, y, a[2] + (b[2] - a[2]) * t); } }
  const e = pts.reduce((m, p) => (Math.abs(p[1] - y) < Math.abs(m[1] - y) ? p : m)); return new THREE.Vector3(...e);
}
function buildPerfMap(inst) {
  inst.root.updateMatrixWorld(true);
  const g = new THREE.Group(); g.visible = false; inst.root.add(g);
  const skinPt = (x, y) => { const h = projectAlong(inst, x, y, new THREE.Vector3(0, 0, 1), 0.1); return h ? { p: h.p.clone(), n: h.n.clone() } : { p: new THREE.Vector3(x, y, 0.118), n: new THREE.Vector3(0, 0, 1) }; };
  // 座標格:每 2 公分,中線與肚臍橫線加粗
  const gridMat = new THREE.MeshBasicMaterial({ color: '#1f6a6f', transparent: true, opacity: 0.55, depthWrite: false });
  const axisMat = new THREE.MeshBasicMaterial({ color: '#0e3a3d', transparent: true, opacity: 0.9, depthWrite: false });
  const line = (pts, axis) => { const v = pts.map(([x, y]) => { const h = skinPt(x, y); return h.p.addScaledVector(h.n, 0.0008); }); g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(v), v.length * 2, axis ? 0.0006 : 0.00035, 4, false), axis ? axisMat : gridMat)); };
  for (let i = -6; i <= 6; i++) line(Array.from({ length: 16 }, (_, k) => [UMB.x + i * 0.02, UMB.y + 0.04 - k * 0.01]), i === 0);
  for (let j = 2; j >= -5; j--) line(Array.from({ length: 25 }, (_, k) => [UMB.x - 0.12 + k * 0.01, UMB.y + j * 0.02]), j === 0);
  inst.perfGrid = [gridMat, axisMat];
  // 每條穿通枝:皮膚出口環、編號、深部走向
  const dieaR = BASE.curves['Inferior epigastric artery.r']?.[0], dieaL = BASE.curves['Inferior epigastric artery.l']?.[0];
  const rect = { R: inst.byName.get('rectus_r'), L: inst.byName.get('rectus_l') };
  inst.perfItems = [];
  for (const d of PERF_MAP) {
    const sx = d.side === 'R' ? -1 : 1; const x = UMB.x + sx * d.dx / 100, y = UMB.y + d.dy / 100;
    const sk = skinPt(x, y);
    const col = d.dom ? '#f2b705' : '#d9412f';
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0042, 0.0009, 8, 32), atlasMat('plain', col, d.dom ? '#8a6500' : '#7a1510', { hatch: 0 }));
    ring.position.copy(sk.p).addScaledVector(sk.n, 0.001); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), sk.n);
    ring.material.depthTest = false; ring.renderOrder = 11; ring.userData.info = 'perf'; g.add(ring);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0016, 10, 8), ring.material); dot.position.copy(ring.position); dot.renderOrder = 11; g.add(dot);
    const lab = labelSprite(d.id, col); lab.position.copy(sk.p).addScaledVector(sk.n, 0.004).add(new THREE.Vector3(sx * 0.009, 0.006, 0)); g.add(lab);
    // 肌肉前後緣:沿 -Z 射線打腹直肌
    let zF = 0.1, zB = 0.088;
    const rm = rect[d.side];
    if (rm) { raycaster.set(new THREE.Vector3(x, y, 0.5), new THREE.Vector3(0, 0, -1)); raycaster.far = 1; const hs = raycaster.intersectObject(rm, false); if (hs.length >= 2) { zF = hs[0].point.z; zB = hs[hs.length - 1].point.z; } else if (hs.length === 1) { zF = hs[0].point.z; zB = zF - 0.01; } }
    const pts = sx < 0 ? dieaR : dieaL;
    const yB = y - (d.im / 100) * 0.75;
    const trunk = pts ? curveAtY(pts, yB - 0.02) : new THREE.Vector3(sx * 0.034, yB - 0.02, 0.08);
    const back = new THREE.Vector3(x - sx * 0.003, yB, zB - 0.002);
    const front = new THREE.Vector3(x, y - 0.002, zF + 0.001);
    const deepC = new THREE.CatmullRomCurve3([trunk, trunk.clone().lerp(back, 0.5).add(new THREE.Vector3(0, 0, -0.002)), back]);
    const musC = new THREE.CatmullRomCurve3([back, back.clone().lerp(front, 0.5).add(new THREE.Vector3(sx * 0.002, 0, 0)), front]);
    const subC = new THREE.CatmullRomCurve3([front, front.clone().lerp(sk.p, 0.5).add(new THREE.Vector3(sx * 0.003, 0.002, 0)), sk.p.clone()]);
    const r = 0.0007 + d.dia * 0.0005; // 為了看得見,比實際管徑粗
    const cm = atlasMat('plain', ...PAL.artery, { hatch: 0 });
    const course = new THREE.Group(); course.visible = false;
    for (const c of [deepC, musC, subC]) { const m = new THREE.Mesh(new THREE.TubeGeometry(c, 16, r, 6, false), cm); m.userData.info = 'perf'; m.renderOrder = 9; course.add(m); }
    // 穿過筋膜的點
    const fas = new THREE.Mesh(new THREE.SphereGeometry(r * 1.9, 10, 8), atlasMat('plain', col, '#5a1a14', { hatch: 0 })); fas.position.copy(front); course.add(fas);
    g.add(course);
    inst.perfItems.push({ d, ring, dot, lab, course, cm });
  }
  inst.perfMap = g;
}
function updatePerfMap(inst, s) {
  const g = inst.perfMap; if (!g) return;
  const v = s.perfMap || 0; g.visible = v > 0.01;
  if (!g.visible) return;
  inst.perfGrid[0].opacity = 0.55 * v * (s.peel < 0.6 ? 1 : 0.25); inst.perfGrid[1].opacity = 0.9 * v * (s.peel < 0.6 ? 1 : 0.35);
  const sel = app.perfSel;
  for (const it of inst.perfItems) {
    const on = !sel || sel === it.d.id; const k = sel === it.d.id ? 1.45 : 1;
    it.ring.scale.setScalar(k); it.dot.visible = sel === it.d.id;
    setOpacity(it.ring, v * (on ? 1 : 0.3));
    it.lab.material.opacity = v * (on ? 1 : 0.35);
    it.course.visible = (s.perfCourse || 0) > 0.01; setOpacity(it.course, (s.perfCourse || 0) * (on ? 1 : 0.25));
    it.cm.uniforms.uHi.value = sel === it.d.id ? 1 : 0;
  }
}

// ---------- 前哨淋巴結與廓清 ----------
function buildAxilla(inst) {
  // 原始資料在胸小肌內上方(鎖骨下)沒有淋巴結,補 3 顆示意的 Level III
  [[-0.088, 1.378, 0.026], [-0.096, 1.386, 0.018], [-0.08, 1.383, 0.034]].forEach((p, k) => {
    const g = new THREE.SphereGeometry(0.0019, 14, 10); g.translate(...p);
    const m = new THREE.Mesh(g, atlasMat('plain', ...NODE_COL.III)); m.name = 'nodes_III_proc#' + k; m.userData.info = 'nodes_III_apical'; m.userData.layer = 9;
    const o = new THREE.Mesh(g, outlineMat); o.raycast = () => {}; m.add(o); m.userData.outline = o; inst.root.add(m); inst.parts.push(m);
  });
  inst.nodes = inst.parts.filter((m) => m.name.startsWith('nodes_'));
  // 依胸小肌位置分級:外側 Level I、後方 Level II、內上方 Level III
  const pm = inst.byName.get('pecmin_r'); const bins = [];
  if (pm) {
    const pp = pm.geometry.attributes.position;
    for (let i = 0; i < pp.count; i++) { const y = pp.getY(i), x = pp.getX(i); const b = Math.round(y * 100); const e = bins[b] || (bins[b] = [x, x]); e[0] = Math.min(e[0], x); e[1] = Math.max(e[1], x); }
  }
  const ys = Object.keys(bins).map(Number);
  const border = (y) => { if (!ys.length) return [-0.13, -0.07]; let b = Math.round(y * 100); b = Math.min(Math.max(b, Math.min(...ys)), Math.max(...ys)); while (!bins[b] && b > 0) b--; return bins[b] || [-0.13, -0.07]; };
  for (const m of inst.nodes) {
    m.geometry.computeBoundingSphere(); m.userData.c = m.geometry.boundingSphere.center.clone();
    let lv = nodeLevel(m.name);
    if (lv !== 'IMN' && !m.name.includes('_proc')) { const [lat, med] = border(m.userData.c.y); const x = m.userData.c.x; const y = m.userData.c.y; lv = (y > 1.372 && x > lat - 0.025) || (x > med + 0.004 && y > 1.355) ? 'III' : x < lat - 0.004 ? 'I' : 'II'; }
    m.userData.level = lv; const col = NODE_COL[lv]; m.material.uniforms.uColor.value.set(col[0]); m.material.uniforms.uShade.value.set(col[1]);
    const k = 1.8; m.scale.setScalar(k); m.position.copy(m.userData.c).multiplyScalar(1 - k); // 以淋巴結中心放大,方便辨識
    m.material.depthTest = false; m.renderOrder = 8; m.material.userData.alwaysTransparent = true;
  }
  const target = new THREE.Vector3(-0.115, 1.29, 0.06);
  const ant = inst.nodes.filter((m) => m.userData.level === 'I');
  inst.sentinel = ant.reduce((b, m) => (!b || m.userData.c.distanceTo(target) < b.userData.c.distanceTo(target) ? m : b), null);
  if (inst.sentinel) { inst.sentinel.material = inst.sentinel.material.clone(); inst.sentinel.userData.info = 'sentinel'; }
  const sc = inst.sentinel ? inst.sentinel.userData.c.clone() : new THREE.Vector3(-0.12, 1.31, 0.03);
  inst.slnC = sc; buildDye(inst);
  // γ 探頭
  const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 20), atlasMat('bone', '#cfd5da', '#6b747c'));
  const dir = new THREE.Vector3(-0.75, -0.1, 0.65).normalize(); probe.position.copy(sc).addScaledVector(dir, 0.085);
  probe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); probe.name = 'probe'; probe.userData.info = 'probe'; inst.root.add(probe); inst.probe = probe;
  // 引流管
  const dcurve = new THREE.CatmullRomCurve3([sc.clone(), new THREE.Vector3(-0.155, 1.25, 0.03), new THREE.Vector3(-0.17, 1.2, 0.04), new THREE.Vector3(-0.2, 1.17, 0.07)]);
  inst.drain = new THREE.Mesh(new THREE.TubeGeometry(dcurve, 40, 0.0025, 8), atlasMat('implant', '#e7eef2', '#8aa0ad', { transparent: true }));
  inst.drain.name = 'drain'; inst.drain.userData.info = 'drain'; inst.root.add(inst.drain);
  // 標記夾:放在另一顆 Level I 淋巴結
  const other = ant.filter((m) => m !== inst.sentinel).sort((a, b) => a.userData.c.distanceTo(target) - b.userData.c.distanceTo(target))[0] || inst.sentinel;
  inst.clip = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.0015, 0.0015), atlasMat('bone', '#e9edf0', '#7d8790'));
  inst.clip.position.copy(other ? other.userData.c : sc); inst.clip.name = 'clip'; inst.clip.userData.info = 'clip'; inst.clip.material.depthTest = false; inst.clip.renderOrder = 10; inst.root.add(inst.clip);
  inst.clipNode = other;
}
// 追蹤劑:乳暈周圍注射 → 皮下淋巴管 → 前哨淋巴結;以流動的小點表示
function buildDye(inst) {
  if (inst.dyePath) { inst.root.remove(inst.dyePath); inst.dyePath.traverse((o) => o.geometry?.dispose()); }
  const f = inst.regions.R.frame.f; const g = geomOf(BASE_STATE.R); const sc = inst.slnC;
  const at = (du, dw, out) => { const { D, drop } = breastField(du, dw, BASE_STATE.R); return regionBasePoint(inst, 'R', du, dw).addScaledVector(f, D * out).add(new THREE.Vector3(0, -drop * out, 0)); };
  const group = new THREE.Group(); group.name = 'dyepath';
  const mat = atlasMat('plain', '#3466d8', '#1a2f70', { hatch: 0, transparent: true }); mat.depthTest = false;
  inst.dyeCurves = [];
  for (const [a0, k] of [[1.0, 0], [1.5, 1], [0.55, 2]]) {
    const r0 = 0.02; const p0 = at(g.uN + r0 * Math.sin(a0), g.wN + r0 * Math.cos(a0), 0.92);
    const p1 = at(g.uN + 0.05 * Math.sin(0.9 + k * 0.08), g.wN + 0.04 + 0.006 * k, 0.55);
    const curve = new THREE.CatmullRomCurve3([p0, p1, sc.clone().lerp(p1, 0.35), sc.clone()]);
    inst.dyeCurves.push(curve);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.0011, 6), mat); m.name = 'dyepath'; m.userData.info = 'dyepath'; m.renderOrder = 9; group.add(m);
  }
  inst.dyeMat = mat; inst.dyeTotal = group.children[0].geometry.index.count;
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), atlasMat('plain', '#2f63d6', '#13285e', { hatch: 0 }), 36);
  dots.material.depthTest = false; dots.renderOrder = 10; dots.name = 'dyepath'; dots.userData.info = 'dyepath'; group.add(dots); inst.dyeDots = dots;
  group.renderOrder = 9; inst.root.add(group); inst.dyePath = group;
}
function updateAxilla(inst, s) {
  // 取出動畫:淋巴結往切口方向移出並淡出
  const exitS = new THREE.Vector3(-0.2, 1.305, 0.07), exitL = new THREE.Vector3(-0.21, 1.29, 0.05);
  for (const m of inst.nodes) {
    const lv = m.userData.level; const isS = m === inst.sentinel;
    let op = s.nodes; let out = 0; let exit = exitL;
    if (lv === 'I' || lv === 'II') { const gv = lv === 'I' ? s.gI : s.gII; out = Math.max(out, gv); }
    if (isS && s.slnGone > out) { out = s.slnGone; exit = exitS; }
    if (m === inst.clipNode && s.clipGone > out) { out = s.clipGone; exit = exitS; }
    const mv = smooth(0, 0.75, out); op *= 1 - smooth(0.55, 1, out);
    if (m === inst.clipNode && s.clip > 0.01) op = Math.max(op, s.nodes * (1 - smooth(0.55, 1, s.clipGone)));
    const k = 1.8; m.position.copy(m.userData.c).multiplyScalar(1 - k).addScaledVector(exit.clone().sub(m.userData.c), mv);
    setOpacity(m, op);
    const hi = s.hiNode === 'I_II' ? (lv === 'I' || lv === 'II') : s.hiNode === 'sentinel' ? isS : s.hiNode === 'clip' ? m === inst.clipNode : false;
    m.material.uniforms.uHi.value = hi ? 1 : 0;
  }
  if (inst.sentinel) { const c = new THREE.Color(NODE_COL.I[0]).lerp(new THREE.Color('#2f63d6'), Math.min(s.dye, 1)); inst.sentinel.material.uniforms.uColor.value.copy(c); inst.sentinel.material.uniforms.uShade.value.copy(new THREE.Color(NODE_COL.I[1]).lerp(new THREE.Color('#13285e'), Math.min(s.dye, 1))); }
  inst.dyePath.visible = s.dye > 0.01 && s.slnGone < 0.5;
  if (inst.dyePath.visible) {
    for (const m of inst.dyePath.children) if (!m.isInstancedMesh) m.geometry.setDrawRange(0, Math.floor((inst.dyeTotal * Math.min(s.dye, 1)) / 3) * 3);
    inst.dyeMat.uniforms.uOpacity.value = 0.55;
    // 流動的追蹤劑顆粒
    const dots = inst.dyeDots; const mtx = new THREE.Matrix4(); const n = dots.count; const per = n / inst.dyeCurves.length;
    for (let i = 0; i < n; i++) {
      const c = inst.dyeCurves[Math.floor(i / per)]; let u = ((TIME.value * 0.22 + (i % per) / per + Math.floor(i / per) * 0.13) % 1) * Math.min(s.dye, 1);
      const r = s.flow > 0.01 ? 0.0019 * (0.6 + 0.4 * Math.sin(u * Math.PI)) : 0; mtx.makeScale(r, r, r).setPosition(c.getPointAt(Math.min(u, 1))); dots.setMatrixAt(i, mtx);
    }
    dots.instanceMatrix.needsUpdate = true; dots.visible = s.flow > 0.01;
  }
  setOpacity(inst.probe, s.probe);
  inst.drain.material.userData.alwaysTransparent = true; setOpacity(inst.drain, s.drain * 0.9);
  if (inst.clipNode) inst.clip.position.copy(inst.clipNode.userData.c).lerp(exitS, smooth(0, 0.75, s.clipGone));
  inst.clip.visible = s.clip > 0.01 && s.clipGone < 0.95; inst.clip.scale.setScalar(1 + 0.2 * Math.sin(TIME.value * 4));
}

// ---------- 術式庫通用皮瓣 ----------
function genericPath(inst, def, i, zoneOv) {
  const zone = zoneOv || def.zone;
  const key = def.id + ':' + i + ':' + (zone || ''); if (inst.gpaths?.[key]) return inst.gpaths[key];
  inst.gpaths = inst.gpaths || {};
  const d = DONORS[def.donor]; const f = inst.regions.R.frame.f;
  const c = def.count === 2 ? [i ? 0.065 : -0.065, d.c[1], d.c[2]] : d.c;
  const start = new THREE.Vector3(...c); const nrm = new THREE.Vector3(...d.normal).normalize();
  let end = zone ? inst.q[zone].clone() : inst.mound.clone();
  if (def.count === 2) end.add(new THREE.Vector3(i ? 0.012 : -0.012, i ? -0.008 : 0.008, i ? -0.006 : 0.006));
  const r = def.count === 2 ? d.r[0] / 2 : d.r[0];
  const s1 = zone ? new THREE.Vector3(0.028, 0.022, 0.016) : def.count === 2 ? new THREE.Vector3(0.05, 0.046, 0.02) : def.implant ? new THREE.Vector3(0.062, 0.058, 0.018) : new THREE.Vector3(0.066, 0.062, 0.026);
  const path = { s0: new THREE.Vector3(r, d.r[1], 0.012), s1, n0: nrm, n1: f.clone(), anchor: def.anchor ? new THREE.Vector3(...def.anchor) : null, e1: new THREE.Vector3(...d.e1).normalize() };
  if (zone && def.transfer !== 'free') {
    // 螺旋槳式(propeller)轉位:以穿通枝為軸,先掀起、再旋轉、最後放入缺損
    const pivot = new THREE.Vector3(...(def.perf || def.anchor || c));
    const v0 = start.clone().sub(pivot), v1 = end.clone().sub(pivot);
    path.prop = { pivot, d0: v0.clone().normalize(), L0: v0.length(), L1: v1.length(), Q: new THREE.Quaternion().setFromUnitVectors(v0.clone().normalize(), v1.clone().normalize()), start, end };
  } else {
    let pts;
    if (def.transfer === 'free') {
      const p1 = start.clone().addScaledVector(nrm, 0.2); const p3 = end.clone().addScaledVector(f, 0.25);
      pts = start.z < -0.02 ? [start, p1, new THREE.Vector3(-0.42, (start.y + end.y) / 2, 0.05), p3, end] : [start, p1, new THREE.Vector3(start.x - 0.08, (start.y + end.y) / 2, 0.38), p3, end];
    } else {
      const mid = start.clone().lerp(end, 0.5); const out = new THREE.Vector3(mid.x, 0, mid.z).normalize();
      pts = [start, mid.addScaledVector(out, 0.012).add(new THREE.Vector3(0, 0.01, 0)), end];
    }
    path.curve = new THREE.CatmullRomCurve3(pts);
  }
  inst.gpaths[key] = path; return path;
}
// 回傳時間 t 的皮瓣位置、法線、長軸方向與縮放
function flapPose(path, t) {
  if (!path.prop) {
    const tt = THREE.MathUtils.smoothstep(t, 0, 1);
    const n = path.n0.clone().lerp(path.n1, THREE.MathUtils.smoothstep(tt, 0.3, 1)).normalize();
    return { pos: path.curve.getPointAt(tt), n, ax: null, sc: path.s0.clone().lerp(path.s1, THREE.MathUtils.smoothstep(tt, 0.5, 1)) };
  }
  const P = path.prop; const raise = smooth(0, 0.15, t); const u = smooth(0.15, 0.88, t); const settle = smooth(0.88, 1, t);
  const q = new THREE.Quaternion().slerp(P.Q, u);
  const n = path.n0.clone().lerp(path.n1, u).normalize();
  const pos = P.pivot.clone().addScaledVector(P.d0.clone().applyQuaternion(q), P.L0 + (P.L1 - P.L0) * u);
  pos.addScaledVector(n, 0.014 * raise * (1 - settle) + 0.01 * Math.sin(Math.PI * u));
  const ax = path.e1.clone().applyQuaternion(q);
  return { pos, n, ax, sc: path.s0.clone().lerp(path.s1, smooth(0.55, 1, t)) };
}
function updateGenericFlap(inst, s) {
  const def = s.gf.tech && TECH_BY_ID[s.gf.tech]; const peel = s.peel;
  inst.gped.visible = false; inst.gArc.visible = false;
  inst.gfm.forEach((m, i) => {
    if (!def || s.gf.vis < 0.01 || i >= (def.count || 1)) { setOpacity(m, 0); return; }
    const path = genericPath(inst, def, i, s.gf.zone); const t = Math.min(Math.max(s.gf.t, 0), 1);
    const fp = flapPose(path, t);
    m.position.copy(fp.pos); m.scale.copy(fp.sc);
    if (fp.ax) { const x = fp.ax.clone().addScaledVector(fp.n, -fp.ax.dot(fp.n)).normalize(); const y = new THREE.Vector3().crossVectors(fp.n, x); m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, fp.n)); }
    else m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), fp.n);
    m.material.uniforms.uFiber.value.copy(fp.n);
    const hide = t > 0.98 && peel < 0.5 && s.ghostSkin > 0.9 && !(def.zone && peel >= 1.5);
    setOpacity(m, hide ? 0 : s.gf.vis);
    // 旋轉路徑導引
    if (i === 0 && path.prop && (s.gf.arc || 0) > 0.01) {
      const mtx = new THREE.Matrix4(); const n = inst.gArc.count;
      for (let k = 0; k < n; k++) { const pk = flapPose(path, 0.15 + (0.73 * k) / (n - 1)).pos; const r = 0.0016 * (k === n - 1 ? 1.8 : 1); mtx.makeScale(r, r, r).setPosition(pk); inst.gArc.setMatrixAt(k, mtx); }
      inst.gArc.instanceMatrix.needsUpdate = true; inst.gArc.visible = true; inst.gArc.material.uniforms.uOpacity.value = s.gf.arc;
    }
    if (i === 0 && path.anchor && !hide && t > 0.02) {
      const end = m.position.clone(); const mid = path.anchor.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0, 0.015));
      if (end.distanceTo(path.anchor) < 0.004) return;
      inst.gped.geometry.dispose();
      inst.gped.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([path.anchor.clone(), mid, end]), 20, def.pedMuscle ? 0.008 : 0.0016, 8, false);
      const mu = inst.gped.material.uniforms; const col = def.pedMuscle ? PAL.muscle : PAL.artery;
      mu.uColor.value.set(col[0]); mu.uShade.value.set(col[1]); mu.uKind.value = def.pedMuscle ? KIND.muscle : KIND.plain;
      inst.gped.visible = true; setOpacity(inst.gped, s.gf.vis);
    }
  });
}
function buildFatDrops(inst) {
  const m = inst.fatDrops; const reg = inst.regions.R; const f = reg.frame.f; const p = BASE_STATE.R; const mtx = new THREE.Matrix4();
  const g = geomOf(p); const q = [g.uN + Q_N.uoq[0] * g.sc, g.wV + Q_N.uoq[1] * g.sc];
  m.count = m.userData.total || m.count;
  for (let i = 0; i < m.count; i++) {
    const a = hash1(i * 3.1) * Math.PI * 2, rr = Math.sqrt(hash1(i * 7.7)) * 0.03;
    const u = q[0] + rr * Math.cos(a), w = q[1] + rr * Math.sin(a);
    const { D, drop } = breastField(u, w, p); const fr = 0.25 + 0.6 * hash1(i * 13.3);
    const pt = basePointInterp(inst, 'R', u, w).addScaledVector(f, Math.max(D, 0.004) * fr).add(new THREE.Vector3(0, -drop * fr, 0));
    const r = 0.0014 + 0.0012 * hash1(i * 5.1);
    mtx.makeScale(r, r, r).setPosition(pt); m.setMatrixAt(i, mtx);
  }
  m.userData.total = m.count; m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); m.count = 0;
}

// ---------- 乳腺細部構造(右乳,程式建模示意) ----------
function hash1(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
// 在乳房區域內以最近 4 個頂點內插位置(arr 不給時用原始未變形的位置)
function basePointInterp(inst, key, u, w, arr) {
  const reg = inst.regions[key]; const base = arr || inst.skin.userData.base; const best = [];
  for (let k = 0; k < reg.idx.length; k++) {
    const d = (reg.du[k] - u) ** 2 + (reg.dw[k] - w) ** 2;
    if (best.length < 4 || d < best[3][0]) { best.push([d, k]); best.sort((a, b) => a[0] - b[0]); if (best.length > 4) best.pop(); }
  }
  const out = new THREE.Vector3(); let ws = 0;
  for (const [d, k] of best) { const i = reg.idx[k]; const wgt = 1 / (Math.sqrt(d) + 1e-4); out.x += base[i * 3] * wgt; out.y += base[i * 3 + 1] * wgt; out.z += base[i * 3 + 2] * wgt; ws += wgt; }
  return out.multiplyScalar(1 / ws);
}
function buildGlandDetail(inst) {
  const p = BASE_STATE.R; const f = inst.regions.R.frame.f;
  const P = (u, w, frac) => { const { D, drop } = breastField(u, w, p); return basePointInterp(inst, 'R', u, w).addScaledVector(f, Math.max(D, 0.002) * frac).add(new THREE.Vector3(0, -drop * frac, 0)); };
  const group = new THREE.Group(); group.name = 'glandDetail';
  const mats = {
    duct: atlasMat('plain', '#f2e3c4', '#a88a5c', { hatch: 0 }), sinus: atlasMat('plain', '#f2e3c4', '#a88a5c', { hatch: 0 }),
    lobule: atlasMat('gland', '#eeb2a6', '#9c5b51'), cooper: atlasMat('plain', '#f6f3ea', '#a39f92', { hatch: 0 }),
    node: atlasMat('plain', '#c9b467', '#6f5f2a'), sentinel: atlasMat('plain', '#45b089', '#1d5c45'), lymph: atlasMat('plain', '#93c47d', '#4b7a3a', { hatch: 0 })
  };
  const add = (geo, key, parent = group) => { const m = new THREE.Mesh(geo, mats[key]); m.name = key; m.userData.info = key; parent.add(m); return m; };
  const g = geomOf(p); const nx = g.uN, ny = g.wN; const lob = [];
  const ducts = []; const N = 16;
  for (let i = 0; i < N; i++) ducts.push({ th: (2 * Math.PI * i) / N + 0.12 * Math.sin(i * 2.3), ext: 0.78 + 0.1 * hash1(i) });
  ducts.push({ th: 0.72, ext: 1.22 }); // 腋尾
  ducts.forEach((dct, i) => {
    const su = Math.sin(dct.th), sw = Math.cos(dct.th);
    const rx = su > 0 ? g.Rlat : g.Rmed, ry = sw > 0 ? g.Rup : g.Rlo;
    const L = dct.ext / Math.sqrt((su / rx) ** 2 + (sw / ry) ** 2);
    const at = (t, side = 0, bl = 0) => {
      const wig = 0.004 * Math.sin(t * Math.PI * 1.5 + i);
      const bu = su * Math.cos(side * 0.55) - sw * Math.sin(side * 0.55), bw = sw * Math.cos(side * 0.55) + su * Math.sin(side * 0.55);
      const u = nx + su * L * t + sw * wig + bu * bl, w = ny + sw * L * t - su * wig + bw * bl;
      return { u, w, frac: Math.max(0.94 - 0.56 * Math.pow(t, 0.8) - bl * 3, 0.25) };
    };
    const pts = []; for (let k = 0; k <= 14; k++) { const a = at(k / 14); pts.push(P(a.u, a.w, a.frac)); }
    const curve = new THREE.CatmullRomCurve3(pts);
    add(new THREE.TubeGeometry(curve, 48, 0.0014, 6), 'duct');
    const sp = curve.getPointAt(0.12); const sn = add(new THREE.SphereGeometry(0.0032, 14, 10), 'sinus'); sn.position.copy(sp);
    sn.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), curve.getTangentAt(0.12)); sn.scale.set(1, 1, 1.7);
    const tips = [{ t: 1, side: 0, bl: 0 }];
    for (const tb of [0.38, 0.52, 0.66, 0.8, 0.93]) for (const side of [-1, 1]) tips.push({ t: tb, side, bl: 0.011 + 0.007 * hash1(i * 31 + tb * 100 + side) });
    tips.forEach((tp, j) => {
      const a0 = at(tp.t); const a1 = at(tp.t, tp.side, tp.bl);
      if (tp.bl > 0) add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([P(a0.u, a0.w, a0.frac), P(a1.u, a1.w, a1.frac)]), 6, 0.0008, 5), 'duct');
      const c = P(a1.u, a1.w, a1.frac);
      for (let q = 0; q < 4; q++) {
        const h = i * 997 + j * 37 + q * 7;
        lob.push({ pos: c.clone().add(new THREE.Vector3(hash1(h) - 0.5, hash1(h + 1) - 0.5, hash1(h + 2) - 0.5).multiplyScalar(0.007)), r: 0.0026 + 0.0013 * hash1(h + 3), rnd: hash1(h + 4), u: a1.u, w: a1.w });
      }
    });
  });
  const lm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), mats.lobule, lob.length); lm.name = 'lobule'; lm.userData.info = 'lobule'; group.add(lm);
  // Cooper 韌帶
  for (let k = 0; k < 28; k++) {
    const L0 = lob[Math.floor(hash1(k * 13 + 5) * lob.length)];
    const sk = P(L0.u + (hash1(k) - 0.5) * 0.01, L0.w + (hash1(k + 9) - 0.5) * 0.01, 1.0);
    const mid = L0.pos.clone().lerp(sk, 0.5).add(new THREE.Vector3(0, 0.003, 0));
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([L0.pos.clone(), mid, sk]), 8, 0.0005, 4), 'cooper');
  }
  // 淋巴結與淋巴管
  const lymphG = new THREE.Group(); group.add(lymphG);
  const sentinel = new THREE.Vector3(-0.128, 1.305, 0.035);
  const sn2 = add(new THREE.SphereGeometry(0.0075, 18, 12), 'sentinel', lymphG); sn2.position.copy(sentinel);
  [[-0.14, 1.32, 0.02, 0.005], [-0.148, 1.296, 0.008, 0.0045], [-0.137, 1.338, 0.0, 0.006], [-0.15, 1.33, -0.012, 0.0045], [-0.128, 1.355, -0.005, 0.005], [-0.03, 1.29, 0.084, 0.0028], [-0.03, 1.31, 0.086, 0.0028], [-0.029, 1.33, 0.088, 0.0028]].forEach(([x, y, z, r]) => { const m = add(new THREE.SphereGeometry(r * 1.4, 14, 10), 'node', lymphG); m.position.set(x, y, z); m.scale.set(1.25, 1, 1); });
  for (const [u, w] of [[0.05, 0.04], [0.06, -0.02], [0.0, 0.0], [0.03, 0.07]]) {
    const a = P(u, w, 0.6); const mid = a.clone().lerp(sentinel, 0.5).add(new THREE.Vector3(0, 0.01, 0.015));
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, mid, sentinel]), 20, 0.001, 5), 'lymph', lymphG);
  }
  for (const k of ['node', 'sentinel', 'lymph']) mats[k].depthTest = false;
  lymphG.traverse((o) => { if (o.isMesh) o.renderOrder = 9; });
  inst.root.add(group);
  inst.gd = { group, mats, lm, lob, lymphG, key: '' };
}
function updateGlandDetail(inst, s) {
  const gd = inst.gd; const show = s.glandDetail;
  gd.group.visible = show > 0.01;
  if (!gd.group.visible) return;
  for (const [k, m] of Object.entries(gd.mats)) {
    const op = ['node', 'sentinel', 'lymph'].includes(k) ? Math.min(show, s.lymph) : show;
    m.uniforms.uOpacity.value = op; const tr = op < 0.995 || !m.depthTest; if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.depthWrite = op > 0.6;
    m.uniforms.uHi.value = s.hiGland === k || (s.hiGland === 'duct' && k === 'sinus') ? 1 : 0;
  }
  gd.lymphG.visible = s.lymph > 0.01;
  const dk = s.density.toFixed(3);
  if (gd.key !== dk) {
    gd.key = dk; const frac = 0.3 + 0.7 * (s.density / 3); const mult = 0.75 + 0.2 * s.density; const mtx = new THREE.Matrix4();
    gd.lob.forEach((l, i) => { const r = l.rnd < frac ? l.r * mult : 0; mtx.makeScale(r, r, r).setPosition(l.pos); gd.lm.setMatrixAt(i, mtx); });
    gd.lm.instanceMatrix.needsUpdate = true; gd.lm.computeBoundingSphere();
  }
}

function regionBasePoint(inst, key, du, dw) {
  const reg = inst.regions[key]; const base = inst.skin.userData.base;
  let best = 0, bd = 1e9;
  for (let k = 0; k < reg.idx.length; k++) { const d = (reg.du[k] - du) ** 2 + (reg.dw[k] - dw) ** 2; if (d < bd) { bd = d; best = k; } }
  const i = reg.idx[best];
  return new THREE.Vector3(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]);
}

function computeTargets(inst) {
  const f = inst.regions.R.frame.f; const g = geomOf(BASE_STATE.R);
  inst.q = {};
  for (const [k, [a, b]] of Object.entries(Q_N)) {
    const u = g.uN + a * g.sc, w = g.wV + b * g.sc; const { drop } = breastField(u, w, BASE_STATE.R);
    inst.q[k] = regionBasePoint(inst, 'R', u, w).addScaledVector(f, 0.016).add(new THREE.Vector3(0, -drop * 0.8, 0));
  }
  const mound = regionBasePoint(inst, 'R', g.uN, g.wN - 0.01);
  inst.mound = mound.clone().addScaledVector(f, 0.022);
  // 胸大肌表面 → 假體位置
  const pec = inst.byName.get('pecmaj_r');
  raycaster.set(new THREE.Vector3(mound.x, mound.y, 0.5), new THREE.Vector3(0, 0, -1)); raycaster.far = 1;
  const hit = pec ? raycaster.intersectObject(pec, false)[0] : null;
  inst.chestWall = hit ? hit.point.clone().addScaledVector(f, -0.012) : mound.clone().addScaledVector(f, -0.02);
  inst.pec = {}; inst.d0 = {}; inst.moundBase = {};
  for (const key of ['R', 'L']) {
    const fk = inst.regions[key].frame.f; const gk = geomOf(BASE_STATE[key]); const m = regionBasePoint(inst, key, gk.uN, gk.wN - 0.01);
    const pm = inst.byName.get(key === 'R' ? 'pecmaj_r' : 'pecmaj_l');
    if (pm?.userData.basePos) resetPec(pm);
    raycaster.set(new THREE.Vector3(m.x, m.y, 0.5), new THREE.Vector3(0, 0, -1)); raycaster.far = 1;
    const h = pm ? raycaster.intersectObject(pm, false)[0] : null;
    inst.pec[key] = h ? h.point.clone() : m.clone().addScaledVector(fk, -0.008);
    inst.d0[key] = Math.max(m.clone().sub(inst.pec[key]).dot(fk), 0.004); inst.moundBase[key] = m;
    if (pm) inst.key['pec' + key] = '';
  }
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
  flap: { kind: null, t: 0, vis: 0 }, imp: { kind: null, fill: 0, vis: 0 }, anast: 0,
  tumorAt: null, custom: [], keepGland: false, xray: false,
  aug: { plane: null, fill: 0, vis: 0, shapeR: 'round', shapeL: 'round' }, glandShell: 1, glandDetail: 0, hiGland: '', density: 1.5, fatOp: null, lymph: 0,
  gf: { tech: null, t: 0, vis: 0, arc: 0, zone: null }, wscars: [], woundAt: null, perfAt: null, paddleR: null, fatg: 0,
  nodes: 0, dye: 0, flow: 0, slnGone: 0, clipGone: 0, gI: 0, gII: 0, probe: 0, drain: 0, clip: 0, hiNode: '', vesselsOnly: [], perfMap: 0, perfCourse: 0
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
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) return b.map((v, i) => lerpState(a[i], v, t));
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
  if (to.gf.tech && (f.gf.tech !== to.gf.tech || f.gf.zone !== to.gf.zone)) f.gf = { tech: to.gf.tech, t: 0, vis: to.gf.vis, arc: to.gf.arc, zone: to.gf.zone };
  if (!to.gf.tech && f.gf.tech) to.gf = { ...f.gf, vis: 0 };
  if (to.aug.plane && !f.aug.plane) f.aug = { ...to.aug, fill: 0, vis: 0 };
  if (!to.aug.plane && f.aug.plane) to.aug = { ...f.aug, vis: 0 };
  return f;
}

// ---------- 套用狀態 ----------
// ---------- 假體尺寸與位置 ----------
// 體積(mL)→ 底寬、突度(公尺);為圓形中突度假體的近似值,待醫師依常用型號修改
function implDims(ml) { return { W: 0.1 + (0.012 * (ml - 200)) / 100, proj: 0.032 + (0.006 * (ml - 200)) / 100 }; }
const defImplMl = () => Math.round((estVolume() * 0.8) / 25) * 25;
const PLANE_OFF = { pre: 0.002, subglandular: 0.002, dual: -0.006, sub: -0.011 };
const PLANE_COVER = { pre: 0.007, subglandular: 0.009, dual: 0.009, sub: 0.013 };
function implantPose(inst, side, s) {
  const recon = side === 'R' && s.imp.kind && s.imp.vis > 0.01;
  const aug = s.aug.plane && s.aug.vis > 0.01;
  if (!recon && !aug) return null;
  const a = recon ? s.imp : s.aug;
  const plane = recon ? (a.plane || 'sub') : a.plane;
  const ml = a.ml ?? (recon ? defImplMl() : 300); const { W, proj } = implDims(ml);
  const half = 0.003 + (proj / 2 - 0.003) * Math.max(a.fill, 0);
  const f = inst.regions[side].frame.f;
  const c = inst.pec[side].clone().addScaledVector(f, half + PLANE_OFF[plane]).add(new THREE.Vector3(0, -0.006, 0));
  const front = c.clone().sub(inst.pec[side]).dot(f) + half;
  return { c, f, a: W / 2, b: (W / 2) * 0.95, half, plane, ml, need: front + PLANE_COVER[plane] - inst.d0[side] };
}
function resetPec(pm) {
  const g = pm.geometry;
  g.attributes.position.array.set(pm.userData.basePos); g.attributes.position.needsUpdate = true;
  g.attributes.normal.array.set(pm.userData.baseNrm); g.attributes.normal.needsUpdate = true;
  g.computeBoundingSphere(); g.computeBoundingBox();
}
// 胸大肌下或雙平面:把胸大肌往前推,蓋在假體前方(雙平面只蓋上半部)
function drapePec(inst, side, pose) {
  const pm = inst.byName.get(side === 'R' ? 'pecmaj_r' : 'pecmaj_l'); if (!pm) return;
  const mode = pose && (pose.plane === 'sub' || pose.plane === 'dual') ? pose.plane : '';
  const k = mode ? JSON.stringify([pose.c.toArray().map((v) => +v.toFixed(4)), +pose.half.toFixed(4), +pose.a.toFixed(4), mode]) : '';
  if (inst.key['pec' + side] === k) return;
  inst.key['pec' + side] = k; resetPec(pm); if (!mode) return;
  const f = pose.f; const e1 = new THREE.Vector3(1, 0, 0).addScaledVector(f, -f.x).normalize(); const e2 = new THREE.Vector3().crossVectors(f, e1);
  const arr = pm.geometry.attributes.position.array; const v = new THREE.Vector3();
  for (let i = 0; i < arr.length; i += 3) {
    v.set(arr[i], arr[i + 1], arr[i + 2]).sub(pose.c);
    const lx = v.dot(e1) / pose.a, ly = v.dot(e2) / pose.b; const r = Math.hypot(lx, ly); if (r > 1.25) continue;
    const zImp = pose.half * Math.pow(Math.max(0, 1 - Math.min(r, 1) ** 2), 0.7);
    let sh = Math.max(0, zImp + 0.003 - v.dot(f)) * (1 - smooth(0.7, 1.25, r));
    if (mode === 'dual') sh *= smooth(-0.5, 0.05, ly);
    arr[i] += f.x * sh; arr[i + 1] += f.y * sh; arr[i + 2] += f.z * sh;
  }
  pm.geometry.attributes.position.needsUpdate = true; pm.geometry.computeVertexNormals(); pm.geometry.computeBoundingSphere(); pm.geometry.computeBoundingBox();
}

function updateBreasts(inst, s) {
  const poses = { R: implantPose(inst, 'R', s), L: implantPose(inst, 'L', s) };
  const k = JSON.stringify([s.R, s.L, PROFILE.ver, poses.R?.need.toFixed(4), poses.L?.need.toFixed(4)]);
  inst.poses = poses;
  if (inst.key.breast === k) return false;
  inst.key.breast = k;
  const geom = inst.skin.geometry; const arr = geom.attributes.position.array; const base = inst.skin.userData.base;
  arr.set(base);
  inst.nipple = {}; inst.geo = {}; inst.meas = {};
  for (const key of ['R', 'L']) {
    const reg = inst.regions[key]; const f = reg.frame.f;
    let p = s[key]; const pose = poses[key];
    // 有假體時,皮膚至少要蓋住假體(fit:完全由假體決定外形)
    if (pose) { const g0 = geomOf(p); if (p.fit || g0.P < pose.need) p = { ...p, Pabs: p.fit ? Math.max(pose.need, 0.004) : Math.max(g0.P, pose.need) }; }
    const g = geomOf(p); p = { ...p, g }; inst.geo[key] = g;
    // 假體處:皮膚至少在假體表面外 cover 的距離(逐點包覆,避免假體或胸大肌穿出皮膚)
    let wrap = null;
    if (pose) {
      const e1 = new THREE.Vector3(1, 0, 0).addScaledVector(pose.f, -pose.f.x).normalize(); const e2 = new THREE.Vector3().crossVectors(pose.f, e1);
      const cover = PLANE_COVER[pose.plane]; const v = new THREE.Vector3();
      wrap = (i) => {
        v.set(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]).sub(pose.c);
        const r = Math.hypot(v.dot(e1) / pose.a, v.dot(e2) / pose.b); if (r > 1.8) return 0;
        const z = pose.half * Math.pow(Math.max(0, 1 - Math.min(r, 1) ** 2), 0.7);
        return Math.max(0, z + cover - v.dot(pose.f)) * (1 - smooth(0.75, 1.8, r));
      };
    }
    const [nu, nw] = [g.nU + (p.nsu || 0), g.nW + (p.nsw || 0)];
    let maxD = -1, maxI = -1; let top = -1e9, low = 1e9;
    for (let j = 0; j < reg.idx.length; j++) {
      const i = reg.idx[j]; let { D, drop } = breastField(reg.du[j], reg.dw[j], p); const wk = reg.wt[j]; D *= wk; drop *= wk;
      if (wrap) { const need = wrap(i); drop *= 1 - 0.75 * smooth(-0.012, 0.012, need - D); if (need > D) D = need + nipBump(reg.du[j], reg.dw[j], p, g); }
      arr[i * 3] += f.x * D; arr[i * 3 + 1] += f.y * D - drop; arr[i * 3 + 2] += f.z * D;
      const dn = (reg.du[j] - nu) ** 2 + (reg.dw[j] - nw) ** 2;
      if (D > 0.01 && dn < 0.0004 && D - dn * 20 > maxD) { maxD = D - dn * 20; maxI = i; }
      if (Math.abs(reg.du[j] - nu) < 0.012 && g.P > 0.01) { const y = arr[i * 3 + 1]; if (D > 0.33 * g.P && y > top) top = y; if (D > 0.05 * g.P && y < low) low = y; }
    }
    // 乳頭位置直接由公式算出(不靠尋找最突出的頂點,切換時不會消失)
    let nip = null;
    if (g.P > 0.004) nip = basePointInterp(inst, key, nu, nw, arr);
    else if (maxI >= 0) nip = new THREE.Vector3(arr[maxI * 3], arr[maxI * 3 + 1], arr[maxI * 3 + 2]);
    inst.nipple[key] = nip && p.areola ? nip : null;
    // 模型實測:上極(乳房上緣到乳頭)與下極(乳頭到最低點)的垂直比例
    if (nip && top > low) inst.meas[key] = { up: (top - nip.y) / (top - low), imf: reg.c.y + g.bot - nip.y };
    // 脂肪與乳腺殼
    for (const [part, scale, off] of [['fat_', 1, -0.004], ['gland_', 0.72, -0.006]]) {
      const m = inst.byName.get(part + key); const gm = m.geometry; const pa = gm.attributes.position.array; const { src, regionK } = gm.userData;
      for (let v = 0; v < src.length; v++) {
        const i = src[v], j = regionK[v]; let { D, drop } = breastField(reg.du[j], reg.dw[j], p); D *= reg.wt[j]; drop *= reg.wt[j];
        if (wrap) { const need = wrap(i); drop *= 1 - 0.75 * smooth(-0.012, 0.012, need - D); if (need > D) D = need + nipBump(reg.du[j], reg.dw[j], p, g); }
        const d = Math.max(D * scale + off, -0.003);
        pa[v * 3] = base[i * 3] + f.x * d; pa[v * 3 + 1] = base[i * 3 + 1] + f.y * d - drop * scale; pa[v * 3 + 2] = base[i * 3 + 2] + f.z * d;
      }
      gm.attributes.position.needsUpdate = true; gm.computeVertexNormals(); gm.computeBoundingSphere();
      m.userData.sideP = g.P;
    }
  }
  geom.attributes.position.needsUpdate = true; geom.computeVertexNormals(); geom.computeBoundingSphere(); geom.computeBoundingBox();
  // 皮島:放在乳房中央(原乳頭位置)
  const mu = inst.skin.material.uniforms; const gR = inst.geo.R;
  const nR = regionBasePoint(inst, 'R', gR.uN, gR.wN - 0.004);
  const fr = breastField(gR.uN, gR.wN - 0.004, { ...s.R, g: gR });
  nR.addScaledVector(inst.regions.R.frame.f, Math.max(fr.D, 0)).add(new THREE.Vector3(0, -fr.drop, 0));
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

function applyState(inst, s, tweening = false) {
  inst.state = s;
  const changed = updateBreasts(inst, s);
  const peel = s.peel;
  for (const m of inst.parts) {
    const L = m.userData.layer; if (L === undefined || L > 4) continue;
    let op = L < 4 ? Math.min(Math.max(L + 1 - peel, 0), 1) : 1;
    // 胸部與腹部以外(四肢、臀部)只顯示皮膚;皮瓣情境高亮時才顯示該肌肉
    if (LIMB.test(m.name) && !s.hi.some((h) => m.name.startsWith(h))) op = 0;
    if (L === 0) op *= s.ghostSkin;
    if (L === 3) op *= s.ghostMus;
    if (m.name.startsWith('fat_') || m.name.startsWith('gland_')) { const sd = s[m.name.slice(-1)]; const isFat = m.name.startsWith('fat_'); if (!isFat && s.glandShell === 0) op = 0; if (isFat && s.fatOp != null && sd.fat && sd.P > 0.008) op = s.fatOp; else if (sd.P < 0.008 || !sd[isFat ? 'fat' : 'gland'] || (s.ghostSkin < 0.9 && !(s.keepGland && !isFat)) || (peel < 0.3 && !(s.keepGland && !isFat && s.ghostSkin < 0.9))) op = 0; }
    setOpacity(m, op);
    if (m.material.uniforms) m.material.uniforms.uHi.value = s.hi.some((h) => m.name.startsWith(h)) ? 1 : 0;
  }
  if (inst.abdFat) setOpacity(inst.abdFat, inst.abdFat.material.uniforms.uOpacity.value * (s.ghostSkin > 0.9 ? 1 : 0) * (1 - s.wound) * (peel > 0.02 ? 1 : 0));
  updatePerfMap(inst, s);
  const deep = peel >= 1.5 || s.ghostSkin < 0.9 || s.ghostMus < 0.9;
  for (const [name, obj] of inst.byName) if (obj.userData.vessel) { obj.userData.mat.uniforms.uHi.value = s.vessels.includes(name) ? 1 : 0; obj.visible = deep && (!s.vesselsOnly.length || s.vesselsOnly.includes(name)) && (!LIMB_V.test(name) || s.vessels.includes(name) || s.vesselsOnly.includes(name)); }
  // 乳暈、皮島、傷口
  const mu = inst.skin.material.uniforms;
  const nR = inst.nipple?.R, nL = inst.nipple?.L;
  mu.uAreR.value.set(nR?.x || 0, nR?.y || 0, nR?.z || 0, nR ? 0.006 + 0.011 * (s.R.tat ?? 1) : 0);
  mu.uAreL.value.set(nL?.x || 0, nL?.y || 0, nL?.z || 0, nL ? 0.006 + 0.011 * (s.L.tat ?? 1) : 0);
  mu.uPaddle.value.w = s.paddle;
  if (s.paddleR) mu.uPaddleR.value.set(...s.paddleR); else mu.uPaddleR.value.set(0.045, 0.032, 0.06);
  mu.uWound.value.w = s.wound;
  if (s.woundAt) { mu.uWound.value.set(s.woundAt.c[0], s.woundAt.c[1], s.woundAt.c[2], s.wound); mu.uWoundR.value.set(...s.woundAt.r); }
  else { mu.uWound.value.set(0, 0.955, 0.11, s.wound); mu.uWoundR.value.set(0.13, 0.05, 0.08); }
  // 腫瘤與缺損
  const ta = s.tumorAt;
  const q = ta ? simTumorPoint(inst, s) : qPoint(inst, s, s.tq);
  const cutSide = ta ? ta.side : 'R';
  inst.tumor.position.copy(q); inst.margin.position.copy(q); inst.cavity.position.copy(q);
  inst.tumor.scale.setScalar(ta ? ta.tr / 0.0095 : 1); inst.margin.scale.setScalar(ta ? ta.er / 0.02 : 1); inst.cavity.scale.setScalar(ta ? ta.er / 0.021 : 1);
  const xray = !!s.xray;
  for (const m of [inst.tumor, inst.margin]) { m.material.depthTest = !xray; m.renderOrder = xray ? 8 : 0; m.material.userData.alwaysTransparent = xray || m === inst.margin; }
  setOpacity(inst.tumor, peel >= 1.5 || s.ghostSkin < 0.9 || xray ? s.tumor : 0);
  setOpacity(inst.margin, peel >= 1.5 || s.ghostSkin < 0.9 || xray ? s.margin * (1 - s.cut) : 0);
  const filled = s.flap.kind && (s.flap.kind === 'ld' || s.flap.kind === 'omentum') && s.flap.t > 0.98;
  setOpacity(inst.cavity, peel >= 1.5 && s.cut > 0.01 && !filled ? Math.min(s.cut, 1) : 0);
  const cutR = ta ? ta.er : 0.021;
  for (const sd of ['R', 'L']) for (const part of ['fat_', 'gland_']) inst.byName.get(part + sd).material.uniforms.uCut.value.set(q.x, q.y, q.z, sd === cutSide ? cutR * s.cut : 0);
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
  // 假體(重建,右側)
  const pR = s.imp.kind && s.imp.vis > 0.01 ? inst.poses.R : null;
  if (pR) {
    const f = pR.f; const half = pR.half;
    inst.implant.position.copy(pR.c);
    inst.implant.scale.set(pR.a, pR.b, half); inst.implant.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), f);
    inst.implant.userData.info = s.imp.kind;
    const col = s.imp.kind === 'expander' ? PAL.expander : PAL.implant;
    inst.implant.material.uniforms.uColor.value.set(col[0]); inst.implant.material.uniforms.uShade.value.set(col[1]);
    const vis = peel >= 0.5 || s.ghostSkin < 0.9 ? s.imp.vis * 0.9 : 0;
    setOpacity(inst.implant, vis); inst.implant.material.userData.alwaysTransparent = true;
    inst.port.visible = s.imp.kind === 'expander' && vis > 0.01;
    inst.port.position.copy(inst.implant.position).addScaledVector(f, half + 0.001).add(new THREE.Vector3(0, -0.012, 0));
    inst.port.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), f);
    const admOn = (s.imp.adm || 0) > 0.01 && vis > 0.01;
    if (admOn) {
      inst.adm.geometry = s.imp.admType === 'wrap' ? inst.admWrap : inst.admLower;
      inst.adm.position.copy(inst.implant.position); inst.adm.quaternion.copy(inst.implant.quaternion);
      inst.adm.scale.set(pR.a * 1.07, pR.b * 1.07, half * 1.15);
      inst.adm.material.userData.alwaysTransparent = true; setOpacity(inst.adm, 0.55 * s.imp.adm);
    } else setOpacity(inst.adm, 0);
  } else { setOpacity(inst.implant, 0); inst.port.visible = false; setOpacity(inst.adm, 0); }
  // 隆乳假體
  for (const key of ['R', 'L']) {
    const m = inst.augM[key]; const a = s.aug; const ps = inst.poses[key];
    if (!a.plane || a.vis < 0.01 || !ps || (key === 'R' && pR)) { setOpacity(m, 0); continue; }
    m.geometry = inst.geoms[a['shape' + key] === 'tear' ? 'tear' : 'round'];
    if (m.userData.outline) m.userData.outline.geometry = m.geometry;
    m.position.copy(ps.c); m.scale.set(ps.a, ps.b, ps.half);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), ps.f);
    m.material.userData.alwaysTransparent = true;
    setOpacity(m, peel >= 0.5 || s.ghostSkin < 0.9 ? a.vis * 0.9 : 0);
  }
  for (const key of ['R', 'L']) drapePec(inst, key, inst.poses[key]);
  updateGlandDetail(inst, s);
  updateGenericFlap(inst, s);
  updateAxilla(inst, s);
  // 穿通枝標記
  if (s.perfAt) { inst.perf.position.set(...s.perfAt); inst.perf.scale.setScalar(1 + 0.3 * Math.sin(TIME.value * 4)); setOpacity(inst.perf, 1); inst.perf.material.userData.alwaysTransparent = true; } else setOpacity(inst.perf, 0);
  // 脂肪滴
  inst.fatDrops.visible = s.fatg > 0.01;
  if (inst.fatDrops.visible) { const n = Math.round(s.fatg * inst.fatDrops.userData.total); inst.fatDrops.count = n; }
  // 吻合點
  inst.anast.position.copy(inst.anastPos); setOpacity(inst.anast, s.anast);
  inst.anast.scale.setScalar(1 + 0.35 * Math.sin(TIME.value * 4));
  // 疤痕
  const sk = JSON.stringify([s.scars, s.custom, s.wscars, inst.key.breast]);
  if (inst.key.scars !== sk) {
    if (tweening) { inst.scars.visible = false; return changed; }
    inst.key.scars = sk; inst.root.remove(inst.scars);
    inst.scars.traverse((o) => o.geometry?.dispose());
    inst.scars = buildScars(inst, s.scars, s.custom, s.wscars); inst.root.add(inst.scars);
  }
  inst.scars.visible = peel < 0.5 && s.ghostSkin > 0.3;
  return changed;
}

// 情境中的象限目標點:隨目前乳房下垂一起下移
function qPoint(inst, s, zone) {
  return inst.q[zone];
}
function simTumorPoint(inst, s) {
  const ta = s.tumorAt; const key = JSON.stringify([ta, s[ta.side], PROFILE.ver]);
  if (inst.key.tumorPt === key) return inst.tumorPt;
  const p = { ...s[ta.side], defects: [], defect: 0 };
  const { D, drop } = breastField(ta.u, ta.w, p);
  const pt = regionBasePoint(inst, ta.side, ta.u, ta.w).addScaledVector(inst.regions[ta.side].frame.f, Math.max(D, 0.008) * ta.depth).add(new THREE.Vector3(0, -drop * ta.depth, 0));
  inst.key.tumorPt = key; inst.tumorPt = pt; return pt;
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
  cmplabels: document.getElementById('cmplabels'), selA: document.getElementById('selA'), selB: document.getElementById('selB'),
  cmpA: document.getElementById('cmpA'), cmpB: document.getElementById('cmpB'), loading: document.getElementById('loading'), callout: document.getElementById('callout'),
  infoName: document.getElementById('infoName'), infoEn: document.getElementById('infoEn'), infoText: document.getElementById('infoText'), infoClin: document.getElementById('infoClin'),
  pros: document.getElementById('pros'), cons: document.getElementById('cons'), fit: document.getElementById('fit'), pcTitle: document.getElementById('pcTitle'), table: document.getElementById('cmpTable')
};
const app = { perfSel: null, scn: 'bcs', cat: 'surgery', ovAll: false, step: 0, mode: 'single', peelOverride: null, tween: null, camTween: null, pick: null, cmp: { id: 'bcs_mast', opt: {}, free: false } };

// 連續剝層:介於兩層之間時顯示「上一層 → 下一層」與進度
function peelLabel(v) {
  const a = Math.floor(v + 1e-6), f = v - a;
  if (f < 0.04 || a >= LAYER_NAMES.length - 1) return LAYER_NAMES[Math.min(a, LAYER_NAMES.length - 1)];
  if (f > 0.96) return LAYER_NAMES[a + 1];
  return `${LAYER_NAMES[a]} → ${LAYER_NAMES[a + 1]} ${Math.round(f * 100)}%`;
}
function el(tag, attrs = {}, text) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text !== undefined) e.textContent = text; return e; }

function buildUI() {
  const cats = document.getElementById('cats');
  for (const c of CATS) { const b = el('button', { class: 'tab', 'aria-pressed': 'false', 'data-cat': c.id }, c.zh); b.addEventListener('click', () => selectScenario(SCENARIOS.find((x) => x.cat === c.id).id)); cats.append(b); }
  const cmpTab = el('button', { class: 'tab simtab', 'aria-pressed': 'false', 'data-cat': 'cmp' }, '並排比較');
  cmpTab.addEventListener('click', () => setMode('compare')); cats.append(cmpTab);
  const simTab = el('button', { class: 'tab simtab', 'aria-pressed': 'false', 'data-cat': 'sim' }, '模擬我的腫瘤');
  simTab.addEventListener('click', selectSim); cats.append(simTab);
  buildProfileUI(); buildCompareUI();
  document.getElementById('ovAll').addEventListener('click', (e) => { app.ovAll = !app.ovAll; e.currentTarget.setAttribute('aria-pressed', String(app.ovAll)); renderOverview(); });
  buildSimUI();
  for (const [id, label] of VIEW_LABELS) {
    const b = el('button', { class: 'ctl', 'aria-pressed': 'false', 'data-v': id }, label);
    b.addEventListener('click', () => flyTo(id)); ui.views.append(b);
  }
  for (const sel of [ui.selA, ui.selB]) for (const e of END_STATES) sel.append(el('option', { value: e.id }, e.label));
  const free = () => { app.cmp.free = true; renderCompareUI(); setupCompare(); };
  ui.selA.addEventListener('change', free); ui.selB.addEventListener('change', free);
  ui.prev.addEventListener('click', () => goStep(app.step - 1));
  ui.next.addEventListener('click', () => goStep(app.step + 1));
  const setPeel = (v) => { app.peelOverride = v; ui.peelName.textContent = peelLabel(v); for (const i of instances) { if (i.target) i.target.peel = v; if (!i.tween && i.state) { i.state.peel = v; applyState(i, i.state); } } };
  ui.peel.addEventListener('input', () => setPeel(Number(ui.peel.value)));
  // 放開時靠近整數層就吸附
  ui.peel.addEventListener('change', () => { const v = Number(ui.peel.value), r = Math.round(v); if (Math.abs(v - r) < 0.1) { ui.peel.value = String(r); setPeel(r); } });
  ui.mSingle.addEventListener('click', () => setMode('single'));
  ui.mCompare.addEventListener('click', () => setMode('compare'));
}

function renderTabs(cat) {
  for (const b of document.getElementById('cats').children) b.setAttribute('aria-pressed', String(b.dataset.cat === (app.mode === 'compare' ? 'cmp' : cat)));
  ui.tabs.replaceChildren(...SCENARIOS.filter((x) => x.cat === cat).map((x) => {
    const b = el('button', { class: 'tab', 'aria-pressed': String(x.id === app.scn), 'data-id': x.id }, x.short);
    b.addEventListener('click', () => selectScenario(x.id)); return b;
  }));
  ui.tabs.hidden = cat === 'sim' || cat === 'cmp';
}

function renderOverview() {
  const cat = app.cat; const rows = SCENARIOS.filter((x) => x.meta && (app.ovAll || x.cat === cat || cat === 'sim'));
  document.getElementById('ovTitle').textContent = app.ovAll || cat === 'sim' ? '術式總覽(全部)' : `術式總覽:${CATS.find((c) => c.id === cat)?.zh || ''}`;
  const head = ['術式', '分類', '組織來源', '取用肌肉', '血管', '方式', '額外疤痕', '主要風險'];
  const thead = el('thead'); const hr = el('tr'); for (const h of head) hr.append(el('th', {}, h)); thead.append(hr);
  const tbody = el('tbody');
  for (const x of rows) {
    const tr = el('tr', x.id === app.scn ? { class: 'cur' } : {}); const m = x.meta;
    const nm = el('td', { class: 'nm' }); const a = el('a', { href: '#' + x.id }, x.short); a.addEventListener('click', (e) => { e.preventDefault(); selectScenario(x.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }); nm.append(a);
    tr.append(nm); for (const v of [CATS.find((c) => c.id === x.cat)?.zh, m.src, m.muscle, m.vessel, m.mode, m.scar, m.risk]) tr.append(el('td', {}, v || '—'));
    tbody.append(tr);
  }
  ui.table.replaceChildren(thead, tbody);
}

function selectScenario(id) {
  app.scn = id; app.step = 0; app.cat = SCENARIOS.find((s) => s.id === id).cat; renderTabs(app.cat); renderOverview();
  if (app.mode === 'compare') { app.mode = 'single'; syncModeUI(); }
  showPanels();
  const scn = SCENARIOS.find((s) => s.id === id);
  ui.scnTag.textContent = scn.tag; ui.scnName.textContent = scn.name; ui.scnOne.textContent = scn.one;
  ui.steps.replaceChildren(...scn.steps.map((st, i) => {
    const li = el('li'); const b = el('button'); b.append(el('span', { class: 'n' }, String(i + 1)), el('span', {}, st.title));
    b.addEventListener('click', () => goStep(i)); li.append(b); return li;
  }));
  ui.pcTitle.textContent = scn.name + ':優點與限制';
  for (const [k, list] of [['pros', scn.pros], ['cons', scn.cons], ['fit', scn.fit]]) ui[k].replaceChildren(...list.map((t) => el('li', {}, t)));
  const scnCat = SCENARIOS.find((s) => s.id === id).cat;
  const [a, b] = COMPARE_DEFAULT[id] || (scnCat === 'partial' ? ['bcs', id] : [id === 'diep' ? 'tram' : 'diep', id]); ui.selA.value = a; ui.selB.value = b;
  goStep(0, true);
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
  ui.peel.value = String(to.peel); ui.peelName.textContent = peelLabel(to.peel);
  app.perfSel = null; renderPerfBox(to.perfMap > 0.5);
  transition(instances[0], to, instant ? 0 : (scn.steps[i].dur || 1300));
  flyTo(to.cam, instant);
}

// 穿通枝報告表(CTA 報告格式示意),點選列可單獨標示
function renderPerfBox(show) {
  const box = $('perfBox'); box.hidden = !show; box.innerHTML = ''; if (!show) return;
  const t = el('table', { class: 'perftab' }); const hr = el('tr');
  for (const h of ['', '位置', '距肚臍(cm)', '管徑', '肌內']) hr.append(el('th', {}, h));
  const thead = el('thead'); thead.append(hr); t.append(thead); const tb = el('tbody');
  for (const d of PERF_MAP) {
    const tr = el('tr', { tabindex: '0', role: 'button', 'aria-pressed': String(app.perfSel === d.id) });
    const side = d.side === 'R' ? '右' : '左';
    tr.append(el('td', {}, d.id + (d.dom ? ' ★' : '')), el('td', {}, side + d.row.slice(0, 2)), el('td', {}, `外 ${d.dx}・${d.dy < 0 ? '下' : '上'} ${Math.abs(d.dy)}`), el('td', {}, d.dia + ' mm'), el('td', {}, d.im + ' cm'));
    const pick = () => { app.perfSel = app.perfSel === d.id ? null : d.id; renderPerfBox(true); for (const i of instances) if (i.state) updatePerfMap(i, i.state); };
    tr.addEventListener('click', pick); tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    tb.append(tr);
  }
  t.append(tb); box.append(t);
  box.append(el('p', { class: 'hint' }, '★ 預計使用的主要穿通枝。數值為衛教示意,實際以您的 CTA 報告為準。'));
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
function syncModeUI() {
  ui.mSingle.setAttribute('aria-pressed', String(app.mode === 'single')); ui.mCompare.setAttribute('aria-pressed', String(app.mode === 'compare'));
  ui.cmplabels.hidden = app.mode !== 'compare';
  renderTabs(app.cat);
}
function showPanels() {
  const cmp = app.mode === 'compare', sim = app.scn === 'sim';
  $('cmpPanel').hidden = !cmp; $('simPanel').hidden = cmp || !sim; $('stepPanel').hidden = cmp || sim; $('pcSect').hidden = cmp || sim;
}
// 依目前情境挑一個相關的比較主題
const CMP_FOR = { bcs: 'bcs_mast', masttypes: 'mast_recon', ld: 'bcs_recon', omentum: 'bcs_recon', fatgraft: 'bcs_recon', implant: 'implant_plane', implplanes: 'implant_plane', tram: 'impl_diep', diep: 'impl_diep', symm: 'contra', aug: 'aug_look' };
function setMode(mode) {
  if (mode === 'compare' && app.mode !== 'compare') {
    const sc = SCENARIOS.find((x) => x.id === app.scn);
    const id = CMP_FOR[app.scn] || (sc?.cat === 'axilla' ? 'slnb_alnd' : sc?.cat === 'partial' ? 'bcs_recon' : sc?.cat === 'abdo' || sc?.cat === 'other' ? 'impl_diep' : null);
    if (id) { app.cmp.id = id; app.cmp.free = false; }
  }
  app.mode = mode; syncModeUI(); showPanels();
  if (mode === 'compare') { renderCompareUI(); setupCompare(true); }
  else if (app.scn === 'sim') updateSim(false); else { const to = stepState(app.scn, app.step); transition(instances[0], to, 600); flyTo(to.cam); }
  resize();
}
function presetState(part, cam, peel) {
  const s = merge(BASE_STATE, part.state); s.peel = peel ?? 0; s.cam = cam;
  if (s.R.dq === undefined) s.R.dq = s.tq;
  return s;
}
function currentPreset() {
  const pr = PRESETS.find((x) => x.id === app.cmp.id);
  const o = {}; for (const op of pr.opts) o[op.key] = app.cmp.opt[pr.id + ':' + op.key] ?? op.choices[0][0];
  return { pr, o, res: pr.build(o) };
}
function setupCompare(fly = false) {
  if (app.mode !== 'compare') return;
  let a, b, la, lb, cam;
  if (app.cmp.free) {
    const pv = app.peelOverride ?? 0;
    a = endState(ui.selA.value); b = endState(ui.selB.value); a.peel = pv; b.peel = pv; cam = 'oblique';
    la = END_STATES.find((e) => e.id === ui.selA.value).label; lb = END_STATES.find((e) => e.id === ui.selB.value).label;
  } else {
    const { res } = currentPreset(); cam = res.cam;
    a = presetState(res.a, cam, res.peel); b = presetState(res.b, cam, res.peel); la = res.a.label; lb = res.b.label;
    app.peelOverride = null; ui.peel.value = String(res.peel || 0); ui.peelName.textContent = peelLabel(res.peel || 0);
  }
  transition(instances[0], a, 900); transition(instances[1], b, 900);
  ui.cmpA.textContent = 'A ' + la; ui.cmpB.textContent = 'B ' + lb;
  if (fly || !app.camTween) flyTo(cam);
}
function buildCompareUI() {
  $('cmpPresets').replaceChildren(...PRESETS.map((p) => {
    const b = el('button', { class: 'chip', 'aria-pressed': 'false', 'data-id': p.id }, p.zh);
    b.addEventListener('click', () => { app.cmp.id = p.id; app.cmp.free = false; $('cmpFree').open = false; renderCompareUI(); setupCompare(true); }); return b;
  }));
}
function renderCompareUI() {
  for (const b of $('cmpPresets').children) b.setAttribute('aria-pressed', String(!app.cmp.free && b.dataset.id === app.cmp.id));
  if (app.cmp.free) {
    $('cmpOpts').replaceChildren(); $('cmpText').textContent = '左右各選一個術式的結果,用滑桿可一起剝開看內部。'; $('cmpDiff').replaceChildren(); $('cmpSection').hidden = true; $('cmpFree').open = true; return;
  }
  const { pr, o, res } = currentPreset();
  const kids = [];
  if (pr.opts.length) kids.push(el('h3', {}, '2. 選項'));
  for (const op of pr.opts) {
    const row = el('div', { class: 'optrow' }); row.append(el('span', {}, op.zh));
    const g = el('div', { class: 'chips', role: 'group', 'aria-label': op.zh });
    for (const [v, lab] of op.choices) {
      const b = el('button', { class: 'chip', 'aria-pressed': String(o[op.key] === v) }, lab);
      b.addEventListener('click', () => { app.cmp.opt[pr.id + ':' + op.key] = v; renderCompareUI(); setupCompare(true); }); g.append(b);
    }
    row.append(g); kids.push(row);
  }
  $('cmpOpts').replaceChildren(...kids);
  $('cmpText').textContent = res.text;
  const thead = el('thead'); const hr = el('tr'); hr.append(el('th', {}, 'A ' + res.a.label), el('th', {}, 'B ' + res.b.label)); thead.append(hr);
  const tb = el('tbody'); for (const [x, y] of res.diffs) { const tr = el('tr'); tr.append(el('td', {}, x), el('td', {}, y)); tb.append(tr); }
  $('cmpDiff').replaceChildren(thead, tb);
  const sec = $('cmpSection'); sec.hidden = !pr.section;
  if (pr.section) sec.innerHTML = sectionSVG(Number(o.ml)) + '<figcaption>側面剖面示意(左為胸壁,右為前方)。假體大小依體積換算的近似值。</figcaption>';
}

// 側面剖面示意圖:胸大肌下 vs 胸大肌前(單位約 1 mm)
function sectionSVG(ml) {
  const { W, proj } = implDims(ml); const H = W * 1000, Pj = proj * 1000;
  const panel = (ox, plane, title) => {
    const cy = 128, top = cy - H / 2, bot = cy + H / 2, rib = 30;
    const front = (y) => (y <= top || y >= bot ? 0 : Pj * Math.sqrt(1 - ((y - cy) / (H / 2)) ** 2));
    const xb = plane === 'sub' ? rib + 6 : rib + 15; // 假體背面
    const ys = []; for (let y = 10; y <= 236; y += 4) ys.push(y);
    const pecIn = (y) => (plane === 'sub' && y > top - 8 && y < bot + 6 ? Math.max(rib + 6, xb + front(y) + 1) : rib + 6);
    const pecOn = (y) => y < (plane === 'sub' ? bot + 10 : 190);
    const pts = (fx) => ys.map((y) => `${(ox + fx(y)).toFixed(1)},${y}`).join(' ');
    const pecYs = ys.filter(pecOn);
    const pec = pecYs.map((y) => `${(ox + pecIn(y)).toFixed(1)},${y}`).concat(pecYs.slice().reverse().map((y) => `${(ox + pecIn(y) + 9).toFixed(1)},${y}`)).join(' ');
    const ant = (y) => Math.max(rib + 15, plane === 'sub' ? pecIn(y) + 9 : Math.max(rib + 15, xb + front(y) + 1.5));
    const skin = (y) => ant(y) + 9 + 4 * Math.exp(-(((y - cy) / 40) ** 2));
    const imp = ys.filter((y) => y > top && y < bot).map((y) => `${(ox + xb + front(y)).toFixed(1)},${y}`);
    const implPath = `M${ox + xb},${top} L${imp.join(' L')} L${ox + xb},${bot} Z`;
    const ribs = [40, 66, 92, 118, 144, 170, 196, 222].map((y) => `<ellipse cx="${ox + rib - 6}" cy="${y}" rx="7" ry="5" fill="#efe6cf" stroke="#a99a78"/>`).join('');
    const adm = plane === 'pre' ? `<path d="M${ox + xb - 1},${top - 2} L${imp.map((p) => { const [x, y] = p.split(','); return `${(+x + 2.5).toFixed(1)},${y}`; }).join(' L')} L${ox + xb - 1},${bot + 2}" fill="none" stroke="#a88b4a" stroke-width="2" stroke-dasharray="4 3"/>` : '';
    return `<g><text x="${ox + 70}" y="14" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">${title}</text>
      <polygon points="${pts((y) => skin(y))} ${ox + 20},236 ${ox + 20},10" fill="#f2cf6b" opacity=".55"/>
      <polyline points="${pts((y) => skin(y))}" fill="none" stroke="#a06e5c" stroke-width="3"/>
      ${ribs}<line x1="${ox + rib}" y1="10" x2="${ox + rib}" y2="236" stroke="#8ea4aa" stroke-width="2"/>
      <polygon points="${pec}" fill="#b9473d" stroke="#5e1d1a" stroke-width="1"/>
      <path d="${implPath}" fill="#cfe6f2" stroke="#5f8fae" stroke-width="1.5" opacity=".95"/>${adm}
      <text x="${ox + xb + Pj * 0.45}" y="${cy + 4}" text-anchor="middle" font-size="10" fill="#2a4a5e">假體</text>
      <text x="${ox + rib + 10}" y="${plane === 'sub' ? top - 12 : 200}" font-size="10" fill="#7a2a24">胸大肌</text></g>`;
  };
  return `<svg viewBox="0 0 300 242" role="img" aria-label="胸大肌下與胸大肌前的剖面示意">${panel(0, 'sub', 'A 胸大肌下')}${panel(150, 'pre', 'B 胸大肌前')}</svg>`;
}

// ---------- 病人條件面板 ----------
const PT_ZH = ['挺', '略垂', '輕度', '輕到中度', '中度', '中到重度', '重度'];
function buildProfileUI() {
  const F = { pfH: 'height', pfW: 'weight', pfUB: 'underbust', pfB: 'bust', pfSNN: 'snn', pfNN: 'nn', pfIMD: 'imd', pfSNU: 'snu' };
  $('pfCup').value = PROFILE.cup; $('pfAge').value = PROFILE.age; $('pfPt').value = PROFILE.pt; $('pfUp').value = PROFILE.ratio; $('pfFull').value = PROFILE.full;
  for (const [id, k] of Object.entries(F)) $(id).value = PROFILE[k];
  let timer = null; const later = () => { clearTimeout(timer); timer = setTimeout(profileChanged, 180); renderProfile(); };
  for (const b of $('pfMode').children) b.addEventListener('click', () => { PROFILE.mode = b.dataset.mode; later(); });
  // 套用美學比例:模擬重建或對稱手術的目標乳頭位置
  $('pfIdeal').addEventListener('click', () => { const v = Math.round(idealSNN(PROFILE.snu) * 2) / 2; PROFILE.snn = v; PROFILE.nn = v; $('pfSNN').value = v; $('pfNN').value = v; later(); });
  $('pfCup').addEventListener('change', () => { PROFILE.cup = $('pfCup').value; later(); });
  for (const [id, k] of Object.entries(F)) $(id).addEventListener('input', () => { const v = Number($(id).value); if (Number.isFinite(v) && v >= Number($(id).min) && v <= Number($(id).max)) { PROFILE[k] = v; later(); } });
  $('pfAge').addEventListener('change', () => { PROFILE.age = $('pfAge').value; const d = AGE_DEF[PROFILE.age]; PROFILE.pt = d.pt; PROFILE.full = d.full; $('pfPt').value = d.pt; $('pfFull').value = d.full; later(); });
  $('pfRatio').addEventListener('change', () => { const v = $('pfRatio').value; $('pfUpWrap').hidden = v !== 'custom'; if (v !== 'custom') { PROFILE.ratio = Number(v); PROFILE.full = v === '0.55' ? Math.max(PROFILE.full, 0.7) : AGE_DEF[PROFILE.age].full; $('pfUp').value = PROFILE.ratio; $('pfFull').value = PROFILE.full; } later(); });
  $('pfPt').addEventListener('input', () => { PROFILE.pt = Number($('pfPt').value); later(); });
  $('pfUp').addEventListener('input', () => { PROFILE.ratio = Number($('pfUp').value); later(); });
  $('pfFull').addEventListener('input', () => { PROFILE.full = Number($('pfFull').value); later(); });
  renderProfile();
}
function renderProfile() {
  const meas = PROFILE.mode === 'meas';
  for (const b of $('pfMode').children) b.setAttribute('aria-pressed', String(b.dataset.mode === PROFILE.mode));
  $('pfCupBox').hidden = meas; $('pfMeasBox').hidden = !meas;
  const M = measures(); const cup = meas ? cupOf(M.d) : PROFILE.cup;
  const ideal = idealSNN(PROFILE.snu);
  $('pfCalc').textContent = `上下胸圍差 ${fmt(M.d)} cm,約 ${cup} 罩杯(下胸圍 ${fmt(M.ub)});BMI ${fmt(bmi())}。同樣罩杯,下胸圍越大乳房越寬;BMI 較高時組織較軟、較容易下垂。美學參考:胸骨上切跡到乳頭與兩乳頭間距約 ${fmt(ideal)} cm(0.46 × 胸骨上切跡到肚臍),目前 ${fmt(M.snn)} 與 ${fmt(M.nn)} cm。`;
  $('pfPtV').textContent = PT_ZH[Math.round(PROFILE.pt * 2)] ?? '';
  $('pfUpV').textContent = `${Math.round(PROFILE.ratio * 100)}:${100 - Math.round(PROFILE.ratio * 100)}`;
  $('pfFullV').textContent = PROFILE.full < 0.3 ? '較扁(凹)' : PROFILE.full < 0.6 ? '平直' : '飽滿(凸)';
  $('pfSum').textContent = `${meas ? `${fmt(M.ub)}${cup}` : `${cup} 罩杯`}・${$('pfAge').selectedOptions[0].textContent}・上下極 ${Math.round(PROFILE.ratio * 100)}:${100 - Math.round(PROFILE.ratio * 100)}`;
}
// 模型實測(以未手術側為準)
function renderMeas() {
  const m = instances[0]?.meas; const v = m?.L || m?.R; if (!v) { $('pfMeas').textContent = ''; return; }
  const up = Math.round(v.up * 100); const d = -v.imf * 100; // 乳頭高於下皺褶為正
  const grade = d > 1 ? '無下垂' : d >= -1 ? '第一度下垂' : d >= -3 ? '第二度下垂' : '第三度下垂';
  $('pfMeas').textContent = `模型目前:上極 ${up}%・下極 ${100 - up}%;乳頭${Math.abs(d) <= 1 ? '約在乳房下皺褶高度' : d > 0 ? `高於乳房下皺褶 ${d.toFixed(1)} cm` : `低於乳房下皺褶 ${(-d).toFixed(1)} cm`}(約${grade},Regnault 分級)。估計單側乳房體積約 ${Math.round(estVolume() / 10) * 10} mL。`;
}
function profileChanged() {
  PROFILE.ver++; GEO.clear();
  for (const inst of instances) {
    computeTargets(inst); inst.gpaths = {};
    inst.root.remove(inst.gd.group); inst.gd.group.traverse((o) => o.geometry?.dispose()); buildGlandDetail(inst);
    buildFatDrops(inst); buildDye(inst); inst.key = {};
  }
  if (app.scn === 'sim' && app.mode !== 'compare') updateSim(true);
}

// ---------- 個人化腫瘤模擬 ----------
const sim = { side: 'L', hour: 12, distCm: 2, sizeCm: 2.3, view: 'pre', inc: null, manualInc: false, sym: false, res: null };
const $ = (id) => document.getElementById(id);
const HOURS = [12, 12.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5];
const hourLabel = (h) => `${Math.floor(h % 12) || 12}:${h % 1 ? '30' : '00'}`;
const fmt = (v, d = 1) => Number(v).toFixed(d).replace(/\.0+$/, '');

function buildSimUI() {
  $('simHour').append(...HOURS.map((h) => el('option', { value: String(h) }, hourLabel(h) + ' 方向')));
  $('simHour').value = String(sim.hour); $('simDist').value = sim.distCm; $('simSize').value = sim.sizeCm;
  $('cfgMargin').value = CONFIG.marginCm; $('cfgL1').value = Math.round(CONFIG.level1Max * 100); $('cfgL2').value = Math.round(CONFIG.level2Max * 100);
  const changed = () => { sim.manualInc = false; updateSim(true); };
  for (const b of $('simSide').children) b.addEventListener('click', () => { sim.side = b.dataset.side; sim.manualInc = false; updateSim(true, true); });
  $('simHour').addEventListener('change', () => { sim.hour = Number($('simHour').value); changed(); });
  const num = (id, key, min, max) => $(id).addEventListener('input', () => { const v = Number($(id).value); if (Number.isFinite(v) && v >= min && v <= max) { sim[key] = v; changed(); } });
  num('simDist', 'distCm', 0, 12); num('simSize', 'sizeCm', 0.3, 10);
  for (const b of $('simViews').children) b.addEventListener('click', () => { sim.view = b.dataset.view; updateSim(false); });
  $('simSym').addEventListener('change', () => { sim.sym = $('simSym').checked; updateSim(false); });
  const cfg = (id, fn) => $(id).addEventListener('input', () => { const v = Number($(id).value); if (Number.isFinite(v) && v >= 0) { fn(v); changed(); } });
  cfg('cfgMargin', (v) => { CONFIG.marginCm = v; }); cfg('cfgL1', (v) => { CONFIG.level1Max = v / 100; }); cfg('cfgL2', (v) => { CONFIG.level2Max = v / 100; });
  const svg = $('clock');
  svg.addEventListener('click', (e) => {
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const q = pt.matrixTransform(svg.getScreenCTM().inverse());
    const r = Math.hypot(q.x, q.y); if (r > 112) return;
    let h = Math.round(((Math.atan2(q.x, -q.y) * 180 / Math.PI + 360) % 360) / 15) / 2; if (h === 0) h = 12;
    sim.hour = h; sim.distCm = Math.round(r / 10 * 2) / 2;
    $('simHour').value = String(h); $('simDist').value = sim.distCm; changed();
  });
}

function selectSim() {
  app.scn = 'sim'; app.cat = 'sim'; app.mode = 'single'; syncModeUI(); renderOverview(); showPanels();
  app.peelOverride = null; ui.peel.value = '0'; ui.peelName.textContent = LAYER_NAMES[0];
  updateSim(true, true);
}

function updateSim(inputsChanged, fly = false) {
  const r = analyze({ ...sim, cup: 'custom', customMl: estVolume() }, CONFIG); sim.res = r;
  if (!sim.inc || (inputsChanged && !sim.manualInc)) sim.inc = r.recommended[0];
  for (const b of $('simSide').children) b.setAttribute('aria-pressed', String(b.dataset.side === sim.side));
  for (const b of $('simViews').children) b.setAttribute('aria-pressed', String(b.dataset.view === sim.view));
  $('simSymWrap').hidden = INCISIONS[sim.inc].level !== 2;
  renderClock(r); renderResult(r); renderIncisions(r);
  transition(instances[0], simState(r), 900);
  if (fly) flyTo('sim' + sim.side);
}

function shapeFor(r, view, incLevel) {
  if (view !== 'onco') return postShape(r, view, false);
  if (incLevel === 2) return postShape({ ...r, level: 2 }, 'onco', sim.sym);
  const sh = postShape({ ...r, level: 1 }, 'onco', false);
  if (r.level > 1) { const full = postShape(r, 'post', false); sh.dent = full.dent * 0.6; sh.shift = full.shift * 0.6; }
  return sh;
}

function simState(r) {
  const s = structuredClone(BASE_STATE);
  const side = sim.side, other = side === 'L' ? 'R' : 'L', sg = SIDES[side];
  const incLevel = INCISIONS[sim.inc]?.level || 1;
  const sh = shapeFor(r, sim.view, incLevel);
  const gPre = geomOf({ P: 0.064, shape: 'natural' });
  const u = gPre.uN + sg * r.X, w = gPre.wV + r.Y; const len = Math.hypot(r.X, r.Y) || 1;
  const sigma = Math.max((r.exR / 100) * 1.05, 0.012);
  const mk = (shp, sgn, withTumor) => ({
    P: shp.P / r.sc, shape: 'natural', areola: true, defect: 0, dq: 'uoq', gland: true, fat: true, sc: shp.sc / r.sc, lift: shp.lift, ptosis: shp.ptosis,
    nsu: withTumor ? (sgn * shp.shift * r.X) / len : 0, nsw: withTumor ? (shp.shift * r.Y) / len : 0,
    defects: [{ u, w, d: withTumor ? shp.dent : 0, s: sigma }]
  });
  s[side] = mk(sh, sg, true);
  s[other] = mk(sh.other || { sc: r.sc, P: 0.064 * r.sc, lift: 0, ptosis: 1, dent: 0, shift: 0 }, SIDES[other], false);
  s.tumorAt = { side, u, w, depth: 0.5, tr: sim.sizeCm / 200, er: r.exR / 100 };
  const scarId = sim.view === 'post' && incLevel !== 1 ? r.l1[0] : sim.inc;
  const Yf = gPre.bot - gPre.wN + gPre.dropA + 0.004;
  s.custom = incisionPaths(scarId, { ...r, Yf }).filter((p) => sim.view === 'pre' || !p.design).map((p) => ({ side, pts: p.pts.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]), closed: !!p.closed, dashed: sim.view === 'pre' }));
  if (sim.view === 'pre') { s.ghostSkin = 0.82; s.xray = true; s.tumor = 1; s.margin = 1; }
  else { s.cut = 1; }
  s.peel = 0; s.cam = 'sim' + side;
  return s;
}

function renderClock(r) {
  const svg = $('clock'); const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs, text) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text !== undefined) e.textContent = text; return e; };
  const kids = [mk('circle', { class: 'rim', r: Math.round(85 * r.sc) })];
  for (let h = 1; h <= 12; h++) {
    const a = h * 30 * Math.PI / 180;
    kids.push(mk('line', { class: 'tick', x1: 92 * Math.sin(a), y1: -92 * Math.cos(a), x2: 98 * Math.sin(a), y2: -98 * Math.cos(a) }));
    kids.push(mk('text', { class: 'num', x: 108 * Math.sin(a), y: -108 * Math.cos(a) }, String(h)));
  }
  kids.push(mk('text', { class: 'side', x: r.Ls * 78, y: 112 }, '外側'), mk('text', { class: 'side', x: -r.Ls * 78, y: 112 }, '內側'));
  kids.push(mk('circle', { class: 'are', r: 17 }), mk('circle', { class: 'are', r: 4 }));
  const scarId = sim.view === 'post' && INCISIONS[sim.inc].level !== 1 ? r.l1[0] : sim.inc;
  const gC = geomOf({ P: 0.064, shape: 'natural' });
  for (const p of incisionPaths(scarId, { ...r, Yf: gC.bot - gC.wN + gC.dropA + 0.004 })) {
    if (p.design && sim.view !== 'pre') continue;
    const d = p.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * 1000).toFixed(1)} ${(-y * 1000).toFixed(1)}`).join(' ') + (p.closed ? 'Z' : '');
    kids.push(mk('path', { class: 'inc', d, 'stroke-dasharray': sim.view === 'pre' || p.design ? '5 4' : 'none' }));
  }
  const a = (r.angleDeg * Math.PI) / 180; const tx = Math.sin(a) * sim.distCm * 10, ty = -Math.cos(a) * sim.distCm * 10;
  kids.push(mk('circle', { class: 'exc', cx: tx, cy: ty, r: r.exR * 10 }), mk('circle', { class: 'tum', cx: tx, cy: ty, r: Math.max(sim.sizeCm * 5, 2) }));
  svg.replaceChildren(...kids);
}

function renderResult(r) {
  const box = $('simResult'); const sideZh = sim.side === 'L' ? '左乳' : '右乳';
  const lvText = r.level === 1 ? 'Level I:可直接縫合,或搭配局部組織移位' : r.level === 2 ? 'Level II:建議腫瘤整形(乳房整形術)' : '超過保留乳房的一般範圍';
  const nums = el('div', { class: 'nums' });
  for (const [v, l] of [[fmt(r.exR * 2) + ' cm', '切除直徑'], [Math.round(r.Ve) + ' mL', '切除體積'], [Math.round(r.Vb) + ' mL', '乳房體積'], [fmt(r.ratio * 100) + '%', '切除比例']]) {
    const sp = el('span'); sp.append(el('b', {}, v), document.createTextNode(l)); nums.append(sp);
  }
  const lv = el('span', { class: 'lv lv' + r.level }, lvText);
  const where = el('p', {}, `${sideZh} ${hourLabel(sim.hour)} 方向、距乳頭 ${fmt(sim.distCm)} cm,位於${ZONES[r.zone].zh}。腫瘤 ${fmt(sim.sizeCm)} cm 加安全邊界 ${fmt(CONFIG.marginCm)} cm。`);
  const kids = [nums, lv, where];
  if (r.warnings.length) { const ul = el('ul'); for (const w of r.warnings) ul.append(el('li', {}, w)); kids.push(ul); }
  if (r.level === 3) {
    const row = el('div', { class: 'stepnav' });
    for (const id of [...(ZONE_L3[r.zone] || []), 'diep']) { const sc = SCENARIOS.find((x) => x.id === id); if (!sc) continue; const b = el('button', {}, '看' + sc.short); b.addEventListener('click', () => selectScenario(id)); row.append(b); }
    row.style.flexWrap = 'wrap';
    kids.push(row);
  }
  kids.push(el('p', { class: 'hint' }, '數值為依球形切除估算的示意,實際切除範圍依手術而定。'));
  box.replaceChildren(...kids);
}

function renderIncisions(r) {
  const fs = $('simInc'); const legend = fs.querySelector('legend');
  const kids = [legend];
  for (const [lv, title, rec] of [[1, 'Level I:切除與局部移位', r.l1], [2, 'Level II:乳房整形術', r.l2]]) {
    kids.push(el('h4', {}, title));
    for (const [id, d] of Object.entries(INCISIONS).filter(([, d]) => d.level === lv)) {
      const lab = el('label'); const inp = el('input', { type: 'radio', name: 'inc', value: id });
      inp.checked = id === sim.inc;
      inp.addEventListener('change', () => { sim.inc = id; sim.manualInc = true; updateSim(false); });
      const txt = el('span'); if (rec.includes(id)) txt.append(el('span', { class: 'star' }, '★ '));
      txt.append(document.createTextNode(d.zh + ' '), el('small', {}, d.en));
      lab.append(inp, txt); kids.push(lab);
    }
  }
  kids.push(el('p', { class: 'incdesc' }, INCISIONS[sim.inc].text));
  fs.replaceChildren(...kids);
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
      if (applyState(inst, s, t < 1) && inst === instances[0]) renderMeas();
      if (t >= 1) inst.tween = null;
    } else if (inst.target) {
      const s = inst.target; if (app.peelOverride !== null) s.peel = app.peelOverride;
      if (applyState(inst, s) && inst === instances[0]) renderMeas();
    }
  }
  if (app.camTween) {
    const c = app.camTween; let t = Math.min((now - c.s) / c.dur, 1); const e = 1 - (1 - t) ** 3;
    camera.position.lerpVectors(c.p0, c.p1, e); controls.target.lerpVectors(c.t0, c.t1, e);
    if (t >= 1) app.camTween = null;
  }
  if (instances[0] && instances[0].meas !== app.lastMeas) { app.lastMeas = instances[0].meas; renderMeas(); }
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
  // 上臂皮膚只到手肘上方:截掉露出皮膚外的肱骨遠端
  const arm = meshes.find((m) => m.name === 'skin_arm');
  if (arm) for (const sd of [-1, 1]) {
    const sp = arm.geometry.attributes.position; let yCut = 9;
    for (let i = 0; i < sp.count; i++) if (sp.getX(i) * sd > 0.12) yCut = Math.min(yCut, sp.getY(i));
    const hm = meshes.find((m) => m.name === (sd > 0 ? 'humerus_l' : 'humerus_r'));
    if (hm && yCut < 9) { const g = hm.geometry; const pa = g.attributes.position; const idx = g.index.array; const keep = [];
      for (let t = 0; t < idx.length; t += 3) if (Math.min(pa.getY(idx[t]), pa.getY(idx[t + 1]), pa.getY(idx[t + 2])) > yCut + 0.03) keep.push(idx[t], idx[t + 1], idx[t + 2]);
      g.setIndex(keep); }
  }
  for (const m of meshes.filter((x) => x.name.startsWith('nodes_'))) {
    meshes.splice(meshes.indexOf(m), 1);
    splitComponents(m.geometry).forEach((g, k) => meshes.push({ name: `${m.name}#${k}`, geometry: g }));
  }
  BASE = { meshes, curves: meta.curves };
  window.__atlas = { instances, camera, controls, app, THREE }; // 測試用
  instances.push(createInstance(), createInstance());
  ui.loading.hidden = true;
  resize();
  const hid = location.hash.slice(1);
  if (hid === 'sim') selectSim(); else selectScenario(SCENARIOS.some((x) => x.id === hid) ? hid : 'bcs');
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h === 'sim') selectSim(); else if (SCENARIOS.some((x) => x.id === h)) selectScenario(h); });
  requestAnimationFrame(frame);
}
boot().catch((err) => { ui.loading.textContent = '模型載入失敗:' + err.message; console.error(err); });
