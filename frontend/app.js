const money = (value) => `₹ ${Number(value).toLocaleString('en-IN')}`;
const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const state = { issues: [], overview: null, category: 'All', query: '', store: '', severity: '', sort: 'impact', selectedId: null };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function fallbackData() {
  return [
    { id:'DO-2048',title:'Tomato wastage is 3.8× above baseline',product:'Local tomatoes · 1 kg',category:'Wastage',store:'Indiranagar',store_code:'BLR-04',impact:8420,units:'38 kg wasted',severity:'High',status:'Investigating',age:'18 min ago',icon:'🍅',color:'coral',summary:'Wastage climbed while sales stayed near the four-week average. Stock cover is nearly twice the target.',signal:'38 kg discarded this week, versus a 10 kg four-week baseline.',evidence:[{label:'Purchase volume',value:'+42%',note:'vs. prior 4-week average',direction:'bad'},{label:'Sales volume',value:'+6%',note:'vs. prior 4-week average',direction:'good'},{label:'Days of cover',value:'4.6 days',note:'target is 2.5 days',direction:'bad'}],hypotheses:[{name:'Over-ordering relative to demand',score:88,detail:'Purchases rose much faster than sales; remaining stock is above target.'},{name:'Supplier quality issue',score:34,detail:'No matching increase in quality complaints for this supplier.'}],recommendation:'Reduce the next order by 20% and review the par level after the next delivery.',verification:{before:38,after:11,unit:'kg wasted',period:'7 days',source:'Simulated follow-up period'}},
    { id:'DO-2047',title:'Expiry exposure building in dairy',product:'Farm fresh milk · 500 ml',category:'Expiry risk',store:'Koramangala',store_code:'BLR-02',impact:5260,units:'64 units at risk',severity:'High',status:'Action needed',age:'42 min ago',icon:'🥛',color:'blue',summary:'64 units enter their final 48 hours with current sell-through too low to clear stock.',signal:'₹5,260 at cost is likely to expire in the next 48 hours.',evidence:[{label:'Near-expiry units',value:'64',note:'within 48 hours',direction:'bad'},{label:'Daily sell-through',value:'21 units',note:'7-day average',direction:'neutral'},{label:'Stock cover',value:'3.0 days',note:'expiry window is 2 days',direction:'bad'}],hypotheses:[{name:'Order quantity exceeded sell-through',score:81,detail:'Current order cover is higher than the recent demand window.'},{name:'Delivery arrived with short shelf life',score:52,detail:'Shelf-life-on-arrival data is incomplete for this delivery.'}],recommendation:'Prioritize first-expiry stock and lower the next replenishment quantity for two cycles.',verification:{before:64,after:19,unit:'units at risk',period:'7 days',source:'Simulated follow-up period'}},
    { id:'DO-2046',title:'Stock count differs from expected',product:'Aashirvaad atta · 5 kg',category:'Stock variance',store:'HSR Layout',store_code:'BLR-01',impact:3180,units:'−12 units variance',severity:'Medium',status:'Review',age:'1 hr ago',icon:'🌾',color:'gold',summary:'Cycle count found fewer bags than the inventory ledger predicts; recent picks explain part of the gap.',signal:'12 units missing after matching completed orders and recorded adjustments.',evidence:[{label:'Expected on hand',value:'47',note:'inventory ledger',direction:'neutral'},{label:'Counted on hand',value:'35',note:'cycle count · 09:10',direction:'bad'},{label:'Unmatched picks',value:'3',note:'in the last 24 hours',direction:'bad'}],hypotheses:[{name:'Unrecorded stock movement',score:73,detail:'Three recent pick events do not have a matching adjustment.'},{name:'Receiving count error',score:41,detail:'One delivery receipt was edited after initial confirmation.'}],recommendation:'Recount the aisle and reconcile the three unmatched pick events before adjusting stock.',verification:{before:12,after:2,unit:'units variance',period:'7 days',source:'Simulated follow-up period'}},
    { id:'DO-2045',title:'Return rate spiked for packaged greens',product:'Baby spinach · 100 g',category:'Returns',store:'Indiranagar',store_code:'BLR-04',impact:2460,units:'8.4% return rate',severity:'Medium',status:'Investigating',age:'2 hrs ago',icon:'🥬',color:'green',summary:'Returns cite wilting and damaged seals; the spike is concentrated in one supplier batch.',signal:'Return rate rose from 2.1% to 8.4% across the last 7 days.',evidence:[{label:'Return rate',value:'8.4%',note:'baseline is 2.1%',direction:'bad'},{label:'Batch share',value:'71%',note:'of returns share one lot',direction:'bad'},{label:'Top reason',value:'Wilting',note:'5 of 11 returns',direction:'neutral'}],hypotheses:[{name:'Supplier batch quality',score:76,detail:'Most returns trace to lot SP-884 from one delivery.'},{name:'Cold-chain handling',score:49,detail:'Temperature logs have a 6-hour gap on delivery day.'}],recommendation:'Hold the lot for a quality check and inspect the next delivery on receipt.',verification:{before:8.4,after:3.2,unit:'% return rate',period:'7 days',source:'Simulated follow-up period'}},
    { id:'DO-2044',title:'Prepared meals nearing expiry',product:'Paneer tikka wrap · 1 pc',category:'Expiry risk',store:'Whitefield',store_code:'BLR-03',impact:1840,units:'23 units at risk',severity:'Low',status:'Monitoring',age:'3 hrs ago',icon:'🥡',color:'purple',summary:'A late-afternoon demand dip left more ready-to-eat meals than the expiry window can clear.',signal:'23 units reach expiry today; expected sell-through is 15 units.',evidence:[{label:'Units expiring today',value:'23',note:'current stock',direction:'bad'},{label:'Expected sales',value:'15',note:'based on 14-day average',direction:'neutral'},{label:'Likely excess',value:'8 units',note:'estimated from recent demand',direction:'bad'}],hypotheses:[{name:'Prep forecast too high',score:69,detail:'Forecast was above observed late-day demand on four of five weekdays.'},{name:'Demand shifted by weekday',score:45,detail:'Weekend demand is higher; weekday baseline may need a separate setting.'}],recommendation:'Reduce weekday prep by 10% and review the evening sell-through after one week.',verification:{before:23,after:9,unit:'units at risk',period:'7 days',source:'Simulated follow-up period'}}
  ];
}

