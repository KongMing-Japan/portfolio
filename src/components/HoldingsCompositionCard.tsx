import { useMemo, useState } from 'react';
import { PieChart as PieChartIcon } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatMoney, formatPercent, LAYER_META } from '../lib/portfolio';
import type { AggregatedHolding, BaseCurrency, Layer } from '../types';

interface HoldingsCompositionCardProps {
  aggregated: AggregatedHolding[];
  totalValue: number;
  baseCurrency: BaseCurrency;
  onSelectTicker?: (ticker: string) => void;
}

const HOLDING_PIE_COLORS = [
  '#2563eb', // Blue
  '#0d9488', // Teal
  '#f59e0b', // Amber
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#94a3b8', // Slate for Other
];

interface PieHoldingRow {
  ticker: string;
  name: string;
  layer: Layer;
  broker: string;
  value: number;
  weight: number;
  color: string;
  isOther?: boolean;
}

function HoldingPieTooltip({
  active,
  payload,
  baseCurrency,
}: {
  active?: boolean;
  payload?: Array<{ payload: PieHoldingRow }>;
  baseCurrency: BaseCurrency;
}) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;

  return (
    <div className="shadcn-chart-tooltip">
      <div className="shadcn-chart-tooltip-header">
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: item.color,
            display: 'inline-block',
          }}
        />
        <span>{item.ticker}</span>
        {item.name && item.name !== item.ticker && (
          <span style={{ color: '#64748b', fontWeight: 400 }}>· {item.name}</span>
        )}
      </div>
      <div className="shadcn-chart-tooltip-row">
        <span>持仓权重</span>
        <strong>{formatPercent(item.weight)}</strong>
      </div>
      <div className="shadcn-chart-tooltip-row">
        <span>评估市值</span>
        <strong>{formatMoney(item.value, baseCurrency)}</strong>
      </div>
      {!item.isOther && item.layer && (
        <div className="shadcn-chart-tooltip-row">
          <span>资产分层</span>
          <span>{LAYER_META[item.layer]?.label ?? item.layer}</span>
        </div>
      )}
      {!item.isOther && item.broker && (
        <div className="shadcn-chart-tooltip-row">
          <span>所在券商</span>
          <span>{item.broker}</span>
        </div>
      )}
    </div>
  );
}

export function HoldingsCompositionCard({
  aggregated,
  totalValue,
  baseCurrency,
  onSelectTicker,
}: HoldingsCompositionCardProps) {
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null);

  const { chartData, topFiveWeight } = useMemo(() => {
    if (!aggregated.length) return { chartData: [], topFiveWeight: 0 };

    const topCount = 5;
    const top = aggregated.slice(0, topCount);
    const others = aggregated.slice(topCount);

    const topRows: PieHoldingRow[] = top.map((h, index) => {
      const broker = h.accounts?.length ? h.accounts[0].broker : '';
      return {
        ticker: h.ticker || h.name,
        name: h.name,
        layer: h.layer,
        broker,
        value: h.marketValueBase,
        weight: h.weight,
        color: HOLDING_PIE_COLORS[index % HOLDING_PIE_COLORS.length],
      };
    });

    const othersValue = others.reduce((sum, h) => sum + h.marketValueBase, 0);
    const othersWeight = totalValue > 0 ? othersValue / totalValue : 0;

    if (othersValue > 0) {
      topRows.push({
        ticker: '其他标的',
        name: `其余 ${others.length} 只标的`,
        layer: 'Defensive',
        broker: '',
        value: othersValue,
        weight: othersWeight,
        color: HOLDING_PIE_COLORS[8],
        isOther: true,
      });
    }

    const topFive = aggregated.slice(0, 5).reduce((sum, h) => sum + h.weight, 0);

    return { chartData: topRows, topFiveWeight: topFive };
  }, [aggregated, totalValue]);

  if (!aggregated.length) return null;

  const topHolding = aggregated[0];
  const activeHolding = chartData.find((d) => d.ticker === hoveredTicker) || chartData[0];

  return (
    <div className="gf-chart-card">
      <div className="gf-chart-card-header">
        <div className="gf-chart-title-group">
          <h3>
            <PieChartIcon size={18} color="var(--primary)" />
            <span>持仓配置构成</span>
          </h3>
          <p>
            核心重仓标的与资产组合配置 · 前五大集中度 {formatPercent(topFiveWeight)}
          </p>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', fontWeight: 500 }}>
          共 {aggregated.length} 只标的
        </div>
      </div>

      <div className="gf-chart-card-body">
        <div className="gf-composition-donut-panel">
          {/* Left: Donut Chart with center text */}
          <div style={{ position: 'relative', width: '220px', height: '220px', margin: '0 auto', flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 220, height: 220 }}>
              <PieChart width={220} height={220}>
                <Tooltip content={<HoldingPieTooltip baseCurrency={baseCurrency} />} />
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="ticker"
                  innerRadius={62}
                  outerRadius={90}
                  paddingAngle={2}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {chartData.map((entry) => {
                    const isHovered = hoveredTicker === entry.ticker;
                    return (
                      <Cell
                        key={entry.ticker}
                        fill={entry.color}
                        opacity={hoveredTicker ? (isHovered ? 1 : 0.45) : 1}
                        style={{ cursor: 'pointer', transition: 'opacity 0.15s ease' }}
                        onMouseEnter={() => setHoveredTicker(entry.ticker)}
                        onMouseLeave={() => setHoveredTicker(null)}
                        onClick={() => !entry.isOther && onSelectTicker?.(entry.ticker)}
                      />
                    );
                  })}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontWeight: 500, display: 'block' }}>
                {hoveredTicker ? '聚焦标的' : '第一大重仓'}
              </span>
              <strong
                style={{
                  fontSize: '15px',
                  color: 'var(--foreground)',
                  fontWeight: 700,
                  display: 'block',
                  marginTop: '1px',
                  maxWidth: '100px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {activeHolding?.ticker || activeHolding?.name}
              </strong>
              <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>
                {formatPercent(activeHolding?.weight ?? 0)}
              </span>
            </div>
          </div>

          {/* Right: Legend list matching Superinvestors */}
          <div className="gf-holdings-legend-list">
            {chartData.map((row) => {
              const isHovered = hoveredTicker === row.ticker;
              return (
                <div
                  key={row.ticker}
                  className="gf-holdings-legend-row"
                  style={{
                    background: isHovered ? '#f1f5f9' : 'transparent',
                  }}
                  onMouseEnter={() => setHoveredTicker(row.ticker)}
                  onMouseLeave={() => setHoveredTicker(null)}
                  onClick={() => !row.isOther && onSelectTicker?.(row.ticker)}
                  title={row.isOther ? '其余标的合计' : `点击定位标的: ${row.ticker}`}
                >
                  <span className="gf-legend-dot" style={{ background: row.color }} />
                  <div className="gf-legend-title">
                    <b>{row.ticker}</b>
                    <span>
                      {row.isOther
                        ? row.name
                        : `${LAYER_META[row.layer]?.label ?? row.layer}${row.broker ? ` · ${row.broker}` : ''}`}
                    </span>
                  </div>
                  <div className="gf-legend-nums">
                    <strong>{formatPercent(row.weight)}</strong>
                    <small>{formatMoney(row.value, baseCurrency)}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
