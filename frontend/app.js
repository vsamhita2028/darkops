const money = (value) => `₹ ${Number(value).toLocaleString('en-IN')}`;
const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const state = { issues: [], overview: null, category: 'All', query: '', store: '', severity: '', sort: 'impact', selectedId: null };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let googleSignInInitialized = false;

function fallbackData() {
  return [
    { id:'DO-2048',title:'Tomato wastage is 3.8× above baseline',product:'Local tomatoes · 1 kg',category:'Wastage',store:'Indiranagar',store_code:'BLR-04',impact:8420,units:'38 kg wasted',severity:'High',status:'Investigating',age:'18 min ago',icon:'🍅',color:'coral',summary:'Wastage climbed while sales stayed near the four-week average. Stock cover is nearly twice the target.',signal:'38 kg discarded this week, versus a 10 kg four-week baseline.',evidence:[{label:'Purchase volume',value:'+42%',note:'vs. prior 4-week average',direction:'bad'},{label:'Sales volume',value:'+6%',note:'vs. prior 4-week average',direction:'good'},{label:'Days of cover',value:'4.6 days',note:'target is 2.5 days',direction:'bad'}],hypotheses:[{name:'Over-ordering relative to demand',score:88,detail:'Purchases rose much faster than sales; remaining stock is above target.'},{name:'Supplier quality issue',score:34,detail:'No matching increase in quality complaints for this supplier.'}],recommendation:'Reduce the next order by 20% and review the par level after the next delivery.',verification:{before:38,after:11,unit:'kg wasted',period:'7 days',source:'Simulated follow-up period'}},
    { id:'DO-2047',title:'Expiry exposure building in dairy',product:'Farm fresh milk · 500 ml',category:'Expiry risk',store:'Koramangala',store_code:'BLR-02',impact:5260,units:'64 units at risk',severity:'High',status:'Action needed',age:'42 min ago',icon:'🥛',color:'blue',summary:'64 units enter their final 48 hours with current sell-through too low to clear stock.',signal:'₹5,260 at cost is likely to expire in the next 48 hours.',evidence:[{label:'Near-expiry units',value:'64',note:'within 48 hours',direction:'bad'},{label:'Daily sell-through',value:'21 units',note:'7-day average',direction:'neutral'},{label:'Stock cover',value:'3.0 days',note:'expiry window is 2 days',direction:'bad'}],hypotheses:[{name:'Order quantity exceeded sell-through',score:81,detail:'Current order cover is higher than the recent demand window.'},{name:'Delivery arrived with short shelf life',score:52,detail:'Shelf-life-on-arrival data is incomplete for this delivery.'}],recommendation:'Prioritize first-expiry stock and lower the next replenishment quantity for two cycles.',verification:{before:64,after:19,unit:'units at risk',period:'7 days',source:'Simulated follow-up period'}},
    { id:'DO-2046',title:'Stock count differs from expected',product:'Aashirvaad atta · 5 kg',category:'Stock variance',store:'HSR Layout',store_code:'BLR-01',impact:3180,units:'−12 units variance',severity:'Medium',status:'Review',age:'1 hr ago',icon:'🌾',color:'gold',summary:'Cycle count found fewer bags than the inventory ledger predicts; recent picks explain part of the gap.',signal:'12 units missing after matching completed orders and recorded adjustments.',evidence:[{label:'Expected on hand',value:'47',note:'inventory ledger',direction:'neutral'},{label:'Counted on hand',value:'35',note:'cycle count · 09:10',direction:'bad'},{label:'Unmatched picks',value:'3',note:'in the last 24 hours',direction:'bad'}],hypotheses:[{name:'Unrecorded stock movement',score:73,detail:'Three recent pick events do not have a matching adjustment.'},{name:'Receiving count error',score:41,detail:'One delivery receipt was edited after initial confirmation.'}],recommendation:'Recount the aisle and reconcile the three unmatched pick events before adjusting stock.',verification:{before:12,after:2,unit:'units variance',period:'7 days',source:'Simulated follow-up period'}},
    { id:'DO-2045',title:'Return rate spiked for packaged greens',product:'Baby spinach · 100 g',category:'Returns',store:'Indiranagar',store_code:'BLR-04',impact:2460,units:'8.4% return rate',severity:'Medium',status:'Investigating',age:'2 hrs ago',icon:'🥬',color:'green',summary:'Returns cite wilting and damaged seals; the spike is concentrated in one supplier batch.',signal:'Return rate rose from 2.1% to 8.4% across the last 7 days.',evidence:[{label:'Return rate',value:'8.4%',note:'baseline is 2.1%',direction:'bad'},{label:'Batch share',value:'71%',note:'of returns share one lot',direction:'bad'},{label:'Top reason',value:'Wilting',note:'5 of 11 returns',direction:'neutral'}],hypotheses:[{name:'Supplier batch quality',score:76,detail:'Most returns trace to lot SP-884 from one delivery.'},{name:'Cold-chain handling',score:49,detail:'Temperature logs have a 6-hour gap on delivery day.'}],recommendation:'Hold the lot for a quality check and inspect the next delivery on receipt.',verification:{before:8.4,after:3.2,unit:'% return rate',period:'7 days',source:'Simulated follow-up period'}},
    { id:'DO-2044',title:'Prepared meals nearing expiry',product:'Paneer tikka wrap · 1 pc',category:'Expiry risk',store:'Whitefield',store_code:'BLR-03',impact:1840,units:'23 units at risk',severity:'Low',status:'Monitoring',age:'3 hrs ago',icon:'🥡',color:'purple',summary:'A late-afternoon demand dip left more ready-to-eat meals than the expiry window can clear.',signal:'23 units reach expiry today; expected sell-through is 15 units.',evidence:[{label:'Units expiring today',value:'23',note:'current stock',direction:'bad'},{label:'Expected sales',value:'15',note:'based on 14-day average',direction:'neutral'},{label:'Likely excess',value:'8 units',note:'estimated from recent demand',direction:'bad'}],hypotheses:[{name:'Prep forecast too high',score:69,detail:'Forecast was above observed late-day demand on four of five weekdays.'},{name:'Demand shifted by weekday',score:45,detail:'Weekend demand is higher; weekday baseline may need a separate setting.'}],recommendation:'Reduce weekday prep by 10% and review the evening sell-through after one week.',verification:{before:23,after:9,unit:'units at risk',period:'7 days',source:'Simulated follow-up period'}}
  ];
}

