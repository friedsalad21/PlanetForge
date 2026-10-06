// Builds a world from its seed (a lone planet, a star system or a black hole), keeps it moving, and lights it.
import * as THREE from 'three';
import { S, opts } from './state.js';
import { scene, skyScene, tilt, root, camera, renderer, SUN, sunSprite, CORONA_TEX, SOFT_TEX, keyLight, starLight, pxScale } from './scene.js';
import { starMat, nebulaMat, blackHoleMat, dotMat } from './materials.js';
import { rngFor, c, WHITE, KIND_POOL, SUN_POOL, STAR_POOL, STAR_TYPES, STAR_PHYS, EXOTIC_STARS, ROGUE_POOL, NOT_WORLD,
  makeName } from './gen.js';
import { makeWorld, disposeWorld, describe, updateWorld, moonName, lodWorld } from './world.js';
import { Orbit, meanMotion, visMass, orbitLine } from './orbit.js';
import { makeBelt, makeComet, makeDyson, makeShell, makeDustDisk, makePulsar } from './extras.js';

const STAR_GEO = new THREE.SphereGeometry(1,128,128);
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), q = new THREE.Quaternion();
tilt.add(S.orbitLines);

// the second random stream: everything added after the original generator (so old seeds keep their worlds)
const extraRng = seed => rngFor(seed ^ 0x9e3779b97f4a7c15n);

function pickStar(r, pool){
  const name = pool[Math.floor(r()*pool.length)];
  return starOfType(name, r);
}
function starOfType(name, r){
  const [h,s,l,size] = STAR_TYPES[name];
  return {name, col:c(h+(r()-.5)*.03, s, l+(r()-.5)*.06), size:size*(.85+r()*.3)};
}

function makeStar(St, r){
  const mesh = new THREE.Mesh(STAR_GEO, starMat.clone());
  const corona = new THREE.Sprite(new THREE.SpriteMaterial({map:CORONA_TEX, blending:THREE.AdditiveBlending, depthWrite:false}));
  corona.scale.setScalar(4.4); corona.material.color.copy(St.col);
  mesh.add(corona);
  mesh.scale.setScalar(St.size);
  const u = mesh.material.uniforms;
  u.uSeed.value.set(r()*50,r()*50,r()*50);
  u.uHot.value.copy(St.col);
  u.uCool.value.copy(St.col).lerp(c(.02,1,.3),.6);
  const [mass, lum] = STAR_PHYS[St.name];
  tilt.add(mesh);
  return {...St, mesh, corona, mass, lum, light:St.col.clone().lerp(WHITE,.45), bright:1};
}

const NEB_HUES = [[.98,.75,.48],[.95,.6,.55],[.52,.65,.45],[.6,.7,.5],[.64,.6,.55],[.07,.7,.5],[.75,.55,.5],[.9,.55,.55]];
function nebulaCol(h){ const [hh,s,l] = NEB_HUES[Math.floor(h*NEB_HUES.length)]; return c(hh+(h*NEB_HUES.length%1-.5)*.04, s, l); }

// --- body registry: everything the camera can visit ---
function addBody(b){ b.id ??= 'b'+S.bodies.length; S.bodies.push(b); return b; }
export function bodyRadius(b){ return b.obj.getWorldScale(tmp).x*b.localR; }
export function bodyPos(b, out){ return b.obj.getWorldPosition(out); }

function clearSystem(){
  for (const w of S.worlds) disposeWorld(w);
  for (const s of S.stars){ s.mesh.material.dispose(); s.corona.material.dispose(); s.mesh.removeFromParent(); }
  const drop = o => { if (!o) return; o.traverse(n => { n.geometry?.dispose?.(); n.material?.dispose?.(); }); o.removeFromParent(); };
  drop(S.belt); drop(S.dyson?.group); drop(S.pulsar?.group); drop(S.bh); drop(S.disk);
  for (const cm of S.comets) drop(cm.group);
  for (const sh of S.shells) drop(sh);
  for (const l of [...S.orbitLines.children]){ l.geometry.dispose(); l.removeFromParent(); }
  Object.assign(S, {worlds:[], stars:[], bodies:[], comets:[], shells:[], belt:null, dyson:null, pulsar:null, bh:null, disk:null,
    finds:[], rogue:false});
  root.position.set(0,0,0);
}

