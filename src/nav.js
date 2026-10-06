// Moving between the three scales: the universe (galaxies), a galaxy (its stars) and a star system.
//  - universe ⇄ galaxy is seamless: the galaxy keeps its tilt and both views draw it the same way from afar,
//    so the camera just carries on (×1000 in scale) when you get close enough or back far enough away.
//  - galaxy ⇄ system is a warp jump: the stars stretch into streaks, wash out, and the system is there.
// Links: #123 is a plain seed (as always), #u1 the universe, #g5 a galaxy, #g5.s1234 the system of star 1234,
// #g5.n3 the young system inside nebula 3, and #g5.s1234-p2m1 a body in it. (#u2.g5… for other universes.)
import * as THREE from 'three';
import { S, L, opts, flags } from './state.js';
import { camera, controls, skyCamera, skyScene, scene, setScenes, warpPass, renderer, pxScale } from './scene.js';
import { build, refreshSky } from './system.js';
import { C, resetCamera, flyTo, systemView, autoDist, flyEnv, updateFly, setFly } from './camera.js';
import { galaxyScene, galRoot, G, renderVolume, withFullVolume, showGalaxy, updateGalaxy, pickGalaxy, placeInfo, placeWorld, setHover, setVisited, lyFromCore } from './galaxy.js';
import { universeScene, deepScene, UNI, makeUniverse, setDeepFrom, updateUniverse, pickUniverse, GU_PER_UU, setGalaxyHover, markGalaxyVisited } from './universe.js';
import { starSeed, nebulaSeed, STYPES } from './galaxymodel.js';
import { settings, quality } from './settings.js';
import { makeBandMat } from './galaxyshaders.js';

export const NAV = { onInfo:null, onLevel:null };   // set by ui.js
flyEnv.onExit = () => info();   // leaving free flight in a galaxy or the universe: say where we are again
const emptyScene = new THREE.Scene();
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
const ease = t => t<.5 ? 4*t*t*t : 1-(-2*t+2)**3/2;