async function request(path, options = {}) {
  const response = await fetch(path, { ...options, credentials: 'same-origin' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (response.status === 401 && path !== '/api/auth/session' && path !== '/api/auth/logout' && path !== '/api/profile' && path !== '/api/issues' && path !== '/api/overview') {
      showAuthGate(body.detail || 'Please sign in with Google to continue.');
    }
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
  await loadForensics();
  loadCloudStatus();
}

function renderSignedInUI(profile) {
  state.authenticated = true;
  const name = profile.display_name || 'Google User';
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'GU';

  // Sidebar profile
  const sidebarAvatar = $('#sidebar-avatar');
  if (sidebarAvatar) {
    sidebarAvatar.textContent = initials;
    sidebarAvatar.classList.remove('signed-out');
  }
  const sidebarName = $('#sidebar-name');
  if (sidebarName) sidebarName.textContent = name;
  const sidebarEmail = $('#sidebar-email');
  if (sidebarEmail) sidebarEmail.textContent = profile.email || 'Google Account';
  const profileBtn = $('#profile-button');
  if (profileBtn) profileBtn.classList.remove('is-signed-out');

  // Greeting
  const greeting = $('#greeting-name');
  if (greeting) greeting.textContent = name;

  // Topbar
  const topAvatar = $('#top-avatar');
  if (topAvatar) topAvatar.textContent = initials;

  const authPill = $('#auth-status-pill');
  if (authPill) {
    authPill.className = 'auth-pill signed-in';
    const authText = $('#auth-status-text');
    if (authText) authText.textContent = 'Signed in';
  }

  // Toggle buttons
  const signoutBtn = $('#sign-out-button');
  if (signoutBtn) signoutBtn.hidden = false;
  const signinBtn = $('#sign-in-button');
  if (signinBtn) signinBtn.hidden = true;
  const topbarSigninBtn = $('#topbar-signin-btn');
  if (topbarSigninBtn) topbarSigninBtn.hidden = true;

  // Hide signed-out banner
  const banner = $('#signed-out-banner');
  if (banner) banner.hidden = true;
}

function renderSignedOutUI() {
  state.authenticated = false;

  // Sidebar profile
  const sidebarAvatar = $('#sidebar-avatar');
  if (sidebarAvatar) {
    sidebarAvatar.textContent = '👤';
    sidebarAvatar.classList.add('signed-out');
  }
  const sidebarName = $('#sidebar-name');
  if (sidebarName) sidebarName.textContent = 'Signed Out';
  const sidebarEmail = $('#sidebar-email');
  if (sidebarEmail) sidebarEmail.textContent = 'Guest mode · Click to sign in';
  const profileBtn = $('#profile-button');
  if (profileBtn) profileBtn.classList.add('is-signed-out');

  // Greeting
  const greeting = $('#greeting-name');
  if (greeting) greeting.textContent = 'Guest';

  // Topbar
  const topAvatar = $('#top-avatar');
  if (topAvatar) topAvatar.textContent = '—';

  const authPill = $('#auth-status-pill');
  if (authPill) {
    authPill.className = 'auth-pill signed-out';
    const authText = $('#auth-status-text');
    if (authText) authText.textContent = 'Signed out';
  }

  // Toggle buttons
  const signoutBtn = $('#sign-out-button');
  if (signoutBtn) signoutBtn.hidden = true;
  const signinBtn = $('#sign-in-button');
  if (signinBtn) signinBtn.hidden = false;
  const topbarSigninBtn = $('#topbar-signin-btn');
  if (topbarSigninBtn) topbarSigninBtn.hidden = false;

  // Show signed-out banner
  const banner = $('#signed-out-banner');
  if (banner) banner.hidden = false;
}

function showAuthGate(message = '', isSignedOut = false) {
  const gate = $('#auth-gate');
  if (gate) gate.hidden = false;
  const title = $('#auth-title');
  const desc = $('#auth-desc');
  const status = $('#auth-status');

  if (isSignedOut) {
    if (title) title.textContent = 'You are signed out';
    if (desc) desc.textContent = 'You have signed out of DarkOps. Sign in with Google to resume full cluster operations, or continue viewing in guest mode.';
    if (status) status.textContent = message || 'Signed out successfully.';
  } else {
    if (title) title.textContent = 'Sign in to continue';
    if (desc) desc.textContent = 'Use your Google account to open the workspace. Your Google profile name will appear automatically after sign-in.';
    if (status && message) status.textContent = message;
  }
}

function hideAuthGate() {
  const gate = $('#auth-gate');
  if (gate) gate.hidden = true;
}

async function handleSignOut() {
  try {
    await request('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    console.warn('Logout request failed:', err);
  }
  renderSignedOutUI();
  showToast('✓ Signed out successfully.');
  showAuthGate('Signed out successfully. Sign in with Google to resume.', true);
  initializeGoogleSignIn();
}

async function handleDevSignIn() {
  try {
    const profile = await request('/api/auth/login', { method: 'POST' });
    renderSignedInUI(profile);
    hideAuthGate();
    showToast('Signed in as Operations Lead.');
  } catch (err) {
    showToast(`Sign in error: ${err.message}`);
  }
}

function setupAuthEvents() {
  $('#sign-out-button')?.addEventListener('click', handleSignOut);
  $('#sign-in-button')?.addEventListener('click', () => {
    showAuthGate('Please sign in to continue.');
    initializeGoogleSignIn();
  });
  $('#topbar-signin-btn')?.addEventListener('click', () => {
    showAuthGate('Please sign in to continue.');
    initializeGoogleSignIn();
  });
  $('#banner-signin-btn')?.addEventListener('click', () => {
    showAuthGate('Please sign in to continue.');
    initializeGoogleSignIn();
  });
  $('#profile-button')?.addEventListener('click', () => {
    if (!state.authenticated) {
      showAuthGate('Please sign in to continue.');
      initializeGoogleSignIn();
    }
  });
  $('#auth-gate-close')?.addEventListener('click', hideAuthGate);
  $('#guest-continue-button')?.addEventListener('click', hideAuthGate);
  $('#dev-signin-button')?.addEventListener('click', handleDevSignIn);
}

async function startAuthenticatedApp() {
  setupAuthEvents();
  try {
    const profile = await request('/api/profile');
    if (profile && profile.authenticated) {
      renderSignedInUI(profile);
      hideAuthGate();
      await loadData();
      return;
    }
  } catch (error) {
    console.warn('Profile fetch unauthenticated:', error);
  }

  // Not authenticated or explicitly signed out
  renderSignedOutUI();
  hideAuthGate();
  await loadData();
  initializeGoogleSignIn();
}

async function initializeGoogleSignIn() {
  if (googleSignInInitialized) return;
  googleSignInInitialized = true;
  try {
    const { client_id: clientId } = await request('/api/auth/config');
    if (!clientId) {
      $('#dev-signin-container')?.removeAttribute('hidden');
      $('#auth-status').textContent = 'Local development mode (Google OAuth not configured).';
      return;
    }
    $('#dev-signin-container')?.setAttribute('hidden', '');

    const continueSetup = () => {
      if (!window.google?.accounts?.id) {
        $('#auth-status').textContent = 'Google sign-in could not load. Refresh and try again.';
        return;
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          if (!credential) {
            showAuthGate('Google did not return a sign-in credential. Please try again.');
            return;
          }
          $('#auth-status').textContent = 'Signing you in…';
          try {
            const profile = await request('/api/auth/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential }),
            });
            renderSignedInUI(profile);
            hideAuthGate();
            showToast('Signed in with Google.');
            await loadData();
          } catch (error) {
            showAuthGate(error.message || 'Google sign-in could not be verified. Please try again.');
          }
        },
        auto_select: false,
        use_fedcm_for_prompt: true,
      });
      window.google.accounts.id.renderButton($('#google-signin-button'), {
        type: 'standard', theme: 'outline', size: 'medium', text: 'signin_with',
        shape: 'rectangular', logo_alignment: 'left', width: 260,
      });
    };

    if (window.google?.accounts?.id) return continueSetup();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = continueSetup;
    script.onerror = () => { $('#auth-status').textContent = 'Google sign-in could not load. Check your connection and refresh.'; };
    document.head.appendChild(script);
  } catch (error) {
    $('#auth-status').textContent = error.message || 'Google sign-in is unavailable.';
  }
}

async function loadCloudStatus() {
  try {
    const status = await request('/api/cloud/status');
    const badge = $('#gcp-pill');
    if (status.project_id) {
      const activeServices = [status.bigquery?.active_data_backend === 'bigquery' ? 'BigQuery' : null,
        status.firestore?.configured ? 'Firestore' : null,
        status.vertex_ai?.configured ? 'Vertex AI' : null].filter(Boolean);
      badge.textContent = `GCP · ${activeServices.join(' · ') || status.project_id}`;
      badge.classList.add('connected');
      badge.title = `Operations data: ${status.bigquery?.active_data_backend || 'CSV'}; case workflow: ${status.firestore?.configured ? 'Firestore' : 'in memory'}; Gemini model: ${status.vertex_ai.model} (runs on request).`;
    }
  } catch { /* local demo can run without Google Cloud credentials */ }
}

