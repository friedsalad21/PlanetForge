import * as THREE from 'three';

// --- generation ---
// 64-bit seed -> sfc32 (128-bit state), so every one of the 2^64 seeds gets its own stream
export function sfc32(a,b,c,d){return()=>{a|=0;b|=0;c|=0;d|=0;const t=(a+b|0)+d|0;d=d+1|0;a=b^b>>>9;b=c+(c<<3)|0;c=c<<21|c>>>11;c=c+t|0;return(t>>>0)/4294967296;};}
export function rngFor(seed){
  const lo = Number(seed & 0xffffffffn), hi = Number(seed >> 32n);
  const r = sfc32(lo^0x9e3779b9, hi^0x243f6a88, lo^0xb7e15162, hi^0x85a308d3);
  for (let i=0;i<16;i++) r();   // warm up
  return r;
}
export const c = (h,s,l) => new THREE.Color().setHSL(((h%1)+1)%1,Math.min(Math.max(s,0),1),Math.min(Math.max(l,0),1),THREE.SRGBColorSpace);
export const BLACK = c(0,0,0), WHITE = c(0,0,1);

// each kind returns the fields that differ from the defaults; makeKind also rolls generic terrain knobs
export const BASE = { sea:-2, ice:2, cloud:2, lava:0, gas:0, city:0, crater:0, bands:10, freq:null, rings:.12, moons:3,
  locked:0, glow:0, cloudCol:WHITE, deep:BLACK, shallow:BLACK, sand:BLACK, low:c(0,0,.5), high:c(0,0,.6), rock:c(0,0,.4),
  snow:c(0,0,.95), atmo:BLACK };
