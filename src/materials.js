// Every shader in PlanetForge. Materials here are templates: each body clones the one it needs
// (and calls ownArrays on the clone), so they all share one compiled program but keep their own uniforms.
import * as THREE from 'three';
import { NOISE, RINGFN, CLOUDFN, ECLIPSE, VOLC, RAYSPHERE, VERT, col3, num,
  ringUniforms, cloudUniforms, eclipseUniforms, volcUniforms } from './shaders.js';

const v3 = () => ({value:new THREE.Vector3()});

// --- planets and moons ---
export const bodyMat = new THREE.ShaderMaterial({
  uniforms: {
    uSeed:v3(), uFreq:num(1), uSea:num(0), uIce:num(.8), uLava:num(0),
    uGas:num(0), uBands:num(10), uCity:num(0), uCrater:num(0), uTime:num(0),
    uWarp:num(0), uRidge:num(0), uTerrace:num(0), uLocked:num(0), uGlow:num(0), uMoist:num(0),
    uTurb:num(2), uStorms:num(1), uSharp:num(0), uStormKind:num(0), uHex:num(0),
    uSeason:num(0), uRivers:num(0), uVolcCol:col3(),
    uDeep:col3(), uShallow:col3(), uSand:col3(), uLow:col3(), uLow2:col3(), uHigh:col3(), uRock:col3(), uSnow:col3(), uAtmo:col3(),
    uSun:v3(), uSunCol:col3(), uCam:v3(), ...ringUniforms(),
    ...cloudUniforms(), uCSeed:v3(), uCloudShadow:num(0), uCloudRot:num(0),
    ...eclipseUniforms(), ...volcUniforms(),
  },
  vertexShader: VERT,
  fragmentShader: NOISE + RINGFN + `
  uniform vec3 uSeed,uDeep,uShallow,uSand,uLow,uLow2,uHigh,uRock,uSnow,uAtmo,uSun,uSunCol,uCam,uCSeed,uVolcCol;
  uniform float uFreq,uSea,uIce,uLava,uGas,uBands,uCity,uCrater,uTime,uWarp,uRidge,uTerrace,uLocked,uGlow,uMoist,uTurb,uStorms,uSharp;
  uniform float uCloudShadow,uCloudRot,uSeason,uRivers,uHex,uStormKind;
  varying vec3 vPos;` + CLOUDFN + ECLIPSE + VOLC + `
  float height(vec3 p){
    vec3 q=p*uFreq+uSeed;
    // swirled continents: broad, gentle warp, so features bend without being smeared into streaks
    if(uWarp>0.) q+=uWarp*vec3(snoise(q*.3+1.3),snoise(q*.3+7.1),snoise(q*.3+13.7));
    float h=fbm(q,uFreq);
    if(uRidge>0.) h=mix(h,ridged(q*1.3,uFreq*1.3)-.35,uRidge);                           // mountain chains
    if(uTerrace>0.){ float s=h*7.; h=mix(h,(floor(s)+smoothstep(0.,.25,fract(s)))/7.,uTerrace); }   // mesas & steps
    h*=1.-.5*uCrater;
    if(uCrater>0.) h+=uCrater*(craters(p*2.5+uSeed)*.7+craters(p*6.+uSeed.yzx)*.35+craters(p*14.+uSeed.zxy)*.12);
    for(int i=0;i<6;i++){                                  // volcanoes: broad cones with a caldera on top
      if(float(i)>=uVolcN) break;
      float d=length(p-uVolc[i].xyz)/abs(uVolc[i].w);
      h+=.3*exp(-d*d*2.)-.16*exp(-d*d*45.);
    }
    return h;
  }
  float cityLights(vec3 p, float k, float dens){
    vec3 q=p*k, h=hash3(floor(q)+uSeed.yzx+k), f=fract(q)-.5-(h-.5)*.7;
    return step(1.-dens,h.x)*exp(-dot(f,f)*30.)*2.6*(.6+.8*h.y);
  }
  vec3 stormDir(int i, out float sz, out vec3 sh){
    sh=hash3(uSeed+float(i)*7.3); sz=.06+.14*sh.z;
    return normalize(vec3(cos(sh.x*6.283),(sh.y-.5)*1.2,sin(sh.x*6.283)));
  }
  vec3 gasGiant(vec3 p){
    // storms twist the bands around them into vortices before the bands are drawn
    vec3 q=p, sh; float sz;
    for(int i=0;i<3;i++){
      if(float(i)>=uStorms) break;
      vec3 sd=stormDir(i,sz,sh);
      float d=length((p-sd)*vec3(1.,2.4,1.));
      q=rotAround(q,sd,(sh.y>.5?2.6:-2.6)*exp(-d*d/(sz*sz)));
    }
    float b=q.y*uBands+fbm(q*vec3(2.,7.,2.)+uSeed,7.)*uTurb;
    float s=sin(b);
    vec3 col=mix(uLow,uHigh,mix(s*.5+.5,smoothstep(-.25,.25,s),uSharp));
    col=mix(col,uRock,smoothstep(.3,.9,sin(b*.37+uSeed.x)*.5+.5)*.6);
    col*=.9+.2*snoise(q*vec3(3.,16.,3.)+uSeed.zxy);
    for(int i=0;i<3;i++){
      if(float(i)>=uStorms) break;
      vec3 sd=stormDir(i,sz,sh);
      float d=length((p-sd)*vec3(1.,2.4,1.))+snoise(p*9.+uSeed+float(i))*.04;
      float m=1.-smoothstep(sz*.6,sz,d);
      if(uStormKind<.5) col=mix(col,i==0?uSnow:mix(uSnow,uHigh,.5),m*.8);     // great spots and pale ovals
      else if(uStormKind<1.5){                                                 // dark spots, bright companion clouds
        col=mix(col,uRock*.4,m*.85);
        float dc=length((p-normalize(sd+vec3(0.,sz*1.1,0.)))*vec3(1.,3.5,1.))+snoise(p*20.+uSeed)*.02;
        col=mix(col,uSnow*1.1,(1.-smoothstep(sz*.15,sz*.4,dc))*.85);
      } else col=mix(col,uSnow,m*.6);
    }
    float lon=atan(p.z,p.x);
    if(abs(uStormKind-2.)<.5){                                                // a string of pearls along one latitude
      float lat=asin(clamp(p.y,-1.,1.)), L=(hash3(uSeed).z-.5)*1.1, k=11.;
      float cx=(fract(lon/6.2832*k+uTime*.003)-.5)*6.2832/k*cos(L);
      float d=length(vec2(cx,(lat-L)*1.5));
      col=mix(col,uRock*.6,(1.-smoothstep(.03,.05,d))*.4);
      col=mix(col,uSnow*1.05,(1.-smoothstep(.018,.03,d))*.9);
    }
    if(uStormKind>2.5){                                                        // clusters of polar cyclones (Juno's Jupiter)
      for(int hemi=0;hemi<2;hemi++){
        vec3 pp=hemi==0?p:-p;
        if(pp.y<.8) continue;
        for(int j=0;j<9;j++){
          float a=float(j)*.785+uSeed.x;
          vec2 dv=pp.xz-(j==0?vec2(0.):.21*vec2(cos(a),sin(a)));
          float d=length(dv), arm=sin(atan(dv.y,dv.x)*2.+log(d+1e-3)*7.-uTime*.15);
          col=mix(col,mix(uRock*.7,uSnow,arm*.5+.5),exp(-d*d/.004)*.85);
        }
      }
    }
    if(uHex>.5 && p.y>.6){                                                     // Saturn-style polar hexagon: a subtle jet stream
      float colat=acos(clamp(p.y,-1.,1.)), seg=1.0472, a=lon+uTime*.01;
      float wob=snoise(vec3(cos(a)*3.,sin(a)*3.,uTime*.02+uSeed.x))*.012;   // its edges wander a little
      float hr=.3*mix(1.,cos(seg*.5)/cos(mod(a,seg)-seg*.5),.8)+wob;       // slightly rounded corners
      float inside=1.-smoothstep(hr-.03,hr+.03,colat);
      col=mix(col,col*vec3(.86,.92,1.04),inside*.6);                       // the cap inside is a touch darker and bluer
      float jx=(colat-hr)/.02;
      col=mix(col,mix(col,uHigh,.5)*1.06,exp(-jx*jx)*.4);                  // the jet itself: a pale band, not a line
      col*=1.-.25*(1.-smoothstep(0.,.035,colat));                          // small polar vortex
    }
    return col;
  }
  void main(){
    vec3 p=normalize(vPos), n=p, col;
    gPx=length(fwidth(p));
    float water=0., t=0., ice=0., glow=0.;
    if(uGas>.5) col=gasGiant(p);
    else {
      float h=height(p);
      vec3 t1=normalize(cross(p, abs(p.y)<.99?vec3(0,1,0):vec3(1,0,0))), t2=cross(p,t1);
      water=step(h,uSea);
      float depth=uSea-h;
      if(water<.5){   // bump-map land from the height gradient
        float e=max(gPx*.7,.00005), hx=height(normalize(p+t1*e)), hy=height(normalize(p+t2*e));
        n=normalize(p-(t1*(hx-h)+t2*(hy-h))/e*.06);
      } else {        // moving waves: noise scales that fade out once smaller than a pixel
        vec3 g=vec3(0.);
        for(int k=0;k<3;k++){
          float wf=70.*pow(4.,float(k)), fade=1.-smoothstep(.1,.45,gPx*wf);
          if(fade<=0.) break;
          vec3 q=p*wf+uSeed+uTime*vec3(.13,.08,.11)*float(k+1);
          float w0=snoise(q);
          g+=(t1*(snoise(q+t1*.3)-w0)+t2*(snoise(q+t2*.3)-w0))/.3*fade*.06/float(k+1);
        }
        n=normalize(p-g);
      }
      t=clamp((h-uSea)/(.65-uSea),0.,1.);
      col=mix(uShallow,uDeep,smoothstep(0.,.3,depth));
      col=mix(col,uShallow*1.6,1.-smoothstep(0.,.035,depth));            // bright coastal shallows
      float foam=(1.-smoothstep(0.,.012,depth))*smoothstep(-.1,.5,snoise(p*180.+uSeed+uTime*.4));
      col=mix(col,vec3(.85),foam*water*.7*(1.-uLava));                    // surf on the shoreline
      // snow/ice texture: drifts and blue-grey tones, plus thin pressure cracks once they're big enough to see
      float iceN=fbm(p*12.+uSeed.zyx,12.);
      vec3 snowCol=mix(uSnow,uSnow*vec3(.8,.89,1.),smoothstep(-.1,.5,iceN));
      float crack=pow(max(1.-abs(snoise(p*35.+uSeed)),0.),14.)*(1.-smoothstep(.2,.5,gPx*35.));
      snowCol*=1.-crack*.4;
      float slope=1.-dot(n,p);                     // 0 on flat ground
      float moist=snoise(p*2.3+uSeed.yxz)*.65+snoise(p*6.+uSeed)*.35;   // biome patches: wet vs dry lowland
      vec3 lowC=mix(uLow,uLow2,smoothstep(-.3,.3,moist)*uMoist);
      vec3 land=mix(uSand,lowC,smoothstep(0.,.04,t));
      land=mix(land,uHigh,smoothstep(.2,.5,t));
      land=mix(land,uRock,max(smoothstep(.5,.72,t),smoothstep(.06,.2,slope)*.6));   // cliffs show bare rock
      land=mix(land,snowCol,smoothstep(.78,.88,t+iceN*.08)*(1.-smoothstep(.03,.12,slope)));   // snow slides off cliffs
      col=mix(col,land,1.-water);
      if(uRivers>0. && water<.5){
        // rivers wind through the wetter lowlands and thin out towards the hills; lakes sit in upland basins
        vec3 rq=p*4.+uSeed.zxy;
        float rn=snoise(rq+.7*vec3(snoise(rq*1.3+3.),snoise(rq*1.3+7.),0.))*.8+snoise(rq*3.7+9.)*.2;
        float rw=mix(.035,.006,smoothstep(0.,.35,t))*smoothstep(-.55,.1,moist);
        float riv=(1.-smoothstep(rw,rw+fwidth(rn)*1.2,abs(rn)))*(1.-smoothstep(.28,.42,t));
        float lk=snoise(p*5.5+uSeed.yzx+11.);
        float lake=smoothstep(.6,.6+fwidth(lk)*1.2+.004,lk)*smoothstep(.03,.08,t)*(1.-smoothstep(.4,.5,t));
        float fw=max(riv,lake)*uRivers;
        col=mix(col,mix(uShallow,uDeep,.45),fw);
        n=normalize(mix(n,p,fw)); water=max(water,fw);
      }
      // ice caps grow in winter and shrink in summer: uSun.y is the sun's height above the equator
      float season=uSeason*uSun.y*sign(p.y)*.22;
      ice=smoothstep(uIce,uIce+.04,abs(p.y)+h*.2+iceN*.06-season);   // ragged cap edge
      if(uLocked>.5){                              // tidally locked: frozen night side, scorched sub-solar point
        float sd=dot(p,uSun)+h*.15;
        ice=max(ice,1.-smoothstep(-.35,-.05,sd));
        float hot=smoothstep(.45,.8,sd);
        col=mix(col,mix(uSand,uRock,smoothstep(.05,.6,t)),hot); water*=1.-hot;   // baked desert follows the terrain
      }
      if(ice>.01){                                 // ice relief from the drift noise, blended over land/waves
        float e=max(gPx*.7,.00005);
        float ix=fbm(normalize(p+t1*e)*12.+uSeed.zyx,12.), iy=fbm(normalize(p+t2*e)*12.+uSeed.zyx,12.);
        vec3 ni=normalize(p-(t1*(ix-iceN)+t2*(iy-iceN))/e*.004);
        n=normalize(mix(n,ni,ice));               // ice sheets bury the terrain underneath
      }
      col=mix(col,snowCol,ice); water*=1.-ice; t+=ice;
      for(int i=0;i<6;i++){                        // volcanoes: glowing calderas and lava running down the flanks
        if(float(i)>=uVolcN) break;
        vec3 vd=uVolc[i].xyz, a1=normalize(cross(vd,vec3(.3,1.,.1))), a2=cross(vd,a1), dp=p-vd;
        float d=length(dp)/abs(uVolc[i].w), ang=atan(dot(dp,a2),dot(dp,a1));
        // lava channels run straight down the flanks, wandering a little, fading as they cool
        float flow=pow(max(1.-abs(snoise(vec3(cos(ang)*5.,sin(ang)*5.,d*1.2+float(i)*7.)+snoise(p*30.+uSeed)*.15)),0.),14.)
          *smoothstep(.12,.3,d)*(1.-smoothstep(.4,1.4,d));
        float rd=(d-.16)/.05, rim=exp(-rd*rd);                                // glowing lip of the caldera
        glow+=(exp(-d*d*60.)*2.5+rim*1.2+exp(-d*d*5.)*.12+flow*1.6)*(uVolc[i].w>0.?1.:.2);
        col=mix(col,uRock*.35,exp(-d*d*12.)*.6);   // dark fresh basalt around the vent
      }
      glow*=1.-ice;
    }
    vec3 v=normalize(uCam-p);
    float ndl=dot(n,uSun);
    float lit=(1.-ringShadow(p,uSun)*.85)*eclipse(p,uSun);   // ring shadows and eclipses by moons
    if(uCloudShadow>0.){                                 // soft shadows of the clouds overhead
      float cr=cos(uCloudRot), sr=sin(uCloudRot);        // planet-local -> cloud-layer-local (they spin at different rates)
      vec3 pc=vec3(cr*p.x+sr*p.z,p.y,-sr*p.x+cr*p.z), sc=vec3(cr*uSun.x+sr*uSun.z,uSun.y,-sr*uSun.x+cr*uSun.z);
      float keep=gPx; gPx*=6.;                           // fewer octaves: shadows are blurry anyway
      float cd=cloudDensity(normalize(pc+sc*.06),uCSeed);
      gPx=keep;
      lit*=1.-smoothstep(uCloud,uCloud+.25,cd)*.65;
    }
    vec3 c=col*(.01+smoothstep(-.15,1.,ndl)*uSunCol*lit);   // soft terminator
    // water: tight sun glint + broad sheen, and sky reflection that grows at grazing angles (Fresnel)
    float nh=max(dot(n,normalize(uSun+v)),0.), day=smoothstep(-.1,.25,dot(p,uSun))*lit;
    float fres=.02+.98*pow(1.-max(dot(n,v),0.),5.);
    float sky=pow(max(dot(reflect(-v,n),uSun),0.),3.);   // wave facets catching the bright sky near the sun
    c+=water*(1.-uLava)*day*(uSunCol*(pow(nh,300.)*3.+pow(nh,25.)*.12)+uAtmo*(fres*.5+sky*(.15+fres)*.5));
    c+=ice*day*uSunCol*pow(nh,60.)*.25;                        // icy sheen
    c+=uLava*water*col*1.5;                                    // glowing seas
    c+=uGlow*col*(1.-day)*1.2;                                 // red-hot night side
    // night-side cities: populated regions (busiest along coasts and lowlands) with bright metro cores, suburbs
    // that break up into single lights as you zoom in, and lit roads joining them
    float land=(1.-water)*step(.01,t)*step(t,.45);
    float region=smoothstep(-.15,.45,snoise(p*5.+uSeed.zxy));
    float pop=region*(1.+1.5*(1.-smoothstep(0.,.08,t)));
    float metro=pow(max(snoise(p*24.+uSeed),0.),1.5);
    // single lights at two scales (towns, then streets); each fades to its average brightness once it's smaller
    // than a pixel, so the glow stays the same overall but always resolves into points as you zoom in
    float dens=.25+metro*.6;
    float n1s=1.-smoothstep(.15,.6,gPx*90.), n2s=1.-smoothstep(.15,.6,gPx*320.);
    float avg=dens*.26;
    float grain=mix(avg,mix(cityLights(p,90.,dens),cityLights(p,90.,dens)*.4+cityLights(p,320.,dens)*.6,n2s),n1s);
    float road=(1.-smoothstep(0.,.02,abs(snoise(p*16.+uSeed.yzx))))*region*.3*(1.-smoothstep(.05,.3,gPx*16.));
    float lights=land*(pop*(metro*.35+grain*.7)+road);
    vec3 lightCol=mix(vec3(1.,.66,.3),vec3(1.,.88,.72),metro);                 // city centres burn whiter
    c+=uCity*lights*lightCol*1.3*(1.-smoothstep(-.2,.05,dot(p,uSun)));
    c+=uVolcCol*glow*(.6+.9*(1.-day));
    gl_FragColor=vec4(c,1.);
    #include <colorspace_fragment>
  }`,
});

