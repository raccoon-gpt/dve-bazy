/* «Две базы» — 3D prototype: the same battle drawn in 3D, the player rides the Titan in its cockpit.
   Loaded after the game script on 3d.html; reads the game's globals (W, me, road, SLOTS, …) and draws
   on its own WebGL canvas over the 2D one. «Карта» shows the usual 2D screen. */
(function(){'use strict';
if(typeof THREE==='undefined'){console.error('three.js missing');return;}
const FW=1600;                         // both fields side by side: own field x 0..800, the enemy's mirrored to 800..1600
const ALT={heli:34,plane:70};
const COL={grass:0x6DB33F,sand:0xD8B46E,snow:0xE6EEF3,lava:0x4A3C34};
const SKY={grass:0x9CD3F0,sand:0xF0D9A8,snow:0xC9DCEA,lava:0x7A4A3A};
const ROADC={grass:0xC9A06A,sand:0xB98E58,snow:0xB4A99A,lava:0x2A221E};
const T3={on:false,map:false,ready:false,sig:null,q:1,fpsT:0,fpsN:0,fps:60};
const P={x:0,z:0,yaw:0,pitch:-0.06,move:false,hp:5000,max:5000,cd:0,dead:0,fov:68,zoom:1,hold:false};
const TITAN_SP=46,SHOT_CD=1.0,SHOT_DMG=360,SHOT_R=42,SHOT_V=900,RESPAWN=5,TITAN_BOUNTY=600;

/* ---------- renderer ---------- */
const cv3=document.createElement('canvas');cv3.id='cv3';
cv3.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;display:none;z-index:20;touch-action:none;background:#000';
document.body.appendChild(cv3);
let R;try{R=new THREE.WebGLRenderer({canvas:cv3,antialias:false,powerPreference:'high-performance'});}catch(e){console.error(e);return;}
const isMob=matchMedia('(pointer:coarse)').matches;
try{const q=+localStorage.getItem('dvebazy-3dq');if(q>=0.5&&q<=2)T3.q=q;else T3.q=Math.min(devicePixelRatio||1,isMob?1.25:1.5);}catch(_){T3.q=1;}
R.setPixelRatio(T3.q);
const scene=new THREE.Scene();
const cam=new THREE.PerspectiveCamera(P.fov,1,1,2600);scene.add(cam);
const hemi=new THREE.HemisphereLight(0xEAF6FF,0x4A5A30,0.85);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xFFF4DD,0.75);sun.position.set(-300,500,200);scene.add(sun);
let world=null;                         // static group (ground, roads, buildings, trees), rebuilt per map
const dyn=new THREE.Group();scene.add(dyn);
const M={};const mat=c=>M[c]||(M[c]=new THREE.MeshLambertMaterial({color:c}));
const team=si=>si===me?{m:0x3D7CC4,d:0x24466F,l:0x77B3EE}:{m:0xC92E2A,d:0x7A1A16,l:0xEE6A5E};
const box=(w,h,d,c)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));
const cyl=(r1,r2,h,c,n)=>new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,n||8),mat(c));
const ball=(r,c,n)=>new THREE.Mesh(new THREE.IcosahedronGeometry(r,n||0),mat(c));
/* field coords → world: own field as drawn, the enemy's mirrored across the river */
const WX=(si,x)=>si===me?x:FW-x;
const WA=(si,a)=>si===me?a:Math.PI-a;     // a 2D heading on that field → world heading
const rotY=a=>-a;                          // three.js: +X turned by -a points along (cos a, sin a) in (x,z)
function hgt(x,z){const ox=x<-30?-30-x:x>FW+30?x-FW-30:0,oz=z<-20?-20-z:z>420?z-420:0,o=Math.hypot(ox,oz);
 const n=Math.sin(x*0.013)*Math.cos(z*0.017)+0.6*Math.sin(x*0.031+z*0.023);
 if(o<=0)return(x>762&&x<838)?-5:0;return Math.min(210,o*0.42)*(0.75+0.25*n)+n*6;}

/* ---------- static world ---------- */
function ribbon(pl,w,y,c,g){for(let i=0;i<pl.length-1;i++){const a=pl[i],b=pl[i+1],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz);if(L<0.5)continue;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(L,w),mat(c));m.rotation.x=-Math.PI/2;m.rotation.z=-Math.atan2(dz,dx);m.position.set((a[0]+b[0])/2,y,(a[1]+b[1])/2);g.add(m);
  const j=new THREE.Mesh(new THREE.CircleGeometry(w/2,12),mat(c));j.rotation.x=-Math.PI/2;j.position.set(b[0],y,b[1]);g.add(j);}
 const j=new THREE.Mesh(new THREE.CircleGeometry(w/2,12),mat(c));j.rotation.x=-Math.PI/2;j.position.set(pl[0][0],y,pl[0][1]);g.add(j);}
