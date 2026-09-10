import {
  Building2,
  ChartColumn,
  ClipboardList,
  FileOutput,
  FileText,
  Fuel,
  Gauge,
  Landmark,
  LayoutDashboard,
  ListTree,
  PiggyBank,
  Plus,
  Route,
  Settings,
  Store,
  Tags,
  Truck,
  Users,
  Wallet,
  Wrench,
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
 * The administrator's destinations, in five groups.
 *
 * Grew from two groups (SRS's own Operations/Master data split) to four as
 * the ERP roadmap added enough modules that "Finance" as a single catch-all
 * stopped reading clearly (Phase 3 restructuring), then to five when Phase 5
 * added a distinct fleet/personnel-logging cluster that is neither finance
 * nor one-time master data. The grouping now follows how often a screen is
 * visited, not merely what it is:
 *
 *   Operations    the daily work (SRS's original two).
 *   Master data   the real-world things and people the business tracks -
 *                 drivers, vehicles, routes, clients, suppliers. Set up once,
 *                 rarely revisited.
 *   Finance       the transactional modules an administrator interacts with
 *                 routinely - refuellings, received invoices, investments.
 *   Fleet & personnel  the recurring fleet/staff logs - daily real km,
 *                 personnel costs, maintenance (ERP roadmap Phase 5).
 *   Settings      low-frequency configuration and taxonomy screens - expense
 *                 categories, the simple lookup lists, operational defaults.
 *
 * There is still no Reports section, because there is still no reporting
 * module (SRS 29) - a nav item that goes nowhere is worse than a short menu.
 */
export const ADMIN_SECTIONS: NavSection[] = [
  {
    label: UI.nav.sectionOperations,
    items: [
      { href: '/admin', label: UI.nav.dashboard, icon: LayoutDashboard },
      { href: '/admin/services', label: UI.nav.services, icon: ClipboardList },
      // ERP roadmap Phase 6: the financial/operational analytics layer that
      // replaces the spreadsheet's `00Análisis`. Sits next to the operational
      // dashboard it complements rather than in Finance - it reads across
      // every module, not one.
      { href: '/admin/analytics', label: UI.nav.analytics, icon: ChartColumn },
    ],
  },
  {
    label: UI.nav.sectionMasterData,
    items: [
      { href: '/admin/users', label: UI.nav.drivers, icon: Users },
      { href: '/admin/vehicles', label: UI.nav.vehicles, icon: Truck },
      { href: '/admin/routes', label: UI.nav.routes, icon: Route },
      // ERP roadmap Phase 1/3: clients and suppliers are the same kind of
      // real-world entity vehicles/routes/drivers already are here.
      { href: '/admin/clients', label: UI.nav.clients, icon: Building2 },
      { href: '/admin/suppliers', label: UI.nav.suppliers, icon: Store },
    ],
  },
  {
    // ERP roadmap Phase 2/3/4: the modules an administrator files something
    // into routinely.
    label: UI.nav.sectionFinance,
    items: [
      { href: '/admin/refuellings', label: UI.nav.refuellings, icon: Fuel },
      { href: '/admin/received-invoices', label: UI.nav.receivedInvoices, icon: FileText },
      { href: '/admin/issued-invoices', label: UI.nav.issuedInvoices, icon: FileOutput },
      { href: '/admin/investments', label: UI.nav.investments, icon: PiggyBank },
      { href: '/admin/taxes', label: UI.nav.taxes, icon: Landmark },
    ],
  },
  {
    // ERP roadmap Phase 5: daily real km, personnel costs, maintenance.
    label: UI.nav.sectionFleet,
    items: [
      { href: '/admin/daily-km', label: UI.nav.dailyKm, icon: Gauge },
      { href: '/admin/personnel', label: UI.nav.personnel, icon: Wallet },
      { href: '/admin/maintenance', label: UI.nav.maintenance, icon: Wrench },
    ],
  },
  {
    // ERP roadmap Phase 1/3: configuration and taxonomy, visited rarely.
    label: UI.nav.sectionSettings,
    items: [
      { href: '/admin/expense-categories', label: UI.nav.expenseCategories, icon: Tags },
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
