/* «Две базы: Остров» — 3D island game (built by build_island.py) */
(function(){'use strict';
if(typeof THREE==='undefined'){console.error('three.js missing');return;}
/* ================== «Две базы: Остров» — the island game ================== */
/* ---------- world size and rules ---------- */
const IW=12000,IH=5000,GS=40;
/* the middle third is an open sandy wasteland; a concrete canal runs north–south through its centre, crossed by three bridges */
const WASTE_HW=2000,CAN={hw:100,wt:12,depth:34,water:-15,bw:140};                         // island area, height-grid step
const WATER=0;
const BASES=[[700,IH/2],[IW-700,IH/2]];
/* the bases and airfields (Tripo models): every place on them is given in the model's own frame (x across, z towards the front, ±0.5) */
const BS=700,BXC=-0.022,BZC=-0.02,BROT=0.183,BSINK=0.0364*700,PADY=(0.0594-0.0364)*700;
const AS=1100,ASINK=0.0345*1100,AIRP=[[1400,IH-750],[IW-1400,750]];
const baseW=(s,xl,zl)=>{const f=(zl-BZC)*BS,l=(xl-BXC)*BS,[bx,bz]=BASES[s];return s===0?[bx+f,bz-l]:[bx-f,bz+l];};
const airW=(s,xl,zl)=>{const f=zl*AS,l=xl*AS,[ax,az]=AIRP[s];return s===0?[ax+f,az-l]:[ax-f,az+l];};
const SLOTS=[['mg',-0.192,0.117],['mg',0.153,0.114],['rkt',-0.341,0.246],['rkt',0.291,0.251]];
const BRP=[0,1].map(s=>baseW(s,-0.02,0.30));   // where attackers break into a base
const START_ORE=700,BASE_INC=8,LIVES=30;
const SPK=1.5,USPK=1.9;                                        // island speeds are 1.5× the 2D ones
const US={                                            // unit stats on the island
 inf:{name:'Пехота',cost:60,hp:209,sp:40,rng:80,dmg:11,cd:0.55,air:false,hitAir:true,rw:10,lives:1,r:9},
 jeep:{name:'Джип',cost:105,hp:376,sp:70,rng:95,dmg:7,cd:0.14,air:false,hitAir:true,rw:18,lives:1,r:11},
 tank:{name:'Танк',cost:270,hp:700,sp:30,rng:125,dmg:70,cd:1.6,air:false,hitAir:false,rw:45,lives:3,r:16,splash:22},
 heli:{name:'Вертолёт',cost:165,hp:320,sp:55,rng:110,dmg:24,cd:0.6,air:true,hitAir:true,rw:25,lives:1,r:16},
};
const TWS={mg:{cost:200,rng:520,dmg:24,cd:0.15,air:false,ground:true,hp:3500},can:{cost:300,rng:200,dmg:60,cd:1.6,air:false,ground:true,splash:40,hp:1800},
 tes:{cost:600,rng:180,dmg:100,cd:1,air:true,ground:true,hp:1500},rkt:{cost:500,rng:900,dmg:150,cd:2.2,air:true,ground:false,hp:3500}};
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
sun.castShadow=true;{const s=T3.lo?1024:2048;sun.shadow.mapSize.set(s,s);const c=sun.shadow.camera;c.left=-170;c.right=170;c.top=170;c.bottom=-170;c.near=10;c.far=900;sun.shadow.bias=-0.0004;sun.shadow.normalBias=0.35;sun.shadow.normalBias=0.8;}
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
function instantiate(p){const g=new THREE.Group();for(const name in p){const sub=new THREE.Group();sub.name=name;sub.position.copy(p[name].pos);for(const {geo,mat} of p[name].parts){const m=new THREE.Mesh(geo,mat);m.castShadow=!(mat.transparent&&mat.opacity<0.5);m.receiveShadow=true;sub.add(m);}g.add(sub);g.userData[name]=sub;}return g;}
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
function inCanal(x,z){return Math.abs(x-IW/2)<CAN.hw&&!GAPS.some(g=>Math.abs(z-g)<CAN.bw/2);}
/* the ground is not drawn under the runway and the base yard: their floors lie a hair above it, and on phones with a coarse depth buffer the ground showed through */
function GHOLE(){const r=[];const box=(f,s,x0,x1,z0,z1)=>{const a=f(s,x0,z0),b=f(s,x1,z1);r.push(`if(abs(vWP.x-${((a[0]+b[0])/2).toFixed(1)})<${(Math.abs(a[0]-b[0])/2).toFixed(1)}&&abs(vWP.z-${((a[1]+b[1])/2).toFixed(1)})<${(Math.abs(a[1]-b[1])/2).toFixed(1)})discard;`);};
 for(const s of [0,1]){box(airW,s,-0.155,0.155,-0.47,-0.1);box(airW,s,-0.135,0.115,-0.1,0.4);box(airW,s,-0.14,0.13,0.38,0.487);box(baseW,s,-0.3,0.3,-0.2,0.22);}return r.join('');}
function hgt(x,z){return inCanal(x,z)?CAN.water:0;}
function slope(x,z){return 0;}
const inRect=(x,z,o,pad)=>Math.abs(x-o.x)<o.w/2+pad&&Math.abs(z-o.z)<o.d/2+pad;
const blockedAt=(x,z,pad)=>OBS.some(o=>inRect(x,z,o,pad));
function freeRect(x,z,w,d,pad){if(x-w/2<120||x+w/2>IW-120||z-d/2<120||z+d/2>IH-120)return false;
 for(const o of OBS)if(Math.abs(x-o.x)<(w+o.w)/2+pad&&Math.abs(z-o.z)<(d+o.d)/2+pad)return false;
 if(BASES.some(([bx,bz])=>Math.abs(x-bx)<w/2+520&&Math.abs(z-bz)<d/2+520))return false;if(AIRP.some(([ax,az])=>Math.abs(x-ax)<w/2+700&&Math.abs(z-az)<d/2+480))return false;
 if(MINES_AT.some(([mx,mz])=>Math.abs(x-mx)<w/2+200&&Math.abs(z-mz)<d/2+200))return false;
 if(Math.abs(x-IW/2)<w/2+WASTE_HW+300)return false;return true;}   // nothing stands on the wasteland
const CONT={L:90,H:22,W:20};
function genYard(seed){seedR=seed;OBS.length=0;
 GAPS=[IH*0.2+rn()*250,IH*0.5+(rn()-0.5)*300,IH*0.8-rn()*250];
 MINES_AT=[[1900,1250],[1900,IH-1250],[IW-1900,1250],[IW-1900,IH-1250],[3100,IH/2+(rn()-0.5)*500],[IW-3100,IH/2+(rn()-0.5)*500]];
 /* the base buildings, the airfield terminals and the tower pads block the way (k:'bld' is not drawn: the models are) */
 const rectL=(f,s,x0,x1,z0,z1,h)=>{const a=f(s,x0,z0),b=f(s,x1,z1);OBS.push({x:(a[0]+b[0])/2,z:(a[1]+b[1])/2,w:Math.abs(a[0]-b[0]),d:Math.abs(a[1]-b[1]),h,k:'bld'});};
 for(const s of [0,1]){rectL(baseW,s,-0.48,0.48,-0.40,-0.02,200);rectL(airW,s,-0.3,0.3,-0.5,-0.27,150);
  for(const [k,x,z] of SLOTS)rectL(baseW,s,x-0.045,x+0.045,z-0.045,z+0.045,PADY);}
 /* the canal through the middle of the wasteland: ground units cross only on the three bridges (h<0: shots fly over it) */
 {const gs=[...GAPS].sort((a,b)=>a-b);let z0=-60;for(const g of [...gs,IH+60+CAN.bw/2]){const z1=g-CAN.bw/2;if(z1>z0)OBS.push({x:IW/2,z:(z0+z1)/2,w:2*(CAN.hw+CAN.wt),d:z1-z0,h:-1,k:'canal'});z0=g+CAN.bw/2;}}
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
 {const an=Math.min(8,R.capabilities.getMaxAnisotropy());for(const k in YT)if(YT[k]&&YT[k].isTexture)YT[k].anisotropy=an;}
 return YT;}
/* sand of the wasteland: white = sand; the edge is ragged, with drifts blown onto the concrete and bare patches inside */
let SANDC=null;
function sandMask(){if(SANDC)return SANDC;const w=1536,h=Math.round(1536*IH/IW),c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');const k=w/IW,cx=IW/2;
 x.fillStyle='#000';x.fillRect(0,0,w,h);x.fillStyle='#fff';
 const edge=(z,s)=>WASTE_HW+Math.sin(z/430+s*3.1)*120+Math.sin(z/170+s*7.7)*55+Math.sin(z/61+s)*22;
 x.beginPath();for(let z=-50;z<=IH+50;z+=20)x.lineTo((cx-edge(z,0))*k,z*k);for(let z=IH+50;z>=-50;z-=20)x.lineTo((cx+edge(z,1))*k,z*k);x.closePath();x.fill();
 const blob=(X,Z,R,a)=>{const g=x.createRadialGradient(X*k,Z*k,0,X*k,Z*k,R*k);g.addColorStop(0,`rgba(255,255,255,${a})`);g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect((X-R)*k,(Z-R)*k,2*R*k,2*R*k);};
 for(let i=0;i<170;i++){const sd=rn()<0.5?-1:1,z=rn()*IH,d=edge(z,sd<0?0:1)+(rn()-0.2)*320;blob(cx+sd*d,z,40+rn()*170,0.35+rn()*0.5);}
 x.globalCompositeOperation='destination-out';for(let i=0;i<40;i++){const sd=rn()<0.5?-1:1,z=rn()*IH,d=edge(z,sd<0?0:1)-40-rn()*200;const g=x.createRadialGradient((cx+sd*d)*k,z*k,0,(cx+sd*d)*k,z*k,(30+rn()*80)*k);g.addColorStop(0,'rgba(0,0,0,0.6)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,w,h);}
 x.globalCompositeOperation='source-over';
 SANDC=c;return c;}
/* the floor mask: dirt (r), tyre tracks and oil (g), yellow lane paint (b), painted over the whole yard */
function floorMask(){const w=3072,h=Math.round(3072*IH/IW),c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,w,h);const k=w/IW;
 const blob=(X,Z,R,col)=>{const g=x.createRadialGradient(X*k,Z*k,0,X*k,Z*k,R*k);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect((X-R)*k,(Z-R)*k,2*R*k,2*R*k);};
 x.globalCompositeOperation='lighter';
 for(let i=0;i<260;i++)blob(rn()*IW,rn()*IH,80+rn()*360,`rgba(${Math.floor(60+rn()*90)},0,0,1)`);
 for(const o of OBS){if(o.k==='bld')continue;x.fillStyle='rgba(90,0,0,1)';x.fillRect((o.x-o.w/2-16)*k,(o.z-o.d/2-16)*k,(o.w+32)*k,(o.d+32)*k);}
 for(const [bx,bz] of BASES)blob(bx,bz,420,'rgba(150,0,0,1)');for(const [mx,mz] of MINES_AT)blob(mx,mz,260,'rgba(170,40,0,1)');
 for(let i=0;i<90;i++)blob(rn()*IW,rn()*IH,14+rn()*50,'rgba(0,150,0,1)');
 const line=(pl,off,col,wd,dash)=>{x.strokeStyle=col;x.lineWidth=wd*k;x.setLineDash(dash?dash.map(v=>v*k):[]);x.beginPath();pl.forEach((p,i)=>{const a=pl[Math.max(0,i-1)],b=pl[Math.min(pl.length-1,i+1)];let dx=b[0]-a[0],dz=b[1]-a[1];const l=Math.hypot(dx,dz)||1;const X=(p[0]-dz/l*off)*k,Z=(p[1]+dx/l*off)*k;i?x.lineTo(X,Z):x.moveTo(X,Z);});x.stroke();x.setLineDash([]);};
 x.lineCap='round';x.lineJoin='round';
 const P_=ROADS_I.map(pl=>resample(chaikin(pl,2),20));
 P_.forEach(pl=>{line(pl,0,'rgba(70,0,0,1)',70);for(const o of [-11,11,-15,15])line(pl,o,'rgba(0,70,0,1)',4);});
 ROADS_I.slice(0,3).forEach((pl,i)=>line(resample(chaikin(pl,2),20),0,'rgba(0,0,200,1)',3,[40,40]));
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.anisotropy=4;return t;}
function floorMaterial(){const T=yardTextures(),RM=floorMask(),SM=new THREE.CanvasTexture(sandMask());SM.wrapS=SM.wrapT=THREE.ClampToEdgeWrapping;const m=new THREE.MeshStandardMaterial({map:T.floor,roughness:0.9,metalness:0});
 const gz=[...GAPS].sort((a,b)=>a-b).map(v=>v.toFixed(1));
 m.onBeforeCompile=sh=>{sh.uniforms.tMask={value:RM};sh.uniforms.tSand={value:SM};
  sh.vertexShader='varying vec3 vWP;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xyz;');
  sh.fragmentShader='uniform sampler2D tMask;uniform sampler2D tSand;varying vec3 vWP;\n'+sh.fragmentShader.replace('#include <map_fragment>',
  `vec2 fu=vWP.xz/170.0;vec4 tc=texture2D(map,fu);vec4 tc2=texture2D(map,vWP.xz/690.0+0.37);vec3 col=tc.rgb*mix(0.85,1.15,tc2.g);
   vec2 mu=vWP.xz/vec2(${IW.toFixed(1)},${IH.toFixed(1)});float inside=step(0.0,mu.x)*step(mu.x,1.0)*step(0.0,mu.y)*step(mu.y,1.0);vec3 mk=texture2D(tMask,clamp(mu,0.0,1.0)).rgb*inside;
   float out_=1.0-inside;
   col=mix(col,col*vec3(0.62,0.52,0.40)+vec3(0.05,0.035,0.02),clamp(mk.r*0.9+out_*0.85,0.0,1.0));
   col*=1.0-mk.g*0.55;col=mix(col,vec3(0.62,0.48,0.12),mk.b*0.75);
   float sd=texture2D(tSand,clamp(mu,0.0,1.0)).r*inside;float nz=tc2.r-0.5+(tc.g-0.5)*0.6;float sand=smoothstep(0.32,0.68,sd+nz*0.45);
   float rip=sin(vWP.x*0.055+sin(vWP.z*0.009)*4.0+tc2.b*3.0)*0.5+0.5;vec3 sc=vec3(0.80,0.66,0.47)*(0.86+tc2.g*0.22)*(0.93+rip*0.1)+(tc.rgb-0.5)*0.08;
   col=mix(col,sc,sand);
   ${GHOLE()}
   float cx=abs(vWP.x-${(IW/2).toFixed(1)});if(cx<${CAN.hw.toFixed(1)}&&abs(vWP.z-${gz[0]})>${(CAN.bw/2).toFixed(1)}&&abs(vWP.z-${gz[1]})>${(CAN.bw/2).toFixed(1)}&&abs(vWP.z-${gz[2]})>${(CAN.bw/2).toFixed(1)})discard;
   diffuseColor.rgb*=col;`);};return m;}
function boxUV(geo,su,sv){const uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*su,uv.getY(i)*sv);return geo;}
const CONT_COLS=[0x9C3B2C,0x2E5A86,0x3D6B43,0xB8682A,0x6E6E6A,0xC9C2B0,0x7A3048,0x2C6E70,0xA88C3A];
let LIGHTS=[],ROADS_I=[],ocean=null;const LAMPS=[],POOLS=[];
/* the canal: concrete walls, a muddy bed, water well below the rim, three concrete bridges */
let WATERT=null;
function canalWaterTex(){const S=256,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d');const img=x.createImageData(S,S),d=img.data;
 /* a tileable normal map from a few summed waves */
 const W_=[];for(let n=0;n<14;n++){let a=Math.round((rn()-0.5)*12),b=Math.round((rn()-0.5)*12);if(!a&&!b)a=1;W_.push([a,b,rn()*6.28,1/Math.pow(Math.hypot(a,b),1.7)]);}
 const H=(i,j)=>{let h=0;for(const [a,b,p,m] of W_)h+=Math.sin((i*a+j*b)/S*6.2832+p)*m;return h;};
 for(let j=0;j<S;j++)for(let i=0;i<S;i++){const dx=H(i+1,j)-H(i-1,j),dz=H(i,j+1)-H(i,j-1);const nx=-dx*14,nz=-dz*14,l=Math.hypot(nx,nz,1);const o=(j*S+i)*4;d[o]=(nx/l*0.5+0.5)*255;d[o+1]=(nz/l*0.5+0.5)*255;d[o+2]=(1/l*0.5+0.5)*255;d[o+3]=255;}
 x.putImageData(img,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
function buildCanal(){const T=yardTextures(),cx=IW/2,gs=[...GAPS].sort((a,b)=>a-b),z0=-WALL_T,z1=IH+WALL_T,L=z1-z0,dep=CAN.depth;
 const conc=new THREE.MeshStandardMaterial({map:T.conc,color:lin(0x9A948A),roughness:0.85,metalness:0.05});
 const wallTex=T.conc.clone();wallTex.needsUpdate=true;wallTex.wrapS=wallTex.wrapT=THREE.RepeatWrapping;wallTex.repeat.set(L/60,dep/60);
 const wm=new THREE.MeshStandardMaterial({map:wallTex,color:lin(0x8A847A),roughness:0.9});
 const segs=[];{let a=z0;for(const g of gs){segs.push([a,g-CAN.bw/2]);a=g+CAN.bw/2;}segs.push([a,z1]);}
 const lipM=new THREE.MeshStandardMaterial({color:lin(0xB8B2A6),roughness:0.7});
 for(const [a,b] of segs){const Ls=b-a,zc=(a+b)/2;for(const sd of [-1,1]){const w=new THREE.Mesh(new THREE.BoxGeometry(CAN.wt,dep+0.6,Ls),wm);w.position.set(cx+sd*(CAN.hw-CAN.wt/2),-dep/2+0.3,zc);w.receiveShadow=true;world.add(w);
  const lip=new THREE.Mesh(new THREE.BoxGeometry(5,0.8,Ls),lipM);lip.position.set(cx+sd*(CAN.hw-2.5),0.7,zc);world.add(lip);}}
 const bed=new THREE.Mesh(new THREE.PlaneGeometry(2*CAN.hw,L),new THREE.MeshStandardMaterial({color:lin(0x2A2A22),roughness:1}));bed.rotation.x=-Math.PI/2;bed.position.set(cx,-dep,(z0+z1)/2);world.add(bed);
 /* water: dark, glossy, reflecting the sunset sky, ripples drifting south */
 const nt=canalWaterTex();nt.repeat.set(2*CAN.hw/240,L/240);
 const wat=new THREE.Mesh(new THREE.PlaneGeometry(2*CAN.hw-2*CAN.wt+0.5,L),new THREE.MeshStandardMaterial({color:lin(0x4A7A80),roughness:0.12,metalness:0.55,normalMap:nt,normalScale:new THREE.Vector2(0.45,0.45),envMapIntensity:2.4,transparent:true,opacity:0.95}));
 wat.rotation.x=-Math.PI/2;wat.position.set(cx,CAN.water,(z0+z1)/2);wat.receiveShadow=true;world.add(wat);WATERT=nt;
 /* water marks on the walls just above the surface */
 for(const [a,b] of segs)for(const sd of [-1,1]){const st=new THREE.Mesh(new THREE.PlaneGeometry(b-a,3),new THREE.MeshBasicMaterial({color:0x1C1A16,transparent:true,opacity:0.45,depthWrite:false}));st.rotation.y=sd>0?-Math.PI/2:Math.PI/2;st.position.set(cx+sd*(CAN.hw-CAN.wt-0.15),CAN.water+1.6,(a+b)/2);world.add(st);}
 /* bridges: a concrete deck on two piers, low parapets with a yellow-black band */
 const pm=new THREE.MeshStandardMaterial({map:T.blk,roughness:0.8});
 for(const g of gs){const span=2*CAN.hw+50;const deck=new THREE.Mesh(new THREE.BoxGeometry(span,7,CAN.bw),conc);deck.position.set(cx,-3.0,g);deck.castShadow=true;deck.receiveShadow=true;world.add(deck);
  const top=new THREE.Mesh(new THREE.BoxGeometry(span,0.7,CAN.bw-10),new THREE.MeshStandardMaterial({color:lin(0x55524C),roughness:0.95}));top.position.set(cx,0.9,g);top.receiveShadow=true;world.add(top);
  for(const sz of [-1,1]){const pa=new THREE.Mesh(new THREE.BoxGeometry(span,5,4),pm);pa.position.set(cx,2.5,g+sz*(CAN.bw/2-2));pa.castShadow=true;pa.receiveShadow=true;world.add(pa);}
  for(const sx of [-1,1]){const pier=new THREE.Mesh(new THREE.BoxGeometry(14,dep,CAN.bw*0.7),conc);pier.position.set(cx+sx*CAN.hw*0.45,-dep/2-3,g);pier.castShadow=true;world.add(pier);}}}
/* ================== time of day: sunset, evening, night — no painted sun disc on the horizon ================== */
const TODS=[
 {name:'Закат',top:0x2E3858,hz:0xF09A5C,glow:0xFFB070,gk:0.22,fog:0xA87A64,sun:0xFFB27A,si:2.6,sd:[-0.86,0.19,0.32],hs:0x8C96C0,hg:0x5A4636,hi:0.5,ex:0.82,env:1,cloud:0xE0A080,lamp:0.8,pool:0,stars:0},
 {name:'Вечер',top:0x121A38,hz:0x7A4E66,glow:0xC07890,gk:0.16,fog:0x4E4258,sun:0xB08AB0,si:0.85,sd:[-0.9,0.1,0.35],hs:0x6A78B0,hg:0x2E2834,hi:0.5,ex:0.92,cab:0.75,env:0.5,cloud:0x8A6680,lamp:1,pool:0.35,stars:0.35},
 {name:'Ночь',top:0x02050E,hz:0x141C30,glow:0x2A3A60,gk:0.08,fog:0x0E1420,sun:0x7C94C8,si:0.16,sd:[0.35,0.7,-0.45],hs:0x2A3658,hg:0x0A0C10,hi:0.18,ex:0.9,cab:0.5,env:0.14,cloud:0x2A3048,lamp:1.2,pool:0.6,stars:1}];
let TOD=0;try{TOD=Math.max(0,Math.min(2,+localStorage.getItem('dvebazy-tod')||0));}catch(_){}
function todSky(){const g=new THREE.SphereGeometry(2600,32,16);
 const m=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{top:{value:new THREE.Color()},hz:{value:new THREE.Color()},gc:{value:new THREE.Color()},gk:{value:0.2},sd:{value:SUN_DIR},st:{value:0}},
  vertexShader:'varying vec3 vd;void main(){vd=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position.z=gl_Position.w;}',
  fragmentShader:`uniform vec3 top;uniform vec3 hz;uniform vec3 gc;uniform float gk;uniform vec3 sd;uniform float st;varying vec3 vd;
   float hs(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
   void main(){vec3 d=normalize(vd);float h=clamp(d.y,0.0,1.0);vec3 c=mix(hz,top,pow(h,0.55));if(d.y<0.0)c=hz*0.92;
    vec3 hd=normalize(vec3(sd.x,0.0,sd.z));float s=max(dot(normalize(vec3(d.x,0.0,d.z)),hd),0.0);c+=gc*pow(s,5.0)*gk*(1.0-smoothstep(0.0,0.45,h));
    if(st>0.0&&d.y>0.04){vec3 q=floor(d*420.0);float r=hs(q);float b=step(0.9965,r)*(0.4+0.6*hs(q+7.0));c+=vec3(0.85,0.9,1.0)*b*st*smoothstep(0.04,0.3,d.y);}
    gl_FragColor=vec4(c,1.0);}`});
 const o=new THREE.Mesh(g,m);o.renderOrder=-10;o.frustumCulled=false;return o;}
let todRT=null;
function todEnv(t){const hex=c=>'#'+new THREE.Color(c).getHexString();
 const tex=canvasTex(256,128,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,hex(t.top));g.addColorStop(0.47,hex(t.hz));g.addColorStop(0.53,THEME.isle.g3);g.addColorStop(1,THEME.isle.g1);c.fillStyle=g;c.fillRect(0,0,w,h);if(t.env<1){c.fillStyle=`rgba(4,6,12,${1-t.env})`;c.fillRect(0,0,w,h);}},true,false);
 tex.mapping=THREE.EquirectangularReflectionMapping;const pm=new THREE.PMREMGenerator(R);if(todRT)todRT.dispose();todRT=pm.fromEquirectangular(tex);pm.dispose();tex.dispose();return todRT.texture;}
function applyTOD(i){TOD=i;const t=TODS[i];try{localStorage.setItem('dvebazy-tod',''+i);}catch(_){}
 if(sky){const u=sky.material.uniforms;u.top.value.copy(lin(t.top));u.hz.value.copy(lin(t.hz));u.gc.value.copy(lin(t.glow));u.gk.value=t.gk;u.st.value=t.stars;}
 SUN_DIR.set(...t.sd).normalize();sun.color.setHex(t.sun);sun.intensity=t.si;hemi.color.setHex(t.hs);hemi.groundColor.setHex(t.hg);hemi.intensity=t.hi;
 if(scene.fog)scene.fog.color.copy(lin(t.fog));R.toneMappingExposure=t.ex;if(PO&&PO.fin)PO.fin.uniforms.ex.value=0.95*t.ex/0.82;scene.environment=todEnv(t);
 if(world)for(const c of world.children)if(c.userData.cloud)c.material.color.setHex(t.cloud);
 {const f=t.cab?`brightness(${t.cab})`:'';for(const id of ['tiCock','tiGun'])if(document.getElementById(id))document.getElementById(id).style.filter=f;PCK.style.filter=f;}
 NIGHT=i;for(const s of LAMPS)s.material.opacity=0.8*t.lamp,s.scale.set(60*t.lamp,60*t.lamp,1);for(const p of POOLS)p.material.opacity=t.pool;}
