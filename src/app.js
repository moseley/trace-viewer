{
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=x=>isFinite(x)?(x*100).toFixed(1)+'%':'–';

function parseMsg(m){
  if(m&&typeof m==='object'){const t=m.type||m.kind||'msg';return{type:String(t),product:m.product??m.item??'',price:+(m.price??m.amount??NaN),raw:JSON.stringify(m)}}
  const body=String(m??'').split('|sig:')[0];const p=body.split(':');
  return{type:p[0]||'msg',product:p[1]||'',price:p.length>2?+p[2]:NaN,raw:body};
}
const roleOf=a=>{const i=String(a).lastIndexOf('-');return i>0?String(a).slice(0,i):String(a)};

function analyze(text){
  const ev=[];let bad=0;
  for(const line of text.split(/\r?\n/)){if(!line.trim())continue;try{ev.push(JSON.parse(line))}catch{bad++}}
  const agents=new Map(),sends=[],recv=new Set(),explicitDrop=new Set();
  const A=a=>{if(a==null)return null;if(!agents.has(a))agents.set(a,{agent:a,role:roleOf(a),offers:0,deals:0,rejects:0,sent:0,recv:0,dropped:0,dealSum:0});return agents.get(a)};
  ev.forEach((e,i)=>{A(e.agent);A(e.to);A(e.from);const k=String(e.kind||'');
    if(k==='send'){sends.push({...e,line:i+1,m:parseMsg(e.msg)});A(e.agent).sent++}
    else if(k==='receive'){recv.add(e.corr);A(e.agent).recv++}
    else if(/drop|lost|fail/i.test(k)&&e.corr!=null)explicitDrop.add(e.corr)});
  const queue=new Map(),pairs=new Set();let dropped=0,deals=0,rejects=0,offers=0;
  for(const s of sends){
    s.dropped=explicitDrop.has(s.corr)||(s.corr!=null&&!recv.has(s.corr));
    if(s.dropped){dropped++;A(s.agent).dropped++}
    pairs.add([s.agent,s.to].sort().join('|'));
    const me=A(s.agent),you=A(s.to),t=s.m.type;
    if(t==='buy'){offers++;me.offers++;you&&you.offers++;const key=s.to+'>'+s.agent;(queue.get(key)||queue.set(key,[]).get(key)).push(s)}
    else if(t==='sold'||t==='reject'){
      const q=queue.get(s.agent+'>'+s.to);s.offer=q&&q.shift();
      if(t==='sold'){deals++;me.deals++;you&&you.deals++;if(isFinite(s.m.price)){me.dealSum+=s.m.price;you&&(you.dealSum+=s.m.price)}}
      else{rejects++;me.rejects++;you&&you.rejects++}}
  }
  const overall=deals/(deals+rejects);
  for(const a of agents.values()){const n=a.deals+a.rejects;a.rate=n?a.deals/n:NaN;a.avg=a.deals?a.dealSum/a.deals:NaN;a.flag=n>0&&Math.abs(a.rate-overall)>0.25}
  return{ev,bad,sends,agents:[...agents.values()].filter(a=>a.sent||a.recv||a.offers),dropped,deals,rejects,offers,overall,pairs:pairs.size,
    kinds:ev.reduce((o,e)=>(o[e.kind]=(o[e.kind]||0)+1,o),{})};
}

const COLS=[
  {k:'agent',l:'Agent'},{k:'role',l:'Role',c:'hide-s hide-m'},{k:'offers',l:'Offers',n:1},{k:'deals',l:'Deals',n:1},
  {k:'rejects',l:'Rejections',n:1},{k:'rate',l:'Deal rate',n:1},{k:'avg',l:'Avg deal price',n:1,c:'hide-s'},
  {k:'sent',l:'Sent',n:1,c:'hide-s hide-m'},{k:'recv',l:'Received',n:1,c:'hide-s hide-m'},{k:'dropped',l:'Dropped',n:1}];
let D=null,sort={k:'rate',dir:1},role='all',flagOnly=false,sel=null;

function natural(a,b){return String(a).localeCompare(String(b),undefined,{numeric:true})}
function renderCards(){
  const delivered=D.sends.length-D.dropped;
  const c=[
    ['Agents',D.agents.length],['Messages sent',D.sends.length],
    ['Delivery rate',pct(D.sends.length?delivered/D.sends.length:NaN),D.dropped?'bad':''],
    ['Dropped',D.dropped,D.dropped?'bad':'good'],['Offers',D.offers],
    ['Deal rate',pct(D.overall),'good'],['Rejection rate',pct(1-D.overall),'bad'],['Unique pairs',D.pairs]];
  $('cards').innerHTML=c.map(([l,v,cls])=>`<div class="card ${cls||''}"><div class="num">${esc(v)}</div><div class="lab">${l}</div></div>`).join('');
}
function renderHeader(){
  $('hdr').innerHTML=COLS.map(c=>{const on=sort.k===c.k;return`<th tabindex="0" data-k="${c.k}" class="${c.n?'n ':''}${c.c||''}" ${on?`aria-sort="${sort.dir>0?'ascending':'descending'}"`:''}>${c.l} <span class="ar">${on?(sort.dir>0?'▲':'▼'):'↕'}</span></th>`}).join('');
}
function renderRows(){
  const q=$('q').value.trim().toLowerCase();
  let L=D.agents.filter(a=>(role==='all'||a.role===role)&&(!flagOnly||a.flag)&&(!q||a.agent.toLowerCase().includes(q)));
  const {k,dir}=sort;
  L.sort((a,b)=>{const x=a[k],y=b[k];
    if(typeof x==='number'||typeof y==='number'){const nx=isFinite(x),ny=isFinite(y);if(!nx||!ny)return nx===ny?natural(a.agent,b.agent):nx?-1:1;return(x-y)*dir||natural(a.agent,b.agent)}
    return natural(x,y)*dir});
  $('rows').innerHTML=L.length?L.map(a=>`<tr tabindex="0" data-a="${esc(a.agent)}" class="${a.flag?'flag ':''}${a.agent===sel?'sel':''}">
    <td><strong>${esc(a.agent)}</strong></td><td class="hide-s hide-m mut">${esc(a.role)}</td>
    <td class="n">${a.offers}</td><td class="n">${a.deals}</td><td class="n">${a.rejects}</td>
    <td class="n"><span class="meter">${pct(a.rate)}<i><b style="width:${isFinite(a.rate)?a.rate*100:0}%"></b></i></span></td>
    <td class="n hide-s">${isFinite(a.avg)?a.avg.toFixed(1):'–'}</td><td class="n hide-s hide-m">${a.sent}</td><td class="n hide-s hide-m">${a.recv}</td>
    <td class="n">${a.dropped||'<span class="mut">0</span>'}</td></tr>`).join('')
    :`<tr><td colspan="${COLS.length}" class="empty">No agents match.</td></tr>`;
}
function label(s){
  const m=s.m,pr=isFinite(m.price)?` @ ${m.price}`:'',prod=m.product?` ${m.product}`:'';
  if(m.type==='buy')return`Offer: buy${prod}${pr}`;
  if(m.type==='sold')return`Sold${prod}${pr}`;
  if(m.type==='reject'){const o=s.offer&&s.offer.m.price;
    return`Rejected${prod}`+(isFinite(o)?` · offered ${o}`:'')+(isFinite(m.price)?` · reply value ${m.price}`:'')}
  return m.raw;
}
function renderThread(){
  if(!sel){$('who').innerHTML='';$('chan').innerHTML='<div class="empty">Select an agent in the table to see its conversations.</div>';$('peer').innerHTML='';return}
  const a=D.agents.find(x=>x.agent===sel);
  const mine=D.sends.filter(s=>s.agent===sel||s.to===sel);
  const peers=[...new Set(mine.map(s=>s.agent===sel?s.to:s.agent))].sort(natural);
  const cur=$('peer').value;
  $('peer').innerHTML=`<option value="">All counterparts (${peers.length})</option>`+peers.map(p=>`<option ${p===cur?'selected':''}>${esc(p)}</option>`).join('');
  const peer=peers.includes(cur)?cur:'',kf=$('kindf').value;
  const L=mine.filter(s=>(!peer||s.agent===peer||s.to===peer)&&(kf==='all'||(kf==='dropped'?s.dropped:s.m.type===kf)));
  $('who').innerHTML=`<strong>${esc(sel)}</strong> · `+(a?`${a.deals} deals, ${a.rejects} rejections, deal rate ${pct(a.rate)}${a.flag?' · <span class="tag">flagged</span>':''}`:'not in the agent table (no messages delivered or offers)');
  $('chan').innerHTML=L.length?L.map(s=>{const me=s.agent===sel,other=me?s.to:s.agent;
    return`<div class="msg ${me?'me':''} ${esc(s.m.type)}"><div class="top"><span>${me?'to':'from'} <button data-go="${esc(other)}">${esc(other)}</button></span><span>line ${s.line}${s.dropped?' <span class="tag">dropped</span>':''}</span></div><div class="body">${esc(label(s))}</div></div>`}).join('')
    :'<div class="empty">No messages match this filter.</div>';
}
function select(a){sel=a;$('peer').value='';renderRows();renderThread()}
function load(text,name){
  const R=analyze(text);
  if(!R.sends.length){$('src').textContent=`${name}: no send events found`+(D?' (still showing the previous file)':'');return}
  D=R;
  $('src').textContent=`${name} · ${D.ev.length} events${D.bad?` · ${D.bad} unreadable lines skipped`:''}`;
  const worst=[...D.agents].filter(a=>isFinite(a.rate)).sort((x,y)=>x.rate-y.rate)[0];
  sel=worst?worst.agent:null;
  renderCards();renderHeader();renderRows();renderThread();
}

$('hdr').addEventListener('click',e=>{const th=e.target.closest('th');if(!th)return;const k=th.dataset.k;sort={k,dir:sort.k===k?-sort.dir:(COLS.find(c=>c.k===k).n?-1:1)};renderHeader();renderRows()});
$('hdr').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.target.click()}});
$('rows').addEventListener('click',e=>{const tr=e.target.closest('tr[data-a]');if(tr)select(tr.dataset.a)});
$('rows').addEventListener('keydown',e=>{if(e.key==='Enter'){const tr=e.target.closest('tr[data-a]');if(tr)select(tr.dataset.a)}});
$('chan').addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b)select(b.dataset.go)});
$('q').addEventListener('input',renderRows);
$('peer').addEventListener('change',renderThread);$('kindf').addEventListener('change',renderThread);
document.querySelectorAll('[data-role]').forEach(b=>b.addEventListener('click',()=>{role=b.dataset.role;document.querySelectorAll('[data-role]').forEach(x=>x.setAttribute('aria-pressed',x===b));renderRows()}));
$('flagonly').addEventListener('click',e=>{flagOnly=!flagOnly;e.currentTarget.setAttribute('aria-pressed',flagOnly);renderRows()});
const readFile=f=>{if(!f)return;const r=new FileReader();r.onload=()=>load(r.result,f.name);r.onerror=()=>{$('src').textContent='Could not read that file'};r.readAsText(f)};
$('f').addEventListener('change',e=>readFile(e.target.files[0]));
let dc=0;
addEventListener('dragenter',e=>{e.preventDefault();dc++;$('drop').classList.add('on')});
addEventListener('dragleave',()=>{if(--dc<=0){dc=0;$('drop').classList.remove('on')}});
addEventListener('dragover',e=>e.preventDefault());
addEventListener('drop',e=>{e.preventDefault();dc=0;$('drop').classList.remove('on');readFile(e.dataTransfer.files[0])});

// Built-in sample: the default marketplace run, signatures removed to keep the page small.
const sampleText=(()=>{const names=new Set();SAMPLE.forEach(([a,b])=>{names.add(a);names.add(b)});
  const out=[...names].sort(natural).map(a=>JSON.stringify({agent:a,kind:'start',ts:0}));
  SAMPLE.forEach(([a,b,m],i)=>{const corr='corr-'+(i+1);out.push(JSON.stringify({agent:a,corr,kind:'send',msg:m,to:b,ts:0}),JSON.stringify({agent:b,corr,from:a,kind:'receive',msg:m,ts:0}))});
  [...names].sort(natural).forEach(a=>out.push(JSON.stringify({agent:a,kind:'stop',ts:0})));return out.join('\n')})();
load(sampleText,'Sample: marketplace run');
window.__analyze=analyze;
}
