/* «Две базы» — 3D prototype: the same battle drawn in 3D, the player rides the Titan in its cockpit.
   Loaded after the game script on 3d.html; reads the game's globals (W, me, road, SLOTS, …) and draws
   on its own WebGL canvas over the 2D one. «Карта» shows the usual 2D screen.
   Everything is made by code: textures are painted on canvases, models are built from primitives and
   baked into a few meshes each, so a whole battle stays at a few hundred draw calls. */
(function(){'use strict';
if(typeof THREE==='undefined'){console.error('three.js missing');return;}
const FW=1600;                         // both fields side by side: own field x 0..800, the enemy's mirrored to 800..1600
const ALT={heli:36,plane:78};
const THEME={
 grass:{g1:'#5F8A3C',g2:'#7A9A4C',g3:'#4E7432',dirt:'#A8875A',dirt2:'#8A6B44',sky:0x6FB2E8,hz:0xCFE6F2,fog:0xBFDCEB,tree:[0x3F7A2C,0x4E8E34,0x5A9A38,0x6A9E3A],bark:0x5A4030,rock:0x8E8E86},
 sand:{g1:'#C9A86A',g2:'#D9BC80',g3:'#B8945A',dirt:'#A88050',dirt2:'#8E6A40',sky:0x7DB6E4,hz:0xEED9B0,fog:0xE6D3AE,tree:[0x7E8F3E,0x8E9A48,0x6E7E36,0x9AA050],bark:0x6A5038,rock:0xB0946A},
 snow:{g1:'#DDE6EC',g2:'#EEF3F6',g3:'#C9D6DF',dirt:'#9A9088',dirt2:'#7E756E',sky:0x8EB4D6,hz:0xDCE6EE,fog:0xD4DFE8,tree:[0x2E5A40,0x3A6A4A,0x2A5038,0x46745A],bark:0x4A3A30,rock:0x8A9096},
 lava:{g1:'#3E3430',g2:'#4A3E38',g3:'#2E2622',dirt:'#5A4436',dirt2:'#3E2E24',sky:0x5A4038,hz:0xC0704A,fog:0x8A5A44,tree:[0x3A3A2A,0x4A4030,0x2E2E22,0x524634],bark:0x2A2018,rock:0x4A4040}};
const T3={on:false,map:false,sig:null,q:1,fpsT:0,fpsN:0,fps:60,lo:false};
const P={x:0,z:0,yaw:0,pitch:-0.06,move:false,hp:5000,max:5000,cd:0,dead:0,fov:66,zoom:1,hold:false,rec:0,bob:0};
const TITAN_SP=46,SHOT_CD=1.0,SHOT_DMG=360,SHOT_R=42,SHOT_V=900,RESPAWN=5,TITAN_BOUNTY=600;

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

/* ---------- terrain: flat where the battle runs, rolling meadows and hills around ---------- */
const HG={x0:-60,z0:-60,st:8,nx:0,nz:0,a:null};
function baseH(x,z){const ox=x<-30?-30-x:x>FW+30?x-FW-30:0,oz=z<-20?-20-z:z>420?z-420:0,o=Math.hypot(ox,oz),n=fbm(x*0.006,z*0.006);
 if(o<=0)return(x>764&&x<836)?-6+Math.max(0,Math.abs(x-800)-28)*0.5:0;return Math.min(260,Math.pow(o,1.12)*0.32)*(0.6+0.8*n)+(n-0.5)*14;}
function hgt(x,z){if(!HG.a||x<HG.x0||z<HG.z0||x>=HG.x0+(HG.nx-1)*HG.st||z>=HG.z0+(HG.nz-1)*HG.st)return baseH(x,z);
 const fx=(x-HG.x0)/HG.st,fz=(z-HG.z0)/HG.st,ix=Math.floor(fx),iz=Math.floor(fz),u=fx-ix,v=fz-iz,A=HG.a,n=HG.nx;
 const a=A[iz*n+ix],b=A[iz*n+ix+1],c=A[(iz+1)*n+ix],d=A[(iz+1)*n+ix+1];return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
function keepOut(x,z){/* distance to anything the battle needs flat: roads, the harvester track, pads, buildings */let m=1e9;
 for(const si of [0,1]){const lx=si===0?x:FW-x;if(lx<-60||lx>840)continue;for(const pl of roads())m=Math.min(m,polyDist(lx,z,pl)-18);if(TRACK_PL)m=Math.min(m,polyDist(lx,z,TRACK_PL)-8);
  for(const sl of SLOTS)m=Math.min(m,Math.max(Math.abs(sl.x-lx),Math.abs(sl.y-z))-18);const [hx,hy]=hqPos();m=Math.min(m,Math.hypot(hx-lx,hy-z)-48);
  const rr=baseRects()[1];if(rr)m=Math.min(m,Math.max(rr.x-lx,lx-rr.x-rr.w,rr.y-z,z-rr.y-rr.h));for(const f of FIELDS)if(!f.gone)m=Math.min(m,Math.hypot(f.x-lx,f.y-z)-44);}
 if(x>740&&x<860)m=Math.min(m,Math.abs(x-800)-40);return m;}
const roads=()=>(ROADS&&ROADS.length?ROADS:[road]);
function buildHeights(){HG.a=null;HG.nx=Math.ceil((FW+120)/HG.st)+1;HG.nz=Math.ceil(520/HG.st)+1;const A=new Float32Array(HG.nx*HG.nz);
 for(let j=0;j<HG.nz;j++)for(let i=0;i<HG.nx;i++){const x=HG.x0+i*HG.st,z=HG.z0+j*HG.st,b=baseH(x,z);let h=b;
  if(x>-25&&x<FW+25&&z>-15&&z<415){const k=keepOut(x,z),m=Math.max(0,Math.min(1,(k-6)/40));h+=m*m*(fbm(x*0.02,z*0.02)-0.35)*16;}A[j*HG.nx+i]=h;}
 HG.a=A;}

/* ---------- static world ---------- */
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
function mkHQ(si){const g=new THREE.Group(),t=TEAM3(si),paint=std(t.m,0.55,0.25),dark=std(t.d,0.6,0.3);
 g.add(CYL(52,56,8,M3.conc,8,0,4,0));g.children[0].rotation.y=Math.PI/8;
 g.add(BOX(64,26,64,dark,0,21,0));g.add(BOX(66,3,66,M3.steel,0,35,0));
 for(const s of [-1,1])for(const a of [0,1]){const p=BOX(a?2:58,14,a?58:2,paint,a?s*33:0,20,a?0:s*33);g.add(p);}
 const dome=MESH(new THREE.SphereGeometry(24,24,12,0,Math.PI*2,0,Math.PI/2),std(0xC8D2DC,0.3,0.8),0,36,0);g.add(dome);
 g.add(CYL(26,26,3,paint,24,0,37,0));
 g.add(CYL(1.2,1.6,34,M3.steel,6,22,54,22));g.add(SPH(2,M3.lamp,22,72,22,8,6));
 for(const [x,z] of [[-40,-40],[40,-40],[-40,40],[40,40]]){g.add(CYL(8,9,24,M3.conc,10,x,12,z));g.add(CYL(9.5,9.5,3,paint,10,x,25,z));g.add(BOX(6,4,2,M3.dark,x,20,z+(z>0?8.5:-8.5)));}
 const door=BOX(2,18,26,M3.dark,33,17,0);g.add(door);
 return addShadow(g,true,true);}
function mkRefinery(si,r){const g=new THREE.Group(),t=TEAM3(si),paint=std(t.m,0.5,0.3),dark=std(t.d,0.6,0.3);
 g.add(BOX(r.w,6,r.h,M3.conc,0,3,0));
 g.add(BOX(r.w*0.56,20,r.h*0.8,dark,-r.w*0.18,16,0));g.add(BOX(r.w*0.58,2.5,r.h*0.84,M3.steel,-r.w*0.18,27,0));
 for(const z of [-r.h*0.25,r.h*0.25]){g.add(CYL(9,9,30,paint,16,r.w*0.2,21,z));g.add(MESH(new THREE.SphereGeometry(9,16,8,0,Math.PI*2,0,Math.PI/2),M3.steel,r.w*0.2,36,z));}
 const pipe=CYL(1.6,1.6,r.w*0.4,M3.steel,8,0,30,0);pipe.rotation.z=Math.PI/2;g.add(pipe);
 const cr=new THREE.Mesh(new THREE.OctahedronGeometry(9,0),M3.crys);cr.scale.y=1.9;cr.position.set(-r.w*0.18,44,0);g.add(cr);g.userData.cr=cr;
 g.add(CYL(10,12,6,M3.steel,8,-r.w*0.18,30,0));
 g.add(BOX(r.w*0.26,3,r.h*0.92,M3.dark,r.w*0.36,7,0));
 return addShadow(g,true,true);}
function mkMine(){const g=new THREE.Group();
 const hill=new THREE.Mesh(displace(new THREE.SphereGeometry(1,28,16,0,Math.PI*2,0,Math.PI/2),0.5,2.2),std(0x7A5A40,0.95,0));hill.scale.set(50,30,44);g.add(hill);
 const mouth=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),std(0x0E0C0A,1,0));mouth.scale.set(17,15,9);mouth.position.set(-10,6,34);g.add(mouth);
 for(let i=0;i<11;i++){const c=new THREE.Mesh(new THREE.OctahedronGeometry(3.5+(i%3)*1.8,0),M3.crys);const a=i*0.62+0.3;c.position.set(Math.cos(a)*(28+i%2*8),12+(i%3)*7,Math.sin(a)*24+6);c.scale.y=2.2;c.rotation.set((i%3-1)*0.4,i,(i%2-0.5)*0.6);g.add(c);}
 return addShadow(g,true,true);}
function mkPad(){const g=new THREE.Group();const s=CYL(23,25.5,3,M3.conc,4,0,1.5,0);s.rotation.y=Math.PI/4;g.add(s);for(const [x,z] of [[-13,-13],[13,-13],[-13,13],[13,13]])g.add(CYL(1.2,1.2,1,M3.steel,6,x,3.2,z));return addShadow(g,false,true);}
function mkTree(kind){const g=new THREE.Group();
 if(kind===0){g.add(CYL(1.6,2.6,16,M3.bark,7,0,8,0));const leaf=new THREE.MeshStandardMaterial({color:0xFFFFFF,roughness:0.9});
  for(const [x,y,z,r] of [[0,22,0,9],[5,18,3,6.5],[-5,19,-2,7],[2,27,-3,6],[-3,25,4,5.5]])g.add(MESH(displace(new THREE.IcosahedronGeometry(r,2),0.35,0.25),leaf,x,y,z));}
 else{g.add(CYL(1.2,1.8,10,M3.bark,6,0,5,0));const leaf=new THREE.MeshStandardMaterial({color:0xFFFFFF,roughness:0.9});
  for(let i=0;i<4;i++){g.add(MESH(displace(new THREE.ConeGeometry(10-i*2.2,10,9),0.18,0.4),leaf,0,10+i*6.5,0));}}
 return bakeGroup(g);}
function windify(m,amp){m.onBeforeCompile=sh=>{sh.uniforms.uT=WIND;sh.vertexShader='uniform float uT;\n'+sh.vertexShader.replace('#include <begin_vertex>',
  `#include <begin_vertex>
  #ifdef USE_INSTANCING
  float wph=instanceMatrix[3].x*0.05+instanceMatrix[3].z*0.07;
  #else
  float wph=0.0;
  #endif
  float wk=max(position.y,0.0)*${amp.toFixed(4)};transformed.x+=sin(uT*1.7+wph)*wk;transformed.z+=cos(uT*1.3+wph*1.3)*wk*0.6;`);};m.needsUpdate=true;return m;}
const WIND={value:0};
function build(){if(world){scene.remove(world);}
 world=new THREE.Group();scene.add(world);const th=THEME[MAP.theme]?MAP.theme:'grass',T=THEME[th];seedR=7;
 materials(th);buildHeights();
 if(sky)scene.remove(sky);sky=mkSky(th);scene.add(sky);scene.environment=mkEnv(th);
 scene.fog=new THREE.FogExp2(lin(T.fog),T3.lo?0.0012:0.0008);
 /* ground: a fine grid over the battle, coarser around it */
 const G=new THREE.PlaneGeometry(5200,3400,isMob?150:220,isMob?100:140);G.rotateX(-Math.PI/2);G.translate(800,0,200);const pos=G.attributes.position,cols=[];
 const c1=lin(T.g1),c2=lin(T.dirt),c3=lin(T.rock),tmp=new THREE.Color();
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),y=hgt(x,z);pos.setY(i,y);tmp.setRGB(1,1,1);const n=fbm(x*0.01,z*0.01);tmp.multiplyScalar(0.82+n*0.36);
  if(x>-40&&x<FW+40&&z>-30&&z<430){const k=keepOut(x,z);if(k<14)tmp.lerp(new THREE.Color(1.1,0.95,0.75),Math.max(0,1-(k+4)/18)*0.45);}
  if(x>752&&x<848&&z>-60&&z<460)tmp.lerp(new THREE.Color(1.5,1.3,0.9),Math.max(0,1-Math.abs(Math.abs(x-800)-34)/16)*0.7);
  if(y>70)tmp.lerp(new THREE.Color(0.75,0.72,0.66),Math.min(1,(y-70)/90)*0.6);cols.push(tmp.r,tmp.g,tmp.b);}
 G.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));G.computeVertexNormals();
 const gm=new THREE.Mesh(G,M3.ground);gm.receiveShadow=true;world.add(gm);
 /* river with sandy banks and a bridge on every road */
 water=new THREE.Mesh(new THREE.PlaneGeometry(70,3400,1,1),new THREE.MeshStandardMaterial({color:lin(0x2E6E9A),roughness:0.06,metalness:0.1,normalMap:TX.ripple,normalScale:new THREE.Vector2(0.6,0.6),transparent:true,opacity:0.88}));
 water.rotation.x=-Math.PI/2;water.position.set(800,-2.5,200);water.receiveShadow=true;world.add(water);
 for(const pl of roads()){const z=pl[0][1];const b=new THREE.Group();b.add(BOX(96,3,42,M3.wood,0,1.5,0));for(const s of [-1,1]){b.add(BOX(96,1.5,1.5,M3.steel,0,7,s*20));for(let x=-44;x<=44;x+=11)b.add(BOX(1.5,6,1.5,M3.steel,x,4,s*20));}
  for(const x of [-30,0,30])b.add(CYL(2.2,2.2,12,M3.wood,8,x,-4,0));addShadow(b,true,true);b.position.set(800,0.5,z);world.add(b);}
 for(const si of [me,1-me]){const g=new THREE.Group();world.add(g);const tr=si===me?(x=>x):(x=>FW-x);
  for(const pl of roads()){const s=strip(smoothPl(pl,30).map(p=>[tr(p[0]),p[1]]),44,0.25,M3.road,44);if(s)g.add(s);}
  if(TRACK_PL&&TRACK_PL.length>1){const s=strip(smoothPl(TRACK_PL,16).map(p=>[tr(p[0]),p[1]]),15,0.45,M3.track,15);if(s)g.add(s);}
  for(const sl of SLOTS){const m=mkPad();m.position.set(tr(sl.x),hgt(tr(sl.x),sl.y),sl.y);g.add(m);}
  const [hx,hy]=hqPos(),hq=mkHQ(si);hq.position.set(tr(hx),0,hy);if(si!==me)hq.rotation.y=Math.PI;g.add(hq);
  const rr=baseRects()[1];if(rr){const rf=mkRefinery(si,rr);rf.position.set(tr(rr.x+rr.w/2),0,rr.y+rr.h/2);if(si!==me)rf.rotation.y=Math.PI;g.add(rf);}
  for(const f of FIELDS)if(!f.gone){const mn=mkMine();mn.position.set(tr(f.x),0,f.y);if(si!==me)mn.rotation.y=Math.PI;g.add(mn);}}
 /* no vegetation: rocks, old craters and sandbag walls at the bases */
 const free=(x,z,m)=>keepOut(x,z)>m;const o=new THREE.Object3D();
 const far=(x,z)=>Math.max(-260-x,x-FW-260,-240-z,z-640)>0;
 /* rocks: boulders around, small stones in the battle area */
 const rp=[];for(let i=0;i<6000&&rp.length<(isMob?150:220);i++){const x=-200+rn()*2000,z=-120+rn()*640;if(x>748&&x<852&&z>-60&&z<460)continue;if(free(x,z,8))rp.push([x,z,rn()]);}
 {const geo=displace(new THREE.IcosahedronGeometry(1,2),0.5,1.4);const im=new THREE.InstancedMesh(geo,M3.rock,rp.length);im.castShadow=true;im.receiveShadow=true;
  rp.forEach(([x,z,r],i)=>{const inP=x>-20&&x<FW+20&&z>-10&&z<410,s=inP?1.6+r*r*5:3+r*r*14;o.position.set(x,hgt(x,z)-s*0.25,z);o.scale.set(s*(1+r*0.5),s*(0.55+r*0.3),s);o.rotation.set(r*2,r*9,0);o.updateMatrix();im.setMatrixAt(i,o.matrix);
   const g=0.75+((r*7919)%1)*0.4;im.setColorAt(i,new THREE.Color(g,g*0.97,g*0.93));});im.instanceColor.needsUpdate=true;world.add(im);}
 /* battle scars: burnt-out wrecks, old craters, sandbag walls at the bases */
 {
  for(let i=0;i<14;i++){let x=0,z=0,ok=false;for(let t=0;t<200&&!ok;t++){x=rn()*FW;z=rn()*400;ok=keepOut(x,z)>10&&!(x>720&&x<880);}if(!ok)continue;
   const d=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:TX.dark,transparent:true,depthWrite:false,opacity:0.4,polygonOffset:true,polygonOffsetFactor:-6}));d.rotation.x=-Math.PI/2;const r_=14+rn()*16;d.scale.set(r_,r_,1);d.position.set(x,hgt(x,z)+0.4,z);world.add(d);}
  const bag=std(0x9A8A64,0.95,0),bg=new THREE.SphereGeometry(1,10,6);
  for(const si of [0,1]){const [hx,hy]=hqPos(),cx=WX(si,hx),dir=si===me?1:-1;const g=new THREE.Group();
   for(let row=0;row<2;row++)for(let k=-5;k<=5;k++){const a=k*0.13,R_=66,bx=Math.cos(a)*R_*dir,bz=Math.sin(a)*R_,lx=si===me?cx+bx:FW-(cx+bx);if(roads().some(pl=>polyDist(lx,hy+bz,pl)<28))continue;const m=new THREE.Mesh(bg,bag);m.scale.set(4.2,2,2.6);m.position.set(Math.cos(a)*R_*dir,1.6+row*3.4,Math.sin(a)*R_);m.rotation.y=-a*dir+Math.PI/2;g.add(m);}
   addShadow(g,true,true);g.position.set(cx,0,hy);world.add(g);}}
 /* clouds */
 for(let i=0;i<16;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.cloud,transparent:true,depthWrite:false,fog:false,opacity:0.85}));const a=rn()*6.28,d=900+rn()*1200;
  s.position.set(800+Math.cos(a)*d,380+rn()*260,200+Math.sin(a)*d);s.scale.set(520+rn()*400,200+rn()*120,1);s.userData.v=4+rn()*6;world.add(s);s.userData.cloud=1;}
 world.traverse(o=>{if(o.material&&o.material.isMeshStandardMaterial&&o.material.envMapIntensity===1)o.material.envMapIntensity=0.5;});
 T3.sig=MAPI+':'+MAP.name+':'+me;}

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
function buildUnit(k,si){const M=mats(si);const root=new THREE.Group();
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
 if(k==='mg'){tu.add(profile([[-6,0],[6,0],[7.5,4],[5,9],[-6,9]],11,M.paint),BOX(3.4,4.4,11.6,M.dark,-7.2,5,0),BOX(4,3,3,M.gun,0,10.5,0),CYL(5,5,1.4,M.steel,16,0,0.6,0));
  for(const s of [-2.4,2.4]){tu.add(rotZ(CYL(0.85,0.85,14,M.gun,10,13,5.6,s)),rotZ(CYL(1.2,1.2,3,M.gun,10,7.5,5.6,s)));}}
 else if(k==='can'){tu.add(CYL(8,9.5,8,M.paint,20,0,4,0),MESH(new THREE.SphereGeometry(8,20,10,0,Math.PI*2,0,Math.PI/2),M.paint,0,8,0),BOX(5,4,5,M.dark,-7,6,0),CYL(1.6,1.6,1.4,M.steel,12,-2,15.6,2));
  tu.add(rotZ(CYL(1.9,2.3,22,M.gun,14,16,6,0)),rotZ(CYL(2.8,2.8,4,M.gun,14,9,6,0)),rotZ(CYL(3.1,3.1,3,M.gun,14,27.5,6,0)));}
 else if(k==='tes'){tu.add(CYL(1.8,2.8,18,M.steel,10,0,9,0),BOX(4,6,4,M.dark,0,3,0));const d=MESH(new THREE.SphereGeometry(12,24,8,0,Math.PI*2,0,Math.PI*0.32),pnt(TEAM3(si).l,0.35,0.6),0,24,0);d.rotation.z=Math.PI*0.62;tu.add(d);
  tu.add(SPH(1.8,M3.lamp,4,26,0,8,6),rotZ(CYL(0.4,0.4,8,M.gun,6,4,22,0)));}
 else{tu.add(BOX(16,9,17,M.paint,0,5,0),BOX(17,1.5,18,M.dark,0,10,0),BOX(6,6,6,M.dark,-9,4,0),CYL(6,6,1.4,M.steel,16,0,0.6,0));for(const [y,z] of [[3.6,-4.4],[3.6,4.4],[7.2,-4.4],[7.2,4.4]]){tu.add(rotZ(CYL(1.9,1.9,10,pnt(0xD8D8D0,0.6,0.3),12,8.5,y,z)));const tip=MESH(new THREE.ConeGeometry(1.6,3,10),std(0xE04030,0.5,0),14,y,z);tip.rotation.z=-Math.PI/2;tu.add(tip);}}
 return root;}