export const KINDS = {
  'Terran':  (r,j) => ({sea:-.1+r()*.22, ice:.72+r()*.18, cloud:r()*.3-.05, city:r()<.45?1:0,
    deep:c(.62+j,.7,.13), shallow:c(.54+j,.6,.35), sand:c(.12,.4,.62), low:c(.28+j,.5,.28),
    high:c(.2+j,.35,.32), rock:c(.07,.15,.33), atmo:c(.58,.7,.6)}),
  'Ocean':   (r,j) => ({sea:.2+r()*.12, ice:.8+r()*.15, cloud:-.05+r()*.2,
    deep:c(.6+j,.8,.12), shallow:c(.5+j,.7,.4), sand:c(.13,.5,.7), low:c(.3,.6,.35),
    high:c(.25,.5,.3), rock:c(.08,.2,.35), atmo:c(.56,.8,.6)}),
  'Archipelago':(r,j) => ({sea:.22+r()*.1, ice:.85+r()*.1, cloud:0+r()*.25, warp:.4+r()*.3, freq:2+r()*1.5, city:r()<.3?1:0,
    deep:c(.57+j,.85,.16), shallow:c(.48+j,.8,.48), sand:c(.13,.55,.78), low:c(.3+j,.65,.3),
    high:c(.27,.5,.28), rock:c(.08,.2,.4), atmo:c(.55,.8,.62)}),
  'Jungle':  (r,j) => ({sea:-.05+r()*.1, cloud:.02+r()*.15,
    deep:c(.5,.7,.13), shallow:c(.45,.6,.3), sand:c(.15,.5,.45), low:c(.33+j,.75,.18),
    high:c(.3+j,.6,.22), rock:c(.25,.3,.3), snow:c(.3,.2,.6), atmo:c(.4,.6,.6)}),
  'Savanna': (r,j) => ({sea:-.15+r()*.15, ice:.85+r()*.1, cloud:.2+r()*.15, city:r()<.3?1:0, moist:.8+r()*.2,
    deep:c(.58,.6,.15), shallow:c(.5,.55,.35), sand:c(.12,.45,.6), low:c(.13+j,.55,.45), low2:c(.26+j,.45,.28),
    high:c(.08,.35,.35), rock:c(.06,.2,.3), atmo:c(.57,.6,.65)}),
  'Swamp':   (r,j) => ({sea:.0+r()*.1, cloud:-.1+r()*.15, cloudCol:c(.25,.1,.85),
    deep:c(.22+j,.5,.12), shallow:c(.2+j,.45,.24), sand:c(.15,.35,.3), low:c(.22+j,.5,.18), low2:c(.12,.4,.2),
    high:c(.18,.35,.22), rock:c(.1,.2,.25), atmo:c(.3,.5,.55)}),
  'Tundra':  (r,j) => ({sea:-.1+r()*.2, ice:.5+r()*.2, cloud:.1+r()*.2,
    deep:c(.6,.5,.15), shallow:c(.55,.4,.35), sand:c(.1,.15,.5), low:c(.22+j,.2,.38), low2:c(.1,.25,.42),
    high:c(.6,.05,.5), rock:c(.6,.05,.35), atmo:c(.58,.5,.7)}),
  'Alien':   (r,j,h) => ({sea:-.1+r()*.25, ice:.75+r()*.2, cloud:r()*.35, cloudCol:c(h+.15,.3,.9),
    deep:c(h,.7,.14), shallow:c(h,.6,.36), sand:c(h+.5,.4,.6), low:c(h+.3,.55,.35),
    high:c(h+.4,.45,.4), rock:c(h+.45,.2,.3), snow:c(h+.6,.3,.9), atmo:c(h+.1,.8,.6)}),
  'Desert':  (r,j) => ({sea:-.6, ice:.9+r()*.1, cloud:.35+r()*.15, cloudCol:c(.1,.3,.92),
    deep:c(.5,.4,.25), shallow:c(.48,.35,.45), sand:c(.1,.45,.62), low:c(.08+j,.5,.5),
    high:c(.05+j,.55,.4), rock:c(.03,.4,.28), snow:c(.1,.4,.75), atmo:c(.08,.6,.6)}),
  'Dune':    (r,j) => ({sea:-.8, cloud:.4+r()*.2, terrace:.6+r()*.4, warp:.3+r()*.3, cloudCol:c(.1,.3,.92),
    sand:c(.1+j,.55,.65), low:c(.09+j,.55,.58), high:c(.07+j,.5,.5), rock:c(.05,.45,.4), snow:c(.1,.4,.8), atmo:c(.09,.6,.62)}),
  'Canyon':  (r,j) => ({sea:-.7, cloud:.4+r()*.2, ridge:.5+r()*.5, terrace:.4+r()*.4,
    sand:c(.07,.5,.55), low:c(.03+j,.6,.42), high:c(.05+j,.55,.5), rock:c(.02,.5,.3), snow:c(.08,.3,.8), atmo:c(.05,.5,.6)}),
  'Volcanic':(r) => ({sea:-.05+r()*.15, cloud:.2+r()*.2, lava:1, cloudCol:c(0,0,.35),
    deep:c(.02,1,.35), shallow:c(.09,1,.55), sand:c(0,0,.05), low:c(0,0,.1),
    high:c(0,0,.14), rock:c(0,0,.2), snow:c(0,0,.28), atmo:c(.03,.9,.5)}),
  'Magma':   (r) => ({sea:.25+r()*.15, lava:1, glow:.5, ridge:r()*.6, cloud:2,
    deep:c(.0,1,.3), shallow:c(.08,1,.55), sand:c(0,0,.06), low:c(.02,.3,.1), high:c(0,0,.15), rock:c(0,0,.22), atmo:c(.02,1,.45)}),
  'Frozen':  (r,j) => ({sea:-.05+r()*.15, ice:.25+r()*.2, cloud:.1+r()*.2,
    deep:c(.57+j,.5,.18), shallow:c(.52+j,.45,.4), sand:c(.55,.15,.7), low:c(.55,.2,.82),
    high:c(.58,.15,.9), rock:c(.6,.1,.55), snow:WHITE, atmo:c(.55,.5,.8)}),
  'Snowball':(r,j) => ({sea:0, ice:-.2, cloud:.25+r()*.2, freq:.8+r()*.8,
    deep:c(.58,.5,.2), shallow:c(.55,.4,.4), snow:c(.56+j,.15+r()*.15,.95), atmo:c(.56,.4,.8)}),
  'Toxic':   (r) => ({sea:-.05+r()*.15, cloud:-.15+r()*.15, lava:.25, cloudCol:c(.15,.7,.7),
    deep:c(.2,.9,.2), shallow:c(.22,.9,.45), sand:c(.12,.5,.3), low:c(.1,.4,.25),
    high:c(.08,.35,.2), rock:c(.07,.25,.15), snow:c(.16,.6,.6), atmo:c(.18,.8,.5)}),
  'Iron':    (r,j) => ({crater:.3+r()*.4, freq:1.5+r()*2, ridge:r()*.5, atmo:c(.04,.4,.35),
    sand:c(.04+j,.5,.3), low:c(.03+j,.55,.33), low2:c(.05,.3,.4), high:c(.02,.4,.25), rock:c(.6,.05,.45), snow:c(.6,.04,.7)}),
  'Carbon':  (r,j,h) => ({sea:-.2+r()*.2, cloud:.25+r()*.25, cloudCol:c(0,0,.3),
    deep:c(.75,.4,.06), shallow:c(.7,.3,.12), sand:c(.08,.2,.18), low:c(h,.08,.12), high:c(h,.1,.18),
    rock:c(h,.12,.26), snow:c(.6,.2,.55), atmo:c(.08,.5,.35)}),
  'Crystal': (r,j,h) => ({sea:-1, ridge:.7+r()*.3, freq:1.5+r()*1.5,
    sand:c(h,.6,.5), low:c(h,.7,.55), low2:c(h+.2,.7,.55), high:c(h+.4,.6,.65), rock:c(h+.6,.5,.75),
    snow:c(h,.3,.95), atmo:c(h,.8,.6)}),
  'Eyeball': (r,j) => ({sea:-.05+r()*.15, locked:1, cloud:.15+r()*.2,
    deep:c(.6+j,.7,.14), shallow:c(.52,.6,.36), sand:c(.08,.5,.55), low:c(.28+j,.5,.3),
    high:c(.15,.3,.33), rock:c(.07,.2,.3), atmo:c(.57,.7,.6)}),
  'Cloud':   (r,j) => ({sea:-1, cloud:-1.2, stretch:2+r()*4, swirl:.3+r()*.8, cloudCol:c(.11+j,.45+r()*.3,.78), atmoStr:1.6,
    sand:c(.1,.4,.5), low:c(.08,.4,.4), high:c(.06,.3,.35), rock:c(.05,.3,.3), atmo:c(.1,.6,.6)}),
  'Haze':    (r,j) => ({sea:-1, cloud:-1.2, stretch:1+r()*2, cloudCol:c(.07+j,.7,.5), atmoStr:1.8,
    low:c(.07,.5,.3), high:c(.06,.4,.25), rock:c(.05,.3,.2), atmo:c(.08,.8,.55)}),
  // moons: cratered rock, no seas or air
  'Moon':      (r,j,h) => ({freq:1.5+r()*2, crater:1, sand:c(h,.05,.3), low:c(h,.05,.4), high:c(h,.04,.55),
    rock:c(h,.04,.65), snow:c(h,.03,.75)}),
  'Icy moon':  (r,j) => ({freq:1.5+r()*2, crater:.6, sand:c(.55,.25,.55), low:c(.56,.2,.7), high:c(.57,.15,.82),
    rock:c(.58,.1,.9), snow:WHITE}),
  'Sulfur moon':(r) => ({freq:2+r()*2, crater:.3, sand:c(.08,.6,.3), low:c(.13,.8,.55), high:c(.11,.7,.45),
    rock:c(.05,.6,.35), snow:c(.15,.6,.8)}),
  'Rusty moon':(r,j) => ({freq:1.5+r()*2, crater:.8, sand:c(.03,.4,.25), low:c(.03+j,.5,.32), high:c(.04,.4,.42),
    rock:c(.05,.3,.5), snow:c(.06,.2,.65)}),
  'Dark moon': (r,j,h) => ({freq:1.5+r()*2, crater:.9, sand:c(h,.06,.1), low:c(h,.06,.14), high:c(h,.05,.2),
    rock:c(h,.05,.28), snow:c(h,.04,.4)}),
  'Barren':  (r,j,h) => ({freq:2+r()*2, rings:0, moons:2, crater:.7,
    sand:c(h,.06,.45), low:c(h,.06,.42), high:c(h,.05,.34), rock:c(h,.05,.26), snow:c(0,0,.7)}),
  'Gas giant':(r,j,h) => {
    const s=.3+r()*.4;
    const pal = [
      [c(.08,.5,.75), c(.06,.6,.45), c(.03,.5,.35), c(.1,.3,.9), c(.08,.6,.6)],     // Jupiter-ish
      [c(.12,.45,.75), c(.11,.4,.6), c(.09,.35,.5), c(.12,.3,.9), c(.12,.5,.6)],    // Saturn-ish
      [c(h,s,.65), c(h+.06,s+.1,.45), c(h-.06,s,.32), c(h+.5,.35,.85), c(h,.7,.6)], // anything goes
      [c(h,s*.5,.7), c(h,s*.6,.5), c(h+.03,s*.5,.38), c(h+.1,.3,.9), c(h,.5,.6)],   // muted
    ][Math.floor(r()*4)];
    return {gas:1, bands:6+r()*20, rings:.65, moons:4,
      low:pal[0], high:pal[1], rock:pal[2], snow:pal[3], atmo:pal[4]};
  },
  'Ice giant':(r,j) => ({gas:1, bands:3+r()*8, turb:.4+r()*1.2, sharp:r()*.4, rings:.4, moons:3,
    low:c(.52+j,.5,.6), high:c(.56+j,.55,.48), rock:c(.6+j,.5,.38), snow:c(.55,.3,.92), atmo:c(.55,.7,.65)}),
  'Hot Jupiter':(r,j) => ({gas:1, glow:1, bands:8+r()*12, rings:.1, moons:1,
    low:c(.03+j,.6,.28), high:c(.0,.7,.38), rock:c(.08,.4,.16), snow:c(.08,.9,.62), atmo:c(.03,.9,.5)}),
};
export const NOT_WORLD = new Set(['Gas giant','Ice giant','Hot Jupiter']);
// names that read wrong with " world" after them (giants and their variants)
export const notWorld = name => NOT_WORLD.has(name) || /giant|Neptune|puff|Jupiter/i.test(name);

