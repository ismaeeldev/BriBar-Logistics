import { ClipboardList, LayoutDashboard, Plus, Route, Truck, Users } from 'lucide-react';
import type { ComponentType } from 'react';

import { UI } from '@/lib/i18n/messages';

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Marks the primary action, which the mobile bar renders differently. */
  primary?: boolean;
}

/**
 * The destinations each role can reach, declared once.
 *
 * Both navigations — the driver's bottom bar and the administrator's sidebar —
 * read from these, so a new section appears in every size of the interface
 * without being added in two places.
 */
export const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: UI.admin.panelTitle, icon: LayoutDashboard },
  { href: '/admin/services', label: UI.nav.services, icon: ClipboardList },
  { href: '/admin/users', label: UI.nav.drivers, icon: Users },
  { href: '/admin/vehicles', label: UI.nav.vehicles, icon: Truck },
  { href: '/admin/routes', label: UI.nav.routes, icon: Route },
];

export const DRIVER_NAV: NavItem[] = [
  { href: '/driver', label: UI.nav.panel, icon: LayoutDashboard },
  { href: '/services/new', label: UI.driver.addService, icon: Plus, primary: true },
  { href: '/services', label: UI.driver.history, icon: ClipboardList },
];

/**
 * Whether a nav item is the one currently open.
 *
 * A prefix match keeps a section highlighted on its detail pages, but the
 * dashboard entries (`/admin`, `/driver`) must match exactly — otherwise
 * `/admin/vehicles` would light up both the dashboard and Vehicles.
 */
export function isCurrent(pathname: string, href: string, exact = false): boolean {
  if (exact || href === '/admin' || href === '/driver') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
