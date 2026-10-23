import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {HttpError} from './validation.mjs';
import {publicConfig} from './config.mjs';
const ROOT=fileURLToPath(new URL('../dist/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff':'font/woff','.woff2':'font/woff2'};
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req){
 if(!String(req.headers['content-type']||'').startsWith('application/json'))throw new HttpError(415,'JSON_REQUIRED','Ожидается JSON.');
 let size=0,chunks=[];for await(const c of req){size+=c.length;if(size>24000)throw new HttpError(413,'BODY_TOO_LARGE','Запрос слишком большой.');chunks.push(c);}let parsed;try{parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new HttpError(400,'INVALID_JSON','Неверный формат запроса.');}if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new HttpError(400,'INVALID_BODY','Ожидается JSON-объект.');return parsed;
}
export function createPanelServer({service,config,staticRoot=ROOT}){
 const limits=new Map();
 function rate(req){const now=Date.now(),ipHash=createHash('sha256').update(config.sessionSecret+req.socket.remoteAddress).digest('hex'),entry=limits.get(ipHash);if(!entry||now-entry.at>60000)limits.set(ipHash,{at:now,count:1});else if(++entry.count>160)throw new HttpError(429,'TOO_MANY_REQUESTS','Слишком много запросов. Подождите несколько секунд.');if(limits.size>5000)for(const[k,v]of limits)if(now-v.at>60000)limits.delete(k);}
 return http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  try{
   const url=new URL(req.url,'http://local'),path=url.pathname;
   if(path==='/healthz'){json(res,200,{ok:true});return;}
   if(path==='/readyz'){try{service.requireStorage();await service.store.head();json(res,200,{ok:true,collectionEnabled:config.collectionEnabled});}catch{json(res,503,{ok:false});}return;}
   if(path==='/api/public-config'&&req.method==='GET'){json(res,200,publicConfig(config));return;}
   if(path.startsWith('/api/')){
    if(req.method!=='POST')throw new HttpError(405,'METHOD_NOT_ALLOWED','Метод не поддерживается.');
    const expected=config.origin||`http://${req.headers.host}`;
    if(req.headers.origin!==expected)throw new HttpError(403,'ORIGIN_DENIED','Источник запроса не разрешён.');
    rate(req);const payload=await body(req);const token=String(req.headers.authorization||'').replace(/^Bearer /,'');
    if(path==='/api/sessions'){if(Object.keys(payload).length)throw new HttpError(400,'INVALID_BODY','Лишние поля.');json(res,201,await service.createSession());return;}
    const session=path.match(/^\/api\/sessions\/([0-9a-f-]+)$/i);
    if(session){json(res,200,await service.saveSession(session[1],token,payload));return;}
    if(path==='/api/leads'){json(res,201,await service.saveLead(token,payload));return;}
    throw new HttpError(404,'NOT_FOUND','Маршрут не найден.');
   }
   if(!['GET','HEAD'].includes(req.method))throw new HttpError(405,'METHOD_NOT_ALLOWED','Метод не поддерживается.');
   const decoded=decodeURIComponent(path),file=resolve(staticRoot,'.'+(decoded==='/'?'/index.html':decoded));
   if(!file.startsWith(resolve(staticRoot)+sep))throw new HttpError(404,'NOT_FOUND','Файл не найден.');
   const type=mime[extname(file)];if(!type)throw new HttpError(404,'NOT_FOUND','Файл не найден.');
   let bytes;try{bytes=await readFile(file);}catch{throw new HttpError(404,'NOT_FOUND','Файл не найден.');}
   res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-cache','Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);
  }catch(e){const status=e instanceof HttpError?e.status:503;json(res,status,{error:e instanceof HttpError?e.code:'SAVE_UNAVAILABLE',message:e instanceof HttpError?e.message:'Не удалось сохранить данные. Попробуйте ещё раз или обратитесь к сотруднику стенда.'});if(!(e instanceof HttpError))console.error(JSON.stringify({event:'request_failed',code:e.name||'Error'}));}
 });
}
