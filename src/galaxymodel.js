// The galaxy model: a galaxy's shape from its seed, and its stars sampled from that shape.
// Shapes are in "normalized" units (1 = the disk's radius); positions are stored in galaxy units (GU = R per radius).
// The same density functions run in the shaders (galaxyshaders.js), so the glow and the stars line up.
import { rngFor, c, makeName, SYL, STAR_TYPES } from './gen.js';

// --- seeds: every galaxy, star and nebula gets its own 64-bit seed ---
const M64 = (1n<<64n)-1n;
export function mix64(a, b){
  let z = (BigInt(a)*0x9E3779B97F4A7C15n + BigInt(b) + 0x632BE59BD9B4E019n) & M64;
  z = ((z ^ (z>>30n))*0xBF58476D1CE4E5B9n) & M64;
  z = ((z ^ (z>>27n))*0x94D049BB133111EBn) & M64;
  return z ^ (z>>31n);
}

// --- integer-hash value noise, bit-for-bit the same as the GLSL version (uint maths) ---
function pcg(v){
  const s = (Math.imul(v>>>0, 747796405) + 2891336453)>>>0;
  const w = Math.imul(((s >>> ((s>>>28)+4)) ^ s)>>>0, 277803737)>>>0;
  return ((w>>>22) ^ w)>>>0;
}
const hsh = (x, y, seed) => pcg((Math.imul(x>>>0, 1597334677) ^ pcg((y ^ seed)>>>0))>>>0)/4294967295;
export function vnoise(x, y, seed){
  x += 512; y += 512;
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x-ix, fy = y-iy; fx = fx*fx*(3-2*fx); fy = fy*fy*(3-2*fy);
  const a = hsh(ix,iy,seed), b = hsh(ix+1,iy,seed), cc = hsh(ix,iy+1,seed), d = hsh(ix+1,iy+1,seed);
  return (a+(b-a)*fx) + ((cc+(d-cc)*fx) - (a+(b-a)*fx))*fy;
}
export const fbm2 = (x, y, seed) => .5*vnoise(x,y,seed) + .3*vnoise(x*2.03+17, y*2.03+17, seed) + .2*vnoise(x*4.1+31, y*4.1+31, seed);
const smooth = (a, b, x) => { const t = Math.min(Math.max((x-a)/(b-a),0),1); return t*t*(3-2*t); };

// --- what a galaxy looks like ---
export const GTYPES = ['spiral', 'elliptical', 'irregular'];   // index = the shader's uType
const GREEK = ['Alpha','Beta','Gamma','Delta','Theta','Lambda','Sigma','Omega'];
function galaxyName(r, type){
  const pick = a => a[Math.floor(r()*a.length)];
  const roll = r();
  if (roll < .4) return pick(['NGC ','IC ','UGC ','PGC ','ESO ','M'])+(1+Math.floor(r()*(roll<.05 ? 110 : 9000)));
  let n = ''; for (let i=0,k=2+Math.floor(r()*2);i<k;i++) n += pick(SYL);
  n = n[0].toUpperCase()+n.slice(1);
  if (roll < .55) return n+' '+pick(GREEK);
  return n+(type==='irregular' ? pick([' Cloud',' Cloud',' Drift']) : type==='elliptical' ? pick([' Cluster',' Sphere',' Galaxy']) : pick([' Galaxy',' Spiral',' Wheel',' Galaxy']));
}

