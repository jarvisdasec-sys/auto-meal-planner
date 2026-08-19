import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export default function Card({ title, subtitle, children, className = '' }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-surface-border bg-surface-card p-5 shadow-lg shadow-black/20 ${className}`}
    >
      {title && <h3 className="text-lg font-semibold text-slate-100">{title}</h3>}
      {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
      <div className={title || subtitle ? 'mt-4' : ''}>{children}</div>
    </div>
  );
}
