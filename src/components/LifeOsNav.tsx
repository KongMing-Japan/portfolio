import { Landmark, Orbit, ReceiptText, Route } from 'lucide-react';
import type { Locale } from '../types';

interface LifeOsNavProps {
  locale: Locale;
}

const LABELS = {
  zh: { aria: 'LifeOS 工具', planner: 'Planner', portfolio: 'Portfolio', tax: 'Tax' },
  ja: { aria: 'LifeOS ツール', planner: 'Planner', portfolio: 'Portfolio', tax: 'Tax' },
  en: { aria: 'LifeOS tools', planner: 'Planner', portfolio: 'Portfolio', tax: 'Tax' },
} as const;

export function LifeOsNav({ locale }: LifeOsNavProps) {
  const text = LABELS[locale];
  const taxLocale = locale === 'zh' ? 'zh-CN' : locale;
  const products = [
    { id: 'planner', label: text.planner, href: 'https://planner.kongmingjapan.com/', icon: Route },
    { id: 'portfolio', label: text.portfolio, href: '/', icon: Landmark },
    { id: 'tax', label: text.tax, href: `https://tax.kongmingjapan.com/${taxLocale}/`, icon: ReceiptText },
  ] as const;

  return (
    <nav className="lifeos-nav" aria-label={text.aria}>
      <a className="lifeos-wordmark" href="https://kongmingjapan.com/">
        <Orbit aria-hidden="true" />
        <span>LifeOS</span>
      </a>
      <div className="lifeos-products">
        {products.map((product) => {
          const Icon = product.icon;
          const isActive = product.id === 'portfolio';
          return (
            <a
              className={isActive ? 'is-active' : undefined}
              href={product.href}
              aria-current={isActive ? 'page' : undefined}
              key={product.id}
            >
              <Icon aria-hidden="true" />
              <span>{product.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
