import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
    <Card id="broker-accounts">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">投资账户分布</CardTitle>
        <CardDescription>
          共 {brokerGroups.length} 个证券与投资账户，按折合 {baseCurrency} 净值排序
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {brokerGroups.map((group) => {
            const isExpanded = expandedBroker === group.broker;
            const isBank = group.isBankCashPool;

            return (
              <div
                key={group.broker}
                className="rounded-xl border border-border bg-card p-3.5 flex flex-col justify-between gap-2.5 transition-colors hover:bg-muted/30"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="size-8 rounded-lg bg-muted text-foreground flex items-center justify-center font-semibold text-xs shrink-0 border border-border">
                        {group.broker.slice(0, 1)}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-foreground">
                            {group.broker}
                          </span>
                          {isBank && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                              现金储备
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {group.currencies.join(' · ')} · {group.items.length} 笔
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold tabular-nums text-foreground">
                        {formatMoney(group.totalValueBase, baseCurrency)}
                      </div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        {formatPercent(group.weight)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap mb-2">
                    {group.nativeSubtotals.map((sub) => (
                      <span
                        key={sub.currency}
                        className="text-[10px] tabular-nums px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground"
                      >
                        {formatExactMoney(sub.amount, sub.currency as BaseCurrency)}
                      </span>
                    ))}
                  </div>

                  {!isBank && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted gap-0.5">
                        {group.equityValue > 0 && (
                          <div
                            style={{ width: `${(group.equityValue / group.totalValueBase) * 100}%` }}
                            className="bg-primary h-full"
                            title={`股票: ${formatMoney(group.equityValue, baseCurrency)}`}
                          />
                        )}
                        {group.etfValue > 0 && (
                          <div
                            style={{ width: `${(group.etfValue / group.totalValueBase) * 100}%` }}
                            className="bg-chart-3 h-full"
                            title={`ETF: ${formatMoney(group.etfValue, baseCurrency)}`}
                          />
                        )}
                        {group.fundValue > 0 && (
                          <div
                            style={{ width: `${(group.fundValue / group.totalValueBase) * 100}%` }}
                            className="bg-chart-2 h-full"
                            title={`基金: ${formatMoney(group.fundValue, baseCurrency)}`}
                          />
                        )}
                        {group.cashValue > 0 && (
                          <div
                            style={{ width: `${(group.cashValue / group.totalValueBase) * 100}%` }}
                            className="bg-chart-1 h-full"
                            title={`现金: ${formatMoney(group.cashValue, baseCurrency)}`}
                          />
                        )}
                      </div>

                      <div className="flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground">
                        {group.equityValue > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="size-1.5 rounded-full bg-primary" />
                            股票 {formatPercent(group.equityValue / group.totalValueBase, 0)}
                          </span>
                        )}
                        {group.etfValue > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="size-1.5 rounded-full bg-chart-3" />
                            ETF {formatPercent(group.etfValue / group.totalValueBase, 0)}
                          </span>
                        )}
                        {group.fundValue > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="size-1.5 rounded-full bg-chart-2" />
                            基金 {formatPercent(group.fundValue / group.totalValueBase, 0)}
                          </span>
                        )}
                        {group.cashValue > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="size-1.5 rounded-full bg-chart-1" />
                            现金 {formatPercent(group.cashValue / group.totalValueBase, 0)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedBroker((prev) => (prev === group.broker ? null : group.broker))
                    }
                    className="w-full pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <span>{isExpanded ? '收起账户明细' : '查看账户持仓'}</span>
                    {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-border/60 space-y-1.5 max-h-44 overflow-y-auto">
                      {group.items
                        .sort((a, b) => (b.valueInBase ?? 0) - (a.valueInBase ?? 0))
                        .map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between text-[11px] py-0.5"
                          >
                            <div className="flex items-center gap-1.5 min-w-0 pr-2">
                              <span className="font-medium text-foreground truncate">
                                {getCleanSecurityName(item.ticker, item.name)}
                              </span>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {item.currency}
                              </span>
                            </div>
                            <span className="tabular-nums font-medium text-foreground shrink-0">
                              {formatMoney(item.valueInBase ?? 0, baseCurrency)}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
