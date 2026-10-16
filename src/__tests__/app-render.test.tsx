import { describe, it } from 'vitest';
import { render } from '@testing-library/react';
import App from '../App';

describe('App component', () => {
  it('renders without crashing in default state', () => {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    render(<App />);
  });

  it('renders without crashing in owner unlocked state', () => {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    sessionStorage.setItem('portfolio-owner-unlocked-session', '1');
    render(<App />);
  });
});

