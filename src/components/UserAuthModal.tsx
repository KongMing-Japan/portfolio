import { useEffect, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  KeyRound,
  Lock,
  LogOut,
  RefreshCw,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import {
  DEFAULT_USER,
  getAuthenticatedUsername,
  logoutServerSession,
  setUserAuthenticated,
  verifyUserCredentials,
} from '../lib/auth';

interface UserAuthModalProps {
  isOpen: boolean;
  isUnlocked: boolean;
  onClose: () => void;
  onUnlockSuccess: () => void | Promise<void>;
  onLockVault: () => void;
  onResetToVerifiedBaseline?: () => void;
}

export function UserAuthModal({
  isOpen,
  isUnlocked,
  onClose,
  onUnlockSuccess,
  onLockVault,
  onResetToVerifiedBaseline,
}: UserAuthModalProps) {
  const [username, setUsername] = useState(DEFAULT_USER.username);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentUsername = getAuthenticatedUsername() || DEFAULT_USER.username;

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setUsername(DEFAULT_USER.username);
      setPassword('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const valid = await verifyUserCredentials(username, password);
      if (!valid) {
        setError('用户名或密码不正确，请重试');
        return;
      }
      setUserAuthenticated(username.trim());
      await onUnlockSuccess();
      onClose();
    } catch {
      setUserAuthenticated(null);
      setError('服务器未能确认登录，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setIsSubmitting(true);
    try {
      await logoutServerSession();
    } finally {
      onLockVault();
      onClose();
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-[420px] rounded-xl border border-border bg-card text-card-foreground shadow-lg animate-in zoom-in-95 duration-150 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {isUnlocked ? <ShieldCheck size={18} /> : <Lock size={18} />}
            </div>
            <div>
              <h2 id="auth-modal-title" className="text-sm font-semibold tracking-tight text-foreground">
                {isUnlocked ? '私享账户已解锁' : '私享资产安全登录'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isUnlocked ? `当前已登录: ${currentUsername}` : '凭据由服务端验证，不保存在浏览器'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6">
          {isUnlocked ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200/60 bg-emerald-50/50 p-4 text-emerald-900">
                <div className="flex items-center gap-2 font-medium text-xs">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>您正处于私享持仓管理模式</span>
                </div>
                <p className="mt-1 text-xs text-emerald-700/90 leading-relaxed">
                  私享数据读取和修改均需要有效的服务端会话。
                </p>
              </div>

              <div className="space-y-2 pt-1">
                {onResetToVerifiedBaseline && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('确认从云端重新载入已核对的组合数据？（覆盖当前草稿）')) {
                        onResetToVerifiedBaseline();
                        onClose();
                      }
                    }}
                    className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-sm"
                  >
                    <RefreshCw size={13} />
                    <span>重新载入云端核对数据</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleLogout}
                  className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-md bg-muted text-muted-foreground text-xs font-medium hover:bg-muted/80 hover:text-foreground transition-colors"
                >
                  <LogOut size={14} />
                  <span>退出私享登录（切换为公开示例）</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleLogin} method="post" action="#" className="space-y-4">
              <div>
                <label htmlFor="auth-username" className="text-xs font-medium text-foreground block mb-1.5">
                  用户名
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                    <User size={15} />
                  </span>
                  <input
                    id="auth-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="auth-password" className="text-xs font-medium text-foreground block mb-1.5">
                  密码
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                    <KeyRound size={15} />
                  </span>
                  <input
                    id="auth-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="输入密码"
                    className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>

              {error && (
                <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2.5">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-9 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-semibold shadow hover:bg-primary/90 transition-colors"
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-1.5">
                    <RefreshCw size={13} className="animate-spin" />
                    <span>正在验证...</span>
                  </span>
                ) : (
                  '登录私享账户'
                )}
              </button>

              <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                登录凭据仅由服务端验证；浏览器不会保存密码或固定 PIN。
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
