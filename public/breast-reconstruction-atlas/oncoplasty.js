// 腫瘤位置模擬:臨床規則、刀口幾何與計算。所有數字為草稿預設值,待醫師審核修改。
// 座標慣例(facing):面對病人看,X 向觀看者右方為正,Y 向上為正,原點為乳頭,單位公尺。
// Ls = 外側方向在 X 的正負號:左乳 +1(外側在觀看者右邊),右乳 -1。

export const CONFIG = {
  marginCm: 1.0, // 安全邊界
  cupVolumes: { A: 250, B: 350, C: 450, D: 600, E: 750 }, // 罩杯 → 乳房體積 mL(草稿)
  modelVolume: 450, // 3D 模型預設乳房對應的體積
  level1Max: 0.2, // 切除比例 < 20%:Level I
  level2Max: 0.5, // 20–50%:Level II;以上:建議 volume replacement 或全切
  nearAreolaCm: 3.5, // 距乳頭小於此值,可考慮 periareolar
  batwingCm: 4.5, // 上方且距乳頭小於此值,可考慮 batwing
  nearFoldCm: 4.5, // 下方且距乳頭大於此值(靠近乳房下皺褶),可考慮 IMF incision
  lateralChestCm: 5, // 外側且距乳頭大於此值,建議側胸 linear
  centralCm: 2.0, // 距乳頭小於此值視為中央區
  riskZones: ['low', 'low_med', 'med', 'up_med'] // 變形較明顯的區域
};

export const ZONES = {
  central: { zh: '中央(乳頭乳暈附近)', l2: ['round_block'] },
  up: { zh: '正上方', l2: ['inferior_pedicle', 'omega'] },
  up_lat: { zh: '外上方', l2: ['round_block', 'lateral_mp'] },
  lat: { zh: '外側', l2: ['lateral_mp'] },
  low_lat: { zh: '外下方', l2: ['j_plasty', 'l_plasty'] },
  low: { zh: '正下方', l2: ['vertical', 'imf_plasty', 'inverted_t'] },
  low_med: { zh: '內下方', l2: ['vertical', 'inverted_t'] },
  med: { zh: '內側', l2: ['medial_mp'] },
  up_med: { zh: '內上方', l2: ['omega', 'medial_mp'] }
};

export const INCISIONS = {
  // Level I:單純切除與局部組織移位
  curvilinear: { level: 1, zh: '弧形切口', en: 'Curvilinear', text: '沿乳頭同心圓方向的弧線,常用於乳房上半部,疤痕順著皮膚紋路。' },
  radial: { level: 1, zh: '放射狀切口', en: 'Radial', text: '從乳頭向外的直線,常用於乳房下半部,可避免下緣被拉扯變形。' },
  lateral_linear: { level: 1, zh: '側胸直線切口', en: 'Lateral linear', text: '位於側胸,與腋中線平行的直線,疤痕藏在手臂旁。' },
  periareolar: { level: 1, zh: '乳暈旁切口', en: 'Periareolar', text: '沿乳暈邊緣的弧線,疤痕落在乳暈與皮膚交界,較不明顯。' },
  batwing: { level: 1, zh: '蝙蝠翼切口', en: 'Batwing', text: '乳暈上方兩側延伸如翅膀,用於乳暈上方的腫瘤,可同時切除皮膚並上提乳頭。' },
  imf: { level: 1, zh: '乳房下皺褶切口', en: 'Inframammary fold incision', text: '藏在乳房下緣皺褶,適合靠近下緣的腫瘤。' },
  // Level II:therapeutic mammaplasty(依 Clough oncoplastic atlas)
  round_block: { level: 2, zh: '乳暈環形整形', en: 'Periareolar (round block) mammaplasty', text: '在乳暈周圍切除一圈皮膚,疤痕只在乳暈邊緣。' },
  inferior_pedicle: { level: 2, zh: '下蒂乳房整形', en: 'Inferior pedicle mammaplasty', text: '保留下方組織供應乳頭,切除上方腫瘤並重塑乳房,疤痕呈倒 T。' },
  omega: { level: 2, zh: 'Omega 整形', en: 'Omega mammaplasty', text: '乳暈上方 Ω 形切除,用於上方與內上方腫瘤,同時上提乳頭。' },
  lateral_mp: { level: 2, zh: '外側乳房整形', en: 'Lateral mammaplasty', text: '乳暈環形加向外上延伸的切口(球拍形),用於外側腫瘤。' },
  medial_mp: { level: 2, zh: '內側乳房整形', en: 'Medial mammaplasty', text: '乳暈環形加向內延伸的切口,用於內側腫瘤。' },
  j_plasty: { level: 2, zh: 'J 形整形', en: 'J-plasty', text: '乳暈環形加向下再彎向外側的切口,用於外下方腫瘤。' },
  l_plasty: { level: 2, zh: 'L 形整形', en: 'L-plasty', text: '乳暈環形加垂直向下,再沿下緣向外的切口,用於外下方腫瘤。' },
  vertical: { level: 2, zh: '垂直乳房整形', en: 'Vertical mammaplasty', text: '乳暈環形加垂直向下的切口,用於下方腫瘤。' },
  imf_plasty: { level: 2, zh: '下皺褶整形', en: 'Inframammary fold plasty', text: '沿乳房下緣切除並上推組織,用於非常靠近下緣的腫瘤。' },
  inverted_t: { level: 2, zh: '倒 T 乳房整形', en: 'Inverted-T mammaplasty', text: '乳暈環形、垂直與下緣橫向的倒 T 疤痕,適合較大或下垂的乳房。' }
};