const live=new Map();let FR=0;const prev=new Map();
function sync(key,make,place){let e=live.get(key);if(!e){e={o:make()};dyn.add(e.o);live.set(key,e);}e.seen=FR;place(e.o,e);return e.o;}
const headOf=(id,x,z,o,min)=>{const q=prev.get(id);let a=o.userData.a||0;if(q){const dx=x-q[0],dz=z-q[1];if(dx*dx+dz*dz>(min||0.04))a=Math.atan2(dz,dx);}prev.set(id,[x,z]);if(o.userData.a==null)o.userData.a=a;let d=a-o.userData.a;d=Math.atan2(Math.sin(d),Math.cos(d));o.userData.a+=d*0.25;return o.userData.a;};
const fxSeen=new WeakSet();
function syncAll(t,dt){FR++;const V=viewW;if(!V)return;
 for(const si of [0,1]){const S=V.sides[si];if(!S)continue;
  for(const tw of S.towers){sync('t'+tw.id+'_'+tw.lv,()=>instantiate(proto('T'+tw.k+si+tw.lv+(si===me?'m':'e'),()=>buildTower(tw.k,si,tw.lv))),o=>{o.position.set(WX(si,tw.x),hgt(WX(si,tw.x),tw.y)+1,tw.y);
    o.scale.setScalar(1+0.06*(tw.lv-1));const a=tw._aim!=null?tw._aim:WA(si,tw.a||0);const tu=o.userData.tur;if(tu)tu.rotation.y=tw.k==='tes'?t*1.6:rotY(a);});}
  for(const u of S.units){if(u.dead)continue;const p=uat(u,u.d),x=WX(si,p[0]),z=p[1],air=isAir(u);
   sync('u'+u.id,()=>{const g=instantiate(proto('U'+u.k+(u.o===me?'m':'e'),()=>buildUnit(u.k,u.o)));if(u.k==='titan')g.scale.setScalar(2.3);return g;},(o,e)=>{const a=headOf('u'+u.id,x,z,o);
    const y=air?ALT[u.k]+Math.sin(t*2+u.id)*1.5+hgt(x,z)*0.3:hgt(x,z);o.position.set(x,y,z);o.rotation.y=rotY(a);
    if(air&&u.k==='heli'){o.rotation.z=-0.12;}if(o.userData.rot)o.userData.rot.rotation.y=t*28;if(o.userData.rot2)o.userData.rot2.rotation.z=t*40;
    if(o.userData.tur&&u.ga!=null)o.userData.tur.rotation.y=-(WA(si,u.ga)-a);
    if(!air&&u.k!=='inf'&&Math.abs(x-P.x)+Math.abs(z-P.z)<420){e.dust=(e.dust||0)-dt;if(e.dust<=0){e.dust=0.22;puff(x-Math.cos(a)*12,1.5,z-Math.sin(a)*12,'dust');}}});}
  for(const h of S.hv){const p=hat(h.dd??h.d),x=WX(si,p[0]),z=p[1];sync('h'+h.id,()=>instantiate(proto('H'+(si===me?'m':'e'),()=>buildHarv(si))),o=>{const a=headOf('h'+h.id,x,z,o,0.01);o.position.set(x,hgt(x,z)+0.4,z);o.rotation.y=rotY(a);});}
  for(const r of S.rockets||[]){const key='r'+si+'_'+r.tid+'_'+r.u;sync(key,()=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.glow,color:0xFFB050,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));s.scale.set(7,7,1);return s;},(o,e)=>{const x=WX(si,r.x),z=r.y,y=12+34*Math.sin(Math.PI*Math.min(1,r.k||0));o.position.set(x,y,z);
    e.tr=(e.tr||0)-dt;if(e.tr<=0){e.tr=0.04;puff(x,y,z,'trail');}});}
  for(const f of FX[si]||[]){if(f.k!=='boom'||fxSeen.has(f))continue;fxSeen.add(f);explode(WX(si,f.x),hgt(WX(si,f.x),f.y),f.y,(f.huge?2.2:f.big?1.4:0.7)*(f.m||1));}}
 for(const s of shells)sync('s'+s.id,()=>{const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.glow,color:0xFFE2A0,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));sp.scale.set(5,5,1);return sp;},o=>o.position.set(s.x,s.y,s.z));
 for(const tr of tracers)sync('T'+tr.id,()=>{const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);return new THREE.Line(g,new THREE.LineBasicMaterial({color:0xFFE070,transparent:true,opacity:0.9,blending:THREE.AdditiveBlending}));},o=>{const a=o.geometry.attributes.position;a.setXYZ(0,tr.a[0],tr.a[1],tr.a[2]);a.setXYZ(1,tr.b[0],tr.b[1],tr.b[2]);a.needsUpdate=true;});
 for(const [k,e] of live)if(e.seen!==FR){dyn.remove(e.o);if(e.o.isSprite||e.o.isLine){e.o.material.dispose();if(e.o.isLine)e.o.geometry.dispose();}live.delete(k);prev.delete(k);}}

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

