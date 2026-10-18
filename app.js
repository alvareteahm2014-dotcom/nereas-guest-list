(function(){
'use strict';
var KEY='nereas-guest-list.v2', OLD_KEY='nereas-guest-list.v1', TAB_KEY='nereas-guest-list.tab';
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var uid=function(){return Math.random().toString(36).slice(2,9)};
var ESC={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return ESC[c]})};
var norm=function(s){var x=String(s||'').toLowerCase().normalize('NFD').replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();return x||String(s||'').toLowerCase().trim()};
function pad(n){return String(n).padStart(2,'0')}
function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function parse(s){var p=String(s).split('-');return new Date(+p[0],+p[1]-1,+p[2])}
function addDays(s,n){var d=parse(s);d.setDate(d.getDate()+n);return iso(d)}
function nightDate(){var d=new Date();if(d.getHours()<7)d.setDate(d.getDate()-1);return iso(d)}
function fmtLong(s){return parse(s).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}
function fmtShort(s){var p=s.split('-');return p[2]+'/'+p[1]}
var DOW=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
function dayName(s){return DOW[parse(s).getDay()]+' '+s.slice(8)}
function monthName(k){var p=k.split('-');var s=new Date(+p[0],+p[1]-1,1).toLocaleDateString('es-ES',{month:'long',year:'numeric'});return s.charAt(0).toUpperCase()+s.slice(1)}
function weekStart(s){var d=parse(s);d.setDate(d.getDate()-((d.getDay()+6)%7));return iso(d)}

/* ---------- estado y guardado ---------- */
var S=null, storageOk=true;
function migrate(o){
  if(!o||!Array.isArray(o.clubs)||!Array.isArray(o.entries))return null;
  o.v=2;o.profiles=o.profiles||{};
  o.clubs.forEach(function(c){c.bonusEvery=+c.bonusEvery||0;c.bonusAmount=+c.bonusAmount||0;c.pctMesa=+c.pctMesa||0;c.rateLista=+c.rateLista||0;delete c.rateMesa});
  o.entries.forEach(function(e){
    if(typeof e.n!=='number'){
      var comp=Array.isArray(e.comp)?e.comp:[];
      e.n=1+comp.length;e.m=0;e.f=0;
      e.names=comp.map(function(c){return c&&c.name?c.name:''}).filter(Boolean);
      delete e.comp;
    }
    if(!Array.isArray(e.names))e.names=[];
    e.m=+e.m||0;e.f=+e.f||0;
  });
  Object.keys(o.profiles).forEach(function(k){
    var p=o.profiles[k];
    if(typeof p.n!=='number'){p.n=1+(+p.m||0)+(+p.f||0)+(Array.isArray(p.comp)?p.comp.length:0);if(Array.isArray(p.comp)){p.m=0;p.f=0}}
  });
  return o;
}
function load(){
  try{var r=localStorage.getItem(KEY);if(r)return migrate(JSON.parse(r))}catch(e){}
  try{var q=localStorage.getItem(OLD_KEY);if(q)return migrate(JSON.parse(q))}catch(e){}
  return null;
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));storageOk=true}catch(e){storageOk=false}}
function snap(){return JSON.stringify(S)}
function restoreSnap(s){S=migrate(JSON.parse(s));save();renderAll()}

/* ---------- cálculos ---------- */
function club(id){return S.clubs.filter(function(c){return c.id===id})[0]}
function heads(e){return e.n||1}
function hasSplit(e){return (e.m||0)+(e.f||0)===e.n&&e.n>0}
function rate(c){return c?(+c.rateLista||0):0}
function hasNum(v){return v!=null&&v!==''&&!isNaN(+v)}
function amt(e){
  var x=hasNum(e.extra)?+e.extra:0;
  if(x>0&&String(e.name).trim().toLowerCase()==='host')return x;
  if(hasNum(e.amount))return +e.amount+x;
  var c=club(e.clubId);
  if(e.type==='mesa')return (c?(+c.pctMesa||0)/100*(hasNum(e.spend)?+e.spend:0):0)+x;
  return rate(c)*heads(e)+x;
}
function pay(e){return e.type==='pago'?(hasNum(e.payout)?+e.payout:amt(e)):0}
function eur(n){n=n||0;var a=Math.abs(n),fr=Math.abs(a-Math.round(a))>0.004;return (n<0?'−':'')+'£'+new Intl.NumberFormat('en-GB',{minimumFractionDigits:fr?2:0,maximumFractionDigits:2}).format(a)}
function pkey(n){return norm(n)}
function profileOf(name){return S.profiles[pkey(name)]}
function visits(name){var k=pkey(name);return S.entries.filter(function(e){return pkey(e.name)===k}).length}
function typeLabel(t){return t==='pago'?'PAGO':t==='mesa'?'⭐ Mesa':'Lista'}
function promoters(){var m={};S.entries.forEach(function(e){if(e.type==='pago'&&e.promoter)m[e.promoter]=1});return Object.keys(m).sort()}
function plural(n,one,many){return n+' '+(n===1?one:many)}

