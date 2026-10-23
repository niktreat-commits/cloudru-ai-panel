import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SCENARIOS,scenarioFor,defaultCalculation,deriveWorkload,estimateScenario} from '../dist/scenario-calculator.mjs';
const pricing=JSON.parse(fs.readFileSync(new URL('../dist/pricing.json',import.meta.url)));

test('each task uses its own business unit and a complete input profile',()=>{
 const cases={knowledge:'пользователей',documents:'документов в день',compare:'пар договоров в день',support:'диалогов в день',agents:'выполнений в день',reports:'сводок в месяц',code:'разработчиков',content:'материалов в месяц',finetune:'примеров',vision:'изображений в день',experiment:'часов в месяц'};
 for(const [id,unit]of Object.entries(cases))assert.equal(SCENARIOS[id].fields[0].unit,unit,id);
 const docs=defaultCalculation('documents');Object.assign(docs.values,{volume:100,pages:10});
 const w=deriveWorkload(docs);assert.equal(w.work,2200);assert.equal(w.requests,2200);assert.equal(w.tokIn,15400000);
 const pair=defaultCalculation('compare');Object.assign(pair.values,{volume:100,pages:10});
 assert.equal(deriveWorkload(pair).tokIn,30800000,'two documents per pair');
 const support=defaultCalculation('support');Object.assign(support.values,{volume:100,frequency:5});
 assert.equal(deriveWorkload(support).work,3000);assert.equal(deriveWorkload(support).requests,15000);
 const content=defaultCalculation('content');Object.assign(content.values,{volume:100,characters:3000});
 assert.equal(deriveWorkload(content).tokOut,100000,'content output follows length, not generic document volume');
 const template=defaultCalculation('template');assert.equal(deriveWorkload(template).requests,2200,'document checks, not employee-based RAG profile');
 const gov=defaultCalculation('documents',{industry:'gov',role:'business'});assert.equal(scenarioFor('documents',gov.context).fields[0].label,'Обращений в день');assert.equal(deriveWorkload(gov).workUnit,'обращений');
 const retail=defaultCalculation('content',{industry:'retail',role:'business'});assert.equal(deriveWorkload(retail).workUnit,'карточек товаров');
});

test('increasing load never lowers the cost of a fixed launch method',()=>{
 for(const [task,s]of Object.entries(SCENARIOS)){
  if(s.kind!=='llm')continue;
  for(const model of pricing.apiModels){
   const c=defaultCalculation(task);c.modelId=model.id;const previous={};
   for(let i=0;i<=100;i++){
    const f=s.fields[0];c.values.volume=Math.round(f.min*Math.pow(f.max/f.min,i/100));
    const r=estimateScenario(c,pricing);
    assert.equal(r.selectedId,'api','load does not change selection');
    for(const o of r.options){assert.ok(Number.isFinite(o.cost)&&o.cost>=0);if(previous[o.id]!==undefined)assert.ok(o.cost>=previous[o.id]-1e-6,`${task}/${model.id}/${o.id} decreased`);previous[o.id]=o.cost;}
   }
  }
 }
});

test('regression: the previous 3000 to 3100 user discontinuity is gone',()=>{
 const c=defaultCalculation('knowledge');c.modelId='qwen36-35b';c.values.frequency=8;
 for(const launch of ['api','mli']){
  c.launch=launch;c.values.volume=3000;const a=estimateScenario(c,pricing);
  c.values.volume=3100;const b=estimateScenario(c,pricing);
  assert.equal(a.selectedId,launch);assert.equal(b.selectedId,launch);assert.ok(b.selected.cost>=a.selected.cost);
 }
});

test('manual selection persists and unsuitable requirements block the quote',()=>{
 const c=defaultCalculation('knowledge');c.launch='mli';c.values.volume=3000;
 assert.equal(estimateScenario(c,pricing).selectedId,'mli');
 c.isolation=true;assert.equal(estimateScenario(c,pricing).status,'blocked');assert.equal(c.launch,'mli');
 c.launch='bm';assert.equal(estimateScenario(c,pricing).status,'ready');
 assert.equal(estimateScenario(c,pricing,'private').status,'placement');
 c.isolation=false;c.launch='mli';c.modelId='gigachat3-pro';assert.equal(estimateScenario(c,pricing).status,'blocked','no unsupported self-hosting promise');
});

test('vision and training need measurements before showing a price',()=>{
 const vision=defaultCalculation('vision');assert.equal(estimateScenario(vision,pricing).status,'benchmark');
 vision.values.benchmarkMs=100;const a=estimateScenario(vision,pricing);assert.equal(a.status,'ready');assert.equal(a.workload.work,300000);
 vision.values.volume*=2;assert.ok(estimateScenario(vision,pricing).selected.cost>=a.selected.cost);
 const training=defaultCalculation('finetune');assert.equal(estimateScenario(training,pricing).status,'training');
 training.trainingHours=10;const b=estimateScenario(training,pricing);assert.equal(b.status,'ready');assert.equal(b.period,'за запуск');assert.equal(b.selected.cost,5490);
 const custom=estimateScenario(defaultCalculation('custom'),pricing);assert.equal(custom.status,'custom');assert.equal(custom.options.length,0);
});

test('all profiles produce finite workload statistics and usable states',()=>{
 for(const id of Object.keys(SCENARIOS)){
  const c=defaultCalculation(id),r=estimateScenario(c,pricing);
  for(const [n]of r.workload.stats)assert.ok(Number.isFinite(n),id);
  if(r.status==='ready')assert.ok(r.selected?.ok,id);
 }
});
