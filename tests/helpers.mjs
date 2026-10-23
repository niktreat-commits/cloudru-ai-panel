import {readFileSync} from 'node:fs';
import {loadConfig} from '../server/config.mjs';
import {defaultCalculation} from '../dist/scenario-calculator.mjs';
export const pricing=JSON.parse(readFileSync(new URL('../dist/pricing.json',import.meta.url)));
export const config=loadConfig({AWS_ACCESS_KEY_ID:'test-tenant:test-key',AWS_SECRET_ACCESS_KEY:'test-secret',SESSION_SECRET:'test-session-secret-32-characters-long',PUBLIC_ORIGIN:'http://localhost',LEGAL_APPROVED:'true'});
export class MemoryStore{
 constructor(){this.objects=new Map();this.failWrites=false;this.failJobs=false;}
 async put(key,body,type='application/json'){if(this.failWrites||(this.failJobs&&key.startsWith('jobs/')))throw Error('Simulated storage error');this.objects.set(key,Buffer.isBuffer(body)?body:Buffer.from(typeof body==='string'?body:JSON.stringify(body)));}
 async get(key){return this.objects.get(key)||null;}
 async json(key){const value=await this.get(key);return value?JSON.parse(value.toString()):null;}
 async remove(key){this.objects.delete(key);}
 async *list(prefix){for(const key of [...this.objects.keys()].sort())if(key.startsWith(prefix))yield key;}
 async head(){}
 close(){}
}
export const selection=(task='code')=>({industry:'retail',role:'dev',task,placement:'cloud',calc:defaultCalculation(task,{industry:'retail',role:'dev'})});
export const snapshot=(revision=1,outcome='result')=>({revision,selection:selection(),viewedTasks:['code','knowledge'],furthestStep:3,outcome});
export function leadBody(sessionId){return {sessionId,idempotencyKey:'1e1bf0fc-cda4-48e0-95ab-207256733cac',selection:selection(),viewedTasks:['code','knowledge'],contact:{name:'Тестовый Посетитель',company:'Тестовая организация',position:'Разработчик',email:'visitor@example.test',phone:'+7 900 000-00-00'},customTask:'',consent:{accepted:true,version:config.legal.version,hash:config.legalHash}};}