export function galaxyParams(seed, home = false){
  const r = rngFor(seed);
  const roll = r();
  const kind = home ? 'spiral' : roll<.52 ? 'spiral' : roll<.74 ? 'barred' : roll<.87 ? 'elliptical' : 'irregular';
  const type = kind==='barred' ? 'spiral' : kind;
  const g = {
    seed, kind, type, t: GTYPES.indexOf(type),
    R: home ? 1000 : 650+r()*700,                       // radius in GU (1 GU ≈ 50 light years in the big ones)
    arms: type==='spiral' ? [2,2,2,3,4,4,5][Math.floor(r()*7)] : 0,
    pitch: .26+r()*.24, sharp: 1.6+r()*2.4, twist: r()<.5 ? 1 : -1,
    hR: .26+r()*.12, hz: .011+r()*.009, rb: .06+r()*.07,
    bar: kind==='barred' ? .16+r()*.14 : 0,
    flat: .55+r()*.25, dust: .6+r()*.9,
    core: c(.075+r()*.05, .45+r()*.35, .72),
    arm: c(.56+r()*.07, .35+r()*.4, .74),
    hii: c(.94+r()*.05, .6+r()*.2, .66),
    nseed: Math.floor(r()*16777216),   // < 2^24 so it survives as a float attribute
  };
  if (home){ g.arms = 4; g.bar = .2; g.kind = 'barred'; g.pitch = .36; }
  if (type==='elliptical'){ g.rb = .16+r()*.12; g.flat = .45+r()*.5; g.dust = 0; g.core = c(.08+r()*.03, .5+r()*.3, .7); }
  if (type==='irregular'){ g.hz = .03+r()*.02; g.R *= .55; g.hR = .45; g.rb = .03; g.dust = .5; }
  // drawn from a second stream so the rolls above keep their values
  const x = rngFor(seed ^ 0x2545f4914f6cdd1dn);
  g.dwarf = !home && x() < (type==='irregular' ? .6 : type==='elliptical' ? .4 : .25);   // most galaxies are small
  if (g.dwarf){ g.R *= .3+x()*.2; if (type==='spiral') g.arms = Math.min(g.arms, 2+Math.floor(x()*2)); }
  const tint = home ? .5 : x();   // a few red, dead spirals and blue starbursts
  if (type==='spiral' && tint < .12){ g.arm = c(.08, .35, .66); g.hii.multiplyScalar(.3); g.dead = true; }
  if (tint > .9){ g.arm = c(.6, .55, .72); g.hii = c(.93, .8, .66); g.starburst = true; }
  // shapes of spiral: lenticular (a smooth disk, no arms) and grand-design (two clean, bold arms)
  const shape = home ? .5 : x();
  if (type==='spiral' && shape < .12){ g.arms = 0; g.dust *= .3; g.rb *= 1.4; g.lenticular = true; }
  else if (type==='spiral' && shape > .86){ g.arms = 2; g.sharp = 4.2; g.pitch = .3; g.grand = true; }
  g.r0 = g.bar || g.rb*1.6;
  g.name = home ? 'the Forge' : galaxyName(r, type);
  g.home = home;
  g.label = home ? 'Barred spiral galaxy (home)' : (g.dwarf ? 'Dwarf ' : '')+(g.lenticular ? 'lenticular galaxy' : g.grand ? 'grand-design spiral'
    : {spiral:'spiral galaxy', barred:'barred spiral galaxy', elliptical:'elliptical galaxy', irregular:'irregular galaxy'}[kind])
    +(g.dead ? ' (no new stars)' : g.starburst ? ' (starburst)' : '');
  g.label = g.label[0].toUpperCase()+g.label.slice(1);
  return g;
}

// spiral-arm strength (0..1) at a point of the disk (normalized x, z); same formula as armPhase/armOf in GLSL
export function armPhase(g, x, z){
  const r = Math.hypot(x, z), th = Math.atan2(z, x);
  return g.arms*(th - g.twist*Math.log(Math.max(r,.02)/g.r0)/Math.tan(g.pitch)) + (fbm2(x*2.5, z*2.5, g.nseed)-.5)*2;
}
export function armOf(g, x, z){
  if (!g.arms) return 0;
  const r = Math.hypot(x, z);
  return Math.pow(.5+.5*Math.cos(armPhase(g, x, z)), g.sharp)*smooth(g.r0*.5, g.r0*1.3, r);
}
// irregular galaxies: a lumpy cloud instead of arms
export function irrOf(g, x, z){ return smooth(.35, .7, fbm2(x*1.6+3.1, z*1.6+7.3, g.nseed+11)); }

