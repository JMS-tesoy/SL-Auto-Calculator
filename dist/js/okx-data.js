/**
 * OKX Maintenance Margin Tiers & Contract Configuration
 * 
 * Maintenance margin ratio (MMR) determines the liquidation price.
 * These tiers are based on OKX's tiered margin system for perpetual swaps.
 * Values are simplified approximations — actual tiers vary by position size.
 */

const OKX_TIERS = {
  // Maintenance margin tiers for major perpetual contracts
  // Tier index: max position notional, maintenance margin rate
  default: [
    { maxNotional: 50000,    mmr: 0.005  }, // 0.50%
    { maxNotional: 250000,   mmr: 0.01   }, // 1.00%
    { maxNotional: 1000000,  mmr: 0.015  }, // 1.50%
    { maxNotional: 5000000,  mmr: 0.02   }, // 2.00%
    { maxNotional: 20000000, mmr: 0.03   }, // 3.00%
    { maxNotional: 50000000, mmr: 0.04   }, // 4.00%
    { maxNotional: Infinity, mmr: 0.05   }, // 5.00%
  ],
  // BTC-specific tiers (higher notional thresholds)
  btc: [
    { maxNotional: 100000,   mmr: 0.005  },
    { maxNotional: 500000,   mmr: 0.01   },
    { maxNotional: 2000000,  mmr: 0.015  },
    { maxNotional: 10000000, mmr: 0.02   },
    { maxNotional: 40000000, mmr: 0.03   },
    { maxNotional: 100000000,mmr: 0.04   },
    { maxNotional: Infinity, mmr: 0.05   },
  ],
  // ETH-specific tiers
  eth: [
    { maxNotional: 50000,    mmr: 0.005  },
    { maxNotional: 250000,   mmr: 0.01   },
    { maxNotional: 1000000,  mmr: 0.015  },
    { maxNotional: 5000000,  mmr: 0.02   },
    { maxNotional: 20000000, mmr: 0.03   },
    { maxNotional: 50000000, mmr: 0.04   },
    { maxNotional: Infinity, mmr: 0.05   },
  ],
};

/**
 * Pre-configured contracts with tick size and min order data.
 * For realistic position sizing, especially for altcoins.
 */
const OKX_CONTRACTS = {
  'BTC-USDT-SWAP':  { label: 'BTC/USDT Perp', tickSize: 0.1,  minOrder: 1,     minNotional: 3,   tiers: 'btc' },
  'ETH-USDT-SWAP':  { label: 'ETH/USDT Perp', tickSize: 0.01, minOrder: 1,     minNotional: 1,   tiers: 'eth' },
  'SOL-USDT-SWAP':  { label: 'SOL/USDT Perp', tickSize: 0.01, minOrder: 1,     minNotional: 1,   tiers: 'default' },
  'DOGE-USDT-SWAP': { label: 'DOGE/USDT Perp',tickSize: 0.00001, minOrder: 100, minNotional: 1, tiers: 'default' },
  'XRP-USDT-SWAP':  { label: 'XRP/USDT Perp', tickSize: 0.0001, minOrder: 1,   minNotional: 1,   tiers: 'default' },
  'ADA-USDT-SWAP':  { label: 'ADA/USDT Perp', tickSize: 0.0001, minOrder: 1,   minNotional: 1,   tiers: 'default' },
  'AVAX-USDT-SWAP': { label: 'AVAX/USDT Perp',tickSize: 0.01, minOrder: 1,     minNotional: 1,   tiers: 'default' },
  'DOT-USDT-SWAP':  { label: 'DOT/USDT Perp', tickSize: 0.001, minOrder: 1,    minNotional: 1,   tiers: 'default' },
  'LINK-USDT-SWAP': { label: 'LINK/USDT Perp',tickSize: 0.001, minOrder: 1,    minNotional: 1,   tiers: 'default' },
  'MATIC-USDT-SWAP':{ label: 'MATIC/USDT Perp',tickSize: 0.0001, minOrder: 1,  minNotional: 1,   tiers: 'default' },
  'SUI-USDT-SWAP':  { label: 'SUI/USDT Perp', tickSize: 0.0001, minOrder: 1,   minNotional: 1,   tiers: 'default' },
  'APT-USDT-SWAP':  { label: 'APT/USDT Perp', tickSize: 0.001, minOrder: 1,    minNotional: 1,   tiers: 'default' },
  'ARB-USDT-SWAP':  { label: 'ARB/USDT Perp', tickSize: 0.0001, minOrder: 1,   minNotional: 1,   tiers: 'default' },
  'OP-USDT-SWAP':   { label: 'OP/USDT Perp',  tickSize: 0.0001, minOrder: 1,   minNotional: 1,   tiers: 'default' },
};