/* ---------- the player's Titan ---------- */
const shells=[],booms=[],tracers=[];let SID=0;
const cock=new THREE.Group();cam.add(cock);
const barrel=new THREE.Group();cock.add(barrel);
{const b=CYL(1.9,2.4,44,std(0x2C3036,0.4,0.7),24,0,0,0);b.rotation.x=Math.PI/2;b.position.set(0,-7.5,-28);barrel.add(b);
 const mz=CYL(3.4,3.4,6,std(0x1C2024,0.5,0.6),24,0,0,0);mz.rotation.x=Math.PI/2;mz.position.set(0,-7.5,-50);barrel.add(mz);const fe=CYL(2.8,2.8,7,std(0x2C3036,0.4,0.7),24,0,0,0);fe.rotation.x=Math.PI/2;fe.position.set(0,-7.5,-34);barrel.add(fe);
 const sl=CYL(3,3.2,9,std(0x3A4048,0.5,0.6),24,0,0,0);sl.rotation.x=Math.PI/2;sl.position.set(0,-7.5,-10);barrel.add(sl);
 cock.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});}
function spawn(){const [hx,hy]=hqPos();P.x=WX(me,hx+70);P.z=hy+(hy<200?60:-60);P.yaw=0;P.pitch=-0.06;P.hp=P.max;P.move=false;P.dead=0;}
function blockers(){const o=[];const [hx,hy]=hqPos(),rr=baseRects()[1];for(const si of [0,1]){o.push([WX(si,hx),hy,50]);if(rr)o.push([WX(si,rr.x+rr.w/2),rr.y+rr.h/2,Math.max(rr.w,rr.h)/2]);for(const f of FIELDS)if(!f.gone)o.push([WX(si,f.x),f.y,44]);for(const tw of W.sides[si].towers)o.push([WX(si,tw.x),tw.y,20]);}return o;}
function stepTitan(dt){if(P.dead>0){P.dead-=dt;if(P.dead<=0)spawn();return;}
 P.cd=Math.max(0,P.cd-dt);P.rec=Math.max(0,P.rec-dt*4);P.shake=Math.max(0,(P.shake||0)-dt*2);
 if(P.move){const v=TITAN_SP*dt;P.x+=Math.cos(P.yaw)*v;P.z+=Math.sin(P.yaw)*v;P.bob+=dt*7;}
 for(const [bx,bz,r] of blockers()){const dx=P.x-bx,dz=P.z-bz,d=Math.hypot(dx,dz),R_=r+16;if(d<R_&&d>0.01){P.x=bx+dx/d*R_;P.z=bz+dz/d*R_;}}
 P.x=Math.max(10,Math.min(FW-10,P.x));P.z=Math.max(12,Math.min(392,P.z));
 if(P.hold&&P.cd<=0)fire();
 const S=W.sides[1-me];for(const tw of S.towers){tw._aim=null;const x=WX(1-me,tw.x),R_=TW[tw.k].range*lvR(tw.k,tw.lv-1),d=Math.hypot(x-P.x,tw.y-P.z);if(d>R_)continue;
  const mult=(tw.k==='can'?CAN_LVM:tw.k==='mg'?MG_LVM:LVM)[tw.lv-1],dps=TW[tw.k].dmg*mult/(TW[tw.k].cd*LVC[tw.lv-1])*(tw.k==='tes'?0.6:1)*(S.twK||1);
  P.hp-=dps*dt*0.5;tw._aim=Math.atan2(P.z-tw.y,P.x-x);tw._t=(tw._t||0)-dt;if(tw._t<=0){tw._t=tw.k==='mg'?0.16:0.9;tracers.push({id:++SID,a:[x,16,tw.y],b:[P.x+(rn()-0.5)*8,10+rn()*8,P.z+(rn()-0.5)*8],t:0.06});
   if(tw.k!=='mg'){explode(P.x+(rn()-0.5)*20,hgt(P.x,P.z),P.z+(rn()-0.5)*20,0.45);}}}
 if(P.hp<=0){P.hp=0;P.dead=RESPAWN;P.move=false;P.hold=false;W.sides[1-me].ore+=TITAN_BOUNTY;explode(P.x,hgt(P.x,P.z),P.z,2.6);HUD.msg('Титан уничтожен — возрождение через 5 с');}}
