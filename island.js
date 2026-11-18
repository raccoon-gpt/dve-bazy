/* «Две базы: Остров» — 3D island game (built by build_island.py) */
(function(){'use strict';
if(typeof THREE==='undefined'){console.error('three.js missing');return;}
/* ================== «Две базы: Остров» — the island game ================== */
/* ---------- world size and rules ---------- */
const IW=8000,IH=5000,GS=40;                         // island area, height-grid step
const WATER=0;
const BASES=[[700,IH/2],[IW-700,IH/2]];
const START_ORE=700,BASE_INC=8,LIVES=30;
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
const VIS=520;
const MINE_LIVES=20,MINE_HP=400,MINE_INC=5;          // each mine: 20 lives, 400 damage from units = 1 life, crystals per second                                        // how far anything of ours sees
const THEME={isle:{g1:'#6E665A',g2:'#7A7266',g3:'#5A544A',dirt:'#6A5A48',dirt2:'#4E4236',sky:0x2E3858,hz:0xF09A5C,fog:0xA87A64,tree:[0x3F4A2E,0x4A5434,0x3A4430,0x525A3A],bark:0x3E3428,rock:0x77746C}};
const T3={on:true,map:false,q:1,fpsT:0,fpsN:0,fps:60,lo:false};
const P={x:0,z:0,yaw:0,pitch:-0.05,move:false,hp:6000,max:6000,cd:0,scd:0,dead:0,fov:66,zoom:1,rec:0,bob:0,shake:0};
const me=0;
const TITAN={sp:46*SPK,cd:1.0,dmg:360,r:44,v:1100,range:700,cone:0.06,superCd:20,superN:7,respawn:5,bounty:600};
const ALT={heli:95,plane:130};

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
 const bag=std(0x7E7258,0.95,0);for(let i=0;i<12;i++){const a=i/12*Math.PI*2+0.2;const s_=BOX(4,3,7,bag,Math.cos(a)*17.5,1.5,Math.sin(a)*17.5);s_.rotation.y=-a;base.push(s_);}
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
 PO.fin=new THREE.ShaderMaterial({uniforms:{tS:{value:null},tB:{value:null},ex:{value:0.95},bk:{value:0.55},mono:{value:0},tm:{value:0}},vertexShader:vs,depthTest:false,depthWrite:false,
  fragmentShader:`uniform sampler2D tS;uniform sampler2D tB;uniform float ex;uniform float bk;uniform float mono;uniform float tm;varying vec2 vUv;
  vec3 aces(vec3 x){x*=0.6;return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}
  void main(){vec3 s0=texture2D(tS,vUv).rgb;if(!(s0.r==s0.r&&s0.g==s0.g&&s0.b==s0.b))s0=vec3(0.5);vec3 c=clamp(s0,0.0,60.0)*ex+texture2D(tB,vUv).rgb*bk;c=aces(c);
   float l=dot(c,vec3(0.2126,0.7152,0.0722));c=mix(vec3(l),c,0.98);
   c+=vec3(0.035,0.012,-0.03)*smoothstep(0.35,0.9,l)+vec3(-0.012,0.004,0.03)*(1.0-smoothstep(0.0,0.35,l));
   c=pow(max(c,vec3(0.0)),vec3(1.0/2.2));c=mix(c,c*c*(3.0-2.0*c),0.22);
   float v=distance(vUv,vec2(0.5));c*=1.0-0.38*smoothstep(0.42,0.85,v);
   if(mono>0.0){float lm=dot(c,vec3(0.299,0.587,0.114));lm=clamp((lm-0.45)*1.35+0.5,0.0,1.0);float gr=fract(sin(dot(vUv*vec2(1733.0,977.0)+vec2(tm,tm*1.37),vec2(12.9898,78.233)))*43758.5453);lm+=(gr-0.5)*0.10;c=mix(c,vec3(lm),mono);}
   gl_FragColor=vec4(c,1.0);}`});
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


/* ================== the yard: a walled industrial compound at sunset ================== */
const smoothstep=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
let GAPS=[],MINES_AT=[];const OBS=[];            // obstacles: axis-aligned boxes {x,z,w,d,h,k}
const WALL_H=72,WALL_T=30;
function hgt(x,z){return 0;}
function slope(x,z){return 0;}
const inRect=(x,z,o,pad)=>Math.abs(x-o.x)<o.w/2+pad&&Math.abs(z-o.z)<o.d/2+pad;
const blockedAt=(x,z,pad)=>OBS.some(o=>inRect(x,z,o,pad));
function freeRect(x,z,w,d,pad){if(x-w/2<120||x+w/2>IW-120||z-d/2<120||z+d/2>IH-120)return false;
 for(const o of OBS)if(Math.abs(x-o.x)<(w+o.w)/2+pad&&Math.abs(z-o.z)<(d+o.d)/2+pad)return false;
 if(BASES.some(([bx,bz])=>Math.abs(x-bx)<w/2+380&&Math.abs(z-bz)<d/2+380))return false;
 if(MINES_AT.some(([mx,mz])=>Math.abs(x-mx)<w/2+200&&Math.abs(z-mz)<d/2+200))return false;
 if(Math.abs(x-IW/2)<w/2+260&&GAPS.some(g=>Math.abs(z-g)<d/2+230))return false;return true;}
const CONT={L:90,H:22,W:20};
function genYard(seed){seedR=seed;OBS.length=0;
 GAPS=[IH*0.2+rn()*250,IH*0.5+(rn()-0.5)*300,IH*0.8-rn()*250];
 MINES_AT=[[1900,1250],[1900,IH-1250],[IW-1900,1250],[IW-1900,IH-1250],[3100,IH/2+(rn()-0.5)*500],[IW-3100,IH/2+(rn()-0.5)*500]];
 /* the spine: a double wall of stacked containers through the middle, open only at the three gaps */
 for(let z=60;z<IH-60;z+=CONT.L){if(GAPS.some(g=>Math.abs(z-g)<200))continue;for(const dx of [-CONT.W/2,CONT.W/2])OBS.push({x:IW/2+dx,z,w:CONT.W,d:CONT.L,h:CONT.H*(2+((z/96|0)%2)),k:'c',rot:1});}
 /* container yards: rows of stacks with lanes between them */
 for(let n=0,t=0;t<2500&&n<62;t++){const rot=rn()<0.5,rows=2+Math.floor(rn()*3),len=3+Math.floor(rn()*5),gap=70;
  const W_=rot?rows*(CONT.W*2+gap):len*CONT.L,D_=rot?len*CONT.L:rows*(CONT.W*2+gap),cx=300+rn()*(IW-600),cz=300+rn()*(IH-600);if(!freeRect(cx,cz,W_,D_,100))continue;n++;
  for(let r=0;r<rows;r++)for(let i=0;i<len;i++){if(rn()<0.12)continue;const off=-((rows-1)*(CONT.W*2+gap))/2+r*(CONT.W*2+gap),al=-((len-1)*CONT.L)/2+i*CONT.L;
   for(const s2 of [-CONT.W/2,CONT.W/2]){const h=CONT.H*(1+Math.floor(rn()*3));OBS.push(rot?{x:cx+off+s2,z:cz+al,w:CONT.W,d:CONT.L,h,k:'c',rot:1}:{x:cx+al,z:cz+off+s2,w:CONT.L,d:CONT.W,h,k:'c',rot:0});}}}
 /* hangars and concrete bunkers */
 for(let n=0,t=0;t<600&&n<7;t++){const rot=rn()<0.5,w=rot?200:320,d=rot?320:200,x=300+rn()*(IW-600),z=300+rn()*(IH-600);if(!freeRect(x,z,w,d,140))continue;n++;OBS.push({x,z,w,d,h:64,k:'hang',rot:rot?1:0});}
 for(let n=0,t=0;t<1500&&n<30;t++){const w=80+rn()*60,d=60+rn()*50,x=300+rn()*(IW-600),z=300+rn()*(IH-600);if(!freeRect(x,z,w,d,110))continue;n++;OBS.push({x,z,w,d,h:24+rn()*10,k:'bunk'});}
 /* lines of concrete blocks */
 for(let n=0,t=0;t<900&&n<26;t++){const rot=rn()<0.5,len=4+Math.floor(rn()*6),w=rot?10:len*34,d=rot?len*34:10,x=300+rn()*(IW-600),z=300+rn()*(IH-600);if(!freeRect(x,z,w,d,90))continue;n++;OBS.push({x,z,w,d,h:11,k:'blk',rot:rot?1:0,n:len});}}

/* ---------- navigation grid: finer cells, obstacles inflated ---------- */
const NG=40,GX=Math.ceil(IW/NG),GZ=Math.ceil(IH/NG);const NAV=new Float32Array(GX*GZ),ROADC=new Uint8Array(GX*GZ);
function buildNav(){NAV.fill(1);for(let j=0;j<GZ;j++)for(let i=0;i<GX;i++){const x=(i+0.5)*NG,z=(j+0.5)*NG;if(x<90||z<90||x>IW-90||z>IH-90){NAV[j*GX+i]=0;continue;}
  for(const o of OBS)if(inRect(x,z,o,34)){NAV[j*GX+i]=0;break;}else if(inRect(x,z,o,70))NAV[j*GX+i]=Math.max(NAV[j*GX+i],1.6);}}
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
function resample(pl,st){const o=[pl[0]];for(let i=1;i<pl.length;i++){const a=o[o.length-1],b=pl[i],d=Math.hypot(b[0]-a[0],b[1]-a[1]);const n=Math.floor(d/st);for(let k=1;k<=n;k++)o.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}return o;}
const nearBase=(x,z,r)=>BASES.some(([bx,bz])=>Math.hypot(x-bx,z-bz)<r);
const nearMine=(x,z,r)=>MINES_AT.some(([mx,mz])=>Math.hypot(x-mx,z-mz)<r);
function nearRoad(x,z,r){for(const pl of ROADS_I)for(let i=0;i<pl.length-1;i+=1){if(segDist2(x,z,pl[i],pl[i+1])<r)return true;}return false;}
function segDist2(px,pz,a,b){const dx=b[0]-a[0],dz=b[1]-a[1];const l2=dx*dx+dz*dz||1;let k=((px-a[0])*dx+(pz-a[1])*dz)/l2;k=Math.max(0,Math.min(1,k));return Math.hypot(px-a[0]-dx*k,pz-a[1]-dz*k);}

function planRoads(){ROADS_I=[];const add=pl=>{ROADS_I.push(pl);for(const [x,z] of pl){const [i,j]=cellOf(x,z);ROADC[j*GX+i]=1;}};
 for(const g of GAPS){const a=astar(BASES[0][0]+220,BASES[0][1],IW/2,g,0,1),b=astar(IW/2,g,BASES[1][0]-220,BASES[1][1],0,1);add([...a,...b.slice(1)]);}
 for(const [mx,mz] of MINES_AT){const s=mx<IW/2?0:1;const [bx,bz]=BASES[s];add(astar(bx+(s?-170:170),bz,mx,mz+70,0,0.8));}}

/* ---------- painted textures ---------- */
const YT={};
function grit(c,w,h,n,a){for(let i=0;i<n;i++){c.fillStyle=rn()<0.5?`rgba(0,0,0,${a})`:`rgba(255,255,255,${a*0.8})`;c.fillRect(rn()*w,rn()*h,1+rn()*2,1+rn()*2);}}
function streaks(c,w,h,n,col){for(let i=0;i<n;i++){const x=rn()*w,y=rn()*h*0.6,l=20+rn()*120,g=c.createLinearGradient(0,y,0,y+l);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(x,y,1+rn()*3,l);}}
function yardTextures(){if(YT.floor)return YT;
 YT.floor=canvasTex(512,512,(c,w,h)=>{c.fillStyle='#7C7870';c.fillRect(0,0,w,h);
  for(let i=0;i<40;i++){const x=rn()*w,y=rn()*h,r=30+rn()*90,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,rn()<0.5?'rgba(60,56,50,0.25)':'rgba(150,145,135,0.2)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);}
  grit(c,w,h,9000,0.12);
  c.strokeStyle='rgba(30,28,26,0.75)';c.lineWidth=3;for(const v of [0,w/2]){c.beginPath();c.moveTo(v,0);c.lineTo(v,h);c.stroke();c.beginPath();c.moveTo(0,v);c.lineTo(w,v);c.stroke();}
  c.strokeStyle='rgba(170,165,155,0.35)';c.lineWidth=1;for(const v of [2,w/2+2]){c.beginPath();c.moveTo(v,0);c.lineTo(v,h);c.stroke();c.beginPath();c.moveTo(0,v);c.lineTo(w,v);c.stroke();}
  c.strokeStyle='rgba(25,22,20,0.55)';for(let i=0;i<14;i++){let x=rn()*w,y=rn()*h;c.lineWidth=0.8+rn();c.beginPath();c.moveTo(x,y);for(let k=0;k<6;k++){x+=(rn()-0.5)*40;y+=(rn()-0.5)*40;c.lineTo(x,y);}c.stroke();}
  for(let i=0;i<6;i++){const x=rn()*w,y=rn()*h,r=8+rn()*26,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(20,18,16,0.5)');g.addColorStop(1,'rgba(20,18,16,0)');c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);}});
 const ribs=(c,w,h,bump)=>{const n=26;for(let i=0;i<n;i++){const x=i*w/n;const g=c.createLinearGradient(x,0,x+w/n,0);if(bump){g.addColorStop(0,'#404040');g.addColorStop(0.3,'#C8C8C8');g.addColorStop(0.7,'#C8C8C8');g.addColorStop(1,'#404040');}else{g.addColorStop(0,'rgba(0,0,0,0.28)');g.addColorStop(0.35,'rgba(255,255,255,0.12)');g.addColorStop(0.7,'rgba(255,255,255,0.05)');g.addColorStop(1,'rgba(0,0,0,0.3)');}c.fillStyle=g;c.fillRect(x,0,w/n,h);}};
 YT.cont=canvasTex(512,128,(c,w,h)=>{c.fillStyle='#E6E2DA';c.fillRect(0,0,w,h);ribs(c,w,h,false);
  c.fillStyle='rgba(40,36,32,0.6)';c.fillRect(0,0,w,5);c.fillRect(0,h-6,w,6);c.fillRect(0,0,6,h);c.fillRect(w-6,0,6,h);
  streaks(c,w,h,26,'rgba(110,60,30,0.45)');grit(c,w,h,2500,0.15);
  c.fillStyle='rgba(255,255,255,0.75)';c.font='700 15px monospace';c.fillText(['MSKU','TGHU','CMAU','OOLU'][Math.floor(rn()*4)]+' '+Math.floor(100000+rn()*899999),20,30);c.font='700 10px monospace';c.fillText('22G1  MAX GROSS 30480 KG',20,46);
  const g=c.createLinearGradient(0,h*0.6,0,h);g.addColorStop(0,'rgba(60,45,30,0)');g.addColorStop(1,'rgba(60,45,30,0.5)');c.fillStyle=g;c.fillRect(0,0,w,h);});
 YT.contB=canvasTex(512,128,(c,w,h)=>{c.fillStyle='#808080';c.fillRect(0,0,w,h);ribs(c,w,h,true);},false);
 YT.wall=canvasTex(512,256,(c,w,h)=>{c.fillStyle='#5E625F';c.fillRect(0,0,w,h);
  for(let i=0;i<4;i++){const x=i*w/4;c.fillStyle=['#646865','#5A5E5B','#616562','#585C59'][i];c.fillRect(x+3,3,w/4-6,h-46);c.strokeStyle='rgba(20,20,20,0.7)';c.lineWidth=3;c.strokeRect(x+2,2,w/4-4,h-44);
   for(let k=0;k<6;k++)for(const yy of [10,h-52]){c.fillStyle='rgba(30,30,30,0.8)';c.beginPath();c.arc(x+12+k*(w/4-24)/5,yy,2.4,0,7);c.fill();c.fillStyle='rgba(200,200,200,0.4)';c.beginPath();c.arc(x+11.4+k*(w/4-24)/5,yy-0.6,1,0,7);c.fill();}}
  streaks(c,w,h,40,'rgba(120,64,28,0.55)');grit(c,w,h,5000,0.14);
  for(let x=-40;x<w+40;x+=40){c.fillStyle='#D8A818';c.beginPath();c.moveTo(x,h-40);c.lineTo(x+20,h-40);c.lineTo(x+40,h);c.lineTo(x+20,h);c.fill();}c.fillStyle='#1E1E1C';for(let x=-20;x<w+40;x+=40){c.beginPath();c.moveTo(x,h-40);c.lineTo(x+20,h-40);c.lineTo(x+40,h);c.lineTo(x+20,h);c.fill();}
  c.fillStyle='rgba(30,26,22,0.35)';c.fillRect(0,h-40,w,40);});
 YT.conc=canvasTex(256,256,(c,w,h)=>{c.fillStyle='#8C877C';c.fillRect(0,0,w,h);grit(c,w,h,5000,0.13);streaks(c,w,h,16,'rgba(40,36,30,0.4)');
  c.strokeStyle='rgba(40,36,30,0.6)';c.lineWidth=2;c.strokeRect(1,1,w-2,h-2);c.strokeStyle='rgba(30,28,24,0.5)';for(let i=0;i<5;i++){let x=rn()*w,y=rn()*h;c.lineWidth=1;c.beginPath();c.moveTo(x,y);for(let k=0;k<5;k++){x+=(rn()-0.5)*30;y+=rn()*25;c.lineTo(x,y);}c.stroke();}});
 YT.hang=canvasTex(512,256,(c,w,h)=>{c.fillStyle='#6E6A60';c.fillRect(0,0,w,h);const n=32;for(let i=0;i<n;i++){const x=i*w/n;c.fillStyle=i%2?'rgba(0,0,0,0.18)':'rgba(255,255,255,0.06)';c.fillRect(x,0,w/n,h);}
  streaks(c,w,h,40,'rgba(110,60,28,0.5)');grit(c,w,h,4000,0.12);c.fillStyle='rgba(20,18,16,0.4)';c.fillRect(0,h-14,w,14);});
 YT.door=canvasTex(256,256,(c,w,h)=>{c.fillStyle='#4E524E';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=12){c.fillStyle='rgba(0,0,0,0.3)';c.fillRect(0,y,w,2);c.fillStyle='rgba(255,255,255,0.08)';c.fillRect(0,y+2,w,1);}streaks(c,w,h,20,'rgba(110,60,28,0.5)');grit(c,w,h,2500,0.12);
  for(let x=0;x<w;x+=32){c.fillStyle='#D8A818';c.fillRect(x,0,16,10);c.fillStyle='#1E1E1C';c.fillRect(x+16,0,16,10);}});
 YT.blk=canvasTex(256,64,(c,w,h)=>{c.fillStyle='#9A958A';c.fillRect(0,0,w,h);grit(c,w,h,1500,0.15);for(let x=0;x<w;x+=w/8){c.fillStyle='rgba(40,36,30,0.6)';c.fillRect(x,0,2,h);}
  for(let x=0;x<w;x+=24){c.fillStyle='rgba(200,50,30,0.7)';c.fillRect(x,h*0.35,12,6);c.fillStyle='rgba(240,240,230,0.7)';c.fillRect(x+12,h*0.35,12,6);}});
 YT.glow=texSoft(255,210,140,0.18);YT.smoke=texSmoke();
 return YT;}
/* the floor mask: dirt (r), tyre tracks and oil (g), yellow lane paint (b), painted over the whole yard */
function floorMask(){const w=2048,h=1280,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,w,h);const k=w/IW;
 const blob=(X,Z,R,col)=>{const g=x.createRadialGradient(X*k,Z*k,0,X*k,Z*k,R*k);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect((X-R)*k,(Z-R)*k,2*R*k,2*R*k);};
 x.globalCompositeOperation='lighter';
 for(let i=0;i<260;i++)blob(rn()*IW,rn()*IH,80+rn()*360,`rgba(${Math.floor(60+rn()*90)},0,0,1)`);
 for(const o of OBS){x.fillStyle='rgba(90,0,0,1)';x.fillRect((o.x-o.w/2-16)*k,(o.z-o.d/2-16)*k,(o.w+32)*k,(o.d+32)*k);}
 for(const [bx,bz] of BASES)blob(bx,bz,420,'rgba(150,0,0,1)');for(const [mx,mz] of MINES_AT)blob(mx,mz,260,'rgba(170,40,0,1)');
 for(let i=0;i<90;i++)blob(rn()*IW,rn()*IH,14+rn()*50,'rgba(0,150,0,1)');
 const line=(pl,off,col,wd,dash)=>{x.strokeStyle=col;x.lineWidth=wd*k;x.setLineDash(dash?dash.map(v=>v*k):[]);x.beginPath();pl.forEach((p,i)=>{const a=pl[Math.max(0,i-1)],b=pl[Math.min(pl.length-1,i+1)];let dx=b[0]-a[0],dz=b[1]-a[1];const l=Math.hypot(dx,dz)||1;const X=(p[0]-dz/l*off)*k,Z=(p[1]+dx/l*off)*k;i?x.lineTo(X,Z):x.moveTo(X,Z);});x.stroke();x.setLineDash([]);};
 x.lineCap='round';x.lineJoin='round';
 const P_=ROADS_I.map(pl=>resample(chaikin(pl,2),20));
 P_.forEach(pl=>{line(pl,0,'rgba(70,0,0,1)',70);for(const o of [-11,11,-15,15])line(pl,o,'rgba(0,70,0,1)',4);});
 ROADS_I.slice(0,3).forEach((pl,i)=>line(resample(chaikin(pl,2),20),0,'rgba(0,0,200,1)',3,[40,40]));
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.anisotropy=4;return t;}
function floorMaterial(){const T=yardTextures(),RM=floorMask();const m=new THREE.MeshStandardMaterial({map:T.floor,roughness:0.9,metalness:0});
 m.onBeforeCompile=sh=>{sh.uniforms.tMask={value:RM};
  sh.vertexShader='varying vec3 vWP;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xyz;');
  sh.fragmentShader='uniform sampler2D tMask;varying vec3 vWP;\n'+sh.fragmentShader.replace('#include <map_fragment>',
  `vec2 fu=vWP.xz/170.0;vec4 tc=texture2D(map,fu);vec4 tc2=texture2D(map,vWP.xz/690.0+0.37);vec3 col=tc.rgb*mix(0.85,1.15,tc2.g);
   vec2 mu=vWP.xz/vec2(${IW.toFixed(1)},${IH.toFixed(1)});float inside=step(0.0,mu.x)*step(mu.x,1.0)*step(0.0,mu.y)*step(mu.y,1.0);vec3 mk=texture2D(tMask,clamp(mu,0.0,1.0)).rgb*inside;
   float out_=1.0-inside;
   col=mix(col,col*vec3(0.62,0.52,0.40)+vec3(0.05,0.035,0.02),clamp(mk.r*0.9+out_*0.85,0.0,1.0));
   col*=1.0-mk.g*0.55;col=mix(col,vec3(0.62,0.48,0.12),mk.b*0.75);
   diffuseColor.rgb*=col;`);};return m;}
function boxUV(geo,su,sv){const uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*su,uv.getY(i)*sv);return geo;}
const CONT_COLS=[0x9C3B2C,0x2E5A86,0x3D6B43,0xB8682A,0x6E6E6A,0xC9C2B0,0x7A3048,0x2C6E70,0xA88C3A];
let LIGHTS=[],ROADS_I=[],ocean=null;
function buildWorld(){if(world)scene.remove(world);BATT[0]=[];BATT[1]=[];world=new THREE.Group();scene.add(world);LIGHTS=[];
 materials('isle');const T=yardTextures();
 if(sky)scene.remove(sky);sky=mkSky('isle');sky.scale.setScalar(3);scene.add(sky);scene.environment=mkEnv('isle');
 scene.fog=new THREE.FogExp2(lin(THEME.isle.fog),T3.lo?0.00036:0.00028);
 const fl=new THREE.Mesh(new THREE.PlaneGeometry(40000,40000),floorMaterial());fl.rotation.x=-Math.PI/2;fl.position.set(IW/2,0,IH/2);fl.receiveShadow=true;world.add(fl);
 const o=new THREE.Object3D(),add=m=>{m.castShadow=true;m.receiveShadow=true;world.add(m);return m;};
 /* containers: one instanced box, ribbed paint, colour per box */
 {const L_=OBS.filter(q=>q.k==='c');const mat=new THREE.MeshStandardMaterial({map:T.cont,bumpMap:T.contB,bumpScale:0.6,roughness:0.62,metalness:0.35,envMapIntensity:0.5});
  let n=0;for(const q of L_)n+=Math.round(q.h/CONT.H);const im=add(new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mat,n));let i=0;
  for(const q of L_){const lv=Math.round(q.h/CONT.H);for(let k=0;k<lv;k++){rn();rn();o.position.set(q.x,CONT.H*(k+0.5),q.z);o.rotation.set(0,q.rot?Math.PI/2:0,0);o.scale.set(CONT.L+0.3,CONT.H+0.05,CONT.W+0.3);o.updateMatrix();im.setMatrixAt(i,o.matrix);
    const c=lin(CONT_COLS[Math.floor(rn()*CONT_COLS.length)]);c.multiplyScalar(0.85+rn()*0.3);im.setColorAt(i,c);i++;}}im.instanceColor.needsUpdate=true;}
 /* perimeter wall with buttresses and floodlights */
 {const mat=new THREE.MeshStandardMaterial({map:T.wall,roughness:0.7,metalness:0.45,envMapIntensity:0.45});const seg=[];const SL=240;
  for(let x=0;x<IW;x+=SL){seg.push([x+SL/2,-WALL_T/2,0],[x+SL/2,IH+WALL_T/2,0]);}for(let z=0;z<IH;z+=SL){seg.push([-WALL_T/2,z+SL/2,1],[IW+WALL_T/2,z+SL/2,1]);}
  const im=add(new THREE.InstancedMesh(boxUV(new THREE.BoxGeometry(1,1,1),1,1),mat,seg.length));seg.forEach(([x,z,r],i)=>{o.position.set(x,WALL_H/2,z);o.rotation.set(0,r?Math.PI/2:0,0);o.scale.set(SL,WALL_H,WALL_T);o.updateMatrix();im.setMatrixAt(i,o.matrix);});
  const bm=new THREE.MeshStandardMaterial({map:T.conc,color:lin(0x8A8680),roughness:0.9});const im2=add(new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),bm,seg.length));
  seg.forEach(([x,z,r],i)=>{const ex=r?(x<IW/2?WALL_T:-WALL_T):0,ez=r?0:(z<IH/2?WALL_T:-WALL_T);o.position.set(x-(r?0:SL/2)+ex*0.7,WALL_H/2+4,z-(r?SL/2:0)+ez*0.7);o.rotation.set(0,0,0);o.scale.set(r?18:16,WALL_H+8,r?16:18);o.updateMatrix();im2.setMatrixAt(i,o.matrix);});
  /* floodlight poles along the inside of the wall, lit for the evening */
  const pole=new THREE.MeshStandardMaterial({color:lin(0x3A3C3E),roughness:0.6,metalness:0.6}),lamp=new THREE.MeshStandardMaterial({color:0xFFF2D0,emissive:0xFFD590,emissiveIntensity:3});
  const pts=[];for(let x=400;x<IW;x+=900)pts.push([x,40],[x,IH-40]);for(let z=500;z<IH;z+=900)pts.push([40,z],[IW-40,z]);
  const ip=add(new THREE.InstancedMesh(new THREE.BoxGeometry(4,110,4),pole,pts.length)),il=new THREE.InstancedMesh(new THREE.BoxGeometry(16,6,10),lamp,pts.length);world.add(il);
  pts.forEach(([x,z],i)=>{o.position.set(x,55,z);o.rotation.set(0,0,0);o.scale.set(1,1,1);o.updateMatrix();ip.setMatrixAt(i,o.matrix);const a=Math.atan2(IH/2-z,IW/2-x);o.position.set(x+Math.cos(a)*6,110,z+Math.sin(a)*6);o.rotation.set(0.5,-a+Math.PI/2,0);o.updateMatrix();il.setMatrixAt(i,o.matrix);
   const s=new THREE.Sprite(new THREE.SpriteMaterial({map:T.glow,color:0xFFC880,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0.8}));s.position.set(x+Math.cos(a)*10,108,z+Math.sin(a)*10);s.scale.set(60,60,1);world.add(s);});}
 /* hangars: steel sheds with a gabled roof and a striped door */
 for(const q of OBS.filter(q=>q.k==='hang')){const g=new THREE.Group(),w=q.rot?q.d:q.w,d=q.rot?q.w:q.d;const wm=new THREE.MeshStandardMaterial({map:T.hang,roughness:0.7,metalness:0.4,envMapIntensity:0.45});
  g.add(MESH(boxUV(new THREE.BoxGeometry(w,q.h,d),3,1),wm,0,q.h/2,0));const sh=new THREE.Shape();sh.moveTo(-d/2-4,0);sh.lineTo(d/2+4,0);sh.lineTo(0,28);sh.closePath();
  const rf=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:w+8,bevelEnabled:false}),new THREE.MeshStandardMaterial({color:lin(0x4A4E52),roughness:0.55,metalness:0.6}));rf.rotation.y=Math.PI/2;rf.position.set(-w/2-4,q.h,0);g.add(rf);
  const dm=new THREE.MeshStandardMaterial({map:T.door,roughness:0.7,metalness:0.5});for(const s of [-1,1])g.add(MESH(new THREE.BoxGeometry(2,q.h*0.75,d*0.55),dm,s*(w/2+1),q.h*0.375,0));
  for(const s of [-1,1]){const lp=MESH(new THREE.BoxGeometry(3,3,8),M3.lamp,s*(w/2+2),q.h*0.85,0);g.add(lp);}
  addShadow(g,true,true);g.position.set(q.x,0,q.z);g.rotation.y=q.rot?Math.PI/2:0;world.add(g);}
 /* bunkers: concrete blocks with a firing slit and a steel door */
 {const cm=new THREE.MeshStandardMaterial({map:T.conc,roughness:0.92});for(const q of OBS.filter(q=>q.k==='bunk')){const g=new THREE.Group();
  g.add(MESH(new THREE.BoxGeometry(q.w,q.h,q.d),cm,0,q.h/2,0),MESH(new THREE.BoxGeometry(q.w+8,4,q.d+8),cm,0,q.h+2,0),MESH(new THREE.BoxGeometry(q.w*0.6,3,1.5),std(0x101010,1,0),0,q.h*0.7,q.d/2+0.6),
   MESH(new THREE.BoxGeometry(14,q.h*0.65,1.5),new THREE.MeshStandardMaterial({map:T.door,roughness:0.7,metalness:0.5}),q.w*0.3,q.h*0.33,-q.d/2-0.6));addShadow(g,true,true);g.position.set(q.x,0,q.z);world.add(g);}}
 /* lines of jersey blocks */
 {const L_=OBS.filter(q=>q.k==='blk');let n=0;for(const q of L_)n+=q.n;const im=add(new THREE.InstancedMesh(new THREE.BoxGeometry(32,11,10),new THREE.MeshStandardMaterial({map:T.blk,roughness:0.9}),n));let i=0;
  for(const q of L_)for(let k=0;k<q.n;k++){const off=-((q.n-1)*34)/2+k*34;o.position.set(q.x+(q.rot?0:off),5.5,q.z+(q.rot?off:0));o.rotation.set(0,q.rot?Math.PI/2:0,(rn()-0.5)*0.03);o.scale.set(1,1,1);o.updateMatrix();im.setMatrixAt(i++,o.matrix);}}
 /* outside the walls: wasteland with factory silhouettes, cranes and stacks against the sunset */
 {const dm=new THREE.MeshStandardMaterial({color:lin(0x3A3632),roughness:0.9}),ds=[];
  for(let i=0;i<90;i++){const a=rn()*6.28,d=1500+rn()*4200,x=IW/2+Math.cos(a)*(IW/2+d),z=IH/2+Math.sin(a)*(IH/2+d*0.8);const k=rn();ds.push([x,z,k<0.2?[30,240+rn()*160,30]:k<0.6?[200+rn()*300,60+rn()*120,140+rn()*200]:[120,30+rn()*40,400]]);}
  const im=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),dm,ds.length);ds.forEach(([x,z,s],i)=>{o.position.set(x,s[1]/2,z);o.rotation.set(0,rn()*1.5,0);o.scale.set(...s);o.updateMatrix();im.setMatrixAt(i,o.matrix);});world.add(im);
  for(let i=0;i<5;i++){const a=rn()*6.28,d=1200+rn()*1600,x=IW/2+Math.cos(a)*(IW/2+d),z=IH/2+Math.sin(a)*(IH/2+d*0.8),g=new THREE.Group();g.add(MESH(new THREE.BoxGeometry(14,260,14),dm,0,130,0),MESH(new THREE.BoxGeometry(260,12,10),dm,60,262,0),MESH(new THREE.BoxGeometry(4,120,4),dm,170,200,0));g.position.set(x,0,z);g.rotation.y=rn()*6;world.add(g);}}
 /* props from the military set near obstacles and bases: angular things only */
 if(MIL){const kinds={box:['Box_003',10],box2:['Box_005',13],box3:['Box_022',12],hog:['Hedgehog_001',9],gen:['Generator_004',15],tow:['Tower_003',26]},pl={};for(const k in kinds)pl[k]=[];
  for(let n=0,i=0;i<6000&&n<(isMob?70:110);i++){const q=OBS[Math.floor(rn()*OBS.length)];if(!q||q.k==='blk')continue;const sd=Math.floor(rn()*4),x=q.x+(sd<2?(sd?1:-1)*(q.w/2+16):(rn()-0.5)*q.w*0.8),z=q.z+(sd>=2?(sd===3?1:-1)*(q.d/2+16):(rn()-0.5)*q.d*0.8);
   if(blockedAt(x,z,6)||x<150||z<150||x>IW-150||z>IH-150||nearBase(x,z,400)||nearMine(x,z,160))continue;n++;const k=['box','box','box2','box3','hog','gen'][Math.floor(rn()*6)];pl[k].push([x,z,rn()*6]);}
  for(let n=0,i=0;i<2000&&n<10;i++){const x=300+rn()*(IW-600),z=300+rn()*(IH-600);if(blockedAt(x,z,60)||nearBase(x,z,600)||nearMine(x,z,250))continue;if(pl.tow.some(t=>Math.hypot(t[0]-x,t[1]-z)<900))continue;n++;pl.tow.push([x,z,rn()*6]);}
  for(const k in kinds){const L_=pl[k];if(!L_.length)continue;const [name,len]=kinds[k];let baked;try{const hold=new THREE.Group();hold.add(milProp(name,len,null));baked=bakeGroup(hold);}catch(e){continue;}
   for(const {geo,mat} of baked){const im=add(new THREE.InstancedMesh(geo,mat,L_.length));L_.forEach(([x,z,r],i)=>{o.position.set(x,0,z);o.rotation.set(0,r,0);o.scale.set(1,1,1);o.updateMatrix();im.setMatrixAt(i,o.matrix);});}}}
 /* bases, artillery batteries, mines */
 for(const s of [0,1]){const [bx,bz]=BASES[s];const hq=mkHQ0(s);hq.position.set(bx,0,bz);hq.rotation.y=s===0?0:Math.PI;world.add(hq);
  for(let k=-1;k<=1;k++){const g=mkGun(s);const gx=bx+(s===0?-170:170),gz=bz+k*80;g.position.set(gx,0,gz);g.rotation.y=s===0?0:Math.PI;world.add(g);BATT[s].push(g);}}
 MINE_O.length=0;for(const m of G_.mines){const ob=mkMine(m.s);ob.position.set(m.x,0,m.z);world.add(ob);MINE_O.push(ob);}
 /* clouds lit by the low sun */
 for(let i=0;i<22;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.cloud,transparent:true,depthWrite:false,fog:false,opacity:0.8,color:0xE0A080}));const a=rn()*6.28,d=2500+rn()*4000;
  s.position.set(IW/2+Math.cos(a)*d,1300+rn()*900,IH/2+Math.sin(a)*d);s.scale.set(1800+rn()*1400,420+rn()*260,1);s.userData.v=6+rn()*8;s.userData.cloud=1;world.add(s);}
 world.traverse(q=>{if(q.material&&q.material.isMeshStandardMaterial&&q.material.envMapIntensity===1)q.material.envMapIntensity=0.45;});}
