import * as React from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
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
  isDailyMemoAccount,
  type AccountRole,
} from '../lib/portfolio';
import type { BaseCurrency, Holding } from '../types';

interface AccountVaultSectionProps {
  allHoldings: Holding[];
  baseCurrency?: BaseCurrency;
  fx?: Record<string, number>;
  onUpdateHolding: (id: string, patch: Partial<Holding>) => Promise<void>;
}

const FX_RATES_TO_JPY: Record<string, number> = {
  JPY: 1,
  USD: 157.9764,
  HKD: 20.1312,
  CNY: 23.6102,
};

const ACCOUNT_TAGS: Record<string, string[]> = {
  '三井住友': ['日常结算', '生活缴费', '日本主力'],
  SMBC: ['日常结算', '生活缴费', '日本主力'],
  '瑞穗': ['备用日元', '生活缴费'],
  Mizuho: ['备用日元', '生活缴费'],
  Sony: ['外币理财', '日元活期', '借记卡'],
  'Sony银行': ['外币理财', '日元活期', '借记卡'],
  'SBI新生': ['日常备用', '网银转账'],
  'SBI新生银行': ['日常备用', '网银转账'],
  '招商银行': ['国内结算', '人民币备用'],
  CMB: ['国内结算', '人民币备用'],
  Wise: ['跨境汇款', '多币种中转'],
  PayPal: ['线上海淘', '美元备用'],
  Revolut: ['海外刷卡', '外汇换汇'],
  '微信支付': ['社交零钱', '日常小额'],
  '微信': ['社交零钱', '日常小额'],
  '支付宝': ['余额宝理财', '日常扫码'],
  '支付宝余额宝': ['余额宝理财', '日常扫码'],
  'ANT Bank': ['境外储蓄', '港币活期'],
  '蚂蚁银行': ['境外储蓄', '港币活期'],
  Worldcoin: ['Web3身份', '链上钱包'],
  Bitget: ['加密资产', '现货备用'],
};

function getAccountTags(item: Holding): string[] {
  const combined = `${item.broker} ${item.name} ${item.ticker}`.toLowerCase();
  for (const [key, tags] of Object.entries(ACCOUNT_TAGS)) {
    if (combined.includes(key.toLowerCase())) {
      return tags.slice(0, 3);
    }
  }
  if (item.currency === 'JPY') return ['日元日常', '生活备用'];
  if (item.currency === 'CNY') return ['人民币备用', '国内结算'];
  if (item.currency === 'USD') return ['美元备用', '海外消费'];
  return ['日常备用'];
}

export function AccountVaultSection({
  allHoldings,
  fx,
  onUpdateHolding,
}: AccountVaultSectionProps) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draftAmount, setDraftAmount] = React.useState<string>('');
  const [isSaving, setIsSaving] = React.useState(false);

  const dailyItems = React.useMemo(() => {
    const fxRates = { ...FX_RATES_TO_JPY, ...(fx || {}) };
    const list: Array<Holding & { role: AccountRole; jpyValue: number; nativeValue: number }> = [];

    for (const h of allHoldings) {
      if (isDailyMemoAccount(h)) {
        const role = classifyAccountRole(h);
        const nativeValue =
          h.marketValue ??
          h.importedMarketValue ??
          h.quantity * (h.marketPrice ?? h.costPerUnit ?? 1);
        const rate = fxRates[h.currency] ?? 1;
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
  }, [allHoldings, fx]);

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
    <Card id="account-vault">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base">日常金融账户管理</CardTitle>
            <CardDescription>
              独立于上方投资组合，仅作日常银行存款与支付钱包台账备忘（共 {dailyItems.length} 户，点击金额可直接修改）
            </CardDescription>
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            折合日元合计：
            <span className="text-foreground font-semibold ml-1">
              ¥{Math.round(totalJpy).toLocaleString('en-US')}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">账户</TableHead>
              <TableHead className="w-[110px]">类别</TableHead>
              <TableHead className="text-right w-[190px]">原币余额</TableHead>
              <TableHead className="text-right w-[170px]">日元折算 (JPY)</TableHead>
              <TableHead>用途备注</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dailyItems.map((item) => {
              const isEditing = editingId === item.id;
              const tags = getAccountTags(item);

              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-xs text-foreground">
                        {item.broker}
                      </span>
                      {item.account && item.account !== item.broker && (
                        <span className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                          {item.account}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {item.role === 'banking' ? '日常银行' : '支付/钱包'}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <input
                          type="number"
                          step="any"
                          value={draftAmount}
                          onChange={(e) => setDraftAmount(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void saveEdit(item);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          className="w-24 h-6 px-1.5 text-right text-xs tabular-nums rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          autoFocus
                        />
                        <span className="text-[11px] text-muted-foreground">
                          {item.currency}
                        </span>
                        <button
                          type="button"
                          onClick={() => void saveEdit(item)}
                          disabled={isSaving}
                          className="p-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                          title="保存"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="p-1 rounded-md border border-border bg-background hover:bg-muted transition-colors cursor-pointer"
                          title="取消"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => startEdit(item)}
                        className="cursor-pointer group inline-flex items-center justify-end gap-1.5 text-xs tabular-nums text-foreground hover:text-primary transition-colors"
                        title="点击修改余额"
                      >
                        <span>
                          {formatExactMoney(item.nativeValue, item.currency as BaseCurrency)}
                        </span>
                        <Pencil
                          size={11}
                          className="text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0"
                        />
                      </div>
                    )}
                  </TableCell>

                  <TableCell className="text-right text-xs tabular-nums font-medium text-foreground">
                    ¥{Math.round(item.jpyValue).toLocaleString('en-US')}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="text-[10px] font-normal px-1.5 py-0 text-muted-foreground"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
