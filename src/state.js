// Shared state of the current world, read by the camera, UI and render loop.
import * as THREE from 'three';

export const S = {
  seed: 0n,
  mode: 'planet',          // 'planet' | 'star' | 'blackhole'
  worlds: [],              // generated planets in the scene
  stars: [],               // stars of a system
  bodies: [],              // everything you can click / fly to (see addBody)
  comets: [], shells: [], belt: null, dyson: null, pulsar: null, bh: null, disk: null,
  sysName: '', bits: [], finds: [], rarity: null,
  fitDist: 3.6, minDist: 1.15,
  sunCol: new THREE.Color(), rogue: false,
  simTime: 0,              // orbital clock (affected by pause / fast-forward)
  fxTime: 0,               // clock for animated surfaces (waves, clouds), capped so fast-forward doesn't boil them
  time: { scales:[0,.1,.25,.5,1,2,5,10,30,100], index:4, get scale(){ return this.scales[this.index]; } },
  showOrbits: false,
  orbitLines: new THREE.Group(),
};

// opts the wallpaper panel can change (defaults = normal website behaviour)
export const opts = { zoom:1, nebula:1, timeScale:1, parallax:0, bloom:1, tour:true, tourSec:30,
  allow:{planet:true, star:true, blackhole:true} };
export const flags = { wallpaper:false };

// where we are in the universe (nav.js): 'system' (a star system or lone planet), 'galaxy' or 'universe'.
// gi: the galaxy we're in (null for a plain seed); place: the star ('s123') or nebula ('n4') whose system we're in
export const L = { level:'system', U:1n, gi:null, place:null };
