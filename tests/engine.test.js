/* Scoring engine checks. Run with: node --test tests/engine.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
global.CL = require('../src/engine.js');
const SEED = require('../src/seed.js');

const peak = (loads, gid) => Math.max(...loads[gid].slice(0, CL.HORIZON).map((c) => c.index));

test('demo story: Service Desk and Client Operations reach Critical', () => {
  const s = SEED();
  const loads = CL.compute(s);
  assert.equal(Math.round(peak(loads, 'sd')), 137);
  assert.ok(peak(loads, 'co') >= s.settings.critical);
  const crit = CL.digest(s, loads).filter((r) => r.worst === 'critical').map((r) => r.group.id).sort();
  assert.deepEqual(crit, ['co', 'sd']);
});

test('suggested slot moves ticket migration 11 weeks and clears Red', () => {
  const s = SEED();
  const t = s.initiatives.find((i) => i.id === 'tkt');
  assert.equal(CL.suggestShift(s, t), 11);
  t.start += 11;
  const loads = CL.compute(s);
  for (const g of s.groups) assert.ok(peak(loads, g.id) < s.settings.red, g.id + ' stays below Red');
  assert.equal(CL.overload(s, loads).cost, 0);
});

test('cost of overload counts only load above the Red line', () => {
  const s = SEED();
  const ov = CL.overload(s, CL.compute(s));
  assert.ok(ov.cost > 100000 && ov.cost < 250000, 'demo overload about €160k, got ' + ov.cost);
  assert.equal(ov.byGroup.hr, 0);
});

test('load index is weighted hours over change capacity × 100', () => {
  const s = { settings: CL.DEFAULT_SETTINGS, groups: [{ id: 'g', fte: 10, strain: 0 }],
    initiatives: [{ id: 'x', status: 'approved', start: 0, prepWeeks: 0, goLiveWeeks: 1, hypercareWeeks: 0,
      impacts: [{ groupId: 'g', intensity: 3, hours: 8, pct: 100 }] }] };
  s.settings = { ...CL.DEFAULT_SETTINGS, split: { prep: 0, golive: 100, hypercare: 0 } };
  // 8 hours in one go-live week, intensity weight 1.0, capacity 10% of 40 h = 4 h -> index 200
  assert.equal(Math.round(CL.compute(s).g[0].index), 200);
});

test('awareness-level go-lives do not trigger the go-live cluster rule', () => {
  const imp = (intensity) => [{ groupId: 'g', intensity, hours: 0.1, pct: 100 }];
  const mk = (intensity) => ({ settings: CL.DEFAULT_SETTINGS, groups: [{ id: 'g', fte: 10 }],
    initiatives: [0, 1, 2].map((k) => ({ id: 'i' + k, status: 'approved', start: 0, prepWeeks: 0, goLiveWeeks: 1, hypercareWeeks: 0, impacts: imp(intensity) })) });
  assert.equal(CL.compute(mk(1)).g[0].zone, 'green');
  assert.equal(CL.compute(mk(4)).g[0].zone, 'critical');
});

test('the check tells a push over the line from landing on an already overloaded team', () => {
  const s = SEED();
  const tkt = CL.assess(s, s.initiatives.find((i) => i.id === 'tkt'));
  const pushes = tkt.findings.filter((f) => f.overwhelm.length).map((f) => f.groupId).sort();
  assert.deepEqual(pushes, ['co', 'sd'], 'ticket migration pushes Service Desk and Client Operations over');
  const spl = CL.assess(s, s.initiatives.find((i) => i.id === 'spl'));
  assert.ok(spl.findings.some((f) => f.already.length), 'the link migration lands on teams that are already overloaded');
  assert.ok(spl.findings.every((f) => f.overwhelm.length <= 1), 'and at most tips a borderline week over, it is not the cause');
});

test('ideas and finished initiatives are left out of the load', () => {
  const s = SEED();
  for (const i of s.initiatives) i.status = 'idea';
  const loads = CL.compute(s);
  for (const g of s.groups) assert.equal(Math.round(peak(loads, g.id)), g.strain || 0);
});
