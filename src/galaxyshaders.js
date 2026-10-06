// Shaders for galaxies: the glowing volume you fly through, its stars as points of light, galaxies far away
// in the universe view, nebulae you can fly into, and the warp effect between places.
// The galaxy model matches galaxymodel.js (same arms, same integer-hash noise).
import * as THREE from 'three';
import { NOISE, VERT } from './shaders.js';

const num = v => ({value:v});

// --- the shared model (normalized units: 1 = the disk's radius) ---
const GAL = `
struct Gal { float t, arms, pitch, sharp, twist, hR, hz, rb, bar, flt, dust, r0; uint seed; vec3 core, arm, hii; };
uint pcg(uint v){ uint s=v*747796405u+2891336453u; uint w=((s>>((s>>28u)+4u))^s)*277803737u; return (w>>22u)^w; }
float hsh(ivec2 p, uint seed){ return float(pcg(uint(p.x)*1597334677u ^ pcg(uint(p.y)^seed)))*(1./4294967295.); }
float vnoise(vec2 p, uint seed){
  p+=512.; vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); ivec2 I=ivec2(i);
  float a=hsh(I,seed), b=hsh(I+ivec2(1,0),seed), c=hsh(I+ivec2(0,1),seed), d=hsh(I+ivec2(1,1),seed);
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
float fbm2(vec2 p, uint seed){ return .5*vnoise(p,seed)+.3*vnoise(p*2.03+17.,seed)+.2*vnoise(p*4.1+31.,seed); }
float armPhase(vec2 q, Gal g){
  float r=length(q);
  return g.arms*(atan(q.y,q.x)-g.twist*log(max(r,.02)/g.r0)/tan(g.pitch))+(fbm2(q*2.5,g.seed)-.5)*2.;
}
float irrOf(vec2 q, Gal g){ return smoothstep(.35,.7,fbm2(q*1.6+vec2(3.1,7.3),g.seed+11u)); }

// light given off at a point of the disk, and how much dust is there
vec3 diskEmit(vec3 p, Gal g, out float dust){
  float r=length(p.xz), ph=0., a, da;
  if(g.t>1.5){ a=irrOf(p.xz,g); da=.5; }
  else {
    ph=armPhase(p.xz,g);
    float inner=smoothstep(g.r0*.5,g.r0*1.3,r);
    a=pow(.5+.5*cos(ph),g.sharp)*inner;
    da=pow(.5+.5*cos(ph-.6),g.sharp*1.4)*smoothstep(g.r0*.4,g.r0*1.1,r);   // dust lanes hug the inside of each arm
  }
  vec2 sh=p.xz+(g.t>1.5 ? p.y*vec2(1.7,-1.3) : vec2(0.));   // irregulars are thick: shear the noise with height so it isn't extruded
  float n=fbm2(sh*14.,g.seed+7u);
  float vert=exp(-abs(p.y)/g.hz)/(2.*g.hz);
  float disk=(g.t>1.5 ? exp(-r/g.hR)*(.05+.8*a) : exp(-r/g.hR))*vert*(1.-smoothstep(1.25,1.9,r));
  vec3 old=mix(g.core,vec3(1.,.92,.8),smoothstep(.05,.9,r));
  vec3 e=disk*(old*(.28+.5*a)*(.6+.8*n)+g.arm*a*1.6*(.25+n));
  float hv=exp(-abs(p.y)/(g.hz*.6))/(1.2*g.hz);                                 // (a thinner layer than the stars)
  float kn=a>.45 ? vnoise(sh*85.,g.seed+3u)*.65+vnoise(sh*170.,g.seed+5u)*.35 : 0.;
  if(a>.45) e+=g.hii*exp(-r/g.hR)*hv*smoothstep(.45,.8,a)*smoothstep(.7,.88,kn)*6.;   // pink star-forming knots
  if(g.bar>0.){                                                                 // the bar
    float b=exp(-(p.x*p.x)/(g.bar*g.bar*.3)-(p.z*p.z)/(g.bar*g.bar*.03));
    e+=old*b*exp(-abs(p.y)/(g.hz*2.5))/(5.*g.hz)*1.4;
  }
  dust=g.dust*exp(-r/(g.hR*1.4))*exp(-abs(p.y)/(g.hz*.5))/(g.hz)*(.08+da)*(.3+1.4*n)*.22;
  if(g.t>.5 && g.t<1.5) { e=vec3(0.); dust=0.; }
  return e;
}
// just the dust (for dimming stars behind it): the same as diskEmit's, without the light
float dustAt(vec3 p, Gal g){
  if(g.t>.5&&g.t<1.5) return 0.;
  float r=length(p.xz), da=.5;
  if(g.t<1.5) da=pow(.5+.5*cos(armPhase(p.xz,g)-.6),g.sharp*1.4)*smoothstep(g.r0*.4,g.r0*1.1,r);
  vec2 sh=p.xz+(g.t>1.5 ? p.y*vec2(1.7,-1.3) : vec2(0.));
  float n=fbm2(sh*14.,g.seed+7u);
  return g.dust*exp(-r/(g.hR*1.4))*exp(-abs(p.y)/(g.hz*.5))/(g.hz)*(.08+da)*(.3+1.4*n)*.22;
}

float erf_(float x){
  float s=sign(x), a=abs(x), t=1./(1.+.3275911*a);
  return s*(1.-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*exp(-a*a));
}
// ∫ exp(-|o+t d|²/(2s²)) dt from ta to tb
float gline(vec3 o, vec3 d, float s, float ta, float tb){
  float A=dot(d,d), B=dot(o,d), C=dot(o,o), tc=-B/A, k=sqrt(A/(2.*s*s));
  return exp(-max(C-B*B/A,0.)/(2.*s*s))*s*sqrt(1.5708/A)*(erf_(k*(tb-tc))-erf_(k*(ta-tc)));
}
// the bulge: three nested Gaussians integrated exactly along the ray; the far half shines through the disk's dust (Tc)
vec3 bulgeLight(vec3 o, vec3 d, float tc, float Tc, Gal g){
  vec3 sc=vec3(1.,1./g.flt,1.); vec3 o2=o*sc, d2=d*sc;
  float f=0., b=0., ell=g.t>.5&&g.t<1.5 ? 2.2 : 1.;
  for(int i=0;i<3;i++){
    float s=g.rb*(i==0 ? 1. : i==1 ? .35 : .1), w=(i==0 ? 1.6 : i==1 ? 1.3 : 1.)*ell/(2.5066*s);
    f+=w*gline(o2,d2,s,0.,tc); b+=w*gline(o2,d2,s,tc,1e3);
  }
  return g.core*(f*mix(1.,Tc,.3)+b*Tc);
}
`;

