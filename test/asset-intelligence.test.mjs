import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getAssetIntelligence, getSceneProfile, inferAssetCategory } from '../src/lib/assetIntelligence.js'

describe('asset intelligence', () => {
  it('uses a road scene for generated supercars', () => {
    const intelligence = getAssetIntelligence({
      name: 'hyper3d supercar test',
      sourceFileName: 'red-ferrari-supercar.png',
    })

    assert.equal(intelligence.category.id, 'road')
    assert.equal(intelligence.scene.id, 'road')
    assert.match(intelligence.scene.summary, /road deck/i)
  })

  it('keeps aircraft carriers in the vessel scene even when aircraft appears first', () => {
    const category = inferAssetCategory({
      name: 'Chinese aircraft carrier',
      sourceFileName: 'chinese-aircraft-carrier.png',
    })

    assert.equal(category.id, 'vessel')
    assert.equal(getSceneProfile(category.sceneProfile).id, 'vessel')
  })

  it('maps bronze mask artifacts to museum presentation', () => {
    const intelligence = getAssetIntelligence({
      name: '戴金面罩青铜人头像',
      sourceFileName: 'sanxingdui-bronze-mask.png',
    })

    assert.equal(intelligence.category.id, 'artifact')
    assert.equal(intelligence.scene.label, 'Museum Turntable')
  })

  it('maps breast cancer subtype illustrations to the oncology teaching scene', () => {
    const intelligence = getAssetIntelligence({
      name: 'Breast cancer Luminal A illustration',
      sourceFileName: 'luminal-a-breast-cancer-diagram.png',
    })

    assert.equal(intelligence.category.id, 'oncology')
    assert.equal(intelligence.scene.id, 'oncology')
    assert.match(intelligence.scene.summary, /pathology|clinical/i)
  })

  it('prefers the oncology scene over the generic specimen scene when both keywords appear', () => {
    const category = inferAssetCategory({
      name: 'Triple negative breast cancer cell diagram',
      sourceFileName: 'tnbc-cell-illustration.png',
    })

    assert.equal(category.id, 'oncology')
  })

  it('trusts configured vision analysis over ambiguous filenames', () => {
    const intelligence = getAssetIntelligence({
      name: 'demo upload',
      sourceFileName: 'unknown-image.png',
      intelligence: {
        configured: true,
        categoryId: 'artifact',
        categoryLabel: 'Museum Artifact',
        description: 'Ancient bronze ritual object.',
        material: 'Aged bronze and gold foil.',
        inspectionFocus: 'face relief and patina',
        presentation: 'Use a dark museum turntable.',
        tags: ['bronze', 'mask'],
      },
    })

    assert.equal(intelligence.category.id, 'artifact')
    assert.equal(intelligence.category.material, 'Aged bronze and gold foil.')
    assert.equal(intelligence.scene.id, 'artifact')
  })
})
