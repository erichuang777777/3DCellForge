// 衛教內容:情境、步驟、結構說明、對照表。所有文字待醫師審核。

export const LAYER_NAMES = ['皮膚', '皮下脂肪', '乳腺', '肌肉', '骨骼與深層'];

// DIEP 術前 CTA 穿通枝地圖(示意數值,非真實病人)。dx:距中線往外(公分);dy:相對肚臍(公分,負值在下);dia:管徑(毫米);im:肌肉內走行長度(公分)
export const PERF_MAP = [
  { id: 'P1', side: 'R', row: '內側列', dx: 1.5, dy: -1.5, dia: 1.8, im: 1.5, dom: true },
  { id: 'P2', side: 'R', row: '外側列', dx: 4.0, dy: -3.0, dia: 1.4, im: 3.0 },
  { id: 'P3', side: 'R', row: '內側列', dx: 2.0, dy: -5.5, dia: 1.1, im: 2.0 },
  { id: 'P4', side: 'L', row: '內側列', dx: 1.5, dy: -2.5, dia: 1.6, im: 1.5 },
  { id: 'P5', side: 'L', row: '外側列', dx: 4.5, dy: -4.5, dia: 1.0, im: 3.5 }
];

const MAST = { R: { P: 0, shape: 'flat', areola: false, defect: 0, gland: false, fat: false }, scars: ['mast_line'] };


// 隆乳刀口(facing 座標,相對乳頭,公尺)
const arc = (r, a0, a1, n = 16, cx = 0, cy = 0) => Array.from({ length: n + 1 }, (_, i) => { const t = a0 + ((a1 - a0) * i) / n; return [+(cx + r * Math.sin(t)).toFixed(4), +(cy + r * Math.cos(t)).toFixed(4)]; });
const imfCut = (side, dashed) => ({ side, dashed, closed: false, ref: 'imf', pts: Array.from({ length: 11 }, (_, i) => { const x = -0.025 + 0.005 * i; return [+x.toFixed(4), +(1.2 * x * x).toFixed(4)]; }) });
const areolaCut = (side, dashed) => ({ side, dashed, closed: false, pts: arc(0.0185, Math.PI * 0.6, Math.PI * 1.4) });
const AUG_SMALL = { R: { P: 0.045 }, L: { P: 0.045 } };
const AUG_BIG = { R: { P: 0.07, upper: 0.55, ptosis: 0.5 }, L: { P: 0.07, upper: 0.55, ptosis: 0.5 } };

