import { useMemo, useState } from 'react';
import { AlertCircle, Check, Loader2, Sparkles, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { BaseCurrency, Holding } from '../types';
import { formatEditableNumber, getCleanSecurityName } from '../lib/portfolio';
import { isSameSecurity } from '../lib/upsert';

interface UpsertReviewModalProps {
  isOpen: boolean;
  incoming: Holding[];
  existingHoldings: Holding[];
  baseCurrency: BaseCurrency;
  onConfirm: (reviewedItems: Holding[]) => Promise<void>;
  onClose: () => void;
}

export function UpsertReviewModal({
  isOpen,
  incoming,
  existingHoldings,
  baseCurrency: _baseCurrency,
  onConfirm,
  onClose,
}: UpsertReviewModalProps) {
  const [items, setItems] = useState<Holding[]>(() => incoming);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Sync state if incoming changes
  useMemo(() => {
    setItems(incoming);
    setSubmitError(null);
  }, [incoming]);

  const previewRows = useMemo(() => {
    return items.map((item) => {
      // Find matching existing holding
      const matched = existingHoldings.find((existing) =>
        isSameSecurity(existing, item),
      );
      return {
        item,
        matched,
        isUpdate: Boolean(matched),
      };
    });
  }, [items, existingHoldings]);

  const updateCount = previewRows.filter((r) => r.isUpdate).length;
  const addCount = previewRows.filter((r) => !r.isUpdate).length;

  const handleUpdateItem = (index: number, patch: Partial<Holding>) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = async () => {
    if (items.length === 0) {
      onClose();
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onConfirm(items);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '合并持仓失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="gf-modal-backdrop" role="presentation">
      <div
        className="gf-import-modal !max-w-4xl"
        role="dialog"
        aria-labelledby="upsert-modal-title"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="gf-modal-header">
          <div className="flex items-center gap-2">
            <span className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Sparkles size={16} />
            </span>
            <div>
              <h2 id="upsert-modal-title" className="text-base font-semibold">
                AI 识别持仓确认与合并 (共 {items.length} 笔)
              </h2>
              <p className="text-xs text-muted-foreground">
                比对现有持仓：已有标的将更新持仓数，新标的将直接添加。单价与持仓数均可活动修改。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>

        {/* Status Highlights */}
        <div className="px-6 py-2.5 bg-muted/30 border-y border-border flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="size-2 rounded-full bg-emerald-500" />
              更新现有持仓: <strong className="text-foreground">{updateCount}</strong> 笔
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="size-2 rounded-full bg-blue-500" />
              新增标的: <strong className="text-foreground">{addCount}</strong> 笔
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            💡 行情接口未收录的标的（如场外基金），现价以此处填写的数值为准
          </span>
        </div>

        {/* Extracted Position List */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              列表为空，请关闭弹窗重新导入。
            </div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-medium">
                  <th className="pb-2">标的与代码</th>
                  <th className="pb-2 text-center">合并动作</th>
                  <th className="pb-2">券商</th>
                  <th className="pb-2">币种</th>
                  <th className="pb-2 text-right">持仓数量 (最新)</th>
                  <th className="pb-2 text-right">现价 / 单价</th>
                  <th className="pb-2 text-center w-10">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {previewRows.map(({ item, matched, isUpdate }, index) => {
                  const cleanName = getCleanSecurityName(item.ticker, item.name);
                  return (
                    <tr key={item.id || `${item.ticker}-${index}`} className="hover:bg-muted/20">
                      {/* Ticker & Name */}
                      <td className="py-2.5 pr-2">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">{cleanName}</span>
                          <span className="text-[11px] text-muted-foreground">{item.ticker}</span>
                        </div>
                      </td>

                      {/* Upsert Action */}
                      <td className="py-2.5 px-2 text-center">
                        {isUpdate && matched ? (
                          <div className="inline-flex flex-col items-center">
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                            >
                              更新持仓
                            </Badge>
                            <span className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                              原 {matched.quantity} ➔ 新 {item.quantity}
                            </span>
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                          >
                            + 新增标的
                          </Badge>
                        )}
                      </td>

                      {/* Broker */}
                      <td className="py-2.5 px-2">
                        <input
                          type="text"
                          value={item.broker}
                          onChange={(e) => handleUpdateItem(index, { broker: e.target.value })}
                          className="w-24 h-7 px-2 text-xs rounded border border-border bg-background focus:outline-none focus:border-primary"
                        />
                      </td>

                      {/* Currency */}
                      <td className="py-2.5 px-2">
                        <span className="font-mono text-muted-foreground text-xs">
                          {item.currency}
                        </span>
                      </td>

                      {/* Quantity (Editable) */}
                      <td className="py-2.5 px-2 text-right">
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="any"
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateItem(index, {
                              quantity: Math.max(0, Number(e.target.value)),
                            })
                          }
                          className="w-24 h-7 px-2 text-right text-xs tabular-nums rounded border border-border bg-background focus:outline-none focus:border-primary font-medium"
                          title="修改最新持仓数量"
                        />
                      </td>

                      {/* Market Price (Editable - "活动") */}
                      <td className="py-2.5 px-2 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="any"
                            placeholder="输入现价"
                            value={formatEditableNumber(item.marketPrice)}
                            onChange={(e) => {
                              const val = e.target.value === '' ? null : Number(e.target.value);
                              handleUpdateItem(index, {
                                marketPrice: val,
                                marketValue:
                                  val != null && item.quantity > 0
                                    ? val * item.quantity
                                    : item.importedMarketValue,
                              });
                            }}
                            className="w-24 h-7 px-2 text-right text-xs tabular-nums rounded border border-border bg-background focus:outline-none focus:border-primary font-medium"
                            title="修改现价单价（如接口无法获取行情时将以此价格计算）"
                          />
                        </div>
                      </td>

                      {/* Delete Row */}
                      <td className="py-2.5 pl-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                          title="从本次导入中移除"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {submitError ? (
          <div className="mx-6 mb-2 p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-1.5">
            <AlertCircle size={14} />
            <span>{submitError}</span>
          </div>
        ) : null}

        {/* Modal Actions */}
        <div className="px-6 py-4 bg-muted/20 border-t border-border flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            disabled={isSubmitting || items.length === 0}
            onClick={() => void handleConfirm()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>正在合并组合并获取行情...</span>
              </>
            ) : (
              <>
                <Check size={13} />
                <span>确认合并到组合 ({updateCount} 笔更新 · {addCount} 笔新增)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
