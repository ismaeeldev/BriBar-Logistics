'use client';

import { Filter, Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useDebounce } from 'use-debounce';

import { FIELD_LABELS, ROLE_LABELS, UI } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils/cn';

/**
 * URL-backed free-text search for the admin lists (SRS 16.3, 23.3).
 *
 * The term lives in the query string, not in component state, so a searched
 * view is shareable and survives a back-navigation — the same principle as
 * `ServiceFilters`. The input is debounced so typing does not push a history
 * entry per keystroke.
 */
export function SearchBar({
  placeholder = UI.common.searchPlaceholder,
  className,
}: {
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const urlQuery = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(urlQuery);
  const [debouncedQuery] = useDebounce(query, 300);

  // Keep the field in step when the URL changes from elsewhere — a back
  // navigation, or a "clear all" button in another control. Mirroring an
  // external source into a controlled input is the accepted use of this.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(searchParams.get('q') ?? '');
  }, [searchParams]);

  useEffect(() => {
    if (debouncedQuery === (searchParams.get('q') ?? '')) return;

    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      if (debouncedQuery) params.set('q', debouncedQuery);
      else params.delete('q');
      params.delete('page'); // a new search starts on page 1
      router.push(`?${params.toString()}`);
    });
  }, [debouncedQuery, router, searchParams]);

  return (
    <div className={cn('relative w-full max-w-sm', className)}>
      <Search
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
      />
      <input
        type="text"
        inputMode="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          'border-border/60 bg-background w-full rounded-xl border py-2 pr-9 pl-9 text-sm',
          'placeholder:text-muted-foreground focus:ring-primary/20 focus:ring-2 focus:outline-none',
          'transition-shadow',
          isPending && 'opacity-70',
        )}
      />
      {query ? (
        <button
          type="button"
          onClick={() => setQuery('')}
          aria-label={UI.common.clearSearch}
          className="text-muted-foreground hover:text-foreground hover:bg-muted absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 transition-colors"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * The active/inactive (and optionally role) filter for a master-data list.
 *
 * SRS 13.2 / 14.2 want an administrator to see active and inactive records; the
 * list shows both by default and this menu is an opt-in narrowing, so a
 * deactivated record is never hidden without the administrator choosing to hide
 * it (SRS 21.5).
 */
export function ListFilters({ showRoleFilter }: { showRoleFilter?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isActiveFilter = searchParams.get('isActive');
  const roleFilter = searchParams.get('role');

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null) params.delete(key);
    else params.set(key, value);
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const hasActiveFilters = isActiveFilter !== null || roleFilter !== null;

  const statusOptions = [
    { label: UI.common.all, value: null },
    { label: UI.common.active, value: 'true' },
    { label: UI.common.inactive, value: 'false' },
  ];

  const roleOptions = [
    { label: UI.common.all, value: null },
    { label: ROLE_LABELS.DRIVER, value: 'DRIVER' },
    { label: ROLE_LABELS.ADMIN, value: 'ADMIN' },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={cn(
          'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
          hasActiveFilters
            ? 'bg-primary/10 border-primary/20 text-primary'
            : 'bg-card border-border hover:bg-muted text-foreground',
        )}
      >
        <Filter className="size-4" />
        {UI.admin.filters}
      </button>

      {isOpen ? (
        <div className="bg-card border-border/60 animate-rise absolute top-full right-0 z-50 mt-2 flex w-56 flex-col gap-4 rounded-xl border p-4 shadow-lg sm:right-auto sm:left-0">
          <FilterGroup
            name="isActive"
            label={UI.common.status}
            options={statusOptions}
            current={isActiveFilter}
            onSelect={(value) => updateFilter('isActive', value)}
          />
          {showRoleFilter ? (
            <FilterGroup
              name="role"
              label={FIELD_LABELS.role}
              options={roleOptions}
              current={roleFilter}
              onSelect={(value) => updateFilter('role', value)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FilterGroup({
  name,
  label,
  options,
  current,
  onSelect,
}: {
  name: string;
  label: string;
  options: { label: string; value: string | null }[];
  current: string | null;
  onSelect: (value: string | null) => void;
}) {
  return (
    <div>
      <span className="text-muted-foreground mb-2 block text-xs font-semibold tracking-wider uppercase">
        {label}
      </span>
      <div className="flex flex-col gap-1.5">
        {options.map((option) => (
          <label
            key={option.label}
            className="group flex cursor-pointer items-center gap-2 text-sm"
          >
            <input
              type="radio"
              name={name}
              checked={current === option.value}
              onChange={() => onSelect(option.value)}
              className="accent-primary"
            />
            <span
              className={cn(
                'transition-colors',
                current === option.value
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground group-hover:text-foreground',
              )}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
