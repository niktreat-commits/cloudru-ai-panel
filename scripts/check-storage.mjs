import {randomUUID} from 'node:crypto';
import {runtime} from './runtime.mjs';
const {store}=runtime(),key=`checks/${randomUUID()}.json`,value={check:true,createdAt:new Date().toISOString()};
try{await store.head();await store.put(key,value);const read=await store.json(key);if(read?.createdAt!==value.createdAt)throw Error('Readback did not match.');let listed=false;for await(const candidate of store.list('checks/'))if(candidate===key)listed=true;if(!listed)throw Error('ListObjectsV2 did not return the test object.');await store.remove(key);console.log('OK: private Object Storage HeadBucket / PutObject / GetObject / ListObjectsV2 / DeleteObject. No contact data used.');}
catch(e){console.error('Storage check failed: '+(e.name||'Error')+'. Check endpoint, tenant:key format, secret and bucket-scoped permissions.');process.exitCode=1;}
finally{store.close();}