function updateMetrics(data) {
  if (!data) return;
  const sourceName = data.source === 'bigquery' ? 'BigQuery' : 'local CSV';
  $('#metric-source-note').textContent = `Sample operations data · ${sourceName}; case metrics use investigations, waste and expiry use operations tables`;
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
    return `<div class="store-row" data-store-name="${esc(store.name)}" style="cursor:pointer;" title="Click to view all store telemetry and metrics"><div class="store-initial ${initialClass}">${esc(store.name.charAt(0))}</div><div class="store-name"><strong>${esc(store.name)}</strong><span>${esc(store.code)}</span></div><div class="store-rate"><strong>${Number(store.waste).toFixed(1)}%</strong><span class="trend ${trendClass} tiny">${store.change > 0 ? '↑' : '↓'} ${Math.abs(store.change).toFixed(1)}%</span></div><div class="store-bar"><i class="${barClass}" style="width:${Math.min(100, (store.waste / max) * 100)}%"></i></div></div>`;
  }).join('');
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function renderDrawerForensics(f) {
  if (!f) return '';
  const isAbuse = f.is_duplicate_photo || (f.defect_type && f.defect_type.includes('Abuse'));
  const pillClass = isAbuse ? 'abuse' : (f.defect_type || '').toLowerCase().includes('rot') ? 'rot' : (f.defect_type || '').toLowerCase().includes('melt') ? 'melt' : (f.defect_type || '').toLowerCase().includes('crush') ? 'crushed' : (f.defect_type || '').toLowerCase().includes('expire') ? 'expired' : 'clean';
  return `<div class="forensics-result-panel" style="padding:11px; margin-top:8px;">
    <div class="forensics-result-header" style="padding-bottom:8px;">
      <div>
        <span class="defect-pill ${pillClass}">● ${esc(f.defect_type)}</span>
        <div style="font-size:8px; color:#859087; margin-top:3px;">Severity: <b>${esc(f.severity)}</b> · ${esc(f.engine || 'Gemini 2.5 Flash')}</div>
      </div>
      <div class="confidence-box">
        <strong style="color:${f.confidence >= 0.8 ? '#2e6b3b' : '#ba7818'};">${Math.round(f.confidence * 100)}%</strong>
        <span>Confidence</span>
      </div>
    </div>
    <div class="forensics-meta-tags" style="margin-top:6px;">
      ${f.batch_code_ocr ? `<span class="meta-tag ocr">🏷️ <strong>Batch OCR:</strong> ${esc(f.batch_code_ocr)}</span>` : ''}
      ${f.expiry_date_ocr ? `<span class="meta-tag">📅 <strong>Expiry:</strong> ${esc(f.expiry_date_ocr)}</span>` : ''}
      ${isAbuse ? `<span class="meta-tag fraud-flag">🚨 <strong>Vector Similarity:</strong> ${esc(f.duplicate_similarity_score)}% (${esc(f.duplicate_matched_id)})</span>` : ''}
    </div>
    <div class="reasoning-box" style="margin-top:6px; font-size:8.5px;">
      <h4>Forensic Findings</h4>
      <p style="margin:0 0 4px;">${esc(f.visual_evidence)}</p>
      <p style="margin:0; color:#3b483f;"><strong>Assessment:</strong> ${esc(f.forensic_assessment)}</p>
    </div>
    <div class="action-guardrail-box" style="margin-top:6px; font-size:8.5px;">
      <strong>🛡️ Guardrail Recommendation</strong>
      <p>${esc(f.action_recommendation)}</p>
    </div>
  </div>`;
}

function drawerMarkup(issue) {
  const evidence = (issue.evidence || []).map((item) => `<div class="evidence-card"><span>${esc(item.label)}</span><strong class="${item.direction === 'bad' ? 'bad' : item.direction === 'good' ? 'good' : ''}">${esc(item.value)}</strong><small>${esc(item.note)}</small></div>`).join('');
  const hypotheses = (issue.hypotheses || []).map((item) => `<div class="hypothesis"><div class="hypothesis-top"><span>${esc(item.name)}</span><span class="hypothesis-score">${esc(item.score)} signal</span></div><div class="hypothesis-bar"><i style="width:${Math.max(0, Math.min(100, Number(item.score)))}%"></i></div><p>${esc(item.detail)}</p></div>`).join('');
  const recorded = issue.action_record ? `<div class="action-recorded"><strong>✓ Action recorded · ${esc(issue.action_record.owner)}</strong><p>${esc(issue.action_record.action)}</p></div>` : '';
  const aiResult = issue.gemini_investigation ? `<div class="ai-result"><h4>Gemini investigation · ${esc(issue.gemini_investigation.model || 'Vertex AI')}</h4><p><strong>Likely cause:</strong> ${esc(issue.gemini_investigation.likely_root_cause)}</p><p>${esc(issue.gemini_investigation.explanation)}</p><strong>Recommended actions</strong><ul>${(issue.gemini_investigation.recommended_actions || []).map((item) => `<li>${esc(item)}</li>`).join('')}</ul>${issue.gemini_investigation.evidence_gaps?.length ? `<p><strong>Evidence gaps:</strong> ${issue.gemini_investigation.evidence_gaps.map(esc).join('; ')}</p>` : ''}</div>` : '';
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
    
    <section class="drawer-section">
      <div class="drawer-section-head"><h3>${issue.complaint_photo ? 'Customer complaint &amp; photo evidence' : 'Investigation report'}</h3><span>${issue.complaint_photo ? 'FORENSICS' : 'INTAKE'}</span></div>
      ${issue.complaint_photo ? `<div style="background:#fff; border:1px solid #e7ede5; border-radius:8px; overflow:hidden; margin-bottom:8px;">
        <div style="position:relative; height:180px; background:#1c2620; display:flex; align-items:center; justify-content:center;">
          <img src="${esc(issue.complaint_photo)}" style="width:100%; height:100%; object-fit:cover;" alt="Complaint photo" />
          <span style="position:absolute; bottom:8px; left:8px; background:rgba(0,0,0,0.75); color:#fff; font-size:8px; font-weight:600; padding:3px 7px; border-radius:4px;">
            ${esc(issue.scenario || 'Customer Refund Ticket')}
          </span>
        </div>
        <div style="padding:10px 12px; font-size:9.5px; color:#4a574e; border-top:1px solid #eef2ec; line-height:1.45;">
          <strong style="color:#28332a; display:block; margin-bottom:2px;">Customer note:</strong> "${esc(issue.complaint_text || issue.signal)}"
        </div>
      </div>` : `<div class="signal-box">${esc(issue.complaint_text || issue.signal || issue.summary)}</div>`}
      ${issue.complaint_photo ? (issue.forensics ? renderDrawerForensics(issue.forensics) : `
        <button class="button button-light" style="width:100%; justify-content:center; gap:6px; font-size:9px;" data-run-forensics="${esc(issue.id)}">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#4285F4"/></svg>
          Run Gemini Multimodal Forensic Analysis
        </button>
      `) : ''}
    </section>

    <section class="drawer-section"><div class="drawer-section-head"><h3>Why this was flagged</h3><span>Rule-based signal</span></div><div class="signal-box">${esc(issue.signal || issue.summary)}</div></section>
    <section class="drawer-section"><div class="drawer-section-head"><h3>Supporting evidence</h3><span>Calculated from generated records</span></div><div class="evidence-grid">${evidence}</div><div class="evidence-sources"><span>DATA SOURCES</span>${(issue.evidence_refs || []).map((source) => `<code>${esc(source)}</code>`).join('')}</div></section>
    <section class="drawer-section"><div class="drawer-section-head"><h3>Likely root causes</h3><span>Ranked by evidence fit</span></div>${hypotheses}<button class="button button-light drawer-action" id="run-gemini" data-investigate="${esc(issue.id)}">✳ Analyze with Gemini</button><p class="ai-note">Sends this case’s synthetic evidence to Vertex AI. Model usage may incur Google Cloud charges.</p>${aiResult}</section>
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
    showToast(error.message);
    return;
  }
  await refreshSelected(id);
}