// --- variants: a different look (and name) for a kind, decided by its own random stream (VR) so that the main
// streams, and with them every world's terrain, moons and features, stay exactly as they were. See VARIANTS.md.
export const VR = { r: Math.random };   // set per seed by build()
const gasPal = (a, b, cc, d, e) => ({low:a, high:b, rock:cc, snow:d, atmo:e});
export const KIND_VARIANTS = {
  'Terran': [
    ['Supercontinent', (v,k) => ({sea:-.32+v()*.1, freq:.45+v()*.2, warp:.3})],
    ['Ice-age', (v,k) => ({ice:.38+v()*.12})],
    ['Hothouse', (v,k) => ({ice:2, sea:.12+v()*.08, cloud:-.08, low:c(.3,.6,.22), low2:c(.22,.55,.2), atmo:c(.15,.5,.65), cloudCol:c(.12,.15,.9)})],
  ],
  'Ocean': [
    ['Hycean', (v,k) => ({sea:.55, cloud:-.12, deep:c(.5,.8,.1), shallow:c(.47,.7,.32), atmo:c(.5,.6,.72), atmoStr:1.4})],
    ['Storm ocean', (v,k) => ({cloud:-.2, swirl:.8+v()*.6, storms:3})],
    ['Purple ocean', (v,k) => ({deep:c(.78+v()*.06,.7,.14), shallow:c(.82,.55,.38), atmo:c(.75,.5,.65)})],
  ],
  'Jungle': [
    ['Red forest', (v,k) => ({low:c(.98+v()*.03,.6,.22), low2:c(.02,.5,.15), high:c(.95,.35,.2), atmo:c(.02,.4,.6)})],
    ['Fungal', (v,k) => ({low:c(.08,.25,.62), low2:c(.85,.25,.55), high:c(.1,.2,.5), cloudCol:c(.85,.15,.9), atmo:c(.8,.35,.65)})],
  ],
  'Savanna': [['Autumn', (v,k) => ({low:c(.06,.65,.42), low2:c(.02,.6,.35), high:c(.09,.4,.35)})]],
  'Desert': [
    ['Salt flat', (v,k) => ({terrace:.5, sand:c(.1,.1,.86), low:c(.1,.08,.8), low2:c(.08,.15,.7), high:c(.07,.2,.55), atmo:c(.58,.4,.7)})],
    ['Glass desert', (v,k) => ({sand:c(.42,.25,.45), low:c(.4,.3,.38), low2:c(.12,.3,.45), high:c(.45,.25,.3), atmo:c(.45,.4,.6)})],
  ],
  'Canyon': [['Badlands', (v,k) => ({ridge:.9, terrace:.8, low:c(.01,.65,.38), low2:c(.06,.5,.55), high:c(.04,.55,.5)})]],
  'Volcanic': [['Sulfur world', (v,k) => ({low:c(.13,.85,.5), low2:c(.09,.8,.42), high:c(.12,.7,.65), rock:c(.03,.6,.3), sand:c(.15,.7,.6), atmo:c(.12,.7,.55), volcCol:c(.12,1,.6)})]],
  'Magma': [['Cooling crust', (v,k) => ({sea:.02+v()*.06, ridge:.8, low:c(0,0,.07), high:c(0,0,.11)})]],
  'Iron': [['Chthonian', (v,k) => ({glow:.35, crater:.2, low:c(.03,.3,.18), high:c(.02,.2,.25), rock:c(.6,.05,.35), atmo:c(.03,.8,.4)})]],
  'Carbon': [['Diamond', (v,k) => ({sea:-1, ridge:.6, low:c(.6,.08,.55), low2:c(.62,.1,.7), high:c(.6,.05,.85), rock:c(.6,.05,.95), snow:WHITE, atmo:c(.6,.3,.7)})]],
  'Frozen': [
    ['Nitrogen ice', (v,k) => ({snow:c(.07,.25,.93), low:c(.06,.45,.55), high:c(.05,.35,.7), sand:c(.04,.5,.4), atmo:c(.6,.3,.75)})],
    ['Black ice', (v,k) => ({snow:c(.6,.08,.32), low:c(.6,.08,.22), high:c(.6,.06,.3), rock:c(.6,.05,.4), atmo:c(.6,.3,.5)})],
  ],
  'Snowball': [['Blue ice', (v,k) => ({snow:c(.55,.55,.8)})]],
  'Crystal': [['Obsidian', (v,k) => ({sand:c(.75,.2,.08), low:c(.7,.25,.1), low2:c(.8,.3,.14), high:c(.72,.2,.2), rock:c(.7,.15,.35), snow:c(.7,.2,.6)})]],
  'Eyeball': [
    ['Lava eye', (v,k) => ({lava:1, glow:.3, deep:c(.0,1,.3), shallow:c(.08,1,.55), atmo:c(.03,.8,.5)})],
    ['Ocean eye', (v,k) => ({sea:.18+v()*.08})],
  ],
  'Gas giant': [
    ['Super-puff', (v,k) => ({atmoStr:2.2, bands:4+v()*4, ...gasPal(c(.1,.25,.8), c(.08,.25,.7), c(.06,.2,.6), c(.1,.2,.92), c(.1,.4,.75))})],
    ['Methane giant', (v,k) => gasPal(c(.58,.5,.6), c(.6,.55,.45), c(.62,.5,.35), c(.57,.3,.9), c(.58,.7,.6))],
    ['Ammonia giant', (v,k) => gasPal(c(.12,.2,.85), c(.1,.25,.72), c(.08,.25,.6), c(.12,.15,.95), c(.12,.3,.75))],
    ['Tholin giant', (v,k) => gasPal(c(.06,.55,.45), c(.04,.6,.32), c(.03,.5,.22), c(.08,.4,.7), c(.05,.6,.5))],
  ],
  'Ice giant': [['Mini-Neptune', (v,k) => ({bands:2+v()*3, low:c(.47,.45,.6), high:c(.5,.5,.5), atmo:c(.48,.6,.65)})]],
  'Moon': [
    ['Two-tone moon', (v,k) => ({twoTone:1})],
    ['Potato moon', (v,k) => ({potato:[1.25+v()*.35, .7+v()*.15, .85+v()*.2]})],
  ],
  'Icy moon': [
    ['Geyser moon', (v,k) => ({cryo:true, crater:.3})],
    ['Ocean moon', (v,k) => ({crater:.1, ridge:.7, sand:c(.06,.35,.5), low:c(.56,.12,.84), high:c(.55,.08,.9), rock:c(.06,.4,.45), snow:WHITE})],
  ],
};
// maybe turn kind k (already made from the main stream) into one of its variants; returns the name to show
export function rollVariant(name, k){
  const list = KIND_VARIANTS[name], v = VR.r;
  if (!list || v() >= .35) return name;
  const [vname, f] = list[Math.floor(v()*list.length)];
  Object.assign(k, f(v, k));
  return vname;
}
export const KIND_POOL = ['Terran','Terran','Terran','Ocean','Archipelago','Jungle','Savanna','Swamp','Tundra','Alien','Alien',
  'Desert','Dune','Canyon','Volcanic','Magma','Frozen','Snowball','Toxic','Barren','Iron','Carbon','Crystal','Eyeball',
  'Cloud','Haze','Gas giant','Gas giant','Gas giant','Ice giant','Hot Jupiter'];
