// Kepler orbits "on rails": every body's position is a pure function of time, so pausing,
// slow motion and fast-forward are exact and nothing drifts.
import * as THREE from 'three';

// Speeds come from Kepler's third law, n = sqrt(GM / a^3). K sets the overall pace (an inner planet of a
// sun-like star goes round in about half a minute); star masses are compressed (M^0.5) so a blue giant's
// planets don't whirl and a brown dwarf's don't stand still.
const K = .6;
export const meanMotion = (mass, a) => K*Math.sqrt(mass)/a**1.5;
export const visMass = m => Math.sqrt(m);

const Y = new THREE.Vector3(0,1,0), X = new THREE.Vector3(1,0,0);

export class Orbit {
  // a: semi-major axis, e: eccentricity, i: inclination, node: longitude of the ascending node,
  // peri: argument of periapsis, M0: mean anomaly at t = 0, n: mean motion (radians per second)
  constructor({a, e=0, i=0, node=0, peri=0, M0=0, n}){
    Object.assign(this, {a, e, i, node, peri, M0, n});
    this.b = a*Math.sqrt(1-e*e);
    this.q = new THREE.Quaternion().setFromAxisAngle(Y, node)
      .multiply(new THREE.Quaternion().setFromAxisAngle(X, i))
      .multiply(new THREE.Quaternion().setFromAxisAngle(Y, peri));
  }
  get period(){ return 2*Math.PI/Math.abs(this.n); }
  get apo(){ return this.a*(1+this.e); }
  get periapsis(){ return this.a*(1-this.e); }
  // eccentric anomaly from mean anomaly (Kepler's equation M = E - e sin E, by Newton's method)
  eccentric(t){
    const M = ((this.M0 + this.n*t) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI), e = this.e;
    let E = e < .8 ? M : Math.PI;
    for (let k=0; k<12; k++){
      const dE = (E - e*Math.sin(E) - M)/(1 - e*Math.cos(E));
      E -= dE;
      if (Math.abs(dE) < 1e-10) break;
    }
    return E;
  }
  pointAtE(E, out){
    // in the orbital plane (periapsis along +x), moving the same way three.js's +y rotation turns
    return out.set(this.a*(Math.cos(E)-this.e), 0, -this.b*Math.sin(E)).applyQuaternion(this.q);
  }
  at(t, out = new THREE.Vector3()){ return this.pointAtE(this.eccentric(t), out); }
  // velocity direction at time t (for comet dust tails)
  dirAt(t, out = new THREE.Vector3()){
    const E = this.eccentric(t);
    return out.set(-this.a*Math.sin(E), 0, -this.b*Math.cos(E)).applyQuaternion(this.q).multiplyScalar(Math.sign(this.n)).normalize();
  }
}

// a faint ellipse showing an orbit; sampled evenly in eccentric anomaly so it's smooth near periapsis too
const lineMats = {};
export function orbitLine(orbit, color = 0x8fb4ff, opacity = .22){
  const key = color+':'+opacity;
  lineMats[key] ??= new THREE.LineBasicMaterial({color, transparent:true, opacity, depthWrite:false});
  const N = 256, pos = new Float32Array(N*3), v = new THREE.Vector3();
  for (let k=0; k<N; k++){ orbit.pointAtE(k/N*Math.PI*2, v); pos.set([v.x, v.y, v.z], k*3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const line = new THREE.LineLoop(g, lineMats[key]);
  line.frustumCulled = false;
  return line;
}
