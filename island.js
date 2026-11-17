/* «Две базы: Остров» — 3D island game (built by build_island.py) */
(function(){'use strict';
if(typeof THREE==='undefined'){console.error('three.js missing');return;}
/* ================== «Две базы: Остров» — the island game ================== */
/* ---------- world size and rules ---------- */
const IW=8000,IH=5000,GS=40;                         // island area, height-grid step
const WATER=0;
const BASES=[[700,IH/2],[IW-700,IH/2]];
const START_ORE=700,BASE_INC=8,LIVES=20;
const SPK=1.5,USPK=1.9;                                        // island speeds are 1.5× the 2D ones
const US={                                            // unit stats on the island
 inf:{name:'Пехота',cost:60,hp:209,sp:40,rng:80,dmg:11,cd:0.55,air:false,hitAir:true,rw:10,lives:1,r:9},
 jeep:{name:'Джип',cost:105,hp:376,sp:70,rng:95,dmg:7,cd:0.14,air:false,hitAir:true,rw:18,lives:1,r:11},
 tank:{name:'Танк',cost:270,hp:700,sp:30,rng:125,dmg:70,cd:1.6,air:false,hitAir:false,rw:45,lives:3,r:16,splash:22},
 heli:{name:'Вертолёт',cost:165,hp:320,sp:55,rng:110,dmg:24,cd:0.6,air:true,hitAir:false,rw:25,lives:1,r:16},
};
const TWS={mg:{cost:200,rng:170,dmg:15,cd:0.15,air:true,ground:true,hp:1400},can:{cost:300,rng:200,dmg:60,cd:1.6,air:false,ground:true,splash:40,hp:1800},
 tes:{cost:600,rng:180,dmg:100,cd:1,air:true,ground:true,hp:1500},rkt:{cost:500,rng:320,dmg:70,cd:2.6,air:true,ground:false,hp:1500}};
const HARV={cost:500,hp:420,sp:42,load:200,mine:6};
const VIS=520;                                        // how far anything of ours sees
const THEME={isle:{g1:'#6B6A48',g2:'#7A7552',g3:'#57583C',dirt:'#7A6648',dirt2:'#5E4E38',sky:0x7E93A6,hz:0xC4C6BE,fog:0xA9AEA8,tree:[0x3F4A2E,0x4A5434,0x3A4430,0x525A3A],bark:0x3E3428,rock:0x77746C}};
const T3={on:true,map:false,q:1,fpsT:0,fpsN:0,fps:60,lo:false};
const P={x:0,z:0,yaw:0,pitch:-0.05,move:false,hp:6000,max:6000,cd:0,scd:0,dead:0,fov:66,zoom:1,rec:0,bob:0,shake:0};
const me=0;
const TITAN={sp:46*SPK,cd:1.0,dmg:360,r:44,v:1100,range:700,cone:0.06,superCd:20,superN:7,respawn:5,bounty:600};
const ALT={heli:46,plane:90};

/* ---------- renderer ---------- */
const cv3=document.createElement('canvas');cv3.id='cv3';
cv3.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;display:none;z-index:20;touch-action:none;background:#000';
document.body.appendChild(cv3);
let R;try{R=new THREE.WebGLRenderer({canvas:cv3,antialias:false,powerPreference:'high-performance'});}catch(e){console.error(e);return;}
const isMob=matchMedia('(pointer:coarse)').matches,mem=navigator.deviceMemory||8;
T3.lo=isMob&&mem<=4;
try{const q=+localStorage.getItem('dvebazy-3dq2');if(q>=0.5&&q<=2)T3.q=q;else T3.q=Math.min(devicePixelRatio||1,isMob?1.25:1.5);}catch(_){T3.q=1;}
R.setPixelRatio(T3.q);
R.outputEncoding=THREE.sRGBEncoding;R.toneMapping=THREE.ACESFilmicToneMapping;R.toneMappingExposure=0.82;
R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
const cam=new THREE.PerspectiveCamera(P.fov,1,0.8,3000);scene.add(cam);
const hemi=new THREE.HemisphereLight(0xCFE4FF,0x4A5A2A,0.38);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xFFEBC8,1.9);scene.add(sun,sun.target);
const SUN_DIR=new THREE.Vector3(-0.55,0.62,0.56).normalize();
sun.castShadow=true;{const s=T3.lo?1024:2048;sun.shadow.mapSize.set(s,s);const c=sun.shadow.camera;c.left=-170;c.right=170;c.top=170;c.bottom=-170;c.near=10;c.far=900;sun.shadow.bias=-0.0004;sun.shadow.normalBias=0.8;}
const flash=new THREE.PointLight(0xFFB060,0,260,2);scene.add(flash);
let world=null,sky=null,water=null;
const dyn=new THREE.Group();scene.add(dyn);
const lin=c=>new THREE.Color(c).convertSRGBToLinear();
const STD={};const std=(c,r,m)=>{const k=c+'|'+(r??0.8)+'|'+(m??0);return STD[k]||(STD[k]=new THREE.MeshStandardMaterial({color:lin(c),roughness:r??0.8,metalness:m??0,envMapIntensity:0.55}));};
const TEAM3=si=>si===me?{m:0x3E78B8,d:0x24466F,l:0x8CC0F0,g:0x4E90E0}:{m:0xB8302A,d:0x6E1A16,l:0xF08070,g:0xFF5A40};
/* field coords → world: own field as drawn, the enemy's mirrored across the river */
const WX=(si,x)=>si===me?x:FW-x;
const WA=(si,a)=>si===me?a:Math.PI-a;
const rotY=a=>-a;
/* ---------- small helpers ---------- */
let seedR=7;const rn=()=>{seedR=(seedR*16807)%2147483647;return seedR/2147483647;};
function hash(x,z){const s=Math.sin(x*127.1+z*311.7)*43758.5453;return s-Math.floor(s);}
function vnoise(x,z){const xi=Math.floor(x),zi=Math.floor(z),xf=x-xi,zf=z-zi,u=xf*xf*(3-2*xf),v=zf*zf*(3-2*zf);
 const a=hash(xi,zi),b=hash(xi+1,zi),c=hash(xi,zi+1),d=hash(xi+1,zi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
const fbm=(x,z)=>vnoise(x,z)*0.55+vnoise(x*2.1,z*2.1)*0.28+vnoise(x*4.3,z*4.3)*0.17;
function canvasTex(w,h,draw,srgb=true,rep=true){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);if(srgb)t.encoding=THREE.sRGBEncoding;if(rep){t.wrapS=t.wrapT=THREE.RepeatWrapping;}t.anisotropy=Math.min(4,R.capabilities.getMaxAnisotropy());return t;}
/* geometry baking: a model built from many parts becomes one mesh per material */
function bakeGroup(g){g.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(g.matrixWorld).invert(),by=new Map();
 g.traverse(o=>{if(!o.isMesh)return;const m=new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld);let geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(m);
  if(!geo.attributes.uv)geo.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));
  const k=o.material.uuid;if(!by.has(k))by.set(k,{mat:o.material,list:[]});by.get(k).list.push(geo);});
 const out=[];for(const {mat,list} of by.values()){let n=0;for(const q of list)n+=q.attributes.position.count;const P_=new Float32Array(n*3),N_=new Float32Array(n*3),U_=new Float32Array(n*2);let o=0;
  for(const q of list){P_.set(q.attributes.position.array,o*3);N_.set(q.attributes.normal.array,o*3);U_.set(q.attributes.uv.array,o*2);o+=q.attributes.position.count;q.dispose();}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(P_,3));geo.setAttribute('normal',new THREE.BufferAttribute(N_,3));geo.setAttribute('uv',new THREE.BufferAttribute(U_,2));geo.computeBoundingSphere();out.push({geo,mat});}
 return out;}
const MESH=(geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.position.set(x||0,y||0,z||0);return o;};
const BOX=(w,h,d,m,x,y,z)=>MESH(new THREE.BoxGeometry(w,h,d),m,x,y,z);
const CYL=(r1,r2,h,m,n,x,y,z)=>MESH(new THREE.CylinderGeometry(r1,r2,h,n||12),m,x,y,z);
const SPH=(r,m,x,y,z,ws,hs)=>MESH(new THREE.SphereGeometry(r,ws||14,hs||10),m,x,y,z);
function profile(pts,depth,m){const s=new THREE.Shape();s.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)s.lineTo(pts[i][0],pts[i][1]);s.closePath();
 const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelThickness:0.6,bevelSize:0.6,bevelSegments:1});g.translate(0,0,-depth/2);g.computeBoundingBox();const bb=g.boundingBox,sz=Math.max(bb.max.x-bb.min.x,bb.max.y-bb.min.y,depth)||1,uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/sz,uv.getY(i)/sz);return new THREE.Mesh(g,m);}
function displace(geo,amp,f){const p=geo.attributes.position,v=new THREE.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const n=fbm(v.x*f+11,v.z*f+v.y*f*0.7);v.multiplyScalar(1+(n-0.5)*amp);p.setXYZ(i,v.x,v.y,v.z);}geo.computeVertexNormals();return geo;}

/* ---------- painted textures ---------- */
const TX={};
function texGrass(th){const T=THEME[th];return canvasTex(512,512,(c,w,h)=>{c.fillStyle=T.g1;c.fillRect(0,0,w,h);
  for(let i=0;i<70;i++){const x=rn()*w,y=rn()*h,r=20+rn()*70,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,(rn()<0.5?T.g2:T.g3)+'AA');g.addColorStop(1,T.g1+'00');c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);}
  for(let i=0;i<9000;i++){const x=rn()*w,y=rn()*h,l=2+rn()*5;c.strokeStyle=rn()<0.5?T.g2:rn()<0.5?T.g3:'rgba(255,255,220,0.25)';c.globalAlpha=0.35+rn()*0.4;c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.lineTo(x+(rn()-0.5)*2,y-l);c.stroke();}
  c.globalAlpha=1;});}
function texRoad(th){const T=THEME[th];return canvasTex(256,512,(c,w,h)=>{c.clearRect(0,0,w,h);
  const g=c.createLinearGradient(0,0,w,0);g.addColorStop(0,T.dirt+'00');g.addColorStop(0.12,T.dirt+'FF');g.addColorStop(0.88,T.dirt+'FF');g.addColorStop(1,T.dirt+'00');c.fillStyle=g;c.fillRect(0,0,w,h);
  c.globalCompositeOperation='source-atop';
  for(let i=0;i<2600;i++){const x=rn()*w,y=rn()*h;c.fillStyle=rn()<0.5?'rgba(60,40,20,0.18)':'rgba(255,240,210,0.16)';c.fillRect(x,y,1+rn()*3,1+rn()*3);}
  for(const rx of [0.3,0.7]){const gx=c.createLinearGradient(w*(rx-0.09),0,w*(rx+0.09),0);gx.addColorStop(0,'rgba(0,0,0,0)');gx.addColorStop(0.5,T.dirt2+'CC');gx.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=gx;c.fillRect(w*(rx-0.09),0,w*0.18,h);
   for(let y=0;y<h;y+=6){c.fillStyle='rgba(30,20,10,0.18)';c.fillRect(w*rx-8,y,16,2);}}
  for(let i=0;i<60;i++){const x=w*(0.15+rn()*0.7),y=rn()*h;c.fillStyle='rgba(120,120,110,0.55)';c.beginPath();c.ellipse(x,y,1.5+rn()*2.5,1+rn()*2,rn()*3,0,7);c.fill();}
  c.globalCompositeOperation='source-over';});}
function texTrack(){return canvasTex(128,256,(c,w,h)=>{c.fillStyle='#5A5C5E';c.fillRect(0,0,w,h);for(let i=0;i<1500;i++){c.fillStyle=rn()<0.5?'#46484A':'#6E7072';c.fillRect(rn()*w,rn()*h,2,2);}
  for(let y=0;y<h;y+=22){c.fillStyle='#4A3A2C';c.fillRect(8,y,w-16,9);c.fillStyle='rgba(0,0,0,0.25)';c.fillRect(8,y+9,w-16,2);}
  for(const x of [0.28,0.72]){c.fillStyle='#8E9296';c.fillRect(w*x-4,0,8,h);c.fillStyle='#C8CCD0';c.fillRect(w*x-4,0,2,h);}});}
function texConcrete(){return canvasTex(256,256,(c,w,h)=>{c.fillStyle='#857F74';c.fillRect(0,0,w,h);for(let i=0;i<4000;i++){c.fillStyle=rn()<0.5?'rgba(0,0,0,0.07)':'rgba(255,255,255,0.08)';c.fillRect(rn()*w,rn()*h,1+rn()*3,1+rn()*3);}
  c.strokeStyle='rgba(40,35,30,0.35)';c.lineWidth=1;for(let i=0;i<6;i++){let x=rn()*w,y=rn()*h;c.beginPath();c.moveTo(x,y);for(let k=0;k<6;k++){x+=(rn()-0.5)*40;y+=(rn()-0.5)*40;c.lineTo(x,y);}c.stroke();}
  c.strokeStyle='rgba(30,30,30,0.5)';c.lineWidth=3;c.strokeRect(4,4,w-8,h-8);});}
function texWood(){return canvasTex(256,256,(c,w,h)=>{for(let y=0;y<h;y+=16){c.fillStyle=['#7A5636','#6E4C2E','#86603C'][(y/16)%3];c.fillRect(0,y,w,15);c.fillStyle='#3A2818';c.fillRect(0,y+15,w,1);
  for(let i=0;i<30;i++){c.fillStyle='rgba(40,25,10,0.25)';c.fillRect(rn()*w,y+rn()*14,10+rn()*40,1);}}});}
function texBlade(th){const T=THEME[th];return canvasTex(128,128,(c,w,h)=>{c.clearRect(0,0,w,h);for(let i=0;i<16;i++){const x=10+rn()*(w-20),bend=(rn()-0.5)*30,hh=h*(0.55+rn()*0.45);
  const g=c.createLinearGradient(0,h,0,h-hh);g.addColorStop(0,T.g3);g.addColorStop(1,rn()<0.5?T.g2:'#B8D86A');c.strokeStyle=g;c.lineWidth=2.5+rn()*2.5;c.lineCap='round';c.beginPath();c.moveTo(x,h);c.quadraticCurveTo(x+bend*0.3,h-hh*0.5,x+bend,h-hh);c.stroke();}},true,false);}
function texSoft(r,g,b,hard){return canvasTex(64,64,(c,w,h)=>{const gr=c.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,`rgba(${r},${g},${b},1)`);gr.addColorStop(hard||0.35,`rgba(${r},${g},${b},0.7)`);gr.addColorStop(1,`rgba(${r},${g},${b},0)`);c.fillStyle=gr;c.fillRect(0,0,w,h);},true,false);}
function texSmoke(){return canvasTex(128,128,(c,w,h)=>{for(let i=0;i<22;i++){const x=34+rn()*60,y=34+rn()*60,r=16+rn()*26,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,255,255,0.35)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,w,h);}},true,false);}
function texCloud(){return canvasTex(256,128,(c,w,h)=>{for(let i=0;i<40;i++){const x=40+rn()*176,y=50+rn()*40-(Math.abs(x-128)/128)*10,r=18+rn()*34,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,255,255,0.55)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,w,h);}},true,false);}
function texRipple(){return canvasTex(256,256,(c,w,h)=>{const im=c.createImageData(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const f=(a,b)=>Math.sin(a*0.11+Math.sin(b*0.07)*2)*0.5+Math.sin((a+b)*0.05)*0.3+fbm(a*0.04,b*0.04)*0.6;
  const dx=f(x+1,y)-f(x-1,y),dy=f(x,y+1)-f(x,y-1),i=(y*w+x)*4;im.data[i]=128+dx*90;im.data[i+1]=128+dy*90;im.data[i+2]=255;im.data[i+3]=255;}c.putImageData(im,0,0);},false);}

/* ---------- sky: a gradient dome with the sun, used for the background and the reflections ---------- */
function mkSky(th){const T=THEME[th];const g=new THREE.SphereGeometry(2600,32,16);
 const m=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{top:{value:lin(T.sky)},hz:{value:lin(T.hz)},sd:{value:SUN_DIR}},
  vertexShader:'varying vec3 vd;void main(){vd=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position.z=gl_Position.w;}',
  fragmentShader:'uniform vec3 top;uniform vec3 hz;uniform vec3 sd;varying vec3 vd;void main(){float h=clamp(vd.y,0.0,1.0);vec3 c=mix(hz,top,pow(h,0.55));if(vd.y<0.0)c=hz*0.92;float s=max(dot(normalize(vd),sd),0.0);c+=vec3(1.0,0.9,0.7)*(pow(s,600.0)*6.0+pow(s,12.0)*0.35);gl_FragColor=vec4(c,1.0);}'});
 const o=new THREE.Mesh(g,m);o.renderOrder=-10;o.frustumCulled=false;return o;}
let envRT=null;
function mkEnv(th){const T=THEME[th],hex=c=>'#'+new THREE.Color(c).getHexString();
 const tex=canvasTex(256,128,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,hex(T.sky));g.addColorStop(0.47,hex(T.hz));g.addColorStop(0.53,T.g3);g.addColorStop(1,T.g1);c.fillStyle=g;c.fillRect(0,0,w,h);
  const sx=w*0.62,sy=h*0.22,gr=c.createRadialGradient(sx,sy,0,sx,sy,30);gr.addColorStop(0,'rgba(255,250,230,1)');gr.addColorStop(1,'rgba(255,250,230,0)');c.fillStyle=gr;c.fillRect(0,0,w,h);},true,false);
 tex.mapping=THREE.EquirectangularReflectionMapping;const pm=new THREE.PMREMGenerator(R);if(envRT)envRT.dispose();envRT=pm.fromEquirectangular(tex);pm.dispose();tex.dispose();return envRT.texture;}