// one galaxy's shape as uniforms (shared by its volume and its points)
export function galUniforms(){
  const u = {};
  for (const k of ['uT','uArms','uPitch','uSharp','uTwist','uHR','uHz','uRb','uBar','uFlat','uDust','uR0']) u[k] = num(0);
  u.uSeed = num(0); u.uCore = {value:new THREE.Color()}; u.uArm = {value:new THREE.Color()}; u.uHii = {value:new THREE.Color()};
  u.uCam = {value:new THREE.Vector3()}; u.uScale = num(1);
  return u;
}
export function setGal(u, g){
  Object.assign(u.uT, {value:g.t}); u.uArms.value = g.arms; u.uPitch.value = g.pitch; u.uSharp.value = g.sharp; u.uTwist.value = g.twist;
  u.uHR.value = g.hR; u.uHz.value = g.hz; u.uRb.value = g.rb; u.uBar.value = g.bar; u.uFlat.value = g.flat; u.uDust.value = g.dust;
  u.uR0.value = g.r0; u.uSeed.value = g.nseed; u.uScale.value = g.R;
  u.uCore.value.copy(g.core); u.uArm.value.copy(g.arm); u.uHii.value.copy(g.hii);
}
const GAL_U = `uniform float uT,uArms,uPitch,uSharp,uTwist,uHR,uHz,uRb,uBar,uFlat,uDust,uR0,uScale; uniform uint uSeed;
uniform vec3 uCore,uArm,uHii,uCam;
Gal galU(){ return Gal(uT,uArms,uPitch,uSharp,uTwist,uHR,uHz,uRb,uBar,uFlat,uDust,uR0,uSeed,uCore,uArm,uHii); }
`;

