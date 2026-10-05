import * as THREE from 'three';

// 3D simplex noise, Ashima Arts / Stefan Gustavson (MIT)
export const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g;
  vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
// fbm with level of detail: keeps adding finer octaves until they'd be smaller than a pixel,
// so detail stays sharp at any zoom. gPx = pixel footprint on the unit sphere, set at the top of main();
// s = how much the caller scaled p.
float gPx=0.;
float fbm(vec3 p, float s){
  float sum=0., a=.5, px=gPx*s;
  for(int i=0;i<12;i++){
    float w=1.-smoothstep(.25,.5,px);   // fade the last octave in instead of popping
    if(w<=0.) break;
    sum+=a*w*snoise(p); p=p*2.03+1.7; px*=2.03; a*=.5;
  }
  return sum;
}
// ridged fbm: sharp mountain chains instead of round hills
float ridged(vec3 p, float s){
  float sum=0., a=.5, px=gPx*s;
  for(int i=0;i<12;i++){
    float w=1.-smoothstep(.25,.5,px);
    if(w<=0.) break;
    float n=1.-abs(snoise(p)); sum+=a*w*n*n; p=p*2.03+1.7; px*=2.03; a*=.5;
  }
  return sum;
}
vec3 hash3(vec3 p){p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));return fract(sin(p)*43758.5453);}
// one crater per grid cell: a bowl with a raised rim
float craters(vec3 p){
  vec3 i=floor(p), f=fract(p); float h=0.;
  for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){
    vec3 g=vec3(x,y,z), o=hash3(i+g);
    float d=length(g+o-f)/(.2+.3*o.x);
    h+=d<1.?(d*d-1.)*.5:0.;
    h+=.2*exp(-(d-1.)*(d-1.)*30.);
  }
  return h;
}
// rotate v around the unit axis k by angle a (Rodrigues)
vec3 rotAround(vec3 v, vec3 k, float a){ float c=cos(a), s=sin(a); return v*c+cross(k,v)*s+k*dot(k,v)*(1.-c); }
`;

// ring density as a function of t (0 = inner edge, 1 = outer edge); shared by the ring itself,
// the shadow it casts on the planet and clouds, and the ring particles, so their gaps all line up
export const RINGFN = `
float h1(float x){return fract(sin(x*127.1)*43758.5);}
float n1(float x){float i=floor(x);return mix(h1(i),h1(i+1.),smoothstep(0.,1.,fract(x)));}
float ringBands(float t, vec3 K){ return n1(t*K.x)*.5+n1(t*K.y+9.)*.3+n1(t*K.z+3.)*.2; }
float ringAlpha(float t, float b, vec2 gaps, float dust){
  float gap=smoothstep(.0,.03,abs(t-gaps.x))*smoothstep(.0,.015,abs(t-gaps.y));   // Cassini-style gaps
  return clamp(b*1.5-.1,0.,1.)*gap*smoothstep(0.,.04,t)*(1.-smoothstep(.9,1.,t))*.9*dust;
}
// fraction of sunlight blocked by the ring for point p (planet-local; ring lies in the y=0 plane)
uniform float uRinged,uRIn,uROut,uRDust; uniform vec3 uRK; uniform vec2 uRGaps;
float ringShadow(vec3 p, vec3 sun){
  if(uRinged<.5 || abs(sun.y)<.001) return 0.;
  float d=-p.y/sun.y;
  if(d<=0.) return 0.;
  float rt=(length((p+sun*d).xz)-uRIn)/(uROut-uRIn);
  return ringAlpha(rt,ringBands(rt,uRK),uRGaps,uRDust);
}
`;
export const ringUniforms = () => ({ uRinged:{value:0}, uRIn:{value:1.4}, uROut:{value:2.2}, uRDust:{value:1},
  uRK:{value:new THREE.Vector3()}, uRGaps:{value:new THREE.Vector2()} });

// cloud cover, shared by the cloud layer and the shadows it casts on the ground (needs uTime declared first)
export const CLOUDFN = `
uniform float uCloud,uStretch,uSwirl;
float cloudDensity(vec3 p, vec3 seed){
  vec3 q=p*vec3(2.,2.*uStretch,2.)+seed.zxy+uTime*.015;
  if(uSwirl>0.) q+=uSwirl*vec3(snoise(q*.6+2.),snoise(q*.6+5.),snoise(q*.6+9.));   // storm swirls
  return fbm(q,2.*uStretch);
}
`;
export const cloudUniforms = () => ({ uCloud:{value:.2}, uStretch:{value:1.75}, uSwirl:{value:0} });

export const VERT = `varying vec3 vPos; void main(){ vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
export const col3 = () => ({value:new THREE.Color()});
export const num = v => ({value:v});

// eclipses: up to four spheres (moons, or the planet seen from a moon) that can block the sun.
// uOcc[i] = centre (in the shaded body's own space) + radius; uSunAng = the sun's angular radius,
// which sets how wide the soft penumbra is
export const ECLIPSE = `
uniform vec4 uOcc[4]; uniform float uOccN,uSunAng;
float eclipse(vec3 p, vec3 sun){
  float lit=1.;
  for(int i=0;i<4;i++){
    if(float(i)>=uOccN) break;
    vec3 c=uOcc[i].xyz-p; float r=uOcc[i].w, t=dot(c,sun);
    if(t<=0.) continue;
    float d=length(c-sun*t), pen=max(t*uSunAng,1e-5);
    // full shadow inside the umbra; a small occluder far away only dims the sun (antumbra)
    lit*=1.-(1.-smoothstep(r-pen,r+pen,d))*min(1.,r*r/(pen*pen));
  }
  return lit;
}
`;
const vec4s = n => ({value:Array.from({length:n},()=>new THREE.Vector4())});
export const eclipseUniforms = () => ({ uOcc:vec4s(4), uOccN:{value:0}, uSunAng:{value:.01} });

// volcanoes: direction on the unit sphere + size (negative size = dormant, no ash plume)
export const VOLC = `uniform vec4 uVolc[6]; uniform float uVolcN;`;
export const volcUniforms = () => ({ uVolc:vec4s(6), uVolcN:{value:0} });

// material.clone() copies uniform arrays shallowly, so every clone would share the same vectors;
// give a clone its own
export function ownArrays(mat){
  for (const u of Object.values(mat.uniforms))
    if (Array.isArray(u.value)) u.value = u.value.map(v => v.clone());
  return mat;
}

// ray / sphere intersection: distances to the near and far hit (far < near when it misses)
export const RAYSPHERE = `
vec2 raySphere(vec3 ro, vec3 rd, float R){
  float b=dot(ro,rd), c=dot(ro,ro)-R*R, d=b*b-c;
  if(d<0.) return vec2(1e9,-1e9);
  d=sqrt(d); return vec2(-b-d,-b+d);
}
`;