// --- cloud layers: the main deck (uLayer 0) and thin high cirrus above it (uLayer 1) ---
export const cloudMat = new THREE.ShaderMaterial({
  transparent:true, depthWrite:false,
  uniforms:{ uSeed:v3(), uCol:col3(), uSunCol:col3(), uSun:v3(), uTime:num(0), uLayer:num(0),
             uLightning:num(0), uCloudRot:num(0),
             ...cloudUniforms(), ...ringUniforms(), ...eclipseUniforms(), ...volcUniforms() },
  vertexShader: VERT,
  fragmentShader: NOISE + RINGFN + `
  uniform vec3 uSeed,uCol,uSun,uSunCol; uniform float uTime,uLayer,uLightning,uCloudRot;
  varying vec3 vPos;` + CLOUDFN + ECLIPSE + VOLC + `
  void main(){
    vec3 p=normalize(vPos);
    gPx=length(fwidth(p));
    float a, flash=0.; vec3 shade;
    if(uLayer>.5){   // high cirrus: thin streaks that drift faster than the deck below, so the two layers slide apart
      vec3 q=p*vec3(2.5,11.,2.5)+uSeed.yzx+uTime*vec3(.03,0.,.02);
      float c=fbm(q,11.)+.35*snoise(p*2.5+uSeed);
      a=smoothstep(.3,.8,c)*.3;
      shade=uCol;
    } else {
      float c=cloudDensity(p,uSeed);
      c+=fbm(p*14.+uSeed.yzx+uTime*.02,14.)*.12;          // billowing, eroded edges instead of soft blobs
      a=smoothstep(uCloud,uCloud+.09,c)*.95;
      // self-shadowing: where there's more cloud towards the sun, this side of the billow is in its shade
      vec3 ts=uSun-p*dot(uSun,p); ts*=1./max(length(ts),1e-4);
      float keep=gPx; gPx*=3.;
      float cs=cloudDensity(normalize(p+ts*.012),uSeed);
      gPx=keep;
      float base=max(uCloud,-.5);
      shade=uCol*(.6+.4*smoothstep(base,base+.6,c))*(1.-.35*smoothstep(0.,.25,cs-c));   // thicker cloud is brighter
      if(uLightning>0.){   // lightning: brief flickering flashes deep inside thick storm cells
        vec3 cell=floor(p*28.), hh=hash3(cell);
        float slot=floor(uTime*2.5+hh.x*97.);
        float on=step(.982,fract(sin(dot(cell,vec3(12.9,78.2,37.7))+slot*13.37)*43758.5));
        vec3 f=fract(p*28.)-.5-(hh-.5)*.5;
        flash=on*exp(-dot(f,f)*14.)*smoothstep(uCloud+.15,uCloud+.45,c)*uLightning*(.55+.45*sin(uTime*60.+hh.y*9.));
      }
    }
    float ash=0.;
    if(uVolcN>0. && uLayer<.5){   // ash plumes from erupting volcanoes, carried downwind
      float cr=cos(-uCloudRot), sr=sin(-uCloudRot);
      vec3 pb=vec3(cr*p.x+sr*p.z,p.y,-sr*p.x+cr*p.z);   // into the planet's own frame, where the vents are
      for(int i=0;i<6;i++){
        if(float(i)>=uVolcN) break;
        float r=uVolc[i].w;
        if(r<=0.) continue;
        vec3 vd=uVolc[i].xyz, e=normalize(cross(vec3(0.,1.,0.),vd)+vec3(1e-4,0.,0.)), dq=pb-vd;
        float al=dot(dq,e), ac=length(dq-e*al), w=r*(.18+max(al,0.)*1.2);
        float pl=exp(-ac*ac/(w*w))*(al>0.?exp(-al/(r*3.5)):exp(-al*al/(r*r*.02)));
        ash=max(ash,pl*(.7+.3*snoise(pb*35.+uTime*.1)));
      }
    }
    shade=mix(shade,vec3(.16,.14,.13),ash); a=max(a,ash*.92);
    float lit=(1.-ringShadow(p,uSun)*.85)*eclipse(p,uSun);
    gl_FragColor=vec4(shade*(.006+smoothstep(-.15,1.,dot(p,uSun))*uSunCol*lit)+vec3(.75,.82,1.)*flash*6.,max(a,flash*.6));
    #include <colorspace_fragment>
  }`,
});

