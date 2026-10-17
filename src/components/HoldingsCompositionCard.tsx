import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatMoney, formatPercent, getCleanSecurityName, LAYER_META } from '../lib/portfolio';
import { SINGLE_SECURITY_CAP } from '../lib/rebalance';
import type { AggregatedHolding, BaseCurrency } from '../types';

interface HoldingsCompositionCardProps {
  aggregated: AggregatedHolding[];
  totalValue: number;
  baseCurrency: BaseCurrency;
  onSelectTicker?: (ticker: string) => void;
}

export function HoldingsCompositionCard({
  aggregated,
  baseCurrency,
  onSelectTicker,
}: HoldingsCompositionCardProps) {
  const { topRows, topFiveWeight } = useMemo(() => {
    if (!aggregated.length) return { topRows: [], topFiveWeight: 0 };

    const topFive = aggregated.slice(0, 5).reduce((sum, h) => sum + h.weight, 0);
    const top = aggregated.slice(0, 10).map((h, index) => ({
      rank: index + 1,
      ticker: h.ticker || h.name,
      displayName: getCleanSecurityName(h.ticker, h.name),
      rawName: h.name,
      layer: h.layer,
      value: h.marketValueBase,
      weight: h.weight,
      isOverweight: h.weight > SINGLE_SECURITY_CAP && h.layer !== 'Cash',
    }));

    return { topRows: top, topFiveWeight: topFive };
  }, [aggregated]);

  if (!aggregated.length) return null;

  const maxWeight = Math.max(...topRows.map((r) => r.weight), 0.01);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">前十大重仓分布</CardTitle>
            <CardDescription>
              前五大集中度 {formatPercent(topFiveWeight)} · 点击标的联动筛选下方台账
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs font-normal tabular-nums">
            Top 10
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {topRows.map((item) => {
          const barWidth = `${Math.min(100, (item.weight / maxWeight) * 100)}%`;

          return (
            <button
              key={item.ticker}
              type="button"
              onClick={() => onSelectTicker?.(item.ticker)}
              className="w-full text-left flex flex-col gap-1.5 rounded-lg p-2 hover:bg-muted/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-medium text-muted-foreground w-5 shrink-0 tabular-nums">
                    {item.rank}
                  </span>
                  <span
                    className="text-xs font-semibold text-foreground truncate"
                    title={`${item.ticker} · ${item.rawName}`}
                  >
                    {item.displayName}
                  </span>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {item.ticker}
                  </span>
                  {item.isOverweight && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                      超 15%
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                    {LAYER_META[item.layer]?.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatMoney(item.value, baseCurrency)}
                  </span>
                  <span className="text-xs font-semibold text-foreground tabular-nums w-11 text-right">
                    {formatPercent(item.weight)}
                  </span>
                </div>
              </div>

              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  style={{ width: barWidth }}
                  className={
                    item.layer === 'Core'
                      ? 'h-full rounded-full bg-primary transition-all'
                      : item.layer === 'Satellite'
                        ? 'h-full rounded-full bg-chart-4 transition-all'
                        : item.layer === 'Defensive'
                          ? 'h-full rounded-full bg-chart-3 transition-all'
                          : 'h-full rounded-full bg-chart-2 transition-all'
                  }
                />
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
