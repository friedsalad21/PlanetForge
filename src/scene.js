// Renderer, cameras, scenes and the bloom post-processing chain.
import * as THREE from 'three';
import { OrbitControls } from '../lib/OrbitControls.js';
import { EffectComposer } from '../lib/postprocessing/EffectComposer.js';
import { RenderPass } from '../lib/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../lib/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../lib/postprocessing/OutputPass.js';
import { nebulaMat } from './materials.js';

export const renderer = new THREE.WebGLRenderer({antialias:false, preserveDrawingBuffer:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
document.body.appendChild(renderer.domElement);

// The backdrop (nebula, stars, a distant sun) lives in its own scene, drawn first from a camera that only
// turns and never moves, so it always sits at infinity however far you fly.
export const skyScene = new THREE.Scene();
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(45, innerWidth/innerHeight, .05, 300);
camera.position.set(0,1.1,3.4);   // a little above the equator so rings aren't edge-on
export const skyCamera = new THREE.PerspectiveCamera(45, innerWidth/innerHeight, .1, 1000);

export const controls = new OrbitControls(camera, renderer.domElement);
Object.assign(controls, {enablePan:false, enableDamping:true, minDistance:1.15, maxDistance:60});

// root: everything that moves with the system (shifted as a whole for the floating origin);
// tilt: the system's plane, tipped a little so we don't always look at it edge-on
export const root = new THREE.Group(); scene.add(root);
export const tilt = new THREE.Group(); root.add(tilt);

// non-shader objects (stations, Dyson swarms) are lit by real three.js lights
export const keyLight = new THREE.DirectionalLight(0xffffff, 3);
export const starLight = new THREE.PointLight(0xffffff, 0, 0, 0);
scene.add(keyLight, keyLight.target, starLight, new THREE.AmbientLight(0x404858, .35));

export const SUN = new THREE.Vector3(1,.3,.3).normalize();

// --- backdrop ---
skyScene.add(new THREE.Mesh(new THREE.SphereGeometry(150,32,32), nebulaMat));
{
  const pos = new Float32Array(4000*3), col = new Float32Array(4000*3), v = new THREE.Vector3(), cl = new THREE.Color();
  for (let i=0;i<4000;i++){
    v.randomDirection().multiplyScalar(100); pos.set([v.x,v.y,v.z], i*3);
    // most stars white, some warmer or bluer, a few bright ones
    const t = Math.random(), b = .5+Math.random()**3*1.5;
    cl.setRGB(1, .85+.15*t, .7+.3*t).multiplyScalar(b);
    if (Math.random()<.25) cl.setRGB(.75*b, .85*b, b);
    col.set([cl.r, cl.g, cl.b], i*3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos,3));
  g.setAttribute('color', new THREE.BufferAttribute(col,3));
  skyScene.add(new THREE.Points(g, new THREE.PointsMaterial({size:1.5, sizeAttenuation:false, vertexColors:true})));
}

export function glowTexture(stops){
  const cv = Object.assign(document.createElement('canvas'),{width:128,height:128});
  const g = cv.getContext('2d'), gr = g.createRadialGradient(64,64,0,64,64,64);
  for (const [at,a] of stops) gr.addColorStop(at,`rgba(255,255,255,${a})`);
  g.fillStyle = gr; g.fillRect(0,0,128,128);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export const CORONA_TEX = glowTexture([[0,1],[.45,.9],[.55,.35],[.75,.08],[1,0]]);
export const SOFT_TEX = glowTexture([[0,1],[.04,.8],[.15,.25],[.45,.05],[1,0]]);
export const ROUND_TEX = glowTexture([[0,1],[.55,1],[.75,0],[1,0]]);
// the distant sun of a lone planet
export const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture([[0,1],[.12,.9],[.35,.15],[1,0]]),
  blending:THREE.AdditiveBlending, depthWrite:false}));
sunSprite.position.copy(SUN).multiplyScalar(90);
skyScene.add(sunSprite);

// --- post-processing: render sky + scene into a multisampled HDR target, add bloom, then output ---
const target = new THREE.WebGLRenderTarget(innerWidth, innerHeight, {type:THREE.HalfFloatType, samples:4});
export const composer = new EffectComposer(renderer, target);
const skyPass = new RenderPass(skyScene, skyCamera);
const mainPass = new RenderPass(scene, camera);
mainPass.clear = false;                   // draw on top of the sky...
mainPass.clearDepth = true;               // ...but with a fresh depth buffer
export const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .55, .45, .9);
composer.addPass(skyPass); composer.addPass(mainPass); composer.addPass(bloom); composer.addPass(new OutputPass());

export const pxScale = {value:1};   // pixels per unit at distance 1 (ring particles, LOD, picking)
export const view = {shiftX:0};     // wallpaper setting: slide the framing left/right
export function resize(){
  renderer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(innerWidth, innerHeight);
  for (const cam of [camera, skyCamera]){
    cam.aspect = innerWidth/innerHeight;
    if (view.shiftX) cam.setViewOffset(innerWidth, innerHeight, -view.shiftX*innerWidth, 0, innerWidth, innerHeight);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }
  pxScale.value = renderer.getPixelRatio()*innerHeight/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)));
}
addEventListener('resize', resize); resize();

export function render(){
  skyCamera.quaternion.copy(camera.quaternion);
  composer.render();
}