async function verifyIssue(id) {
  try {
    await request(`/api/issues/${encodeURIComponent(id)}/verify`, { method: 'POST' });
    showToast('Simulated follow-up period complete.');
  } catch (error) {
    showToast(error.message);
    return;
  }
  await refreshSelected(id);
}

async function investigateWithGemini(id, button) {
  const original = button.innerHTML;
  button.disabled = true;
  button.textContent = 'Analyzing evidence…';
  try {
    const issue = await request(`/api/issues/${encodeURIComponent(id)}/investigate`, { method: 'POST' });
    const index = state.issues.findIndex((item) => item.id === id);
    if (index >= 0) state.issues[index] = issue;
    showToast('Gemini investigation complete.');
    openIssue(id);
  } catch (error) {
    showToast(error.message);
    button.disabled = false;
    button.innerHTML = original;
  }
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

function setMobileSidebarOpen(open) {
  const sidebar = $('#app-sidebar');
  const backdrop = $('#sidebar-backdrop');
  const toggle = $('#sidebar-toggle');
  if (!sidebar || !backdrop || !toggle) return;

  sidebar.classList.toggle('open', open);
  backdrop.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  document.body.classList.toggle('sidebar-open', open);
}

function setupMobileSidebarEvents() {
  $('#sidebar-toggle')?.addEventListener('click', () => {
    setMobileSidebarOpen(!$('#app-sidebar')?.classList.contains('open'));
  });
  $('#sidebar-backdrop')?.addEventListener('click', () => setMobileSidebarOpen(false));
  window.addEventListener('resize', () => {
    if (window.innerWidth > 610) setMobileSidebarOpen(false);
  });
}

function setupHowItWorksEvents() {
  const modal = $('#how-it-works-modal');
  const openModal = () => {
    if (modal) modal.hidden = false;
  };
  const closeModal = () => {
    if (modal) modal.hidden = true;
  };

  $('#how-it-works-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal();
  });
  $('#hiw-close')?.addEventListener('click', closeModal);
  $('#hiw-close-btn')?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  $('#hiw-goto-forensics')?.addEventListener('click', () => {
    closeModal();
    const navItem = $('[data-nav="forensics"]');
    if (navItem) {
      navItem.click();
    } else {
      window.location.hash = '#forensics-lab';
    }
  });

  $('#hiw-goto-investigations')?.addEventListener('click', () => {
    closeModal();
    const navItem = $('[data-nav="investigations"]');
    if (navItem) {
      navItem.click();
    } else {
      window.location.hash = '#investigations';
    }
  });
}

function setupWorkspaceSwitcherEvents() {
  const switcherBtn = $('#workspace-switcher');
  const dropdown = $('#cluster-dropdown');
  const chevron = $('#cluster-chevron');

  const toggleDropdown = (open) => {
    const isOpen = open !== undefined ? open : dropdown?.hidden;
    if (!dropdown) return;
    dropdown.hidden = !isOpen;
    switcherBtn?.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) {
      chevron?.classList.add('open');
    } else {
      chevron?.classList.remove('open');
    }
  };

  switcherBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown();
  });

  dropdown?.addEventListener('click', (e) => {
    const storeBtn = e.target.closest('.cluster-store-btn');
    if (storeBtn) {
      const storeVal = storeBtn.dataset.store || '';
      const storeName = storeBtn.dataset.storeName || 'All stores';

      const filterSelect = $('#store-filter');
      if (filterSelect) {
        filterSelect.value = storeVal;
        filterSelect.dispatchEvent(new Event('change'));
      }

      $$('.cluster-store-btn').forEach((btn) => btn.classList.remove('active'));
      storeBtn.classList.add('active');

      const storesSub = $('#current-cluster-stores');
      if (storesSub) {
        storesSub.textContent = storeVal ? `${storeName} (Selected)` : '4 active stores';
      }

      toggleDropdown(false);
      showToast(storeVal ? `Filtered to ${storeName} store.` : 'Showing all stores in Bengaluru cluster.');
      return;
    }

    const futureCluster = e.target.closest('.cluster-option-card.disabled');
    if (futureCluster) {
      showToast('ℹ️ Multi-cluster expansion (Mumbai & Delhi-NCR) is scheduled as future work.');
      return;
    }
  });

  document.addEventListener('click', (e) => {
    if (!dropdown || dropdown.hidden) return;
    if (!e.target.closest('.workspace-switcher-wrap')) {
      toggleDropdown(false);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      toggleDropdown(false);
      setMobileSidebarOpen(false);
      const hiwModal = $('#how-it-works-modal');
      if (hiwModal) hiwModal.hidden = true;
      closeStoresModal();
      closeFeatureModal();
    }
  });
}

const BENGALURU_STORES = [
  {
    name: 'HSR Layout',
    code: 'BLR-01',
    initialClass: 'initial-rose',
    waste: 2.8,
    change: -0.4,
    loss: 28400,
    status: 'Healthy Operations',
    statusClass: 'normal',
    focus: 'Dairy chillers & milk rotation'
  },
  {
    name: 'Koramangala',
    code: 'BLR-02',
    initialClass: 'initial-lilac',
    waste: 3.4,
    change: 0.7,
    loss: 31200,
    status: 'Elevated Variance',
    statusClass: 'warn',
    focus: 'Inventory variance & morning intake audit'
  },
  {
    name: 'Whitefield',
    code: 'BLR-03',
    initialClass: 'initial-blue',
    waste: 2.1,
    change: -0.2,
    loss: 10300,
    status: 'Top Performer',
    statusClass: 'star',
    focus: 'Prepared meal shelf-life & salads'
  },
  {
    name: 'Indiranagar',
    code: 'BLR-04',
    initialClass: 'initial-green',
    waste: 4.1,
    change: 1.2,
    loss: 42100,
    status: 'Produce Alert',
    statusClass: 'alert',
    focus: 'Tomato spoilage spike · Cold storage fan (DO-2048)',
    featuredIssue: 'DO-2048'
  }
];

