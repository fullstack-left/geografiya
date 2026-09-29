import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Seo } from '@/components/ui';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <Seo title={t('common.notFound')} />
      <p className="font-mono text-6xl text-accent">404</p>
      <h1 className="mt-4 font-display text-3xl">{t('common.notFound')}</h1>
      <p className="mt-2 text-ink-muted">{t('common.notFoundBody')}</p>
      <Link to="/" className="mt-8 inline-block rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-ink">
        {t('common.back')}
      </Link>
    </div>
  );
}
