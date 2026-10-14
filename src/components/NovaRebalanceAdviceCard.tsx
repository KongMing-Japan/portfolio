import { History, Layers3, Scale, ShieldAlert, ShieldCheck } from 'lucide-react';
import { formatPercent, LAYER_META } from '../lib/portfolio';
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
            <span>再平衡风控诊断与偏离监控</span>
          </h3>
          <p>四层资产配置偏离度评估 · 智能风控信号与再平衡建议</p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button
            className="gf-text-action"
            onClick={onOpenTimeline}
            title="低频季度/月度审视快照与历史对照"
            style={{ fontSize: '11px', padding: '4px 8px' }}
          >
            <History size={13} />
            <span>周期快照</span>
          </button>
          <button
            className="gf-primary-action"
            onClick={onOpenRebalance}
            style={{ fontSize: '11px', padding: '4px 10px' }}
          >
            <Scale size={13} color="#4ade80" />
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
            let targetText = '50-60%';

            if (row.layer === 'Satellite') {
              minTarget = 0.20;
              maxTarget = 0.30;
              targetText = '20-30%';
            } else if (row.layer === 'Defensive') {
              minTarget = 0.10;
              maxTarget = 0.15;
              targetText = '10-15%';
            } else if (row.layer === 'Cash') {
              minTarget = 0.05;
              maxTarget = 0.10;
              targetText = '5-10%';
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <strong style={{ color: 'var(--foreground)' }}>{formatPercent(row.weight)}</strong>
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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.5rem',
            padding: '0.6rem 0.8rem',
            borderRadius: 'calc(var(--radius) * 0.8)',
            background: 'var(--muted)',
            border: '1px solid var(--border)',
            fontSize: '0.75rem',
          }}
        >
          <div>
            <span style={{ color: 'var(--muted-foreground)', display: 'block' }}>第一大重仓</span>
            <strong style={{ color: 'var(--foreground)', fontSize: '0.85rem' }}>{formatPercent(largest)}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--muted-foreground)', display: 'block' }}>前五大集中度</span>
            <strong style={{ color: 'var(--foreground)', fontSize: '0.85rem' }}>{formatPercent(topFive)}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--muted-foreground)', display: 'block' }}>HHI 分散指数</span>
            <strong style={{ color: 'var(--foreground)', fontSize: '0.85rem' }}>{Math.round(hhi * 100)}</strong>
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
