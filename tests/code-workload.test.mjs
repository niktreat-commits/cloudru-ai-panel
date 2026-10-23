import test from 'node:test';import assert from 'node:assert/strict';
import {defaultCalculation,deriveWorkload,estimateScenario,normalizeField,SCENARIOS} from '../dist/scenario-calculator.mjs';
import {pricing} from './helpers.mjs';
test('developer chat uses active share and a freely adjustable frequency above 60',()=>{
 const c=defaultCalculation('code');Object.assign(c.values,{volume:100,activePercent:40,frequency:150});const w=deriveWorkload(c);
 assert.equal(w.requests,100*0.4*150*22);assert.equal(w.perIn,6000);assert.equal(w.perOut,1200);
 assert.equal(normalizeField(SCENARIOS.code.fields.find(f=>f.id==='frequency'),300),300);
});
test('completion is a separate workload with a shorter reply and transparent assumptions',()=>{
 const c=defaultCalculation('code');Object.assign(c.values,{mode:'completion',volume:50,activePercent:70,frequency:200});const w=deriveWorkload(c);assert.equal(w.requests,154000);assert.equal(w.perOut,160);assert.equal(w.perIn,2000);assert.equal(w.workUnit,'автодополнений');assert.match(w.assumptions.join(' '),/не тариф подписки GigaCode/);
});
test('GPU price uses the chosen billing window while capacity follows active hours',()=>{
 const c=defaultCalculation('code');c.launch='mli';c.modelId='qwen36-35b';c.hours=8;c.days=22;const always=estimateScenario(c,pricing);assert.equal(always.billableHours,730);assert.equal(always.activeHours,176);
 c.gpuSchedule='window';const window=estimateScenario(c,pricing);assert.equal(window.billableHours,176);assert.equal(window.selected.gpus,always.selected.gpus);assert.ok(window.selected.cost<always.selected.cost);
 const previous=window.selected.cost;c.values.frequency+=100;assert.ok(estimateScenario(c,pricing).selected.cost>=previous);
});
