import {startPanel, showLoadError, prepareTypography} from './app.mjs';

async function request(path,options){
  const response=await fetch(path,{...options,credentials:'omit'});
  const body=await response.json();
  if(!response.ok)throw new Error(body.message||'Сервер временно недоступен.');
  return body;
}
async function load(){
  try{
    const [catalog]=await Promise.all([
      request('./api/catalog',{signal:AbortSignal.timeout(8000)}),
      prepareTypography()
    ]);
    startPanel({catalog,estimate:(input,signal)=>request('./api/estimate',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),
      signal:AbortSignal.any([signal,AbortSignal.timeout(8000)])
    })});
  }catch{showLoadError(load);}
}
void load();
