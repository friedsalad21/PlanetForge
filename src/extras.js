// The rarer things in a system: space stations and wrecks, Dyson swarms, comets, asteroid belts,
// glowing nebula shells, protoplanetary disks and pulsar beams.
import * as THREE from 'three';
import { shellMat, dustDiskMat, beamMat, cometMat } from './materials.js';
import { ownArrays } from './shaders.js';
import { SOFT_TEX, ROUND_TEX, pxScale } from './scene.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({color, metalness:.55, roughness:.45, ...o});

// --- space stations: a wheel on a hub, solar wings, lit windows and blinking lights; wrecks are broken and tumbling ---
export function makeStation(x, derelict){
  const group = new THREE.Group(), frame = new THREE.Group();
  group.add(frame);
  const hull = std(derelict ? 0x6e5c4c : 0xc9cdd3), dark = std(0x2c3036, {metalness:.7});
  const panel = std(0x1a2c66, {metalness:.25, roughness:.3, emissive:0x04081a});
  const lit = new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,1.3,.9)});
  const style = x();
  const add = (geo, mat, f) => { const m = new THREE.Mesh(geo, mat); f?.(m); frame.add(m); return m; };
  add(new THREE.CylinderGeometry(.16,.16,1.5,24), hull);                          // hub
  add(new THREE.CylinderGeometry(.22,.22,.25,24), dark, m => m.position.y = .55);
  add(new THREE.CylinderGeometry(.22,.22,.25,24), dark, m => m.position.y = -.55);
  const wheels = style < .35 ? [0] : style < .7 ? [-.28,.28] : [0];
  for (const y of wheels){
    // a wreck's wheel is broken into a few separate arcs
    const arcs = derelict ? Array.from({length:2+Math.floor(x()*3)}, () => [x()*Math.PI*2, .6+x()*1.4]) : [[0, Math.PI*2]];
    for (const [start, len] of arcs){
      add(new THREE.TorusGeometry(1, .09, 12, 96, len), hull, m => { m.rotation.x = Math.PI/2; m.rotation.z = start; m.position.y = y; });
      if (!derelict) add(new THREE.TorusGeometry(1.002, .03, 6, 96, len), lit, m => { m.rotation.x = Math.PI/2; m.position.y = y; m.scale.z = 1.6; });
    }
    for (let s=0;s<4;s++) if (!derelict || x()<.6)
      add(new THREE.CylinderGeometry(.03,.03,1,8), dark, m => { m.rotation.z = Math.PI/2; m.rotation.y = s*Math.PI/2; m.position.y = y;
        m.position.x = Math.cos(s*Math.PI/2)*.5; m.position.z = -Math.sin(s*Math.PI/2)*.5; });
  }
  if (style >= .7){   // a long truss with modules, like a big ISS
    add(new THREE.BoxGeometry(2.6,.06,.06), dark);
    for (let i=0;i<4;i++) add(new THREE.CylinderGeometry(.1,.1,.5,16), hull, m => { m.rotation.z = Math.PI/2; m.position.x = -1+i*.65; });
  }
  // solar wings at both ends of the hub
  for (const sy of [1,-1]) for (const sx of [1,-1]) if (!derelict || x()<.5)
    add(new THREE.BoxGeometry(.9,.012,.32), panel, m => { m.position.set(sx*.62, sy*.78, 0); });
  // blinking navigation lights (red / green), dark on a wreck
  const lights = [];
  if (!derelict) for (const [col, px] of [[0xff3030, 1.12],[0x30ff60, -1.12]]){
    const s = new THREE.Sprite(new THREE.SpriteMaterial({map:SOFT_TEX, color:col, blending:THREE.AdditiveBlending, depthWrite:false}));
    s.position.set(px, wheels[0], 0); s.scale.setScalar(.35); frame.add(s); lights.push(s);
  }
  const tumble = new THREE.Vector3(x()-.5, x()-.5, x()-.5).normalize();
  let t = 0;
  frame.rotation.set(x()*6, x()*6, x()*6);
  if (!derelict) frame.rotation.set(0,0,0);
  return { group, derelict, spin(dt){
    t += dt;
    if (derelict) frame.rotateOnAxis(tumble, dt*.15);
    else frame.rotation.y += dt*.4;                                  // spin gravity
    lights.forEach((s,i) => s.material.opacity = (Math.sin(t*3+i*Math.PI) > .6) ? 1 : .08);
  }};
}