// --- atmosphere: single scattering, ray-marched through a thin shell around the planet ---
// The scattering colour is the atmosphere's colour, so light that crosses a lot of air (near the terminator,
// at the limb) loses that colour and turns towards its complement: blue skies get orange sunsets.
// Drawn after the surface and clouds; it adds the scattered light and dims what's behind by the air's transmittance.
export const atmoMat = new THREE.ShaderMaterial({
  transparent:true, depthWrite:false, blending:THREE.CustomBlending,
  blendSrc:THREE.OneFactor, blendDst:THREE.OneMinusSrcAlphaFactor,
  uniforms:{ uAtmo:col3(), uSunL:v3(), uCamL:v3(), uSunCol:col3(), uStr:num(1), uTop:num(1.12), uH:num(.022) },
  vertexShader:`varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: RAYSPHERE + `uniform vec3 uAtmo,uSunL,uCamL,uSunCol; uniform float uStr,uTop,uH; varying vec3 vP;
  float dens(vec3 x){ return exp(-(length(x)-1.)/uH); }
  void main(){
    vec3 ro=uCamL, rd=normalize(vP-uCamL);
    vec2 A=raySphere(ro,rd,uTop);
    float t0=max(A.x,0.), t1=A.y;
    if(t1<=t0) discard;
    vec2 G=raySphere(ro,rd,1.);
    bool ground=G.x>0. && G.x<t1;
    if(ground) t1=G.x;
    vec3 beta=uAtmo*uStr*3.6;                    // scattering coefficients per unit of air
    float ds=(t1-t0)/10., od=0.;
    vec3 sum=vec3(0.);
    for(int i=0;i<10;i++){
      vec3 x=ro+rd*(t0+ds*(float(i)+.5));
      float d=dens(x)*ds;
      od+=d*.5;
      // the planet's shadow inside the air, softened over a thin layer (the sun isn't a point, and air bends light)
      float xs=dot(x,uSunL), hc=xs>0. ? 2. : length(x-uSunL*xs);
      float lit=smoothstep(.975,1.005,hc);
      if(lit>0.){                                 // march to the sun
        float ls=raySphere(x,uSunL,uTop).y*.25, lod=0.;
        for(int j=0;j<4;j++) lod+=dens(x+uSunL*ls*(float(j)+.5))*ls;
        sum+=d*exp(-beta*(od+lod))*lit;
      }
      od+=d*.5;
    }
    float mu=dot(rd,uSunL);
    // keep the bright limb but go easy on the haze over the disc, so the surface stays crisp
    float closest=length(cross(ro,rd));
    vec3 col=sum*beta*.75*(1.+mu*mu)*uSunCol*1.3*mix(.4,1.,smoothstep(.8,1.,closest));
    col+=sum*uSunCol*.05*pow(max(mu,0.),12.)*uStr;   // forward-scattered glow around the sun
    vec3 T=exp(-beta*od);
    gl_FragColor=vec4(col, ground ? 1.-dot(T,vec3(1./3.)) : 0.);
    #include <colorspace_fragment>
  }`,
});

// --- auroras: glowing ovals around the magnetic poles, only visible on the night side ---
export const auroraMat = new THREE.ShaderMaterial({
  transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
  uniforms:{ uSunL:v3(), uCamL:v3(), uMag:v3(), uA:col3(), uB:col3(), uTime:num(0), uStr:num(1), uOval:num(.33) },
  vertexShader: VERT,
  fragmentShader: NOISE + `uniform vec3 uSunL,uCamL,uMag,uA,uB; uniform float uTime,uStr,uOval; varying vec3 vPos;
  void main(){
    vec3 p=normalize(vPos);
    float m=dot(p,uMag), colat=acos(clamp(abs(m),0.,1.));         // angle from the nearer magnetic pole
    vec3 e1=normalize(cross(uMag,vec3(.3,.1,1.))), e2=cross(uMag,e1);
    float lon=atan(dot(p,e2),dot(p,e1));
    float wig=snoise(vec3(cos(lon),sin(lon),sign(m))*1.5+uTime*.05)*.05;
    float x=colat-uOval-wig;
    float band=exp(-x*x/.0008);                                       // a thin ring, not a thick band
    float curtain=.5+.5*snoise(vec3(cos(lon)*9.,sin(lon)*9.,uTime*.25+sign(m)*7.));
    float rays=.6+.4*snoise(vec3(cos(lon)*60.,sin(lon)*60.,uTime*.6));
    float night=1.-smoothstep(-.15,.12,dot(p,uSunL));
    vec3 v=normalize(uCamL-p);
    float limb=1./max(dot(p,v),.35);                                 // longer path through the glow at the edge
    vec3 col=mix(uA,uB,smoothstep(-.01,.04,-x));                      // green low down, red/pink higher up (poleward)
    gl_FragColor=vec4(col*band*(.35+.65*curtain)*(.75+.25*rays)*night*limb*uStr*1.1,1.);
    #include <colorspace_fragment>
  }`,
});

// --- rings ---
export const ringMat = new THREE.ShaderMaterial({
  side:THREE.DoubleSide, transparent:true, depthWrite:false,
  // everything in the ring's own space (planet at the origin, radius 1, ring normal = +z), so a ringed
  // planet works anywhere and at any size; uSunL/uCamL are the sun direction and camera position in that space
  uniforms:{ uA:col3(), uB:col3(), uSunL:v3(), uCamL:v3(), uSunCol:col3(),
             uK:v3(), uIn:num(1.4), uOut:num(2.2), uGaps:{value:new THREE.Vector2()}, uDust:num(1) },
  vertexShader:`varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: RINGFN + `uniform vec3 uA,uB,uSunL,uCamL,uSunCol,uK; uniform vec2 uGaps; uniform float uIn,uOut,uDust; varying vec3 vP;
  // ringlets all the way down: octaves of 1D noise until they'd be thinner than a pixel
  float ringlets(float x, float px){
    float s=0., a=.5, norm=0.;
    for(int i=0;i<12;i++){
      float w=1.-smoothstep(.35,.75,px);                        // keep fine ringlets even at grazing angles
      if(w<=0.) break;
      s+=a*w*n1(x); norm+=a*w; x=x*2.13+5.7; px*=2.13; a*=.6;
    }
    return s/max(norm,1e-4);
  }
  void main(){
    float t=(length(vP.xy)-uIn)/(uOut-uIn), ft=fwidth(t);
    float b=ringBands(t,uK);                                    // main band structure
    b*=1.+(ringlets(t*uK.x*5.,ft*uK.x*5.)-.5)*.9;              // fine ringlets, sharper as you zoom in
    // up close: grainy ice-particle sparkle in the ring plane
    float k=600., grain=fract(sin(dot(floor(vP.xy*k),vec2(12.9898,78.233)))*43758.5);
    b*=1.+(grain-.5)*.5*(1.-smoothstep(.3,.8,length(fwidth(vP.xy))*k));
    float a=ringAlpha(t,b,uGaps,uDust);                         // sparse bands go see-through
    float shadow=(dot(vP,uSunL)<0. && length(cross(vP,uSunL))<1.)?.08:1.;   // planet's shadow on the ring
    // seen from the sunlit face the ring reflects; from the dark face only thin parts glow with light passing through
    float sideS=uSunL.z, sideV=uCamL.z;
    // looking towards the sun through the ring, thin parts light up (sunlight scattered forwards by the ice)
    float fwd=pow(max(dot(normalize(vP-uCamL),uSunL),0.),6.);
    float light=sideS*sideV>0. ? .75+.5*abs(sideS) : .14+(1.-a)*(.35+1.8*fwd);
    vec3 col=mix(uA,uB,b)*mix(.8,1.2,n1(t*uK.z*2.+4.));        // slight colour drift across the rings
    gl_FragColor=vec4(col*uSunCol*light*(.05+.95*shadow),a);
    #include <colorspace_fragment>
  }`,
});