function buildWorld(){if(world)scene.remove(world);BATT[0]=[];BATT[1]=[];world=new THREE.Group();scene.add(world);LIGHTS=[];LAMPS.length=0;POOLS.length=0;
 materials('isle');const T=yardTextures();
 if(sky)scene.remove(sky);sky=todSky();sky.scale.setScalar(3);scene.add(sky);
 scene.fog=new THREE.FogExp2(lin(THEME.isle.fog),T3.lo?0.00036:0.00028);
 const fl=new THREE.Mesh(new THREE.PlaneGeometry(40000,40000),floorMaterial());fl.rotation.x=-Math.PI/2;fl.position.set(IW/2,0,IH/2);fl.receiveShadow=true;world.add(fl);buildCanal();
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
   const s=new THREE.Sprite(new THREE.SpriteMaterial({map:T.glow,color:0xFFC880,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0.8}));s.position.set(x+Math.cos(a)*10,108,z+Math.sin(a)*10);s.scale.set(60,60,1);world.add(s);LAMPS.push(s);
   /* the pool of light it throws on the ground, seen in the evening and at night */
   const pl=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:T.glow,color:0xFFC070,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0,polygonOffset:true,polygonOffsetFactor:-4}));pl.rotation.x=-Math.PI/2;pl.position.set(x+Math.cos(a)*170,0.8,z+Math.sin(a)*170);pl.scale.set(420,420,1);world.add(pl);POOLS.push(pl);});}
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
  for(let n=0,i=0;i<6000&&n<(isMob?70:110);i++){const q=OBS[Math.floor(rn()*OBS.length)];if(!q||q.k==='blk'||q.k==='canal')continue;const sd=Math.floor(rn()*4),x=q.x+(sd<2?(sd?1:-1)*(q.w/2+16):(rn()-0.5)*q.w*0.8),z=q.z+(sd>=2?(sd===3?1:-1)*(q.d/2+16):(rn()-0.5)*q.d*0.8);
   if(blockedAt(x,z,6)||x<150||z<150||x>IW-150||z>IH-150||nearBase(x,z,400)||nearMine(x,z,160))continue;n++;const k=['box','box','box2','box3','hog','gen'][Math.floor(rn()*6)];pl[k].push([x,z,rn()*6]);}
  for(let n=0,i=0;i<2000&&n<10;i++){const x=300+rn()*(IW-600),z=300+rn()*(IH-600);if(blockedAt(x,z,60)||nearBase(x,z,700)||AIRP.some(([ax,az])=>Math.abs(x-ax)<750&&Math.abs(z-az)<520)||nearMine(x,z,250)||Math.abs(x-IW/2)<WASTE_HW+300)continue;if(pl.tow.some(t=>Math.hypot(t[0]-x,t[1]-z)<900))continue;n++;pl.tow.push([x,z,rn()*6]);}
  for(const k in kinds){const L_=pl[k];if(!L_.length)continue;const [name,len]=kinds[k];let baked;try{const hold=new THREE.Group();hold.add(milProp(name,len,null));baked=bakeGroup(hold);}catch(e){continue;}
   for(const {geo,mat} of baked){const im=add(new THREE.InstancedMesh(geo,mat,L_.length));L_.forEach(([x,z,r],i)=>{o.position.set(x,0,z);o.rotation.set(0,r,0);o.scale.set(1,1,1);o.updateMatrix();im.setMatrixAt(i,o.matrix);});}}}
 /* bases, artillery batteries, mines */
 for(const s of [0,1]){const [bx,bz]=BASES[s];BH[s]=new THREE.Group();world.add(BH[s]);
  for(let k=-1;k<=1;k++){const g=mkGun(s);const gx=bx+(s===0?-340:340),gz=bz+k*90;g.position.set(gx,0,gz);g.rotation.y=s===0?0:Math.PI;world.add(g);BATT[s].push(g);}}
 placeBuildings();
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
function mapImage(){const w=480,h=Math.round(480*IH/IW),c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#6C665C';x.fillRect(0,0,w,h);const k=w/IW;
 {const t=document.createElement('canvas');t.width=w;t.height=h;const tx=t.getContext('2d');tx.drawImage(sandMask(),0,0,w,h);tx.globalCompositeOperation='multiply';tx.fillStyle='#B89A6C';tx.fillRect(0,0,w,h);tx.globalCompositeOperation='destination-in';tx.drawImage(sandMask(),0,0,w,h);x.drawImage(t,0,0);}
 x.strokeStyle='rgba(120,98,70,0.9)';x.lineWidth=2;for(const pl of ROADS_I){x.beginPath();pl.forEach((p,i)=>{i?x.lineTo(p[0]*k,p[1]*k):x.moveTo(p[0]*k,p[1]*k);});x.stroke();}
 for(const o of OBS){x.fillStyle=o.k==='bld'?'#B8B4AA':o.k==='canal'?'#2E5560':o.k==='c'?'#3E3A36':o.k==='hang'?'#2E3236':o.k==='bunk'?'#56524C':'#8A857A';x.fillRect((o.x-o.w/2)*k,(o.z-o.d/2)*k,Math.max(1,o.w*k),Math.max(1,o.d*k));}
 x.strokeStyle='#22201E';x.lineWidth=3;x.strokeRect(1.5,1.5,w-3,h-3);return c;}

/* ================== game state ================== */
let G_=null;const BATT=[[],[]],MINE_O=[];
function newGame(){CUR='titan';spawnPlane();PR.length=0;ART.sh.length=0;ART.cd=0;MIS.length=0;MIS_CD=0;LK.u=null;LK.t=0;spawnDrone();G_={t:0,over:null,id:1,sides:[mkSide(),mkSide()],units:[],towers:[],harv:[],kills:[0,0],mines:MINES_AT.map(([x,z],i)=>({x,z,s:x<IW/2?0:1,lives:MINE_LIVES,acc:0,dead:false,i})),marks:new Set()};
 for(const s of [0,1]){const [bx,bz]=BASES[s],d=s===0?1:-1;
}
 P.dead=0;spawnTitan();}
function mkSide(){return{ore:START_ORE,lives:LIVES,queue:[],qcd:0,grp:null,grpT:-99,botT:0,wave:600,twT:20};}
/* a tower's line of fire: blocked by containers, hangars, bunkers and the other towers */
function towerLOS(t,p){const ox=t.x,oy=PADY+60,oz=t.z,dx=p[0]-ox,dy=p[1]-oy,dz=p[2]-oz,L=Math.hypot(dx,dy,dz);
 for(let d=45;d<L-25;d+=10){const k=d/L,x=ox+dx*k,y=oy+dy*k,z=oz+dz*k;
  for(const o of OBS)if(o.h>PADY+1&&y<=o.h&&inRect(x,z,o,0))return false;
  for(const q of G_.towers)if(q!==t&&!q.dead&&y<PADY+90&&Math.hypot(q.x-x,q.z-z)<28)return false;}
 return true;}
function slotsReset(){G_.slots=[0,1].map(s=>SLOTS.map(([k,x,z])=>{const [wx,wz]=baseW(s,x,z);return {k,x:wx,z:wz,t:addTower(s,k,wx,wz),re:false,w:0};}));}
function stepSlots(dt){for(const sl of G_.slots.flat()){if(!sl.t.dead||sl.re)continue;sl.w+=dt;if(sl.w>=20){sl.re=true;sl.t=addTower(sl.t.s,sl.k,sl.x,sl.z);}}}
function addTower(s,k,x,z){const t={id:G_.id++,s,k,lv:1,x,z,hp:TWS[k].hp,mx:TWS[k].hp,cd:0.5,a:s===0?0:Math.PI};G_.towers.push(t);return t;}
function addHarv(s){const [bx,bz]=BASES[s];const h={id:G_.id++,s,x:bx+(s?-140:140),z:bz+(G_.harv.length%3-1)*40,hp:HARV.hp,mx:HARV.hp,st:'idle',load:0,t:0,path:null,pi:0,m:null,a:0};G_.harv.push(h);return h;}
function sendUnit(s,k){const S=G_.sides[s],c=US[k].cost;if(S.ore<c)return false;S.ore-=c;S.queue.push(k);return true;}
function buyHarv(s){const S=G_.sides[s];if(S.ore<HARV.cost||G_.harv.filter(h=>h.s===s).length>=6)return false;S.ore-=HARV.cost;addHarv(s);return true;}
/* each burst of units takes its own way: a random point on our side, one of the passes (or a random crossing), a random point on theirs */
function groupPath(s,air,G){const [bx,bz]=BASES[s],[ex,ez]=G,d=s===0?1:-1;const st=air?airW(s,0.45,-0.35):baseW(s,-0.02+(rn()-0.5)*0.12,0.40);
 if(air){const mid=[IW/2+(rn()-0.5)*1200,IH*0.15+rn()*IH*0.7];return chaikin([st,mid,[ex,ez]],3);}
 const g=GAPS[Math.floor(rn()*GAPS.length)],v2=[IW/2,g+(rn()-0.5)*40],mid=(a,b,k,j)=>[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k+(rn()-0.5)*j];
 const v1=mid(st,v2,0.45+rn()*0.2,900),v3=mid(v2,[ex,ez],0.4+rn()*0.2,900);
 const seed=1+rn()*900,pts=[st,v1,v2,v3,[ex,ez]];let path=[];for(let i=0;i<pts.length-1;i++){const p=astar(pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],seed);path=path.concat(i?p.slice(1):p);}
 return chaikin(path,2);}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function enemiesOf(s){return G_.units.filter(u=>u.s!==s&&!u.dead);}
const SF=o=>o.safeT>0;                                     // bot air just off its airfield: untouchable, unmarked, holds fire
function dmgUnit(u,d,by){if(u.dead||SF(u))return;u.hp-=d;if(u.hp<=0){u.dead=true;const st=US[u.k];if(by!=null)G_.sides[by].ore+=st.rw*2;deathFx(u);}}
function dmgTower(t,d,by){t.hp-=d;if(t.hp<=0&&!t.dead){t.dead=true;explode(t.x,hgt(t.x,t.z)+8,t.z,1.8);if(by!=null)G_.sides[by].ore+=TWS[t.k].cost*0.25;}}
function dmgHarv(h,d,by){h.hp-=d;if(h.hp<=0&&!h.dead){h.dead=true;explode(h.x,hgt(h.x,h.z)+5,h.z,1.4);if(by!=null)G_.sides[by].ore+=500+(h.load?300:0);}}
function hitBase(s,n){const S=G_.sides[s];if(S.lives<=0)return;S.lives=Math.max(0,S.lives-n);const [bx,bz]=BASES[s];explode(bx+(rn()-0.5)*60,hgt(bx,bz)+20,bz+(rn()-0.5)*60,1.4);if(S.lives<=0){explode(bx,hgt(bx,bz)+30,bz,3);shakeAt(bx,hgt(bx,bz)+30,bz,1.5);}checkOver(s);}
function checkOver(s){if(!G_.over&&G_.sides[s].lives<=0&&!G_.mines.some(m=>m.s===s&&!m.dead))G_.over={w:1-s};}
function hitMine(m,n){if(m.dead)return;m.lives=Math.max(0,m.lives-n);explode(m.x+(rn()-0.5)*60,14,m.z+(rn()-0.5)*50,1.2);if(m.lives<=0){m.dead=true;explode(m.x,20,m.z,2.6);shakeAt(m.x,20,m.z,1.3);checkOver(m.s);}}
function dmgMine(m,d){if(m.dead)return;m.acc+=d;while(m.acc>=MINE_HP&&!m.dead){m.acc-=MINE_HP;hitMine(m,1);}}
const nearMineOf=(s,x,z,r)=>G_.mines.find(m=>m.s===s&&!m.dead&&Math.hypot(m.x-x,m.z-z)<r);
function tracer(a,b,c){tracers.push({id:++SID,a,b,t:0.06,c:c||0xFFE070});}
/* the nearest enemy something can shoot at */
function pickGoal(s){const o=G_.mines.filter(m=>m.s!==s&&!m.dead).map(m=>({k:'m',m}));if(G_.sides[1-s].lives>0||!o.length)o.push({k:'b'},{k:'b'});return o[Math.floor(rn()*o.length)];}
function goalXY(s,g){if(g.k==='m')return [g.m.x,g.m.z];return BRP[1-s];}
function repath(u){u.goal=pickGoal(u.s);const [gx,gz]=goalXY(u.s,u.goal);u.path=US[u.k].air?chaikin([[u.x,u.z],[gx,gz]],2):chaikin(astar(u.x,u.z,gx,gz,u.id%7),2);u.pi=1;}
function pickTarget(s,x,z,rng,hitAir,hitGround,mines,jets){let best=null,bd=rng;
 for(const u of G_.units){if(u.dead||u.s===s||SF(u))continue;const air=US[u.k].air;if(air?!hitAir:!hitGround)continue;const d=Math.hypot(u.x-x,u.z-z);if(d<bd){bd=d;best={k:'u',o:u};}}
 if(hitGround){for(const t of G_.towers){if(t.dead||t.s===s)continue;const d=Math.hypot(t.x-x,t.z-z)-10;if(d<bd){bd=d;best={k:'t',o:t};}}
  for(const h of G_.harv){if(h.dead||h.s===s)continue;const d=Math.hypot(h.x-x,h.z-z);if(d<bd){bd=d;best={k:'h',o:h};}}
  if(s===1&&VUL(P)){const d=Math.hypot(P.x-x,P.z-z)-14;if(d<bd){bd=d;best={k:'p'};}}}
 if(s===1&&jets&&VUL(F)){const d=Math.hypot(F.x-x,F.z-z)+40;if(d<bd){bd=d;best={k:'f'};}}
 if(s===1&&jets&&VUL(D)&&!D.fall){const d=Math.hypot(D.x-x,D.z-z)+60;if(d<bd){bd=d;best={k:'d'};}}
 if(s===0){if(hitGround&&ET.dead<=0){const d=Math.hypot(ET.x-x,ET.z-z)-30;if(d<bd){bd=d;best={k:'et'};}}
  if(jets&&ED.dead<=0&&!SF(ED)){const d=Math.hypot(ED.x-x,ED.z-z)+60;if(d<bd){bd=d;best={k:'ed'};}}
  if(jets&&EF.dead<=0&&!SF(EF)){const d=Math.hypot(EF.x-x,EF.z-z)+40;if(d<bd){bd=d;best={k:'ef'};}}}
 if(!best&&mines)for(const m of G_.mines){if(m.dead||m.s===s)continue;const d=Math.hypot(m.x-x,m.z-z)-60;if(d<bd){bd=d;best={k:'m',o:m};}}
 return best;}
const tpos=tg=>tg.k==='et'?[ET.x,26,ET.z]:tg.k==='ed'?[ED.x,ED.y,ED.z]:tg.k==='ef'?[EF.x,EF.y,EF.z]:tg.k==='f'?[F.x,F.y,F.z]:tg.k==='d'?[D.x,D.y,D.z]:tg.k==='p'?[P.x,hgt(P.x,P.z)+14,P.z]:tg.k==='u'?[tg.o.x,tg.o.y+6,tg.o.z]:tg.k==='t'?[tg.o.x,hgt(tg.o.x,tg.o.z)+14,tg.o.z]:tg.k==='m'?[tg.o.x+(rn()-0.5)*60,10,tg.o.z+(rn()-0.5)*50]:[tg.o.x,hgt(tg.o.x,tg.o.z)+7,tg.o.z];
function applyHit(tg,d,by){if(tg.k==='u')dmgUnit(tg.o,d,by);else if(tg.k==='t')dmgTower(tg.o,d,by);else if(tg.k==='h')dmgHarv(tg.o,d,by);else if(tg.k==='m')dmgMine(tg.o,d);else if(tg.k==='p'){if(!P.inv){P.hp-=d;P.hurt=0.25;}}else if(tg.k==='d'){if(VUL(D)){D.hp-=d;D.hurt=0.25;}}else if(tg.k==='f'){if(!F.inv){F.hp-=d;F.hurt=0.25;}}else if(tg.k==='et')ET.hp-=d;else if(tg.k==='ed'){if(!SF(ED))ED.hp-=d;}else if(tg.k==='ef'){if(!SF(EF))EF.hp-=d;if(by===0)efThreat();}}
function splash(s,x,z,r,d,by){for(const u of G_.units){if(u.dead||u.s===s||US[u.k].air)continue;const k=Math.hypot(u.x-x,u.z-z);if(k<r)dmgUnit(u,d*(k<r*0.5?1:0.6),by);}
 for(const h of G_.harv){if(!h.dead&&h.s!==s&&Math.hypot(h.x-x,h.z-z)<r)dmgHarv(h,d,by);}}