// ---------------------------------------------------------------------------------------------------
// o: what a galaxy has already decided about this place (see nav.js): {mode, star, name, supermassive, nebula}
let force = {};
export function build(seed, o = {}){
  clearSystem();
  S.seed = seed;
  force = o;
  const r = rngFor(seed), x = extraRng(seed);
  const pick = a => a[Math.floor(r()*a.length)];
  const roll = r();
  S.mode = o.mode ?? (roll<.7 ? 'planet' : roll<.9 ? 'star' : 'blackhole');
  S.minDist = 1.15;
  sunSprite.visible = S.mode==='planet';
  keyLight.intensity = S.mode==='planet' ? 3 : 0;
  starLight.intensity = S.mode==='star' ? 4 : 0;

  let extent;
  if (S.mode==='star') extent = buildStarSystem(r, x, pick);
  else if (S.mode==='blackhole') extent = buildBlackHole(r, x);
  else extent = buildPlanet(r, x, pick);

  tilt.rotation.z = r()*.45;
  nebulaMat.uniforms.uSeed.value.set(r()*50,r()*50,r()*50);
  // the colours real nebulae come in (hydrogen red and pink, oxygen teal, reflection blue, dusty orange,
  // violet where they mix), not any hue at all: the same two rolls as before, so seeds keep their worlds
  const hA = r(), hB = r();
  nebulaMat.uniforms.uA.value.copy(nebulaCol(hA)); nebulaMat.uniforms.uB.value.copy(nebulaCol(hB));
  nebulaMat.userData.density = .3+r()*1.2;
  if (o.mode) nebulaMat.userData.density *= .12;   // in a galaxy the galaxy's own band is the backdrop
  if (S.stars.some(s => s.name==='protostar')) nebulaMat.userData.density = 1.6+x();   // young stars sit in thick nebulae
  if (o.nebula){
    nebulaMat.uniforms.uA.value.copy(o.nebula.a); nebulaMat.uniforms.uB.value.copy(o.nebula.b);
    nebulaMat.userData.density = 2.2;
  }
  nebulaMat.uniforms.uDensity.value = nebulaMat.userData.density*opts.nebula;
  S.fitDist = Math.min(22, Math.max(3.6, extent*1.25+1));
  S.sysName = makeName(r, S.mode==='planet');
  if (o.name) S.sysName = o.name;
  nameBodies();
  S.rarity = rarity(S.finds);
  if (S.mode==='blackhole') refreshSky();
  for (const l of [S.orbitLines, ...S.worlds.map(w => w.lines)]) l.visible = S.showOrbits;
  updateSystem(0);   // put everything where it is right now, so a link can open straight onto any body
  root.updateMatrixWorld(true);
}

// --- a lone planet under a distant sun (or, rarely, a rogue planet with no sun at all) ---
function buildPlanet(r, x, pick){
  const St = pickStar(r, SUN_POOL);
  S.sunCol.copy(St.col).lerp(WHITE,.45);
  sunSprite.material.color.copy(St.col);
  sunSprite.scale.setScalar(8+St.size*10);
  let kindName = pick(KIND_POOL);
  S.rogue = x() < .04;
  if (S.rogue){
    kindName = ROGUE_POOL[Math.floor(x()*ROGUE_POOL.length)];
    S.sunCol.setRGB(.022,.026,.042);   // only faint starlight from the galaxy
    sunSprite.visible = false;
  }
  const w = makeWorld(r, x, kindName);
  if (S.rogue){ w.body.material.uniforms.uGlow.value = Math.max(w.k.glow, .25); }
  tilt.add(w.group);
  S.worlds.push(w);
  addBody({type:'planet', obj:w.body, localR:1, world:w, id:'p0'});
  addMoons(w, 'p0');

  const {kindName:kn, k} = w, nMoons = w.moons.filter(m => !m.shepherd).length;
  S.bits = [NOT_WORLD.has(kn) ? kn : kn+' world', nMoons ? `${nMoons} moon${nMoons>1?'s':''}` : 'no moons'];
  if (w.rings) S.bits.push('ringed');
  if (k.locked) S.bits.push('tidally locked');
  if (k.city) S.bits.push('inhabited');
  if (w.station) S.bits.push(w.station.derelict ? 'a derelict station in orbit' : 'a space station in orbit');
  S.bits.push(S.rogue ? 'a rogue planet, drifting between the stars' : `orbiting ${/^[aeiou]/i.test(St.name) ? 'an' : 'a'} ${St.name}`);
  S.finds.push(['planet', .7], S.rogue ? ['rogue', .04] : [kn, KIND_POOL.filter(n => n===kn).length/KIND_POOL.length]);
  worldFinds(w, 1);
  return w.reach;
}

