import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {runtime} from './runtime.mjs';
const {store}=runtime(),directory=resolve(process.argv[2]||'data/leads');let count=0;
try{await mkdir(directory,{recursive:true,mode:0o700});for await(const key of store.list('leads/')){if(!key.endsWith('/lead.json'))continue;const lead=await store.json(key);if(!lead||Date.parse(lead.expiresAt)<=Date.now())continue;const dir=resolve(directory,lead.id);await mkdir(dir,{recursive:true,mode:0o700});await writeFile(dir+'/lead.json',JSON.stringify(lead,null,2),{mode:0o600});const doc=await store.get(lead.documentKey);if(doc)await writeFile(dir+'/card.docx',doc,{mode:0o600});count++;}console.log(`Exported ${count} leads. Keep this directory outside GitHub.`);}finally{store.close();}
