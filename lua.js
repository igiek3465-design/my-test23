// Compact Lua 5.1 subset interpreter (async, so wait() works). Used by play.html for place scripts.
(function(G){
const KW=new Set('and break do else elseif end false for function if in local nil not or repeat return then true until while'.split(' '));
function lex(s){const T=[],n=s.length;let i=0,L=1;
 while(i<n){const c=s[i];
  if(c==='\n'){L++;i++;continue}
  if(/\s/.test(c)){i++;continue}
  if(s.startsWith('--',i)){const m=/^--\[(=*)\[/.exec(s.slice(i,i+40));if(m){const e=']'+m[1]+']',j=s.indexOf(e,i),k=j<0?n:j+e.length;L+=(s.slice(i,k).match(/\n/g)||[]).length;i=k}else while(i<n&&s[i]!=='\n')i++;continue}
  let m=/^\[(=*)\[/.exec(s.slice(i,i+40));
  if(m){const e=']'+m[1]+']';let j=s.indexOf(e,i+m[0].length);if(j<0)j=n;let v=s.slice(i+m[0].length,j);if(v[0]==='\n')v=v.slice(1);L+=(s.slice(i,j).match(/\n/g)||[]).length;T.push({t:'s',v,L});i=j+e.length;continue}
  if(c==='"'||c==="'"){let j=i+1,v='';while(j<n&&s[j]!==c){if(s[j]==='\\'){j++;const e=s[j];v+=e==='n'?'\n':e==='t'?'\t':e==='r'?'\r':e}else v+=s[j];j++}T.push({t:'s',v,L});i=j+1;continue}
  m=/^(0[xX][0-9a-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)/.exec(s.slice(i,i+40));
  if(m){T.push({t:'n',v:Number(m[0]),L});i+=m[0].length;continue}
  m=/^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i,i+80));
  if(m){T.push({t:KW.has(m[0])?m[0]:'id',v:m[0],L});i+=m[0].length;continue}
  const o=['...','..','==','~=','<=','>=','//'].find(x=>s.startsWith(x,i))||c;T.push({t:o,L});i+=o.length}
 T.push({t:'eof',L});return T}
function parse(src){const T=lex(src);let p=0;const pk=()=>T[p],nx=()=>T[p++],ac=t=>T[p].t===t?(p++,true):false;
 const er=t=>new Error('line '+t.L+": unexpected '"+(t.v!==undefined?t.v:t.t)+"'");
 const ex=t=>{if(T[p].t!==t)throw er(T[p]);return T[p++]};
 const END=['end','else','elseif','until','eof'];
 function block(){const b=[];while(!END.includes(pk().t)){const s=stat();if(s)b.push(s);if(s&&s.k==='ret')break}return b}
 function fbody(m){ex('(');const ps=m?['self']:[];let va=false;if(pk().t!==')'){do{if(ac('...')){va=true;break}ps.push(ex('id').v)}while(ac(','))}ex(')');const b=block();ex('end');return{k:'fn',ps,va,b}}
 function stat(){const t=pk();switch(t.t){
  case';':p++;return null;
  case'if':{p++;const c=[];let e=expr();ex('then');c.push([e,block()]);let el=null;for(;;){if(ac('elseif')){e=expr();ex('then');c.push([e,block()])}else if(ac('else')){el=block();ex('end');break}else{ex('end');break}}return{k:'if',c,el}}
  case'while':{p++;const c=expr();ex('do');const b=block();ex('end');return{k:'while',c,b}}
  case'do':{p++;const b=block();ex('end');return{k:'do',b}}
  case'for':{p++;const n=ex('id').v;if(ac('=')){const a=expr();ex(',');const b=expr();const c=ac(',')?expr():null;ex('do');const bl=block();ex('end');return{k:'fornum',n,a,b,c,bl}}
   const ns=[n];while(ac(','))ns.push(ex('id').v);ex('in');const es=exprlist();ex('do');const bl=block();ex('end');return{k:'forin',ns,es,bl}}
  case'repeat':{p++;const b=block();ex('until');return{k:'repeat',b,c:expr()}}
  case'function':{p++;let tg={k:'name',v:ex('id').v},m=false;while(pk().t==='.'||pk().t===':'){const c=nx().t===':';tg={k:'idx',o:tg,i:{k:'str',v:ex('id').v}};if(c){m=true;break}}return{k:'set',ts:[tg],es:[fbody(m)]}}
  case'local':{p++;if(ac('function')){const n=ex('id').v;return{k:'local',ns:[n],es:[fbody(false)],rec:true}}const ns=[ex('id').v];while(ac(','))ns.push(ex('id').v);return{k:'local',ns,es:ac('=')?exprlist():[]}}
  case'return':{p++;const es=[...END,';'].includes(pk().t)?[]:exprlist();ac(';');return{k:'ret',es}}
  case'break':p++;return{k:'brk'};
  default:{const e=suffixed();if(pk().t==='='||pk().t===','){const ts=[e];while(ac(','))ts.push(suffixed());ex('=');return{k:'set',ts,es:exprlist()}}if(e.k!=='call'&&e.k!=='mcall')throw er(t);return{k:'expr',e}}}}
 const BIN={or:[1,1],and:[2,2],'<':[3,3],'>':[3,3],'<=':[3,3],'>=':[3,3],'~=':[3,3],'==':[3,3],'..':[5,4],'+':[6,6],'-':[6,6],'*':[7,7],'/':[7,7],'%':[7,7],'//':[7,7],'^':[10,9]};
 function expr(lim=0){let l;const t=pk().t;if(t==='not'||t==='-'||t==='#'){p++;l={k:'un',op:t,e:expr(8)}}else l=simple();for(;;){const o=pk().t,b=BIN[o];if(!b||b[0]<=lim)break;p++;l={k:'bin',op:o,l,r:expr(b[1])}}return l}
 function simple(){const t=pk();switch(t.t){case'n':p++;return{k:'num',v:t.v};case's':p++;return{k:'str',v:t.v};case'nil':p++;return{k:'nil'};case'true':p++;return{k:'bool',v:true};case'false':p++;return{k:'bool',v:false};case'...':p++;return{k:'va'};case'function':p++;return fbody(false);case'{':return table();default:return suffixed()}}
 function prim(){const t=pk();if(t.t==='id'){p++;return{k:'name',v:t.v}}if(t.t==='('){p++;const e=expr();ex(')');return{k:'paren',e}}throw er(t)}
 function suffixed(){let e=prim();for(;;){const t=pk().t;if(t==='.'){p++;e={k:'idx',o:e,i:{k:'str',v:ex('id').v}}}else if(t==='['){p++;const i=expr();ex(']');e={k:'idx',o:e,i}}else if(t===':'){p++;const n=ex('id').v;e={k:'mcall',o:e,n,a:args()}}else if(t==='('||t==='s'||t==='{')e={k:'call',f:e,a:args()};else return e}}
 function args(){const t=pk();if(t.t==='s'){p++;return[{k:'str',v:t.v}]}if(t.t==='{')return[table()];ex('(');const a=pk().t===')'?[]:exprlist();ex(')');return a}
 function table(){ex('{');const a=[],h=[];while(pk().t!=='}'){if(pk().t==='['){p++;const k=expr();ex(']');ex('=');h.push([k,expr()])}else if(pk().t==='id'&&T[p+1].t==='='){const k=nx().v;p++;h.push([{k:'str',v:k},expr()])}else a.push(expr());if(!ac(',')&&!ac(';'))break}ex('}');return{k:'tbl',a,h}}
 function exprlist(){const a=[expr()];while(ac(','))a.push(expr());return a}
 const b=block();ex('eof');return b}
class LT{constructor(){this.h=new Map();this.mt=null}get(k){return this.h.get(k)}set(k,v){if(v===undefined)this.h.delete(k);else this.h.set(k,v)}len(){let n=0;while(this.h.has(n+1))n++;return n}}
class Env{constructor(p){this.p=p;this.v=new Map()}find(n){for(let e=this;e;e=e.p)if(e.v.has(n))return e;return null}}
const BRK={};let hooks={};
const tname=v=>v===undefined?'nil':typeof v==='boolean'?'boolean':typeof v==='number'?'number':typeof v==='string'?'string':typeof v==='function'?'function':v instanceof LT?'table':'userdata';
const tostr=v=>v===undefined?'nil':v===true?'true':v===false?'false':typeof v==='number'?(Number.isInteger(v)?String(v):String(+v.toPrecision(14))):v instanceof LT?'table':typeof v==='function'?'function':(v&&v.__tostring)?v.__tostring():String(v);
const truthy=v=>v!==undefined&&v!==false;
const lib={string:new LT(),math:new LT(),table:new LT(),os:new LT()};
function index(o,k){if(o instanceof LT){const v=o.h.get(k);if(v!==undefined||!o.mt)return v;const ix=o.mt.get('__index');return ix instanceof LT?index(ix,k):undefined}
 if(typeof o==='string')return lib.string.get(k);if(o&&o.__get)return o.__get(k);throw new Error('attempt to index a '+tname(o)+' value (field '+tostr(k)+')')}
function setindex(o,k,v){if(o instanceof LT)o.set(k,v);else if(o&&o.__set)o.__set(k,v);else throw new Error('attempt to index a '+tname(o)+' value')}
async function call(f,a){if(typeof f!=='function')throw new Error('attempt to call a '+tname(f)+' value');const r=await f(...a);return Array.isArray(r)?r:r===undefined?[]:[r]}
const num=v=>{if(typeof v==='number')return v;if(typeof v==='string'&&v.trim()!==''&&!isNaN(v))return Number(v);throw new Error('attempt to perform arithmetic on a '+tname(v)+' value')};
function arith(op,a,b){const h=(a&&a.__op)||(b&&b.__op);if(h)return h(op,a,b);a=num(a);b=num(b);switch(op){case'+':return a+b;case'-':return a-b;case'*':return a*b;case'/':return a/b;case'%':return a-Math.floor(a/b)*b;case'//':return Math.floor(a/b);case'^':return Math.pow(a,b)}}
const eq=(a,b)=>a===b||(a&&a.__eq?a.__eq(b):false);
async function ev(n,e){switch(n.k){
 case'num':case'str':case'bool':return n.v;case'nil':return undefined;
 case'va':return e.find('...')?e.find('...').v.get('...')[0]:undefined;
 case'name':{const f=e.find(n.v);return f?f.v.get(n.v):hooks.g(n.v)}
 case'paren':return ev(n.e,e);
 case'idx':return index(await ev(n.o,e),await ev(n.i,e));
 case'call':case'mcall':return (await evm(n,e))[0];
 case'fn':return mk(n,e);
 case'tbl':{const t=new LT();let i=1;for(let j=0;j<n.a.length;j++){if(j===n.a.length-1&&(n.a[j].k==='call'||n.a[j].k==='mcall'||n.a[j].k==='va'))for(const v of await evm(n.a[j],e))t.set(i++,v);else t.set(i++,await ev(n.a[j],e))}for(const[k,v]of n.h)t.set(await ev(k,e),await ev(v,e));return t}
 case'un':{const v=await ev(n.e,e);if(n.op==='not')return !truthy(v);if(n.op==='-')return v&&v.__op?v.__op('neg',v):-num(v);return typeof v==='string'?v.length:v.len()}
 case'bin':{const op=n.op;if(op==='and'){const l=await ev(n.l,e);return truthy(l)?ev(n.r,e):l}if(op==='or'){const l=await ev(n.l,e);return truthy(l)?l:ev(n.r,e)}
  const l=await ev(n.l,e),r=await ev(n.r,e);
  switch(op){case'..':return tostr(l)+tostr(r);case'==':return eq(l,r);case'~=':return !eq(l,r);
   case'<':case'>':case'<=':case'>=':{if(typeof l!==typeof r)throw new Error('attempt to compare '+tname(l)+' with '+tname(r));return op==='<'?l<r:op==='>'?l>r:op==='<='?l<=r:l>=r}
   default:return arith(op,l,r)}}}
 throw new Error('bad node '+n.k)}
async function evm(n,e){if(n.k==='call'){return call(await ev(n.f,e),await evl(n.a,e))}
 if(n.k==='mcall'){const o=await ev(n.o,e);return call(index(o,n.n),[o,...await evl(n.a,e)])}
 if(n.k==='va'){const f=e.find('...');return f?f.v.get('...'):[]}return[await ev(n,e)]}
async function evl(l,e){const r=[];for(let i=0;i<l.length;i++){if(i===l.length-1)r.push(...await evm(l[i],e));else r.push(await ev(l[i],e))}return r}
function mk(n,env){return async(...a)=>{const e=new Env(env);n.ps.forEach((p,i)=>e.v.set(p,a[i]));if(n.va)e.v.set('...',a.slice(n.ps.length));const r=await run(n.b,e);return r&&r.ret?r.ret:[]}}
async function assign(t,v,e){if(t.k==='name'){const f=e.find(t.v);if(f)f.v.set(t.v,v);else hooks.s(t.v,v)}else setindex(await ev(t.o,e),await ev(t.i,e),v)}
async function run(b,e){for(const s of b){switch(s.k){
 case'expr':await evm(s.e,e);break;
 case'local':{if(s.rec){e.v.set(s.ns[0],undefined);e.v.set(s.ns[0],mk(s.es[0],e));break}const vs=await evl(s.es,e);s.ns.forEach((n,i)=>e.v.set(n,vs[i]));break}
 case'set':{const vs=await evl(s.es,e);for(let i=0;i<s.ts.length;i++)await assign(s.ts[i],vs[i],e);break}
 case'ret':return{ret:await evl(s.es,e)};case'brk':return BRK;
 case'do':{const r=await run(s.b,new Env(e));if(r)return r;break}
 case'if':{let d=false;for(const[c,bl]of s.c)if(truthy(await ev(c,e))){const r=await run(bl,new Env(e));if(r)return r;d=true;break}if(!d&&s.el){const r=await run(s.el,new Env(e));if(r)return r}break}
 case'while':while(truthy(await ev(s.c,e))){const r=await run(s.b,new Env(e));if(r===BRK)break;if(r)return r}break;
 case'repeat':for(;;){const ie=new Env(e);const r=await run(s.b,ie);if(r===BRK)break;if(r)return r;if(truthy(await ev(s.c,ie)))break}break;
 case'fornum':{const a=num(await ev(s.a,e)),b2=num(await ev(s.b,e)),st=s.c?num(await ev(s.c,e)):1;for(let i=a;st>0?i<=b2:i>=b2;i+=st){const ie=new Env(e);ie.v.set(s.n,i);const r=await run(s.bl,ie);if(r===BRK)break;if(r)return r}break}
 case'forin':{const[f,st,c0]=await evl(s.es,e);let c=c0;for(;;){const rs=await call(f,[st,c]);if(rs[0]===undefined)break;c=rs[0];const ie=new Env(e);s.ns.forEach((n,i)=>ie.v.set(n,rs[i]));const r=await run(s.bl,ie);if(r===BRK)break;if(r)return r}break}
 }}}
// ---- standard library ----
const def=(t,o)=>{for(const k in o)t.set(k,o[k])};
def(lib.math,{floor:Math.floor,ceil:Math.ceil,abs:Math.abs,sqrt:Math.sqrt,sin:Math.sin,cos:Math.cos,tan:Math.tan,atan2:Math.atan2,atan:Math.atan,exp:Math.exp,log:Math.log,pow:Math.pow,min:Math.min,max:Math.max,huge:Infinity,pi:Math.PI,random:(a,b)=>a===undefined?Math.random():b===undefined?1+Math.floor(Math.random()*a):a+Math.floor(Math.random()*(b-a+1)),rad:x=>x*Math.PI/180,deg:x=>x*180/Math.PI,fmod:(a,b)=>a%b,sign:x=>Math.sign(x),clamp:(x,a,b)=>Math.min(Math.max(x,a),b),randomseed:()=>{}});
const fmt=(f,...a)=>{let i=0;return f.replace(/%([-+ 0#]*)(\d*)(?:\.(\d+))?([dioxXfgGesqc%])/g,(m,fl,w,pr,c)=>{if(c==='%')return'%';let v=a[i++],s;switch(c){case'd':case'i':s=String(Math.trunc(num(v)));break;case'f':s=num(v).toFixed(pr===undefined?6:+pr);break;case'g':case'G':s=String(+num(v).toPrecision(pr?+pr:6));break;case'x':s=Math.trunc(num(v)).toString(16);break;case'X':s=Math.trunc(num(v)).toString(16).toUpperCase();break;case'c':s=String.fromCharCode(v);break;case'q':s=JSON.stringify(tostr(v));break;default:s=tostr(v)}return w?(fl.includes('-')?s.padEnd(+w):s.padStart(+w,fl.includes('0')?'0':' ')):s})};
const pat=p=>new RegExp(p.replace(/%([a-zA-Z])/g,(m,c)=>({a:'[A-Za-z]',d:'\\d',s:'\\s',w:'[A-Za-z0-9]',l:'[a-z]',u:'[A-Z]',p:'[!-\\/:-@\\[-`{-~]',A:'[^A-Za-z]',D:'\\D',S:'\\S',W:'[^A-Za-z0-9]'}[c]||c)).replace(/%(.)/g,'\\$1').replace(/-(?![^\[]*\])/g,'*?'));
const sb=(s,i,j)=>{const n=s.length;i=i<0?Math.max(n+i+1,1):(i||1);j=j===undefined?n:j<0?n+j+1:j;return s.slice(i-1,j)};
def(lib.string,{len:s=>s.length,sub:sb,upper:s=>s.toUpperCase(),lower:s=>s.toLowerCase(),rep:(s,n)=>s.repeat(n),reverse:s=>[...s].reverse().join(''),format:fmt,byte:(s,i)=>s.charCodeAt((i||1)-1),char:(...a)=>String.fromCharCode(...a),
 find:(s,p,init,plain)=>{const i0=(init||1)-1;if(plain){const k=s.indexOf(p,i0);return k<0?undefined:[k+1,k+p.length]}const m=pat(p).exec(s.slice(i0));return m?[i0+m.index+1,i0+m.index+m[0].length,...m.slice(1)]:undefined},
 match:(s,p)=>{const m=pat(p).exec(s);return m?(m.length>1?m.slice(1):m[0]):undefined},
 gsub:async(s,p,r)=>{const re=new RegExp(pat(p).source,'g');let c=0;const out=[];let last=0,m;while((m=re.exec(s))){c++;out.push(s.slice(last,m.index));out.push(typeof r==='function'?tostr((await call(r,m.slice(1).length?m.slice(1):[m[0]]))[0]):r instanceof LT?tostr(r.get(m[0])):String(r).replace(/%(\d)/g,(x,d)=>d==='0'?m[0]:m[+d]));last=m.index+m[0].length;if(m[0]==='')re.lastIndex++}out.push(s.slice(last));return[out.join(''),c]}});
def(lib.table,{insert:(t,a,b)=>{if(b===undefined)t.set(t.len()+1,a);else{for(let i=t.len();i>=a;i--)t.set(i+1,t.get(i));t.set(a,b)}},remove:(t,i)=>{const n=t.len();i=i===undefined?n:i;const v=t.get(i);for(let j=i;j<n;j++)t.set(j,t.get(j+1));t.set(n,undefined);return v},concat:(t,s='')=>{const a=[];for(let i=1;i<=t.len();i++)a.push(tostr(t.get(i)));return a.join(s)},getn:t=>t.len(),
 sort:async(t,f)=>{const a=[];for(let i=1;i<=t.len();i++)a.push(t.get(i));if(f){for(let i=1;i<a.length;i++){let x=a[i],j=i-1;while(j>=0&&truthy((await call(f,[x,a[j]]))[0])){a[j+1]=a[j];j--}a[j+1]=x}}else a.sort((x,y)=>x<y?-1:x>y?1:0);a.forEach((v,i)=>t.set(i+1,v))}});
def(lib.os,{time:()=>Math.floor(Date.now()/1e3),clock:()=>performance.now()/1e3,date:()=>new Date().toString()});
const base={type:tname,tostring:tostr,tonumber:(v,b)=>b?parseInt(v,b):(isNaN(v)||v===''||v===undefined?undefined:Number(v)),
 print:(...a)=>hooks.print(a.map(tostr).join('\t')),rawget:(t,k)=>t.get(k),rawset:(t,k,v)=>t.set(k,v),rawequal:(a,b)=>a===b,
 setmetatable:(t,m)=>{t.mt=m;return t},getmetatable:t=>t.mt,assert:(v,m)=>{if(!truthy(v))throw new Error(m||'assertion failed!');return v},error:m=>{throw new Error(tostr(m))},
 pcall:async(f,...a)=>{try{return[true,...await call(f,a)]}catch(x){return[false,String(x.message||x)]}},
 select:(n,...a)=>n==='#'?a.length:a.slice(n-1),unpack:(t,i=1,j)=>{const r=[];for(let k=i;k<=(j||t.len());k++)r.push(t.get(k));return r},
 ipairs:t=>[(_,i)=>{const v=t.get(i+1);return v===undefined?undefined:[i+1,v]},t,0],
 pairs:t=>{const ks=t instanceof LT?[...t.h.keys()]:[];let n=0;return[()=>{while(n<ks.length){const k=ks[n++];const v=t.get(k);if(v!==undefined)return[k,v]}return undefined},t,undefined]},
 next:(t,k)=>{const ks=[...t.h.keys()];const i=k===undefined?0:ks.indexOf(k)+1;return i<ks.length?[ks[i],t.get(ks[i])]:undefined},
 string:lib.string,math:lib.math,table:lib.table,os:lib.os};
G.Lua={LT,lib,base,tostr,tname,call,index,truthy,
 async exec(src,glob,print){const G2=new Map(Object.entries(base));for(const k in glob)G2.set(k,glob[k]);
  hooks={g:n=>G2.get(n),s:(n,v)=>G2.set(n,v),print};const ast=parse(src);const h=hooks;
  return{run:async()=>{hooks=h;return run(ast,new Env(null))},globals:G2}}};
})(typeof window!=='undefined'?window:globalThis);
