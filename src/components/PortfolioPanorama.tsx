import { useMemo, useState } from 'react';
import {
  Coins,
  Globe2,
  Landmark,
  Layers,
  PieChart,
} from 'lucide-react';
import {
  assetClassFromHolding,
  formatMoney,
  formatPercent,
  marketFromTicker,
  type AssetClassType,
} from '../lib/portfolio';
import type {
  AggregatedHolding,
  BaseCurrency,
  Holding,
  Locale,
} from '../types';

interface PortfolioPanoramaProps {
  holdings: Holding[];
  aggregated: AggregatedHolding[];
  totalValue: number;
  baseCurrency: BaseCurrency;
  locale: Locale;
}

type PanoramaDimension = 'market' | 'broker' | 'assetClass' | 'currency';

const PALETTE = [
  '#1a73e8', // Google Blue
  '#137333', // Green
  '#f9ab00', // Yellow
  '#d93025', // Red
  '#9334e6', // Purple
  '#e37400', // Orange
  '#007b83', // Teal
  '#5f6368', // Gray
];

export function PortfolioPanorama({
  holdings,
  aggregated,
  totalValue,
  baseCurrency,
  locale,
}: PortfolioPanoramaProps) {
  const [dimension, setDimension] = useState<PanoramaDimension>('market');

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
      const broker = h.broker?.trim() || '未标注券商 (Unassigned)';
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
          ? (locale === 'zh' ? '股票个股' : locale === 'ja' ? '個別株式' : 'Individual Equities')
          : cls === 'ETF'
          ? (locale === 'zh' ? '交易所 ETF' : locale === 'ja' ? 'ETF' : 'Exchange-Traded Funds')
          : cls === 'Fund'
          ? (locale === 'zh' ? '公募基金 / 投資信託' : locale === 'ja' ? '投資信託' : 'Mutual Funds / Trusts')
          : (locale === 'zh' ? '货币与现金' : locale === 'ja' ? '現金・MMF' : 'Cash & Reserves');

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
  }, [holdings, locale, totalValue]);

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

  const activeGroups =
    dimension === 'market'
      ? marketGroups
      : dimension === 'broker'
      ? brokerGroups
      : dimension === 'assetClass'
      ? assetClassGroups
      : currencyGroups;

  const dimensionTitle =
    dimension === 'market'
      ? (locale === 'zh' ? '地理与市场分布 (中美日主线)' : 'Market & Geographical Exposure')
      : dimension === 'broker'
      ? (locale === 'zh' ? '证券公司与账户沉淀分布' : 'Broker & Custody Distribution')
      : dimension === 'assetClass'
      ? (locale === 'zh' ? '资产类别透视 (股票/ETF/基金/现金)' : 'Asset Class Breakdown')
      : (locale === 'zh' ? '主权货币与外汇暴露' : 'Currency Exposure');

  return (
    <section
      className="gf-panorama-section"
      style={{
        background: '#ffffff',
        border: '1px solid #dadce0',
        borderRadius: '8px',
        padding: '1.4rem 1.6rem',
        margin: '1.5rem 0',
      }}
    >
      {/* Top Header & Dimension Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 600,
              color: '#202124',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Globe2 size={18} color="#1a73e8" />
            <span>{dimensionTitle}</span>
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#5f6368' }}>
            {locale === 'zh'
              ? '跨券商、跨地域、多品类资产全景透视，洞察整体风险敞口'
              : 'Multi-broker, multi-market, multi-asset panoramic exposure insights'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'inline-flex',
            background: '#f1f3f4',
            borderRadius: '6px',
            padding: '2px',
            gap: '2px',
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
              borderRadius: '5px',
              background: dimension === 'market' ? '#ffffff' : 'transparent',
              color: dimension === 'market' ? '#1a73e8' : '#5f6368',
              fontWeight: dimension === 'market' ? 600 : 400,
              fontSize: '0.78rem',
              cursor: 'pointer',
              boxShadow: dimension === 'market' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Globe2 size={13} />
            <span>{locale === 'zh' ? '市场地域' : 'Markets'}</span>
          </button>
          <button
            onClick={() => setDimension('broker')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 12px',
              border: 'none',
              borderRadius: '5px',
              background: dimension === 'broker' ? '#ffffff' : 'transparent',
              color: dimension === 'broker' ? '#1a73e8' : '#5f6368',
              fontWeight: dimension === 'broker' ? 600 : 400,
              fontSize: '0.78rem',
              cursor: 'pointer',
              boxShadow: dimension === 'broker' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Landmark size={13} />
            <span>{locale === 'zh' ? '证券公司' : 'Brokers'}</span>
          </button>
          <button
            onClick={() => setDimension('assetClass')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 12px',
              border: 'none',
              borderRadius: '5px',
              background: dimension === 'assetClass' ? '#ffffff' : 'transparent',
              color: dimension === 'assetClass' ? '#1a73e8' : '#5f6368',
              fontWeight: dimension === 'assetClass' ? 600 : 400,
              fontSize: '0.78rem',
              cursor: 'pointer',
              boxShadow: dimension === 'assetClass' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <PieChart size={13} />
            <span>{locale === 'zh' ? '资产类型' : 'Asset Types'}</span>
          </button>
          <button
            onClick={() => setDimension('currency')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 12px',
              border: 'none',
              borderRadius: '5px',
              background: dimension === 'currency' ? '#ffffff' : 'transparent',
              color: dimension === 'currency' ? '#1a73e8' : '#5f6368',
              fontWeight: dimension === 'currency' ? 600 : 400,
              fontSize: '0.78rem',
              cursor: 'pointer',
              boxShadow: dimension === 'currency' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Coins size={13} />
            <span>{locale === 'zh' ? '货币币种' : 'Currencies'}</span>
          </button>
        </div>
      </div>

      {/* Multi-Segment Color Bar */}
      <div
        style={{
          display: 'flex',
          height: '10px',
          width: '100%',
          borderRadius: '99px',
          overflow: 'hidden',
          background: '#e8eaed',
          marginBottom: '1.2rem',
        }}
      >
        {activeGroups.map((group, idx) =>
          group.weight > 0 ? (
            <div
              key={group.label}
              style={{
                width: `${group.weight * 100}%`,
                background: PALETTE[idx % PALETTE.length],
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
        {activeGroups.map((group, idx) => {
          const color = PALETTE[idx % PALETTE.length];
          return (
            <div
              key={group.label}
              style={{
                border: '1px solid #e8eaed',
                borderRadius: '6px',
                padding: '0.85rem 1rem',
                background: '#fafbfc',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
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
                      background: color,
                    }}
                  />
                  <strong
                    style={{
                      fontSize: '0.82rem',
                      color: '#202124',
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
                    color: '#5f6368',
                    background: '#ffffff',
                    border: '1px solid #dadce0',
                    borderRadius: '10px',
                    padding: '1px 6px',
                  }}
                >
                  {group.count} {locale === 'zh' ? '项' : 'items'}
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
                    color: '#202124',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatPercent(group.weight)}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: '#5f6368',
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
                  color: '#80868b',
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