// --- the galaxy's glow: ray-marched through the disk, the bulge added analytically ---
export function makeVolumeMat(u){
  return new THREE.ShaderMaterial({
    side:THREE.BackSide, depthTest:false, depthWrite:false, transparent:true, blending:THREE.AdditiveBlending,
    uniforms:{...u, uSteps:num(48), uExposure:num(1), uGamma:num(1), uBright:num(1), uFade:num(1)},
    vertexShader:`varying vec3 vP; uniform float uScale; void main(){ vP=position/uScale; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: GAL + GAL_U + `uniform int uSteps; uniform float uExposure,uGamma,uBright,uFade; varying vec3 vP;
    void main(){
      Gal g=galU();
      vec3 o=uCam, d=normalize(vP-uCam);
      const float RS=2.2;
      float b=dot(o,d), c=dot(o,o)-RS*RS, h=b*b-c;
      if(h<0.) discard;
      h=sqrt(h);
      float ts0=max(-b-h,0.), ts1=-b+h;
      float H=g.t>1.5 ? 4.*g.hz : 5.*g.hz, ta=1., tb=0.;
      if(g.t<.5||g.t>1.5){
        if(abs(d.y)<1e-6){ if(abs(o.y)<H){ ta=ts0; tb=ts1; } }
        else { float t1=(-H-o.y)/d.y, t2=(H-o.y)/d.y; ta=max(ts0,min(t1,t2)); tb=min(ts1,max(t1,t2)); }
      }
      vec3 sc=vec3(1.,1./g.flt,1.);
      float tc=max(0.,-dot(o*sc,d*sc)/dot(d*sc,d*sc)), Tc=1., T=1.;
      vec3 col=vec3(0.);
      if(tb>ta){
        float dt=(tb-ta)/float(uSteps), j=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
        for(int i=0;i<128;i++){
          if(i>=uSteps) break;
          float t=ta+(float(i)+j)*dt; float du;
          vec3 e=diskEmit(o+d*t,g,du);
          col+=T*e*dt; T*=exp(-du*dt);
          if(t<tc) Tc=T;
        }
      }
      col+=bulgeLight(o,d,tc,Tc,g);
      col=(1.-exp(-pow(col*uExposure,vec3(uGamma))))*uBright*uFade;   // (uGamma > 1 inside the disk: a dark sky with a bright band)
      col+=(fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))-.5)/255.;   // dither: no banding in the smooth glow
      gl_FragColor=vec4(col,1.);
      #include <colorspace_fragment>
    }`,
  });
}

// --- its stars: points that grow and brighten as you get close, dimmed by the dust in front of them ---
export function makeStarPointsMat(u){
  return new THREE.ShaderMaterial({
    transparent:true, depthTest:false, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:{...u, uPx:num(600), uBright:num(1), uFade:num(1), uFloor:num(0), uMaxPx:num(96)},
    vertexShader: GAL + GAL_U + `attribute float aLum; attribute vec3 aCol; uniform float uPx,uFloor,uMaxPx;
    varying vec3 vC; varying float vS;
    void main(){
      vec4 mv=modelViewMatrix*vec4(position,1.);
      float d=max(-mv.z,1e-4);
      float px=.06*sqrt(aLum)*uPx/d;              // glow radius in pixels
      // stars too far to pick out fade fast: their light is already in the glow, and thousands of faint dots would grey the sky
      float I=min(1.,pow(px/1.6,4.))+uFloor*min(aLum,8.)/8.;
      // dust between us and the star
      vec3 p=position/uScale, o=uCam; float tau=0.;
      if(I>.004){ for(int i=0;i<5;i++) tau+=dustAt(mix(o,p,(float(i)+.5)/5.),galU()); tau*=length(p-o)/5.; }
      I*=exp(-tau);
      vC=aCol*min(I,1.)*(1.+.25*min(px/40.,3.));
      float s=max(px,1.6);
      vS=s;
      gl_PointSize=min(s*3.,uMaxPx);
      gl_Position=projectionMatrix*mv;
      if(I<.004) gl_Position=vec4(2.,2.,2.,1.);
    }`,
    fragmentShader:`uniform float uBright,uFade; varying vec3 vC; varying float vS;
    void main(){
      vec2 q=gl_PointCoord*2.-1.; float r2=dot(q,q);
      if(r2>1.) discard;
      float k=9.;                                  // core + soft halo, with faint diffraction spikes on the bright ones
      float a=exp(-r2*k)+.12*exp(-r2*2.5);
      a+=smoothstep(14.,40.,vS)*.35*(exp(-abs(q.x)*40.)+exp(-abs(q.y)*40.))*(1.-sqrt(r2));
      gl_FragColor=vec4(vC*a*uBright*uFade,1.);
      #include <colorspace_fragment>
    }`,
  });
}

// --- markers: visited stars and the one under the pointer ---
export const markerMat = new THREE.ShaderMaterial({
  transparent:true, depthTest:false, depthWrite:false, blending:THREE.AdditiveBlending,
  uniforms:{ uColor:{value:new THREE.Color(.35,.75,1)}, uSize:num(14), uFade:num(1) },
  vertexShader:`uniform float uSize; void main(){ gl_PointSize=uSize; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader:`uniform vec3 uColor; uniform float uFade;
  void main(){ float r=length(gl_PointCoord*2.-1.); float a=smoothstep(.72,.8,r)*(1.-smoothstep(.88,.96,r));
    if(a<=0.) discard; gl_FragColor=vec4(uColor*a*uFade,1.); }`,
});