export const SCENARIOS = [
  {
    id: 'bcs', tag: '手術方式', name: '保留乳房 vs 全切', short: '保留 vs 全切',
    one: '兩種乳癌手術的差別在切除範圍:保留乳房手術只切腫瘤與安全邊界,全切移除整個乳房。',
    steps: [
      { title: '正常的乳房構造', cam: 'oblique', text: '乳房由皮膚、皮下脂肪與乳腺組成,下方是胸大肌與肋骨。可以拖曳下方滑桿,一層一層剝開看。', state: {} },
      { title: '腫瘤在乳腺裡的位置', cam: 'oblique', peel: 2, text: '這裡以右乳外上方的腫瘤為例。腫瘤位在乳腺組織中,周圍要留一圈正常組織作為安全邊界。', state: { tumor: 1, margin: 1 } },
      { title: '保留乳房手術:切除腫瘤與邊界', cam: 'oblique', peel: 2, text: '只切除腫瘤與周圍的安全邊界,其餘乳腺保留。術後通常需要接受放射治療。', state: { cut: 1, R: { defect: 0.012 } } },
      { title: '保留乳房手術後的外觀', cam: 'oblique', text: '乳房外形大致保留,切口較短。切除比例大時可能凹陷或變形,這時可搭配局部重建。', state: { cut: 1, R: { defect: 0.012 }, scars: ['bcs_uoq'] } },
      { title: '乳房全切後的外觀', cam: 'oblique', text: '全切會移除整個乳房組織與乳頭乳暈,胸前留下橫向疤痕。之後可以選擇重建,也可以不重建。', state: { ...MAST } },
      { title: '全切後剩下的結構', cam: 'oblique', peel: 3, text: '全切後,胸大肌與肋骨仍在。假體重建時,假體常放在胸大肌下方或前方。', state: { ...MAST } }
    ],
    pros: ['保留乳房:外形與感覺保留較多,恢復較快', '全切:通常不需要因手術本身而接受放療(仍依病理決定)', '在適合保留乳房的病人,兩者存活率相近'],
    cons: ['保留乳房:通常需要放射治療,需定期追蹤同側乳房', '保留乳房:切除比例大時可能變形', '全切:失去乳房外形,需要時再考慮重建'],
    fit: ['腫瘤相對乳房較小、單一病灶,可考慮保留乳房', '病灶分散、腫瘤佔比大、曾在同側放療,較傾向全切', '病人本身的選擇也很重要']
  },
  {
    id: 'ld', tag: '保留乳房 + 局部重建', name: '外上方切口 + 背闊肌重建', short: '外上方 + 背闊肌',
    one: '外上象限的腫瘤切除後,取一部分背闊肌轉到乳房填補缺損,保住乳房外形。',
    steps: [
      { title: '腫瘤在右乳外上方', cam: 'oblique', peel: 2, text: '外上象限是乳癌最常見的位置。腫瘤較大時,單純切除容易造成外側凹陷。', state: { tumor: 1, margin: 1 } },
      { title: '切除腫瘤與安全邊界', cam: 'oblique', peel: 2, text: '切除後留下一個缺損(紅色腔室)。以下用背闊肌來填補。', state: { cut: 1, R: { defect: 0.018 } } },
      { title: '找到背闊肌與胸背血管', cam: 'side', peel: 2, text: '背闊肌位在側背部,由胸背動靜脈供應血流(紅色與藍色血管)。手術只取需要的一部分肌肉,血管保留相連。', state: { cut: 1, R: { defect: 0.018 }, hi: ['lat_r'], vessels: ['Thoracodorsal artery.r', 'Thoracodorsal vein.r'] } },
      { title: '把肌肉轉到乳房缺損處', cam: 'oblique', peel: 2, text: '帶著血管的肌肉從腋下附近轉到前方,填進切除後的空間。', state: { cut: 1, R: { defect: 0.018 }, vessels: ['Thoracodorsal artery.r'], flap: { kind: 'ld', t: 1, vis: 1 } }, dur: 2400 },
      { title: '術後外觀', cam: 'oblique', text: '乳房外形得到補充。切口在乳房外上方與腋下,依術式可能另有背部切口。術後通常仍需放射治療。', state: { cut: 1, R: { defect: 0.002 }, flap: { kind: 'ld', t: 1, vis: 1 }, scars: ['bcs_uoq', 'axilla'] } }
    ],
    pros: ['保住乳房與乳頭,外形較自然', '用自己的組織,不需假體', '一次手術完成切除與填補'],
    cons: ['背部可能有血清腫(積液)', '肩膀力量可能輕微減弱', '仍需放射治療;肌肉體積日後可能萎縮'],
    fit: ['外上或外下象限腫瘤', '切除體積約佔乳房 20% 到 40%', '想保留乳房但擔心凹陷']
  },
  {
    id: 'omentum', tag: '保留乳房 + 局部重建', name: '內下方 + 大網膜皮瓣', short: '內下方 + 大網膜',
    one: '內下象限的缺損用腹腔鏡取出的大網膜填補,經皮下隧道送到乳房,腹部只有小傷口。',
    steps: [
      { title: '腫瘤在右乳內下方', cam: 'front', peel: 2, text: '內下象限的組織較少,切除後容易明顯凹陷,而且位在乳溝附近,外觀較明顯。', state: { tumor: 1, margin: 1, tq: 'liq' } },
      { title: '切除腫瘤與安全邊界', cam: 'front', peel: 2, text: '切口可沿著乳房下緣內側,切除後留下缺損。', state: { tq: 'liq', cut: 1, R: { defect: 0.018, dq: 'liq' } } },
      { title: '腹腔鏡找到大網膜', cam: 'abdomen', peel: 2, text: '大網膜是掛在胃下方的脂肪組織(黃色),由胃網膜血管供應。醫師用腹腔鏡經幾個小孔把它游離出來,保留血管相連。', state: { tq: 'liq', cut: 1, R: { defect: 0.018, dq: 'liq' }, ghostMus: 0.18, hi: ['omentum'], vessels: ['Right gastro-omental vein'], scars: ['ports'] } },
      { title: '經皮下隧道送到乳房', cam: 'front', peel: 2, text: '大網膜從上腹部經皮下隧道(往劍突方向)拉到乳房下方,填進缺損。', state: { tq: 'liq', cut: 1, R: { defect: 0.018, dq: 'liq' }, ghostMus: 0.18, flap: { kind: 'omentum', t: 1, vis: 1 }, vessels: ['Right gastro-omental vein'] }, dur: 2600 },
      { title: '術後外觀', cam: 'front', text: '乳房內下方的凹陷得到填補。疤痕在乳房下緣內側,腹部有幾個腹腔鏡小傷口。', state: { tq: 'liq', cut: 1, R: { defect: 0.002, dq: 'liq' }, flap: { kind: 'omentum', t: 1, vis: 1 }, scars: ['imf_medial', 'ports'] } }
    ],
    pros: ['腹部只有腹腔鏡小傷口,供區疤痕少', '組織柔軟,適合填補內側缺損', '不需假體'],
    cons: ['需要進入腹腔,有腹部手術的風險', '大網膜體積因人而異,需先評估是否足夠', '證據多來自單一團隊的小規模病例系列'],
    fit: ['內下或內側象限腫瘤', '身形偏瘦、乳房體積較小', '希望只用自體組織']
  },
  {
    id: 'tram', tag: '全切 + 自體重建', name: '全切 + 腹直肌皮瓣(TRAM)', short: '全切 + TRAM',
    one: '全切後取下腹部的皮膚與脂肪,連同一條腹直肌,經皮下隧道翻到胸前重建乳房。',
    steps: [
      { title: '乳房全切', cam: 'oblique', text: '右乳全切後,胸前是平的。', state: { ...MAST } },
      { title: '規劃下腹部皮瓣', cam: 'abdomen', text: '在肚臍與恥骨之間畫出橢圓形皮瓣,內含皮膚與脂肪。', state: { ...MAST, scars: ['mast_line', 'abd_design'] } },
      { title: '腹直肌與上腹壁血管', cam: 'abdomen', peel: 2, text: '帶蒂 TRAM 使用一條腹直肌當作「血管的橋」,血流來自上腹壁動脈(內乳動脈的延續)。圖中以左側腹直肌為例,臨床上可用同側或對側。', state: { ...MAST, hi: ['rectus_l'], vessels: ['Superior epigastric artery.l', 'Internal thoracic artery.l'] } },
      { title: '皮瓣連同肌肉翻到胸前', cam: 'front', text: '皮瓣帶著腹直肌,經上腹部的皮下隧道翻到右胸。下腹部暫時留下傷口。', state: { ...MAST, ghostSkin: 0.35, wound: 1, hi: ['rectus_l'], flap: { kind: 'tram', t: 1, vis: 1 } }, dur: 2800 },
      { title: '塑形成新乳房', cam: 'oblique', text: '皮瓣塑形成乳房,胸前可見一塊來自腹部的皮島。乳頭可日後再重建。', state: { R: { P: 0.06, shape: 'natural', areola: false, defect: 0, gland: false, fat: true }, paddle: 1, wound: 1 } },
      { title: '腹部縫合', cam: 'abdomen', text: '下腹部拉緊縫合,留下髖到髖的橫向疤痕,肚臍重新定位。腹壁因少了一段肌肉,有時會加網片加強。', state: { R: { P: 0.06, shape: 'natural', areola: false, defect: 0, gland: false, fat: true }, paddle: 1, scars: ['abd_line', 'umb'] } }
    ],
    pros: ['外形與觸感接近自然,會隨體重變化', '不需要假體,長期不用更換', '同時有腹部拉皮的效果'],
    cons: ['犧牲一段腹直肌,腹壁較弱,可能膨出或疝氣', '帶蒂皮瓣的血流併發症比游離皮瓣多', '手術與恢復期較長'],
    fit: ['腹部有足夠組織', '需要較大體積,或胸壁曾放療', '沒有顯微手術條件時的自體重建選擇']
  },
  {
    id: 'diep', tag: '全切 + 自體重建', name: '全切 + 腹部穿通枝皮瓣(DIEP)', short: '全切 + DIEP',
    one: '和 TRAM 一樣取下腹部組織,但保留腹直肌,只帶穿過肌肉的小血管,用顯微手術接到胸前。',
    steps: [
      { title: '乳房全切', cam: 'oblique', text: '右乳全切後,胸前是平的。', state: { ...MAST } },
      { title: '規劃下腹部皮瓣', cam: 'abdomen', text: '皮瓣範圍與 TRAM 相同,位在肚臍與恥骨之間。', state: { ...MAST, scars: ['mast_line', 'abd_design'] } },
      { title: '術前 CTA:穿通枝地圖', cam: 'perf', text: '術前電腦斷層血管攝影(CTA)會找出下腹壁動脈穿過腹直肌的小分支,也就是穿通枝。報告以肚臍為原點,記下每條穿通枝在哪裡(往外、往下幾公分)、有多粗、在肌肉裡走多長。圖上每格 2 公分,圓環是穿通枝穿出筋膜的位置,黃色是預計使用的主要穿通枝。點下方表格可以個別查看。(圖中數值為示意)', state: { ...MAST, scars: ['mast_line', 'abd_design'], perfMap: 1 } },
      { title: '穿通枝穿過腹直肌的路徑', cam: 'perfObl', peel: 2, text: '剝開皮膚與脂肪、肌肉調成半透明後,可以看到每條穿通枝從腹直肌後方的下腹壁動脈分出,斜穿過肌肉,再穿過脂肪到皮膚。在肌肉裡走得越短、越直,分離時對肌肉的影響越小;內側列與外側列穿通枝的選擇也會影響皮瓣血流範圍。拖曳右下角滑桿可以慢慢剝開每一層。', state: { ...MAST, perfMap: 1, perfCourse: 1, ghostMus: 0.14, vessels: ['Inferior epigastric artery.r', 'Inferior epigastric artery.l'] } },
      { title: '找到下腹壁血管', cam: 'abdomen', peel: 2, text: '下腹壁動靜脈走在腹直肌後方,分出細小的穿通枝穿過肌肉供應皮瓣。醫師沿著穿通枝分離,把肌肉留在原位。', state: { ...MAST, vessels: ['Inferior epigastric artery.r', 'Inferior epigastric vein.r'], ghostMus: 0.45 } },
      { title: '皮瓣完全取下,移到胸前', cam: 'front', text: '皮瓣連同血管完全取下(游離皮瓣),移到右胸。', state: { ...MAST, ghostSkin: 0.35, wound: 1, flap: { kind: 'diep', t: 1, vis: 1 } }, dur: 2600 },
      { title: '顯微吻合到內乳血管', cam: 'oblique', peel: 4, text: '在胸骨旁找到內乳動靜脈(常需移除一小段肋軟骨),在顯微鏡下把皮瓣血管接上。黃色光點是吻合位置。', state: { ...MAST, wound: 1, flap: { kind: 'diep', t: 1, vis: 0.4 }, vessels: ['Internal thoracic artery.r', 'Internal thoracic veins.r'], anast: 1 } },
      { title: '塑形與腹部縫合', cam: 'oblique', text: '皮瓣塑形成乳房,腹部縫合留下橫向疤痕。因為保留了腹直肌,腹壁較不容易變弱。', state: { R: { P: 0.06, shape: 'natural', areola: false, defect: 0, gland: false, fat: true }, paddle: 1, scars: ['abd_line', 'umb'] } }
    ],
    pros: ['保留腹直肌,腹壁膨出與疝氣風險比 TRAM 低', '外形與觸感最接近自然', '不需要假體'],
    cons: ['需要顯微手術團隊,手術時間最長', '皮瓣血管栓塞時需緊急再手術', '腹部有長疤痕'],
    fit: ['腹部有足夠組織', '希望不用假體並保留腹壁功能', '醫院有顯微重建團隊']
  },
  {
    id: 'implant', tag: '全切 + 假體重建', name: '全切 + 假體重建', short: '全切 + 假體',
    one: '全切後在胸大肌下放組織擴張器,門診逐次注水撐出空間,再換成永久假體。',
    steps: [
      { title: '乳房全切', cam: 'oblique', text: '右乳全切後,胸前是平的,皮膚變薄。', state: { ...MAST } },
      { title: '胸大肌下放入組織擴張器', cam: 'oblique', peel: 3, text: '擴張器是可以注水的空囊,放在胸大肌下方(圖中胸大肌半透明)。也有醫師放在胸大肌前方。', state: { ...MAST, ghostMus: 0.3, hi: ['pecmaj_r'], imp: { kind: 'expander', fill: 0.25, vis: 1 }, R: { P: 0.012, shape: 'round', areola: false, defect: 0, gland: false, fat: false } } },
      { title: '門診逐次注水擴張', cam: 'oblique', peel: 3, text: '每隔一到兩週在門診經注水孔注入食鹽水,讓皮膚與肌肉慢慢撐開,約需數週到數月。', state: { ...MAST, ghostMus: 0.3, imp: { kind: 'expander', fill: 1, vis: 1 }, R: { P: 0.05, shape: 'round', areola: false, defect: 0, gland: false, fat: false } }, dur: 2600 },
      { title: '換成永久假體', cam: 'oblique', peel: 3, text: '第二次手術取出擴張器,換成矽膠或食鹽水假體。', state: { ...MAST, ghostMus: 0.3, imp: { kind: 'implant', fill: 1, vis: 1 }, R: { P: 0.056, shape: 'round', areola: false, defect: 0, gland: false, fat: false } } },
      { title: '術後外觀', cam: 'oblique', text: '乳房外形較圓、上半部較飽滿,觸感比自體組織硬。疤痕只在胸部。', state: { R: { P: 0.056, shape: 'round', areola: false, defect: 0, gland: false, fat: false }, imp: { kind: 'implant', fill: 1, vis: 1 }, scars: ['mast_line'] } }
    ],
    pros: ['手術時間短,身上沒有額外供區傷口', '恢復較快', '可視需要分階段調整大小'],
    cons: ['感染、包膜攣縮、移位或破裂', '假體不是終身,日後可能需更換', '放射治療會增加併發症'],
    fit: ['身形偏瘦、不想要額外供區疤痕', '預期不需放療,或可分階段處理', '不適合或不想做大型自體手術']
  },
  {
    id: 'aug', tag: '美容手術', name: '單純隆乳(假體)', short: '隆乳',
    one: '在乳房組織後方放入假體增加體積。切口、放置層次與假體形狀都會影響外觀與恢復。',
    steps: [
      { title: '隆乳前', cam: 'front', text: '乳房體積較小。隆乳是把假體放在乳腺後方或胸大肌後方,讓乳房變大。', state: { ...AUG_SMALL } },
      { title: '三種常見切口', cam: 'front', text: '虛線是常見切口:乳房下皺褶(最常用,視野最好)、乳暈下緣(疤痕藏在乳暈邊)、腋下(胸前沒有疤痕)。', state: { ...AUG_SMALL, scars: ['axR_d', 'axL_d'], custom: [imfCut('R', true), imfCut('L', true), areolaCut('R', true), areolaCut('L', true)] } },
      { title: '放置層次:乳腺下', cam: 'oblique', peel: 3, text: '假體放在乳腺後方、胸大肌前方。恢復較快,但皮下組織薄的人容易看到假體邊緣。', state: { ...AUG_SMALL, aug: { plane: 'subglandular', fill: 1, vis: 1, shapeR: 'round', shapeL: 'round' } } },
      { title: '放置層次:雙平面或胸大肌下', cam: 'oblique', peel: 3, text: '假體上半部由胸大肌覆蓋(圖中肌肉半透明),邊緣較自然、包膜攣縮較少;缺點是用力時乳房可能隨肌肉移動。', state: { ...AUG_SMALL, ghostMus: 0.4, hi: ['pecmaj'], aug: { plane: 'dual', fill: 1, vis: 1, shapeR: 'round', shapeL: 'round' } } },
      { title: '假體形狀:圓形與水滴形', cam: 'front', peel: 3, text: '畫面左邊是圓形假體(上半部較飽滿),畫面右邊是水滴形假體(下半部較飽滿,較接近自然下垂)。', state: { ...AUG_SMALL, ghostMus: 0.4, aug: { plane: 'dual', fill: 1, vis: 1, shapeR: 'round', shapeL: 'tear' } } },
      { title: '術後外觀', cam: 'oblique', text: '乳房體積增加,上半部較飽滿。圖中是乳房下皺褶切口,疤痕藏在下緣。', state: { ...AUG_BIG, aug: { plane: 'dual', fill: 1, vis: 1, shapeR: 'round', shapeL: 'round' }, custom: [imfCut('R', false), imfCut('L', false)] } }
    ],
    pros: ['一次手術,恢復約數週', '可選擇大小、形狀與切口位置', '也可改用自體脂肪移植,適合想小幅增加的人'],
    cons: ['包膜攣縮、破裂、移位,假體並非終身,日後可能需要更換或取出', '乳房攝影需要特殊照法', '罕見的假體相關淋巴瘤(BIA-ALCL),與粗糙面假體較相關'],
    fit: ['想增加乳房體積或改善不對稱', '乳房組織足夠覆蓋假體', '能接受定期追蹤']
  },
  {
    id: 'gland', tag: '解剖構造', name: '乳腺構造與乳房緻密度', short: '乳腺構造',
    one: '乳房內部由乳腺葉、乳管、小葉、脂肪與 Cooper 韌帶組成,淋巴主要流向腋下。',
    steps: [
      { title: '乳房外觀與分區', cam: 'oblique', text: '乳房常用四個象限描述位置,外上象限還延伸到腋下(腋尾)。外上象限乳腺組織最多,也是乳癌最常見的位置。', state: {} },
      { title: 'Cooper 韌帶', cam: 'oblique', text: '從乳腺連到皮膚的纖維束(白色細線)撐起乳房。腫瘤牽拉這些韌帶時,皮膚可能出現凹陷,是觸診時要注意的徵象。', state: { ghostSkin: 0.32, glandShell: 0, glandDetail: 1, hiGland: 'cooper' } },
      { title: '乳腺葉與乳管', cam: 'oblique', peel: 2, text: '乳腺約有 15 到 20 個葉,像輪輻一樣圍繞乳頭。每一葉都有一條乳管通到乳頭,靠近乳頭處膨大成乳竇。', state: { glandShell: 0, glandDetail: 1, hiGland: 'duct' } },
      { title: '小葉與乳癌的起點', cam: 'glandZoom', peel: 2, text: '乳管末端是製造乳汁的小葉(終末乳管小葉單位)。大部分乳癌由這裡長出:從乳管長出的稱乳管癌,從小葉長出的稱小葉癌。', state: { glandShell: 0, glandDetail: 1, hiGland: 'lobule' } },
      { title: '脂肪型乳房(緻密度 A/B)', cam: 'oblique', peel: 2, text: '乳腺組織少、脂肪多(黃色半透明)。乳房攝影上脂肪是暗的,腫瘤較容易看出來。', state: { glandShell: 0, glandDetail: 1, density: 0, fatOp: 0.4 } },
      { title: '緻密型乳房(緻密度 C/D)', cam: 'oblique', peel: 2, text: '乳腺組織多。乳房攝影上乳腺與腫瘤都是白的,容易被遮住,常需加做超音波或 MRI。亞洲女性緻密型乳房比例較高。', state: { glandShell: 0, glandDetail: 1, density: 3, fatOp: 0.4 } },
      { title: '淋巴引流與前哨淋巴結', cam: 'oblique', peel: 2, text: '乳房的淋巴大多流向腋下。最先接收淋巴的是前哨淋巴結(綠色,胸大肌已半透明),胸骨旁另有內乳淋巴結,手術時先檢查它,沒有轉移時通常可以不用清除整個腋下淋巴結。', state: { glandShell: 0, glandDetail: 1, lymph: 1, hiGland: 'sentinel', ghostMus: 0.35 } }
    ],
    pros: ['了解腫瘤位置與乳管、小葉的關係', '理解為什麼緻密型乳房需要加做超音波或 MRI', '理解前哨淋巴結切片的目的'],
    cons: ['圖中乳腺葉、乳管與淋巴結為示意,數量與位置因人而異'],
    fit: ['剛拿到影像或病理報告,想了解名詞的病人']
  }
];

