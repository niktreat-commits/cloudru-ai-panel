import {SCENARIOS} from '../dist/scenario-calculator.mjs';
import {normalizeSelection,OUTCOMES} from '../dist/specification.mjs';
export class HttpError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}
export const fail=(code,message)=>{throw new HttpError(400,code,message);};
export const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v);
function keys(value,allowed){if(!plain(value))fail('INVALID_BODY','Неверный формат запроса.');for(const k of Object.keys(value))if(!allowed.includes(k))fail('UNEXPECTED_FIELD','Запрос содержит неподдерживаемые поля.');}
export function selection(value,pricing){
 keys(value,['industry','role','task','placement','calc']);
 if(value.calc){keys(value.calc,['taskId','context','values','days','modelId','launch','hours','gpuSchedule','epochs','trainingHours','trainingGpus','sensitive','isolation']);
  const allowed=SCENARIOS[value.task]?.fields.map(f=>f.id)||[];keys(value.calc.values||{},allowed);
  for(const [key,v]of Object.entries(value.calc.values||{})){if(typeof v!=='number'&&typeof v!=='string'&&v!==null)fail('INVALID_VALUE','Неверный параметр расчёта.');if(typeof v==='string'&&v.length>40)fail('INVALID_VALUE','Неверный параметр расчёта.');}
 }
 return normalizeSelection(value,pricing);
}
export function snapshot(body,pricing){
 keys(body,['revision','selection','viewedTasks','furthestStep','outcome']);
 if(!Number.isSafeInteger(body.revision)||body.revision<1||body.revision>1000000)fail('INVALID_REVISION','Неверная версия сессии.');
 if(!Array.isArray(body.viewedTasks)||body.viewedTasks.length>30||body.viewedTasks.some(t=>!Object.hasOwn(SCENARIOS,t)))fail('INVALID_TASKS','Неверный список задач.');
 if(!Number.isInteger(body.furthestStep)||body.furthestStep<0||body.furthestStep>3||!OUTCOMES.includes(body.outcome))fail('INVALID_PROGRESS','Неверный этап.');
 return {revision:body.revision,selection:selection(body.selection,pricing),viewedTasks:[...new Set(body.viewedTasks)],furthestStep:body.furthestStep,outcome:body.outcome};
}
const clean=(v,max)=>typeof v==='string'?v.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max):'';
export function lead(body,pricing,config){
 keys(body,['sessionId','idempotencyKey','contact','selection','customTask','consent','viewedTasks']);
 if(!uuid(body.sessionId)||!uuid(body.idempotencyKey))fail('INVALID_ID','Неверный идентификатор заявки.');
 keys(body.contact,['name','company','position','email','phone']);
 const contact={name:clean(body.contact.name,120),company:clean(body.contact.company,160),position:clean(body.contact.position,120),email:clean(body.contact.email,254),phone:clean(body.contact.phone,40)};
 if(!contact.name||!contact.company||!contact.position||!contact.email||!contact.phone)fail('REQUIRED_CONTACT','Заполните все контактные поля.');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email))fail('INVALID_EMAIL','Проверьте адрес электронной почты.');
 const digits=contact.phone.replace(/\D/g,'');if(digits.length<10||digits.length>15||!/^\+?[\d\s()\-]+$/.test(contact.phone))fail('INVALID_PHONE','Проверьте номер телефона.');
 keys(body.consent,['accepted','version','hash']);
 if(body.consent.accepted!==true||body.consent.version!==config.legal.version||body.consent.hash!==config.legalHash)fail('CONSENT_REQUIRED','Откройте форму заново и подтвердите актуальное согласие.');
 const selected=selection(body.selection,pricing);if(!selected.industry||!selected.role||!selected.task)fail('SELECTION_REQUIRED','Сначала выберите отрасль, роль и задачу.');
 const customTask=clean(body.customTask,800);if(selected.task==='custom'&&!customTask)fail('TASK_REQUIRED','Добавьте описание задачи.');
 const viewedTasks=Array.isArray(body.viewedTasks)?[...new Set(body.viewedTasks.filter(t=>Object.hasOwn(SCENARIOS,t)))].slice(0,30):[selected.task];
 return {sessionId:body.sessionId,idempotencyKey:body.idempotencyKey,contact,selection:selected,viewedTasks,customTask:selected.task==='custom'?customTask:'',consent:{accepted:true,version:config.legal.version,hash:config.legalHash,text:config.legal.text,checkboxText:config.legal.checkboxText,policyUrl:config.legal.policyUrl}};
}