function addMoons(w, pid){
  w.moons.forEach((m, i) => addBody({type:'moon', obj:m.mesh, localR:1, moon:m, world:w, id:pid+'m'+i}));
  if (w.station) addBody({type:'station', obj:w.station.group, localR:1.3, world:w, station:w.station, id:pid+'s'});
}
// chances are per world, so in a system with n planets each is n times likelier to turn up somewhere
function worldFinds(w, n){
  const add = (label, p) => S.finds.push([label, Math.min(1, p*n)]);
  if (w.rings && !w.k.gas) add('rings', w.k.rings);
  if (w.station) add(w.station.derelict ? 'derelict' : 'station', w.k.city ? .03 : .004);
  if (w.moons.some(m => m.ring)) add('ringed moon', .05*w.moons.length);
  if (w.k.gas && w.body.material.uniforms.uHex.value) add('hexagon', .2*.3);
  if (w.obliquity > .9) add('tipped over', .07);
}

// --- a star system ---
function buildStarSystem(r, x, pick){
  const A = pickStar(r, STAR_POOL);
  let exotic = null;
  if (force.star){   // the galaxy already showed this star: arrive at the same kind of star
    if (force.star!==A.name) Object.assign(A, starOfType(force.star, x));
    if (EXOTIC_STARS.includes(force.star)) exotic = force.star;
  }
  else if (A.name!=='neutron star' && x() < .1){
    exotic = EXOTIC_STARS[Math.floor(x()*EXOTIC_STARS.length)];
    Object.assign(A, starOfType(exotic, x));
  }
  const isBinary = A.name!=='neutron star' && r()<.3;
  const B = isBinary ? pickStar(r, SUN_POOL) : null;
  const sA = makeStar(A, r);
  S.stars.push(sA);
  let reach = A.size;
  if (isBinary){
    const sB = makeStar(B, r);
    S.stars.push(sB);
    const sep = A.size+B.size+.5+r()*.8, M = sA.mass+sB.mass;
    // the two stars swing round their shared centre of mass on ellipses; the heavier one moves less
    const e = Math.min(x()*.4, 1-(A.size+B.size+.25)/sep);
    const rel = new Orbit({a:sep, e:Math.max(e,0), peri:x()*Math.PI*2, M0:x()*Math.PI*2, n:meanMotion(visMass(M), sep)});
    sA.rel = sB.rel = rel; sA.share = -sB.mass/M; sB.share = sA.mass/M;
    reach = Math.max(-sA.share*rel.apo+A.size, sB.share*rel.apo+B.size);
    for (const s of [sA, sB]){
      const own = new Orbit({...rel, a:rel.a*Math.abs(s.share), M0:rel.M0+(s.share<0?Math.PI:0)});
      S.orbitLines.add(orbitLine(own, 0xffd27f, .25));
    }
    S.finds.push(['binary', .3]);
  }
  S.minDist = reach+.15;
  if (A.name==='neutron star'){
    r(); r();   // (used to roll beams; kept so seeds stay the same)
    sA.mesh.material.uniforms.uCool.value.copy(A.col).multiplyScalar(.8);   // white-hot, no sunspots
    sA.corona.material.map = SOFT_TEX; sA.corona.scale.setScalar(40); sA.corona.material.color.copy(c(.6,.8,.5));
    S.pulsar = makePulsar(x, c(.6,.6,.9));
    sA.mesh.add(S.pulsar.group);
    S.pulsar.group.scale.setScalar(1/A.size);
  }
  if (A.name==='neutron star') S.finds.push(['neutron star', 1/13]);
  const Mtot = S.stars.reduce((m,s) => m+s.mass, 0), Mvis = visMass(Mtot);
  // exotic stars
  if (exotic==='Cepheid variable'){
    const period = 8+x()*10;
    sA.pulse = t => { const p = Math.sin(t/period*Math.PI*2); sA.mesh.scale.setScalar(A.size*(1+.07*p)); sA.bright = 1+.3*p; };
  }
  if (exotic) S.finds.push([exotic, .1/3]);
  // very rare: a Dyson swarm or shell around the main star
  if (!exotic && !['neutron star','brown dwarf'].includes(A.name) && x() < .012){
    const R = reach*1.7+.35;
    S.dyson = makeDyson(x, R);
    tilt.add(S.dyson.group);
    reach = R+.3;
    S.finds.push([S.dyson.shell ? 'Dyson shell' : 'Dyson swarm', .012]);
  }

  const n = 1+Math.floor(r()*5), beltAfter = r()<.5 ? Math.floor(r()*(n+1)) : -1;
  let cursor = reach+.5;   // the inner edge of free space, moving outwards as planets are placed
  const planetOrbits = [];
  for (let i=0;i<=n;i++){
    if (i===beltAfter){
      const bw = .25+r()*.3; cursor += .4+bw;
      S.belt = makeBelt(r, cursor, bw); S.belt.userData.n = meanMotion(Mvis, cursor);
      tilt.add(S.belt); cursor += bw;
    }
    if (i===n) break;
    // every planet is a full world of its own (clouds, rings, moons), shrunk to fit in the system
    const w = makeWorld(r, x, pick(KIND_POOL), {moonMax: k => Math.min(k.moons, k.gas ? 3 : 2), minOneMoon:false, system:true});
    const size = w.k.gas ? .2+r()*.15 : .08+r()*.12, extent = w.reach*size;
    const gap = .3+r()*.4;
    const rx = (r()-.5)*.2, ry = r()*Math.PI*2, rz = (r()-.5)*.2;
    const e = x()<.65 ? x()*.07 : .07+x()*.18;
    const a = (cursor+gap+extent)/(1-e);   // periapsis clears the previous orbit's farthest point
    w.orbit = new Orbit({a, e, i:Math.hypot(rx,rz), node:Math.atan2(rz,rx), peri:x()*Math.PI*2, M0:ry, n:meanMotion(Mvis, a)});
    w.group.scale.setScalar(size);
    tilt.add(w.group);
    S.orbitLines.add(orbitLine(w.orbit));
    S.worlds.push(w);
    planetOrbits.push(a);
    addBody({type:'planet', obj:w.body, localR:1, world:w, id:'p'+(S.worlds.length-1)});
    addMoons(w, 'p'+(S.worlds.length-1));
    worldFinds(w, n);
    cursor = w.orbit.apo+extent;
  }

  // comets on long, steep ellipses that dive in close to the star
  const nComets = x()<.45 ? (x()<.3 ? 2 : 1) : 0;
  for (let i=0;i<nComets;i++){
    const qd = reach+.4+x()*1.5, Q = cursor*(1+x()*.8)+1, a = (qd+Q)/2;
    let inc = x()*1.1; if (x()<.15) inc = Math.PI-inc;   // some go round the wrong way
    const orbit = new Orbit({a, e:(Q-qd)/(Q+qd), i:inc, node:x()*Math.PI*2, peri:x()*Math.PI*2, M0:x()*Math.PI*2, n:meanMotion(Mvis, a)});
    const cm = makeComet(x, orbit);
    tilt.add(cm.group); S.comets.push(cm);
    S.orbitLines.add(orbitLine(orbit, 0x9fe8ff, .16));
    addBody({type:'comet', obj:cm.nucleus, localR:1, comet:cm, id:'c'+i});
  }
  if (nComets) S.finds.push(['comet', .45]);

  // a far companion star: a wide binary, or a trinary if the centre is already a pair
  let wide = null;
  if (A.name!=='neutron star' && x() < .12){
    const C = pickStar(x, SUN_POOL.filter(n => !['blue giant','red giant'].includes(n)));
    const sC = makeStar(C, x);
    const a = cursor+2.5+x()*4;
    sC.orbit = new Orbit({a, e:x()*.3, i:(x()-.5)*.5, node:x()*Math.PI*2, peri:x()*Math.PI*2, M0:x()*Math.PI*2,
      n:meanMotion(visMass(Mtot+sC.mass), a)});
    S.stars.push(sC);
    S.orbitLines.add(orbitLine(sC.orbit, 0xffd27f, .18));
    wide = isBinary ? 'Trinary' : 'Wide binary';
    S.finds.push([wide, .12]);
  }

  // glowing gas around some stars
  const sys = cursor;
  if (A.name==='white dwarf' && x() < .5){            // planetary nebula: the shed outer layers of the dead star
    const R = Math.max(4, sys*1.3), h = .45+x()*.15;
    S.shells.push(makeShell(x, R*.55, c(h, .8, .55), c(h+.05, .7, .6), {fil:.4, str:1.3, freq:2.5}));
    S.shells.push(makeShell(x, R, c(.98, .85, .55), c(h, .7, .5), {fil:1, waist:1, str:1.1, squash:1.3+x()*.5}));
    S.finds.push(['planetary nebula', .5/13]);
  }
  if (A.name==='neutron star' && x() < .55){          // supernova remnant: the blast wave's tangled filaments
    const R = Math.max(8, sys*1.6);
    S.shells.push(makeShell(x, R, c(.98, .9, .55), c(.5, .8, .55), {fil:1.8, str:.9, freq:2.2}));
    S.shells.push(makeShell(x, R*.25, c(.62, .7, .55), c(.75, .6, .6), {fil:.3, str:.8, freq:4}));
    S.finds.push(['supernova remnant', .55]);
  }
  if (exotic==='Wolf-Rayet star')                     // wind-blown bubble
    S.shells.push(makeShell(x, Math.max(5, sys*1.2), c(.92, .8, .6), c(.6, .7, .6), {fil:1.2, str:1, freq:3}));
  if (exotic==='protostar'){                          // a dusty disk with gaps where the young planets orbit
    S.disk = makeDustDisk(reach+.15, sys*1.15+.5, planetOrbits, c(.08,.55,.55), c(.03,.5,.3));
    tilt.add(S.disk);
    S.shells.push(makeShell(x, Math.max(5, sys*1.4), c(.06, .7, .45), c(.02, .6, .3), {fil:.3, str:.8, freq:2}));
  }
  for (const sh of S.shells) tilt.add(sh);

  // --- description ---
  S.stars.forEach((s,i) => addBody({type:'star', obj:s.mesh, localR:1, star:s, id:'s'+i}));
  const head = wide==='Trinary' ? `Trinary: ${S.stars.map(s => s.name).join(' + ')}`
    : isBinary ? 'Binary: '+A.name+' + '+B.name
    : wide ? `Wide binary: ${A.name} + distant ${S.stars[1].name}` : A.name;
  S.bits = [head[0].toUpperCase()+head.slice(1), `${n} planet${n>1?'s':''}: `+S.worlds.map(describe).join(', ')];
  if (S.belt) S.bits.push('asteroid belt');
  if (nComets) S.bits.push(nComets>1 ? 'two comets' : 'a comet');
  if (S.dyson) S.bits.push(S.dyson.shell ? 'an unfinished Dyson shell' : 'a Dyson swarm');
  if (S.shells.length && A.name==='white dwarf') S.bits.push('inside a planetary nebula');
  if (S.shells.length && A.name==='neutron star') S.bits.push('inside a supernova remnant');
  if (exotic==='protostar') S.bits.push('planets still forming');
  S.finds.push(['star system', force.mode ? 1 : .2]);
  return Math.max(cursor, ...S.comets.map(cm => cm.orbit.apo*.6));
}