/* command bunker: stacked concrete blocks, steel doors, a mast and a team flag */
function mkHQ0(s){const g=new THREE.Group(),t=TEAM3(s),T=yardTextures(),cm=new THREE.MeshStandardMaterial({map:T.conc,roughness:0.9}),tm=std(t.m,0.55,0.35),dm=new THREE.MeshStandardMaterial({map:T.door,roughness:0.7,metalness:0.5});
 g.add(MESH(new THREE.BoxGeometry(170,8,140),cm,0,4,0),MESH(new THREE.BoxGeometry(130,34,110),cm,0,25,0),MESH(new THREE.BoxGeometry(80,22,70),cm,-10,53,0),MESH(new THREE.BoxGeometry(134,4,114),tm,0,43,0),
  MESH(new THREE.BoxGeometry(2,24,40),dm,66,22,0),MESH(new THREE.BoxGeometry(70,3,1.5),std(0x101010,1,0),-10,58,35.6),MESH(new THREE.BoxGeometry(3,3,8),M3.lamp,67,38,26),MESH(new THREE.BoxGeometry(3,3,8),M3.lamp,67,38,-26));
 for(let k=0;k<5;k++)g.add(MESH(new THREE.BoxGeometry(4,22,4),std(0x3A3C3E,0.6,0.6),-30,75+k*22,-20));g.add(MESH(new THREE.BoxGeometry(1.5,26,40),tm,-30,170,-40),MESH(new THREE.BoxGeometry(24,6,24),std(0x4A4E52,0.5,0.6),20,67,0));
 return addShadow(g,true,true);}
function mkGun(s){const g=new THREE.Group(),M=mats(s),T=yardTextures();g.add(MESH(new THREE.BoxGeometry(26,4,26),new THREE.MeshStandardMaterial({map:T.conc,roughness:0.9}),0,2,0));const tu=new THREE.Group();tu.position.y=4;
 tu.add(BOX(14,7,12,M.dark,0,3.5,0));const b=new THREE.Mesh(new THREE.BoxGeometry(32,3.2,3.2),M.gun);b.rotation.z=0.6;b.position.set(12,14,0);tu.add(b);g.add(tu);g.userData.tu=tu;g.userData.b=b;return addShadow(g,true,true);}
