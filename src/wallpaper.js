// Wallpaper Engine calls applyUserProperties on load with the settings from project.json, which switches
// the page into wallpaper mode: no input (desktop clicks pass through), slow camera drift, a tour from body
// to body, and a new world on a timer.
import * as THREE from 'three';
import { S, opts, flags } from './state.js';
import { renderer, camera, controls, bloom, resize, view } from './scene.js';
import { nebulaMat } from './materials.js';
import { refreshSky, setOrbitsVisible } from './system.js';
import { autoDist, C, systemView } from './camera.js';
import { newWorld, load, parseHash } from './ui.js';

export const wp = { fpsLimit:0, fixedSeed:null };
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
const cssFilter = {brightness:100, saturate:100};
function applyFilter(){ renderer.domElement.style.filter = `brightness(${cssFilter.brightness}%) saturate(${cssFilter.saturate}%)`; }
function restartCycle(){
  clearInterval(cycleTimer);
  if (cycleMin>0 && wp.fixedSeed===null) cycleTimer = setInterval(()=>fadeTo(newWorld), cycleMin*60000);
}
window.wallpaperPropertyListener = {
  applyUserProperties(p){
    if (!flags.wallpaper){
      flags.wallpaper = true;
      for (const id of ['hint','bar','timebar']) document.getElementById(id).hidden = true;
      Object.assign(controls, {enabled:false, autoRotate:true, autoRotateSpeed:.3});
    }
    if (p.showinfo) document.getElementById('info').hidden = !p.showinfo.value;
    if (p.drift) controls.autoRotateSpeed = p.drift.value;
    if (p.quality){ renderer.setPixelRatio(Math.min(devicePixelRatio,2)*p.quality.value/100); resize(); }
    if (p.seed){
      const s = p.seed.value.trim(), h = parseHash(s);
      wp.fixedSeed = h ? h.seed : null;
      if (h){ history.replaceState(null,'','#'+s); load(h.seed, h.body); }
    }
    if (p.cycle) cycleMin = p.cycle.value;
    for (const [key,kind] of [['showplanets','planet'],['showstars','star'],['showblackholes','blackhole']])
      if (p[key]) opts.allow[kind] = p[key].value;
    if (p.showplanets || p.showstars || p.showblackholes){   // current world no longer allowed? swap it now
      if (wp.fixedSeed===null && Object.values(opts.allow).some(Boolean) && !opts.allow[S.mode]) fadeTo(newWorld);
    }
    if (p.zoom){ opts.zoom = p.zoom.value/100; if (!C.focus) camera.position.sub(controls.target).setLength(autoDist()).add(controls.target); }
    if (p.angle) setElevation(p.angle.value);
    if (p.shift){ view.shiftX = p.shift.value/100; resize(); }
    if (p.speed) opts.timeScale = p.speed.value;
    if (p.parallax) opts.parallax = p.parallax.value;
    if (p.brightness){ cssFilter.brightness = p.brightness.value; applyFilter(); }
    if (p.saturation){ cssFilter.saturate = p.saturation.value; applyFilter(); }
    if (p.nebula){ opts.nebula = p.nebula.value/100; nebulaMat.uniforms.uDensity.value = (nebulaMat.userData.density??1)*opts.nebula; refreshSky(); }
    if (p.showdetails) document.getElementById('meta').hidden = !p.showdetails.value;
    if (p.showseed) document.getElementById('seed').hidden = !p.showseed.value;
    if (p.showrarity) document.getElementById('rarity').hidden = !p.showrarity.value;
    if (p.textsize) document.documentElement.style.setProperty('--ts', p.textsize.value/100);
    if (p.fade){ fadeSec = p.fade.value; fadeEl.style.transitionDuration = fadeSec+'s'; }
    if (p.tour){ opts.tour = p.tour.value; if (!opts.tour && C.focus) systemView({dur:6}); }
    if (p.tourtime) opts.tourSec = p.tourtime.value;
    if (p.orbitlines) setOrbitsVisible(p.orbitlines.value);
    if (p.bloom){ opts.bloom = p.bloom.value/100; bloom.strength = .55*opts.bloom; }
    restartCycle();
  },
  applyGeneralProperties(p){ if (p.fps!==undefined) wp.fpsLimit = p.fps; },   // Wallpaper Engine's FPS limit
};
