# 讓女性皮膚包住 Z-Anatomy 的肌肉與骨骼:內部頂點穿出皮膚處,皮膚沿法線往外推並平滑
import json, os, numpy as np, sys
from scipy.spatial import cKDTree
sys.path.insert(0, '.'); import glb
V = np.load('V_fit.npy'); armw = np.load('armw.npy'); F = json.load(open('faces.json'))['faces']
Y0, Y1 = 0.47, 1.5
hw = np.load('headw.npy')
# 保留到頸部,去掉頭部與下顎
keepF = [f for f in F if all(Y0 < V[i, 1] < Y1 and hw[i] < 0.3 for i in f)]
def normals(V, F):
    N = np.zeros_like(V)
    for f in F:
        for k in range(len(f)):
            a, b, c = V[f[k - 1]], V[f[k]], V[f[(k + 1) % len(f)]]
            N[f[k]] += np.cross(b - a, c - b)
    n = np.linalg.norm(N, axis=1, keepdims=True); n[n == 0] = 1
    return N / n
Z = glb.load(os.environ.get('ATLAS_GLB', 'chest.glb'))
skip = ('skin', 'nodes', 'omentum', 'stomach', 'liver', 'colon', 'linea_alba')
inner = np.vstack([P for k, (P, I) in Z.items() if not k.startswith(skip)])
used = np.array(sorted({i for f in keepF for i in f}))
P0 = None
for it in range(14):
    N = normals(V, keepF)
    tree = cKDTree(V[used])
    d, j = tree.query(inner, k=1, distance_upper_bound=0.06)
    ok = np.isfinite(d)
    push = np.zeros(len(V))
    vi = used[j[ok]]; pen = np.einsum('ij,ij->i', inner[ok] - V[vi], N[vi]) + 0.004
    np.maximum.at(push, vi, np.clip(pen, 0, 0.008))  # 每次最多推 8 mm,多次迭代
    # 以 2.5 cm 半徑的高斯加權平均平滑位移(避免尖刺)
    P = V[used]; t2 = cKDTree(P); pu = push[used]; sm = np.zeros(len(used))
    nb = t2.query_ball_point(P, 0.025)
    for q, lst in enumerate(nb):
        if not lst: continue
        dd = np.linalg.norm(P[lst] - P[q], axis=1); w = np.exp(-(dd / 0.012) ** 2)
        sm[q] = max((w * pu[lst]).sum() / w.sum() * 2.0, pu[q] * 0.5)
    V[used] += N[used] * sm[:, None]
    print('iter', it, 'pen verts', (pu > 0).sum(), 'max', round(pu.max() * 1000, 1))
# 最後做兩次輕微的拉普拉斯平滑(只動被推過的區域附近)
# 輸出:軀幹與手臂分開
def write(path, faces):
    idx = sorted({i for f in faces for i in f}); m = {o: n for n, o in enumerate(idx)}
    with open(path, 'w') as o:
        for i in idx: o.write('v %.5f %.5f %.5f\n' % tuple(V[i]))
        for f in faces: o.write('f ' + ' '.join(str(m[i] + 1) for i in f) + '\n')
    print(path, len(idx), len(faces))
arm = [f for f in keepF if np.mean([armw[i] for i in f]) >= 0.5]
trunk = [f for f in keepF if np.mean([armw[i] for i in f]) < 0.5]
write('skin_trunk.obj', trunk + arm)  # 軀幹與手臂同一個網格,細分後才不會在肩膀裂開
