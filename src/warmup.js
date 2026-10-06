// After the first world is up, quietly compile the shaders every other kind of world uses
// (black holes, nebulae, comets, stations...), so meeting one later doesn't stutter.
import * as THREE from 'three';
import { renderer, scene, camera, composer, warpPass } from './scene.js';
import { galaxyScene } from './galaxy.js';
import { universeScene, deepScene } from './universe.js';
import * as M from './materials.js';
import { makeNebulaVolMat } from './galaxyshaders.js';

export async function warmUp(){
  const group = new THREE.Group(), geo = new THREE.SphereGeometry(1, 4, 4);
  const add = mat => { const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; group.add(m); };
  for (const mat of [M.bodyMat, M.cloudMat, M.auroraMat, M.ringMat, M.starMat, M.shellMat, M.dustDiskMat, M.beamMat, M.blackHoleMat,
    new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial({side:THREE.DoubleSide}), new THREE.MeshBasicMaterial(),
    new THREE.LineBasicMaterial({transparent:true})]) add(mat);
  for (const side of [THREE.FrontSide, THREE.BackSide]){   // the air is drawn from outside or from inside
    const a = M.atmoMat.clone(); a.side = side; add(a);
  }
  for (const mat of [M.ringPtsMat, M.cometMat, M.dotMat]){ const p = new THREE.Points(geo, mat); p.frustumCulled = false; group.add(p); }
  add(warpPass.material);   // the jump between stars
  add(makeNebulaVolMat());  // nebulae in a galaxy (only created when a galaxy is shown, so not in its scene yet)
  renderer.setRenderTarget(composer.renderTarget1);
  try {
    await renderer.compileAsync(group, camera, scene);
    for (const s of [galaxyScene, deepScene, universeScene]) await renderer.compileAsync(s, camera);   // galaxies and the universe
    // and draw everything once, tiny and off screen: some drivers only finish preparing a shader the first time it's used
    const tiny = new THREE.WebGLRenderTarget(4, 4, {type:THREE.HalfFloatType}), cam = camera.clone();
    cam.position.set(0, 0, 3); cam.lookAt(0, 0, 0); cam.near = .01; cam.far = 100; cam.updateProjectionMatrix();
    renderer.setRenderTarget(tiny);
    renderer.render(group, cam);
    tiny.dispose();
  } catch {}
  renderer.setRenderTarget(null);
  geo.dispose();
}
