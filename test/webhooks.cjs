const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function fixture(status = 'PAYMENT_PENDING') {
  let state = { mission: { status, createdByUserId: 'u' }, ledger: [] };
  let fail = false;
  let queue = Promise.resolve();
  const refunds = [];
  const prisma = { $transaction(fn) {
    const job = queue.then(async () => {
      const draft = structuredClone(state);
      const tx = {
        mission: {
          updateMany: async ({where, data}) => {
            if (draft.mission.status !== where.status) return {count: 0};
            Object.assign(draft.mission, data); return {count: 1};
          },
          findUnique: async () => draft.mission,
        },
        transaction: { create: async ({data}) => {
          if (fail) throw Error('ledger unavailable');
          draft.ledger.push(data);
        } },
      };
      const result = await fn(tx); state = draft; return result;
    });
    queue = job.catch(() => {}); return job;
  } };
  const exports = {};
  const source = fs.readFileSync('app/api/stripe/webhooks/route.ts', 'utf8') + '\nexports.handle = handleMissionPaymentSucceeded;';
  const code = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code, {exports, console, require(name) {
    if (name === '@/lib/prisma') return {prisma};
    if (name === '@/lib/stripe') return {stripe: {refunds: {create: async (...args) => refunds.push(args)}}};
    return {};
  }});
  const payment = {id:'pi_test', metadata:{missionId:'m'}, amount:300, currency:'eur', latest_charge:'ch_test'};
  return {run: () => exports.handle(payment), state: () => state, fail: value => {fail=value;}, refunds};
}
test('duplicate concurrent payment events publish and book only once', async () => {
  const f = fixture(); await Promise.all([f.run(), f.run()]);
  assert.equal(f.state().mission.status, 'PUBLISHED');
  assert.equal(f.state().ledger.length, 1);
  assert.equal(f.state().ledger[0].amount, 3);
});
test('ledger failure rolls back publication and a retry recovers', async () => {
  const f = fixture(); f.fail(true);
  await assert.rejects(f.run(), /ledger unavailable/);
  assert.equal(f.state().mission.status, 'PAYMENT_PENDING');
  assert.equal(f.state().ledger.length, 0);
  f.fail(false); await f.run();
  assert.equal(f.state().mission.status, 'PUBLISHED');
  assert.equal(f.state().ledger.length, 1);
});
test('payment received after cancellation requests an idempotent refund', async () => {
  const f = fixture('CANCELED'); await f.run(); await f.run();
  assert.equal(f.state().ledger.length, 0);
  assert.equal(f.refunds.length, 2);
  assert.equal(f.refunds[0][1].idempotencyKey, f.refunds[1][1].idempotencyKey);
});