function renderStoresModalContent() {
  const grid = $('#stores-modal-grid');
  if (!grid) return;

  const avgWaste = state.overview?.metrics?.waste_rate ?? 3.2;
  const wasteEl = $('#modal-network-waste');
  if (wasteEl) wasteEl.textContent = `${Number(avgWaste).toFixed(1)}%`;

  const lossEl = $('#modal-network-loss');
  if (lossEl) lossEl.textContent = '₹ 1,12,000';

  const casesEl = $('#modal-network-cases');
  if (casesEl) casesEl.innerHTML = `${state.issues?.length || 5} <small>cases</small>`;

  grid.innerHTML = BENGALURU_STORES.map((store) => {
    const liveStore = state.overview?.stores?.find(s => s.code === store.code || s.name === store.name);
    const waste = liveStore ? liveStore.waste : store.waste;
    const change = liveStore ? liveStore.change : store.change;
    const loss = liveStore ? liveStore.loss : store.loss;
    const isSelected = state.store === store.name;
    const storeIssues = state.issues?.filter(i => i.store === store.name || i.store_code === store.code) || [];
    const issueCount = storeIssues.length || (store.featuredIssue ? 1 : 0);

    const trendText = change > 0 ? `↑ ${Math.abs(change).toFixed(1)}%` : `↓ ${Math.abs(change).toFixed(1)}%`;
    const trendColor = change > 0 ? '#bc5540' : '#386d45';
    const isAlert = store.statusClass === 'alert';

    return `
      <article class="store-modal-card ${isAlert ? 'alert-card' : ''} ${isSelected ? 'selected-card' : ''}">
        <div class="store-modal-card-top">
          <div class="store-card-info">
            <div class="store-card-avatar ${store.initialClass}">${esc(store.name.charAt(0))}</div>
            <div class="store-card-name">
              <strong>${esc(store.name)}</strong>
              <span>${esc(store.code)} · Bengaluru Hub</span>
            </div>
          </div>
          <span class="store-status-pill ${store.statusClass}">● ${esc(store.status)}</span>
        </div>

        <div class="store-card-metrics">
          <div class="store-metric-col">
            <span>Waste Rate</span>
            <strong>${Number(waste).toFixed(1)}% <span style="font-size:9px; color:${trendColor}; font-weight:600;">${trendText}</span></strong>
          </div>
          <div class="store-metric-col">
            <span>Identified Loss</span>
            <strong>₹ ${Number(loss).toLocaleString('en-IN')}</strong>
          </div>
          <div class="store-metric-col">
            <span>Open Cases</span>
            <strong>${issueCount} <span style="font-size:9px; color:#78867a; font-weight:500;">active</span></strong>
          </div>
        </div>

        <div class="store-card-focus">
          <span>🎯 Focus:</span>
          <strong>${esc(store.focus)}</strong>
        </div>

        <div class="store-card-actions">
          <button type="button" class="store-action-btn ${isSelected ? 'primary' : ''}" data-select-store="${esc(store.name)}">
            ${isSelected ? '✓ Currently Filtered' : `Filter to ${esc(store.name)}`}
          </button>
          ${store.featuredIssue ? `
            <button type="button" class="store-action-btn danger" data-open-issue="${esc(store.featuredIssue)}" title="Open investigation DO-2048">
              See Investigation (${esc(store.featuredIssue)}) →
            </button>
          ` : ''}
        </div>
      </article>
    `;
  }).join('');
}

function openStoresModal() {
  const modal = $('#stores-modal');
  if (!modal) return;
  renderStoresModalContent();
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeStoresModal() {
  const modal = $('#stores-modal');
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = '';
}

function filterToStore(storeName) {
  const filterSelect = $('#store-filter');
  if (filterSelect) {
    filterSelect.value = storeName;
    filterSelect.dispatchEvent(new Event('change'));
  }
  $$('.cluster-store-btn').forEach((btn) => {
    btn.classList.toggle('active', (btn.dataset.store || '') === storeName);
  });
  const storesSub = $('#current-cluster-stores');
  if (storesSub) {
    storesSub.textContent = storeName ? `${storeName} (Selected)` : '4 active stores';
  }

  closeStoresModal();
  showToast(`Workspace filtered to ${storeName}`);
}

function resetToAllStores() {
  const filterSelect = $('#store-filter');
  if (filterSelect) {
    filterSelect.value = '';
    filterSelect.dispatchEvent(new Event('change'));
  }
  $$('.cluster-store-btn').forEach((btn) => {
    btn.classList.toggle('active', !(btn.dataset.store || ''));
  });
  const storesSub = $('#current-cluster-stores');
  if (storesSub) {
    storesSub.textContent = '4 active stores';
  }

  closeStoresModal();
  showToast('Workspace reset to all Bengaluru stores');
}

function setupStoresModalEvents() {
  $('#view-all-stores-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    openStoresModal();
  });
  $('#store-options-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    openStoresModal();
  });
  $('#store-list')?.addEventListener('click', (e) => {
    const row = e.target.closest('.store-row');
    if (row) {
      openStoresModal();
    }
  });
  document.addEventListener('click', (e) => {
    const storeLink = e.target.closest('a[href="#stores"]');
    if (storeLink) {
      e.preventDefault();
      openStoresModal();
    }
  });

  $('#stores-modal-close')?.addEventListener('click', closeStoresModal);
  $('#stores-modal-done-btn')?.addEventListener('click', closeStoresModal);
  $('#stores-modal')?.addEventListener('click', (e) => {
    if (e.target === $('#stores-modal')) closeStoresModal();
  });
  $('#stores-modal-grid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-select-store]');
    if (btn) {
      filterToStore(btn.dataset.selectStore);
    }
  });
  $('#modal-show-all-btn')?.addEventListener('click', () => {
    resetToAllStores();
  });
}

const FEATURE_CARDS = {
  inventory: {
    icon: '▤',
    eyebrow: 'ROADMAP · FUTURE WORK · INVENTORY HEALTH',
    title: 'Inventory Health Architecture',
    subtitle: '[Future Work] How DarkOps will predict shelf-life decay, reconcile phantom shrink variances, and optimize stock par levels across dark stores.',
    steps: [
      {
        num: '01',
        icon: '⏱️',
        title: 'Batch Shelf-Life Tracking',
        desc: 'Tracks supplier delivery timestamps and FIFO pick velocity at the SKU level. Automatically flags items entering their critical 48-hour spoilage window before markdowns are required.',
        tag: 'BigQuery Batch Windows'
      },
      {
        num: '02',
        icon: '⚖️',
        title: 'Phantom Variance Engine',
        desc: 'Correlates point-of-sale pick logs, customer return credits, and cycle count discrepancies to identify unrecorded leakage, vendor short-picks, and misbinned inventory.',
        tag: 'Variance Regression'
      },
      {
        num: '03',
        icon: '🔄',
        title: 'Cluster Stock Rebalancing',
        desc: 'Calculates dynamic replenishment orders and generates inter-store transfer proposals between high-velocity and lagging dark stores in the cluster, preventing stockouts.',
        tag: 'Automated Par Tuning'
      }
    ],
    highlightTitle: '📌 Planned Roadmap · Future Work',
    highlightBody: 'This operational capability is planned as upcoming future work. When fully rolled out, it will connect directly with BigQuery daily operations tables, cold-chain temperature telemetry, and automated markdown cadences to arrest wastage before it reaches critical thresholds.',
    actionText: '📊 View Operations Snapshot',
    actionNav: 'overview'
  },
  waste: {
    icon: '◉',
    eyebrow: 'ROADMAP · FUTURE WORK · RECENT LOADS & DEFECTS',
    title: 'Recent Loads, Waste & Returns Intelligence',
    subtitle: '[Future Work] How DarkOps will audit incoming supplier shipments, track intake waste spikes, and automates vendor credit recovery.',
    steps: [
      {
        num: '01',
        icon: '🚚',
        title: 'Receiving Dock Intake Telemetry',
        desc: 'Digitizes supplier delivery manifests and logs physical temperatures against purchase orders at the receiving dock, catching supplier temperature breaches immediately.',
        tag: 'Manifest & PO Ingestion'
      },
      {
        num: '02',
        icon: '📉',
        title: 'Defect Categorization & Spoilage Audits',
        desc: 'Aggregates SKU-level dump tickets (crushed packaging, rot, melting, expired dates) and maps them to supplier lot IDs to distinguish vendor negligence from store handling error.',
        tag: 'Root-Cause Signal Tree'
      },
      {
        num: '03',
        icon: '📑',
        title: 'Automated Vendor Credit Recovery',
        desc: 'Generates itemized supplier debit memos supported by timestamped photo evidence and BigQuery transaction history, recovering unjustified losses from produce and dairy vendors.',
        tag: 'Debit Memo Automation'
      }
    ],
    highlightTitle: '📌 Planned Roadmap · Future Work',
    highlightBody: 'This operational capability is planned as upcoming future work. Intake rejections and customer return complaints will seamlessly link to Gemini 2.5 Flash for packaging OCR, seal defect detection, and vector similarity fraud screening.',
    actionText: '🔬 Open Photo Forensics Lab',
    actionNav: 'forensics'
  },
  team: {
    icon: '♙',
    eyebrow: 'ROADMAP · FUTURE WORK · TEAM & STORE GOVERNANCE',
    title: 'Team & Dark Store Governance',
    subtitle: '[Future Work] How DarkOps will assign investigation ownership, enforce shift accountability, and orchestrates store managers across clusters.',
    steps: [
      {
        num: '01',
        icon: '👥',
        title: 'Role-Based Cluster Access',
        desc: 'Partitions picker, inventory specialist, and shift manager permissions by dark store (BLR-01 through BLR-04) while granting operations leads unified cluster governance.',
        tag: 'Google Cloud IAM & OAuth'
      },
      {
        num: '02',
        icon: '🎯',
        title: 'Shift Incident Ownership & SLAs',
        desc: 'Dispatches critical root-cause action items (e.g., cold storage fan maintenance, milk rotation protocol) directly to active shift supervisors with automated SLA tracking.',
        tag: 'Closed-Loop SLA Tracking'
      },
      {
        num: '03',
        icon: '🏆',
        title: 'Cluster Operational Leaderboard',
        desc: 'Benchmarks dark stores by waste percentage, shrink recovery, and audit resolution velocity to incentivize operational discipline and cross-store best practice adoption.',
        tag: 'Performance Telemetry'
      }
    ],
    highlightTitle: '📌 Planned Roadmap · Future Work',
    highlightBody: 'This operational capability is planned as upcoming future work. The Bengaluru cluster (4 stores) is live in prototype; multi-tenant store assignment, supervisor shift SLAs, and upcoming regional clusters (Mumbai, Delhi-NCR) are planned for enterprise rollout.',
    actionText: '🏪 Open Store Telemetry',
    actionNav: 'stores'
  },
  settings: {
    icon: '⚙',
    eyebrow: 'ROADMAP · FUTURE WORK · SETTINGS & INTEGRATIONS',
    title: 'Settings & Enterprise Integrations',
    subtitle: '[Future Work] How DarkOps will integrate your WMS, ERP, cloud data warehouses, and Vertex AI models into a unified intelligence hub.',
    steps: [
      {
        num: '01',
        icon: '🔌',
        title: 'WMS & ERP Data Pipelines',
        desc: 'Standardized bi-directional event pipelines for SAP, Unicommerce, Increff, and custom proprietary dark store inventory management platforms.',
        tag: 'Bi-directional Event Bus'
      },
      {
        num: '02',
        icon: '☁️',
        title: 'Google Cloud Infrastructure Sync',
        desc: 'Configures BigQuery streaming buffer ingestion, Cloud Storage photo audit buckets, and Cloud Firestore case state persistence with zero local storage retention.',
        tag: 'BigQuery · Cloud Storage · Firestore'
      },
      {
        num: '03',
        icon: '🤖',
        title: 'Vertex AI Model Parameters',
        desc: 'Custom tuning controls for Gemini 2.5 Flash temperature, confidence thresholds, perceptual-hash vector distance cutoffs, and automated recommendation triggers.',
        tag: 'Vertex AI Tuning Controls'
      }
    ],
    highlightTitle: '📌 Planned Roadmap · Future Work',
    highlightBody: 'This operational capability is planned as upcoming future work. Enterprise configurations for WMS webhooks (SAP, Increff, Unicommerce), automated BigQuery streaming ingestion, and Vertex AI confidence parameter tuning are slated for future releases.',
    actionText: '☷ View Active Investigations',
    actionNav: 'investigations'
  }
};