// ring particles: chunks of rock/ice spread through the same bands with a little thickness.
// position holds (u across the ring, angle, height); they fade in as the camera gets close.
export const ringPtsMat = new THREE.ShaderMaterial({
  transparent:true, depthWrite:false,
  // uSunL: sun direction in the planet's space; uBody: the planet's size in the scene (1 = main planet)
  uniforms:{ uIn:num(1.4), uOut:num(2.2), uK:v3(), uGaps:{value:new THREE.Vector2()}, uDust:num(1),
             uA:col3(), uB:col3(), uSunL:v3(), uSunCol:col3(), uScale:num(1), uThick:num(.02), uBody:num(1) },
  vertexShader: RINGFN + `uniform float uIn,uOut,uDust,uScale,uThick,uBody; uniform vec3 uK,uA,uB,uSunL,uSunCol; uniform vec2 uGaps;
  attribute float aRand; varying float vA; varying vec3 vCol;
  void main(){
    float r=uIn+position.x*(uOut-uIn);
    vec3 lp=vec3(cos(position.y)*r, position.z*uThick*(.3+aRand), sin(position.y)*r);
    vA=ringAlpha(position.x,ringBands(position.x,uK),uGaps,uDust);
    float shadow=(dot(lp,uSunL)<0. && length(cross(lp,uSunL))<1.)?.08:1.;
    vCol=mix(uA,uB,aRand)*uSunCol*(.6+.8*aRand)*(.1+.9*shadow);
    vec4 mv=modelViewMatrix*vec4(lp,1.);
    float d=-mv.z;
    vA*=1.-smoothstep(1.5,5.,d/uBody);
    gl_PointSize=clamp(uScale*.003*uBody*(.5+aRand)/d,1.,8.);   // ~0.003-planet-radius chunks in perspective
    gl_Position=projectionMatrix*mv;
  }`,
  fragmentShader:`varying float vA; varying vec3 vCol;
  void main(){
    float m=1.-smoothstep(.2,.5,length(gl_PointCoord-.5));
    gl_FragColor=vec4(vCol,vA*m);
    #include <colorspace_fragment>
  }`,
});

