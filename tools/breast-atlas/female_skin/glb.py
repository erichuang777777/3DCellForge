import json, struct, numpy as np
def load(path):
    b=open(path,'rb').read(); n=struct.unpack('<I',b[12:16])[0]; j=json.loads(b[20:20+n]); bin_=b[20+n+8:]
    out={}
    def acc(i,dt):
        a=j['accessors'][i]; bv=j['bufferViews'][a['bufferView']]; off=bv.get('byteOffset',0)+a.get('byteOffset',0)
        comp={'SCALAR':1,'VEC3':3}[a['type']]; t={5126:np.float32,5125:np.uint32,5123:np.uint16}[a['componentType']]
        return np.frombuffer(bin_,dtype=t,count=a['count']*comp,offset=off).reshape(-1,comp)
    # node transforms assumed identity except translation/rotation? apply matrix if present
    for nd in j['nodes']:
        if 'mesh' not in nd: continue
        m=j['meshes'][nd['mesh']]; p=m['primitives'][0]
        P=acc(p['attributes']['POSITION'],0).astype(float).copy()
        if 'translation' in nd: P+=np.array(nd['translation'])
        I=acc(p['indices'],0).reshape(-1,3) if 'indices' in p else None
        out[nd.get('name',m.get('name'))]=(P,I)
    return out
