import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const html=fs.readFileSync(new URL('../docs/ops_admin/index.html',import.meta.url),'utf8');
const sync=html.slice(html.indexOf('var SYNC_BUSY=false'),html.indexOf('\nfunction route(){',html.indexOf('var SYNC_BUSY=false')));
const search=html.slice(html.indexOf('function menuSearchMatch('),html.indexOf('\nfunction menuSearchApply('));
const snapshot=()=>({me:{name:'테스트',role:'총괄'},products:[{id:'fresh'}],history:[],config:{}});
function setup(overrides={}){
  const calls=[],toasts=[],timers=[];
  const context={Promise,Date,Array,Object,String,Boolean,
    S:{me:{name:'테스트',role:'총괄'},products:[{id:'old'}]},DEMO:false,
    location:{hash:'#more'},KR_IDX:null,
    api:async action=>{calls.push(action);return action==='boot'?snapshot():{ok:true};},
    salesLoad:async()=>({rows:[],privateData:'do-not-retain'}),krLoad:async()=>({rows:[]}),pzLoad:async()=>({rows:[]}),
    syncRunHere:()=>0,krOpener:()=>null,
    otabsDraw:()=>{},persist:()=>{},expandProducts:j=>j.products,
    route:()=>{context.routed=(context.routed||0)+1;},
    toast:(...args)=>toasts.push(args),
    setTimeout:(fn,delay)=>{timers.push({fn,delay});return timers.length;},clearTimeout:()=>{},
    ...overrides
  };
  vm.createContext(context);vm.runInContext(sync+'\n'+search,context);
  return {context,calls,toasts,timers};
}

test('one rejected source is reported as partial failure, not full success',async()=>{
  const {context:c,toasts}=setup({salesLoad:async()=>{throw {message:'매출 접근 실패'};}});
  const result=await c.syncAll();
  assert.equal(result.length,5);assert.equal(c.SYNC_BUSY,false);
  assert.equal(c.syncResultLabel(),'일부 조회 실패');
  assert.equal(c.SYNC_RESULTS.find(r=>r.name==='매출 자료').error,'매출 접근 실패');
  assert.equal(c.SYNC_RESULTS.find(r=>r.name==='크림 PC 수집').pending,true);
  assert.equal(toasts[0][1],true);assert.doesNotMatch(toasts[0][0],/동기화 완료/);
});
test('all reads successful still distinguish server data from pending PC collection',async()=>{
  const {context:c}=setup();await c.syncAll();
  assert.equal(c.syncResultLabel(),'자료 확인 · PC 수집 대기');
  assert.equal(c.SYNC_RESULTS[1].privateData,undefined);
});
test('malformed boot response preserves existing product state',async()=>{
  const {context:c}=setup({api:async()=>({ok:true})});const old=c.S;
  await c.syncAll();assert.equal(c.S,old);assert.ok(c.SYNC_RESULTS[0].error);
});
test('auth expiration never redraws a protected screen as successful',async()=>{
  const {context:c,toasts}=setup({api:async action=>{if(action==='boot')throw {silent:true};return {ok:true};}});
  await c.syncAll();assert.equal(c.routed,undefined);assert.equal(toasts.length,0);
  assert.equal(c.SYNC_BUSY,false);assert.equal(c.SYNC_RESULTS[0].silent,true);
});
test('a second tap does not start another refresh',async()=>{
  let complete;const wait=new Promise(resolve=>{complete=resolve;});let bootCalls=0;
  const {context:c}=setup({api:action=>{if(action==='boot'){bootCalls++;return wait;}return Promise.resolve({ok:true});}});
  const first=c.syncAll();assert.equal(c.syncAll(),undefined);
  complete(snapshot());await first;assert.equal(bootCalls,1);
});
test('logout during a pending read cannot restore the previous signed-in state',async()=>{
  let complete;const wait=new Promise(resolve=>{complete=resolve;});
  const {context:c}=setup({api:action=>action==='boot'?wait:Promise.resolve({ok:true})});
  const pending=c.syncAll();c.SYNC_RUN++;c.S.me=null;complete(snapshot());await pending;
  assert.equal(c.S.me,null);assert.equal(c.routed,undefined);
});
test('synchronous collector failure is contained and does not leave busy enabled',async()=>{
  const {context:c}=setup({syncRunHere:()=>{throw Error('창 연결 실패');}});
  await c.syncAll();assert.equal(c.SYNC_BUSY,false);assert.equal(c.SYNC_RESULTS[4].error,'창 연결 실패');
});
test('demo mode does not send a real PC collection request',async()=>{
  const {context:c,calls,timers}=setup({DEMO:true});await c.syncAll();
  assert.deepEqual(calls,['boot']);assert.equal(timers.length,0);
});
test('menu search matches work names and groups without interpreting regex',()=>{
  const {context:c}=setup();const item={k:'cost',t:'원가 · 마진'};
  assert.equal(c.menuSearchMatch('원가 마진','상품 · 재고',item),true);
  assert.equal(c.menuSearchMatch('재고','상품 · 재고',item),true);
  assert.equal(c.menuSearchMatch('[','상품 · 재고',item),false);
  assert.equal(c.menuSearchMatch('   ','상품 · 재고',item),true);
});
