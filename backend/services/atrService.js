import YahooFinance from "yahoo-finance2";

const yahoo = new YahooFinance();

/*
  ATR Service

  This estimates the Average True Range for each asset.
  Used by the bias engine to produce better expected move estimates.
*/

const ATR_LOOKBACK_DAYS = 14;

/**
 * Fetch ATR for a symbol
 */
export async function fetchATR(symbol) {
  try {
    const history = await yahoo.historical(symbol, {
      period1: getStartDate(),
      interval: "1d",
    });

    if (!history || history.length < ATR_LOOKBACK_DAYS + 2) {
      return null;
    }

    const candles = history.slice(-ATR_LOOKBACK_DAYS - 1);

    let totalTR = 0;

    for (let i = 1; i < candles.length; i++) {
      const prevClose = candles[i - 1].close;
      const high = candles[i].high;
      const low = candles[i].low;

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );

      totalTR += tr;
    }

    const atr = totalTR / ATR_LOOKBACK_DAYS;

    return Number(atr.toFixed(4));
  } catch (err) {
    console.error(`ATR fetch failed for ${symbol}:`, err.message);
    return null;
  }
}

/**
 * Fetch ATR for all assets
 */
export async function fetchATRForAssets(symbolMap = {}) {
  const results = {};

  for (const asset in symbolMap) {
    try {
      const atr = await fetchATR(symbolMap[asset]);
      results[asset] = atr;
    } catch (err) {
      results[asset] = null;
    }
  }

  return results;
}

/**
 * ATR based expected move
 */
export function estimateMoveFromATR(price, atr, confidence = 50) {
  if (!price || !atr) return null;

  const multiplier = 0.35 + confidence / 200;

  const move = atr * multiplier;

  return Number(move.toFixed(3));
}

function getStartDate() {
  const now = new Date();
  now.setDate(now.getDate() - 40);
  return now;
}