/* "Quique 6+3" -> nombre, personas, chicos, chicas. Una estrella o * al final marca mesa. */
function parseQuick(text){
  var t=String(text||'').trim(),mesa=false;
  if(/[⭐*]\s*$/.test(t)){mesa=true;t=t.replace(/\s*[⭐*]+\s*$/,'')}
  var m=t.match(/^(.*?)\s+(\d{1,2})(?:\s*\+\s*(\d{1,2}))?$/),name=t,n=1,a=0,b=0;
  if(m){
    name=m[1].trim();
    if(m[3]!=null){a=+m[2];b=+m[3];n=a+b}else{n=+m[2]}
    if(n<1){n=1;a=0;b=0}
  }
  return {name:name,n:n,m:a,f:b,mesa:mesa};
}
function countText(n,m,f){return (m||f)&&m+f===n?m+'+'+f:String(n)}
function splitText(n,m,f){
  if((m||f)&&m+f===n){var a=[];if(f)a.push(f+(f===1?' chica':' chicas'));if(m)a.push(m+(m===1?' chico':' chicos'));return a.join(' · ')}
  return plural(n,'persona','personas');
}
function weekOfMonth(s){var d=parse(s),off=(new Date(d.getFullYear(),d.getMonth(),1).getDay()+6)%7;return Math.floor((d.getDate()-1+off)/7)+1}
var MES3=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function rangeLabel(a,b){var A=parse(a),B=parse(b);return A.getDate()+(A.getMonth()!==B.getMonth()?' '+MES3[A.getMonth()]:'')+' – '+B.getDate()+' '+MES3[B.getMonth()]}
function peopleText(n,m,f){
  if((m||f)&&m+f===n)return plural(n,'persona','personas')+' ('+plural(m,'chico','chicos')+' + '+plural(f,'chica','chicas')+')';
  return plural(n,'persona','personas');
}
function linkify(t){
  var h=esc(t);
  h=h.replace(/(https?:\/\/[^\s<]+)/g,function(u){return '<a href="'+u+'" target="_blank" rel="noopener noreferrer">'+u.replace(/^https?:\/\/(www\.)?/,'')+'</a>'});
  h=h.replace(/(^|[\s(·])@([A-Za-z0-9._]{2,30})/g,function(m,p,u){return p+'<a href="https://instagram.com/'+u+'" target="_blank" rel="noopener noreferrer">@'+u+'</a>'});
  return h;
}
function upsertProfile(name,patch){
  var k=pkey(name);if(!k)return;
  var p=S.profiles[k]||{name:name.trim()};
  for(var x in patch)p[x]=patch[x];
  p.name=p.name||name.trim();
  S.profiles[k]=p;
}

/* bonus: cada X personas que entran en una discoteca el mismo día */
function bonusMap(){
  var cnt={},out={};
  S.entries.forEach(function(e){if(!e.entered)return;var k=e.clubId+'|'+e.date;cnt[k]=(cnt[k]||0)+heads(e)});
  Object.keys(cnt).forEach(function(k){
    var c=club(k.split('|')[0]);
    if(c&&c.bonusEvery>0&&c.bonusAmount>0){var x=Math.floor(cnt[k]/c.bonusEvery)*c.bonusAmount;if(x>0)out[k]=x}
  });
  return out;
}

/* ---------- datos de ejemplo (marcados, se borran con un toque) ---------- */
function demoData(){
  var n=nightDate();
  var d={v:2,clubs:[
    {id:'c1',name:'Sala Eclipse',rateLista:6,pctMesa:12,bonusEvery:15,bonusAmount:30,demo:true},
    {id:'c2',name:'Nox Club',rateLista:5,pctMesa:10,bonusEvery:0,bonusAmount:0,demo:true}
  ],entries:[],profiles:{}};
  S=d;
  function add(off,clubId,text,type,entered,promoter,desc){
    var q=parseQuick(text);
    d.entries.push({id:'d'+d.entries.length,date:addDays(n,off),clubId:clubId,name:q.name,type:type,n:q.n,m:q.m,f:q.f,names:[],
      entered:entered,amount:null,spend:type==='mesa'?300+(d.entries.length*53)%400:null,promoter:promoter||'',payout:null,paid:false,demo:true,ts:d.entries.length});
    if(!profileOf(q.name))upsertProfile(q.name,{clubId:clubId,type:type,n:q.n,m:q.m,f:q.f,desc:desc||'',demo:true});
  }
  add(0,'c1','Lucía Ramos 6+3','lista',true,'','@lucia.ramos · chaqueta vaquera');
  add(0,'c1','Carlos Pérez 3','lista',false,'','@carlospz · gorra negra');
  add(0,'c1','Irene Soto 5+3','mesa',true,'','Cumpleaños, vestido rojo');
  add(0,'c2','Pablo Medina 2+1','pago',true,'Jorge (RRPP)','Lo envía Jorge · camisa blanca');
  add(0,'c2','Sofía León 2','lista',false,'','@sofi.leon');
  add(0,'c2','Marcos Gil 3','pago',false,'Álex','Lo envía Álex');
  var pool=[['Paula Torres 4+2','lista'],['Rafa Cano 6','lista'],['Dani Ortiz 3+5','mesa'],['Marta Vidal 2+2','lista'],
    ['Elena Ruiz 5','pago'],['Hugo Sanz 4+1','lista'],['Sofía León 7+3','mesa'],['Iván Gil 2','lista']];
  var offs=[-1,-2,-3,-4,-5,-6,-8,-9,-15,-16,-22,-23,-29,-30,-36,-37,-43,-44,-50,-51,-57,-58];
  offs.forEach(function(o,i){
    var a=pool[(i*2)%8],b=pool[(i*2+1)%8];
    add(o,'c1',a[0],a[1],true,a[1]==='pago'?'Jorge (RRPP)':'','');
    add(o,'c2',b[0],b[1],true,b[1]==='pago'?'Álex':'','');
  });
  return d;
}
function hasDemo(){return S.clubs.some(function(c){return c.demo})||S.entries.some(function(e){return e.demo})}
function clearDemo(){
  var before=snap();
  S.entries=S.entries.filter(function(e){return !e.demo});
  S.clubs=S.clubs.filter(function(c){return !c.demo||S.entries.some(function(e){return e.clubId===c.id})});
  S.clubs.forEach(function(c){delete c.demo});
  Object.keys(S.profiles).forEach(function(k){
    var p=S.profiles[k];
    if(p.demo&&!S.entries.some(function(e){return pkey(e.name)===k}))delete S.profiles[k];
    else delete p.demo;
  });
  save();renderAll();
  toast('Ejemplos borrados. Añade tu primera discoteca en la pestaña Discotecas.',function(){restoreSnap(before)});
}

/* ---------- aviso flotante ---------- */
var toastT;
function toast(msg,undo){
  var r=$('#toastRoot');
  r.innerHTML='<div class="toast" role="status"><span>'+esc(msg)+'</span>'+(undo?'<button type="button" id="toastUndo">Deshacer</button>':'')+'</div>';
  if(undo)$('#toastUndo').onclick=function(){undo();r.innerHTML=''};
  clearTimeout(toastT);
  toastT=setTimeout(function(){r.innerHTML=''},undo?9000:2600);
}

/* ---------- estado de vistas ---------- */
var LV={date:nightDate(),club:'',type:'lista',confirmDel:null,edit:null};
var DV={period:'sem',off:0,club:'all',type:'all',status:'all',from:'',to:'',openMonth:null,moreMonths:false};
var ICON_CHECK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

/* =========================== DASHBOARD =========================== */
function nightsRange(){
  var t=nightDate(),o=DV.off||0,P=DV.period;
  if(P==='hoy'){var d=addDays(t,o);return {a:d,b:d,label:fmtLong(d)}}
  if(P==='sem'){var m=weekStart(addDays(t,7*o)),e=addDays(m,6);return {a:m,b:e,label:(o===0?'Esta semana · ':'Semana ')+rangeLabel(m,e)}}
  if(P==='mes'){var p=parse(t),f=new Date(p.getFullYear(),p.getMonth()+o,1),l=new Date(f.getFullYear(),f.getMonth()+1,0);return {a:iso(f),b:iso(l),label:monthName(iso(f).slice(0,7))}}
  if(P==='anio'){var y=parse(t).getFullYear()+o;return {a:y+'-01-01',b:y+'-12-31',label:'Año '+y}}
  if(P==='rango')return {a:DV.from||'0000-00-00',b:DV.to||'9999-99-99',label:'Rango elegido'};
  return {a:'0000-00-00',b:'9999-99-99',label:'Todo el histórico'};
}
function dFiltered(){
  var r=nightsRange();
  return S.entries.filter(function(e){
    if(e.date<r.a||e.date>r.b)return false;
    if(DV.club!=='all'&&e.clubId!==DV.club)return false;
    if(DV.type!=='all'&&e.type!==DV.type)return false;
    if(DV.status==='in'&&!e.entered)return false;
    if(DV.status==='out'&&(e.entered||e.rejected))return false;
    if(DV.status==='rej'&&!e.rejected)return false;
    return true;
  });
}
function totals(list,useBonus){
  var BM=useBonus?bonusMap():{},seen={};
  var t={heads:0,inHeads:0,gen:0,ret:0,retPend:0,prevGen:0,prevRet:0,bonus:0,mesas:0,clubs:{},prom:{},days:{},n:list.length};
  list.forEach(function(e){
    var h=heads(e),a=amt(e),p=pay(e);
    t.heads+=h;
    var c=t.clubs[e.clubId]||(t.clubs[e.clubId]={gen:0,ret:0,heads:0,inH:0,bonus:0});
    c.heads+=h;
    t.days[e.date]=t.days[e.date]||0;
    if(e.entered){
      t.inHeads+=h;t.gen+=a;t.ret+=p;c.gen+=a;c.ret+=p;c.inH+=h;t.days[e.date]+=h;
      if(e.type==='mesa')t.mesas++;
      if(e.type==='pago'){
        var k=e.promoter||'Sin indicar';
        var pr=t.prom[k]||(t.prom[k]={total:0,pend:0,n:0});
        pr.total+=p;pr.n++;
        if(!e.paid){pr.pend+=p;t.retPend+=p}
      }
    }else if(e.rejected){t.rej=(t.rej||0)+h}else{t.prevGen+=a;t.prevRet+=p}
    var bk=e.clubId+'|'+e.date;
    if(BM[bk]&&!seen[bk]){seen[bk]=1;t.gen+=BM[bk];t.bonus+=BM[bk];c.gen+=BM[bk];c.bonus+=BM[bk]}
  });
  return t;
}

/* Top 10: guests (lista/PAGO) por personas que han entrado y veces que repiten; clientes (mesas) */
function topLists(){
  var r=nightsRange(),G={},C={};
  S.entries.forEach(function(e){
    if(!e.entered||e.date<r.a||e.date>r.b)return;
    if(DV.club!=='all'&&e.clubId!==DV.club)return;
    var k=pkey(e.name),M=e.type==='mesa'?C:G;
    var x=M[k]||(M[k]={name:e.name,people:0,visits:0,spend:0,fee:0,last:''});
    x.people+=heads(e);x.visits++;x.fee+=amt(e);if(hasNum(e.spend))x.spend+=+e.spend;
    if(e.date>x.last){x.last=e.date;x.name=e.name}
  });
  function arr(M,f){return Object.keys(M).map(function(k){return M[k]}).sort(f).slice(0,10)}
  return {
    guests:arr(G,function(a,b){return b.people-a.people||b.visits-a.visits||a.name.localeCompare(b.name)}),
    clients:arr(C,function(a,b){return b.visits-a.visits||b.spend-a.spend||b.people-a.people||a.name.localeCompare(b.name)})
  };
}
function topCard(title,sub,rows,kind){
  var h='<div class="card"><h2>'+title+'</h2><div class="sub">'+sub+'</div>';
  if(!rows.length)return h+'<div class="empty" style="padding:18px 8px">Sin datos en este periodo.</div></div>';
  h+='<ol class="toplist">';
  rows.forEach(function(x,i){
    var line=kind==='g'?plural(x.visits,'visita','visitas')+(x.visits>1?' · repite':'')
      :plural(x.visits,'mesa','mesas')+' · '+plural(x.people,'persona','personas')+(x.spend>0?' · consumo '+eur(x.spend):'');
    var val=kind==='g'?'<b class="num">'+x.people+'</b><span>personas</span>':'<b class="num">'+x.visits+'</b><span>'+(x.visits===1?'mesa':'mesas')+'</span>';
    h+='<li><span class="rk num">'+(kind==='g'&&i<3?['🥇','🥈','🥉'][i]:i+1)+'</span><span class="tn">'+(kind==='c'?'⭐ ':'')+esc(x.name)+'<small>'+esc(line)+'</small></span><span class="tv">'+val+'</span></li>';
  });
  return h+'</ol></div>';
}

/* resumen por meses: neto de cada mes por discoteca, semanas del mes y noches */
function monthSummary(){
  var BM=DV.type==='all'?bonusMap():{},M={};
  function mo(k){return M[k]||(M[k]={key:k,gen:0,ret:0,bonus:0,net:0,people:0,mesas:0,days:{},clubs:{}})}
  function cb(m,id){return m.clubs[id]||(m.clubs[id]={net:0,people:0})}
  S.entries.forEach(function(e){
    if(!e.entered)return;
    if(DV.club!=='all'&&e.clubId!==DV.club)return;
    if(DV.type!=='all'&&e.type!==DV.type)return;
    var m=mo(e.date.slice(0,7)),a=amt(e),p=pay(e),c=cb(m,e.clubId);
    m.gen+=a;m.ret+=p;m.people+=heads(e);c.net+=a-p;c.people+=heads(e);
    if(e.type==='mesa')m.mesas++;
    m.days[e.date]=(m.days[e.date]||0)+a-p;
  });
  Object.keys(BM).forEach(function(k){
    var id=k.split('|')[0],date=k.split('|')[1];
    if(DV.club!=='all'&&id!==DV.club)return;
    var m=mo(date.slice(0,7));
    m.gen+=BM[k];m.bonus+=BM[k];cb(m,id).net+=BM[k];m.days[date]=(m.days[date]||0)+BM[k];
  });
  return Object.keys(M).sort().reverse().map(function(k){M[k].net=M[k].gen-M[k].ret;return M[k]});
}
function weeksOf(m){
  var wk={},order=[];
  Object.keys(m.days).sort().forEach(function(d){
    var n=weekOfMonth(d);
    if(!wk[n]){wk[n]={net:0,days:[]};order.push(n)}
    wk[n].net+=m.days[d];wk[n].days.push({date:d,net:m.days[d]});
  });
  return order.map(function(n){return {n:n,net:wk[n].net,days:wk[n].days}});
}
function monthsHtml(){
  var all=monthSummary(),cl=DV.club==='all'?'todas las discotecas':(club(DV.club)||{name:'esta discoteca'}).name;
  var head='<h2>Resumen por meses</h2><div class="sub">Lo que te queda cada mes en '+esc(cl)+', con bonus y sin lo que pagas a otros promotores.</div>';
  if(!all.length)return '<div class="card" id="monthsCard">'+head+'<div class="empty"><b>Aún no hay noches cerradas</b>Marca quién ha entrado en la pestaña Listas y aquí verás lo que llevas cada mes.</div></div>';
  if(DV.openMonth===null||(DV.openMonth!==''&&!all.some(function(m){return m.key===DV.openMonth})))DV.openMonth=all[0].key;
  var shown=DV.moreMonths?all:all.slice(0,4);
  var max=Math.max.apply(null,all.map(function(m){return Math.max(m.net,0)}).concat([1]));
  var h='<div class="card" id="monthsCard">'+head+'<div class="months">';
  shown.forEach(function(m){
    var open=DV.openMonth===m.key,w=Math.max(0,m.net)/max*100;
    h+='<button class="mrow" type="button" data-m="'+esc(m.key)+'" aria-expanded="'+(open?'true':'false')+'">'
      +'<div class="mrow-top"><span class="mname">'+esc(monthName(m.key))+'</span><span class="mval num">'+esc(eur(m.net))+'</span></div>'
      +'<div class="msub">'+plural(m.people,'persona','personas')+(m.mesas?' · ⭐ '+plural(m.mesas,'mesa','mesas'):'')+(m.bonus?' · bonus '+esc(eur(m.bonus)):'')+'</div>'
      +'<div class="mbar" style="width:'+w.toFixed(1)+'%"></div></button>';
    if(open){
      h+='<div class="weeks">';
      var ids=Object.keys(m.clubs);
      if(ids.length>1){
        h+='<div><div class="week-h"><span>Por discoteca</span></div>'
          +ids.sort(function(a,b){return m.clubs[b].net-m.clubs[a].net}).map(function(id){
            var c=club(id);return '<div class="week-d"><span>'+esc(c?c.name:'Sin discoteca')+' · '+m.clubs[id].people+'</span><span class="num">'+esc(eur(m.clubs[id].net))+'</span></div>'}).join('')+'</div>';
      }
      weeksOf(m).forEach(function(wk){
        h+='<div><div class="week-h"><span>Semana '+wk.n+'</span><span class="num">'+esc(eur(wk.net))+'</span></div>'
          +wk.days.map(function(d){return '<div class="week-d"><span>'+esc(dayName(d.date))+'</span><span class="num">'+esc(eur(d.net))+'</span></div>'}).join('')+'</div>';
      });
      h+='</div>';
    }
  });
  h+='</div>';
  if(all.length>4)h+='<button class="btn ghost small more-months" type="button" data-more="1">'+(DV.moreMonths?'Ver menos meses':'Ver todos los meses ('+all.length+')')+'</button>';
  return h+'</div>';
}

function renderDashFilters(){
  var sel=$('#d-club');
  sel.innerHTML='<option value="all">Todas</option>'+S.clubs.map(function(c){return '<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>'}).join('');
  if(DV.club!=='all'&&!club(DV.club))DV.club='all';
  sel.value=DV.club;$('#d-type').value=DV.type;$('#d-status').value=DV.status;
  $$('#periodChips .chip').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.p===DV.period))});
  $('#rangeRow').hidden=DV.period!=='rango';
  var nav=DV.period==='hoy'||DV.period==='sem'||DV.period==='mes'||DV.period==='anio';
  $('#periodNav').hidden=DV.period==='rango';
  $('#pPrev').hidden=!nav;$('#pNext').hidden=!nav;
  $('#pLabel').textContent=nightsRange().label;
  $('#d-from').value=DV.from;$('#d-to').value=DV.to;
}