function openFeatureModal(featureKey) {
  const data = FEATURE_CARDS[featureKey];
  if (!data) return;

  const modal = $('#feature-info-modal');
  if (!modal) return;

  const iconEl = $('#fim-icon');
  if (iconEl) iconEl.textContent = data.icon;
  const eyebrowEl = $('#fim-eyebrow');
  if (eyebrowEl) eyebrowEl.textContent = data.eyebrow;
  const titleEl = $('#fim-title');
  if (titleEl) titleEl.textContent = data.title;
  const subtitleEl = $('#fim-subtitle');
  if (subtitleEl) subtitleEl.textContent = data.subtitle;

  const grid = $('#fim-grid');
  if (grid) {
    grid.innerHTML = data.steps.map((s, idx) => `
      <div class="hiw-step-card">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
          <span class="hiw-step-num" style="margin:0;">${esc(s.num)}</span>
          <span class="expansion-badge" style="font-size:7px;">Future Work</span>
        </div>
        <div class="hiw-step-icon">${esc(s.icon)}</div>
        <h3>${esc(s.title)}</h3>
        <p>${esc(s.desc)}</p>
        <div class="hiw-tag ${idx === 1 ? 'highlight' : ''}">${esc(s.tag)}</div>
      </div>
    `).join('');
  }

  const hlTitle = $('#fim-highlight-title');
  if (hlTitle) hlTitle.textContent = data.highlightTitle;
  const hlBody = $('#fim-highlight-body');
  if (hlBody) hlBody.textContent = data.highlightBody;

  const actionBtn = $('#fim-action-btn');
  if (actionBtn) {
    if (data.actionText && data.actionNav) {
      actionBtn.hidden = false;
      actionBtn.textContent = data.actionText;
      actionBtn.onclick = () => {
        closeFeatureModal();
        if (data.actionNav === 'stores') {
          openStoresModal();
        } else if (data.actionNav === 'forensics') {
          const item = $('[data-nav="forensics"]');
          if (item) item.click();
          else window.location.hash = '#forensics-lab';
        } else if (data.actionNav === 'investigations') {
          const item = $('[data-nav="investigations"]');
          if (item) item.click();
          else window.location.hash = '#investigations';
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      };
    } else {
      actionBtn.hidden = true;
    }
  }

  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeFeatureModal() {
  const modal = $('#feature-info-modal');
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = '';
}

function setupFeatureModalEvents() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('#fim-close, #fim-close-btn, [data-close-feature-modal]')) {
      closeFeatureModal();
    }
  });
  $('#feature-info-modal')?.addEventListener('click', (e) => {
    if (e.target === $('#feature-info-modal')) closeFeatureModal();
  });
}

