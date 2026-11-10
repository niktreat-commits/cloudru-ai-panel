const $=(id)=>document.getElementById(id);
const esc=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const number=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2});
const rubles=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0});
const icons={
  gov:'M2 8h20L12 3 2 8Zm2 3v7m5-7v7m6-7v7m5-7v7M2 21h20',
  shop:'M3 10 5 3h14l2 7M4 10v11h16V10M3 10q2 4 5 0 4 4 8 0 3 4 5 0M9 21v-6h6v6',
  build:'M3 21V8h7v13m0 0V3h11v18M1 21h22M13 7h4m-4 4h4m-4 4h4M5 12h2m-2 4h2',
  car:'M3 16v-5l3-5h12l3 5v5H3Zm0-4h18M5 16v3m14-3v3M6 14h2m8 0h2',
  factory:'M3 21V9l6 4V8l6 4V3h4l2 18H3Zm4-4h2m3 0h2m3 0h2',
  grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  it:'M3 4h18v13H3zM8 21h8m-4-4v4M6 8h3l2 4 3-5 2 2h2',
  code:'m8 6-6 6 6 6m8-12 6 6-6 6M14 4l-4 16',
  product:'m12 3 9 5v8l-9 5-9-5V8l9-5Zm0 18v-8m9-5-9 5-9-5',
  business:'M3 7h18v13H3zM8 7V4h8v3M3 12h18m-9-1v3',
  legal:'M12 3v18m-6 0h12M3 7h18M6 7l-4 8h8L6 7Zm12 0-4 8h8l-4-8Z',
  finance:'M4 20V5h16v15H4Zm4-4v-4m4 4V8m4 8v-6',
  book:'M3 4h6l3 2 3-2h6v15h-6l-3 2-3-2H3V4Zm9 2v15',
  doc:'M5 3h9l5 5v13H5V3Zm9 0v6h5M8 13h8m-8 4h8',
  chat:'M3 4h18v13H9l-6 4V4Zm5 6h8m-8 3h5',
  spark:'m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z',
  model:'M6 6h12v12H6zM9 9h6v6H9zM9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4',
  agent:'M4 8h16v12H4zM12 8V3m-3 0h6M8 13h1m6 0h1M9 17h6',
  chart:'M3 4v16h18M6 15l5-5 4 2 5-6',
  vision:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 1 0 0-6Z',
  lab:'M9 3h6m-5 0v6l-6 10q-1 2 2 2h12q3 0 2-2l-6-10V3M8 14h8',
  home:'M3 11l9-8 9 8v10h-7v-6h-4v6H3V11Z',
  back:'m10 6-6 6 6 6m-6-6h16'
};
function icon(name){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(icons[name]||icons.spark)+'"/></svg>';}
function pattern(){
  const paths=Array.from({length:18},(_,i)=>{
    const y=160+i*34, x=245+i*27;
    return 'M-150 '+y+' H'+x+' l240 240 h560 m-20-16 18 16-18 16';
  }).join(' ');
  return '<svg class="hero-pattern" viewBox="0 0 1000 1100" preserveAspectRatio="none" aria-hidden="true"><path d="'+paths+'" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
}
function head(label,title,subtitle=''){
  return '<div class="screen-header"><p class="eyebrow">'+esc(label)+'</p><h1 class="heading" tabindex="-1">'+esc(title)+'</h1>'+(subtitle?'<p class="subtitle">'+esc(subtitle)+'</p>':'')+'</div>';
}
function button(action, label, cls='action', extra=''){
  return '<button type="button" class="'+cls+'" data-action="'+action+'" '+extra+'><span>'+esc(label)+'</span><span aria-hidden="true">↗</span></button>';
}
const budgetTitles={benchmark:'Сначала замер скорости',training:'Нужен замер обучения',blocked:'Уточним конфигурацию',placement:'Уточним размещение',custom:'Подберём решение вместе'};
export function prepareTypography(){
  if(!document.fonts?.load)return Promise.resolve();
  const sample='Облачные ИИ-сервисы 0123456789 ₽';
  return Promise.allSettled(
    ['SB Sans Display','SB Sans Text'].flatMap(family=>
      [400,600].map(weight=>document.fonts.load(weight+' 16px "'+family+'"',sample))
    )
  );
}
export function showLoadError(retry){
  $('screen').setAttribute('aria-busy','false');
  $('screen').innerHTML='<div class="initial-state"><h1>Каталог недоступен</h1><p>Проверьте подключение и повторите загрузку.</p>'+button('retry-catalog','Повторить','action primary')+'</div>';
  $('screen').querySelector('button').addEventListener('click',retry,{once:true});
}

