// 術式庫:以資料描述皮瓣,自動產生分步情境;另含全切方式、假體放置、脂肪移植、乳頭重建、對側對稱。
// 座標為世界座標(公尺,Y 向上,正面 +Z,病人右側 -X)。所有臨床文字為草稿,待醫師審核。

export const CATS = [
  { id: 'know', zh: '認識乳房' },
  { id: 'surgery', zh: '手術方式' },
  { id: 'partial', zh: '部分重建' },
  { id: 'implant', zh: '假體重建' },
  { id: 'abdo', zh: '自體:腹部' },
  { id: 'other', zh: '自體:背、臀、腿' },
  { id: 'finish', zh: '後續與對稱' },
  { id: 'cosmetic', zh: '美容' }
];

// 原有情境的分類與總覽表資料
export const BASE_META = {
  gland: { cat: 'know' },
  bcs: { cat: 'surgery', meta: { src: '無', muscle: '否', vessel: '—', mode: '—', scar: '乳房', risk: '局部變形,需放療' } },
  ld: { cat: 'partial', meta: { src: '背闊肌(部分)', muscle: '是', vessel: '胸背動靜脈', mode: '帶蒂', scar: '腋下,視術式有背部', risk: '血清腫、肩部力量' } },
  omentum: { cat: 'partial', meta: { src: '大網膜', muscle: '否', vessel: '胃網膜血管', mode: '帶蒂(腹腔鏡)', scar: '腹腔鏡小孔', risk: '腹部手術風險,證據較少' } },
  implant: { cat: 'implant', meta: { src: '擴張器、假體', muscle: '否', vessel: '—', mode: '兩階段', scar: '胸部', risk: '包膜攣縮、需更換' } },
  tram: { cat: 'abdo', meta: { src: '下腹皮膚脂肪 + 腹直肌', muscle: '是(整條)', vessel: '上腹壁動靜脈', mode: '帶蒂', scar: '下腹橫向', risk: '腹壁膨出、疝氣' } },
  diep: { cat: 'abdo', meta: { src: '下腹皮膚脂肪', muscle: '否', vessel: '下腹壁動靜脈穿通枝', mode: '游離(顯微吻合)', scar: '下腹橫向', risk: '皮瓣血流問題' } },
  aug: { cat: 'cosmetic', meta: { src: '假體', muscle: '否', vessel: '—', mode: '—', scar: '下皺褶、乳暈或腋下', risk: '包膜攣縮、破裂、BIA-ALCL(罕見)' } }
};

const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const r4 = (x) => +x.toFixed(4);
// 在皮膚切平面上畫橢圓(之後由程式沿 axis 徑向投影到皮膚)
function ell(c, e1, e2, r1, r2, n = 36) {
  const a = norm(e1), b = norm(e2);
  return Array.from({ length: n }, (_, i) => { const t = (i / n) * Math.PI * 2; return [0, 1, 2].map((k) => r4(c[k] + a[k] * r1 * Math.cos(t) + b[k] * r2 * Math.sin(t))); });
}
// 供區疤痕:橢圓的長軸線(縫合後)
function seam(c, e1, r1, bow = [0, 0, 0], n = 9) {
  const a = norm(e1);
  return Array.from({ length: n }, (_, i) => { const t = -1 + (2 * i) / (n - 1); return [0, 1, 2].map((k) => r4(c[k] + a[k] * r1 * t + bow[k] * (1 - t * t))); });
}

// 供區定義
const D = {
  abdomen: { zh: '下腹部', c: [0, 0.955, 0.115], e1: [1, 0, 0], e2: [0, 1, 0], r: [0.125, 0.05], axis: [0, 0], normal: [0, 0, 1], cam: 'abdomen', wound: [0.13, 0.05, 0.08] },
  back: { zh: '背部', c: [-0.1, 1.18, -0.12], e1: [1, 0.25, 0], e2: [-0.25, 1, 0], r: [0.08, 0.035], axis: [0, -0.02], normal: [0, 0, -1], cam: 'back', wound: [0.08, 0.04, 0.05] },
  backExt: { zh: '背部(加周圍脂肪)', c: [-0.1, 1.15, -0.12], e1: [1, 0.25, 0], e2: [-0.25, 1, 0], r: [0.09, 0.045], axis: [0, -0.02], normal: [0, 0, -1], cam: 'back', wound: [0.09, 0.05, 0.06] },
  tdap: { zh: '腋下後方背部', c: [-0.14, 1.21, -0.08], e1: [0.8, 0.1, -0.6], e2: [0, 1, 0], r: [0.07, 0.03], axis: [0, -0.02], normal: [-0.6, 0, -0.8], cam: 'backLat', wound: [0.06, 0.035, 0.06] },
  latChest: { zh: '側胸(胸罩線)', c: [-0.165, 1.2, 0.0], e1: [0, 0.15, 1], e2: [0, 1, 0], r: [0.065, 0.028], axis: [0, 0], normal: [-1, 0, 0], cam: 'lateral', wound: [0.04, 0.03, 0.07] },
  aicap: { zh: '乳房下皺褶下方', c: [-0.065, 1.16, 0.115], e1: [1, 0, 0], e2: [0, 1, 0], r: [0.07, 0.024], axis: [0, 0], normal: [0, -0.1, 1], cam: 'front', wound: [0.07, 0.025, 0.04] },
  micap: { zh: '乳房下內側', c: [-0.03, 1.17, 0.12], e1: [1, 0.1, 0], e2: [0, 1, 0], r: [0.045, 0.022], axis: [0, 0], normal: [0, -0.1, 1], cam: 'front', wound: [0.05, 0.025, 0.04] },
  tep: { zh: '上腹部', c: [-0.07, 1.1, 0.115], e1: [1, 0.2, 0], e2: [-0.2, 1, 0], r: [0.07, 0.03], axis: [0, 0], normal: [0, 0, 1], cam: 'front', wound: [0.07, 0.03, 0.04] },
  sgap: { zh: '上臀部', c: [-0.09, 0.925, -0.135], e1: [1, 0.3, 0], e2: [-0.3, 1, 0], r: [0.085, 0.035], axis: [0, -0.04], normal: [0, 0.1, -1], cam: 'backLow', wound: [0.085, 0.04, 0.05] },
  igap: { zh: '下臀部(臀溝)', c: [-0.065, 0.8, -0.12], e1: [1, -0.15, 0], e2: [0.15, 1, 0], r: [0.075, 0.03], axis: [-0.04, -0.04], normal: [0, -0.1, -1], cam: 'backLow', wound: [0.075, 0.035, 0.05] },
  lap: { zh: '腰側', c: [-0.135, 1.03, -0.07], e1: [0.8, 0.15, -0.6], e2: [0, 1, 0], r: [0.075, 0.035], axis: [0, -0.02], normal: [-0.6, 0, -0.8], cam: 'backLow', wound: [0.07, 0.04, 0.06] },
  pap: { zh: '大腿後內側', c: [-0.065, 0.735, -0.085], e1: [0.9, 0, 0.4], e2: [0, 1, 0], r: [0.085, 0.03], axis: [-0.085, -0.03], normal: [0.4, 0, -0.9], cam: 'thighBack', wound: [0.06, 0.03, 0.05] },
  tug: { zh: '大腿上內側', c: [-0.02, 0.755, -0.005], e1: [0, 0, 1], e2: [0, 1, 0], r: [0.075, 0.028], axis: [-0.085, -0.02], normal: [1, 0, 0], cam: 'thighIn', wound: [0.03, 0.03, 0.07] },
  alt: { zh: '大腿前外側', c: [-0.14, 0.68, 0.03], e1: [0, 1, 0], e2: [0.7, 0, 0.7], r: [0.09, 0.035], axis: [-0.095, -0.02], normal: [-0.7, 0, 0.7], cam: 'thigh', wound: [0.04, 0.09, 0.04] }
};

