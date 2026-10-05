// Toolbar, keyboard, mouse/touch, the info text and links.
import * as THREE from 'three';
import { S, opts, flags } from './state.js';
import { renderer, render, resize, composer } from './scene.js';
import { settings, apply, resetSettings, quality } from './settings.js';
import { stats } from './perf.js';
import { rngFor } from './gen.js';
import { build, bodyInfo } from './system.js';
import { C, flyTo, systemView, setFly, resetCamera, pickAt, keys, addLook, stick, touchBoost } from './camera.js';

const $ = id => document.getElementById(id);
const nameEl = $('name'), metaEl = $('meta'), seedEl = $('seed'), rarityEl = $('rarity'), hintEl = $('hint');

// --- what's on screen ---
export function showInfo(b, why){
  $('sys').hidden = !b && why!=='fly';
  if (why==='fly'){
    nameEl.textContent = 'Free flight';
    metaEl.textContent = matchMedia('(pointer:coarse)').matches ? 'left stick to move · drag to look · ✕ to stop'
      : 'W A S D move · mouse look (click to lock) · Shift boost · Q / E roll · R / C up / down · wheel sets speed · F to land';
    rarityEl.textContent = '';
    return;
  }
  nameEl.textContent = b ? b.name : S.sysName;
  metaEl.textContent = (b ? bodyInfo(b) : S.bits).join(' · ');
  seedEl.textContent = 'seed '+S.seed+(b ? ` · in ${S.sysName}` : '');
  const R = S.rarity;
  rarityEl.textContent = R?.tier && !b ? `◆ ${R.tier} find · a 1 in ${R.n.toLocaleString('en')} combination` : '';
  rarityEl.dataset.tier = R?.tier ?? '';
  hintEl.textContent = b ? 'click empty space or Esc to zoom back out · drag to look around · ? for help'
    : 'click a planet, moon or star to fly to it · click empty space for a new world · ? for help';
  // for screen readers: say what's on screen now
  const say = `${nameEl.textContent}. ${metaEl.textContent}.${rarityEl.textContent ? ' '+rarityEl.textContent+'.' : ''}`;
  $('sr').textContent = say;
  renderer.domElement.setAttribute('aria-label', say);
}
renderer.domElement.setAttribute('role', 'img');
C.onFocus = (b, why) => {
  showInfo(b, why);
  if (!flags.wallpaper && why!=='fly') history.replaceState(history.state, '', '#'+S.seed+(b ? '-'+b.id : ''));
};

// --- worlds and history ---
// seeds are unsigned 64-bit integers in the URL hash, optionally followed by the body you're looking at (#123-p2m1)
const MAX = (1n<<64n)-1n;
export function parseHash(h = location.hash){
  const m = /^#?(\d+)(?:-([a-z0-9]+))?$/.exec(h);
  return m ? {seed:BigInt(m[1]) & MAX, body:m[2] ?? null} : null;
}
// the first random number of a seed decides planet / star system / black hole (see build)
const modeOf = seed => { const x = rngFor(seed)(); return x<.7 ? 'planet' : x<.9 ? 'star' : 'blackhole'; };
const prevBtn = $('prev');
const depth = () => history.state?.d ?? 0;
export function load(seed, bodyId){
  build(seed);
  resetCamera();
  showInfo(null);
  const b = bodyId && S.bodies.find(b => b.id===bodyId);
  if (b) flyTo(b, {instant:true});
}
export function newWorld(push = !flags.wallpaper){
  const any = Object.values(opts.allow).some(Boolean);
  let seed;
  for (let i=0;i<200;i++){   // reroll until it's a kind the wallpaper settings allow
    seed = crypto.getRandomValues(new BigUint64Array(1))[0];
    if (!any || opts.allow[modeOf(seed)]) break;
  }
  if (push) history.pushState({d:depth()+1},'','#'+seed);
  else history.replaceState({d:depth()},'','#'+seed);
  load(seed);
  prevBtn.disabled = depth()===0;
}
addEventListener('hashchange', () => {
  const h = parseHash();
  if (!h) return;
  if (h.seed !== S.seed) load(h.seed, h.body);
  else { const b = S.bodies.find(b => b.id===h.body); b ? flyTo(b) : systemView(); }
  prevBtn.disabled = depth()===0;
});
export function start(){
  const h = parseHash();
  if (h){ history.replaceState({d:0},'',location.href); load(h.seed, h.body); } else newWorld(false);
  prevBtn.disabled = true;
  $('orb').classList.toggle('on', S.showOrbits);
}