async function request(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${response.status})`);
  }
  return response.json();
}

async function loadData() {
  try {
    const [issues, overview] = await Promise.all([request('/api/issues'), request('/api/overview')]);
    state.issues = issues;
    state.overview = overview;
    updateMetrics(overview);
  } catch (error) {
    state.issues = fallbackData();
    showToast('Showing sample data. Start the API for interactive actions.');
  }
  renderIssues();
  renderStores();
}

function updateMetrics(data) {
  if (!data) return;
  const filtered = state.store ? state.issues.filter((issue) => issue.store === state.store) : state.issues;
  const loss = filtered.reduce((sum, issue) => sum + Number(issue.impact || 0), 0);
  $('#loss-value').textContent = money(loss);
  $('#cases-value').innerHTML = `${String(filtered.filter((issue) => issue.status !== 'Verified').length).padStart(2, '0')} <small>cases</small>`;
  $('#nav-count').textContent = String(filtered.filter((issue) => issue.status !== 'Verified').length).padStart(2, '0');
  $('#waste-rate-value').innerHTML = `${Number(data.metrics?.waste_rate || 0).toFixed(1)}<small>%</small>`;
  $('#expiry-value').textContent = money(data.metrics?.expiry_at_risk || 0);
  $('.expiry-chip').textContent = `${Number(data.metrics?.expiry_units || 0)} units`;
  $('.progress-fill').style.width = `${Math.min(100, Number(data.metrics?.waste_rate || 0) / 5 * 100)}%`;
  $('.progress-caption span:last-child').textContent = `Target < 2.5% · 5% scale`;
  renderTrend(data.weekly_loss || []);
}

function renderTrend(points) {
  if (!points.length) return;
  const svg = $('#loss-chart');
  const values = points.map((point) => Number(point.value || 0));
  const maxValue = Math.max(...values, 1);
  const ceiling = Math.ceil(maxValue / 2) * 2 || 2;
  const coords = values.map((value, index) => ({ x: index * (700 / Math.max(1, values.length - 1)), y: 166 - value / ceiling * 137 }));
  const path = coords.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const area = `${path} L700 205 L0 205 Z`;
  $('.chart-area', svg).setAttribute('d', area);
  $('.chart-stroke', svg).setAttribute('d', path);
  const last = coords.at(-1);
  $('.chart-point', svg).setAttribute('cx', last.x);
  $('.chart-point', svg).setAttribute('cy', last.y);
  $$('.chart-x span').forEach((label, index) => { label.textContent = index === points.length - 1 ? 'Today' : points[index]?.day || ''; });
  const ticks = $$('.chart-y span');
  ticks.forEach((label, index) => { label.textContent = `₹${Math.round(ceiling * (ticks.length - 1 - index) / (ticks.length - 1))}k`; });
  $('.avg-line span').textContent = `Avg. ₹${(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)}k`;
  const monthEstimate = values.reduce((sum, value) => sum + value, 0) * 4.3;
  $('.chart-total').innerHTML = `${money(monthEstimate * 1000)} <small>estimated monthly run rate</small>`;
}

function filteredIssues() {
  let rows = state.issues.filter((issue) => {
    const categoryMatch = state.category === 'All' || issue.category === state.category;
    const storeMatch = !state.store || issue.store === state.store;
    const severityMatch = !state.severity || issue.severity === state.severity;
    const haystack = `${issue.id} ${issue.title} ${issue.product} ${issue.store} ${issue.category}`.toLowerCase();
    return categoryMatch && storeMatch && severityMatch && haystack.includes(state.query.toLowerCase());
  });
  rows = [...rows].sort((a, b) => state.sort === 'recent' ? a.id.localeCompare(b.id) : b.impact - a.impact);
  return rows;
}

function renderIssues() {
  const rows = filteredIssues();
  const body = $('#issues-body');
  body.innerHTML = rows.map((issue) => {
    const storeInitial = issue.store.charAt(0);
    const slug = issue.status.toLowerCase().replace(/\s+/g, '-');
    return `<tr data-issue="${esc(issue.id)}" tabindex="0" aria-label="Open ${esc(issue.title)}">
      <td><input type="checkbox" aria-label="Select ${esc(issue.id)}" class="row-select" /></td>
      <td><div class="issue-cell"><span class="issue-icon ${esc(issue.color)}">${esc(issue.icon || iconFor(issue.category))}</span><span class="issue-copy"><strong>${esc(issue.title)}</strong><span>${esc(issue.id)} <span aria-hidden="true">·</span> ${esc(issue.product)}</span></span></div></td>
      <td><span class="store-cell"><span class="table-store-dot">${esc(storeInitial)}</span>${esc(issue.store)}</span></td>
      <td class="impact-value">${money(issue.impact)}<small>${esc(issue.units)}</small></td>
      <td><span class="priority ${esc(issue.severity.toLowerCase())}"><i></i>${esc(issue.severity)}</span></td>
      <td><span class="status-pill ${slug}">${esc(issue.status)}</span></td>
      <td>${esc(issue.age || 'Just now')}</td><td><button class="row-more" aria-label="Open ${esc(issue.id)}">···</button></td>
    </tr>`;
  }).join('');
  $('#empty-state').classList.toggle('hidden', rows.length !== 0);
  $('#results-label').innerHTML = rows.length ? `Showing <b>1–${rows.length}</b> of <b>${rows.length}</b> investigations` : 'Showing <b>0</b> investigations';
  $('#queue-count').textContent = rows.length;
  const activeTab = $(`.queue-tab[data-category="${CSS.escape(state.category)}"]`);
  if (activeTab) {
    $$('.queue-tab').forEach((tab) => tab.classList.toggle('active', tab === activeTab));
  }
  $('#filter-count').classList.toggle('hidden', !state.severity && !state.store);
  $('#filter-count').textContent = String(Number(Boolean(state.severity)) + Number(Boolean(state.store)));
  updateMetrics(state.overview);
}

function iconFor(category) {
  return ({ 'Wastage': '♨', 'Expiry risk': '◷', 'Stock variance': '▤', 'Returns': '↶' })[category] || '◈';
}

function renderStores() {
  if (!state.overview?.stores) return;
  const stores = state.overview.stores;
  const container = $('#store-list');
  if (state.store && !stores.length) {
    container.innerHTML = '<div class="empty-state"><strong>No store data</strong></div>';
    return;
  }
  const max = Math.max(...stores.map((store) => store.waste), 5);
  container.innerHTML = stores.map((store) => {
    const initialClass = ({ 'HSR Layout': 'initial-rose', Koramangala: 'initial-lilac', Whitefield: 'initial-blue', Indiranagar: 'initial-green' })[store.name] || 'initial-green';
    const trendClass = store.change > 0 ? 'up' : 'down';
    const barClass = store.waste >= 4 ? 'bar-high' : store.waste >= 3.3 ? 'bar-warn' : '';
    return `<div class="store-row"><div class="store-initial ${initialClass}">${esc(store.name.charAt(0))}</div><div class="store-name"><strong>${esc(store.name)}</strong><span>${esc(store.code)}</span></div><div class="store-rate"><strong>${Number(store.waste).toFixed(1)}%</strong><span class="trend ${trendClass} tiny">${store.change > 0 ? '↑' : '↓'} ${Math.abs(store.change).toFixed(1)}%</span></div><div class="store-bar"><i class="${barClass}" style="width:${Math.min(100, (store.waste / max) * 100)}%"></i></div></div>`;
  }).join('');
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function drawerMarkup(issue) {
  const evidence = (issue.evidence || []).map((item) => `<div class="evidence-card"><span>${esc(item.label)}</span><strong class="${item.direction === 'bad' ? 'bad' : item.direction === 'good' ? 'good' : ''}">${esc(item.value)}</strong><small>${esc(item.note)}</small></div>`).join('');
  const hypotheses = (issue.hypotheses || []).map((item) => `<div class="hypothesis"><div class="hypothesis-top"><span>${esc(item.name)}</span><span class="hypothesis-score">${esc(item.score)} signal</span></div><div class="hypothesis-bar"><i style="width:${Math.max(0, Math.min(100, Number(item.score)))}%"></i></div><p>${esc(item.detail)}</p></div>`).join('');
  const recorded = issue.action_record ? `<div class="action-recorded"><strong>✓ Action recorded · ${esc(issue.action_record.owner)}</strong><p>${esc(issue.action_record.action)}</p></div>` : '';
  let verify = '';
  if (issue.action_record) {
    if (issue.verified_at) {
      verify = `<div class="verification-result"><strong>✓ Simulated check complete</strong><p>${esc(issue.verification.source)} · ${esc(issue.verified_at)}</p><div class="verification-numbers">${esc(issue.verification.before)} <span>${esc(issue.verification.unit)} →</span> ${esc(issue.verification.after)} <span>after ${esc(issue.verification.period)}</span></div></div>`;
    } else {
      verify = `<div class="verification-card"><div class="verification-icon">↻</div><div class="verification-copy"><strong>Check the result</strong><span>Compare with a simulated ${esc(issue.verification.period)} follow-up.</span></div><button class="button button-light" data-verify="${esc(issue.id)}">Simulate +7 days</button></div>`;
    }
  } else {
    verify = '<div class="verification-card"><div class="verification-icon">↻</div><div class="verification-copy"><strong>Verification follows action</strong><span>Record a simulated action to unlock the follow-up check.</span></div></div>';
  }
  return `<div class="drawer-label">${esc(issue.category.toUpperCase())} · ${esc(issue.id)}</div>
    <div class="drawer-title-row"><span class="issue-icon ${esc(issue.color)}">${esc(issue.icon || iconFor(issue.category))}</span><div><h2>${esc(issue.title)}</h2><p>${esc(issue.product)}</p></div></div>
    <div class="drawer-meta"><span class="status-pill ${issue.status.toLowerCase().replace(/\s+/g, '-')}">${esc(issue.status)}</span><span class="meta-sep"></span><span class="drawer-store"><i class="table-store-dot">${esc(issue.store.charAt(0))}</i>${esc(issue.store)} · ${esc(issue.store_code)}</span><span class="meta-sep"></span><span>${esc(issue.age || 'Just now')}</span></div>
    <div class="drawer-loss-card"><div><span>Estimated loss identified</span><strong>${money(issue.impact)}</strong></div><small>${esc(issue.units)}<br/>at current cost</small></div>
    <section class="drawer-section"><div class="drawer-section-head"><h3>Why this was flagged</h3><span>Rule-based signal</span></div><div class="signal-box">${esc(issue.signal || issue.summary)}</div></section>
    <section class="drawer-section"><div class="drawer-section-head"><h3>Supporting evidence</h3><span>Calculated from generated records</span></div><div class="evidence-grid">${evidence}</div><div class="evidence-sources"><span>DATA SOURCES</span>${(issue.evidence_refs || []).map((source) => `<code>${esc(source)}</code>`).join('')}</div></section>
    <section class="drawer-section"><div class="drawer-section-head"><h3>Likely root causes</h3><span>Ranked by evidence fit</span></div>${hypotheses}</section>
    <section class="drawer-section"><div class="recommendation"><div class="recommendation-label"><span>✳</span> SUGGESTED NEXT STEP</div><p>${esc(issue.recommendation || 'Review the supporting evidence and decide on the next operational action.')}</p></div>${recorded}<button class="button ${issue.action_record ? 'button-light secondary' : 'button-dark'} drawer-action" id="record-action" data-action="${esc(issue.id)}" ${issue.action_record ? 'disabled' : ''}>${issue.action_record ? '✓ Action recorded' : 'Record simulated action'} <span>→</span></button></section>
    <section class="drawer-section"><div class="drawer-section-head"><h3>Outcome verification</h3><span>SIMULATED</span></div>${verify}</section>
    <p class="source-note">Demo data · Estimates are calculated from synthetic records. The root-cause ranking is a transparent prototype signal, not a calibrated probability. Simulated follow-up does not establish that an action caused the observed change.</p>`;
}

async function openIssue(id) {
  let issue = state.issues.find((item) => item.id === id);
  try { issue = await request(`/api/issues/${encodeURIComponent(id)}`); } catch { /* use cached synthetic fixture */ }
  if (!issue) return;
  const index = state.issues.findIndex((item) => item.id === id);
  if (index >= 0) state.issues[index] = issue;
  state.selectedId = id;
  $('#drawer-id').textContent = id;
  $('#drawer-content').innerHTML = drawerMarkup(issue);
  $('#detail-drawer').classList.add('open');
  $('#detail-drawer').setAttribute('aria-hidden', 'false');
  $('#drawer-backdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  $('#detail-drawer').classList.remove('open');
  $('#detail-drawer').setAttribute('aria-hidden', 'true');
  $('#drawer-backdrop').classList.remove('open');
  document.body.style.overflow = '';
  state.selectedId = null;
}

async function recordAction(id) {
  const issue = state.issues.find((item) => item.id === id);
  if (!issue) return;
  try {
    await request(`/api/issues/${encodeURIComponent(id)}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: issue.recommendation, owner: 'Store manager' }) });
    showToast('Simulated action recorded for this case.');
  } catch (error) {
    issue.action_record = { action: issue.recommendation, owner: 'Store manager', simulated: true };
    issue.status = 'Action recorded';
    showToast('Action saved in this demo session.');
  }
  await refreshSelected(id);
}

