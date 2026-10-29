// scripts/seed-d1.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { REAL_PORTFOLIO_SNAPSHOT } from '../src/lib/realPortfolioData.ts';

const USER_ID = 'usr_owner_main';
const USERNAME = 'owner';
const PASSWORD_HASH = crypto.createHash('sha256').update('888888').digest('hex');

const PORTFOLIO_ID = 'port_default_jpy';
const PORTFOLIO_NAME = '我的组合';
const BASE_CURRENCY = REAL_PORTFOLIO_SNAPSHOT.baseCurrency || 'JPY';
const FX_JSON = JSON.stringify(REAL_PORTFOLIO_SNAPSHOT.fx || { JPY: 1, USD: 157.97, HKD: 20.13, CNY: 23.61 });
const QUOTE_UPDATED_AT = REAL_PORTFOLIO_SNAPSHOT.quoteUpdatedAt || new Date().toISOString();

function esc(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return Number.isFinite(val) ? val.toString() : 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

const sqlStatements = [];

// 1. Insert or ignore owner user
sqlStatements.push(`
INSERT INTO users (id, username, password_hash)
VALUES (${esc(USER_ID)}, ${esc(USERNAME)}, ${esc(PASSWORD_HASH)})
ON CONFLICT (username) DO UPDATE SET password_hash = ${esc(PASSWORD_HASH)};
`.trim());

// 2. Insert or update default portfolio
sqlStatements.push(`
INSERT INTO portfolios (id, user_id, name, base_currency, fx_json, quote_updated_at)
VALUES (${esc(PORTFOLIO_ID)}, ${esc(USER_ID)}, ${esc(PORTFOLIO_NAME)}, ${esc(BASE_CURRENCY)}, ${esc(FX_JSON)}, ${esc(QUOTE_UPDATED_AT)})
ON CONFLICT (id) DO UPDATE SET
  base_currency = ${esc(BASE_CURRENCY)},
  fx_json = ${esc(FX_JSON)},
  quote_updated_at = ${esc(QUOTE_UPDATED_AT)},
  updated_at = CURRENT_TIMESTAMP;
`.trim());

// 3. Clear existing holdings for clean initial seed
sqlStatements.push(`DELETE FROM holdings WHERE portfolio_id = ${esc(PORTFOLIO_ID)};`);

// 4. Insert each holding
REAL_PORTFOLIO_SNAPSHOT.holdings.forEach((h, index) => {
  const mktValue = h.marketValue ?? (h.marketPrice != null ? h.marketPrice * h.quantity : h.importedMarketValue);
  sqlStatements.push(`
INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  ${esc(h.id || `hld_${index + 1}`)},
  ${esc(PORTFOLIO_ID)},
  ${esc(h.ticker)},
  ${esc(h.name)},
  ${esc(h.broker)},
  ${esc(h.account)},
  ${esc(h.market)},
  ${esc(h.currency)},
  ${esc(h.quantity)},
  ${esc(h.costPerUnit)},
  ${esc(h.marketPrice)},
  ${esc(mktValue)},
  ${esc(h.layer)},
  ${esc(h.theme)},
  ${esc(h.sourceType || 'manual')},
  ${esc(h.confidence ?? 1.0)},
  ${esc(h.investmentThesis || '')},
  ${index}
);
  `.trim());
});

const sqlFilePath = path.resolve('migrations/seed_data.sql');
fs.writeFileSync(sqlFilePath, sqlStatements.join('\n\n'), 'utf8');
console.log(`Generated ${sqlStatements.length} SQL statements in ${sqlFilePath}`);
