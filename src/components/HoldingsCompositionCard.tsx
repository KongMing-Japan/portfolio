import { useMemo, useState } from 'react';
import { BarChart3, AlertTriangle, Layers } from 'lucide-react';
import { formatMoney, formatPercent, getCleanSecurityName, LAYER_META } from '../lib/portfolio';
import type { AggregatedHolding, BaseCurrency, Layer } from '../types';

interface HoldingsCompositionCardProps {
  aggregated: AggregatedHolding[];
  totalValue: number;
  baseCurrency: BaseCurrency;
  onSelectTicker?: (ticker: string) => void;
}

export function HoldingsCompositionCard({
  aggregated,
  totalValue,
  baseCurrency,
  onSelectTicker,
}: HoldingsCompositionCardProps) {
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null);

  const { topRows, topFiveWeight } = useMemo(() => {
    if (!aggregated.length) return { topRows: [], topFiveWeight: 0 };

    const topFive = aggregated.slice(0, 5).reduce((sum, h) => sum + h.weight, 0);
    const topCount = 10;
    const top = aggregated.slice(0, topCount).map((h, index) => {
      const brokerSet = new Set(h.accounts?.map((a) => a.broker).filter(Boolean));
      const broker =
        brokerSet.size > 1
          ? `跨 ${brokerSet.size} 个账户`
          : h.accounts?.[0]?.broker ?? '';
      return {
        rank: index + 1,
        ticker: h.ticker || h.name,
        displayName: getCleanSecurityName(h.ticker, h.name),
        rawName: h.name,
        layer: h.layer,
        broker,
        value: h.marketValueBase,
        weight: h.weight,
        color: LAYER_META[h.layer]?.color || '#2563eb',
        isOverweight: h.weight > 0.20,
      };
    });

    return { topRows: top, topFiveWeight: topFive };
  }, [aggregated]);

  if (!aggregated.length) return null;

  const maxWeight = Math.max(...topRows.map((r) => r.weight), 0.01);

  return (
    <div className="gf-chart-card">
      <div className="gf-chart-card-header">
        <div className="gf-chart-title-group">
          <h3>
            <BarChart3 size={18} color="var(--primary)" />
            <span>前十大重仓分布</span>
          </h3>
          <p>
            前五大集中度 {formatPercent(topFiveWeight)} · 单一标的风控上限 20%
          </p>
        </div>
      </div>

      <div className="gf-chart-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {topRows.map((item) => {
          const isHovered = hoveredTicker === item.ticker;
          const barWidth = `${Math.min(100, (item.weight / maxWeight) * 100)}%`;

          return (
            <div
              key={item.ticker}
              onClick={() => onSelectTicker?.(item.ticker)}
              onMouseEnter={() => setHoveredTicker(item.ticker)}
              onMouseLeave={() => setHoveredTicker(null)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                padding: '6px 8px',
                borderRadius: '6px',
                background: isHovered ? 'var(--muted)' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: item.rank <= 3 ? 'var(--primary)' : 'var(--muted-foreground)',
                      width: '18px',
                      flexShrink: 0,
                    }}
                  >
                    #{item.rank}
                  </span>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--foreground)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={`${item.ticker} · ${item.rawName}`}
                  >
                    {item.displayName}
                  </span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      color: 'var(--muted-foreground)',
                      flexShrink: 0,
                    }}
                  >
                    {item.ticker}
                  </span>
                  {item.isOverweight && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        fontSize: '0.65rem',
                        color: '#dc2626',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '4px',
                        padding: '0 4px',
                        fontWeight: 600,
                      }}
                      title="单一标的权重超过 20% 机构风控线"
                    >
                      <AlertTriangle size={10} />
                      过重
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 500,
                      padding: '1px 5px',
                      borderRadius: '4px',
                      background: LAYER_META[item.layer]?.pale || 'var(--muted)',
                      color: LAYER_META[item.layer]?.color || 'var(--foreground)',
                    }}
                  >
                    {LAYER_META[item.layer]?.label?.split(' ')[0]}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--muted-foreground)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatMoney(item.value, baseCurrency)}
                  </span>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: 'var(--foreground)',
                      fontVariantNumeric: 'tabular-nums',
                      minWidth: '40px',
                      textAlign: 'right',
                    }}
                  >
                    {formatPercent(item.weight)}
                  </span>
                </div>
              </div>

              {/* Proportional Bar */}
              <div
                style={{
                  width: '100%',
                  height: '5px',
                  borderRadius: '999px',
                  background: 'color-mix(in oklch, var(--muted) 80%, transparent)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: barWidth,
                    height: '100%',
                    borderRadius: '999px',
                    background: item.color,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
