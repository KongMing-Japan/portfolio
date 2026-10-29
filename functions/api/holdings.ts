// functions/api/holdings.ts
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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getAuthenticatedUser(context.request, context.env);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  try {
    const portfolio = await context.env.DB.prepare(
      'SELECT id FROM portfolios WHERE user_id = ? LIMIT 1',
    )
      .bind(user.userId)
      .first<{ id: string }>();

    if (!portfolio) return json({ error: 'Portfolio not found' }, 404);

    const body = (await context.request.json()) as {
      holding?: Record<string, unknown>;
      holdings?: Array<Record<string, unknown>>;
    };

    // Single holding insert or update
    if (body.holding) {
      const h = body.holding;
      const id = String(h.id || crypto.randomUUID());
      const ticker = String(h.ticker || '').trim();
      const name = String(h.name || ticker);
      const broker = String(h.broker || 'Manual');
      const account = String(h.account || 'Default');
      const market = String(h.market || 'Global');
      const currency = String(h.currency || 'JPY').toUpperCase();
      const quantity = Number(h.quantity ?? 0);
      const costPerUnit = h.costPerUnit != null ? Number(h.costPerUnit) : null;
      const marketPrice = h.marketPrice != null ? Number(h.marketPrice) : null;
      const marketValue = h.marketValue != null ? Number(h.marketValue) : (marketPrice != null ? marketPrice * quantity : null);
      const layer = String(h.layer || 'Core');
      const theme = h.theme ? String(h.theme) : null;
      const thesis = h.investmentThesis ? String(h.investmentThesis) : '';

      await context.env.DB.prepare(`
        INSERT INTO holdings (
          id, portfolio_id, ticker, name, broker, account, market, currency,
          quantity, cost_per_unit, market_price, market_value, layer, theme,
          investment_thesis, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          ticker = excluded.ticker,
          name = excluded.name,
          broker = excluded.broker,
          account = excluded.account,
          market = excluded.market,
          currency = excluded.currency,
          quantity = excluded.quantity,
          cost_per_unit = excluded.cost_per_unit,
          market_price = excluded.market_price,
          market_value = excluded.market_value,
          layer = excluded.layer,
          theme = excluded.theme,
          investment_thesis = excluded.investment_thesis,
          updated_at = CURRENT_TIMESTAMP;
      `)
        .bind(
          id,
          portfolio.id,
          ticker,
          name,
          broker,
          account,
          market,
          currency,
          quantity,
          costPerUnit,
          marketPrice,
          marketValue,
          layer,
          theme,
          thesis,
        )
        .run();

      return json({ success: true, id });
    }

    // Batch holdings update
    if (Array.isArray(body.holdings)) {
      const statements = body.holdings.map((h) => {
        const id = String(h.id || crypto.randomUUID());
        const ticker = String(h.ticker || '').trim();
        const name = String(h.name || ticker);
        const broker = String(h.broker || 'Manual');
        const account = String(h.account || 'Default');
        const market = String(h.market || 'Global');
        const currency = String(h.currency || 'JPY').toUpperCase();
        const quantity = Number(h.quantity ?? 0);
        const costPerUnit = h.costPerUnit != null ? Number(h.costPerUnit) : null;
        const marketPrice = h.marketPrice != null ? Number(h.marketPrice) : null;
        const marketValue = h.marketValue != null ? Number(h.marketValue) : (marketPrice != null ? marketPrice * quantity : null);
        const layer = String(h.layer || 'Core');
        const theme = h.theme ? String(h.theme) : null;
        const thesis = h.investmentThesis ? String(h.investmentThesis) : '';

        return context.env.DB.prepare(`
          INSERT INTO holdings (
            id, portfolio_id, ticker, name, broker, account, market, currency,
            quantity, cost_per_unit, market_price, market_value, layer, theme,
            investment_thesis, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            ticker = excluded.ticker,
            name = excluded.name,
            broker = excluded.broker,
            account = excluded.account,
            market = excluded.market,
            currency = excluded.currency,
            quantity = excluded.quantity,
            cost_per_unit = excluded.cost_per_unit,
            market_price = excluded.market_price,
            market_value = excluded.market_value,
            layer = excluded.layer,
            theme = excluded.theme,
            investment_thesis = excluded.investment_thesis,
            updated_at = CURRENT_TIMESTAMP;
        `).bind(
          id,
          portfolio.id,
          ticker,
          name,
          broker,
          account,
          market,
          currency,
          quantity,
          costPerUnit,
          marketPrice,
          marketValue,
          layer,
          theme,
          thesis,
        );
      });

      await context.env.DB.batch(statements);
      return json({ success: true, count: statements.length });
    }

    return json({ error: 'Holding data required' }, 400);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Save holding failed';
    return json({ error: message }, 500);
  }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const user = await getAuthenticatedUser(context.request, context.env);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'Holding ID is required' }, 400);

    const portfolio = await context.env.DB.prepare(
      'SELECT id FROM portfolios WHERE user_id = ? LIMIT 1',
    )
      .bind(user.userId)
      .first<{ id: string }>();

    if (!portfolio) return json({ error: 'Portfolio not found' }, 404);

    await context.env.DB.prepare(
      'DELETE FROM holdings WHERE id = ? AND portfolio_id = ?',
    )
      .bind(id, portfolio.id)
      .run();

    return json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Delete holding failed';
    return json({ error: message }, 500);
  }
};
