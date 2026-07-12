/**
 * Core Calculator Engine
 *
 * Supports three calculation modes:
 * 1. risk-constrained  — You set risk %, it calculates SL distance & position size
 * 2. sl-constrained    — You set SL distance, it calculates risk % & position size
 * 3. size-constrained  — You set position size, it calculates SL distance & risk %
 *
 * Also handles multi-TP levels, funding rate estimation, and
 * accurate OKX liquidation with maintenance margin tiers.
 */

/**
 * Main calculation function.
 * @param {Object} params - See individual property docs below
 * @returns {Object} Full calculation result
 */
function calculate(params) {
  var mode = params.mode || 'risk-constrained';
  var capital = params.capital || 100;
  var riskPct = params.riskPct || 1;
  var rr = params.rr || 3;
  var feePct = params.feePct || 0.10;
  var direction = params.direction || 'long';
  var entry = params.entry || 0;
  var leverage = params.leverage || 1;
  var contractId = params.contractId || 'BTC-USDT-SWAP';
  var slDistOverride = params.slDistOverride || null;
  var sizeOverride = params.sizeOverride || null;
  var tpLevels = params.tpLevels || [{ rr: 3, pct: 100 }];

  var result = {
    mode: mode,
    capital: capital,
    riskPct: riskPct,
    rr: rr,
    feePct: feePct,
    direction: direction,
    entry: entry,
    leverage: leverage,
    contractId: contractId,
    tpLevels: tpLevels,
    riskAmount: 0,
    feeCost: 0,
    priceRiskBudget: 0,
    slDistPct: 0,
    slDistDollar: 0,
    slPrice: 0,
    netLoss: 0,
    notional: 0,
    units: 0,
    liqPrice: 0,
    mmr: 0,
    tpResults: [],
    avgTpPrice: 0,
    avgTpDistPct: 0,
    avgNetProfit: 0,
    fundingEstimate8h: 0,
    valid: false,
    warning: null,
    error: null,
    maxRecLeverage: 0,
  };

  // Early validation
  if (entry <= 0 || leverage <= 0 || capital <= 0) {
    result.error = 'Enter valid entry price, leverage, and capital.';
    return result;
  }

  if (riskPct <= 0) {
    result.error = 'Risk percentage must be greater than 0.';
    return result;
  }

  var riskAmount = capital * (riskPct / 100);
  var notional = capital * leverage;
  var feeRate = feePct / 100;
  var feeCost = notional * feeRate;

  result.riskAmount = riskAmount;
  result.feeCost = feeCost;
  result.notional = notional;

  var priceRiskBudget, slDistPct, slDistDollar, units;

  switch (mode) {
    case 'risk-constrained':
      priceRiskBudget = riskAmount - feeCost;
      if (priceRiskBudget <= 0) {
        result.priceRiskBudget = priceRiskBudget;
        result.warning = 'Fee cost exceeds risk cap at this leverage. Lower leverage or raise risk %.';
        return result;
      }
      slDistPct = priceRiskBudget / notional;
      slDistDollar = slDistPct * entry;
      units = notional / entry;
      break;

    case 'sl-constrained':
      var slPct = (slDistOverride || 1) / 100;
      slDistPct = slPct;
      slDistDollar = slDistPct * entry;
      units = notional / entry;
      priceRiskBudget = slDistPct * notional;
      var impliedRiskAmount = priceRiskBudget + feeCost;
      var impliedRiskPct = (impliedRiskAmount / capital) * 100;
      result.riskPct = impliedRiskPct;
      result.riskAmount = impliedRiskAmount;
      result.priceRiskBudget = priceRiskBudget;
      if (impliedRiskAmount <= 0) {
        result.warning = 'SL distance is too small to cover fees.';
        return result;
      }
      break;

    case 'size-constrained':
      units = sizeOverride || (capital / entry);
      var actualNotional = units * entry;
      var impliedLeverage = actualNotional / capital;
      result.notional = actualNotional;
      result.leverage = impliedLeverage;
      var actualFeeCost = actualNotional * feeRate;
      result.feeCost = actualFeeCost;
      priceRiskBudget = riskAmount - actualFeeCost;
      if (priceRiskBudget <= 0) {
        result.priceRiskBudget = priceRiskBudget;
        result.warning = 'Fee cost exceeds risk cap at this position size.';
        return result;
      }
      slDistPct = priceRiskBudget / actualNotional;
      slDistDollar = slDistPct * entry;
      break;

    default:
      result.error = 'Unknown calculation mode.';
      return result;
  }

  result.priceRiskBudget = priceRiskBudget;
  result.slDistPct = slDistPct;
  result.slDistDollar = slDistDollar;
  result.units = units;

  var slPrice = direction === 'long' ? entry - slDistDollar : entry + slDistDollar;
  result.slPrice = slPrice < 0 ? 0 : slPrice;

  result.netLoss = priceRiskBudget + feeCost;

  // Liq with MMR tiers
  var mmr = getMMR(contractId, result.notional);
  result.mmr = mmr;
  result.liqPrice = calcLiquidationPrice(direction, entry, leverage, mmr);

  // Max recommended leverage for this SL distance
  result.maxRecLeverage = maxRecommendedLeverage(slDistPct, mmr);

  // Multi-TP
  result.tpResults = calculateTPLevels({
    direction: direction,
    entry: entry,
    units: units,
    feeCost: feeCost,
    riskAmount: riskAmount,
    tpLevels: tpLevels,
    notional: result.notional,
  });

  if (result.tpResults.length > 0) {
    var totalPct = 0;
    for (var i = 0; i < result.tpResults.length; i++) {
      totalPct += result.tpResults[i].pct;
    }
    if (totalPct > 0) {
      result.avgTpPrice = result.tpResults.reduce(function(sum, t) { return sum + t.price * t.pct; }, 0) / totalPct;
      result.avgTpDistPct = result.tpResults.reduce(function(sum, t) { return sum + t.distPct * t.pct; }, 0) / totalPct;
      result.avgNetProfit = result.tpResults.reduce(function(sum, t) { return sum + t.netProfit * t.pct; }, 0) / totalPct;
    }
  }

  // Funding estimate
  result.fundingEstimate8h = estimateFunding(result.notional, 0.01);

  // Liquidation safety
  if (result.liqPrice && result.slPrice > 0 && !isNaN(result.liqPrice)) {
    var liqSafe = direction === 'long' ? result.liqPrice < result.slPrice : result.liqPrice > result.slPrice;
    if (!liqSafe) {
      result.warning = 'Liquidation is closer than your stop loss. Lower the leverage.';
    }
  }

  result.valid = true;
  return result;
}

