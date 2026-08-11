import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  getBreastCancerSubtype,
  getBreastCancerSubtypes,
  inferBreastCancerSubtype,
  looksLikeBreastCancerSubtypeAsset,
} from '../src/domain/oncologySubtypes.js'

describe('breast cancer subtype teaching data', () => {
  it('exposes the five St Gallen molecular subtypes', () => {
    const subtypes = getBreastCancerSubtypes()
    assert.equal(subtypes.length, 5)
    assert.deepEqual(
      subtypes.map((subtype) => subtype.id).sort(),
      ['her2-enriched', 'luminal-a', 'luminal-b-her2-negative', 'luminal-b-her2-positive', 'triple-negative'].sort(),
    )
  })

  it('infers a subtype from an English filename', () => {
    const subtype = inferBreastCancerSubtype({ name: 'Luminal A teaching diagram', sourceFileName: 'luminal-a-sample.png' })
    assert.equal(subtype?.id, 'luminal-a')
  })

  it('infers a subtype from a Chinese label', () => {
    const subtype = inferBreastCancerSubtype({ name: '三阴性乳腺癌示意图', sourceFileName: 'sample.png' })
    assert.equal(subtype?.id, 'triple-negative')
  })

  it('distinguishes HER2-positive and HER2-negative Luminal B', () => {
    assert.equal(inferBreastCancerSubtype({ name: 'luminal b her2-positive sample' })?.id, 'luminal-b-her2-positive')
    assert.equal(inferBreastCancerSubtype({ name: 'luminal b her2-negative sample' })?.id, 'luminal-b-her2-negative')
  })

  it('respects an explicit subtype override', () => {
    const subtype = inferBreastCancerSubtype({ name: 'unlabeled upload', intelligence: { subtypeId: 'her2-enriched' } })
    assert.equal(subtype?.id, 'her2-enriched')
  })

  it('returns null when no subtype keyword matches', () => {
    assert.equal(inferBreastCancerSubtype({ name: 'red ferrari supercar' }), null)
  })

  it('looks up a subtype by id', () => {
    assert.equal(getBreastCancerSubtype('luminal-a').label, 'Luminal A')
    assert.equal(getBreastCancerSubtype('not-a-subtype'), null)
  })

  it('flags likely breast cancer assets even without a confident subtype match', () => {
    assert.equal(looksLikeBreastCancerSubtypeAsset({ name: 'breast cancer receptor overview' }), true)
    assert.equal(looksLikeBreastCancerSubtypeAsset({ name: 'red ferrari supercar' }), false)
  })
})
