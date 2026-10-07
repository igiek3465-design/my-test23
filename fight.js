// Sword Arena - built-in test game (play.html?g=testgame). Hooks are called from play.html.
window.FIGHT=(()=>{
const GOLD=[.96,.66,.1],GOLD2=[.8,.5,.08],PB=[.31,.11,.05],OR=[.93,.45,.1],OL=[.55,.6,.17],GR=[.2,.65,.25],DK=[.12,.05,.03];
// fits Sword.obj into the hand: blade axis -> +Z, grip at origin, ~5.5 studs long
const SWM=[-1.1121,-0.0939,0.5847,0,0.5364,-0.6868,0.91,0,0.2509,1.0522,0.6462,0,-24.4877,18.5032,26.8742,1];
const F={on:false,sc:0,sw0:null,hitAt:0,cool:0,last:null,hits:[],dead:false,by:'',es:-1,dm:[],spawns:[],sw:null};
const esc=s=>String(s).replace(/[&<>"']/g,'');
const ang=s=>{if(s==null)return -1.3;const u=(t-s)/.4;if(u>=1)return -1.3;if(u<.2)return -1.3-1.4*(u/.2);if(u<.55)return -2.7+2.3*((u-.2)/.35);return -.4-.9*((u-.55)/.45)};
const proj=(x,y,z)=>{const c=[0,1,2,3].map(r=>VPm[r]*x+VPm[4+r]*y+VPm[8+r]*z+VPm[12+r]);return c[3]<=0?null:[(c[0]/c[3]*.5+.5)*innerWidth,(1-(c[1]/c[3]*.5+.5))*innerHeight]};
const bar=(x,y,z,f)=>{const p=proj(x,y,z);if(!p)return;cx.fillStyle='#000';cx.fillRect(p[0]-26,p[1]-3,52,6);cx.fillStyle=f>.5?'#3c3':f>.25?'#dd3':'#d33';cx.fillRect(p[0]-25,p[1]-2,50*Math.max(0,f),4)};

function build(){const a=[],sp=[],I=[1,0,0,0,1,0,0,0,1];
 const K=1.8,B=(x,y,z,sx,sy,sz,C,cc)=>a.push({S:[sx*K,sy*K,sz*K],R:I,P:[x*K,y*K,z*K],C,Tr:0,cc:cc!==false,an:true});
 const pil=(x,z,w,top,C)=>B(x,top/2,z,w,top,w,C||PB);
 const pad=(x,z,top)=>{B(x,top+.25,z,7,.5,7,GR);sp.push([x*K,(top+.5)*K+3,z*K])};
 // central gold platform with studded rim and cover pillars
 B(0,58,0,56,4,56,GOLD);B(0,60.2,0,48,.4,48,GOLD2,false);
 for(let i=-13;i<=13;i++)for(const e of[-27,27]){B(i*2,60.7,e,1,1.4,1,DK,false);B(e,60.7,i*2,1,1.4,1,DK,false)}
 for(const x of[-18,18])for(const z of[-18,18])B(x,67,z,5,14,5,PB);
 // spawn pillars (west, north, south) with green pads
 pil(-85,0,26,60);pad(-85,0,60);pil(0,-85,26,60);pad(0,-85,60);pil(0,85,26,60);pad(0,85,60);
 // east stepped pyramid + gold stairs down from the platform
 pil(72,0,48,36);B(72,39,0,36,6,36,PB);B(72,45,0,24,6,24,PB);pad(72,0,48);
 for(let i=0;i<13;i++)B(29.25+i*2.5,59-i-1.5,0,2.5,3,8,i%2?GOLD2:GOLD);
 // west checker field, north tile bridge, south gold bridge
 for(let i=0;i<6;i++)for(let j=-1;j<=1;j++)B(-32-i*8,59.5,j*8,8,1,8,(i+j)%2?OR:OL);
 for(let i=0;i<5;i++)B(0,59.5,-32-i*10,6,1,9.5,OR);
 B(0,59.5,50,8,1,44,GOLD2);B(-4.5,61,50,.5,1,44,DK,false);B(4.5,61,50,.5,1,44,DK,false);
 // tall backdrop pillars + thin rails
 for(const x of[-60,60])for(const z of[-60,60])pil(x,z,22,92);
 for(const z of[-60,60])B(0,80,z,120,.6,.6,DK,false);for(const x of[-60,60])B(x,80,0,.6,.6,120,DK,false);
 a.push({S:[1800,1,1800],R:I,P:[0,-.5,0],C:[.62,.62,.64],Tr:0,cc:true,an:true});
 return{parts:a,spawns:sp}}

Object.assign(F,{
 tex(v){if(F.texOK)gl.uniform1f(F.uUT,v)},
 sk(n){if(!F.skin)return null;const on=!n||n===U?F.skinSel:(others[n]&&others[n].t?others[n].t[9]:0);return on?F.skin:null},
 skinDraw(base,t,walk,air,ra,k){const arm=air?3:Math.sin(t*10)*.9*walk,leg=Math.sin(t*10)*.9*walk,c=k.c;
  box(M.mul(base,M.mul(M.T(0,3,0),M.S(2,2,1))),c.t);box(M.mul(base,M.mul(M.T(0,4.5,0),M.S(1.25,1,1.25))),c.h);
  [-.25,.25].forEach(x=>box(M.mul(base,M.mul(M.T(x,4.6,.64),M.S(.14,.22,.04))),[0,0,0]));box(M.mul(base,M.mul(M.T(0,4.25,.64),M.S(.5,.08,.04))),[0,0,0]);
  [[-1.5,4,1,c.ra],[1.5,4,-1,c.la]].forEach(([x,y,s,C])=>box(M.mul(base,M.mul(M.T(x,y,0),M.mul(M.RX(ra!=null&&s===1?ra:arm*s),M.mul(M.T(0,-1,0),M.S(1,2,1))))),C));
  [[-.5,2,1,c.rl],[.5,2,-1,c.ll]].forEach(([x,y,s,C])=>box(M.mul(base,M.mul(M.T(x,y,0),M.mul(M.RX(leg*s),M.mul(M.T(0,-1,0),M.S(1,2,1))))),C));return true},
 ui(){const sel=document.getElementById('m_skin');F.skinSel=+(localStorage.getItem('rbx_skin')||0);
  if(sel){sel.value=F.skinSel;sel.onchange=()=>{F.skinSel=+sel.value;try{localStorage.setItem('rbx_skin',sel.value)}catch(e){}}}
  fetch('/character.rbxm').then(r=>r.text()).then(x=>{const d=new DOMParser().parseFromString(x,'text/xml'),c={},nm={Head:'h',Torso:'t','Left Arm':'la','Right Arm':'ra','Left Leg':'ll','Right Leg':'rl'},
   BCT={194:[.64,.64,.65],1:[.95,.95,.95],26:[.1,.1,.11],21:[.77,.16,.11],23:[.05,.41,.67],24:[.99,.8,.04],28:[.3,.59,.3],106:[.85,.52,.26],199:[.39,.37,.38],192:[.41,.25,.15],5:[.84,.77,.6],9:[.91,.73,.78]};
   d.querySelectorAll('Item[class="Part"]').forEach(it=>{const n=it.querySelector('string[name="Name"]'),k=n&&nm[n.textContent];if(!k)return;
    const p=it.querySelector('int[name="BrickColor"]'),u=it.querySelector('Color3uint8');let col=BCT[p?+p.textContent:0]||[.64,.64,.65];
    if(u){const v=+u.textContent;col=[(v>>16&255)/255,(v>>8&255)/255,(v&255)/255]}c[k]=col});
   if(Object.keys(c).length){for(const k of['h','t','la','ra','ll','rl'])c[k]=c[k]||[.64,.64,.65];F.skin={c}}}).catch(()=>{})},
 load(){F.on=true;const b=build();F.spawns=b.spawns;const ws=new Inst('Workspace','Workspace'),all=[ws];
  for(const q of b.parts){const i=new Inst('Part','Part');i.q=q;q.inst=i;i.par=ws;ws.kids.push(i);all.push(i);addPart(q)}
  const tl=new Inst('Tool','Sword');tools=[tl];buildHot();spawn=F.pick();
  F.dm=[];
  gl.clearColor(0,0,0,0);{const tx=gl.createTexture(),ti=new Image();ti.onload=()=>{gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,tx);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,ti);[gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T].forEach(x=>gl.texParameteri(gl.TEXTURE_2D,x,gl.REPEAT));gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.activeTexture(gl.TEXTURE0);gl.useProgram(pr);F.uUT=gl.getUniformLocation(pr,'uUT');gl.uniform1i(gl.getUniformLocation(pr,'uT'),1);F.texOK=1};ti.src='/grid2.png'}document.body.style.background='linear-gradient(#e0481a,#f08a2c 45%,#ffe27a)';
  document.getElementById('hud').innerHTML='WASD move &middot; Space jump &middot; <b>1</b> equip Sword &middot; <b>Click</b> swing &middot; Right-drag camera';
  const lb=F.lb=document.createElement('div');lb.style.cssText='position:fixed;right:10px;top:40px;min-width:150px;color:#fff;font:12px Arial;text-shadow:1px 1px 2px #000;background:rgba(0,0,0,.35);padding:4px 6px;text-align:left';document.body.appendChild(lb);
  fetch('/Sword.obj').then(r=>r.text()).then(txt=>{const m=objMesh(txt),mk=a=>{const x=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,x);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(a),gl.STATIC_DRAW);return x};
   const s=F.sw={bp:mk(m.P),bu:mk(m.U),n:m.P.length/3,tex:null},im=new Image();
   im.onload=()=>{const t2=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t2);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);[gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T].forEach(x=>gl.texParameteri(gl.TEXTURE_2D,x,gl.CLAMP_TO_EDGE));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);s.tex=t2};im.src='/Handle1_diff.png'}).catch(()=>{});
  addChat('ROBLOX','Sword Arena - press 1 to equip the Sword, click to swing. Fight the other players! Falling onto the baseplate kills you.');
  setTimeout(()=>equip(0),1900);return{all,ws}},
 pick(){return F.spawns[Math.random()*F.spawns.length|0].slice()},
 pp(){return[F.on&&eq===tools[0]?1:0,F.sc,Math.max(0,Hum.v.Health),F.skinSel||0]},
 pack(){const o={h:F.hits,d:F.dead?1:0,by:F.by,es:F.es};F.hits=[];F.dead=false;F.by='';return o},
 ra(n){if(!F.on)return null;if(!n||n===U)return eq===tools[0]?ang(F.sw0):null;const o=others[n];return o&&o.t&&o.t[6]===1?ang(o.sw0):null},
 swing(){if(!F.on||eq!==tools[0]||t<F.cool)return;F.cool=t+.45;F.sw0=t;F.sc++;F.hitAt=t+.14;P.h=yaw+Math.PI},
 died(){F.dead=true;F.by=F.last&&t-F.last.t<10?F.last.by:'';F.last=null;setTimeout(()=>{if(eq!==tools[0])equip(0)},150)},
 recv(r){F.fly=!!r.fly;if(r.kick&&!F.kicked){F.kicked=1;alert(r.banned?"You are banned.":"You were kicked from this server.");location.href="/";return}if(!F.on)return;if(F.es<0){F.es=r.en||0}else for(const e of(r.ev||[])){F.es=Math.max(F.es,e[0]);if(e[2]!==U)continue;Hum.v.Health-=e[3];F.last={by:e[1],t};P.vy=Math.max(P.vy,20);
   const o=others[e[1]];if(o){const dx=P.x-o.x,dz=P.z-o.z,l=Math.hypot(dx,dz)||1,nx=P.x+dx/l*3,nz=P.z+dz/l*3;if(!blocked(nx,P.z,P.y))P.x=nx;if(!blocked(P.x,nz,P.y))P.z=nz}}
  if(r.sc){const here=new Set([U,...Object.keys(others)]);F.lb.innerHTML='<b>Kills / Deaths</b>'+Object.entries(r.sc).filter(([n])=>here.has(n)).sort((a,b)=>b[1][0]-a[1][0]).slice(0,8).map(([n,v])=>'<div>'+esc(n)+' &nbsp; '+v[0]+' / '+v[1]+'</div>').join('')}},
 draw(dt){if(!F.on||!VPm)return;if(Hum.v.Health>0&&P.y<.8)Hum.v.Health=0;
  if(F.hitAt&&t>=F.hitAt){F.hitAt=0;const fx=Math.sin(P.h),fz=Math.cos(P.h),ok=(x,y,z)=>{const dx=x-P.x,dz=z-P.z,d=Math.hypot(dx,dz);return d<7.5&&Math.abs(y-P.y)<6&&(d<2.5||(dx*fx+dz*fz)/d>.25)};
   for(const k in others){const o=others[k];if(ok(o.x,o.y,o.z))F.hits.push([k,25])}
   for(const d of F.dm)if(!d.dead&&ok(d.x,d.y,d.z)){d.hp-=25;if(d.hp<=0)d.dead=t+3}}
  for(const d of F.dm){if(d.dead){if(t>d.dead){d.dead=0;d.hp=100}continue}
   d.h=Math.atan2(P.x-d.x,P.z-d.z);avatar(M.mul(M.T(d.x,d.y,d.z),M.RY(d.h)),t,0,0,'Dummy',null);bar(d.x,d.y+6,d.z,d.hp/100)}
  const L=[],hold=eq===tools[0],sk=F.skin&&F.skinSel?F.skin.c:null;
  if(dist>=2){if(hold)L.push([M.mul(M.T(P.x,P.y,P.z),M.RY(P.h)),ang(F.sw0),-1.5])}
  else{const Bm=M.mul(M.T(P.x,P.y,P.z),M.RY(P.h)),pt=clamp(pit,-1,1),ar=hold?ang(F.sw0)+pt*.9:-.3+pt*.3;
   for(const[x,a,C]of[[-1.1,ar,sk?sk.ra:[.1,.1,.11]],[1.1,-.4+pt*.3,sk?sk.la:[.1,.1,.11]]])box(M.mul(Bm,M.mul(M.T(x,4,0),M.mul(M.RX(a),M.mul(M.T(0,-1,0),M.S(1,2,1))))),C);
   if(hold)L.push([Bm,ar,-1.1])}
  for(const k in others){const o=others[k];if(!o.t)continue;if(o.t[7]!==o.lsc){if(o.lsc!==undefined)o.sw0=t;o.lsc=o.t[7]}
   if(o.t[6]===1)L.push([M.mul(M.T(o.x,o.y,o.z),M.RY(o.h)),ang(o.sw0),-1.5]);bar(o.x,o.y+6.4,o.z,(o.t[8]==null?100:o.t[8])/100)}
  const s=F.sw;if(s&&s.tex&&L.length){gl.useProgram(pr2);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.uniformMatrix4fv(gl.getUniformLocation(pr2,'uV'),false,VPm);gl.uniform1f(gl.getUniformLocation(pr2,'uH'),1);gl.bindTexture(gl.TEXTURE_2D,s.tex);
   [['aP',s.bp,3],['aU',s.bu,2]].forEach(([nm,b,z])=>{gl.bindBuffer(gl.ARRAY_BUFFER,b);const l=gl.getAttribLocation(pr2,nm);gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,z,gl.FLOAT,false,0,0)});
   for(const[Bm,a,sx]of L){const hand=M.mul(Bm,M.mul(M.T(sx,4,0),M.mul(M.RX(a),M.T(0,-2,0))));gl.uniformMatrix4fv(gl.getUniformLocation(pr2,'uM'),false,M.mul(hand,SWM));gl.drawArrays(gl.TRIANGLES,0,s.n)}
   gl.disable(gl.BLEND);gl.useProgram(pr);[['aP',bufP],['aN',bufN]].forEach(([nm,b])=>{gl.bindBuffer(gl.ARRAY_BUFFER,b);const l=gl.getAttribLocation(pr,nm);gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,3,gl.FLOAT,false,0,0)})}}
});
return F})();
