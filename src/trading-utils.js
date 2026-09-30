export function normalizePayoutPercent(value) {
  if (value === null || value === undefined || value === '') return 0;

  const numericValue = Number(String(value).trim().replace(/,/g, '.'));

  if (!Number.isFinite(numericValue)) return 0;

  // Accepts either 92 or 0.92; both represent 92%
  return numericValue > 1 ? numericValue : numericValue * 100;
}

export function calculateTradeProfit(entry, payout, result) {
  const normalizedEntry = Number(entry) || 0;
  const normalizedPayout = normalizePayoutPercent(payout);
  const normalizedResult = String(result || '').trim().toUpperCase();

  if (normalizedResult === 'WIN') {
    return Number((normalizedEntry * (normalizedPayout / 100)).toFixed(2));
  }

  if (normalizedResult === 'LOSS') {
    return Number((-normalizedEntry).toFixed(2));
  }

  return 0;
}
