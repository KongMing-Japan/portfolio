import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App component', () => {
  beforeEach(() => {
    try {
      sessionStorage.clear?.();
    } catch {}
    try {
      localStorage.clear?.();
    } catch {}
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it('renders strictly Warren Buffett Berkshire Hathaway demo data and hides private tabs when locked', () => {
    render(<App />);

    // 1. Must show public sample badge & title
    expect(screen.getAllByText('组合示例').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('投资大师')).toBeDefined();

    // 2. Must NOT render private tabs for unauthenticated visitors
    expect(screen.queryByText('持仓明细')).toBeNull();
    expect(screen.queryByText('日常金融账户')).toBeNull();

    // 3. Hero overview must display 13F sample indicators
    expect(screen.getByText('公开示例 (13F)')).toBeDefined();

    // 4. CIO Card must display Buffett sample review, NOT user specific stocks
    expect(screen.getByText('10 月底复盘 · 伯克希尔 (巴菲特) 示范组合深度诊断')).toBeDefined();
    expect(screen.getByText('伯克希尔重仓个股点评与投资哲学')).toBeDefined();

    // 5. Must NOT display the user's private stock reviews
    expect(screen.queryByText('NuScale Power')).toBeNull();
    expect(screen.queryByText('萨莉亚')).toBeNull();
  });

  it('renders full owner portfolio and private tabs when owner unlocked', () => {
    sessionStorage.setItem('portfolio-owner-unlocked-session', '1');
    render(<App />);

    // 1. Shows "我的组合"
    expect(screen.getAllByText('我的组合').length).toBeGreaterThanOrEqual(1);

    // 2. Private tabs must be rendered
    expect(screen.getByText('持仓明细')).toBeDefined();
    expect(screen.getByText('日常金融账户')).toBeDefined();

    // 3. CIO Card displays owner's personal 10月底复盘
    expect(screen.getByText('10 月底复盘')).toBeDefined();
    expect(screen.getByText('重点个股点评与操作建议')).toBeDefined();
  });
});