function mkHQ(si){const g=new THREE.Group(),t=team(si);
 const b=box(84,10,84,0x5A6068);b.position.y=5;g.add(b);
 const c=box(56,22,56,t.d);c.position.y=21;g.add(c);
 const d=new THREE.Mesh(new THREE.SphereGeometry(20,12,8,0,Math.PI*2,0,Math.PI/2),mat(t.m));d.position.y=32;g.add(d);
 const a=cyl(1.2,1.2,26,0x333333);a.position.set(18,45,18);g.add(a);
 for(const [x,z] of [[-36,-36],[36,-36],[-36,36],[36,36]]){const p=cyl(7,8,18,t.m);p.position.set(x,9,z);g.add(p);}
 return g;}
function mkRefinery(si,r){const g=new THREE.Group(),t=team(si);
 const b=box(r.w,14,r.h,t.d);b.position.y=7;g.add(b);
 const roof=box(r.w*0.55,8,r.h*0.8,t.m);roof.position.set(-r.w*0.18,18,0);g.add(roof);
 const cr=new THREE.Mesh(new THREE.OctahedronGeometry(10,0),new THREE.MeshLambertMaterial({color:0x6FD6FF,emissive:0x1A5A88}));cr.scale.y=1.8;cr.position.set(-r.w*0.18,34,0);g.add(cr);g.userData.cr=cr;
 const dock=box(r.w*0.3,4,r.h*0.9,0x2A2E33);dock.position.set(r.w*0.33,15,0);g.add(dock);
 return g;}
function mkMine(){const g=new THREE.Group();
 const m=ball(1,0x8A5A3A,1);m.scale.set(46,26,40);m.position.y=4;g.add(m);
 const h=ball(1,0x1A1410,1);h.scale.set(20,16,8);h.position.set(-8,8,30);g.add(h);
 const cm=new THREE.MeshLambertMaterial({color:0x5FCBFF,emissive:0x15507A});
 for(let i=0;i<7;i++){const c=new THREE.Mesh(new THREE.OctahedronGeometry(5+i%3*2,0),cm);const a=i*0.9;c.position.set(Math.cos(a)*30,10+i%2*8,Math.sin(a)*24+8);c.scale.y=2;c.rotation.z=(i%3-1)*0.4;g.add(c);}
 return g;}