// --- black hole ---
let cubeRT = null, cubeCam = null;
function buildBlackHole(r, x){
  const big = force.supermassive;
  const outer = (big ? 3.2 : 1.8)+r()*1.8, h = r();
  const tiltX = (r()-.5)*.3;
  const blue = r()<.3;
  const hot = blue ? c(.58,.5,.95) : r()<.7 ? c(.12,.7,.92) : c(h+.05,.6,.92);
  const cool = blue ? c(.65,.9,.45) : r()<.7 ? c(.03,1,.5) : c(h,1,.5);
  const mass = 3+r()*60;
  r();   // (used to roll jets; kept so seeds stay the same)
  cubeRT ??= new THREE.WebGLCubeRenderTarget(matchMedia('(pointer:coarse)').matches ? 512 : 1024, {type:THREE.HalfFloatType});
  cubeCam ??= new THREE.CubeCamera(.1, 1000, cubeRT);
  const g = new THREE.Group();
  g.scale.setScalar(.5);   // Schwarzschild radius = 0.5 scene units
  g.rotation.x = tiltX;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), blackHoleMat.clone());
  mesh.frustumCulled = false;
  const u = mesh.material.uniforms;
  u.uSky.value = cubeRT.texture; u.uIn.value = 2.6; u.uOut.value = outer*3.2;
  u.uHot.value.copy(hot); u.uCool.value.copy(cool);
  u.uSpin.value = x()<.5 ? 1 : -1;
  g.add(mesh);
  tilt.add(g);
  S.bh = g; S.bh.userData.mesh = mesh;
  S.minDist = 1.1;
  addBody({type:'blackhole', obj:g, localR:1, id:'bh'});
  S.bits = ['Black hole', `${mass.toFixed(1)} solar masses`];
  S.finds.push(['black hole', force.mode ? 1 : .1]);
  if (big){
    S.bits = ['Supermassive black hole', `${(1+x()*40).toFixed(1)} million solar masses`, 'at the centre of its galaxy'];
    S.finds.push(['supermassive', .01]);
  }
  if (blue) S.finds.push(['blue disk', .3]);
  return outer*3.4;   // stand well back: up close the lensing fills the whole sky
}
// the black hole bends the backdrop, so it needs a picture of it from every direction
export function refreshSky(){
  if (!cubeCam) return;
  const vis = sunSprite.visible; sunSprite.visible = false;
  const pts = skyScene.children.find(o => o.isPoints), su = pts.material.uniforms.size, size = su.value;
  su.value = 1;   // small, so lensed stars stay sharp points
  cubeCam.update(renderer, skyScene);
  su.value = size; sunSprite.visible = vis;
}

