// Local QA only. npm start always uses the real Object Storage adapter.
import {PanelService} from '../server/service.mjs';
import {createPanelServer} from '../server/http.mjs';
import {MemoryStore,config as fixtureConfig,pricing} from '../tests/helpers.mjs';
const port=Number(process.env.PORT||4173);
const config={...fixtureConfig,origin:process.env.PUBLIC_ORIGIN||'http://terminal.local:4173'};
const service=new PanelService({config,pricing,store:new MemoryStore()});
const server=createPanelServer({service,config});server.listen(port,'0.0.0.0',()=>console.log('Local QA preview on '+port));
const worker=setInterval(()=>service.processDocuments().catch(()=>{}),1000);worker.unref();
process.on('SIGTERM',()=>{clearInterval(worker);server.close();});
