import test from 'node:test';
import assert from 'node:assert/strict';
import {PanelService} from '../server/service.mjs';
import {createPanelServer} from '../server/http.mjs';
import {MemoryStore,pricing,config,selection,snapshot,leadBody} from './helpers.mjs';
import {loadConfig} from '../server/config.mjs';

function setup(extra={}){const store=new MemoryStore();return {store,service:new PanelService({config,pricing,store,makeDocument:async()=>Buffer.from('test docx'),...extra})};}
test('sessions contain only normalized selections and retain immutable revisions',async()=>{
 const {store,service}=setup(),session=await service.createSession();
 await service.saveSession(session.sessionId,session.token,snapshot(2,'timeout'));
 await service.saveSession(session.sessionId,session.token,snapshot(1));
 const keys=[...store.objects.keys()].sort();assert.equal(keys.length,2);assert.match(keys[1],/00000002.json$/);
 const record=await store.json(keys[1]);assert.equal(record.outcome,'timeout');assert.equal(record.specification.selection.calc.values.frequency,20);
 await assert.rejects(service.saveSession(session.sessionId,session.token,{...snapshot(3),contact:{email:'no@example.test'}}),e=>e.code==='UNEXPECTED_FIELD');
 await assert.rejects(service.saveSession(session.sessionId,session.token,{...snapshot(3),customTask:'secret'}),e=>e.code==='UNEXPECTED_FIELD');
 assert.ok(!Buffer.concat([...store.objects.values()]).toString().includes('example.test'));
});
test('session capability cannot update another visitor or survive tampering',async()=>{
 const {service}=setup(),a=await service.createSession(),b=await service.createSession();
 await assert.rejects(service.saveSession(b.sessionId,a.token,snapshot()),e=>e.status===401);
 await assert.rejects(service.saveSession(a.sessionId,a.token+'x',snapshot()),e=>e.status===401);
});
test('lead requires phone and current separate consent; totals are recomputed',async()=>{
 const {service,store}=setup(),s=await service.createSession(),body=leadBody(s.sessionId);
 await assert.rejects(service.saveLead(s.token,{...body,contact:{...body.contact,phone:''}}),e=>e.code==='REQUIRED_CONTACT');
 await assert.rejects(service.saveLead(s.token,{...body,consent:{...body.consent,accepted:false}}),e=>e.code==='CONSENT_REQUIRED');
 await assert.rejects(service.saveLead(s.token,{...body,consent:{...body.consent,hash:'other'}}),e=>e.code==='CONSENT_REQUIRED');
 const result=await service.saveLead(s.token,body);assert.equal(result.saved,true);
 const key=[...store.objects.keys()].find(k=>k.endsWith('/lead.json')),record=await store.json(key);
 assert.equal(record.contact.phone,body.contact.phone);assert.equal(record.delivery.emailSent,false);assert.equal(record.specification.estimate.costRub,2592.74);assert.equal(record.consent.text,config.legal.text);
 assert.equal([...store.objects.keys()].filter(k=>k.startsWith('jobs/')).length,1);
 assert.ok(![...store.objects.keys()].some(k=>k.startsWith('sessions/')&&store.objects.get(k).includes('visitor@example')));
});
test('durable save and durable document job precede success; retry produces one lead',async()=>{
 const {service,store}=setup(),s=await service.createSession(),body=leadBody(s.sessionId);
 store.failWrites=true;await assert.rejects(service.saveLead(s.token,body));assert.equal(store.objects.size,0);
 store.failWrites=false;store.failJobs=true;await assert.rejects(service.saveLead(s.token,body));assert.equal([...store.objects.keys()].filter(k=>k.endsWith('/lead.json')).length,0);
 store.failJobs=false;const [a,b]=await Promise.all([service.saveLead(s.token,body),service.saveLead(s.token,body)]);assert.equal(a.leadId,b.leadId);assert.equal([...store.objects.keys()].filter(k=>k.endsWith('/lead.json')).length,1);
});
test('document job survives worker failure and is regenerated after restart',async()=>{
 const {service,store}=setup({makeDocument:async()=>{throw Error('conversion failed');}}),s=await service.createSession();
 await service.saveLead(s.token,leadBody(s.sessionId));assert.equal((await service.processDocuments()).failed,1);assert.equal([...store.objects.keys()].filter(k=>k.startsWith('jobs/')).length,1);
 const restarted=new PanelService({config,pricing,store,makeDocument:async()=>Buffer.from('DOCX result')});assert.equal((await restarted.processDocuments()).processed,1);assert.equal([...store.objects.keys()].filter(k=>k.startsWith('jobs/')).length,0);assert.ok([...store.objects.keys()].some(k=>k.endsWith('/card.docx')));
});
test('a failed lead write leaves a durable pending job that survives until retry',async()=>{
 const {service,store}=setup(),s=await service.createSession(),body=leadBody(s.sessionId),put=store.put.bind(store);let failLead=true;
 store.put=async(key,...args)=>{if(failLead&&key.endsWith('/lead.json'))throw Error('failed lead write');return put(key,...args);};
 await assert.rejects(service.saveLead(s.token,body));await service.processDocuments();assert.equal([...store.objects.keys()].filter(k=>k.startsWith('jobs/')).length,1);
 failLead=false;await service.saveLead(s.token,body);assert.equal((await service.processDocuments()).processed,1);assert.ok([...store.objects.keys()].some(k=>k.endsWith('/card.docx')));
});
test('expired consent is not used for a late document job',async()=>{
 const {service,store}=setup(),s=await service.createSession();await service.saveLead(s.token,leadBody(s.sessionId));
 const later=new PanelService({config,pricing,store,now:()=>Date.now()+91*86400000,makeDocument:async()=>{throw Error('must not run');}});await later.processDocuments();assert.ok(![...store.objects.keys()].some(k=>k.endsWith('.docx')));
});
test('production collection stays off without reviewed legal text and stable secret',()=>{
 assert.equal(loadConfig({}).collectionEnabled,false);
 assert.equal(loadConfig({AWS_ACCESS_KEY_ID:'a',AWS_SECRET_ACCESS_KEY:'b'}).collectionEnabled,false);
 assert.equal(loadConfig({AWS_ACCESS_KEY_ID:'a',AWS_SECRET_ACCESS_KEY:'b',LEGAL_APPROVED:'true',PUBLIC_ORIGIN:'https://example.test',SESSION_SECRET:'short'}).collectionEnabled,false);
});
test('HTTP rejects cross-site writes, oversized data, traversal and private file access',async t=>{
 const {service}=setup(),server=createPanelServer({service,config});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;
 const post=(path,data,origin='http://localhost')=>fetch(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)});
 assert.equal((await post('/api/sessions',{},'https://evil.test')).status,403);
 assert.equal((await post('/api/sessions',{big:'a'.repeat(25000)})).status,413);
 assert.equal((await post('/api/sessions',null)).status,400);
 assert.equal((await fetch(base+'/.env')).status,404);assert.equal((await fetch(base+'/server/config.mjs')).status,404);
 assert.equal((await fetch(base+'/%2e%2e%2fpackage.json')).status,404);
 const page=await fetch(base+'/');assert.equal(page.status,200);assert.ok(page.headers.get('content-security-policy').includes("connect-src 'self'"));
 const s=await (await post('/api/sessions',{})).json();const saved=await fetch(base+'/api/sessions/'+s.sessionId,{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json',Authorization:'Bearer '+s.token},body:JSON.stringify(snapshot())});assert.equal(saved.status,200);
});
