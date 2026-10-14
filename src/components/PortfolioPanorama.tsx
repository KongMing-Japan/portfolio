import { useMemo, useState } from 'react';
import {
  BarChart3,
  Coins,
  Globe2,
  Landmark,
  PieChart as PieChartIcon,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  assetClassFromHolding,
  formatMoney,
  formatPercent,
  marketFromTicker,
} from '../lib/portfolio';
import type {
  AggregatedHolding,
  BaseCurrency,
  Holding,
} from '../types';

interface PortfolioPanoramaProps {
  holdings: Holding[];
  aggregated: AggregatedHolding[];
  totalValue: number;
  baseCurrency: BaseCurrency;
}

type PanoramaDimension = 'market' | 'broker' | 'assetClass' | 'currency';
type ChartType = 'bar' | 'donut';

const PALETTE = [
  '#2563eb', // Blue (Primary)
  '#0d9488', // Teal
  '#f59e0b', // Amber
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#64748b', // Slate
];

interface PanoramaTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      label: string;
      value: number;
      weight: number;
      count: number;
      items: string[];
      color: string;
    };
  }>;
  baseCurrency: BaseCurrency;
}

function PanoramaChartTooltip({ active, payload, baseCurrency }: PanoramaTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;

  return (
    <div className="shadcn-chart-tooltip">
      <div className="shadcn-chart-tooltip-header">
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: data.color,
            display: 'inline-block',
          }}
        />
        <span>{data.label}</span>
      </div>
      <div className="shadcn-chart-tooltip-row">
        <span>权重占比</span>
        <strong>{formatPercent(data.weight)}</strong>
      </div>
      <div className="shadcn-chart-tooltip-row">
        <span>评估市值</span>
        <strong>{formatMoney(data.value, baseCurrency)}</strong>
      </div>
      <div className="shadcn-chart-tooltip-row">
        <span>包含标的</span>
        <span>{data.count} 只标的</span>
      </div>
    </div>
  );
}

