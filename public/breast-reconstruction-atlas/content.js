// 衛教內容:情境、步驟、結構說明、對照表。所有文字待醫師審核。

export const LAYER_NAMES = ['皮膚', '皮下脂肪', '乳腺', '肌肉', '骨骼與深層'];

const MAST = { R: { P: 0, shape: 'flat', areola: false, defect: 0, gland: false, fat: false }, scars: ['mast_line'] };

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
  { id: 'diep', label: '全切 + DIEP', from: ['diep', 5] },
  { id: 'implant', label: '全切 + 假體', from: ['implant', 4] }
];

export const COMPARE_DEFAULT = { bcs: ['bcs', 'mast'], ld: ['bcs', 'ld'], omentum: ['bcs', 'omentum'], tram: ['tram', 'diep'], diep: ['diep', 'implant'], implant: ['implant', 'diep'] };

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