// 皮瓣(術式)定義
export const TECHS = [
  // ---- 部分重建:胸壁穿通枝皮瓣 ----
  { id: 'licap', cat: 'partial', zh: '側胸肋間穿通枝皮瓣', en: 'LICAP flap', short: 'LICAP', donor: 'latChest', zone: 'lat', transfer: 'pedicled', perf: [-0.155, 1.2, 0.03], anchor: [-0.155, 1.2, 0.03], vessels: ['Posterior intercostal arteries.r'],
    one: '取側胸胸罩線下的皮膚脂肪,以外側肋間動脈穿通枝為蒂,像螺旋槳一樣轉進乳房外側缺損。',
    vesselText: '外側肋間動脈的穿通枝從肋骨之間穿出(紅點),是皮瓣唯一的血流來源。',
    pros: ['保留背闊肌與胸背血管,日後還能用', '疤痕在側胸,可被胸罩遮住', '不需顯微手術'], cons: ['可取體積有限', '皮瓣遠端可能部分壞死', '穿通枝位置因人而異,需術前超音波定位'], fit: ['外側、外上、外下缺損', '乳房小到中等', '側胸有多餘組織'],
    meta: { src: '側胸皮膚脂肪', muscle: '否', vessel: '外側肋間動脈穿通枝', mode: '帶蒂(螺旋槳)', scar: '側胸', risk: '部分壞死' } },
  { id: 'ltap', cat: 'partial', zh: '外側胸動脈穿通枝皮瓣', en: 'LTAP flap', short: 'LTAP', donor: 'latChest', zone: 'lat', transfer: 'pedicled', perf: [-0.145, 1.24, 0.045], anchor: [-0.145, 1.24, 0.045], vessels: ['Lateral thoracic artery.r'],
    one: '和 LICAP 取同一區組織,但以外側胸動脈的穿通枝為蒂,用於外側缺損。',
    vesselText: '外側胸動脈沿側胸壁下行(高亮紅線),在腋下附近分出穿通枝(紅點)。',
    pros: ['保留背闊肌', '疤痕在側胸', '血管蒂較靠近乳房,旋轉方便'], cons: ['外側胸動脈有時缺如或細小', '可取體積有限'], fit: ['外側、外上缺損', '側胸有多餘組織'],
    meta: { src: '側胸皮膚脂肪', muscle: '否', vessel: '外側胸動脈穿通枝', mode: '帶蒂', scar: '側胸', risk: '血管變異' } },
  { id: 'tdap', cat: 'partial', zh: '胸背動脈穿通枝皮瓣', en: 'TDAP flap', short: 'TDAP', donor: 'tdap', zone: 'uoq', transfer: 'pedicled', perf: [-0.145, 1.24, -0.06], anchor: [-0.135, 1.33, -0.005], vessels: ['Thoracodorsal artery.r', 'Thoracodorsal vein.r'],
    one: '取腋下後方背部的皮膚脂肪,只帶胸背動脈的穿通枝,不取背闊肌,轉到乳房外上或外側。',
    vesselText: '胸背動脈穿通枝穿過背闊肌到皮膚。醫師沿穿通枝把血管分離出來,肌肉留在原位。',
    pros: ['不取肌肉,肩部功能保留', '可取的體積比 LICAP 大', '疤痕在背部胸罩線附近'], cons: ['分離穿通枝較費時', '背部疤痕', '血清腫'], fit: ['外上、外側、上方缺損', '想保留背闊肌功能'],
    meta: { src: '背部皮膚脂肪', muscle: '否', vessel: '胸背動脈穿通枝', mode: '帶蒂', scar: '背部', risk: '血清腫' } },
  { id: 'aicap', cat: 'partial', zh: '前肋間動脈穿通枝皮瓣', en: 'AICAP flap', short: 'AICAP', donor: 'aicap', zone: 'low', transfer: 'pedicled', perf: [-0.055, 1.17, 0.12], anchor: [-0.055, 1.17, 0.12], vessels: ['Musculophrenic artery.r'],
    one: '取乳房下皺褶下方的組織,以前肋間動脈穿通枝為蒂往上翻,補乳房下方與內下的缺損。',
    vesselText: '前肋間動脈穿通枝在乳房下皺褶附近穿出(紅點),來自內乳動脈與肌膈動脈的分支。',
    pros: ['疤痕藏在乳房下皺褶', '組織柔軟,適合小乳房', '不需顯微手術'], cons: ['可取體積有限', '下皺褶位置可能略為改變', '長期資料仍少'], fit: ['下方、內下、下方中央缺損', '小乳房'],
    meta: { src: '下皺褶下方皮膚脂肪', muscle: '否', vessel: '前肋間動脈穿通枝', mode: '帶蒂', scar: '乳房下皺褶', risk: '部分壞死' } },
  { id: 'micap', cat: 'partial', zh: '內側肋間動脈穿通枝皮瓣', en: 'MICAP flap', short: 'MICAP', donor: 'micap', zone: 'liq', transfer: 'pedicled', perf: [-0.025, 1.18, 0.12], anchor: [-0.025, 1.18, 0.12], vessels: ['Internal thoracic artery.r'],
    one: '取乳房下內側的組織,以內乳動脈的肋間穿通枝為蒂,補內側與內下缺損。',
    vesselText: '內乳動脈在胸骨旁分出穿通枝(紅點),穿過肋間到皮膚。',
    pros: ['補內側缺損,避免乳溝處凹陷', '疤痕在下皺褶內側'], cons: ['可取體積小', '內側疤痕較容易被看到', '證據多為小型病例'], fit: ['內下、內側缺損', '小乳房'],
    meta: { src: '下內側皮膚脂肪', muscle: '否', vessel: '內乳動脈穿通枝', mode: '帶蒂', scar: '下皺褶內側', risk: '體積有限' } },
  { id: 'tep', cat: 'partial', zh: '胸腹壁皮瓣', en: 'Thoracoepigastric flap', short: '胸腹壁皮瓣', donor: 'tep', zone: 'low', transfer: 'pedicled', perf: [-0.03, 1.13, 0.12], anchor: [-0.03, 1.13, 0.12], vessels: ['Superior epigastric artery.r'],
    one: '把上腹部的皮膚脂肪往上推進或轉位,補乳房下方缺損;血流來自上腹壁與肋下穿通枝。',
    vesselText: '上腹壁動脈的穿通枝(紅點)供應這塊組織。',
    pros: ['不需顯微手術', '可補下方較大的缺損'], cons: ['上腹部疤痕', '可能改變乳房下皺褶', '文獻資料較少'], fit: ['下方缺損', '上腹部有多餘組織'],
    meta: { src: '上腹部皮膚脂肪', muscle: '否', vessel: '上腹壁、肋下穿通枝', mode: '帶蒂(推進)', scar: '上腹部', risk: '資料較少' } },
  // ---- 自體:腹部 ----
  { id: 'free_tram', cat: 'abdo', zh: '游離 TRAM', en: 'Free TRAM flap', short: '游離 TRAM', donor: 'abdomen', transfer: 'free', muscle: 'rectus_r', vessels: ['Inferior epigastric artery.r', 'Inferior epigastric vein.r'],
    one: '取下腹皮膚脂肪加一段腹直肌,以下腹壁血管顯微吻合到內乳血管。',
    vesselText: '下腹壁動靜脈從下方進入腹直肌。游離 TRAM 連同一段肌肉一起取下。',
    pros: ['血流比帶蒂 TRAM 好', '外形自然'], cons: ['犧牲一段腹直肌,腹壁較弱', '需顯微手術'], fit: ['腹部組織足夠', '穿通枝不適合做 DIEP 時'],
    meta: { src: '下腹皮膚脂肪 + 一段腹直肌', muscle: '是(一段)', vessel: '下腹壁動靜脈', mode: '游離', scar: '下腹橫向', risk: '腹壁膨出' } },
  { id: 'ms_tram', cat: 'abdo', zh: '保留肌肉 TRAM', en: 'Muscle-sparing TRAM', short: 'MS-TRAM', donor: 'abdomen', transfer: 'free', muscle: 'rectus_r', vessels: ['Inferior epigastric artery.r', 'Inferior epigastric vein.r'],
    one: '只取包含穿通枝的一小條腹直肌,介於 TRAM 與 DIEP 之間。',
    vesselText: '只保留穿通枝周圍的一小條肌肉(高亮),其餘腹直肌留在原位。',
    pros: ['血流穩定', '腹壁損傷比 TRAM 少'], cons: ['仍取少量肌肉', '需顯微手術'], fit: ['穿通枝細小、分散時'],
    meta: { src: '下腹皮膚脂肪 + 小段肌肉', muscle: '少量', vessel: '下腹壁動靜脈', mode: '游離', scar: '下腹橫向', risk: '腹壁稍弱' } },
  { id: 'siea', cat: 'abdo', zh: '淺下腹壁動脈皮瓣', en: 'SIEA flap', short: 'SIEA', donor: 'abdomen', transfer: 'free', vessels: ['Superficial epigastric artery.r'],
    one: '用皮下的淺層下腹壁血管,完全不切開筋膜與肌肉。',
    vesselText: '淺下腹壁動脈走在皮下脂肪層(高亮),不穿過肌肉。',
    pros: ['腹壁完全不受影響', '術後疼痛較少'], cons: ['血管常太細或缺如,需術中評估', '血流範圍通常只到同側半邊'], fit: ['淺層血管粗大的病人', '只需中小體積'],
    meta: { src: '下腹皮膚脂肪', muscle: '否', vessel: '淺下腹壁動脈', mode: '游離', scar: '下腹橫向', risk: '血管常不可用' } },
  { id: 'stacked', cat: 'abdo', zh: '疊加 DIEP', en: 'Stacked / bipedicled DIEP', short: '疊加 DIEP', donor: 'abdomen', transfer: 'free', count: 2, vessels: ['Inferior epigastric artery.r', 'Inferior epigastric artery.l'],
    one: '把兩側下腹皮瓣疊在一起,重建單側乳房,增加體積與突度。',
    vesselText: '左右兩組下腹壁血管都要保留,分別接到胸前血管。',
    pros: ['腹部組織少的人也能得到足夠體積', '不用假體'], cons: ['需兩組血管吻合,手術較久', '只能做單側'], fit: ['單側重建、需要較大體積', '腹部組織偏少'],
    meta: { src: '整個下腹(兩半)', muscle: '否', vessel: '雙側下腹壁血管', mode: '游離 ×2', scar: '下腹橫向', risk: '手術時間長' } },
  { id: 'hybrid', cat: 'abdo', zh: '混合式重建(DIEP 加假體)', en: 'Hybrid DIEP + implant', short: 'DIEP + 假體', donor: 'abdomen', transfer: 'free', implant: true, vessels: ['Inferior epigastric artery.r'],
    one: '自體皮瓣下面再放一顆小假體,補足體積與突度。',
    vesselText: '和 DIEP 一樣使用下腹壁血管。',
    pros: ['瘦的病人也能有足夠體積', '比單純假體更耐受放療'], cons: ['同時有皮瓣與假體的風險', '假體不能壓迫血管蒂'], fit: ['腹部組織不足但想用自體組織'],
    meta: { src: '下腹皮膚脂肪 + 假體', muscle: '否', vessel: '下腹壁穿通枝', mode: '游離 + 假體', scar: '下腹橫向', risk: '兩種方式的風險' } },
  // ---- 自體:背部 ----
  { id: 'ld_implant', cat: 'other', zh: '背闊肌皮瓣加假體', en: 'Latissimus dorsi + implant', short: '背闊肌 + 假體', donor: 'back', transfer: 'pedicled', muscle: 'lat_r', anchor: [-0.135, 1.33, -0.005], pedMuscle: true, implant: true, vessels: ['Thoracodorsal artery.r', 'Thoracodorsal vein.r'],
    one: '整片背闊肌連同背部皮島轉到前胸,下面放假體補體積。',
    vesselText: '整片背闊肌(高亮)以胸背血管為蒂,從腋下的皮下隧道轉到前胸。可用內視鏡或機器人取肌肉,縮短背部疤痕。',
    pros: ['血流可靠,不需顯微手術', '可覆蓋放療過的胸壁'], cons: ['背部疤痕', '血清腫常見', '肩部力量可能減弱'], fit: ['曾放療的胸壁', '不適合腹部皮瓣'],
    meta: { src: '背闊肌 + 背部皮島 + 假體', muscle: '是(整片)', vessel: '胸背動靜脈', mode: '帶蒂', scar: '背部', risk: '血清腫、肩部力量' } },
  { id: 'ext_ld', cat: 'other', zh: '擴大背闊肌皮瓣', en: 'Extended latissimus dorsi', short: '擴大背闊肌', donor: 'backExt', transfer: 'pedicled', muscle: 'lat_r', anchor: [-0.135, 1.33, -0.005], pedMuscle: true, vessels: ['Thoracodorsal artery.r', 'Thoracodorsal vein.r'],
    one: '背闊肌加上周圍的脂肪(肩胛周圍、腰側),不放假體就能重建小到中等的乳房。',
    vesselText: '背闊肌連同周圍脂肪一起取(高亮),血管蒂同樣是胸背血管。',
    pros: ['全自體,不用假體', '不需顯微手術'], cons: ['血清腫比一般背闊肌更常見', '背部疤痕較長'], fit: ['小到中等乳房', '背部有足夠脂肪'],
    meta: { src: '背闊肌 + 背部脂肪', muscle: '是', vessel: '胸背動靜脈', mode: '帶蒂', scar: '背部', risk: '血清腫' } },
  // ---- 自體:臀部、腰側 ----
  { id: 'sgap', cat: 'other', zh: '臀上動脈穿通枝皮瓣', en: 'SGAP flap', short: 'SGAP', donor: 'sgap', transfer: 'free', vessels: ['Superior gluteal artery.r'],
    one: '取上臀部的皮膚脂肪,以臀上動脈穿通枝顯微吻合到胸前,不取肌肉。',
    vesselText: '臀上動脈從骨盆穿出,分支穿過臀大肌(高亮)到皮膚。',
    pros: ['不取肌肉', '疤痕可被內褲遮住', '臀部脂肪較結實,可做出突度'], cons: ['術中需要翻身', '血管蒂較短', '臀部外形可能不對稱'], fit: ['腹部組織不足或曾腹部手術'],
    meta: { src: '上臀部皮膚脂肪', muscle: '否', vessel: '臀上動脈穿通枝', mode: '游離', scar: '上臀部', risk: '臀部外形改變' } },
  { id: 'igap', cat: 'other', zh: '臀下動脈穿通枝皮瓣', en: 'IGAP flap', short: 'IGAP', donor: 'igap', transfer: 'free', vessels: ['Inferior gluteal artery.r'],
    one: '取下臀部靠近臀溝的組織,以臀下動脈穿通枝顯微吻合。',
    vesselText: '臀下動脈從臀大肌下緣附近穿出(高亮)。',
    pros: ['疤痕藏在臀溝', '不取肌肉'], cons: ['坐姿可能不適', '接近坐骨神經,需小心分離', '需翻身'], fit: ['腹部組織不足', '下臀部有多餘組織'],
    meta: { src: '下臀部皮膚脂肪', muscle: '否', vessel: '臀下動脈穿通枝', mode: '游離', scar: '臀溝', risk: '坐姿不適' } },
  { id: 'lap', cat: 'other', zh: '腰動脈穿通枝皮瓣', en: 'LAP flap', short: 'LAP', donor: 'lap', transfer: 'free', vessels: ['Lumbar arteries.r'],
    one: '取腰側(俗稱游泳圈)的皮膚脂肪,以腰動脈穿通枝顯微吻合。',
    vesselText: '腰動脈從脊椎旁穿出到腰側皮膚(高亮)。',
    pros: ['疤痕在腰側,可順便改善腰線', '不取肌肉'], cons: ['血管蒂短,常需血管移植', '需翻身'], fit: ['腰側有多餘組織、腹部不適合'],
    meta: { src: '腰側皮膚脂肪', muscle: '否', vessel: '腰動脈穿通枝', mode: '游離', scar: '腰側', risk: '血管蒂短' } },
  // ---- 自體:大腿 ----
  { id: 'pap', cat: 'other', zh: '股深動脈穿通枝皮瓣', en: 'PAP flap', short: 'PAP', donor: 'pap', transfer: 'free', vessels: ['Perforating femoral arteries.r', 'Deep femoral artery.r'],
    one: '取大腿後內側、臀溝下方的皮膚脂肪,以股深動脈穿通枝顯微吻合。',
    vesselText: '股深動脈的穿通枝從大腿後側肌肉間穿出(高亮)。',
    pros: ['不取肌肉', '疤痕在臀溝下與大腿內後側', '兩側可同時取,適合雙側重建'], cons: ['體積多為小到中等', '坐姿時傷口受壓'], fit: ['腹部組織不足或曾腹部手術', '小到中等乳房'],
    meta: { src: '大腿後內側皮膚脂肪', muscle: '否', vessel: '股深動脈穿通枝', mode: '游離', scar: '大腿後內側', risk: '傷口癒合' } },
  { id: 'tug', cat: 'other', zh: '橫向上股薄肌皮瓣', en: 'TUG flap', short: 'TUG', donor: 'tug', transfer: 'free', muscle: 'gracilis_r', vessels: ['Medial circumflex femoral artery.r'],
    one: '取大腿上內側的皮膚脂肪連同股薄肌,以旋股內側動脈分支顯微吻合。',
    vesselText: '股薄肌(高亮)由旋股內側動脈分支供應。',
    pros: ['疤痕在鼠蹊與大腿內側', '股薄肌功能可由其他肌肉代償'], cons: ['體積較小', '大腿內側麻木、傷口癒合問題'], fit: ['小到中等乳房', '大腿內側有多餘組織'],
    meta: { src: '大腿上內側皮膚脂肪 + 股薄肌', muscle: '是(股薄肌)', vessel: '旋股內側動脈', mode: '游離', scar: '大腿上內側', risk: '傷口癒合' } },
  { id: 'alt', cat: 'other', zh: '前外側大腿皮瓣', en: 'ALT flap', short: 'ALT', donor: 'alt', transfer: 'free', vessels: ['Descending branch of lateral circumflex femoral artery', 'Lateral circumflex femoral artery.r'],
    one: '取大腿前外側的皮膚脂肪,以旋股外側動脈降支的穿通枝顯微吻合。',
    vesselText: '旋股外側動脈降支沿股外側肌走(高亮),穿通枝到皮膚。',
    pros: ['血管蒂長', '不需翻身', '兩側可同時取'], cons: ['大腿前外側疤痕較明顯', '脂肪較薄的人體積不足'], fit: ['腹部組織不足', '需要較長血管蒂時'],
    meta: { src: '大腿前外側皮膚脂肪', muscle: '否', vessel: '旋股外側動脈降支', mode: '游離', scar: '大腿前外側', risk: '疤痕明顯' } }
];
export const TECH_BY_ID = Object.fromEntries(TECHS.map((t) => [t.id, t]));
export const DONORS = D;

