import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './src/index.mjs';
const env=(o={})=>({ORSINI_PUBLIC:'false',ASSETS:{fetch:async()=>new Response('<html>ok</html>',{headers:{'content-type':'text/html'}})},DB:null,...o});
const get=(p,h={})=>new Request('https://orsini.radicalbooks.coop'+p,{headers:h});
test('prelaunch: anonymous visitors get 404 on pages, assets and API',async()=>{
 for(const p of ['/','/ca/','/es/centre.html','/en/content/cursos/feminisme-antipunitiu.json','/api/courses','/health','/build.json']){const r=await worker.fetch(get(p),env(),{});assert.equal(r.status,404,p);assert.match(r.headers.get('x-robots-tag'),/noindex/)}
});
test('prelaunch: a forged Access header without valid signature is rejected',async()=>{
 const fake='eyJhbGciOiJSUzI1NiIsImtpZCI6IngifQ.eyJhdWQiOiJhIiwiZXhwIjo5OTk5OTk5OTk5fQ.c2ln';
 const r=await worker.fetch(get('/ca/',{'cf-access-jwt-assertion':fake}),env({ACCESS_TEAM_DOMAIN:'x.cloudflareaccess.com',ACCESS_AUD:'a'}),{});assert.equal(r.status,404);
});
test('public: the subdomain redirects pages to the canonical integrated URL',async()=>{
 const r=await worker.fetch(get('/es/centre.html'),env({ORSINI_PUBLIC:'true',CANONICAL_BASE:'https://www.radicalbooks.coop/orsini/'}),{});
 assert.equal(r.status,301);assert.equal(r.headers.get('location'),'https://www.radicalbooks.coop/orsini/es/centre.html');
});
