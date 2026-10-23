import test from 'node:test';import assert from 'node:assert/strict';
import {IdleController,SessionClient} from '../dist/session-client.mjs';
test('idle warning appears at 35 seconds, activity postpones reset, reset fires once at 45 seconds',()=>{
 let clock=0,warnings=[],resets=0;const idle=new IdleController({now:()=>clock,onWarning:v=>warnings.push(v),onReset:()=>resets++});idle.active=true;clock=34999;idle.tick();assert.equal(warnings.length,0);clock=35000;idle.tick();assert.equal(warnings.at(-1),10);clock=40000;idle.activity();assert.equal(warnings.at(-1),null);clock=84999;idle.tick();assert.equal(resets,0);clock=85000;idle.tick();idle.tick();assert.equal(resets,1);
});
test('background saves coalesce and finishing an old visitor never contaminates the next',async()=>{
 const requests=[];const client=new SessionClient({fetcher:async(path,options)=>{requests.push({path,data:JSON.parse(options.body)});return {ok:true,json:async()=>path==='/api/sessions'?{sessionId:'first',token:'capability'}:{saved:true}};}});
 const snap={selection:{industry:'gov'},viewedTasks:[],furthestStep:1,outcome:'active'};
 client.queue(snap);client.queue({...snap,selection:{industry:'retail'}});clearTimeout(client.timer);await client.flush();assert.equal(requests.length,2);assert.equal(requests[1].data.selection.industry,'retail');assert.equal(requests[1].data.revision,2);
 const old=client.finish({...snap,outcome:'timeout'});await new Promise(r=>setTimeout(r,10));assert.notEqual(old,client.current);assert.equal(client.current.remote,null);assert.equal(requests.at(-1).data.outcome,'timeout');
});
