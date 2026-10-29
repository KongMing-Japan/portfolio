// functions/api/portfolio.ts
import { getAuthenticatedUser } from '../_shared/auth';

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

interface HoldingRow {
  id: string;
  portfolio_id: string;
  ticker: string;
  name: string;
  broker: string;
  account: string;
  market: string;
  currency: string;
  quantity: number;
  cost_per_unit: number | null;
  market_price: number | null;
  market_value: number | null;
  layer: string;
  theme: string | null;
  source_type: string;
  confidence: number;
  investment_thesis: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface PortfolioRow {
  id: string;
  user_id: string;
  name: string;
  base_currency: string;
  fx_json: string | null;
  quote_updated_at: string | null;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getAuthenticatedUser(context.request, context.env);
  if (!user) {
    return json({ isOwner: false, message: 'Unauthenticated' }, 401);
  }

  // Fetch portfolio for user
  let portfolio = await context.env.DB.prepare(
    'SELECT id, user_id, name, base_currency, fx_json, quote_updated_at FROM portfolios WHERE user_id = ? ORDER BY created_at ASC LIMIT 1',
  )
    .bind(user.userId)
    .first<PortfolioRow>();

  if (!portfolio) {
    // Check fallback for default owner portfolio
    portfolio = await context.env.DB.prepare(
      'SELECT id, user_id, name, base_currency, fx_json, quote_updated_at FROM portfolios LIMIT 1',
    ).first<PortfolioRow>();
  }

  if (!portfolio) {
    return json({ isOwner: true, portfolio: null, holdings: [] });
  }

  // Fetch holdings
  const { results: rows } = await context.env.DB.prepare(
    'SELECT * FROM holdings WHERE portfolio_id = ? ORDER BY sort_order ASC, rowid ASC',
  )
    .bind(portfolio.id)
    .all<HoldingRow>();

  const holdings = rows.map((h) => ({
    id: h.id,
    ticker: h.ticker,
    name: h.name,
    broker: h.broker,
    account: h.account,
    market: h.market,
    currency: h.currency,
    quantity: h.quantity,
    costPerUnit: h.cost_per_unit,
    marketPrice: h.market_price,
    importedMarketValue: h.market_value,
    marketValue: h.market_value,
    valueInBase: null, // Will be recalculated by client or server
    layer: h.layer,
    theme: h.theme || 'Uncategorized',
    sourceType: h.source_type || 'manual',
    confidence: h.confidence ?? 1.0,
    needsReview: false,
    reviewReasons: [],
    targetWeight: null,
    investmentThesis: h.investment_thesis || '',
  }));

  let fx = { JPY: 1, USD: 157.97, HKD: 20.13, CNY: 23.61 };
  try {
    if (portfolio.fx_json) {
      fx = JSON.parse(portfolio.fx_json);
    }
  } catch {}

  return json({
    isOwner: true,
    portfolio: {
      id: portfolio.id,
      name: portfolio.name,
      baseCurrency: portfolio.base_currency,
      fx,
      quoteUpdatedAt: portfolio.quote_updated_at,
      holdings,
    },
  });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const user = await getAuthenticatedUser(context.request, context.env);
  if (!user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = (await context.request.json()) as {
      baseCurrency?: string;
      fx?: Record<string, number>;
      quoteUpdatedAt?: string;
      name?: string;
    };

    const portfolio = await context.env.DB.prepare(
      'SELECT id FROM portfolios WHERE user_id = ? LIMIT 1',
    )
      .bind(user.userId)
      .first<{ id: string }>();

    if (!portfolio) {
      return json({ error: 'Portfolio not found' }, 404);
    }

    const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const bindings: unknown[] = [];

    if (body.baseCurrency) {
      updates.push('base_currency = ?');
      bindings.push(body.baseCurrency);
    }
    if (body.fx) {
      updates.push('fx_json = ?');
      bindings.push(JSON.stringify(body.fx));
    }
    if (body.quoteUpdatedAt) {
      updates.push('quote_updated_at = ?');
      bindings.push(body.quoteUpdatedAt);
    }
    if (body.name) {
      updates.push('name = ?');
      bindings.push(body.name);
    }

    bindings.push(portfolio.id);
    await context.env.DB.prepare(
      `UPDATE portfolios SET ${updates.join(', ')} WHERE id = ?`,
    )
      .bind(...bindings)
      .run();

    return json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return json({ error: message }, 500);
  }
};
