// functions/api/agent/sync.ts
import { getAuthenticatedUser } from '../../_shared/auth';

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

interface QuoteUpdate {
  ticker: string;
  price: number;
  currency?: string;
  date?: string;
  source?: string;
}

interface PositionUpdate {
  ticker: string;
  broker?: string;
  quantity?: number;
  marketPrice?: number;
  costPerUnit?: number;
}

interface DailyAccountUpdate {
  broker: string;
  balance: number;
  currency?: string;
}

interface AgentSyncBody {
  quotes?: QuoteUpdate[];
  positions?: PositionUpdate[];
  dailyAccounts?: DailyAccountUpdate[];
  fx?: Record<string, number>;
  recordSnapshot?: boolean;
  actionType?: string;
  notes?: string;
}

const FUND_METADATA_HINTS: Record<string, { query: string; code?: string; note?: string }> = {
  CN_QDII_VN: {
    query: '天弘越南市场股票QDII C 008764 最新单位净值',
    code: '008764',
    note: '场外公募QDII基金，每日晚上公布最新单位净值 (单位: 元/份)',
  },
  EMAXIS_SP500: {
    query: 'eMAXIS Slim 米国株式 S&P500 基準価額 最新',
    code: '03314187',
    note: '日本三菱UFJ投信，每営業日夕方更新 (単位: 円/1万口，换算单价为 基準価額 / 10000)',
  },
  CRYPTO_BITGET: {
    query: 'Bitget Wallet 平台资产余额',
    note: '加密资产钱包',
  },
  CRYPTO_WLD: {
    query: 'Worldcoin WLD 最新价格 USD',
    note: 'Worldcoin 现货单价',
  },
};

