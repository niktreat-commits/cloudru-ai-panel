import {writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {runtime} from './runtime.mjs';
const {store}=runtime(),latest=new Map(),path=process.argv[2]||'sessions.json';
try{for await(const key of store.list('sessions/')){if(!key.endsWith('.json'))continue;const record=await store.json(key);if(!record)continue;const previous=latest.get(record.id);if(!previous||record.revision>previous.revision)latest.set(record.id,record);}await mkdir(dirname(path),{recursive:true,mode:0o700});await writeFile(path,JSON.stringify([...latest.values()],null,2),{mode:0o600});console.log(`Exported ${latest.size} sessions to ${path}.`);}finally{store.close();}