// 並排比較可選的最終狀態
export const END_STATES = [
  { id: 'normal', label: '正常乳房', from: ['bcs', 0] },
  { id: 'bcs', label: '保留乳房手術', from: ['bcs', 3] },
  { id: 'mast', label: '全切未重建', from: ['bcs', 4] },
  { id: 'ld', label: '外上方 + 背闊肌', from: ['ld', 4] },
  { id: 'omentum', label: '內下方 + 大網膜', from: ['omentum', 4] },
  { id: 'tram', label: '全切 + TRAM', from: ['tram', 5] },
  { id: 'diep', label: '全切 + DIEP', from: ['diep', 7] },
  { id: 'implant', label: '全切 + 假體', from: ['implant', 4] },
  { id: 'aug0', label: '隆乳前', from: ['aug', 0] },
  { id: 'aug', label: '隆乳後', from: ['aug', 5] },
  { id: 'densA', label: '脂肪型乳房', from: ['gland', 4] },
  { id: 'densD', label: '緻密型乳房', from: ['gland', 5] }
];

export const COMPARE_DEFAULT = { bcs: ['bcs', 'mast'], ld: ['bcs', 'ld'], omentum: ['bcs', 'omentum'], tram: ['tram', 'diep'], diep: ['diep', 'implant'], implant: ['implant', 'diep'], aug: ['aug0', 'aug'], gland: ['densA', 'densD'], sim: ['bcs', 'mast'] };