const ray=new THREE.Raycaster();
function fire(){if(P.dead>0||P.cd>0)return;P.cd=SHOT_CD;
 cam.updateMatrixWorld();const o=new THREE.Vector3(),d=new THREE.Vector3();cam.getWorldPosition(o);cam.getWorldDirection(d);
 let hit=null;ray.set(o,d);ray.far=760;
 const tg=[];for(const [k,e] of live){const c=k[0];if(c==='t'||c==='h'||c==='u')tg.push(e.o);}
 const hs=ray.intersectObjects(tg,true);if(hs.length)hit=hs[0].point;
 if(!hit){for(let s=4;s<760;s+=4){const p=o.clone().addScaledVector(d,s);if(p.y<=hgt(p.x,p.z)){hit=p;break;}}if(!hit)hit=o.clone().addScaledVector(d,560);}
 const st=new THREE.Vector3(0,-7.5,-53);barrel.localToWorld(st);
 const L=st.distanceTo(hit);shells.push({id:++SID,x:st.x,y:st.y,z:st.z,sx:st.x,sy:st.y,sz:st.z,tx:hit.x,ty:hit.y,tz:hit.z,t:0,T:Math.max(0.05,L/SHOT_V)});
 puff(st.x,st.y,st.z,'muzzle');for(let i=0;i<3;i++)puff(st.x+d.x*i*4,st.y+d.y*i*4,st.z+d.z*i*4,'trail');P.rec=1;flash.position.copy(st);flash.intensity=Math.max(flash.intensity,2);
 HUD.kick();try{SFX&&SFX.click&&SFX.click();}catch(_){}}