// --- backdrop ---
export const nebulaMat = new THREE.ShaderMaterial({
  side:THREE.BackSide, depthWrite:false,
  uniforms:{ uSeed:v3(), uA:col3(), uB:col3(), uDensity:num(1) },
  vertexShader: VERT,
  fragmentShader: NOISE + `uniform vec3 uSeed,uA,uB; uniform float uDensity; varying vec3 vPos;
  void main(){
    vec3 p=normalize(vPos);
    gPx=length(fwidth(p))*8.;   // the backdrop stays soft; this caps it at a few octaves
    float m=smoothstep(-.05,.6,fbm(p*1.6+uSeed,1.6));
    vec3 c=mix(uA,uB,fbm(p*3.+uSeed.yzx,3.)*.6+.5)*m*m*.22*uDensity;
    gl_FragColor=vec4(c,1.);
    #include <colorspace_fragment>
  }`,
});

// --- stars ---
export const starMat = new THREE.ShaderMaterial({
  uniforms:{ uSeed:v3(), uHot:col3(), uCool:col3(), uTime:num(0), uCam:v3(), uBright:num(1) },
  vertexShader: VERT,
  fragmentShader: NOISE + `uniform vec3 uSeed,uHot,uCool,uCam; uniform float uTime,uBright; varying vec3 vPos;
  void main(){
    vec3 p=normalize(vPos);
    gPx=length(fwidth(p));
    float n=fbm(p*3.+uSeed+uTime*.03,3.);
    float g=snoise(p*40.+uTime*.3)*.5+.5;                         // granulation
    vec3 c=mix(uCool,uHot,smoothstep(-.35,.35,n))*(.8+.4*g);
    c*=.3+.7*sqrt(max(dot(p,normalize(uCam-p)),0.));             // limb darkening
    gl_FragColor=vec4(c*1.6*uBright,1.);
    #include <colorspace_fragment>
  }`,
});