// --- toolbar ---
const toastEl = $('toast');
let toastTimer;
export function toast(msg){ toastEl.textContent = msg; toastEl.style.opacity = 1; clearTimeout(toastTimer); toastTimer = setTimeout(()=>toastEl.style.opacity = 0, 1500); }
function copyLink(){
  navigator.clipboard.writeText(location.href).then(()=>toast('Link copied'), ()=>toast('Copy failed: the link is in the address bar'));
}
// screenshots render once at up to 4× the screen's resolution (supersampled, so no multisampling needed)
function screenshot(){
  const base = renderer.getPixelRatio(), max = Math.min(renderer.capabilities.maxTextureSize, 8192);
  const pr = Math.min(Math.min(devicePixelRatio,2)*settings.shotScale, max/innerWidth, max/innerHeight);
  const big = pr > base+1e-3, rts = [composer.renderTarget1, composer.renderTarget2];
  if (big){
    for (const rt of rts){ rt.samples = 0; rt.dispose(); }
    renderer.setPixelRatio(pr); resize();
  }
  render();   // the drawing buffer is only readable right after a render
  const w = renderer.domElement.width, h = renderer.domElement.height;
  renderer.domElement.toBlob(b=>{
    const a = Object.assign(document.createElement('a'), {href:URL.createObjectURL(b), download:nameEl.textContent+'.png'});
    a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  });
  if (big){
    for (const rt of rts){ rt.samples = 4; rt.dispose(); }
    renderer.setPixelRatio(base); resize();
  }
  toast(`Saved a ${w}×${h} screenshot`);
}
// screenshot mode: hide everything but the view
function toggleUI(){
  const clean = document.body.classList.toggle('clean');
  if (clean) toast(matchMedia('(pointer:coarse)').matches ? 'Tap “Show UI” in the corner to bring it back' : 'Press H to bring the UI back');
  else $('hide').focus?.({preventScroll:true});
}
function toggleOrbits(){
  apply('orbitlines', !S.showOrbits);
  $('orb').classList.toggle('on', S.showOrbits);
  toast(S.showOrbits ? 'Orbits shown' : 'Orbits hidden');
}
function toggleFly(){ setFly(!C.fly); }
function zoomOut(){ if (C.fly) setFly(false, false); systemView(); }
function toggleHelp(){ $('helpbox').hidden = !$('helpbox').hidden; $('setbox').hidden = true; }

// --- settings panel ---
const setbox = $('setbox'), inputs = [...setbox.querySelectorAll('[data-key]')];
const fmt = (key, v) => ({speed:'×'+(+v).toFixed(2), drift:(+v).toFixed(2)}[key] ?? v+'%');
function syncPanel(){
  for (const el of inputs){
    const v = settings[el.dataset.key];
    if (el.type==='checkbox') el.checked = !!v; else el.value = String(v);
    const out = el.nextElementSibling;
    if (out?.tagName==='OUTPUT' && el.type==='range') out.textContent = fmt(el.dataset.key, v);
  }
}
for (const el of inputs) el.addEventListener('input', () => {
  const key = el.dataset.key;
  const v = el.type==='checkbox' ? el.checked : el.value==='auto' ? 'auto' : +el.value;
  apply(key, v);
  syncPanel();
});
let panelTimer = null;
function toggleSettings(){
  setbox.hidden = !setbox.hidden; $('helpbox').hidden = true;
  clearInterval(panelTimer);
  if (!setbox.hidden){
    syncPanel();
    const live = () => {   // what the automatic quality is doing right now
      $('qnow').textContent = settings.quality==='auto' ? Math.round(quality.auto*100)+'%' : '';
      $('fpsnow').textContent = stats.fps ? `${Math.round(stats.fps)} fps` : '';
    };
    live(); panelTimer = setInterval(live, 1000);
  }
}
function closePanels(){ if (!setbox.hidden) toggleSettings(); $('helpbox').hidden = true; }