function smoothPl(pl,r){if(pl.length<3)return pl.map(p=>[p[0],p[1]]);const o=[[pl[0][0],pl[0][1]]];
 for(let i=1;i<pl.length-1;i++){const a=pl[i-1],b=pl[i],c=pl[i+1],l1=Math.hypot(b[0]-a[0],b[1]-a[1]),l2=Math.hypot(c[0]-b[0],c[1]-b[1]),rr=Math.min(r,l1/2,l2/2);
  const p1=[b[0]+(a[0]-b[0])/l1*rr,b[1]+(a[1]-b[1])/l1*rr],p2=[b[0]+(c[0]-b[0])/l2*rr,b[1]+(c[1]-b[1])/l2*rr];
  for(let k=0;k<=8;k++){const t=k/8,u=1-t;o.push([u*u*p1[0]+2*u*t*b[0]+t*t*p2[0],u*u*p1[1]+2*u*t*b[1]+t*t*p2[1]]);}}
 o.push([pl[pl.length-1][0],pl[pl.length-1][1]]);return o;}
function strip(pl,w,y,m,vs){const n=pl.length;if(n<2)return null;const P_=[],U=[],I=[];let L=0;
 for(let i=0;i<n;i++){const a=pl[Math.max(0,i-1)],b=pl[Math.min(n-1,i+1)];let dx=b[0]-a[0],dz=b[1]-a[1];const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;
  if(i>0)L+=Math.hypot(pl[i][0]-pl[i-1][0],pl[i][1]-pl[i-1][1]);const nx=-dz,nz=dx,x=pl[i][0],z=pl[i][1];
  P_.push(x+nx*w/2,y+Math.max(0,hgt(x+nx*w/2,z+nz*w/2)),z+nz*w/2,x-nx*w/2,y+Math.max(0,hgt(x-nx*w/2,z-nz*w/2)),z-nz*w/2);U.push(0,L/(vs||w),1,L/(vs||w));
  if(i>0){const k=(i-1)*2;I.push(k,k+1,k+2,k+1,k+3,k+2);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P_,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setIndex(I);g.computeVertexNormals();
 const o=new THREE.Mesh(g,m);o.receiveShadow=true;return o;}
const M3={};
function materials(th){const T=THEME[th];
 TX.grass=texGrass(th);TX.grass.repeat.set(5200/56,3400/56);TX.road=texRoad(th);TX.track=texTrack();TX.conc=texConcrete();TX.wood=texWood();TX.blade=texBlade(th);
 TX.fire=texSoft(255,200,110,0.25);TX.glow=texSoft(255,240,200,0.15);TX.smoke=texSmoke();TX.cloud=texCloud();TX.ripple=texRipple();TX.ripple.repeat.set(3,30);TX.dark=texSoft(20,16,12,0.5);
 M3.ground=new THREE.MeshStandardMaterial({map:TX.grass,vertexColors:true,roughness:1,metalness:0});
 M3.road=new THREE.MeshStandardMaterial({map:TX.road,transparent:true,side:THREE.DoubleSide,depthWrite:false,roughness:0.95,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 M3.track=new THREE.MeshStandardMaterial({map:TX.track,side:THREE.DoubleSide,roughness:0.7,metalness:0.2,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
 M3.conc=new THREE.MeshStandardMaterial({map:TX.conc,roughness:0.9});M3.wood=new THREE.MeshStandardMaterial({map:TX.wood,roughness:0.85});
 M3.steel=std(0x7A8088,0.45,0.7);M3.dark=std(0x2A2E33,0.6,0.5);M3.rubber=std(0x1E1E20,0.9,0);M3.glass=new THREE.MeshStandardMaterial({color:lin(0x2A3A48),roughness:0.08,metalness:0.6});
 M3.crys=new THREE.MeshStandardMaterial({color:lin(0x7FE0FF),emissive:lin(0x2A90D8),emissiveIntensity:0.9,roughness:0.15,metalness:0.1});
 M3.rock=std(T.rock,0.95,0);M3.bark=std(T.bark,0.95,0);M3.gold=std(0xF2C232,0.35,0.8);M3.skin=std(0xD8B490,0.8,0);M3.olive=std(0x4E5A3A,0.85,0);
 M3.lamp=new THREE.MeshStandardMaterial({color:0xFFF0C0,emissive:0xFFD070,emissiveIntensity:1.5});}
function addShadow(o,c,r){o.traverse(m=>{if(m.isMesh){m.castShadow=c;m.receiveShadow=r;}});return o;}
function mkHQmil(si){const g=new THREE.Group(),t=TEAM3(si);
 g.add(CYL(54,58,4,M3.conc,10,0,2,0));
 const tent=milProp('Tent_002',58,si,0.35);tent.position.set(-4,4,0);g.add(tent);
 const tw=milProp('Tower_003',20,null);tw.scale.multiplyScalar(1.15);tw.position.set(-34,0,-34);g.add(tw);
 const rs=milProp('Radiostation_001',22,si,0.25);rs.rotation.y+=Math.PI/2;rs.position.set(-32,4,30);g.add(rs);
 for(const [x,z,a] of [[44,-22,0.5],[48,6,0],[42,32,-0.5]]){const b=milProp('Barrier_006',28,null);b.rotation.y+=a+Math.PI/2;b.position.set(x,0,z);g.add(b);}
 for(const [n,x,z,l,r] of [['Box_005',20,-40,10,0.3],['Box_003',26,-36,8,1.2],['Barrel_005',12,40,4,0],['Barrel_005',16,44,4,0],['Barrel_005',10,46,4,0],['Generator_004',-6,-46,14,0.4],['Tires_001',30,40,5,0]]){const o=milProp(n,l,null);o.rotation.y+=r;o.position.set(x,0,z);g.add(o);}
 g.add(CYL(0.7,0.9,46,M3.steel,8,10,23,-30));const fl=BOX(0.5,12,20,std(t.m,0.6,0),10,40,-40);g.add(fl);const fl2=BOX(0.6,3,20,std(0xFFFFFF,0.6,0),10,37.5,-40);g.add(fl2);
 return addShadow(g,true,true);}
/* ---------- vehicles, soldiers and towers: built once per kind and team, baked, then shared ---------- */
const PROTO=new Map();
function proto(key,build_){let p=PROTO.get(key);if(!p){const g=build_();p={};for(const ch of g.children){const name=ch.name||'body';p[name]={parts:bakeGroup(ch),pos:ch.position.clone()};}PROTO.set(key,p);}return p;}
function instantiate(p){const g=new THREE.Group();for(const name in p){const sub=new THREE.Group();sub.name=name;sub.position.copy(p[name].pos);for(const {geo,mat} of p[name].parts){const m=new THREE.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=true;sub.add(m);}g.add(sub);g.userData[name]=sub;}return g;}
function part(name,...ch){const g=new THREE.Group();g.name=name;for(const c of ch)g.add(c);return g;}
function wheels(list,r,w,m){return list.map(([x,z])=>{const c=CYL(r,r,w,m||M3.rubber,12,x,r,z);c.rotation.x=Math.PI/2;return c;});}
/* painted panels for machines: seams, rivets, scuffed edges, grime — the colour comes from the material */
let PANEL=null;
function panelTex(){if(PANEL)return PANEL;const sz=256;const draw=(c,w,h,bump)=>{c.fillStyle=bump?'#808080':'#E6E6E2';c.fillRect(0,0,w,h);
  for(let i=0;i<3000;i++){const v=bump?128+(rn()-0.5)*8:225+(rn()-0.5)*30;c.fillStyle=`rgb(${v},${v},${v})`;c.fillRect(rn()*w,rn()*h,1+rn()*2,1+rn()*2);}
  const seam=(x,y,ww,hh)=>{c.strokeStyle=bump?'#303030':'rgba(40,40,40,0.75)';c.lineWidth=3;c.strokeRect(x,y,ww,hh);c.strokeStyle=bump?'#C8C8C8':'rgba(255,255,255,0.35)';c.lineWidth=1;c.strokeRect(x+2,y+2,ww-4,hh-4);};
  seam(3,3,w-6,h-6);seam(3,h*0.5,w*0.5,h*0.5-3);
  for(const [x0,y0,x1,y1] of [[10,10,w-10,10],[10,h-10,w-10,h-10],[10,10,10,h-10],[w-10,10,w-10,h-10]]){const n=8;for(let k=0;k<=n;k++){const x=x0+(x1-x0)*k/n,y=y0+(y1-y0)*k/n;c.fillStyle=bump?'#E0E0E0':'rgba(70,70,70,0.8)';c.beginPath();c.arc(x,y,2.2,0,7);c.fill();if(!bump){c.fillStyle='rgba(255,255,255,0.6)';c.beginPath();c.arc(x-0.7,y-0.7,0.9,0,7);c.fill();}}}
  if(!bump){for(let i=0;i<40;i++){const x=rn()*w,y=rn()*h,l=6+rn()*26,a=rn()*3;c.strokeStyle='rgba(255,255,255,0.35)';c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);c.stroke();}
   const g=c.createLinearGradient(0,h*0.55,0,h);g.addColorStop(0,'rgba(60,45,30,0)');g.addColorStop(1,'rgba(60,45,30,0.45)');c.fillStyle=g;c.fillRect(0,0,w,h);
   for(let i=0;i<14;i++){const x=rn()*w,y=rn()*h,r=4+rn()*14,gg=c.createRadialGradient(x,y,0,x,y,r);gg.addColorStop(0,'rgba(50,40,30,0.35)');gg.addColorStop(1,'rgba(50,40,30,0)');c.fillStyle=gg;c.fillRect(x-r,y-r,2*r,2*r);}}};
 PANEL={map:canvasTex(sz,sz,(c,w,h)=>draw(c,w,h,false),true,true),bump:canvasTex(sz,sz,(c,w,h)=>draw(c,w,h,true),false,true)};return PANEL;}
const PM={};
function pnt(c,r,m){const k=c+'|'+r+'|'+m;if(PM[k])return PM[k];const T=panelTex();return PM[k]=new THREE.MeshStandardMaterial({color:lin(c),roughness:r,metalness:m,map:T.map,bumpMap:T.bump,bumpScale:0.5,envMapIntensity:0.6});}
function mats(si){const t=TEAM3(si);return{paint:pnt(t.m,0.5,0.35),dark:pnt(t.d,0.6,0.35),gun:pnt(0x30343A,0.45,0.65),steel:pnt(0x7C828A,0.4,0.75),track:std(0x1E1E20,0.9,0.1),glass:M3.glass,lamp:M3.lamp,olive:pnt(0x4E5A3A,0.85,0)};}
function rotX(o){o.rotation.x=Math.PI/2;return o;}function rotZ(o){o.rotation.z=Math.PI/2;return o;}
/* ---------- ready-made models (ithappy «Military FREE», CGTrader): loaded once, then used instead of the built ones ---------- */
let MIL=null;const MILT={};
function loadMil(){if(!THREE.GLTFLoader)return;new THREE.GLTFLoader().load('mil.glb',g=>{const m=new Map();g.scene.traverse(o=>{if(o.name&&!m.has(o.name))m.set(o.name,o);if(o.isMesh){o.material.envMapIntensity=0.5;if(o.material.map)o.material.map.anisotropy=4;}});
  MIL=m;PROTO.clear();for(const e of live.values())dyn.remove(e.o);live.clear();T3.sig=null;if(typeof onMil==='function')onMil();},undefined,e=>console.error('mil.glb',e));}
/* a clean copy of one model: at the origin, standing on the ground, centred, nose along +X, a given length */
function milFit(name,len,keepParts){const src=MIL.get(name);const c=src.clone(true);c.position.set(0,0,0);c.quaternion.identity();c.scale.set(1,1,1);c.updateMatrixWorld(true);
 const bb=new THREE.Box3().setFromObject(c),sz=bb.getSize(new THREE.Vector3()),s=len/Math.max(sz.z,sz.x,0.001);
 const off=new THREE.Vector3(-(bb.min.x+bb.max.x)/2,-bb.min.y,-(bb.min.z+bb.max.z)/2);return{c,s,off};}
function wrap(obj,s,off){const w=new THREE.Group();w.rotation.y=Math.PI/2;w.scale.setScalar(s);obj.position.add(off);w.add(obj);return w;}
const toRoot=(v,s)=>v.clone().multiplyScalar(s).applyAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2);
function tintTeam(obj,si,k){const t=TEAM3(si),col=lin(t.m);obj.traverse(o=>{if(!o.isMesh)return;const key=o.material.uuid+'|'+si+'|'+k;let m=MILT[key];
 if(!m){m=o.material.clone();m.color=new THREE.Color(1,1,1).lerp(col,k);m.envMapIntensity=0.5;MILT[key]=m;}o.material=m;});return obj;}
function milUnit(k,si){const root=new THREE.Group();
 if(k==='tank'||k==='titan'){const {c,s,off}=milFit('Tank_006',30);const tw=c.getObjectByName('Tank_tower_006');c.remove(tw);
  const piv=toRoot(tw.position.clone().add(off),s);const tq=tw.quaternion.clone();tw.position.set(0,0,0);
  root.add(part('body',tintTeam(wrap(c,s,off),si,0.55)));const tur=new THREE.Group();tur.name='tur';tur.position.copy(piv);const tw2=new THREE.Group();tw2.rotation.y=Math.PI/2;tw2.scale.setScalar(s);tw.quaternion.copy(tq);tw2.add(tintTeam(tw,si,0.55));tur.add(tw2);root.add(tur);}
 else if(k==='jeep'){const {c,s,off}=milFit('Hummer_003',21);root.add(part('body',tintTeam(wrap(c,s,off),si,0.6)));}
 else if(k==='heli'){const {c,s,off}=milFit('Helicopter_001',46);const b1=c.getObjectByName('Blade_001'),b2=c.getObjectByName('Blade_002');c.remove(b1);c.remove(b2);
  root.add(part('body',tintTeam(wrap(c,s,off),si,0.55)));
  for(const [b,nm] of [[b1,'rot'],[b2,'rot2']]){const g=new THREE.Group();g.name=nm;g.position.copy(toRoot(b.position.clone().add(off),s));const q=b.quaternion.clone();b.position.set(0,0,0);b.quaternion.copy(q);const w=new THREE.Group();w.rotation.y=Math.PI/2;w.scale.setScalar(s);w.add(b);g.add(w);root.add(g);}
  root.children.forEach(ch=>ch.position.y-=7);}
 return root;}
function milProp(name,len,tintSi,k){const {c,s,off}=milFit(name,len,true);const w=wrap(c,s,off);if(tintSi!=null)tintTeam(w,tintSi,k||0.4);
 else if(/^Barrier_00[6-9]/.test(name)){const col=lin(0x8A7A58);w.traverse(o=>{if(!o.isMesh)return;const key=o.material.uuid+'|earth';let m=MILT[key];if(!m){m=o.material.clone();m.color=new THREE.Color(1,1,1).lerp(col,0.6);MILT[key]=m;}o.material=m;});}
 return addShadow(w,true,true);}
function buildUnit(k,si){if(MIL&&(k==='tank'||k==='titan'||k==='jeep'||k==='heli'))return milUnit(k,si);const M=mats(si);const root=new THREE.Group();
 if(k==='inf'){const body=[];const uni=pnt(TEAM3(si).d,0.85,0);
  for(const [dx,dz,ph] of [[0,0,0],[-7,-5,1],[-7,5,2],[-14,0,3]]){const st=(ph%2?1:-1)*0.35;
   const l1=BOX(1.5,4.4,1.5,uni,dx,2.2,dz-0.9);l1.rotation.z=st;const l2=BOX(1.5,4.4,1.5,uni,dx,2.2,dz+0.9);l2.rotation.z=-st;
   body.push(l1,l2,BOX(2.8,4.8,3.6,uni,dx,6.8,dz),BOX(2.2,3,3.4,M.olive,dx-1.6,7,dz),SPH(1.35,M3.skin,dx,10.2,dz,10,8),MESH(new THREE.SphereGeometry(1.75,12,6,0,Math.PI*2,0,Math.PI/2),M.olive,dx,10.4,dz),
    BOX(1.2,3.6,1.2,uni,dx+0.6,6.6,dz-2.3),rotZ(CYL(0.35,0.35,7,M.gun,6,dx+2.4,7.6,dz+1.9)),BOX(2,1.2,0.8,M.gun,dx+1.4,7.2,dz+1.9));}
  root.add(part('body',...body));}
 else if(k==='jeep'){root.add(part('body',profile([[-9.5,2.5],[9.5,2.5],[10,5.5],[4.5,7],[-1,7.4],[-9.5,7.4]],10,M.paint),BOX(4.4,4,9,M.glass,-0.5,10,0),BOX(0.8,4.6,9.8,M.gun,-2.8,10,0),
  BOX(1.2,1.2,10.6,M.gun,9.8,4,0),SPH(0.9,M.lamp,10,6,3.4,8,6),SPH(0.9,M.lamp,10,6,-3.4,8,6),rotX(CYL(2.4,2.4,1.6,M.track,14,-10.6,6,0)),
  ...wheels([[6,5.4],[6,-5.4],[-6,5.4],[-6,-5.4]],2.7,2.4,M.track),...wheels([[6,5.5],[6,-5.5],[-6,5.5],[-6,-5.5]],1.4,2.6,M.steel),
  CYL(0.7,0.9,5,M.gun,8,-5.5,10.5,0),rotZ(CYL(0.45,0.45,8,M.gun,6,-2,13,0)),BOX(2.6,2,2.6,M.gun,-5.5,13,0),BOX(5,3,8,M.dark,-7,8.6,0)));}
 else if(k==='tank'||k==='titan'){const tr=[];
  for(const s of [-1,1]){tr.push(BOX(29,5.4,4.8,M.track,0,3.2,s*8.2));for(let i=0;i<6;i++)tr.push(rotX(CYL(2.2,2.2,5,M.steel,12,-12.5+i*5,2.6,s*8.2)));tr.push(rotX(CYL(2.6,2.6,5,M.gun,12,13,4.4,s*8.2)),rotX(CYL(2.6,2.6,5,M.gun,12,-14,4.4,s*8.2)));
   tr.push(BOX(28,3.2,1,M.dark,0,6.6,s*10.8));}
  root.add(part('body',profile([[-14,3.5],[11,3.5],[15,6.5],[12,9.5],[-14,9.5]],15,M.dark),...tr,BOX(7,1.4,12,M.gun,-10,10.4,0),
   rotZ(CYL(0.9,0.9,3,M.gun,8,-15.5,8,4)),rotZ(CYL(0.9,0.9,3,M.gun,8,-15.5,8,-4)),SPH(0.9,M.lamp,14,9,5.5,8,6),SPH(0.9,M.lamp,14,9,-5.5,8,6),BOX(4,1,3,M.steel,-6,10.3,5)));
  const tu=part('tur',profile([[-7,0],[5,0],[9,2.6],[6,5.6],[-8,5.6]],11,M.paint),CYL(2.4,2.4,1.6,M.steel,12,-2,6.4,2.2),BOX(5,4,9.6,M.dark,-9.5,2.8,0),
   CYL(0.2,0.2,12,M.gun,4,-7,11,-3.5),rotZ(CYL(0.4,0.4,5,M.gun,6,1,7.4,2.2)));
  tu.add(rotZ(CYL(1.1,1.35,17,M.gun,12,16,2.8,0)),rotZ(CYL(1.6,1.6,3.6,M.gun,12,17,2.8,0)),rotZ(CYL(1.9,1.9,2.6,M.gun,12,24.6,2.8,0)));tu.position.y=9.5;root.add(tu);}
 else if(k==='heli'){const f=new THREE.Mesh(new THREE.SphereGeometry(1,22,14),M.paint);f.scale.set(10,5.6,5.4);const canopy=new THREE.Mesh(new THREE.SphereGeometry(1,16,10,0,Math.PI*2,0,Math.PI/2),M.glass);canopy.scale.set(5.2,3.8,4.4);canopy.position.set(5,1.2,0);
  const tail=rotZ(CYL(0.8,2.2,18,M.dark,10,-15,1,0));const fin=profile([[-25,0],[-20,0],[-22,7],[-25.5,7]],0.8,M.dark);const hs=BOX(4,0.6,9,M.dark,-21,1,0);
  const sk=[];for(const s of [-1,1])sk.push(BOX(17,0.8,0.8,M.gun,0,-5.8,s*4.2),BOX(0.8,4,0.8,M.gun,3,-4,s*4.2),BOX(0.8,4,0.8,M.gun,-3,-4,s*4.2),rotZ(CYL(0.9,0.9,6,M.gun,8,4,-1.5,s*5.6)));
  root.add(part('body',f,canopy,tail,fin,hs,...sk,CYL(1.2,1.6,2.8,M.gun,10,0,6,0),BOX(8,2.4,4.6,M.dark,-1,5,0)));
  const blades=[];for(let i=0;i<4;i++){const b=BOX(22,0.35,1.7,M.gun,11,0,0);const gg=new THREE.Group();gg.add(b);gg.rotation.y=i*Math.PI/2;blades.push(gg);}const rot=part('rot',...blades,CYL(1.4,1.4,1.2,M.steel,10,0,0,0));rot.position.y=7.6;root.add(rot);
  const tr2=part('rot2',BOX(0.4,7,0.9,M.gun,0,0,0),BOX(0.9,0.4,7,M.gun,0,0,0));tr2.position.set(-23,4.5,1.4);root.add(tr2);}
 else if(k==='plane'){const f=rotZ(CYL(2.4,1.3,30,M.paint,16,0,0,0));const nose=MESH(new THREE.ConeGeometry(2.4,7,16),M.paint,18.5,0,0);nose.rotation.z=-Math.PI/2;
  const wing=profile([[-7,0],[6,0],[-1,17],[-6,17]],1.1,M.dark);wing.rotation.x=Math.PI/2;wing.position.y=-0.6;const wing2=wing.clone();wing2.scale.y=-1;
  const ht=profile([[-15.5,0],[-10,0],[-13.5,7],[-16.5,7]],0.8,M.dark);ht.rotation.x=Math.PI/2;const ht2=ht.clone();ht2.scale.y=-1;const vt=profile([[-15,0],[-9,0],[-14,9],[-17,9]],0.8,M.dark);
  const pods=[];for(const s of [-1,1])pods.push(rotZ(CYL(0.8,0.8,7,M.gun,8,0,-1.6,s*8)),rotZ(CYL(0.6,0.6,5,std(0xD8D8D0,0.6,0.3),8,1,-1.6,s*12)));
  root.add(part('body',f,nose,wing,wing2,ht,ht2,vt,BOX(6,2.2,3,M.glass,7,2.2,0),SPH(1.5,M3.lamp,-15.8,0,0,8,6),...pods));}
 return root;}
function buildHarv(si){const M=mats(si);const root=new THREE.Group();const cab=pnt(0xE8B828,0.5,0.3);
 const crys=[];for(let i=0;i<5;i++){const c=new THREE.Mesh(new THREE.OctahedronGeometry(1.8+i%2,0),M3.crys);c.scale.y=1.8;c.position.set(-9+i*3.4,14.6,(i%2-0.5)*4);c.rotation.z=(i%3-1)*0.3;crys.push(c);}
 root.add(part('body',BOX(21,8,13,M.paint,-3,8,0),BOX(20,1.2,13.4,M.steel,-3,12.6,0),BOX(8,9.5,12,cab,11.5,8.4,0),BOX(2.6,4,10,M.glass,15.3,10,0),BOX(1,1,12.4,M.gun,15.8,4.6,0),
  SPH(0.8,M.lamp,15.8,6.4,4.6,8,6),SPH(0.8,M.lamp,15.8,6.4,-4.6,8,6),CYL(0.6,0.6,6,M.gun,6,8,15,5),...crys,
  ...wheels([[11,6.7],[11,-6.7],[0,6.7],[0,-6.7],[-9,6.7],[-9,-6.7]],3,2.6,M.track),...wheels([[11,6.8],[11,-6.8],[0,6.8],[0,-6.8],[-9,6.8],[-9,-6.8]],1.5,2.8,M.steel)));return root;}
function buildTower(k,si,lv){const M=mats(si);const root=new THREE.Group();
 const base=[];const b=CYL(15,17.5,7,M3.conc,8,0,3.5,0);b.rotation.y=Math.PI/8;base.push(b,CYL(12.5,12.5,1.6,M.steel,20,0,7.8,0));
 const bag=std(0x7E7258,0.95,0);for(let i=0;i<12;i++){const a=i/12*Math.PI*2+0.2;const s_=SPH(1,bag,Math.cos(a)*17.5,1.4,Math.sin(a)*17.5,10,6);s_.scale.set(2.2,1.3,3.4);s_.rotation.y=-a;base.push(s_);}
 if(lv>=3)base.push(CYL(15.3,15.3,1.2,M3.gold,8,0,5,0));if(lv>=5)base.push(CYL(16.4,16.4,1.2,M3.gold,8,0,2,0));root.add(part('body',...base));
 const tu=new THREE.Group();tu.name='tur';tu.position.y=8.6;root.add(tu);
 if(MIL&&k==='mg'){const {c,s,off}=milFit('Machine_gun_004',17);tu.add(CYL(6,6,1.4,M.steel,16,0,0.6,0),BOX(6,4,7,M.dark,-3,3,0));tu.add(tintTeam(wrap(c,s,off),si,0.5));}
 else if(MIL&&k==='can'){const {c,s,off}=milFit('Mortar_001',20);tu.add(tintTeam(wrap(c,s,off),si,0.5));tu.add(CYL(7,7,1.4,M.steel,16,0,0.6,0));}
 else if(MIL&&k==='tes'){const {c,s,off}=milFit('Radiostation_001',26,true);root.children[0].add(tintTeam(wrap(c,s,off),si,0.35));root.children[0].children[root.children[0].children.length-1].position.y+=8;
  const d=MESH(new THREE.SphereGeometry(6,20,6,0,Math.PI*2,0,Math.PI*0.22),pnt(TEAM3(si).l,0.35,0.6),0,6,0);d.rotation.z=Math.PI*0.62;tu.add(d,CYL(0.7,0.9,6,M.gun,8,0,3,0));tu.position.set(0,17,0);}
 else if(k==='mg'){tu.add(profile([[-6,0],[6,0],[7.5,4],[5,9],[-6,9]],11,M.paint),BOX(3.4,4.4,11.6,M.dark,-7.2,5,0),BOX(4,3,3,M.gun,0,10.5,0),CYL(5,5,1.4,M.steel,16,0,0.6,0));
  for(const s of [-2.4,2.4]){tu.add(rotZ(CYL(0.85,0.85,14,M.gun,10,13,5.6,s)),rotZ(CYL(1.2,1.2,3,M.gun,10,7.5,5.6,s)));}}
 else if(k==='can'){tu.add(CYL(8,9.5,8,M.paint,20,0,4,0),MESH(new THREE.SphereGeometry(8,20,10,0,Math.PI*2,0,Math.PI/2),M.paint,0,8,0),BOX(5,4,5,M.dark,-7,6,0),CYL(1.6,1.6,1.4,M.steel,12,-2,15.6,2));
  tu.add(rotZ(CYL(1.9,2.3,22,M.gun,14,16,6,0)),rotZ(CYL(2.8,2.8,4,M.gun,14,9,6,0)),rotZ(CYL(3.1,3.1,3,M.gun,14,27.5,6,0)));}
 else if(k==='tes'){tu.add(CYL(1.8,2.8,18,M.steel,10,0,9,0),BOX(4,6,4,M.dark,0,3,0));const d=MESH(new THREE.SphereGeometry(12,24,8,0,Math.PI*2,0,Math.PI*0.32),pnt(TEAM3(si).l,0.35,0.6),0,24,0);d.rotation.z=Math.PI*0.62;tu.add(d);
  tu.add(SPH(1.8,M3.lamp,4,26,0,8,6),rotZ(CYL(0.4,0.4,8,M.gun,6,4,22,0)));}
 else{tu.add(BOX(16,9,17,M.paint,0,5,0),BOX(17,1.5,18,M.dark,0,10,0),BOX(6,6,6,M.dark,-9,4,0),CYL(6,6,1.4,M.steel,16,0,0.6,0));for(const [y,z] of [[3.6,-4.4],[3.6,4.4],[7.2,-4.4],[7.2,4.4]]){tu.add(rotZ(CYL(1.9,1.9,10,pnt(0xD8D8D0,0.6,0.3),12,8.5,y,z)));const tip=MESH(new THREE.ConeGeometry(1.6,3,10),std(0xE04030,0.5,0),14,y,z);tip.rotation.z=-Math.PI/2;tu.add(tip);}}
 return root;}
/* ---------- particles: fire, smoke, dust, debris, scorch marks ---------- */
const PART=[],MAXP=isMob?170:320;const scorch=[];
function sprite(map,blend){const s=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false,blending:blend||THREE.NormalBlending}));scene.add(s);return s;}
function spawnP(o){if(PART.length>=MAXP){const x=PART.shift();scene.remove(x.s);x.s.material.dispose();}PART.push(o);return o;}
function puff(x,y,z,kind){if(kind==='dust'){const s=sprite(TX.smoke);s.material.color.set(lin(0xC8B08A));spawnP({s,x,y,z,vx:(rn()-0.5)*4,vy:3,vz:(rn()-0.5)*4,r0:6,r1:20,t:0,T:1.4,a:0.35});}
 else if(kind==='trail'){const s=sprite(TX.smoke);s.material.color.set(0xD8D8D8);spawnP({s,x,y,z,vx:0,vy:2,vz:0,r0:3,r1:11,t:0,T:0.9,a:0.4});}
 else if(kind==='muzzle'){const s=sprite(TX.fire,THREE.AdditiveBlending);s.material.color.set(0xFFC070);spawnP({s,x,y,z,vx:0,vy:0,vz:0,r0:10,r1:4,t:0,T:0.09,a:1});}}
function explode(x,y,z,k){const n=Math.round(3+k*4);
 for(let i=0;i<n;i++){const s=sprite(TX.fire,i<2?THREE.AdditiveBlending:THREE.NormalBlending);s.material.color.setHSL(0.06+rn()*0.05,1,i<2?0.35:0.55);const a=rn()*6.28,v=(10+rn()*30)*k;
  spawnP({s,x,y:y+4*k,z,vx:Math.cos(a)*v,vy:(8+rn()*22)*k,vz:Math.sin(a)*v,r0:5*k,r1:(10+rn()*8)*k,t:0,T:0.3+rn()*0.3,a:0.75,drag:3});}
 for(let i=0;i<n;i++){const s=sprite(TX.smoke);const g=0.18+rn()*0.15;s.material.color.setRGB(g,g,g);const a=rn()*6.28,v=(4+rn()*14)*k;
  spawnP({s,x,y:y+6*k,z,vx:Math.cos(a)*v,vy:(10+rn()*12)*k,vz:Math.sin(a)*v,r0:8*k,r1:(34+rn()*20)*k,t:-0.1-rn()*0.2,T:2.2+rn()*1.6,a:0.75,drag:1.2});}
 for(let i=0;i<Math.round(2*k);i++){const s=sprite(TX.dark);s.material.color.setRGB(0.15,0.12,0.1);const a=rn()*6.28,v=(30+rn()*40)*k;spawnP({s,x,y:y+3,z,vx:Math.cos(a)*v,vy:(30+rn()*40)*k,vz:Math.sin(a)*v,r0:1.4,r1:1,t:0,T:1.1,a:1,g:120});}
 if(k>=0.7){const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:TX.dark,transparent:true,depthWrite:false,opacity:0.7,polygonOffset:true,polygonOffsetFactor:-6}));m.rotation.x=-Math.PI/2;const r=26*k;m.scale.set(r,r,1);m.position.set(x,Math.max(0.6,hgt(x,z)+0.6),z);scene.add(m);scorch.push({m,t:0});if(scorch.length>40){const o=scorch.shift();scene.remove(o.m);o.m.material.dispose();}}
 flash.position.set(x,y+12,z);flash.intensity=Math.max(flash.intensity,3*k);
 if(Math.hypot(x-P.x,z-P.z)<160)P.shake=Math.max(P.shake||0,0.6*k);}
