import {scenarioFor,defaultCalculation,normalizeField,estimateScenario} from './scenario-calculator.mjs';

export function createScenarioUI({state,pricing,task,products,icon,esc}){
 const $=s=>document.querySelector(s);
 const integer=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(n);
 const compact=n=>new Intl.NumberFormat('ru-RU',{notation:n>=1e6?'compact':'standard',maximumFractionDigits:n>=1e6?1:0}).format(n);
 const money=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:n<100?2:0}).format(n)+' ₽';
 const price=n=>n>=1e6?new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n/1e6)+' млн ₽':money(n);
 const context=()=>({industry:state.industry,role:state.role});
 const config=()=>scenarioFor(state.task,context());
 const calculation=()=>state.calc||(state.calc=defaultCalculation(state.task,context()));
 const estimate=()=>estimateScenario(calculation(),pricing,state.placement);
 const fieldId=f=>'metric-'+f.id;
 const labelValue=(f,v)=>v===null||v==='Нужен замер'?'Нужен замер':f.type==='select'?(f.options.find(([a])=>String(a)===String(v))?.[1]??v):integer(v);
 const purposes={
  knowledge:{fm:'Формирует ответ на вопрос сотрудника.',rag:'Находит подходящие фрагменты ваших документов.'},
  support:{fm:'Готовит ответ на вопрос клиента.',rag:'Находит ответ в инструкциях и базе поддержки.'},
  documents:{fm:'Извлекает поля, определяет тему и готовит сводку.'},
  compare:{fm:'Выделяет изменения для проверки юристом.'},
  template:{fm:'Сопоставляет документ с правилами проверки.',rag:'Находит нужные шаблоны и правила компании.'},
  extract:{fm:'Собирает сроки, суммы и обязательства в черновик.'},
  reconcile:{fm:'Извлекает реквизиты из документов.',agents:'Связывает извлечение с проверками в учётной системе.'},
  reports:{fm:'Готовит текст сводки по исходным материалам.',agents:'Собирает данные из подключённых источников.'},
  agents:{fm:'Разбирает задачу и формирует содержание ответа.',agents:'Выполняет разрешённые действия в подключённых системах.'},
  content:{fm:'Готовит черновики материалов по вашим данным.'},
  code:{fm:'Подключает модели для помощи с кодом, тестами и документацией.'},
  access:{fm:'Подключает готовые модели к рабочим инструментам.'},
  model:{mli:'Запускает вашу модель и управляет её обслуживанием.'},
  vision:{notebooks:'Помогает проверить модель на ваших изображениях.',mli:'Запускает проверенную модель для обработки изображений.'},
  experiment:{notebooks:'Даёт среду для данных, кода и ML-экспериментов.'},
  finetune:{tuning:'Адаптирует модель на подготовленных примерах.',mli:'Запускает дообученную модель для рабочих запросов.'}
 };
 function selectedProducts(){
  const c=calculation();let ids=[...task().products];
  if(config().kind==='llm'&&c.launch!=='api')ids=ids.map(id=>id==='fm'?c.launch==='mli'?'mli':c.launch==='vm'?'compute':'baremetal':id);
  return [...new Set(ids)];
 }
 function productInfo(id){
  if(id==='compute')return {name:'Evolution Compute GPU',description:'Виртуальная машина для своего модельного сервера.'};
  if(id==='baremetal')return {name:'Bare Metal',description:'Выделенное оборудование для своего модельного сервера.'};
  const p=products[id];return {name:'Evolution '+p.name,description:purposes[state.task]?.[id]||(id==='mli'&&config().kind==='llm'?purposes[state.task]?.fm+' Запуск на GPU.':p.description)};
 }
 function solutionHtml(){
  const ids=selectedProducts();
  if(!ids.length)return '<p class="custom-solution">Сначала определим результат, данные и объём работы. Сервисы подберём под эти условия.</p>';
  return `<div class="solution-strip solution-count-${ids.length}">${ids.map(id=>{const p=productInfo(id);return `<article class="solution-item"><span class="solution-dot" aria-hidden="true"></span><div><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p></div></article>`}).join('')}</div>`;
 }
 function fieldHtml(f,primary=false){
  const c=calculation(),value=c.values[f.id],id=fieldId(f);
  const control=f.type==='select'?`<select id="${id}" data-metric="${f.id}">${f.options.map(([v,n])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(n)}</option>`).join('')}</select>`:`<input id="${id}" data-metric="${f.id}" type="number" min="${f.min}" max="${f.max}" step="${f.id==='benchmarkMs'?'.01':'1'}" value="${value??''}" inputmode="${f.id==='benchmarkMs'?'decimal':'numeric'}" ${f.id==='benchmarkMs'?'placeholder="Нужен замер"':''}>`;
  return `<div class="scenario-field ${primary?'primary-metric':''}"><label for="${id}">${esc(f.label)}</label>${control}${f.note?`<p class="field-note">${esc(f.note)}</p>`:''}</div>`;
 }
 function sliderHtml(f){
  const v=calculation().values[f.id],position=Math.round(Math.log(v/f.min)/Math.log(f.max/f.min)*1000);
  return `<input id="metric-range" class="calc-range" type="range" min="0" max="1000" value="${position}" aria-label="${esc(f.label)}"><div class="range-ends"><span>${integer(f.min)}</span><span>${integer(f.max)}</span></div>`;
 }
 function settingsHtml(){
  const c=calculation(),s=config(),llm=s.kind==='llm',resource=['resources','vision'].includes(s.kind);
  const models=pricing.apiModels.filter(m=>['gpt-oss-120b','gigachat3-pro','gigachat3-10b','qwen36-35b','minimax-m25','qwen35-397b','glm-51','deepseek-v4-pro'].includes(m.id));
  return `<div class="scenario-settings">${llm?`<label>Модель для оценки<select id="scenario-model">${models.map(m=>`<option value="${m.id}" ${m.id===c.modelId?'selected':''}>${esc(m.name)}</option>`).join('')}</select></label>`:''}<label>Где должно работать решение?<select id="placement"><option value="cloud" ${state.placement==='cloud'?'selected':''}>В облаке Cloud.ru</option><option value="hybrid" ${state.placement==='hybrid'?'selected':''}>Гибридное размещение</option><option value="private" ${state.placement==='private'?'selected':''}>В контуре организации</option><option value="help" ${state.placement==='help'?'selected':''}>Нужно определить</option></select></label>${!s.monthly&&!['training','custom'].includes(s.kind)?`<label>Дней работы в месяц<input id="scenario-days" type="number" min="1" max="31" value="${c.days}"></label>`:''}${resource?`<label>Часов работы в день<select id="scenario-hours">${[8,12,24].map(n=>`<option value="${n}" ${c.hours===n?'selected':''}>${n} часов</option>`).join('')}</select></label>`:''}${s.kind==='training'?`<label>Эпох обучения<input id="scenario-epochs" type="number" min="1" max="20" value="${c.epochs}"></label><label>Время обучения, часов <span class="optional">если известно</span><input id="scenario-training-hours" type="number" min="0.1" max="100000" step="0.1" value="${c.trainingHours??''}" placeholder="По тестовому запуску"></label><label>GPU для обучения<select id="scenario-training-gpus">${[1,2,4,8].map(n=>`<option value="${n}" ${c.trainingGpus===n?'selected':''}>${n} GPU H100</option>`).join('')}</select></label>`:''}<label class="scenario-check"><input id="scenario-sensitive" type="checkbox" ${c.sensitive?'checked':''}>Есть требования к обработке данных</label><label class="scenario-check"><input id="scenario-isolation" type="checkbox" ${c.isolation?'checked':''}>Нужно физически выделенное оборудование</label></div>`;
 }
 function render(){
  const t=task(),c=calculation(),s=config(),[primary,...fields]=s.fields;
  $('#view').innerHTML=`<p class="eyebrow">Решение для вашей задачи</p><h2 class="main-title scenario-title" tabindex="-1">${esc(t.name)}</h2><p class="scenario-description">${esc(t.result)}</p><section class="solution-section" aria-label="Состав решения"><p class="section-caption">${state.placement==='cloud'?'Как собрать решение':'Облачный состав для обсуждения'}</p><div id="solution-products">${solutionHtml()}</div></section><div class="scenario-layout"><section class="scenario-controls" aria-label="Параметры задачи">${primary?`${fieldHtml(primary,true)}${sliderHtml(primary)}<div class="secondary-metrics">${fields.map(f=>fieldHtml(f)).join('')}</div><div id="scenario-stats" class="scenario-stats"></div><p class="example-note" id="scenario-example"></p>`:'<p class="custom-question">Что потребуется для расчёта</p><ul class="custom-list"><li>Ожидаемый результат работы ИИ</li><li>Данные и системы, с которыми он будет работать</li><li>Объём работы и требования к размещению</li></ul>'}</section><section class="estimate-card scenario-estimate" id="estimate-card" aria-live="polite" aria-atomic="true"></section></div><details class="scenario-details" id="scenario-details"><summary>${icon('down')}Способ запуска и детали расчёта</summary>${settingsHtml()}<div id="scenario-comparison"></div><div class="method-link-row"><button class="text-button" id="calc-method">Как посчитали${icon('arrow')}</button></div></details><p class="scenario-next"><strong>Для пилота:</strong> ${esc(t.next)}</p><div class="result-actions calc-actions"><button class="back-button" data-step="2">${icon('back')}Другая задача</button><div class="calc-cta"><button class="text-button" id="open-lead">Обсудить с архитектором</button><button class="primary" id="direct-download">Скачать подборку и расчёт${icon('download')}</button></div></div>`;
  update();
 }
 function exclusions(){
  const c=calculation(),ids=task().products;
  if(config().kind==='training')return 'Подготовка данных, сервис дообучения, хранение и дальнейший инференс — отдельно.';
  if(config().kind==='experiment')return 'Дополнительные ресурсы среды, хранение и подготовка данных — отдельно.';
  const a=[];if(ids.includes('rag'))a.push('база знаний и хранение');else a.push('хранение');if(ids.includes('agents'))a.push('работа агентов и внешних систем');if(c.values.format==='scan')a.push('распознавание сканов');a.push('интеграции и внедрение');
  return 'Дополнительно: '+a.join(', ')+'.';
 }
 function scope(e){
  const c=calculation(),s=config(),p=e.selected;
  if(s.kind==='training')return 'Справочный бюджет GPU на один запуск, а не тариф ML Finetuning.';
  if(s.kind==='experiment')return `${c.values.gpus} GPU H100 × ${integer(c.values.volume)} часов. Только вычислительные ресурсы.`;
  if(p?.id==='api')return `Учтены вызовы ${e.model.name}.`;
  if(p?.id==='bm')return `${p.gpus} GPU H100 в целых серверах. Аренда за полный месяц.`;
  const hours=s.kind==='llm'?pricing.hoursPerMonth:c.hours*c.days;
  return `${p?.gpus} GPU H100 × ${integer(hours)} часов. ${p?.id==='mli'?'Плата за запросы учтена.':'Ресурсы виртуальных машин.'}`;
 }
 function update(announce=false){
  const c=calculation(),s=config(),e=estimate(),w=e.workload;
  if($('#scenario-stats'))$('#scenario-stats').innerHTML=w.stats.map(([n,label])=>`<div><strong>${compact(n)}</strong><span>${esc(label)}</span></div>`).join('');
  if($('#scenario-example'))$('#scenario-example').textContent=s.kind==='training'?'Бюджет обучения зависит от модели и времени работы GPU.':'Параметры для примера. Измените их под свою задачу.';
  $('#solution-products').innerHTML=solutionHtml();
  const statusText={benchmark:['Для цены нужен тест модели','Проверим скорость и качество на ваших изображениях.'],training:['Для цены нужен тестовый запуск','Объём обучения посчитан. Добавьте известное время работы GPU в деталях или начните с теста.'],placement:['Подберём архитектуру под ваш контур',e.note],blocked:['Нужно уточнить способ запуска',e.note],custom:['Подготовим расчёт под задачу',e.note]};
  if(e.status==='ready'){
   const title=s.kind==='llm'&&c.launch==='api'?'Расходы на модель':s.kind==='llm'?'Расходы на запуск модели':s.kind==='training'?'GPU для одного обучения':s.kind==='experiment'?'GPU для экспериментов':'Ресурсы для вашей модели';
   $('#estimate-card').innerHTML=`<p class="estimate-kicker">Ориентир расходов · ${esc(e.selected.title)}</p><h3>${title}</h3><p class="estimate-money">≈ ${price(e.selected.cost)}<span>/ ${s.kind==='training'?'запуск':'месяц'}</span></p><p class="scenario-work-caption">На ${integer(w.work)} ${esc(w.workUnit)}${s.kind==='training'?'':' в месяц'}</p><p class="estimate-scope">${esc(scope(e))}</p><p class="scenario-exclusions">${esc(exclusions())}</p><p class="estimate-footnote">Предварительная оценка части решения по параметрам примера.</p>`;
  }else{
   const [title,description]=statusText[e.status];
   $('#estimate-card').innerHTML=`<p class="estimate-kicker">${e.status==='placement'?'Размещение решения':'Следующий шаг для расчёта'}</p><h3 class="estimate-status-title">${esc(title)}</h3><p class="estimate-reason">${esc(description)}</p>${e.status==='blocked'?'<button class="estimate-details-button" id="expand-scenario-details">Выбрать способ запуска</button>':''}<p class="estimate-footnote">${s.kind==='custom'?'Сохраним описание и вопросы для обсуждения.':'Нагрузка и параметры задачи доступны в скачиваемой подборке.'}</p>`;
  }
  const rows=e.options;
  $('#scenario-comparison').innerHTML=rows.length&&state.placement==='cloud'?`<div class="launch-heading"><h3>Варианты для этой нагрузки</h3><p>Сравниваем ${s.kind==='training'?'вычислительные ресурсы за запуск':'вызовы модели или вычислительные ресурсы за месяц'}. Дополнительные сервисы и внедрение сюда не входят.</p></div><div class="launch-options">${rows.map(o=>`<div class="launch-option ${o.id===e.selectedId?'is-selected':''}"><div><strong>${esc(o.title)}</strong><span>${esc(o.product)}</span></div><div class="launch-price">${o.ok?'≈ '+price(o.cost):'Нужен подбор'}<small>${o.ok?(s.kind==='training'?'за запуск':'в месяц'):esc(o.reason)}</small></div>${o.id===e.selectedId?'<span class="launch-selected">Выбран</span>':o.ok?`<button class="launch-select" data-launch="${o.id}">Выбрать<span class="sr-only">: ${esc(o.title)}</span></button>`:'<span class="launch-unavailable">Уточнить</span>'}</div>`).join('')}</div><p class="launch-note">${esc(e.note)} Выбранный способ запуска сохраняется при изменении объёма.</p>`:`<p class="launch-note">${esc(e.note)}</p>`;
  if(announce)$('#live').textContent=e.status==='ready'?'Расчёт обновлён: '+money(e.selected.cost)+' '+e.period:'Параметры задачи обновлены';
 }
 function rerender(focusId){
  const open=$('#scenario-details')?.open;render();if(open)$('#scenario-details').open=true;if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});
 }
 function invalidateTraining(){
  if(config().kind!=='training')return;
  calculation().trainingHours=null;const field=$('#scenario-training-hours');if(field)field.value='';
 }
 function click(event){
  const launch=event.target.closest('[data-launch]');
  if(launch){const id=launch.dataset.launch;if(estimate().options.some(o=>o.id===id&&o.ok)){calculation().launch=id;update(true);}return true;}
  if(event.target.closest('#expand-scenario-details')){$('#scenario-details').open=true;$('#scenario-details').scrollIntoView({block:'nearest',behavior:'smooth'});return true;}
  return false;
 }
 function change(event){
  const el=event.target,c=calculation(),f=config().fields.find(f=>f.id===el.dataset.metric);
  if(f){const next=normalizeField(f,el.value);if(c.values[f.id]!==next)invalidateTraining();c.values[f.id]=next;el.value=c.values[f.id]??'';syncSlider();update(true);return true;}
  const numbers={'scenario-days':['days',1,31],'scenario-hours':['hours',1,24],'scenario-epochs':['epochs',1,20],'scenario-training-hours':['trainingHours',.1,100000],'scenario-training-gpus':['trainingGpus',1,8]};
  if(el.id==='placement'){state.placement=el.value;rerender('placement');return true;}
  if(el.id==='scenario-model'){c.modelId=el.value;update(true);return true;}
  if(el.id==='scenario-sensitive'||el.id==='scenario-isolation'){c[el.id==='scenario-sensitive'?'sensitive':'isolation']=el.checked;update(true);return true;}
  if(numbers[el.id]){const [key,min,max]=numbers[el.id],next=el.value===''&&key==='trainingHours'?null:Math.max(min,Math.min(max,Number(el.value)||min));if(['epochs','trainingGpus'].includes(key)&&c[key]!==next)invalidateTraining();c[key]=next;el.value=c[key]??'';update(true);return true;}
  return false;
 }
 function syncSlider(){const f=config().fields[0],r=$('#metric-range');if(r&&f)r.value=Math.round(Math.log(calculation().values[f.id]/f.min)/Math.log(f.max/f.min)*1000);}
 function input(event){
  const el=event.target,c=calculation(),f=config().fields.find(f=>f.id===el.dataset.metric);
  if(el.id==='metric-range'){
   const primary=config().fields[0],raw=primary.min*Math.pow(primary.max/primary.min,Number(el.value)/1000),step=10**Math.max(0,Math.floor(Math.log10(raw))-1);
   const next=Math.min(primary.max,Math.max(primary.min,Math.round(raw/step)*step));if(c.values[primary.id]!==next)invalidateTraining();c.values[primary.id]=next;$('#'+fieldId(primary)).value=c.values[primary.id];update();return true;
  }
  if(f&&f.type==='number'){
   if(el.value===''&&f.id==='benchmarkMs'){c.values[f.id]=null;update();return true;}
   const n=Number(el.value);if(el.value!==''&&Number.isFinite(n)&&n>=f.min&&n<=f.max){const next=normalizeField(f,n);if(c.values[f.id]!==next)invalidateTraining();c.values[f.id]=next;syncSlider();update();}return true;
  }
  if(el.id==='scenario-training-hours'&&el.value===''){c.trainingHours=null;update();return true;}
  const numbers={'scenario-days':['days',1,31],'scenario-epochs':['epochs',1,20],'scenario-training-hours':['trainingHours',.1,100000]};
  if(numbers[el.id]&&el.value!==''){const [key,min,max]=numbers[el.id],n=Number(el.value);if(Number.isFinite(n)&&n>=min&&n<=max){if(key==='epochs'&&c[key]!==n)invalidateTraining();c[key]=n;update();}return true;}
  return false;
 }
 function text(){
  const c=calculation(),s=config(),e=estimate(),t=task(),lines=['Решение по вашей задаче:',t.result,'','Состав решения:',...selectedProducts().map(id=>{const p=productInfo(id);return p.name+' — '+p.description;}),'','Параметры задачи:',...s.fields.map(f=>f.label+': '+labelValue(f,c.values[f.id]??'Нужен замер'))];
  if(!s.monthly&&!['training','custom'].includes(s.kind))lines.push('Дней работы в месяц: '+c.days);
  if(e.model)lines.push('Модель для оценки: '+e.model.name);
  if(['resources','vision'].includes(s.kind))lines.push('Часов работы в день: '+c.hours);
  if(s.kind==='training')lines.push('Эпох обучения: '+c.epochs,'Время обучения: '+(c.trainingHours===null?'нужен замер':c.trainingHours+' часов'),'GPU для обучения: '+c.trainingGpus);
  if(c.sensitive)lines.push('Есть требования к обработке данных.');
  if(c.isolation)lines.push('Нужно физически выделенное оборудование.');
  lines.push('','Объём:',...e.workload.stats.map(([n,label])=>integer(n)+' '+label),'','Оценка бюджета:');
  if(e.status==='ready')lines.push(e.selected.title+': '+money(e.selected.cost)+' '+e.period,scope(e),exclusions());else lines.push(e.note);
  if(e.options.length&&state.placement==='cloud')lines.push('','Другие способы запуска (тот же период и состав расходов):',...e.options.map(o=>o.title+': '+(o.ok?money(o.cost):o.reason)));
  lines.push('','Методика:',e.workload.formula,...e.workload.assumptions,e.note,'','Тарифы Foundation Models и Bare Metal — справочный снимок исходного драфта от 12.10.2026. Ресурсные ставки ML Inference проверены 22.10.2026. Перед коммерческим использованием нужно подтвердить тарифы и конфигурацию.','Это предварительная оценка части решения. Она не является стоимостью готового внедрения.');return lines;
 }
 function showMethod(){
  const e=estimate(),w=e.workload,s=config();
  $('#method-content').innerHTML=`<div class="dialog-header"><h2 id="method-title">Как посчитали</h2><button class="dialog-close" data-close aria-label="Закрыть">${icon('close')}</button></div><div class="method-copy"><p><strong>Задача:</strong> ${esc(task().name)}.</p><p><strong>Объём:</strong> ${esc(w.formula||e.note)}</p>${w.assumptions.map(a=>`<p>${esc(a)}</p>`).join('')}${s.kind==='llm'?`<p><strong>Обращения к модели:</strong> ${integer(w.requests)} за месяц. Входные токены: ${integer(w.tokIn)}; выходные: ${integer(w.tokOut)}. Умножаем их объём на соответствующие ставки выбранной модели.</p><p><strong>Запуск на GPU:</strong> объём токенов переводим в потребность в GPU по скоростям из драфта. Учитываем пик нагрузки и целевую загрузку 70%, затем округляем до конфигурации модели. GPU работают весь месяц — 730 часов. Скорость и качество нужно подтвердить тестом.</p>`:''}<p><strong>Что входит в сумму:</strong> ${e.status==='ready'?esc(scope(e)):esc(e.note)} ${esc(exclusions())}</p><p><strong>Сравнение:</strong> один и тот же период. Условные зарплаты команды, запуск и долгосрочный TCO сюда не добавляются. Способ запуска меняется только по вашему выбору.</p><p><strong>Тарифная база:</strong> снимок Foundation Models и Bare Metal из драфта от 12 октября 2026 года; ставки ресурсов ML Inference проверены 22 октября. Перед коммерческим использованием нужно подтвердить тарифы, доступность модели и конфигурацию.</p><p><a href="https://cloud.ru/documents/tariffs/evolution/foundation-models" target="_blank" rel="noopener noreferrer">Тарифы Foundation Models</a><br><a href="https://cloud.ru/documents/tariffs/evolution/evolution-ml-inference" target="_blank" rel="noopener noreferrer">Тарифы ML Inference</a></p></div>`;
  $('#method-dialog').showModal();
 }
 return {render,update,click,change,input,text,showMethod,selectedProducts,productInfo,estimate};
}
