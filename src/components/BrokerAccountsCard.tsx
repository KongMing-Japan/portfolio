import { useMemo, useState } from 'react';
import {
  Briefcase,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  formatExactMoney,
  formatMoney,
  formatPercent,
  getCleanSecurityName,
  isDailyMemoAccount,
} from '../lib/portfolio';
import type { BaseCurrency, Holding } from '../types';

interface BrokerAccountsCardProps {
  holdings: Holding[];
  totalValue: number;
  baseCurrency: BaseCurrency;
}

interface BrokerGroup {
  broker: string;
  totalValueBase: number;
  weight: number;
  currencies: string[];
  nativeSubtotals: Array<{ currency: string; amount: number }>;
  items: Holding[];
  equityValue: number;
  etfValue: number;
  fundValue: number;
  cashValue: number;
  isBankCashPool?: boolean;
}

export function BrokerAccountsCard({
  holdings,
  baseCurrency,
}: BrokerAccountsCardProps) {
  const [expandedBroker, setExpandedBroker] = useState<string | null>(null);

  // Group investment-only holdings by broker
  const brokerGroups = useMemo(() => {
    const investmentHoldings = holdings.filter((h) => !isDailyMemoAccount(h));
    const invTotal = investmentHoldings.reduce((sum, h) => sum + (h.valueInBase ?? 0), 0);

    const map = new Map<string, BrokerGroup>();

    for (const h of investmentHoldings) {
      const b = h.broker || '未分类账户';
      const cur = map.get(b) ?? {
        broker: b,
        totalValueBase: 0,
        weight: 0,
        currencies: [],
        nativeSubtotals: [],
        items: [],
        equityValue: 0,
        etfValue: 0,
        fundValue: 0,
        cashValue: 0,
        isBankCashPool: b === '乐天银行',
      };

      const val = h.valueInBase ?? 0;
      cur.totalValueBase += val;
      cur.items.push(h);

      if (!cur.currencies.includes(h.currency)) {
        cur.currencies.push(h.currency);
      }

      // Categorize asset class
      if (h.layer === 'Cash' || h.ticker.startsWith('Cash') || b === '乐天银行') {
        cur.cashValue += val;
      } else if (
        h.ticker.includes('1482') ||
        h.ticker.includes('1571') ||
        h.ticker.includes('2563') ||
        h.ticker.includes('2845') ||
        h.ticker.includes('513130') ||
        h.ticker.includes('513500')
      ) {
        cur.etfValue += val;
      } else if (h.ticker === 'EMAXIS_SP500' || h.ticker === 'CN_QDII_VN') {
        cur.fundValue += val;
      } else {
        cur.equityValue += val;
      }

      map.set(b, cur);
    }

    // Calculate native currency subtotals
    for (const group of map.values()) {
      group.weight = invTotal > 0 ? group.totalValueBase / invTotal : 0;
      const nativeMap = new Map<string, number>();
      for (const item of group.items) {
        const nativeVal =
          item.marketValue ??
          item.importedMarketValue ??
          item.quantity * (item.marketPrice ?? item.costPerUnit ?? 1);
        nativeMap.set(item.currency, (nativeMap.get(item.currency) ?? 0) + nativeVal);
      }
      group.nativeSubtotals = [...nativeMap.entries()].map(([currency, amount]) => ({
        currency,
        amount,
      }));
    }

    return [...map.values()].sort((a, b) => b.totalValueBase - a.totalValueBase);
  }, [holdings]);

  if (!brokerGroups.length) return null;

  return (
    <section className="space-y-3" id="broker-accounts">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="size-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            投资账户
          </h2>
          <span className="text-xs text-muted-foreground">
            ({brokerGroups.length} 个)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {brokerGroups.map((group) => {
          const isExpanded = expandedBroker === group.broker;
          const isBank = group.isBankCashPool;

          return (
            <div
              key={group.broker}
              className="rounded-xl border bg-card p-4 flex flex-col justify-between gap-3 shadow-2xs hover:border-foreground/20 transition-all"
            >
              <div>
                {/* Account Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0"
                      style={{
                        background: isBank ? '#f0fdf4' : '#eff6ff',
                        color: isBank ? '#15803d' : '#1d4ed8',
                        border: isBank ? '1px solid #bbf7d0' : '1px solid #bfdbfe',
                      }}
                    >
                      {group.broker.slice(0, 1)}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <strong className="text-xs font-semibold text-foreground">
                          {group.broker}
                        </strong>
                        {isBank && (
                          <Badge variant="outline" className="text-[10px] text-emerald-700 bg-emerald-50 border-emerald-300">
                            现金储备
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {group.currencies.join(' · ')} · {group.items.length} 笔持仓
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold tabular-nums text-foreground">
                      {formatMoney(group.totalValueBase, baseCurrency)}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-semibold tabular-nums">
                      {formatPercent(group.weight)}
                    </div>
                  </div>
                </div>

                {/* Native Currency Badges */}
                <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                  {group.nativeSubtotals.map((sub) => (
                    <span
                      key={sub.currency}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground"
                    >
                      {formatExactMoney(sub.amount, sub.currency as BaseCurrency)}
                    </span>
                  ))}
                </div>

                {/* Asset Class Proportional Mini Bar */}
                {!isBank && (
                  <div className="flex flex-col gap-1.5 mb-2">
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted gap-0.5">
                      {group.equityValue > 0 && (
                        <div
                          style={{ width: `${(group.equityValue / group.totalValueBase) * 100}%` }}
                          className="bg-blue-600 h-full"
                          title={`股票: ${formatMoney(group.equityValue, baseCurrency)}`}
                        />
                      )}
                      {group.etfValue > 0 && (
                        <div
                          style={{ width: `${(group.etfValue / group.totalValueBase) * 100}%` }}
                          className="bg-teal-600 h-full"
                          title={`ETF: ${formatMoney(group.etfValue, baseCurrency)}`}
                        />
                      )}
                      {group.fundValue > 0 && (
                        <div
                          style={{ width: `${(group.fundValue / group.totalValueBase) * 100}%` }}
                          className="bg-amber-500 h-full"
                          title={`基金: ${formatMoney(group.fundValue, baseCurrency)}`}
                        />
                      )}
                      {group.cashValue > 0 && (
                        <div
                          style={{ width: `${(group.cashValue / group.totalValueBase) * 100}%` }}
                          className="bg-emerald-500 h-full"
                          title={`现金: ${formatMoney(group.cashValue, baseCurrency)}`}
                        />
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      {group.equityValue > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-blue-600" />
                          股票 {formatPercent(group.equityValue / group.totalValueBase, 0)}
                        </span>
                      )}
                      {group.etfValue > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-teal-600" />
                          ETF {formatPercent(group.etfValue / group.totalValueBase, 0)}
                        </span>
                      )}
                      {group.fundValue > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-amber-500" />
                          基金 {formatPercent(group.fundValue / group.totalValueBase, 0)}
                        </span>
                      )}
                      {group.cashValue > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          现金 {formatPercent(group.cashValue / group.totalValueBase, 0)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Holdings Preview / Expand Toggle */}
              <div className="border-t pt-2.5">
                <button
                  type="button"
                  onClick={() => setExpandedBroker(isExpanded ? null : group.broker)}
                  className="w-full flex items-center justify-between text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  <span>{isExpanded ? '收起明细' : `查看 ${group.items.length} 笔持仓`}</span>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>

                {isExpanded && (
                  <div className="flex flex-col gap-1.5 mt-2.5 pt-2 border-t border-dashed">
                    {group.items.map((item) => {
                      const cleanName = getCleanSecurityName(item.ticker, item.name);
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between text-[11px] py-0.5"
                        >
                          <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                            <span className="font-semibold text-foreground truncate" title={item.name}>
                              {cleanName}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {item.ticker}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono font-medium text-foreground tabular-nums">
                              {formatMoney(item.valueInBase ?? 0, baseCurrency)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
