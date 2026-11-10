import {writeFileSync,readFileSync} from 'node:fs';
import {makeCatalog,calculateEstimate,API_VERSION} from '../core/panel.mjs';

const p=JSON.parse(readFileSync(new URL('../core/pricing.json',import.meta.url),'utf8'));
const catalog=makeCatalog(p);
const input={industry:'gov',role:'it',task:'access',placement:'cloud',values:{volume:300,frequency:10},settings:{modelId:'gpt-oss-120b',launch:'api'}};
const example=calculateEstimate(input,p);
const ref=(name)=>({$ref:'#/components/schemas/'+name});
const string={type:'string'};
const nullableString={type:['string','null']};
const integer={type:'integer',minimum:0};
const number={type:'number'};
const boolean={type:'boolean'};
const object=(properties,required=Object.keys(properties),extra=false)=>({type:'object',required,properties,additionalProperties:extra});
const array=(items)=>({type:'array',items});
const dictionary=(items)=>({type:'object',additionalProperties:items});
const parameter={type:['string','number','null']};
const settings={
  modelId:{type:'string',description:'ID из models каталога. Только для LLM.'},
  launch:{type:'string',enum:['api','mli','vm','bm']},
  days:{type:'integer',minimum:1,maximum:31},
  hours:{type:'integer',minimum:1,maximum:24},
  gpuSchedule:{type:'string',enum:['always','window']},
  sensitive:boolean,isolation:boolean,
  epochs:{type:'integer',minimum:1,maximum:20},
  trainingHours:{type:['number','null'],minimum:0.1,maximum:100000},
  trainingGpus:{type:'integer',enum:[1,2,4,8]}
};
const schemas={
  IdLabel:object({id:string,name:string}),
  Choice:object({id:string,name:string,description:string,icon:string}),
  OptionPair:{type:'array',prefixItems:[{type:['string','number']},string],minItems:2,maxItems:2},
  Field:object({
    id:string,label:string,type:{enum:['number','select','boolean']},unit:string,
    min:number,max:number,value:parameter,note:string,options:array(ref('OptionPair')),nullable:boolean,decimal:boolean
  },['label','type']),
  Settings:object(settings,[]),
  Task:object({
    id:string,name:string,description:string,title:string,outcome:string,icon:string,
    kind:{enum:['llm','resources','vision','training','experiment','custom']},
    fields:array(ref('Field')),launchIds:array(string),settingIds:array(string),
    defaults:object({values:dictionary(parameter),settings:ref('Settings')})
  }),
  TaskOverride:{type:'object',description:'Набор полей Task, которые заменяют соответствующие поля базовой задачи. Поля и defaults заменяются целиком.',additionalProperties:true},
  Route:object({roleLabel:string,recommendedTaskIds:array(string),taskOverrides:dictionary(ref('TaskOverride'))}),
  Launch:object({id:string,title:string,product:string,description:string}),
  Pricing:object({currency:{const:'RUB'},snapshotDate:{type:'string',format:'date'},vatIncluded:boolean,sources:array(object({title:string,url:string}))}),
  Catalog:object({
    apiVersion:string,methodVersion:string,pricing:ref('Pricing'),
    kiosk:object({idleSeconds:integer,warningSeconds:integer}),
    industries:array(ref('Choice')),roles:array(ref('Choice')),placements:array(ref('IdLabel')),models:array(ref('IdLabel')),
    launches:array(ref('Launch')),settingFields:dictionary(ref('Field')),
    taskIds:array(string),tasks:dictionary(ref('Task')),routes:dictionary(ref('Route'))
  }),
  EstimateInput:object({
    industry:{type:'string',enum:catalog.industries.map(i=>i.id)},
    role:{type:'string',enum:catalog.roles.map(r=>r.id)},
    task:{type:'string',enum:catalog.taskIds},
    placement:{type:'string',enum:catalog.placements.map(v=>v.id),default:'cloud'},
    values:{...dictionary(parameter),description:'Значения полей из tasks[task].fields с учётом taskOverrides. Числа передаются JSON-числами.'},
    settings:ref('Settings')
  },['industry','role','task']),
  Budget:object({
    status:{enum:['ready','benchmark','training','blocked','placement','custom']},
    amountRub:{type:['number','null'],minimum:0},
    period:{enum:['в месяц','за запуск']},scope:string,note:string
  }),
  Workload:object({
    requests:number,inputTokens:number,outputTokens:number,stats:array(object({value:number,label:string})),
    formula:string,assumptions:array(string),billableHours:{type:['number','null']}
  }),
  LaunchOption:object({id:string,title:string,product:string,description:string,available:boolean,reason:nullableString,amountRub:{type:['number','null'],minimum:0},gpuCount:integer}),
  Estimate:object({
    apiVersion:string,methodVersion:string,pricing:ref('Pricing'),selection:ref('EstimateInput'),
    scenario:object({id:string,title:string,name:string,description:string,outcome:string}),
    budget:ref('Budget'),selectedLaunch:nullableString,model:{anyOf:[ref('IdLabel'),{type:'null'}]},
    workload:ref('Workload'),options:array(ref('LaunchOption')),services:array(object({id:string,name:string,description:string})),
    parameters:array(object({id:string,label:string,value:parameter,display:string})),
    excluded:array(string),nextStep:string
  }),
  Error:object({error:string,message:string,field:string},['error','message'])
};
const response=(description,schema,example)=>({description,content:{'application/json':{schema,...(example===undefined?{}:{example})}}});
const err=(description)=>response(description,ref('Error'));
const spec={
  openapi:'3.1.0',info:{title:'Cloud.ru — подбор ИИ-решения для стенда',version:API_VERSION,description:'Каталог и предварительная оценка. API не принимает контакты и не хранит историю. Локальный адрес в примере заменяется на HTTPS-адрес тестового Container App.'},
  servers:[{url:'http://localhost:8080',description:'Локальный запуск'}],
  paths:{
    '/api/catalog':{get:{operationId:'getCatalog',summary:'Каталог для экранов выбора',description:'Загрузить один раз. Маршрут выбирается по ключу industry:role, а задачи строятся из tasks и taskOverrides.',responses:{200:response('Каталог',ref('Catalog')),403:err('Домен фронта не разрешён')}}},
    '/api/estimate':{post:{operationId:'estimate',summary:'Оценка нагрузки, бюджета и сервисов',description:'Пропущенные параметры получают значения из каталога. Для части сценариев цена появится только после замера. Не отправляйте контакты или свободный текст.',requestBody:{required:true,content:{'application/json':{schema:ref('EstimateInput'),example:input}}},responses:{
      200:response('Результат расчёта, включая состояния без цены',ref('Estimate'),example),
      400:err('Неверный JSON или параметры'),403:err('Домен фронта не разрешён'),
      413:err('Превышен размер 8 КБ'),415:err('Ожидается application/json'),500:err('Временная ошибка расчёта')
    }}},
    '/healthz':{get:{operationId:'health',summary:'Проверка запуска',responses:{200:response('Сервер работает',object({ok:boolean,apiVersion:string}),{ok:true,apiVersion:API_VERSION})}}}
  },
  components:{schemas}
};
const write=(path,value)=>writeFileSync(new URL('../'+path,import.meta.url),JSON.stringify(value,null,2)+'\n');
write('openapi.json',spec);
write('examples/estimate-request.json',input);
write('examples/estimate-response.json',example);
