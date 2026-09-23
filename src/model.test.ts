import {describe,expect,it} from 'vitest';
import {addCustomItem,addItem,clampItem,initialPlan,intersectsCutout,occupiedArea,overlappingPairs,roomArea,roomOutlinePath,safePlan,snap} from './model';
describe('room model',()=>{
  it('snaps coordinates',()=>expect(snap(24)).toBe(20));
  it('keeps items in room',()=>expect(clampItem({...initialPlan.items[0],x:999,y:-20},initialPlan)).toMatchObject({x:300,y:0}));
  it('adds a furniture preset',()=>expect(addItem(initialPlan,'chair','new').items).toHaveLength(3));
  it('rejects broken imported plans',()=>expect(safePlan({width:10,height:10,items:[]})).toBeNull());
  it('rejects unreasonable furniture dimensions',()=>expect(safePlan({...initialPlan,items:[{...initialPlan.items[0],w:9999}]})).toBeNull());
  it('adds a measured custom item',()=>expect(addCustomItem(initialPlan,'Тумба',80,45,'custom-1').items.at(-1)).toMatchObject({name:'Тумба',w:80,h:45}));
  it('rejects invalid custom dimensions',()=>expect(addCustomItem(initialPlan,'Тумба',999,45)).toBe(initialPlan));
  it('calculates furniture area',()=>expect(occupiedArea(initialPlan)).toBe(2.7));
  it('finds overlaps including rotated furniture',()=>{
    const plan={...initialPlan,items:[{...initialPlan.items[0],x:0,y:0},{...initialPlan.items[1],x:70,y:10,rotation:90}]};
    expect(overlappingPairs(plan)).toHaveLength(1);
  });
  it('subtracts the recess from L-shaped room area',()=>expect(roomArea({...initialPlan,cutout:{corner:'top-left',w:100,h:100}})).toBe(19));
  it('moves furniture out of a corner cutout',()=>{
    const plan={...initialPlan,cutout:{corner:'top-left' as const,w:150,h:150}};
    const placed=clampItem({...initialPlan.items[1],x:0,y:0},plan);
    expect(intersectsCutout(placed,plan)).toBe(false);
    expect(roomOutlinePath(plan)).toContain('M 150 0');
  });
  it('rejects malformed cutouts on import',()=>expect(safePlan({...initialPlan,cutout:{corner:'top-left',w:9999,h:90}})).toBeNull());
});
