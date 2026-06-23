import { ArrowLeft, ArrowRight, Trash2 } from 'lucide-react';
import type { Holding, Layer } from '../types';
import { LAYER_META } from '../lib/portfolio';

interface ReviewScreenProps {
  holdings: Holding[];
  onUpdate: (id: string, patch: Partial<Holding>) => void;
  onRemove: (id: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}

const LAYERS = Object.keys(LAYER_META) as Layer[];

export function ReviewScreen({
  holdings,
  onUpdate,
  onRemove,
  onConfirm,
  onBack,
}: ReviewScreenProps) {
  const issues = holdings.filter((holding) => holding.needsReview);
  const groups = new Map<string, Holding[]>();
  for (const holding of issues) {
    const key = holding.broker || '未识别券商';
    groups.set(key, [...(groups.get(key) ?? []), holding]);
  }

  return (
    <main className="review-page">
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={16} />
        重新上传
      </button>
      <div className="review-heading">
        <div>
          <h1>快速确认</h1>
          <p>
            共识别 {holdings.length} 条持仓，只需检查下面 {issues.length} 条异常记录。
          </p>
        </div>
        <button
          className="primary-button"
          onClick={onConfirm}
          disabled={holdings.length === 0}
        >
          生成组合报告
          <ArrowRight size={17} />
        </button>
      </div>

      {issues.length === 0 ? (
        <div className="review-empty">
          <h2>没有发现需要处理的问题</h2>
          <p>证券代码、数量、币种与行情已经准备完成。</p>
        </div>
      ) : (
        <div className="review-groups">
          {[...groups.entries()].map(([broker, rows]) => (
            <section className="review-group" key={broker}>
              <div className="review-group-title">
                <h2>{broker}</h2>
                <span>{rows.length} 条需要确认</span>
              </div>
              <div className="review-table-wrap">
                <table className="review-table">
                  <thead>
                    <tr>
                      <th>证券</th>
                      <th>Ticker</th>
                      <th>币种</th>
                      <th className="numeric">数量</th>
                      <th className="numeric">现价</th>
                      <th>分层</th>
                      <th>问题</th>
                      <th aria-label="删除" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((holding) => (
                      <tr key={holding.id}>
                        <td>
                          <input
                            value={holding.name}
                            aria-label="证券名称"
                            onChange={(event) =>
                              onUpdate(holding.id, { name: event.target.value })
                            }
                          />
                        </td>
                        <td>
                          <input
                            value={holding.ticker}
                            aria-label="Ticker"
                            onChange={(event) =>
                              onUpdate(holding.id, {
                                ticker: event.target.value.trim(),
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="short-input"
                            value={holding.currency}
                            aria-label="币种"
                            onChange={(event) =>
                              onUpdate(holding.id, {
                                currency: event.target.value.toUpperCase(),
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="number-input"
                            type="number"
                            value={holding.quantity}
                            aria-label="数量"
                            onChange={(event) =>
                              onUpdate(holding.id, {
                                quantity: Number(event.target.value),
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="number-input"
                            type="number"
                            value={holding.marketPrice ?? ''}
                            placeholder="待确认"
                            aria-label="现价"
                            onChange={(event) => {
                              const price = event.target.value
                                ? Number(event.target.value)
                                : null;
                              onUpdate(holding.id, {
                                marketPrice: price,
                                marketValue:
                                  price == null ? null : price * holding.quantity,
                              });
                            }}
                          />
                        </td>
                        <td>
                          <select
                            value={holding.layer}
                            aria-label="分层"
                            onChange={(event) =>
                              onUpdate(holding.id, {
                                layer: event.target.value as Layer,
                              })
                            }
                          >
                            {LAYERS.map((layer) => (
                              <option key={layer} value={layer}>
                                {LAYER_META[layer].label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <div className="reason-list">
                            {holding.reviewReasons.map((reason) => (
                              <span key={reason}>{reason}</span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <button
                            className="row-delete"
                            aria-label={`删除 ${holding.name}`}
                            onClick={() => onRemove(holding.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
