import {gpuDemand} from './calculator.mjs';

// Example workloads, not measured customer behaviour. Every business input has a
// task-specific unit; the selected launch method never changes with the volume.
const number=(id,label,unit,value,min,max,note='')=>({id,label,unit,value,min,max,type:'number',note});
const select=(id,label,value,options,note='')=>({id,label,value,options,type:'select',note});
const pages=()=>select('pages','Страниц в документе',5,[[1,'1 страница'],[5,'5 страниц'],[10,'10 страниц'],[25,'25 страниц'],[50,'50 страниц']]);
const format=()=>select('format','Формат документов','text',[['text','Текстовые файлы'],['scan','Сканы и фотографии']]);
const docs=(label='Документов в день',unit='документов в день')=>[number('volume',label,unit,100,1,100000),pages(),format()];
const gpu=()=>select('gpus','GPU H100 80 ГБ',1,[[1,'1 GPU'],[2,'2 GPU'],[4,'4 GPU'],[8,'8 GPU']]);
export const SCENARIOS={
 knowledge:{kind:'llm',days:22,peak:4,fields:[number('volume','Активных пользователей','пользователей',300,1,100000),select('frequency','Вопросов на человека в день',5,[[2,'2 вопроса'],[5,'5 вопросов'],[10,'10 вопросов'],[20,'20 вопросов']])]},
 documents:{kind:'llm',days:22,peak:1.5,fields:docs()},
 compare:{kind:'llm',days:22,peak:1.5,fields:[number('volume','Пар договоров в день','пар договоров в день',50,1,50000),{...pages(),label:'Страниц в одном договоре'},format()]},
 template:{kind:'llm',days:22,peak:1.5,fields:docs('Проверок документов в день','проверок в день')},
 extract:{kind:'llm',days:22,peak:1.5,fields:docs()},
 reconcile:{kind:'llm',days:22,peak:1.5,fields:docs()},
 support:{kind:'llm',days:30,peak:2.5,fields:[number('volume','Диалогов в день','диалогов в день',500,1,1000000),select('frequency','Ответов ИИ в одном диалоге',3,[[1,'1 ответ'],[3,'3 ответа'],[5,'5 ответов'],[10,'10 ответов']])]},
 agents:{kind:'llm',days:22,peak:2,fields:[number('volume','Выполнений процесса в день','выполнений в день',100,1,100000),select('steps','Действий в одном процессе',3,[[1,'1 действие'],[3,'3 действия'],[5,'5 действий'],[10,'10 действий']],'Например: прочитать заявку, проверить данные, подготовить ответ.') ]},
 reports:{kind:'llm',days:1,peak:2,monthly:true,fields:[number('volume','Сводок в месяц','сводок в месяц',20,1,10000),select('sources','Источников на одну сводку',5,[[1,'1 источник'],[3,'3 источника'],[5,'5 источников'],[10,'10 источников']],'Например: отчёты подразделений или выгрузки из систем.')]},
 access:{kind:'llm',days:22,peak:4,fields:[number('volume','Активных пользователей','пользователей',300,1,100000),select('frequency','Обращений на человека в день',10,[[5,'5 обращений'],[10,'10 обращений'],[20,'20 обращений'],[40,'40 обращений']])]},
 code:{kind:'llm',days:22,peak:4,fields:[number('volume','Разработчиков в команде','разработчиков',50,1,50000),select('frequency','Использование помощника',30,[[10,'Редко · 10 обращений в день'],[30,'Регулярно · 30 в день'],[60,'Активно · 60 в день']],'Число обращений на одного разработчика.')]},
 content:{kind:'llm',days:1,peak:1.5,monthly:true,fields:[number('volume','Материалов в месяц','материалов в месяц',1000,1,1000000),select('characters','Объём одного материала',1500,[[500,'Короткий · 500 знаков'],[1500,'Средний · 1 500 знаков'],[3000,'Большой · 3 000 знаков'],[6000,'Подробный · 6 000 знаков']])]},
 model:{kind:'resources',days:30,fields:[number('volume','Запросов к модели в день','запросов в день',10000,1,10000000),gpu()],launch:'mli'},
 vision:{kind:'vision',days:30,fields:[number('volume','Изображений в день','изображений в день',10000,1,10000000),number('benchmarkMs','Время на одно изображение, мс','мс',null,0.01,3600000,'Если уже измеряли на 1 GPU H100 80 ГБ. Иначе оставьте пустым — начнём с теста.')],launch:'mli'},
 experiment:{kind:'experiment',days:1,monthly:true,fields:[number('volume','Часов экспериментов в месяц','часов в месяц',40,1,744),gpu()],launch:'vm'},
 finetune:{kind:'training',days:1,fields:[number('volume','Обучающих примеров','примеров',1000,10,10000000),select('characters','Длина одного примера',1500,[[500,'500 знаков'],[1500,'1 500 знаков'],[3000,'3 000 знаков'],[6000,'6 000 знаков']])]},
 custom:{kind:'custom',days:1,fields:[]}
};
export function scenarioFor(taskId,context={}){
 const original=SCENARIOS[taskId]||SCENARIOS.custom;
 const s={...original,fields:original.fields.map(f=>({...f}))};
 const industryNamed=!context.role||['business','other','it','product'].includes(context.role);
 if(taskId==='documents'){
  const industryLabel={gov:'Обращений в день',retail:'Документов поставщиков в день',construction:'Актов и смет в день',auto:'Документов поставщиков в день',metal:'Документов производства в день'}[context.industry];
  if(industryLabel&&industryNamed)s.fields[0].label=industryLabel;
  if(context.industry==='gov'&&industryNamed){s.word='обращений';s.fields[1].label='Страниц в обращении';s.fields[2].label='Формат обращений';}
  if(context.role==='finance'){s.fields[0].label='Первичных документов в день';s.word='документов';}
 }
 if(taskId==='content'&&context.industry==='retail'&&industryNamed){s.fields[0].label='Карточек товаров в месяц';s.fields[1].label='Объём описания товара';s.word='карточек товаров';}
 if(taskId==='agents'&&context.industry==='gov'&&industryNamed){s.fields[0].label='Обработок заявок в день';s.word='обработок заявок';}
 if(taskId==='reports'&&context.industry==='construction'&&industryNamed)s.fields[0].label='Сводок по проектам в месяц';
 if(taskId==='reports'&&context.industry==='metal'&&industryNamed)s.fields[0].label='Производственных сводок в месяц';
 return s;
}
export function defaultCalculation(taskId,context={}){
 const s=scenarioFor(taskId,context);
 return {taskId,context,values:Object.fromEntries(s.fields.map(f=>[f.id,f.value])),days:s.days,modelId:'gpt-oss-120b',launch:s.launch||'api',hours:24,epochs:3,trainingHours:null,trainingGpus:1,sensitive:false,isolation:false};
}
const numeric=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
export function normalizeField(field,value){
 if(field.type==='select')return field.options.find(([v])=>String(v)===String(value))?.[0]??field.value;
 if(value===''||value===null)return field.id==='benchmarkMs'?null:field.min;
 const n=numeric(value,field.value??field.min);
 return Math.min(field.max,Math.max(field.min,field.id==='benchmarkMs'?n:Math.round(n)));
}
export function deriveWorkload(c){
 const s=scenarioFor(c.taskId,c.context),v=c.values,d=s.monthly?1:c.days,n=numeric(v.volume);
 const out={kind:s.kind,requests:0,tokIn:0,tokOut:0,work:n*d,workUnit:'операций',stats:[],formula:'',assumptions:[]};
 let perIn=0,perOut=0;
 if(['knowledge','access','code'].includes(c.taskId)){
  out.requests=n*numeric(v.frequency)*d;out.work=out.requests;out.workUnit=c.taskId==='knowledge'?'вопросов':'обращений';
  perIn=c.taskId==='knowledge'?6000:c.taskId==='code'?12000:2000;perOut=c.taskId==='code'?400:500;
  out.stats=[[out.requests,out.workUnit+' в месяц'],[n,c.taskId==='code'?'разработчиков':'активных пользователей']];
  out.formula=`Пользователи × ${v.frequency} обращений в день × ${d} дней.`;
 }else if(['documents','compare','template','extract','reconcile'].includes(c.taskId)){
  const two=c.taskId==='compare'?2:1;
  out.requests=n*d;out.workUnit=s.word||(c.taskId==='compare'?'пар договоров':c.taskId==='template'?'проверок':'документов');
  perIn=numeric(v.pages)*700*two+(c.taskId==='template'?2000:c.taskId==='reconcile'?500:0);perOut=c.taskId==='compare'||c.taskId==='template'?700:500;
  out.stats=[[out.work,out.workUnit+' в месяц'],[out.work*numeric(v.pages)*two,'страниц в месяц']];
  out.formula=`${n} ${out.workUnit} в день × ${d} дней. ${v.pages} страниц в ${two===2?'каждом из двух документов':'документе'}.`;
  out.assumptions.push('Для текстовой страницы принято 700 токенов. Это допущение, фактический объём зависит от текста.');
  if(v.format==='scan')out.assumptions.push('Считается обработка извлечённого текста. Распознавание сканов и проверка качества оцениваются отдельно.');
 }else if(c.taskId==='support'){
  out.workUnit='диалогов';out.requests=out.work*numeric(v.frequency);perIn=2500;perOut=350;
  out.stats=[[out.work,'диалогов в месяц'],[out.requests,'ответов ИИ в месяц']];
  out.formula=`${n} диалогов в день × ${d} дней × ${v.frequency} ответов ИИ в диалоге.`;
 }else if(c.taskId==='agents'){
  out.workUnit=s.word||'выполнений';out.requests=out.work*numeric(v.steps)*2;perIn=4000;perOut=500;
  out.stats=[[out.work,out.workUnit+' в месяц'],[out.work*numeric(v.steps),'действий в месяц']];
  out.formula=`${n} ${out.workUnit} в день × ${d} дней × ${v.steps} действий. На действие принято 2 обращения к модели.`;
 }else if(c.taskId==='reports'){
  out.workUnit='сводок';out.requests=n*(numeric(v.sources)+1);perIn=4000;perOut=700;
  out.stats=[[n,'сводок в месяц'],[n*numeric(v.sources),'обработок источников']];
  out.formula=`${n} сводок × (${v.sources} обращений для чтения источников + 1 для общей сводки).`;
 }else if(c.taskId==='content'){
  out.workUnit=s.word||'материалов';out.requests=n;perIn=1000;perOut=Math.ceil(numeric(v.characters)/3);
  out.stats=[[n,out.workUnit+' в месяц'],[n*numeric(v.characters),'знаков в месяц']];
  out.formula=`${n} ${out.workUnit} × ${v.characters} знаков. Один вызов модели на материал.`;
  out.assumptions.push('Для черновой оценки принято 3 знака на токен.');
 }else if(s.kind==='resources'){
  out.workUnit='запросов';out.requests=n*d;out.stats=[[out.requests,'запросов в месяц'],[numeric(v.gpus)*c.hours*d,'GPU-часов в месяц']];
  out.formula=`${v.gpus} GPU × ${c.hours} часов в день × ${d} дней. Запросы: ${n} × ${d}.`;
  out.assumptions.push('Число GPU задаётся пользователем по характеристикам или замеру модели. Оно не выводится из числа запросов.');
 }else if(s.kind==='vision'){
  out.workUnit='изображений';out.requests=out.work;out.stats=[[out.work,'изображений в месяц']];
  out.formula=`${n} изображений в день × ${d} дней.`;
  out.assumptions.push('Для подбора GPU нужен замер скорости и качества модели на ваших изображениях.');
 }else if(s.kind==='experiment'){
  out.work=n;out.workUnit='часов экспериментов';out.stats=[[n,'часов экспериментов'],[n*numeric(v.gpus),'GPU-часов в месяц']];
  out.formula=`${n} часов × ${v.gpus} GPU.`;
 }else if(s.kind==='training'){
  out.work=n;out.workUnit='обучающих примеров';out.trainingTokens=n*Math.ceil(numeric(v.characters)/3)*c.epochs;
  out.stats=[[n,'обучающих примеров'],[out.trainingTokens,'токенов за все эпохи']];
  out.formula=`${n} примеров × ${v.characters} знаков ÷ 3 × ${c.epochs} эпохи.`;
  out.assumptions.push('Число примеров не определяет время обучения. Для бюджета нужен тестовый запуск или известное время работы GPU.');
 }
 if(s.kind==='llm'){
  out.tokIn=out.requests*perIn;out.tokOut=out.requests*perOut;out.perIn=perIn;out.perOut=perOut;
  out.assumptions.push(`На обращение принято ${perIn} входных и ${perOut} выходных токенов, включая контекст и ответ. Повторные попытки и дополнительные проходы не учтены.`);
 }
 return out;
}
export const LAUNCHES={
 api:{title:'Готовая модель по API',product:'Evolution Foundation Models',description:'Платите за обращения к готовой модели.'},
 mli:{title:'Модель на управляемых GPU',product:'Evolution ML Inference',description:'GPU для выбранной модели; управление запуском — в сервисе.'},
 vm:{title:'Виртуальная машина с GPU',product:'Evolution Compute GPU',description:'GPU для своей среды и настройки модельного сервера.'},
 bm:{title:'Выделенный GPU-сервер',product:'Bare Metal',description:'Аренда целого сервера на месяц.'}
};
export function estimateScenario(c,pricing,placement='cloud'){
 const s=SCENARIOS[c.taskId]||SCENARIOS.custom,w=deriveWorkload(c),v=c.values;
 const result={workload:w,options:[],selectedId:c.launch,selected:null,status:'ready',period:s.kind==='training'?'за запуск':'в месяц',note:''};
 const add=(id,cost,gpus,ok=true,reason='')=>result.options.push({id,cost,gpus,ok,reason,...LAUNCHES[id]});
 if(s.kind==='llm'){
  const model=pricing.apiModels.find(m=>m.id===c.modelId)||pricing.apiModels.find(m=>m.id==='gpt-oss-120b');
  const tier=pricing.tiers[model.tier],openDeployment=!model.id.startsWith('gigachat'),p={peakFactor:s.peak};
  const demand=gpuDemand(w,tier,p,pricing,1),vmDemand=gpuDemand(w,tier,p,pricing,pricing.gpuVm.perfFactor);
  const rate=tier.minGpus===1?pricing.mlInference.pcieGpuHour:pricing.mlInference.nvlinkGpuHour;
  const vmRate=tier.minGpus===1?pricing.gpuVm.pcieGpuHour:pricing.gpuVm.nvlinkGpuHour;
  add('api',w.tokIn/1e6*model.inPrice+w.tokOut/1e6*model.outPrice,0,!c.isolation&&!(c.sensitive&&model.hosting==='partner'),c.isolation?'Выбрано физически выделенное оборудование.':'Нужно уточнить требования к размещению модели.');
  const deploymentNote=openDeployment?'Для этой конфигурации нужен отдельный подбор.':'Доступность собственного развёртывания этой модели нужно подтвердить.';
  add('mli',demand.requiredGpus*pricing.hoursPerMonth*rate+w.requests/1e6*pricing.mlInference.requestsMillion,demand.requiredGpus,openDeployment&&demand.requiredGpus<=8&&!c.isolation,deploymentNote);
  add('vm',vmDemand.requiredGpus*pricing.hoursPerMonth*vmRate,vmDemand.requiredGpus,openDeployment&&vmDemand.requiredGpus<=8&&!c.isolation,deploymentNote);
  const bmDemand=gpuDemand(w,tier,p,pricing,pricing.bareMetal.perfFactor),servers=Math.ceil(bmDemand.requiredGpus/pricing.bareMetal.gpusPerServer);
  add('bm',servers*pricing.bareMetal.serverMonth,servers*8,openDeployment&&tier.minGpus<=8,deploymentNote);
  result.model=model;result.note='Подбор GPU основан на допущениях о скорости и пиках нагрузки. Конфигурацию подтверждаем нагрузочным тестом. GPU рассчитаны на весь месяц, без автоматического выключения.';
 }else if(s.kind==='resources'||s.kind==='vision'){
  let gpus=numeric(v.gpus,1);
  if(s.kind==='vision'){
   if(!v.benchmarkMs){result.status='benchmark';result.note='Измерим скорость и качество модели на ваших изображениях, затем подберём ресурсы.';}
   else{gpus=Math.max(1,Math.ceil(numeric(v.volume)*numeric(v.benchmarkMs)/1000/(c.hours*3600)*2/pricing.targetUtilization));w.stats.push([gpus,'GPU по замеру и допущениям']);}
  }
  if(result.status==='ready'){
   const hours=c.hours*c.days,rate=gpus===1?pricing.mlInference.pcieGpuHour:pricing.mlInference.nvlinkGpuHour;
   add('mli',gpus*hours*rate+w.requests/1e6*pricing.mlInference.requestsMillion,gpus,!c.isolation&&gpus<=8,'Нужен отдельный подбор конфигурации.');
   add('vm',gpus*hours*(gpus===1?pricing.gpuVm.pcieGpuHour:pricing.gpuVm.nvlinkGpuHour),gpus,!c.isolation&&gpus<=8,'Нужен отдельный подбор конфигурации.');
   add('bm',Math.ceil(gpus/8)*pricing.bareMetal.serverMonth,Math.ceil(gpus/8)*8);
   result.note=s.kind==='vision'?'Для запаса принят коэффициент пика 2 и загрузка GPU 70%. Замер должен относиться к выбранной модели на 1 GPU H100 80 ГБ.':'Расчёт ресурсов по указанному числу GPU. Производительность вашей модели нужно проверить отдельно.';
  }
 }else if(s.kind==='experiment'){
  const gpus=numeric(v.gpus),rate=gpus===1?pricing.gpuVm.pcieGpuHour:pricing.gpuVm.nvlinkGpuHour;
  add('vm',numeric(v.volume)*gpus*rate,gpus,!c.isolation,'Для выделенных ресурсов нужен отдельный подбор.');
  result.note='Ориентир аренды GPU для среды экспериментов. Хранение, CPU/RAM и другие расходы среды уточняются отдельно.';
 }else if(s.kind==='training'){
  result.selectedId='vm';
  if(!c.trainingHours){result.status='training';result.note='Для цены нужен замер времени обучения на выбранной модели и GPU. Объём датасета уже посчитан.';}
  else{const g=c.trainingGpus;add('vm',c.trainingHours*g*(g===1?pricing.gpuVm.pcieGpuHour:pricing.gpuVm.nvlinkGpuHour),g,!c.isolation,'Для выделенного контура нужен отдельный подбор.');result.note='Справочный бюджет GPU на один запуск. Это не тариф сервиса ML Finetuning. Хранение, подготовка данных и последующий инференс — отдельно.';}
 }else{result.status='custom';result.note='Определим результат, исходные данные и единицу объёма работы. После этого можно оценить нагрузку и бюджет.';}
 result.selected=result.options.find(o=>o.id===result.selectedId)||null;
 if(result.status==='ready'&&(!result.selected||!result.selected.ok)){result.status='blocked';result.note=result.selected?.reason||'Нужно выбрать подходящий способ запуска.';}
 if(placement!=='cloud'){result.status='placement';result.note='Состав сервисов, доступность моделей и стоимость для выбранного контура уточняются отдельно. Параметры задачи сохранены.';}
 return result;
}
