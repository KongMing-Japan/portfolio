import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  DollarSign,
  Download,
  Info,
  Layers,
  Percent,
  RefreshCw,
  Scale,
  Sliders,
  TrendingUp,
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
  Locale,
} from '../types';

interface RebalanceCockpitModalProps {
  isOpen: boolean;
  onClose: () => void;
  holdings: AggregatedHolding[];
  totalValue: number;
  baseCurrency: BaseCurrency;
  locale: Locale;
}

type RebalanceMode = 'inflow' | 'full';

const STORAGE_KEY = 'portfolio-custom-targets-v1';

export function RebalanceCockpitModal({
  isOpen,
  onClose,
  holdings,
  totalValue,
  baseCurrency,
  locale,
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
          borderRadius: '12px',
          width: 'min(980px, calc(100vw - 32px))',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 45px rgba(0,0,0,0.18)',
          border: '1px solid #dadce0',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: '1.2rem 1.8rem',
            borderBottom: '1px solid #e8eaed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fafbfc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: '#e8f0fe',
                color: '#1a73e8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Scale size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: '#202124' }}>
                  {locale === 'zh'
                    ? '再平衡决策驾驶舱'
                    : locale === 'ja'
                    ? 'リバランス意思決定コックピット'
                    : 'Rebalance Decision Cockpit'}
                </h2>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: '#e6f4ea',
                    color: '#137333',
                    fontWeight: 500,
                  }}
                >
                  {locale === 'zh' ? '机构纪律版' : 'Institutional Discipline'}
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#5f6368' }}>
                {locale === 'zh'
                  ? '时间 × 偏离双触发机制 · 消除情绪干扰，让投资组合回归目标走廊'
                  : 'Time & drift dual-trigger mechanism. Eliminate emotions and realign to target corridor.'}
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
                border: '1px solid #dadce0',
                background: showConfig ? '#f1f3f4' : '#ffffff',
                color: '#3c4043',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              <Sliders size={14} />
              <span>{locale === 'zh' ? '目标配比设定' : 'Target Config'}</span>
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                padding: '6px',
                cursor: 'pointer',
                color: '#5f6368',
                borderRadius: '4px',
              }}
              aria-label="Close"
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
                background: '#f8f9fa',
                border: '1px solid #dadce0',
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
                  <Layers size={16} color="#1a73e8" />
                  <strong style={{ fontSize: '0.88rem', color: '#202124' }}>
                    {locale === 'zh' ? '四层资产基准配比设定' : '4-Layer Target Allocation'}
                  </strong>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {Object.entries(TARGET_PRESETS).map(([key, item]) => (
                    <button
                      key={key}
                      onClick={() => applyPreset(key)}
                      style={{
                        padding: '4px 9px',
                        fontSize: '0.72rem',
                        borderRadius: '4px',
                        border: '1px solid',
                        borderColor: selectedPreset === key ? '#1a73e8' : '#dadce0',
                        background: selectedPreset === key ? '#e8f0fe' : '#ffffff',
                        color: selectedPreset === key ? '#1a73e8' : '#5f6368',
                        cursor: 'pointer',
                        fontWeight: selectedPreset === key ? 600 : 400,
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
                      border: '1px solid #e8eaed',
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
                      <strong style={{ fontSize: '0.9rem', color: '#202124' }}>
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
                <span style={{ color: '#5f6368' }}>
                  {locale === 'zh'
                    ? '容忍走廊基准：绝对偏离 ±5% 或相对偏离 ±20% 视为正常波动区间。'
                    : 'Corridor threshold: Drift within ±5% absolute or ±20% relative is considered target.'}
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    color: totalTargetPercent === 100 ? '#137333' : '#d93025',
                  }}
                >
                  {locale === 'zh' ? '目标总配比: ' : 'Total: '} {totalTargetPercent}%{' '}
                  {totalTargetPercent !== 100 &&
                    (locale === 'zh' ? '(需调整至 100%)' : '(Must equal 100%)')}
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
                  color: '#202124',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Percent size={15} color="#1a73e8" />
                <span>
                  {locale === 'zh'
                    ? '当前分层偏离走廊 (Tolerance Corridor)'
                    : 'Asset Allocation Drift & Tolerance Corridor'}
                </span>
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#5f6368' }}>
                {locale === 'zh' ? '组合现总值: ' : 'Total Portfolio: '}
                <strong style={{ color: '#202124' }}>
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
                      borderColor: isOver ? '#fce8e6' : isUnder ? '#fef7e0' : '#e8eaed',
                      borderRadius: '8px',
                      padding: '1rem',
                      background: isOver ? '#fffbfa' : isUnder ? '#fffdf7' : '#ffffff',
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
                        <strong style={{ fontSize: '0.85rem', color: '#202124' }}>
                          {LAYER_META[d.layer].label}
                        </strong>
                      </div>
                      {isOver ? (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: '#fce8e6',
                            color: '#c5221f',
                            fontWeight: 600,
                          }}
                        >
                          {locale === 'zh' ? '超配 ⚠️' : 'Overweight'}
                        </span>
                      ) : isUnder ? (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: '#fef7e0',
                            color: '#b06000',
                            fontWeight: 600,
                          }}
                        >
                          {locale === 'zh' ? '低配 ⬇' : 'Underweight'}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: '#e6f4ea',
                            color: '#137333',
                            fontWeight: 600,
                          }}
                        >
                          {locale === 'zh' ? '合规 ✓' : 'In Corridor'}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: '#202124',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatPercent(d.currentWeight)}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#5f6368' }}>
                        / 目标 {formatPercent(d.targetWeight)}
                      </span>
                    </div>

                    {/* Progress Bar with target marker */}
                    <div
                      style={{
                        position: 'relative',
                        height: '6px',
                        background: '#e8eaed',
                        borderRadius: '99px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(d.currentWeight * 100, 100)}%`,
                          background: isOver
                            ? '#d93025'
                            : isUnder
                            ? '#f9ab00'
                            : LAYER_META[d.layer].color,
                        }}
                      />
                    </div>

                    <div
                      style={{
                        fontSize: '0.73rem',
                        color: deltaDollars > 0 ? '#b06000' : '#5f6368',
                        marginTop: '2px',
                      }}
                    >
                      {deltaDollars > 0
                        ? `${locale === 'zh' ? '需补仓: +' : 'Need: +'}${formatMoney(deltaDollars, baseCurrency)}`
                        : deltaDollars < 0
                        ? `${locale === 'zh' ? '超配额: ' : 'Surplus: '}${formatMoney(Math.abs(deltaDollars), baseCurrency)}`
                        : `${locale === 'zh' ? '贴合目标' : 'On Target'}`}
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
              borderBottom: '1px solid #e8eaed',
              marginBottom: '1.2rem',
              gap: '1.5rem',
            }}
          >
            <button
              onClick={() => setMode('inflow')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: mode === 'inflow' ? '2px solid #1a73e8' : '2px solid transparent',
                padding: '0.6rem 0',
                color: mode === 'inflow' ? '#1a73e8' : '#5f6368',
                fontWeight: mode === 'inflow' ? 600 : 400,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <DollarSign size={16} />
              <span>{locale === 'zh' ? '模式 A: 现金注资补仓 (零卖出/免税推荐)' : 'Mode A: Inflow Rebalance (Buy-Only)'}</span>
            </button>
            <button
              onClick={() => setMode('full')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: mode === 'full' ? '2px solid #1a73e8' : '2px solid transparent',
                padding: '0.6rem 0',
                color: mode === 'full' ? '#1a73e8' : '#5f6368',
                fontWeight: mode === 'full' ? 600 : 400,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <RefreshCw size={15} />
              <span>{locale === 'zh' ? '模式 B: 完全目标调仓 (卖超配/买低配)' : 'Mode B: Full Rebalance (Buy & Sell)'}</span>
            </button>
          </div>

          {/* Mode A Content: Inflow Rebalance */}
          {mode === 'inflow' && (
            <div>
              <div
                style={{
                  background: '#f8f9fa',
                  border: '1px solid #e8eaed',
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
                    <Info size={15} color="#1a73e8" />
                    <strong style={{ fontSize: '0.85rem', color: '#202124' }}>
                      {locale === 'zh'
                        ? '季度现金流补仓法则 (Inflow Rebalancing)'
                        : 'Institutional Inflow Strategy'}
                    </strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#5f6368', maxWidth: '580px' }}>
                    {locale === 'zh'
                      ? '通过定投入金、股息回流或闲置现金，优先注入低配幅度最大的资产。全过程 0 笔卖出，零资本利得税和滑点手续费，最小化组合偏离。'
                      : 'Deploy fresh savings, dividends or cash reserves into underweight assets. Zero sells, zero taxes, and zero trading friction.'}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <label style={{ fontSize: '0.8rem', color: '#3c4043', fontWeight: 500 }}>
                    {locale === 'zh' ? '计划注入现金: ' : 'Planned Inflow: '}
                  </label>
                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={inflowInput}
                      onChange={(e) => setInflowInput(e.target.value)}
                      style={{
                        padding: '6px 10px',
                        border: '1px solid #dadce0',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        width: '130px',
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    />
                    <span style={{ marginLeft: '6px', fontSize: '0.8rem', color: '#5f6368', fontWeight: 500 }}>
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
                  <span style={{ fontSize: '0.82rem', color: '#3c4043', fontWeight: 500 }}>
                    {locale === 'zh'
                      ? `优化算法生成的买入执行清单 (共 ${inflowResult.trades.length} 项指令)`
                      : `Recommended Buy Orders (${inflowResult.trades.length} items)`}
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
                        borderRadius: '4px',
                        border: '1px solid #dadce0',
                        background: '#ffffff',
                        color: copied ? '#137333' : '#3c4043',
                        cursor: 'pointer',
                      }}
                    >
                      {copied ? <CheckCircle2 size={13} color="#137333" /> : <Copy size={13} />}
                      <span>{copied ? (locale === 'zh' ? '已复制清单' : 'Copied') : (locale === 'zh' ? '复制买入指令' : 'Copy Orders')}</span>
                    </button>
                  )}
                </div>

                <div style={{ border: '1px solid #e8eaed', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #e8eaed', color: '#5f6368', textAlign: 'left' }}>
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
                              borderBottom: '1px solid #f1f3f4',
                              color: '#202124',
                            }}
                          >
                            <td style={{ padding: '10px 12px' }}>
                              <span
                                style={{
                                  background: '#e6f4ea',
                                  color: '#137333',
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
                              <strong style={{ display: 'block', color: '#202124' }}>{trade.ticker}</strong>
                              <span style={{ fontSize: '0.72rem', color: '#80868b' }}>{trade.name}</span>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  color: LAYER_META[trade.layer]?.color ?? '#5f6368',
                                }}
                              >
                                {trade.layer}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', color: '#5f6368' }}>{trade.broker}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                              +{trade.suggestedShares} 股
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#137333', fontVariantNumeric: 'tabular-nums' }}>
                              {formatMoney(trade.amountInBase, baseCurrency)}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              <span style={{ color: '#80868b' }}>{formatPercent(trade.currentWeight)}</span>
                              <span style={{ margin: '0 4px', color: '#dadce0' }}>→</span>
                              <strong style={{ color: '#137333' }}>{formatPercent(trade.projectedWeight)}</strong>
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: '0.75rem', color: '#5f6368' }}>
                              {trade.reason}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#80868b' }}>
                            {locale === 'zh'
                              ? '当前无需买入，或请输入计划注入资金金额。'
                              : 'No buy orders needed or please enter planned inflow amount.'}
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
                  background: '#fef7e0',
                  border: '1px solid #f9ab00',
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
                    <AlertTriangle size={15} color="#b06000" />
                    <strong style={{ fontSize: '0.85rem', color: '#804400' }}>
                      {locale === 'zh'
                        ? '完全目标调仓 (Full Rebalancing - 卖出超配 & 买入低配)'
                        : 'Full Rebalancing Strategy'}
                    </strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#804400', maxWidth: '600px' }}>
                    {locale === 'zh'
                      ? '当某单一标的狂飙打破机构风控上限（如单票突破 15%），或组合严重失衡时，需通过卖出超配标的回收资金，并重新注入低配标的以强制恢复目标比例。'
                      : 'Trims positions that exceeded hard risk caps (e.g. >15%) and redeploys capital to underweight layers.'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.72rem', color: '#804400', display: 'block' }}>卖出总额</span>
                    <strong style={{ fontSize: '1rem', color: '#c5221f' }}>
                      {formatMoney(fullResult.totalSellAmount, baseCurrency)}
                    </strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.72rem', color: '#804400', display: 'block' }}>买入总额</span>
                    <strong style={{ fontSize: '1rem', color: '#137333' }}>
                      {formatMoney(fullResult.totalBuyAmount, baseCurrency)}
                    </strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.72rem', color: '#804400', display: 'block' }}>组合换手率</span>
                    <strong style={{ fontSize: '1rem', color: '#202124' }}>
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
                  <span style={{ fontSize: '0.82rem', color: '#3c4043', fontWeight: 500 }}>
                    {locale === 'zh'
                      ? `整体验算调仓指令清单 (共 ${fullResult.trades.length} 项动作)`
                      : `Full Rebalance Trade Orders (${fullResult.trades.length} items)`}
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
                        borderRadius: '4px',
                        border: '1px solid #dadce0',
                        background: '#ffffff',
                        color: copied ? '#137333' : '#3c4043',
                        cursor: 'pointer',
                      }}
                    >
                      {copied ? <CheckCircle2 size={13} color="#137333" /> : <Copy size={13} />}
                      <span>{copied ? (locale === 'zh' ? '已复制指令' : 'Copied') : (locale === 'zh' ? '复制调仓指令' : 'Copy Orders')}</span>
                    </button>
                  )}
                </div>

                <div style={{ border: '1px solid #e8eaed', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #e8eaed', color: '#5f6368', textAlign: 'left' }}>
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
                                borderBottom: '1px solid #f1f3f4',
                                background: isSell ? '#fffbfa' : '#ffffff',
                              }}
                            >
                              <td style={{ padding: '10px 12px' }}>
                                <span
                                  style={{
                                    background: isSell ? '#fce8e6' : '#e6f4ea',
                                    color: isSell ? '#c5221f' : '#137333',
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
                                <strong style={{ display: 'block', color: '#202124' }}>{trade.ticker}</strong>
                                <span style={{ fontSize: '0.72rem', color: '#80868b' }}>{trade.name}</span>
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <span
                                  style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    color: LAYER_META[trade.layer]?.color ?? '#5f6368',
                                  }}
                                >
                                  {trade.layer}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', color: '#5f6368' }}>{trade.broker}</td>
                              <td
                                style={{
                                  padding: '10px 12px',
                                  textAlign: 'right',
                                  fontWeight: 600,
                                  color: isSell ? '#c5221f' : '#137333',
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
                                  color: isSell ? '#c5221f' : '#137333',
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                {formatMoney(trade.amountInBase, baseCurrency)}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                <span style={{ color: '#80868b' }}>{formatPercent(trade.currentWeight)}</span>
                                <span style={{ margin: '0 4px', color: '#dadce0' }}>→</span>
                                <strong style={{ color: '#202124' }}>{formatPercent(trade.projectedWeight)}</strong>
                              </td>
                              <td style={{ padding: '10px 12px', fontSize: '0.75rem', color: '#5f6368' }}>
                                {trade.reason}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#80868b' }}>
                            {locale === 'zh'
                              ? '当前组合结构完美贴合目标配置走廊，无需调仓。'
                              : 'Portfolio is perfectly balanced within the target corridor.'}
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
            borderTop: '1px solid #e8eaed',
            background: '#fafbfc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#5f6368' }}>
            {locale === 'zh'
              ? '再平衡是投资者的刷牙洗脸，每季一次，规则执行，不含情绪。'
              : 'Rebalancing is disciplined hygiene. Conduct quarterly, rule-based, emotion-free.'}
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '6px 18px',
              borderRadius: '6px',
              border: 'none',
              background: '#1a73e8',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {locale === 'zh' ? '关闭驾驶舱' : 'Close'}
          </button>
        </footer>
      </div>
    </div>
  );
}
