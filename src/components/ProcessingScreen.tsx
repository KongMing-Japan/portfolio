import { ArrowLeft, Check, FileSearch, LoaderCircle, RefreshCw } from 'lucide-react';
import type { ProcessingStatus } from '../types';

interface ProcessingScreenProps {
  status: ProcessingStatus;
  error: string | null;
  onBack: () => void;
}

const STEPS = [
  { key: 'parsing', label: '读取文件', description: '解析账户持仓与截图数据' },
  { key: 'matching', label: '标的匹配', description: '规范化证券代码、币种与资产分层' },
  { key: 'quotes', label: '获取实时行情', description: '刷新市场价格与最新外汇汇率' },
] as const;

export function ProcessingScreen({
  status,
  error,
  onBack,
}: ProcessingScreenProps) {
  return (
    <main className="processing-page">
      <div className="processing-mark">
        {error ? <FileSearch size={28} /> : <RefreshCw size={28} />}
      </div>
      <h1>{error ? '导入未完成' : '正在生成您的投资组合'}</h1>
      <p className="processing-message">{status.message}</p>
      <div className="processing-list">
        {STEPS.map((item) => {
          const state = status[item.key];
          return (
            <div className={`processing-row is-${state}`} key={item.key}>
              <div className="processing-state">
                {state === 'done' ? <Check size={17} /> : null}
                {state === 'active' ? (
                  <LoaderCircle className="spin" size={18} />
                ) : null}
                {state === 'pending' ? <span /> : null}
                {state === 'error' ? <span>!</span> : null}
              </div>
              <div>
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </div>
            </div>
          );
        })}
      </div>
      {error ? (
        <button className="secondary-button" onClick={onBack}>
          <ArrowLeft size={16} />
          返回投资组合
        </button>
      ) : null}
    </main>
  );
}
