import { useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Country } from '@/data/types';
import { useSettings } from '@/stores/settings';
import { normalizeName } from './ui';

/** Accessible country autocomplete (ARIA 1.2 combobox). Matches uz / ru / en names. */
export function CountryCombobox({
  countries,
  onSelect,
  disabled,
  placeholder,
}: {
  countries: readonly Country[];
  onSelect: (c: Country) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const { t } = useTranslation();
  const locale = useSettings((s) => s.locale);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const index = useMemo(
    () => countries.map((c) => ({ c, keys: [c.name.uz, c.name.ru, c.name.en, c.officialName].map(normalizeName) })),
    [countries],
  );
  const matches = useMemo(() => {
    const n = normalizeName(q);
    if (!n) return [];
    const scored = index
      .map(({ c, keys }) => ({ c, s: keys.some((k) => k.startsWith(n)) ? 0 : keys.some((k) => k.includes(n)) ? 1 : 2 }))
      .filter((x) => x.s < 2)
      .sort((a, b) => a.s - b.s || a.c.name[locale].localeCompare(b.c.name[locale]));
    return scored.slice(0, 8).map((x) => x.c);
  }, [q, index, locale]);

  const choose = (c: Country | undefined) => {
    if (!c) return;
    onSelect(c);
    setQ('');
    setOpen(false);
    setActive(0);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].id}` : undefined}
        aria-label={placeholder ?? t('borders.inputLabel')}
        placeholder={placeholder ?? t('borders.inputLabel')}
        disabled={disabled}
        value={q}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(matches.length - 1, a + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            choose(matches[active]);
          } else if (e.key === 'Escape') setOpen(false);
        }}
        className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-primary disabled:opacity-50"
      />
      {open && matches.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-line bg-surface p-1 shadow-card">
          {matches.map((c, i) => (
            <li
              key={c.id}
              id={`${listId}-${c.id}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(c);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer rounded-xl px-3 py-2 ${i === active ? 'bg-surface-2' : ''}`}
            >
              {c.name[locale]}
              {locale !== 'en' && <span className="ml-2 text-xs text-ink-muted">{c.name.en}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