function renderDash(){
  var out=$('#dashOut');
  if(!S.clubs.length){
    out.innerHTML='<div class="card empty"><b>Aún no hay discotecas</b>Añade la primera en la pestaña Discotecas para empezar a apuntar guests.</div>';return;
  }
  var list=dFiltered(),t=totals(list,DV.type==='all'&&DV.status!=='out'&&DV.status!=='rej'),lab=nightsRange().label;
  var h='';
  if(!list.length){
    h+='<div class="card empty"><b>Nada que mostrar</b>No hay guests con estos filtros. Prueba otro periodo o apunta gente en la pestaña Listas.</div>';
  }else{
    var neto=t.gen-t.ret,prevNeto=t.prevGen-t.prevRet,rate100=t.heads?Math.round(t.inHeads/t.heads*100):0;
    h+='<div class="card hero"><span class="lbl">Balance neto · '+esc(lab)+'</span><span class="big num">'+esc(eur(neto))+'</span>'
     +'<div class="line"><span>Generado <b class="num">'+esc(eur(t.gen))+'</b></span>'
     +(t.bonus>0?'<span>Bonus <b class="num">+'+esc(eur(t.bonus))+'</b></span>':'')
     +(t.ret>0?'<span>Retiros PAGO <b class="num">−'+esc(eur(t.ret))+'</b></span>':'')
     +(t.mesas>0?'<span>⭐ <b class="num">'+plural(t.mesas,'mesa','mesas')+'</b></span>':'')
     +(prevNeto>0?'<span>+<b class="num">'+esc(eur(prevNeto))+'</b> si entran los pendientes</span>':'')+'</div></div>';
    h+='<div class="tiles">'
     +'<div class="tile"><div class="v num">'+t.heads+'</div><div class="l">Apuntados</div><div class="d">'+plural(t.n,'guest','guests')+'</div></div>'
     +'<div class="tile"><div class="v num">'+t.inHeads+'</div><div class="l">Han entrado</div><div class="d">'+(t.heads-t.inHeads-(t.rej||0))+' pendientes'+(t.rej?' · '+t.rej+' rechazados':'')+'</div></div>'
     +'<div class="tile"><div class="v num">'+rate100+'%</div><div class="l">Entrada</div><div class="d">de lo apuntado</div></div></div>';
  }
  var tp=topLists();
  h+=topCard('🏆 Top 10 guests','Quién ha llevado más gente y cuántas veces repite · '+esc(lab),tp.guests,'g');
  h+=topCard('Top 10 clientes','Los que vienen con mesa · '+esc(lab),tp.clients,'c');
  h+=monthsHtml();

  var days=Object.keys(t.days).sort().slice(-14);
  if(list.length&&days.length>1){
    h+='<div class="card"><h2>Personas dentro por noche</h2><div class="sub">Todas las personas que han entrado.</div><div class="chart-box" id="colChart"></div></div>';
  }

  var pk=Object.keys(t.prom);
  if(pk.length){
    h+='<div class="card"><h2>PAGO · lo que debes a otros promotores</h2><div class="sub">Pendiente de pagar: <b class="num">'+esc(eur(t.retPend))+'</b></div><div style="margin-top:8px">';
    pk.sort(function(a,b){return t.prom[b].pend-t.prom[a].pend}).forEach(function(k){
      var p=t.prom[k];
      h+='<div class="debt"><div class="who">'+esc(k)+'<div class="sub">'+plural(p.n,'guest','guests')+' · total '+esc(eur(p.total))+'</div></div>'
       +(p.pend>0?'<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end"><span class="num" style="font-weight:700">'+esc(eur(p.pend))+'</span><button class="btn small ghost" type="button" data-act="paid" data-prom="'+esc(k)+'">Marcar pagado</button></div>'
         :'<span class="badge">'+ICON_CHECK+'Pagado</span>')+'</div>';
    });
    h+='</div></div>';
  }
  out.innerHTML=h;
  if(list.length&&days.length>1)drawColumns($('#colChart'),days,t.days);
}

function niceMax(m){return Math.max(4,Math.ceil(m/4)*4)}
function drawColumns(el,days,data){
  var W=Math.max(260,el.clientWidth||320),H=190,L=30,B=24,T=22,R=6;
  var vals=days.map(function(d){return data[d]}),mx=niceMax(Math.max.apply(null,vals));
  var pw=W-L-R,ph=H-T-B,step=pw/days.length,bw=Math.min(24,step*.6),s='';
  [0,mx/2,mx].forEach(function(v){
    var y=T+ph-v/mx*ph;
    s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y+'" y2="'+y+'" style="stroke:var(--'+(v===0?'axis':'grid')+')" stroke-width="1"/>'
     +'<text x="'+(L-6)+'" y="'+(y+4)+'" text-anchor="end" font-size="11" style="fill:var(--muted)">'+v+'</text>';
  });
  var maxI=vals.indexOf(Math.max.apply(null,vals));
  days.forEach(function(d,i){
    var v=vals[i],h=v/mx*ph,x=L+step*i+(step-bw)/2,y=T+ph-h,r=Math.min(4,h);
    if(h>0)s+='<path d="M'+x+','+(y+h)+' L'+x+','+(y+r)+' Q'+x+','+y+' '+(x+r)+','+y+' L'+(x+bw-r)+','+y+' Q'+(x+bw)+','+y+' '+(x+bw)+','+(y+r)+' L'+(x+bw)+','+(y+h)+' Z" style="fill:var(--s1)"/>';
    if(i===maxI&&v>0)s+='<text x="'+(x+bw/2)+'" y="'+(y-6)+'" text-anchor="middle" font-size="12" font-weight="700" style="fill:var(--ink)">'+v+'</text>';
    if(days.length<=8||i%2===(days.length-1)%2)s+='<text x="'+(x+bw/2)+'" y="'+(H-7)+'" text-anchor="middle" font-size="11" style="fill:var(--muted)">'+fmtShort(d)+'</text>';
    s+='<rect x="'+(L+step*i)+'" y="'+T+'" width="'+step+'" height="'+ph+'" fill="transparent" data-tip="'+esc(fmtLong(d)+'|'+plural(v,'persona dentro','personas dentro'))+'"/>';
  });
  el.innerHTML='<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Personas dentro por noche">'+s+'</svg>';
}

function markPaid(prom){
  var before=snap(),list=dFiltered(),n=0;
  list.forEach(function(e){
    if(e.type==='pago'&&e.entered&&!e.paid&&(e.promoter||'Sin indicar')===prom){e.paid=true;n++}
  });
  if(!n)return;
  save();renderDash();
  toast('Pagos a '+prom+' marcados como pagados.',function(){restoreSnap(before)});
}