// ---- 由術式資料自動產生情境步驟 ----
const SSM = { R: { P: 0.012, shape: 'natural', areola: false, defect: 0, gland: false, fat: false } };
const ssmRing = { side: 'R', closed: true, pts: Array.from({ length: 25 }, (_, i) => { const t = (i / 24) * Math.PI * 2; return [r4(0.02 * Math.sin(t)), r4(0.02 * Math.cos(t))]; }) };
const zoneZh = { lat: '外側', uoq: '外上方', low: '下方', liq: '內下方' };

function techScenario(t) {
  const d = D[t.donor]; const cs = t.count === 2 ? [[-0.065, d.c[1], d.c[2]], [0.065, d.c[1], d.c[2]]] : [d.c];
  const design = cs.map((c) => ({ pts: ell(c, d.e1, d.e2, t.count === 2 ? d.r[0] / 2 : d.r[0], d.r[1]), axis: d.axis, n: d.normal, dashed: true, closed: true }));
  const donorScar = [{ pts: seam(d.c, d.e1, d.r[0] * 0.92), axis: d.axis, n: d.normal }];
  const woundAt = { c: d.c, r: d.wound };
  const free = t.transfer === 'free'; const partial = !!t.zone;
  const gf = (tt, vis = 1) => ({ tech: t.id, t: tt, vis });
  const steps = [];
  if (partial) {
    const cut = { tq: t.zone, cut: 1, R: { defect: 0.018, dq: t.zone } };
    steps.push({ title: `${zoneZh[t.zone]}缺損`, cam: 'oblique', peel: 2, text: `保留乳房手術切除${zoneZh[t.zone]}的腫瘤後留下缺損(紅色腔室),以下用${t.zh}填補。`, state: { ...cut } });
    steps.push({ title: `設計${d.zh}皮瓣`, cam: d.cam, text: `在${d.zh}畫出皮瓣範圍(虛線)。${t.one}`, state: { ...cut, wscars: design } });
    steps.push({ title: '穿通枝血管', cam: d.cam, peel: 1, text: t.vesselText, state: { ...cut, vessels: t.vessels, perfAt: t.perf, woundAt, wound: 0 } });
    steps.push({ title: '旋轉填補缺損', cam: 'oblique', text: '皮瓣以穿通枝為軸旋轉或推進,經皮下送到缺損處。', state: { ...cut, ghostSkin: 0.4, perfAt: t.perf, woundAt, wound: 1, gf: gf(1) }, dur: 2400 });
    steps.push({ title: '術後外觀', cam: 'oblique', text: `乳房${zoneZh[t.zone]}的凹陷得到填補,供區疤痕在${d.zh}。`, state: { tq: t.zone, cut: 1, R: { defect: 0.003, dq: t.zone }, gf: gf(1), wscars: donorScar } });
    steps.push({ title: '供區疤痕', cam: d.cam, text: `供區直接縫合,疤痕在${d.zh}。`, state: { tq: t.zone, cut: 1, R: { defect: 0.003, dq: t.zone }, gf: gf(1), wscars: donorScar } });
  } else {
    const rec = { R: { P: t.implant ? 0.062 : 0.06, shape: 'natural', areola: false, defect: 0, gland: false, fat: true }, paddle: 1, paddleR: [0.022, 0.022, 0.03] };
    const impl = t.implant ? { imp: { kind: 'implant', plane: 'pre', fill: 0.6, vis: 1 } } : {};
    steps.push({ title: '皮膚保留式全切', cam: 'oblique', text: '多數立即重建會用皮膚保留式全切:切除乳腺與乳頭乳暈,保留大部分皮膚,只留一圈乳暈處的切口。', state: { ...SSM, custom: [ssmRing] } });
    steps.push({ title: `設計${d.zh}皮瓣`, cam: d.cam, text: `在${d.zh}畫出皮瓣範圍(虛線)。${t.one}`, state: { ...SSM, custom: [ssmRing], wscars: design } });
    steps.push({ title: '血管與組織', cam: d.cam, peel: 1, text: t.vesselText, state: { ...SSM, hi: t.muscle ? [t.muscle] : [], vessels: t.vessels, ghostMus: 0.45 } });
    steps.push({ title: free ? '皮瓣取下,移到胸前' : '經皮下隧道轉到胸前', cam: free ? 'full' : 'oblique', text: free ? '皮瓣連同血管完全取下(游離皮瓣),移到胸前。' : '皮瓣連同肌肉與血管蒂,經腋下皮下隧道轉到前胸。', state: { ...SSM, ghostSkin: 0.45, hi: t.muscle && !free ? [t.muscle] : [], woundAt, wound: 1, gf: gf(1) }, dur: free ? 3200 : 2600 });
    if (free) steps.push({ title: '顯微吻合到內乳血管', cam: 'oblique', peel: 4, text: '在胸骨旁找到內乳動靜脈,在顯微鏡下接上皮瓣血管(黃色光點)。', state: { ...SSM, woundAt, wound: 1, gf: gf(1, 0.45), vessels: ['Internal thoracic artery.r', 'Internal thoracic veins.r'], anast: 1 } });
    if (t.implant) steps.push({ title: '皮瓣下放入假體', cam: 'oblique', peel: 1, text: '在皮瓣下方加一顆假體補足體積與突度,注意不能壓到血管蒂。', state: { ...SSM, ...impl, R: { ...SSM.R, P: 0.03 }, gf: gf(1, 0.5), ghostSkin: 1 } });
    steps.push({ title: '塑形後外觀', cam: 'oblique', text: '皮瓣塑形成乳房,原乳暈處可見一塊皮島,日後可做乳頭重建。', state: { ...rec, ...impl, wscars: donorScar } });
    steps.push({ title: '供區疤痕', cam: d.cam, text: `供區直接縫合,疤痕在${d.zh}。`, state: { ...rec, ...impl, wscars: donorScar } });
  }
  return { id: t.id, cat: t.cat, tag: CATS.find((c) => c.id === t.cat).zh, name: `${t.zh}(${t.en})`, short: t.short, one: t.one, steps, pros: t.pros, cons: t.cons, fit: t.fit, meta: t.meta };
}

