import { useState, useMemo } from 'react';
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
  Check,
  X,
  Plus,
  Trash2,
  Milestone,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import type { AggregatedHolding, BaseCurrency } from '../types';
import { formatExactMoney, formatMoney, formatPercent } from '../lib/portfolio';

export interface MonthlyNetWorthRecord {
  month: string; // e.g. "2026-05"
  valueJpy: number;
}

export interface HistoricalMilestones {
  startDate: string; // "2020-01-01"
  initialFxUsdJpy: number; // 110.0
  webullUsd: number; // 141497
  tigerUsd: number; // 13640
  initialTotalUsd: number; // 155137
  initialTotalJpy: number; // 17065070

  midDate: string; // "2025-10-21"
  midAssetUsd: number; // 250000
  midFxUsdJpy: number; // 150.61
  midAssetJpy: number; // 37652500
  midCumulativeReturn: number; // 1.208 (+120.8%)
  midIrrAnnual: number; // 0.146 (14.60%/年)

  otherHoldingsBaselineJpy?: number; // 同期日股及其他账户持仓基准 (约 85,897,460)
}

const DEFAULT_MILESTONES: HistoricalMilestones = {
  startDate: '2020-01-01',
  initialFxUsdJpy: 110.0,
  webullUsd: 141497,
  tigerUsd: 13640,
  initialTotalUsd: 155137,
  initialTotalJpy: 17065070,

  midDate: '2025-10-21',
  midAssetUsd: 250000,
  midFxUsdJpy: 150.61,
  midAssetJpy: 37652500,
  midCumulativeReturn: 1.208,
  midIrrAnnual: 0.146,

  otherHoldingsBaselineJpy: 85897460,
};

const DEFAULT_HISTORY_2026: MonthlyNetWorthRecord[] = [
  { month: '2026-05', valueJpy: 112500000 },
  { month: '2026-06', valueJpy: 116800000 },
  { month: '2026-07', valueJpy: 114200000 },
  { month: '2026-08', valueJpy: 118600000 },
  { month: '2026-09', valueJpy: 121900000 },
];

const STORAGE_KEY_RECORDS = 'portfolio_networth_history_records_2026_v2';
const STORAGE_KEY_MILESTONES = 'portfolio_historical_milestones_v1';

const LAYER_COLORS: Record<string, string> = {
  Core: '#3b82f6', // blue
  Defensive: '#10b981', // emerald
  Satellite: '#f59e0b', // amber
  Cash: '#64748b', // slate
};

type TimelineViewMode = 'all_cycle' | 'tiger_only' | 'recent_2026';

interface PortfolioHeroOverviewProps {
  totalValue: number;
  baseCurrency: BaseCurrency;
  fx: Record<string, number>;
  aggregated: AggregatedHolding[];
  isOwnerUnlocked?: boolean;
}

interface ChartDataPoint {
  month: string;
  fullMonth: string;
  value: number;
  valueJpy: number;
  note?: string | null;
  isMilestone: boolean;
  momReturn: number | null;
  totalGrowth?: number | null;
}