function stepParts(dt){for(let i=PART.length-1;i>=0;i--){const p=PART[i];p.t+=dt;if(p.t<0){p.s.visible=false;continue;}p.s.visible=true;const k=p.t/p.T;if(k>=1){scene.remove(p.s);p.s.material.dispose();PART.splice(i,1);continue;}
  const dr=p.drag?Math.exp(-p.drag*dt):1;p.vx*=dr;p.vz*=dr;p.vy=p.vy*dr-(p.g||0)*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.g&&p.y<0.5){p.y=0.5;p.vy=0;p.vx*=0.5;p.vz*=0.5;}
  const r=p.r0+(p.r1-p.r0)*Math.sqrt(k);p.s.position.set(p.x,p.y,p.z);p.s.scale.set(r,r,1);p.s.material.opacity=p.a*(k<0.15&&!p.g?k/0.15:1)*(1-k);}
 for(const s of scorch){s.t+=dt;s.m.material.opacity=0.7*Math.max(0,1-s.t/30);}
 flash.intensity=Math.max(0,flash.intensity-dt*14);}

/* ---------- post-processing: HDR render, bloom, filmic tone curve, colour grade, vignette ---------- */
const PO={on:false};
function setupPost(){try{if(!R.capabilities.isWebGL2)return;if(!R.extensions.get('EXT_color_buffer_float')&&!R.extensions.get('EXT_color_buffer_half_float'))return;
 const opt={type:THREE.HalfFloatType,format:THREE.RGBAFormat,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter};
 PO.rt=isMob?new THREE.WebGLRenderTarget(4,4,opt):new THREE.WebGLMultisampleRenderTarget(4,4,opt);if(PO.rt.isWebGLMultisampleRenderTarget)PO.rt.samples=4;
 PO.a=new THREE.WebGLRenderTarget(4,4,{...opt,depthBuffer:false});PO.b=new THREE.WebGLRenderTarget(4,4,{...opt,depthBuffer:false});
 const vs='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
 PO.bright=new THREE.ShaderMaterial({uniforms:{t:{value:null},th:{value:1.1}},vertexShader:vs,depthTest:false,depthWrite:false,
  fragmentShader:'uniform sampler2D t;uniform float th;varying vec2 vUv;void main(){vec3 c=texture2D(t,vUv).rgb;if(!(c.r==c.r&&c.g==c.g&&c.b==c.b))c=vec3(0.0);c=clamp(c,0.0,6.0);float l=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(th,th+0.8,l),1.0);}'});
 PO.blur=new THREE.ShaderMaterial({uniforms:{t:{value:null},d:{value:new THREE.Vector2()}},vertexShader:vs,depthTest:false,depthWrite:false,
  fragmentShader:'uniform sampler2D t;uniform vec2 d;varying vec2 vUv;void main(){vec3 c=texture2D(t,vUv).rgb*0.227;c+=(texture2D(t,vUv+d*1.385).rgb+texture2D(t,vUv-d*1.385).rgb)*0.316;c+=(texture2D(t,vUv+d*3.231).rgb+texture2D(t,vUv-d*3.231).rgb)*0.070;gl_FragColor=vec4(c,1.0);}'});
 PO.fin=new THREE.ShaderMaterial({uniforms:{tS:{value:null},tB:{value:null},ex:{value:0.95},bk:{value:0.55}},vertexShader:vs,depthTest:false,depthWrite:false,
  fragmentShader:`uniform sampler2D tS;uniform sampler2D tB;uniform float ex;uniform float bk;varying vec2 vUv;
  vec3 aces(vec3 x){x*=0.6;return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}
  void main(){vec3 s0=texture2D(tS,vUv).rgb;if(!(s0.r==s0.r&&s0.g==s0.g&&s0.b==s0.b))s0=vec3(0.5);vec3 c=clamp(s0,0.0,60.0)*ex+texture2D(tB,vUv).rgb*bk;c=aces(c);
   float l=dot(c,vec3(0.2126,0.7152,0.0722));c=mix(vec3(l),c,0.98);
   c+=vec3(0.035,0.012,-0.03)*smoothstep(0.35,0.9,l)+vec3(-0.012,0.004,0.03)*(1.0-smoothstep(0.0,0.35,l));
   c=pow(max(c,vec3(0.0)),vec3(1.0/2.2));c=mix(c,c*c*(3.0-2.0*c),0.22);
   float v=distance(vUv,vec2(0.5));c*=1.0-0.38*smoothstep(0.42,0.85,v);gl_FragColor=vec4(c,1.0);}`});
 PO.cam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);PO.q=new THREE.Mesh(new THREE.PlaneGeometry(2,2));PO.q.frustumCulled=false;PO.sc=new THREE.Scene();PO.sc.add(PO.q);
 R.toneMapping=THREE.NoToneMapping;PO.on=true;}catch(e){console.error(e);PO.on=false;}}
