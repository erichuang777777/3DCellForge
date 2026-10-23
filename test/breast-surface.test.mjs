import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import * as surface from '../public/breast-reconstruction-atlas/surface.js';
const { surfaceShape, implantEnvelopeShape } = surface;

const base = { uN: 0, wN: 0, Rmed: .075, Rlat: .0663, Rlo: .0666, Rup: .098,
  sc: 1, P: .0465, full: .85, round: false, shape: 'natural', dropA: 0 };

test('envelope is finite, nonnegative and attached across supported shape controls', () => {
  for (const sc of [.65, 1, 1.7]) for (const full of [0, .45, 1]) for (const dropA of [0, .045, .135]) {
    const g = { ...base, sc, full, dropA, Rmed: base.Rmed * sc, Rlat: base.Rlat * sc, Rlo: base.Rlo * sc, Rup: base.Rup * sc };
    for (let i = -50; i <= 50; i++) for (let j = -50; j <= 50; j++) {
      const v = surfaceShape(i * .004, j * .004, g);
      assert.ok(Number.isFinite(v.D) && Number.isFinite(v.drop));
      assert.ok(v.D >= 0 && v.drop >= 0);
    }
    assert.deepEqual(surfaceShape(0, -g.Rlo, g), { D: 0, drop: 0 });
    assert.deepEqual(surfaceShape(0, g.Rup, g), { D: 0, drop: 0 });
  }
});

test('depth falls strictly along each meridian, including large ptosis', () => {
  // With monotone radial depth, an under-pole return is not a self-crossing
  // meridian. This checks the envelope, not the curved torso or implant wrap.
  for (const full of [0, .35, .85, 1]) for (const dropA of [0, .135]) {
    const g = { ...base, full, dropA };
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 24) {
      let previous = Infinity;
      for (let k = 0; k <= 200; k++) {
        const r = k / 200;
        const u = r * Math.cos(angle) * (Math.cos(angle) < 0 ? g.Rmed : g.Rlat);
        const w = r * Math.sin(angle) * (Math.sin(angle) < 0 ? g.Rlo : g.Rup);
        const { D } = surfaceShape(u, w, g);
        assert.ok(D <= previous + 1e-10);
        previous = D;
      }
    }
  }
});

test('central lower pole has fullness and returns to a fixed IMF', () => {
  let lowest = 0;
  for (let k = 0; k <= 200; k++) {
    const w = -base.Rlo * k / 200;
    lowest = Math.min(lowest, w - surfaceShape(0, w, base).drop);
  }
  // A nonptotic breast may return without hanging below its IMF.
  const inner = -.75 * base.Rlo - surfaceShape(0, -.75 * base.Rlo, base).drop;
  const outer = -.9 * base.Rlo - surfaceShape(0, -.9 * base.Rlo, base).drop;
  assert.ok(outer > inner + .0005, 'lower pole must turn back toward its attachment');
  assert.ok(lowest <= -base.Rlo);
  assert.equal(surfaceShape(0, -base.Rlo, base).drop, 0);
  assert.ok(surfaceShape(0, -.6 * base.Rlo, base).drop > .015);
});

test('attachment has vanishing first derivative rather than an abrupt crease', () => {
  for (const w of [-base.Rlo, base.Rup]) {
    const eps = 1e-7, inside = w + (w < 0 ? eps : -eps);
    const v = surfaceShape(0, inside, { ...base, dropA: .135 });
    assert.ok(v.D / eps < .02);
    assert.ok(v.drop / eps < .001);
  }
});

test('nipple and lesion fields cannot change envelope gravity', () => {
  const a = surfaceShape(.01, -.03, base);
  const b = surfaceShape(.01, -.03, { ...base, nU: .03, nW: -.02, areola: true, defect: .02 });
  assert.deepEqual(a, b);
});

test('flat mastectomy envelope stays thin and has no lower-pole drop', () => {
  const g = { ...base, shape: 'flat', dropA: .135 };
  for (let k = -50; k <= 50; k++) {
    const p = surfaceShape(0, k * .002, g);
    assert.ok(p.D <= .0015); assert.equal(p.drop, 0);
  }
});