/* crystal mine: a square pit framed in concrete, hazard rails, crystals sticking out */
const CRYS=[0,1].map(s=>new THREE.MeshStandardMaterial({color:lin(s?0xFF6A5A:0x7FC8FF),emissive:lin(s?0xD82A1A:0x2A80E8),emissiveIntensity:0.9,roughness:0.15,metalness:0.1}));
function mkMine(s){const g=new THREE.Group(),T=yardTextures(),cm=new THREE.MeshStandardMaterial({map:T.conc,roughness:0.9}),hz=new THREE.MeshStandardMaterial({map:T.door,roughness:0.7,metalness:0.4});
 for(const [x,z,w,d] of [[0,-52,124,16],[0,52,124,16],[-54,0,16,88],[54,0,16,88]])g.add(MESH(new THREE.BoxGeometry(w,6,d),cm,x,3,z));
 g.add(MESH(new THREE.BoxGeometry(92,1,88),std(0x1A1612,1,0),0,0.6,0));
 for(const [x,z,r] of [[0,-62,0],[0,62,0],[-64,0,1],[64,0,1]]){const rl=MESH(new THREE.BoxGeometry(r?2:120,3,r?96:2),hz,x,12,z);g.add(rl);for(let k=-2;k<=2;k++)g.add(MESH(new THREE.BoxGeometry(2,12,2),std(0x2A2A2A,0.6,0.6),x+(r?0:k*28),6,z+(r?k*22:0)));}
 for(let i=0;i<12;i++){const c=new THREE.Mesh(new THREE.OctahedronGeometry(5+(i%3)*2.4,0),CRYS[s]);c.position.set(((i*37)%70)-35,6+(i%3)*5,((i*53)%66)-33);c.scale.y=2.4;c.rotation.set((i%3-1)*0.35,i,(i%2-0.5)*0.5);g.add(c);}
 g.add(MESH(new THREE.BoxGeometry(6,40,6),std(0x3A3C3E,0.6,0.6),-60,20,-58),MESH(new THREE.BoxGeometry(70,5,5),std(0xC9A020,0.6,0.5),-28,40,-58));
 return addShadow(g,true,true);}
function mapImage(){const w=400,h=250,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#6C665C';x.fillRect(0,0,w,h);const k=w/IW;
 x.strokeStyle='rgba(120,98,70,0.9)';x.lineWidth=2;for(const pl of ROADS_I){x.beginPath();pl.forEach((p,i)=>{i?x.lineTo(p[0]*k,p[1]*k):x.moveTo(p[0]*k,p[1]*k);});x.stroke();}
 for(const o of OBS){x.fillStyle=o.k==='c'?'#3E3A36':o.k==='hang'?'#2E3236':o.k==='bunk'?'#56524C':'#8A857A';x.fillRect((o.x-o.w/2)*k,(o.z-o.d/2)*k,Math.max(1,o.w*k),Math.max(1,o.d*k));}
 x.strokeStyle='#22201E';x.lineWidth=3;x.strokeRect(1.5,1.5,w-3,h-3);return c;}

/* ================== game state ================== */
let G_=null;const BATT=[[],[]],MINE_O=[];
function newGame(){CUR='titan';spawnPlane();PR.length=0;ART.sh.length=0;ART.cd=0;MIS.length=0;MIS_CD=0;LK.u=null;LK.t=0;spawnDrone();G_={t:0,over:null,id:1,sides:[mkSide(),mkSide()],units:[],towers:[],harv:[],kills:[0,0],mines:MINES_AT.map(([x,z],i)=>({x,z,s:x<IW/2?0:1,lives:MINE_LIVES,acc:0,dead:false,i})),marks:new Set()};
 for(const s of [0,1]){const [bx,bz]=BASES[s],d=s===0?1:-1;
  for(const [k,ox,oz] of [['mg',260,-120],['can',300,60],['rkt',220,170],['mg',330,220]])addTower(s,k,bx+d*ox,bz+oz);
}
 P.dead=0;spawnTitan();}
function mkSide(){return{ore:START_ORE,lives:LIVES,queue:[],qcd:0,grp:null,grpT:-99,botT:0,wave:600,twT:20};}
function addTower(s,k,x,z){const t={id:G_.id++,s,k,lv:1,x,z,hp:TWS[k].hp,mx:TWS[k].hp,cd:0.5,a:s===0?0:Math.PI};G_.towers.push(t);return t;}
function addHarv(s){const [bx,bz]=BASES[s];const h={id:G_.id++,s,x:bx+(s?-140:140),z:bz+(G_.harv.length%3-1)*40,hp:HARV.hp,mx:HARV.hp,st:'idle',load:0,t:0,path:null,pi:0,m:null,a:0};G_.harv.push(h);return h;}
function sendUnit(s,k){const S=G_.sides[s],c=US[k].cost;if(S.ore<c)return false;S.ore-=c;S.queue.push(k);return true;}
function buyHarv(s){const S=G_.sides[s];if(S.ore<HARV.cost||G_.harv.filter(h=>h.s===s).length>=6)return false;S.ore-=HARV.cost;addHarv(s);return true;}
/* each burst of units takes its own way: a random point on our side, one of the passes (or a random crossing), a random point on theirs */
function groupPath(s,air,G){const [bx,bz]=BASES[s],[ex,ez]=G,d=s===0?1:-1;const st=[bx+d*170,bz+(rn()-0.5)*160];
 if(air){const mid=[IW/2+(rn()-0.5)*1200,IH*0.15+rn()*IH*0.7];return chaikin([st,mid,[ex,ez]],3);}
 const g=GAPS[Math.floor(rn()*GAPS.length)],v2=[IW/2,g+(rn()-0.5)*160],mid=(a,b,k,j)=>[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k+(rn()-0.5)*j];
 const v1=mid(st,v2,0.45+rn()*0.2,900),v3=mid(v2,[ex,ez],0.4+rn()*0.2,900);
 const seed=1+rn()*900,pts=[st,v1,v2,v3,[ex,ez]];let path=[];for(let i=0;i<pts.length-1;i++){const p=astar(pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],seed);path=path.concat(i?p.slice(1):p);}
 return chaikin(path,2);}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function enemiesOf(s){return G_.units.filter(u=>u.s!==s&&!u.dead);}
function dmgUnit(u,d,by){if(u.dead)return;u.hp-=d;if(u.hp<=0){u.dead=true;const st=US[u.k];if(by!=null)G_.sides[by].ore+=st.rw*2;deathFx(u);}}
function dmgTower(t,d,by){t.hp-=d;if(t.hp<=0&&!t.dead){t.dead=true;explode(t.x,hgt(t.x,t.z)+8,t.z,1.8);if(by!=null)G_.sides[by].ore+=TWS[t.k].cost*0.25;}}
function dmgHarv(h,d,by){h.hp-=d;if(h.hp<=0&&!h.dead){h.dead=true;explode(h.x,hgt(h.x,h.z)+5,h.z,1.4);if(by!=null)G_.sides[by].ore+=500+(h.load?300:0);}}
function hitBase(s,n){const S=G_.sides[s];if(S.lives<=0)return;S.lives=Math.max(0,S.lives-n);const [bx,bz]=BASES[s];explode(bx+(rn()-0.5)*60,hgt(bx,bz)+20,bz+(rn()-0.5)*60,1.4);if(S.lives<=0)explode(bx,hgt(bx,bz)+30,bz,3);checkOver(s);}
function checkOver(s){if(!G_.over&&G_.sides[s].lives<=0&&!G_.mines.some(m=>m.s===s&&!m.dead))G_.over={w:1-s};}
function hitMine(m,n){if(m.dead)return;m.lives=Math.max(0,m.lives-n);explode(m.x+(rn()-0.5)*60,14,m.z+(rn()-0.5)*50,1.2);if(m.lives<=0){m.dead=true;explode(m.x,20,m.z,2.6);checkOver(m.s);}}
function dmgMine(m,d){if(m.dead)return;m.acc+=d;while(m.acc>=MINE_HP&&!m.dead){m.acc-=MINE_HP;hitMine(m,1);}}
const nearMineOf=(s,x,z,r)=>G_.mines.find(m=>m.s===s&&!m.dead&&Math.hypot(m.x-x,m.z-z)<r);
function tracer(a,b,c){tracers.push({id:++SID,a,b,t:0.06,c:c||0xFFE070});}
/* the nearest enemy something can shoot at */
function pickGoal(s){const o=G_.mines.filter(m=>m.s!==s&&!m.dead).map(m=>({k:'m',m}));if(G_.sides[1-s].lives>0||!o.length)o.push({k:'b'},{k:'b'});return o[Math.floor(rn()*o.length)];}
function goalXY(s,g){if(g.k==='m')return [g.m.x,g.m.z];const [ex,ez]=BASES[1-s];return [ex-(s===0?1:-1)*90,ez];}
function repath(u){u.goal=pickGoal(u.s);const [gx,gz]=goalXY(u.s,u.goal);u.path=US[u.k].air?chaikin([[u.x,u.z],[gx,gz]],2):chaikin(astar(u.x,u.z,gx,gz,u.id%7),2);u.pi=1;}
function pickTarget(s,x,z,rng,hitAir,hitGround,mines){let best=null,bd=rng;
 for(const u of G_.units){if(u.dead||u.s===s)continue;const air=US[u.k].air;if(air?!hitAir:!hitGround)continue;const d=Math.hypot(u.x-x,u.z-z);if(d<bd){bd=d;best={k:'u',o:u};}}
 if(hitGround){for(const t of G_.towers){if(t.dead||t.s===s)continue;const d=Math.hypot(t.x-x,t.z-z)-10;if(d<bd){bd=d;best={k:'t',o:t};}}
  for(const h of G_.harv){if(h.dead||h.s===s)continue;const d=Math.hypot(h.x-x,h.z-z);if(d<bd){bd=d;best={k:'h',o:h};}}
  if(s===1&&P.dead<=0){const d=Math.hypot(P.x-x,P.z-z)-14;if(d<bd){bd=d;best={k:'p'};}}}
 if(s===1&&hitAir&&F.dead<=0){const d=Math.hypot(F.x-x,F.z-z)+40;if(d<bd){bd=d;best={k:'f'};}}
 if(s===1&&hitAir&&D.dead<=0){const d=Math.hypot(D.x-x,D.z-z)+60;if(d<bd){bd=d;best={k:'d'};}}
 if(!best&&mines)for(const m of G_.mines){if(m.dead||m.s===s)continue;const d=Math.hypot(m.x-x,m.z-z)-60;if(d<bd){bd=d;best={k:'m',o:m};}}
 return best;}
const tpos=tg=>tg.k==='f'?[F.x,F.y,F.z]:tg.k==='d'?[D.x,D.y,D.z]:tg.k==='p'?[P.x,hgt(P.x,P.z)+14,P.z]:tg.k==='u'?[tg.o.x,tg.o.y+6,tg.o.z]:tg.k==='t'?[tg.o.x,hgt(tg.o.x,tg.o.z)+14,tg.o.z]:tg.k==='m'?[tg.o.x+(rn()-0.5)*60,10,tg.o.z+(rn()-0.5)*50]:[tg.o.x,hgt(tg.o.x,tg.o.z)+7,tg.o.z];
function applyHit(tg,d,by){if(tg.k==='u')dmgUnit(tg.o,d,by);else if(tg.k==='t')dmgTower(tg.o,d,by);else if(tg.k==='h')dmgHarv(tg.o,d,by);else if(tg.k==='m'){if(!(TESTW.on&&by===1))dmgMine(tg.o,d);}else if(tg.k==='p'){P.hp-=d;P.hurt=0.25;}else if(tg.k==='d'){D.hp-=d;D.hurt=0.25;}else if(tg.k==='f'){F.hp-=d;F.hurt=0.25;}}
function splash(s,x,z,r,d,by){for(const u of G_.units){if(u.dead||u.s===s||US[u.k].air)continue;const k=Math.hypot(u.x-x,u.z-z);if(k<r)dmgUnit(u,d*(k<r*0.5?1:0.6),by);}
 for(const h of G_.harv){if(!h.dead&&h.s!==s&&Math.hypot(h.x-x,h.z-z)<r)dmgHarv(h,d,by);}}

function stepGame(dt){if(G_.over)return;G_.t+=dt;
 for(const s of [0,1]){const S=G_.sides[s];S.ore+=BASE_INC*dt;for(const m of G_.mines)if(m.s===s&&!m.dead)S.ore+=MINE_INC*dt;
  S.qcd-=dt;if(S.queue.length&&S.qcd<=0){const k=S.queue.shift();const air=US[k].air;if(!S.grp||G_.t-S.grpT>5||S.grpAir!==air){S.goal=pickGoal(s);S.grp=groupPath(s,air,goalXY(s,S.goal));S.grpAir=air;S.grpN=0;}S.grpT=G_.t;S.grpN++;
   const [bx,bz]=BASES[s];const st=US[k];const u={id:G_.id++,s,k,x:S.grp[0][0],z:S.grp[0][1],y:0,hp:st.hp,mx:st.hp,path:S.grp,goal:S.goal,pi:1,cd:rn(),off:((S.grpN%5)-2)*14,tg:null,scan:rn()*0.3,a:s===0?0:Math.PI};
   u.y=st.air?hgt(u.x,u.z)+ALT[k]:hgt(u.x,u.z);G_.units.push(u);S.qcd=0.55;}}
 /* units: shoot what is in range, otherwise keep going */
 for(const u of G_.units){if(u.dead)continue;const st=US[u.k];u.cd-=dt;u.scan-=dt;
  if(u.scan<=0){u.scan=0.3;u.tg=pickTarget(u.s,u.x,u.z,st.rng,st.hitAir,true,true);}
  const [ex,ez]=BASES[1-u.s];
  if(G_.sides[1-u.s].lives>0&&Math.hypot(u.x-ex,u.z-ez)<150){u.dead=true;u.breach=true;if(!(TESTW.on&&u.s===1))hitBase(1-u.s,st.lives);continue;}
  if(u.goal&&(u.goal.k==='m'?u.goal.m.dead:G_.sides[1-u.s].lives<=0)&&G_.mines.some(m=>m.s!==u.s&&!m.dead)){u.rp=(u.rp==null?rn()*0.8:u.rp)-dt;if(u.rp<=0){u.rp=null;repath(u);}}
  let tg=u.tg;if(tg&&((tg.o&&tg.o.dead)||(tg.k==='p'&&P.dead>0)))tg=u.tg=null;
  if(tg){const [tx,ty,tz]=tpos(tg);u.ga=Math.atan2(tz-u.z,tx-u.x);if(u.cd<=0){u.cd=st.cd;if(st.splash){splash(u.s,tx,tz,st.splash,st.dmg,u.s);if(tg.k!=='u'&&tg.k!=='h')applyHit(tg,st.dmg,u.s);explode(tx,ty-4,tz,0.45);}else applyHit(tg,st.dmg*(tg.k==='p'?0.4:1),u.s);
    if(Math.hypot(u.x-cam.position.x,u.z-cam.position.z)<1400)tracer([u.x,u.y+8,u.z],[tx,ty,tz],u.s===0?0x9FD0FF:0xFFC070);}
   if(!st.air)continue;}
  /* follow the path */
  const p=u.path,t=p[Math.min(u.pi,p.length-1)];const dx=t[0]-u.x,dz=t[1]-u.z,d=Math.hypot(dx,dz);if(d<20&&u.pi<p.length-1){u.pi++;continue;}
  const sl=st.air?0:slope(u.x,u.z),v=st.sp*USPK*(tg&&st.air?0.35:1)*(1-Math.min(0.6,sl*0.8))*dt;const a=Math.atan2(dz,dx);
  const ox=-Math.sin(a)*u.off*0.02,oz=Math.cos(a)*u.off*0.02;u.x+=Math.cos(a)*v+ox*v;u.z+=Math.sin(a)*v+oz*v;u.a=a;
  const gy=hgt(u.x,u.z);u.y=st.air?u.y+(Math.max(gy,0)+ALT[u.k]-u.y)*Math.min(1,dt*1.5):gy;}
 for(const u of G_.units)if(u.dead&&!u.cnt){u.cnt=1;if(!u.breach)G_.kills[u.s]++;}
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
  else if(h.st==='mine'){h.t-=dt;if(h.t<=0){const take=Math.min(HARV.load,h.m.ore);h.m.ore-=take;h.load=take;h.st='back';h.path=chaikin(astar(h.x,h.z,bx+(h.s?-140:140),bz,0,0.5),2);h.pi=1;}}}
 G_.harv=G_.harv.filter(h=>!h.dead);
 bot(1,dt);testWaves(dt);}

/* ---------- the bot: harvesters first, waves of mixed units, towers on its side ---------- */
function bot(s,dt){const S=G_.sides[s];S.botT-=dt;if(S.botT>0)return;S.botT=1.2;
 S.twT-=1.2;if(S.twT<=0&&S.ore>900){S.twT=30;const [bx,bz]=BASES[s],d=s===0?1:-1;const k=['mg','can','rkt','tes'][Math.floor(rn()*4)];
  for(let i=0;i<30;i++){const x=bx+d*(250+rn()*900),z=bz+(rn()-0.5)*1600;if(blockedAt(x,z,30)||x<150||x>IW-150||z<150||z>IH-150)continue;if(G_.towers.some(t=>Math.hypot(t.x-x,t.z-z)<120))continue;S.ore-=TWS[k].cost;addTower(s,k,x,z);break;}}
 if(S.ore>=S.wave){const mix=['jeep','tank','heli','jeep','tank','heli'];let n=0;while(n<12){const k=mix[Math.floor(rn()*mix.length)];if(!sendUnit(s,k))break;n++;}S.wave=500+rn()*900;}}

/* ================== drawing the game state ================== */
const live=new Map();let FR=0;
/* Tripo models: red jeep and red tank, each with a blue repaint for our side; nose along +Z like the military pack */
const XM={jeep:{f:'rjeep.glb',len:21,sides:[0,1],blue:'jeep_blue.jpg'},tank:{f:'rtank.glb',len:30,sides:[0,1],blue:'tank_blue.jpg'},
 heli:{f:'rheli.glb',len:46,sides:[0,1],blue:'heli_blue.jpg',hub:[0,0.372,0.105],rr:0.44,dy:-7}};
if(THREE.GLTFLoader)for(const k in XM){const m=XM[k];new THREE.GLTFLoader().load(m.f,g=>{g.scene.traverse(o=>{if(o.isMesh){o.material.envMapIntensity=0.5;if(o.material.map)o.material.map.anisotropy=4;}});
  if(m.blue)new THREE.TextureLoader().load(m.blue,t=>{t.flipY=false;t.encoding=THREE.sRGBEncoding;t.anisotropy=4;m.bt=t;});m.sc=g.scene;},undefined,e=>console.error(m.f,e));}