function postSize(){if(!PO.on)return;const w=Math.max(4,Math.round(innerWidth*T3.q)),h=Math.max(4,Math.round(innerHeight*T3.q));PO.rt.setSize(w,h);const bw=Math.max(4,w>>2),bh=Math.max(4,h>>2);PO.a.setSize(bw,bh);PO.b.setSize(bw,bh);PO.bw=bw;PO.bh=bh;}
function pass(m,target){PO.q.material=m;R.setRenderTarget(target);R.render(PO.sc,PO.cam);}
function draw(){if(!PO.on){R.setRenderTarget(null);R.render(scene,cam);return;}
 R.setRenderTarget(PO.rt);R.render(scene,cam);
 PO.bright.uniforms.t.value=PO.rt.texture;pass(PO.bright,PO.a);
 for(let i=0;i<2;i++){PO.blur.uniforms.t.value=PO.a.texture;PO.blur.uniforms.d.value.set((1+i)/PO.bw,0);pass(PO.blur,PO.b);PO.blur.uniforms.t.value=PO.b.texture;PO.blur.uniforms.d.value.set(0,(1+i)/PO.bh);pass(PO.blur,PO.a);}
 PO.fin.uniforms.tS.value=PO.rt.texture;PO.fin.uniforms.tB.value=PO.a.texture;pass(PO.fin,null);}
setupPost();loadMil();


/* ================== terrain ================== */
const NX=IW/GS+1,NZ=IH/GS+1,HM=new Float32Array(NX*NZ);
const smoothstep=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
let GAPS=[],MINES_AT=[];
function genIsland(seed){seedR=seed;
 GAPS=[IH*0.2+rn()*250,IH*0.5+(rn()-0.5)*300,IH*0.8-rn()*250];
 MINES_AT=[[1900,1250],[1900,IH-1250],[IW-1900,1250],[IW-1900,IH-1250],[3100,IH/2+(rn()-0.5)*500],[IW-3100,IH/2+(rn()-0.5)*500],[IW/2,GAPS[0]],[IW/2,GAPS[2]]];
 for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){const x=i*GS,z=j*GS;
  const ex=(x-IW/2)/(IW*0.5),ez=(z-IH/2)/(IH*0.5);let e=Math.sqrt(ex*ex+ez*ez*1.05);e+=(fbm(x*0.0011+seed,z*0.0011)-0.5)*0.42;
  const land=smoothstep(1.0,0.84,e);
  let h=16+fbm(x*0.0010,z*0.0010)*70+Math.pow(fbm(x*0.0024+7,z*0.0024+3),3)*190;
  const rx=Math.exp(-Math.pow((x-IW/2+(fbm(z*0.0009,3.3)-0.5)*700)/360,2));let gap=0;for(const g of GAPS)gap=Math.max(gap,Math.exp(-Math.pow((z-g)/180,2)));
  h+=rx*(230+fbm(x*0.004,z*0.004)*160)*(1-gap*0.93);
  /* rocky outcrops scattered over the island */
  const o=fbm(x*0.003+11,z*0.003+5);if(o>0.62)h+=(o-0.62)*700;
  h=h*land-(1-land)*60;
  for(const [bx,bz] of BASES){const d=Math.hypot(x-bx,z-bz);const w=smoothstep(420,240,d);h=h*(1-w)+22*w;}
  for(const [mx,mz] of MINES_AT){const d=Math.hypot(x-mx,z-mz);const w=smoothstep(220,110,d);h=h*(1-w)+Math.max(14,h*0.6)*w;}
  HM[j*NX+i]=h;}
 /* two light blur passes */
 for(let k=0;k<2;k++){const B=HM.slice();for(let j=1;j<NZ-1;j++)for(let i=1;i<NX-1;i++){const c=j*NX+i;HM[c]=(B[c]*4+B[c-1]+B[c+1]+B[c-NX]+B[c+NX])/8;}}}
function hgt(x,z){const fx=x/GS,fz=z/GS;if(fx<0||fz<0||fx>=NX-1||fz>=NZ-1)return -60;const i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j,c=j*NX+i;
 const a=HM[c],b=HM[c+1],d=HM[c+NX],e=HM[c+NX+1];return a+(b-a)*u+(d-a)*v+(a-b-d+e)*u*v;}
function slope(x,z){const e=12;return Math.hypot(hgt(x+e,z)-hgt(x-e,z),hgt(x,z+e)-hgt(x,z-e))/(2*e);}

/* ---------- navigation grid ---------- */
const NG=80,GX=Math.ceil(IW/NG),GZ=Math.ceil(IH/NG);const NAV=new Float32Array(GX*GZ),ROADC=new Uint8Array(GX*GZ);
function buildNav(){for(let j=0;j<GZ;j++)for(let i=0;i<GX;i++){const x=(i+0.5)*NG,z=(j+0.5)*NG,h=hgt(x,z),s=Math.max(slope(x,z),slope(x+25,z),slope(x,z+25),slope(x-25,z-25));
  NAV[j*GX+i]=h<4?0:s>1.1?0:1+s*12+(s>0.5?(s-0.5)*40:0)+(h>160?2:0);}}
class Heap{constructor(){this.a=[];}push(n,p){const a=this.a;a.push([p,n]);let i=a.length-1;while(i>0){const q=(i-1)>>1;if(a[q][0]<=a[i][0])break;[a[q],a[i]]=[a[i],a[q]];i=q;}}
 pop(){const a=this.a,t=a[0],l=a.pop();if(a.length){a[0]=l;let i=0;for(;;){const L=2*i+1,R_=L+1;let m=i;if(L<a.length&&a[L][0]<a[m][0])m=L;if(R_<a.length&&a[R_][0]<a[m][0])m=R_;if(m===i)break;[a[m],a[i]]=[a[i],a[m]];i=m;}}return t[1];}get size(){return this.a.length;}}
const cellOf=(x,z)=>[Math.max(0,Math.min(GX-1,Math.floor(x/NG))),Math.max(0,Math.min(GZ-1,Math.floor(z/NG)))];
function nearestPass(i,j){if(NAV[j*GX+i]>0)return[i,j];for(let r=1;r<12;r++)for(let dj=-r;dj<=r;dj++)for(let di=-r;di<=r;di++){const a=i+di,b=j+dj;if(a>=0&&b>=0&&a<GX&&b<GZ&&NAV[b*GX+a]>0)return[a,b];}return[i,j];}
function astar(x0,z0,x1,z1,seed,roadK){let [si,sj]=nearestPass(...cellOf(x0,z0)),[ti,tj]=nearestPass(...cellOf(x1,z1));const N=GX*GZ,g=new Float32Array(N).fill(1e9),from=new Int32Array(N).fill(-1),done=new Uint8Array(N);
 const s=sj*GX+si,t=tj*GX+ti;g[s]=0;const H=new Heap();H.push(s,0);const D=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
 while(H.size){const c=H.pop();if(done[c])continue;done[c]=1;if(c===t)break;const ci=c%GX,cj=(c-ci)/GX;
  for(const [di,dj,dl] of D){const ni=ci+di,nj=cj+dj;if(ni<0||nj<0||ni>=GX||nj>=GZ)continue;const n=nj*GX+ni;const w=NAV[n];if(!w||done[n])continue;
   let cost=w*(ROADC[n]?(roadK??0.55):1);if(seed)cost*=0.7+hash(ni*1.7+seed,nj*2.3-seed)*0.9;const ng=g[c]+cost*dl;if(ng<g[n]){g[n]=ng;from[n]=c;H.push(n,ng+Math.hypot(ni-ti,nj-tj)*0.9);}}}
 if(from[t]<0&&t!==s)return [[x0,z0],[x1,z1]];const out=[];for(let c=t;c>=0;c=from[c]){const ci=c%GX,cj=(c-ci)/GX;out.push([(ci+0.5)*NG,(cj+0.5)*NG]);if(c===s)break;}out.reverse();
 out[0]=[x0,z0];out[out.length-1]=[x1,z1];return out;}
function chaikin(pl,n){let p=pl;for(let k=0;k<n;k++){const o=[p[0]];for(let i=0;i<p.length-1;i++){const a=p[i],b=p[i+1];o.push([a[0]*0.75+b[0]*0.25,a[1]*0.75+b[1]*0.25],[a[0]*0.25+b[0]*0.75,a[1]*0.25+b[1]*0.75]);}o.push(p[p.length-1]);p=o;}return p;}

/* ---------- terrain look: dry grass, dirt, rock and sand blended by slope and height ---------- */
function texT(base,cols,fn){return canvasTex(512,512,(c,w,h)=>{c.fillStyle=base;c.fillRect(0,0,w,h);for(let i=0;i<60;i++){const x=rn()*w,y=rn()*h,r=20+rn()*90,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,cols[i%cols.length]+'99');g.addColorStop(1,cols[i%cols.length]+'00');c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);}if(fn)fn(c,w,h);},false,true);}
let TT=null;
function terrainTextures(){if(TT)return TT;TT={
 g:texT('#646446',['#6F6B4A','#55573C','#7A7450','#5B5F40'],(c,w,h)=>{for(let i=0;i<9000;i++){const x=rn()*w,y=rn()*h,l=2+rn()*5;c.strokeStyle=['#7E7854','#545638','#8A8058','#4A4C34'][i%4];c.globalAlpha=0.35+rn()*0.4;c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.lineTo(x+(rn()-0.5)*2.5,y-l);c.stroke();}c.globalAlpha=1;}),
 d:texT('#6E5C44',['#7A684E','#5E4E3A','#836E52'],(c,w,h)=>{for(let i=0;i<5000;i++){c.fillStyle=rn()<0.5?'rgba(40,30,20,0.25)':'rgba(200,180,150,0.18)';c.fillRect(rn()*w,rn()*h,1+rn()*3,1+rn()*2);}
  for(let i=0;i<120;i++){c.fillStyle='rgba(120,112,100,0.6)';c.beginPath();c.ellipse(rn()*w,rn()*h,1.5+rn()*3,1+rn()*2,rn()*3,0,7);c.fill();}}),
 r:texT('#77736B',['#85817A','#66625C','#8E8A82','#5A5752'],(c,w,h)=>{c.strokeStyle='rgba(30,28,26,0.45)';for(let i=0;i<40;i++){let x=rn()*w,y=rn()*h;c.lineWidth=1+rn()*1.5;c.beginPath();c.moveTo(x,y);for(let k=0;k<5;k++){x+=(rn()-0.5)*50;y+=rn()*30;c.lineTo(x,y);}c.stroke();}
  for(let i=0;i<3000;i++){c.fillStyle=rn()<0.5?'rgba(0,0,0,0.12)':'rgba(255,255,255,0.1)';c.fillRect(rn()*w,rn()*h,2,2);}}),
 s:texT('#A69676',['#B4A482','#958668','#BCAE8C'],(c,w,h)=>{for(let i=0;i<6000;i++){c.fillStyle=rn()<0.5?'rgba(80,70,50,0.18)':'rgba(255,250,230,0.2)';c.fillRect(rn()*w,rn()*h,1,1);}})};return TT;}
/* roads are painted into a mask over the whole island (red = road, green = wheel ruts) and blended in the terrain shader, so they lie exactly on the ground */
function roadMask(){const w=2048,h=1280,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,w,h);const k=w/IW;x.lineCap='round';x.lineJoin='round';
 const line=(pl,off)=>{x.beginPath();pl.forEach((p,i)=>{const a=pl[Math.max(0,i-1)],b=pl[Math.min(pl.length-1,i+1)];let dx=b[0]-a[0],dz=b[1]-a[1];const l=Math.hypot(dx,dz)||1;const X=(p[0]-dz/l*off)*k,Z=(p[1]+dx/l*off)*k;i?x.lineTo(X,Z):x.moveTo(X,Z);});x.stroke();};
 const P_=ROADS_I.map(pl=>resample(chaikin(pl,2),20));
 x.strokeStyle='rgba(255,0,0,0.45)';x.lineWidth=54*k;P_.forEach(pl=>line(pl,0));x.strokeStyle='rgb(255,0,0)';x.lineWidth=40*k;P_.forEach(pl=>line(pl,0));
 x.globalCompositeOperation='lighter';x.strokeStyle='rgba(0,200,0,0.9)';x.lineWidth=5*k;P_.forEach(pl=>{line(pl,9);line(pl,-9);});x.globalCompositeOperation='source-over';
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.anisotropy=4;return t;}
function terrainMaterial(){const T=terrainTextures();const m=new THREE.MeshStandardMaterial({roughness:0.97,metalness:0,vertexColors:true});const RM=roadMask();
 m.onBeforeCompile=sh=>{sh.uniforms.tG={value:T.g};sh.uniforms.tRoad={value:RM};sh.uniforms.tD={value:T.d};sh.uniforms.tR={value:T.r};sh.uniforms.tS={value:T.s};
  sh.vertexShader='attribute vec4 splat;varying vec4 vSp;varying vec3 vWP;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSp=splat;vWP=(modelMatrix*vec4(transformed,1.0)).xyz;');
  sh.fragmentShader='uniform sampler2D tRoad;uniform sampler2D tG;uniform sampler2D tD;uniform sampler2D tR;uniform sampler2D tS;varying vec4 vSp;varying vec3 vWP;\n'+sh.fragmentShader.replace('#include <map_fragment>',
  `vec2 u1=vWP.xz/90.0;vec2 u2=vWP.xz/420.0;
   vec3 cg=mix(texture2D(tG,u1).rgb,texture2D(tG,u2*0.7).rgb,0.45);vec3 cd=mix(texture2D(tD,u1).rgb,texture2D(tD,u2).rgb,0.4);
   vec3 cr=mix(texture2D(tR,u1*0.8).rgb,texture2D(tR,u2).rgb,0.4);vec3 cs=texture2D(tS,u1).rgb;
   vec4 w=vSp/max(vSp.x+vSp.y+vSp.z+vSp.w,0.001);vec3 col=cg*w.x+cd*w.y+cr*w.z+cs*w.w;vec2 rq=texture2D(tRoad,vWP.xz/vec2(8000.0,5000.0)).rg;vec3 rc=mix(cd*vec3(1.08,1.02,0.94),cd*0.55,rq.g);col=mix(col,rc,smoothstep(0.05,0.9,rq.r)*0.95);col=clamp(col,0.0,1.0);diffuseColor.rgb*=pow(col,vec3(2.2))*2.2;`);};
 return m;}
