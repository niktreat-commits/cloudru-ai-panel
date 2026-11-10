import http from 'node:http';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {API_VERSION, InputError, makeCatalog, calculateEstimate} from '../core/panel.mjs';

const read=(path)=>readFileSync(new URL(path,import.meta.url));
const pricing=JSON.parse(read('../core/pricing.json'));
const catalog=JSON.stringify(makeCatalog(pricing));
const MAX_BODY=8192;
const assets={
  '/':['index.html','text/html; charset=utf-8'],
  '/styles.css':['styles.css','text/css; charset=utf-8'],
  '/fonts.css':['fonts.css','text/css; charset=utf-8'],
  '/app.mjs':['app.mjs','text/javascript; charset=utf-8'],
  '/bootstrap.mjs':['bootstrap.mjs','text/javascript; charset=utf-8'],
  '/logo.png':['logo.png','image/png']
};
class RequestError extends Error{
  constructor(status,code,message){super(message);this.status=status;this.code=code;}
}

function allowedOrigins(value) {
  return new Set(value.split(',').map(s=>s.trim()).filter(Boolean).map(s=>{
    const u=new URL(s);
    if(!['http:','https:'].includes(u.protocol)||u.origin!==s)throw new Error('FRONTEND_ORIGINS: ожидаются origin без завершающего /.');
    return u.origin;
  }));
}
function ownOrigin(req, origin) {
  try{
    const u=new URL(origin);
    const hosts=[req.headers.host,req.headers['x-forwarded-host']?.split(',')[0]?.trim()];
    return ['http:','https:'].includes(u.protocol)&&u.origin===origin&&hosts.includes(u.host);
  }catch{return false;}
}
function writeJson(res, status, data, cache='no-store') {
  const bytes=typeof data==='string'?data:JSON.stringify(data);
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':cache});
  res.end(bytes);
}
async function requestBody(req) {
  if(req.headers['content-type']?.split(';')[0].trim().toLowerCase()!=='application/json')throw new RequestError(415,'JSON_REQUIRED','Укажите Content-Type: application/json.');
  if(Number(req.headers['content-length'])>MAX_BODY)throw new RequestError(413,'BODY_TOO_LARGE','Размер запроса превышает 8 КБ.');
  const chunks=[];let size=0;
  // Drain an oversized chunked request without retaining its content.
  for await(const chunk of req){
    size+=chunk.length;
    if(size<=MAX_BODY)chunks.push(chunk);
  }
  if(size>MAX_BODY)throw new RequestError(413,'BODY_TOO_LARGE','Размер запроса превышает 8 КБ.');
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
  catch{throw new RequestError(400,'INVALID_JSON','Неверный формат JSON.');}
}

export function createApp({origins=process.env.FRONTEND_ORIGINS||'',serveDemo=process.env.SERVE_DEMO!=='false'}={}) {
  const allow=allowedOrigins(origins);
  const staticFiles=new Map();
  if(serveDemo)for(const [path,[file,mime]] of Object.entries(assets))staticFiles.set(path,{bytes:read('../public/'+file),mime});
  const openapi=read('../openapi.json');
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'");
    try{
      const path=new URL(req.url,'http://local').pathname;
      const method=req.method;
      if(path==='/api/catalog'||path==='/api/estimate'){
        const origin=req.headers.origin;
        res.setHeader('Vary','Origin');
        if(origin){
          if(!allow.has(origin)&&!ownOrigin(req,origin))throw new RequestError(403,'ORIGIN_DENIED','Этот адрес фронта не добавлен в разрешённые.');
          res.setHeader('Access-Control-Allow-Origin',origin);
        }
        const expected=path==='/api/catalog'?'GET':'POST';
        if(method==='OPTIONS'){
          res.writeHead(204,{'Access-Control-Allow-Methods':expected+', OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'});
          res.end();return;
        }
        if(method!==expected){
          res.setHeader('Allow',expected+', OPTIONS');
          throw new RequestError(405,'METHOD_NOT_ALLOWED','Метод не поддерживается.');
        }
        if(path==='/api/catalog')writeJson(res,200,catalog,'public, max-age=300');
        else writeJson(res,200,calculateEstimate(await requestBody(req),pricing));
        return;
      }
      if(path==='/healthz'&&method==='GET'){writeJson(res,200,{ok:true,apiVersion:API_VERSION});return;}
      if(path==='/openapi.json'&&method==='GET'){
        res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-cache'});
        res.end(openapi);return;
      }
      const asset=staticFiles.get(path);
      if(asset&&['GET','HEAD'].includes(method)){
        res.writeHead(200,{'Content-Type':asset.mime,'Content-Length':asset.bytes.length,'Cache-Control':'no-cache'});
        res.end(method==='HEAD'?undefined:asset.bytes);return;
      }
      writeJson(res,404,{error:'NOT_FOUND',message:'Маршрут не найден.'});
    }catch(error){
      if(error instanceof InputError)writeJson(res,400,{error:'INVALID_INPUT',field:error.field,message:error.message});
      else if(error instanceof RequestError)writeJson(res,error.status,{error:error.code,message:error.message});
      else writeJson(res,500,{error:'CALCULATION_FAILED',message:'Не удалось выполнить расчёт. Попробуйте ещё раз.'});
    }
  });
  server.requestTimeout=10000;
  server.headersTimeout=8000;
  return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||8080);
  const host=process.env.HOST||'0.0.0.0';
  createApp().listen(port,host,()=>console.log('Cloud.ru panel API started on port '+port));
}
