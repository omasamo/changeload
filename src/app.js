/* ChangeLoad demo UI. State lives in the browser; demo data seeds on first load. */
(() => {
  const KEY = 'changeload-demo-v1';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const r0 = (n) => Math.round(n);

  function load() { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* demo still works without storage */ } }

  let state = load() || SEED();
  const VIEWS = ['portfolio', 'initiatives', 'groups', 'alerts', 'settings'];
  const ui = { view: 'portfolio', sel: null, group: 'sd', draft: null, isNew: false, guide: true, note: '', confirm: null };

  const STATUS = { idea: 'Idea', planned: 'Planned', approved: 'Approved', in_flight: 'In flight', done: 'Done' };
  const groupById = (id) => state.groups.find((g) => g.id === id);
  const initById = (id) => state.initiatives.find((i) => i.id === id);
  const color = (init) => `var(--i${(init?.color ?? 0) % 8})`;
  const cellClass = (c) => (c.zone === 'green' && c.index < 20 ? 'idle' : c.zone);
  const zonePill = (z) => `<span class="pill ${z}">${CL.ZONE_LABEL[z]}</span>`;
  const weeksText = (ws) => {
    if (!ws.length) return '';
    const runs = []; let a = ws[0], b = ws[0];
    for (const w of ws.slice(1)) { if (w === b + 1) b = w; else { runs.push([a, b]); a = b = w; } }
    runs.push([a, b]);
    return runs.map(([x, y]) => (x === y ? CL.fmtWeek(x) : CL.fmtWeek(x) + ' to ' + CL.fmtWeek(y))).join(', ');
  };
  const listNames = (arr) => (arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1]);

  let toastTimer;
  function toast(msg) {
    let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  /* ---------- Shell ---------- */
  const ICONS = {
    portfolio: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1.5" y="1.5" width="5" height="5" rx="1"/><rect x="9.5" y="1.5" width="5" height="5" rx="1"/><rect x="1.5" y="9.5" width="5" height="5" rx="1"/><rect x="9.5" y="9.5" width="5" height="5" rx="1" fill="currentColor"/></svg>',
    initiatives: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3.5h3M2 8h7M2 12.5h5"/><path d="M7 3.5h7M11 8h3M9 12.5h5" opacity=".45"/></svg>',
    groups: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 14V9M6 14V5M10 14V7M14 14V3"/></svg>',
    alerts: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 11V7a4 4 0 0 1 8 0v4l1.5 1.5h-11z"/><path d="M6.5 14h3"/></svg>',
    settings: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h12M2 8h12M2 12h12"/><circle cx="5" cy="4" r="1.6" fill="var(--surface)"/><circle cx="11" cy="8" r="1.6" fill="var(--surface)"/><circle cx="7" cy="12" r="1.6" fill="var(--surface)"/></svg>',
  };
  const LABELS = { portfolio: 'Portfolio', initiatives: 'Initiatives', groups: 'Groups', alerts: 'Alerts', settings: 'Settings' };

  function renderRail(loads) {
    const dig = CL.digest(state, loads);
    $('#nav').innerHTML = VIEWS.map((v) => `<button data-act="nav" data-v="${v}" ${ui.view === v ? 'aria-current="page"' : ''}>${ICONS[v]}<span class="lbl">${LABELS[v]}</span>${v === 'alerts' && dig.length ? `<span class="badge" title="Groups forecast at Red or Critical in the next 8 weeks">${dig.length}</span>` : ''}</button>`).join('');
    $('#company').textContent = state.company + ' · demo data';
  }

  function render() {
    const loads = CL.compute(state);
    renderRail(loads);
    const main = $('#main');
    if (ui.view === 'portfolio') main.innerHTML = viewPortfolio(loads);
    else if (ui.view === 'initiatives') main.innerHTML = ui.draft ? viewEditor() : viewInitiatives();
    else if (ui.view === 'groups') main.innerHTML = viewGroups(loads);
    else if (ui.view === 'alerts') main.innerHTML = viewAlerts(loads);
    else main.innerHTML = viewSettings();
    if (ui.view === 'initiatives' && ui.draft) refreshEditor();
  }

  /* ---------- Portfolio ---------- */
  function peakCell(loads) {
    let best = null;
    for (const g of state.groups) for (const c of loads[g.id].slice(0, CL.HORIZON)) if (!best || c.index > best.c.index + 0.5) best = { g, c };
    return best;
  }

  function heatHeader(from, to, withRowhead = true) {
    let months = '', days = '', m = -1, span = 0, label = '';
    const cells = [];
    for (let w = from; w < to; w++) {
      const d = CL.weekDate(w);
      if (d.getMonth() !== m) { if (span) cells.push([label, span]); m = d.getMonth(); span = 0; label = d.toLocaleString('en-GB', { month: 'short' }) + (d.getMonth() === 0 || w === from ? ' ' + d.getFullYear() : ''); }
      span++;
      days += `<th scope="col" title="Week of ${CL.fmtWeekLong(w)}">${d.getDate()}</th>`;
    }
    cells.push([label, span]);
    months = cells.map(([l, s]) => `<th colspan="${s}" class="m">${s > 1 ? esc(l) : ''}</th>`).join('');
    return `<thead><tr class="months">${withRowhead ? '<th class="rowhead"></th>' : ''}${months}</tr><tr>${withRowhead ? '<th class="rowhead"><span class="eyebrow">Week of</span></th>' : ''}${days}</tr></thead>`;
  }

  function guideFor(loads) {
    const dig = CL.digest(state, loads);
    const crit = dig.filter((r) => r.worst === 'critical');
    if (crit.length) {
      // Find the initiative whose move would fix the most: top driver with a feasible shift.
      const counts = {};
      for (const r of crit) for (const id of r.drivers.slice(0, 3)) counts[id] = (counts[id] || 0) + 1;
      const cand = Object.keys(counts).map(initById).filter((i) => i && i.status !== 'in_flight')
        .map((i) => ({ i, k: CL.suggestShift(state, i) })).filter((x) => x.k);
      const pick = cand.sort((a, b) => Math.abs(a.k) - Math.abs(b.k))[0];
      const weeks = [...new Set(crit.flatMap((r) => r.weeks.filter((w) => loads[r.group.id][w].zone === 'critical')))].sort((a, b) => a - b);
      return `<div class="guide"><p><strong>${esc(listNames(crit.map((r) => r.group.name)))} ${crit.length > 1 ? 'reach' : 'reaches'} Critical</strong> in the weeks of ${esc(weeksText(weeks.slice(0, 4)))}. Each initiative was approved on its own merits; together they land on the same people.${pick ? ` Open <strong>${esc(pick.i.name)}</strong> to see the pre-approval check and its suggested slot.` : ''}</p>
        ${pick ? `<button class="btn primary" data-act="edit" data-id="${pick.i.id}">Open ${esc(pick.i.name)}</button>` : ''}<button class="btn ghost" data-act="hide-guide">Hide</button></div>`;
    }
    return `<div class="guide"><p><strong>No group is forecast above ${dig.length ? 'Red' : 'Amber'}.</strong> Add an initiative to see the pre-approval check warn before it overwhelms anyone.</p><button class="btn primary" data-act="new-example">Try a new initiative</button><button class="btn ghost" data-act="hide-guide">Hide</button></div>`;
  }

  function viewPortfolio(loads) {
    const H = CL.HORIZON;
    const dig = CL.digest(state, loads);
    const pk = peakCell(loads);
    if (!ui.sel) ui.sel = { g: pk.g.id, w: pk.c.w };
    const active = state.initiatives.filter((i) => i.status !== 'done' && i.status !== 'idea');
    const goSoon = active.filter((i) => { const g = i.start + i.prepWeeks; return g < 8; }).length;
    const open = state.feed.filter((f) => f.kind === 'critical').length;
    const critCount = dig.filter((r) => r.worst === 'critical').length;

    const rows = state.groups.map((g) => `<tr><th class="rowhead" scope="row"><span class="g">${esc(g.name)}</span><span class="meta">${g.fte} FTE · ${esc(g.location)}</span></th>${loads[g.id].slice(0, H).map((c) => {
      const sel = ui.sel && ui.sel.g === g.id && ui.sel.w === c.w;
      return `<td><button class="hc ${cellClass(c)}${c.golive ? ' go' : ''}${c.w === 0 ? ' now' : ''}${sel ? ' sel' : ''}" data-act="cell" data-g="${g.id}" data-w="${c.w}" title="${esc(g.name)}, week of ${CL.fmtWeekLong(c.w)}: ${r0(c.index)} (${CL.ZONE_LABEL[c.zone]})" aria-label="${esc(g.name)} week of ${CL.fmtWeek(c.w)} load ${r0(c.index)} ${c.zone}">${r0(c.index)}</button></td>`;
    }).join('')}</tr>`).join('');

    const gantt = state.initiatives.filter((i) => i.status !== 'done').map((i) => {
      const end = CL.endWeek(i);
      let tds = '';
      for (let w = 0; w < H; w++) {
        const p = CL.phaseOf(i, w);
        tds += `<td class="bar-cell">${p ? `<span class="gseg ${p}${w === i.start ? ' first' : ''}${w === end - 1 ? ' last' : ''}" style="background:${color(i)}" title="${esc(i.name)}: ${CL.PHASE_LABEL[p]}"></span>` : ''}</td>`;
      }
      return `<tr><th class="rowhead" scope="row"><button data-act="edit" data-id="${i.id}" title="Open ${esc(i.name)}"><span class="swatch" style="background:${color(i)}"></span><span>${esc(i.name)}</span></button></th>${tds}</tr>`;
    }).join('');

    return `
      <div class="page-head"><div><div class="eyebrow">Portfolio · ${esc(state.company)}</div><h1>Change load by employee group</h1>
        <p class="lede">Every approved initiative's impact, combined week by week. A Load Index of 100 means the group is using all of its change capacity.</p></div>
        <div class="actions"><button class="btn" data-act="nav" data-v="alerts">Weekly digest</button><button class="btn primary" data-act="new">New initiative</button></div></div>
      ${ui.guide ? guideFor(loads) : ''}
      <div class="summary">
        <div><span class="eyebrow">At Red or Critical, next 8 weeks</span><span class="big ${critCount ? 'crit' : ''}">${dig.length}<span class="muted" style="font-size:1rem"> of ${state.groups.length} groups</span></span><span class="sub">${critCount ? `${critCount} at Critical` : 'None at Critical'}</span></div>
        <div><span class="eyebrow">Peak load</span><span class="big">${r0(pk.c.index)}</span><span class="sub">${esc(pk.g.name)}, week of ${CL.fmtWeek(pk.c.w)}</span></div>
        <div><span class="eyebrow">Initiatives in the plan</span><span class="big">${active.length}</span><span class="sub">${goSoon} go live in the next 8 weeks</span></div>
        <div><span class="eyebrow">People affected</span><span class="big">${state.groups.filter((g) => loads[g.id].slice(0, H).some((c) => c.n)).reduce((a, g) => a + g.fte, 0).toLocaleString('en-GB')}</span><span class="sub">${open ? `${open} escalation${open > 1 ? 's' : ''} to the transformation office` : 'across ' + state.groups.length + ' groups'}</span></div>
      </div>
      <div class="two-col">
        <div class="stack">
          <div class="heat-wrap"><table class="heat">${heatHeader(0, H)}<tbody>${rows}
            <tr class="sep"><th class="rowhead"></th><td colspan="${H}"></td></tr>
            <tr><th class="rowhead"><span class="eyebrow">Initiatives</span></th><td colspan="${H}"></td></tr>
          </tbody><tbody class="gantt">${gantt}</tbody></table></div>
          <div class="legend">
            <span><i class="swatch" style="background:var(--z-green)"></i>Green below ${state.settings.amber}</span>
            <span><i class="swatch" style="background:var(--z-amber)"></i>Amber ${state.settings.amber} to ${state.settings.red}</span>
            <span><i class="swatch" style="background:var(--z-red)"></i>Red ${state.settings.red} to ${state.settings.critical}</span>
            <span><i class="swatch" style="background:var(--z-crit)"></i>Critical above ${state.settings.critical}, or ${state.settings.criticalGoLives}+ go-lives in 2 weeks</span>
            <span><i class="swatch" style="background:var(--muted);border-radius:50%;width:6px;height:6px"></i>Go-live week</span>
            <span><i class="swatch" style="background:var(--i0);opacity:.35"></i>Prep</span><span><i class="swatch" style="background:var(--i0)"></i>Go-live</span><span><i class="swatch" style="background:var(--i0);opacity:.6"></i>Hypercare</span>
          </div>
        </div>
        ${cellDetail(loads)}
      </div>`;
  }

  function cellDetail(loads) {
    if (!ui.sel || !groupById(ui.sel.g)) return `<aside class="panel panel-pad detail"><p class="empty">Select a cell to see which initiatives load that group in that week.</p></aside>`;
    const g = groupById(ui.sel.g), c = loads[g.id][ui.sel.w], st = state.settings;
    const scale = Math.max(c.index, st.critical);
    const parts = [...c.parts].sort((a, b) => b.points - a.points);
    const sumW = c.parts.reduce((a, p) => a + p.weighted, 0);
    return `<aside class="panel panel-pad detail stack" aria-live="polite">
      <div class="hdr"><div><div class="eyebrow">${esc(g.name)} · week of ${CL.fmtWeekLong(c.w)}</div><div class="score">${r0(c.index)}</div></div>${zonePill(c.zone)}</div>
      <p class="muted" style="font-size:.82rem">${c.n ? `${c.n} initiative${c.n > 1 ? 's' : ''} active, ${c.hours.toFixed(1)} hours of change work per person this week against ${c.cap.toFixed(1)} hours of capacity.` : 'No initiative touches this group this week.'}</p>
      <div class="brk">
        ${parts.map((p) => { const i = initById(p.initId); return `<div class="brk-row"><span class="nm"><span class="swatch" style="background:${color(i)}"></span><span>${esc(i.name)}</span></span><span class="num">${r0(p.points)}</span><span class="bar"><i style="width:${(p.points / scale) * 100}%;background:${color(i)}"></i></span><span class="muted" style="font-size:.72rem;grid-column:1/-1">${CL.PHASE_LABEL[p.phase]} · ${p.effort.toFixed(1)} h per person</span></div>`; }).join('')}
        ${c.strain ? `<div class="brk-row"><span class="nm"><span class="swatch" style="background:var(--strain)"></span><span>Baseline strain${g.note ? ': ' + esc(g.note) : ''}</span></span><span class="num">${c.strain}</span><span class="bar"><i style="width:${(c.strain / scale) * 100}%;background:var(--strain)"></i></span></div>` : ''}
      </div>
      ${c.n ? `<div class="formula"><span>Weighted hours <span class="mono">${sumW.toFixed(2)}</span> ÷ capacity <span class="mono">${c.cap.toFixed(1)} h</span> × 100</span>
        <span>× concurrency <span class="mono">${c.mult.toFixed(2)}</span> for ${c.n} overlapping initiative${c.n > 1 ? 's' : ''}${c.golive > 1 ? ` and ${c.golive} go-lives` : ''}</span>
        ${c.strain ? `<span>+ baseline strain <span class="mono">${c.strain}</span></span>` : ''}
        ${c.golive2w >= st.criticalGoLives ? `<span><strong>${c.golive2w} go-lives within two weeks</strong> makes this Critical regardless of score.</span>` : ''}</div>` : ''}
      <div class="actions" style="justify-content:flex-start"><button class="btn" data-act="group" data-g="${g.id}">Open group view</button></div>
    </aside>`;
  }

  /* ---------- Initiatives ---------- */
  function viewInitiatives() {
    const rows = state.initiatives.map((i) => {
      const a = CL.assess(state, i);
      const counted = i.status !== 'done' && i.status !== 'idea';
      return `<tr class="click" data-act="edit" data-id="${i.id}" tabindex="0">
        <td><div class="name"><span class="swatch" style="background:${color(i)}"></span>${esc(i.name)}</div><div class="sub">${esc(i.unit)} · ${esc(i.owner)}</div></td>
        <td><span class="pill status">${STATUS[i.status]}</span></td>
        <td class="num">${CL.fmtWeek(i.start)}</td>
        <td class="num">${CL.fmtWeek(i.start + i.prepWeeks)}</td>
        <td class="r num">${new Set(i.impacts.map((x) => x.groupId)).size}</td>
        <td class="r num">${i.impacts.reduce((s, x) => s + (groupById(x.groupId)?.fte || 0) * x.pct / 100, 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}</td>
        <td>${a.groupIds.length ? zonePill(a.worst) : '<span class="muted">No impacts</span>'}${counted ? '' : ' <span class="sub">not in plan</span>'}</td>
      </tr>`;
    }).join('');
    return `<div class="page-head"><div><div class="eyebrow">Initiative register</div><h1>Initiatives</h1>
      <p class="lede">Every project that changes how people work, with the groups it touches. The last column is the highest zone any affected group reaches while the initiative runs.</p></div>
      <div class="actions"><button class="btn" data-act="new-example">New from example</button><button class="btn primary" data-act="new">New initiative</button></div></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Initiative</th><th>Status</th><th>Prep starts</th><th>Go-live</th><th class="r">Groups</th><th class="r">People</th><th>Peak zone while running</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function newDraft(example) {
    const used = new Set(state.initiatives.map((i) => i.color));
    let c = 0; while (used.has(c) && c < 7) c++;
    const base = { id: 'n' + Date.now().toString(36), name: '', unit: '', owner: '', sponsor: '', status: 'planned', color: c, start: 4, prepWeeks: 2, goLiveWeeks: 2, hypercareWeeks: 2, summary: '', impacts: [] };
    if (!example) return base;
    return { ...base, name: 'Mandatory conduct and data protection e-learning', unit: 'Compliance', owner: 'Tomáš Král', sponsor: 'Chief Risk Officer', status: 'idea',
      summary: 'Annual compliance modules for all staff, due before year end.', start: 4, prepWeeks: 1, goLiveWeeks: 2, hypercareWeeks: 1,
      impacts: state.groups.map((g) => ({ groupId: g.id, type: 'policy', intensity: 2, hours: 3, pct: 100 })) };
  }

  function viewEditor() {
    const d = ui.draft;
    const opt = (v, l, cur) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`;
    const weekOpts = Array.from({ length: CL.COMPUTE - 12 }, (_, w) => opt(w, 'Week of ' + CL.fmtWeekLong(w), d.start)).join('');
    const imp = d.impacts.map((x, k) => `<tr>
        <td><select class="cell-input" id="imp-g-${k}" data-imp="${k}" data-k="groupId" aria-label="Group">${state.groups.map((g) => opt(g.id, g.name, x.groupId)).join('')}</select></td>
        <td><select class="cell-input" id="imp-t-${k}" data-imp="${k}" data-k="type" aria-label="Impact type">${Object.entries(CL.IMPACT_TYPES).map(([v, t]) => opt(v, t.label, x.type)).join('')}</select></td>
        <td class="n"><select class="cell-input" id="imp-i-${k}" data-imp="${k}" data-k="intensity" aria-label="Intensity">${[1, 2, 3, 4, 5].map((n) => opt(n, n, x.intensity)).join('')}</select></td>
        <td class="n"><input class="cell-input" id="imp-h-${k}" type="number" min="0" step="0.5" data-imp="${k}" data-k="hours" value="${x.hours}" aria-label="Hours per person"></td>
        <td class="n"><input class="cell-input" id="imp-p-${k}" type="number" min="0" max="100" step="5" data-imp="${k}" data-k="pct" value="${x.pct}" aria-label="Percent of group affected"></td>
        <td class="x"><button class="btn ghost" data-act="imp-del" data-k="${k}" aria-label="Remove impact" title="Remove">×</button></td></tr>`).join('');
    const free = state.groups.filter((g) => !d.impacts.some((x) => x.groupId === g.id));
    return `<div class="page-head"><div><div class="eyebrow"><a href="#initiatives" data-act="cancel">Initiatives</a> / ${ui.isNew ? 'New' : 'Edit'}</div><h1>${esc(d.name || 'New initiative')}</h1>
      <p class="lede">The portfolio check on the right updates as you edit. Nothing changes in the heatmap until you save.</p></div></div>
      <div class="editor">
        <div class="panel panel-pad">
          <div class="form-section">
            <h2>About</h2>
            <div class="field"><label for="f-name">Name</label><input id="f-name" data-f="name" value="${esc(d.name)}" placeholder="For example: Payroll system upgrade"></div>
            <div class="grid2">
              <div class="field"><label for="f-unit">Business unit</label><input id="f-unit" data-f="unit" value="${esc(d.unit)}"></div>
              <div class="field"><label for="f-status">Status</label><select id="f-status" data-f="status">${Object.entries(STATUS).map(([v, l]) => opt(v, l, d.status)).join('')}</select><span class="hint">Ideas and done items are left out of the heatmap.</span></div>
              <div class="field"><label for="f-owner">Project manager</label><input id="f-owner" data-f="owner" value="${esc(d.owner)}"></div>
              <div class="field"><label for="f-sponsor">Sponsor</label><input id="f-sponsor" data-f="sponsor" value="${esc(d.sponsor)}"></div>
            </div>
            <div class="field"><label for="f-summary">What changes for people</label><textarea id="f-summary" data-f="summary">${esc(d.summary)}</textarea></div>
          </div>
          <div class="form-section">
            <h2>Timeline</h2>
            <div class="grid4">
              <div class="field" style="grid-column:span 2"><label for="f-start">Prep starts</label><select id="f-start" data-f="start" data-num="1">${weekOpts}</select></div>
              <div class="field"><label for="f-prep">Prep weeks</label><input id="f-prep" type="number" min="0" max="26" data-f="prepWeeks" data-num="1" value="${d.prepWeeks}"></div>
              <div class="field"><label for="f-go">Go-live weeks</label><input id="f-go" type="number" min="1" max="12" data-f="goLiveWeeks" data-num="1" value="${d.goLiveWeeks}"></div>
              <div class="field"><label for="f-hyp">Hypercare weeks</label><input id="f-hyp" type="number" min="0" max="26" data-f="hypercareWeeks" data-num="1" value="${d.hypercareWeeks}"></div>
            </div>
            <div id="tl-preview"></div>
          </div>
          <div class="form-section">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h2>Impact on employee groups</h2>
              ${free.length ? `<div class="actions"><button class="btn" data-act="imp-add">Add group</button>${free.length > 1 ? `<button class="btn ghost" data-act="imp-all">Add all groups</button>` : ''}</div>` : ''}</div>
            <p class="muted" style="font-size:.8rem">Intensity runs from 1 (awareness only) to 5 (core daily work changes). Hours are the total per person across prep, go-live and hypercare. Picking a type fills typical values.</p>
            ${d.impacts.length ? `<div class="impacts-wrap"><table class="impacts"><thead><tr><th>Group</th><th>Type</th><th>Intensity</th><th>Hours</th><th>% affected</th><th></th></tr></thead><tbody>${imp}</tbody></table></div>` : `<p class="empty">No groups yet. Add the groups whose work changes.</p>`}
          </div>
          <div class="form-section">
            <div class="actions" style="justify-content:space-between">
              ${ui.isNew ? '<span></span>' : ui.confirm === 'delete' ? `<span class="inline-confirm">Delete this initiative? <button class="btn danger" data-act="delete">Delete</button><button class="btn ghost" data-act="confirm-off">Keep</button></span>` : `<button class="btn ghost danger" data-act="confirm-delete">Delete initiative</button>`}
              <button class="btn" data-act="cancel">Cancel</button>
            </div>
          </div>
        </div>
        <aside class="panel whatif" id="whatif" aria-live="polite"></aside>
      </div>`;
  }

  function refreshEditor() {
    const d = ui.draft;
    const total = d.prepWeeks + d.goLiveWeeks + d.hypercareWeeks || 1;
    const seg = (p, n) => (n ? `<div style="flex:${n};background:${color(d)};opacity:${p === 'prep' ? .45 : p === 'golive' ? 1 : .7}">${CL.PHASE_LABEL[p]} ${n}w</div>` : '');
    const tl = $('#tl-preview');
    if (tl) tl.innerHTML = `<div class="phase-strip" aria-hidden="true">${seg('prep', d.prepWeeks)}${seg('golive', d.goLiveWeeks)}${seg('hypercare', d.hypercareWeeks)}</div>
      <p class="muted" style="font-size:.78rem;margin-top:6px">Go-live in the week of <strong>${CL.fmtWeekLong(d.start + d.prepWeeks)}</strong>, finished by ${CL.fmtWeekLong(d.start + total)}.</p>`;
    const h = $('h1'); if (h) h.textContent = d.name || 'New initiative';
    const box = $('#whatif'); if (box) box.innerHTML = whatIf();
  }

  function whatIf() {
    const d = ui.draft;
    if (!d.impacts.length) return `<div class="verdict green"><span class="eyebrow">Portfolio check</span><h2>Add affected groups to run the check</h2></div><section><p class="muted">The check compares the portfolio with and without this initiative for every group it touches.</p></section>`;
    const a = CL.assess(state, d);
    const st = state.settings;
    const names = (fn) => a.findings.filter(fn).map((f) => groupById(f.groupId).name);
    const hot = names((f) => CL.zoneRank(f.worstAfter) >= 2);
    const warm = names((f) => f.worstAfter === 'amber');
    const H = {
      critical: [`This plan overwhelms ${listNames(hot)}`, 'Saving routes a decision request to the sponsor and the transformation office.'],
      red: [`${listNames(hot)} would be overloaded`, 'Saving needs a justification. The leaders of the affected groups are notified.'],
      amber: [`${listNames(warm)} near capacity`, 'No action needed. Watch the rollout plan for these groups.'],
      green: ['Room for this change', 'Every affected group stays in Green while this runs.'],
    }[a.worst];
    const shift = CL.zoneRank(a.worst) >= 2 ? CL.suggestShift(state, d) : 0;
    const from = Math.max(0, d.start - 1), to = Math.min(CL.COMPUTE, CL.endWeek(d) + 1);
    let mini = '';
    for (const f of a.findings) {
      const g = groupById(f.groupId);
      const row = (L, lab) => `<tr><th scope="row">${lab}</th>${L[g.id].slice(from, to).map((c) => `<td><span class="hc ${cellClass(c)}" title="${CL.fmtWeek(c.w)}: ${r0(c.index)}">${r0(c.index)}</span></td>`).join('')}</tr>`;
      mini += `<tr><th colspan="${to - from + 1}" style="padding-top:6px;color:var(--ink);font-weight:650;font-size:.72rem">${esc(g.name)}</th></tr>${row(a.before, 'Without')}${row(a.after, 'With')}`;
    }
    const days = Array.from({ length: to - from }, (_, k) => `<th>${CL.weekDate(from + k).getDate()}</th>`).join('');
    const findings = a.findings.filter((f) => f.already.length || f.overwhelm.length || f.up.length).map((f) => {
      const g = groupById(f.groupId);
      const items = [];
      if (f.already.length) items.push(`Already overwhelmed without this initiative in the weeks of ${weeksText(f.already)}.`);
      if (f.overwhelm.length) items.push(`This initiative pushes them into Red or Critical in the weeks of ${weeksText(f.overwhelm)}.`);
      else if (f.up.length && !f.already.length) items.push(`Moves up a zone in the weeks of ${weeksText(f.up)}.`);
      return `<div class="finding"><div class="gname"><span>${esc(g.name)} <span class="muted" style="font-weight:400">peak ${r0(f.peakBefore)} → <span class="num">${r0(f.peakAfter)}</span></span></span>${zonePill(f.worstAfter)}</div><ul>${items.map((t) => `<li>${t}</li>`).join('')}</ul></div>`;
    }).join('');

    let suggest = '';
    if (shift === null) suggest = `<div class="suggest"><span class="eyebrow">Suggested slot</span><p>No start date within 16 weeks keeps every group below Red. Reduce scope instead: phase the rollout in waves or take groups out of this release.</p></div>`;
    else if (shift) {
      const ns = d.start + shift;
      suggest = `<div class="suggest"><span class="eyebrow">Suggested slot</span><strong>Start ${Math.abs(shift)} week${Math.abs(shift) > 1 ? 's' : ''} ${shift > 0 ? 'later' : 'earlier'}</strong>
        <p style="font-size:.84rem">Prep from ${CL.fmtWeekLong(ns)}, go-live in the week of ${CL.fmtWeekLong(ns + d.prepWeeks)}. Every affected group stays below Red while it runs.</p>
        <div class="actions" style="justify-content:flex-start"><button class="btn primary" data-act="apply-shift" data-k="${shift}">Apply suggested slot</button></div>
        <p class="muted" style="font-size:.76rem">Or reduce scope: phase the rollout or take groups out of this release.</p></div>`;
    }
    const needJust = a.worst === 'red' || a.worst === 'critical';
    const saveBox = `<section>
      ${needJust ? `<div class="field"><label for="f-note">${a.worst === 'critical' ? 'Decision request for the sponsor' : 'Justification for going ahead at Red'}</label><textarea id="f-note" data-note="1" placeholder="${a.worst === 'critical' ? 'Why this date matters and what support the affected groups will get' : 'Why this cannot move, and how the groups will be supported'}">${esc(ui.note)}</textarea><span class="hint">ChangeLoad warns and escalates. It never blocks a project.</span></div>` : ''}
      <div class="actions"><button class="btn ${a.worst === 'critical' ? 'crit' : 'primary'}" data-act="save" ${needJust && !ui.note.trim() ? 'disabled' : ''}>${a.worst === 'critical' ? 'Save and escalate' : a.worst === 'red' ? 'Save with justification' : 'Save initiative'}</button></div></section>`;

    return `<div class="verdict ${a.worst}"><span class="eyebrow">Portfolio check · ${CL.ZONE_LABEL[a.worst]}</span><h2>${esc(H[0])}</h2><p style="font-size:.84rem">${H[1]}</p></div>
      ${findings || suggest ? `<section>${findings}${suggest}</section>` : ''}
      <section><span class="eyebrow">Load Index without and with this initiative</span><div class="mini-wrap"><table class="mini"><thead><tr><th></th>${days}</tr></thead><tbody>${mini}</tbody></table></div>
        <p class="muted" style="font-size:.72rem">Weeks of ${CL.fmtWeek(from)} to ${CL.fmtWeek(to - 1)}. Thresholds ${st.amber}, ${st.red} and ${st.critical}.</p></section>
      ${saveBox}`;
  }

  function saveDraft() {
    const d = ui.draft;
    if (!d.name.trim()) { toast('Give the initiative a name before saving.'); $('#f-name')?.focus(); return; }
    const a = d.impacts.length ? CL.assess(state, d) : { worst: 'green', findings: [] };
    const prev = initById(d.id);
    const idx = state.initiatives.findIndex((i) => i.id === d.id);
    if (idx >= 0) state.initiatives[idx] = clone(d); else state.initiatives.push(clone(d));
    const hot = a.findings.filter((f) => CL.zoneRank(f.worstAfter) >= 2).map((f) => groupById(f.groupId).name);
    let text;
    if (a.worst === 'critical') text = `Escalated to the transformation office for a sponsor decision. ${listNames(hot)} reach Critical.`;
    else if (a.worst === 'red') text = `Saved at Red with a justification. Leaders of ${listNames(hot)} notified.`;
    else if (prev && prev.start !== d.start) text = `Rescheduled: prep now starts in the week of ${CL.fmtWeekLong(d.start)}. Peak zone for affected groups is ${CL.ZONE_LABEL[a.worst]}.`;
    else text = `${prev ? 'Updated' : 'Added'}. Peak zone for affected groups is ${CL.ZONE_LABEL[a.worst]}.`;
    state.feed.unshift({ ts: Date.now(), kind: a.worst === 'critical' || a.worst === 'red' ? a.worst : 'info', initId: d.id, name: d.name, text, note: ui.note.trim(), by: d.owner || 'Project manager' });
    save();
    ui.draft = null; ui.note = ''; ui.confirm = null; ui.sel = null;
    go('portfolio');
    toast(a.worst === 'critical' ? 'Saved and escalated. Heatmap updated.' : 'Saved. Heatmap updated.');
  }

  /* ---------- Groups ---------- */
  function groupChart(g, loads) {
    const st = state.settings, H = CL.HORIZON;
    const cells = loads[g.id].slice(0, H);
    const peak = Math.max(...cells.map((c) => c.index));
    const yMax = Math.max(st.critical + 30, Math.ceil((peak + 10) / 20) * 20);
    const W = 920, Ht = 300, L = 40, R = 86, T = 12, B = 30;
    const iw = W - L - R, ih = Ht - T - B, step = iw / H, bw = step * 0.68;
    const y = (v) => T + ih - (v / yMax) * ih;
    let s = '';
    for (let v = 0; v <= yMax; v += 20) s += `<line x1="${L}" x2="${L + iw}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="${v === 0 ? 1 : .6}"/>${v % 40 === 0 ? `<text x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${v}</text>` : ''}`;
    cells.forEach((c, w) => {
      const x = L + w * step + (step - bw) / 2;
      let acc = 0;
      const stack = [];
      if (c.strain) stack.push(['var(--strain)', c.strain, 'Baseline strain']);
      for (const p of c.parts) stack.push([color(initById(p.initId)), p.points, initById(p.initId).name + ' (' + CL.PHASE_LABEL[p.phase] + ')']);
      for (const [col, v, lab] of stack) {
        s += `<rect x="${x.toFixed(1)}" y="${y(acc + v).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, y(acc) - y(acc + v)).toFixed(1)}" fill="${col}"><title>${esc(lab)}: ${r0(v)}</title></rect>`;
        acc += v;
      }
      if (c.index >= st.red || c.zone === 'critical') s += `<text x="${(x + bw / 2).toFixed(1)}" y="${(y(c.index) - 4).toFixed(1)}" text-anchor="middle" style="fill:var(--ink);font-weight:600">${r0(c.index)}</text>`;
      if (w % 2 === 0) s += `<text x="${(x + bw / 2).toFixed(1)}" y="${Ht - 10}" text-anchor="middle">${CL.fmtWeek(w)}</text>`;
    });
    for (const [k, col] of [['amber', 'var(--z-amber)'], ['red', 'var(--z-red)'], ['critical', 'var(--z-crit)']]) {
      s += `<line x1="${L}" x2="${L + iw}" y1="${y(st[k])}" y2="${y(st[k])}" stroke="${col}" stroke-width="1.5" stroke-dasharray="5 4"/><text class="tl" x="${L + iw + 8}" y="${y(st[k]) + 3.5}" style="fill:${col}">${CL.ZONE_LABEL[k]} ${st[k]}</text>`;
    }
    return `<svg viewBox="0 0 ${W} ${Ht}" role="img" aria-label="Weekly Load Index for ${esc(g.name)}, stacked by initiative">${s}</svg>`;
  }

  function viewGroups(loads) {
    if (!groupById(ui.group)) ui.group = state.groups[0].id;
    const g = groupById(ui.group), st = state.settings;
    const cells = loads[g.id].slice(0, CL.HORIZON);
    const pk = cells.reduce((a, c) => (c.index > a.index ? c : a), cells[0]);
    const redWeeks = cells.filter((c) => CL.zoneRank(c.zone) >= 2).length;
    const cap = st.contractHours * ((g.capacityPct ?? st.capacityPct) / 100);
    const touching = state.initiatives.filter((i) => i.impacts.some((x) => x.groupId === g.id));
    const used = new Set(cells.flatMap((c) => c.parts.map((p) => p.initId)));
    const rows = touching.flatMap((i) => i.impacts.filter((x) => x.groupId === g.id).map((x) => `<tr><td><div class="name"><span class="swatch" style="background:${color(i)}"></span>${esc(i.name)}</div><div class="sub">${STATUS[i.status]}</div></td><td>${CL.IMPACT_TYPES[x.type].label}</td><td class="r num">${x.intensity}</td><td class="r num">${x.hours}</td><td class="r num">${x.pct}%</td><td class="num">${CL.fmtWeek(i.start)} to ${CL.fmtWeek(CL.endWeek(i) - 1)}</td></tr>`)).join('');
    return `<div class="page-head"><div><div class="eyebrow">Group view</div><h1>${esc(g.name)}</h1><p class="lede">${esc(g.unit)} · ${esc(g.location)}${g.note ? ' · ' + esc(g.note) : ''}</p></div></div>
      <div class="grp-pick" role="group" aria-label="Choose a group">${state.groups.map((x) => { const z = loads[x.id].slice(0, CL.HORIZON).reduce((a, c) => (CL.zoneRank(c.zone) > CL.zoneRank(a) ? c.zone : a), 'green'); return `<button data-act="group" data-g="${x.id}" aria-pressed="${x.id === g.id}"><span class="swatch" style="background:var(--z-${z === 'critical' ? 'crit' : z})"></span>${esc(x.name)}</button>`; }).join('')}</div>
      <div class="panel panel-pad stack">
        <div class="facts">
          <div><span class="v">${g.fte}</span><span class="k">FTE</span></div>
          <div><span class="v">${cap.toFixed(1)} h</span><span class="k">Change capacity per person per week</span></div>
          <div><span class="v">${g.strain || 0}</span><span class="k">Baseline strain</span></div>
          <div><span class="v">${r0(pk.index)}</span><span class="k">Peak, week of ${CL.fmtWeek(pk.w)}</span></div>
          <div><span class="v">${redWeeks}</span><span class="k">Weeks at Red or Critical</span></div>
        </div>
        <div class="chart chart-wrap">${groupChart(g, loads)}</div>
        <div class="legend">${g.strain ? '<span><i class="swatch" style="background:var(--strain)"></i>Baseline strain</span>' : ''}${touching.filter((i) => used.has(i.id)).map((i) => `<span><i class="swatch" style="background:${color(i)}"></i>${esc(i.name)}</span>`).join('')}</div>
      </div>
      <h2>Impacts on this group</h2>
      ${rows ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Initiative</th><th>Type</th><th class="r">Intensity</th><th class="r">Hours</th><th class="r">Affected</th><th>Runs</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="empty">No initiative touches this group.</p>'}`;
  }

  /* ---------- Alerts ---------- */
  function viewAlerts(loads) {
    const dig = CL.digest(state, loads);
    const digest = dig.length ? dig.map((r) => `<div class="feed-item"><span class="stripe ${r.worst}"></span>
        <div style="display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap"><strong>${esc(r.group.name)}</strong>${zonePill(r.worst)}</div>
        <span>Forecast at Red or Critical in the weeks of ${weeksText(r.weeks)}. Peak ${r0(r.peak.index)} in the week of ${CL.fmtWeek(r.peak.w)}.</span>
        <span class="muted" style="font-size:.82rem">Driven by ${esc(listNames(r.drivers.slice(0, 3).map((id) => initById(id).name)))}.</span></div>`).join('')
      : '<p class="empty">No group is forecast at Red or Critical in the next 8 weeks.</p>';
    const fmt = (ts) => new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const feed = state.feed.length ? state.feed.map((f) => `<div class="feed-item"><span class="stripe ${f.kind}"></span>
        <div style="display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap"><strong>${esc(f.name)}</strong><span class="when">${fmt(f.ts)} · ${esc(f.by)}</span></div>
        <span>${esc(f.text)}</span>${f.note ? `<blockquote>${esc(f.note)}</blockquote>` : ''}</div>`).join('')
      : '<p class="empty" style="margin:16px">Nothing yet. Saving an initiative records it here, and saves at Red or Critical carry the justification or decision request.</p>';
    return `<div class="page-head"><div><div class="eyebrow">Alerts</div><h1>Weekly digest</h1><p class="lede">Groups forecast to reach Red or Critical in the next 8 weeks, from ${CL.fmtWeekLong(0)}, and the initiatives driving it. In a live deployment this goes out by email and Teams.</p></div></div>
      <div class="panel feed">${digest}</div>
      <h2>Escalations and decisions</h2>
      <div class="panel feed">${feed}</div>`;
  }

  /* ---------- Settings ---------- */
  function viewSettings() {
    const st = state.settings;
    const num = (id, path, v, lab, hint = '', step = 1) => `<div class="field"><label for="${id}">${lab}</label><input id="${id}" type="number" step="${step}" data-set="${path}" value="${v}">${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
    const splitSum = st.split.prep + st.split.golive + st.split.hypercare;
    const grows = state.groups.map((g) => `<tr><td><strong>${esc(g.name)}</strong><div class="sub">${esc(g.unit)}</div></td>
      <td class="n"><input class="cell-input" type="number" id="g-fte-${g.id}" data-gset="${g.id}" data-k="fte" value="${g.fte}" aria-label="FTE"></td>
      <td class="n"><input class="cell-input" type="number" id="g-cap-${g.id}" data-gset="${g.id}" data-k="capacityPct" value="${g.capacityPct ?? ''}" placeholder="${st.capacityPct}" aria-label="Capacity percent"></td>
      <td class="n"><input class="cell-input" type="number" min="0" max="40" id="g-str-${g.id}" data-gset="${g.id}" data-k="strain" value="${g.strain || 0}" aria-label="Baseline strain"></td></tr>`).join('');
    return `<div class="page-head"><div><div class="eyebrow">Settings</div><h1>Thresholds and scoring</h1><p class="lede">Changes apply at once to the heatmap and every check. Defaults follow the product definition.</p></div>
        <div class="actions">${ui.confirm === 'reset' ? `<span class="inline-confirm">Replace everything with the original demo data? <button class="btn danger" data-act="reset">Reset</button><button class="btn ghost" data-act="confirm-off">Keep my changes</button></span>` : `<button class="btn" data-act="confirm-reset">Reset demo data</button>`}</div></div>
      <div class="settings-grid">
        <div class="panel panel-pad stack"><h2>Zones</h2>${num('s-amber', 'amber', st.amber, 'Amber from')}${num('s-red', 'red', st.red, 'Red from')}${num('s-crit', 'critical', st.critical, 'Critical from')}${num('s-cgl', 'criticalGoLives', st.criticalGoLives, 'Go-lives in 2 weeks that make it Critical')}</div>
        <div class="panel panel-pad stack"><h2>Capacity</h2>${num('s-cap', 'capacityPct', st.capacityPct, 'Change capacity, % of contracted hours', 'Default for every group unless set below')}${num('s-hrs', 'contractHours', st.contractHours, 'Contracted hours per week')}
          <p class="muted" style="font-size:.8rem">That is ${(st.contractHours * st.capacityPct / 100).toFixed(1)} hours of change per person per week.</p></div>
        <div class="panel panel-pad stack"><h2>Intensity weights</h2>${[1, 2, 3, 4, 5].map((n) => num('s-int' + n, 'intensity.' + n, st.intensity[n], `Intensity ${n}`, '', 0.1)).join('')}</div>
        <div class="panel panel-pad stack"><h2>Load shape</h2>${num('s-sp', 'split.prep', st.split.prep, 'Share of hours in prep, %')}${num('s-sg', 'split.golive', st.split.golive, 'Share in go-live, %')}${num('s-sh', 'split.hypercare', st.split.hypercare, 'Share in hypercare, %', splitSum !== 100 ? `Shares add up to ${splitSum}%, not 100%.` : '')}
          ${num('s-conc', 'concurrency', st.concurrency, 'Concurrency penalty per extra initiative', '', 0.01)}${num('s-glp', 'goLivePenalty', st.goLivePenalty, 'Extra penalty per overlapping go-live', '', 0.01)}</div>
      </div>
      <h2>Employee groups</h2>
      <div class="tbl-wrap"><table class="tbl impacts" style="min-width:520px"><thead><tr><th>Group</th><th>FTE</th><th>Capacity %</th><th>Baseline strain (0 to 40)</th></tr></thead><tbody>${grows}</tbody></table></div>`;
  }

  /* ---------- Navigation and events ---------- */
  function go(v) {
    ui.view = v; ui.confirm = null;
    if (v !== 'initiatives') ui.draft = null;
    try { history.replaceState(null, '', '#' + v); } catch (e) { /* ignore */ }
    render();
    window.scrollTo(0, 0);
  }
  function edit(id, draft) {
    ui.draft = draft || clone(initById(id)); ui.isNew = !!draft; ui.note = ''; ui.confirm = null;
    ui.view = 'initiatives';
    try { history.replaceState(null, '', '#initiatives'); } catch (e) { /* ignore */ }
    render(); window.scrollTo(0, 0);
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const act = t.dataset.act;
    if (t.tagName === 'A') e.preventDefault();
    const d = ui.draft;
    switch (act) {
      case 'nav': go(t.dataset.v); break;
      case 'cell': ui.sel = { g: t.dataset.g, w: +t.dataset.w }; render(); break;
      case 'group': ui.group = t.dataset.g; go('groups'); break;
      case 'edit': edit(t.dataset.id); break;
      case 'new': edit(null, newDraft(false)); break;
      case 'new-example': edit(null, newDraft(true)); break;
      case 'hide-guide': ui.guide = false; render(); break;
      case 'cancel': ui.draft = null; go('initiatives'); break;
      case 'imp-add': { const free = state.groups.find((g) => !d.impacts.some((x) => x.groupId === g.id)); if (free) d.impacts.push({ groupId: free.id, type: 'process', intensity: 3, hours: 4, pct: 100 }); render(); break; }
      case 'imp-all': for (const g of state.groups) if (!d.impacts.some((x) => x.groupId === g.id)) d.impacts.push({ groupId: g.id, type: 'process', intensity: 3, hours: 4, pct: 100 }); render(); break;
      case 'imp-del': d.impacts.splice(+t.dataset.k, 1); render(); break;
      case 'apply-shift': { d.start += +t.dataset.k; render(); toast(`Prep now starts in the week of ${CL.fmtWeekLong(d.start)}. Save to update the heatmap.`); break; }
      case 'save': saveDraft(); break;
      case 'confirm-delete': ui.confirm = 'delete'; render(); break;
      case 'confirm-reset': ui.confirm = 'reset'; render(); break;
      case 'confirm-off': ui.confirm = null; render(); break;
      case 'delete': state.initiatives = state.initiatives.filter((i) => i.id !== d.id); save(); ui.draft = null; ui.sel = null; go('initiatives'); toast('Initiative deleted.'); break;
      case 'reset': state = SEED(); save(); ui.sel = null; ui.guide = true; ui.confirm = null; render(); toast('Demo data restored.'); break;
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('tr[data-act]')) e.target.click();
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    const d = ui.draft;
    if (t.dataset.f && d) {
      d[t.dataset.f] = t.dataset.num ? Math.max(0, parseInt(t.value, 10) || 0) : t.value;
      if (t.dataset.f === 'goLiveWeeks') d.goLiveWeeks = Math.max(1, d.goLiveWeeks);
      refreshEditor();
    } else if (t.dataset.imp && d) {
      const x = d.impacts[+t.dataset.imp], k = t.dataset.k;
      if (k === 'groupId') x.groupId = t.value;
      else if (k === 'type') { x.type = t.value; x.intensity = CL.IMPACT_TYPES[t.value].intensity; x.hours = CL.IMPACT_TYPES[t.value].hours; render(); return; }
      else x[k] = Math.max(0, parseFloat(t.value) || 0);
      if (k === 'pct') x.pct = Math.min(100, x.pct);
      if (k === 'intensity') x.intensity = Math.min(5, Math.max(1, x.intensity));
      refreshEditor();
    } else if (t.dataset.note) {
      ui.note = t.value;
      const b = $('[data-act="save"]'); if (b && b.textContent !== 'Save initiative') b.disabled = !ui.note.trim();
    } else if (t.dataset.set) {
      const v = parseFloat(t.value); if (!isFinite(v)) return;
      const [a, b] = t.dataset.set.split('.');
      if (b) state.settings[a][b] = v; else state.settings[a] = v;
      save(); renderRail(CL.compute(state));
    } else if (t.dataset.gset) {
      const g = groupById(t.dataset.gset), k = t.dataset.k;
      if (k === 'capacityPct' && t.value === '') delete g.capacityPct;
      else { const v = parseFloat(t.value); if (!isFinite(v)) return; g[k] = k === 'strain' ? Math.min(40, Math.max(0, v)) : v; }
      save(); renderRail(CL.compute(state));
    }
  });

  const fromHash = () => { const h = location.hash.slice(1); if (VIEWS.includes(h)) { ui.view = h; ui.draft = null; } };
  window.addEventListener('hashchange', () => { fromHash(); render(); });
  fromHash();
  render();
})();
