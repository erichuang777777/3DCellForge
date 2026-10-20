// Educational shape envelope, in metres. This is not a patient-specific fit or
// an outcome predictor. Shape, gravity and nipple detail are separate channels.
import { MH_FIELD as MF, MH_DATA } from './breast-field.js';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const radius = (v, a, b, scale) => a + (b - a) * smooth(-0.025 * scale, 0.025 * scale, v);

export function surfaceShape(u, w, g) {
  const du = u - g.uN, dw = w - g.wN;
  const x = du / radius(du, g.Rmed, g.Rlat, g.sc);
  const y = dw / radius(dw, g.Rlo, g.Rup, g.sc);
  // 內下象限用超橢圓(較方),讓乳房內下方與胸骨前的組織連成一片,而不是被橢圓切掉;其餘方向維持橢圓
  const rr = Math.hypot(x, y);
  const inferomedial = g.round || rr < 1e-6 ? 0 : smooth(0, 0.6, -x / rr) * smooth(0, 0.6, -y / rr);
  const pe = 2 + 2.6 * inferomedial;
  const r2 = Math.pow(Math.pow(Math.abs(x), pe) + Math.pow(Math.abs(y), pe), 2 / pe);
  if (r2 >= 1) return { D: 0, drop: 0 };
  const q = 1 - r2;
  if (g.shape === 'flat' || g.P < 0.0005) return { D: 0.0015 * q * q, drop: 0 };

  // Every depth contour is a simple ring. A single radial exponent avoids the
  // old direction-dependent derivatives around the nipple. b > 1 gives a C1
  // chest-wall attachment. The radial polynomial fills the mid-pole without a
  // plateau, cone, or artificial ridge at the apex.
  const b0 = g.round ? 1.5 : 2.1 - 0.65 * clamp(g.full, 0, 1);
  // 內側(乳溝側)較飽滿:統計平均乳房的內側組織一路延伸到胸骨旁,乳溝淺;指數仍 > 1,維持與胸壁相切
  const r = Math.sqrt(r2), medial = r > 1e-6 ? smooth(0, 0.9, -x / r) : 0;
  const b = Math.max(1.25, b0 - (g.round ? 0.1 : 0.35) * medial); // b ≥ 1.25:深度沿每條經線單調遞減
  const D = g.P * Math.pow(q, b) * (1 + 1.2 * r2);

  // A smooth lower ring moves down then returns to the fixed IMF. Unlike a
  // heightfield alone, this parametric displacement can form an under-pole
  // return. It is nonzero on the central lower meridian. Its value and first
  // derivative vanish at the chest-wall boundary; the nipple stays independent.
  const lowerRing = 6.75 * r2 * q * q * smooth(0, 0.65, -y);
  const fullness = (g.round ? 0.10 : 0.32) * g.Rlo * clamp(g.P / 0.0465, 0, 1.25);
  const drop = (g.dropA || 0) * q * q + fullness * lowerRing;
  return { D, drop };
}

// Keep the established tissue profile for the existing implant-wrap solver.
// That solver was tuned to this envelope. Natural breasts and no-wrap cosmetic
// illustrations use surfaceShape; changing their shape must not silently change
// surgical implant fitting. This compatibility path is also educational only.
export function implantEnvelopeShape(du, dw, g) {
  const u = du - g.uN, w = dw - g.wN;
  const x = u / radius(u, g.Rmed, g.Rlat, g.sc);
  const y = w / radius(w, g.Rlo, g.Rup, g.sc);
  const r2 = x * x + y * y;
  if (r2 >= 1) return { D: 0, drop: 0 };
  if (g.shape === 'flat' || g.P < .0005) return { D: .0015 * (1 - r2), drop: 0 };
  const r = Math.sqrt(r2), dy = r > 1e-6 ? y / r : 0;
  const lo = smooth(0, .9, -dy), up = smooth(0, .9, dy);
  const sag = Math.min(g.pt, 1), full = clamp(g.full, 0, 1);
  const ms = g.round ? 3.2 : 3, ml = g.round ? 2.8 : 2.6 + .4 * sag;
  const mu = g.round ? 2.6 : 1.4 + 1.2 * full;
  const bl = g.round ? .95 : 1 - .1 * sag;
  const m = ms + (ml - ms) * lo + (mu - ms) * up;
  const b = 1.3 + (bl - 1.3) * lo + (1.6 - 1.3) * up;
  const D = g.P * (1 - r ** m) ** b;
  const downness = y < 0 && r > 1e-6 ? -y / r : 0;
  const drop = (g.dropA || 0) * Math.max((D / g.P) ** .85, .55 * smooth(1, .7, r)) * (1 + .2 * clamp(-y, 0, 1) * (.5 + .5 * downness));
  return { D, drop };
}

