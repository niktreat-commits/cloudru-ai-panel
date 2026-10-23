import {readFileSync} from 'node:fs';
import {randomBytes,createHash} from 'node:crypto';

export function loadConfig(env=process.env){
 const legal=JSON.parse(readFileSync(new URL('../config/legal.json',import.meta.url),'utf8'));
 const sessionSecret=env.SESSION_SECRET||randomBytes(48).toString('hex');
 const accessKeyId=env.AWS_ACCESS_KEY_ID||((env.S3_TENANT_ID&&env.S3_KEY_ID)?`${env.S3_TENANT_ID}:${env.S3_KEY_ID}`:'');
 const storageConfigured=Boolean(accessKeyId&&env.AWS_SECRET_ACCESS_KEY);
 const collectionEnabled=storageConfigured&&env.LEGAL_APPROVED==='true'&&Boolean(env.SESSION_SECRET?.length>=32)&&Boolean(env.PUBLIC_ORIGIN);
 return {port:Number(env.PORT||8080),host:env.HOST||'0.0.0.0',origin:env.PUBLIC_ORIGIN||'',eventId:env.EVENT_ID||'aij-2026',kioskId:env.KIOSK_ID||'stand-1',bucket:env.S3_BUCKET||'cloudru-aij-leads',endpoint:env.S3_ENDPOINT||'https://s3.cloud.ru',region:env.AWS_REGION||'ru-central-1',accessKeyId,secretAccessKey:env.AWS_SECRET_ACCESS_KEY||'',sessionSecret,storageConfigured,collectionEnabled,legal,legalHash:createHash('sha256').update(legal.text).digest('hex'),leadRetentionDays:legal.retentionDays,sessionsRetentionDays:30};
}
export function publicConfig(config){
 return {collectionEnabled:config.collectionEnabled,sessionsEnabled:config.storageConfigured,idleSeconds:45,warningSeconds:35,thanksSeconds:5,eventId:config.eventId,legal:{version:config.legal.version,hash:config.legalHash,title:config.legal.title,text:config.legal.text,policyUrl:config.legal.policyUrl,checkboxText:config.legal.checkboxText}};
}
