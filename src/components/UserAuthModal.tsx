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
  getRegisteredUser,
  registerOrUpdateUser,
  setUserAuthenticated,
  verifyUserCredentials,
} from '../lib/auth';

interface UserAuthModalProps {
  isOpen: boolean;
  isUnlocked: boolean;
  onClose: () => void;
  onUnlockSuccess: () => void;
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
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const registered = getRegisteredUser();
  const currentUsername = getAuthenticatedUsername() || registered?.username || DEFAULT_USER.username;

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
      const reg = getRegisteredUser();
      setUsername(reg?.username || DEFAULT_USER.username);
      setPassword('');
      setNewPassword('');
      setMode('login');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const valid = await verifyUserCredentials(username, password);
      if (valid) {
        setUserAuthenticated(username.trim());
        onUnlockSuccess();
        onClose();
      } else {
        setError('用户名或密码不正确，请重试');
      }
    } catch {
      setError('登录验证出错，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterOrChange = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }
    const targetPassword = newPassword || password;
    if (targetPassword.length < 4) {
      setError('密码长度至少为 4 位');
      return;
    }

    setIsSubmitting(true);
    try {
      await registerOrUpdateUser(username.trim(), targetPassword);
      setUserAuthenticated(username.trim());
      setSuccessMsg('账户凭据已更新！Chrome 浏览器将提示您保存密码。');
      setTimeout(() => {
        onUnlockSuccess();
        onClose();
      }, 900);
    } catch {
      setError('保存账户凭据失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-[420px] rounded-xl border border-border bg-card text-card-foreground shadow-lg animate-in zoom-in-95 duration-150 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        {/* Header */}
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
                {isUnlocked
                  ? `当前已登录: ${currentUsername}`
                  : '支持 Chrome 自动填充与密码管理器'}
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

        {/* Modal Body */}
        <div className="p-6">
          {isUnlocked ? (
            /* Unlocked state actions */
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200/60 bg-emerald-50/50 p-4 text-emerald-900">
                <div className="flex items-center gap-2 font-medium text-xs">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>您正处于私享持仓管理模式</span>
                </div>
                <p className="mt-1 text-xs text-emerald-700/90 leading-relaxed">
                  包含您的核心券商持仓、日常银行备忘及投资现金池。
                </p>
              </div>

              {mode === 'register' ? (
                /* Change Password Form */
                <form onSubmit={handleRegisterOrChange} method="post" action="#" className="space-y-3.5 pt-1">
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      用户名
                    </label>
                    <input
                      name="username"
                      type="text"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      新密码
                    </label>
                    <input
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="设置新密码 (最少4位)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      required
                    />
                  </div>

                  {error && (
                    <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
                      {error}
                    </div>
                  )}

                  {successMsg && (
                    <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-2">
                      {successMsg}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 h-9 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-medium shadow hover:bg-primary/90 transition-colors"
                    >
                      保存新密码
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="h-9 px-3 inline-flex items-center justify-center rounded-md border border-input bg-background text-xs font-medium hover:bg-muted transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-sm"
                  >
                    <KeyRound size={14} />
                    <span>修改用户名或密码</span>
                  </button>

                  {onResetToVerifiedBaseline && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('确认重新载入18个账户的核对基准数据？（覆盖当前草稿）')) {
                          onResetToVerifiedBaseline();
                          onClose();
                        }
                      }}
                      className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-sm"
                    >
                      <RefreshCw size={13} />
                      <span>恢复 18 账户核对基准</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      onLockVault();
                      onClose();
                    }}
                    className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-md bg-muted text-muted-foreground text-xs font-medium hover:bg-muted/80 hover:text-foreground transition-colors"
                  >
                    <LogOut size={14} />
                    <span>退出私享登录 (切换为公开示例)</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Login & First-time setup form */
            <div>
              {/* Tabs */}
              <div className="grid grid-cols-2 rounded-lg bg-muted p-1 mb-4 text-xs font-medium text-muted-foreground">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className={`py-1.5 text-center rounded-md transition-all ${
                    mode === 'login' ? 'bg-background text-foreground shadow-sm font-semibold' : 'hover:text-foreground'
                  }`}
                >
                  登录私享账户
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className={`py-1.5 text-center rounded-md transition-all ${
                    mode === 'register' ? 'bg-background text-foreground shadow-sm font-semibold' : 'hover:text-foreground'
                  }`}
                >
                  设置/修改凭据
                </button>
              </div>

              <form
                onSubmit={mode === 'login' ? handleLogin : handleRegisterOrChange}
                method="post"
                action="#"
                className="space-y-4"
              >
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
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="输入用户名"
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
                      autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'register' ? '设置新密码 (最少4位)' : '输入密码'}
                      className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                </div>

                {error && (
                  <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2.5">
                    {error}
                  </div>
                )}

                {successMsg && (
                  <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-2.5">
                    {successMsg}
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
                      <span>正在处理...</span>
                    </span>
                  ) : mode === 'login' ? (
                    '登录私享账户'
                  ) : (
                    '保存凭据并登录'
                  )}
                </button>

                <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                  提示: 提交后 Chrome 浏览器会自动提示「保存密码」，下次打开即可一键自动填充。
                </p>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