// --- star types: point colour, brightness, and which pools they come from ---
export const STYPES = [
  // name, luminosity (for the point's size), [h,s,l] override for things that aren't STAR_TYPES
  ['red dwarf', .18], ['orange dwarf', .45], ['yellow dwarf', 1], ['white star', 3], ['blue giant', 26], ['red giant', 14],
  ['white dwarf', .12], ['brown dwarf', .04], ['neutron star', .15], ['Wolf-Rayet star', 40], ['Cepheid variable', 16], ['protostar', 2],
  ['black hole', .08, [.78,.6,.6]], ['supermassive black hole', 90, [.09,.8,.8]],
].map(([name, lum, hsl], i) => {
  const [h,s,l] = hsl ?? STAR_TYPES[name];
  return {name, lum, col:c(h, s*.85, Math.min(l, .8)), i};
});
const T = Object.fromEntries(STYPES.map(t => [t.name, t.i]));
const pool = o => { const list = []; for (const k in o) list.push([T[k], o[k]]); const tot = list.reduce((s,[,w]) => s+w, 0);
  return u => { u *= tot; for (const [i,w] of list){ if ((u -= w) < 0) return i; } return list[0][0]; }; };
const OLD = pool({'red dwarf':40, 'orange dwarf':22, 'yellow dwarf':11, 'red giant':10, 'white dwarf':10, 'brown dwarf':3,
  'neutron star':2, 'black hole':1.5, 'Cepheid variable':.5});
const DISK = pool({'red dwarf':38, 'orange dwarf':18, 'yellow dwarf':14, 'white star':7, 'red giant':6, 'white dwarf':7,
  'brown dwarf':6, 'neutron star':1.5, 'black hole':1, 'blue giant':1, 'Cepheid variable':.5});
const YOUNG = pool({'red dwarf':24, 'orange dwarf':12, 'yellow dwarf':12, 'white star':14, 'blue giant':12, 'protostar':8,
  'Wolf-Rayet star':2, 'Cepheid variable':2, 'red giant':4, 'white dwarf':3, 'brown dwarf':3, 'neutron star':1.5, 'black hole':1});

