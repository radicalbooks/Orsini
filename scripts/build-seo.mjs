/* Build crawlable pages from Pages CMS content. No network or npm dependencies. */
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(), base='https://radicalbooks.github.io/Orsini/';
const source=await readFile('vendor/marked.esm.js','utf8');
const {marked}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const read=p=>readFile(p,'utf8');
const json=async p=>JSON.parse(await read(p));
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const text=s=>String(s??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
// Rich text is trusted repository content. Reject active markup as a second safeguard.
const rich=s=>marked.parse(String(s||''),{gfm:true}).replace(/<(script|iframe|object|embed|style|form)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*')/gi,'').replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi,'');
function replaceElement(html,re,content){
 const m=re.exec(html);if(!m)throw Error('Missing element '+re);const tag=m[1], start=m.index+m[0].length;
 const scan=new RegExp('<\\/?'+tag+'\\b[^>]*>','gi');scan.lastIndex=start;let depth=1,n;
 while((n=scan.exec(html))){depth+=n[0].startsWith('</')?-1:1;if(!depth)return html.slice(0,start)+content+html.slice(n.index)}
 throw Error('Unclosed '+tag);
}
const byId=(html,id,value)=>replaceElement(html,new RegExp('<([a-z0-9]+)\\b[^>]*\\bid="'+id+'"[^>]*>','i'),value);
const byClass=(html,cls,value)=>replaceElement(html,new RegExp('<([a-z0-9]+)\\b[^>]*class="[^"\\n]*\\b'+cls+'\\b[^"\\n]*"[^>]*>','i'),value);
const org={'@type':'EducationalOrganization','@id':base+'#organization',name:'Orsini',alternateName:'Orsini · Centre d’estudis radicals',url:base,description:'Centre de formació, pensament i discussió política a Barcelona.',logo:{'@type':'ImageObject',url:base+'orsini-simbol-nou.svg'},location:{'@type':'Place',name:'Barcelona'}};
const site={'@type':'WebSite','@id':base+'#website',url:base,name:'Orsini',inLanguage:'ca',publisher:{'@id':org['@id']}};
const pages=[];
function metadata(html,file,title,description,{index=true,type='WebPage',extra=[]}={}){
 const url=base+(file==='index.html'?'':file),desc=text(description);
 html=html.replace(/<title>[\s\S]*?<\/title>/gi,'').replace(/<meta\b[^>]*(?:name="(?:description|robots|twitter:[^"]+|theme-color)"|property="og:[^"]+")[^>]*>/gi,'').replace(/<link\b[^>]*rel="(?:canonical|sitemap|preload)"[^>]*>/gi,'').replace(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi,'');
 const page={'@type':type,'@id':url+'#page',url,name:title,description:desc,inLanguage:'ca',isPartOf:{'@id':site['@id']},about:{'@id':org['@id']}};
 const breadcrumb=file==='index.html'?[]:[{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Inici',item:base},...(file.startsWith('curs-')?[{'@type':'ListItem',position:2,name:'Cursos',item:base+'programa.html'}]:[]),{'@type':'ListItem',position:file.startsWith('curs-')?3:2,name:title.replace(' · Orsini',''),item:url}]}];
 const tags=`<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(url)}"><meta name="robots" content="${index?'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1':'noindex,follow'}"><meta name="theme-color" content="#edf23d"><meta property="og:site_name" content="Orsini"><meta property="og:locale" content="ca_ES"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${base}assets/orsini-social.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Orsini · Centre d’estudis radicals. Aprendre per pensar i actuar."><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${base}assets/orsini-social.png"><link rel="sitemap" type="application/xml" href="${base}sitemap.xml"><link rel="preload" href="fonts/SourceSerif4-latin.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="fonts/Inter-latin.woff2" as="font" type="font/woff2" crossorigin><script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':[org,site,page,...breadcrumb,...extra]}).replaceAll('<','\\u003c')}</script>`;
 html=html.replace('</head>',tags+'</head>');
 html=html.replace(/cms-content\.js\?v=\d+/g,'cms-content.js?v=9').replace(/editorial\.css\?v=\d+/g,'editorial.css?v=9');
 if(html.includes('class="brand"'))html=replaceElement(html,/<(strong)>/i,esc(web.brand||'orsini'));
 if(html.includes('data-site-footer'))html=replaceElement(html,/<(p)\b[^>]*data-site-footer[^>]*>/i,esc(web.footer||'Orsini · Un projecte vinculat a Radical Books Coop.'));
 if(index){pages.push({file,url});html=html.replace(/<script\b[^>]*src="cms-content\.js[^"]*"[^>]*><\/script>/g,'');}return html;
}
const web=await json('content/web.json');
const order=['feminisme-antipunitiu','escriptura-politica','imaginacio-i-organitzacio','al-marge-de-la-historia','organitzar-la-classe'];
const files=(await readdir('content/cursos')).filter(x=>x.endsWith('.json')).sort((a,b)=>{const i=order.indexOf(a.slice(0,-5)),j=order.indexOf(b.slice(0,-5));return (i<0?999:i)-(j<0?999:j)||a.localeCompare(b)});
const courses=[];for(const file of files){const slug=file.slice(0,-5);if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw Error('Invalid course slug');const d=await json('content/cursos/'+file);if(d.active!==false)courses.push({...d,slug})}
await writeFile('content/courses-index.json',JSON.stringify(courses.map(d=>({slug:d.slug})),null,2)+'\n');
const rows=courses.map((d,i)=>`<a class="course-row" href="curs-${d.slug}.html"><span class="course-num">${String(i+1).padStart(2,'0')}</span><div><h3 class="course-title">${esc(d.title)}</h3><p class="course-summary">${esc(d.summary)}</p></div><span class="course-tag">${esc(d.category)}</span><span class="arrow" aria-hidden="true">↗</span></a>`).join('');
const courseList={'@type':'ItemList',name:'Cursos d’Orsini',itemListElement:courses.map((d,i)=>({'@type':'ListItem',position:i+1,url:base+'curs-'+d.slug+'.html',name:d.title}))};
for(const file of ['index.html','programa.html']){
 let html=await read(file);html=byClass(html,'course-list',rows);
 if(file==='index.html'){const d=await json('content/inici.json');html=replaceElement(html,/<(h1)\b[^>]*>/i,esc(d.titular).replace('pensar','<br>pensar'));html=replaceElement(html,/<(p)>/i,esc(d.introduccio));html=byClass(html,'catalog-note',esc(d.nota_cursos));}
 else {html=byClass(html,'lead',esc(web.program_intro));html=byClass(html,'small',esc(web.course_note));}
 html=metadata(html,file,file==='index.html'?'Orsini · Centre d’estudis radicals a Barcelona':'Cursos de formació política a Barcelona · Orsini',file==='index.html'?'Orsini, centre d’estudis radicals a Barcelona. Un espai de lectura, debat i formació política per comprendre el present i actuar col·lectivament.':'Descobreix els cursos d’Orsini a Barcelona: feminismes, història, cultura i organització política. Grups reduïts. Programa 2027 en preparació.',{type:'CollectionPage',extra:[courseList]});await writeFile(file,html);
}
for(const name of ['centre','participa','privacitat','cookies','avis-legal']){
 let html=await read(name+'.html');const d=await json('content/'+name+'.json');html=replaceElement(html,/<(h1)\b[^>]*>/i,esc(d.title));
 if(d.intro)html=byClass(html,'lead',esc(d.intro));
 let body=rich(d.body);
 if(name==='centre'){
 const headings=[];const used=new Set(['contingut']);body=body.replace(/<h([23])(?:\s[^>]*)?>(.*?)<\/h\1>/g,(m,n,title)=>{let id=text(title)==='Per què Orsini?'?'nom-orsini':text(title).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');const stem=id;let k=2;while(used.has(id))id=stem+'-'+k++;used.add(id);headings.push({id,title:text(title)});return `<h${n} id="${id}">${title}</h${n}>`});html=byClass(html,'centre-index','<a href="#contingut">El projecte</a>'+headings.map(h=>`<a href="#${h.id}">${esc(h.title)}</a>`).join(''));
 }
 if(name==='participa'&&!body.includes('class="practical-grid"')){body='<div class="practical-grid">'+body.split(/(?=<h2\b)/).filter(Boolean).map(s=>'<section>'+s+'</section>').join('')+'</div><a class="cta" href="matricula.html">Formulari de matrícula de prova ↗</a>';}
 if(name==='participa'&&!body.includes('href="matricula.html"'))body+='<a class="cta" href="matricula.html">Formulari de matrícula de prova ↗</a>';
 if(['centre','participa'].includes(name))html=replaceElement(html,/<(section)\b[^>]*data-cms-body[^>]*>/i,body);
 else {const match=/<main\b[^>]*>([\s\S]*?)<\/main>/.exec(html);const heading=/<h1\b[^>]*>[\s\S]*?<\/h1>/.exec(match[1]);html=html.replace(match[0],match[0].slice(0,match[0].indexOf('>')+1)+heading[0]+'<section>'+body+'</section></main>');}
 const descriptions={'privacitat':'Política de privacitat d’Orsini: responsable del tractament, finalitat de les dades de contacte i matrícula, conservació i exercici dels teus drets.',cookies:'Política de cookies d’Orsini. Consulta quines cookies s’utilitzen, les preferències de consentiment i la configuració actual del web.', 'avis-legal':'Avís legal d’Orsini, projecte vinculat a Radical Books Coop. Dades del responsable, condicions d’ús, propietat intel·lectual i crèdits.',centre:'Coneix Orsini, centre de formació, pensament i discussió política a Barcelona. Lectura, debat i una comunitat estable d’aprenentatge col·lectiu.',participa:'Informació pràctica dels cursos d’Orsini a Barcelona: grups reduïts, funcionament i condicions de matrícula. Programa en preparació.'};
 html=metadata(html,name+'.html',(name==='centre'?'El centre · Formació i pensament polític':d.title)+' · Orsini',descriptions[name]||text(body).slice(0,155),{type:name==='centre'?'AboutPage':'WebPage'});await writeFile(name+'.html',html);
}
const template=await read('scripts/templates/curs.html');
for(const d of courses){
 let html=template.replace('Carregant...',esc(d.title));html=byClass(html,'lead',esc(d.introduction||d.summary));html=byId(html,'dynamic-category',esc(d.category));html=byId(html,'dynamic-status',esc(d.status||'En preparació'));html=byId(html,'dynamic-body',rich(d.body));html=byId(html,'dynamic-practical',rich(d.practical));html=html.replace('src="icons8-book.webp"',`src="icons8-${d.illustration||'book'}.webp"`).replace('id="dynamic-cta" class="cta" href="matricula.html"',`id="dynamic-cta" class="cta" href="matricula.html?course=${d.slug}"`);
 if(d.gift_book_title&&/^(https:\/\/|\/Orsini\/media\/|\.?\/media\/|media\/)/.test(d.gift_book_cover||'')){html=html.replace('aria-label="Llibre associat de regal" hidden','aria-label="Llibre associat de regal"');for(const [id,value]of [['gift-title',d.gift_book_title],['gift-author',d.gift_book_author],['gift-publisher',d.gift_book_publisher]])html=byId(html,id,esc(value));html=html.replace('id="gift-cover" alt=""',`id="gift-cover" src="${esc(d.gift_book_cover)}" alt="Coberta de ${esc(d.gift_book_title)}"`);}
 if(d.image&&/^(\/Orsini\/media\/|media\/|\.\/media\/)/.test(d.image))html=html.replace('id="dynamic-image" alt="" hidden',`id="dynamic-image" src="${esc(d.image)}" alt="${esc(d.title)}" loading="lazy" decoding="async"`);
 html=html.replace('<body ',`<body data-course-id="${d.slug}" `);
 const course={'@type':'Course','@id':base+'curs-'+d.slug+'.html#course',name:d.title,description:text(d.introduction||d.summary),url:base+'curs-'+d.slug+'.html',inLanguage:'ca',provider:{'@id':org['@id']},educationalLevel:'Formació per a persones adultes',isAccessibleForFree:false};
 html=metadata(html,'curs-'+d.slug+'.html',d.title+' · Orsini',d.summary+' Curs de formació política a Barcelona, en grup reduït. Programa en preparació.',{extra:[course]});await writeFile('curs-'+d.slug+'.html',html);
}
for(const file of ['matricula.html','resultat.html','article.html','arxiu.html']){let html=await read(file);const title=/<title>(.*?)<\/title>/.exec(html)?.[1]||'Orsini';html=metadata(html,file,title,'Orsini · Centre d’estudis radicals.',{index:false});await writeFile(file,html);}
// Query-string course URLs are kept as compatibility entrypoints, then replaced by their static canonical URL.
let generic=template.replace('</head>',`<script>const id=new URLSearchParams(location.search).get('id');if(id&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))location.replace('curs-'+encodeURIComponent(id)+'.html'+location.hash);</script></head>`);await writeFile('curs.html',generic);
const urls=pages.map(p=>p.url);
await writeFile('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.map(url=>'  <url><loc>'+esc(url)+'</loc></url>').join('\n')+'\n</urlset>\n');
// A subdirectory robots.txt cannot govern GitHub Pages. Page-level robots directives above are authoritative here.
await writeFile('robots.txt','User-agent: *\nAllow: /\nSitemap: '+base+'sitemap.xml\n');
await writeFile('.nojekyll','');
console.log('SEO built: '+pages.length+' indexable pages, '+courses.length+' static courses.');
