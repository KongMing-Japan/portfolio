import * as React from 'react';
import {
  Building2,
  Check,
  CreditCard,
  Edit2,
  NotebookPen,
  Save,
  Wallet,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  classifyAccountRole,
  formatExactMoney,
  formatMoney,
  getCleanSecurityName,
  isDailyMemoAccount,
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

// 2026-10-15 standard cross-rates to JPY
const FX_RATES_TO_JPY: Record<string, number> = {
  JPY: 1,
  USD: 157.9764,
  HKD: 20.1312,
  CNY: 23.6102,
};

export function AccountVaultSection({
  allHoldings,
  excludeDailyAccounts,
  onToggleExcludeDaily,
  onUpdateHolding,
}: AccountVaultSectionProps) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draftAmount, setDraftAmount] = React.useState<string>('');
  const [isSaving, setIsSaving] = React.useState(false);

  // Filter daily living accounts only (exclude Rakuten Bank and investment accounts)
  const dailyItems = React.useMemo(() => {
    const list: Array<Holding & { role: AccountRole; jpyValue: number; nativeValue: number }> = [];

    for (const h of allHoldings) {
      if (isDailyMemoAccount(h)) {
        const role = classifyAccountRole(h);
        const nativeValue =
          h.marketValue ??
          h.importedMarketValue ??
          h.quantity * (h.marketPrice ?? h.costPerUnit ?? 1);
        const rate = FX_RATES_TO_JPY[h.currency] ?? 1;
        const jpyValue = nativeValue * rate;

        list.push({
          ...h,
          role,
          nativeValue,
          jpyValue,
        });
      }
    }

    return list.sort((a, b) => b.jpyValue - a.jpyValue);
  }, [allHoldings]);

  const totalJpy = React.useMemo(
    () => dailyItems.reduce((sum, item) => sum + item.jpyValue, 0),
    [dailyItems],
  );

  const startEdit = (item: (typeof dailyItems)[0]) => {
    setEditingId(item.id);
    setDraftAmount(String(item.nativeValue));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftAmount('');
  };

  const saveEdit = async (item: (typeof dailyItems)[0]) => {
    const num = Number(draftAmount);
    if (!Number.isFinite(num) || num < 0) return;

    setIsSaving(true);
    try {
      await onUpdateHolding(item.id, {
        quantity: num,
        costPerUnit: 1,
        marketPrice: 1,
        importedMarketValue: num,
        marketValue: num,
      });
      setEditingId(null);
    } finally {
      setIsSaving(false);
    }
  };

  if (dailyItems.length === 0) return null;

  return (
    <section id="account-vault" className="mt-2">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <NotebookPen className="size-4 text-primary" />
                <CardTitle className="text-base">
                  日常生活账户与钱包备忘清单
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {dailyItems.length} 个备忘账户 · 统一日元计价
                </Badge>
              </div>
              <CardDescription className="mt-1">
                日常生活银行存款、支付钱包与防遗忘闲置资金汇总，直接在行内点击修改更新
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">调仓隔离：</span>
              <button
                type="button"
                onClick={() => onToggleExcludeDaily(!excludeDailyAccounts)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${
                  excludeDailyAccounts
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-blue-50 text-blue-700 border-blue-300'
                }`}
                title="控制是否将日常生活账户并入上方投资调仓资产池"
              >
                {excludeDailyAccounts
                  ? '已隔离（不参与投资调仓）'
                  : '已并入全量总资产'}
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="rounded-xl border overflow-hidden">
            <div className="bg-muted/50 px-4 py-2.5 border-b flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CreditCard className="size-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">
                  备忘账户汇总明细
                </span>
              </div>
              <div className="text-xs font-bold text-foreground">
                日元总额折合：
                <span className="text-sm font-extrabold text-primary ml-1 tabular-nums">
                  {formatMoney(totalJpy, 'JPY')}
                </span>
                <span className="text-muted-foreground font-normal ml-1">
                  ({Math.round(totalJpy).toLocaleString('en-US')} JPY)
                </span>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">账户/机构</TableHead>
                  <TableHead className="w-[110px]">类别</TableHead>
                  <TableHead className="text-right w-[160px]">原币余额</TableHead>
                  <TableHead className="text-right w-[170px]">日元估值 (JPY)</TableHead>
                  <TableHead>账户说明与用途</TableHead>
                  <TableHead className="text-center w-[120px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyItems.map((item) => {
                  const isEditing = editingId === item.id;
                  const cleanName = getCleanSecurityName(item.ticker, item.name);

                  return (
                    <TableRow key={item.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs text-foreground">
                            {item.broker}
                          </span>
                          <span className="text-[11px] text-muted-foreground truncate max-w-[160px]" title={item.name}>
                            {item.account || cleanName}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            item.role === 'banking'
                              ? 'bg-blue-50 text-blue-700 text-[10px] font-semibold'
                              : 'bg-teal-50 text-teal-800 text-[10px] font-semibold'
                          }
                        >
                          {item.role === 'banking' ? '日常银行' : '支付/钱包'}
                        </Badge>
                      </TableCell>

                      {/* Native Amount & Inline Edit */}
                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              step="any"
                              value={draftAmount}
                              onChange={(e) => setDraftAmount(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void saveEdit(item);
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              className="w-24 h-7 px-2 text-right text-xs font-mono rounded border border-primary bg-background focus:outline-none"
                              autoFocus
                            />
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {item.currency}
                            </span>
                          </div>
                        ) : (
                          <div
                            onClick={() => startEdit(item)}
                            className="cursor-pointer group flex items-center justify-end gap-1 font-mono text-xs tabular-nums text-foreground"
                            title="点击直接在行内修改余额"
                          >
                            <span>{formatExactMoney(item.nativeValue, item.currency as BaseCurrency)}</span>
                            <Edit2 size={11} className="text-muted-foreground/0 group-hover:text-muted-foreground transition-opacity" />
                          </div>
                        )}
                      </TableCell>

                      {/* JPY Value (Always in JPY) */}
                      <TableCell className="text-right font-mono text-xs tabular-nums font-semibold text-foreground">
                        {formatMoney(item.jpyValue, 'JPY')}
                        <span className="block text-[10px] font-normal text-muted-foreground">
                          ¥{Math.round(item.jpyValue).toLocaleString('en-US')}
                        </span>
                      </TableCell>

                      {/* Memo */}
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {item.investmentThesis || '日常生活与消费备忘'}
                        </span>
                      </TableCell>

                      {/* Action buttons */}
                      <TableCell className="text-center">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void saveEdit(item)}
                              disabled={isSaving}
                              className="p-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                              title="保存"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="p-1 rounded border border-input bg-background hover:bg-muted transition-colors"
                              title="取消"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="text-xs text-muted-foreground hover:text-foreground font-medium px-2 py-0.5 rounded border border-transparent hover:border-border transition-colors cursor-pointer"
                          >
                            修改
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        <CardFooter className="text-xs text-muted-foreground border-t pt-3 flex items-center justify-between flex-wrap gap-2">
          <span>
            三井住友 · Sony银行 · 招商银行 · 瑞穗银行 · SBI新生银行 · Wise · PayPal · Revolut · 支付宝余额宝 · 微信支付 · ANT BANK · 数字钱包
          </span>
          <span className="font-semibold text-foreground">
            总备忘规模：{formatMoney(totalJpy, 'JPY')}
          </span>
        </CardFooter>
      </Card>
    </section>
  );
}