function impact(x,y,z){explode(x,y,z,1.1);
 const R_=SHOT_R;
 for(const fs of [me,1-me]){const F=W.sides[fs];for(const u of F.units.slice()){if(u.dead||u.o===me||isAir(u))continue;const p=uat(u,u.d),d=Math.hypot(WX(fs,p[0])-x,p[1]-z);if(d>=R_)continue;
  const o0=F.ore;damageUnit(fs,u,SHOT_DMG*(d<R_*0.5?1:0.6));if(fs!==me){const g=F.ore-o0;if(g>0){F.ore-=g;W.sides[me].ore+=g;}}}}
 const se=1-me,Se=W.sides[se];
 for(const tw of Se.towers.slice()){const d=Math.hypot(WX(se,tw.x)-x,tw.y-z);if(d<R_*0.5+16){tw.th=(tw.th|0)+1;if(tw.th>=TITAN_TW_HITS){Se.towers.splice(Se.towers.indexOf(tw),1);padHold(se,tw.s);ev({e:'boom',s:se,x:tw.x|0,y:tw.y|0,b:2});ev({e:'twdie',s:se,x:tw.x|0,y:tw.y|0});}}}
 for(const h of Se.hv.slice()){const p=hat(h.dd??h.d),d=Math.hypot(WX(se,p[0])-x,p[1]-z);if(d<R_)hurtHarv(se,h,SHOT_DMG);}
 const [hx,hy]=hqPos();if(Math.hypot(WX(se,hx)-x,hy-z)<54){Se.lives=Math.max(0,Se.lives-1);Se.lastHit='titan';Se.breachT=W.t;ev({e:'boom',s:se,x:hx|0,y:hy|0,b:2});}}