// worlds that can drift alone between the stars, warmed only from inside
export const ROGUE_POOL = ['Frozen','Snowball','Iron','Carbon','Magma','Volcanic','Barren','Ocean','Tundra'];
// which kinds get which features (each still rolls its own chance)
export const WET = new Set(['Terran','Jungle','Savanna','Swamp','Tundra','Alien','Eyeball','Archipelago','Ocean']);
export const STORMY = new Set(['Terran','Ocean','Archipelago','Jungle','Swamp','Savanna','Alien','Toxic','Cloud','Eyeball']);
export const MAGNETIC = new Set(['Terran','Ocean','Archipelago','Jungle','Savanna','Swamp','Tundra','Frozen','Alien','Snowball',
  'Toxic','Eyeball','Gas giant','Ice giant','Hot Jupiter']);
// [chance of volcanoes, min, max, chance each one is erupting]
export const VOLCANIC = { 'Volcanic':[1,3,6,.8], 'Magma':[1,2,4,.6], 'Sulfur moon':[.8,2,5,.9], 'Iron':[.3,1,2,.2],
  'Barren':[.2,1,2,0], 'Toxic':[.3,1,3,.6], 'Alien':[.15,1,2,.5], 'Terran':[.2,1,2,.4], 'Moon':[.05,1,1,0], 'Carbon':[.2,1,3,.5] };