let ocean=null,ROADS_I=[];
function buildWorld(){if(world)scene.remove(world);BATT[0]=[];BATT[1]=[];world=new THREE.Group();scene.add(world);const T=THEME.isle;
 materials('isle');
 if(sky)scene.remove(sky);sky=mkSky('isle');sky.scale.setScalar(3);scene.add(sky);scene.environment=mkEnv('isle');
 scene.fog=new THREE.FogExp2(lin(T.fog),T3.lo?0.00034:0.00026);
 const EX=3600,W_=IW+2*EX,H_=IH+2*EX,sx=isMob?260:340,sz=Math.round(sx*H_/W_);
 const G=new THREE.PlaneGeometry(W_,H_,sx,sz);G.rotateX(-Math.PI/2);G.translate(IW/2,0,IH/2);const pos=G.attributes.position,sp=[],cols=[];
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),h=hgt(x,z);pos.setY(i,h);const s=slope(x,z),n=fbm(x*0.004,z*0.004);
  let wr=smoothstep(0.32,0.62,s)+smoothstep(150,260,h)*0.8,wsand=smoothstep(10,2,h),wd=smoothstep(0.55,0.75,fbm(x*0.0025+40,z*0.0025))*0.9+smoothstep(0.18,0.32,s)*0.5,wg=1;
  for(const [bx,bz] of BASES){const d=Math.hypot(x-bx,z-bz);wd+=smoothstep(330,200,d)*1.2;}for(const [mx,mz] of MINES_AT){const d=Math.hypot(x-mx,z-mz);wd+=smoothstep(200,90,d)*1.4;}
  wg=Math.max(0,1-wr-wsand-wd*0.6);sp.push(wg,wd,wr,wsand);const k=0.85+n*0.3;cols.push(k,k,k);}
 G.setAttribute('splat',new THREE.Float32BufferAttribute(sp,4));G.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));G.computeVertexNormals();
 const tm=new THREE.Mesh(G,terrainMaterial());tm.receiveShadow=true;world.add(tm);
 ocean=new THREE.Mesh(new THREE.PlaneGeometry(40000,40000),new THREE.MeshStandardMaterial({color:lin(0x2C4352),roughness:0.45,metalness:0.1,envMapIntensity:0.5,normalMap:TX.ripple,normalScale:new THREE.Vector2(0.5,0.5),transparent:true,opacity:0.94}));
 TX.ripple.repeat.set(160,160);ocean.rotation.x=-Math.PI/2;ocean.position.set(IW/2,WATER,IH/2);world.add(ocean);
 /* dirt roads between the bases and the mines */

 /* rocks scattered over the island */
 {const rp=[];for(let i=0;i<9000&&rp.length<(isMob?500:900);i++){const x=rn()*IW,z=rn()*IH,h=hgt(x,z);if(h<6)continue;if(nearBase(x,z,300)||nearMine(x,z,140))continue;rp.push([x,z,rn()]);}
  const geo=displace(new THREE.IcosahedronGeometry(1,2),0.5,1.4);const im=new THREE.InstancedMesh(geo,M3.rock,rp.length);im.castShadow=true;im.receiveShadow=true;const o=new THREE.Object3D();
  rp.forEach(([x,z,r],i)=>{const s=3+r*r*16;o.position.set(x,hgt(x,z)-s*0.25,z);o.scale.set(s*(1+r*0.5),s*(0.55+r*0.35),s);o.rotation.set(r*2,r*9,0);o.updateMatrix();im.setMatrixAt(i,o.matrix);const g=0.7+((r*7919)%1)*0.35;im.setColorAt(i,new THREE.Color(g,g*0.97,g*0.92));});
  im.instanceColor.needsUpdate=true;world.add(im);}
 /* landmarks instead of trees: abandoned outposts (sandbags, barrels, crates, tyres), lines of tank traps, watchtowers on hilltops */
 if(MIL){const kinds={bag:['Barrier_006',30],brl:['Barrel_005',5],box:['Box_003',9],box2:['Box_005',11],tyr:['Tires_001',6],hog:['Hedgehog_001',8],tow:['Tower_003',22],tent:['Tent_010',30],gen:['Generator_004',14]},pl={};for(const k in kinds)pl[k]=[];
  const put=(k,x,z,r)=>pl[k].push([x,z,r]);
  for(let n=0,i=0;i<6000&&n<(isMob?40:60);i++){const x=200+rn()*(IW-400),z=200+rn()*(IH-400),h=hgt(x,z);if(h<8||slope(x,z)>0.3||nearBase(x,z,500)||nearMine(x,z,180))continue;n++;const a=rn()*6.28,t=Math.floor(rn()*4);
   const at=(dx,dz)=>[x+Math.cos(a)*dx-Math.sin(a)*dz,z+Math.sin(a)*dx+Math.cos(a)*dz];
   if(t===0){put('bag',...at(0,0),a);for(let k=0;k<3;k++)put('brl',...at(-12+k*7,14+rn()*4),rn()*6);put('box',...at(18,16),a+0.3);put('tyr',...at(-22,-14),0);}
   else if(t===1){for(let k=0;k<5;k++)put('hog',...at(-40+k*20,(rn()-0.5)*6),rn()*6);}
   else if(t===2){put('tent',...at(0,0),a);put('gen',...at(26,18),a);put('box2',...at(-22,20),a);put('brl',...at(-26,28),0);}
   else{put('box2',...at(0,0),a);put('box',...at(12,4),a+0.2);put('box',...at(6,14),a-0.3);put('tyr',...at(-12,10),0);}}
  const tops=[];for(let i=0;i<8000&&tops.length<(isMob?10:14);i++){const x=300+rn()*(IW-600),z=300+rn()*(IH-600),h=hgt(x,z);if(h<90||h>170||slope(x,z)>0.25||nearBase(x,z,600))continue;if(tops.some(t=>Math.hypot(t[0]-x,t[1]-z)<700))continue;tops.push([x,z,rn()*6]);}
  for(const t of tops)put('tow',...t);
  const o=new THREE.Object3D();
  for(const k in kinds){const L_=pl[k];if(!L_.length)continue;const [name,len]=kinds[k];let baked;try{{const hold=new THREE.Group();hold.add(milProp(name,len,null));baked=bakeGroup(hold);}}catch(e){continue;}
   for(const {geo,mat} of baked){const im=new THREE.InstancedMesh(geo,mat,L_.length);im.castShadow=true;im.receiveShadow=true;L_.forEach(([x,z,r],i)=>{o.position.set(x,hgt(x,z)-0.5,z);o.rotation.set(0,r,0);o.scale.set(1,1,1);o.updateMatrix();im.setMatrixAt(i,o.matrix);});world.add(im);}}}
 /* bases, artillery batteries, mines */
 for(const s of [0,1]){const [bx,bz]=BASES[s];const hq=MIL?mkHQmil(s):mkHQ0(s);hq.position.set(bx,hgt(bx,bz),bz);hq.rotation.y=s===0?0:Math.PI;hq.scale.setScalar(1.6);world.add(hq);
  for(let k=-1;k<=1;k++){const g=mkGun(s);const gx=bx+(s===0?-150:150),gz=bz+k*70;g.position.set(gx,hgt(gx,gz),gz);g.rotation.y=s===0?0:Math.PI;world.add(g);BATT[s].push(g);}}
 for(const m of G_.mines){const o=mkMine();o.position.set(m.x,hgt(m.x,m.z),m.z);o.scale.setScalar(1.5);world.add(o);m.o=o;}
 /* clouds */
 for(let i=0;i<22;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.cloud,transparent:true,depthWrite:false,fog:true,opacity:0.75,color:0xD8DCDC}));const a=rn()*6.28,d=1500+rn()*3500;
  s.position.set(IW/2+Math.cos(a)*d,1700+rn()*700,IH/2+Math.sin(a)*d);s.scale.set(1600+rn()*1200,500+rn()*300,1);s.userData.v=6+rn()*8;s.userData.cloud=1;world.add(s);}
 world.traverse(o=>{if(o.material&&o.material.isMeshStandardMaterial&&o.material.envMapIntensity===1)o.material.envMapIntensity=0.45;});}
function mkHQ0(s){const g=new THREE.Group(),t=TEAM3(s);g.add(CYL(54,58,6,M3.conc,10,0,3,0),BOX(60,26,60,std(t.d,0.6,0.3),0,19,0),MESH(new THREE.SphereGeometry(22,20,10,0,Math.PI*2,0,Math.PI/2),std(0xB8C0C8,0.3,0.8),0,32,0));return addShadow(g,true,true);}
function mkGun(s){const g=new THREE.Group(),t=TEAM3(s),M=mats(s);g.add(CYL(10,12,3,M3.conc,10,0,1.5,0));const tu=new THREE.Group();tu.position.y=4;
 tu.add(BOX(12,6,10,M.dark,0,3,0));const b=CYL(1.6,2,30,M.gun,12,0,0,0);b.rotation.z=Math.PI/2-0.6;b.position.set(11,14,0);tu.add(b);g.add(tu);g.userData.tu=tu;g.userData.b=b;return addShadow(g,true,true);}
function mkMine(){const g=new THREE.Group();const hill=new THREE.Mesh(displace(new THREE.SphereGeometry(1,28,16,0,Math.PI*2,0,Math.PI/2),0.5,2.2),std(0x6A5A48,0.95,0));hill.scale.set(56,34,48);g.add(hill);
 const mouth=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),std(0x0E0C0A,1,0));mouth.scale.set(18,16,9);mouth.position.set(0,6,40);g.add(mouth);
 for(let i=0;i<12;i++){const c=new THREE.Mesh(new THREE.OctahedronGeometry(4+(i%3)*2,0),M3.crys);const a=i*0.55;c.position.set(Math.cos(a)*(32+i%2*9),12+(i%3)*8,Math.sin(a)*27);c.scale.y=2.2;c.rotation.set((i%3-1)*0.4,i,(i%2-0.5)*0.6);g.add(c);}
 g.add(BOX(30,2,8,M3.wood,0,1,50));return addShadow(g,true,true);}
