export type Item = { id: string; kind: string; name: string; x: number; y: number; w: number; h: number; rotation: number; color: string };
export type Cutout = {corner:'top-left'|'top-right'|'bottom-left'|'bottom-right'; w:number; h:number};
export type Plan = { width: number; height: number; items: Item[]; cutout?: Cutout };
export const presets = [
  {kind:'sofa',name:'Диван',w:200,h:90,color:'#aa8466'},
  {kind:'bed',name:'Кровать',w:180,h:200,color:'#859894'},
  {kind:'table',name:'Стол',w:120,h:75,color:'#ad9d77'},
  {kind:'chair',name:'Стул',w:55,h:55,color:'#7895a0'},
  {kind:'cabinet',name:'Шкаф',w:120,h:60,color:'#8a7e73'},
  {kind:'desk',name:'Письменный стол',w:140,h:70,color:'#776c5d'},
  {kind:'dresser',name:'Комод',w:100,h:50,color:'#a07666'},
  {kind:'shelf',name:'Стеллаж',w:90,h:35,color:'#6f7762'},
  {kind:'armchair',name:'Кресло',w:85,h:80,color:'#8f8179'},
  {kind:'rug',name:'Ковёр',w:180,h:120,color:'#af9e7d'},
];
export const initialPlan: Plan = {width:500,height:400,items:[
  {id:'sofa-1',kind:'sofa',name:'Диван',x:45,y:45,w:200,h:90,rotation:0,color:'#aa8466'},
  {id:'table-1',kind:'table',name:'Стол',x:320,y:165,w:120,h:75,rotation:0,color:'#ad9d77'},
]};
export function clampItem(item: Item, plan: Plan): Item {
  const rotated = item.rotation % 180 !== 0;
  const boxW = rotated ? item.h : item.w;
  const boxH = rotated ? item.w : item.h;
  const x = Math.max(0,Math.min(item.x,Math.max(0,plan.width-boxW)));
  const y = Math.max(0,Math.min(item.y,Math.max(0,plan.height-boxH)));
  const placed = {...item,x,y};
  if(!intersectsCutout(placed,plan)) return placed;
  const cutout = cutoutBounds(plan)!;
  const candidates = [
    {...placed,x:cutout.x-boxW}, {...placed,x:cutout.x+cutout.w},
    {...placed,y:cutout.y-boxH}, {...placed,y:cutout.y+cutout.h},
  ].filter(candidate => candidate.x>=0 && candidate.y>=0 && candidate.x+boxW<=plan.width && candidate.y+boxH<=plan.height && !intersectsCutout(candidate,plan));
  return candidates.sort((a,b)=>Math.abs(a.x-x)+Math.abs(a.y-y)-Math.abs(b.x-x)-Math.abs(b.y-y))[0] ?? placed;
}
export function cutoutBounds(plan: Plan) {
  if(!plan.cutout) return null;
  const {corner,w,h}=plan.cutout;
  return {x:corner.endsWith('right')?plan.width-w:0,y:corner.startsWith('bottom')?plan.height-h:0,w,h};
}
export function intersectsCutout(item: Item, plan: Plan): boolean {
  const box=cutoutBounds(plan);
  if(!box) return false;
  const w=item.rotation%180?item.h:item.w, h=item.rotation%180?item.w:item.h;
  return item.x<box.x+box.w && item.x+w>box.x && item.y<box.y+box.h && item.y+h>box.y;
}
export function roomArea(plan: Plan): number { return (plan.width*plan.height-(plan.cutout?.w??0)*(plan.cutout?.h??0))/10000; }
export function roomOutlinePath(plan: Plan): string {
  const {width:w,height:h}=plan, c=plan.cutout;
  if(!c) return `M 0 0 H ${w} V ${h} H 0 Z`;
  if(c.corner==='top-left') return `M ${c.w} 0 H ${w} V ${h} H 0 V ${c.h} H ${c.w} Z`;
  if(c.corner==='top-right') return `M 0 0 H ${w-c.w} V ${c.h} H ${w} V ${h} H 0 Z`;
  if(c.corner==='bottom-left') return `M 0 0 H ${w} V ${h} H ${c.w} V ${h-c.h} H 0 Z`;
  return `M 0 0 H ${w} V ${h-c.h} H ${w-c.w} V ${h} H 0 Z`;
}
export function snap(value: number, grid = 10): number { return Math.round(value / grid) * grid; }
export function addItem(plan: Plan, kind: string, id: string = crypto.randomUUID()): Plan {
  const preset = presets.find(p => p.kind === kind);
  if (!preset) return plan;
  const item = clampItem({...preset,id,x:50,y:50,rotation:0},plan);
  return {...plan,items:[...plan.items,item]};
}
export function addCustomItem(plan: Plan, name: string, w: number, h: number, id: string = crypto.randomUUID()): Plan {
  const cleanName = name.trim();
  if (!cleanName || cleanName.length > 60 || !Number.isInteger(w) || !Number.isInteger(h) || w < 20 || h < 20 || w > 400 || h > 400 || plan.items.length >= 100) return plan;
  const item = clampItem({id, kind:'custom', name:cleanName, x:50, y:50, w, h, rotation:0, color:'#526e68'}, plan);
  return {...plan,items:[...plan.items,item]};
}
export function occupiedArea(plan: Plan): number {
  return plan.items.reduce((total, item) => total + item.w * item.h, 0) / 10000;
}
export function overlappingPairs(plan: Plan): [Item,Item][] {
  const bounds = (item: Item) => ({x:item.x,y:item.y,w:item.rotation % 180 ? item.h : item.w,h:item.rotation % 180 ? item.w : item.h});
  const pairs: [Item,Item][] = [];
  for(let a=0;a<plan.items.length;a++) for(let b=a+1;b<plan.items.length;b++) {
    const first=bounds(plan.items[a]), second=bounds(plan.items[b]);
    if(first.x < second.x+second.w && first.x+first.w > second.x && first.y < second.y+second.h && first.y+first.h > second.y) pairs.push([plan.items[a],plan.items[b]]);
  }
  return pairs;
}
export function safePlan(value: unknown): Plan | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Partial<Plan>;
  if (!Number.isFinite(p.width) || !Number.isFinite(p.height) || !Array.isArray(p.items)) return null;
  if (p.width! < 200 || p.width! > 1200 || p.height! < 200 || p.height! > 1200 || p.items.length > 100) return null;
  if(p.cutout && (!['top-left','top-right','bottom-left','bottom-right'].includes(p.cutout.corner) || !Number.isInteger(p.cutout.w) || !Number.isInteger(p.cutout.h) || p.cutout.w<40 || p.cutout.h<40 || p.cutout.w>p.width!-100 || p.cutout.h>p.height!-100)) return null;
  if (!p.items.every(i => typeof i.id === 'string' && typeof i.name === 'string' && typeof i.color === 'string' && i.name.length <= 60 && /^#[0-9a-f]{6}$/i.test(i.color) && [i.x,i.y,i.w,i.h,i.rotation].every(Number.isFinite) && i.w >= 20 && i.w <= 400 && i.h >= 20 && i.h <= 400)) return null;
  return {width:p.width!,height:p.height!,items:p.items.map(i => clampItem(i,p as Plan))};
}