// 點選結構的說明。key 以模型名稱前綴比對
export const INFO = {
  skin: { zh: '皮膚', en: 'Skin', text: '最外層。全切時常保留部分胸前皮膚,讓重建時有足夠的包覆。', clin: '皮膚是否保留(皮膚保留式或乳頭保留式全切)會影響重建方式。' },
  fat: { zh: '皮下脂肪', en: 'Subcutaneous fat', text: '位在皮膚與乳腺之間的脂肪層,讓乳房柔軟。', clin: '全切時切除面在這一層,皮瓣太薄可能缺血。' },
  gland: { zh: '乳腺組織', en: 'Mammary gland', text: '製造乳汁的腺體與乳管,大部分乳癌由這裡長出。', clin: '保留乳房手術只切除腫瘤附近的乳腺,全切則全部移除。' },
  tumor: { zh: '腫瘤(示意)', en: 'Tumor', text: '腫瘤的大小與位置會影響能否保留乳房。', clin: '實際大小與範圍以影像與病理報告為準。' },
  margin: { zh: '安全邊界', en: 'Surgical margin', text: '腫瘤周圍一起切除的正常組織。', clin: '病理確認邊緣沒有癌細胞,才算切乾淨。' },
  cavity: { zh: '切除後缺損', en: 'Excision cavity', text: '切除腫瘤後留下的空間。', clin: '缺損大或位在內下方時,外觀變形較明顯。' },
  pecmaj: { zh: '胸大肌', en: 'Pectoralis major', text: '乳房正下方的大片肌肉,負責手臂往內與往前的動作。', clin: '假體重建常把擴張器或假體放在它的下方。' },
  pecmin: { zh: '胸小肌', en: 'Pectoralis minor', text: '位在胸大肌深層的小肌肉。', clin: '腋下淋巴結手術時的重要解剖標記。' },
  serratus: { zh: '前鋸肌', en: 'Serratus anterior', text: '貼著側胸壁的鋸齒狀肌肉,穩定肩胛骨。', clin: '支配它的長胸神經在腋下手術時需保護。' },
  lat: { zh: '背闊肌', en: 'Latissimus dorsi', text: '側背部的大片肌肉,讓手臂往後、往下拉。', clin: '背闊肌皮瓣以胸背動靜脈為血管蒂,可轉到乳房補體積。' },
  rectus: { zh: '腹直肌', en: 'Rectus abdominis', text: '腹部正中的兩條直向肌肉,俗稱六塊肌。', clin: 'TRAM 會取用一段腹直肌;DIEP 則保留它,只取穿過它的血管。' },
  extobl: { zh: '腹外斜肌', en: 'External oblique', text: '側腹部最外層的肌肉。', clin: '腹部皮瓣手術後的腹壁強度與它有關。' },
  linea_alba: { zh: '白線', en: 'Linea alba', text: '腹部正中的筋膜線,兩側腹直肌在此相接。', clin: '' },
  deltoid: { zh: '三角肌', en: 'Deltoid', text: '包覆肩膀的肌肉。', clin: '' },
  teres: { zh: '大圓肌', en: 'Teres major', text: '肩胛骨下方的肌肉,靠近背闊肌。', clin: '' },
  intercostal: { zh: '肋間肌', en: 'Intercostal muscles', text: '肋骨之間的肌肉,幫助呼吸。', clin: '內乳血管走在肋間肌與肋軟骨的深層。' },
  rib: { zh: '肋骨', en: 'Rib', text: '保護心肺的骨骼。', clin: '' },
  cart: { zh: '肋軟骨', en: 'Costal cartilage', text: '肋骨前端連到胸骨的軟骨。', clin: 'DIEP 吻合內乳血管時,常移除一小段第三肋軟骨。' },
  sternum: { zh: '胸骨', en: 'Sternum', text: '胸前正中的骨頭。', clin: '內乳血管沿胸骨兩側下行。' },
  clavicle: { zh: '鎖骨', en: 'Clavicle', text: '連接胸骨與肩膀的骨頭。', clin: '' },
  scapula: { zh: '肩胛骨', en: 'Scapula', text: '背部上方的三角形骨頭。', clin: '' },
  humerus: { zh: '肱骨', en: 'Humerus', text: '上臂骨,胸大肌與背闊肌都附著在這裡。', clin: '' },
  hip: { zh: '骨盆', en: 'Hip bone', text: '下腹部皮瓣的下界接近骨盆。', clin: '' },
  spine: { zh: '脊椎', en: 'Vertebral column', text: '', clin: '' },
  omentum: { zh: '大網膜', en: 'Greater omentum', text: '從胃垂下來、覆蓋腸子的脂肪組織。', clin: '可用腹腔鏡游離,以胃網膜血管為蒂轉到乳房。' },
  stomach: { zh: '胃', en: 'Stomach', text: '', clin: '大網膜的血管來自胃大彎旁的胃網膜血管。' },
  colon: { zh: '橫結腸', en: 'Transverse colon', text: '', clin: '' },
  liver: { zh: '肝臟', en: 'Liver', text: '', clin: '' },
  implant: { zh: '永久假體', en: 'Breast implant', text: '矽膠或食鹽水做成的植入物。', clin: '需定期追蹤,可能發生包膜攣縮或破裂。' },
  expander: { zh: '組織擴張器', en: 'Tissue expander', text: '可以注水的空囊,先撐出空間再換假體。', clin: '常用於需要放療或皮膚不足的情況。' },
  flap_ld: { zh: '背闊肌皮瓣(轉位)', en: 'Latissimus dorsi flap', text: '帶著血管的一部分背闊肌。', clin: '以胸背動靜脈為血管蒂。' },
  flap_omentum: { zh: '大網膜皮瓣', en: 'Omental flap', text: '從腹腔取出的大網膜。', clin: '以胃網膜血管為血管蒂,經皮下隧道送到乳房。' },
  flap_tram: { zh: 'TRAM 皮瓣', en: 'Pedicled TRAM flap', text: '下腹部皮膚、脂肪加上一段腹直肌。', clin: '血流經上腹壁動脈供應。' },
  flap_diep: { zh: 'DIEP 皮瓣', en: 'DIEP flap', text: '下腹部皮膚與脂肪,不含肌肉。', clin: '血管接到胸前的內乳動靜脈。' },
  'Internal thoracic': { zh: '內乳動靜脈', en: 'Internal thoracic vessels', text: '沿胸骨兩側下行的血管。', clin: 'DIEP 等游離皮瓣最常接的受血管;往下延續為上腹壁血管。' },
  'Superior epigastric': { zh: '上腹壁動靜脈', en: 'Superior epigastric vessels', text: '內乳血管往下的延續,走在腹直肌後方。', clin: '帶蒂 TRAM 的血流來源。' },
  'Inferior epigastric': { zh: '下腹壁動靜脈', en: 'Deep inferior epigastric vessels', text: '從下方進入腹直肌的血管。', clin: 'DIEP 皮瓣的血流來源,穿通枝穿過腹直肌到皮膚。' },
  'Superficial epigastric': { zh: '淺腹壁動脈', en: 'Superficial epigastric artery', text: '下腹部皮下的淺層血管。', clin: '' },
  Thoracodorsal: { zh: '胸背動靜脈與神經', en: 'Thoracodorsal vessels', text: '從腋下沿背闊肌深面走的血管神經。', clin: '背闊肌皮瓣的血管蒂。' },
  'Lateral thoracic': { zh: '外側胸動脈', en: 'Lateral thoracic artery', text: '供應側胸壁與乳房外側的血管。', clin: '' },
  Subscapular: { zh: '肩胛下動脈', en: 'Subscapular artery', text: '胸背動脈的上游。', clin: '' },
  'gastro-omental': { zh: '胃網膜血管', en: 'Gastro-omental vessels', text: '沿胃大彎走的血管。', clin: '大網膜皮瓣的血管蒂。' },
  duct: { zh: '乳管', en: 'Lactiferous duct', text: '把乳汁從小葉送到乳頭的管道,每一個乳腺葉一條。', clin: '乳管原位癌(DCIS)侷限在乳管內,尚未侵犯到管外。' },
  sinus: { zh: '乳竇', en: 'Lactiferous sinus', text: '乳管靠近乳頭處的膨大部分。', clin: '' },
  lobule: { zh: '小葉', en: 'Lobule (TDLU)', text: '乳管末端製造乳汁的腺泡群,稱終末乳管小葉單位。', clin: '大部分乳癌由這裡長出;小葉癌在影像上較不容易看到。' },
  cooper: { zh: 'Cooper 韌帶', en: "Cooper's ligament", text: '連接乳腺與皮膚的纖維束,支撐乳房形狀。', clin: '腫瘤牽拉時皮膚會凹陷,是重要的理學檢查徵象。' },
  node: { zh: '腋下淋巴結', en: 'Axillary lymph node', text: '乳房淋巴主要流向這裡。', clin: '淋巴結轉移與否影響分期與後續治療。' },
  sentinel: { zh: '前哨淋巴結', en: 'Sentinel lymph node', text: '最先接收乳房淋巴的淋巴結。', clin: '前哨淋巴結切片沒有轉移時,通常可避免腋下淋巴結廓清,減少手臂水腫風險。' },
  lymph: { zh: '淋巴管', en: 'Lymphatic vessel', text: '把組織液與免疫細胞帶到淋巴結的細管。', clin: '' },
  aug: { zh: '隆乳假體', en: 'Breast implant', text: '矽膠或食鹽水假體,有圓形與水滴形。', clin: '需定期追蹤;包膜攣縮、破裂與罕見的 BIA-ALCL 是主要風險。' },
  glutmax: { zh: '臀大肌', en: 'Gluteus maximus', text: '臀部最大的肌肉。', clin: 'SGAP、IGAP 皮瓣的穿通枝穿過這塊肌肉,肌肉本身保留。' },
  gracilis: { zh: '股薄肌', en: 'Gracilis', text: '大腿內側細長的肌肉。', clin: 'TUG 皮瓣會連同股薄肌一起取,功能可由其他內收肌代償。' },
  vastlat: { zh: '股外側肌', en: 'Vastus lateralis', text: '大腿前外側的大肌肉。', clin: 'ALT 皮瓣的穿通枝穿過它或沿肌間隔到皮膚。' },
  rectfem: { zh: '股直肌', en: 'Rectus femoris', text: '大腿前側中間的肌肉。', clin: '' },
  sartorius: { zh: '縫匠肌', en: 'Sartorius', text: '從骨盆斜跨大腿前側的長條肌肉。', clin: '' },
  tfl: { zh: '闊筋膜張肌', en: 'Tensor fasciae latae', text: '大腿外上側的小肌肉。', clin: '' },
  addlong: { zh: '內收長肌', en: 'Adductor longus', text: '大腿內側的肌肉。', clin: '' },
  intobl: { zh: '腹內斜肌', en: 'Internal oblique', text: '腹壁中層肌肉。', clin: '' },
  femur: { zh: '股骨', en: 'Femur', text: '大腿骨。', clin: '' },
  'Superior gluteal': { zh: '臀上動脈', en: 'Superior gluteal artery', text: '從骨盆上方穿出到臀部的血管。', clin: 'SGAP 皮瓣的血流來源。' },
  'Inferior gluteal': { zh: '臀下動脈', en: 'Inferior gluteal artery', text: '從骨盆下方穿出到臀部的血管。', clin: 'IGAP 皮瓣的血流來源,旁邊有坐骨神經。' },
  'circumflex femoral': { zh: '旋股動脈', en: 'Circumflex femoral artery', text: '從股深動脈分出、繞著股骨的血管。', clin: '外側支的降支供應 ALT 皮瓣;內側支供應 TUG 皮瓣。' },
  'Deep femoral': { zh: '股深動脈', en: 'Deep femoral artery', text: '大腿深層的主要動脈。', clin: '它的穿通枝供應 PAP 皮瓣。' },
  'Perforating femoral': { zh: '股深動脈穿通枝', en: 'Perforating arteries', text: '從股深動脈穿到大腿後側的分支。', clin: 'PAP 皮瓣的血流來源。' },
  'Posterior intercostal': { zh: '肋間動脈', en: 'Intercostal arteries', text: '沿肋骨下緣走的血管。', clin: '外側穿通枝供應 LICAP 皮瓣。' },
  Musculophrenic: { zh: '肌膈動脈', en: 'Musculophrenic artery', text: '內乳動脈下端的分支,沿肋弓走。', clin: '其前肋間分支與 AICAP 皮瓣有關。' },
  'Lumbar arter': { zh: '腰動脈', en: 'Lumbar arteries', text: '從主動脈分出到腰部的血管。', clin: 'LAP 皮瓣的血流來源。' },
  'Femoral artery': { zh: '股動脈', en: 'Femoral artery', text: '大腿的主要動脈。', clin: '' },
  'External iliac': { zh: '髂外動脈', en: 'External iliac artery', text: '下腹壁動脈的上游。', clin: '' },
  gflap: { zh: '移植皮瓣(示意)', en: 'Flap', text: '從供區取下的皮膚、脂肪(有時含肌肉)。', clin: '帶蒂皮瓣保留原本的血管;游離皮瓣需在胸前重新接血管。' },
  perf: { zh: '穿通枝', en: 'Perforator', text: '從深部血管穿過肌肉或肌間隔到皮膚的小血管。', clin: '術前常用超音波或 CT 血管攝影定位。' },
  adm: { zh: 'ADM 或合成網片', en: 'Acellular dermal matrix / mesh', text: '支撐或包覆假體的材料。', clin: '可能增加血清腫或感染,費用較高。' },
  fatdrop: { zh: '移植脂肪', en: 'Fat graft', text: '抽出並純化後注射的自體脂肪。', clin: '部分會被吸收,常需多次;可能形成油囊。' },
  nodes_I_ant: { zh: '腋下淋巴結 Level I(前群)', en: 'Anterior (pectoral) axillary nodes', text: '沿胸大肌外緣、最靠近乳房的一群,前哨淋巴結常在這裡。', clin: '位於胸小肌外側,屬 Level I。' },
  nodes_I_post: { zh: '腋下淋巴結 Level I(後群)', en: 'Posterior (subscapular) nodes', text: '沿肩胛下血管分布。', clin: '屬 Level I,靠近胸背神經血管。' },
  nodes_I_lat: { zh: '腋下淋巴結 Level I(外側群)', en: 'Lateral (humeral) nodes', text: '沿腋靜脈外側分布,主要收集手臂的淋巴。', clin: '屬 Level I;保留可降低手臂水腫。' },
  nodes_II_cent: { zh: '腋下淋巴結 Level II(中央群)', en: 'Central axillary nodes', text: '位在胸小肌後方、腋窩中央。', clin: '屬 Level II。' },
  nodes_II_inter: { zh: '胸肌間淋巴結(Rotter)', en: 'Interpectoral nodes', text: '位在胸大肌與胸小肌之間。', clin: '屬 Level II。' },
  nodes_III_apical: { zh: '腋下淋巴結 Level III(頂群)', en: 'Apical (infraclavicular) nodes', text: '位在胸小肌內上方、鎖骨下。', clin: '屬 Level III,只有受侵犯時才清除。圖中 Level III 為依位置補上的示意。' },
  nodes_imn: { zh: '內乳淋巴結', en: 'Internal mammary nodes', text: '沿胸骨兩側的內乳血管分布。', clin: '內側腫瘤的淋巴有時流向這裡,影像上可見時會影響放療範圍。' },
  'Axillary vein': { zh: '腋靜脈', en: 'Axillary vein', text: '手臂回流的主要靜脈,是腋下廓清的上界。', clin: '廓清時必須保留。' },
  'Axillary artery': { zh: '腋動脈', en: 'Axillary artery', text: '供應手臂的主要動脈。', clin: '' },
  'Long thoracic': { zh: '長胸神經', en: 'Long thoracic nerve', text: '沿側胸壁下行,支配前鋸肌。', clin: '受傷會造成翼狀肩胛。' },
  'pectoral nerve': { zh: '胸肌神經', en: 'Pectoral nerves', text: '支配胸大肌與胸小肌。', clin: '受傷可能造成胸大肌萎縮。' },
  Cephalic: { zh: '頭靜脈', en: 'Cephalic vein', text: '手臂外側的淺層靜脈。', clin: '' },
  dyepath: { zh: '追蹤劑經過的淋巴管', en: 'Tracer pathway', text: '從乳暈周圍流向腋下的淋巴管。', clin: '' },
  probe: { zh: 'γ 探頭', en: 'Gamma probe', text: '偵測放射性追蹤劑的探頭。', clin: '' },
  drain: { zh: '引流管', en: 'Surgical drain', text: '把術後滲出的組織液引流出來。', clin: '通常放置數天到一兩週。' },
  clip: { zh: '標記夾', en: 'Marker clip', text: '放在已證實轉移淋巴結上的小金屬夾。', clin: '新輔助治療後用來確認取到原本有轉移的淋巴結。' },
  drape: { zh: '覆蓋布', en: 'Drape', text: '示意用的覆蓋布,遮住與乳房重建無關的部位。', clin: '' },
  anast: { zh: '血管吻合處', en: 'Microvascular anastomosis', text: '皮瓣血管與胸前血管接合的位置。', clin: '術後幾天需密切監測皮瓣血流。' }
};

