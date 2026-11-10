import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const codeFiles=['calculator.mjs','catalog.mjs','scenario-calculator.mjs','specification.mjs','panel.mjs'];
const sources=Object.fromEntries(codeFiles.map(n=>[n,read('core/'+n)]));
sources['app.mjs']=read('public/app.mjs');
const json=(v)=>JSON.stringify(v).replaceAll('<','\\u003c');

// This preview has no module fetches, API requests or external assets.
// Our source modules use only named imports and declarations.
function bundle(name,source){
  const exported=[];
  const body=source
    .replace(/^import \{([^}]+)\} from '\.\/([^']+)';$/gm,(_,members,dep)=>'const {'+members+'}=modules['+json(dep)+'];')
    .replace(/^export ((?:async )?(?:function|const|class) (\w+))/gm,(_,decl,id)=>{exported.push(id);return decl;});
  if(/^(?:import|export) /m.test(body))throw new Error('Unsupported module syntax in '+name);
  return 'modules['+json(name)+']=(()=>{\n'+body+'\nreturn {'+exported.join(',')+'};\n})();\n';
}
const run='(()=>{"use strict";const modules=Object.create(null);\n'+
  Object.entries(sources).map(([name,source])=>bundle(name,source)).join('')+
  'const {makeCatalog,calculateEstimate}=modules["panel.mjs"];\n'+
  'const pricing='+json(JSON.parse(read('core/pricing.json')))+';\n'+
  'modules["app.mjs"].prepareTypography().then(()=>modules["app.mjs"].startPanel({catalog:makeCatalog(pricing),estimate:async input=>calculateEstimate(input,pricing)}));\n})();';
if(/<\/script/i.test(run))throw new Error('Unexpected script end tag');
const logo=readFileSync(new URL('../public/logo.png',import.meta.url)).toString('base64');
const html=read('public/index.html')
  .replace('  <link rel="stylesheet" href="./fonts.css">\n  <link rel="stylesheet" href="./styles.css">','  <style>'+read('public/fonts.css')+'\n'+read('public/styles.css')+'</style>')
  .replace('./logo.png','data:image/png;base64,'+logo)
  .replace('<script type="module" src="./bootstrap.mjs"></script>','<script>'+run+'</script>');
const path=resolve(process.argv[2]||'Cloudru-panel-preview.html');
writeFileSync(path,html);
console.log(path);
