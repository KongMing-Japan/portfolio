// scripts/seed-d1.mjs
import fs from 'node:fs';
import path from 'node:path';

const sourcePath = process.env.PORTFOLIO_SEED_FILE;
const ownerPasswordHash = process.env.OWNER_PASSWORD_HASH;

if (!sourcePath) throw new Error('PORTFOLIO_SEED_FILE must point to an untracked JSON snapshot');
if (!ownerPasswordHash || !/^[a-f0-9]{64}$/i.test(ownerPasswordHash)) {
  throw new Error('OWNER_PASSWORD_HASH must be a SHA-256 hex digest');
}

const snapshot = JSON.parse(fs.readFileSync(path.resolve(sourcePath), 'utf8'));
const USER_ID = 'usr_owner_main';
const USERNAME = 'owner';
const PORTFOLIO_ID = 'port_default_jpy';
const PORTFOLIO_NAME = snapshot.name || '我的组合';
const BASE_CURRENCY = snapshot.baseCurrency || 'JPY';
const FX_JSON = JSON.stringify(snapshot.fx || {});
const QUOTE_UPDATED_AT = snapshot.quoteUpdatedAt || new Date().toISOString();
const holdings = Array.isArray(snapshot.holdings) ? snapshot.holdings : [];

function esc(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toString() : 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

const sqlStatements = [
  `INSERT INTO users (id, username, password_hash)
VALUES (${esc(USER_ID)}, ${esc(USERNAME)}, ${esc(ownerPasswordHash)})
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash;`,
  `INSERT INTO portfolios (id, user_id, name, base_currency, fx_json, quote_updated_at)
VALUES (${esc(PORTFOLIO_ID)}, ${esc(USER_ID)}, ${esc(PORTFOLIO_NAME)}, ${esc(BASE_CURRENCY)}, ${esc(FX_JSON)}, ${esc(QUOTE_UPDATED_AT)})
ON CONFLICT (id) DO UPDATE SET
  base_currency = excluded.base_currency,
  fx_json = excluded.fx_json,
  quote_updated_at = excluded.quote_updated_at,
  updated_at = CURRENT_TIMESTAMP;`,
  `DELETE FROM holdings WHERE portfolio_id = ${esc(PORTFOLIO_ID)};`,
];

holdings.forEach((holding, index) => {
  const marketValue =
    holding.marketValue ??
    (holding.marketPrice != null ? holding.marketPrice * holding.quantity : holding.importedMarketValue);
  sqlStatements.push(`INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  ${esc(holding.id || `hld_${index + 1}`)}, ${esc(PORTFOLIO_ID)}, ${esc(holding.ticker)},
  ${esc(holding.name)}, ${esc(holding.broker)}, ${esc(holding.account)}, ${esc(holding.market)},
  ${esc(holding.currency)}, ${esc(holding.quantity)}, ${esc(holding.costPerUnit)},
  ${esc(holding.marketPrice)}, ${esc(marketValue)}, ${esc(holding.layer)}, ${esc(holding.theme)},
  ${esc(holding.sourceType || 'manual')}, ${esc(holding.confidence ?? 1)},
  ${esc(holding.investmentThesis || '')}, ${index}
);`);
});

const outputPath = path.resolve('migrations/seed_data.sql');
fs.writeFileSync(outputPath, sqlStatements.join('\n\n'), 'utf8');
console.log(`Generated ${sqlStatements.length} SQL statements in ${outputPath}`);
