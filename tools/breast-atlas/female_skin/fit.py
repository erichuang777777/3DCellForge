# MakeHuman 女性身體 → 對齊到 Z-Anatomy 骨架座標,輸出軀幹皮膚與上臂皮膚
import gzip, json, numpy as np, sys
from scipy.spatial import cKDTree
sys.path.insert(0, '.'); import glb
import os
D = os.environ.get('MPFB_DATA', 'mpfb2/src/mpfb/data') + '/'
V = []; groups = {}; grp = None; bodyF = []
for line in open(D + '3dobjs/base.obj'):
    if line.startswith('v '): V.append([float(x) for x in line.split()[1:4]])
    elif line.startswith('g '): grp = line.split()[1]
    elif line.startswith('f '):
        f = [int(t.split('/')[0]) - 1 for t in line.split()[1:]]
        if grp == 'body': bodyF.append(f)
        groups.setdefault(grp, set()).update(f)
V = np.array(V)
def tgt(path, w):
    for line in gzip.open(D + 'targets/' + path, 'rt'):
        if line.startswith('#') or not line.strip(): continue
        p = line.split(); V[int(p[0])] += w * np.array([float(x) for x in p[1:4]])
tgt('macrodetails/asian-female-young.target.gz', 1.0)
tgt('breast/female-young-averagemuscle-averageweight-mincup-averagefirmness.target.gz', 1.0)  # 平胸,乳房由程式產生
V *= 0.1  # dm → m
J = lambda g: V[sorted(groups[g])].mean(0)
# ---- 手臂姿勢:A 字 → 與 Z-Anatomy 肱骨相同(外展約 10°) ----
W = json.load(open(D + 'rigs/standard/weights.default.json'))['weights']
arm_b = lambda s: [b for b in W if b.endswith('.' + s) and b.split('.')[0].startswith(('upperarm', 'lowerarm', 'wrist', 'finger', 'metacarpal'))]
for s, sx in (('L', 1), ('R', -1)):
    w = np.zeros(len(V))
    for b in arm_b(s):
        for i, x in W[b]: w[i] += x
    for b, k in ((f'shoulder01.{s}', 0.5), (f'clavicle.{s}', 0.15)):
        for i, x in W.get(b, []): w[i] += x * k
    globals()['armw_' + s] = np.clip(w, 0, 1)
armw = np.maximum(armw_L, armw_R)
# ---- 縮放與平移:胸骨切跡、肚臍高度對齊 ----
notch, navel = 0.425, 0.08
s_ = (1.41 - 1.017) / (notch - navel)
V = V * s_; V[:, 1] += 1.41 - notch * s_
# z:用胸骨體前緣對齊(Z-Anatomy 1.29 處 z≈0.116)
used = sorted({i for f in bodyF for i in f}); U = np.array(used)
mid = U[(np.abs(V[U, 0]) < 0.006) & (np.abs(V[U, 1] - 1.29) < 0.012) & (V[U, 2] > 0)]
V[:, 2] += 0.116 - V[mid, 2].max()
print('scale', round(s_, 3))
Z = glb.load(os.environ.get('ATLAS_GLB', 'chest.glb'))
def rot_to(a, b):
    a = a / np.linalg.norm(a); b = b / np.linalg.norm(b); v = np.cross(a, b); c = a @ b
    K = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + K + K @ K / (1 + c)
def axis_angle(R, t):
    # 以 t 比例做部分旋轉(Rodrigues)
    ang = np.arccos(np.clip((np.trace(R) - 1) / 2, -1, 1))
    if ang < 1e-6: return np.eye(3)
    k = np.array([R[2, 1] - R[1, 2], R[0, 2] - R[2, 0], R[1, 0] - R[0, 1]]) / (2 * np.sin(ang))
    K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]]); a = ang * t
    return np.eye(3) + np.sin(a) * K + (1 - np.cos(a)) * K @ K