/**
 * Calculate individual TP levels with fee-adjusted net profit.
 */
function calculateTPLevels(params) {
  var direction = params.direction;
  var entry = params.entry;
  var units = params.units;
  var feeCost = params.feeCost;
  var riskAmount = params.riskAmount;
  var tpLevels = params.tpLevels;
  var notional = params.notional;

  if (!tpLevels || tpLevels.length === 0) return [];

  var results = [];
  for (var i = 0; i < tpLevels.length; i++) {
    var level = tpLevels[i];
    var tpRr = level.rr || 0;
    var pct = (level.pct || 0) / 100;
    if (pct <= 0) continue;

    var allocatedRisk = riskAmount * pct;
    var targetNet = tpRr * allocatedRisk;
    var allocatedFee = feeCost * pct;
    var grossNeeded = targetNet + allocatedFee;

    var tpDistDollar = (units * pct) > 0 ? grossNeeded / (units * pct) : 0;
    var tpPrice = direction === 'long' ? entry + tpDistDollar : entry - tpDistDollar;
    var tpDistPct = entry > 0 ? tpDistDollar / entry : 0;
    var unitsClosed = units * pct;
    var grossProfit = unitsClosed * tpDistDollar;
    var netProfit = grossProfit - allocatedFee;

    results.push({
      rr: tpRr,
      pct: pct * 100,
      price: tpPrice > 0 ? tpPrice : 0,
      distPct: tpDistPct,
      distDollar: tpDistDollar,
      unitsClosed: unitsClosed,
      grossProfit: grossProfit,
      netProfit: netProfit,
      allocatedFee: allocatedFee,
    });
  }
  return results;
}

/**
 * Estimate funding cost for one 8-hour settlement.
 */
function estimateFunding(notional, fundingRate) {
  if (!fundingRate) fundingRate = 0.0001;
  return notional * fundingRate;
}

/**
 * Calculate max recommended leverage for a given SL distance.
 */
function maxRecommendedLeverage(slDistPct, mmr, bufferPct) {
  if (!mmr) mmr = 0.01;
  if (!bufferPct) bufferPct = 0.005;
  var safeDist = slDistPct + bufferPct;
  if (safeDist <= mmr) return 1;
  return Math.floor(1 / (safeDist + mmr));
}

if (typeof window !== 'undefined') {
  window.OKXCalc = {
    calculate: calculate,
    calculateTPLevels: calculateTPLevels,
    estimateFunding: estimateFunding,
    maxRecommendedLeverage: maxRecommendedLeverage,
  };
}