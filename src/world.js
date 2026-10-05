// A complete generated planet: surface, two cloud layers, scattering atmosphere, auroras, maybe rings,
// and moons on Kepler orbits. Used for the lone planet and for every planet orbiting a star.
import * as THREE from 'three';
import { bodyMat, cloudMat, atmoMat, auroraMat, ringMat, ringPtsMat } from './materials.js';
import { ownArrays } from './shaders.js';
import { makeKind, applyKind, MOON_POOL, c, BLACK, WET, STORMY, MAGNETIC, VOLCANIC } from './gen.js';
import { Orbit, meanMotion, orbitLine } from './orbit.js';
import { pxScale } from './scene.js';
import { makeStation } from './extras.js';

// level-of-detail geometry: a world swaps to coarser spheres as it shrinks on screen
const sphere = (r, w, h) => new THREE.SphereGeometry(r, w, h);
export const LOD = {
  body: [sphere(1,256,256), sphere(1,96,64), sphere(1,32,24)],
  shell: [sphere(1,128,96), sphere(1,64,48), sphere(1,24,16)],
  atmo: [sphere(1.12,128,96), sphere(1.12,64,48), sphere(1.12,24,16)],
};
const RING_PTS_GEO = (() => {   // particles store (u across the ring, angle, height); the shader places them
  const N = 60000, pos = new Float32Array(N*3), rnd = new Float32Array(N);
  for (let i=0;i<N;i++){ pos.set([Math.random(), Math.random()*Math.PI*2, Math.random()*2-1], i*3); rnd[i] = Math.random(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos,3));
  g.setAttribute('aRand', new THREE.BufferAttribute(rnd,1));
  return g;
})();
const clone = m => ownArrays(m.clone());
const ROMAN = ['I','II','III','IV','V','VI','VII','VIII'];

// rings around a body of radius 1 (in its own space); returns the meshes and the shadow settings
function makeRings(r, inner, outer, k){
  const rings = new THREE.Mesh(new THREE.RingGeometry(inner,outer,256,1), clone(ringMat));
  rings.rotation.x = -Math.PI/2;
  const pts = new THREE.Points(RING_PTS_GEO, clone(ringPtsMat));
  pts.frustumCulled = false;   // real positions are computed in the shader
  const u = rings.material.uniforms, pu = pts.material.uniforms;
  pu.uScale = pxScale;
  u.uIn.value = inner; u.uOut.value = outer;
  u.uK.value.set(20+r()*80, 7+r()*30, 3+r()*10);
  u.uGaps.value.set(.15+r()*.6, r()<.5 ? r() : -1);
  u.uDust.value = .5+r()*.5;
  const hue = r(), tinted = r()<.35;
  u.uA.value.copy(k?.gas && !tinted ? k.snow : c(hue,tinted?.35:.15,.72));
  u.uB.value.copy(k?.gas && !tinted ? k.rock : c(hue+.05,tinted?.4:.2,.45));
  r();   // (used to be a spin of the ring in its own plane; kept so seeds stay the same)
  for (const key of ['uIn','uOut','uDust']) pu[key].value = u[key].value;
  for (const key of ['uK','uGaps','uA','uB']) pu[key].value.copy(u[key].value);
  return {rings, pts};
}
// the surface and clouds draw the rings' shadow themselves
function shadowRings(mats, rings){
  const u = rings.material.uniforms;
  for (const m of mats){
    const s = m.uniforms;
    s.uRinged.value = 1; s.uRIn.value = u.uIn.value; s.uROut.value = u.uOut.value; s.uRDust.value = u.uDust.value;
    s.uRK.value.copy(u.uK.value); s.uRGaps.value.copy(u.uGaps.value);
  }
}

function addVolcanoes(mats, kindName, x){
  const v = VOLCANIC[kindName];
  if (!v || x() >= v[0]) return 0;
  const n = v[1]+Math.floor(x()*(v[2]-v[1]+1)), dir = new THREE.Vector3();
  for (let i=0;i<n;i++){
    dir.set(x()*2-1, (x()*2-1)*.8, x()*2-1).normalize();
    const size = (.05+x()*.08)*(x() < v[3] ? 1 : -1);   // negative = dormant (no plume)
    for (const m of mats) m.uniforms.uVolc.value[i].set(dir.x, dir.y, dir.z, size);
  }
  for (const m of mats) m.uniforms.uVolcN.value = n;
  return n;
}