// --- Dyson swarm (rings of mirrors around the star) or a partly built Dyson shell ---
export function makeDyson(x, R){
  const group = new THREE.Group(), rings = [];
  const mat = std(0xffd890, {metalness:.95, roughness:.2, side:THREE.DoubleSide, emissive:0x1c0c00});
  const shell = x() < .3;
  if (!shell){
    const nRings = 3+Math.floor(x()*4), hex = new THREE.CircleGeometry(1, 6), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    const s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0,1,0);
    for (let i=0;i<nRings;i++){
      const ring = new THREE.Group(), N = 500+Math.floor(x()*400), rr = R*(.92+x()*.16);
      const mesh = new THREE.InstancedMesh(hex, mat, N);
      for (let j=0;j<N;j++){
        const a = j/N*Math.PI*2 + x()*.01;
        p.set(Math.cos(a)*rr, (x()-.5)*R*.02, -Math.sin(a)*rr);
        q.setFromRotationMatrix(m4.lookAt(p, new THREE.Vector3(), up));   // each mirror faces the star
        s.setScalar(R*(.011+x()*.008));
        mesh.setMatrixAt(j, m4.compose(p, q, s));
      }
      ring.add(mesh);
      ring.rotation.set((x()-.5)*Math.PI, x()*Math.PI*2, (x()-.5)*Math.PI);
      const spinner = new THREE.Group(); spinner.add(ring);   // ring spins in its own tilted plane
      group.add(spinner);
      rings.push({ring:mesh, speed:.15/Math.sqrt(rr)*(x()<.5?1:-1)});
    }
  } else {
    // geodesic shell, roughly half the panels in place, with glowing seams
    const ico = new THREE.IcosahedronGeometry(R, 4), src = ico.attributes.position.array, keep = [];
    const a = new THREE.Vector3(), b = new THREE.Vector3(), cc = new THREE.Vector3(), cen = new THREE.Vector3();
    const band = x()*Math.PI*2;
    for (let i=0;i<src.length;i+=9){
      a.fromArray(src,i); b.fromArray(src,i+3); cc.fromArray(src,i+6);
      cen.copy(a).add(b).add(cc).divideScalar(3);
      const lon = Math.atan2(cen.z, cen.x);
      if (Math.sin(lon*2+band)*.5+.5 + x()*.6 < .75) continue;           // built in patches
      for (const v of [a,b,cc]) v.lerp(cen,.08), keep.push(v.x, v.y, v.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(keep,3));
    g.computeVertexNormals();
    group.add(new THREE.Mesh(g, mat));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(R*1.002, 2)),
      new THREE.LineBasicMaterial({color:new THREE.Color(1.4,.8,.3), transparent:true, opacity:.35, blending:THREE.AdditiveBlending, depthWrite:false}));
    group.add(edges);
    rings.push({ring:group, speed:.01});
  }
  return { group, shell, update(dt){ for (const r of rings) r.ring.rotation.y += dt*r.speed; } };
}

// --- comets ---
export function makeComet(x, orbit){
  const group = new THREE.Group();
  const nucleus = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), std(0x4a4440, {metalness:0, roughness:.95}));
  { // lumpy potato shape
    const p = nucleus.geometry.attributes.position, v = new THREE.Vector3(), o = [x(),x(),x()].map(k=>k*9);
    for (let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i); v.multiplyScalar(1+.25*Math.sin(v.x*3+o[0])*Math.sin(v.y*2+o[1])+.15*Math.sin(v.z*4+o[2])); p.setXYZ(i,v.x,v.y*.75,v.z); }
    nucleus.geometry.computeVertexNormals();
  }
  nucleus.scale.setScalar(.012);
  const coma = new THREE.Sprite(new THREE.SpriteMaterial({map:SOFT_TEX, color:new THREE.Color(.7,.95,1), blending:THREE.AdditiveBlending, depthWrite:false}));
  const N = 16000, aP = new Float32Array(N*4);
  for (let i=0;i<N;i++) aP.set([Math.random()**.8, Math.random()*Math.PI*2, Math.sqrt(Math.random()), Math.random()], i*4);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N*3),3));
  g.setAttribute('aP', new THREE.BufferAttribute(aP,4));
  const tail = new THREE.Points(g, cometMat.clone());
  tail.frustumCulled = false;
  const u = tail.material.uniforms;
  u.uScale = pxScale; u.uSize.value = .022;
  u.uDust.value.copy(new THREE.Color(1,.85,.6)); u.uIon.value.copy(new THREE.Color(.45,.7,1.3));
  group.add(nucleus, coma, tail);
  const q = orbit.periapsis, back = new THREE.Vector3();
  return { group, nucleus, orbit, update(t, starPos){
    orbit.at(t, group.position);
    const anti = group.position.clone().sub(starPos), d = anti.length();
    anti.normalize();
    const act = Math.min(1.4, (q*1.8/d)**2);                         // the tail grows near the star
    u.uAnti.value.copy(anti); u.uBack.value.copy(orbit.dirAt(t, back)).negate();
    u.uLen.value = .25+2.2*act; u.uAct.value = Math.min(1, act*1.5); u.uTime.value = t;
    coma.scale.setScalar(.03+.16*act);
    coma.material.opacity = .2+.45*Math.min(1,act);
    nucleus.rotation.y += .01;
  }};
}

