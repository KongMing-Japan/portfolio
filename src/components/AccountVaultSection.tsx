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

export function getDailyAccountCategory(item: Holding): string {
  const combined = `${item.broker} ${item.name} ${item.ticker}`.toLowerCase();
  if (
    combined.includes('crypto') ||
    combined.includes('bitget') ||
    combined.includes('worldcoin') ||
    combined.includes('wld') ||
    combined.includes('web3')
  ) {
    return '虚拟币账户';
  }
  if (
    combined.includes('wise') ||
    combined.includes('revolut') ||
    combined.includes('paypal') ||
    combined.includes('微信支付') ||
    combined.includes('wechatpay') ||
    combined.includes('alipay')
  ) {
    return '钱包账户';
  }
  return '银行账户';
}

const DEFAULT_ACCOUNT_NOTES: Record<string, string> = {
  '三井住友银行': '日常生活消费与日本公共事业缴费主力账户',
  'Sony银行': '多币种外汇兑换与日常备用存款',
  Wise: '跨境资金调拨与多币种国际汇款通道',
  Revolut: '海外刷卡消费与即时多币种兑换',
  '瑞穗银行': '日常日元小额存款与备用资金',
  'SBI新生银行': '日元活期储蓄与日常资金周转备用',
  PayPal: '线上国际海淘与美元支付小额零钱',
  '蚂蚁财富': '高流动性活期货币基金（余额宝），用于日常支出',
  '招商银行': '国内人民币日常结算与活期储备资金',
  '微信支付': '国内移动支付与日常社交零钱',
  'ANT BANK': '蚂蚁银行(香港)港币活期储蓄与理财备用',
  'Bitget Wallet': 'Web3 链上交互钱包与加密资产估值',
  Worldcoin: '数字身份与代币钱包估值',
};

export function getAccountDescription(item: Holding): string {
  for (const [key, note] of Object.entries(DEFAULT_ACCOUNT_NOTES)) {
    if (item.broker.includes(key) || item.name.includes(key)) {
      return note;
    }
  }
  if (item.investmentThesis && item.investmentThesis.trim()) {
    const cleaned = item.investmentThesis
      .replace(/（独立备忘.*?）/g, '')
      .replace(/【.*?】/g, '')
      .replace(/^[、，。\s]+|[、，。\s]+$/g, '')
      .trim();
    if (cleaned) return cleaned;
  }
  return '日常消费与生活备用资金';
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
              const category = getDailyAccountCategory(item);
              const description = getAccountDescription(item);

              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <span className="font-medium text-xs text-foreground">
                      {item.broker}
                    </span>
                  </TableCell>

                  <TableCell>
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {category}
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
                    <span className="text-xs text-muted-foreground line-clamp-1" title={description}>
                      {description}
                    </span>
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
