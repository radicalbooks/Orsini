/* Orsini · build multilingüe (ca/es/en) en una sola sortida: dist/.
 * Una sola font: content/ (català) + content/i18n/<lang>/ (capes de traducció) + i18n/ui.json (interfície).
 * La mateixa sortida serveix orsini.radicalbooks.coop i www.radicalbooks.coop/orsini/ (rutes relatives).
 * Sense dependències. Ús: node scripts/build-site.mjs
 *   ORSINI_PUBLIC=true  -> metadades indexables (per defecte: noindex, PRELAUNCH)
 */
import {readFile,writeFile,readdir,mkdir,rm,cp,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

const ROOT=process.cwd(), OUT=path.join(ROOT,'dist'), TMP=path.join(ROOT,'.build');
const LANGS=['ca','es','en'];
const PUBLIC=process.env.ORSINI_PUBLIC==='true';
const CANONICAL=(process.env.ORSINI_CANONICAL||'https://www.radicalbooks.coop/orsini/').replace(/\/?$/,'/');
const NAMES={ca:'Català',es:'Castellano',en:'English'};
const RB={ca:{home:'https://www.radicalbooks.coop/?lang=ca',projects:'Projectes',coop:'Un projecte de Radical Books Coop',lang:'Idioma',cookies:'Configura les cookies',contact:'Contacte'},
          es:{home:'https://www.radicalbooks.coop/?lang=es',projects:'Proyectos',coop:'Un proyecto de Radical Books Coop',lang:'Idioma',cookies:'Configura las cookies',contact:'Contacto'},
          en:{home:'https://www.radicalbooks.coop/?lang=en',projects:'Projects',coop:'A project by Radical Books Coop',lang:'Language',cookies:'Cookie settings',contact:'Contact'}};
const SITE_FILES=/\.(html|css|js|svg|webp|png|txt|json|woff2?|xml)$/i;
const SKIP=new Set(['.git','.github','.build','dist','node_modules','backend','worker','wordpress','prelaunch','i18n','scripts']);

const exists=async p=>{try{await stat(p);return true}catch{return false}};
const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v);
function merge(base,over){if(!isObj(base)||!isObj(over))return over;const o={...base};for(const k of Object.keys(over))o[k]=isObj(base[k])&&isObj(over[k])?merge(base[k],over[k]):over[k];return o}
async function walk(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else out.push(p)}return out}

// Dictionary replacement. Long strings: global. Short strings: only as complete text node, attribute or JS string.
function translator(dict,lang){
 const entries=Object.entries(dict).map(([k,v])=>[k,v[lang]]).filter(([k,v])=>v&&v!==k).sort((a,b)=>b[0].length-a[0].length);
 const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return text=>{for(const [k,v] of entries){
   if(k.length>=18||/^\s|\s$/.test(k))text=text.split(k).join(v);
   else text=text.replace(new RegExp('(>\\s*)'+esc(k)+'(\\s*<)','g'),(m,a,b)=>a+v+b)
               .replace(new RegExp('(["\'])'+esc(k)+'\\1','g'),(m,q)=>q+v+q);
 }return text};
}

function strip(lang,file){
 const t=RB[lang];
 const links=LANGS.map(l=>`<a href="../${l}/${file}" hreflang="${l}" lang="${l}"${l===lang?' aria-current="true"':''}>${l.toUpperCase()}</a>`).join('');
 return `<!--rb:strip--><div class="rb-strip" data-rb-strip><div class="rb-strip__in"><a class="rb-strip__brand" href="${t.home}"><span class="rb-strip__mark" aria-hidden="true">RB</span><span>Radical Books</span></a><span class="rb-strip__sep" aria-hidden="true">/</span><span class="rb-strip__ctx">Orsini</span><nav class="rb-strip__lang" aria-label="${t.lang}">${links}</nav></div></div><!--/rb:strip-->`;
}
function foot(lang){
 const t=RB[lang];
 return `<!--rb:foot--><div class="rb-foot" data-rb-foot><div class="rb-foot__in"><a href="${t.home}">${t.coop}</a><span><a href="mailto:info@manifestllibres.cat">${t.contact}</a><button type="button" class="rb-foot__cookies" data-rb-cookie-open data-cookie-fallback="cookies.html">${t.cookies}</button></span></div></div><!--/rb:foot-->`;
}

