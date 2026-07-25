import { useRef, useState } from 'react';
import {
  ArrowRight,
  ClipboardList,
  FileImage,
  FileSpreadsheet,
  LockKeyhole,
  Upload,
} from 'lucide-react';

interface UploadScreenProps {
  onFiles: (files: File[]) => void;
  onJsonImport: (file: File) => Promise<void>;
  onManualImport: (text: string) => Promise<void>;
  onSample: () => void;
  onResume: () => void;
  hasSavedPortfolio: boolean;
}

const ACCEPTED = '.csv,.png,.jpg,.jpeg,.webp';

export function UploadScreen({
  onFiles,
  onJsonImport,
  onManualImport,
  onSample,
  onResume,
  hasSavedPortfolio,
}: UploadScreenProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [mode, setMode] = useState<'upload' | 'paste'>('upload');
  const [manualText, setManualText] = useState('');

  const processFiles = (list: FileList | null) => {
    const files = [...(list ?? [])];
    if (!files.length) return;
    const valid = files.filter((file) =>
      /\.(csv|png|jpe?g|webp)$/i.test(file.name),
    );
    if (valid.length !== files.length) {
      setLocalError('只支持 CSV、PNG、JPG 和 WebP 文件。');
      return;
    }
    setLocalError(null);
    onFiles(valid);
  };

  return (
    <main className="upload-page">
      <section className="upload-intro">
        <div className="intro-mark">Portfolio Studio</div>
        <h1>把分散的持仓，变成一张清楚的组合报告。</h1>
        <p>
          上传 CSV / 截图，或直接粘贴几行持仓。系统会统一证券、币种和账户，
          按核心仓、卫星仓、防御仓与现金整理成专业报告。
        </p>
      </section>

      <section className="input-studio">
        <div className="input-tabs" role="tablist" aria-label="导入方式">
          <button
            className={mode === 'upload' ? 'is-active' : ''}
            onClick={() => setMode('upload')}
            role="tab"
            aria-selected={mode === 'upload'}
          >
            <Upload size={16} />
            上传文件
          </button>
          <button
            className={mode === 'paste' ? 'is-active' : ''}
            onClick={() => setMode('paste')}
            role="tab"
            aria-selected={mode === 'paste'}
          >
            <ClipboardList size={16} />
            手写 / 粘贴
          </button>
        </div>

        {mode === 'upload' ? (
          <div
            className={`upload-zone ${dragging ? 'is-dragging' : ''}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              processFiles(event.dataTransfer.files);
            }}
          >
            <div className="upload-icon">
              <Upload size={27} strokeWidth={1.7} />
            </div>
            <h2>拖入持仓文件或截图</h2>
            <p>支持同时上传多个账户 · CSV / PNG / JPG / WebP</p>
            <button
              className="primary-button"
              onClick={() => inputRef.current?.click()}
            >
              选择文件
              <ArrowRight size={17} />
            </button>
            <input
              ref={inputRef}
              className="visually-hidden"
              type="file"
              accept={ACCEPTED}
              multiple
              onChange={(event) => processFiles(event.target.files)}
            />
          </div>
        ) : (
          <div className="paste-zone">
            <div>
              <h2>直接粘贴或手写持仓</h2>
              <p>
                支持 CSV 表头，也支持一行一个简写：
                Ticker, 名称, 币种, 数量, 价格, 券商, 分层, 主题
              </p>
            </div>
            <textarea
              value={manualText}
              onChange={(event) => setManualText(event.target.value)}
              spellCheck={false}
              placeholder={`AAPL, Apple, USD, 100, 200, Berkshire Sample, Core, Consumer Tech\nAXP, American Express, USD, 80, 320, Berkshire Sample, Core, Financials\nCash_USD, USD Cash, USD, 50000, 1, Berkshire Sample, Cash, Liquidity`}
            />
            <button
              className="primary-button"
              onClick={async () => {
                try {
                  setLocalError(null);
                  await onManualImport(manualText);
                } catch (error) {
                  setLocalError(
                    error instanceof Error ? error.message : '手动输入解析失败',
                  );
                }
              }}
            >
              生成报告
              <ArrowRight size={17} />
            </button>
          </div>
        )}
        {localError ? <p className="inline-error studio-error">{localError}</p> : null}
      </section>

      <div className="upload-support">
        <div>
          <FileSpreadsheet size={19} />
          <span>自动识别中、日、英文字段和千位分隔数字</span>
        </div>
        <div>
          <FileImage size={19} />
          <span>截图仅用于当次识别，不在产品数据库中保存</span>
        </div>
        <div>
          <LockKeyhole size={19} />
          <span>完整组合保存在此浏览器，可随时导出或清除</span>
        </div>
      </div>

      <div className="upload-secondary-actions">
        <button className="text-link" onClick={onSample}>
          使用 Berkshire 示例组合查看报告
        </button>
        <span aria-hidden="true">·</span>
        <button className="text-link" onClick={() => jsonRef.current?.click()}>
          导入 Portfolio JSON
        </button>
        {hasSavedPortfolio ? (
          <>
            <span aria-hidden="true">·</span>
            <button className="text-link" onClick={onResume}>
              继续上次组合
            </button>
          </>
        ) : null}
        <input
          ref={jsonRef}
          className="visually-hidden"
          type="file"
          accept=".json,application/json"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              await onJsonImport(file);
            } catch (error) {
              setLocalError(
                error instanceof Error ? error.message : 'JSON 导入失败',
              );
            }
          }}
        />
      </div>

      <footer className="upload-footer" style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(0,0,0,0.08)', width: '100%', textAlign: 'center', fontSize: '0.78rem', color: '#64748b' }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <span>KongMing Network: </span>
          <a href="https://kongmingjapan.com/" target="_blank" rel="noreferrer" style={{ color: '#0f172a', textDecoration: 'none' }}>KongMing</a> ·{' '}
          <a href="https://radar.kongmingjapan.com/" target="_blank" rel="noreferrer" style={{ color: '#0f172a', textDecoration: 'none' }}>Radar</a> ·{' '}
          <a href="https://lab.kongmingjapan.com/" target="_blank" rel="noreferrer" style={{ color: '#0f172a', textDecoration: 'none' }}>Lab</a> ·{' '}
          <a href="https://kids.kongmingjapan.com/" target="_blank" rel="noreferrer" style={{ color: '#0f172a', textDecoration: 'none' }}>Kids</a> ·{' '}
          <a href="https://tax.kongmingjapan.com/" target="_blank" rel="noreferrer" style={{ color: '#0f172a', textDecoration: 'none' }}>Tax</a> ·{' '}
          <a href="https://planner.kongmingjapan.com/" target="_blank" rel="noreferrer" style={{ color: '#0f172a', textDecoration: 'none' }}>Planner</a> ·{' '}
          <a href="https://portfolio.kongmingjapan.com/" style={{ color: '#0f172a', fontWeight: 600 }}>Portfolio</a>
        </div>
        <p style={{ margin: 0 }}>© 2026 KongMing LLC. All rights reserved.</p>
      </footer>
    </main>
  );
}