function pad(){const m=box(34,2,34,0x9C9483);m.position.y=1;return m;}
function build(){if(world){scene.remove(world);world.traverse(o=>{if(o.geometry)o.geometry.dispose();});}
 world=new THREE.Group();scene.add(world);const th=MAP.theme||'grass';
 scene.background=new THREE.Color(SKY[th]||SKY.grass);scene.fog=new THREE.Fog(SKY[th]||SKY.grass,520,1500);
 /* ground with hills outside the play area */
 const G=new THREE.PlaneGeometry(4200,2600,140,90);G.rotateX(-Math.PI/2);G.translate(800,0,200);const pos=G.attributes.position,cols=[],base=new THREE.Color(COL[th]||COL.grass);
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),y=hgt(x,z);pos.setY(i,y);const c=base.clone();const k=0.9+0.12*Math.sin(x*0.05+z*0.03)*Math.cos(z*0.07);c.multiplyScalar(k*(y>40?0.85:1));if(x>762&&x<838&&z>-20&&z<420)c.set(0x8A7A55);cols.push(c.r,c.g,c.b);}
 G.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));G.computeVertexNormals();
 world.add(new THREE.Mesh(G,new THREE.MeshLambertMaterial({vertexColors:true})));
 /* river with a bridge on every road */
 const wat=new THREE.Mesh(new THREE.PlaneGeometry(76,2600),new THREE.MeshLambertMaterial({color:0x3E8FD6,transparent:true,opacity:0.9}));wat.rotation.x=-Math.PI/2;wat.position.set(800,-2,200);world.add(wat);
 const rc=ROADC[th]||ROADC.grass;
 for(const si of [me,1-me]){const g=new THREE.Group();world.add(g);
  const tr=si===me?(x=>x):(x=>FW-x);
  for(const pl of (ROADS&&ROADS.length?ROADS:[road]))ribbon(pl.map(p=>[tr(p[0]),p[1]]),36,0.3,rc,g);
  if(TRACK_PL&&TRACK_PL.length>1)ribbon(TRACK_PL.map(p=>[tr(p[0]),p[1]]),14,0.45,0x50565C,g);
  for(const sl of SLOTS){const m=pad();m.position.set(tr(sl.x),1,sl.y);g.add(m);}
  const [hx,hy]=hqPos(),hq=mkHQ(si);hq.position.set(tr(hx),0,hy);g.add(hq);
  const rr=baseRects()[1];if(rr){const rf=mkRefinery(si,rr);rf.position.set(tr(rr.x+rr.w/2),0,rr.y+rr.h/2);if(si!==me)rf.rotation.y=Math.PI;g.add(rf);}
  for(const f of FIELDS)if(!f.gone){const mn=mkMine();mn.position.set(tr(f.x),0,f.y);if(si!==me)mn.rotation.y=Math.PI;g.add(mn);}}
 for(const pl of (ROADS&&ROADS.length?ROADS:[road])){const e=pl[0];const b=box(90,4,40,0x7A5A3A);b.position.set(800,2,e[1]);world.add(b);
  for(const s of [-1,1]){const r=box(90,4,3,0x4A3A2A);r.position.set(800,6,e[1]+s*19);world.add(r);}}
 /* trees and rocks: off the roads, pads and buildings */
 const free=(x,z)=>{if(x>750&&x<850)return false;for(const si of [0,1]){const lx=si===0?x:FW-x;if(lx<-40||lx>800)continue;
   for(const pl of (ROADS&&ROADS.length?ROADS:[road]))if(polyDist(lx,z,pl)<40)return false;if(TRACK_PL&&polyDist(lx,z,TRACK_PL)<26)return false;
   for(const sl of SLOTS)if(Math.abs(sl.x-lx)<34&&Math.abs(sl.y-z)<34)return false;const [hx,hy]=hqPos();if(Math.hypot(hx-lx,hy-z)<75)return false;
   const rr=baseRects()[1];if(rr&&lx>rr.x-30&&lx<rr.x+rr.w+30&&z>rr.y-30&&z<rr.y+rr.h+30)return false;for(const f of FIELDS)if(!f.gone&&Math.hypot(f.x-lx,f.y-z)<70)return false;}return true;};
 let s=7;const rn=()=>{s=(s*16807)%2147483647;return s/2147483647;};
 const pts=[];for(let i=0;i<5200&&pts.length<(isMob?520:800);i++){const x=-500+rn()*2600,z=-420+rn()*1240;const inPlay=x>-20&&x<FW+20&&z>-10&&z<410;if(inPlay&&rn()<0.55)continue;if(!free(x,z))continue;pts.push([x,z,rn()]);}
 const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(1.6,2.2,10,5),mat(0x6B4A2E),pts.length),crown=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),mat(th==='snow'?0x5E8A6A:th==='sand'?0x8FA54A:0x3E8A34),pts.length);
 const o=new THREE.Object3D();pts.forEach(([x,z,r],i)=>{const y=hgt(x,z),k=0.8+r*0.7;o.position.set(x,y+5*k,z);o.scale.set(k,k,k);o.rotation.set(0,r*6,0);o.updateMatrix();trunk.setMatrixAt(i,o.matrix);
  o.position.set(x,y+(13+r*3)*k,z);o.scale.set(11*k,10*k,11*k);o.updateMatrix();crown.setMatrixAt(i,o.matrix);});world.add(trunk,crown);
 const rp=[];for(let i=0;i<900&&rp.length<120;i++){const x=-60+rn()*1720,z=-10+rn()*420;if(free(x,z))rp.push([x,z,rn()]);}
 const rock=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),mat(0x9A9A92),rp.length);rp.forEach(([x,z,r],i)=>{o.position.set(x,1,z);o.scale.set(4+r*6,3+r*4,4+r*5);o.rotation.set(r,r*5,0);o.updateMatrix();rock.setMatrixAt(i,o.matrix);});world.add(rock);
 T3.sig=MAPI+':'+MAP.name+':'+me;}