// --- names ---
const LETTERS = 'bcdefghij';
function nameBodies(){
  const sys = S.sysName;
  let pi = 0;
  for (const b of S.bodies){
    if (b.type==='planet') b.name = S.mode==='planet' ? sys : sys+' '+LETTERS[pi++];
  }
  for (const b of S.bodies){
    const pname = S.bodies.find(p => p.type==='planet' && p.world===b.world)?.name;
    if (b.type==='moon') b.name = b.moon.shepherd ? pname+' (shepherd moonlet)' : moonName(pname, b.world.moons.indexOf(b.moon));
    if (b.type==='station') b.name = (b.station.derelict ? 'Wreck above ' : 'Station above ')+pname;
    if (b.type==='star') b.name = S.stars.length>1 ? sys+' '+'ABC'[S.stars.indexOf(b.star)] : sys;
    if (b.type==='comet') b.name = `Comet ${sys.split(' ')[0]} ${S.comets.indexOf(b.comet)+1}`;
    if (b.type==='blackhole') b.name = sys;
  }
  S.bodies.forEach((b,i) => b.id ??= 'b'+i);
}

// facts shown when you fly to a body
export function bodyInfo(b){
  const w = b.world;
  const day = sp => { const h = 2*Math.PI/Math.abs(sp)/10; return h < 48 ? `${h.toFixed(h<10?1:0)} h` : `${(h/24).toFixed(1)} days`; };
  if (b.type==='planet'){
    const k = w.k, f = [NOT_WORLD.has(w.kindName) ? w.kindName : w.kindName+' world'];
    const nM = w.moons.filter(m => !m.shepherd).length;
    f.push(nM ? `${nM} moon${nM>1?'s':''}` : 'no moons');
    if (w.rings) f.push('ringed');
    if (k.locked) f.push('tidally locked'); else f.push('day '+day(w.spin)+(w.retro ? ' (spins backwards)' : ''));
    if (w.orbit && !k.locked) f.push(`year ${Math.round(w.orbit.period/(2*Math.PI/Math.abs(w.spin)))} days`);
    if (w.obliquity) f.push(`tilt ${Math.round(w.obliquity*57.3)}°`);
    if (k.city) f.push('inhabited');
    return f.concat(w.features);
  }
  if (b.type==='moon'){
    const m = b.moon, f = [m.shepherd ? 'Shepherd moonlet keeping a ring gap clear' : m.kindName];
    if (!m.shepherd) f.push(`orbit ${m.orbit.period.toFixed(0)} s`, 'tidally locked');
    if (m.ring) f.push('ringed');
    if (m.volcanic) f.push('active volcanoes');
    return f;
  }
  if (b.type==='station') return [b.station.derelict ? 'Derelict, tumbling, lights out' : 'Rotating station, spun for gravity'];
  if (b.type==='star'){
    const s = b.star, f = [s.name[0].toUpperCase()+s.name.slice(1), `${s.mass} solar masses`];
    if (s.pulse) f.push('brightens and dims as it pulses');
    if (S.pulsar && s===S.stars[0]) f.push(`pulsar, a flash every ${S.pulsar.period.toFixed(2)} s`);
    if (s.orbit) f.push('distant companion');
    return f;
  }
  if (b.type==='comet') return ['Comet', 'its tails always point away from the star', `orbit ${(b.comet.orbit.period/60).toFixed(1)} min`];
  if (b.type==='blackhole') return S.bits;
  return [];
}