function stepGame(dt){if(G_.over)return;G_.t+=dt;
 for(const s of [0,1]){const S=G_.sides[s];S.ore+=BASE_INC*dt;for(const m of G_.mines)if(m.s===s&&!m.dead)S.ore+=MINE_INC*dt;
  S.qcd-=dt;if(S.queue.length&&S.qcd<=0){const k=S.queue.shift();const air=US[k].air;if(!S.grp||G_.t-S.grpT>5||S.grpAir!==air){S.goal=pickGoal(s);S.grp=groupPath(s,air,goalXY(s,S.goal));S.grpAir=air;S.grpN=0;}S.grpT=G_.t;S.grpN++;
   const [bx,bz]=BASES[s];const st=US[k];const hg=k==='tank'?baseW(s,-0.256,0.02):k==='jeep'?baseW(s,0.287,0.02):null;const u={id:G_.id++,s,k,x:hg?hg[0]:S.grp[0][0],z:hg?hg[1]:S.grp[0][1],y:0,hp:st.hp,mx:st.hp,path:hg?[hg,...(k==='tank'?[baseW(s,-0.265,0.18),baseW(s,-0.20,0.33)]:[baseW(s,0.225,0.18),baseW(s,0.17,0.33)]),...S.grp]:S.grp,goal:S.goal,pi:1,cd:rn(),off:((S.grpN%5)-2)*14,tg:null,scan:rn()*0.3,a:s===0?0:Math.PI};
   u.y=st.air?hgt(u.x,u.z)+ALT[k]:hgt(u.x,u.z);if(st.air&&s===1)u.safeT=10;G_.units.push(u);S.qcd=0.55;}}
 /* units: shoot what is in range, otherwise keep going */
 for(const u of G_.units){if(u.dead)continue;const st=US[u.k];u.cd-=dt;u.scan-=dt;if(u.safeT>0){u.safeT-=dt;u.tg=null;u.scan=0;u.mk=0;}
  if(u.scan<=0&&!SF(u)){u.scan=0.3;/* stay on the current target while it is alive and in range, so units don't flick between two */
   const o=u.tg,keep=o&&o.k==='u'&&!o.o.dead&&Math.hypot(o.o.x-u.x,o.o.z-u.z)<st.rng+20;if(!keep)u.tg=pickTarget(u.s,u.x,u.z,st.rng,st.hitAir,true,true);}
  const [ex,ez]=BRP[1-u.s];
  if(G_.sides[1-u.s].lives>0&&Math.hypot(u.x-ex,u.z-ez)<190){u.dead=true;u.breach=true;hitBase(1-u.s,st.lives);continue;}
  if(u.goal&&(u.goal.k==='m'?u.goal.m.dead:G_.sides[1-u.s].lives<=0)&&(G_.mines.some(m=>m.s!==u.s&&!m.dead)||G_.sides[1-u.s].lives>0)){u.rp=(u.rp==null?rn()*0.8:u.rp)-dt;if(u.rp<=0){u.rp=null;repath(u);}}
  let tg=u.tg;if(tg&&((tg.o&&tg.o.dead)||(tg.k==='p'&&P.dead>0)||(tg.k==='et'&&ET.dead>0)||(tg.k==='ed'&&ED.dead>0)||(tg.k==='ef'&&EF.dead>0)))tg=u.tg=null;
  if(tg){const [tx,ty,tz]=tpos(tg);{const ax=tg.o&&tg.o.x!=null?tg.o.x:tx,az=tg.o&&tg.o.z!=null?tg.o.z:tz;if(Math.hypot(ax-u.x,az-u.z)>25)u.ga=Math.atan2(az-u.z,ax-u.x);}if(u.cd<=0){u.cd=st.cd;if(st.splash){splash(u.s,tx,tz,st.splash,st.dmg,u.s);if(tg.k!=='u'&&tg.k!=='h')applyHit(tg,st.dmg,u.s);explode(tx,ty-4,tz,0.45);}else applyHit(tg,st.dmg*(tg.k==='p'?0.4:1),u.s);
    if(Math.hypot(u.x-cam.position.x,u.z-cam.position.z)<1400)tracer([u.x,u.y+8,u.z],[tx,ty,tz],u.s===0?0x9FD0FF:0xFFC070);}
   if(!st.air)continue;}
  /* follow the path */
  const p=u.path,last=u.pi>=p.length-1;let t=p[Math.min(u.pi,p.length-1)];
  /* at the end of the route helicopters spread into their own hover slots instead of all sitting on one point */
  if(last&&st.air&&!(u.goal&&u.goal.k==='b')){const h=u.id*2.39996,r=45+(u.id%5)*28;t=[t[0]+Math.cos(h)*r,t[1]+Math.sin(h)*r];}   // a base is entered, not circled
  const dx=t[0]-u.x,dz=t[1]-u.z,d=Math.hypot(dx,dz);if(d<20&&!last){u.pi++;continue;}
  const sl=st.air?0:slope(u.x,u.z);let v=st.sp*USPK*(tg&&st.air?0.35:1)*(1-Math.min(0.6,sl*0.8))*dt;const a=Math.atan2(dz,dx);
  if(last){v*=Math.min(1,d/70);if(d<(st.air?4:14))v=0;}/* arrive and stop: no overshooting back and forth around the last point */
  const ox=last?0:-Math.sin(a)*u.off*0.02,oz=last?0:Math.cos(a)*u.off*0.02;
  if(!st.air){const mx=Math.cos(a)+ox,mz=Math.sin(a)+oz,want=Math.atan2(mz,mx);if(u.a==null)u.a=want;let da=want-u.a;da=Math.atan2(Math.sin(da),Math.cos(da));
   if(v>dt*4){const R_=(u.k==='tank'?1.7:2.8)*dt;u.a+=Math.max(-R_,Math.min(R_,da));}const f=(Math.abs(da)>1.0?0:Math.max(0.2,Math.cos(da)))*Math.hypot(mx,mz);/* a sharp turn is made on the spot: no circling round a point */u.x+=Math.cos(u.a)*v*f;u.z+=Math.sin(u.a)*v*f;}
  else{u.x+=Math.cos(a)*v+ox*v;u.z+=Math.sin(a)*v+oz*v;if(tg&&u.ga!=null)u.a=u.ga;else if((!last||d>60)&&v>st.sp*USPK*dt*0.5)u.a=a;}
  const gy=hgt(u.x,u.z);u.y=st.air?u.y+(Math.max(gy,0)+ALT[u.k]-u.y)*Math.min(1,dt*1.5):gy;}
 /* ground machines give way to the Titans */
 for(const u of G_.units){if(u.dead||US[u.k].air)continue;for(const T of [P,ET]){if(T.dead>0)continue;const dx=u.x-T.x,dz=u.z-T.z,d=Math.hypot(dx,dz),R_=u.k==='tank'?95:u.k==='jeep'?85:40;
  if(d<R_){const k=(R_-d)/(d||1);let nx=dx*k,nz=dz*k;if(!d){nx=R_;nz=0;}if(!blockedAt(u.x+nx,u.z+nz,10)){u.x+=nx;u.z+=nz;}}}}
 /* ground machines don't drive into one another */
 {const gs=G_.units.filter(u=>!u.dead&&!US[u.k].air);for(let i=0;i<gs.length;i++)for(let j=i+1;j<gs.length;j++){const A=gs[i],B=gs[j],R_=(A.k==='tank'?20:15)+(B.k==='tank'?20:15);const dx=B.x-A.x,dz=B.z-A.z;if(Math.abs(dx)>R_||Math.abs(dz)>R_)continue;const d=Math.hypot(dx,dz);
  if(d<R_){const k=Math.min(30,(R_-d)*2)*dt/(d||1),px=(d?dx:1)*k,pz=(d?dz:(A.id%2?1:-1))*k;if(!blockedAt(A.x-px,A.z-pz,10)){A.x-=px;A.z-=pz;}if(!blockedAt(B.x+px,B.z+pz,10)){B.x+=px;B.z+=pz;}}}}
 /* helicopters keep a little room between each other instead of overlapping */
 {const hs=G_.units.filter(u=>!u.dead&&US[u.k].air);for(let i=0;i<hs.length;i++)for(let j=i+1;j<hs.length;j++){const A=hs[i],B=hs[j];const dx=B.x-A.x,dz=B.z-A.z,d=Math.hypot(dx,dz);
  if(d<70){const k=Math.min(25,(70-d)*1.2)*dt/(d||1),px=(d?dx:1)*k,pz=(d?dz:0)*k;A.x-=px;A.z-=pz;B.x+=px;B.z+=pz;}}}
 for(const u of G_.units)if(u.dead&&!u.cnt){u.cnt=1;if(!u.breach)G_.kills[u.s]++;}
 G_.units=G_.units.filter(u=>!u.dead||(u.t_=(u.t_||0)+dt)<0.05);
 /* towers */
 for(const t of G_.towers){if(t.dead)continue;const st=TWS[t.k];t.cd-=dt;if(t.cd>0)continue;const tg=pickTarget(t.s,t.x,t.z,st.rng,st.air,st.ground,false,t.k==='rkt');if(!tg)continue;
  if(t.k==='mg'&&G_.slots&&!towerLOS(t,tpos(tg))){t.cd=0.35;continue;}
  const [tx,ty,tz]=tpos(tg);t.a=Math.atan2(tz-t.z,tx-t.x);t.cd=st.cd;
  if(t.k==='rkt'&&G_.slots){for(let q=0;q<2;q++){const sd=q?1:-1,c=Math.cos(t.a),sn=Math.sin(t.a);TRK.push({id:++EID,s:t.s,tg,dmg:st.dmg/2,x:t.x+c*40-sn*sd*16,y:PADY+70,z:t.z+sn*40+c*sd*16,t:-q*0.18,tr:0,lx:tx,ly:ty,lz:tz});}continue;}
  if(st.splash)splash(t.s,tx,tz,st.splash,st.dmg,t.s);if(!st.splash||tg.k!=='u')applyHit(tg,st.dmg*(tg.k==='p'?0.5:1),t.s);
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
 bot(1,dt);bot(0,dt);testWaves(dt);}

/* ---------- the bot: harvesters first, waves of mixed units, towers on its side ---------- */
function bot(s,dt){const S=G_.sides[s];S.botT-=dt;if(S.botT>0)return;S.botT=1.2;
 if(false){const [bx,bz]=BASES[s],d=s===0?1:-1;const k=['mg','can','rkt','tes'][Math.floor(rn()*4)];
  for(let i=0;i<30;i++){const x=bx+d*(250+rn()*900),z=bz+(rn()-0.5)*1600;if(blockedAt(x,z,30)||x<150||x>IW-150||z<150||z>IH-150)continue;if(G_.towers.some(t=>Math.hypot(t.x-x,t.z-z)<120))continue;S.ore-=TWS[k].cost;addTower(s,k,x,z);break;}}
 if(S.ore>=S.wave){const mix=['jeep','tank','heli','jeep','tank','heli'];let n=0;while(n<12){const k=mix[Math.floor(rn()*mix.length)];if(!sendUnit(s,k))break;n++;}S.wave=500+rn()*900;}}

/* ================== drawing the game state ================== */
const live=new Map();let FR=0;
/* Tripo models: red jeep and red tank, each with a blue repaint for our side; nose along +Z like the military pack */
const XM={jeep:{f:'rjeep.glb',len:21,sides:[0,1],blue:'jeep_blue.jpg'},tank:{f:'rtank.glb',len:30,sides:[0,1],blue:'tank_blue.jpg'},
 heli:{f:'rheli.glb',len:46,sides:[0,1],blue:'heli_blue.jpg',hub:[0,0.372,0.105],rr:0.44,dy:-7}};
/* each file carries its content hash (so a phone never keeps a stale copy), and a failed download is retried a few times */
const XMV={"rjeep.glb": "8aedd0df", "rtank.glb": "7fe57172", "rheli.glb": "94a7bb34", "jeep_blue.jpg": "35b1e580", "tank_blue.jpg": "fdfbbf96", "heli_blue.jpg": "374acf1f"};
function xmLoad(m,tries){new THREE.GLTFLoader().load(m.f+'?v='+(XMV[m.f]||'0')+(tries?'&r='+tries:''),g=>{g.scene.traverse(o=>{if(o.isMesh){o.material.envMapIntensity=0.5;if(o.material.map)o.material.map.anisotropy=4;}});m.sc=g.scene;},undefined,
  e=>{console.error(m.f,e);if(tries<4)setTimeout(()=>xmLoad(m,tries+1),1500*(tries+1));});}
function xmTex(m,tries){new THREE.TextureLoader().load(m.blue+'?v='+(XMV[m.blue]||'0')+(tries?'&r='+tries:''),t=>{t.flipY=false;t.encoding=THREE.sRGBEncoding;t.anisotropy=4;m.bt=t;},undefined,()=>{if(tries<4)setTimeout(()=>xmTex(m,tries+1),1500*(tries+1));});}
if(THREE.GLTFLoader)for(const k in XM){const m=XM[k];xmLoad(m,0);if(m.blue)xmTex(m,0);}
const xmOK=(k,s)=>{const m=XM[k];return !!(m&&m.sc&&m.sides.includes(s)&&(s===1||!m.blue||m.bt));};
/* ---------- base, airfield and the two kinds of tower: blue in the files, red textures for the bot ---------- */
const BLDV={"b_base.glb": "91bc26f8", "b_air.glb": "d3f8ded2", "b_mg.glb": "b9dbca69", "b_rkt.glb": "1c6ed6ac", "b_base_red.jpg": "73239aea", "b_air_red.jpg": "5e123317", "b_mg_red.jpg": "a0f8bdc4", "b_rkt_red.jpg": "143a1d7a"};
const BLD={base:{f:'b_base.glb',red:'b_base_red.jpg'},air:{f:'b_air.glb',red:'b_air_red.jpg'},mg:{f:'b_mg.glb',red:'b_mg_red.jpg'},rkt:{f:'b_rkt.glb',red:'b_rkt_red.jpg'}};
const BH=[null,null],TS=95;
function bldLoad(m,k,tries){new THREE.GLTFLoader().load(m.f+'?v='+(BLDV[m.f]||'0')+(tries?'&r='+tries:''),g=>{g.scene.traverse(o=>{if(o.isMesh){o.material.envMapIntensity=1.1;o.material.roughness=Math.max(o.material.roughness,0.55);if(o.material.map)o.material.map.anisotropy=8;o.castShadow=k!=='air';o.receiveShadow=true;}});
  if(k==='mg'){const top=g.scene.getObjectByName('top');if(top){/* the gun head turns about the middle of its black neck */const px=0,pz=-0.077;top.geometry.translate(-px,0,-pz);top.position.set(px,0,pz);}}
  if(k==='air')g.scene.traverse(o=>{if(o.isMesh){o.material.roughness=0.95;o.material.envMapIntensity=0.3;greyDark(o.material);}});warpBld(k,g.scene);m.sc=g.scene;placeBuildings();},undefined,e=>{console.error(m.f,e);if(tries<4)setTimeout(()=>bldLoad(m,k,tries+1),1500*(tries+1));});
 new THREE.TextureLoader().load(m.red+'?v='+(BLDV[m.red]||'0'),t=>{t.flipY=false;t.encoding=THREE.sRGBEncoding;t.anisotropy=8;m.rt=t;placeBuildings();});}
if(THREE.GLTFLoader)for(const k in BLD)bldLoad(BLD[k],k,0);
const WARP={"air":{"z0":-0.5000000596046448,"z1":0.5000000596046448,"p":[0.00844,0.00844,0.00849,0.00848,0.00845,0.00862,0.00857,0.00868,0.00839,0.00792,0.00734,0.00652,0.00539,0.00455,0.00335,0.00236,0.0014,0.00023,-0.00064,-0.00167,-0.00296,-0.00416,-0.00562,-0.00686,-0.00844,-0.00949,-0.01084,-0.01233,-0.01273,-0.01551,-0.01538,-0.01849,-0.01849]},"base":{"x0":-0.5000000596046448,"x1":0.5000000596046448,"z0":-0.40426647663116455,"z1":0.40426647663116455,"N":33,"g":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-0.00028,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-0.00097,-0.00077,-0.00042,0,0,0,0,0,0,0,0,0,0,0,0,-0.00048,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-0.00157,-0.0015,-0.00143,-0.00074,0,0,0,0,0,0,0,0,0,0,-0.00019,-0.00045,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-0.00178,-0.00152,-0.00126,-0.00066,-0.00015,0,0,0,0,0,0,0,0,0,-0.00044,-0.00035,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-0.00121,-0.00102,-0.00083,-0.00049,-0.00024,0,0,0,0,0,0,0,0,-0.00018,-0.00052,-0.00027,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-0.00064,-0.00046,-0.00027,0,0,0,0,0,0,0,0,0,-0.00019,-0.00049,-0.00059,-0.00025,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-8e-05,-8e-05,-8e-05,0,0,0,0,0,0,0,0,-9e-05,-0.00043,-0.00069,-0.00071,-0.00035,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-8e-05,-8e-05,0.0,0,0,0,0,0,0,0,0,-0.00022,-0.00062,-0.00093,-0.00087,-0.0005,-0.00016,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-8e-05,-8e-05,0,0,0,0,0,0,0,0,-3e-05,-0.00039,-0.00078,-0.00102,-0.00097,-0.0007,-0.00034,-6e-05,0,0,-0.0,-2e-05,0,0,0,0,0,0,0,0,0,0,0,-8e-05,-8e-05,0,0,0,0,0,0,0,0,-0.00015,-0.00055,-0.00094,-0.00107,-0.00102,-0.00086,-0.00049,-0.00017,0,0,-1e-05,-4e-05,0,0,0,0,0,0,0,0,0,0,0,-8e-05,0.0,0,0,0,0,0,0,0,0,-0.00028,-0.00067,-0.00107,-0.00106,-0.00101,-0.00097,-0.0006,-0.00027,0,-1e-05,-4e-05,0,0,0,0,0,-0.0002,-0.0002,-0.0002,-0.0002,0,0,0,-8e-05,0,0,0,0,0,0,0,0,-1e-05,-0.00041,-0.0008,-0.00106,-0.00106,-0.00101,-0.00097,-0.0006,-0.00029,0.0,-6e-05,-6e-05,0,0,0,0,0,-0.0002,-0.0002,-0.0002,-0.0002,-0.0002,-0.0002,-0.0002,-8e-05,0,0,0,0,0,0,0,0,-8e-05,-0.00047,-0.00086,-0.00106,-0.00106,-0.00101,-0.00097,-0.00059,-0.0003,-3e-05,-9e-05,-8e-05,0,0,0,0,0,-0.0002,-0.0002,-0.0002,-0.0002,-0.0002,-0.0002,-0.0002]}};
/* the Tripo airfield sags ~30 m along its runway and the base yard dips below the ground in places: bend the floors flat (once, on the shared geometry) */
function warpBld(k,sc){const W=WARP[k];if(!W)return;sc.updateMatrixWorld(true);const v=new THREE.Vector3(),inv=new THREE.Matrix4();
 const lerp1=(p,t)=>{t=Math.max(0,Math.min(p.length-1,t));const i=Math.min(p.length-2,Math.floor(t)),f=t-i;return p[i]*(1-f)+p[i+1]*f;};
 const dAt=(x,z)=>{if(k==='air')return lerp1(W.p,(z-W.z0)/(W.z1-W.z0)*(W.p.length-1));const N=W.N,tx=Math.max(0,Math.min(N-1,(x-W.x0)/(W.x1-W.x0)*(N-1))),tz=Math.max(0,Math.min(N-1,(z-W.z0)/(W.z1-W.z0)*(N-1)));
  const i=Math.min(N-2,Math.floor(tx)),j=Math.min(N-2,Math.floor(tz)),fx=tx-i,fz=tz-j,g=W.g;return (g[j*N+i]*(1-fx)+g[j*N+i+1]*fx)*(1-fz)+(g[(j+1)*N+i]*(1-fx)+g[(j+1)*N+i+1]*fx)*fz;};
 sc.traverse(o=>{if(!o.isMesh||o.geometry.userData.warped)return;o.geometry.userData.warped=1;const pa=o.geometry.attributes.position;inv.copy(o.matrixWorld).invert();
  for(let i=0;i<pa.count;i++){v.fromBufferAttribute(pa,i).applyMatrix4(o.matrixWorld);v.y-=dAt(v.x,v.z);v.applyMatrix4(inv);pa.setXYZ(i,v.x,v.y,v.z);}
  pa.needsUpdate=true;o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();});}
const bldOK=(k,s)=>{const m=BLD[k];return !!(m&&m.sc&&(s===0||m.rt));};
function bldInst(k,s){const m=BLD[k],c=m.sc.clone(true);if(s===1)c.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.map=m.rt;if(k==='air')greyDark(o.material);}});return c;}
function greyDark(mt){mt.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <output_fragment>','#include <output_fragment>\n{float l=dot(gl_FragColor.rgb,vec3(0.299,0.587,0.114));gl_FragColor.rgb=mix(vec3(l*0.9),gl_FragColor.rgb,0.1+0.9*smoothstep(0.06,0.35,l));}');};mt.customProgramCacheKey=()=>'greyDark';mt.needsUpdate=true;}
function placeBuildings(){for(const s of [0,1]){const H_=BH[s];if(!H_||H_.userData.done)continue;if(!bldOK('base',s)||!bldOK('air',s))continue;H_.userData.done=1;
  const turn=s===0?Math.PI/2:-Math.PI/2,[bx,bz]=BASES[s],[ax,az]=AIRP[s];
  const g=new THREE.Group();g.rotation.y=turn;g.position.set(bx,-BSINK+0.4,bz);const b=bldInst('base',s);b.scale.setScalar(BS);b.rotation.y=BROT;b.position.set(-BXC*BS,0,-BZC*BS);const lb=new THREE.Group();lb.add(b);g.add(lb);H_.add(g);
  const a=new THREE.Group();a.rotation.y=turn;a.position.set(ax,-ASINK+0.4,az);const m=bldInst('air',s);m.scale.setScalar(AS);const la=new THREE.Group();la.add(m);a.add(la);H_.add(a);}}
/* top of a tower pad under a slot (the pads moved a little with the levelling) */
function padAt(s,x,z){const H_=BH[s];if(!H_)return PADY;const rc=new THREE.Raycaster(new THREE.Vector3(x,300,z),new THREE.Vector3(0,-1,0));const h=rc.intersectObject(H_,true).find(q=>Math.abs(q.point.y-PADY)<8);return h?h.point.y:PADY;}
function buildBT(k,s){const g=new THREE.Group(),c=bldInst(k,s);c.scale.setScalar(TS);g.add(c);g.userData.top=c.getObjectByName('top');return g;}
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
/* screen shake from a kill: strong when close, fading with distance; the drone sits 450 m up, so its range starts further out */
let SHK=0;
function shakeAt(x,y,z,pw){const d=cam.position.distanceTo(FSP.center.set(x,y,z));const [d0,d1]=CUR==='drone'?[550,1700]:CUR==='plane'?[200,1100]:[150,950];
 const k=Math.max(0,Math.min(1,1-(d-d0)/(d1-d0)));if(k>0)SHK=Math.max(SHK,pw*k);}
function applyShake(dt){if(SHK<=0)return;const z=CUR==='drone'?D.zoom||1:CUR==='plane'?ZF():P.zoom||1,a=SHK*SHK*0.02/z;cam.rotateX((rn()-0.5)*a);cam.rotateY((rn()-0.5)*a);cam.rotateZ((rn()-0.5)*a*0.6);SHK=Math.max(0,SHK-dt*1.8);}
function bigBlast(x,y,z,S,n){shakeAt(x,y,z,Math.min(1.3,0.55+S/110));if(!WU.on&&!AUD.sample((n||1)>=3?'boomM':'boom1',x,z,(n||1)>=3?0.75:0.55))AUD.play('kill',x,z,0.8+S/120);
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
function darken(o){o.traverse(m=>{if(!m.isMesh)return;let d=DKM.get(m.material.uuid);if(!d){d=m.material.clone();if(d.color)d.color.multiplyScalar(0.12);if(d.emissive)d.emissive.setRGB(0,0,0);DKM.set(m.material.uuid,d);}m.material=d;});}
function takeVisual(u){const e=u.vk&&live.get(u.vk);if(!e)return null;live.delete(u.vk);return e.o;}
function makeWreck(u,x,y,z,o){o=o||takeVisual(u);if(!o)return;darken(o);o.rotation.z=(rn()-0.5)*0.2;o.rotation.x=(rn()-0.5)*0.15;o.position.set(x,y,z);
 if(WRK.length>=14){const w=WRK.shift();dyn.remove(w.o);if(w.mats)for(const c of w.mats)c.dispose();}const hop=u.k==='heli'?null:{vy:15+rn()*4,vx:(rn()-0.5)*6,vz:(rn()-0.5)*6,wx:(rn()<0.5?-1:1)*(0.5+rn()*0.6),wz:(rn()<0.5?-1:1)*(0.4+rn()*0.6),h:0,n:0};
 WRK.push({o,x,y,z,t:0,T:5.8,R:UR[u.k]||30,b:0,hop});}
function startFall(u){const R=UR.heli;if(seen(u.x,u.y,u.z,R*2)){for(let i=0;i<3;i++)fire(u.x,u.y,u.z,R*0.8,R*2,0.5,(rn()-0.5)*R,R*0.3,(rn()-0.5)*R,0.07,0.55,i<1,0.95,2);
  smoke(u.x,u.y,u.z,R*1,R*2.8,2,0,R*0.2,0,0.12,0,0.8,1);}
 const o=takeVisual(u),sp=40;if(!o){queueBlast(u.x,Math.max(0,hgt(u.x,u.z)),u.z,R);return;}
 FALL.push({u,o,x:u.x,y:u.y,z:u.z,vx:Math.cos(u.a)*sp,vz:Math.sin(u.a)*sp,vy:0,spin:(rn()<0.5?-1:1)*(2+rn()*1.5),t:0,tr:0});}
function stepFx(dt){
 for(let i=BLQ.length-1;i>=0;i--){const b=BLQ[i];b.t-=dt;if(b.t<=0){BLQ.splice(i,1);bigBlast(b.x,b.y,b.z,b.R*Math.min(2.3,1+0.32*(b.n-1)),b.n);}}
 for(let i=FALL.length-1;i>=0;i--){const f=FALL[i];f.t+=dt;f.vy=Math.max(-150,f.vy-70*dt);f.x+=f.vx*dt;f.z+=f.vz*dt;f.y+=f.vy*dt;const o=f.o;o.position.set(f.x,f.y,f.z);o.rotation.y+=f.spin*dt;o.rotation.z=Math.min(0.55,f.t*0.4);
  if(o.userData.rot)o.userData.rot.rotation.y+=dt*Math.max(4,20-f.t*8);
  f.tr-=dt;if(f.tr<=0){f.tr=0.07;if(seen(f.x,f.y,f.z,80)){smoke(f.x,f.y+6,f.z,28,90,1.8,0,8,0,0.1,0,0.85,1);if(rn()<0.7)fire(f.x,f.y+4,f.z,30,12,0.25,0,0,0,0.07,0.6,true,1,0);}}
  const gy=Math.max(0,hgt(f.x,f.z));if(f.y<=gy+3||f.t>8){FALL.splice(i,1);queueBlast(f.x,gy,f.z,UR.heli*1.2);o.rotation.z=0.35;makeWreck(f.u,f.x,gy-2,f.z,o);}}
 for(let i=WRK.length-1;i>=0;i--){const w=WRK[i];w.t+=dt;
  /* the blast throws the burning hulk up with a twist; it lands, bounces twice, settles crooked */
  const hp=w.hop;if(hp&&hp.n<3){hp.vy-=26*dt;hp.h+=hp.vy*dt;w.x+=hp.vx*dt;w.z+=hp.vz*dt;w.o.rotation.x+=hp.wx*dt;w.o.rotation.z+=hp.wz*dt;
   if(hp.h<=0){hp.h=0;hp.n++;hp.vy=-hp.vy*0.45;hp.vx*=0.4;hp.vz*=0.4;hp.wx*=-0.45;hp.wz*=-0.45;
    w.o.rotation.x=Math.max(-0.3,Math.min(0.3,w.o.rotation.x));w.o.rotation.z=Math.max(-0.3,Math.min(0.3,w.o.rotation.z));if(hp.n<3&&seen(w.x,w.y,w.z,w.R*2))puff(w.x,w.y+2,w.z,'dust');}
   w.o.position.set(w.x,w.y+hp.h,w.z);}
  if(w.t<w.T-1.8){w.b-=dt;if(w.b<=0){w.b=0.2+rn()*0.1;if(seen(w.x,w.y+20,w.z,w.R*1.5)){fire(w.x+(rn()-0.5)*w.R*0.6,w.y+(w.hop?w.hop.h:0)+w.R*0.25,w.z+(rn()-0.5)*w.R*0.6,w.R*0.7,w.R*0.3,0.55,0,w.R*0.5,0,0.07,0.6,true,1,0);
   smoke(w.x+(rn()-0.5)*w.R*0.4,w.y+(w.hop?w.hop.h:0)+w.R*0.35,w.z+(rn()-0.5)*w.R*0.4,w.R*0.8,w.R*2.6,2.4,4,w.R*0.45,0,0.08+rn()*0.06,0,0.8,0.6);}}}
  else{/* crumbles into ash that the wind carries off, while the hulk fades */
   if(!w.mats){w.mats=[];w.sy=w.o.scale.y;w.o.traverse(m=>{if(!m.isMesh)return;const c=m.material.clone();c.userData.o0=c.opacity;c.transparent=true;c.depthWrite=false;m.material=c;w.mats.push(c);});}
   const k=(w.t-(w.T-1.8))/1.8;for(const c of w.mats)c.opacity=Math.max(0,1-k*1.15)*(c.userData.o0!=null?c.userData.o0:1);w.o.scale.y=w.sy*(1-0.35*k);
   w.b-=dt;if(w.b<=0){w.b=0.05;if(seen(w.x,w.y+20,w.z,w.R*2)){for(let n=0;n<2;n++){const g=0.42+rn()*0.2;smoke(w.x+(rn()-0.5)*w.R*1.1,w.y+w.R*(0.1+rn()*0.35),w.z+(rn()-0.5)*w.R*1.1,w.R*0.25,w.R*(0.8+rn()*0.4),1.4+rn()*0.6,28+rn()*22,10+rn()*18,(rn()-0.5)*14,g,0,0.75*(1-k*0.5),0.4);}}}}
  if(w.t>=w.T){dyn.remove(w.o);if(w.mats)for(const c of w.mats)c.dispose();WRK.splice(i,1);}}
 for(let i=RINGS.length-1;i>=0;i--){const r=RINGS[i];r.t+=dt;const k=r.t/0.5;if(k>=1){scene.remove(r.m);r.m.material.dispose();RINGS.splice(i,1);continue;}const sc=r.S*(0.4+2.8*Math.sqrt(k));r.m.scale.set(sc,sc,1);r.m.material.opacity=0.8*(1-k);}
 for(let i=DEBR.length-1;i>=0;i--){const d=DEBR[i];d.t+=dt;if(d.t>2.2){scene.remove(d.m);DEBR.splice(i,1);continue;}const m=d.m,gy=Math.max(0,hgt(m.position.x,m.position.z))+0.5;
  if(m.position.y>gy||d.vy>0){d.vy-=200*dt;m.position.x+=d.vx*dt;m.position.y+=d.vy*dt;m.position.z+=d.vz*dt;m.rotation.x+=d.sx*dt;m.rotation.z+=d.sz*dt;if(m.position.y<gy){m.position.y=gy;d.vy=0;d.vx=d.vz=0;}}
  if(d.t>1.6)m.position.y-=dt*6;}
 for(let i=FXP.length-1;i>=0;i--){const p=FXP[i];p.t+=dt;if(p.t<0){p.s.visible=false;continue;}p.s.visible=true;const k=p.t/p.T;if(k>=1){fxFree(p.s);FXP.splice(i,1);continue;}
  const dr=p.drag?Math.exp(-p.drag*dt):1;p.vx*=dr;p.vz*=dr;p.vy*=dr;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
  const r=p.r0+(p.r1-p.r0)*Math.sqrt(k);p.s.position.set(p.x,p.y,p.z);p.s.scale.set(r,r,1);p.s.material.opacity=p.a*(k<0.1?k/0.1:1)*(1-k);}}
function fxReset(){for(const p of FXP)fxFree(p.s);FXP.length=0;BLQ.length=0;for(const r of RINGS){scene.remove(r.m);r.m.material.dispose();}RINGS.length=0;for(const d of DEBR)scene.remove(d.m);DEBR.length=0;
 for(const w of WRK){dyn.remove(w.o);if(w.mats)for(const c of w.mats)c.dispose();}WRK.length=0;for(const f of FALL)dyn.remove(f.o);FALL.length=0;}
/* at dusk and at night machines carry lights: headlights and a pool of light ahead on the ground, a team lamp on top;
   helicopters a searchlight on the ground below them and a blinking strobe */
let NIGHT=0;const SHF={f:new THREE.Vector3(),r:new THREE.Vector3(),u:new THREE.Vector3()};const NLM={},NLG=new THREE.PlaneGeometry(1,1);
function nightLights(g,k,s){if(k==='inf')return;g.updateMatrixWorld(true);const bb=new THREE.Box3().setFromObject(g),sz=bb.getSize(new THREE.Vector3()),fx=bb.max.x,cy=(bb.min.y+bb.max.y)/2,L=Math.max(sz.x,sz.z);
 const grp=new THREE.Group();grp.visible=false;const spr=(c,sc,x,y,z,o)=>{const key='s'+c+'_'+(o||1);const mt=NLM[key]||(NLM[key]=new THREE.SpriteMaterial({map:TX.glow,color:c,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:o||1}));const m=new THREE.Sprite(mt);m.scale.set(sc,sc,1);m.position.set(x,y,z);grp.add(m);return m;};
 const flat=(c,w,d,x,y,z,o)=>{const key='f'+c+'_'+o;const mt=NLM[key]||(NLM[key]=new THREE.MeshBasicMaterial({map:TX.glow,color:c,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:o,polygonOffset:true,polygonOffsetFactor:-4}));const m=new THREE.Mesh(NLG,mt);m.rotation.x=-Math.PI/2;m.scale.set(w,d,1);m.position.set(x,y,z);grp.add(m);return m;};
 const team=s?0xFF4030:0x40A0FF;
 if(k==='heli'){grp.userData.pool=flat(0xFFF0D0,L*1.6,L*1.6,L*0.2,0,0,0.7);spr(team,L*0.3,0,bb.max.y+1,0,1);spr(team,L*0.5,0,cy,0,0.35);spr(0xFFFFFF,L*0.16,fx-L*0.05,bb.min.y+2,0);grp.userData.blink=spr(0xFFFFFF,L*0.5,bb.min.x+L*0.05,cy,0);}
 else{const hy=bb.min.y+sz.y*0.42,hz=sz.z*0.3;spr(0xFFF4D8,L*0.22,fx+0.3,hy,hz);spr(0xFFF4D8,L*0.22,fx+0.3,hy,-hz);flat(0xFFE8B8,L*1.8,L*1.3,fx+L*0.85,bb.min.y+0.4,0,0.7);flat(team,L*1.5,L*1.5,0,bb.min.y+0.3,0,0.35);
  spr(team,L*0.26,0,bb.max.y+0.5,0,1);spr(0xFF2010,L*0.12,bb.min.x-0.2,hy,hz*0.9,0.8);spr(0xFF2010,L*0.08,bb.min.x-0.2,hy,-hz*0.9,0.8);}
 g.add(grp);g.userData.nl=grp;}
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
 for(const u of G_.units){if(u.dead)continue;if(Math.abs(u.x-cx)+Math.abs(u.z-cz)>far*(US[u.k].air||CUR!=='titan'?2.2:1.3))continue;
  const xm=xmOK(u.k,u.s);u.vk='u'+u.id+(xm?'x':'');sync(u.vk,()=>{const g=instantiate(proto('U'+u.k+u.s+(MIL?'m':'')+(xm?'x':''),()=>xm?buildXM(u.k,u.s):buildUnit(u.k,u.s)));nightLights(g,u.k,u.s);{const k=u.k==='heli'?3:u.k==='tank'||u.k==='jeep'?4:1;if(k!==1)g.scale.multiplyScalar(k);}return g;},(o,e)=>{if(o.userData.a==null)o.userData.a=u.a;let d=u.a-o.userData.a;d=Math.atan2(Math.sin(d),Math.cos(d));o.userData.a+=d*Math.min(1,dt*(US[u.k].air?2.2:6));
   o.position.set(u.x,u.y,u.z);o.rotation.y=-o.userData.a;{const nl=o.userData.nl;if(nl){nl.visible=NIGHT>0;if(NIGHT>0&&nl.userData.blink)nl.userData.blink.visible=((t*1.4+u.id*0.37)%1)<0.12;if(nl.userData.pool)nl.userData.pool.position.y=(-u.y+1.5)/o.scale.y;}}if(o.userData.rot)o.userData.rot.rotation.y=t*28;if(o.userData.rot2)o.userData.rot2.rotation.z=t*40;if(o.userData.tur&&u.ga!=null)o.userData.tur.rotation.y=-(u.ga-o.userData.a);
   if(!US[u.k].air&&u.k!=='inf'&&!u.tg){e.dust=(e.dust||0)-dt;if(e.dust<=0){e.dust=0.3;puff(u.x-Math.cos(u.a)*14,u.y+1.5,u.z-Math.sin(u.a)*14,'dust');}}});}
 for(const h of G_.harv){if(Math.abs(h.x-cx)+Math.abs(h.z-cz)>far*1.3)continue;sync('h'+h.id,()=>instantiate(proto('H'+h.s,()=>buildHarv(h.s))),o=>{o.position.set(h.x,hgt(h.x,h.z)+0.4,h.z);if(o.userData.a==null)o.userData.a=h.a;let d=h.a-o.userData.a;d=Math.atan2(Math.sin(d),Math.cos(d));o.userData.a+=d*Math.min(1,dt*5);o.rotation.y=-o.userData.a;});}
 for(const tw of G_.towers){if(Math.abs(tw.x-cx)+Math.abs(tw.z-cz)>far*1.8)continue;const nb=bldOK(tw.k,tw.s);
  sync('t'+tw.id+(nb?'x':''),()=>{if(nb)return buildBT(tw.k,tw.s);const g=instantiate(proto('T'+tw.k+tw.s+(MIL?'m':''),()=>buildTower(tw.k,tw.s,1)));g.scale.setScalar(1.3);return g;},o=>{
   if(nb){const face=tw.s===0?0:Math.PI,want=Math.PI/2-(tw.a??face);if(o.userData.a==null)o.userData.a=want;let d=want-o.userData.a;d=Math.atan2(Math.sin(d),Math.cos(d));o.userData.a+=d*Math.min(1,dt*3);
    if(tw.py==null&&BH[tw.s]&&BH[tw.s].userData.done)tw.py=padAt(tw.s,tw.x,tw.z);o.position.set(tw.x,tw.py??PADY,tw.z);if(tw.k==='mg'&&o.userData.top){o.rotation.y=Math.PI/2-face;o.userData.top.rotation.y=o.userData.a-o.rotation.y;}else o.rotation.y=o.userData.a;return;}
   o.position.set(tw.x,hgt(tw.x,tw.z),tw.z);const tu=o.userData.tur;if(tu)tu.rotation.y=tw.k==='tes'?t*1.6:-tw.a;});}
 for(const s of shells)sync('s'+s.id,()=>{const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.glow,color:0xFFE2A0,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));sp.scale.set(7,7,1);return sp;},o=>o.position.set(s.x,s.y,s.z));
 for(const tr of tracers)sync('T'+tr.id,()=>{const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);return new THREE.Line(g,new THREE.LineBasicMaterial({color:tr.c,transparent:true,opacity:0.9,blending:THREE.AdditiveBlending}));},o=>{const a=o.geometry.attributes.position;a.setXYZ(0,...tr.a);a.setXYZ(1,...tr.b);a.needsUpdate=true;a.needsUpdate=true;o.geometry.computeBoundingSphere();});
 syncHeroes(t,dt);
 for(const [k,e] of live)if(e.seen<FR-1){dyn.remove(e.o);if(e.o.isSprite||e.o.isLine){e.o.material.dispose();if(e.o.isLine)e.o.geometry.dispose();}live.delete(k);}
 for(const m of G_.mines){const o=MINE_O[m.i];if(o){const n=Math.ceil(12*m.lives/MINE_LIVES);let j=0;for(const c of o.children)if(c.geometry&&c.geometry.type==='OctahedronGeometry')c.visible=(j++)<n;}}}

