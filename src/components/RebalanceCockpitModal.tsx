import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  DollarSign,
  Info,
  Layers,
  Percent,
  RefreshCw,
  Scale,
  Sliders,
  X,
} from 'lucide-react';
import {
  calculateFullRebalance,
  calculateInflowRebalance,
  calculateLayerDrift,
  DEFAULT_TARGET_CONFIG,
  TARGET_PRESETS,
} from '../lib/rebalance';
import { formatMoney, formatPercent, LAYER_META } from '../lib/portfolio';
import type {
  AggregatedHolding,
  BaseCurrency,
  Layer,
  LayerTargetConfig,
} from '../types';

interface RebalanceCockpitModalProps {
  isOpen: boolean;
  onClose: () => void;
  holdings: AggregatedHolding[];
  totalValue: number;
  baseCurrency: BaseCurrency;
}

type RebalanceMode = 'inflow' | 'full';

const STORAGE_KEY = 'portfolio-custom-targets-v1';

export function RebalanceCockpitModal({
  isOpen,
  onClose,
  holdings,
  totalValue,
  baseCurrency,
}: RebalanceCockpitModalProps) {
  // Load saved custom targets or default
  const [targets, setTargets] = useState<LayerTargetConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_TARGET_CONFIG;
  });

  const [selectedPreset, setSelectedPreset] = useState<string>('institutional');
  const [mode, setMode] = useState<RebalanceMode>('inflow');
  const [inflowInput, setInflowInput] = useState<string>(() => {
    // Default inflow suggestion based on currency
    if (baseCurrency === 'JPY') return '500000';
    if (baseCurrency === 'CNY') return '20000';
    return '3000';
  });
  const [copied, setCopied] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Targets sum check
  const totalTargetPercent = useMemo(
    () =>
      Math.round(
        (targets.Core + targets.Satellite + targets.Defensive + targets.Cash) * 100,
      ),
    [targets],
  );

  const applyPreset = (presetKey: string) => {
    const preset = TARGET_PRESETS[presetKey];
    if (preset) {
      setSelectedPreset(presetKey);
      setTargets(preset.targets);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preset.targets));
    }
  };

  const updateTargetLayer = (layer: Layer, valuePercent: number) => {
    setSelectedPreset('custom');
    const updated = {
      ...targets,
      [layer]: Math.max(0, Math.min(100, valuePercent)) / 100,
    };
    setTargets(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  // 1. Calculate layer drifts
  const layerDrifts = useMemo(
    () => calculateLayerDrift(holdings, totalValue, targets),
    [holdings, totalValue, targets],
  );

  const numericInflow = useMemo(() => {
    const val = parseFloat(inflowInput.replace(/,/g, ''));
    return Number.isFinite(val) && val > 0 ? val : 0;
  }, [inflowInput]);

  // 2. Mode A: Inflow calculation
  const inflowResult = useMemo(
    () =>
      calculateInflowRebalance(
        holdings,
        numericInflow,
        targets,
        totalValue,
      ),
    [holdings, numericInflow, targets, totalValue],
  );

  // 3. Mode B: Full rebalance calculation
  const fullResult = useMemo(
    () => calculateFullRebalance(holdings, targets, totalValue),
    [holdings, targets, totalValue],
  );

  const copyTradeList = (trades: typeof inflowResult.trades) => {
    const text = trades
      .map(
        (t) =>
          `[${t.action}] ${t.ticker} (${t.name}) | 券商: ${t.broker} | 建议数量: ${t.suggestedShares}股 | 预估金额: ${formatMoney(t.amountInBase, baseCurrency)} | 原因: ${t.reason}`,
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="gf-modal-backdrop" role="dialog" aria-modal="true">
      <div
        className="gf-cockpit-modal"
        style={{
          background: '#ffffff',
          borderRadius: '10px',
          width: 'min(980px, calc(100vw - 32px))',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 45px rgba(0,0,0,0.14)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: '1.2rem 1.8rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Scale size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: '#0f172a' }}>
                  再平衡决策驾驶舱
                </h2>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: '#dcfce7',
                    color: '#166534',
                    fontWeight: 600,
                  }}
                >
                  机构纪律版
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                时间 × 偏离双触发机制 · 消除情绪干扰，让投资组合回归目标走廊
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setShowConfig(!showConfig)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                background: showConfig ? '#f1f5f9' : '#ffffff',
                color: '#0f172a',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Sliders size={14} />
              <span>目标配比设定</span>
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                padding: '6px',
                cursor: 'pointer',
                color: '#64748b',
                borderRadius: '6px',
              }}
              aria-label="关闭"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 1.8rem' }}>
          {/* Target Configuration Collapsible Card */}
          {showConfig && (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '1.2rem',
                marginBottom: '1.5rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layers size={16} color="#2563eb" />
                  <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>
                    四层资产基准配比设定
                  </strong>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {Object.entries(TARGET_PRESETS).map(([key, item]) => (
                    <button
                      key={key}
                      onClick={() => applyPreset(key)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.72rem',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: selectedPreset === key ? '#2563eb' : '#e2e8f0',
                        background: selectedPreset === key ? '#eff6ff' : '#ffffff',
                        color: selectedPreset === key ? '#2563eb' : '#64748b',
                        cursor: 'pointer',
                        fontWeight: selectedPreset === key ? 600 : 500,
                      }}
                    >
                      {item.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '1rem',
                }}
              >
                {(['Core', 'Satellite', 'Defensive', 'Cash'] as Layer[]).map((l) => (
                  <div
                    key={l}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '0.75rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '0.4rem',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          color: LAYER_META[l].color,
                        }}
                      >
                        {LAYER_META[l].label}
                      </span>
                      <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>
                        {Math.round(targets[l] * 100)}%
                      </strong>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={Math.round(targets[l] * 100)}
                      onChange={(e) => updateTargetLayer(l, Number(e.target.value))}
                      style={{ width: '100%', cursor: 'pointer' }}
                    />
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '0.8rem',
                  fontSize: '0.75rem',
                }}
              >
                <span style={{ color: '#64748b' }}>
                  容忍走廊基准：绝对偏离 ±5% 或相对偏离 ±20% 视为正常波动区间。
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    color: totalTargetPercent === 100 ? '#166534' : '#b91c1c',
                  }}
                >
                  目标总配比: {totalTargetPercent}%{' '}
                  {totalTargetPercent !== 100 && '(需调整至 100%)'}
                </span>
              </div>
            </div>
          )}

          {/* Section 1: Tolerance Corridor & Drift Status (走廊状态与偏离看板) */}
          <section style={{ marginBottom: '1.8rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.8rem',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '0.92rem',
                  fontWeight: 600,
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Percent size={15} color="#2563eb" />
                <span>当前分层偏离走廊 (Tolerance Corridor)</span>
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                组合现总值:{' '}
                <strong style={{ color: '#0f172a' }}>
                  {formatMoney(totalValue, baseCurrency)}
                </strong>
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '0.85rem',
              }}
            >
              {layerDrifts.map((d) => {
                const isOver = d.status === 'over';
                const isUnder = d.status === 'under';
                const deltaDollars = d.valueDelta;

                return (
                  <div
                    key={d.layer}
                    style={{
                      border: '1px solid',
                      borderColor: isOver ? '#fecaca' : isUnder ? '#fef08a' : '#e2e8f0',
                      borderRadius: '8px',
                      padding: '1rem',
                      background: isOver ? '#fef2f2' : isUnder ? '#fffbeb' : '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
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
                            background: LAYER_META[d.layer].color,
                          }}
                        />
                        <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>
                          {LAYER_META[d.layer].label}
                        </strong>
                      </div>
                      {isOver ? (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '2px 7px',
                            borderRadius: '999px',
                            background: '#fee2e2',
                            color: '#991b1b',
                            fontWeight: 600,
                          }}
                        >
                          超配
                        </span>
                      ) : isUnder ? (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '2px 7px',
                            borderRadius: '999px',
                            background: '#fef3c7',
                            color: '#92400e',
                            fontWeight: 600,
                          }}
                        >
                          低配
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '2px 7px',
                            borderRadius: '999px',
                            background: '#dcfce7',
                            color: '#166534',
                            fontWeight: 600,
                          }}
                        >
                          合规
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: '#0f172a',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatPercent(d.currentWeight)}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        / 目标 {formatPercent(d.targetWeight)}
                      </span>
                    </div>

                    {/* Progress Bar with target marker */}
                    <div
                      style={{
                        position: 'relative',
                        height: '6px',
                        background: '#f1f5f9',
                        borderRadius: '999px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(d.currentWeight * 100, 100)}%`,
                          background: isOver
                            ? '#ef4444'
                            : isUnder
                            ? '#f59e0b'
                            : LAYER_META[d.layer].color,
                        }}
                      />
                    </div>

                    <div
                      style={{
                        fontSize: '0.73rem',
                        color: deltaDollars > 0 ? '#b45309' : '#64748b',
                        marginTop: '2px',
                      }}
                    >
                      {deltaDollars > 0
                        ? `需补仓: +${formatMoney(deltaDollars, baseCurrency)}`
                        : deltaDollars < 0
                        ? `超配额: ${formatMoney(Math.abs(deltaDollars), baseCurrency)}`
                        : '贴合目标'}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section 2: Dual Mode Rebalance Selection */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid #e2e8f0',
              marginBottom: '1.2rem',
              gap: '1.5rem',
            }}
          >
            <button
              onClick={() => setMode('inflow')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: mode === 'inflow' ? '2px solid #0f172a' : '2px solid transparent',
                padding: '0.6rem 0',
                color: mode === 'inflow' ? '#0f172a' : '#64748b',
                fontWeight: mode === 'inflow' ? 600 : 500,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <DollarSign size={16} />
              <span>模式 A: 现金注资补仓 (零卖出/免税推荐)</span>
            </button>
            <button
              onClick={() => setMode('full')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: mode === 'full' ? '2px solid #0f172a' : '2px solid transparent',
                padding: '0.6rem 0',
                color: mode === 'full' ? '#0f172a' : '#64748b',
                fontWeight: mode === 'full' ? 600 : 500,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <RefreshCw size={15} />
              <span>模式 B: 完全目标调仓 (卖超配/买低配)</span>
            </button>
          </div>

          {/* Mode A Content: Inflow Rebalance */}
          {mode === 'inflow' && (
            <div>
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '1.2rem',
                  marginBottom: '1.2rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <Info size={15} color="#2563eb" />
                    <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>
                      季度现金流补仓法则 (Inflow Rebalancing)
                    </strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', maxWidth: '580px', lineHeight: 1.5 }}>
                    通过定投入金、股息回流或闲置现金，优先注入低配幅度最大的资产。全过程 0 笔卖出，零资本利得税和滑点手续费，最小化组合偏离。
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <label style={{ fontSize: '0.8rem', color: '#0f172a', fontWeight: 500 }}>
                    计划注入现金:
                  </label>
                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={inflowInput}
                      onChange={(e) => setInflowInput(e.target.value)}
                      style={{
                        padding: '6px 10px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        width: '130px',
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        background: '#ffffff',
                        color: '#0f172a',
                      }}
                    />
                    <span style={{ marginLeft: '6px', fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
                      {baseCurrency}
                    </span>
                  </div>
                </div>
              </div>

              {/* Inflow Action Table */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.6rem',
                  }}
                >
                  <span style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 500 }}>
                    优化算法生成的买入执行清单 (共 {inflowResult.trades.length} 项指令)
                  </span>
                  {inflowResult.trades.length > 0 && (
                    <button
                      onClick={() => copyTradeList(inflowResult.trades)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.75rem',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        background: '#ffffff',
                        color: copied ? '#166534' : '#0f172a',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      {copied ? <CheckCircle2 size={13} color="#166534" /> : <Copy size={13} />}
                      <span>{copied ? '已复制清单' : '复制买入指令'}</span>
                    </button>
                  )}
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px' }}>动作</th>
                        <th style={{ padding: '8px 12px' }}>标的 / 名称</th>
                        <th style={{ padding: '8px 12px' }}>分层</th>
                        <th style={{ padding: '8px 12px' }}>推荐券商</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>建议买入数量</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>预计投入金额</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>权重变化</th>
                        <th style={{ padding: '8px 12px' }}>规则依据</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inflowResult.trades.length > 0 ? (
                        inflowResult.trades.map((trade) => (
                          <tr
                            key={trade.ticker}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              color: '#0f172a',
                            }}
                          >
                            <td style={{ padding: '10px 12px' }}>
                              <span
                                style={{
                                  background: '#dcfce7',
                                  color: '#166534',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                  fontSize: '0.72rem',
                                }}
                              >
                                BUY 买入
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <strong style={{ display: 'block', color: '#0f172a' }}>{trade.ticker}</strong>
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{trade.name}</span>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  color: LAYER_META[trade.layer]?.color ?? '#64748b',
                                }}
                              >
                                {trade.layer}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', color: '#64748b' }}>{trade.broker}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                              +{trade.suggestedShares} 股
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#166534', fontVariantNumeric: 'tabular-nums' }}>
                              {formatMoney(trade.amountInBase, baseCurrency)}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              <span style={{ color: '#64748b' }}>{formatPercent(trade.currentWeight)}</span>
                              <span style={{ margin: '0 4px', color: '#cbd5e1' }}>→</span>
                              <strong style={{ color: '#166534' }}>{formatPercent(trade.projectedWeight)}</strong>
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: '0.75rem', color: '#64748b' }}>
                              {trade.reason}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                            当前无需买入，或请输入计划注入资金金额。
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Mode B Content: Full Rebalance */}
          {mode === 'full' && (
            <div>
              <div
                style={{
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                  padding: '1.2rem',
                  marginBottom: '1.2rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <AlertTriangle size={15} color="#b45309" />
                    <strong style={{ fontSize: '0.85rem', color: '#92400e' }}>
                      完全目标调仓 (Full Rebalancing - 卖出超配 & 买入低配)
                    </strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#92400e', maxWidth: '600px', lineHeight: 1.5 }}>
                    当某单一标的狂飙打破机构风控上限（如单票突破 15%），或组合严重失衡时，需通过卖出超配标的回收资金，并重新注入低配标的以强制恢复目标比例。
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.72rem', color: '#92400e', display: 'block' }}>卖出总额</span>
                    <strong style={{ fontSize: '1rem', color: '#b91c1c' }}>
                      {formatMoney(fullResult.totalSellAmount, baseCurrency)}
                    </strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.72rem', color: '#92400e', display: 'block' }}>买入总额</span>
                    <strong style={{ fontSize: '1rem', color: '#166534' }}>
                      {formatMoney(fullResult.totalBuyAmount, baseCurrency)}
                    </strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.72rem', color: '#92400e', display: 'block' }}>组合换手率</span>
                    <strong style={{ fontSize: '1rem', color: '#0f172a' }}>
                      {formatPercent(fullResult.turnoverRate)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Full Trade Table */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.6rem',
                  }}
                >
                  <span style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 500 }}>
                    整体验算调仓指令清单 (共 {fullResult.trades.length} 项动作)
                  </span>
                  {fullResult.trades.length > 0 && (
                    <button
                      onClick={() => copyTradeList(fullResult.trades)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.75rem',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        background: '#ffffff',
                        color: copied ? '#166534' : '#0f172a',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      {copied ? <CheckCircle2 size={13} color="#166534" /> : <Copy size={13} />}
                      <span>{copied ? '已复制指令' : '复制调仓指令'}</span>
                    </button>
                  )}
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px' }}>动作</th>
                        <th style={{ padding: '8px 12px' }}>标的 / 名称</th>
                        <th style={{ padding: '8px 12px' }}>分层</th>
                        <th style={{ padding: '8px 12px' }}>执行券商</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>操作股数</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>预估金额</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>权重变化</th>
                        <th style={{ padding: '8px 12px' }}>风控与规则依据</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fullResult.trades.length > 0 ? (
                        fullResult.trades.map((trade) => {
                          const isSell = trade.action === 'SELL';
                          return (
                            <tr
                              key={`${trade.ticker}-${trade.action}`}
                              style={{
                                borderBottom: '1px solid #f1f5f9',
                                background: isSell ? '#fef2f2' : '#ffffff',
                              }}
                            >
                              <td style={{ padding: '10px 12px' }}>
                                <span
                                  style={{
                                    background: isSell ? '#fee2e2' : '#dcfce7',
                                    color: isSell ? '#991b1b' : '#166534',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontWeight: 600,
                                    fontSize: '0.72rem',
                                  }}
                                >
                                  {isSell ? 'SELL 卖出' : 'BUY 买入'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <strong style={{ display: 'block', color: '#0f172a' }}>{trade.ticker}</strong>
                                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{trade.name}</span>
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <span
                                  style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    color: LAYER_META[trade.layer]?.color ?? '#64748b',
                                  }}
                                >
                                  {trade.layer}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', color: '#64748b' }}>{trade.broker}</td>
                              <td
                                style={{
                                  padding: '10px 12px',
                                  textAlign: 'right',
                                  fontWeight: 600,
                                  color: isSell ? '#b91c1c' : '#166534',
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                {isSell ? '-' : '+'}
                                {trade.suggestedShares} 股
                              </td>
                              <td
                                style={{
                                  padding: '10px 12px',
                                  textAlign: 'right',
                                  fontWeight: 600,
                                  color: isSell ? '#b91c1c' : '#166534',
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                {formatMoney(trade.amountInBase, baseCurrency)}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                <span style={{ color: '#64748b' }}>{formatPercent(trade.currentWeight)}</span>
                                <span style={{ margin: '0 4px', color: '#cbd5e1' }}>→</span>
                                <strong style={{ color: '#0f172a' }}>{formatPercent(trade.projectedWeight)}</strong>
                              </td>
                              <td style={{ padding: '10px 12px', fontSize: '0.75rem', color: '#64748b' }}>
                                {trade.reason}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                            当前组合结构完美贴合目标配置走廊，无需调仓。
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer
          style={{
            padding: '1rem 1.8rem',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            再平衡是投资者的刷牙洗脸，每季一次，规则执行，不含情绪。
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '7px 18px',
              borderRadius: '6px',
              border: 'none',
              background: '#0f172a',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 500,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            关闭驾驶舱
          </button>
        </footer>
      </div>
    </div>
  );
}
