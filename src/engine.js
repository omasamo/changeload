/* ChangeLoad scoring engine. Pure functions, no DOM. Implements section 4 and 5 of product-definition.md. */
const CL = (() => {
  const START = new Date(2026, 9, 5); // Monday 5 Oct 2026, week 0 of the demo horizon
  const HORIZON = 26;                 // weeks shown in the heatmap
  const COMPUTE = 44;                 // weeks computed, so shifted initiatives stay in range
  const ZONES = ['green', 'amber', 'red', 'critical'];
  const ZONE_LABEL = { green: 'Green', amber: 'Amber', red: 'Red', critical: 'Critical' };
  const PHASES = ['prep', 'golive', 'hypercare'];
  const PHASE_LABEL = { prep: 'Prep', golive: 'Go-live', hypercare: 'Hypercare' };

  const IMPACT_TYPES = {
    tool:      { label: 'New tool',                  intensity: 4, hours: 8 },
    process:   { label: 'Process change',            intensity: 3, hours: 4 },
    migration: { label: 'Data or content migration', intensity: 2, hours: 3 },
    org:       { label: 'Role or org change',        intensity: 4, hours: 6 },
    policy:    { label: 'Policy change',             intensity: 1, hours: 1 },
    freeze:    { label: 'Downtime or freeze',        intensity: 2, hours: 2 },
  };

  const DEFAULT_SETTINGS = {
    amber: 70, red: 100, critical: 130,
    capacityPct: 10, contractHours: 40,
    intensity: { 1: 0.6, 2: 0.8, 3: 1.0, 4: 1.3, 5: 1.6 },
    split: { prep: 30, golive: 50, hypercare: 20 },
    concurrency: 0.15, goLivePenalty: 0.1, criticalGoLives: 3,
  };

  function weekDate(w) { const d = new Date(START); d.setDate(d.getDate() + 7 * w); return d; }
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtWeek(w) { const d = weekDate(w); return d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  function fmtWeekLong(w) { const d = weekDate(w); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }

  function phaseLen(init, p) { return p === 'prep' ? init.prepWeeks : p === 'golive' ? init.goLiveWeeks : init.hypercareWeeks; }
  function endWeek(init) { return init.start + init.prepWeeks + init.goLiveWeeks + init.hypercareWeeks; } // exclusive
  function phaseOf(init, w) {
    let s = init.start;
    if (w < s) return null;
    for (const p of PHASES) { const n = phaseLen(init, p); if (w < s + n) return p; s += n; }
    return null;
  }
  const counts = (init) => init.status !== 'done' && init.status !== 'idea';

  function zoneOf(index, goLives2w, st) {
    if (index >= st.critical || goLives2w >= st.criticalGoLives) return 'critical';
    if (index >= st.red) return 'red';
    if (index >= st.amber) return 'amber';
    return 'green';
  }
  const zoneRank = (z) => ZONES.indexOf(z);

  /* Load for every group and week. Returns { [groupId]: [cell, ...] }. */
  function compute(state, opts = {}) {
    const st = state.settings;
    const inits = state.initiatives.filter((i) => opts.includeAll || counts(i) || i.id === opts.forceId);
    const out = {};
    for (const g of state.groups) {
      const cap = st.contractHours * ((g.capacityPct ?? st.capacityPct) / 100);
      const cells = [];
      for (let w = 0; w < COMPUTE; w++) {
        const parts = [];
        let golive = 0, golive2w = 0;
        for (const init of inits) {
          const p = phaseOf(init, w);
          const prev = phaseOf(init, w - 1);
          const imps = init.impacts.filter((x) => x.groupId === g.id);
          if (!imps.length) continue;
          if (prev === 'golive' || p === 'golive') golive2w++;
          if (!p) continue;
          if (p === 'golive') golive++;
          let effort = 0, weighted = 0;
          for (const imp of imps) {
            const e = imp.hours * (st.split[p] / 100) / phaseLen(init, p) * (imp.pct / 100);
            effort += e; weighted += e * st.intensity[imp.intensity];
          }
          parts.push({ initId: init.id, phase: p, effort, weighted });
        }
        const n = parts.length;
        const mult = n ? 1 + st.concurrency * (n - 1) + st.goLivePenalty * Math.max(0, golive - 1) : 1;
        let sum = 0;
        for (const x of parts) { x.points = x.weighted * mult / cap * 100; sum += x.points; }
        const strain = g.strain || 0;
        const index = sum + strain;
        cells.push({ w, index, zone: zoneOf(index, golive2w, st), parts, mult, n, golive, golive2w, strain, cap,
          hours: parts.reduce((a, x) => a + x.effort, 0) });
      }
      out[g.id] = cells;
    }
    return out;
  }

  function withInitiative(state, init) {
    const others = state.initiatives.filter((i) => i.id !== init.id);
    return { ...state, initiatives: init ? [...others, init] : others };
  }
  function without(state, id) { return { ...state, initiatives: state.initiatives.filter((i) => i.id !== id) }; }

  /* Section 5.2: compare portfolio without and with the draft initiative. */
  function assess(state, draft) {
    const before = compute(without(state, draft.id));
    const after = compute(withInitiative(state, draft), { forceId: draft.id });
    const groupIds = [...new Set(draft.impacts.map((x) => x.groupId))];
    const findings = [];
    let worst = 'green';
    for (const gid of groupIds) {
      const f = { groupId: gid, already: [], overwhelm: [], up: [], peakBefore: 0, peakAfter: 0, worstAfter: 'green' };
      for (let w = draft.start; w < endWeek(draft) && w < COMPUTE; w++) {
        const b = before[gid][w], a = after[gid][w];
        f.peakBefore = Math.max(f.peakBefore, b.index); f.peakAfter = Math.max(f.peakAfter, a.index);
        if (zoneRank(a.zone) > zoneRank(f.worstAfter)) f.worstAfter = a.zone;
        if (zoneRank(b.zone) >= 2) f.already.push(w);
        else if (zoneRank(a.zone) >= 2) f.overwhelm.push(w);
        if (zoneRank(a.zone) > zoneRank(b.zone)) f.up.push(w);
      }
      if (zoneRank(f.worstAfter) > zoneRank(worst)) worst = f.worstAfter;
      findings.push(f);
    }
    return { before, after, findings, worst, groupIds };
  }

  /* Rule 4: nearest start shift that keeps every affected group below Red while the initiative is active. */
  function fits(state, draft) {
    const after = compute(withInitiative(state, draft), { forceId: draft.id });
    const gids = [...new Set(draft.impacts.map((x) => x.groupId))];
    for (const gid of gids)
      for (let w = draft.start; w < endWeek(draft); w++)
        if (w >= COMPUTE || zoneRank(after[gid][w].zone) >= 2) return false;
    return true;
  }
  function suggestShift(state, draft, maxShift = 16) {
    if (fits(state, draft)) return 0;
    for (let k = 1; k <= maxShift; k++) {
      for (const s of [k, -k]) {
        const start = draft.start + s;
        if (start < 0) continue;
        if (fits(state, { ...draft, start })) return s;
      }
    }
    return null;
  }

  /* Rule 6: groups forecast to reach Red in the next n weeks, and what drives it. */
  function digest(state, loads, from = 0, n = 8) {
    const rows = [];
    for (const g of state.groups) {
      const hot = loads[g.id].slice(from, from + n).filter((c) => zoneRank(c.zone) >= 2);
      if (!hot.length) continue;
      const drivers = {};
      for (const c of hot) for (const p of c.parts) drivers[p.initId] = (drivers[p.initId] || 0) + p.points;
      const peak = hot.reduce((a, c) => (c.index > a.index ? c : a), hot[0]);
      rows.push({ group: g, weeks: hot.map((c) => c.w), peak, worst: hot.some((c) => c.zone === 'critical') ? 'critical' : 'red',
        drivers: Object.entries(drivers).sort((a, b) => b[1] - a[1]).map(([id]) => id) });
    }
    return rows.sort((a, b) => b.peak.index - a.peak.index);
  }

  return { START, HORIZON, COMPUTE, ZONES, ZONE_LABEL, PHASES, PHASE_LABEL, IMPACT_TYPES, DEFAULT_SETTINGS,
    weekDate, fmtWeek, fmtWeekLong, phaseOf, endWeek, compute, assess, suggestShift, digest, zoneRank, withInitiative };
})();
if (typeof module !== 'undefined') module.exports = CL;
