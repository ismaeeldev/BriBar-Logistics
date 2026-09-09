import {
  Building2,
  ClipboardList,
  LayoutDashboard,
  ListTree,
  Plus,
  Route,
  Settings,
  Truck,
  Users,
} from 'lucide-react';
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
export interface NavSection {
  label: string;
  items: NavItem[];
}

/**
 * The administrator's destinations, in two groups.
 *
 * A flat list of five reads as five equally likely places to go, which is not
 * what they are: two are the daily work and three are records you change
 * occasionally. Grouping them says that without adding a click, and it gives
 * the sidebar a shape a reader can navigate by position rather than by reading
 * every label.
 *
 * The groups are the ones the data actually falls into. There is no Reports or
 * Settings section here, because there are no such screens — SRS 29 excludes a
 * reporting module — and a nav item that goes nowhere is worse than a short
 * menu.
 */
export const ADMIN_SECTIONS: NavSection[] = [
  {
    label: UI.nav.sectionOperations,
    items: [
      { href: '/admin', label: UI.nav.dashboard, icon: LayoutDashboard },
      { href: '/admin/services', label: UI.nav.services, icon: ClipboardList },
    ],
  },
  {
    label: UI.nav.sectionMasterData,
    items: [
      { href: '/admin/users', label: UI.nav.drivers, icon: Users },
      { href: '/admin/vehicles', label: UI.nav.vehicles, icon: Truck },
      { href: '/admin/routes', label: UI.nav.routes, icon: Route },
    ],
  },
  {
    // ERP roadmap Phase 1: the finance-core master data and its config.
    label: UI.nav.sectionFinance,
    items: [
      { href: '/admin/clients', label: UI.nav.clients, icon: Building2 },
      { href: '/admin/lists', label: UI.nav.lists, icon: ListTree },
      { href: '/admin/config', label: UI.nav.config, icon: Settings },
    ],
  },
];

/** The same destinations flat, for the mobile strip that has no room to group. */
export const ADMIN_NAV: NavItem[] = ADMIN_SECTIONS.flatMap((section) => section.items);

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
