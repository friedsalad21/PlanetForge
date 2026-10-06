// The galaxy view: one galaxy's glow, its stars as points of light, its nebulae, and markers for the stars you've visited.
// Everything is in the galaxy's own frame, in galaxy units (GU, about 50 light years).
import * as THREE from 'three';
import { pxScale, renderer } from './scene.js';
import { galUniforms, setGal, makeVolumeMat, makeStarPointsMat, makeImpostorMat, makeNebulaVolMat, markerMat } from './galaxyshaders.js';
import { makeStars, STYPES, starName, nebulaName } from './galaxymodel.js';

export const galaxyScene = new THREE.Scene();
export const LY_PER_GU = 50;

const u = galUniforms();
const volMat = makeVolumeMat(u);
const volume = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), volMat);
volume.frustumCulled = false;
volMat.vertexShader = volMat.vertexShader.replace('vP=position/uScale', 'vP=position*2.2');   // a unit sphere scaled to 2.2 radii
const ptsMat = makeStarPointsMat(u);
const points = new THREE.Points(new THREE.BufferGeometry(), ptsMat);
points.frustumCulled = false;
// the galaxy seen from far away: the same picture the universe view draws (so switching between them doesn't show)
export const selfImpostor = makeImpostorMesh(1);
const nebGroup = new THREE.Group();
const visitedMat = markerMat.clone(), hoverMat = markerMat.clone();
hoverMat.uniforms.uColor.value.setRGB(1, .9, .6); hoverMat.uniforms.uSize.value = 22;
const visited = new THREE.Points(new THREE.BufferGeometry(), visitedMat);
const hoverMark = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3)), hoverMat);
for (const o of [visited, hoverMark]) o.frustumCulled = false;
hoverMark.visible = false;
// the galaxy keeps the tilt it has in the universe, so moving between the two views needs no turn of the camera
export const galRoot = new THREE.Group();
galaxyScene.add(galRoot);
galRoot.add(selfImpostor, volume, points, nebGroup, visited, hoverMark);
volume.renderOrder = 0; points.renderOrder = 2; nebGroup.renderOrder = 1;

export const G = { g:null, stars:null, names:new Map(), force:null };
const cache = new Map();   // galaxies already generated this session (stars take a moment to sample)

// an instanced quad per galaxy (used here for one, and by the universe for all of them)
export function makeImpostorMesh(n){
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1,-1,0, 1,-1,0, 1,1,0, -1,1,0]), 3));
  geo.setIndex([0,1,2, 0,2,3]);
  const at = (name, k) => geo.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(n*k), k));
  at('aPos',3); at('aQuat',4); at('aP1',4); at('aP2',4); at('aP3',4); at('aCore',3); at('aArm',3); at('aHii',3); at('aHide',1); at('aSeed',1);
  geo.instanceCount = n;
  const m = new THREE.Mesh(geo, makeImpostorMat());
  m.frustumCulled = false;
  return m;
}
// write galaxy g into instance i (pos in the mesh's units, R its radius in the same units)
export function setImpostor(mesh, i, g, pos, quat, R){
  const a = mesh.geometry.attributes;
  a.aPos.setXYZ(i, pos.x, pos.y, pos.z);
  a.aQuat.setXYZW(i, quat.x, quat.y, quat.z, quat.w);
  a.aP1.setXYZW(i, g.t, g.arms, g.pitch, g.sharp);
  a.aP2.setXYZW(i, g.twist, g.hR, g.hz, g.rb);
  a.aP3.setXYZW(i, g.bar, g.flat, R, g.dust);
  a.aCore.setXYZ(i, g.core.r, g.core.g, g.core.b); a.aArm.setXYZ(i, g.arm.r, g.arm.g, g.arm.b); a.aHii.setXYZ(i, g.hii.r, g.hii.g, g.hii.b);
  a.aSeed.setX(i, g.nseed);
  for (const k in a) a[k].needsUpdate = true;
}