// ---- 手寫專題情境 ----
const nipRing = (r, side = 'R', dashed = false) => ({ side, dashed, closed: true, pts: Array.from({ length: 25 }, (_, i) => { const t = (i / 24) * Math.PI * 2; return [r4(r * Math.sin(t)), r4(r * Math.cos(t))]; }) });
const line = (pts, side = 'R', dashed = false) => ({ side, dashed, closed: false, pts });
const wiseDesign = (side) => [nipRing(0.021, side, true), line([[-0.012, -0.02], [-0.035, -0.058], [-0.085, -0.052]], side, true), line([[0.012, -0.02], [0.035, -0.058], [0.085, -0.052]], side, true), line([[-0.085, -0.052], [-0.04, -0.072], [0, -0.075], [0.04, -0.072], [0.085, -0.052]], side, true)];
const invT = (side) => [nipRing(0.019, side), line([[0, -0.019], [0, -0.05]], side), line([[-0.065, -0.045], [-0.03, -0.052], [0, -0.054], [0.03, -0.052], [0.065, -0.045]], side)];
const BIG = { R: { P: 0.08, ptosis: 1.8, sc: 1.08 } };

const MAST_TYPES = {
  id: 'masttypes', cat: 'surgery', tag: '手術方式', name: '全切的不同方式', short: '全切方式',
  one: '全切可以保留皮膚、保留乳頭,或縮減皮膚,依腫瘤位置、乳房大小與重建計畫選擇。',
  steps: [
    { title: '傳統全切', cam: 'oblique', text: '切除乳房組織、乳頭乳暈與部分皮膚,留下橫向疤痕。若不立即重建,胸前是平的。', state: { R: { P: 0, shape: 'flat', areola: false, gland: false, fat: false }, scars: ['mast_line'] } },
    { title: '皮膚保留式(SSM):切口', cam: 'oblique', text: '只在乳暈處切一圈(虛線),從這裡切除乳腺與乳頭乳暈,保留大部分皮膚。', state: { custom: [nipRing(0.02, 'R', true)] } },
    { title: '皮膚保留式:立即重建後', cam: 'oblique', text: '保留的皮膚包住假體或皮瓣,外形自然。原乳暈處是一圈疤痕或皮島,乳頭可日後重建。', state: { R: { P: 0.06, areola: false, gland: false }, paddle: 1, paddleR: [0.021, 0.021, 0.03] } },
    { title: '乳頭保留式(NSM):切口', cam: 'oblique', text: '保留乳頭乳暈,切口常放在乳房下皺褶或外側。腫瘤離乳頭夠遠、乳頭下方切緣乾淨時才適合。', state: { custom: [line([[-0.03, -0.052], [-0.01, -0.058], [0.01, -0.058], [0.03, -0.052]], 'R', true)] } },
    { title: '乳頭保留式:立即重建後', cam: 'oblique', text: '乳頭乳暈保留,疤痕藏在乳房下緣。乳頭感覺通常會減少,也可能部分壞死。', state: { R: { P: 0.06, gland: false }, custom: [line([[-0.03, -0.052], [-0.01, -0.058], [0.01, -0.058], [0.03, -0.052]], 'R')] } },
    { title: '縮皮式(Wise pattern):設計', cam: 'oblique', text: '乳房大或下垂時,用倒 T 形(鑰匙孔)設計切除多餘皮膚,讓重建後的乳房大小與位置更好。', state: { ...BIG, custom: wiseDesign('R') } },
    { title: '縮皮式:重建後', cam: 'oblique', text: '乳房縮小上提,疤痕呈倒 T。下方的真皮可做成吊帶覆蓋假體。對側常一起做縮乳以求對稱。', state: { R: { P: 0.058, lift: 0.01, ptosis: 0.5, gland: false }, custom: invT('R') } },
    { title: 'Goldilocks', cam: 'oblique', text: '同樣用 Wise 切口,但把下方原本要丟掉的皮膚脂肪留下來,自己捲成一個小乳房,不用假體也不用其他部位的皮瓣。適合乳房大、體重較重或共病多的病人。', state: { R: { P: 0.034, lift: 0.004, ptosis: 0.6, areola: false, gland: false }, custom: invT('R') } },
    { title: '內視鏡或機器人乳頭保留式', cam: 'lateral', text: '從側胸腋中線附近的單一小切口(約 3 到 5 公分)完成切除與重建,胸前沒有疤痕。', state: { R: { P: 0.06, gland: false }, wscars: [{ pts: [[-0.165, 1.24, 0.02], [-0.167, 1.22, 0.015], [-0.168, 1.2, 0.01]], axis: [0, 0] }] } }
  ],
  pros: ['保留皮膚或乳頭,重建外形較自然', 'Goldilocks 讓不適合大手術的人也能有乳房外形', '微創方式胸前沒有疤痕'],
  cons: ['乳頭保留式可能乳頭壞死或感覺減少', '保留的皮瓣太薄可能壞死', '微創方式手術時間較長、需特殊設備'],
  fit: ['SSM / NSM:計畫立即重建', 'Wise pattern / Goldilocks:乳房大或下垂', '腫瘤靠近乳頭或皮膚時不適合保留乳頭'],
  meta: { src: '—', muscle: '否', vessel: '—', mode: '—', scar: '依方式不同', risk: '皮瓣或乳頭壞死' }
};

