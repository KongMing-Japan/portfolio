import { useEffect, useMemo, useState } from 'react';
import { AreaChart as AreaChartIcon, DollarSign, Layers, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney, formatPercent, LAYER_META } from '../lib/portfolio';
import { loadReviewSnapshots } from '../lib/storage';
import type { BaseCurrency, Layer, ReviewSnapshot } from '../types';

interface PortfolioAreaChartProps {
  totalValue: number;
  baseCurrency: BaseCurrency;
  layerRows: Array<{ layer: Layer; value: number; weight: number }>;
}

type AreaMode = 'stacked' | 'valuation';

interface AreaChartPoint {
  label: string;
  date?: string;
  total: number;
  Core: number;
  Satellite: number;
  Defensive: number;
  Cash: number;
}

function formatCompactAxis(val: number, currency: BaseCurrency) {
  if (val === 0) return '0';
  const prefix = currency === 'USD' ? '$' : currency === 'JPY' ? '¥' : currency === 'CNY' ? '¥' : 'HK$';
  if (currency === 'JPY' || currency === 'CNY') {
    if (Math.abs(val) >= 100_000_000) {
      return `${prefix}${(val / 100_000_000).toFixed(1).replace(/\.0$/, '')}亿`;
    }
    if (Math.abs(val) >= 10_000) {
      return `${prefix}${(val / 10_000).toFixed(0)}万`;
    }
    return `${prefix}${val}`;
  }
  if (Math.abs(val) >= 1_000_000_000) {
    return `${prefix}${(val / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (Math.abs(val) >= 1_000_000) {
    return `${prefix}${(val / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (Math.abs(val) >= 1_000) {
    return `${prefix}${(val / 1_000).toFixed(0)}k`;
  }
  return `${prefix}${val}`;
}

function AreaCustomTooltip({
  active,
  payload,
  label,
  baseCurrency,
  mode,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    payload: AreaChartPoint;
  }>;
  label?: string;
  baseCurrency: BaseCurrency;
  mode: AreaMode;
}) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0].payload;

  return (
    <div className="shadcn-chart-tooltip" style={{ minWidth: '160px' }}>
      <div className="shadcn-chart-tooltip-header">
        <span style={{ fontWeight: 600 }}>{label}</span>
      </div>
      {mode === 'valuation' ? (
        <div className="shadcn-chart-tooltip-row">
          <span>资产总估值</span>
          <strong>{formatMoney(point.total, baseCurrency)}</strong>
        </div>
      ) : (
        <>
          <div className="shadcn-chart-tooltip-row" style={{ paddingBottom: '3px', borderBottom: '1px solid #f1f5f9' }}>
            <span>组合总值</span>
            <strong>{formatMoney(point.total, baseCurrency)}</strong>
          </div>
          {payload.map((entry) => {
            const layerKey = entry.name as Layer;
            const meta = LAYER_META[layerKey];
            const val = entry.value;
            const pct = point.total > 0 ? val / point.total : 0;
            return (
              <div key={entry.name} className="shadcn-chart-tooltip-row">
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: entry.color }} />
                  {meta?.label ?? entry.name}
                </span>
                <span>
                  <strong>{formatMoney(val, baseCurrency)}</strong> ({formatPercent(pct)})
                </span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

export function PortfolioAreaChart({
  totalValue,
  baseCurrency,
  layerRows,
}: PortfolioAreaChartProps) {
  const [mode, setMode] = useState<AreaMode>('stacked');
  const [snapshots, setSnapshots] = useState<ReviewSnapshot[]>([]);

  useEffect(() => {
    let active = true;
    void loadReviewSnapshots()
      .then((list) => {
        if (active) setSnapshots(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const chartData: AreaChartPoint[] = useMemo(() => {
    const currentPoint: AreaChartPoint = {
      label: '当前持仓',
      total: totalValue,
      Core: layerRows.find((r) => r.layer === 'Core')?.value ?? 0,
      Satellite: layerRows.find((r) => r.layer === 'Satellite')?.value ?? 0,
      Defensive: layerRows.find((r) => r.layer === 'Defensive')?.value ?? 0,
      Cash: layerRows.find((r) => r.layer === 'Cash')?.value ?? 0,
    };

    if (snapshots.length >= 2) {
      const historicalPoints: AreaChartPoint[] = snapshots
        .slice(-5)
        .map((s) => ({
          label: s.label.replace(' 季度审视', '').replace('审视', ''),
          date: s.createdAt,
          total: s.totalValueBase,
          Core: (s.layerWeights?.Core ?? 0) * s.totalValueBase,
          Satellite: (s.layerWeights?.Satellite ?? 0) * s.totalValueBase,
          Defensive: (s.layerWeights?.Defensive ?? 0) * s.totalValueBase,
          Cash: (s.layerWeights?.Cash ?? 0) * s.totalValueBase,
        }));
      return [...historicalPoints, currentPoint];
    }

    // Honest Capital Structure & Rebalance Path Comparison when < 2 historical snapshots exist
    const baseCore = currentPoint.Core;
    const baseSat = currentPoint.Satellite;
    const baseDef = currentPoint.Defensive;
    const baseCash = currentPoint.Cash;

    // Stage 2: Zero-Sell Cash Deployment (deploy excess cash above 10% into Core & Defensive)
    const targetCash = Math.round(totalValue * 0.10);
    const deployableCash = Math.max(0, baseCash - targetCash);
    const coreDeficit = Math.max(0, totalValue * 0.55 - baseCore);
    const defDeficit = Math.max(0, totalValue * 0.20 - baseDef);
    const deficitSum = coreDeficit + defDeficit || 1;
    const zeroSellCore = Math.round(baseCore + deployableCash * (coreDeficit / deficitSum));
    const zeroSellDef = Math.round(baseDef + deployableCash * (defDeficit / deficitSum));
    const zeroSellCash = Math.max(0, baseCash - deployableCash);

    return [
      {
        label: '当前实盘配置',
        total: totalValue,
        Core: Math.round(baseCore),
        Satellite: Math.round(baseSat),
        Defensive: Math.round(baseDef),
        Cash: Math.round(baseCash),
      },
      {
        label: '零卖出现金补仓后',
        total: totalValue,
        Core: zeroSellCore,
        Satellite: Math.round(baseSat),
        Defensive: zeroSellDef,
        Cash: zeroSellCash,
      },
      {
        label: '跨境双核目标 (55/15/20/10)',
        total: totalValue,
        Core: Math.round(totalValue * 0.55),
        Satellite: Math.round(totalValue * 0.15),
        Defensive: Math.round(totalValue * 0.20),
        Cash: Math.round(totalValue * 0.10),
      },
      {
        label: '机构标准目标 (60/20/15/5)',
        total: totalValue,
        Core: Math.round(totalValue * 0.60),
        Satellite: Math.round(totalValue * 0.20),
        Defensive: Math.round(totalValue * 0.15),
        Cash: Math.round(totalValue * 0.05),
      },
    ];
  }, [layerRows, snapshots, totalValue]);

  if (totalValue <= 0) return null;

  return (
    <div className="gf-chart-card perf-contain-section">
      <div className="gf-chart-card-header">
        <div className="gf-chart-title-group">
          <h3>
            <AreaChartIcon size={18} color="var(--primary)" />
            <span>
              {snapshots.length >= 2
                ? '历史快照演进与分层趋势'
                : '当前实盘 vs 零卖出调仓演进路径'}
            </span>
          </h3>
          <p>
            {snapshots.length >= 2
              ? `基于 ${snapshots.length} 个真实保存的复盘快照绘制`
              : '真实对比：当前四层结构 → 零卖出动用现金补仓后 → 机构基准配置路径（保存 ≥2 个季度快照后自动切换为历史时间轴）'}
          </p>
        </div>
        <div className="gf-chart-card-actions" role="tablist" aria-label="图表视角切换">
          <button
            type="button"
            className={`gf-chart-pill-btn ${mode === 'stacked' ? 'is-active' : ''}`}
            onClick={() => setMode('stacked')}
            role="tab"
            aria-selected={mode === 'stacked'}
          >
            <Layers size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
            四层堆叠对比
          </button>
          <button
            type="button"
            className={`gf-chart-pill-btn ${mode === 'valuation' ? 'is-active' : ''}`}
            onClick={() => setMode('valuation')}
            role="tab"
            aria-selected={mode === 'valuation'}
          >
            <DollarSign size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
            资产总净值
          </button>
        </div>
      </div>

      <div className="gf-chart-card-body" style={{ height: '280px', padding: '16px 12px 10px' }}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 800, height: 280 }}>
          <AreaChart data={chartData} margin={{ top: 12, right: 18, left: 10, bottom: 8 }}>
            <defs>
              <linearGradient id="areaCore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={LAYER_META.Core.color} stopOpacity={0.75} />
                <stop offset="95%" stopColor={LAYER_META.Core.color} stopOpacity={0.08} />
              </linearGradient>
              <linearGradient id="areaSatellite" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={LAYER_META.Satellite.color} stopOpacity={0.75} />
                <stop offset="95%" stopColor={LAYER_META.Satellite.color} stopOpacity={0.08} />
              </linearGradient>
              <linearGradient id="areaDefensive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={LAYER_META.Defensive.color} stopOpacity={0.75} />
                <stop offset="95%" stopColor={LAYER_META.Defensive.color} stopOpacity={0.08} />
              </linearGradient>
              <linearGradient id="areaCash" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={LAYER_META.Cash.color} stopOpacity={0.75} />
                <stop offset="95%" stopColor={LAYER_META.Cash.color} stopOpacity={0.08} />
              </linearGradient>
              <linearGradient id="areaValuation" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.04} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              stroke="#64748b"
              fontSize={12}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={55}
              tickMargin={4}
              stroke="#64748b"
              fontSize={11}
              tickFormatter={(val) => formatCompactAxis(val, baseCurrency)}
            />
            <Tooltip content={<AreaCustomTooltip baseCurrency={baseCurrency} mode={mode} />} />

            {mode === 'valuation' ? (
              <Area
                type="natural"
                dataKey="total"
                name="资产总估值"
                stroke="#2563eb"
                strokeWidth={2.5}
                fill="url(#areaValuation)"
                isAnimationActive={false}
              />
            ) : (
              <>
                <Area
                  type="monotone"
                  stackId="1"
                  dataKey="Core"
                  name="Core"
                  stroke={LAYER_META.Core.color}
                  strokeWidth={1.5}
                  fill="url(#areaCore)"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  stackId="1"
                  dataKey="Satellite"
                  name="Satellite"
                  stroke={LAYER_META.Satellite.color}
                  strokeWidth={1.5}
                  fill="url(#areaSatellite)"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  stackId="1"
                  dataKey="Defensive"
                  name="Defensive"
                  stroke={LAYER_META.Defensive.color}
                  strokeWidth={1.5}
                  fill="url(#areaDefensive)"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  stackId="1"
                  dataKey="Cash"
                  name="Cash"
                  stroke={LAYER_META.Cash.color}
                  strokeWidth={1.5}
                  fill="url(#areaCash)"
                  isAnimationActive={false}
                />
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="gf-chart-card-footer">
        <div className="gf-chart-trending-tag">
          <TrendingUp size={15} />
          <span>
            {snapshots.length >= 2
              ? `已记录 ${snapshots.length} 期真实历史审视快照`
              : '无虚构历史数据 · 展示真实实盘至目标走廊的结构收敛路径'}
          </span>
        </div>
        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
          基于本地季度审视快照与实时仓位 · 100% 浏览器本地运算
        </div>
      </div>
    </div>
  );
}