const xmOK=(k,s)=>{const m=XM[k];return !!(m&&m.sc&&m.sides.includes(s)&&(s===1||!m.blue||m.bt));};
function buildXM(k,s){const m=XM[k],root=new THREE.Group();const c=m.sc.clone(true);if(s===0&&m.blue)c.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.map=m.bt;}});
 c.updateMatrixWorld(true);const bb=new THREE.Box3().setFromObject(c),sz=bb.getSize(new THREE.Vector3()),sc=m.len/Math.max(sz.x,sz.z);
 const off=new THREE.Vector3(-(bb.min.x+bb.max.x)/2,-bb.min.y,-(bb.min.z+bb.max.z)/2);root.add(part('body',wrap(c,sc,off)));
 if(m.hub){/* main rotor: our own spinning blades + a faint blur disc around the hub the model keeps */
  const k=sc/Math.max(sz.x,sz.z)*Math.max(sz.x,sz.z),h=m.hub,px=(h[0]+off.x)*sc,py=(h[1]+off.y)*sc,pz=(h[2]+off.z)*sc,R_=m.rr*sc;
  const g=new THREE.Group();g.name='rot';g.position.set(pz,py,-px);
  const dark=new THREE.MeshStandardMaterial({color:lin(0x34363A),roughness:0.6,metalness:0.4}),tip=new THREE.MeshStandardMaterial({color:lin(s?0xD8281C:0x2F7FE0),roughness:0.5,metalness:0.2});
  for(let i=0;i<4;i++){const b=new THREE.Group();b.rotation.y=i*Math.PI/2;
   const bl=new THREE.Mesh(new THREE.BoxGeometry(R_*0.92,0.35,R_*0.085),dark);bl.position.x=R_*0.5;bl.rotation.x=0.06;b.add(bl);
   const t1=new THREE.Mesh(new THREE.BoxGeometry(R_*0.09,0.4,R_*0.09),tip);t1.position.x=R_*0.9;b.add(t1);
   const t2=new THREE.Mesh(new THREE.BoxGeometry(R_*0.05,0.4,R_*0.09),tip);t2.position.x=R_*0.72;b.add(t2);g.add(b);}
  const disc=new THREE.Mesh(new THREE.RingGeometry(R_*0.12,R_,40),new THREE.MeshBasicMaterial({color:lin(0x2A2C30),transparent:true,opacity:0.16,depthWrite:false,side:THREE.DoubleSide}));disc.rotation.x=-Math.PI/2;disc.position.y=0.1;g.add(disc);
  root.add(g);}
 if(m.dy)root.children.forEach(ch=>ch.position.y+=m.dy);
 return root;}
/* ================== unit deaths: one big blast per cluster, burning wrecks, falling helicopters ==================
   own particle pool (not the shared one, so gunfire never eats a death blast); nothing is drawn for what the camera can't see */
const FXP=[],FXMAX=isMob?150:260,FXPOOLS={},BLQ=[],RINGS=[],DEBR=[],WRK=[],FALL=[],DKM=new Map();
const RING_G=new THREE.RingGeometry(0.75,1,48),DEB_G=new THREE.BoxGeometry(1,1,1),DEB_M=new THREE.MeshStandardMaterial({color:0x1E1C1A,roughness:0.9,metalness:0.3});
const FRU=new THREE.Frustum(),FRM=new THREE.Matrix4(),FSP=new THREE.Sphere();let FRU_F=-1;
function seen(x,y,z,r){if(FRU_F!==FR){cam.updateMatrixWorld();FRM.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse);FRU.setFromProjectionMatrix(FRM);FRU_F=FR;}
 FSP.center.set(x,y,z);FSP.radius=r;return cam.position.distanceTo(FSP.center)<3600+r&&FRU.intersectsSphere(FSP);}
function fxSprite(map,add){const k=map.uuid+(add?'a':'n');const pl=FXPOOLS[k]||(FXPOOLS[k]=[]);let s=pl.pop();
 if(!s){s=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false,blending:add?THREE.AdditiveBlending:THREE.NormalBlending}));s.userData.pk=k;}s.visible=false;scene.add(s);return s;}
function fxFree(s){scene.remove(s);FXPOOLS[s.userData.pk].push(s);}
function fxP(o){if(FXP.length>=FXMAX)fxFree(FXP.shift().s);FXP.push(o);}
function fire(x,y,z,r0,r1,T,vx,vy,vz,h,l,add,a,drag){const s=fxSprite(TX.fire,add);s.material.color.setHSL(h,1,l);fxP({s,x,y,z,vx,vy,vz,r0,r1,t:0,T,a,drag});}
function smoke(x,y,z,r0,r1,T,vx,vy,vz,g,t0,a,drag){const s=fxSprite(TX.smoke);s.material.color.setRGB(g,g,g);fxP({s,x,y,z,vx,vy,vz,r0,r1,t:t0||0,T,a,drag});}
const UR={tank:55,jeep:42,heli:48,inf:12};
function deathFx(u){if(u.k==='heli'){startFall(u);return;}queueBlast(u.x,u.y,u.z,UR[u.k]||30);makeWreck(u,u.x,u.y,u.z);}
/* deaths close together within a moment merge into one bigger blast */
function queueBlast(x,y,z,R){for(const b of BLQ)if(Math.hypot(b.x-x,b.z-z)<180){b.x=(b.x*b.n+x)/(b.n+1);b.z=(b.z*b.n+z)/(b.n+1);b.n++;b.R=Math.max(b.R,R);return;}BLQ.push({x,y,z,R,n:1,t:0.12});}
function bigBlast(x,y,z,S){if(Math.hypot(x-P.x,z-P.z)<S*5&&CUR==='titan')P.shake=Math.max(P.shake||0,0.9);
 if(!seen(x,y+S*0.5,z,S*3))return;
 flash.position.set(x,y+S*0.6,z);flash.intensity=Math.max(flash.intensity,6);
 for(let i=0;i<4;i++)fire(x+(rn()-0.5)*S*0.4,y+S*0.4,z+(rn()-0.5)*S*0.4,S*1.1,S*(2.8+rn()*0.6),0.4+rn()*0.2,0,S*0.4,0,0.1,0.7,true,1,0);
 for(let i=0;i<8;i++){const a=rn()*6.28,v=S*(0.8+rn()*1.2);fire(x,y+S*0.3,z,S*0.8,S*(1.9+rn()*0.8),0.8+rn()*0.5,Math.cos(a)*v,S*(0.6+rn()*1.2),Math.sin(a)*v,0.04+rn()*0.06,0.55,i%3===0,1,2.6);}
 for(let i=0;i<7;i++){const a=rn()*6.28,v=S*(0.3+rn()*0.6);const g=0.1+rn()*0.1;smoke(x+(rn()-0.5)*S*0.6,y+S*0.5,z+(rn()-0.5)*S*0.6,S*1.2,S*(3.6+rn()*1.2),2.8+rn()*1.2,Math.cos(a)*v,S*(0.4+rn()*0.5),Math.sin(a)*v,g,-0.15-rn()*0.35,0.85,1.1);}
 const ring=new THREE.Mesh(RING_G,new THREE.MeshBasicMaterial({map:TX.smoke,color:0xFFC080,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(x,Math.max(1,hgt(x,z)+1.5),z);scene.add(ring);RINGS.push({m:ring,t:0,S});
 for(let i=0;i<7;i++){if(DEBR.length>70){const d=DEBR.shift();scene.remove(d.m);}const m=new THREE.Mesh(DEB_G,DEB_M);const sc=S*(0.04+rn()*0.07);m.scale.set(sc,sc*0.6,sc*1.3);const a=rn()*6.28,v=S*(1+rn()*1.6);m.position.set(x,y+S*0.4,z);scene.add(m);
  DEBR.push({m,vx:Math.cos(a)*v,vy:S*(1.6+rn()*1.6),vz:Math.sin(a)*v,sx:rn()*8,sz:rn()*8,t:0});}
 const sm=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:TX.dark,transparent:true,depthWrite:false,opacity:0.75,polygonOffset:true,polygonOffsetFactor:-6}));sm.rotation.x=-Math.PI/2;sm.scale.set(S*2.2,S*2.2,1);sm.position.set(x,Math.max(0.6,hgt(x,z)+0.6),z);scene.add(sm);scorch.push({m:sm,t:0});if(scorch.length>40){const o=scorch.shift();scene.remove(o.m);o.m.material.dispose();}}
/* the dead machine stays as a blackened, burning hulk for a few seconds, then sinks away */
function darken(o){o.traverse(m=>{if(!m.isMesh)return;let d=DKM.get(m.material.uuid);if(!d){d=m.material.clone();if(d.color)d.color.multiplyScalar(0.2);if(d.emissive)d.emissive.setRGB(0,0,0);DKM.set(m.material.uuid,d);}m.material=d;});}
function takeVisual(u){const e=u.vk&&live.get(u.vk);if(!e)return null;live.delete(u.vk);return e.o;}
function makeWreck(u,x,y,z,o){o=o||takeVisual(u);if(!o)return;darken(o);o.rotation.z=(rn()-0.5)*0.2;o.rotation.x=(rn()-0.5)*0.15;o.position.set(x,y,z);
 if(WRK.length>=14){const w=WRK.shift();dyn.remove(w.o);}WRK.push({o,x,y,z,t:0,T:7,R:UR[u.k]||30,b:0});}
function startFall(u){const R=UR.heli;if(seen(u.x,u.y,u.z,R*2)){for(let i=0;i<3;i++)fire(u.x,u.y,u.z,R*0.8,R*2,0.5,(rn()-0.5)*R,R*0.3,(rn()-0.5)*R,0.07,0.55,i<1,0.95,2);
  smoke(u.x,u.y,u.z,R*1,R*2.8,2,0,R*0.2,0,0.12,0,0.8,1);}
 const o=takeVisual(u),sp=40;if(!o){queueBlast(u.x,Math.max(0,hgt(u.x,u.z)),u.z,R);return;}
 FALL.push({u,o,x:u.x,y:u.y,z:u.z,vx:Math.cos(u.a)*sp,vz:Math.sin(u.a)*sp,vy:0,spin:(rn()<0.5?-1:1)*(2+rn()*1.5),t:0,tr:0});}
function stepFx(dt){
 for(let i=BLQ.length-1;i>=0;i--){const b=BLQ[i];b.t-=dt;if(b.t<=0){BLQ.splice(i,1);bigBlast(b.x,b.y,b.z,b.R*Math.min(2.3,1+0.32*(b.n-1)));}}
 for(let i=FALL.length-1;i>=0;i--){const f=FALL[i];f.t+=dt;f.vy=Math.max(-150,f.vy-70*dt);f.x+=f.vx*dt;f.z+=f.vz*dt;f.y+=f.vy*dt;const o=f.o;o.position.set(f.x,f.y,f.z);o.rotation.y+=f.spin*dt;o.rotation.z=Math.min(0.55,f.t*0.4);
  if(o.userData.rot)o.userData.rot.rotation.y+=dt*Math.max(4,20-f.t*8);
  f.tr-=dt;if(f.tr<=0){f.tr=0.07;if(seen(f.x,f.y,f.z,80)){smoke(f.x,f.y+6,f.z,28,90,1.8,0,8,0,0.1,0,0.85,1);if(rn()<0.7)fire(f.x,f.y+4,f.z,30,12,0.25,0,0,0,0.07,0.6,true,1,0);}}
  const gy=Math.max(0,hgt(f.x,f.z));if(f.y<=gy+3||f.t>8){FALL.splice(i,1);queueBlast(f.x,gy,f.z,UR.heli*1.2);o.rotation.z=0.35;makeWreck(f.u,f.x,gy-2,f.z,o);}}
 for(let i=WRK.length-1;i>=0;i--){const w=WRK[i];w.t+=dt;
  if(w.t<w.T-1.8){w.b-=dt;if(w.b<=0){w.b=0.2+rn()*0.1;if(seen(w.x,w.y+20,w.z,w.R*1.5)){fire(w.x+(rn()-0.5)*w.R*0.6,w.y+w.R*0.25,w.z+(rn()-0.5)*w.R*0.6,w.R*0.7,w.R*0.3,0.55,0,w.R*0.5,0,0.07,0.6,true,1,0);
   smoke(w.x+(rn()-0.5)*w.R*0.4,w.y+w.R*0.35,w.z+(rn()-0.5)*w.R*0.4,w.R*0.8,w.R*2.6,2.4,4,w.R*0.45,0,0.08+rn()*0.06,0,0.8,0.6);}}}
  else w.o.position.y=w.y-(w.t-(w.T-1.8))/1.8*w.R*0.9;
  if(w.t>=w.T){dyn.remove(w.o);WRK.splice(i,1);}}
 for(let i=RINGS.length-1;i>=0;i--){const r=RINGS[i];r.t+=dt;const k=r.t/0.5;if(k>=1){scene.remove(r.m);r.m.material.dispose();RINGS.splice(i,1);continue;}const sc=r.S*(0.4+2.8*Math.sqrt(k));r.m.scale.set(sc,sc,1);r.m.material.opacity=0.8*(1-k);}
 for(let i=DEBR.length-1;i>=0;i--){const d=DEBR[i];d.t+=dt;if(d.t>2.2){scene.remove(d.m);DEBR.splice(i,1);continue;}const m=d.m,gy=Math.max(0,hgt(m.position.x,m.position.z))+0.5;
  if(m.position.y>gy||d.vy>0){d.vy-=200*dt;m.position.x+=d.vx*dt;m.position.y+=d.vy*dt;m.position.z+=d.vz*dt;m.rotation.x+=d.sx*dt;m.rotation.z+=d.sz*dt;if(m.position.y<gy){m.position.y=gy;d.vy=0;d.vx=d.vz=0;}}
  if(d.t>1.6)m.position.y-=dt*6;}
 for(let i=FXP.length-1;i>=0;i--){const p=FXP[i];p.t+=dt;if(p.t<0){p.s.visible=false;continue;}p.s.visible=true;const k=p.t/p.T;if(k>=1){fxFree(p.s);FXP.splice(i,1);continue;}
  const dr=p.drag?Math.exp(-p.drag*dt):1;p.vx*=dr;p.vz*=dr;p.vy*=dr;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
  const r=p.r0+(p.r1-p.r0)*Math.sqrt(k);p.s.position.set(p.x,p.y,p.z);p.s.scale.set(r,r,1);p.s.material.opacity=p.a*(k<0.1?k/0.1:1)*(1-k);}}
function fxReset(){for(const p of FXP)fxFree(p.s);FXP.length=0;BLQ.length=0;for(const r of RINGS){scene.remove(r.m);r.m.material.dispose();}RINGS.length=0;for(const d of DEBR)scene.remove(d.m);DEBR.length=0;
 for(const w of WRK)dyn.remove(w.o);WRK.length=0;for(const f of FALL)dyn.remove(f.o);FALL.length=0;}
function sync(key,make,place){let e=live.get(key);if(!e){e={o:make()};dyn.add(e.o);live.set(key,e);}e.seen=FR;place(e.o,e);return e.o;}
/* a column of black smoke keeps rising from a destroyed mine or base: a fixed ring of sprites cycling upwards */
const SMOKE=new Map();
function smokeCol(key,x,z,y0,t){let c=SMOKE.get(key);if(!c){c={sp:[],fi:[]};for(let i=0;i<22;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.smoke,transparent:true,depthWrite:false}));const g=0.05+((i*37)%10)/200;s.material.color.setRGB(g,g,g);s.userData.ph=i/22;s.userData.j=[((i*53)%17-8)*3,((i*29)%13-6)*3];scene.add(s);c.sp.push(s);}
  for(let i=0;i<3;i++){const f=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.fire,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));f.material.color.setHSL(0.07,1,0.5);f.userData.ph=i/3;scene.add(f);c.fi.push(f);}SMOKE.set(key,c);}
 c.seen=FR;
 for(const s of c.sp){const k=(t*0.16+s.userData.ph)%1;const [jx,jz]=s.userData.j;s.position.set(x+jx+k*70,y0+k*230,z+jz+k*10);const r=34+k*150;s.scale.set(r,r,1);s.material.opacity=Math.min(1,k/0.06)*Math.pow(1-k,0.8);}
 for(const f of c.fi){const k=(t*1.3+f.userData.ph)%1;f.position.set(x+(f.userData.ph-0.5)*40,y0-4+k*18,z);const r=26*(1-k*0.6);f.scale.set(r,r,1);f.material.opacity=0.8*(1-k);}}
function smokeSweep(){for(const [k,c] of SMOKE)if(c.seen!==FR){for(const s of [...c.sp,...c.fi]){scene.remove(s);s.material.dispose();}SMOKE.delete(k);}}
function syncAll(t,dt){FR++;const cx=cam.position.x,cz=cam.position.z,far=2600;
 for(const m of G_.mines)if(m.dead)smokeCol('m'+m.i,m.x,m.z,8,t);
 for(const s of [0,1])if(G_.sides[s].lives<=0){const [bx,bz]=BASES[s];smokeCol('b'+s,bx,bz,hgt(bx,bz)+30,t);}
 smokeSweep();
 for(const u of G_.units){if(u.dead)continue;if(Math.abs(u.x-cx)+Math.abs(u.z-cz)>far*1.3)continue;
  const xm=xmOK(u.k,u.s);u.vk='u'+u.id+(xm?'x':'');sync(u.vk,()=>{const g=instantiate(proto('U'+u.k+u.s+(MIL?'m':'')+(xm?'x':''),()=>xm?buildXM(u.k,u.s):buildUnit(u.k,u.s)));{const k=u.k==='heli'?3:u.k==='tank'||u.k==='jeep'?4:1;if(k!==1)g.scale.multiplyScalar(k);}return g;},(o,e)=>{if(o.userData.a==null)o.userData.a=u.a;let d=u.a-o.userData.a;d=Math.atan2(Math.sin(d),Math.cos(d));o.userData.a+=d*Math.min(1,dt*6);
   o.position.set(u.x,u.y,u.z);o.rotation.y=-o.userData.a;if(o.userData.rot)o.userData.rot.rotation.y=t*28;if(o.userData.rot2)o.userData.rot2.rotation.z=t*40;if(o.userData.tur&&u.ga!=null)o.userData.tur.rotation.y=-(u.ga-o.userData.a);
   if(!US[u.k].air&&u.k!=='inf'&&!u.tg){e.dust=(e.dust||0)-dt;if(e.dust<=0){e.dust=0.3;puff(u.x-Math.cos(u.a)*14,u.y+1.5,u.z-Math.sin(u.a)*14,'dust');}}});}
 for(const h of G_.harv){if(Math.abs(h.x-cx)+Math.abs(h.z-cz)>far*1.3)continue;sync('h'+h.id,()=>instantiate(proto('H'+h.s,()=>buildHarv(h.s))),o=>{o.position.set(h.x,hgt(h.x,h.z)+0.4,h.z);if(o.userData.a==null)o.userData.a=h.a;let d=h.a-o.userData.a;d=Math.atan2(Math.sin(d),Math.cos(d));o.userData.a+=d*Math.min(1,dt*5);o.rotation.y=-o.userData.a;});}
 for(const tw of G_.towers){if(Math.abs(tw.x-cx)+Math.abs(tw.z-cz)>far*1.5)continue;sync('t'+tw.id,()=>{const g=instantiate(proto('T'+tw.k+tw.s+(MIL?'m':''),()=>buildTower(tw.k,tw.s,1)));g.scale.setScalar(1.3);return g;},o=>{o.position.set(tw.x,hgt(tw.x,tw.z),tw.z);const tu=o.userData.tur;if(tu)tu.rotation.y=tw.k==='tes'?t*1.6:-tw.a;});}
 for(const s of shells)sync('s'+s.id,()=>{const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.glow,color:0xFFE2A0,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));sp.scale.set(7,7,1);return sp;},o=>o.position.set(s.x,s.y,s.z));
 for(const tr of tracers)sync('T'+tr.id,()=>{const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);return new THREE.Line(g,new THREE.LineBasicMaterial({color:tr.c,transparent:true,opacity:0.9,blending:THREE.AdditiveBlending}));},o=>{const a=o.geometry.attributes.position;a.setXYZ(0,...tr.a);a.setXYZ(1,...tr.b);a.needsUpdate=true;a.needsUpdate=true;o.geometry.computeBoundingSphere();});
 for(const [k,e] of live)if(e.seen!==FR){dyn.remove(e.o);if(e.o.isSprite||e.o.isLine){e.o.material.dispose();if(e.o.isLine)e.o.geometry.dispose();}live.delete(k);}
 for(const m of G_.mines){const o=MINE_O[m.i];if(o){const n=Math.ceil(12*m.lives/MINE_LIVES);let j=0;for(const c of o.children)if(c.geometry&&c.geometry.type==='OctahedronGeometry')c.visible=(j++)<n;}}}