function bindDash(){
  $('#periodChips').addEventListener('click',function(ev){
    var b=ev.target.closest('.chip');if(!b)return;
    DV.period=b.dataset.p;DV.off=0;
    if(DV.period==='rango'&&!DV.from){DV.to=nightDate();DV.from=addDays(DV.to,-6)}
    renderDashFilters();renderDash();
  });
  $('#pPrev').onclick=function(){DV.off--;renderDashFilters();renderDash()};
  $('#pNext').onclick=function(){DV.off++;renderDashFilters();renderDash()};
  $('#d-club').onchange=function(){DV.club=this.value;renderDash()};
  $('#d-type').onchange=function(){DV.type=this.value;renderDash()};
  $('#d-status').onchange=function(){DV.status=this.value;renderDash()};
  $('#d-from').onchange=function(){DV.from=this.value;renderDashFilters();renderDash()};
  $('#d-to').onchange=function(){DV.to=this.value;renderDashFilters();renderDash()};
  $('#dashOut').addEventListener('click',function(ev){
    var p=ev.target.closest('[data-act="paid"]');if(p){markPaid(p.dataset.prom);return}
    var more=ev.target.closest('[data-more]');
    if(more){DV.moreMonths=!DV.moreMonths;renderDash();return}
    var b=ev.target.closest('.mrow');if(!b)return;
    DV.openMonth=DV.openMonth===b.dataset.m?'':b.dataset.m;
    renderDash();
  });
  window.addEventListener('resize',function(){var el=$('#colChart');if(el&&!$('#view-dash').hidden)renderDash()});
}

/* tooltip por delegación: ratón, táctil y teclado */
var tipEl=$('#tip');
function showTip(src,x,y){
  var parts=String(src.getAttribute('data-tip')).split('|');
  tipEl.innerHTML='<b>'+esc(parts[0])+'</b>'+parts.slice(1).map(esc).join('<br>');
  tipEl.hidden=false;
  var w=tipEl.offsetWidth,hh=tipEl.offsetHeight;
  var Lx=Math.min(Math.max(8,x-w/2),window.innerWidth-w-8),Ty=y-hh-14;
  if(Ty<8)Ty=y+18;
  tipEl.style.left=Lx+'px';tipEl.style.top=Ty+'px';
}
function hideTip(){tipEl.hidden=true}
document.addEventListener('pointermove',function(ev){var s=ev.target.closest&&ev.target.closest('[data-tip]');if(s)showTip(s,ev.clientX,ev.clientY);else hideTip()});
document.addEventListener('pointerdown',function(ev){var s=ev.target.closest&&ev.target.closest('[data-tip]');if(s)showTip(s,ev.clientX,ev.clientY);else hideTip()});
document.addEventListener('focusin',function(ev){var s=ev.target.closest&&ev.target.closest('[data-tip]');if(s){var r=s.getBoundingClientRect();showTip(s,r.left+r.width/2,r.top)}});
document.addEventListener('focusout',hideTip);
window.addEventListener('scroll',hideTip,{passive:true});

/* =========================== LISTAS (simple) =========================== */
function ensureClub(){
  if(!club(LV.club))LV.club=S.clubs.length?S.clubs[0].id:'';
}
function dayEntries(){
  return S.entries.filter(function(e){return e.date===LV.date&&e.clubId===LV.club}).sort(function(a,b){return (a.ts||0)-(b.ts||0)});
}
function pillsFor(e){
  if(hasSplit(e))return (e.f?'<span class="pill f">'+e.f+(e.f===1?' chica':' chicas')+'</span>':'')+(e.m?'<span class="pill m">'+e.m+(e.m===1?' chico':' chicos')+'</span>':'');
  return e.n>1?'<span class="pill">'+e.n+' pers.</span>':'';
}
function readCounts(pf,pm){
  return {f:Math.max(0,parseInt($(pf).value,10)||0),m:Math.max(0,parseInt($(pm).value,10)||0)};
}

function renderForm(){
  ensureClub();
  var r=$('#t-'+LV.type);if(r)r.checked=true;
  $('#f-pago').hidden=LV.type!=='pago';
  $('#promoters').innerHTML=promoters().map(function(p){return '<option value="'+esc(p)+'">'}).join('');
  $('#btnAdd').disabled=!LV.club;
  $$('.hostbtn').forEach(function(b){b.disabled=!LV.club});
}

function renderHint(){
  var h=$('#hint'),name=$('#f-name').value.trim(),c=readCounts('#f-f','#f-m'),n=c.f+c.m;
  if(!name&&!n){h.innerHTML='Nombre, chicas y chicos. Los botones <b>Host</b> apuntan al momento con ese extra.';return}
  h.innerHTML='<b>'+esc(name||'…')+'</b> · '+esc(n?splitText(n,c.m,c.f):'1 persona')+(LV.type==='mesa'?' · ⭐ mesa':'')+(LV.type==='pago'?' · PAGO':'');
}

function renderSugg(){
  var box=$('#sugg'),v=$('#f-name').value,k=norm(v);
  if(!k){box.hidden=true;box.innerHTML='';return}
  var hits=Object.keys(S.profiles).filter(function(x){return x.indexOf(k)!==-1&&x!==k});
  if(S.profiles[k])hits.unshift(k);
  hits=hits.slice(0,5);
  if(!hits.length){box.hidden=true;box.innerHTML='';return}
  box.innerHTML=hits.map(function(x){
    var p=S.profiles[x],first=p.desc?String(p.desc).split('\n')[0]:'';
    return '<button type="button" data-sg="'+esc(x)+'"><b>'+esc(p.type==='mesa'?'⭐ ':'')+esc(p.name)+' <span class="muted">'+esc(splitText(p.n||1,p.m||0,p.f||0))+'</span></b>'
      +(first?'<span class="sub">'+esc(first.slice(0,60))+'</span>':'')+'</button>';
  }).join('');
  box.hidden=false;
}

function renderLists(){
  ensureClub();
  var today=nightDate();
  $('#dayLabel').innerHTML='<span class="dl">'+esc(fmtLong(LV.date))+' ▾</span>'+(LV.date===today?'<small>Esta noche</small>':'<small>Toca para abrir el calendario</small>');
  var sel=$('#clubSel');sel.innerHTML=S.clubs.map(function(c){return '<option value="'+esc(c.id)+'"'+(c.id===LV.club?' selected':'')+'>'+esc(c.name)+'</option>'}).join('');sel.disabled=!S.clubs.length;
  var out=$('#listOut'),sum=$('#sumBar');
  if(!S.clubs.length){
    sum.innerHTML='';
    out.innerHTML='<div class="card empty"><b>Primero añade una discoteca</b>Ve a la pestaña Discotecas y crea la primera.</div>';
    return;
  }
  var list=dayEntries(),c=club(LV.club);
  var tot=0,inn=0,mesas=0,rej=0;
  list.forEach(function(e){tot+=heads(e);if(e.rejected)rej+=heads(e);if(e.entered){inn+=heads(e);if(e.type==='mesa')mesas++}});
  var s='<span><b class="num">'+inn+'</b> de '+tot+' dentro</span>';
  if(mesas)s+='<span>⭐ <b class="num">'+mesas+'</b></span>';
  if(rej)s+='<span>🚫 <b class="num">'+rej+'</b> rechazados</span>';
  if(c&&c.bonusEvery>0&&c.bonusAmount>0){
    var got=Math.floor(inn/c.bonusEvery)*c.bonusAmount,left=c.bonusEvery-(inn%c.bonusEvery);
    s+='<span>Bonus <b class="num">'+esc(eur(got))+'</b> · faltan '+left+' para el siguiente</span>';
  }
  sum.innerHTML=s;
  if(!list.length){
    out.innerHTML='<div class="card empty"><b>Nada apuntado</b>Escribe el nombre y pon cuántas chicas y chicos vienen.</div>';
    return;
  }
  var h='<div class="card" style="padding:4px 14px"><ul class="list">';
  list.forEach(function(e){
    var pr=profileOf(e.name),d=pr&&pr.desc;
    h+='<li class="person'+(e.entered?' in':'')+(e.rejected?' rej':'')+'">'
      +'<button class="row-main" type="button" data-act="toggle" data-id="'+esc(e.id)+'" aria-pressed="'+(!!e.entered)+'" aria-label="'+esc(e.name)+': '+(e.entered?'ha entrado':'pendiente')+'">'
      +'<span class="ring">'+ICON_CHECK+'</span>'
      +'<span><span class="nm">'+(e.type==='mesa'?'<span aria-label="mesa">⭐</span>':'')+'<span>'+esc(e.name)+'</span>'+pillsFor(e)
      +(hasNum(e.extra)&&+e.extra>0?'<span class="tag" style="color:var(--s3)">Host '+esc(eur(+e.extra))+'</span>':'')
      +(e.rejected?'<span class="tag" style="color:var(--crit)">Rechazado</span>':'')
      +(e.type==='pago'?'<span class="tag" style="color:var(--s2)">PAGO'+(e.promoter?' · '+esc(e.promoter):'')+'</span>':'')+'</span>'
      +(d?'<span class="desc" style="display:block;white-space:pre-line">'+linkify(d)+'</span>':'')
      +'</span></button>'
      +'<button class="rejbtn" type="button" data-act="reject" data-id="'+esc(e.id)+'" aria-pressed="'+(!!e.rejected)+'" aria-label="'+(e.rejected?'Quitar rechazo de ':'Rechazar a ')+esc(e.name)+'">✕</button>'
      +'<button class="dots" type="button" data-act="edit" data-id="'+esc(e.id)+'" aria-label="Editar '+esc(e.name)+'">⋯</button>';
    if(LV.edit===e.id)h+=editPanel(e);
    h+='</li>';
  });
  h+='</ul></div>';
  out.innerHTML=h;
}