/* ================== the player's Titan: drives, shoots by itself when a target sits in the sight ================== */
const shells=[],tracers=[];let SID=0;
const cockScene=new THREE.Scene(),cockRoot=new THREE.Group();cockScene.add(cockRoot,new THREE.HemisphereLight(0xD8E4F0,0x4A5038,0.7));{const l=new THREE.DirectionalLight(0xFFEBC8,1.5);l.position.set(-0.5,0.8,0.4);cockScene.add(l);}
const cock=new THREE.Group();cockRoot.add(cock);const barrel=new THREE.Group();cock.add(barrel);
{const b=CYL(1.9,2.4,44,std(0x2C3036,0.4,0.7),24,0,0,0);b.rotation.x=Math.PI/2;b.position.set(0,-7.5,-28);barrel.add(b);
 const fe=CYL(2.8,2.8,7,std(0x2C3036,0.4,0.7),24,0,0,0);fe.rotation.x=Math.PI/2;fe.position.set(0,-7.5,-34);barrel.add(fe);
 const mz=CYL(3.4,3.4,6,std(0x1C2024,0.5,0.6),24,0,0,0);mz.rotation.x=Math.PI/2;mz.position.set(0,-7.5,-50);barrel.add(mz);
 const sl=CYL(3,3.2,9,std(0x3A4048,0.5,0.6),24,0,0,0);sl.rotation.x=Math.PI/2;sl.position.set(0,-7.5,-10);barrel.add(sl);}
const LIVE=o=>o.dead<=0&&!o.wait,VUL=o=>LIVE(o)&&!o.inv;
/* a fresh spawn can't be hurt until the player has taken it over and 3 s have passed */
function invSet(o){o.inv=true;o.arm=false;o.invT=3;}
function invTick(o,n,dt){if(!o.inv)return;if(CUR===n)o.arm=true;if(o.arm&&(o.invT-=dt)<=0)o.inv=false;}
function spawnTitan(){invSet(P);[P.x,P.z]=baseW(0,-0.02,0.19);P.yaw=0;P.pitch=-0.05;P.hp=P.max;P.move=false;P.dead=0;P.cd=0;}
function titanBlocked(x,z){if(x<70||z<70||x>IW-70||z>IH-70||blockedAt(x,z,16))return true;for(const t of G_.towers)if(Math.hypot(t.x-x,t.z-z)<30)return true;for(const m of G_.mines)if(Math.hypot(m.x-x,m.z-z)<80)return true;return false;}
let LOCK=null;
function stepTitan(dt){if(P.dead>0){P.dead-=dt;if(P.dead<=0){if(RSP.P>0){RSP.P--;spawnTitan();}else P.dead=1e9;}return;}invTick(P,'titan',dt);
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
 if(ET.dead<=0)test(ET.x,24,ET.z,{k:'et'},50);
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
/* first thing on a sight line: an enemy machine, a container/hangar, or the ground */
const HITR={tank:42,jeep:34,heli:36,inf:10};
function rayHit(ox,oy,oz,dx,dy,dz,maxL,side){let L=maxL,gnd=false;for(let d=10;d<=maxL;d+=8){const x=ox+dx*d,y=oy+dy*d,z=oz+dz*d;if(y<=Math.max(0,hgt(x,z))||OBS.some(o=>y<=o.h&&inRect(x,z,o,0))){L=d;gnd=true;break;}}
 let bu=null;for(const u of G_.units){if(u.dead||u.s===side)continue;const r=HITR[u.k]||30,cy=u.y+(US[u.k].air?0:14),vx=u.x-ox,vy=cy-oy,vz=u.z-oz,t=vx*dx+vy*dy+vz*dz;if(t<10||t>L+r)continue;
  const px=vx-dx*t,py=vy-dy*t,pz=vz-dz*t;if(px*px+py*py+pz*pz<r*r){const tt=Math.max(10,t-r*0.4);if(tt<L){L=tt;bu=u;gnd=true;}}}
 return {x:ox+dx*L,y:oy+dy*L,z:oz+dz*L,u:bu,hit:gnd};}
function superShot(){if(P.dead>0||P.scd>0)return;P.scd=5;cam.updateMatrixWorld();const o=new THREE.Vector3(),d=new THREE.Vector3();cam.getWorldPosition(o);cam.getWorldDirection(d);
 const rh=rayHit(o.x,o.y,o.z,d.x,d.y,d.z,1200,0);const hit=rh.hit?rh:rayHit(o.x,o.y,o.z,d.x,d.y,d.z,700,0);
 for(let i=0;i<TITAN.superN;i++){const a=i/TITAN.superN*6.28,r=i?40+rn()*30:0,x=hit.x+Math.cos(a)*r,z=hit.z+Math.sin(a)*r,y=i?Math.max(hgt(x,z),rh.u?hit.y-20:0):hit.y;setTimeout(()=>shoot(x,y,z,i===0&&rh.u?{k:'u',o:rh.u}:null,true),i*90);}
 puff(muzzle().x,muzzle().y,muzzle().z,'muzzle');P.rec=1;HUD.kick();HUD.msg('Залп!');}
function impact(s){explode(s.tx,s.ty,s.tz,s.sup?1.4:1.1);const by=0;
 if(!G_.over&&(s.tg&&s.tg.k==='b'||Math.hypot(s.tx-BASES[1][0],s.tz-BASES[1][1])<330)){if(!s.sup||rn()<0.35)hitBase(1,1);}
 {const m=s.tg&&s.tg.k==='m'&&!s.tg.o.dead?s.tg.o:nearMineOf(1,s.tx,s.tz,80);if(m&&!G_.over&&(!s.sup||rn()<0.35))hitMine(m,1);}
 splash(0,s.tx,s.tz,TITAN.r,TITAN.dmg,by);heroSplash(s.tx,s.ty,s.tz,TITAN.r+20,TITAN.dmg,true);
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
#h3 .mini{position:absolute;left:max(8px,env(safe-area-inset-left));top:8px;width:168px;height:70px;opacity:.72;border-radius:10px;border:1.5px solid rgba(255,255,255,.3);pointer-events:auto}
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
<div class="units"></div><div class="b map">Карта</div><div class="fps"></div><canvas class="mini" width="360" height="150"></canvas>
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
  q('.fps').innerHTML=Math.round(T3.fps)+' к/с · ×'+T3.q.toFixed(2)+'<br>Бот: титан '+(ET.dead>1e8?'✕':RSP.ET)+' · дрон '+(ED.dead>1e8?'✕':RSP.ED)+' · самолёт '+(EF.dead>1e8?'✕':RSP.EF)+'<br>Враги: '+a1+' на карте · '+G_.kills[1]+' уничтожено'+(a0||G_.kills[0]?'<br>Наши: '+a0+' на карте · '+G_.kills[0]+' уничтожено':'');}
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
function seenBy0(x,z){if(F.dead<=0&&Math.hypot(x-F.x,z-F.z)<VIS*1.4)return true;if(LIVE(D)&&Math.hypot(x-DL.x,z-DL.z)<DL.r)return true;if(Math.hypot(x-BASES[0][0],z-BASES[0][1])<900)return true;if(P.dead<=0&&Math.hypot(x-P.x,z-P.z)<VIS*1.3)return true;
 for(const u of G_.units)if(u.s===0&&!u.dead&&Math.hypot(u.x-x,u.z-z)<VIS)return true;for(const t of G_.towers)if(t.s===0&&Math.hypot(t.x-x,t.z-z)<VIS)return true;for(const m of G_.mines)if(m.s===0&&!m.dead&&Math.hypot(m.x-x,m.z-z)<VIS)return true;for(const h of G_.harv)if(h.s===0&&Math.hypot(h.x-x,h.z-z)<VIS*0.8)return true;return false;}
function drawMap(cv,big){const c=cv.getContext('2d'),W=cv.width,Hh=cv.height;c.fillStyle='#22313A';c.fillRect(0,0,W,Hh);const k=Math.min(W/IW,Hh/IH)*(big?0.96:1),ox=(W-IW*k)/2,oz=(Hh-IH*k)/2;
 if(!MAPIMG)MAPIMG=mapImage();c.drawImage(MAPIMG,ox,oz,IW*k,IH*k);const X=x=>ox+x*k,Z=z=>oz+z*k,dot=(x,z,r,col)=>{c.fillStyle=col;c.beginPath();c.arc(X(x),Z(z),r,0,7);c.fill();};
 const f=big?1:0.6;
 for(const m of G_.mines){c.fillStyle=m.dead?'#445':m.s?'#FF5A4A':'#4AA8FF';c.save();c.translate(X(m.x),Z(m.z));c.rotate(Math.PI/4);c.fillRect(-5*f,-5*f,10*f,10*f);c.restore();if(big){c.fillStyle='#fff';c.font='700 11px Rubik,system-ui';c.textAlign='center';c.fillText(m.dead?'✕':m.lives,X(m.x),Z(m.z)+18);}}
 for(const s of [0,1]){const [bx,bz]=BASES[s];c.fillStyle=s?'#E04A3A':'#3E86E0';c.fillRect(X(bx)-9*f,Z(bz)-9*f,18*f,18*f);c.strokeStyle='#fff';c.lineWidth=2;c.strokeRect(X(bx)-9*f,Z(bz)-9*f,18*f,18*f);}
 for(const t of G_.towers){if(t.s===1&&!t.mk&&!seenBy0(t.x,t.z))continue;c.fillStyle=t.s?'#FF7A60':'#8CC0F0';c.beginPath();c.moveTo(X(t.x),Z(t.z)-6*f);c.lineTo(X(t.x)+5*f,Z(t.z)+4*f);c.lineTo(X(t.x)-5*f,Z(t.z)+4*f);c.fill();}
 for(const h of G_.harv){if(h.s===1&&!h.mk&&!seenBy0(h.x,h.z))continue;dot(h.x,h.z,3.5*f,h.s?'#FFB060':'#F2C232');}
 for(const u of G_.units){if(u.dead)continue;if(u.s===1&&!u.mk&&!seenBy0(u.x,u.z))continue;dot(u.x,u.z,(US[u.k].air?3:2.6)*f,u.s?'#FF5040':'#77B3EE');}
 if(LIVE(D)){c.strokeStyle='rgba(120,255,140,0.55)';c.lineWidth=big?1.5:1;c.beginPath();c.arc(X(DL.x),Z(DL.z),DL.r*k,0,7);c.stroke();c.save();c.translate(X(D.x),Z(D.z));c.rotate(D.yaw+Math.PI/4);c.fillStyle='#9CFFAA';c.fillRect(-4*f,-4*f,8*f,8*f);c.restore();}
 for(const a of ART.sh){c.fillStyle='#FFB040';c.beginPath();c.arc(X(a.x),Z(a.z),2.5*f,0,7);c.fill();}
 if(ET.dead<=0){c.save();c.translate(X(ET.x),Z(ET.z));c.rotate(ET.yaw);c.fillStyle='#FF3A2A';c.strokeStyle='#fff';c.lineWidth=1;c.beginPath();c.moveTo(10*f,0);c.lineTo(-6*f,6*f);c.lineTo(-3*f,0);c.lineTo(-6*f,-6*f);c.closePath();c.fill();c.stroke();c.restore();}
 if(ED.dead<=0){c.save();c.translate(X(ED.x),Z(ED.z));c.rotate(ED.yaw+Math.PI/4);c.fillStyle='#FF6A50';c.fillRect(-4*f,-4*f,8*f,8*f);c.restore();}
 if(EF.dead<=0){c.save();c.translate(X(EF.x),Z(EF.z));c.rotate(EF.yaw);c.fillStyle='#FF6A50';c.beginPath();c.moveTo(9*f,0);c.lineTo(-5*f,7*f);c.lineTo(-2*f,0);c.lineTo(-5*f,-7*f);c.fill();c.restore();}
 for(const a of EAR){c.strokeStyle='rgba(255,60,40,0.8)';c.lineWidth=1.5;c.beginPath();c.arc(X(a.x),Z(a.z),Math.max(3,ART.R*k),0,7);c.stroke();}
 if(F.dead<=0){c.save();c.translate(X(F.x),Z(F.z));c.rotate(F.yaw);c.fillStyle='#FFE27A';c.beginPath();c.moveTo(9*f,0);c.lineTo(-5*f,7*f);c.lineTo(-2*f,0);c.lineTo(-5*f,-7*f);c.fill();c.restore();}
 if(P.dead<=0){c.save();c.translate(X(P.x),Z(P.z));c.rotate(P.yaw);c.fillStyle='#FFFFFF';c.strokeStyle='#0A1420';c.lineWidth=big?2:1.6;const g_=big?1.2:1.15;c.beginPath();c.moveTo(12*g_*f,0);c.lineTo(-7*g_*f,7*g_*f);c.lineTo(-3.5*g_*f,0);c.lineTo(-7*g_*f,-7*g_*f);c.closePath();c.stroke();c.fill();c.restore();
  if(big){c.strokeStyle='rgba(255,255,255,0.25)';c.beginPath();c.arc(X(P.x),Z(P.z),VIS*1.3*k,0,7);c.stroke();}}}
function openMap(){T3.map=true;P.move=false;TM.style.display='block';}
function mapLoop(){const cv=TM.querySelector('canvas');const r=TM.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1);if(cv.width!==Math.round(r.width*d)){cv.width=Math.round(r.width*d);cv.height=Math.round(r.height*d);}drawMap(cv,true);}

