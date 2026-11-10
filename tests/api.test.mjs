import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {once} from 'node:events';
import {createApp} from '../server/index.mjs';

let server, base;
const origin='https://panel.example.test';
const sample=JSON.parse(readFileSync(new URL('../examples/estimate-request.json',import.meta.url),'utf8'));
const estimate=(body,headers={})=>fetch(base+'/api/estimate',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
before(async()=>{
 server=createApp({origins:origin});server.listen(0,'127.0.0.1');await once(server,'listening');
 base='http://127.0.0.1:'+server.address().port;
});
after(()=>server?.close());
test('the published contract and the same-origin demo are served',async()=>{
 const r=await fetch(base+'/openapi.json');
 assert.equal(r.status,200);
 const spec=await r.json();
 assert.deepEqual(Object.keys(spec.paths),['/api/catalog','/api/estimate','/healthz']);
 const index=await fetch(base);
 assert.match(await index.text(),/bootstrap\.mjs/);
 assert.match(index.headers.get('Content-Security-Policy'),/connect-src 'self'/);
 assert.deepEqual(await (await fetch(base+'/healthz')).json(),{ok:true,apiVersion:'1.0.0'});
});
test('catalog provides 42 combinations and valid defaults for each scenario',async()=>{
 const r=await fetch(base+'/api/catalog');
 assert.equal(r.status,200);
 assert.match(r.headers.get('Cache-Control'),/max-age=/);
 const c=await r.json();
 assert.equal(Object.keys(c.routes).length,c.industries.length*c.roles.length);
 assert.equal(c.routes['gov:it'].taskOverrides.knowledge.name,'Поиск по регламентам');
 assert.equal(c.routes['gov:business'].roleLabel,'Руководитель подразделения');
 assert.deepEqual(c.routes['gov:it'].recommendedTaskIds,['access','knowledge','model','agents']);
 for(const task of c.taskIds){
   const t={...c.tasks[task],...c.routes['gov:it'].taskOverrides[task]};
   const reply=await estimate({industry:'gov',role:'it',task,...t.defaults});
   assert.equal(reply.status,200,task);
   const data=await reply.json();
   assert.equal(data.scenario.id,task);
   assert.ok(data.budget.amountRub===null||Number.isFinite(data.budget.amountRub));
 }
});
test('estimate matches the handoff example and updates with workload',async()=>{
 const a=await estimate(sample,{Origin:base});
 assert.equal(a.status,200);
 const expected=JSON.parse(readFileSync(new URL('../examples/estimate-response.json',import.meta.url),'utf8'));
 assert.deepEqual(await a.json(),expected);
 const b=await (await estimate({...sample,values:{...sample.values,volume:600}})).json();
 assert.ok(Math.abs(b.budget.amountRub-2*expected.budget.amountRub)<.02);
 assert.equal(b.workload.requests,2*expected.workload.requests);
 assert.equal(b.selectedLaunch,'api');
});
test('unpriced requests remain unpriced and return the next step',async()=>{
 for(const [body,status] of [[{...sample,placement:'private'},'placement'],[{industry:'gov',role:'dev',task:'vision'},'benchmark'],[{industry:'gov',role:'dev',task:'finetune'},'training'],[{industry:'gov',role:'dev',task:'custom'},'custom']]){
   const r=await estimate(body);assert.equal(r.status,200);
   const data=await r.json();assert.equal(data.budget.status,status);assert.equal(data.budget.amountRub,null);assert.ok(data.nextStep);
   if(status==='placement')assert.deepEqual(data.options,[]);
 }
});
test('no registration or session routes, contact fields are rejected',async()=>{
 for(const route of ['leads','sessions','public-config']){
   const r=await fetch(base+'/api/'+route,{method:'POST',body:'{}'});
   assert.equal(r.status,404,route);
 }
 const r=await estimate({...sample,contact:{email:'example@example.test'}});
 assert.equal(r.status,400);
 assert.doesNotMatch(await r.text(),/example@example\.test/);
 const a=await estimate({...sample,values:{...sample.values,volume:'300'}});
 assert.equal(a.status,400);
 assert.equal((await a.json()).field,'values.volume');
 const b=await estimate({...sample,values:{...sample.values,volume:-1}});
 assert.equal(b.status,400);
});
test('separate frontend origins work only when permitted in browser CORS',async()=>{
 const allowed=await fetch(base+'/api/estimate',{method:'OPTIONS',headers:{
   Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'
 }});
 assert.equal(allowed.status,204);assert.equal(allowed.headers.get('Access-Control-Allow-Origin'),origin);
 assert.match(allowed.headers.get('Access-Control-Allow-Methods'),/POST/);
 assert.equal((await estimate(sample,{Origin:origin})).status,200);
 const denied=await estimate(sample,{Origin:'https://unrelated.example.test'});
 assert.equal(denied.status,403);assert.equal(denied.headers.get('Access-Control-Allow-Origin'),null);
});
test('API-only mode retains calculation and turns off the reference UI',async()=>{
 const api=createApp({serveDemo:false});
 api.listen(0,'127.0.0.1');await once(api,'listening');
 const url='http://127.0.0.1:'+api.address().port;
 try{
   assert.equal((await fetch(url)).status,404);
   assert.equal((await fetch(url+'/api/catalog')).status,200);
 }finally{api.close();}
});