// --- time ---
let lastScale = 4;
function setTime(i){
  const T = S.time;
  T.index = THREE.MathUtils.clamp(i, 0, T.scales.length-1);
  if (T.scale) lastScale = T.index;
  const s = T.scale;
  $('tlabel').textContent = s ? (s<1 ? '×'+s : s+'×') : 'paused';
  $('pause').textContent = s ? '❚❚' : '▶';
  $('pause').title = s ? 'Pause (P)' : 'Play (P)';
}
const pause = () => setTime(S.time.scale ? 0 : lastScale);
const slower = () => setTime(S.time.index===0 ? 0 : S.time.index-1);
const faster = () => setTime(S.time.index+1);
setTime(4);

// focus the next / previous body in the list (Tab), or a planet by number
function cycle(dir){
  const list = S.bodies.filter(b => !(b.type==='moon' && b.moon.shepherd));
  if (!list.length) return;
  const i = list.indexOf(C.focus);
  flyTo(list[(i+dir+list.length+(i<0 && dir<0 ? 1 : 0)) % list.length]);
}
function planetN(n){
  const p = S.bodies.filter(b => b.type==='planet')[n-1];
  if (p) flyTo(p);
}

for (const [id, fn] of [['prev',()=>history.back()],['next',()=>newWorld()],['sys',zoomOut],
  ['flyb',toggleFly],['orb',toggleOrbits],['copy',copyLink],['shot',screenshot],['hide',toggleUI],['showui',toggleUI],['help',toggleHelp],
  ['settings',toggleSettings],['setclose',toggleSettings],['setreset',()=>{ resetSettings(); syncPanel(); toast('Settings reset'); }],
  ['pause',pause],['slower',slower],['faster',faster],['helpclose',toggleHelp],['flyexit',()=>setFly(false)]])
  $(id).onclick = fn;

const FLY_KEYS = new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','KeyR','KeyC','ShiftLeft','ShiftRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
addEventListener('keydown', e=>{
  if (flags.wallpaper || e.ctrlKey || e.metaKey || e.altKey || e.target.tagName==='BUTTON' && ['Space','Enter','Tab'].includes(e.code)) return;
  if (['INPUT','SELECT'].includes(e.target.tagName) && e.code!=='Escape') return;   // sliders and lists in the settings panel
  if (C.fly && FLY_KEYS.has(e.code)){
    keys.add(e.code === 'ArrowLeft' ? 'KeyA' : e.code === 'ArrowRight' ? 'KeyD' : e.code);
    e.preventDefault(); return;
  }
  const act = {
    Space:()=>newWorld(), ArrowRight:()=>newWorld(), ArrowLeft:()=>depth()>0 && history.back(),
    KeyC:copyLink, KeyS:screenshot, KeyH:toggleUI, KeyO:toggleOrbits, KeyF:toggleFly,
    KeyP:pause, KeyK:pause, Comma:slower, Period:faster, BracketLeft:slower, BracketRight:faster,
    Escape:()=>{ if (!$('helpbox').hidden || !setbox.hidden) closePanels(); else if (document.body.classList.contains('clean')) toggleUI(); else if (C.fly || C.focus) zoomOut(); },
    Tab:()=>cycle(e.shiftKey ? -1 : 1), Slash:toggleHelp,
    Digit0:()=>{ const s = S.bodies.find(b => b.type==='star' || b.type==='blackhole'); s ? flyTo(s) : systemView(); },
  }[e.code] ?? (/^Digit[1-9]$/.test(e.code) ? () => planetN(+e.code.slice(5)) : null);
  if (act){ e.preventDefault(); act(); }
});
addEventListener('keyup', e=>{
  keys.delete(e.code==='ArrowLeft' ? 'KeyA' : e.code==='ArrowRight' ? 'KeyD' : e.code);
});
addEventListener('blur', ()=>keys.clear());