// --- rarity: from the chances of the rarest things here ---
function rarity(finds){
  // multiply the (conditional) chances of everything uncommon here
  const n = Math.round(1/finds.filter(f => f[1] < .5).reduce((a,f) => a*f[1], 1));
  // thresholds measured over thousands of seeds: about 1 world in 10 is Uncommon or better, 1 in 50 Rare,
  // 1 in 300 Epic and 1 in 2000 Legendary
  const tiers = [[250,null],[1400,'Uncommon'],[10000,'Rare'],[50000,'Epic'],[Infinity,'Legendary']];
  const tier = tiers.find(t => n < t[0])[1];
  return {tier, n};
}

// ---------------------------------------------------------------------------------------------------
// per frame: move everything to where it is at time t
const origin = new THREE.Vector3();
export function updateSystem(dt){
  const t = S.simTime;
  for (const s of S.stars){
    if (s.rel) s.rel.at(t, s.mesh.position).multiplyScalar(s.share);
    else if (s.orbit) s.orbit.at(t, s.mesh.position);
    s.mesh.rotation.y += dt*.03;
    s.pulse?.(t);
  }
  for (const w of S.worlds){
    if (w.orbit) w.orbit.at(t, w.group.position);
    updateWorld(w, t, dt);
    if (w.orbit && w.k.locked){   // a tidally locked planet keeps one face to its star
      tmp.copy(w.group.position).negate();
      w.body.rotation.y = Math.atan2(-tmp.z, tmp.x);
    }
  }
  if (S.belt) S.belt.rotation.y = t*S.belt.userData.n;
  for (const cm of S.comets) cm.update(t, origin);
  S.dyson?.update(dt);
  S.pulsar?.update(dt);
}