/* the terrain mesh is coarser than the height grid: lift each road vertex to the highest ground around it */
const gmax=(x,z)=>Math.max(hgt(x,z),hgt(x+24,z),hgt(x-24,z),hgt(x,z+24),hgt(x,z-24),hgt(x+17,z+17),hgt(x-17,z-17),hgt(x+17,z-17),hgt(x-17,z+17));
function resample(pl,st){const o=[pl[0]];for(let i=1;i<pl.length;i++){const a=o[o.length-1],b=pl[i],d=Math.hypot(b[0]-a[0],b[1]-a[1]);const n=Math.floor(d/st);for(let k=1;k<=n;k++)o.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}return o;}
function roadStrip(pl,w){const n=pl.length;if(n<2)return null;const P_=[],U=[],I=[];let L=0;
 for(let i=0;i<n;i++){const a=pl[Math.max(0,i-1)],b=pl[Math.min(n-1,i+1)];let dx=b[0]-a[0],dz=b[1]-a[1];const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;if(i>0)L+=Math.hypot(pl[i][0]-pl[i-1][0],pl[i][1]-pl[i-1][1]);
  const nx=-dz,nz=dx,x=pl[i][0],z=pl[i][1];for(const sd of [1,-1]){const px=x+nx*w/2*sd,pz=z+nz*w/2*sd;P_.push(px,Math.max(0.5,gmax(px,pz))+1.4,pz);}U.push(0,L/w,1,L/w);
  if(i>0){const k=(i-1)*2;I.push(k,k+1,k+2,k+1,k+3,k+2);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P_,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setIndex(I);g.computeVertexNormals();const o=new THREE.Mesh(g,M3.road);o.receiveShadow=true;return o;}
const nearBase=(x,z,r)=>BASES.some(([bx,bz])=>Math.hypot(x-bx,z-bz)<r);
const nearMine=(x,z,r)=>MINES_AT.some(([mx,mz])=>Math.hypot(x-mx,z-mz)<r);
function nearRoad(x,z,r){for(const pl of ROADS_I)for(let i=0;i<pl.length-1;i+=1){if(segDist2(x,z,pl[i],pl[i+1])<r)return true;}return false;}
function segDist2(px,pz,a,b){const dx=b[0]-a[0],dz=b[1]-a[1];const l2=dx*dx+dz*dz||1;let k=((px-a[0])*dx+(pz-a[1])*dz)/l2;k=Math.max(0,Math.min(1,k));return Math.hypot(px-a[0]-dx*k,pz-a[1]-dz*k);}
function planRoads(){ROADS_I=[];const add=pl=>{ROADS_I.push(pl);for(const [x,z] of pl){const [i,j]=cellOf(x,z);ROADC[j*GX+i]=1;}};
 for(const g of GAPS){const a=astar(BASES[0][0]+200,BASES[0][1],IW/2,g,0,1),b=astar(IW/2,g,BASES[1][0]-200,BASES[1][1],0,1);add([...a,...b.slice(1)]);}
 for(const [mx,mz] of MINES_AT){const s=mx<IW/2?0:1;const [bx,bz]=BASES[s];add(astar(bx+(s?-150:150),bz,mx,mz+60,0,0.8));}}

/* ================== game state ================== */
let G_=null;const BATT=[[],[]];
function newGame(){G_={t:0,over:null,id:1,sides:[mkSide(),mkSide()],units:[],towers:[],harv:[],mines:MINES_AT.map(([x,z])=>({x,z,ore:16000,max:16000})),marks:new Set()};
 for(const s of [0,1]){const [bx,bz]=BASES[s],d=s===0?1:-1;
  for(const [k,ox,oz] of [['mg',260,-120],['can',300,60],['rkt',220,170],['mg',330,220]])addTower(s,k,bx+d*ox,bz+oz);
  for(let i=0;i<2;i++)addHarv(s);}
 P.dead=0;spawnTitan();}
function mkSide(){return{ore:START_ORE,lives:LIVES,queue:[],qcd:0,grp:null,grpT:-99,botT:0,wave:600,twT:20};}
function addTower(s,k,x,z){const t={id:G_.id++,s,k,lv:1,x,z,hp:TWS[k].hp,mx:TWS[k].hp,cd:0.5,a:s===0?0:Math.PI};G_.towers.push(t);return t;}
function addHarv(s){const [bx,bz]=BASES[s];const h={id:G_.id++,s,x:bx+(s?-80:80),z:bz+(G_.harv.length%3-1)*40,hp:HARV.hp,mx:HARV.hp,st:'idle',load:0,t:0,path:null,pi:0,m:null,a:0};G_.harv.push(h);return h;}
function sendUnit(s,k){const S=G_.sides[s],c=US[k].cost;if(S.ore<c)return false;S.ore-=c;S.queue.push(k);return true;}
function buyHarv(s){const S=G_.sides[s];if(S.ore<HARV.cost||G_.harv.filter(h=>h.s===s).length>=6)return false;S.ore-=HARV.cost;addHarv(s);return true;}
/* each burst of units takes its own way: a random point on our side, one of the passes (or a random crossing), a random point on theirs */
function groupPath(s,air){const [bx,bz]=BASES[s],[ex,ez]=BASES[1-s],d=s===0?1:-1;const st=[bx+d*170,bz+(rn()-0.5)*160];
 if(air){const mid=[IW/2+(rn()-0.5)*1200,IH*0.15+rn()*IH*0.7];return chaikin([st,mid,[ex-d*60,ez]],3);}
 const g=GAPS[Math.floor(rn()*GAPS.length)],v2=[IW/2,g+(rn()-0.5)*160],mid=(a,b,k,j)=>[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k+(rn()-0.5)*j];
 const v1=mid(st,v2,0.45+rn()*0.2,900),v3=mid(v2,[ex,ez],0.4+rn()*0.2,900);
 const seed=1+rn()*900,pts=[st,v1,v2,v3,[ex-d*90,ez]];let path=[];for(let i=0;i<pts.length-1;i++){const p=astar(pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],seed);path=path.concat(i?p.slice(1):p);}
 return chaikin(path,2);}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function enemiesOf(s){return G_.units.filter(u=>u.s!==s&&!u.dead);}
function dmgUnit(u,d,by){if(u.dead)return;u.hp-=d;if(u.hp<=0){u.dead=true;const st=US[u.k];if(by!=null)G_.sides[by].ore+=st.rw*2;explode(u.x,u.y,u.z,u.k==='inf'?0.5:u.k==='tank'?1.3:1);}}
function dmgTower(t,d,by){t.hp-=d;if(t.hp<=0&&!t.dead){t.dead=true;explode(t.x,hgt(t.x,t.z)+8,t.z,1.8);if(by!=null)G_.sides[by].ore+=TWS[t.k].cost*0.25;}}
function dmgHarv(h,d,by){h.hp-=d;if(h.hp<=0&&!h.dead){h.dead=true;explode(h.x,hgt(h.x,h.z)+5,h.z,1.4);if(by!=null)G_.sides[by].ore+=500+(h.load?300:0);}}
function hitBase(s,n){const S=G_.sides[s];S.lives=Math.max(0,S.lives-n);const [bx,bz]=BASES[s];explode(bx+(rn()-0.5)*60,hgt(bx,bz)+20,bz+(rn()-0.5)*60,1.4);if(S.lives<=0&&!G_.over)G_.over={w:1-s};}
function tracer(a,b,c){tracers.push({id:++SID,a,b,t:0.06,c:c||0xFFE070});}
/* the nearest enemy something can shoot at */
function pickTarget(s,x,z,rng,hitAir,hitGround){let best=null,bd=rng;
 for(const u of G_.units){if(u.dead||u.s===s)continue;const air=US[u.k].air;if(air?!hitAir:!hitGround)continue;const d=Math.hypot(u.x-x,u.z-z);if(d<bd){bd=d;best={k:'u',o:u};}}
 if(hitGround){for(const t of G_.towers){if(t.dead||t.s===s)continue;const d=Math.hypot(t.x-x,t.z-z)-10;if(d<bd){bd=d;best={k:'t',o:t};}}
  for(const h of G_.harv){if(h.dead||h.s===s)continue;const d=Math.hypot(h.x-x,h.z-z);if(d<bd){bd=d;best={k:'h',o:h};}}
  if(s===1&&P.dead<=0){const d=Math.hypot(P.x-x,P.z-z)-14;if(d<bd){bd=d;best={k:'p'};}}}
 return best;}
const tpos=tg=>tg.k==='p'?[P.x,hgt(P.x,P.z)+14,P.z]:tg.k==='u'?[tg.o.x,tg.o.y+6,tg.o.z]:tg.k==='t'?[tg.o.x,hgt(tg.o.x,tg.o.z)+14,tg.o.z]:[tg.o.x,hgt(tg.o.x,tg.o.z)+7,tg.o.z];
function applyHit(tg,d,by){if(tg.k==='u')dmgUnit(tg.o,d,by);else if(tg.k==='t')dmgTower(tg.o,d,by);else if(tg.k==='h')dmgHarv(tg.o,d,by);else if(tg.k==='p'){P.hp-=d;P.hurt=0.25;}}
function splash(s,x,z,r,d,by){for(const u of G_.units){if(u.dead||u.s===s||US[u.k].air)continue;const k=Math.hypot(u.x-x,u.z-z);if(k<r)dmgUnit(u,d*(k<r*0.5?1:0.6),by);}
 for(const h of G_.harv){if(!h.dead&&h.s!==s&&Math.hypot(h.x-x,h.z-z)<r)dmgHarv(h,d,by);}}

function stepGame(dt){if(G_.over)return;G_.t+=dt;
 for(const s of [0,1]){const S=G_.sides[s];S.ore+=BASE_INC*dt;
  S.qcd-=dt;if(S.queue.length&&S.qcd<=0){const k=S.queue.shift();const air=US[k].air;if(!S.grp||G_.t-S.grpT>5||S.grpAir!==air){S.grp=groupPath(s,air);S.grpAir=air;S.grpN=0;}S.grpT=G_.t;S.grpN++;
   const [bx,bz]=BASES[s];const st=US[k];const u={id:G_.id++,s,k,x:S.grp[0][0],z:S.grp[0][1],y:0,hp:st.hp,mx:st.hp,path:S.grp,pi:1,cd:rn(),off:((S.grpN%5)-2)*14,tg:null,scan:rn()*0.3,a:s===0?0:Math.PI};
   u.y=st.air?hgt(u.x,u.z)+ALT[k]:hgt(u.x,u.z);G_.units.push(u);S.qcd=0.55;}}
 /* units: shoot what is in range, otherwise keep going */
 for(const u of G_.units){if(u.dead)continue;const st=US[u.k];u.cd-=dt;u.scan-=dt;
  if(u.scan<=0){u.scan=0.3;u.tg=pickTarget(u.s,u.x,u.z,st.rng,st.hitAir,!st.air||true);}
  const [ex,ez]=BASES[1-u.s];
  if(Math.hypot(u.x-ex,u.z-ez)<150){u.dead=true;u.breach=true;hitBase(1-u.s,st.lives);continue;}
  let tg=u.tg;if(tg&&((tg.o&&tg.o.dead)||(tg.k==='p'&&P.dead>0)))tg=u.tg=null;
  if(tg){const [tx,ty,tz]=tpos(tg);u.ga=Math.atan2(tz-u.z,tx-u.x);if(u.cd<=0){u.cd=st.cd;if(st.splash){splash(u.s,tx,tz,st.splash,st.dmg,u.s);if(tg.k!=='u'&&tg.k!=='h')applyHit(tg,st.dmg,u.s);explode(tx,ty-4,tz,0.45);}else applyHit(tg,st.dmg*(tg.k==='p'?0.4:1),u.s);
    if(Math.hypot(u.x-cam.position.x,u.z-cam.position.z)<1400)tracer([u.x,u.y+8,u.z],[tx,ty,tz],u.s===0?0x9FD0FF:0xFFC070);}
   if(!st.air)continue;}
  /* follow the path */
  const p=u.path,t=p[Math.min(u.pi,p.length-1)];const dx=t[0]-u.x,dz=t[1]-u.z,d=Math.hypot(dx,dz);if(d<20&&u.pi<p.length-1){u.pi++;continue;}
  const sl=st.air?0:slope(u.x,u.z),v=st.sp*USPK*(tg&&st.air?0.35:1)*(1-Math.min(0.6,sl*0.8))*dt;const a=Math.atan2(dz,dx);
  const ox=-Math.sin(a)*u.off*0.02,oz=Math.cos(a)*u.off*0.02;u.x+=Math.cos(a)*v+ox*v;u.z+=Math.sin(a)*v+oz*v;u.a=a;
  const gy=hgt(u.x,u.z);u.y=st.air?u.y+(Math.max(gy,0)+ALT[u.k]-u.y)*Math.min(1,dt*1.5):gy;}
 G_.units=G_.units.filter(u=>!u.dead||(u.t_=(u.t_||0)+dt)<0.05);
 /* towers */
 for(const t of G_.towers){if(t.dead)continue;const st=TWS[t.k];t.cd-=dt;if(t.cd>0)continue;const tg=pickTarget(t.s,t.x,t.z,st.rng,st.air,st.ground);if(!tg)continue;
  const [tx,ty,tz]=tpos(tg);t.a=Math.atan2(tz-t.z,tx-t.x);t.cd=st.cd;if(st.splash)splash(t.s,tx,tz,st.splash,st.dmg,t.s);if(!st.splash||tg.k!=='u')applyHit(tg,st.dmg*(tg.k==='p'?0.5:1),t.s);
  if(Math.hypot(t.x-cam.position.x,t.z-cam.position.z)<1600){tracer([t.x,hgt(t.x,t.z)+18,t.z],[tx,ty,tz],t.k==='rkt'?0xFF9050:t.s===0?0x9FD0FF:0xFFC070);if(t.k!=='mg')explode(tx,ty-4,tz,0.5);}}
 G_.towers=G_.towers.filter(t=>!t.dead);
 /* harvesters share the mines */
 for(const h of G_.harv){if(h.dead)continue;const [bx,bz]=BASES[h.s];
  if(h.st==='idle'){let best=null,bd=1e9;for(const m of G_.mines){if(m.ore<=0)continue;const d=Math.hypot(m.x-bx,m.z-bz)*(0.8+hash(h.id,m.x)*0.5);if(d<bd){bd=d;best=m;}}
   if(best){h.m=best;h.path=chaikin(astar(h.x,h.z,best.x,best.z+60,0,0.5),2);h.pi=1;h.st='go';}}
  else if(h.st==='go'||h.st==='back'){const t=h.path[Math.min(h.pi,h.path.length-1)];const dx=t[0]-h.x,dz=t[1]-h.z,d=Math.hypot(dx,dz);
   if(d<16){if(h.pi<h.path.length-1)h.pi++;else if(h.st==='go'){h.st='mine';h.t=HARV.mine;}else{G_.sides[h.s].ore+=h.load;h.load=0;h.st='idle';}}
   else{const v=HARV.sp*SPK*(1-Math.min(0.5,slope(h.x,h.z)*0.7))*dt;h.a=Math.atan2(dz,dx);h.x+=Math.cos(h.a)*v;h.z+=Math.sin(h.a)*v;}}
  else if(h.st==='mine'){h.t-=dt;if(h.t<=0){const take=Math.min(HARV.load,h.m.ore);h.m.ore-=take;h.load=take;h.st='back';h.path=chaikin(astar(h.x,h.z,bx+(h.s?-80:80),bz,0,0.5),2);h.pi=1;}}}
 G_.harv=G_.harv.filter(h=>!h.dead);
 bot(1,dt);}

/* ---------- the bot: harvesters first, waves of mixed units, towers on its side ---------- */
function bot(s,dt){const S=G_.sides[s];S.botT-=dt;if(S.botT>0)return;S.botT=1.2;
 const nh=G_.harv.filter(h=>h.s===s).length;if(nh<3&&S.ore>=HARV.cost+100){buyHarv(s);return;}
 S.twT-=1.2;if(S.twT<=0&&S.ore>900){S.twT=30;const [bx,bz]=BASES[s],d=s===0?1:-1;const k=['mg','can','rkt','tes'][Math.floor(rn()*4)];
  for(let i=0;i<30;i++){const x=bx+d*(250+rn()*900),z=bz+(rn()-0.5)*1600;if(hgt(x,z)<8||slope(x,z)>0.3)continue;if(G_.towers.some(t=>Math.hypot(t.x-x,t.z-z)<120))continue;S.ore-=TWS[k].cost;addTower(s,k,x,z);break;}}
 if(S.ore>=S.wave){const mix=['inf','inf','jeep','tank','heli','jeep','tank'];let n=0;while(n<12){const k=mix[Math.floor(rn()*mix.length)];if(!sendUnit(s,k))break;n++;}S.wave=500+rn()*900;}}

/* ================== drawing the game state ================== */
const live=new Map();let FR=0;
function sync(key,make,place){let e=live.get(key);if(!e){e={o:make()};dyn.add(e.o);live.set(key,e);}e.seen=FR;place(e.o,e);return e.o;}
function syncAll(t,dt){FR++;const cx=cam.position.x,cz=cam.position.z,far=2600;
 for(const u of G_.units){if(u.dead)continue;if(Math.abs(u.x-cx)+Math.abs(u.z-cz)>far*1.3)continue;
  sync('u'+u.id,()=>instantiate(proto('U'+u.k+u.s+(MIL?'m':''),()=>buildUnit(u.k,u.s))),(o,e)=>{if(o.userData.a==null)o.userData.a=u.a;let d=u.a-o.userData.a;d=Math.atan2(Math.sin(d),Math.cos(d));o.userData.a+=d*Math.min(1,dt*6);
   o.position.set(u.x,u.y,u.z);o.rotation.y=-o.userData.a;if(o.userData.rot)o.userData.rot.rotation.y=t*28;if(o.userData.rot2)o.userData.rot2.rotation.z=t*40;if(o.userData.tur&&u.ga!=null)o.userData.tur.rotation.y=-(u.ga-o.userData.a);
   if(!US[u.k].air&&u.k!=='inf'&&!u.tg){e.dust=(e.dust||0)-dt;if(e.dust<=0){e.dust=0.3;puff(u.x-Math.cos(u.a)*14,u.y+1.5,u.z-Math.sin(u.a)*14,'dust');}}});}
 for(const h of G_.harv){if(Math.abs(h.x-cx)+Math.abs(h.z-cz)>far*1.3)continue;sync('h'+h.id,()=>instantiate(proto('H'+h.s,()=>buildHarv(h.s))),o=>{o.position.set(h.x,hgt(h.x,h.z)+0.4,h.z);if(o.userData.a==null)o.userData.a=h.a;let d=h.a-o.userData.a;d=Math.atan2(Math.sin(d),Math.cos(d));o.userData.a+=d*Math.min(1,dt*5);o.rotation.y=-o.userData.a;});}
 for(const tw of G_.towers){if(Math.abs(tw.x-cx)+Math.abs(tw.z-cz)>far*1.5)continue;sync('t'+tw.id,()=>{const g=instantiate(proto('T'+tw.k+tw.s+(MIL?'m':''),()=>buildTower(tw.k,tw.s,1)));g.scale.setScalar(1.3);return g;},o=>{o.position.set(tw.x,hgt(tw.x,tw.z),tw.z);const tu=o.userData.tur;if(tu)tu.rotation.y=tw.k==='tes'?t*1.6:-tw.a;});}
 for(const s of shells)sync('s'+s.id,()=>{const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.glow,color:0xFFE2A0,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));sp.scale.set(7,7,1);return sp;},o=>o.position.set(s.x,s.y,s.z));
 for(const tr of tracers)sync('T'+tr.id,()=>{const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);return new THREE.Line(g,new THREE.LineBasicMaterial({color:tr.c,transparent:true,opacity:0.9,blending:THREE.AdditiveBlending}));},o=>{const a=o.geometry.attributes.position;a.setXYZ(0,...tr.a);a.setXYZ(1,...tr.b);a.needsUpdate=true;a.needsUpdate=true;o.geometry.computeBoundingSphere();});
 for(const [k,e] of live)if(e.seen!==FR){dyn.remove(e.o);if(e.o.isSprite||e.o.isLine){e.o.material.dispose();if(e.o.isLine)e.o.geometry.dispose();}live.delete(k);}
 for(const m of G_.mines){if(m.o){const k=Math.max(0.25,m.ore/m.max);m.o.children.forEach((c,i)=>{if(i>=2&&i<14)c.visible=i-2<Math.ceil(12*m.ore/m.max);});}}}

/* ================== the player's Titan: drives, shoots by itself when a target sits in the sight ================== */
const shells=[],tracers=[];let SID=0;
const cockScene=new THREE.Scene(),cockRoot=new THREE.Group();cockScene.add(cockRoot,new THREE.HemisphereLight(0xD8E4F0,0x4A5038,0.7));{const l=new THREE.DirectionalLight(0xFFEBC8,1.5);l.position.set(-0.5,0.8,0.4);cockScene.add(l);}
const cock=new THREE.Group();cockRoot.add(cock);const barrel=new THREE.Group();cock.add(barrel);
{const b=CYL(1.9,2.4,44,std(0x2C3036,0.4,0.7),24,0,0,0);b.rotation.x=Math.PI/2;b.position.set(0,-7.5,-28);barrel.add(b);
 const fe=CYL(2.8,2.8,7,std(0x2C3036,0.4,0.7),24,0,0,0);fe.rotation.x=Math.PI/2;fe.position.set(0,-7.5,-34);barrel.add(fe);
 const mz=CYL(3.4,3.4,6,std(0x1C2024,0.5,0.6),24,0,0,0);mz.rotation.x=Math.PI/2;mz.position.set(0,-7.5,-50);barrel.add(mz);
 const sl=CYL(3,3.2,9,std(0x3A4048,0.5,0.6),24,0,0,0);sl.rotation.x=Math.PI/2;sl.position.set(0,-7.5,-10);barrel.add(sl);}
function spawnTitan(){const [bx,bz]=BASES[0];P.x=bx+240;P.z=bz+10;P.yaw=0;P.pitch=-0.05;P.hp=P.max;P.move=false;P.dead=0;P.cd=0;}
function titanBlocked(x,z){if(hgt(x,z)<3)return true;for(const t of G_.towers)if(Math.hypot(t.x-x,t.z-z)<30)return true;for(const [bx,bz] of BASES)if(Math.hypot(bx-x,bz-z)<110)return true;for(const m of G_.mines)if(Math.hypot(m.x-x,m.z-z)<80)return true;return false;}
let LOCK=null;
function stepTitan(dt){if(P.dead>0){P.dead-=dt;if(P.dead<=0)spawnTitan();return;}
 P.cd=Math.max(0,P.cd-dt);P.scd=Math.max(0,P.scd-dt);P.rec=Math.max(0,P.rec-dt*4);P.shake=Math.max(0,P.shake-dt*2);P.hurt=Math.max(0,(P.hurt||0)-dt);
 if(P.move){const sl=slope(P.x,P.z),v=TITAN.sp*(1-Math.min(0.5,sl*0.6))*dt,nx=P.x+Math.cos(P.yaw)*v,nz=P.z+Math.sin(P.yaw)*v;if(!titanBlocked(nx,nz)){P.x=nx;P.z=nz;}else if(!titanBlocked(nx,P.z))P.x=nx;else if(!titanBlocked(P.x,nz))P.z=nz;P.bob+=dt*7;}
 P.x=Math.max(50,Math.min(IW-50,P.x));P.z=Math.max(50,Math.min(IH-50,P.z));
 /* automatic fire: the first enemy close to the centre of the sight */
 const o=new THREE.Vector3(P.x,Math.max(hgt(P.x,P.z),0)+26,P.z),d=new THREE.Vector3(Math.cos(P.yaw)*Math.cos(P.pitch),Math.sin(P.pitch),Math.sin(P.yaw)*Math.cos(P.pitch));const cone=TITAN.cone/P.zoom;LOCK=null;let best=cone;
 const test=(x,y,z,tg)=>{const vx=x-o.x,vy=y-o.y,vz=z-o.z,L=Math.hypot(vx,vy,vz);if(L>TITAN.range||L<20)return;const a=Math.acos(Math.max(-1,Math.min(1,(vx*d.x+vy*d.y+vz*d.z)/L)))-Math.atan(12/L);if(a<best){best=a;LOCK={tg,x,y,z};}};
 for(const u of G_.units){if(u.dead||u.s===0||US[u.k].air)continue;test(u.x,u.y+6,u.z,{k:'u',o:u});}
 for(const t of G_.towers){if(t.s===0)continue;test(t.x,hgt(t.x,t.z)+12,t.z,{k:'t',o:t});}
 for(const h of G_.harv){if(h.s===0)continue;test(h.x,hgt(h.x,h.z)+7,h.z,{k:'h',o:h});}
 if(G_.sides[1].lives>0){const [bx,bz]=BASES[1];test(bx,hgt(bx,bz)+20,bz,{k:'b'});}
 if(G_.over)LOCK=null;
 if(LOCK&&P.cd<=0){P.cd=TITAN.cd;shoot(LOCK.x,LOCK.y,LOCK.z,LOCK.tg);}
 if(P.hp<=0){P.hp=0;P.dead=TITAN.respawn;P.move=false;G_.sides[1].ore+=TITAN.bounty;explode(P.x,hgt(P.x,P.z),P.z,2.6);HUD.msg('Титан уничтожен — возрождение через 5 с');}}
