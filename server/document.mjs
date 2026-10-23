import {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,HeadingLevel,BorderStyle,PageNumber,Footer,AlignmentType} from 'docx';
const p=(text,options={})=>new Paragraph({children:[new TextRun(String(text??''))],spacing:{after:100},...options});
const heading=text=>p(text,{heading:HeadingLevel.HEADING_1,keepNext:true});
const rub=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(v)+' ₽';
function table(rows){
 const borders=Object.fromEntries(['top','bottom','left','right','insideHorizontal','insideVertical'].map(k=>[k,{style:BorderStyle.SINGLE,size:4,color:'D9D9D9'}]));
 return new Table({width:{size:100,type:WidthType.PERCENTAGE},columnWidths:[2900,6300],borders,rows:rows.map(([label,value])=>new TableRow({cantSplit:true,children:[label,value].map((v,i)=>new TableCell({width:{size:i?6300:2900,type:WidthType.DXA},margins:{top:90,bottom:90,left:120,right:120},shading:i?undefined:{fill:'F2F2F2'},children:[p(v,{spacing:{after:0}})]}))}))});
}
export async function createLeadDocument(lead){
 const s=lead.specification,e=s.estimate,contact=lead.contact;
 const content=[p('Карточка посетителя Cloud.ru',{heading:HeadingLevel.TITLE}),p(`Стенд ${lead.eventId}. Подборка для последующей связи с посетителем по выбранной задаче.`),
 table([['Дата заявки',new Date(lead.submittedAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})+' МСК'],['Имя и фамилия',contact.name],['Компания',contact.company],['Должность',contact.position],['Почта',contact.email],['Телефон',contact.phone]]),
 heading('Задача и интересы'),table([['Отрасль',s.industry],['Выбранная роль',s.role],['Задача',s.task],['Размещение',s.placement],['Ожидаемый результат',s.outcome],['Просмотренные задачи',(lead.viewedTaskNames||[]).join('; ')||s.task]]),
 heading('Рекомендованные сервисы'),...s.services.map(x=>p(`${x.name}. ${x.description}`))];
 if(s.customTask)content.push(p(`Описание посетителя: ${s.customTask}`));
 if(s.parameters.length)content.push(heading('Параметры нагрузки'),table(s.parameters.map(x=>[x.label,x.display])));
 if(e){content.push(p('Предварительный расчёт',{heading:HeadingLevel.HEADING_1,pageBreakBefore:true,keepNext:true}),table([['Оценка',e.costRub==null?'Стоимость требует уточнения':rub(e.costRub)+' '+e.period],['Состав оценки',e.scope],['Модель',e.model||'Уточняется'],['Запуск',e.launch||'Уточняется'],['Формула',e.workload.formula||'Нужны дополнительные параметры'],['Период работы',`${s.selection.calc.days} дней в месяц по ${s.selection.calc.hours} часов`],['Тарифы',s.tariffDate+'; '+(s.tariffVatIncluded?'НДС включён':'условия НДС уточняются')]]));
  if(e.gpuCount)content.push(p(`${e.gpuCount} GPU. В расчёте ${e.billableHours} часов аренды (для выделенного сервера — полный месяц).`));
  content.push(p('Это оценка части решения по указанным допущениям. Не является коммерческим предложением или обещанием производительности.'));
  for(const a of e.workload.assumptions)content.push(p(a));
  if(e.note&&e.gpuCount)content.push(p(e.note));
  content.push(p('Отдельно оцениваются: '+e.exclusions.join(', ')+'.'));
 }
 content.push(heading('Следующий шаг'),p(s.next),heading('Основание обработки контактов'),p(`Согласие получено при отправке формы ${lead.submittedAt}. Версия ${lead.consent.version}. Цель — подготовка подборки и связь по выбранной задаче. Рекламная рассылка не запрошена.`),p(`SHA-256 текста согласия: ${lead.consent.hash}`,{children:[new TextRun({text:`SHA-256 текста согласия: ${lead.consent.hash}`,size:18})]}),p(`Заявка ${lead.id}. Методика ${s.methodVersion}.`,{children:[new TextRun({text:`Заявка ${lead.id}. Методика ${s.methodVersion}.`,size:18})]}));
 const document=new Document({creator:'Cloud.ru',title:'Карточка посетителя Cloud.ru',description:'Контакты и спецификация подбора на стенде',styles:{default:{document:{run:{font:'Arial',size:22,color:'000000'},paragraph:{spacing:{line:276,after:100}}}},paragraphStyles:[{id:'Title',name:'Title',basedOn:'Normal',next:'Normal',run:{font:'Arial',size:36,bold:true,color:'000000'},paragraph:{spacing:{after:180},keepNext:true}},{id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',run:{font:'Arial',size:28,bold:true,color:'000000'},paragraph:{spacing:{before:240,after:120},keepNext:true}}]},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1000,bottom:1000,left:1200,right:1200}}},footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({text:'Cloud.ru  ·  ',size:18}),new TextRun({children:[PageNumber.CURRENT],size:18})]})]})},children:content}]});
 return Packer.toBuffer(document);
}
