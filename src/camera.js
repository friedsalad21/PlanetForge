// Camera: orbit the system or any body in it, fly smoothly between them, or fly freely (WASD + mouse).
import * as THREE from 'three';
import { camera, controls, root, renderer } from './scene.js';
import { S, L, opts, flags } from './state.js';
import { bodyPos, bodyRadius, screenRadius, lightAt } from './system.js';

export const C = {
  focus: null,      // the body we orbit (null = the whole system)
  flight: null,     // a transition in progress
  fly: false,       // free-fly mode
  speedMul: 1,      // free-fly speed (mouse wheel)
  onFocus: null,    // UI callback when the focus changes
};
const lastPos = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
const ease = t => t<.5 ? 4*t*t*t : 1-(-2*t+2)**3/2;   // ease in and out, no jumps

export function systemCenter(out){ return root.getWorldPosition(out); }
export function autoDist(){ return S.fitDist*opts.zoom*Math.max(1,.9/camera.aspect); }   // portrait screens back off further

// how far to sit from a body to frame it nicely
function viewDist(b){
  const R = bodyRadius(b);
  if (b.type==='planet'){
    const w = b.world, ring = w.rings ? w.rings.material.uniforms.uOut.value : 1.15;
    return R*ring*2.6*Math.max(1,.9/camera.aspect);
  }
  return R*({star:4, moon:3.4, station:4.5, comet:90, blackhole:10}[b.type] ?? 3)*Math.max(1,.9/camera.aspect);
}

export function flyTo(b, {dur, instant=false} = {}){
  const target0 = controls.target.clone(), dir0 = camera.position.clone().sub(target0);
  const d0 = Math.max(dir0.length(), 1e-6); dir0.normalize();
  const end = b ? bodyPos(b, new THREE.Vector3()) : systemCenter(new THREE.Vector3());
  let d1, dir1 = dir0.clone();
  if (b){
    d1 = viewDist(b);
    if (!['star','blackhole'].includes(b.type)){
      // a three-quarter view of the sunlit side, from the side we're already on
      const toSun = lightAt(end).dir.clone(), up = new THREE.Vector3(0,1,0);
      const side = new THREE.Vector3().crossVectors(up, toSun).normalize();
      if (side.dot(dir0) < 0) side.negate();
      dir1 = toSun.multiplyScalar(.7).add(side.multiplyScalar(.6)).add(up.multiplyScalar(.28)).normalize();
    }
  } else {
    d1 = autoDist();
    dir1.y = Math.max(dir1.y, .2); dir1.normalize();
  }
  if (C.fly) setFly(false, false);
  if (opts.reducedMotion) instant = true;   // cut straight there instead of flying
  const travel = target0.distanceTo(end);
  dur ??= THREE.MathUtils.clamp(1.1+.3*Math.abs(Math.log(d1/d0))+.5*Math.min(travel/(d0+d1), 3), 1.2, 4.5);
  C.focus = b;
  C.flight = instant ? null : {b, t:0, dur, target0, dir0, d0, d1, dir1, travel};
  controls.enabled = false;
  if (instant){
    camera.position.copy(end).addScaledVector(dir1, d1);
    controls.target.copy(end); lastPos.copy(end);
    finish();
  }
  C.onFocus?.(b);
}
export const systemView = opts2 => flyTo(null, opts2);

function finish(){
  C.flight = null;
  controls.enabled = !flags.wallpaper;
  const b = C.focus;
  if (b){
    const R = bodyRadius(b);
    controls.minDistance = R*(b.type==='planet' && b.world.atmo.visible ? 1.06 : b.type==='station' ? .6 : 1.05);
    controls.maxDistance = Math.max(S.fitDist*3, R*12);
  } else {
    controls.minDistance = S.minDist;
    controls.maxDistance = S.mode==='blackhole' ? 40 : Math.max(60, S.fitDist*3);   // (the lensed sky ends 50 units out)
  }
}