/**
 * Get the maintenance margin rate for a given contract and position notional.
 * Uses tiered lookup: finds the tier where notional <= tier's maxNotional.
 * 
 * @param {string} contractId - e.g. 'BTC-USDT-SWAP'
 * @param {number} notional - Position notional in USD
 * @returns {number} Maintenance margin rate (e.g. 0.01 = 1%)
 */
function getMMR(contractId, notional) {
  const contract = OKX_CONTRACTS[contractId];
  if (!contract) {
    // Fallback: use default tiers
    return getMMRByTiers(OKX_TIERS.default, notional);
  }
  const tierKey = contract.tiers || 'default';
  const tiers = OKX_TIERS[tierKey] || OKX_TIERS.default;
  return getMMRByTiers(tiers, notional);
}

/**
 * @param {Array<{maxNotional: number, mmr: number}>} tiers 
 * @param {number} notional 
 * @returns {number}
 */
function getMMRByTiers(tiers, notional) {
  for (const tier of tiers) {
    if (notional <= tier.maxNotional) {
      return tier.mmr;
    }
  }
  return 0.05; // fallback highest tier
}

/**
 * Calculate liquidation price with OKX-style formula.
 * 
 * For isolated margin with full capital used:
 *   liquidationPrice (long)  = entry * (1 - 1/lev + mmr)
 *   liquidationPrice (short) = entry * (1 + 1/lev - mmr)
 * 
 * This accounts for the maintenance margin buffer needed
 * to avoid liquidation.
 * 
 * @param {string} direction - 'long' or 'short'
 * @param {number} entry - Entry price
 * @param {number} leverage - Leverage multiplier
 * @param {number} mmr - Maintenance margin rate
 * @returns {number} Estimated liquidation price
 */
function calcLiquidationPrice(direction, entry, leverage, mmr) {
  if (entry <= 0 || leverage <= 0) return NaN;

  if (direction === 'long') {
    // Liq = Entry × (1 − 1/Leverage + MMR)
    return entry * (1 - 1 / leverage + mmr);
  } else {
    // Liq = Entry × (1 + 1/Leverage − MMR)
    return entry * (1 + 1 / leverage - mmr);
  }
}

/**
 * Format a number to a fixed number of decimal places with locale grouping.
 * Returns '—' for NaN or Infinity.
 * 
 * @param {number} n 
 * @param {number} decimals 
 * @returns {string}
 */
function fmt(n, decimals) {
  if (!isFinite(n) || isNaN(n)) return '—';
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format currency with $ prefix.
 * @param {number} n 
 * @param {number} decimals 
 * @returns {string}
 */
function fmtUSD(n, decimals = 2) {
  return '$' + fmt(n, decimals);
}

/**
 * Format percentage.
 * @param {number} ratio - e.g. 0.015 for 1.5%
 * @param {number} decimals 
 * @returns {string}
 */
function fmtPct(ratio, decimals = 3) {
  return fmt(ratio * 100, decimals) + '%';
}

/**
 * Round to the nearest tick size.
 * @param {number} price 
 * @param {number} tickSize 
 * @returns {number}
 */
function roundToTick(price, tickSize) {
  if (tickSize <= 0) return price;
  return Math.round(price / tickSize) * tickSize;
}

/**
 * Validate a numeric input, clamping to min/max and returning a safe value.
 * @param {number} value 
 * @param {number} min 
 * @param {number} max 
 * @param {number} fallback 
 * @returns {number}
 */
function clamp(value, min, max, fallback = 0) {
  if (!isFinite(value) || isNaN(value)) return fallback;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}