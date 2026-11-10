import {industries, roles, tasks, taskFor, roleName, placements, recommendedTasks} from './catalog.mjs';
import {SCENARIOS, LAUNCHES, scenarioFor, defaultCalculation, estimateScenario} from './scenario-calculator.mjs';
import {buildSpecification, normalizeSelection, METHOD_VERSION} from './specification.mjs';

export const API_VERSION = '1.0.0';
const allRoles = [...roles, {id:'other',name:'Другая роль',description:'Подберём задачи по отрасли',icon:'grid'}];
const taskIds = [...Object.keys(tasks), 'custom'];
const launchIds = {llm:['api','mli','vm','bm'],resources:['mli','vm','bm'],vision:['mli','vm','bm'],training:['vm'],experiment:['vm'],custom:[]};
const settingsByKind = {
  llm:['modelId','days','hours','gpuSchedule','sensitive','isolation','launch'],
  resources:['days','hours','isolation','launch'],
  vision:['days','hours','isolation','launch'],
  experiment:['isolation','launch'],
  training:['epochs','trainingHours','trainingGpus','isolation','launch'],
  custom:[]
};
const dayLabel = 'Рабочих дней в месяц';
const settingFields = {
  days:{type:'number',label:dayLabel,unit:'дней',min:1,max:31},
  hours:{type:'number',label:'Часов работы в день',unit:'ч',min:1,max:24},
  gpuSchedule:{type:'select',label:'Режим аренды GPU',options:[['always','Весь месяц · 730 часов'],['window','Только в рабочие часы']]},
  sensitive:{type:'boolean',label:'Чувствительные данные'},
  isolation:{type:'boolean',label:'Физически выделенные ресурсы'},
  epochs:{type:'number',label:'Эпох обучения',unit:'эпох',min:1,max:20},
  trainingHours:{type:'number',label:'Время обучения по замеру',unit:'ч',min:0.1,max:100000,decimal:true,nullable:true},
  trainingGpus:{type:'select',label:'GPU для обучения',options:[1,2,4,8].map(n=>[n,n+' GPU'])}
};
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);

function taskView(id, context) {
  const t = taskFor(id, context), s = scenarioFor(id, context);
  const {taskId, context:ignored, values, ...settings} = defaultCalculation(id, context);
  if(!launchIds[s.kind].includes(settings.launch))settings.launch=launchIds[s.kind][0];
  return {
    id, name:t.name, description:t.description, title:t.title, outcome:t.result,
    icon:t.icon||'spark', kind:s.kind,
    fields:s.fields,
    launchIds:launchIds[s.kind],
    settingIds:settingsByKind[s.kind],
    defaults:{values,settings:Object.fromEntries(settingsByKind[s.kind].map(k=>[k,settings[k]]))}
  };
}

function pricingInfo(pricing) {
  return {currency:'RUB',snapshotDate:pricing.meta.updatedAt,vatIncluded:pricing.meta.vatIncluded,sources:pricing.meta.sources.filter(s=>s.url)};
}

export function makeCatalog(pricing) {
  const baseTasks = Object.fromEntries(taskIds.map(id=>[id,taskView(id,{})]));
  const routes = {};
  for (const industry of industries) for (const role of allRoles) {
    const context={industry:industry.id,role:role.id};
    const overrides={};
    for (const id of taskIds) {
      const variant=taskView(id,context);
      const patch=Object.fromEntries(Object.entries(variant).filter(([key,value])=>!same(value,baseTasks[id][key])));
      if(Object.keys(patch).length)overrides[id]=patch;
    }
    routes[industry.id+':'+role.id]={
      roleLabel:roleName(role.id,industry.id),
      recommendedTaskIds:recommendedTasks(context).map(t=>t.id),
      taskOverrides:overrides
    };
  }
  return {
    apiVersion:API_VERSION,methodVersion:METHOD_VERSION,pricing:pricingInfo(pricing),
    kiosk:{idleSeconds:45,warningSeconds:35},
    industries,roles:allRoles,
    placements:Object.entries(placements).map(([id,name])=>({id,name})),
    models:pricing.apiModels.map(m=>({id:m.id,name:m.name})),
    launches:Object.entries(LAUNCHES).map(([id,def])=>({id,...def})),
    settingFields, taskIds, tasks:baseTasks, routes
  };
}