export function startPanel({catalog,estimate}){
  const screen=$('screen'), progress=$('progress'), nav=$('navigation'), dialog=$('dialog'), idle=$('idle');
  let state={step:0,industry:null,role:null,task:null,all:false,selection:null,result:null,pending:false,error:''};
  let request=null, sequence=0, calcTimer=null, last=Date.now(), focusTarget=null;
  let dialogMode=null;
  const context=()=>catalog.routes[state.industry+':'+state.role];
  const taskInfo=(id)=>({...catalog.tasks[id],...context()?.taskOverrides[id]});
  const current=()=>state.task?taskInfo(state.task):null;
  const labels=['Отрасль','Роль','Задача','Решение'];

  function touch(){last=Date.now();idle.hidden=true;}
  function cancelEstimate(){
    clearTimeout(calcTimer);calcTimer=null;
    request?.abort();request=null;sequence++;
  }
  function closeDialog(restoreFocus=true){
    if(dialog.open)dialog.close();
    dialogMode=null;
    $('panel').append(idle);
    if(restoreFocus)focusTarget?.focus({preventScroll:true});
    focusTarget=null;
  }
  function reset(){
    cancelEstimate();closeDialog(false);
    state={step:0,industry:null,role:null,task:null,all:false,selection:null,result:null,pending:false,error:''};
    touch();render();
  }
  function navigate(step){
    cancelEstimate();closeDialog(false);
    state.step=step;state.pending=false;state.error='';
    touch();render();
    if(step===4)schedule(0);
  }
  function card(action,item,selected=false,wide=false){
    return '<button type="button" class="choice'+(selected?' is-selected':'')+(wide?' choice-wide':'')+'" data-action="'+action+'" data-id="'+esc(item.id)+'"><span class="choice-icon">'+icon(item.icon)+'</span><span><span class="choice-name">'+esc(item.name)+'</span><span class="choice-detail">'+esc(item.description)+'</span></span></button>';
  }
  function hero(){
    return '<section class="hero">'+pattern()+'<p class="hero-kicker">Подбор ИИ-решения</p><div class="hero-panel"><h1 tabindex="-1"><span>Cloud.ru</span><span>Для вашей команды</span></h1></div><button class="hero-cta" type="button" data-action="start"><span>Подобрать решение</span><span class="hero-arrow" aria-hidden="true">↗</span></button><div class="hero-details"><span>Сценарий</span><span>Сервисы</span><span>Оценка бюджета</span></div></section>';
  }
  function placement(){
    return '<label class="field placement"><span class="field-label">Где будет работать решение</span><select class="field-control field-select" data-placement>'+catalog.placements.map(p=>'<option value="'+esc(p.id)+'"'+(state.selection.placement===p.id?' selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></label>';
  }
  function field(def,value,source='value',withNudge=false){
    const attr=' data-'+source+'="'+esc(def.id)+'"';
    const cls='field-control';
    const nullable=def.nullable||def.value===null;
    if(def.type==='boolean')return '<label class="check-field"><input type="checkbox"'+attr+(value?' checked':'')+'> <span>'+esc(def.label)+'</span></label>';
    const label='<span class="field-label">'+esc(def.label)+'</span>';
    const hint=def.note?'<small class="field-hint">'+esc(def.note)+'</small>':'';
    if(def.type==='select'){
      return '<label class="field">'+label+'<select class="'+cls+' field-select"'+attr+'>'+def.options.map(([v,n])=>'<option value="'+esc(v)+'"'+(v===value?' selected':'')+'>'+esc(n)+'</option>').join('')+'</select>'+hint+'</label>';
    }
    const step=def.decimal||def.id==='benchmarkMs'?'any':'1';
    const input='<input type="number" class="'+cls+'" aria-label="'+esc(def.label)+'" inputmode="'+(step==='1'?'numeric':'decimal')+'" min="'+def.min+'" max="'+def.max+'" step="'+step+'"'+(nullable?' data-nullable':' required')+attr+' value="'+esc(value)+'"'+(nullable?' placeholder="Нужен замер"':'')+'>';
    if(!withNudge)return '<label class="field">'+label+input+hint+'</label>';
    return '<div class="field">'+label+'<div class="number-field">'+input+
      '<button type="button" class="nudge" data-action="nudge" data-delta="-1" aria-label="Уменьшить: '+esc(def.label)+'">−</button>'+
      '<button type="button" class="nudge" data-action="nudge" data-delta="1" aria-label="Увеличить: '+esc(def.label)+'">+</button>'+
      '</div>'+hint+'</div>';
  }
  function resultScreen(){
    const t=current();
    const fields=t.fields.map((f,i)=>field(f,state.selection.values[f.id],'value',i===0));
    const fieldBlock=fields.length<4?fields.join(''):fields.slice(0,2).join('')+'<div class="subgrid">'+fields.slice(2).join('')+'</div>';
    return '<section class="result">'+head('04 / Решение',t.name,t.outcome)+
      '<div class="fields">'+fieldBlock+'</div>'+
      '<div id="result-status" class="result-status" role="status"></div>'+
      '<div id="stats" class="stat-row" hidden></div>'+
      '<div id="budget" class="budget" aria-live="polite"></div>'+
      placement()+
      '<div id="services" class="service-box" hidden></div>'+
      '<div class="actions">'+button('details','Модель, способ запуска и допущения','action','id="details-button"')+
      button('contact','Получить подборку после конференции','action primary','id="contact-button"')+'</div>'+
      '<p class="disclaimer" id="disclaimer"></p></section>';
  }
  function render(){
    const step=state.step;
    screen.setAttribute('aria-busy','false');
    progress.hidden=nav.hidden=step===0;
    progress.innerHTML=labels.map((label,i)=>'<div class="segment'+(i<step?' is-on':'')+'" aria-label="'+label+'"'+(i===step-1?' aria-current="step"':'')+'><span>0'+(i+1)+'</span></div>').join('');
    nav.innerHTML='<button class="nav-button" type="button" data-action="home">'+icon('home')+'На главную</button><button class="nav-button" type="button" data-action="back">'+icon('back')+'Назад</button>';
    if(step===0)screen.innerHTML=hero();
    if(step===1)screen.innerHTML=head('01 / Отрасль','С какой задачи начнётся ваш ИИ?','Выберите вашу отрасль')+'<div class="choices">'+catalog.industries.map(i=>card('industry',i,i.id===state.industry)).join('')+'</div>';
    if(step===2){
      const roles=catalog.roles.map(r=>r.id==='business'&&state.industry==='gov'?{...r,name:'Руководитель подразделения'}:r);
      screen.innerHTML=head('02 / Роль','Какая у вас роль?')+'<div class="choices">'+roles.map(r=>card('role',r,r.id===state.role,r.id==='other')).join('')+'</div>';
    }
    if(step===3){
      const ids=state.all?catalog.taskIds.filter(id=>id!=='custom'):context().recommendedTaskIds;
      const items=ids.map(id=>card('task',taskInfo(id),state.task===id)).join('');
      screen.innerHTML=head('03 / Задача',state.all?'Все задачи':'Что хотите ускорить?')+
        '<div class="choices'+(state.all?' choice-list':'')+'">'+items+
        (state.all?'':card('all',{id:'all',name:'Все задачи',description:'Открыть полный список',icon:'grid'}))+
        card('task',taskInfo('custom'),state.task==='custom')+'</div>';
    }
    if(step===4){screen.innerHTML=resultScreen();paintEstimate();}
    window.scrollTo(0,0);
    screen.querySelector('h1')?.focus({preventScroll:true});
  }
  function paintEstimate(){
    if(state.step!==4)return;
    const r=state.result, p=r?.pricing||catalog.pricing;
    const status=$('result-status');
    status.textContent=state.error||(state.pending?(r?'Обновляем расчёт…':'Считаем бюджет…'):'');
    status.classList.toggle('is-error',Boolean(state.error));
    const stats=$('stats');stats.hidden=!r?.workload.stats.length;
    stats.innerHTML=r?.workload.stats.slice(0,2).map(s=>'<div class="stat"><strong>'+number.format(s.value)+'</strong><span>'+esc(s.label)+'</span></div>').join('')||'';
    const b=r?.budget;
    $('budget').innerHTML='<p class="budget-label">Предварительный бюджет</p>'+
      (b?.amountRub!=null?'<p class="budget-value"><span class="budget-amount">≈ '+rubles.format(b.amountRub)+' ₽</span><span class="budget-period">'+esc(b.period)+'</span></p><p class="budget-note">'+esc(b.scope)+(r.model?' · '+esc(r.model.name):'')+'</p>':
      '<p class="budget-value is-message">'+esc(b?budgetTitles[b.status]||'Уточним задачу':state.error?'Расчёт недоступен':'Готовим оценку')+'</p>'+(b?'<p class="budget-note">'+esc(b.note)+'</p>':''));
    const services=$('services');services.hidden=!r;
    services.innerHTML=r?'<h2>Сервисы для запуска</h2>'+(r.services.length?r.services.map(s=>'<div class="service-row"><strong>'+esc(s.name)+'</strong><span>'+esc(s.description)+'</span></div>').join(''):'<p>'+esc(r.nextStep)+'</p>'):'';
    $('contact-button').disabled=state.pending||Boolean(state.error)||!r;
    $('disclaimer').textContent='Оценка части решения. Снимок тарифов: '+p.snapshotDate+(p.vatIncluded?' · НДС включён.':'.');
    if(dialog.open&&dialogMode==='details')paintOptions();
  }
  function schedule(delay=280){
    cancelEstimate();
    if(state.step!==4)return;
    const invalid=screen.querySelector('input:invalid')||(dialog.open?dialog.querySelector('input:invalid'):null);
    if(invalid&&(screen.contains(invalid)||dialog.open)){
      state.pending=false;state.error='Проверьте поле «'+(invalid.getAttribute('aria-label')||'параметр')+'».';
      paintEstimate();return;
    }
    state.pending=true;state.error='';paintEstimate();
    const id=sequence, selection=structuredClone(state.selection);
    calcTimer=setTimeout(async()=>{
      const controller=new AbortController();
      request=controller;
      try{
        const result=await estimate(selection,controller.signal);
        if(id===sequence&&state.step===4){state.result=result;state.pending=false;paintEstimate();}
      }catch{
        if(id===sequence&&state.step===4){
          state.pending=false;state.error='Не удалось обновить расчёт. Проверьте связь и повторите.';paintEstimate();
          const retry=document.createElement('button');
          retry.type='button';retry.className='nav-button';retry.dataset.action='retry-estimate';retry.textContent='Повторить расчёт';
          $('result-status').append(' ',retry);
        }
      }finally{if(request===controller)request=null;}
    },delay);
  }
  function setDialog(mode, title, content){
    if(!dialog.open)focusTarget=document.activeElement;
    dialogMode=mode;
    dialog.innerHTML='<button type="button" class="dialog-close" data-action="close" aria-label="Закрыть">×</button><h2 id="dialog-title">'+esc(title)+'</h2>'+content;
    if(!dialog.open)dialog.showModal();
    dialog.querySelector('.dialog-close').focus();
    dialog.scrollTop=0;
  }
  function details(){
    const t=current();
    const defs=t.settingIds.filter(id=>id!=='launch').map(id=>id==='modelId'?{id,type:'select',label:'Модель',options:catalog.models.map(m=>[m.id,m.name])}:{id,...catalog.settingFields[id]});
    const fields=defs.map(d=>field(d,state.selection.settings[d.id],'setting')).join('');
    setDialog('details','Модель и способ запуска',(fields?'<div class="fields">'+fields+'</div>':'<p>Для этой задачи подберём параметры после обсуждения.</p>')+
      '<div id="launch-options"></div>'+button('method','Как посчитали'));
    paintOptions();
  }
  function paintOptions(){
    const node=$('launch-options');
    if(!node)return;
    const options=state.result?.options||[];
    node.innerHTML=options.length?'<h3>Способ запуска</h3>'+options.map(o=>'<button type="button" class="launch-option" data-action="launch" data-id="'+esc(o.id)+'" aria-pressed="'+(o.id===state.selection.settings.launch)+'"'+(!o.available||state.pending?' disabled':'')+'><span>'+esc(o.title)+'<small>'+esc(o.available?o.description:o.reason)+'</small></span><strong>'+esc(o.amountRub==null?'Уточнить':rubles.format(o.amountRub)+' ₽')+'</strong></button>').join(''):'';
  }
  function methodology(){
    const r=state.result;
    if(!r){setDialog('method','Как посчитали','<p>Расчёт ещё не готов.</p>');return;}
    const w=r.workload;
    setDialog('method','Как посчитали',
      (w.formula?'<p>'+esc(w.formula)+'</p>':'')+
      (w.inputTokens||w.outputTokens?'<p>'+number.format(w.inputTokens)+' входных и '+number.format(w.outputTokens)+' выходных токенов за расчётный период.</p>':'')+
      (w.assumptions.length?'<h3>Допущения</h3><ul>'+w.assumptions.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul>':'')+
      '<p>'+esc(r.budget.note)+'</p><h3>Отдельно от оценки</h3><ul>'+r.excluded.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul>'+
      '<p>Снимок тарифов: '+esc(r.pricing.snapshotDate)+'. Методика: '+esc(r.methodVersion)+'.</p>'+button('details','К параметрам расчёта'));
  }
  function updateInput(el,delay){
    if(state.step!==4||!el.matches('input,select'))return;
    touch();
    if(el.hasAttribute('data-placement'))state.selection.placement=el.value;
    else{
      const target=el.hasAttribute('data-setting')?'settings':'values';
      const key=el.dataset.setting||el.dataset.value;
      if(!key)return;
      const def=target==='values'?current().fields.find(f=>f.id===key):catalog.settingFields[key];
      if(el.type==='number'&&!el.validity.valid){schedule(delay);return;}
      let value=el.value;
      if(el.type==='checkbox')value=el.checked;
      if(el.type==='number')value=el.value===''?null:el.valueAsNumber;
      if(el.tagName==='SELECT'&&def?.options)value=def.options.find(([id])=>String(id)===el.value)?.[0];
      state.selection[target][key]=value;
    }
    schedule(delay);
  }
  function contact(){
    if(state.pending||state.error||!state.result)return;
    const event=new CustomEvent('cloudru:contact-request',{cancelable:true,detail:{
      selection:structuredClone(state.result.selection),estimate:structuredClone(state.result)
    }});
    if(window.dispatchEvent(event))setDialog('contact','Регистрация пока не подключена','<p>Это демо подбора. В рабочей версии здесь откроется форма подрядчиков.</p>'+button('close','Вернуться к расчёту','action primary'));
  }
  $('panel').addEventListener('click',e=>{
    const el=e.target.closest('button[data-action]');
    if(!el||el.disabled)return;
    const id=el.dataset.id;
    touch();
    switch(el.dataset.action){
      case 'start':navigate(1);break;
      case 'home':reset();break;
      case 'industry':
        if(state.industry!==id){state.role=null;state.task=null;state.all=false;}
        state.industry=id;navigate(2);break;
      case 'role':
        if(state.role!==id){state.task=null;state.all=false;}
        state.role=id;navigate(3);break;
      case 'all':state.all=true;render();break;
      case 'task':{
        const task=taskInfo(id), defaults=structuredClone(task.defaults);
        state.task=id;state.result=null;
        state.selection={industry:state.industry,role:state.role,task:id,placement:'cloud',...defaults};
        navigate(4);break;
      }
      case 'back':
        if(state.step===3&&state.all){state.all=false;render();}
        else if(state.step===1)reset();
        else navigate(state.step-1);
        break;
      case 'details':details();break;
      case 'method':methodology();break;
      case 'close':closeDialog();break;
      case 'launch':state.selection.settings.launch=id;schedule(0);break;
      case 'contact':contact();break;
      case 'retry-estimate':schedule(0);break;
      case 'nudge':{
        const input=el.parentElement.querySelector('input');
        const n=input.valueAsNumber||Number(input.min)||0;
        const step=Math.max(1,Math.round(n*.1));
        input.value=Math.max(Number(input.min),Math.min(Number(input.max),n+Number(el.dataset.delta)*step));
        updateInput(input,220);break;
      }
    }
  });
  $('panel').addEventListener('input',e=>{if(e.target.matches('input[type=number]'))updateInput(e.target,280);});
  $('panel').addEventListener('change',e=>{if(e.target.matches('select,input[type=checkbox]'))updateInput(e.target,0);});
  dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
  for(const event of ['pointerdown','keydown','wheel','touchstart'])document.addEventListener(event,touch,{passive:true});
  window.addEventListener('cloudru:reset',reset);
  setInterval(()=>{
    if(!state.step)return;
    const elapsed=(Date.now()-last)/1000;
    if(elapsed>=catalog.kiosk.idleSeconds){reset();return;}
    if(elapsed>=catalog.kiosk.warningSeconds){
      const parent=dialog.open?dialog:$('panel');if(idle.parentElement!==parent)parent.append(idle);
      idle.textContent='Возврат на главный экран через '+Math.ceil(catalog.kiosk.idleSeconds-elapsed)+' с';
      idle.hidden=false;
    }
  },250);
  render();
}
