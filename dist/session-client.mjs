const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export class SessionClient{
 constructor({fetcher=(...args)=>fetch(...args),enabled=true,onStatus=()=>{}}={}){Object.assign(this,{fetcher,enabled,onStatus});this.rotate();}
 rotate(){clearTimeout(this.timer);this.current={revision:0,pending:null,running:false,remote:null,ready:null};return this.current;}
 async request(path,body,token){
  const response=await this.fetcher(path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(18000),keepalive:true});
  let data;try{data=await response.json();}catch{throw Error('Не удалось получить ответ сервера. Повторите отправку.');}
  if(!response.ok){const e=Error(data.message||'Не удалось сохранить данные.');e.status=response.status;throw e;}return data;
 }
 async ensure(context=this.current){
  if(context.remote)return context.remote;
  if(!context.ready)context.ready=this.request('/api/sessions',{}).then(v=>context.remote=v).catch(e=>{context.ready=null;throw e;});
  return context.ready;
 }
 queue(snapshot,{immediate=false}={}){
  if(!this.enabled)return;
  const context=this.current;context.pending={...structuredClone(snapshot),revision:++context.revision};
  clearTimeout(this.timer);
  if(immediate)void this.flush(context);else this.timer=setTimeout(()=>void this.flush(context),650);
 }
 async flush(context=this.current){
  if(context.running||!context.pending||!this.enabled)return;
  context.running=true;let failures=0;
  try{while(context.pending){const value=context.pending;try{
    const remote=await this.ensure(context);await this.request('/api/sessions/'+remote.sessionId,value,remote.token);
    if(context.pending===value)context.pending=null;failures=0;if(context===this.current)this.onStatus('saved');
   }catch(e){failures++;if(context===this.current)this.onStatus('pending');if(e.status===401){context.remote=null;context.ready=null;}if(failures>=4)break;await wait(Math.min(4000,500*2**failures));}}
  }finally{context.running=false;}
 }
 finish(snapshot){this.queue(snapshot,{immediate:true});const old=this.current;this.rotate();return old;}
 async submit(payload,context=this.current){const remote=await this.ensure(context);return this.request('/api/leads',{...payload,sessionId:remote.sessionId},remote.token);}
}
export class IdleController{
 constructor({now=()=>Date.now(),warningMs=35000,resetMs=45000,onWarning=()=>{},onReset=()=>{}}={}){Object.assign(this,{now,warningMs,resetMs,onWarning,onReset});this.last=now();this.active=false;}
 activity(){this.last=this.now();this.onWarning(null);}
 tick(){if(!this.active)return;const elapsed=this.now()-this.last;if(elapsed>=this.resetMs){this.active=false;this.onWarning(null);this.onReset();}else if(elapsed>=this.warningMs)this.onWarning(Math.ceil((this.resetMs-elapsed)/1000));}
}
