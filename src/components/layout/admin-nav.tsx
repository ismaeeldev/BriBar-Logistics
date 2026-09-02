'use client';

import { ClipboardList, Route, Truck, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { UI } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils/cn';

/**
 * Administrator navigation (SRS 16.2).
 *
 * A horizontal bar rather than a sidebar. There are four destinations; a
 * sidebar would cost 240px of the table width the admin screens actually need,
 * and on a phone it becomes a drawer with a focus trap for no gain. The bar
 * scrolls horizontally on narrow screens and pins to the header on wide ones.
 *
 * A client component only because the active item depends on the current path.
 */
const ITEMS = [
  { href: '/admin/services', label: UI.nav.services, icon: ClipboardList },
  { href: '/admin/users', label: UI.nav.drivers, icon: Users },
  { href: '/admin/vehicles', label: UI.nav.vehicles, icon: Truck },
  { href: '/admin/routes', label: UI.nav.routes, icon: Route },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label={UI.admin.panelTitle}
      className="bg-card/80 sticky top-14 z-10 border-b backdrop-blur-sm"
    >
      <div className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-2">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          // Prefix match so a detail page keeps its section highlighted.
          const isActive = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )}
            >
              <Icon aria-hidden className="size-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