// glowing shells of gas: planetary nebulae, supernova remnants, Wolf-Rayet wind bubbles, protostar cocoons.
// A shell looks brightest where you see it edge-on, so brightness grows towards its rim.
export const shellMat = new THREE.ShaderMaterial({
  side:THREE.DoubleSide, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
  uniforms:{ uSeed:v3(), uA:col3(), uB:col3(), uCamL:v3(), uFil:num(1), uWaist:num(0), uStr:num(1), uFreq:num(3) },
  vertexShader: VERT,
  fragmentShader: NOISE + `uniform vec3 uSeed,uA,uB,uCamL; uniform float uFil,uWaist,uStr,uFreq; varying vec3 vPos;
  void main(){
    vec3 n=normalize(vPos), v=normalize(uCamL-vPos);
    gPx=length(fwidth(n))*2.;
    float limb=min(1./max(abs(dot(n,v)),.1),6.);
    float inside=length(uCamL)<1.?.45:1.;                             // from inside, the shell is a faint glow all round
    vec3 q=n*uFreq+uSeed;
    q+=.6*vec3(snoise(q*.5+1.),snoise(q*.5+4.),snoise(q*.5+7.));      // stir it so it doesn't look like plain noise
    float f=fbm(q,uFreq)*.5+.5;
    float clump=smoothstep(.42,.8,f);                                  // clumpy gas
    float fil=pow(max(1.-abs(snoise(q*2.7)),0.),16.)*clump*uFil;               // thin wisps where the gas is thick
    float waist=mix(1.,exp(-n.y*n.y*9.)*1.4+.15,uWaist);            // planetary nebulae: bright equatorial ring
    vec3 col=mix(uA,uB,smoothstep(.4,.7,f))*(clump*.35+fil*1.3)*waist*limb*uStr*.07*inside;
    gl_FragColor=vec4(col,1.);
    #include <colorspace_fragment>
  }`,
});