// --- a nebula you can fly into: ray-marched glowing gas with dark dust ---
export function makeNebulaVolMat(){
  return new THREE.ShaderMaterial({
    side:THREE.BackSide, depthTest:false, depthWrite:false, transparent:true, blending:THREE.AdditiveBlending,
    uniforms:{ uA:{value:new THREE.Color()}, uB:{value:new THREE.Color()}, uCamL:{value:new THREE.Vector3()}, uSeed:{value:new THREE.Vector3()},
      uSteps:num(28), uFade:num(1) },
    vertexShader: VERT,
    fragmentShader: NOISE + `uniform vec3 uA,uB,uCamL,uSeed; uniform int uSteps; uniform float uFade; varying vec3 vPos;
    float dens(vec3 p, out float m){
      vec3 q=p*2.2+uSeed;
      q+=.5*vec3(snoise(q*.6),snoise(q*.6+5.),snoise(q*.6+9.));
      float f=snoise(q)*.5+.25*snoise(q*2.1)+.125*snoise(q*4.3);
      m=snoise(q*.7+3.)*.5+.5;
      float fall=1.-smoothstep(.2,1.,length(p));
      return max(f+.25,0.)*fall*fall;
    }
    void main(){
      vec3 o=uCamL, d=normalize(vPos-uCamL);
      float b=dot(o,d), c=dot(o,o)-1., h=b*b-c;
      if(h<0.) discard;
      h=sqrt(h);
      float t0=max(-b-h,0.), t1=-b+h, dt=(t1-t0)/float(uSteps);
      float j=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
      vec3 col=vec3(0.); float T=1.;
      for(int i=0;i<64;i++){
        if(i>=uSteps) break;
        vec3 p=o+d*(t0+(float(i)+j)*dt); float m;
        float g=dens(p,m);
        float dust=smoothstep(.55,.8,m)*g*6.;                       // dark lanes and pillars
        col+=T*mix(uA,uB,smoothstep(.3,.7,m))*g*dt*2.6;
        T*=exp(-dust*dt);
      }
      col=(1.-exp(-col*1.6))*uFade;
      gl_FragColor=vec4(col,1.);
      #include <colorspace_fragment>
    }`,
  });
}