function editPanel(e){
  var pr=profileOf(e.name)||{},id=esc(e.id),sp=hasSplit(e);
  var h='<div class="edit">'
    +'<label class="f" for="e-name">Nombre<input class="in" id="e-name" type="text" value="'+esc(e.name)+'"></label>'
    +'<div class="grid2">'
    +'<label class="f cnt f-g" for="e-f"><span>Chicas</span><input class="in num" id="e-f" type="number" inputmode="numeric" min="0" value="'+(sp?e.f:0)+'"></label>'
    +'<label class="f cnt f-b" for="e-m"><span>Chicos</span><input class="in num" id="e-m" type="number" inputmode="numeric" min="0" value="'+(sp?e.m:0)+'"></label>'
    +'</div>'
    +(sp?'':'<div class="sub">Ahora cuenta '+plural(e.n,'persona','personas')+' sin desglose. Si dejas 0 y 0 se mantiene.</div>')
    +'<div class="grid2">'
    +'<label class="f" for="e-club">Discoteca<select class="in" id="e-club">'+S.clubs.map(function(c){return '<option value="'+esc(c.id)+'"'+(c.id===e.clubId?' selected':'')+'>'+esc(c.name)+'</option>'}).join('')+'</select></label>'
    +'<label class="f" for="e-type">Tipo<select class="in" id="e-type"><option value="lista"'+(e.type==='lista'?' selected':'')+'>Lista</option><option value="mesa"'+(e.type==='mesa'?' selected':'')+'>⭐ Mesa</option><option value="pago"'+(e.type==='pago'?' selected':'')+'>PAGO</option></select></label>'
    +'</div>'
    +'<label class="f" for="e-desc">Descripción / Instagram / acompañantes<textarea class="in" id="e-desc" rows="3">'+esc(pr.desc||'')+'</textarea></label>'
    +'<label class="f" for="e-extra">Extra Host (£)<input class="in num" id="e-extra" type="number" inputmode="decimal" min="0" step="10" value="'+esc(hasNum(e.extra)?e.extra:'')+'"></label>';
  if(e.type==='pago'){
    h+='<label class="f" for="e-prom">Promotor que lo envía<input class="in" id="e-prom" list="promoters" type="text" value="'+esc(e.promoter||'')+'"></label>'
      +'<label class="f" for="e-payout">A pagarle (£, vacío = lo que paga la sala)<input class="in num" id="e-payout" type="number" inputmode="decimal" min="0" step="0.5" value="'+esc(hasNum(e.payout)?e.payout:'')+'"></label>'
      +'<label style="display:flex;gap:10px;align-items:center;min-height:44px"><input type="checkbox" id="e-paid"'+(e.paid?' checked':'')+'> Ya le he pagado</label>';
  }
  if(e.type==='mesa'){var cl=club(e.clubId),pc=cl?(+cl.pctMesa||0):0;
    h+='<label class="f" for="e-spend">Consumo de la mesa (£) · comisión '+pc+'%'+(hasNum(e.spend)?' = '+esc(eur(pc/100*(+e.spend))):'')+'<input class="in num" id="e-spend" type="number" inputmode="decimal" min="0" step="1" value="'+esc(hasNum(e.spend)?e.spend:'')+'"></label>'}
  h+=''
    +'<div class="actions"><div style="display:flex;gap:8px"><button class="btn" type="button" data-act="save" data-id="'+id+'">Guardar</button><button class="btn ghost" type="button" data-act="cancel">Cancelar</button></div>'
    +(LV.confirmDel===e.id?'<button class="btn danger" type="button" data-act="del2" data-id="'+id+'">Sí, borrar</button>':'<button class="btn ghost" type="button" data-act="del" data-id="'+id+'">Borrar</button>')
    +'</div></div>';
  return h;
}

function findEntry(id){return S.entries.filter(function(e){return e.id===id})[0]}

function saveEdit(id){
  var e=findEntry(id);if(!e)return;
  var name=$('#e-name').value.trim();
  if(!name){toast('Pon un nombre.');return}
  var c=readCounts('#e-f','#e-m'),oldKey=pkey(e.name),keep=!hasSplit(e)&&e.n>1&&c.f+c.m===0;
  e.name=name;e.clubId=$('#e-club').value;e.type=$('#e-type').value;
  if(!keep){e.m=c.m;e.f=c.f;e.n=Math.max(1,c.m+c.f)}
  var sp=$('#e-spend')?$('#e-spend').value:'';e.amount=null;if($('#e-spend'))e.spend=sp===''?null:+sp;
  var ex=$('#e-extra').value;if(ex===''||+ex<=0)delete e.extra;else e.extra=+ex;
  if(e.type==='pago'){
    e.promoter=($('#e-prom')?$('#e-prom').value.trim():e.promoter)||'';
    var po=$('#e-payout')?$('#e-payout').value:'';e.payout=po===''?null:+po;
    e.paid=$('#e-paid')?$('#e-paid').checked:e.paid;
  }else{e.promoter='';e.payout=null;e.paid=false}
  delete e.demo;
  if(oldKey!==pkey(name)&&S.profiles[oldKey]&&!S.entries.some(function(x){return x!==e&&pkey(x.name)===oldKey})){
    S.profiles[pkey(name)]=S.profiles[pkey(name)]||S.profiles[oldKey];delete S.profiles[oldKey];
  }
  upsertProfile(name,{clubId:e.clubId,type:e.type,n:e.n,m:e.m,f:e.f,desc:$('#e-desc').value.trim(),promoter:e.promoter});
  delete S.profiles[pkey(name)].demo;
  LV.date=e.date;LV.club=e.clubId;LV.edit=null;LV.confirmDel=null;
  save();renderAll();
}

function addEntry(extra){
  if(!LV.club)return;
  var name=$('#f-name').value.trim();
  if(!name&&extra)name='Host';
  if(!name){toast('Escribe el nombre.');$('#f-name').focus();return}
  var k=pkey(name);
  if(!(extra&&name==='Host')&&dayEntries().some(function(e){return pkey(e.name)===k})){toast(name+' ya está apuntado en esta lista.');return}
  var c=readCounts('#f-f','#f-m'),pr=S.profiles[k],n=c.f+c.m;
  if(n===0){if(pr&&pr.n&&!extra){n=pr.n;c.m=pr.m||0;c.f=pr.f||0}else n=1}
  var prom=LV.type==='pago'?($('#f-promoter').value.trim()||(pr&&pr.promoter)||''):'';
  var e={id:uid(),date:LV.date,clubId:LV.club,name:name,type:LV.type,n:n,m:c.m,f:c.f,names:[],entered:false,amount:null,promoter:prom,payout:null,paid:false,ts:Date.now()};
  if(extra)e.extra=extra;
  S.entries.push(e);
  if(!(extra&&name==='Host')){upsertProfile(name,{clubId:LV.club,type:LV.type,n:n,m:c.m,f:c.f,promoter:prom});delete S.profiles[k].demo}
  save();
  $('#f-name').value='';$('#f-f').value='0';$('#f-m').value='0';$('#f-promoter').value='';
  $('#sugg').hidden=true;
  renderHint();renderForm();renderLists();
  $('#f-name').focus();
}

/* calendario para saltar entre noches: azul = hay lista, ⭐ = hay mesa */
var CAL={open:false,month:''};
function dayInfo(){
  var m={};
  S.entries.forEach(function(e){var x=m[e.date]||(m[e.date]={n:0,mesa:false});x.n++;if(e.type==='mesa')x.mesa=true});
  return m;
}
function renderCal(){
  var root=$('#calRoot');
  if(!CAL.open){root.innerHTML='';return}
  var p=CAL.month.split('-'),y=+p[0],mo=+p[1]-1,off=(new Date(y,mo,1).getDay()+6)%7,dim=new Date(y,mo+1,0).getDate(),info=dayInfo(),today=nightDate();
  var h='<div class="scrim" id="calScrim"><div class="sheet" role="dialog" aria-modal="true" aria-label="Elegir noche">'
    +'<div class="cal-head"><button type="button" class="cal-nav" data-cal="prev" aria-label="Mes anterior">‹</button><h2>'+esc(monthName(CAL.month))+'</h2><button type="button" class="cal-nav" data-cal="next" aria-label="Mes siguiente">›</button></div>'
    +'<div class="cal-grid cal-dow">'+['L','M','X','J','V','S','D'].map(function(x){return '<span>'+x+'</span>'}).join('')+'</div>'
    +'<div class="cal-grid">';
  for(var i=0;i<off;i++)h+='<span></span>';
  for(var d=1;d<=dim;d++){
    var date=iso(new Date(y,mo,d)),x=info[date];
    h+='<button type="button" class="cal-d'+(x?' has':'')+(date===LV.date?' sel':'')+(date===today?' today':'')+'" data-cal-day="'+date+'" aria-label="'+esc(fmtLong(date))+(x?', hay lista':'')+(x&&x.mesa?' con mesa':'')+'">'+d+(x&&x.mesa?'<i class="st">⭐</i>':'')+'</button>';
  }
  h+='</div><div class="cal-legend"><span><i class="lg"></i>Hay lista</span><span>⭐ Hay mesa</span></div>'
    +'<div class="cal-foot"><button type="button" class="btn ghost small" data-cal="today">Hoy</button><button type="button" class="btn small" data-cal="close">Cerrar</button></div></div></div>';
  root.innerHTML=h;
}
function openCal(){CAL.open=true;CAL.month=LV.date.slice(0,7);renderCal()}
function closeCal(){CAL.open=false;renderCal()}
function shiftMonth(k,n){var p=k.split('-'),d=new Date(+p[0],+p[1]-1+n,1);return d.getFullYear()+'-'+pad(d.getMonth()+1)}

function bindLists(){
  $('#dayPrev').onclick=function(){LV.date=addDays(LV.date,-1);LV.edit=null;renderLists()};
  $('#dayNext').onclick=function(){LV.date=addDays(LV.date,1);LV.edit=null;renderLists()};
  $('#dayLabel').onclick=openCal;
  $('#calRoot').addEventListener('click',function(ev){
    if(ev.target.id==='calScrim'){closeCal();return}
    var dd=ev.target.closest('[data-cal-day]');
    if(dd){LV.date=dd.dataset.calDay;LV.edit=null;closeCal();renderLists();return}
    var b=ev.target.closest('[data-cal]');if(!b)return;
    var a=b.dataset.cal;
    if(a==='prev'){CAL.month=shiftMonth(CAL.month,-1);renderCal()}
    else if(a==='next'){CAL.month=shiftMonth(CAL.month,1);renderCal()}
    else if(a==='today'){LV.date=nightDate();LV.edit=null;closeCal();renderLists()}
    else if(a==='close')closeCal();
  });
  document.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&CAL.open)closeCal()});
  $('#clubSel').addEventListener('change',function(){LV.club=this.value;LV.edit=null;renderLists()});
  $$('input[name="f-type"]').forEach(function(r){r.addEventListener('change',function(){LV.type=r.value;renderForm();renderHint()})});
  $('#f-name').addEventListener('input',function(){renderHint();renderSugg()});
  $('#f-name').addEventListener('blur',function(){setTimeout(function(){$('#sugg').hidden=true},180)});
  ['#f-f','#f-m'].forEach(function(s){
    $(s).addEventListener('focus',function(){var t=this;setTimeout(function(){try{t.select()}catch(e){}},0)});
    $(s).addEventListener('input',renderHint);
  });
  $('#sugg').addEventListener('click',function(ev){
    var b=ev.target.closest('[data-sg]');if(!b)return;
    var p=S.profiles[b.dataset.sg];if(!p)return;
    $('#f-name').value=p.name;
    $('#f-f').value=p.f||0;$('#f-m').value=p.m||0;
    if(!(p.m||p.f)&&p.n>1)$('#f-f').value=0;
    LV.type=p.type||'lista';
    if(LV.type==='pago'&&p.promoter)$('#f-promoter').value=p.promoter;
    $('#sugg').hidden=true;renderForm();renderHint();$('#f-name').focus();
  });
  $('#addForm').addEventListener('submit',function(ev){ev.preventDefault();addEntry(0)});
  $$('.hostbtn').forEach(function(b){b.addEventListener('click',function(){addEntry(+b.dataset.host)})});
  $('#listOut').addEventListener('click',function(ev){
    var b=ev.target.closest('[data-act]');if(!b)return;
    var a=b.dataset.act,id=b.dataset.id,e=id?findEntry(id):null;
    if(a==='toggle'&&e){e.entered=!e.entered;if(e.entered)e.rejected=false;save();renderLists()}
    else if(a==='reject'&&e){e.rejected=!e.rejected;if(e.rejected)e.entered=false;save();renderLists()}
    else if(a==='edit'&&e){LV.edit=LV.edit===id?null:id;LV.confirmDel=null;renderLists()}
    else if(a==='cancel'){LV.edit=null;LV.confirmDel=null;renderLists()}
    else if(a==='save')saveEdit(id);
    else if(a==='del'){LV.confirmDel=id;renderLists()}
    else if(a==='del2'&&e){
      var before=snap();
      S.entries=S.entries.filter(function(x){return x.id!==id});
      LV.edit=null;LV.confirmDel=null;save();renderLists();
      toast(e.name+' borrado.',function(){restoreSnap(before)});
    }
  });
}

