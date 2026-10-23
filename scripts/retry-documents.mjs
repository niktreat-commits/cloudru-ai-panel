import {runtime} from './runtime.mjs';
const {store,service}=runtime();try{const result=await service.processDocuments(1000);console.log(JSON.stringify(result));if(result.failed)process.exitCode=1;}finally{store.close();}
