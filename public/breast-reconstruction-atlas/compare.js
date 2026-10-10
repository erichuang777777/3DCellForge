// 常見比較:每個主題有選項,產生左右兩邊的狀態。所有臨床文字為草稿,待醫師審核。
import { donorScar, AX } from './techniques.js';

// 象限位置:相對乳頭(du 向外側為正、dw 向上為正,公尺)
export const QN = { uoq: [0.034, 0.04], loq: [0.036, -0.028], liq: [-0.03, -0.028], uiq: [-0.03, 0.038], lat: [0.064, 0.01], low: [0, -0.036] };
const QZH = { uoq: '外上', loq: '外下', liq: '內下', uiq: '內上' };
const QUAD = { key: 'q', zh: '腫瘤位置', choices: [['uoq', '外上'], ['uiq', '內上'], ['loq', '外下'], ['liq', '內下']] };
const r4 = (x) => +x.toFixed(4);
const SG = { R: -1, L: 1 };
// 局部座標(du 外側為正)→ 刀口座標(面對病人,X 向觀看者右方)
const fc = (side, du, dw) => [r4(SG[side] * du), r4(dw)];
const arcL = (side, r, a0, a1, n = 14) => Array.from({ length: n + 1 }, (_, i) => { const t = a0 + ((a1 - a0) * i) / n; return fc(side, r * Math.sin(t), r * Math.cos(t)); });
const cut = (pts, side = 'R', extra = {}) => ({ side, closed: false, dashed: false, pts, ...extra });
const ring = (r, side = 'R') => ({ side, closed: true, dashed: false, pts: arcL(side, r, 0, Math.PI * 2, 32) });
const imfLine = (w, side = 'R') => cut(Array.from({ length: 9 }, (_, i) => { const x = -w + (2 * w * i) / 8; return [r4(x), r4(1.2 * x * x)]; }), side, { ref: 'imf' });
const angOf = (q) => Math.atan2(QN[q][0], QN[q][1]);
// 腫瘤正上方的刀口:上半部弧形、下半部放射狀
function overTumor(q, side = 'R') {
  const a = angOf(q); const d = Math.hypot(...QN[q]);
  if (QN[q][1] > 0) return cut(arcL(side, d, a - 0.34, a + 0.34));
  return cut([fc(side, 0.024 * Math.sin(a), 0.024 * Math.cos(a)), fc(side, (d + 0.022) * Math.sin(a), (d + 0.022) * Math.cos(a))]);
}
const periAreolar = (q, side = 'R') => { const a = angOf(q); return cut(arcL(side, 0.0185, a - 1.25, a + 1.25)); };
const FLAT = { P: 0, shape: 'flat', areola: false, defect: 0, gland: false, fat: false };
const camFor = (q) => (q === 'uiq' || q === 'liq' ? 'front' : 'oblique');
const bcsState = (q, d, scar) => ({ tq: q, cut: 1, R: { defect: d, dq: q }, custom: [scar] });
const FLAP_BY_Q = { uoq: ['tdap', 'TDAP 胸背動脈穿通枝皮瓣'], loq: ['licap', 'LICAP 側胸肋間穿通枝皮瓣'], liq: ['aicap', 'AICAP 前肋間穿通枝皮瓣'], uiq: ['micap', 'MICAP 內側肋間穿通枝皮瓣'] };