/* ---------- moving things ---------- */
function mkUnit(k,si){const g=new THREE.Group(),t=team(si);let b;
 if(k==='inf'){for(const [dx,dz] of [[0,0],[-6,-5],[-6,5],[-12,0]]){const s=box(3,7,3,t.m);s.position.set(dx,3.5,dz);g.add(s);const h=ball(1.8,0xE8C9A0);h.position.set(dx,8.5,dz);g.add(h);}}
 else if(k==='jeep'){b=box(16,5,10,t.m);b.position.y=5;g.add(b);const c=box(6,4,9,t.d);c.position.set(-2,9,0);g.add(c);for(const [x,z] of [[5,5],[5,-5],[-5,5],[-5,-5]]){const w=cyl(2.6,2.6,2,0x222222);w.rotation.x=Math.PI/2;w.position.set(x,2.6,z);g.add(w);}}
 else if(k==='tank'||k==='titan'){b=box(24,7,16,t.d);b.position.y=5;g.add(b);const tu=new THREE.Group();tu.position.y=11;g.add(tu);const tt=box(12,6,10,t.m);tu.add(tt);const br=cyl(1.3,1.3,16,0x2A2E33);br.rotation.z=Math.PI/2;br.position.x=12;tu.add(br);g.userData.tur=tu;
  for(const s of [-1,1]){const tr=box(26,5,4,0x2A2A2A);tr.position.set(0,3,s*8);g.add(tr);}if(k==='titan')g.scale.setScalar(2.4);}
 else if(k==='heli'){b=ball(1,t.m,1);b.scale.set(10,6,6);g.add(b);const tl=box(16,2,2,t.d);tl.position.x=-12;g.add(tl);const ro=box(40,0.6,2.4,0x222222);ro.position.y=7;g.add(ro);g.userData.rot=ro;}
 else if(k==='plane'){b=box(28,4,5,t.m);g.add(b);const w=box(9,1,34,t.d);g.add(w);const tw=box(5,1,12,t.d);tw.position.x=-12;g.add(tw);const fin=box(5,7,1,t.d);fin.position.set(-12,4,0);g.add(fin);}
 return g;}
function mkHarv(si){const g=new THREE.Group(),t=team(si);const b=box(20,9,12,t.m);b.position.y=6;g.add(b);const c=box(7,9,12,0xF2C232);c.position.set(12,6,0);g.add(c);
 for(const [x,z] of [[8,6],[8,-6],[-6,6],[-6,-6]]){const w=cyl(3,3,2,0x222222);w.rotation.x=Math.PI/2;w.position.set(x,3,z);g.add(w);}return g;}
function mkTower(k,si,lv){const g=new THREE.Group(),t=team(si);const b=box(28,7,28,0x8D8679);b.position.y=3.5;g.add(b);const tu=new THREE.Group();tu.position.y=7;g.add(tu);g.userData.tur=tu;
 if(k==='mg'){const h=box(12,9,12,t.m);h.position.y=4.5;tu.add(h);for(const s of [-2.5,2.5]){const br=cyl(0.9,0.9,14,0x222222);br.rotation.z=Math.PI/2;br.position.set(10,6,s);tu.add(br);}}
 else if(k==='can'){const h=cyl(8,9,9,t.m,10);h.position.y=4.5;tu.add(h);const br=cyl(2,2.2,20,0x2A2E33);br.rotation.z=Math.PI/2;br.position.set(14,6,0);tu.add(br);}
 else if(k==='tes'){const m=cyl(1.8,2.4,18,0x555555);m.position.y=9;tu.add(m);const d=cyl(11,3,4,t.l,12);d.position.y=19;d.rotation.z=0.5;tu.add(d);g.userData.spin=1;}
 else{const h=box(14,8,16,t.m);h.position.y=5;tu.add(h);for(const [y,z] of [[3.5,-4],[3.5,4],[7,-4],[7,4]]){const c=cyl(1.6,1.6,10,0xDDDDDD,6);c.rotation.z=Math.PI/2;c.position.set(8,y,z);tu.add(c);}}
 g.scale.setScalar(1+0.07*(lv-1));if(lv>=5){const r=box(30,1.5,30,0xF2C232);r.position.y=7.5;g.add(r);}return g;}
