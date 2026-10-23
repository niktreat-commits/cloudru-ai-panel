import {createScenarioUI} from "./scenario-ui.mjs";
const pricing=await fetch("./pricing.json").then(r=>{if(!r.ok)throw Error("Pricing configuration unavailable");return r.json()});

(()=>{'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(n,cls='')=>`<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const industries=[
 {id:'gov',name:'Государство',description:'Органы власти и учреждения',icon:'gov'},
 {id:'retail',name:'Торговля',description:'Ритейл и электронная коммерция',icon:'shop'},
 {id:'construction',name:'Строительство',description:'Девелопмент и подрядчики',icon:'build'},
 {id:'auto',name:'Автопром',description:'Производители и дилеры',icon:'car'},
 {id:'metal',name:'Металлургия',description:'Производство и переработка',icon:'factory'},
 {id:'other',name:'Другая отрасль',description:'Подберём общие сценарии',icon:'grid'}
];
const roles=[
 {id:'it',name:'Руководитель ИТ / ИИ',description:'CIO, CTO, AI Head',icon:'it'},
 {id:'dev',name:'Разработка',description:'ИТ-лид, разработчик, ML-инженер',icon:'code'},
 {id:'product',name:'Продукт',description:'CPO, продакт, цифровые сервисы',icon:'product'},
 {id:'business',name:'Бизнес и операции',description:'Руководитель направления',icon:'business'},
 {id:'legal',name:'Юриспруденция',description:'Юрист, договорная работа',icon:'legal'},
 {id:'finance',name:'Финансы и учёт',description:'Финансист, бухгалтер',icon:'finance'}
];
const products={
 fm:{name:'Foundation Models',description:'Готовые модели по API без настройки своей GPU-инфраструктуры.'},
 rag:{name:'Managed RAG',description:'Поиск и формирование контекста на основе ваших документов.'},
 mli:{name:'ML Inference',description:'Запуск выбранных и собственных моделей на облачных GPU.'},
 agents:{name:'AI Agents',description:'Создание агентов и подключение к корпоративным системам.'},
 notebooks:{name:'Notebooks',description:'Среда для ML-экспериментов и проверки гипотез.'},
 tuning:{name:'ML Finetuning',description:'Дообучение текстовых моделей на подготовленных примерах.'}
};
const tasks={
 knowledge:{name:'Помощник по базе знаний',description:'Находить ответы в документах компании',icon:'book',title:'Помощник по вашим документам',result:'Сотрудники задают вопросы обычным языком и получают ответы на основе материалов вашей организации.',products:['fm','rag'],next:'Собрать документы и список типовых вопросов для проверки качества ответов.'},
 documents:{name:'Обрабатывать документы',description:'Извлекать поля, классифицировать, готовить сводки',icon:'doc',title:'Обработка документов с ИИ',result:'Модель помогает извлекать данные и готовить краткие выводы из документов.',products:['fm'],next:'Выбрать тип документов, нужные поля и модель для проверки на примерах.'},
 support:{name:'Помощник для поддержки',description:'Отвечать на типовые вопросы пользователей',icon:'chat',title:'Помощник для вашей поддержки',result:'ИИ помогает отвечать на типовые вопросы по вашим продуктам, правилам и инструкциям.',products:['fm','rag'],next:'Подготовить базу ответов и выбрать канал, в который встроить помощника.'},
 agents:{name:'Автоматизировать рутину',description:'Обрабатывать заявки и выполнять действия в системах',icon:'agent',title:'Агент для рабочих процессов',result:'Агент обрабатывает запрос и выполняет разрешённые действия в подключённых системах.',products:['fm','agents'],next:'Выбрать один процесс, подключаемые системы и действия, которые потребуют подтверждения.'},
 access:{name:'Дать команде доступ к моделям',description:'Подключить готовые модели к рабочим инструментам',icon:'spark',title:'Готовые модели для вашей команды',result:'Доступ к моделям по единому API для внедрения ИИ в приложения и рабочие инструменты.',products:['fm'],next:'Выбрать модели и интерфейс с учётом ваших данных и требований к размещению.'},
 code:{name:'Помощник разработчика',description:'Подготовка кода, тестов и документации',icon:'code',title:'Модели для задач разработки',result:'Подключите модели к инструментам команды для помощи с кодом, тестами и документацией.',products:['fm'],next:'Выбрать модель и инструмент разработки, затем проверить результат на задачах команды.'},
 model:{name:'Запустить свою модель',description:'Развернуть инференс и масштабировать ресурсы',icon:'model',title:'Инференс вашей модели',result:'Запускайте выбранную модель в облаке и подбирайте вычислительные ресурсы под нагрузку.',products:['mli'],next:'Уточнить модель, требования к задержке и примерное число запросов.'},
 content:{name:'Готовить контент',description:'Описания товаров, письма и другие тексты',icon:'spark',title:'Подготовка контента с ИИ',result:'Модель создаёт черновики текстов по исходным данным и заданному формату.',products:['fm'],next:'Выбрать формат материалов и подготовить примеры желаемого результата.'},
 compare:{name:'Сравнивать версии договоров',description:'Находить изменения в формулировках и условиях',icon:'legal',title:'Сравнение договоров с ИИ',result:'Модель помогает выделять изменения в документах для последующей проверки специалистом.',products:['fm'],next:'Выбрать тип договоров и критерии сравнения на тестовых примерах.'},
 template:{name:'Проверять по шаблону',description:'Находить отклонения от правил компании',icon:'doc',title:'Проверка документов по вашим правилам',result:'ИИ помогает сопоставлять документы с корпоративными шаблонами и находить отклонения.',products:['fm','rag'],next:'Подготовить шаблоны, правила проверки и примеры документов.'},
 extract:{name:'Находить сроки и обязательства',description:'Собирать ключевые условия из документов',icon:'chart',title:'Извлечение условий из документов',result:'Модель помогает собирать сроки, суммы и обязательства в структурированный черновик.',products:['fm'],next:'Определить список полей и правила проверки извлечённых данных.'},
 reconcile:{name:'Сопоставлять реквизиты',description:'Проверять извлечённые данные по учётной системе',icon:'finance',title:'Обработка и сверка данных',result:'Модель извлекает поля из документов, а настроенные проверки сопоставляют их с учётной системой.',products:['fm','agents'],next:'Определить правила сверки и интеграцию с вашей учётной системой.'},
 reports:{name:'Готовить сводки',description:'Собирать данные и черновики регулярных отчётов',icon:'chart',title:'Подготовка рабочих сводок',result:'ИИ помогает собирать информацию из подключённых источников и готовить текстовые сводки.',products:['fm','agents'],next:'Выбрать источники, формат отчёта и правила проверки результата.'},
 vision:{name:'Контроль дефектов по изображениям',description:'Проверить сценарий компьютерного зрения',icon:'vision',title:'Пилот контроля дефектов',result:'Проверьте модель на изображениях вашего производства, затем подготовьте инференс для рабочей нагрузки.',products:['notebooks','mli'],next:'Собрать примеры изображений и определить критерии качества. Запускать в работу после проверки модели.'},
 experiment:{name:'Проверить ИИ-гипотезу',description:'Подготовить данные и сравнить модели',icon:'lab',title:'Среда для ИИ-экспериментов',result:'Готовое окружение для работы с данными, ML-разработки и проверки гипотез.',products:['notebooks'],next:'Выбрать гипотезу, тестовые данные и метрики для оценки результата.'},
 finetune:{name:'Адаптировать текстовую модель',description:'Дообучить модель на подготовленных примерах',icon:'model',title:'Дообучение текстовой модели',result:'Адаптируйте поддерживаемую модель под заданный формат и задачи, затем запустите её инференс.',products:['tuning','mli'],next:'Подготовить обучающие примеры и убедиться, что задаче требуется дообучение.'}
};
const sectorTasks={gov:['documents','knowledge','support','agents'],retail:['support','content','documents','reports'],construction:['knowledge','documents','compare','reports'],auto:['knowledge','documents','support','vision'],metal:['knowledge','reports','documents','vision'],other:['knowledge','documents','support','agents']};
const roleTasks={it:['access','knowledge','model','agents'],dev:['model','code','agents','experiment'],product:['support','knowledge','content','agents'],legal:['compare','template','extract','knowledge'],finance:['documents','reconcile','knowledge','reports']};
const sectorLabels={
 gov:{knowledge:['Поиск по регламентам','Находить информацию в правилах и инструкциях'],documents:['Разбирать обращения','Классифицировать и готовить краткие сводки'],agents:['Обрабатывать заявки','Помогать с внутренними рабочими процессами']},
 retail:{knowledge:['Помощник по ассортименту','Находить характеристики и условия продаж'],support:['Отвечать покупателям','Помогать с вопросами о товарах и заказах'],content:['Создавать карточки товаров','Готовить описания по данным об ассортименте'],documents:['Документы поставщиков','Извлекать данные и готовить краткие выводы']},
 construction:{knowledge:['Поиск в проектной документации','Находить нужные сведения в материалах проекта'],documents:['Обрабатывать акты и сметы','Извлекать поля из документов'],reports:['Сводки по проектам','Готовить черновики отчётов по материалам проекта']},
 auto:{knowledge:['Помощник по техдокументации','Находить информацию об обслуживании и процессах'],support:['Помощник дилерской поддержки','Отвечать по инструкциям и базе знаний'],documents:['Документы поставщиков','Извлекать данные из сопроводительных документов']},
 metal:{knowledge:['Помощник по инструкциям ТОиР','Находить информацию в технической документации'],reports:['Сводки производственных отчётов','Готовить краткие выводы по материалам'],documents:['Документы производства','Классифицировать и извлекать нужные поля']}
};
const sectorResults={
 gov:{documents:'ИИ определяет тему обращения, извлекает нужные сведения и готовит краткое содержание для специалиста.',knowledge:'Сотрудники задают вопросы и получают ответы на основе регламентов и инструкций организации.',agents:'Агент помогает разобрать заявку и выполнить разрешённые действия в подключённых системах.'},
 retail:{content:'ИИ готовит черновики описаний товаров по данным об ассортименте.',support:'ИИ помогает отвечать покупателям по базе знаний о товарах, заказах и правилах магазина.'},
 construction:{knowledge:'Сотрудники находят ответы по материалам проекта и проектной документации.',reports:'ИИ помогает собрать информацию из материалов проекта и подготовить черновик сводки.'},
 auto:{knowledge:'Сотрудники находят сведения об обслуживании и процессах в технической документации.'},
 metal:{knowledge:'Сотрудники находят нужные сведения в инструкциях по техническому обслуживанию и ремонту.'}
};
const state={calc:null,step:0,industry:null,role:null,task:null,custom:'',placement:'cloud',users:'',lead:null};
const stepNames=['Отрасль','Роль','Задача','Расчёт'];
function industry(){return industries.find(x=>x.id===state.industry)}
function role(){return roles.find(x=>x.id===state.role)||{name:'Другая роль'}}
function roleName(r){return state.industry==='gov'&&r.id==='business'?'Руководитель подразделения':r.name}
function displayTask(id){const t={id,...tasks[id]};const o=sectorLabels[state.industry]?.[id];if(o&&['business','other','it','product'].includes(state.role)){t.name=o[0];t.description=o[1];t.result=sectorResults[state.industry]?.[id]||t.result}if(state.role==='finance'&&id==='documents'){t.name='Распознавать первичные документы';t.description='Извлекать реквизиты и поля для дальнейшей проверки';t.result='ИИ извлекает реквизиты и поля из первичных документов для проверки специалистом.'}if(state.role==='legal'&&id==='knowledge'){t.name='Поиск по договорам и правилам';t.description='Находить нужные положения в материалах компании'}return t}
function availableTasks(){return (roleTasks[state.role]||sectorTasks[state.industry]||sectorTasks.other).map(displayTask)}
function task(){return state.task==='custom'?{name:'Своя задача',title:'Разберём вашу ИИ-задачу',result:state.custom,products:[],next:'Уточнить задачу, доступные данные и требования. После этого подобрать архитектуру и сервисы.'}:displayTask(state.task)}
function card(x,type){return `<button class="option" type="button" data-choice="${type}" data-value="${x.id}"><span class="option-top">${icon(x.icon)}<span class="option-arrow">${icon('arrow')}</span></span><span class="option-title">${esc(x.name)}</span><span class="option-subtitle">${esc(x.description)}</span></button>`}
function nav(){
 $('#stepper').innerHTML=stepNames.map((n,i)=>`<li class="${i===state.step?'active':i<state.step?'done':''}"><button class="step-item" ${i>=state.step?'disabled':''} data-step="${i}" ${i===state.step?'aria-current="step"':''}><span class="step-number">${i<state.step?'✓':i+1}</span><span class="step-name">${n}</span></button></li>`).join('');
 const a=[];if(state.step>0&&state.industry)a.push(`<button data-step="0">${esc(industry().name)}</button>`);if(state.step>1&&state.role)a.push(`<button data-step="1">${esc(roleName(role()))}</button>`);if(state.step>2&&state.task)a.push(`<button data-step="2">${esc(task().name)}</button>`);$('#context').innerHTML=a.join('<span class="separator" aria-hidden="true">/</span>');
}
function render(focus=true){
 nav();const v=$('#view');v.className='view'+(state.step===3?' result':'');
 if(state.step===0)v.innerHTML=`<p class="eyebrow">Подбор сервисов Cloud.ru</p><h1 tabindex="-1">В какой отрасли вы работаете?</h1><p class="subtitle">Подберём ИИ-сценарии для вашей команды.</p><div class="options">${industries.map(x=>card(x,'industry')).join('')}</div><div class="view-bottom"><span class="empty">Выберите один вариант</span></div>`;
 if(state.step===1)v.innerHTML=`<p class="eyebrow">Ваши рабочие задачи</p><h1 tabindex="-1">Какая у вас роль?</h1><p class="subtitle">Покажем задачи, с которых можно начать.</p><div class="options">${roles.map(x=>card({...x,name:roleName(x)},'role')).join('')}</div><div class="view-bottom"><button class="back-button" data-step="0">${icon('back')}Назад</button><button class="text-button" data-choice="role" data-value="other">Другая роль</button></div>`;
 if(state.step===2)v.innerHTML=`<p class="eyebrow">Задачи для вашей команды</p><h1 tabindex="-1">Что хотите ускорить с ИИ?</h1><p class="subtitle">Выберите одну задачу. Остальные можно посмотреть отдельно.</p><div class="options tasks">${availableTasks().map(x=>card(x,'task')).join('')}</div><div class="view-bottom"><button class="back-button" data-step="1">${icon('back')}Назад</button><div class="bottom-links"><button class="text-button" id="show-all">Все задачи</button><button class="text-button" id="show-custom">Своя задача</button></div></div>`;
 if(state.step===3)renderResult();
 if(focus){v.querySelector('h1,h2')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'})}$('#live').textContent=state.step<3?`Шаг ${state.step+1}. ${stepNames[state.step]}`:'Расчёт и рекомендация готовы';
}
const scenarioUI=createScenarioUI({state,pricing,task,products,icon,esc});
function renderResult(){scenarioUI.render()}
function calculationText(){return scenarioUI.text()}
function showCalculationMethod(){scenarioUI.showMethod()}

function showAll(){const ids=['knowledge','documents','support','agents','code','access','model','content','vision','reports','compare','template','extract','reconcile','experiment','finetune'];$('#all-options').innerHTML=ids.map(id=>card(displayTask(id),'task')).join('');$('#all-dialog').showModal()}
function openCustom(){if($('#all-dialog').open)$('#all-dialog').close();$('#custom-text').value=state.custom;$('#custom-dialog').showModal()}
function showLead(){
 $('#lead-content').innerHTML=`<form id="lead-form"><div class="dialog-header"><h2 id="lead-title">Обсудить решение</h2><button type="button" class="dialog-close" data-close aria-label="Закрыть">${icon('close')}</button></div><p class="dialog-copy">Обсудим рассчитанную конфигурацию и уточним условия запуска.</p><div class="lead-grid"><div class="field full"><label for="lead-name">Имя и фамилия</label><input id="lead-name" name="name" autocomplete="off" required maxlength="120" placeholder="Как к вам обращаться"></div><div class="field"><label for="lead-company">Компания</label><input id="lead-company" name="company" autocomplete="off" required maxlength="160" placeholder="Название организации"></div><div class="field"><label for="lead-role">Должность</label><input id="lead-role" name="role" autocomplete="off" maxlength="120" value="${esc(roleName(role()))}"></div><div class="field"><label for="lead-email">Рабочая почта</label><input id="lead-email" name="email" type="email" autocomplete="off" required maxlength="254" placeholder="name@company.ru"></div><div class="field"><label for="lead-phone">Телефон <span class="optional">необязательно</span></label><input id="lead-phone" name="phone" type="tel" autocomplete="off" maxlength="60" placeholder="+7"></div></div><label class="consent"><input type="checkbox" name="consent" required><span>Согласен на обработку персональных данных в соответствии с <a href="https://cdn.cloud.ru/docs/legal/security/cybersecurity-pd/confidentiality-policy.pdf" target="_blank" rel="noopener noreferrer">политикой конфиденциальности</a></span></label><div class="form-actions"><button type="submit" class="primary">Сформировать подборку${icon('arrow')}</button><p class="demo-note">Демо-режим. Контакты не отправляются. Расчёт уже доступен для скачивания.</p></div></form>`;
 $('#lead-dialog').showModal();
}
function success(){
 $('#lead-content').innerHTML=`<div class="dialog-header"><span></span><button class="dialog-close" data-close aria-label="Закрыть">${icon('close')}</button></div><div class="success"><span class="result-check">${icon('check')}</span><h2 id="lead-title" tabindex="-1">Подборка готова</h2><p>Скачайте состав решения, параметры задачи и предварительный расчёт.</p><button class="primary" id="download">Скачать подборку${icon('download')}</button><button class="text-button" id="start-again">Начать новый подбор</button><div class="demo-note">Это демонстрация. Письмо на почту не отправлялось.</div></div>`;$('#lead-title').focus();
}
function download(){
 const t=task(),placement={cloud:'В облаке Cloud.ru',hybrid:'Гибридное размещение',private:'В контуре организации',help:'Нужно определить'}[state.placement];
 const lines=['Cloud.ru — подбор сервисов под ИИ-задачу','',`Отрасль: ${industry().name}`,`Роль: ${roleName(role())}`,`Задача: ${state.task==='custom'?state.custom:t.name}`,`Размещение: ${placement}`,'',...calculationText(),'','Следующий шаг:',t.next];
 if(state.lead)lines.push('','Контакты в локальной подборке:',...Object.entries(state.lead).filter(([k,v])=>v).map(([k,v])=>({name:'Имя',company:'Компания',role:'Должность',email:'Почта',phone:'Телефон'}[k]+': '+v)));
 lines.push('','Демонстрационный прототип. Контакты не отправлялись. Письмо не отправлялось.');
 const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='Cloudru-AI-calculation.txt';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);$('#live').textContent='Подборка и расчёт скачаны';
}
function reset(){document.querySelectorAll('dialog[open]').forEach(d=>d.close());Object.assign(state,{calc:null,step:0,industry:null,role:null,task:null,custom:'',placement:'cloud',users:'',lead:null});render()}
document.addEventListener('click',e=>{
 if(state.step===3&&scenarioUI.click(e))return;
 const close=e.target.closest('[data-close]');if(close){close.closest('dialog').close();return}
 const step=e.target.closest('[data-step]');if(step&&!step.disabled){state.step=Number(step.dataset.step);render();return}
 const choice=e.target.closest('[data-choice]');if(choice){const type=choice.dataset.choice,id=choice.dataset.value;
  if(type==='industry'){state.industry=id;state.role=null;state.task=null;state.step=1;state.placement='cloud';state.users='';state.lead=null}
  if(type==='role'){state.role=id;state.task=null;state.step=2;state.lead=null}
  if(type==='task'){state.task=id;state.calc=null;state.step=3;state.lead=null;$('#all-dialog').close()}
  render();return;
 }
 const id=e.target.closest('[id]')?.id;
 if(id==='show-all')showAll();if(id==='show-custom'||id==='custom-task')openCustom();if(id==='open-lead')showLead();if(id==='reset'||id==='start-again')reset();if(id==='download'||id==='direct-download')download();if(id==='calc-method')showCalculationMethod();
 if(id==='fullscreen'){const p=document.fullscreenElement?document.exitFullscreen?.():document.documentElement.requestFullscreen?.();p?.catch(()=>{});}
});
document.addEventListener('change',e=>{if(state.step===3)scenarioUI.change(e)});
document.addEventListener('input',e=>{if(state.step===3)scenarioUI.input(e)});
document.addEventListener('input',e=>{if(e.target.id==='users')state.users=e.target.value;if(e.target.closest('#lead-form'))e.target.setCustomValidity?.('')});
document.addEventListener('submit',e=>{if(e.target.id==='custom-form'){e.preventDefault();const value=$('#custom-text').value.trim();if(!value){$('#custom-text').setCustomValidity('Опишите задачу');$('#custom-text').reportValidity();return}$('#custom-text').setCustomValidity('');state.custom=value;state.task='custom';state.calc=null;state.step=3;$('#custom-dialog').close();render()}if(e.target.id==='lead-form'){e.preventDefault();const data=Object.fromEntries(new FormData(e.target));for(const name of ['name','company']){const field=e.target.elements.namedItem(name);if(!String(data[name]).trim()){field.setCustomValidity('Заполните поле');field.reportValidity();return}}state.lead={name:data.name.trim(),company:data.company.trim(),role:data.role.trim(),email:data.email.trim(),phone:data.phone.trim()};success()}});
$('#custom-text').addEventListener('input',e=>e.target.setCustomValidity(''));
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}}));
render(false);
})();