// --- galaxies far away (universe view, and other galaxies in a galaxy's sky): one quad each, facing the camera.
// Each pixel intersects its ray with the galaxy's disk plane and integrates the bulge, so tilted and edge-on
// galaxies (with their dust lanes) come out right, at the cost of a few maths ops per pixel.
export function makeImpostorMat(){
  return new THREE.ShaderMaterial({
    transparent:true, depthTest:false, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:{ uPx:num(600), uBright:num(1), uFade:num(1), uMinPx:num(1.5), uCamL:{value:new THREE.Vector3()} },
    vertexShader:`attribute vec3 aPos; attribute vec4 aQuat, aP1, aP2, aP3; attribute vec3 aCore, aArm, aHii; attribute float aHide, aSeed;
    uniform float uPx, uMinPx; uniform vec3 uCamL;   // the camera in this mesh's own frame
    varying vec3 vO, vP; flat out vec4 vP1, vP2, vP3; flat out vec3 vCore, vArm, vHii; flat out float vSeed; varying float vDim;
    vec3 rotInv(vec4 q, vec3 v){ q.xyz=-q.xyz; vec3 t=2.*cross(q.xyz,v); return v+q.w*t+cross(q.xyz,t); }
    void main(){
      float R=aP3.z, ext=R*(aP1.x>.5&&aP1.x<1.5 ? 1.3 : 2.);         // half-size of the quad
      vec3 toCam=uCamL-aPos; float dist=length(toCam);
      float px=ext*uPx/dist, grow=max(1.,uMinPx*2./max(px,1e-4));      // tiny ones stay at least a couple of pixels
      vDim=1./(grow*grow);
      vec3 fwd=toCam/dist, side=normalize(cross(abs(fwd.y)<.99?vec3(0,1,0):vec3(1,0,0),fwd)), up=cross(fwd,side);
      vec3 w=aPos+(side*position.x+up*position.y)*ext*grow;
      vO=rotInv(aQuat,uCamL-aPos)/R; vP=rotInv(aQuat,w-aPos)/R;
      vP1=aP1; vP2=aP2; vP3=aP3; vSeed=aSeed; vCore=aCore; vArm=aArm; vHii=aHii;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(w,1.);
      if(aHide>.5||dist>uPx*R*400.) gl_Position=vec4(2.,2.,2.,1.);
    }`,
    fragmentShader: GAL + `uniform float uBright,uFade; varying vec3 vO, vP; flat in vec4 vP1, vP2, vP3; flat in vec3 vCore, vArm, vHii; flat in float vSeed; varying float vDim;
    void main(){
      // packed as aP1 (type, arms, pitch, sharp), aP2 (twist, hR, hz, rb), aP3 (bar, flat, R, dust)
      Gal g=Gal(vP1.x,vP1.y,vP1.z,vP1.w,vP2.x,vP2.y,vP2.z,vP2.w,vP3.x,vP3.y,vP3.w,0.,uint(vSeed),vCore,vArm,vHii);
      g.r0=g.bar>0.?g.bar:g.rb*1.6;
      vec3 o=vO, d=normalize(vP-vO);
      vec3 col=vec3(0.); float Tc=1., tc;
      vec3 sc=vec3(1.,1./g.flt,1.);
      tc=max(0.,-dot(o*sc,d*sc)/dot(d*sc,d*sc));
      if(g.t<.5||g.t>1.5){
        float t=-o.y/d.y;
        if(t>0.){
          vec3 p=o+d*t; p.y=0.; float du;
          float path=min(1./max(abs(d.y),1e-3),g.t>1.5 ? 2.5 : 1./(2.*g.hz));   // slant path through the disk, capped edge-on
          col+=diskEmit(p,g,du)*2.*g.hz*path;
          if(t<tc) Tc=exp(-du*2.*g.hz*path);
        }
      }
      col+=bulgeLight(o,d,tc,Tc,g);
      col=(1.-exp(-col*.9))*uBright*uFade*vDim;
      col+=(fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))-.5)/255.*step(.02,col.r+col.g);
      gl_FragColor=vec4(col,1.);
      #include <colorspace_fragment>
    }`,
  });
}

// --- warp: a zoom blur that stretches the stars into streaks and washes out to white at its peak ---
export const WarpShader = {
  uniforms:{ tDiffuse:{value:null}, uAmt:num(0), uFlash:num(0), uDir:num(1) },
  vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader:`uniform sampler2D tDiffuse; uniform float uAmt,uFlash,uDir; varying vec2 vUv;
  void main(){
    vec2 c=vec2(.5), dlt=vUv-c;
    vec3 acc=vec3(0.); float ws=0.;
    for(int i=0;i<28;i++){
      float t=float(i)/27., w=1.-t*.6;
      acc+=texture2D(tDiffuse,c+dlt*(1.-uAmt*.55*t)).rgb*w; ws+=w;
    }
    vec3 col=acc/ws*(1.+uAmt*1.8);
    float r=length(dlt);
    col+=vec3(.55,.7,1.)*uAmt*uAmt*smoothstep(.0,.7,r)*.35;           // a blue tunnel glow at the edges
    col=mix(col,vec3(1.,.97,.93)*3.,uFlash);
    gl_FragColor=vec4(col,1.);
  }`,
};

// --- a star system's sky: the galaxy as seen from its star, rendered once into a cube map ---
export function makeBandMat(tex){
  return new THREE.ShaderMaterial({
    side:THREE.BackSide, depthWrite:false, transparent:true, blending:THREE.AdditiveBlending,
    uniforms:{ uCube:{value:tex}, uStr:num(1) },
    vertexShader: VERT,
    fragmentShader:`uniform samplerCube uCube; uniform float uStr; varying vec3 vPos;
    void main(){ gl_FragColor=vec4(textureCube(uCube,normalize(vPos)).rgb*uStr,1.);
      #include <colorspace_fragment>
    }`,
  });
}
