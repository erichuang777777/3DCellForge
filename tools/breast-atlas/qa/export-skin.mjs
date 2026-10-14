// Offline QA: evaluates actual application functions, without renderer/UI side effects.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import * as acorn from 'acorn';
import * as THREE from 'three';
import {QN} from '../../../public/breast-reconstruction-atlas/compare.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const [revision='working', label=revision] = process.argv.slice(2);
const appPath='public/breast-reconstruction-atlas/app.js';
const src=revision==='working'?fs.readFileSync(appPath,'utf8'):execFileSync('git',['show',`${revision}:${appPath}`],{encoding:'utf8'});
const tree=acorn.parse(src,{ecmaVersion:'latest',sourceType:'module'});
const names=new Set(['Q_N','BASE','raycaster','resetPec','computeTargets','applyNippleRelief','envelopePoint','chestChart','chestShift','SIDES','sideFrame','CUP_D','PROFILE','idealSNN','smooth','clampN','measures','bmi','GEO','NOTCH_Y','C_X','C_Y','geomOf','rBlend','profile','breastField','bulgeOf','smax','nipBump','prepBreastRegions','subsetGeometry','BASE_STATE','implDims','implantPose','PLANE_OFF','PLANE_COVER','updateBreasts','basePointInterp','regionBasePoint','fleshOut','flattenMaleNipples','lstsq']);
let selected=tree.body.filter(n=>n.type==='FunctionDeclaration'?names.has(n.id.name):n.type==='VariableDeclaration'&&n.declarations.some(d=>names.has(d.id.name))).map(n=>src.slice(n.start,n.end)).join('\n');
// New geometry modules are evaluated as authored when the application imports one.
const ctx=vm.createContext({THREE,console,QN,structuredClone});
for(const n of tree.body.filter(n=>n.type==='ImportDeclaration'&&/(geometry|surface)/.test(n.source.value))) {
 const moduleUrl=new URL(n.source.value,new URL('file://'+process.cwd()+'/public/breast-reconstruction-atlas/'));
 let moduleText=fs.readFileSync(moduleUrl,'utf8');
 const mod=await import('data:text/javascript;base64,'+Buffer.from(moduleText).toString('base64'));
 for(const s of n.specifiers)ctx[s.local.name]=mod[s.imported.name];
}
vm.runInContext(selected+'\nthis.api={setBase:x=>BASE=x,computeTargets,PROFILE,BASE_STATE,flattenMaleNipples,fleshOut,prepBreastRegions,subsetGeometry,updateBreasts};',ctx);
const bytes=fs.readFileSync('public/breast-reconstruction-atlas/chest.glb');
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
gltf.scene.updateMatrixWorld(true);let geom;
gltf.scene.traverse(o=>{if(o.isMesh&&o.name==='skin'){geom=o.geometry.clone();geom.applyMatrix4(o.matrixWorld);}});
if(!geom)throw Error('Skin not found');if(!geom.index)geom.setIndex(Array.from({length:geom.attributes.position.count},(_,i)=>i));
const {api}=ctx; if (process.env.PROFILE_JSON) Object.assign(api.PROFILE, JSON.parse(process.env.PROFILE_JSON)); api.flattenMaleNipples(geom);api.fleshOut(geom);
const base=Float32Array.from(geom.attributes.position.array);
const inst={skin:{geometry:geom,userData:{base},material:{uniforms:{uPaddle:{value:new THREE.Vector4()}}}},regions:api.prepBreastRegions(geom),byName:new Map(),key:{}};
for(const k of ['R','L'])for(const [part,r] of [['fat_',1],['gland_',.86]])inst.byName.set(part+k,{geometry:api.subsetGeometry(geom,inst.regions[k],r),userData:{}});
if(process.env.IMPLANT_JSON) {
 api.setBase({curves:JSON.parse(fs.readFileSync('public/breast-reconstruction-atlas/meta.json','utf8')).curves});
 gltf.scene.traverse(o=>{ if(o.isMesh && o.name.startsWith('pecmaj')) { const g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);inst.byName.set(o.name,new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}))); } });
 api.computeTargets(inst);
}
const state=structuredClone(api.BASE_STATE); if(process.env.IMPLANT_JSON || process.env.STATE_JSON) { const patch=JSON.parse(process.env.IMPLANT_JSON || process.env.STATE_JSON); for(const [k,v] of Object.entries(patch)) state[k]={...state[k],...v}; } if(process.env.NO_AREOLA) state.R.areola=state.L.areola=false; api.updateBreasts(inst,state);
const output={label,revision,sourceSha256:createHash('sha256').update(src).digest('hex'),experiments:Object.fromEntries(['PROFILE_JSON','NO_AREOLA','IMPLANT_JSON','STATE_JSON'].filter(k=>process.env[k]).map(k=>[k,process.env[k]])),profile:api.PROFILE,positions:Array.from(geom.attributes.position.array),base:Array.from(base),indices:Array.from(geom.index.array),normals:Array.from(geom.attributes.normal.array),geo:inst.geo,nipple:Object.fromEntries(Object.entries(inst.nipple).map(([k,v])=>[k,v?.toArray()])),regions:Object.fromEntries(Object.entries(inst.regions).map(([k,r])=>[k,{center:r.c.toArray(),count:r.idx.length,chartMisses:r.chestAt?.misses ?? null}]))};
fs.mkdirSync('/tmp/3dcell-qa',{recursive:true});fs.writeFileSync(`/tmp/3dcell-qa/${label}.json`,JSON.stringify(output));console.log(JSON.stringify({label,vertices:base.length/3,faces:geom.index.count/3,geo:inst.geo,nipple:output.nipple}));