// Run the real application field as well: detail/lesion edits used to feed back
// into gravity even though the pure shape evaluator was independent.
const appSource = fs.readFileSync(new URL('../public/breast-reconstruction-atlas/app.js', import.meta.url), 'utf8');
const fieldSource = appSource.slice(appSource.indexOf('const SIDES ='), appSource.indexOf('function prepBreastRegions'));
const context = vm.createContext({ THREE, ...surface, QN: { uoq: [.025, .025] } });
vm.runInContext(fieldSource + '\nthis.fieldAPI = { breastField, geomOf, PROFILE, nipBump, chestChart, chestShift, applyNippleRelief };', context);
const { breastField, geomOf, PROFILE, nipBump, chestChart, chestShift, applyNippleRelief } = context.fieldAPI;

test('application nipple and resection detail leave material gravity unchanged', () => {
  const p = { P: .064, shape: 'natural', pt: 1 };
  const g = geomOf(p); const u = g.nU, w = g.nW;
  const bare = breastField(u, w, p);
  const nipple = breastField(u, w, { ...p, areola: true });
  const defect = breastField(u, w, { ...p, defect: .02, dq: 'uoq' });
  assert.equal(nipple.D, bare.D); assert.ok(defect.D < bare.D);
  assert.equal(nipBump(u, w, { ...p, areola: true }, g), .004);
  assert.equal(nipple.drop, bare.drop); assert.equal(defect.drop, bare.drop);
});

test('application attachments never rise and the fold descends only slightly with ptosis', () => {
  for (const cup of ['A', 'B', 'C', 'D', 'E', 'F']) {
    PROFILE.cup = cup; PROFILE.ver++;
    const a = geomOf({ P: .064, shape: 'natural', pt: 0 });
    for (const pt of [.5, 1, 2, 3]) {
      const g = geomOf({ P: .064, shape: 'natural', pt });
      assert.ok(g.top <= a.top + .005); assert.ok(g.imf <= a.imf + .003); // the sculpted upper edge and fold may shift a few mm with tissue softness
      assert.ok(a.imf - g.imf < .03, `${cup} fold moved ${(a.imf - g.imf) * 100} cm`);
      assert.equal(g.imf, g.bot);
    }
  }
});

// Natural breasts: MakeHuman (CC0) sculpted cup x firmness fields plus a gravity channel.
const fy = -.05 / Math.hypot(.25, .05, 1);
const nipRel = (cup, pt) => {
  PROFILE.cup = cup; PROFILE.ver++;
  const p = { P: .064, shape: 'natural', pt }; const g = geomOf(p); const n = breastField(g.nU, g.nW, { ...p, g });
  return g.nW - n.drop + fy * n.D - g.imf;
};

test('every cup reaches all four Regnault grades within the ptosis range', () => {
  for (const cup of ['A', 'B', 'C', 'D', 'E', 'F']) {
    assert.ok(nipRel(cup, 0) > .03, `${cup} upright nipple is well above the fold`);
    assert.ok(nipRel(cup, 3) < -.045, `${cup} reaches grade III (${(nipRel(cup, 3) * 100).toFixed(1)} cm)`);
    let prev = Infinity;
    for (let pt = 0; pt <= 3; pt += .25) { const r = nipRel(cup, pt); assert.ok(r < prev + 1e-9); prev = r; }
  }
});

test('the same laxity drops a heavier breast further', () => {
  const descent = (cup) => nipRel(cup, 0) - nipRel(cup, 1.5);
  assert.ok(descent('A') < descent('C')); assert.ok(descent('C') < descent('F'));
});

test('volume and projection grow with cup size', () => {
  let pv = 0, pp = 0;
  for (const cup of ['A', 'B', 'C', 'D', 'E', 'F']) {
    PROFILE.cup = cup; PROFILE.ver++;
    const g = geomOf({ P: .064, shape: 'natural', pt: 0 });
    assert.ok(g.vol > pv && g.P > pp); pv = g.vol; pp = g.P;
  }
});

test('inframammary fold is a U-shaped curve, not a horizontal line', () => {
  for (const cup of ['B', 'D']) {
    PROFILE.cup = cup; PROFILE.ver++;
    const p = { P: .064, shape: 'natural', pt: 0 }; const g = geomOf(p);
    // lowest chest-wall attachment along a vertical line: last row (from below) with tissue
    const lowest = (du) => { for (let dw = g.wN - .2; dw < g.wN; dw += .001) if (breastField(du, dw, { ...p, g }).D > .003) return dw; return g.wN; };
    // The sculpted fold rises steeply toward the sternum and more gently laterally.
    const c = lowest(g.uN), m = lowest(g.uN - .045), l = lowest(g.uN + .03);
    assert.ok(m > c + .01 && l >= c, `${cup}: medial ${(m - c) * 100} lateral ${(l - c) * 100} cm above centre`);
  }
});