// --- pointer: click a body to fly to it, click empty space to zoom out (or get a new world) ---
const cv = renderer.domElement, labelEl = $('label');
let down = null, hoverQueued = false, lastMove = null;
cv.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; labelEl.style.opacity = 0; });
cv.addEventListener('pointermove', e => {
  if (C.fly){
    if (document.pointerLockElement===cv) addLook(e.movementX, e.movementY);
    else if (e.buttons) addLook(e.movementX*(e.pointerType==='touch' ? 1.6 : 1), e.movementY*(e.pointerType==='touch' ? 1.6 : 1));
    return;
  }
  if (e.buttons || e.pointerType==='touch') return;
  lastMove = [e.clientX, e.clientY];
  if (!hoverQueued){ hoverQueued = true; requestAnimationFrame(hover); }
});
function hover(){
  hoverQueued = false;
  if (!lastMove || flags.wallpaper) return;
  const b = pickAt(...lastMove);
  cv.style.cursor = b ? 'pointer' : 'grab';
  if (b && b!==C.focus){
    labelEl.textContent = b.name+' · '+(b.type==='planet' ? b.world.kindName : b.type==='moon' ? b.moon.kindName : bodyInfo(b)[0]);
    labelEl.style.transform = `translate(${lastMove[0]+14}px,${lastMove[1]+12}px)`;
    labelEl.style.opacity = 1;
  } else labelEl.style.opacity = 0;
}
cv.addEventListener('pointerleave', () => { labelEl.style.opacity = 0; lastMove = null; });
cv.addEventListener('pointerup', e => {
  const click = down && Math.hypot(e.clientX-down[0], e.clientY-down[1]) < 6;
  down = null;
  if (!click || flags.wallpaper) return;
  if (C.fly){ if (e.pointerType==='mouse' && document.pointerLockElement!==cv) cv.requestPointerLock?.(); return; }
  const b = pickAt(e.clientX, e.clientY);
  if (b) flyTo(b);
  else if (C.focus) systemView();
  else newWorld();
});
cv.addEventListener('wheel', e => {
  if (!C.fly) return;
  C.speedMul = THREE.MathUtils.clamp(C.speedMul*Math.exp(-e.deltaY*.0015), .05, 30);
  toast(`Speed ×${C.speedMul.toFixed(C.speedMul<1 ? 2 : 1)}`);
}, {passive:true});

// --- touch flight: a virtual stick (move) and a boost button; drag anywhere else to look ---
const stickEl = $('stick'), knob = $('knob');
let stickId = null;
const moveStick = e => {
  const r = stickEl.getBoundingClientRect(), R = r.width/2;
  let dx = e.clientX-(r.left+R), dy = e.clientY-(r.top+R);
  const l = Math.hypot(dx, dy); if (l > R){ dx *= R/l; dy *= R/l; }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  stick.set(dx/R, -dy/R);
};
stickEl.addEventListener('pointerdown', e => { stickId = e.pointerId; stickEl.setPointerCapture(e.pointerId); moveStick(e); });
stickEl.addEventListener('pointermove', e => { if (e.pointerId===stickId) moveStick(e); });
const endStick = () => { stickId = null; stick.set(0,0); knob.style.transform = ''; };
stickEl.addEventListener('pointerup', endStick); stickEl.addEventListener('pointercancel', endStick);
$('boost').addEventListener('pointerdown', () => touchBoost.on = true);
for (const ev of ['pointerup','pointercancel','pointerleave']) $('boost').addEventListener(ev, () => touchBoost.on = false);

