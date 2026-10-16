import * as React from 'react';
import {
  Briefcase,
  Building2,
  Check,
  CreditCard,
  Edit3,
  Landmark,
  NotebookPen,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  classifyAccountRole,
  formatExactMoney,
  formatMoney,
  type AccountRole,
} from '../lib/portfolio';
import type { BaseCurrency, Holding } from '../types';

interface AccountVaultSectionProps {
  allHoldings: Holding[];
  baseCurrency: BaseCurrency;
  excludeDailyAccounts: boolean;
  onToggleExcludeDaily: (exclude: boolean) => void;
  onUpdateHolding: (id: string, patch: Partial<Holding>) => Promise<void>;
  onOpenFullEditor: () => void;
}

type VaultTab = 'daily' | 'brokerage' | 'all';

export function AccountVaultSection({
  allHoldings,
  baseCurrency,
  excludeDailyAccounts,
  onToggleExcludeDaily,
  onUpdateHolding,
  onOpenFullEditor,
}: AccountVaultSectionProps) {
  const [activeTab, setActiveTab] = React.useState<VaultTab>('daily');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draftBalance, setDraftBalance] = React.useState<string>('');
  const [draftMemo, setDraftMemo] = React.useState<string>('');

  // Group all holdings into Daily (Banking + Wallet) vs Brokerage summary
  const { dailyItems, brokerageAccounts, stats } = React.useMemo(() => {
    const daily: Array<Holding & { role: AccountRole }> = [];
    const brokerMap = new Map<
      string,
      {
        broker: string;
        totalBase: number;
        equityBase: number;
        cashBase: number;
        lotCount: number;
        currencies: Set<string>;
        sampleItems: string[];
      }
    >();

    let bankingTotal = 0;
    let walletTotal = 0;
    let brokerageTotal = 0;

    for (const h of allHoldings) {
      const role = classifyAccountRole(h);
      const val = h.valueInBase ?? 0;

      if (role === 'banking' || role === 'wallet') {
        daily.push({ ...h, role });
        if (role === 'banking') bankingTotal += val;
        else walletTotal += val;
      } else {
        brokerageTotal += val;
        const bName = h.broker || '证券账户';
        const cur = brokerMap.get(bName) ?? {
          broker: bName,
          totalBase: 0,
          equityBase: 0,
          cashBase: 0,
          lotCount: 0,
          currencies: new Set<string>(),
          sampleItems: [],
        };
        cur.totalBase += val;
        if (h.layer === 'Cash') cur.cashBase += val;
        else cur.equityBase += val;
        cur.lotCount += 1;
        cur.currencies.add(h.currency);
        if (!cur.sampleItems.includes(h.name || h.ticker)) {
          cur.sampleItems.push(h.name || h.ticker);
        }
        brokerMap.set(bName, cur);
      }
    }

    daily.sort((a, b) => (b.valueInBase ?? 0) - (a.valueInBase ?? 0));
    const brokers = [...brokerMap.values()].sort((a, b) => b.totalBase - a.totalBase);

    return {
      dailyItems: daily,
      brokerageAccounts: brokers,
      stats: {
        bankingTotal,
        walletTotal,
        dailyTotal: bankingTotal + walletTotal,
        brokerageTotal,
        grandTotal: bankingTotal + walletTotal + brokerageTotal,
        bankingCount: daily.filter((d) => d.role === 'banking').length,
        walletCount: daily.filter((d) => d.role === 'wallet').length,
        brokerCount: brokers.length,
      },
    };
  }, [allHoldings]);

  const startEdit = (item: Holding) => {
    const nativeVal =
      item.marketValue ?? item.importedMarketValue ?? item.quantity * (item.marketPrice ?? 1);
    setEditingId(item.id);
    setDraftBalance(String(nativeVal));
    setDraftMemo(item.investmentThesis || '');
  };

  const saveEdit = async (item: Holding) => {
    const num = Number(draftBalance);
    if (Number.isFinite(num) && num >= 0) {
      await onUpdateHolding(item.id, {
        quantity: num,
        costPerUnit: 1,
        marketPrice: 1,
        importedMarketValue: num,
        marketValue: num,
        investmentThesis: draftMemo.trim(),
      });
    }
    setEditingId(null);
  };

  if (dailyItems.length === 0 && brokerageAccounts.length <= 1) {
    return null;
  }

  return (
    <section id="account-vault" className="mt-2">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <NotebookPen className="size-4 text-primary" />
                <CardTitle className="text-base">
                  独立账户备忘录 · 日常生活银行与支付/钱包台账 (Account & Banking Vault)
                </CardTitle>
                <Badge variant="outline">
                  {dailyItems.length} 个日常备忘账户 + {brokerageAccounts.length} 个证券投资户
                </Badge>
              </div>
              <CardDescription className="mt-1">
                将日常生活银行卡、跨境支付与数字钱包从主投资图表中独立划出作为备忘管理：既防止遗忘小额账户与尾号，又不干扰核心证券调仓分析
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <ToggleGroup
                value={[activeTab]}
                onValueChange={(val) => {
                  if (val[0]) setActiveTab(val[0] as VaultTab);
                }}
                variant="outline"
                spacing={1}
              >
                <ToggleGroupItem value="daily" className="text-xs px-2.5 h-7">
                  日常银行与钱包备忘 ({dailyItems.length})
                </ToggleGroupItem>
                <ToggleGroupItem value="brokerage" className="text-xs px-2.5 h-7">
                  核心证券投资账户 ({brokerageAccounts.length})
                </ToggleGroupItem>
                <ToggleGroupItem value="all" className="text-xs px-2.5 h-7">
                  全部账户汇总 ({dailyItems.length + brokerageAccounts.length})
                </ToggleGroupItem>
              </ToggleGroup>

              <Button
                variant="outline"
                size="sm"
                onClick={onOpenFullEditor}
                className="text-xs h-7"
              >
                批量编辑全部明细
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {/* 3 Summary KPI Cards for Account Categories */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <Item variant="muted" className="py-3 px-4 flex-col items-stretch">
              <ItemContent className="gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="size-3.5 text-primary" />
                    日常银行储蓄备忘 ({stats.bankingCount} 户)
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    生活安全垫
                  </Badge>
                </div>
                <span className="text-xl font-bold tabular-nums text-foreground">
                  {formatMoney(stats.bankingTotal, baseCurrency)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  乐天(0985) · 三井住友(2038) · 招行 · Sony(8705) · 瑞穗(2639) · ANT BANK
                </span>
              </ItemContent>
            </Item>

            <Item variant="muted" className="py-3 px-4 flex-col items-stretch">
              <ItemContent className="gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Wallet className="size-3.5 text-teal-600" />
                    跨境支付与数字钱包 ({stats.walletCount} 户)
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    零钱防遗忘
                  </Badge>
                </div>
                <span className="text-xl font-bold tabular-nums text-foreground">
                  {formatMoney(stats.walletTotal, baseCurrency)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Wise · 微信支付 · Revolut · Bitget Wallet · PayPal · Worldcoin
                </span>
              </ItemContent>
            </Item>

            <Item variant="muted" className="py-3 px-4 flex-col items-stretch">
              <ItemContent className="gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Briefcase className="size-3.5 text-blue-600" />
                    核心证券与基金投资户 ({stats.brokerCount} 户)
                  </span>
                  <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-700 bg-blue-50">
                    调仓主力池
                  </Badge>
                </div>
                <span className="text-xl font-bold tabular-nums text-blue-600">
                  {formatMoney(stats.brokerageTotal, baseCurrency)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  乐天证券 · Tiger证券 · 微信证券 · moomoo证券 · 蚂蚁财富
                </span>
              </ItemContent>
            </Item>
          </div>

          {/* Daily Banking & Payment Wallets Table */}
          {(activeTab === 'daily' || activeTab === 'all') && dailyItems.length > 0 && (
            <div className="rounded-xl border overflow-hidden">
              <div className="bg-muted/50 px-4 py-2.5 border-b flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="size-4 text-primary" />
                  <span className="text-xs font-semibold text-foreground">
                    日常生活银行与支付钱包备忘清单（共 {dailyItems.length} 个账户 · 合计 {formatMoney(stats.dailyTotal, baseCurrency)}）
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">上方投资图表与调仓口径：</span>
                  <button
                    type="button"
                    onClick={() => onToggleExcludeDaily(!excludeDailyAccounts)}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border cursor-pointer transition-colors ${
                      excludeDailyAccounts
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-blue-50 text-blue-700 border-blue-300'
                    }`}
                  >
                    {excludeDailyAccounts
                      ? '已隔离：仅作日常备忘，不掺入证券调仓'
                      : '已并入：纳入全量家庭总资产调仓'}
                  </button>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>账户机构与支店/尾号</TableHead>
                    <TableHead>类别</TableHead>
                    <TableHead className="text-right">原币精确余额</TableHead>
                    <TableHead className="text-right">折合 {baseCurrency}</TableHead>
                    <TableHead>账户用途与防遗忘备忘</TableHead>
                    <TableHead className="text-right">快速更新</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyItems.map((item) => {
                    const isEditing = editingId === item.id;
                    const nativeVal =
                      item.marketValue ??
                      item.importedMarketValue ??
                      item.quantity * (item.marketPrice ?? 1);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-xs text-foreground">
                              {item.broker}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {item.account || item.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              item.role === 'banking'
                                ? 'bg-blue-50 text-blue-700 text-[10px]'
                                : 'bg-teal-50 text-teal-800 text-[10px]'
                            }
                          >
                            {item.role === 'banking' ? '银行储蓄' : '支付/数字钱包'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                          {isEditing ? (
                            <div className="inline-flex items-center gap-1 justify-end">
                              <Input
                                type="number"
                                step="any"
                                value={draftBalance}
                                onChange={(e) => setDraftBalance(e.target.value)}
                                className="h-7 w-28 text-right text-xs"
                              />
                              <span className="text-[11px] text-muted-foreground">
                                {item.currency}
                              </span>
                            </div>
                          ) : (
                            formatExactMoney(nativeVal, item.currency)
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                          {formatMoney(item.valueInBase ?? 0, baseCurrency)}
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          {isEditing ? (
                            <Input
                              value={draftMemo}
                              onChange={(e) => setDraftMemo(e.target.value)}
                              placeholder="输入账户用途或防遗忘备注..."
                              className="h-7 text-xs"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {item.investmentThesis || '日常资金与账户留存备忘'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <div className="inline-flex items-center gap-1">
                              <Button
                                size="sm"
                                className="h-6 px-2 text-[11px]"
                                onClick={() => void saveEdit(item)}
                              >
                                <Check className="size-3" />
                                保存
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[11px]"
                                onClick={() => setEditingId(null)}
                              >
                                取消
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => startEdit(item)}
                            >
                              <Edit3 className="size-3.5 mr-1" />
                              记账更新
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Core Investment Brokerage Accounts Summary */}
          {(activeTab === 'brokerage' || activeTab === 'all') && (
            <div className="rounded-xl border overflow-hidden">
              <div className="bg-muted/50 px-4 py-2.5 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Landmark className="size-4 text-primary" />
                  <span className="text-xs font-semibold text-foreground">
                    核心证券与基金投资平台汇总（共 {brokerageAccounts.length} 家机构 · 合计 {formatMoney(stats.brokerageTotal, baseCurrency)}）
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-3.5">
                {brokerageAccounts.map((b) => (
                  <div
                    key={b.broker}
                    className="rounded-lg border bg-card p-3 flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <strong className="text-xs font-bold text-foreground">{b.broker}</strong>
                        <Badge variant="secondary" className="text-[10px]">
                          {b.lotCount} 笔
                        </Badge>
                      </div>
                      <div className="text-base font-bold tabular-nums text-primary mt-1">
                        {formatMoney(b.totalBase, baseCurrency)}
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex flex-col gap-0.5 border-t pt-1.5">
                      <div className="flex justify-between">
                        <span>证券持仓:</span>
                        <span className="font-medium text-foreground tabular-nums">
                          {formatMoney(b.equityBase, baseCurrency)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>可用子弹:</span>
                        <span className="font-medium text-emerald-600 tabular-nums">
                          {formatMoney(b.cashBase, baseCurrency)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="text-xs text-muted-foreground border-t pt-3 flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-emerald-600" />
            全口径家庭总资产 = 证券投资组合 ({formatMoney(stats.brokerageTotal, baseCurrency)}) + 日常银行与钱包备忘 ({formatMoney(stats.dailyTotal, baseCurrency)}) = <strong>{formatMoney(stats.grandTotal, baseCurrency)}</strong>
          </span>
          <span>点击任意日常账户右侧「记账更新」可直接修改最新余额与备注</span>
        </CardFooter>
      </Card>
    </section>
  );
}
