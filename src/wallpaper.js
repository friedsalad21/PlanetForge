// Wallpaper Engine calls applyUserProperties on load with the settings from project.json, which switches
// the page into wallpaper mode: no input (desktop clicks pass through), slow camera drift, a tour from body
// to body, and a new world on a timer.
import * as THREE from 'three';
import { S, L, opts, flags } from './state.js';
import { camera, controls, resize, view } from './scene.js';
import { apply } from './settings.js';
import { autoDist, C, systemView } from './camera.js';
import { newWorld, go, parseHash } from './ui.js';

export const wp = { fixedSeed:null };
let cycleMin = 10, cycleTimer = null, fadeSec = 1;
const fadeEl = document.getElementById('fade');
export function fadeTo(fn){
  if (fadeSec<=0) return fn();
  fadeEl.style.opacity = 1; setTimeout(()=>{ fn(); fadeEl.style.opacity = 0; }, fadeSec*1000);
}
function setElevation(deg){   // camera height above the system's plane, keeping distance and direction
  const off = camera.position.clone().sub(controls.target), s = new THREE.Spherical().setFromVector3(off);
  s.phi = THREE.MathUtils.degToRad(90-deg);
  camera.position.copy(controls.target).add(off.setFromSpherical(s));
}
function restartCycle(){
  clearInterval(cycleTimer);
  if (cycleMin>0 && wp.fixedSeed===null) cycleTimer = setInterval(()=>fadeTo(newWorld), cycleMin*60000);
}
window.wallpaperPropertyListener = {
  applyUserProperties(p){
    if (!flags.wallpaper){
      flags.wallpaper = true;
      for (const id of ['hint','bar','timebar']) document.getElementById(id).hidden = true;
      controls.enabled = false;
      apply('reducedMotion', false, false);   // the wallpaper's own drift and tour settings decide how much moves
      apply('drift', .3, false);
      apply('quality', 100, false);
    }
    if (p.showinfo) document.getElementById('info').hidden = !p.showinfo.value;
    if (p.seed){
      const s = p.seed.value.trim().replace(/^#/, ''), h = parseHash(s);   // a seed, or any link (a galaxy, a star in one…)
      wp.fixedSeed = h ? s : null;
      if (h){ history.replaceState(null,'','#'+s); go(h); }
    }
    if (p.cycle) cycleMin = p.cycle.value;
    for (const [key,kind] of [['showplanets','planet'],['showstars','star'],['showblackholes','blackhole'],['showgalaxies','galaxy']])
      if (p[key]) opts.allow[kind] = p[key].value;
    if (p.showplanets || p.showstars || p.showblackholes || p.showgalaxies){   // current world no longer allowed? swap it now
      const kind = L.level!=='system' || L.gi!=null ? 'galaxy' : S.mode;
      if (wp.fixedSeed===null && Object.values(opts.allow).some(Boolean) && !opts.allow[kind]) fadeTo(newWorld);
    }
    if (p.zoom){ opts.zoom = p.zoom.value/100; if (!C.focus) camera.position.sub(controls.target).setLength(autoDist()).add(controls.target); }
    if (p.angle) setElevation(p.angle.value);
    if (p.shift){ view.shiftX = p.shift.value/100; resize(); }
    // the settings the website panel has too
    for (const [wpKey, key, f = v => v] of [['drift','drift'],['speed','speed'],['parallax','parallax'],['brightness','brightness'],
      ['saturation','saturation'],['nebula','nebula'],['showdetails','showdetails'],['showseed','showseed'],['showrarity','showrarity'],
      ['textsize','textsize'],['orbitlines','orbitlines'],['bloom','bloom']])
      if (p[wpKey]) apply(key, f(p[wpKey].value), false);
    if (p.autoquality || p.quality){
      const auto = p.autoquality ? p.autoquality.value : settingsAuto;
      settingsAuto = auto;
      if (p.quality) lastQuality = p.quality.value;
      apply('quality', auto ? 'auto' : lastQuality, false);
    }
    if (p.fade){ fadeSec = p.fade.value; fadeEl.style.transitionDuration = fadeSec+'s'; }
    if (p.tour){ opts.tour = p.tour.value; if (!opts.tour && C.focus) systemView({dur:6}); }
    if (p.tourtime) opts.tourSec = p.tourtime.value;
    restartCycle();
  },
  applyGeneralProperties(p){ if (p.fps!==undefined) apply('fps', p.fps, false); },   // Wallpaper Engine's FPS limit
};
let settingsAuto = false, lastQuality = 100;