// 鐘點(1–12,可含半點)+ 表面距離(cm)→ facing 座標(公尺)
export function clockToXY(hour, distCm, sc = 1) {
  const a = ((hour % 12) * 30 * Math.PI) / 180;
  const Rk = 0.09 * sc; const d = distCm / 100;
  const r = Rk * Math.sin(Math.min(d / Rk, Math.PI / 2)); // 以球面近似,把皮膚表面距離換成正面投影距離
  return { X: r * Math.sin(a), Y: r * Math.cos(a), angleDeg: ((hour % 12) * 30) };
}

// 面對病人的鐘點角度 → 解剖角度(0 上、90 外側、180 下、270 內側)
export function anatomicAngle(angleDeg, Ls) { return Ls > 0 ? angleDeg : (360 - angleDeg) % 360; }

export function zoneOf(phi, distCm, cfg = CONFIG) {
  if (distCm < cfg.centralCm) return 'central';
  const z = ['up', 'up_lat', 'lat', 'low_lat', 'low', 'low_med', 'med', 'up_med'];
  return z[Math.floor(((phi + 22.5) % 360) / 45)];
}

export function breastVolume(cup, customMl, cfg = CONFIG) {
  if (cup === 'custom' && customMl > 0) return customMl;
  return cfg.cupVolumes[cup] || cfg.modelVolume;
}

// 主要計算:輸入 → 體積、比例、分級、建議刀口
export function analyze(input, cfg = CONFIG) {
  const { side, hour, distCm, sizeCm, cup, customMl } = input;
  const Ls = side === 'L' ? 1 : -1;
  const Vb = breastVolume(cup, customMl, cfg);
  const sc = Math.min(Math.max(Math.cbrt(Vb / cfg.modelVolume), 0.75), 1.22);
  const exR = sizeCm / 2 + cfg.marginCm; // 切除半徑(cm)
  const Ve = (4 / 3) * Math.PI * exR ** 3; // mL
  const ratio = Ve / Vb;
  const level = ratio < cfg.level1Max ? 1 : ratio < cfg.level2Max ? 2 : 3;
  const { X, Y, angleDeg } = clockToXY(hour, distCm, sc);
  const phi = anatomicAngle(angleDeg, Ls);
  const zone = zoneOf(phi, distCm, cfg);
  const upper = Y >= 0;
  // Level I 建議:上半 curvilinear、下半 radial、側胸 linear,另依距離加入乳暈旁、蝙蝠翼、下皺褶
  const l1 = [];
  if (zone === 'central' || distCm < cfg.nearAreolaCm) l1.push('periareolar');
  if (zone === 'lat' && distCm >= cfg.lateralChestCm) l1.push('lateral_linear');
  if ((zone === 'up' || zone === 'central') && upper && distCm < cfg.batwingCm) l1.push('batwing');
  l1.push(upper ? 'curvilinear' : 'radial');
  if (!upper && distCm >= cfg.nearFoldCm && ['low', 'low_lat', 'low_med'].includes(zone)) l1.push('imf');
  const l2 = ZONES[zone].l2.slice();
  const recommended = level === 1 ? l1 : l2;
  const warnings = [];
  if (cfg.riskZones.includes(zone)) warnings.push('這個位置切除後外觀變化通常較明顯,可考慮搭配腫瘤整形手術。');
  if (zone === 'central') warnings.push('腫瘤靠近乳頭乳暈,可能需要一併處理乳頭乳暈,請與醫師討論。');
  if (level === 3) warnings.push('切除比例偏高,可能需要以自體組織補充體積(背闊肌、大網膜),或考慮全切加重建。');
  if (distCm / 100 > 0.085 * sc) warnings.push('距離超出模型乳房範圍,請確認距離是否正確。');
  return { Ls, Vb, sc, exR, Ve, ratio, level, X, Y, angleDeg, phi, zone, upper, l1: [...new Set(l1)], l2, recommended: [...new Set(recommended)], warnings };
}