async function verifyIssue(id) {
  try {
    await request(`/api/issues/${encodeURIComponent(id)}/verify`, { method: 'POST' });
    showToast('Simulated follow-up period complete.');
  } catch (error) {
    const issue = state.issues.find((item) => item.id === id);
    if (issue) { issue.status = 'Verified'; issue.verified_at = new Date().toISOString().slice(0, 10); }
    showToast('Follow-up result simulated for this session.');
  }
  await refreshSelected(id);
}

async function refreshSelected(id) {
  try {
    const [issues, overview] = await Promise.all([request('/api/issues'), request('/api/overview')]);
    state.issues = issues;
    state.overview = overview;
  } catch { /* local fixture is already updated */ }
  renderIssues();
  openIssue(id);
}

function downloadReport() {
  const columns = ['ID', 'Issue', 'Store', 'Category', 'Estimated impact (INR)', 'Priority', 'Status'];
  const rows = filteredIssues().map((i) => [i.id, i.title, i.store, i.category, i.impact, i.severity, i.status]);
  const csv = [columns, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = `darkops-investigations-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Investigation report exported.');
}

function setCategory(category) {
  state.category = category;
  $$('.queue-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.category === category));
  renderIssues();
}

function toggleSeverityFilter() {
  const existing = $('#severity-popover');
  if (existing) { existing.remove(); return; }
  const button = $('#filter-button');
  const pop = document.createElement('div');
  pop.id = 'severity-popover';
  pop.className = 'filter-popover';
  pop.innerHTML = `<strong>Priority</strong>${['', 'High', 'Medium', 'Low'].map((value) => `<button type="button" data-severity="${value}">${value || 'All priorities'} ${state.severity === value ? '✓' : ''}</button>`).join('')}<span>Store filter follows the selector above.</span>`;
  button.parentElement.style.position = 'relative';
  button.parentElement.append(pop);
}

function setupEvents() {
  $$('.queue-tab').forEach((tab) => tab.addEventListener('click', () => setCategory(tab.dataset.category)));
  $('#issues-body').addEventListener('click', (event) => {
    if (event.target.closest('input[type="checkbox"]')) { event.stopPropagation(); return; }
    const row = event.target.closest('[data-issue]');
    if (row) openIssue(row.dataset.issue);
  });
  $('#issues-body').addEventListener('keydown', (event) => { if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('tr[data-issue]')) openIssue(event.target.dataset.issue); });
  $('#drawer-close').addEventListener('click', closeDrawer);
  $('#drawer-backdrop').addEventListener('click', closeDrawer);
  $('#drawer-content').addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]');
    const verify = event.target.closest('[data-verify]');
    if (action && !action.disabled) recordAction(action.dataset.action);
    if (verify) verifyIssue(verify.dataset.verify);
  });
  $('#search-input').addEventListener('input', (event) => { state.query = event.target.value.trim(); renderIssues(); });
  $('#store-filter').addEventListener('change', async (event) => {
    state.store = event.target.value;
    try {
      const storeParam = state.store ? `?store=${encodeURIComponent(state.store)}` : '';
      state.overview = await request(`/api/overview${storeParam}`);
    } catch { /* filters work against loaded demo rows */ }
    renderIssues(); renderStores();
  });
  $('#export-button').addEventListener('click', downloadReport);
  $('#filter-button').addEventListener('click', toggleSeverityFilter);
  document.addEventListener('click', (event) => {
    const filter = event.target.closest('[data-severity]');
    if (filter) { state.severity = filter.dataset.severity; $('#severity-popover')?.remove(); renderIssues(); }
    else if (!event.target.closest('#filter-button') && !event.target.closest('#severity-popover')) $('#severity-popover')?.remove();
  });
  $('#sort-button').addEventListener('click', () => {
    state.sort = state.sort === 'impact' ? 'recent' : 'impact';
    $('#sort-button').innerHTML = `Sort: <strong>${state.sort === 'impact' ? 'Highest impact' : 'Most recent'}</strong><span>⌄</span>`;
    renderIssues();
  });
  $('#select-all').addEventListener('change', (event) => $$('.row-select').forEach((input) => { input.checked = event.target.checked; }));
  $('#clear-filters').addEventListener('click', () => { state.query = ''; state.category = 'All'; state.severity = ''; state.store = ''; $('#search-input').value = ''; $('#store-filter').value = ''; setCategory('All'); });
  $('.banner-close').addEventListener('click', () => $('.insight-banner').remove());
  $('#notification-button').addEventListener('click', () => showToast('You’re all caught up.'));
  $('#new-investigation').addEventListener('click', () => showToast('New issue intake is planned for the next milestone.'));
  $$('.period-toggle button').forEach((button) => button.addEventListener('click', () => {
    $$('.period-toggle button').forEach((item) => item.classList.toggle('active', item === button));
    showToast(button.dataset.period === '30d' ? 'Showing the 30-day summary view.' : 'Showing the 7-day summary view.');
  }));
  $$('.nav-item').forEach((item) => item.addEventListener('click', (event) => {
    const target = item.dataset.nav;
    if (target !== 'overview' && target !== 'investigations') { event.preventDefault(); showToast(`${item.textContent.trim()} is coming in the next milestone.`); return; }
    $$('.nav-item').forEach((nav) => nav.classList.toggle('active', nav === item));
    $('#breadcrumb-current').textContent = target === 'overview' ? 'Overview' : 'Investigations';
    if (target === 'investigations') document.querySelector('#investigations').scrollIntoView({ behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeDrawer(); $('#severity-popover')?.remove(); } });
}

setupEvents();
loadData();