/* ================== the player's Titan: drives, shoots by itself when a target sits in the sight ================== */
const shells=[],tracers=[];let SID=0;
const cockScene=new THREE.Scene(),cockRoot=new THREE.Group();cockScene.add(cockRoot,new THREE.HemisphereLight(0xD8E4F0,0x4A5038,0.7));{const l=new THREE.DirectionalLight(0xFFEBC8,1.5);l.position.set(-0.5,0.8,0.4);cockScene.add(l);}
const cock=new THREE.Group();cockRoot.add(cock);const barrel=new THREE.Group();cock.add(barrel);
{const b=CYL(1.9,2.4,44,std(0x2C3036,0.4,0.7),24,0,0,0);b.rotation.x=Math.PI/2;b.position.set(0,-7.5,-28);barrel.add(b);
 const fe=CYL(2.8,2.8,7,std(0x2C3036,0.4,0.7),24,0,0,0);fe.rotation.x=Math.PI/2;fe.position.set(0,-7.5,-34);barrel.add(fe);
 const mz=CYL(3.4,3.4,6,std(0x1C2024,0.5,0.6),24,0,0,0);mz.rotation.x=Math.PI/2;mz.position.set(0,-7.5,-50);barrel.add(mz);
 const sl=CYL(3,3.2,9,std(0x3A4048,0.5,0.6),24,0,0,0);sl.rotation.x=Math.PI/2;sl.position.set(0,-7.5,-10);barrel.add(sl);}
function spawnTitan(){const [bx,bz]=BASES[0];P.x=bx+240;P.z=bz+10;P.yaw=0;P.pitch=-0.05;P.hp=P.max;P.move=false;P.dead=0;P.cd=0;}
function titanBlocked(x,z){if(x<70||z<70||x>IW-70||z>IH-70||blockedAt(x,z,16))return true;for(const t of G_.towers)if(Math.hypot(t.x-x,t.z-z)<30)return true;for(const [bx,bz] of BASES)if(Math.hypot(bx-x,bz-z)<110)return true;for(const m of G_.mines)if(Math.hypot(m.x-x,m.z-z)<80)return true;return false;}
let LOCK=null;
function stepTitan(dt){if(P.dead>0){P.dead-=dt;if(P.dead<=0)spawnTitan();return;}
 P.cd=Math.max(0,P.cd-dt);P.scd=Math.max(0,P.scd-dt);P.rec=Math.max(0,P.rec-dt*4);P.shake=Math.max(0,P.shake-dt*2);P.hurt=Math.max(0,(P.hurt||0)-dt);
 if(P.move){const sl=slope(P.x,P.z),v=TITAN.sp*(1-Math.min(0.5,sl*0.6))*dt,nx=P.x+Math.cos(P.yaw)*v,nz=P.z+Math.sin(P.yaw)*v;if(!titanBlocked(nx,nz)){P.x=nx;P.z=nz;}else if(!titanBlocked(nx,P.z))P.x=nx;else if(!titanBlocked(P.x,nz))P.z=nz;P.bob+=dt*7;}
 P.x=Math.max(50,Math.min(IW-50,P.x));P.z=Math.max(50,Math.min(IH-50,P.z));
 /* automatic fire: the first enemy close to the centre of the sight */
 const o=new THREE.Vector3(P.x,Math.max(hgt(P.x,P.z),0)+26,P.z),d=new THREE.Vector3(Math.cos(P.yaw)*Math.cos(P.pitch),Math.sin(P.pitch),Math.sin(P.yaw)*Math.cos(P.pitch));const cone=TITAN.cone/P.zoom;LOCK=null;let best=cone;
 const test=(x,y,z,tg,sz=12)=>{const vx=x-o.x,vy=y-o.y,vz=z-o.z,L=Math.hypot(vx,vy,vz);if(L>TITAN.range||L<20)return;const a=Math.acos(Math.max(-1,Math.min(1,(vx*d.x+vy*d.y+vz*d.z)/L)))-Math.atan(sz/L);if(a<best){best=a;LOCK={tg,x,y,z};}};
 for(const u of G_.units){if(u.dead||u.s===0||US[u.k].air)continue;test(u.x,u.y+(u.k==='heli'?6:14),u.z,{k:'u',o:u},u.k==='inf'?12:u.k==='heli'?30:40);}
 for(const t of G_.towers){if(t.s===0)continue;test(t.x,hgt(t.x,t.z)+12,t.z,{k:'t',o:t});}
 for(const h of G_.harv){if(h.s===0)continue;test(h.x,hgt(h.x,h.z)+7,h.z,{k:'h',o:h});}
 if(G_.sides[1].lives>0){const [bx,bz]=BASES[1];test(bx,hgt(bx,bz)+20,bz,{k:'b'});}
 for(const m of G_.mines){if(m.s===0||m.dead)continue;test(m.x,10,m.z,{k:'m',o:m});}
 if(G_.over||CUR!=='titan')LOCK=null;
 if(LOCK&&P.cd<=0){P.cd=TITAN.cd;shoot(LOCK.x,LOCK.y,LOCK.z,LOCK.tg);}
 if(P.hp<=0){P.hp=0;P.dead=TITAN.respawn;P.move=false;G_.sides[1].ore+=TITAN.bounty;explode(P.x,hgt(P.x,P.z),P.z,2.6);HUD.msg('Титан уничтожен — возрождение через 5 с');}}
