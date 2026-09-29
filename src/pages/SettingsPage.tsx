import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Seo } from '@/components/ui';
import { useSettings, type ThemePref } from '@/stores/settings';
import type { Locale } from '@/data/types';

function Toggle({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div>
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        {desc && <p className="text-sm text-ink-muted">{desc}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-primary' : 'bg-surface-2 ring-1 ring-line'}`}
      >
        <span className={`absolute top-1 size-5 rounded-full bg-surface shadow transition-all ${checked ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-4">
      <span className="font-medium">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex rounded-full border border-line bg-bg p-1">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={`rounded-full px-4 py-1.5 text-sm transition ${value === o.id ? 'bg-primary text-primary-ink' : 'text-ink-muted hover:text-ink'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <Card className="px-6 py-2">
    <h2 className="pt-4 font-mono text-xs uppercase tracking-widest text-accent">{title}</h2>
    <div className="divide-y divide-line">{children}</div>
  </Card>
);

export function SettingsPage() {
  const { t } = useTranslation();
  const s = useSettings();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Seo title={t('settings.title')} />
      <h1 className="font-display text-4xl">{t('settings.title')}</h1>
      <Section title={t('settings.appearance')}>
        <Segmented<ThemePref>
          label={t('settings.theme')}
          value={s.theme}
          onChange={s.setTheme}
          options={[
            { id: 'light', label: t('settings.light') },
            { id: 'dark', label: t('settings.dark') },
            { id: 'system', label: t('settings.system') },
          ]}
        />
        <Segmented<Locale>
          label={t('settings.language')}
          value={s.locale}
          onChange={s.setLocale}
          options={[
            { id: 'uz', label: 'Oʻzbekcha' },
            { id: 'ru', label: 'Русский' },
            { id: 'en', label: 'English' },
          ]}
        />
        <Toggle label={t('settings.sound')} desc={t('settings.soundDesc')} checked={s.sound} onChange={() => s.toggleSound()} />
      </Section>
      <Section title={t('settings.content')}>
        <Toggle label={t('settings.territories')} desc={t('settings.territoriesDesc')} checked={s.includeTerritories} onChange={s.setIncludeTerritories} />
        <Toggle label={t('settings.partial')} desc={t('settings.partialDesc')} checked={s.includePartial} onChange={s.setIncludePartial} />
      </Section>
    </div>
  );
}