const IMPLANT_PLANES = {
  id: 'implplanes', cat: 'implant', tag: '假體重建', name: '假體放置層次與 ADM', short: '假體放置方式',
  one: '假體可以放在胸大肌下、雙平面或胸大肌前,常搭配 ADM 或合成網片支撐;可一次放假體或先放擴張器。',
  steps: [
    { title: '乳頭保留式全切後', cam: 'oblique', text: '乳腺切除後留下皮膚與乳頭,下方是胸大肌。', state: { R: { P: 0.012, gland: false, fat: false } } },
    { title: '胸大肌下', cam: 'oblique', peel: 3, text: '假體完全放在胸大肌後方(肌肉半透明)。覆蓋最厚,但用力時乳房可能隨肌肉移動(動作變形),疼痛也較多。', state: { R: { P: 0.012, gland: false, fat: false }, ghostMus: 0.35, hi: ['pecmaj'], imp: { kind: 'implant', plane: 'sub', fill: 1, vis: 1 } } },
    { title: '雙平面加 ADM 吊帶', cam: 'oblique', peel: 3, text: '上半部在胸大肌下,下半部用 ADM(去細胞真皮基質,黃色網狀)當吊帶支撐,下緣較自然。', state: { R: { P: 0.012, gland: false, fat: false }, ghostMus: 0.35, imp: { kind: 'implant', plane: 'dual', fill: 1, vis: 1, adm: 1, admType: 'lower' } } },
    { title: '胸大肌前加 ADM 或網片包覆', cam: 'oblique', peel: 3, text: '假體放在胸大肌前方,用 ADM 或合成網片包起來。沒有動作變形、疼痛較少;統合分析顯示包膜攣縮較少,但需要皮瓣血流良好。', state: { R: { P: 0.012, gland: false, fat: false }, imp: { kind: 'implant', plane: 'pre', fill: 1, vis: 1, adm: 1, admType: 'wrap' } } },
    { title: '一階段直接放假體', cam: 'oblique', text: '皮膚血流好、乳房中小、不需放療時,可在全切當下直接放永久假體(direct-to-implant),少一次手術。否則先放擴張器,分兩階段。', state: { R: { P: 0.058, shape: 'round', gland: false, fat: false }, imp: { kind: 'implant', plane: 'pre', fill: 1, vis: 1, adm: 1, admType: 'wrap' } } }
  ],
  pros: ['胸大肌前:沒有動作變形、疼痛較少', '胸大肌下:覆蓋厚,較不易看到假體邊緣', '一階段:少一次手術'],
  cons: ['胸大肌前需要皮瓣夠厚、血流好', '胸大肌下有動作變形', 'ADM 或網片增加費用,可能有血清腫或感染'],
  fit: ['皮瓣厚度與血流決定放置層次', '預期放療時多先放擴張器'],
  meta: { src: '假體(± ADM/網片)', muscle: '否', vessel: '—', mode: '一階段或兩階段', scar: '胸部', risk: '包膜攣縮、動作變形' }
};

