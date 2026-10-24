import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const base='https://radicalbooks.github.io/Orsini/';
const sitemap=await readFile('sitemap.xml','utf8');
const urls=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
assert.equal(new Set(urls).size,urls.length,'duplicate sitemap URL');
const titles=new Set(),descriptions=new Set();
for(const url of urls){
 assert(url.startsWith(base));const file=url.slice(base.length)||'index.html';const html=await readFile(file,'utf8');
 assert.equal((html.match(/<h1\b/g)||[]).length,1,file+': one h1');
 assert.equal((html.match(/rel="canonical"/g)||[]).length,1,file+': one canonical');
 assert(html.includes('rel="canonical" href="'+url+'"'),file+': canonical matches sitemap');
 assert(!/noindex|Carregant\.\.\.|http-equiv="refresh"/.test(html),file+': content must be immediately indexable');
 assert(!html.includes('src="cms-content.js'),file+': no client rendering dependency');
 const title=/<title>(.*?)<\/title>/.exec(html)[1];assert(!titles.has(title),file+': unique title');titles.add(title);
 const desc=/<meta name="description" content="([^"]*)"/.exec(html)[1];assert(desc.length>35);assert(!descriptions.has(desc),file+': unique description');descriptions.add(desc);
 const ld=JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);assert(ld['@graph'].some(n=>n['@type']==='EducationalOrganization'));
 if(file.startsWith('curs-')){const slug=file.slice(5,-5);const d=JSON.parse(await readFile('content/cursos/'+slug+'.json'));assert(html.includes(d.title));assert(html.includes('Llibre associat de regal'));assert(ld['@graph'].some(n=>n['@type']==='Course'&&n.name===d.title));assert(html.includes('href="matricula.html?course='+slug+'"'));}
 for(const m of html.matchAll(/(?:href|src)="([^"?#]+)(?:[?#][^"]*)?"/g)){const ref=m[1];if(/^(https?:|mailto:|tel:|data:|\/)/.test(ref))continue;await access(ref).catch(()=>{throw Error(file+': missing local resource '+ref)});}
}
for(const file of ['matricula.html','resultat.html','article.html'])assert((await readFile(file,'utf8')).includes('noindex,follow'),file+': test/private utility page');
console.log('PASS: '+urls.length+' pages, unique metadata, canonical URLs, JSON-LD, static course bodies, gift books, enrollment links and local resources.');
