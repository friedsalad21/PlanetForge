// The universe: galaxies scattered in clusters and filaments, each one a seed. Drawn as one instanced mesh
// of camera-facing quads (galaxy.js makeImpostorMesh). The same galaxies, seen from inside one of them,
// are the backdrop of the galaxy view (deepScene). Universe units (UU): a big galaxy is about 1 UU across its disk.
import * as THREE from 'three';
import { pxScale } from './scene.js';
import { rngFor } from './gen.js';
import { mix64, galaxyParams } from './galaxymodel.js';
import { makeImpostorMesh, setImpostor } from './galaxy.js';

export const universeScene = new THREE.Scene();
export const deepScene = new THREE.Scene();   // the sky seen from inside a galaxy
export const UNI = { U:null, gals:[], mesh:null, deep:null };
export const GU_PER_UU = 1000;
export const galaxySeed = (U, gi) => mix64(U, gi);

// far, far away: faint smudges of galaxies too distant to visit, behind everything
{
  const n = 5000, pos = new Float32Array(n*3), col = new Float32Array(n*3), v = new THREE.Vector3(), cl = new THREE.Color();
  for (let i=0;i<n;i++){
    v.randomDirection().multiplyScalar(4000); pos.set([v.x, v.y, v.z], i*3);
    cl.setHSL(Math.random()<.7 ? .08+Math.random()*.06 : .6, .4, .3+Math.random()**4*.4).multiplyScalar(.5);
    col.set([cl.r, cl.g, cl.b], i*3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const far = () => new THREE.Points(g, new THREE.PointsMaterial({size:1.2, sizeAttenuation:false, vertexColors:true, depthWrite:false}));
  universeScene.add(far()); deepScene.add(far());
}

export function makeUniverse(U){
  if (UNI.U===U) return UNI;
  for (const m of [UNI.mesh, UNI.deep]) if (m){ m.geometry.dispose(); m.material.dispose(); m.removeFromParent(); }
  const r = rngFor(mix64(U, 0xC0FFEEn));
  const gauss = () => Math.sqrt(-2*Math.log(r()+1e-12))*Math.cos(2*Math.PI*r());
  const inBall = R => { const v = new THREE.Vector3(); do v.set(r()*2-1, r()*2-1, r()*2-1); while (v.lengthSq() > 1); return v.multiplyScalar(R); };
  const N = 800, gals = [];
  const clusters = Array.from({length:26}, (_, i) => ({p:i===0 ? new THREE.Vector3(70, -15, -40) : inBall(420), s:8+r()*22}));
  for (let gi=0; gi<N; gi++){
    let p;
    if (gi===0) p = new THREE.Vector3();
    else {
      const k = r();
      if (k < .5){ const c = clusters[Math.floor(r()*clusters.length)]; p = c.p.clone().add(new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(c.s)); }
      else if (k < .8){   // filaments: strung between two clusters
        const a = clusters[Math.floor(r()*clusters.length)].p, b = clusters[Math.floor(r()*clusters.length)].p;
        p = a.clone().lerp(b, r()).add(new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(5));
      } else p = inBall(450);
      // keep a little room around every galaxy, and a lot around home, so its sky isn't crowded
      for (let tries=0; tries<6 && gals.some(o => o.pos.distanceToSquared(p) < 9); tries++) p.add(inBall(4));
      if (p.length() < 30) p.setLength(30+r()*40);
    }
    const seed = galaxySeed(U, gi), g = galaxyParams(seed, U===1n && gi===0);
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(r()*Math.PI*2, r()*Math.PI*2, r()*Math.PI*2));
    if (gi===0) quat.setFromEuler(new THREE.Euler(.5, 0, .25));
    gals.push({gi, seed, g, pos:p, quat, Ru:g.R/GU_PER_UU});
  }
  const mesh = makeImpostorMesh(N), deep = makeImpostorMesh(N);
  for (const o of gals){ setImpostor(mesh, o.gi, o.g, o.pos, o.quat, o.Ru); setImpostor(deep, o.gi, o.g, o.pos, o.quat, o.Ru); }
  universeScene.add(mesh); deepScene.add(deep);
  Object.assign(UNI, {U, gals, mesh, deep});
  return UNI;
}

// the sky from inside galaxy gi: every other galaxy, as seen from gi's centre
export function setDeepFrom(gi){
  const o = UNI.gals[gi], hide = UNI.deep.geometry.attributes.aHide;
  hide.array.fill(0); hide.setX(gi, 1); hide.needsUpdate = true;
  UNI.deep.position.copy(o.pos).negate();
  UNI.deep.updateMatrixWorld(true);
  const mu = UNI.deep.material.uniforms;
  mu.uCamL.value.copy(o.pos);   // the sky camera sits at the galaxy's centre
  mu.uPx.value = pxScale.value; mu.uBright.value = .3;
}

export function updateUniverse(camera){
  const mu = UNI.mesh.material.uniforms;
  mu.uCamL.value.copy(camera.position); mu.uPx.value = pxScale.value;
}

// --- picking: the nearest galaxy under the pointer ---
const tmp = new THREE.Vector3();
export function pickUniverse(cx, cy, camera, rect, pr){
  let best = null, bd = Infinity;
  for (const o of UNI.gals){
    tmp.copy(o.pos).project(camera);
    if (tmp.z > 1 || tmp.z < -1) continue;
    const sx = (tmp.x*.5+.5)*rect.width, sy = (.5-tmp.y*.5)*rect.height, dist = camera.position.distanceTo(o.pos);
    const R = Math.max(7, o.Ru*1.3*pxScale.value/pr/dist), d = Math.hypot(sx-cx, sy-cy);
    if (d < R && dist < bd){ bd = dist; best = o; }
  }
  return best;
}