/**
 * GET /api/agent/sync
 * Returns an AI-friendly overview of portfolio holdings,
 * highlighting which funds/stocks need price updates (e.g. OTC funds, QDII, unlisted trusts).
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getAuthenticatedUser(context.request, context.env);
  if (!user) return json({ error: 'Unauthorized. Provide X-Owner-Pin: 8888 or Authorization token.' }, 401);

  const portfolio = await context.env.DB.prepare(
    'SELECT id, name, base_currency, fx_json, quote_updated_at FROM portfolios WHERE user_id = ? LIMIT 1',
  )
    .bind(user.userId)
    .first<{ id: string; name: string; base_currency: string; fx_json: string | null; quote_updated_at: string | null }>();

  if (!portfolio) return json({ error: 'Portfolio not found' }, 404);

  const { results: holdings } = await context.env.DB.prepare(
    'SELECT id, ticker, name, broker, account, market, currency, quantity, cost_per_unit, market_price, market_value, layer, theme, updated_at FROM holdings WHERE portfolio_id = ? ORDER BY sort_order ASC, rowid ASC',
  )
    .bind(portfolio.id)
    .all<{
      id: string;
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
      updated_at: string;
    }>();

  // Identify holdings that typically lack free realtime Yahoo quotes (OTC mutual funds, Chinese QDII, Japanese trust funds, etc.)
  const otcFundTickers = Object.keys(FUND_METADATA_HINTS);
  const needsPriceUpdate = holdings.filter(
    (h) =>
      otcFundTickers.includes(h.ticker.toUpperCase()) ||
      h.ticker.startsWith('FUND_') ||
      /基金|qdii|emaxis|信託/i.test(h.name) ||
      h.market_price == null,
  );

  // Compute portfolio allocation metrics & total value in base currency (JPY)
  let fx: Record<string, number> = { JPY: 1, USD: 157.97, HKD: 20.13, CNY: 23.61 };
  try {
    if (portfolio.fx_json) fx = JSON.parse(portfolio.fx_json);
  } catch {}

  const layerValues: Record<string, number> = { Defensive: 0, Core: 0, Satellite: 0, Cash: 0 };
  let totalPortfolioValueJpy = 0;

  for (const h of holdings) {
    const rawVal = h.market_value ?? (h.market_price != null ? h.market_price * h.quantity : 0);
    const rate = fx[h.currency.toUpperCase()] ?? 1;
    const valJpy = rawVal * rate;
    totalPortfolioValueJpy += valJpy;
    if (h.layer in layerValues) {
      layerValues[h.layer] += valJpy;
    }
  }

  // Fetch recent monthly snapshots for MoM return calculation
  const { results: recentSnapshots } = await context.env.DB.prepare(
    'SELECT id, action_type, total_value_jpy, holdings_count, summary_notes, created_at FROM rebalance_history WHERE portfolio_id = ? ORDER BY created_at DESC LIMIT 12',
  )
    .bind(portfolio.id)
    .all<{
      id: string;
      action_type: string;
      total_value_jpy: number | null;
      holdings_count: number | null;
      summary_notes: string | null;
      created_at: string;
    }>();

  return json({
    portfolioId: portfolio.id,
    portfolioName: portfolio.name,
    baseCurrency: portfolio.base_currency,
    quoteUpdatedAt: portfolio.quote_updated_at,
    totalPortfolioValueJpy: Math.round(totalPortfolioValueJpy),
    totalHoldingsCount: holdings.length,
    layerSummary: {
      Defensive: {
        valueJpy: Math.round(layerValues.Defensive),
        weight: totalPortfolioValueJpy > 0 ? Number((layerValues.Defensive / totalPortfolioValueJpy).toFixed(4)) : 0,
      },
      Core: {
        valueJpy: Math.round(layerValues.Core),
        weight: totalPortfolioValueJpy > 0 ? Number((layerValues.Core / totalPortfolioValueJpy).toFixed(4)) : 0,
      },
      Satellite: {
        valueJpy: Math.round(layerValues.Satellite),
        weight: totalPortfolioValueJpy > 0 ? Number((layerValues.Satellite / totalPortfolioValueJpy).toFixed(4)) : 0,
      },
      Cash: {
        valueJpy: Math.round(layerValues.Cash),
        weight: totalPortfolioValueJpy > 0 ? Number((layerValues.Cash / totalPortfolioValueJpy).toFixed(4)) : 0,
      },
    },
    recentSnapshots: recentSnapshots.map((s) => ({
      id: s.id,
      actionType: s.action_type,
      totalValueJpy: s.total_value_jpy,
      holdingsCount: s.holdings_count,
      summaryNotes: s.summary_notes,
      createdAt: s.created_at,
    })),
    needsPriceUpdate: needsPriceUpdate.map((h) => {
      const hint = FUND_METADATA_HINTS[h.ticker.toUpperCase()];
      return {
        ticker: h.ticker,
        name: h.name,
        broker: h.broker,
        currency: h.currency,
        currentPrice: h.market_price,
        lastUpdatedAt: h.updated_at,
        code: hint?.code,
        searchHint: hint?.query || `${h.name} 最新净值`,
        note: hint?.note,
      };
    }),
    holdings: holdings.map((h) => ({
      id: h.id,
      ticker: h.ticker,
      name: h.name,
      broker: h.broker,
      currency: h.currency,
      quantity: h.quantity,
      marketPrice: h.market_price,
      marketValue: h.market_value,
      layer: h.layer,
      theme: h.theme,
    })),
  });
};

/**
 * POST /api/agent/sync
 * Allows AI Agent / Automation to directly push price quotes or position adjustments into Cloudflare D1.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getAuthenticatedUser(context.request, context.env);
  if (!user) return json({ error: 'Unauthorized. Provide X-Owner-Pin: 8888 or Authorization token.' }, 401);

  try {
    const portfolio = await context.env.DB.prepare(
      'SELECT id FROM portfolios WHERE user_id = ? LIMIT 1',
    )
      .bind(user.userId)
      .first<{ id: string }>();

    if (!portfolio) return json({ error: 'Portfolio not found' }, 404);

    const body = (await context.request.json()) as AgentSyncBody;
    const statements: D1PreparedStatement[] = [];
    const updatedTickers: string[] = [];

    // 1. Process quote updates (e.g. AI searched for OTC fund NAVs or exchange rates)
    if (Array.isArray(body.quotes) && body.quotes.length > 0) {
      const now = new Date().toISOString();
      for (const q of body.quotes) {
        const ticker = (q.ticker || '').trim();
        const price = Number(q.price);
        if (!ticker || !Number.isFinite(price) || price <= 0) continue;

        const cur = (q.currency || 'JPY').toUpperCase();
        updatedTickers.push(ticker);

        // Update price_cache table
        statements.push(
          context.env.DB.prepare(`
            INSERT INTO price_cache (ticker, price, currency, fetched_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(ticker) DO UPDATE SET
              price = excluded.price,
              currency = excluded.currency,
              fetched_at = excluded.fetched_at;
          `).bind(ticker, price, cur, q.date || now),
        );

        // Update holdings table where ticker matches
        statements.push(
          context.env.DB.prepare(`
            UPDATE holdings
            SET market_price = ?,
                market_value = quantity * ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE portfolio_id = ? AND ticker = ? COLLATE NOCASE;
          `).bind(price, price, portfolio.id, ticker),
        );
      }
    }

    // 2. Process position adjustments (e.g. AI parsed trade confirmation)
    if (Array.isArray(body.positions) && body.positions.length > 0) {
      for (const p of body.positions) {
        const ticker = (p.ticker || '').trim();
        if (!ticker) continue;

        const clauses: string[] = ['updated_at = CURRENT_TIMESTAMP'];
        const bindings: unknown[] = [];

        if (p.quantity != null && Number.isFinite(p.quantity)) {
          clauses.push('quantity = ?');
          bindings.push(p.quantity);
          if (p.marketPrice != null) {
            clauses.push('market_value = ?');
            bindings.push(p.quantity * p.marketPrice);
          } else {
            clauses.push('market_value = quantity * COALESCE(market_price, cost_per_unit, 1)');
          }
        }

        if (p.marketPrice != null && Number.isFinite(p.marketPrice)) {
          clauses.push('market_price = ?');
          bindings.push(p.marketPrice);
        }

        if (p.costPerUnit != null && Number.isFinite(p.costPerUnit)) {
          clauses.push('cost_per_unit = ?');
          bindings.push(p.costPerUnit);
        }

        bindings.push(portfolio.id);
        bindings.push(ticker);

        statements.push(
          context.env.DB.prepare(`
            UPDATE holdings
            SET ${clauses.join(', ')}
            WHERE portfolio_id = ? AND ticker = ? COLLATE NOCASE;
          `).bind(...bindings),
        );
      }
    }

    // 3. Process daily accounts updates
    if (Array.isArray(body.dailyAccounts) && body.dailyAccounts.length > 0) {
      for (const acc of body.dailyAccounts) {
        const broker = (acc.broker || '').trim();
        const balance = Number(acc.balance);
        if (!broker || !Number.isFinite(balance)) continue;

        statements.push(
          context.env.DB.prepare(`
            UPDATE holdings
            SET quantity = ?,
                market_value = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE portfolio_id = ? AND broker = ? AND layer = 'Cash';
          `).bind(balance, balance, portfolio.id, broker),
        );
      }
    }

    // 4. Update FX rates if provided
    if (body.fx && typeof body.fx === 'object') {
      statements.push(
        context.env.DB.prepare(`
          UPDATE portfolios
          SET fx_json = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?;
        `).bind(JSON.stringify(body.fx), portfolio.id),
      );
    }

    // 5. Update portfolio's quote_updated_at timestamp whenever quotes/positions sync
    if (updatedTickers.length > 0 || (body.positions && body.positions.length > 0)) {
      statements.push(
        context.env.DB.prepare(`
          UPDATE portfolios
          SET quote_updated_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?;
        `).bind(portfolio.id),
      );
    }

    // 6. Record history snapshot in rebalance_history
    const isMonthlySnapshot = Boolean(body.recordSnapshot || body.actionType === 'monthly_snapshot');
    const actionType = body.actionType || (isMonthlySnapshot ? 'monthly_snapshot' : 'ai_agent_sync');

    if (isMonthlySnapshot) {
      // Execute pending statements first so valuations are updated
      if (statements.length > 0) {
        await context.env.DB.batch(statements);
        statements.length = 0;
      }

      // Compute latest total portfolio value in JPY
      const { results: currentHoldings } = await context.env.DB.prepare(
        'SELECT currency, quantity, market_price, market_value, layer FROM holdings WHERE portfolio_id = ?',
      ).bind(portfolio.id).all<{ currency: string; quantity: number; market_price: number | null; market_value: number | null; layer: string }>();

      const portfolioData = await context.env.DB.prepare(
        'SELECT fx_json FROM portfolios WHERE id = ?',
      ).bind(portfolio.id).first<{ fx_json: string | null }>();

      let fxRates: Record<string, number> = { JPY: 1, USD: 157.97, HKD: 20.13, CNY: 23.61 };
      try {
        if (portfolioData?.fx_json) fxRates = JSON.parse(portfolioData.fx_json);
      } catch {}

      let totalJpy = 0;
      const layerBreakdown: Record<string, number> = { Defensive: 0, Core: 0, Satellite: 0, Cash: 0 };
      for (const h of currentHoldings) {
        const val = h.market_value ?? (h.market_price != null ? h.market_price * h.quantity : 0);
        const rate = fxRates[h.currency.toUpperCase()] ?? 1;
        const inJpy = val * rate;
        totalJpy += inJpy;
        if (h.layer in layerBreakdown) layerBreakdown[h.layer] += inJpy;
      }

      await context.env.DB.prepare(`
        INSERT INTO rebalance_history (
          id, portfolio_id, action_type, total_value_jpy, holdings_count, summary_notes, snapshot_json
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?
        );
      `).bind(
        crypto.randomUUID(),
        portfolio.id,
        actionType,
        Math.round(totalJpy),
        currentHoldings.length,
        body.notes || `月度实盘资产快照归档: 总资产 ¥${Math.round(totalJpy).toLocaleString()}`,
        JSON.stringify({
          totalJpy: Math.round(totalJpy),
          layerBreakdown,
          timestamp: new Date().toISOString(),
        }),
      ).run();
    } else {
      statements.push(
        context.env.DB.prepare(`
          INSERT INTO rebalance_history (
            id, portfolio_id, action_type, summary_notes, snapshot_json
          ) VALUES (
            ?, ?, 'ai_agent_sync', ?, ?
          );
        `).bind(
          crypto.randomUUID(),
          portfolio.id,
          body.notes || `AI Agent sync: updated ${updatedTickers.length} tickers`,
          JSON.stringify({ updatedTickers, timestamp: new Date().toISOString() }),
        ),
      );
    }

    if (statements.length > 0) {
      await context.env.DB.batch(statements);
    }

    return json({
      success: true,
      updatedQuotesCount: updatedTickers.length,
      updatedTickers,
      message: `AI Agent sync completed: ${updatedTickers.length} quotes updated in Cloudflare D1`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Agent sync failed';
    return json({ error: message }, 500);
  }
};
