/**
 * UI Controller
 * Handles DOM manipulation, event binding, and display updates.
 * Separates presentation logic from calculation logic.
 */

var UICtrl = (function () {
  // State
  var mode = 'risk-constrained';
  var direction = 'long';
  var tpLevels = [{ rr: 3, pct: 100 }];
  var currentContractId = 'BTC-USDT-SWAP';
  var openFeeType = 'maker';
  var openFeeRate = 0.02;
  var closeFeeType = 'taker';
  var closeFeeRate = 0.05;

  /**
   * Initialize the UI: bind events, load settings, set default state.
   */
  function init() {
    mode = 'risk-constrained';
    direction = 'long';
    tpLevels = [{ rr: 3, pct: 100 }];
    openFeeType = 'maker';
    openFeeRate = 0.02;
    closeFeeType = 'taker';
    closeFeeRate = 0.05;

    // Reset presets to factory defaults (ensures 1x leverage applies)
    resetPresets();

    // Load saved settings
    var settings = loadSettings();
    if (settings.lastMode) mode = settings.lastMode;
    if (settings.lastContractId) currentContractId = settings.lastContractId;

    // Populate contract dropdown
    populateContractSelect();
    // Populate preset dropdown
    populatePresetSelect();

    // Apply saved mode
    setMode(mode);

    // Bind events
    bindInputEvents();
    bindButtonEvents();

    // Load first preset
    applyPreset(0);

    // Update fee display
    updateFeeDisplay();

    // Start clock
    tickClock();
    setInterval(tickClock, 1000);
  }

  /**
   * Populate the contract selector.
   */
  function populateContractSelect() {
    var sel = document.getElementById('contractSelect');
    if (!sel) return;
    sel.innerHTML = '';
    var ids = Object.keys(OKX_CONTRACTS);
    for (var i = 0; i < ids.length; i++) {
      var c = OKX_CONTRACTS[ids[i]];
      var opt = document.createElement('option');
      opt.value = ids[i];
      opt.textContent = c.label;
      if (ids[i] === currentContractId) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  /**
   * Populate the preset selector.
   */
  function populatePresetSelect() {
    var sel = document.getElementById('presetSelect');
    if (!sel) return;
    var presets = loadPresets();
    sel.innerHTML = '';
    for (var i = 0; i < presets.length; i++) {
      var opt = document.createElement('option');
      opt.value = i;
      opt.textContent = presets[i].name;
      sel.appendChild(opt);
    }
  }

  /**
   * Apply a preset by index.
   */
  function applyPreset(index) {
    var presets = loadPresets();
    var p = presets[index];
    if (!p) return;

    setInputValue('capital', p.capital);
    setInputValue('riskPct', p.riskPct);
    setInputValue('rr', p.rr);
    setInputValue('entry', p.entry);
    setInputValue('leverage', p.leverage);
    currentContractId = p.contractId || 'BTC-USDT-SWAP';

    if (p.direction) {
      setDirection(p.direction);
    }

    // Load fee types from preset or default to maker/taker
    if (p.openFeeType) {
      openFeeType = p.openFeeType;
      openFeeRate = (openFeeType === 'maker') ? 0.02 : 0.05;
    }
    if (p.closeFeeType) {
      closeFeeType = p.closeFeeType;
      closeFeeRate = (closeFeeType === 'maker') ? 0.02 : 0.05;
    }
    // Update fee toggle buttons
    updateFeeToggleButtons();

    // Update contract select
    var contractSel = document.getElementById('contractSelect');
    if (contractSel) contractSel.value = currentContractId;

    // Update TP levels
    if (p.tpLevels && p.tpLevels.length > 0) {
      tpLevels = JSON.parse(JSON.stringify(p.tpLevels));
    } else {
      tpLevels = [{ rr: p.rr || 3, pct: 100 }];
    }
    renderTPList();

    // Update preset select
    var presetSel = document.getElementById('presetSelect');
    if (presetSel) presetSel.value = index;

    updateFeeDisplay();
    runCalculation();
  }

  /**
   * Save current state as a new preset.
   */
  function savePreset() {
    var name = prompt('Preset name:', 'My Setup');
    if (!name) return;

    var state = readInputs();
    state.tpLevels = tpLevels;
    saveCurrentAsPreset(state, name);
    populatePresetSelect();

    var sel = document.getElementById('presetSelect');
    if (sel) sel.value = loadPresets().length - 1;
    runCalculation();
  }

  /**
   * Delete the currently selected preset.
   */
  /**
   * Show a custom centered modal dialog.
   * @param {string} title
   * @param {string} message
   * @returns {Promise<boolean>} Resolves true if confirmed, false if cancelled
   */
  function showModal(title, message) {
    return new Promise(function (resolve) {
      var overlay = document.getElementById('modalOverlay');
      var titleEl = document.getElementById('modalTitle');
      var msgEl = document.getElementById('modalMessage');
      var confirmBtn = document.getElementById('modalConfirm');
      var cancelBtn = document.getElementById('modalCancel');

      if (!overlay) { resolve(false); return; }

      titleEl.textContent = title;
      msgEl.textContent = message;
      overlay.classList.add('open');

      function close(result) {
        overlay.classList.remove('open');
        confirmBtn.removeEventListener('click', onConfirm);
        cancelBtn.removeEventListener('click', onCancel);
        resolve(result);
      }

      function onConfirm() { close(true); }
      function onCancel() { close(false); }

      confirmBtn.addEventListener('click', onConfirm);
      cancelBtn.addEventListener('click', onCancel);
    });
  }

  function deleteSelectedPreset() {
    var sel = document.getElementById('presetSelect');
    if (!sel) return;
    var index = parseInt(sel.value, 10);
    if (isNaN(index)) return;

    var presets = loadPresets();
    if (presets.length <= 1) {
      showModal('Cannot Delete', 'You must keep at least one preset.');
      return;
    }

    showModal('Delete Preset', 'Delete preset "' + presets[index].name + '"?').then(function (confirmed) {
      if (!confirmed) return;
      deletePreset(index);
      populatePresetSelect();
      applyPreset(0);
    });
  }

  /**
   * Reset all presets to defaults.
   */
  function resetAllPresets() {
    showModal('Reset Presets', 'Reset ALL presets to factory defaults? This action cannot be undone.').then(function (confirmed) {
      if (!confirmed) return;
      resetPresets();
      populatePresetSelect();
      applyPreset(0);
    });
  }

  /**
   * Set calculator mode and toggle UI sections.
   */
  function setMode(newMode) {
    mode = newMode;
    var tabs = document.querySelectorAll('.mode-tabs button');
    tabs.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Show/hide mode-specific sections
    var slCard = document.getElementById('cardSLOverride');
    var sizeCard = document.getElementById('cardSizeOverride');

    if (slCard) slCard.style.display = (mode === 'sl-constrained') ? '' : 'none';
    if (sizeCard) sizeCard.style.display = (mode === 'size-constrained') ? '' : 'none';

    runCalculation();
  }

  /**
   * Set trade direction.
   */
  function setDirection(dir) {
    direction = dir;
    document.getElementById('btnLong').classList.toggle('active', dir === 'long');
    document.getElementById('btnShort').classList.toggle('active', dir === 'short');
    runCalculation();
  }

  /**
   * Set open/close fee type (maker or taker).
   */
  function setFeeType(side, type) {
    if (side === 'open') {
      openFeeType = type;
      openFeeRate = (type === 'maker') ? 0.02 : 0.05;
    } else {
      closeFeeType = type;
      closeFeeRate = (type === 'maker') ? 0.02 : 0.05;
    }
    updateFeeToggleButtons();
    updateFeeDisplay();
    runCalculation();
  }

  /**
   * Update fee toggle button states.
   */
  function updateFeeToggleButtons() {
    var openBtns = document.querySelectorAll('#toggleOpenFee button');
    var closeBtns = document.querySelectorAll('#toggleCloseFee button');

    openBtns.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.rate === String(openFeeRate));
    });
    closeBtns.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.rate === String(closeFeeRate));
    });
  }

  /**
   * Update the round-trip fee display.
   */
  function updateFeeDisplay() {
    var el = document.getElementById('totalFeeDisplay');
    if (el) {
      var total = openFeeRate + closeFeeRate;
      el.textContent = total.toFixed(2) + '%';
    }
  }

  /**
   * Step a number input up/down.
   */
  function stepInput(id, delta) {
    var input = document.getElementById(id);
    var step = parseFloat(input.step) || 1;
    var val = (parseFloat(input.value) || 0) + delta * step;
    var minVal = input.min !== '' ? parseFloat(input.min) : -Infinity;
    if (val < minVal) val = minVal;
    var stepStr = (input.step || '1');
    var decimals = stepStr.indexOf('.') >= 0 ? stepStr.split('.')[1].length : 0;
    input.value = val.toFixed(decimals);
    if (id === 'rr') syncRRToTPs();
    runCalculation();
  }

  /**
   * Sync the main RR input to all TP levels when only 1 TP exists.
   */
  function syncRRToTPs() {
    if (tpLevels.length === 1) {
      var rrVal = parseFloat(document.getElementById('rr').value) || 3;
      tpLevels[0].rr = rrVal;
      var rrInp = document.querySelector('.tp-entry .tp-rr');
      if (rrInp) rrInp.value = rrVal;
    }
  }

  // ── Multi-TP UI ────────────────────────────────────────

  /**
   * Add a new TP level.
   */
  function addTPLevel() {
    if (tpLevels.length >= 5) return;
    var remaining = 100 - tpLevels.reduce(function (s, t) { return s + t.pct; }, 0);
    if (remaining <= 0) remaining = 50;
    tpLevels.push({ rr: 2, pct: Math.min(remaining, 50) });
    normalizeTPPercentages();
    renderTPList();
    runCalculation();
  }

  /**
   * Remove a TP level by index.
   */
  function removeTPLevel(index) {
    if (tpLevels.length <= 1) return;
    tpLevels.splice(index, 1);
    normalizeTPPercentages();
    renderTPList();
    runCalculation();
  }

  /**
   * Update a TP level's RR or pct.
   */
  function updateTPLevel(index, field, value) {
    if (index < 0 || index >= tpLevels.length) return;
    if (field === 'rr') {
      tpLevels[index].rr = parseFloat(value) || 0;
    } else if (field === 'pct') {
      tpLevels[index].pct = parseInt(value, 10) || 0;
      normalizeTPPercentages();
    }
    renderTPList();
    runCalculation();
  }

  /**
   * Normalize TP percentages so they sum to 100.
   */
  function normalizeTPPercentages() {
    var total = tpLevels.reduce(function (s, t) { return s + t.pct; }, 0);
    if (total === 0 || total === 100) return;
    var diff = 100 - total;
    tpLevels[tpLevels.length - 1].pct += diff;
    if (tpLevels[tpLevels.length - 1].pct < 0) tpLevels[tpLevels.length - 1].pct = 0;
  }

  /**
   * Render the TP list in the DOM.
   */
  function renderTPList() {
    var container = document.getElementById('tpList');
    if (!container) return;

    var html = '';
    for (var i = 0; i < tpLevels.length; i++) {
      var level = tpLevels[i];
      html += '<div class="tp-entry">' +
        '<span class="tp-label">TP' + (i + 1) + '</span>' +
        '<span style="font-size:11px;color:var(--text-dim)">RR</span>' +
        '<input type="number" class="tp-rr" value="' + level.rr + '" step="0.5" min="0.5" onchange="UICtrl.updateTPLevel(' + i + ', \'rr\', this.value)">' +
        '<span style="font-size:11px;color:var(--text-dim)">%</span>' +
        '<input type="range" min="5" max="95" value="' + level.pct + '" style="flex:1;min-width:40px" oninput="UICtrl.updateTPLevel(' + i + ', \'pct\', this.value)">' +
        '<span style="font-size:11px;color:var(--text-dim);min-width:28px;text-align:right">' + level.pct + '%</span>' +
        (tpLevels.length > 1
          ? '<button class="tp-remove" onclick="UICtrl.removeTPLevel(' + i + ')" title="Remove">&times;</button>'
          : '') +
        '</div>';
    }
    container.innerHTML = html;

    var summary = document.getElementById('tpSummary');
    if (summary) {
      var total = tpLevels.reduce(function (s, t) { return s + t.pct; }, 0);
      summary.textContent = 'Total: ' + total + '% | ' + tpLevels.length + ' target(s)';
    }
  }

  // ── Input helpers ──────────────────────────────────────

  /**
   * Read all input values from the DOM.
   */
  function readInputs() {
    var feePct = openFeeRate + closeFeeRate;
    return {
      capital: parseFloat(document.getElementById('capital').value) || 0,
      riskPct: parseFloat(document.getElementById('riskPct').value) || 0,
      rr: parseFloat(document.getElementById('rr').value) || 0,
      feePct: feePct,
      openFeeType: openFeeType,
      closeFeeType: closeFeeType,
      direction: direction,
      entry: parseFloat(document.getElementById('entry').value) || 0,
      leverage: parseFloat(document.getElementById('leverage').value) || 0,
      contractId: document.getElementById('contractSelect').value,
      slDistOverride: mode === 'sl-constrained' ? (parseFloat(document.getElementById('slDistOverride').value) || 1) : null,
      sizeOverride: mode === 'size-constrained' ? (parseFloat(document.getElementById('sizeOverride').value) || 0) : null,
    };
  }

  /**
   * Set an input's value programmatically.
   */
  function setInputValue(id, value) {
    var el = document.getElementById(id);
    if (el) el.value = value;
  }

  // ── Event binding ──────────────────────────────────────

  function bindInputEvents() {
    var numberInputs = document.querySelectorAll('input[type=number]');
    numberInputs.forEach(function (el) {
      el.addEventListener('input', function () {
        if (el.id === 'rr') syncRRToTPs();
        runCalculation();
      });
    });

    var contractSel = document.getElementById('contractSelect');
    if (contractSel) {
      contractSel.addEventListener('change', function () {
        currentContractId = contractSel.value;
        runCalculation();
      });
    }

    var presetSel = document.getElementById('presetSelect');
    if (presetSel) {
      presetSel.addEventListener('change', function () {
        applyPreset(parseInt(presetSel.value, 10));
      });
    }
  }

  function bindButtonEvents() {
    // Mode tabs
    document.querySelectorAll('.mode-tabs button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setMode(btn.dataset.mode);
      });
    });

    // Direction buttons
    document.getElementById('btnLong').addEventListener('click', function () { setDirection('long'); });
    document.getElementById('btnShort').addEventListener('click', function () { setDirection('short'); });

    // Preset buttons
    var savePresetBtn = document.getElementById('savePresetBtn');
    if (savePresetBtn) savePresetBtn.addEventListener('click', savePreset);
    var delPresetBtn = document.getElementById('delPresetBtn');
    if (delPresetBtn) delPresetBtn.addEventListener('click', deleteSelectedPreset);
    var resetPresetsBtn = document.getElementById('resetPresetsBtn');
    if (resetPresetsBtn) resetPresetsBtn.addEventListener('click', resetAllPresets);

    // Collapsible toggles
    document.querySelectorAll('.collapsible-header').forEach(function (header) {
      header.addEventListener('click', function () {
        this.parentElement.classList.toggle('open');
      });
    });
  }

  // ── Calculation + render ──────────────────────────────

  /**
   * Run the calculator and update the display.
   */
  function runCalculation() {
    var inputs = readInputs();
    var params = {
      mode: mode,
      capital: inputs.capital,
      riskPct: inputs.riskPct,
      rr: inputs.rr,
      feePct: inputs.feePct,
      direction: inputs.direction,
      entry: inputs.entry,
      leverage: inputs.leverage,
      contractId: inputs.contractId,
      slDistOverride: inputs.slDistOverride,
      sizeOverride: inputs.sizeOverride,
      tpLevels: tpLevels,
    };

    var result = window.OKXCalc.calculate(params);

    // Update UI
    renderResults(result);

    // Save settings
    saveSettings({
      lastMode: mode,
      lastContractId: inputs.contractId,
    });
  }

  /**
   * Render calculation results into the DOM.
   */
  function renderResults(r) {
    // Risk amount
    setOut('outRisk', '$' + fmt(r.riskAmount, 2), 'rose');
    setOut('outFeeCost', '$' + fmt(r.feeCost, 2), '');
    setOut('outBudget', '$' + fmt(r.priceRiskBudget, 2), '');
    setOut('outSlPrice', '$' + fmt(r.slPrice, 2), 'rose');
    setOut('outSlDist', fmtPct(r.slDistPct, 3), '');
    setOut('outSlDistDollar', '$' + fmt(r.slDistDollar, 2), '');
    setOut('outNetLoss', '$' + fmt(r.netLoss, 2), 'rose');
    setOut('outNotional', '$' + fmt(r.notional, 2), 'teal');
    setOut('outUnits', fmt(r.units, 6), '');
    setOut('outLiq', '$' + fmt(r.liqPrice, 2), '');
    setOut('outMMR', fmtPct(r.mmr, 2), '');
    setOut('outMaxLev', fmt(r.maxRecLeverage, 0) + 'x', '');

    // Funding
    setOut('outFunding', '$' + fmt(r.fundingEstimate8h, 4), '');

    // Implied risk % (for sl-constrained / size-constrained modes)
    var impliedRiskEl = document.getElementById('outImpliedRisk');
    if (impliedRiskEl) {
      if (mode !== 'risk-constrained') {
        impliedRiskEl.parentElement.style.display = '';
        impliedRiskEl.textContent = fmtPct(r.riskPct / 100, 2);
      } else {
        impliedRiskEl.parentElement.style.display = 'none';
      }
    }

    // TP results
    renderTPResults(r.tpResults);

    // TP price display (single vs avg)
    var avgRow = document.getElementById('avgTpRow');
    var singleRow = document.getElementById('singleTpRow');

    if (r.tpResults.length > 1) {
      setOut('outAvgTp', '$' + fmt(r.avgTpPrice, 2), 'gold');
      setOut('outTpDist', fmtPct(r.avgTpDistPct, 3), '');
      setOut('outNetProfit', '$' + fmt(r.avgNetProfit, 2), 'gold');
      if (avgRow) avgRow.style.display = '';
      if (singleRow) singleRow.style.display = 'none';
    } else if (r.tpResults.length === 1) {
      var t = r.tpResults[0];
      setOut('outTp', '$' + fmt(t.price, 2), 'gold');
      setOut('outTpDist', fmtPct(t.distPct, 3), '');
      setOut('outNetProfit', '$' + fmt(t.netProfit, 2), 'gold');
      if (avgRow) avgRow.style.display = 'none';
      if (singleRow) singleRow.style.display = '';
    } else {
      if (avgRow) avgRow.style.display = 'none';
      if (singleRow) {
        singleRow.style.display = '';
        setOut('outTp', '—', '');
      }
      setOut('outTpDist', '—', '');
      setOut('outNetProfit', '—', '');
    }

    // Banner
    var banner = document.getElementById('banner');
    if (r.error) {
      banner.className = 'banner warn';
      banner.textContent = r.error;
    } else if (r.warning) {
      banner.className = 'banner warn';
      banner.textContent = r.warning;
    } else if (r.valid) {
      banner.className = 'banner safe';
      banner.textContent = 'Liquidation sits beyond your stop loss. Max recommended leverage: ' + r.maxRecLeverage + 'x';
    } else {
      banner.className = 'banner info';
      banner.textContent = 'Adjust inputs to see results.';
    }
  }

  /**
   * Render multi-TP breakdown.
   */
  function renderTPResults(tpResults) {
    var container = document.getElementById('tpResultsList');
    var section = document.getElementById('tpResultsSection');
    if (!container) return;

    if (!tpResults || tpResults.length === 0) {
      container.innerHTML = '';
      if (section) section.style.display = 'none';
      return;
    }

    var html = '';
    for (var i = 0; i < tpResults.length; i++) {
      var t = tpResults[i];
      html += '<div class="tp-output-tag">' +
        'TP' + (i + 1) + ' (' + t.pct.toFixed(0) + '%): ' +
        '$' + fmt(t.price, 2) + ' | ' +
        fmtPct(t.distPct, 3) + ' | ' +
        '+$' + fmt(t.netProfit, 2) +
        '</div>';
    }
    container.innerHTML = html;

    if (section) section.style.display = '';
  }

  /**
   * Set output text content.
   */
  function setOut(id, text, cls) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = 'v';
    if (cls) el.classList.add(cls);
  }

  // ── Clock ──────────────────────────────────────────────

  function tickClock() {
    var el = document.getElementById('clock');
    if (el) el.textContent = new Date().toLocaleTimeString();
  }

  // ── Public API ─────────────────────────────────────────

  return {
    init: init,
    setMode: setMode,
    setDirection: setDirection,
    setFeeType: setFeeType,
    stepInput: stepInput,
    addTPLevel: addTPLevel,
    removeTPLevel: removeTPLevel,
    updateTPLevel: updateTPLevel,
    savePreset: savePreset,
    runCalculation: runCalculation,
  };
})();