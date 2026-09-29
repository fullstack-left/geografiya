import { Component, type ButtonHTMLAttributes, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

type Variant = 'primary' | 'secondary' | 'ghost';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-primary-ink hover:brightness-110 shadow-card',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2',
  ghost: 'text-ink hover:bg-surface-2',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function IconButton({ label, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid size-10 place-items-center rounded-full border border-line bg-surface text-ink transition hover:bg-surface-2 active:scale-95 ${className}`}
      {...props}
    />
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-2xl bg-surface-2 ${className}`} />;
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-3xl border border-line bg-surface shadow-card ${className}`}>{children}</div>;
}

/** React 19 hoists <title>/<meta> into <head>. */
export function Seo({ title, description }: { title: string; description?: string }) {
  const full = `${title} · GeoMaster`;
  return (
    <>
      <title>{full}</title>
      {description && <meta name="description" content={description} />}
      <meta property="og:title" content={full} />
      {description && <meta property="og:description" content={description} />}
    </>
  );
}

export function ErrorState({ onRetry, detail }: { onRetry?: () => void; detail?: string }) {
  const { t } = useTranslation();
  return (
    <Card className="mx-auto max-w-lg p-8 text-center" >
      <div role="alert">
        <p className="font-display text-2xl">{t('common.error')}</p>
        <p className="mt-2 text-ink-muted">{t('common.errorBody')}</p>
        {detail && <p className="mt-3 font-mono text-xs text-danger">{detail}</p>}
        {onRetry && (
          <Button className="mt-6" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        )}
      </div>
    </Card>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('GeoMaster error boundary', error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6">
          <ErrorState detail={this.state.error.message} onRetry={() => this.setState({ error: null })} />
        </div>
      );
    }
    return this.props.children;
  }
}