const FAT_GRAFT = {
  id: 'fatgraft', cat: 'partial', tag: '部分重建', name: '自體脂肪移植', short: '脂肪移植',
  one: '從腹部或大腿抽脂,純化後用細管多點注射到乳房,補凹陷或修飾重建後的外形。',
  steps: [
    { title: '術後凹陷', cam: 'oblique', text: '保留乳房手術後,外上方有凹陷。', state: { tq: 'uoq', R: { defect: 0.018, dq: 'uoq' }, scars: ['bcs_uoq'] } },
    { title: '抽取脂肪', cam: 'abdomen', text: '從下腹部或大腿用細管抽脂,只有幾個幾毫米的小傷口。', state: { tq: 'uoq', R: { defect: 0.018, dq: 'uoq' }, scars: ['bcs_uoq', 'ports'] } },
    { title: '純化與注射', cam: 'oblique', text: '脂肪經離心或過濾純化,再用細管一點一點、分層注射,讓每一小滴脂肪都能長出血管。', state: { tq: 'uoq', R: { defect: 0.012, dq: 'uoq' }, ghostSkin: 0.4, fatg: 1, scars: ['bcs_uoq'] }, dur: 3000 },
    { title: '術後外觀', cam: 'oblique', text: '凹陷改善。部分脂肪會被吸收,常需要 2 到 3 次。少數會形成油囊或鈣化,需和醫師討論追蹤方式。', state: { tq: 'uoq', R: { defect: 0.005, dq: 'uoq' }, scars: ['bcs_uoq'] } }
  ],
  pros: ['自體組織,觸感自然', '傷口小', '同時可改善供區身形'], cons: ['部分脂肪會被吸收,常需多次', '可能形成油囊或鈣化,影響影像判讀', '大量全乳脂肪重建需多次、較少用'], fit: ['補小範圍凹陷', '修飾假體或皮瓣重建的邊緣'],
  meta: { src: '腹部或大腿脂肪', muscle: '否', vessel: '—', mode: '注射', scar: '抽脂小孔', risk: '吸收、油囊' }
};