function stepFx3(dt){for(let i=shells.length-1;i>=0;i--){const s=shells[i];s.t+=dt;const k=Math.min(1,s.t/s.T);s.x=s.sx+(s.tx-s.sx)*k;s.z=s.sz+(s.tz-s.sz)*k;s.y=s.sy+(s.ty-s.sy)*k+Math.sin(Math.PI*k)*Math.min(12,s.T*20);if(k>=1){shells.splice(i,1);impact(s.tx,s.ty,s.tz);}}
 for(let i=tracers.length-1;i>=0;i--){tracers[i].t-=dt;if(tracers[i].t<=0)tracers.splice(i,1);}}

/* ---------- post-processing: HDR render, bloom, filmic tone curve, colour grade, vignette ---------- */
const PO={on:false};
function setupPost(){try{if(!R.capabilities.isWebGL2)return;if(!R.extensions.get('EXT_color_buffer_float')&&!R.extensions.get('EXT_color_buffer_half_float'))return;
 const opt={type:THREE.HalfFloatType,format:THREE.RGBAFormat,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter};
 PO.rt=isMob?new THREE.WebGLRenderTarget(4,4,opt):new THREE.WebGLMultisampleRenderTarget(4,4,opt);if(PO.rt.isWebGLMultisampleRenderTarget)PO.rt.samples=4;
 PO.a=new THREE.WebGLRenderTarget(4,4,{...opt,depthBuffer:false});PO.b=new THREE.WebGLRenderTarget(4,4,{...opt,depthBuffer:false});
 const vs='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
 PO.bright=new THREE.ShaderMaterial({uniforms:{t:{value:null},th:{value:1.1}},vertexShader:vs,depthTest:false,depthWrite:false,
  fragmentShader:'uniform sampler2D t;uniform float th;varying vec2 vUv;void main(){vec3 c=texture2D(t,vUv).rgb;float l=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(th,th+0.8,l),1.0);}'});
 PO.blur=new THREE.ShaderMaterial({uniforms:{t:{value:null},d:{value:new THREE.Vector2()}},vertexShader:vs,depthTest:false,depthWrite:false,
  fragmentShader:'uniform sampler2D t;uniform vec2 d;varying vec2 vUv;void main(){vec3 c=texture2D(t,vUv).rgb*0.227;c+=(texture2D(t,vUv+d*1.385).rgb+texture2D(t,vUv-d*1.385).rgb)*0.316;c+=(texture2D(t,vUv+d*3.231).rgb+texture2D(t,vUv-d*3.231).rgb)*0.070;gl_FragColor=vec4(c,1.0);}'});
 PO.fin=new THREE.ShaderMaterial({uniforms:{tS:{value:null},tB:{value:null},ex:{value:0.95},bk:{value:0.55}},vertexShader:vs,depthTest:false,depthWrite:false,
  fragmentShader:`uniform sampler2D tS;uniform sampler2D tB;uniform float ex;uniform float bk;varying vec2 vUv;
  vec3 aces(vec3 x){x*=0.6;return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}
  void main(){vec3 c=texture2D(tS,vUv).rgb*ex+texture2D(tB,vUv).rgb*bk;c=aces(c);
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
setupPost();

/* ---------- HUD ---------- */
const css=document.createElement('style');css.textContent=`
#h3{position:fixed;inset:0;z-index:21;pointer-events:none;display:none;font:800 14px 'Rubik',system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px #000}
#h3 .b{pointer-events:auto;position:absolute;border:1.5px solid rgba(255,255,255,.25);border-radius:14px;background:rgba(12,18,14,.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);color:#fff;font:800 14px 'Rubik',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;user-select:none;-webkit-user-select:none;touch-action:none}
#h3 .b:active{transform:translateY(2px)}
#h3 .fire{right:max(20px,env(safe-area-inset-right));bottom:24px;width:92px;height:92px;border-radius:50%;background:radial-gradient(circle at 50% 40%,rgba(230,80,58,.9),rgba(140,24,20,.85));border-color:rgba(255,200,180,.5);font-size:15px}
#h3 .go{left:max(20px,env(safe-area-inset-left));bottom:24px;width:104px;height:62px;font-size:16px}
#h3 .go.on{background:rgba(60,150,70,.75)}
#h3 .map{right:max(14px,env(safe-area-inset-right));top:12px;padding:0 14px;height:40px}
#h3 .units{position:absolute;top:12px;left:50%;transform:translateX(-50%);display:flex;gap:6px}
#h3 .units .b{position:static;width:58px;height:40px;font-size:12px;flex-direction:column;line-height:1.1}
#h3 .units .b.dis{opacity:.45}
#h3 .stat{position:absolute;left:max(14px,env(safe-area-inset-left));top:10px;background:rgba(12,18,14,.5);border-radius:12px;padding:6px 12px;line-height:1.35}
#h3 svg.xh{position:absolute;left:50%;top:50%;width:150px;height:150px;margin:-75px 0 0 -75px;overflow:visible}
#h3 .hp{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);width:min(300px,38vw);height:10px;border-radius:6px;background:rgba(0,0,0,.45);overflow:hidden;border:1px solid rgba(255,255,255,.3)}
#h3 .hp i{display:block;height:100%;background:linear-gradient(90deg,#5FD068,#A8F07A)}
#h3 .rl{position:absolute;left:50%;bottom:34px;transform:translateX(-50%);font-size:12px;opacity:.9;letter-spacing:.5px}
#h3 .fps{position:absolute;right:max(14px,env(safe-area-inset-right));top:58px;font-size:11px;opacity:.6}
#h3 .msg{position:absolute;left:50%;top:28%;transform:translateX(-50%);background:rgba(12,18,14,.7);border-radius:12px;padding:8px 16px;font-size:16px;display:none}
#h3 .frame{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 46%,transparent 62%,rgba(5,8,6,.5) 100%)}
#h3 .hurt{position:absolute;inset:0;box-shadow:inset 0 0 120px rgba(200,20,10,.0);transition:box-shadow .15s}
#b2d{position:fixed;z-index:22;left:50%;top:8px;transform:translateX(-50%);display:none;border:2px solid #0C120B;border-radius:12px;background:linear-gradient(#F2C232,#C99A1A);color:#1C2416;font:900 14px 'Rubik',system-ui,sans-serif;padding:8px 16px}
#tag3d{position:fixed;z-index:30;left:50%;top:6px;transform:translateX(-50%);background:#F2C232;color:#1C2416;border-radius:10px;padding:4px 12px;font:900 13px 'Rubik',system-ui,sans-serif;pointer-events:none}`;
document.head.appendChild(css);
const H=document.createElement('div');H.id='h3';H.innerHTML=`<div class="frame"></div><div class="hurt"></div>
<svg class="xh" viewBox="-75 -75 150 150"><g fill="none" stroke="rgba(255,255,255,.9)" stroke-width="1.6"><circle r="22" stroke-dasharray="10 6"/><path d="M-60 0H-30M30 0H60M0 -46V-30M0 30V60"/><path d="M-8 34H8M-5 42H5M-3 50H3" stroke-width="1.2"/></g><circle r="1.8" fill="#FF5040"/><circle class="rld" r="27" fill="none" stroke="#F2C232" stroke-width="2.5" stroke-dasharray="0 170" transform="rotate(-90)"/></svg>
<div class="stat"><div class="s1"></div><div class="s2" style="font-size:12px;opacity:.85"></div></div>
<div class="units"></div><div class="b map">Карта</div><div class="fps"></div>
<div class="b go">Старт</div><div class="b fire">Огонь</div><div class="hp"><i></i></div><div class="rl"></div><div class="msg"></div>`;
document.body.appendChild(H);
const b2=document.createElement('button');b2.id='b2d';b2.textContent='◀ В кабину Титана';document.body.appendChild(b2);
const tag=document.createElement('div');tag.id='tag3d';tag.textContent='3D-прототип · нажми «Играть»';document.body.appendChild(tag);
const q=s=>H.querySelector(s);
const UK=[['inf','Пехота'],['jeep','Джип'],['tank','Танк'],['heli','Верт.']];
q('.units').innerHTML=UK.map(([k,n])=>`<div class="b" data-k="${k}">${n}<span></span></div>`).join('');
let lastHp=P.max;
const HUD={msgT:0,msg(s){const m=q('.msg');m.textContent=s;m.style.display='block';this.msgT=2.5;},kick(){this.k=0.12;},k:0,
 upd(dt){const S=W.sides[me],E=W.sides[1-me];q('.s1').innerHTML=`❤ ${S.lives} &nbsp; 💎 ${Math.floor(S.ore)}`;q('.s2').innerHTML=`Соперник: ❤ ${E.lives}`;
  q('.hp i').style.width=(100*P.hp/P.max).toFixed(1)+'%';q('.rl').textContent=P.dead>0?'возрождение '+Math.ceil(P.dead)+' с':P.cd>0?'перезарядка':'готов к выстрелу';
  q('.rld').setAttribute('stroke-dasharray',(170*(1-P.cd/SHOT_CD)).toFixed(1)+' 170');
  q('.hurt').style.boxShadow='inset 0 0 120px rgba(200,20,10,'+(P.hp<lastHp-0.5?0.55:0)+')';lastHp=P.hp;
  q('.go').textContent=P.move?'Стоп':'Старт';q('.go').classList.toggle('on',P.move);
  for(const el of q('.units').children){const k=el.dataset.k,c=unitCost(k,S.ua);el.lastChild.textContent=c;el.classList.toggle('dis',S.ore<c);}
  q('.fps').textContent=Math.round(T3.fps)+' к/с · ×'+T3.q.toFixed(2);
  if(this.msgT>0){this.msgT-=dt;if(this.msgT<=0)q('.msg').style.display='none';}
  this.k=Math.max(0,this.k-dt);}};
const tapBtn=(el,fn)=>el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();fn(e);});
tapBtn(q('.go'),()=>{P.move=!P.move;});
q('.fire').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();P.hold=true;fire();});
for(const ev_ of ['pointerup','pointercancel','pointerleave'])q('.fire').addEventListener(ev_,()=>{P.hold=false;});
tapBtn(q('.map'),()=>{T3.map=true;P.move=false;P.hold=false;});
b2.addEventListener('click',()=>{T3.map=false;});
for(const el of q('.units').children)tapBtn(el,()=>{try{sendCmd({a:'send',k:el.dataset.k});}catch(e){console.error(e);}});

