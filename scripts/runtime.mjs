import {readFileSync} from 'node:fs';
import {loadConfig} from '../server/config.mjs';
import {ObjectStore} from '../server/storage.mjs';
import {PanelService} from '../server/service.mjs';
export function runtime(){const config=loadConfig();if(!config.storageConfigured)throw Error('Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in the environment.');const store=new ObjectStore(config),pricing=JSON.parse(readFileSync(new URL('../dist/pricing.json',import.meta.url)));return {config,store,service:new PanelService({config,store,pricing})};}
