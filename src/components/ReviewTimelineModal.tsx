import { useEffect, useMemo, useState } from 'react';
import {
  Clock,
  History,
  Plus,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  calculateSnapshotDiff,
  deleteReviewSnapshot,
  loadReviewSnapshots,
  saveReviewSnapshot,
} from '../lib/storage';
import { formatDateTime, formatMoney, formatPercent, LAYER_META } from '../lib/portfolio';
import type {
  AggregatedHolding,
  BaseCurrency,
  Holding,
  Layer,
  ReviewJournalNote,
  ReviewSnapshot,
  SnapshotDiffResult,
} from '../types';

interface ReviewTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentHoldings: Holding[];
  aggregatedHoldings: AggregatedHolding[];
  totalValue: number;
  baseCurrency: BaseCurrency;
  onRestoreSnapshot?: (snapshot: ReviewSnapshot) => void;
}

export function ReviewTimelineModal({
  isOpen,
  onClose,
  currentHoldings,
  aggregatedHoldings,
  totalValue,
  baseCurrency,
  onRestoreSnapshot,
}: ReviewTimelineModalProps) {
  const [snapshots, setSnapshots] = useState<ReviewSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'timeline' | 'archive'>('timeline');
  const [comparingSnapshotId, setComparingSnapshotId] = useState<string | null>(null);

  // Archive Form State
  const defaultLabel = useMemo(() => {
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `${now.getFullYear()}-Q${q} 季度审视`;
  }, []);

  const [label, setLabel] = useState(defaultLabel);
  const [disciplineChecks, setDisciplineChecks] = useState({
    singleHoldingUnderCap: true,
    singleThemeUnderCap: true,
    cashReserveAdequate: true,
  });
  const [bestDecision, setBestDecision] = useState('');
  const [worstDecision, setWorstDecision] = useState('');
  const [nextQuarterPlan, setNextQuarterPlan] = useState('');

  const refreshSnapshots = async () => {
    setLoading(true);
    try {
      const list = await loadReviewSnapshots();
      setSnapshots(list);
    } catch {
      setSnapshots([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void refreshSnapshots();
      setLabel(defaultLabel);
    }
  }, [defaultLabel, isOpen]);

  // Handle Archive Save
  const handleSaveSnapshot = async () => {
    if (!label.trim()) return;

    const layerValues: Record<Layer, number> = {
      Core: 0,
      Satellite: 0,
      Defensive: 0,
      Cash: 0,
    };
    for (const h of aggregatedHoldings) {
      layerValues[h.layer] = (layerValues[h.layer] ?? 0) + h.marketValueBase;
    }
    const layerWeights: Record<Layer, number> = {
      Core: totalValue > 0 ? layerValues.Core / totalValue : 0,
      Satellite: totalValue > 0 ? layerValues.Satellite / totalValue : 0,
      Defensive: totalValue > 0 ? layerValues.Defensive / totalValue : 0,
      Cash: totalValue > 0 ? layerValues.Cash / totalValue : 0,
    };

    const hhiScore = aggregatedHoldings.reduce((sum, h) => sum + h.weight ** 2, 0);

    const notes: ReviewJournalNote = {
      summary: `${label} - 完成组合体检与资产再平衡`,
      disciplineChecks,
      bestDecision: bestDecision.trim() || undefined,
      worstDecision: worstDecision.trim() || undefined,
      nextQuarterPlan: nextQuarterPlan.trim() || undefined,
    };

    const newSnapshot: ReviewSnapshot = {
      id: `snapshot-${Date.now()}`,
      label: label.trim(),
      createdAt: new Date().toISOString(),
      baseCurrency,
      totalValueBase: totalValue,
      holdings: currentHoldings,
      layerWeights,
      hhiScore,
      notes,
    };

    await saveReviewSnapshot(newSnapshot);
    await refreshSnapshots();
    setActiveTab('timeline');
    setBestDecision('');
    setWorstDecision('');
    setNextQuarterPlan('');
  };

  const handleDeleteSnapshot = async (id: string) => {
    if (!confirm('确定删除该历史快照吗？')) {
      return;
    }
    await deleteReviewSnapshot(id);
    if (comparingSnapshotId === id) setComparingSnapshotId(null);
    await refreshSnapshots();
  };

  // Compare Snapshot Diff
  const comparedSnapshot = useMemo(
    () => snapshots.find((s) => s.id === comparingSnapshotId),
    [comparingSnapshotId, snapshots],
  );

  const diffResult: SnapshotDiffResult | null = useMemo(() => {
    if (!comparedSnapshot) return null;
    return calculateSnapshotDiff(
      comparedSnapshot.holdings,
      currentHoldings,
      comparedSnapshot.totalValueBase,
      totalValue,
    );
  }, [comparedSnapshot, currentHoldings, totalValue]);

  if (!isOpen) return null;

  return (
    <div className="gf-modal-backdrop" role="dialog" aria-modal="true">
      <div
        className="gf-timeline-modal"
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
              <History size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: '#0f172a' }}>
                  周期审视时间轴与复盘
                </h2>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: '#f1f5f9',
                    color: '#64748b',
                    fontWeight: 600,
                  }}
                >
                  {snapshots.length} 份快照
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                每月/每季定期归档 · 回溯资产演进 · 跨期对比净值与分层漂移
              </p>
            </div>
          </div>
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
        </header>

        {/* Tab Controls */}
        <div
          style={{
            display: 'flex',
            padding: '0 1.8rem',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff',
            gap: '1.5rem',
          }}
        >
          <button
            onClick={() => {
              setActiveTab('timeline');
              setComparingSnapshotId(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'timeline' ? '2px solid #0f172a' : '2px solid transparent',
              padding: '0.75rem 0',
              color: activeTab === 'timeline' ? '#0f172a' : '#64748b',
              fontWeight: activeTab === 'timeline' ? 600 : 500,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Clock size={16} />
            <span>历史审视时间轴</span>
          </button>
          <button
            onClick={() => setActiveTab('archive')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'archive' ? '2px solid #0f172a' : '2px solid transparent',
              padding: '0.75rem 0',
              color: activeTab === 'archive' ? '#0f172a' : '#64748b',
              fontWeight: activeTab === 'archive' ? 600 : 500,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Plus size={16} />
            <span>归档当前审视 (新建快照)</span>
          </button>
        </div>

        {/* Body Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 1.8rem' }}>
          {activeTab === 'archive' && (
            <div style={{ maxWidth: '680px', margin: '0 auto' }}>
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '1.2rem',
                  marginBottom: '1.5rem',
                }}
              >
                <h3 style={{ margin: '0 0 0.8rem', fontSize: '0.92rem', color: '#0f172a', fontWeight: 600 }}>
                  归档本次审视并记录复盘备忘
                </h3>

                <label style={{ display: 'block', marginBottom: '1rem' }}>
                  <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#0f172a', marginBottom: '4px' }}>
                    快照标签名称
                  </span>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '0.88rem',
                      background: '#ffffff',
                      color: '#0f172a',
                    }}
                    placeholder="2026-Q4 季度审视"
                  />
                </label>

                {/* Built-in discipline checklist */}
                <div style={{ marginBottom: '1.2rem' }}>
                  <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#0f172a', marginBottom: '6px' }}>
                    投资纪律自检卡片
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.8rem', color: '#64748b' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={disciplineChecks.singleHoldingUnderCap}
                        onChange={(e) =>
                          setDisciplineChecks((c) => ({ ...c, singleHoldingUnderCap: e.target.checked }))
                        }
                      />
                      <span>单一标的持仓未突破 15% 机构风控上限</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={disciplineChecks.singleThemeUnderCap}
                        onChange={(e) =>
                          setDisciplineChecks((c) => ({ ...c, singleThemeUnderCap: e.target.checked }))
                        }
                      />
                      <span>单一产业/赛道权重未突破 35% 风险上限</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={disciplineChecks.cashReserveAdequate}
                        onChange={(e) =>
                          setDisciplineChecks((c) => ({ ...c, cashReserveAdequate: e.target.checked }))
                        }
                      />
                      <span>维持 3%~6% 以上多币种现金弹药与防守缓冲</span>
                    </label>
                  </div>
                </div>

                {/* Notes input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <label>
                    <span style={{ display: 'block', fontSize: '0.8rem', color: '#0f172a', fontWeight: 500, marginBottom: '4px' }}>
                      本周期最满意的决策（选填）
                    </span>
                    <input
                      type="text"
                      value={bestDecision}
                      onChange={(e) => setBestDecision(e.target.value)}
                      placeholder="例如：在英伟达大跌时按计划分批补仓，没有受恐慌情绪干扰"
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.82rem', background: '#ffffff', color: '#0f172a' }}
                    />
                  </label>
                  <label>
                    <span style={{ display: 'block', fontSize: '0.8rem', color: '#0f172a', fontWeight: 500, marginBottom: '4px' }}>
                      本周期最遗憾的决策 / 教训（选填）
                    </span>
                    <input
                      type="text"
                      value={worstDecision}
                      onChange={(e) => setWorstDecision(e.target.value)}
                      placeholder="例如：对某个卫星仓标的投入过多注意力，偏离了双主线核心"
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.82rem', background: '#ffffff', color: '#0f172a' }}
                    />
                  </label>
                  <label>
                    <span style={{ display: 'block', fontSize: '0.8rem', color: '#0f172a', fontWeight: 500, marginBottom: '4px' }}>
                      下阶段行动要点（选填）
                    </span>
                    <input
                      type="text"
                      value={nextQuarterPlan}
                      onChange={(e) => setNextQuarterPlan(e.target.value)}
                      placeholder="例如：季度分红到账后，优先注资补平日股与防守仓缺口"
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.82rem', background: '#ffffff', color: '#0f172a' }}
                    />
                  </label>
                </div>

                <button
                  onClick={handleSaveSnapshot}
                  style={{
                    marginTop: '1.2rem',
                    width: '100%',
                    padding: '9px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                >
                  立即归档保存为不可变快照
                </button>
              </div>
            </div>
          )}

          {activeTab === 'timeline' && !comparedSnapshot && (
            <div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>加载中...</div>
              ) : snapshots.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '3rem 2rem',
                    border: '1px dashed #cbd5e1',
                    borderRadius: '8px',
                    color: '#64748b',
                  }}
                >
                  <History size={36} color="#94a3b8" style={{ marginBottom: '0.8rem' }} />
                  <h3 style={{ margin: '0 0 0.4rem', color: '#0f172a', fontWeight: 600 }}>
                    尚未归档任何审视快照
                  </h3>
                  <p style={{ margin: '0 0 1rem', fontSize: '0.82rem' }}>
                    每完成一次月度或季度再平衡体检，点击上方“归档当前审视”即可保存永久快照，未来可随时对比。
                  </p>
                  <button
                    onClick={() => setActiveTab('archive')}
                    style={{
                      padding: '7px 16px',
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
                    去归档第一份快照
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {snapshots.map((snap) => (
                    <div
                      key={snap.id}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '1.2rem',
                        background: '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.8rem',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              background: '#eff6ff',
                              color: '#2563eb',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                            }}
                          >
                            {snap.label}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            {formatDateTime(snap.createdAt)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            onClick={() => setComparingSnapshotId(snap.id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              border: '1px solid #2563eb',
                              background: '#eff6ff',
                              color: '#2563eb',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              cursor: 'pointer',
                            }}
                          >
                            <TrendingUp size={13} />
                            <span>与当前持仓对比</span>
                          </button>
                          {onRestoreSnapshot && (
                            <button
                              onClick={() => {
                                if (confirm('确定将此历史快照载入为主工作区吗？')) {
                                  onRestoreSnapshot(snap);
                                  onClose();
                                }
                              }}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                                background: '#ffffff',
                                color: '#64748b',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                              }}
                            >
                              载入主视图
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteSnapshot(snap.id)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0',
                              background: '#ffffff',
                              color: '#64748b',
                              cursor: 'pointer',
                            }}
                            title="删除快照"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Value and 4 Layers bar */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>归档净资产: </span>
                          <strong style={{ fontSize: '1.15rem', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                            {formatMoney(snap.totalValueBase, snap.baseCurrency)}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.75rem' }}>
                          {(['Core', 'Satellite', 'Defensive', 'Cash'] as Layer[]).map((l) => (
                            <span key={l}>
                              <span style={{ color: LAYER_META[l].color, fontWeight: 600 }}>{LAYER_META[l].label}: </span>
                              <strong>{formatPercent(snap.layerWeights[l] ?? 0)}</strong>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Four Layer Strip */}
                      <div
                        style={{
                          display: 'flex',
                          height: '6px',
                          borderRadius: '999px',
                          overflow: 'hidden',
                          background: '#f1f5f9',
                        }}
                      >
                        {(['Core', 'Satellite', 'Defensive', 'Cash'] as Layer[]).map((l) =>
                          (snap.layerWeights[l] ?? 0) > 0 ? (
                            <div
                              key={l}
                              style={{
                                width: `${(snap.layerWeights[l] ?? 0) * 100}%`,
                                background: LAYER_META[l].color,
                              }}
                            />
                          ) : null,
                        )}
                      </div>

                      {/* Notes snippet */}
                      {snap.notes && (snap.notes.bestDecision || snap.notes.worstDecision) && (
                        <div
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            padding: '0.6rem 0.8rem',
                            fontSize: '0.75rem',
                            color: '#64748b',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '3px',
                          }}
                        >
                          {snap.notes.bestDecision && (
                            <div>
                              <strong style={{ color: '#166534' }}>得意决策: </strong>
                              {snap.notes.bestDecision}
                            </div>
                          )}
                          {snap.notes.worstDecision && (
                            <div>
                              <strong style={{ color: '#b91c1c' }}>反思教训: </strong>
                              {snap.notes.worstDecision}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Diff View with Compared Snapshot */}
          {activeTab === 'timeline' && comparedSnapshot && diffResult && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1rem',
                  paddingBottom: '0.8rem',
                  borderBottom: '1px solid #e2e8f0',
                }}
              >
                <div>
                  <button
                    onClick={() => setComparingSnapshotId(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      padding: 0,
                      marginBottom: '4px',
                      fontWeight: 500,
                    }}
                  >
                    返回快照列表
                  </button>
                  <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a', fontWeight: 600 }}>
                    跨期对比：{comparedSnapshot.label} 与当前组合
                  </h3>
                </div>

                {/* Net Worth Delta */}
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>总资产净变动</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <strong
                      style={{
                        fontSize: '1.2rem',
                        color: diffResult.totalDelta >= 0 ? '#166534' : '#b91c1c',
                      }}
                    >
                      {diffResult.totalDelta >= 0 ? '+' : ''}
                      {formatMoney(diffResult.totalDelta, baseCurrency)}
                    </strong>
                    <span
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: diffResult.totalDelta >= 0 ? '#166534' : '#b91c1c',
                      }}
                    >
                      ({diffResult.totalDeltaPercent >= 0 ? '+' : ''}
                      {formatPercent(diffResult.totalDeltaPercent)})
                    </span>
                  </div>
                </div>
              </div>

              {/* Layer Drifts Comparison */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '0.85rem',
                  marginBottom: '1.2rem',
                }}
              >
                {(['Core', 'Satellite', 'Defensive', 'Cash'] as Layer[]).map((l) => {
                  const d = diffResult.layerDiffs[l];
                  return (
                    <div
                      key={l}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        padding: '0.75rem',
                        background: '#f8fafc',
                      }}
                    >
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: LAYER_META[l].color }}>
                        {LAYER_META[l].label}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
                        <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{formatPercent(d.before)}</span>
                        <span>→</span>
                        <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>{formatPercent(d.after)}</strong>
                      </div>
                      <div
                        style={{
                          fontSize: '0.72rem',
                          color: d.delta > 0 ? '#166534' : d.delta < 0 ? '#b91c1c' : '#64748b',
                          marginTop: '2px',
                        }}
                      >
                        {d.delta > 0 ? '+' : ''}
                        {formatPercent(d.delta)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Positions Delta Table */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>标的代码 / 名称</th>
                      <th style={{ padding: '8px 12px' }}>分层</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>股数变动</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>估值变动</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>权重变动</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffResult.items.map((item) => (
                      <tr key={item.ticker} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <strong style={{ display: 'block', color: '#0f172a' }}>{item.ticker}</strong>
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{item.name}</span>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: LAYER_META[item.layer]?.color }}>
                            {LAYER_META[item.layer]?.label ?? item.layer}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          <span style={{ color: item.sharesDelta > 0 ? '#166534' : item.sharesDelta < 0 ? '#b91c1c' : '#64748b' }}>
                            {item.sharesDelta > 0 ? `+${item.sharesDelta}` : item.sharesDelta}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '8px 12px',
                            textAlign: 'right',
                            fontWeight: 600,
                            fontVariantNumeric: 'tabular-nums',
                            color: item.valueDelta > 0 ? '#166534' : item.valueDelta < 0 ? '#b91c1c' : '#64748b',
                          }}
                        >
                          {item.valueDelta > 0 ? '+' : ''}
                          {formatMoney(item.valueDelta, baseCurrency)}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          <span style={{ color: '#94a3b8' }}>{formatPercent(item.weightBefore)}</span>
                          <span style={{ margin: '0 4px', color: '#cbd5e1' }}>→</span>
                          <strong style={{ color: '#0f172a' }}>{formatPercent(item.weightAfter)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer
          style={{
            padding: '0.85rem 1.8rem',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            复盘是对过去决策的诚实记录，不是对运气的执念。
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
            关闭
          </button>
        </footer>
      </div>
    </div>
  );
}