// --- addresses ---
export function parseAddr(h){
  h = (h ?? '').replace(/^#/, '');
  let m = /^(\d+)(?:-([a-z0-9]+))?$/.exec(h);
  if (m) return {kind:'plain', seed:BigInt(m[1]) & ((1n<<64n)-1n), body:m[2] ?? null};
  m = /^(?:u(\d+))?(?:\.?g(\d+)(?:\.([sn]\d+))?)?(?:-([a-z0-9]+))?$/.exec(h);
  if (!m || (!m[1] && !m[2])) return null;
  const U = m[1] ? BigInt(m[1]) : 1n;
  if (!m[2]) return {kind:'universe', U};
  return {kind:m[3] ? 'place' : 'galaxy', U, gi:+m[2], place:m[3] ?? null, body:m[4] ?? null};
}
export function addr(bodyId){
  const u = L.U===1n ? '' : 'u'+L.U+'.';
  if (L.level==='universe') return 'u'+L.U;
  if (L.level==='galaxy') return u+'g'+L.gi;
  if (L.gi!=null) return u+'g'+L.gi+'.'+L.place+(bodyId ? '-'+bodyId : '');
  return S.seed+(bodyId ? '-'+bodyId : '');
}
const depth = () => history.state?.d ?? 0;
function commit(push = true){
  if (flags.wallpaper) return;
  const a = '#'+addr(C.focus?.id);
  if (location.hash===a) return;
  if (push) history.pushState({d:depth()+1}, '', a); else history.replaceState({d:depth()}, '', a);
  NAV.onLevel?.();
}

// --- the warp jump ---
const W = { phase:null, t:0, mid:null, inDur:.7, outDur:1 };
export const warping = () => !!W.phase;
export function warp(mid, {inDur = .7, outDur = 1.1} = {}){
  if (opts.reducedMotion){ mid(); return; }   // a straight cut
  Object.assign(W, {phase:'in', t:0, mid, inDur, outDur});
  warpPass.enabled = true;
}
function updateWarp(dt){
  if (!W.phase) return;
  W.t += dt;
  const u = warpPass.uniforms;
  if (W.phase==='in'){
    const k = Math.min(1, W.t/W.inDur);
    u.uAmt.value = k*k; u.uFlash.value = THREE.MathUtils.smoothstep(k, .55, 1)*.95;
    if (k >= 1){ const f = W.mid; W.phase = 'out'; W.t = 0; f(); }
  } else {
    const k = Math.min(1, W.t/W.outDur);
    u.uAmt.value = (1-k)**2; u.uFlash.value = (1-THREE.MathUtils.smoothstep(k, 0, .45))*.95;
    if (k >= 1){ W.phase = null; warpPass.enabled = false; }
  }
}

// --- camera flights in the galaxy and universe views ---
let F = null;   // the flight in progress
function flyCam(target, dist, {dir, dur, done} = {}){
  const t0 = controls.target.clone(), off = camera.position.clone().sub(t0);
  const d0 = Math.max(off.length(), 1e-6), dir0 = off.divideScalar(d0);
  const dir1 = (dir ?? dir0).clone().normalize();
  const travel = t0.distanceTo(target);
  dur ??= THREE.MathUtils.clamp(1.2+.35*Math.abs(Math.log(dist/d0))+.4*Math.min(travel/(d0+dist), 3), 1.4, 5);
  F = {t:0, dur, t0, t1:target.clone(), d0, d1:dist, dir0, dir1, travel, done};
  controls.enabled = false;
  if (opts.reducedMotion){ F.t = F.dur; updateFlightCam(0); }
}
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
function updateFlightCam(dt){
  const f = F;
  f.t += dt;
  const k = Math.min(1, f.t/f.dur), e = ease(k);
  const target = tmp.copy(f.t0).lerp(f.t1, e);
  qb.setFromUnitVectors(f.dir0, f.dir1); qa.identity().slerp(qb, e);
  const dir = tmp2.copy(f.dir0).applyQuaternion(qa);
  const dist = Math.exp(THREE.MathUtils.lerp(Math.log(f.d0), Math.log(f.d1), e)) + Math.min(f.travel*.25, f.d0+f.d1)*Math.sin(Math.PI*e);
  camera.position.copy(target).addScaledVector(dir, dist);
  controls.target.copy(target);
  camera.lookAt(target);
  if (k >= 1){ F = null; controls.enabled = !flags.wallpaper; f.done?.(); }
}

// --- switching what's drawn ---
function setLevel(level){
  L.level = level;
  if (level!=='system' && C.fly) setFly(false, false);
  if (level==='system'){
    setScenes(skyScene, scene);
    controls.zoomSpeed = 1;
    Object.assign(controls, {enablePan:false, zoomToCursor:false});
    flyEnv.speed = null;
  } else {
    setScenes(level==='galaxy' ? deepScene : emptyScene, level==='galaxy' ? galaxyScene : universeScene);
    controls.zoomSpeed = 2;
    // explore: scroll zooms towards whatever is under the pointer, right-drag (or Shift-drag) pans
    Object.assign(controls, {enablePan:true, screenSpacePanning:true, zoomToCursor:true});
    C.focus = null; C.flight = null;
    camera.near = level==='galaxy' ? .02 : .002; camera.far = 1e6; camera.updateProjectionMatrix();
    flyEnv.speed = level==='galaxy' ? () => THREE.MathUtils.clamp(nearStarDist()*.8, .5, G.g.R*.8)
      : () => THREE.MathUtils.clamp(camera.position.distanceTo(controls.target)*.4, .2, 200);
  }
  skyCamera.far = 10000; skyCamera.updateProjectionMatrix();
  setHover(null); setGalaxyHover(null);
  NAV.onLevel?.();
}
function nearStarDist(){ return Math.max(1, Math.min(camera.position.distanceTo(controls.target), camera.position.length()*.15)); }
function galaxyLimits(){
  controls.minDistance = 1.2; controls.maxDistance = G.g.R*9;
  controls.enabled = !flags.wallpaper;
}

// --- the universe ---
export function enterUniverse({instant = false} = {}){
  makeUniverse(L.U);
  const from = L.level==='galaxy' ? UNI.gals[L.gi] : null;
  if (from){   // carry the camera out: same direction, 1000 times smaller
    camera.position.multiplyScalar(1/GU_PER_UU).add(from.pos);
    controls.target.multiplyScalar(1/GU_PER_UU).add(from.pos);
  }
  setLevel('universe');
  controls.minDistance = .3; controls.maxDistance = 1800; controls.enabled = !flags.wallpaper;
  const home = from ?? UNI.gals[L.gi ?? 0];
  L.gi = home.gi;   // remembered, so "zoom in" knows where we came from
  if (from){ flyCam(from.pos, Math.max(camera.position.distanceTo(from.pos)*4, 45), {dur:2.4}); }
  else {
    controls.target.copy(home.pos);
    camera.position.copy(home.pos).add(tmp.set(.35, .45, 1).normalize().multiplyScalar(instant ? 160 : 8*home.Ru));
    if (!instant) flyCam(home.pos, 160, {dur:3});
  }
  commit();
  info();
}
function universeClick(cx, cy){
  const o = pickUniverse(cx, cy, camera, renderer.domElement.getBoundingClientRect(), renderer.getPixelRatio());
  if (o) return flyToGalaxy(o);
  flyCam(controls.target.clone(), Math.min(camera.position.distanceTo(controls.target)*2.5, 900), {dur:2});
}
function flyToGalaxy(o){
  // end up looking at its disk from about 40° off its axis, on the side we're already on
  const n = tmp.set(0, 1, 0).applyQuaternion(o.quat);
  const cur = camera.position.clone().sub(o.pos).normalize();
  if (n.dot(cur) < 0) n.negate();
  const dir = n.multiplyScalar(.8).add(cur.multiplyScalar(.6)).normalize();
  L.gi = o.gi;
  flyCam(o.pos, 6.8*o.Ru, {dir, done:() => enterGalaxy(o.gi, {fromUniverse:true})});
}

// --- a galaxy ---
export function useGalaxy(gi){
  makeUniverse(L.U);
  const o = UNI.gals[gi];
  showGalaxy(o.g, o.quat);
  setDeepFrom(gi);
  L.gi = gi;
  refreshVisited();
  if (!flags.wallpaper) markGalaxyVisited(gi);
  return o;
}
export function enterGalaxy(gi, {fromUniverse = false, star = null, instant = false} = {}){
  const o = UNI.gals[gi] ?? (makeUniverse(L.U), UNI.gals[gi]);
  if (fromUniverse){   // carry the camera in
    camera.position.sub(o.pos).multiplyScalar(GU_PER_UU);
    controls.target.sub(o.pos).multiplyScalar(GU_PER_UU);
  }
  useGalaxy(gi);
  L.place = null;
  setLevel('galaxy');
  galaxyLimits();
  const R = o.g.R;
  if (fromUniverse) flyCam(new THREE.Vector3(), 3.2*R, {dur:2.6});
  else if (star){   // coming out of a star system: start right next to its star and pull back
    const p = placeWorld(star);
    controls.target.copy(p);
    const dir = tmp.copy(p).normalize().multiplyScalar(-.5).add(tmp2.set(0, 1, 0).applyQuaternion(o.quat)).normalize();
    camera.position.copy(p).addScaledVector(dir, 2.5);
    camera.lookAt(p);
    setHover(star[0]==='s' ? +star.slice(1) : null);
    flyCam(p, star[0]==='n' ? 160 : 70, {dur:3.2});
  } else {
    controls.target.set(0, 0, 0);
    const dir = tmp.set(0, .75, 1).normalize().applyQuaternion(o.quat);
    camera.position.copy(dir).multiplyScalar(instant ? 3.2*R : 6.5*R);
    camera.lookAt(0, 0, 0);
    if (!instant) flyCam(new THREE.Vector3(), 3.2*R, {dur:2.6});
  }
  commit();
  info();
}
// the place under the pointer: fly to it, then warp in
let pending = null;
function galaxyClick(cx, cy){
  const hit = pickGalaxy(cx, cy, camera, renderer.domElement.getBoundingClientRect());
  if (hit) return visit(hit.key);
  // empty space: back out a step (a region, then the whole galaxy)
  const D = camera.position.distanceTo(controls.target), R = G.g.R;
  if (controls.target.lengthSq() > 1 && D < R*.4) flyCam(controls.target.clone(), Math.min(D*6, R*.6), {dur:1.8});
  else flyCam(new THREE.Vector3(), 3.2*R, {dur:2.4});
  setHover(null);
}
export function visit(key){
  const p = placeWorld(key), pi = placeInfo(key);
  pending = key;
  setHover(key[0]==='s' ? +key.slice(1) : null);
  info(pi);
  const close = pi.kind==='nebula' ? pi.n.rad*1.2 : 2.2;
  flyCam(p, close, {done:() => { if (pending===key) warp(() => enterSystem(L.gi, key)); }});
}

// --- a star system in a galaxy ---
export function enterSystem(gi, key, {body = null, push = true} = {}){
  pending = null;
  if (F) F = null;
  const o = useGalaxy(gi);
  const pi = placeInfo(key), g = o.g;
  const seed = key[0]==='n' ? nebulaSeed(g, pi.n.i) : starSeed(g, pi.i);
  const force = pi.kind==='nebula' ? {mode:'star', star:'protostar', name:pi.name, nebula:{a:pi.n.a, b:pi.n.b}}
    : pi.type==='supermassive black hole' ? {mode:'blackhole', supermassive:true, name:pi.name}
    : pi.type==='black hole' ? {mode:'blackhole', name:pi.name}
    : {mode:'star', star:pi.type, name:pi.name};
  L.place = key;
  build(seed, force);
  setLevel('system');
  renderBand(placeWorld(key));
  resetCamera();
  NAV.onLevel?.();
  const b = body && S.bodies.find(b => b.id===body);
  if (b) flyTo(b, {instant:true});
  else if (!opts.reducedMotion){   // arrive from further out and glide in
    const t = controls.target;
    camera.position.sub(t).multiplyScalar(2.6).add(t);
    systemView({dur:2.6});
  }
  markVisited(key);
  commit(push);
}
// G: up a level
export function up(){
  if (warping()) return;
  if (L.level==='system'){
    if (C.fly) setFly(false, false);
    const gi = L.gi ?? 0, star = L.gi!=null ? L.place : null;
    warp(() => { useGalaxy(gi); enterGalaxy(gi, {star}); });
  } else if (L.level==='galaxy'){
    const R = G.g.R;
    flyCam(new THREE.Vector3(), 7.2*R, {dir:camera.position.clone().normalize().lengthSq() ? camera.position.clone().normalize() : undefined,
      dur:2.2, done:() => enterUniverse()});
  }
}
// Space / New: somewhere new at this level
export function newPlace(){
  if (warping()) return;
  if (L.level==='universe'){ flyToGalaxy(UNI.gals[Math.floor(Math.random()*UNI.gals.length)]); return; }
  const key = randomStar();
  if (L.level==='galaxy') visit(key);
  else warp(() => enterSystem(L.gi, key));
}
function randomStar(){
  const {N, type} = G.stars;
  for (let k=0;k<50;k++){
    const i = 1+Math.floor(Math.random()*(N-1));
    if (STYPES[type[i]].lum >= .4 || k > 30) return 's'+i;
  }
  return 's1';
}
// Esc: back out
export function zoomOut(){
  if (L.level==='galaxy') galaxyClick(-1e5, -1e5);
  else if (L.level==='universe') flyCam(controls.target.clone(), 160, {dur:2});
}

// --- the Milky Way of a star system: the galaxy drawn from where its star is, once, into the sky ---
let bandRT = null, bandCam = null, bandMesh = null;
function renderBand(p){
  bandRT ??= new THREE.WebGLCubeRenderTarget(matchMedia('(pointer:coarse)').matches ? 256 : 512, {type:THREE.HalfFloatType});
  bandCam ??= new THREE.CubeCamera(.5, 1e6, bandRT);
  if (!bandMesh){
    bandMesh = new THREE.Mesh(new THREE.SphereGeometry(140, 32, 16), makeBandMat(bandRT.texture));
    skyScene.add(bandMesh);
  }
  bandCam.position.copy(p);
  galaxyScene.add(bandCam);
  bandCam.updateMatrixWorld(true);
  updateGalaxy(bandCam, 64, bandRT.width/2);   // (a cube face is 90° wide)
  setHover(null);
  withFullVolume(() => bandCam.update(renderer, galaxyScene));
  bandCam.removeFromParent();
  bandMesh.visible = true;
  if (S.mode==='blackhole') refreshSky();
}
export function plainSystem(){   // a plain seed: no galaxy around it
  L.gi = null; L.place = null; pending = null; F = null;
  if (bandMesh) bandMesh.visible = false;
  if (L.level!=='system') setLevel('system');
  NAV.onLevel?.();
}

// --- visited stars, remembered in the browser ---
const VKEY = 'planetforge.visited';
function visitedList(){ try { return JSON.parse(localStorage.getItem(VKEY) || '{}'); } catch { return {}; } }
function markVisited(key){
  if (key[0]!=='s' || flags.wallpaper) return;
  const all = visitedList(), k = L.U+'.'+L.gi, list = all[k] ?? [];
  const i = +key.slice(1);
  if (!list.includes(i)){ list.push(i); if (list.length > 500) list.shift(); }
  all[k] = list;
  try { localStorage.setItem(VKEY, JSON.stringify(all)); } catch {}
  refreshVisited();
}
function refreshVisited(){ setVisited((visitedList()[L.U+'.'+L.gi] ?? []).filter(i => i < G.stars.N)); }

// --- what's on screen ---
export function info(pi){
  const a = {};
  if (L.level==='universe'){
    a.name = L.U===1n ? 'The universe' : 'Universe '+L.U;
    a.meta = [`${UNI.gals.length} galaxies in clusters and filaments`];
    a.seed = 'universe '+L.U;
    a.hint = 'click a galaxy to fly into it · drag to look around · scroll to zoom · ? for help';
  } else if (L.level==='galaxy'){
    const g = G.g;
    if (pi){
      a.name = pi.name;
      a.meta = [pi.kind==='nebula' ? 'Nebula: a star nursery' : pi.type[0].toUpperCase()+pi.type.slice(1),
        `${lyFromCore(pi.pos).toLocaleString('en')} light years from the core`];
      a.seed = 'in '+g.name;
    } else {
      a.name = g.name[0].toUpperCase()+g.name.slice(1);
      a.meta = [g.label, `${G.stars.N.toLocaleString('en')} stars to visit`];
      if (g.nebulae.length) a.meta.push(`${g.nebulae.length} nebulae`);
      a.seed = `galaxy ${L.gi} · seed ${g.seed}`;
    }
    a.hint = 'click a star or nebula to fly there · click empty space to back out · G for the universe · ? for help';
  }
  NAV.onInfo?.(a);
}
// the "in …" bit of a star system's seed line
export function context(){
  if (L.gi==null || !G.g) return '';
  return ` · ${L.place[0]==='n' ? 'nebula' : 'star'} ${L.place.slice(1)} in ${G.g.name}`;
}

// --- pointer ---
export function click(cx, cy){
  if (warping()) return;
  if (L.level==='galaxy') galaxyClick(cx, cy);
  else if (L.level==='universe') universeClick(cx, cy);
}
export function hoverAt(cx, cy){
  const rect = renderer.domElement.getBoundingClientRect();
  if (L.level==='galaxy'){
    const hit = pickGalaxy(cx, cy, camera, rect);
    if (!pending) setHover(hit?.kind==='star' ? hit.i : null);
    if (!hit) return null;
    const pi = placeInfo(hit.key);
    return pi.name+' · '+(pi.kind==='nebula' ? 'nebula' : pi.type);
  }
  if (L.level==='universe'){
    const o = pickUniverse(cx, cy, camera, rect, renderer.getPixelRatio());
    setGalaxyHover(o, camera);
    return o ? o.g.name[0].toUpperCase()+o.g.name.slice(1)+' · '+o.g.label.toLowerCase() : null;
  }
  return null;
}

// --- per frame, outside a star system ---
let tourT = 0;
export function navFrame(dt){
  updateWarp(dt);
  if (L.level==='system'){ tourSystem(dt); return false; }
  if (F) updateFlightCam(dt);
  else if (C.fly) updateFly(dt);
  else controls.update();
  const steps = (settings.quality==='auto' ? quality.auto : settings.quality/100) < .6 ? 28 : 40;
  if (L.level==='galaxy'){
    // zoomed well out: the view drifts back to centre on the galaxy, so you're never stuck circling one far star
    if (!F && !C.fly){
      const D = camera.position.distanceTo(controls.target), k = THREE.MathUtils.smoothstep(D, .5*G.g.R, 2.5*G.g.R);
      if (k > 0) controls.target.lerp(tmp.set(0, 0, 0), Math.min(1, k*dt*1.5));
    }
    updateGalaxy(camera, steps);
    renderVolume(camera);
    // backed far enough out: carry on into the universe
    if (!F && !C.fly && !W.phase && camera.position.length() > 8.4*G.g.R) enterUniverse();
  } else {
    updateUniverse(camera);
    // close enough to a galaxy: carry on into it
    if (!F && !C.fly && !W.phase){
      let o = null, best = Infinity;   // whichever galaxy we've got right up to
      for (const g of UNI.gals){ const d = camera.position.distanceTo(g.pos)/g.Ru; if (d < best){ best = d; o = g; } }
      if (o && best < 6.5){ L.gi = o.gi; controls.target.copy(o.pos); enterGalaxy(o.gi, {fromUniverse:true}); }
    }
  }
  tourGalaxy(dt);
  return true;
}

// --- wallpaper tour: drift around the galaxy, now and then dive into a system and come back out ---
function tourGalaxy(dt){
  if (!flags.wallpaper || !opts.tour || F || W.phase || L.level!=='galaxy') return;
  tourT += dt;
  if (tourT < opts.tourSec) return;
  tourT = 0;
  const R = G.g.R, k = Math.random();
  if (k < .25) visit(randomStar());
  else if (k < .55) flyCam(new THREE.Vector3(), 3.2*R, {dir:tmp.set(Math.random()-.5, .4+Math.random()*.6, Math.random()-.5).normalize(), dur:9});
  else { const p = placeWorld(randomStar()); flyCam(p, 40+Math.random()*R*.3, {dur:9}); }
}
let sysT = 0;
function tourSystem(dt){
  if (!flags.wallpaper || !opts.tour || L.gi==null || W.phase){ sysT = 0; return; }
  sysT += dt;
  if (sysT > opts.tourSec*3){ sysT = 0; up(); }
}
export function resetTours(){ tourT = sysT = 0; }
