/* Empaqueta el build (dist/) dins del plugin de WordPress: un artefacte de desplegament, no una segona font.
 * Fitxers idèntics entre idiomes -> site/_shared/; la resta -> site/<lang>/. Ús: node scripts/build-wp.mjs */
import {readdir,readFile,mkdir,rm,cp,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const ROOT=process.cwd(),DIST=path.join(ROOT,'dist'),PLUG=path.join(ROOT,'wordpress/orsini-radicalbooks'),SITE=path.join(PLUG,'site');
const LANGS=['ca','es','en'],DROP=/^(orsini-line-art-v2\.webp|build\.json|emails\/.*|correu-matricula\.html)$/;
execFileSync(process.execPath,['scripts/build-site.mjs'],{stdio:'inherit',env:{...process.env,ORSINI_CANONICAL:'https://www.radicalbooks.coop/orsini/'}});
const walk=async d=>{const o=[];for(const e of await readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())o.push(...await walk(p));else o.push(p)}return o};
const md5=async p=>createHash('md5').update(await readFile(p)).digest('hex');
await rm(SITE,{recursive:true,force:true});
let shared=0,local=0;
for(const f of await walk(path.join(DIST,'ca'))){
 const rel=path.relative(path.join(DIST,'ca'),f).split(path.sep).join('/');
 if(DROP.test(rel))continue;
 const h=await Promise.all(LANGS.map(l=>md5(path.join(DIST,l,rel)).catch(()=>null)));
 if(h.every(x=>x===h[0])){await mkdir(path.dirname(path.join(SITE,'_shared',rel)),{recursive:true});await cp(f,path.join(SITE,'_shared',rel));shared++}
 else for(const l of LANGS){const s=path.join(DIST,l,rel);try{await stat(s)}catch{continue}await mkdir(path.dirname(path.join(SITE,l,rel)),{recursive:true});await cp(s,path.join(SITE,l,rel));local++}
}
const sha=execFileSync('git',['rev-parse','--short','HEAD']).toString().trim();
await writeFile(path.join(SITE,'manifest.json'),JSON.stringify({commit:sha,built:new Date().toISOString(),langs:LANGS,shared,local,public_by_default:false},null,1));
const version=(await readFile(path.join(PLUG,'orsini-radicalbooks.php'),'utf8')).match(/Version:\s*([\d.]+)/)[1];
const zip=path.join(ROOT,'wordpress',`orsini-radicalbooks.zip`);
await rm(zip,{force:true});
execFileSync('zip',['-qr9',zip,'orsini-radicalbooks','-x','*.DS_Store'],{cwd:path.join(ROOT,'wordpress')});
console.log(`WP bundle ${version} · commit ${sha} · shared ${shared}, per-language ${local} → wordpress/orsini-radicalbooks.zip (${Math.round((await stat(zip)).size/1024)} KB)`);