// --- asteroid belt ---
export function makeBelt(r, radius, width){
  const N = 5000, pos = new Float32Array(N*3);
  for (let i=0;i<N;i++){
    const a = r()*Math.PI*2, d = radius+(r()+r()-1)*width;
    pos.set([Math.cos(a)*d, (r()-.5)*width*.15, Math.sin(a)*d], i*3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const icy = r()<.35;
  return new THREE.Points(g, new THREE.PointsMaterial({size:.022, sizeAttenuation:true, transparent:true, depthWrite:false,
    map:ROUND_TEX, color:icy ? new THREE.Color().setHSL(.58,.25,.8,THREE.SRGBColorSpace) : new THREE.Color().setHSL(.07,.2,.5,THREE.SRGBColorSpace)}));
}

// --- glowing shells of gas ---
const SHELL_GEO = new THREE.SphereGeometry(1, 96, 64);
export function makeShell(x, radius, a, b, {fil=1, waist=0, str=1, freq=3, squash=1} = {}){
  const mesh = new THREE.Mesh(SHELL_GEO, ownArrays(shellMat.clone()));
  const u = mesh.material.uniforms;
  u.uSeed.value.set(x()*50, x()*50, x()*50);
  u.uA.value.copy(a); u.uB.value.copy(b);
  Object.assign(u.uFil, {value:fil}); u.uWaist.value = waist; u.uStr.value = str; u.uFreq.value = freq;
  mesh.scale.set(radius, radius*squash, radius);
  mesh.rotation.set(x()*Math.PI, x()*Math.PI, 0);
  mesh.renderOrder = 4;
  return mesh;
}

// --- protoplanetary disk ---
export function makeDustDisk(inner, outer, gaps, a, b){
  const mesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 256, 4), dustDiskMat.clone());
  mesh.rotation.x = -Math.PI/2;
  const u = mesh.material.uniforms;
  u.uIn.value = inner; u.uOut.value = outer;
  u.uGaps.value = gaps.slice(0,6).concat([0,0,0,0,0,0]).slice(0,6); u.uGapN.value = Math.min(6, gaps.length);
  u.uA.value.copy(a); u.uB.value.copy(b);
  return mesh;
}

// --- pulsar: two faint beams along a magnetic axis tipped away from the spin axis ---
export function makePulsar(x, col){
  const spin = new THREE.Group(), tilt = new THREE.Group();
  spin.add(tilt);
  tilt.rotation.z = .35+x()*.6;
  const geo = new THREE.ConeGeometry(.16, 7, 32, 1, true);
  for (const s of [1,-1]){
    const m = new THREE.Mesh(geo, beamMat.clone());
    m.material.uniforms.uCol.value.copy(col); m.material.uniforms.uStr.value = .035;
    m.position.y = s*3.5; if (s>0) m.rotation.z = Math.PI;
    tilt.add(m);
  }
  const axis = new THREE.Vector3(), period = .6+x()*1.2;
  return { group:spin, period, axisWorld(out){ return out.set(0,1,0).applyQuaternion(tilt.getWorldQuaternion(new THREE.Quaternion())); },
    update(dt){ spin.rotation.y += dt*Math.PI*2/period; } };
}
