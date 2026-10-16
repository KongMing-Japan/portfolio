import { History, Layers3, Scale, ShieldAlert, ShieldCheck } from 'lucide-react';
import { formatMoney, formatPercent, LAYER_META } from '../lib/portfolio';
import type { AggregatedHolding, BaseCurrency, Layer } from '../types';

interface NovaRebalanceAdviceCardProps {
  layerRows: Array<{
    layer: Layer;
    rows: any[];
    value: number;
    weight: number;
  }>;
  total: number;
  baseCurrency: BaseCurrency;
  aggregated: AggregatedHolding[];
  rebalancingSignals: Array<{
    type: 'warning' | 'info' | 'success';
    title: string;
    detail: string;
  }>;
  hhi: number;
  onOpenRebalance: () => void;
  onOpenTimeline: () => void;
}

export function NovaRebalanceAdviceCard({
  layerRows,
  baseCurrency,
  aggregated,
  rebalancingSignals,
  hhi,
  onOpenRebalance,
  onOpenTimeline,
}: NovaRebalanceAdviceCardProps) {
  const largest = aggregated[0]?.weight ?? 0;
  const topFive = aggregated.slice(0, 5).reduce((sum, h) => sum + h.weight, 0);

  return (
    <div className="gf-chart-card">
      <div className="gf-chart-card-header">
        <div className="gf-chart-title-group">
          <h3>
            <Scale size={18} color="var(--primary)" />
            <span>四层金字塔与再平衡风控</span>
          </h3>
          <p>四层资产配置目标走廊与智能偏离诊断</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            className="gf-text-action"
            onClick={onOpenTimeline}
            style={{ fontSize: '12px', padding: '5px 10px' }}
            title="保存或对比季度持仓复盘快照"
          >
            <History size={13} />
            <span>复盘快照</span>
          </button>
          <button
            type="button"
            className="gf-primary-action"
            onClick={onOpenRebalance}
            style={{ fontSize: '12px', padding: '5px 12px' }}
          >
            <Scale size={13} color="#ffffff" />
            <span>再平衡试算</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Four Layers Target Deviations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {layerRows.map((row) => {
            let status: 'ok' | 'under' | 'over' = 'ok';
            let minTarget = 0.50;
            let maxTarget = 0.60;
            let targetText = '目标 50-60%';

            if (row.layer === 'Satellite') {
              minTarget = 0.15;
              maxTarget = 0.25;
              targetText = '目标 15-25%';
            } else if (row.layer === 'Defensive') {
              minTarget = 0.10;
              maxTarget = 0.22;
              targetText = '目标 10-22%';
            } else if (row.layer === 'Cash') {
              minTarget = 0.05;
              maxTarget = 0.15;
              targetText = '目标 5-15%';
            }

            if (row.weight > maxTarget) status = 'over';
            else if (row.weight < minTarget) status = 'under';

            return (
              <div key={row.layer} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: LAYER_META[row.layer].color }} />
                    <strong style={{ color: 'var(--foreground)' }}>{LAYER_META[row.layer].label}</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>({targetText})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ fontSize: '0.73rem', color: 'var(--muted-foreground)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatMoney(row.value, baseCurrency)}
                    </span>
                    <strong style={{ color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatPercent(row.weight)}
                    </strong>
                    {status === 'over' ? (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: 'color-mix(in oklch, #ef4444 12%, transparent)',
                          color: '#dc2626',
                        }}
                      >
                        偏高
                      </span>
                    ) : status === 'under' ? (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: 'color-mix(in oklch, #f59e0b 12%, transparent)',
                          color: '#b45309',
                        }}
                      >
                        偏低
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: 'color-mix(in oklch, #10b981 12%, transparent)',
                          color: '#059669',
                        }}
                      >
                        稳健
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ height: '5px', width: '100%', background: 'var(--muted)', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(row.weight * 100, 100)}%`,
                      background: status === 'over' ? '#ef4444' : status === 'under' ? '#f59e0b' : LAYER_META[row.layer].color,
                      borderRadius: '9999px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Health Stats Row */}
        <div className="nova-rebalance-stats-box">
          <div className="nova-stat-col">
            <span className="nova-stat-label">第一大重仓</span>
            <strong className="nova-stat-val">{formatPercent(largest)}</strong>
          </div>
          <div className="nova-stat-col">
            <span className="nova-stat-label">前五大集中度</span>
            <strong className="nova-stat-val">{formatPercent(topFive)}</strong>
          </div>
          <div className="nova-stat-col">
            <span className="nova-stat-label">HHI 分散指数</span>
            <strong className="nova-stat-val">{Math.round(hhi * 100)}</strong>
          </div>
        </div>

        {/* Intelligent Risk & Rebalancing Signals */}
        {rebalancingSignals.length > 0 && (
          <div className="nova-advisor-list">
            {rebalancingSignals.map((signal, idx) => (
              <div
                key={idx}
                className={`nova-signal-pill is-${signal.type}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  {signal.type === 'warning' ? (
                    <ShieldAlert size={14} color="#b45309" />
                  ) : signal.type === 'success' ? (
                    <ShieldCheck size={14} color="#059669" />
                  ) : (
                    <Layers3 size={14} color="var(--primary)" />
                  )}
                  <strong>{signal.title}</strong>
                </div>
                <span>{signal.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