test('natural field is finite and vanishes far from the breast', () => {
  PROFILE.cup = 'E'; PROFILE.ver++;
  const p = { P: .064, shape: 'natural', pt: 2 }; const g = geomOf(p);
  for (let du = -.2; du <= .2; du += .01) for (let dw = -.3; dw <= .25; dw += .01) {
    const v = breastField(du, dw, { ...p, g });
    assert.ok(Number.isFinite(v.D) && Number.isFinite(v.drop) && Number.isFinite(v.lat));
  }
  const far = breastField(g.uN, g.wN + .3, { ...p, g }); assert.equal(far.D, 0); assert.equal(far.drop, 0);
  PROFILE.cup = 'C'; PROFILE.ver++;
});

test('nipple relief follows a hanging surface normal rather than anterior axis', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, -1, 0], 3));
  const reg = { idx: [0], du: [0], dw: [0], wt: [1] };
  applyNippleRelief(geometry, reg, { areola: true }, { P: .0465, nU: 0, nW: 0 });
  assert.ok(Math.abs(geometry.attributes.position.getY(0) + .004) < 1e-8);
  assert.equal(geometry.attributes.position.getZ(0), 0);
});

test('chest chart exactly follows a sloped source triangle and is stationary at attachment', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-.1, 1, .1, .1, 1, .1, 0, 1.4, .2], 3));
  geometry.setIndex([0, 1, 2]);
  const chestAt = chestChart(geometry); const reg = { chestAt };
  assert.ok(Math.abs(chestAt(0, 1.2, 0) - .15) < 1e-7);
  assert.equal(chestShift(reg, 0, 1.1, .125, 0, 0), 0);
  assert.ok(Math.abs(chestShift(reg, 0, 1.1, .125, 0, .1) - .025) < 1e-7);
});

// Aesthetic reference (clinical teaching ratios): sternal notch-nipple-nipple equilateral triangle of
// 18-21 cm, upper:lower pole 45:55 about the nipple, nipple-to-IMF 7-8 cm over the skin for a C cup.
const goldOf = (cup, pt = 0) => {
  PROFILE.cup = cup; PROFILE.ver++;
  const p = { P: .064, shape: 'natural', pt }; const g = geomOf(p); const l = Math.hypot(.25, .05, 1), f = [.25 / l, -.05 / l, 1 / l];
  const n = breastField(g.nU, g.nW, { ...p, g });
  const nx = g.nU + .097 + f[0] * n.D + n.lat, ny = g.nW + 1.252 - n.drop + f[1] * n.D, nz = surface.frontZ(g.nU + .097) + f[2] * n.D;
  let arc = 0, prev = null;
  for (let dw = g.nW; dw > g.nW - .2; dw -= .001) {
    const v = breastField(g.uN, dw, { ...p, g }); if (v.D <= .0005) break;
    const q = [dw - v.drop + f[1] * v.D, surface.frontZ(g.uN + .097) + f[2] * v.D]; if (prev) arc += Math.hypot(q[0] - prev[0], q[1] - prev[1]); prev = q;
  }
  return { sn: Math.hypot(nx, ny - 1.41, nz - .06), nn: 2 * nx, upper: surface.fieldPoleRatio(g, g.imf), arc };
};

test('upright breasts follow the aesthetic notch-nipple triangle', () => {
  for (const cup of ['B', 'C', 'D']) {
    const r = goldOf(cup);
    assert.ok(r.sn > .175 && r.sn < .215 && Math.abs(r.sn - r.nn) < .015, `${cup}: SN-N ${r.sn} N-N ${r.nn}`);

  }
  const c = goldOf('C'); assert.ok(c.arc > .07 && c.arc < .085, `C nipple-IMF ${c.arc}`);
});

test('ptosis lengthens the notch-nipple distance past the mastopexy threshold', () => {
  const a = goldOf('C', 0), b = goldOf('C', 2), c = goldOf('C', 3);
  assert.ok(a.sn < .21 && b.sn > .21 && c.sn > b.sn);
  PROFILE.cup = 'C'; PROFILE.ver++;
});
