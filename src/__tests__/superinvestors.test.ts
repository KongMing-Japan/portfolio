import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SuperinvestorData } from '../types';

const data = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'public/data/superinvestors.json'),
    'utf8',
  ),
) as SuperinvestorData;

describe('superinvestor 13F data', () => {
  it('contains the configured investors and current filings', () => {
    expect(data.investors).toHaveLength(4);
    expect(data.investors.map((investor) => investor.name)).toEqual([
      'Warren Buffett',
      'Bill Ackman',
      'David Tepper',
      'Cathie Wood',
    ]);
    expect(
      data.investors.every(
        (investor) => investor.reportDate && investor.filingUrl.startsWith('https://www.sec.gov/'),
      ),
    ).toBe(true);
  });

  it('keeps portfolio weights normalized after CUSIP aggregation', () => {
    for (const investor of data.investors) {
      const totalWeight = investor.holdings.reduce(
        (sum, holding) => sum + holding.weight,
        0,
      );
      expect(totalWeight).toBeCloseTo(1, 8);
      expect(investor.holdings).toHaveLength(investor.positionCount);
      expect(investor.topMoves.length).toBeGreaterThan(0);
    }
  });
});
