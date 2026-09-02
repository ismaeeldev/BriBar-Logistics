'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { DRIVER_NAV, isCurrent } from '@/components/layout/nav-items';
import { UI } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils/cn';

/**
 * Driver navigation, in two genuinely different forms.
 *
 * **On a phone: a bottom tab bar.** A driver holds the phone one-handed,
 * often standing at the back of a truck. The top of a 6-inch screen is out of
 * thumb reach; the bottom is where the hand already is. This is the native
 * pattern on both platforms for exactly that reason, and Add Service — the one
 * action the whole driver interface exists for (SRS 15.1) — sits raised in the
 * centre where the thumb rests.
 *
 * **On a desktop: inline links in the header.** A bottom bar on a 1400px
 * monitor is a strip of chrome pinned to the far edge of the screen, miles from
 * the content and from the cursor. The same three destinations move into the
 * header, where a mouse expects them.
 *
 * Both are rendered; CSS decides which is visible. Two components would mean
 * two lists of links to keep in step, and they already share `DRIVER_NAV`.
 */
export function DriverNavDesktop() {
  const pathname = usePathname();

  return (
    <nav aria-label={UI.nav.driverLabel} className="hidden items-center gap-1 sm:flex">
      {DRIVER_NAV.filter((item) => !item.primary).map(({ href, label, icon: Icon }) => {
        const active = isCurrent(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DriverNavMobile() {
  const pathname = usePathname();

  /**
   * The Add Service and Edit screens carry their own sticky submit bar, and
   * two stacked bars at the bottom of a phone is one too many. Hiding the tab
   * bar there also matches what a native app does with a form: it takes over
   * the screen until it is finished or cancelled.
   */
  const onFormScreen = pathname === '/services/new' || pathname.endsWith('/edit');
  if (onFormScreen) return null;

  return (
    <nav
      aria-label={UI.nav.driverLabel}
      className="bg-card/95 pb-safe fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur-sm sm:hidden"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around gap-1 px-2 pt-1.5">
        {DRIVER_NAV.map(({ href, label, icon: Icon, primary }) => {
          const active = isCurrent(pathname, href);

          if (primary) {
            return (
              <Link
                key={href}
                href={href}
                className="text-primary flex min-w-0 flex-1 flex-col items-center gap-1 px-2 py-1"
              >
                {/* Raised and filled: the one action the interface is for. */}
                <span className="bg-primary text-primary-foreground -mt-5 flex size-12 items-center justify-center rounded-full shadow-lg">
                  <Icon className="size-6" />
                </span>
                <span className="truncate text-[0.65rem] font-medium">{label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-2 py-1.5 transition-colors',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon className="size-5" />
              <span className="truncate text-[0.65rem] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