/* =========================== FACTURAS (INVOICES) =========================== */
function me(){return S.me||(S.me={})}
function isHostEntry(e){return hasNum(e.extra)&&+e.extra>0&&String(e.name).trim().toLowerCase()==='host'}
function fmtEn(s){return parse(s).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
function fmtEnD(s){return parse(s).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}
function lines(t){return esc(t||'').replace(/\n/g,'<br>')}
var IV={open:false,from:'',to:'',view:null};
var INV_CSS='.invdoc{background:#fff;color:#111;max-width:760px;margin:12px auto;padding:34px 30px;font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;border-radius:6px;box-shadow:0 2px 14px rgba(0,0,0,.18)}'
+'.invdoc h1{margin:0;font-size:30px;letter-spacing:.06em;font-weight:800}'
+'.invdoc .ihead{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start}'
+'.invdoc .imeta{border-collapse:collapse;font-size:13px}.invdoc .imeta td{padding:2px 0 2px 14px;text-align:right}.invdoc .imeta td:first-child{color:#666;text-align:left;padding-left:0}'
+'.invdoc .iparties{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:26px 0 20px}'
+'.invdoc .iparties h3{margin:0 0 4px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#777}'
+'.invdoc table.ilines{width:100%;border-collapse:collapse;font-size:13px}'
+'.invdoc .ilines th{text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#777;border-bottom:2px solid #111;padding:6px 4px}'
+'.invdoc .ilines td{padding:7px 4px;border-bottom:1px solid #e3e3e3;vertical-align:top}'
+'.invdoc .ir{text-align:right;white-space:nowrap}'
+'.invdoc .itot{margin:14px 0 0 auto;width:260px;font-size:13px}.invdoc .itot div{display:flex;justify-content:space-between;padding:3px 0}'
+'.invdoc .itot .ig{border-top:2px solid #111;margin-top:4px;padding-top:7px;font-size:17px;font-weight:800}'
+'.invdoc .ipay{margin-top:26px;padding-top:12px;border-top:1px solid #ddd;font-size:13px}.invdoc .ipay h3{margin:0 0 4px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#777}'
+'.invdoc .imiss{color:#c0392b}.invdoc .inone{color:#777;padding:18px 0}'
+'@media (max-width:560px){.invdoc{padding:22px 16px}.invdoc .iparties{grid-template-columns:1fr}.invdoc .itot{width:100%}}'
+'@media print{.invdoc{box-shadow:none;margin:0;max-width:none;border-radius:0;padding:0;break-after:page;page-break-after:always}.invdoc:last-child{break-after:auto;page-break-after:auto}}';

/* líneas de factura de una discoteca entre dos noches (solo lo que ha entrado) */
function invData(c,a,b){
  var days={},BM=bonusMap(),rows=[],sub=0;
  function day(d){return days[d]||(days[d]={li:{n:0,a:0},me:{n:0,sp:0,a:0},ho:{n:0,a:0},bo:0})}
  S.entries.forEach(function(e){
    if(e.clubId!==c.id||!e.entered||e.rejected||e.date<a||e.date>b)return;
    var d=day(e.date),x=amt(e);
    if(isHostEntry(e)){d.ho.n++;d.ho.a+=x}
    else if(e.type==='mesa'){d.me.n++;d.me.sp+=hasNum(e.spend)?+e.spend:0;d.me.a+=x}
    else{d.li.n+=heads(e);d.li.a+=x}
  });
  Object.keys(BM).forEach(function(k){var p=k.split('|');if(p[0]===c.id&&p[1]>=a&&p[1]<=b)day(p[1]).bo=BM[k]});
  Object.keys(days).sort().forEach(function(date){
    var d=days[date];
    if(d.li.n&&d.li.a>0)rows.push({date:date,desc:'Guest list · '+d.li.n+(d.li.n===1?' guest':' guests')+' entered',qty:d.li.n,unit:d.li.a/d.li.n,amount:d.li.a});
    if(d.me.n&&d.me.a>0)rows.push({date:date,desc:'Table commission · '+d.me.n+(d.me.n===1?' table':' tables')+(d.me.sp>0?' · spend '+eur(d.me.sp):'')+(+c.pctMesa>0?' @ '+c.pctMesa+'%':''),qty:1,unit:d.me.a,amount:d.me.a});
    if(d.ho.n&&d.ho.a>0)rows.push({date:date,desc:'Host fee'+(d.ho.n>1?' × '+d.ho.n:''),qty:d.ho.n,unit:d.ho.a/d.ho.n,amount:d.ho.a});
    if(d.bo>0)rows.push({date:date,desc:'Attendance bonus'+(+c.bonusEvery>0?' (every '+c.bonusEvery+' guests)':''),qty:1,unit:d.bo,amount:d.bo});
  });
  rows.forEach(function(r){sub+=r.amount});
  return {rows:rows,sub:sub,nights:Object.keys(days).length};
}
function invNo(c,b){return (me().prefix||'INV')+'-'+b.replace(/-/g,'')+'-'+(S.clubs.indexOf(c)+1)}
function invoiceHtml(c,a,b,d){
  var m=me(),bl=c.bill||{},vat=+m.vat||0,vatAmt=d.sub*vat/100,total=d.sub+vatAmt,today=nightDate();
  var terms=hasNum(m.terms)?+m.terms:14;
  var from=(m.name||m.trade)?'<b>'+esc(m.trade||m.name)+'</b>'+(m.trade&&m.name?'<br>'+esc(m.name):'')+(m.addr?'<br>'+lines(m.addr):'')+(m.email?'<br>'+esc(m.email):'')+(m.phone?'<br>'+esc(m.phone):'')+(m.taxId?'<br>'+esc(m.taxId):''):'<span class="imiss">Add your details in Discotecas › Mis datos de facturación</span>';
  var to='<b>'+esc(bl.name||c.name)+'</b>'+(bl.addr?'<br>'+lines(bl.addr):'')+(bl.email?'<br>'+esc(bl.email):'')+(bl.taxId?'<br>'+esc(bl.taxId):'')+(bl.ref?'<br>Ref: '+esc(bl.ref):'')+((bl.addr||bl.name)?'':'<br><span class="imiss">Add billing details in Discotecas</span>');
  var h='<section class="invdoc"><div class="ihead"><div><h1>INVOICE</h1></div><table class="imeta">'
    +'<tr><td>Invoice no.</td><td><b>'+esc(invNo(c,b))+'</b></td></tr>'
    +'<tr><td>Date</td><td>'+esc(fmtEn(today))+'</td></tr>'
    +'<tr><td>Period</td><td>'+esc(fmtEn(a))+' – '+esc(fmtEn(b))+'</td></tr>'
    +'<tr><td>Venue</td><td>'+esc(c.name)+'</td></tr>'
    +'<tr><td>Due date</td><td>'+esc(fmtEn(addDays(today,terms)))+'</td></tr></table></div>'
    +'<div class="iparties"><div><h3>From</h3>'+from+'</div><div><h3>Bill to</h3>'+to+'</div></div>'
    +'<table class="ilines"><thead><tr><th>Date</th><th>Description</th><th class="ir">Qty</th><th class="ir">Unit price</th><th class="ir">Amount</th></tr></thead><tbody>';
  d.rows.forEach(function(r){h+='<tr><td>'+esc(fmtEnD(r.date))+'</td><td>'+esc(r.desc)+'</td><td class="ir">'+r.qty+'</td><td class="ir">'+esc(eur(r.unit))+'</td><td class="ir">'+esc(eur(r.amount))+'</td></tr>'});
  if(!d.rows.length)h+='<tr><td colspan="5" class="inone">No billable activity in this period.</td></tr>';
  h+='</tbody></table><div class="itot"><div><span>Subtotal</span><span>'+esc(eur(d.sub))+'</span></div>'
    +(vat>0?'<div><span>VAT ('+vat+'%)</span><span>'+esc(eur(vatAmt))+'</span></div>':'')
    +'<div class="ig"><span>Total due</span><span>'+esc(eur(total))+'</span></div></div>'
    +'<div class="ipay"><h3>Payment details</h3>'+(m.bank?lines(m.bank):'<span class="imiss">Add your bank details in Discotecas › Mis datos de facturación</span>')
    +'<div style="margin-top:8px;color:#666">Payment due within '+terms+' days of invoice date.</div></div></section>';
  return h;
}
function invList(){
  var a=IV.from,b=IV.to,out=[];
  if(!a||!b||a>b)return out;
  S.clubs.forEach(function(c){var d=invData(c,a,b);if(d.rows.length)out.push({c:c,d:d})});
  return out;
}
function renderInv(){
  var root=$('#invRoot');
  if(!IV.open){root.innerHTML='';return}
  if(IV.view){
    var L=invList().filter(function(x){return IV.view==='all'||x.c.id===IV.view});
    root.innerHTML='<div class="invview"><div class="invbar"><button type="button" class="btn ghost small" data-iv="back">‹ Volver</button>'
      +'<button type="button" class="btn small" data-iv="print">Imprimir / PDF</button><button type="button" class="btn ghost small" data-iv="save">Guardar archivo</button></div>'
      +'<style>'+INV_CSS+'</style>'+L.map(function(x){return invoiceHtml(x.c,IV.from,IV.to,x.d)}).join('')+'</div>';
    return;
  }
  var h='<div class="scrim" id="ivScrim"><div class="sheet" role="dialog" aria-modal="true" aria-label="Crear invoice">'
    +'<div class="row-between"><h2>Crear invoice</h2><button class="btn ghost small" type="button" data-iv="close">Cerrar</button></div>'
    +'<p class="sub" style="margin:6px 0 10px">Elige las fechas y se crea una invoice por cada discoteca con lo que ha entrado en ese periodo.</p>'
    +'<div class="chips" style="margin-bottom:10px"><button class="chip" type="button" data-iv="p-sem">Esta semana</button><button class="chip" type="button" data-iv="p-mes">Este mes</button><button class="chip" type="button" data-iv="p-ant">Mes anterior</button></div>'
    +'<div class="grid2"><label class="f" for="iv-from">Fecha de inicio<input class="in" type="date" id="iv-from" value="'+esc(IV.from)+'"></label>'
    +'<label class="f" for="iv-to">Fecha de fin<input class="in" type="date" id="iv-to" value="'+esc(IV.to)+'"></label></div>'
    +'<div id="ivList"></div></div></div>';
  root.innerHTML=h;renderInvList();
}
function renderInvList(){
  var box=$('#ivList');if(!box)return;
  var L=invList(),h='';
  if(!IV.from||!IV.to||IV.from>IV.to){box.innerHTML='<div class="sub" style="margin-top:14px">Pon una fecha de inicio y otra de fin (el inicio no puede ser posterior).</div>';return}
  if(!L.length){box.innerHTML='<div class="empty" style="padding:22px 6px"><b>Nada que facturar</b>No hay guests marcados como entrados en ese periodo.</div>';return}
  var tot=0;
  L.forEach(function(x){
    var bl=x.c.bill||{},ok=bl.name&&bl.addr;tot+=x.d.sub;
    h+='<div class="ivrow"><div><b>'+esc(x.c.name)+'</b><div class="sub">'+plural(x.d.nights,'noche','noches')+(ok?'':' · <span style="color:var(--crit)">faltan datos de facturación</span>')+'</div></div>'
      +'<div style="display:flex;align-items:center;gap:10px"><b class="num">'+esc(eur(x.d.sub))+'</b><button class="btn ghost small" type="button" data-iv="view" data-cid="'+esc(x.c.id)+'">Ver</button></div></div>';
  });
  h+='<div class="ivrow"><div><b>Total</b></div><b class="num">'+esc(eur(tot))+'</b></div>';
  h+='<button class="btn" type="button" data-iv="all" style="width:100%;margin-top:12px">Crear '+(L.length===1?'la invoice':'las '+L.length+' invoices')+'</button>';
  var m=me();
  if(!m.name&&!m.trade)h+='<div class="sub" style="margin-top:10px;color:var(--crit)">Rellena «Mis datos de facturación» en la pestaña Discotecas para que salgan en la invoice.</div>';
  box.innerHTML=h;
}
function invSetRange(k){
  var t=nightDate(),p=parse(t);
  if(k==='sem'){IV.from=weekStart(t);IV.to=addDays(IV.from,6)}
  else if(k==='mes'){IV.from=iso(new Date(p.getFullYear(),p.getMonth(),1));IV.to=iso(new Date(p.getFullYear(),p.getMonth()+1,0))}
  else{IV.from=iso(new Date(p.getFullYear(),p.getMonth()-1,1));IV.to=iso(new Date(p.getFullYear(),p.getMonth(),0))}
}
function openInv(){
  if(!IV.from||!IV.to)invSetRange('mes');
  IV.open=true;IV.view=null;renderInv();
}
function invFile(){
  var L=invList().filter(function(x){return IV.view==='all'||x.c.id===IV.view});
  var body=L.map(function(x){return invoiceHtml(x.c,IV.from,IV.to,x.d)}).join('');
  var name=IV.view==='all'?'Invoices-'+IV.from+'_'+IV.to:'Invoice-'+(L[0]?invNo(L[0].c,IV.to):'')+'';
  var html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(name)+'</title><style>body{margin:0;background:#e9e9ec}'+INV_CSS+'</style></head><body>'+body+'</body></html>';
  return {name:name+'.html',html:html};
}
function invSave(){
  var f=invFile();
  try{
    var file=new File([f.html],f.name,{type:'text/html'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){
      navigator.share({files:[file],title:f.name}).catch(function(e){if(e&&e.name==='AbortError')return;toast('No se pudo guardar el archivo.')});
      return;
    }
  }catch(e){}
  try{
    var url=URL.createObjectURL(new Blob([f.html],{type:'text/html'})),a=document.createElement('a');
    a.href=url;a.download=f.name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url)},4000);toast('Archivo descargado');
  }catch(e){toast('No se pudo guardar el archivo.')}
}
function invPrint(){
  var old=document.title,L=invList().filter(function(x){return IV.view==='all'||x.c.id===IV.view});
  document.title=IV.view==='all'?'Invoices '+IV.from+' '+IV.to:(L[0]?invNo(L[0].c,IV.to):old);
  var back=function(){document.title=old;window.removeEventListener('afterprint',back)};
  window.addEventListener('afterprint',back);
  try{window.print()}catch(e){document.title=old;toast('No se pudo abrir la impresión. Usa Guardar archivo.')}
}