const live=new Map();                  // key → {o,seen}
function sync(key,make,place){let e=live.get(key);if(!e){e={o:make()};dyn.add(e.o);live.set(key,e);}e.seen=FR;place(e.o);return e.o;}
let FR=0;const prev=new Map();
function syncAll(t){FR++;const V=viewW;if(!V)return;
 for(const si of [0,1]){const S=V.sides[si];if(!S)continue;
  for(const tw of S.towers){sync('t'+tw.id+'_'+tw.lv,()=>mkTower(tw.k,si,tw.lv),o=>{o.position.set(WX(si,tw.x),0,tw.y);const a=tw._aim!=null?tw._aim:WA(si,tw.a||0);o.userData.tur.rotation.y=o.userData.spin?t*2:rotY(a);});}
  for(const u of S.units){if(u.dead)continue;const p=uat(u,u.d),x=WX(si,p[0]),z=p[1],air=isAir(u);
   sync('u'+u.id,()=>mkUnit(u.k,u.o),o=>{const q=prev.get(u.id);let a=o.userData.a||0;if(q){const dx=x-q[0],dz=z-q[1];if(dx*dx+dz*dz>0.04)a=Math.atan2(dz,dx);}o.userData.a=a;prev.set(u.id,[x,z]);
    o.position.set(x,air?ALT[u.k]+Math.sin(t*2+u.id)*1.5:hgt(x,z),z);o.rotation.y=rotY(a);if(o.userData.rot)o.userData.rot.rotation.y=t*25;if(o.userData.tur&&u.ga!=null)o.userData.tur.rotation.y=-(WA(si,u.ga)-a);});}
  for(const h of S.hv){const p=hat(h.dd??h.d),x=WX(si,p[0]),z=p[1];sync('h'+h.id,()=>mkHarv(si),o=>{const q=prev.get('h'+h.id);let a=o.userData.a||0;if(q){const dx=x-q[0],dz=z-q[1];if(dx*dx+dz*dz>0.01)a=Math.atan2(dz,dx);}o.userData.a=a;prev.set('h'+h.id,[x,z]);o.position.set(x,0,z);o.rotation.y=rotY(a);});}
  for(const r of S.rockets||[]){sync('r'+si+'_'+r.tid+'_'+r.u,()=>{const m=ball(2.2,0xFFB040);return m;},o=>{const x=WX(si,r.x),z=r.y;o.position.set(x,14+30*Math.sin(Math.PI*Math.min(1,r.k||0)),z);});}
  const fx=FX[si]||[];for(const f of fx){if(f.k!=='boom')continue;if(!f._id)f._id=++BID;sync('b'+f._id,()=>{const m=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshBasicMaterial({color:0xFFA030,transparent:true}));return m;},o=>{const k=1-f.life/f.max,r=(f.big?(f.huge?30:18):9)*(f.m||1)*(0.35+k);o.position.set(WX(si,f.x),r*0.5,f.y);o.scale.setScalar(r);o.material.opacity=Math.max(0,1-k);o.material.color.setHex(k<0.3?0xFFE070:0xFF7A20);});}}
 for(const s of shells)sync('s'+s.id,()=>ball(2.4,0xFFE89A),o=>o.position.set(s.x,s.y,s.z));
 for(const b of booms)sync('B'+b.id,()=>new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshBasicMaterial({color:0xFFA030,transparent:true})),o=>{const k=b.t/b.max,r=b.r*(0.3+k);o.position.set(b.x,b.y+r*0.4,b.z);o.scale.setScalar(r);o.material.opacity=1-k;});
 for(const tr of tracers)sync('T'+tr.id,()=>{const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);return new THREE.Line(g,new THREE.LineBasicMaterial({color:0xFFE070}));},o=>{const a=o.geometry.attributes.position;a.setXYZ(0,tr.a[0],tr.a[1],tr.a[2]);a.setXYZ(1,tr.b[0],tr.b[1],tr.b[2]);a.needsUpdate=true;});
 for(const [k,e] of live)if(e.seen!==FR){dyn.remove(e.o);e.o.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material&&o.material.transparent)o.material.dispose();});live.delete(k);}}
let BID=0;