/* ---------- look: one finger turns, two fingers zoom ---------- */
const ptr=new Map();let pinch0=0,zoom0=1;
cv3.addEventListener('pointerdown',e=>{try{cv3.setPointerCapture(e.pointerId);}catch(_){}ptr.set(e.pointerId,[e.clientX,e.clientY]);if(ptr.size===2){const [a,b]=[...ptr.values()];pinch0=Math.hypot(a[0]-b[0],a[1]-b[1]);zoom0=P.zoom;}});
cv3.addEventListener('pointermove',e=>{const p=ptr.get(e.pointerId);if(!p)return;const dx=e.clientX-p[0],dy=e.clientY-p[1];ptr.set(e.pointerId,[e.clientX,e.clientY]);
 if(ptr.size===1){const k=0.0055/P.zoom;P.yaw+=dx*k;P.pitch=Math.max(-0.32,Math.min(0.22,P.pitch-dy*k*0.8));}
 else if(ptr.size===2&&pinch0>0){const [a,b]=[...ptr.values()];P.zoom=Math.max(1,Math.min(3.2,zoom0*Math.hypot(a[0]-b[0],a[1]-b[1])/pinch0));}});
for(const n of ['pointerup','pointercancel'])cv3.addEventListener(n,e=>{ptr.delete(e.pointerId);if(ptr.size<2)pinch0=0;});
cv3.addEventListener('wheel',e=>{e.preventDefault();P.zoom=Math.max(1,Math.min(3.2,P.zoom*(e.deltaY<0?1.12:1/1.12)));},{passive:false});
const keys=new Set();
addEventListener('keydown',e=>{if(!T3.on||T3.map)return;keys.add(e.code);if(e.code==='Space'){e.preventDefault();P.hold=true;fire();}if(e.code==='KeyW')P.move=true;if(e.code==='KeyS')P.move=false;if(e.code==='KeyM')T3.map=true;});
addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Space')P.hold=false;});

