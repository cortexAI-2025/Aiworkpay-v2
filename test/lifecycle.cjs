const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(prisma, stripe) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('lib/missionLifecycle.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,console,require:(name)=> name==='./prisma'?{prisma}:name==='./stripe'?{stripe}:name==='./missionPayment'?{releaseMissionPayment:async()=> 'refunded'}:{} });
  return exports;
}
function fixture({fail=false,onboarded=true}={}) {
  const mission={id:'m',status:'DELIVERED',assignedToUserId:'u',budget:'0.05',currency:'EUR'};
  const ledger=[];const calls=[];
  const tx={mission:{updateMany:async()=>{if(mission.status!=='DELIVERED')return{count:0};mission.status='COMPLETED';return{count:1};},findUniqueOrThrow:async()=>({...mission})},transaction:{create:async({data})=>{const t={id:'t'+ledger.length,...data};ledger.push(t);return t;}}};
  const prisma={$transaction:async(fn)=>fn(tx),transaction:{findFirst:async()=>{const t=ledger.find(t=>t.type==='PAYWORKER_PAYOUT');return t?{...t,user:{stripeAccountId:'acct_test',stripeAccountOnboarded:onboarded},mission}:null;},update:async({where,data})=>Object.assign(ledger.find(t=>t.id===where.id),data)}};
  const stripe={transfers:{create:async(params,options)=>{calls.push({params,options});if(fail)throw Error('offline');return{id:'tr_test'};}}};
  return{mission,ledger,calls,api:load(prisma,stripe)};
}
test('completion books an exact split and transfers once',async()=>{
  const f=fixture();const done=await f.api.completeDeliveredMission({...f.mission});
  assert.equal(done.commission.payworkerAmount+done.commission.platformFeeAmount,0.05);
  assert.equal(done.commission.transferStatus,'SUCCEEDED');
  assert.equal(f.ledger.length,2);
  await f.api.retryMissionPayout('m');assert.equal(f.calls.length,1);
});
test('failed transfer remains pending and can be retried with the same Stripe key',async()=>{
  const f=fixture({fail:true});const done=await f.api.completeDeliveredMission({...f.mission});
  assert.equal(done.commission.transferStatus,'PENDING');
  await f.api.retryMissionPayout('m');assert.equal(f.ledger.length,2);
  assert.equal(f.calls[0].options.idempotencyKey,f.calls[1].options.idempotencyKey);
});
test('unready Connect account keeps payout pending without contacting Stripe',async()=>{
  const f=fixture({onboarded:false});const done=await f.api.completeDeliveredMission({...f.mission});
  assert.equal(done.commission.transferStatus,'PENDING');assert.equal(f.calls.length,0);
});
test('concurrent approvals claim only one completion',async()=>{
  const f=fixture();const results=await Promise.all([f.api.completeDeliveredMission({...f.mission}),f.api.completeDeliveredMission({...f.mission})]);
  assert.equal(results.filter(Boolean).length,1);assert.equal(f.ledger.length,2);assert.equal(f.calls.length,1);
});