/* ---------- the player's Titan ---------- */
const shells=[],booms=[],tracers=[];let SID=0;
const cock=new THREE.Group();cam.add(cock);
{const br=cyl(2.2,2.6,40,0x2A2E33,10);br.rotation.x=Math.PI/2;br.position.set(0,-7,-26);cock.add(br);
 const mz=cyl(3.2,3.2,5,0x1A1E22,10);mz.rotation.x=Math.PI/2;mz.position.set(0,-7,-46);cock.add(mz);
}
function spawn(){const [hx,hy]=hqPos();P.x=WX(me,hx+70);P.z=hy+(hy<200?60:-60);P.yaw=0;P.pitch=-0.06;P.hp=P.max;P.move=false;P.dead=0;}
const enemyTowers=()=>{const S=W.sides[1-me];return S?S.towers:[];};
function blockers(){const o=[];const [hx,hy]=hqPos(),rr=baseRects()[1];for(const si of [0,1]){o.push([WX(si,hx),hy,48]);if(rr)o.push([WX(si,rr.x+rr.w/2),rr.y+rr.h/2,Math.max(rr.w,rr.h)/2]);for(const f of FIELDS)if(!f.gone)o.push([WX(si,f.x),f.y,42]);for(const tw of W.sides[si].towers)o.push([WX(si,tw.x),tw.y,20]);}return o;}
function stepTitan(dt){if(P.dead>0){P.dead-=dt;if(P.dead<=0)spawn();return;}
 P.cd=Math.max(0,P.cd-dt);
 if(P.move){const v=TITAN_SP*dt;P.x+=Math.cos(P.yaw)*v;P.z+=Math.sin(P.yaw)*v;}
 for(const [bx,bz,r] of blockers()){const dx=P.x-bx,dz=P.z-bz,d=Math.hypot(dx,dz),R_=r+16;if(d<R_&&d>0.01){P.x=bx+dx/d*R_;P.z=bz+dz/d*R_;}}
 P.x=Math.max(10,Math.min(FW-10,P.x));P.z=Math.max(12,Math.min(392,P.z));
 if(P.hold&&P.cd<=0)fire();
 /* enemy towers in range shoot the Titan */
 const S=W.sides[1-me];for(const tw of S.towers){tw._aim=null;const x=WX(1-me,tw.x),R_=TW[tw.k].range*lvR(tw.k,tw.lv-1),d=Math.hypot(x-P.x,tw.y-P.z);if(d>R_)continue;
  const mult=(tw.k==='can'?CAN_LVM:tw.k==='mg'?MG_LVM:LVM)[tw.lv-1],dps=TW[tw.k].dmg*mult/(TW[tw.k].cd*LVC[tw.lv-1])*(tw.k==='tes'?0.6:1)*(S.twK||1);
  P.hp-=dps*dt*0.5;tw._aim=Math.atan2(P.z-tw.y,P.x-x);tw._t=(tw._t||0)-dt;if(tw._t<=0){tw._t=tw.k==='mg'?0.18:0.8;tracers.push({id:++SID,a:[x,14,tw.y],b:[P.x,10,P.z],t:0.07});}}
 if(P.hp<=0){P.hp=0;P.dead=RESPAWN;P.move=false;P.hold=false;W.sides[1-me].ore+=TITAN_BOUNTY;booms.push({id:++SID,x:P.x,y:0,z:P.z,r:40,t:0,max:0.9});HUD.msg('Титан уничтожен — возрождение через 5 с');}}
const ray=new THREE.Raycaster();
function fire(){if(P.dead>0||P.cd>0)return;P.cd=SHOT_CD;
 cam.updateMatrixWorld();const o=new THREE.Vector3(),d=new THREE.Vector3();cam.getWorldPosition(o);cam.getWorldDirection(d);
 let hit=null;ray.set(o,d);ray.far=700;
 const tg=[];for(const [k,e] of live){const c=k[0];if(c==='t'||c==='h'||c==='u')tg.push(e.o);}
 const hs=ray.intersectObjects(tg,true);if(hs.length)hit=hs[0].point;
 if(!hit){if(d.y<-0.01){const t=-(o.y-0)/d.y;if(t<700)hit=o.clone().addScaledVector(d,t);}if(!hit)hit=o.clone().addScaledVector(d,520);hit.y=Math.max(0,hit.y);}
 const st=new THREE.Vector3(0,-7,-48);cock.localToWorld(st);
 const L=st.distanceTo(hit);shells.push({id:++SID,x:st.x,y:st.y,z:st.z,sx:st.x,sy:st.y,sz:st.z,tx:hit.x,ty:hit.y,tz:hit.z,t:0,T:Math.max(0.05,L/SHOT_V)});
 HUD.kick();try{SFX&&SFX.click&&SFX.click();}catch(_){}}
