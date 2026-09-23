export type Item = { id: string; kind: string; name: string; x: number; y: number; w: number; h: number; rotation: number; color: string };
export type Plan = { width: number; height: number; items: Item[] };
export const presets = [
  {kind:'sofa',name:'Диван',w:200,h:90,color:'#aa8466'},
  {kind:'bed',name:'Кровать',w:180,h:200,color:'#859894'},
  {kind:'table',name:'Стол',w:120,h:75,color:'#ad9d77'},
  {kind:'chair',name:'Стул',w:55,h:55,color:'#7895a0'},
  {kind:'cabinet',name:'Шкаф',w:120,h:60,color:'#8a7e73'},
];
export const initialPlan: Plan = {width:500,height:400,items:[
  {id:'sofa-1',kind:'sofa',name:'Диван',x:45,y:45,w:200,h:90,rotation:0,color:'#aa8466'},
  {id:'table-1',kind:'table',name:'Стол',x:320,y:165,w:120,h:75,rotation:0,color:'#ad9d77'},
]};
export function clampItem(item: Item, plan: Plan): Item {
  const rotated = item.rotation % 180 !== 0;
  const boxW = rotated ? item.h : item.w;
  const boxH = rotated ? item.w : item.h;
  return {...item,x:Math.max(0,Math.min(item.x,Math.max(0,plan.width-boxW))),y:Math.max(0,Math.min(item.y,Math.max(0,plan.height-boxH)))};
}
export function snap(value: number, grid = 10): number { return Math.round(value / grid) * grid; }
export function addItem(plan: Plan, kind: string, id: string = crypto.randomUUID()): Plan {
  const preset = presets.find(p => p.kind === kind);
  if (!preset) return plan;
  const item = clampItem({...preset,id,x:50,y:50,rotation:0},plan);
  return {...plan,items:[...plan.items,item]};
}
export function safePlan(value: unknown): Plan | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Partial<Plan>;
  if (!Number.isFinite(p.width) || !Number.isFinite(p.height) || !Array.isArray(p.items)) return null;
  if (p.width! < 200 || p.width! > 1200 || p.height! < 200 || p.height! > 1200 || p.items.length > 100) return null;
  if (!p.items.every(i => typeof i.id === 'string' && typeof i.name === 'string' && typeof i.color === 'string' && i.name.length <= 60 && /^#[0-9a-f]{6}$/i.test(i.color) && [i.x,i.y,i.w,i.h,i.rotation].every(Number.isFinite) && i.w >= 20 && i.w <= 400 && i.h >= 20 && i.h <= 400)) return null;
  return {width:p.width!,height:p.height!,items:p.items.map(i => clampItem(i,p as Plan))};
}