// r: the seed's main random stream (kept in its original order, so old seeds look the same);
// x: a second stream for everything added since (tilt, eccentricity, rivers, auroras, stations...)
export function makeWorld(r, x, kindName, {moonMax = k => k.moons, minOneMoon = true, system = false} = {}){
  const k = makeKind(kindName, r);
  const group = new THREE.Group(), axis = new THREE.Group();
  group.add(axis);
  const body = new THREE.Mesh(LOD.body[0], clone(bodyMat));
  applyKind(body.material, k, r);
  let spin = k.locked ? 0 : k.gas ? .08+r()*.1 : k.spin;
  const bu = body.material.uniforms;

  const clouds = new THREE.Mesh(LOD.shell[0], clone(cloudMat));
  clouds.scale.setScalar(1.02); clouds.renderOrder = 1;
  const cu = clouds.material.uniforms;
  cu.uSeed.value.copy(bu.uSeed.value);
  cu.uCloud.value = k.cloud; cu.uCol.value.copy(k.cloudCol);
  cu.uStretch.value = k.stretch; cu.uSwirl.value = k.swirl;
  clouds.visible = k.cloud < 1;
  for (const key of ['uCloud','uStretch','uSwirl']) bu[key].value = cu[key].value;
  bu.uCSeed.value.copy(cu.uSeed.value);
  bu.uCloudShadow.value = clouds.visible && k.cloud > -.5 ? 1 : 0;   // fully overcast worlds hide the ground anyway

  const atmo = new THREE.Mesh(LOD.atmo[0], clone(atmoMat));
  atmo.renderOrder = 3;
  const au = atmo.material.uniforms;
  au.uAtmo.value.copy(k.atmo); au.uStr.value = k.atmoStr;
  if (k.cloud < -.5) au.uH.value = .035;   // thick, hazy air on cloud worlds
  atmo.visible = k.atmo !== BLACK;
  axis.add(body, clouds, atmo);

  const w = {group, axis, body, clouds, atmo, cirrus:null, aurora:null, rings:null, ringPts:null, moons:[], station:null,
    spin, k, kindName, features:[], lines:new THREE.Group()};
  axis.add(w.lines);
  let reach = 1;
  if (r() < k.rings){
    const inner = 1.25+r()*.35, outer = inner+.4+r()*1.1;
    const {rings, pts} = makeRings(r, inner, outer, k);
    w.rings = rings; w.ringPts = pts;
    shadowRings([body.material, clouds.material], rings);
    axis.add(rings, pts);
    reach = outer;
  }

  const max = moonMax(k);
  const nMoons = Math.max(minOneMoon ? (r()<.15 ? 0 : 1) : 0, Math.floor(r()*(max+1)));   // most main planets get one
  let orbit = w.rings ? reach+.4 : 1.7;
  for (let i=0;i<nMoons;i++){
    const moonKind = MOON_POOL[Math.floor(r()*MOON_POOL.length)];
    const mesh = new THREE.Mesh(LOD.body[1], clone(bodyMat));
    const mk = makeKind(moonKind, r);
    applyKind(mesh.material, mk, r);
    const size = .1+r()*.18;
    mesh.scale.setScalar(size);
    orbit += .35+r()*.55;
    const rx = (r()-.5)*.3, ry = r()*Math.PI*2, rz = (r()-.5)*.3;   // (were a pivot's rotation; now the orbit's tilt and phase)
    const moon = {mesh, size, kindName:moonKind, k:mk, ring:null,
      orbit:new Orbit({a:orbit, e:x()<.7 ? x()*.04 : .04+x()*.1, i:Math.hypot(rx,rz), node:Math.atan2(rz,rx),
        peri:x()*Math.PI*2, M0:ry, n:meanMotion(1, orbit)})};
    mesh.material.uniforms.uSeason.value = 1;
    if (addVolcanoes([mesh.material], moonKind, x)){
      mesh.material.uniforms.uVolcCol.value.copy(moonKind==='Sulfur moon' ? c(.11,1,.6) : c(.05,1,.55));
      moon.volcanic = true;
    }
    if (x() < .05){   // a rare ringed moon
      const {rings} = makeRings(x, 1.3+x()*.2, 1.8+x()*.6, null);
      shadowRings([mesh.material], rings);
      mesh.add(rings); moon.ring = rings;
    }
    axis.add(mesh);
    w.moons.push(moon);
    reach = orbit*(1+moon.orbit.e)+size;
  }
  // shepherd moon: a tiny moonlet keeping one of the ring gaps clear
  if (w.rings && x() < .45){
    const u = w.rings.material.uniforms, a = u.uIn.value+u.uGaps.value.x*(u.uOut.value-u.uIn.value);
    const mesh = new THREE.Mesh(LOD.body[2], clone(bodyMat)), mk = makeKind(x()<.6 ? 'Icy moon' : 'Moon', x);
    applyKind(mesh.material, mk, x);
    const size = .012+x()*.012;
    mesh.scale.setScalar(size);
    axis.add(mesh);
    w.moons.push({mesh, size, kindName:'shepherd moonlet', k:mk, shepherd:true,
      orbit:new Orbit({a, n:meanMotion(1, a), M0:x()*Math.PI*2})});
  }

  // --- features rolled from the second stream ---
  // axial tilt (only for planets in a system: a lone planet is already tipped by the scene's tilt);
  // the axis keeps pointing the same way in space as the planet orbits, which gives seasons
  w.obliquity = 0;
  if (system && !k.locked){
    let ob = x()*x()*.6;
    if (x() < (kindName==='Ice giant' ? .3 : .06)) ob = .9+x()*.85;   // knocked over, like Uranus
    w.obliquity = ob;
    axis.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0), x()*Math.PI*2)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), ob));
  }
  if (!k.locked && x() < .08){ spin = -spin; w.retro = true; }   // spins backwards
  w.spin = spin;
  bu.uSeason.value = 1;
  if (kindName==='Crystal'){   // crystal worlds come in very different styles, not just different colours
    const v = Math.floor(x()*4), h = x(), set = (u, col) => bu['u'+u].value.copy(col);
    if (v===0){        // prismatic: every height a different hue
      set('Sand', c(h+.5,.6,.5)); set('Low', c(h,.75,.55)); set('Low2', c(h+.33,.75,.55));
      set('High', c(h+.66,.7,.62)); set('Rock', c(h+.15,.6,.78)); bu.uMoist.value = 1;
    } else if (v===1){ // geodes: dark rock split by glowing crystal ridges
      set('Sand', c(h,.15,.1)); set('Low', c(h,.12,.14)); set('Low2', c(h+.05,.15,.18));
      set('High', c(h,.8,.5)); set('Rock', c(h+.05,.9,.7)); bu.uRidge.value = 1; bu.uGlow.value = .6;
    } else if (v===2){ // glass seas: crystal shores around mirror-smooth liquid
      bu.uSea.value = .02+x()*.12; set('Deep', c(h+.5,.7,.14)); set('Shallow', c(h+.5,.6,.45));
    } else {           // ice-crystal spires: pale, sharp and high
      set('Sand', c(.55,.2,.75)); set('Low', c(.55,.25,.85)); set('Low2', c(.5,.3,.8));
      set('High', c(.58,.35,.92)); set('Rock', c(.6,.5,.7)); set('Snow', c(.55,.1,.98));
      bu.uRidge.value = 1; bu.uIce.value = .6+x()*.2;
    }
    bu.uFreq.value *= .7+x()*.8;
    bu.uTerrace.value = x()<.4 ? .5+x()*.5 : 0;
    bu.uWarp.value = x()*.5;
    w.features.push(['prismatic crystal','geodes','glass seas','ice-crystal spires'][v]);
  }
  if (WET.has(kindName) && x() < .85){ bu.uRivers.value = 1; w.features.push('rivers'); }
  if (STORMY.has(kindName) && clouds.visible && x() < .6){ w.lightning = cu.uLightning.value = .7+x()*.6; w.features.push('lightning storms'); }
  if (k.gas){
    const roll = x();
    const kind = kindName==='Ice giant' ? (roll<.55 ? 1 : roll<.75 ? 0 : roll<.9 ? 2 : 3)
                                        : (roll<.45 ? 0 : roll<.55 ? 1 : roll<.8 ? 2 : 3);
    bu.uStormKind.value = kind;
    if (kind===3) w.features.push('polar cyclones');
    if (kind===2) w.features.push('a string of storms');
    if (x() < (kindName==='Gas giant' ? .25 : .1)){ bu.uHex.value = 1; w.features.push('polar hexagon'); }
  }
  const nVolc = addVolcanoes([body.material, clouds.material], kindName, x);
  if (nVolc){
    bu.uVolcCol.value.copy(kindName==='Magma' ? c(.03,1,.55) : c(.06,1,.55));
    w.features.push(nVolc>1 ? 'volcanoes' : 'a volcano');
    if (!clouds.visible){ clouds.visible = true; cu.uCloud.value = 3; }   // ash plumes need the cloud layer
  }
  // high cirrus above the main cloud deck
  if (clouds.visible && k.cloud < 1 && atmo.visible && x() < .65){
    w.cirrus = new THREE.Mesh(LOD.shell[1], clone(cloudMat));
    w.cirrus.scale.setScalar(1.045); w.cirrus.renderOrder = 2;
    const iu = w.cirrus.material.uniforms;
    iu.uLayer.value = 1; iu.uSeed.value.set(x()*50, x()*50, x()*50); iu.uCol.value.copy(k.cloudCol);
    axis.add(w.cirrus);
  }
  if (MAGNETIC.has(kindName) && atmo.visible && x() < .55){
    w.aurora = new THREE.Mesh(LOD.shell[1], clone(auroraMat));
    w.aurora.scale.setScalar(k.gas ? 1.015 : 1.035); w.aurora.renderOrder = 2;
    const ru = w.aurora.material.uniforms;
    // magnetic poles usually sit a little off the spin axis; ice giants (like Uranus and Neptune) and the odd
    // other world have fields tipped right over, so their auroras turn up far from the poles
    const tipped = kindName==='Ice giant' ? x() < .7 : x() < .08;
    const mt = tipped ? .7+x()*.4 : x()*.2, ma = x()*Math.PI*2;
    ru.uMag.value.set(Math.sin(mt)*Math.cos(ma), Math.cos(mt), Math.sin(mt)*Math.sin(ma));
    ru.uOval.value = .22+x()*.22;   // how far the ring sits from the magnetic pole (bigger in a solar storm)
    const alien = kindName==='Alien' || k.gas;
    const h = alien ? x() : .36;
    ru.uA.value.copy(c(h, .9, .55)); ru.uB.value.copy(alien ? c(h+.15, .8, .6) : c(.97, .8, .55));
    ru.uStr.value = .35+x()*.4;
    axis.add(w.aurora);
    w.features.push('auroras');
  }
  // very rare: a space station (or the wreck of one) in low orbit
  const stationRoll = x();
  if (stationRoll < (k.city ? .03 : .004)){
    const derelict = !k.city || x() < .3;
    const s = makeStation(x, derelict);
    const a = Math.max(reach > 2 ? 1.3 : 1.45, 1.35)+x()*.3;
    s.orbit = new Orbit({a, i:(x()-.5)*.6, node:x()*Math.PI*2, n:meanMotion(1, a), M0:x()*Math.PI*2});
    s.group.scale.setScalar(.035);
    axis.add(s.group);
    w.station = s;
  }

  // orbit lines for the moons (in planet radii; they ride along with the planet)
  for (const m of w.moons) if (!m.shepherd) w.lines.add(orbitLine(m.orbit, 0x9fb8d8, .2));
  if (w.station) w.lines.add(orbitLine(w.station.orbit, 0xffc070, .25));
  w.lines.visible = false;

  w.reach = reach;
  w.dotColor = k.gas ? k.low.clone().lerp(k.high,.5) : k.cloud < -.5 ? k.cloudCol.clone() :
    k.low.clone().lerp(k.sea > 0 ? k.deep : k.high, .5);
  return w;
}