export function showGalaxy(g, quat){
  galRoot.quaternion.copy(quat); galRoot.updateMatrixWorld(true);
  if (G.g?.seed===g.seed) return;
  let entry = cache.get(g.seed);
  if (!entry){ entry = {stars:makeStars(g)}; cache.set(g.seed, entry); }
  G.g = g; G.stars = entry.stars; G.names = entry.names ??= new Map();
  setGal(u, g);
  volume.scale.setScalar(2.2*g.R);
  // stars
  const {N, pos, type} = G.stars, lum = new Float32Array(N), col = new Float32Array(N*3);
  for (let i=0;i<N;i++){
    const t = STYPES[type[i]];
    lum[i] = t.lum*(.7+.6*((i*2654435761>>>0)/4294967296));   // a little spread within each type
    col[i*3] = t.col.r; col[i*3+1] = t.col.g; col[i*3+2] = t.col.b;
  }
  G.lum = lum;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aLum', new THREE.BufferAttribute(lum, 1));
  geo.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  points.geometry.dispose(); points.geometry = geo;
  // nebulae
  for (const m of [...nebGroup.children]){ m.material.dispose(); m.removeFromParent(); }
  for (const n of g.nebulae){
    const mat = makeNebulaVolMat();
    mat.uniforms.uA.value.copy(n.a); mat.uniforms.uB.value.copy(n.b); mat.uniforms.uSeed.value.set(n.seed%97, n.seed%89, n.seed%83);
    const m = new THREE.Mesh(NEB_GEO, mat);
    m.position.fromArray(n.pos); m.scale.setScalar(n.rad); m.frustumCulled = false; m.userData.neb = n;
    nebGroup.add(m);
  }
  setImpostor(selfImpostor, 0, g, new THREE.Vector3(), new THREE.Quaternion(), g.R);
}
const NEB_GEO = new THREE.SphereGeometry(1, 32, 16);

export function setVisited(list){
  const arr = new Float32Array(list.length*3);
  list.forEach((i, k) => arr.set(G.stars.pos.subarray(i*3, i*3+3), k*3));
  visited.geometry.dispose();
  visited.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(arr, 3));
}
export function setHover(i){
  hoverMark.visible = i!=null;
  if (i==null) return;
  const p = hoverMark.geometry.attributes.position;
  p.array.set(placePos(i)); p.needsUpdate = true;
}
export const placeWorld = (key, out = new THREE.Vector3()) => galRoot.localToWorld(out.fromArray(placePos(key)));
// position (GU, in the galaxy's own frame) of a star index or a nebula ('n3')
export function placePos(key){
  if (typeof key==='string' && key[0]==='n') return G.g.nebulae[+key.slice(1)].pos;
  const i = typeof key==='string' ? +key.slice(1) : key;
  return [G.stars.pos[i*3], G.stars.pos[i*3+1], G.stars.pos[i*3+2]];
}

// --- per frame: fades by distance, and the camera in the galaxy's normalized units ---
const tmp = new THREE.Vector3(), lc = new THREE.Vector3();
export function updateGalaxy(camera, steps, px = pxScale.value){
  const g = G.g; if (!g) return;
  galRoot.worldToLocal(lc.copy(camera.position));   // the camera in the galaxy's own frame
  const D = lc.length(), R = g.R;
  u.uCam.value.copy(lc).divideScalar(R);
  let w = THREE.MathUtils.smoothstep(D, 4*R, 6.5*R);          // 0: close (volume), 1: far (impostor)
  if (G.force!=null) w = G.force;                              // (for checking that the two match)
  volMat.uniforms.uFade.value = 1-w; volume.visible = w < 1;
  selfImpostor.material.uniforms.uFade.value = w; selfImpostor.visible = w > 0;
  selfImpostor.material.uniforms.uPx.value = pxScale.value;
  selfImpostor.material.uniforms.uCamL.value.copy(lc);
  ptsMat.uniforms.uFade.value = 1-THREE.MathUtils.smoothstep(D, 3*R, 7*R); points.visible = D < 7*R;
  ptsMat.uniforms.uPx.value = px;
  ptsMat.uniforms.uMaxPx.value = px===pxScale.value ? 96 : 14;   // (smaller in a star system's sky, which is a low-res cube map)
  ptsMat.uniforms.uFloor.value = .0;
  volMat.uniforms.uSteps.value = steps;
  // like an eye adjusting: seen from outside the galaxy is bright, but from inside the disk its light is spread
  // over the whole sky, so add contrast there (the band stays bright, the rest goes dark)
  const out = Math.max(Math.abs(lc.y)/R, Math.hypot(lc.x, lc.z)/R-1.15, 0);
  const t = THREE.MathUtils.smoothstep(out, .01, .7);
  const core = Math.exp(-(((D/R)/(3*g.rb))**2)/2);   // deep in the bulge, light comes from every side
  volMat.uniforms.uExposure.value = Math.exp(THREE.MathUtils.lerp(Math.log(.3), Math.log(.9), t))*(1-.9*core);
  volMat.uniforms.uGamma.value = THREE.MathUtils.lerp(1.9, 1, t);
  u.uHii.value.copy(g.hii).multiplyScalar(THREE.MathUtils.lerp(.25, 1, t));   // the thin knots alias from inside the disk; the nebulae take over there
  for (const m of nebGroup.children){
    const mu = m.material.uniforms;
    mu.uCamL.value.copy(lc).sub(m.position).divideScalar(m.scale.x);
    const d = mu.uCamL.value.length();
    mu.uFade.value = THREE.MathUtils.smoothstep(d, 400, 60)*1;    // far ones are part of the glow already
    m.visible = mu.uFade.value > 0;
    mu.uSteps.value = Math.max(12, Math.round(steps*.6));
  }
  visitedMat.uniforms.uFade.value = hoverMat.uniforms.uFade.value = 1-w;
  visited.visible = w < 1;
}

