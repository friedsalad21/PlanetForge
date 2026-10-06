// Find: jump to a seed or link, or search the galaxies of the universe and the stars and nebulae of the current galaxy by name.
import { L } from './state.js';
import { parseAddr } from './nav.js';
import { UNI, makeUniverse } from './universe.js';
import { G } from './galaxy.js';
import { starName, nebulaName, STYPES } from './galaxymodel.js';

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const cap = s => s[0].toUpperCase()+s.slice(1);

// names of every star in a galaxy, worked out in slices so the page stays responsive
async function allNames(onProgress){
  const {N} = G.stars, names = G.names;
  if (names.size >= N) return names;
  const g = G.g;
  for (let i=0;i<N;i++){
    if (!names.has(i)) names.set(i, starName(g, i));
    if (i % 4000 === 3999){ onProgress?.(i/N); await new Promise(r => setTimeout(r)); if (G.g!==g) return null; }
  }
  return names;
}

let searchId = 0;
// results: [{label, detail, hash}]
export async function search(text, onProgress){
  const id = ++searchId;
  const q = norm(text);
  if (!q) return [];
  const out = [];
  const a = parseAddr(q.replace(/^#/, '').replace(/\s+/g, ''));
  if (a) out.push({label: a.kind==='plain' ? 'Seed '+a.seed : 'Go to #'+q.replace(/^#/, ''), detail: a.kind==='plain' ? 'a world of its own' : 'a link', hash:q.replace(/^#/, '')});
  const U = L.U, uPre = U===1n ? '' : 'u'+U+'.';
  makeUniverse(U);
  for (const o of UNI.gals){
    if (out.length > 30) break;
    if (norm(o.g.name).includes(q)) out.push({label:cap(o.g.name), detail:o.g.label, hash:uPre+'g'+o.gi});
  }
  if (G.g && L.gi!=null){
    const g = G.g;
    for (const n of g.nebulae){
      const name = nebulaName(g, n);
      if (norm(name).includes(q)) out.push({label:name, detail:'nebula in '+g.name, hash:uPre+'g'+L.gi+'.n'+n.i});
    }
    const names = await allNames(onProgress);
    if (id!==searchId || !names) return null;   // a newer search took over
    let found = 0;
    for (const [i, name] of names){
      if (norm(name).includes(q)){
        out.push({label:name, detail:STYPES[G.stars.type[i]].name+' in '+g.name, hash:uPre+'g'+L.gi+'.s'+i});
        if (++found >= 25) break;
      }
    }
  }
  return out.slice(0, 40);
}