// ---- 自然乳房:MakeHuman(CC0)雕塑形狀的罩杯 × 緊實度位移場 ----
// 體表皮膚本身是 MakeHuman 基底網格(最小罩杯)放大 1.139 倍對齊而來(tools/breast-atlas/female_skin/fit.py),
// 位移場也以最小罩杯為胸壁,網格已換成模型公尺。橫向座標繞軀幹展開(胸側壁上的點不會擠在一起)。
export const MH_NIP = { x: MF.nipX, y: MF.nipY }; // 平均罩杯乳頭的胸壁位置(模型座標)
const FRAME_F = (() => { const l = Math.hypot(0.25, -0.05, 1); return [0.25 / l, -0.05 / l, 1 / l]; })();
let GRID = null;
function grid() {
  if (GRID) return GRID;
  const bin = atob(MH_DATA); const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  GRID = new Int16Array(u8.buffer); return GRID;
}
// 展開座標:x 往外側為正(過中線為負),z 為頂點深度
export const unwrapX = (x, z) => MF.R0 * Math.atan2(x, z - MF.zc);
// 沒有頂點深度時(定位、量測),用胸前輪廓的深度
export function frontZ(x) { const T = MF.front, t = clamp(Math.abs(x) / T.step, 0, T.z.length - 1.001), i = Math.floor(t); return T.z[i] + (T.z[i + 1] - T.z[i]) * (t - i); }
const META = (ci, fi) => MF.meta[`${ci ? 'max' : 'average'}cup_${['max', 'average', 'min'][fi]}firmness`];

