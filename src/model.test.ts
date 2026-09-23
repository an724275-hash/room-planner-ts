import {describe,expect,it} from 'vitest';
import {addItem,clampItem,initialPlan,safePlan,snap} from './model';
describe('room model',()=>{
  it('snaps coordinates',()=>expect(snap(24)).toBe(20));
  it('keeps items in room',()=>expect(clampItem({...initialPlan.items[0],x:999,y:-20},initialPlan)).toMatchObject({x:300,y:0}));
  it('adds a furniture preset',()=>expect(addItem(initialPlan,'chair','new').items).toHaveLength(3));
  it('rejects broken imported plans',()=>expect(safePlan({width:10,height:10,items:[]})).toBeNull());
  it('rejects unreasonable furniture dimensions',()=>expect(safePlan({...initialPlan,items:[{...initialPlan.items[0],w:9999}]})).toBeNull());
});