/* datos de facturación: los tuyos (promoter) y los de cada discoteca */
function bf(scope,key,label,val,kind){
  var id='bf-'+scope+'-'+key,a=' id="'+id+'" data-bs="'+esc(scope)+'" data-bk="'+key+'"';
  if(kind==='ta')return '<label class="f" for="'+id+'">'+label+'<textarea class="in"'+a+' rows="3">'+esc(val||'')+'</textarea></label>';
  if(kind==='num')return '<label class="f" for="'+id+'">'+label+'<input class="in num"'+a+' type="number" inputmode="decimal" min="0" step="1" value="'+esc(val==null?'':val)+'"></label>';
  return '<label class="f" for="'+id+'">'+label+'<input class="in"'+a+' type="text" value="'+esc(val||'')+'"></label>';
}
function augmentClubs(out){
  var m=me();
  out.insertAdjacentHTML('afterbegin','<details class="card billbox" id="meBox"><summary class="btn ghost small">Mis datos de facturación (promoter)</summary><div class="stack" style="margin-top:12px">'
    +'<div class="sub">Salen como «From» en las invoices.</div>'
    +bf('me','name','Tu nombre completo',m.name)+bf('me','trade','Nombre comercial / empresa (opcional)',m.trade)
    +bf('me','addr','Dirección',m.addr,'ta')+bf('me','email','Email',m.email)+bf('me','phone','Teléfono',m.phone)
    +bf('me','taxId','UTR / VAT / Company no. (opcional)',m.taxId)
    +bf('me','bank','Datos bancarios (titular, sort code, cuenta / IBAN)',m.bank,'ta')
    +'<div class="grid2">'+bf('me','prefix','Prefijo de invoice',m.prefix||'')+bf('me','terms','Días para pagar',hasNum(m.terms)?m.terms:14,'num')+'</div>'
    +bf('me','vat','VAT % (0 si no aplica)',m.vat||0,'num')+'</div></details>');
  $$('.card',out).forEach(function(card){
    var i=card.querySelector('[data-cid]');if(!i||card.id==='meBox')return;
    var c=club(i.dataset.cid);if(!c)return;var b=c.bill||{},id=esc(c.id);
    card.insertAdjacentHTML('beforeend','<details class="billbox club"><summary class="btn ghost small">Datos de facturación</summary><div class="stack" style="margin-top:12px">'
      +bf(id,'name','Razón social (a quién se factura)',b.name)+bf(id,'addr','Dirección',b.addr,'ta')+bf(id,'email','Email de facturación',b.email)
      +bf(id,'taxId','VAT / Company no. (opcional)',b.taxId)+bf(id,'ref','Referencia / PO (opcional)',b.ref)+'</div></details>');
  });
}
function bindInvoice(){
  $('#btnInvoice').onclick=openInv;
  $('#invRoot').addEventListener('click',function(ev){
    if(ev.target.id==='ivScrim'){IV.open=false;renderInv();return}
    var b=ev.target.closest('[data-iv]');if(!b)return;
    var a=b.dataset.iv;
    if(a==='close'){IV.open=false;renderInv()}
    else if(a.indexOf('p-')===0){invSetRange(a.slice(2));renderInv()}
    else if(a==='view'){IV.view=b.dataset.cid;renderInv();$('#invRoot').firstChild.scrollTop=0}
    else if(a==='all'){IV.view='all';renderInv();$('#invRoot').firstChild.scrollTop=0}
    else if(a==='back'){IV.view=null;renderInv()}
    else if(a==='print')invPrint();
    else if(a==='save')invSave();
  });
  $('#invRoot').addEventListener('change',function(ev){
    var t=ev.target;
    if(t.id==='iv-from'){IV.from=t.value;renderInvList()}
    else if(t.id==='iv-to'){IV.to=t.value;renderInvList()}
  });
  $('#clubsOut').addEventListener('change',function(ev){
    var t=ev.target,sc=t.dataset&&t.dataset.bs;if(!sc)return;
    var k=t.dataset.bk,v=t.type==='number'?(t.value===''?'':Math.max(0,parseFloat(t.value)||0)):t.value.trim(),o;
    if(sc==='me')o=me();else{var c=club(sc);if(!c)return;o=c.bill||(c.bill={})}
    o[k]=v;if(t.type==='number')t.value=v;
    delete (club(sc)||{}).demo;save();
  });
  document.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&IV.open){if(IV.view){IV.view=null}else IV.open=false;renderInv()}});
}

/* =========================== AJUSTES, COPIA, ARRANQUE =========================== */
var SH={open:false,confirm:null}, DL=null;