/* the painted cockpit: twin barrels at the bottom of the screen; shells leave from the tip of the barrel whose turn it is */
/* cockpit skins: the barrels picture, where its two muzzles are (fractions of the picture) and its aspect */
const SKINS=[{img:'ti_barrels.webp',tips:[[0.347,0.03],[0.652,0.03]],ar:649/1732},{img:'ti_barrels2.webp',tips:[[0.359,0.056],[0.64,0.056]],ar:531/1734}];
let SKIN=0;try{SKIN=Math.min(SKINS.length-1,Math.max(0,+localStorage.getItem('dvebazy-skin')||0));}catch(_){}
let GUN=0,TIPS=SKINS[SKIN].tips;
function placeGun(){const el=document.getElementById('tiGun');if(!el)return;const sk=SKINS[SKIN];el.style.bottom=Math.min(0,0.40*innerHeight-innerWidth*sk.ar)+'px';}
function setSkin(i){SKIN=(i+SKINS.length)%SKINS.length;TIPS=SKINS[SKIN].tips;const el=document.getElementById('tiGun');if(el)el.src=SKINS[SKIN].img;placeGun();try{localStorage.setItem('dvebazy-skin',''+SKIN);}catch(_){}}
addEventListener('resize',placeGun);
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
 {const m=s.tg&&s.tg.k==='m'&&!s.tg.o.dead?s.tg.o:nearMineOf(1,s.tx,s.tz,80);if(m&&!G_.over&&(!s.sup||rn()<0.35))hitMine(m,1);}
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
#h3 .map{display:none!important;right:max(14px,env(safe-area-inset-right));top:12px;padding:0 14px;height:40px}
#h3 .units{display:none!important;position:absolute;top:12px;left:50%;transform:translateX(-50%);display:flex;gap:6px}
#h3 .units .b{position:static;width:60px;height:40px;font-size:12px;flex-direction:column;line-height:1.1}
#h3 .units .b.dis{opacity:.45}
#h3 .stat{display:none!important;position:absolute;left:max(10px,env(safe-area-inset-left));top:126px;font-size:13px;background:rgba(12,18,14,.5);border-radius:12px;padding:6px 12px;line-height:1.35}
#tiCock{position:absolute;inset:0;pointer-events:none;overflow:hidden}
#tiFrame{position:absolute;left:0;top:0;width:100%;height:auto;max-height:46vh;object-fit:fill}
#tiGun{position:absolute;left:0;width:100%;height:auto;bottom:0;transition:transform .1s}
#tiCock .fl{position:absolute;width:13vh;height:13vh;margin:-6.5vh 0 0 -6.5vh;border-radius:50%;background:radial-gradient(circle,rgba(255,240,190,1) 0,rgba(255,170,60,.85) 30%,rgba(255,120,20,0) 70%);opacity:0;transition:opacity .05s}
#h3 img.sight{position:absolute;left:50%;top:50%;height:46vh;transform:translate(-50%,-50%);opacity:.92;transition:filter .15s}
#h3 img.sight.lock{filter:hue-rotate(-115deg) saturate(1.6)}
#h3 svg.xh{position:absolute;left:50%;top:50%;width:150px;height:150px;margin:-75px 0 0 -75px;overflow:visible}
#h3 .hp{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);width:min(300px,38vw);height:10px;border-radius:6px;background:rgba(0,0,0,.45);overflow:hidden;border:1px solid rgba(255,255,255,.3)}
#h3 .hp i{display:block;height:100%;background:linear-gradient(90deg,#5FD068,#A8F07A)}
#h3 .rl{position:absolute;left:50%;bottom:34px;transform:translateX(-50%);font-size:12px;opacity:.9;letter-spacing:.5px}
#h3 .fps{position:absolute;right:max(14px,env(safe-area-inset-right));top:100px;font-size:12px;opacity:.85;background:rgba(12,18,14,.5);border-radius:8px;padding:2px 8px}
#h3 .msg{position:absolute;left:50%;top:28%;white-space:nowrap;transform:translateX(-50%);background:rgba(12,18,14,.7);border-radius:12px;padding:8px 16px;font-size:16px;display:none}
#h3 .frame{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 46%,transparent 62%,rgba(5,8,6,.5) 100%)}
#h3 .hurt{position:absolute;inset:0;transition:box-shadow .15s}
#h3 .mini{position:absolute;left:max(8px,env(safe-area-inset-left));top:8px;width:144px;height:90px;opacity:.72;border-radius:10px;border:1.5px solid rgba(255,255,255,.3);pointer-events:auto}
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
<div class="stat"><div class="s1"></div></div><div class="score"><div class="sd l"><b class="sc0"></b><div class="bar"><i class="sb0"></i></div></div><div class="stm">00:00</div><div class="sd r"><div class="bar"><i class="sb1"></i></div><b class="sc1"></b></div></div>
<div class="units"></div><div class="b map">Карта</div><div class="fps"></div><canvas class="mini" width="300" height="188"></canvas>
<div class="b go">Старт</div><div class="b sup">Залп<span style="font-size:11px"></span></div><div class="hp"><i></i></div><div class="rl"></div><div class="msg"></div>`;
document.body.appendChild(H);
const q=s=>H.querySelector(s);
const UK=[['jeep','Джип'],['tank','Танк'],['heli','Верт.']];
q('.units').innerHTML=UK.map(([k,n])=>`<div class="b" data-k="${k}">${n}<span></span></div>`).join('');
const lob=document.createElement('div');lob.id='lobby';lob.innerHTML=`<div class="card"><h1>Две базы: Полигон</h1><p>3D-прототип. У каждой стороны база и 3 рудника — рудники сами приносят кристаллы. Победа — уничтожить все рудники и базу врага. Титан, дрон и самолёт стреляют сами, когда цель в прицеле.</p><button id="bPlay">Играть</button><a href="./">← Обычная игра</a></div>`;
document.body.appendChild(lob);
const over=document.createElement('div');over.id='over';over.innerHTML=`<div class="t"></div><button>Ещё раз</button>`;document.body.appendChild(over);
let lastHp=P.max;
const HUD={msgT:0,k:0,msg(s){},kick(){this.k=0.12;},
 upd(dt){const S=G_.sides[0],E=G_.sides[1];q('.s1').innerHTML=`💎 ${Math.floor(S.ore)}`;{const all=LIVES+3*MINE_LIVES;for(const s of [0,1]){const L=G_.sides[s].lives,ms=G_.mines.filter(m=>m.s===s);const tot=L+ms.reduce((a,m)=>a+m.lives,0),n=ms.filter(m=>!m.dead).length;q('.sc'+s).innerHTML=s?`<small>◆${n}</small> ${L}`:`${L} <small>◆${n}</small>`;q('.sb'+s).style.width=(100*tot/all)+'%';}}q('.stm').textContent='💎 '+Math.floor(S.ore);
  q('.hp i').style.width=(100*Math.max(0,VEH().hp)/VEH().max).toFixed(1)+'%';if(CUR==='plane')q('.rl').textContent='';else if(CUR==='drone')q('.rl').textContent=LK.u&&LK.t>0.25&&D.dead<=0?'захват цели… '+Math.max(0,LOCK_T-LK.t).toFixed(1)+' с':'';else q('.rl').textContent='';
  q('.rld').setAttribute('stroke-dasharray',(170*(1-P.cd/TITAN.cd)).toFixed(1)+' 170');q('.lk').setAttribute('display','none');{const im=q('img.sight');if(im)im.classList.toggle('lock',!!LOCK);const g=document.getElementById('tiGun');if(g&&g.offsetWidth){const r=g.getBoundingClientRect();for(const k of [0,1]){const f=document.getElementById('tiFl'+k);f.style.left=(r.left+r.width*TIPS[k][0])+'px';f.style.top=(r.top+r.height*TIPS[k][1])+'px';}}}
  q('.sup span').textContent=P.scd>0?Math.ceil(P.scd)+' с':'';q('.sup').classList.toggle('cd',P.scd>0);
  q('.hurt').style.boxShadow='inset 0 0 120px rgba(200,20,10,'+(P.hurt>0?0.5:0)+')';
  q('.go').textContent=VEH().move?'Стоп':'Старт';q('.go').classList.toggle('on',VEH().move);
  for(const el of q('.units').children){const k=el.dataset.k,c=k==='harv'?HARV.cost:US[k].cost;el.lastChild.textContent=c;el.classList.toggle('dis',S.ore<c);}
  {let a0=0,a1=0;for(const u of G_.units)if(!u.dead){if(u.s)a1++;else a0++;}
  q('.fps').innerHTML=Math.round(T3.fps)+' к/с · ×'+T3.q.toFixed(2)+'<br>Враги: '+a1+' на карте · '+G_.kills[1]+' уничтожено'+(a0||G_.kills[0]?'<br>Наши: '+a0+' на карте · '+G_.kills[0]+' уничтожено':'');}
  if(this.msgT>0){this.msgT-=dt;if(this.msgT<=0)q('.msg').style.display='none';}this.k=Math.max(0,this.k-dt);}};
const tapBtn=(el,fn)=>el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();fn(e);});
tapBtn(q('.go'),()=>{const v=VEH();v.move=!v.move;});tapBtn(q('.sup'),()=>CUR==='plane'?planeRockets():superShot());
tapBtn(q('.map'),()=>openMap());tapBtn(q('.mini'),()=>openMap());
for(const el of q('.units').children)tapBtn(el,()=>{const k=el.dataset.k;if(k==='harv'){if(buyHarv(0))HUD.msg('Харвестер выехал');}else sendUnit(0,k);});
document.getElementById('bPlay').onclick=()=>{lob.hidden=true;start();try{if(innerWidth<innerHeight||!document.fullscreenElement)document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen().catch(()=>{});}catch(_){}};
over.querySelector('button').onclick=()=>{over.style.display='none';start();};

/* ---------- tactical map: the island from above; enemies only where something of ours sees them ---------- */
const TM=document.createElement('div');TM.id='tmap';TM.innerHTML='<canvas></canvas><button class="x">◀ В кабину</button>';document.body.appendChild(TM);
TM.querySelector('.x').onclick=()=>{TM.style.display='none';T3.map=false;};
let MAPIMG=null;
function seenBy0(x,z){if(F.dead<=0&&Math.hypot(x-F.x,z-F.z)<VIS*1.4)return true;if(D.dead<=0&&Math.hypot(x-DL.x,z-DL.z)<DL.r)return true;if(Math.hypot(x-BASES[0][0],z-BASES[0][1])<900)return true;if(P.dead<=0&&Math.hypot(x-P.x,z-P.z)<VIS*1.3)return true;
 for(const u of G_.units)if(u.s===0&&!u.dead&&Math.hypot(u.x-x,u.z-z)<VIS)return true;for(const t of G_.towers)if(t.s===0&&Math.hypot(t.x-x,t.z-z)<VIS)return true;for(const m of G_.mines)if(m.s===0&&!m.dead&&Math.hypot(m.x-x,m.z-z)<VIS)return true;for(const h of G_.harv)if(h.s===0&&Math.hypot(h.x-x,h.z-z)<VIS*0.8)return true;return false;}
function drawMap(cv,big){const c=cv.getContext('2d'),W=cv.width,Hh=cv.height;c.fillStyle='#22313A';c.fillRect(0,0,W,Hh);const k=Math.min(W/IW,Hh/IH)*(big?0.96:1),ox=(W-IW*k)/2,oz=(Hh-IH*k)/2;
 if(!MAPIMG)MAPIMG=mapImage();c.drawImage(MAPIMG,ox,oz,IW*k,IH*k);const X=x=>ox+x*k,Z=z=>oz+z*k,dot=(x,z,r,col)=>{c.fillStyle=col;c.beginPath();c.arc(X(x),Z(z),r,0,7);c.fill();};
 const f=big?1:0.6;
 for(const m of G_.mines){c.fillStyle=m.dead?'#445':m.s?'#FF5A4A':'#4AA8FF';c.save();c.translate(X(m.x),Z(m.z));c.rotate(Math.PI/4);c.fillRect(-5*f,-5*f,10*f,10*f);c.restore();if(big){c.fillStyle='#fff';c.font='700 11px Rubik,system-ui';c.textAlign='center';c.fillText(m.dead?'✕':m.lives,X(m.x),Z(m.z)+18);}}
 for(const s of [0,1]){const [bx,bz]=BASES[s];c.fillStyle=s?'#E04A3A':'#3E86E0';c.fillRect(X(bx)-9*f,Z(bz)-9*f,18*f,18*f);c.strokeStyle='#fff';c.lineWidth=2;c.strokeRect(X(bx)-9*f,Z(bz)-9*f,18*f,18*f);}
 for(const t of G_.towers){if(t.s===1&&!t.mk&&!seenBy0(t.x,t.z))continue;c.fillStyle=t.s?'#FF7A60':'#8CC0F0';c.beginPath();c.moveTo(X(t.x),Z(t.z)-6*f);c.lineTo(X(t.x)+5*f,Z(t.z)+4*f);c.lineTo(X(t.x)-5*f,Z(t.z)+4*f);c.fill();}
 for(const h of G_.harv){if(h.s===1&&!h.mk&&!seenBy0(h.x,h.z))continue;dot(h.x,h.z,3.5*f,h.s?'#FFB060':'#F2C232');}
 for(const u of G_.units){if(u.dead)continue;if(u.s===1&&!u.mk&&!seenBy0(u.x,u.z))continue;dot(u.x,u.z,(US[u.k].air?3:2.6)*f,u.s?'#FF5040':'#77B3EE');}
 if(D.dead<=0){c.strokeStyle='rgba(120,255,140,0.55)';c.lineWidth=big?1.5:1;c.beginPath();c.arc(X(DL.x),Z(DL.z),DL.r*k,0,7);c.stroke();c.save();c.translate(X(D.x),Z(D.z));c.rotate(D.yaw+Math.PI/4);c.fillStyle='#9CFFAA';c.fillRect(-4*f,-4*f,8*f,8*f);c.restore();}
 for(const a of ART.sh){c.fillStyle='#FFB040';c.beginPath();c.arc(X(a.x),Z(a.z),2.5*f,0,7);c.fill();}
 if(F.dead<=0){c.save();c.translate(X(F.x),Z(F.z));c.rotate(F.yaw);c.fillStyle='#FFE27A';c.beginPath();c.moveTo(9*f,0);c.lineTo(-5*f,7*f);c.lineTo(-2*f,0);c.lineTo(-5*f,-7*f);c.fill();c.restore();}
 if(P.dead<=0){c.save();c.translate(X(P.x),Z(P.z));c.rotate(P.yaw);c.fillStyle='#FFFFFF';c.beginPath();c.moveTo(10*f,0);c.lineTo(-6*f,6*f);c.lineTo(-3*f,0);c.lineTo(-6*f,-6*f);c.fill();c.restore();
  if(big){c.strokeStyle='rgba(255,255,255,0.25)';c.beginPath();c.arc(X(P.x),Z(P.z),VIS*1.3*k,0,7);c.stroke();}}}
function openMap(){T3.map=true;P.move=false;TM.style.display='block';}
function mapLoop(){const cv=TM.querySelector('canvas');const r=TM.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1);if(cv.width!==Math.round(r.width*d)){cv.width=Math.round(r.width*d);cv.height=Math.round(r.height*d);}drawMap(cv,true);}

/* ---------- look: one finger turns, two fingers zoom ---------- */
const ptr=new Map();let pinch0=0,zoom0=1;
const TAP={};cv3.addEventListener('pointerdown',e=>{try{cv3.setPointerCapture(e.pointerId);}catch(_){}ptr.set(e.pointerId,[e.clientX,e.clientY]);TAP[e.pointerId]={x:e.clientX,y:e.clientY,t:performance.now(),m:0,n:ptr.size};if(ptr.size===2){const [a,b]=[...ptr.values()];pinch0=Math.hypot(a[0]-b[0],a[1]-b[1]);zoom0=VEH().zoom;}});
cv3.addEventListener('pointermove',e=>{const p=ptr.get(e.pointerId);if(!p)return;const dx=e.clientX-p[0],dy=e.clientY-p[1];ptr.set(e.pointerId,[e.clientX,e.clientY]);
 if(TAP[e.pointerId])TAP[e.pointerId].m+=Math.abs(dx)+Math.abs(dy);
 if(CUR==='plane'){if(ptr.size===1){const k=0.0045/F.zoom;F.ty+=dx*k;F.pitch=Math.max(-0.75,Math.min(0.25,F.pitch-dy*k*0.8));}else if(ptr.size===2&&pinch0>0){const [a,b]=[...ptr.values()];F.zoom=Math.max(1,Math.min(3,zoom0*Math.hypot(a[0]-b[0],a[1]-b[1])/pinch0));}return;}
 if(CUR==='drone'){if(ptr.size===1){const k=0.004/D.zoom;D.yaw+=dx*k;D.pitch=Math.max(-1.45,Math.min(-28*Math.PI/180,D.pitch-dy*k*0.8));}else if(ptr.size===2&&pinch0>0){const [a,b]=[...ptr.values()];D.zoom=Math.max(1,Math.min(4,zoom0*Math.hypot(a[0]-b[0],a[1]-b[1])/pinch0));}return;}
 if(ptr.size===1){const k=0.0055/P.zoom;P.yaw+=dx*k;P.pitch=Math.max(-0.35,Math.min(0.25,P.pitch-dy*k*0.8));}
 else if(ptr.size===2&&pinch0>0){const [a,b]=[...ptr.values()];P.zoom=Math.max(1,Math.min(3.5,zoom0*Math.hypot(a[0]-b[0],a[1]-b[1])/pinch0));}});
for(const n of ['pointerup','pointercancel'])cv3.addEventListener(n,e=>{const tp=TAP[e.pointerId];delete TAP[e.pointerId];ptr.delete(e.pointerId);if(ptr.size<2)pinch0=0;
 if(n==='pointerup'&&tp&&tp.n===1&&tp.m<12&&performance.now()-tp.t<380&&CUR==='drone')artTap(e.clientX,e.clientY);});
cv3.addEventListener('wheel',e=>{e.preventDefault();if(CUR==='plane'){F.zoom=Math.max(1,Math.min(3,F.zoom*(e.deltaY<0?1.12:1/1.12)));return;}if(CUR==='drone'){D.zoom=Math.max(1,Math.min(4,D.zoom*(e.deltaY<0?1.12:1/1.12)));return;}P.zoom=Math.max(1,Math.min(3.5,P.zoom*(e.deltaY<0?1.12:1/1.12)));},{passive:false});
const keys=new Set();addEventListener('keydown',e=>{keys.add(e.code);if(e.code==='KeyW')VEH().move=true;if(e.code==='KeyS')VEH().move=false;if(e.code==='Digit1')setVeh('titan');if(e.code==='Digit2')setVeh('drone');if(e.code==='Digit3')setVeh('plane');if(e.code==='KeyM')T3.map?TM.querySelector('.x').click():openMap();if(e.code==='Space'){e.preventDefault();superShot();}});addEventListener('keyup',e=>keys.delete(e.code));

/* ---------- start and main loop ---------- */
function size(){const w=innerWidth,h=innerHeight;R.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();postSize();}
addEventListener('resize',size);
let BUILT=false;
function start(){CUR='drone';if(!BUILT){genYard(1234);buildNav();planRoads();}newGame();if(!BUILT||MIL_DIRTY){for(const e of live.values())dyn.remove(e.o);live.clear();buildWorld();BUILT=true;MIL_DIRTY=false;MAPIMG=null;}
 fxReset();for(const e of live.values())dyn.remove(e.o);live.clear();cv3.style.display='block';H.style.display='block';size();running=true;CUR='drone';setVeh('titan');}
let running=false,MIL_DIRTY=false,last=performance.now();
function loop(now_){requestAnimationFrame(loop);const dt=Math.min(0.05,(now_-last)/1000);last=now_;if(!running)return;
 if(T3.map){mapLoop();stepGame(dt);stepTitan(dt);stepDrone(dt);stepPlane(dt);stepArt(dt);stepShells(dt);return;}
 if(T3.applyQ){T3.applyQ=false;R.setPixelRatio(T3.q);size();}/* resolution changes happen before drawing, so the canvas is never shown cleared */
 if(CUR==='plane'){if(keys.has('KeyA'))F.ty-=1.4*dt;if(keys.has('KeyD'))F.ty+=1.4*dt;}else{if(keys.has('KeyA'))VEH().yaw-=1.6*dt;if(keys.has('KeyD'))VEH().yaw+=1.6*dt;}
 const t=now_/1000;stepGame(dt);stepTitan(dt);stepDrone(dt);stepPlane(dt);stepArt(dt);stepShells(dt);syncAll(t,dt);syncDrone(t,dt);syncPlane(t);stepParts(dt);stepFx(dt);
 if(G_.over&&over.style.display!=='flex'){over.style.display='flex';over.querySelector('.t').textContent=G_.over.w===0?'Победа!':'Поражение';}
 if(ocean)ocean.material.normalMap.offset.set(t*0.004,-t*0.01);
 for(const c of world.children)if(c.userData.cloud){c.position.x+=c.userData.v*dt;if(c.position.x>IW+7000)c.position.x=-7000;}
 const gy=hgt(P.x,P.z),bob=P.move?Math.sin(P.bob)*0.6:0,sh=P.shake||0;const y=Math.max(gy,0)+(P.dead>0?90:26)+bob+(rn()-0.5)*sh*3;cam.position.set(P.x+(rn()-0.5)*sh*3,y,P.z);
 const lp=P.pitch+(HUD.k>0?HUD.k*0.22:0);cam.lookAt(P.x+Math.cos(P.yaw)*Math.cos(lp)*100,y+Math.sin(lp)*100,P.z+Math.sin(P.yaw)*Math.cos(lp)*100);
 const fov=P.fov/P.zoom;if(Math.abs(cam.fov-fov)>0.01){cam.fov=fov;cam.updateProjectionMatrix();}cock.visible=false;{const v=P.dead<=0&&P.zoom<1.6;const g=document.getElementById('tiCock');if(g)g.style.display=v?'block':'none';}barrel.position.z=P.rec*5;
 if(CUR==='drone')droneCam(dt);else if(CUR==='plane')planeCam();
 sky.position.copy(cam.position);{const cx=CUR==='drone'?DL.x:CUR==='plane'?F.x+Math.cos(F.yaw)*200:P.x+Math.cos(P.yaw)*150,cz=CUR==='drone'?DL.z:CUR==='plane'?F.z+Math.sin(F.yaw)*200:P.z+Math.sin(P.yaw)*150;sun.position.set(cx+SUN_DIR.x*700,SUN_DIR.y*700,cz+SUN_DIR.z*700);sun.target.position.set(cx,0,cz);}
 cam.updateMatrixWorld();stepLock(dt);HUD.upd(dt);droneHud(t);planeHud();markHud();if(PO.on){PO.fin.uniforms.mono.value=CUR==='drone'?1:0;PO.fin.uniforms.tm.value=t%100;}if(FR%6===0)drawMap(q('.mini'),false);cam.updateMatrixWorld();cockRoot.position.copy(cam.position);cockRoot.quaternion.copy(cam.quaternion);cockScene.environment=scene.environment;drawFrame();AUD.tick(dt);
 T3.fpsN++;T3.fpsT+=dt;if(T3.fpsT>=2){T3.fps=T3.fpsN/T3.fpsT;T3.fpsN=0;T3.fpsT=0;T3.warm=(T3.warm||0)+1;
  /* ignore the first seconds (shaders compiling); go down after two slow windows, up only after four fast ones and never soon after going down */
  if(T3.warm>2){T3.lowN=T3.fps<38?(T3.lowN||0)+1:0;T3.hiN=T3.fps>58?(T3.hiN||0)+1:0;let nq=T3.q;
   if(T3.lowN>=2&&T3.q>0.55){nq=Math.max(0.55,T3.q-0.15);T3.lowN=0;T3.downAt=now_;}
   else if(T3.hiN>=4&&T3.q<Math.min(2,devicePixelRatio||1)&&now_-(T3.downAt||-1e9)>30000){nq=Math.min(devicePixelRatio||1,T3.q+0.1);T3.hiN=0;}
   if(nq!==T3.q){T3.q=nq;T3.applyQ=true;try{localStorage.setItem('dvebazy-isleq',''+nq);}catch(_){}}
   if(T3.fps<26&&T3.q<=0.56&&R.shadowMap.enabled){R.shadowMap.enabled=false;scene.traverse(o=>{if(o.material)o.material.needsUpdate=true;});}}}}
requestAnimationFrame(loop);
window.__isle={OBS,prof:()=>{const T={};const m=(k,f)=>{const t=performance.now();f();T[k]=Math.round(performance.now()-t);};m("step",()=>stepGame(1/60));m("titan",()=>stepTitan(1/60));m("sync",()=>syncAll(performance.now()/1000,1/60));m("parts",()=>stepParts(1/60));m("mini",()=>drawMap(q(".mini"),false));m("hud",()=>HUD.upd(1/60));m("draw",()=>drawFrame());m("gl",()=>R.getContext().finish());return T;},dbg:()=>({running,map:T3.map,fr:FR,fps:T3.fps}),world:()=>world,stepGame,stepTitan,stepShells,ROADS:()=>ROADS_I,GAPS:()=>GAPS,P,get G(){return G_;},start,sendUnit,T3,superShot,get LOCK(){return LOCK;},hgt,openMap};

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
{const sb=document.createElement('div');sb.className='b snd';sb.style.cssText='right:max(14px,env(safe-area-inset-right));top:8px;width:44px;height:40px;font-size:18px';const upd=()=>sb.textContent=AUD.on?'🔊':'🔇';upd();H.appendChild(sb);
 tapBtn(sb,()=>{AUD.setOn(!AUD.on);upd();});}
{const kb=document.createElement('div');kb.className='b skin';kb.style.cssText='right:calc(max(14px,env(safe-area-inset-right)) + 52px);top:8px;padding:0 12px;height:40px;font-size:13px';const upd=()=>kb.textContent='Скин '+(SKIN+1)+'/'+SKINS.length;upd();H.appendChild(kb);
 tapBtn(kb,()=>{setSkin(SKIN+1);upd();});setSkin(SKIN);}
P.fov=90;
document.getElementById('bPlay').addEventListener('click',()=>AUD.init());over.querySelector('button').addEventListener('click',()=>AUD.init());
document.addEventListener('visibilitychange',()=>{if(!AUD.music)return;if(document.hidden)AUD.music.pause();else if(AUD.on&&running)AUD.music.play().catch(()=>{});});

SUN_DIR.set(-0.86,0.19,0.32).normalize();sun.color.setHex(0xFFB27A);sun.intensity=2.6;hemi.color.setHex(0x8C96C0);hemi.groundColor.setHex(0x5A4636);hemi.intensity=0.5;

/* ================== the drone: looks down at an angle, marks what it sees, calls in the base artillery ================== */
let CUR='titan';
const D={x:0,z:0,y:0,yaw:0,pitch:-0.95,move:false,hp:1500,max:1500,dead:0,zoom:1,alt:450,sp:150,hurt:0};
const DL={x:0,z:0,r:0};                       // the patch of ground the drone watches
const ART={cd:0,sh:[],CD:5,R:60,DMG:700,id:0};
const VEH=()=>CUR==='drone'?D:CUR==='plane'?F:P;
function spawnDrone(){const [bx,bz]=BASES[0];D.x=bx+120;D.z=bz;D.yaw=0;D.pitch=-0.95;D.hp=D.max;D.dead=0;D.move=false;D.zoom=1;}
function droneLook(){const k=1/Math.tan(-D.pitch),h=D.alt;return[D.x+Math.cos(D.yaw)*h*k,D.z+Math.sin(D.yaw)*h*k];}
function stepDrone(dt){if(D.dead>0){D.dead-=dt;if(D.dead<=0)spawnDrone();return;}
 D.hurt=Math.max(0,D.hurt-dt);
 /* real velocity of enemy units (smoothed), for leading the artillery */
 if(dt>0)for(const u of G_.units){if(u.s!==1||u.dead)continue;if(u.px!=null){const k=Math.min(1,dt*4);u.vx=(u.vx||0)+(((u.x-u.px)/dt)-(u.vx||0))*k;u.vz=(u.vz||0)+(((u.z-u.pz)/dt)-(u.vz||0))*k;}u.px=u.x;u.pz=u.z;}
 if(D.move){D.x+=Math.cos(D.yaw)*D.sp*dt;D.z+=Math.sin(D.yaw)*D.sp*dt;}
 D.x=Math.max(-150,Math.min(IW+150,D.x));D.z=Math.max(-150,Math.min(IH+150,D.z));D.y=D.alt+Math.sin(performance.now()/700)*1.5;
 const [lx,lz]=droneLook();DL.x=lx;DL.z=lz;DL.r=(D.alt/Math.sin(-D.pitch))*0.62/D.zoom+60;
 /* everything of the enemy inside that patch gets marked, for as long as it lives */
 for(const u of G_.units)if(u.s===1&&!u.dead&&!u.mk&&Math.hypot(u.x-lx,u.z-lz)<DL.r){u.mk=1;if(CUR==='drone')AUD.play('mark');}
 for(const t of G_.towers)if(t.s===1&&!t.mk&&Math.hypot(t.x-lx,t.z-lz)<DL.r)t.mk=1;
 for(const h of G_.harv)if(h.s===1&&!h.mk&&Math.hypot(h.x-lx,h.z-lz)<DL.r)h.mk=1;
 if(D.hp<=0){D.hp=0;D.dead=5;D.move=false;G_.sides[1].ore+=200;explode(D.x,D.y,D.z,1.2);if(CUR==='drone')HUD.msg('Дрон сбит — новый через 5 с');}}
function droneCam(dt){const [lx,lz]=[DL.x,DL.z];if(D.dead>0){const [bx,bz]=BASES[0];cam.position.set(bx-200,420,bz);cam.lookAt(bx+300,0,bz);}
 else{cam.position.set(D.x,D.y,D.z);cam.lookAt(D.x+Math.cos(D.yaw)*Math.cos(D.pitch)*100,D.y+Math.sin(D.pitch)*100,D.z+Math.sin(D.yaw)*Math.cos(D.pitch)*100);}
 const fov=56/D.zoom;if(Math.abs(cam.fov-fov)>0.01){cam.fov=fov;cam.updateProjectionMatrix();}}
/* ---------- artillery from the base battery ---------- */
function artTap(sx,sy){if(D.dead>0)return;if(ART.cd>0){HUD.msg('Артиллерия перезаряжается');return;}
 /* artillery always lands exactly under the finger */
 let x,z;{const r=new THREE.Vector3(sx/innerWidth*2-1,-(sy/innerHeight*2-1),0.5).unproject(cam).sub(cam.position).normalize();if(r.y>=-0.02)return;const k=-cam.position.y/r.y;x=cam.position.x+r.x*k;z=cam.position.z+r.z*k;}
 fireArt(x,z);}
const artTime=d=>1.6+d/2600;
function fireArt(x,z){ART.cd=ART.CD;BATT[0].forEach((g,i)=>{const gx=g.position.x,gz=g.position.z,a=Math.atan2(z-gz,x-gx);if(g.userData.tu)g.userData.tu.rotation.y=-a;
  const tx=x+(i-1)*22+(rn()-0.5)*14,tz=z+(rn()-0.5)*22,d=Math.hypot(tx-gx,tz-gz),T=artTime(d)+i*0.18;
  ART.sh.push({id:++ART.id,sx:gx,sy:18,sz:gz,tx,tz,x:gx,y:18,z:gz,t:-i*0.18,T,h:Math.min(900,180+d*0.22),tr:0});
  setTimeout(()=>{puff(gx+Math.cos(a)*16,22,gz+Math.sin(a)*16,'muzzle');AUD.play('cannon',gx,gz);},i*180);});
 HUD.msg('Артудар! Подлёт '+artTime(Math.hypot(x-BASES[0][0],z-BASES[0][1])).toFixed(1)+' с');
 const m=document.getElementById('drTgt');if(m){m.dataset.x=x;m.dataset.z=z;m.dataset.t=performance.now()+artTime(Math.hypot(x-BASES[0][0],z-BASES[0][1]))*1000+400;}}
function stepArt(dt){ART.cd=Math.max(0,ART.cd-dt);stepMissiles(dt);
 for(let i=ART.sh.length-1;i>=0;i--){const a=ART.sh[i];a.t+=dt;if(a.t<0)continue;const k=Math.min(1,a.t/a.T);a.x=a.sx+(a.tx-a.sx)*k;a.z=a.sz+(a.tz-a.sz)*k;a.y=a.sy*(1-k)+Math.sin(Math.PI*k)*a.h;
  a.tr-=dt;if(a.tr<=0){a.tr=0.05;puff(a.x,a.y,a.z,'trail');}
  if(k>=1){ART.sh.splice(i,1);artImpact(a.tx,a.tz);}}}
function artImpact(x,z){explode(x,0,z,1.9);P.shake=Math.max(P.shake||0,Math.hypot(x-P.x,z-P.z)<300?0.8:0);
 for(const u of G_.units){if(u.dead||u.s===0||US[u.k].air)continue;const d=Math.hypot(u.x-x,u.z-z);if(d<ART.R)dmgUnit(u,ART.DMG*(d<ART.R*0.5?1:0.55),0);}
 for(const t of G_.towers){if(t.s===0||t.dead)continue;if(Math.hypot(t.x-x,t.z-z)<ART.R*0.6+14)dmgTower(t,t.hp+1,0);}
 for(const h of G_.harv){if(h.s===0||h.dead)continue;if(Math.hypot(h.x-x,h.z-z)<ART.R)dmgHarv(h,ART.DMG,0);}
 if(!G_.over&&Math.hypot(x-BASES[1][0],z-BASES[1][1])<110)hitBase(1,1);
 {const m=nearMineOf(1,x,z,95);if(m&&!G_.over)hitMine(m,1);}}
/* ---------- the drone in the world (seen from the Titan), the shells in flight ---------- */
let DRONE_O=null;
function syncDrone(t,dt){if(!DRONE_O){const g=new THREE.Group(),M=mats(0);g.add(BOX(10,3,10,M.dark,0,0,0),BOX(4,3,4,M.gun,0,-2.5,3));for(const [x,z] of [[9,9],[-9,9],[9,-9],[-9,-9]]){g.add(BOX(12,1,1.6,M.gun,x/2,0.5,z/2));const r=BOX(9,0.3,1.2,M.gun,x,1.6,z);r.userData.spin=1;g.add(r);}addShadow(g,true,false);DRONE_O=g;dyn.add(g);}
 DRONE_O.visible=D.dead<=0&&CUR!=='drone';DRONE_O.position.set(D.x,D.y,D.z);DRONE_O.rotation.y=-D.yaw;DRONE_O.children.forEach(c=>{if(c.userData.spin)c.rotation.y=t*40;});
 for(const m of MIS)if(m.t>=0)sync('M'+m.id,()=>{const g=new THREE.Group();const b=new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.9,9,8),std(0xD8D8D0,0.5,0.4));b.rotation.z=Math.PI/2;g.add(b);const f=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.glow,color:0xFFB050,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));f.scale.set(10,10,1);f.position.x=-6;g.add(f);return g;},o=>{o.position.set(m.x,m.y,m.z);o.rotation.set(0,-Math.atan2(m.vz,m.vx),Math.atan2(m.vy,Math.hypot(m.vx,m.vz)));});
 for(const a of ART.sh)sync('a'+a.id,()=>{const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.glow,color:0xFFC070,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));sp.scale.set(14,14,1);return sp;},o=>{o.position.set(a.x,a.y,a.z);o.visible=a.t>=0;});}
/* ---------- HUD: vehicle switch, drone camera overlay, red markers over marked enemies ---------- */
{const st=document.createElement('style');st.textContent=`
#h3 .veh{position:absolute;left:50%;top:35px;transform:translateX(-50%);display:flex;gap:10px}
#h3 .veh .b{position:static;width:34px;height:34px;border-radius:50%;padding:0;border:2px solid #3EA6FF;background:radial-gradient(circle,rgba(20,40,70,.75),rgba(8,14,24,.8));box-shadow:0 0 10px rgba(62,166,255,.45)}
#h3 .veh .b svg{width:21px;height:21px;fill:#BFE0FF}
#h3 .veh .b.on{border-color:#F2C232;background:radial-gradient(circle,rgba(90,70,10,.8),rgba(30,22,4,.85));box-shadow:0 0 14px rgba(242,194,50,.7)}
#h3 .veh .b.on svg{fill:#FFE38A}
#h3 .score{position:absolute;left:50%;top:6px;transform:translateX(-50%);display:flex;align-items:stretch;height:24px;pointer-events:none;font:900 15px 'Rubik',system-ui,sans-serif}
#h3 .score .sd{display:flex;align-items:center;gap:8px;width:min(150px,17vw);padding:0 8px;background:rgba(8,14,22,.7);border:1.5px solid rgba(255,255,255,.18)}
#h3 .score .l{border-radius:10px 0 0 10px;color:#5DB8FF;clip-path:polygon(0 0,100% 0,100% 100%,0 100%)}
#h3 .score .r{border-radius:0 10px 10px 0;color:#FF5A4A;justify-content:flex-end}
#h3 .score .bar{flex:1;height:7px;background:rgba(255,255,255,.12);border-radius:2px;overflow:hidden;display:flex}
#h3 .score .l .bar{transform:skewX(-20deg);justify-content:flex-end}
#h3 .score .r .bar{transform:skewX(20deg)}
#h3 .score .l .bar i{display:block;background:linear-gradient(90deg,#1E6FD0,#3EA6FF)}
#h3 .score .r .bar i{display:block;background:linear-gradient(90deg,#FF4A3A,#C42418)}
#h3 .score small{font-size:11px;opacity:.85;font-weight:800}
#h3 .score .stm{display:flex;align-items:center;padding:0 12px;color:#fff;background:rgba(14,20,28,.88);border-top:1.5px solid rgba(255,255,255,.25);border-bottom:1.5px solid rgba(255,255,255,.25);font-size:14px;letter-spacing:.5px}
#drHud{position:absolute;inset:0;display:none;pointer-events:none;color:#E8F0E8;font:700 13px ui-monospace,Menlo,Consolas,monospace;text-shadow:0 0 3px #000}
#drHud .scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.10) 0 1px,transparent 1px 3px);mix-blend-mode:multiply}
#drHud .vig{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,transparent 55%,rgba(0,0,0,.55) 100%)}
#drHud svg{position:absolute;left:50%;top:50%;width:min(62vw,560px);height:min(62vw,560px);transform:translate(-50%,-50%);overflow:visible}
#drHud .tape{position:absolute;left:50%;top:80px;transform:translateX(-50%);width:360px;height:22px;overflow:hidden;border-bottom:1px solid rgba(232,240,232,.7)}
#drHud .tape i{position:absolute;top:0;font-style:normal;transform:translateX(-50%)}
#drHud .tape b{position:absolute;left:50%;bottom:-1px;width:0;height:0;border:6px solid transparent;border-bottom-color:#E8F0E8;transform:translateX(-50%)}
#drHud .zl{position:absolute;left:max(8px,env(safe-area-inset-left));top:146px;line-height:1.5;background:rgba(0,0,0,.35);padding:4px 8px;border-radius:6px}
#drHud .art{position:absolute;right:max(20px,env(safe-area-inset-right));bottom:30px;width:92px;height:92px;border-radius:50%;border:2px solid rgba(232,240,232,.7);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-size:12px;line-height:1.2;background:rgba(0,0,0,.35)}
#drHud .art.ready{border-color:#FF5A40;color:#FFB0A0}
#drTgt{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border:2px dashed #FF5A40;border-radius:50%;display:none}
#mkLayer{position:absolute;inset:0;pointer-events:none}
#mkLayer i{--c:#FF3B2E;position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;display:none;background:
 linear-gradient(var(--c),var(--c)) left top/8px 2px no-repeat,linear-gradient(var(--c),var(--c)) left top/2px 8px no-repeat,
 linear-gradient(var(--c),var(--c)) right top/8px 2px no-repeat,linear-gradient(var(--c),var(--c)) right top/2px 8px no-repeat,
 linear-gradient(var(--c),var(--c)) left bottom/8px 2px no-repeat,linear-gradient(var(--c),var(--c)) left bottom/2px 8px no-repeat,
 linear-gradient(var(--c),var(--c)) right bottom/8px 2px no-repeat,linear-gradient(var(--c),var(--c)) right bottom/2px 8px no-repeat}