/* the painted cockpit: twin barrels at the bottom of the screen; shells leave from the tip of the barrel whose turn it is */
let GUN=0;const TIPS=[[0.347,0.03],[0.652,0.03]];
function muzzle(){const el=document.getElementById('tiGun');if(!el||!el.offsetWidth){const st=new THREE.Vector3(0,-7.5,-53);barrel.localToWorld(st);return st;}
 const r=el.getBoundingClientRect(),[fx,fy]=TIPS[GUN],sx=r.left+r.width*fx,sy=r.top+r.height*fy;const v=new THREE.Vector3(sx/innerWidth*2-1,-(sy/innerHeight*2-1),0.5).unproject(cam).sub(cam.position).normalize();
 const o=new THREE.Vector3(P.x,Math.max(hgt(P.x,P.z),0)+26,P.z);if(cam.position.distanceTo(o)>5)return o;return cam.position.clone().addScaledVector(v,14);}
function gunFlash(){const f=document.getElementById('tiFl'+GUN);if(f){f.style.opacity='1';setTimeout(()=>f.style.opacity='0',70);}const el=document.getElementById('tiGun');if(el){el.style.transform='translateY(7px)';setTimeout(()=>el.style.transform='',110);}GUN=1-GUN;}
function shoot(x,y,z,tg,sup){const st=muzzle();const L=Math.hypot(x-st.x,y-st.y,z-st.z);shells.push({id:++SID,x:st.x,y:st.y,z:st.z,sx:st.x,sy:st.y,sz:st.z,tx:x,ty:y,tz:z,t:0,T:Math.max(0.05,L/TITAN.v),tg,sup});
 if(!sup){gunFlash();puff(st.x,st.y,st.z,'muzzle');P.rec=1;flash.position.copy(st);flash.intensity=Math.max(flash.intensity,2);HUD.kick();}}
/* super shot: a fan of shells around where the sight meets the ground */
function superShot(){if(P.dead>0||P.scd>0)return;P.scd=TITAN.superCd;cam.updateMatrixWorld();const o=new THREE.Vector3(),d=new THREE.Vector3();cam.getWorldPosition(o);cam.getWorldDirection(d);
 let hit=null;for(let s=10;s<1200;s+=8){const p=o.clone().addScaledVector(d,s);if(p.y<=hgt(p.x,p.z)){hit=p;break;}}if(!hit)hit=o.clone().addScaledVector(d,700);
 for(let i=0;i<TITAN.superN;i++){const a=i/TITAN.superN*6.28,r=i?40+rn()*30:0,x=hit.x+Math.cos(a)*r,z=hit.z+Math.sin(a)*r;setTimeout(()=>shoot(x,hgt(x,z),z,null,true),i*90);}
 puff(muzzle().x,muzzle().y,muzzle().z,'muzzle');P.rec=1;HUD.kick();HUD.msg('Залп!');}
function impact(s){explode(s.tx,s.ty,s.tz,s.sup?1.4:1.1);const by=0;
 if(!G_.over&&(s.tg&&s.tg.k==='b'||Math.hypot(s.tx-BASES[1][0],s.tz-BASES[1][1])<90)){if(!s.sup||rn()<0.35)hitBase(1,1);}
 splash(0,s.tx,s.tz,TITAN.r,TITAN.dmg,by);
 for(const t of G_.towers){if(t.s===0)continue;if(Math.hypot(t.x-s.tx,t.z-s.tz)<TITAN.r)dmgTower(t,TITAN.dmg*1.6,by);}}
function stepShells(dt){for(let i=shells.length-1;i>=0;i--){const s=shells[i];s.t+=dt;const k=Math.min(1,s.t/s.T);s.x=s.sx+(s.tx-s.sx)*k;s.z=s.sz+(s.tz-s.sz)*k;s.y=s.sy+(s.ty-s.sy)*k+Math.sin(Math.PI*k)*Math.min(30,s.T*30);if(k>=1){shells.splice(i,1);impact(s);}}
 for(let i=tracers.length-1;i>=0;i--){tracers[i].t-=dt;if(tracers[i].t<=0)tracers.splice(i,1);}}

/* ================== HUD, lobby, tactical map ================== */
const css=document.createElement('style');css.textContent=`
html,body{margin:0;height:100%;background:#000;overflow:hidden;font-family:'Rubik',system-ui,sans-serif}
#h3{position:fixed;inset:0;z-index:21;pointer-events:none;font:800 14px 'Rubik',system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px #000}
#h3 .b{pointer-events:auto;position:absolute;border:1.5px solid rgba(255,255,255,.25);border-radius:14px;background:rgba(12,18,14,.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);color:#fff;font:800 14px 'Rubik',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;user-select:none;-webkit-user-select:none;touch-action:none}
#h3 .b:active{transform:translateY(2px)}
#h3 .sup{right:max(20px,env(safe-area-inset-right));bottom:24px;width:92px;height:92px;border-radius:50%;background:radial-gradient(circle at 50% 40%,rgba(230,160,40,.9),rgba(150,80,10,.85));border-color:rgba(255,220,160,.5);font-size:14px;flex-direction:column}
#h3 .sup.cd{filter:grayscale(1) brightness(.7)}
#h3 .go{left:max(20px,env(safe-area-inset-left));bottom:24px;width:104px;height:62px;font-size:16px}
#h3 .go.on{background:rgba(60,150,70,.75)}
#h3 .map{right:max(14px,env(safe-area-inset-right));top:12px;padding:0 14px;height:40px}
#h3 .units{position:absolute;top:12px;left:50%;transform:translateX(-50%);display:flex;gap:6px}
#h3 .units .b{position:static;width:60px;height:40px;font-size:12px;flex-direction:column;line-height:1.1}
#h3 .units .b.dis{opacity:.45}
#h3 .stat{position:absolute;left:max(14px,env(safe-area-inset-left));top:10px;background:rgba(12,18,14,.5);border-radius:12px;padding:6px 12px;line-height:1.35}
#tiCock{position:absolute;inset:0;pointer-events:none;overflow:hidden}
#tiFrame{position:absolute;left:0;top:0;width:100%;height:auto;max-height:46vh;object-fit:fill}
#tiGun{position:absolute;left:0;width:100%;height:auto;bottom:calc(min(0px, 40vh - 37.47vw));transition:transform .1s}
#tiCock .fl{position:absolute;width:13vh;height:13vh;margin:-6.5vh 0 0 -6.5vh;border-radius:50%;background:radial-gradient(circle,rgba(255,240,190,1) 0,rgba(255,170,60,.85) 30%,rgba(255,120,20,0) 70%);opacity:0;transition:opacity .05s}
#h3 img.sight{position:absolute;left:50%;top:50%;height:46vh;transform:translate(-50%,-50%);opacity:.92;transition:filter .15s}
#h3 img.sight.lock{filter:hue-rotate(-115deg) saturate(1.6)}
#h3 svg.xh{position:absolute;left:50%;top:50%;width:150px;height:150px;margin:-75px 0 0 -75px;overflow:visible}
#h3 .hp{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);width:min(300px,38vw);height:10px;border-radius:6px;background:rgba(0,0,0,.45);overflow:hidden;border:1px solid rgba(255,255,255,.3)}
#h3 .hp i{display:block;height:100%;background:linear-gradient(90deg,#5FD068,#A8F07A)}
#h3 .rl{position:absolute;left:50%;bottom:34px;transform:translateX(-50%);font-size:12px;opacity:.9;letter-spacing:.5px}
#h3 .fps{position:absolute;right:max(14px,env(safe-area-inset-right));top:58px;font-size:12px;opacity:.85;background:rgba(12,18,14,.5);border-radius:8px;padding:2px 8px}
#h3 .msg{position:absolute;left:50%;top:28%;transform:translateX(-50%);background:rgba(12,18,14,.7);border-radius:12px;padding:8px 16px;font-size:16px;display:none}
#h3 .frame{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 46%,transparent 62%,rgba(5,8,6,.5) 100%)}
#h3 .hurt{position:absolute;inset:0;transition:box-shadow .15s}
#h3 .mini{position:absolute;left:max(14px,env(safe-area-inset-left));bottom:100px;width:150px;height:94px;border-radius:10px;border:1.5px solid rgba(255,255,255,.3);pointer-events:auto}
#tmap{position:fixed;inset:0;z-index:25;display:none;background:#1B2226;touch-action:none}
#tmap canvas{position:absolute;inset:0;width:100%;height:100%}
#tmap .x{position:absolute;right:14px;top:12px;border:2px solid #0C120B;border-radius:12px;background:linear-gradient(#F2C232,#C99A1A);color:#1C2416;font:900 14px 'Rubik',system-ui,sans-serif;padding:9px 16px}
#lobby[hidden]{display:none}
#lobby{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 40%,rgba(40,48,40,.55),rgba(8,10,8,.85))}
#lobby .card{background:rgba(20,26,20,.92);border:2px solid #0C120B;border-radius:18px;padding:22px 26px;color:#fff;text-align:center;max-width:420px}
#lobby h1{margin:0 0 6px;font-size:28px}#lobby p{margin:6px 0 16px;opacity:.85;font-size:14px;line-height:1.4}
#lobby button{border:2px solid #0C120B;border-radius:12px;background:linear-gradient(#F2C232,#C99A1A);color:#1C2416;font:900 18px 'Rubik',system-ui,sans-serif;padding:12px 28px;margin:4px}
#lobby a{display:block;margin-top:12px;color:#BFD8FF;font-size:13px}
#over{position:fixed;inset:0;z-index:45;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);color:#fff;font:900 30px 'Rubik',system-ui,sans-serif;flex-direction:column;gap:14px}
#over button{border:2px solid #0C120B;border-radius:12px;background:linear-gradient(#F2C232,#C99A1A);color:#1C2416;font:900 18px 'Rubik',system-ui,sans-serif;padding:12px 28px}`;
document.head.appendChild(css);
const H=document.createElement('div');H.id='h3';H.style.display='none';H.innerHTML=`<div class="frame"></div><div class="hurt"></div>
<div id="tiCock"><img id="tiFrame" src="ti_frame.webp" alt=""><img id="tiGun" src="ti_barrels.webp" alt=""><i id="tiFl0" class="fl"></i><i id="tiFl1" class="fl"></i></div><img class="sight" src="ti_sight.webp" alt=""><svg class="xh" viewBox="-75 -75 150 150"><circle class="rld" r="27" fill="none" stroke="#F2C232" stroke-width="2.5" stroke-dasharray="0 170" transform="rotate(-90)"/><rect class="lk" x="-30" y="-30" width="60" height="60" fill="none" stroke="#FF4A3A" stroke-width="2.4" stroke-dasharray="14 32" stroke-dashoffset="7" display="none"/></svg>
<div class="stat"><div class="s1"></div><div class="s2" style="font-size:12px;opacity:.85"></div></div>
<div class="units"></div><div class="b map">Карта</div><div class="fps"></div><canvas class="mini" width="300" height="188"></canvas>
<div class="b go">Старт</div><div class="b sup">Залп<span style="font-size:11px"></span></div><div class="hp"><i></i></div><div class="rl"></div><div class="msg"></div>`;
document.body.appendChild(H);
const q=s=>H.querySelector(s);
const UK=[['inf','Пехота'],['jeep','Джип'],['tank','Танк'],['heli','Верт.'],['harv','Харв.']];
q('.units').innerHTML=UK.map(([k,n])=>`<div class="b" data-k="${k}">${n}<span></span></div>`).join('');
const lob=document.createElement('div');lob.id='lobby';lob.innerHTML=`<div class="card"><h1>Две базы: Остров</h1><p>3D-прототип. Ты в кабине Титана. Базы на разных концах острова, колонны идут к врагу разными путями. Титан стреляет сам, когда враг в прицеле.</p><button id="bPlay">Играть</button><a href="./">← Обычная игра</a></div>`;
document.body.appendChild(lob);
const over=document.createElement('div');over.id='over';over.innerHTML=`<div class="t"></div><button>Ещё раз</button>`;document.body.appendChild(over);
let lastHp=P.max;
const HUD={msgT:0,k:0,msg(s){const m=q('.msg');m.textContent=s;m.style.display='block';this.msgT=2.5;},kick(){this.k=0.12;},
 upd(dt){const S=G_.sides[0],E=G_.sides[1];q('.s1').innerHTML=`❤ ${S.lives} &nbsp; 💎 ${Math.floor(S.ore)}`;q('.s2').innerHTML=`Соперник: ❤ ${E.lives}`;
  q('.hp i').style.width=(100*Math.max(0,P.hp)/P.max).toFixed(1)+'%';q('.rl').textContent=P.dead>0?'возрождение '+Math.ceil(P.dead)+' с':LOCK?'цель захвачена':'поиск цели';
  q('.rld').setAttribute('stroke-dasharray',(170*(1-P.cd/TITAN.cd)).toFixed(1)+' 170');q('.lk').setAttribute('display',LOCK?'inline':'none');{const im=q('img.sight');if(im)im.classList.toggle('lock',!!LOCK);const g=document.getElementById('tiGun');if(g&&g.offsetWidth){const r=g.getBoundingClientRect();for(const k of [0,1]){const f=document.getElementById('tiFl'+k);f.style.left=(r.left+r.width*TIPS[k][0])+'px';f.style.top=(r.top+r.height*TIPS[k][1])+'px';}}}
  q('.sup span').textContent=P.scd>0?Math.ceil(P.scd)+' с':'';q('.sup').classList.toggle('cd',P.scd>0);
  q('.hurt').style.boxShadow='inset 0 0 120px rgba(200,20,10,'+(P.hurt>0?0.5:0)+')';
  q('.go').textContent=P.move?'Стоп':'Старт';q('.go').classList.toggle('on',P.move);
  for(const el of q('.units').children){const k=el.dataset.k,c=k==='harv'?HARV.cost:US[k].cost;el.lastChild.textContent=c;el.classList.toggle('dis',S.ore<c);}
  q('.fps').textContent=Math.round(T3.fps)+' к/с · ×'+T3.q.toFixed(2);
  if(this.msgT>0){this.msgT-=dt;if(this.msgT<=0)q('.msg').style.display='none';}this.k=Math.max(0,this.k-dt);}};
const tapBtn=(el,fn)=>el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();fn(e);});
tapBtn(q('.go'),()=>{P.move=!P.move;});tapBtn(q('.sup'),()=>superShot());
tapBtn(q('.map'),()=>openMap());tapBtn(q('.mini'),()=>openMap());
for(const el of q('.units').children)tapBtn(el,()=>{const k=el.dataset.k;if(k==='harv'){if(buyHarv(0))HUD.msg('Харвестер выехал');}else sendUnit(0,k);});
document.getElementById('bPlay').onclick=()=>{lob.hidden=true;start();try{if(innerWidth<innerHeight||!document.fullscreenElement)document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen().catch(()=>{});}catch(_){}};
over.querySelector('button').onclick=()=>{over.style.display='none';start();};

/* ---------- tactical map: the island from above; enemies only where something of ours sees them ---------- */
const TM=document.createElement('div');TM.id='tmap';TM.innerHTML='<canvas></canvas><button class="x">◀ В кабину</button>';document.body.appendChild(TM);
TM.querySelector('.x').onclick=()=>{TM.style.display='none';T3.map=false;};
let MAPIMG=null;
function mapImage(){const w=400,h=250,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),im=x.createImageData(w,h);
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){const X=i/w*IW,Z=j/h*IH,v=hgt(X,Z),s=slope(X,Z),k=(j*w+i)*4;let r,g,b;
  if(v<WATER){const d=Math.min(1,-v/60);r=46-d*14;g=70-d*18;b=86-d*16;}else if(v<10){r=150;g=138;b=106;}else{const t=Math.min(1,v/260);r=96+t*40;g=98+t*28;b=70+t*36;const sh=1-Math.min(0.45,s*0.9);r*=sh;g*=sh;b*=sh;}
  im.data[k]=r;im.data[k+1]=g;im.data[k+2]=b;im.data[k+3]=255;}
 x.putImageData(im,0,0);x.strokeStyle='rgba(150,120,80,0.8)';x.lineWidth=1.5;for(const pl of ROADS_I){x.beginPath();pl.forEach((p,i)=>{const X=p[0]/IW*w,Z=p[1]/IH*h;i?x.lineTo(X,Z):x.moveTo(X,Z);});x.stroke();}return c;}
function seenBy0(x,z){if(Math.hypot(x-BASES[0][0],z-BASES[0][1])<900)return true;if(P.dead<=0&&Math.hypot(x-P.x,z-P.z)<VIS*1.3)return true;
 for(const u of G_.units)if(u.s===0&&!u.dead&&Math.hypot(u.x-x,u.z-z)<VIS)return true;for(const t of G_.towers)if(t.s===0&&Math.hypot(t.x-x,t.z-z)<VIS)return true;for(const h of G_.harv)if(h.s===0&&Math.hypot(h.x-x,h.z-z)<VIS*0.8)return true;return false;}
