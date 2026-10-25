(()=>{'use strict';
const API='https://orsini-matricules-api.simon-657.workers.dev',$=id=>document.getElementById(id);
const session=new URLSearchParams(location.search).get('session_id');let credential=new URLSearchParams(location.hash.slice(1)).get('token');
try{if(credential&&session)sessionStorage.setItem('orsini-result:'+session,credential);else if(session)credential=sessionStorage.getItem('orsini-result:'+session)}catch{}
if(location.hash)history.replaceState(null,'',location.pathname+location.search);
let tries=0,timer=null,busy=false,copy={};
fetch('content/matricula.json').then(r=>r.ok?r.json():{}).then(d=>copy=d).catch(()=>{});
function message(title,body){$('result-title').textContent=title;$('result-message').textContent=body}
function details(d){const list=$('result-details');list.replaceChildren();for(const [label,value]of [['Curs',d.course],['Import de prova',new Intl.NumberFormat('ca-ES',{style:'currency',currency:'EUR'}).format(d.amount_cents/100)],['Dates',d.schedule],['Modalitat i lloc',d.location]]){const block=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value||'Pendent de confirmació';block.append(dt,dd);list.append(block)}list.hidden=false;$('result-reference').textContent='Referència: '+d.reference}
async function check(){if(busy)return;busy=true;$('result-refresh').disabled=true;clearTimeout(timer);
 if(!session||!credential){message('Consulta el teu comprovant.','No tenim la credencial necessària per consultar aquesta matrícula. Conserva el comprovant de Stripe i contacta amb l’organització si necessites confirmar-ne l’estat.');busy=false;return}
 try{const r=await fetch(API+'/api/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:session,token:credential}),signal:AbortSignal.timeout(10000)});const d=await r.json();if(!r.ok)throw Error(d.error||'No disponible');details(d);
 if(d.status==='paid'){message('Matrícula de prova confirmada.',copy.success_message||'Hem verificat el pagament de prova. No correspon a una plaça real.');$('result-book').hidden=false;$('result-book').textContent=(d.book?'El llibre «'+d.book+'» s’inclou a la matrícula. ':'')+'Et lliurarem el llibre associat de regal a la primera sessió.';$('result-email').textContent=d.email_status==='sent'?'Hem enviat el correu de confirmació de prova. Revisa també la carpeta de correu brossa.':d.email_status==='review'?'L’enviament del correu necessita una comprovació. La matrícula consta com a pagada en l’entorn de proves.':'La confirmació per correu està pendent d’enviament. Pots conservar aquesta referència de matrícula.';$('result-refresh').hidden=d.email_status==='sent';}
 else if(d.status==='review'){message('Estem revisant la matrícula.','El pagament necessita una comprovació de l’equip. La plaça encara no està confirmada. No cal repetir el pagament; contacta amb Orsini i indica la referència.');$('result-refresh').hidden=false;}
 else if(d.status==='expired'){message('La matrícula no està confirmada.','La sessió de pagament ha caducat o no s’ha completat. Pots tornar a iniciar el procés des de la fitxa del curs.');$('result-refresh').hidden=true;}
 else{message(d.status==='processing'?'El pagament s’està processant.':'Comprovem el pagament.',copy.pending_message||'Encara estem comprovant el pagament. No cal tornar-lo a fer.');$('result-refresh').hidden=false;if(++tries<10)timer=setTimeout(check,2000)}
 }catch{message('Encara no podem confirmar la matrícula.','No hem pogut consultar l’estat. Si has completat el pagament, conserva el comprovant de Stripe i torna a comprovar-ho en uns instants. No cal repetir el pagament.');$('result-refresh').hidden=false}
 finally{busy=false;$('result-refresh').disabled=false}
}
$('result-refresh').addEventListener('click',()=>{tries=0;check()});check();
})();