function impact(x,y,z){window.__lastImp=[x|0,y|0,z|0];booms.push({id:++SID,x,y:Math.max(0,y-6),z,r:26,t:0,max:0.5});
 const R_=SHOT_R;
 /* enemy ground units on our field */
 /* enemy ground units on either field (on their own field they are still driving out); the reward is always ours */
 for(const fs of [me,1-me]){const F=W.sides[fs];for(const u of F.units.slice()){if(u.dead||u.o===me||isAir(u))continue;const p=uat(u,u.d),d=Math.hypot(WX(fs,p[0])-x,p[1]-z);if(d>=R_)continue;
  const o0=F.ore;damageUnit(fs,u,SHOT_DMG*(d<R_*0.5?1:0.6));if(fs!==me){const g=F.ore-o0;if(g>0){F.ore-=g;W.sides[me].ore+=g;}}}}
 /* the enemy field: towers (three hits each, as the Titan does), harvesters, the base */
 const se=1-me,Se=W.sides[se];
 for(const tw of Se.towers.slice()){const d=Math.hypot(WX(se,tw.x)-x,tw.y-z);if(d<R_*0.5+16){tw.th=(tw.th|0)+1;if(tw.th>=TITAN_TW_HITS){Se.towers.splice(Se.towers.indexOf(tw),1);padHold(se,tw.s);ev({e:'boom',s:se,x:tw.x|0,y:tw.y|0,b:2});ev({e:'twdie',s:se,x:tw.x|0,y:tw.y|0});}}}
 for(const h of Se.hv.slice()){const p=hat(h.dd??h.d),d=Math.hypot(WX(se,p[0])-x,p[1]-z);if(d<R_)hurtHarv(se,h,SHOT_DMG);}
 const [hx,hy]=hqPos();if(Math.hypot(WX(se,hx)-x,hy-z)<52){Se.lives=Math.max(0,Se.lives-1);Se.lastHit='titan';Se.breachT=W.t;ev({e:'boom',s:se,x:hx|0,y:hy|0,b:2});}}
function stepFx3(dt){for(let i=shells.length-1;i>=0;i--){const s=shells[i];s.t+=dt;const k=Math.min(1,s.t/s.T);s.x=s.sx+(s.tx-s.sx)*k;s.z=s.sz+(s.tz-s.sz)*k;s.y=s.sy+(s.ty-s.sy)*k+Math.sin(Math.PI*k)*Math.min(12,s.T*20);if(k>=1){shells.splice(i,1);impact(s.tx,s.ty,s.tz);}}
 for(let i=booms.length-1;i>=0;i--){booms[i].t+=dt;if(booms[i].t>=booms[i].max)booms.splice(i,1);}
 for(let i=tracers.length-1;i>=0;i--){tracers[i].t-=dt;if(tracers[i].t<=0)tracers.splice(i,1);}}

