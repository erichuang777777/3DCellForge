// Educational shape envelope, in metres. This is not a patient-specific fit or
// an outcome predictor. Shape, gravity and nipple detail are separate channels.
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