// protoplanetary disk around a young star: dusty rings with gaps cleared by the planets forming in them
export const dustDiskMat = new THREE.ShaderMaterial({
  side:THREE.DoubleSide, transparent:true, depthWrite:false,
  uniforms:{ uIn:num(1), uOut:num(5), uGaps:{value:[0,0,0,0,0,0]}, uGapN:num(0), uA:col3(), uB:col3(), uSunCol:col3() },
  vertexShader:`varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: RINGFN + `uniform float uIn,uOut,uGaps[6],uGapN; uniform vec3 uA,uB,uSunCol; varying vec3 vP;
  void main(){
    float r=length(vP.xy), t=(r-uIn)/(uOut-uIn);
    float d=smoothstep(0.,.06,t)*(1.-smoothstep(.7,1.,t));
    for(int i=0;i<6;i++){
      if(float(i)>=uGapN) break;
      float w=.05*uGaps[i]+.04;
      d*=.08+.92*smoothstep(w*.4,w,abs(r-uGaps[i]));
    }
    d*=.75+.25*n1(r*25.)+.1*n1(r*90.);
    vec3 col=mix(uA,uB,smoothstep(0.,1.,t))*uSunCol*(1.1/(.5+t*2.5));
    gl_FragColor=vec4(col,d*.55);
    #include <colorspace_fragment>
  }`,
});

// pulsar beam: a faint, narrow cone of light along the magnetic axis
export const beamMat = new THREE.ShaderMaterial({
  side:THREE.DoubleSide, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
  uniforms:{ uCol:col3(), uStr:num(.2) },
  vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader:`uniform vec3 uCol; uniform float uStr; varying vec2 vUv;
  void main(){
    float along=vUv.y;                                  // 0 at the far end, 1 at the star (ConeGeometry uv)
    float edge=sin(vUv.x*6.2832*2.)*.5+.5;
    gl_FragColor=vec4(uCol*pow(along,3.)*uStr*(.7+.3*edge),1.);
    #include <colorspace_fragment>
  }`,
});

// --- comets: the dust tail curves back along the orbit, the blue ion tail points straight away from the star ---
export const cometMat = new THREE.ShaderMaterial({
  transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
  uniforms:{ uAnti:v3(), uBack:v3(), uLen:num(1), uAct:num(1), uScale:num(1), uSize:num(1), uDust:col3(), uIon:col3(), uTime:num(0) },
  vertexShader:`uniform vec3 uAnti,uBack,uDust,uIon; uniform float uLen,uAct,uScale,uSize,uTime;
  attribute vec4 aP; varying vec3 vCol; varying float vA;
  void main(){
    float s=aP.x, ion=step(.65,aP.w);
    vec3 e1=normalize(cross(uAnti,abs(uAnti.y)<.9?vec3(0.,1.,0.):vec3(1.,0.,0.))), e2=cross(uAnti,e1);
    float spread=(ion>.5?.025:.12)*s+.01;
    vec3 off=(e1*cos(aP.y)+e2*sin(aP.y))*aP.z*spread*uLen;
    float len=uLen*(ion>.5?1.25:1.)*s;
    vec3 p=uAnti*len+off+(ion>.5?vec3(0.):uBack*uLen*.45*s*s);       // dust lags behind and curves
    p+=uAnti*fract(uTime*.05+aP.w*7.)*.02*uLen*ion;                  // ion streamers flow outwards
    vCol=ion>.5?uIon:uDust;
    vA=(1.-s)*(1.-s)*uAct*(ion>.5?.07:.045);
    vec4 mv=modelViewMatrix*vec4(p,1.);
    gl_PointSize=clamp(uScale*uSize*(1.+s*5.)/-mv.z,1.5,48.);
    gl_Position=projectionMatrix*mv;
  }`,
  fragmentShader:`varying vec3 vCol; varying float vA;
  void main(){
    float m=exp(-dot(gl_PointCoord-.5,gl_PointCoord-.5)*10.);
    gl_FragColor=vec4(vCol*vA*m,1.);
    #include <colorspace_fragment>
  }`,
});

// --- distant bodies shrink to dots instead of disappearing (level of detail) ---
export const dotMat = new THREE.ShaderMaterial({
  transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
  uniforms:{ uPx:num(1) },
  vertexShader:`attribute vec3 aCol; attribute vec2 aSz; varying vec3 vCol; varying float vA;
  void main(){ vCol=aCol; vA=aSz.y; gl_PointSize=aSz.x; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader:`varying vec3 vCol; varying float vA;
  void main(){
    float m=1.-smoothstep(.15,.5,length(gl_PointCoord-.5));
    gl_FragColor=vec4(vCol*vA*m,1.);
    #include <colorspace_fragment>
  }`,
});

// --- black hole: rays are bent around the hole step by step (Schwarzschild geodesics), so the disk
// arches over and under the shadow and the stars behind are lensed into an Einstein ring.
// Units: Schwarzschild radius = 1. uSky is a cube map of the backdrop as seen from the hole.
export const blackHoleMat = new THREE.ShaderMaterial({
  side:THREE.BackSide, depthWrite:false,
  uniforms:{ uCamL:v3(), uSky:{value:null}, uSkyRot:{value:new THREE.Matrix3()}, uTime:num(0),
             uIn:num(3), uOut:num(9), uHot:col3(), uCool:col3(), uBound:num(100), uSpin:num(1) },
  vertexShader:`varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: NOISE + RAYSPHERE + `uniform vec3 uCamL,uHot,uCool; uniform samplerCube uSky; uniform mat3 uSkyRot;
  uniform float uTime,uIn,uOut,uBound,uSpin; varying vec3 vP;
  vec4 disk(vec3 hit, vec3 dir){
    float r=length(hit.xz), t=(r-uIn)/(uOut-uIn);
    if(t<0. || t>1.) return vec4(0.);
    float w=uSpin*.5/(r*sqrt(r));                                  // Keplerian angular speed
    float a=atan(hit.z,hit.x)+uTime*w*6.;
    vec2 q=vec2(cos(a),sin(a))*r;
    float n=snoise(vec3(q*1.1,r*1.5))*.5+.5;
    n=n*.7+.3*(snoise(vec3(q*4.,r*5.+3.))*.5+.5);
    // orbital velocity: Doppler beaming brightens the side coming towards us, gravity reddens the inner edge
    vec3 vel=normalize(vec3(-hit.z,0.,hit.x))*uSpin*sqrt(.5/r);
    float beta=length(vel), g=1./(sqrt(1.-beta*beta)*(1.+dot(vel,dir)));
    float grav=sqrt(max(1.-1./r,0.));
    float boost=pow(g*grav,3.);
    float heat=pow(1.-t,1.6);
    vec3 col=mix(uCool,uHot,clamp(heat*g,0.,1.2))*(.3+1.4*heat)*boost*(.3+n)*.6;
    float alpha=smoothstep(0.,.05,t)*(1.-smoothstep(.55,1.,t))*clamp(.15+n*.75,0.,1.)*.9;
    return vec4(col*alpha,alpha);
  }
  void main(){
    vec3 ro=uCamL, rd=normalize(vP-uCamL);
    vec2 A=raySphere(ro,rd,uBound);
    vec3 pos=ro+rd*max(A.x,0.), vel=rd;
    vec3 L=cross(pos,vel); float h2=dot(L,L);
    vec3 col=vec3(0.); float trans=1.;
    for(int i=0;i<260;i++){
      float r=length(pos);
      if(r<1.){ trans=0.; break; }                                  // fell through the event horizon
      if(r>uBound && dot(pos,vel)>0.) break;                         // escaped: look up the sky
      float dt=clamp(.06*r*r/(r+3.),.015,2.5);
      vec3 acc=-1.5*h2*pos/pow(r,5.);
      vec3 v2=vel+acc*dt*.5, np=pos+v2*dt;                         // leapfrog step
      vel=v2-1.5*h2*np/pow(length(np),5.)*dt*.5;
      if(pos.y*np.y<0.){                                            // crossed the disk plane
        vec3 hit=mix(pos,np,pos.y/(pos.y-np.y));
        vec4 d=disk(hit,normalize(vel));
        col+=trans*d.rgb; trans*=1.-d.a;
        if(trans<.01) break;
      }
      pos=np;
    }
    col+=trans*textureCube(uSky,normalize(uSkyRot*vel)).rgb;
    gl_FragColor=vec4(col,1.);
    #include <colorspace_fragment>
  }`,
});