// 罩杯 c:0 = 最小罩杯(平)、0.5 = 平均、1 = 最大;緊實度 p:0 = 緊實、0.5 = 平均、1 = 鬆(MakeHuman 範圍),> 1 依同方向外插
// 各節點之間分段雙線性(與 MakeHuman 調整滑桿的混合方式相同),鬆弛造成的變化因此隨罩杯放大而不是固定量
export function fieldWeights(c, p) {
  c = clamp(c, 0, 1); p = clamp(p, 0, 2);
  const cw = c <= 0.5 ? [[0, c / 0.5]] : [[0, 1 - (c - 0.5) / 0.5], [1, (c - 0.5) / 0.5]];
  let pw;
  if (p <= 0.5) pw = [[0, 1 - p / 0.5], [1, p / 0.5]];
  else if (p <= 1) pw = [[1, 1 - (p - 0.5) / 0.5], [2, (p - 0.5) / 0.5]];
  else { const e = (p - 1) / 0.5; pw = [[1, -e], [2, 1 + e]]; }
  const out = [];
  for (const [ci, a] of cw) for (const [fi, b] of pw) if (Math.abs(a * b) > 1e-9) out.push([ci * 3 + fi, a * b, ci, fi]);
  return out;
}
// 單側體積(mL,模型尺寸)與最大厚度(公尺)
export function fieldVolume(c, p) { let v = 0; for (const [, w, ci, fi] of fieldWeights(c, p)) v += w * META(ci, fi).vol_mL; return Math.max(v, 0); }
export function fieldPmax(c, p) { let v = 0; for (const [, w, ci, fi] of fieldWeights(c, p)) v += w * META(ci, fi).Pmax; return Math.max(v, 0); }
// 由目標體積反推罩杯位置;超過最大罩杯時回傳放大倍數
export function cupForVolume(vol, p) {
  const va = fieldVolume(0.5, p), vm = fieldVolume(1, p);
  if (vol <= va) return { c: 0.5 * Math.max(vol, 0) / va, amp: 1 };
  if (vol <= vm) return { c: 0.5 + 0.5 * (vol - va) / (vm - va), amp: 1 };
  return { c: 1, amp: Math.cbrt(vol / vm) };
}
// Catmull-Rom 雙三次取樣(C1,網格線上不會出現法線折痕);(u, y):展開橫向座標與高度(模型公尺)
const cr = (t) => { const t2 = t * t, t3 = t2 * t; return [(-t3 + 2 * t2 - t) / 2, (3 * t3 - 5 * t2 + 2) / 2, (-3 * t3 + 4 * t2 + t) / 2, (t3 - t2) / 2]; };
export function sampleField(u, y, wts, out = [0, 0, 0]) {
  out[0] = out[1] = out[2] = 0;
  const fx = (u - MF.x0) / MF.step, fy = (y - MF.y0) / MF.step;
  if (!(fx >= 0 && fy >= 0 && fx <= MF.nx - 1 && fy <= MF.ny - 1)) return out;
  const G = grid(); const i = Math.min(Math.floor(fx), MF.nx - 2), j = Math.min(Math.floor(fy), MF.ny - 2);
  const wx = cr(fx - i), wy = cr(fy - j); const plane = MF.nx * MF.ny;
  for (let b = 0; b < 4; b++) {
    const jj = clamp(j - 1 + b, 0, MF.ny - 1);
    for (let a = 0; a < 4; a++) {
      const ii = clamp(i - 1 + a, 0, MF.nx - 1); const k = wx[a] * wy[b]; if (k === 0) continue;
      const cell = jj * MF.nx + ii;
      for (const [n, w] of wts) { const o = n * 3 * plane + cell; const kw = k * w * MF.scale; out[0] += kw * G[o]; out[1] += kw * G[o + plane]; out[2] += kw * G[o + 2 * plane]; }
    }
  }
  return out;
}
// 胸前平面座標(du 往外側為正、dw 往上為正,相對乳房區域中心)→ 位移;ux:頂點的展開橫向座標(沒有時用胸前輪廓估)
// g.field = { w: 權重, cx, cy: 區域中心, du0, dy0: 乳頭基底相對雕塑模型的平移, amp: 超出最大罩杯的放大倍數, S, top: 重力下垂 }
const TMP = [0, 0, 0], TMP2 = [0, 0, 0];
export function fieldShape(du, dw, g, ux) {
  const F = g.field;
  if (ux == null) { const x = du + F.cx; ux = unwrapX(x, frontZ(x)); }
  // 上下極比例:以乳頭基底為界,上方與下方各自縮放(上極 su 倍、下極 sl 倍),讓量出來的上下極比例等於設定值
  const v = dw - g.wN, vs = v > 0 ? v / (F.su || 1) : v / (F.sl || 1);
  const s = sampleField(ux - F.du0, g.wN + vs + F.cy - F.dy0, F.w, TMP);
  let D = s[0] * F.amp, drop = s[2] * F.amp;
  // 臨床下垂(重力):組織沿胸壁往下滑。有組織處滑最多,乳房下皺褶與上緣附著處歸零(邊界沿雕塑形狀本身的 U 形輪廓,
  // 不是一條水平線);下極越過皺褶往下垂
  if (F.S > 0) {
    // 組織權重用周圍 2.5 cm 的平均厚度:皮膚是連續的,乳房邊緣外也被連帶拉動,不會在邊緣出現剪切縫
    const yy = g.wN + vs + F.cy - F.dy0, u = ux - F.du0; let Db = D;
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; Db += sampleField(u + 0.025 * Math.cos(a), yy + 0.025 * Math.sin(a), F.w, TMP2)[0] * F.amp; }
    // 胸側 12–17 cm 之間漸減到 0(再往外是手臂與變形區域邊界,不能被拉動)
    const tissue = smooth(0.001, 0.014, Db / 9) * (1 - smooth(0.12, 0.17, du + F.cx));
    const up = dw <= g.wN ? 0 : smooth(g.wN, F.top, dw);
    const g0 = F.S * tissue * (1 - 0.85 * up);
    drop += g0;
    // 上極被往下拉長:體積守恆,拉長幾倍、厚度就除以幾倍(上極變平、變空);最多變薄到 60%
    if (up > 0 && up < 1) {
      const t = (dw - g.wN) / (F.top - g.wN), ds = 6 * t * (1 - t) / (F.top - g.wN);
      D /= Math.min(1 + F.S * tissue * 0.85 * ds, 1 / 0.6);
    }
    // 垂過乳房下皺褶的部分同時往前(像以皺褶為軸往下轉),才不會壓進腹部皮膚
    const below = F.imf0 - (dw - drop + FRAME_F[1] * D);
    if (below > 0) D += 0.6 * Math.min(below, g0);
  }
  // 隆乳假體:貼在胸壁上的圓頂,把原本的組織整個往前推(厚度相加);邊緣由覆蓋的組織緩和
  if (F.imp) {
    const I = F.imp, x = (du - g.uN - I.cu) / I.rx, y = (dw - g.wN - I.cw) / I.ry, r = Math.hypot(x, y);
    if (r < 1.25) {
      const lowW = I.teardrop ? 0.75 + 0.25 * smooth(-0.6, 0.6, -y) * 1.6 : 1; // 水滴形:下半部較厚
      const dome = Math.pow(Math.max(0, 1 - Math.pow(r / 1.08, 2.4)), 0.7) * (1 - smooth(1.0, 1.25, r)) + 0.06 * (1 - smooth(1.0, 1.25, r));
      D += I.P * Math.min(lowW, 1.15) * dome;
    }
  }
  return { D, lat: s[1] * F.amp, drop };
}
// 由位移場量出外形:看得到的乳房下皺褶(沿乳頭經線,皮膚離開胸壁、或往下翻折的位置)、上緣、內外緣
export function fieldMetrics(g) {
  const h = 0.002;
  const at = (du, dw) => fieldShape(du, dw, g);
  const vis = (dw) => { const v = at(g.uN, dw); return { y: dw - v.drop + FRAME_F[1] * v.D, D: v.D, drop: v.drop }; };
  let crease = null; let prev = vis(g.wN - 0.24), cur = vis(g.wN - 0.24 + h);
  for (let dw = g.wN - 0.24 + 2 * h; dw < g.wN; dw += h) {
    const nxt = vis(dw);
    if (cur.D > 0.002 || (cur.y > prev.y && cur.y >= nxt.y && cur.drop > 0.003)) { crease = { y: cur.y, foot: dw - h }; break; }
    prev = cur; cur = nxt;
  }
  if (!crease) crease = { y: g.wN - 0.05, foot: g.wN - 0.05 };
  let top = g.wN; for (let dw = g.wN; dw < g.wN + 0.22; dw += h) if (at(g.uN, dw).D > 0.003) top = dw;
  let med = g.uN, lat = g.uN;
  for (let du = g.uN; du > g.uN - 0.16; du -= h) if (at(du, g.wN).D > 0.003) med = du;
  for (let du = g.uN; du < g.uN + 0.16; du += h) if (at(du, g.wN).D > 0.003) lat = du;
  const n = at(g.uN, g.wN);
  return { imf: crease.y, imfFoot: crease.foot, top, med, lat, nipD: n.D, nipDrop: n.drop, nipLat: n.lat };
}

// 乳頭經線的側面輪廓:上極比例 =(乳房上緣 − 乳頭)/(上緣 − 下極最低點或皺褶),與臨床側面照的量法相同
export function fieldPoleRatio(g, imf) {
  let top = -Infinity, low = Infinity; const n = fieldShape(g.uN, g.wN, g); const ny = g.wN - n.drop + FRAME_F[1] * n.D;
  for (let dw = g.wN - 0.2; dw < g.wN + 0.2; dw += 0.002) {
    const v = fieldShape(g.uN, dw, g); if (v.D <= 0.005) continue;
    const y = dw - v.drop + FRAME_F[1] * v.D; if (dw > g.wN) top = Math.max(top, y); low = Math.min(low, y);
  }
  const bot = Math.min(low, imf ?? low);
  return top > ny && ny > bot ? (top - ny) / (top - bot) : 0.5;
}