export const MOON_POOL = ['Moon','Moon','Moon','Icy moon','Icy moon','Sulfur moon','Rusty moon','Dark moon'];

// star types: hue/sat/lightness (sRGB), radius when shown as the main body
export const STAR_TYPES = {
  'red dwarf':   [.02,1,.68,.6],   'orange dwarf':[.07,1,.78,.85], 'yellow dwarf':[.12,1,.9,1],
  'white star':  [.6,.35,.96,1.15],'blue giant':  [.6,1,.82,1.6],  'red giant':   [.035,1,.62,2.3],
  'white dwarf': [.58,.7,.94,.32], 'brown dwarf': [.97,.55,.4,.7], 'neutron star':[.6,.3,1,.07],
  // rarer finds, rolled separately so existing seeds keep their stars
  'Wolf-Rayet star':[.66,.8,.88,1.3], 'Cepheid variable':[.13,.9,.84,1.9], 'protostar':[.04,1,.6,1.2],
};
// mass (in suns) sets orbital speeds; luminosity weights how much each star lights a planet
export const STAR_PHYS = {
  'red dwarf':[.3,.3], 'orange dwarf':[.75,.6], 'yellow dwarf':[1,1], 'white star':[1.8,2], 'blue giant':[12,6],
  'red giant':[1.1,3], 'white dwarf':[.7,.3], 'brown dwarf':[.06,.08], 'neutron star':[1.6,.4],
  'Wolf-Rayet star':[18,8], 'Cepheid variable':[6,4], 'protostar':[1,1.5],
};
export const EXOTIC_STARS = ['Wolf-Rayet star','Cepheid variable','protostar'];
export const SUN_POOL = ['red dwarf','red dwarf','red dwarf','orange dwarf','orange dwarf','yellow dwarf','yellow dwarf',
  'white star','blue giant','red giant','white dwarf','brown dwarf'];