// where the light at a point comes from: every star counts, weighted by brightness / distance²
const L = {dir:new THREE.Vector3(), col:new THREE.Color(), ang:.01};
const lc = new THREE.Color();
export function lightAt(pos){
  if (S.mode!=='star'){ L.dir.copy(SUN); L.col.copy(S.sunCol); L.ang = .012; return L; }
  L.dir.set(0,0,0); L.col.setRGB(0,0,0);
  let sum = 0, ang = 0;
  for (const s of S.stars){
    s.mesh.getWorldPosition(tmp2).sub(pos);
    const d = Math.max(tmp2.length(), 1e-4), wgt = s.lum*s.bright/(d*d);
    L.dir.addScaledVector(tmp2, wgt/d);
    L.col.add(lc.copy(s.light).multiplyScalar(wgt));
    sum += wgt;
    ang = Math.max(ang, s.mesh.getWorldScale(tmp).x/d);
  }
  L.dir.normalize(); L.col.multiplyScalar(1/sum);
  if (S.stars[0].pulse) L.col.multiplyScalar(.85+.15*S.stars[0].bright);
  L.ang = Math.min(ang, .2);
  return L;
}

const toLocal = (obj, v, out) => out.copy(v).applyQuaternion(obj.getWorldQuaternion(q).invert());
const camL = (obj, out) => obj.worldToLocal(out.copy(camera.position));
function lightBody(mesh, Lt){
  const u = mesh.material.uniforms;
  toLocal(mesh, Lt.dir, u.uSun.value);
  camL(mesh, u.uCam.value);
  u.uSunCol.value.copy(Lt.col);
  u.uTime.value = S.fxTime;
  u.uSunAng.value = Lt.ang;
}
// eclipses: which spheres could shadow this one, in its own space
const wp = new THREE.Vector3();
function setOccluders(mesh, list){
  const u = mesh.material.uniforms, own = mesh.getWorldScale(tmp).x;
  let n = 0;
  for (const o of list){
    if (n>=4) break;
    mesh.worldToLocal(o.obj.getWorldPosition(wp));
    u.uOcc.value[n++].set(wp.x, wp.y, wp.z, o.obj.getWorldScale(tmp2).x/own);
  }
  u.uOccN.value = n;
}
function lightWorld(w){
  const Lt = lightAt(w.group.getWorldPosition(wp));
  const sunW = Lt.dir;
  lightBody(w.body, Lt);
  const rot = w.body.rotation.y-w.clouds.rotation.y;
  w.body.material.uniforms.uCloudRot.value = rot;
  for (const cl of [w.clouds, w.cirrus]){
    if (!cl) continue;
    const cu = cl.material.uniforms;
    toLocal(cl, sunW, cu.uSun.value); cu.uSunCol.value.copy(Lt.col); cu.uTime.value = S.fxTime; cu.uSunAng.value = Lt.ang;
    cu.uCloudRot.value = rot;
    if (cl===w.clouds && w.lightning) cu.uLightning.value = opts.reducedMotion ? 0 : w.lightning;   // no flashing with reduced motion
  }
  const au = w.atmo.material.uniforms;
  toLocal(w.atmo, sunW, au.uSunL.value); camL(w.atmo, au.uCamL.value); au.uSunCol.value.copy(Lt.col);
  w.atmo.material.side = au.uCamL.value.length() < 1.12 ? THREE.BackSide : THREE.FrontSide;   // from inside the air, draw the far side
  if (w.aurora){
    const ru = w.aurora.material.uniforms;
    toLocal(w.aurora, sunW, ru.uSunL.value); camL(w.aurora, ru.uCamL.value); ru.uTime.value = S.fxTime;
  }
  if (w.rings){
    const ru = w.rings.material.uniforms, pu = w.ringPts.material.uniforms;
    toLocal(w.rings, sunW, ru.uSunL.value); ru.uSunCol.value.copy(Lt.col);
    camL(w.rings, ru.uCamL.value);
    toLocal(w.ringPts, sunW, pu.uSunL.value); pu.uSunCol.value.copy(Lt.col);
    pu.uBody.value = w.group.scale.x;
  }
  const moons = w.moons.filter(m => !m.shepherd && m.mesh.visible).map(m => ({obj:m.mesh}));
  setOccluders(w.body, moons);
  setOccluders(w.clouds, moons);
  for (const m of w.moons){
    lightBody(m.mesh, Lt);
    setOccluders(m.mesh, [{obj:w.body}, ...moons.filter(o => o.obj!==m.mesh)]);
    if (m.ring){
      const ru = m.ring.material.uniforms;
      toLocal(m.ring, sunW, ru.uSunL.value); ru.uSunCol.value.copy(Lt.col); camL(m.ring, ru.uCamL.value);
    }
  }
  if (w.station){   // three.js lights for the station's ordinary materials
    keyLight.position.copy(w.station.group.getWorldPosition(wp)).addScaledVector(sunW, 10);
    keyLight.target.position.copy(wp);
    keyLight.color.copy(Lt.col);
    starLight.color.copy(Lt.col);
  }
}