/* ---------- the 2D game keeps running; its drawing is skipped while the 3D view is up ---------- */
const render2d=window.render;window.render=function(t){if(T3.on&&!T3.map)return;return render2d(t);};

function size(){const w=innerWidth,h=innerHeight;R.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();postSize();}
addEventListener('resize',size);size();
let last=performance.now(),runSig=null;
function loop(now_){requestAnimationFrame(loop);const dt=Math.min(0.05,(now_-last)/1000);last=now_;
 const lob=document.getElementById('lobby');tag.style.display=lob&&!lob.hidden?'block':'none';
 const active=mode==='solo'&&W&&!W.over&&W.t>0.2&&!(typeof GATE!=='undefined'&&GATE.busy);
 if(!active){if(T3.on){T3.on=false;cv3.style.display='none';H.style.display='none';b2.style.display='none';}runSig=W&&W.t<0.2?null:runSig;return;}
 if(T3.sig!==MAPI+':'+MAP.name+':'+me)build();
 if(runSig!==W){runSig=W;spawn();T3.map=false;}
 T3.on=true;cv3.style.display=T3.map?'none':'block';H.style.display=T3.map?'none':'block';b2.style.display=T3.map?'block':'none';
 if(T3.map)return;
 const sdt=W.pause?0:dt*(W.speed||1);
 if(keys.has('KeyA'))P.yaw-=1.6*dt;if(keys.has('KeyD'))P.yaw+=1.6*dt;
 const t=now_/1000;WIND.value=t;
 stepTitan(sdt);stepFx3(sdt);syncAll(t,sdt);stepParts(sdt);
 if(water)water.material.normalMap.offset.set(t*0.01,-t*0.03);
 for(const c of world.children)if(c.userData.cloud){c.position.x+=c.userData.v*dt;if(c.position.x>3000)c.position.x=-1400;}
 const bob=P.move?Math.sin(P.bob)*0.6:0,sh=P.shake||0;
 const y=hgt(P.x,P.z)+(P.dead>0?70:24)+bob+(rn()-0.5)*sh*3;cam.position.set(P.x+(rn()-0.5)*sh*3,y,P.z);
 const lp=P.pitch+(HUD.k>0?HUD.k*0.22:0);cam.lookAt(P.x+Math.cos(P.yaw)*Math.cos(lp)*100,y+Math.sin(lp)*100,P.z+Math.sin(P.yaw)*Math.cos(lp)*100);
 const fov=P.fov/P.zoom;if(Math.abs(cam.fov-fov)>0.01){cam.fov=fov;cam.updateProjectionMatrix();}cock.visible=P.dead<=0&&P.zoom<1.6;barrel.position.z=P.rec*5;
 sky.position.copy(cam.position);
 sun.position.set(P.x+SUN_DIR.x*500,SUN_DIR.y*500,P.z+SUN_DIR.z*500);sun.target.position.set(P.x+Math.cos(P.yaw)*110,0,P.z+Math.sin(P.yaw)*110);
 HUD.upd(dt);draw();
 /* hold the frame rate: lower the resolution step by step when it drops, raise it back when there's room */
 T3.fpsN++;T3.fpsT+=dt;if(T3.fpsT>=2){T3.fps=T3.fpsN/T3.fpsT;T3.fpsN=0;T3.fpsT=0;let nq=T3.q;if(T3.fps<40&&T3.q>0.55)nq=Math.max(0.55,T3.q-0.15);else if(T3.fps>57&&T3.q<Math.min(2,devicePixelRatio||1))nq=Math.min(devicePixelRatio||1,T3.q+0.1);
  if(nq!==T3.q){T3.q=nq;R.setPixelRatio(nq);size();try{localStorage.setItem('dvebazy-3dq2',''+nq);}catch(_){}}
  if(T3.fps<28&&T3.q<=0.56&&R.shadowMap.enabled){R.shadowMap.enabled=false;scene.traverse(o=>{if(o.material)o.material.needsUpdate=true;});}}}
requestAnimationFrame(loop);
window.__t3={P,T3,fire,build,shells,get live(){return live;},explode,scene,R,sun,hemi};
})();