export const STAR_POOL = [...SUN_POOL, 'neutron star'];

export const SYL = ['ka','zor','vel','tha','mir','qu','dra','sel','ny','or','ae','bri','xen','lo','ru','vos','eth','pha','gor','li',
  'ta','um','cy','ix','an','zu','kel','mar','tis','ro','sha','vy','nor','el','ga','dun','ri','sa','tor','bel','ki','om',
  'pra','os','ver','ha','zi','qua','bar','ul','fen','ya','tre','ko','wen','is','dor','ash','lyr','neb'];
export const SUFFIX = ['I','II','III','IV','V','VI','VII','IX','Prime','b','c','d','Major','Minor','Alpha','Beta'];
export const PREFIX = ['New ','Nova ','Old ','Little ','Great ','Far ','Lost ','Outer '];
export const CATALOG = [['HD ',99999],['Kepler-',4000],['Gliese ',999],['TOI-',5000],['KOI-',8000],['HIP ',120000],
  ['TRAPPIST-',99],['WASP-',300],['PF-',99999],['GJ ',9999]];

export function makeName(r, isPlanet){
  const pick = a => a[Math.floor(r()*a.length)];
  const base = () => { let n=''; for (let i=0,k=2+Math.floor(r()*2);i<k;i++) n+=pick(SYL); return n[0].toUpperCase()+n.slice(1); };
  const roll = r();
  if (roll<.2){ const [pre,max] = pick(CATALOG); return pre+(1+Math.floor(r()*max))+(isPlanet ? ' '+pick([...'bcdefgh']) : ''); }
  if (roll<.3) return pick(PREFIX)+base();
  const n = base();
  return r()<.35 ? n+' '+pick(SUFFIX) : n;
}