/* ---------- look: one finger turns, two fingers zoom ---------- */
const ptr=new Map();let pinch0=0,zoom0=1;
const TAP={};cv3.addEventListener('pointerdown',e=>{try{cv3.setPointerCapture(e.pointerId);}catch(_){}ptr.set(e.pointerId,[e.clientX,e.clientY]);TAP[e.pointerId]={x:e.clientX,y:e.clientY,t:performance.now(),m:0,n:ptr.size};if(ptr.size===2){const [a,b]=[...ptr.values()];pinch0=Math.hypot(a[0]-b[0],a[1]-b[1]);zoom0=VEH().zoom;}});
cv3.addEventListener('pointermove',e=>{const p=ptr.get(e.pointerId);if(!p)return;const dx=e.clientX-p[0],dy=e.clientY-p[1];ptr.set(e.pointerId,[e.clientX,e.clientY]);
 if(TAP[e.pointerId])TAP[e.pointerId].m+=Math.abs(dx)+Math.abs(dy);
 if(CUR==='plane'){if(ptr.size===1){const k=0.0045/ZF();F.ty+=dx*k;F.pitch=Math.max(-0.75,Math.min(0.25,F.pitch-dy*k*0.8));}else if(ptr.size===2&&pinch0>0){const [a,b]=[...ptr.values()];F.zoom=Math.max(1,Math.min(3,zoom0*Math.hypot(a[0]-b[0],a[1]-b[1])/pinch0));}return;}
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
function start(){CUR='drone';if(!BUILT){genYard(1234);buildNav();planRoads();}newGame();if(!BUILT||MIL_DIRTY){for(const e of live.values())dyn.remove(e.o);live.clear();buildWorld();applyTOD(TOD);BUILT=true;MIL_DIRTY=false;MAPIMG=null;}
 fxReset();for(const e of live.values())dyn.remove(e.o);live.clear();cv3.style.display='block';H.style.display='block';size();CUR='drone';setVeh('titan');
 /* start sharp: at least ×1.75 (capped by the screen), the remembered value if higher */
 {const cap=Math.min(2,devicePixelRatio||1),nq=Math.min(cap,Math.max(T3.q,1.75));if(nq!==T3.q){T3.q=nq;T3.applyQ=true;}}
 warmBegin();}
/* ================== loading screen: wait for the models, compile every shader and push every texture to the GPU before the fight ================== */
const LD=document.createElement('div');LD.id='isleLoad';LD.innerHTML='<div class="c"><div class="t">Загрузка</div><div class="bar"><i></i></div><div class="s"></div></div>';document.body.appendChild(LD);
{const st=document.createElement('style');st.textContent=`#isleLoad{position:fixed;inset:0;z-index:45;display:none;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 45%,#2A2420,#0B0A09);font:800 15px 'Rubik',system-ui,sans-serif;color:#EDE3D2}
#isleLoad .c{width:min(360px,70vw);text-align:center}#isleLoad .t{font-size:20px;letter-spacing:2px;margin-bottom:14px;text-transform:uppercase}
#isleLoad .bar{height:8px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden}#isleLoad .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#E8902C,#F2C232);transition:width .15s}
#isleLoad .s{margin-top:10px;font-size:12px;font-weight:600;opacity:.6}`;document.head.appendChild(st);}
const WU={on:false,t:0,ph:0,g:null,t0:0};
function assetsReady(){const xs=Object.values(XM),bs=Object.values(BLD);const all=2+xs.length+xs.filter(m=>m.blue).length+bs.length*2;let n=(MIL?1:0)+(THREE.GLTFLoader?1:0)+xs.filter(m=>m.sc).length+xs.filter(m=>m.blue&&m.bt).length+bs.filter(m=>m.sc).length+bs.filter(m=>m.rt).length;return [n,all];}
function warmBegin(){if(PAUSE.on)PAUSE.set(false);WU.on=true;WU.t=0;WU.ph=0;WU.t0=performance.now();LD.style.display='flex';LD.querySelector('i').style.width='0%';running=true;}
function warmBuild(){/* one of every machine (both sides, wreck and ash variants), a blast, smoke, rings and debris in front of the camera */
 const g=new THREE.Group();let i=0;const put=o=>{o.position.set((i%4-1.5)*70,0,Math.floor(i/4)*60);g.add(o);i++;};
 for(const k of ['jeep','tank','heli','inf'])for(const s of [0,1]){const xm=xmOK(k,s);const o=instantiate(proto('U'+k+s+(MIL?'m':'')+(xm?'x':''),()=>xm?buildXM(k,s):buildUnit(k,s)));put(o);}
 for(const k of ['jeep','tank','heli']){const xm=xmOK(k,1);const o=instantiate(proto('U'+k+'1'+(MIL?'m':'')+(xm?'x':''),()=>xm?buildXM(k,1):buildUnit(k,1)));darken(o);put(o);
  const a=instantiate(proto('U'+k+'1'+(MIL?'m':'')+(xm?'x':''),()=>xm?buildXM(k,1):buildUnit(k,1)));darken(a);a.traverse(m=>{if(m.isMesh){const c=m.material.clone();c.transparent=true;c.depthWrite=false;c.opacity=0.5;m.material=c;}});put(a);}
 WU.g=g;scene.add(g);}
function warmPlace(){if(!WU.g)return;const d=new THREE.Vector3();cam.getWorldDirection(d);d.y=0;d.normalize();const x=cam.position.x+d.x*260,z=cam.position.z+d.z*260;WU.g.position.set(x,Math.max(0,hgt(x,z)),z);WU.g.rotation.y=-Math.atan2(d.z,d.x)+Math.PI/2;}
function warmStep(dt){const [n,all]=assetsReady(),bar=LD.querySelector('i'),sub=LD.querySelector('.s');WU.t+=dt;
 if(WU.ph===0){bar.style.width=(55*n/all)+'%';sub.textContent='модели '+n+' из '+all;if(n>=all||performance.now()-WU.t0>15000){WU.ph=1;WU.t=0;}return;}
 if(WU.ph===1){sub.textContent='подготовка графики';warmBuild();warmPlace();R.compile(scene,cam);R.compile(cockScene,cam);WU.ph=2;WU.t=0;bar.style.width='65%';return;}
 /* phase 2: draw a slow turn in each vehicle, with a blast in view, so nothing is drawn for the first time during the fight */
 const T=WU.t;if(WU.ph===2&&!WU.fx&&T>0.1){WU.fx=1;const p=WU.g.position;bigBlast(p.x,p.y,p.z,50);queueBlast(p.x+60,p.y,p.z,40);explode(p.x,p.y+20,p.z,1.2);}
 if(T<0.8){if(CUR!=='titan')setVeh('titan');P.yaw+=dt*7.8;}else if(T<1.4){if(CUR!=='drone')setVeh('drone');}else if(T<2.0){if(CUR!=='plane')setVeh('plane');}
 warmPlace();bar.style.width=(65+35*Math.min(1,T/2.0))+'%';
 if(T>=2.0)warmEnd();}
function warmEnd(){WU.on=false;WU.fx=0;if(WU.g){scene.remove(WU.g);WU.g=null;}fxReset();for(const p of PART.splice(0)){scene.remove(p.s);p.s.material.dispose();}for(const o of scorch.splice(0)){scene.remove(o.m);o.m.material.dispose();}SHK=0;P.shake=0;flash.intensity=0;
 newGame();for(const e of live.values())dyn.remove(e.o);live.clear();CUR='drone';setVeh('titan');
 T3.warm=0;T3.fpsN=0;T3.fpsT=0;T3.lowN=0;T3.hiN=0;LD.style.display='none';}
let running=false,MIL_DIRTY=false,last=performance.now();
function loop(now_){requestAnimationFrame(loop);let dt=Math.min(0.05,(now_-last)/1000);last=now_;if(!running)return;if(PAUSE.on){if(!PAUSE.once)return;PAUSE.once=false;dt=0;}
 if(T3.map){mapLoop();stepGame(dt);stepTitan(dt);stepDrone(dt);stepPlane(dt);stepArt(dt);stepShells(dt);return;}
 if(T3.applyQ){T3.applyQ=false;R.setPixelRatio(T3.q);size();}/* resolution changes happen before drawing, so the canvas is never shown cleared */
 if(CUR==='plane'){if(keys.has('KeyA'))F.ty-=1.4*dt;if(keys.has('KeyD'))F.ty+=1.4*dt;}else{if(keys.has('KeyA'))VEH().yaw-=1.6*dt;if(keys.has('KeyD'))VEH().yaw+=1.6*dt;}
 const t=now_/1000;if(WU.on)warmStep(dt);else{stepGame(dt);stepTitan(dt);stepDrone(dt);stepPlane(dt);stepArt(dt);stepShells(dt);}syncAll(t,dt);syncDrone(t,dt);syncPlane(t);stepParts(dt);stepFx(dt);
 if(G_.over&&over.style.display!=='flex'){over.style.display='flex';over.querySelector('.t').textContent=G_.over.w===0?'Победа!':'Поражение';}
 if(ocean)ocean.material.normalMap.offset.set(t*0.004,-t*0.01);
 for(const c of world.children)if(c.userData.cloud){c.position.x+=c.userData.v*dt;if(c.position.x>IW+7000)c.position.x=-7000;}
 const gy=hgt(P.x,P.z),bob=P.move?Math.sin(P.bob)*0.6:0,sh=P.shake||0;const y=Math.max(gy,0)+(P.dead>0?90:36)+bob+(rn()-0.5)*sh*3;cam.position.set(P.x+(rn()-0.5)*sh*3,y,P.z);
 const lp=P.pitch+(HUD.k>0?HUD.k*0.22:0);cam.lookAt(P.x+Math.cos(P.yaw)*Math.cos(lp)*100,y+Math.sin(lp)*100,P.z+Math.sin(P.yaw)*Math.cos(lp)*100);
 const fov=P.fov/P.zoom;if(Math.abs(cam.fov-fov)>0.01){cam.fov=fov;cam.updateProjectionMatrix();}cock.visible=false;{const v=P.dead<=0&&P.zoom<1.6;const g=document.getElementById('tiCock');if(g)g.style.display=v?'block':'none';}barrel.position.z=P.rec*5;
 if(CUR==='drone')droneCam(dt);else if(CUR==='plane')planeCam();
 applyShake(dt);
 if(WATERT){const tt=performance.now()/1000;WATERT.offset.set(Math.sin(tt*0.05)*0.08,tt*0.02);}
 sky.position.copy(cam.position);{let cx=CUR==='drone'?DL.x:CUR==='plane'?F.x+Math.cos(F.yaw)*480:P.x+Math.cos(P.yaw)*150,cz=CUR==='drone'?DL.z:CUR==='plane'?F.z+Math.sin(F.yaw)*480:P.z+Math.sin(P.yaw)*150;{const ext=CUR==='plane'?620:CUR==='drone'?460:170,sc=sun.shadow.camera;if(sc.right!==ext){sc.left=-ext;sc.right=ext;sc.top=ext;sc.bottom=-ext;sc.far=CUR==='titan'?900:1800;sc.updateProjectionMatrix();}
  const tex=2*ext/sun.shadow.mapSize.x,f=SHF.f.copy(SUN_DIR).negate(),r=SHF.r.set(0,1,0).cross(f).normalize(),u=SHF.u.copy(f).cross(r);const pr=Math.round((cx*r.x+cz*r.z)/tex)*tex-(cx*r.x+cz*r.z),pu=Math.round((cx*u.x+cz*u.z)/tex)*tex-(cx*u.x+cz*u.z);
  /* exact shift in light space: the target may sit a little off the ground, which is fine for a directional light */
  SHF.ty=u.y*pu;cx+=r.x*pr+u.x*pu;cz+=r.z*pr+u.z*pu;}
 {const D=CUR==='titan'?700:1200,ty=SHF.ty||0;sun.position.set(cx+SUN_DIR.x*D,ty+SUN_DIR.y*D,cz+SUN_DIR.z*D);sun.target.position.set(cx,ty,cz);}}
 cam.updateMatrixWorld();stepLock(dt);HUD.upd(dt);droneHud(t);drawStatic(dt);planeHud();markHud();if(PO.on){PO.fin.uniforms.mono.value=CUR==='drone'&&!DST.color?1:0;PO.fin.uniforms.tm.value=t%100;}if(FR%6===0)drawMap(q('.mini'),false);cam.updateMatrixWorld();cockRoot.position.copy(cam.position);cockRoot.quaternion.copy(cam.quaternion);cockScene.environment=scene.environment;drawFrame();AUD.tick(dt);
 T3.fpsN++;T3.fpsT+=dt;if(T3.fpsT>=2){T3.fps=T3.fpsN/T3.fpsT;T3.fpsN=0;T3.fpsT=0;T3.warm=(T3.warm||0)+1;
  /* ignore the first seconds (shaders compiling); go down after two slow windows, up only after four fast ones and never soon after going down */
  if(T3.warm>2){T3.lowN=T3.fps<38?(T3.lowN||0)+1:0;T3.hiN=T3.fps>55?(T3.hiN||0)+1:0;let nq=T3.q;
   if(T3.lowN>=2&&T3.q>0.55){nq=Math.max(0.55,T3.q-0.15);T3.lowN=0;T3.downAt=now_;}
   else if(T3.hiN>=2&&T3.q<Math.min(2,devicePixelRatio||1)&&now_-(T3.downAt||-1e9)>20000){nq=Math.min(2,devicePixelRatio||1,T3.q+0.15);T3.hiN=0;}
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
  this.loadS();
  this.music=new Audio('desert.mp3');this.music.loop=true;this.music.volume=0.32;if(this.on)this.music.play().catch(()=>{});}catch(e){console.error(e);}},
 SF:{boom1:'isle_boom1.mp3',boomM:'isle_boom_mass.mp3',dfall:'isle_drone_fall.mp3',whoosh:'isle_art_whoosh.mp3',glass:'isle_glass.mp3'},buf:{},
 loadS(){for(const [k,f] of Object.entries(this.SF))fetch(f).then(r=>r.arrayBuffer()).then(a=>new Promise((ok,no)=>this.ctx.decodeAudioData(a,ok,no))).then(b=>{this.buf[k]=b;}).catch(e=>console.error(f,e));},
 /* a recorded sound: distance-scaled unless x is null; `delay` seconds from now, starting `off` seconds into the file */
 sample(k,x,z,vol,delay,off){if(!this.ctx||!this.on||!this.buf[k])return false;const g0=x==null?1:this.gainAt(x,z);if(g0<0.01)return true;const C=this.ctx,now=C.currentTime;
  if(!delay&&this.last['s'+k]&&now-this.last['s'+k]<0.1)return true;this.last['s'+k]=now;const s=C.createBufferSource();s.buffer=this.buf[k];const g=C.createGain();g.gain.value=vol*g0;s.connect(g).connect(this.out);s.start(now+(delay||0),off||0);return true;},
 setOn(v){this.on=v;if(this.out)this.out.gain.value=v?0.9:0;if(this.music){if(v)this.music.play().catch(()=>{});else this.music.pause();}try{localStorage.setItem('dvebazy-islesnd',v?'1':'0');}catch(_){}},
 tick(dt){if(!this.ctx)return;const t=this.ctx.currentTime;this.eng.gain.setTargetAtTime(P.dead>0?0:P.move?0.22:0.07,t,0.25);this.engO.frequency.setTargetAtTime(P.move?52:36,t,0.4);},
 gainAt(x,z){const d=Math.hypot(x-cam.position.x,z-cam.position.z);return Math.max(0,1-d/2600)**2;},
 play(kind,x,z,k){if(!this.ctx||!this.on)return;const g0=x==null?1:this.gainAt(x,z);if(g0<0.01)return;const now=this.ctx.currentTime;if(this.last[kind]&&now-this.last[kind]<(kind==='mg'?0.07:kind==='boom'?0.05:kind==='kill'?0.12:0.02))return;this.last[kind]=now;
  const C=this.ctx,src=C.createBufferSource();src.buffer=this.noise;const f=C.createBiquadFilter(),g=C.createGain();src.connect(f).connect(g).connect(this.out);const off=Math.random()*1.5;
  if(kind==='cannon'){f.type='lowpass';f.frequency.setValueAtTime(1800,now);f.frequency.exponentialRampToValueAtTime(140,now+0.5);g.gain.setValueAtTime(0.9*g0,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.7);src.start(now,off,0.75);
   const o=C.createOscillator(),og=C.createGain();o.frequency.setValueAtTime(90,now);o.frequency.exponentialRampToValueAtTime(35,now+0.3);og.gain.setValueAtTime(0.8*g0,now);og.gain.exponentialRampToValueAtTime(0.001,now+0.35);o.connect(og).connect(this.out);o.start(now);o.stop(now+0.4);}
  else if(kind==='boom'){const kk=Math.min(1.6,k||1);f.type='lowpass';f.frequency.setValueAtTime(900,now);f.frequency.exponentialRampToValueAtTime(90,now+0.9*kk);g.gain.setValueAtTime(0.7*g0*kk,now);g.gain.exponentialRampToValueAtTime(0.001,now+1.1*kk);src.start(now,off,1.2*kk);}
  else if(kind==='kill'){/* a machine blowing up: sharp crack, deep thump, long rumble and a rattle of debris — bigger and longer than any shot */
   const kk=Math.min(1.5,k||1),G=g0*kk*0.6;
   f.type='lowpass';f.frequency.setValueAtTime(2400,now);f.frequency.exponentialRampToValueAtTime(70,now+1.8);g.gain.setValueAtTime(0.0001,now);g.gain.exponentialRampToValueAtTime(1.7*G,now+0.03);g.gain.exponentialRampToValueAtTime(0.001,now+2.2);src.start(now,off,2.3);
   const cr=C.createBufferSource();cr.buffer=this.noise;const hf=C.createBiquadFilter();hf.type='highpass';hf.frequency.value=1500;const cg=C.createGain();cg.gain.setValueAtTime(1.3*G,now);cg.gain.exponentialRampToValueAtTime(0.001,now+0.12);cr.connect(hf).connect(cg).connect(this.out);cr.start(now,Math.random()*1.5,0.13);
   const o=C.createOscillator(),og=C.createGain();o.type='sine';o.frequency.setValueAtTime(75,now);o.frequency.exponentialRampToValueAtTime(26,now+0.7);og.gain.setValueAtTime(1.0*G,now);og.gain.exponentialRampToValueAtTime(0.001,now+0.8);o.connect(og).connect(this.out);o.start(now);o.stop(now+0.85);
   const o2=C.createOscillator(),og2=C.createGain();o2.type='triangle';o2.frequency.setValueAtTime(48,now+0.05);o2.frequency.exponentialRampToValueAtTime(30,now+1.2);og2.gain.setValueAtTime(0.0001,now);og2.gain.exponentialRampToValueAtTime(0.5*G,now+0.08);og2.gain.exponentialRampToValueAtTime(0.001,now+1.4);o2.connect(og2).connect(this.out);o2.start(now);o2.stop(now+1.45);
   for(let i=0;i<5;i++){const t0=now+0.25+Math.random()*1.0,d=C.createBufferSource();d.buffer=this.noise;const bf=C.createBiquadFilter();bf.type='bandpass';bf.frequency.value=900+Math.random()*2600;bf.Q.value=3;const dg=C.createGain();dg.gain.setValueAtTime(0.25*G*(1-i*0.12),t0);dg.gain.exponentialRampToValueAtTime(0.001,t0+0.07);d.connect(bf).connect(dg).connect(this.out);d.start(t0,Math.random()*1.5,0.08);}}
  else if(kind==='mg'){f.type='bandpass';f.frequency.value=1800;f.Q.value=0.8;g.gain.setValueAtTime(0.25*g0,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.05);src.start(now,off,0.06);}
  else if(kind==='shot'){f.type='bandpass';f.frequency.value=700;g.gain.setValueAtTime(0.35*g0,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.18);src.start(now,off,0.2);}}};
try{AUD.on=localStorage.getItem('dvebazy-islesnd')!=='0';}catch(_){}
{const ex0=explode;explode=function(x,y,z,k){ex0(x,y,z,k);if(!AUD.mute)AUD.play('boom',x,z,k);};const tr0=tracer;tracer=function(a,b,c){tr0(a,b,c);AUD.play(c===0xFF9050?'shot':'mg',a[0],a[2]);};const sh0=shoot;shoot=function(x,y,z,tg,sup){sh0(x,y,z,tg,sup);AUD.play('cannon');};}
/* pause: the world freezes on the last frame, sound stops; the sound switch lives in the pause menu */
const PAUSE={on:false};
{const sb=document.createElement('div');sb.className='b pz';sb.style.cssText='right:max(14px,env(safe-area-inset-right));top:8px;width:44px;height:40px;font-size:16px;letter-spacing:-1px';sb.textContent='❚❚';H.appendChild(sb);
 const pm=document.createElement('div');pm.id='isPause';pm.innerHTML='<div class="c"><div class="t">Пауза</div><button class="go">Продолжить</button><button class="snd"></button><button class="tod"></button></div>';document.body.appendChild(pm);
 const st=document.createElement('style');st.textContent=`#isPause{position:fixed;inset:0;z-index:40;display:none;align-items:center;justify-content:center;background:rgba(8,10,14,.62);backdrop-filter:blur(3px);font-family:'Rubik',system-ui,sans-serif}
#isPause .c{display:flex;flex-direction:column;gap:12px;align-items:center}#isPause .t{color:#F2E8D6;font-size:30px;font-weight:900;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px}
#isPause button{min-width:210px;height:48px;border-radius:14px;border:2px solid #0C120B;font:900 17px 'Rubik',system-ui,sans-serif;cursor:pointer}
#isPause .go{background:linear-gradient(#F2C232,#C99A1A);color:#1C2416}#isPause .tod,#isPause .snd{background:rgba(30,36,44,.9);color:#E8EEF4;border-color:rgba(255,255,255,.25);font-size:15px;height:42px}`;document.head.appendChild(st);
 const su=()=>{pm.querySelector('.snd').textContent='Звук: '+(AUD.on?'вкл':'выкл');pm.querySelector('.tod').textContent='Время: '+TODS[TOD].name;};
 pm.querySelector('.tod').addEventListener('click',()=>{applyTOD((TOD+1)%TODS.length);su();PAUSE.once=true;});
 const set=v=>{PAUSE.on=v;pm.style.display=v?'flex':'none';su();try{if(AUD.ctx){if(v)AUD.ctx.suspend();else AUD.ctx.resume();}if(AUD.music&&AUD.on){if(v)AUD.music.pause();else AUD.music.play().catch(()=>{});}}catch(_){}};PAUSE.set=set;
 tapBtn(sb,()=>set(true));pm.querySelector('.go').addEventListener('click',()=>set(false));pm.querySelector('.snd').addEventListener('click',()=>{AUD.setOn(!AUD.on);if(AUD.music)AUD.music.pause();su();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&!G_?.over&&!WU.on)set(true);});}
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
function spawnDrone(){invSet(D);D.wait=true;D.fall=null;[D.x,D.z]=airW(0,0,-0.35);D.yaw=0;D.pitch=-0.95;D.hp=D.max;D.dead=0;D.move=false;D.zoom=1;}
function droneLook(){const k=1/Math.tan(-D.pitch),h=D.alt;return[D.x+Math.cos(D.yaw)*h*k,D.z+Math.sin(D.yaw)*h*k];}
function stepDrone(dt){if(D.fall){stepFall(dt);return;}if(D.dead>0){D.dead-=dt;if(D.dead<=0){if(RSP.D>0){RSP.D--;spawnDrone();DST.in=1.1;}else D.dead=1e9;}return;}
 if(D.wait){if(CUR!=='drone')return;D.wait=false;}invTick(D,'drone',dt);
 D.hurt=Math.max(0,D.hurt-dt);
 /* real velocity of enemy units (smoothed), for leading the artillery */
 if(dt>0)for(const u of G_.units){if(u.s!==1||u.dead)continue;if(u.px!=null){const k=Math.min(1,dt*4);u.vx=(u.vx||0)+(((u.x-u.px)/dt)-(u.vx||0))*k;u.vz=(u.vz||0)+(((u.z-u.pz)/dt)-(u.vz||0))*k;}u.px=u.x;u.pz=u.z;}
 if(D.move){D.x+=Math.cos(D.yaw)*D.sp*dt;D.z+=Math.sin(D.yaw)*D.sp*dt;}
 D.x=Math.max(-150,Math.min(IW+150,D.x));D.z=Math.max(-150,Math.min(IH+150,D.z));D.y=D.alt+Math.sin(performance.now()/700)*1.5;
 const [lx,lz]=droneLook();DL.x=lx;DL.z=lz;DL.r=(D.alt/Math.sin(-D.pitch))*0.62/D.zoom+60;
 /* everything of the enemy inside that patch gets marked, for as long as it lives */
 for(const u of G_.units)if(u.s===1&&!u.dead&&!u.mk&&!SF(u)&&Math.hypot(u.x-lx,u.z-lz)<DL.r){u.mk=1;if(CUR==='drone')AUD.play('mark');}
 for(const t of G_.towers)if(t.s===1&&!t.mk&&Math.hypot(t.x-lx,t.z-lz)<DL.r)t.mk=1;
 for(const h of G_.harv)if(h.s===1&&!h.mk&&Math.hypot(h.x-lx,h.z-lz)<DL.r)h.mk=1;
 if(D.hp<=0&&!D.fall)downDrone();}
/* shot down: props scream, it slides off sideways, spins and drops; the boom in the recording (2.78 s) is the moment it hits the ground */
const DFALL=2.78;
function downDrone(){D.hp=0;D.move=false;G_.sides[1].ore+=200;LK.u=null;LK.t=0;const a=D.yaw+(rn()<0.5?1:-1)*(0.9+rn()*0.6);
 D.fall={t:0,y0:D.y,vx:Math.cos(a)*70,vz:Math.sin(a)*70,spin:(rn()<0.5?-1:1)*(1.2+rn()*0.6),roll:0,p0:D.pitch,sm:0};
 explode(D.x,D.y,D.z,0.6);if(!AUD.sample('dfall',CUR==='drone'?null:D.x,D.z,1.1))AUD.play('boom',D.x,D.z,1);}
function stepFall(dt){const f=D.fall;f.t+=dt;const k=Math.min(1,f.t/DFALL);D.x+=f.vx*dt;D.z+=f.vz*dt;f.vx*=1-dt*0.3;f.vz*=1-dt*0.3;
 const gy=Math.max(0,hgt(D.x,D.z))+4;D.y=gy+(f.y0-gy)*(1-k*k*(1.6-0.6*k));D.yaw+=f.spin*(0.4+k*2.2)*dt;D.pitch=f.p0+(-1.35-f.p0)*Math.min(1,k*1.3);f.roll=Math.sin(f.t*5)*0.25*k+k*0.35;
 f.sm-=dt;if(f.sm<=0){f.sm=0.06;puff(D.x,D.y+3,D.z,'trail');}
 if(k>=1){D.fall=null;D.dead=2.9;explode(D.x,gy,D.z,1.4);DST.t=0.9;}}   // 0.9 s static fading out + 2 s of black
function droneCam(dt){const [lx,lz]=[DL.x,DL.z];if(D.dead>0){const [bx,bz]=BASES[0];cam.position.set(bx-200,420,bz);cam.lookAt(bx+300,0,bz);}
 else{cam.position.set(D.x,D.y,D.z);cam.lookAt(D.x+Math.cos(D.yaw)*Math.cos(D.pitch)*100,D.y+Math.sin(D.pitch)*100,D.z+Math.sin(D.yaw)*Math.cos(D.pitch)*100);if(D.fall)cam.rotateZ(D.fall.roll);}
 const fov=56/D.zoom;if(Math.abs(cam.fov-fov)>0.01){cam.fov=fov;cam.updateProjectionMatrix();}}
/* ---------- lost signal: video static over the drone camera while it falls, a burst at the crash ---------- */
const DST={t:0,in:0,cv:null,c:null,img:null,btn:null,bk:null};
{const cv=document.createElement('canvas');cv.width=192;cv.height=108;cv.id='drStatic';cv.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;image-rendering:pixelated;display:none;z-index:3';H.appendChild(cv);DST.cv=cv;DST.c=cv.getContext('2d');DST.img=DST.c.createImageData(192,108);
 const bk=document.createElement('div');bk.style.cssText='position:absolute;inset:0;background:#000;pointer-events:none;opacity:0;display:none;z-index:4';H.appendChild(bk);DST.bk=bk;
 const b=document.createElement('div');b.className='b';b.style.cssText='right:max(14px,env(safe-area-inset-right));top:56px;padding:0 12px;height:40px;font-size:13px;display:none;background:rgba(150,40,30,.85)';b.textContent='Сбить дрон';H.appendChild(b);DST.btn=b;
 /* TEST: drone picture in colour instead of black-and-white */
 {const c=document.createElement('div');c.className='b';c.style.cssText='right:calc(max(14px,env(safe-area-inset-right)) + 118px);top:56px;padding:0 12px;height:40px;font-size:13px;display:none';c.textContent='Цвет: выкл';H.appendChild(c);DST.col=c;tapBtn(c,()=>{DST.color=!DST.color;c.textContent='Цвет: '+(DST.color?'вкл':'выкл');});}
 tapBtn(b,()=>{if(!D.fall&&D.dead<=0)D.hp=0;});}
/* respawns left on the vehicle buttons; a vehicle that is gone for good is greyed out and we leave it */
function vehBadges(){const vb=document.querySelectorAll('#h3 .veh .b');const m={titan:[P,'P'],drone:[D,'D'],plane:[F,'F']};
 vb.forEach(b=>{const [o,k]=m[b.dataset.v];let n=b.querySelector('.n');if(!n){n=document.createElement('span');n.className='n';b.appendChild(n);}const gone=o.dead>1e8;n.textContent=gone?'✕':RSP[k];b.classList.toggle('gone',gone);});
 const cur=m[CUR];if(cur&&cur[0].dead>1e8&&!G_.over){for(const v of ['titan','plane','drone'])if(m[v][0].dead<1e8){setVeh(v);break;}}}
function drawStatic(dt){vehBadges();DST.btn.style.display=CUR==='drone'&&!G_.over?'block':'none';if(DST.col)DST.col.style.display=DST.btn.style.display;DST.t=Math.max(0,DST.t-dt);DST.in=Math.max(0,DST.in-dt);
 /* crash: full static that fades to black; black while waiting; the new drone fades in from black with a light ripple */
 let a=0,blk=0;if(CUR==='drone'){if(D.fall){const k=Math.min(1,D.fall.t/DFALL);a=0.12+0.55*k*k+(rn()<0.15?0.3:0);}
  else if(D.dead>0){a=DST.t>0?1:0;blk=DST.t>0?Math.min(1,(1-DST.t/0.9)*1.15):1;}
  else if(DST.in>0){const k=DST.in/1.1;blk=k*k;a=0.1+0.3*k;}}
 if(blk>0){DST.bk.style.display='block';DST.bk.style.opacity=blk.toFixed(3);}else if(DST.bk.style.display!=='none')DST.bk.style.display='none';
 if(a<=0){if(DST.cv.style.display!=='none')DST.cv.style.display='none';return;}DST.cv.style.display='block';DST.cv.style.opacity=Math.min(1,a).toFixed(2);
 const d=DST.img.data;let band=-1,bh=0;if(rn()<0.5){band=Math.floor(rn()*108);bh=2+Math.floor(rn()*10);}
 for(let y=0;y<108;y++){const tear=y>=band&&y<band+bh;for(let x=0;x<192;x++){const i=(y*192+x)*4,v=tear?(rn()<0.5?235:20):Math.floor(rn()*255);d[i]=d[i+1]=d[i+2]=v;d[i+3]=255;}}
 DST.c.putImageData(DST.img,0,0);}
/* ---------- artillery from the base battery ---------- */
function artTap(sx,sy){if(D.dead>0||D.fall)return;if(ART.cd>0){HUD.msg('Артиллерия перезаряжается');return;}
 /* artillery always lands exactly under the finger */
 let x,z;{const r=new THREE.Vector3(sx/innerWidth*2-1,-(sy/innerHeight*2-1),0.5).unproject(cam).sub(cam.position).normalize();if(r.y>=-0.02)return;const k=-cam.position.y/r.y;x=cam.position.x+r.x*k;z=cam.position.z+r.z*k;}
 fireArt(x,z);}
const artTime=d=>1.6+d/2600,WHOOSH_HIT=2.03;
function fireArt(x,z){ART.cd=ART.CD;BATT[0].forEach((g,i)=>{const gx=g.position.x,gz=g.position.z,a=Math.atan2(z-gz,x-gx);if(g.userData.tu)g.userData.tu.rotation.y=-a;
  const tx=x+(i-1)*22+(rn()-0.5)*14,tz=z+(rn()-0.5)*22,d=Math.hypot(tx-gx,tz-gz),T=artTime(d)+i*0.18;
  ART.sh.push({id:++ART.id,sx:gx,sy:18,sz:gz,tx,tz,x:gx,y:18,z:gz,t:-i*0.18,T,h:Math.min(900,180+d*0.22),tr:0});
  setTimeout(()=>{puff(gx+Math.cos(a)*16,22,gz+Math.sin(a)*16,'muzzle');AUD.play('cannon',gx,gz);},i*180);});
 {const T0=artTime(Math.hypot(x-BASES[0][0],z-BASES[0][1]));AUD.sample('whoosh',x,z,0.7,Math.max(0,T0-WHOOSH_HIT),Math.max(0,WHOOSH_HIT-T0));ART.quiet=performance.now()+(T0+1)*1000;}
 const m=document.getElementById('drTgt');if(m){m.dataset.x=x;m.dataset.z=z;m.dataset.t=performance.now()+artTime(Math.hypot(x-BASES[0][0],z-BASES[0][1]))*1000+400;}}
function stepArt(dt){ART.cd=Math.max(0,ART.cd-dt);stepMissiles(dt);
 for(let i=ART.sh.length-1;i>=0;i--){const a=ART.sh[i];a.t+=dt;if(a.t<0)continue;const k=Math.min(1,a.t/a.T);a.x=a.sx+(a.tx-a.sx)*k;a.z=a.sz+(a.tz-a.sz)*k;a.y=a.sy*(1-k)+Math.sin(Math.PI*k)*a.h;
  a.tr-=dt;if(a.tr<=0){a.tr=0.05;puff(a.x,a.y,a.z,'trail');}
  if(k>=1){ART.sh.splice(i,1);if(a.side===1)botArtImpact(a.tx,a.tz);else artImpact(a.tx,a.tz);}}}
function artImpact(x,z){if(AUD.buf.whoosh&&performance.now()<ART.quiet){AUD.mute=1;explode(x,0,z,1.9);AUD.mute=0;}else explode(x,0,z,1.9);P.shake=Math.max(P.shake||0,Math.hypot(x-P.x,z-P.z)<300?0.8:0);
 for(const u of G_.units){if(u.dead||u.s===0||US[u.k].air)continue;const d=Math.hypot(u.x-x,u.z-z);if(d<ART.R)dmgUnit(u,ART.DMG*(d<ART.R*0.5?1:0.55),0);}
 if(ET.dead<=0&&Math.hypot(ET.x-x,ET.z-z)<ART.R+30)ET.hp-=ART.DMG;
 for(const t of G_.towers){if(t.s===0||t.dead)continue;if(Math.hypot(t.x-x,t.z-z)<ART.R*0.6+14)dmgTower(t,t.hp+1,0);}
 for(const h of G_.harv){if(h.s===0||h.dead)continue;if(Math.hypot(h.x-x,h.z-z)<ART.R)dmgHarv(h,ART.DMG,0);}
 if(!G_.over&&Math.hypot(x-BASES[1][0],z-BASES[1][1])<330)hitBase(1,1);
 {const m=nearMineOf(1,x,z,95);if(m&&!G_.over)hitMine(m,1);}}
/* ---------- the drone in the world (seen from the Titan), the shells in flight ---------- */
let DRONE_O=null;
const mkShell=()=>{const g=new THREE.Group();const body=new THREE.Mesh(new THREE.CylinderGeometry(1.7,1.7,11,10),std(0x3A3E36,0.55,0.5));body.rotation.z=Math.PI/2;g.add(body);
   const band=new THREE.Mesh(new THREE.CylinderGeometry(1.85,1.85,1.6,10),std(0xB08A3C,0.4,0.8));band.rotation.z=Math.PI/2;band.position.x=-3.2;g.add(band);
   const nose=new THREE.Mesh(new THREE.ConeGeometry(1.7,5,10),std(0x4A4E44,0.5,0.5));nose.rotation.z=-Math.PI/2;nose.position.x=8;g.add(nose);
   const f=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.glow,color:0xFFB060,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));f.scale.set(13,13,1);f.position.x=-7;g.add(f);g.scale.setScalar(1.3);return g;};
