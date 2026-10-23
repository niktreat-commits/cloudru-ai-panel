import {industries,roles,tasks,taskFor,roleName,placements,selectedServices} from './catalog.mjs';
import {SCENARIOS,scenarioFor,defaultCalculation,normalizeField,estimateScenario} from './scenario-calculator.mjs';

export const METHOD_VERSION='2026-10-23.2';
export const OUTCOMES=['active','result','lead_form','lead_submitted','timeout','reset'];
const clamp=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Number(v))):fallback;
export function normalizeSelection(input={},pricing){
 const industry=industries.some(x=>x.id===input.industry)?input.industry:null;
 const role=roles.some(x=>x.id===input.role)||input.role==='other'?input.role:null;
 const taskId=Object.hasOwn(SCENARIOS,input.task)?input.task:null;
 const placement=Object.hasOwn(placements,input.placement)?input.placement:'cloud';
 if(!taskId)return {industry,role,task:null,placement,calc:null};
 const context={industry,role},calc=defaultCalculation(taskId,context),raw=input.calc||{};
 const scenario=scenarioFor(taskId,context);
 for(const f of scenario.fields)if(Object.hasOwn(raw.values||{},f.id))calc.values[f.id]=normalizeField(f,raw.values[f.id]);
 if(pricing.apiModels.some(m=>m.id===raw.modelId))calc.modelId=raw.modelId;
 if(['api','mli','vm','bm'].includes(raw.launch))calc.launch=raw.launch;
 calc.days=Math.round(clamp(raw.days,1,31,calc.days));
 calc.hours=clamp(raw.hours,1,24,calc.hours);
 calc.gpuSchedule=raw.gpuSchedule==='window'?'window':'always';
 calc.epochs=Math.round(clamp(raw.epochs,1,20,3));
 calc.trainingHours=raw.trainingHours==null||raw.trainingHours===''?null:clamp(raw.trainingHours,.1,100000,null);
 calc.trainingGpus=[1,2,4,8].includes(raw.trainingGpus)?raw.trainingGpus:1;
 calc.sensitive=raw.sensitive===true;calc.isolation=raw.isolation===true;
 return {industry,role,task:taskId,placement,calc};
}
export function buildSpecification(input,pricing,custom=''){
 const s=normalizeSelection(input,pricing),task=s.task?taskFor(s.task,s,custom):null;
 const e=s.calc?estimateScenario(s.calc,pricing,s.placement):null;
 const exclusions=['Хранение данных','Интеграции и внедрение','Эксплуатация решения и проверка качества'];
 if(task?.products.includes('rag'))exclusions.push('База знаний и сервис RAG');
 if(task?.products.includes('agents'))exclusions.push('Работа агентов и внешних систем');
 if(s.calc?.values.format==='scan')exclusions.push('Распознавание сканов');
 return {
  selection:s,
  industry:industries.find(i=>i.id===s.industry)?.name||'Не выбрана',
  role:roleName(s.role,s.industry),task:task?.name||'Не выбрана',
  outcome:task?.result||'',placement:placements[s.placement],
  customTask:custom||undefined,
  services:task?selectedServices(s.task,e?.selectedId):[],
  parameters:s.calc?scenarioFor(s.task,s).fields.map(f=>({id:f.id,label:f.label,value:s.calc.values[f.id],display:f.type==='select'?f.options.find(([v])=>v===s.calc.values[f.id])?.[1]:`${s.calc.values[f.id]??'Нужен замер'}${f.unit?' '+f.unit:''}`})):[],
  estimate:e?{status:e.status,costRub:e.status==='ready'?Math.round(e.selected.cost*100)/100:null,period:e.period,launch:e.selected?.title||'',model:e.model?.name||null,scope:e.selected?.id==='api'?'Только обращения к модели по API':s.task==='finetune'?'Справочный бюджет GPU на запуск, не тариф ML Finetuning':'Вычислительные ресурсы',gpuCount:e.selected?.gpus||0,billableHours:e.selected?.id==='api'?0:e.selected?.id==='bm'?pricing.hoursPerMonth:e.billableHours??(s.task==='finetune'?s.calc.trainingHours:s.task==='experiment'?s.calc.values.volume:s.calc.hours*s.calc.days),workload:e.workload,exclusions,note:e.note}:null,
  next:task?.next||'',methodVersion:METHOD_VERSION,tariffDate:pricing.meta.updatedAt,tariffVatIncluded:pricing.meta.vatIncluded,
  tariffSources:pricing.meta.sources,
 };
}
