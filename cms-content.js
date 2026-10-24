(async function(){
const page=location.pathname.split('/').pop()||'index.html';
async function load(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error(path);return r.json()}
function txt(sel,value){const el=document.querySelector(sel);if(el&&typeof value==='string')el.textContent=value}
function html(value){const d=new DOMParser().parseFromString(value||'','text/html');d.querySelectorAll('script,iframe,object,embed,form,style,link,meta,svg').forEach(x=>x.remove());d.body.querySelectorAll('*').forEach(x=>{for(const a of [...x.attributes])if(a.name.startsWith('on')||a.name==='style'||(['href','src'].includes(a.name)&&!(/^(https?:\/\/|\/|\.|#)/i.test(a.value))))x.removeAttribute(a.name)});return d.body.innerHTML}
try{
if(page==='index.html'){const d=await load('content/inici.json');txt('.home-intro h1',d.titular);txt('.intro-copy>p',d.introduccio);txt('.catalog-note',d.nota_cursos)}
const name={'centre.html':'centre','participa.html':'participa','arxiu.html':'arxiu'}[page];
if(name){const d=await load('content/'+name+'.json');txt('main.inner h1',d.title);txt('main.inner .lead',d.intro);const root=document.querySelector('main.inner');const lead=root&&root.querySelector('.lead');if(lead){let next=lead.nextElementSibling;while(next&&next.tagName!=='NAV'){const after=next.nextElementSibling;next.remove();next=after}const section=document.createElement('section');section.className='cms-body';section.innerHTML=html(d.body);lead.after(section);if(name==='participa'){const a=document.createElement('a');a.className='cta';a.href='matricula.html';a.textContent='Formulari de matrícula de prova ↗';section.append(a)}}}
const match=page.match(/^curs-([a-z0-9-]+)\.html$/);
if(match){const d=await load('content/cursos/'+match[1]+'.json');txt('main.inner h1',d.title);txt('main.inner .lead',d.summary);const h=document.querySelector('main.inner h2');if(h&&h.nextElementSibling&&h.nextElementSibling.tagName==='P')h.nextElementSibling.innerHTML=html(d.body)}
if(page==='programa.html'){for(const a of document.querySelectorAll('a.course-row')){const m=(a.getAttribute('href')||'').match(/^curs-([a-z0-9-]+)\.html$/);if(!m)continue;try{const d=await load('content/cursos/'+m[1]+'.json');if(d.active===false){a.remove();continue}const t=a.querySelector('.course-title'),s=a.querySelector('.course-summary'),c=a.querySelector('.course-tag');if(t)t.textContent=d.title;if(s)s.textContent=d.summary;if(c)c.textContent=d.category}catch(e){console.warn(e)}}}
}catch(e){console.warn('CMS unavailable; original content retained',e)}
})();