function setupEvents() {
  setupMobileSidebarEvents();
  setupHowItWorksEvents();
  setupWorkspaceSwitcherEvents();
  setupStoresModalEvents();
  setupFeatureModalEvents();

  // Handle "See investigation →" button in insight banner or any [data-open-issue]
  document.addEventListener('click', (event) => {
    const openBtn = event.target.closest('.insight-link, [data-open-issue]');
    if (openBtn) {
      event.preventDefault();
      const issueId = openBtn.dataset.openIssue || 'DO-2048';
      closeStoresModal();
      openIssue(issueId);
    }
  });

  $$('.queue-tab').forEach((tab) => tab.addEventListener('click', () => setCategory(tab.dataset.category)));
  $('#issues-body').addEventListener('click', (event) => {
    if (event.target.closest('input[type="checkbox"]')) { event.stopPropagation(); return; }
    const row = event.target.closest('[data-issue]');
    if (row) openIssue(row.dataset.issue);
  });
  $('#issues-body').addEventListener('keydown', (event) => { if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('tr[data-issue]')) openIssue(event.target.dataset.issue); });
  $('#drawer-close').addEventListener('click', closeDrawer);
  $('#drawer-backdrop').addEventListener('click', closeDrawer);
  $('#drawer-content').addEventListener('click', async (event) => {
    const action = event.target.closest('[data-action]');
    const verify = event.target.closest('[data-verify]');
    const investigate = event.target.closest('[data-investigate]');
    const runForensics = event.target.closest('[data-run-forensics]');
    if (action && !action.disabled) recordAction(action.dataset.action);
    if (verify) verifyIssue(verify.dataset.verify);
    if (investigate) investigateWithGemini(investigate.dataset.investigate, investigate);
    if (runForensics) {
      const btn = runForensics;
      btn.disabled = true;
      btn.innerHTML = `<span class="status-dot" style="background:#4285F4; animation:pulse-red 1s infinite;"></span> Running Gemini Forensics...`;
      try {
        const data = await request(`/api/issues/${encodeURIComponent(btn.dataset.runForensics)}/forensics`, { method: 'POST' });
        showToast('Gemini Multimodal Forensic Analysis completed.');
        await refreshSelected(btn.dataset.runForensics);
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = `⚠️ Forensics error: ${esc(err.message)}`;
      }
    }
  });

  // Forensics Lab sample chip selection
  $('#sample-chips-wrap')?.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-sample-id]');
    if (chip) selectSample(chip.dataset.sampleId);
  });
  $('#forensics-result-panel')?.addEventListener('click', (event) => {
    const analyzeButton = event.target.closest('[data-analyze-sample]');
    if (analyzeButton) analyzeSample(analyzeButton.dataset.analyzeSample);
    const createButton = event.target.closest('[data-create-forensic-investigation]');
    if (createButton && activeSample?.isCustom && activeSample.result) openForensicInvestigationForm(activeSample);
  });

  // Custom photo upload - creates a new distinct complaint entry
  $('#custom-photo-upload')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input so user can re-upload if needed
    event.target.value = '';

    const newSampleId = `sample-custom-${Date.now()}`;
    const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    const newSample = {
      id: newSampleId,
      title: file.name,
      scenario: 'Live Customer Upload',
      image_source: 'Live upload',
      product: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
      complaint_text: 'Custom customer complaint photo uploaded for live Gemini multimodal inspection.',
      url: URL.createObjectURL(file),
      file: file,
      isCustom: true,
      result: null
    };

    // Add as a new separate entry in forensicsSamples
    forensicsSamples.push(newSample);
    activeSample = newSample;

    // Render chips so the new tab is created and selected
    renderSampleChips();

    // Scroll to new chip
    const newChip = $(`[data-sample-id="${newSampleId}"]`);
    newChip?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' });

    const displayImg = $('#forensics-display-img');
    displayImg.src = newSample.url;
    $('#forensics-img-label').textContent = 'Live upload · Customer Photo';
    $('#forensics-product-label').textContent = newSample.product;
    $('#forensics-complaint-quote').textContent = `"${newSample.complaint_text}"`;

    const resultContainer = $('#forensics-result-panel');
    resultContainer.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:180px; gap:8px; color:#5c6e61;">
        <div class="status-dot" style="width:10px; height:10px; background:#4285F4; animation:pulse-red 1s infinite;"></div>
        <span style="font-size:10px; font-weight:600;">Gemini 2.5 Flash inspecting uploaded image &amp; running vector duplicate check...</span>
      </div>
    `;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('complaint_text', 'Customer photo submission');

    try {
      const response = await fetch('/api/forensics/analyze-upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Upload failed');

      newSample.result = data.forensic_result;
      if (data.forensic_result.defect_type && data.forensic_result.defect_type !== 'No Defect Found') {
        newSample.title = `${data.forensic_result.defect_type}`;
        renderSampleChips();
      }

      if (activeSample && activeSample.id === newSampleId) {
        renderForensicsPanel(data.forensic_result);
      }
      showToast('Custom photo analyzed by Gemini Flash.');
    } catch (err) {
      if (activeSample && activeSample.id === newSampleId) {
        resultContainer.innerHTML = `<div style="color:#bd4444; font-size:10px;">Upload analysis failed: ${esc(err.message)}</div>`;
      }
    }
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
  const newInvestigationDialog = $('#new-investigation-dialog');
  $('#new-investigation').addEventListener('click', () => { pendingForensicCase = null; $('#new-investigation-form').reset(); newInvestigationDialog.showModal(); });
  $('#new-investigation-close').addEventListener('click', () => { pendingForensicCase = null; newInvestigationDialog.close(); });
  $('#new-investigation-cancel').addEventListener('click', () => { pendingForensicCase = null; newInvestigationDialog.close(); });
  newInvestigationDialog.addEventListener('click', (event) => { if (event.target === newInvestigationDialog) { pendingForensicCase = null; newInvestigationDialog.close(); } });
  newInvestigationDialog.addEventListener('close', () => { pendingForensicCase = null; });
  $('#new-investigation-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = $('#new-investigation-submit');
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    payload.impact = Number(payload.impact || 0);
    submit.disabled = true;
    submit.textContent = 'Creating…';
    try {
      let created;
      if (pendingForensicCase) {
        const forensicForm = new FormData();
        Object.entries(payload).forEach(([key, value]) => forensicForm.append(key, value));
        forensicForm.append('forensic_result', JSON.stringify(pendingForensicCase.result));
        forensicForm.append('file', pendingForensicCase.file, pendingForensicCase.file.name);
        created = await request('/api/issues/from-forensics', { method: 'POST', body: forensicForm });
      } else {
        created = await request('/api/issues', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      const [issues, overview] = await Promise.all([request('/api/issues'), request('/api/overview')]);
      state.issues = issues;
      state.overview = overview;
      state.category = 'All';
      state.query = '';
      $('#search-input').value = '';
      renderIssues();
      renderStores();
      form.reset();
      newInvestigationDialog.close();
      pendingForensicCase = null;
      showToast('Investigation created.');
      await openIssue(created.id);
    } catch (error) {
      showToast(error.message);
    } finally {
      submit.disabled = false;
      submit.textContent = 'Create investigation';
    }
  });
  $$('.period-toggle button').forEach((button) => button.addEventListener('click', () => {
    $$('.period-toggle button').forEach((item) => item.classList.toggle('active', item === button));
    showToast(button.dataset.period === '30d' ? 'Showing the 30-day summary view.' : 'Showing the 7-day summary view.');
  }));
  $$('.nav-item').forEach((item) => item.addEventListener('click', (event) => {
    const target = item.dataset.nav;
    setMobileSidebarOpen(false);
    if (FEATURE_CARDS[target]) {
      event.preventDefault();
      openFeatureModal(target);
      return;
    }
    $$('.nav-item').forEach((nav) => nav.classList.toggle('active', nav === item));
    $('#breadcrumb-current').textContent = target === 'overview' ? 'Overview' : target === 'forensics' ? 'Photo Forensics' : 'Investigations';
    if (target === 'investigations') document.querySelector('#investigations')?.scrollIntoView({ behavior: 'smooth' });
    else if (target === 'forensics') document.querySelector('#forensics-lab')?.scrollIntoView({ behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
  const initialNav = window.location.hash === '#forensics-lab' ? 'forensics' : window.location.hash === '#investigations' ? 'investigations' : 'overview';
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.nav === initialNav));
  $('#breadcrumb-current').textContent = initialNav === 'forensics' ? 'Photo Forensics' : initialNav === 'investigations' ? 'Investigations' : 'Overview';
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeDrawer(); $('#severity-popover')?.remove(); closeStoresModal(); closeFeatureModal(); } });
}

let forensicsSamples = [];
let activeSample = null;
let pendingForensicCase = null;

async function loadForensics() {
  try {
    forensicsSamples = await request('/api/forensics/samples');
    renderSampleChips();
    if (forensicsSamples.length > 0) {
      selectSample(forensicsSamples[0].id, false);
    }
  } catch (err) {
    console.error('Failed to load forensics samples:', err);
  }
}

function renderSampleChips() {
  const container = $('#sample-chips-wrap');
  if (!container) return;
  const icons = {
    'sample-tomato-rot': '🍅',
    'sample-icecream-melt': '🍦',
    'sample-crushed-pack': '🥚',
    'sample-expired-dairy': '🥛',
    'sample-abuse-claim-1': '🍫',
    'sample-abuse-claim-2': '🚨',
    'sample-no-defect': '🥖'
  };
  container.innerHTML = forensicsSamples.map((s, idx) => {
    const isActive = activeSample ? activeSample.id === s.id : idx === 0;
    const icon = s.isCustom ? '📸' : (icons[s.id] || '📷');
    return `
      <button type="button" class="sample-chip ${isActive ? 'active' : ''} ${s.isCustom ? 'custom-sample-chip' : ''}" data-sample-id="${esc(s.id)}">
        <span>${icon}</span> ${esc(s.title)}
      </button>
    `;
  }).join('');
}

async function selectSample(sampleId, analyze = true) {
  const sample = forensicsSamples.find((s) => s.id === sampleId);
  if (!sample) return;
  activeSample = sample;

  $$('.sample-chip').forEach((c) => c.classList.toggle('active', c.dataset.sampleId === sampleId));
  $('#forensics-display-img').src = sample.url;
  $('#forensics-img-label').textContent = `${sample.image_source || 'Demo photo'} · ${sample.scenario}`;
  $('#forensics-product-label').textContent = sample.product;
  $('#forensics-complaint-quote').textContent = `"${sample.complaint_text}"`;

  const resultContainer = $('#forensics-result-panel');

  if (sample.result) {
    renderForensicsPanel(sample.result);
    return;
  }

  if (!analyze) {
    resultContainer.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:180px; gap:10px; color:#5c6e61; text-align:center;">
        <span style="font-size:11px; font-weight:600;">Photo ready for forensic analysis</span>
        <button type="button" class="primary-button" data-analyze-sample="${esc(sampleId)}">Analyze with Gemini</button>
      </div>
    `;
    return;
  }
  await analyzeSample(sampleId);
}