export const TABLE = {
  cols: ['保留乳房手術', '外上方 + 背闊肌', '內下方 + 大網膜', '全切 + TRAM', '全切 + DIEP', '全切 + 假體'],
  rows: [
    ['乳房是否保留', '保留', '保留', '保留', '全切', '全切', '全切'],
    ['重建組織', '無', '背闊肌', '大網膜', '下腹皮膚脂肪 + 腹直肌', '下腹皮膚脂肪', '擴張器,再換假體'],
    ['額外切口', '無', '腋下,視術式有背部', '腹腔鏡小孔', '下腹橫向', '下腹橫向', '無'],
    ['手術次數', '1 次', '通常 1 次', '通常 1 次', '1 次,另有修飾', '1 次,另有修飾', '通常 2 次以上'],
    ['手術複雜度', '低', '中', '中,需腹腔鏡', '高', '最高,需顯微手術', '低到中'],
    ['放療', '通常需要', '通常需要', '通常需要', '可耐受放療', '可耐受放療', '放療增加併發症'],
    ['主要風險', '局部變形', '血清腫、肩部力量', '腹部手術風險', '腹壁膨出、疝氣', '皮瓣血流問題', '包膜攣縮、需更換'],
    ['觸感', '自然', '自然', '柔軟', '自然', '自然', '較硬']
  ]
};
