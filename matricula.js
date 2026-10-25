/* Enrollment data remains in memory; never store personal fields in the browser. */
(()=>{'use strict';
const API='https://orsini-matricules-api.simon-657.workers.dev';
const $=id=>document.getElementById(id),form=$('enrol'),course=$('course'),submit=$('submit');
let courses=[],ready=false,busy=false,requestKey=uuid(),resultToken=token(),copy={};
function uuid(){if(typeof crypto.randomUUID==='function')return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const s=[...b].map(n=>n.toString(16).padStart(2,'0')).join('');return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20)}
function token(){return [...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('')}
function freshAttempt(){if(!busy){requestKey=uuid();resultToken=token()}}
function show(message,error=false){$('status').textContent=message;$('status').className='status'+(error?' error':'')}
function money(cents){return Number.isInteger(cents)?new Intl.NumberFormat('ca-ES',{style:'currency',currency:'EUR'}).format(cents/100):'—'}
async function getJSON(url){const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('No disponible');return r.json()}
function refresh(){const c=courses.find(x=>x.id===course.value);submit.disabled=busy||!ready||!c||!c.active||c.available<=0;$('summary-title').textContent=c?.displayTitle||c?.title||'Tria el teu curs';$('summary-description').textContent=c?.description||'Lectura, debat i formació política en grups reduïts.';$('summary-amount').textContent=money(c?.price_cents);$('summary-dates').textContent=c?.dates||'Pendents de confirmació';$('summary-location').textContent=c?.location||'Presencial · Barcelona';$('summary-book-title').textContent=c?.book||'El llibre de cada curs s’indica a la seva fitxa.';const picture=$('summary-book-cover');const safe=/^(https:\/\/|\/Orsini\/media\/|media\/|\.\/media\/)/.test(c?.cover||'');picture.hidden=!safe;if(safe){picture.src=c.cover;picture.alt='Coberta de '+(c.book||'llibre associat')}else picture.removeAttribute('src');$('availability').textContent=c?(!c.active?'Matrícula no disponible.':c.available>0?c.available+' places disponibles en l’entorn de proves.':'Places exhaurides.'):'Selecciona un curs per consultar-ne el resum.'}
function communityConsent(){const has=$('community').value.trim().length>0;$('community-consent-label').hidden=!has;$('community_consent').disabled=!has;$('community_consent').required=has;if(!has)$('community_consent').checked=false}
form.addEventListener('input',freshAttempt);course.addEventListener('change',()=>{freshAttempt();refresh()});$('community').addEventListener('input',communityConsent);
form.addEventListener('submit',async e=>{e.preventDefault();communityConsent();if(busy||!form.reportValidity())return;const selected=courses.find(c=>c.id===course.value);if(!ready){show('La matrícula de prova encara no està activada. Torna-ho a provar més endavant.',true);return}if(!selected?.active||selected.available<=0){show('Aquest curs no té places disponibles.',true);return}
 const payload={form_version:2,request_key:requestKey,result_token:resultToken,course_id:course.value,privacy_accepted:$('privacy').checked,terms_accepted:$('terms').checked,community_consent:$('community_consent').checked};
 for(const key of ['name','email','phone','address','postal_code','city','education','community'])payload[key]=$(key).value.trim();
 busy=true;refresh();show('Preparant el pagament segur de prova…');form.setAttribute('aria-busy','true');
 try{const r=await fetch(API+'/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});const d=await r.json();if(!r.ok){if(d.code==='restart_checkout'){requestKey=uuid();resultToken=token()}throw Error(d.error||'No hem pogut iniciar el pagament.')}const url=new URL(d.url);if(d.mode!=='test'||url.protocol!=='https:'||!url.hostname.endsWith('.stripe.com'))throw Error('No hem pogut verificar l’adreça de pagament.');location.assign(url.href)}catch(err){show(err.name==='TimeoutError'?'No hem rebut resposta a temps. Pots tornar-ho a provar; conservarem la mateixa sol·licitud per evitar duplicats.':err.message||'No hem pogut iniciar el pagament.',true);busy=false;form.removeAttribute('aria-busy');refresh()}
});
async function load(){
 const copyPromise=getJSON('content/matricula.json').then(d=>{copy=d;for(const [key,id]of [['intro','enrol-intro'],['book_delivery','book-delivery'],['payment_hint','payment-hint']])if(typeof d[key]==='string')$(id).textContent=d[key]}).catch(()=>{});
 try{const d=await getJSON(API+'/api/courses');courses=Array.isArray(d.courses)?d.courses:[];ready=d.form_version===2&&d.mode==='test';
 await Promise.all(courses.map(async c=>{if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.id))return;try{const info=await getJSON('content/cursos/'+c.id+'.json');c.displayTitle=info.title;c.description=info.summary;c.dates=info.registration_dates;c.location=info.registration_location;c.book=info.gift_book_title;c.cover=info.gift_book_cover;if(info.active===false)c.active=false}catch{}}));
 course.replaceChildren(new Option('Selecciona un curs',''));for(const c of courses){const option=new Option((c.displayTitle||c.title)+(c.active&&c.available>0?'':' · no disponible'),c.id);option.disabled=!c.active||c.available<=0;course.add(option)}course.disabled=false;const wanted=new URLSearchParams(location.search).get('course');if(courses.some(c=>c.id===wanted))course.value=wanted;refresh();await copyPromise;
 if(!ready)show('El formulari ja està preparat. La matrícula ampliada de prova està pendent d’activació.',false);else if(new URLSearchParams(location.search).has('cancelled'))show(copy.cancelled_message||'Has cancel·lat el pagament de prova. La matrícula no està confirmada.');
 }catch{course.replaceChildren(new Option('Cursos no disponibles',''));show('No podem consultar les places ara mateix. Torna-ho a provar més tard.',true)}
}
if(matchMedia('(max-width:700px)').matches)document.querySelector('.enrol-summary-details').open=false;
communityConsent();load();
})();