// --- picking: the brightest star near the pointer (or a nebula) ---
const pv = new THREE.Matrix4();
export function pickGalaxy(cx, cy, camera, rect){
  const g = G.g; if (!g) return null;
  pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(galRoot.matrixWorld);
  const e = pv.elements, {N, pos} = G.stars, lum = G.lum, W = rect.width, H = rect.height;
  const k = .06*pxScale.value, pr = renderer.getPixelRatio();   // glow size in device pixels, as in the shader
  let best = null, bestScore = 0;
  if (camera.position.length() > 7*g.R) return null;
  for (let i=0;i<N;i++){
    const x = pos[i*3], y = pos[i*3+1], z = pos[i*3+2];
    const w = e[3]*x+e[7]*y+e[11]*z+e[15];
    if (w <= 0) continue;
    const sx = ((e[0]*x+e[4]*y+e[8]*z+e[12])/w*.5+.5)*W, sy = (.5-(e[1]*x+e[5]*y+e[9]*z+e[13])/w*.5)*H;
    const dx = sx-cx, dy = sy-cy;
    if (dx > 40 || dx < -40 || dy > 40 || dy < -40) continue;
    const glow = k*Math.sqrt(lum[i])/w, I = Math.min(1, (glow/1.6)**4);
    if (I < .03) continue;
    const reach = Math.max(7, glow/pr*1.2), d2 = dx*dx+dy*dy;
    if (d2 > reach*reach) continue;
    const score = I/(1+Math.sqrt(d2)/5);
    if (score > bestScore){ bestScore = score; best = i; }
  }
  if (best!=null) return {kind:'star', key:'s'+best, i:best};
  // nebulae: anywhere on their disc
  let neb = null, nd = Infinity;
  for (const m of nebGroup.children){
    m.getWorldPosition(tmp);
    const dist = camera.position.distanceTo(tmp);
    tmp.project(camera);
    if (tmp.z > 1) continue;
    const sx = (tmp.x*.5+.5)*W, sy = (.5-tmp.y*.5)*H;
    const R = Math.max(8, m.scale.x*.7*pxScale.value/pr/dist);
    const d = Math.hypot(sx-cx, sy-cy);
    if (d < R && dist < nd){ nd = dist; neb = m.userData.neb; }
  }
  return neb ? {kind:'nebula', key:'n'+neb.i, n:neb} : null;
}

// --- what to call things ---
export function placeInfo(key){
  const g = G.g;
  if (key[0]==='n'){
    const n = g.nebulae[+key.slice(1)];
    return {name:nebulaName(g, n), type:'nebula', kind:'nebula', n, pos:n.pos};
  }
  const i = +key.slice(1);
  let name = G.names.get(i);
  if (!name){ name = starName(g, i); G.names.set(i, name); }
  const t = STYPES[G.stars.type[i]].name;
  return {name, type:t, kind:'star', i, pos:placePos(i)};
}
export function lyFromCore(pos){ return Math.round(Math.hypot(...pos)*LY_PER_GU/100)*100; }
