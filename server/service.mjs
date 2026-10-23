import {randomUUID,createHmac,timingSafeEqual} from 'node:crypto';
import {HttpError,uuid,snapshot,lead as validateLead} from './validation.mjs';
import {buildSpecification} from '../dist/specification.mjs';
import {taskFor} from '../dist/catalog.mjs';
import {createLeadDocument} from './document.mjs';
const expiration=(now,days)=>new Date(now+days*86400000).toISOString();
export class PanelService{
 constructor({config,store,pricing,now=()=>Date.now(),makeDocument=createLeadDocument}){Object.assign(this,{config,store,pricing,now,makeDocument});this.inflight=new Map();this.workerBusy=false;}
 sign(payload){const body=Buffer.from(JSON.stringify(payload)).toString('base64url');return body+'.'+createHmac('sha256',this.config.sessionSecret).update(body).digest('base64url');}
 authorize(token,id){
  try{const [body,signature,...extra]=String(token||'').split('.');if(extra.length)throw Error();const expected=createHmac('sha256',this.config.sessionSecret).update(body).digest();const got=Buffer.from(signature,'base64url');if(got.length!==expected.length||!timingSafeEqual(got,expected))throw Error();const p=JSON.parse(Buffer.from(body,'base64url').toString());if(!uuid(p.id)||p.id!==id||this.now()>p.exp||!/^\d{4}-\d{2}-\d{2}$/.test(p.date))throw Error();return p;}catch{throw new HttpError(401,'SESSION_EXPIRED','Сессия истекла. Начните новый подбор.');}
 }
 requireStorage(){if(!this.config.storageConfigured)throw new HttpError(503,'STORAGE_NOT_CONFIGURED','Сохранение временно недоступно. Обратитесь к сотруднику стенда.');}
 async createSession(){this.requireStorage();const now=this.now(),id=randomUUID(),date=new Date(now).toISOString().slice(0,10);const payload={id,date,startedAt:new Date(now).toISOString(),exp:now+86400000};return {sessionId:id,token:this.sign(payload)};}
 async saveSession(id,token,body){
  this.requireStorage();const p=this.authorize(token,id),s=snapshot(body,this.pricing),now=this.now();
  const spec=buildSpecification(s.selection,this.pricing);
  const record={schemaVersion:2,id,eventId:this.config.eventId,kioskId:this.config.kioskId,startedAt:p.startedAt,updatedAt:new Date(now).toISOString(),expiresAt:expiration(now,this.config.sessionsRetentionDays),...s,specification:spec};
  await this.store.put(`sessions/${p.date}/${id}/${String(s.revision).padStart(8,'0')}.json`,record);
  return {saved:true,revision:s.revision};
 }
 async saveLead(token,body){
  this.requireStorage();if(!this.config.collectionEnabled)throw new HttpError(503,'COLLECTION_DISABLED','Форма временно недоступна. Обратитесь к сотруднику стенда.');
  const data=validateLead(body,this.pricing,this.config),session=this.authorize(token,data.sessionId);
  // A session can produce one lead. Retries, even across replicas, use the same key.
  const id=session.id,base=`leads/${session.date}/${id}`,key=base+'/lead.json',jobKey=`jobs/documents/${id}.json`;
  if(this.inflight.has(id))return this.inflight.get(id);
  const work=(async()=>{
   let record=await this.store.json(key);
   if(record&&record.idempotencyKey!==data.idempotencyKey)throw new HttpError(409,'ALREADY_SUBMITTED','Подборка уже сохранена. Начните новый подбор.');
   if(!record){
    const now=this.now(),specification=buildSpecification(data.selection,this.pricing,data.customTask);
    const seen=new Set([...data.viewedTasks,data.selection.task]);
    record={schemaVersion:2,id,idempotencyKey:data.idempotencyKey,sessionId:id,eventId:this.config.eventId,kioskId:this.config.kioskId,submittedAt:new Date(now).toISOString(),expiresAt:expiration(now,this.config.leadRetentionDays),contact:data.contact,specification,viewedTaskNames:[...seen].map(t=>taskFor(t,data.selection)?.name||t),consent:{...data.consent,receivedAt:new Date(now).toISOString()},documentKey:base+'/card.docx',delivery:{status:'manual_followup_after_conference',emailSent:false}};
    // Outbox pointer precedes the lead: a crash can leave a harmless empty job,
    // but cannot strand a saved lead without a job for its document.
    await this.store.put(jobKey,{leadKey:key,documentKey:record.documentKey,createdAt:record.submittedAt,expiresAt:record.expiresAt});
    await this.store.put(key,record);
   }
   // A durable job is required before acknowledging the lead. No in-memory-only queue.
   if(!await this.store.get(record.documentKey)&&!await this.store.get(jobKey))await this.store.put(jobKey,{leadKey:key,documentKey:record.documentKey,createdAt:record.submittedAt,expiresAt:record.expiresAt});
   return {saved:true,leadId:id};
  })();this.inflight.set(id,work);try{return await work;}finally{this.inflight.delete(id);}
 }
 async processDocuments(limit=10){
  if(this.workerBusy||!this.config.storageConfigured)return {processed:0};this.workerBusy=true;let processed=0,failed=0;
  try{for await(const key of this.store.list('jobs/documents/')){if(processed+failed>=limit)break;try{const job=await this.store.json(key);if(!job)continue;const lead=await this.store.json(job.leadKey);if(!lead){if(this.now()-Date.parse(job.createdAt)>900000)await this.store.remove(key);continue;}if(Date.parse(lead.expiresAt)<=this.now()){await this.store.remove(key);continue;}if(!await this.store.get(job.documentKey)){const bytes=await this.makeDocument(lead);await this.store.put(job.documentKey,bytes,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');}await this.store.remove(key);processed++;}catch{failed++;}}return {processed,failed};}finally{this.workerBusy=false;}
 }
}
