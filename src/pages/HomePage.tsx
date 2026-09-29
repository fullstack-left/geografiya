import { Link } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { GAMES, gamePath } from '@/features/games/registry';
import { Card, Seo } from '@/components/ui';
import { Icon } from '@/components/icons';

export function HomePage() {
  const { t } = useTranslation();
  const [featured, ...rest] = GAMES;

  return (
    <>
      <Seo title={t('home.eyebrow')} description={t('home.subtitle')} />
      <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">{t('home.eyebrow')}</p>
          <h1 className="mt-4 font-display text-5xl leading-[1.02] font-medium tracking-tight text-balance sm:text-6xl">
            {t('home.title')}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-muted">{t('home.subtitle')}</p>
          <Link
            to="/play/area-scaler"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-ink shadow-card transition hover:brightness-110"
          >
            {t('home.cta')} <Icon name="arrow-right" />
          </Link>
        </div>
        <HeroIllustration />
      </section>

      <section className="mt-20" aria-labelledby="games-title">
        <h2 id="games-title" className="font-display text-3xl font-medium">
          {t('home.gamesTitle')}
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured && (
            <Link to="/play/area-scaler" className="group sm:col-span-2 lg:col-span-1 lg:row-span-2">
              <div className="flex h-full flex-col justify-between rounded-3xl bg-primary p-7 text-primary-ink shadow-card transition group-hover:-translate-y-0.5">
                <span className="font-mono text-xs uppercase tracking-widest opacity-80">{t('home.featured')}</span>
                <div className="mt-10">
                  <Icon name={featured.icon} className="text-5xl text-accent" />
                  <h3 className="mt-4 font-display text-3xl">{t(`games.${featured.id}.name`)}</h3>
                  <p className="mt-2 opacity-85">{t(`games.${featured.id}.desc`)}</p>
                  <span className="mt-6 inline-flex items-center gap-2 font-semibold underline underline-offset-4">
                    {t('common.play')} <Icon name="arrow-right" />
                  </span>
                </div>
              </div>
            </Link>
          )}
          {rest.map((g) => (
            <Link key={g.id} to={gamePath(g.id)} className="group">
              <Card className="relative h-full p-6 transition group-hover:-translate-y-0.5 group-hover:border-primary">
                <div className="flex items-start justify-between">
                  <Icon name={g.icon} className="text-3xl text-accent" />
                  {g.id === 'daily' && (
                    <span className="rounded-full bg-accent px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary-ink">
                      {t('home.today')}
                    </span>
                  )}
                </div>
                <h3 className="mt-4 font-display text-xl">{t(`games.${g.id}.name`)}</h3>
                <p className="mt-1 text-sm text-ink-muted">{t(`games.${g.id}.desc`)}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

/** Two stylised blobs "breathing" in scale — hints at the main mechanic. */
function HeroIllustration() {
  return (
    <div className="relative aspect-[4/3] w-full" aria-hidden>
      <svg viewBox="0 0 400 300" className="size-full">
        <circle cx="200" cy="150" r="140" className="fill-none stroke-line" strokeDasharray="2 6" />
        <circle cx="200" cy="150" r="90" className="fill-none stroke-line" strokeDasharray="2 6" />
        <motion.path
          d="M120 110c20-30 60-20 70 5s-5 50-30 60-55-5-50-30 0-20 10-35z"
          className="fill-shape-ref-fill stroke-shape-ref"
          strokeWidth="2"
          initial={{ scale: 0.9 }}
          animate={{ scale: [0.9, 1, 0.9] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '150px 140px' }}
        />
        <motion.path
          d="M230 80c50-15 110 10 115 60s-40 90-95 85-80-40-70-85 10-50 50-60z"
          className="fill-shape-target-fill stroke-shape-target"
          strokeWidth="2"
          initial={{ scale: 0.7 }}
          animate={{ scale: [0.7, 1.05, 0.7] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
          style={{ transformOrigin: '285px 150px' }}
        />
        <text x="150" y="260" textAnchor="middle" className="fill-ink-muted font-mono text-[11px]">
          1×
        </text>
        <text x="285" y="260" textAnchor="middle" className="fill-ink-muted font-mono text-[11px]">
          ?×
        </text>
      </svg>
    </div>
  );
}