// 刀口幾何:回傳數條折線,每條為 facing 座標點陣列;closed 表示封閉
export function incisionPaths(id, ctx) {
  const { X: tx, Y: ty, exR, Ls, sc } = ctx; // exR 單位 cm
  const e = exR / 100; const Ra = 0.017; const Yf = -0.052 * sc;
  const d = Math.hypot(tx, ty); const a = Math.atan2(tx, ty); // 0 = 上方
  const arc = (r, a0, a1, n = 24, cx = 0, cy = 0) => Array.from({ length: n + 1 }, (_, i) => { const t = a0 + ((a1 - a0) * i) / n; return [cx + r * Math.sin(t), cy + r * Math.cos(t)]; });
  const circle = (r) => ({ pts: arc(r, 0, Math.PI * 2, 40), closed: true });
  const nac = Ra + 0.0015;
  switch (id) {
    case 'curvilinear': {
      const rr = Math.max(d, nac + 0.006); const span = Math.min((2 * e + 0.01) / rr, Math.PI * 0.9);
      return [{ pts: arc(rr, a - span / 2, a + span / 2) }];
    }
    case 'radial': {
      const r0 = Math.max(nac + 0.004, d - e - 0.005), r1 = d + e + 0.005;
      return [{ pts: [[r0 * Math.sin(a), r0 * Math.cos(a)], [r1 * Math.sin(a), r1 * Math.cos(a)]] }];
    }
    case 'lateral_linear':
      return [{ pts: [[tx, ty + e + 0.008], [tx, ty - e - 0.008]] }];
    case 'periareolar': {
      const span = (150 * Math.PI) / 180;
      return [{ pts: arc(nac, a - span / 2, a + span / 2) }];
    }
    case 'batwing': {
      const W = nac + 0.028; const peak = Math.max(ty + e, nac + 0.02);
      return [
        { pts: [[-W, 0.004], ...arc(nac, -Math.PI * 0.42, Math.PI * 0.42, 16), [W, 0.004]] },
        { pts: [[-W, 0.004], [-nac * 0.9, peak * 0.82], [0, peak], [nac * 0.9, peak * 0.82], [W, 0.004]] }
      ];
    }
    case 'imf': {
      const w = e + 0.015; const n = 12;
      return [{ pts: Array.from({ length: n + 1 }, (_, i) => { const x = tx - w + (2 * w * i) / n; return [x, Yf + 3 * (x - tx) ** 2]; }) }];
    }
    case 'round_block':
      return [circle(nac), { pts: arc(nac + 0.018, 0, Math.PI * 2, 40), closed: true, design: true }];
    case 'inferior_pedicle':
    case 'inverted_t':
      return [circle(nac), { pts: [[0, -nac], [0, Yf]] }, { pts: arc(0.6, Math.PI - 0.09, Math.PI + 0.09, 12, 0, Yf + 0.6) }];
    case 'omega':
      return [{ pts: [[-0.048, -0.008], [-nac, -0.008], ...arc(nac, -Math.PI * 0.62, Math.PI * 0.62, 20), [nac, -0.008], [0.048, -0.008]] }];
    case 'lateral_mp':
      return [circle(nac), { pts: [[Ls * nac * 0.92, nac * 0.4], [Ls * 0.045, 0.02], [Ls * 0.07, 0.034]] }];
    case 'medial_mp':
      return [circle(nac), { pts: [[-Ls * nac * 0.95, 0.002], [-Ls * 0.04, 0.008], [-Ls * 0.06, 0.012]] }];
    case 'vertical':
      return [circle(nac), { pts: [[0, -nac], [0, Yf]] }];
    case 'j_plasty':
      return [circle(nac), { pts: [[0, -nac], [0, Yf + 0.014], [Ls * 0.012, Yf + 0.005], [Ls * 0.035, Yf + 0.004]] }];
    case 'l_plasty':
      return [circle(nac), { pts: [[0, -nac], [0, Yf]] }, { pts: [[0, Yf], [Ls * 0.025, Yf + 0.001], [Ls * 0.048, Yf + 0.004]] }];
    case 'imf_plasty':
      return [{ pts: Array.from({ length: 13 }, (_, i) => { const x = -0.045 + (0.09 * i) / 12; return [x, Yf + 2.5 * x * x]; }) }];
    default:
      return [];
  }
}

// 術後外形參數(供 3D 模型使用)
export function postShape(res, view, symmetrize, cfg = CONFIG) {
  const risk = cfg.riskZones.includes(res.zone) ? 1.3 : 1;
  const P0 = 0.064 * res.sc;
  const dent = P0 * Math.min(res.ratio * 2.2 * risk, 0.85);
  const shift = Math.min(0.015, res.ratio * 0.05 * risk);
  if (view === 'pre') return { sc: res.sc, P: P0, dent: 0, shift: 0, lift: 0, ptosis: 1, other: null };
  if (view === 'post' || res.level === 3) return { sc: res.sc, P: P0, dent, shift, lift: 0, ptosis: 1, other: null };
  if (res.level === 1) return { sc: res.sc, P: P0, dent: dent * 0.25, shift: shift * 0.3, lift: 0, ptosis: 1, other: null };
  const sc2 = res.sc * Math.cbrt(Math.max((1 - res.ratio) * 0.9, 0.3));
  const shape = { sc: sc2, P: 0.064 * sc2, dent: 0, shift: 0, lift: 0.01, ptosis: 0.45 };
  return { ...shape, other: symmetrize ? shape : null };
}