function syncDrone(t,dt){if(!DRONE_O){const g=new THREE.Group(),M=mats(0);g.add(BOX(10,3,10,M.dark,0,0,0),BOX(4,3,4,M.gun,0,-2.5,3));for(const [x,z] of [[9,9],[-9,9],[9,-9],[-9,-9]]){g.add(BOX(12,1,1.6,M.gun,x/2,0.5,z/2));const r=BOX(9,0.3,1.2,M.gun,x,1.6,z);r.userData.spin=1;g.add(r);}addShadow(g,true,false);DRONE_O=g;dyn.add(g);}
 DRONE_O.visible=LIVE(D)&&CUR!=='drone';DRONE_O.position.set(D.x,D.y,D.z);DRONE_O.rotation.y=-D.yaw;DRONE_O.rotation.z=D.fall?D.fall.roll*2:0;DRONE_O.children.forEach(c=>{if(c.userData.spin)c.rotation.y=t*40;});
 for(const m of MIS)if(m.t>=0)sync('M'+m.id,()=>{const g=new THREE.Group();const b=new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.9,9,8),std(0xD8D8D0,0.5,0.4));b.rotation.z=Math.PI/2;g.add(b);const f=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.glow,color:0xFFB050,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));f.scale.set(10,10,1);f.position.x=-6;g.add(f);return g;},o=>{o.position.set(m.x,m.y,m.z);o.rotation.set(0,-Math.atan2(m.vz,m.vx),Math.atan2(m.vy,Math.hypot(m.vx,m.vz)));});
 /* artillery shell: dark body, brass band, pointed nose, a hot glow at the tail; nose along +X, turned along the flight path */
 for(const a of ART.sh)sync('a'+a.id,mkShell,
  o=>{o.position.set(a.x,a.y,a.z);o.visible=a.t>=0;const k=Math.min(1,Math.max(0,a.t)/a.T),vx=(a.tx-a.sx)/a.T,vz=(a.tz-a.sz)/a.T,vy=-a.sy/a.T+Math.cos(Math.PI*k)*a.h*Math.PI/a.T;
   o.rotation.set(0,-Math.atan2(vz,vx),Math.atan2(vy,Math.hypot(vx,vz)));});}