export class InputError extends Error {
  constructor(field, message){super(message);this.field=field;}
}
const bad=(field,message)=>{throw new InputError(field,message);};
function object(value, field) {
  if(!value || typeof value!=='object' || Array.isArray(value))bad(field,'Ожидается объект.');
}
function keys(value, allowed, field) {
  object(value, field);
  // Do not echo arbitrary keys or values from a malformed request.
  if(Object.keys(value).some(key=>!allowed.includes(key)))bad(field,'Есть неподдерживаемые поля.');
}
function fieldValue(value, field, path) {
  if(value===null&&(field.nullable||field.value===null))return;
  if(field.type==='boolean'){
    if(typeof value!=='boolean')bad(path,'Ожидается логическое значение.');
    return;
  }
  if(field.type==='select'){
    if(!field.options.some(([id])=>id===value))bad(path,'Выберите значение из каталога.');
    return;
  }
  if(typeof value!=='number'||!Number.isFinite(value)||value<field.min||value>field.max||(!field.decimal&&field.id!=='benchmarkMs'&&!Number.isInteger(value)))bad(path,`Введите число от ${field.min} до ${field.max}.`);
}

export function calculateEstimate(input, pricing) {
  keys(input,['industry','role','task','placement','values','settings'],'request');
  if(!industries.some(i=>i.id===input.industry))bad('industry','Выберите отрасль из каталога.');
  if(!allRoles.some(r=>r.id===input.role))bad('role','Выберите роль из каталога.');
  if(typeof input.task!=='string'||!Object.hasOwn(SCENARIOS,input.task))bad('task','Выберите задачу из каталога.');
  const placement=Object.hasOwn(input,'placement')?input.placement:'cloud';
  if(typeof placement!=='string'||!Object.hasOwn(placements,placement))bad('placement','Выберите размещение из каталога.');
  const context={industry:input.industry,role:input.role}, scenario=scenarioFor(input.task,context);
  const values=Object.hasOwn(input,'values')?input.values:{}, settings=Object.hasOwn(input,'settings')?input.settings:{};
  keys(values,scenario.fields.map(f=>f.id),'values');
  keys(settings,settingsByKind[scenario.kind],'settings');
  for(const field of scenario.fields)if(Object.hasOwn(values,field.id))fieldValue(values[field.id],field,'values.'+field.id);
  for(const key of Object.keys(settings)){
    if(key==='launch'){
      if(!launchIds[scenario.kind].includes(settings[key]))bad('settings.launch','Способ запуска не подходит для этой задачи.');
    }else if(key==='modelId'){
      if(!pricing.apiModels.some(m=>m.id===settings[key]))bad('settings.modelId','Выберите модель из каталога.');
    }else fieldValue(settings[key],settingFields[key],'settings.'+key);
  }
  const defaultLaunch=defaultCalculation(input.task,context).launch;
  const launch=launchIds[scenario.kind].includes(defaultLaunch)?defaultLaunch:launchIds[scenario.kind][0];
  const internal={...context,task:input.task,placement,calc:{launch,...settings,values}};
  const s=normalizeSelection(internal,pricing);
  const raw=estimateScenario(s.calc,pricing,placement);
  const spec=buildSpecification(internal,pricing);
  const t=taskFor(input.task,context);
  const normalizedSettings=Object.fromEntries(settingsByKind[scenario.kind].map(k=>[k,s.calc[k]]));
  const visibleOptions=placement==='cloud'?raw.options:[];
  const round=(n)=>Math.round(n*100)/100;
  const unitPrice=(n)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:4}).format(n);
  const budgetNote=spec.estimate.status==='ready'&&raw.selected?.id==='api'
    ? 'Сумма складывается из входных и выходных токенов. Входные — '+unitPrice(raw.model.inPrice)+' ₽, выходные — '+unitPrice(raw.model.outPrice)+' ₽ за 1 млн токенов.'
    : spec.estimate.note;
  return {
    apiVersion:API_VERSION, methodVersion:METHOD_VERSION, pricing:pricingInfo(pricing),
    selection:{...context,task:input.task,placement,values:s.calc.values,settings:normalizedSettings},
    scenario:{id:t.id,title:t.title,name:t.name,description:t.description,outcome:t.result},
    budget:{status:spec.estimate.status,amountRub:spec.estimate.costRub,period:spec.estimate.period,scope:spec.estimate.scope,note:budgetNote},
    selectedLaunch:raw.selected?.id??null,
    model:raw.model?{id:raw.model.id,name:raw.model.name}:null,
    workload:{
      requests:raw.workload.requests,inputTokens:raw.workload.tokIn,outputTokens:raw.workload.tokOut,
      stats:raw.workload.stats.map(([value,label])=>({value,label})),
      formula:raw.workload.formula,assumptions:raw.workload.assumptions,
      billableHours:spec.estimate.status==='ready'?spec.estimate.billableHours:null
    },
    options:visibleOptions.map(o=>({
      id:o.id,title:o.title,product:o.product,description:o.description,
      available:o.ok,reason:o.ok?null:o.reason,amountRub:o.ok?round(o.cost):null,gpuCount:o.gpus
    })),
    services:spec.services,parameters:spec.parameters,excluded:spec.estimate.exclusions,nextStep:spec.next
  };
}
