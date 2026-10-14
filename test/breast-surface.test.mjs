import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { surfaceShape, implantEnvelopeShape } from '../public/breast-reconstruction-atlas/surface.js';

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
const context = vm.createContext({ THREE, surfaceShape, implantEnvelopeShape, QN: { uoq: [.025, .025] } });
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

test('application keeps attachments fixed as ptosis changes for every cup', () => {
  for (const cup of ['A', 'B', 'C', 'D', 'E', 'F']) {
    PROFILE.cup = cup; PROFILE.ver++;
    const a = geomOf({ P: .064, shape: 'natural', pt: 0 });
    for (const pt of [.5, 1, 2, 3]) {
      const g = geomOf({ P: .064, shape: 'natural', pt });
      assert.equal(g.top, a.top); assert.equal(g.imf, a.imf);
      assert.equal(g.imf, g.bot);
    }
  }
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