// --- the stars: positions (GU), types, and the clusters and nebulae among them ---
export function makeStars(g){
  const r = rngFor(g.seed ^ 0x5bd1e995n);
  const gauss = () => Math.sqrt(-2*Math.log(r()+1e-12))*Math.cos(2*Math.PI*r());
  const laplace = () => (r()<.5 ? 1 : -1)*Math.log(1/(r()+1e-12));
  const N = Math.round((g.type==='elliptical' ? 110000 : g.type==='irregular' ? 60000 : 150000)*(g.dwarf ? .3 : 1));
  const pos = new Float32Array(N*3), type = new Uint8Array(N);
  let n = 0;
  const put = (x, y, z, t) => { if (n>=N) return; pos[n*3] = x*g.R; pos[n*3+1] = y*g.R; pos[n*3+2] = z*g.R; type[n++] = t; };
  put(0, 0, 0, T['supermassive black hole']);   // star 0: the black hole at the centre

  // globular clusters in the halo, open clusters in the arms
  const globs = [], opens = [];
  const nGlob = g.type==='irregular' ? 4 : 18+Math.floor(r()*20);
  for (let i=0;i<nGlob;i++){
    const d = (.15+Math.abs(gauss())*.45)*(g.type==='elliptical' ? 1.4 : 1), u = r()*2-1, a = r()*Math.PI*2, s = Math.sqrt(1-u*u);
    globs.push([d*s*Math.cos(a), d*u*.7, d*s*Math.sin(a), .004+r()*.005]);
  }
  const diskPoint = () => {   // rejection-sample the disk: dense in the middle, denser in the arms
    for (let k=0;k<40;k++){
      const rad = -g.hR*Math.log((r()+1e-9)*(r()+1e-9));
      if (rad > 1.6) continue;
      const th = r()*Math.PI*2, x = rad*Math.cos(th), z = rad*Math.sin(th);
      const a = g.type==='irregular' ? irrOf(g, x, z) : armOf(g, x, z);
      const keep = g.type==='irregular' ? .08+.92*a : .28+.72*a;
      if (r() < keep) return [x, z, a];
    }
    return [0, 0, 0];
  };
  if (g.type!=='elliptical') for (let i=0;i<(g.type==='irregular' ? 25 : 70);i++){
    const [x, z, a] = diskPoint();
    if (a > .35) opens.push([x, (laplace()*g.hz*.3), z, .002+r()*.003]);
  }

  // nebulae you can fly into, in the arms
  g.nebulae = [];
  const nNeb = g.type==='spiral' ? 16 : g.type==='irregular' ? 10 : 0;
  for (let tries=0; g.nebulae.length<nNeb && tries<400; tries++){
    const [x, z, a] = diskPoint();
    if (a < .55 || Math.hypot(x, z) < g.r0) continue;
    const roll = r(), h = roll<.6 ? .96+r()*.06 : roll<.85 ? .52+r()*.1 : .06+r()*.05;   // red emission, blue reflection, orange
    g.nebulae.push({i:g.nebulae.length, pos:[x*g.R, laplace()*g.hz*.3*g.R, z*g.R], rad:(.008+r()*.014)*g.R,
      a:c(h, .75, .55), b:c(h+(r()<.25 ? .5 : r()<.5 ? .08 : -.06), .7, .55), seed:Math.floor(r()*1e6)});
  }

  const fGlob = .025, fOpen = g.type==='elliptical' ? 0 : .02, fHalo = .02;
  const fBulge = g.type==='elliptical' ? 1 : g.type==='irregular' ? .03 : .1+g.rb*.8, fBar = g.bar ? .07 : 0;
  while (n < N){
    let u = r();
    if ((u -= fGlob) < 0){
      const [cx, cy, cz, s] = globs[Math.floor(r()*globs.length)];
      put(cx+gauss()*s, cy+gauss()*s, cz+gauss()*s, OLD(r()));
    } else if ((u -= fOpen) < 0 && opens.length){
      const [cx, cy, cz, s] = opens[Math.floor(r()*opens.length)];
      put(cx+gauss()*s, cy+gauss()*s*.4, cz+gauss()*s, YOUNG(r()));
    } else if ((u -= fHalo) < 0){
      const d = .1+Math.abs(gauss())*.5, a = r()*Math.PI*2, v = r()*2-1, s = Math.sqrt(1-v*v);
      put(d*s*Math.cos(a), d*v*.6, d*s*Math.sin(a), OLD(r()));
    } else if ((u -= fBulge) < 0){
      // three nested Gaussians like the glow: a broad bulge, an inner bulge and a bright nucleus
      const k = r(), s = g.rb*(k<.6 ? 1 : k<.9 ? .35 : .1);
      put(gauss()*s, gauss()*s*g.flat, gauss()*s, OLD(r()));
    } else if ((u -= fBar) < 0){
      put(gauss()*g.bar*.55, gauss()*g.hz*2, gauss()*g.bar*.17, OLD(r()));
    } else {
      const [x, z, a] = diskPoint();
      const young = g.type==='irregular' ? a > .5 : a > .5;
      put(x, laplace()*g.hz*(young ? .6 : 1.1), z, (young ? YOUNG : DISK)(r()));
    }
  }
  return {N, pos, type};
}

// --- names and seeds of the things in a galaxy ---
export const starSeed = (g, i) => mix64(g.seed, i);
export const nebulaSeed = (g, i) => mix64(g.seed, 1000000+i);
export function starName(g, i){
  if (i===0) return g.home ? 'Forge A*' : g.name.replace(/ (Galaxy|Spiral|Wheel|Cluster|Sphere|Cloud|Drift)$/,'')+' A*';
  return makeName(rngFor(starSeed(g, i) ^ 0x51ed270b2c49a3d1n), false);
}
export function nebulaName(g, n){
  const r = rngFor(nebulaSeed(g, n.i) ^ 0x51ed270b2c49a3d1n), pick = a => a[Math.floor(r()*a.length)];
  if (r() < .35) return pick(['NGC ','IC ','Sh2-','RCW ','LBN '])+(1+Math.floor(r()*3000))+' Nebula';
  let s = ''; for (let i=0,k=2+Math.floor(r()*2);i<k;i++) s += pick(SYL);
  return s[0].toUpperCase()+s.slice(1)+pick([' Nebula',' Nebula',' Cloud',' Veil',' Pillars']);
}