/* ---------- HUD ---------- */
const css=document.createElement('style');css.textContent=`
#h3{position:fixed;inset:0;z-index:21;pointer-events:none;display:none;font:800 14px 'Rubik',system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px #000}
#h3 .b{pointer-events:auto;position:absolute;border:2px solid #0C120B;border-radius:14px;background:rgba(30,40,28,.82);color:#fff;font:800 14px 'Rubik',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;user-select:none;-webkit-user-select:none;touch-action:none}
#h3 .b:active{transform:translateY(2px)}
#h3 .fire{right:max(18px,env(safe-area-inset-right));bottom:22px;width:92px;height:92px;border-radius:50%;background:radial-gradient(#E0503A,#9E1E1E);font-size:15px}
#h3 .go{left:max(18px,env(safe-area-inset-left));bottom:22px;width:104px;height:64px;font-size:16px}
#h3 .go.on{background:linear-gradient(#5CB85C,#2E7D32)}
#h3 .map{right:max(14px,env(safe-area-inset-right));top:12px;padding:0 14px;height:40px}
#h3 .units{position:absolute;top:12px;left:50%;transform:translateX(-50%);display:flex;gap:6px}
#h3 .units .b{position:static;width:58px;height:40px;font-size:12px;flex-direction:column;line-height:1.1}
#h3 .units .b.dis{opacity:.45}
#h3 .stat{position:absolute;left:max(14px,env(safe-area-inset-left));top:10px;background:rgba(20,28,18,.7);border-radius:12px;padding:6px 12px;line-height:1.35}
#h3 .xh{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border:2px solid rgba(255,255,255,.85);border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,.4)}
#h3 .xh:before,#h3 .xh:after{content:'';position:absolute;background:rgba(255,255,255,.9)}
#h3 .xh:before{left:50%;top:-12px;width:2px;height:70px;margin-left:-1px;background:linear-gradient(rgba(255,255,255,.9) 0 14px,transparent 14px 56px,rgba(255,255,255,.9) 56px)}
#h3 .xh:after{top:50%;left:-12px;height:2px;width:70px;margin-top:-1px;background:linear-gradient(90deg,rgba(255,255,255,.9) 0 14px,transparent 14px 56px,rgba(255,255,255,.9) 56px)}
#h3 .hp{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);width:min(320px,40vw);height:14px;border:2px solid #0C120B;border-radius:8px;background:#3A2A2A;overflow:hidden}
#h3 .hp i{display:block;height:100%;background:linear-gradient(#8FE07A,#3E9E2E)}
#h3 .rl{position:absolute;left:50%;bottom:36px;transform:translateX(-50%);font-size:12px;opacity:.9}
#h3 .fps{position:absolute;right:max(14px,env(safe-area-inset-right));top:58px;font-size:11px;opacity:.75}
#h3 .msg{position:absolute;left:50%;top:30%;transform:translateX(-50%);background:rgba(20,28,18,.8);border-radius:12px;padding:8px 16px;font-size:16px;display:none}
#h3 .frame{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,transparent 58%,rgba(10,14,10,.55) 100%)}
#b2d{position:fixed;z-index:22;left:50%;top:8px;transform:translateX(-50%);display:none;border:2px solid #0C120B;border-radius:12px;background:linear-gradient(#F2C232,#C99A1A);color:#1C2416;font:900 14px 'Rubik',system-ui,sans-serif;padding:8px 16px}
#tag3d{position:fixed;z-index:30;left:50%;top:6px;transform:translateX(-50%);background:#F2C232;color:#1C2416;border-radius:10px;padding:4px 12px;font:900 13px 'Rubik',system-ui,sans-serif;pointer-events:none}`;
document.head.appendChild(css);
const H=document.createElement('div');H.id='h3';H.innerHTML=`<div class="frame"></div><div class="xh"></div>
<div class="stat"><div class="s1"></div><div class="s2" style="font-size:12px;opacity:.85"></div></div>
<div class="units"></div><div class="b map">Карта</div><div class="fps"></div>
<div class="b go">Старт</div><div class="b fire">Огонь</div><div class="hp"><i></i></div><div class="rl"></div><div class="msg"></div>`;
document.body.appendChild(H);
const b2=document.createElement('button');b2.id='b2d';b2.textContent='◀ В кабину Титана';document.body.appendChild(b2);
const tag=document.createElement('div');tag.id='tag3d';tag.textContent='3D-прототип · нажми «Играть»';document.body.appendChild(tag);
const q=s=>H.querySelector(s);
const UK=[['inf','Пехота'],['jeep','Джип'],['tank','Танк'],['heli','Верт.']];
q('.units').innerHTML=UK.map(([k,n])=>`<div class="b" data-k="${k}">${n}<span></span></div>`).join('');
const HUD={msgT:0,msg(s){const m=q('.msg');m.textContent=s;m.style.display='block';this.msgT=2.5;},kick(){this.k=0.12;},k:0,
 upd(dt){const S=W.sides[me],E=W.sides[1-me];q('.s1').innerHTML=`❤ ${S.lives} &nbsp; 💎 ${Math.floor(S.ore)}`;q('.s2').innerHTML=`Соперник: ❤ ${E.lives}`;
  q('.hp i').style.width=(100*P.hp/P.max).toFixed(1)+'%';q('.rl').textContent=P.dead>0?'возрождение '+Math.ceil(P.dead)+' с':P.cd>0?'перезарядка '+P.cd.toFixed(1):'готов';
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

function size(){const w=innerWidth,h=innerHeight;R.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();}
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
 stepTitan(sdt);stepFx3(sdt);
 const t=now_/1000;syncAll(t);
 const y=hgt(P.x,P.z)+(P.dead>0?60:24);cam.position.set(P.x,y,P.z);
 const lp=P.pitch+(HUD.k>0?HUD.k*0.25:0);cam.lookAt(P.x+Math.cos(P.yaw)*Math.cos(lp)*100,y+Math.sin(lp)*100,P.z+Math.sin(P.yaw)*Math.cos(lp)*100);
 const fov=P.fov/P.zoom;if(Math.abs(cam.fov-fov)>0.01){cam.fov=fov;cam.updateProjectionMatrix();}cock.visible=P.dead<=0&&P.zoom<1.6;
 HUD.upd(dt);R.render(scene,cam);
 /* hold the frame rate: lower the resolution step by step when it drops, raise it back when there's room */
 T3.fpsN++;T3.fpsT+=dt;if(T3.fpsT>=2){T3.fps=T3.fpsN/T3.fpsT;T3.fpsN=0;T3.fpsT=0;let nq=T3.q;if(T3.fps<40&&T3.q>0.55)nq=Math.max(0.55,T3.q-0.15);else if(T3.fps>57&&T3.q<Math.min(2,devicePixelRatio||1))nq=Math.min(devicePixelRatio||1,T3.q+0.1);
  if(nq!==T3.q){T3.q=nq;R.setPixelRatio(nq);size();try{localStorage.setItem('dvebazy-3dq',''+nq);}catch(_){}}}}
requestAnimationFrame(loop);
window.__t3={P,T3,fire,build,shells,booms,get live(){return live;}};
})();