for s, side in (('L', 'l'), ('R', 'r')):
    w = globals()['armw_' + s]
    H = Z['humerus_' + side][0]; top = H[:, 1].max()
    head = H[H[:, 1] > top - 0.035].mean(0)
    Hc = H - H.mean(0); ax = np.linalg.svd(Hc)[2][0]; ax = ax if ax[1] < 0 else -ax  # 往下
    sh = J(f'joint-{side}-shoulder'); el = J(f'joint-{side}-elbow')
    R = rot_to(el - sh, ax)
    off = head + np.array([0, -0.005, 0]) - sh
    for i in np.nonzero(w)[0]:
        Ri = axis_angle(R, w[i]); V[i] = sh + Ri @ (V[i] - sh) + off * w[i]
    # 前臂伸直一些(手肘彎曲減少 60%)
    wl = np.zeros(len(V))
    for b in [x for x in W if x.endswith('.' + s) and x.split('.')[0].startswith(('lowerarm', 'wrist', 'finger', 'metacarpal'))]:
        for i, x in W[b]: wl[i] += x
    wl = np.clip(wl, 0, 1)
    sh2 = J(f'joint-{side}-shoulder'); el2 = J(f'joint-{side}-elbow'); wr = J(f'joint-{side}-hand') if f'joint-{side}-hand' in groups else None
    if wr is not None:
        R2 = axis_angle(rot_to(wr - el2, el2 - sh2), 0.6)
        for i in np.nonzero(wl)[0]: V[i] = el2 + axis_angle(R2, wl[i]) @ (V[i] - el2)
    print(s, 'arm aligned; head', head.round(3))
# ---- 逐層對齊寬度與深度(軀幹,不含手臂) ----
ZS = Z['skin'][0]
torso = U[(armw[U] < 0.05)]
ys = np.arange(0.5, 1.47, 0.01)
def ext(P, y, h=0.008):
    S = P[np.abs(P[:, 1] - y) < h]
    if len(S) < 6: return None
    return np.abs(S[:, 0]).max(), S[:, 2].min(), S[:, 2].max()
prof = []
for y in ys:
    a = ext(ZS[np.abs(ZS[:, 0]) < 0.23], y); b = ext(V[torso], y)
    prof.append((a, b))
def smooth1(arr, k=5):
    out = arr.copy()
    for i in range(len(arr)):
        lo, hi = max(0, i - k), min(len(arr), i + k + 1); out[i] = np.nanmean(arr[lo:hi], 0)
    return out
sx = np.full(len(ys), np.nan); zb = np.full(len(ys), np.nan); zf = np.full(len(ys), np.nan)
for i, (a, b) in enumerate(prof):
    if a is None or b is None: continue
    sx[i] = a[0] / b[0]; zb[i] = a[1] - b[1]; zf[i] = a[2] - b[2]
for arr in (sx, zb, zf):
    m = np.isnan(arr); arr[m] = np.interp(np.nonzero(m)[0], np.nonzero(~m)[0], arr[~m])
sx, zb, zf = smooth1(sx), smooth1(zb), smooth1(zf)
AX = 0.55  # 寬度只對齊一半,保留女性腰臀曲線(碰到肌肉骨骼時再往外推)
for i in U:
    y = V[i, 1]; k = np.clip(np.interp(y, ys, sx), 0.7, 1.4); bz, fz = np.interp(y, ys, zb), np.interp(y, ys, zf)
    t = 1 - armw[i]
    # 深度:依前後位置在 zb 與 zf 之間內插
    zc = V[i, 2]
    frac = np.clip((zc + 0.15) / 0.3, 0, 1)
    V[i, 2] += t * (bz * (1 - frac) + fz * frac)
    V[i, 0] *= 1 + t * AX * (k - 1)
print('width ratio range', sx.min().round(2), sx.max().round(2), 'z back/front shifts', zb.min().round(3), zb.max().round(3), zf.min().round(3), zf.max().round(3))
hw = np.zeros(len(V))
for b in ('head', 'jaw', 'neck03', 'neck02'):
    for i, x in W[b]: hw[i] += x
np.save('headw.npy', np.clip(hw, 0, 1))
np.save('V_fit.npy', V); np.save('armw.npy', armw)
json.dump({'faces': bodyF}, open('faces.json', 'w'))
