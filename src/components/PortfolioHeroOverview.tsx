import { useState, useMemo, useEffect } from 'react';
import {
  Area,
  AreaChart,
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
  TrendingUp,
  PieChart as PieIcon,
  Calendar,
  Edit3,
  Layers,
  ShieldCheck,
  Check,
  X,
  Plus,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import type { AggregatedHolding, BaseCurrency } from '../types';
import { formatMoney, formatPercent } from '../lib/portfolio';

export interface MonthlyNetWorthRecord {
  month: string; // e.g. "2024-05" or "5月"
  valueJpy: number;
}

const DEFAULT_HISTORY: MonthlyNetWorthRecord[] = [
  { month: '2024-05', valueJpy: 112500000 },
  { month: '2024-06', valueJpy: 116800000 },
  { month: '2024-07', valueJpy: 114200000 },
  { month: '2024-08', valueJpy: 118600000 },
  { month: '2024-09', valueJpy: 121900000 },
];

const STORAGE_KEY = 'portfolio_networth_history_records_v1';

const LAYER_COLORS: Record<string, string> = {
  Core: '#3b82f6', // blue
  Defensive: '#10b981', // emerald
  Satellite: '#f59e0b', // amber
  Cash: '#64748b', // slate
};

interface PortfolioHeroOverviewProps {
  totalValue: number;
  baseCurrency: BaseCurrency;
  fx: Record<string, number>;
  aggregated: AggregatedHolding[];
}

export function PortfolioHeroOverview({
  totalValue,
  baseCurrency,
  fx,
  aggregated,
}: PortfolioHeroOverviewProps) {
  // 1. Manage Historical Records
  const [historyRecords, setHistoryRecords] = useState<MonthlyNetWorthRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_HISTORY;
  });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingList, setEditingList] = useState<MonthlyNetWorthRecord[]>(historyRecords);

  // FX conversion helper: from JPY to baseCurrency
  const convertJpyToBase = (jpyVal: number): number => {
    if (baseCurrency === 'JPY') return jpyVal;
    const rate = fx[baseCurrency];
    return rate && rate > 0 ? jpyVal * rate : jpyVal;
  };

  // Convert current total in baseCurrency back to JPY for storage
  const currentTotalJpy = useMemo(() => {
    if (baseCurrency === 'JPY') return totalValue;
    const rate = fx[baseCurrency];
    return rate && rate > 0 ? totalValue / rate : totalValue;
  }, [baseCurrency, totalValue, fx]);

  // Combined chart data (Past records + Current October anchor)
  const chartData = useMemo(() => {
    const list = [...historyRecords];
    // Append or update current month 2024-10
    const currentMonthLabel = '2024-10';
    const existingIdx = list.findIndex((item) => item.month === currentMonthLabel);
    if (existingIdx >= 0) {
      list[existingIdx] = { month: currentMonthLabel, valueJpy: currentTotalJpy };
    } else {
      list.push({ month: currentMonthLabel, valueJpy: currentTotalJpy });
    }

    return list.map((item, idx) => {
      const valBase = convertJpyToBase(item.valueJpy);
      const prev = idx > 0 ? convertJpyToBase(list[idx - 1].valueJpy) : null;
      const momReturn = prev && prev > 0 ? (valBase - prev) / prev : null;
      const label = item.month.replace(/^\d{4}-/, '') + '月';
      return {
        month: label,
        fullMonth: item.month,
        value: valBase,
        valueJpy: item.valueJpy,
        momReturn,
      };
    });
  }, [historyRecords, currentTotalJpy, baseCurrency, fx]);

  // Calculate MoM return for the current latest month
  const latestMoM = useMemo(() => {
    if (chartData.length < 2) return null;
    const current = chartData[chartData.length - 1];
    return current.momReturn;
  }, [chartData]);

  // 2. Layer Calculations for Pie Chart
  const { pieData, coreWeight, defWeight, satWeight, cashWeight, coreThreeWeight } = useMemo(() => {
    let coreVal = 0;
    let defVal = 0;
    let satVal = 0;
    let cashVal = 0;

    for (const item of aggregated) {
      if (item.layer === 'Core') coreVal += item.marketValueBase;
      else if (item.layer === 'Defensive') defVal += item.marketValueBase;
      else if (item.layer === 'Satellite') satVal += item.marketValueBase;
      else if (item.layer === 'Cash') cashVal += item.marketValueBase;
    }

    const cw = totalValue > 0 ? coreVal / totalValue : 0;
    const dw = totalValue > 0 ? defVal / totalValue : 0;
    const sw = totalValue > 0 ? satVal / totalValue : 0;
    const csw = totalValue > 0 ? cashVal / totalValue : 0;

    const data = [
      { name: '核心仓 (Core)', layer: 'Core', value: coreVal, weight: cw, target: '60%', color: LAYER_COLORS.Core },
      { name: '防守仓 (Defensive)', layer: 'Defensive', value: defVal, weight: dw, target: '20%', color: LAYER_COLORS.Defensive },
      { name: '卫星仓 (Satellite)', layer: 'Satellite', value: satVal, weight: sw, target: '20%', color: LAYER_COLORS.Satellite },
      { name: '现金储备 (Cash)', layer: 'Cash', value: cashVal, weight: csw, target: '缓冲', color: LAYER_COLORS.Cash },
    ];

    return {
      pieData: data,
      coreWeight: cw,
      defWeight: dw,
      satWeight: sw,
      cashWeight: csw,
      coreThreeWeight: cw + dw + sw,
    };
  }, [aggregated, totalValue]);

  // Save edited history
  const handleSaveHistory = () => {
    setHistoryRecords(editingList);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(editingList));
    } catch {
      // ignore
    }
    setIsEditOpen(false);
  };

  const handleOpenEdit = () => {
    setEditingList([...historyRecords]);
    setIsEditOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* =====================================================================
            LEFT (2 Cols): Net Worth Evolution Area Chart
           ===================================================================== */}
        <Card className="lg:col-span-2 overflow-hidden shadow-xs flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">投资组合总净值</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                    {baseCurrency}
                  </Badge>
                  {latestMoM !== null && (
                    <span
                      className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                        latestMoM >= 0
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      <TrendingUp size={12} className={latestMoM < 0 ? 'rotate-180' : ''} />
                      <span>{latestMoM >= 0 ? '+' : ''}{(latestMoM * 100).toFixed(1)}% 环比</span>
                    </span>
                  )}
                </div>
                <div className="text-3xl font-bold tracking-tight text-foreground tabular-nums mt-1">
                  {formatMoney(totalValue, baseCurrency)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                  <Calendar size={12} />
                  <span>2024.05 ~ 2024.10 推移</span>
                </span>
                <button
                  type="button"
                  onClick={handleOpenEdit}
                  className="gf-text-action text-xs font-medium py-1 px-2 rounded-md"
                  title="录入或调整历史月度净值基准"
                >
                  <Edit3 size={12} />
                  <span>调整历史</span>
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-2 pb-3">
            <div className="h-[210px] w-full">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 210 }}>
                <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.6} />
                  <XAxis
                    dataKey="month"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    dy={5}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => {
                      if (baseCurrency === 'JPY') {
                        return `${(val / 100000000).toFixed(2)}亿`;
                      }
                      return `${(val / 1000).toFixed(0)}k`;
                    }}
                    domain={['dataMin - 5000000', 'dataMax + 5000000']}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-border bg-popover/95 p-2.5 shadow-md backdrop-blur-xs text-xs space-y-1">
                          <p className="font-medium text-foreground">{d.fullMonth} 月末净值</p>
                          <p className="text-sm font-bold text-primary tabular-nums">
                            {formatMoney(d.value, baseCurrency)}
                          </p>
                          {d.momReturn !== null && (
                            <p className="text-[11px] text-muted-foreground tabular-nums">
                              月度环比：
                              <span className={d.momReturn >= 0 ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'}>
                                {d.momReturn >= 0 ? '+' : ''}{(d.momReturn * 100).toFixed(2)}%
                              </span>
                            </p>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#netWorthGradient)"
                    dot={{ r: 3.5, fill: '#3b82f6', strokeWidth: 1.5, stroke: 'var(--card)' }}
                    activeDot={{ r: 5.5, strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* =====================================================================
            RIGHT (1 Col): Three Core Layers Pie / Donut Chart
           ===================================================================== */}
        <Card className="shadow-xs flex flex-col justify-between">
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-1.5">
                  <PieIcon size={15} className="text-primary" />
                  <span>核心三仓结构</span>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  核心仓为主体 · 辅以防守与机动现金
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                三仓 {formatPercent(coreThreeWeight, 0)}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-1 pb-3 space-y-3">
            {/* Donut Chart with Center KPI */}
            <div className="relative h-[155px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 220, height: 155 }}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={46}
                    outerRadius={68}
                    paddingAngle={2.5}
                    stroke="var(--card)"
                    strokeWidth={2}
                    isAnimationActive={false}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.layer} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">核心仓</span>
                <span className="text-lg font-bold text-foreground tabular-nums leading-tight">
                  {formatPercent(coreWeight, 1)}
                </span>
              </div>
            </div>

            {/* Concise Layer Breakdown List */}
            <div className="space-y-1.5 text-xs">
              {pieData.map((item) => (
                <div key={item.layer} className="flex items-center justify-between py-0.5 border-b border-border/40 last:border-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="size-2 rounded-full shrink-0" style={{ background: item.color }} />
                    <span className="font-medium text-foreground truncate">{item.name.split(' ')[0]}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      (目标 {item.target})
                    </span>
                  </div>
                  <div className="text-right tabular-nums shrink-0">
                    <span className="font-semibold text-foreground mr-1.5">{formatPercent(item.weight, 1)}</span>
                    <span className="text-[11px] text-muted-foreground">({formatMoney(item.value, baseCurrency)})</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Historical Records Modal */}
      {isEditOpen && (
        <div className="gf-modal-backdrop" role="presentation">
          <div className="p-5 rounded-2xl bg-card border border-border shadow-2xl max-w-md w-full mx-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <h3 className="text-base font-bold text-foreground">修改历史月度净值</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  输入每个月末的实际净值（日元计），图表将自动生成连续的平滑面积推移
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
              {editingList.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <input
                    type="text"
                    value={item.month}
                    onChange={(e) => {
                      const next = [...editingList];
                      next[idx].month = e.target.value;
                      setEditingList(next);
                    }}
                    placeholder="YYYY-MM"
                    className="w-24 px-2 py-1.5 rounded-md border border-border bg-background font-mono text-center"
                  />
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1.5 text-muted-foreground">¥</span>
                    <input
                      type="number"
                      value={item.valueJpy}
                      onChange={(e) => {
                        const next = [...editingList];
                        next[idx].valueJpy = Number(e.target.value) || 0;
                        setEditingList(next);
                      }}
                      className="w-full pl-6 pr-2 py-1.5 rounded-md border border-border bg-background font-mono text-right"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingList(editingList.filter((_, i) => i !== idx));
                    }}
                    className="text-muted-foreground hover:text-rose-500 p-1 cursor-pointer"
                    title="删除该月记录"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  setEditingList([...editingList, { month: '2024-04', valueJpy: 110000000 }]);
                }}
                className="w-full py-1.5 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus size={13} />
                <span>新增月份点位</span>
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="gf-text-action text-xs"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveHistory}
                className="gf-primary-action text-xs"
              >
                <Check size={13} />
                <span>保存并更新图表</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