async function analyzeSample(sampleId) {
  const sample = forensicsSamples.find((s) => s.id === sampleId);
  const resultContainer = $('#forensics-result-panel');
  if (!resultContainer) return;

  if (sample && sample.result) {
    renderForensicsPanel(sample.result);
    return;
  }

  resultContainer.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:180px; gap:8px; color:#5c6e61;">
      <div class="status-dot" style="width:10px; height:10px; background:#4285F4; animation:pulse-red 1s infinite;"></div>
      <span style="font-size:10px; font-weight:600;">Gemini 2.5 Flash analyzing visual features, defect classification &amp; OCR...</span>
    </div>
  `;

  try {
    const data = await request('/api/forensics/analyze-sample', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sample_id: sampleId })
    });
    if (sample) sample.result = data.forensic_result;
    renderForensicsPanel(data.forensic_result);
  } catch (err) {
    resultContainer.innerHTML = `<div style="color:#bd4444; font-size:10px;">Failed to analyze photo: ${esc(err.message)}</div>`;
  }
}

function renderForensicsPanel(f) {
  const resultContainer = $('#forensics-result-panel');
  if (!resultContainer) return;
  const isAbuse = f.is_duplicate_photo || (f.defect_type && f.defect_type.includes('Abuse'));
  const pillClass = isAbuse ? 'abuse' : (f.defect_type || '').toLowerCase().includes('rot') ? 'rot' : (f.defect_type || '').toLowerCase().includes('melt') ? 'melt' : (f.defect_type || '').toLowerCase().includes('crush') ? 'crushed' : (f.defect_type || '').toLowerCase().includes('expire') ? 'expired' : 'clean';

  resultContainer.innerHTML = `
    <div class="forensics-result-header">
      <div>
        <span class="defect-pill ${pillClass}">● ${esc(f.defect_type)}</span>
        <div style="font-size:8.5px; color:#859087; margin-top:4px;">
          Severity Grade: <strong style="color:#2a362f;">${esc(f.severity)}</strong> · Engine: <b>${esc(f.engine || 'Gemini 2.5 Flash')}</b>
        </div>
      </div>
      <div class="confidence-box">
        <strong style="color:${f.confidence >= 0.8 ? '#2e6b3b' : '#ba7818'};">${Math.round(f.confidence * 100)}%</strong>
        <span>Confidence</span>
      </div>
    </div>

    <div class="forensics-meta-tags">
      ${f.batch_code_ocr ? `<span class="meta-tag ocr">🏷️ <strong>Batch Code OCR:</strong> ${esc(f.batch_code_ocr)}</span>` : '<span class="meta-tag">🏷️ Batch OCR: Not legible</span>'}
      ${f.expiry_date_ocr ? `<span class="meta-tag">📅 <strong>Expiry OCR:</strong> ${esc(f.expiry_date_ocr)}</span>` : ''}
      ${isAbuse ? `<span class="meta-tag fraud-flag">🚨 <strong>Vector Duplicate:</strong> ${esc(f.duplicate_similarity_score)}% (${esc(f.duplicate_matched_id)})</span>` : '<span class="meta-tag" style="color:#2e6b3b;">✓ Original Photo (No duplicate)</span>'}
    </div>

    <div class="reasoning-box">
      <h4>Visual Evidence Observed</h4>
      <p style="margin:0 0 6px;">${esc(f.visual_evidence)}</p>
      <h4 style="margin-top:6px;">Diagnostic Assessment</h4>
      <p style="margin:0; color:#3b483f;"><strong>Root cause signal:</strong> ${esc(f.forensic_assessment)}</p>
    </div>

    <div class="action-guardrail-box">
      <strong>🛡️ Autonomous Guardrail Recommendation</strong>
      <p>${esc(f.action_recommendation)}</p>
    </div>
    ${activeSample?.isCustom ? '<button type="button" class="button button-dark forensic-create-case" data-create-forensic-investigation>Create investigation from this report <span>→</span></button>' : ''}
  `;
}

function openForensicInvestigationForm(sample) {
  pendingForensicCase = { file: sample.file, result: sample.result };
  const findings = sample.result;
  const descriptionParts = [
    `Forensic finding: ${findings.defect_type || 'Image review'}.`,
    findings.visual_evidence ? `Visual evidence: ${findings.visual_evidence}` : '',
    findings.forensic_assessment ? `Assessment: ${findings.forensic_assessment}` : '',
    findings.batch_code_ocr ? `Batch code OCR: ${findings.batch_code_ocr}` : '',
    findings.expiry_date_ocr ? `Expiry date OCR: ${findings.expiry_date_ocr}` : '',
    findings.action_recommendation ? `Suggested action: ${findings.action_recommendation}` : '',
  ].filter(Boolean).join('\n');
  const severity = /high|critical/i.test(findings.severity || '') ? 'High' : /low/i.test(findings.severity || '') ? 'Low' : 'Medium';
  const forensicText = `${findings.defect_type || ''} ${findings.visual_evidence || ''} ${findings.forensic_assessment || ''} ${findings.action_recommendation || ''}`.toLowerCase();
  const category = /expir|shelf life/i.test(forensicText) ? 'Expiry risk'
    : /cold.chain|temperature|freezer|melt/i.test(forensicText) ? 'Cold chain'
      : /fraud|abuse|duplicate|refund/i.test(forensicText) ? 'Returns'
        : /wast|rot|mould|mold|spoil|contamin|crush|damage/i.test(forensicText) ? 'Wastage' : 'Other';
  $('#new-investigation-form [name="title"]').value = `Forensic finding: ${findings.defect_type || sample.title}`.slice(0, 120);
  $('#new-investigation-form [name="product"]').value = sample.product || '';
  $('#new-investigation-form [name="description"]').value = descriptionParts.slice(0, 1000);
  $('#new-investigation-form [name="category"]').value = category;
  $('#new-investigation-form [name="store"]').value = '';
  $('#new-investigation-form [name="impact"]').value = '0';
  $('#new-investigation-form [name="severity"]').value = severity;
  $('#new-investigation-dialog').showModal();
}

setupEvents();
startAuthenticatedApp();