export function PortfolioPanorama({
  holdings,
  totalValue,
  baseCurrency,
}: PortfolioPanoramaProps) {
  const [dimension, setDimension] = useState<PanoramaDimension>('market');
  const [chartType, setChartType] = useState<ChartType>('bar');

  // 1. Group by Market / Geography
  const marketGroups = useMemo(() => {
    const map = new Map<string, { value: number; count: number; items: string[] }>();
    for (const h of holdings) {
      const market = marketFromTicker(h.ticker, h.name);
      const val = h.valueInBase ?? 0;
      const cur = map.get(market) ?? { value: 0, count: 0, items: [] };
      cur.value += val;
      cur.count += 1;
      if (!cur.items.includes(h.ticker || h.name)) {
        cur.items.push(h.ticker || h.name);
      }
      map.set(market, cur);
    }
    return [...map.entries()]
      .map(([label, d]) => ({
        label,
        value: d.value,
        weight: totalValue > 0 ? d.value / totalValue : 0,
        count: d.count,
        items: d.items,
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, totalValue]);

  // 2. Group by Broker
  const brokerGroups = useMemo(() => {
    const map = new Map<string, { value: number; count: number; items: string[] }>();
    for (const h of holdings) {
      const broker = h.broker?.trim() || '未标注券商';
      const val = h.valueInBase ?? 0;
      const cur = map.get(broker) ?? { value: 0, count: 0, items: [] };
      cur.value += val;
      cur.count += 1;
      if (!cur.items.includes(h.ticker || h.name)) {
        cur.items.push(h.ticker || h.name);
      }
      map.set(broker, cur);
    }
    return [...map.entries()]
      .map(([label, d]) => ({
        label,
        value: d.value,
        weight: totalValue > 0 ? d.value / totalValue : 0,
        count: d.count,
        items: d.items,
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, totalValue]);

  // 3. Group by Asset Class (Equity, ETF, Fund, Cash)
  const assetClassGroups = useMemo(() => {
    const map = new Map<string, { value: number; count: number; items: string[] }>();
    for (const h of holdings) {
      const cls = assetClassFromHolding(h.ticker, h.name, h.theme);
      const label =
        cls === 'Equity'
          ? '股票个股'
          : cls === 'ETF'
          ? '交易所 ETF'
          : cls === 'Fund'
          ? '公募基金 / 投资信托'
          : '货币与现金';

      const val = h.valueInBase ?? 0;
      const cur = map.get(label) ?? { value: 0, count: 0, items: [] };
      cur.value += val;
      cur.count += 1;
      if (!cur.items.includes(h.ticker || h.name)) {
        cur.items.push(h.ticker || h.name);
      }
      map.set(label, cur);
    }
    return [...map.entries()]
      .map(([label, d]) => ({
        label,
        value: d.value,
        weight: totalValue > 0 ? d.value / totalValue : 0,
        count: d.count,
        items: d.items,
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, totalValue]);

  // 4. Group by Currency
  const currencyGroups = useMemo(() => {
    const map = new Map<string, { value: number; count: number; items: string[] }>();
    for (const h of holdings) {
      const curKey = h.currency?.trim() || baseCurrency;
      const val = h.valueInBase ?? 0;
      const cur = map.get(curKey) ?? { value: 0, count: 0, items: [] };
      cur.value += val;
      cur.count += 1;
      if (!cur.items.includes(h.ticker || h.name)) {
        cur.items.push(h.ticker || h.name);
      }
      map.set(curKey, cur);
    }
    return [...map.entries()]
      .map(([label, d]) => ({
        label,
        value: d.value,
        weight: totalValue > 0 ? d.value / totalValue : 0,
        count: d.count,
        items: d.items,
      }))
      .sort((a, b) => b.value - a.value);
  }, [baseCurrency, holdings, totalValue]);

  const activeGroups = useMemo(() => {
    const list =
      dimension === 'market'
        ? marketGroups
        : dimension === 'broker'
        ? brokerGroups
        : dimension === 'assetClass'
        ? assetClassGroups
        : currencyGroups;
    return list.map((item, idx) => ({
      ...item,
      color: PALETTE[idx % PALETTE.length],
      percentNum: Math.round(item.weight * 1000) / 10,
    }));
  }, [dimension, marketGroups, brokerGroups, assetClassGroups, currencyGroups]);

  const dimensionTitle =
    dimension === 'market'
      ? '地理与市场分布 (中美日主线)'
      : dimension === 'broker'
      ? '证券公司与账户沉淀分布'
      : dimension === 'assetClass'
      ? '资产类别透视 (股票/ETF/基金/现金)'
      : '主权货币与外汇暴露';

  return (
    <section
      className="gf-panorama-section"
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '1.4rem 1.6rem',
        margin: '1.5rem 0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      }}
    >
      {/* Top Header & Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.2rem',
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 600,
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Globe2 size={18} color="#2563eb" />
            <span>{dimensionTitle}</span>
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
            参考 Shadcn UI 资产图表标准，支持水平排行与环形配置多维交互透视
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Dimension Tabs (Shadcn Tabs style) */}
          <div
            style={{
              display: 'inline-flex',
              background: '#f1f5f9',
              borderRadius: '6px',
              padding: '3px',
              gap: '2px',
              border: '1px solid #e2e8f0',
            }}
          >
            <button
              onClick={() => setDimension('market')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                border: 'none',
                borderRadius: '4px',
                background: dimension === 'market' ? '#ffffff' : 'transparent',
                color: dimension === 'market' ? '#0f172a' : '#64748b',
                fontWeight: dimension === 'market' ? 600 : 500,
                fontSize: '0.78rem',
                cursor: 'pointer',
                boxShadow: dimension === 'market' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Globe2 size={13} />
              <span>市场地域</span>
            </button>
            <button
              onClick={() => setDimension('broker')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                border: 'none',
                borderRadius: '4px',
                background: dimension === 'broker' ? '#ffffff' : 'transparent',
                color: dimension === 'broker' ? '#0f172a' : '#64748b',
                fontWeight: dimension === 'broker' ? 600 : 500,
                fontSize: '0.78rem',
                cursor: 'pointer',
                boxShadow: dimension === 'broker' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Landmark size={13} />
              <span>证券公司</span>
            </button>
            <button
              onClick={() => setDimension('assetClass')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                border: 'none',
                borderRadius: '4px',
                background: dimension === 'assetClass' ? '#ffffff' : 'transparent',
                color: dimension === 'assetClass' ? '#0f172a' : '#64748b',
                fontWeight: dimension === 'assetClass' ? 600 : 500,
                fontSize: '0.78rem',
                cursor: 'pointer',
                boxShadow: dimension === 'assetClass' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <PieChartIcon size={13} />
              <span>资产类型</span>
            </button>
            <button
              onClick={() => setDimension('currency')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                border: 'none',
                borderRadius: '4px',
                background: dimension === 'currency' ? '#ffffff' : 'transparent',
                color: dimension === 'currency' ? '#0f172a' : '#64748b',
                fontWeight: dimension === 'currency' ? 600 : 500,
                fontSize: '0.78rem',
                cursor: 'pointer',
                boxShadow: dimension === 'currency' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Coins size={13} />
              <span>货币币种</span>
            </button>
          </div>

          {/* Chart View Toggle (Bar vs Donut) */}
          <div
            style={{
              display: 'inline-flex',
              background: '#f1f5f9',
              borderRadius: '6px',
              padding: '3px',
              gap: '2px',
              border: '1px solid #e2e8f0',
            }}
          >
            <button
              onClick={() => setChartType('bar')}
              title="水平条形图"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '5px 9px',
                border: 'none',
                borderRadius: '4px',
                background: chartType === 'bar' ? '#ffffff' : 'transparent',
                color: chartType === 'bar' ? '#0f172a' : '#64748b',
                cursor: 'pointer',
                boxShadow: chartType === 'bar' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <BarChart3 size={14} />
            </button>
            <button
              onClick={() => setChartType('donut')}
              title="环形分布图"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '5px 9px',
                border: 'none',
                borderRadius: '4px',
                background: chartType === 'donut' ? '#ffffff' : 'transparent',
                color: chartType === 'donut' ? '#0f172a' : '#64748b',
                cursor: 'pointer',
                boxShadow: chartType === 'donut' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <PieChartIcon size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Recharts Section */}
      <div
        style={{
          border: '1px solid #f1f5f9',
          borderRadius: '8px',
          background: '#fafbfc',
          padding: '1.2rem',
          marginBottom: '1.2rem',
        }}
      >
        {chartType === 'bar' ? (
          <div style={{ width: '100%', height: Math.max(160, activeGroups.length * 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={activeGroups}
                layout="vertical"
                margin={{ top: 8, right: 36, left: 10, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(val) => `${val}%`}
                  domain={[0, 'dataMax + 5']}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  width={110}
                  tick={{ fontSize: 12, fill: '#0f172a', fontWeight: 500 }}
                />
                <Tooltip
                  content={<PanoramaChartTooltip baseCurrency={baseCurrency} />}
                  cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
                />
                <Bar dataKey="percentNum" radius={[0, 6, 6, 0]}>
                  {activeGroups.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ width: '100%', height: 230, display: 'flex', alignItems: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={<PanoramaChartTooltip baseCurrency={baseCurrency} />} />
                <Pie
                  data={activeGroups}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={65}
                  outerRadius={90}
                  paddingAngle={3}
                  cornerRadius={4}
                  stroke="#ffffff"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {activeGroups.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                </Pie>
                <text
                  x="50%"
                  y="46%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#0f172a"
                  fontSize={16}
                  fontWeight={700}
                >
                  {formatMoney(totalValue, baseCurrency)}
                </text>
                <text
                  x="50%"
                  y="58%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#64748b"
                  fontSize={11}
                  fontWeight={500}
                >
                  透视总值
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Multi-Segment Color Bar */}
      <div
        style={{
          display: 'flex',
          height: '6px',
          width: '100%',
          borderRadius: '999px',
          overflow: 'hidden',
          background: '#f1f5f9',
          marginBottom: '1.2rem',
        }}
      >
        {activeGroups.map((group) =>
          group.weight > 0 ? (
            <div
              key={group.label}
              style={{
                width: `${group.weight * 100}%`,
                background: group.color,
                transition: 'width 0.3s ease',
              }}
              title={`${group.label}: ${formatPercent(group.weight)}`}
            />
          ) : null,
        )}
      </div>

      {/* Group Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(activeGroups.length, 4)}, 1fr)`,
          gap: '0.85rem',
        }}
      >
        {activeGroups.map((group) => {
          return (
            <div
              key={group.label}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.85rem 1rem',
                background: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: group.color,
                    }}
                  />
                  <strong
                    style={{
                      fontSize: '0.82rem',
                      color: '#0f172a',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={group.label}
                  >
                    {group.label}
                  </strong>
                </div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: '#64748b',
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    borderRadius: '999px',
                    padding: '1px 7px',
                    fontWeight: 500,
                  }}
                >
                  {group.count} 项
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  marginTop: '2px',
                }}
              >
                <span
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatPercent(group.weight)}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: '#64748b',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatMoney(group.value, baseCurrency)}
                </span>
              </div>

              {/* Sample holdings list snippet */}
              <div
                style={{
                  fontSize: '0.72rem',
                  color: '#94a3b8',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginTop: '2px',
                }}
                title={group.items.join(', ')}
              >
                {group.items.slice(0, 3).join(', ')}
                {group.items.length > 3 ? '...' : ''}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
