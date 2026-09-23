import './style.css';
import './extra.css';
import {addCustomItem, addItem, clampItem, cutoutBounds, initialPlan, intersectsCutout, occupiedArea, overlappingPairs, presets, roomArea, roomOutlinePath, safePlan, snap, type Cutout, type Plan} from './model';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<header class="top"><div class="wordmark">ПЛАН <span>КОМНАТЫ</span></div><div class="top-actions"><button id="undo" title="Отменить (Ctrl+Z)">Отменить</button><button id="redo" title="Повторить (Ctrl+Y)">Повторить</button><button id="export-svg">SVG</button><button id="export-json">JSON</button><button id="import-json">Открыть JSON</button><input id="import-file" type="file" accept=".json,application/json" hidden></div></header><main class="layout"><aside class="left"><p class="overline">ПЛАНИРОВЩИК</p><h1>Расставьте мебель по-своему.</h1><p class="intro">Размеры указаны в сантиметрах. Перетащите предмет, чтобы изменить план.</p><section><h2>Комната</h2><div class="dimensions"><label>Ширина<input id="width" type="number" min="200" max="1200" step="10"></label><label>Длина<input id="height" type="number" min="200" max="1200" step="10"></label></div><p id="area" class="detail"></p></section><section><h2>Добавить</h2><div id="presets" class="presets"></div></section><p class="hint">Схема сохраняется в этом браузере. Стрелки перемещают выбранный предмет; Delete удаляет.</p></aside><section class="stage" aria-label="План комнаты"><div class="stage-head"><div><strong>Вид сверху</strong><span id="size-label"></span></div><span>Сетка 10 см</span></div><div class="canvas-wrap"><svg id="canvas" role="img" aria-label="Редактируемый план комнаты" xmlns="http://www.w3.org/2000/svg"></svg></div><div class="stage-foot"><span>Нажмите на предмет для настройки</span><button id="reset">Сбросить план</button></div></section><aside class="right"><p class="overline">ВЫБРАННЫЙ ПРЕДМЕТ</p><div id="inspector" class="inspector"></div></aside></main>`;

const canvas = document.querySelector<SVGSVGElement>('#canvas')!;
const inspector = document.querySelector<HTMLDivElement>('#inspector')!;
const widthInput = document.querySelector<HTMLInputElement>('#width')!;
const heightInput = document.querySelector<HTMLInputElement>('#height')!;
const addSection = document.querySelector('#presets')!.parentElement!;
const customForm = document.createElement('form');
customForm.className = 'custom-form';
customForm.innerHTML = '<h3>Свой предмет</h3><label>Название<input name="name" maxlength="60" required placeholder="Например, тумба"></label><div class="dimensions"><label>Ширина, см<input name="width" type="number" min="20" max="400" step="10" required value="80"></label><label>Глубина, см<input name="height" type="number" min="20" max="400" step="10" required value="50"></label></div><button type="submit">Добавить на план</button>';
addSection.append(customForm);
const planFacts = document.createElement('p');
planFacts.className = 'plan-facts';
document.querySelector('#area')!.after(planFacts);
const shapeControls = document.createElement('div');
shapeControls.className = 'shape-controls';
shapeControls.innerHTML = '<label>Форма комнаты<select id="room-shape"><option value="rectangle">Прямоугольная</option><option value="l-shape">Г-образная</option></select></label><div id="cutout-controls" hidden><label>Угол выреза<select id="cutout-corner"><option value="top-left">Слева сверху</option><option value="top-right">Справа сверху</option><option value="bottom-left">Слева снизу</option><option value="bottom-right">Справа снизу</option></select></label><div class="dimensions"><label>Вырез по ширине<input id="cutout-width" type="number" min="40" step="10"></label><label>Вырез по длине<input id="cutout-height" type="number" min="40" step="10"></label></div></div>';
document.querySelector('#area')!.before(shapeControls);
let plan: Plan = initialPlan;
try { const stored = localStorage.getItem('room-plan-v1'); if (stored) plan = safePlan(JSON.parse(stored)) ?? initialPlan; } catch { /* ignore bad local data */ }
let selected: string | null = null;
const past: Plan[] = [], future: Plan[] = [];
let drag: {id:string,startX:number,startY:number,origX:number,origY:number,moved:boolean} | null = null;
const clone = (p:Plan):Plan => JSON.parse(JSON.stringify(p));
function commit(next:Plan) { past.push(clone(plan)); if (past.length > 50) past.shift(); future.length = 0; plan = next; render(); }
function save() { localStorage.setItem('room-plan-v1',JSON.stringify(plan)); }
function svg(tag:string, attrs:Record<string,string|number> = {}) { const node=document.createElementNS('http://www.w3.org/2000/svg',tag); for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,String(value)); return node; }
function render() {
  save(); widthInput.value=String(plan.width); heightInput.value=String(plan.height);
  document.querySelector('#size-label')!.textContent=`${plan.width} × ${plan.height} см`;
  document.querySelector('#area')!.textContent=`Площадь: ${roomArea(plan).toLocaleString('ru-RU',{maximumFractionDigits:2})} м²`;
  document.querySelector<HTMLSelectElement>('#room-shape')!.value=plan.cutout?'l-shape':'rectangle';
  document.querySelector<HTMLDivElement>('#cutout-controls')!.hidden=!plan.cutout;
  if(plan.cutout){document.querySelector<HTMLSelectElement>('#cutout-corner')!.value=plan.cutout.corner;document.querySelector<HTMLInputElement>('#cutout-width')!.value=String(plan.cutout.w);document.querySelector<HTMLInputElement>('#cutout-height')!.value=String(plan.cutout.h);}
  const conflicts = overlappingPairs(plan);
  const outside=plan.items.filter(item=>intersectsCutout(item,plan)).length;
  planFacts.textContent = `Предметов: ${plan.items.length} · Площадь мебели: ${occupiedArea(plan).toLocaleString('ru-RU',{maximumFractionDigits:2})} м² · Пересечений: ${conflicts.length}${outside?` · В вырезе: ${outside}`:''}`;
  planFacts.classList.toggle('has-conflicts', conflicts.length > 0 || outside>0);
  document.querySelector<HTMLButtonElement>('#undo')!.disabled=!past.length;
  document.querySelector<HTMLButtonElement>('#redo')!.disabled=!future.length;
  canvas.setAttribute('viewBox',`-30 -30 ${plan.width+60} ${plan.height+60}`);
  canvas.replaceChildren();
  const roomPath=roomOutlinePath(plan);
  const defs=svg('defs'),clip=svg('clipPath',{id:'room-clip'});clip.append(svg('path',{d:roomPath}));defs.append(clip);canvas.append(defs);
  canvas.append(svg('path',{d:roomPath,fill:'#f8f6ef',stroke:'#5d605a','stroke-width':3}));
  const grid=svg('g',{'clip-path':'url(#room-clip)'});
  for(let x=10;x<plan.width;x+=10) grid.append(svg('line',{x1:x,y1:0,x2:x,y2:plan.height,stroke:'#e9e5d9','stroke-width':.5}));
  for(let y=10;y<plan.height;y+=10) grid.append(svg('line',{x1:0,y1:y,x2:plan.width,y2:y,stroke:'#e9e5d9','stroke-width':.5}));
  canvas.append(grid);
  const cut=cutoutBounds(plan);
  const doorY=cut?.x===0 && cut?.y>0?Math.min(plan.height-90,cut.y-90):plan.height-90;
  if(doorY>=0){canvas.append(svg('path',{d:`M 0 ${doorY} L 0 ${doorY+80} A 80 80 0 0 1 80 ${doorY}`,fill:'none',stroke:'#b5aa8d','stroke-width':2}));canvas.append(svg('line',{x1:0,y1:doorY,x2:0,y2:doorY+80,stroke:'#f8f6ef','stroke-width':6}));}
  for (const item of plan.items) {
    const group=svg('g',{class:`furniture ${selected===item.id?'selected':''}`,'data-id':item.id,tabindex:0,role:'button','aria-label':`${item.name}, ${item.w} на ${item.h} сантиметров`});
    const rotated=item.rotation%180!==0, w=rotated?item.h:item.w, h=rotated?item.w:item.h;
    group.append(svg('rect',{x:item.x,y:item.y,width:w,height:h,rx:4,fill:item.color,stroke:selected===item.id?'#232d2b':'#716f66','stroke-width':selected===item.id?3:1}));
    const text=svg('text',{x:item.x+w/2,y:item.y+h/2+4,'text-anchor':'middle',fill:'#fff','font-size':Math.min(15,w/7),'font-family':'Arial, sans-serif','font-weight':700});text.textContent=item.name;group.append(text);
    group.addEventListener('pointerdown',event=>{const p=point(event); selected=item.id;drag={id:item.id,startX:p.x,startY:p.y,origX:item.x,origY:item.y,moved:false};group.setPointerCapture(event.pointerId);canvas.querySelectorAll('.furniture').forEach(node=>node.classList.toggle('selected',node===group));renderInspector();});
    group.addEventListener('pointermove',event=>{if(!drag||drag.id!==item.id)return;const p=point(event);const next=clampItem({...item,x:snap(drag.origX+p.x-drag.startX),y:snap(drag.origY+p.y-drag.startY)},plan);if(next.x!==item.x||next.y!==item.y){if(!drag.moved){past.push(clone(plan));future.length=0;drag.moved=true;}plan={...plan,items:plan.items.map(i=>i.id===item.id?next:i)}; const rect=group.querySelector('rect')!;rect.setAttribute('x',String(next.x));rect.setAttribute('y',String(next.y));const label=group.querySelector('text')!;label.setAttribute('x',String(next.x+w/2));label.setAttribute('y',String(next.y+h/2+4));save();}});
    group.addEventListener('pointerup',()=>{drag=null;render();});
    group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){selected=item.id;render();event.preventDefault();}});
    canvas.append(group);
  }
  renderInspector();
}
function point(event:PointerEvent){const pt=canvas.createSVGPoint();pt.x=event.clientX;pt.y=event.clientY;const converted=pt.matrixTransform(canvas.getScreenCTM()!.inverse());return {x:converted.x,y:converted.y};}
function renderInspector(){
  const item=plan.items.find(i=>i.id===selected); inspector.replaceChildren();
  if(!item){const p=document.createElement('p');p.textContent='Выберите предмет на плане, чтобы изменить размер, повернуть или удалить его.';inspector.append(p);return;}
  const title=document.createElement('h2');title.textContent=item.name;
  const position=document.createElement('p');position.textContent=`Позиция: ${item.x}, ${item.y} см`;
  const dims=document.createElement('div');dims.className='item-dimensions';
  for(const [key,label] of [['w','Ширина'],['h','Глубина']] as const){
    const wrapper=document.createElement('label');wrapper.textContent=label;
    const input=document.createElement('input');input.type='number';input.min='20';input.max='400';input.step='10';input.value=String(item[key]);
    input.addEventListener('change',()=>{const value=Number(input.value);if(!Number.isInteger(value)||value<20||value>400){renderInspector();return;}commit({...plan,items:plan.items.map(i=>i.id===item.id?clampItem({...i,[key]:value},plan):i)});});
    wrapper.append(input);dims.append(wrapper);
  }
  const rotate=document.createElement('button');rotate.textContent='Повернуть на 90°';rotate.onclick=()=>commit({...plan,items:plan.items.map(i=>i.id===item.id?clampItem({...i,rotation:(i.rotation+90)%360},plan):i)});
  const duplicate=document.createElement('button');duplicate.textContent='Копировать';duplicate.onclick=()=>{if(plan.items.length>=100)return;const copy=clampItem({...item,id:crypto.randomUUID(),x:item.x+20,y:item.y+20},plan);selected=copy.id;commit({...plan,items:[...plan.items,copy]});};
  const remove=document.createElement('button');remove.className='danger';remove.textContent='Удалить';remove.onclick=()=>{commit({...plan,items:plan.items.filter(i=>i.id!==item.id)});selected=null;render();};
  inspector.append(title,position,dims,rotate,duplicate,remove);
}
for(const preset of presets){const button=document.createElement('button');button.className='preset';button.innerHTML=`<span class="swatch" style="background:${preset.color}"></span><span>${preset.name}<small>${preset.w} × ${preset.h} см</small></span><b>+</b>`;button.onclick=()=>{const next=addItem(plan,preset.kind);selected=next.items.at(-1)?.id??null;commit(next);};document.querySelector('#presets')!.append(button);}
function resize(){const w=Number(widthInput.value),h=Number(heightInput.value);if(!Number.isInteger(w)||!Number.isInteger(h)||w<200||h<200||w>1200||h>1200){render();return;}const next={...plan,width:w,height:h};if(next.cutout)next.cutout={...next.cutout,w:Math.min(next.cutout.w,w-100),h:Math.min(next.cutout.h,h-100)};next.items=next.items.map(i=>clampItem(i,next));commit(next);}
widthInput.addEventListener('change',resize);heightInput.addEventListener('change',resize);
shapeControls.addEventListener('change',event=>{
  const target=event.target as HTMLInputElement|HTMLSelectElement;
  const shape=document.querySelector<HTMLSelectElement>('#room-shape')!.value;
  if(shape==='rectangle'){commit({...plan,cutout:undefined});return;}
  const previous=plan.cutout;
  const corner=document.querySelector<HTMLSelectElement>('#cutout-corner')!.value as Cutout['corner'];
  const w=target.id==='room-shape'?Math.min(120,plan.width-100):Number(document.querySelector<HTMLInputElement>('#cutout-width')!.value);
  const h=target.id==='room-shape'?Math.min(100,plan.height-100):Number(document.querySelector<HTMLInputElement>('#cutout-height')!.value);
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<40||h<40||w>plan.width-100||h>plan.height-100){render();return;}
  const next={...plan,cutout:{corner,w,h}};
  next.items=next.items.map(item=>clampItem(item,next));
  if(previous?.corner===corner&&previous.w===w&&previous.h===h)return;
  commit(next);
});
document.querySelector('#undo')!.addEventListener('click',()=>{if(!past.length)return;future.push(clone(plan));plan=past.pop()!;render();});
document.querySelector('#redo')!.addEventListener('click',()=>{if(!future.length)return;past.push(clone(plan));plan=future.pop()!;render();});
document.querySelector('#reset')!.addEventListener('click',()=>{if(confirm('Вернуть исходный план?')){selected=null;commit(clone(initialPlan));}});
function download(name:string,content:string,type:string){const url=URL.createObjectURL(new Blob([content],{type}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
document.querySelector('#export-svg')!.addEventListener('click',()=>download('plan.svg',new XMLSerializer().serializeToString(canvas),'image/svg+xml'));
document.querySelector('#export-json')!.addEventListener('click',()=>download('plan.json',JSON.stringify(plan,null,2),'application/json'));
document.querySelector('#import-json')!.addEventListener('click',()=>document.querySelector<HTMLInputElement>('#import-file')!.click());
document.querySelector<HTMLInputElement>('#import-file')!.addEventListener('change',async event=>{
  const input=event.target as HTMLInputElement; const file=input.files?.[0]; if(!file)return;
  try{const imported=safePlan(JSON.parse(await file.text()));if(!imported)throw new Error('invalid');selected=null;commit(imported);}catch{alert('Не удалось открыть план. Проверьте JSON и размеры комнаты.');}finally{input.value='';}
});
customForm.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(customForm);
  const next = addCustomItem(plan, String(data.get('name') ?? ''), Number(data.get('width')), Number(data.get('height')));
  if (next === plan) return;
  selected = next.items.at(-1)?.id ?? null;
  commit(next);
  (customForm.elements.namedItem('name') as HTMLInputElement).value = '';
});
document.addEventListener('keydown',event=>{if(event.target instanceof HTMLInputElement)return;const ctrl=event.ctrlKey||event.metaKey;if(ctrl&&event.key.toLowerCase()==='z'){event.preventDefault();document.querySelector<HTMLButtonElement>(event.shiftKey?'#redo':'#undo')!.click();return;}if(ctrl&&event.key.toLowerCase()==='y'){event.preventDefault();document.querySelector<HTMLButtonElement>('#redo')!.click();return;}if(!selected)return;if(event.key==='Delete'){const item=plan.items.find(i=>i.id===selected);if(item){commit({...plan,items:plan.items.filter(i=>i.id!==selected)});selected=null;render();}return;}const delta:Record<string,[number,number]>={ArrowUp:[0,-10],ArrowDown:[0,10],ArrowLeft:[-10,0],ArrowRight:[10,0]};if(delta[event.key]){event.preventDefault();const [dx,dy]=delta[event.key];commit({...plan,items:plan.items.map(i=>i.id===selected?clampItem({...i,x:i.x+dx,y:i.y+dy},plan):i)});}});
render();
