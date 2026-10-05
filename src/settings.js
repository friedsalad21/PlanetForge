// Display and motion settings, shared by the website's settings panel and the Wallpaper Engine panel.
// apply(key, value) is the one place each setting takes effect; the website also remembers them.
import { S, opts, flags } from './state.js';
import { renderer, controls, bloom, resize } from './scene.js';
import { nebulaMat } from './materials.js';
import { refreshSky, setOrbitsVisible } from './system.js';

const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
export const DEFAULTS = {
  quality: 'auto',     // 'auto' or a percentage of full resolution
  fps: 0,              // frame-rate cap, 0 = none
  bloom: 100, nebula: 100, brightness: 100, saturation: 100,
  speed: 1,            // animation speed (spin, clouds, orbits)
  drift: 0,            // slow automatic camera turn
  parallax: 0,
  reducedMotion: reduceQuery.matches,
  textsize: 100, showdetails: true, showseed: true, showrarity: true,
  orbitlines: false,
  shotScale: 2,        // screenshot resolution: 1, 2 or 4 × the screen
};
export const settings = {...DEFAULTS};
export const quality = { auto: 1 };   // the automatic scale, set by perf.js

const KEY = 'planetforge.settings';
export function loadSaved(){
  try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
  for (const k of Object.keys(DEFAULTS)) apply(k, settings[k], false);
}
function save(){
  if (flags.wallpaper) return;   // Wallpaper Engine keeps its own settings
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
}
export function resetSettings(){
  try { localStorage.removeItem(KEY); } catch {}
  for (const k of Object.keys(DEFAULTS)) apply(k, DEFAULTS[k], false);
}

export function applyPixelRatio(){
  const q = settings.quality==='auto' ? quality.auto : settings.quality/100;
  const pr = Math.min(devicePixelRatio, 2)*q;
  if (Math.abs(renderer.getPixelRatio()-pr) > 1e-3){ renderer.setPixelRatio(pr); resize(); }
}
const filter = () => renderer.domElement.style.filter =
  settings.brightness===100 && settings.saturation===100 ? '' : `brightness(${settings.brightness}%) saturate(${settings.saturation}%)`;
const show = (id, on) => document.getElementById(id).hidden = !on;

export function apply(key, value, remember = true){
  settings[key] = value;
  switch (key){
    case 'quality': if (value!=='auto') quality.auto = 1; applyPixelRatio(); break;
    case 'bloom': opts.bloom = value/100; bloom.strength = .55*opts.bloom; bloom.enabled = value > 0; break;
    case 'nebula':
      opts.nebula = value/100;
      nebulaMat.uniforms.uDensity.value = (nebulaMat.userData.density ?? 1)*opts.nebula;
      if (S.mode==='blackhole') refreshSky();
      break;
    case 'brightness': case 'saturation': filter(); break;
    case 'speed': opts.timeScale = value; break;
    case 'drift': case 'reducedMotion':
      controls.autoRotate = settings.drift > 0 && !settings.reducedMotion;
      controls.autoRotateSpeed = settings.drift;
      opts.reducedMotion = settings.reducedMotion;
      break;
    case 'parallax': opts.parallax = value; break;
    case 'textsize': document.documentElement.style.setProperty('--ts', value/100); break;
    case 'showdetails': show('meta', value); break;
    case 'showseed': show('seed', value); break;
    case 'showrarity': show('rarity', value); break;
    case 'orbitlines': setOrbitsVisible(value); break;
  }
  if (remember) save();
}
// follow the system setting if the user hasn't chosen
reduceQuery.addEventListener?.('change', e => apply('reducedMotion', e.matches, false));