#mkLayer i.air{--c:#3EA6FF}
#mkLayer i.t{width:40px;height:40px;margin:-20px 0 0 -20px}
#mkLayer i.aim{transform:scale(1.3);filter:drop-shadow(0 0 4px var(--c))}
#mkLayer i.lp{transform:scale(1.25);transition:transform .2s}
#mkLayer i.lk{animation:mkb .14s steps(2,start) infinite;transform:scale(1.35)}
@keyframes mkb{to{visibility:hidden}}`;document.head.appendChild(st);
 const vb=document.createElement('div');vb.className='veh';vb.innerHTML='<div class="b" data-v="titan" title="Титан"><svg viewBox="0 0 32 32"><path d="M3 20h26l-3 6H6z"/><path d="M8 14h13l2 5H7z"/><path d="M19 15.5h11v2H19z"/></svg></div><div class="b" data-v="drone" title="Дрон"><svg viewBox="0 0 32 32"><circle cx="7" cy="7" r="5"/><circle cx="25" cy="7" r="5"/><circle cx="7" cy="25" r="5"/><circle cx="25" cy="25" r="5"/><path d="M8 6l18 18-2 2L6 8zM24 6l2 2L8 26l-2-2z"/><rect x="12" y="12" width="8" height="8" rx="2"/></svg></div><div class="b" data-v="plane" title="Самолёт"><svg viewBox="0 0 32 32"><path d="M16 2c1.3 0 2 1.4 2 3v7l11 6v3l-11-3v6l3 2.5V29l-5-1.5-5 1.5v-2.5l3-2.5v-6L3 21v-3l11-6V5c0-1.6.7-3 2-3z"/></svg></div>';H.appendChild(vb);
 for(const b of vb.children)tapBtn(b,()=>setVeh(b.dataset.v));
 const mk=document.createElement('div');mk.id='mkLayer';H.insertBefore(mk,H.firstChild.nextSibling);
 const dh=document.createElement('div');dh.id='drHud';dh.innerHTML=`<div class="scan"></div><div class="vig"></div>
 <svg viewBox="-100 -100 200 200"><g fill="none" stroke="rgba(232,240,232,.85)" stroke-width="0.6">
 <path d="M-62 0H-12M12 0H62M0 -40V-10M0 10V40"/><path d="M-50 -3V3M-38 -2V2M-26 -2V2M26 -2V2M38 -2V2M50 -3V3M-3 -30H3M-2 -20H2M-2 20H2M-3 30H3"/>
 <path d="M-92 -70V-88H-74M74 -88H92V-70M92 70V88H74M-74 88H-92V70"/></g><circle r="1.2" fill="#FF5A40"/></svg>
 <div class="tape"></div><div class="zl"></div><div class="art"></div><div id="drTgt"></div>`;H.insertBefore(dh,H.firstChild.nextSibling);
 for(let i=0;i<60;i++)mk.appendChild(document.createElement('i'));}
function setVeh(v){if(v===CUR)return;VEH().move=false;CUR=v;for(const b of q('.veh').children)b.classList.toggle('on',b.dataset.v===CUR);
 const dr=CUR==='drone',pl=CUR==='plane';document.getElementById('drHud').style.display=dr?'block':'none';q('.sup').style.display=dr?'none':'flex';q('.sup').firstChild.textContent=pl?'Ракеты':'Залп';q('.go').style.display=pl?'none':'flex';
 {const g=document.getElementById('tiGun');if(g)g.style.display=pl?'none':'';for(const k of [0,1]){const f=document.getElementById('tiFl'+k);if(f)f.style.display=pl?'none':'';}}PA.style.display=pl?'flex':'none';
 const s=q('img.sight');if(s)s.style.display=dr?'none':'block';q('svg.xh').style.display=dr?'none':'block';q('.frame').style.display=dr?'none':'block';
 HUD.msg(dr?'Дрон: свайп — обзор, тап по врагу — артудар':pl?'Самолёт: свайп — поворот, пулемёт стреляет сам':'Титан');}
function droneHud(t){if(CUR!=='drone')return;const g=document.getElementById('tiCock');if(g)g.style.display='none';
 const deg=((D.yaw*180/Math.PI)+90+3600)%360,tp=document.querySelector('#drHud .tape');let h='<b></b>';
 for(let a=-75;a<=75;a+=15){const v=Math.round((deg+a)/15)*15,dx=(v-deg)*2.4;if(Math.abs(dx)>170)continue;const w=(v+360)%360,lab={0:'С',90:'В',180:'Ю',270:'З',45:'СВ',135:'ЮВ',225:'ЮЗ',315:'СЗ'}[w];h+=`<i style="left:${180+dx}px;${lab?'color:#fff':'opacity:.7;font-size:11px'}">${lab||w}</i>`;}tp.innerHTML=h;
 document.querySelector('#drHud .zl').innerHTML=`X${D.zoom.toFixed(1)}<br>ВЫС ${Math.round(D.alt)} м<br>НАКЛ ${Math.round(-D.pitch*180/Math.PI)}°<br>МЕТОК ${G_.units.filter(u=>u.mk&&!u.dead).length+G_.towers.filter(t=>t.mk).length}<br>РАКЕТЫ ${MIS_CD>0?MIS_CD.toFixed(1)+' с':'ГОТОВЫ'}`;
 const ar=document.querySelector('#drHud .art');ar.classList.toggle('ready',ART.cd<=0);ar.innerHTML=ART.cd>0?'АРТ<br>'+ART.cd.toFixed(1)+' с':'АРТ<br>ГОТОВА<br><span style="font-size:10px;display:block;margin-top:2px">тап по цели</span>';
 const m=document.getElementById('drTgt');if(m.dataset.t&&performance.now()<+m.dataset.t){const v=new THREE.Vector3(+m.dataset.x,0,+m.dataset.z).project(cam);if(v.z<1){m.style.display='block';m.style.left=((v.x+1)/2*innerWidth)+'px';m.style.top=((1-v.y)/2*innerHeight)+'px';}else m.style.display='none';}else m.style.display='none';}
/* red brackets over every marked enemy that is on screen, in either view */
function markHud(){const L_=document.getElementById('mkLayer').children,v=new THREE.Vector3();let n=0;const put=(x,y,z,big,cls)=>{if(n>=L_.length)return;v.set(x,y,z).project(cam);if(v.z>1||Math.abs(v.x)>1.05||Math.abs(v.y)>1.05)return;const el=L_[n++];el.style.display='block';el.className=(big?'t ':'')+(cls||'');el.style.left=((v.x+1)/2*innerWidth)+'px';el.style.top=((1-v.y)/2*innerHeight)+'px';};
 const AIM=CUR==='titan'?LOCK:CUR==='plane'?LOCKF:null,au=AIM&&AIM.tg.k==='u'?AIM.tg.o:null;
 for(const u of G_.units)if((u.mk||u===au)&&!u.dead)put(u.x,u.y+(u.k==='heli'?14:26),u.z,u.k!=='inf',(US[u.k].air?'air ':'')+(u.lk?'lk':u===au?'aim':LK.u===u&&LK.t>0.25?'lp':''));for(const t of G_.towers)if(t.mk&&!t.dead)put(t.x,22,t.z,true);for(const h of G_.harv)if(h.mk&&!h.dead)put(h.x,10,h.z,false);
 for(let i=n;i<L_.length;i++)if(L_[i].style.display!=='none')L_[i].style.display='none';}
{const p0=AUD.play.bind(AUD);AUD.play=function(kind,x,z,k){if(kind==='mark'){if(!this.ctx||!this.on)return;const C=this.ctx,now=C.currentTime;if(this.last.mark&&now-this.last.mark<0.25)return;this.last.mark=now;const o=C.createOscillator(),g=C.createGain();o.type='square';o.frequency.setValueAtTime(1400,now);o.frequency.setValueAtTime(1900,now+0.05);g.gain.setValueAtTime(0.05,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.12);o.connect(g).connect(this.out);o.start(now);o.stop(now+0.13);return;}return p0(kind,x,z,k);};}
window.__isle.D=D;window.__isle.cam=cam;window.__isle.DL=DL;window.__isle.stepArt=stepArt;window.__isle.stepDrone=stepDrone;window.__isle.setVeh=setVeh;window.__isle.fireArt=fireArt;window.__isle.ART=ART;window.__isle.artTap=artTap;

/* ================== lock-on: a moving enemy held under the red dot for 3 s gets homing missiles from the base ================== */
const LOCK_T=3,LOCK_PX=34,MIS=[];let MIS_CD=0,MID=0;const LK={u:null,t:0,beep:0};
function stepLock(dt){if(CUR!=='drone'||D.dead>0||G_.over){LK.u=null;LK.t=0;return;}
 const cx=innerWidth/2,cy=innerHeight/2,v=new THREE.Vector3();let best=null,bd=LOCK_PX*D.zoom;/* the same patch of ground at any zoom */
 for(const u of G_.units){if(u.dead||u.s!==1||u.lk)continue;v.set(u.x,u.y+6,u.z).project(cam);if(v.z>1)continue;const d=Math.hypot((v.x+1)/2*innerWidth-cx,(1-v.y)/2*innerHeight-cy);if(d<bd){bd=d;best=u;}}
 if(best&&best===LK.u)LK.t+=dt;else{LK.u=best;LK.t=0;}
 if(LK.u){LK.u.mk=1;LK.beep-=dt;if(LK.t>0.25&&LK.beep<=0){LK.beep=0.45-0.3*Math.min(1,LK.t/LOCK_T);AUD.play('lockp');}}
 if(LK.u&&LK.t>=LOCK_T){if(MIS_CD>0){if(LK.t<LOCK_T+dt*1.5)HUD.msg('Ракеты перезаряжаются: '+Math.ceil(MIS_CD)+' с');return;}
  launchMissiles(LK.u);LK.u=null;LK.t=0;}}
function launchMissiles(u){u.lk=1;MIS_CD=6;HUD.msg('Цель захвачена — пуск ракет!');
 BATT[0].forEach((g,i)=>{if(i===1)return;const gx=g.position.x,gz=g.position.z;MIS.push({id:++MID,x:gx,y:20,z:gz,vx:(rn()-0.5)*40,vy:260,vz:(rn()-0.5)*40,t:-i*0.12,u,tx:u.x,tz:u.z,tr:0,go:0});});}
function stepMissiles(dt){MIS_CD=Math.max(0,MIS_CD-dt);const SP=1150;
 for(const u of G_.units)if(u.lk&&!u.dead){LK.lb=(LK.lb||0)-dt;if(LK.lb<=0){LK.lb=0.13;if(CUR==='drone')AUD.play('lockf');}break;}
 for(let i=MIS.length-1;i>=0;i--){const m=MIS[i];m.t+=dt;if(m.t<0)continue;if(!m.go){m.go=1;puff(m.x,22,m.z,'muzzle');AUD.play('shot',m.x,m.z);}if(m.u&&!m.u.dead){m.tx=m.u.x;m.tz=m.u.z;m.ty=m.u.y+5;}else m.ty=m.ty??2;
  const dx=m.tx-m.x,dy=(m.ty??5)-m.y,dz=m.tz-m.z,L=Math.hypot(dx,dy,dz)||1;
  if(m.t<0.7){m.vy-=120*dt;}else{const k=Math.min(1,dt*(3+m.t*2));const sp=Math.min(SP,300+m.t*700);m.vx+=(dx/L*sp-m.vx)*k;m.vy+=(dy/L*sp-m.vy)*k;m.vz+=(dz/L*sp-m.vz)*k;}
  m.x+=m.vx*dt;m.y+=m.vy*dt;m.z+=m.vz*dt;m.tr-=dt;if(m.tr<=0){m.tr=0.035;puff(m.x,m.y,m.z,'trail');}
  if(L<14||m.t>14||(m.t>0.8&&m.y<0.5)){MIS.splice(i,1);explode(m.x,Math.max(0,m.y),m.z,1.2);
   if(m.u&&!m.u.dead&&Math.hypot(m.u.x-m.x,m.u.z-m.z)<30)dmgUnit(m.u,1100,0);
   for(const u of G_.units){if(u.dead||u.s===0||u===m.u)continue;if(Math.hypot(u.x-m.x,u.z-m.z)<30)dmgUnit(u,300,0);}
   if(m.u&&!m.u.dead&&!MIS.some(q=>q.u===m.u))m.u.lk=0;}}}
{const p1=AUD.play;AUD.play=function(kind,x,z,k){if(kind==='lockp'||kind==='lockf'){if(!this.ctx||!this.on)return;const C=this.ctx,now=C.currentTime,o=C.createOscillator(),g=C.createGain();o.type='square';
  o.frequency.setValueAtTime(kind==='lockf'?2300:1200,now);g.gain.setValueAtTime(kind==='lockf'?0.06:0.04,now);g.gain.exponentialRampToValueAtTime(0.001,now+(kind==='lockf'?0.07:0.06));o.connect(g).connect(this.out);o.start(now);o.stop(now+0.09);return;}return p1.call(this,kind,x,z,k);};}
window.__isle.setVeh=setVeh;window.__isle.LK=LK;window.__isle.MIS=MIS;window.__isle.stepLock=stepLock;window.__isle.stepMissiles=stepMissiles;window.__isle.launchMissiles=launchMissiles;

/* ================== the plane: always flying, machine gun fires by itself, rockets on demand, turns back smoothly past the limit ================== */
const F={x:0,z:0,y:0,yaw:0,ty:0,pitch:-0.18,hp:2500,max:2500,dead:0,zoom:1,alt:200,sp:225,cd:0,rcd:0,bank:0,turn:false,hurt:0,move:true};
const PLANE={limit:450,maxRate:0.75,mgCd:0.09,mgDmg:32,range:1400,cone:0.05,rocketCd:5,rocketN:6,rocketDmg:300,rocketR:48};
let LOCKF=null;const PR=[],PB=[];let PRID=0;
function spawnPlane(){const [bx,bz]=BASES[0];F.x=bx-300;F.z=bz;F.yaw=0;F.ty=0;F.pitch=-0.18;F.hp=F.max;F.dead=0;F.bank=0;F.turn=false;F.zoom=1;}
function stepPlane(dt){if(F.dead>0){F.dead-=dt;if(F.dead<=0)spawnPlane();return;}
 F.cd=Math.max(0,F.cd-dt);F.rcd=Math.max(0,F.rcd-dt);F.hurt=Math.max(0,F.hurt-dt);
 const L=PLANE.limit,out=F.x<-L||F.z<-L||F.x>IW+L||F.z>IH+L;
 /* past the limit: turn towards the middle at the gentlest rate that still makes it, until heading inwards */
 if(out||F.turn){const want=Math.atan2(IH/2-F.z,IW/2-F.x);let d=want-F.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));if(out)F.turn=true;if(Math.abs(d)<0.25&&!out)F.turn=false;F.ty=F.yaw+Math.sign(d||1)*Math.min(Math.abs(d),0.9);}
 if(CUR!=='plane'&&!F.turn)F.ty=F.yaw+0.35;                     // not flown: circle where it is
 let d=F.ty-F.yaw;const rate=Math.max(-PLANE.maxRate,Math.min(PLANE.maxRate,d*1.6));F.yaw+=rate*dt;F.bank+=(-rate*0.75-F.bank)*Math.min(1,dt*3);
 F.x+=Math.cos(F.yaw)*F.sp*dt;F.z+=Math.sin(F.yaw)*F.sp*dt;F.y+=(F.alt-F.y)*Math.min(1,dt*1.2);
 /* machine gun: the first enemy near the centre of the sight */
 if(CUR==='plane')for(const u of G_.units){if(u.dead||u.s===0||!US[u.k].air||u.mk)continue;const dx=u.x-F.x,dz=u.z-F.z,d=Math.hypot(dx,dz);if(d<2000){let a=Math.atan2(dz,dx)-F.yaw;a=Math.atan2(Math.sin(a),Math.cos(a));if(Math.abs(a)<0.75)u.mk=1;}}
 LOCKF=null;if(CUR==='plane'&&!G_.over){const o=new THREE.Vector3(F.x,F.y,F.z),dv=new THREE.Vector3(Math.cos(F.yaw)*Math.cos(F.pitch),Math.sin(F.pitch),Math.sin(F.yaw)*Math.cos(F.pitch));let best=PLANE.cone/F.zoom;
  const test=(x,y,z,tg,sz=10)=>{const vx=x-o.x,vy=y-o.y,vz=z-o.z,Ln=Math.hypot(vx,vy,vz);if(Ln>PLANE.range||Ln<25)return;const a=Math.acos(Math.max(-1,Math.min(1,(vx*dv.x+vy*dv.y+vz*dv.z)/Ln)))-Math.atan(sz/Ln);if(a<best){best=a;LOCKF={tg,x,y,z};}};
  for(const u of G_.units){if(u.dead||u.s===0)continue;test(u.x,u.y+(u.k==='heli'?5:12),u.z,{k:'u',o:u},u.k==='heli'?30:u.k==='inf'?10:36);}
  for(const t of G_.towers){if(t.s===0)continue;test(t.x,14,t.z,{k:'t',o:t});}
  for(const h of G_.harv){if(h.s===0)continue;test(h.x,7,h.z,{k:'h',o:h});}
  for(const m of G_.mines){if(m.s===0||m.dead)continue;test(m.x,8,m.z,{k:'m',o:m},55);}
  if(LOCKF&&F.cd<=0){F.cd=PLANE.mgCd;const tg=LOCKF.tg;applyHit(tg,PLANE.mgDmg*(tg.k==='t'?0.5:1),0);
   const sd=(F.mgSide=-(F.mgSide||1));{const ax=F.x-Math.sin(F.yaw)*sd*7+Math.cos(F.yaw)*8,ay=F.y-4,az=F.z+Math.cos(F.yaw)*sd*7+Math.sin(F.yaw)*8,bx=LOCKF.x+(rn()-0.5)*5,by=LOCKF.y+(rn()-0.5)*4,bz=LOCKF.z+(rn()-0.5)*5;PB.push({id:++PRID,x:ax,y:ay,z:az,sx:ax,sy:ay,sz:az,tx:bx,ty:by,tz:bz,t:0,T:Math.max(0.05,Math.hypot(bx-ax,by-ay,bz-az)/2400)});AUD.play('mg',ax,az);}}}
 if(F.hp<=0){F.hp=0;F.dead=5;G_.sides[1].ore+=400;explode(F.x,F.y,F.z,2);if(CUR==='plane')HUD.msg('Самолёт сбит — новый через 5 с');}
 /* machine-gun rounds: bright streaks flying to the target, a spark where they land */
 for(let i=PB.length-1;i>=0;i--){const b=PB[i];b.t+=dt;const k=Math.min(1,b.t/b.T);b.px=b.x;b.py=b.y;b.pz=b.z;b.x=b.sx+(b.tx-b.sx)*k;b.y=b.sy+(b.ty-b.sy)*k;b.z=b.sz+(b.tz-b.sz)*k;if(k>=1){PB.splice(i,1);puff(b.tx,b.ty,b.tz,'muzzle');if(rn()<0.4)puff(b.tx,b.ty,b.tz,'dust');}}
 /* rockets in flight */
 for(let i=PR.length-1;i>=0;i--){const r=PR[i];r.t+=dt;if(r.t<0)continue;if(!r.go){r.go=1;r.x=F.x-Math.sin(F.yaw)*r.sd*8;r.y=F.y-4;r.z=F.z+Math.cos(F.yaw)*r.sd*8;AUD.play('shot',r.x,r.z);}
  if(r.u&&!r.u.dead){r.tx=r.u.x;r.ty=r.u.y+4;r.tz=r.u.z;}const dx=r.tx-r.x,dy=r.ty-r.y,dz=r.tz-r.z,Ln=Math.hypot(dx,dy,dz)||1,sp=Math.min(1300,500+r.t*1600);
  r.vx=dx/Ln*sp;r.vy=dy/Ln*sp;r.vz=dz/Ln*sp;r.x+=r.vx*dt;r.y+=r.vy*dt;r.z+=r.vz*dt;r.tr-=dt;if(r.tr<=0){r.tr=0.03;puff(r.x,r.y,r.z,'trail');}
  if(Ln<sp*dt*1.2||r.t>6||r.y<0){PR.splice(i,1);rocketHit(r.tx,r.tz,r.ty);}}}
function rocketHit(x,z,y){explode(x,y||0,z,1.3);const R_=PLANE.rocketR;
 for(const u of G_.units){if(u.dead||u.s===0)continue;const d=Math.hypot(u.x-x,u.z-z);if(d<R_)dmgUnit(u,PLANE.rocketDmg*(d<R_*0.5?1:0.6),0);}
 for(const t of G_.towers){if(t.s===0||t.dead)continue;if(Math.hypot(t.x-x,t.z-z)<R_*0.6+14)dmgTower(t,PLANE.rocketDmg*2,0);}
 for(const h of G_.harv){if(h.s===0||h.dead)continue;if(Math.hypot(h.x-x,h.z-z)<R_)dmgHarv(h,PLANE.rocketDmg,0);}
 if(!G_.over&&Math.hypot(x-BASES[1][0],z-BASES[1][1])<110&&rn()<0.34)hitBase(1,1);
 {const m=nearMineOf(1,x,z,95);if(m&&!G_.over&&rn()<0.34)hitMine(m,1);}}
/* rockets: at the target on the sight, or where the sight meets the ground */
function planeRockets(){if(F.dead>0||F.rcd>0)return;F.rcd=PLANE.rocketCd;let tx,ty,tz,u=null;
 if(LOCKF){tx=LOCKF.x;ty=LOCKF.y;tz=LOCKF.z;if(LOCKF.tg.k==='u')u=LOCKF.tg.o;}
 else{const dv=[Math.cos(F.yaw)*Math.cos(F.pitch),Math.sin(F.pitch),Math.sin(F.yaw)*Math.cos(F.pitch)];let L=1100;for(let d=20;d<=1400;d+=8){const x=F.x+dv[0]*d,y=F.y+dv[1]*d,z=F.z+dv[2]*d;if(y<=0||OBS.some(o=>y<=o.h&&inRect(x,z,o,0))){L=d;break;}}tx=F.x+dv[0]*L;ty=Math.max(0,F.y+dv[1]*L);tz=F.z+dv[2]*L;}
 for(let i=0;i<PLANE.rocketN;i++){const sd=i%2?1:-1;PR.push({id:++PRID,t:-i*0.11,sd,u:i<2?u:null,tx:tx+(i<2&&u?0:(rn()-0.5)*30),ty:ty+(i<2&&u?0:(rn()-0.5)*8),tz:tz+(i<2&&u?0:(rn()-0.5)*30),x:F.x,y:F.y,z:F.z,vx:0,vy:0,vz:0,tr:0});}
 HUD.msg('Пуск ракет!');HUD.kick();}
function planeCam(){if(F.dead>0){const [bx,bz]=BASES[0];cam.position.set(bx-300,300,bz);cam.lookAt(bx+300,0,bz);return;}
 cam.position.set(F.x,F.y,F.z);cam.up.set(0,1,0);cam.lookAt(F.x+Math.cos(F.yaw)*Math.cos(F.pitch)*100,F.y+Math.sin(F.pitch)*100,F.z+Math.sin(F.yaw)*Math.cos(F.pitch)*100);cam.rotateZ(F.bank);
 const fov=80/F.zoom;if(Math.abs(cam.fov-fov)>0.01){cam.fov=fov;cam.updateProjectionMatrix();}}
let PLANE_O=null;
function syncPlane(t){if(!PLANE_O){PLANE_O=instantiate(proto('Uplane0',()=>buildUnit('plane',0)));PLANE_O.scale.setScalar(1.5);dyn.add(PLANE_O);}
 PLANE_O.visible=F.dead<=0&&CUR!=='plane';PLANE_O.position.set(F.x,F.y,F.z);PLANE_O.rotation.set(0,-F.yaw,0);PLANE_O.rotateX(-F.bank);
 for(const b of PB)sync('B'+b.id,()=>{const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.glow,color:0xFFD27A,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));sp.scale.set(9,9,1);return sp;},o=>o.position.set(b.x,b.y,b.z));
 for(const b of PB)sync('b'+b.id,()=>{const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);return new THREE.Line(g,new THREE.LineBasicMaterial({color:0xFFE9A0,transparent:true,blending:THREE.AdditiveBlending}));},o=>{const a=o.geometry.attributes.position,L=Math.hypot(b.tx-b.sx,b.ty-b.sy,b.tz-b.sz)||1,ln=28;a.setXYZ(0,b.x,b.y,b.z);a.setXYZ(1,b.x-(b.tx-b.sx)/L*ln,b.y-(b.ty-b.sy)/L*ln,b.z-(b.tz-b.sz)/L*ln);a.needsUpdate=true;o.geometry.computeBoundingSphere();});
 for(const r of PR)if(r.t>=0)sync('R'+r.id,()=>{const g=new THREE.Group();const b=new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.7,7,8),std(0xD8D8D0,0.5,0.4));b.rotation.z=Math.PI/2;g.add(b);const f=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.glow,color:0xFFB050,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));f.scale.set(9,9,1);f.position.x=-5;g.add(f);return g;},o=>{o.position.set(r.x,r.y,r.z);o.rotation.set(0,-Math.atan2(r.vz,r.vx),Math.atan2(r.vy,Math.hypot(r.vx,r.vz)));});}
/* plane HUD: speed and altitude, rocket ring, the sight goes red when something is on the gun */
const PA=document.createElement('div');PA.className='b palt';PA.style.cssText='right:max(14px,env(safe-area-inset-right));top:56px;padding:0 12px;height:38px;font-size:13px;display:none';H.appendChild(PA);
{const ALTS=[120,200,300,450];let ai=1;try{const v=+localStorage.getItem('dvebazy-plalt');if(ALTS.includes(v))ai=ALTS.indexOf(v);}catch(_){}F.alt=ALTS[ai];F.y=F.alt;
 const upd=()=>PA.textContent='Высота '+F.alt;upd();tapBtn(PA,()=>{ai=(ai+1)%ALTS.length;F.alt=ALTS[ai];upd();try{localStorage.setItem('dvebazy-plalt',''+F.alt);}catch(_){}});}
const PCK=document.createElement('img');PCK.src='pl_cockpit.webp';PCK.alt='';PCK.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:fill;pointer-events:none;display:none';{const tc=document.getElementById('tiCock');tc.parentNode.insertBefore(PCK,tc);}
function planeHud(){if(CUR!=='plane'){PCK.style.display='none';q('.fps').style.top='';return;}q('.fps').style.top='102px';
 const g=document.getElementById('tiCock');if(g)g.style.display='none';PCK.style.display=F.dead<=0&&F.zoom<1.5?'block':'none';
 q('.lk').setAttribute('display','none');const im=q('img.sight');if(im)im.classList.toggle('lock',!!LOCKF);
 q('.rld').setAttribute('stroke-dasharray',(170*(1-F.rcd/PLANE.rocketCd)).toFixed(1)+' 170');
 q('.sup span').textContent=F.rcd>0?Math.ceil(F.rcd)+' с':'';q('.sup').classList.toggle('cd',F.rcd>0);q('.hurt').style.boxShadow='inset 0 0 120px rgba(200,20,10,'+(F.hurt>0?0.5:0)+')';}
window.__isle.F=F;window.__isle.dmgUnit=dmgUnit;window.__isle.stepFx=stepFx;window.__isle.FXP=FXP;window.__isle.bigBlast=bigBlast;window.__isle.FXN=()=>({fx:FXP.length,wrk:WRK.length,fall:FALL.length,deb:DEBR.length,part:PART.length});window.__isle.buildXM=buildXM;window.__isle.XM=XM;window.__isle.hitBase=hitBase;window.__isle.syncAll=syncAll;window.__isle.PART=PART;window.__isle.stepParts=stepParts;window.__isle.hitMine=hitMine;window.__isle.stepTitan=stepTitan;window.__isle.P=P;window.__isle.get_LOCK=()=>LOCK;window.__isle.stepPlane=stepPlane;window.__isle.planeRockets=planeRockets;window.__isle.PR=PR;window.__isle.get_LOCKF=()=>LOCKF;

/* ================== TEST: the bot sends free waves (mostly helicopters); they don't take lives from our base ================== */
const TESTW={on:true,t:6,n:0};try{TESTW.on=localStorage.getItem('dvebazy-testw')!=='0';}catch(_){}
function testWaves(dt){if(!TESTW.on)return;TESTW.t-=dt;if(TESTW.t>0)return;TESTW.t=20;TESTW.n++;
 const S=G_.sides[1],w=['heli','heli','heli','heli','jeep','jeep','tank'];if(TESTW.n%2===0)w.push('heli','heli','tank');for(const k of w)S.queue.push(k);}
{const tb=document.createElement('div');tb.className='b testw';tb.style.cssText='left:max(8px,env(safe-area-inset-left));top:106px;padding:0 10px;height:32px;font-size:12px';
 const upd=()=>{tb.textContent='Тест-волны: '+(TESTW.on?'вкл':'выкл');tb.style.background=TESTW.on?'rgba(160,60,40,.7)':'';};upd();H.appendChild(tb);
 tapBtn(tb,()=>{TESTW.on=!TESTW.on;TESTW.t=3;upd();try{localStorage.setItem('dvebazy-testw',TESTW.on?'1':'0');}catch(_){}});}

function onMil(){if(BUILT){MIL_DIRTY=false;buildWorld();}else MIL_DIRTY=true;}
cam.far=9000;cam.updateProjectionMatrix();{const c=sun.shadow.camera;c.left=-330;c.right=330;c.top=330;c.bottom=-330;c.far=1600;c.updateProjectionMatrix();}
try{const q=+localStorage.getItem('dvebazy-isleq');if(q>=0.5&&q<=2){T3.q=q;R.setPixelRatio(q);}}catch(_){}

})();