const m3 = new THREE.Matrix3(), m4 = new THREE.Matrix4();
export function lightAll(){
  for (const w of S.worlds) lightWorld(w);
  for (const s of S.stars){
    const u = s.mesh.material.uniforms;
    u.uTime.value = S.fxTime;
    camL(s.mesh, u.uCam.value);
    u.uBright.value = s.bright;
  }
  if (S.pulsar){   // the beam sweeping past us: a sharp flash, like a lighthouse
    const ax = S.pulsar.axisWorld(tmp), s = S.stars[0];
    const toCam = tmp2.copy(camera.position).sub(s.mesh.getWorldPosition(wp)).normalize();
    const f = opts.reducedMotion ? 0 : Math.abs(ax.dot(toCam))**60;
    s.bright = 1+4*f;
    s.corona.material.opacity = .55+.45*f;
    s.corona.scale.setScalar(40*(1+.6*f));
  }
  if (S.mode==='star') S.stars[0].mesh.getWorldPosition(starLight.position);   // stations, comets, Dyson panels
  for (const sh of S.shells) camL(sh, sh.material.uniforms.uCamL.value);
  if (S.disk){ S.disk.material.uniforms.uSunCol.value.copy(S.stars[0].light); }
  if (S.bh){
    const u = S.bh.userData.mesh.material.uniforms;
    camL(S.bh, u.uCamL.value);
    u.uTime.value = S.fxTime;
    m3.setFromMatrix4(m4.extractRotation(S.bh.matrixWorld));
    u.uSkyRot.value.copy(m3);
  }
}

// --- level of detail: full detail up close, coarser spheres further away, then a dot, then nothing ---
const MAXDOTS = 96;
const dotGeo = new THREE.BufferGeometry();
dotGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXDOTS*3),3));
dotGeo.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(MAXDOTS*3),3));
dotGeo.setAttribute('aSz', new THREE.BufferAttribute(new Float32Array(MAXDOTS*2),2));
const dots = new THREE.Points(dotGeo, dotMat);
dots.frustumCulled = false; dots.renderOrder = 5;
scene.add(dots);
// on-screen radius in CSS pixels
export function screenRadius(b, camPos){
  const d = bodyPos(b, wp).distanceTo(camPos);
  return bodyRadius(b)/Math.max(d,1e-6)*pxScale.value/renderer.getPixelRatio();
}
export function updateLOD(){
  const pr = renderer.getPixelRatio(), P = dotGeo.attributes.position, C = dotGeo.attributes.aCol, Z = dotGeo.attributes.aSz;
  let n = 0;
  const add = (pos, col, px, a) => {
    if (n>=MAXDOTS) return;
    P.setXYZ(n, pos.x, pos.y, pos.z); C.setXYZ(n, col.r, col.g, col.b); Z.setXY(n, px*pr, a); n++;
  };
  for (const b of S.bodies){
    const px = screenRadius(b, camera.position);
    if (b.type==='planet'){
      const w = b.world;
      w.group.visible = px > .6;
      if (w.group.visible) lodWorld(w, px);
      if (px < 2) add(bodyPos(b, wp), w.dotColor, 3, Math.min(1, px*4)*.9);   // fades to nothing when tiny
    } else if (b.type==='moon' && !b.moon.shepherd){
      b.moon.mesh.visible = px > .6;
      if (px < 1.5 && b.world.group.visible) add(bodyPos(b, wp), b.moon.k.low, 2, Math.min(1, px*4)*.7);
    }
  }
  if (S.belt){   // asteroid rocks only when you're near the belt; from further out it's a haze of dots
    const {radius, width, rocks} = S.belt.userData, l = S.belt.worldToLocal(wp.copy(camera.position));
    rocks.visible = Math.hypot(Math.hypot(l.x, l.z)-radius, l.y) < width+2.5;
  }
  P.needsUpdate = C.needsUpdate = Z.needsUpdate = true;
  dotGeo.setDrawRange(0, n);
}

export function setOrbitsVisible(on){
  S.showOrbits = on;
  S.orbitLines.visible = on;
  for (const w of S.worlds) w.lines.visible = on;
}
