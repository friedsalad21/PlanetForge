// The universe: galaxies scattered in clusters and filaments, each one a seed. Drawn as one instanced mesh
// of camera-facing quads (galaxy.js makeImpostorMesh). The same galaxies, seen from inside one of them,
// are the backdrop of the galaxy view (deepScene). Universe units (UU): a big galaxy is about 1 UU across its disk.
import * as THREE from 'three';
import { pxScale } from './scene.js';
import { rngFor } from './gen.js';
import { mix64, galaxyParams } from './galaxymodel.js';
import { makeImpostorMesh, setImpostor } from './galaxy.js';
import { markerMat } from './galaxyshaders.js';

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
  // filaments join each cluster to its nearest neighbours, so they make a web rather than lines across everything
  for (const c of clusters) c.near = clusters.filter(o => o!==c).sort((a, b) => a.p.distanceTo(c.p)-b.p.distanceTo(c.p)).slice(0, 3);
  const filament = () => { const a = clusters[Math.floor(r()*clusters.length)]; return [a.p, a.near[Math.floor(r()*3)].p]; };
  for (let gi=0; gi<N; gi++){
    let p;
    if (gi===0) p = new THREE.Vector3();
    else {
      const k = r();
      if (k < .5){ const c = clusters[Math.floor(r()*clusters.length)]; p = c.p.clone().add(new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(c.s)); }
      else if (k < .8){   // filaments: strung between two clusters
        const [a, b] = filament();
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
  // the cosmic web: faint glowing gas and countless galaxies too small to visit, along the same filaments and clusters
  UNI.web?.geometry.dispose(); UNI.web?.removeFromParent();
  const W = 40000, wp = new Float32Array(W*3), wc = new Float32Array(W*3), cl = new THREE.Color(), v = new THREE.Vector3();
  for (let i=0;i<W;i++){
    const k = r();
    if (k < .4){ const c = clusters[Math.floor(r()*clusters.length)]; v.set(gauss(), gauss(), gauss()).multiplyScalar(c.s*1.3).add(c.p); }
    else if (k < .92){ const [a, b] = filament(); v.copy(a).lerp(b, r()).add(new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(3+r()*5)); }
    else v.copy(inBall(480));
    wp.set([v.x, v.y, v.z], i*3);
    cl.setHSL(r()<.65 ? .6+r()*.1 : .06+r()*.05, .35, .5); wc.set([cl.r, cl.g, cl.b], i*3);
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.BufferAttribute(wp, 3)); wg.setAttribute('aCol', new THREE.BufferAttribute(wc, 3));
  const web = new THREE.Points(wg, webMat);
  web.frustumCulled = false; web.renderOrder = -1;
  universeScene.add(web);
  Object.assign(UNI, {U, gals, mesh, deep, web});
  refreshVisitedGalaxies();
  return UNI;
}
const webMat = new THREE.ShaderMaterial({
  transparent:true, depthTest:false, depthWrite:false, blending:THREE.AdditiveBlending,
  uniforms:{ uPx:{value:600} },
  vertexShader:`attribute vec3 aCol; uniform float uPx; varying vec3 vC;
  void main(){
    vec4 mv=modelViewMatrix*vec4(position,1.); float d=max(-mv.z,.01);
    float px=6.*uPx/d;                                // each puff is several units across: together a soft haze
    vC=aCol*.012*min(1.,px/4.)*smoothstep(4.,20.,d);  // faint, and gone when you're right in it
    gl_PointSize=clamp(px,2.,96.);
    gl_Position=projectionMatrix*mv;
  }`,
  fragmentShader:`varying vec3 vC; void main(){ float r2=dot(gl_PointCoord*2.-1.,gl_PointCoord*2.-1.); if(r2>1.) discard;
    gl_FragColor=vec4(vC*exp(-r2*3.),1.);
    #include <colorspace_fragment>
  }`,
});

// --- markers: the galaxy under the pointer, and galaxies you've been to ---
const hoverMat = markerMat.clone(), visitMat = markerMat.clone();
hoverMat.uniforms.uColor.value.setRGB(1, .9, .6);
const hoverMark = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3)), hoverMat);
const visitMarks = new THREE.Points(new THREE.BufferGeometry(), visitMat);
for (const o of [hoverMark, visitMarks]){ o.frustumCulled = false; o.renderOrder = 3; universeScene.add(o); }
hoverMark.visible = false;
export function setGalaxyHover(o, camera){
  hoverMark.visible = !!o;
  if (!o) return;
  hoverMark.geometry.attributes.position.array.set([o.pos.x, o.pos.y, o.pos.z]);
  hoverMark.geometry.attributes.position.needsUpdate = true;
  hoverMat.uniforms.uSize.value = Math.min(160, Math.max(22, o.Ru*2.6*pxScale.value/camera.position.distanceTo(o.pos)));
}
const GKEY = 'planetforge.galaxies';
export function markGalaxyVisited(gi){
  try {
    const all = JSON.parse(localStorage.getItem(GKEY) || '[]'), k = UNI.U+'.'+gi;
    if (!all.includes(k)){ all.push(k); localStorage.setItem(GKEY, JSON.stringify(all)); }
  } catch {}
  refreshVisitedGalaxies();
}
function refreshVisitedGalaxies(){
  let list = [];
  try { list = JSON.parse(localStorage.getItem(GKEY) || '[]'); } catch {}
  const mine = list.filter(k => k.startsWith(UNI.U+'.')).map(k => +k.split('.')[1]).filter(gi => UNI.gals[gi]);
  const arr = new Float32Array(mine.length*3);
  mine.forEach((gi, i) => arr.set(UNI.gals[gi].pos.toArray(), i*3));
  visitMarks.geometry.dispose();
  visitMarks.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(arr, 3));
}

// the sky from inside galaxy gi: every other galaxy, as seen from gi's centre
export function setDeepFrom(gi){
  const o = UNI.gals[gi], hide = UNI.deep.geometry.attributes.aHide;
  hide.array.fill(0); hide.setX(gi, 1); hide.needsUpdate = true;
  UNI.deep.position.copy(o.pos).negate();
  UNI.deep.updateMatrixWorld(true);
  const mu = UNI.deep.material.uniforms;
  mu.uCamL.value.copy(o.pos);   // the sky camera sits at the galaxy's centre
  mu.uPx.value = pxScale.value; mu.uBright.value = .3; mu.uCull.value = 5;
}

export function updateUniverse(camera){
  const mu = UNI.mesh.material.uniforms;
  mu.uCamL.value.copy(camera.position); mu.uPx.value = pxScale.value;
  webMat.uniforms.uPx.value = pxScale.value;
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
