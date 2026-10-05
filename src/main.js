// PlanetForge: wires the modules together and runs the frame loop.
//   scene.js     renderer, cameras, bloom        materials.js  every shader
//   gen.js       seeds, world kinds, names       world.js      one complete planet with its moons
//   system.js    build a seed, move and light it extras.js     comets, stations, Dyson swarms, nebulae
//   orbit.js     Kepler orbits                   camera.js     focus, fly-to, free flight, tour
//   ui.js        toolbar, keys, links            wallpaper.js  Wallpaper Engine settings
import * as THREE from 'three';
import { S, opts } from './state.js';
import { renderer, camera, controls, root, scene, render, SUN, skyScene, skyCamera, composer } from './scene.js';
import { updateSystem, lightAll, updateLOD } from './system.js';
import { C, updateCamera, flyTo } from './camera.js';
import { start, load } from './ui.js';
import { build } from './system.js';
import './wallpaper.js';
import { settings, loadSaved } from './settings.js';
import { perfTick } from './perf.js';
import { warmUp } from './warmup.js';

loadSaved();
start();

// Compile the shaders before the first frame, without freezing the page: "Generating…" stays up meanwhile.
// They're compiled for the HDR target the composer draws into, so the first real frame reuses them.
let ready = false;
async function compileAll(){
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));   // let "Generating…" paint
  updateSystem(0); root.updateMatrixWorld(true); camera.updateMatrixWorld(); updateLOD(); lightAll();
  renderer.setRenderTarget(composer.renderTarget1);
  try { await renderer.compileAsync(skyScene, skyCamera); await renderer.compileAsync(scene, camera); }
  catch (e) { console.warn('shader precompile failed', e); }
  renderer.setRenderTarget(null);
  ready = true;
  (window.requestIdleCallback ?? setTimeout)(() => warmUp());   // then the shaders other worlds will need
}
compileAll();

const clock = new THREE.Clock(), loadingEl = document.getElementById('loading');
const mouse = new THREE.Vector2(), mouseSmooth = new THREE.Vector2(), parallax = new THREE.Vector3(), tmp = new THREE.Vector3();
addEventListener('mousemove', e => mouse.set(e.clientX/innerWidth*2-1, -(e.clientY/innerHeight*2-1)));
let lastFrame = 0, frames = 0;

renderer.setAnimationLoop(now => {
  if (!ready) return;
  if (settings.fps>0 && now-lastFrame < 1000/settings.fps-1) return;   // skip frames to respect the FPS limit
  lastFrame = now;
  const rawDt = clock.getDelta(), realDt = Math.min(rawDt, .1);
  if (frames++ > 5) perfTick(rawDt);
  const dt = realDt*opts.timeScale*S.time.scale;               // orbital time: pause, slow motion, fast-forward
  S.simTime += dt;
  S.fxTime += realDt*opts.timeScale*Math.min(S.time.scale, 3);  // surfaces animate at most 3× so they don't boil
  updateSystem(dt);
  root.updateMatrixWorld(true);
  // mouse parallax (wallpaper): nudge the camera sideways/up a little, removed again before the controls update
  camera.position.sub(parallax);
  updateCamera(realDt);
  if (!C.flight && !C.fly) controls.update();
  mouseSmooth.lerp(mouse, Math.min(1, realDt*3));
  if (opts.parallax>0 && !C.fly){
    camera.updateMatrixWorld();
    const d = camera.position.distanceTo(controls.target)*.08*opts.parallax;
    parallax.setFromMatrixColumn(camera.matrixWorld,0).multiplyScalar(mouseSmooth.x*d)
      .add(tmp.setFromMatrixColumn(camera.matrixWorld,1).multiplyScalar(mouseSmooth.y*d));
    camera.position.add(parallax); camera.lookAt(controls.target);
  } else parallax.set(0,0,0);
  scene.updateMatrixWorld();
  camera.updateMatrixWorld();
  updateLOD();
  lightAll();
  render();
  loadingEl.hidden = true;
});

// handy from the browser console (and for automated checks)
window.PF = { S, C, opts, load, build, flyTo, THREE, SUN, camera, controls, go:id => flyTo(S.bodies.find(b => b.id===id), {instant:true}) };