const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
function updateFlight(dt){
  const f = C.flight;
  f.t += dt;
  const k = Math.min(1, f.t/f.dur), e = ease(k);
  const end = f.b ? bodyPos(f.b, tmp) : systemCenter(tmp);   // the body keeps moving while we travel
  const target = tmp2.copy(f.target0).lerp(end, e);
  qb.setFromUnitVectors(f.dir0, f.dir1); qa.identity().slerp(qb, e);
  const dir = f.dir0.clone().applyQuaternion(qa);
  // log-interpolate the distance (big zoom changes feel even), and arc out a little on long hops
  const dist = Math.exp(THREE.MathUtils.lerp(Math.log(f.d0), Math.log(f.d1), e)) + f.travel*.3*Math.sin(Math.PI*e);
  camera.position.copy(target).addScaledVector(dir, dist);
  controls.target.copy(target);
  camera.lookAt(target);
  lastPos.copy(end);
  if (k >= 1) finish();
}

// --- free flight ---
export const keys = new Set();
const vel = new THREE.Vector3(), look = {x:0, y:0};
export const stick = new THREE.Vector2();   // touch joystick
export const touchBoost = {on:false};
export function addLook(dx, dy){ look.x += dx; look.y += dy; }
export function setFly(on, refocus = true){
  if (on === C.fly) return;
  C.fly = on; C.flight = null;
  document.body.classList.toggle('flying', on);
  if (on){
    C.focus = null; controls.enabled = false; vel.set(0,0,0);
    C.onFocus?.(null, 'fly');
  } else {
    if (document.pointerLockElement) document.exitPointerLock();
    controls.target.copy(camera.position).addScaledVector(camera.getWorldDirection(tmp), flyEnv.speed ? flyEnv.speed()*.5 : .5);
    if (L.level!=='system'){ controls.enabled = !flags.wallpaper; flyEnv.onExit?.(); }   // a galaxy or the universe: orbit from here
    else if (refocus){ const b = nearestBody(); if (b) flyTo(b); else systemView(); }
  }
}
function nearestSurface(){
  let d = Infinity;
  for (const b of S.bodies) d = Math.min(d, bodyPos(b, tmp).distanceTo(camera.position)-bodyRadius(b));
  return d;
}
export function nearestBody(){
  let best = null, bd = Infinity;
  for (const b of S.bodies){
    if (b.type==='comet') continue;
    const d = (bodyPos(b, tmp).distanceTo(camera.position)-bodyRadius(b))/Math.max(bodyRadius(b),.02);
    if (d < bd){ bd = d; best = b; }
  }
  return best;
}
// in a galaxy or the universe, nav.js says how fast to go (there are no surfaces to measure against)
export const flyEnv = { speed:null, onExit:null };
export function updateFly(dt){
  camera.rotateY(-look.x*.0022); camera.rotateX(-look.y*.0022);
  look.x = look.y = 0;
  const roll = (keys.has('KeyQ')?1:0)-(keys.has('KeyE')?1:0);
  if (roll) camera.rotateZ(roll*dt*1.4);
  const f = (keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)+stick.y;
  const s = (keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+stick.x;
  const u = (keys.has('KeyR')?1:0)-(keys.has('KeyC')?1:0);
  // speed follows the distance to the nearest surface: cruise between planets, creep up on a moon
  const base = (flyEnv.speed ? flyEnv.speed() : THREE.MathUtils.clamp(nearestSurface()*.9, .002, 40))*C.speedMul*(keys.has('ShiftLeft')||keys.has('ShiftRight')||touchBoost.on ? 6 : 1);
  const want = tmp.set(s, u, -f);
  if (want.lengthSq() > 1) want.normalize();
  want.multiplyScalar(base).applyQuaternion(camera.quaternion);
  vel.lerp(want, 1-Math.exp(-dt*4));
  camera.position.addScaledVector(vel, dt);
  if (flyEnv.speed) return;
  for (const b of S.bodies){   // don't fly through things
    const p = bodyPos(b, tmp2), R = bodyRadius(b)*1.01, d = camera.position.distanceTo(p);
    if (d < R) camera.position.sub(p).setLength(R).add(p);
  }
}

// --- wallpaper tour: drift from body to body ---
let tourT = 0;
export function resetTour(){ tourT = 0; }
function updateTour(dt){
  if (!flags.wallpaper || !opts.tour || C.flight || !S.bodies.length) return;
  tourT += dt;
  if (tourT < opts.tourSec) return;
  tourT = 0;
  const choices = S.bodies.filter(b => b!==C.focus && !(b.type==='moon' && b.moon.shepherd));
  if (C.focus && (Math.random() < .3 || !choices.length)) return systemView({dur:9});
  if (!choices.length) return;
  flyTo(choices[Math.floor(Math.random()*choices.length)], {dur:9});
}

// --- floating origin: keep the camera near (0,0,0) by moving the world instead ---
function floatOrigin(){
  if (camera.position.length() < 300) return;
  const off = camera.position.clone();
  root.position.sub(off); camera.position.sub(off); controls.target.sub(off); lastPos.sub(off);
  if (C.flight) C.flight.target0.sub(off);
}

// near/far planes follow the closest surface, so tiny moons and whole systems both render cleanly
function updateClip(){
  let d = Infinity;
  for (const b of S.bodies){
    const R = bodyRadius(b)*(b.type==='planet' ? 1.13 : 1);
    d = Math.min(d, bodyPos(b, tmp).distanceTo(camera.position)-R);
  }
  const near = THREE.MathUtils.clamp((isFinite(d) ? d : 1)*.35, 2e-5, .5);
  if (Math.abs(near/camera.near-1) > .05){
    camera.near = near; camera.far = Math.max(near*2e5, 120);
    camera.updateProjectionMatrix();
  }
}

export function updateCamera(dt){
  if (C.flight) updateFlight(dt);
  else if (C.fly) updateFly(dt);
  else {
    // ride along with the body we're orbiting
    const p = C.focus ? bodyPos(C.focus, tmp) : systemCenter(tmp);
    camera.position.add(tmp2.copy(p).sub(lastPos));
    controls.target.add(tmp2);
    lastPos.copy(p);
  }
  updateTour(dt);
  floatOrigin();
  updateClip();
}
// called after a new world is built
let lastAuto = null;   // the last automatic distance (see resetCamera)
// keepZoom: a new plain seed world replacing the one on screen (not arriving from a galaxy, not the wallpaper)
export function resetCamera({keepZoom = false} = {}){
  const wasFocused = !!C.focus || C.fly;
  C.flight = null; C.focus = null;
  if (C.fly) setFly(false, false);
  const dir = camera.position.clone().sub(controls.target);   // (measured from the old view's centre)
  systemCenter(lastPos);
  controls.target.copy(lastPos);
  if (dir.lengthSq() < 1e-8) dir.set(0,1.1,3.4);
  // auto-fit the new world, unless you'd zoomed away from the last automatic distance: then keep your zoom
  // (as the original single-file version did). Only from the whole-system view, and never inside the new star.
  const d = dir.length(), keep = keepZoom && !flags.wallpaper && !wasFocused && lastAuto!==null && Math.abs(d-lastAuto) > .05;
  const auto = autoDist();
  const dist = keep ? Math.max(d, S.minDist*1.05) : auto;
  if (!keep) lastAuto = auto;
  camera.position.copy(controls.target).addScaledVector(dir.normalize(), dist);
  finish();
  resetTour();
}

// --- picking: which body is under the pointer (generous, so small moons are easy to hit) ---
const proj = new THREE.Vector3();
export function pickAt(cx, cy){
  let hit = null, hitDist = Infinity, near = null, nearGap = 14;
  const rect = renderer.domElement.getBoundingClientRect();
  for (const b of S.bodies){
    bodyPos(b, proj);
    const camDist = proj.distanceTo(camera.position);
    proj.project(camera);
    if (proj.z > 1) continue;   // behind us
    const sx = (proj.x*.5+.5)*rect.width, sy = (-proj.y*.5+.5)*rect.height;
    const R = screenRadius(b, camera.position), d = Math.hypot(sx-cx, sy-cy);
    if (d <= R){ if (camDist < hitDist){ hitDist = camDist; hit = b; } }   // on the disc: the nearest one wins
    else if (d-R < nearGap){ nearGap = d-R; near = b; }                     // just missed: closest edge wins
  }
  return hit ?? near;
}
