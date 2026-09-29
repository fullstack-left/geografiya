import { Link, Outlet } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { applyTheme, useSettings } from '@/stores/settings';
import type { Locale } from '@/data/types';
import { ErrorBoundary, IconButton } from './ui';
import { Icon } from './icons';

const LOCALES: { id: Locale; label: string }[] = [
  { id: 'uz', label: 'O‘z' },
  { id: 'ru', label: 'Ру' },
  { id: 'en', label: 'En' },
];

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="GeoMaster">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <circle cx="16" cy="16" r="14" className="fill-primary" />
        <path
          d="M6 13c4-1 6 2 9 1s4-4 8-3 3 4 3 4M5 19c3 0 5 2 9 1s6-3 9-2 4 2 4 2"
          className="stroke-accent"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      <span className="hidden font-display text-xl font-semibold tracking-tight min-[420px]:inline">
        Geo<span className="italic text-accent">Master</span>
      </span>
    </Link>
  );
}

export function AppShell() {
  const { t } = useTranslation();
  const { theme, setTheme, locale, setLocale, sound, toggleSound } = useSettings();

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const navLink = 'rounded-full px-3 py-1.5 text-sm text-ink-muted transition hover:text-ink [&.active]:bg-surface-2 [&.active]:text-ink';

  return (
    <div className="bg-graticule flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-ink">
        {t('common.skip')}
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-3 sm:gap-4 sm:px-6">
          <Logo />
          <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
            <Link to="/" className={navLink} activeOptions={{ exact: true }}>
              {t('nav.home')}
            </Link>
            <Link to="/data" className={navLink}>
              {t('nav.data')}
            </Link>
            <Link to="/settings" className={navLink}>
              {t('nav.settings')}
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <div role="group" aria-label={t('nav.language')} className="flex rounded-full border border-line bg-surface p-0.5">
              {LOCALES.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  lang={l.id}
                  aria-pressed={locale === l.id}
                  onClick={() => setLocale(l.id)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${locale === l.id ? 'bg-primary text-primary-ink' : 'text-ink-muted hover:text-ink'}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <IconButton label={t('nav.sound')} aria-pressed={sound} onClick={toggleSound} className="hidden sm:grid">
              <Icon name={sound ? 'sound-on' : 'sound-off'} className="text-lg" />
            </IconButton>
            <IconButton label={t('nav.theme')} onClick={() => setTheme(isDark ? 'light' : 'dark')}>
              <Icon name={isDark ? 'sun' : 'moon'} className="text-lg" />
            </IconButton>
            <Link to="/settings" className="md:hidden" aria-label={t('nav.settings')}>
              <span className="grid size-10 place-items-center rounded-full border border-line bg-surface">
                <Icon name="settings" className="text-lg" />
              </span>
            </Link>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="border-t border-line py-6 text-center text-xs text-ink-muted">
        GeoMaster · Natural Earth · World Bank · Wikidata · mledoze/countries ·{' '}
        <Link to="/data" className="underline decoration-dotted underline-offset-2 hover:text-ink">
          {t('nav.data')}
        </Link>
      </footer>
    </div>
  );
}