function drawMap(cv,big){const c=cv.getContext('2d'),W=cv.width,Hh=cv.height;c.fillStyle='#22313A';c.fillRect(0,0,W,Hh);const k=Math.min(W/IW,Hh/IH)*(big?0.96:1),ox=(W-IW*k)/2,oz=(Hh-IH*k)/2;
 if(!MAPIMG)MAPIMG=mapImage();c.drawImage(MAPIMG,ox,oz,IW*k,IH*k);const X=x=>ox+x*k,Z=z=>oz+z*k,dot=(x,z,r,col)=>{c.fillStyle=col;c.beginPath();c.arc(X(x),Z(z),r,0,7);c.fill();};
 const f=big?1:0.6;
 for(const m of G_.mines){c.fillStyle=m.ore>0?'#6FD6FF':'#556';c.save();c.translate(X(m.x),Z(m.z));c.rotate(Math.PI/4);c.fillRect(-5*f,-5*f,10*f,10*f);c.restore();if(big){c.fillStyle='#fff';c.font='700 11px Rubik,system-ui';c.textAlign='center';c.fillText(Math.round(m.ore/1000)+'к',X(m.x),Z(m.z)+18);}}
 for(const s of [0,1]){const [bx,bz]=BASES[s];c.fillStyle=s?'#E04A3A':'#3E86E0';c.fillRect(X(bx)-9*f,Z(bz)-9*f,18*f,18*f);c.strokeStyle='#fff';c.lineWidth=2;c.strokeRect(X(bx)-9*f,Z(bz)-9*f,18*f,18*f);}
 for(const t of G_.towers){if(t.s===1&&!seenBy0(t.x,t.z))continue;c.fillStyle=t.s?'#FF7A60':'#8CC0F0';c.beginPath();c.moveTo(X(t.x),Z(t.z)-6*f);c.lineTo(X(t.x)+5*f,Z(t.z)+4*f);c.lineTo(X(t.x)-5*f,Z(t.z)+4*f);c.fill();}
 for(const h of G_.harv){if(h.s===1&&!seenBy0(h.x,h.z))continue;dot(h.x,h.z,3.5*f,h.s?'#FFB060':'#F2C232');}
 for(const u of G_.units){if(u.dead)continue;if(u.s===1&&!seenBy0(u.x,u.z))continue;dot(u.x,u.z,(US[u.k].air?3:2.6)*f,u.s?'#FF5040':'#77B3EE');}
 if(P.dead<=0){c.save();c.translate(X(P.x),Z(P.z));c.rotate(P.yaw);c.fillStyle='#FFFFFF';c.beginPath();c.moveTo(10*f,0);c.lineTo(-6*f,6*f);c.lineTo(-3*f,0);c.lineTo(-6*f,-6*f);c.fill();c.restore();
  if(big){c.strokeStyle='rgba(255,255,255,0.25)';c.beginPath();c.arc(X(P.x),Z(P.z),VIS*1.3*k,0,7);c.stroke();}}}
function openMap(){T3.map=true;P.move=false;TM.style.display='block';}
function mapLoop(){const cv=TM.querySelector('canvas');const r=TM.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1);if(cv.width!==Math.round(r.width*d)){cv.width=Math.round(r.width*d);cv.height=Math.round(r.height*d);}drawMap(cv,true);}

/* ---------- look: one finger turns, two fingers zoom ---------- */
const ptr=new Map();let pinch0=0,zoom0=1;
cv3.addEventListener('pointerdown',e=>{try{cv3.setPointerCapture(e.pointerId);}catch(_){}ptr.set(e.pointerId,[e.clientX,e.clientY]);if(ptr.size===2){const [a,b]=[...ptr.values()];pinch0=Math.hypot(a[0]-b[0],a[1]-b[1]);zoom0=P.zoom;}});
cv3.addEventListener('pointermove',e=>{const p=ptr.get(e.pointerId);if(!p)return;const dx=e.clientX-p[0],dy=e.clientY-p[1];ptr.set(e.pointerId,[e.clientX,e.clientY]);
 if(ptr.size===1){const k=0.0055/P.zoom;P.yaw+=dx*k;P.pitch=Math.max(-0.35,Math.min(0.25,P.pitch-dy*k*0.8));}
 else if(ptr.size===2&&pinch0>0){const [a,b]=[...ptr.values()];P.zoom=Math.max(1,Math.min(3.5,zoom0*Math.hypot(a[0]-b[0],a[1]-b[1])/pinch0));}});
for(const n of ['pointerup','pointercancel'])cv3.addEventListener(n,e=>{ptr.delete(e.pointerId);if(ptr.size<2)pinch0=0;});
cv3.addEventListener('wheel',e=>{e.preventDefault();P.zoom=Math.max(1,Math.min(3.5,P.zoom*(e.deltaY<0?1.12:1/1.12)));},{passive:false});
const keys=new Set();addEventListener('keydown',e=>{keys.add(e.code);if(e.code==='KeyW')P.move=true;if(e.code==='KeyS')P.move=false;if(e.code==='KeyM')T3.map?TM.querySelector('.x').click():openMap();if(e.code==='Space'){e.preventDefault();superShot();}});addEventListener('keyup',e=>keys.delete(e.code));

/* ---------- start and main loop ---------- */
function size(){const w=innerWidth,h=innerHeight;R.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();postSize();}
addEventListener('resize',size);
let BUILT=false;
function start(){if(!BUILT){genIsland(1234);buildNav();planRoads();}newGame();if(!BUILT||MIL_DIRTY){for(const e of live.values())dyn.remove(e.o);live.clear();buildWorld();BUILT=true;MIL_DIRTY=false;MAPIMG=null;}
 for(const e of live.values())dyn.remove(e.o);live.clear();cv3.style.display='block';H.style.display='block';size();running=true;}
let running=false,MIL_DIRTY=false,last=performance.now();
function loop(now_){requestAnimationFrame(loop);const dt=Math.min(0.05,(now_-last)/1000);last=now_;if(!running)return;
 if(T3.map){mapLoop();stepGame(dt);stepShells(dt);return;}
 if(T3.applyQ){T3.applyQ=false;R.setPixelRatio(T3.q);size();}/* resolution changes happen before drawing, so the canvas is never shown cleared */
 if(keys.has('KeyA'))P.yaw-=1.6*dt;if(keys.has('KeyD'))P.yaw+=1.6*dt;
 const t=now_/1000;stepGame(dt);stepTitan(dt);stepShells(dt);syncAll(t,dt);stepParts(dt);
 if(G_.over&&over.style.display!=='flex'){over.style.display='flex';over.querySelector('.t').textContent=G_.over.w===0?'Победа!':'Поражение';}
 if(ocean)ocean.material.normalMap.offset.set(t*0.004,-t*0.01);
 for(const c of world.children)if(c.userData.cloud){c.position.x+=c.userData.v*dt;if(c.position.x>IW+7000)c.position.x=-7000;}
 const gy=hgt(P.x,P.z),bob=P.move?Math.sin(P.bob)*0.6:0,sh=P.shake||0;const y=Math.max(gy,0)+(P.dead>0?90:26)+bob+(rn()-0.5)*sh*3;cam.position.set(P.x+(rn()-0.5)*sh*3,y,P.z);
 const lp=P.pitch+(HUD.k>0?HUD.k*0.22:0);cam.lookAt(P.x+Math.cos(P.yaw)*Math.cos(lp)*100,y+Math.sin(lp)*100,P.z+Math.sin(P.yaw)*Math.cos(lp)*100);
 const fov=P.fov/P.zoom;if(Math.abs(cam.fov-fov)>0.01){cam.fov=fov;cam.updateProjectionMatrix();}cock.visible=false;{const v=P.dead<=0&&P.zoom<1.6;const g=document.getElementById('tiCock');if(g)g.style.display=v?'block':'none';}barrel.position.z=P.rec*5;
 sky.position.copy(cam.position);sun.position.set(P.x+SUN_DIR.x*700,SUN_DIR.y*700,P.z+SUN_DIR.z*700);sun.target.position.set(P.x+Math.cos(P.yaw)*150,0,P.z+Math.sin(P.yaw)*150);
 HUD.upd(dt);if(FR%6===0)drawMap(q('.mini'),false);cam.updateMatrixWorld();cockRoot.position.copy(cam.position);cockRoot.quaternion.copy(cam.quaternion);cockScene.environment=scene.environment;drawFrame();AUD.tick(dt);
 T3.fpsN++;T3.fpsT+=dt;if(T3.fpsT>=2){T3.fps=T3.fpsN/T3.fpsT;T3.fpsN=0;T3.fpsT=0;T3.warm=(T3.warm||0)+1;
  /* ignore the first seconds (shaders compiling); go down after two slow windows, up only after four fast ones and never soon after going down */
  if(T3.warm>2){T3.lowN=T3.fps<38?(T3.lowN||0)+1:0;T3.hiN=T3.fps>58?(T3.hiN||0)+1:0;let nq=T3.q;
   if(T3.lowN>=2&&T3.q>0.55){nq=Math.max(0.55,T3.q-0.15);T3.lowN=0;T3.downAt=now_;}
   else if(T3.hiN>=4&&T3.q<Math.min(2,devicePixelRatio||1)&&now_-(T3.downAt||-1e9)>30000){nq=Math.min(devicePixelRatio||1,T3.q+0.1);T3.hiN=0;}
   if(nq!==T3.q){T3.q=nq;T3.applyQ=true;try{localStorage.setItem('dvebazy-isleq',''+nq);}catch(_){}}
   if(T3.fps<26&&T3.q<=0.56&&R.shadowMap.enabled){R.shadowMap.enabled=false;scene.traverse(o=>{if(o.material)o.material.needsUpdate=true;});}}}}
requestAnimationFrame(loop);
window.__isle={prof:()=>{const T={};const m=(k,f)=>{const t=performance.now();f();T[k]=Math.round(performance.now()-t);};m("step",()=>stepGame(1/60));m("titan",()=>stepTitan(1/60));m("sync",()=>syncAll(performance.now()/1000,1/60));m("parts",()=>stepParts(1/60));m("mini",()=>drawMap(q(".mini"),false));m("hud",()=>HUD.upd(1/60));m("draw",()=>drawFrame());m("gl",()=>R.getContext().finish());return T;},dbg:()=>({running,map:T3.map,fr:FR,fps:T3.fps}),world:()=>world,stepGame,stepTitan,stepShells,ROADS:()=>ROADS_I,GAPS:()=>GAPS,P,get G(){return G_;},start,sendUnit,T3,superShot,get LOCK(){return LOCK;},hgt,openMap};

function drawFrame(){if(!PO.on){R.setRenderTarget(null);R.render(scene,cam);R.autoClear=false;R.clearDepth();if(cock.visible)R.render(cockScene,cam);R.autoClear=true;return;}
 R.setRenderTarget(PO.rt);R.render(scene,cam);R.autoClear=false;R.clearDepth();if(cock.visible)R.render(cockScene,cam);R.autoClear=true;
 PO.bright.uniforms.t.value=PO.rt.texture;pass(PO.bright,PO.a);
 for(let i=0;i<2;i++){PO.blur.uniforms.t.value=PO.a.texture;PO.blur.uniforms.d.value.set((1+i)/PO.bw,0);pass(PO.blur,PO.b);PO.blur.uniforms.t.value=PO.b.texture;PO.blur.uniforms.d.value.set(0,(1+i)/PO.bh);pass(PO.blur,PO.a);}
 PO.fin.uniforms.tS.value=PO.rt.texture;PO.fin.uniforms.tB.value=PO.a.texture;pass(PO.fin,null);}
/* ================== sound: music from the main game, effects made on the fly ================== */
const AUD={ctx:null,on:true,last:{},
 init(){try{if(this.ctx){this.ctx.resume();if(this.music&&this.on)this.music.play().catch(()=>{});return;}const C=new(window.AudioContext||window.webkitAudioContext)();this.ctx=C;
  const comp=C.createDynamicsCompressor();comp.threshold.value=-10;comp.ratio.value=8;comp.connect(C.destination);this.out=C.createGain();this.out.gain.value=this.on?0.9:0;this.out.connect(comp);
  const n=C.createBuffer(1,C.sampleRate*2,C.sampleRate),d=n.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;this.noise=n;
  /* engine: filtered noise + low hum, louder while driving */
  const src=C.createBufferSource();src.buffer=n;src.loop=true;const lp=C.createBiquadFilter();lp.type='lowpass';lp.frequency.value=160;const o=C.createOscillator();o.type='sawtooth';o.frequency.value=38;const og=C.createGain();og.gain.value=0.05;
  this.eng=C.createGain();this.eng.gain.value=0;src.connect(lp).connect(this.eng);o.connect(og).connect(this.eng);this.eng.connect(this.out);src.start();o.start();this.engO=o;
  this.music=new Audio('desert.mp3');this.music.loop=true;this.music.volume=0.32;if(this.on)this.music.play().catch(()=>{});}catch(e){console.error(e);}},
 setOn(v){this.on=v;if(this.out)this.out.gain.value=v?0.9:0;if(this.music){if(v)this.music.play().catch(()=>{});else this.music.pause();}try{localStorage.setItem('dvebazy-islesnd',v?'1':'0');}catch(_){}},
 tick(dt){if(!this.ctx)return;const t=this.ctx.currentTime;this.eng.gain.setTargetAtTime(P.dead>0?0:P.move?0.22:0.07,t,0.25);this.engO.frequency.setTargetAtTime(P.move?52:36,t,0.4);},
 gainAt(x,z){const d=Math.hypot(x-cam.position.x,z-cam.position.z);return Math.max(0,1-d/2600)**2;},
 play(kind,x,z,k){if(!this.ctx||!this.on)return;const g0=x==null?1:this.gainAt(x,z);if(g0<0.01)return;const now=this.ctx.currentTime;if(this.last[kind]&&now-this.last[kind]<(kind==='mg'?0.07:kind==='boom'?0.05:0.02))return;this.last[kind]=now;
  const C=this.ctx,src=C.createBufferSource();src.buffer=this.noise;const f=C.createBiquadFilter(),g=C.createGain();src.connect(f).connect(g).connect(this.out);const off=Math.random()*1.5;
  if(kind==='cannon'){f.type='lowpass';f.frequency.setValueAtTime(1800,now);f.frequency.exponentialRampToValueAtTime(140,now+0.5);g.gain.setValueAtTime(0.9*g0,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.7);src.start(now,off,0.75);
   const o=C.createOscillator(),og=C.createGain();o.frequency.setValueAtTime(90,now);o.frequency.exponentialRampToValueAtTime(35,now+0.3);og.gain.setValueAtTime(0.8*g0,now);og.gain.exponentialRampToValueAtTime(0.001,now+0.35);o.connect(og).connect(this.out);o.start(now);o.stop(now+0.4);}
  else if(kind==='boom'){const kk=Math.min(1.6,k||1);f.type='lowpass';f.frequency.setValueAtTime(900,now);f.frequency.exponentialRampToValueAtTime(90,now+0.9*kk);g.gain.setValueAtTime(0.7*g0*kk,now);g.gain.exponentialRampToValueAtTime(0.001,now+1.1*kk);src.start(now,off,1.2*kk);}
  else if(kind==='mg'){f.type='bandpass';f.frequency.value=1800;f.Q.value=0.8;g.gain.setValueAtTime(0.25*g0,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.05);src.start(now,off,0.06);}
  else if(kind==='shot'){f.type='bandpass';f.frequency.value=700;g.gain.setValueAtTime(0.35*g0,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.18);src.start(now,off,0.2);}}};
try{AUD.on=localStorage.getItem('dvebazy-islesnd')!=='0';}catch(_){}
{const ex0=explode;explode=function(x,y,z,k){ex0(x,y,z,k);AUD.play('boom',x,z,k);};const tr0=tracer;tracer=function(a,b,c){tr0(a,b,c);AUD.play(c===0xFF9050?'shot':'mg',a[0],a[2]);};const sh0=shoot;shoot=function(x,y,z,tg,sup){sh0(x,y,z,tg,sup);AUD.play('cannon');};}
{const sb=document.createElement('div');sb.className='b snd';sb.style.cssText='right:calc(max(14px,env(safe-area-inset-right)) + 96px);top:12px;width:44px;height:40px;font-size:18px';const upd=()=>sb.textContent=AUD.on?'🔊':'🔇';upd();H.appendChild(sb);
 tapBtn(sb,()=>{AUD.setOn(!AUD.on);upd();});}
document.getElementById('bPlay').addEventListener('click',()=>AUD.init());over.querySelector('button').addEventListener('click',()=>AUD.init());
document.addEventListener('visibilitychange',()=>{if(!AUD.music)return;if(document.hidden)AUD.music.pause();else if(AUD.on&&running)AUD.music.play().catch(()=>{});});

function onMil(){if(BUILT){MIL_DIRTY=false;buildWorld();}else MIL_DIRTY=true;}
cam.far=9000;cam.updateProjectionMatrix();{const c=sun.shadow.camera;c.left=-330;c.right=330;c.top=330;c.bottom=-330;c.far=1600;c.updateProjectionMatrix();}
try{const q=+localStorage.getItem('dvebazy-isleq');if(q>=0.5&&q<=2){T3.q=q;R.setPixelRatio(q);}}catch(_){}

})();
