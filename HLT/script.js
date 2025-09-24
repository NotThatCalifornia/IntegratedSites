/**
 * HLT UI — modern, structured JS (no jQuery)
 * Consumes:
 *  - GET /values, /info, /modules
 *  - POST / (target=<float> | name=<string>)
 *  - POST /enable, /disable
 */

(() => {
  'use strict';

  // --- Constants -----------------------------------------------------------
  const ENDPOINTS = {
    values: '/values',
    info: '/info',
    modules: '/modules',
    enable: '/enable',
    disable: '/disable',
    form: '/',
    fill: '/fill'
  };

  const LABELS = {
    localUrl: 'Local URL',
    name: 'Name',
    desc: 'Description',
    version: 'Version',
    manufacturer: 'Manufacturer',
    id: 'ID',
    wifi: 'WiFi',
    ws: 'Web Sockets',
    relay1: 'Heating',
    relay2: 'Cooling',
    ip: 'IP Address',
    min: 'Min temperature',
    max: 'Max temperature',
    tank: 'Tank',
    flashFree: 'Flash free',
    flashUsed: 'Flash used',
    flashTotal: 'Flash total'
  };

  // --- Utils --------------------------------------------------------------
  const qs = (sel, el = document) => el.querySelector(sel);
  const qsa = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  const fmt = {
    c2: (n) => (typeof n === 'number' ? n.toFixed(2) : 'n/a'),
    pct1: (n) => (typeof n === 'number' ? n.toFixed(1) : 'n/a'),
    kib_mib: (bytes) => {
      const b = Number(bytes);
      if (!isFinite(b)) return 'n/a';
      const kib = b / 1024;
      const mib = b / (1024 * 1024);
      return `${mib.toFixed(2)} MB (${kib.toFixed(2)} kB)`;
    },
    sizeStr: (bytes) => {
      const b = Number(bytes);
      if (!isFinite(b)) return 'n/a';
      if (b < 1024) return `${b} B`;
      if (b < 1024*1024) return `${(b/1024).toFixed(1)} kB`;
      return `${(b/(1024*1024)).toFixed(2)} MB`;
    }
  };

  // --- Files helpers -------------------------------------------------------
  function buildFileUrl(name) {
    return `/files/` + String(name).split('/').map(encodeURIComponent).join('/');
  }

  function canDeleteFile(entry) {
    return entry.storage === 'flash' && (entry.name === 'HEATING.txt' || entry.name === 'log.txt');
  }

  async function getJSON(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${url} ${res.status}`);
    return res.json();
  }

  function nowString() {
    return new Date().toLocaleString();
  }

  function linkFor(key, value) {
    if (key === 'localUrl') {
      const v = String(value || '');
      return /^https?:\/\//.test(v) ? v : `http://${v}`;
    }
    if (key === 'ip') return `http://${value}`;
    return '#';
  }

  function statusBadge(values) {
    // Prefer tank status if 'top'/'bottom' present
    const hasTop = values.top !== undefined && values.top !== null;
    const hasBottom = values.bottom !== undefined && values.bottom !== null;

    // Heating detection: any SSRs (array or discrete). Note: relay1 is FILLING, relay2 is recirc pump.
    const ssrArrayOn = Array.isArray(values.ssrs) && values.ssrs.some(Boolean);
    const ssrDiscreteOn = [values.ssr1, values.ssr2, values.ssr3].some(v => v === 1 || v === true);
    const isHeating = !!(ssrArrayOn || ssrDiscreteOn);

    if (!values.enabled) {
      return { text: 'Off', cls: 'status-off' };
    }

    if (hasTop && hasBottom) {
      const top = Number(values.top) === 1;
      const bottom = Number(values.bottom) === 1;
      if (top && !bottom) return { text: 'Sensor error', cls: 'status-danger' };
      if (!top && !bottom) return { text: 'Empty', cls: 'status-danger' };
      if (isHeating) return { text: 'Heating', cls: 'status-warning' };
      if (top && bottom) return { text: 'Full', cls: 'status-info' };
      if (!top && bottom) return { text: 'Part full', cls: 'status-info' };
    }

    // Fallback to provided status or heating state, but use info color by default
    const fallback = values.status || (isHeating ? 'Heating' : 'Idle');
    const fbLower = String(fallback).toLowerCase();
    if (
      fallback === 'Error' ||
      fallback === 'Empty' ||
      fallback === 'Sensor error' ||
      fbLower.includes('fill') // e.g., "FILL TANK!"
    ) {
      return { text: fallback, cls: 'status-danger' };
    }
    if (isHeating) {
      return { text: 'Heating', cls: 'status-warning' };
    }
    return { text: fallback, cls: 'status-info' };
  }

  // Latest telemetry cache for UI interactions
  let latestValues = null;
  let valuesInFlight = false;
  let valuesAbort = null;
  let valuesTimeoutId = null;
  let valuesPending = false;

  // --- Rendering ----------------------------------------------------------
  function renderHeader(values, info) {
    const temperature = fmt.c2(values.temp1);
    const deviceName = String(info.name || 'n/a');
    const deviceType = String(info.desc || 'n/a');
    const targetTemperature = fmt.c2(values.targetTemp);

    return `
      <header>
        <img class="brand-logo" src="https://hardware.notthatcalifornia.com/img/bevvy.png" alt="Bevvy" />
        <h1><b>${deviceName.toUpperCase()}</b><br><span id="temperature">${temperature}</span>˚C</h1>
        <p>${deviceType}</p>
        <p class="tankContent">Tank status: <b>${values.tank ?? values.content ?? ''}</b> <span id="fillControls"></span></p>
        <h3>(Target temperature: <span id="targetTemperature">${targetTemperature}˚C</span>)</h3>
      </header>
    `;
  }

  function renderInfo(values, info) {
    const internalTemperature = fmt.c2(values.int);
    const internalHumidity = fmt.pct1(values.intHumidity);

    const entries = Object.entries(info).map(([key, value]) => {
      const label = LABELS[key] || key;
      if (key === 'localUrl' || key === 'ip') {
        const href = linkFor(key, value);
        return `
          <p class="key"><strong>${label}:</strong></p>
          <p class="value">${value}
            <a href="${href}" class="btn btn-success">Go</a>
          </p>
        `;
      }
      if (key === 'flashFree' || key === 'flashUsed' || key === 'flashTotal') {
        return `<p class="key"><strong>${label}:</strong></p><p class="value" id="key-${key}">${fmt.kib_mib(value)}</p>`;
      }
      return `<p class="key"><strong>${label}:</strong></p><p class="value" id="key-${key}">${value}</p>`;
    }).join('');

    return `
      <div class="section info">
        <div class="text-center">
          <h4 id="info-header" class="btn btn-warning dropdown-toggle">System info <span class="caret"></span></h4>
        </div>
        <div id="info" class="card">
          <p class="key"><strong>Device temperature:</strong></p><p class="value" id="internalTemperature">${internalTemperature}˚C</p>
          <p class="key"><strong>Device humidity:</strong></p><p class="value" id="internalHumidity">${internalHumidity}%</p>
          ${entries}
        </div>
      </div>
    `;
  }

  function renderModules(modules) {
    const list = Object.entries(modules).map(([key, value]) => {
      const label = LABELS[key] || key;
      return `<p><span class="indicator ${value ? 'enabled' : 'disabled'}"><i>${value ? 'Enabled' : 'Disabled'}</i></span><span class="name">${label}</span></p>`;
    }).join('');

    return `
      <div class="section modules">
        <div class="text-center">
          <h4 id="modules-header" class="btn btn-warning dropdown-toggle">Available modules <span class="caret"></span></h4>
        </div>
        <div id="modules" class="card">${list}</div>
      </div>
    `;
  }

  function renderFilesSection() {
    return `
      <div class="section files">
        <div class="text-center">
          <h4 id="files-header" class="btn btn-warning dropdown-toggle">Files <span class="caret"></span></h4>
        </div>
        <div id="files" class="card">
          <div id="filesList" class="file-list small-info">Open to load files…</div>
        </div>
      </div>
    `;
  }

  function renderOverlay() {
    return `
      <div id="overlayBackdrop" class="overlay-backdrop" style="display:none">
        <div class="overlay-panel">
          <div class="overlay-header">
            <span id="overlayTitle">File</span>
            <button id="overlayClose" class="btn btn-sm btn-secondary" type="button">Close</button>
          </div>
          <pre id="overlayContent" class="overlay-content">Loading…</pre>
        </div>
      </div>
    `;
  }

  function renderStatus(values) {
    const { text, cls } = statusBadge(values);
    return `
      <div class="section modules values">
        <div class="row justify-content-center align-items-center">
          <div class="col-auto">
            <div id="statusBox" class="form-check form-switch fs-2">
              <input id="enabledToggle" class="form-check-input" type="checkbox" ${values.enabled ? 'checked' : ''}>
              <span id="statusLabel" class="status-label">
                <span class="status-dot ${cls}"></span>
                <span class="status-text">${text}</span>
              </span>
            </div>
          </div>
        </div>
        <br><br>
      </div>
    `;
  }

  function renderTarget(info) {
    const min = info.min ?? '';
    const max = info.max ?? '';
    return `
      <div class="section info">
        <div class="text-center">
          <h4 id="set-header" class="btn btn-success dropdown-toggle">Set target temperature <span class="caret"></span></h4>
        </div>
        <form id="set" class="card">
          <div class="mb-3">
            <div id="target-feedback" class="alert" style="display:none"></div>
            <div class="input-group">
              <input type="text" id="target" name="target" class="form-control" placeholder="Target temperature" aria-label="Target temperature" aria-describedby="target-feedback" />
              <span class="input-group-text">˚C</span>
              <button class="btn btn-primary" type="submit">Submit</button>
            </div>
            <div class="text-center small-info">Values between ${min}˚C and ${max}˚C</div>
          </div>
        </form>
      </div>
    `;
  }

  function renderName(info) {
    const deviceName = String(info.name || '');
    return `
      <div class="section info">
        <div class="text-center">
          <h4 id="name-header" class="btn btn-success dropdown-toggle">Device name <span class="caret"></span></h4>
        </div>
        <form id="name" class="card">
          <div class="mb-3">
            <div id="name-feedback" class="alert" style="display:none"></div>
            <div class="input-group">
              <input type="text" id="nameInput" name="name" value="${deviceName}" class="form-control" placeholder="Device name" aria-label="Device name" aria-describedby="name-feedback" />
              <button class="btn btn-primary" type="submit">Submit</button>
            </div>
            <div class="text-center small-info">Device will reboot after saving</div>
          </div>
        </form>
      </div>
    `;
  }

  function renderPage(values, info, modules) {
    const header = renderHeader(values, info);
    const status = renderStatus(values);
    const target = renderTarget(info);
    const name = renderName(info);
    const sysinfo = renderInfo(values, info);
    const mods = renderModules(modules);
    const files = renderFilesSection();

    return `
      <div id="content">
        ${header}
        ${status}
        ${target}
        ${name}
        ${sysinfo}
        ${mods}
        ${files}
        <div class="footer section text-center">
          <p>Last update: <span id="lastUpdate"></span></p>
          <p>
            &copy; <a href="https://bevvytech.com">Bevvy Tech Ltd.</a>
          </p>
        </div>
      </div>
      ${renderOverlay()}
    `;
  }

  // --- Behavior -----------------------------------------------------------
  function installSectionToggles() {
    const pairs = [
      ['#set-header', '#set'],
      ['#name-header', '#name'],
      ['#info-header', '#info'],
      ['#modules-header', '#modules'],
      ['#files-header', '#files']
    ];
    for (const [headerSel, sectionSel] of pairs) {
      const header = qs(headerSel);
      const section = qs(sectionSel);
      if (!header || !section) continue;
      section.style.display = 'none';
      header.addEventListener('click', () => {
        const opening = section.style.display === 'none';
        section.style.display = opening ? '' : 'none';
        if (opening && headerSel === '#set-header') {
          const input = qs('input[name="target"]', section);
          if (input && latestValues && typeof latestValues.targetTemp === 'number') {
            input.value = fmt.c2(latestValues.targetTemp);
          }
        }
        if (opening && headerSel === '#files-header') {
          loadFiles();
        }
      });
    }
  }

  function updateStatusBox(values) {
    const { text, cls } = statusBadge(values);
    const container = qs('#statusLabel');
    const dot = qs('#statusLabel .status-dot');
    const textEl = qs('#statusLabel .status-text');
    const toggle = qs('#enabledToggle');
    if (container && dot && textEl) {
      dot.className = `status-dot ${cls}`;
      textEl.textContent = text;
    }
    if (toggle) {
      toggle.checked = !!values.enabled;
    }
  }

  function getTankState(values) {
    // Accept new keys top_full/bottom_safe, fallback to legacy top/bottom
    const topRaw = (values.top_full !== undefined ? values.top_full : values.top);
    const bottomRaw = (values.bottom_safe !== undefined ? values.bottom_safe : values.bottom);
    const hasTop = topRaw !== undefined && topRaw !== null;
    const hasBottom = bottomRaw !== undefined && bottomRaw !== null;
    if (!(hasTop && hasBottom)) return 'unknown';
    const top = Number(topRaw) === 1 || topRaw === true || topRaw === '1' || topRaw === 'true' || topRaw === 'on';
    const bottom = Number(bottomRaw) === 1 || bottomRaw === true || bottomRaw === '1' || bottomRaw === 'true' || bottomRaw === 'on';
    if (top && !bottom) return 'error';
    if (!top && !bottom) return 'empty';
    if (!top && bottom) return 'part';
    if (top && bottom) return 'full';
    return 'unknown';
  }

  function isFilling(values) {
    // Only consider fill relay: relays[0] if array provided; otherwise relay1
    if (Array.isArray(values.relays) && values.relays.length > 0) {
      const r0 = values.relays[0];
      return r0 === 1 || r0 === true || r0 === '1' || r0 === 'on' || r0 === 'true';
    }
    if (typeof values.relay1 !== 'undefined') {
      const r1 = values.relay1;
      return r1 === 1 || r1 === true || r1 === '1' || r1 === 'on' || r1 === 'true';
    }
    return false;
  }

  function renderFillControls(values) {
    const state = getTankState(values);
    const filling = isFilling(values);
    if ((state === 'empty' || state === 'part') && !filling) {
      return `<button id="fillStart" class="btn btn-sm btn-success" type="button">Fill Tank</button>`;
    }
    if (filling && (state === 'empty' || state === 'part')) {
      return `<button id="fillStop" class="btn btn-sm btn-danger" type="button">Stop Fill</button>`;
    }
    return '';
  }

  async function postFill(start) {
    const body = new URLSearchParams({ fill: String(!!start) });
    await fetch(ENDPOINTS.fill, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
  }

  function updateFillControls(values) {
    const container = qs('#fillControls');
    if (!container) return;
    container.innerHTML = renderFillControls(values);
    const startBtn = qs('#fillStart');
    const stopBtn = qs('#fillStop');
    if (startBtn) {
      startBtn.addEventListener('click', async () => {
        try {
          // Guard: never attempt to fill if tank is already full (top float true)
          if (getTankState(latestValues || {}) === 'full') return;
          await postFill(true);
          await refreshValues();
        } catch (e) { console.error('Error starting fill', e); }
      });
    }
    if (stopBtn) {
      stopBtn.addEventListener('click', async () => {
        try {
          await postFill(false);
          await refreshValues();
        } catch (e) { console.error('Error stopping fill', e); }
      });
    }
  }

  async function loadFiles() {
    const list = qs('#filesList');
    if (!list) return;
    list.textContent = 'Loading…';
    try {
      const res = await fetch('/files', { cache: 'no-store' });
      if (!res.ok) throw new Error(`/files ${res.status}`);
      const entries = await res.json();
      if (!Array.isArray(entries) || entries.length === 0) {
        list.textContent = 'No files available.';
        return;
      }
      list.innerHTML = entries.map(e => {
        const href = buildFileUrl(e.name);
        const del = canDeleteFile(e) ? `<button type="button" class="btn btn-sm btn-outline-danger file-del" data-name="${e.name}">Delete</button>` : '';
        return `
          <div class="file-row">
            <a href="${href}" class="btn btn-sm btn-outline-primary file-open" data-name="${e.name}">${e.name}</a>
            <span class="file-meta">${e.storage} • ${fmt.sizeStr(e.size)}</span>
            ${del}
          </div>
        `;
      }).join('');

      qsa('.file-open', list).forEach(a => a.addEventListener('click', async (ev) => {
        ev.preventDefault();
        const name = ev.currentTarget.getAttribute('data-name');
        await openOverlay(name);
      }));
      qsa('.file-del', list).forEach(btn => btn.addEventListener('click', async (ev) => {
        ev.preventDefault();
        const name = ev.currentTarget.getAttribute('data-name');
        await deleteFile(name);
      }));
    } catch (err) {
      list.textContent = 'Failed to load files.';
      console.error('Error loading files:', err);
    }
  }

  async function openOverlay(name) {
    const back = qs('#overlayBackdrop');
    const title = qs('#overlayTitle');
    const content = qs('#overlayContent');
    const close = qs('#overlayClose');
    if (!back || !title || !content || !close) return;
    title.textContent = name;
    content.textContent = 'Loading…';
    back.style.display = 'block';
    const url = buildFileUrl(name);
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`${url} ${res.status}`);
      const text = await res.text();
      content.textContent = text;
    } catch (err) {
      content.textContent = 'Failed to load file.';
      console.error('Error loading file:', err);
    }
    close.onclick = () => closeOverlay();
    back.onclick = (e) => { if (e.target === back) closeOverlay(); };
  }

  function closeOverlay() {
    const back = qs('#overlayBackdrop');
    if (back) back.style.display = 'none';
  }

  async function deleteFile(name) {
    if (!confirm(`Delete ${name}?`)) return;
    const url = buildFileUrl(name);
    try {
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) throw new Error(`${url} ${res.status}`);
      await res.json();
      await loadFiles();
    } catch (err) {
      alert('Delete failed.');
      console.error('Error deleting file:', err);
    }
  }

  function setLastUpdated() {
    const el = qs('#lastUpdate');
    if (el) el.textContent = nowString();
  }

  async function refreshValues() {
    if (valuesInFlight) { valuesPending = true; return; }
    valuesInFlight = true;
    const controller = new AbortController();
    valuesAbort = controller;
    let timedOut = false;
    valuesTimeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 6000);

    try {
      const res = await fetch(ENDPOINTS.values, { cache: 'no-store', signal: controller.signal });
      if (!res.ok) throw new Error(`/values ${res.status}`);
      const data = await res.json();
      latestValues = data;

      const tempEl = qs('#temperature');
      const intEl = qs('#internalTemperature');
      const rhEl = qs('#internalHumidity');
      const tgtEl = qs('#targetTemperature');
      const contentEl = qs('header .tankContent b');

      if (tempEl) tempEl.textContent = fmt.c2(data.temp1);
      if (intEl) intEl.textContent = `${fmt.c2(data.int)}˚C`;
      if (rhEl && typeof data.intHumidity === 'number') rhEl.textContent = `${fmt.pct1(data.intHumidity)}%`;
      if (tgtEl) tgtEl.textContent = `${fmt.c2(data.targetTemp)}˚C`;
      if (contentEl) contentEl.textContent = (data.tank ?? data.content ?? '');

      updateStatusBox(data);
      updateFillControls(data);
      document.title = `Bevvy - ${fmt.c2(data.temp1)}˚C`;
      setLastUpdated();
    } catch (err) {
      const aborted = err && (err.name === 'AbortError' || err.message?.includes('AbortError'));
      console.error('Error fetching /values:', timedOut ? 'timeout' : err);
      const errorDiv = qs('#error');
      if (!timedOut && errorDiv) errorDiv.textContent = 'Error loading data. Please try again later.';
    } finally {
      clearTimeout(valuesTimeoutId);
      valuesTimeoutId = null;
      valuesAbort = null;
      valuesInFlight = false;
      if (valuesPending || timedOut) {
        valuesPending = false;
        setTimeout(refreshValues, 0);
      }
    }
  }

  async function submitForm(inputName, value) {
    const body = new URLSearchParams({ [inputName]: value });
    const res = await fetch(ENDPOINTS.form, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const data = await res.json().catch(() => ({ success: false, message: 'Invalid response' }));
    return data;
  }

  function attachHandlers() {
    // Enable/Disable toggle
    const toggle = qs('#enabledToggle');
    if (toggle) {
      toggle.addEventListener('change', async (e) => {
        const url = e.currentTarget.checked ? ENDPOINTS.enable : ENDPOINTS.disable;
        try {
          await fetch(url, { method: 'POST' });
        } catch (err) {
          console.error('Error toggling enabled:', err);
        }
      });
    }

    // Target form
    const targetForm = qs('form#set');
    if (targetForm) {
      targetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = qs('input[name="target"]', targetForm);
        const feedback = qs('#target-feedback');
        if (!input || !feedback) return;
        const value = input.value.trim();
        try {
          const resp = await submitForm('target', value);
          input.value = '';
          await refreshValues();
          feedback.style.display = 'block';
          if (resp.success) {
            feedback.classList.remove('alert-danger');
            feedback.classList.add('alert-success');
            feedback.textContent = `Success: The new target temperature is ${resp.target}˚C`;
            input.classList.remove('is-invalid');
            input.classList.add('is-valid');
            setTimeout(() => {
              input.classList.remove('is-valid');
              const section = qs('#set');
              if (section) section.style.display = 'none';
            }, 1500);
          } else {
            feedback.classList.remove('alert-success');
            feedback.classList.add('alert-danger');
            feedback.textContent = resp.message || 'An error occurred. Please try again.';
            input.classList.remove('is-valid');
            input.classList.add('is-invalid');
            setTimeout(() => input.classList.remove('is-invalid'), 2000);
          }
          setTimeout(() => { feedback.style.display = 'none'; }, 2000);
        } catch (err) {
          console.error('Error submitting target:', err);
        }
      });
    }

    // Name form
    const nameForm = qs('form#name');
    if (nameForm) {
      nameForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = qs('input[name="name"]', nameForm);
        const feedback = qs('#name-feedback');
        if (!input || !feedback) return;
        const value = input.value.trim();
        try {
          const resp = await submitForm('name', value);
          input.value = '';
          await refreshValues();
          feedback.style.display = 'block';
          if (resp.success) {
            feedback.classList.remove('alert-danger');
            feedback.classList.add('alert-success');
            feedback.textContent = `Success: Name saved.`;
            input.classList.remove('is-invalid');
            input.classList.add('is-valid');
            setTimeout(() => input.classList.remove('is-valid'), 1500);
          } else {
            feedback.classList.remove('alert-success');
            feedback.classList.add('alert-danger');
            feedback.textContent = resp.message || 'An error occurred. Please try again.';
            input.classList.remove('is-valid');
            input.classList.add('is-invalid');
            setTimeout(() => input.classList.remove('is-invalid'), 2000);
          }
          setTimeout(() => { feedback.style.display = 'none'; }, 2000);
        } catch (err) {
          console.error('Error submitting name:', err);
        }
      });
    }
  }

  // --- Init ---------------------------------------------------------------
  async function init() {
    try {
      const [values, info, modules] = await Promise.all([
        getJSON(ENDPOINTS.values),
        getJSON(ENDPOINTS.info),
        getJSON(ENDPOINTS.modules)
      ]);

      latestValues = values;
      document.title = `Brewery HLT - ${fmt.c2(values.temp1)}˚C`;
      document.body.innerHTML = renderPage(values, info, modules);

      installSectionToggles();
      attachHandlers();
      setLastUpdated();
      updateFillControls(values);

      // Start background refresh
      setInterval(refreshValues, 5000);
    } catch (err) {
      console.error('Error loading data:', err);
      document.body.innerHTML = '<p style="color:red;">Error loading data. Please try again later.</p>';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
