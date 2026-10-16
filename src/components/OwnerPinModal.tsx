import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Delete,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
  Unlock,
  X,
} from 'lucide-react';
import {
  getOwnerPin,
  setOwnerPin,
  verifyOwnerPin,
} from '../lib/storage';

interface OwnerPinModalProps {
  isOpen: boolean;
  isUnlocked: boolean;
  onClose: () => void;
  onUnlockSuccess: () => void;
  onLockVault: () => void;
  onResetToVerifiedBaseline: () => void;
}

export function OwnerPinModal({
  isOpen,
  isUnlocked,
  onClose,
  onUnlockSuccess,
  onLockVault,
  onResetToVerifiedBaseline,
}: OwnerPinModalProps) {
  const [digits, setDigits] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [pinSavedMsg, setPinSavedMsg] = useState<string | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setDigits('');
      setError(null);
      setIsChangingPin(false);
      setNewPin('');
      setPinSavedMsg(null);
      setTimeout(() => hiddenInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || isUnlocked) return;
    if (digits.length === 4) {
      if (verifyOwnerPin(digits)) {
        setError(null);
        onUnlockSuccess();
        onClose();
      } else {
        setError('PIN 码不正确，请重试');
        setTimeout(() => setDigits(''), 350);
      }
    }
  }, [digits, isOpen, isUnlocked, onClose, onUnlockSuccess]);

  useEffect(() => {
    if (!isOpen || isUnlocked) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        setError(null);
        setDigits((prev) => (prev.length < 4 ? prev + e.key : prev));
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setError(null);
        setDigits((prev) => prev.slice(0, -1));
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isUnlocked, onClose]);

  if (!isOpen) return null;

  const appendDigit = (d: string) => {
    setError(null);
    setDigits((prev) => (prev.length < 4 ? prev + d : prev));
  };

  const removeLastDigit = () => {
    setError(null);
    setDigits((prev) => prev.slice(0, -1));
  };

  const handleSaveNewPin = () => {
    if (!/^\d{4}$/.test(newPin)) {
      setError('请输入4位纯数字 PIN 码');
      return;
    }
    if (setOwnerPin(newPin)) {
      setError(null);
      setIsChangingPin(false);
      setNewPin('');
      setPinSavedMsg('4位 PIN 码已更新');
      setTimeout(() => setPinSavedMsg(null), 2500);
    }
  };

  return (
    <div
      className="gf-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="主人私享空间认证"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          width: 'min(400px, calc(100vw - 32px))',
          padding: '1.5rem',
          boxShadow: '0 24px 48px rgba(15, 23, 42, 0.18)',
          border: '1px solid #e2e8f0',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px',
          }}
        >
          <X size={18} />
        </button>

        {!isUnlocked ? (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 0.85rem',
              }}
            >
              <Lock size={22} />
            </div>

            <h2
              style={{
                margin: '0 0 4px',
                fontSize: '1.1rem',
                fontWeight: 700,
                color: '#0f172a',
              }}
            >
              进入我的私享持仓
            </h2>
            <p
              style={{
                margin: '0 0 1.25rem',
                fontSize: '0.78rem',
                color: '#64748b',
                lineHeight: 1.5,
              }}
            >
              输入 4 位 PIN 码解锁个人真实账本（17账户 · 1.284亿日元）
              <br />
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                默认首页保持公开示例，仅解锁后加载并保存个人数据
              </span>
            </p>

            {/* 4-Digit Indicator Boxes */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '12px',
                marginBottom: '1rem',
              }}
              onClick={() => hiddenInputRef.current?.focus()}
            >
              {[0, 1, 2, 3].map((idx) => {
                const filled = idx < digits.length;
                const active = idx === digits.length;
                return (
                  <div
                    key={idx}
                    style={{
                      width: '50px',
                      height: '54px',
                      borderRadius: '10px',
                      border: error
                        ? '2px solid #ef4444'
                        : active
                          ? '2px solid #2563eb'
                          : filled
                            ? '1.5px solid #93c5fd'
                            : '1.5px solid #cbd5e1',
                      background: filled ? '#f8fafc' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.4rem',
                      fontWeight: 700,
                      color: '#0f172a',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {filled ? '●' : ''}
                  </div>
                );
              })}
            </div>

            {error && (
              <div
                style={{
                  color: '#dc2626',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  marginBottom: '0.75rem',
                }}
              >
                {error}
              </div>
            )}

            {/* Numeric Keypad */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                maxWidth: '260px',
                margin: '0 auto 0.9rem',
              }}
            >
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => appendDigit(num)}
                  style={{
                    height: '44px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    fontSize: '1.05rem',
                    fontWeight: 600,
                    color: '#0f172a',
                    cursor: 'pointer',
                  }}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDigits('')}
                style={{
                  height: '44px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: '#64748b',
                  cursor: 'pointer',
                }}
              >
                清空
              </button>
              <button
                type="button"
                onClick={() => appendDigit('0')}
                style={{
                  height: '44px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  fontSize: '1.05rem',
                  fontWeight: 600,
                  color: '#0f172a',
                  cursor: 'pointer',
                }}
              >
                0
              </button>
              <button
                type="button"
                onClick={removeLastDigit}
                aria-label="退格"
                style={{
                  height: '44px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#475569',
                  cursor: 'pointer',
                }}
              >
                <Delete size={17} />
              </button>
            </div>

            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              默认初始 PIN：<code>{getOwnerPin() === '8888' ? '8888' : '已自定义'}</code>（支持键盘直接输入）
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#dcfce7',
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Unlock size={20} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 700, color: '#0f172a' }}>
                  主人私享空间 · 已解锁
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                  当前所有编辑实时保存在本地加密私享仓，与访客模式完全隔离
                </p>
              </div>
            </div>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                marginBottom: '1rem',
                fontSize: '0.78rem',
                color: '#334155',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>核对账本基准总额</span>
                <strong style={{ color: '#0f172a' }}>¥128,355,955 (约1.284亿日元)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>覆盖机构与账户</span>
                <strong>17 个账户 · 31 笔持仓明细</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>参考汇率基准</span>
                <span>法国央行 2026-10-15 (USD/HKD/CNY)</span>
              </div>
            </div>

            {pinSavedMsg && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: '#f0fdf4',
                  color: '#15803d',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  marginBottom: '0.85rem',
                }}
              >
                <CheckCircle2 size={15} />
                <span>{pinSavedMsg}</span>
              </div>
            )}

            {isChangingPin ? (
              <div
                style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '0.85rem',
                  marginBottom: '1rem',
                }}
              >
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    color: '#0f172a',
                    marginBottom: '6px',
                  }}
                >
                  设置新的 4 位数字 PIN 码
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="例如: 2026"
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.9rem',
                      letterSpacing: '0.2em',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveNewPin}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangingPin(false);
                      setError(null);
                    }}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      background: '#f1f5f9',
                      color: '#475569',
                      border: 'none',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                    }}
                  >
                    取消
                  </button>
                </div>
                {error && (
                  <div style={{ color: '#dc2626', fontSize: '0.74rem', marginTop: '6px' }}>
                    {error}
                  </div>
                )}
              </div>
            ) : null}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  onResetToVerifiedBaseline();
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #bfdbfe',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={14} />
                <span>重置/同步为最新 1.284亿 核对基准 (含微信证券17账户)</span>
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsChangingPin(true)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    color: '#334155',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <KeyRound size={14} />
                  <span>修改 PIN 码</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onLockVault();
                    onClose();
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #fecaca',
                    background: '#fef2f2',
                    color: '#dc2626',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Lock size={14} />
                  <span>锁定并切回公开首页</span>
                </button>
              </div>
            </div>

            <div
              style={{
                marginTop: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.7rem',
                color: '#94a3b8',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={13} />
              <span>锁定后首页默认展示伯克希尔 13F 公开示例</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