/* ---------- HUD: vehicle switch, drone camera overlay, red markers over marked enemies ---------- */
{const st=document.createElement('style');st.textContent=`
#h3 .veh{position:absolute;left:50%;top:35px;transform:translateX(-50%);display:flex;gap:10px}
#h3 .veh .b{position:static;width:34px;height:34px;border-radius:50%;padding:0;border:2px solid #3EA6FF;background:radial-gradient(circle,rgba(20,40,70,.75),rgba(8,14,24,.8));box-shadow:0 0 10px rgba(62,166,255,.45)}
#h3 .veh .b svg{width:21px;height:21px;fill:#BFE0FF}
#h3 .veh .b.on{border-color:#F2C232;background:radial-gradient(circle,rgba(90,70,10,.8),rgba(30,22,4,.85));box-shadow:0 0 14px rgba(242,194,50,.7)}
#h3 .veh .b.on svg{fill:#FFE38A}
#h3 .veh .b{position:relative}#h3 .veh .b .n{position:absolute;right:-5px;bottom:-5px;min-width:15px;height:15px;border-radius:8px;background:#0C141E;border:1px solid rgba(255,255,255,.5);color:#fff;font:800 10px/14px 'Rubik',system-ui,sans-serif;text-align:center}
#h3 .veh .b.gone{opacity:.35;filter:grayscale(1)}
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
#mkLayer i.hero{--c:#FFD028;width:46px;height:46px;margin:-23px 0 0 -23px;transform:rotate(45deg)}
#mkLayer i.hero.air{--c:#FFD028}
#mkLayer i.hero{background:linear-gradient(var(--c),var(--c)) right top/8px 2px no-repeat,linear-gradient(var(--c),var(--c)) right top/2px 8px no-repeat,linear-gradient(var(--c),var(--c)) left bottom/8px 2px no-repeat,linear-gradient(var(--c),var(--c)) left bottom/2px 8px no-repeat,linear-gradient(var(--c),var(--c)) right bottom/8px 2px no-repeat,linear-gradient(var(--c),var(--c)) right bottom/2px 8px no-repeat}
#mkLayer i.hero::after{content:'';position:absolute;left:0;top:0;width:18px;height:18px;background:center/contain no-repeat;transform:translate(-50%,-50%) rotate(-45deg) translateY(6px)}
#mkLayer i.hero.ht::after{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='%23FFD028' stroke='%23000' stroke-opacity='.55' stroke-width='1.2' paint-order='stroke'%3E%3Cpath d='M3 20h26l-3 6H6z'/%3E%3Cpath d='M8 14h13l2 5H7z'/%3E%3Cpath d='M19 15.5h11v2H19z'/%3E%3C/svg%3E")}#mkLayer i.hero.hd::after{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='%23FFD028' stroke='%23000' stroke-opacity='.55' stroke-width='1.2' paint-order='stroke'%3E%3Ccircle cx='7' cy='7' r='5'/%3E%3Ccircle cx='25' cy='7' r='5'/%3E%3Ccircle cx='7' cy='25' r='5'/%3E%3Ccircle cx='25' cy='25' r='5'/%3E%3Cpath d='M8 6l18 18-2 2L6 8zM24 6l2 2L8 26l-2-2z'/%3E%3Crect x='12' y='12' width='8' height='8' rx='2'/%3E%3C/svg%3E")}#mkLayer i.hero.hf::after{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='%23FFD028' stroke='%23000' stroke-opacity='.55' stroke-width='1.2' paint-order='stroke'%3E%3Cpath d='M16 2c1.3 0 2 1.4 2 3v7l11 6v3l-11-3v6l3 2.5V29l-5-1.5-5 1.5v-2.5l3-2.5v-6L3 21v-3l11-6V5c0-1.6.7-3 2-3z'/%3E%3C/svg%3E")}
#mkLayer i.hero.aim{transform:rotate(45deg) scale(1.3)}#mkLayer i.hero.lp{transform:rotate(45deg) scale(1.25)}#mkLayer i.hero.lk{transform:rotate(45deg) scale(1.35)}
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
function setVeh(v){if(v===CUR)return;if((v==='titan'?P:v==='drone'?D:F).dead>1e8)return;VEH().move=false;CUR=v;for(const b of q('.veh').children)b.classList.toggle('on',b.dataset.v===CUR);
 const dr=CUR==='drone',pl=CUR==='plane';document.getElementById('drHud').style.display=dr?'block':'none';q('.sup').style.display=dr?'none':'flex';q('.sup').firstChild.textContent=pl?'Ракеты':'Залп';q('.go').style.display=pl?'none':'flex';
 {const g=document.getElementById('tiGun');if(g)g.style.display=pl?'none':'';for(const k of [0,1]){const f=document.getElementById('tiFl'+k);if(f)f.style.display=pl?'none':'';}}PA.style.display=pl?'flex':'none';
 const s=q('img.sight');if(s)s.style.display=dr?'none':'block';q('svg.xh').style.display=dr?'none':'block';q('.frame').style.display=dr?'none':'block';
 HUD.msg(dr?'Дрон: свайп — обзор, тап по врагу — артудар':pl?'Самолёт: свайп — поворот, пулемёт стреляет сам':'Титан');}
function droneHud(t){if(CUR!=='drone')return;const g=document.getElementById('tiCock');if(g)g.style.display='none';
 const deg=((D.yaw*180/Math.PI)+90+3600)%360,tp=document.querySelector('#drHud .tape');let h='<b></b>';
 for(let a=-75;a<=75;a+=15){const v=Math.round((deg+a)/15)*15,dx=(v-deg)*2.4;if(Math.abs(dx)>170)continue;const w=(v+360)%360,lab={0:'С',90:'В',180:'Ю',270:'З',45:'СВ',135:'ЮВ',225:'ЮЗ',315:'СЗ'}[w];h+=`<i style="left:${180+dx}px;${lab?'color:#fff':'opacity:.7;font-size:11px'}">${lab||w}</i>`;}tp.innerHTML=h;
 document.querySelector('#drHud .zl').innerHTML=`X${D.zoom.toFixed(1)}<br>ВЫС ${Math.round(D.fall?Math.max(0,D.y-Math.max(0,hgt(D.x,D.z))):D.alt)} м<br>НАКЛ ${Math.round(-D.pitch*180/Math.PI)}°<br>МЕТОК ${G_.units.filter(u=>u.mk&&!u.dead).length+G_.towers.filter(t=>t.mk).length}<br>РАКЕТЫ ${MIS_CD>0?MIS_CD.toFixed(1)+' с':'ГОТОВЫ'}`;
 const ar=document.querySelector('#drHud .art');ar.classList.toggle('ready',ART.cd<=0);ar.innerHTML=ART.cd>0?'АРТ<br>'+ART.cd.toFixed(1)+' с':'АРТ<br>ГОТОВА<br><span style="font-size:10px;display:block;margin-top:2px">тап по цели</span>';
 const m=document.getElementById('drTgt');if(m.dataset.t&&performance.now()<+m.dataset.t){const v=new THREE.Vector3(+m.dataset.x,0,+m.dataset.z).project(cam);if(v.z<1){m.style.display='block';m.style.left=((v.x+1)/2*innerWidth)+'px';m.style.top=((1-v.y)/2*innerHeight)+'px';}else m.style.display='none';}else m.style.display='none';}
/* red brackets over every marked enemy that is on screen, in either view */
function markHud(){const L_=document.getElementById('mkLayer').children,v=new THREE.Vector3();let n=0;const put=(x,y,z,big,cls,vk)=>{if(n>=L_.length)return;if(vk&&!live.has(vk))return;v.set(x,y,z).project(cam);if(v.z>1||Math.abs(v.x)>1.05||Math.abs(v.y)>1.05)return;const el=L_[n++];el.style.display='block';el.className=(big?'t ':'')+(cls||'');el.style.left=((v.x+1)/2*innerWidth)+'px';el.style.top=((1-v.y)/2*innerHeight)+'px';};
 const AIM=CUR==='titan'?LOCK:CUR==='plane'?LOCKF:null,au=AIM&&AIM.tg.k==='u'?AIM.tg.o:null,ak=AIM?AIM.tg.k:'';
 if(ET.dead<=0)put(ET.x,40,ET.z,true,'hero ht'+(ET.lk?' lk':LK.u===ET&&LK.t>0.25?' lp':ak==='et'?' aim':''));if(ED.dead<=0&&!SF(ED))put(ED.x,ED.y,ED.z,true,'air hero hd'+(ak==='ed'?' aim':''));if(EF.dead<=0&&!SF(EF))put(EF.x,EF.y,EF.z,true,'air hero hf'+(ak==='ef'?' aim':''));
 for(const u of G_.units)if((u.mk||u===au)&&!u.dead)put(u.x,u.y+(u.k==='heli'?14:26),u.z,u.k!=='inf',(US[u.k].air?'air ':'')+(u.lk?'lk':u===au?'aim':LK.u===u&&LK.t>0.25?'lp':''),u.vk);for(const t of G_.towers)if(t.mk&&!t.dead)put(t.x,22,t.z,true);for(const h of G_.harv)if(h.mk&&!h.dead)put(h.x,10,h.z,false);
 for(let i=n;i<L_.length;i++)if(L_[i].style.display!=='none')L_[i].style.display='none';}
{const p0=AUD.play.bind(AUD);AUD.play=function(kind,x,z,k){if(kind==='mark'){if(!this.ctx||!this.on)return;const C=this.ctx,now=C.currentTime;if(this.last.mark&&now-this.last.mark<0.25)return;this.last.mark=now;const o=C.createOscillator(),g=C.createGain();o.type='square';o.frequency.setValueAtTime(1400,now);o.frequency.setValueAtTime(1900,now+0.05);g.gain.setValueAtTime(0.05,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.12);o.connect(g).connect(this.out);o.start(now);o.stop(now+0.13);return;}return p0(kind,x,z,k);};}
window.__isle.D=D;window.__isle.cam=cam;window.__isle.DL=DL;window.__isle.stepArt=stepArt;window.__isle.stepDrone=stepDrone;window.__isle.setVeh=setVeh;window.__isle.fireArt=fireArt;window.__isle.ART=ART;window.__isle.artTap=artTap;

/* ================== lock-on: a moving enemy held under the red dot for 3 s gets homing missiles from the base ================== */
const LOCK_T=3,LOCK_PX=34,MIS=[];let MIS_CD=0,MID=0;const LK={u:null,t:0,beep:0};
function stepLock(dt){if(CUR!=='drone'||D.dead>0||D.fall||G_.over){LK.u=null;LK.t=0;return;}
 const cx=innerWidth/2,cy=innerHeight/2,v=new THREE.Vector3();let best=null,bd=LOCK_PX*D.zoom;/* the same patch of ground at any zoom */
 if(ET.dead<=0&&!ET.lk){v.set(ET.x,20,ET.z).project(cam);if(v.z<=1){const d=Math.hypot((v.x+1)/2*innerWidth-cx,(1-v.y)/2*innerHeight-cy)-14;if(d<bd){bd=d;best=ET;}}}
 for(const u of G_.units){if(u.dead||u.s!==1||u.lk||SF(u))continue;v.set(u.x,u.y+6,u.z).project(cam);if(v.z>1)continue;const d=Math.hypot((v.x+1)/2*innerWidth-cx,(1-v.y)/2*innerHeight-cy);if(d<bd){bd=d;best=u;}}
 if(best&&best===LK.u)LK.t+=dt;else{LK.u=best;LK.t=0;}
 if(LK.u){LK.u.mk=1;LK.beep-=dt;if(LK.t>0.25&&LK.beep<=0){LK.beep=0.45-0.3*Math.min(1,LK.t/LOCK_T);AUD.play('lockp');}}
 if(LK.u&&LK.t>=LOCK_T){if(MIS_CD>0){if(LK.t<LOCK_T+dt*1.5)HUD.msg('Ракеты перезаряжаются: '+Math.ceil(MIS_CD)+' с');return;}
  launchMissiles(LK.u);LK.u=null;LK.t=0;}}
function launchMissiles(u){u.lk=1;MIS_CD=6;HUD.msg('Цель захвачена — пуск ракет!');
 BATT[0].forEach((g,i)=>{if(i===1)return;const gx=g.position.x,gz=g.position.z;MIS.push({id:++MID,x:gx,y:20,z:gz,vx:(rn()-0.5)*40,vy:260,vz:(rn()-0.5)*40,t:-i*0.12,u,tx:u.x,tz:u.z,tr:0,go:0});});}
function stepMissiles(dt){MIS_CD=Math.max(0,MIS_CD-dt);const SP=1150;
 for(const u of [ET,...G_.units])if(u.lk&&!u.dead){LK.lb=(LK.lb||0)-dt;if(LK.lb<=0){LK.lb=0.13;if(CUR==='drone')AUD.play('lockf');}break;}
 for(let i=MIS.length-1;i>=0;i--){const m=MIS[i];m.t+=dt;if(m.t<0)continue;if(!m.go){m.go=1;puff(m.x,22,m.z,'muzzle');AUD.play('shot',m.x,m.z);}if(m.u&&!m.u.dead){m.tx=m.u.x;m.tz=m.u.z;m.ty=m.u.y+5;}else m.ty=m.ty??2;
  const dx=m.tx-m.x,dy=(m.ty??5)-m.y,dz=m.tz-m.z,L=Math.hypot(dx,dy,dz)||1;
  if(m.t<0.7){m.vy-=120*dt;}else{const k=Math.min(1,dt*(3+m.t*2));const sp=Math.min(SP,300+m.t*700);m.vx+=(dx/L*sp-m.vx)*k;m.vy+=(dy/L*sp-m.vy)*k;m.vz+=(dz/L*sp-m.vz)*k;}
  m.x+=m.vx*dt;m.y+=m.vy*dt;m.z+=m.vz*dt;m.tr-=dt;if(m.tr<=0){m.tr=0.035;puff(m.x,m.y,m.z,'trail');}
  if(L<14||m.t>14||(m.t>0.8&&m.y<0.5)){MIS.splice(i,1);explode(m.x,Math.max(0,m.y),m.z,1.2);
   if(m.u&&!m.u.dead&&Math.hypot(m.u.x-m.x,m.u.z-m.z)<(m.u===ET?45:30)){if(m.u===ET)ET.hp-=1100;else dmgUnit(m.u,1100,0);}
   for(const u of G_.units){if(u.dead||u.s===0||u===m.u)continue;if(Math.hypot(u.x-m.x,u.z-m.z)<30)dmgUnit(u,300,0);}
   if(m.u&&!m.u.dead&&!MIS.some(q=>q.u===m.u))m.u.lk=0;}}}
{const p1=AUD.play;AUD.play=function(kind,x,z,k){if(kind==='lockp'||kind==='lockf'){if(!this.ctx||!this.on)return;const C=this.ctx,now=C.currentTime,o=C.createOscillator(),g=C.createGain();o.type='square';
  o.frequency.setValueAtTime(kind==='lockf'?2300:1200,now);g.gain.setValueAtTime(kind==='lockf'?0.06:0.04,now);g.gain.exponentialRampToValueAtTime(0.001,now+(kind==='lockf'?0.07:0.06));o.connect(g).connect(this.out);o.start(now);o.stop(now+0.09);return;}return p1.call(this,kind,x,z,k);};}
window.__isle.setVeh=setVeh;window.__isle.LK=LK;window.__isle.MIS=MIS;window.__isle.stepLock=stepLock;window.__isle.stepMissiles=stepMissiles;window.__isle.launchMissiles=launchMissiles;

/* ================== the plane: always flying, machine gun fires by itself, rockets on demand, turns back smoothly past the limit ================== */
const F={x:0,z:0,y:0,yaw:0,ty:0,pitch:-0.18,hp:2500,max:2500,dead:0,zoom:1,alt:200,sp:225,cd:0,rcd:0,bank:0,turn:false,hurt:0,move:true};
const ZF=()=>Math.max(F.zoom||1,F.az||1);                 // plane view zoom: the player's own, or the long-burst auto zoom
const PLANE={limit:450,maxRate:0.75,mgCd:0.09,mgDmg:32,range:4000,cone:0.05,rocketCd:5,rocketN:6,rocketDmg:300,rocketR:48};
let LOCKF=null;const PR=[],PB=[];let PRID=0;
/* take-off run: speeds up along the runway, lifts off at 170 m/s, climbs out; true while still on the run */
function takeoff(o,dt){const T=o.take;T.v=Math.min(225,T.v+48*dt);o.x+=Math.cos(o.yaw)*T.v*dt;o.z+=Math.sin(o.yaw)*T.v*dt;
 if(T.v>170)o.y+=(T.v-150)*0.55*dt;o.bank=0;if(o===F)o.pitch=Math.min(0.12,-0.03+Math.max(0,o.y-PGY)*0.004);
 if(T.v>=225&&o.y>45){o.take=null;o.climb=1;if(o===F)o.pe=2.5;return false;}return true;}
const PGY=10;                                               // plane height on the runway: wheels on the asphalt, not in it
function planePark(){F.climb=0;F.pe=0;F.spin=0;[F.x,F.z]=airW(0,-0.01,-0.21);F.y=PGY;F.take=null;F.park=true;F.home=null;F.v=F.sp;F.yaw=0;F.ty=0;F.pitch=-0.03;F.bank=0;F.turn=false;}
function spawnPlane(){invSet(F);planePark();F.lz=9;F.az=1;F.yaw=0;F.ty=0;F.pitch=-0.03;F.hp=F.max;F.dead=0;F.bank=0;F.turn=false;F.zoom=1;}
function stepPlane(dt){if(F.dead>0){F.dead-=dt;if(F.dead<=0){if(RSP.F>0){RSP.F--;spawnPlane();}else F.dead=1e9;}return;}
 F.cd=Math.max(0,F.cd-dt);F.rcd=Math.max(0,F.rcd-dt);F.hurt=Math.max(0,F.hurt-dt);
 invTick(F,'plane',dt);if(F.pe>0){F.pe-=dt;F.pitch+=(-0.18-F.pitch)*Math.min(1,dt*1.5);}
 if(F.park){if(F.spin){let e=-F.yaw;e=Math.atan2(Math.sin(e),Math.cos(e));const st_=Math.sign(e)*Math.min(Math.abs(e),0.7*dt);F.yaw+=st_;F.ty=F.yaw;if(Math.abs(e)<0.01){F.yaw=F.ty=0;F.spin=0;}}
  if(CUR!=='plane')return;F.park=false;F.spin=0;F.yaw=F.ty=0;F.take={v:20};}
 if(F.take&&takeoff(F,dt)&&F.hp>0)return;
 let vT=F.sp,yT=F.alt;
 if(CUR!=='plane'&&!F.turn){/* left alone: back to the airfield, line up with the runway from the west, glide in and stop on the apron */
  const [px,pz]=airW(0,-0.01,-0.21),H=F.home||(F.home={ph:0});const ax=px+2100;
  const steer=w=>{let e=w-F.yaw;e=Math.atan2(Math.sin(e),Math.cos(e));if(Math.abs(e)>2.4){H.sd=H.sd||(e>0?1:-1);e=H.sd*Math.abs(e);}else H.sd=0;F.ty=F.yaw+e;return e;};
  if(H.ph===0){steer(Math.atan2(pz-F.z,ax-F.x));if(Math.hypot(ax-F.x,pz-F.z)<320)H.ph=1;}
  else{const d=Math.hypot(px-F.x,pz-F.z),e=steer(Math.atan2(pz-F.z,px-F.x));
   if(Math.abs(e)<0.3||H.td){const k=Math.max(0,Math.min(1,(d-700)/1400));yT=PGY+(F.alt-PGY)*k;vT=d>700?70+(F.sp-70)*k:Math.max(20,70*d/700);
    if(d<760&&F.y<12)H.td=1;if(H.td){F.y=Math.max(PGY,F.y-20*dt);F.v=Math.min(F.v,vT);}if(d<12){planePark();F.yaw=Math.PI;F.ty=Math.PI;F.spin=1;return;}}
   else if(d<1300)H.ph=0;}
 }else F.home=null;
 F.v=(F.v||F.sp)+(vT-(F.v||F.sp))*Math.min(1,dt*0.8);
 const L=PLANE.limit,out=!F.home&&(F.x<-L||F.z<-L||F.x>IW+L||F.z>IH+L);
 /* past the limit: turn towards the middle at the gentlest rate that still makes it, until heading inwards */
 if(out||F.turn){const want=Math.atan2(IH/2-F.z,IW/2-F.x);let d=want-F.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));if(out)F.turn=true;if(Math.abs(d)<0.25&&!out)F.turn=false;F.ty=F.yaw+Math.sign(d||1)*Math.min(Math.abs(d),0.9);}
 let d=F.ty-F.yaw;const rate=Math.max(-PLANE.maxRate,Math.min(PLANE.maxRate,d*1.6));F.yaw+=rate*dt;F.bank+=(-rate*0.75-F.bank)*Math.min(1,dt*3);
 F.x+=Math.cos(F.yaw)*F.v*dt;F.z+=Math.sin(F.yaw)*F.v*dt;{const dy=(yT-F.y)*Math.min(1,dt*(F.home?2.5:1.2));F.y+=F.climb?Math.min(dy,35*dt):dy;if(F.climb&&Math.abs(yT-F.y)<3)F.climb=0;}
 /* machine gun: the first enemy near the centre of the sight */
 if(CUR==='plane')for(const u of G_.units){if(u.dead||u.s===0||!US[u.k].air||u.mk||SF(u))continue;const dx=u.x-F.x,dz=u.z-F.z,d=Math.hypot(dx,dz);if(d<2000){let a=Math.atan2(dz,dx)-F.yaw;a=Math.atan2(Math.sin(a),Math.cos(a));if(Math.abs(a)<0.75)u.mk=1;}}
 /* long-range bursts (2–4 km) pull the view smoothly out of the cockpit to full zoom; 1 s after the last such shot it eases back */
 F.lz=(F.lz??9)+dt;{const zin=F.lz<1&&CUR==='plane';F.az=(F.az||1)+((zin?3:1)-(F.az||1))*Math.min(1,dt*(zin?2.2:1.32));}if(F.az<1.002)F.az=1;
 LOCKF=null;if(CUR==='plane'&&!G_.over){const o=new THREE.Vector3(F.x,F.y,F.z),dv=new THREE.Vector3(Math.cos(F.yaw)*Math.cos(F.pitch),Math.sin(F.pitch),Math.sin(F.yaw)*Math.cos(F.pitch));let best=PLANE.cone/F.zoom;
  const test=(x,y,z,tg,sz=10)=>{const vx=x-o.x,vy=y-o.y,vz=z-o.z,Ln=Math.hypot(vx,vy,vz);if(Ln>PLANE.range||Ln<25)return;const a=Math.acos(Math.max(-1,Math.min(1,(vx*dv.x+vy*dv.y+vz*dv.z)/Ln)))-Math.atan(sz/Ln);if(a<best){best=a;LOCKF={tg,x,y,z,d:Ln};}};
  for(const u of G_.units){if(u.dead||u.s===0||SF(u))continue;test(u.x,u.y+(u.k==='heli'?5:12),u.z,{k:'u',o:u},u.k==='heli'?30:u.k==='inf'?10:36);}
  for(const t of G_.towers){if(t.s===0)continue;test(t.x,14,t.z,{k:'t',o:t});}
  for(const h of G_.harv){if(h.s===0)continue;test(h.x,7,h.z,{k:'h',o:h});}
  for(const m of G_.mines){if(m.s===0||m.dead)continue;test(m.x,8,m.z,{k:'m',o:m},55);}
  if(ET.dead<=0)test(ET.x,24,ET.z,{k:'et'},50);if(ED.dead<=0&&!SF(ED))test(ED.x,ED.y,ED.z,{k:'ed'},16);if(EF.dead<=0&&!SF(EF))test(EF.x,EF.y,EF.z,{k:'ef'},26);
  if(LOCKF&&F.cd<=0){F.cd=PLANE.mgCd;const tg=LOCKF.tg;if(LOCKF.d>=2000)F.lz=0;applyHit(tg,PLANE.mgDmg*(tg.k==='t'?0.5:1),0);
   const sd=(F.mgSide=-(F.mgSide||1));{const ax=F.x-Math.sin(F.yaw)*sd*7+Math.cos(F.yaw)*8,ay=F.y-4,az=F.z+Math.cos(F.yaw)*sd*7+Math.sin(F.yaw)*8,bx=LOCKF.x+(rn()-0.5)*5,by=LOCKF.y+(rn()-0.5)*4,bz=LOCKF.z+(rn()-0.5)*5;PB.push({id:++PRID,x:ax,y:ay,z:az,sx:ax,sy:ay,sz:az,tx:bx,ty:by,tz:bz,t:0,T:Math.max(0.05,Math.hypot(bx-ax,by-ay,bz-az)/2400)});AUD.play('mg',ax,az);}}}
 if(F.hp<=0){F.hp=0;F.dead=5;G_.sides[1].ore+=400;explode(F.x,F.y,F.z,2);if(CUR==='plane')HUD.msg('Самолёт сбит — новый через 5 с');}
 /* machine-gun rounds: bright streaks flying to the target, a spark where they land */
 for(let i=PB.length-1;i>=0;i--){const b=PB[i];b.t+=dt;const k=Math.min(1,b.t/b.T);b.px=b.x;b.py=b.y;b.pz=b.z;b.x=b.sx+(b.tx-b.sx)*k;b.y=b.sy+(b.ty-b.sy)*k;b.z=b.sz+(b.tz-b.sz)*k;if(k>=1){PB.splice(i,1);puff(b.tx,b.ty,b.tz,'muzzle');if(rn()<0.4)puff(b.tx,b.ty,b.tz,'dust');}}
 /* rockets in flight */
 for(let i=PR.length-1;i>=0;i--){const r=PR[i];r.t+=dt;if(r.t<0)continue;if(!r.go){r.go=1;r.x=F.x-Math.sin(F.yaw)*r.sd*8;r.y=F.y-4;r.z=F.z+Math.cos(F.yaw)*r.sd*8;AUD.play('shot',r.x,r.z);}
  const sp=Math.min(1300,500+r.t*1600);
  if(!r.aim){r.aim=1;/* leave along the line to the sight point, spread a little */const dx=r.tx-r.x,dy=r.ty-r.y,dz=r.tz-r.z,L=Math.hypot(dx,dy,dz)||1;r.vx=dx/L;r.vy=dy/L;r.vz=dz/L;}
  let tp=r.tg&&r.tg();let hitNow=false;
  if(tp&&r.strong){/* lead the target: where it will be when the rocket gets there */if(r.pp&&dt>0){const k=Math.min(1,dt*6);r.tv=r.tv||[0,0,0];for(let q=0;q<3;q++)r.tv[q]+=((tp[q]-r.pp[q])/dt-r.tv[q])*k;}r.pp=tp.slice();
   if(r.tv){const L0=Math.hypot(tp[0]-r.x,tp[1]-r.y,tp[2]-r.z),tti=Math.min(2.5,L0/sp);tp=[tp[0]+r.tv[0]*tti,tp[1]+r.tv[1]*tti,tp[2]+r.tv[2]*tti];}}
  if(tp){/* steer towards the target, but no faster than the rocket's turn rate */const dx=tp[0]-r.x,dy=tp[1]-r.y,dz=tp[2]-r.z,L=Math.hypot(dx,dy,dz)||1,ux=dx/L,uy=dy/L,uz=dz/L;
   const ca=Math.max(-1,Math.min(1,r.vx*ux+r.vy*uy+r.vz*uz)),ang=Math.acos(ca),mx=r.turn*dt;if(ang>1e-4){const k=Math.min(1,mx/ang);let nx=r.vx+(ux-r.vx)*k,ny=r.vy+(uy-r.vy)*k,nz=r.vz+(uz-r.vz)*k;const nl=Math.hypot(nx,ny,nz)||1;r.vx=nx/nl;r.vy=ny/nl;r.vz=nz/nl;}
   {const cur=r.tg();if(cur&&Math.hypot(cur[0]-r.x,cur[1]-r.y,cur[2]-r.z)<(r.strong?30:26))hitNow=true;}}
  else if(!r.free){const dx=r.tx-r.x,dy=r.ty-r.y,dz=r.tz-r.z,L=Math.hypot(dx,dy,dz)||1;if(L<sp*dt*1.2)hitNow=true;else{r.vx=dx/L;r.vy=dy/L;r.vz=dz/L;}}
  if(r.tg&&!tp)r.free=1;/* target died: fly on straight */
  r.x+=r.vx*sp*dt;r.y+=r.vy*sp*dt;r.z+=r.vz*sp*dt;r.tr-=dt;if(r.tr<=0){r.tr=0.03;puff(r.x,r.y,r.z,'trail');}
  const gnd=r.y<=Math.max(0,hgt(r.x,r.z))+1||OBS.some(o=>o.h>0&&r.y<=o.h&&inRect(r.x,r.z,o,0));
  if(hitNow||gnd||r.t>9){PR.splice(i,1);rocketHit(r.x,r.z,Math.max(0,r.y));}}}
function rocketHit(x,z,y){explode(x,y||0,z,1.3);const R_=PLANE.rocketR;if(EF.dead<=0&&Math.hypot(EF.x-x,EF.y-(y||0),EF.z-z)<130)efThreat();heroSplash(x,y||0,z,R_+20,PLANE.rocketDmg);
 for(const u of G_.units){if(u.dead||u.s===0)continue;const d=Math.hypot(u.x-x,u.z-z);if(d<R_)dmgUnit(u,PLANE.rocketDmg*(d<R_*0.5?1:0.6),0);}
 for(const t of G_.towers){if(t.s===0||t.dead)continue;if(Math.hypot(t.x-x,t.z-z)<R_*0.6+14)dmgTower(t,PLANE.rocketDmg*2,0);}
 for(const h of G_.harv){if(h.s===0||h.dead)continue;if(Math.hypot(h.x-x,h.z-z)<R_)dmgHarv(h,PLANE.rocketDmg,0);}
 if(!G_.over&&Math.hypot(x-BASES[1][0],z-BASES[1][1])<330&&rn()<0.34)hitBase(1,1);
 {const m=nearMineOf(1,x,z,95);if(m&&!G_.over&&rn()<0.34)hitMine(m,1);}}
/* rockets: at the target on the sight, or where the sight meets the ground */
/* semi-guided rockets: they lock onto the enemy closest to the sight line (within ~11°) and steer towards it with a limited turn rate,
   so a small miss is corrected and a big one flies past; with nothing near the sight they go straight to where it points */
function rocketTarget(dv,cone){let best=null,ba=cone;const c=(x,y,z,fn)=>{const vx=x-F.x,vy=y-F.y,vz=z-F.z,L=Math.hypot(vx,vy,vz);if(L<60||L>4000)return;const a=Math.acos(Math.max(-1,Math.min(1,(vx*dv[0]+vy*dv[1]+vz*dv[2])/L)));if(a<ba){ba=a;best=fn;}};
 for(const u of G_.units){if(u.dead||u.s===0||SF(u))continue;const air=US[u.k].air;c(u.x,u.y+(air?0:8),u.z,()=>u.dead?null:[u.x,u.y+(US[u.k].air?0:8),u.z]);}
 if(ET.dead<=0)c(ET.x,14,ET.z,()=>ET.dead>0?null:[ET.x,14,ET.z]);if(ED.dead<=0&&!SF(ED))c(ED.x,ED.y,ED.z,()=>ED.dead>0?null:[ED.x,ED.y,ED.z]);if(EF.dead<=0&&!SF(EF)){const f=()=>EF.dead>0?null:[EF.x,EF.y,EF.z];f.ef=1;c(EF.x,EF.y,EF.z,f);}
 return best;}
function planeRockets(){if(F.dead>0||F.rcd>0)return;F.rcd=PLANE.rocketCd;let tx,ty,tz;
 const dv=[Math.cos(F.yaw)*Math.cos(F.pitch),Math.sin(F.pitch),Math.sin(F.yaw)*Math.cos(F.pitch)];const rh=rayHit(F.x,F.y,F.z,dv[0],dv[1],dv[2],4000,0);
 if(rh.hit){tx=rh.x;ty=Math.max(0,rh.y);tz=rh.z;}else{tx=F.x+dv[0]*4000;ty=Math.max(0,F.y+dv[1]*4000);tz=F.z+dv[2]*4000;}
 /* the outer ring of the sight is about 17% of the screen height from its centre: anything inside it at launch is chased hard and hit;
    a little outside it the rockets only nudge towards it and usually fly past */
 const ring=Math.atan(0.34*Math.tan((80/ZF())*Math.PI/360));let tg=rocketTarget(dv,ring),strong=!!tg;if(!tg)tg=rocketTarget(dv,ring*1.6);
 if(tg&&tg.ef)efThreat();
 const p0=tg&&tg(),Te=Math.max(0.4,Math.hypot(...(p0||[tx,ty,tz]).map((v,k)=>v-[F.x,F.y,F.z][k]))/1100),turn=strong?3.2:Math.max(0.12,Math.min(1.6,0.13/Te));
 for(let i=0;i<PLANE.rocketN;i++){const sd=i%2?1:-1;PR.push({id:++PRID,t:-i*0.11,sd,tg,turn,strong,tx:tx+(rn()-0.5)*30,ty:ty+(rn()-0.5)*8,tz:tz+(rn()-0.5)*30,x:F.x,y:F.y,z:F.z,vx:0,vy:0,vz:0,tr:0});}
 HUD.msg('Пуск ракет!');HUD.kick();}
function planeCam(){if(F.dead>0){const [bx,bz]=BASES[0];cam.position.set(bx-300,300,bz);cam.lookAt(bx+300,0,bz);return;}
 cam.position.set(F.x,F.y,F.z);cam.up.set(0,1,0);cam.lookAt(F.x+Math.cos(F.yaw)*Math.cos(F.pitch)*100,F.y+Math.sin(F.pitch)*100,F.z+Math.sin(F.yaw)*Math.cos(F.pitch)*100);cam.rotateZ(F.bank);
 const fov=80/ZF();if(Math.abs(cam.fov-fov)>0.01){cam.fov=fov;cam.updateProjectionMatrix();}}
let PLANE_O=null;
function syncPlane(t){if(!PLANE_O){PLANE_O=instantiate(proto('Uplane0',()=>buildUnit('plane',0)));PLANE_O.scale.setScalar(1.5);dyn.add(PLANE_O);}
 PLANE_O.visible=F.dead<=0&&CUR!=='plane';PLANE_O.position.set(F.x,F.y,F.z);PLANE_O.rotation.set(0,-F.yaw,0);PLANE_O.rotateX(-F.bank);
 for(const b of PB)sync('B'+b.id,()=>{const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.glow,color:0xFFD27A,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));sp.scale.set(9,9,1);return sp;},o=>o.position.set(b.x,b.y,b.z));
 for(const b of PB)sync('b'+b.id,()=>{const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);return new THREE.Line(g,new THREE.LineBasicMaterial({color:0xFFE9A0,transparent:true,blending:THREE.AdditiveBlending}));},o=>{const a=o.geometry.attributes.position,L=Math.hypot(b.tx-b.sx,b.ty-b.sy,b.tz-b.sz)||1,ln=28;a.setXYZ(0,b.x,b.y,b.z);a.setXYZ(1,b.x-(b.tx-b.sx)/L*ln,b.y-(b.ty-b.sy)/L*ln,b.z-(b.tz-b.sz)/L*ln);a.needsUpdate=true;o.geometry.computeBoundingSphere();});
 for(const r of PR)if(r.t>=0)sync('R'+r.id,()=>{const g=new THREE.Group();const b=new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.7,7,8),std(0xD8D8D0,0.5,0.4));b.rotation.z=Math.PI/2;g.add(b);const f=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.glow,color:0xFFB050,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));f.scale.set(9,9,1);f.position.x=-5;g.add(f);return g;},o=>{o.position.set(r.x,r.y,r.z);o.rotation.set(0,-Math.atan2(r.vz,r.vx),Math.atan2(r.vy,Math.hypot(r.vx,r.vz)));});}
/* plane HUD: speed and altitude, rocket ring, the sight goes red when something is on the gun */
const PA=document.createElement('div');PA.className='b palt';PA.style.cssText='right:max(14px,env(safe-area-inset-right));top:56px;padding:0 12px;height:38px;font-size:13px;display:none';H.appendChild(PA);
{const ALTS=[120,200,300,450,600,800];let ai=1;try{const v=+localStorage.getItem('dvebazy-plalt');if(ALTS.includes(v))ai=ALTS.indexOf(v);}catch(_){}F.alt=ALTS[ai];F.y=F.alt;
 const upd=()=>PA.textContent='Высота '+F.alt;upd();tapBtn(PA,()=>{ai=(ai+1)%ALTS.length;F.alt=ALTS[ai];upd();try{localStorage.setItem('dvebazy-plalt',''+F.alt);}catch(_){}});}
const PCK=document.createElement('img');PCK.src='pl_cockpit.webp';PCK.alt='';PCK.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:fill;pointer-events:none;display:none';{const tc=document.getElementById('tiCock');tc.parentNode.insertBefore(PCK,tc);}
/* cracked canopy: hits spread cracks from impact points (more and longer the longer we are under fire); out of the line of fire they fade away.
   The canopy bulges forward, so lines bow outwards and thin out towards its edges */
const CRK={peak:0,a:0,calm:0,hp:null,lvl:-1,imp:null,cv:null};
{const cv=document.createElement('canvas');cv.id='plCrack';cv.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:none;opacity:0';PCK.parentNode.insertBefore(cv,PCK);CRK.cv=cv;}
/* the photo of cracked glass (already bowed for the bulging canopy) is revealed from impact points: a soft disc around each grows with the fire taken */
const CRIMG=new Image();CRIMG.src='pl_crack.webp';
const CRPTS=[[0.491,0.628],[0.446,0.352],[0.712,0.354],[0.302,0.396],[0.338,0.721],[0.854,0.779],[0.451,0.14],[0.689,0.14],[0.122,0.365]];
let CRM=null;
function crackDraw(level){if(!CRIMG.complete||!CRIMG.naturalWidth){CRK.lvl=-1;return;}const cv=CRK.cv,W=Math.round(innerWidth*Math.min(1.5,devicePixelRatio||1)),H=Math.round(innerHeight*Math.min(1.5,devicePixelRatio||1));if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H;}
 const c=cv.getContext('2d');c.globalCompositeOperation='source-over';c.clearRect(0,0,W,H);
 CRPTS.forEach(([x,y],i)=>{const g=Math.max(0,Math.min(1,(level-i*0.085)/0.32));if(g<=0)return;const R=Math.max(W,H)*(0.05+0.33*g*g*(3-2*g)),X=x*W,Y=y*H;
  const gr=c.createRadialGradient(X,Y,0,X,Y,R);gr.addColorStop(0,'rgba(0,0,0,1)');gr.addColorStop(0.62,'rgba(0,0,0,0.9)');gr.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=gr;c.fillRect(X-R,Y-R,2*R,2*R);
  /* a frosted star where the round struck */
  const fr=c.createRadialGradient(X,Y,0,X,Y,R*0.18);fr.addColorStop(0,'rgba(0,0,0,1)');fr.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=fr;c.fillRect(X-R,Y-R,2*R,2*R);});
 c.globalCompositeOperation='source-in';c.drawImage(CRIMG,0,0,W,H);
 c.globalCompositeOperation='source-over';
 CRPTS.forEach(([x,y],i)=>{const g=Math.max(0,Math.min(1,(level-i*0.085)/0.32));if(g<=0)return;const X=x*W,Y=y*H,r=Math.max(W,H)*0.022*(0.6+g*0.6);const fr=c.createRadialGradient(X,Y,0,X,Y,r);fr.addColorStop(0,'rgba(240,248,255,0.55)');fr.addColorStop(1,'rgba(240,248,255,0)');c.fillStyle=fr;c.beginPath();c.arc(X,Y,r,0,7);c.fill();});}
/* glass cracking sound lasts as long as the hits keep coming: one hit gives a short crackle that fades out,
   steady fire keeps it going and starts it again when the recording runs out */
const GLS={src:null,g:null,hitT:0,fade:false,kill:0};
function glassOn(){GLS.hitT=performance.now();const C=AUD.ctx,b=AUD.buf.glass;if(!C||!AUD.on||!b)return;
 if(GLS.src){if(GLS.fade){GLS.fade=false;clearTimeout(GLS.kill);GLS.g.gain.cancelScheduledValues(C.currentTime);GLS.g.gain.setTargetAtTime(2.2,C.currentTime,0.04);}return;}
 const s=C.createBufferSource();s.buffer=b;const g=C.createGain();g.gain.value=2.2;s.connect(g).connect(AUD.out);s.start();GLS.src=s;GLS.g=g;GLS.fade=false;
 s.onended=()=>{if(GLS.src!==s)return;GLS.src=null;const again=!GLS.fade&&performance.now()-GLS.hitT<600&&CUR==='plane'&&F.dead<=0;GLS.fade=false;if(again)glassOn();};}
/* no hits for a moment: fade out; a hit during the fade brings the same crackle back instead of restarting it */
function glassTick(){if(!GLS.src||!AUD.ctx||GLS.fade)return;const quiet=performance.now()-GLS.hitT;
 if(quiet>550||CUR!=='plane'||F.dead>0||PAUSE.on){const C=AUD.ctx,s=GLS.src;GLS.fade=true;GLS.g.gain.cancelScheduledValues(C.currentTime);GLS.g.gain.setTargetAtTime(0,C.currentTime,0.09);
  GLS.kill=setTimeout(()=>{if(GLS.src===s&&GLS.fade){GLS.src=null;GLS.fade=false;try{s.stop();}catch(_){}}},900);}}
function crackStep(dt){glassTick();if(CRK.hp==null)CRK.hp=F.hp;const lost=CRK.hp-F.hp;CRK.hp=F.hp;
 if(F.dead>0||lost<0){CRK.peak=0;CRK.a=0;}
 else if(lost>0){const was=CRK.peak,wasA=CRK.a;CRK.peak=Math.min(1,CRK.peak+lost/650);CRK.a=1;CRK.calm=0;
  if(CUR==='plane')glassOn();}
 else{CRK.calm+=dt;if(CRK.calm>1.2)CRK.a=Math.max(0,CRK.a-dt*0.4);if(CRK.a<=0&&CRK.peak>0){CRK.peak=0;}}
 const show=CUR==='plane'&&CRK.a>0&&PCK.style.display!=='none';CRK.cv.style.display=show?'block':'none';if(!show)return;
 const lv=Math.round(CRK.peak*60);if(lv!==CRK.lvl){CRK.lvl=lv;crackDraw(CRK.peak);}CRK.cv.style.opacity=CRK.a.toFixed(3);}
let CRKT=0;addEventListener('resize',()=>CRK.lvl=-1);
function planeHud(){{const n=performance.now(),d=CRKT?Math.min(0.1,(n-CRKT)/1000):0;CRKT=n;crackStep(d);}if(CUR!=='plane'){PCK.style.display='none';q('.fps').style.top='';return;}q('.fps').style.top='102px';
 const g=document.getElementById('tiCock');if(g)g.style.display='none';PCK.style.display=F.dead<=0&&ZF()<1.5?'block':'none';
 q('.lk').setAttribute('display','none');const im=q('img.sight');if(im)im.classList.toggle('lock',!!LOCKF);
 q('.rld').setAttribute('stroke-dasharray',(170*(1-F.rcd/PLANE.rocketCd)).toFixed(1)+' 170');
 q('.sup span').textContent=F.rcd>0?Math.ceil(F.rcd)+' с':'';q('.sup').classList.toggle('cd',F.rcd>0);q('.hurt').style.boxShadow='inset 0 0 120px rgba(200,20,10,'+(F.hurt>0?0.5:0)+')';}
window.__isle.F=F;window.__isle.dmgUnit=dmgUnit;window.__isle.stepFx=stepFx;window.__isle.mkShell=mkShell;window.__isle.AUD=AUD;window.__isle.WU=WU;window.__isle.rayHit=rayHit;window.__isle.shk=(v)=>{if(v!=null)SHK=v;return SHK;};window.__isle.shakeAt=shakeAt;window.__isle.FXP=FXP;window.__isle.bigBlast=bigBlast;window.__isle.FXN=()=>({fx:FXP.length,wrk:WRK.length,fall:FALL.length,deb:DEBR.length,part:PART.length});window.__isle.buildXM=buildXM;window.__isle.XM=XM;window.__isle.hitBase=hitBase;window.__isle.syncAll=syncAll;window.__isle.PART=PART;window.__isle.stepParts=stepParts;window.__isle.hitMine=hitMine;window.__isle.stepTitan=stepTitan;window.__isle.P=P;window.__isle.get_LOCK=()=>LOCK;window.__isle.stepPlane=stepPlane;window.__isle.scene=scene;window.__isle.BH=BH;window.__isle.BLD=BLD;window.__isle.airW=airW;window.__isle.baseW=baseW;window.__isle.T3=THREE;window.__isle.planeRockets=planeRockets;window.__isle.PR=PR;window.__isle.get_LOCKF=()=>LOCKF;

/* ================== TEST: the bot sends free waves (mostly helicopters); they don't take lives from our base ================== */
const TESTW={on:false,t:6,n:0};
function testWaves(dt){if(!TESTW.on)return;TESTW.t-=dt;if(TESTW.t>0)return;TESTW.t=20;TESTW.n++;
 const S=G_.sides[1],w=['heli','heli','heli','heli','jeep','jeep','tank'];if(TESTW.n%2===0)w.push('heli','heli','tank');for(const k of w)S.queue.push(k);}
{const tb=document.createElement('div');tb.className='b testw';tb.style.cssText='left:max(8px,env(safe-area-inset-left));top:86px;padding:0 10px;height:32px;font-size:12px';
 const upd=TESTW.upd=()=>{tb.textContent='Беспл. юниты бота: '+(TESTW.on?'вкл':'выкл');tb.style.background=TESTW.on?'rgba(160,60,40,.7)':'';};upd();H.appendChild(tb);
 tapBtn(tb,()=>{TESTW.on=!TESTW.on;TESTW.t=3;upd();});}

/* ================== the bot's own Titan, drone and plane ==================
   the Titan drives to our Titan, a mine or the base and shells it; the drone hangs over our side and calls the bot's battery;
   the plane hunts our drone/plane/helicopters with its gun and makes rocket runs on our Titan and mines */
const ET={x:0,y:0,z:0,lk:0,yaw:Math.PI,hp:6000,max:6000,dead:0,cd:0,scd:10,path:null,pi:0,rp:0,tg:null,tgT:0,seed:3};
const ED={x:0,z:0,y:450,yaw:Math.PI,hp:1500,max:1500,dead:0,art:6,goal:null,gT:0};
const EF={x:0,z:0,y:230,yaw:Math.PI,hp:2500,max:2500,dead:0,cd:0,rcd:6,bank:0,tg:null,tT:0,ty:Math.PI,pitch:0};
const ETS=[],EFR=[],EAR=[];let EID=0;
function etSpawn(){ET.lk=0;ET.y=0;[ET.x,ET.z]=baseW(1,-0.02,0.19);ET.yaw=Math.PI;ET.hp=ET.max;ET.dead=0;ET.path=null;ET.tg=null;ET.tgT=0;ET.cd=1;ET.scd=12;ET.seed=1+rn()*900;}
function edSpawn(){ED.safeT=10;[ED.x,ED.z]=airW(1,0,-0.35);ED.y=ED.alt||450;ED.yaw=Math.PI;ED.hp=ED.max;ED.dead=0;ED.art=7;ED.goal=null;}
function efSpawn(){EF.safeT=10;Object.assign(EFM,{aware:0,chase:0,ignore:0,threat:-99});[EF.x,EF.z]=airW(1,-0.01,-0.21);EF.y=PGY;EF.take={v:20};EF.yaw=Math.PI;EF.ty=Math.PI;EF.hp=EF.max;EF.dead=0;EF.rcd=6;EF.tg=null;}
const RSP={P:5,D:5,F:5,ET:5,ED:5,EF:5};
function heroesReset(){slotsReset();TRK.length=0;Object.assign(RSP,{P:5,D:5,F:5,ET:5,ED:5,EF:5});TESTW.on=false;TESTW.t=6;if(TESTW.upd)TESTW.upd();etSpawn();edSpawn();efSpawn();ETS.length=0;EFR.length=0;EAR.length=0;}
{const ng=newGame;newGame=function(){ng();heroesReset();};}
{const sg=stepGame;stepGame=function(dt){sg(dt);if(G_&&!G_.over&&!WU.on)stepHeroes(dt);};}
/* our hits on them: a blast at (x,y,z) of radius r */
function heroSplash(x,y,z,r,dmg,groundOnly){if(ET.dead<=0&&Math.hypot(ET.x-x,ET.z-z)<r&&y<60)ET.hp-=dmg;if(groundOnly)return;if(ED.dead<=0&&!SF(ED)&&Math.hypot(ED.x-x,ED.y-y,ED.z-z)<r*0.8)ED.hp-=dmg;if(EF.dead<=0&&!SF(EF)&&Math.hypot(EF.x-x,EF.y-y,EF.z-z)<r*0.8)EF.hp-=dmg;}
const TW=()=>false;
function hitOurs(x,y,z,r,dmg,lifeP,noHero){/* a bot blast: our Titan, units, towers, mines and base */
 if(!noHero&&VUL(P)&&Math.hypot(P.x-x,P.z-z)<r+20&&y<60){P.hp-=dmg*0.6;P.hurt=0.3;}

 for(const u of G_.units){if(u.dead||u.s!==0)continue;if(Math.hypot(u.x-x,u.z-z)<r)dmgUnit(u,dmg,1);}
 for(const t of G_.towers){if(t.s!==0||t.dead)continue;if(Math.hypot(t.x-x,t.z-z)<r*0.6+14)dmgTower(t,dmg,1);}
 if(G_.over||TW())return;const m=nearMineOf(0,x,z,90);if(m&&rn()<lifeP)hitMine(m,1);if(Math.hypot(x-BASES[0][0],z-BASES[0][1])<330&&rn()<lifeP)hitBase(0,1);}
function heroDie(o,big,bounty){explode(o.x,o.y!=null?o.y:12,o.z,big);queueBlast(o.x,o.y!=null&&o.y>40?o.y:0,o.z,big>2?70:40);G_.sides[0].ore+=bounty;}

/* --- the enemy Titan --- */
function etPick(){let best=null,bd=1e9;const c=(k,x,z,y,w,o)=>{const d=Math.hypot(x-ET.x,z-ET.z)*w;if(d<bd){bd=d;best={k,x,z,y,o};}};
 if(VUL(P))c('p',P.x,P.z,hgt(P.x,P.z)+14,0.55);for(const u of G_.units)if(!u.dead&&u.s===0&&!US[u.k].air)c('u',u.x,u.z,u.y+14,0.8,u);
 for(const m of G_.mines)if(m.s===0&&!m.dead)c('m',m.x,m.z,10,1,m);if(G_.sides[0].lives>0)c('b',BRP[0][0],BRP[0][1],20,1.15);return best;}
function etShoot(tx,ty,tz,sup){const sx=ET.x+Math.cos(ET.yaw)*30,sy=30,sz=ET.z+Math.sin(ET.yaw)*30,L=Math.hypot(tx-sx,ty-sy,tz-sz);ETS.push({id:++EID,sx,sy,sz,tx,ty,tz,x:sx,y:sy,z:sz,t:0,T:Math.max(0.05,L/TITAN.v),sup});
 if(!sup){puff(sx,sy,sz,'muzzle');AUD.play('cannon',sx,sz);}}
function stepET(dt){if(ET.dead>0){ET.dead-=dt;if(ET.dead<=0){if(RSP.ET>0){RSP.ET--;etSpawn();}else ET.dead=1e9;}return;}
 ET.cd=Math.max(0,ET.cd-dt);ET.scd=Math.max(0,ET.scd-dt);ET.tgT-=dt;ET.rp-=dt;
 if(ET.tgT<=0){ET.tgT=1.5;const n=etPick();const ch=!ET.tg||!n||n.k!==ET.tg.k||n.o!==ET.tg.o;ET.tg=n;if(n&&(ch||ET.rp<=0)){ET.rp=5;ET.path=chaikin(astar(ET.x,ET.z,n.x,n.z,ET.seed),2);ET.pi=1;}}
 const g=ET.tg;if(g){if(g.k==='p'){g.x=P.x;g.z=P.z;}else if(g.k==='u'&&g.o){if(g.o.dead){ET.tgT=0;}else{g.x=g.o.x;g.z=g.o.z;}}else if(g.k==='m'&&g.o.dead)ET.tgT=0;}
 const d=g?Math.hypot(g.x-ET.x,g.z-ET.z):1e9;
 if(g&&d<620){const a=Math.atan2(g.z-ET.z,g.x-ET.x);let da=Math.atan2(Math.sin(a-ET.yaw),Math.cos(a-ET.yaw));ET.yaw+=Math.max(-1.2*dt,Math.min(1.2*dt,da));
  if(Math.abs(da)<0.15&&ET.cd<=0){ET.cd=TITAN.cd*1.25;etShoot(g.x+(rn()-0.5)*16,g.y,g.z+(rn()-0.5)*16,false);}
  if(Math.abs(da)<0.2&&ET.scd<=0){ET.scd=TITAN.superCd;for(let i=0;i<5;i++){const aa=i/5*6.28,r=i?40+rn()*30:0;setTimeout(()=>{if(ET.dead<=0)etShoot(g.x+Math.cos(aa)*r,Math.max(0,g.y-10),g.z+Math.sin(aa)*r,true);},i*90);}}}
 else if(ET.path){const p=ET.path,t=p[Math.min(ET.pi,p.length-1)],dx=t[0]-ET.x,dz=t[1]-ET.z,dd=Math.hypot(dx,dz);if(dd<30&&ET.pi<p.length-1)ET.pi++;
  const a=Math.atan2(dz,dx);let da=Math.atan2(Math.sin(a-ET.yaw),Math.cos(a-ET.yaw));ET.yaw+=Math.max(-1.6*dt,Math.min(1.6*dt,da));
  if(dd>8){const v=TITAN.sp*0.9*dt*(Math.abs(da)>1?0.3:1),nx=ET.x+Math.cos(ET.yaw)*v,nz=ET.z+Math.sin(ET.yaw)*v;if(!blockedAt(nx,nz,14)){ET.x=nx;ET.z=nz;}else ET.rp=0;}}
 if(ET.hp<=0){ET.hp=0;ET.dead=TITAN.respawn+2;heroDie({x:ET.x,z:ET.z},2.6,TITAN.bounty);}}
function stepETS(dt){for(let i=ETS.length-1;i>=0;i--){const s=ETS[i];s.t+=dt;const k=Math.min(1,s.t/s.T);s.x=s.sx+(s.tx-s.sx)*k;s.z=s.sz+(s.tz-s.sz)*k;s.y=s.sy+(s.ty-s.sy)*k+Math.sin(Math.PI*k)*Math.min(30,s.T*30);
  if(k>=1){ETS.splice(i,1);explode(s.tx,s.ty,s.tz,s.sup?1.4:1.1);hitOurs(s.tx,s.ty,s.tz,TITAN.r,TITAN.dmg,s.sup?0.35:1);}}}

/* --- the enemy drone and the bot's battery --- */
function edGoal(){let best=null,bd=1e9;const c=(x,z,w)=>{const d=Math.hypot(x-ED.x,z-ED.z)*w;if(d<bd){bd=d;best=[x,z];}};
 if(VUL(P))c(P.x,P.z,0.6);for(const m of G_.mines)if(m.s===0&&!m.dead)c(m.x,m.z,1);for(const u of G_.units)if(!u.dead&&u.s===0&&!US[u.k].air)c(u.x,u.z,0.9);if(G_.sides[0].lives>0)c(BRP[0][0],BRP[0][1],1.2);return best;}
function botFireArt(x,z){BATT[1].forEach((g,i)=>{const gx=g.position.x,gz=g.position.z,a=Math.atan2(z-gz,x-gx);if(g.userData.tu)g.userData.tu.rotation.y=-a;
  const tx=x+(i-1)*24+(rn()-0.5)*20,tz=z+(rn()-0.5)*26,d=Math.hypot(tx-gx,tz-gz),T=artTime(d)+i*0.18;
  ART.sh.push({id:++ART.id,sx:gx,sy:18,sz:gz,tx,tz,x:gx,y:18,z:gz,t:-i*0.18,T,h:Math.min(900,180+d*0.22),tr:0,side:1});
  setTimeout(()=>{puff(gx+Math.cos(a)*16,22,gz+Math.sin(a)*16,'muzzle');AUD.play('cannon',gx,gz);},i*180);});
 EAR.push({id:++EID,x,z,t:artTime(Math.hypot(x-BASES[1][0],z-BASES[1][1]))+0.6});}
function botArtImpact(x,z){explode(x,0,z,1.9);hitOurs(x,10,z,ART.R+10,ART.DMG*0.7,1);}
function stepED(dt){if(ED.dead>0){ED.dead-=dt;if(ED.dead<=0){if(RSP.ED>0){RSP.ED--;edSpawn();}else ED.dead=1e9;}return;}if(ED.safeT>0)ED.safeT-=dt;
 ED.gT-=dt;if(ED.gT<=0){ED.gT=2;ED.goal=edGoal();}
 if(ED.goal){const [gx,gz]=ED.goal;const hx=gx+260,hz=gz;/* hang a little behind the target, on its own side */const dx=hx-ED.x,dz=hz-ED.z,d=Math.hypot(dx,dz);
  if(d>40){const v=Math.min(d,150*dt);ED.x+=dx/d*v;ED.z+=dz/d*v;ED.yaw=Math.atan2(dz,dx);}
  ED.art-=dt;if(ED.art<=0&&!SF(ED)&&Math.hypot(gx-ED.x,gz-ED.z)<900){ED.art=9;let tx=gx,tz=gz;if(VUL(P)&&Math.hypot(P.x-gx,P.z-gz)<40){tx=P.x;tz=P.z;}botFireArt(tx,tz);}}
 ED.y=450+Math.sin(performance.now()/650)*2;
 if(ED.hp<=0){ED.hp=0;ED.dead=7;heroDie({x:ED.x,y:ED.y,z:ED.z},1.4,200);}}

/* --- the enemy plane --- */
/* how the bot pilot knows about our plane: it sees it ahead (±70°, 1800 m) or right next to it (300 m) and remembers it ~6 s;
   being shot at by our plane makes it a threat — hunted at once, wherever it is.
   A chase without our plane firing at it is dropped after 15 s, and our plane is then ignored for 10 s (unless it shoots at it again) */
const EFM={aware:0,chase:0,ignore:0,threat:-99};
function efThreat(){EFM.threat=G_?G_.t:0;EFM.aware=12;EFM.chase=0;EFM.ignore=0;if(EF.tg&&EF.tg.k!=='f')EF.tT=0;}
function efSense(dt){EFM.ignore=Math.max(0,EFM.ignore-dt);EFM.aware=Math.max(0,EFM.aware-dt);if(F.dead>0){EFM.aware=0;EFM.chase=0;return;}
 const dx=F.x-EF.x,dz=F.z-EF.z,d=Math.hypot(dx,dz,F.y-EF.y);const a=Math.abs(Math.atan2(Math.sin(Math.atan2(dz,dx)-EF.yaw),Math.cos(Math.atan2(dz,dx)-EF.yaw)));
 if(EFM.ignore<=0&&(d<300||(d<2200&&a<1.22)))EFM.aware=Math.max(EFM.aware,6);
 if(EF.tg&&EF.tg.k==='f'){EFM.chase+=dt;if(EFM.chase>15){EFM.ignore=10;EFM.aware=0;EFM.chase=0;EF.tT=0;}}}
function efPick(){const c=[];if(VUL(F)&&EFM.ignore<=0&&EFM.aware>0)c.push({k:'f',air:1,w:G_.t-EFM.threat<15?0.02:0.7,x:F.x,y:F.y,z:F.z});if(VUL(D)&&!D.fall)c.push({k:'d',air:1,w:0.8,x:D.x,y:D.y,z:D.z});
 for(const u of G_.units)if(!u.dead&&u.s===0&&US[u.k].air)c.push({k:'u',o:u,air:1,w:1,x:u.x,y:u.y,z:u.z});
 for(const u of G_.units)if(!u.dead&&u.s===0&&!US[u.k].air)c.push({k:'u',o:u,air:0,w:0.9,x:u.x,y:u.y+8,z:u.z});for(const m of G_.mines)if(m.s===0&&!m.dead)c.push({k:'m',o:m,air:0,w:1.4,x:m.x,y:8,z:m.z});
 let best=null,bd=1e9;for(const q of c){const d=Math.hypot(q.x-EF.x,q.z-EF.z)*q.w;if(d<bd){bd=d;best=q;}}return best;}
function stepEF(dt){if(EF.dead>0){EF.dead-=dt;if(EF.dead<=0){if(RSP.EF>0){RSP.EF--;efSpawn();}else EF.dead=1e9;}return;}if(EF.safeT>0)EF.safeT-=dt;
 if(EF.take&&takeoff(EF,dt)&&EF.hp>0)return;
 EF.cd=Math.max(0,EF.cd-dt);EF.rcd=Math.max(0,EF.rcd-dt);efSense(dt);EF.tT-=dt;if(EF.tT<=0){EF.tT=1;const was=EF.tg&&EF.tg.k;EF.tg=efPick();if(EF.tg&&EF.tg.k==='f'&&was!=='f')EFM.chase=0;}
 const g=EF.tg;if(g){if(g.k==='f'){g.x=F.x;g.y=F.y;g.z=F.z;if(!VUL(F)||EFM.ignore>0||EFM.aware<=0)EF.tT=0;}else if(g.k==='d'){g.x=D.x;g.y=D.y;g.z=D.z;if(!VUL(D)||D.fall)EF.tT=0;}else if(g.k==='u'){if(g.o.dead)EF.tT=0;else{g.x=g.o.x;g.y=g.o.y+(g.air?0:8);g.z=g.o.z;}}else if(g.k==='p'){g.x=P.x;g.z=P.z;if(P.dead>0)EF.tT=0;}else if(g.k==='m'&&g.o.dead)EF.tT=0;}
 const L=PLANE.limit,out=EF.x<-L||EF.z<-L||EF.x>IW+L||EF.z>IH+L;
 if(out)EF.ty=Math.atan2(IH/2-EF.z,IW/2-EF.x);else if(g){const dd=Math.hypot(g.x-EF.x,g.z-EF.z);
  /* too close to line up: fly on past it and come round again */
  EF.ty=dd<260&&!g.air?EF.yaw:Math.atan2(g.z-EF.z,g.x-EF.x);}else EF.ty=EF.yaw+0.35;
 let d=Math.atan2(Math.sin(EF.ty-EF.yaw),Math.cos(EF.ty-EF.yaw));const rate=Math.max(-PLANE.maxRate*0.9,Math.min(PLANE.maxRate*0.9,d*1.6));EF.yaw+=rate*dt;EF.bank+=(-rate*0.75-EF.bank)*Math.min(1,dt*3);
 EF.x+=Math.cos(EF.yaw)*225*dt;EF.z+=Math.sin(EF.yaw)*225*dt;const alt=g&&g.air?Math.max(120,Math.min(480,g.y+20)):230;{const dy=(alt-EF.y)*Math.min(1,dt*0.8);EF.y+=EF.climb?Math.min(dy,35*dt):dy;if(EF.climb&&Math.abs(alt-EF.y)<3)EF.climb=0;}
 if(g){const dx=g.x-EF.x,dy=g.y-EF.y,dz=g.z-EF.z,Ln=Math.hypot(dx,dy,dz),a=Math.abs(Math.atan2(Math.sin(Math.atan2(dz,dx)-EF.yaw),Math.cos(Math.atan2(dz,dx)-EF.yaw)));EF.pitch=Math.atan2(dy,Math.hypot(dx,dz));
  if(g.air&&Ln<900&&a<0.12&&EF.cd<=0&&!SF(EF)){EF.cd=0.11;const hit=rn()<0.75;if(hit){if(g.k==='f'){if(!F.inv){F.hp-=14;F.hurt=0.25;}}else if(g.k==='d'){if(VUL(D)){D.hp-=14;D.hurt=0.25;}}else if(g.k==='u')dmgUnit(g.o,14,1);}
   const ax=EF.x+Math.cos(EF.yaw)*10,ay=EF.y-3,az=EF.z+Math.sin(EF.yaw)*10,bx=g.x+(rn()-0.5)*(hit?4:30),by=g.y+(rn()-0.5)*(hit?4:20),bz=g.z+(rn()-0.5)*(hit?4:30);PB.push({id:++PRID,x:ax,y:ay,z:az,sx:ax,sy:ay,sz:az,tx:bx,ty:by,tz:bz,t:0,T:Math.max(0.05,Math.hypot(bx-ax,by-ay,bz-az)/2400)});AUD.play('mg',ax,az);}
  if(!g.air&&Ln<1000&&Ln>300&&a<0.12&&EF.rcd<=0&&!SF(EF)){EF.rcd=9;for(let i=0;i<4;i++)EFR.push({id:++EID,t:-i*0.12,x:EF.x,y:EF.y-4,z:EF.z,tx:g.x+(rn()-0.5)*40,ty:g.y,tz:g.z+(rn()-0.5)*40,tr:0});}}
 if(EF.hp<=0){EF.hp=0;EF.dead=7;heroDie({x:EF.x,y:EF.y,z:EF.z},2,400);}}
function stepEFR(dt){for(let i=EFR.length-1;i>=0;i--){const r=EFR[i];r.t+=dt;if(r.t<0){r.x=EF.x;r.y=EF.y-4;r.z=EF.z;continue;}if(!r.go){r.go=1;AUD.play('shot',r.x,r.z);}
  const dx=r.tx-r.x,dy=r.ty-r.y,dz=r.tz-r.z,Ln=Math.hypot(dx,dy,dz)||1,sp=Math.min(1200,500+r.t*1500);r.vx=dx/Ln*sp;r.vy=dy/Ln*sp;r.vz=dz/Ln*sp;r.x+=r.vx*dt;r.y+=r.vy*dt;r.z+=r.vz*dt;
  r.tr-=dt;if(r.tr<=0){r.tr=0.03;puff(r.x,r.y,r.z,'trail');}if(Ln<sp*dt*1.2||r.t>6||r.y<0){EFR.splice(i,1);explode(r.tx,r.ty,r.tz,1.3);hitOurs(r.tx,r.ty,r.tz,PLANE.rocketR,260,0.34,true);}}}
const TRK=[];
function stepTRK(dt){for(let i=TRK.length-1;i>=0;i--){const r=TRK[i];r.t+=dt;if(r.t<0)continue;if(!r.go){r.go=1;AUD.play('shot',r.x,r.z);}
  const alive=!(r.tg.o&&r.tg.o.dead)&&!(r.tg.k==='et'&&ET.dead>0)&&!(r.tg.k==='ed'&&ED.dead>0)&&!(r.tg.k==='ef'&&EF.dead>0)&&!(r.tg.k==='p'&&P.dead>0)&&!(r.tg.k==='f'&&F.dead>0)&&!(r.tg.k==='d'&&D.dead>0);
  if(alive){const p=tpos(r.tg);r.lx=p[0];r.ly=p[1];r.lz=p[2];}
  const dx=r.lx-r.x,dy=r.ly-r.y,dz=r.lz-r.z,L=Math.hypot(dx,dy,dz)||1,sp=Math.min(900,250+r.t*1400);r.vx=dx/L*sp;r.vy=dy/L*sp+Math.max(0,0.6-r.t)*120;r.vz=dz/L*sp;r.x+=r.vx*dt;r.y+=r.vy*dt;r.z+=r.vz*dt;
  r.tr-=dt;if(r.tr<=0){r.tr=0.022;puff(r.x,r.y,r.z,'trail');}
  if(L<sp*dt*1.3||r.t>6){TRK.splice(i,1);explode(r.lx,r.ly,r.lz,0.9);if(alive)applyHit(r.tg,r.dmg*(r.tg.k==='p'?0.5:1),r.s);}}}
function stepHeroes(dt){stepTRK(dt);if(G_.slots)stepSlots(dt);stepET(dt);stepETS(dt);stepED(dt);stepEF(dt);stepEFR(dt);for(let i=EAR.length-1;i>=0;i--){EAR[i].t-=dt;if(EAR[i].t<=0)EAR.splice(i,1);}}

/* --- how they look --- */
function buildETo(){const xm=xmOK('tank',1);const g=instantiate(proto('ET'+(MIL?'m':'')+(xm?'x':''),()=>xm?buildXM('tank',1):buildUnit('tank',1)));g.scale.multiplyScalar(5.2);
 const bc=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.glow,color:0xFF3020,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));bc.scale.set(3,3,1);bc.position.set(0,9,0);bc.userData.beacon=1;g.add(bc);return g;}
function buildEDo(){const g=new THREE.Group(),M=mats(1);g.add(BOX(10,3,10,M.dark,0,0,0),BOX(4,3,4,M.gun,0,-2.5,3));for(const [x,z] of [[9,9],[-9,9],[9,-9],[-9,-9]]){g.add(BOX(12,1,1.6,M.gun,x/2,0.5,z/2));const r=BOX(9,0.3,1.2,M.gun,x,1.6,z);r.userData.spin=1;g.add(r);}
 const l=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.glow,color:0xFF3020,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));l.scale.set(6,6,1);l.position.y=-3;g.add(l);g.scale.setScalar(1.6);return g;}
/* our own Titan seen from the drone or the plane: the blue tank, larger, with a blue beacon */
function buildPTo(){const xm=xmOK('tank',0);const g=instantiate(proto('PT'+(MIL?'m':'')+(xm?'x':''),()=>xm?buildXM('tank',0):buildUnit('tank',0)));g.scale.multiplyScalar(5.2);
 const bc=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.glow,color:0x40A0FF,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));bc.scale.set(3,3,1);bc.position.set(0,9,0);bc.userData.beacon=1;g.add(bc);return g;}
function syncHeroes(t,dt){if(!G_)return;
 for(const r of TRK)if(r.t>=0)sync('tk'+r.id,()=>{const g=new THREE.Group();const b=new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.6,14,8),std(r.s?0xC04030:0x3070D0,0.5,0.4));b.rotation.z=Math.PI/2;g.add(b);const f=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.glow,color:0xFF9050,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));f.scale.set(16,16,1);f.position.x=-9;g.add(f);return g;},o=>{o.position.set(r.x,r.y,r.z);o.rotation.set(0,-Math.atan2(r.vz||0,r.vx||1),Math.atan2(r.vy||0,Math.hypot(r.vx||1,r.vz||0)));});
 if(P.dead<=0&&CUR!=='titan')sync('hPT'+(xmOK('tank',0)?'x':''),buildPTo,o=>{o.position.set(P.x,hgt(P.x,P.z),P.z);o.rotation.y=-P.yaw;o.children.forEach(c=>{if(c.userData.beacon)c.material.opacity=0.5+0.5*Math.sin(t*6);});});
 if(ET.dead<=0)sync('hET'+(xmOK('tank',1)?'x':''),buildETo,o=>{o.position.set(ET.x,0,ET.z);let d=-ET.yaw-(o.userData.a??-ET.yaw);d=Math.atan2(Math.sin(d),Math.cos(d));o.userData.a=(o.userData.a??-ET.yaw)+d*Math.min(1,dt*5);o.rotation.y=o.userData.a;o.children.forEach(c=>{if(c.userData.beacon)c.material.opacity=0.5+0.5*Math.sin(t*6);});});
 if(ED.dead<=0)sync('hED',buildEDo,o=>{o.position.set(ED.x,ED.y,ED.z);o.rotation.y=-ED.yaw;o.children.forEach(c=>{if(c.userData.spin)c.rotation.y=t*40;});});
 if(EF.dead<=0)sync('hEF',()=>{const g=instantiate(proto('Uplane1',()=>buildUnit('plane',1)));g.scale.setScalar(1.5);return g;},o=>{o.position.set(EF.x,EF.y,EF.z);o.rotation.set(0,-EF.yaw,0);o.rotateX(-EF.bank);});
 for(const s of ETS)sync('hs'+s.id,()=>{const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.glow,color:0xFF8060,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));sp.scale.set(8,8,1);return sp;},o=>o.position.set(s.x,s.y,s.z));
 for(const r of EFR)if(r.t>=0)sync('hr'+r.id,()=>{const g=new THREE.Group();const b=new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.7,7,8),std(0xB0B0A8,0.5,0.4));b.rotation.z=Math.PI/2;g.add(b);const f=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.glow,color:0xFF7050,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));f.scale.set(9,9,1);f.position.x=-5;g.add(f);return g;},o=>{o.position.set(r.x,r.y,r.z);o.rotation.set(0,-Math.atan2(r.vz||0,r.vx||1),Math.atan2(r.vy||0,Math.hypot(r.vx||1,r.vz||0)));});
 /* where the bot's shells will land: a pulsing red ring on the ground */
 for(const a of EAR)sync('hA'+a.id,()=>{const m=new THREE.Mesh(new THREE.RingGeometry(ART.R*0.85,ART.R,40),new THREE.MeshBasicMaterial({color:0xFF3020,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;return m;},o=>{o.position.set(a.x,2,a.z);o.material.opacity=0.35+0.35*Math.sin(t*10);});}
window.__isle.CRK=CRK;window.__isle.EFM=EFM;window.__isle.applyHit=applyHit;window.__isle.towerLOS=towerLOS;window.__isle.ET=ET;window.__isle.ED=ED;window.__isle.EF=EF;window.__isle.stepHeroes=stepHeroes;window.__isle.stepPlane=stepPlane;window.__isle.scene=scene;window.__isle.BH=BH;window.__isle.airW=airW;window.__isle.baseW=baseW;window.__isle.T3=THREE;window.__isle.cur=()=>CUR;

function onMil(){if(BUILT){MIL_DIRTY=false;buildWorld();}else MIL_DIRTY=true;}
cam.far=9000;cam.updateProjectionMatrix();{const c=sun.shadow.camera;c.left=-330;c.right=330;c.top=330;c.bottom=-330;c.far=1600;c.updateProjectionMatrix();}
try{const q=+localStorage.getItem('dvebazy-isleq');if(q>=0.5&&q<=2){T3.q=q;R.setPixelRatio(q);}}catch(_){}

})();
