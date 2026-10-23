import {readFileSync} from 'node:fs';
import {loadConfig} from './config.mjs';
import {ObjectStore} from './storage.mjs';
import {PanelService} from './service.mjs';
import {createPanelServer} from './http.mjs';
const config=loadConfig(),store=new ObjectStore(config),pricing=JSON.parse(readFileSync(new URL('../dist/pricing.json',import.meta.url),'utf8'));
const service=new PanelService({config,store,pricing}),server=createPanelServer({service,config});
server.requestTimeout=20000;server.headersTimeout=10000;server.keepAliveTimeout=5000;
server.listen(config.port,config.host,()=>console.log(JSON.stringify({event:'started',port:config.port,storageConfigured:config.storageConfigured,collectionEnabled:config.collectionEnabled})));
async function processDocuments(){try{const r=await service.processDocuments();if(r.failed)console.error(JSON.stringify({event:'document_jobs_failed',count:r.failed}));}catch{console.error('{"event":"document_worker_failed"}');}}
const timer=setInterval(processDocuments,15000);timer.unref();
void processDocuments();
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{clearInterval(timer);server.close(()=>{store.close();process.exit(0);});setTimeout(()=>process.exit(0),15000).unref();});