export function makeKind(name, r){
  const j = (r()-.5)*.08, h = r();
  // generic knobs every world rolls, so two worlds of the same kind still differ a lot
  const gen = { warp: r()<.5 ? r()*.5 : 0, ridge: r()<.35 ? r()*.8 : 0, terrace: r()<.1 ? .4+r()*.6 : 0,
    moist: .3+r()*.7, stretch: 1+r()*2.5, swirl: r()<.35 ? r()*.8 : 0, sharp: r(), turb: .8+r()*2.5,
    storms: Math.floor(r()*4), spin: .02+r()*.07, atmoStr: .7+r()*.7 };
  const lowShift = (r()-.5)*.2, lowLight = (r()-.5)*.15;
  const k = {...BASE, ...gen, ...KINDS[name](r, j, h)};
  k.low2 ??= k.low.clone().offsetHSL(lowShift, 0, lowLight);
  return k;
}

export function applyKind(mat, k, r){
  const u = mat.uniforms;
  u.uSeed.value.set(r()*50,r()*50,r()*50);
  u.uFreq.value = k.freq ?? .8+r()*1.2;
  const set = {uSea:k.sea, uIce:k.ice, uLava:k.lava, uGas:k.gas, uBands:k.bands, uCity:k.city, uCrater:k.crater,
    uWarp:k.warp, uRidge:k.ridge, uTerrace:k.terrace, uLocked:k.locked, uGlow:k.glow, uMoist:k.moist,
    uTurb:k.turb, uStorms:k.storms, uSharp:k.sharp};
  for (const key in set) u[key].value = set[key];
  for (const key of ['deep','shallow','sand','low','low2','high','rock','snow','atmo'])
    u['u'+key[0].toUpperCase()+key.slice(1)].value.copy(k[key]);
}