// place moons and the station for time t, and keep tidally locked bodies facing what they orbit
const v = new THREE.Vector3();
export function updateWorld(w, t, dt){
  w.body.rotation.y += dt*w.spin;
  w.clouds.rotation.y += dt*(w.spin+.015*Math.sign(w.spin||1));
  if (w.cirrus) w.cirrus.rotation.y += dt*(w.spin*1.05+.03);
  for (const m of w.moons){
    m.orbit.at(t, m.mesh.position);
    m.mesh.rotation.y = Math.atan2(m.mesh.position.z, -m.mesh.position.x);   // same face always towards the planet
  }
  if (w.station){
    const s = w.station;
    s.orbit.at(t, s.group.position);
    s.spin(dt);
  }
}

export function disposeWorld(w){
  w.group.traverse(o => {
    o.material?.dispose?.();
    if (o.geometry && !Object.values(LOD).flat().includes(o.geometry) && o.geometry !== RING_PTS_GEO) o.geometry.dispose();
  });
  w.group.removeFromParent();
}

// short description of a world: "Gas giant (ringed, 2 moons)"
export function describe(w){
  const extra = [];
  if (w.rings) extra.push('ringed');
  const n = w.moons.filter(m => !m.shepherd).length;
  if (n) extra.push(`${n} moon${n>1?'s':''}`);
  return w.kindName + (extra.length ? ` (${extra.join(', ')})` : '');
}
export const moonName = (planetName, i) => planetName+' '+ROMAN[i];

// pick the geometry detail for a world from how big it is on screen (in pixels)
export function lodWorld(w, px){
  const level = px > 160 ? 0 : px > 45 ? 1 : 2;
  w.body.geometry = LOD.body[level];
  w.clouds.geometry = LOD.shell[level];
  w.atmo.geometry = LOD.atmo[level];
  if (w.ringPts) w.ringPts.visible = px > 30;
  for (const m of w.moons) m.mesh.geometry = LOD.body[px*m.size > 120 ? 0 : px*m.size > 30 ? 1 : 2];
}