function postProcess(html,lang,file){
 // lang
 html=html.replace(/<html\b[^>]*>/i,`<html lang="${lang}" class="js">`);
 // Own cookie banner: removed. Radical Books' consent manager is the only one.
 html=html.replace(/<div id="orsini-cookies"[\s\S]*?<\/div><\/div><script>\(function\(\)\{var key='orsini-cookie-consent'[\s\S]*?<\/script>/,'');
 html=html.replace(/<button type="button" data-open-cookie-settings>[^<]*<\/button>/,'');
 // Canonical/hreflang/robots
 const rel=file==='index.html'?'':file;
 html=html.replace(/<link rel="canonical"[^>]*>/,'').replace(/<link rel="sitemap"[^>]*>/,'').replace(/<link rel="alternate" hreflang[^>]*>/g,'');
 const alt=LANGS.map(l=>`<link rel="alternate" hreflang="${l}" href="${CANONICAL}${l}/${rel}">`).join('')+`<link rel="alternate" hreflang="x-default" href="${CANONICAL}ca/${rel}">`;
 html=html.replace('</head>',`<link rel="canonical" href="${CANONICAL}${lang}/${rel}">${alt}<link rel="stylesheet" href="orsini-integrated.css?v=1"><script src="orsini-integrated.js?v=1" defer></script></head>`);
 if(!PUBLIC)html=html.replace(/<meta name="robots"[^>]*>/g,'').replace('</head>','<meta name="robots" content="noindex,nofollow,noarchive"></head>');
 html=html.replace(/https:\/\/radicalbooks\.github\.io\/Orsini\//g,CANONICAL+lang+'/');
 // Thin Radical Books strip + footer line
 html=html.replace(/(<body\b[^>]*>)/,'$1'+strip(lang,file));
 html=html.replace(/<\/footer>/,'</footer>'+foot(lang));
 // Same-origin API (works under /orsini/ and on the subdomain)
 return html;
}
function patchJs(js){
 return js.replace(/const API='https:\/\/orsini-matricules-api\.simon-657\.workers\.dev'/,"const API=location.pathname.replace(/\\/(ca|es|en)\\/[^\\/]*$/,'')")
          .replace(/'ca-ES'/g,"({ca:'ca-ES',es:'es-ES',en:'en-GB'}[document.documentElement.lang]||'ca-ES')");
}

const dict=JSON.parse(await readFile(path.join(ROOT,'i18n/ui.json'),'utf8'));
await rm(OUT,{recursive:true,force:true});await rm(TMP,{recursive:true,force:true});await mkdir(OUT,{recursive:true});
const report={};
for(const lang of LANGS){
 const dir=path.join(TMP,lang);await mkdir(dir,{recursive:true});
 for(const e of await readdir(ROOT,{withFileTypes:true})){
  if(SKIP.has(e.name)||e.name.startsWith('.')&&e.name!=='.nojekyll')continue;
  if(e.isDirectory()||SITE_FILES.test(e.name))await cp(path.join(ROOT,e.name),path.join(dir,e.name),{recursive:true});
 }
 await cp(path.join(ROOT,'scripts'),path.join(dir,'scripts'),{recursive:true});
 await rm(path.join(dir,'content/i18n'),{recursive:true,force:true});
 let missing=[];
 if(lang!=='ca'){
  const t=translator(dict,lang);
  // content overlays
  for(const f of await walk(path.join(dir,'content'))){
   if(!f.endsWith('.json'))continue;const rel=path.relative(path.join(dir,'content'),f);
   const over=path.join(ROOT,'content/i18n',lang,rel);
   if(await exists(over)){const base=JSON.parse(await readFile(f,'utf8'));await writeFile(f,JSON.stringify(merge(base,JSON.parse(await readFile(over,'utf8'))),null,2))}
   else if(!/courses-index|articles\//.test(rel))missing.push(rel);
  }
  for(const f of [...await walk(dir)].filter(f=>/\.(html|js|mjs)$/.test(f)&&!f.includes('/vendor/')&&!f.includes('/content/')))
   await writeFile(f,t(await readFile(f,'utf8')));
 }
 execFileSync(process.execPath,['scripts/build-seo.mjs'],{cwd:dir,stdio:'inherit',env:{...process.env,ORSINI_BASE:CANONICAL+lang+'/',ORSINI_LANG:lang,ORSINI_PRELAUNCH:PUBLIC?'0':'1'}});
 const dest=path.join(OUT,lang);await mkdir(dest,{recursive:true});
 for(const e of await readdir(dir,{withFileTypes:true})){
  if(['scripts','sitemap.xml','robots.txt','.nojekyll','orsini-indexnow.txt','programa-2027.txt','README.md','SEO.md'].includes(e.name))continue;
  const src=path.join(dir,e.name),dst=path.join(dest,e.name);
  if(e.isDirectory()){await cp(src,dst,{recursive:true});continue}
  if(e.name.endsWith('.html'))await writeFile(dst,postProcess(await readFile(src,'utf8'),lang,e.name));
  else if(e.name.endsWith('.js'))await writeFile(dst,patchJs(await readFile(src,'utf8')));
  else await cp(src,dst);
 }
 await rm(path.join(dest,'content/articles'),{recursive:true,force:true});
 report[lang]={missing_translations:missing};
}
// Root: language negotiation happens in the Worker; static fallback goes to Catalan.
await writeFile(path.join(OUT,'index.html'),'<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=ca/"><title>Orsini</title><a href="ca/">Orsini</a>');
await writeFile(path.join(OUT,'404.html'),'<!doctype html><html lang="ca"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>404</title><body style="font:16px/1.5 system-ui;display:grid;place-items:center;min-height:100vh;margin:0"><p>404</p></body></html>');
await writeFile(path.join(OUT,'robots.txt'),PUBLIC?`User-agent: *\nAllow: /\n`:'User-agent: *\nDisallow: /\n');
await writeFile(path.join(OUT,'build.json'),JSON.stringify({built:new Date().toISOString(),public:PUBLIC,canonical:CANONICAL,langs:LANGS,report},null,1));
await rm(TMP,{recursive:true,force:true});
console.log('Orsini built →',path.relative(ROOT,OUT),PUBLIC?'(PUBLIC)':'(PRELAUNCH: noindex)',JSON.stringify(report));