const NIPPLE = {
  id: 'nipple', cat: 'finish', tag: '後續與對稱', name: '乳頭乳暈重建', short: '乳頭重建',
  one: '乳房重建穩定後(通常 3 到 6 個月),再用局部皮瓣或移植做乳頭,並以刺青做乳暈。',
  steps: [
    { title: '重建後尚無乳頭', cam: 'oblique', text: '乳房外形已重建,但沒有乳頭乳暈。', state: { R: { P: 0.06, areola: false, gland: false } } },
    { title: 'C-V 皮瓣設計', cam: 'glandZoom', text: '在預定乳頭位置畫出 C 形與兩個 V 形皮瓣(虛線),立起來縫合成乳頭。方法簡單,最常用。', state: { R: { P: 0.06, areola: false, gland: false }, custom: [line([[-0.006, 0.0], [-0.004, 0.005], [0, 0.007], [0.004, 0.005], [0.006, 0]], 'R', true), line([[-0.006, 0], [-0.022, -0.003], [-0.006, -0.006]], 'R', true), line([[0.006, 0], [0.022, -0.003], [0.006, -0.006]], 'R', true)] } },
    { title: 'Skate 皮瓣設計', cam: 'glandZoom', text: 'Skate 皮瓣兩側翅膀較大,可做出較高的乳頭,但需要植皮蓋供區。', state: { R: { P: 0.06, areola: false, gland: false }, custom: [nipRing(0.016, 'R', true), line([[-0.016, 0], [-0.03, 0.006], [-0.03, -0.006], [-0.016, 0]], 'R', true), line([[0.016, 0], [0.03, 0.006], [0.03, -0.006], [0.016, 0]], 'R', true)] } },
    { title: '對側乳頭複合移植', cam: 'front', text: '若對側乳頭夠大,可取一部分移植過來,顏色與質地最接近,突度也較能維持。', state: { R: { P: 0.06, areola: false, gland: false }, custom: [line([[-0.004, 0.004], [0.004, 0.004], [0.004, -0.004], [-0.004, -0.004], [-0.004, 0.004]], 'L', true)] } },
    { title: '乳頭成形', cam: 'oblique', text: '乳頭成形後,局部皮瓣的突度日後可能流失一部分。', state: { R: { P: 0.06, areola: true, tat: 0, gland: false } } },
    { title: '乳暈刺青', cam: 'oblique', text: '約 6 到 8 週後以醫療刺青畫出乳暈顏色,同時遮住乳頭成形的疤痕。也可以只做 3D 刺青不做乳頭。', state: { R: { P: 0.06, areola: true, tat: 1, gland: false } } }
  ],
  pros: ['完成乳房外觀', '門診或小手術即可'], cons: ['乳頭突度可能逐漸變低', '刺青顏色會淡,可能需補色'], fit: ['乳房重建穩定、放療結束後'],
  meta: { src: '局部皮瓣、對側乳頭、刺青', muscle: '否', vessel: '—', mode: '局部', scar: '乳暈內', risk: '突度流失' }
};

const SYMM = {
  id: 'symm', cat: 'finish', tag: '後續與對稱', name: '對側對稱手術', short: '對側對稱',
  one: '單側重建後,常在對側做縮乳、提乳或隆乳,讓兩邊大小與位置相近。',
  steps: [
    { title: '重建後兩側不對稱', cam: 'front', text: '畫面左邊(右乳)重建後較挺、較高;畫面右邊(左乳)較大且下垂。', state: { R: { P: 0.056, lift: 0.008, ptosis: 0.5, areola: true }, L: { P: 0.074, ptosis: 1.8 } } },
    { title: '對側縮乳:設計', cam: 'front', text: '在對側用倒 T 形設計切除多餘組織與皮膚。', state: { R: { P: 0.056, lift: 0.008, ptosis: 0.5 }, L: { P: 0.074, ptosis: 1.8 }, custom: wiseDesign('L') } },
    { title: '對側縮乳:術後', cam: 'front', text: '兩側大小與高度接近,對側留下倒 T 疤痕。', state: { R: { P: 0.056, lift: 0.008, ptosis: 0.5 }, L: { P: 0.058, lift: 0.008, ptosis: 0.55 }, custom: invT('L') } },
    { title: '對側提乳', cam: 'front', text: '若只是下垂、大小相近,可只做提乳,疤痕在乳暈周圍與垂直向下。', state: { R: { P: 0.056, lift: 0.008, ptosis: 0.5 }, L: { P: 0.064, lift: 0.009, ptosis: 0.5 }, custom: [nipRing(0.019, 'L'), line([[0, -0.019], [0, -0.05]], 'L')] } },
    { title: '對側隆乳', cam: 'front', text: '若對側較小,可放假體增加體積,疤痕在乳房下皺褶。', state: { R: { P: 0.06, lift: 0.004, ptosis: 0.6 }, L: { P: 0.06, upper: 0.5, ptosis: 0.7 }, custom: [line([[-0.025, -0.05], [0, -0.052], [0.025, -0.05]], 'L')] } }
  ],
  pros: ['兩側對稱,穿衣較容易', '可與重建同時或之後做'], cons: ['健側也會有疤痕與手術風險', '健側乳房的影像追蹤可能受影響'], fit: ['單側重建後兩側差異明顯'],
  meta: { src: '對側乳房', muscle: '否', vessel: '—', mode: '縮乳、提乳或隆乳', scar: '對側乳房', risk: '健側也有手術風險' }
};