export const PRESETS = [
  {
    id: 'bcs_mast', zh: '保留乳房 vs 全切', opts: [QUAD],
    build: ({ q }) => ({
      cam: camFor(q),
      a: { label: `保留乳房(${QZH[q]})`, state: bcsState(q, 0.014, overTumor(q)) },
      b: { label: '全切未重建', state: { R: FLAT, scars: ['mast_line'] } },
      text: '保留乳房只切除腫瘤與安全邊界,刀口在腫瘤附近,乳房外形大致保留,可能有輕微凹陷;全切移除整個乳房與乳頭乳暈,胸前留下橫向疤痕。',
      diffs: [['刀口在腫瘤上方,較短', '胸前橫向長疤痕'], ['可能有局部凹陷', '胸前平坦,可日後重建'], ['通常需要放射治療', '依病理決定是否放療']]
    })
  },
  {
    id: 'bcs_inc', zh: '保留乳房:刀口位置', opts: [QUAD],
    build: ({ q }) => ({
      cam: camFor(q),
      a: { label: '腫瘤正上方切口', state: bcsState(q, 0.012, overTumor(q)) },
      b: { label: '乳暈旁切口', state: bcsState(q, 0.012, periAreolar(q)) },
      text: '同樣的切除範圍,刀口可以開在腫瘤正上方(上半部弧形、下半部放射狀),或沿乳暈邊緣從遠處切除。乳暈旁的疤痕落在膚色交界,較不明顯,但腫瘤離乳暈越遠,手術越困難。',
      diffs: [['直接到達腫瘤,切除最直接', '疤痕藏在乳暈邊緣'], ['疤痕在乳房表面', '腫瘤太遠時不適合'], ['適合任何位置', '需經皮下隧道到達腫瘤']]
    })
  },
  {
    id: 'bcs_recon', zh: '保留乳房:有無局部重建', opts: [QUAD],
    build: ({ q }) => {
      const [tech, name] = FLAP_BY_Q[q];
      return {
        cam: camFor(q),
        a: { label: '單純切除', state: bcsState(q, 0.022, overTumor(q)) },
        b: { label: name.split(' ')[0] + ' 補缺損', state: { ...bcsState(q, 0.003, overTumor(q)), gf: { tech, t: 1, vis: 1, zone: q }, wscars: donorScar(tech) } },
        text: `切除比例較大時(約兩到三成以上),單純縫合容易在${QZH[q]}凹陷。可用附近的皮瓣(此處以 ${name} 為例)轉進缺損補回體積,代價是多一道供區疤痕。可到「部分重建」分類看旋轉過程。`,
        diffs: [['手術較短', '多一道供區疤痕'], ['切除多時凹陷明顯', '外形較能維持'], ['日後可再補脂肪', '皮瓣日後體積可能變化']]
      };
    }
  },
  {
    id: 'mast_recon', zh: '全切:有無重建與刀口', opts: [{ key: 'inc', zh: '重建的刀口', choices: [['imf', '乳房下皺褶'], ['lat', '側胸'], ['peri', '乳暈旁']] }],
    build: ({ inc }) => {
      const sc = inc === 'imf' ? imfLine(0.04) : inc === 'lat' ? cut([fc('R', 0.024, 0.0), fc('R', 0.05, 0.003), fc('R', 0.078, 0.008)]) : cut(arcL('R', 0.0185, Math.PI * 0.55, Math.PI * 1.45));
      const zh = { imf: '乳房下皺褶', lat: '側胸', peri: '乳暈下緣' }[inc];
      return {
        cam: inc === 'lat' ? 'oblique' : 'front',
        a: { label: '全切未重建', state: { R: FLAT, scars: ['mast_line'] } },
        b: { label: `乳頭保留式全切 + 重建(${zh}刀口)`, state: { R: { P: 0.06, gland: false, fat: false, pt: 0.6 }, custom: [sc] } },
        text: `未重建時胸前平坦,留下橫向疤痕。立即重建常用乳頭保留式全切,刀口可放在${zh}:${inc === 'imf' ? '疤痕藏在乳房下緣,穿衣與正面都看不到。' : inc === 'lat' ? '疤痕在側面,靠近腋下,正面看不到。' : '疤痕在乳暈下緣的膚色交界,但乳頭血流的風險較高。'}`,
        diffs: [['胸前平坦,可穿義乳', '保留乳房外形與乳頭'], ['橫向疤痕', `${zh}疤痕`], ['手術較短', '多一次假體或皮瓣的風險']]
      };
    }
  },
  {
    id: 'impl_diep', zh: '假體 vs DIEP', opts: [{ key: 'nip', zh: '乳頭', choices: [['keep', '保留乳頭'], ['no', '不保留乳頭']] }],
    build: ({ nip }) => {
      const keep = nip === 'keep';
      const rA = { P: 0.062, shape: 'round', gland: false, fat: false, areola: keep };
      const rB = { P: 0.064, shape: 'natural', gland: false, fat: true, areola: keep, pt: 0.9 };
      const brScar = keep ? [imfLine(0.035)] : [ring(0.02)];
      return {
        cam: 'torso',
        a: { label: `假體重建(${keep ? '保留乳頭' : '不保留乳頭'})`, state: { R: rA, custom: brScar, imp: { kind: 'implant', plane: 'pre', fill: 1, vis: 1 } } },
        b: { label: `DIEP 重建(${keep ? '保留乳頭' : '不保留乳頭'})`, state: { R: rB, custom: keep ? brScar : [], scars: ['abd_line', 'umb'], paddle: keep ? 0 : 1, paddleR: [0.022, 0.022, 0.03] } },
        text: keep
          ? '保留乳頭時,兩者胸前都只有下皺褶疤痕。差別在外形與供區:假體上半部較飽滿、形狀固定;DIEP 較自然下垂,但下腹部多一道髖到髖的疤痕。'
          : '不保留乳頭時,假體重建在原乳暈處留下一圈疤痕;DIEP 會在原乳暈處露出一塊來自腹部的皮島(顏色略不同),腹部另有長疤痕。乳頭可日後重建。',
        diffs: [['胸部以外沒有疤痕', '下腹部橫向長疤痕'], ['上半部較圓、較挺', '外形與觸感較自然'], [keep ? '下皺褶疤痕' : '乳暈處環形疤痕', keep ? '下皺褶疤痕' : '乳暈處皮島'], ['日後可能需更換假體', '一次手術較長,恢復較久']]
      };
    }
  },
  {
    id: 'contra', zh: '對側要不要隆乳', opts: [{ key: 'rec', zh: '患側重建方式', choices: [['implant', '假體'], ['diep', 'DIEP']] }],
    build: ({ rec }) => {
      const R = rec === 'implant' ? { P: 0.074, shape: 'round', gland: false, fat: false, areola: true } : { P: 0.074, shape: 'natural', gland: false, fat: true, areola: true, pt: 0.8 };
      const base = { R, ...(rec === 'implant' ? { imp: { kind: 'implant', plane: 'pre', fill: 1, vis: 1 } } : { scars: ['abd_line', 'umb'] }), custom: [imfLine(0.035)] };
      return {
        cam: 'front',
        a: { label: '只做患側重建', state: { ...base, L: { P: 0.048 } } },
        b: { label: '患側重建 + 對側隆乳', state: { ...base, L: { P: 0.074, upper: 0.55, pt: 0.5 }, aug: { plane: 'dual', fill: 1, vis: 1, shapeR: 'round', shapeL: 'round', ml: 300 }, custom: [imfLine(0.035), imfLine(0.03, 'L')] } }
      ,
        text: '乳房較小的病人,重建側常比原本的乳房大或挺。對側同時或日後放假體,可讓兩邊大小與形狀接近;代價是健側也有疤痕與假體的長期風險,乳房攝影需特殊照法。',
        diffs: [['健側不動手術', '健側多一道下皺褶疤痕'], ['兩側大小可能不同', '兩側較對稱'], ['—', '健側也有假體的長期追蹤']]
      };
    }
  },
  {
    id: 'aug_look', zh: '隆乳外觀:自然 vs 圓形飽滿', opts: [{ key: 'size', zh: '大小', choices: [['m', '中等'], ['l', '較大']] }],
    build: ({ size }) => {
      const k = size === 'l' ? 1 : 0.84;
      const nat = { P: r4(0.074 * k), upper: 0.5, ptosis: 0.45 };
      const rnd = { P: r4(0.086 * k), shape: 'round', sc: r4(1 + 0.12 * k) };
      return {
        cam: 'oblique',
        a: { label: '自然外觀(水滴形)', state: { R: nat, L: nat, custom: [imfLine(0.03), imfLine(0.03, 'L')] } },
        b: { label: '圓形飽滿(圓形假體)', state: { R: rnd, L: rnd, custom: [imfLine(0.03), imfLine(0.03, 'L')] } },
        text: '同樣是隆乳,外觀可以差很多。水滴形假體或較小的圓形假體,上半部呈自然斜坡、下半部較飽滿;較大的圓形假體上半部飽滿外凸、整體偏圓,邊界較明顯。實際效果還取決於原本的組織厚度與放置層次。',
        diffs: [['上半部自然斜坡', '上半部飽滿外凸'], ['下半部較飽滿,略帶下垂', '整體偏圓,乳頭在最突出處'], ['較不易看出做過手術', '較明顯的「做過」外觀']]
      };
    }
  },
  {
    id: 'implant_plane', zh: '假體:胸大肌下 vs 胸大肌前', section: true,
    opts: [{ key: 'ml', zh: '假體大小', choices: [['250', '250 mL'], ['350', '350 mL'], ['450', '450 mL'], ['550', '550 mL']] }, { key: 'view', zh: '看', choices: [['layer', '肌肉與假體'], ['skin', '外觀']] }],
    build: ({ ml, view }) => {
      const v = Number(ml); const layer = view === 'layer';
      const R = { P: 0.012, gland: false, fat: false, shape: 'round' };
      const ex = layer ? { ghostMus: 0.55, hi: ['pecmaj_r'] } : {};
      return {
        cam: 'oblique', peel: layer ? 3 : 0,
        a: { label: `胸大肌下(${v} mL)`, state: { R, ...ex, imp: { kind: 'implant', plane: 'sub', fill: 1, vis: 1, ml: v } } },
        b: { label: `胸大肌前 + ADM(${v} mL)`, state: { R, ...ex, imp: { kind: 'implant', plane: 'pre', fill: 1, vis: 1, ml: v, adm: 1, admType: 'wrap' } } },
        text: '胸大肌下:假體在肌肉後方,上半部多一層肌肉覆蓋,邊緣較不明顯,但用力時乳房會隨肌肉移動(動作變形)、疼痛較多。胸大肌前:肌肉不動,沒有動作變形、恢復較快,但只靠皮膚與皮下脂肪覆蓋,需要皮瓣夠厚,常以 ADM 或網片包覆。假體越大,突度越高,需要的皮膚也越多。',
        diffs: [['覆蓋較厚', '覆蓋只有皮膚與皮下脂肪'], ['動作變形、疼痛較多', '沒有動作變形'], ['適合皮瓣較薄的人', '需要皮瓣夠厚、血流好']]
      };
    }
  },
  {
    id: 'slnb_alnd', zh: '前哨切片 vs 腋下廓清', opts: [{ key: 'view', zh: '看', choices: [['nodes', '淋巴結'], ['skin', '傷口']] }],
    build: ({ view }) => {
      const n = view === 'nodes';
      const ex = n ? { nodes: 1, ghostMus: 0.3, vesselsOnly: AX.AXV } : {};
      return {
        cam: 'axilla', peel: n ? 3 : 0,
        a: { label: '前哨淋巴結切片', state: { ...ex, slnGone: 1, wscars: [AX.AX_SMALL(false)] } },
        b: { label: '腋下淋巴結廓清', state: { ...ex, gI: 1, gII: 1, drain: n ? 0 : 1, wscars: [AX.AX_LONG] } },
        text: '前哨切片只取出 1 到 3 顆最先接收淋巴的淋巴結,其餘保留;廓清會把 Level I、II 的淋巴結連同脂肪整塊取出,只剩 Level III(紅)與內乳淋巴結。切除越多,手臂淋巴水腫與麻木的機會越高。',
        diffs: [['取 1–3 顆', '取 Level I、II 全部(常 10 顆以上)'], ['腋下 2–3 cm 小切口', '較長切口、放引流管'], ['淋巴水腫風險低(約 5% 以下)', '淋巴水腫風險較高(約 15–25%)']]
      };
    }
  }
];
