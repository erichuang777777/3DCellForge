const BREAST_CANCER_SUBTYPES = [
  {
    id: 'luminal-a',
    label: 'Luminal A',
    shortLabel: 'ER/PR+, HER2−, low Ki-67',
    accent: '#5fa88f',
    order: 1,
    keywords: ['luminal a', 'luminal-a', 'luminala', '管腔a型', '管腔a', 'lumina a'],
  },
  {
    id: 'luminal-b-her2-negative',
    label: 'Luminal B (HER2-negative)',
    shortLabel: 'ER/PR+, HER2−, high Ki-67',
    accent: '#c9a227',
    order: 2,
    keywords: ['luminal b her2 negative', 'luminal b her2-negative', 'luminal b (her2-)', 'luminal b her2neg', '管腔b型her2阴性', '管腔b her2阴性', '管腔b(her2陰性)'],
  },
  {
    id: 'luminal-b-her2-positive',
    label: 'Luminal B (HER2-positive)',
    shortLabel: 'ER/PR+, HER2+',
    accent: '#d98a3d',
    order: 3,
    keywords: ['luminal b her2 positive', 'luminal b her2-positive', 'luminal b (her2+)', 'luminal b her2pos', '管腔b型her2阳性', '管腔b her2阳性', '管腔b(her2陽性)'],
  },
  {
    id: 'her2-enriched',
    label: 'HER2-enriched',
    shortLabel: 'ER/PR−, HER2+',
    accent: '#c4574f',
    order: 4,
    keywords: ['her2 enriched', 'her2-enriched', 'her2 positive subtype', 'her2阳性型', 'her2富集型', 'her2过表达型'],
  },
  {
    id: 'triple-negative',
    label: 'Triple-negative / Basal-like',
    shortLabel: 'ER/PR/HER2 all negative',
    accent: '#6b5fb0',
    order: 5,
    keywords: ['triple negative', 'triple-negative', 'tnbc', 'basal like', 'basal-like', '三阴性', '三阴性乳腺癌', '基底样'],
  },
]

const SUBTYPE_KEYWORDS_ANY = [
  'luminal', 'her2', 'basal', 'triple negative', 'tnbc', 'ki-67', 'ki67', 'receptor', 'er/pr',
  '管腔', '受体', '受體', '三阴', '三陰', '亚型', '亞型', '乳癌', '乳腺癌',
]

export function getBreastCancerSubtypes() {
  return BREAST_CANCER_SUBTYPES
}

export function getBreastCancerSubtype(subtypeId) {
  return BREAST_CANCER_SUBTYPES.find((subtype) => subtype.id === subtypeId) || null
}

export function inferBreastCancerSubtype(cell = {}) {
  const overrideId = String(cell.intelligence?.subtypeId || cell.subtypeId || '').trim().toLowerCase()
  const overrideMatch = BREAST_CANCER_SUBTYPES.find((subtype) => subtype.id === overrideId)
  if (overrideMatch) return overrideMatch

  const text = normalizeSearchText([cell.id, cell.fullName, cell.sourceFileName, cell.name, cell.type])
  if (!text) return null

  const scored = BREAST_CANCER_SUBTYPES
    .map((subtype) => ({ subtype, score: countKeywordHits(text, subtype.keywords) }))
    .sort((a, b) => b.score - a.score)

  return scored[0]?.score > 0 ? scored[0].subtype : null
}

export function looksLikeBreastCancerSubtypeAsset(cell = {}) {
  if (inferBreastCancerSubtype(cell)) return true
  const text = normalizeSearchText([cell.id, cell.fullName, cell.sourceFileName, cell.name, cell.type])
  return SUBTYPE_KEYWORDS_ANY.some((keyword) => text.includes(keyword))
}

function normalizeSearchText(parts) {
  return parts.filter(Boolean).join(' ').replace(/[_-]+/g, ' ').toLowerCase()
}

function countKeywordHits(text, keywords = []) {
  return keywords.reduce((score, keyword) => (text.includes(keyword.toLowerCase()) ? score + 1 : score), 0)
}