export function PortfolioHeroOverview({
  totalValue,
  baseCurrency,
  fx,
  aggregated,
  isOwnerUnlocked = false,
}: PortfolioHeroOverviewProps) {
  // 1. Manage Milestones
  const [milestones, setMilestones] = useState<HistoricalMilestones>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MILESTONES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.startDate) return { ...DEFAULT_MILESTONES, ...parsed };
      }
    } catch {
      // fallback
    }
    return DEFAULT_MILESTONES;
  });

  // 2. Manage 2026 Monthly Records
  const [historyRecords, setHistoryRecords] = useState<MonthlyNetWorthRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RECORDS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && String(parsed[0].month).startsWith('2026')) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return DEFAULT_HISTORY_2026;
  });

  // 3. Timeline View Mode: All Cycle (2020~2026) vs Recent 6 Months (2026)
  const [timelineMode, setTimelineMode] = useState<TimelineViewMode>('all_cycle');

  // 4. Modal Editing States
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTab, setEditTab] = useState<'milestones' | 'monthly'>('milestones');
  const [editingMilestones, setEditingMilestones] = useState<HistoricalMilestones>(milestones);
  const [editingList, setEditingList] = useState<MonthlyNetWorthRecord[]>(historyRecords);

  // FX conversion helper: from JPY to baseCurrency
  const convertJpyToBase = (jpyVal: number): number => {
    if (baseCurrency === 'JPY') return Math.round(jpyVal);
    const rateToJpy = fx[baseCurrency] || (baseCurrency === 'USD' ? 154.5 : baseCurrency === 'CNY' ? 21.6 : 1);
    return rateToJpy > 0 ? jpyVal / rateToJpy : jpyVal;
  };

  // Convert current total in baseCurrency back to JPY for storage
  const currentTotalJpy = useMemo(() => {
    if (baseCurrency === 'JPY') return Math.round(totalValue);
    const rateToJpy = fx[baseCurrency] || (baseCurrency === 'USD' ? 154.5 : baseCurrency === 'CNY' ? 21.6 : 1);
    return Math.round(totalValue * rateToJpy);
  }, [baseCurrency, totalValue, fx]);

  // 0. Calculate Tiger holdings vs Non-Tiger holdings in current portfolio
  const { tigerCurrentJpy, nonTigerCurrentJpy } = useMemo(() => {
    let tiger = 0;
    let nonTiger = 0;
    for (const item of aggregated) {
      for (const acc of item.accounts) {
        const rate = fx[acc.currency] || (acc.currency === 'USD' ? 154.5 : acc.currency === 'CNY' ? 21.6 : 1);
        const val = (acc.marketValue ?? (acc.quantity * (acc.marketPrice || 1))) * rate;
        if (acc.broker === 'Tiger证券') {
          tiger += val;
        } else {
          nonTiger += val;
        }
      }
    }
    return {
      tigerCurrentJpy: Math.round(tiger),
      nonTigerCurrentJpy: Math.round(nonTiger),
    };
  }, [aggregated, fx]);

  const otherBaselineJpy = milestones.otherHoldingsBaselineJpy ?? (nonTigerCurrentJpy > 0 ? nonTigerCurrentJpy : 85897460);

  // Combined chart data depending on timelineMode
  const chartData = useMemo<ChartDataPoint[]>(() => {
    // 0. Public Guest Sample Mode (Warren Buffett / Berkshire Hathaway 13F Scale)
    if (!isOwnerUnlocked) {
      const convertUsdToBase = (usdVal: number): number => {
        if (baseCurrency === 'USD') return usdVal;
        const usdRateToJpy = fx['USD'] || 150.4;
        const targetRateToJpy = fx[baseCurrency] || 1;
        return (usdVal * usdRateToJpy) / targetRateToJpy;
      };

      const sampleUsdPoints =
        timelineMode === 'recent_2026'
          ? [
              {
                month: '2026.05',
                fullMonth: '2026-05 (13F 公开报告)',
                usdVal: 275000000000,
                note: '2026 年中持仓估值 ($2,750 亿)',
                isMilestone: false,
              },
              {
                month: '2026.06',
                fullMonth: '2026-06 (估值推移)',
                usdVal: 278000000000,
                note: '金融与能源仓位小幅上扬 ($2,780 亿)',
                isMilestone: false,
              },
              {
                month: '2026.07',
                fullMonth: '2026-07 (估值推移)',
                usdVal: 274000000000,
                note: '夏季科技板块微幅回调 ($2,740 亿)',
                isMilestone: false,
              },
              {
                month: '2026.08',
                fullMonth: '2026-08 (13F 公开报告)',
                usdVal: 280000000000,
                note: '大选前稳健防御布局 ($2,800 亿)',
                isMilestone: false,
              },
              {
                month: '2026.09',
                fullMonth: '2026-09 (估值推移)',
                usdVal: 282000000000,
                note: '现金储备突破 3,250 亿美元 ($2,820 亿)',
                isMilestone: false,
              },
              {
                month: '2026.10',
                fullMonth: '2026-10 (最新 13F 示例组合现值)',
                usdVal:
                  baseCurrency === 'USD'
                    ? totalValue
                    : totalValue / ((fx['USD'] || 150.4) / (fx[baseCurrency] || 1)),
                note: '巴菲特 13F 公开持仓示例组合现值',
                isMilestone: true,
              },
            ]
          : [
              {
                month: '2020.01',
                fullMonth: '2020-01 (13F 公开报告)',
                usdVal: 242000000000,
                note: '2020 年初伯克希尔持仓基准 ($2,420 亿)',
                isMilestone: true,
              },
              {
                month: '2021.01',
                fullMonth: '2021-01 (13F 公开报告)',
                usdVal: 281000000000,
                note: '苹果与核心金融股增值驱动 ($2,810 亿)',
                isMilestone: false,
              },
              {
                month: '2022.01',
                fullMonth: '2022-01 (13F 公开报告)',
                usdVal: 331000000000,
                note: '历史高位持仓规模 ($3,310 亿)',
                isMilestone: false,
              },
              {
                month: '2023.01',
                fullMonth: '2023-01 (13F 公开报告)',
                usdVal: 299000000000,
                note: '加码西方石油与日本五大商社 ($2,990 亿)',
                isMilestone: false,
              },
              {
                month: '2024.01',
                fullMonth: '2024-01 (13F 公开报告)',
                usdVal: 347000000000,
                note: '13F 持仓重回峰值 ($3,470 亿)',
                isMilestone: true,
              },
              {
                month: '2025.01',
                fullMonth: '2025-01 (13F 公开报告)',
                usdVal: 318000000000,
                note: '高位从容减持苹果、增厚现金储备 ($3,180 亿)',
                isMilestone: false,
              },
              {
                month: '2026.05',
                fullMonth: '2026-05 (13F 公开报告)',
                usdVal: 275000000000,
                note: '手握逾 3,200 亿美元国债与现金防御 ($2,750 亿)',
                isMilestone: false,
              },
              {
                month: '2026.10',
                fullMonth: '2026-10 (最新 13F 示例组合现值)',
                usdVal:
                  baseCurrency === 'USD'
                    ? totalValue
                    : totalValue / ((fx['USD'] || 150.4) / (fx[baseCurrency] || 1)),
                note: '巴菲特 13F 公开持仓示例组合现值',
                isMilestone: true,
              },
            ];

      const baseVal = convertUsdToBase(sampleUsdPoints[0].usdVal);
      return sampleUsdPoints.map((item, idx) => {
        const valBase = convertUsdToBase(item.usdVal);
        const prevBase = idx > 0 ? convertUsdToBase(sampleUsdPoints[idx - 1].usdVal) : null;
        const totalGrowth = baseVal > 0 ? (valBase - baseVal) / baseVal : null;
        return {
          month: item.month,
          fullMonth: item.fullMonth,
          value: Math.round(valBase),
          valueJpy: Math.round(item.usdVal * (fx['USD'] || 150.4)),
          note: item.note,
          isMilestone: item.isMilestone,
          momReturn: prevBase && prevBase > 0 ? (valBase - prevBase) / prevBase : null,
          totalGrowth,
        };
      });
    }

    if (timelineMode === 'all_cycle') {
      // Full cycle points: Incorporates同期日股及其他底仓基准 (otherBaselineJpy) so scale remains consistent around 1.03亿~1.24亿~1.19亿
      const fullCycleBaseJpy = milestones.initialTotalJpy + otherBaselineJpy;
      const points = [
        {
          month: '2020.01',
          fullMonth: '2020-01-01 起始基准 (全组合)',
          valueJpy: fullCycleBaseJpy,
          note: `全组合基准：日股等同期底仓 ¥${Math.round(otherBaselineJpy / 10000).toLocaleString()}万 + 老虎/微牛本金 $${milestones.initialTotalUsd.toLocaleString()} (¥${Math.round(milestones.initialTotalJpy / 10000).toLocaleString()}万)`,
          isMilestone: true,
        },
        {
          month: '2025.10',
          fullMonth: '2025-10-21 阶段里程碑 (全组合)',
          valueJpy: milestones.midAssetJpy + otherBaselineJpy,
          note: `全组合总值：日股等底仓 ¥${Math.round(otherBaselineJpy / 10000).toLocaleString()}万 + 老虎美股 $${milestones.midAssetUsd.toLocaleString()} (¥${Math.round(milestones.midAssetJpy / 10000).toLocaleString()}万，美股累计收益 +${(milestones.midCumulativeReturn * 100).toFixed(1)}%，IRR ${(milestones.midIrrAnnual * 100).toFixed(2)}%/年)`,
          isMilestone: true,
        },
        {
          month: '2026.05',
          fullMonth: '2026-05 月末基准',
          valueJpy: 112500000,
          note: '2026 年中全组合资产推移',
          isMilestone: false,
        },
        {
          month: '2026.08',
          fullMonth: '2026-08 月末基准',
          valueJpy: 118600000,
          note: '2026 Q3 全组合资产推移',
          isMilestone: false,
        },
        {
          month: '2026.10',
          fullMonth: '2026-10 最新实盘 (全券商持仓)',
          valueJpy: currentTotalJpy,
          note: '2026-10 全券商实盘对账收官 (按各账户最新持股数精确汇总)',
          isMilestone: true,
        },
      ];

      return points.map((item, idx) => {
        const valBase = convertJpyToBase(item.valueJpy);
        const prev = idx > 0 ? convertJpyToBase(points[idx - 1].valueJpy) : null;
        const totalGrowth = ((valBase - convertJpyToBase(fullCycleBaseJpy)) / convertJpyToBase(fullCycleBaseJpy));
        return {
          month: item.month,
          fullMonth: item.fullMonth,
          value: valBase,
          valueJpy: item.valueJpy,
          note: item.note,
          isMilestone: item.isMilestone,
          momReturn: prev && prev > 0 ? (valBase - prev) / prev : null,
          totalGrowth,
        };
      });
    }

    if (timelineMode === 'tiger_only') {
      // Tiger Overseas Account Only (2020: $155,137 -> 2025: $250,000 -> 2026: current)
      const tigerPoints = [
        {
          month: '2020.01',
          fullMonth: '2020-01-01 创设本金 (微牛+老虎)',
          valueJpy: milestones.initialTotalJpy,
          note: `创设总投入：微牛 $${milestones.webullUsd.toLocaleString()} + 老虎 $${milestones.tigerUsd.toLocaleString()} (合计 $${milestones.initialTotalUsd.toLocaleString()}，汇率 ${milestones.initialFxUsdJpy})`,
          isMilestone: true,
        },
        {
          month: '2025.10',
          fullMonth: '2025-10-21 阶段里程碑 (老虎美股)',
          valueJpy: milestones.midAssetJpy,
          note: `阶段美股资产 $${milestones.midAssetUsd.toLocaleString()} (汇率 ${milestones.midFxUsdJpy}) · 累计收益 +${(milestones.midCumulativeReturn * 100).toFixed(1)}% · 年化 IRR ${(milestones.midIrrAnnual * 100).toFixed(2)}%/年`,
          isMilestone: true,
        },
        {
          month: '2026.10',
          fullMonth: '2026-10 最新实盘 (老虎美港股)',
          valueJpy: tigerCurrentJpy > 0 ? tigerCurrentJpy : 33460925,
          note: '老虎证券最新实盘市值 (美港股最新行情折算)',
          isMilestone: true,
        },
      ];

      return tigerPoints.map((item, idx) => {
        const valBase = convertJpyToBase(item.valueJpy);
        const prev = idx > 0 ? convertJpyToBase(tigerPoints[idx - 1].valueJpy) : null;
        const totalGrowth = ((valBase - convertJpyToBase(milestones.initialTotalJpy)) / convertJpyToBase(milestones.initialTotalJpy));
        return {
          month: item.month,
          fullMonth: item.fullMonth,
          value: valBase,
          valueJpy: item.valueJpy,
          note: item.note,
          isMilestone: item.isMilestone,
          momReturn: prev && prev > 0 ? (valBase - prev) / prev : null,
          totalGrowth,
        };
      });
    }

    // Recent 2026 monthly details
    const list = [...historyRecords];
    const currentMonthLabel = '2026-10';
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
        note: null,
        isMilestone: false,
        momReturn,
        totalGrowth: null,
      };
    });
  }, [timelineMode, milestones, historyRecords, currentTotalJpy, tigerCurrentJpy, otherBaselineJpy, baseCurrency, fx]);

  // Overall performance calculations depending on timelineMode
  const { totalGrowthSinceInception, growthMultiple } = useMemo(() => {
    if (timelineMode === 'tiger_only') {
      const initBase = convertJpyToBase(milestones.initialTotalJpy);
      const curBase = convertJpyToBase(tigerCurrentJpy > 0 ? tigerCurrentJpy : 33460925);
      if (!initBase || initBase <= 0) return { totalGrowthSinceInception: 0, growthMultiple: 1 };
      return {
        totalGrowthSinceInception: (curBase - initBase) / initBase,
        growthMultiple: curBase / initBase,
      };
    }
    const fullCycleBase = convertJpyToBase(milestones.initialTotalJpy + otherBaselineJpy);
    if (!fullCycleBase || fullCycleBase <= 0) return { totalGrowthSinceInception: 0, growthMultiple: 1 };
    return {
      totalGrowthSinceInception: (totalValue - fullCycleBase) / fullCycleBase,
      growthMultiple: totalValue / fullCycleBase,
    };
  }, [timelineMode, milestones, otherBaselineJpy, tigerCurrentJpy, totalValue, baseCurrency, fx]);

  // Calculate MoM return for the current latest month
  const latestMoM = useMemo(() => {
    if (chartData.length < 2) return null;
    const current = chartData[chartData.length - 1];
    return current.momReturn;
  }, [chartData]);

  // 2. Layer Calculations for Pie Chart
  const { pieData, coreWeight, coreThreeWeight } = useMemo(() => {
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
      { name: '核心仓', layer: 'Core', value: coreVal, weight: cw, color: LAYER_COLORS.Core },
      { name: '防守仓', layer: 'Defensive', value: defVal, weight: dw, color: LAYER_COLORS.Defensive },
      { name: '卫星仓', layer: 'Satellite', value: satVal, weight: sw, color: LAYER_COLORS.Satellite },
      { name: '现金储备', layer: 'Cash', value: cashVal, weight: csw, color: LAYER_COLORS.Cash },
    ];

    return {
      pieData: data,
      coreWeight: cw,
      coreThreeWeight: cw + dw + sw,
    };
  }, [aggregated, totalValue]);

  // Save edited history
  const handleSaveAll = () => {
    setMilestones(editingMilestones);
    setHistoryRecords(editingList);
    try {
      localStorage.setItem(STORAGE_KEY_MILESTONES, JSON.stringify(editingMilestones));
      localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(editingList));
    } catch {
      // ignore
    }
    setIsEditOpen(false);
  };

  const handleOpenEdit = () => {
    setEditingMilestones({ ...milestones });
    setEditingList([...historyRecords]);
    setIsEditOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* =====================================================================
            LEFT (2 Cols): Net Worth Evolution Area Chart + Performance Milestones
           ===================================================================== */}
        <Card className="lg:col-span-2 overflow-hidden shadow-xs flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-muted-foreground">
                    {!isOwnerUnlocked
                      ? '伯克希尔·哈撒韦 13F 规模推移'
                      : timelineMode === 'tiger_only'
                      ? '老虎证券 (美港股专户)'
                      : '投资组合总净值'}
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                    {!isOwnerUnlocked
                      ? '公开示例 (13F)'
                      : timelineMode === 'tiger_only'
                      ? '美港股专户'
                      : timelineMode === 'all_cycle'
                      ? '全周期 (含日股底仓)'
                      : '2026 月度'}
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
                  {isOwnerUnlocked && timelineMode === 'tiger_only'
                    ? formatExactMoney(convertJpyToBase(tigerCurrentJpy > 0 ? tigerCurrentJpy : 33460925), baseCurrency)
                    : formatExactMoney(totalValue, baseCurrency)}
                </div>
              </div>

              {/* Timeline Toggle & Edit Button */}
              <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                <div className="inline-flex items-center bg-muted/70 p-0.5 rounded-lg text-xs" role="tablist">
                  <button
                    type="button"
                    onClick={() => setTimelineMode('all_cycle')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      timelineMode === 'all_cycle'
                        ? 'bg-background text-foreground shadow-2xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title={isOwnerUnlocked ? "全组合全周期推移（含日股等同期底仓基准，避免跨资产规模假跳跃）" : "伯克希尔 13F 历史推移 (2020~2026)"}
                  >
                    {isOwnerUnlocked ? '全周期 (含日股)' : '13F 历史推移 (2020~2026)'}
                  </button>
                  {isOwnerUnlocked && (
                    <button
                      type="button"
                      onClick={() => setTimelineMode('tiger_only')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                        timelineMode === 'tiger_only'
                          ? 'bg-background text-foreground shadow-2xs font-semibold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title="老虎证券 (微牛+老虎美港股) 2020~2026 专属业绩推移"
                    >
                      老虎美港股
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setTimelineMode('recent_2026')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      timelineMode === 'recent_2026'
                        ? 'bg-background text-foreground shadow-2xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title={isOwnerUnlocked ? "2026 年度月度详细净值推移" : "2026 示例推移"}
                  >
                    {isOwnerUnlocked ? '2026 月度' : '2026 示例推移'}
                  </button>
                </div>

                {isOwnerUnlocked && (
                  <button
                    type="button"
                    onClick={handleOpenEdit}
                    className="gf-text-action text-xs font-medium py-1 px-2 rounded-md"
                    title="录入或调整历史基准与里程碑"
                  >
                    <Edit3 size={12} />
                    <span>管理历史</span>
                  </button>
                )}
              </div>
            </div>

            {/* Performance KPI Badges Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2.5 mt-1 border-t border-border/50 text-xs">
              {!isOwnerUnlocked ? (
                <>
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">历史复合年化回报 (CAGR)</span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      +19.8% / 年
                    </span>
                    <span className="text-[9px] text-muted-foreground block mt-0.5">(1965~2025 伯克希尔复利战绩)</span>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">前三大重仓集中度 (Top 3)</span>
                    <span className="text-sm font-bold text-primary tabular-nums">
                      58.2%
                    </span>
                    <span className="text-[9px] text-muted-foreground block mt-0.5">(苹果 / 运通 / 可口可乐)</span>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">现金与短期美债储备</span>
                    <span className="text-xs font-semibold text-foreground tabular-nums">
                      $3,250 亿
                      <span className="text-[10px] text-muted-foreground font-normal ml-1">
                        (流动性安全垫)
                      </span>
                    </span>
                    <span className="text-[9px] text-muted-foreground block mt-0.5">(极端风暴防守与扫货弹药)</span>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">13F 示例持仓现值 (2026.10)</span>
                    <span className="text-xs font-semibold text-primary tabular-nums">
                      {formatExactMoney(totalValue, baseCurrency)}
                    </span>
                    <span className="text-[9px] text-muted-foreground block mt-0.5">(公开样本数据仅供演示)</span>
                  </div>
                </>
              ) : timelineMode === 'tiger_only' ? (
                <>
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">美港股阶段收益 (2020~2025)</span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      +{(milestones.midCumulativeReturn * 100).toFixed(1)}%
                    </span>
                    <span className="text-[9px] text-muted-foreground block mt-0.5">(微牛+老虎实盘增长)</span>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">美港股年化 IRR (微牛+老虎)</span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {(milestones.midIrrAnnual * 100).toFixed(2)}% / 年
                    </span>
                    <span className="text-[9px] text-muted-foreground block mt-0.5">(内部年化复利收益率)</span>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">创设总投入 (2020.01)</span>
                    <span className="text-xs font-semibold text-foreground tabular-nums">
                      ${milestones.initialTotalUsd.toLocaleString()}
                      <span className="text-[10px] text-muted-foreground font-normal ml-1">
                        (¥{(milestones.initialTotalJpy / 10000).toFixed(0)}万)
                      </span>
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">老虎专户最新实盘 (2026.10)</span>
                    <span className="text-xs font-semibold text-primary tabular-nums">
                      {formatExactMoney(convertJpyToBase(tigerCurrentJpy > 0 ? tigerCurrentJpy : 33460925), baseCurrency)}
                    </span>
                  </div>
                </>
              ) : timelineMode === 'all_cycle' ? (
                <>
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">老虎美港股阶段收益</span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      +{(milestones.midCumulativeReturn * 100).toFixed(1)}%
                    </span>
                    <span className="text-[9px] text-muted-foreground block mt-0.5">(2020~2025 阶段业绩)</span>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">老虎美股年化 IRR</span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {(milestones.midIrrAnnual * 100).toFixed(2)}% / 年
                    </span>
                    <span className="text-[9px] text-muted-foreground block mt-0.5">(微牛+老虎创设专户)</span>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">全组合起始基准 (2020.01)</span>
                    <span className="text-xs font-semibold text-foreground tabular-nums">
                      ¥{Math.round((milestones.initialTotalJpy + otherBaselineJpy) / 10000).toLocaleString()}万
                    </span>
                    <span className="text-[9px] text-muted-foreground block mt-0.5">(含日股底仓与美股本金)</span>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">全组合阶段基准 (2025.10)</span>
                    <span className="text-xs font-semibold text-primary tabular-nums">
                      ¥{Math.round((milestones.midAssetJpy + otherBaselineJpy) / 10000).toLocaleString()}万
                    </span>
                    <span className="text-[9px] text-muted-foreground block mt-0.5">(老虎 $25万 + 日股底仓)</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">2026 年中高点 (09月)</span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      ¥12,190万
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">2026 年中低点 (05月)</span>
                    <span className="text-sm font-bold text-foreground tabular-nums">
                      ¥11,250万
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">最新月度环比</span>
                    <span className={`text-xs font-semibold tabular-nums ${latestMoM !== null && latestMoM >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {latestMoM !== null && latestMoM >= 0 ? '+' : ''}{latestMoM !== null ? (latestMoM * 100).toFixed(1) : '0.0'}%
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">2026 收官总净值</span>
                    <span className="text-xs font-semibold text-primary tabular-nums">
                      {formatExactMoney(totalValue, baseCurrency)}
                    </span>
                  </div>
                </>
              )}
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
                    domain={['auto', 'auto']}
                    tickFormatter={(val: number) => {
                      if (baseCurrency === 'JPY') {
                        if (val >= 100000000) {
                          return `${(val / 100000000).toFixed(2)}亿`;
                        }
                        return `${Math.round(val / 10000).toLocaleString('en-US')}万`;
                      }
                      if (baseCurrency === 'USD') {
                        if (val >= 1000000000) {
                          return `$${(val / 1000000000).toFixed(0)}B`;
                        }
                        if (val >= 1000000) {
                          return `$${(val / 1000000).toFixed(0)}M`;
                        }
                        return `$${Math.round(val / 1000).toLocaleString('en-US')}k`;
                      }
                      return `¥${Math.round(val / 10000).toLocaleString('en-US')}万`;
                    }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-border bg-popover/95 p-3 shadow-md backdrop-blur-xs text-xs space-y-1.5 max-w-xs">
                          <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-1">
                            <span className="font-semibold text-foreground">{d.fullMonth}</span>
                            {d.isMilestone && (
                              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.2 rounded font-medium">
                                里程碑基准
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="text-muted-foreground text-[10px] block">净值折算 ({baseCurrency})</span>
                            <span className="text-base font-bold text-foreground tabular-nums">
                              {formatExactMoney(d.value, baseCurrency)}
                            </span>
                          </div>
                          {d.note && (
                            <p className="text-[11px] text-muted-foreground leading-snug bg-muted/40 p-1.5 rounded">
                              {d.note}
                            </p>
                          )}
                          {d.momReturn !== null && !d.isMilestone && (
                            <p className="text-[10px] text-muted-foreground tabular-nums">
                              环比：
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
            RIGHT (1 Col): Three Core Layers Pie / Donut Chart (Emphasized Graph + Clean Legend)
           ===================================================================== */}
        <Card className="shadow-xs flex flex-col justify-between">
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  核心三仓结构
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  核心仓为主体 · 辅以防守与机动现金
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                三仓 {formatPercent(coreThreeWeight, 0)}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-2 pb-4 flex flex-col items-center justify-center flex-1">
            {/* Enlarged Donut Chart as the Primary Visual Focus */}
            <div className="relative h-[180px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 220, height: 180 }}>
                <PieChart>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-border bg-popover/95 p-2 shadow-md text-xs space-y-0.5">
                          <p className="font-semibold text-foreground flex items-center gap-1.5">
                            <span className="size-2 rounded-full" style={{ background: d.color }} />
                            <span>{d.name}</span>
                          </p>
                          <p className="text-sm font-bold text-foreground tabular-nums">
                            {formatPercent(d.weight, 1)}
                          </p>
                          <p className="text-[11px] text-muted-foreground tabular-nums">
                            {formatExactMoney(d.value, baseCurrency)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={82}
                    paddingAngle={3}
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
                <span className="text-[11px] font-medium text-muted-foreground tracking-wider">核心仓</span>
                <span className="text-xl font-bold text-foreground tabular-nums leading-tight">
                  {formatPercent(coreWeight, 1)}
                </span>
              </div>
            </div>

            {/* Clean Legend without redundant bulky tables */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs pt-3 w-full px-2 border-t border-border/50">
              {pieData.map((item) => (
                <div key={item.layer} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="size-2 rounded-full shrink-0" style={{ background: item.color }} />
                    <span className="text-muted-foreground truncate">{item.name}</span>
                  </div>
                  <span className="font-semibold text-foreground tabular-nums ml-1">
                    {formatPercent(item.weight, 1)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Historical Records & Milestones Modal */}
      {isEditOpen && (
        <div className="gf-modal-backdrop" role="presentation">
          <div className="p-5 rounded-2xl bg-card border border-border shadow-2xl max-w-lg w-full mx-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <h3 className="text-base font-bold text-foreground">管理历史基准与推移点位</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  设定 2020 起始本金、2025 阶段里程碑与 2026 各月实际净值
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

            {/* Tab Switcher in Modal */}
            <div className="flex items-center gap-2 border-b border-border pb-2 text-xs">
              <button
                type="button"
                onClick={() => setEditTab('milestones')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                  editTab === 'milestones'
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Milestone size={13} />
                <span>历史里程碑基准 (2020 / 2025)</span>
              </button>
              <button
                type="button"
                onClick={() => setEditTab('monthly')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                  editTab === 'monthly'
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Clock size={13} />
                <span>2026 月度详细点位</span>
              </button>
            </div>

            {editTab === 'milestones' ? (
              <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1 text-xs">
                {/* Data Scope Banner */}
                <div className="p-2.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                  <div className="font-semibold mb-0.5">数据口径说明：</div>
                  2020~2025 历史投入与收益表现（+120.8%，IRR 14.60%）专属于<strong>老虎证券 / 微牛证券海外美股账户</strong>。其他国内及日本账户（乐天证券、招商证券、蚂蚁财富等）因早期历史数据缺失，当前统一按 2026 实盘持股数与单价汇总。
                </div>

                {/* 2020 Start Milestone */}
                <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between font-semibold text-foreground">
                    <span>① 2020-01-01 初始投入设定 (老虎/微牛账户)</span>
                    <span className="text-[11px] text-muted-foreground">汇率约为 110</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5">微牛账户投入 (USD)</span>
                      <input
                        type="number"
                        value={editingMilestones.webullUsd}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          const totalUsd = val + editingMilestones.tigerUsd;
                          setEditingMilestones({
                            ...editingMilestones,
                            webullUsd: val,
                            initialTotalUsd: totalUsd,
                            initialTotalJpy: Math.round(totalUsd * editingMilestones.initialFxUsdJpy),
                          });
                        }}
                        className="w-full px-2 py-1.5 rounded border border-border bg-background font-mono text-right"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5">老虎账户投入 (USD)</span>
                      <input
                        type="number"
                        value={editingMilestones.tigerUsd}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          const totalUsd = editingMilestones.webullUsd + val;
                          setEditingMilestones({
                            ...editingMilestones,
                            tigerUsd: val,
                            initialTotalUsd: totalUsd,
                            initialTotalJpy: Math.round(totalUsd * editingMilestones.initialFxUsdJpy),
                          });
                        }}
                        className="w-full px-2 py-1.5 rounded border border-border bg-background font-mono text-right"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40 text-[11px]">
                    <div>
                      <span className="text-muted-foreground">合计投入：</span>
                      <span className="font-semibold text-foreground font-mono ml-1">
                        ${editingMilestones.initialTotalUsd.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">折合日元：</span>
                      <span className="font-semibold text-foreground font-mono ml-1">
                        ¥{editingMilestones.initialTotalJpy.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2025 Mid Milestone */}
                <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between font-semibold text-foreground">
                    <span>② 2025-10-21 阶段数据与收益表现</span>
                    <span className="text-[11px] text-muted-foreground">汇率 150.61</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5">阶段资产 (USD)</span>
                      <input
                        type="number"
                        value={editingMilestones.midAssetUsd}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setEditingMilestones({
                            ...editingMilestones,
                            midAssetUsd: val,
                            midAssetJpy: Math.round(val * editingMilestones.midFxUsdJpy),
                          });
                        }}
                        className="w-full px-2 py-1.5 rounded border border-border bg-background font-mono text-right"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5">折算日元 (JPY)</span>
                      <input
                        type="number"
                        value={editingMilestones.midAssetJpy}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setEditingMilestones({
                            ...editingMilestones,
                            midAssetJpy: val,
                          });
                        }}
                        className="w-full px-2 py-1.5 rounded border border-border bg-background font-mono text-right"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5">累计收益率 (%)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={(editingMilestones.midCumulativeReturn * 100).toFixed(1)}
                        onChange={(e) => {
                          const val = (Number(e.target.value) || 0) / 100;
                          setEditingMilestones({ ...editingMilestones, midCumulativeReturn: val });
                        }}
                        className="w-full px-2 py-1.5 rounded border border-border bg-background font-mono text-right"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5">年化 IRR (%)</span>
                      <input
                        type="number"
                        step="0.01"
                        value={(editingMilestones.midIrrAnnual * 100).toFixed(2)}
                        onChange={(e) => {
                          const val = (Number(e.target.value) || 0) / 100;
                          setEditingMilestones({ ...editingMilestones, midIrrAnnual: val });
                        }}
                        className="w-full px-2 py-1.5 rounded border border-border bg-background font-mono text-right"
                      />
                    </div>
                  </div>
                </div>

                {/* ③ Other Holdings Baseline */}
                <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between font-semibold text-foreground">
                    <span>③ 同期日股及其他底仓基准 (JPY)</span>
                    <span className="text-[11px] text-muted-foreground">用于平滑全周期综合图表</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    2020~2025 年间，您已持有日股（乐天证券、moomoo 证券、乐天银行等）及国内资产，其当前实盘持股基准总值约为 <strong>¥{Math.round(otherBaselineJpy).toLocaleString()}</strong>。与老虎美港股合并后，全组合历史推移将呈现连贯真实的 <strong>1.03亿 → 1.24亿 → 1.19亿</strong> 走势，消除跨资产统计假跳跃。
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5">底仓总值设定 (JPY)</span>
                      <input
                        type="number"
                        value={editingMilestones.otherHoldingsBaselineJpy ?? otherBaselineJpy}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setEditingMilestones({
                            ...editingMilestones,
                            otherHoldingsBaselineJpy: val,
                          });
                        }}
                        className="w-full px-2 py-1.5 rounded border border-border bg-background font-mono text-right"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMilestones({
                            ...editingMilestones,
                            otherHoldingsBaselineJpy: nonTigerCurrentJpy > 0 ? nonTigerCurrentJpy : 85897460,
                          });
                        }}
                        className="w-full py-1.5 px-2 rounded border border-border bg-muted/50 hover:bg-muted text-[11px] text-foreground transition-colors cursor-pointer"
                      >
                        重置为当前实盘底仓 (¥{Math.round(nonTigerCurrentJpy > 0 ? nonTigerCurrentJpy : 85897460).toLocaleString()})
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40 text-[11px]">
                    <div>
                      <span className="text-muted-foreground">全组合 2020 起始基准：</span>
                      <span className="font-semibold text-foreground font-mono ml-1">
                        ¥{Math.round(editingMilestones.initialTotalJpy + (editingMilestones.otherHoldingsBaselineJpy ?? otherBaselineJpy)).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">全组合 2025 阶段总值：</span>
                      <span className="font-semibold text-foreground font-mono ml-1">
                        ¥{Math.round(editingMilestones.midAssetJpy + (editingMilestones.otherHoldingsBaselineJpy ?? otherBaselineJpy)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
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
                      placeholder="2026-MM"
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
                    setEditingList([...editingList, { month: '2026-04', valueJpy: 110000000 }]);
                  }}
                  className="w-full py-1.5 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus size={13} />
                  <span>新增月份点位</span>
                </button>
              </div>
            )}

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
                onClick={handleSaveAll}
                className="gf-primary-action text-xs"
              >
                <Check size={13} />
                <span>保存并更新图表与指标</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
