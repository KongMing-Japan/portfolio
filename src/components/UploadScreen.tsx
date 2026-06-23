import { useRef, useState } from 'react';
import {
  ArrowRight,
  FileImage,
  FileSpreadsheet,
  LockKeyhole,
  Upload,
} from 'lucide-react';

interface UploadScreenProps {
  onFiles: (files: File[]) => void;
  onJsonImport: (file: File) => Promise<void>;
  onSample: () => void;
  onResume: () => void;
  hasSavedPortfolio: boolean;
}

const ACCEPTED = '.csv,.png,.jpg,.jpeg,.webp';

export function UploadScreen({
  onFiles,
  onJsonImport,
  onSample,
  onResume,
  hasSavedPortfolio,
}: UploadScreenProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

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
        <h1>把分散的持仓，变成一张清楚的组合报告。</h1>
        <p>
          上传多个券商的 CSV 或持仓截图。我们会统一证券、币种和账户，
          按核心仓、卫星仓、防御仓与现金重新整理。
        </p>
      </section>

      <section
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
        <button className="primary-button" onClick={() => inputRef.current?.click()}>
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
        {localError ? <p className="inline-error">{localError}</p> : null}
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
          使用示例组合查看报告
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
    </main>
  );
}
