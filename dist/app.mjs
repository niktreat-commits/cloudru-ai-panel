import {industries,roles,tasks,taskFor,roleName,recommendedTasks} from './catalog.mjs';
import {createScenarioUI} from './scenario-ui.mjs';
import {SessionClient,IdleController} from './session-client.mjs';
const $=selector=>document.querySelector(selector);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=n=>`<svg class="icon" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const randomId=()=>{if(crypto.randomUUID)return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;return [...b].map((v,i)=>([4,6,8,10].includes(i)?'-':'')+v.toString(16).padStart(2,'0')).join('');};
const [pricing,config]=await Promise.all([
 fetch('/pricing.json').then(r=>{if(!r.ok)throw Error('Не удалось загрузить тарифы');return r.json();}),
 fetch('/api/public-config').then(r=>{if(!r.ok)throw Error();return r.json();}).catch(()=>({collectionEnabled:false,sessionsEnabled:false,legal:null}))
]);
const initial=()=>({step:0,industry:null,role:null,task:null,custom:'',placement:'cloud',calc:null,furthestStep:0,viewedTasks:[],thanking:false});
const state=initial();let thanksTimer,pendingLead=null;
const sessions=new SessionClient({enabled:config.sessionsEnabled,onStatus:status=>{$('#save-status').textContent=status==='saved'?'Выбор сохранён':'Выбор ожидает сохранения';}});
const task=()=>taskFor(state.task,state,state.custom);
const scenario=createScenarioUI({state,pricing,task,icon,esc,onChange:()=>save('result')});
function selection(){return {industry:state.industry,role:state.role,task:state.task,placement:state.placement,calc:state.calc?structuredClone(state.calc):null};}
function snapshot(outcome='active'){return {selection:selection(),viewedTasks:[...state.viewedTasks],furthestStep:state.furthestStep,outcome};}
function save(outcome='active',immediate=false){state.furthestStep=Math.max(state.furthestStep,state.step);sessions.queue(snapshot(outcome),{immediate});}
const idle=new IdleController({onWarning:remaining=>{const box=$('#idle-warning');if(remaining!==null){const dialogs=[...document.querySelectorAll('dialog[open]')],parent=dialogs.at(-1)||document.body;if(box.parentElement!==parent)parent.append(box);$('#idle-count').textContent=remaining;}box.hidden=remaining===null;},onReset:()=>reset('timeout')});
setInterval(()=>idle.tick(),250);
for(const name of ['pointerdown','keydown','input','change','wheel'])document.addEventListener(name,()=>{if(!state.thanking)idle.activity();},{passive:true});

function card(x,type){return `<button type="button" class="option" data-choice="${type}" data-value="${x.id}"><span class="option-top">${icon(x.icon||'spark')}${icon('arrow')}</span><span class="option-title">${esc(x.name)}</span><span class="option-subtitle">${esc(x.description)}</span></button>`;}
function navigation(){
 const names=['Отрасль','Роль','Задача','Результат'];
 $('#stepper').innerHTML=names.map((name,i)=>`<li class="${i===state.step?'active':i<state.step?'done':''}"><button data-step="${i}" class="step-item" ${i>=state.step?'disabled':''} ${i===state.step?'aria-current="step"':''}><span class="step-number">${i<state.step?'✓':i+1}</span><span>${name}</span></button></li>`).join('');
 const labels=[industries.find(x=>x.id===state.industry)?.name,roleName(state.role,state.industry),task()?.name];
 $('#context').innerHTML=labels.slice(0,state.step).map((label,i)=>`<button data-step="${i}">${esc(label)}</button>`).join('<span aria-hidden="true">/</span>');
}
function render(focus=true){
 navigation();const view=$('#view');view.className='view'+(state.step===3?' result':'');
 if(state.step===0)view.innerHTML=`<p class="eyebrow">Cloud.ru для вашей команды</p><h1 tabindex="-1">С какой задачи<br>начнётся ваш ИИ?</h1><p class="subtitle">Выберите отрасль. Покажем сценарий, сервисы и предварительный бюджет.</p><div class="options">${industries.map(x=>card(x,'industry')).join('')}</div><p class="choice-hint">Начните с вашей отрасли</p>`;
 if(state.step===1)view.innerHTML=`<p class="eyebrow">${esc(industries.find(x=>x.id===state.industry)?.name)}</p><h1 tabindex="-1">Какая у вас роль?</h1><p class="subtitle">Подберём задачи для вашей зоны ответственности.</p><div class="options">${roles.map(x=>card({...x,name:roleName(x.id,state.industry)},'role')).join('')}</div><div class="view-bottom"><button class="back-button" data-step="0">${icon('back')} Назад</button><button class="text-button" data-choice="role" data-value="other">Другая роль</button></div>`;
 if(state.step===2)view.innerHTML=`<p class="eyebrow">${esc(industries.find(x=>x.id===state.industry)?.name)} · ${esc(roleName(state.role,state.industry))}</p><h1 tabindex="-1">Что хотите ускорить?</h1><p class="subtitle">Выберите одну задачу, чтобы увидеть решение и расчёт.</p><div class="options tasks">${recommendedTasks(state).map(x=>card(x,'task')).join('')}</div><div class="view-bottom"><button class="back-button" data-step="1">${icon('back')} Назад</button><div class="bottom-links"><button class="text-button" id="show-all">Все задачи</button><button class="text-button" id="show-custom">Своя задача</button></div></div>`;
 if(state.step===3)scenario.render();
 if(focus){view.querySelector('h1')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
 $('#live').textContent=`Шаг ${state.step+1}. ${['Отрасль','Роль','Задача','Результат'][state.step]}`;
 idle.active=Boolean(state.industry)&&!state.thanking;
}
function closeDialog(dialog){if(dialog.id==='lead-dialog'&&!state.thanking){pendingLead=null;$('#lead-content').innerHTML='';save('result');}dialog.close();}
function reset(reason='reset'){
 clearTimeout(thanksTimer);if(state.industry)sessions.finish(snapshot(state.thanking?'lead_submitted':reason));else sessions.rotate();
 document.querySelectorAll('dialog[open]').forEach(d=>d.close());$('#lead-content').innerHTML='';$('#custom-text').value='';$('#method-content').innerHTML='';pendingLead=null;
 Object.assign(state,initial());idle.active=false;idle.activity();$('#save-status').textContent='';render();
}
function showAll(){
 $('#all-options').innerHTML=Object.keys(tasks).map(id=>card(taskFor(id,state),'task')).join('');$('#all-dialog').showModal();
}
function showCustom(){if($('#all-dialog').open)$('#all-dialog').close();$('#custom-text').value=state.custom;$('#custom-dialog').showModal();}
function showLead(){
 pendingLead=null;save('lead_form',true);
 if(!config.collectionEnabled){$('#lead-content').innerHTML=`<div class="dialog-header"><h2 id="lead-title">Подборка доступна на стенде</h2><button class="dialog-close" data-close aria-label="Закрыть">${icon('close')}</button></div><p class="dialog-copy">Форма временно недоступна. Сотрудник Cloud.ru поможет сохранить параметры и обсудить вашу задачу.</p>`;$('#lead-dialog').showModal();return;}
 $('#lead-content').innerHTML=`<form id="lead-form" autocomplete="off"><div class="dialog-header"><h2 id="lead-title">Пришлём вашу подборку</h2><button type="button" class="dialog-close" data-close aria-label="Закрыть">${icon('close')}</button></div><p class="dialog-copy">После конференции отправим документ с сервисами и предварительным расчётом по вашей задаче.</p><div class="lead-grid"><label class="field full">Имя и фамилия<input name="name" required maxlength="120" autocomplete="off" placeholder="Как к вам обращаться"></label><label class="field">Компания<input name="company" required maxlength="160" autocomplete="off" placeholder="Название организации"></label><label class="field">Должность<input name="position" required maxlength="120" autocomplete="off" value="${esc(roleName(state.role,state.industry))}"></label><label class="field">Рабочая почта<input name="email" type="email" required maxlength="254" autocomplete="off" inputmode="email" placeholder="name@company.ru"></label><label class="field">Телефон<input name="phone" type="tel" required maxlength="40" autocomplete="off" inputmode="tel" placeholder="+7 999 123-45-67"></label></div><label class="consent"><input type="checkbox" name="consent" required><span>${esc(config.legal.checkboxText)}. <button type="button" class="inline-link" id="show-consent">Текст согласия</button></span></label><p class="policy-link"><a href="${esc(config.legal.policyUrl)}" target="_blank" rel="noopener noreferrer">Политика конфиденциальности</a></p><p id="lead-error" class="form-error" role="alert"></p><div class="form-actions"><button type="submit" class="primary">Отправить ${icon('arrow')}</button><span>Все поля обязательны</span></div></form>`;
 $('#lead-dialog').showModal();
}
function showConsent(){const legal=config.legal;$('#legal-content').innerHTML=`<div class="dialog-header"><h2 id="legal-title">${esc(legal.title)}</h2><button class="dialog-close" data-close aria-label="Закрыть">${icon('close')}</button></div><p>${esc(legal.text)}</p><p class="field-note">Версия ${esc(legal.version)}</p>`;$('#legal-dialog').showModal();}
function success(){
 state.thanking=true;idle.active=false;$('#idle-warning').hidden=true;pendingLead=null;
 $('#lead-content').innerHTML=`<div class="success"><span class="success-check">${icon('check')}</span><p class="eyebrow">Подборка сохранена</p><h2 id="lead-title" tabindex="-1">Спасибо за интерес<br>к Cloud.ru!</h2><p>После конференции отправим на вашу почту документ с рекомендациями и предварительным расчётом по вашей задаче.</p><button class="primary" id="start-again">Начать новый подбор ${icon('arrow')}</button><p class="field-note">Начальный экран появится через 5 секунд</p></div>`;
 $('#lead-title').focus();save('lead_submitted',true);thanksTimer=setTimeout(()=>reset('lead_submitted'),5000);
}
async function submitLead(form){
 if(!pendingLead){const data=Object.fromEntries(new FormData(form));for(const name of ['name','company','position']){if(!String(data[name]||'').trim()){form.elements[name].setCustomValidity('Заполните поле');form.elements[name].reportValidity();return;}}
  const phone=String(data.phone||''),digits=phone.replace(/\D/g,'');if(digits.length<10||digits.length>15||!/^\+?[\d\s()\-]+$/.test(phone)){form.elements.phone.setCustomValidity('Введите номер телефона с кодом страны');form.elements.phone.reportValidity();return;}
  pendingLead={context:sessions.current,payload:{idempotencyKey:randomId(),contact:Object.fromEntries(['name','company','position','email','phone'].map(k=>[k,String(data[k]).trim()])),selection:selection(),customTask:state.task==='custom'?state.custom:'',viewedTasks:[...state.viewedTasks],consent:{accepted:data.consent==='on',version:config.legal.version,hash:config.legal.hash}}};
 }
 const attempt=pendingLead,button=form.querySelector('[type=submit]');button.disabled=true;button.textContent='Сохраняем…';$('#lead-error').textContent='';
 // Keep the exact submission for a safe retry after an ambiguous network failure.
 form.querySelectorAll('input').forEach(el=>{if(el.type==='checkbox')el.disabled=true;else el.readOnly=true;});
 try{await sessions.submit(attempt.payload,attempt.context);if(sessions.current!==attempt.context||pendingLead!==attempt)return;form.reset();success();}
 catch(error){if(sessions.current!==attempt.context||pendingLead!==attempt)return;$('#lead-error').textContent=error.message;button.disabled=false;button.textContent='Повторить сохранение';}
}
document.addEventListener('click',event=>{
 if(event.target.closest('#continue-session')){idle.activity();return;}
 if(state.step===3&&event.target.closest('#view')&&scenario.click(event))return;
 const close=event.target.closest('[data-close]');if(close){closeDialog(close.closest('dialog'));return;}
 const step=event.target.closest('[data-step]');if(step&&!step.disabled){state.step=Number(step.dataset.step);render();save();return;}
 const choice=event.target.closest('[data-choice]');if(choice){const {choice:type,value:id}=choice.dataset;
  if(type==='industry'){Object.assign(state,{industry:id,role:null,task:null,custom:'',calc:null,placement:'cloud',step:1});}
  if(type==='role'){Object.assign(state,{role:id,task:null,custom:'',calc:null,step:2});}
  if(type==='task'){Object.assign(state,{task:id,custom:'',calc:null,step:3});if(!state.viewedTasks.includes(id))state.viewedTasks.push(id);$('#all-dialog').close();}
  render();save(state.step===3?'result':'active');return;
 }
 const id=event.target.closest('button[id]')?.id;
 if(id==='show-all')showAll();if(id==='show-custom')showCustom();if(id==='open-lead')showLead();if(id==='show-consent')showConsent();if(id==='calc-method')scenario.showMethod();if(id==='reset'||id==='start-again')reset();
 if(id==='fullscreen'){const action=document.fullscreenElement?document.exitFullscreen?.():document.documentElement.requestFullscreen?.();action?.catch(()=>{});}
});
document.addEventListener('input',event=>{event.target.setCustomValidity?.('');if(state.step===3&&event.target.closest('#view'))scenario.input(event);});
document.addEventListener('change',event=>{if(state.step===3&&event.target.closest('#view'))scenario.change(event);});
document.addEventListener('submit',event=>{
 if(event.target.id==='lead-form'){event.preventDefault();void submitLead(event.target);}
 if(event.target.id==='custom-form'){event.preventDefault();const text=$('#custom-text').value.trim();if(!text)return;Object.assign(state,{custom:text,task:'custom',calc:null,step:3});if(!state.viewedTasks.includes('custom'))state.viewedTasks.push('custom');$('#custom-dialog').close();render();save('result');}
});
document.querySelectorAll('dialog').forEach(dialog=>{
 dialog.addEventListener('cancel',event=>{event.preventDefault();if(state.thanking)return;closeDialog(dialog);});
 dialog.addEventListener('click',event=>{if(event.target!==dialog||state.thanking)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeDialog(dialog);});
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&state.industry&&!state.thanking)save(state.step===3?'result':'active',true);});
if(!config.sessionsEnabled)$('#save-status').textContent='Сохранение временно недоступно';
render(false);
