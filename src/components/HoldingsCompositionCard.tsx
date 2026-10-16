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
  const [viewMode, setViewMode] = useState<'top' | 'layers'>('top');

  const { chartData, topFiveWeight } = useMemo(() => {
    if (!aggregated.length) return { chartData: [], topFiveWeight: 0 };

    const topFive = aggregated.slice(0, 5).reduce((sum, h) => sum + h.weight, 0);

    if (viewMode === 'layers') {
      const layerOrder: Layer[] = ['Core', 'Defensive', 'Cash', 'Satellite'];
      const layerRows: PieHoldingRow[] = layerOrder
        .map((layer) => {
          const items = aggregated.filter((h) => h.layer === layer);
          const value = items.reduce((sum, h) => sum + h.marketValueBase, 0);
          const weight = totalValue > 0 ? value / totalValue : 0;
          return {
            ticker: LAYER_META[layer].label,
            name: `${items.length} 项归并标的 · ${LAYER_META[layer].description}`,
            layer,
            broker: '',
            value,
            weight,
            color: LAYER_META[layer].color,
            isOther: true,
          };
        })
        .filter((r) => r.value > 0);
      return { chartData: layerRows, topFiveWeight: topFive };
    }

    const topCount = 7;
    const top = aggregated.slice(0, topCount);
    const others = aggregated.slice(topCount);

    const topRows: PieHoldingRow[] = top.map((h, index) => {
      const brokerSet = new Set(h.accounts?.map((a) => a.broker).filter(Boolean));
      const broker =
        brokerSet.size > 1
          ? `跨 ${brokerSet.size} 个账户`
          : h.accounts?.[0]?.broker ?? '';
      return {
        ticker: h.ticker || h.name,
        name: h.name,
        layer: h.layer,
        broker,
        value: h.marketValueBase,
        weight: h.weight,
        color: HOLDING_PIE_COLORS[index % (HOLDING_PIE_COLORS.length - 1)],
      };
    });

    const othersValue = others.reduce((sum, h) => sum + h.marketValueBase, 0);
    const othersWeight = totalValue > 0 ? othersValue / totalValue : 0;

    if (othersValue > 0) {
      topRows.push({
        ticker: '其他标的',
        name: `其余 ${others.length} 项归并标的`,
        layer: 'Defensive',
        broker: '',
        value: othersValue,
        weight: othersWeight,
        color: HOLDING_PIE_COLORS[8],
        isOther: true,
      });
    }

    return { chartData: topRows, topFiveWeight: topFive };
  }, [aggregated, totalValue, viewMode]);

  if (!aggregated.length) return null;

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
            核心重仓与四层金字塔分布 · 前五大集中度 {formatPercent(topFiveWeight)}
          </p>
        </div>
        <div
          style={{
            display: 'inline-flex',
            background: 'var(--muted)',
            borderRadius: 'calc(var(--radius) * 0.7)',
            padding: '2px',
            border: '1px solid var(--border)',
            gap: '2px',
          }}
          role="tablist"
          aria-label="构成图模式切换"
        >
          <button
            type="button"
            onClick={() => {
              setViewMode('top');
              setHoveredTicker(null);
            }}
            style={{
              padding: '3px 9px',
              borderRadius: 'calc(var(--radius) * 0.5)',
              fontSize: '0.73rem',
              fontWeight: viewMode === 'top' ? 600 : 500,
              background: viewMode === 'top' ? 'var(--background)' : 'transparent',
              color: viewMode === 'top' ? 'var(--foreground)' : 'var(--muted-foreground)',
              border: 'none',
              cursor: 'pointer',
              boxShadow: viewMode === 'top' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            前七重仓
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode('layers');
              setHoveredTicker(null);
            }}
            style={{
              padding: '3px 9px',
              borderRadius: 'calc(var(--radius) * 0.5)',
              fontSize: '0.73rem',
              fontWeight: viewMode === 'layers' ? 600 : 500,
              background: viewMode === 'layers' ? 'var(--background)' : 'transparent',
              color: viewMode === 'layers' ? 'var(--foreground)' : 'var(--muted-foreground)',
              border: 'none',
              cursor: 'pointer',
              boxShadow: viewMode === 'layers' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            四层金字塔
          </button>
        </div>
      </div>

      <div className="gf-chart-card-body">
        <div className="gf-composition-donut-panel">
          {/* Left: Donut Chart with center text */}
          <div style={{ position: 'relative', width: '210px', height: '210px', margin: '0 auto', flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 210, height: 210 }}>
              <PieChart width={210} height={210}>
                <Tooltip content={<HoldingPieTooltip baseCurrency={baseCurrency} />} />
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="ticker"
                  innerRadius={60}
                  outerRadius={88}
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
              <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', fontWeight: 500, display: 'block', letterSpacing: '-0.01em' }}>
                {hoveredTicker ? '聚焦项' : viewMode === 'layers' ? '最大分层' : '第一大重仓'}
              </span>
              <strong
                style={{
                  fontSize: '0.92rem',
                  color: 'var(--foreground)',
                  fontWeight: 700,
                  display: 'block',
                  marginTop: '2px',
                  maxWidth: '108px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  letterSpacing: '-0.02em',
                }}
              >
                {activeHolding?.ticker || activeHolding?.name}
              </strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {formatPercent(activeHolding?.weight ?? 0)}
              </span>
            </div>
          </div>

          {/* Right: Legend list */}
          <div className="gf-holdings-legend-list" style={{ gap: '0.35rem' }}>
            {chartData.map((row) => {
              const isHovered = hoveredTicker === row.ticker;
              return (
                <div
                  key={row.ticker}
                  className="gf-holdings-legend-row"
                  style={{
                    background: isHovered ? 'var(--muted)' : 'transparent',
                    padding: '5px 8px',
                  }}
                  onMouseEnter={() => setHoveredTicker(row.ticker)}
                  onMouseLeave={() => setHoveredTicker(null)}
                  onClick={() => !row.isOther && onSelectTicker?.(row.ticker)}
                  title={row.isOther ? row.name : `点击在下表展开: ${row.ticker}`}
                >
                  <span className="gf-legend-dot" style={{ background: row.color }} />
                  <div className="gf-legend-title">
                    <b>{row.ticker}</b>
                    <span>
                      {row.isOther
                        ? row.name
                        : `${row.name || row.ticker} · ${LAYER_META[row.layer]?.label ?? row.layer}`}
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
