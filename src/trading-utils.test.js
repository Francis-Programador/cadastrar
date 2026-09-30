import { describe, expect, it } from 'vitest';
import { normalizePayoutPercent, calculateTradeProfit } from './trading-utils.js';

describe('trading payout normalization', () => {
  it('accepts decimal and percentage payout formats', () => {
    expect(normalizePayoutPercent(92)).toBe(92);
    expect(normalizePayoutPercent('0.92')).toBe(92);
    expect(normalizePayoutPercent('92')).toBe(92);
    expect(normalizePayoutPercent(0.92)).toBe(92);
  });

  it('calculates win and loss using normalized payout', () => {
    expect(calculateTradeProfit(10, 0.92, 'WIN')).toBe(9.2);
    expect(calculateTradeProfit(10, '92', 'WIN')).toBe(9.2);
    expect(calculateTradeProfit(10, 92, 'LOSS')).toBe(-10);
  });
});
