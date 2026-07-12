/**
 * LocalStorage-based configuration persister.
 * Handles saving/loading presets and user preferences.
 */

const PRESETS_STORAGE_KEY = 'okx_calc_presets';
const SETTINGS_STORAGE_KEY = 'okx_calc_settings';

/**
 * Default presets covering common trading scenarios.
 * Each preset stores all calculator inputs.
 */
const DEFAULT_PRESETS = [
  {
    name: 'BTC — 1% Risk / 1×',
    capital: 100,
    riskPct: 1,
    rr: 3,
    feePct: 0.07,
    direction: 'long',
    entry: 64500,
    leverage: 1,
    contractId: 'BTC-USDT-SWAP',
    openFeeType: 'maker',
    closeFeeType: 'taker',
    tpLevels: [{ rr: 3, pct: 100 }],
  },
  {
    name: 'ETH — 1% Risk / 1×',
    capital: 100,
    riskPct: 1,
    rr: 3,
    feePct: 0.07,
    direction: 'long',
    entry: 3100,
    leverage: 1,
    contractId: 'ETH-USDT-SWAP',
    openFeeType: 'maker',
    closeFeeType: 'taker',
    tpLevels: [{ rr: 3, pct: 100 }],
  },
  {
    name: 'SOL — 2% Risk / 1×',
    capital: 100,
    riskPct: 2,
    rr: 2,
    feePct: 0.07,
    direction: 'long',
    entry: 140,
    leverage: 1,
    contractId: 'SOL-USDT-SWAP',
    openFeeType: 'maker',
    closeFeeType: 'taker',
    tpLevels: [{ rr: 2, pct: 100 }],
  },
  {
    name: 'Scalp — 0.5% Risk / 1×',
    capital: 100,
    riskPct: 0.5,
    rr: 1.5,
    feePct: 0.04,
    direction: 'long',
    entry: 64500,
    leverage: 1,
    contractId: 'BTC-USDT-SWAP',
    openFeeType: 'maker',
    closeFeeType: 'maker',
    tpLevels: [{ rr: 1.5, pct: 100 }],
  },
  {
    name: 'BTC Short — 1% Risk / 1×',
    capital: 100,
    riskPct: 1,
    rr: 3,
    feePct: 0.07,
    direction: 'short',
    entry: 64500,
    leverage: 1,
    contractId: 'BTC-USDT-SWAP',
    openFeeType: 'maker',
    closeFeeType: 'taker',
    tpLevels: [{ rr: 3, pct: 100 }],
  },
];

/**
 * Load presets from localStorage, falling back to defaults.
 * @returns {Array}
 */
function loadPresets() {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load presets, using defaults.', e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_PRESETS)); // deep clone
}

/**
 * Save presets to localStorage.
 * @param {Array} presets
 */
function savePresets(presets) {
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch (e) {
    console.warn('Failed to save presets.', e);
  }
}

/**
 * Reset presets back to factory defaults.
 * @returns {Array} The default presets
 */
function resetPresets() {
  const defaults = JSON.parse(JSON.stringify(DEFAULT_PRESETS));
  savePresets(defaults);
  return defaults;
}

/**
 * Save current calculator state as a new preset.
 * @param {Object} state - The full calculator state
 * @param {string} name - Custom name for the preset
 * @returns {Array} Updated presets array
 */
function saveCurrentAsPreset(state, name) {
  const presets = loadPresets();
  const preset = {
    name: name || 'Preset ' + (presets.length + 1),
    capital: state.capital,
    riskPct: state.riskPct,
    rr: state.rr,
    feePct: state.feePct,
    direction: state.direction,
    entry: state.entry,
    leverage: state.leverage,
    contractId: state.contractId,
    openFeeType: state.openFeeType || 'maker',
    closeFeeType: state.closeFeeType || 'taker',
    slDistOverride: state.slDistOverride || null,
    tpLevels: JSON.parse(JSON.stringify(state.tpLevels || [{ rr: state.rr, pct: 100 }])),
  };
  presets.push(preset);
  savePresets(presets);
  return presets;
}

/**
 * Delete a preset by index.
 * @param {number} index 
 * @returns {Array} Updated presets array
 */
function deletePreset(index) {
  const presets = loadPresets();
  if (index >= 0 && index < presets.length) {
    presets.splice(index, 1);
    savePresets(presets);
  }
  return presets;
}

/**
 * Load user settings (UI preferences).
 * @returns {Object}
 */
function loadSettings() {
  const defaults = {
    lastMode: 'risk-constrained',
    lastContractId: 'BTC-USDT-SWAP',
    showAdvanced: false,
  };
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      return Object.assign({}, defaults, JSON.parse(raw));
    }
  } catch (e) {
    console.warn('Failed to load settings.', e);
  }
  return defaults;
}

/**
 * Save user settings.
 * @param {Object} settings 
 */
function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save settings.', e);
  }
}