const AX_SMALL = (dashed) => ({ pts: [[-0.146, 1.305, 0.05], [-0.152, 1.3, 0.036], [-0.157, 1.296, 0.022]], axis: [0, 0], n: [-0.8, 0, 0.5], dashed });
const AX_LONG = { pts: [[-0.138, 1.312, 0.062], [-0.148, 1.302, 0.044], [-0.156, 1.296, 0.026], [-0.162, 1.29, 0.006], [-0.165, 1.284, -0.012]], axis: [0, 0], n: [-0.9, 0, 0.3] };
const injRing = { side: 'R', dashed: true, closed: true, pts: Array.from({ length: 13 }, (_, i) => { const t = (i / 12) * Math.PI * 2; return [r4(0.022 * Math.sin(t)), r4(0.022 * Math.cos(t))]; }) };
const AXILLA = {
  id: 'axilla', cat: 'surgery', tag: '手術方式', name: '前哨淋巴結切片與腋下淋巴結廓清', short: '前哨與廓清',
  one: '乳癌最常先轉移到腋下淋巴結。前哨淋巴結切片只取最先接收淋巴的 1 到 3 顆;廓清則切除 Level I、II 的淋巴結。',
  steps: [
    { title: '腋下淋巴結分區', cam: 'axilla', peel: 3, text: '以胸小肌(高亮)為界:外側為 Level I(綠),後方為 Level II(橙),內上方鎖骨下為 Level III(紅);胸骨旁為內乳淋巴結(紫)。', state: { vesselsOnly: ['Axillary vein.r', 'Axillary artery.r'], ghostMus: 0.3, nodes: 1, hi: ['pecmin'] } },
    { title: '注射追蹤劑', cam: 'oblique', text: '在乳暈周圍注射放射性同位素、藍染劑或螢光劑(ICG)。追蹤劑沿淋巴管流到第一站,也就是前哨淋巴結(藍色)。', state: { vesselsOnly: ['Axillary vein.r', 'Axillary artery.r'], ghostSkin: 0.5, nodes: 1, dye: 1, custom: [injRing] }, dur: 3200 },
    { title: '找到前哨淋巴結', cam: 'axilla', text: '在腋下皮膚皺褶處切一個 2 到 3 公分的小切口(虛線),用 γ 探頭偵測放射性,並找出被染色或發螢光的淋巴結。', state: { vesselsOnly: ['Axillary vein.r', 'Axillary artery.r'], ghostSkin: 0.4, nodes: 1, dye: 1, probe: 1, hiNode: 'sentinel', wscars: [AX_SMALL(true)] } },
    { title: '取出前哨淋巴結', cam: 'axilla', peel: 3, text: '通常取出 1 到 3 顆淋巴結送病理檢查。沒有轉移時,一般就不需要再清除腋下淋巴結。', state: { vesselsOnly: ['Axillary vein.r', 'Axillary artery.r'], ghostMus: 0.3, nodes: 1, dye: 1, slnGone: 1, wscars: [AX_SMALL(false)] } },
    { title: '前哨切片術後', cam: 'axilla', text: '只留下腋下小疤痕。手臂淋巴水腫的風險遠低於廓清,但仍可能有腋下或上臂內側麻木。部分低風險病人可依最新研究與醫師討論是否省略切片。', state: { nodes: 0, slnGone: 1, wscars: [AX_SMALL(false)] } },
    { title: '腋下淋巴結廓清範圍', cam: 'axilla', peel: 3, text: '淋巴結已確認轉移、或特定情況下,會清除 Level I 與 II 的淋巴結與周圍脂肪(高亮);Level III 只有在受侵犯時才清除。', state: { vesselsOnly: ['Axillary vein.r', 'Axillary artery.r'], ghostMus: 0.3, nodes: 1, hiNode: 'I_II', hi: ['pecmin'] } },
    { title: '保護重要神經血管', cam: 'axilla', peel: 3, text: '清除時保留腋靜脈(藍)、長胸神經(黃,支配前鋸肌,受傷會造成翼狀肩胛)、胸背神經血管(支配背闊肌)與胸肌神經。上臂內側的感覺神經常被犧牲,術後會麻木。', state: { ghostMus: 0.3, nodes: 1, gI: 1, gII: 1, vessels: ['Axillary vein.r', 'Long thoracic nerve.r', 'Thoracodorsal nerve.r', 'Thoracodorsal artery.r', 'Medial pectoral nerve.r', 'Lateral pectoral nerve.r'], vesselsOnly: ['Axillary vein.r', 'Axillary artery.r', 'Long thoracic nerve.r', 'Thoracodorsal nerve.r', 'Thoracodorsal artery.r'] }, dur: 2200 },
    { title: '廓清術後與引流管', cam: 'axilla', text: '切口較長,通常放置引流管數天。風險包括手臂淋巴水腫、血清腫、肩膀活動受限與麻木;術後需做手臂復健運動。', state: { nodes: 0, gI: 1, gII: 1, drain: 1, wscars: [AX_LONG] } },
    { title: '新輔助治療後:標記淋巴結', cam: 'axilla', peel: 3, text: '化療前在已證實轉移的淋巴結放置標記夾(銀色)。化療後手術時,同時取出標記的淋巴結與前哨淋巴結(標靶式腋下手術),以判斷是否還需廓清。', state: { vesselsOnly: ['Axillary vein.r', 'Axillary artery.r'], ghostMus: 0.3, nodes: 1, clip: 1, hiNode: 'clip' } }
  ],
  pros: ['前哨切片:傷口小、淋巴水腫風險低', '廓清:控制腋下病灶、提供完整分期資訊'],
  cons: ['廓清:手臂淋巴水腫、血清腫、肩膀活動受限、上臂內側麻木', '前哨切片:少數會偽陰性,或需二次手術'],
  fit: ['前哨切片:臨床上腋下淋巴結看起來正常', '廓清:淋巴結已確認轉移且符合廓清條件', '新輔助治療後:依治療前後狀況選擇方式'],
  meta: { src: '腋下淋巴結', muscle: '否', vessel: '保留腋靜脈與神經', mode: '前哨切片或廓清', scar: '腋下', risk: '淋巴水腫、麻木' }
};

export const EXTRA_SCENARIOS = [AXILLA, MAST_TYPES, IMPLANT_PLANES, FAT_GRAFT, NIPPLE, SYMM, ...TECHS.map(techScenario)];

// 模擬器 Level III:依位置推薦的部分重建術式
export const ZONE_L3 = {
  central: ['fatgraft'], up: ['tdap', 'ld'], up_lat: ['ld', 'tdap', 'licap'], lat: ['licap', 'ltap', 'tdap', 'ld'], low_lat: ['ltap', 'licap', 'aicap'],
  low: ['aicap', 'tep'], low_med: ['micap', 'aicap', 'omentum'], med: ['micap', 'omentum'], up_med: ['omentum', 'micap']
};