function renderSheet(){
  var root=$('#sheetRoot');
  if(!SH.open){root.innerHTML='';return}
  var h='<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetT">'
    +'<div class="row-between"><h2 id="sheetT">Ajustes</h2><button class="btn ghost small" type="button" data-sa="close" id="sheetClose">Cerrar</button></div>';
  h+=''
    +'<h2 style="margin:24px 0 0;font-size:15px">Copia de seguridad</h2>'
    +'<p class="sub" style="margin:4px 0 0">Los datos se guardan en este navegador. Descarga una copia de vez en cuando por si cambias de móvil o borras los datos del navegador.</p>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'
    +'<button class="btn" type="button" data-sa="backup">Guardar copia</button>'
    +'<label class="btn ghost" for="restoreFile" style="display:inline-flex;align-items:center;cursor:pointer">Restaurar copia</label>'
    +'<input id="restoreFile" type="file" accept=".json,application/json" style="position:absolute;opacity:0;width:1px;height:1px">'
    +'</div>'
    +(hasDemo()?'<h2 style="margin:24px 0 0;font-size:15px">Datos de ejemplo</h2><button class="btn ghost" type="button" data-sa="cleardemo" style="margin-top:8px">Borrar ejemplos y empezar</button>':'')
    +'</div></div>';
  root.innerHTML=h;
}
function openSheet(){SH.open=true;SH.confirm=null;renderSheet();var b=$('#sheetClose');if(b)b.focus()}
function closeSheet(){SH.open=false;SH.confirm=null;renderSheet();renderAll();$('#btnClubs').focus()}

function backup(){
  var fname='nereas-guest-list-'+nightDate()+'.json',text=JSON.stringify(S,null,2);
  if(DL){
    DL.save({filename:fname,data:text})
      .then(function(){toast('Copia guardada')})
      .catch(function(e){if(e&&e.code==='declined')return;toast('No se pudo guardar la copia.')});
    return;
  }
  // fuera del visor (app instalada): hoja de compartir del iPhone, o descarga normal
  try{
    var file=new File([text],fname,{type:'application/json'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){
      navigator.share({files:[file],title:'Copia de Nerea’s Guest List'})
        .then(function(){toast('Copia guardada')})
        .catch(function(e){if(e&&e.name==='AbortError')return;toast('No se pudo guardar la copia.')});
      return;
    }
  }catch(e){}
  try{
    var url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');
    a.href=url;a.download=fname;document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url)},4000);toast('Copia descargada');
  }catch(e){toast('No se pudo guardar la copia.')}
}
function restoreFile(file){
  if(!file)return;
  var rd=new FileReader();
  rd.onload=function(){
    try{
      var o=migrate(JSON.parse(rd.result));if(!o)throw new Error('formato');
      var before=snap();S=o;save();LV.edit=null;SH.open=false;renderSheet();renderAll();
      toast('Copia restaurada: '+o.entries.length+' guests y '+o.clubs.length+' discotecas.',function(){restoreSnap(before)});
    }catch(e){toast('Ese archivo no es una copia válida.')}
  };
  rd.onerror=function(){toast('No se pudo leer el archivo.')};
  rd.readAsText(file);
}

/* ---------- pestaña Discotecas ---------- */
function renderClubs(){
  var out=$('#clubsOut');if(!out)return;
  var h='';
  if(!S.clubs.length)h+='<div class="card empty"><b>Aún no hay discotecas</b>Añade la primera: lo que te pagan por persona de lista, el % de las mesas y el bonus.</div>';
  S.clubs.forEach(function(c){
    var id=esc(c.id),n=S.entries.filter(function(e){return e.clubId===c.id}).length;
    h+='<div class="card"><div class="club-edit" style="border-top:0;padding:0">'
      +'<label class="f name" for="cn-'+id+'">Nombre de la discoteca<input class="in" id="cn-'+id+'" type="text" data-cid="'+id+'" data-cf="name" value="'+esc(c.name)+'"></label>'
      +'<label class="f" for="cl-'+id+'">Lista (£ por persona)<input class="in num" id="cl-'+id+'" type="number" inputmode="decimal" min="0" step="0.5" data-cid="'+id+'" data-cf="rateLista" value="'+esc(c.rateLista||0)+'"></label>'
      +'<label class="f" for="cm-'+id+'">Mesa (% del consumo)<input class="in num" id="cm-'+id+'" type="number" inputmode="decimal" min="0" max="100" step="0.5" data-cid="'+id+'" data-cf="pctMesa" value="'+esc(c.pctMesa||0)+'"></label>'
      +'<label class="f" for="cb-'+id+'">Bonus cada X personas<input class="in num" id="cb-'+id+'" type="number" inputmode="numeric" min="0" step="1" data-cid="'+id+'" data-cf="bonusEvery" value="'+esc(c.bonusEvery||0)+'"></label>'
      +'<label class="f" for="ca-'+id+'">Bonus (£)<input class="in num" id="ca-'+id+'" type="number" inputmode="decimal" min="0" step="0.5" data-cid="'+id+'" data-cf="bonusAmount" value="'+esc(c.bonusAmount||0)+'"></label>'
      +'<div class="rm"><span class="sub">'+plural(n,'guest apuntado','guests apuntados')+'</span>'
      +(SH.confirm===c.id?'<button class="btn danger small" type="button" data-ca="cdel2" data-cid="'+id+'">Sí, eliminar</button>':'<button class="btn ghost small" type="button" data-ca="cdel" data-cid="'+id+'">Eliminar</button>')
      +'</div></div></div>';
  });
  h+='<button class="btn" type="button" data-ca="cadd" style="width:100%">Añadir discoteca</button>';
  out.innerHTML=h;
  augmentClubs(out);
}
function bindClubs(){
  $('#clubsOut').addEventListener('click',function(ev){
    var b=ev.target.closest('[data-ca]');if(!b)return;
    var a=b.dataset.ca,id=b.dataset.cid;
    if(a==='cadd'){
      var nc={id:uid(),name:'Nueva discoteca',rateLista:0,pctMesa:0,bonusEvery:0,bonusAmount:0};S.clubs.push(nc);save();renderClubs();
      var inp=document.getElementById('cn-'+nc.id);if(inp){inp.focus();inp.select()}
    }
    else if(a==='cdel'){SH.confirm=id;renderClubs()}
    else if(a==='cdel2'){
      var used=S.entries.filter(function(e){return e.clubId===id}).length;
      if(used){SH.confirm=null;renderClubs();toast('Esa discoteca tiene '+used+' guests apuntados. Elimínalos primero.');return}
      var before=snap();S.clubs=S.clubs.filter(function(c){return c.id!==id});SH.confirm=null;save();renderClubs();
      toast('Discoteca eliminada.',function(){restoreSnap(before)});
    }
  });
  $('#clubsOut').addEventListener('change',function(ev){
    var t=ev.target,f=t.dataset&&t.dataset.cf;if(!f)return;
    var c=club(t.dataset.cid);if(!c)return;
    if(f==='name'){c.name=t.value.trim()||'Sin nombre';t.value=c.name}
    else{var v=parseFloat(t.value);c[f]=isNaN(v)||v<0?0:v;t.value=c[f]}
    delete c.demo;save();
  });
}

function bindShell(){
  $('#btnClubs').onclick=openSheet;
  $('#sheetRoot').addEventListener('click',function(ev){
    if(ev.target.id==='scrim'){closeSheet();return}
    var b=ev.target.closest('[data-sa]');if(!b)return;
    var a=b.dataset.sa;
    if(a==='close')closeSheet();
    else if(a==='backup')backup();
    else if(a==='cleardemo'){SH.open=false;renderSheet();clearDemo()}
  });
  $('#sheetRoot').addEventListener('change',function(ev){
    var t=ev.target;
    if(t.id==='restoreFile'){restoreFile(t.files&&t.files[0]);t.value='';return}
  });
  document.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&SH.open)closeSheet()});

  $('#banners').addEventListener('click',function(ev){
    var b=ev.target.closest('[data-ba]');if(!b)return;
    if(b.dataset.ba==='cleardemo')clearDemo();
    if(b.dataset.ba==='settings')openSheet();
  });
  $$('.tab').forEach(function(b){b.addEventListener('click',function(){setTab(b.dataset.tab);window.scrollTo(0,0)})});
}

function renderBanners(){
  var h='';
  if(hasDemo())h+='<div class="banner"><span>Estás viendo datos de ejemplo.</span><button class="btn small ghost" type="button" data-ba="cleardemo">Borrar ejemplos y empezar</button></div>';
  if(!storageOk)h+='<div class="banner warn"><span>Este navegador no deja guardar datos. Descarga una copia desde Ajustes antes de cerrar.</span><button class="btn small ghost" type="button" data-ba="settings">Abrir Ajustes</button></div>';
  $('#banners').innerHTML=h;
  $('#banners').style.display=h?'':'none';
}

var TAB='dash';
function setTab(name){
  TAB=name==='lists'||name==='clubs'?name:'dash';
  $('#view-dash').hidden=TAB!=='dash';
  $('#view-lists').hidden=TAB!=='lists';
  $('#view-clubs').hidden=TAB!=='clubs';
  $$('.tab').forEach(function(b){b.setAttribute('aria-selected',String(b.dataset.tab===TAB))});
  try{localStorage.setItem('nereas-guest-list.tab',TAB)}catch(e){}
  if(TAB==='dash')renderDash();else if(TAB==='lists')renderLists();else renderClubs();
}
function renderAll(){
  renderBanners();
  $('#sub').textContent=fmtLong(nightDate());
  renderDashFilters();renderForm();
  if(TAB==='dash')renderDash();else if(TAB==='lists')renderLists();else renderClubs();
}

/* ---------- arranque ---------- */
try{localStorage.setItem('nereas-guest-list.probe','1');localStorage.removeItem('nereas-guest-list.probe')}catch(e){storageOk=false}
S=load()||demoData();
save();
bindDash();bindLists();bindClubs();bindShell();bindInvoice();
try{var tb=localStorage.getItem('nereas-guest-list.tab');TAB=tb==='lists'||tb==='clubs'?tb:'dash'}catch(e){}
renderAll();
setTab(TAB);
try{
  if(window.claude&&window.claude.use){
    window.claude.use('downloads').then(function(d){DL=d||null}).catch(function(){DL=null});
  }
}catch(e){DL=null}
})();
